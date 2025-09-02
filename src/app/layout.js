import { Heebo } from 'next/font/google';
import { GoogleTagManager } from '@next/third-parties/google';
import './globals.css';

const heebo = Heebo({ subsets: ['latin'], weight: ['400', '500', '700'] });

export const metadata = {
  title: 'Placement Editor | Mockup Generator for AllAround',
  description:
    'Easily define and edit mockup placement areas to generate customized product previews.',
};

export default function RootLayout({ children }) {
  // Dynamically choose direction; hardcoded RTL for demo:
  const isRTL = true; // Replace with language/company logic as needed

  return (
    <html lang="en">
      <body className={`${heebo.className} antialiased`}>
        <GoogleTagManager gtmId={process.env.NEXT_PUBLIC_GTM_ID} />
        {children}
      </body>
    </html>
  );
}
