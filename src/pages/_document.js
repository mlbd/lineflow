// src/pages/_document.js
import { Html, Head, Main, NextScript } from 'next/document';

export default function Document() {
  const isRTL = true; // Your RTL logic

  return (
    <Html lang="en" dir={isRTL ? "rtl" : "ltr"}>
      <Head />
      <body className="antialiased">
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}