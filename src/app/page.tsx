import Link from 'next/link';
import { getSession } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import { Garasi } from '@/domain/Garasi';

export const instant = false;

export default async function HomePage() {
  const session = await getSession();

  const { data: rows } = await supabaseAdmin
    .from('garasi')
    .select('*')
    .order('kode_garasi', { ascending: true });

  const garasiList = (rows ?? []).map((row) => {
    const domain = Garasi.fromRow(row);
    return {
      ...row,
      harga_harian: Number(row.harga_harian),
      harga_bulanan: domain.getHargaBulanan(),
      harga_listrik_per_kwh: row.harga_listrik_per_kwh
        ? Number(row.harga_listrik_per_kwh)
        : null,
    };
  });

  const dashboardHref = session?.role === 'ADMIN' ? '/admin' : '/penyewa';

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100">
      {/* Navbar */}
      <header className="border-b border-zinc-800 bg-zinc-950/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2">
            <span className="h-3 w-3 rounded-full bg-amber-500" />
            <span className="text-lg font-bold tracking-tight">SewaGarasi</span>
          </div>

          <div className="flex items-center gap-3">
            {session ? (
              <Link
                href={dashboardHref}
                className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-zinc-950 transition hover:bg-amber-400"
              >
                Buka Dashboard ({session.role})
              </Link>
            ) : (
              <>
                <Link
                  href="/login"
                  className="rounded-lg border border-zinc-700 px-4 py-2 text-sm font-medium text-zinc-200 transition hover:border-zinc-500 hover:text-white"
                >
                  Masuk
                </Link>
                <Link
                  href="/register"
                  className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-zinc-950 transition hover:bg-amber-400"
                >
                  Daftar Penyewa
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="mx-auto max-w-6xl px-6 py-12">
        <div className="mb-10 max-w-2xl">
          <h1 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
            Sistem Penyewaan Garasi Harian &amp; Bulanan
          </h1>
          <p className="mt-3 text-zinc-400">
            Pilihan garasi aman untuk sepeda, motor, mobil konvensional, hingga
            mobil listrik lengkap dengan fasilitas pengisian daya.
          </p>
        </div>

        {/* Katalog Garasi */}
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-zinc-200">
            Katalog Unit Garasi
          </h2>
          <span className="text-sm text-zinc-400">
            Total {garasiList.length} unit terdaftar
          </span>
        </div>

        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {garasiList.map((g) => (
            <div
              key={g.id}
              className="rounded-xl border border-zinc-800 bg-zinc-900 p-5 transition hover:border-zinc-700"
            >
              <div className="flex items-start justify-between">
                <div>
                  <span className="text-xs font-medium uppercase tracking-wider text-zinc-400">
                    {g.tipe.replace('_', ' ')}
                  </span>
                  <h3 className="mt-1 text-2xl font-bold text-white">
                    {g.kode_garasi}
                  </h3>
                </div>
                <span
                  className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                    g.status === 'AVAILABLE'
                      ? 'bg-emerald-500/15 text-emerald-400'
                      : 'bg-red-500/15 text-red-400'
                  }`}
                >
                  {g.status}
                </span>
              </div>

              <div className="mt-5 space-y-2 border-t border-zinc-800 pt-4 text-sm">
                <div className="flex justify-between">
                  <span className="text-zinc-400">Tarif Harian</span>
                  <span className="font-semibold text-zinc-100">
                    Rp {g.harga_harian.toLocaleString('id-ID')} / hari
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-400">Tarif Bulanan (25×)</span>
                  <span className="font-semibold text-amber-400">
                    Rp {g.harga_bulanan.toLocaleString('id-ID')} / bln
                  </span>
                </div>
                {g.harga_listrik_per_kwh && (
                  <div className="flex justify-between">
                    <span className="text-zinc-400">Tarif Listrik EV</span>
                    <span className="font-medium text-sky-400">
                      Rp {g.harga_listrik_per_kwh.toLocaleString('id-ID')} / kWh
                    </span>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}