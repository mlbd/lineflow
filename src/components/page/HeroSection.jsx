// src/components/page/HeroSection.jsx


export default function HeroSection({ company }) {
  const { name, description, logo } = company;
  return (
    <section className="w-full py-13 flex justify-center bg-skyblue">
      <div className="max-w-[var(--site-max-width)] w-full flex flex-col md:flex-row items-center gap-8 px-4">
        {/* left: Title and Content */}
        <div className="flex-2 text-center md:text-right">
          <h1 className="text-[40px] flex gap items-center md:text-4xl text-white font-extrabold mb-4">היי, {name} <img src="/verified.png" alt="Verified" className="h-[30px] w-[30px] mr-2" /></h1>
          {description && <p className="text-lg text-white">{description}</p>}
        </div>

        {/* right: Logo */}
        <div className="flex-1 flex justify-end mb-6 md:mb-0">
          {logo && (
            <img
              src={logo}
              alt={name}
              className="w-full h-auto max-w-[280px] max-h-[140px] object-contain object-left"
              loading="lazy"
            />
          )}
        </div>
      </div>
    </section>
  );
}
