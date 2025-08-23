const WP_URL = process.env.NEXT_PUBLIC_WP_SITE_URL;

/**
 * Wrapper for WP REST API requests
 * Returns a Response-like object so you can still use res.ok + res.json()
 */
export async function wpApiFetch(endpoint, options = {}) {
  const url = `${WP_URL}/wp-json/mini-sites/v1/${endpoint.replace(/^\//, '')}`;

  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };

  // Add Basic Auth if creds exist
  if (process.env.WP_API_USER && process.env.WP_API_PASS) {
    const token = Buffer.from(`${process.env.WP_API_USER}:${process.env.WP_API_PASS}`).toString(
      'base64'
    );
    headers['Authorization'] = `Basic ${token}`;
  }

  const res = await fetch(url, { ...options, headers });

  // Wrap Response to keep fetch-like usage
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
