import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import { uploadBuktiBayar } from '@/lib/storage';
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

function normalizePlatNomor(input: string): string {
  const compact = input.replace(/\s+/g, '').toUpperCase();
  const match = compact.match(/^([A-Z]{1,2})(\d{1,4})([A-Z]{0,3})$/);
  if (match) {
    return [match[1], match[2], match[3]].filter(Boolean).join(' ');
  }
  return compact;
}

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Silakan login terlebih dahulu.' }, { status: 401 });
  }

  let query = supabaseAdmin
    .from('transaksi_sewa')
    .select(
      `
      *,
      penyewa:users!transaksi_sewa_penyewa_id_fkey (id, nama_lengkap, email, nik, no_telp),
      garasi:garasi!transaksi_sewa_garasi_id_fkey (id, kode_garasi, tipe, harga_harian, harga_listrik_per_kwh, status),
      kendaraan:kendaraan!transaksi_sewa_kendaraan_id_fkey (id, tipe, no_plat, merek_tipe, kapasitas_max_kwh, baterai_terakhir_kwh),
      perpanjangan:perpanjangan_sewa (*)
      `
    )
    .order('created_at', { ascending: false });

  if (session.role === 'PENYEWA') {
    query = query.eq('penyewa_id', session.userId);
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ transaksi: data });
}

