// pages/[slug].jsx
import { GoogleTagManager } from '@next/third-parties/google';
import Head from 'next/head';
import { useEffect, useRef, useState } from 'react';

import Footer from '@/components/common/Footer';
import HeroSection from '@/components/page/HeroSection';
import InfoBoxSection from '@/components/page/InfoBoxSection';
import ProductsShell from '@/components/page/ProductsShell';
import TopBar from '@/components/page/TopBar';

import CompletionDialog from '@/components/catalog/CompletionDialog';

import { getProductCardsBatch } from '@/lib/productCache'; // server-side helper
import { getOrFetchShipping } from '@/lib/shippingCache';
import { wpApiFetch } from '@/lib/wpApi';

import { generateProductImageUrlWithOverlay } from '@/utils/cloudinaryMockup';

// near top of the file
function hasLocalFlag(key) {
  try { return localStorage.getItem(key) !== null; } catch { return false; }
}
function setLocalFlag(key, ttlMs = 7 * 24 * 60 * 60 * 1000) { // 7 days
  try {
    const payload = { t: Date.now(), exp: Date.now() + ttlMs };
    localStorage.setItem(key, JSON.stringify(payload));
  } catch {}
}
function isLocalFlagValid(key) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return false;
    const obj = JSON.parse(raw);
    if (!obj || typeof obj.exp !== 'number') return false;
    if (Date.now() > obj.exp) { localStorage.removeItem(key); return false; }
    return true;
  } catch { return false; }
}

/* -----------------------------------------------------------
 * SSG: paths & props (keep ISR to avoid cold user waits)
 * --------------------------------------------------------- */
export async function getStaticPaths() {
  return { paths: [], fallback: 'blocking' };
}

