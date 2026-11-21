'use client';

import { useCallback, useEffect, useState } from 'react';
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

export default function AdminDashboardClient() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'ktp' | 'garasi' | 'transaksi'>('ktp');

  const [admin, setAdmin] = useState<AdminProfile | null>(null);
  const [penyewaList, setPenyewaList] = useState<PenyewaItem[]>([]);
  const [garasiList, setGarasiList] = useState<GarasiItem[]>([]);
  const [transaksiList, setTransaksiList] = useState<TransaksiItem[]>([]);
  const [loadingInit, setLoadingInit] = useState(true);
  const [feedback, setFeedback] = useState<{ type: 'error' | 'success'; text: string } | null>(null);

  // State Form Tambah / Edit Garasi
  const [editingGarasiId, setEditingGarasiId] = useState<number | null>(null);
  const [gForm, setGForm] = useState({
    kode_garasi: '',
    tipe: 'SEPEDA' as TipeGarasi,
    harga_harian: '',
    harga_listrik_per_kwh: '',
    status: 'AVAILABLE' as StatusGarasi,
  });
  const [submittingGarasi, setSubmittingGarasi] = useState(false);

  // State Modal Perpanjangan Sewa
  const [extendTarget, setExtendTarget] = useState<TransaksiItem | null>(null);
  const [tglSelesaiBaru, setTglSelesaiBaru] = useState('');
  const [buktiPerpanjangan, setBuktiPerpanjangan] = useState<File | null>(null);
  const [submittingExtend, setSubmittingExtend] = useState(false);

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

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
    router.refresh();
  }

  // --- AKSI 1: VERIFIKASI KTP ---
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

  // --- AKSI 2: CRUD GARASI ---
  function startEditGarasi(g: GarasiItem) {
    setEditingGarasiId(g.id);
    setGForm({
      kode_garasi: g.kode_garasi,
      tipe: g.tipe,
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

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kode_garasi: gForm.kode_garasi,
          tipe: gForm.tipe,
          harga_harian: Number(gForm.harga_harian),
          harga_listrik_per_kwh:
            gForm.tipe === 'MOBIL_LISTRIK' ? Number(gForm.harga_listrik_per_kwh) : null,
          ...(editingGarasiId ? { status: gForm.status } : {}),
        }),
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

  // --- AKSI 3: TRANSAKSI SELESAI & PERPANJANGAN ---
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
    // Set default tanggal baru = tgl_selesai lama + 1 hari
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

  if (loadingInit) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-950 text-zinc-400">
        Memuat dashboard admin...
      </div>
    );
  }

  const pendingKtpCount = penyewaList.filter((p) => p.status_ktp === 'PENDING').length;
  const availableGarasiCount = garasiList.filter((g) => g.status === 'AVAILABLE').length;
  const activeTransaksiCount = transaksiList.filter((t) => t.status === 'ACTIVE').length;

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      {/* Header */}
      <header className="border-b border-zinc-800 bg-zinc-950/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-6 py-4">
          <div className="flex items-center gap-3">
            <Link href="/" className="flex items-center gap-2">
              <span className="h-3 w-3 rounded-full bg-amber-500" />
              <span className="text-lg font-bold">SewaGarasi</span>
            </Link>
            <span className="rounded bg-amber-500/15 px-2.5 py-0.5 text-xs font-semibold text-amber-400">
              Admin Panel
            </span>
          </div>

          <div className="flex items-center gap-4">
            <div className="text-right text-sm">
              <p className="font-medium text-white">{admin?.nama_lengkap ?? 'Administrator'}</p>
              <p className="text-xs text-zinc-400">{admin?.email}</p>
            </div>
            <button
              onClick={handleLogout}
              className="rounded-lg border border-zinc-700 px-3 py-1.5 text-xs font-medium text-zinc-300 hover:border-red-500/50 hover:text-red-400"
            >
              Keluar
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-8">
        {/* Ringkasan Statistik */}
        <div className="mb-8 grid gap-4 sm:grid-cols-3">
          <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
            <p className="text-xs uppercase tracking-wider text-zinc-400">Verifikasi KTP Pending</p>
            <p className="mt-2 text-3xl font-bold text-amber-400">{pendingKtpCount}</p>
            <p className="mt-1 text-xs text-zinc-500">dari {penyewaList.length} total penyewa</p>
          </div>
          <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
            <p className="text-xs uppercase tracking-wider text-zinc-400">Garasi Tersedia</p>
            <p className="mt-2 text-3xl font-bold text-emerald-400">
              {availableGarasiCount}{' '}
              <span className="text-base font-normal text-zinc-500">/ {garasiList.length}</span>
            </p>
            <p className="mt-1 text-xs text-zinc-500">
              {garasiList.length - availableGarasiCount} unit sedang digunakan
            </p>
          </div>
          <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
            <p className="text-xs uppercase tracking-wider text-zinc-400">Sewa Aktif</p>
            <p className="mt-2 text-3xl font-bold text-white">{activeTransaksiCount}</p>
            <p className="mt-1 text-xs text-zinc-500">dari {transaksiList.length} total transaksi</p>
          </div>
        </div>

        {/* Feedback */}
        {feedback && (
          <div
            className={`mb-6 rounded-xl border px-5 py-3.5 text-sm ${
              feedback.type === 'error'
                ? 'border-red-500/30 bg-red-500/10 text-red-400'
                : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400'
            }`}
          >
            {feedback.text}
          </div>
        )}

        {/* Tabs */}
        <div className="mb-8 flex flex-wrap gap-2 border-b border-zinc-800 pb-3">
          {(
            [
              { key: 'ktp', label: `Verifikasi KTP (${pendingKtpCount} Pending)` },
              { key: 'garasi', label: `Kelola Garasi (${garasiList.length})` },
              { key: 'transaksi', label: `Transaksi & Perpanjangan (${activeTransaksiCount} Aktif)` },
            ] as const
          ).map((tab) => (
            <button
              key={tab.key}
              onClick={() => {
                setActiveTab(tab.key);
                setFeedback(null);
              }}
              className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
                activeTab === tab.key
                  ? 'bg-amber-500 text-zinc-950'
                  : 'bg-zinc-900 text-zinc-400 hover:text-white'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* TAB 1: VERIFIKASI KTP */}
        {activeTab === 'ktp' && (
          <div className="overflow-x-auto rounded-2xl border border-zinc-800 bg-zinc-900">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-zinc-800 text-xs uppercase text-zinc-400">
                <tr>
                  <th className="px-5 py-3.5">Penyewa</th>
                  <th className="px-5 py-3.5">NIK</th>
                  <th className="px-5 py-3.5">No. Telepon</th>
                  <th className="px-5 py-3.5">Status KTP</th>
                  <th className="px-5 py-3.5 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800">
                {penyewaList.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-5 py-8 text-center text-zinc-400">
                      Belum ada penyewa terdaftar.
                    </td>
                  </tr>
                ) : (
                  penyewaList.map((p) => (
                    <tr key={p.id} className="hover:bg-zinc-800/40">
                      <td className="px-5 py-4">
                        <p className="font-semibold text-white">{p.nama_lengkap}</p>
                        <p className="text-xs text-zinc-400">{p.email}</p>
                      </td>
                      <td className="px-5 py-4 font-mono text-zinc-300">{p.nik}</td>
                      <td className="px-5 py-4 text-zinc-300">{p.no_telp}</td>
                      <td className="px-5 py-4">
                        <span
                          className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                            p.status_ktp === 'APPROVED'
                              ? 'bg-emerald-500/15 text-emerald-400'
                              : p.status_ktp === 'REJECTED'
                              ? 'bg-red-500/15 text-red-400'
                              : 'bg-amber-500/15 text-amber-400'
                          }`}
                        >
                          {p.status_ktp}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-right">
                        <div className="flex justify-end gap-2">
                          {p.status_ktp !== 'APPROVED' && (
                            <button
                              onClick={() => handleVerifikasiKtp(p.id, 'APPROVED')}
                              className="rounded-lg bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-zinc-950 hover:bg-emerald-400"
                            >
                              Approve
                            </button>
                          )}
                          {p.status_ktp !== 'REJECTED' && (
                            <button
                              onClick={() => handleVerifikasiKtp(p.id, 'REJECTED')}
                              className="rounded-lg border border-red-500/40 px-3 py-1.5 text-xs font-semibold text-red-400 hover:bg-red-500/10"
                            >
                              Reject
                            </button>
                          )}
                        </div>
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
              className="h-fit space-y-4 rounded-2xl border border-zinc-800 bg-zinc-900 p-6"
            >
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-white">
                  {editingGarasiId ? 'Edit Unit Garasi' : 'Tambah Unit Garasi'}
                </h2>
                {editingGarasiId && (
                  <button
                    type="button"
                    onClick={resetGarasiForm}
                    className="text-xs text-zinc-400 hover:text-white"
                  >
                    Batal
                  </button>
                )}
              </div>

              <div>
                <label className="mb-1.5 block text-sm text-zinc-300">Kode Garasi</label>
                <input
                  type="text"
                  required
                  value={gForm.kode_garasi}
                  onChange={(e) => setGForm({ ...gForm, kode_garasi: e.target.value.toUpperCase() })}
                  placeholder="Contoh: E003"
                  className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3.5 py-2.5 text-sm text-white outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-sm text-zinc-300">Tipe Garasi</label>
                <select
                  value={gForm.tipe}
                  onChange={(e) => setGForm({ ...gForm, tipe: e.target.value as TipeGarasi })}
                  className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3.5 py-2.5 text-sm text-white outline-none focus:border-amber-500"
                >
                  <option value="SEPEDA">Sepeda / Motor</option>
                  <option value="MOBIL">Mobil</option>
                  <option value="MOBIL_LISTRIK">Mobil Listrik (EV)</option>
                </select>
              </div>

              <div>
                <label className="mb-1.5 block text-sm text-zinc-300">Harga Harian (Rp)</label>
                <input
                  type="number"
                  min="1000"
                  required
                  value={gForm.harga_harian}
                  onChange={(e) => setGForm({ ...gForm, harga_harian: e.target.value })}
                  placeholder="50000"
                  className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3.5 py-2.5 text-sm text-white outline-none focus:border-amber-500"
                />
                {gForm.harga_harian && (
                  <p className="mt-1 text-xs text-amber-400">
                    Tarif bulanan otomatis (25×): Rp{' '}
                    {(Number(gForm.harga_harian) * 25).toLocaleString('id-ID')}
                  </p>
                )}
              </div>

              {gForm.tipe === 'MOBIL_LISTRIK' && (
                <div>
                  <label className="mb-1.5 block text-sm text-zinc-300">
                    Harga Listrik per kWh (Rp)
                  </label>
                  <input
                    type="number"
                    min="100"
                    required
                    value={gForm.harga_listrik_per_kwh}
                    onChange={(e) => setGForm({ ...gForm, harga_listrik_per_kwh: e.target.value })}
                    placeholder="2500"
                    className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3.5 py-2.5 text-sm text-white outline-none focus:border-amber-500"
                  />
                </div>
              )}

              {editingGarasiId && (
                <div>
                  <label className="mb-1.5 block text-sm text-zinc-300">Status Unit</label>
                  <select
                    value={gForm.status}
                    onChange={(e) => setGForm({ ...gForm, status: e.target.value as StatusGarasi })}
                    className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3.5 py-2.5 text-sm text-white outline-none focus:border-amber-500"
                  >
                    <option value="AVAILABLE">AVAILABLE</option>
                    <option value="USED">USED</option>
                  </select>
                </div>
              )}

              <button
                type="submit"
                disabled={submittingGarasi}
                className="w-full rounded-lg bg-amber-500 py-2.5 text-sm font-semibold text-zinc-950 transition hover:bg-amber-400 disabled:opacity-50"
              >
                {submittingGarasi
                  ? 'Menyimpan...'
                  : editingGarasiId
                  ? 'Simpan Perubahan'
                  : 'Tambah Garasi'}
              </button>
            </form>

            <div className="grid gap-4 sm:grid-cols-2 lg:col-span-2">
              {garasiList.map((g) => (
                <div
                  key={g.id}
                  className="flex flex-col justify-between rounded-xl border border-zinc-800 bg-zinc-900 p-5"
                >
                  <div>
                    <div className="flex items-start justify-between">
                      <div>
                        <span className="text-xs uppercase text-zinc-400">
                          {g.tipe.replace('_', ' ')}
                        </span>
                        <h3 className="text-xl font-bold text-white">{g.kode_garasi}</h3>
                      </div>
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                          g.status === 'AVAILABLE'
                            ? 'bg-emerald-500/15 text-emerald-400'
                            : 'bg-red-500/15 text-red-400'
                        }`}
                      >
                        {g.status}
                      </span>
                    </div>

                    <div className="mt-4 space-y-1 text-sm">
                      <p className="text-zinc-300">
                        Harian: <strong>Rp {g.harga_harian.toLocaleString('id-ID')}</strong>
                      </p>
                      <p className="text-amber-400">
                        Bulanan: <strong>Rp {g.harga_bulanan.toLocaleString('id-ID')}</strong>
                      </p>
                      {g.harga_listrik_per_kwh && (
                        <p className="text-xs text-sky-400">
                          Listrik EV: Rp {g.harga_listrik_per_kwh.toLocaleString('id-ID')} / kWh
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="mt-4 flex gap-3 border-t border-zinc-800 pt-3 text-xs">
                    <button
                      onClick={() => startEditGarasi(g)}
                      className="font-medium text-amber-400 hover:underline"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDeleteGarasi(g.id, g.kode_garasi)}
                      className="font-medium text-red-400 hover:underline"
                    >
                      Hapus
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 3: TRANSAKSI & PERPANJANGAN */}
        {activeTab === 'transaksi' && (
          <div className="space-y-4">
            {transaksiList.length === 0 ? (
              <p className="rounded-xl border border-zinc-800 bg-zinc-900 p-6 text-sm text-zinc-400">
                Belum ada transaksi sewa.
              </p>
            ) : (
              transaksiList.map((t) => (
                <div key={t.id} className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-lg font-bold text-white">
                          Garasi {t.garasi?.kode_garasi}
                        </span>
                        <span
                          className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                            t.status === 'ACTIVE'
                              ? 'bg-emerald-500/15 text-emerald-400'
                              : 'bg-zinc-700 text-zinc-300'
                          }`}
                        >
                          {t.status}
                        </span>
                        <span className="rounded bg-zinc-800 px-2 py-0.5 text-xs text-amber-400">
                          {t.tipe_sewa} ({t.jumlah_hari} hari)
                        </span>
                      </div>

                      <p className="mt-1.5 text-sm text-zinc-300">
                        Penyewa: <strong>{t.penyewa?.nama_lengkap}</strong> ({t.penyewa?.no_telp})
                      </p>
                      <p className="text-sm text-zinc-400">
                        Kendaraan: {t.kendaraan?.merek_tipe}{' '}
                        {t.kendaraan?.no_plat ? `(${t.kendaraan.no_plat})` : ''}
                      </p>
                      <p className="mt-1 text-sm text-zinc-300">
                        Periode: <strong>{t.tgl_mulai}</strong> s/d <strong>{t.tgl_selesai}</strong>
                      </p>
                    </div>

                    <div className="text-right text-sm">
                      <p className="text-zinc-400">
                        Sewa: Rp {Number(t.biaya_sewa).toLocaleString('id-ID')}
                      </p>
                      {Number(t.biaya_listrik) > 0 && (
                        <p className="text-sky-400">
                          Listrik EV: Rp {Number(t.biaya_listrik).toLocaleString('id-ID')}
                        </p>
                      )}
                      <p className="mt-1 text-base font-bold text-amber-400">
                        Total: Rp {Number(t.total_biaya).toLocaleString('id-ID')}
                      </p>
                      <a
                        href={t.bukti_pelunasan}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-1 inline-block text-xs text-zinc-400 underline hover:text-white"
                      >
                        Lihat Bukti Pelunasan
                      </a>

                      {t.status === 'ACTIVE' && (
                        <div className="mt-3 flex justify-end gap-2">
                          <button
                            onClick={() => openExtendModal(t)}
                            className="rounded-lg border border-amber-500/50 px-3 py-1.5 text-xs font-semibold text-amber-400 hover:bg-amber-500/10"
                          >
                            Perpanjang Sewa
                          </button>
                          <button
                            onClick={() =>
                              handleSelesaiSewa(t.id, t.garasi?.kode_garasi ?? String(t.id))
                            }
                            className="rounded-lg bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-zinc-950 hover:bg-emerald-400"
                          >
                            Selesaikan Sewa
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  {t.perpanjangan && t.perpanjangan.length > 0 && (
                    <div className="mt-4 border-t border-zinc-800 pt-3">
                      <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-400">
                        Riwayat Perpanjangan
                      </p>
                      <div className="space-y-1.5 text-xs text-zinc-300">
                        {t.perpanjangan.map((p) => (
                          <div key={p.id} className="flex flex-wrap items-center justify-between gap-2">
                            <span>
                              {p.tgl_selesai_lama} &rarr; {p.tgl_selesai_baru} (+{p.tambahan_hari}{' '}
                              hari)
                            </span>
                            <div className="flex items-center gap-3">
                              <span className="text-amber-400">
                                +Rp {Number(p.sisa_biaya).toLocaleString('id-ID')}
                              </span>
                              <a
                                href={p.bukti_bayar}
                                target="_blank"
                                rel="noreferrer"
                                className="text-zinc-400 underline hover:text-white"
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
      </main>

      {/* Modal Perpanjangan Sewa */}
      {extendTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
          <div className="w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-900 p-6 shadow-2xl">
            <h3 className="text-lg font-bold text-white">
              Perpanjang Sewa — Garasi {extendTarget.garasi?.kode_garasi}
            </h3>
            <p className="mt-1 text-xs text-zinc-400">
              Penyewa: {extendTarget.penyewa?.nama_lengkap} | Selesai saat ini:{' '}
              <strong className="text-zinc-200">{extendTarget.tgl_selesai}</strong>
            </p>

            <form onSubmit={handleSubmitPerpanjangan} className="mt-5 space-y-4">
              <div>
                <label className="mb-1.5 block text-sm text-zinc-300">Tanggal Selesai Baru</label>
                <input
                  type="date"
                  required
                  min={extendTarget.tgl_selesai}
                  value={tglSelesaiBaru}
                  onChange={(e) => setTglSelesaiBaru(e.target.value)}
                  className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3.5 py-2.5 text-sm text-white outline-none focus:border-amber-500"
                />
                <p className="mt-1 text-xs text-zinc-500">
                  Biaya tambahan dihitung otomatis oleh sistem (tarif bulanan berlaku jika tambahan
                  mencapai 1 bulan penuh).
                </p>
              </div>

              <div>
                <label className="mb-1.5 block text-sm text-zinc-300">
                  Bukti Pembayaran Perpanjangan (JPG/PNG/WEBP)
                </label>
                <input
                  type="file"
                  required
                  accept="image/jpeg,image/png,image/webp"
                  onChange={(e) => setBuktiPerpanjangan(e.target.files?.[0] ?? null)}
                  className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-300 file:mr-4 file:rounded-md file:border-0 file:bg-amber-500 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-zinc-950"
                  />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setExtendTarget(null)}
                  className="rounded-lg border border-zinc-700 px-4 py-2 text-sm text-zinc-300 hover:text-white"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={submittingExtend || !buktiPerpanjangan}
                  className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-zinc-950 hover:bg-amber-400 disabled:opacity-50"
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