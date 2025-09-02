// /src/components/cart/CartCheckoutButton.jsx
'use client';
import { useCartStore } from './cartStore';
export default function CartCheckoutButton({ subtotal }) {
  const items = useCartStore(s => s.items);
  const checkout = () => {
    // Send items to order endpoint
    alert('Order not yet supported in this interface');
  };
  return (
    <button className="w-full bg-green-600 text-white py-3 rounded mt-6" onClick={checkout}>
      Place an order
    </button>
  );
}
