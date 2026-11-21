import { StatusSewa, TipeSewa } from '@/types/domain';

export class TransaksiSewa {
  public readonly id?: number;
  public readonly penyewaId: number;
  public readonly garasiId: number;
  public readonly kendaraanId: number;
  private tipeSewa: TipeSewa;
  private jumlahHari: number;
  private tglMulai: Date;
  private tglSelesai: Date;
  private biayaSewa: number;
  private biayaListrik: number;
  private totalBiaya: number;
  private buktiPelunasan: string;
  private status: StatusSewa;

  constructor(params: {
    id?: number;
    penyewaId: number;
    garasiId: number;
    kendaraanId: number;
    tipeSewa: TipeSewa;
    jumlahHari: number;
    tglMulai: Date;
    tglSelesai: Date;
    biayaSewa: number;
    biayaListrik: number;
    totalBiaya: number;
    buktiPelunasan: string;
    status?: StatusSewa;
  }) {
    this.id = params.id;
    this.penyewaId = params.penyewaId;
    this.garasiId = params.garasiId;
    this.kendaraanId = params.kendaraanId;
    this.tipeSewa = params.tipeSewa;
    this.jumlahHari = params.jumlahHari;
    this.tglMulai = params.tglMulai;
    this.tglSelesai = params.tglSelesai;
    this.biayaSewa = params.biayaSewa;
    this.biayaListrik = params.biayaListrik;
    this.totalBiaya = params.totalBiaya;
    this.buktiPelunasan = params.buktiPelunasan;
    this.status = params.status ?? 'ACTIVE';
  }

  public getTipeSewa(): TipeSewa {
    return this.tipeSewa;
  }

  public getTglMulai(): Date {
    return this.tglMulai;
  }

  public getTglSelesai(): Date {
    return this.tglSelesai;
  }

  public getTotalBiaya(): number {
    return this.totalBiaya;
  }

  public isAktifHariIni(hariIni: Date = new Date()): boolean {
    if (this.status !== 'ACTIVE') return false;
    const now = new Date(hariIni.getFullYear(), hariIni.getMonth(), hariIni.getDate());
    const mulai = new Date(this.tglMulai.getFullYear(), this.tglMulai.getMonth(), this.tglMulai.getDate());
    const selesai = new Date(this.tglSelesai.getFullYear(), this.tglSelesai.getMonth(), this.tglSelesai.getDate());
    return now >= mulai && now <= selesai;
  }
}

export class PerpanjanganSewa {
  public readonly id?: number;
  public readonly transaksiSewaId: number;
  public readonly diprosesAdminId: number;
  public readonly tglSelesaiLama: Date;
  public readonly tglSelesaiBaru: Date;
  public readonly tambahanHari: number;
  public readonly sisaBiaya: number;
  public readonly buktiBayar: string;

  constructor(params: {
    id?: number;
    transaksiSewaId: number;
    diprosesAdminId: number;
    tglSelesaiLama: Date;
    tglSelesaiBaru: Date;
    tambahanHari: number;
    sisaBiaya: number;
    buktiBayar: string;
  }) {
    this.id = params.id;
    this.transaksiSewaId = params.transaksiSewaId;
    this.diprosesAdminId = params.diprosesAdminId;
    this.tglSelesaiLama = params.tglSelesaiLama;
    this.tglSelesaiBaru = params.tglSelesaiBaru;
    this.tambahanHari = params.tambahanHari;
    this.sisaBiaya = params.sisaBiaya;
    this.buktiBayar = params.buktiBayar;
  }
}