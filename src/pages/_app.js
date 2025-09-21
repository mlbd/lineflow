// src/pages/_app.js
import { Figtree } from 'next/font/google';
import '@/app/globals.css';

const figtree = Figtree({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700'],
  display: 'swap',
});

export default function MyApp({ Component, pageProps }) {
  return (
    <div className={`${figtree.className}`}>
      <Component {...pageProps} />
    </div>
  );
}