export async function getStaticProps({ params }) {
  try {
    // 1) Company page data
    const res = await wpApiFetch(`company-page?slug=${params.slug}`);
    if (!res.ok) {
      // Try to read body as text for debugging
      let bodyPreview = '';
      try {
        bodyPreview = await res.text();
      } catch (e) {
        bodyPreview = '[no body text available]';
      }
      console.error('[getStaticProps] company-page fetch failed', {
        slug: params.slug,
        status: res.status,
        url: res.url,
        headers: Object.fromEntries(res.headers.entries?.() || []),
        bodyPreview: bodyPreview.slice(0, 300), // cap length
      });
      throw new Error(`company-page fetch failed ${res.status}`);
    }
    const data = await res.json();

    const status = data?.status || null;

    // 2) Normalize product IDs (avoid serializing huge arrays into Next data)
    const productIdsRaw = data?.acf?.selected_products || [];
    const productIds = productIdsRaw
      .map(p => (p && typeof p === 'object' ? p.id : p))
      .filter(Boolean)
      .map(id => Number(id))
      .filter(id => Number.isFinite(id));

    // 3) SSR only first N products so users see products on first paint
    const CRITICAL_COUNT = 12;
    const criticalIds = productIds.slice(0, CRITICAL_COUNT);
    let criticalProducts = [];
    if (criticalIds.length) {
      try {
        criticalProducts = await getProductCardsBatch(criticalIds, {
          ttlSeconds: 60 * 60 * 6,
          staleSeconds: 60 * 60 * 24,
        });
      } catch (e) {
        console.warn('[slug].jsx getProductCardsBatch error:', e);
        criticalProducts = [];
      }
    }

    // 4) Shipping (cached server-side)
    const cacheKey = `company:${data?.id || 'na'}|country:IL`;
    const shippingOptions = await getOrFetchShipping(
      cacheKey,
      async () => {
        const shippingRes = await wpApiFetch(`shipping`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ country: 'IL', postcode: '', cart: [] }),
        });
        if (!shippingRes.ok) return [];
        const json = await shippingRes.json();
        return Array.isArray(json.shipping) ? json.shipping : [];
      },
      { ttlSeconds: 21600, staleSeconds: 86400 } // 6h fresh, 24h stale-ok
    );

    // 5) Small derived objects only (keep page-data tiny)
    const companyLogos = {
      logo_darker: data?.acf?.logo_darker || null,
      logo_lighter: data?.acf?.logo_lighter || null,
      back_darker: data?.acf?.back_darker || null,
      back_lighter: data?.acf?.back_lighter || null,
    };

    const pagePlacementMap = data?.meta?.placement_coordinates || {};
    const customBackAllowedSet = (data?.acf?.custom_logo_products || []).map(String);

    // [PATCH] Build a deduped list of DIRECT Cloudinary URLs we’ll pre-cache via Service Worker
    const buildManifest = (products) => {
      const set = new Set();
      for (const p of products || []) {
        // base (no color index)
        try {
          const base = generateProductImageUrlWithOverlay(p, companyLogos, {
            max: 1500,
            pagePlacementMap,
            customBackAllowedSet,
          });
          if (base) set.add(base);
        } catch {}
        // all color variants from ACF
        const colors = Array.isArray(p?.acf?.color) ? p.acf.color : [];
        for (let i = 0; i < colors.length; i++) {
          try {
            const u = generateProductImageUrlWithOverlay(p, companyLogos, {
              max: 1500,
              colorIndex: i,
              pagePlacementMap,
              customBackAllowedSet,
            });
            if (u) set.add(u);
          } catch {}
        }
      }
      return Array.from(set);
    };

    const criticalManifest = buildManifest(criticalProducts);

    // We don’t fetch “rest” products fully on the server for paint speed, but we *do* want their URLs.
    // Fetch minimal cards for the rest just to build URLs.
    let restManifest = [];
    const restIds = productIds.slice(CRITICAL_COUNT);
    if (restIds.length) {
      try {
        const restProducts = await getProductCardsBatch(restIds, {
          ttlSeconds: 60 * 60 * 6,
          staleSeconds: 60 * 60 * 24,
        });
        restManifest = buildManifest(restProducts);
      } catch (e) {
        console.warn('[slug].jsx rest getProductCardsBatch error:', e);
      }
    }

    // Version string so we only warm “rest” once per catalog change
    const updatedAt = data?.modified || data?.date || '';
    const restWarmVersion = `${productIds.join('_')}|${updatedAt}`;

    // ---- Build props so we can measure page-data size before returning ----
    const props = {
      slug: params.slug,
      status,
      pageId: data?.id || null,
      productIds, // All IDs (client will fetch the full list)
      criticalProducts, // First N full products (SSR)
      cacheBust: Date.now(), // [PATCH] Added: cache-buster that updates on every ISR rebuild / revalidate call
      bumpPrice: data?.acf?.bump_price || null,
      companyData: {
        name: data?.acf?.user_header_title || data?.title || '',
        description: data?.acf?.user_header_content || '',
        logo: data?.acf?.logo_darker?.url || null,
      },
      companyLogos,
      seo: {
        title: data?.acf?.user_header_title || data?.title || '',
        description: data?.acf?.user_header_content || '',
        image: data?.acf?.logo_darker?.url || null,
      },
      acf: data?.acf || [],
      meta: data?.meta || [],
      shippingOptions,
      pagePlacementMap,
      customBackAllowedSet,
      // [PATCH] SW prefetch manifests
      criticalManifest,
      restManifest,
      restWarmVersion
    };

    // ---- SERVER SIZE LOG (uncompressed JSON that Next will serialize) ----
    try {
      const json = JSON.stringify(props);
      const bytes = Buffer.byteLength(json, 'utf8');
      const kb = bytes / 1024;
      const thresholdKB = 128;
      const status = kb > thresholdKB ? '⚠️ EXCEEDS' : '✅ OK';
      console.log(
        `[PageData] /${params.slug} props size ≈ ${kb.toFixed(
          1
        )} KB (${bytes} bytes) → ${status} ${thresholdKB} KB threshold`
      );
    } catch (e) {
      console.warn('[PageData] size check failed:', e);
    }

    // No server-side image preloads — rely on Next.js Image and browser caching.

    return { props, revalidate: 60 };
  } catch (error) {
    console.error('getStaticProps error for slug', params.slug, error);
    return {
      props: {
        slug: params.slug,
        error: true,
        seo: {
          title: 'Page Not Found',
          description: 'The page could not be found.',
          image: null,
        },
      },
      revalidate: 60,
    };
  }
}

/* -----------------------------------------------------------
 * Page Component (+ CLIENT SIZE LOG)
 * --------------------------------------------------------- */
