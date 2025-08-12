// components/LogoutButton.jsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { LogOut } from 'lucide-react';

export default function LogoutButton({ title = 'Log out', className = '', size = 18 }) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const onLogout = async () => {
    if (loading) return;
    setLoading(true);
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch (_) {
      // ignore
    } finally {
      router.replace('/admin-login');
      router.refresh();
    }
  };

  return (
    <button
      type="button"
      onClick={onLogout}
      disabled={loading}
      title={title} // shows native tooltip on hover
      aria-label={title} // accessible for screen readers
      className={`inline-flex cursor-pointer items-center justify-center rounded-md p-2
                  text-white hover:text-red-600 
                  disabled:opacity-60 disabled:cursor-not-allowed ${className}`}
    >
      <LogOut size={size} className={loading ? 'animate-pulse' : ''} aria-hidden="true" />
      <span className="sr-only">{title}</span>
    </button>
  );
}
