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

function getAllowedGarasiTypes(tipeKendaraan: TipeKendaraan): TipeGarasi[] {
  if (tipeKendaraan === 'SEPEDA' || tipeKendaraan === 'SEPEDA_MOTOR') {
    return ['SEPEDA'];
  }
  if (tipeKendaraan === 'MOBIL') {
    return ['MOBIL'];
  }
  return ['MOBIL', 'MOBIL_LISTRIK'];
}

export default function PenyewaDashboardClient() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'sewa' | 'riwayat'>('sewa');

  const [user, setUser] = useState<UserProfile | null>(null);
  const [garasiList, setGarasiList] = useState<GarasiItem[]>([]);
  const [transaksiList, setTransaksiList] = useState<TransaksiItem[]>([]);
  const [loadingInit, setLoadingInit] = useState(true);
  const [feedback, setFeedback] = useState<{ type: 'error' | 'success'; text: string } | null>(null);

  // State Form Sewa Baru
  const [tipeKendaraan, setTipeKendaraan] = useState<TipeKendaraan>('SEPEDA_MOTOR');
  const [merekTipe, setMerekTipe] = useState('');
  const [noPlat, setNoPlat] = useState('');
  const [kapasitasMaxKwh, setKapasitasMaxKwh] = useState('');
  const [sisaBateraiPersen, setSisaBateraiPersen] = useState('0');

  const [selectedTipeGarasi, setSelectedTipeGarasi] = useState<TipeGarasi>('SEPEDA');
  const [selectedGarasiId, setSelectedGarasiId] = useState<string>('');
  const [tipeSewa, setTipeSewa] = useState<TipeSewa>('HARIAN');
  const [jumlahHari, setJumlahHari] = useState<string>('1');
  const [buktiFile, setBuktiFile] = useState<File | null>(null);

  const [preview, setPreview] = useState<PreviewResponse | null>(null);
  const [previewError, setPreviewError] = useState<string>('');
  const [submittingSewa, setSubmittingSewa] = useState(false);

  const todayStr = useMemo(() => getTodayString(), []);
  const maxDailyThisMonth = useMemo(() => {
    const now = new Date();
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    return Math.min(30, daysInMonth - 1);
  }, []);

  const loadAllData = useCallback(async () => {
    try {
      const [meRes, gRes, tRes] = await Promise.all([
        fetch('/api/auth/me'),
        fetch('/api/garasi?status=AVAILABLE'),
        fetch('/api/transaksi'),
      ]);

      if (meRes.ok) {
        const meData = await meRes.json();
        setUser(meData.user);
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

  const allowedGarasiTypes = useMemo(
    () => getAllowedGarasiTypes(tipeKendaraan),
    [tipeKendaraan]
  );

  useEffect(() => {
    if (!allowedGarasiTypes.includes(selectedTipeGarasi)) {
      setSelectedTipeGarasi(allowedGarasiTypes[0]);
      setSelectedGarasiId('');
    }
  }, [allowedGarasiTypes, selectedTipeGarasi]);

  const availableGarasiByType = useMemo(
    () => garasiList.filter((g) => g.tipe === selectedTipeGarasi),
    [garasiList, selectedTipeGarasi]
  );

  useEffect(() => {
    if (selectedGarasiId && !availableGarasiByType.some((g) => String(g.id) === selectedGarasiId)) {
      setSelectedGarasiId('');
    }
  }, [availableGarasiByType, selectedGarasiId]);

  useEffect(() => {
    if (!selectedGarasiId) {
      setPreview(null);
      setPreviewError('');
      return;
    }

    if (tipeKendaraan === 'MOBIL_LISTRIK' && !kapasitasMaxKwh) {
      setPreview(null);
      setPreviewError('Isi kapasitas listrik (kWh) untuk melihat estimasi biaya.');
      return;
    }

    if (tipeSewa === 'HARIAN' && !jumlahHari) {
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
            tipe_kendaraan: tipeKendaraan,
            kapasitas_max_kwh: tipeKendaraan === 'MOBIL_LISTRIK' ? Number(kapasitasMaxKwh) : undefined,
            sisa_baterai_persen:
              tipeKendaraan === 'MOBIL_LISTRIK' ? Number(sisaBateraiPersen || 0) : undefined,
            tipe_sewa: tipeSewa,
            jumlah_hari: tipeSewa === 'HARIAN' ? Number(jumlahHari) : undefined,
          }),
          signal: controller.signal,
        });

        const data = await res.json();
        if (!res.ok) {
          setPreview(null);
          setPreviewError(data.error || 'Input tidak valid.');
          return;
        }
        setPreview(data);
      } catch (err) {
        if ((err as Error).name !== 'AbortError') {
          setPreviewError('Gagal menghitung estimasi biaya.');
        }
      }
    }

    fetchPreview();
    return () => controller.abort();
  }, [
    selectedGarasiId,
    tipeKendaraan,
    kapasitasMaxKwh,
    sisaBateraiPersen,
    tipeSewa,
    jumlahHari,
  ]);

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
    router.refresh();
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
      formData.append('tipe_kendaraan', tipeKendaraan);
      formData.append('merek_tipe', merekTipe);
      if (tipeKendaraan !== 'SEPEDA') {
        formData.append('no_plat', noPlat);
      }
      if (tipeKendaraan === 'MOBIL_LISTRIK') {
        formData.append('kapasitas_max_kwh', kapasitasMaxKwh);
        formData.append('sisa_baterai_persen', sisaBateraiPersen || '0');
      }
      formData.append('tipe_sewa', tipeSewa);
      if (tipeSewa === 'HARIAN') {
        formData.append('jumlah_hari', jumlahHari);
      }
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
      setMerekTipe('');
      setNoPlat('');
      setKapasitasMaxKwh('');
      setSisaBateraiPersen('0');
      setSelectedGarasiId('');
      setJumlahHari('1');
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
      <div className="flex min-h-screen items-center justify-center bg-[#F5F5F7] text-sm text-[#86868B]">
        Memuat ruang kerja penyewa...
      </div>
    );
  }

  const isApproved = user?.status_ktp === 'APPROVED';

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
            <span className="rounded-full bg-[#F5F5F7] px-2.5 py-0.5 text-xs font-medium text-[#6E6E73]">
              Penyewa
            </span>
          </div>

          <div className="flex items-center gap-3.5">
            <div className="text-right">
              <p className="text-[13px] font-semibold text-[#1D1D1F]">{user?.nama_lengkap}</p>
              <p className="text-[11px] text-[#86868B]">{user?.email}</p>
            </div>
            <span
              className={`rounded-full px-3 py-1 text-xs font-medium ${
                user?.status_ktp === 'APPROVED'
                  ? 'bg-[#34C759]/12 text-[#1E8E3E]'
                  : user?.status_ktp === 'REJECTED'
                  ? 'bg-[#FF3B30]/12 text-[#D93025]'
                  : 'bg-[#FF9500]/12 text-[#B26B00]'
              }`}
            >
              KTP: {user?.status_ktp}
            </span>
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

        {/* Apple Segmented Control */}
        <div className="mb-8 inline-flex rounded-full bg-black/[0.05] p-1">
          {(
            [
              { key: 'sewa', label: 'Sewa Baru' },
              { key: 'riwayat', label: `Riwayat Sewa (${transaksiList.length})` },
            ] as const
          ).map((tab) => (
            <button
              key={tab.key}
              onClick={() => {
                setActiveTab(tab.key);
                setFeedback(null);
              }}
              className={`rounded-full px-5 py-1.5 text-[13px] font-medium transition ${
                activeTab === tab.key
                  ? 'bg-white text-[#1D1D1F] shadow-[0_1px_4px_rgba(0,0,0,0.08)]'
                  : 'text-[#6E6E73] hover:text-[#1D1D1F]'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* TAB 1: SEWA BARU */}
        {activeTab === 'sewa' && (
          <>
            {!isApproved ? (
              <div className="rounded-3xl border border-black/[0.06] bg-white p-10 text-center shadow-[0_2px_12px_rgba(0,0,0,0.03)]">
                <div
                  className={`mx-auto mb-3 inline-flex rounded-full px-3.5 py-1 text-xs font-semibold ${
                    user?.status_ktp === 'REJECTED'
                      ? 'bg-[#FF3B30]/12 text-[#D93025]'
                      : 'bg-[#FF9500]/12 text-[#B26B00]'
                  }`}
                >
                  Status KTP: {user?.status_ktp}
                </div>
                <h2 className="text-xl font-semibold tracking-tight text-[#1D1D1F]">
                  {user?.status_ktp === 'REJECTED'
                    ? 'Verifikasi KTP Ditolak'
                    : 'Menunggu Verifikasi Admin'}
                </h2>
                <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-[#6E6E73]">
                  {user?.status_ktp === 'REJECTED'
                    ? 'Data KTP Anda ditolak oleh Admin sehingga akses penyewaan garasi belum tersedia.'
                    : 'Admin sedang meninjau identitas KTP Anda. Formulir penyewaan garasi akan terbuka otomatis setelah disetujui.'}
                </p>
              </div>
            ) : (
              <div className="grid gap-8 lg:grid-cols-3">
                <form
                  onSubmit={handleSubmitSewa}
                  className="space-y-7 rounded-3xl border border-black/[0.06] bg-white p-7 shadow-[0_2px_12px_rgba(0,0,0,0.03)] lg:col-span-2"
                >
                  <div>
                    <h2 className="text-[17px] font-semibold tracking-tight text-[#1D1D1F]">
                      1. Detail Kendaraan
                    </h2>
                    <div className="mt-4 grid gap-4 sm:grid-cols-2">
                      <div>
                        <label className="mb-1.5 block text-[13px] font-medium text-[#1D1D1F]">
                          Tipe Kendaraan
                        </label>
                        <select
                          value={tipeKendaraan}
                          onChange={(e) => setTipeKendaraan(e.target.value as TipeKendaraan)}
                          className="w-full rounded-xl border border-[#D2D2D7] bg-white px-3.5 py-2.5 text-sm text-[#1D1D1F] outline-none transition focus:border-[#0071E3] focus:ring-4 focus:ring-[#0071E3]/15"
                        >
                          <option value="SEPEDA">Sepeda</option>
                          <option value="SEPEDA_MOTOR">Sepeda Motor</option>
                          <option value="MOBIL">Mobil</option>
                          <option value="MOBIL_LISTRIK">Mobil Listrik (EV)</option>
                        </select>
                      </div>

                      <div>
                        <label className="mb-1.5 block text-[13px] font-medium text-[#1D1D1F]">
                          Merek &amp; Tipe
                        </label>
                        <input
                          type="text"
                          required
                          value={merekTipe}
                          onChange={(e) => setMerekTipe(e.target.value)}
                          placeholder="Contoh: Hyundai Ioniq 5 / Honda Vario"
                          className="w-full rounded-xl border border-[#D2D2D7] bg-white px-3.5 py-2.5 text-sm text-[#1D1D1F] placeholder-[#86868B] outline-none transition focus:border-[#0071E3] focus:ring-4 focus:ring-[#0071E3]/15"
                        />
                      </div>

                      {tipeKendaraan !== 'SEPEDA' && (
                        <div>
                          <label className="mb-1.5 block text-[13px] font-medium text-[#1D1D1F]">
                            Nomor Plat
                          </label>
                          <input
                            type="text"
                            required
                            value={noPlat}
                            onChange={(e) => setNoPlat(e.target.value.toUpperCase())}
                            placeholder="L 1234 AB"
                            className="w-full rounded-xl border border-[#D2D2D7] bg-white px-3.5 py-2.5 text-sm text-[#1D1D1F] placeholder-[#86868B] outline-none transition focus:border-[#0071E3] focus:ring-4 focus:ring-[#0071E3]/15"
                          />
                        </div>
                      )}

                      {tipeKendaraan === 'MOBIL_LISTRIK' && (
                        <>
                          <div>
                            <label className="mb-1.5 block text-[13px] font-medium text-[#1D1D1F]">
                              Kapasitas Listrik (kWh)
                            </label>
                            <input
                              type="number"
                              step="0.1"
                              min="1"
                              required
                              value={kapasitasMaxKwh}
                              onChange={(e) => setKapasitasMaxKwh(e.target.value)}
                              placeholder="Contoh: 72.6"
                              className="w-full rounded-xl border border-[#D2D2D7] bg-white px-3.5 py-2.5 text-sm text-[#1D1D1F] placeholder-[#86868B] outline-none transition focus:border-[#0071E3] focus:ring-4 focus:ring-[#0071E3]/15"
                            />
                          </div>
                          <div>
                            <label className="mb-1.5 block text-[13px] font-medium text-[#1D1D1F]">
                              Sisa Baterai Saat Ini (%)
                            </label>
                            <input
                              type="number"
                              min="0"
                              max="100"
                              value={sisaBateraiPersen}
                              onChange={(e) => setSisaBateraiPersen(e.target.value)}
                              placeholder="0"
                              className="w-full rounded-xl border border-[#D2D2D7] bg-white px-3.5 py-2.5 text-sm text-[#1D1D1F] placeholder-[#86868B] outline-none transition focus:border-[#0071E3] focus:ring-4 focus:ring-[#0071E3]/15"
                            />
                            <p className="mt-1 text-[11px] text-[#86868B]">
                              Default 0% menghitung pengisian penuh 100% kapasitas.
                            </p>
                          </div>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="border-t border-black/[0.06] pt-6">
                    <h2 className="text-[17px] font-semibold tracking-tight text-[#1D1D1F]">
                      2. Unit Garasi Tersedia Hari Ini
                    </h2>
                    <div className="mt-4 grid gap-4 sm:grid-cols-2">
                      <div>
                        <label className="mb-1.5 block text-[13px] font-medium text-[#1D1D1F]">
                          Tipe Garasi
                        </label>
                        <select
                          value={selectedTipeGarasi}
                          onChange={(e) => {
                            setSelectedTipeGarasi(e.target.value as TipeGarasi);
                            setSelectedGarasiId('');
                          }}
                          className="w-full rounded-xl border border-[#D2D2D7] bg-white px-3.5 py-2.5 text-sm text-[#1D1D1F] outline-none transition focus:border-[#0071E3] focus:ring-4 focus:ring-[#0071E3]/15"
                        >
                          {allowedGarasiTypes.map((t) => (
                            <option key={t} value={t}>
                              {t === 'SEPEDA'
                                ? 'Garasi Sepeda / Motor'
                                : t === 'MOBIL'
                                ? 'Garasi Mobil'
                                : 'Garasi Mobil Listrik (Wajib Isi Penuh)'}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="mb-1.5 block text-[13px] font-medium text-[#1D1D1F]">
                          Unit Garasi Tersedia
                        </label>
                        <select
                          required
                          value={selectedGarasiId}
                          onChange={(e) => setSelectedGarasiId(e.target.value)}
                          className="w-full rounded-xl border border-[#D2D2D7] bg-white px-3.5 py-2.5 text-sm text-[#1D1D1F] outline-none transition focus:border-[#0071E3] focus:ring-4 focus:ring-[#0071E3]/15"
                        >
                          <option value="">
                            {availableGarasiByType.length === 0
                              ? '-- Tidak ada unit tersedia --'
                              : '-- Pilih Unit Garasi --'}
                          </option>
                          {availableGarasiByType.map((g) => (
                            <option key={g.id} value={g.id}>
                              {g.kode_garasi} — Rp {g.harga_harian.toLocaleString('id-ID')}/hari
                              {g.harga_listrik_per_kwh
                                ? ` (+Rp ${g.harga_listrik_per_kwh.toLocaleString('id-ID')}/kWh)`
                                : ''}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>

                  <div className="border-t border-black/[0.06] pt-6">
                    <h2 className="text-[17px] font-semibold tracking-tight text-[#1D1D1F]">
                      3. Durasi &amp; Pelunasan
                    </h2>
                    <div className="mt-4 space-y-4">
                      <div className="grid grid-cols-2 rounded-full bg-black/[0.05] p-1">
                        {(['HARIAN', 'BULANAN'] as const).map((t) => (
                          <button
                            key={t}
                            type="button"
                            onClick={() => setTipeSewa(t)}
                            className={`rounded-full py-2 text-[13px] font-medium transition ${
                              tipeSewa === t
                                ? 'bg-white text-[#1D1D1F] shadow-[0_1px_4px_rgba(0,0,0,0.08)]'
                                : 'text-[#6E6E73] hover:text-[#1D1D1F]'
                            }`}
                          >
                            {t === 'HARIAN' ? 'Sewa Harian' : 'Sewa Bulanan (25×)'}
                          </button>
                        ))}
                      </div>

                      {tipeSewa === 'HARIAN' && (
                        <div>
                          <label className="mb-1.5 block text-[13px] font-medium text-[#1D1D1F]">
                            Jumlah Hari (maksimal {maxDailyThisMonth} hari bulan ini)
                          </label>
                          <input
                            type="number"
                            min="1"
                            max={maxDailyThisMonth}
                            required
                            value={jumlahHari}
                            onChange={(e) => setJumlahHari(e.target.value)}
                            className="w-full rounded-xl border border-[#D2D2D7] bg-white px-3.5 py-2.5 text-sm text-[#1D1D1F] outline-none transition focus:border-[#0071E3] focus:ring-4 focus:ring-[#0071E3]/15"
                          />
                        </div>
                      )}

                      <div className="grid gap-4 sm:grid-cols-2">
                        <div>
                          <label className="mb-1.5 block text-[13px] font-medium text-[#1D1D1F]">
                            Tanggal Mulai (Hari Ini)
                          </label>
                          <input
                            type="date"
                            readOnly
                            value={todayStr}
                            className="w-full rounded-xl border border-black/[0.06] bg-[#F5F5F7] px-3.5 py-2.5 text-sm text-[#6E6E73] outline-none"
                          />
                        </div>

                        <div>
                          <label className="mb-1.5 block text-[13px] font-medium text-[#1D1D1F]">
                            Tanggal Selesai (Otomatis)
                          </label>
                          <input
                            type="date"
                            readOnly
                            value={preview?.tgl_selesai ?? ''}
                            className="w-full rounded-xl border border-black/[0.06] bg-[#F5F5F7] px-3.5 py-2.5 text-sm text-[#6E6E73] outline-none"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="mb-1.5 block text-[13px] font-medium text-[#1D1D1F]">
                          Bukti Pelunasan Biaya (JPG/PNG/WEBP, maks 5MB)
                        </label>
                        <input
                          type="file"
                          required
                          accept="image/jpeg,image/png,image/webp"
                          onChange={(e) => setBuktiFile(e.target.files?.[0] ?? null)}
                          className="w-full rounded-xl border border-[#D2D2D7] bg-white px-3 py-2 text-sm text-[#6E6E73] file:mr-4 file:rounded-full file:border-0 file:bg-[#0071E3]/10 file:px-4 file:py-1.5 file:text-xs file:font-medium file:text-[#0071E3]"
                        />
                      </div>

                      <button
                        type="submit"
                        disabled={!preview || submittingSewa}
                        className="w-full rounded-full bg-[#0071E3] py-3 text-sm font-medium text-white shadow-sm transition hover:bg-[#0077ED] disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        {submittingSewa ? 'Menyimpan Transaksi...' : 'Konfirmasi & Sewa Garasi'}
                      </button>
                    </div>
                  </div>
                </form>

                {/* Panel Ringkasan Biaya */}
                <div className="h-fit rounded-3xl border border-black/[0.06] bg-white p-7 shadow-[0_2px_12px_rgba(0,0,0,0.03)]">
                  <h3 className="text-[17px] font-semibold tracking-tight text-[#1D1D1F]">
                    Ringkasan Biaya
                  </h3>

                  {previewError && (
                    <div className="mt-4 rounded-2xl bg-[#FF3B30]/10 p-3.5 text-xs font-medium text-[#D93025]">
                      {previewError}
                    </div>
                  )}

                  {!preview && !previewError && (
                    <p className="mt-4 text-sm leading-relaxed text-[#86868B]">
                      Lengkapi detail kendaraan dan pilih unit garasi untuk melihat total pelunasan
                      secara otomatis.
                    </p>
                  )}

                  {preview && (
                    <div className="mt-5 space-y-3 text-sm">
                      <div className="flex justify-between">
                        <span className="text-[#6E6E73]">Paket</span>
                        <span className="font-semibold text-[#0071E3]">
                          {preview.rincian.tipeSewa}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-[#6E6E73]">Periode</span>
                        <span className="font-medium text-[#1D1D1F]">
                          {preview.tgl_mulai} &rarr; {preview.tgl_selesai}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-[#6E6E73]">Durasi</span>
                        <span className="font-medium text-[#1D1D1F]">
                          {preview.rincian.jumlahHari} hari
                        </span>
                      </div>

                      <div className="space-y-2.5 border-t border-black/[0.06] pt-3.5">
                        <div className="flex justify-between">
                          <span className="text-[#6E6E73]">Sewa Garasi</span>
                          <span className="font-medium text-[#1D1D1F]">
                            Rp {preview.rincian.biayaSewa.toLocaleString('id-ID')}
                          </span>
                        </div>
                        {preview.rincian.biayaListrik > 0 && (
                          <div className="flex justify-between text-[#0071E3]">
                            <span>Isi Listrik ({preview.kebutuhan_kwh} kWh)</span>
                            <span className="font-medium">
                              Rp {preview.rincian.biayaListrik.toLocaleString('id-ID')}
                            </span>
                          </div>
                        )}
                      </div>

                      <div className="flex items-baseline justify-between border-t border-black/[0.06] pt-4">
                        <span className="text-sm font-semibold text-[#1D1D1F]">Total Biaya</span>
                        <span className="text-xl font-semibold tracking-tight text-[#1D1D1F]">
                          Rp {preview.rincian.totalBiaya.toLocaleString('id-ID')}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </>
        )}

        {/* TAB 2: RIWAYAT SEWA */}
        {activeTab === 'riwayat' && (
          <div className="space-y-4">
            {transaksiList.length === 0 ? (
              <div className="rounded-3xl border border-black/[0.06] bg-white p-10 text-center text-sm text-[#86868B] shadow-[0_2px_12px_rgba(0,0,0,0.03)]">
                Belum ada riwayat transaksi sewa garasi.
              </div>
            ) : (
              transaksiList.map((t) => (
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
                      <p className="mt-1.5 text-sm text-[#6E6E73]">
                        Kendaraan: <span className="text-[#1D1D1F]">{t.kendaraan?.merek_tipe}</span>{' '}
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
                        Lihat Bukti Bayar &rarr;
                      </a>
                    </div>
                  </div>

                  {t.perpanjangan && t.perpanjangan.length > 0 && (
                    <div className="mt-4 border-t border-black/[0.06] pt-3.5">
                      <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-[#86868B]">
                        Riwayat Perpanjangan
                      </p>
                      <div className="space-y-1.5 text-xs text-[#6E6E73]">
                        {t.perpanjangan.map((p) => (
                          <div key={p.id} className="flex flex-wrap justify-between gap-2">
                            <span>
                              {p.tgl_selesai_lama} &rarr; {p.tgl_selesai_baru} (+{p.tambahan_hari}{' '}
                              hari)
                            </span>
                            <span className="font-medium text-[#0071E3]">
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