import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ user: null }, { status: 401 });
  }

  const { data: user, error } = await supabaseAdmin
    .from('users')
    .select('id, email, role, nik, nama_lengkap, no_telp, status_ktp')
    .eq('id', session.userId)
    .single();

  if (error || !user) {
    return NextResponse.json({ user: null }, { status: 401 });
  }

  return NextResponse.json({ user });
}