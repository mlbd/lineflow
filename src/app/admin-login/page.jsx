// app/admin-login/page.jsx
'use client';

import AdminLoginForm from '@/components/AdminLoginForm';

export default function AdminLoginPage() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="w-full max-w-[380px] bg-white border rounded-2xl shadow-sm p-6">
        <h1 className="text-2xl font-semibold text-center mb-1">Sign in</h1>
        <p className="text-sm text-gray-500 text-center mb-6">Authorized access only</p>
        <AdminLoginForm />
      </div>
    </main>
  );
}
