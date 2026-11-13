import { branchStore } from './branchStore';

export type FormKirimFinanceStatus = 'pending_finance' | 'approved_finance' | 'revision_needed';
export type FormKirimDriverStatus = 'waiting_finance' | 'ready_for_driver' | 'in_transit' | 'delivered';
export type FormKirimPaymentMethod = 'Kredit / Tempo' | 'COD (Bayar di Tempat)' | 'Lunas Transfer' | 'COD & Tempo (Gabungan)';

export interface FormKirimInvoiceItem {
  id: string;
  noFaktur: string;
  tglFaktur: string;
  namaPelanggan: string;
  nilaiFaktur: number;
  coly: number;
  bayar: string;
  alamatPelanggan: string;
  keterangan: string;
  /**
   * Net Days Syarat Pelanggan hanya digunakan untuk mengklasifikasikan otomatis
   * antara pelanggan COD (netDays <= 0) dan TEMPO (netDays > 0).
   * Kolom Net Days TIDAK ditampilkan saat disimpan sesuai ketentuan template.
   */
  netDays: number;
  paymentCategory: 'COD' | 'TEMPO';
  isManualSbu?: boolean;
  nominalDiterima?: number;
  metodeBayarAktual?: 'Tunai' | 'Transfer' | 'TTD';
  isCombinedPayment?: boolean;
  combinedGroupId?: string;
  ttdDataUrl?: string;
  ttdSignerName?: string;
  ttdSignedAt?: string;
  driverUpdatedBy?: string;
  driverUpdatedAt?: string;
  financeTfValidated?: boolean;
  financeTfValidatedAt?: string;
  financeTfValidatedBy?: string;
  financeTtdValidated?: boolean;
  financeTtdValidatedAt?: string;
  financeTtdValidatedBy?: string;
  financeTunaiValidated?: boolean;
  financeTunaiValidatedAt?: string;
  financeTunaiValidatedBy?: string;
  financeMatchedChecked?: boolean;
  financeMatchedCheckedAt?: string;
  financeMatchedCheckedBy?: string;
  financeSettlementChecked?: boolean;
  financeSettlementCheckedAt?: string;
  financeSettlementCheckedBy?: string;
  financeItemNote?: string;
}

export interface FormKirimRecord {
  id: string;
  noFormKirim: string;
  noFaktur: string;
  noSuratJalan: string;
  branchName: string;
  sbuTitle?: string;
  periodLabel?: string;
  areaKirim?: string;
  tanggalKirim: string;
  storeName: string;
  storeAddress: string;
  storePhone: string;
  fleetId: string;
  plateNumber: string;
  armadaInitial?: string;
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
  invoiceItems?: FormKirimInvoiceItem[];
  codCount?: number;
  tempoCount?: number;
  codTotalNominal?: number;
  tempoTotalNominal?: number;
  totalNominalDiterima?: number;
  financeMatchedChecked?: boolean;
  financeMatchedCheckedAt?: string;
  financeMatchedCheckedBy?: string;
  financeSettlementChecked?: boolean;
  financeSettlementCheckedAt?: string;
  financeSettlementCheckedBy?: string;
}

const LEGACY_DUMMY_FORM_KIRIM_IDS = new Set(['FK-202611-001', 'FK-202611-002']);

const STORAGE_KEY = 'akk_form_kirim_records_v1';
const EVENT_NAME = 'akk-form-kirim-updated';

