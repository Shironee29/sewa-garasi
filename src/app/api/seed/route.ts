import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { supabaseAdmin } from '@/lib/supabase';

export async function GET() {
  try {
    // 1. Seed Akun Admin Default
    const adminPasswordHash = await bcrypt.hash('admin123', 10);

    const { error: adminError } = await supabaseAdmin.from('users').upsert(
      {
        email: 'admin@sewagarasi.com',
        password_hash: adminPasswordHash,
        role: 'ADMIN',
        nama_lengkap: 'Administrator Utama',
        no_telp: '081234567890',
        status_ktp: 'APPROVED',
      },
      { onConflict: 'email' }
    );

    if (adminError) {
      return NextResponse.json({ error: adminError.message }, { status: 500 });
    }

    // 2. Seed Contoh Unit Garasi (Sepeda, Mobil, Mobil Listrik)
    const sampleGarasi = [
      {
        kode_garasi: 'S001',
        tipe: 'SEPEDA',
        harga_harian: 15000,
        harga_listrik_per_kwh: null,
        status: 'AVAILABLE',
      },
      {
        kode_garasi: 'S002',
        tipe: 'SEPEDA',
        harga_harian: 15000,
        harga_listrik_per_kwh: null,
        status: 'AVAILABLE',
      },
      {
        kode_garasi: 'C001',
        tipe: 'MOBIL',
        harga_harian: 50000,
        harga_listrik_per_kwh: null,
        status: 'AVAILABLE',
      },
      {
        kode_garasi: 'C002',
        tipe: 'MOBIL',
        harga_harian: 50000,
        harga_listrik_per_kwh: null,
        status: 'AVAILABLE',
      },
      {
        kode_garasi: 'E001',
        tipe: 'MOBIL_LISTRIK',
        harga_harian: 75000,
        harga_listrik_per_kwh: 2500,
        status: 'AVAILABLE',
      },
      {
        kode_garasi: 'E002',
        tipe: 'MOBIL_LISTRIK',
        harga_harian: 75000,
        harga_listrik_per_kwh: 2500,
        status: 'AVAILABLE',
      },
    ];

    const { error: garasiError } = await supabaseAdmin
      .from('garasi')
      .upsert(sampleGarasi, { onConflict: 'kode_garasi' });

    if (garasiError) {
      return NextResponse.json({ error: garasiError.message }, { status: 500 });
    }

    return NextResponse.json({
      message: 'Seed berhasil! Akun admin dan 6 unit garasi siap digunakan.',
      admin: {
        email: 'admin@sewagarasi.com',
        password: 'admin123',
      },
    });
  } catch (err) {
    console.error('Seed error:', err);
    return NextResponse.json({ error: 'Gagal menjalankan seed.' }, { status: 500 });
  }
}