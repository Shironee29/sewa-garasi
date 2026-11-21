import { StatusGarasi, TipeGarasi } from '@/types/domain';

export class Garasi {
  public readonly id?: number;
  protected kodeGarasi: string;
  protected tipe: TipeGarasi;
  protected hargaHarian: number;
  protected status: StatusGarasi;

  constructor(params: {
    id?: number;
    kodeGarasi: string;
    tipe: TipeGarasi;
    hargaHarian: number;
    status?: StatusGarasi;
  }) {
    this.id = params.id;
    this.kodeGarasi = params.kodeGarasi;
    this.tipe = params.tipe;
    this.hargaHarian = params.hargaHarian;
    this.status = params.status ?? 'AVAILABLE';
  }

  public getKodeGarasi(): string {
    return this.kodeGarasi;
  }

  public getTipe(): TipeGarasi {
    return this.tipe;
  }

  public getHargaHarian(): number {
    return this.hargaHarian;
  }

  public getStatus(): StatusGarasi {
    return this.status;
  }

  /**
   * Harga sewa bulanan (asumsi 30 hari dengan potongan 10%, ubah pengali jika soal menentukan tarif khusus).
   */
  public getHargaBulanan(): number {
    return this.hargaHarian * 25;
  }

  public ubahStatus(status: StatusGarasi): void {
    this.status = status;
  }

  public isAvailable(): boolean {
    return this.status === 'AVAILABLE';
  }

  // Helper untuk mengubah data mentah dari Supabase menjadi instance OOP yang sesuai
  public static fromRow(row: {
    id: number;
    kode_garasi: string;
    tipe: TipeGarasi;
    harga_harian: number;
    harga_listrik_per_kwh?: number | null;
    status: StatusGarasi;
  }): Garasi {
    if (row.tipe === 'MOBIL_LISTRIK') {
      return new GarasiMobilListrik({
        id: row.id,
        kodeGarasi: row.kode_garasi,
        hargaHarian: Number(row.harga_harian),
        hargaListrikPerKwh: Number(row.harga_listrik_per_kwh ?? 0),
        status: row.status,
      });
    }
    return new Garasi({
      id: row.id,
      kodeGarasi: row.kode_garasi,
      tipe: row.tipe,
      hargaHarian: Number(row.harga_harian),
      status: row.status,
    });
  }
}

export class GarasiMobilListrik extends Garasi {
  private hargaListrikPerKwh: number;

  constructor(params: {
    id?: number;
    kodeGarasi: string;
    hargaHarian: number;
    hargaListrikPerKwh: number;
    status?: StatusGarasi;
  }) {
    super({
      id: params.id,
      kodeGarasi: params.kodeGarasi,
      tipe: 'MOBIL_LISTRIK',
      hargaHarian: params.hargaHarian,
      status: params.status,
    });
    this.hargaListrikPerKwh = params.hargaListrikPerKwh;
  }

  public getHargaListrikPerKwh(): number {
    return this.hargaListrikPerKwh;
  }

  public hitungBiayaIsiPenuh(kwhDibutuhkan: number): number {
    if (kwhDibutuhkan <= 0) return 0;
    return Math.round(kwhDibutuhkan * this.hargaListrikPerKwh);
  }
}