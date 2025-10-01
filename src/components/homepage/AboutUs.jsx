// ./src/components/homepage/AboutUs.jsx
import React from 'react';
import Image from 'next/image';
import dynamic from 'next/dynamic';

// const InfiniteSlider = dynamic(() => import('./InfiniteSlider').then(m => m.default || m), {
//   ssr: false,
//   loading: () => <div className="h-[360px] w-full rounded-2xl bg-white/10 animate-pulse" />,
// });

function AboutUs() {
  return (
    <>
      <div className="self-stretch px-20 py-[120px] bg-primary-600 flex flex-col justify-start items-start gap-12 overflow-hidden">
        <div className="container mx-auto">
          <div className="self-stretch text-center justify-start text-white text-5xl font-bold mb-[50px]">
            Who are We and What is Our Goal?
          </div>

          <div className="self-stretch inline-flex justify-start items-start gap-[60px]">
            <div className="w-2/5 inline-flex flex-col justify-start items-start gap-8">
              <div className="self-stretch relative bg-primary-100 rounded-[20px] overflow-hidden aspect-[16/10]">
                {/* Replaced <img> with Next/Image; added descriptive alt; fill + object-cover for responsiveness */}
                <Image
                  src="/aboutus-thumb.png"
                  alt="Team working together — About us thumbnail"
                  fill
                  className="object-cover"
                  priority
                />
              </div>

              <div className="self-stretch flex flex-col justify-start items-start gap-5 py-5">
                <div className="self-stretch inline-flex justify-start items-center gap-5">
                  <div className="flex-1 px-5 py-4 bg-[#eef6ff]/20 rounded-lg inline-flex flex-col justify-start items-center gap-2">
                    <div className="self-stretch text-center justify-center text-white typo-h1 font-semibold ">
                      500+
                    </div>
                    <div className="self-stretch justify-center text-white text-base font-normal leading-snug text-center">
                      Catalogs generated instantly
                    </div>
                  </div>
                  <div className="flex-1 px-5 py-4 bg-[#eef6ff]/20 rounded-lg inline-flex flex-col justify-start items-center gap-2">
                    <div className="self-stretch text-center justify-center text-white typo-h1 font-semibold ">
                      300+
                    </div>
                    <div className="self-stretch justify-center text-center text-white text-base font-normal leading-snug">
                      Small businesses supported
                    </div>
                  </div>
                </div>

                <div className="self-stretch inline-flex justify-start items-center gap-5">
                  <div className="flex-1 px-5 py-4 bg-[#eef6ff]/20 rounded-lg inline-flex flex-col justify-start items-center gap-2">
                    <div className="self-stretch text-center justify-center text-white typo-h1 font-semibold ">
                      95%
                    </div>
                    <div className="self-stretch text-center justify-center text-white text-base font-normal leading-snug">
                      Time Saved
                    </div>
                  </div>
                  <div className="flex-1 px-5 py-4 bg-[#eef6ff]/20 rounded-lg inline-flex flex-col justify-start items-center gap-2">
                    <div className="self-stretch text-center justify-center text-white typo-h1 font-semibold ">
                      24/7
                    </div>
                    <div className="self-stretch text-center justify-center text-white text-base font-normal leading-snug">
                      Accessibility
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="w-3/5 inline-flex flex-col justify-start items-start gap-6">
              <div className="self-stretch justify-start text-white text-[28px] font-semibold ">
                The LineFlow brand was established in early 2021 to provide a wide range of branded
                products, but in a convenient and simple way.
              </div>

              <div className="self-stretch justify-start text-grey-300 text-xl font-normal leading-7">
                Honestly, there are many printing houses, advertising companies, and businesses that
                will offer the exact same products we offer. We know that...
                <br />
                <span className="block mt-5"></span>
                But (and the pain is a pain!) From personal experience, we also know how cumbersome
                and impractical this working process can be with those entities, especially since
                the minimum order is often astronomical and suitable for large businesses.
                <br />
                <span className="block mt-5"></span>
                Our platform essentially filters out the clutter in a simple and pleasant way and
                only displays the things you are really looking for.
                <br />
                <span className="block mt-5"></span>
                Honestly, there are many printing houses, advertising companies, and businesses that
                will offer the exact same products we offer. We know that...
                <br />
                <span className="block mt-5"></span>
                But (and the pain is a pain!) From personal experience, we also know how cumbersome
                and impractical this working process can be with those entities, especially since
                the minimum order is often astronomical and suitable for large businesses.
                <br />
                <span className="block mt-5"></span>
                Our platform essentially filters out the clutter in a simple and pleasant way and
                only displays the things you are really looking for.
              </div>
            </div>
          </div>

          {/* Glimpse / Orders block with slider */}
          <div className="self-stretch px-9 pt-9 pb-12 bg-[#eef6ff]/20 rounded-3xl flex flex-col justify-start items-center gap-8">
            <div className="w-full">
              {/* Slider kept disabled for now */}
            </div>

            <div className="inline-flex justify-start items-start gap-[42px]">
              <div className="flex-1 justify-start text-white text-[28px] font-semibold ">
                {/* Escaped apostrophes to satisfy react/no-unescaped-entities */}
                Here&apos;s a glimpse of real orders we&apos;ve successfully delivered.
              </div>
              <div className="flex-1 justify-start text-grey-300 text-xl font-normal leading-7">
                Lorem ipsum dolor sit amet, consectetur adipiscing elit. Vestibulum bibendum eros
                nec massa placerat, vel dignissim ligula semper. Etiam posuere et nulla sit amet
                efficitur. Nam vulputate dictum leo, non sodales mi tristique sed. Proin suscipit,
                leo vitae fringilla aliquam, nisi nisi cursus est, et semper risus lorem nec odio.
                Integer pulvinar quam sed odio euismod eleifend.
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

export default AboutUs;
