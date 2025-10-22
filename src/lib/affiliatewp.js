const DEFAULT_REGISTRATION_PAGE =
  process.env.AFFILIATE_WP_REGISTRATION_PAGE ?? 'https://min.lukpaluk.xyz/affiliate-area/';

function extractRegistrationForm(html) {
  if (!html) return null;
  const match = html.match(/<form[^>]*id=("|')affwp-register-form\1[\s\S]*?<\/form>/i);
  return match ? match[0] : null;
}

export async function fetchAffiliateRegistrationForm({
  pageUrl = DEFAULT_REGISTRATION_PAGE,
  fetchOptions = {},
} = {}) {
  try {
    const { headers: overrideHeaders, ...restOptions } = fetchOptions;

    const response = await fetch(pageUrl, {
      next: { revalidate: 0 },
      cache: 'no-store',
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        ...overrideHeaders,
      },
      ...restOptions,
    });

    if (!response.ok) {
      console.error(
        'AffiliateWP registration form fetch failed with status %d: %s',
        response.status,
        response.statusText
      );
      return { html: null, error: 'Unable to load the Affiliate sign-up form right now.' };
    }

    const markup = await response.text();
    const form = extractRegistrationForm(markup);

    if (!form) {
      console.error('AffiliateWP registration form markup not found at %s', pageUrl);
      return {
        html: null,
        error:
          'We could not locate the AffiliateWP registration form. Please use the external sign-up link below.',
      };
    }

    return { html: form, error: null };
  } catch (error) {
    console.error('AffiliateWP registration form fetch encountered an error:', error);
    return {
      html: null,
      error: 'Something went wrong while loading the Affiliate sign-up form.',
    };
  }
}

export const affiliateWpRegistrationPage = DEFAULT_REGISTRATION_PAGE;
