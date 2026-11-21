import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import { Garasi } from '@/domain/Garasi';

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

  // Sertakan harga_bulanan hasil kalkulasi OOP (25 * harga_harian)
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
    const { kode_garasi, tipe, harga_harian, harga_listrik_per_kwh } = body;

    if (!kode_garasi || !tipe || !harga_harian) {
      return NextResponse.json(
        { error: 'Kode garasi, tipe, dan harga harian wajib diisi.' },
        { status: 400 }
      );
    }

    if (tipe === 'MOBIL_LISTRIK' && (!harga_listrik_per_kwh || Number(harga_listrik_per_kwh) <= 0)) {
      return NextResponse.json(
        { error: 'Garasi mobil listrik wajib memiliki harga listrik per kWh.' },
        { status: 400 }
      );
    }

    const { data, error } = await supabaseAdmin
      .from('garasi')
      .insert({
        kode_garasi: String(kode_garasi).trim().toUpperCase(),
        tipe,
        harga_harian: Number(harga_harian),
        harga_listrik_per_kwh: tipe === 'MOBIL_LISTRIK' ? Number(harga_listrik_per_kwh) : null,
        status: 'AVAILABLE',
      })
      .select('*')
      .single();

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json({ error: 'Kode garasi sudah terdaftar.' }, { status: 409 });
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ message: 'Garasi berhasil ditambahkan.', garasi: data }, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Gagal menambahkan garasi.' }, { status: 500 });
  }
}