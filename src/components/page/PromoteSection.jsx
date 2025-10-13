
export default function PromoteSection() {
  return (
    <section className="relative container mx-auto overflow-hidden rounded-[28px] bg-[#F6F8FB] py-20">
        {/* subtle bg shape/watermark (bottom-left) */}
        <div className="pointer-events-none absolute -left-24 bottom-[-40px] h-[420px] w-[520px] opacity-[0.12]">
          {/* replace with your watermark image if you have one */}
          <div className="h-full w-full rounded-[40px] bg-[radial-gradient(70%_70%_at_50%_50%,_#000_0%,_#000_30%,_transparent_70%)]" />
        </div>

        <div className="relative grid gap-8 p-6 md:grid-cols-12 md:gap-10 md:p-12 lg:p-16">
          {/* Left column */}
          <div className="md:col-span-5 flex flex-col justify-center">
            <h2 className="text-[34px] leading-[1.1] font-bold text-[#1A1A1A] md:text-[44px] lg:text-[48px]">
              What Can You
              <br />
              <span className="text-[#0D0071]">Promote?</span>
            </h2>

            <button className="mt-8 self-start inline-flex w-auto items-center justify-center rounded-full bg-[#0D0071] px-6 py-3 text-sm text-white shadow-[0_10px_24px_rgba(13,0,113,0.28)] transition hover:opacity-95 active:translate-y-[1px]">
              Join Affiliate Now
            </button>
          </div>

          {/* Right cards */}
          <div className="md:col-span-7 grid grid-cols-1 gap-6 md:grid-cols-2">
            <PromoCard
              title="Promote Our Main Site"
              desc="Earn a 10% commission for each new client who successfully creates a catalog through your unique referral link."
              icon={<MainSiteIcon />}
            />
            <PromoCard
              title="Create Catalog"
              desc="Earn a 10% commission on each sale made through the catalogs you generate for any possible business."
              icon={<CatalogIcon />}
            />
          </div>
        </div>
      
    </section>
  );
}

function PromoCard({ title, desc, icon }) {
  return (
    <div className="rounded-[22px] bg-white p-6 shadow-[0_8px_30px_rgba(16,24,40,0.08)] ring-1 ring-black/5">
      <div className="mb-4 inline-flex rounded-2xl p-[2px] shadow-[0_8px_24px_rgba(13,0,113,0.25)]">
        <div className="grid h-16 w-16 place-items-center rounded-2xl bg-[linear-gradient(180deg,#0D0071_0%,#7C7ACF_100%)]">
          <div className="text-white">{icon}</div>
        </div>
      </div>

      <h3 className="text-[20px] font-semibold leading-tight text-[#222]">{title}</h3>
      <p className="mt-2 text-[15px] leading-6 text-[#5A5A5A]">{desc}</p>
    </div>
  );
}

/* --------- Minimal inline icons (replace with your SVGs if you have files) --------- */
function MainSiteIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" className="opacity-95">
      <rect x="3" y="5" width="18" height="12" rx="2" stroke="currentColor" strokeWidth="1.6" />
      <path d="M3 9h18" stroke="currentColor" strokeWidth="1.6" />
      <circle cx="7" cy="7" r="0.9" fill="currentColor" />
      <circle cx="10" cy="7" r="0.9" fill="currentColor" />
      <circle cx="13" cy="7" r="0.9" fill="currentColor" />
      <path d="M9 13h6M9 11h8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function CatalogIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" className="opacity-95">
      <rect x="4" y="4" width="16" height="16" rx="2" stroke="currentColor" strokeWidth="1.6" />
      <path
        d="M7 8h10M7 11h7M7 14h10"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <path
        d="M16.5 17.5l1.7-1.7M18.2 17.5l-1.7-1.7"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}
