// src/components/page/InfoBoxSection.jsx
import Image from 'next/image';

const defaultBoxes = [
  {
    icon: '/device-mini.svg',
    title: 'Here for You',
    text: 'For any question, concern, or advice, we are happy to help with anything. Available in various ways: phone, email, and of course WhatsApp.',
  },
  {
    icon: '/rocket-mini.svg',
    title: 'Fast Shipping',
    text: 'Within 2-5 business days and your order is with you! Express shipping by UPS, the highest level of delivery service.',
  },
  {
    icon: '/hand-mini.svg',
    title: 'Simple and Fast',
    text: 'We created a personal system for you so that with just a few simple clicks you can place an order and upgrade your business, all in just a few minutes.',
  },
];

// Props: infoBoxes (optional), falls back to defaultBoxes
export default function InfoBoxSection({ infoBoxes = defaultBoxes }) {
  return (
    <section className="w-full py-[50px] flex justify-center bg-[#f1f1f1]">
      <div className="max-w-[var(--site-max-width)] w-full grid grid-cols-1 md:grid-cols-3 gap-6 px-4">
        {infoBoxes.map((box, i) => (
          <div key={i} className="flex flex-col items-center">
            <div className="flex items-center justify-center h-[70px] w-[70px] mb-4">
              <Image
                src={box.icon}
                alt={box.title}
                width={70}
                height={70}
                className="w-full h-auto max-w-[70px] max-h-[70px]"
                loading="lazy"
                unoptimized // Remove if local images and using next/image static optimization
              />
            </div>
            <h3 className="text-xl font-bold mb-2 text-center">{box.title}</h3>
            <p className="text-sm font-normal text-center">{box.text}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
