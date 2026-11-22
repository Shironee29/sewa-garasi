import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';

const NAMA_BULAN = [
  'Januari',
  'Februari',
  'Maret',
  'April',
  'Mei',
  'Juni',
  'Juli',
  'Agustus',
  'September',
  'Oktober',
  'November',
  'Desember',
];

interface RawTransaksi {
  id: number;
  penyewa_id: number;
  tipe_sewa: string;
  jumlah_hari: number;
  tgl_mulai: string;
  tgl_selesai: string;
  biaya_sewa: number;
  biaya_listrik: number;
  total_biaya: number;
  status: string;
  penyewa: { id: number; nama_lengkap: string; email: string; nik: string } | null;
  garasi: { id: number; kode_garasi: string; tipe: string } | null;
  kendaraan: { merek_tipe: string; no_plat: string | null; tipe: string } | null;
}

export async function GET(request: Request) {
  const session = await getSession();
  if (!session || session.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Akses ditolak. Khusus Admin.' }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const mode = searchParams.get('mode') || 'bulanan';
  const tahun = Number(searchParams.get('tahun')) || new Date().getFullYear();
  const bulan = Number(searchParams.get('bulan')) || new Date().getMonth() + 1;
  const tipeGarasi = searchParams.get('tipe_garasi') || 'ALL';
  const penyewaId = searchParams.get('penyewa_id') || 'ALL';

  const { data, error } = await supabaseAdmin
    .from('transaksi_sewa')
    .select(
      `
      id,
      penyewa_id,
      tipe_sewa,
      jumlah_hari,
      tgl_mulai,
      tgl_selesai,
      biaya_sewa,
      biaya_listrik,
      total_biaya,
      status,
      penyewa:users!transaksi_sewa_penyewa_id_fkey (id, nama_lengkap, email, nik),
      garasi:garasi!transaksi_sewa_garasi_id_fkey (id, kode_garasi, tipe),
      kendaraan:kendaraan!transaksi_sewa_kendaraan_id_fkey (merek_tipe, no_plat, tipe)
      `
    )
    .order('tgl_mulai', { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const allTrx = (data ?? []).map((row) => ({
    ...row,
    biaya_sewa: Number(row.biaya_sewa),
    biaya_listrik: Number(row.biaya_listrik),
    total_biaya: Number(row.total_biaya),
    penyewa: Array.isArray(row.penyewa) ? row.penyewa[0] ?? null : row.penyewa,
    garasi: Array.isArray(row.garasi) ? row.garasi[0] ?? null : row.garasi,
    kendaraan: Array.isArray(row.kendaraan) ? row.kendaraan[0] ?? null : row.kendaraan,
  })) as RawTransaksi[];

  let filtered: RawTransaksi[] = [];
  let rekap: {
    label: string;
    jumlah_transaksi: number;
    total_biaya_sewa: number;
    total_biaya_listrik: number;
    total_pendapatan: number;
  }[] = [];

  if (mode === 'bulanan') {
    filtered = allTrx.filter((t) => {
      const [y] = t.tgl_mulai.split('-').map(Number);
      return y === tahun;
    });

    rekap = NAMA_BULAN.map((nama, idx) => {
      const monthNum = idx + 1;
      const items = filtered.filter((t) => Number(t.tgl_mulai.split('-')[1]) === monthNum);
      return {
        label: `${nama} ${tahun}`,
        jumlah_transaksi: items.length,
        total_biaya_sewa: items.reduce((sum, i) => sum + i.biaya_sewa, 0),
        total_biaya_listrik: items.reduce((sum, i) => sum + i.biaya_listrik, 0),
        total_pendapatan: items.reduce((sum, i) => sum + i.total_biaya, 0),
      };
    });
  } else if (mode === 'harian') {
    filtered = allTrx.filter((t) => {
      const [y, m] = t.tgl_mulai.split('-').map(Number);
      return y === tahun && m === bulan;
    });

    const daysInMonth = new Date(tahun, bulan, 0).getDate();
    rekap = Array.from({ length: daysInMonth }, (_, idx) => {
      const dayNum = idx + 1;
      const items = filtered.filter((t) => Number(t.tgl_mulai.split('-')[2]) === dayNum);
      const tanggalLabel = `${String(dayNum).padStart(2, '0')} ${NAMA_BULAN[bulan - 1]} ${tahun}`;
      return {
        label: tanggalLabel,
        jumlah_transaksi: items.length,
        total_biaya_sewa: items.reduce((sum, i) => sum + i.biaya_sewa, 0),
        total_biaya_listrik: items.reduce((sum, i) => sum + i.biaya_listrik, 0),
        total_pendapatan: items.reduce((sum, i) => sum + i.total_biaya, 0),
      };
    }).filter((r) => r.jumlah_transaksi > 0);
  } else if (mode === 'tipe') {
    filtered =
      tipeGarasi === 'ALL'
        ? allTrx
        : allTrx.filter((t) => t.garasi?.tipe === tipeGarasi);

    const tipeList =
      tipeGarasi === 'ALL' ? ['SEPEDA', 'MOBIL', 'MOBIL_LISTRIK'] : [tipeGarasi];

    rekap = tipeList.map((tp) => {
      const items = filtered.filter((t) => t.garasi?.tipe === tp);
      return {
        label: tp.replace('_', ' '),
        jumlah_transaksi: items.length,
        total_biaya_sewa: items.reduce((sum, i) => sum + i.biaya_sewa, 0),
        total_biaya_listrik: items.reduce((sum, i) => sum + i.biaya_listrik, 0),
        total_pendapatan: items.reduce((sum, i) => sum + i.total_biaya, 0),
      };
    });
  } else if (mode === 'penyewa') {
    filtered =
      penyewaId === 'ALL'
        ? allTrx
        : allTrx.filter((t) => String(t.penyewa_id) === penyewaId);

    const map = new Map<
      number,
      {
        label: string;
        jumlah_transaksi: number;
        total_biaya_sewa: number;
        total_biaya_listrik: number;
        total_pendapatan: number;
      }
    >();

    for (const t of filtered) {
      const existing = map.get(t.penyewa_id) ?? {
        label: t.penyewa
          ? `${t.penyewa.nama_lengkap} (${t.penyewa.email})`
          : `Penyewa #${t.penyewa_id}`,
        jumlah_transaksi: 0,
        total_biaya_sewa: 0,
        total_biaya_listrik: 0,
        total_pendapatan: 0,
      };
      existing.jumlah_transaksi += 1;
      existing.total_biaya_sewa += t.biaya_sewa;
      existing.total_biaya_listrik += t.biaya_listrik;
      existing.total_pendapatan += t.total_biaya;
      map.set(t.penyewa_id, existing);
    }

    rekap = Array.from(map.values());
  }

  const ringkasan = {
    total_transaksi: filtered.length,
    total_biaya_sewa: filtered.reduce((s, i) => s + i.biaya_sewa, 0),
    total_biaya_listrik: filtered.reduce((s, i) => s + i.biaya_listrik, 0),
    total_pendapatan: filtered.reduce((s, i) => s + i.total_biaya, 0),
  };

  return NextResponse.json({
    mode,
    ringkasan,
    rekap,
    detail: filtered,
  });
}