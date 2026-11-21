import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Silakan login terlebih dahulu.' }, { status: 401 });
  }

  const { id } = await params;

  let query = supabaseAdmin.from('kendaraan').delete().eq('id', Number(id));
  if (session.role === 'PENYEWA') {
    query = query.eq('penyewa_id', session.userId);
  }

  const { error } = await query;
  if (error) {
    if (error.code === '23503') {
      return NextResponse.json(
        { error: 'Kendaraan tidak dapat dihapus karena sedang/pernah dipakai menyewa garasi.' },
        { status: 409 }
      );
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ message: 'Kendaraan berhasil dihapus.' });
}