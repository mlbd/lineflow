// ./src/components/common/Header.jsx
'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';

export default function Header() {
  const [menus, setMenus] = useState([]);
  const [isOpen, setIsOpen] = useState(false);

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
    <header className="w-full z-50 bg-transparent">
      <div className="container mx-auto flex items-center justify-between px-4">
        {/* Left: Logo */}
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

        {/* Middle: Nav */}
        <nav className="hidden lg:flex flex-1 justify-center gap-8">
          {menus.map(menu => {
            const isInternal = menu.url?.startsWith('/');
            const menuProps = {
              className: `transition-colors text-gray-800 hover:text-accent font-medium ${menu.classes?.join(' ') || ''}`,
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

        {/* Mobile Menu Trigger */}
        <button
          className="lg:hidden flex items-center justify-center w-10 h-10"
          onClick={() => setIsOpen(true)}
          aria-label="Open menu"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={2}
            stroke="currentColor"
            className="w-7 h-7 text-gray-800"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 6h18M3 12h18M3 18h18" />
          </svg>
        </button>
      </div>

      {/* Mobile Slide-in Panel */}
      {isOpen && (
        <div className="fixed inset-0 z-50">
          {/* Overlay */}
          <div className="absolute inset-0 bg-black/50" onClick={() => setIsOpen(false)}></div>

          {/* Panel */}
          <div className="absolute top-0 right-0 w-80 max-w-full h-full bg-white shadow-lg transform transition-transform duration-300 translate-x-0">
            <div className="flex items-center justify-between p-4 border-b">
              <Image
                src="/allaround.svg"
                alt="Logo"
                width={100}
                height={36}
                className="h-9 w-auto"
                priority
              />
              <button onClick={() => setIsOpen(false)} aria-label="Close menu" className="p-2">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={2}
                  stroke="currentColor"
                  className="w-7 h-7 text-gray-800"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Menu Items */}
            <nav className="flex flex-col divide-y">
              {menus.map(menu => {
                const isInternal = menu.url?.startsWith('/');
                const menuProps = {
                  className: `px-6 py-4 text-gray-800 hover:text-accent transition font-medium ${menu.classes?.join(' ') || ''}`,
                  target: menu.target || undefined,
                  title: menu.attr_title || undefined,
                  onClick: () => setIsOpen(false),
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

            {/* Bottom Contact Us Button */}
            <div className="absolute bottom-0 left-0 w-full p-4 border-t">
              <Link
                href="/contact"
                className="w-full block text-center bg-tertiary text-white px-5 py-3 rounded-lg font-medium hover:opacity-90 transition"
              >
                Contact Us
              </Link>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
