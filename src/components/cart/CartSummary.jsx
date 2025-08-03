'use client';
import { useCartItems, useClearCart, getTotalItems, getTotalPrice } from './cartStore';

export default function CartSummary() {
  const items = useCartItems();
  const clearCart = useClearCart();

  const totalItems = getTotalItems(items);
  const totalPrice = getTotalPrice(items);

  if (!items.length) return null;

  return (
    <div className="bg-gray-50 border border-gray-200 rounded-lg p-6">
      <h3 className="text-xl font-bold mb-4 text-gray-900">סיכום הזמנה</h3>

    <div className="space-y-3">
        <div className="flex justify-between items-center py-2 border-b border-gray-200">
          <span className="text-gray-600">סה&quot;כ פריטים:</span>
          <span className="font-semibold">{totalItems}</span>
        </div>

        <div className="flex justify-between items-center py-2 border-b border-gray-200">
          <span className="text-gray-600">סה&quot;כ מחיר:</span>
          <span className="font-bold text-lg">{totalPrice} ₪</span>
        </div>

        {/* Shipping info - you can customize this */}
        <div className="flex justify-between items-center py-2 border-b border-gray-200">
          <span className="text-gray-600">משלוח:</span>
          <span className="text-green-600 font-medium">חינם</span>
        </div>

        <div className="flex justify-between items-center py-3 border-t-2 border-gray-300">
          <span className="text-lg font-bold text-gray-900">סה&quot;כ לתשלום:</span>
          <span className="text-xl font-bold text-blue-600">{totalPrice} ₪</span>
        </div>
      </div>


      <div className="flex gap-3 mt-6">
        <button
          onClick={clearCart}
          className="flex-1 py-3 px-6 bg-gray-200 text-gray-800 rounded-lg font-medium hover:bg-gray-300 transition-colors"
        >
          נקה עגלה
        </button>

        <button className="flex-1 py-3 px-6 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors">
          המשך לתשלום
        </button>
      </div>
    </div>
  );
}
