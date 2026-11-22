'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Login gagal.');
        return;
      }

      if (data.user.role === 'ADMIN') {
        router.push('/admin');
      } else {
        router.push('/penyewa');
      }
      router.refresh();
    } catch {
      setError('Gagal terhubung ke server.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#F5F5F7] px-4 text-[#1D1D1F]">
      <div className="w-full max-w-[400px] rounded-3xl border border-black/[0.06] bg-white p-8 shadow-[0_8px_30px_rgba(0,0,0,0.04)]">
        <div className="mb-7 text-center">
          <Link
            href="/"
            className="mx-auto mb-4 flex h-11 w-11 items-center justify-center rounded-2xl bg-[#1D1D1F] text-sm font-bold text-white shadow-sm"
          >
            SG
          </Link>
          <h1 className="text-2xl font-semibold tracking-tight text-[#1D1D1F]">
            Masuk ke SewaGarasi
          </h1>
          <p className="mt-1.5 text-sm text-[#6E6E73]">
            Gunakan akun Admin atau Penyewa Anda.
          </p>
        </div>

        {error && (
          <div className="mb-5 rounded-2xl bg-[#FF3B30]/10 px-4 py-3 text-[13px] font-medium text-[#D93025]">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1.5 block text-[13px] font-medium text-[#1D1D1F]">
              Email
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="nama@email.com"
              className="w-full rounded-xl border border-[#D2D2D7] bg-white px-3.5 py-2.5 text-sm text-[#1D1D1F] placeholder-[#86868B] outline-none transition focus:border-[#0071E3] focus:ring-4 focus:ring-[#0071E3]/15"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-[13px] font-medium text-[#1D1D1F]">
              Password
            </label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full rounded-xl border border-[#D2D2D7] bg-white px-3.5 py-2.5 text-sm text-[#1D1D1F] placeholder-[#86868B] outline-none transition focus:border-[#0071E3] focus:ring-4 focus:ring-[#0071E3]/15"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="mt-2 w-full rounded-full bg-[#0071E3] py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-[#0077ED] disabled:opacity-50"
          >
            {loading ? 'Memproses...' : 'Lanjutkan'}
          </button>
        </form>

        <div className="mt-6 border-t border-black/[0.06] pt-5 text-center text-[13px] text-[#6E6E73]">
          Belum memiliki akun penyewa?{' '}
          <Link href="/register" className="font-medium text-[#0071E3] hover:underline">
            Daftar sekarang
          </Link>
        </div>
      </div>
    </main>
  );
}