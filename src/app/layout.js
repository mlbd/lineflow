import { Heebo } from 'next/font/google';
import './globals.css';

const heebo = Heebo({ subsets: ["latin"], weight: ["400", "500", "700"] });

export const metadata = {
  title: 'Placement Editor | Mockup Generator for AllAround',
  description:
    'Easily define and edit mockup placement areas to generate customized product previews.',
};

export default function RootLayout({ children }) {
  // Dynamically choose direction; hardcoded RTL for demo:
  const isRTL = true; // Replace with language/company logic as needed

  return (
    <html lang="en" dir={isRTL ? "rtl" : "ltr"}>
      <body className={`${heebo.className} antialiased`}>{children}</body>
    </html>
  );
}
