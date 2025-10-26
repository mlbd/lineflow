#!/usr/bin/env node
/**
 * scripts/warm-overlays.mjs
 *
 * Usage (simple):
 *   node ./scripts/warm-overlays.mjs --products=./data/criticalProducts.json
 *
 * The script accepts a JSON file containing an array of product objects (the same
 * shape your app uses). It will build Cloudinary transform URLs (base, color
 * variants and overlay variants) using the project's generator helpers and
 * perform GET requests to force Cloudinary to generate & CDN to cache them.
 *
 * This is a low-risk way to "warm" generated overlay images without needing
 * Cloudinary admin credentials.
 */

import fs from 'fs/promises';
import { fileURLToPath } from 'url';
import path from 'path';
import os from 'os';

// Import URL generators from the project. These functions only build URLs.
import {
  generateProductImageUrl,
  generateProductImageUrlWithOverlay,
} from '../src/utils/cloudinaryMockup.js';

const argv = process.argv.slice(2);
const opts = Object.fromEntries(
  argv.map(a => {
    const [k, v] = a.split('=');
    return [k.replace(/^--/, ''), v ?? true];
  })
);

function usage() {
  console.log('warm-overlays.mjs --products=path/to/products.json [--colors=3] [--concurrency=6]');
}

if (!opts.products) {
  usage();
  process.exit(1);
}

const PRODUCTS_PATH = path.resolve(process.cwd(), opts.products);
const COLORS_PER_PRODUCT = Number(opts.colors || process.env.PRELOAD_COLORS_PER_PRODUCT || 3);
const CONCURRENCY = Number(opts.concurrency || process.env.PRELOAD_CONCURRENCY || 6);
const MAX = Number(opts.max || process.env.PRELOAD_MAX_IMAGES || 1000);

async function readProducts(p) {
  const raw = await fs.readFile(p, 'utf8');
  return JSON.parse(raw);
}

async function warmUrls(urls) {
  const unique = Array.from(new Set(urls)).slice(0, MAX);
  console.log(`Warming ${unique.length} unique URLs with concurrency=${CONCURRENCY}`);

  let i = 0;
  const results = { ok: 0, fail: 0 };

  async function worker(batch) {
    await Promise.all(
      batch.map(async u => {
        try {
          const res = await fetch(u, { method: 'GET' });
          if (res.ok) {
            results.ok++;
          } else {
            results.fail++;
            console.warn('WARN preload failed', res.status, u);
          }
        } catch (e) {
          results.fail++;
          console.warn('ERR preload', e && e.message, u);
        }
      })
    );
  }

  while (i < unique.length) {
    const batch = unique.slice(i, i + CONCURRENCY);
    // small pause between batches to avoid bursts
    await worker(batch);
    i += CONCURRENCY;
    await new Promise(r => setTimeout(r, 120));
  }

  console.log('Warm complete', results);
}

(async () => {
  try {
    const products = await readProducts(PRODUCTS_PATH);
    console.log(`Loaded ${products.length} products from ${PRODUCTS_PATH}`);

    const urls = [];

    for (const p of products) {
      try {
        const base = generateProductImageUrl(p, {}, { max: 1400 });
        if (base) urls.push(base);
      } catch (e) {}

      const colors = Array.isArray(p?.acf?.color) ? p.acf.color : [];
      for (let i = 0; i < Math.min(colors.length, COLORS_PER_PRODUCT); i++) {
        try {
          const c = generateProductImageUrl(p, {}, { max: 1400, colorIndex: i });
          if (c) urls.push(c);
        } catch (e) {}
        try {
          const uo = generateProductImageUrlWithOverlay(p, {}, {
            max: 1400,
            colorIndex: i,
            pagePlacementMap: {},
            customBackAllowedSet: [],
          });
          if (uo) urls.push(uo);
        } catch (e) {}
      }

      try {
        const baseOverlay = generateProductImageUrlWithOverlay(p, {}, { max: 1400, pagePlacementMap: {}, customBackAllowedSet: [] });
        if (baseOverlay) urls.push(baseOverlay);
      } catch (e) {}
    }

    await warmUrls(urls);
  } catch (e) {
    console.error('warm-overlays failed:', e && e.message);
    process.exitCode = 2;
  }
})();
