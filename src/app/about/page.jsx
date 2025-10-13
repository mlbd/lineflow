'use client';
import Faqs from '@/components/homepage/Faqs';
import Head from 'next/head';
import Image from 'next/image';
import Link from 'next/link';

import Footer from '@/components/common/Footer';
import HeroSection from '@/components/page/HeroSection';
import TopBar from '@/components/page/TopBar';

export default function AboutPage() {
  return (
    <>
      <Head>
        <title>About LineFlow</title>
        <meta name="description" content="About LineFlow" />
      </Head>
      <main>
        <TopBar />

        {/* Banner / Hero (you said this is prebuilt) */}
        <HeroSection
          title={
            <>
              <span className="text-primary font-bold text-[64px] leading-[1.1] tracking-normal">
                About
              </span>
              <span className="text-primary-500 font-normal text-[64px] leading-[1.1] tracking-normal">
                LineFlow
              </span>
            </>
          }
          // Provide any props your component expects (subtitle, bg, etc.)
          subtitle=""
        />

        {/* Who we are / goal */}
        <section className="mx-auto container py-12 md:py-16">
          {/* Top: left heading + right paragraph */}
          <div className="grid grid-cols-12 gap-6 md:gap-10 items-start">
            {/* Left: Heading */}
            <div className="col-span-12 md:col-span-7">
              <h2 className="font-bold text-[28px] leading-[1.1] sm:text-[34px] lg:text-[44px] text-gray-900">
                Who are We and What
                <br />
                <span className="text-primary-500">is Our Goal?</span>
              </h2>
            </div>

            {/* Right: Lead paragraph */}
            <div className="col-span-12 md:col-span-5">
              <p className="text-[16px] md:text-base leading-7 text-gray-600">
                Lorem ipsum dolor sit amet, consectetur adipiscing elit. Aenean sollicitudin ex eu
                efficitur euismod. Vestibulum convallis dui ut libero hendrerit, ac blandit ipsum
                posuere.
              </p>
            </div>

            {/* Bottom: Four image cards in one row */}
            <div className="col-span-12">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-2">
                {/* 1 */}
                <div className="relative overflow-hidden rounded-2xl md:rounded-3xl aspect-[3/4] ring-1 ring-black/5">
                  <Image
                    src="/images/about/labeling.jpg"
                    alt="Labeling"
                    fill
                    sizes="(max-width: 768px) 50vw, (max-width: 1200px) 25vw, 300px"
                    className="object-cover"
                    priority
                  />
                </div>
                {/* 2 */}
                <div className="relative overflow-hidden rounded-2xl md:rounded-3xl aspect-[3/4] ring-1 ring-black/5">
                  <Image
                    src="/images/about/embroidery.jpg"
                    alt="Embroidery"
                    fill
                    sizes="(max-width: 768px) 50vw, (max-width: 1200px) 25vw, 300px"
                    className="object-cover"
                  />
                </div>
                {/* 3 */}
                <div className="relative overflow-hidden rounded-2xl md:rounded-3xl aspect-[3/4] ring-1 ring-black/5">
                  <Image
                    src="/images/about/packing.jpg"
                    alt="Packing"
                    fill
                    sizes="(max-width: 768px) 50vw, (max-width: 1200px) 25vw, 300px"
                    className="object-cover"
                  />
                </div>
                {/* 4 (duplicate packing as placeholder; swap to your 4th image) */}
                <div className="relative overflow-hidden rounded-2xl md:rounded-3xl aspect-[3/4] ring-1 ring-black/5">
                  <Image
                    src="/images/about/packing.jpg"
                    alt="Packing 2"
                    fill
                    sizes="(max-width: 768px) 50vw, (max-width: 1200px) 25vw, 300px"
                    className="object-cover"
                  />
                </div>
              </div>
            </div>
          </div>
          {/* Big brand mockups image */}
          <div className="mt-12 grid gap-10 md:grid-cols-2 md:gap-16">
            <div className="space-y-4 text-sm leading-7 text-gray-600">
              <p>
                Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed vulputate semper
                cursus. Sed augue ante, ultrices blandit nisi tincidunt, sollicitudin congue elit.
                Fusce sed risus erat. Nam interdum pellentesque ex, lobortis vestibulum ligula
                lobortis at. Nullam et tellus in dui iaculis volutpat. Integer non ipsum elementum,
                sollicitudin metus non, dapibus turpis. Donec blandit faucibus quam, sit amet
                venenatis lorem lacinia in.
              </p>
              <p>
                Praesent nec nulla at tortor vehicula rutrum eu id elit. Nam in suscipit ipsum. Duis
                vel vehicula sapien, in ultrices nibh. Duis cursus mauris urna, a tempus felis
                tincidunt id. Nulla consequat, enim eget rhoncus efficitur, eros ante laoreet leo,
                posuere sodales elit ex sed metus. Curabitur vehicula erat id justo vestibulum
                pharetra a at turpis. Praesent vel condimentum lorem.
              </p>
              <p>
                Morbi ornare a dolor quis vehicula. Pellentesque cursus sagittis sapien at faucibus.
                Mauris accumsan sem non porttitor faucibus. Ut sed lobortis neque. Pellentesque
                scelerisque metus in dui hendrerit, vitae dignissim leo condimentum. Aenean congue
                nunc ac lobortis posuere. Etiam iaculis ut ipsum sed dignissim.
              </p>
              <div className="mt-6">
                <div className="font-semibold text-gray-900">CEO Name</div>
                <div className="text-xs text-gray-500">CEO of LineFlow</div>
              </div>
            </div>

            <div className="relative h-150 w-full overflow-hidden rounded-2xl shadow-sm md:h-[650px]">
              <Image
                src="/images/about/stationery.jpg"
                alt="LineFlow stationery"
                fill
                sizes="(max-width:1024px) 100vw, 600px"
                className="object-cover"
                priority
              />
            </div>
          </div>
        </section>

        {/* FAQs */}
        <Faqs />

        {/* Contact / Let’s get in touch */}
        <section className="mx-auto py-12 container md:py-16">
          <div className="grid grid-cols-12 gap-6 md:gap-10 items-start">
            {/* Left info */}
            <div className="col-span-12 md:col-span-5 pr-10">
              <h2 className="font-bold text-[28px] leading-[1.1] sm:text-[34px] lg:text-[44px] text-gray-900">
                <span className="text-primary-500">Let’s Get </span>
                in Touch
              </h2>
              <p className="mt-2 text-sm text-gray-600">
                Leave your details and we will get back to you as soon as possible
              </p>

              <ul className="mt-8 space-y-4 text-sm">
                <li className="flex items-center mb-8 gap-4">
                  {/* Icon */}
                  <span className="inline-flex w-10 h-8 items-center justify-center ">
                    <Image
                      src="/images/contact/envelop.png"
                      alt="Email"
                      width={40}
                      height={40}
                      className="h-auto w-full"
                      priority={false}
                    />
                  </span>

                  {/* Text */}
                  <div className="leading-tight">
                    <div className="text-sm font-medium text-gray-500">Email Address</div>
                    <a
                      href="mailto:info@lineflow.com"
                      className="block text-[17px] font-semibold text-gray-900 hover:text-primary"
                    >
                      info@lineflow.com
                    </a>
                  </div>
                </li>
                <li className="flex items-center mb-8 gap-4">
                  {/* Icon */}
                  <span className="inline-flex w-10 h-8 items-center justify-center ">
                    <Image
                      src="/images/contact/Instagram.png"
                      alt="Email"
                      width={40}
                      height={40}
                      className="h-auto w-full"
                      priority={false}
                    />
                  </span>

                  {/* Text */}
                  <div className="leading-tight">
                    <div className="text-sm font-medium text-gray-500">Instagram</div>
                    <a
                      href="#"
                      className="block text-[17px] font-semibold text-gray-900 hover:text-primary"
                    >
                      @lineflow.co
                    </a>
                  </div>
                </li>
                <li className="flex items-center mb-8 gap-4">
                  {/* Icon */}
                  <span className="inline-flex w-10 h-8 items-center justify-center ">
                    <Image
                      src="/images/contact/Linkedin.png"
                      alt="Email"
                      width={40}
                      height={40}
                      className="h-auto w-full"
                      priority={false}
                    />
                  </span>

                  {/* Text */}
                  <div className="leading-tight">
                    <div className="text-sm font-medium text-gray-500">LinkedIn</div>
                    <a
                      href="#"
                      className="block text-[17px] font-semibold text-gray-900 hover:text-primary"
                    >
                      LineFlow Co
                    </a>
                  </div>
                </li>

                <li className="mt-10">
                  <div className="text-sm font-medium text-gray-500 mb-2">Live Chat</div>
                  <Link
                    href="/contact"
                    className="rounded-[16px] inline-flex items-center gap-2 text-primary-500 bg-primary-100 px-4 py-3 text-[16px] transition hover:bg-white/75"
                  >
                    <HeadsetIcon className="h-5 w-5 text-primary-500" />
                    <span>Chat With Us</span>
                  </Link>
                </li>
              </ul>
            </div>

            {/* Right form (UI only) */}
            <form
              className="col-span-12 md:col-span-7 rounded-[20px] bg-[#F7F9FC] p-6 md:p-8 shadow-[0_2px_8px_rgba(16,24,40,0.04)]"
              onSubmit={e => {
                e.preventDefault();
                // hook to your API / Make.com here
              }}
            >
              <div className="grid gap-5">
                {/* Full Name */}
                <div>
                  <label className="mb-2 block text-[13px] font-medium text-gray-600">
                    Full Name<span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="name"
                    placeholder="John Carter"
                    required
                    className="w-full h-12 rounded-[8px] border border-gray-300 bg-white px-4 text-sm text-gray-900 outline-none transition
                   placeholder:text-gray-400 focus:border-[#0D0071] focus:ring-2 focus:ring-[#0D0071]/20"
                  />
                </div>

                {/* Email */}
                <div>
                  <label className="mb-2 block text-[13px] font-medium text-gray-600">
                    Email<span className="text-red-500">*</span>
                  </label>
                  <input
                    type="email"
                    name="email"
                    placeholder="you@example.com"
                    required
                    className="w-full h-12 rounded-[8px] border border-gray-300 bg-white px-4 text-sm text-gray-900 outline-none transition
                   placeholder:text-gray-400 focus:border-[#0D0071] focus:ring-2 focus:ring-[#0D0071]/20"
                  />
                </div>

                {/* Message */}
                <div>
                  <label className="mb-2 block text-[13px] font-medium text-gray-600">
                    Message<span className="text-red-500">*</span>
                  </label>
                  <textarea
                    name="message"
                    rows={6}
                    placeholder="Tell us a bit about your project…"
                    required
                    className="w-full rounded-[8px] border border-gray-300 bg-white px-4 py-3 text-sm text-gray-900 outline-none transition
                   placeholder:text-gray-400 focus:border-[#0D0071] focus:ring-2 focus:ring-[#0D0071]/20"
                  />
                </div>

                {/* Submit */}
                <button
                  type="submit"
                  className="mt-2 inline-flex w-full items-center justify-center rounded-full bg-[#0D0071] px-6 py-4 text-sm font-semibold text-white
                 shadow-[0_10px_24px_rgba(13,0,113,0.28)] transition active:translate-y-[1px] hover:opacity-95"
                >
                  Submit
                </button>
              </div>
            </form>
          </div>
        </section>

        <Footer />
      </main>
    </>
  );
}

function HeadsetIcon({ className = '' }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true">
      <path d="M12 3a8 8 0 0 0-8 8v3a3 3 0 0 0 3 3h1v-6H7a6 6 0 0 1 12 0h-1v6h1a3 3 0 0 0 3-3v-3a8 8 0 0 0-8-8Z" />
      <path d="M9 14v6h3a3 3 0 0 0 3-3v-3H9Z" />
    </svg>
  );
}