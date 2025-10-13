// src/pages/create-catalog.jsx
import Head from 'next/head';
import Hero from '@/components/homepage/Hero';
import HowItWorks from '@/components/homepage/HowItWorks';
import VideoInstructions from '@/components/homepage/VideoInstructions';
import CompanySlider from '@/components/homepage/CompanySlider';
import AboutUs from '@/components/homepage/AboutUs';
import OurValues from '@/components/homepage/OurValues';
import CallToAction from '@/components/homepage/CallToAction';
import Faqs from '@/components/homepage/Faqs';
import Footer from '@/components/common/Footer';

import GeneralProducts from '@/components/homepage/GeneralProducts';
import { wpApiFetch } from '@/lib/wpApi';
import { getProductCardsBatch } from '@/lib/productCache'; // server-side helper

export default function CreateCatalogPage({
  productIds = [],
  criticalProducts = [],
  cacheBust = 0,
}) {
  return (
    <>
      <Head>
        <title>Create Catalog — Pick Products & Generate Instantly</title>
        <meta
          name="description"
          content="Create a catalog in one upload — pick products and generate print files with your logo."
        />
      </Head>

      <main>
        {/* --- Existing sections kept exactly as-is --- */}
        <Hero />
        <HowItWorks />
        <VideoInstructions />
        <CompanySlider />
        <AboutUs />
        <OurValues />
        <GeneralProducts
          productIds={productIds}
          cacheBust={cacheBust}
          criticalProducts={criticalProducts}
        />
        <CallToAction />
        <Faqs />

        <Footer />
      </main>
    </>
  );
}

export async function getStaticProps() {
  try {
    // 1) Fetch all product IDs via WP REST (using your helper)
    //    Endpoint returns an array of product objects or IDs — normalize to numbers.
    const res = await wpApiFetch(`get-all-products`);
    if (!res.ok) {
      // Try to read body as text for debugging
      let bodyPreview = '';
      try {
        bodyPreview = await res.text();
      } catch (e) {
        bodyPreview = '[no body text available]';
      }
      console.error('[getStaticProps] get-all-products fetch failed', {
        status: res.status,
        url: res.url,
        headers: Object.fromEntries(res.headers.entries?.() || []),
        bodyPreview: bodyPreview.slice(0, 300), // cap length
      });
      throw new Error(`get-all-products fetch failed ${res.status}`);
    }
    const data = await res.json();

    const productIdsRaw = data?.products || [];
    const productIds = productIdsRaw
      .map(p => (p && typeof p === 'object' ? p.id : p))
      .filter(Boolean)
      .map(id => Number(id))
      .filter(id => Number.isFinite(id));

    // 2) SSR only first 6 for faster FCP
    const CRITICAL_COUNT = 6;
    const criticalIds = productIds.slice(0, CRITICAL_COUNT);

    console.log('create-catalog.jsx criticalIds:', criticalIds);

    let criticalProducts = [];
    if (criticalIds.length) {
      try {
        const batch = await getProductCardsBatch(criticalIds, {
          ttlSeconds: 60 * 60 * 6, // 6h
          staleSeconds: 60 * 60 * 24, // 24h
        });
        // [PATCH] Updated: normalize return shape from getProductCardsBatch
        criticalProducts = Array.isArray(batch)
          ? batch
          : Array.isArray(batch?.products)
            ? batch.products
            : [];
      } catch (e) {
        console.warn('create-catalog.jsx getProductCardsBatch error:', e);
        criticalProducts = [];
      }
    }

    // 3) Cache bust (lets you invalidate client fetches on deploy)
    const cacheBust = Date.now();

    return {
      props: {
        productIds,
        criticalProducts,
        cacheBust,
      },
    };
  } catch (err) {
    console.error('create-catalog getServerSideProps error:', err);
    return {
      props: {
        productIds: [],
        criticalProducts: [],
        cacheBust: Date.now(),
      },
    };
  }
}
