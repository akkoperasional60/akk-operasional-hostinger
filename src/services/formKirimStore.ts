import { branchStore } from './branchStore';

export type FormKirimFinanceStatus = 'pending_finance' | 'approved_finance' | 'revision_needed';
export type FormKirimDriverStatus = 'waiting_finance' | 'ready_for_driver' | 'in_transit' | 'delivered';
export type FormKirimPaymentMethod = 'Kredit / Tempo' | 'COD (Bayar di Tempat)' | 'Lunas Transfer';

export interface FormKirimRecord {
  id: string;
  noFormKirim: string;
  noFaktur: string;
  noSuratJalan: string;
  branchName: string;
  tanggalKirim: string;
  storeName: string;
  storeAddress: string;
  storePhone: string;
  fleetId: string;
  plateNumber: string;
  vehicleType: string;
  driverName: string;
  helperName: string;
  itemsSummary: string;
  totalColli: number;
  totalNominalFaktur: number;
  sisaPiutangToko: number;
  metodePembayaran: FormKirimPaymentMethod;
  createdByAdmin: string;
  createdAt: string;
  salesNotes: string;
  financeStatus: FormKirimFinanceStatus;
  validatedByFinance?: string;
  validatedAt?: string;
  financeNotes?: string;
  driverStatus: FormKirimDriverStatus;
  driverUpdatedAt?: string;
  driverNotes?: string;
}

const STORAGE_KEY = 'akk_form_kirim_records_v1';
const EVENT_NAME = 'akk-form-kirim-updated';

const INITIAL_FORM_KIRIM: FormKirimRecord[] = [
  {
    id: 'FK-202611-001',
    noFormKirim: 'FK/AKK/2026/11/001',
    noFaktur: 'INV/AKK/2026/11/0142',
    noSuratJalan: 'SJ-AKK-2611-088',
    branchName: 'Banyuwangi',
    tanggalKirim: new Date().toISOString().slice(0, 10),
    storeName: 'TK ANUGRAH SEKAR WANGI',
    storeAddress: 'Jl. Jend. Sudirman No. 48, Banyuwangi Kota',
    storePhone: '0812-3456-7811',
    fleetId: 'fl-01',
    plateNumber: 'P 8125 VC',
    vehicleType: 'Engkel Long Box',
    driverName: 'Zainul Agustiar',
    helperName: 'Aan Adi Saputra',
    itemsSummary: 'Cup Plst Jaguar 16 Oz (25 CRT), Mika Brownies M (15 CRT)',
    totalColli: 40,
    totalNominalFaktur: 20400000,
    sisaPiutangToko: 15000000,
    metodePembayaran: 'Kredit / Tempo',
    createdByAdmin: 'Bayu Novianto',
    createdAt: '2026-11-08T07:30:00.000Z',
    salesNotes: 'Kirim pagi gelombang 1 area Banyuwangi Kota',
    financeStatus: 'approved_finance',
    validatedByFinance: 'Staf Finance AKK',
    validatedAt: '2026-11-08T07:45:00.000Z',
    financeNotes: 'Limit piutang masih aman, disetujui masuk ke Portal Driver.',
    driverStatus: 'ready_for_driver'
  },
  {
    id: 'FK-202611-002',
    noFormKirim: 'FK/AKK/2026/11/002',
    noFaktur: 'INV/AKK/2026/11/0165',
    noSuratJalan: 'SJ-AKK-2611-094',
    branchName: 'Banyuwangi',
    tanggalKirim: new Date().toISOString().slice(0, 10),
    storeName: 'TK LIMA SEPULUH',
    storeAddress: 'Jl. Gajah Mada No. 110, Genteng - Banyuwangi',
    storePhone: '0813-5521-9088',
    fleetId: 'fl-02',
    plateNumber: 'P 8848 U',
    vehicleType: 'CDD Long Box',
    driverName: 'Ach Taufiq',
    helperName: 'Bintang Wahyu Pratama',
    itemsSummary: 'Alufoil Refil Bagus 45x7,62M (20 CRT), Kertas Nasi Cap Gajah (30 BAL)',
    totalColli: 50,
    totalNominalFaktur: 17600000,
    sisaPiutangToko: 7600000,
    metodePembayaran: 'COD (Bayar di Tempat)',
    createdByAdmin: 'Izzul Bahrul Hisam',
    createdAt: '2026-11-08T08:10:00.000Z',
    salesNotes: 'Pelanggan minta kirim hari ini, pembayaran COD saat bongkar.',
    financeStatus: 'pending_finance',
    driverStatus: 'waiting_finance'
  },
  {
    id: 'FK-202611-003',
    noFormKirim: 'FK/AKK/2026/11/003',
    noFaktur: 'INV/AKK/2026/11/0179',
    noSuratJalan: 'SJ-AKK-2611-102',
    branchName: 'Surabaya',
    tanggalKirim: new Date().toISOString().slice(0, 10),
    storeName: 'CV. PLASTIK JAYA SENTOSA',
    storeAddress: 'Kawasan Pergudangan Margomulyo Permai Blok D-14, Surabaya',
    storePhone: '0811-3109-4421',
    fleetId: 'fl-03',
    plateNumber: 'P 9014 V',
    vehicleType: 'Fuso Box',
    driverName: 'Faisol Arifin',
    helperName: 'Nanda Tegar Hadi Saputra',
    itemsSummary: 'Thinwall Square 1000ml (60 CRT), Sendok Makan Bening (25 CRT)',
    totalColli: 85,
    totalNominalFaktur: 42500000,
    sisaPiutangToko: 0,
    metodePembayaran: 'Lunas Transfer',
    createdByAdmin: 'Bayu Novianto',
    createdAt: '2026-11-08T08:25:00.000Z',
    salesNotes: 'Bukti transfer lunas sudah dilampirkan di SO.',
    financeStatus: 'pending_finance',
    driverStatus: 'waiting_finance'
  }
];

