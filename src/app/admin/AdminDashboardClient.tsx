'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { StatusGarasi, StatusKtp, TipeGarasi, TipeKendaraan, TipeSewa } from '@/types/domain';

interface AdminProfile {
  id: number;
  email: string;
  nama_lengkap: string | null;
}

interface PenyewaItem {
  id: number;
  email: string;
  nik: string | null;
  nama_lengkap: string | null;
  no_telp: string | null;
  status_ktp: StatusKtp;
  created_at: string;
}

interface GarasiItem {
  id: number;
  kode_garasi: string;
  tipe: TipeGarasi;
  harga_harian: number;
  harga_bulanan: number;
  harga_listrik_per_kwh: number | null;
  status: StatusGarasi;
}

interface PerpanjanganItem {
  id: number;
  tgl_selesai_lama: string;
  tgl_selesai_baru: string;
  tambahan_hari: number;
  sisa_biaya: number;
  bukti_bayar: string;
}

interface TransaksiItem {
  id: number;
  tipe_sewa: TipeSewa;
  jumlah_hari: number;
  tgl_mulai: string;
  tgl_selesai: string;
  biaya_sewa: number;
  biaya_listrik: number;
  total_biaya: number;
  bukti_pelunasan: string;
  status: 'ACTIVE' | 'COMPLETED';
  penyewa: { nama_lengkap: string; email: string; nik: string; no_telp: string } | null;
  garasi: { kode_garasi: string; tipe: TipeGarasi; harga_harian: number } | null;
  kendaraan: { merek_tipe: string; no_plat: string | null; tipe: TipeKendaraan } | null;
  perpanjangan: PerpanjanganItem[];
}

interface LaporanResponse {
  mode: string;
  ringkasan: {
    total_transaksi: number;
    total_biaya_sewa: number;
    total_biaya_listrik: number;
    total_pendapatan: number;
  };
  rekap: {
    label: string;
    jumlah_transaksi: number;
    total_biaya_sewa: number;
    total_biaya_listrik: number;
    total_pendapatan: number;
  }[];
  detail: TransaksiItem[];
}

const NAMA_BULAN = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
];

