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
   * Aturan kecocokan sesuai soal:
   * - SEPEDA / SEPEDA_MOTOR -> hanya garasi SEPEDA
   * - MOBIL -> hanya garasi MOBIL
   * - MOBIL_LISTRIK -> boleh garasi MOBIL atau MOBIL_LISTRIK
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
      return tipeGarasi === 'MOBIL' || tipeGarasi === 'MOBIL_LISTRIK';
    }
    return false;
  }

  public getJumlahHariBulan(tglMulai: Date): number {
    return new Date(tglMulai.getFullYear(), tglMulai.getMonth() + 1, 0).getDate();
  }

  /**
   * Maksimal sewa harian = min(30, jumlah hari bulan ini - 1).
   * Contoh: Nov (30 hari) -> maks 29; Feb non-kabisat (28 hari) -> maks 27; Des (31 hari) -> maks 30.
   */
  public getBatasMaksimalHarian(tglMulai: Date): number {
    return Math.min(30, this.getJumlahHariBulan(tglMulai) - 1);
  }

  public hitungTanggalSelesaiHarian(tglMulai: Date, jumlahHari: number): Date {
    return new Date(
      tglMulai.getFullYear(),
      tglMulai.getMonth(),
      tglMulai.getDate() + jumlahHari
    );
  }

  public hitungTanggalSelesaiBulanan(tglMulai: Date): Date {
    const durasiBulanIni = this.getJumlahHariBulan(tglMulai);
    return new Date(
      tglMulai.getFullYear(),
      tglMulai.getMonth(),
      tglMulai.getDate() + durasiBulanIni
    );
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
    const durasiSatuBulan = this.getJumlahHariBulan(tglMulai);
    const batasHarian = this.getBatasMaksimalHarian(tglMulai);

    const tipeFinal: TipeSewa =
      tipeSewa ?? (jumlahHari >= durasiSatuBulan ? 'BULANAN' : 'HARIAN');

    if (tipeFinal === 'HARIAN' && jumlahHari > batasHarian) {
      throw new Error(
        `Sewa harian pada bulan ini maksimal ${batasHarian} hari. Gunakan paket BULANAN.`
      );
    }

    if (tipeFinal === 'BULANAN' && jumlahHari < durasiSatuBulan) {
      throw new Error(
        `Sewa bulanan pada bulan ini minimal ${durasiSatuBulan} hari.`
      );
    }

    let biayaSewa = 0;
    if (tipeFinal === 'HARIAN') {
      biayaSewa = jumlahHari * garasi.getHargaHarian();
    } else {
      const jumlahBulanPenuh = Math.floor(jumlahHari / durasiSatuBulan);
      const sisaHari = jumlahHari % durasiSatuBulan;
      biayaSewa =
        jumlahBulanPenuh * garasi.getHargaBulanan() +
        sisaHari * garasi.getHargaHarian();
    }

    // Biaya listrik hanya berlaku jika mobil listrik masuk ke garasi MOBIL_LISTRIK
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
    const tglLama = transaksi.getTglSelesai();
    const tambahanHari = this.hitungSelisihHari(tglLama, tglBaru);
    const durasiSatuBulan = this.getJumlahHariBulan(tglLama);

    if (tambahanHari >= durasiSatuBulan) {
      const jumlahBulanPenuh = Math.floor(tambahanHari / durasiSatuBulan);
      const sisaHari = tambahanHari % durasiSatuBulan;
      return (
        jumlahBulanPenuh * garasi.getHargaBulanan() +
        sisaHari * garasi.getHargaHarian()
      );
    }

    return tambahanHari * garasi.getHargaHarian();
  }
}