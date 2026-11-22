import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import { Garasi } from '@/domain/Garasi';
import { Kendaraan } from '@/domain/Kendaraan';
import { GaragePricingService } from '@/services/GaragePricingService';
import { TipeKendaraan, TipeSewa } from '@/types/domain';

function getTodayDateOnly(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
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
    const {
      garasi_id,
      tipe_kendaraan,
      kapasitas_max_kwh,
      sisa_baterai_persen,
      tipe_sewa,
      jumlah_hari,
    } = body as {
      garasi_id: number;
      tipe_kendaraan: TipeKendaraan;
      kapasitas_max_kwh?: number;
      sisa_baterai_persen?: number;
      tipe_sewa: TipeSewa;
      jumlah_hari?: number;
    };

    if (!garasi_id || !tipe_kendaraan || !tipe_sewa) {
      return NextResponse.json(
        { error: 'Tipe kendaraan, garasi, dan tipe sewa wajib dipilih.' },
        { status: 400 }
      );
    }

    const { data: garasiRow } = await supabaseAdmin
      .from('garasi')
      .select('*')
      .eq('id', garasi_id)
      .single();

    if (!garasiRow) {
      return NextResponse.json({ error: 'Unit garasi tidak ditemukan.' }, { status: 404 });
    }

    let maxKwh: number | null = null;
    let bateraiTerakhirKwh: number | null = null;

    if (tipe_kendaraan === 'MOBIL_LISTRIK') {
      maxKwh = Number(kapasitas_max_kwh);
      const persen = Number(sisa_baterai_persen ?? 0);

      if (!maxKwh || maxKwh <= 0) {
        return NextResponse.json(
          { error: 'Kapasitas listrik (kWh) wajib diisi untuk mobil listrik.' },
          { status: 400 }
        );
      }
      if (isNaN(persen) || persen < 0 || persen > 100) {
        return NextResponse.json(
          { error: 'Persentase sisa baterai harus antara 0% sampai 100%.' },
          { status: 400 }
        );
      }
      bateraiTerakhirKwh = Number(((maxKwh * persen) / 100).toFixed(2));
    }

    const garasiDomain = Garasi.fromRow(garasiRow);
    const kendaraanDomain = new Kendaraan({
      penyewaId: session.userId,
      tipe: tipe_kendaraan,
      merekTipe: 'Preview',
      kapasitasMaxKwh: maxKwh,
      bateraiTerakhirKwh,
    });

    const pricingService = new GaragePricingService();
    const startDate = getTodayDateOnly();
    const batasHarian = pricingService.getBatasMaksimalHarian(startDate);

    let endDate: Date;
    if (tipe_sewa === 'HARIAN') {
      const hari = Number(jumlah_hari);
      if (!hari || hari < 1 || !Number.isInteger(hari)) {
        return NextResponse.json(
          { error: 'Jumlah hari harus berupa bilangan bulat minimal 1.' },
          { status: 400 }
        );
      }
      if (hari > batasHarian) {
        return NextResponse.json(
          {
            error: `Sewa harian bulan ini maksimal ${batasHarian} hari. Pilih paket BULANAN untuk durasi lebih lama.`,
          },
          { status: 400 }
        );
      }
      endDate = pricingService.hitungTanggalSelesaiHarian(startDate, hari);
    } else {
      endDate = pricingService.hitungTanggalSelesaiBulanan(startDate);
    }

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
      batas_maksimal_harian: batasHarian,
      durasi_bulan_ini: pricingService.getJumlahHariBulan(startDate),
      kebutuhan_kwh:
        garasiDomain.getTipe() === 'MOBIL_LISTRIK' ? kendaraanDomain.hitungKebutuhanKwh() : 0,
      rincian,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Gagal menghitung rincian sewa.';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}