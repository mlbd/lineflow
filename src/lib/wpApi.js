// src/lib/wpApi.js
const WP_URL = process.env.WP_SITE_URL;
const isBrowser = typeof window !== 'undefined';

/**
 * Wrapper for WP REST API requests.
 * On server: calls WP directly with Basic Auth (env secrets) via Authorization header.
 * On client: calls our Next.js API proxy to avoid exposing secrets.
 *
 * Supports both Basic Auth and X-Authorization headers.
 */
export async function wpApiFetch(endpoint, options = {}) {
  const ep = String(endpoint || '').replace(/^\//, '');

  // Build URL: server -> WP directly; client -> internal proxy
  const url = isBrowser
    ? `/api/wp/${ep}` // our proxy
    : `${WP_URL}/wp-json/mini-sites/v1/${ep}`;

  // Base headers
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };

  // --- Auth handling ---
  // 1) If caller set Authorization explicitly, keep it.
  // 2) If caller only set X-Authorization, keep that.
  // 3) If nothing provided and we’re on server, inject Basic Auth automatically.
  const hasAuth = !!headers.Authorization || !!headers['X-Authorization'];

  if (!hasAuth && !isBrowser && process.env.WP_API_USER && process.env.WP_API_PASS) {
    const token = Buffer.from(
      `${process.env.WP_API_USER}:${process.env.WP_API_PASS}`
    ).toString('base64');
    headers.Authorization = `Basic ${token}`;
  }

  const res = await fetch(url, { ...options, headers });

  // Wrap Response-like object so callers can use res.ok + res.json()
  return {
    ok: res.ok,
    status: res.status,
    headers: res.headers,
    url: res.url,
    async json() {
      try {
        return await res.json();
      } catch {
        return {};
      }
    },
    async text() {
      return await res.text();
    },
  };
}
