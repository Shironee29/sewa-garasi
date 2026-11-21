import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { supabaseAdmin } from '@/lib/supabase';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email, password, nik, nama_lengkap, no_telp } = body;

    if (!email || !password || !nik || !nama_lengkap || !no_telp) {
      return NextResponse.json(
        { error: 'Semua field wajib diisi.' },
        { status: 400 }
      );
    }

    if (!/^\d{16}$/.test(String(nik))) {
      return NextResponse.json(
        { error: 'NIK harus terdiri dari tepat 16 digit angka.' },
        { status: 400 }
      );
    }

    if (String(password).length < 6) {
      return NextResponse.json(
        { error: 'Password minimal 6 karakter.' },
        { status: 400 }
      );
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const { data, error } = await supabaseAdmin
      .from('users')
      .insert({
        email: String(email).trim().toLowerCase(),
        password_hash: passwordHash,
        role: 'PENYEWA',
        nik: String(nik).trim(),
        nama_lengkap: String(nama_lengkap).trim(),
        no_telp: String(no_telp).trim(),
        status_ktp: 'PENDING',
      })
      .select('id, email, role, nik, nama_lengkap, no_telp, status_ktp')
      .single();

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json(
          { error: 'Email atau NIK sudah terdaftar.' },
          { status: 409 }
        );
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(
      {
        message: 'Registrasi berhasil. Menunggu verifikasi KTP oleh Admin.',
        user: data,
      },
      { status: 201 }
    );
  } catch (err) {
    console.error('Register error:', err);
    return NextResponse.json(
      { error: 'Terjadi kesalahan saat registrasi.' },
      { status: 500 }
    );
  }
}