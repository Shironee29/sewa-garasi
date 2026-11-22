'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function RegisterPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    nama_lengkap: '',
    nik: '',
    no_telp: '',
    email: '',
    password: '',
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Registrasi gagal.');
        return;
      }

      setSuccess(data.message);
      setTimeout(() => {
        router.push('/login');
      }, 1500);
    } catch {
      setError('Gagal terhubung ke server.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#F5F5F7] px-4 py-12 text-[#1D1D1F]">
      <div className="w-full max-w-[440px] rounded-3xl border border-black/[0.06] bg-white p-8 shadow-[0_8px_30px_rgba(0,0,0,0.04)]">
        <div className="mb-7 text-center">
          <Link
            href="/"
            className="mx-auto mb-4 flex h-11 w-11 items-center justify-center rounded-2xl bg-[#1D1D1F] text-sm font-bold text-white shadow-sm"
          >
            SG
          </Link>
          <h1 className="text-2xl font-semibold tracking-tight text-[#1D1D1F]">
            Buat Akun Penyewa
          </h1>
          <p className="mt-1.5 text-sm text-[#6E6E73]">
            Lengkapi identitas KTP untuk verifikasi Admin.
          </p>
        </div>

        {error && (
          <div className="mb-5 rounded-2xl bg-[#FF3B30]/10 px-4 py-3 text-[13px] font-medium text-[#D93025]">
            {error}
          </div>
        )}

        {success && (
          <div className="mb-5 rounded-2xl bg-[#34C759]/12 px-4 py-3 text-[13px] font-medium text-[#1E8E3E]">
            {success} Mengalihkan ke halaman masuk...
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1.5 block text-[13px] font-medium text-[#1D1D1F]">
              Nama Lengkap (sesuai KTP)
            </label>
            <input
              type="text"
              required
              value={form.nama_lengkap}
              onChange={(e) => setForm({ ...form, nama_lengkap: e.target.value })}
              placeholder="Budi Santoso"
              className="w-full rounded-xl border border-[#D2D2D7] bg-white px-3.5 py-2.5 text-sm text-[#1D1D1F] placeholder-[#86868B] outline-none transition focus:border-[#0071E3] focus:ring-4 focus:ring-[#0071E3]/15"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-[13px] font-medium text-[#1D1D1F]">
              NIK (16 Digit)
            </label>
            <input
              type="text"
              required
              maxLength={16}
              pattern="\d{16}"
              value={form.nik}
              onChange={(e) =>
                setForm({ ...form, nik: e.target.value.replace(/\D/g, '') })
              }
              placeholder="3578012345678901"
              className="w-full rounded-xl border border-[#D2D2D7] bg-white px-3.5 py-2.5 text-sm text-[#1D1D1F] placeholder-[#86868B] outline-none transition focus:border-[#0071E3] focus:ring-4 focus:ring-[#0071E3]/15"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-[13px] font-medium text-[#1D1D1F]">
              Nomor Telepon / WhatsApp
            </label>
            <input
              type="text"
              required
              value={form.no_telp}
              onChange={(e) => setForm({ ...form, no_telp: e.target.value })}
              placeholder="081234567890"
              className="w-full rounded-xl border border-[#D2D2D7] bg-white px-3.5 py-2.5 text-sm text-[#1D1D1F] placeholder-[#86868B] outline-none transition focus:border-[#0071E3] focus:ring-4 focus:ring-[#0071E3]/15"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-[13px] font-medium text-[#1D1D1F]">
              Email
            </label>
            <input
              type="email"
              required
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              placeholder="budi@email.com"
              className="w-full rounded-xl border border-[#D2D2D7] bg-white px-3.5 py-2.5 text-sm text-[#1D1D1F] placeholder-[#86868B] outline-none transition focus:border-[#0071E3] focus:ring-4 focus:ring-[#0071E3]/15"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-[13px] font-medium text-[#1D1D1F]">
              Password (minimal 6 karakter)
            </label>
            <input
              type="password"
              required
              minLength={6}
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              placeholder="••••••••"
              className="w-full rounded-xl border border-[#D2D2D7] bg-white px-3.5 py-2.5 text-sm text-[#1D1D1F] placeholder-[#86868B] outline-none transition focus:border-[#0071E3] focus:ring-4 focus:ring-[#0071E3]/15"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="mt-2 w-full rounded-full bg-[#0071E3] py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-[#0077ED] disabled:opacity-50"
          >
            {loading ? 'Mendaftarkan...' : 'Daftar Sekarang'}
          </button>
        </form>

        <div className="mt-6 border-t border-black/[0.06] pt-5 text-center text-[13px] text-[#6E6E73]">
          Sudah punya akun?{' '}
          <Link href="/login" className="font-medium text-[#0071E3] hover:underline">
            Masuk di sini
          </Link>
        </div>
      </div>
    </main>
  );
}