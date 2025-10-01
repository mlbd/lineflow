import React from 'react';

function VideoInstructions() {
  return (
    <>
      <div className="w-full bg-grey-100">
        <div className="container mx-auto">
          <div className="self-stretch py-20 relative flex flex-col justify-center items-center max-w-90% md:max-w-[1400px] mx-auto">
            <div className="relative">
              <img src="/mac-hero.png" className="max-w-full h-auto block" />
              <div className="absolute top-0 left-0 w-full h-full overflow-hidden flex items-center justify-center">
                <div className="size-40 relative -top-[16px] opacity-80 rounded-full bg-secondary bg-[url('/play-button.png')] bg-[length:70px_70px] bg-center bg-no-repeat hover:bg-tertiary cursor-pointer"></div>
              </div>
            </div>
            <div
              data-icon-left="false"
              data-property-1="Prominent"
              className="size- px-12 py-[26px] bg-grad-2 bg-no-repeat bg-cover rounded-[100px] shadow-[4px_4px_10px_0px_rgba(13,0,113,0.16)] shadow-[0px_0px_20px_0px_rgba(138,56,245,0.40)] outline outline-2  outline-tertiary inline-flex justify-center items-center gap-1.5"
            >
              <div className="justify-start text-white text-xl font-semibold leading-7">
                Generate Your Own Merch Catalog Now
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

export default VideoInstructions;