function getTodayString(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export default function AdminDashboardClient() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'ktp' | 'garasi' | 'transaksi' | 'laporan'>('ktp');

  const [admin, setAdmin] = useState<AdminProfile | null>(null);
  const [penyewaList, setPenyewaList] = useState<PenyewaItem[]>([]);
  const [garasiList, setGarasiList] = useState<GarasiItem[]>([]);
  const [transaksiList, setTransaksiList] = useState<TransaksiItem[]>([]);
  const [loadingInit, setLoadingInit] = useState(true);
  const [feedback, setFeedback] = useState<{ type: 'error' | 'success'; text: string } | null>(null);

  // State Form Garasi
  const [editingGarasiId, setEditingGarasiId] = useState<number | null>(null);
  const [gForm, setGForm] = useState({
    kode_garasi: '',
    tipe: 'SEPEDA' as TipeGarasi,
    jumlah: '1',
    harga_harian: '',
    harga_listrik_per_kwh: '',
    status: 'AVAILABLE' as StatusGarasi,
  });
  const [submittingGarasi, setSubmittingGarasi] = useState(false);

  // State Filter Transaksi
  const [trxFilter, setTrxFilter] = useState<'HARI_INI' | 'SEMUA'>('HARI_INI');

  // State Modal Perpanjangan Sewa
  const [extendTarget, setExtendTarget] = useState<TransaksiItem | null>(null);
  const [tglSelesaiBaru, setTglSelesaiBaru] = useState('');
  const [buktiPerpanjangan, setBuktiPerpanjangan] = useState<File | null>(null);
  const [submittingExtend, setSubmittingExtend] = useState(false);

  // State Laporan Sewa Garasi
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;
  const [laporanMode, setLaporanMode] = useState<'bulanan' | 'harian' | 'tipe' | 'penyewa'>('bulanan');
  const [laporanTahun, setLaporanTahun] = useState<number>(currentYear);
  const [laporanBulan, setLaporanBulan] = useState<number>(currentMonth);
  const [laporanTipe, setLaporanTipe] = useState<string>('ALL');
  const [laporanPenyewaId, setLaporanPenyewaId] = useState<string>('ALL');
  const [laporanData, setLaporanData] = useState<LaporanResponse | null>(null);
  const [loadingLaporan, setLoadingLaporan] = useState(false);

  const todayStr = useMemo(() => getTodayString(), []);

  const loadAllData = useCallback(async () => {
    try {
      const [meRes, pRes, gRes, tRes] = await Promise.all([
        fetch('/api/auth/me'),
        fetch('/api/admin/penyewa'),
        fetch('/api/garasi'),
        fetch('/api/transaksi'),
      ]);

      if (meRes.ok) {
        const data = await meRes.json();
        setAdmin(data.user);
      }
      if (pRes.ok) {
        const data = await pRes.json();
        setPenyewaList(data.penyewa ?? []);
      }
      if (gRes.ok) {
        const data = await gRes.json();
        setGarasiList(data.garasi ?? []);
      }
      if (tRes.ok) {
        const data = await tRes.json();
        setTransaksiList(data.transaksi ?? []);
      }
    } finally {
      setLoadingInit(false);
    }
  }, []);

  useEffect(() => {
    loadAllData();
  }, [loadAllData]);

  useEffect(() => {
    if (activeTab !== 'laporan') return;

    const controller = new AbortController();
    async function fetchLaporan() {
      setLoadingLaporan(true);
      try {
        const params = new URLSearchParams({
          mode: laporanMode,
          tahun: String(laporanTahun),
          bulan: String(laporanBulan),
          tipe_garasi: laporanTipe,
          penyewa_id: laporanPenyewaId,
        });
        const res = await fetch(`/api/admin/laporan?${params.toString()}`, {
          signal: controller.signal,
        });
        if (res.ok) {
          const data = await res.json();
          setLaporanData(data);
        }
      } catch (err) {
        if ((err as Error).name !== 'AbortError') {
          setFeedback({ type: 'error', text: 'Gagal memuat data laporan.' });
        }
      } finally {
        setLoadingLaporan(false);
      }
    }

    fetchLaporan();
    return () => controller.abort();
  }, [activeTab, laporanMode, laporanTahun, laporanBulan, laporanTipe, laporanPenyewaId]);

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
    router.refresh();
  }

  async function handleVerifikasiKtp(penyewaId: number, statusKtp: 'APPROVED' | 'REJECTED') {
    setFeedback(null);
    const res = await fetch(`/api/admin/penyewa/${penyewaId}/verifikasi`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status_ktp: statusKtp }),
    });
    const data = await res.json();

    if (!res.ok) {
      setFeedback({ type: 'error', text: data.error || 'Gagal memperbarui status KTP.' });
      return;
    }

    setFeedback({ type: 'success', text: data.message });
    await loadAllData();
  }

  function startEditGarasi(g: GarasiItem) {
    setEditingGarasiId(g.id);
    setGForm({
      kode_garasi: g.kode_garasi,
      tipe: g.tipe,
      jumlah: '1',
      harga_harian: String(g.harga_harian),
      harga_listrik_per_kwh: g.harga_listrik_per_kwh ? String(g.harga_listrik_per_kwh) : '',
      status: g.status,
    });
    setFeedback(null);
  }

  function resetGarasiForm() {
    setEditingGarasiId(null);
    setGForm({
      kode_garasi: '',
      tipe: 'SEPEDA',
      jumlah: '1',
      harga_harian: '',
      harga_listrik_per_kwh: '',
      status: 'AVAILABLE',
    });
  }

  async function handleSubmitGarasi(e: React.FormEvent) {
    e.preventDefault();
    setFeedback(null);
    setSubmittingGarasi(true);

    try {
      const url = editingGarasiId ? `/api/garasi/${editingGarasiId}` : '/api/garasi';
      const method = editingGarasiId ? 'PATCH' : 'POST';

      const payload = editingGarasiId
        ? {
            kode_garasi: gForm.kode_garasi,
            tipe: gForm.tipe,
            harga_harian: Number(gForm.harga_harian),
            harga_listrik_per_kwh:
              gForm.tipe === 'MOBIL_LISTRIK' ? Number(gForm.harga_listrik_per_kwh) : null,
            status: gForm.status,
          }
        : {
            tipe: gForm.tipe,
            jumlah: Number(gForm.jumlah),
            harga_harian: Number(gForm.harga_harian),
            harga_listrik_per_kwh:
              gForm.tipe === 'MOBIL_LISTRIK' ? Number(gForm.harga_listrik_per_kwh) : null,
          };

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        setFeedback({ type: 'error', text: data.error || 'Gagal menyimpan data garasi.' });
        return;
      }

      setFeedback({ type: 'success', text: data.message });
      resetGarasiForm();
      await loadAllData();
    } finally {
      setSubmittingGarasi(false);
    }
  }

  async function handleDeleteGarasi(id: number, kode: string) {
    if (!confirm(`Hapus unit garasi ${kode}?`)) return;
    setFeedback(null);

    const res = await fetch(`/api/garasi/${id}`, { method: 'DELETE' });
    const data = await res.json();

    if (!res.ok) {
      setFeedback({ type: 'error', text: data.error || 'Gagal menghapus garasi.' });
      return;
    }

    setFeedback({ type: 'success', text: data.message });
    await loadAllData();
  }

  async function handleSelesaiSewa(transaksiId: number, kodeGarasi: string) {
    if (!confirm(`Tandai transaksi garasi ${kodeGarasi} selesai (COMPLETED) dan bebaskan unit?`)) {
      return;
    }
    setFeedback(null);

    const res = await fetch(`/api/transaksi/${transaksiId}/selesai`, {
      method: 'PATCH',
    });
    const data = await res.json();

    if (!res.ok) {
      setFeedback({ type: 'error', text: data.error || 'Gagal menyelesaikan transaksi.' });
      return;
    }

    setFeedback({ type: 'success', text: data.message });
    await loadAllData();
  }

  function openExtendModal(trx: TransaksiItem) {
    setExtendTarget(trx);
    const [y, m, d] = trx.tgl_selesai.split('-').map(Number);
    const nextDay = new Date(y, m - 1, d + 1);
    const yyyy = nextDay.getFullYear();
    const mm = String(nextDay.getMonth() + 1).padStart(2, '0');
    const dd = String(nextDay.getDate()).padStart(2, '0');
    setTglSelesaiBaru(`${yyyy}-${mm}-${dd}`);
    setBuktiPerpanjangan(null);
    setFeedback(null);
  }

  async function handleSubmitPerpanjangan(e: React.FormEvent) {
    e.preventDefault();
    if (!extendTarget || !buktiPerpanjangan) return;

    setFeedback(null);
    setSubmittingExtend(true);

    try {
      const formData = new FormData();
      formData.append('tgl_selesai_baru', tglSelesaiBaru);
      formData.append('bukti_bayar', buktiPerpanjangan);

      const res = await fetch(`/api/transaksi/${extendTarget.id}/perpanjangan`, {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) {
        setFeedback({ type: 'error', text: data.error || 'Gagal memproses perpanjangan.' });
        return;
      }

      setFeedback({ type: 'success', text: data.message });
      setExtendTarget(null);
      setBuktiPerpanjangan(null);
      await loadAllData();
    } finally {
      setSubmittingExtend(false);
    }
  }

  const displayedTransaksi = useMemo(() => {
    if (trxFilter === 'SEMUA') return transaksiList;
    return transaksiList.filter(
      (t) => t.status === 'ACTIVE' && t.tgl_mulai <= todayStr && t.tgl_selesai >= todayStr
    );
  }, [transaksiList, trxFilter, todayStr]);

  if (loadingInit) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F5F5F7] text-sm text-[#86868B]">
        Memuat panel administrator...
      </div>
    );
  }

  const pendingKtpCount = penyewaList.filter((p) => p.status_ktp === 'PENDING').length;
  const availableGarasiCount = garasiList.filter((g) => g.status === 'AVAILABLE').length;
  const activeTodayCount = transaksiList.filter(
    (t) => t.status === 'ACTIVE' && t.tgl_mulai <= todayStr && t.tgl_selesai >= todayStr
  ).length;

  return (
    <div className="min-h-screen bg-[#F5F5F7] text-[#1D1D1F]">
      {/* Frosted Glass Navbar */}
      <header className="sticky top-0 z-40 border-b border-black/[0.06] bg-white/75 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-6 py-3.5">
          <div className="flex items-center gap-3">
            <Link href="/" className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#1D1D1F] text-xs font-bold text-white shadow-sm">
                SG
              </div>
              <span className="text-[17px] font-semibold tracking-tight text-[#1D1D1F]">
                SewaGarasi
              </span>
            </Link>
            <span className="rounded-full bg-[#0071E3]/10 px-2.5 py-0.5 text-xs font-medium text-[#0071E3]">
              Admin
            </span>
          </div>

          <div className="flex items-center gap-3.5">
            <div className="text-right">
              <p className="text-[13px] font-semibold text-[#1D1D1F]">
                {admin?.nama_lengkap ?? 'Administrator'}
              </p>
              <p className="text-[11px] text-[#86868B]">{admin?.email}</p>
            </div>
            <button
              onClick={handleLogout}
              className="rounded-full border border-black/[0.08] bg-white px-3.5 py-1.5 text-xs font-medium text-[#1D1D1F] transition hover:bg-black/[0.04]"
            >
              Keluar
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-8">
        {/* Ringkasan Statistik */}
        <div className="mb-8 grid gap-4 sm:grid-cols-3">
          <div className="rounded-3xl border border-black/[0.06] bg-white p-6 shadow-[0_2px_12px_rgba(0,0,0,0.03)]">
            <p className="text-xs font-medium text-[#86868B]">Verifikasi KTP Pending</p>
            <p className="mt-2 text-3xl font-semibold tracking-tight text-[#FF9500]">
              {pendingKtpCount}
            </p>
            <p className="mt-1 text-xs text-[#6E6E73]">dari {penyewaList.length} penyewa terdaftar</p>
          </div>

          <div className="rounded-3xl border border-black/[0.06] bg-white p-6 shadow-[0_2px_12px_rgba(0,0,0,0.03)]">
            <p className="text-xs font-medium text-[#86868B]">Garasi Tersedia</p>
            <p className="mt-2 text-3xl font-semibold tracking-tight text-[#34C759]">
              {availableGarasiCount}{' '}
              <span className="text-base font-normal text-[#86868B]">/ {garasiList.length}</span>
            </p>
            <p className="mt-1 text-xs text-[#6E6E73]">
              {garasiList.length - availableGarasiCount} unit sedang digunakan
            </p>
          </div>

          <div className="rounded-3xl border border-black/[0.06] bg-white p-6 shadow-[0_2px_12px_rgba(0,0,0,0.03)]">
            <p className="text-xs font-medium text-[#86868B]">Disewa Hari Ini</p>
            <p className="mt-2 text-3xl font-semibold tracking-tight text-[#1D1D1F]">
              {activeTodayCount}
            </p>
            <p className="mt-1 text-xs text-[#6E6E73]">dari {transaksiList.length} total transaksi</p>
          </div>
        </div>

        {/* Feedback */}
        {feedback && (
          <div
            className={`mb-6 rounded-2xl px-5 py-3.5 text-[13px] font-medium ${
              feedback.type === 'error'
                ? 'bg-[#FF3B30]/10 text-[#D93025]'
                : 'bg-[#34C759]/12 text-[#1E8E3E]'
            }`}
          >
            {feedback.text}
          </div>
        )}

        {/* Apple Segmented Control Navigation */}
        <div className="mb-8 inline-flex flex-wrap rounded-full bg-black/[0.05] p-1">
          {(
            [
              { key: 'ktp', label: `Verifikasi KTP (${pendingKtpCount})` },
              { key: 'garasi', label: `Kelola Garasi (${garasiList.length})` },
              { key: 'transaksi', label: `Perpanjang & Sewa (${activeTodayCount})` },
              { key: 'laporan', label: 'Laporan Sewa' },
            ] as const
          ).map((tab) => (
            <button
              key={tab.key}
              onClick={() => {
                setActiveTab(tab.key);
                setFeedback(null);
              }}
              className={`rounded-full px-4 py-1.5 text-[13px] font-medium transition ${
                activeTab === tab.key
                  ? 'bg-white text-[#1D1D1F] shadow-[0_1px_4px_rgba(0,0,0,0.08)]'
                  : 'text-[#6E6E73] hover:text-[#1D1D1F]'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* TAB 1: VERIFIKASI KTP */}
        {activeTab === 'ktp' && (
          <div className="overflow-x-auto rounded-3xl border border-black/[0.06] bg-white shadow-[0_2px_12px_rgba(0,0,0,0.03)]">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-black/[0.06] text-[11px] font-semibold uppercase tracking-wider text-[#86868B]">
                <tr>
                  <th className="px-6 py-4">Penyewa</th>
                  <th className="px-6 py-4">NIK</th>
                  <th className="px-6 py-4">No. Telepon</th>
                  <th className="px-6 py-4">Status KTP</th>
                  <th className="px-6 py-4 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/[0.06]">
                {penyewaList.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-10 text-center text-[#86868B]">
                      Belum ada penyewa terdaftar.
                    </td>
                  </tr>
                ) : (
                  penyewaList.map((p) => (
                    <tr key={p.id} className="transition hover:bg-[#F5F5F7]/60">
                      <td className="px-6 py-4">
                        <p className="font-semibold text-[#1D1D1F]">{p.nama_lengkap}</p>
                        <p className="text-xs text-[#86868B]">{p.email}</p>
                      </td>
                      <td className="px-6 py-4 font-mono text-xs text-[#1D1D1F]">{p.nik}</td>
                      <td className="px-6 py-4 text-[#6E6E73]">{p.no_telp}</td>
                      <td className="px-6 py-4">
                        <span
                          className={`rounded-full px-3 py-1 text-xs font-medium ${
                            p.status_ktp === 'APPROVED'
                              ? 'bg-[#34C759]/12 text-[#1E8E3E]'
                              : p.status_ktp === 'REJECTED'
                              ? 'bg-[#FF3B30]/12 text-[#D93025]'
                              : 'bg-[#FF9500]/12 text-[#B26B00]'
                          }`}
                        >
                          {p.status_ktp}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`rounded-full px-3 py-1 text-xs font-medium ${
                            p.status_ktp === 'APPROVED'
                              ? 'bg-[#34C759]/12 text-[#1E8E3E]'
                              : p.status_ktp === 'REJECTED'
                              ? 'bg-[#FF3B30]/12 text-[#D93025]'
                              : 'bg-[#FF9500]/12 text-[#B26B00]'
                          }`}
                        >
                          {p.status_ktp}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        {p.status_ktp === 'PENDING' ? (
                          <div className="flex justify-end gap-2">
                            <button
                              onClick={() => handleVerifikasiKtp(p.id, 'APPROVED')}
                              className="rounded-full bg-[#34C759] px-3.5 py-1.5 text-xs font-medium text-white transition hover:opacity-90"
                            >
                              Approve
                            </button>
                            <button
                              onClick={() => handleVerifikasiKtp(p.id, 'REJECTED')}
                              className="rounded-full bg-[#FF3B30]/12 px-3.5 py-1.5 text-xs font-medium text-[#D93025] transition hover:bg-[#FF3B30]/20"
                            >
                              Reject
                            </button>
                          </div>
                        ) : (
                          <span className="text-xs font-medium text-[#86868B]">
                            Sudah diverifikasi
                          </span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* TAB 2: KELOLA GARASI */}
        {activeTab === 'garasi' && (
          <div className="grid gap-8 lg:grid-cols-3">
            <form
              onSubmit={handleSubmitGarasi}
              className="h-fit space-y-4 rounded-3xl border border-black/[0.06] bg-white p-6 shadow-[0_2px_12px_rgba(0,0,0,0.03)]"
            >
              <div className="flex items-center justify-between">
                <h2 className="text-[17px] font-semibold tracking-tight text-[#1D1D1F]">
                  {editingGarasiId ? `Edit ${gForm.kode_garasi}` : 'Buat Garasi Baru'}
                </h2>
                {editingGarasiId && (
                  <button
                    type="button"
                    onClick={resetGarasiForm}
                    className="text-xs font-medium text-[#0071E3] hover:underline"
                  >
                    Batal
                  </button>
                )}
              </div>

              {!editingGarasiId && (
                <p className="text-xs leading-relaxed text-[#6E6E73]">
                  Kode dibuat otomatis berurutan: <strong>S001</strong> (Sepeda),{' '}
                  <strong>C001</strong> (Mobil), <strong>E001</strong> (Mobil Listrik).
                </p>
              )}

              <div>
                <label className="mb-1.5 block text-[13px] font-medium text-[#1D1D1F]">
                  Tipe Garasi
                </label>
                <select
                  value={gForm.tipe}
                  disabled={Boolean(editingGarasiId)}
                  onChange={(e) => setGForm({ ...gForm, tipe: e.target.value as TipeGarasi })}
                  className="w-full rounded-xl border border-[#D2D2D7] bg-white px-3.5 py-2.5 text-sm text-[#1D1D1F] outline-none transition focus:border-[#0071E3] focus:ring-4 focus:ring-[#0071E3]/15 disabled:bg-[#F5F5F7] disabled:text-[#86868B]"
                >
                  <option value="SEPEDA">Sepeda / Motor (Kode S)</option>
                  <option value="MOBIL">Mobil Bensin (Kode C)</option>
                  <option value="MOBIL_LISTRIK">Mobil Listrik / EV (Kode E)</option>
                </select>
              </div>

              {!editingGarasiId && (
                <div>
                  <label className="mb-1.5 block text-[13px] font-medium text-[#1D1D1F]">
                    Jumlah Unit (1 – 999)
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="999"
                    required
                    value={gForm.jumlah}
                    onChange={(e) => setGForm({ ...gForm, jumlah: e.target.value })}
                    className="w-full rounded-xl border border-[#D2D2D7] bg-white px-3.5 py-2.5 text-sm text-[#1D1D1F] outline-none transition focus:border-[#0071E3] focus:ring-4 focus:ring-[#0071E3]/15"
                  />
                </div>
              )}

              <div>
                <label className="mb-1.5 block text-[13px] font-medium text-[#1D1D1F]">
                  Harga Sewa Harian (Rp)
                </label>
                <input
                  type="number"
                  min="1000"
                  required
                  value={gForm.harga_harian}
                  onChange={(e) => setGForm({ ...gForm, harga_harian: e.target.value })}
                  placeholder="50000"
                  className="w-full rounded-xl border border-[#D2D2D7] bg-white px-3.5 py-2.5 text-sm text-[#1D1D1F] placeholder-[#86868B] outline-none transition focus:border-[#0071E3] focus:ring-4 focus:ring-[#0071E3]/15"
                />
                {gForm.harga_harian && (
                  <p className="mt-1 text-xs font-medium text-[#0071E3]">
                    Tarif bulanan (25×): Rp {(Number(gForm.harga_harian) * 25).toLocaleString('id-ID')}
                  </p>
                )}
              </div>

              {gForm.tipe === 'MOBIL_LISTRIK' && (
                <div>
                  <label className="mb-1.5 block text-[13px] font-medium text-[#1D1D1F]">
                    Harga Listrik per kWh (Rp)
                  </label>
                  <input
                    type="number"
                    min="100"
                    required
                    value={gForm.harga_listrik_per_kwh}
                    onChange={(e) => setGForm({ ...gForm, harga_listrik_per_kwh: e.target.value })}
                    placeholder="2500"
                    className="w-full rounded-xl border border-[#D2D2D7] bg-white px-3.5 py-2.5 text-sm text-[#1D1D1F] placeholder-[#86868B] outline-none transition focus:border-[#0071E3] focus:ring-4 focus:ring-[#0071E3]/15"
                  />
                </div>
              )}

              {editingGarasiId && (
                <div>
                  <label className="mb-1.5 block text-[13px] font-medium text-[#1D1D1F]">
                    Status Unit
                  </label>
                  <select
                    value={gForm.status}
                    onChange={(e) => setGForm({ ...gForm, status: e.target.value as StatusGarasi })}
                    className="w-full rounded-xl border border-[#D2D2D7] bg-white px-3.5 py-2.5 text-sm text-[#1D1D1F] outline-none transition focus:border-[#0071E3] focus:ring-4 focus:ring-[#0071E3]/15"
                  >
                    <option value="AVAILABLE">AVAILABLE</option>
                    <option value="USED">USED</option>
                  </select>
                </div>
              )}

              <button
                type="submit"
                disabled={submittingGarasi}
                className="w-full rounded-full bg-[#0071E3] py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-[#0077ED] disabled:opacity-50"
              >
                {submittingGarasi
                  ? 'Menyimpan...'
                  : editingGarasiId
                  ? 'Simpan Perubahan'
                  : `Buat ${gForm.jumlah || 1} Unit Garasi`}
              </button>
            </form>

            <div className="grid gap-4 sm:grid-cols-2 lg:col-span-2">
              {garasiList.map((g) => {
                const isAvailable = g.status === 'AVAILABLE';
                return (
                  <div
                    key={g.id}
                    className="flex flex-col justify-between rounded-3xl border border-black/[0.06] bg-white p-6 shadow-[0_2px_12px_rgba(0,0,0,0.03)]"
                  >
                    <div>
                      <div className="flex items-start justify-between">
                        <div>
                          <span className="text-[11px] font-semibold uppercase tracking-wider text-[#86868B]">
                            {g.tipe.replace('_', ' ')}
                          </span>
                          <h3 className="mt-0.5 text-2xl font-semibold tracking-tight text-[#1D1D1F]">
                            {g.kode_garasi}
                          </h3>
                        </div>
                        <span
                          className={`rounded-full px-3 py-1 text-xs font-medium ${
                            isAvailable
                              ? 'bg-[#34C759]/12 text-[#1E8E3E]'
                              : 'bg-[#FF3B30]/12 text-[#D93025]'
                          }`}
                        >
                          {g.status}
                        </span>
                      </div>

                      <div className="mt-4 space-y-1.5 text-sm">
                        <p className="text-[#6E6E73]">
                          Harian:{' '}
                          <strong className="font-semibold text-[#1D1D1F]">
                            Rp {g.harga_harian.toLocaleString('id-ID')}
                          </strong>
                        </p>
                        <p className="text-[#6E6E73]">
                          Bulanan:{' '}
                          <strong className="font-semibold text-[#0071E3]">
                            Rp {g.harga_bulanan.toLocaleString('id-ID')}
                          </strong>
                        </p>
                        {g.harga_listrik_per_kwh && (
                          <p className="text-xs text-[#6E6E73]">
                            Listrik EV: Rp {g.harga_listrik_per_kwh.toLocaleString('id-ID')} / kWh
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="mt-5 flex gap-4 border-t border-black/[0.06] pt-3.5 text-xs font-medium">
                      <button
                        onClick={() => startEditGarasi(g)}
                        className="text-[#0071E3] hover:underline"
                      >
                        Edit Unit
                      </button>
                      <button
                        onClick={() => handleDeleteGarasi(g.id, g.kode_garasi)}
                        className="text-[#D93025] hover:underline"
                      >
                        Hapus
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* TAB 3: TRANSAKSI & PERPANJANGAN */}
        {activeTab === 'transaksi' && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="inline-flex rounded-full bg-black/[0.05] p-1">
                <button
                  onClick={() => setTrxFilter('HARI_INI')}
                  className={`rounded-full px-4 py-1 text-xs font-medium transition ${
                    trxFilter === 'HARI_INI'
                      ? 'bg-white text-[#1D1D1F] shadow-sm'
                      : 'text-[#6E6E73] hover:text-[#1D1D1F]'
                  }`}
                >
                  Sedang Disewa Hari Ini ({activeTodayCount})
                </button>
                <button
                  onClick={() => setTrxFilter('SEMUA')}
                  className={`rounded-full px-4 py-1 text-xs font-medium transition ${
                    trxFilter === 'SEMUA'
                      ? 'bg-white text-[#1D1D1F] shadow-sm'
                      : 'text-[#6E6E73] hover:text-[#1D1D1F]'
                  }`}
                >
                  Semua Transaksi ({transaksiList.length})
                </button>
              </div>
              <span className="text-xs text-[#86868B]">Hari ini: {todayStr}</span>
            </div>

            {displayedTransaksi.length === 0 ? (
              <div className="rounded-3xl border border-black/[0.06] bg-white p-10 text-center text-sm text-[#86868B] shadow-[0_2px_12px_rgba(0,0,0,0.03)]">
                {trxFilter === 'HARI_INI'
                  ? 'Tidak ada garasi yang sedang disewa pada hari ini.'
                  : 'Belum ada transaksi sewa.'}
              </div>
            ) : (
              displayedTransaksi.map((t) => (
                <div
                  key={t.id}
                  className="rounded-3xl border border-black/[0.06] bg-white p-6 shadow-[0_2px_12px_rgba(0,0,0,0.03)]"
                >
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <div className="flex flex-wrap items-center gap-2.5">
                        <span className="text-xl font-semibold tracking-tight text-[#1D1D1F]">
                          Garasi {t.garasi?.kode_garasi}
                        </span>
                        <span
                          className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                            t.status === 'ACTIVE'
                              ? 'bg-[#34C759]/12 text-[#1E8E3E]'
                              : 'bg-black/[0.06] text-[#6E6E73]'
                          }`}
                        >
                          {t.status}
                        </span>
                        <span className="rounded-full bg-[#0071E3]/10 px-2.5 py-0.5 text-xs font-medium text-[#0071E3]">
                          {t.tipe_sewa} ({t.jumlah_hari} hari)
                        </span>
                      </div>

                      <p className="mt-2 text-sm text-[#6E6E73]">
                        Penyewa:{' '}
                        <strong className="font-semibold text-[#1D1D1F]">
                          {t.penyewa?.nama_lengkap}
                        </strong>{' '}
                        ({t.penyewa?.no_telp})
                      </p>
                      <p className="text-sm text-[#6E6E73]">
                        Kendaraan: {t.kendaraan?.merek_tipe}{' '}
                        {t.kendaraan?.no_plat ? `(${t.kendaraan.no_plat})` : ''}
                      </p>
                      <p className="mt-1 text-sm text-[#6E6E73]">
                        Periode: <strong className="font-medium text-[#1D1D1F]">{t.tgl_mulai}</strong>{' '}
                        s/d <strong className="font-medium text-[#1D1D1F]">{t.tgl_selesai}</strong>
                      </p>
                    </div>

                    <div className="text-right text-sm">
                      <p className="text-[#6E6E73]">
                        Sewa: Rp {Number(t.biaya_sewa).toLocaleString('id-ID')}
                      </p>
                      {Number(t.biaya_listrik) > 0 && (
                        <p className="text-[#0071E3]">
                          Listrik EV: Rp {Number(t.biaya_listrik).toLocaleString('id-ID')}
                        </p>
                      )}
                      <p className="mt-1 text-lg font-semibold text-[#1D1D1F]">
                        Rp {Number(t.total_biaya).toLocaleString('id-ID')}
                      </p>
                      <a
                        href={t.bukti_pelunasan}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-1 inline-block text-xs font-medium text-[#0071E3] hover:underline"
                      >
                        Lihat Bukti Pelunasan &rarr;
                      </a>

                      {t.status === 'ACTIVE' && (
                        <div className="mt-3.5 flex justify-end gap-2">
                          <button
                            onClick={() => openExtendModal(t)}
                            className="rounded-full bg-[#0071E3]/10 px-4 py-1.5 text-xs font-medium text-[#0071E3] transition hover:bg-[#0071E3]/20"
                          >
                            Perpanjang Sewa
                          </button>
                          <button
                            onClick={() =>
                              handleSelesaiSewa(t.id, t.garasi?.kode_garasi ?? String(t.id))
                            }
                            className="rounded-full bg-[#34C759] px-4 py-1.5 text-xs font-medium text-white transition hover:opacity-90"
                          >
                            Selesaikan
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  {t.perpanjangan && t.perpanjangan.length > 0 && (
                    <div className="mt-4 border-t border-black/[0.06] pt-3.5">
                      <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-[#86868B]">
                        Riwayat Perpanjangan
                      </p>
                      <div className="space-y-1.5 text-xs text-[#6E6E73]">
                        {t.perpanjangan.map((p) => (
                          <div key={p.id} className="flex flex-wrap items-center justify-between gap-2">
                            <span>
                              {p.tgl_selesai_lama} &rarr; {p.tgl_selesai_baru} (+{p.tambahan_hari}{' '}
                              hari)
                            </span>
                            <div className="flex items-center gap-3">
                              <span className="font-medium text-[#0071E3]">
                                +Rp {Number(p.sisa_biaya).toLocaleString('id-ID')}
                              </span>
                              <a
                                href={p.bukti_bayar}
                                target="_blank"
                                rel="noreferrer"
                                className="font-medium text-[#0071E3] hover:underline"
                              >
                                Bukti
                              </a>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        )}

        {/* TAB 4: LAPORAN SEWA GARASI */}
        {activeTab === 'laporan' && (
          <div className="space-y-6">
            <div className="rounded-3xl border border-black/[0.06] bg-white p-6 shadow-[0_2px_12px_rgba(0,0,0,0.03)]">
              <div className="flex flex-wrap items-end gap-4">
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-[#6E6E73]">
                    Jenis Laporan
                  </label>
                  <select
                    value={laporanMode}
                    onChange={(e) =>
                      setLaporanMode(e.target.value as 'bulanan' | 'harian' | 'tipe' | 'penyewa')
                    }
                    className="rounded-xl border border-[#D2D2D7] bg-white px-3.5 py-2 text-sm text-[#1D1D1F] outline-none transition focus:border-[#0071E3] focus:ring-4 focus:ring-[#0071E3]/15"
                  >
                    <option value="bulanan">Per Bulan dalam Tahun Tertentu</option>
                    <option value="harian">Per Hari dalam Bulan Tertentu</option>
                    <option value="tipe">Per Tipe Garasi</option>
                    <option value="penyewa">Per Penyewa</option>
                  </select>
                </div>

                {(laporanMode === 'bulanan' || laporanMode === 'harian') && (
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-[#6E6E73]">Tahun</label>
                    <input
                      type="number"
                      min="2020"
                      max="2100"
                      value={laporanTahun}
                      onChange={(e) => setLaporanTahun(Number(e.target.value))}
                      className="w-28 rounded-xl border border-[#D2D2D7] bg-white px-3.5 py-2 text-sm text-[#1D1D1F] outline-none transition focus:border-[#0071E3] focus:ring-4 focus:ring-[#0071E3]/15"
                    />
                  </div>
                )}

                {laporanMode === 'harian' && (
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-[#6E6E73]">Bulan</label>
                    <select
                      value={laporanBulan}
                      onChange={(e) => setLaporanBulan(Number(e.target.value))}
                      className="rounded-xl border border-[#D2D2D7] bg-white px-3.5 py-2 text-sm text-[#1D1D1F] outline-none transition focus:border-[#0071E3] focus:ring-4 focus:ring-[#0071E3]/15"
                    >
                      {NAMA_BULAN.map((nama, idx) => (
                        <option key={nama} value={idx + 1}>
                          {nama}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {laporanMode === 'tipe' && (
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-[#6E6E73]">
                      Filter Tipe Garasi
                    </label>
                    <select
                      value={laporanTipe}
                      onChange={(e) => setLaporanTipe(e.target.value)}
                      className="rounded-xl border border-[#D2D2D7] bg-white px-3.5 py-2 text-sm text-[#1D1D1F] outline-none transition focus:border-[#0071E3] focus:ring-4 focus:ring-[#0071E3]/15"
                    >
                      <option value="ALL">Semua Tipe Garasi</option>
                      <option value="SEPEDA">Garasi Sepeda / Motor</option>
                      <option value="MOBIL">Garasi Mobil</option>
                      <option value="MOBIL_LISTRIK">Garasi Mobil Listrik</option>
                    </select>
                  </div>
                )}

                {laporanMode === 'penyewa' && (
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-[#6E6E73]">
                      Filter Penyewa
                    </label>
                    <select
                      value={laporanPenyewaId}
                      onChange={(e) => setLaporanPenyewaId(e.target.value)}
                      className="rounded-xl border border-[#D2D2D7] bg-white px-3.5 py-2 text-sm text-[#1D1D1F] outline-none transition focus:border-[#0071E3] focus:ring-4 focus:ring-[#0071E3]/15"
                    >
                      <option value="ALL">Semua Penyewa</option>
                      {penyewaList.map((p) => (
                        <option key={p.id} value={String(p.id)}>
                          {p.nama_lengkap} ({p.email})
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            </div>

            {loadingLaporan ? (
              <div className="rounded-3xl border border-black/[0.06] bg-white p-10 text-center text-sm text-[#86868B]">
                Memuat laporan...
              </div>
            ) : laporanData ? (
              <>
                <div className="grid gap-4 sm:grid-cols-4">
                  <div className="rounded-3xl border border-black/[0.06] bg-white p-5 shadow-[0_2px_12px_rgba(0,0,0,0.03)]">
                    <p className="text-xs font-medium text-[#86868B]">Total Transaksi</p>
                    <p className="mt-1.5 text-2xl font-semibold tracking-tight text-[#1D1D1F]">
                      {laporanData.ringkasan.total_transaksi}
                    </p>
                  </div>
                  <div className="rounded-3xl border border-black/[0.06] bg-white p-5 shadow-[0_2px_12px_rgba(0,0,0,0.03)]">
                    <p className="text-xs font-medium text-[#86868B]">Pendapatan Sewa</p>
                    <p className="mt-1.5 text-xl font-semibold tracking-tight text-[#1D1D1F]">
                      Rp {laporanData.ringkasan.total_biaya_sewa.toLocaleString('id-ID')}
                    </p>
                  </div>
                  <div className="rounded-3xl border border-black/[0.06] bg-white p-5 shadow-[0_2px_12px_rgba(0,0,0,0.03)]">
                    <p className="text-xs font-medium text-[#86868B]">Pendapatan Listrik</p>
                    <p className="mt-1.5 text-xl font-semibold tracking-tight text-[#0071E3]">
                      Rp {laporanData.ringkasan.total_biaya_listrik.toLocaleString('id-ID')}
                    </p>
                  </div>
                  <div className="rounded-3xl border border-black/[0.06] bg-white p-5 shadow-[0_2px_12px_rgba(0,0,0,0.03)]">
                    <p className="text-xs font-medium text-[#86868B]">Total Pendapatan</p>
                    <p className="mt-1.5 text-xl font-semibold tracking-tight text-[#1E8E3E]">
                      Rp {laporanData.ringkasan.total_pendapatan.toLocaleString('id-ID')}
                    </p>
                  </div>
                </div>

                {/* Rekapitulasi */}
                <div className="overflow-x-auto rounded-3xl border border-black/[0.06] bg-white shadow-[0_2px_12px_rgba(0,0,0,0.03)]">
                  <div className="border-b border-black/[0.06] px-6 py-4">
                    <h3 className="text-sm font-semibold text-[#1D1D1F]">Rekapitulasi Laporan</h3>
                  </div>
                  <table className="w-full text-left text-sm">
                    <thead className="border-b border-black/[0.06] text-[11px] font-semibold uppercase tracking-wider text-[#86868B]">
                      <tr>
                        <th className="px-6 py-3.5">Kategori / Periode</th>
                        <th className="px-6 py-3.5 text-right">Jumlah Sewa</th>
                        <th className="px-6 py-3.5 text-right">Biaya Sewa</th>
                        <th className="px-6 py-3.5 text-right">Listrik EV</th>
                        <th className="px-6 py-3.5 text-right">Total Pendapatan</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-black/[0.06]">
                      {laporanData.rekap.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="px-6 py-8 text-center text-[#86868B]">
                            Tidak ada data transaksi pada filter ini.
                          </td>
                        </tr>
                      ) : (
                        laporanData.rekap.map((r) => (
                          <tr key={r.label} className="hover:bg-[#F5F5F7]/60">
                            <td className="px-6 py-3.5 font-medium text-[#1D1D1F]">{r.label}</td>
                            <td className="px-6 py-3.5 text-right text-[#6E6E73]">
                              {r.jumlah_transaksi}
                            </td>
                            <td className="px-6 py-3.5 text-right text-[#6E6E73]">
                              Rp {r.total_biaya_sewa.toLocaleString('id-ID')}
                            </td>
                            <td className="px-6 py-3.5 text-right text-[#0071E3]">
                              Rp {r.total_biaya_listrik.toLocaleString('id-ID')}
                            </td>
                            <td className="px-6 py-3.5 text-right font-semibold text-[#1D1D1F]">
                              Rp {r.total_pendapatan.toLocaleString('id-ID')}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Detail Transaksi */}
                <div className="overflow-x-auto rounded-3xl border border-black/[0.06] bg-white shadow-[0_2px_12px_rgba(0,0,0,0.03)]">
                  <div className="border-b border-black/[0.06] px-6 py-4">
                    <h3 className="text-sm font-semibold text-[#1D1D1F]">
                      Detail Transaksi ({laporanData.detail.length})
                    </h3>
                  </div>
                  <table className="w-full text-left text-sm">
                    <thead className="border-b border-black/[0.06] text-[11px] font-semibold uppercase tracking-wider text-[#86868B]">
                      <tr>
                        <th className="px-6 py-3.5">Tanggal</th>
                        <th className="px-6 py-3.5">Garasi</th>
                        <th className="px-6 py-3.5">Penyewa</th>
                        <th className="px-6 py-3.5">Kendaraan</th>
                        <th className="px-6 py-3.5">Paket</th>
                        <th className="px-6 py-3.5 text-right">Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-black/[0.06]">
                      {laporanData.detail.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="px-6 py-8 text-center text-[#86868B]">
                            Belum ada transaksi.
                          </td>
                        </tr>
                      ) : (
                        laporanData.detail.map((d) => (
                          <tr key={d.id} className="hover:bg-[#F5F5F7]/60">
                            <td className="px-6 py-3.5 text-xs text-[#6E6E73]">
                              {d.tgl_mulai} &rarr; {d.tgl_selesai}
                            </td>
                            <td className="px-6 py-3.5 font-semibold text-[#1D1D1F]">
                              {d.garasi?.kode_garasi}{' '}
                              <span className="text-xs font-normal text-[#86868B]">
                                ({d.garasi?.tipe.replace('_', ' ')})
                              </span>
                            </td>
                            <td className="px-6 py-3.5 text-[#1D1D1F]">{d.penyewa?.nama_lengkap}</td>
                            <td className="px-6 py-3.5 text-[#6E6E73]">
                              {d.kendaraan?.merek_tipe}{' '}
                              {d.kendaraan?.no_plat ? `(${d.kendaraan.no_plat})` : ''}
                            </td>
                            <td className="px-6 py-3.5 text-xs font-medium text-[#0071E3]">
                              {d.tipe_sewa} ({d.jumlah_hari}h)
                            </td>
                            <td className="px-6 py-3.5 text-right font-semibold text-[#1D1D1F]">
                              Rp {Number(d.total_biaya).toLocaleString('id-ID')}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </>
            ) : null}
          </div>
        )}
      </main>

      {/* Modal Perpanjangan Sewa (macOS Sheet Style) */}
      {extendTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 px-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-3xl border border-black/[0.08] bg-white p-7 shadow-2xl">
            <h3 className="text-lg font-semibold tracking-tight text-[#1D1D1F]">
              Perpanjang Sewa — Garasi {extendTarget.garasi?.kode_garasi}
            </h3>
            <p className="mt-1 text-xs text-[#6E6E73]">
              Penyewa: {extendTarget.penyewa?.nama_lengkap} &bull; Selesai saat ini:{' '}
              <strong className="text-[#1D1D1F]">{extendTarget.tgl_selesai}</strong>
            </p>

            <form onSubmit={handleSubmitPerpanjangan} className="mt-5 space-y-4">
              <div>
                <label className="mb-1.5 block text-[13px] font-medium text-[#1D1D1F]">
                  Tanggal Selesai Baru
                </label>
                <input
                  type="date"
                  required
                  min={extendTarget.tgl_selesai}
                  value={tglSelesaiBaru}
                  onChange={(e) => setTglSelesaiBaru(e.target.value)}
                  className="w-full rounded-xl border border-[#D2D2D7] bg-white px-3.5 py-2.5 text-sm text-[#1D1D1F] outline-none transition focus:border-[#0071E3] focus:ring-4 focus:ring-[#0071E3]/15"
                />
                <p className="mt-1 text-[11px] text-[#86868B]">
                  Sisa biaya dihitung otomatis (tarif bulanan 25× berlaku jika tambahan mencapai 1
                  bulan penuh).
                </p>
              </div>

              <div>
                <label className="mb-1.5 block text-[13px] font-medium text-[#1D1D1F]">
                  Bukti Pembayaran Perpanjangan (JPG/PNG/WEBP)
                </label>
                <input
                  type="file"
                  required
                  accept="image/jpeg,image/png,image/webp"
                  onChange={(e) => setBuktiPerpanjangan(e.target.files?.[0] ?? null)}
                  className="w-full rounded-xl border border-[#D2D2D7] bg-white px-3 py-2 text-sm text-[#6E6E73] file:mr-4 file:rounded-full file:border-0 file:bg-[#0071E3]/10 file:px-4 file:py-1.5 file:text-xs file:font-medium file:text-[#0071E3]"
                />
              </div>

              <div className="flex justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setExtendTarget(null)}
                  className="rounded-full border border-black/[0.08] bg-white px-4 py-2 text-xs font-medium text-[#1D1D1F] transition hover:bg-black/[0.04]"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={submittingExtend || !buktiPerpanjangan}
                  className="rounded-full bg-[#0071E3] px-5 py-2 text-xs font-medium text-white shadow-sm transition hover:bg-[#0077ED] disabled:opacity-40"
                >
                  {submittingExtend ? 'Memproses...' : 'Simpan Perpanjangan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}