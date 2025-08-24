#!/usr/bin/env node
/**
 * Warm ISR pages by visiting /{slug} with bounded concurrency.
 * - Standalone (no Next aliases)
 * - Uses Basic Auth for WP if WP_API_USER/WP_API_PASS are set
 * - Retries + timeouts + simple reports
 */

import fs from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { Buffer } from 'node:buffer';
import { config as dotenv } from 'dotenv';

// --- Load env files (Node doesn't do this for you) ---
const ROOT = process.cwd();
const NODE_ENV = process.env.NODE_ENV || 'development';
for (const name of ['.env', `.env.${NODE_ENV}`, '.env.local']) {
  const p = path.join(ROOT, name);
  if (existsSync(p)) dotenv({ path: p, override: true });
}


// ----- Env (trim trailing slashes) -----
const BASE = (process.env.NEXT_PUBLIC_SITE_URL || '').replace(/\/$/, '');
const WP   = (process.env.NEXT_PUBLIC_WP_SITE_URL || '').replace(/\/$/, '');

const WP_USER = process.env.WP_API_USER || '';
const WP_PASS = process.env.WP_API_PASS || '';
const BASIC_AUTH = WP_USER && WP_PASS ? 'Basic ' + Buffer.from(`${WP_USER}:${WP_PASS}`).toString('base64') : '';

const CONCURRENCY        = parseInt(process.env.CONCURRENCY || '8', 10);
const MAX_RETRIES        = parseInt(process.env.MAX_RETRIES || '2', 10);
const RETRY_BASE_MS      = parseInt(process.env.RETRY_BASE_MS || '500', 10);
const REQUEST_TIMEOUT_MS = parseInt(process.env.REQUEST_TIMEOUT_MS || '20000', 10);
const PROGRESS_EVERY     = parseInt(process.env.PROGRESS_EVERY || '50', 10);
const OUT_DIR            = process.env.OUT_DIR || path.resolve('.warm-reports');

if (!BASE || !WP) {
  console.error('ERROR: Set PUBLIC_BASE_URL (or NEXT_PUBLIC_SITE_URL) and WP_SITE_URL (or NEXT_PUBLIC_WP_SITE_URL).');
  process.exit(1);
}

// ----- CLI args -----
const argv = Object.fromEntries(
  process.argv.slice(2).map(s => {
    const [k, v] = s.replace(/^--/, '').split('=');
    return [k, v ?? 'true'];
  })
);
const OFFSET = parseInt(argv.offset || '0', 10);
const LIMIT  = argv.limit != null ? parseInt(argv.limit, 10) : null;

// ----- Utils -----
const sleep  = ms => new Promise(r => setTimeout(r, ms));
const nowIso = () => new Date().toISOString().replace(/[:-]/g, '').replace(/\..+/, '').replace('T','-');
async function ensureDir(p) { try { await fs.mkdir(p, { recursive: true }); } catch {} }
function csvEscape(s) { const str = String(s ?? ''); return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str; }

async function writeReports(all, failed) {
  await ensureDir(OUT_DIR);
  const stamp   = nowIso();
  const jsonOut = path.join(OUT_DIR, `warm-${stamp}.json`);
  const csvOut  = path.join(OUT_DIR, `warm-${stamp}.csv`);
  const failOut = path.join(OUT_DIR, `warm-${stamp}-FAILED.txt`);

  await fs.writeFile(jsonOut, JSON.stringify({ generatedAt: new Date().toISOString(), results: all }, null, 2), 'utf8');

  const headers = ['slug','ok','status','attempts','durationMs','error'];
  const lines   = [headers.join(',')].concat(all.map(r => headers.map(h => csvEscape(r[h])).join(',')));
  await fs.writeFile(csvOut, lines.join('\n'), 'utf8');

  if (failed.length) await fs.writeFile(failOut, failed.map(f => f.slug).join('\n') + '\n', 'utf8');

  console.log(`\nReports written:\n  JSON: ${jsonOut}\n  CSV : ${csvOut}${failed.length ? `\n  FAIL: ${failOut}` : ''}`);
}

