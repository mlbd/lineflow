import { calculateProductPriceRange } from '@/lib/calculateProductPriceRange';

export default function ProductPriceLabel({ product, bumpPrice = null }) {
  // console.log('ProductPriceLabel', { product, bumpPrice });
  const priceDisplay = calculateProductPriceRange({
    ...product,
    bump_price: bumpPrice ?? product.bump_price,
  });

  return (
    <div className="mt-2 w-full text-lg text-primary text-center font-normal">
      {priceDisplay ? priceDisplay : 'Not available'}
    </div>
  );
}
