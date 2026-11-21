import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';

function normalizePlatNomor(input: string): string {
  // Hapus semua spasi & ubah ke huruf kapital
  const compact = input.replace(/\s+/g, '').toUpperCase();

  // Format otomatis pola plat Indonesia (contoh: L1234AB -> L 1234 AB)
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

  let query = supabaseAdmin.from('kendaraan').select('*').order('created_at', { ascending: false });

  if (session.role === 'PENYEWA') {
    query = query.eq('penyewa_id', session.userId);
  }

  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ kendaraan: data });
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session || session.role !== 'PENYEWA') {
    return NextResponse.json({ error: 'Hanya penyewa yang dapat mendaftarkan kendaraan.' }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { tipe, no_plat, merek_tipe, kapasitas_max_kwh, baterai_terakhir_kwh } = body;

    if (!tipe || !merek_tipe) {
      return NextResponse.json(
        { error: 'Tipe kendaraan dan merek/tipe wajib diisi.' },
        { status: 400 }
      );
    }

    let formattedPlat: string | null = null;

    if (tipe !== 'SEPEDA') {
      if (!no_plat || !String(no_plat).trim()) {
        return NextResponse.json(
          { error: 'Nomor plat wajib diisi untuk kendaraan bermotor.' },
          { status: 400 }
        );
      }

      formattedPlat = normalizePlatNomor(String(no_plat));

      // Cek apakah nomor plat sudah terdaftar (bandingkan tanpa spasi)
      const compactBaru = formattedPlat.replace(/\s+/g, '');
      const { data: existingList, error: checkError } = await supabaseAdmin
        .from('kendaraan')
        .select('id, no_plat')
        .not('no_plat', 'is', null);

      if (checkError) {
        return NextResponse.json({ error: checkError.message }, { status: 500 });
      }

      const isDuplicate = (existingList ?? []).some(
        (item) => item.no_plat?.replace(/\s+/g, '').toUpperCase() === compactBaru
      );

      if (isDuplicate) {
        return NextResponse.json(
          { error: `Nomor plat ${formattedPlat} sudah terdaftar.` },
          { status: 409 }
        );
      }
    }

    if (tipe === 'MOBIL_LISTRIK') {
      const maxKwh = Number(kapasitas_max_kwh);
      const lastKwh = Number(baterai_terakhir_kwh);
      if (!maxKwh || maxKwh <= 0 || isNaN(lastKwh) || lastKwh < 0 || lastKwh > maxKwh) {
        return NextResponse.json(
          { error: 'Kapasitas baterai maks dan sisa baterai terakhir (kWh) harus valid.' },
          { status: 400 }
        );
      }
    }

    const { data, error } = await supabaseAdmin
      .from('kendaraan')
      .insert({
        penyewa_id: session.userId,
        tipe,
        no_plat: formattedPlat,
        merek_tipe: String(merek_tipe).trim(),
        kapasitas_max_kwh: tipe === 'MOBIL_LISTRIK' ? Number(kapasitas_max_kwh) : null,
        baterai_terakhir_kwh: tipe === 'MOBIL_LISTRIK' ? Number(baterai_terakhir_kwh) : null,
      })
      .select('*')
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(
      { message: 'Kendaraan berhasil didaftarkan.', kendaraan: data },
      { status: 201 }
    );
  } catch {
    return NextResponse.json({ error: 'Gagal mendaftarkan kendaraan.' }, { status: 500 });
  }
}