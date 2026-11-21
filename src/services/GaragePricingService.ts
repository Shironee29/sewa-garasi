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
   * Mengembalikan jumlah hari pada bulan tglMulai (otomatis mendeteksi tahun kabisat).
   * Contoh: Feb 2026 -> 28, Feb 2028 -> 29, Nov 2026 -> 30, Des 2026 -> 31.
   */
  public getJumlahHariBulan(tglMulai: Date): number {
    return new Date(tglMulai.getFullYear(), tglMulai.getMonth() + 1, 0).getDate();
  }

  /**
   * Batas maksimal sewa HARIAN = (jumlah hari bulan tglMulai) - 1.
   * Contoh: Nov (30 hari) -> maks 29 hari; Feb non-kabisat (28 hari) -> maks 27 hari.
   */
  public getBatasMaksimalHarian(tglMulai: Date): number {
    return this.getJumlahHariBulan(tglMulai) - 1;
  }

  /**
   * Helper untuk form UI: menghitung tglSelesai otomatis jika penyewa memilih paket 1 BULAN.
   * Contoh: 21 Nov 2026 (+30 hari) -> 21 Des 2026; 2 Feb 2026 (+28 hari) -> 2 Mar 2026.
   */
  public hitungTanggalSelesaiBulanan(tglMulai: Date): Date {
    const durasiBulanIni = this.getJumlahHariBulan(tglMulai);
    const tglSelesai = new Date(
      tglMulai.getFullYear(),
      tglMulai.getMonth(),
      tglMulai.getDate() + durasiBulanIni
    );
    return tglSelesai;
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
   * Menghitung rincian lengkap (tipe sewa, durasi hari, biaya sewa, biaya listrik EV, dan total).
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
    const durasiSatuBulan = this.getJumlahHariBulan(tglMulai);
    const batasHarian = this.getBatasMaksimalHarian(tglMulai);

    // Jika jumlah hari >= jumlah hari di bulan tglMulai, otomatis masuk paket BULANAN
    const tipeFinal: TipeSewa =
      tipeSewa ?? (jumlahHari >= durasiSatuBulan ? 'BULANAN' : 'HARIAN');

    if (tipeFinal === 'HARIAN' && jumlahHari > batasHarian) {
      throw new Error(
        `Sewa harian pada bulan ini maksimal ${batasHarian} hari. Jika ${durasiSatuBulan} hari atau lebih, gunakan paket BULANAN.`
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
      // Hitung blok bulan penuh (kelipatan durasiSatuBulan) + sisa hari jika ada
      const jumlahBulanPenuh = Math.floor(jumlahHari / durasiSatuBulan);
      const sisaHari = jumlahHari % durasiSatuBulan;
      biayaSewa =
        jumlahBulanPenuh * garasi.getHargaBulanan() +
        sisaHari * garasi.getHargaHarian();
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

  /**
   * Menghitung sisa biaya perpanjangan oleh Admin.
   * Jika tambahan hari mencapai 1 bulan penuh pada bulan tglSelesai lama, berlaku tarif bulanan.
   */
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