'use client';
import Footer from '@/components/common/Footer';
import CallToAction from '@/components/homepage/CallToAction';
import Faqs from '@/components/homepage/Faqs';
import PromoteSection from '@/components/page/PromoteSection';
import ThreeEasySteps from '@/components/page/ThreeEasySteps';
import TopBar from '@/components/page/TopBar';
import Head from 'next/head';
import Image from 'next/image';
import { useState } from 'react';

export default function AffiliatePage() {
  return (
    <>
      <Head>
        <title>About LineFlow</title>
        <meta name="description" content="About LineFlow" />
      </Head>
      <main>
        <TopBar />
        {/* Hero */}
        <section className="relative w-full flex py-16 justify-center overflow-hidden min-h-screen">
          <div
            className="absolute inset-0 bg-[url('/hero-bg.svg')] bg-cover bg-center"
            aria-hidden="true"
          />
          <div
            className="absolute inset-0  bg-[radial-gradient(85.74%_87.2%_at_50%_41.34%,_#FFFFFF_0%,_rgba(255,255,255,0.8)_36.22%,_#0D0071_120%)]"
            aria-hidden="true"
          />

          <div className="relative z-10 container w-full flex flex-col md:flex-row items-center justify-center gap-8 px-4 py-20 md:py-20">
            <div className="p-8 flex flex-col md:flex-row items-center gap-8">
              <div className="flex-1 pr-12 flex flex-col gap-8">
                <h1
                  className="mb-2"
                  style={{
                    fontWeight: 700,
                    fontStyle: 'bold',
                    fontSize: '62px',
                    lineHeight: '110%',
                    letterSpacing: '0',
                  }}
                >
                  Earn <span className="text-primary-500">20% Commission.</span> Every Customer.{' '}
                  <br />
                  No Caps.
                </h1>
                <p
                  style={{
                    fontSize: '20px',
                    lineHeight: '140%',
                    letterSpacing: '0',
                    color: '##4C4C4C',
                  }}
                >
                  <span className="font-semibold text-primary-500">
                    Get 20% recurring commission
                  </span>{' '}
                  for 12 months on every paid Creator or Team plan you refer. Referrals qualify if
                  they sign up via your link within 60 days.
                </p>

                <button
                  type="submit"
                  className="mt-2 self-start inline-flex items-center justify-center rounded-full bg-[#0D0071] px-6 py-4 text-sm text-white shadow-[0_10px_24px_rgba(13,0,113,0.28)] transition active:translate-y-[1px] hover:opacity-95 w-auto"
                >
                  Log in as an Affiliate
                </button>
              </div>
              <div className="flex-1 flex flex-col items-center">
                <div className="relative w-full max-w-md">
                  {/* card */}
                  <div className="relative rounded-[24px] bg-white p-6 sm:p-8 shadow-[0_8px_24px_rgba(16,24,40,0.08)] ring-1 ring-black/5">
                    <h2 className="text-center text-[26px] font-semibold text-primary-500">
                      Register as an Affiliate
                    </h2>

                    <form className="mt-6 space-y-4">
                      {/* Full Name */}
                      <div>
                        <label className="mb-2 block text-[13px] font-medium text-gray-700">
                          Full Name<span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          placeholder="John Carter"
                          className="w-full h-12 rounded-xl border border-gray-300 bg-white px-4 text-sm text-gray-900 outline-none transition placeholder:text-gray-400 focus:border-[#0D0071] focus:ring-2 focus:ring-[#0D0071]/20"
                        />
                      </div>

                      {/* Email */}
                      <div>
                        <label className="mb-2 block text-[13px] font-medium text-gray-700">
                          Email<span className="text-red-500">*</span>
                        </label>
                        <input
                          type="email"
                          placeholder="you@example.com"
                          className="w-full h-12 rounded-xl border border-gray-300 bg-white px-4 text-sm text-gray-900 outline-none transition placeholder:text-gray-400 focus:border-[#0D0071] focus:ring-2 focus:ring-[#0D0071]/20"
                        />
                      </div>

                      {/* Password */}
                      <PasswordField label="Password" placeholder="••••••••" required />

                      {/* Repeat Password */}
                      <PasswordField label="Repeat Password" placeholder="••••••••" required />

                      {/* Primary CTA */}
                      <button
                        type="submit"
                        className="mt-2 inline-flex w-full items-center justify-center rounded-full bg-[#0D0071] px-6 py-4 text-sm font-semibold text-white shadow-[0_10px_24px_rgba(13,0,113,0.28)] transition hover:opacity-95 active:translate-y-[1px]"
                      >
                        Register Now
                      </button>

                      {/* Divider */}
                      <div className="flex items-center gap-3 text-sm text-gray-500">
                        <span className="h-px flex-1 bg-gray-200" />
                        or
                        <span className="h-px flex-1 bg-gray-200" />
                      </div>

                      {/* Google button */}
                      <button
                        type="button"
                        className="w-full flex items-center justify-center gap-3 rounded-full border border-gray-300 bg-white px-5 py-3 text-[15px] font-medium text-gray-800 shadow-sm hover:bg-gray-50"
                      >
                        <Image src="/GIcon.svg" alt="Google" width={22} height={22} />
                        Signup with Google
                      </button>
                    </form>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* How it Works */}
        <section className="container mx-auto py-20">
          <div className="text-center">
            <h2 className="typo-h2 font-bold text-secondary mb-[10px]">
              How it <span className="text-tertiary">Works?</span>
            </h2>
          </div>
          <div className="self-stretch relative flex flex-col justify-center items-center max-w-100% md:max-w-[1400px] mx-auto">
            <div className="relative">
              <img src="/images/affiliate/Video.png" className="max-w-full h-auto block" />
              <div className="absolute top-0 left-0 w-full h-full overflow-hidden flex items-center justify-center">
                <div className="size-40 relative -top-[16px] opacity-80 rounded-full bg-secondary bg-[url('/play-button.png')] bg-[length:70px_70px] bg-center bg-no-repeat hover:bg-tertiary cursor-pointer"></div>
              </div>
            </div>
          </div>
        </section>

        {/* What Can You Promote */}
        <PromoteSection />

        {/* How It Works in 3 Easy Steps */}
        <ThreeEasySteps />

        {/* FAQ Section */}
        <Faqs />

        {/* Join Affiliate Program */}
        <section className="container mx-auto pb-25">
          <CallToAction />
        </section>

        {/* Footer */}
        <Footer />
      </main>
    </>
  );
}

function PasswordField({ label = 'Password', placeholder = '••••••••', required = false }) {
  const [show, setShow] = useState(false);
  return (
    <div>
      <label className="mb-2 block text-[13px] font-medium text-gray-700">
        {label}
        <span className="text-red-500">*</span>
      </label>
      <div className="relative">
        <input
          type={show ? 'text' : 'password'}
          placeholder={placeholder}
          required={required}
          className="w-full h-12 rounded-xl border border-gray-300 bg-white px-4 pr-10 text-sm text-gray-900 outline-none transition placeholder:text-gray-400 focus:border-[#0D0071] focus:ring-2 focus:ring-[#0D0071]/20"
        />
        <button
          type="button"
          onClick={() => setShow(s => !s)}
          className="absolute inset-y-0 right-0 grid w-10 place-items-center text-gray-500 hover:text-gray-700"
          aria-label={show ? 'Hide password' : 'Show password'}
        >
          <Image
            src={show ? '/eye-open.png' : '/EyeSlash.svg'}
            alt={show ? 'Hide' : 'Show'}
            width={20}
            height={20}
          />
        </button>
      </div>
    </div>
  );
}