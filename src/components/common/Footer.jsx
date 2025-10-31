// app/components/Footer.tsx
'use client';
import Image from 'next/image';
import Link from 'next/link';

export default function Footer({ year }) {
  // Accept `year` from server to ensure the server-rendered HTML matches the
  // client (avoids hydration mismatch). Fallback to client-side calculation
  // if not provided (defensive).
  const currentYear = year ?? new Date().getFullYear();

  return (
    <footer className="bg-primary-600 text-gray-300 w-full py-10 flex justify-center">
      <div className="container mx-auto px-4 py-12 lg:py-16">
        {/* Top grid */}
        <div className="grid grid-cols-1 gap-10 lg:grid-cols-[1.4fr_0.6fr_0.6fr_1.4fr]">
          {/* Brand + about + contact */}
          <div className="space-y-5">
            <div className="flex items-center gap-3">
              <Image src="/logo-light.svg" alt="LineFlow" width={160} height={34} priority />
            </div>

            <p className="text-sm leading-6 text-white/75">
              LineFlow is a brand that prints on t-shirts, branded products, and basically all types
              of clothing – providing a comprehensive solution under one roof. With the experience
              of hundreds of satisfied customers and in-house printing using the most advanced
              technologies, we would be happy to upgrade your business as well.
            </p>

            <ul className="space-y-3">
              <li>
                <a
                  href="mailto:info@lineflow.com"
                  className="inline-flex items-center gap-2 text-[15px] hover:opacity-90"
                >
                  <EmailIcon className="h-5 w-5 text-white/80" />
                  <span>info@lineflow.com</span>
                </a>
              </li>

              <li>
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

          {/* Quick Links */}
          <nav aria-label="Quick Links" className="space-y-4">
            <h3 className="text-lg font-semibold text-white">Quick Links</h3>
            <ul className="space-y-2 text-[15px]">
              <li>
                <Link href="/about" className="hover:underline underline-offset-4">
                  About Us
                </Link>
              </li>
              <li>
                <Link href="/affiliates" className="hover:underline underline-offset-4">
                  Affiliates
                </Link>
              </li>
              <li>
                <Link href="/factories" className="hover:underline underline-offset-4">
                  Our Factories
                </Link>
              </li>
              <li>
                <Link href="/success-stories" className="hover:underline underline-offset-4">
                  Success Stories
                </Link>
              </li>
            </ul>
          </nav>

          {/* Information */}
          <nav aria-label="Information" className="space-y-4">
            <h3 className="text-lg font-semibold text-white">Information</h3>
            <ul className="space-y-2 text-[15px]">
              <li>
                <Link href="/contact" className="hover:underline underline-offset-4">
                  Contact Us
                </Link>
              </li>
              <li>
                <Link href="/privacy-policy" className="hover:underline underline-offset-4">
                  Privacy Policy
                </Link>
              </li>
              <li>
                <Link href="/terms" className="hover:underline underline-offset-4">
                  Terms &amp; Conditions
                </Link>
              </li>
            </ul>
          </nav>

          {/* Newsletter card */}
          <div className="flex justify-between gap-4 flex-col">
            <div className="rounded-[20px] bg-primary-100 p-6 text-[#0A0830] shadow-[0_8px_24px_rgba(0,0,0,0.25)]">
              <h3 className="text-lg font-semibold">Newsletter</h3>
              <p className="mt-2 text-sm leading-6 text-black/70">
                Olaraund is a brand that prints on t-shirts, branded products, and basically all
                types of clothing
              </p>

              <form onSubmit={e => e.preventDefault()} className="mt-5 flex items-center gap-3">
                <label htmlFor="newsletter-email" className="sr-only">
                  Email address
                </label>
                <input
                  id="newsletter-email"
                  type="email"
                  required
                  placeholder="Enter Email Address"
                  className="h-12 w-full flex-1 rounded-xl border border-black/10 px-4 text-sm outline-none ring-0 placeholder:text-black/40"
                />
                <button
                  type="submit"
                  className="h-12 shrink-0 rounded-xl bg-[#0A0830] px-5 text-sm font-medium text-white transition hover:opacity-90"
                >
                  Subscribe
                </button>
              </form>
            </div>
            <div className="flex items-center justify-between text-white gap-5">
              <span className="text-sm">Follow Us</span>
              <div className="flex items-center gap-4">
                <a
                  href="https://instagram.com/allaround.co.il/"
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Instagram"
                  className="rounded-full p-2 ring-1 ring-white/100 hover:bg-white/10"
                >
                  <InstagramIcon className="h-5 w-5" />
                </a>
                <a
                  href="https://facebook.com/allaround.co.il/"
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Facebook"
                  className="rounded-full p-2 ring-1 ring-white/100 hover:bg-white/10"
                >
                  <FacebookIcon className="h-5 w-5" />
                </a>
                <a
                  href="https://tiktok.com/allaround.co.il/"
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="TikTok"
                  className="rounded-full p-2 ring-1 ring-white/100 hover:bg-white/10"
                >
                  <TikTokIcon className="h-5 w-5" />
                </a>
                <a
                  href="https://www.linkedin.com/company/"
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="LinkedIn"
                  className="rounded-full p-2 ring-1 ring-white/100 hover:bg-white/10"
                >
                  <LinkedInIcon className="h-5 w-5" />
                </a>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom row */}
          <div className="mt-10 flex flex-col items-center justify-center gap-6 border-t border-white/10 pt-6 md:flex-row">
          <p className="text-xs text-grey/300">© All Right Reserved by LineFlow – {currentYear}</p>
        </div>
      </div>
    </footer>
  );
}

