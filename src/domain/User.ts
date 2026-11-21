import bcrypt from 'bcryptjs';
import { RoleUser, StatusKtp } from '@/types/domain';

export abstract class User {
  public readonly id?: number;
  protected email: string;
  private passwordHash: string;
  protected role: RoleUser;

  constructor(email: string, passwordHash: string, role: RoleUser, id?: number) {
    this.id = id;
    this.email = email;
    this.passwordHash = passwordHash;
    this.role = role;
  }

  public getEmail(): string {
    return this.email;
  }

  public getRole(): RoleUser {
    return this.role;
  }

  public async login(email: string, plainPassword: string): Promise<boolean> {
    if (this.email.toLowerCase() !== email.toLowerCase()) {
      return false;
    }
    return bcrypt.compare(plainPassword, this.passwordHash);
  }
}

export class Penyewa extends User {
  private nik: string;
  private namaLengkap: string;
  private noTelp: string;
  private statusKtp: StatusKtp;

  constructor(params: {
    id?: number;
    email: string;
    passwordHash: string;
    nik: string;
    namaLengkap: string;
    noTelp: string;
    statusKtp?: StatusKtp;
  }) {
    super(params.email, params.passwordHash, 'PENYEWA', params.id);
    this.nik = params.nik;
    this.namaLengkap = params.namaLengkap;
    this.noTelp = params.noTelp;
    this.statusKtp = params.statusKtp ?? 'PENDING';
  }

  public getNik(): string {
    return this.nik;
  }

  public getNamaLengkap(): string {
    return this.namaLengkap;
  }

  public getNoTelp(): string {
    return this.noTelp;
  }

  public getStatusKtp(): StatusKtp {
    return this.statusKtp;
  }

  public setStatusKtp(status: StatusKtp): void {
    this.statusKtp = status;
  }

  public isVerified(): boolean {
    return this.statusKtp === 'APPROVED';
  }
}

export class Admin extends User {
  constructor(params: { id?: number; email: string; passwordHash: string }) {
    super(params.email, params.passwordHash, 'ADMIN', params.id);
  }

  public verifikasiKtp(penyewa: Penyewa, status: StatusKtp): void {
    if (status === 'PENDING') {
      throw new Error('Admin hanya dapat menyetujui (APPROVED) atau menolak (REJECTED) KTP.');
    }
    penyewa.setStatusKtp(status);
  }
}