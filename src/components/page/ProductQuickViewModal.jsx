// !fullupdate
'use client';

import { useMemo, useState } from 'react';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog';
import ProductRightColumn from '@/components/page/ProductRightColumn';

function PriceChart({ steps, regularPrice, currency = '$', extraEach = 0 }) {
  if (!Array.isArray(steps) || steps.length === 0) return null;

  const getRange = i => {
    const thisQty = Number(steps[i]?.quantity);
    if (i === 0) return `Quantity: 1-${thisQty}`;
    if (i < steps.length - 1) {
      const prevQty = Number(steps[i - 1]?.quantity);
      return `Quantity: ${prevQty + 1}-${thisQty}`;
    }
    return `Quantity: ${thisQty}+`;
  };

  const parseMoney = v => (Number.isFinite(Number(v)) ? Number(v) : 0);
  const regular = parseMoney(regularPrice);

  return (
    <div className="w-full">
      <h2 className="text-xl font-semibold text-left mb-2">Quantity Pricing</h2>
      <div className="mt-4 w-full">
        <div className="grid grid-cols-1 gap-1 sm:grid-cols-2 rounded-xl overflow-hidden">
          {steps.map((step, i) => {
            const stepAmt = parseMoney(step?.amount);
            const useRegularForFirstTier = i === 0 && stepAmt === 0 && regular > 0;
            const display = (useRegularForFirstTier ? regular : stepAmt) + (Number(extraEach) || 0);
            return (
              <div
                key={i}
                className="flex flex-col items-center px-4 py-3 rounded-[8px] bg-bglight"
              >
                <div className="text-lg font-bold text-primary">
                  {currency}
                  {display.toFixed(2)}
                </div>
                <div className="text-xs text-gray-500 mt-1">{getRange(i)}</div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default function ProductQuickViewModal({
  open,
  onClose,
  product,
  onAddToCart,
  bumpPrice, // kept for compat
  companyLogos = {},
  pagePlacementMap = {},
  customBackAllowedSet = {},
}) {
  // [PATCH] Added safeProduct so hooks are never conditional.
  const safeProduct = product ?? {};

  // [PATCH] Wrap ACF in its own memo to satisfy exhaustive-deps.
  const acf = useMemo(() => safeProduct?.acf ?? {}, [safeProduct?.acf]);

  const steps = useMemo(() => {
    // [PATCH] Same logic, but now driven by memoized `acf`
    if (acf?.group_type === 'Group' && Array.isArray(acf.discount_steps)) return acf.discount_steps;
    if (acf?.group_type === 'Quantity' && Array.isArray(acf.quantity_steps)) return acf.quantity_steps;
    return [];
  }, [acf]);

  // Child → parent data flow from ProductRightColumn
  const [previewProduct, setPreviewProduct] = useState(safeProduct);
  const [previewPlacements, setPreviewPlacements] = useState([]);
  const [filterWasChanged, setFilterWasChanged] = useState(false);

  // Compute extraEach from current previewPlacements
  const selectedActiveCount = useMemo(
    () => (Array.isArray(previewPlacements) ? previewPlacements.filter(p => p?.active).length : 0),
    [previewPlacements]
  );
  const extraPrint = Math.max(0, Number(safeProduct?.extra_print_price) || 0);
  const extraPricePlaceCount = Math.max(0, Number(selectedActiveCount || 0) - 1);
  const extraEach = extraPricePlaceCount * extraPrint;

  const handleAddToCartClick = () => {
    onClose?.();
    // [PATCH] Guard + ensure we always send the latest preview placements.
    if (!safeProduct) return;
    onAddToCart?.(previewProduct || {
      ...safeProduct,
      placement_coordinates: previewPlacements,
      filter_was_changed: filterWasChanged,
    });
  };

  if (!product) return null;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="!max-w-[900px] p-0 rounded-2xl overflow-hidden shadow-xl bg-white">
        <DialogClose asChild>
          <button
            className="absolute top-2 right-2 z-10 bg-white rounded-full cursor-pointer p-2 shadow hover:bg-bglighter focus:outline-none focus:ring-2 focus:ring-skyblue"
            aria-label="Close"
          >
            {/* X icon is handled by CSS class in your design system */}
            <span className="block w-5 h-5">✕</span>
          </button>
        </DialogClose>

        <div className="flex flex-row w-full pb-10 pt-10" style={{ minHeight: 360 }}>
          {/* Left column (kept) */}
          <div
            className="flex flex-col justify-between px-[35px] pt-2 pb-0"
            style={{ flexBasis: '48%' }}
          >
            <DialogTitle className="text-2xl font-bold text-black mb-2">
              {safeProduct?.name}
            </DialogTitle>
            <DialogDescription className="prose prose-sm max-w-none mb-4 text-primary">
              {safeProduct?.acf?.pricing_description
                ? safeProduct.acf.pricing_description.replace(/<[^>]+>/g, '')
                : 'Product Details'}
            </DialogDescription>

            <PriceChart
              steps={steps}
              regularPrice={safeProduct?.regular_price ?? safeProduct?.price}
              extraEach={extraEach}
            />

            <div>
              <button
                className="alarnd-btn mt-5 bg-primary-500 rounded-full font-normal text-white"
                onClick={handleAddToCartClick}
              >
                Select Size & Quantity
              </button>
            </div>
          </div>

          {/* Right column → replaced with shared component */}
          <ProductRightColumn
            open={open}
            product={safeProduct}
            companyLogos={companyLogos}
            pagePlacementMap={pagePlacementMap}
            customBackAllowedSet={customBackAllowedSet}
            onPlacementsChange={(placements, wasChanged) => {
              setPreviewPlacements(Array.isArray(placements) ? placements : []);
              setFilterWasChanged(!!wasChanged);
            }}
            onPreviewProduct={pp => setPreviewProduct(pp)}
            flexBasis="52%"
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}