class FormKirimStore {
  private listeners: Set<() => void> = new Set();

  constructor() {
    if (typeof window !== 'undefined') {
      window.addEventListener(EVENT_NAME, () => {
        this.listeners.forEach(cb => cb());
      });
    }
  }

  public getAll(): FormKirimRecord[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    } catch {
      // ignore
    }
    return INITIAL_FORM_KIRIM;
  }

  private saveAll(records: FormKirimRecord[]): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
    } catch {
      // ignore
    }
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent(EVENT_NAME));
    }
    this.listeners.forEach(cb => cb());
  }

  public subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  public addFormKirim(
    input: Omit<
      FormKirimRecord,
      'id' | 'noFormKirim' | 'createdAt' | 'financeStatus' | 'driverStatus'
    >
  ): FormKirimRecord {
    const existing = this.getAll();
    const nextNum = existing.length + 1;
    const defaultBranch = branchStore.getActiveBranches()[0]?.name || 'Banyuwangi';

    const record: FormKirimRecord = {
      ...input,
      branchName: input.branchName || defaultBranch,
      id: `FK-${Date.now()}`,
      noFormKirim: `FK/AKK/2026/11/${String(nextNum).padStart(3, '0')}`,
      createdAt: new Date().toISOString(),
      financeStatus: 'pending_finance',
      driverStatus: 'waiting_finance'
    };

    this.saveAll([record, ...existing]);
    return record;
  }

  public validateByFinance(
    id: string,
    status: 'approved_finance' | 'revision_needed',
    validatedByFinance: string,
    financeNotes: string
  ): void {
    const existing = this.getAll();
    const updated = existing.map(item => {
      if (item.id !== id) return item;
      return {
        ...item,
        financeStatus: status,
        validatedByFinance,
        validatedAt: new Date().toISOString(),
        financeNotes:
          financeNotes.trim() ||
          (status === 'approved_finance'
            ? 'Tervalidasi Finance & diteruskan ke Portal Driver'
            : 'Perlu revisi / konfirmasi ulang oleh Admin Penjualan'),
        driverStatus:
          status === 'approved_finance'
            ? item.driverStatus === 'waiting_finance'
              ? ('ready_for_driver' as FormKirimDriverStatus)
              : item.driverStatus
            : ('waiting_finance' as FormKirimDriverStatus)
      };
    });
    this.saveAll(updated);
  }

  public updateDriverExecutionStatus(
    id: string,
    driverStatus: FormKirimDriverStatus,
    driverNotes?: string
  ): void {
    const existing = this.getAll();
    const updated = existing.map(item => {
      if (item.id !== id) return item;
      return {
        ...item,
        driverStatus,
        driverUpdatedAt: new Date().toISOString(),
        driverNotes: driverNotes?.trim() || item.driverNotes
      };
    });
    this.saveAll(updated);
  }

  public deleteFormKirim(id: string): void {
    const existing = this.getAll();
    this.saveAll(existing.filter(item => item.id !== id));
  }
}

export const formKirimStore = new FormKirimStore();