/* ===== Icons ===== */

function EmailIcon({ className = '' }) {
  return (
    <Image
      src="/EnvelopeSimple.svg"
      alt="Envelope"
      width={20}
      height={20}
      className={className}
      priority
    />
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

function InstagramIcon({ className = '' }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true">
      <path d="M7 2h10a5 5 0 0 1 5 5v10a5 5 0 0 1-5 5H7a5 5 0 0 1-5-5V7a5 5 0 0 1 5-5Zm5 5.5A4.5 4.5 0 1 0 16.5 12 4.51 4.51 0 0 0 12 7.5Zm6.25-.75a1.25 1.25 0 1 0 1.25 1.25A1.25 1.25 0 0 0 18.25 6.75ZM12 9a3 3 0 1 1-3 3 3 3 0 0 1 3-3Z" />
    </svg>
  );
}

function FacebookIcon({ className = '' }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true">
      <path d="M12 2.04C6.5 2.04 2 6.54 2 12.04c0 5 3.66 9.14 8.44 9.88v-6.99H7.9v-2.89h2.54V9.41c0-2.5 1.49-3.89 3.77-3.89 1.09 0 2.22.2 2.22.2v2.44h-1.25c-1.23 0-1.61.76-1.61 1.54v1.84h2.74l-.44 2.89h-2.3v6.99C18.34 21.18 22 17.04 22 12.04c0-5.5-4.5-10-10-10Z" />
    </svg>
  );
}

function TikTokIcon({ className = '' }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true">
      <path d="M12.5 2h3.09c.3 2.1 1.56 3.78 3.94 4.6A8.7 8.7 0 0 0 19.53 9c-2.03-.22-3.56-1.06-4.54-2.36l.02 6.88c0 3.54-2.88 6.41-6.43 6.41A6.42 6.42 0 0 1 2.2 13.5c.1-3.38 2.9-6.11 6.29-6.11.65 0 1.28.11 1.87.31v3.4a3.13 3.13 0 0 0-1.87-.61 3.15 3.15 0 1 0 0 6.29 3.15 3.15 0 0 0 3.14-3.14L11.6 2.9c.3-.6.6-.9.9-.9Z" />
    </svg>
  );
}

function LinkedInIcon({ className = '' }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true">
      <path d="M4.98 3.5C4.98 4.88 3.86 6 2.5 6S0 4.88 0 3.5 1.12 1 2.5 1s2.48 1.12 2.48 2.5ZM0 8.98h5V24H0V8.98Zm7.5 0h4.8v2.06h.07c.67-1.27 2.32-2.6 4.78-2.6 5.11 0 6.05 3.36 6.05 7.72V24h-5v-6.53c0-1.56-.03-3.56-2.17-3.56-2.17 0-2.5 1.69-2.5 3.45V24h-5V8.98Z" />
    </svg>
  );
}
