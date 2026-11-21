import { supabaseAdmin } from '@/lib/supabase';

export async function uploadBuktiBayar(file: File, prefix: string): Promise<string> {
  const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
  if (!allowedTypes.includes(file.type)) {
    throw new Error('Format file harus JPG, PNG, atau WEBP.');
  }

  if (file.size > 5 * 1024 * 1024) {
    throw new Error('Ukuran file maksimal 5MB.');
  }

  const ext = file.name.split('.').pop() || 'jpg';
  const fileName = `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  const { error } = await supabaseAdmin.storage
    .from('bukti-bayar')
    .upload(fileName, buffer, {
      contentType: file.type,
      upsert: false,
    });

  if (error) {
    throw new Error(`Gagal mengunggah bukti bayar: ${error.message}`);
  }

  const { data } = supabaseAdmin.storage.from('bukti-bayar').getPublicUrl(fileName);
  return data.publicUrl;
}