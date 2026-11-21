import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';

export async function PATCH(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session || session.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Akses ditolak. Khusus Admin.' }, { status: 403 });
  }

  const { id } = await params;
  const transaksiId = Number(id);

  const { data: trx, error: fetchError } = await supabaseAdmin
    .from('transaksi_sewa')
    .select('*')
    .eq('id', transaksiId)
    .single();

  if (fetchError || !trx) {
    return NextResponse.json({ error: 'Transaksi tidak ditemukan.' }, { status: 404 });
  }

  if (trx.status === 'COMPLETED') {
    return NextResponse.json({ error: 'Transaksi ini sudah berstatus COMPLETED.' }, { status: 400 });
  }

  const now = new Date().toISOString();

  const { error: updateTrxError } = await supabaseAdmin
    .from('transaksi_sewa')
    .update({ status: 'COMPLETED', updated_at: now })
    .eq('id', transaksiId);

  if (updateTrxError) {
    return NextResponse.json({ error: updateTrxError.message }, { status: 500 });
  }

  // Kembalikan status garasi menjadi AVAILABLE
  await supabaseAdmin
    .from('garasi')
    .update({ status: 'AVAILABLE', updated_at: now })
    .eq('id', trx.garasi_id);

  return NextResponse.json({
    message: 'Transaksi diselesaikan. Status garasi kini AVAILABLE kembali.',
  });
}