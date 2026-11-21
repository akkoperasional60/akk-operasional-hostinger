import { branchStore } from './branchStore';

export type FormKirimFinanceStatus = 'pending_finance' | 'approved_finance' | 'revision_needed';
export type FormKirimDriverStatus = 'waiting_finance' | 'ready_for_driver' | 'in_transit' | 'delivered';
export type FormKirimPaymentMethod = 'Kredit / Tempo' | 'COD (Bayar di Tempat)' | 'Lunas Transfer' | 'COD & Tempo (Gabungan)';

export interface FormKirimGpsLockEntry {
  attemptNumber: number; // 1 = GPS Awal, 2 = GPS Kedua, 3 = GPS Ketiga
  label: string; // 'GPS Awal' | 'GPS Kedua' | 'GPS Ketiga'
  lat: number;
  lng: number;
  accuracy: number;
  locationName?: string;
  savedAt: string;
  savedTimeWib: string;
  savedBy: string;
  savedRole?: string;
  paymentMethod: string;
  nominalDiterima?: number;
  summary: string;
}

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
  driverEditCount?: number;
  customerNote?: string;
  gpsLockHistory?: FormKirimGpsLockEntry[];
  lockedGpsLat?: number;
  lockedGpsLng?: number;
  lockedGpsAccuracy?: number;
  lockedGpsLocation?: string;
  lockedGpsAt?: string;
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
  kmPagi?: number;
  kmPulang?: number;
  kmPagiRecordedAt?: string;
  kmPulangRecordedAt?: string;
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
    bayar: 'Rp 3.543.689',
    alamatPelanggan: 'JL S.PARMAN',
    keterangan: 'Setoran Tunai Lunas',
    netDays: 0,
    paymentCategory: 'COD',
    isManualSbu: false,
    metodeBayarAktual: 'Tunai',
    nominalDiterima: 3543689,
    driverEditCount: 3,
    customerNote: 'Awalnya titip DP, lalu direvisi pelunasan penuh oleh toko',
    lockedGpsLat: -8.174820,
    lockedGpsLng: 113.702410,
    lockedGpsAccuracy: 9,
    lockedGpsLocation: 'JL S.PARMAN, JEMBER',
    lockedGpsAt: '2026-11-16T09:42:18.000Z',
    gpsLockHistory: [
      {
        attemptNumber: 1,
        label: 'GPS Awal',
        lat: -8.174510,
        lng: 113.702150,
        accuracy: 12,
        locationName: 'JL S.PARMAN, JEMBER',
        savedAt: '2026-11-16T09:15:10.000Z',
        savedTimeWib: '16.15 WIB',
        savedBy: 'Budi Santoso',
        savedRole: 'Driver',
        paymentMethod: 'TUNAI',
        nominalDiterima: 2000000,
        summary: 'Simpan Tunai • Rp 2.000.000'
      },
      {
        attemptNumber: 2,
        label: 'GPS Kedua',
        lat: -8.174690,
        lng: 113.702290,
        accuracy: 10,
        locationName: 'JL S.PARMAN, JEMBER',
        savedAt: '2026-11-16T09:28:45.000Z',
        savedTimeWib: '16.28 WIB',
        savedBy: 'Budi Santoso',
        savedRole: 'Driver',
        paymentMethod: 'TUNAI',
        nominalDiterima: 3000000,
        summary: 'Ubah Simpan Tunai Ke-2 • Rp 3.000.000'
      },
      {
        attemptNumber: 3,
        label: 'GPS Ketiga',
        lat: -8.174820,
        lng: 113.702410,
        accuracy: 9,
        locationName: 'JL S.PARMAN, JEMBER',
        savedAt: '2026-11-16T09:42:18.000Z',
        savedTimeWib: '16.42 WIB',
        savedBy: 'Budi Santoso',
        savedRole: 'Driver',
        paymentMethod: 'TUNAI',
        nominalDiterima: 3543689,
        summary: 'Ubah Simpan Tunai Ke-3 (Lunas) • Rp 3.543.689'
      }
    ]
  },
  {
    id: 'fki-2',
    noFaktur: 'FJ02-0226-2953',
    tglFaktur: '28 Feb 2026',
    namaPelanggan: 'TK AULIANA PLASTIK',
    nilaiFaktur: 852870,
    coly: 0,
    bayar: 'Rp 852.870',
    alamatPelanggan: 'JEMBER',
    keterangan: 'Lunas Tunai',
    netDays: 0,
    paymentCategory: 'COD',
    isManualSbu: false,
    metodeBayarAktual: 'Tunai',
    nominalDiterima: 852870,
    driverEditCount: 1,
    lockedGpsLat: -8.168920,
    lockedGpsLng: 113.701180,
    lockedGpsAccuracy: 11,
    lockedGpsLocation: 'JEMBER KOTA',
    lockedGpsAt: '2026-11-16T10:05:30.000Z',
    gpsLockHistory: [
      {
        attemptNumber: 1,
        label: 'GPS Awal',
        lat: -8.168920,
        lng: 113.701180,
        accuracy: 11,
        locationName: 'JEMBER KOTA',
        savedAt: '2026-11-16T10:05:30.000Z',
        savedTimeWib: '17.05 WIB',
        savedBy: 'Rizky Pratama',
        savedRole: 'Helper',
        paymentMethod: 'TUNAI',
        nominalDiterima: 852870,
        summary: 'Simpan Tunai • Rp 852.870'
      }
    ]
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

const SAMPLE_GROSIR4_DS4_INVOICE_ITEMS: FormKirimInvoiceItem[] = [
  // COD (1 Pelanggan: TK SETIA A / P. SUGITO - 3 Faktur)
  {
    id: 'fki-ds4-1107-1',
    noFaktur: 'FJ02-1126-0631',
    tglFaktur: '07 Nop 2026',
    namaPelanggan: 'TK SETIA A / P. SUGITO',
    nilaiFaktur: 1245000,
    coly: 4,
    bayar: '',
    alamatPelanggan: 'ROGOJAMPI - BANYUWANGI',
    keterangan: '',
    netDays: 0,
    paymentCategory: 'COD',
    isManualSbu: false
  },
  {
    id: 'fki-ds4-1107-2',
    noFaktur: 'FJ02-1126-0607',
    tglFaktur: '07 Nop 2026',
    namaPelanggan: 'TK SETIA A / P. SUGITO',
    nilaiFaktur: 980000,
    coly: 3,
    bayar: '',
    alamatPelanggan: 'ROGOJAMPI - BANYUWANGI',
    keterangan: '',
    netDays: 0,
    paymentCategory: 'COD',
    isManualSbu: false
  },
  {
    id: 'fki-ds4-1107-3',
    noFaktur: 'FJ02B-1126-0587',
    tglFaktur: '07 Nop 2026',
    namaPelanggan: 'TK SETIA A / P. SUGITO',
    nilaiFaktur: 650000,
    coly: 2,
    bayar: '',
    alamatPelanggan: 'ROGOJAMPI - BANYUWANGI',
    keterangan: '',
    netDays: 0,
    paymentCategory: 'COD',
    isManualSbu: false
  },
  // TEMPO (7 Pelanggan - 17 Faktur)
  {
    id: 'fki-ds4-1107-4',
    noFaktur: 'FJ02BS-1126-0079',
    tglFaktur: '07 Nop 2026',
    namaPelanggan: 'BP MALIK SANGGAR',
    nilaiFaktur: 1420000,
    coly: 5,
    bayar: '',
    alamatPelanggan: 'PESANGGARAN / SANGGAR - BANYUWANGI',
    keterangan: '',
    netDays: 14,
    paymentCategory: 'TEMPO',
    isManualSbu: false
  },
  {
    id: 'fki-ds4-1107-5',
    noFaktur: 'FJ02-1126-0632',
    tglFaktur: '07 Nop 2026',
    namaPelanggan: 'BP MALIK SANGGAR',
    nilaiFaktur: 1150000,
    coly: 4,
    bayar: '',
    alamatPelanggan: 'PESANGGARAN / SANGGAR - BANYUWANGI',
    keterangan: '',
    netDays: 14,
    paymentCategory: 'TEMPO',
    isManualSbu: false
  },
  {
    id: 'fki-ds4-1107-6',
    noFaktur: 'FJ03-1126-1242',
    tglFaktur: '06 Nop 2026',
    namaPelanggan: 'BP MALIK SANGGAR',
    nilaiFaktur: 890000,
    coly: 3,
    bayar: '',
    alamatPelanggan: 'PESANGGARAN / SANGGAR - BANYUWANGI',
    keterangan: '',
    netDays: 14,
    paymentCategory: 'TEMPO',
    isManualSbu: true
  },
  {
    id: 'fki-ds4-1107-7',
    noFaktur: 'FJ02-1126-0606',
    tglFaktur: '07 Nop 2026',
    namaPelanggan: 'BP ROBIN',
    nilaiFaktur: 1320000,
    coly: 4,
    bayar: '',
    alamatPelanggan: 'JAJAG / GAMBIRAN - BANYUWANGI',
    keterangan: '',
    netDays: 14,
    paymentCategory: 'TEMPO',
    isManualSbu: false
  },
  {
    id: 'fki-ds4-1107-8',
    noFaktur: 'FJ02-1126-0605',
    tglFaktur: '07 Nop 2026',
    namaPelanggan: 'BP ROBIN',
    nilaiFaktur: 940000,
    coly: 3,
    bayar: '',
    alamatPelanggan: 'JAJAG / GAMBIRAN - BANYUWANGI',
    keterangan: '',
    netDays: 14,
    paymentCategory: 'TEMPO',
    isManualSbu: false
  },
  {
    id: 'fki-ds4-1107-9',
    noFaktur: 'FJ02-1126-0602',
    tglFaktur: '07 Nop 2026',
    namaPelanggan: 'BP ROBIN',
    nilaiFaktur: 760000,
    coly: 2,
    bayar: '',
    alamatPelanggan: 'JAJAG / GAMBIRAN - BANYUWANGI',
    keterangan: '',
    netDays: 14,
    paymentCategory: 'TEMPO',
    isManualSbu: false
  },
  {
    id: 'fki-ds4-1107-10',
    noFaktur: 'FJ02B-1126-0586',
    tglFaktur: '07 Nop 2026',
    namaPelanggan: 'TK AMBULU',
    nilaiFaktur: 1580000,
    coly: 5,
    bayar: '',
    alamatPelanggan: 'GAMBIRAN / GENTENG - BANYUWANGI',
    keterangan: '',
    netDays: 14,
    paymentCategory: 'TEMPO',
    isManualSbu: false
  },
  {
    id: 'fki-ds4-1107-11',
    noFaktur: 'FJ02B-1126-0127',
    tglFaktur: '07 Nop 2026',
    namaPelanggan: 'TK ANEKA PEDOTAN',
    nilaiFaktur: 1120000,
    coly: 4,
    bayar: '',
    alamatPelanggan: 'PEDOTAN / BANGOREJO - BANYUWANGI',
    keterangan: '',
    netDays: 14,
    paymentCategory: 'TEMPO',
    isManualSbu: false
  },
  {
    id: 'fki-ds4-1107-12',
    noFaktur: 'FJ02-1126-0568',
    tglFaktur: '07 Nop 2026',
    namaPelanggan: 'TK ANEKA PEDOTAN',
    nilaiFaktur: 840000,
    coly: 3,
    bayar: '',
    alamatPelanggan: 'PEDOTAN / BANGOREJO - BANYUWANGI',
    keterangan: '',
    netDays: 14,
    paymentCategory: 'TEMPO',
    isManualSbu: false
  },
  {
    id: 'fki-ds4-1107-13',
    noFaktur: 'FJ02-1126-0651',
    tglFaktur: '07 Nop 2026',
    namaPelanggan: 'TK ANEKA PEDOTAN',
    nilaiFaktur: 910000,
    coly: 3,
    bayar: '',
    alamatPelanggan: 'PEDOTAN / BANGOREJO - BANYUWANGI',
    keterangan: '',
    netDays: 14,
    paymentCategory: 'TEMPO',
    isManualSbu: false
  },
  {
    id: 'fki-ds4-1107-14',
    noFaktur: 'FJ02-1126-0608',
    tglFaktur: '07 Nop 2026',
    namaPelanggan: 'TK HOLLY - BENCULUK',
    nilaiFaktur: 1340000,
    coly: 4,
    bayar: '',
    alamatPelanggan: 'BENCULUK / CLURING - BANYUWANGI',
    keterangan: '',
    netDays: 14,
    paymentCategory: 'TEMPO',
    isManualSbu: false
  },
  {
    id: 'fki-ds4-1107-15',
    noFaktur: 'FJ02B-1126-0588',
    tglFaktur: '07 Nop 2026',
    namaPelanggan: 'TK HOLLY - BENCULUK',
    nilaiFaktur: 780000,
    coly: 2,
    bayar: '',
    alamatPelanggan: 'BENCULUK / CLURING - BANYUWANGI',
    keterangan: '',
    netDays: 14,
    paymentCategory: 'TEMPO',
    isManualSbu: false
  },
  {
    id: 'fki-ds4-1107-16',
    noFaktur: 'FJ02-1126-0599',
    tglFaktur: '07 Nop 2026',
    namaPelanggan: 'TK SUJIONO PLASTIK',
    nilaiFaktur: 1460000,
    coly: 5,
    bayar: '',
    alamatPelanggan: 'YOSOWINANGUN / JAJAG - BANYUWANGI',
    keterangan: '',
    netDays: 14,
    paymentCategory: 'TEMPO',
    isManualSbu: false
  },
  {
    id: 'fki-ds4-1107-17',
    noFaktur: 'FJ02BS-1126-0070',
    tglFaktur: '07 Nop 2026',
    namaPelanggan: 'TK SUJIONO PLASTIK',
    nilaiFaktur: 920000,
    coly: 3,
    bayar: '',
    alamatPelanggan: 'YOSOWINANGUN / JAJAG - BANYUWANGI',
    keterangan: '',
    netDays: 14,
    paymentCategory: 'TEMPO',
    isManualSbu: false
  },
  {
    id: 'fki-ds4-1107-18',
    noFaktur: 'FJ02-1126-0636',
    tglFaktur: '07 Nop 2026',
    namaPelanggan: 'TK SUMBER BERKAT - SANGGAR',
    nilaiFaktur: 1620000,
    coly: 5,
    bayar: '',
    alamatPelanggan: 'PESANGGARAN / SANGGAR - BANYUWANGI',
    keterangan: '',
    netDays: 14,
    paymentCategory: 'TEMPO',
    isManualSbu: false
  },
  {
    id: 'fki-ds4-1107-19',
    noFaktur: 'FJ02BS-1126-0082',
    tglFaktur: '07 Nop 2026',
    namaPelanggan: 'TK SUMBER BERKAT - SANGGAR',
    nilaiFaktur: 1180000,
    coly: 4,
    bayar: '',
    alamatPelanggan: 'PESANGGARAN / SANGGAR - BANYUWANGI',
    keterangan: '',
    netDays: 14,
    paymentCategory: 'TEMPO',
    isManualSbu: false
  },
  {
    id: 'fki-ds4-1107-20',
    noFaktur: 'FJ03-1126-1249',
    tglFaktur: '06 Nop 2026',
    namaPelanggan: 'TK SUMBER BERKAT - SANGGAR',
    nilaiFaktur: 950000,
    coly: 3,
    bayar: '',
    alamatPelanggan: 'PESANGGARAN / SANGGAR - BANYUWANGI',
    keterangan: '',
    netDays: 14,
    paymentCategory: 'TEMPO',
    isManualSbu: true
  }
];

const INITIAL_FORM_KIRIM: FormKirimRecord[] = [
  {
    id: 'FK-20261107-DS4',
    noFormKirim: 'FK/AKK/2026/11/007',
    noFaktur: 'FJ02-1126-0631 s/d FJ03-1126-1249 (20 Faktur)',
    noSuratJalan: 'SJ-AKK-261107-GRS4',
    branchName: 'Cabang Nusantara',
    sbuTitle: 'ANUGRAH KEMASAN KREATIF',
    periodLabel: 'Dari 07 Nop 2026 ke 07 Nop 2026',
    areaKirim: 'GROSIR 4',
    tanggalKirim: '2026-11-07',
    storeName: 'AREA GROSIR 4 (8 Pelanggan • 3 COD • 17 TEMPO)',
    storeAddress: 'Rute Distribusi Grosir 4 (Rogojampi, Benculuk, Jajag, Pedotan, Pesanggaran)',
    storePhone: '-',
    fleetId: 'flt-11',
    plateNumber: 'W 8229 US',
    armadaInitial: 'DS4/NMR',
    vehicleType: 'Double STD',
    driverName: 'Ach Taufiq',
    helperName: 'Aan Adi Saputra',
    itemsSummary: '8 Pelanggan (20 Faktur: 3 COD • 17 TEMPO)',
    totalColli: 71,
    totalNominalFaktur: 23055000,
    sisaPiutangToko: 20180000,
    metodePembayaran: 'COD & Tempo (Gabungan)',
    createdByAdmin: 'Admin Penjualan',
    createdAt: '2026-11-07T07:30:00.000Z',
    salesNotes: 'Form Pengiriman Area GROSIR 4 • MOBIL: DS4/NMR • PENGIRIM: TAUFIK - AAN • TOTAL CUSTOMER: 8',
    financeStatus: 'approved_finance',
    validatedByFinance: 'Staf Finance AKK',
    validatedAt: '2026-11-07T07:45:00.000Z',
    financeNotes: 'Data faktur COD & Tempo sesuai (8 Customer), diteruskan ke Portal Driver & Validasi GPS.',
    driverStatus: 'ready_for_driver',
    invoiceItems: SAMPLE_GROSIR4_DS4_INVOICE_ITEMS,
    codCount: 3,
    tempoCount: 17,
    codTotalNominal: 2875000,
    tempoTotalNominal: 20180000
  },
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
      financeItemNote: inc.financeItemNote || prev.financeItemNote,
      driverEditCount: inc.driverEditCount !== undefined ? inc.driverEditCount : prev.driverEditCount,
      customerNote: inc.customerNote !== undefined ? inc.customerNote : prev.customerNote,
      gpsLockHistory:
        Array.isArray(inc.gpsLockHistory) && inc.gpsLockHistory.length > 0
          ? inc.gpsLockHistory
          : prev.gpsLockHistory,
      lockedGpsLat: inc.lockedGpsLat !== undefined ? inc.lockedGpsLat : prev.lockedGpsLat,
      lockedGpsLng: inc.lockedGpsLng !== undefined ? inc.lockedGpsLng : prev.lockedGpsLng,
      lockedGpsAccuracy: inc.lockedGpsAccuracy !== undefined ? inc.lockedGpsAccuracy : prev.lockedGpsAccuracy,
      lockedGpsLocation: inc.lockedGpsLocation || prev.lockedGpsLocation,
      lockedGpsAt: inc.lockedGpsAt || prev.lockedGpsAt
    };
  });
}

