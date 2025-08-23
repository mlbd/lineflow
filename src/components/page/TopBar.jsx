// src/components/page/TopBar.jsx
'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useCartItems, getTotalItems } from '@/components/cart/cartStore'; // adjust path if needed
import { wpApiFetch } from '@/lib/wpApi';

export default function TopBar({ wpUrl, onCartClick }) {
  const [menus, setMenus] = useState([]);
  const items = useCartItems(); // read cart items
  const totalItems = getTotalItems(items); // calculate total quantity

  useEffect(() => {
    async function fetchMenus() {
      try {
        const res = await fetch('/api/ms/menu');
        const data = await res.json();
        setMenus(Array.isArray(data.items) ? data.items : []);
      } catch (e) {
        console.error('Failed to fetch menus:', e);
        setMenus([]);
      }
    }
    fetchMenus();
  }, []);

  return (
    <header className="flex items-center justify-between h-16 px-4 bg-deepblue shadow z-50">
      <div className="max-w-[var(--site-max-width)] w-full mx-auto flex items-center justify-between h-16 px-4">
        {/* Logo */}
        <div className="flex items-center">
          <Link href="/" aria-label="Home" className="flex items-center">
            <Image
              src="/allaround.svg"
              alt="Logo"
              width={110}
              height={40}
              className="h-10 w-auto"
              priority
            />
          </Link>
        </div>

        {/* Menus */}
        <nav className="flex gap-6">
          {menus.map(menu => {
            const isInternal = menu.url?.startsWith('/');
            const menuProps = {
              className: `transition-colors text-white hover:text-accent font-medium ${menu.classes?.join(' ') || ''}`,
              target: menu.target || undefined,
              title: menu.attr_title || undefined,
            };
            return isInternal ? (
              <Link key={menu.id} href={menu.url} {...menuProps}>
                {menu.title}
              </Link>
            ) : (
              <a key={menu.id} href={menu.url} {...menuProps}>
                {menu.title}
              </a>
            );
          })}
        </nav>

        {/* Cart Icon */}
        <div className="flex items-center">
          <button
            className="relative group cursor-pointer"
            aria-label="Open cart"
            onClick={onCartClick}
          >
            <svg
              width={28}
              height={28}
              fill="none"
              stroke="currentColor"
              className="w-7 h-7 text-white cursor-pointer"
            >
              <path d="M6 6h15l-1.5 9h-13z" strokeWidth={2} />
              <circle cx={9} cy={23} r={1.5} />
              <circle cx={21} cy={23} r={1.5} />
            </svg>
            {totalItems > 0 && (
              <span className="absolute -top-2 -right-2 bg-red-600 text-white text-[10px] w-5 h-5 rounded-full flex items-center justify-center font-bold">
                {totalItems}
              </span>
            )}
          </button>
        </div>
      </div>
    </header>
  );
}
