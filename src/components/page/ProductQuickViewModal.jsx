import { useState, useEffect } from "react";
import Image from "next/image";
import { Dialog, DialogContent, DialogTitle, DialogClose, DialogDescription } from "@/components/ui/dialog";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { Button } from "@/components/ui/button";

// Helper to render the price chart (either discount_steps or quantity_steps)
function PriceChart({ steps }) {
  if (!Array.isArray(steps) || steps.length === 0) return null;

  const getRange = (i) => {
    const thisQty = Number(steps[i]?.quantity);
    const nextQty = steps[i + 1] ? Number(steps[i + 1].quantity) : null;
    if (i === 0 && nextQty !== null) {
      return `כמות: 1-${nextQty - 1}`;
    }
    if (i < steps.length - 1 && nextQty !== null) {
      return `כמות: ${thisQty}-${nextQty - 1}`;
    }
    return `כמות: ${thisQty}+`;
  };

  return (
    <div className="w-full">
      <h2 className="text-xl font-semibold text-center mb-2">תמחור כמות</h2>
      <div className="mt-4 w-full">
        <div className="grid grid-cols-1 sm:grid-cols-2 border rounded-xl overflow-hidden">
          {steps.map((step, i) => {
            const rowIdx = Math.floor(i / 2);
            const colIdx = i % 2;
            const checkerBg = rowIdx % 2 === colIdx % 2 ? "bg-bglight" : "";

            return (
              <div
                key={i}
                className={`flex flex-col items-center border-b last:border-b-0 sm:border-r px-4 py-3 ${checkerBg}`}
              >
                <div className="text-lg font-bold text-primary">{Number(step.amount).toFixed(2)}₪</div>
                <div className="text-xs text-gray-500 mt-1">{getRange(i)}</div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default function ProductQuickViewModal({ open, onClose, product, onAddToCart, bumpPrice }) {
  // Move all hooks to the top level!
  const acf = product?.acf || {};

  let steps = [];
  if (acf.group_type === "Group" && Array.isArray(acf.discount_steps)) {
    steps = acf.discount_steps;
  } else if (acf.group_type === "Quantity" && Array.isArray(acf.quantity_steps)) {
    steps = acf.quantity_steps;
  }

  const hasSlider = acf.group_type === "Group" && Array.isArray(acf.color) && acf.color.length > 0;
  const [sliderIdx, setSliderIdx] = useState(0);

  const handleDotClick = (idx) => setSliderIdx(idx);
  const handlePrev = () => setSliderIdx((sliderIdx - 1 + (acf.color?.length || 1)) % (acf.color?.length || 1));
  const handleNext = () => setSliderIdx((sliderIdx + 1) % (acf.color?.length || 1));

  useEffect(() => {
    if (open && hasSlider) {
      acf.color.forEach((clr) => {
        if (clr.thumbnail?.url) {
          const img = new window.Image();
          img.src = clr.thumbnail.url;
        }
      });
    }
  }, [open, hasSlider, acf.color]);

  useEffect(() => {
    setSliderIdx(0);
  }, [product]);

  if (!product) return null; // Hooks always above

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="!max-w-[900px] p-0 rounded-2xl overflow-hidden shadow-xl">
        <DialogClose asChild>
          <button
            className="absolute top-2 right-2 z-10 bg-white rounded-full cursor-pointer p-2 shadow hover:bg-bglighter focus:outline-none focus:ring-2 focus:ring-skyblue"
            aria-label="סגור"
          >
            <X className="w-5 h-5" />
          </button>
        </DialogClose>
        <div className="flex items-center justify-center w-full pt-8 pb-2">
          <DialogTitle className="text-2xl font-bold text-deepblue mb-2">{product?.name}</DialogTitle>
        </div>
        <div className="flex flex-row w-full pb-8" style={{ minHeight: 360 }}>
          {/* Left column */}
          <div className="flex flex-col justify-start px-[35px] pt-2 pb-8" style={{ flexBasis: "38%" }}>
            <DialogDescription className="prose prose-sm max-w-none mb-4 text-primary">
                {product?.acf?.pricing_description
                ? product.acf.pricing_description.replace(/<[^>]+>/g, '')
                : "פרטי מוצר"}
            </DialogDescription>
            <PriceChart steps={steps} />
            <div>
                <button
                className="alarnd-btn mt-5 bg-primary text-white"
                onClick={() => {
                    if (onClose) onClose(); // Close product quick view modal
                    if (onAddToCart) onAddToCart(); // Open add to cart modal
                }}
                >
                הוסיפו לעגלה
                </button>
            </div>
          </div>
          {/* Right column */}
          <div className="flex flex-col justify-center items-center relative" style={{ flexBasis: "62%" }}>
            {hasSlider ? (
              <>
                {/* Slick-like image */}
                <div className="flex items-center justify-center w-full" style={{ height: 310 }}>
                  <Image
                    src={acf.color[sliderIdx]?.thumbnail?.url}
                    alt={acf.color[sliderIdx]?.title || product?.name || "Product"}
                    width={340}
                    height={300}
                    className="max-h-[300px] max-w-full object-contain rounded-xl shadow"
                    priority
                    unoptimized
                  />
                </div>
                {acf.color.length > 1 && (
                  <>
                    <button
                      className="absolute top-1/2 mt-[-11px] left-2 -translate-y-1/2 bg-white rounded-full p-2 shadow cursor-pointer"
                      onClick={handlePrev}
                      aria-label="הקודם"
                    >
                      <ChevronLeft className="w-5 h-5" />
                    </button>
                    <button
                      className="absolute top-1/2 mt-[-11px] right-2 -translate-y-1/2 bg-white rounded-full p-2 shadow cursor-pointer"
                      onClick={handleNext}
                      aria-label="הבא"
                    >
                      <ChevronRight className="w-5 h-5" />
                    </button>
                  </>
                )}
                {/* Custom Dots */}
                <div className="flex justify-center mt-4 gap-2">
                  {acf.color.map((clr, idx) => (
                    <div
                      key={idx}
                      onClick={() => handleDotClick(idx)}
                      className={`w-[20px] h-[20px] rounded-[7px] border-2 cursor-pointer shadow-[0_0_0_2px_white,0_0_0_3px_#cccccc] transition-all duration-150
                        ${sliderIdx === idx ? "ring-2 ring-skyblue" : ""}`}
                      style={{ background: clr.color_hex_code }}
                      title={clr.title}
                    />
                  ))}
                </div>
              </>
            ) : (
              <div className="flex items-center justify-center w-full" style={{ height: 310 }}>
                <Image
                  src={product.thumbnail}
                  alt={product.name}
                  width={340}
                  height={300}
                  className="max-h-[300px] max-w-full object-contain rounded-xl shadow"
                  priority
                  unoptimized
                />
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