export default function LandingPage({
  slug,
  pageId,
  status,
  productIds = [],
  criticalProducts = [],
  // [PATCH] Manifests for SW Cache API
  criticalManifest = [],
  restManifest = [],
  cacheBust = 0,
  bumpPrice = null,
  companyData = {},
  seo = {},
  meta = [],
  acf = [],
  error = false,
  shippingOptions = [],
  companyLogos = [],
  pagePlacementMap = {},
  customBackAllowedSet = {},
  restWarmVersion = 'v1'
}) {
  const [animationDone, setAnimationDone] = useState(false);
  const cartSectionRef = useRef(null);

  const [completed, setCompleted] = useState(false);
  const [completionDialogOpen, setCompletionDialogOpen] = useState(false);

  const handleScrollToCart = () => {
    if (cartSectionRef.current) {
      cartSectionRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  console.log('[Page] ---------------ACF---------------:', acf);

  // ---- CLIENT SIZE LOG (transfer/encoded/decoded) ----
  useEffect(() => {
    if (process.env.NEXT_PUBLIC_LOG_PAGE_DATA !== '1') return;
    if (typeof window === 'undefined' || !window.__NEXT_DATA__) return;

    try {
      const d = window.__NEXT_DATA__;
      const buildId = d.buildId;
      const locale = d.locale ? `/${d.locale}` : '';
      const path = location.pathname.replace(/^\/|\/$/g, '') || 'index';
      const url = `/_next/data/${buildId}${locale}/${path}.json`;

      setTimeout(() => {
        const entries = performance.getEntriesByName(url);
        const last = entries[entries.length - 1];

        if (last && 'transferSize' in last) {
          const t = (last.transferSize / 1024).toFixed(1);
          const enc = (last.encodedBodySize / 1024).toFixed(1);
          const dec = (last.decodedBodySize / 1024).toFixed(1);
          console.log(
            `[PageData] (client) ${path}.json → transfer ~${t} KB, encoded ~${enc} KB, decoded ~${dec} KB`
          );
        } else {
          // Fallback: fetch and measure decoded size; also try Content-Length header
          fetch(url, { cache: 'no-cache' })
            .then(async res => {
              const cl = res.headers.get('content-length');
              const text = await res.text();
              const decodedBytes =
                typeof TextEncoder !== 'undefined'
                  ? new TextEncoder().encode(text).length
                  : text.length;
              const decKB = (decodedBytes / 1024).toFixed(1);

              if (cl) {
                console.log(
                  `[PageData] (client) ${path}.json → content-length ${(Number(cl) / 1024).toFixed(
                    1
                  )} KB; decoded ~${decKB} KB`
                );
              } else {
                console.log(`[PageData] (client) ${path}.json → decoded ~${decKB} KB`);
              }
            })
            .catch(() => {});
        }
      }, 0);
    } catch (e) {
      console.warn('[PageData] (client) log failed:', e);
    }
  }, [slug]);

  useEffect(() => {
    if (status !== 'pending' || completed || completionDialogOpen) return;
    if (typeof document === 'undefined') return;

    const handlePointerDown = event => {
      try {
        // Only open the completion dialog when the user clicked inside the product grid
        // (elements rendered by ProductSectionWithAction). This lets header, filters,
        // load-more and other interactive areas behave normally.
        const inProducts = event?.target?.closest && event.target.closest('[data-catalog-products]');
        if (!inProducts) return; // ignore clicks outside the product list area

        // stop the interaction and open the modal
        event.preventDefault();
        event.stopPropagation();
        if (typeof event.stopImmediatePropagation === 'function') {
          event.stopImmediatePropagation();
        }
        setCompletionDialogOpen(true);
      } catch (e) {
        // If anything goes wrong, don't break the page — default to opening the dialog
        setCompletionDialogOpen(true);
      }
    };

    document.addEventListener('pointerdown', handlePointerDown, true);

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown, true);
    };
  }, [status, completed, completionDialogOpen]);

  useEffect(() => {
    if (status !== 'pending' || completed) {
      setCompletionDialogOpen(false);
    }
  }, [status, completed]);

  useEffect(() => {
    // [PATCH] Use SW Cache API to store REST URLs once per catalog version
    const key = `rest-prefetch:${slug}:${restWarmVersion}`;
    if (isLocalFlagValid(key)) return;

    const run = () => {
      if (!navigator.serviceWorker?.controller || !restManifest?.length) return;
      const label = 'rest:' + String(slug || '') + ':' + String(restWarmVersion || '');
      const ch = new MessageChannel();
      const ack = new Promise(resolve => {
        const t = setTimeout(() => resolve({ timeout: true }), 3000);
        ch.port1.onmessage = (e) => { clearTimeout(t); resolve(e.data || {}); };
      });
      navigator.serviceWorker.controller.postMessage({ type:'CATALOG_PREFETCH', urls: restManifest, label }, [ch.port2]);
      ack.then((msg) => {
        console.log('[SW] rest prefetch ack', label, msg);
        setLocalFlag(key, 7 * 24 * 60 * 60 * 1000);
      });
    };

    const id = setTimeout(run, 200); // small delay so main content paints first
    return () => clearTimeout(id);
  }, [slug, restWarmVersion, restManifest]);

  // if (!animationDone) return <CircleReveal onFinish={() => setAnimationDone(true)} />;

  if (error) {
    return (
      <>
        <Head>
          <title>{seo.title || 'Error'}</title>
          <meta name="description" content={seo.description || 'Page error'} />
          <meta name="robots" content="noindex, nofollow" />
        </Head>
        <div className="min-h-screen flex items-center justify-center">
          <p className="text-red-600 text-xl">Page not found or failed to load.</p>
        </div>
      </>
    );
  }

  

  return (
    <>
      <Head>
        <title>{seo.title}</title>
        <meta name="description" content={seo.description} />
  
        <meta property="og:title" content={seo.title} />
        <meta property="og:description" content={seo.description} />
        {seo.image && <meta property="og:image" content={seo.image} />}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={seo.title} />
        <meta name="twitter:description" content={seo.description} />
        {seo.image && <meta name="twitter:image" content={seo.image} />}
        <meta name="viewport" content="width=device-width, initial-scale=1" />

        {/* [PATCH] Early: ensure SW is registered and cache CRITICAL URLs before user interaction */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function(){
                try {
                  if (!('serviceWorker' in navigator)) return;
                  var urls = ${JSON.stringify(criticalManifest)};
                  if (!urls || !urls.length) return;

                  function sendToSW() {
                    if (!navigator.serviceWorker.controller) { setTimeout(sendToSW, 50); return; }
                    var label = 'critical:${slug}';
                    var ch = new MessageChannel();
                    var timer = setTimeout(function(){}, 800);
                    ch.port1.onmessage = function(e){ clearTimeout(timer); console.log('[SW] critical prefetch ack', e.data); };
                    navigator.serviceWorker.controller.postMessage({type:'CATALOG_PREFETCH', urls: urls, label: label}, [ch.port2]);
                  }

                  if (!navigator.serviceWorker.controller) {
                    navigator.serviceWorker.register('/sw-catalog-prefetch.js').then(sendToSW).catch(sendToSW);
                  } else {
                    sendToSW();
                  }
                } catch (e) { /* silent */ }
              })();`,
          }}
        />

      </Head>

      <GoogleTagManager gtmId={process.env.NEXT_PUBLIC_GTM_ID} />

      <div className="min-h-screen bg-gradient-to-b from-[#f7f7f7] to-[#fff] flex flex-col">
        <TopBar onCartClick={handleScrollToCart} />
        <main className="alrndr-hero">
          <HeroSection company={companyData} />
          <InfoBoxSection />

          {/* SSR N products; hydrate full list once client-side */}
          <ProductsShell
            slug={slug}
            productIds={productIds}
            cacheBust={cacheBust}
            criticalProducts={criticalProducts}
            bumpPrice={bumpPrice}
            companyLogos={companyLogos}
            pagePlacementMap={pagePlacementMap}
            customBackAllowedSet={customBackAllowedSet}
            shippingOptions={shippingOptions}
            acf={acf}
            companyData={companyData}
            cartSectionRef={cartSectionRef}
          />

          <Footer />
        </main>
      </div>

      {status === 'pending' && !completed && completionDialogOpen && (
        <CompletionDialog
          slug={slug}
          pageId={pageId}
          onSuccess={() => {
            setCompletionDialogOpen(false);
            setCompleted(true);
          }}
          catalogDomain={process.env.NEXT_PUBLIC_CATALOG_DOMAIN || 'catalog.lineflow.ai'}
          onDismiss={() => setCompletionDialogOpen(false)}
        />
      )}
    </>
  );
}