export interface FormKirimWorkspaceState {
  selectedAreaKirim: string;
  tanggalKirim: string;
  activeSavedRecordId: string | null;
  viewMode: 'edit' | 'saved_preview';
  invoiceItems: FormKirimInvoiceItem[];
  updatedAt?: string;
}

class FormKirimStore {
  private records: FormKirimRecord[] = INITIAL_FORM_KIRIM;
  private workspace: FormKirimWorkspaceState | null = null;
  private listeners: Set<() => void> = new Set();
  private hydratedFromServer = false;
  private isHydrating = false;
  private lastHydrateAt = 0;
  private rateLimitedUntil = 0;
  private workspaceSaveTimer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    if (typeof window !== 'undefined') {
      try {
        localStorage.removeItem(STORAGE_KEY);
        localStorage.removeItem('akk_form_kirim_workspace_v1');
      } catch {
        // ignore
      }
      window.addEventListener(EVENT_NAME, () => {
        this.listeners.forEach(cb => cb());
      });
      void this.hydrateFromServer(true, true);
    }
  }

  public async hydrateFromServer(force = false, bypassCooldown = false): Promise<void> {
    if (this.hydratedFromServer && !force) return;
    if (this.isHydrating) return;
    const now = Date.now();
    if (!bypassCooldown && now < this.rateLimitedUntil) return;
    if (!bypassCooldown && this.lastHydrateAt > 0 && now - this.lastHydrateAt < 3000) return;
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
      if (data && data.success) {
        let shouldNotify = false;
        if (
          data.workspace &&
          typeof data.workspace === 'object' &&
          Array.isArray(data.workspace.invoiceItems)
        ) {
          this.workspace = data.workspace;
          shouldNotify = true;
        }
        if (Array.isArray(data.records)) {
          const cleaned = data.records.filter(
            (r: FormKirimRecord) => r && !LEGACY_DUMMY_FORM_KIRIM_IDS.has(r.id)
          );
          if (cleaned.length > 0) {
            const existingIds = new Set(cleaned.map((r: FormKirimRecord) => r.id));
            const missingSeed = INITIAL_FORM_KIRIM.filter(s => !existingIds.has(s.id));
            this.records = [...cleaned, ...missingSeed];
            shouldNotify = true;
            if (missingSeed.length > 0) {
              this.saveAll(this.records);
            }
          } else if (this.records.length > 0) {
            // Seed initial Form Kirim to MySQL server if server has no records yet
            this.saveAll(this.records);
          }
        }
        if (shouldNotify) {
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
    return this.records;
  }

  public getWorkspace(): FormKirimWorkspaceState | null {
    return this.workspace;
  }

  public saveWorkspace(nextWorkspace: FormKirimWorkspaceState, immediate = false): void {
    const stamped: FormKirimWorkspaceState = {
      selectedAreaKirim: String(nextWorkspace.selectedAreaKirim || '').trim().toUpperCase(),
      tanggalKirim: String(nextWorkspace.tanggalKirim || '').trim(),
      activeSavedRecordId: nextWorkspace.activeSavedRecordId || null,
      viewMode: nextWorkspace.viewMode === 'saved_preview' ? 'saved_preview' : 'edit',
      invoiceItems: Array.isArray(nextWorkspace.invoiceItems) ? nextWorkspace.invoiceItems : [],
      updatedAt: new Date().toISOString()
    };
    this.workspace = stamped;

    if (typeof window === 'undefined') return;

    const pushToMySql = () => {
      fetch('/api/form-kirim/workspace', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workspace: stamped })
      })
        .then(async res => {
          if (!res.ok) return;
          const data = await res.json().catch(() => null);
          if (data?.success && Array.isArray(data.records)) {
            const cleaned = data.records.filter(
              (r: FormKirimRecord) => r && !LEGACY_DUMMY_FORM_KIRIM_IDS.has(r.id)
            );
            this.records = cleaned;
          }
        })
        .catch(() => {});
    };

    if (this.workspaceSaveTimer) {
      clearTimeout(this.workspaceSaveTimer);
      this.workspaceSaveTimer = null;
    }

    if (immediate) {
      pushToMySql();
    } else {
      this.workspaceSaveTimer = setTimeout(pushToMySql, 350);
    }
  }

  private persistLocal(records: FormKirimRecord[]): void {
    this.records = records.filter(
      (r: FormKirimRecord) => r && !LEGACY_DUMMY_FORM_KIRIM_IDS.has(r.id)
    );
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent(EVENT_NAME));
    }
    this.listeners.forEach(cb => cb());
  }

  private saveAll(records: FormKirimRecord[], workspaceOverride?: FormKirimWorkspaceState): void {
    this.persistLocal(records);
    if (workspaceOverride) {
      this.workspace = {
        ...workspaceOverride,
        updatedAt: new Date().toISOString()
      };
    }
    if (typeof window !== 'undefined') {
      fetch('/api/form-kirim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          records: this.records,
          ...(this.workspace ? { workspace: this.workspace } : {})
        })
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

    const nextWorkspace: FormKirimWorkspaceState = {
      selectedAreaKirim: String(record.areaKirim || '').trim().toUpperCase(),
      tanggalKirim: String(record.tanggalKirim || '').trim(),
      activeSavedRecordId: record.id,
      viewMode: 'saved_preview',
      invoiceItems: Array.isArray(record.invoiceItems) ? record.invoiceItems : [],
      updatedAt: new Date().toISOString()
    };

    this.saveAll([record, ...existing], nextWorkspace);
    return record;
  }

  public updateFormKirim(id: string, patch: Partial<FormKirimRecord>): void {
    const existing = this.getAll();
    let updatedTarget: FormKirimRecord | null = null;
    const updated = existing.map(item => {
      if (item.id !== id) return item;
      const mergedItems = patch.invoiceItems
        ? preserveProgressWhenAdminUpdates(patch.invoiceItems, item.invoiceItems)
        : item.invoiceItems;
      const nextRec = {
        ...item,
        ...patch,
        invoiceItems: mergedItems
      };
      updatedTarget = nextRec;
      return nextRec;
    });

    const nextWorkspace: FormKirimWorkspaceState | undefined = updatedTarget
      ? {
          selectedAreaKirim: String((updatedTarget as FormKirimRecord).areaKirim || '').trim().toUpperCase(),
          tanggalKirim: String((updatedTarget as FormKirimRecord).tanggalKirim || '').trim(),
          activeSavedRecordId: id,
          viewMode: 'saved_preview',
          invoiceItems: Array.isArray((updatedTarget as FormKirimRecord).invoiceItems)
            ? (updatedTarget as FormKirimRecord).invoiceItems!
            : [],
          updatedAt: new Date().toISOString()
        }
      : undefined;

    this.saveAll(updated, nextWorkspace);
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

  public deleteInvoiceFromFormKirim(formKirimId: string, invoiceId: string): void {
    const existing = this.getAll();
    const updated = existing
      .map(record => {
        if (record.id !== formKirimId) return record;
        const nextItems = (record.invoiceItems || []).filter(inv => inv.id !== invoiceId);
        if (nextItems.length === 0) return null;
        const nextTotalNilai = nextItems.reduce((sum, it) => sum + (Number(it.nilaiFaktur) || 0), 0);
        const nextTotalDiterima = nextItems.reduce((sum, it) => sum + (Number(it.nominalDiterima) || 0), 0);
        return {
          ...record,
          invoiceItems: nextItems,
          totalNominalFaktur: nextTotalNilai,
          totalNominalDiterima: nextTotalDiterima
        };
      })
      .filter((r): r is FormKirimRecord => r !== null);
    this.saveAll(updated);
  }

  public clearCustomerGpsHistory(formKirimId: string, itemIds: string[]): void {
    const idSet = new Set(itemIds);
    const nowIso = new Date().toISOString();
    const existing = this.getAll();
    let patchedItems: FormKirimInvoiceItem[] | undefined;
    const updated = existing.map(record => {
      if (record.id !== formKirimId || !record.invoiceItems) return record;
      const nextItems = record.invoiceItems.map(it => {
        if (!idSet.has(it.id)) return it;
        return {
          ...it,
          driverUpdatedAt: nowIso,
          gpsLockHistory: [],
          lockedGpsLat: undefined,
          lockedGpsLng: undefined,
          lockedGpsAccuracy: undefined,
          lockedGpsLocation: undefined,
          lockedGpsAt: undefined
        };
      });
      patchedItems = nextItems;
      return {
        ...record,
        driverUpdatedAt: nowIso,
        invoiceItems: nextItems
      };
    });
    this.persistLocal(updated);
    if (patchedItems) {
      this.syncDriverPatch(
        formKirimId,
        { invoiceItems: patchedItems, driverUpdatedAt: nowIso },
        updated
      );
    } else {
      this.saveAll(updated);
    }
  }

  public syncChecklistOdometer(params: {
    date?: string;
    plateNumber?: string;
    driverName?: string;
    areaName?: string;
    inspectionType: 'pre_trip' | 'post_trip';
    odometerKm: number;
    recordedAt?: string;
  }): void {
    const km = Number(params.odometerKm);
    if (!Number.isFinite(km) || km <= 0) return;

    const existing = this.getAll();
    if (existing.length === 0) return;

    const nowIso = params.recordedAt || new Date().toISOString();
    const targetDate = String(params.date || '').slice(0, 10);
    const normPlate = (v?: string) => String(v || '').replace(/\s+/g, '').toLowerCase();
    const normText = (v?: string) => String(v || '').trim().toLowerCase().replace(/\s+/g, ' ');

    const reqPlate = normPlate(params.plateNumber);
    const reqDriver = normText(params.driverName);
    const reqArea = normText(params.areaName);

    const matchedIds: string[] = [];
    const updated = existing.map(record => {
      const recDate = String(record.tanggalKirim || '').slice(0, 10);
      const dateOk = !targetDate || !recDate || recDate === targetDate;
      if (!dateOk) return record;

      const plateMatch = Boolean(reqPlate && reqPlate !== '-' && normPlate(record.plateNumber) === reqPlate);
      const driverMatch = Boolean(
        reqDriver &&
          record.driverName &&
          (normText(record.driverName).includes(reqDriver) || reqDriver.includes(normText(record.driverName)))
      );
      const areaMatch = Boolean(
        reqArea &&
          (record.areaKirim || record.storeName) &&
          (normText(record.areaKirim || record.storeName).includes(reqArea) ||
            reqArea.includes(normText(record.areaKirim || record.storeName)))
      );

      if (!plateMatch && !driverMatch && !areaMatch) return record;

      matchedIds.push(record.id);
      if (params.inspectionType === 'pre_trip') {
        return {
          ...record,
          kmPagi: km,
          kmPagiRecordedAt: nowIso
        };
      }
      return {
        ...record,
        kmPulang: km,
        kmPulangRecordedAt: nowIso
      };
    });

    if (matchedIds.length === 0) return;

    this.persistLocal(updated);
    matchedIds.forEach(id => {
      const patch: Partial<FormKirimRecord> =
        params.inspectionType === 'pre_trip'
          ? { kmPagi: km, kmPagiRecordedAt: nowIso }
          : { kmPulang: km, kmPulangRecordedAt: nowIso };
      this.syncDriverPatch(id, patch, updated);
    });
  }
}

export const formKirimStore = new FormKirimStore();