export const SAMPLE_NUSANTARA_ARGO_INVOICE_ITEMS: FormKirimInvoiceItem[] = [
  // COD Section (Net Days = 0,00)
  {
    id: 'fki-1',
    noFaktur: 'FJ02-0226-2955',
    tglFaktur: '28 Feb 2026',
    namaPelanggan: 'BU FERA',
    nilaiFaktur: 3543689,
    coly: 0,
    bayar: '',
    alamatPelanggan: 'JL S.PARMAN',
    keterangan: '',
    netDays: 0,
    paymentCategory: 'COD',
    isManualSbu: false
  },
  {
    id: 'fki-2',
    noFaktur: 'FJ02-0226-2953',
    tglFaktur: '28 Feb 2026',
    namaPelanggan: 'TK AULIANA PLASTIK',
    nilaiFaktur: 852870,
    coly: 0,
    bayar: '',
    alamatPelanggan: 'JEMBER',
    keterangan: '',
    netDays: 0,
    paymentCategory: 'COD',
    isManualSbu: false
  },
  {
    id: 'fki-3',
    noFaktur: 'FJ02-0226-2604',
    tglFaktur: '28 Feb 2026',
    namaPelanggan: 'TK GRAHA FROZEN',
    nilaiFaktur: 2062814,
    coly: 0,
    bayar: '',
    alamatPelanggan: 'JL ARGOPURO',
    keterangan: '',
    netDays: 0,
    paymentCategory: 'COD',
    isManualSbu: false
  },
  {
    id: 'fki-4',
    noFaktur: 'FJ02-0226-2960',
    tglFaktur: '28 Feb 2026',
    namaPelanggan: 'TK KURNIA PLASTIK',
    nilaiFaktur: 1072800,
    coly: 0,
    bayar: '',
    alamatPelanggan: 'RAMBIPUJI',
    keterangan: '',
    netDays: 0,
    paymentCategory: 'COD',
    isManualSbu: false
  },
  {
    id: 'fki-5',
    noFaktur: 'FJ02-0226-2608',
    tglFaktur: '28 Feb 2026',
    namaPelanggan: 'TK RUJAK AYU JEMBER',
    nilaiFaktur: 2099554,
    coly: 0,
    bayar: '',
    alamatPelanggan: 'ROXY, JEMBER',
    keterangan: '',
    netDays: 0,
    paymentCategory: 'COD',
    isManualSbu: false
  },
  {
    id: 'fki-6',
    noFaktur: 'FJ02B-0226-0497',
    tglFaktur: '28 Feb 2026',
    namaPelanggan: 'TK RUJAK AYU JEMBER',
    nilaiFaktur: 323000,
    coly: 0,
    bayar: '',
    alamatPelanggan: 'ROXY, JEMBER',
    keterangan: '',
    netDays: 0,
    paymentCategory: 'COD',
    isManualSbu: false
  },
  {
    id: 'fki-7',
    noFaktur: 'FJ03-0226-7569',
    tglFaktur: '28 Feb 2026',
    namaPelanggan: 'TK RUJAK AYU JEMBER',
    nilaiFaktur: 34000,
    coly: 0,
    bayar: '',
    alamatPelanggan: 'ROXY, JEMBER',
    keterangan: '',
    netDays: 0,
    paymentCategory: 'COD',
    isManualSbu: true
  },
  {
    id: 'fki-8',
    noFaktur: 'FJ02-0226-2601',
    tglFaktur: '28 Feb 2026',
    namaPelanggan: 'TK WAWAN PLASTIK',
    nilaiFaktur: 774560,
    coly: 0,
    bayar: '',
    alamatPelanggan: 'PASAR GEBANG',
    keterangan: '',
    netDays: 0,
    paymentCategory: 'COD',
    isManualSbu: false
  },
  // TEMPO Section (Net Days > 0: 30,00 / 7,00)
  {
    id: 'fki-9',
    noFaktur: 'FJ02-0226-2956',
    tglFaktur: '28 Feb 2026',
    namaPelanggan: 'PT. ANUGERAH MAPAN SENTOSA',
    nilaiFaktur: 1392300,
    coly: 0,
    bayar: '',
    alamatPelanggan: 'JALAN MERAK 2A',
    keterangan: '',
    netDays: 30,
    paymentCategory: 'TEMPO',
    isManualSbu: false
  },
  {
    id: 'fki-10',
    noFaktur: 'FJ02-0226-2607',
    tglFaktur: '28 Feb 2026',
    namaPelanggan: 'TK AGUNG PLASTIK',
    nilaiFaktur: 267710,
    coly: 0,
    bayar: '',
    alamatPelanggan: 'JEMBER',
    keterangan: '',
    netDays: 7,
    paymentCategory: 'TEMPO',
    isManualSbu: false
  },
  {
    id: 'fki-11',
    noFaktur: 'FJ02-0226-2605',
    tglFaktur: '28 Feb 2026',
    namaPelanggan: 'TK ASA RASA 1',
    nilaiFaktur: 987898,
    coly: 0,
    bayar: '',
    alamatPelanggan: 'UTARA UNEJ',
    keterangan: '',
    netDays: 30,
    paymentCategory: 'TEMPO',
    isManualSbu: false
  },
  {
    id: 'fki-12',
    noFaktur: 'FJ02-0226-2606',
    tglFaktur: '28 Feb 2026',
    namaPelanggan: 'TK ASA RASA 2',
    nilaiFaktur: 415218,
    coly: 0,
    bayar: '',
    alamatPelanggan: 'TEGAL BESAR,',
    keterangan: '',
    netDays: 30,
    paymentCategory: 'TEMPO',
    isManualSbu: false
  },
  {
    id: 'fki-13',
    noFaktur: 'FJ02-0226-2609',
    tglFaktur: '28 Feb 2026',
    namaPelanggan: 'TK JAYA RAYA',
    nilaiFaktur: 644390,
    coly: 0,
    bayar: '',
    alamatPelanggan: 'JL IMAM BONJOL,',
    keterangan: '',
    netDays: 7,
    paymentCategory: 'TEMPO',
    isManualSbu: false
  },
  {
    id: 'fki-14',
    noFaktur: 'FJ02-0226-2957',
    tglFaktur: '28 Feb 2026',
    namaPelanggan: 'TK JAYA RAYA',
    nilaiFaktur: 1590950,
    coly: 0,
    bayar: '',
    alamatPelanggan: 'JL IMAM BONJOL,',
    keterangan: '',
    netDays: 7,
    paymentCategory: 'TEMPO',
    isManualSbu: false
  },
  {
    id: 'fki-15',
    noFaktur: 'FJ02B-0226-0508',
    tglFaktur: '28 Feb 2026',
    namaPelanggan: 'TK JAYA RAYA',
    nilaiFaktur: 612305,
    coly: 0,
    bayar: '',
    alamatPelanggan: 'JL IMAM BONJOL,',
    keterangan: '',
    netDays: 7,
    paymentCategory: 'TEMPO',
    isManualSbu: false
  },
  {
    id: 'fki-16',
    noFaktur: 'FJ02B-0226-0514',
    tglFaktur: '28 Feb 2026',
    namaPelanggan: 'TK JAYA RAYA',
    nilaiFaktur: 147250,
    coly: 0,
    bayar: '',
    alamatPelanggan: 'JL IMAM BONJOL,',
    keterangan: '',
    netDays: 7,
    paymentCategory: 'TEMPO',
    isManualSbu: false
  },
  {
    id: 'fki-17',
    noFaktur: 'FJ03-0226-7631',
    tglFaktur: '28 Feb 2026',
    namaPelanggan: 'TK JAYA RAYA',
    nilaiFaktur: 384700,
    coly: 0,
    bayar: '',
    alamatPelanggan: 'JL IMAM BONJOL,',
    keterangan: '',
    netDays: 7,
    paymentCategory: 'TEMPO',
    isManualSbu: true
  },
  {
    id: 'fki-18',
    noFaktur: 'FJ02-0226-2954',
    tglFaktur: '28 Feb 2026',
    namaPelanggan: 'TK MITRA JMBER',
    nilaiFaktur: 2480065,
    coly: 0,
    bayar: '',
    alamatPelanggan: 'JL DIPONEGOR',
    keterangan: '',
    netDays: 7,
    paymentCategory: 'TEMPO',
    isManualSbu: false
  }
];

