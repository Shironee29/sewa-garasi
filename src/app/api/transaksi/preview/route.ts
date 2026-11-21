import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import { Garasi } from '@/domain/Garasi';
import { Kendaraan } from '@/domain/Kendaraan';
import { GaragePricingService } from '@/services/GaragePricingService';
import { TipeSewa } from '@/types/domain';

function parseDateOnly(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function formatDateOnly(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Silakan login terlebih dahulu.' }, { status: 401 });
    }

    const body = await request.json();
    const { garasi_id, kendaraan_id, tgl_mulai, tgl_selesai, tipe_sewa } = body as {
      garasi_id: number;
      kendaraan_id: number;
      tgl_mulai: string;
      tgl_selesai?: string;
      tipe_sewa?: TipeSewa;
    };

    if (!garasi_id || !kendaraan_id || !tgl_mulai) {
      return NextResponse.json(
        { error: 'Garasi, kendaraan, dan tanggal mulai wajib dipilih.' },
        { status: 400 }
      );
    }

    const [{ data: garasiRow }, { data: kendaraanRow }] = await Promise.all([
      supabaseAdmin.from('garasi').select('*').eq('id', garasi_id).single(),
      supabaseAdmin.from('kendaraan').select('*').eq('id', kendaraan_id).single(),
    ]);

    if (!garasiRow || !kendaraanRow) {
      return NextResponse.json({ error: 'Data garasi atau kendaraan tidak ditemukan.' }, { status: 404 });
    }

    const garasiDomain = Garasi.fromRow(garasiRow);
    const kendaraanDomain = new Kendaraan({
      id: kendaraanRow.id,
      penyewaId: kendaraanRow.penyewa_id,
      tipe: kendaraanRow.tipe,
      noPlat: kendaraanRow.no_plat,
      merekTipe: kendaraanRow.merek_tipe,
      kapasitasMaxKwh: kendaraanRow.kapasitas_max_kwh ? Number(kendaraanRow.kapasitas_max_kwh) : null,
      bateraiTerakhirKwh: kendaraanRow.baterai_terakhir_kwh ? Number(kendaraanRow.baterai_terakhir_kwh) : null,
    });

    const pricingService = new GaragePricingService();
    const startDate = parseDateOnly(tgl_mulai);

    // Jika pilih paket BULANAN tanpa mengisi tgl_selesai, otomatis hitung 1 bulan penuh
    const endDate =
      tipe_sewa === 'BULANAN' && !tgl_selesai
        ? pricingService.hitungTanggalSelesaiBulanan(startDate)
        : tgl_selesai
        ? parseDateOnly(tgl_selesai)
        : pricingService.hitungTanggalSelesaiBulanan(startDate);

    const rincian = pricingService.hitungRincianSewa(
      garasiDomain,
      kendaraanDomain,
      startDate,
      endDate,
      tipe_sewa
    );

    return NextResponse.json({
      tgl_mulai: formatDateOnly(startDate),
      tgl_selesai: formatDateOnly(endDate),
      batas_maksimal_harian: pricingService.getBatasMaksimalHarian(startDate),
      durasi_bulan_ini: pricingService.getJumlahHariBulan(startDate),
      kebutuhan_kwh: kendaraanDomain.hitungKebutuhanKwh(),
      rincian,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Gagal menghitung rincian sewa.';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}