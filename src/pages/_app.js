// src/pages/_app.js
import { Heebo } from 'next/font/google';
import '@/app/globals.css';

const heebo = Heebo({
  subsets: ['latin'],
  weight: ['300', '400', '500', '700'],
  display: 'swap',
});

export default function MyApp({ Component, pageProps }) {
  return (
    <div className={`${heebo.className}`}>
      <Component {...pageProps} />
    </div>
  );
}
