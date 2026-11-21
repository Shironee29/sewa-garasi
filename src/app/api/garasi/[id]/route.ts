import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session || session.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Akses ditolak. Khusus Admin.' }, { status: 403 });
  }

  const { id } = await params;
  const body = await request.json();

  const updatePayload: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  if (body.kode_garasi) updatePayload.kode_garasi = String(body.kode_garasi).trim().toUpperCase();
  if (body.tipe) updatePayload.tipe = body.tipe;
  if (body.harga_harian !== undefined) updatePayload.harga_harian = Number(body.harga_harian);
  if (body.status) updatePayload.status = body.status;
  if (body.tipe === 'MOBIL_LISTRIK') {
    updatePayload.harga_listrik_per_kwh = Number(body.harga_listrik_per_kwh ?? 0);
  } else if (body.tipe) {
    updatePayload.harga_listrik_per_kwh = null;
  }

  const { data, error } = await supabaseAdmin
    .from('garasi')
    .update(updatePayload)
    .eq('id', Number(id))
    .select('*')
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ message: 'Data garasi diperbarui.', garasi: data });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session || session.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Akses ditolak. Khusus Admin.' }, { status: 403 });
  }

  const { id } = await params;
  const { error } = await supabaseAdmin.from('garasi').delete().eq('id', Number(id));

  if (error) {
    if (error.code === '23503') {
      return NextResponse.json(
        { error: 'Garasi tidak dapat dihapus karena memiliki riwayat transaksi sewa.' },
        { status: 409 }
      );
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ message: 'Garasi berhasil dihapus.' });
}