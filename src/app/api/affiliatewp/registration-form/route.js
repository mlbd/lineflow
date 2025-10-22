import { affiliateWpRegistrationPage, fetchAffiliateRegistrationForm } from '@/lib/affiliatewp';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  const { html, action, error } = await fetchAffiliateRegistrationForm();
  const status = html ? 200 : 503;

  return NextResponse.json(
    { html, error, pageUrl: affiliateWpRegistrationPage, formAction: action },
    {
      status,
      headers: {
        'cache-control': 'no-store, no-cache, must-revalidate',
        'access-control-allow-origin': '*',
      },
    }
  );
}

function formDataToSearchParams(formData) {
  const params = new URLSearchParams();

  for (const [key, value] of formData.entries()) {
    if (typeof value === 'string') {
      params.append(key, value);
      continue;
    }

    throw new Error('File uploads are not supported for Affiliate registration.');
  }

  return params;
}

function extractNoticeMessage(html, type) {
  if (!html) return null;
  const pattern =
    type === 'success'
      ? /<div[^>]*class=("|')[^"']*affwp-(?:notice)[^"']*success[^"']*("|')[^>]*>([\s\S]*?)<\/div>/i
      : /<div[^>]*class=("|')[^"']*affwp-(?:errors|notice)[^"']*(?:error|warning)[^"']*("|')[^>]*>([\s\S]*?)<\/div>/i;

  const match = html.match(pattern);
  if (!match || !match[3]) return null;

  return match[3]
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function inferSuccess(html, responseUrl) {
  if (!html && !responseUrl) return false;

  const targetUrl = responseUrl
    ? (() => {
        try {
          return new URL(responseUrl);
        } catch (err) {
          return null;
        }
      })()
    : null;

  if (targetUrl) {
    const params = targetUrl.searchParams;
    const normalizedSuccess = value => (value ?? '').toLowerCase();

    const affwpRegistration = normalizedSuccess(params.get('affwp_registration'));
    if (affwpRegistration === 'success' || affwpRegistration === 'pending') {
      return true;
    }

    const affwpSuccess = normalizedSuccess(params.get('affwp_success'));
    if (['1', 'true', 'success', 'pending'].includes(affwpSuccess)) {
      return true;
    }

    const affwpNotice = normalizedSuccess(params.get('affwp_notice'));
    if (
      ['affiliate_registration', 'registration_pending', 'pending_approval'].includes(affwpNotice)
    ) {
      return true;
    }

    const noticeType = normalizedSuccess(params.get('notice'));
    if (
      ['affiliate_registration', 'registration_pending', 'pending_approval'].includes(noticeType)
    ) {
      return true;
    }
  }

  if (/affwp-registration=success/i.test(responseUrl ?? '')) {
    return true;
  }

  if (/affwp-registration=pending/i.test(responseUrl ?? '')) {
    return true;
  }

  if (/affwp-success=1/i.test(responseUrl ?? '')) {
    return true;
  }

  if (/You are already registered as an affiliate/i.test(html ?? '')) {
    return true;
  }

  return (
    /affwp-(?:notice)[^<]*success/i.test(html ?? '') ||
    /affiliate (?:application|registration) (?:has been submitted|is pending|received)/i.test(
      html ?? ''
    ) ||
    /application (?:received|submitted) successfully/i.test(html ?? '')
  );
}

export async function POST(request) {
  try {
    const formData = await request.formData();
    const formAction = formData.get('__form_action') ?? affiliateWpRegistrationPage;

    if (!formAction) {
      return NextResponse.json(
        {
          success: false,
          message:
            'We could not determine where to send your registration. Please refresh and try again.',
        },
        { status: 400 }
      );
    }

    formData.delete('__form_action');

    const body = formDataToSearchParams(formData);

    const response = await fetch(formAction, {
      method: 'POST',
      redirect: 'follow',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      body: body.toString(),
    });

    const html = await response.text();
    const success = inferSuccess(html, response.url);
    const message = success
      ? (extractNoticeMessage(html, 'success') ??
        'Thanks! Your affiliate application has been received. We will be in touch shortly.')
      : (extractNoticeMessage(html, 'error') ??
        'We could not submit your affiliate application. Please verify the details and try again.');

    return NextResponse.json(
      {
        success,
        message,
        redirect: response.url,
      },
      { status: success ? 200 : 422 }
    );
  } catch (error) {
    console.error('AffiliateWP registration submission failed:', error);
    return NextResponse.json(
      {
        success: false,
        message: 'Something went wrong while submitting your application. Please try again later.',
      },
      { status: 500 }
    );
  }
}
