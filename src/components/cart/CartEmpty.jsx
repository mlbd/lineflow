'use client';
import { ShoppingCart } from 'lucide-react';

export default function CartEmpty() {
  return (
    <div className="container mx-auto py-16 px-4">
      <div className="max-w-md mx-auto text-center">
        <div className="mb-6">
          <ShoppingCart className="w-24 h-24 mx-auto text-gray-300" />
        </div>

        <h2 className="text-2xl font-bold text-gray-900 mb-4">Your cart is empty</h2>

        <p className="text-gray-600 mb-8">
          It looks like you haven&apos;t added any items to your cart yet. Start shopping to fill it
          up!
        </p>

        <button className="py-3 px-8 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors">
          Continue Shopping
        </button>
      </div>
    </div>
  );
}
