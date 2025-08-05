// lib/shippingCache.js
import fs from 'fs';
import path from 'path';

const cacheFile = path.resolve('.next/shipping-cache.json');

export function readShippingCache() {
  if (fs.existsSync(cacheFile)) {
    try {
      return JSON.parse(fs.readFileSync(cacheFile, 'utf8'));
    } catch (e) {
      return null;
    }
  }
  return null;
}

export function writeShippingCache(data) {
  fs.writeFileSync(cacheFile, JSON.stringify(data), 'utf8');
}