export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session || session.role !== 'PENYEWA') {
      return NextResponse.json(
        { error: 'Hanya penyewa yang dapat membuat transaksi sewa.' },
        { status: 403 }
      );
    }

    // 1. Pastikan status KTP penyewa sudah APPROVED
    const { data: userRow } = await supabaseAdmin
      .from('users')
      .select('status_ktp')
      .eq('id', session.userId)
      .single();

    if (!userRow || userRow.status_ktp !== 'APPROVED') {
      return NextResponse.json(
        { error: 'KTP Anda belum diverifikasi (APPROVED) oleh Admin.' },
        { status: 403 }
      );
    }

    // 2. Baca formData (detail kendaraan inline + pilihan garasi + durasi + bukti bayar)
    const formData = await request.formData();
    const garasiId = Number(formData.get('garasi_id'));
    const tipeKendaraan = String(formData.get('tipe_kendaraan') ?? '') as TipeKendaraan;
    const merekTipe = String(formData.get('merek_tipe') ?? '').trim();
    const noPlatRaw = String(formData.get('no_plat') ?? '').trim();
    const kapasitasMaxKwhRaw = formData.get('kapasitas_max_kwh');
    const sisaBateraiPersenRaw = formData.get('sisa_baterai_persen');
    const tipeSewa = String(formData.get('tipe_sewa') ?? '') as TipeSewa;
    const jumlahHariRaw = formData.get('jumlah_hari');
    const buktiFile = formData.get('bukti_pelunasan') as File | null;

    if (!garasiId || !tipeKendaraan || !merekTipe || !tipeSewa || !buktiFile || buktiFile.size === 0) {
      return NextResponse.json(
        { error: 'Detail kendaraan, unit garasi, tipe sewa, dan bukti pelunasan wajib diisi.' },
        { status: 400 }
      );
    }

    // 3. Validasi & normalisasi plat nomor
    let formattedPlat: string | null = null;
    if (tipeKendaraan !== 'SEPEDA') {
      if (!noPlatRaw) {
        return NextResponse.json(
          { error: 'Nomor plat wajib diisi untuk kendaraan bermotor.' },
          { status: 400 }
        );
      }
      formattedPlat = normalizePlatNomor(noPlatRaw);

      // Pastikan kendaraan dengan plat ini tidak sedang aktif menyewa garasi lain
      const compactPlat = formattedPlat.replace(/\s+/g, '');
      const { data: activeTrx } = await supabaseAdmin
        .from('transaksi_sewa')
        .select('id, kendaraan:kendaraan!transaksi_sewa_kendaraan_id_fkey(no_plat)')
        .eq('status', 'ACTIVE');

      const isCurrentlyParked = (activeTrx ?? []).some((row) => {
        const k = Array.isArray(row.kendaraan) ? row.kendaraan[0] : row.kendaraan;
        return k?.no_plat?.replace(/\s+/g, '').toUpperCase() === compactPlat;
      });

      if (isCurrentlyParked) {
        return NextResponse.json(
          { error: `Kendaraan dengan plat ${formattedPlat} sedang aktif terparkir di garasi lain.` },
          { status: 409 }
        );
      }
    }

    // 4. Validasi kapasitas listrik EV
    let maxKwh: number | null = null;
    let bateraiTerakhirKwh: number | null = null;
    if (tipeKendaraan === 'MOBIL_LISTRIK') {
      maxKwh = Number(kapasitasMaxKwhRaw);
      const persen = Number(sisaBateraiPersenRaw ?? 0);
      if (!maxKwh || maxKwh <= 0 || isNaN(persen) || persen < 0 || persen > 100) {
        return NextResponse.json(
          { error: 'Kapasitas listrik (kWh) dan persentase baterai (0-100%) harus valid.' },
          { status: 400 }
        );
      }
      bateraiTerakhirKwh = Number(((maxKwh * persen) / 100).toFixed(2));
    }

    // 5. Ambil & cek ketersediaan garasi
    const { data: garasiRow } = await supabaseAdmin
      .from('garasi')
      .select('*')
      .eq('id', garasiId)
      .single();

    if (!garasiRow) {
      return NextResponse.json({ error: 'Unit garasi tidak ditemukan.' }, { status: 404 });
    }

    const garasiDomain = Garasi.fromRow(garasiRow);
    if (!garasiDomain.isAvailable()) {
      return NextResponse.json(
        { error: `Garasi ${garasiDomain.getKodeGarasi()} sedang digunakan (USED).` },
        { status: 409 }
      );
    }

    const kendaraanDomain = new Kendaraan({
      penyewaId: session.userId,
      tipe: tipeKendaraan,
      noPlat: formattedPlat,
      merekTipe,
      kapasitasMaxKwh: maxKwh,
      bateraiTerakhirKwh,
    });

    // 6. Hitung tanggal & tarif (tgl_mulai selalu hari ini)
    const pricingService = new GaragePricingService();
    const startDate = getTodayDateOnly();

    let endDate: Date;
    if (tipeSewa === 'HARIAN') {
      const hari = Number(jumlahHariRaw);
      if (!hari || hari < 1 || !Number.isInteger(hari)) {
        return NextResponse.json({ error: 'Jumlah hari tidak valid.' }, { status: 400 });
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
      tipeSewa
    );

    // 7. Simpan data kendaraan ke tabel kendaraan
    const { data: kendaraanRow, error: kendaraanError } = await supabaseAdmin
      .from('kendaraan')
      .insert({
        penyewa_id: session.userId,
        tipe: tipeKendaraan,
        no_plat: formattedPlat,
        merek_tipe: merekTipe,
        kapasitas_max_kwh: maxKwh,
        baterai_terakhir_kwh: bateraiTerakhirKwh,
      })
      .select('id')
      .single();

    if (kendaraanError || !kendaraanRow) {
      return NextResponse.json(
        { error: kendaraanError?.message ?? 'Gagal menyimpan data kendaraan.' },
        { status: 500 }
      );
    }

    // 8. Upload bukti pelunasan ke Supabase Storage
    const buktiUrl = await uploadBuktiBayar(buktiFile, `sewa-u${session.userId}`);

    // 9. Simpan transaksi sewa
    const { data: transaksi, error: insertError } = await supabaseAdmin
      .from('transaksi_sewa')
      .insert({
        penyewa_id: session.userId,
        garasi_id: garasiId,
        kendaraan_id: kendaraanRow.id,
        tipe_sewa: rincian.tipeSewa,
        jumlah_hari: rincian.jumlahHari,
        tgl_mulai: formatDateOnly(startDate),
        tgl_selesai: formatDateOnly(endDate),
        biaya_sewa: rincian.biayaSewa,
        biaya_listrik: rincian.biayaListrik,
        total_biaya: rincian.totalBiaya,
        bukti_pelunasan: buktiUrl,
        status: 'ACTIVE',
      })
      .select('*')
      .single();

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    // 10. Ubah status garasi menjadi USED
    garasiDomain.ubahStatus('USED');
    await supabaseAdmin
      .from('garasi')
      .update({
        status: garasiDomain.getStatus(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', garasiId);

    return NextResponse.json(
      {
        message: `Sewa garasi ${garasiDomain.getKodeGarasi()} berhasil! Status garasi kini USED.`,
        transaksi,
      },
      { status: 201 }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Gagal membuat transaksi sewa.';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}