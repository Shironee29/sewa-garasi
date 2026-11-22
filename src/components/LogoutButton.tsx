'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function LogoutButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleLogout() {
    setLoading(true);
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      onClick={handleLogout}
      disabled={loading}
      className="rounded-full border border-black/[0.08] bg-white px-4 py-1.5 text-[13px] font-medium text-[#1D1D1F] transition hover:bg-black/[0.04] disabled:opacity-50"
    >
      {loading ? 'Keluar...' : 'Keluar'}
    </button>
  );
}