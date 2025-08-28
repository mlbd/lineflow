// pages/[slug].jsx
import Head from 'next/head';
import { useState, useRef, useEffect } from 'react';
import { GoogleTagManager } from '@next/third-parties/google';

import CircleReveal from '@/components/CircleReveal';
import TopBar from '@/components/page/TopBar';
import HeroSection from '@/components/page/HeroSection';
import InfoBoxSection from '@/components/page/InfoBoxSection';
import ProductListSection from '@/components/page/ProductListSection';
import CartPage from '@/components/cart/CartPage';
import Footer from '@/components/page/Footer';

import { getOrFetchShipping } from '@/lib/shippingCache';
import { wpApiFetch } from '@/lib/wpApi';
import { getProductCardsBatch } from '@/lib/productCache'; // ⬅️ NEW

const WP_URL = process.env.NEXT_PUBLIC_WP_SITE_URL;

/* ---------------------- SSG: paths & props --------------------- */
export async function getStaticPaths() {
  // Keep ISR; warm later so users don't wait.
  return { paths: [], fallback: 'blocking' };
}

export async function getStaticProps({ params }) {
  try {
    console.log('⏳ Fetching company page data for slug:', WP_URL, params.slug);

    const res = await wpApiFetch(`company-page?slug=${params.slug}`);
    if (!res.ok) throw new Error('Failed to fetch company data');

    const data = await res.json();
    console.log('✅ Company data response:', data);

    const bumpPrice = data.acf?.bump_price || null;
    const productIdsRaw = data.acf?.selected_products || [];

    console.log('🧩 Raw selected_products from ACF:', productIdsRaw);

    // Normalize to IDs
    const productIds = productIdsRaw
      .map(p => (p && typeof p === 'object' ? p.id : p))
      .filter(Boolean);
    console.log('🔢 Normalized product IDs:', productIds);

    // SHIPPING CACHE LOGIC (runtime-safe)
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
      {
        ttlSeconds: 21600, // 6h fresh
        staleSeconds: 86400, // +24h stale acceptable
      }
    );
    // END SHIPPING CACHE LOGIC

    const companyLogos = {
      logo_darker: data?.acf?.logo_darker || null,
      logo_lighter: data?.acf?.logo_lighter || null,
      back_darker: data?.acf?.back_darker || null,
      back_lighter: data?.acf?.back_lighter || null,
    };

    // Page-level placement map for your UI
    const pagePlacementMap = data?.meta?.placement_coordinates || {};
    const customBackAllowedSet = (data?.acf?.custom_logo_products || []).map(String);

    // ✅ PRODUCTS via Next server cache (SWR + batch miss fetch)
    let products = [];
    if (productIds.length) {
      products = await getProductCardsBatch(productIds, {
        ttlSeconds: 60 * 60 * 6, // 6h "fresh"
        staleSeconds: 60 * 60 * 24, // +24h stale acceptable
      });
      console.log('📦 initialProducts from Next cache/batch:', products?.length);
    } else {
      console.warn('⚠️ No valid product IDs found');
    }

    return {
      props: {
        slug: params.slug,
        initialProducts: products,
        bumpPrice,
        pageId: data?.id || null,
        companyData: {
          name: data.acf?.user_header_title || data.title || '',
          description: data.acf?.user_header_content || '',
          logo: data.acf?.logo_darker?.url || null,
        },
        companyLogos,
        seo: {
          title: data.acf?.user_header_title || data.title || '',
          description: data?.acf.user_header_content || '',
          image: data.acf?.logo_darker?.url || null,
        },
        acf: data?.acf || [],
        meta: data?.meta || [],
        shippingOptions,
        pagePlacementMap,
        customBackAllowedSet,
      },
      revalidate: 60,
    };
  } catch (error) {
    console.error('🚨 getStaticProps error for slug', params.slug, error);
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

export default function LandingPage({
  slug,
  initialProducts = [],
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
}) {
  const [animationDone, setAnimationDone] = useState(false);
  const cartSectionRef = useRef(null);

  const handleScrollToCart = () => {
    if (cartSectionRef.current) {
      cartSectionRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  if (!animationDone) return <CircleReveal onFinish={() => setAnimationDone(true)} />;

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
        <link rel="canonical" href={`${process.env.NEXT_PUBLIC_SITE_URL || ''}/${slug}`} />
      </Head>

      <GoogleTagManager gtmId={process.env.NEXT_PUBLIC_GTM_ID} />

      <div className="min-h-screen bg-gradient-to-b from-[#f7f7f7] to-[#fff] flex flex-col">
        <TopBar wpUrl={WP_URL} onCartClick={handleScrollToCart} />
        <main className="alrndr-hero">
          <HeroSection company={companyData} />
          <InfoBoxSection />
          {initialProducts.length === 0 ? (
            <div className="text-center py-12 text-gray-400">אין מוצרים להצגה</div>
          ) : (
            <ProductListSection
              products={initialProducts}
              bumpPrice={bumpPrice}
              onCartAddSuccess={handleScrollToCart}
              companyLogos={companyLogos}
              pagePlacementMap={pagePlacementMap}
              customBackAllowedSet={customBackAllowedSet}
            />
          )}
          <div className="w-full" ref={cartSectionRef}>
            <CartPage
              initialProducts={initialProducts}
              shippingOptions={shippingOptions}
              shippingLoading={false}
              acf={acf}
              companyData={companyData}
              companyLogos={companyLogos}
              pagePlacementMap={pagePlacementMap}
              customBackAllowedSet={customBackAllowedSet}
              slug={slug}
            />
          </div>
          <Footer />
        </main>
      </div>
    </>
  );
}
