import Link from 'next/link';
import { getSession } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import { Garasi } from '@/domain/Garasi';
import { TipeGarasi } from '@/types/domain';
import LogoutButton from '@/components/LogoutButton';

export const instant = false;

const TIPE_META: {
  tipe: TipeGarasi;
  judul: string;
  subjudul: string;
  deskripsi: string;
}[] = [
  {
    tipe: 'SEPEDA',
    judul: 'Garasi Sepeda',
    subjudul: 'Sepeda & Sepeda Motor',
    deskripsi: 'Ruang parkir aman dan praktis khusus untuk sepeda maupun sepeda motor.',
  },
  {
    tipe: 'MOBIL',
    judul: 'Garasi Mobil',
    subjudul: 'Mobil Bensin & Mobil Listrik',
    deskripsi: 'Unit luas untuk mobil konvensional, serta dapat digunakan mobil listrik tanpa isi daya.',
  },
  {
    tipe: 'MOBIL_LISTRIK',
    judul: 'Garasi Mobil Listrik',
    subjudul: 'Khusus EV + Isi Daya Penuh',
    deskripsi: 'Dilengkapi fasilitas pengisian daya hingga penuh sesuai kapasitas baterai kendaraan.',
  },
];

export default async function HomePage() {
  const session = await getSession();

  const { data: rows } = await supabaseAdmin
    .from('garasi')
    .select('*')
    .order('kode_garasi', { ascending: true });

  const allGarasi = (rows ?? []).map((row) => {
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

  const summaryCards = TIPE_META.map((meta) => {
    const items = allGarasi.filter((g) => g.tipe === meta.tipe);
    const availableItems = items.filter((g) => g.status === 'AVAILABLE');
    const minHarian = items.length > 0 ? Math.min(...items.map((i) => i.harga_harian)) : 0;
    const minBulanan = items.length > 0 ? Math.min(...items.map((i) => i.harga_bulanan)) : 0;
    const tarifListrik =
      items.find((i) => i.harga_listrik_per_kwh !== null)?.harga_listrik_per_kwh ?? null;

    return {
      ...meta,
      totalCount: items.length,
      availableCount: availableItems.length,
      minHarian,
      minBulanan,
      tarifListrik,
    };
  });

  const totalAvailable = allGarasi.filter((g) => g.status === 'AVAILABLE').length;
  const dashboardHref = session?.role === 'ADMIN' ? '/admin' : '/penyewa';

  return (
    <main className="min-h-screen bg-[#F5F5F7] text-[#1D1D1F]">
      {/* Frosted Glass Navbar */}
      <header className="sticky top-0 z-40 border-b border-black/[0.06] bg-white/75 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3.5">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#1D1D1F] text-xs font-bold text-white shadow-sm">
              SG
            </div>
            <span className="text-[17px] font-semibold tracking-tight text-[#1D1D1F]">
              SewaGarasi
            </span>
          </Link>

          <div className="flex items-center gap-2.5">
            {session ? (
              <>
                <Link
                  href={dashboardHref}
                  className="rounded-full bg-[#0071E3] px-4 py-1.5 text-[13px] font-medium text-white shadow-sm transition hover:bg-[#0077ED]"
                >
                  Dashboard ({session.role})
                </Link>
                <LogoutButton />
              </>
            ) : (
              <>
                <Link
                  href="/login"
                  className="rounded-full px-4 py-1.5 text-[13px] font-medium text-[#1D1D1F] transition hover:bg-black/[0.05]"
                >
                  Masuk
                </Link>
                <Link
                  href="/register"
                  className="rounded-full bg-[#0071E3] px-4 py-1.5 text-[13px] font-medium text-white shadow-sm transition hover:bg-[#0077ED]"
                >
                  Daftar Penyewa
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="mx-auto max-w-6xl px-6 pt-16 pb-20">
        <div className="max-w-2xl">
          <span className="inline-flex items-center gap-2 rounded-full border border-black/[0.08] bg-white px-3.5 py-1 text-xs font-medium text-[#6E6E73] shadow-[0_1px_4px_rgba(0,0,0,0.03)]">
            <span
              className={`h-2 w-2 rounded-full ${
                totalAvailable > 0 ? 'bg-[#34C759]' : 'bg-[#FF3B30]'
              }`}
            />
            {totalAvailable} unit tersedia untuk disewa hari ini
          </span>

          <h1 className="mt-5 text-4xl font-semibold tracking-[-0.025em] text-[#1D1D1F] sm:text-5xl sm:leading-[1.1]">
            Penyewaan garasi modern.{' '}
            <span className="text-[#86868B]">Simpel, aman, transparan.</span>
          </h1>

          <p className="mt-4 text-[17px] leading-relaxed text-[#6E6E73]">
            Sewa harian atau bulanan dengan perhitungan tarif otomatis. Pilih unit yang
            tersedia langsung dari dashboard setelah akun KTP Anda terverifikasi.
          </p>

          <div className="mt-7 flex flex-wrap items-center gap-3">
            <Link
              href={session ? dashboardHref : '/register'}
              className="rounded-full bg-[#0071E3] px-6 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-[#0077ED]"
            >
              {session ? 'Buka Dashboard' : 'Mulai Sewa Sekarang'}
            </Link>
            {!session && (
              <Link
                href="/login"
                className="rounded-full border border-black/[0.08] bg-white px-6 py-2.5 text-sm font-medium text-[#1D1D1F] transition hover:bg-black/[0.03]"
              >
                Sudah punya akun? Masuk
              </Link>
            )}
          </div>
        </div>

        {/* 3 Kartu Ringkasan Tipe Garasi */}
        <div className="mt-16 mb-5 flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-xl font-semibold tracking-tight text-[#1D1D1F]">
            Pilihan Tipe Garasi
          </h2>
          <span className="text-xs font-medium text-[#86868B]">
            Paket bulanan hemat dengan tarif 25× harian
          </span>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          {summaryCards.map((card) => {
            const hasAvailable = card.availableCount > 0;
            return (
              <div
                key={card.tipe}
                className="flex flex-col justify-between rounded-3xl border border-black/[0.06] bg-white p-7 shadow-[0_2px_12px_rgba(0,0,0,0.03)] transition duration-200 hover:-translate-y-0.5 hover:shadow-[0_12px_28px_rgba(0,0,0,0.06)]"
              >
                <div>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-wider text-[#86868B]">
                        {card.subjudul}
                      </p>
                      <h3 className="mt-1 text-2xl font-semibold tracking-tight text-[#1D1D1F]">
                        {card.judul}
                      </h3>
                    </div>
                    <span
                      className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium ${
                        hasAvailable
                          ? 'bg-[#34C759]/12 text-[#1E8E3E]'
                          : 'bg-[#FF3B30]/12 text-[#D93025]'
                      }`}
                    >
                      {hasAvailable ? `${card.availableCount} Tersedia` : 'Penuh'}
                    </span>
                  </div>

                  <p className="mt-3 text-sm leading-relaxed text-[#6E6E73]">
                    {card.deskripsi}
                  </p>
                </div>

                <div className="mt-6 space-y-2.5 border-t border-black/[0.06] pt-4 text-[14px]">
                  {card.totalCount > 0 ? (
                    <>
                      <div className="flex items-center justify-between">
                        <span className="text-[#6E6E73]">Mulai dari (Harian)</span>
                        <span className="font-semibold text-[#1D1D1F]">
                          Rp {card.minHarian.toLocaleString('id-ID')}
                          <span className="text-xs font-normal text-[#86868B]"> /hari</span>
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-[#6E6E73]">Paket Bulanan (25×)</span>
                        <span className="font-semibold text-[#0071E3]">
                          Rp {card.minBulanan.toLocaleString('id-ID')}
                          <span className="text-xs font-normal text-[#86868B]"> /bln</span>
                        </span>
                      </div>
                      {card.tarifListrik !== null && (
                        <div className="flex items-center justify-between">
                          <span className="text-[#6E6E73]">Tarif Isi Daya EV</span>
                          <span className="font-medium text-[#1D1D1F]">
                            Rp {card.tarifListrik.toLocaleString('id-ID')}
                            <span className="text-xs font-normal text-[#86868B]"> /kWh</span>
                          </span>
                        </div>
                      )}
                    </>
                  ) : (
                    <p className="text-xs text-[#86868B]">Belum ada unit terdaftar untuk tipe ini.</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </main>
  );
}