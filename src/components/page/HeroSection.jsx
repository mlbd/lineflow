// src/components/page/HeroSection.jsx
import Image from 'next/image';

export default function HeroSection({ company }) {
  const { name, description, logo } = company;
  return (
    <section className="relative w-full flex py-16 justify-center overflow-hidden">
      <div
        className="absolute inset-0 bg-[url('/hero-bg.svg')] bg-cover bg-center"
        aria-hidden="true"
      />
      <div
        className="absolute inset-0 bg-[url('/hero-overlay.svg')] bg-cover bg-bottom-left"
        // style={{
        //   background:
        //     'radial-gradient(circle at center, rgba(255,255,255,1) 0%, rgba(255,255,255,0.8) 36%, rgba(255,255,255,0.2) 66%, rgba(13,0,113,0.7) 100%)',
        // }}
        aria-hidden="true"
      />

      <div className="relative z-10 max-w-[var(--site-max-width)] w-full flex flex-col md:flex-row items-center justify-center gap-8 px-4 py-20 md:py-20">
        {/* left: Title and Content */}
        <div className="flex-2 hidden text-center md:text-left">
          <h1 className="text-[40px] md:text-4xl text-white font-extrabold mb-4 flex items-center gap-2">
            Hi, {name}
            <Image
              src="/verified.png"
              alt="Verified"
              width={30}
              height={30}
              className="inline-block h-[30px] w-[30px]"
              priority
            />
          </h1>

          {description && (
            <p className="text-lg text-white/90 md:text-left max-w-xl leading-relaxed">
              {description}
            </p>
          )}
        </div>

        {/* right: Logo */}
        <div className="flex-1 flex justify-center mb-6 md:mb-0">
          {logo && (
            <Image
              src={logo}
              alt={name}
              width={400}
              height={120}
              className="w-auto h-[120px] object-cover object-center"
              loading="lazy"
              unoptimized // Remove if the logo domain is whitelisted in next.config.js
            />
          )}
        </div>
      </div>
    </section>
  );
}
