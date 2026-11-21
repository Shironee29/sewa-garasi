import { TipeKendaraan } from '@/types/domain';

export class Kendaraan {
  public readonly id?: number;
  public readonly penyewaId: number;
  private tipe: TipeKendaraan;
  private noPlat: string | null;
  private merekTipe: string;
  private kapasitasMaxKwh: number | null;
  private bateraiTerakhirKwh: number | null;

  constructor(params: {
    id?: number;
    penyewaId: number;
    tipe: TipeKendaraan;
    noPlat?: string | null;
    merekTipe: string;
    kapasitasMaxKwh?: number | null;
    bateraiTerakhirKwh?: number | null;
  }) {
    this.id = params.id;
    this.penyewaId = params.penyewaId;
    this.tipe = params.tipe;
    this.noPlat = params.noPlat ?? null;
    this.merekTipe = params.merekTipe;
    this.kapasitasMaxKwh = params.kapasitasMaxKwh ?? null;
    this.bateraiTerakhirKwh = params.bateraiTerakhirKwh ?? null;
  }

  public getTipe(): TipeKendaraan {
    return this.tipe;
  }

  public getNoPlat(): string | null {
    return this.noPlat;
  }

  public getMerekTipe(): string {
    return this.merekTipe;
  }

  public isMobilListrik(): boolean {
    return this.tipe === 'MOBIL_LISTRIK';
  }

  public hitungKebutuhanKwh(): number {
    if (!this.isMobilListrik()) return 0;
    const max = this.kapasitasMaxKwh ?? 0;
    const terakhir = this.bateraiTerakhirKwh ?? 0;
    return Math.max(0, Number((max - terakhir).toFixed(2)));
  }
}