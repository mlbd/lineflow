
function CallToAction() {
  return (
    <>
      <div className="w-full pt-[80px]">
        <div className="container mx-auto">
          <div className="flex items-center bg-[url('/cta-gradient.png')] bg-no-repeat bg-cover bg-center rounded-2xl">
            <div className="flex-1 px-10">
              <div className="relative md:max-w-[90%] pl-[8%]">
                <h2 className="text-white typo-h2 font-bold mb-5">Ready to See Your Catalog?</h2>
                <p className="text-white">
                  Upload your logo today and get a personalized catalog of branded products — fast,
                  simple, and made for your business.
                </p>

                <div className="flex gap-5 pt-10">
                  <button
                    type="button"
                    className="cursor-pointer px-8 py-4 bg-white hover:bg-tertiary hover:text-white rounded-[100px] shadow-[4px_4px_10px_0px_rgba(13,0,113,0.16)] text-tertiary text-base font-semibold leading-snug"
                  >
                    Upload My Logo
                  </button>
                  <button
                    type="button"
                    className="cursor-pointer px-8 py-4 border border-white rounded-[100px] text-white hover:bg-white hover:text-tertiary text-base font-semibold leading-snug"
                  >
                    See How It Works
                  </button>
                </div>
              </div>
            </div>

            <div className="basis-5/12 flex items-center justify-center">
              <img src="/cta-thumb.png" alt="Call To Action" className="max-w-full h-auto" />
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

export default CallToAction;
