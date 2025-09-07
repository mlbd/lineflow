// src/lib/wpApi.js
const WP_URL = process.env.WP_SITE_URL;
const isBrowser = typeof window !== 'undefined';

/**
 * Wrapper for WP REST API requests.
 * On server: calls WP directly with Basic Auth (env secrets) via X-Authorization header.
 * On client: calls our Next.js API proxy to avoid exposing secrets.
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

  // If caller accidentally set "Authorization", move it to "X-Authorization"
  if (headers.Authorization) {
    headers['X-Authorization'] = headers.Authorization;
    delete headers.Authorization;
  }

  // Server-side only: attach Basic Auth via X-Authorization
  if (!isBrowser && process.env.WP_API_USER && process.env.WP_API_PASS) {
    const token = Buffer.from(
      `${process.env.WP_API_USER}:${process.env.WP_API_PASS}`
    ).toString('base64');
    headers['X-Authorization'] = `Basic ${token}`;
  }

  // Do NOT log secrets. Keep logs minimal if needed.
  // console.log('[wpApiFetch]', { url, isBrowser });

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
