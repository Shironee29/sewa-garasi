'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { StatusKtp, TipeGarasi, TipeKendaraan, TipeSewa } from '@/types/domain';

interface UserProfile {
  id: number;
  email: string;
  role: string;
  nik: string | null;
  nama_lengkap: string | null;
  no_telp: string | null;
  status_ktp: StatusKtp;
}

interface KendaraanItem {
  id: number;
  tipe: TipeKendaraan;
  no_plat: string | null;
  merek_tipe: string;
  kapasitas_max_kwh: number | null;
  baterai_terakhir_kwh: number | null;
}

interface GarasiItem {
  id: number;
  kode_garasi: string;
  tipe: TipeGarasi;
  harga_harian: number;
  harga_bulanan: number;
  harga_listrik_per_kwh: number | null;
  status: string;
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
  status: string;
  garasi: { kode_garasi: string; tipe: TipeGarasi } | null;
  kendaraan: { merek_tipe: string; no_plat: string | null; tipe: TipeKendaraan } | null;
  perpanjangan: PerpanjanganItem[];
}

interface PreviewResponse {
  tgl_mulai: string;
  tgl_selesai: string;
  batas_maksimal_harian: number;
  durasi_bulan_ini: number;
  kebutuhan_kwh: number;
  rincian: {
    tipeSewa: TipeSewa;
    jumlahHari: number;
    biayaSewa: number;
    biayaListrik: number;
    totalBiaya: number;
  };
}

