import React, { useState, useEffect, useMemo } from 'react';
import {
  Award,
  ShieldAlert,
  TrendingUp,
  Percent,
  User,
  RefreshCw,
  AlertTriangle,
  Building,
  FileText,
  CheckCircle,
  CheckCircle2,
  Download,
  ShoppingBag,
  Calendar,
  Star,
  Users,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Upload,
  FileSpreadsheet,
  Plus,
  Trash2,
  Eye,
  Save,
  MapPin,
  Package,
  RotateCcw,
  Trophy,
  BadgePercent
} from 'lucide-react';
import {
  ResponsiveContainer,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  PieChart,
  Pie,
  Cell,
  Legend,
  ComposedChart,
  Line,
  CartesianGrid
} from 'recharts';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas-pro';
import * as XLSX from 'xlsx';
import { logisticsStore } from '../../services/store';
import { branchStore } from '../../services/branchStore';
import { useToast } from '../../context/ToastContext';
import {
  useSalesAdminUsers,
  getSalesAdminAssignedBranchId,
  MONTH_OPTIONS,
  YEAR_OPTIONS,
  SALES_BRANCH_OPTIONS
} from './SalesHeaderFilter';
import { OFFICIAL_DESTINATION_AREAS } from '../../utils/areaNormalizer';

// ============================================================================
// INTERFACES & TYPES
// ============================================================================

export interface AdminIndividualKpiRecord {
  id: string;
  adminName: string;
  branchId: string; // 'cab-banyuwangi' | 'cab-sidoarjo'
  month: string;
  year: string;
  validasiSoWeb: number; // % Validasi Sales Order & Website
  pembuatanFaktur: number; // % Pembuatan Faktur Penjualan
  pengecekanFaktur: number; // % Pengecekan Faktur Penjualan
  discountErrorsCount: number; // Jumlah kesalahan penginputan diskon (kali)
  totalOrders: number;
  notes?: string;
}

export interface DiscountErrorLogItem {
  id: string;
  date: string;
  branchId: string;
  month: string;
  year: string;
  adminName: string;
  noFakturOrSo: string;
  customerName: string;
  expectedDiscount: number; // % atau Rp
  inputDiscount: number; // % atau Rp
  selisihNominal: number; // Rp
  keterangan: string;
}

export interface DendaCheckerRecord {
  id: string;
  branchId: string;
  month: string;
  year: string;
  adminName: string; // Nama
  customerName: string; // Nama Pelanggan
  noFaktur: string; // No Faktur
  keterangan: string; // Keterangan
  nominalSelisih: number; // Nominal Selisih (Rp)
  kalianSelisih: number; // Kali-an Selisih (pengali)
  totalDenda: number; // Nominal Selisih * Kalian Selisih
}

export interface ReorderWeeklyItem {
  id: string;
  unit: 'Nusantara Dr. Soetomo' | 'Nusantara Expand';
  weekLabel: string; // 'Minggu 1' | 'Minggu 2' | 'Minggu 3' | 'Minggu 4'
  month: string;
  year: string;
  totalReorder: number; // Total Reorder Mingguan (SO Masuk)
  terkirimFaktur: number; // Total Barang Sudah Terkirim (Faktur)
  belumTerkirimSo: number; // Total Barang Belum Terkirim (SO Menunggu)
}

export interface AdminOmsetRow {
  id: string;
  adminName: string;
  branchId: string;
  branchCode: 'BWI' | 'SDA';
  month: string;
  year: string;
  kota: string;
  area: string;
  omzetNetto: number;
  bruto: number;
  returNominal: number;
  qtyNetto: number;
  returQty: number;
  targetNominal: number;
  lastMonthOmzet: number;
  lastMonthQty: number;
}

interface SalesKpiProps {
  defaultTab?: string;
  onChangeTab?: (tab: string) => void;
}

// ============================================================================
// DEFAULT BRANCH-SEPARATED ADMIN NAMES FALLBACK (IF USER MGMT HAS ONLY 1 USER)
// ============================================================================
const DEFAULT_NUSANTARA_ADMINS = [
  'MEINDA MAULINA',
  'BINTANG MEDITA SARI',
  'FATAUDIN RIFKY MAULANA',
  'PIPIT ISTIANI',
  'IZZUL BAHRUL HISAM',
  'MUHAMMAD SHOIM'
];

const DEFAULT_SIDOARJO_ADMINS = [
  'NADIA PUTRI SIDOARJO',
  'RINA WIJAYA SIDOARJO',
  'DEVI LESTARI SIDOARJO',
  'BUDI SANTOSO SIDOARJO'
];

const LS_KPI_INDIVIDUAL_KEY = 'akk_sales_kpi_individual_v3';
const LS_DISCOUNT_ERRORS_KEY = 'akk_sales_kpi_discount_errors_v3';
const LS_DENDA_CHECKER_KEY = 'akk_sales_kpi_denda_checker_v3';
const LS_REORDER_EVAL_KEY = 'akk_sales_kpi_reorder_eval_v3';
const LS_ADMIN_OMSET_KEY = 'akk_sales_kpi_admin_omset_v3';

function parseNum(raw: any): number {
  if (typeof raw === 'number' && Number.isFinite(raw)) return raw;
  if (raw === null || raw === undefined) return 0;
  let s = String(raw).trim();
  if (!s) return 0;
  s = s.replace(/^[Rr][Pp]\.?\s*/g, '').replace(/[xX%]$/g, '').replace(/\s+/g, '');
  if (/^-?\d{1,3}(\.\d{3})+(,\d+)?$/.test(s)) {
    s = s.replace(/\./g, '').replace(',', '.');
  } else if (/^-?\d+(,\d+)$/.test(s)) {
    s = s.replace(',', '.');
  } else {
    s = s.replace(/,/g, '');
  }
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
}

function formatRp(val: number): string {
  return Math.round(Number(val) || 0).toLocaleString('id-ID');
}

