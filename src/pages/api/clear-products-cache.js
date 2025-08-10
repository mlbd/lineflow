import fs from 'fs';
import path from 'path';

const CACHE_FILE = path.resolve(process.cwd(), 'cacheClearedAt.txt');

// Helper: Read timestamp from file or return default
function readCacheClearedAt() {
  try {
    return fs.readFileSync(CACHE_FILE, 'utf-8');
  } catch (e) {
    return new Date().toISOString(); // fallback
  }
}

// Helper: Write timestamp to file
function writeCacheClearedAt(ts) {
  fs.writeFileSync(CACHE_FILE, ts, 'utf-8');
}

export default function handler(req, res) {
  if (req.method === 'POST') {
    const now = new Date().toISOString();
    writeCacheClearedAt(now);
    return res.status(200).json({ cacheClearedAt: now });
  }
  // GET: always return persisted value
  const ts = readCacheClearedAt();
  res.status(200).json({ cacheClearedAt: ts });
}
