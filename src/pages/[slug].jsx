import { useState, useEffect, useRef } from 'react';
import { GoogleTagManager } from '@next/third-parties/google';
import Head from 'next/head';
import CustomLoading from '@/components/CustomLoading';
import CircleReveal from '@/components/CircleReveal';

import TopBar from '@/components/page/TopBar';
import HeroSection from '@/components/page/HeroSection';
import InfoBoxSection from '@/components/page/InfoBoxSection';
import ProductListSection from '@/components/page/ProductListSection';
import CartPage from '@/components/cart/CartPage';

import Script from 'next/script';
import Footer from '@/components/page/Footer';

const WP_URL = process.env.NEXT_PUBLIC_WP_SITE_URL;

export async function getStaticPaths() {
  return { paths: [], fallback: 'blocking' };
}

export async function getStaticProps({ params }) {
  return { props: { slug: params.slug }, revalidate: 60 };
}

export default function LandingPage({ slug }) {
  const [dataLoaded, setDataLoaded] = useState(false);
  const [animationDone, setAnimationDone] = useState(false);
  const [error, setError] = useState(false);

  // Main data
  const [company, setCompany] = useState({});
  const [products, setProducts] = useState([]);
  const [meta, setMeta] = useState([]);
  const [pageId, setPageId] = useState(null);

  const [shippingOptions, setShippingOptions] = useState([]);
  const [shippingLoading, setShippingLoading] = useState(true);

  const [bumpPrice, setBumpPrice] = useState(null);

  const cartSectionRef = useRef(null);

  // SEO data - Initialize with static loading data
  const [seoData, setSeoData] = useState({
    title: 'The mini site is loading...',
    description: 'Please wait while we load your personalized mini site experience.',
    image: null,
  });

  useEffect(() => {
    async function fetchData() {
      try {
        const res = await fetch(`${WP_URL}/wp-json/mini-sites/v1/company-page?slug=${slug}`);
        if (!res.ok) throw new Error('Network response was not ok');
        const data = await res.json();
        if (!data || !data.meta) throw new Error('No meta in data');

        const companyData = {
          name: data.meta.header_title || data.title || '',
          description: data.meta.header_content || '',
          logo: data.acf?.logo_darker?.url || null,
        };

        setCompany(companyData);
        setProducts(data.acf?.selected_products || []);
        setPageId(data?.id || null);
        setMeta(data?.meta || []);
        setBumpPrice(data.acf?.bump_price || null);

        // Set SEO data
        setSeoData({
          title: data.meta.seo_title || companyData.name || `${slug} - Company Page`,
          description:
            data.meta.seo_description ||
            companyData.description ||
            `Discover ${companyData.name} and explore our products.`,
          image: data.meta.seo_image?.url || companyData.logo || null,
        });

        setError(false);
      } catch (err) {
        setError(true);
        // Set fallback SEO data for error case
        setSeoData({
          title: `${slug} - Page Not Found`,
          description: 'The requested page could not be found.',
          image: null,
        });
      } finally {
        setDataLoaded(true);
      }
    }
    fetchData();
  }, [slug]);

  useEffect(() => {
    // Fetch initial shipping options with "empty cart" (or you can use demo/default product)
    async function fetchShipping() {
      setShippingLoading(true);
      try {
        const res = await fetch(`${WP_URL}/wp-json/mini-sites/v1/shipping`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            country: "IL",
            postcode: "",
            cart: [], // empty cart for now
          }),
        });
        const data = await res.json();
        console.log(data);
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

  if (!dataLoaded) {
    return (
      <>
        <Head>
          <title>{seoData.title}</title>
          <meta name="description" content={seoData.description} />
          <meta name="viewport" content="width=device-width, initial-scale=1" />
        </Head>
        <CustomLoading />
      </>
    );
  }

  if (!animationDone) return <CircleReveal onFinish={() => setAnimationDone(true)} />;

  if (error) {
    return (
      <>
        <Head>
          <title>{seoData.title}</title>
          <meta name="description" content={seoData.description} />
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
        <title>{seoData.title}</title>
        <meta name="description" content={seoData.description} />

        {/* Open Graph / Facebook */}
        <meta property="og:type" content="website" />
        <meta property="og:title" content={seoData.title} />
        <meta property="og:description" content={seoData.description} />
        {seoData.image && <meta property="og:image" content={seoData.image} />}

        {/* Twitter */}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={seoData.title} />
        <meta name="twitter:description" content={seoData.description} />
        {seoData.image && <meta name="twitter:image" content={seoData.image} />}

        {/* Additional SEO */}
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="canonical" href={`${process.env.NEXT_PUBLIC_SITE_URL || ''}/${slug}`} />
      </Head>

      <GoogleTagManager gtmId={process.env.NEXT_PUBLIC_GTM_ID} />

      <div className="min-h-screen bg-gradient-to-b from-[#f7f7f7] to-[#fff] flex flex-col px-0 py-0">
        <TopBar wpUrl={WP_URL} onCartClick={handleScrollToCart} />
        <main className="alrndr-hero">
          <HeroSection company={company} />
          <InfoBoxSection />
          <ProductListSection
            wpUrl={WP_URL}
            pageId={pageId}
            bumpPrice={bumpPrice}
            onCartAddSuccess={handleScrollToCart}
          />
          {/* Cart section - always visible, under product list */}
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
