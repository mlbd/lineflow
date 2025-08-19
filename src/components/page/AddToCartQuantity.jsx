// AddToCartQuantity.jsx
import { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogClose } from '@/components/ui/dialog';
import clsx from 'clsx';
import { applyBumpPrice } from '@/utils/price';
import { X } from 'lucide-react';
import { useCartStore } from '@/components/cart/cartStore';

const QTY_LIMIT = 50000;

export default function AddToCartQuantity({ open, onClose, product, bumpPrice, onCartAddSuccess }) {
  // -------- All hooks must be called at the top --------
  const acf = product?.acf || {};
  const steps = applyBumpPrice(acf.quantity_steps || [], bumpPrice);

  const minStep = steps[0] ? parseInt(steps[0].quantity) : 1;
  const [selectedIdx, setSelectedIdx] = useState(1); // Default to second option
  const [customQty, setCustomQty] = useState('');
  const [error, setError] = useState(null);

  const addItem = useCartStore(s => s.addItem);

  // Modal width: 470px
  const sizeWidth = 470;

  // Helper function to get price for a given quantity
  const getPriceForQuantity = qty => {
    if (!qty || !steps.length) return 0;

    // Filter out hidden steps
    const visibleSteps = steps.filter(step => !step.hide);

    // Find the appropriate step for this quantity
    let applicableStep = visibleSteps[0]; // Default to first step

    for (const step of visibleSteps) {
      if (qty >= parseInt(step.quantity)) {
        applicableStep = step;
      } else {
        break;
      }
    }

    return applicableStep ? parseFloat(applicableStep.amount) : 0;
  };

  // Calculate custom quantity pricing
  const customPricing = useMemo(() => {
    const qty = parseInt(customQty || 0);
    if (!qty) return { unitPrice: 0, total: 0 };

    const unitPrice = getPriceForQuantity(qty);
    const total = qty * unitPrice;

    return { unitPrice, total };
  }, [customQty, steps]);

  // Compute current selection
  const { quantity, price } = useMemo(() => {
    if (selectedIdx === 0) {
      const q = parseInt(customQty || 0);
      const p = getPriceForQuantity(q);
      return { quantity: q, price: p };
    } else {
      const idx = selectedIdx - 1;
      return {
        quantity: steps[idx] ? parseInt(steps[idx].quantity || 0) : 0,
        price: steps[idx] ? parseFloat(steps[idx].amount || 0) : 0,
      };
    }
  }, [selectedIdx, customQty, steps]);

  // Return early if no product
  if (!product) return null;

  // Validation for custom input
  const handleCustomQty = val => {
    let newVal = val.replace(/[^0-9]/g, '');
    if (parseInt(newVal) > QTY_LIMIT) {
      setError(`כמות מקסימלית לרכישה: ${QTY_LIMIT}`);
      // Don't auto-correct, just show error and keep the typed value
    } else if (newVal && parseInt(newVal) < minStep) {
      setError(`הכמות המינימלית היא ${minStep}`);
    } else {
      setError(null);
    }
    setCustomQty(newVal);
  };

  // --- Add to Cart Handler ---
  const handleAddToCart = () => {
    if (!quantity || !!error) return;
    addItem({
      product_id: product.id,
      name: product.name,
      thumbnail: product.thumbnail,
      quantity,
      price,
      pricing: { type: 'Quantity', steps },
      options: {}, // add options if any (for quantity type, usually none)
    });
    if (typeof window !== 'undefined' && window.dataLayer) {
      window.dataLayer.push({
        event: 'add_to_cart',
        ecommerce: {
          items: [
            {
              item_id: product.id,
              item_name: product.name,
              price,
              quantity,
            },
          ],
        },
      });
    }
    if (onCartAddSuccess) onCartAddSuccess();
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent
        className="rounded-2xl shadow-xl p-0"
        style={{
          width: `${sizeWidth}px`,
          minWidth: `${sizeWidth}px`,
          maxWidth: '100vw',
          transition: 'width 0.2s cubic-bezier(.42,0,.58,1)',
        }}
      >
        <DialogClose asChild>
          <button className="alarnd-close-btn" aria-label="סגור">
            <X className="w-5 h-5" />
          </button>
        </DialogClose>
        <h2 className="text-xl font-bold text-center mb-4 mt-3">{product.name}</h2>
        <form className="p-[30px]">
          <div className="flex flex-col gap-2">
            {/* Custom input option first */}
            <label className={clsx('flex justify-between items-center gap-3 p-1 cursor-pointer')}>
              <div className="alarnd-single-qty flex-shrink-0">
                <input
                  type="radio"
                  name="quantity_choice"
                  checked={selectedIdx === 0}
                  onChange={() => setSelectedIdx(0)}
                  className="form-radio mx-2"
                />
                <input
                  className="custom_qty_input border rounded-lg px-2 py-1 w-24 text-right"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  placeholder="הקלידו כמות…"
                  value={customQty}
                  onChange={e => {
                    if (selectedIdx !== 0) setSelectedIdx(0); // Auto-select on type
                    handleCustomQty(e.target.value);
                  }}
                  onFocus={() => setSelectedIdx(0)} // Auto-select on focus
                  onClick={() => setSelectedIdx(0)} // Auto-select on click
                  onBlur={() => setError(null)}
                  maxLength={6}
                />
              </div>

              {/* Middle column: total */}
              <div className="alarnd-single-qty flex-1 text-center">
                <span className="text-gray-400">
                  {customQty && parseInt(customQty) > 0
                    ? `${Math.round(customPricing.total)}₪`
                    : '—'}
                </span>
              </div>

              {/* Right column: unit price */}
              <div className="alarnd-single-qty flex-shrink-0">
                <span className="font-bold">
                  {customQty && parseInt(customQty) > 0
                    ? `${customPricing.unitPrice} ש״ח ליחידה`
                    : '—'}
                </span>
              </div>
            </label>

            {/* Preset steps */}
            {steps
              .filter(step => !step.hide)
              .map((step, idx) => (
                <label
                  key={idx + 1}
                  className={clsx('flex justify-between items-center gap-3 p-1 cursor-pointer')}
                >
                  <div className="alarnd-single-qty flex-shrink-0">
                    <input
                      type="radio"
                      name="quantity_choice"
                      checked={selectedIdx === idx + 1}
                      onChange={() => setSelectedIdx(idx + 1)}
                      className="form-radio mx-2"
                    />
                    <span className="font-semibold">{step.quantity}</span>
                  </div>
                  <div className="alarnd-single-qty flex-1 text-center">
                    <span className="text-gray-400">
                      {Math.round(parseFloat(step.quantity) * parseFloat(step.amount))}₪
                    </span>
                  </div>
                  <div className="alarnd-single-qty flex-shrink-0">
                    <span className="font-bold">{step.amount} ש״ח ליחידה</span>
                  </div>
                </label>
              ))}
          </div>
          {error && <div className="text-red-500 text-sm text-center mt-2">{error}</div>}
          <div className="text-center mt-4">
            <button
              type="button"
              disabled={!quantity || !!error}
              className="alarnd-btn w-auto"
              onClick={handleAddToCart}
            >
              הוסף לעגלה
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
