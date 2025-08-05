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

const WP_URL = process.env.NEXT_PUBLIC_WP_SITE_URL;

export async function getStaticPaths() {
  // Hardcode the slugs you want to prebuild
  const slugs = ['acumenrisk'];

  return {
    paths: slugs.map(slug => ({ params: { slug } })),
    fallback: 'blocking', // 'blocking' for ISR if you want to support others
  };
}


export async function getStaticProps({ params }) {
  try {
    console.log('⏳ Fetching company page data for slug:', params.slug);

    const res = await fetch(`${WP_URL}/wp-json/mini-sites/v1/company-page?slug=${params.slug}`);
    if (!res.ok) throw new Error('Failed to fetch company data');

    const data = await res.json();
    console.log('✅ Company data response:', data);

    const bumpPrice = data.acf?.bump_price || null;
    const productIdsRaw = data.acf?.selected_products || [];

    console.log('🧩 Raw selected_products from ACF:', productIdsRaw);

    // Normalize to IDs
    const productIds = productIdsRaw.map(p => (typeof p === 'object' ? p.id : p)).filter(Boolean);
    console.log('🔢 Normalized product IDs:', productIds);

    let products = [];

    if (productIds.length) {
      const idsParam = productIds.join(',');
      const productRes = await fetch(`${WP_URL}/wp-json/mini-sites/v1/get-products-by-ids?ids=${idsParam}`);
      console.log('📡 GET /get-products-by-ids response status:', productRes.status);

      if (productRes.ok) {
        const productData = await productRes.json();
        products = productData.products || [];
        console.log('📦 Final loaded products:', products);
      } else {
        console.error('❌ Failed to load products by IDs:', await productRes.text());
      }
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
          name: data.meta.header_title || data.title || '',
          description: data.meta.header_content || '',
          logo: data.acf?.logo_darker?.url || null,
        },
        seo: {
          title: data.meta.seo_title || '',
          description: data.meta.seo_description || '',
          image: data.meta.seo_image?.url || null,
        },
        meta: data?.meta || [],
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
  error = false,
}) {
  const [animationDone, setAnimationDone] = useState(false);
  const [shippingOptions, setShippingOptions] = useState([]);
  const [shippingLoading, setShippingLoading] = useState(true);
  const cartSectionRef = useRef(null);

  useEffect(() => {
    async function fetchShipping() {
      try {
        setShippingLoading(true);
        const res = await fetch(`${WP_URL}/wp-json/mini-sites/v1/shipping`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            country: 'IL',
            postcode: '',
            cart: [],
          }),
        });
        const data = await res.json();
        setShippingOptions(data.shipping || []);
      } catch (err) {
        setShippingOptions([]);
      } finally {
        setShippingLoading(false);
      }
    }
    fetchShipping();
  }, []);

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
            />
          )}
          <div className="w-full" ref={cartSectionRef}>
            <CartPage
              shippingOptions={shippingOptions}
              shippingLoading={shippingLoading}
              meta={meta}
            />
          </div>
          <Footer />
        </main>
      </div>
    </>
  );
}