function getTodayString(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function getTomorrowString(): string {
  const now = new Date();
  now.setDate(now.getDate() + 1);
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export default function PenyewaDashboardClient() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'sewa' | 'kendaraan' | 'riwayat'>('sewa');

  const [user, setUser] = useState<UserProfile | null>(null);
  const [kendaraanList, setKendaraanList] = useState<KendaraanItem[]>([]);
  const [garasiList, setGarasiList] = useState<GarasiItem[]>([]);
  const [transaksiList, setTransaksiList] = useState<TransaksiItem[]>([]);
  const [loadingInit, setLoadingInit] = useState(true);
  const [feedback, setFeedback] = useState<{ type: 'error' | 'success'; text: string } | null>(null);

  // State Form Tambah Kendaraan
  const [kForm, setKForm] = useState({
    tipe: 'SEPEDA_MOTOR' as TipeKendaraan,
    merek_tipe: '',
    no_plat: '',
    kapasitas_max_kwh: '',
    baterai_terakhir_kwh: '',
  });
  const [submittingKendaraan, setSubmittingKendaraan] = useState(false);

  // State Form Sewa Garasi
  const [selectedKendaraanId, setSelectedKendaraanId] = useState<string>('');
  const [selectedGarasiId, setSelectedGarasiId] = useState<string>('');
  const [tipeSewa, setTipeSewa] = useState<TipeSewa>('HARIAN');
  const [tglMulai, setTglMulai] = useState<string>(getTodayString());
  const [tglSelesai, setTglSelesai] = useState<string>(getTomorrowString());
  const [buktiFile, setBuktiFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<PreviewResponse | null>(null);
  const [previewError, setPreviewError] = useState<string>('');
  const [submittingSewa, setSubmittingSewa] = useState(false);

  const loadAllData = useCallback(async () => {
    try {
      const [meRes, kRes, gRes, tRes] = await Promise.all([
        fetch('/api/auth/me'),
        fetch('/api/kendaraan'),
        fetch('/api/garasi?status=AVAILABLE'),
        fetch('/api/transaksi'),
      ]);

      if (meRes.ok) {
        const meData = await meRes.json();
        setUser(meData.user);
      }
      if (kRes.ok) {
        const kData = await kRes.json();
        setKendaraanList(kData.kendaraan ?? []);
      }
      if (gRes.ok) {
        const gData = await gRes.json();
        setGarasiList(gData.garasi ?? []);
      }
      if (tRes.ok) {
        const tData = await tRes.json();
        setTransaksiList(tData.transaksi ?? []);
      }
    } finally {
      setLoadingInit(false);
    }
  }, []);

  useEffect(() => {
    loadAllData();
  }, [loadAllData]);

  // Filter garasi yang cocok dengan tipe kendaraan yang dipilih
  const selectedKendaraan = useMemo(
    () => kendaraanList.find((k) => String(k.id) === selectedKendaraanId) ?? null,
    [kendaraanList, selectedKendaraanId]
  );

  const compatibleGarasi = useMemo(() => {
    if (!selectedKendaraan) return [];
    const targetTipe: TipeGarasi =
      selectedKendaraan.tipe === 'SEPEDA' || selectedKendaraan.tipe === 'SEPEDA_MOTOR'
        ? 'SEPEDA'
        : selectedKendaraan.tipe === 'MOBIL'
        ? 'MOBIL'
        : 'MOBIL_LISTRIK';
    return garasiList.filter((g) => g.tipe === targetTipe);
  }, [garasiList, selectedKendaraan]);

  // Reset pilihan garasi jika tidak lagi cocok dengan kendaraan yang baru dipilih
  useEffect(() => {
    if (selectedGarasiId && !compatibleGarasi.some((g) => String(g.id) === selectedGarasiId)) {
      setSelectedGarasiId('');
    }
  }, [compatibleGarasi, selectedGarasiId]);

  // Hitung preview tarif real-time setiap kali input sewa berubah
  useEffect(() => {
    if (!selectedKendaraanId || !selectedGarasiId || !tglMulai) {
      setPreview(null);
      setPreviewError('');
      return;
    }

    if (tipeSewa === 'HARIAN' && !tglSelesai) {
      setPreview(null);
      return;
    }

    const controller = new AbortController();

    async function fetchPreview() {
      setPreviewError('');
      try {
        const res = await fetch('/api/transaksi/preview', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            garasi_id: Number(selectedGarasiId),
            kendaraan_id: Number(selectedKendaraanId),
            tgl_mulai: tglMulai,
            tgl_selesai: tipeSewa === 'BULANAN' ? undefined : tglSelesai,
            tipe_sewa: tipeSewa,
          }),
          signal: controller.signal,
        });

        const data = await res.json();
        if (!res.ok) {
          setPreview(null);
          setPreviewError(data.error || 'Kombinasi tanggal tidak valid.');
          return;
        }

        setPreview(data);
        if (tipeSewa === 'BULANAN') {
          setTglSelesai(data.tgl_selesai);
        }
      } catch (err) {
        if ((err as Error).name !== 'AbortError') {
          setPreviewError('Gagal menghitung estimasi biaya.');
        }
      }
    }

    fetchPreview();
    return () => controller.abort();
  }, [selectedKendaraanId, selectedGarasiId, tipeSewa, tglMulai, tglSelesai]);

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
    router.refresh();
  }

  async function handleTambahKendaraan(e: React.FormEvent) {
    e.preventDefault();
    setFeedback(null);
    setSubmittingKendaraan(true);

    try {
      const res = await fetch('/api/kendaraan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tipe: kForm.tipe,
          merek_tipe: kForm.merek_tipe,
          no_plat: kForm.tipe === 'SEPEDA' ? null : kForm.no_plat,
          kapasitas_max_kwh: kForm.tipe === 'MOBIL_LISTRIK' ? Number(kForm.kapasitas_max_kwh) : null,
          baterai_terakhir_kwh: kForm.tipe === 'MOBIL_LISTRIK' ? Number(kForm.baterai_terakhir_kwh) : null,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setFeedback({ type: 'error', text: data.error || 'Gagal menambah kendaraan.' });
        return;
      }

      setFeedback({ type: 'success', text: 'Kendaraan berhasil didaftarkan.' });
      setKForm({
        tipe: 'SEPEDA_MOTOR',
        merek_tipe: '',
        no_plat: '',
        kapasitas_max_kwh: '',
        baterai_terakhir_kwh: '',
      });
      await loadAllData();
    } finally {
      setSubmittingKendaraan(false);
    }
  }

  async function handleHapusKendaraan(id: number) {
    if (!confirm('Hapus kendaraan ini?')) return;
    setFeedback(null);

    const res = await fetch(`/api/kendaraan/${id}`, { method: 'DELETE' });
    const data = await res.json();

    if (!res.ok) {
      setFeedback({ type: 'error', text: data.error || 'Gagal menghapus kendaraan.' });
      return;
    }

    setFeedback({ type: 'success', text: 'Kendaraan berhasil dihapus.' });
    await loadAllData();
  }

  async function handleSubmitSewa(e: React.FormEvent) {
    e.preventDefault();
    setFeedback(null);

    if (!buktiFile) {
      setFeedback({ type: 'error', text: 'Wajib mengunggah foto bukti pelunasan.' });
      return;
    }

    setSubmittingSewa(true);
    try {
      const formData = new FormData();
      formData.append('garasi_id', selectedGarasiId);
      formData.append('kendaraan_id', selectedKendaraanId);
      formData.append('tgl_mulai', tglMulai);
      formData.append('tgl_selesai', preview?.tgl_selesai ?? tglSelesai);
      formData.append('tipe_sewa', tipeSewa);
      formData.append('bukti_pelunasan', buktiFile);

      const res = await fetch('/api/transaksi', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) {
        setFeedback({ type: 'error', text: data.error || 'Gagal membuat transaksi sewa.' });
        return;
      }

      setFeedback({ type: 'success', text: data.message });
      setSelectedGarasiId('');
      setBuktiFile(null);
      setPreview(null);
      await loadAllData();
      setActiveTab('riwayat');
    } finally {
      setSubmittingSewa(false);
    }
  }

  if (loadingInit) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-950 text-zinc-400">
        Memuat dashboard penyewa...
      </div>
    );
  }

  const isApproved = user?.status_ktp === 'APPROVED';

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
            <span className="rounded bg-zinc-800 px-2 py-0.5 text-xs text-zinc-400">
              Dashboard Penyewa
            </span>
          </div>

          <div className="flex items-center gap-4">
            <div className="text-right text-sm">
              <p className="font-medium text-white">{user?.nama_lengkap}</p>
              <p className="text-xs text-zinc-400">{user?.email}</p>
            </div>
            <span
              className={`rounded-full px-3 py-1 text-xs font-semibold ${
                user?.status_ktp === 'APPROVED'
                  ? 'bg-emerald-500/15 text-emerald-400'
                  : user?.status_ktp === 'REJECTED'
                  ? 'bg-red-500/15 text-red-400'
                  : 'bg-amber-500/15 text-amber-400'
              }`}
            >
              KTP: {user?.status_ktp}
            </span>
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
        {/* Banner Status KTP */}
        {!isApproved && (
          <div
            className={`mb-6 rounded-xl border px-5 py-4 text-sm ${
              user?.status_ktp === 'REJECTED'
                ? 'border-red-500/30 bg-red-500/10 text-red-300'
                : 'border-amber-500/30 bg-amber-500/10 text-amber-300'
            }`}
          >
            {user?.status_ktp === 'REJECTED' ? (
              <strong>Verifikasi KTP Ditolak.</strong>
            ) : (
              <strong>Menunggu Verifikasi KTP oleh Admin.</strong>
            )}{' '}
            Kamu sudah bisa mendaftarkan kendaraan di tab <em>Kendaraan Saya</em>, namun transaksi
            sewa garasi baru bisa dilakukan setelah KTP berstatus <strong>APPROVED</strong>.
          </div>
        )}

        {/* Alert Feedback */}
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
        <div className="mb-8 flex gap-2 border-b border-zinc-800 pb-3">
          {(
            [
              { key: 'sewa', label: 'Sewa Garasi' },
              { key: 'kendaraan', label: `Kendaraan Saya (${kendaraanList.length})` },
              { key: 'riwayat', label: `Riwayat Sewa (${transaksiList.length})` },
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

        {/* TAB 1: SEWA GARASI */}
        {activeTab === 'sewa' && (
          <div className="grid gap-8 lg:grid-cols-3">
            <form
              onSubmit={handleSubmitSewa}
              className="space-y-5 rounded-2xl border border-zinc-800 bg-zinc-900 p-6 lg:col-span-2"
            >
              <h2 className="text-lg font-semibold text-white">Form Penyewaan Garasi</h2>

              {kendaraanList.length === 0 ? (
                <div className="rounded-lg border border-zinc-700 bg-zinc-950 p-4 text-sm text-zinc-400">
                  Kamu belum mendaftarkan kendaraan. Tambahkan kendaraan terlebih dahulu di tab{' '}
                  <button
                    type="button"
                    onClick={() => setActiveTab('kendaraan')}
                    className="font-semibold text-amber-400 underline"
                  >
                    Kendaraan Saya
                  </button>
                  .
                </div>
              ) : (
                <>
                  <div>
                    <label className="mb-1.5 block text-sm text-zinc-300">1. Pilih Kendaraan</label>
                    <select
                      required
                      value={selectedKendaraanId}
                      onChange={(e) => setSelectedKendaraanId(e.target.value)}
                      className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3.5 py-2.5 text-sm text-white outline-none focus:border-amber-500"
                    >
                      <option value="">-- Pilih Kendaraan --</option>
                      {kendaraanList.map((k) => (
                        <option key={k.id} value={k.id}>
                          [{k.tipe.replace('_', ' ')}] {k.merek_tipe}{' '}
                          {k.no_plat ? `(${k.no_plat})` : ''}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="mb-1.5 block text-sm text-zinc-300">
                      2. Pilih Unit Garasi Tersedia (Sesuai Tipe Kendaraan)
                    </label>
                    <select
                      required
                      disabled={!selectedKendaraanId}
                      value={selectedGarasiId}
                      onChange={(e) => setSelectedGarasiId(e.target.value)}
                      className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3.5 py-2.5 text-sm text-white outline-none focus:border-amber-500 disabled:opacity-50"
                    >
                      <option value="">
                        {!selectedKendaraanId
                          ? '-- Pilih kendaraan dahulu --'
                          : compatibleGarasi.length === 0
                          ? '-- Tidak ada garasi tersedia untuk tipe ini --'
                          : '-- Pilih Unit Garasi --'}
                      </option>
                      {compatibleGarasi.map((g) => (
                        <option key={g.id} value={g.id}>
                          {g.kode_garasi} — Rp {g.harga_harian.toLocaleString('id-ID')}/hari | Rp{' '}
                          {g.harga_bulanan.toLocaleString('id-ID')}/bln
                          {g.harga_listrik_per_kwh
                            ? ` (+Rp ${g.harga_listrik_per_kwh.toLocaleString('id-ID')}/kWh)`
                            : ''}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="mb-1.5 block text-sm text-zinc-300">3. Paket Sewa</label>
                    <div className="grid grid-cols-2 gap-3">
                      {(['HARIAN', 'BULANAN'] as const).map((t) => (
                        <button
                          key={t}
                          type="button"
                          onClick={() => setTipeSewa(t)}
                          className={`rounded-lg border py-2.5 text-sm font-semibold transition ${
                            tipeSewa === t
                              ? 'border-amber-500 bg-amber-500/15 text-amber-400'
                              : 'border-zinc-700 bg-zinc-950 text-zinc-400 hover:border-zinc-600'
                          }`}
                        >
                          {t === 'HARIAN' ? 'Sewa Harian' : 'Paket Bulanan (25×)'}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <label className="mb-1.5 block text-sm text-zinc-300">Tanggal Mulai</label>
                      <input
                        type="date"
                        required
                        value={tglMulai}
                        onChange={(e) => setTglMulai(e.target.value)}
                        className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3.5 py-2.5 text-sm text-white outline-none focus:border-amber-500"
                      />
                    </div>

                    <div>
                      <label className="mb-1.5 block text-sm text-zinc-300">
                        Tanggal Selesai {tipeSewa === 'BULANAN' && '(Otomatis 1 Bulan)'}
                      </label>
                      <input
                        type="date"
                        required
                        readOnly={tipeSewa === 'BULANAN'}
                        value={tglSelesai}
                        onChange={(e) => setTglSelesai(e.target.value)}
                        className={`w-full rounded-lg border border-zinc-700 px-3.5 py-2.5 text-sm text-white outline-none focus:border-amber-500 ${
                          tipeSewa === 'BULANAN' ? 'bg-zinc-800/60 text-zinc-400' : 'bg-zinc-950'
                        }`}
                      />
                    </div>
                  </div>

                  <div>
                    <label className="mb-1.5 block text-sm text-zinc-300">
                      4. Upload Bukti Pelunasan (JPG/PNG/WEBP, maks 5MB)
                    </label>
                    <input
                      type="file"
                      required
                      accept="image/jpeg,image/png,image/webp"
                      onChange={(e) => setBuktiFile(e.target.files?.[0] ?? null)}
                      className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-300 file:mr-4 file:rounded-md file:border-0 file:bg-amber-500 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-zinc-950"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={!isApproved || !preview || submittingSewa}
                    className="w-full rounded-lg bg-amber-500 py-3 text-sm font-semibold text-zinc-950 transition hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {submittingSewa ? 'Memproses Transaksi...' : 'Konfirmasi & Sewa Garasi'}
                  </button>
                </>
              )}
            </form>

            {/* Panel Rincian Biaya Real-Time */}
            <div className="h-fit rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
              <h3 className="text-base font-semibold text-white">Rincian Estimasi Biaya</h3>

              {previewError && (
                <div className="mt-4 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-400">
                  {previewError}
                </div>
              )}

              {!preview && !previewError && (
                <p className="mt-4 text-sm text-zinc-400">
                  Pilih kendaraan, garasi, dan tanggal untuk melihat perhitungan biaya otomatis.
                </p>
              )}

              {preview && (
                <div className="mt-5 space-y-3 text-sm">
                  <div className="flex justify-between">
                    <span className="text-zinc-400">Tipe Sewa</span>
                    <span className="font-semibold text-amber-400">{preview.rincian.tipeSewa}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-400">Periode</span>
                    <span className="text-zinc-200">
                      {preview.tgl_mulai} &rarr; {preview.tgl_selesai}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-400">Durasi</span>
                    <span className="text-zinc-200">{preview.rincian.jumlahHari} hari</span>
                  </div>
                  <div className="flex justify-between text-xs text-zinc-500">
                    <span>Batas Harian Bulan Ini</span>
                    <span>Maks {preview.batas_maksimal_harian} hari</span>
                  </div>

                  <div className="border-t border-zinc-800 pt-3 space-y-2">
                    <div className="flex justify-between">
                      <span className="text-zinc-400">Biaya Sewa Garasi</span>
                      <span>Rp {preview.rincian.biayaSewa.toLocaleString('id-ID')}</span>
                    </div>
                    {preview.rincian.biayaListrik > 0 && (
                      <div className="flex justify-between text-sky-400">
                        <span>Isi Daya EV ({preview.kebutuhan_kwh} kWh)</span>
                        <span>Rp {preview.rincian.biayaListrik.toLocaleString('id-ID')}</span>
                      </div>
                    )}
                  </div>

                  <div className="flex justify-between border-t border-zinc-800 pt-3 text-base font-bold">
                    <span>Total Pelunasan</span>
                    <span className="text-amber-400">
                      Rp {preview.rincian.totalBiaya.toLocaleString('id-ID')}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 2: KENDARAAN SAYA */}
        {activeTab === 'kendaraan' && (
          <div className="grid gap-8 lg:grid-cols-3">
            <form
              onSubmit={handleTambahKendaraan}
              className="space-y-4 rounded-2xl border border-zinc-800 bg-zinc-900 p-6"
            >
              <h2 className="text-lg font-semibold text-white">Tambah Kendaraan</h2>

              <div>
                <label className="mb-1.5 block text-sm text-zinc-300">Tipe Kendaraan</label>
                <select
                  value={kForm.tipe}
                  onChange={(e) => setKForm({ ...kForm, tipe: e.target.value as TipeKendaraan })}
                  className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3.5 py-2.5 text-sm text-white outline-none focus:border-amber-500"
                >
                  <option value="SEPEDA">Sepeda</option>
                  <option value="SEPEDA_MOTOR">Sepeda Motor</option>
                  <option value="MOBIL">Mobil</option>
                  <option value="MOBIL_LISTRIK">Mobil Listrik (EV)</option>
                </select>
              </div>

              <div>
                <label className="mb-1.5 block text-sm text-zinc-300">Merek &amp; Tipe</label>
                <input
                  type="text"
                  required
                  value={kForm.merek_tipe}
                  onChange={(e) => setKForm({ ...kForm, merek_tipe: e.target.value })}
                  placeholder="Contoh: Hyundai Ioniq 5 / Honda Vario"
                  className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3.5 py-2.5 text-sm text-white outline-none focus:border-amber-500"
                />
              </div>

              {kForm.tipe !== 'SEPEDA' && (
                <div>
                  <label className="mb-1.5 block text-sm text-zinc-300">Nomor Plat</label>
                  <input
                    type="text"
                    required
                    value={kForm.no_plat}
                    onChange={(e) => setKForm({ ...kForm, no_plat: e.target.value.toUpperCase() })}
                    placeholder="L 1234 AB"
                    className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3.5 py-2.5 text-sm text-white outline-none focus:border-amber-500"
                  />
                </div>
              )}

              {kForm.tipe === 'MOBIL_LISTRIK' && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1.5 block text-xs text-zinc-300">
                      Kapasitas Max (kWh)
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      min="1"
                      required
                      value={kForm.kapasitas_max_kwh}
                      onChange={(e) => setKForm({ ...kForm, kapasitas_max_kwh: e.target.value })}
                      placeholder="72.6"
                      className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-white outline-none focus:border-amber-500"
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs text-zinc-300">
                      Sisa Baterai (kWh)
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      required
                      value={kForm.baterai_terakhir_kwh}
                      onChange={(e) =>
                        setKForm({ ...kForm, baterai_terakhir_kwh: e.target.value })
                      }
                      placeholder="20"
                      className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-white outline-none focus:border-amber-500"
                    />
                  </div>
                </div>
              )}

              <button
                type="submit"
                disabled={submittingKendaraan}
                className="w-full rounded-lg bg-amber-500 py-2.5 text-sm font-semibold text-zinc-950 transition hover:bg-amber-400 disabled:opacity-50"
              >
                {submittingKendaraan ? 'Menyimpan...' : 'Simpan Kendaraan'}
              </button>
            </form>

            <div className="space-y-4 lg:col-span-2">
              <h2 className="text-lg font-semibold text-white">Daftar Kendaraan Terdaftar</h2>
              {kendaraanList.length === 0 ? (
                <p className="rounded-xl border border-zinc-800 bg-zinc-900 p-6 text-sm text-zinc-400">
                  Belum ada kendaraan yang didaftarkan.
                </p>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2">
                  {kendaraanList.map((k) => (
                    <div
                      key={k.id}
                      className="flex flex-col justify-between rounded-xl border border-zinc-800 bg-zinc-900 p-5"
                    >
                      <div>
                        <span className="rounded bg-zinc-800 px-2 py-0.5 text-xs font-medium text-amber-400">
                          {k.tipe.replace('_', ' ')}
                        </span>
                        <h3 className="mt-2 text-base font-bold text-white">{k.merek_tipe}</h3>
                        {k.no_plat && (
                          <p className="mt-1 text-sm font-mono text-zinc-400">{k.no_plat}</p>
                        )}
                        {k.tipe === 'MOBIL_LISTRIK' && (
                          <p className="mt-2 text-xs text-sky-400">
                            Baterai: {k.baterai_terakhir_kwh} / {k.kapasitas_max_kwh} kWh
                          </p>
                        )}
                      </div>
                      <button
                        onClick={() => handleHapusKendaraan(k.id)}
                        className="mt-4 w-fit text-xs text-red-400 hover:underline"
                      >
                        Hapus Kendaraan
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 3: RIWAYAT SEWA */}
        {activeTab === 'riwayat' && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-white">Riwayat &amp; Sewa Aktif</h2>
            {transaksiList.length === 0 ? (
              <p className="rounded-xl border border-zinc-800 bg-zinc-900 p-6 text-sm text-zinc-400">
                Belum ada riwayat transaksi sewa garasi.
              </p>
            ) : (
              transaksiList.map((t) => (
                <div
                  key={t.id}
                  className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5"
                >
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2">
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
                      <p className="mt-1 text-sm text-zinc-400">
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
                        Lihat Bukti Bayar
                      </a>
                    </div>
                  </div>

                  {t.perpanjangan && t.perpanjangan.length > 0 && (
                    <div className="mt-4 border-t border-zinc-800 pt-3">
                      <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-400">
                        Riwayat Perpanjangan
                      </p>
                      <div className="space-y-1.5 text-xs text-zinc-300">
                        {t.perpanjangan.map((p) => (
                          <div key={p.id} className="flex flex-wrap justify-between gap-2">
                            <span>
                              {p.tgl_selesai_lama} &rarr; {p.tgl_selesai_baru} (+{p.tambahan_hari}{' '}
                              hari)
                            </span>
                            <span className="text-amber-400">
                              +Rp {Number(p.sisa_biaya).toLocaleString('id-ID')}
                            </span>
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
    </div>
  );
}