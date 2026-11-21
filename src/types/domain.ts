export type RoleUser = 'ADMIN' | 'PENYEWA';
export type StatusKtp = 'PENDING' | 'APPROVED' | 'REJECTED';
export type TipeGarasi = 'SEPEDA' | 'MOBIL' | 'MOBIL_LISTRIK';
export type StatusGarasi = 'AVAILABLE' | 'USED';
export type TipeKendaraan = 'SEPEDA' | 'SEPEDA_MOTOR' | 'MOBIL' | 'MOBIL_LISTRIK';
export type TipeSewa = 'HARIAN' | 'BULANAN';
export type StatusSewa = 'ACTIVE' | 'COMPLETED';

export interface RincianBiayaSewa {
  tipeSewa: TipeSewa;
  jumlahHari: number;
  biayaSewa: number;
  biayaListrik: number;
  totalBiaya: number;
}