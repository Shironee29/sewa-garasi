import { Garasi, GarasiMobilListrik } from '@/domain/Garasi';
import { Kendaraan } from '@/domain/Kendaraan';
import { TransaksiSewa } from '@/domain/TransaksiSewa';
import { RincianBiayaSewa, TipeSewa } from '@/types/domain';

export interface PricingCalculator {
  hitungBiayaSewa(
    garasi: Garasi,
    kendaraan: Kendaraan,
    tglMulai: Date,
    tglSelesai: Date,
    tipeSewa?: TipeSewa
  ): number;

  hitungBiayaPerpanjangan(
    transaksi: TransaksiSewa,
    garasi: Garasi,
    tglBaru: Date
  ): number;
}

export class GaragePricingService implements PricingCalculator {
  /**
   * Memastikan jenis kendaraan cocok dengan tipe garasi yang dipilih.
   */
  public validasiKecocokan(kendaraan: Kendaraan, garasi: Garasi): boolean {
    const tipeKendaraan = kendaraan.getTipe();
    const tipeGarasi = garasi.getTipe();

    if (tipeKendaraan === 'SEPEDA' || tipeKendaraan === 'SEPEDA_MOTOR') {
      return tipeGarasi === 'SEPEDA';
    }
    if (tipeKendaraan === 'MOBIL') {
      return tipeGarasi === 'MOBIL';
    }
    if (tipeKendaraan === 'MOBIL_LISTRIK') {
      return tipeGarasi === 'MOBIL_LISTRIK';
    }
    return false;
  }

  /**
   * Mengembalikan batas maksimal hari untuk sewa HARIAN berdasarkan jumlah hari pada bulan tglMulai.
   * Contoh: bulan 31 hari -> maks 30 hari; bulan 30 hari -> maks 29 hari; Februari 28 hari -> maks 27 hari.
   */
  public getBatasMaksimalHarian(tglMulai: Date): number {
    const jumlahHariBulanIni = new Date(
      tglMulai.getFullYear(),
      tglMulai.getMonth() + 1,
      0
    ).getDate();
    return jumlahHariBulanIni - 1;
  }

  public hitungSelisihHari(tglMulai: Date, tglSelesai: Date): number {
    const msPerHari = 1000 * 60 * 60 * 24;
    const utcMulai = Date.UTC(tglMulai.getFullYear(), tglMulai.getMonth(), tglMulai.getDate());
    const utcSelesai = Date.UTC(tglSelesai.getFullYear(), tglSelesai.getMonth(), tglSelesai.getDate());
    const selisih = Math.floor((utcSelesai - utcMulai) / msPerHari);

    if (selisih <= 0) {
      throw new Error('Tanggal selesai harus lebih besar dari tanggal mulai.');
    }
    return selisih;
  }

  /**
   * Menghitung rincian lengkap (biaya sewa, biaya listrik EV, dan total).
   */
  public hitungRincianSewa(
    garasi: Garasi,
    kendaraan: Kendaraan,
    tglMulai: Date,
    tglSelesai: Date,
    tipeSewa?: TipeSewa
  ): RincianBiayaSewa {
    if (!this.validasiKecocokan(kendaraan, garasi)) {
      throw new Error(
        `Kendaraan tipe ${kendaraan.getTipe()} tidak cocok dengan garasi tipe ${garasi.getTipe()}.`
      );
    }

    const jumlahHari = this.hitungSelisihHari(tglMulai, tglSelesai);
    const batasHarian = this.getBatasMaksimalHarian(tglMulai);

    // Tentukan tipe sewa otomatis jika tidak dikirim secara eksplisit
    const tipeFinal: TipeSewa =
      tipeSewa ?? (jumlahHari > batasHarian ? 'BULANAN' : 'HARIAN');

    if (tipeFinal === 'HARIAN' && jumlahHari > batasHarian) {
      throw new Error(
        `Sewa harian pada bulan ini maksimal ${batasHarian} hari. Gunakan paket BULANAN.`
      );
    }

    let biayaSewa = 0;
    if (tipeFinal === 'HARIAN') {
      biayaSewa = jumlahHari * garasi.getHargaHarian();
    } else {
      const jumlahBulan = Math.max(1, Math.ceil(jumlahHari / 30));
      biayaSewa = jumlahBulan * garasi.getHargaBulanan();
    }

    let biayaListrik = 0;
    if (garasi instanceof GarasiMobilListrik && kendaraan.isMobilListrik()) {
      const kwhDibutuhkan = kendaraan.hitungKebutuhanKwh();
      biayaListrik = garasi.hitungBiayaIsiPenuh(kwhDibutuhkan);
    }

    return {
      tipeSewa: tipeFinal,
      jumlahHari,
      biayaSewa,
      biayaListrik,
      totalBiaya: biayaSewa + biayaListrik,
    };
  }

  public hitungBiayaSewa(
    garasi: Garasi,
    kendaraan: Kendaraan,
    tglMulai: Date,
    tglSelesai: Date,
    tipeSewa?: TipeSewa
  ): number {
    return this.hitungRincianSewa(garasi, kendaraan, tglMulai, tglSelesai, tipeSewa).totalBiaya;
  }

  public hitungBiayaPerpanjangan(
    transaksi: TransaksiSewa,
    garasi: Garasi,
    tglBaru: Date
  ): number {
    const tambahanHari = this.hitungSelisihHari(transaksi.getTglSelesai(), tglBaru);
    return tambahanHari * garasi.getHargaHarian();
  }
}