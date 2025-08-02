// src/components/page/TopBar.jsx
import { useEffect, useState } from 'react';

export default function TopBar({ wpUrl }) {
  const [menus, setMenus] = useState([]);

  useEffect(() => {
    async function fetchMenus() {
      try {
        const res = await fetch(`${wpUrl}/wp-json/mini-sites/v1/menu?name=main-menu`);
        const menuData = await res.json();
        setMenus(menuData);
        console.log('Fetched menus:', menuData); // Log menus for debugging
      } catch (e) {
        console.error('Failed to fetch menus:', e);
      }
    }
    fetchMenus();
  }, [wpUrl]);

  return (
    <header className="flex items-center justify-between h-16 px-4 bg-deepblue shadow z-50">
        <div className="max-w-[var(--site-max-width)] w-full mx-auto flex items-center justify-between h-16 px-4">
            {/* Left: Logo */}
            <div className="flex items-center">
            <a href="/">
            <img src="/allaround.svg" alt="Logo" className="h-10 w-auto" />
            </a>
            </div>
            {/* Middle: Menus */}
            <nav className="flex gap-6">
                {menus.map(menu => (
                    <a
                        key={menu.id}
                        href={menu.url}
                        className={`transition-colors text-white hover:text-accent font-medium ${menu.classes?.join(' ') || ''}`}
                        target={menu.target || undefined}
                        title={menu.attr_title || undefined}
                    >
                        {menu.title}
                    </a>
                ))}
            </nav>
            {/* Right: Cart Icon */}
            <div className="flex items-center">
                <button className="relative group" aria-label="Open cart">
                    <svg width={28} height={28} fill="none" stroke="currentColor" className="w-7 h-7 text-white cursor-pointer">
                        <path d="M6 6h15l-1.5 9h-13z" strokeWidth={2} />
                        <circle cx={9} cy={23} r={1.5} />
                        <circle cx={21} cy={23} r={1.5} />
                    </svg>
                    {/* Cart count badge, add logic later */}
                </button>
            </div>
        </div>
    </header>
  );
}
