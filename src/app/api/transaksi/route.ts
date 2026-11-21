import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import { uploadBuktiBayar } from '@/lib/storage';
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

    // 1. Pastikan status KTP penyewa terbaru di DB sudah APPROVED
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

    // 2. Baca multipart/form-data (fields + file bukti bayar)
    const formData = await request.formData();
    const garasiId = Number(formData.get('garasi_id'));
    const kendaraanId = Number(formData.get('kendaraan_id'));
    const tglMulaiStr = String(formData.get('tgl_mulai') ?? '');
    const tglSelesaiStr = String(formData.get('tgl_selesai') ?? '');
    const tipeSewaInput = formData.get('tipe_sewa') ? (String(formData.get('tipe_sewa')) as TipeSewa) : undefined;
    const buktiFile = formData.get('bukti_pelunasan') as File | null;

    if (!garasiId || !kendaraanId || !tglMulaiStr || !buktiFile || buktiFile.size === 0) {
      return NextResponse.json(
        { error: 'Garasi, kendaraan, tanggal mulai, dan foto bukti pelunasan wajib diisi.' },
        { status: 400 }
      );
    }

    // 3. Ambil data garasi & kendaraan dari Supabase
    const [{ data: garasiRow }, { data: kendaraanRow }] = await Promise.all([
      supabaseAdmin.from('garasi').select('*').eq('id', garasiId).single(),
      supabaseAdmin
        .from('kendaraan')
        .select('*')
        .eq('id', kendaraanId)
        .eq('penyewa_id', session.userId)
        .single(),
    ]);

    if (!garasiRow) {
      return NextResponse.json({ error: 'Unit garasi tidak ditemukan.' }, { status: 404 });
    }
    if (!kendaraanRow) {
      return NextResponse.json({ error: 'Kendaraan tidak ditemukan atau bukan milik Anda.' }, { status: 404 });
    }

    // 4. Instansiasi Domain OOP & validasi ketersediaan
    const garasiDomain = Garasi.fromRow(garasiRow);
    if (!garasiDomain.isAvailable()) {
      return NextResponse.json(
        { error: `Garasi ${garasiDomain.getKodeGarasi()} sedang digunakan (USED).` },
        { status: 409 }
      );
    }

    const kendaraanDomain = new Kendaraan({
      id: kendaraanRow.id,
      penyewaId: kendaraanRow.penyewa_id,
      tipe: kendaraanRow.tipe,
      noPlat: kendaraanRow.no_plat,
      merekTipe: kendaraanRow.merek_tipe,
      kapasitasMaxKwh: kendaraanRow.kapasitas_max_kwh ? Number(kendaraanRow.kapasitas_max_kwh) : null,
      bateraiTerakhirKwh: kendaraanRow.baterai_terakhir_kwh ? Number(kendaraanRow.baterai_terakhir_kwh) : null,
    });

    // 5. Hitung rincian tarif via GaragePricingService
    const pricingService = new GaragePricingService();
    const startDate = parseDateOnly(tglMulaiStr);
    const endDate =
      tipeSewaInput === 'BULANAN' && !tglSelesaiStr
        ? pricingService.hitungTanggalSelesaiBulanan(startDate)
        : parseDateOnly(tglSelesaiStr);

    const rincian = pricingService.hitungRincianSewa(
      garasiDomain,
      kendaraanDomain,
      startDate,
      endDate,
      tipeSewaInput
    );

    // 6. Upload bukti pelunasan ke Supabase Storage
    const buktiUrl = await uploadBuktiBayar(buktiFile, `sewa-u${session.userId}`);

    // 7. Simpan transaksi sewa ke database
    const { data: transaksi, error: insertError } = await supabaseAdmin
      .from('transaksi_sewa')
      .insert({
        penyewa_id: session.userId,
        garasi_id: garasiId,
        kendaraan_id: kendaraanId,
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

    // 8. Ubah status garasi menjadi USED melalui method OOP
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
        message: 'Transaksi sewa berhasil dibuat dan garasi aktif digunakan.',
        transaksi,
      },
      { status: 201 }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Gagal membuat transaksi sewa.';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}