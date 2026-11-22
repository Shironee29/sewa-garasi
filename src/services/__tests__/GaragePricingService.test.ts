import { describe, it, expect } from 'vitest';
import { Garasi } from '@/domain/Garasi';
import { Kendaraan } from '@/domain/Kendaraan';
import { TransaksiSewa } from '@/domain/TransaksiSewa';
import { GaragePricingService } from '@/services/GaragePricingService';

const pricingService = new GaragePricingService();

// Helper data dummy garasi
const garasiSepeda = Garasi.fromRow({
  id: 1,
  kode_garasi: 'S001',
  tipe: 'SEPEDA',
  harga_harian: 10000,
  harga_listrik_per_kwh: null,
  status: 'AVAILABLE',
});

const garasiMobil = Garasi.fromRow({
  id: 2,
  kode_garasi: 'C001',
  tipe: 'MOBIL',
  harga_harian: 50000,
  harga_listrik_per_kwh: null,
  status: 'AVAILABLE',
});

const garasiEV = Garasi.fromRow({
  id: 3,
  kode_garasi: 'E001',
  tipe: 'MOBIL_LISTRIK',
  harga_harian: 80000,
  harga_listrik_per_kwh: 2500,
  status: 'AVAILABLE',
});

describe('Unit Testing Sistem Sewa Garasi', () => {
  it('UT-01: Menghitung tarif sewa bulanan otomatis (25 x harga harian)', () => {
    expect(garasiSepeda.getHargaBulanan()).toBe(250000);
    expect(garasiMobil.getHargaBulanan()).toBe(1250000);
    expect(garasiEV.getHargaBulanan()).toBe(2000000);
  });

  it('UT-02: Menerima kombinasi kendaraan dan garasi yang sesuai aturan bisnis', () => {
    const motor = new Kendaraan({ penyewaId: 1, tipe: 'SEPEDA_MOTOR', merekTipe: 'Honda Vario', noPlat: 'L 1234 AB' });
    const ev = new Kendaraan({ penyewaId: 1, tipe: 'MOBIL_LISTRIK', merekTipe: 'Ioniq 5', noPlat: 'L 5678 EV', kapasitasMaxKwh: 60, bateraiTerakhirKwh: 0 });

    expect(pricingService.validasiKecocokan(motor, garasiSepeda)).toBe(true);
    expect(pricingService.validasiKecocokan(ev, garasiMobil)).toBe(true);
    expect(pricingService.validasiKecocokan(ev, garasiEV)).toBe(true);
  });

  it('UT-03: Menolak kombinasi kendaraan dan garasi yang tidak sesuai', () => {
    const mobil = new Kendaraan({ penyewaId: 1, tipe: 'MOBIL', merekTipe: 'Avanza', noPlat: 'L 9999 AA' });
    const sepeda = new Kendaraan({ penyewaId: 1, tipe: 'SEPEDA', merekTipe: 'Polygon' });

    expect(pricingService.validasiKecocokan(mobil, garasiSepeda)).toBe(false);
    expect(pricingService.validasiKecocokan(mobil, garasiEV)).toBe(false);
    expect(pricingService.validasiKecocokan(sepeda, garasiMobil)).toBe(false);
  });

  it('UT-04: Menghitung biaya sewa harian normal (non-EV)', () => {
    const mobil = new Kendaraan({ penyewaId: 1, tipe: 'MOBIL', merekTipe: 'Avanza', noPlat: 'L 9999 AA' });
    const mulai = new Date(2026, 10, 1); // 1 Nov 2026
    const selesai = new Date(2026, 10, 6); // 6 Nov 2026 (5 hari)

    const hasil = pricingService.hitungRincianSewa(garasiMobil, mobil, mulai, selesai, 'HARIAN');

    expect(hasil.jumlahHari).toBe(5);
    expect(hasil.biayaSewa).toBe(250000);
    expect(hasil.biayaListrik).toBe(0);
    expect(hasil.totalBiaya).toBe(250000);
  });

  it('UT-05: Menolak sewa harian yang melebihi batas maksimal bulan berjalan', () => {
    const mobil = new Kendaraan({ penyewaId: 1, tipe: 'MOBIL', merekTipe: 'Avanza', noPlat: 'L 9999 AA' });
    const mulai = new Date(2026, 10, 1); // Nov (30 hari -> maks harian 29 hari)
    const selesai = new Date(2026, 11, 1); // 30 hari

    expect(() =>
      pricingService.hitungRincianSewa(garasiMobil, mobil, mulai, selesai, 'HARIAN')
    ).toThrow();
  });

  it('UT-06: Menghitung biaya sewa bulanan 1 bulan penuh (tarif 25x)', () => {
    const motor = new Kendaraan({ penyewaId: 1, tipe: 'SEPEDA_MOTOR', merekTipe: 'Vario', noPlat: 'L 1111 BB' });
    const mulai = new Date(2026, 10, 22); // 22 Nov 2026
    const selesai = pricingService.hitungTanggalSelesaiBulanan(mulai); // 22 Des 2026 (30 hari)

    const hasil = pricingService.hitungRincianSewa(garasiSepeda, motor, mulai, selesai, 'BULANAN');

    expect(hasil.tipeSewa).toBe('BULANAN');
    expect(hasil.biayaSewa).toBe(250000);
    expect(hasil.totalBiaya).toBe(250000);
  });

  it('UT-07: Mobil listrik di garasi EV (isi penuh dari 0% baterai)', () => {
    const ev = new Kendaraan({
      penyewaId: 1,
      tipe: 'MOBIL_LISTRIK',
      merekTipe: 'Hyundai Ioniq 5',
      noPlat: 'L 8888 EV',
      kapasitasMaxKwh: 60,
      bateraiTerakhirKwh: 0,
    });
    const mulai = new Date(2026, 10, 1);
    const selesai = new Date(2026, 10, 3); // 2 hari

    const hasil = pricingService.hitungRincianSewa(garasiEV, ev, mulai, selesai, 'HARIAN');

    expect(hasil.biayaSewa).toBe(160000); // 2 x 80.000
    expect(hasil.biayaListrik).toBe(150000); // 60 kWh x 2.500
    expect(hasil.totalBiaya).toBe(310000);
  });

  it('UT-08: Mobil listrik di garasi EV (sisa baterai 40% / 24 kWh)', () => {
    const ev = new Kendaraan({
      penyewaId: 1,
      tipe: 'MOBIL_LISTRIK',
      merekTipe: 'Hyundai Ioniq 5',
      noPlat: 'L 8888 EV',
      kapasitasMaxKwh: 60,
      bateraiTerakhirKwh: 24,
    });
    const mulai = new Date(2026, 10, 1);
    const selesai = new Date(2026, 10, 2); // 1 hari

    const hasil = pricingService.hitungRincianSewa(garasiEV, ev, mulai, selesai, 'HARIAN');

    expect(hasil.biayaListrik).toBe(90000); // (60 - 24) x 2.500
    expect(hasil.totalBiaya).toBe(170000); // 80.000 + 90.000
  });

  it('UT-09: Mobil listrik di garasi mobil bensin tidak dikenakan biaya listrik', () => {
    const ev = new Kendaraan({
      penyewaId: 1,
      tipe: 'MOBIL_LISTRIK',
      merekTipe: 'Wuling Air EV',
      noPlat: 'L 7777 EV',
      kapasitasMaxKwh: 26,
      bateraiTerakhirKwh: 0,
    });
    const mulai = new Date(2026, 10, 1);
    const selesai = new Date(2026, 10, 4); // 3 hari

    const hasil = pricingService.hitungRincianSewa(garasiMobil, ev, mulai, selesai, 'HARIAN');

    expect(hasil.biayaSewa).toBe(150000);
    expect(hasil.biayaListrik).toBe(0);
    expect(hasil.totalBiaya).toBe(150000);
  });

  it('UT-10: Menghitung biaya perpanjangan harian dan bulanan', () => {
    const mockTransaksi = {
      getTglSelesai: () => new Date(2026, 10, 10), // 10 Nov 2026
    } as unknown as TransaksiSewa;

    // Tambah 5 hari -> 15 Nov 2026
    const biaya5Hari = pricingService.hitungBiayaPerpanjangan(
      mockTransaksi,
      garasiMobil,
      new Date(2026, 10, 15)
    );
    expect(biaya5Hari).toBe(250000);

    // Tambah 30 hari penuh (Nov = 30 hari) -> otomatis tarif bulanan 25x
    const biaya1Bulan = pricingService.hitungBiayaPerpanjangan(
      mockTransaksi,
      garasiMobil,
      new Date(2026, 11, 10)
    );
    expect(biaya1Bulan).toBe(1250000);
  });
});