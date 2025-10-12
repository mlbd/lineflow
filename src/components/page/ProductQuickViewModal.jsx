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

/* ---------------------------------------
   Local: PriceChart (pure render, no hooks)
------------------------------------------*/
function PriceChart({ steps, regularPrice, currency = '$', extraEach = 0 }) {
  if (!Array.isArray(steps) || steps.length === 0) return null;

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
      <h4 className="mb-2 text-sm font-semibold text-gray-800">Discount Steps</h4>
      <div className="space-y-2 text-sm">
        {steps.map((s, i) => {
          const qty = Number(s?.qty ?? s?.quantity ?? 0);
          const price = Number(s?.price ?? s?.unit_price ?? regularPrice ?? 0);
          const withExtra = price + Number(extraEach || 0);
          return (
            <div
              key={`${qty}-${price}-${i}`}
              className="flex items-center justify-between rounded-lg border border-gray-100 px-3 py-2"
            >
              <span className="text-gray-600">≥ {qty}</span>
              <span className="font-medium text-gray-900">
                {currency}
                {withExtra.toFixed(2)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ---------------------------------------
   Modal Component
------------------------------------------*/
export default function ProductQuickViewModal({
  open,
  onClose,
  product,
  onAddToCart,
  bumpPrice, // kept for compat
  companyLogos,
}) {
  // -------------------------------
  // [PATCH] Hooks: top-level only
  // -------------------------------

  // [PATCH] Stable ACF snapshot. Never use a freshly created {} as a dep.
  const acf = useMemo(() => product?.acf ?? null, [product?.acf]);

  // [PATCH] Stable price/currency reads from product/ACF.
  const regularPrice = useMemo(() => {
    // try common fields: Woo JSON (price_html aside)
    const rp =
      product?.regular_price ??
      product?.price ??
      acf?.regular_price ??
      acf?.base_price ??
      0;
    const n = Number(rp);
    return Number.isFinite(n) ? n : 0;
  }, [product?.regular_price, product?.price, acf?.regular_price, acf?.base_price]);

  const salePrice = useMemo(() => {
    const sp =
      product?.sale_price ??
      acf?.sale_price ??
      null;
    const n = Number(sp);
    return Number.isFinite(n) ? n : null;
  }, [product?.sale_price, acf?.sale_price]);

  const currency = useMemo(() => {
    return product?.currency_symbol || acf?.currency_symbol || '$';
  }, [product?.currency_symbol, acf?.currency_symbol]);

  // [PATCH] Steps derived in one place; identity stable.
  const steps = useMemo(() => {
    const gt = acf?.group_type;
    if (gt === 'Group' && Array.isArray(acf?.discount_steps)) {
      return acf.discount_steps;
    }
    if (gt === 'Quantity' && Array.isArray(acf?.quantity_steps)) {
      return acf.quantity_steps;
    }
    return [];
  }, [acf?.group_type, acf?.discount_steps, acf?.quantity_steps]);

  // [PATCH] Extra per-unit adjustments (if any).
  const extraEach = useMemo(() => {
    const e =
      acf?.extra_each ??
      acf?.extra_price_each ??
      0;
    const n = Number(e);
    return Number.isFinite(n) ? n : 0;
  }, [acf?.extra_each, acf?.extra_price_each]);

  // [PATCH] Local preview states (top-level, not conditional).
  const [previewProduct, setPreviewProduct] = useState(null);
  const [previewPlacements, setPreviewPlacements] = useState([]);
  const [filterWasChanged, setFilterWasChanged] = useState(false);

  // [PATCH] Derived title & description safely.
  const title = useMemo(
    () => product?.name ?? acf?.title ?? 'Product',
    [product?.name, acf?.title]
  );
  const shortDesc = useMemo(
    () => product?.short_description ?? acf?.short_description ?? '',
    [product?.short_description, acf?.short_description]
  );

  // [PATCH] Company logo map (stable).
  const companyLogosMap = useMemo(() => {
    if (!companyLogos || typeof companyLogos !== 'object') return {};
    return companyLogos;
  }, [companyLogos]);

  // [PATCH] Optionally pass placements/back-allowed via ACF.
  const pagePlacementMap = useMemo(() => {
    return acf?.pagePlacementMap ?? {};
  }, [acf?.pagePlacementMap]);

  const customBackAllowedSet = useMemo(() => {
    const raw = acf?.customBackAllowed ?? [];
    return new Set(Array.isArray(raw) ? raw : []);
  }, [acf?.customBackAllowed]);

  // -------------------------------
  // Render
  // -------------------------------
  // NOTE: We do NOT early-return before hooks. We can conditionally render inside JSX.
  return (
    <Dialog open={!!open} onOpenChange={val => !val && onClose?.()}>
      <DialogContent
        onInteractOutside={e => {
          // keep default close; customize if needed
        }}
        className="max-w-6xl"
      >
        <div className="flex flex-col gap-6 md:flex-row">
          {/* Left Column: Title + Chart */}
          <div className="w-full md:w-[48%] space-y-4">
            <div>
              <DialogTitle className="text-xl font-bold text-gray-900">
                {title}
              </DialogTitle>
              <DialogDescription className="text-sm text-gray-600">
                {shortDesc}
              </DialogDescription>
            </div>

            {/* Prices */}
            <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
              <div className="flex items-end gap-3">
                {salePrice ? (
                  <>
                    <div className="text-2xl font-bold text-gray-900">
                      {currency}
                      {Number(salePrice + extraEach).toFixed(2)}
                    </div>
                    <div className="text-sm text-gray-500 line-through">
                      {currency}
                      {Number(regularPrice + extraEach).toFixed(2)}
                    </div>
                  </>
                ) : (
                  <div className="text-2xl font-bold text-gray-900">
                    {currency}
                    {Number(regularPrice + extraEach).toFixed(2)}
                  </div>
                )}
              </div>
            </div>

            {/* Discount/Quantity steps */}
            <PriceChart
              steps={steps}
              regularPrice={regularPrice}
              currency={currency}
              extraEach={extraEach}
            />
          </div>

          {/* Right Column: ProductRightColumn (unchanged API) */}
          <ProductRightColumn
            product={product}
            previewProduct={previewProduct}
            setPreviewProduct={setPreviewProduct}
            previewPlacements={previewPlacements}
            setPreviewPlacements={setPreviewPlacements}
            filterWasChanged={filterWasChanged}
            setFilterWasChanged={setFilterWasChanged}
            onAddToCart={onAddToCart}
            // optional props you referenced earlier
            companyLogosMap={companyLogosMap}
            pagePlacementMap={pagePlacementMap}
            customBackAllowedSet={customBackAllowedSet}
            onPlacementsChange={(placements, wasChanged) => {
              // [PATCH] Keep local state syncs stable.
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