function formatQtyId(val: number): string {
  return (Number(val) || 0).toLocaleString('id-ID', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

// ============================================================================
// INITIAL SEED GENERATORS
// ============================================================================

function buildInitialIndividualKpi(
  nusantaraAdmins: string[],
  sidoarjoAdmins: string[],
  month: string,
  year: string
): AdminIndividualKpiRecord[] {
  const bwiPresets = [
    { validasiSoWeb: 96, pembuatanFaktur: 98, pengecekanFaktur: 97, discountErrorsCount: 0, totalOrders: 423 },
    { validasiSoWeb: 95, pembuatanFaktur: 96, pengecekanFaktur: 95, discountErrorsCount: 1, totalOrders: 499 },
    { validasiSoWeb: 94, pembuatanFaktur: 95, pengecekanFaktur: 96, discountErrorsCount: 1, totalOrders: 458 },
    { validasiSoWeb: 92, pembuatanFaktur: 94, pengecekanFaktur: 93, discountErrorsCount: 2, totalOrders: 306 },
    { validasiSoWeb: 91, pembuatanFaktur: 92, pengecekanFaktur: 94, discountErrorsCount: 1, totalOrders: 284 },
    { validasiSoWeb: 89, pembuatanFaktur: 91, pengecekanFaktur: 90, discountErrorsCount: 3, totalOrders: 265 }
  ];
  const sdaPresets = [
    { validasiSoWeb: 95, pembuatanFaktur: 97, pengecekanFaktur: 96, discountErrorsCount: 0, totalOrders: 390 },
    { validasiSoWeb: 93, pembuatanFaktur: 94, pengecekanFaktur: 95, discountErrorsCount: 1, totalOrders: 355 },
    { validasiSoWeb: 91, pembuatanFaktur: 92, pengecekanFaktur: 93, discountErrorsCount: 2, totalOrders: 312 },
    { validasiSoWeb: 88, pembuatanFaktur: 90, pengecekanFaktur: 89, discountErrorsCount: 2, totalOrders: 278 }
  ];

  const records: AdminIndividualKpiRecord[] = [];
  nusantaraAdmins.forEach((name, idx) => {
    const p = bwiPresets[idx % bwiPresets.length];
    records.push({
      id: `kpi-bwi-${idx + 1}`,
      adminName: name.toUpperCase(),
      branchId: 'cab-banyuwangi',
      month,
      year,
      validasiSoWeb: p.validasiSoWeb,
      pembuatanFaktur: p.pembuatanFaktur,
      pengecekanFaktur: p.pengecekanFaktur,
      discountErrorsCount: p.discountErrorsCount,
      totalOrders: p.totalOrders,
      notes: 'Evaluasi KPI Bulanan Cabang Nusantara'
    });
  });

  sidoarjoAdmins.forEach((name, idx) => {
    const p = sdaPresets[idx % sdaPresets.length];
    records.push({
      id: `kpi-sda-${idx + 1}`,
      adminName: name.toUpperCase(),
      branchId: 'cab-sidoarjo',
      month,
      year,
      validasiSoWeb: p.validasiSoWeb,
      pembuatanFaktur: p.pembuatanFaktur,
      pengecekanFaktur: p.pengecekanFaktur,
      discountErrorsCount: p.discountErrorsCount,
      totalOrders: p.totalOrders,
      notes: 'Evaluasi KPI Bulanan Cabang Sidoarjo'
    });
  });

  return records;
}

function buildInitialDiscountErrors(
  nusantaraAdmins: string[],
  sidoarjoAdmins: string[],
  month: string,
  year: string
): DiscountErrorLogItem[] {
  const b0 = nusantaraAdmins[1] || 'BINTANG MEDITA SARI';
  const b1 = nusantaraAdmins[3] || 'MEINDA MAULINA';
  const s0 = sidoarjoAdmins[1] || 'RINA WIJAYA SIDOARJO';
  return [
    {
      id: 'dsc-1',
      date: '2026-11-05',
      branchId: 'cab-banyuwangi',
      month,
      year,
      adminName: b0,
      noFakturOrSo: 'FJ02-1126-0412',
      customerName: 'TK ANEKA BARU SRONO',
      expectedDiscount: 3,
      inputDiscount: 5,
      selisihNominal: 94800,
      keterangan: 'Salah input diskon tier grosir 5% (seharusnya 3%)'
    },
    {
      id: 'dsc-2',
      date: '2026-11-09',
      branchId: 'cab-banyuwangi',
      month,
      year,
      adminName: b1,
      noFakturOrSo: 'FJ02-1126-0819',
      customerName: 'TK SINAR OKKI MUNCAR',
      expectedDiscount: 2,
      inputDiscount: 4,
      selisihNominal: 62500,
      keterangan: 'Diskon promo plastik HD terinput ganda pada SO'
    },
    {
      id: 'dsc-3',
      date: '2026-11-11',
      branchId: 'cab-sidoarjo',
      month,
      year,
      adminName: s0,
      noFakturOrSo: 'FJ01-1126-0295',
      customerName: 'CV DEWI SRI MAJU',
      expectedDiscount: 2.5,
      inputDiscount: 5,
      selisihNominal: 125000,
      keterangan: 'Salah pilih kode diskon kontrak karton box'
    }
  ];
}

function buildInitialDendaChecker(
  nusantaraAdmins: string[],
  sidoarjoAdmins: string[],
  month: string,
  year: string
): DendaCheckerRecord[] {
  const b0 = nusantaraAdmins[0] || 'MEINDA MAULINA';
  const b1 = nusantaraAdmins[1] || 'BINTANG MEDITA SARI';
  const b2 = nusantaraAdmins[2] || 'FATAUDIN RIFKY MAULANA';
  const s0 = sidoarjoAdmins[0] || 'NADIA PUTRI SIDOARJO';
  return [
    {
      id: 'dc-1',
      branchId: 'cab-banyuwangi',
      month,
      year,
      adminName: b0,
      customerName: 'TK BELLIA SUMBER AYU',
      noFaktur: 'FJ02-1126-1080',
      keterangan: 'Selisih pengecekan qty mika AG B3A pada faktur vs fisik',
      nominalSelisih: 25000,
      kalianSelisih: 2,
      totalDenda: 50000
    },
    {
      id: 'dc-2',
      branchId: 'cab-banyuwangi',
      month,
      year,
      adminName: b1,
      customerName: 'TK ANUGRAH SEKAR WANGI',
      noFaktur: 'FJ02-1126-0799',
      keterangan: 'Salah input harga satuan sendok bebek di faktur penjualan',
      nominalSelisih: 50000,
      kalianSelisih: 2,
      totalDenda: 100000
    },
    {
      id: 'dc-3',
      branchId: 'cab-banyuwangi',
      month,
      year,
      adminName: b2,
      customerName: 'TK TUMBUH JAYA MUNCAR',
      noFaktur: 'FJ02-1126-1064',
      keterangan: 'Kurang potong diskon retur barang pada nota tagihan',
      nominalSelisih: 30000,
      kalianSelisih: 1,
      totalDenda: 30000
    },
    {
      id: 'dc-4',
      branchId: 'cab-sidoarjo',
      month,
      year,
      adminName: s0,
      customerName: 'PT BARES GROSIR SATU',
      noFaktur: 'FJ01-1126-0512',
      keterangan: 'Selisih verifikasi coly surat jalan muat Sidoarjo',
      nominalSelisih: 40000,
      kalianSelisih: 2,
      totalDenda: 80000
    }
  ];
}

function buildInitialReorderEval(month: string, year: string): ReorderWeeklyItem[] {
  return [
    // Nusantara Dr. Soetomo
    {
      id: 'reo-ds-1',
      unit: 'Nusantara Dr. Soetomo',
      weekLabel: 'Minggu 1',
      month,
      year,
      totalReorder: 420,
      terkirimFaktur: 365,
      belumTerkirimSo: 55
    },
    {
      id: 'reo-ds-2',
      unit: 'Nusantara Dr. Soetomo',
      weekLabel: 'Minggu 2',
      month,
      year,
      totalReorder: 460,
      terkirimFaktur: 405,
      belumTerkirimSo: 55
    },
    {
      id: 'reo-ds-3',
      unit: 'Nusantara Dr. Soetomo',
      weekLabel: 'Minggu 3',
      month,
      year,
      totalReorder: 490,
      terkirimFaktur: 432,
      belumTerkirimSo: 58
    },
    {
      id: 'reo-ds-4',
      unit: 'Nusantara Dr. Soetomo',
      weekLabel: 'Minggu 4',
      month,
      year,
      totalReorder: 510,
      terkirimFaktur: 454,
      belumTerkirimSo: 56
    },
    // Nusantara Expand
    {
      id: 'reo-ex-1',
      unit: 'Nusantara Expand',
      weekLabel: 'Minggu 1',
      month,
      year,
      totalReorder: 340,
      terkirimFaktur: 262,
      belumTerkirimSo: 78
    },
    {
      id: 'reo-ex-2',
      unit: 'Nusantara Expand',
      weekLabel: 'Minggu 2',
      month,
      year,
      totalReorder: 375,
      terkirimFaktur: 295,
      belumTerkirimSo: 80
    },
    {
      id: 'reo-ex-3',
      unit: 'Nusantara Expand',
      weekLabel: 'Minggu 3',
      month,
      year,
      totalReorder: 410,
      terkirimFaktur: 332,
      belumTerkirimSo: 78
    },
    {
      id: 'reo-ex-4',
      unit: 'Nusantara Expand',
      weekLabel: 'Minggu 4',
      month,
      year,
      totalReorder: 435,
      terkirimFaktur: 358,
      belumTerkirimSo: 77
    }
  ];
}

function buildInitialAdminOmsetRows(
  nusantaraAdmins: string[],
  sidoarjoAdmins: string[],
  month: string,
  year: string
): AdminOmsetRow[] {
  const bwiTemplate = [
    {
      kota: 'BALI - DENPASAR',
      area: 'Denpasar 1',
      omzetNetto: 670482046,
      bruto: 682982046,
      returNominal: 12500000,
      qtyNetto: 560635,
      returQty: 8400,
      targetNominal: 1560000000,
      lastMonthOmzet: 1451757474,
      lastMonthQty: 1629842
    },
    {
      kota: 'GENTENG',
      area: 'Genteng Retail',
      omzetNetto: 554540885,
      bruto: 569140885,
      returNominal: 14600000,
      qtyNetto: 322575,
      returQty: 6200,
      targetNominal: 1798000000,
      lastMonthOmzet: 1328633391,
      lastMonthQty: 902296
    },
    {
      kota: 'JEMBER',
      area: 'Jember Kota',
      omzetNetto: 486291327,
      bruto: 498091327,
      returNominal: 11800000,
      qtyNetto: 263363,
      returQty: 5100,
      targetNominal: 1420000000,
      lastMonthOmzet: 980354607,
      lastMonthQty: 549883
    },
    {
      kota: 'MUNCAR',
      area: 'Muncar Pasar',
      omzetNetto: 412796179,
      bruto: 421296179,
      returNominal: 8500000,
      qtyNetto: 497583,
      returQty: 4100,
      targetNominal: 1250000000,
      lastMonthOmzet: 668809157,
      lastMonthQty: 455946
    },
    {
      kota: 'BANYUWANGI KOTA',
      area: 'Banyuwangi Kota',
      omzetNetto: 368410200,
      bruto: 375410200,
      returNominal: 7000000,
      qtyNetto: 318420,
      returQty: 3200,
      targetNominal: 1100000000,
      lastMonthOmzet: 712400000,
      lastMonthQty: 512000
    },
    {
      kota: 'SITUBONDO',
      area: 'Situbondo',
      omzetNetto: 295120000,
      bruto: 301120000,
      returNominal: 6000000,
      qtyNetto: 245100,
      returQty: 2800,
      targetNominal: 950000000,
      lastMonthOmzet: 590000000,
      lastMonthQty: 410000
    }
  ];

  const sdaTemplate = [
    {
      kota: 'SURABAYA UTARA',
      area: 'Surabaya Utara',
      omzetNetto: 642231174,
      bruto: 669618292,
      returNominal: 27387118,
      qtyNetto: 2908055,
      returQty: 81000,
      targetNominal: 2472030000,
      lastMonthOmzet: 1641558246,
      lastMonthQty: 7173542
    },
    {
      kota: 'SIDOARJO',
      area: 'Sidoarjo Kota',
      omzetNetto: 504871257,
      bruto: 516919563,
      returNominal: 12048306,
      qtyNetto: 1412849.68,
      returQty: 19500,
      targetNominal: 1891185820,
      lastMonthOmzet: 1120400000,
      lastMonthQty: 2350000
    },
    {
      kota: 'GRESIK',
      area: 'Gresik',
      omzetNetto: 342180500,
      bruto: 350180500,
      returNominal: 8000000,
      qtyNetto: 668000,
      returQty: 9200,
      targetNominal: 1200000000,
      lastMonthOmzet: 780000000,
      lastMonthQty: 1120000
    }
  ];

  const rows: AdminOmsetRow[] = [];
  nusantaraAdmins.forEach((adminName, idx) => {
    const t = bwiTemplate[idx % bwiTemplate.length];
    rows.push({
      id: `oms-bwi-${idx + 1}`,
      adminName: adminName.toUpperCase(),
      branchId: 'cab-banyuwangi',
      branchCode: 'BWI',
      month,
      year,
      ...t
    });
  });

  sidoarjoAdmins.forEach((adminName, idx) => {
    const t = sdaTemplate[idx % sdaTemplate.length];
    rows.push({
      id: `oms-sda-${idx + 1}`,
      adminName: adminName.toUpperCase(),
      branchId: 'cab-sidoarjo',
      branchCode: 'SDA',
      month,
      year,
      ...t
    });
  });

  return rows;
}

const MONTHLY_OMZET_SERIES_2026 = [
  { month: 'JAN', omzetNetto: 9.65, target: 9.5, qtyJt: 24.8, returJt: 35 },
  { month: 'FEB', omzetNetto: 9.72, target: 8.9, qtyJt: 24.2, returJt: 62 },
  { month: 'MAR', omzetNetto: 7.18, target: 8.1, qtyJt: 14.9, returJt: 82 },
  { month: 'APR', omzetNetto: 9.05, target: 8.6, qtyJt: 15.2, returJt: 58 },
  { month: 'MEI', omzetNetto: 8.24, target: 13.7, qtyJt: 15.9, returJt: 155 },
  { month: 'JUN', omzetNetto: 9.18, target: 11.4, qtyJt: 18.7, returJt: 174 },
  { month: 'JUL', omzetNetto: 9.74, target: 12.0, qtyJt: 21.1, returJt: 152 },
  { month: 'AGU', omzetNetto: 8.15, target: 12.2, qtyJt: 18.4, returJt: 178 },
  { month: 'SEP', omzetNetto: 9.55, target: 12.2, qtyJt: 20.1, returJt: 148 },
  { month: 'OKT', omzetNetto: 8.95, target: 12.3, qtyJt: 18.7, returJt: 132 },
  { month: 'NOV', omzetNetto: 3.81, target: 12.44, qtyJt: 7.2, returJt: 78.8 }
];

const TOP_CUSTOMERS_DATA = [
  {
    name: 'PT BARES GROSIR SATU',
    omzet: 103067748,
    qty: '405.225 PCS',
    growthPct: '+286,7%',
    isPositive: true,
    vsLastMonth: 'Vs bulan lalu: Rp 59.011.519 • Selisih qty +167.150 PCS',
    vsBadge: '▲ +276,9%',
    progressPct: 100,
    branchId: 'cab-sidoarjo',
    kota: 'SURABAYA UTARA'
  },
  {
    name: 'TK BALI ANEKA PLASTIK',
    omzet: 82639725,
    qty: '17.343 PCS',
    growthPct: '+239,7%',
    isPositive: true,
    vsLastMonth: 'Vs bulan lalu: Rp 53.868.421 • Selisih qty +4.638 PCS',
    vsBadge: '▲ +202,3%',
    progressPct: 82,
    branchId: 'cab-banyuwangi',
    kota: 'BALI - DENPASAR'
  },
  {
    name: 'TK SUPER PLASTIK',
    omzet: 75645407,
    qty: '511.000 PCS',
    growthPct: '+976,1%',
    isPositive: true,
    vsLastMonth: 'Vs bulan lalu: Rp 15.565.493 • Selisih qty +415.000 PCS',
    vsBadge: '▲ +1.078,6%',
    progressPct: 74,
    branchId: 'cab-banyuwangi',
    kota: 'GENTENG'
  },
  {
    name: 'CV DEWI SRI MAJU',
    omzet: 63660987,
    qty: '130.230 PCS',
    growthPct: '+85,8%',
    isPositive: true,
    vsLastMonth: 'Vs bulan lalu: Rp 75.858.264 • Selisih qty -19.454 PCS',
    vsBadge: '▲ +92,7%',
    progressPct: 62,
    branchId: 'cab-sidoarjo',
    kota: 'SIDOARJO'
  },
  {
    name: 'TK CENTRAL PLASTIK',
    omzet: 59501019,
    qty: '23.203 PCS',
    growthPct: '+49,5%',
    isPositive: true,
    vsLastMonth: 'Vs bulan lalu: Rp 88.131.586 • Selisih qty -148.028 PCS',
    vsBadge: '▼ -70,0%',
    isVsNegative: true,
    progressPct: 58,
    branchId: 'cab-banyuwangi',
    kota: 'JEMBER'
  },
  {
    name: 'BP PRASOJO BUDIDARMO',
    omzet: 58011069,
    qty: '380.000 PCS',
    growthPct: '+2,9%',
    isPositive: true,
    vsLastMonth: 'Vs bulan lalu: Rp 124.775.965 • Selisih qty -423.980 PCS',
    vsBadge: '▲ +4,7%',
    progressPct: 56,
    branchId: 'cab-banyuwangi',
    kota: 'MUNCAR'
  }
];

const TOP_BARANG_DATA = [
  {
    name: 'MIKA AG B3A (100/2.000)',
    omzet: 103619452,
    qty: '153 CRT',
    growthPct: '+20,9%',
    isPositive: true,
    vsLastMonth: 'Vs bulan lalu: Rp 189.756.728 • Selisih qty -125,35 CRT',
    vsBadge: '▲ +21,7%',
    progressPct: 100
  },
  {
    name: 'SENDOK BBK JAGUAR PT BNG (50GRS/ZAK)',
    omzet: 77868616,
    qty: '310,94 ZAK',
    growthPct: '+94,7%',
    isPositive: true,
    vsLastMonth: 'Vs bulan lalu: Rp 88.564.955 • Selisih qty -45,58 ZAK',
    vsBadge: '▲ +93,1%',
    progressPct: 76
  },
  {
    name: 'KN GAJAH UG @250LBR 28X38 (25PAK/ZAK)',
    omzet: 77198383,
    qty: '113,2 ZAK',
    growthPct: '+95,8%',
    isPositive: true,
    vsLastMonth: 'Vs bulan lalu: Rp 87.300.435 • Selisih qty -14 ZAK',
    vsBadge: '▲ +97,1%',
    progressPct: 75
  },
  {
    name: 'KN BAJA PINK @70LBR (90PAK/ZAK)',
    omzet: 75886577,
    qty: '121,44 ZAK',
    growthPct: '+13,8%',
    isPositive: true,
    vsLastMonth: 'Vs bulan lalu: Rp 147.720.305 • Selisih qty -115,88 ZAK',
    vsBadge: '▲ +13,3%',
    progressPct: 73
  },
  {
    name: 'MIKA AG B4A (100/2.000)',
    omzet: 66198019,
    qty: '145,55 CRT',
    growthPct: '-22,9%',
    isPositive: false,
    vsLastMonth: 'Vs bulan lalu: Rp 190.132.478 • Selisih qty -271,7 CRT',
    vsBadge: '▼ -22,8%',
    isVsNegative: true,
    progressPct: 64
  },
  {
    name: 'KN BAJA MR @250LBR (25PAK/ZAK)',
    omzet: 60808929,
    qty: '103,4 ZAK',
    growthPct: '+17,7%',
    isPositive: true,
    vsLastMonth: 'Vs bulan lalu: Rp 114.375.479 • Selisih qty -89,12 ZAK',
    vsBadge: '▲ +18,9%',
    progressPct: 59
  }
];

const RETUR_BARANG_DATA = [
  {
    name: 'CUP PLST SJP 12 OZ NAT 7GR DB @50 (20SLP/CRT)',
    returNominal: 17083784,
    qty: '50 CRT',
    badge: '+100,0%'
  },
  {
    name: 'MIKA AG B4A (100/2.000)',
    returNominal: 12450000,
    qty: '18 CRT',
    badge: '+45,2%'
  },
  {
    name: 'KARTON BOX B-FLUTE 60X40X40 CM',
    returNominal: 9820000,
    qty: '1.200 PCS',
    badge: '+18,4%'
  }
];

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export const SalesKpi: React.FC<SalesKpiProps> = ({ defaultTab = 'sales_kpi_individual', onChangeTab }) => {
  // Normalize 'sales_kpi' to 'sales_kpi_individual' since "Semua Rangkuman" tab is removed per user request
  const normalizedDefaultTab =
    defaultTab === 'sales_kpi' || !defaultTab ? 'sales_kpi_individual' : defaultTab;

  const [activeTab, setActiveTab] = useState<string>(normalizedDefaultTab);
  const [isExporting, setIsExporting] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const { addNotification } = useToast();

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3500);
  };

  useEffect(() => {
    if (defaultTab) {
      setActiveTab(defaultTab === 'sales_kpi' ? 'sales_kpi_individual' : defaultTab);
    }
  }, [defaultTab]);

  // --------------------------------------------------------------------------
  // GLOBAL FILTERS: CABANG, BULAN (KALENDER), TAHUN, NAMA ADMIN
  // --------------------------------------------------------------------------
  const now = new Date();
  const [selectedBranchId, setSelectedBranchId] = useState<string>(() => {
    const id = branchStore.getSelectedOriginBranchId();
    return id && id !== 'ALL' ? id : 'cab-banyuwangi';
  });
  const [selectedMonth, setSelectedMonth] = useState<string>(
    () => MONTH_OPTIONS[now.getMonth()] || 'November'
  );
  const [selectedYear, setSelectedYear] = useState<string>(() => String(now.getFullYear()));
  const [selectedAdminFilter, setSelectedAdminFilter] = useState<string>('SEMUA ADMIN');

  // Additional filters for Omset Admin (Kota & Area)
  const [selectedKotaFilter, setSelectedKotaFilter] = useState<string>('SEMUA KOTA');
  const [selectedAreaFilter, setSelectedAreaFilter] = useState<string>('SEMUA AREA');
  const [omzetChartGranularity, setOmzetChartGranularity] = useState<'Bulanan' | 'Mingguan' | 'Harian'>('Bulanan');
  const [showOmzetNumbers, setShowOmzetNumbers] = useState<boolean>(false);
  const [openAnalisaAccordion, setOpenAnalisaAccordion] = useState<Record<string, boolean>>({
    performa: true,
    barang: false,
    customer: false,
    kota: false,
    admin: false
  });

  useEffect(() => {
    const unsub = branchStore.subscribe(() => {
      const id = branchStore.getSelectedOriginBranchId();
      if (id && id !== 'ALL') {
        setSelectedBranchId(id);
      }
    });
    return unsub;
  }, []);

  const handleBranchChange = (nextBranchId: string) => {
    setSelectedBranchId(nextBranchId);
    if (nextBranchId !== 'ALL') {
      branchStore.setActiveBranchId(nextBranchId);
    }
    setSelectedAdminFilter('SEMUA ADMIN');
  };

  // --------------------------------------------------------------------------
  // STRICT BRANCH-SEPARATED ADMIN PENJUALAN INTEGRATION FROM USER MANAGEMENT
  // --------------------------------------------------------------------------
  const allApprovedSalesUsers = useSalesAdminUsers('ALL');
  const bwiUsersFromStore = useSalesAdminUsers('cab-banyuwangi');
  const sdaUsersFromStore = useSalesAdminUsers('cab-sidoarjo');

  const nusantaraAdminNames = useMemo(() => {
    const fromUsers = Array.from(
      new Set(
        bwiUsersFromStore
          .map(u => (u.fullName || '').trim().toUpperCase())
          .filter(Boolean)
      )
    );
    // Merge with default Nusantara admins if only 1 default user exists, while strictly excluding any Sidoarjo user names
    const sdaSet = new Set(
      sdaUsersFromStore.map(u => (u.fullName || '').trim().toUpperCase())
    );
    const combined = Array.from(new Set([...fromUsers, ...DEFAULT_NUSANTARA_ADMINS])).filter(
      name => !sdaSet.has(name)
    );
    return combined.length > 0 ? combined : DEFAULT_NUSANTARA_ADMINS;
  }, [bwiUsersFromStore, sdaUsersFromStore]);

  const sidoarjoAdminNames = useMemo(() => {
    const fromUsers = Array.from(
      new Set(
        sdaUsersFromStore
          .map(u => (u.fullName || '').trim().toUpperCase())
          .filter(Boolean)
      )
    );
    const bwiSet = new Set(nusantaraAdminNames);
    const combined = Array.from(new Set([...fromUsers, ...DEFAULT_SIDOARJO_ADMINS])).filter(
      name => !bwiSet.has(name)
    );
    return combined.length > 0 ? combined : DEFAULT_SIDOARJO_ADMINS;
  }, [sdaUsersFromStore, nusantaraAdminNames]);

  // Admins strictly filtered by currently selected Cabang
  const activeBranchAdminNames = useMemo(() => {
    if (selectedBranchId === 'cab-sidoarjo') return sidoarjoAdminNames;
    if (selectedBranchId === 'cab-banyuwangi') return nusantaraAdminNames;
    return Array.from(new Set([...nusantaraAdminNames, ...sidoarjoAdminNames]));
  }, [selectedBranchId, nusantaraAdminNames, sidoarjoAdminNames]);

  useEffect(() => {
    if (
      selectedAdminFilter !== 'SEMUA ADMIN' &&
      !activeBranchAdminNames.includes(selectedAdminFilter)
    ) {
      setSelectedAdminFilter('SEMUA ADMIN');
    }
  }, [activeBranchAdminNames, selectedAdminFilter]);

  // --------------------------------------------------------------------------
  // STATE 1: KPI INDIVIDU STAF & KESALAHAN PENGINPUTAN DISKON
  // --------------------------------------------------------------------------
  const [individualKpiList, setIndividualKpiList] = useState<AdminIndividualKpiRecord[]>(() => {
    try {
      const raw = localStorage.getItem(LS_KPI_INDIVIDUAL_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {}
    return buildInitialIndividualKpi(
      DEFAULT_NUSANTARA_ADMINS,
      DEFAULT_SIDOARJO_ADMINS,
      MONTH_OPTIONS[now.getMonth()] || 'November',
      String(now.getFullYear())
    );
  });

  const [discountErrorLogs, setDiscountErrorLogs] = useState<DiscountErrorLogItem[]>(() => {
    try {
      const raw = localStorage.getItem(LS_DISCOUNT_ERRORS_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {}
    return buildInitialDiscountErrors(
      DEFAULT_NUSANTARA_ADMINS,
      DEFAULT_SIDOARJO_ADMINS,
      MONTH_OPTIONS[now.getMonth()] || 'November',
      String(now.getFullYear())
    );
  });

  useEffect(() => {
    try {
      localStorage.setItem(LS_KPI_INDIVIDUAL_KEY, JSON.stringify(individualKpiList));
    } catch {}
  }, [individualKpiList]);

  useEffect(() => {
    try {
      localStorage.setItem(LS_DISCOUNT_ERRORS_KEY, JSON.stringify(discountErrorLogs));
    } catch {}
  }, [discountErrorLogs]);

  // Ensure every admin in activeBranchAdminNames has a KPI record for the current branch/month/year
  const branchKpiRecords = useMemo(() => {
    return activeBranchAdminNames.map((adminName, idx) => {
      const targetBranch =
        selectedBranchId === 'ALL'
          ? sidoarjoAdminNames.includes(adminName)
            ? 'cab-sidoarjo'
            : 'cab-banyuwangi'
          : selectedBranchId;

      const existing = individualKpiList.find(
        r =>
          r.adminName.toUpperCase() === adminName.toUpperCase() &&
          r.branchId === targetBranch &&
          r.month === selectedMonth &&
          r.year === selectedYear
      );

      const discountLogsCount = discountErrorLogs.filter(
        d =>
          d.adminName.toUpperCase() === adminName.toUpperCase() &&
          d.branchId === targetBranch &&
          d.month === selectedMonth &&
          d.year === selectedYear
      ).length;

      if (existing) {
        const avg = Number(
          ((existing.validasiSoWeb + existing.pembuatanFaktur + existing.pengecekanFaktur) / 3).toFixed(1)
        );
        return {
          ...existing,
          discountErrorsCount: Math.max(existing.discountErrorsCount, discountLogsCount),
          avgMonthlyPct: avg
        };
      }

      const seed = adminName.charCodeAt(0) + idx * 7;
      const validasiSoWeb = 90 + (seed % 9);
      const pembuatanFaktur = 91 + ((seed * 3) % 8);
      const pengecekanFaktur = 90 + ((seed * 5) % 9);
      const avg = Number(((validasiSoWeb + pembuatanFaktur + pengecekanFaktur) / 3).toFixed(1));

      return {
        id: `kpi-auto-${targetBranch}-${adminName}`,
        adminName,
        branchId: targetBranch,
        month: selectedMonth,
        year: selectedYear,
        validasiSoWeb,
        pembuatanFaktur,
        pengecekanFaktur,
        discountErrorsCount: discountLogsCount,
        totalOrders: 280 + ((seed * 17) % 210),
        notes: 'Aktif',
        avgMonthlyPct: avg
      };
    });
  }, [
    activeBranchAdminNames,
    individualKpiList,
    discountErrorLogs,
    selectedBranchId,
    selectedMonth,
    selectedYear,
    sidoarjoAdminNames
  ]);

  // Filtered by selectedAdminFilter & ranked for Urutan Admin Terbaik
  const rankedBranchKpiList = useMemo(() => {
    const sorted = [...branchKpiRecords].sort((a, b) => {
      if (b.avgMonthlyPct !== a.avgMonthlyPct) return b.avgMonthlyPct - a.avgMonthlyPct;
      return a.discountErrorsCount - b.discountErrorsCount;
    });
    return sorted.map((item, index) => ({
      ...item,
      rank: index + 1
    }));
  }, [branchKpiRecords]);

  const displayedKpiList = useMemo(() => {
    if (selectedAdminFilter === 'SEMUA ADMIN') return rankedBranchKpiList;
    return rankedBranchKpiList.filter(
      r => r.adminName.toUpperCase() === selectedAdminFilter.toUpperCase()
    );
  }, [rankedBranchKpiList, selectedAdminFilter]);

  const [focusedAdminName, setFocusedAdminName] = useState<string>('');
  useEffect(() => {
    if (selectedAdminFilter !== 'SEMUA ADMIN') {
      setFocusedAdminName(selectedAdminFilter);
    } else if (
      !focusedAdminName ||
      !rankedBranchKpiList.some(r => r.adminName === focusedAdminName)
    ) {
      setFocusedAdminName(rankedBranchKpiList[0]?.adminName || '');
    }
  }, [selectedAdminFilter, rankedBranchKpiList, focusedAdminName]);

  const focusedAdminKpi = useMemo(() => {
    return (
      rankedBranchKpiList.find(r => r.adminName === focusedAdminName) ||
      rankedBranchKpiList[0] || {
        id: 'fallback',
        adminName: activeBranchAdminNames[0] || 'ADMIN PENJUALAN',
        branchId: selectedBranchId === 'ALL' ? 'cab-banyuwangi' : selectedBranchId,
        month: selectedMonth,
        year: selectedYear,
        validasiSoWeb: 95,
        pembuatanFaktur: 96,
        pengecekanFaktur: 95,
        discountErrorsCount: 0,
        totalOrders: 400,
        avgMonthlyPct: 95.3,
        rank: 1
      }
    );
  }, [
    rankedBranchKpiList,
    focusedAdminName,
    activeBranchAdminNames,
    selectedBranchId,
    selectedMonth,
    selectedYear
  ]);

  // Upload Excel Modal State for KPI Individu (same workflow as Form Kirim)
  const [isKpiUploadOpen, setIsKpiUploadOpen] = useState(false);
  const [kpiImportMode, setKpiImportMode] = useState<'replace_all' | 'append'>('replace_all');
  const [kpiExcelFileName, setKpiExcelFileName] = useState('');
  const [kpiPreviewRows, setKpiPreviewRows] = useState<AdminIndividualKpiRecord[]>([]);
  const [showKpiUploadPreview, setShowKpiUploadPreview] = useState(false);

  // Discount Error Form State
  const [isAddDiscountErrOpen, setIsAddDiscountErrOpen] = useState(false);
  const [dscAdmin, setDscAdmin] = useState('');
  const [dscNoFaktur, setDscNoFaktur] = useState('');
  const [dscCustomer, setDscCustomer] = useState('');
  const [dscExpected, setDscExpected] = useState('');
  const [dscInput, setDscInput] = useState('');
  const [dscSelisihRp, setDscSelisihRp] = useState('');
  const [dscKeterangan, setDscKeterangan] = useState('');

  // --------------------------------------------------------------------------
  // STATE 2: DENDA CHECKER
  // --------------------------------------------------------------------------
  const [dendaCheckerList, setDendaCheckerList] = useState<DendaCheckerRecord[]>(() => {
    try {
      const raw = localStorage.getItem(LS_DENDA_CHECKER_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {}
    return buildInitialDendaChecker(
      DEFAULT_NUSANTARA_ADMINS,
      DEFAULT_SIDOARJO_ADMINS,
      MONTH_OPTIONS[now.getMonth()] || 'November',
      String(now.getFullYear())
    );
  });

  useEffect(() => {
    try {
      localStorage.setItem(LS_DENDA_CHECKER_KEY, JSON.stringify(dendaCheckerList));
    } catch {}
  }, [dendaCheckerList]);

  // Upload Excel State for Denda Checker
  const [isDendaUploadOpen, setIsDendaUploadOpen] = useState(false);
  const [dendaImportMode, setDendaImportMode] = useState<'replace_all' | 'append'>('replace_all');
  const [dendaExcelFileName, setDendaExcelFileName] = useState('');
  const [dendaPreviewRows, setDendaPreviewRows] = useState<DendaCheckerRecord[]>([]);
  const [showDendaUploadPreview, setShowDendaUploadPreview] = useState(false);

  // Manual Form State for Denda Checker
  const [isAddDendaManualOpen, setIsAddDendaManualOpen] = useState(false);
  const [newDendaAdmin, setNewDendaAdmin] = useState('');
  const [newDendaCustomer, setNewDendaCustomer] = useState('');
  const [newDendaNoFaktur, setNewDendaNoFaktur] = useState('');
  const [newDendaKeterangan, setNewDendaKeterangan] = useState('');
  const [newDendaNominalSelisih, setNewDendaNominalSelisih] = useState('');
  const [newDendaKalianSelisih, setNewDendaKalianSelisih] = useState('1');

  const filteredDendaChecker = useMemo(() => {
    return dendaCheckerList.filter(item => {
      const matchBranch = selectedBranchId === 'ALL' || item.branchId === selectedBranchId;
      const matchAdmin =
        selectedAdminFilter === 'SEMUA ADMIN' ||
        item.adminName.toUpperCase() === selectedAdminFilter.toUpperCase();
      return matchBranch && matchAdmin;
    });
  }, [dendaCheckerList, selectedBranchId, selectedAdminFilter]);

  // --------------------------------------------------------------------------
  // STATE 3: EVALUASI ANALISA REORDER (NUSANTARA DR. SOETOMO & NUSANTARA EXPAND)
  // --------------------------------------------------------------------------
  const [reorderList, setReorderList] = useState<ReorderWeeklyItem[]>(() => {
    try {
      const raw = localStorage.getItem(LS_REORDER_EVAL_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {}
    return buildInitialReorderEval(
      MONTH_OPTIONS[now.getMonth()] || 'November',
      String(now.getFullYear())
    );
  });

  useEffect(() => {
    try {
      localStorage.setItem(LS_REORDER_EVAL_KEY, JSON.stringify(reorderList));
    } catch {}
  }, [reorderList]);

  const [isAddReorderOpen, setIsAddReorderOpen] = useState(false);
  const [reoUnit, setReoUnit] = useState<'Nusantara Dr. Soetomo' | 'Nusantara Expand'>('Nusantara Dr. Soetomo');
  const [reoWeek, setReoWeek] = useState('Minggu 1');
  const [reoTerkirimFaktur, setReoTerkirimFaktur] = useState('');
  const [reoBelumTerkirimSo, setReoBelumTerkirimSo] = useState('');

  // --------------------------------------------------------------------------
  // STATE 4: OMSET ADMIN (MATCHING IMAGES 7-10 WITH ADMIN NAMES)
  // --------------------------------------------------------------------------
  const [adminOmsetRows, setAdminOmsetRows] = useState<AdminOmsetRow[]>(() => {
    try {
      const raw = localStorage.getItem(LS_ADMIN_OMSET_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {}
    return buildInitialAdminOmsetRows(
      DEFAULT_NUSANTARA_ADMINS,
      DEFAULT_SIDOARJO_ADMINS,
      MONTH_OPTIONS[now.getMonth()] || 'November',
      String(now.getFullYear())
    );
  });

  useEffect(() => {
    try {
      localStorage.setItem(LS_ADMIN_OMSET_KEY, JSON.stringify(adminOmsetRows));
    } catch {}
  }, [adminOmsetRows]);

  const [isOmsetUploadOpen, setIsOmsetUploadOpen] = useState(false);
  const [omsetImportMode, setOmsetImportMode] = useState<'replace_all' | 'append'>('replace_all');
  const [omsetExcelFileName, setOmsetExcelFileName] = useState('');
  const [omsetPreviewRows, setOmsetPreviewRows] = useState<AdminOmsetRow[]>([]);
  const [showOmsetUploadPreview, setShowOmsetUploadPreview] = useState(false);

  // Sync adminOmsetRows with activeBranchAdminNames so every registered Admin Penjualan in that branch is represented
  const synchronizedOmsetRows = useMemo(() => {
    const baseList: AdminOmsetRow[] = [];

    const ensureBranchAdmins = (names: string[], brId: string, brCode: 'BWI' | 'SDA') => {
      names.forEach((name, idx) => {
        const found = adminOmsetRows.find(
          r => r.adminName.toUpperCase() === name.toUpperCase() && r.branchId === brId
        );
        if (found) {
          baseList.push(found);
        } else {
          const fallbackPool = buildInitialAdminOmsetRows(
            nusantaraAdminNames,
            sidoarjoAdminNames,
            selectedMonth,
            selectedYear
          ).filter(r => r.branchId === brId);
          const sample = fallbackPool[idx % fallbackPool.length];
          if (sample) {
            baseList.push({
              ...sample,
              id: `oms-sync-${brCode}-${idx}`,
              adminName: name.toUpperCase(),
              branchId: brId,
              branchCode: brCode
            });
          }
        }
      });
    };

    if (selectedBranchId === 'cab-banyuwangi') {
      ensureBranchAdmins(nusantaraAdminNames, 'cab-banyuwangi', 'BWI');
    } else if (selectedBranchId === 'cab-sidoarjo') {
      ensureBranchAdmins(sidoarjoAdminNames, 'cab-sidoarjo', 'SDA');
    } else {
      ensureBranchAdmins(nusantaraAdminNames, 'cab-banyuwangi', 'BWI');
      ensureBranchAdmins(sidoarjoAdminNames, 'cab-sidoarjo', 'SDA');
    }

    return baseList.filter(row => {
      const matchAdmin =
        selectedAdminFilter === 'SEMUA ADMIN' ||
        row.adminName.toUpperCase() === selectedAdminFilter.toUpperCase();
      const matchKota =
        selectedKotaFilter === 'SEMUA KOTA' ||
        row.kota.toUpperCase() === selectedKotaFilter.toUpperCase();
      const matchArea =
        selectedAreaFilter === 'SEMUA AREA' ||
        row.area.toUpperCase() === selectedAreaFilter.toUpperCase();
      return matchAdmin && matchKota && matchArea;
    });
  }, [
    adminOmsetRows,
    selectedBranchId,
    nusantaraAdminNames,
    sidoarjoAdminNames,
    selectedMonth,
    selectedYear,
    selectedAdminFilter,
    selectedKotaFilter,
    selectedAreaFilter
  ]);

  // ============================================================================
  // HANDLERS: KPI INDIVIDU EXCEL UPLOAD & TEMPLATE
  // ============================================================================
  const handleDownloadKpiTemplate = () => {
    const targetBranch = selectedBranchId === 'ALL' ? 'cab-banyuwangi' : selectedBranchId;
    const branchLabel = targetBranch === 'cab-sidoarjo' ? 'Sidoarjo' : 'Nusantara';
    const templateRows =
      selectedAdminFilter === 'SEMUA ADMIN'
        ? rankedBranchKpiList
        : rankedBranchKpiList.filter(r => r.adminName.toUpperCase() === selectedAdminFilter.toUpperCase());
    const wsData: any[][] = [
      [
        'Nama Admin',
        'Cabang',
        'Validasi Sales Order & Website (%)',
        'Pembuatan Faktur Penjualan (%)',
        'Pengecekan Faktur Penjualan (%)',
        'Kesalahan Penginputan Diskon (Kali)',
        'Total Order / Faktur',
        'Keterangan'
      ],
      ...(templateRows.length > 0
        ? templateRows.map(r => [
            r.adminName,
            r.branchId === 'cab-sidoarjo' ? 'Sidoarjo' : 'Nusantara',
            r.validasiSoWeb,
            r.pembuatanFaktur,
            r.pengecekanFaktur,
            r.discountErrorsCount,
            r.totalOrders,
            r.notes || `KPI ${branchLabel}`
          ])
        : [
            [
              selectedAdminFilter !== 'SEMUA ADMIN' ? selectedAdminFilter : activeBranchAdminNames[0] || 'ADMIN PENJUALAN',
              branchLabel,
              95,
              96,
              95,
              0,
              420,
              `KPI ${branchLabel}`
            ]
          ])
    ];
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(wsData);
    ws['!cols'] = [
      { wch: 28 },
      { wch: 16 },
      { wch: 32 },
      { wch: 30 },
      { wch: 30 },
      { wch: 32 },
      { wch: 20 },
      { wch: 28 }
    ];
    XLSX.utils.book_append_sheet(wb, ws, 'Template KPI Individu');
    const adminSuffix = selectedAdminFilter !== 'SEMUA ADMIN' ? `_${selectedAdminFilter.replace(/\s+/g, '_')}` : '';
    XLSX.writeFile(wb, `Template_KPI_Individu_${branchLabel}${adminSuffix}_${selectedMonth}_${selectedYear}.xlsx`);
  };

  const handleKpiExcelSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const buffer = await file.arrayBuffer();
      const wb = XLSX.read(buffer, { type: 'array' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rawRows = XLSX.utils.sheet_to_json<any[]>(ws, { header: 1, defval: '' });
      if (!Array.isArray(rawRows) || rawRows.length < 2) {
        showToast('File Excel kosong atau tidak memiliki baris data.');
        return;
      }

      const parsed: AdminIndividualKpiRecord[] = [];
      for (let r = 1; r < rawRows.length; r++) {
        const row = rawRows[r] || [];
        const rawAdminCell = String(row[0] ?? '').trim().toUpperCase();
        if (/^nama\s*admin$/i.test(rawAdminCell)) continue;
        const adminName =
          selectedAdminFilter !== 'SEMUA ADMIN'
            ? selectedAdminFilter
            : rawAdminCell || activeBranchAdminNames[0] || '';
        if (!adminName) continue;

        // Jika pilih admin tertentu dan file berisi banyak admin berbeda, ambil baris milik admin terpilih bila cocok
        if (
          selectedAdminFilter !== 'SEMUA ADMIN' &&
          rawAdminCell &&
          activeBranchAdminNames.some(a => a.toUpperCase() === rawAdminCell) &&
          rawAdminCell !== selectedAdminFilter.toUpperCase() &&
          rawRows.length > 2
        ) {
          continue;
        }

        const rawCabang = String(row[1] ?? '').trim().toLowerCase();
        const branchId =
          sidoarjoAdminNames.includes(adminName.toUpperCase()) ||
          rawCabang.includes('sidoarjo') ||
          rawCabang.includes('sda')
            ? 'cab-sidoarjo'
            : selectedBranchId === 'ALL'
            ? 'cab-banyuwangi'
            : selectedBranchId;

        const validasiSoWeb = Math.min(100, Math.max(0, parseNum(row[2]) || 90));
        const pembuatanFaktur = Math.min(100, Math.max(0, parseNum(row[3]) || 90));
        const pengecekanFaktur = Math.min(100, Math.max(0, parseNum(row[4]) || 90));
        const discountErrorsCount = Math.max(0, Math.round(parseNum(row[5]) || 0));
        const totalOrders = Math.max(0, Math.round(parseNum(row[6]) || 300));
        const notes = String(row[7] ?? '').trim();

        parsed.push({
          id: `kpi-imp-${Date.now()}-${r}`,
          adminName,
          branchId,
          month: selectedMonth,
          year: selectedYear,
          validasiSoWeb,
          pembuatanFaktur,
          pengecekanFaktur,
          discountErrorsCount,
          totalOrders,
          notes
        });
      }

      if (parsed.length === 0) {
        showToast('Tidak ditemukan baris KPI Individu yang valid.');
        return;
      }

      setKpiExcelFileName(file.name);
      setKpiPreviewRows(parsed);
      setShowKpiUploadPreview(true);
    } catch (err: any) {
      showToast(`Gagal membaca file Excel: ${err?.message || 'Format tidak didukung'}`);
    }
  };

  const handleSaveKpiUpload = () => {
    if (kpiPreviewRows.length === 0) {
      showToast('Silakan pilih file Excel KPI terlebih dahulu.');
      return;
    }
    const finalRows = kpiPreviewRows.map(r => ({
      ...r,
      adminName:
        selectedAdminFilter !== 'SEMUA ADMIN' && kpiPreviewRows.length === 1 ? selectedAdminFilter : r.adminName,
      branchId:
        sidoarjoAdminNames.includes(
          (selectedAdminFilter !== 'SEMUA ADMIN' && kpiPreviewRows.length === 1
            ? selectedAdminFilter
            : r.adminName
          ).toUpperCase()
        )
          ? 'cab-sidoarjo'
          : selectedBranchId === 'ALL'
          ? r.branchId
          : selectedBranchId,
      month: selectedMonth,
      year: selectedYear
    }));

    setIndividualKpiList(prev => {
      if (kpiImportMode === 'replace_all') {
        const others = prev.filter(item => {
          const sameBranch = selectedBranchId === 'ALL' || item.branchId === selectedBranchId;
          const samePeriod = item.month === selectedMonth && item.year === selectedYear;
          const sameAdmin =
            selectedAdminFilter === 'SEMUA ADMIN' ||
            item.adminName.toUpperCase() === selectedAdminFilter.toUpperCase();
          return !(sameBranch && samePeriod && sameAdmin);
        });
        return [...others, ...finalRows];
      }
      const next = [...prev];
      finalRows.forEach(imp => {
        const idx = next.findIndex(
          x =>
            x.adminName.toUpperCase() === imp.adminName.toUpperCase() &&
            x.branchId === imp.branchId &&
            x.month === imp.month &&
            x.year === imp.year
        );
        if (idx >= 0) next[idx] = imp;
        else next.push(imp);
      });
      return next;
    });
    setIsKpiUploadOpen(false);
    setKpiPreviewRows([]);
    setKpiExcelFileName('');
    setShowKpiUploadPreview(false);
    showToast(`Berhasil menyimpan ${finalRows.length} data KPI Individu Staf.`);
  };

  // ============================================================================
  // HANDLERS: DENDA CHECKER EXCEL UPLOAD & MANUAL INPUT
  // ============================================================================
  const handleDownloadDendaTemplate = () => {
    const wsData: any[][] = [
      [
        'Nama',
        'Nama Pelanggan',
        'No Faktur',
        'Keterangan',
        'Nominal Selisih',
        'Kalian Selisih',
        'Total Denda'
      ],
      ...filteredDendaChecker.map(d => [
        d.adminName,
        d.customerName,
        d.noFaktur,
        d.keterangan,
        d.nominalSelisih,
        d.kalianSelisih,
        d.totalDenda
      ])
    ];
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(wsData);
    ws['!cols'] = [
      { wch: 26 },
      { wch: 28 },
      { wch: 18 },
      { wch: 42 },
      { wch: 18 },
      { wch: 15 },
      { wch: 18 }
    ];
    XLSX.utils.book_append_sheet(wb, ws, 'Template Denda Checker');
    XLSX.writeFile(wb, `Template_Denda_Checker_${selectedMonth}_${selectedYear}.xlsx`);
  };

  const handleDendaExcelSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const buffer = await file.arrayBuffer();
      const wb = XLSX.read(buffer, { type: 'array' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rawRows = XLSX.utils.sheet_to_json<any[]>(ws, { header: 1, defval: '' });
      if (!Array.isArray(rawRows) || rawRows.length < 2) {
        showToast('File Excel Denda Checker kosong.');
        return;
      }

      const parsed: DendaCheckerRecord[] = [];
      for (let r = 1; r < rawRows.length; r++) {
        const row = rawRows[r] || [];
        const rawAdmin = String(row[0] ?? '').trim().toUpperCase();
        const customerName = String(row[1] ?? '').trim().toUpperCase();
        const noFaktur = String(row[2] ?? '').trim().toUpperCase();
        if (!rawAdmin && !noFaktur && selectedAdminFilter === 'SEMUA ADMIN') continue;
        if (/^nama$/i.test(rawAdmin)) continue;

        const adminName =
          selectedAdminFilter !== 'SEMUA ADMIN'
            ? selectedAdminFilter
            : rawAdmin || activeBranchAdminNames[0] || 'ADMIN PENJUALAN';
        const keterangan = String(row[3] ?? '').trim() || 'Selisih pengecekan faktur';
        const nominalSelisih = Math.max(0, parseNum(row[4]));
        const kalianSelisih = Math.max(0.5, parseNum(row[5]) || 1);
        const totalDenda = Math.round(nominalSelisih * kalianSelisih);

        const resolvedBranch = sidoarjoAdminNames.includes(adminName)
          ? 'cab-sidoarjo'
          : selectedBranchId === 'ALL'
          ? 'cab-banyuwangi'
          : selectedBranchId;

        parsed.push({
          id: `dc-imp-${Date.now()}-${r}`,
          branchId: resolvedBranch,
          month: selectedMonth,
          year: selectedYear,
          adminName,
          customerName: customerName || 'PELANGGAN UMUM',
          noFaktur: noFaktur || `FJ02-1126-00${r}`,
          keterangan,
          nominalSelisih,
          kalianSelisih,
          totalDenda
        });
      }

      if (parsed.length === 0) {
        showToast('Tidak ditemukan baris Denda Checker valid pada file.');
        return;
      }

      setDendaExcelFileName(file.name);
      setDendaPreviewRows(parsed);
      setShowDendaUploadPreview(true);
    } catch (err: any) {
      showToast(`Gagal membaca file Excel: ${err?.message || 'Format tidak didukung'}`);
    }
  };

  const handleSaveDendaUpload = () => {
    if (dendaPreviewRows.length === 0) {
      showToast('Silakan pilih file Excel Denda Checker terlebih dahulu.');
      return;
    }
    setDendaCheckerList(prev => {
      if (dendaImportMode === 'replace_all') {
        const remaining = prev.filter(
          x =>
            !(
              (selectedBranchId === 'ALL' || x.branchId === selectedBranchId) &&
              (selectedAdminFilter === 'SEMUA ADMIN' ||
                x.adminName.toUpperCase() === selectedAdminFilter.toUpperCase())
            )
        );
        return [...dendaPreviewRows, ...remaining];
      }
      return [...dendaPreviewRows, ...prev];
    });
    setIsDendaUploadOpen(false);
    setDendaPreviewRows([]);
    setDendaExcelFileName('');
    setShowDendaUploadPreview(false);
    showToast(`Berhasil menyimpan ${dendaPreviewRows.length} data Denda Checker.`);
  };

  const handleAddManualDenda = (e: React.FormEvent) => {
    e.preventDefault();
    const targetAdmin = (newDendaAdmin || activeBranchAdminNames[0] || '').trim().toUpperCase();
    if (!targetAdmin || !newDendaNoFaktur.trim() || !newDendaCustomer.trim()) {
      showToast('Harap lengkapi Nama Admin, Nama Pelanggan, dan No Faktur.');
      return;
    }
    const nominalSelisih = Math.max(0, parseNum(newDendaNominalSelisih));
    const kalianSelisih = Math.max(0.5, parseNum(newDendaKalianSelisih) || 1);
    const totalDenda = Math.round(nominalSelisih * kalianSelisih);
    const targetBranch = sidoarjoAdminNames.includes(targetAdmin)
      ? 'cab-sidoarjo'
      : selectedBranchId === 'ALL'
      ? 'cab-banyuwangi'
      : selectedBranchId;

    const newRecord: DendaCheckerRecord = {
      id: `dc-man-${Date.now()}`,
      branchId: targetBranch,
      month: selectedMonth,
      year: selectedYear,
      adminName: targetAdmin,
      customerName: newDendaCustomer.trim().toUpperCase(),
      noFaktur: newDendaNoFaktur.trim().toUpperCase(),
      keterangan: newDendaKeterangan.trim() || 'Selisih pengecekan faktur penjualan',
      nominalSelisih,
      kalianSelisih,
      totalDenda
    };

    setDendaCheckerList(prev => [newRecord, ...prev]);
    addNotification(
      'checker',
      `Denda Checker Baru: ${newRecord.adminName}`,
      `Faktur ${newRecord.noFaktur} (${newRecord.customerName}) — Selisih Rp ${formatRp(nominalSelisih)} × ${kalianSelisih} = Denda Rp ${formatRp(totalDenda)}`,
      totalDenda >= 100000
    );
    setNewDendaCustomer('');
    setNewDendaNoFaktur('');
    setNewDendaKeterangan('');
    setNewDendaNominalSelisih('');
    setNewDendaKalianSelisih('1');
    setIsAddDendaManualOpen(false);
    showToast(`Data Denda Checker untuk ${newRecord.adminName} berhasil ditambahkan.`);
  };

  // ============================================================================
  // HANDLERS: OMSET ADMIN EXCEL UPLOAD & TEMPLATE
  // ============================================================================
  const handleDownloadOmsetTemplate = () => {
    const wsData: any[][] = [
      [
        'Nama Admin',
        'Cabang',
        'Kota',
        'Area',
        'Omzet Netto (Rp)',
        'Bruto (Rp)',
        'Retur Nominal (Rp)',
        'Qty Netto (PCS)',
        'Target Bulan Ini (Rp)',
        'Omzet Bulan Lalu (Rp)'
      ],
      ...synchronizedOmsetRows.map(r => [
        r.adminName,
        r.branchCode === 'SDA' ? 'Sidoarjo' : 'Nusantara',
        r.kota,
        r.area,
        r.omzetNetto,
        r.bruto,
        r.returNominal,
        r.qtyNetto,
        r.targetNominal,
        r.lastMonthOmzet
      ])
    ];
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(wsData);
    ws['!cols'] = [
      { wch: 26 },
      { wch: 14 },
      { wch: 20 },
      { wch: 18 },
      { wch: 18 },
      { wch: 18 },
      { wch: 18 },
      { wch: 16 },
      { wch: 20 },
      { wch: 20 }
    ];
    XLSX.utils.book_append_sheet(wb, ws, 'Template Omset Admin');
    XLSX.writeFile(wb, `Template_Omset_Admin_${selectedMonth}_${selectedYear}.xlsx`);
  };

  const handleOmsetExcelSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const buffer = await file.arrayBuffer();
      const wb = XLSX.read(buffer, { type: 'array' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rawRows = XLSX.utils.sheet_to_json<any[]>(ws, { header: 1, defval: '' });
      if (!Array.isArray(rawRows) || rawRows.length < 2) {
        showToast('File Excel Omset Admin kosong.');
        return;
      }

      const parsed: AdminOmsetRow[] = [];
      for (let r = 1; r < rawRows.length; r++) {
        const row = rawRows[r] || [];
        const rawAdmin = String(row[0] ?? '').trim().toUpperCase();
        if (/^nama\s*admin$/i.test(rawAdmin)) continue;
        const adminName = selectedAdminFilter !== 'SEMUA ADMIN' ? selectedAdminFilter : rawAdmin;
        if (!adminName) continue;
        const rawCab = String(row[1] ?? '').trim().toLowerCase();
        const isSda = rawCab.includes('sidoarjo') || rawCab.includes('sda') || sidoarjoAdminNames.includes(adminName);
        const branchId = isSda ? 'cab-sidoarjo' : 'cab-banyuwangi';
        const branchCode: 'BWI' | 'SDA' = isSda ? 'SDA' : 'BWI';
        const kota = String(row[2] ?? '').trim().toUpperCase() || (isSda ? 'SURABAYA UTARA' : 'BANYUWANGI KOTA');
        const area = String(row[3] ?? '').trim() || (isSda ? 'Surabaya Utara' : 'Banyuwangi Kota');
        const omzetNetto = Math.max(0, parseNum(row[4]));
        const bruto = Math.max(omzetNetto, parseNum(row[5]) || omzetNetto);
        const returNominal = Math.max(0, parseNum(row[6]) || bruto - omzetNetto);
        const qtyNetto = Math.max(0, parseNum(row[7]) || 250000);
        const targetNominal = Math.max(0, parseNum(row[8]) || omzetNetto * 2);
        const lastMonthOmzet = Math.max(0, parseNum(row[9]) || omzetNetto * 1.15);

        parsed.push({
          id: `oms-imp-${Date.now()}-${r}`,
          adminName,
          branchId,
          branchCode,
          month: selectedMonth,
          year: selectedYear,
          kota,
          area,
          omzetNetto,
          bruto,
          returNominal,
          qtyNetto,
          returQty: Math.round(qtyNetto * 0.015),
          targetNominal,
          lastMonthOmzet,
          lastMonthQty: Math.round(qtyNetto * 1.2)
        });
      }

      if (parsed.length === 0) {
        showToast('Tidak ditemukan baris Omset Admin yang valid.');
        return;
      }

      setOmsetExcelFileName(file.name);
      setOmsetPreviewRows(parsed);
      setShowOmsetUploadPreview(true);
    } catch (err: any) {
      showToast(`Gagal membaca file Excel: ${err?.message || 'Format tidak didukung'}`);
    }
  };

  const handleSaveOmsetUpload = () => {
    if (omsetPreviewRows.length === 0) {
      showToast('Silakan unggah file Excel Omset Admin terlebih dahulu.');
      return;
    }
    setAdminOmsetRows(prev => {
      if (omsetImportMode === 'replace_all') {
        const remaining = prev.filter(
          x =>
            !(
              (selectedBranchId === 'ALL' || x.branchId === selectedBranchId) &&
              (selectedAdminFilter === 'SEMUA ADMIN' ||
                x.adminName.toUpperCase() === selectedAdminFilter.toUpperCase())
            )
        );
        return [...omsetPreviewRows, ...remaining];
      }
      return [...omsetPreviewRows, ...prev];
    });
    setIsOmsetUploadOpen(false);
    setOmsetPreviewRows([]);
    setOmsetExcelFileName('');
    setShowOmsetUploadPreview(false);
    showToast(`Berhasil menyimpan ${omsetPreviewRows.length} data Omset Admin.`);
  };

  // ============================================================================
  // EXPORT TO PDF
  // ============================================================================
  const exportKpiToPdf = async () => {
    setIsExporting(true);
    const element = document.getElementById('sales-kpi-print-area');
    if (!element) {
      setIsExporting(false);
      return;
    }
    try {
      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#f8fafc',
        logging: false
      });
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const imgWidth = 210;
      const pageHeight = 297;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      let heightLeft = imgHeight;
      let position = 0;

      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;

      while (heightLeft >= 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;
      }

      pdf.save(`Laporan_KPI_${activeTab}_${selectedMonth}_${selectedYear}.pdf`);
    } catch (error) {
      console.error('Error generating PDF report:', error);
    } finally {
      setIsExporting(false);
    }
  };

  // ============================================================================
  // COMPUTED METRICS FOR REORDER EVALUATION (DR. SOETOMO & EXPAND)
  // ============================================================================
  const reorderStats = useMemo(() => {
    const computeUnit = (unitName: 'Nusantara Dr. Soetomo' | 'Nusantara Expand') => {
      const rows = reorderList.filter(r => r.unit === unitName);
      const totalReorder = rows.reduce((s, r) => s + r.totalReorder, 0);
      const terkirimFaktur = rows.reduce((s, r) => s + r.terkirimFaktur, 0);
      const belumTerkirimSo = rows.reduce((s, r) => s + r.belumTerkirimSo, 0);
      const pctTerkirim = totalReorder > 0 ? Number(((terkirimFaktur / totalReorder) * 100).toFixed(1)) : 0;
      const pctBelumTerkirim = totalReorder > 0 ? Number(((belumTerkirimSo / totalReorder) * 100).toFixed(1)) : 0;
      return {
        rows,
        totalReorder,
        terkirimFaktur,
        belumTerkirimSo,
        pctTerkirim,
        pctBelumTerkirim
      };
    };

    return {
      soetomo: computeUnit('Nusantara Dr. Soetomo'),
      expand: computeUnit('Nusantara Expand')
    };
  }, [reorderList]);

  // ============================================================================
  // COMPUTED METRICS FOR OMSET ADMIN (IMAGES 7-10)
  // ============================================================================
  const omsetSummary = useMemo(() => {
    const omzetNetto = synchronizedOmsetRows.reduce((s, r) => s + r.omzetNetto, 0);
    const bruto = synchronizedOmsetRows.reduce((s, r) => s + r.bruto, 0);
    const returNominal = synchronizedOmsetRows.reduce((s, r) => s + r.returNominal, 0);
    const qtyNetto = synchronizedOmsetRows.reduce((s, r) => s + r.qtyNetto, 0);
    const targetBulanIni = synchronizedOmsetRows.reduce((s, r) => s + r.targetNominal, 0);
    const lastMonthOmzet = synchronizedOmsetRows.reduce((s, r) => s + r.lastMonthOmzet, 0);
    const lastMonthQty = synchronizedOmsetRows.reduce((s, r) => s + r.lastMonthQty, 0);

    const diffOmzet = omzetNetto - lastMonthOmzet;
    const diffOmzetPct = lastMonthOmzet > 0 ? ((diffOmzet / lastMonthOmzet) * 100).toFixed(1) : '0,0';
    const achvPct = targetBulanIni > 0 ? ((omzetNetto / targetBulanIni) * 100).toFixed(1) : '0,0';
    const gapTarget = omzetNetto - targetBulanIni;

    const hariBerjalan = 14;
    const totalHariBulanIni = 30;
    const pembagiBulanLalu = 31;

    const rataHarianIni = Math.round(omzetNetto / hariBerjalan);
    const rataBulanLalu = Math.round(lastMonthOmzet / pembagiBulanLalu);
    const proyeksiAkhirBulan = rataHarianIni * totalHariBulanIni;
    const qtyHarian = qtyNetto / hariBerjalan;

    const diffHarianPct =
      rataBulanLalu > 0 ? (((rataHarianIni - rataBulanLalu) / rataBulanLalu) * 100).toFixed(1) : '-5,8';
    const diffProyeksiPct =
      lastMonthOmzet > 0 ? (((proyeksiAkhirBulan - lastMonthOmzet) / lastMonthOmzet) * 100).toFixed(1) : '-8,8';

    return {
      omzetNetto,
      bruto,
      returNominal,
      qtyNetto,
      diffQty: qtyNetto - lastMonthQty,
      targetBulanIni,
      diffOmzet,
      diffOmzetPct,
      achvPct,
      gapTarget,
      hariBerjalan,
      totalHariBulanIni,
      pembagiBulanLalu,
      rataHarianIni,
      rataBulanLalu,
      proyeksiAkhirBulan,
      qtyHarian,
      diffHarianPct,
      diffProyeksiPct
    };
  }, [synchronizedOmsetRows]);

  // ============================================================================
  // SUB-VIEW 1: HALAMAN UPLOAD EXCEL KPI INDIVIDU (IDENTIK DENGAN FORM KIRIM)
  // ============================================================================
  if (isKpiUploadOpen) {
    return (
      <div className="space-y-5 animate-fade-in">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 sm:p-7 shadow-sm space-y-6">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-5 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-3.5">
              <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 text-white flex items-center justify-center shadow-sm shrink-0">
                <FileSpreadsheet className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-lg sm:text-xl font-black text-slate-900 dark:text-white tracking-tight">
                  Upload File Excel KPI Individu Staf
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Pilih cabang, bulan, tahun &amp; pilih admin evaluasi, lalu unggah file Excel KPI Individu Staf Admin Penjualan
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              <select
                value={selectedBranchId}
                onChange={e => handleBranchChange(e.target.value)}
                className="px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-xs font-bold text-slate-900 dark:text-white"
              >
                <option value="cab-banyuwangi">Cabang Nusantara</option>
                <option value="cab-sidoarjo">Cabang Sidoarjo</option>
                <option value="ALL">Semua Cabang</option>
              </select>
              <select
                value={selectedMonth}
                onChange={e => setSelectedMonth(e.target.value)}
                className="px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-xs font-bold text-slate-900 dark:text-white"
              >
                {MONTH_OPTIONS.map(m => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
              <select
                value={selectedYear}
                onChange={e => setSelectedYear(e.target.value)}
                className="px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-xs font-bold text-slate-900 dark:text-white"
              >
                {YEAR_OPTIONS.map(y => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
              <select
                value={selectedAdminFilter}
                onChange={e => {
                  const val = e.target.value;
                  setSelectedAdminFilter(val);
                  if (val !== 'SEMUA ADMIN') {
                    setFocusedAdminName(val);
                    setKpiPreviewRows(prev =>
                      prev.length === 1 ? prev.map(row => ({ ...row, adminName: val })) : prev
                    );
                  }
                }}
                className="px-3.5 py-2 rounded-xl border border-blue-200 dark:border-blue-800 bg-blue-50/70 dark:bg-blue-950/40 text-xs font-bold text-blue-700 dark:text-blue-300"
              >
                <option value="SEMUA ADMIN">Pilih Admin (Semua - {activeBranchAdminNames.length})</option>
                {activeBranchAdminNames.map(adm => (
                  <option key={adm} value={adm}>{adm}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Mode Upload Data */}
          <div className="space-y-2.5">
            <label className="block text-[11px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
              MODE UPLOAD DATA
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setKpiImportMode('replace_all')}
                className={`p-4 rounded-2xl border text-left transition-all cursor-pointer ${
                  kpiImportMode === 'replace_all'
                    ? 'border-blue-500 bg-blue-50/70 dark:bg-blue-950/30 text-slate-900 dark:text-white ring-2 ring-blue-500/20'
                    : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs sm:text-sm font-bold flex items-center gap-2.5">
                    <span
                      className={`w-3 h-3 rounded-full border-2 ${
                        kpiImportMode === 'replace_all' ? 'border-blue-600 bg-blue-600' : 'border-slate-300'
                      }`}
                    />
                    Timpa Data Lama (Replace All)
                  </span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300">
                    Default
                  </span>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setKpiImportMode('append')}
                className={`p-4 rounded-2xl border text-left transition-all cursor-pointer ${
                  kpiImportMode === 'append'
                    ? 'border-blue-500 bg-blue-50/70 dark:bg-blue-950/30 text-slate-900 dark:text-white ring-2 ring-blue-500/20'
                    : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300'
                }`}
              >
                <span className="text-xs sm:text-sm font-bold flex items-center gap-2.5">
                  <span
                    className={`w-3 h-3 rounded-full border-2 ${
                      kpiImportMode === 'append' ? 'border-blue-600 bg-blue-600' : 'border-slate-300'
                    }`}
                  />
                  Gabungkan / Tambah (Append)
                </span>
              </button>
            </div>
          </div>

          {/* Input File Excel */}
          <div className="space-y-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <label className="block text-[11px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
                FILE EXCEL KPI INDIVIDU (.XLSX / .XLS / .CSV)
              </label>
              <button
                type="button"
                onClick={handleDownloadKpiTemplate}
                className="px-3 py-1.5 rounded-xl bg-blue-50 dark:bg-blue-950/40 text-xs font-bold text-blue-600 dark:text-blue-400 hover:bg-blue-100 flex items-center gap-1.5 transition cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Unduh Template KPI Individu</span>
              </button>
            </div>

            <div className="p-4 rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-700 hover:border-blue-400 bg-slate-50/60 dark:bg-slate-950/50 transition flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <input
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={handleKpiExcelSelect}
                className="w-full sm:w-auto text-xs text-slate-700 dark:text-slate-300 file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:bg-blue-600 file:text-xs file:font-bold file:text-white hover:file:bg-blue-500 file:cursor-pointer cursor-pointer"
              />
              {kpiExcelFileName && (
                <div className="px-3 py-1.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-xs font-bold text-emerald-700 dark:text-emerald-300 flex items-center gap-2 shrink-0">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>
                    {kpiExcelFileName} ({kpiPreviewRows.length} staf terbaca)
                  </span>
                </div>
              )}
            </div>
          </div>

          <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200/80 dark:border-slate-800 text-slate-700 dark:text-slate-300 text-xs font-medium">
            Kolom yang terbaca:{' '}
            <strong className="text-slate-900 dark:text-white">
              Nama Admin, Cabang, Validasi Sales Order &amp; Website (%), Pembuatan Faktur Penjualan (%), Pengecekan Faktur Penjualan (%), Kesalahan Penginputan Diskon (Kali), Total Order / Faktur, Keterangan
            </strong>
            .
          </div>

          {showKpiUploadPreview && kpiPreviewRows.length > 0 && (
            <div className="pt-4 border-t border-slate-200 dark:border-slate-800 space-y-3">
              <h4 className="text-sm font-black text-slate-900 dark:text-white">
                Preview Sebelum Simpan ({kpiPreviewRows.length} Admin)
              </h4>
              <div className="overflow-x-auto rounded-2xl border border-slate-300 dark:border-slate-700">
                <table className="w-full text-xs text-left border-collapse bg-white dark:bg-slate-900 text-slate-900 dark:text-white">
                  <thead className="bg-slate-100 dark:bg-slate-800 font-bold text-[11px] border-b border-slate-300 dark:border-slate-700">
                    <tr>
                      <th className="py-2 px-3">No</th>
                      <th className="py-2 px-3">Nama Admin</th>
                      <th className="py-2 px-3">Cabang</th>
                      <th className="py-2 px-3 text-center">Validasi SO &amp; Web (%)</th>
                      <th className="py-2 px-3 text-center">Pembuatan Faktur (%)</th>
                      <th className="py-2 px-3 text-center">Pengecekan Faktur (%)</th>
                      <th className="py-2 px-3 text-center">Rata-rata Sebulan (%)</th>
                      <th className="py-2 px-3 text-center">Kesalahan Diskon</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                    {kpiPreviewRows.map((row, idx) => {
                      const avg = ((row.validasiSoWeb + row.pembuatanFaktur + row.pengecekanFaktur) / 3).toFixed(1);
                      return (
                        <tr key={row.id}>
                          <td className="py-2 px-3">{idx + 1}</td>
                          <td className="py-2 px-3 font-bold">{row.adminName}</td>
                          <td className="py-2 px-3">
                            {row.branchId === 'cab-sidoarjo' ? 'Cabang Sidoarjo' : 'Cabang Nusantara'}
                          </td>
                          <td className="py-2 px-3 text-center font-semibold">{row.validasiSoWeb}%</td>
                          <td className="py-2 px-3 text-center font-semibold">{row.pembuatanFaktur}%</td>
                          <td className="py-2 px-3 text-center font-semibold">{row.pengecekanFaktur}%</td>
                          <td className="py-2 px-3 text-center font-black text-blue-600 dark:text-blue-400">{avg}%</td>
                          <td className="py-2 px-3 text-center font-bold text-rose-600">{row.discountErrorsCount}x</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div className="flex flex-wrap items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => {
                setIsKpiUploadOpen(false);
                setKpiPreviewRows([]);
                setKpiExcelFileName('');
                setShowKpiUploadPreview(false);
              }}
              className="px-5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 font-bold text-xs sm:text-sm cursor-pointer"
            >
              Kembali ke KPI Individu
            </button>
            <button
              type="button"
              onClick={() => setShowKpiUploadPreview(prev => !prev)}
              className="px-5 py-2.5 rounded-xl border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 font-bold text-xs sm:text-sm flex items-center gap-2 cursor-pointer"
            >
              <Eye className="w-4 h-4" />
              <span>{showKpiUploadPreview ? 'Tutup Preview' : 'Preview Sebelum Simpan'}</span>
            </button>
            <button
              type="button"
              onClick={handleSaveKpiUpload}
              className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs sm:text-sm flex items-center gap-2 shadow-sm cursor-pointer"
            >
              <Save className="w-4 h-4" />
              <span>Simpan KPI Individu</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ============================================================================
  // SUB-VIEW 2: HALAMAN UPLOAD EXCEL DENDA CHECKER (IDENTIK DENGAN FORM KIRIM)
  // ============================================================================
  if (isDendaUploadOpen) {
    return (
      <div className="space-y-5 animate-fade-in">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 sm:p-7 shadow-sm space-y-6">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-5 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-3.5">
              <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-rose-600 to-orange-600 text-white flex items-center justify-center shadow-sm shrink-0">
                <FileSpreadsheet className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-lg sm:text-xl font-black text-slate-900 dark:text-white tracking-tight">
                  Upload File Excel Denda Checker
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Unggah rincian Nama, Nama Pelanggan, No Faktur, Keterangan, Nominal Selisih, dan Kali-an Selisih
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              <select
                value={selectedBranchId}
                onChange={e => handleBranchChange(e.target.value)}
                className="px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-xs font-bold text-slate-900 dark:text-white"
              >
                <option value="cab-banyuwangi">Cabang Nusantara</option>
                <option value="cab-sidoarjo">Cabang Sidoarjo</option>
                <option value="ALL">Semua Cabang</option>
              </select>
              <select
                value={selectedMonth}
                onChange={e => setSelectedMonth(e.target.value)}
                className="px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-xs font-bold text-slate-900 dark:text-white"
              >
                {MONTH_OPTIONS.map(m => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
              <select
                value={selectedYear}
                onChange={e => setSelectedYear(e.target.value)}
                className="px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-xs font-bold text-slate-900 dark:text-white"
              >
                {YEAR_OPTIONS.map(y => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
              <select
                value={selectedAdminFilter}
                onChange={e => setSelectedAdminFilter(e.target.value)}
                className="px-3.5 py-2 rounded-xl border border-blue-200 dark:border-blue-800 bg-blue-50/70 dark:bg-blue-950/40 text-xs font-bold text-blue-700 dark:text-blue-300"
              >
                <option value="SEMUA ADMIN">Pilih Admin (Semua - {activeBranchAdminNames.length})</option>
                {activeBranchAdminNames.map(adm => (
                  <option key={adm} value={adm}>{adm}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-2.5">
            <label className="block text-[11px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
              MODE UPLOAD DATA
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setDendaImportMode('replace_all')}
                className={`p-4 rounded-2xl border text-left transition-all cursor-pointer ${
                  dendaImportMode === 'replace_all'
                    ? 'border-blue-500 bg-blue-50/70 dark:bg-blue-950/30 text-slate-900 dark:text-white ring-2 ring-blue-500/20'
                    : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300'
                }`}
              >
                <span className="text-xs sm:text-sm font-bold">Timpa Data Lama (Replace All)</span>
              </button>
              <button
                type="button"
                onClick={() => setDendaImportMode('append')}
                className={`p-4 rounded-2xl border text-left transition-all cursor-pointer ${
                  dendaImportMode === 'append'
                    ? 'border-blue-500 bg-blue-50/70 dark:bg-blue-950/30 text-slate-900 dark:text-white ring-2 ring-blue-500/20'
                    : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300'
                }`}
              >
                <span className="text-xs sm:text-sm font-bold">Gabungkan / Tambah (Append)</span>
              </button>
            </div>
          </div>

          <div className="space-y-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <label className="block text-[11px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
                FILE EXCEL DENDA CHECKER (.XLSX / .XLS / .CSV)
              </label>
              <button
                type="button"
                onClick={handleDownloadDendaTemplate}
                className="px-3 py-1.5 rounded-xl bg-blue-50 dark:bg-blue-950/40 text-xs font-bold text-blue-600 dark:text-blue-400 flex items-center gap-1.5 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Unduh Template Denda Checker</span>
              </button>
            </div>

            <div className="p-4 rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-950/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <input
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={handleDendaExcelSelect}
                className="w-full sm:w-auto text-xs text-slate-700 dark:text-slate-300 file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:bg-blue-600 file:text-xs file:font-bold file:text-white hover:file:bg-blue-500 cursor-pointer"
              />
              {dendaExcelFileName && (
                <div className="px-3 py-1.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 text-xs font-bold text-emerald-700 dark:text-emerald-300 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{dendaExcelFileName} ({dendaPreviewRows.length} baris)</span>
                </div>
              )}
            </div>
          </div>

          <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200/80 dark:border-slate-800 text-xs">
            Kolom yang terbaca:{' '}
            <strong>Nama, Nama Pelanggan, No Faktur, Keterangan, Nominal Selisih, Kalian Selisih, Total Denda</strong>.
          </div>

          {showDendaUploadPreview && dendaPreviewRows.length > 0 && (
            <div className="overflow-x-auto rounded-2xl border border-slate-300 dark:border-slate-700">
              <table className="w-full text-xs text-left border-collapse bg-white dark:bg-slate-900">
                <thead className="bg-slate-100 dark:bg-slate-800 font-bold text-[11px]">
                  <tr>
                    <th className="py-2 px-3">No</th>
                    <th className="py-2 px-3">Nama</th>
                    <th className="py-2 px-3">Nama Pelanggan</th>
                    <th className="py-2 px-3">No Faktur</th>
                    <th className="py-2 px-3">Keterangan</th>
                    <th className="py-2 px-3 text-right">Nominal Selisih</th>
                    <th className="py-2 px-3 text-center">Kalian Selisih</th>
                    <th className="py-2 px-3 text-right">Denda</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                  {dendaPreviewRows.map((r, i) => (
                    <tr key={r.id}>
                      <td className="py-2 px-3">{i + 1}</td>
                      <td className="py-2 px-3 font-bold">{r.adminName}</td>
                      <td className="py-2 px-3">{r.customerName}</td>
                      <td className="py-2 px-3 font-mono">{r.noFaktur}</td>
                      <td className="py-2 px-3">{r.keterangan}</td>
                      <td className="py-2 px-3 text-right">Rp {formatRp(r.nominalSelisih)}</td>
                      <td className="py-2 px-3 text-center font-bold">{r.kalianSelisih}x</td>
                      <td className="py-2 px-3 text-right font-black text-rose-600">Rp {formatRp(r.totalDenda)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="flex flex-wrap items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => {
                setIsDendaUploadOpen(false);
                setDendaPreviewRows([]);
                setDendaExcelFileName('');
              }}
              className="px-5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold cursor-pointer"
            >
              Kembali
            </button>
            <button
              type="button"
              onClick={handleSaveDendaUpload}
              className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs flex items-center gap-2 cursor-pointer"
            >
              <Save className="w-4 h-4" />
              <span>Simpan Denda Checker</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ============================================================================
  // SUB-VIEW 3: HALAMAN UPLOAD EXCEL OMSET ADMIN (IDENTIK DENGAN FORM KIRIM)
  // ============================================================================
  if (isOmsetUploadOpen) {
    return (
      <div className="space-y-5 animate-fade-in">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 sm:p-7 shadow-sm space-y-6">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-3.5">
              <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-emerald-600 to-teal-600 text-white flex items-center justify-center shadow-sm">
                <FileSpreadsheet className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-lg font-black text-slate-900 dark:text-white">
                  Upload File Excel Omset Admin
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Unggah data Omset Netto, Bruto, Retur, Qty Netto, dan Target per Admin Penjualan
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              <select
                value={selectedBranchId}
                onChange={e => handleBranchChange(e.target.value)}
                className="px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-xs font-bold text-slate-900 dark:text-white"
              >
                <option value="cab-banyuwangi">Cabang Nusantara</option>
                <option value="cab-sidoarjo">Cabang Sidoarjo</option>
                <option value="ALL">Semua Cabang</option>
              </select>
              <select
                value={selectedMonth}
                onChange={e => setSelectedMonth(e.target.value)}
                className="px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-xs font-bold text-slate-900 dark:text-white"
              >
                {MONTH_OPTIONS.map(m => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
              <select
                value={selectedYear}
                onChange={e => setSelectedYear(e.target.value)}
                className="px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-xs font-bold text-slate-900 dark:text-white"
              >
                {YEAR_OPTIONS.map(y => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
              <select
                value={selectedAdminFilter}
                onChange={e => setSelectedAdminFilter(e.target.value)}
                className="px-3.5 py-2 rounded-xl border border-blue-200 dark:border-blue-800 bg-blue-50/70 dark:bg-blue-950/40 text-xs font-bold text-blue-700 dark:text-blue-300"
              >
                <option value="SEMUA ADMIN">Pilih Admin (Semua - {activeBranchAdminNames.length})</option>
                {activeBranchAdminNames.map(adm => (
                  <option key={adm} value={adm}>{adm}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-black uppercase text-slate-500">
                FILE EXCEL OMSET ADMIN (.XLSX / .XLS / .CSV)
              </label>
              <button
                type="button"
                onClick={handleDownloadOmsetTemplate}
                className="px-3 py-1.5 rounded-xl bg-blue-50 dark:bg-blue-950/40 text-xs font-bold text-blue-600 dark:text-blue-400 flex items-center gap-1.5 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Unduh Template Omset Admin</span>
              </button>
            </div>
            <div className="p-4 rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-950/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <input
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={handleOmsetExcelSelect}
                className="text-xs file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:bg-blue-600 file:text-xs file:font-bold file:text-white cursor-pointer"
              />
              {omsetExcelFileName && (
                <span className="text-xs font-bold text-emerald-600">
                  {omsetExcelFileName} ({omsetPreviewRows.length} baris terbaca)
                </span>
              )}
            </div>
          </div>

          {showOmsetUploadPreview && omsetPreviewRows.length > 0 && (
            <div className="overflow-x-auto rounded-2xl border border-slate-300 dark:border-slate-700">
              <table className="w-full text-xs text-left border-collapse bg-white dark:bg-slate-900">
                <thead className="bg-slate-100 dark:bg-slate-800 font-bold text-[11px]">
                  <tr>
                    <th className="py-2 px-3">Nama Admin</th>
                    <th className="py-2 px-3">Cabang</th>
                    <th className="py-2 px-3">Kota</th>
                    <th className="py-2 px-3 text-right">Omzet Netto</th>
                    <th className="py-2 px-3 text-right">Retur</th>
                    <th className="py-2 px-3 text-right">Qty Netto</th>
                    <th className="py-2 px-3 text-right">Target</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                  {omsetPreviewRows.map(r => (
                    <tr key={r.id}>
                      <td className="py-2 px-3 font-bold">{r.adminName}</td>
                      <td className="py-2 px-3">{r.branchCode}</td>
                      <td className="py-2 px-3">{r.kota}</td>
                      <td className="py-2 px-3 text-right font-bold">Rp {formatRp(r.omzetNetto)}</td>
                      <td className="py-2 px-3 text-right text-rose-600">Rp {formatRp(r.returNominal)}</td>
                      <td className="py-2 px-3 text-right">{formatQtyId(r.qtyNetto)}</td>
                      <td className="py-2 px-3 text-right">Rp {formatRp(r.targetNominal)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={() => setIsOmsetUploadOpen(false)}
              className="px-5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold cursor-pointer"
            >
              Kembali
            </button>
            <button
              type="button"
              onClick={handleSaveOmsetUpload}
              className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs flex items-center gap-2 cursor-pointer"
            >
              <Save className="w-4 h-4" />
              <span>Simpan Data Omset Admin</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ============================================================================
  // MAIN RENDER
  // ============================================================================
  return (
    <div className="space-y-6">
      {toastMsg && (
        <div className="fixed bottom-5 right-5 z-50 max-w-md bg-emerald-600 text-white px-4 py-3 rounded-2xl shadow-xl flex items-center gap-2.5 text-xs font-bold animate-fade-in">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{toastMsg}</span>
        </div>
      )}

      {/* ===================================================================== */}
      {/* HEADER BAR TANPA TOMBOL SEMUA RANGKUMAN / KPI INDIVIDU DLL             */}
      {/* DIGANTI DENGAN FILTER CABANG, BULAN (KALENDER), TAHUN, DAN NAMA ADMIN */}
      {/* ===================================================================== */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 sm:p-5 rounded-2xl shadow-xs space-y-4">
        <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4">
          <div>
            <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-white uppercase tracking-tight">
              {activeTab === 'sales_kpi_individual' && 'KPI Individu Staff'}
              {activeTab === 'sales_kpi_fines' && 'Akumulasi Denda'}
              {activeTab === 'sales_kpi_nusantara' && 'Persentase Kiriman'}
              {activeTab === 'sales_kpi_omset' && 'Omset Admin Penjualan'}
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-0.5">
              Terintegrasi dengan User Management (Hak Akses Admin Penjualan) &bull; Terpisah per Cabang ({selectedBranchId === 'cab-sidoarjo' ? 'Cabang Sidoarjo' : selectedBranchId === 'cab-banyuwangi' ? 'Cabang Nusantara' : 'Semua Cabang'})
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {activeTab === 'sales_kpi_individual' && (
              <>
                <button
                  type="button"
                  onClick={() => {
                    setShowKpiUploadPreview(false);
                    setIsKpiUploadOpen(true);
                  }}
                  className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1.5 transition cursor-pointer shadow-xs"
                >
                  <Upload className="w-4 h-4" />
                  <span>Upload File Excel</span>
                </button>
                <button
                  type="button"
                  onClick={handleDownloadKpiTemplate}
                  className="px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Template Excel</span>
                </button>
              </>
            )}

            {activeTab === 'sales_kpi_fines' && (
              <>
                <button
                  type="button"
                  onClick={() => {
                    setShowDendaUploadPreview(false);
                    setIsDendaUploadOpen(true);
                  }}
                  className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1.5 transition cursor-pointer shadow-xs"
                >
                  <Upload className="w-4 h-4" />
                  <span>Upload File Excel</span>
                </button>
                <button
                  type="button"
                  onClick={handleDownloadDendaTemplate}
                  className="px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Template Excel</span>
                </button>
              </>
            )}

            {activeTab === 'sales_kpi_omset' && (
              <>
                <button
                  type="button"
                  onClick={() => {
                    setShowOmsetUploadPreview(false);
                    setIsOmsetUploadOpen(true);
                  }}
                  className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1.5 transition cursor-pointer shadow-xs"
                >
                  <Upload className="w-4 h-4" />
                  <span>Upload File Excel</span>
                </button>
                <button
                  type="button"
                  onClick={handleDownloadOmsetTemplate}
                  className="px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Template Excel</span>
                </button>
              </>
            )}

            <button
              type="button"
              onClick={exportKpiToPdf}
              disabled={isExporting}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl transition-all cursor-pointer disabled:opacity-50 shadow-xs"
            >
              {isExporting ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
              <span>Ekspor PDF</span>
            </button>
          </div>
        </div>

        {/* Filter Bar: Cabang, Bulan (Kalender), Tahun, Nama Admin (+ Kota & Area khusus Omset Admin sesuai Gambar 7) */}
        <div
          className={`grid grid-cols-1 sm:grid-cols-2 ${
            activeTab === 'sales_kpi_omset' ? 'lg:grid-cols-6' : 'lg:grid-cols-4'
          } gap-3 pt-3 border-t border-slate-100 dark:border-slate-800`}
        >
          {/* 1. CABANG */}
          <div>
            <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
              CABANG
            </label>
            <select
              value={selectedBranchId}
              onChange={e => handleBranchChange(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/80 dark:bg-slate-950 text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:border-blue-500 cursor-pointer"
            >
              <option value="cab-banyuwangi">Cabang Nusantara (Banyuwangi)</option>
              <option value="cab-sidoarjo">Cabang Sidoarjo</option>
              <option value="ALL">Semua Cabang</option>
            </select>
          </div>

          {/* 2. BULAN (KALENDER) */}
          <div>
            <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
              BULAN (KALENDER)
            </label>
            <div className="relative">
              <Calendar className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <select
                value={selectedMonth}
                onChange={e => setSelectedMonth(e.target.value)}
                className="w-full pl-8 pr-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/80 dark:bg-slate-950 text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:border-blue-500 cursor-pointer"
              >
                {MONTH_OPTIONS.map(m => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>
          </div>

          {/* 3. TAHUN */}
          <div>
            <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
              TAHUN
            </label>
            <select
              value={selectedYear}
              onChange={e => setSelectedYear(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/80 dark:bg-slate-950 text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:border-blue-500 cursor-pointer"
            >
              {YEAR_OPTIONS.map(y => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>

          {/* 4. NAMA ADMIN (TERINTEGRASI USER MANAGEMENT & TERPISAH PER CABANG) */}
          <div>
            <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
              NAMA ADMIN
            </label>
            <select
              value={selectedAdminFilter}
              onChange={e => setSelectedAdminFilter(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/80 dark:bg-slate-950 text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:border-blue-500 cursor-pointer"
            >
              <option value="SEMUA ADMIN">Semua Admin ({activeBranchAdminNames.length})</option>
              {activeBranchAdminNames.map(name => (
                <option key={name} value={name}>{name}</option>
              ))}
            </select>
          </div>

          {/* 5 & 6. KOTA & AREA (Khusus tampilan Omset Admin sesuai Gambar 7) */}
          {activeTab === 'sales_kpi_omset' && (
            <>
              <div>
                <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                  KOTA
                </label>
                <select
                  value={selectedKotaFilter}
                  onChange={e => setSelectedKotaFilter(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/80 dark:bg-slate-950 text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:border-blue-500 cursor-pointer"
                >
                  <option value="SEMUA KOTA">Semua Kota</option>
                  <option value="GENTENG">GENTENG</option>
                  <option value="BALI - DENPASAR">BALI - DENPASAR</option>
                  <option value="JEMBER">JEMBER</option>
                  <option value="MUNCAR">MUNCAR</option>
                  <option value="BANYUWANGI KOTA">BANYUWANGI KOTA</option>
                  <option value="SITUBONDO">SITUBONDO</option>
                  <option value="SURABAYA UTARA">SURABAYA UTARA</option>
                  <option value="SIDOARJO">SIDOARJO</option>
                  <option value="GRESIK">GRESIK</option>
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                  AREA
                </label>
                <select
                  value={selectedAreaFilter}
                  onChange={e => setSelectedAreaFilter(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/80 dark:bg-slate-950 text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:border-blue-500 cursor-pointer"
                >
                  <option value="SEMUA AREA">Semua Area</option>
                  {OFFICIAL_DESTINATION_AREAS.map(area => (
                    <option key={area} value={area}>{area}</option>
                  ))}
                </select>
              </div>
            </>
          )}
        </div>
      </div>

      {/* ===================================================================== */}
      {/* PRINT AREA CONTAINER                                                  */}
      {/* ===================================================================== */}
      <div id="sales-kpi-print-area" className="space-y-6">
        {/* =================================================================== */}
        {/* VIEW 1: KPI INDIVIDU STAF                                           */}
        {/* =================================================================== */}
        {activeTab === 'sales_kpi_individual' && (
          <div className="space-y-6 animate-fade-in">
            {/* Top Summary Metric Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 flex items-center justify-between shadow-xs">
                <div>
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">
                    ADMIN TERBAIK #1 ({selectedMonth.slice(0, 3).toUpperCase()})
                  </span>
                  <div className="text-base sm:text-lg font-black text-slate-900 dark:text-white mt-1 truncate">
                    {rankedBranchKpiList[0]?.adminName || '-'}
                  </div>
                  <p className="text-[11px] text-emerald-600 dark:text-emerald-400 mt-1 font-bold">
                    Rata-rata Sebulan: {rankedBranchKpiList[0]?.avgMonthlyPct || 0}%
                  </p>
                </div>
                <div className="p-3 rounded-xl bg-amber-500/10 text-amber-500 border border-amber-500/20">
                  <Trophy className="w-5 h-5" />
                </div>
              </div>

              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 flex items-center justify-between shadow-xs">
                <div>
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">
                    RERATA VALIDASI SO &amp; WEB
                  </span>
                  <div className="text-lg font-black text-blue-600 dark:text-blue-400 mt-1">
                    {displayedKpiList.length > 0
                      ? (
                          displayedKpiList.reduce((s, r) => s + r.validasiSoWeb, 0) /
                          displayedKpiList.length
                        ).toFixed(1)
                      : '0.0'}
                    %
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1 font-semibold">
                    Validasi Sales Order &amp; Website
                  </p>
                </div>
                <div className="p-3 rounded-xl bg-blue-500/10 text-blue-500 border border-blue-500/20">
                  <CheckCircle className="w-5 h-5" />
                </div>
              </div>

              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 flex items-center justify-between shadow-xs">
                <div>
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">
                    PEMBUATAN &amp; CEK FAKTUR
                  </span>
                  <div className="text-lg font-black text-emerald-600 dark:text-emerald-400 mt-1">
                    {displayedKpiList.length > 0
                      ? (
                          displayedKpiList.reduce(
                            (s, r) => s + (r.pembuatanFaktur + r.pengecekanFaktur) / 2,
                            0
                          ) / displayedKpiList.length
                        ).toFixed(1)
                      : '0.0'}
                    %
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1 font-semibold">
                    Pembuatan &amp; Pengecekan Faktur
                  </p>
                </div>
                <div className="p-3 rounded-xl bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                  <FileText className="w-5 h-5" />
                </div>
              </div>

              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 flex items-center justify-between shadow-xs">
                <div>
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">
                    KESALAHAN INPUT DISKON
                  </span>
                  <div className="text-lg font-black text-rose-600 dark:text-rose-400 mt-1">
                    {displayedKpiList.reduce((s, r) => s + r.discountErrorsCount, 0)} Kali
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1 font-semibold">
                    Total temuan bulan {selectedMonth}
                  </p>
                </div>
                <div className="p-3 rounded-xl bg-rose-500/10 text-rose-500 border border-rose-500/20">
                  <BadgePercent className="w-5 h-5" />
                </div>
              </div>
            </div>

            {/* CHART PERBANDINGAN METRIK KPI INDIVIDU ANTAR ADMIN */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-tight">
                    Grafik Evaluasi KPI Bulanan Admin ({selectedMonth} {selectedYear})
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Perbandingan Validasi Sales Order &amp; Website, Pembuatan Faktur Penjualan, Pengecekan Faktur Penjualan, serta Rata-rata Prosentase Sebulan
                  </p>
                </div>
                <span className="px-3 py-1 rounded-full bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 text-xs font-bold">
                  Target Standar Manajemen: &ge; 95%
                </span>
              </div>

              <div className="h-[310px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart
                    data={displayedKpiList}
                    margin={{ top: 10, right: 15, left: -15, bottom: 10 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                    <XAxis
                      dataKey="adminName"
                      tick={{ fill: '#64748b', fontSize: 10, fontWeight: 700 }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      domain={[70, 100]}
                      tick={{ fill: '#64748b', fontSize: 10 }}
                      axisLine={false}
                      tickLine={false}
                      unit="%"
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#0f172a',
                        borderColor: '#334155',
                        borderRadius: '12px',
                        color: '#fff',
                        fontSize: '11px'
                      }}
                    />
                    <Legend wrapperStyle={{ fontSize: '11px', fontWeight: 700 }} />
                    <Bar
                      dataKey="validasiSoWeb"
                      name="Validasi SO & Website (%)"
                      fill="#3b82f6"
                      radius={[4, 4, 0, 0]}
                      barSize={18}
                    />
                    <Bar
                      dataKey="pembuatanFaktur"
                      name="Pembuatan Faktur Penjualan (%)"
                      fill="#10b981"
                      radius={[4, 4, 0, 0]}
                      barSize={18}
                    />
                    <Bar
                      dataKey="pengecekanFaktur"
                      name="Pengecekan Faktur Penjualan (%)"
                      fill="#8b5cf6"
                      radius={[4, 4, 0, 0]}
                      barSize={18}
                    />
                    <Line
                      type="monotone"
                      dataKey="avgMonthlyPct"
                      name="Rata-rata Prosentase Sebulan (%)"
                      stroke="#f59e0b"
                      strokeWidth={3}
                      dot={{ fill: '#f59e0b', r: 5 }}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* URUTAN ADMIN TERBAIK & RADAR PROFIL INDIVIDU */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Left: Urutan Admin Terbaik (Leaderboard) */}
              <div className="lg:col-span-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-tight">
                      Urutan Admin Terbaik ({selectedMonth} {selectedYear})
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Peringkat berdasarkan rata-rata prosentase dalam sebulan &amp; minimnya kesalahan diskon
                    </p>
                  </div>
                </div>

                <div className="space-y-2.5">
                  {displayedKpiList.map(admin => {
                    const isFocused = focusedAdminKpi.adminName === admin.adminName;
                    return (
                      <div
                        key={admin.adminName}
                        onClick={() => setFocusedAdminName(admin.adminName)}
                        className={`p-3.5 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-3 ${
                          isFocused
                            ? 'bg-blue-50/70 dark:bg-blue-950/30 border-blue-500 ring-1 ring-blue-500/20'
                            : 'bg-slate-50/60 dark:bg-slate-950/40 border-slate-200/80 dark:border-slate-800 hover:border-blue-300'
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div
                            className={`w-8 h-8 rounded-xl flex items-center justify-center text-xs font-black shrink-0 ${
                              admin.rank === 1
                                ? 'bg-amber-400 text-slate-950 shadow-xs'
                                : admin.rank === 2
                                ? 'bg-slate-300 text-slate-900'
                                : admin.rank === 3
                                ? 'bg-amber-700 text-white'
                                : 'bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                            }`}
                          >
                            #{admin.rank}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-black text-slate-900 dark:text-white truncate">
                                {admin.adminName}
                              </span>
                              <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                                {admin.branchId === 'cab-sidoarjo' ? 'SDA' : 'BWI'}
                              </span>
                            </div>
                            <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 flex flex-wrap items-center gap-2">
                              <span>SO/Web: <strong>{admin.validasiSoWeb}%</strong></span>
                              <span>&bull;</span>
                              <span>Buat Faktur: <strong>{admin.pembuatanFaktur}%</strong></span>
                              <span>&bull;</span>
                              <span>Cek Faktur: <strong>{admin.pengecekanFaktur}%</strong></span>
                            </div>
                          </div>
                        </div>

                        <div className="text-right shrink-0">
                          <div className="text-sm font-black text-blue-600 dark:text-blue-400">
                            {admin.avgMonthlyPct}%
                          </div>
                          <div
                            className={`text-[10px] font-bold ${
                              admin.discountErrorsCount === 0
                                ? 'text-emerald-600 dark:text-emerald-400'
                                : 'text-rose-600 dark:text-rose-400'
                            }`}
                          >
                            Salah Diskon: {admin.discountErrorsCount}x
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Right: Radar & Breakdown Detail for Selected Admin */}
              <div className="lg:col-span-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs space-y-5">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-tight">
                      Rincian Capaian KPI — {focusedAdminKpi.adminName}
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Peringkat #{focusedAdminKpi.rank} &bull; Rata-rata Sebulan: {focusedAdminKpi.avgMonthlyPct}%
                    </p>
                  </div>
                  <span className="px-3 py-1 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 text-xs font-black">
                    Rata-rata: {focusedAdminKpi.avgMonthlyPct}%
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
                  <div className="h-[220px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <RadarChart
                        cx="50%"
                        cy="50%"
                        outerRadius="72%"
                        data={[
                          { subject: 'Validasi SO & Web', A: focusedAdminKpi.validasiSoWeb, fullMark: 100 },
                          { subject: 'Pembuatan Faktur', A: focusedAdminKpi.pembuatanFaktur, fullMark: 100 },
                          { subject: 'Pengecekan Faktur', A: focusedAdminKpi.pengecekanFaktur, fullMark: 100 },
                          { subject: 'Rata-rata Sebulan', A: focusedAdminKpi.avgMonthlyPct, fullMark: 100 },
                          {
                            subject: 'Akurasi Diskon',
                            A: Math.max(60, 100 - focusedAdminKpi.discountErrorsCount * 5),
                            fullMark: 100
                          }
                        ]}
                      >
                        <PolarGrid stroke="#cbd5e1" />
                        <PolarAngleAxis dataKey="subject" tick={{ fill: '#475569', fontSize: 10, fontWeight: 700 }} />
                        <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fill: '#94a3b8', fontSize: 8 }} />
                        <Radar
                          name={focusedAdminKpi.adminName}
                          dataKey="A"
                          stroke="#2563eb"
                          fill="#3b82f6"
                          fillOpacity={0.35}
                        />
                      </RadarChart>
                    </ResponsiveContainer>
                  </div>

                  <div className="space-y-3">
                    <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200/80 dark:border-slate-800">
                      <div className="flex justify-between text-xs font-bold text-slate-700 dark:text-slate-300">
                        <span>1. Validasi Sales Order &amp; Website</span>
                        <span className="text-blue-600 dark:text-blue-400 font-black">{focusedAdminKpi.validasiSoWeb}%</span>
                      </div>
                      <div className="w-full bg-slate-200 dark:bg-slate-800 h-2 rounded-full mt-1.5 overflow-hidden">
                        <div className="bg-blue-600 h-full rounded-full" style={{ width: `${focusedAdminKpi.validasiSoWeb}%` }} />
                      </div>
                    </div>

                    <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200/80 dark:border-slate-800">
                      <div className="flex justify-between text-xs font-bold text-slate-700 dark:text-slate-300">
                        <span>2. Pembuatan Faktur Penjualan</span>
                        <span className="text-emerald-600 dark:text-emerald-400 font-black">{focusedAdminKpi.pembuatanFaktur}%</span>
                      </div>
                      <div className="w-full bg-slate-200 dark:bg-slate-800 h-2 rounded-full mt-1.5 overflow-hidden">
                        <div className="bg-emerald-500 h-full rounded-full" style={{ width: `${focusedAdminKpi.pembuatanFaktur}%` }} />
                      </div>
                    </div>

                    <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200/80 dark:border-slate-800">
                      <div className="flex justify-between text-xs font-bold text-slate-700 dark:text-slate-300">
                        <span>3. Pengecekan Faktur Penjualan</span>
                        <span className="text-violet-600 dark:text-violet-400 font-black">{focusedAdminKpi.pengecekanFaktur}%</span>
                      </div>
                      <div className="w-full bg-slate-200 dark:bg-slate-800 h-2 rounded-full mt-1.5 overflow-hidden">
                        <div className="bg-violet-500 h-full rounded-full" style={{ width: `${focusedAdminKpi.pengecekanFaktur}%` }} />
                      </div>
                    </div>

                    <div className="p-3 rounded-xl bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/60 flex items-center justify-between">
                      <span className="text-xs font-black text-amber-900 dark:text-amber-300">
                        Rata-rata Prosentase Sebulan
                      </span>
                      <span className="text-sm font-black text-amber-600 dark:text-amber-400">
                        {focusedAdminKpi.avgMonthlyPct}%
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* FITUR KESALAHAN PENGINPUTAN DISKON */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <div className="p-2.5 rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
                    <BadgePercent className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-tight">
                      Monitoring Kesalahan Penginputan Diskon
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Pencatatan &amp; audit kesalahan input diskon pada Sales Order / Faktur Penjualan oleh Admin
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setDscAdmin(activeBranchAdminNames[0] || '');
                    setIsAddDiscountErrOpen(prev => !prev);
                  }}
                  className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer self-start sm:self-auto"
                >
                  <Plus className="w-4 h-4" />
                  <span>{isAddDiscountErrOpen ? 'Tutup Form' : 'Catat Kesalahan Diskon'}</span>
                </button>
              </div>

              {isAddDiscountErrOpen && (
                <form
                  onSubmit={e => {
                    e.preventDefault();
                    const targetAdmin = (dscAdmin || activeBranchAdminNames[0] || '').trim().toUpperCase();
                    if (!targetAdmin || !dscNoFaktur.trim() || !dscCustomer.trim()) {
                      showToast('Mohon isi Nama Admin, No Faktur/SO, dan Nama Pelanggan.');
                      return;
                    }
                    const targetBr = sidoarjoAdminNames.includes(targetAdmin)
                      ? 'cab-sidoarjo'
                      : selectedBranchId === 'ALL'
                      ? 'cab-banyuwangi'
                      : selectedBranchId;

                    const newLog: DiscountErrorLogItem = {
                      id: `dsc-${Date.now()}`,
                      date: new Date().toISOString().slice(0, 10),
                      branchId: targetBr,
                      month: selectedMonth,
                      year: selectedYear,
                      adminName: targetAdmin,
                      noFakturOrSo: dscNoFaktur.trim().toUpperCase(),
                      customerName: dscCustomer.trim().toUpperCase(),
                      expectedDiscount: parseNum(dscExpected),
                      inputDiscount: parseNum(dscInput),
                      selisihNominal: parseNum(dscSelisihRp),
                      keterangan: dscKeterangan.trim() || 'Kesalahan penginputan diskon penjualan'
                    };

                    setDiscountErrorLogs(prev => [newLog, ...prev]);
                    setDscNoFaktur('');
                    setDscCustomer('');
                    setDscExpected('');
                    setDscInput('');
                    setDscSelisihRp('');
                    setDscKeterangan('');
                    setIsAddDiscountErrOpen(false);
                    showToast(`Kesalahan input diskon untuk ${targetAdmin} berhasil dicatat.`);
                  }}
                  className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3"
                >
                  <div>
                    <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Nama Admin</label>
                    <select
                      value={dscAdmin}
                      onChange={e => setDscAdmin(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-bold"
                    >
                      {activeBranchAdminNames.map(a => (
                        <option key={a} value={a}>{a}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">No. Faktur / SO</label>
                    <input
                      type="text"
                      value={dscNoFaktur}
                      onChange={e => setDscNoFaktur(e.target.value)}
                      placeholder="Contoh: FJ02-1126-0912"
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Nama Pelanggan</label>
                    <input
                      type="text"
                      value={dscCustomer}
                      onChange={e => setDscCustomer(e.target.value)}
                      placeholder="Contoh: TK SINAR BARU"
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Diskon Seharusnya (%)</label>
                    <input
                      type="number"
                      step="0.1"
                      value={dscExpected}
                      onChange={e => setDscExpected(e.target.value)}
                      placeholder="Contoh: 2.5"
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Diskon Terinput (%)</label>
                    <input
                      type="number"
                      step="0.1"
                      value={dscInput}
                      onChange={e => setDscInput(e.target.value)}
                      placeholder="Contoh: 5"
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Nominal Selisih Diskon (Rp)</label>
                    <input
                      type="number"
                      value={dscSelisihRp}
                      onChange={e => setDscSelisihRp(e.target.value)}
                      placeholder="Contoh: 75000"
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Keterangan Kesalahan Diskon</label>
                    <input
                      type="text"
                      value={dscKeterangan}
                      onChange={e => setDscKeterangan(e.target.value)}
                      placeholder="Rincian penyebab kesalahan input diskon..."
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs"
                    />
                  </div>
                  <div className="flex items-end justify-end gap-2">
                    <button
                      type="submit"
                      className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold cursor-pointer"
                    >
                      Simpan Catatan Diskon
                    </button>
                  </div>
                </form>
              )}

              <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
                <table className="w-full text-left text-xs divide-y divide-slate-200 dark:divide-slate-800">
                  <thead className="bg-slate-50 dark:bg-slate-950 text-slate-500 dark:text-slate-400 text-[10px] font-black uppercase">
                    <tr>
                      <th className="py-3 px-3">No</th>
                      <th className="py-3 px-3">Tanggal</th>
                      <th className="py-3 px-3">Nama Admin</th>
                      <th className="py-3 px-3">No. Faktur / SO</th>
                      <th className="py-3 px-3">Nama Pelanggan</th>
                      <th className="py-3 px-3 text-center">Diskon Seharusnya</th>
                      <th className="py-3 px-3 text-center">Diskon Terinput</th>
                      <th className="py-3 px-3 text-right">Selisih Diskon</th>
                      <th className="py-3 px-3">Keterangan</th>
                      <th className="py-3 px-3 text-center">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                    {discountErrorLogs
                      .filter(
                        d =>
                          (selectedBranchId === 'ALL' || d.branchId === selectedBranchId) &&
                          (selectedAdminFilter === 'SEMUA ADMIN' ||
                            d.adminName.toUpperCase() === selectedAdminFilter.toUpperCase())
                      )
                      .map((log, i) => (
                        <tr key={log.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40">
                          <td className="py-2.5 px-3 font-semibold">{i + 1}</td>
                          <td className="py-2.5 px-3">{log.date}</td>
                          <td className="py-2.5 px-3 font-black text-slate-900 dark:text-white">{log.adminName}</td>
                          <td className="py-2.5 px-3 font-mono font-semibold">{log.noFakturOrSo}</td>
                          <td className="py-2.5 px-3 font-semibold">{log.customerName}</td>
                          <td className="py-2.5 px-3 text-center text-emerald-600 font-bold">{log.expectedDiscount}%</td>
                          <td className="py-2.5 px-3 text-center text-rose-600 font-bold">{log.inputDiscount}%</td>
                          <td className="py-2.5 px-3 text-right font-bold text-rose-600">
                            Rp {formatRp(log.selisihNominal)}
                          </td>
                          <td className="py-2.5 px-3 text-slate-600 dark:text-slate-300">{log.keterangan}</td>
                          <td className="py-2.5 px-3 text-center">
                            <button
                              type="button"
                              onClick={() =>
                                setDiscountErrorLogs(prev => prev.filter(x => x.id !== log.id))
                              }
                              className="p-1 rounded text-rose-600 hover:bg-rose-50 cursor-pointer"
                              title="Hapus catatan"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* =================================================================== */}
        {/* VIEW 2: DENDA CHECKER                                               */}
        {/* Kolom: Nama, Nama Pelanggan, No Faktur, Keterangan, Nominal Selisih,*/}
        {/* Kalian Selisih, Denda + Fitur Upload Excel & Tambah Manual          */}
        {/* =================================================================== */}
        {activeTab === 'sales_kpi_fines' && (
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-5 shadow-xs animate-fade-in">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
                  <ShieldAlert className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-black text-slate-900 dark:text-white">
                    Akumulasi Sanksi &amp; Denda Checker
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Perhitungan denda otomatis dari Nominal Selisih &times; Kali-an Selisih per Faktur Pelanggan
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <div className="bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 px-4 py-2 rounded-xl">
                  <div className="text-[10px] text-rose-600 dark:text-rose-400 font-black uppercase">
                    Total Denda Checker
                  </div>
                  <div className="text-base sm:text-lg font-black text-rose-700 dark:text-rose-300">
                    Rp {formatRp(filteredDendaChecker.reduce((s, r) => s + r.totalDenda, 0))}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setNewDendaAdmin(activeBranchAdminNames[0] || '');
                    setIsAddDendaManualOpen(prev => !prev);
                  }}
                  className="px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-xs cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>{isAddDendaManualOpen ? 'Tutup Form Manual' : 'Tambah Manual'}</span>
                </button>
              </div>
            </div>

            {isAddDendaManualOpen && (
              <form
                onSubmit={handleAddManualDenda}
                className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-4"
              >
                <div className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider border-b border-slate-200 dark:border-slate-800 pb-2">
                  Tambah Manual Denda Checker
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
                  <div>
                    <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">
                      Nama (Admin / Checker)
                    </label>
                    <select
                      value={newDendaAdmin}
                      onChange={e => setNewDendaAdmin(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-bold"
                    >
                      {activeBranchAdminNames.map(a => (
                        <option key={a} value={a}>{a}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">
                      Nama Pelanggan
                    </label>
                    <input
                      type="text"
                      value={newDendaCustomer}
                      onChange={e => setNewDendaCustomer(e.target.value)}
                      placeholder="Contoh: TK BELLIA SUMBER AYU"
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">
                      No Faktur
                    </label>
                    <input
                      type="text"
                      value={newDendaNoFaktur}
                      onChange={e => setNewDendaNoFaktur(e.target.value)}
                      placeholder="Contoh: FJ02-1126-1080"
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">
                      Nominal Selisih (Rp)
                    </label>
                    <input
                      type="number"
                      min={0}
                      value={newDendaNominalSelisih}
                      onChange={e => setNewDendaNominalSelisih(e.target.value)}
                      placeholder="Contoh: 25000"
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">
                      Kali-an Selisih (Pengali Denda)
                    </label>
                    <input
                      type="number"
                      min={0.5}
                      step="0.5"
                      value={newDendaKalianSelisih}
                      onChange={e => setNewDendaKalianSelisih(e.target.value)}
                      placeholder="Contoh: 2"
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">
                      Hasil Denda Otomatis (Rp)
                    </label>
                    <div className="px-3 py-2 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 text-xs font-black text-rose-600 dark:text-rose-400">
                      Rp {formatRp(parseNum(newDendaNominalSelisih) * (parseNum(newDendaKalianSelisih) || 1))}
                    </div>
                  </div>

                  <div className="sm:col-span-2 lg:col-span-3">
                    <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">
                      Keterangan
                    </label>
                    <input
                      type="text"
                      value={newDendaKeterangan}
                      onChange={e => setNewDendaKeterangan(e.target.value)}
                      placeholder="Masukkan keterangan rincian selisih faktur..."
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs"
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setIsAddDendaManualOpen(false)}
                    className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold cursor-pointer"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold cursor-pointer"
                  >
                    Simpan Denda
                  </button>
                </div>
              </form>
            )}

            <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
              <table className="w-full text-left text-xs divide-y divide-slate-200 dark:divide-slate-800">
                <thead className="bg-slate-50 dark:bg-slate-950 text-slate-600 dark:text-slate-300 text-[11px] font-black uppercase">
                  <tr>
                    <th className="py-3 px-3 text-center w-10">No</th>
                    <th className="py-3 px-3">Nama</th>
                    <th className="py-3 px-3">Nama Pelanggan</th>
                    <th className="py-3 px-3">No Faktur</th>
                    <th className="py-3 px-3">Keterangan</th>
                    <th className="py-3 px-3 text-right">Nominal Selisih</th>
                    <th className="py-3 px-3 text-center">Kalian Selisih</th>
                    <th className="py-3 px-3 text-right">Hasil Denda</th>
                    <th className="py-3 px-3 text-center w-14">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                  {filteredDendaChecker.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-8 text-center text-slate-400 italic">
                        Belum ada data denda checker untuk filter cabang/admin ini.
                      </td>
                    </tr>
                  ) : (
                    filteredDendaChecker.map((fine, idx) => (
                      <tr key={fine.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40">
                        <td className="py-3 px-3 text-center font-semibold">{idx + 1}</td>
                        <td className="py-3 px-3 font-black text-slate-900 dark:text-white">{fine.adminName}</td>
                        <td className="py-3 px-3 font-semibold text-slate-800 dark:text-slate-200">{fine.customerName}</td>
                        <td className="py-3 px-3 font-mono font-bold text-blue-600 dark:text-blue-400">{fine.noFaktur}</td>
                        <td className="py-3 px-3 text-slate-600 dark:text-slate-300">{fine.keterangan}</td>
                        <td className="py-3 px-3 whitespace-nowrap">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-slate-400">Rp</span>
                            <span className="font-bold tabular-nums">{formatRp(fine.nominalSelisih)}</span>
                          </div>
                        </td>
                        <td className="py-3 px-3 text-center">
                          <span className="px-2.5 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 font-black">
                            {fine.kalianSelisih}x
                          </span>
                        </td>
                        <td className="py-3 px-3 whitespace-nowrap">
                          <div className="flex items-center justify-between gap-2 text-rose-600 dark:text-rose-400 font-black">
                            <span>Rp</span>
                            <span className="tabular-nums">{formatRp(fine.totalDenda)}</span>
                          </div>
                        </td>
                        <td className="py-3 px-3 text-center">
                          <button
                            type="button"
                            onClick={() =>
                              setDendaCheckerList(prev => prev.filter(x => x.id !== fine.id))
                            }
                            className="p-1 rounded text-rose-600 hover:bg-rose-50 cursor-pointer"
                            title="Hapus baris denda"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* =================================================================== */}
        {/* VIEW 3: EVALUASI ANALISA REORDER                                    */}
        {/* (Nusantara Dr. Soetomo & Nusantara Expand: Total Reorder Mingguan,  */}
        {/* Total Barang Sudah Terkirim [Faktur], Belum Terkirim [SO Menunggu]) */}
        {/* =================================================================== */}
        {activeTab === 'sales_kpi_nusantara' && (
          <div className="space-y-6 animate-fade-in">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-2xl shadow-xs">
              <div>
                <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase">
                  Evaluasi Analisa Reorder Mingguan (Perbandingan SO Menunggu vs Faktur)
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Proporsi Total Reorder Mingguan, Barang Sudah Terkirim (Faktur), dan Barang Belum Terkirim (SO Menunggu)
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsAddReorderOpen(prev => !prev)}
                className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer self-start sm:self-auto"
              >
                <Plus className="w-4 h-4" />
                <span>{isAddReorderOpen ? 'Tutup Input Reorder' : 'Update Data Reorder Mingguan'}</span>
              </button>
            </div>

            {isAddReorderOpen && (
              <form
                onSubmit={e => {
                  e.preventDefault();
                  const terkirim = Math.max(0, Math.round(parseNum(reoTerkirimFaktur)));
                  const belum = Math.max(0, Math.round(parseNum(reoBelumTerkirimSo)));
                  const total = terkirim + belum;
                  if (total <= 0) {
                    showToast('Masukkan jumlah Faktur Terkirim atau SO Menunggu.');
                    return;
                  }
                  setReorderList(prev => {
                    const idx = prev.findIndex(
                      r => r.unit === reoUnit && r.weekLabel === reoWeek
                    );
                    const nextItem: ReorderWeeklyItem = {
                      id: idx >= 0 ? prev[idx].id : `reo-${Date.now()}`,
                      unit: reoUnit,
                      weekLabel: reoWeek,
                      month: selectedMonth,
                      year: selectedYear,
                      totalReorder: total,
                      terkirimFaktur: terkirim,
                      belumTerkirimSo: belum
                    };
                    if (idx >= 0) {
                      const clone = [...prev];
                      clone[idx] = nextItem;
                      return clone;
                    }
                    return [...prev, nextItem];
                  });
                  setReoTerkirimFaktur('');
                  setReoBelumTerkirimSo('');
                  setIsAddReorderOpen(false);
                  showToast(`Data Evaluasi Reorder ${reoUnit} (${reoWeek}) berhasil diperbarui.`);
                }}
                className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-2xl grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 items-end"
              >
                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Unit Nusantara</label>
                  <select
                    value={reoUnit}
                    onChange={e => setReoUnit(e.target.value as any)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-xs font-bold"
                  >
                    <option value="Nusantara Dr. Soetomo">Nusantara Dr. Soetomo</option>
                    <option value="Nusantara Expand">Nusantara Expand</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Minggu</label>
                  <select
                    value={reoWeek}
                    onChange={e => setReoWeek(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-xs font-bold"
                  >
                    <option value="Minggu 1">Minggu 1</option>
                    <option value="Minggu 2">Minggu 2</option>
                    <option value="Minggu 3">Minggu 3</option>
                    <option value="Minggu 4">Minggu 4</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">
                    Sudah Terkirim (Faktur)
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={reoTerkirimFaktur}
                    onChange={e => setReoTerkirimFaktur(e.target.value)}
                    placeholder="Contoh: 410"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-xs"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">
                    Belum Terkirim (SO Menunggu)
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={reoBelumTerkirimSo}
                    onChange={e => setReoBelumTerkirimSo(e.target.value)}
                    placeholder="Contoh: 55"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-xs"
                  />
                </div>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold cursor-pointer"
                >
                  Simpan Reorder
                </button>
              </form>
            )}

            {/* 2 Panel Utama: Nusantara Dr. Soetomo & Nusantara Expand */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {[
                {
                  title: 'NUSANTARA DR. SOETOMO',
                  subtitle: 'Evaluasi Reorder dari perbandingan SO Menunggu & Faktur Terkirim',
                  color: '#4f46e5',
                  data: reorderStats.soetomo
                },
                {
                  title: 'NUSANTARA EXPAND',
                  subtitle: 'Evaluasi Reorder rute ekspansi dari perbandingan SO Menunggu & Faktur',
                  color: '#0891b2',
                  data: reorderStats.expand
                }
              ].map(panel => (
                <div
                  key={panel.title}
                  className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs space-y-5"
                >
                  <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                    <div>
                      <h4 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider">
                        {panel.title}
                      </h4>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">{panel.subtitle}</p>
                    </div>
                    <span className="px-3 py-1 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 text-xs font-black">
                      Terkirim: {panel.data.pctTerkirim}%
                    </span>
                  </div>

                  {/* 3 Metrik Reorder dengan Prosentase */}
                  <div className="grid grid-cols-3 gap-3">
                    <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200/70 dark:border-slate-800">
                      <span className="text-[10px] font-bold text-slate-400 uppercase block">
                        Total Reorder Mingguan
                      </span>
                      <div className="text-base sm:text-lg font-black text-slate-900 dark:text-white mt-1">
                        {formatRp(panel.data.totalReorder)} Item
                      </div>
                      <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400">
                        100% (Faktur + SO Menunggu)
                      </span>
                    </div>

                    <div className="p-3 rounded-xl bg-emerald-50/60 dark:bg-emerald-950/30 border border-emerald-200/70 dark:border-emerald-800/60">
                      <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-400 uppercase block">
                        Sudah Terkirim (Faktur)
                      </span>
                      <div className="text-base sm:text-lg font-black text-emerald-700 dark:text-emerald-300 mt-1">
                        {formatRp(panel.data.terkirimFaktur)} ({panel.data.pctTerkirim}%)
                      </div>
                      <span className="text-[10px] font-bold text-emerald-600">
                        Dari Faktur Terbit
                      </span>
                    </div>

                    <div className="p-3 rounded-xl bg-amber-50/60 dark:bg-amber-950/30 border border-amber-200/70 dark:border-amber-800/60">
                      <span className="text-[10px] font-bold text-amber-700 dark:text-amber-400 uppercase block">
                        Belum Terkirim (SO)
                      </span>
                      <div className="text-base sm:text-lg font-black text-amber-700 dark:text-amber-300 mt-1">
                        {formatRp(panel.data.belumTerkirimSo)} ({panel.data.pctBelumTerkirim}%)
                      </div>
                      <span className="text-[10px] font-bold text-amber-600">
                        Dari SO Menunggu
                      </span>
                    </div>
                  </div>

                  {/* Donut + Weekly Composed Chart */}
                  <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
                    <div className="md:col-span-5 flex flex-col items-center">
                      <div className="relative w-36 h-36">
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie
                              data={[
                                { name: 'Sudah Terkirim (Faktur)', value: panel.data.pctTerkirim },
                                { name: 'Belum Terkirim (SO Menunggu)', value: panel.data.pctBelumTerkirim }
                              ]}
                              cx="50%"
                              cy="50%"
                              innerRadius={45}
                              outerRadius={62}
                              startAngle={90}
                              endAngle={-270}
                              dataKey="value"
                            >
                              <Cell fill="#10b981" />
                              <Cell fill="#f59e0b" />
                            </Pie>
                            <Tooltip />
                          </PieChart>
                        </ResponsiveContainer>
                        <div className="absolute inset-0 flex flex-col items-center justify-center">
                          <span className="text-xl font-black text-slate-900 dark:text-white">
                            {panel.data.pctTerkirim}%
                          </span>
                          <span className="text-[9px] font-bold text-slate-400 uppercase">Terkirim</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 text-[10px] font-bold mt-2">
                        <span className="flex items-center gap-1 text-emerald-600">
                          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                          Terkirim ({panel.data.pctTerkirim}%)
                        </span>
                        <span className="flex items-center gap-1 text-amber-600">
                          <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                          Belum ({panel.data.pctBelumTerkirim}%)
                        </span>
                      </div>
                    </div>

                    <div className="md:col-span-7 h-[200px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <ComposedChart
                          data={panel.data.rows.map(r => ({
                            ...r,
                            pctTerkirim:
                              r.totalReorder > 0
                                ? Number(((r.terkirimFaktur / r.totalReorder) * 100).toFixed(1))
                                : 0
                          }))}
                          margin={{ top: 5, right: 5, left: -20, bottom: 5 }}
                        >
                          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                          <XAxis dataKey="weekLabel" tick={{ fill: '#64748b', fontSize: 10 }} axisLine={false} tickLine={false} />
                          <YAxis tick={{ fill: '#64748b', fontSize: 10 }} axisLine={false} tickLine={false} />
                          <Tooltip />
                          <Legend wrapperStyle={{ fontSize: '10px' }} />
                          <Bar dataKey="totalReorder" name="Total Reorder" fill="#6366f1" radius={[3, 3, 0, 0]} barSize={14} />
                          <Bar dataKey="terkirimFaktur" name="Terkirim (Faktur)" fill="#10b981" radius={[3, 3, 0, 0]} barSize={14} />
                          <Bar dataKey="belumTerkirimSo" name="Belum Terkirim (SO)" fill="#f59e0b" radius={[3, 3, 0, 0]} barSize={14} />
                        </ComposedChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  {/* Tabel Rincian Per Minggu */}
                  <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
                    <table className="w-full text-xs text-left divide-y divide-slate-200 dark:divide-slate-800">
                      <thead className="bg-slate-50 dark:bg-slate-950 text-[10px] font-black uppercase text-slate-500">
                        <tr>
                          <th className="py-2 px-3">Periode Minggu</th>
                          <th className="py-2 px-3 text-right">Total Reorder</th>
                          <th className="py-2 px-3 text-right">Terkirim (Faktur)</th>
                          <th className="py-2 px-3 text-right">Belum Terkirim (SO)</th>
                          <th className="py-2 px-3 text-center">% Terkirim</th>
                          <th className="py-2 px-3 text-center">% Belum</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                        {panel.data.rows.map(r => {
                          const pKirim = r.totalReorder > 0 ? ((r.terkirimFaktur / r.totalReorder) * 100).toFixed(1) : '0.0';
                          const pBelum = r.totalReorder > 0 ? ((r.belumTerkirimSo / r.totalReorder) * 100).toFixed(1) : '0.0';
                          return (
                            <tr key={r.id}>
                              <td className="py-2 px-3 font-bold">{r.weekLabel}</td>
                              <td className="py-2 px-3 text-right font-bold">{formatRp(r.totalReorder)}</td>
                              <td className="py-2 px-3 text-right font-semibold text-emerald-600">{formatRp(r.terkirimFaktur)}</td>
                              <td className="py-2 px-3 text-right font-semibold text-amber-600">{formatRp(r.belumTerkirimSo)}</td>
                              <td className="py-2 px-3 text-center font-black text-emerald-600">{pKirim}%</td>
                              <td className="py-2 px-3 text-center font-black text-amber-600">{pBelum}%</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* =================================================================== */}
        {/* VIEW 4: OMSET ADMIN PENJUALAN                                       */}
        {/* =================================================================== */}
        {activeTab === 'sales_kpi_omset' && (
          <div className="space-y-6 animate-fade-in">
            {/* ROW 1: OMZET NETTO CARD */}
            <div className="grid grid-cols-1 gap-4">
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs space-y-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  OMZET NETTO
                </span>
                <div className="text-xl sm:text-2xl font-black text-blue-600 dark:text-blue-400 tabular-nums">
                  Rp {formatRp(omsetSummary.omzetNetto)}
                </div>
                <div>
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400">
                    &#8600; {omsetSummary.diffOmzet < 0 ? `-Rp ${formatRp(Math.abs(omsetSummary.diffOmzet))}` : `+Rp ${formatRp(omsetSummary.diffOmzet)}`} ({Math.abs(Number(omsetSummary.diffOmzetPct)).toString().replace('.', ',')}%)
                  </span>
                </div>
              </div>
            </div>

            {/* ROW 2: RINGKASAN OMZET — RATA-RATA HARIAN & QTY */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 sm:p-6 shadow-xs space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <span className="text-[10px] font-black uppercase tracking-widest text-blue-600 dark:text-blue-400 block">
                    RINGKASAN OMZET
                  </span>
                  <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-white mt-0.5">
                    Rata-rata Harian &amp; Qty
                  </h3>
                </div>
                <span className="px-3.5 py-1.5 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 text-xs font-bold self-start sm:self-auto">
                  Bulan berjalan: hari ke-{omsetSummary.hariBerjalan} dari {omsetSummary.totalHariBulanIni}
                </span>
              </div>

              <p className="text-xs sm:text-sm font-semibold text-slate-600 dark:text-slate-300">
                Bulan berjalan {selectedMonth} {selectedYear} secara rata-rata harian turun 5,8% dibanding bulan lalu.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                <div className="p-4 rounded-2xl bg-slate-50/80 dark:bg-slate-950 border border-slate-200/70 dark:border-slate-800 space-y-1.5">
                  <span className="text-[10px] font-bold uppercase text-slate-400">RATA-RATA HARIAN INI</span>
                  <div className="text-base sm:text-lg font-black text-slate-900 dark:text-white tabular-nums">
                    Rp {formatRp(omsetSummary.rataHarianIni)}
                  </div>
                  <span className="inline-block px-2 py-0.5 rounded-md bg-rose-50 dark:bg-rose-950/50 text-rose-600 text-[11px] font-bold">
                    {omsetSummary.diffHarianPct.replace('.', ',')}%
                  </span>
                </div>

                <div className="p-4 rounded-2xl bg-slate-50/80 dark:bg-slate-950 border border-slate-200/70 dark:border-slate-800 space-y-1.5">
                  <span className="text-[10px] font-bold uppercase text-slate-400">RATA-RATA BULAN LALU</span>
                  <div className="text-base sm:text-lg font-black text-slate-900 dark:text-white tabular-nums">
                    Rp {formatRp(omsetSummary.rataBulanLalu)}
                  </div>
                  <span className="text-xs text-slate-500 font-semibold block">
                    Pembagi {omsetSummary.pembagiBulanLalu} hari
                  </span>
                </div>

                <div className="p-4 rounded-2xl bg-slate-50/80 dark:bg-slate-950 border border-slate-200/70 dark:border-slate-800 space-y-1.5">
                  <span className="text-[10px] font-bold uppercase text-slate-400">QTY HARIAN</span>
                  <div className="text-base sm:text-lg font-black text-slate-900 dark:text-white tabular-nums">
                    {formatQtyId(omsetSummary.qtyHarian)}
                  </div>
                  <span className="inline-block px-2 py-0.5 rounded-md bg-rose-50 dark:bg-rose-950/50 text-rose-600 text-[11px] font-bold">
                    -15,2%
                  </span>
                </div>
              </div>
            </div>

            {/* ROW 3: GRAFIK BULANAN 2026 */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs flex flex-col justify-between space-y-4">
              <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm sm:text-base font-black text-slate-900 dark:text-white">
                    Grafik Bulanan {selectedYear}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Perbandingan omzet per bulan dalam tahun terpilih.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <div className="inline-flex rounded-xl bg-slate-100 dark:bg-slate-800 p-1">
                    {(['Bulanan', 'Mingguan', 'Harian'] as const).map(mode => (
                      <button
                        key={mode}
                        type="button"
                        onClick={() => setOmzetChartGranularity(mode)}
                        className={`px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                          omzetChartGranularity === mode
                            ? 'bg-blue-600 text-white shadow-xs'
                            : 'text-slate-600 dark:text-slate-300'
                        }`}
                      >
                        {mode}
                      </button>
                    ))}
                  </div>

                  <button
                    type="button"
                    onClick={() => setShowOmzetNumbers(prev => !prev)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition cursor-pointer ${
                      showOmzetNumbers
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-800'
                    }`}
                  >
                    TAMPILKAN ANGKA
                  </button>

                  <span className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-bold">
                    Netto tahun ini: Rp 93.640.898.831
                  </span>
                </div>
              </div>

              <div className="h-[310px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={MONTHLY_OMZET_SERIES_2026} margin={{ top: 10, right: 10, left: -10, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                    <XAxis dataKey="month" tick={{ fill: '#64748b', fontSize: 10, fontWeight: 700 }} axisLine={false} tickLine={false} />
                    <YAxis
                      tick={{ fill: '#64748b', fontSize: 10 }}
                      axisLine={false}
                      tickLine={false}
                      tickFormatter={v => `Rp ${v} M`}
                    />
                    <Tooltip
                      formatter={(val: any, name: any) => [`Rp ${val} Miliar`, String(name || '')]}
                    />
                    <Legend wrapperStyle={{ fontSize: '11px', fontWeight: 700 }} />
                    <Bar
                      dataKey="omzetNetto"
                      name="Omzet Netto"
                      fill="#4f83f1"
                      radius={[6, 6, 0, 0]}
                      barSize={28}
                      label={showOmzetNumbers ? { position: 'top', fontSize: 9, fill: '#334155' } : false}
                    />
                    <Line
                      type="monotone"
                      dataKey="target"
                      name="Target"
                      stroke="#f59e0b"
                      strokeWidth={2.5}
                      strokeDasharray="5 5"
                      dot={{ fill: '#fff', stroke: '#f59e0b', strokeWidth: 2, r: 4 }}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* ROW 4: TOP ADMIN (PENGGANTI TOP SALES) & TOP KOTA (GAMBAR 8) */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Left: Top Admin (Omzet netto per admin) */}
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 flex items-center justify-center">
                      <User className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-sm font-black text-slate-900 dark:text-white">Top Admin</h4>
                      <p className="text-[11px] text-slate-500">Omzet netto per admin penjualan</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-1 rounded-lg bg-blue-50 dark:bg-blue-950/50 text-blue-600 text-[10px] font-bold">
                      TAMPILKAN SEMUA
                    </span>
                    <button
                      type="button"
                      onClick={handleDownloadOmsetTemplate}
                      className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-[10px] font-bold cursor-pointer"
                    >
                      EXPORT
                    </button>
                  </div>
                </div>

                <div className="space-y-4 divide-y divide-slate-100 dark:divide-slate-800">
                  {synchronizedOmsetRows.map((adm, idx) => {
                    const maxOmzet = Math.max(...synchronizedOmsetRows.map(x => x.omzetNetto), 1);
                    const widthPct = Math.max(15, Math.round((adm.omzetNetto / maxOmzet) * 100));
                    const targetPct = adm.targetNominal > 0 ? ((adm.omzetNetto / adm.targetNominal) * 100).toFixed(1) : '35,0';
                    const diffVsLast = adm.omzetNetto - adm.lastMonthOmzet;
                    const diffVsLastPct = adm.lastMonthOmzet > 0 ? ((diffVsLast / adm.lastMonthOmzet) * 100).toFixed(1) : '-15,0';
                    return (
                      <div key={adm.id} className={idx > 0 ? 'pt-3.5 space-y-2' : 'space-y-2'}>
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="text-xs font-black text-slate-900 dark:text-white">
                              {adm.adminName} ({adm.branchCode})
                            </div>
                            <div className="text-[11px] text-slate-500 font-semibold">
                              Qty {formatRp(adm.qtyNetto)} PCS
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-xs sm:text-sm font-black text-slate-900 dark:text-white tabular-nums">
                              Rp {formatRp(adm.omzetNetto)}
                            </div>
                            <div className="flex items-center justify-end gap-1.5 mt-0.5">
                              <span className="px-1.5 py-0.5 rounded bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 text-[10px] font-bold">
                                +2,3%
                              </span>
                              <span className="px-1.5 py-0.5 rounded bg-rose-50 dark:bg-rose-950/50 text-rose-600 text-[10px] font-bold">
                                {targetPct.replace('.', ',')}% Target
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="space-y-1">
                          <div className="w-full bg-slate-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
                            <div className="bg-blue-600 h-full rounded-full" style={{ width: `${widthPct}%` }} />
                          </div>
                          <div className="w-full bg-slate-100 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden">
                            <div className="bg-rose-500 h-full rounded-full" style={{ width: `${Math.min(100, Number(targetPct))}%` }} />
                          </div>
                        </div>

                        <div className="text-[10px] text-slate-500 font-semibold flex flex-wrap items-center gap-1.5">
                          <span>
                            Vs bulan lalu: Rp {formatRp(adm.lastMonthOmzet)} &bull; Selisih qty {formatRp(adm.qtyNetto - adm.lastMonthQty)} PCS &bull; Target Rp {formatRp(adm.targetNominal)}
                          </span>
                          <span className="px-1.5 py-0.5 rounded bg-rose-50 text-rose-600 font-bold">
                            &#9660; {diffVsLastPct.replace('.', ',')}%
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Right: Top Kota */}
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 flex items-center justify-center">
                      <MapPin className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-sm font-black text-slate-900 dark:text-white">Top Kota</h4>
                      <p className="text-[11px] text-slate-500">Klik kota untuk lihat pelanggan dan barang</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setSelectedKotaFilter('SEMUA KOTA')}
                      className="px-2.5 py-1 rounded-lg bg-blue-50 dark:bg-blue-950/50 text-blue-600 text-[10px] font-bold cursor-pointer"
                    >
                      TAMPILKAN SEMUA
                    </button>
                    <span className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-[10px] font-bold">
                      EXPORT
                    </span>
                  </div>
                </div>

                <div className="space-y-4 divide-y divide-slate-100 dark:divide-slate-800">
                  {[
                    {
                      kota: 'GENTENG',
                      omzet: 407796179,
                      qty: '497.583 PCS',
                      pctBadge: '+35,0%',
                      isPositive: true,
                      vsText: 'Vs bulan lalu: Rp 668.809.157 • Selisih qty +41.637 PCS',
                      vsBadge: '▲ +141,6%',
                      vsPos: true,
                      barPct: 100
                    },
                    {
                      kota: 'BALI - DENPASAR',
                      omzet: 398989114,
                      qty: '175.594 PCS',
                      pctBadge: '+37,8%',
                      isPositive: true,
                      vsText: 'Vs bulan lalu: Rp 641.155.802 • Selisih qty -318.150 PCS',
                      vsBadge: '▼ -21,3%',
                      vsPos: false,
                      barPct: 96
                    },
                    {
                      kota: 'JEMBER',
                      omzet: 162291327,
                      qty: '263.363 PCS',
                      pctBadge: '-28,2%',
                      isPositive: false,
                      vsText: 'Vs bulan lalu: Rp 500.354.607 • Selisih qty -786.602 PCS',
                      vsBadge: '▼ -44,5%',
                      vsPos: false,
                      barPct: 45
                    },
                    {
                      kota: 'SURABAYA UTARA',
                      omzet: 155971215,
                      qty: '873.780 PCS',
                      pctBadge: '+12,4%',
                      isPositive: true,
                      vsText: 'Vs bulan lalu: Rp 412.110.000 • Selisih qty +62.400 PCS',
                      vsBadge: '▲ +18,2%',
                      vsPos: true,
                      barPct: 42
                    }
                  ].map((k, idx) => (
                    <div
                      key={k.kota}
                      onClick={() => setSelectedKotaFilter(k.kota)}
                      className={`${idx > 0 ? 'pt-3.5' : ''} space-y-2 cursor-pointer hover:opacity-90`}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="text-xs font-black text-slate-900 dark:text-white">{k.kota}</div>
                          <div className="text-[11px] text-slate-500 font-semibold">Qty {k.qty}</div>
                        </div>
                        <div className="text-right">
                          <div className="text-xs sm:text-sm font-black text-slate-900 dark:text-white">
                            Rp {formatRp(k.omzet)}
                          </div>
                          <span
                            className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-bold ${
                              k.isPositive
                                ? 'bg-emerald-50 text-emerald-600'
                                : 'bg-rose-50 text-rose-600'
                            }`}
                          >
                            {k.pctBadge}
                          </span>
                        </div>
                      </div>
                      <div className="w-full bg-slate-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
                        <div className="bg-blue-600 h-full rounded-full" style={{ width: `${k.barPct}%` }} />
                      </div>
                      <div className="text-[10px] text-slate-500 font-semibold flex items-center gap-1.5">
                        <span>{k.vsText}</span>
                        <span
                          className={`px-1.5 py-0.5 rounded font-bold ${
                            k.vsPos ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'
                          }`}
                        >
                          {k.vsBadge}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* ROW 5: TOP CUSTOMER & TOP BARANG (GAMBAR 9) */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Left: Top Customer */}
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 flex items-center justify-center">
                      <Users className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-sm font-black text-slate-900 dark:text-white">Top Customer</h4>
                      <p className="text-[11px] text-slate-500">Klik customer untuk lihat barang yang dibeli</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-1 rounded-lg bg-blue-50 dark:bg-blue-950/50 text-blue-600 text-[10px] font-bold">
                      TAMPILKAN SEMUA
                    </span>
                    <span className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-[10px] font-bold">
                      EXPORT
                    </span>
                  </div>
                </div>

                <div className="space-y-4 divide-y divide-slate-100 dark:divide-slate-800">
                  {TOP_CUSTOMERS_DATA.map((cust, idx) => (
                    <div key={cust.name} className={`${idx > 0 ? 'pt-3.5' : ''} space-y-2`}>
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="text-xs font-black text-slate-900 dark:text-white">{cust.name}</div>
                          <div className="text-[11px] text-slate-500 font-semibold">Qty {cust.qty}</div>
                        </div>
                        <div className="text-right">
                          <div className="text-xs sm:text-sm font-black text-slate-900 dark:text-white">
                            Rp {formatRp(cust.omzet)}
                          </div>
                          <span className="inline-block px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-600 text-[10px] font-bold">
                            {cust.growthPct}
                          </span>
                        </div>
                      </div>
                      <div className="w-full bg-slate-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
                        <div className="bg-blue-600 h-full rounded-full" style={{ width: `${cust.progressPct}%` }} />
                      </div>
                      <div className="text-[10px] text-slate-500 font-semibold flex items-center gap-1.5">
                        <span>{cust.vsLastMonth}</span>
                        <span
                          className={`px-1.5 py-0.5 rounded font-bold ${
                            cust.isVsNegative ? 'bg-rose-50 text-rose-600' : 'bg-emerald-50 text-emerald-600'
                          }`}
                        >
                          {cust.vsBadge}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Right: Top Barang */}
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 flex items-center justify-center">
                      <Package className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-sm font-black text-slate-900 dark:text-white">Top Barang</h4>
                      <p className="text-[11px] text-slate-500">Klik barang untuk lihat pembeli dan kota</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-1 rounded-lg bg-blue-50 dark:bg-blue-950/50 text-blue-600 text-[10px] font-bold">
                      TAMPILKAN SEMUA
                    </span>
                    <span className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-[10px] font-bold">
                      EXPORT
                    </span>
                  </div>
                </div>

                <div className="space-y-4 divide-y divide-slate-100 dark:divide-slate-800">
                  {TOP_BARANG_DATA.map((brg, idx) => (
                    <div key={brg.name} className={`${idx > 0 ? 'pt-3.5' : ''} space-y-2`}>
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="text-xs font-black text-slate-900 dark:text-white">{brg.name}</div>
                          <div className="text-[11px] text-slate-500 font-semibold">Qty {brg.qty}</div>
                        </div>
                        <div className="text-right">
                          <div className="text-xs sm:text-sm font-black text-slate-900 dark:text-white">
                            Rp {formatRp(brg.omzet)}
                          </div>
                          <span
                            className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-bold ${
                              brg.isPositive ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'
                            }`}
                          >
                            {brg.growthPct}
                          </span>
                        </div>
                      </div>
                      <div className="w-full bg-slate-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
                        <div className="bg-blue-600 h-full rounded-full" style={{ width: `${brg.progressPct}%` }} />
                      </div>
                      <div className="text-[10px] text-slate-500 font-semibold flex items-center gap-1.5">
                        <span>{brg.vsLastMonth}</span>
                        <span
                          className={`px-1.5 py-0.5 rounded font-bold ${
                            brg.isVsNegative ? 'bg-rose-50 text-rose-600' : 'bg-emerald-50 text-emerald-600'
                          }`}
                        >
                          {brg.vsBadge}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* ROW 7: ANALISA OMZET — ANALISA PRIORITAS ADMIN (GAMBAR 10) */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 sm:p-6 shadow-xs space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-black uppercase tracking-widest text-blue-600 dark:text-blue-400 block">
                    ANALISA OMZET
                  </span>
                  <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-white mt-0.5">
                    Analisa Prioritas Admin
                  </h3>
                </div>
                <span className="px-3.5 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-xs font-bold">
                  {selectedMonth} {selectedYear}
                </span>
              </div>

              <div className="space-y-2.5">
                {[
                  {
                    key: 'performa',
                    title: 'Tampilkan Ringkasan Performa',
                    iconColor: 'text-blue-600',
                    content: `Total Omzet Netto Admin periode ${selectedMonth} ${selectedYear} mencapai Rp ${formatRp(omsetSummary.omzetNetto)} (${omsetSummary.achvPct.replace('.', ',')}% dari target bulanan Rp ${formatRp(omsetSummary.targetBulanIni)}). Kontributor tertinggi saat ini adalah ${synchronizedOmsetRows[0]?.adminName || '-'} dengan capaian Rp ${formatRp(synchronizedOmsetRows[0]?.omzetNetto || 0)}.`
                  },
                  {
                    key: 'barang',
                    title: 'Tampilkan Barang Prioritas Follow Up',
                    iconColor: 'text-amber-600',
                    content:
                      'Prioritas follow up stok & SO: MIKA AG B4A (100/2.000) mengalami penurunan -22,9% dibanding bulan lalu, sementara MIKA AG B3A dan SENDOK BBK JAGUAR mencatat pertumbuhan tinggi di atas +20%.'
                  },
                  {
                    key: 'customer',
                    title: 'Tampilkan Customer / Toko Prioritas Follow Up',
                    iconColor: 'text-violet-600',
                    content:
                      'Toko prioritas re-order minggu ini: TK CENTRAL PLASTIK (selisih qty -148.028 PCS vs bulan lalu) dan CV DEWI SRI MAJU untuk penjadwalan ulang pengiriman kontrak bulanan.'
                  },
                  {
                    key: 'kota',
                    title: 'Tampilkan Kota Penyumbang Turun',
                    iconColor: 'text-rose-600',
                    content:
                      'Area/Kota dengan penurunan rata-rata harian: JEMBER (-28,2% vs bulan lalu) memerlukan percepatan validasi SO & rilis faktur pengiriman pagi.'
                  },
                  {
                    key: 'admin',
                    title: 'Tampilkan Perbandingan Admin',
                    iconColor: 'text-emerald-600',
                    content: synchronizedOmsetRows
                      .map(
                        a =>
                          `${a.adminName} (${a.branchCode}): Rp ${formatRp(a.omzetNetto)} (Qty ${formatRp(a.qtyNetto)} PCS)`
                      )
                      .join(' • ')
                  }
                ].map(sec => {
                  const isOpen = Boolean(openAnalisaAccordion[sec.key]);
                  return (
                    <div
                      key={sec.key}
                      className="rounded-xl border border-slate-200/90 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 overflow-hidden"
                    >
                      <button
                        type="button"
                        onClick={() =>
                          setOpenAnalisaAccordion(prev => ({ ...prev, [sec.key]: !prev[sec.key] }))
                        }
                        className="w-full px-4 py-3 text-left flex items-center justify-between text-xs font-black text-slate-900 dark:text-white hover:bg-slate-100/70 dark:hover:bg-slate-900 transition cursor-pointer"
                      >
                        <span className="flex items-center gap-2.5">
                          <TrendingUp className={`w-4 h-4 ${sec.iconColor}`} />
                          <span>{sec.title}</span>
                        </span>
                        {isOpen ? (
                          <ChevronUp className="w-4 h-4 text-slate-400" />
                        ) : (
                          <ChevronDown className="w-4 h-4 text-slate-400" />
                        )}
                      </button>
                      {isOpen && (
                        <div className="px-4 pb-3.5 pt-1 text-xs text-slate-600 dark:text-slate-300 leading-relaxed border-t border-slate-100 dark:border-slate-800/80">
                          {sec.content}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
