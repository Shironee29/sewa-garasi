import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';

export async function GET() {
  const session = await getSession();
  if (!session || session.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Akses ditolak. Khusus Admin.' }, { status: 403 });
  }

  const { data, error } = await supabaseAdmin
    .from('users')
    .select('id, email, nik, nama_lengkap, no_telp, status_ktp, verified_by_admin_id, created_at')
    .eq('role', 'PENYEWA')
    .order('created_at', { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ penyewa: data });
}