const INITIAL_FORM_KIRIM: FormKirimRecord[] = [
  {
    id: 'FK-202602-JBR',
    noFormKirim: 'FK/AKK/2026/02/001',
    noFaktur: 'FJ02-0226-2955 s/d FJ02-0226-2954 (18 Faktur)',
    noSuratJalan: 'SJ-AKK-2602-JBR',
    branchName: 'Banyuwangi',
    sbuTitle: 'ANUGRAH KEMASAN KREATIF',
    periodLabel: 'Dari 28 Feb 2026 ke 28 Feb 2026',
    areaKirim: 'JEMBER KOTA',
    tanggalKirim: '2026-02-28',
    storeName: 'AREA JEMBER KOTA (8 COD • 10 TEMPO)',
    storeAddress: 'Rute Distribusi Jember (Jl. S. Parman, Roxy, Jl. Imam Bonjol, Diponegoro)',
    storePhone: '-',
    fleetId: 'fl-02',
    plateNumber: 'P 8848 U',
    armadaInitial: 'DS2',
    vehicleType: 'CDD Long Box',
    driverName: 'Ach Taufiq',
    helperName: 'Aan Adi Saputra',
    itemsSummary: '18 Faktur Pengiriman Sales (8 Faktur COD • 10 Faktur TEMPO)',
    totalColli: 0,
    totalNominalFaktur: 19686073,
    sisaPiutangToko: 8922786,
    metodePembayaran: 'COD & Tempo (Gabungan)',
    createdByAdmin: 'Admin Penjualan',
    createdAt: '2026-02-28T07:30:00.000Z',
    salesNotes: 'Form Pengiriman/Sales Area Jember Kota (Terintegrasi Portal Driver)',
    financeStatus: 'approved_finance',
    validatedByFinance: 'Staf Finance AKK',
    validatedAt: '2026-02-28T07:45:00.000Z',
    financeNotes: 'Data faktur COD & Tempo sesuai, diteruskan ke Portal Driver.',
    driverStatus: 'ready_for_driver',
    invoiceItems: SAMPLE_NUSANTARA_ARGO_INVOICE_ITEMS,
    codCount: 8,
    tempoCount: 10,
    codTotalNominal: 10763287,
    tempoTotalNominal: 8922786
  }
];

