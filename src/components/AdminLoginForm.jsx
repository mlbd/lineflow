// components/AdminLoginForm.jsx
'use client';

import { useState } from 'react';

export default function AdminLoginForm() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [website, setWebsite] = useState(''); // honeypot
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState('');

  async function onSubmit(e) {
    e.preventDefault();
    setMsg('');
    setLoading(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ username, password, website }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setMsg(data?.error || 'Login failed');
        setLoading(false);
        return;
      }
      // success: cookie is set by server; go home
      window.location.href = '/';
    } catch (err) {
      setMsg('Network error. Please try again.');
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      {/* Honeypot */}
      <input
        type="text"
        name="website"
        autoComplete="off"
        value={website}
        onChange={e => setWebsite(e.target.value)}
        className="hidden"
        tabIndex={-1}
      />

      <div>
        <label className="block text-sm font-medium mb-1">Username</label>
        <input
          className="w-full border rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500"
          value={username}
          onChange={e => setUsername(e.target.value)}
          autoComplete="username"
          placeholder="admin"
          required
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">Password</label>
        <input
          type="password"
          className="w-full border rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500"
          value={password}
          onChange={e => setPassword(e.target.value)}
          autoComplete="current-password"
          placeholder="••••••••"
          required
        />
      </div>

      {msg && <div className="text-sm text-red-600">{msg}</div>}

      <button
        type="submit"
        disabled={loading}
        className={`w-full py-2.5 rounded-lg font-semibold text-white transition cursor-pointer 
          ${loading ? 'bg-gray-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'}`}
      >
        {loading ? 'Signing in…' : 'Sign in'}
      </button>
    </form>
  );
}
