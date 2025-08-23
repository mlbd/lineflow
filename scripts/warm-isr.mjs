#!/usr/bin/env node
/**
 * Warm ISR pages by visiting /{slug} with bounded concurrency.
 * - Retries with exponential backoff + jitter
 * - Per-request timeout
 * - Generates JSON + CSV report files
 *
 * Env:
 *   NEXT_PUBLIC_SITE_URL      e.g. https://placement-editor.vercel.app/
 *   NEXT_PUBLIC_WP_SITE_URL   e.g. http s://min.lukpaluk.xyz
 *   CONCURRENCY               default 8
 *   MAX_RETRIES               default 2  (total attempts = MAX_RETRIES + 1)
 *   RETRY_BASE_MS             default 500
 *   REQUEST_TIMEOUT_MS        default 20000
 *   PROGRESS_EVERY            default 50
 *   OUT_DIR                   default ./.warm-reports
 *
 * Optional args:
 *   --offset=NUMBER           start at index (useful for resuming)
 *   --limit=NUMBER            process only N slugs (testing)
 */

import fs from 'fs/promises';
import path from 'path';
import { wpApiFetch } from '@/lib/wpApi';

const BASE = process.env.NEXT_PUBLIC_SITE_URL;
const WP = process.env.NEXT_PUBLIC_WP_SITE_URL;

const CONCURRENCY = parseInt(process.env.CONCURRENCY || '8', 10);
const MAX_RETRIES = parseInt(process.env.MAX_RETRIES || '2', 10);
const RETRY_BASE_MS = parseInt(process.env.RETRY_BASE_MS || '500', 10);
const REQUEST_TIMEOUT_MS = parseInt(process.env.REQUEST_TIMEOUT_MS || '20000', 10);
const PROGRESS_EVERY = parseInt(process.env.PROGRESS_EVERY || '50', 10);
const OUT_DIR = process.env.OUT_DIR || path.resolve('.warm-reports');

if (!BASE || !WP) {
  console.error('ERROR: PUBLIC_BASE_URL and NEXT_PUBLIC_WP_SITE_URL must be set in env.');
  process.exit(1);
}

const argv = Object.fromEntries(
  process.argv.slice(2).map(s => {
    const [k, v] = s.replace(/^--/, '').split('=');
    return [k, v ?? 'true'];
  })
);
const OFFSET = parseInt(argv.offset || '0', 10);
const LIMIT = argv.limit != null ? parseInt(argv.limit, 10) : null;

// --------- small utils ----------
const sleep = ms => new Promise(r => setTimeout(r, ms));
const nowIso = () =>
  new Date().toISOString().replace(/[:-]/g, '').replace(/\..+/, '').replace('T', '-'); // YYYYMMDD-HHMMSS

async function ensureDir(p) {
  try {
    await fs.mkdir(p, { recursive: true });
  } catch {}
}

function csvEscape(s) {
  const str = String(s ?? '');
  return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
}

async function writeReports(all, failed) {
  await ensureDir(OUT_DIR);
  const stamp = nowIso();
  const jsonPath = path.join(OUT_DIR, `warm-${stamp}.json`);
  const csvPath = path.join(OUT_DIR, `warm-${stamp}.csv`);
  const failTxt = path.join(OUT_DIR, `warm-${stamp}-FAILED.txt`);

  await fs.writeFile(
    jsonPath,
    JSON.stringify({ generatedAt: new Date().toISOString(), results: all }, null, 2),
    'utf8'
  );

  const headers = ['slug', 'ok', 'status', 'attempts', 'durationMs', 'error'];
  const lines = [headers.join(',')].concat(
    all.map(r => headers.map(h => csvEscape(r[h])).join(','))
  );
  await fs.writeFile(csvPath, lines.join('\n'), 'utf8');

  if (failed.length) {
    await fs.writeFile(failTxt, failed.map(f => f.slug).join('\n') + '\n', 'utf8');
  }

  console.log(
    `\nReports written:\n  JSON: ${jsonPath}\n  CSV : ${csvPath}${failed.length ? `\n  FAIL: ${failTxt}` : ''}`
  );
}