function preserveProgressWhenAdminUpdates(
  incomingItems: FormKirimInvoiceItem[],
  existingItems?: FormKirimInvoiceItem[]
): FormKirimInvoiceItem[] {
  if (!existingItems || existingItems.length === 0) return incomingItems;
  const byId = new Map(existingItems.map(it => [it.id, it]));
  const byNo = new Map(existingItems.map(it => [String(it.noFaktur || '').trim().toUpperCase(), it]));
  return incomingItems.map(inc => {
    const prev =
      byId.get(inc.id) ||
      byNo.get(String(inc.noFaktur || '').trim().toUpperCase());
    if (!prev) return inc;
    return {
      ...inc,
      nominalDiterima: inc.nominalDiterima !== undefined ? inc.nominalDiterima : prev.nominalDiterima,
      metodeBayarAktual: inc.metodeBayarAktual || prev.metodeBayarAktual,
      isCombinedPayment: inc.isCombinedPayment !== undefined ? inc.isCombinedPayment : prev.isCombinedPayment,
      combinedGroupId: inc.combinedGroupId || prev.combinedGroupId,
      ttdDataUrl: inc.ttdDataUrl || prev.ttdDataUrl,
      ttdSignerName: inc.ttdSignerName || prev.ttdSignerName,
      ttdSignedAt: inc.ttdSignedAt || prev.ttdSignedAt,
      driverUpdatedBy: inc.driverUpdatedBy || prev.driverUpdatedBy,
      driverUpdatedAt: inc.driverUpdatedAt || prev.driverUpdatedAt,
      financeTfValidated: inc.financeTfValidated !== undefined ? inc.financeTfValidated : prev.financeTfValidated,
      financeTfValidatedAt: inc.financeTfValidatedAt || prev.financeTfValidatedAt,
      financeTfValidatedBy: inc.financeTfValidatedBy || prev.financeTfValidatedBy,
      financeTtdValidated: inc.financeTtdValidated !== undefined ? inc.financeTtdValidated : prev.financeTtdValidated,
      financeTtdValidatedAt: inc.financeTtdValidatedAt || prev.financeTtdValidatedAt,
      financeTtdValidatedBy: inc.financeTtdValidatedBy || prev.financeTtdValidatedBy,
      financeTunaiValidated: inc.financeTunaiValidated !== undefined ? inc.financeTunaiValidated : prev.financeTunaiValidated,
      financeTunaiValidatedAt: inc.financeTunaiValidatedAt || prev.financeTunaiValidatedAt,
      financeTunaiValidatedBy: inc.financeTunaiValidatedBy || prev.financeTunaiValidatedBy,
      financeMatchedChecked: inc.financeMatchedChecked !== undefined ? inc.financeMatchedChecked : prev.financeMatchedChecked,
      financeMatchedCheckedAt: inc.financeMatchedCheckedAt || prev.financeMatchedCheckedAt,
      financeMatchedCheckedBy: inc.financeMatchedCheckedBy || prev.financeMatchedCheckedBy,
      financeSettlementChecked: inc.financeSettlementChecked !== undefined ? inc.financeSettlementChecked : prev.financeSettlementChecked,
      financeSettlementCheckedAt: inc.financeSettlementCheckedAt || prev.financeSettlementCheckedAt,
      financeSettlementCheckedBy: inc.financeSettlementCheckedBy || prev.financeSettlementCheckedBy,
      financeItemNote: inc.financeItemNote || prev.financeItemNote
    };
  });
}

class FormKirimStore {
  private listeners: Set<() => void> = new Set();
  private hydratedFromServer = false;
  private isHydrating = false;
  private lastHydrateAt = 0;
  private rateLimitedUntil = 0;

