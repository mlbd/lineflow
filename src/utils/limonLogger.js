/**
 * /src/utils/limonLogger.js
 *
 * Lightweight namespaced logger for browser + Node/SSR.
 * Features:
 *  - Global level control (silent|error|warn|info|debug)
 *  - Per-namespace includes/excludes with wildcards (e.g., "Cart*,AddToCart*,-CartShimmer")
 *  - Safe defaults: production = silent; development = debug but NO namespaces enabled by default
 *  - LocalStorage + URL query overrides (limon_level, limon_ns)
 *  - Quick drop-in: limon_log('Namespace', 'message', data)
 *  - File transport (optional): send selected logs to API (/api/limon-log) → server writes to disk
 *    Controls via limon_file (on/off), limon_file_ns (patterns), limon_file_api (endpoint)
 *
 * This version intentionally avoids all NEXT_PUBLIC_* envs.
 *
 * ENV (server-only, optional):
 *  - LIMON_LEVEL: one of silent|error|warn|info|debug
 *  - LIMON_NS: e.g. "CartItem,AddToCart*,-CartShimmer"
 *  - LIMON_FILE: "1"/"true" to enable file logging
 *  - LIMON_FILE_NS: namespaces for file logging
 *  - LIMON_LOG_API: API endpoint (absolute or relative, default /api/limon-log)
 *  - LIMON_LOG_TOKEN: token sent as x-limon-token for write authorization (prod)
 *  - SITE_URL: base URL used on server to make absolute requests (e.g., https://example.com)
 */

/* ----------------------------- Constants ------------------------------ */

const LEVELS = {
  silent: 99,
  error: 40,
  warn: 30,
  info: 20,
  debug: 10,
};

const IS_BROWSER = typeof window !== 'undefined';
const IS_PROD =
  (typeof process !== 'undefined' && process.env && process.env.NODE_ENV === 'production') || false;

/* --------------------------- Storage Helpers -------------------------- */

const LS_KEYS = {
  ns: 'limon:ns', // namespaces for console logging
  level: 'limon:level', // global level
};

const LS_KEYS_FILE = {
  on: 'limon:file', // "1" to enable file transport
  ns: 'limon:file_ns', // namespaces for file logging
};

function lsGet(key) {
  try {
    if (!IS_BROWSER || !window.localStorage) return undefined;
    const v = window.localStorage.getItem(key);
    return v == null ? undefined : v;
  } catch {
    return undefined;
  }
}
function lsSet(key, val) {
  try {
    if (!IS_BROWSER || !window.localStorage) return;
    window.localStorage.setItem(key, String(val));
  } catch {}
}

/* ----------------------------- Utilities ------------------------------ */

function readQSParam(name) {
  if (!IS_BROWSER) return undefined;
  try {
    const u = new URL(window.location.href);
    const v = u.searchParams.get(name);
    return v == null ? undefined : v;
  } catch {
    return undefined;
  }
}

function envGet(name) {
  try {
    if (typeof process !== 'undefined' && process.env) {
      return process.env[name];
    }
  } catch {}
  return undefined;
}

function boolFrom(v) {
  if (v == null) return false;
  const s = String(v).toLowerCase().trim();
  return s === '1' || s === 'true' || s === 'yes' || s === 'on';
}

/* ------------------------ Initial Console Config ---------------------- */

// [PATCH] uses only LIMON_LEVEL (no NEXT_PUBLIC*)
function getInitialLevel() {
  const qs = (readQSParam('limon_level') || '').toLowerCase();
  if (qs && Object.prototype.hasOwnProperty.call(LEVELS, qs)) {
    lsSet(LS_KEYS.level, qs);
    return qs;
  }
  const ls = (lsGet(LS_KEYS.level) || '').toLowerCase();
  if (ls && Object.prototype.hasOwnProperty.call(LEVELS, ls)) return ls;

  const env = (envGet('LIMON_LEVEL') || '').toLowerCase();
  if (env && Object.prototype.hasOwnProperty.call(LEVELS, env)) return env;

  return IS_PROD ? 'silent' : 'debug';
}

// [PATCH] uses only LIMON_NS (no NEXT_PUBLIC*)
function getInitialNamespaces() {
  const qs = readQSParam('limon_ns');
  if (qs != null) {
    lsSet(LS_KEYS.ns, qs);
    return qs;
  }
  const ls = lsGet(LS_KEYS.ns);
  if (ls != null) return ls;

  return envGet('LIMON_NS') || '';
}