async function fetchJsonWithTimeout(url, timeoutMs = REQUEST_TIMEOUT_MS) {
  // Adds Basic Auth automatically for WP calls
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: BASIC_AUTH ? { Authorization: BASIC_AUTH } : undefined,
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(t);
  }
}

// ----- Data sources -----
async function listSlugs() {
  const data = await fetchJsonWithTimeout(`${WP}/wp-json/mini-sites/v1/company-slugs`);
  const slugs = Array.isArray(data?.slugs) ? data.slugs.map(String) : [];
  const slice = slugs.slice(OFFSET, LIMIT != null ? OFFSET + LIMIT : undefined);
  console.log(`Loaded ${slugs.length} total slugs; processing ${slice.length} (offset=${OFFSET}${LIMIT!=null?`, limit=${LIMIT}`:''}).`);
  return slice;
}

// Warm a single slug by visiting the page (first visit builds ISR)
async function warmOnce(slug) {
  const url = `${BASE}/${encodeURIComponent(slug)}`;
  const start = Date.now();
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), REQUEST_TIMEOUT_MS);

  try {
    const res = await fetch(url, { redirect: 'manual', signal: ctrl.signal });
    const ok = [200, 301, 302, 304].includes(res.status);
    return { ok, status: res.status, durationMs: Date.now() - start, error: ok ? '' : `Bad status ${res.status}` };
  } catch (e) {
    return { ok: false, status: 0, durationMs: Date.now() - start, error: e?.name === 'AbortError' ? `Timeout ${REQUEST_TIMEOUT_MS}ms` : (e?.message || 'Fetch error') };
  } finally {
    clearTimeout(t);
  }
}

async function warmWithRetry(slug) {
  let attempt = 0, last = null;
  while (attempt <= MAX_RETRIES) {
    last = await warmOnce(slug);
    if (last.ok) return { ...last, attempts: attempt + 1 };
    attempt++;
    if (attempt <= MAX_RETRIES) {
      const backoff = RETRY_BASE_MS * Math.pow(2, attempt - 1) + Math.floor(Math.random() * 100);
      await sleep(backoff);
    }
  }
  return { ...(last || {}), attempts: attempt };
}

// Concurrency pool
async function runPool(items, worker, concurrency) {
  const results = new Array(items.length);
  let idx = 0, done = 0;

  async function one() {
    while (true) {
      const i = idx++;
      if (i >= items.length) return;
      const r = await worker(items[i]);
      results[i] = r;
      done++;
      if (done % PROGRESS_EVERY === 0) console.log(`Progress: ${done}/${items.length}`);
    }
  }

  const n = Math.min(concurrency, items.length);
  await Promise.all(Array.from({ length: n }, () => one()));
  return results;
}

// ----- Main -----
(async function main() {
  console.log(`Warming with concurrency=${CONCURRENCY}, maxRetries=${MAX_RETRIES}, timeout=${REQUEST_TIMEOUT_MS}ms`);
  console.log(`BASE=${BASE}\nWP=${WP}\nAuth=${BASIC_AUTH ? 'Basic (set)' : 'none'}`);

  const slugs   = await listSlugs();
  const started = Date.now();

  const results = await runPool(slugs, async (slug) => {
    const r = await warmWithRetry(slug);
    return { slug, ok: r.ok, status: r.status, attempts: r.attempts, durationMs: r.durationMs, error: r.error || '' };
  }, CONCURRENCY);

  const ok  = results.filter(r => r.ok);
  const bad = results.filter(r => !r.ok);

  console.log(`\nDone in ${Date.now() - started} ms`);
  console.log(`  Success: ${ok.length}`);
  console.log(`  Failed : ${bad.length}`);

  await writeReports(results, bad);
  process.exit(bad.length ? 2 : 0);
})().catch(e => {
  console.error('Fatal:', e);
  process.exit(1);
});