/**
 * Fetches a JSON response with a timeout.
 * @param {string} url
 * @param {number} [timeoutMs=REQUEST_TIMEOUT_MS]
 * @returns {Promise<unknown>}
 * @throws {Error} if the response is not 200 OK
 */
async function fetchJsonWithTimeout(url, timeoutMs = REQUEST_TIMEOUT_MS) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await wpApiFetch(url, { signal: ctrl.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(t);
  }
}

async function listSlugs() {
  const data = await fetchJsonWithTimeout(`company-slugs`);
  const slugs = Array.isArray(data?.slugs) ? data.slugs.map(String) : [];
  const sliced = slugs.slice(OFFSET, LIMIT != null ? OFFSET + LIMIT : undefined);
  console.log(
    `Loaded ${slugs.length} total slugs from WP; processing ${sliced.length} (offset=${OFFSET}${LIMIT != null ? `, limit=${LIMIT}` : ''}).`
  );
  return sliced;
}

async function warmOnce(slug) {
  const url = `${BASE}/${encodeURIComponent(slug)}`;
  const start = Date.now();
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), REQUEST_TIMEOUT_MS);

  try {
    const res = await fetch(url, { redirect: 'manual', signal: ctrl.signal });
    const ok = [200, 301, 302, 304].includes(res.status);
    return {
      ok,
      status: res.status,
      durationMs: Date.now() - start,
      error: ok ? '' : `Bad status ${res.status}`,
    };
  } catch (e) {
    return {
      ok: false,
      status: 0,
      durationMs: Date.now() - start,
      error:
        e.name === 'AbortError' ? `Timeout ${REQUEST_TIMEOUT_MS}ms` : e?.message || 'Fetch error',
    };
  } finally {
    clearTimeout(t);
  }
}

async function warmWithRetry(slug) {
  let attempt = 0;
  let last = null;
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

// Simple concurrency pool without external deps
async function runPool(items, worker, concurrency) {
  const results = new Array(items.length);
  let idx = 0;
  let done = 0;

  async function one(workerId) {
    while (true) {
      const i = idx++;
      if (i >= items.length) return;
      const item = items[i];
      const r = await worker(item);
      results[i] = r;
      done++;
      if (done % PROGRESS_EVERY === 0) {
        console.log(`Progress: ${done}/${items.length}`);
      }
    }
  }

  const runners = Array.from({ length: Math.min(concurrency, items.length) }, (_, k) => one(k));
  await Promise.all(runners);
  return results;
}

(async function main() {
  console.log(
    `Warming with concurrency=${CONCURRENCY}, maxRetries=${MAX_RETRIES}, timeout=${REQUEST_TIMEOUT_MS}ms`
  );
  console.log(`BASE=${BASE}\nWP=${WP}`);

  const slugs = await listSlugs();
  const startAll = Date.now();

  const results = await runPool(
    slugs,
    async slug => {
      const r = await warmWithRetry(slug);
      return {
        slug,
        ok: r.ok,
        status: r.status,
        attempts: r.attempts,
        durationMs: r.durationMs,
        error: r.error || '',
      };
    },
    CONCURRENCY
  );

  const ok = results.filter(r => r.ok);
  const bad = results.filter(r => !r.ok);

  console.log(`\nDone in ${Date.now() - startAll} ms`);
  console.log(`  Success: ${ok.length}`);
  console.log(`  Failed : ${bad.length}`);

  await writeReports(results, bad);

  // Exit code: non-zero if there were failures (useful in CI)
  process.exit(bad.length ? 2 : 0);
})().catch(e => {
  console.error('Fatal:', e);
  process.exit(1);
});
