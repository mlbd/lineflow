import { useState, useMemo } from "react";
import { Dialog, DialogContent, DialogClose } from "@/components/ui/dialog";
import clsx from "clsx";
import { applyBumpPrice } from "@/utils/price";
import { X } from "lucide-react";

const QTY_LIMIT = 50000;

export default function AddToCartQuantity({ open, onClose, product, bumpPrice }) {
  if (!product) return null;
  const acf = product.acf || {};
  const steps = applyBumpPrice(acf.quantity_steps || [], bumpPrice);

  const minStep = steps[0] ? parseInt(steps[0].quantity) : 1;
  const [selectedIdx, setSelectedIdx] = useState(1); // Default to second option
  const [customQty, setCustomQty] = useState("");
  const [error, setError] = useState(null);

  // Modal width: 470px
  const sizeWidth = 470;

  // Compute current selection
  const { quantity, price } = useMemo(() => {
    if (selectedIdx === 0) {
      const q = parseInt(customQty || 0);
      let p = steps[0]?.amount ? parseFloat(steps[0].amount) : 0;
      for (let i = 0; i < steps.length; i++) {
        if (q >= parseInt(steps[i].quantity)) p = parseFloat(steps[i].amount);
      }
      return { quantity: q, price: p };
    } else {
      return {
        quantity: parseInt(steps[selectedIdx]?.quantity || 0),
        price: parseFloat(steps[selectedIdx]?.amount || 0),
      };
    }
  }, [selectedIdx, customQty, steps]);

  // Validation for custom input
  const handleCustomQty = (val) => {
    let newVal = val.replace(/[^0-9]/g, "");
    if (parseInt(newVal) > QTY_LIMIT) {
      setError(`כמות מקסימלית לרכישה: ${QTY_LIMIT}`);
      newVal = QTY_LIMIT.toString();
    } else if (newVal && parseInt(newVal) < minStep) {
      setError(`הכמות המינימלית היא ${minStep}`);
    } else {
      setError(null);
    }
    setCustomQty(newVal);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent
        className="rounded-2xl shadow-xl p-0"
        style={{
          width: `${sizeWidth}px`,
          minWidth: `${sizeWidth}px`,
          maxWidth: "100vw",
          transition: "width 0.2s cubic-bezier(.42,0,.58,1)",
        }}
      >
        <DialogClose asChild>
          <button
            className="alarnd-close-btn"
            aria-label="סגור"
          >
            <X className="w-5 h-5" />
          </button>
        </DialogClose>
        <h2 className="text-xl font-bold text-center mb-4 mt-3">{product.name}</h2>
        <form className="p-[30px]">
          <div className="flex flex-col gap-2">
            {/* Custom input option first */}
            <label
              className={clsx(
                "flex justify-between items-center gap-3 p-1 cursor-pointer",
              )}
            >
                <div className="alarnd-single-qty flex-shrink-0">
              <input
                type="radio"
                name="quantity_choice"
                checked={selectedIdx === 0}
                onChange={() => setSelectedIdx(0)}
                className="form-radio mx-2"
              />
              <input
                className="border rounded-lg px-2 py-1 w-24 text-right"
                inputMode="numeric"
                pattern="[0-9]*"
                placeholder="הקלידו כמות…"
                value={customQty}
                onChange={(e) => handleCustomQty(e.target.value)}
                onBlur={() => setError(null)}
                maxLength={5}
              />
              </div>
            </label>
            {/* Preset steps */}
            {steps.map((step, idx) => (
              <label
                key={idx + 1}
                className={clsx(
                  "flex justify-between items-center gap-3 p-1 cursor-pointer",
                )}
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
                    <span className="font-bold">{step.amount} ש"ח ליחידה</span>
                </div>
              </label>
            ))}
          </div>
          {/* Error or info */}
          {error && (
            <div className="text-red-500 text-sm text-center mt-2">{error}</div>
          )}
          {/* Price summary */}
          <div className="text-center my-4">
            <div>
              <span className="alarnd__total_qty">{quantity}</span> יחידות ×{" "}
              <span className="alarnd__wc-price">{price}</span>₪ ={" "}
              <span className="alarnd__wc-price">{quantity * price}</span>₪
            </div>
          </div>
          <div className="text-center">
            <button
                type="button"
                disabled={quantity < minStep || !!error}
                className="alarnd-btn w-auto"
                onClick={() => {
                // TODO: Add to cart logic here
                onClose();
                }}
            >
                הוסף לעגלה
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