/* --------------------------- Glob Matchers ---------------------------- */

function toRegexFromGlob(glob) {
  // Escape regex specials except '*', then replace '*' with '.*'
  const esc = glob.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*');
  return new RegExp('^' + esc + '$');
}

function compileMatcher(spec) {
  if (!spec || typeof spec !== 'string') {
    return { includes: [], excludes: [] };
  }
  const parts = spec
    .split(/[,\s]+/)
    .map(s => s.trim())
    .filter(Boolean);

  const includes = [];
  const excludes = [];

  for (const p of parts) {
    if (p.startsWith('-')) excludes.push(toRegexFromGlob(p.slice(1)));
    else includes.push(toRegexFromGlob(p));
  }
  return { includes, excludes };
}

function nsAllowed(ns, matcher) {
  const inInc = matcher.includes.length > 0 ? matcher.includes.some(r => r.test(ns)) : false;
  const inExc = matcher.excludes.some(r => r.test(ns));
  return inInc && !inExc;
}

/* ----------------------------- Color Helpers -------------------------- */

function hashColor(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h << 5) - h + s.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h);
}
function nsColorCss(ns) {
  const h = hashColor(ns) % 360;
  return `color: hsl(${h}, 70%, 45%); font-weight: 600;`;
}
const ANSI = {
  reset: '\x1b[0m',
  fg: n => `\x1b[38;5;${n}m`,
};
function nsColorAnsi(ns) {
  const n = (hashColor(ns) % 36) + 1; // 1..37
  return ANSI.fg(n);
}

function stamp() {
  try {
    return new Date().toISOString().split('T')[1].replace('Z', '');
  } catch {
    return '';
  }
}

/* ----------------------- Mutable Console State ------------------------ */

let CURRENT_LEVEL = getInitialLevel();
let CURRENT_NS_SPEC = getInitialNamespaces();
let MATCHER = compileMatcher(CURRENT_NS_SPEC);

/* --------------------- File Transport Initial State ------------------- */

// [PATCH] uses only LIMON_FILE, LIMON_FILE_NS, LIMON_LOG_API, LIMON_LOG_TOKEN
function getInitialFileEnabled() {
  const qs = readQSParam('limon_file');
  if (qs != null) {
    const v = boolFrom(qs);
    lsSet(LS_KEYS_FILE.on, v ? '1' : '0');
    return v;
  }
  const ls = lsGet(LS_KEYS_FILE.on);
  if (ls != null) return boolFrom(ls);

  const env = envGet('LIMON_FILE');
  return boolFrom(env);
}
function getInitialFileNamespaces() {
  const qs = readQSParam('limon_file_ns');
  if (qs != null) {
    lsSet(LS_KEYS_FILE.ns, qs);
    return qs;
  }
  const ls = lsGet(LS_KEYS_FILE.ns);
  if (ls != null) return ls;

  return envGet('LIMON_FILE_NS') || '';
}
function getInitialFileEndpoint() {
  // relative path is OK in browser; server will convert to absolute when needed
  return readQSParam('limon_file_api') || envGet('LIMON_LOG_API') || '/api/limon-log';
}
function getInitialFileToken() {
  return envGet('LIMON_LOG_TOKEN') || undefined;
}

let FILE_LOG = {
  enabled: getInitialFileEnabled(),
  endpoint: getInitialFileEndpoint(),
  token: getInitialFileToken(),
  namespaces: getInitialFileNamespaces(),
};
let FILE_MATCHER = compileMatcher(FILE_LOG.namespaces);

/* ------------------------- Public API (console) ----------------------- */

export function setLogLevel(level) {
  if (!Object.prototype.hasOwnProperty.call(LEVELS, level)) return;
  CURRENT_LEVEL = level;
  lsSet(LS_KEYS.level, level);
}

export function getLogLevel() {
  return CURRENT_LEVEL;
}

export function enable(namespaces) {
  if (typeof namespaces === 'string') {
    CURRENT_NS_SPEC = namespaces;
    MATCHER = compileMatcher(CURRENT_NS_SPEC);
    lsSet(LS_KEYS.ns, namespaces);
  }
}

export function getEnabled() {
  return CURRENT_NS_SPEC;
}

