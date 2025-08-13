import Image from 'next/image';
import Link from 'next/link';
import React from 'react';

export default function Footer() {
  return (
    <footer className="bg-[#f7f7f7] text-gray-900 w-full py-10 flex justify-center">
      <div className="max-w-[var(--site-max-width)] w-full px-4 pt-10">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Column 1: Brand + About + Contact */}
          <div className="space-y-5">
            <div className="flex items-center gap-3">
              <Image
                src="/site_logo-dark.png"
                alt="Allaround"
                width={143}
                height={30}
                priority
                // className="h-10 w-auto"
              />
            </div>

            <p className="leading-6 text-sm">
              אולאראונד הוא מותג הדפסה על חולצות, מוצרים ממותגים ובגדול כל סוגי הביגוד – שנותן מענה
              כולל תחת קורת גג אחת. עם ניסיון של מאות לקוחות מרוצים והדפסות In-House בטכנולוגיות הכי
              מתקדמות, נשמח לשדרג גם את העסק שלך.
            </p>

            <ul className="space-y-1">
              {/* WhatsApp */}
              <li>
                <a
                  href="http://wa.me/972587564414"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex text-[15px] font-regular items-center gap-2 hover:opacity-80 transition"
                >
                  <WhatsAppIcon className="h-5 w-5 text-blue-600" />
                  <span>058-756-4414</span>
                </a>
              </li>

              {/* Email */}
              <li>
                <a
                  href="mailto:info@allaround.co.il"
                  className="inline-flex text-[15px] font-regular items-center gap-2 hover:opacity-80 transition"
                >
                  <EmailIcon className="h-5 w-5 text-blue-600" />
                  <span>info@AllAround.co.il</span>
                </a>
              </li>

              {/* Address → Home URL */}
              <li>
                <Link
                  href="/"
                  className="inline-flex text-[15px] font-regular items-center gap-2 hover:opacity-80 transition"
                >
                  <LocationIcon className="h-5 w-5 text-blue-600" />
                  <span>הלהב 2, חולון (קומת רמפה עליונה)</span>
                </Link>
              </li>
            </ul>
          </div>

          {/* Column 2: Site Navigation */}
          <nav aria-label="ניווט אתר" className="space-y-5">
            <h3 className="text-lg font-semibold">ניווט באתר</h3>
            <ul className="grid grid-cols-2 gap-3">
              <li>
                <Link href="/" className="hover:underline underline-offset-4">
                  דף הבית
                </Link>
              </li>
              <li>
                <Link href="/catalog" className="hover:underline underline-offset-4">
                  קטלוג
                </Link>
              </li>
              <li>
                <Link href="/about" className="hover:underline underline-offset-4">
                  אודות
                </Link>
              </li>
              <li>
                <Link href="/contact" className="hover:underline underline-offset-4">
                  צור קשר
                </Link>
              </li>
            </ul>
          </nav>

          {/* Column 3: Follow Us */}
          <div className="space-y-5">
            <h3 className="text-lg font-semibold">עקבו אחרינו</h3>
            <ul className="flex flex-col gap-2">
              <li>
                <a
                  href="https://instagram.com/allaround.co.il/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex text-[15px] font-regular items-center gap-2 hover:opacity-80 transition"
                >
                  <InstagramIcon className="h-5 w-5" />
                  Instagram
                </a>
              </li>
              <li>
                <a
                  href="https://facebook.com/allaround.co.il/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex text-[15px] font-regular items-center gap-2 hover:opacity-80 transition"
                >
                  <FacebookIcon className="h-5 w-5" />
                  Facebook
                </a>
              </li>
              <li>
                <a
                  href="https://tiktok.com/allaround.co.il/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex text-[15px] font-regular items-center gap-2 hover:opacity-80 transition"
                >
                  <TikTokIcon className="h-5 w-5" />
                  TikTok
                </a>
              </li>
            </ul>
          </div>
        </div>

        {/* Divider + Bottom Row */}
        <div className="mt-10 border-t border-gray-300 pt-6 flex flex-col md:flex-row items-center justify-center gap-3">
          <p className="text-sm">© {new Date().getFullYear()} Allaround. כל הזכויות שמורות.</p>
        </div>
      </div>
    </footer>
  );
}

/* ====== Icons (solid color) ====== */

function WhatsAppIcon({ className = '' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M20.52 3.48A11.8 11.8 0 0 0 12.06 0C5.74 0 .58 5.16.58 11.49c0 2.02.53 3.99 1.54 5.72L0 24l6.95-2.06a11.43 11.43 0 0 0 5.11 1.24h.01c6.32 0 11.48-5.16 11.48-11.49 0-3.06-1.19-5.94-3.03-8.21Z" />
    </svg>
  );
}

function EmailIcon({ className = '' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 13.2 1.5 6.75V18A2.25 2.25 0 0 0 3.75 20.25h16.5A2.25 2.25 0 0 0 22.5 18V6.75L12 13.2Z" />
      <path d="M22.5 6.75v-.75A2.25 2.25 0 0 0 20.25 3.75H3.75A2.25 2.25 0 0 0 1.5 6v.75L12 13.2 22.5 6.75Z" />
    </svg>
  );
}

function LocationIcon({ className = '' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2a7 7 0 0 0-7 7c0 5.25 7 13 7 13s7-7.75 7-13a7 7 0 0 0-7-7Zm0 9.5a2.5 2.5 0 1 1 0-5 2.5 2.5 0 0 1 0 5Z" />
    </svg>
  );
}

function InstagramIcon({ className = '' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M7 2h10a5 5 0 0 1 5 5v10a5 5 0 0 1-5 5H7a5 5 0 0 1-5-5V7a5 5 0 0 1 5-5Zm5 5.5A4.5 4.5 0 1 0 16.5 12 4.51 4.51 0 0 0 12 7.5Zm6.25-.75a1.25 1.25 0 1 0 1.25 1.25A1.25 1.25 0 0 0 18.25 6.75ZM12 9a3 3 0 1 1-3 3 3 3 0 0 1 3-3Z" />
    </svg>
  );
}

function FacebookIcon({ className = '' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2.04C6.5 2.04 2 6.54 2 12.04c0 5 3.66 9.14 8.44 9.88v-6.99H7.9v-2.89h2.54V9.41c0-2.5 1.49-3.89 3.77-3.89 1.09 0 2.22.2 2.22.2v2.44h-1.25c-1.23 0-1.61.76-1.61 1.54v1.84h2.74l-.44 2.89h-2.3v6.99C18.34 21.18 22 17.04 22 12.04c0-5.5-4.5-10-10-10Z" />
    </svg>
  );
}

function TikTokIcon({ className = '' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12.5 2h3.09c.3 2.1 1.56 3.78 3.94 4.6A8.7 8.7 0 0 0 19.53 9c-2.03-.22-3.56-1.06-4.54-2.36l.02 6.88c0 3.54-2.88 6.41-6.43 6.41A6.42 6.42 0 0 1 2.2 13.5c.1-3.38 2.9-6.11 6.29-6.11.65 0 1.28.11 1.87.31v3.4a3.13 3.13 0 0 0-1.87-.61 3.15 3.15 0 1 0 0 6.29 3.15 3.15 0 0 0 3.14-3.14L11.6 2.9c.3-.6.6-.9.9-.9Z" />
    </svg>
  );
}
