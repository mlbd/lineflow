// src/lib/wpAuth.js
let accessToken = null;
let tokenExpiry = 0;

const WP_URL = process.env.WP_SITE_URL;
const WP_USER = process.env.WP_API_USER;
const WP_PASS = process.env.WP_API_PASS;

async function fetchNewToken() {
  const res = await fetch(`${WP_URL}/wp-json/jwt-auth/v1/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      username: WP_USER,
      password: WP_PASS,
    }),
  });
  if (!res.ok) throw new Error(`JWT token request failed ${res.status}`);
  const json = await res.json();
  console.log('fetchNewToken', json);
  accessToken = json?.token || null;
  tokenExpiry = Date.now() + 55 * 60 * 1000; // WP JWT default = 1h, refresh slightly earlier
  return accessToken;
}

export async function getJwtToken() {
  if (!accessToken || Date.now() >= tokenExpiry) {
    return await fetchNewToken();
  }

  console.log('getJwtToken: using cached token',accessToken);
  return accessToken;
}
