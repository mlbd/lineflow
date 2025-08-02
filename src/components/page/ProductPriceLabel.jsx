import { calculateProductPriceRange } from "@/lib/calculateProductPriceRange";

export default function ProductPriceButton({ product, bumpPrice = null }) {
  const priceDisplay = calculateProductPriceRange({
    ...product,
    bump_price: bumpPrice ?? product.bump_price
  });

  return (
    <div
      className="mt-2 w-full text-lg text-primary text-center font-normal"
    >
      {priceDisplay ? priceDisplay : "לא זמין"}
    </div>
  );
}
