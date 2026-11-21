import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import { uploadBuktiBayar } from '@/lib/storage';
import { Garasi } from '@/domain/Garasi';
import { TransaksiSewa } from '@/domain/TransaksiSewa';
import { GaragePricingService } from '@/services/GaragePricingService';

function parseDateOnly(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session || session.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Akses ditolak. Khusus Admin.' }, { status: 403 });
    }

    const { id } = await params;
    const transaksiId = Number(id);

    const formData = await request.formData();
    const tglSelesaiBaruStr = String(formData.get('tgl_selesai_baru') ?? '');
    const buktiFile = formData.get('bukti_bayar') as File | null;

    if (!tglSelesaiBaruStr || !buktiFile || buktiFile.size === 0) {
      return NextResponse.json(
        { error: 'Tanggal selesai baru dan bukti pembayaran perpanjangan wajib diisi.' },
        { status: 400 }
      );
    }

    // 1. Ambil transaksi aktif beserta garasinya
    const { data: trxRow, error: trxError } = await supabaseAdmin
      .from('transaksi_sewa')
      .select('*, garasi:garasi!transaksi_sewa_garasi_id_fkey(*)')
      .eq('id', transaksiId)
      .single();

    if (trxError || !trxRow) {
      return NextResponse.json({ error: 'Transaksi tidak ditemukan.' }, { status: 404 });
    }

    if (trxRow.status !== 'ACTIVE') {
      return NextResponse.json(
        { error: 'Hanya transaksi berstatus ACTIVE yang dapat diperpanjang.' },
        { status: 400 }
      );
    }

    // 2. Instansiasi Domain OOP
    const garasiDomain = Garasi.fromRow(trxRow.garasi);
    const tglMulai = parseDateOnly(trxRow.tgl_mulai);
    const tglSelesaiLama = parseDateOnly(trxRow.tgl_selesai);
    const tglSelesaiBaru = parseDateOnly(tglSelesaiBaruStr);

    const transaksiDomain = new TransaksiSewa({
      id: trxRow.id,
      penyewaId: trxRow.penyewa_id,
      garasiId: trxRow.garasi_id,
      kendaraanId: trxRow.kendaraan_id,
      tipeSewa: trxRow.tipe_sewa,
      jumlahHari: Number(trxRow.jumlah_hari ?? 0),
      tglMulai,
      tglSelesai: tglSelesaiLama,
      biayaSewa: Number(trxRow.biaya_sewa),
      biayaListrik: Number(trxRow.biaya_listrik),
      totalBiaya: Number(trxRow.total_biaya),
      buktiPelunasan: trxRow.bukti_pelunasan,
      status: trxRow.status,
    });

    // 3. Hitung tambahan hari & sisa biaya via GaragePricingService
    const pricingService = new GaragePricingService();
    const tambahanHari = pricingService.hitungSelisihHari(tglSelesaiLama, tglSelesaiBaru);
    const sisaBiaya = pricingService.hitungBiayaPerpanjangan(
      transaksiDomain,
      garasiDomain,
      tglSelesaiBaru
    );

    // 4. Upload bukti bayar perpanjangan
    const buktiUrl = await uploadBuktiBayar(buktiFile, `perpanjangan-trx${transaksiId}`);

    // 5. Simpan riwayat perpanjangan
    const { data: perpanjangan, error: insertError } = await supabaseAdmin
      .from('perpanjangan_sewa')
      .insert({
        transaksi_sewa_id: transaksiId,
        diproses_admin_id: session.userId,
        tgl_selesai_lama: trxRow.tgl_selesai,
        tgl_selesai_baru: tglSelesaiBaruStr,
        tambahan_hari: tambahanHari,
        sisa_biaya: sisaBiaya,
        bukti_bayar: buktiUrl,
      })
      .select('*')
      .single();

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    // 6. Perbarui data transaksi utama
    const { error: updateError } = await supabaseAdmin
      .from('transaksi_sewa')
      .update({
        tgl_selesai: tglSelesaiBaruStr,
        jumlah_hari: Number(trxRow.jumlah_hari ?? 0) + tambahanHari,
        biaya_sewa: Number(trxRow.biaya_sewa) + sisaBiaya,
        total_biaya: Number(trxRow.total_biaya) + sisaBiaya,
        updated_at: new Date().toISOString(),
      })
      .eq('id', transaksiId);

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    return NextResponse.json(
      {
        message: `Perpanjangan berhasil (+${tambahanHari} hari, tambahan biaya Rp ${sisaBiaya.toLocaleString('id-ID')}).`,
        perpanjangan,
      },
      { status: 201 }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Gagal memproses perpanjangan sewa.';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}