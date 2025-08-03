"use client";
import { useState } from "react";
import { useRemoveItem, useUpdateItemQuantity } from "./cartStore";
import Image from 'next/image';
import { Trash2 } from 'lucide-react';

export default function CartItem({ item, idx }) {
  const removeItem = useRemoveItem();
  const updateItemQuantity = useUpdateItemQuantity();
  const [error, setError] = useState("");
  const [localQuantity, setLocalQuantity] = useState(item.quantity.toString());

  // Get minimum quantity based on group type
  const getMinimumQuantity = () => {
    if (item.options?.group_type === "Group") {
      return 1;
    }
    return 1;
  };

  const minQuantity = getMinimumQuantity();
  const maxQuantity = 999;

  const handleQuantityChange = (value) => {
    // Remove non-numeric characters
    let cleanValue = value.replace(/[^0-9]/g, "");
    
    // Remove leading zeros
    if (cleanValue.length > 1 && cleanValue[0] === "0") {
      cleanValue = cleanValue.replace(/^0+/, "");
    }

    setLocalQuantity(cleanValue);

    // Validate and update store
    const numValue = parseInt(cleanValue) || 0;
    
    if (!cleanValue) {
      setError("");
      return;
    }
    
    if (numValue < minQuantity) {
      setError(`כמות מינימלית: ${minQuantity}`);
      return;
    }
    
    if (numValue > maxQuantity) {
      setError(`כמות מקסימלית: ${maxQuantity}`);
      setLocalQuantity(maxQuantity.toString());
      updateItemQuantity(idx, maxQuantity);
      return;
    }

    setError("");
    updateItemQuantity(idx, numValue);
  };

  const handleQuantityBlur = () => {
    const numValue = parseInt(localQuantity) || 0;
    
    if (!localQuantity || numValue < minQuantity) {
      setLocalQuantity(minQuantity.toString());
      updateItemQuantity(idx, minQuantity);
      setError("");
    }
  };

  // Helper to render product details
  const renderProductDetails = () => {
    return (
      <div className="space-y-1">
        <div className="font-semibold text-gray-900">{item.name}</div>
        
        {item.options?.group_type === "Group" && (
            <div className="space-y-1 text-sm text-gray-600">
                <div className="flex items-center gap-2">
                <span>צבע:</span>
                <span 
                    className="px-2 py-1 rounded text-xs font-medium text-white"
                    style={{ backgroundColor: item.options.color_hex_code }}
                >
                    {item.options.color}
                </span>
                </div>
                <div>מידה: <span className="font-medium">{item.options.size}</span></div>
            </div>
            )}

        {item.options && item.options.group_type !== "Group" && Object.keys(item.options).length > 0 && (
          <div className="text-sm text-gray-600">
            {Object.entries(item.options).map(([k, v]) => (
              <div key={k}>
                {k}: <span className="font-medium">{String(v)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  const totalPrice = item.price * item.quantity;

  return (
    <div className="grid grid-cols-6 gap-4 p-4 border border-gray-200 rounded-lg bg-white items-center">
      {/* 1. Thumbnail */}
      <div className="flex justify-center">
        <Image 
          src={item.thumbnail} 
          alt={item.name} 
          width={60} 
          height={60} 
          className="w-15 h-15 rounded object-cover border border-gray-100"
        />
      </div>

      {/* 2. Product Details */}
      <div className="col-span-2">
        {renderProductDetails()}
      </div>

      {/* 3. Price per item */}
      <div className="text-center">
        <div className="text-lg font-semibold text-gray-900">
          {item.price} ₪
        </div>
        <div className="text-xs text-gray-500">ליחידה</div>
      </div>

      {/* 4. Quantity (Editable) */}
      <div className="text-center">
        <div className="space-y-1">
          <input
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            value={localQuantity}
            onChange={(e) => handleQuantityChange(e.target.value)}
            onBlur={handleQuantityBlur}
            className={`w-16 px-2 py-1 text-center border rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
              error ? 'border-red-400 focus:ring-red-500 focus:border-red-500' : 'border-gray-300'
            }`}
            maxLength="3"
          />
          {error && (
            <div className="text-xs text-red-500 mt-1">{error}</div>
          )}
        </div>
      </div>

      {/* 5. Total Price */}
      <div className="text-center">
        <div className="text-lg font-bold text-gray-900">
          {totalPrice} ₪
        </div>
        <div className="text-xs text-gray-500">סה"כ</div>
      </div>

      {/* 6. Delete Button */}
      <div className="text-center">
        <button
          onClick={() => removeItem(idx)}
          className="p-2 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-full transition-colors"
          aria-label="הסר פריט"
        >
          <Trash2 className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}