/* ------------------------- Public API (file) -------------------------- */

export function enableFileLog(namespaces) {
  FILE_LOG.enabled = true;
  lsSet(LS_KEYS_FILE.on, '1');
  if (typeof namespaces === 'string') {
    FILE_LOG.namespaces = namespaces;
    FILE_MATCHER = compileMatcher(FILE_LOG.namespaces);
    lsSet(LS_KEYS_FILE.ns, FILE_LOG.namespaces);
  }
}

export function disableFileLog() {
  FILE_LOG.enabled = false;
  lsSet(LS_KEYS_FILE.on, '0');
}

export function setFileLogNamespaces(namespaces) {
  FILE_LOG.namespaces = namespaces || '';
  FILE_MATCHER = compileMatcher(FILE_LOG.namespaces);
  lsSet(LS_KEYS_FILE.ns, FILE_LOG.namespaces);
}

export function setFileLogEndpoint(url) {
  if (url) FILE_LOG.endpoint = url;
}

export function setFileLogToken(token) {
  FILE_LOG.token = token || undefined;
}

/* ----------------------- Core Helper Functions ------------------------ */

function allowed(ns, level) {
  if (LEVELS[CURRENT_LEVEL] > LEVELS[level]) return false; // too low
  if (CURRENT_LEVEL === 'silent') return false;

  // If no includes configured, nothing shows (safe default).
  // To show all, explicitly set namespaces to "*".
  if (MATCHER.includes.length === 0 && !CURRENT_NS_SPEC.includes('*')) return false;

  return nsAllowed(ns, MATCHER);
}

function stringifyArgs(arr) {
  return arr
    .map(a => {
      try {
        if (typeof a === 'string') return a;
        return JSON.stringify(a);
      } catch {
        try {
          return String(a);
        } catch {
          return '[unprintable]';
        }
      }
    })
    .join(' ');
}

function resolveEndpointForRuntime(endpoint) {
  const isAbsolute = /^https?:\/\//i.test(endpoint || '');
  if (IS_BROWSER) {
    return isAbsolute ? endpoint : endpoint || '/api/limon-log';
  }
  // Server: needs absolute URL
  if (isAbsolute) return endpoint;
  const base = (envGet('SITE_URL') || 'http://localhost:3000').replace(/\/$/, '');
  return base + (endpoint?.startsWith('/') ? endpoint : `/${endpoint || 'api/limon-log'}`);
}

/* -------------------- File Transport (console hook) ------------------- */

// [PATCH] Build absolute URL on server; use only server token (if present)
async function sendToFile(ns, level, args) {
  if (!FILE_LOG.enabled) return;
  if (!nsAllowed(ns, FILE_MATCHER)) return;

  const payload = { ns, level, ts: new Date().toISOString(), args };

  // Browser: try Beacon first
  const endpoint = resolveEndpointForRuntime(FILE_LOG.endpoint || '/api/limon-log');

  if (
    IS_BROWSER &&
    typeof navigator !== 'undefined' &&
    typeof navigator.sendBeacon === 'function'
  ) {
    try {
      const blob = new Blob([JSON.stringify(payload)], { type: 'application/json' });
      navigator.sendBeacon(endpoint, blob);
      return;
    } catch {}
  }

  try {
    await fetch(endpoint, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(FILE_LOG.token ? { 'x-limon-token': FILE_LOG.token } : {}),
      },
      body: JSON.stringify(payload),
    });
  } catch {
    // swallow network errors
  }
}

/* ----------------------------- Logger Core ---------------------------- */

export function createLogger(namespace) {
  const base = (level, args) => {
    if (!allowed(namespace, level)) return;

    if (IS_BROWSER) {
      const prefix = `%c[${namespace}]%c ${stamp()}`;
      const style1 = nsColorCss(namespace);
      const style2 = 'color: inherit; font-weight: 400;';
      // eslint-disable-next-line no-console
      (console[level === 'debug' ? 'log' : level] || console.log)(prefix, style1, style2, ...args);
    } else {
      const color = nsColorAnsi(namespace);
      const prefix = `${color}[${namespace}]${ANSI.reset} ${stamp()} `;
      // eslint-disable-next-line no-console
      (console[level === 'debug' ? 'log' : level] || console.log)(prefix, ...args);
    }

    // Also send to file transport (if enabled & namespace allowed)
    void sendToFile(namespace, level, args);
  };

  return {
    debug: (...a) => base('debug', a),
    info: (...a) => base('info', a),
    warn: (...a) => base('warn', a),
    error: (...a) => base('error', a),
    log: (...a) => base('debug', a), // alias
  };
}

