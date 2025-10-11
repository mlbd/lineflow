// src/components/page/TopBar.jsx
'use client';

import { getTotalItems, useCartItems } from '@/components/cart/cartStore'; // adjust path if needed
import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useState } from 'react';

export default function TopBar({ onCartClick }) {
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
    <header className="absolute top-5 w-full z-50 bg-transparent">
      <div className="container mx-auto flex items-center justify-between px-4">
        {/* Logo */}
        <div className="flex-shrink-0 w-32 flex items-center">
          <Link href="/" aria-label="Home" className="flex items-center">
            <Image
              src="/lineflow.svg"
              alt="Logo"
              width={110}
              height={40}
              className="h-10 w-auto"
              priority
            />
          </Link>
        </div>

        {/* Menus */}
        <nav className="hidden lg:flex flex-1 justify-center gap-8">
          {menus.map(menu => {
            const isInternal = menu.url?.startsWith('/');
            const menuProps = {
              className: `transition-colors text-gray-800 hover:text-primary-500 font-medium ${menu.classes?.join(' ') || ''}`,
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

        {/* Right: Contact Button */}
        <div className="hidden lg:flex flex-shrink-0 w-32 justify-end">
          <Link
            href="/contact"
            className="bg-tertiary text-white px-5 py-3 rounded-full font-medium text-center hover:opacity-90 transition w-full"
          >
            Contact Us
          </Link>
        </div>

        {/* Cart Icon */}
        {/* <div className="flex items-center">
          <button
            className="relative group cursor-pointer ml-5"
            aria-label="Open cart"
            onClick={onCartClick}
          >
            <svg
              width={28}
              height={28}
              fill="none"
              stroke="currentColor"
              className="w-7 h-7 text-tertiary cursor-pointer"
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
        </div> */}
      </div>
    </header>
  );
}
