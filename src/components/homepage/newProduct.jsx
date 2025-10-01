import React from 'react';

function NewProducts() {
  return (
    <>
      <div className=" p-20 bg-white flex flex-col justify-start items-start gap-[45px] overflow-hidden">
        <div className="self-stretch inline-flex justify-between items-start">
          <div className="text-center justify-start text-secondary text-5xl font-bold">
            {' '}
            Our <span className="text-tertiary">Sample</span> NewProducts
          </div>
        </div>
        <div className="self-stretch flex flex-col justify-start items-start gap-10">
          <div className="self-stretch inline-flex justify-between items-center">
            <div className=" p-2.5 bg-primary-100 rounded-[100px] flex justify-start items-center">
              <div className="size- px-6 py-3 bg-white rounded-[100px] flex justify-center items-center gap-1.5">
                <div className="justify-start text-tertiary text-base font-semibold leading-snug">
                  All Products
                </div>
              </div>
              <div className="size- px-6 py-3 bg-primary-100 rounded-[100px] flex justify-center items-center gap-1.5">
                <div className="justify-start text-[#4b4b4b] text-base font-semibold leading-snug">
                  To the Office
                </div>
              </div>
              <div className="size- px-6 py-3 bg-primary-100 rounded-[100px] flex justify-center items-center gap-1.5">
                <div className="justify-start text-[#4b4b4b] text-base font-semibold leading-snug">
                  Hats
                </div>
              </div>
              <div className="size- px-6 py-3 bg-primary-100 rounded-[100px] flex justify-center items-center gap-1.5">
                <div className="justify-start text-[#4b4b4b] text-base font-semibold leading-snug">
                  Clothing
                </div>
              </div>
              <div className="size- px-6 py-3 bg-primary-100 rounded-[100px] flex justify-center items-center gap-1.5">
                <div className="justify-start text-[#4b4b4b] text-base font-semibold leading-snug">
                  Others
                </div>
              </div>
              <div className="size- px-6 py-3 bg-primary-100 rounded-[100px] flex justify-center items-center gap-1.5">
                <div className="justify-start text-[#4b4b4b] text-base font-semibold leading-snug">
                  Everything
                </div>
              </div>
            </div>
          </div>
          <div className="self-stretch flex flex-col justify-center items-start gap-12">
            <div className="self-stretch inline-flex justify-start items-center gap-12">
              <div
                data-property-1="Default"
                data-show-badge="true"
                data-show-min-order="true"
                className="flex-1 inline-flex flex-col justify-start items-end gap-4"
              >
                <div className="self-stretch bg-gray-50 rounded-2xl flex flex-col justify-start items-end gap-2.5">
                  <div className="self-stretch  rounded-2xl flex flex-col justify-start items-end gap-2.5">
                    <div
                      data-type="Best Seller"
                      className="size- px-3 py-1.5 bg-[#1e8b6c] rounded-tr-2xl rounded-bl-2xl shadow-[-2px_4px_6px_0px_rgba(0,0,0,0.08)] inline-flex justify-center items-center gap-1"
                    >
                      <div className="size-4 relative overflow-hidden">
                        <div className="size-4 left-0 top-0 absolute"></div>
                        <div className="  left-[2.50px] top-[0.50px] absolute bg-white"></div>
                      </div>
                      <div className="justify-start text-white text-base font-normal leading-snug">
                        Best Seller
                      </div>
                    </div>
                  </div>
                </div>
                <div className="self-stretch flex flex-col justify-start items-start gap-[30px]">
                  <div className="self-stretch flex flex-col justify-start items-start gap-3">
                    <div className="self-stretch justify-start text-secondary text-2xl font-semibold ">
                      Cotton Polo Shirt
                    </div>
                    <div className="self-stretch relative flex flex-col justify-start items-start gap-[7px]">
                      <div className="self-stretch justify-start">
                        <span className="text-[#4b4b4b] text-base font-normal leading-snug">
                          Made from a standard fabric composition of 65% cotton and 35% polyester
                          with your...{' '}
                        </span>
                        <span className="text-tertiary text-base font-bold leading-snug">
                          Show More
                        </span>
                      </div>
                      <div
                        data-icon="false"
                        data-property-1="Without Outline"
                        className="size- left-[271px] top-[22px] absolute inline-flex justify-start items-center gap-[5px]"
                      >
                        <div className="justify-start"></div>
                      </div>
                    </div>
                    <div className="h-11 p-1.5 bg-white rounded-lg inline-flex justify-start items-center gap-[5px]">
                      <div
                        data-property-1="Selected Blue"
                        className="size-8 p-[3px] relative rounded-[5px] outline outline-1  outline-tertiary flex justify-start items-center gap-2.5"
                      >
                        <div className="flex-1 self-stretch bg-white rounded-[3px] border-[0.50px] border-secondary"></div>
                        <div className="size-4 left-[8px] top-[8px] absolute overflow-hidden">
                          <div className="size-[13px] left-[1.50px] top-[1.50px] absolute bg-tertiary"></div>
                        </div>
                      </div>
                      <div
                        data-property-1="Default"
                        className="size-8 p-0.5 rounded-[5px] outline outline-1  outline-grey-300 flex justify-start items-center gap-2.5"
                      >
                        <div className="flex-1 self-stretch bg-[#dddddd] rounded-[3px]"></div>
                      </div>
                      <div
                        data-property-1="Default"
                        className="size-8 p-0.5 rounded-[5px] outline outline-1  outline-grey-300 flex justify-start items-center gap-2.5"
                      >
                        <div className="flex-1 self-stretch bg-secondary rounded-[3px]"></div>
                      </div>
                    </div>
                  </div>
                  <div className="self-stretch inline-flex justify-between items-center">
                    <div className="size- inline-flex flex-col justify-start items-start gap-1">
                      <div className="self-stretch justify-start text-[#4b4b4b] text-base font-normal leading-snug">
                        As Low As
                      </div>
                      <div className="self-stretch justify-start text-tertiary text-2xl font-bold ">
                        $38.00{' '}
                      </div>
                    </div>
                    <div className="size- inline-flex flex-col justify-start items-start gap-0.5">
                      <div className="self-stretch justify-start text-[#4b4b4b] text-base font-normal leading-snug">
                        Min. Order
                      </div>
                      <div className="self-stretch justify-start text-tertiary text-base font-bold leading-snug">
                        50 pcs
                      </div>
                    </div>
                    <div
                      data-icon-left="false"
                      data-property-1="Fill Small"
                      className="size- px-6 py-3 bg-tertiary rounded-[100px] shadow-[4px_4px_10px_0px_rgba(13,0,113,0.16)] flex justify-center items-center gap-1.5"
                    >
                      <div className="justify-start text-white text-base font-semibold leading-snug">
                        More Info
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <div
                data-property-1="Default"
                data-show-badge="true"
                data-show-min-order="false"
                className="flex-1 inline-flex flex-col justify-start items-end gap-4"
              >
                <div className="self-stretch bg-gray-50 rounded-2xl flex flex-col justify-start items-end gap-2.5">
                  <div className="self-stretch  rounded-2xl flex flex-col justify-start items-end gap-2.5">
                    <div
                      data-type="No Minimum"
                      className="size- px-3 py-1.5 bg-[#14b1bf] rounded-tr-2xl rounded-bl-2xl shadow-[-2px_4px_6px_0px_rgba(0,0,0,0.08)] inline-flex justify-center items-center gap-1"
                    >
                      <div className="size-4 relative overflow-hidden">
                        <div className="size-4 left-0 top-0 absolute"></div>
                        <div className="  left-[1.50px] top-[2.50px] absolute bg-white"></div>
                      </div>
                      <div className="justify-start text-white text-base font-normal leading-snug">
                        No Minimum
                      </div>
                    </div>
                  </div>
                </div>
                <div className="self-stretch flex flex-col justify-start items-start gap-[30px]">
                  <div className="self-stretch flex flex-col justify-start items-start gap-3">
                    <div className="self-stretch justify-start text-secondary text-2xl font-semibold ">
                      Fancy Peaked Cap
                    </div>
                    <div className="self-stretch relative flex flex-col justify-start items-start gap-[7px]">
                      <div className="self-stretch justify-start">
                        <span className="text-[#4b4b4b] text-base font-normal leading-snug">
                          Made from a standard fabric composition of 65% cotton and 35% polyester
                          with your...{' '}
                        </span>
                        <span className="text-tertiary text-base font-bold leading-snug">
                          Show More
                        </span>
                      </div>
                      <div
                        data-icon="false"
                        data-property-1="Without Outline"
                        className="size- left-[271px] top-[22px] absolute inline-flex justify-start items-center gap-[5px]"
                      >
                        <div className="justify-start"></div>
                      </div>
                    </div>
                    <div className="h-11 p-1.5 bg-white rounded-lg inline-flex justify-start items-center gap-[5px]">
                      <div
                        data-property-1="Default"
                        className="size-8 p-0.5 rounded-[5px] outline outline-1  outline-grey-300 flex justify-start items-center gap-2.5"
                      >
                        <div className="flex-1 self-stretch bg-tertiary rounded-[3px]"></div>
                      </div>
                      <div
                        data-property-1="Selected"
                        className="size-8 p-[3px] relative rounded-[5px] outline outline-1  outline-tertiary flex justify-start items-center gap-2.5"
                      >
                        <div className="flex-1 self-stretch bg-secondary rounded-[3px]"></div>
                        <div className="size-4 left-[8px] top-[8px] absolute overflow-hidden">
                          <div className="size-[13px] left-[1.50px] top-[1.50px] absolute bg-white"></div>
                        </div>
                      </div>
                      <div
                        data-property-1="Default"
                        className="size-8 p-0.5 rounded-[5px] outline outline-1  outline-grey-300 flex justify-start items-center gap-2.5"
                      >
                        <div className="flex-1 self-stretch bg-[#c12727] rounded-[3px]"></div>
                      </div>
                    </div>
                  </div>
                  <div className="self-stretch inline-flex justify-between items-center">
                    <div className="size- inline-flex flex-col justify-start items-start gap-1">
                      <div className="self-stretch justify-start text-[#4b4b4b] text-base font-normal leading-snug">
                        As Low As
                      </div>
                      <div className="self-stretch justify-start text-tertiary text-2xl font-bold ">
                        $29.00{' '}
                      </div>
                    </div>
                    <div
                      data-icon-left="false"
                      data-property-1="Fill Small"
                      className="size- px-6 py-3 bg-tertiary rounded-[100px] shadow-[4px_4px_10px_0px_rgba(13,0,113,0.16)] flex justify-center items-center gap-1.5"
                    >
                      <div className="justify-start text-white text-base font-semibold leading-snug">
                        More Info
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <div
                data-property-1="Default"
                data-show-badge="true"
                data-show-min-order="true"
                className="flex-1 inline-flex flex-col justify-start items-end gap-4"
              >
                <div className="self-stretch bg-gray-50 rounded-2xl flex flex-col justify-start items-end gap-2.5">
                  <div className="self-stretch  rounded-2xl flex flex-col justify-start items-end gap-2.5">
                    <div
                      data-type="Newly"
                      className="size- px-3 py-1.5 bg-[#0093d6] rounded-tr-2xl rounded-bl-2xl shadow-[-2px_4px_6px_0px_rgba(0,0,0,0.08)] inline-flex justify-center items-center gap-1"
                    >
                      <div className="size-4 relative overflow-hidden">
                        <div className="size-4 left-0 top-0 absolute"></div>
                        <div className="size-3.5 left-[1px] top-[1px] absolute bg-white"></div>
                      </div>
                      <div className="justify-start text-white text-base font-normal leading-snug">
                        Newly Added
                      </div>
                    </div>
                  </div>
                </div>
                <div className="self-stretch flex flex-col justify-start items-start gap-[30px]">
                  <div className="self-stretch flex flex-col justify-start items-start gap-3">
                    <div className="self-stretch justify-start text-secondary text-2xl font-semibold ">
                      Long Drifit Polo shirt
                    </div>
                    <div className="self-stretch relative flex flex-col justify-start items-start gap-[7px]">
                      <div className="self-stretch justify-start">
                        <span className="text-[#4b4b4b] text-base font-normal leading-snug">
                          Made from a standard fabric composition of 65% cotton and 35% polyester
                          with your...{' '}
                        </span>
                        <span className="text-tertiary text-base font-bold leading-snug">
                          Show More
                        </span>
                      </div>
                      <div
                        data-icon="false"
                        data-property-1="Without Outline"
                        className="size- left-[271px] top-[22px] absolute inline-flex justify-start items-center gap-[5px]"
                      >
                        <div className="justify-start"></div>
                      </div>
                    </div>
                    <div className="h-11 p-1.5 bg-white rounded-lg inline-flex justify-start items-center gap-[5px]">
                      <div
                        data-property-1="Default"
                        className="size-8 p-0.5 rounded-[5px] outline outline-1  outline-grey-300 flex justify-start items-center gap-2.5"
                      >
                        <div className="flex-1 self-stretch bg-[#dddddd] rounded-[3px]"></div>
                      </div>
                      <div
                        data-property-1="Default"
                        className="size-8 p-0.5 rounded-[5px] outline outline-1  outline-grey-300 flex justify-start items-center gap-2.5"
                      >
                        <div className="flex-1 self-stretch bg-white rounded-[3px] border-[0.50px] border-secondary"></div>
                      </div>
                      <div
                        data-property-1="Default"
                        className="size-8 p-0.5 rounded-[5px] outline outline-1  outline-grey-300 flex justify-start items-center gap-2.5"
                      >
                        <div className="flex-1 self-stretch bg-secondary rounded-[3px]"></div>
                      </div>
                      <div
                        data-property-1="Default"
                        className="size-8 p-0.5 rounded-[5px] outline outline-1  outline-grey-300 flex justify-start items-center gap-2.5"
                      >
                        <div className="flex-1 self-stretch bg-tertiary rounded-[3px]"></div>
                      </div>
                      <div
                        data-property-1="Default"
                        className="size-8 p-0.5 rounded-[5px] outline outline-1  outline-grey-300 flex justify-start items-center gap-2.5"
                      >
                        <div className="flex-1 self-stretch bg-[#840202] rounded-[3px]"></div>
                      </div>
                      <div
                        data-property-1="Default"
                        className="size-8 p-0.5 rounded-[5px] outline outline-1  outline-grey-300 flex justify-start items-center gap-2.5"
                      >
                        <div className="flex-1 self-stretch bg-[#699b7e] rounded-[3px]"></div>
                      </div>
                      <div className="justify-start">
                        <span className="text-tertiary text-sm font-normal leading-tight">+16</span>
                        <span className="text-[#4b4b4b] text-sm font-normal leading-tight">
                          {' '}
                          more
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="self-stretch inline-flex justify-between items-center">
                    <div className="size- inline-flex flex-col justify-start items-start gap-1">
                      <div className="self-stretch justify-start text-[#4b4b4b] text-base font-normal leading-snug">
                        As Low As
                      </div>
                      <div className="self-stretch justify-start text-tertiary text-2xl font-bold ">
                        $36.00{' '}
                      </div>
                    </div>
                    <div className="size- inline-flex flex-col justify-start items-start gap-0.5">
                      <div className="self-stretch justify-start text-[#4b4b4b] text-base font-normal leading-snug">
                        Min. Order
                      </div>
                      <div className="self-stretch justify-start text-tertiary text-base font-bold leading-snug">
                        50 pcs
                      </div>
                    </div>
                    <div
                      data-icon-left="false"
                      data-property-1="Fill Small"
                      className="size- px-6 py-3 bg-tertiary rounded-[100px] shadow-[4px_4px_10px_0px_rgba(13,0,113,0.16)] flex justify-center items-center gap-1.5"
                    >
                      <div className="justify-start text-white text-base font-semibold leading-snug">
                        More Info
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div className="self-stretch inline-flex justify-start items-center gap-12">
              <div
                data-property-1="Default"
                data-show-badge="false"
                data-show-min-order="true"
                className="flex-1 inline-flex flex-col justify-start items-end gap-4"
              >
                <div className="self-stretch bg-gray-50 rounded-2xl flex flex-col justify-start items-end gap-2.5">
                  <img
                    className="self-stretch  rounded-2xl flex flex-col justify-start items-end gap-2.5"
                    src="https://placehold.co/395x250"
                  />
                </div>
                <div className="self-stretch flex flex-col justify-start items-start gap-[30px]">
                  <div className="self-stretch flex flex-col justify-start items-start gap-3">
                    <div className="self-stretch justify-start text-secondary text-2xl font-semibold ">
                      Kitchen Apron
                    </div>
                    <div className="self-stretch relative flex flex-col justify-start items-start gap-[7px]">
                      <div className="self-stretch justify-start">
                        <span className="text-[#4b4b4b] text-base font-normal leading-snug">
                          Made from a standard fabric composition of 65% cotton and 35% polyester
                          with your...{' '}
                        </span>
                        <span className="text-tertiary text-base font-bold leading-snug">
                          Show More
                        </span>
                      </div>
                      <div
                        data-icon="false"
                        data-property-1="Without Outline"
                        className="size- left-[271px] top-[22px] absolute inline-flex justify-start items-center gap-[5px]"
                      >
                        <div className="justify-start"></div>
                      </div>
                    </div>
                    <div className="h-11 p-1.5 bg-white rounded-lg inline-flex justify-start items-center gap-[5px]">
                      <div
                        data-property-1="Default"
                        className="size-8 p-0.5 rounded-[5px] outline outline-1  outline-grey-300 flex justify-start items-center gap-2.5"
                      >
                        <div className="flex-1 self-stretch bg-white rounded-[3px] border-[0.50px] border-secondary"></div>
                      </div>
                      <div
                        data-property-1="Default"
                        className="size-8 p-0.5 rounded-[5px] outline outline-1  outline-grey-300 flex justify-start items-center gap-2.5"
                      >
                        <div className="flex-1 self-stretch bg-[#dddddd] rounded-[3px]"></div>
                      </div>
                      <div
                        data-property-1="Selected"
                        className="size-8 p-[3px] relative rounded-[5px] outline outline-1  outline-tertiary flex justify-start items-center gap-2.5"
                      >
                        <div className="flex-1 self-stretch bg-secondary rounded-[3px]"></div>
                        <div className="size-4 left-[8px] top-[8px] absolute overflow-hidden">
                          <div className="size-[13px] left-[1.50px] top-[1.50px] absolute bg-white"></div>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="self-stretch inline-flex justify-between items-center">
                    <div className="size- inline-flex flex-col justify-start items-start gap-1">
                      <div className="self-stretch justify-start text-[#4b4b4b] text-base font-normal leading-snug">
                        As Low As
                      </div>
                      <div className="self-stretch justify-start text-tertiary text-2xl font-bold ">
                        $29.00{' '}
                      </div>
                    </div>
                    <div className="size- inline-flex flex-col justify-start items-start gap-0.5">
                      <div className="self-stretch justify-start text-[#4b4b4b] text-base font-normal leading-snug">
                        Min. Order
                      </div>
                      <div className="self-stretch justify-start text-tertiary text-base font-bold leading-snug">
                        100 pcs
                      </div>
                    </div>
                    <div
                      data-icon-left="false"
                      data-property-1="Fill Small"
                      className="size- px-6 py-3 bg-tertiary rounded-[100px] shadow-[4px_4px_10px_0px_rgba(13,0,113,0.16)] flex justify-center items-center gap-1.5"
                    >
                      <div className="justify-start text-white text-base font-semibold leading-snug">
                        More Info
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <div
                data-property-1="Default"
                data-show-badge="true"
                data-show-min-order="true"
                className="flex-1 inline-flex flex-col justify-start items-end gap-4"
              >
                <div className="self-stretch bg-gray-50 rounded-2xl flex flex-col justify-start items-end gap-2.5">
                  <div className="self-stretch  rounded-2xl flex flex-col justify-start items-end gap-2.5">
                    <div
                      data-type="Newly"
                      className="size- px-3 py-1.5 bg-[#0093d6] rounded-tr-2xl rounded-bl-2xl shadow-[-2px_4px_6px_0px_rgba(0,0,0,0.08)] inline-flex justify-center items-center gap-1"
                    >
                      <div className="size-4 relative overflow-hidden">
                        <div className="size-4 left-0 top-0 absolute"></div>
                        <div className="size-3.5 left-[1px] top-[1px] absolute bg-white"></div>
                      </div>
                      <div className="justify-start text-white text-base font-normal leading-snug">
                        Newly Added
                      </div>
                    </div>
                  </div>
                </div>
                <div className="self-stretch flex flex-col justify-start items-start gap-[30px]">
                  <div className="self-stretch flex flex-col justify-start items-start gap-3">
                    <div className="self-stretch justify-start text-secondary text-2xl font-semibold ">
                      Goofy hat
                    </div>
                    <div className="self-stretch relative flex flex-col justify-start items-start gap-[7px]">
                      <div className="self-stretch justify-start">
                        <span className="text-[#4b4b4b] text-base font-normal leading-snug">
                          Made from a standard fabric composition of 65% cotton and 35% polyester
                          with your...{' '}
                        </span>
                        <span className="text-tertiary text-base font-bold leading-snug">
                          Show More
                        </span>
                      </div>
                      <div
                        data-icon="false"
                        data-property-1="Without Outline"
                        className="size- left-[271px] top-[22px] absolute inline-flex justify-start items-center gap-[5px]"
                      >
                        <div className="justify-start"></div>
                      </div>
                    </div>
                    <div className="h-11 p-1.5 bg-white rounded-lg inline-flex justify-start items-center gap-[5px]">
                      <div
                        data-property-1="Default"
                        className="size-8 p-0.5 rounded-[5px] outline outline-1  outline-grey-300 flex justify-start items-center gap-2.5"
                      >
                        <div className="flex-1 self-stretch bg-tertiary rounded-[3px]"></div>
                      </div>
                      <div
                        data-property-1="Default"
                        className="size-8 p-0.5 rounded-[5px] outline outline-1  outline-grey-300 flex justify-start items-center gap-2.5"
                      >
                        <div className="flex-1 self-stretch bg-secondary rounded-[3px]"></div>
                      </div>
                      <div
                        data-property-1="Default"
                        className="size-8 p-0.5 rounded-[5px] outline outline-1  outline-grey-300 flex justify-start items-center gap-2.5"
                      >
                        <div className="flex-1 self-stretch bg-[#c12727] rounded-[3px]"></div>
                      </div>
                      <div
                        data-property-1="Selected"
                        className="size-8 p-[3px] relative rounded-[5px] outline outline-1  outline-tertiary flex justify-start items-center gap-2.5"
                      >
                        <div className="flex-1 self-stretch bg-[#075b06] rounded-[3px]"></div>
                        <div className="size-4 left-[8px] top-[8px] absolute overflow-hidden">
                          <div className="size-[13px] left-[1.50px] top-[1.50px] absolute bg-white"></div>
                        </div>
                      </div>
                      <div
                        data-property-1="Default"
                        className="size-8 p-0.5 rounded-[5px] outline outline-1  outline-grey-300 flex justify-start items-center gap-2.5"
                      >
                        <div className="flex-1 self-stretch bg-[#dddddd] rounded-[3px]"></div>
                      </div>
                    </div>
                  </div>
                  <div className="self-stretch inline-flex justify-between items-center">
                    <div className="size- inline-flex flex-col justify-start items-start gap-1">
                      <div className="self-stretch justify-start text-[#4b4b4b] text-base font-normal leading-snug">
                        As Low As
                      </div>
                      <div className="self-stretch justify-start text-tertiary text-2xl font-bold ">
                        $16.00{' '}
                      </div>
                    </div>
                    <div className="size- inline-flex flex-col justify-start items-start gap-0.5">
                      <div className="self-stretch justify-start text-[#4b4b4b] text-base font-normal leading-snug">
                        Min. Order
                      </div>
                      <div className="self-stretch justify-start text-tertiary text-base font-bold leading-snug">
                        20 pcs
                      </div>
                    </div>
                    <div
                      data-icon-left="false"
                      data-property-1="Fill Small"
                      className="size- px-6 py-3 bg-tertiary rounded-[100px] shadow-[4px_4px_10px_0px_rgba(13,0,113,0.16)] flex justify-center items-center gap-1.5"
                    >
                      <div className="justify-start text-white text-base font-semibold leading-snug">
                        More Info
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <div
                data-property-1="Default"
                data-show-badge="true"
                data-show-min-order="false"
                className="flex-1 inline-flex flex-col justify-start items-end gap-4"
              >
                <div className="self-stretch bg-gray-50 rounded-2xl flex flex-col justify-start items-end gap-2.5">
                  <div className="self-stretch  rounded-2xl flex flex-col justify-start items-end gap-2.5">
                    <div
                      data-type="No Minimum"
                      className="size- px-3 py-1.5 bg-[#14b1bf] rounded-tr-2xl rounded-bl-2xl shadow-[-2px_4px_6px_0px_rgba(0,0,0,0.08)] inline-flex justify-center items-center gap-1"
                    >
                      <div className="size-4 relative overflow-hidden">
                        <div className="size-4 left-0 top-0 absolute"></div>
                        <div className="  left-[1.50px] top-[2.50px] absolute bg-white"></div>
                      </div>
                      <div className="justify-start text-white text-base font-normal leading-snug">
                        No Minimum
                      </div>
                    </div>
                  </div>
                </div>
                <div className="self-stretch flex flex-col justify-start items-start gap-[30px]">
                  <div className="self-stretch flex flex-col justify-start items-start gap-3">
                    <div className="self-stretch justify-start text-secondary text-2xl font-semibold ">
                      15” Laptop Bag
                    </div>
                    <div className="self-stretch relative flex flex-col justify-start items-start gap-[7px]">
                      <div className="self-stretch justify-start">
                        <span className="text-[#4b4b4b] text-base font-normal leading-snug">
                          Made from a standard fabric composition of 65% cotton and 35% polyester
                          with your...{' '}
                        </span>
                        <span className="text-tertiary text-base font-bold leading-snug">
                          Show More
                        </span>
                      </div>
                      <div
                        data-icon="false"
                        data-property-1="Without Outline"
                        className="size- left-[271px] top-[22px] absolute inline-flex justify-start items-center gap-[5px]"
                      >
                        <div className="justify-start"></div>
                      </div>
                    </div>
                    <div className="h-11 p-1.5 bg-white rounded-lg inline-flex justify-start items-center gap-[5px]">
                      <div
                        data-property-1="Default"
                        className="size-8 p-0.5 rounded-[5px] outline outline-1  outline-grey-300 flex justify-start items-center gap-2.5"
                      >
                        <div className="flex-1 self-stretch bg-[#dddddd] rounded-[3px]"></div>
                      </div>
                      <div
                        data-property-1="Default"
                        className="size-8 p-0.5 rounded-[5px] outline outline-1  outline-grey-300 flex justify-start items-center gap-2.5"
                      >
                        <div className="flex-1 self-stretch bg-white rounded-[3px] border-[0.50px] border-secondary"></div>
                      </div>
                      <div
                        data-property-1="Default"
                        className="size-8 p-0.5 rounded-[5px] outline outline-1  outline-grey-300 flex justify-start items-center gap-2.5"
                      >
                        <div className="flex-1 self-stretch bg-secondary rounded-[3px]"></div>
                      </div>
                    </div>
                  </div>
                  <div className="self-stretch inline-flex justify-between items-center">
                    <div className="size- inline-flex flex-col justify-start items-start gap-1">
                      <div className="self-stretch justify-start text-[#4b4b4b] text-base font-normal leading-snug">
                        As Low As
                      </div>
                      <div className="self-stretch justify-start text-tertiary text-2xl font-bold ">
                        $39.00{' '}
                      </div>
                    </div>
                    <div
                      data-icon-left="false"
                      data-property-1="Fill Small"
                      className="size- px-6 py-3 bg-tertiary rounded-[100px] shadow-[4px_4px_10px_0px_rgba(13,0,113,0.16)] flex justify-center items-center gap-1.5"
                    >
                      <div className="justify-start text-white text-base font-semibold leading-snug">
                        More Info
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

export default NewProducts;
