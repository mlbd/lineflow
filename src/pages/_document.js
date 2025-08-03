// src/pages/_document.js
import { Html, Head, Main, NextScript } from 'next/document';
import { GoogleTagManager } from '@next/third-parties/google';

export default function Document() {
  const isRTL = true; // Your RTL logic

  return (
    <Html lang="en" dir={isRTL ? 'rtl' : 'ltr'}>
      <Head />
      <body className="antialiased">
        <GoogleTagManager gtmId={process.env.NEXT_PUBLIC_GTM_ID} />
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
