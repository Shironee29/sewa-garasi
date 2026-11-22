import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import { Garasi } from '@/domain/Garasi';
import { TipeGarasi } from '@/types/domain';

const PREFIX_MAP: Record<TipeGarasi, string> = {
  SEPEDA: 'S',
  MOBIL: 'C',
  MOBIL_LISTRIK: 'E',
};

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const tipe = searchParams.get('tipe');
  const status = searchParams.get('status');

  let query = supabaseAdmin.from('garasi').select('*').order('kode_garasi', { ascending: true });

  if (tipe) query = query.eq('tipe', tipe);
  if (status) query = query.eq('status', status);

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const garasiList = (data ?? []).map((row) => {
    const domain = Garasi.fromRow(row);
    return {
      ...row,
      harga_harian: Number(row.harga_harian),
      harga_bulanan: domain.getHargaBulanan(),
      harga_listrik_per_kwh: row.harga_listrik_per_kwh ? Number(row.harga_listrik_per_kwh) : null,
    };
  });

  return NextResponse.json({ garasi: garasiList });
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session || session.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Akses ditolak. Khusus Admin.' }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { tipe, jumlah, harga_harian, harga_listrik_per_kwh } = body as {
      tipe: TipeGarasi;
      jumlah: number;
      harga_harian: number;
      harga_listrik_per_kwh?: number | null;
    };

    if (!tipe || !PREFIX_MAP[tipe]) {
      return NextResponse.json({ error: 'Tipe garasi tidak valid.' }, { status: 400 });
    }

    const qty = Number(jumlah);
    if (!Number.isInteger(qty) || qty < 1 || qty > 999) {
      return NextResponse.json(
        { error: 'Jumlah garasi harus berupa bilangan bulat antara 1 sampai 999.' },
        { status: 400 }
      );
    }

    const harga = Number(harga_harian);
    if (!harga || harga <= 0) {
      return NextResponse.json({ error: 'Harga sewa harian harus lebih dari 0.' }, { status: 400 });
    }

    if (tipe === 'MOBIL_LISTRIK' && (!harga_listrik_per_kwh || Number(harga_listrik_per_kwh) <= 0)) {
      return NextResponse.json(
        { error: 'Garasi mobil listrik wajib memiliki harga isi listrik per kWh.' },
        { status: 400 }
      );
    }

    const prefix = PREFIX_MAP[tipe];

    // Cari nomor urut tertinggi untuk tipe garasi ini
    const { data: existingRows, error: fetchError } = await supabaseAdmin
      .from('garasi')
      .select('kode_garasi')
      .eq('tipe', tipe);

    if (fetchError) {
      return NextResponse.json({ error: fetchError.message }, { status: 500 });
    }

    let maxNum = 0;
    const regex = new RegExp(`^${prefix}(\\d+)$`);
    for (const row of existingRows ?? []) {
      const match = String(row.kode_garasi).match(regex);
      if (match) {
        const num = parseInt(match[1], 10);
        if (num > maxNum) maxNum = num;
      }
    }

    if (maxNum + qty > 999) {
      return NextResponse.json(
        {
          error: `Maksimum nomor urut garasi tipe ${tipe} adalah 999. Saat ini sudah sampai ${prefix}${String(
            maxNum
          ).padStart(3, '0')}, sisa slot: ${999 - maxNum}.`,
        },
        { status: 400 }
      );
    }

    // Generate payload berkelompok dengan kode incremental 3 digit
    const rowsToInsert = Array.from({ length: qty }, (_, idx) => {
      const nextNum = maxNum + idx + 1;
      const kodeGarasi = `${prefix}${String(nextNum).padStart(3, '0')}`;
      return {
        kode_garasi: kodeGarasi,
        tipe,
        harga_harian: harga,
        harga_listrik_per_kwh: tipe === 'MOBIL_LISTRIK' ? Number(harga_listrik_per_kwh) : null,
        status: 'AVAILABLE',
      };
    });

    const { data, error } = await supabaseAdmin
      .from('garasi')
      .insert(rowsToInsert)
      .select('*');

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const kodeAwal = rowsToInsert[0].kode_garasi;
    const kodeAkhir = rowsToInsert[rowsToInsert.length - 1].kode_garasi;
    const rangeText = qty === 1 ? kodeAwal : `${kodeAwal} s/d ${kodeAkhir}`;

    return NextResponse.json(
      {
        message: `Berhasil membuat ${qty} unit garasi baru (${rangeText}).`,
        garasi: data,
      },
      { status: 201 }
    );
  } catch {
    return NextResponse.json({ error: 'Gagal menambahkan garasi.' }, { status: 500 });
  }
}