/**
 * Quick namespaced log. Replacement for console.log:
 *   limon_log('CartItem', 'qty updated', { qty });
 */
export function limon_log(namespace, ...args) {
  createLogger(namespace).debug(...args);
}

/**
 * Pretty-print any JS value (similar to PHP print_r).
 * - Objects/arrays → JSON with indentation
 * - Other values → String() fallback
 *
 * Example:
 *   limon_log('Cart', limon_pretty(orderData));
 */
export function limon_pretty(value) {
  try {
    if (typeof value === 'object' && value !== null) {
      return JSON.stringify(value, null, 2);
    }
    return String(value);
  } catch (e) {
    try {
      return String(value);
    } catch {
      return '[unprintable]';
    }
  }
}

/**
 * Force log to file (bypasses namespace/level checks).
 * Always writes to the API (default /api/limon-log).
 *
 * Example:
 *   limon_file_log('CartItem', 'this will always be in the file');
 *
 * Notes:
 *  - In production, your /api/limon-log route will require LIMON_LOG_TOKEN.
 *    Calls from server code (API routes, server actions) will include that token.
 *  - Client calls in prod will be rejected unless you intentionally expose a token (not recommended).
 */
// [PATCH] No NEXT_PUBLIC vars; builds absolute URL on server; token only from LIMON_LOG_TOKEN
export async function limon_file_log(namespace, ...args) {
  const payload = {
    ns: namespace,
    level: 'debug',
    ts: new Date().toISOString(),
    args,
  };

  // Endpoint resolution
  let endpoint = envGet('LIMON_LOG_API') || '/api/limon-log';
  endpoint = resolveEndpointForRuntime(endpoint);

  // Token only from server env (do not leak to client)
  const token = IS_BROWSER ? '' : envGet('LIMON_LOG_TOKEN') || '';

  try {
    const ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const t = ctrl ? setTimeout(() => ctrl.abort(), 8000) : null;

    await fetch(endpoint, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(token ? { 'x-limon-token': token } : {}),
      },
      body: JSON.stringify(payload),
      ...(ctrl ? { signal: ctrl.signal } : {}),
    });

    if (t) clearTimeout(t);
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error('Failed to write to file log', e);
  }
}

/* ------------------------- Window Debug Bridge ------------------------ */

if (IS_BROWSER) {
  try {
    window.limonDebug = Object.assign({}, window.limonDebug || {}, {
      // levels
      setLevel: setLogLevel,
      getLevel: getLogLevel,
      // namespaces
      enable, // set console namespaces
      getEnabled, // read console namespaces
      // file transport controls
      fileEnable: enableFileLog,
      fileDisable: disableFileLog,
      fileSetNamespaces: setFileLogNamespaces,
      fileSetEndpoint: setFileLogEndpoint,
      fileSetToken: setFileLogToken, // note: token on client is for dev only; prod writes require server token
    });
  } catch {}
}

/* -------------------------------- Usage --------------------------------
 * In a file:
 *   import { createLogger, limon_log, limon_file_log, limon_pretty } from '@/utils/limonLogger';
 *
 *   const log = createLogger('CartItem');
 *   log.debug('render', { qty, price });
 *   limon_log('AddToCartGroup', 'selected', selection);
 *
 * Pretty format:
 *   limon_log('Cart', limon_pretty(orderData));
 *   limon_file_log('Checkout', 'payload', limon_pretty(orderData));
 *
 * Enable console logs in browser:
 *   localStorage.setItem('limon:ns', 'CartItem'); location.reload();
 *   // or ?limon_ns=CartItem
 *
 * Enable multiple + exclude one:
 *   localStorage.setItem('limon:ns', 'Cart*,AddToCart*,-CartShimmer'); location.reload();
 *
 * Levels:
 *   localStorage.setItem('limon:level', 'info'); location.reload();
 *
 * File logging (selected namespaces via console logger):
 *   localStorage.setItem('limon:file', '1');
 *   localStorage.setItem('limon:file_ns', 'CartItem'); location.reload();
 *   // optional override endpoint (dev only): ?limon_file_api=/api/limon-log
 */