  constructor() {
    if (typeof window !== 'undefined') {
      window.addEventListener(EVENT_NAME, () => {
        this.listeners.forEach(cb => cb());
      });
      void this.hydrateFromServer();
    }
  }

  public async hydrateFromServer(force = false, bypassCooldown = false): Promise<void> {
    if (this.hydratedFromServer && !force) return;
    if (this.isHydrating) return;
    const now = Date.now();
    if (!bypassCooldown && now < this.rateLimitedUntil) return;
    if (!bypassCooldown && this.lastHydrateAt > 0 && now - this.lastHydrateAt < 10000) return;
    this.isHydrating = true;
    this.lastHydrateAt = now;
    this.hydratedFromServer = true;
    try {
      const res = await fetch('/api/form-kirim');
      if (res.status === 429) {
        this.rateLimitedUntil = Date.now() + 60000;
        return;
      }
      if (!res.ok) return;
      const data = await res.json();
      if (data && data.success && Array.isArray(data.records)) {
        const cleaned = data.records.filter(
          (r: FormKirimRecord) => r && !LEGACY_DUMMY_FORM_KIRIM_IDS.has(r.id)
        );
        if (cleaned.length > 0 || data.records.length > 0) {
          try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(cleaned));
          } catch {}
          this.listeners.forEach(cb => cb());
        }
      }
    } catch {
      // ignore offline
    } finally {
      this.isHydrating = false;
    }
  }

  public getAll(): FormKirimRecord[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          const cleaned = parsed.filter(
            (r: FormKirimRecord) => r && !LEGACY_DUMMY_FORM_KIRIM_IDS.has(r.id)
          );
          if (cleaned.length !== parsed.length) {
            try {
              localStorage.setItem(STORAGE_KEY, JSON.stringify(cleaned));
            } catch {}
          }
          return cleaned;
        }
      }
    } catch {
      // ignore
    }
    return INITIAL_FORM_KIRIM;
  }

  private persistLocal(records: FormKirimRecord[]): void {
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

  private saveAll(records: FormKirimRecord[]): void {
    this.persistLocal(records);
    if (typeof window !== 'undefined') {
      fetch('/api/form-kirim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ records })
      })
        .then(async res => {
          if (!res.ok) return;
          const data = await res.json().catch(() => null);
          if (data?.success && Array.isArray(data.records)) {
            const cleaned = data.records.filter(
              (r: FormKirimRecord) => r && !LEGACY_DUMMY_FORM_KIRIM_IDS.has(r.id)
            );
            this.persistLocal(cleaned);
          }
        })
        .catch(() => {});
    }
  }

  private syncDriverPatch(
    recordId: string,
    patch: {
      driverStatus?: FormKirimDriverStatus;
      driverUpdatedAt?: string;
      driverNotes?: string;
      totalNominalDiterima?: number;
      invoiceItems?: FormKirimInvoiceItem[];
    },
    fallbackRecords: FormKirimRecord[]
  ): void {
    if (typeof window === 'undefined') return;
    fetch(`/api/form-kirim/${encodeURIComponent(recordId)}/driver`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch)
    })
      .then(async res => {
        if (res.status === 404) {
          this.saveAll(fallbackRecords);
          return;
        }
        if (!res.ok) return;
        const data = await res.json().catch(() => null);
        if (data?.success && data.record) {
          const current = this.getAll();
          const merged = current.map(r => (r.id === recordId ? data.record : r));
          this.persistLocal(merged);
        }
      })
      .catch(() => {});
  }

  private syncFinancePatch(
    recordId: string,
    patch: {
      financeStatus?: FormKirimFinanceStatus;
      validatedByFinance?: string;
      validatedAt?: string;
      financeNotes?: string;
      driverStatus?: FormKirimDriverStatus;
      financeMatchedChecked?: boolean;
      financeMatchedCheckedAt?: string;
      financeMatchedCheckedBy?: string;
      financeSettlementChecked?: boolean;
      financeSettlementCheckedAt?: string;
      financeSettlementCheckedBy?: string;
      invoiceItems?: FormKirimInvoiceItem[];
    },
    fallbackRecords: FormKirimRecord[]
  ): void {
    if (typeof window === 'undefined') return;
    fetch(`/api/form-kirim/${encodeURIComponent(recordId)}/finance`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch)
    })
      .then(async res => {
        if (res.status === 404) {
          this.saveAll(fallbackRecords);
          return;
        }
        if (!res.ok) return;
        const data = await res.json().catch(() => null);
        if (data?.success && data.record) {
          const current = this.getAll();
          const merged = current.map(r => (r.id === recordId ? data.record : r));
          this.persistLocal(merged);
        }
      })
      .catch(() => {});
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
    > & {
      financeStatus?: FormKirimFinanceStatus;
      driverStatus?: FormKirimDriverStatus;
    }
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
      financeStatus: input.financeStatus || 'approved_finance',
      driverStatus: input.driverStatus || 'ready_for_driver'
    };

    this.saveAll([record, ...existing]);
    return record;
  }

  public updateFormKirim(id: string, patch: Partial<FormKirimRecord>): void {
    const existing = this.getAll();
    const updated = existing.map(item => {
      if (item.id !== id) return item;
      const mergedItems = patch.invoiceItems
        ? preserveProgressWhenAdminUpdates(patch.invoiceItems, item.invoiceItems)
        : item.invoiceItems;
      return {
        ...item,
        ...patch,
        invoiceItems: mergedItems
      };
    });
    this.saveAll(updated);
  }

  public validateByFinance(
    id: string,
    status: 'approved_finance' | 'revision_needed',
    validatedByFinance: string,
    financeNotes: string
  ): void {
    const existing = this.getAll();
    const nowIso = new Date().toISOString();
    let patchToSend: Partial<FormKirimRecord> | null = null;
    const updated = existing.map(item => {
      if (item.id !== id) return item;
      const nextDriverStatus: FormKirimDriverStatus =
        status === 'approved_finance'
          ? item.driverStatus === 'waiting_finance'
            ? 'ready_for_driver'
            : item.driverStatus
          : 'waiting_finance';
      const nextNotes =
        financeNotes.trim() ||
        (status === 'approved_finance'
          ? 'Tervalidasi Finance & diteruskan ke Portal Driver'
          : 'Perlu revisi / konfirmasi ulang oleh Admin Penjualan');
      patchToSend = {
        financeStatus: status,
        validatedByFinance,
        validatedAt: nowIso,
        financeNotes: nextNotes,
        driverStatus: nextDriverStatus
      };
      return {
        ...item,
        ...patchToSend
      };
    });
    this.persistLocal(updated);
    if (patchToSend) {
      this.syncFinancePatch(id, patchToSend, updated);
    }
  }

  public updateDriverExecutionStatus(
    id: string,
    driverStatus: FormKirimDriverStatus,
    driverNotes?: string
  ): void {
    const existing = this.getAll();
    const nowIso = new Date().toISOString();
    let patchToSend: {
      driverStatus: FormKirimDriverStatus;
      driverUpdatedAt: string;
      driverNotes?: string;
    } | null = null;
    const updated = existing.map(item => {
      if (item.id !== id) return item;
      const resolvedNotes = driverNotes?.trim() || item.driverNotes;
      patchToSend = {
        driverStatus,
        driverUpdatedAt: nowIso,
        driverNotes: resolvedNotes
      };
      return {
        ...item,
        ...patchToSend
      };
    });
    this.persistLocal(updated);
    if (patchToSend) {
      this.syncDriverPatch(id, patchToSend, updated);
    }
  }

  public updateInvoiceItems(
    id: string,
    invoiceItems: FormKirimInvoiceItem[],
    driverNotes?: string
  ): void {
    const existing = this.getAll();
    const nowIso = new Date().toISOString();
    const stampedItems = invoiceItems.map(it => ({
      ...it,
      driverUpdatedAt: it.driverUpdatedAt || (it.metodeBayarAktual || it.ttdDataUrl ? nowIso : undefined)
    }));
    const totalDiterima = stampedItems
      .filter(it => it.metodeBayarAktual === 'Tunai' && Number(it.nominalDiterima) > 0)
      .reduce((sum, it) => sum + (Number(it.nominalDiterima) || 0), 0);

    let patchToSend: {
      invoiceItems: FormKirimInvoiceItem[];
      totalNominalDiterima: number;
      driverUpdatedAt: string;
      driverNotes?: string;
    } | null = null;

    const updated = existing.map(item => {
      if (item.id !== id) return item;
      const resolvedNotes = driverNotes?.trim() || item.driverNotes;
      patchToSend = {
        invoiceItems: stampedItems,
        totalNominalDiterima: totalDiterima,
        driverUpdatedAt: nowIso,
        driverNotes: resolvedNotes
      };
      return {
        ...item,
        ...patchToSend
      };
    });
    this.persistLocal(updated);
    if (patchToSend) {
      this.syncDriverPatch(id, patchToSend, updated);
    }
  }

  public validateInvoiceItemByFinance(
    formKirimId: string,
    itemId: string,
    validationType: 'tf' | 'ttd' | 'tunai',
    validated: boolean,
    validatorName: string
  ): void {
    const existing = this.getAll();
    const nowIso = new Date().toISOString();
    let nextItemsForPatch: FormKirimInvoiceItem[] | undefined;

    const updated = existing.map(record => {
      if (record.id !== formKirimId || !record.invoiceItems) return record;
      const nextItems = record.invoiceItems.map(it => {
        if (it.id !== itemId) return it;
        if (validationType === 'tf') {
          return {
            ...it,
            financeTfValidated: validated,
            financeTfValidatedAt: validated ? nowIso : undefined,
            financeTfValidatedBy: validated ? validatorName : undefined
          };
        }
        if (validationType === 'ttd') {
          return {
            ...it,
            financeTtdValidated: validated,
            financeTtdValidatedAt: validated ? nowIso : undefined,
            financeTtdValidatedBy: validated ? validatorName : undefined
          };
        }
        return {
          ...it,
          financeTunaiValidated: validated,
          financeTunaiValidatedAt: validated ? nowIso : undefined,
          financeTunaiValidatedBy: validated ? validatorName : undefined
        };
      });
      nextItemsForPatch = nextItems;
      return {
        ...record,
        invoiceItems: nextItems
      };
    });
    this.persistLocal(updated);
    if (nextItemsForPatch) {
      this.syncFinancePatch(formKirimId, { invoiceItems: nextItemsForPatch }, updated);
    }
  }

  public validateAllByTypeFinance(
    formKirimId: string,
    validationType: 'tf' | 'ttd' | 'tunai',
    validated: boolean,
    validatorName: string
  ): void {
    const existing = this.getAll();
    const nowIso = new Date().toISOString();
    let nextItemsForPatch: FormKirimInvoiceItem[] | undefined;

    const updated = existing.map(record => {
      if (record.id !== formKirimId || !record.invoiceItems) return record;
      const nextItems = record.invoiceItems.map(it => {
        if (validationType === 'tf') {
          const isTf =
            it.metodeBayarAktual === 'Transfer' ||
            String(it.bayar || '').trim().toUpperCase() === 'TRANSFER';
          if (!isTf) return it;
          return {
            ...it,
            financeTfValidated: validated,
            financeTfValidatedAt: validated ? nowIso : undefined,
            financeTfValidatedBy: validated ? validatorName : undefined
          };
        }
        if (validationType === 'ttd') {
          if (!it.ttdDataUrl) return it;
          return {
            ...it,
            financeTtdValidated: validated,
            financeTtdValidatedAt: validated ? nowIso : undefined,
            financeTtdValidatedBy: validated ? validatorName : undefined
          };
        }
        const isTunai =
          it.metodeBayarAktual === 'Tunai' &&
          (Number(it.nominalDiterima) > 0 || Boolean(it.isCombinedPayment));
        if (!isTunai) return it;
        return {
          ...it,
          financeTunaiValidated: validated,
          financeTunaiValidatedAt: validated ? nowIso : undefined,
          financeTunaiValidatedBy: validated ? validatorName : undefined
        };
      });
      nextItemsForPatch = nextItems;
      return {
        ...record,
        invoiceItems: nextItems
      };
    });
    this.persistLocal(updated);
    if (nextItemsForPatch) {
      this.syncFinancePatch(formKirimId, { invoiceItems: nextItemsForPatch }, updated);
    }
  }

  public toggleInvoiceSettlementCheck(
    formKirimId: string,
    itemId: string,
    checked: boolean,
    checkerName: string
  ): void {
    const existing = this.getAll();
    const nowIso = new Date().toISOString();
    let patchToSend: Partial<FormKirimRecord> | null = null;

    const updated = existing.map(record => {
      if (record.id !== formKirimId) return record;
      if (!record.invoiceItems || record.invoiceItems.length === 0) {
        patchToSend = {
          financeSettlementChecked: checked,
          financeSettlementCheckedAt: checked ? nowIso : undefined,
          financeSettlementCheckedBy: checked ? checkerName : undefined
        };
        return {
          ...record,
          ...patchToSend
        };
      }
      const nextItems = record.invoiceItems.map(it => {
        if (it.id !== itemId) return it;
        return {
          ...it,
          financeSettlementChecked: checked,
          financeSettlementCheckedAt: checked ? nowIso : undefined,
          financeSettlementCheckedBy: checked ? checkerName : undefined
        };
      });
      patchToSend = { invoiceItems: nextItems };
      return {
        ...record,
        invoiceItems: nextItems
      };
    });
    this.persistLocal(updated);
    if (patchToSend) {
      this.syncFinancePatch(formKirimId, patchToSend, updated);
    }
  }

  public checkAllInvoicesSettlementByFinance(
    formKirimId: string,
    checked: boolean,
    checkerName: string
  ): void {
    const existing = this.getAll();
    const nowIso = new Date().toISOString();
    let patchToSend: Partial<FormKirimRecord> | null = null;

    const updated = existing.map(record => {
      if (record.id !== formKirimId) return record;
      if (!record.invoiceItems || record.invoiceItems.length === 0) {
        patchToSend = {
          financeSettlementChecked: checked,
          financeSettlementCheckedAt: checked ? nowIso : undefined,
          financeSettlementCheckedBy: checked ? checkerName : undefined
        };
        return {
          ...record,
          ...patchToSend
        };
      }
      const nextItems = record.invoiceItems.map(it => ({
        ...it,
        financeSettlementChecked: checked,
        financeSettlementCheckedAt: checked ? nowIso : undefined,
        financeSettlementCheckedBy: checked ? checkerName : undefined
      }));
      patchToSend = { invoiceItems: nextItems };
      return {
        ...record,
        invoiceItems: nextItems
      };
    });
    this.persistLocal(updated);
    if (patchToSend) {
      this.syncFinancePatch(formKirimId, patchToSend, updated);
    }
  }

  public toggleInvoiceMatchedCheck(
    formKirimId: string,
    itemId: string,
    checked: boolean,
    checkerName: string
  ): void {
    const existing = this.getAll();
    const nowIso = new Date().toISOString();
    let patchToSend: Partial<FormKirimRecord> | null = null;

    const updated = existing.map(record => {
      if (record.id !== formKirimId) return record;
      if (!record.invoiceItems || record.invoiceItems.length === 0) {
        patchToSend = {
          financeMatchedChecked: checked,
          financeMatchedCheckedAt: checked ? nowIso : undefined,
          financeMatchedCheckedBy: checked ? checkerName : undefined
        };
        return {
          ...record,
          ...patchToSend
        };
      }
      const nextItems = record.invoiceItems.map(it => {
        if (it.id !== itemId) return it;
        return {
          ...it,
          financeMatchedChecked: checked,
          financeMatchedCheckedAt: checked ? nowIso : undefined,
          financeMatchedCheckedBy: checked ? checkerName : undefined
        };
      });
      patchToSend = { invoiceItems: nextItems };
      return {
        ...record,
        invoiceItems: nextItems
      };
    });
    this.persistLocal(updated);
    if (patchToSend) {
      this.syncFinancePatch(formKirimId, patchToSend, updated);
    }
  }

  public checkAllInvoicesMatchedByFinance(
    formKirimId: string,
    checked: boolean,
    checkerName: string
  ): void {
    const existing = this.getAll();
    const nowIso = new Date().toISOString();
    let patchToSend: Partial<FormKirimRecord> | null = null;

    const updated = existing.map(record => {
      if (record.id !== formKirimId) return record;
      if (!record.invoiceItems || record.invoiceItems.length === 0) {
        patchToSend = {
          financeMatchedChecked: checked,
          financeMatchedCheckedAt: checked ? nowIso : undefined,
          financeMatchedCheckedBy: checked ? checkerName : undefined
        };
        return {
          ...record,
          ...patchToSend
        };
      }
      const nextItems = record.invoiceItems.map(it => ({
        ...it,
        financeMatchedChecked: checked,
        financeMatchedCheckedAt: checked ? nowIso : undefined,
        financeMatchedCheckedBy: checked ? checkerName : undefined
      }));
      patchToSend = { invoiceItems: nextItems };
      return {
        ...record,
        invoiceItems: nextItems
      };
    });
    this.persistLocal(updated);
    if (patchToSend) {
      this.syncFinancePatch(formKirimId, patchToSend, updated);
    }
  }

  public deleteFormKirim(id: string): void {
    const existing = this.getAll();
    this.saveAll(existing.filter(item => item.id !== id));
  }
}

export const formKirimStore = new FormKirimStore();
