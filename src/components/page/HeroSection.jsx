// src/components/page/HeroSection.jsx
import Image from 'next/image';

export default function HeroSection({
  company,
  title,
  subtitle,
  logo,
}) {
  const isCompanyMode = company && typeof company === 'object';
  const resolvedTitle = isCompanyMode ? company.name || '' : title || '';
  const resolvedSubtitle = isCompanyMode ? company.description || '' : subtitle || '';

  const resolvedLogo = typeof logo !== 'undefined' ? logo : (company?.logo ?? undefined);

  return (
    <section className="relative w-full flex py-16 justify-center overflow-hidden">
      <div
        className="absolute inset-0 bg-[url('/hero-bg.svg')] bg-cover bg-center"
        aria-hidden="true"
      />
      <div
        className="absolute inset-0 bg-[url('/hero-overlay.svg')] bg-cover bg-bottom-left"
        aria-hidden="true"
      />

      <div className="relative z-10 max-w-[var(--site-max-width)] w-full flex flex-col md:flex-row items-center justify-center gap-8 px-4 py-20 md:py-20">
        <div className="flex-1 flex justify-center mb-6 md:mb-0">
          {resolvedLogo && isCompanyMode ? (
            <Image
              src={resolvedLogo}
              alt={resolvedTitle || 'Logo'}
              width={400}
              height={120}
              className="w-auto h-[120px] object-cover object-center"
              loading="lazy"
              unoptimized
            />
          ) : (
            <h1 className="text-[40px] md:text-4xl text-primary font-bold mb-4 flex items-center gap-6">
              {resolvedTitle}
            </h1>
          )}

          {/* {resolvedSubtitle && (
            <p className="text-lg text-white/90 md:text-left max-w-xl leading-relaxed">
              {resolvedSubtitle}
            </p>
          )} */}
        </div>
      </div>
    </section>
  );
}
