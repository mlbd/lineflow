import { calculateProductOrderItems } from '@/lib/calculateProductPriceRange';

export default function ProductOrderRangeLabel({ product, itemsMode = 'range' }) {
  const minItems = calculateProductOrderItems(product, itemsMode);

  // check minItems value is 1 or lessh then return empty
  if (minItems <= 1) {
    return '';
  }

  // Single value view (e.g., "As Low As")
  return (
    <div class="size- inline-flex flex-col justify-start items-start gap-0.5">
      <div class="self-stretch justify-start text-[#4b4b4b] text-base font-normal leading-snug">
        Min. Order
      </div>
      <div class="self-stretch justify-start text-tertiary text-base font-bold leading-snug">
        {minItems} pcs
      </div>
    </div>
  );
}
