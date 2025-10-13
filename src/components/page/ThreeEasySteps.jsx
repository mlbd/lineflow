import Image from 'next/image';


export default function ThreeEasySteps() {
  return (
    <>
      {/* How it works */}
      <section className="container mx-auto py-20">
        {/* TOP: three visual cards */}
        <div className="grid gap-4 md:gap-6 md:grid-cols-3">
          {/* Card 1 */}
          <div className="relative overflow-hidden rounded-[24px]">
            <Image
              src="/images/affiliate/step1.png" // replace
              alt="Refer friends, get rewards"
              width={520}
              height={325}
              className="h-auto w-full rounded-[18px]"
              priority
            />
          </div>

          {/* Card 2 (gradient) */}
          <div className="relative overflow-hidden rounded-[24px]">
            <Image
              src="/images/affiliate/step2.png" // replace
              alt="Upload your logo, get catalog instantly"
              width={520}
              height={325}
              className="h-auto w-full rounded-[18px] shadow-[0_10px_40px_rgba(0,0,0,0.25)]"
            />
          </div>

          {/* Card 3 */}
          <div className="relative overflow-hidden rounded-[24px]">
            <Image
              src="/images/affiliate/step3.png" // replace
              alt="Rewards"
              width={520}
              height={325}
              className="h-auto w-full rounded-[18px]"
            />
          </div>
        </div>

        {/* BOTTOM: three step cards */}
        <div className="mt-4 grid gap-4 md:mt-6 md:gap-6 md:grid-cols-3">
          <StepCard
            step="STEP 1"
            title="Share a referral link"
            desc="Copy your referral link by clicking the copy icon, then share it with anyone."
            icon={
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
                <path
                  d="M15 7a3 3 0 1 0-2.83-4H12A3 3 0 1 0 15 7ZM6 14a3 3 0 1 0 3 3H9A3 3 0 0 0 6 14Zm9-8-6 3m6 6-6-3"
                  stroke="currentColor"
                  strokeWidth="1.7"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            }
          />

          <StepCard
            step="STEP 2"
            title="Someone sign up"
            desc="When someone clicks on your link and uses our services, your referral is a success."
            icon={
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
                <path
                  d="M6 4l6 14 2-6 6-2L6 4Z"
                  stroke="currentColor"
                  strokeWidth="1.7"
                  strokeLinejoin="round"
                />
              </svg>
            }
          />

          <StepCard
            step="STEP 3"
            title="Get your rewards"
            desc="Receive your earnings directly to your account. View and manage your rewards any time."
            icon={
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
                <path
                  d="M3 12h18v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-8Zm0-4h18v4H3v-4Zm9 0v14"
                  stroke="currentColor"
                  strokeWidth="1.7"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path
                  d="M12 8s-1.5-4-4-4S4 6 4 8h8Zm0 0s1.5-4 4-4 4 2 4 4h-8Z"
                  stroke="currentColor"
                  strokeWidth="1.7"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            }
          />
        </div>
      </section>
    </>
  );
}

function StepCard({ step = 'STEP 1', title, desc, icon }) {
  return (
    <div className="rounded-[24px] bg-white p-6 md:p-7 shadow-[0_12px_32px_rgba(16,24,40,0.08)] ring-1 ring-black/5">
      {/* 2-col grid: [icon | text]; description sits under the text col */}
      <div className="grid grid-cols-[3.5rem_1fr] gap-x-5">
        {/* Icon */}
        <div className="col-start-1 row-start-1">
          <div className="inline-flex rounded-[14px] p-[2px] shadow-[0_8px_24px_rgba(13,0,113,0.25)]">
            <div className="grid h-14 w-14 place-items-center rounded-[12px] bg-[linear-gradient(180deg,#0D0071_0%,#7C7ACF_100%)]">
              <div className="text-white">{icon}</div>
            </div>
          </div>
        </div>

        {/* Step + Title (aligned with icon) */}
        <div className="col-start-2 row-start-1">
          <p className="text-xs font-semibold tracking-wide text-[#6E6E6E]">{step}</p>
          <h3 className="mt-1 text-[22px] font-semibold leading-snug text-[#1F1F1F]">{title}</h3>
        </div>
      </div>
      {/* Description starts under the title column */}
      <p className="col-start-2 row-start-2 mt-4 text-[15px] leading-6 text-[#626262]">{desc}</p>
    </div>
  );
}
