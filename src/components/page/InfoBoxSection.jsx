// src/components/page/InfoBoxSection.jsx
import Image from 'next/image';

const defaultBoxes = [
  {
    icon: '/device-mini.svg',
    title: 'Here For You',
    text: 'We’re happy to help via phone, email, or WhatsApp for any concerns.',
  },
  {
    icon: '/rocket-mini.svg',
    title: 'Fast Shipping',
    text: 'Express shipping by UPS; your order arrives in 2–5 business days!',
  },
  {
    icon: '/hand-mini.svg',
    title: 'Simple and Fast',
    text: 'Only a few clicks to place orders and upgrade your business.',
  },
];

export default function InfoBoxSection({ infoBoxes = defaultBoxes }) {
  return (
    <section className="w-full flex justify-center">
      <div className="relative container mx-auto">
        <div className="relative z-[1] rounded-3xl -mt-12 bg-white p-5 md:p-7 lg:p-8 shadow-[0_12px_28px_rgba(16,24,40,0.12)] ring-1 ring-black/5">
          <div className="grid grid-cols-1 gap-6 md:grid-cols-3 md:gap-4">
            {infoBoxes.map((box, i) => (
              <div key={i} className="flex items-start gap-4 md:gap-5">
                {/* purple gradient icon tile */}
                <div
                  className="flex-none shrink-0 size-16 rounded-2xl
                  bg-gradient-to-b from-primary-500 to-primary-500/45
                  shadow-[0_10px_22px_rgba(27,15,126,0.35)] ring-1 ring-black
                  grid place-items-center"
                >
                  <Image
                    src={box.icon}
                    alt=""
                    width={40}
                    height={40}
                    className="h-8 w-8"
                    loading="lazy"
                    unoptimized
                    aria-hidden="true"
                  />
                </div>

                {/* text block */}
                <div className="pt-1">
                  <h3 className="text-[15px] font-semibold text-gray-900">{box.title}</h3>
                  <p className="mt-1 text-sm leading-6 text-gray-600">{box.text}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
