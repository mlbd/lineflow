// /app/cart/CartPage.jsx
"use client";
import { useCartItems } from "./cartStore";
import CartItem from "./CartItem";
import CartSummary from "./CartSummary";
import CartEmpty from "./CartEmpty";

export default function CartPage() {
  const items = useCartItems();

  if (!items.length) return <CartEmpty />;

  return (
    <div className="container mx-auto py-8 px-4">
      <h1 className="text-3xl font-bold mb-8 text-center">סל קניות</h1>
      
      {/* Cart Header */}
      <div className="grid grid-cols-6 gap-4 p-4 bg-gray-50 border border-gray-200 rounded-lg mb-4">
        <div className="text-center font-semibold text-gray-700">תמונה</div>
        <div className="col-span-2 font-semibold text-gray-700">מוצר</div>
        <div className="text-center font-semibold text-gray-700">מחיר ליחידה</div>
        <div className="text-center font-semibold text-gray-700">כמות</div>
        <div className="text-center font-semibold text-gray-700">סה"כ</div>
      </div>

      {/* Cart Items */}
      <div className="space-y-4">
        {items.map((item, idx) => (
          <CartItem key={`${item.product_id}-${idx}`} item={item} idx={idx} />
        ))}
      </div>

      {/* Cart Summary */}
      <div className="mt-8">
        <CartSummary />
      </div>
    </div>
  );
}