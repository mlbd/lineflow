/**
 * /src/server/limonFileLogger.js
 *
 * Simple server-side file logger helper (no TypeScript).
 * Appends lines to a public log file like WordPress' debug.log.
 * - Default location: public/logs/limon-debug.log (publicly readable)
 * - Simple size-based rotation: keeps one backup (<file>.1)
 *
 * ENV (optional):
 *   LIMON_LOG_DIR        absolute/relative dir; default: <project>/public/logs
 *   LIMON_LOG_FILE       filename; default: limon-debug.log
 *   LIMON_LOG_MAX_MB     rotate threshold in MB; default: 5
 */

import fs from 'node:fs';
import path from 'node:path';

const LOG_DIR = process.env.LIMON_LOG_DIR || path.join(process.cwd(), 'public', 'logs');

const LOG_FILE = process.env.LIMON_LOG_FILE || 'limon-debug.log';

const MAX_MB = Math.max(1, Number(process.env.LIMON_LOG_MAX_MB || 5));
const MAX_BYTES = MAX_MB * 1024 * 1024;

/**
 * Ensures the log directory exists.
 */
async function ensureDir() {
  await fs.promises.mkdir(LOG_DIR, { recursive: true });
}

/**
 * Rotate the log if it exceeds MAX_BYTES.
 * Keeps a single backup: <file>.1
 */
async function rotateIfNeeded(filePath) {
  try {
    const stat = await fs.promises.stat(filePath);
    if (stat.size <= MAX_BYTES) return;

    const rotated = `${filePath}.1`;
    try {
      await fs.promises.rm(rotated);
    } catch {
      // ignore if it didn't exist
    }
    await fs.promises.rename(filePath, rotated);
  } catch {
    // file might not exist yet — that's fine
  }
}

/**
 * Append a single line to the log file.
 * Returns the public URL for the current log.
 *
 * @param {string} line - e.g. "2025-08-28T09:12:33.123Z [INFO] [CartItem] rendered\n"
 * @returns {Promise<string>} public URL to the log (e.g. "/logs/limon-debug.log")
 */
export async function appendLogLine(line) {
  await ensureDir();
  const filePath = path.join(LOG_DIR, LOG_FILE);
  await rotateIfNeeded(filePath);
  await fs.promises.appendFile(filePath, line, 'utf8');
  return '/logs/' + LOG_FILE;
}

/**
 * Helpers to inspect paths/URLs if you need them elsewhere.
 */
export function getLogFilePath() {
  return path.join(LOG_DIR, LOG_FILE);
}

export function getPublicLogUrl() {
  return '/logs/' + LOG_FILE;
}
