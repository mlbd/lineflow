import { calculateProductPriceRange } from '@/lib/calculateProductPriceRange';

export default function ProductPriceLabel({ product, bumpPrice = null, priceMode }) {
  const priceDisplay = calculateProductPriceRange(
    { ...product, bump_price: bumpPrice ?? product.bump_price },
    null,
    priceMode
  );

  if (priceMode === 'range') {
    return (
      <div className="mt-2 w-full text-lg text-primary text-center font-normal">
        {priceDisplay ? priceDisplay : 'Not available'}
      </div>
    );
  }

  // Single value view (e.g., "As Low As")
  return (
    <div className="inline-flex flex-col justify-start items-start gap-1">
      <div className="self-stretch text-[#4b4b4b] text-base font-normal leading-snug">
        As Low As
      </div>
      <div className="self-stretch text-tertiary text-2xl font-bold">
        {priceDisplay ? priceDisplay : 'Not available'}
      </div>
    </div>
  );
}
