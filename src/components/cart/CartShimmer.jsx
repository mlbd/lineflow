'use client';
import clsx from 'clsx';

export default function CartShimmer({ itemCount = 3 }) {
  return (
    <div className="w-full animate-pulse top-0 left-0 z-1">
      <div className="max-w-[900px] mx-auto w-full">
        <div className="container mx-auto py-2 px-4">
          <div className="flex flex-col md:flex-row gap-8 items-start">
            <div className="md:w-[70%] w-full">
              <div className="h-[58px] bg-gray-50 border border-gray-200 rounded-lg mb-4"></div>
              <div className="relative">
                <div className="md:col-span-2 space-y-4">
                  {[...Array(itemCount)].map((_, idx) => (
                    <div
                      key={idx}
                      className="grid grid-cols-7 gap-4 px-4 py-[25px] border border-gray-200 rounded-lg bg-white items-center"
                    >
                      <div className="h-[60px] w-[60px] bg-gray-200 rounded" />
                      <div className="col-span-2 h-4 bg-gray-200 rounded w-3/4" />
                      <div className="h-4 bg-gray-200 rounded w-1/2" />
                      <div className="h-8 bg-gray-200 rounded w-16" />
                      <div className="h-4 bg-gray-200 rounded w-1/2" />
                      <div className="h-8 w-8 bg-gray-200 rounded-full" />
                    </div>
                  ))}
                </div>
                <div className="relative mt-4">
                  <div className="h-[76px] mb-6 bg-gray-200"></div>
                </div>
              </div>
            </div>
            <div className="md:w-[30%] min-w-[260px] max-w-[370px] w-full sticky top-8 self-start">
              <div className="space-y-6 shadow-md rounded-2xl bg-white p-6">
                <div className="h-[30px] bg-gray-200"></div>
                <div className="flex mt-[45px] flex-col gap-3">
                  <div className="h-[74px] bg-gray-200"></div>
                  <div className="h-[74px] bg-gray-200"></div>
                </div>
                <div className="space-y-4 mt-1">
                  <div className="flex flex-col gap-2 justify-center w-full text-center">
                    <div className="w-[58px] h-[32px] bg-gray-200 block m-auto"></div>
                    <div className="w-[110px] h-[32px] bg-gray-200 block m-auto"></div>
                    <div className="w-[80%] h-[48px] bg-gray-200 m-auto mt-[7px] block"></div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
