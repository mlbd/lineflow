// /app/cart/CartCheckoutButton.jsx
"use client";
import { useCartStore } from "./cartStore";
export default function CartCheckoutButton({ subtotal }) {
  const items = useCartStore((s) => s.items);
  const checkout = () => {
    // Send items to order endpoint
    alert("הזמנה עדיין לא נתמכת בממשק זה");
  };
  return (
    <button className="w-full bg-green-600 text-white py-3 rounded mt-6" onClick={checkout}>
      בצע הזמנה
    </button>
  );
}
