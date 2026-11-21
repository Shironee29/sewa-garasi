import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { Admin, Penyewa, User } from '@/domain/User';
import { createSession } from '@/lib/auth';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email, password } = body;

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email dan password wajib diisi.' },
        { status: 400 }
      );
    }

    const cleanEmail = String(email).trim().toLowerCase();

    const { data: row, error } = await supabaseAdmin
      .from('users')
      .select('*')
      .eq('email', cleanEmail)
      .single();

    if (error || !row) {
      return NextResponse.json(
        { error: 'Email atau password salah.' },
        { status: 401 }
      );
    }

    // Instansiasi Domain Class OOP sesuai role
    let domainUser: User;
    if (row.role === 'ADMIN') {
      domainUser = new Admin({
        id: row.id,
        email: row.email,
        passwordHash: row.password_hash,
      });
    } else {
      domainUser = new Penyewa({
        id: row.id,
        email: row.email,
        passwordHash: row.password_hash,
        nik: row.nik ?? '',
        namaLengkap: row.nama_lengkap ?? '',
        noTelp: row.no_telp ?? '',
        statusKtp: row.status_ktp,
      });
    }

    const isValid = await domainUser.login(cleanEmail, password);
    if (!isValid) {
      return NextResponse.json(
        { error: 'Email atau password salah.' },
        { status: 401 }
      );
    }

    await createSession({
      userId: row.id,
      email: row.email,
      role: row.role,
      namaLengkap: row.nama_lengkap,
      statusKtp: row.status_ktp,
    });

    return NextResponse.json({
      message: 'Login berhasil.',
      user: {
        id: row.id,
        email: row.email,
        role: row.role,
        nama_lengkap: row.nama_lengkap,
        status_ktp: row.status_ktp,
      },
    });
  } catch (err) {
    console.error('Login error:', err);
    return NextResponse.json(
      { error: 'Terjadi kesalahan saat login.' },
      { status: 500 }
    );
  }
}