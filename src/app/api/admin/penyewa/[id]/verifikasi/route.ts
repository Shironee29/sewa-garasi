import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import { Admin, Penyewa } from '@/domain/User';
import { StatusKtp } from '@/types/domain';

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session || session.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Akses ditolak. Khusus Admin.' }, { status: 403 });
    }

    const { id } = await params;
    const penyewaId = Number(id);
    const { status_ktp } = (await request.json()) as { status_ktp: StatusKtp };

    if (!['APPROVED', 'REJECTED'].includes(status_ktp)) {
      return NextResponse.json(
        { error: 'Status KTP harus APPROVED atau REJECTED.' },
        { status: 400 }
      );
    }

    const { data: row, error: fetchError } = await supabaseAdmin
      .from('users')
      .select('*')
      .eq('id', penyewaId)
      .eq('role', 'PENYEWA')
      .single();

    if (fetchError || !row) {
      return NextResponse.json({ error: 'Penyewa tidak ditemukan.' }, { status: 404 });
    }

    // Terapkan logika OOP dari Class Diagram
    const adminDomain = new Admin({
      id: session.userId,
      email: session.email,
      passwordHash: '',
    });

    const penyewaDomain = new Penyewa({
      id: row.id,
      email: row.email,
      passwordHash: row.password_hash,
      nik: row.nik ?? '',
      namaLengkap: row.nama_lengkap ?? '',
      noTelp: row.no_telp ?? '',
      statusKtp: row.status_ktp,
    });

    adminDomain.verifikasiKtp(penyewaDomain, status_ktp);

    const { data: updated, error: updateError } = await supabaseAdmin
      .from('users')
      .update({
        status_ktp: penyewaDomain.getStatusKtp(),
        verified_by_admin_id: session.userId,
        updated_at: new Date().toISOString(),
      })
      .eq('id', penyewaId)
      .select('id, email, nik, nama_lengkap, status_ktp, verified_by_admin_id')
      .single();

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    return NextResponse.json({
      message: `Status KTP penyewa berhasil diubah menjadi ${status_ktp}.`,
      penyewa: updated,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Gagal memverifikasi KTP.';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}