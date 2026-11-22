import React, { useState, useMemo, useEffect, useRef } from 'react';
import * as XLSX from 'xlsx';
import {
  Package,
  Search,
  Plus,
  CheckCircle2,
  AlertTriangle,
  Upload,
  FileSpreadsheet,
  Eye,
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Download,
  Building2,
  Warehouse,
  Calendar,
  RefreshCw,
  X,
  Sliders,
  Filter,
  Trash2,
  Lock,
  Clock,
  User
} from 'lucide-react';
import { Warehouse3DSimulation } from './Warehouse3DSimulation';
import {
  WarehouseItemCubicationView,
  WarehouseFleetCubicationSimulator
} from './WarehouseCubicationModules';
import { branchStore, BranchRecord } from '../services/branchStore';
import { WarehouseDatabaseBarangView } from './WarehouseDatabaseBarangView';
import { databaseBarangService, isLegacySeededBarang } from '../services/databaseBarangService';

export type WmsSubTab =
  | 'overview'
  | 'inventory'
  | 'inbound'
  | 'outbound'
  | 'scanner'
  | 'slotting'
  | 'opname'
  | 'purchasing_opname'
  | 'kartu_stok'
  | 'cubication'
  | 'fleet_cubication';

export interface WarehouseOpnameAuditItem {
  id: string;
  kodeBarang: string;
  namaBarang: string;
  kategori: string;
  namaGudang: string;
  cabang: string;
  satuan: string;
  stokSistem: number;
  stokFisik: number;
  selisihOpname?: number | null;
  hitungan1?: number | null;
  hitungan2?: number | null;
  reorderQty: number;
  tanggalAudit: string;
  auditor: string;
  namaAdmin?: string;
  jamMulai?: string;
  jamSelesai?: string;
  purchasingStatus: 'Sesuai Sistem' | 'Perlu Kirim ke Pembelian' | 'Terkirim ke Adm Pembelian' | 'Diproses PO Pembelian';
  catatan: string;
}

export interface WarehouseOpnameSessionMeta {
  namaGudang: string;
  cabang: string;
  tanggalOpname: string;
  namaAdmin: string;
  jamMulai: string;
  jamSelesai: string;
}

export function calculateOpnameDuration(jamMulai?: string, jamSelesai?: string): { minutes: number; label: string } {
  const start = (jamMulai || '').trim();
  const end = (jamSelesai || '').trim();
  if (!start || !end || !start.includes(':') || !end.includes(':')) {
    return { minutes: 0, label: '—' };
  }
  const [sh, sm] = start.split(':').map(n => parseInt(n, 10));
  const [eh, em] = end.split(':').map(n => parseInt(n, 10));
  if ([sh, sm, eh, em].some(n => Number.isNaN(n))) {
    return { minutes: 0, label: '—' };
  }
  let diff = eh * 60 + em - (sh * 60 + sm);
  if (diff < 0) diff += 24 * 60;
  if (diff === 0) return { minutes: 0, label: '0 Menit' };
  const hours = Math.floor(diff / 60);
  const mins = diff % 60;
  if (hours > 0 && mins > 0) return { minutes: diff, label: `${hours} Jam ${mins} Menit` };
  if (hours > 0) return { minutes: diff, label: `${hours} Jam` };
  return { minutes: diff, label: `${mins} Menit` };
}

export function getOpnameSelisihValue(item: WarehouseOpnameAuditItem): number | null {
  if (item.selisihOpname !== undefined && item.selisihOpname !== null && !Number.isNaN(Number(item.selisihOpname))) {
    return Number(item.selisihOpname);
  }
  return null;
}

export function computeOpnameSelisih(item: WarehouseOpnameAuditItem): number {
  const manual = getOpnameSelisihValue(item);
  if (manual !== null) return manual;
  const hasH2 = item.hitungan2 !== undefined && item.hitungan2 !== null && !Number.isNaN(Number(item.hitungan2));
  const hasH1 = item.hitungan1 !== undefined && item.hitungan1 !== null && !Number.isNaN(Number(item.hitungan1));
  if (hasH2) {
    return (hasH1 ? Number(item.hitungan1) : 0) - Number(item.hitungan2);
  }
  const fisik = hasH1 ? Number(item.hitungan1) : Number(item.stokFisik || 0);
  return fisik - Number(item.stokSistem || 0);
}

export const LS_KEY_OPNAME_PURCHASING_SYNC = 'akk_wms_opname_purchasing_sync_v1';

export const INITIAL_OPNAME_AUDIT_ITEMS: WarehouseOpnameAuditItem[] = [
  {
    id: 'OPN-2611-001',
    kodeBarang: '7GPJA001',
    namaBarang: 'CUP PLST JAGUAR BR 10 OZ NAT @50 (40SLP/CRT)',
    kategori: 'Paper Cup & Food Pack',
    namaGudang: 'Gudang Utama Banyuwangi',
    cabang: 'Banyuwangi',
    satuan: 'CRT',
    stokSistem: 120,
    stokFisik: 95,
    selisihOpname: null,
    hitungan1: 95,
    hitungan2: null,
    reorderQty: 0,
    tanggalAudit: '2026-11-07',
    auditor: 'Tim Opname Gudang',
    purchasingStatus: 'Terkirim ke Adm Pembelian',
    catatan: ''
  },
  {
    id: 'OPN-2611-002',
    kodeBarang: '7AFBG453',
    namaBarang: 'ALUFOIL REFIL BAGUS 45X7,62M (24PCS/CRT)',
    kategori: 'Box Kemasan Makanan',
    namaGudang: 'Gudang Utama Banyuwangi',
    cabang: 'Banyuwangi',
    satuan: 'CRT',
    stokSistem: 80,
    stokFisik: 62,
    selisihOpname: null,
    hitungan1: 62,
    hitungan2: null,
    reorderQty: 0,
    tanggalAudit: '2026-11-07',
    auditor: 'Tim Opname Gudang',
    purchasingStatus: 'Perlu Kirim ke Pembelian',
    catatan: ''
  },
  {
    id: 'OPN-2611-003',
    kodeBarang: '7AT00935',
    namaBarang: 'ALU TRAY OX-935 (100PCS/PAK)',
    kategori: 'Box Kemasan Makanan',
    namaGudang: 'Sidoarjo',
    cabang: 'Sidoarjo',
    satuan: 'PAK',
    stokSistem: 210,
    stokFisik: 210,
    selisihOpname: null,
    hitungan1: 210,
    hitungan2: null,
    reorderQty: 0,
    tanggalAudit: '2026-11-07',
    auditor: 'Tim Opname Gudang',
    purchasingStatus: 'Sesuai Sistem',
    catatan: ''
  },
  {
    id: 'OPN-2611-004',
    kodeBarang: '7KRBJ406',
    namaBarang: 'KR BAJA (HJ) 40X68 KN @40 (60PAK/ZAK)',
    kategori: 'Plastik & Stretch Film',
    namaGudang: 'Denpasar',
    cabang: 'Bali',
    satuan: 'ZAK',
    stokSistem: 65,
    stokFisik: 48,
    selisihOpname: null,
    hitungan1: 48,
    hitungan2: null,
    reorderQty: 0,
    tanggalAudit: '2026-11-07',
    auditor: 'Tim Opname Gudang',
    purchasingStatus: 'Diproses PO Pembelian',
    catatan: ''
  }
];

export interface MasterSkuRecord {
  id: string;
  kategoriBarang: string;
  noBarang: string;
  namaBarang: string;
  stokTersedia: number;
  satuan: string;
  cabang?: string;
  lokasiStock?: string;
  tanggalStok?: string;
  panjangCm?: number;
  lebarCm?: number;
  tinggiCm?: number;
  kubikasiM3?: number;
  beratKg?: number;
}

export function inferKategoriBarang(noBarang: string, namaBarang: string, explicitKategori?: string): string {
  if (explicitKategori && explicitKategori.trim()) return explicitKategori.trim();
  const text = `${noBarang} ${namaBarang}`.toUpperCase();
  if (text.includes('DOUBLE WALL') || text.includes('CB-FLUTE') || text.includes('EXPORT') || text.includes('EKSPOR')) {
    return 'Karton Box Double Wall';
  }
  if (text.includes('FOOD GRADE') || text.includes('PIZZA') || text.includes('MAKANAN')) {
    return 'Box Kemasan Makanan';
  }
  if (text.includes('PAPER CUP') || text.includes('PAPER BOWL') || text.includes('LUNCH BOX') || text.includes('GELAS PLASTIK') || text.includes('PRD-')) {
    return 'Paper Cup & Food Pack';
  }
  if (text.includes('STRETCH FILM') || text.includes('PLASTIK') || text.includes('BUBBLE WRAP') || text.includes('ZIPPER') || text.includes('PLS-')) {
    return 'Plastik & Stretch Film';
  }
  if (text.includes('LAKBAN') || text.includes('STRAPPING') || text.includes('KLEM') || text.includes('MPK-')) {
    return 'Lakban & Strapping Band';
  }
  return 'Karton Box Corrugated';
}

export interface RawKartuStokRow {
  kodeBarang: string;
  tanggal: string; // YYYY-MM-DD or DD/MM/YYYY
  namaBarang: string;
  kuantitasMasuk: number;
  kuantitas: number;
  namaGudang: string;
}

export interface KartuStokAnalysisRecord {
  id: string;
  kodeBarang: string;
  namaBarang: string;
  tglKuantitasMinimum: string;
  tglStokMasuk: string;
  kuantitasMasuk: number;
  selisihHari: number;
  kuantitasTerakhir: number;
  namaGudang: string;
}

const INITIAL_MASTER_SKUS: MasterSkuRecord[] = [];

const INITIAL_KARTU_STOK_ANALYSIS: KartuStokAnalysisRecord[] = [
  {
    id: 'ksa-1',
    kodeBarang: 'AKK-KBX-001',
    namaBarang: 'Karton Box Corrugated B-Flute 60x40x40 cm (Polos)',
    tglKuantitasMinimum: '12/10/2026',
    tglStokMasuk: '15/10/2026',
    kuantitasMasuk: 3500,
    selisihHari: 3,
    kuantitasTerakhir: 4850,
    namaGudang: 'Gudang Utama Banyuwangi'
  },
  {
    id: 'ksa-2',
    kodeBarang: 'AKK-KBX-002',
    namaBarang: 'Karton Box Double Wall CB-Flute Export 80x50x50 cm',
    tglKuantitasMinimum: '08/10/2026',
    tglStokMasuk: '14/10/2026',
    kuantitasMasuk: 1500,
    selisihHari: 6,
    kuantitasTerakhir: 1120,
    namaGudang: 'Gudang Utama Banyuwangi'
  },
  {
    id: 'ksa-3',
    kodeBarang: 'AKK-KBX-003',
    namaBarang: 'Box Kemasan Makanan Food Grade Ivory 22x22x8 cm',
    tglKuantitasMinimum: '18/10/2026',
    tglStokMasuk: '20/10/2026',
    kuantitasMasuk: 5000,
    selisihHari: 2,
    kuantitasTerakhir: 9400,
    namaGudang: 'Gudang Utama Banyuwangi'
  },
  {
    id: 'ksa-4',
    kodeBarang: 'AKK-PLS-014',
    namaBarang: 'Stretch Film Pallet Wrap 50cm x 300m (17 Micron)',
    tglKuantitasMinimum: '05/10/2026',
    tglStokMasuk: '12/10/2026',
    kuantitasMasuk: 120,
    selisihHari: 7,
    kuantitasTerakhir: 68,
    namaGudang: 'Sidoarjo'
  },
  {
    id: 'ksa-5',
    kodeBarang: 'AKK-PLS-019',
    namaBarang: 'Plastik Kemasan HD/PE Grosir Uk. 35x55 cm',
    tglKuantitasMinimum: '15/10/2026',
    tglStokMasuk: '19/10/2026',
    kuantitasMasuk: 250,
    selisihHari: 4,
    kuantitasTerakhir: 420,
    namaGudang: 'Gudang Utama Banyuwangi'
  },
  {
    id: 'ksa-6',
    kodeBarang: 'AKK-MPK-007',
    namaBarang: 'Lakban OPP Coklat Heavy Duty 48mm x 90 Yard',
    tglKuantitasMinimum: '10/10/2026',
    tglStokMasuk: '15/10/2026',
    kuantitasMasuk: 60,
    selisihHari: 5,
    kuantitasTerakhir: 32,
    namaGudang: 'Sidoarjo'
  },
  {
    id: 'ksa-7',
    kodeBarang: 'AKK-MPK-011',
    namaBarang: 'Strapping Band PP 15mm Kuning (10 Kg / Roll)',
    tglKuantitasMinimum: '11/10/2026',
    tglStokMasuk: '14/10/2026',
    kuantitasMasuk: 100,
    selisihHari: 3,
    kuantitasTerakhir: 145,
    namaGudang: 'Gudang Utama Banyuwangi'
  },
  {
    id: 'ksa-8',
    kodeBarang: 'AKK-PRD-025',
    namaBarang: 'Paper Cup Hot 8 Oz Custom Print + Lid',
    tglKuantitasMinimum: '19/10/2026',
    tglStokMasuk: '23/10/2026',
    kuantitasMasuk: 200,
    selisihHari: 4,
    kuantitasTerakhir: 275,
    namaGudang: 'Gudang Utama Banyuwangi'
  },
  {
    id: 'ksa-9',
    kodeBarang: 'AKK-KBX-004',
    namaBarang: 'Karton Box Polos E-Flute 40x30x25 cm',
    tglKuantitasMinimum: '20/10/2026',
    tglStokMasuk: '22/10/2026',
    kuantitasMasuk: 2400,
    selisihHari: 2,
    kuantitasTerakhir: 3600,
    namaGudang: 'Gudang Utama Banyuwangi'
  },
  {
    id: 'ksa-10',
    kodeBarang: 'AKK-KBX-005',
    namaBarang: 'Karton Box C-Flute Tebal 50x35x35 cm',
    tglKuantitasMinimum: '14/10/2026',
    tglStokMasuk: '18/10/2026',
    kuantitasMasuk: 3000,
    selisihHari: 4,
    kuantitasTerakhir: 4100,
    namaGudang: 'Gudang Utama Banyuwangi'
  },
  {
    id: 'ksa-11',
    kodeBarang: 'AKK-PRD-031',
    namaBarang: 'Lunch Box Paper Eco Kraft Size L (Isi 500 Pcs)',
    tglKuantitasMinimum: '16/10/2026',
    tglStokMasuk: '21/10/2026',
    kuantitasMasuk: 180,
    selisihHari: 5,
    kuantitasTerakhir: 340,
    namaGudang: 'Sidoarjo'
  },
  {
    id: 'ksa-12',
    kodeBarang: 'AKK-KBX-009',
    namaBarang: 'Box Die-Cut Pizza Kraft Coklat 25x25x5 cm',
    tglKuantitasMinimum: '21/10/2026',
    tglStokMasuk: '24/10/2026',
    kuantitasMasuk: 4000,
    selisihHari: 3,
    kuantitasTerakhir: 5200,
    namaGudang: 'Gudang Utama Banyuwangi'
  }
];

const LS_KEY_MASTER_SKU = 'akk_wms_master_sku_v3';
const LS_KEY_MASTER_SKU_LEGACY = 'akk_wms_master_sku_v2';
const LS_KEY_KARTU_STOK = 'akk_wms_kartu_stok_analysis_v2';
const LS_KEY_LOKASI_LIST = 'akk_wms_lokasi_stock_list_v1';

// Helper to parse flexible numeric values from Excel cells
function parseNumericCell(val: any): number {
  if (typeof val === 'number' && !isNaN(val)) return val;
  if (typeof val === 'string') {
    const cleaned = val.replace(/[^\d,-]/g, '').replace(',', '.');
    const num = parseFloat(cleaned);
    return isNaN(num) ? 0 : num;
  }
  return 0;
}

// Helper to parse flexible dates (Excel serial number, YYYY-MM-DD, DD/MM/YYYY, DD-MM-YYYY)
function parseExcelDateToObj(val: any): Date | null {
  if (!val && val !== 0) return null;
  if (val instanceof Date && !isNaN(val.getTime())) return val;
  if (typeof val === 'number') {
    // Excel serial date
    const utcDays = Math.floor(val - 25569);
    const d = new Date(utcDays * 86400 * 1000);
    if (!isNaN(d.getTime())) return d;
  }
  const str = String(val).trim();
  // Match DD/MM/YYYY or DD-MM-YYYY
  const dmyMatch = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
  if (dmyMatch) {
    const day = Number(dmyMatch[1]);
    const month = Number(dmyMatch[2]) - 1;
    const year = Number(dmyMatch[3]);
    return new Date(year, month, day);
  }
  // Match YYYY-MM-DD
  const ymdMatch = str.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/);
  if (ymdMatch) {
    const year = Number(ymdMatch[1]);
    const month = Number(ymdMatch[2]) - 1;
    const day = Number(ymdMatch[3]);
    return new Date(year, month, day);
  }
  const parsed = new Date(str);
  return isNaN(parsed.getTime()) ? null : parsed;
}

function formatDateID(d: Date | null, fallback = '-'): string {
  if (!d || isNaN(d.getTime())) return fallback;
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

// Normalize header key for fuzzy matching
function normalizeKey(k: string): string {
  return String(k || '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

// Automatically analyze raw Kartu Stok rows into KartuStokAnalysisRecord[]
function analyzeRawKartuStokRows(
  rawRows: RawKartuStokRow[],
  defaultGudang: string
): KartuStokAnalysisRecord[] {
  // Group rows by kodeBarang + namaGudang
  const groups = new Map<string, RawKartuStokRow[]>();
  rawRows.forEach((row) => {
    const code = row.kodeBarang.trim().toUpperCase();
    if (!code) return;
    const wh = (row.namaGudang || defaultGudang || 'Gudang Utama').trim();
    const key = `${code}__${wh}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push({ ...row, kodeBarang: code, namaGudang: wh });
  });

  const results: KartuStokAnalysisRecord[] = [];
  let idx = 1;

  groups.forEach((rows) => {
    // Sort chronologically by parsed date
    const sorted = [...rows].sort((a, b) => {
      const da = parseExcelDateToObj(a.tanggal)?.getTime() ?? 0;
      const db = parseExcelDateToObj(b.tanggal)?.getTime() ?? 0;
      return da - db;
    });

    const first = sorted[0];
    const last = sorted[sorted.length - 1];
    const kodeBarang = first.kodeBarang;
    const namaBarang =
      sorted.find(r => r.namaBarang && r.namaBarang.trim().length > 0)?.namaBarang ||
      'Barang Kemasan AKK';
    const namaGudang = first.namaGudang || defaultGudang;
    const kuantitasTerakhir = last.kuantitas;

    // Find minimum stock row (prioritize <= 0 / kosong, or lowest kuantitas)
    let minIdx = 0;
    let minVal = sorted[0].kuantitas;
    for (let i = 0; i < sorted.length; i++) {
      if (sorted[i].kuantitas <= 0) {
        minIdx = i;
        minVal = sorted[i].kuantitas;
        break; // First time it hits empty (0)
      }
      if (sorted[i].kuantitas < minVal) {
        minVal = sorted[i].kuantitas;
        minIdx = i;
      }
    }

    const minRow = sorted[minIdx];
    const minDateObj = parseExcelDateToObj(minRow.tanggal);

    // Find next stock in (kuantitasMasuk > 0) after or on minIdx; fallback to any row with kuantitasMasuk > 0
    let masukRow = sorted.slice(minIdx).find(r => r.kuantitasMasuk > 0);
    if (!masukRow) {
      masukRow = sorted.find(r => r.kuantitasMasuk > 0) || last;
    }

    const masukDateObj = parseExcelDateToObj(masukRow.tanggal);
    let selisihHari = 0;
    if (minDateObj && masukDateObj) {
      const diffMs = masukDateObj.getTime() - minDateObj.getTime();
      selisihHari = Math.max(0, Math.round(diffMs / (1000 * 60 * 60 * 24)));
    }

    results.push({
      id: `ksa-${Date.now()}-${idx++}`,
      kodeBarang,
      namaBarang,
      tglKuantitasMinimum: formatDateID(minDateObj, minRow.tanggal || '-'),
      tglStokMasuk: formatDateID(masukDateObj, masukRow.tanggal || '-'),
      kuantitasMasuk: masukRow.kuantitasMasuk,
      selisihHari,
      kuantitasTerakhir,
      namaGudang
    });
  });

  return results;
}

export const WarehouseManagementSystem: React.FC<{
  initialTab?: WmsSubTab;
  onNavigateTab?: (tab: WmsSubTab) => void;
}> = ({ initialTab = 'overview', onNavigateTab }) => {
  const [activeTab, setActiveTab] = useState<WmsSubTab>(initialTab);

  // Master SKU State (Kosong secara default, terpisah dari Database Barang penjualan)
  const [skuItems, setSkuItems] = useState<MasterSkuRecord[]>(() => {
    try {
      localStorage.removeItem(LS_KEY_MASTER_SKU);
      localStorage.removeItem(LS_KEY_MASTER_SKU_LEGACY);
    } catch {}
    return [];
  });

  // Kartu Stok Analysis State (persisted in localStorage)
  const [kartuStokList, setKartuStokList] = useState<KartuStokAnalysisRecord[]>(() => {
    try {
      const saved = localStorage.getItem(LS_KEY_KARTU_STOK);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed.filter((item: any) => !isLegacySeededBarang(item?.kodeBarang));
        }
      }
    } catch {
      // ignore
    }
    return INITIAL_KARTU_STOK_ANALYSIS.filter(item => !isLegacySeededBarang(item.kodeBarang));
  });

  // Dynamic Lokasi Stock List
  const [lokasiList, setLokasiList] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem(LS_KEY_LOKASI_LIST);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {
      // ignore
    }
    return ['Sidoarjo', 'Gudang Utama Banyuwangi', 'Farly', 'Gajah Mada', 'Denpasar'];
  });

  // Opname Gudang & Stok Opname State (persisted server-side via /api/warehouse/opname)
  const [opnameAuditList, setOpnameAuditList] = useState<WarehouseOpnameAuditItem[]>(INITIAL_OPNAME_AUDIT_ITEMS);
  const [opnameSessions, setOpnameSessions] = useState<Record<string, WarehouseOpnameSessionMeta>>(() => ({
    'Gudang Utama Banyuwangi': {
      namaGudang: 'Gudang Utama Banyuwangi',
      cabang: 'Banyuwangi',
      tanggalOpname: new Date().toISOString().slice(0, 10),
      namaAdmin: 'Admin Opname',
      jamMulai: '08:00',
      jamSelesai: ''
    }
  }));
  const opnameHydratedRef = useRef(false);

  const [opnameSearch, setOpnameSearch] = useState('');
  const [opnameBranchFilter, setOpnameBranchFilter] = useState('ALL');
  const [opnameActiveGudang, setOpnameActiveGudang] = useState('Gudang Utama Banyuwangi');

  const [purchasingOpnameView, setPurchasingOpnameView] = useState<'main' | 'upload_excel'>('main');
  const [purchasingOpnameSearch, setPurchasingOpnameSearch] = useState('');
  const [purchasingOpnameBranchFilter, setPurchasingOpnameBranchFilter] = useState('ALL');
  const [purchasingOpnameGudangFilter, setPurchasingOpnameGudangFilter] = useState('ALL');
  const [purchasingOpnameDateFilter, setPurchasingOpnameDateFilter] = useState('');
  const [purchasingOpnameConditionFilter, setPurchasingOpnameConditionFilter] = useState<'ALL' | 'SELISIH' | 'KLOP' | 'BELUM'>('ALL');
  const [isReloadingOpname, setIsReloadingOpname] = useState(false);
  const [isAddOpnameModalOpen, setIsAddOpnameModalOpen] = useState(false);
  const [newOpnameForm, setNewOpnameForm] = useState({
    kodeBarang: '',
    namaBarang: '',
    namaGudang: 'Gudang Utama Banyuwangi',
    cabang: 'Banyuwangi',
    tanggalAudit: new Date().toISOString().slice(0, 10),
    namaAdmin: 'Admin Opname',
    jamMulai: '08:00',
    jamSelesai: '',
    satuan: 'PAK',
    selisihOpname: '',
    hitungan1: '',
    hitungan2: '',
    catatan: ''
  });

  // Upload Excel Stok Opname Page States
  const opnameExcelInputRef = useRef<HTMLInputElement | null>(null);
  const [uploadOpnameFileName, setUploadOpnameFileName] = useState('');
  const [uploadOpnameHeaders, setUploadOpnameHeaders] = useState<string[]>([]);
  const [uploadOpnameRawRows, setUploadOpnameRawRows] = useState<Record<string, any>[]>([]);
  const [uploadOpnameColMap, setUploadOpnameColMap] = useState({
    kode: '',
    namaBarang: '',
    selisih: '',
    satuan: '',
    hitungan1: '',
    hitungan2: '',
    keterangan: ''
  });
  const [uploadOpnameMeta, setUploadOpnameMeta] = useState({
    tanggalOpname: new Date().toISOString().slice(0, 10),
    namaGudang: 'Gudang Utama Banyuwangi',
    cabang: 'Banyuwangi',
    namaAdmin: '',
    jamMulai: '08:00',
    jamSelesai: ''
  });
  const [uploadOpnameImportMode, setUploadOpnameImportMode] = useState<'append' | 'replace_warehouse'>('replace_warehouse');
  const [isSavingOpnameUpload, setIsSavingOpnameUpload] = useState(false);

  const LEGACY_SEED_NOTES = new Set([
    'Selisih -25 CRT hasil audit fisik rak A1',
    'Stok fisik menipis di bawah buffer minimum',
    'Klop antara fisik gudang dan kartu stok',
    'Sudah diteruskan ke Adm Pembelian untuk PO supplier'
  ]);

  const normalizeLoadedOpnameItems = (rawItems: WarehouseOpnameAuditItem[]): WarehouseOpnameAuditItem[] =>
    rawItems.map(item => ({
      ...item,
      selisihOpname:
        item.selisihOpname !== undefined && item.selisihOpname !== null && !Number.isNaN(Number(item.selisihOpname))
          ? Number(item.selisihOpname)
          : null,
      catatan: LEGACY_SEED_NOTES.has((item.catatan || '').trim()) ? '' : item.catatan || ''
    }));

  const getCurrentHHMM = () => {
    const now = new Date();
    return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  };

  const getWarehouseSession = (gudangName: string, fallbackCabang = 'Banyuwangi'): WarehouseOpnameSessionMeta => {
    const existing = opnameSessions[gudangName];
    if (existing) return existing;
    const sampleItem = opnameAuditList.find(i => i.namaGudang === gudangName);
    return {
      namaGudang: gudangName,
      cabang: sampleItem?.cabang || fallbackCabang,
      tanggalOpname: sampleItem?.tanggalAudit || new Date().toISOString().slice(0, 10),
      namaAdmin: sampleItem?.namaAdmin || sampleItem?.auditor || '',
      jamMulai: sampleItem?.jamMulai || '',
      jamSelesai: sampleItem?.jamSelesai || ''
    };
  };

  const updateWarehouseSessionField = (
    gudangName: string,
    patch: Partial<WarehouseOpnameSessionMeta>,
    syncToItems = true
  ) => {
    const current = getWarehouseSession(gudangName);
    const nextMeta: WarehouseOpnameSessionMeta = { ...current, ...patch, namaGudang: gudangName };
    setOpnameSessions(prev => ({ ...prev, [gudangName]: nextMeta }));
    if (syncToItems) {
      setOpnameAuditList(prev =>
        prev.map(row =>
          row.namaGudang === gudangName
            ? {
                ...row,
                tanggalAudit: patch.tanggalOpname !== undefined ? patch.tanggalOpname : row.tanggalAudit,
                namaAdmin: patch.namaAdmin !== undefined ? patch.namaAdmin : row.namaAdmin,
                jamMulai: patch.jamMulai !== undefined ? patch.jamMulai : row.jamMulai,
                jamSelesai: patch.jamSelesai !== undefined ? patch.jamSelesai : row.jamSelesai
              }
            : row
        )
      );
    }
  };

  const availableOpnameWarehouses = useMemo(() => {
    const set = new Set<string>([
      'Gudang Utama Banyuwangi',
      'Gudang Cabang Sidoarjo',
      'Gudang Farly',
      'Gudang Gajah Mada',
      'Gudang Denpasar'
    ]);
    lokasiList.forEach(l => {
      if (l && l.trim()) set.add(l.trim());
    });
    opnameAuditList.forEach(item => {
      if (item.namaGudang && item.namaGudang.trim()) set.add(item.namaGudang.trim());
    });
    Object.keys(opnameSessions).forEach(k => {
      if (k && k.trim()) set.add(k.trim());
    });
    return Array.from(set);
  }, [lokasiList, opnameAuditList, opnameSessions]);

  const detectOpnameColumnMapping = (headers: string[]) => {
    const findCol = (patterns: RegExp[]) => {
      for (const p of patterns) {
        const match = headers.find(h => p.test(h.toLowerCase().trim()));
        if (match) return match;
      }
      return '';
    };
    return {
      kode: findCol([/^kode$/, /kode\s*barang/, /kode\s*item/, /sku/, /^code$/, /kode/]),
      namaBarang: findCol([/nama\s*barang/, /deskripsi/, /description/, /item\s*name/, /nama\s*item/, /barang/, /^nama$/]),
      selisih: findCol([/^selisih$/, /selisih/, /variance/, /diff/]),
      satuan: findCol([/^satuan$/, /uom/, /unit/, /satuan/]),
      hitungan1: findCol([/hitungan\s*1/, /hitung\s*1/, /fisik\s*1/, /count\s*1/, /stok\s*fisik/, /^h1$/]),
      hitungan2: findCol([/hitungan\s*2/, /hitung\s*2/, /fisik\s*2/, /count\s*2/, /^h2$/]),
      keterangan: findCol([/keterangan/, /catatan/, /notes?/, /remark/])
    };
  };

  const handleOpnameExcelFileSelect = (file: File) => {
    const reader = new FileReader();
    reader.onload = evt => {
      try {
        const data = evt.target?.result;
        const wb = XLSX.read(data, { type: 'array' });
        const sheetName = wb.SheetNames[0];
        const ws = wb.Sheets[sheetName];
        const matrix = XLSX.utils.sheet_to_json<any[]>(ws, { header: 1, defval: '' });
        if (!matrix || matrix.length === 0) {
          setPopupModal({
            title: 'File Kosong',
            message: 'File Excel tidak memiliki baris data yang bisa dibaca.'
          });
          return;
        }
        // Find the header row (first row with >= 2 non-empty string cells)
        let headerRowIdx = 0;
        for (let i = 0; i < Math.min(matrix.length, 15); i++) {
          const row = matrix[i] || [];
          const nonEmpty = row.filter(c => String(c ?? '').trim() !== '');
          const joined = nonEmpty.map(c => String(c).toLowerCase()).join(' ');
          if (nonEmpty.length >= 2 && (joined.includes('kode') || joined.includes('nama') || joined.includes('satuan') || joined.includes('hitungan'))) {
            headerRowIdx = i;
            break;
          }
        }
        const rawHeaders = (matrix[headerRowIdx] || []).map((cell, idx) => {
          const text = String(cell ?? '').trim();
          return text || `Kolom ${idx + 1}`;
        });
        const uniqueHeaders: string[] = [];
        const seen = new Map<string, number>();
        rawHeaders.forEach(h => {
          const count = seen.get(h) || 0;
          seen.set(h, count + 1);
          uniqueHeaders.push(count === 0 ? h : `${h} (${count + 1})`);
        });

        const parsedObjects: Record<string, any>[] = [];
        for (let r = headerRowIdx + 1; r < matrix.length; r++) {
          const rowArr = matrix[r] || [];
          const hasValue = rowArr.some(c => String(c ?? '').trim() !== '');
          if (!hasValue) continue;
          const obj: Record<string, any> = {};
          uniqueHeaders.forEach((colName, cIdx) => {
            obj[colName] = rowArr[cIdx] ?? '';
          });
          parsedObjects.push(obj);
        }

        setUploadOpnameFileName(file.name);
        setUploadOpnameHeaders(uniqueHeaders);
        setUploadOpnameRawRows(parsedObjects);
        setUploadOpnameColMap(detectOpnameColumnMapping(uniqueHeaders));
      } catch (err) {
        setPopupModal({
          title: 'Gagal Membaca File Excel',
          message: 'Pastikan format file adalah .xlsx, .xls, atau .csv yang valid.'
        });
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const parsedUploadOpnamePreview = useMemo(() => {
    if (uploadOpnameRawRows.length === 0) return [];
    const parseOptNum = (v: any): number | null => {
      if (v === undefined || v === null) return null;
      const str = String(v).trim().replace(/,/g, '.');
      if (str === '' || str === '-') return null;
      const num = Number(str);
      return Number.isNaN(num) ? null : num;
    };
    return uploadOpnameRawRows
      .map((row, idx) => {
        const kode = uploadOpnameColMap.kode ? String(row[uploadOpnameColMap.kode] ?? '').trim().toUpperCase() : '';
        const namaBarang = uploadOpnameColMap.namaBarang ? String(row[uploadOpnameColMap.namaBarang] ?? '').trim() : '';
        if (!kode && !namaBarang) return null;
        const selVal = uploadOpnameColMap.selisih ? parseOptNum(row[uploadOpnameColMap.selisih]) : null;
        const h1 = uploadOpnameColMap.hitungan1 ? parseOptNum(row[uploadOpnameColMap.hitungan1]) : null;
        const h2 = uploadOpnameColMap.hitungan2 ? parseOptNum(row[uploadOpnameColMap.hitungan2]) : null;
        const satuan = uploadOpnameColMap.satuan
          ? String(row[uploadOpnameColMap.satuan] ?? '').trim().toUpperCase() || 'PAK'
          : 'PAK';
        const catatan = uploadOpnameColMap.keterangan ? String(row[uploadOpnameColMap.keterangan] ?? '').trim() : '';

        return {
          id: `OPN-XLS-${Date.now()}-${idx}`,
          kodeBarang: kode || `SKU-${idx + 1}`,
          namaBarang: namaBarang || kode || `Barang #${idx + 1}`,
          kategori: inferKategoriBarang(kode, namaBarang),
          namaGudang: uploadOpnameMeta.namaGudang.trim() || 'Gudang Utama Banyuwangi',
          cabang: uploadOpnameMeta.cabang || 'Banyuwangi',
          satuan,
          stokSistem: h1 ?? 0,
          stokFisik: h1 ?? 0,
          selisihOpname: selVal,
          hitungan1: h1,
          hitungan2: h2,
          reorderQty: selVal !== null && selVal < 0 ? Math.abs(selVal) : 0,
          tanggalAudit: uploadOpnameMeta.tanggalOpname || new Date().toISOString().slice(0, 10),
          auditor: uploadOpnameMeta.namaAdmin.trim() || 'Admin Opname',
          namaAdmin: uploadOpnameMeta.namaAdmin.trim() || 'Admin Opname',
          jamMulai: uploadOpnameMeta.jamMulai || '',
          jamSelesai: uploadOpnameMeta.jamSelesai || '',
          purchasingStatus: (selVal === 0 ? 'Sesuai Sistem' : 'Terkirim ke Adm Pembelian') as WarehouseOpnameAuditItem['purchasingStatus'],
          catatan
        } as WarehouseOpnameAuditItem;
      })
      .filter(Boolean) as WarehouseOpnameAuditItem[];
  }, [uploadOpnameRawRows, uploadOpnameColMap, uploadOpnameMeta]);

  useEffect(() => {
    let active = true;
    const fetchOpnameFromDb = () => {
      fetch('/api/warehouse/opname', { credentials: 'include', cache: 'no-store' })
        .then(res => (res.ok ? res.json() : null))
        .then(data => {
          if (!active) return;
          if (Array.isArray(data?.items) && data.items.length > 0) {
            setOpnameAuditList(normalizeLoadedOpnameItems(data.items));
          }
          if (data?.sessions && typeof data.sessions === 'object' && Object.keys(data.sessions).length > 0) {
            setOpnameSessions(prev => ({ ...prev, ...data.sessions }));
          }
          opnameHydratedRef.current = true;
        })
        .catch(() => {
          opnameHydratedRef.current = true;
        });
    };
    fetchOpnameFromDb();
    const onExternalSync = () => {
      fetchOpnameFromDb();
    };
    window.addEventListener('akk-opname-purchasing-sync', onExternalSync);
    return () => {
      active = false;
      window.removeEventListener('akk-opname-purchasing-sync', onExternalSync);
    };
  }, []);

  useEffect(() => {
    if (!opnameHydratedRef.current) return;
    const timer = setTimeout(() => {
      fetch('/api/warehouse/opname', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: opnameAuditList, sessions: opnameSessions })
      }).catch(() => {});
    }, 350);
    return () => clearTimeout(timer);
  }, [opnameAuditList, opnameSessions]);

  useEffect(() => {
    try {
      const cleaned = skuItems.filter(item => !isLegacySeededBarang(item.noBarang));
      if (cleaned.length <= 400) {
        localStorage.setItem(LS_KEY_MASTER_SKU, JSON.stringify(cleaned));
      } else {
        localStorage.removeItem(LS_KEY_MASTER_SKU);
      }
    } catch {
      try {
        localStorage.removeItem(LS_KEY_MASTER_SKU);
      } catch {}
    }
  }, [skuItems]);

  useEffect(() => {
    try {
      localStorage.setItem(LS_KEY_KARTU_STOK, JSON.stringify(kartuStokList));
    } catch {
      // ignore
    }
  }, [kartuStokList]);

  useEffect(() => {
    try {
      localStorage.setItem(LS_KEY_LOKASI_LIST, JSON.stringify(lokasiList));
    } catch {
      // ignore
    }
  }, [lokasiList]);

  useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab);
      setIsUploadSkuPageOpen(false);
      setIsUploadKartuStokPageOpen(false);
    }
  }, [initialTab]);

  const handleTabChange = (tab: WmsSubTab) => {
    setActiveTab(tab);
    setIsUploadSkuPageOpen(false);
    setIsUploadKartuStokPageOpen(false);
    if (onNavigateTab) {
      onNavigateTab(tab);
    }
  };

  // Popup Modal Notification (supports Enter key to dismiss)
  const [popupModal, setPopupModal] = useState<{
    title: string;
    message: string;
  } | null>(null);

  useEffect(() => {
    if (!popupModal) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === 'Escape') {
        e.preventDefault();
        setPopupModal(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [popupModal]);

  // ===========================================================================
  // 1. MASTER SKU SEARCH, PAGINATION & UPLOAD EXCEL PAGE STATES
  // ===========================================================================
  const [branches, setBranches] = useState<BranchRecord[]>(() => branchStore.getActiveBranches());
  const [selectedBranchId, setSelectedBranchId] = useState<string>(() =>
    branchStore.getSelectedOriginBranchId()
  );

  useEffect(() => {
    const sync = () => {
      setBranches(branchStore.getActiveBranches());
      setSelectedBranchId(branchStore.getSelectedOriginBranchId());
    };
    return branchStore.subscribe(sync);
  }, []);

  const [skuSearch, setSkuSearch] = useState('');
  const [skuKategoriFilter, setSkuKategoriFilter] = useState<string>('ALL');
  const [skuSatuanFilter, setSkuSatuanFilter] = useState<string>('ALL');
  const [skuPage, setSkuPage] = useState<number>(1);
  const [skuPageSize, setSkuPageSize] = useState<number>(10);

  // Dedicated Page: Upload Master Barang (Master SKU)
  const [isUploadSkuPageOpen, setIsUploadSkuPageOpen] = useState<boolean>(false);
  const [uploadCabang, setUploadCabang] = useState<string>('Banyuwangi');
  const [uploadLokasi, setUploadLokasi] = useState<string>('Gudang Utama Banyuwangi');
  const [uploadTanggal, setUploadTanggal] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  const [uploadFileName, setUploadFileName] = useState<string>('');
  const [parsedSkuPreview, setParsedSkuPreview] = useState<MasterSkuRecord[]>([]);
  const [showSkuPreviewTable, setShowSkuPreviewTable] = useState<boolean>(false);

  // Add Lokasi Modal / Inline Input
  const [isAddLokasiOpen, setIsAddLokasiOpen] = useState<boolean>(false);
  const [newLokasiName, setNewLokasiName] = useState<string>('');

  // Manual Add SKU Modal
  const [isAddSkuModalOpen, setIsAddSkuModalOpen] = useState<boolean>(false);
  const [newSkuForm, setNewSkuForm] = useState({
    kategoriBarang: 'Karton Box Corrugated',
    noBarang: '',
    namaBarang: '',
    stokTersedia: '',
    satuan: 'Pcs'
  });

  const availableKategoriList = useMemo(() => {
    const set = new Set<string>();
    skuItems.forEach(i => {
      if (i.kategoriBarang) set.add(i.kategoriBarang);
    });
    return Array.from(set);
  }, [skuItems]);

  const availableSatuanList = useMemo(() => {
    const set = new Set<string>();
    skuItems.forEach(i => {
      if (i.satuan) set.add(i.satuan);
    });
    return Array.from(set);
  }, [skuItems]);

  const filteredSkus = useMemo(() => {
    const q = skuSearch.trim().toLowerCase();
    return skuItems.filter(item => {
      const itemBranch = branchStore.getInventoryBranch(item.id);
      const matchBranch = selectedBranchId === 'ALL' || itemBranch.id === selectedBranchId;
      const matchSearch =
        !q ||
        (item.kategoriBarang || '').toLowerCase().includes(q) ||
        item.noBarang.toLowerCase().includes(q) ||
        item.namaBarang.toLowerCase().includes(q) ||
        item.satuan.toLowerCase().includes(q);
      const matchKategori = skuKategoriFilter === 'ALL' || item.kategoriBarang === skuKategoriFilter;
      const matchSatuan = skuSatuanFilter === 'ALL' || item.satuan === skuSatuanFilter;
      return matchBranch && matchSearch && matchKategori && matchSatuan;
    });
  }, [skuItems, skuSearch, skuKategoriFilter, skuSatuanFilter, selectedBranchId, branches]);

  const totalSkuPages = Math.max(1, Math.ceil(filteredSkus.length / skuPageSize));
  const currentSkuPage = Math.min(skuPage, totalSkuPages);
  const paginatedSkus = useMemo(() => {
    const start = (currentSkuPage - 1) * skuPageSize;
    return filteredSkus.slice(start, start + skuPageSize);
  }, [filteredSkus, currentSkuPage, skuPageSize]);

  useEffect(() => {
    setSkuPage(1);
  }, [skuSearch, skuKategoriFilter, skuSatuanFilter, skuPageSize]);

  // Handle Excel File Upload for Master Barang
  // Automatically reads: Kategori Barang, No Barang/Kode Barang, Deskripsi/Nama Barang, Stok Ditangan/Stok Gudang, Unit/Satuan
  const handleSkuExcelFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadFileName(file.name);
    setShowSkuPreviewTable(false);

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        const workbook = XLSX.read(bstr, { type: 'binary' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const jsonRows = XLSX.utils.sheet_to_json<Record<string, any>>(worksheet, { defval: '' });

        const mapped: MasterSkuRecord[] = [];
        jsonRows.forEach((row, idx) => {
          let kategoriBarang = '';
          let noBarang = '';
          let namaBarang = '';
          let stokTersedia = 0;
          let satuan = 'Pcs';

          Object.entries(row).forEach(([rawKey, val]) => {
            const k = normalizeKey(rawKey);
            if (
              k === 'kategoribarang' ||
              k === 'kategori' ||
              k === 'category' ||
              k === 'kelompokbarang' ||
              k === 'jenisbarang' ||
              k === 'grupbarang'
            ) {
              kategoriBarang = String(val || '').trim();
            } else if (
              k === 'nobarang' ||
              k === 'kodebarang' ||
              k === 'kodesku' ||
              k === 'sku' ||
              k === 'kode' ||
              k === 'itemno' ||
              k === 'nomorbarang'
            ) {
              noBarang = String(val || '').trim();
            } else if (
              k === 'deskripsi' ||
              k === 'namabarang' ||
              k === 'deskripsibarang' ||
              k === 'nama' ||
              k === 'itemdescription' ||
              k === 'spesifikasi'
            ) {
              namaBarang = String(val || '').trim();
            } else if (
              k === 'stokditangan' ||
              k === 'stokgudang' ||
              k === 'stoktersedia' ||
              k === 'ktsstok' ||
              k === 'stok' ||
              k === 'kuantitas' ||
              k === 'qty' ||
              k === 'stockonhand'
            ) {
              stokTersedia = parseNumericCell(val);
            } else if (
              k === 'unit' ||
              k === 'satuan' ||
              k === 'uom' ||
              k === 'satuanbarang'
            ) {
              const s = String(val || '').trim();
              if (s) satuan = s;
            }
          });

          if (noBarang || namaBarang) {
            const finalNo = noBarang || `BRG-${idx + 1}`;
            const finalNama = namaBarang || 'Barang Gudang';
            mapped.push({
              id: `sku-imp-${Date.now()}-${idx}`,
              kategoriBarang: inferKategoriBarang(finalNo, finalNama, kategoriBarang),
              noBarang: finalNo,
              namaBarang: finalNama,
              stokTersedia,
              satuan: satuan || 'Pcs',
              cabang: uploadCabang,
              lokasiStock: uploadLokasi,
              tanggalStok: uploadTanggal
            });
          }
        });

        setParsedSkuPreview(mapped);
      } catch (err) {
        console.error('Gagal membaca file Excel Master Barang:', err);
      }
    };
    reader.readAsBinaryString(file);
  };

  const handleConfirmSkuImport = () => {
    if (parsedSkuPreview.length === 0) return;

    // Merge / overwrite by noBarang
    setSkuItems(prev => {
      const map = new Map<string, MasterSkuRecord>();
      prev.forEach(item => map.set(item.noBarang.toUpperCase(), item));
      parsedSkuPreview.forEach(item => {
        map.set(item.noBarang.toUpperCase(), {
          ...item,
          tanggalStok: uploadTanggal
        });
        databaseBarangService.upsertItem({
          noBarang: item.noBarang,
          keteranganBarang: item.namaBarang,
          satuan: item.satuan,
          kategoriBarang: item.kategoriBarang,
          stokTersedia: item.stokTersedia
        });
      });
      return Array.from(map.values());
    });

    const count = parsedSkuPreview.length;
    setIsUploadSkuPageOpen(false);
    setParsedSkuPreview([]);
    setUploadFileName('');
    setShowSkuPreviewTable(false);
    setPopupModal({
      title: 'Data Berhasil Disimpan',
      message: `${count} data barang dari file Excel berhasil diimport ke Master Barang & Database Barang.`
    });
  };

  const handleDownloadTemplateMasterSku = () => {
    const sampleData = [
      {
        'Kategori Barang': 'Karton Box Corrugated',
        'No Barang': 'AKK-KBX-101',
        'Deskripsi': 'Karton Box Corrugated B-Flute 60x40x40 cm',
        'Stok Ditangan': 5200,
        'Unit': 'Pcs'
      },
      {
        'Kategori Barang': 'Karton Box Double Wall',
        'No Barang': 'AKK-KBX-102',
        'Deskripsi': 'Karton Box Double Wall CB-Flute Export 80x50x50 cm',
        'Stok Ditangan': 1850,
        'Unit': 'Pcs'
      },
      {
        'Kategori Barang': 'Plastik & Stretch Film',
        'No Barang': 'AKK-PLS-201',
        'Deskripsi': 'Stretch Film Pallet Wrap 50cm x 300m',
        'Stok Ditangan': 140,
        'Unit': 'Roll'
      },
      {
        'Kategori Barang': 'Lakban & Strapping Band',
        'No Barang': 'AKK-MPK-301',
        'Deskripsi': 'Lakban OPP Coklat Heavy Duty 48mm x 90 Yard',
        'Stok Ditangan': 75,
        'Unit': 'Karton'
      }
    ];
    const ws = XLSX.utils.json_to_sheet(sampleData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Master Barang');
    XLSX.writeFile(wb, 'Template_Upload_Master_Barang_AKK.xlsx');
  };

  const handleAddManualSku = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSkuForm.noBarang.trim() || !newSkuForm.namaBarang.trim()) return;
    const newId = `sku-${Date.now()}`;
    const targetBranchId = selectedBranchId === 'ALL' ? 'branch-banyuwangi' : selectedBranchId;
    const targetBranch = branchStore.getBranchById(targetBranchId);
    branchStore.setInventoryBranch(newId, targetBranchId);
    const item: MasterSkuRecord = {
      id: newId,
      kategoriBarang: inferKategoriBarang(newSkuForm.noBarang, newSkuForm.namaBarang, newSkuForm.kategoriBarang),
      noBarang: newSkuForm.noBarang.trim().toUpperCase(),
      namaBarang: newSkuForm.namaBarang.trim(),
      stokTersedia: Number(newSkuForm.stokTersedia) || 0,
      satuan: newSkuForm.satuan.trim() || 'Pcs',
      cabang: targetBranch?.name || 'Nusantara',
      lokasiStock: `Gudang ${targetBranch?.name || 'Nusantara'}`,
      tanggalStok: new Date().toISOString().split('T')[0]
    };
    setSkuItems(prev => [item, ...prev]);
    databaseBarangService.upsertItem({
      noBarang: item.noBarang,
      keteranganBarang: item.namaBarang,
      satuan: item.satuan,
      kategoriBarang: item.kategoriBarang,
      stokTersedia: item.stokTersedia
    });
    setIsAddSkuModalOpen(false);
    setNewSkuForm({ kategoriBarang: 'Karton Box Corrugated', noBarang: '', namaBarang: '', stokTersedia: '', satuan: 'Pcs' });
    setPopupModal({
      title: 'Data Berhasil Disimpan',
      message: `Barang "${item.namaBarang}" (${item.noBarang}) berhasil ditambahkan ke Gudang ${targetBranch?.name || 'Nusantara'} & Database Barang.`
    });
  };

  // ===========================================================================
  // 2. KARTU STOK (ANALISA OTOMATIS & UPLOAD EXCEL MENTAHAN) STATES
  // ===========================================================================
  const [ksSearch, setKsSearch] = useState('');
  const [ksGudangFilter, setKsGudangFilter] = useState<string>('ALL');
  const [ksPage, setKsPage] = useState<number>(1);
  const [ksPageSize, setKsPageSize] = useState<number>(10);

  // Dedicated Page: Upload Kartu Stok Mentah
  const [isUploadKartuStokPageOpen, setIsUploadKartuStokPageOpen] = useState<boolean>(false);
  const [ksCabang, setKsCabang] = useState<string>('Sidoarjo');
  const [ksLokasiGudang, setKsLokasiGudang] = useState<string>('Gudang Utama Banyuwangi');
  const [ksTanggal, setKsTanggal] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  const [ksFileName, setKsFileName] = useState<string>('');
  const [rawKartuStokPreview, setRawKartuStokPreview] = useState<RawKartuStokRow[]>([]);
  const [analyzedKartuStokPreview, setAnalyzedKartuStokPreview] = useState<KartuStokAnalysisRecord[]>([]);
  const [showKsPreviewTable, setShowKsPreviewTable] = useState<boolean>(false);

  const availableGudangList = useMemo(() => {
    const set = new Set<string>();
    kartuStokList.forEach(item => {
      if (item.namaGudang) set.add(item.namaGudang);
    });
    return Array.from(set);
  }, [kartuStokList]);

  const filteredKartuStok = useMemo(() => {
    const q = ksSearch.trim().toLowerCase();
    return kartuStokList.filter(item => {
      const matchSearch =
        !q ||
        item.kodeBarang.toLowerCase().includes(q) ||
        item.namaBarang.toLowerCase().includes(q) ||
        item.namaGudang.toLowerCase().includes(q);
      const matchWh = ksGudangFilter === 'ALL' || item.namaGudang === ksGudangFilter;
      return matchSearch && matchWh;
    });
  }, [kartuStokList, ksSearch, ksGudangFilter]);

  const totalKsPages = Math.max(1, Math.ceil(filteredKartuStok.length / ksPageSize));
  const currentKsPage = Math.min(ksPage, totalKsPages);
  const paginatedKartuStok = useMemo(() => {
    const start = (currentKsPage - 1) * ksPageSize;
    return filteredKartuStok.slice(start, start + ksPageSize);
  }, [filteredKartuStok, currentKsPage, ksPageSize]);

  useEffect(() => {
    setKsPage(1);
  }, [ksSearch, ksGudangFilter, ksPageSize]);

  // Handle Excel File Upload for Kartu Stok Mentahan
  // Reads: Kode Barang, Tanggal, Nama Barang, Kuantitas Masuk, Kuantitas, Nama Gudang
  const handleKartuStokExcelChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setKsFileName(file.name);
    setShowKsPreviewTable(false);

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        const workbook = XLSX.read(bstr, { type: 'binary' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const jsonRows = XLSX.utils.sheet_to_json<Record<string, any>>(worksheet, { defval: '' });

        const rawParsed: RawKartuStokRow[] = [];
        let lastSeenKode = '';
        let lastSeenNama = '';

        jsonRows.forEach((row) => {
          let kodeBarang = '';
          let tanggal = '';
          let namaBarang = '';
          let kuantitasMasuk = 0;
          let kuantitas = 0;
          let namaGudang = '';
          let hasKuantitasCell = false;

          Object.entries(row).forEach(([rawKey, val]) => {
            const k = normalizeKey(rawKey);
            if (
              k === 'kodebarang' ||
              k === 'nobarang' ||
              k === 'kodesku' ||
              k === 'sku' ||
              k === 'kode'
            ) {
              kodeBarang = String(val || '').trim();
            } else if (
              k === 'tanggal' ||
              k === 'tgl' ||
              k === 'tgltransaksi' ||
              k === 'date' ||
              k === 'tanggalstok'
            ) {
              const dObj = parseExcelDateToObj(val);
              tanggal = dObj ? formatDateID(dObj) : String(val || '').trim();
            } else if (
              k === 'namabarang' ||
              k === 'deskripsi' ||
              k === 'deskripsibarang' ||
              k === 'nama'
            ) {
              namaBarang = String(val || '').trim();
            } else if (
              k === 'kuantitasmasuk' ||
              k === 'qtymasuk' ||
              k === 'stokmasuk' ||
              k === 'masuk' ||
              k === 'ktsmasuk'
            ) {
              kuantitasMasuk = parseNumericCell(val);
            } else if (
              k === 'kuantitas' ||
              k === 'saldo' ||
              k === 'saldoakhir' ||
              k === 'kuantitasakhir' ||
              k === 'kuantitasterakhir' ||
              k === 'stok' ||
              k === 'kts'
            ) {
              kuantitas = parseNumericCell(val);
              hasKuantitasCell = String(val).trim() !== '';
            } else if (
              k === 'namagudang' ||
              k === 'gudang' ||
              k === 'lokasistock' ||
              k === 'lokasi' ||
              k === 'cabang'
            ) {
              namaGudang = String(val || '').trim();
            }
          });

          if (kodeBarang) lastSeenKode = kodeBarang;
          if (namaBarang) lastSeenNama = namaBarang;

          const effectiveKode = kodeBarang || lastSeenKode;
          const effectiveNama = namaBarang || lastSeenNama;

          if (effectiveKode && (tanggal || hasKuantitasCell || kuantitasMasuk > 0)) {
            rawParsed.push({
              kodeBarang: effectiveKode,
              tanggal: tanggal || formatDateID(new Date(ksTanggal)),
              namaBarang: effectiveNama || 'Barang Kemasan AKK',
              kuantitasMasuk,
              kuantitas,
              namaGudang: namaGudang || ksLokasiGudang
            });
          }
        });

        setRawKartuStokPreview(rawParsed);
        const analyzed = analyzeRawKartuStokRows(rawParsed, ksLokasiGudang);
        setAnalyzedKartuStokPreview(analyzed);
      } catch (err) {
        console.error('Gagal membaca file Excel Kartu Stok:', err);
      }
    };
    reader.readAsBinaryString(file);
  };

  const handleConfirmKartuStokImport = () => {
    if (analyzedKartuStokPreview.length === 0) return;

    setKartuStokList(prev => {
      const map = new Map<string, KartuStokAnalysisRecord>();
      prev.forEach(item =>
        map.set(`${item.kodeBarang.toUpperCase()}__${item.namaGudang.toUpperCase()}`, item)
      );
      analyzedKartuStokPreview.forEach(item => {
        map.set(`${item.kodeBarang.toUpperCase()}__${item.namaGudang.toUpperCase()}`, item);
      });
      return Array.from(map.values());
    });

    const count = analyzedKartuStokPreview.length;
    setIsUploadKartuStokPageOpen(false);
    setRawKartuStokPreview([]);
    setAnalyzedKartuStokPreview([]);
    setKsFileName('');
    setShowKsPreviewTable(false);
    setPopupModal({
      title: 'Data Berhasil Disimpan',
      message: `Analisa otomatis untuk ${count} kode barang dari Kartu Stok mentah berhasil diolah dan disimpan.`
    });
  };

  const handleDownloadTemplateKartuStok = () => {
    const sampleRaw = [
      {
        'Kode Barang': 'AKK-KBX-001',
        'Tanggal': '12/10/2026',
        'Nama Barang': 'Karton Box Corrugated B-Flute 60x40x40 cm',
        'Kuantitas Masuk': 0,
        'Kuantitas': 0,
        'Nama Gudang': 'Gudang Utama Banyuwangi'
      },
      {
        'Kode Barang': 'AKK-KBX-001',
        'Tanggal': '15/10/2026',
        'Nama Barang': 'Karton Box Corrugated B-Flute 60x40x40 cm',
        'Kuantitas Masuk': 3500,
        'Kuantitas': 3500,
        'Nama Gudang': 'Gudang Utama Banyuwangi'
      },
      {
        'Kode Barang': 'AKK-KBX-001',
        'Tanggal': '25/10/2026',
        'Nama Barang': 'Karton Box Corrugated B-Flute 60x40x40 cm',
        'Kuantitas Masuk': 1350,
        'Kuantitas': 4850,
        'Nama Gudang': 'Gudang Utama Banyuwangi'
      },
      {
        'Kode Barang': 'AKK-PLS-014',
        'Tanggal': '05/10/2026',
        'Nama Barang': 'Stretch Film Pallet Wrap 50cm x 300m',
        'Kuantitas Masuk': 0,
        'Kuantitas': 0,
        'Nama Gudang': 'Sidoarjo'
      },
      {
        'Kode Barang': 'AKK-PLS-014',
        'Tanggal': '12/10/2026',
        'Nama Barang': 'Stretch Film Pallet Wrap 50cm x 300m',
        'Kuantitas Masuk': 120,
        'Kuantitas': 120,
        'Nama Gudang': 'Sidoarjo'
      },
      {
        'Kode Barang': 'AKK-PLS-014',
        'Tanggal': '28/10/2026',
        'Nama Barang': 'Stretch Film Pallet Wrap 50cm x 300m',
        'Kuantitas Masuk': 0,
        'Kuantitas': 68,
        'Nama Gudang': 'Sidoarjo'
      }
    ];
    const ws = XLSX.utils.json_to_sheet(sampleRaw);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Kartu Stok Mentah');
    XLSX.writeFile(wb, 'Template_Kartu_Stok_Mentah_AKK.xlsx');
  };

  const handleExportAnalisaKartuStok = () => {
    const rows = filteredKartuStok.map(item => ({
      'Kode Barang': item.kodeBarang,
      'Nama Barang': item.namaBarang,
      'Tgl Kuantitas Minimum': item.tglKuantitasMinimum,
      'Tgl Stok Masuk': item.tglStokMasuk,
      'Kuantitas Masuk': item.kuantitasMasuk,
      'Selisih Hari': `${item.selisihHari} Hari`,
      'Kuantitas Terakhir': item.kuantitasTerakhir,
      'Nama Gudang': item.namaGudang
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Analisa Kartu Stok');
    XLSX.writeFile(wb, 'Hasil_Analisa_Kartu_Stok_AKK.xlsx');
  };

  const handleAddLokasiSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const val = newLokasiName.trim();
    if (!val) return;
    if (!lokasiList.includes(val)) {
      setLokasiList(prev => [...prev, val]);
    }
    setUploadLokasi(val);
    setKsLokasiGudang(val);
    setNewLokasiName('');
    setIsAddLokasiOpen(false);
  };

  // ===========================================================================
  // DEDICATED PAGE 1: HALAMAN UPLOAD MASTER BARANG (MASTER SKU)
  // ===========================================================================
  if (isUploadSkuPageOpen) {
    return (
      <div className="space-y-6 animate-fade-in">
        {/* Top Gradient Banner */}
        <div className="rounded-3xl bg-gradient-to-r from-emerald-600 via-teal-800 to-slate-950 p-7 sm:p-8 text-white shadow-md">
          <div className="text-[11px] font-black uppercase tracking-[0.2em] text-emerald-200 mb-1.5">
            WAREHOUSE MANAGEMENT SYSTEM
          </div>
          <h2 className="text-2xl sm:text-3xl font-black tracking-tight">
            Upload Master Barang
          </h2>
          <p className="text-xs sm:text-sm font-medium text-emerald-50/90 mt-1.5 max-w-2xl">
            Pilih tanggal stok dan unggah file Excel Master Barang. Data dari file akan dipreview terlebih dahulu sebelum disimpan ke database.
          </p>
        </div>

        {/* Form Container */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 sm:p-8 shadow-xs space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* TANGGAL STOK */}
            <div className="space-y-2">
              <label className="block text-[11px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
                TANGGAL STOK
              </label>
              <input
                type="date"
                value={uploadTanggal}
                onChange={(e) => setUploadTanggal(e.target.value)}
                className="w-full px-4 py-3.5 rounded-2xl bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-sm font-bold text-slate-900 dark:text-white focus:outline-none focus:border-emerald-600"
              />
            </div>

            {/* MODE IMPORT */}
            <div className="space-y-2">
              <label className="block text-[11px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
                MODE IMPORT
              </label>
              <div className="p-4 rounded-2xl bg-emerald-50/80 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/60 text-emerald-800 dark:text-emerald-300 text-xs sm:text-sm font-bold leading-relaxed">
                Upload tanggal yang sama akan ditimpa. Data H-1 tetap disimpan, dashboard otomatis memakai stok terbaru.
              </div>
            </div>
          </div>

          {/* FILE MASTER BARANG */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-end">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="block text-[11px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  FILE MASTER BARANG
                </label>
                <button
                  type="button"
                  onClick={handleDownloadTemplateMasterSku}
                  className="text-xs font-bold text-emerald-700 dark:text-emerald-400 hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Unduh Template Excel</span>
                </button>
              </div>
              <div className="p-3.5 rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-950/50">
                <input
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  onChange={handleSkuExcelFileChange}
                  className="w-full text-xs text-slate-700 dark:text-slate-300 file:mr-3 file:py-1.5 file:px-3.5 file:rounded-lg file:border file:border-slate-300 dark:file:border-slate-700 file:bg-white dark:file:bg-slate-900 file:text-xs file:font-bold file:text-slate-900 dark:file:text-white hover:file:bg-slate-100 cursor-pointer"
                />
              </div>
            </div>
            {uploadFileName && (
              <div className="text-xs font-bold text-emerald-700 dark:text-emerald-400 flex items-center gap-2 pb-2">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>
                  File dipilih: <strong>{uploadFileName}</strong> ({parsedSkuPreview.length} baris barang terbaca otomatis)
                </span>
              </div>
            )}
          </div>

          {/* Automatic Columns Info Banner */}
          <div className="p-4 rounded-2xl bg-emerald-50/80 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/60 text-emerald-800 dark:text-emerald-300 text-xs sm:text-sm font-bold leading-relaxed">
            Kolom yang dibaca otomatis: Kategori Barang, No Barang/Kode Barang, Deskripsi/Nama Barang, Stok Ditangan/Stok Gudang, Unit/Satuan. Setelah import final, tabel Master Barang memakai data stok terbaru ini.
          </div>

          {/* Bottom Action Buttons */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => {
                setIsUploadSkuPageOpen(false);
                setShowSkuPreviewTable(false);
              }}
              className="px-5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 font-bold text-xs sm:text-sm hover:bg-slate-50 dark:hover:bg-slate-800 transition cursor-pointer"
            >
              Kembali
            </button>

            <button
              type="button"
              onClick={() => {
                if (parsedSkuPreview.length === 0) {
                  setPopupModal({
                    title: 'Pilih File Master Barang Terlebih Dahulu',
                    message: 'Silakan pilih file Excel (.xlsx/.xls/.csv) pada kolom File Master Barang untuk melihat preview data.'
                  });
                  return;
                }
                setShowSkuPreviewTable(true);
              }}
              className="px-5 py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-600 text-white font-bold text-xs sm:text-sm flex items-center gap-2 shadow-sm transition cursor-pointer"
            >
              <Eye className="w-4 h-4" />
              <span>Preview Data</span>
            </button>
          </div>

          {/* Preview Data Table before Final Import */}
          {showSkuPreviewTable && parsedSkuPreview.length > 0 && (
            <div className="pt-6 border-t border-slate-200 dark:border-slate-800 space-y-4 animate-fade-in">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h4 className="text-sm font-black text-slate-900 dark:text-white">
                    Preview Data Master Barang ({parsedSkuPreview.length} Barang Terbaca)
                  </h4>
                  <p className="text-xs text-slate-500">
                    Tanggal Stok: <strong>{uploadTanggal}</strong>
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleConfirmSkuImport}
                  className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-black text-xs sm:text-sm flex items-center gap-2 shadow-sm transition cursor-pointer"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Simpan &amp; Import ke Master Barang ({parsedSkuPreview.length} Barang)</span>
                </button>
              </div>

              <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-50 dark:bg-slate-950 text-slate-600 dark:text-slate-400 uppercase font-bold text-[10px] border-b border-slate-200 dark:border-slate-800">
                    <tr>
                      <th className="py-3 px-4">Kategori Barang</th>
                      <th className="py-3 px-4">No Barang</th>
                      <th className="py-3 px-4">Nama Barang</th>
                      <th className="py-3 px-4 text-right">Stok Tersedia</th>
                      <th className="py-3 px-4">Satuan</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-800 text-slate-800 dark:text-slate-200">
                    {parsedSkuPreview.slice(0, 20).map((item) => (
                      <tr key={item.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40">
                        <td className="py-2.5 px-4">
                          <span className="px-2.5 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/30 text-emerald-700 dark:text-emerald-300 font-bold text-[11px]">
                            {item.kategoriBarang}
                          </span>
                        </td>
                        <td className="py-2.5 px-4 font-mono font-bold text-indigo-600 dark:text-indigo-400">
                          {item.noBarang}
                        </td>
                        <td className="py-2.5 px-4 font-bold text-slate-900 dark:text-white">
                          {item.namaBarang}
                        </td>
                        <td className="py-2.5 px-4 text-right font-mono font-black">
                          {item.stokTersedia.toLocaleString('id-ID')}
                        </td>
                        <td className="py-2.5 px-4 font-semibold">{item.satuan}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ===========================================================================
  // DEDICATED PAGE 2: HALAMAN UPLOAD KARTU STOK MENTAH (ANALISA OTOMATIS)
  // ===========================================================================
  if (isUploadKartuStokPageOpen) {
    return (
      <div className="space-y-6 animate-fade-in">
        {/* Top Gradient Banner */}
        <div className="rounded-3xl bg-gradient-to-r from-emerald-600 via-teal-800 to-slate-950 p-7 sm:p-8 text-white shadow-md">
          <div className="text-[11px] font-black uppercase tracking-[0.2em] text-emerald-200 mb-1.5">
            KARTU STOK &amp; ANALISA OTOMATIS
          </div>
          <h2 className="text-2xl sm:text-3xl font-black tracking-tight">
            Upload Kartu Stok Mentah
          </h2>
          <p className="text-xs sm:text-sm font-medium text-emerald-50/90 mt-1.5 max-w-2xl">
            Pilih tanggal stok dan unggah file Excel mentahan Kartu Stok untuk diolah otomatis oleh sistem sebelum masuk database.
          </p>
        </div>

        {/* Form Container */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 sm:p-8 shadow-xs space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* TANGGAL STOK */}
            <div className="space-y-2">
              <label className="block text-[11px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
                TANGGAL STOK
              </label>
              <input
                type="date"
                value={ksTanggal}
                onChange={(e) => setKsTanggal(e.target.value)}
                className="w-full px-4 py-3.5 rounded-2xl bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-sm font-bold text-slate-900 dark:text-white focus:outline-none focus:border-emerald-600"
              />
            </div>

            {/* MODE IMPORT */}
            <div className="space-y-2">
              <label className="block text-[11px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
                MODE IMPORT
              </label>
              <div className="p-4 rounded-2xl bg-emerald-50/80 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/60 text-emerald-800 dark:text-emerald-300 text-xs sm:text-sm font-bold leading-relaxed">
                Upload tanggal yang sama akan ditimpa. Sistem otomatis mengolah selisih hari dari kuantitas kosong/minimum ke tanggal stok masuk.
              </div>
            </div>
          </div>

          {/* FILE STOK */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-end">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="block text-[11px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  FILE STOK (EXCEL MENTAHAN KARTU STOK)
                </label>
                <button
                  type="button"
                  onClick={handleDownloadTemplateKartuStok}
                  className="text-xs font-bold text-emerald-700 dark:text-emerald-400 hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Unduh Template Kartu Stok</span>
                </button>
              </div>
              <div className="p-3.5 rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-950/50">
                <input
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  onChange={handleKartuStokExcelChange}
                  className="w-full text-xs text-slate-700 dark:text-slate-300 file:mr-3 file:py-1.5 file:px-3.5 file:rounded-lg file:border file:border-slate-300 dark:file:border-slate-700 file:bg-white dark:file:bg-slate-900 file:text-xs file:font-bold file:text-slate-900 dark:file:text-white hover:file:bg-slate-100 cursor-pointer"
                />
              </div>
            </div>
            {ksFileName && (
              <div className="text-xs font-bold text-emerald-700 dark:text-emerald-400 flex items-center gap-2 pb-2">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>
                  File dipilih: <strong>{ksFileName}</strong> ({rawKartuStokPreview.length} baris mutasi &rarr; {analyzedKartuStokPreview.length} barang dianalisa)
                </span>
              </div>
            )}
          </div>

          {/* Automatic Columns Info Banner */}
          <div className="p-4 rounded-2xl bg-emerald-50/80 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/60 text-emerald-800 dark:text-emerald-300 text-xs sm:text-sm font-bold leading-relaxed">
            Kolom yang dibaca otomatis: Kode Barang, Tanggal, Nama Barang, Kuantitas Masuk, Kuantitas &amp; Nama Gudang. Setelah import final, sistem otomatis menampilkan hasil analisa (Kode Barang, Nama Barang, Tgl Kuantitas Minimum, Tgl Stok Masuk, Kuantitas Masuk, Selisih Hari, Kuantitas Terakhir &amp; Nama Gudang).
          </div>

          {/* Bottom Action Buttons */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => {
                setIsUploadKartuStokPageOpen(false);
                setShowKsPreviewTable(false);
              }}
              className="px-5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 font-bold text-xs sm:text-sm hover:bg-slate-50 dark:hover:bg-slate-800 transition cursor-pointer"
            >
              Kembali
            </button>

            <button
              type="button"
              onClick={() => {
                if (analyzedKartuStokPreview.length === 0) {
                  setPopupModal({
                    title: 'Pilih File Kartu Stok Terlebih Dahulu',
                    message: 'Silakan pilih file Excel mentahan Kartu Stok (.xlsx/.xls/.csv) untuk melihat preview analisa otomatis.'
                  });
                  return;
                }
                setShowKsPreviewTable(true);
              }}
              className="px-5 py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-600 text-white font-bold text-xs sm:text-sm flex items-center gap-2 shadow-sm transition cursor-pointer"
            >
              <Eye className="w-4 h-4" />
              <span>Preview Data</span>
            </button>
          </div>

          {/* Preview Hasil Analisa Otomatis Table */}
          {showKsPreviewTable && analyzedKartuStokPreview.length > 0 && (
            <div className="pt-6 border-t border-slate-200 dark:border-slate-800 space-y-4 animate-fade-in">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h4 className="text-sm font-black text-slate-900 dark:text-white">
                    Preview Hasil Olah Analisa Otomatis Kartu Stok ({analyzedKartuStokPreview.length} Barang)
                  </h4>
                  <p className="text-xs text-slate-500">
                    Diolah dari {rawKartuStokPreview.length} baris mutasi Kartu Stok mentah
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleConfirmKartuStokImport}
                  className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-black text-xs sm:text-sm flex items-center gap-2 shadow-sm transition cursor-pointer"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Simpan Hasil Analisa Kartu Stok ({analyzedKartuStokPreview.length} Barang)</span>
                </button>
              </div>

              <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-50 dark:bg-slate-950 text-slate-600 dark:text-slate-400 uppercase font-bold text-[10px] border-b border-slate-200 dark:border-slate-800">
                    <tr>
                      <th className="py-3 px-4">Kode Barang</th>
                      <th className="py-3 px-4">Nama Barang</th>
                      <th className="py-3 px-4">Tgl Kuantitas Minimum</th>
                      <th className="py-3 px-4">Tgl Stok Masuk</th>
                      <th className="py-3 px-4 text-right">Kuantitas Masuk</th>
                      <th className="py-3 px-4 text-center">Selisih Hari</th>
                      <th className="py-3 px-4 text-right">Kuantitas Terakhir</th>
                      <th className="py-3 px-4">Nama Gudang</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-800 text-slate-800 dark:text-slate-200">
                    {analyzedKartuStokPreview.map((item) => (
                      <tr key={item.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40">
                        <td className="py-2.5 px-4 font-mono font-bold text-indigo-600 dark:text-indigo-400">
                          {item.kodeBarang}
                        </td>
                        <td className="py-2.5 px-4 font-bold text-slate-900 dark:text-white">
                          {item.namaBarang}
                        </td>
                        <td className="py-2.5 px-4 font-mono text-rose-600 dark:text-rose-400 font-semibold">
                          {item.tglKuantitasMinimum}
                        </td>
                        <td className="py-2.5 px-4 font-mono text-emerald-600 dark:text-emerald-400 font-semibold">
                          {item.tglStokMasuk}
                        </td>
                        <td className="py-2.5 px-4 text-right font-mono font-bold">
                          {item.kuantitasMasuk.toLocaleString('id-ID')}
                        </td>
                        <td className="py-2.5 px-4 text-center font-mono font-black text-amber-600 dark:text-amber-400">
                          {item.selisihHari} Hari
                        </td>
                        <td className="py-2.5 px-4 text-right font-mono font-black text-slate-900 dark:text-white">
                          {item.kuantitasTerakhir.toLocaleString('id-ID')}
                        </td>
                        <td className="py-2.5 px-4 font-semibold">{item.namaGudang}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ===========================================================================
  // REQUIREMENT 4: INBOUND & OUTBOUND DIKOSONGKAN
  // ===========================================================================
  if (activeTab === 'inbound' || activeTab === 'outbound') {
    return <div className="min-h-[420px]" />;
  }

  return (
    <div className="space-y-5">
      {/* ===================================================================== */}
      {/* TAB: DENAH RAK 3D SIMULATION (6 LORONG & PINTU RAM 1, 2, 3)            */}
      {/* Persistent mount for instant (0ms) opening without reload lag */}
      <div className={activeTab === 'slotting' ? 'block' : 'hidden'}>
        <Warehouse3DSimulation skuList={skuItems} isVisible={activeTab === 'slotting'} />
      </div>

      {/* ===================================================================== */}
      {/* TAB: KUBIKASI BARANG & BERAT BARANG                                   */}
      {/* ===================================================================== */}
      {activeTab === 'cubication' && (
        <WarehouseItemCubicationView skuItems={skuItems} onUpdateSkuItems={setSkuItems} />
      )}

      {/* ===================================================================== */}
      {/* TAB: SIMULASI KUBIKASI BOX ARMADA DENGAN KUBIKASI ITEM BARANG         */}
      {/* ===================================================================== */}
      {activeTab === 'fleet_cubication' && (
        <WarehouseFleetCubicationSimulator skuItems={skuItems} />
      )}

      {/* ===================================================================== */}
      {/* ===================================================================== */}
      {/* TAB: OPNAME GUDANG                                                    */}
      {/* ===================================================================== */}
      {activeTab === 'opname' && (() => {
        const activeSession = getWarehouseSession(opnameActiveGudang);
        const activeDuration = calculateOpnameDuration(activeSession.jamMulai, activeSession.jamSelesai);
        const filteredGudangOpname = opnameAuditList.filter(item => {
          const q = opnameSearch.trim().toLowerCase();
          const matchQ =
            !q ||
            item.kodeBarang.toLowerCase().includes(q) ||
            item.namaBarang.toLowerCase().includes(q) ||
            item.namaGudang.toLowerCase().includes(q) ||
            (item.catatan || '').toLowerCase().includes(q);
          const matchBranch = opnameBranchFilter === 'ALL' || item.cabang === opnameBranchFilter;
          return matchQ && matchBranch;
        });

        return (
          <div className="space-y-4">
            {/* Header Opname Gudang */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
              <div className="space-y-1">
                <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-white tracking-tight">
                  Opname Gudang
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Pencatatan hasil hitung fisik barang di rak gudang beserta waktu pelaksanaan opname.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2 shrink-0">
                <button
                  type="button"
                  disabled={isReloadingOpname}
                  onClick={async () => {
                    setIsReloadingOpname(true);
                    const updated = opnameAuditList.map(item => ({
                      ...item,
                      tanggalAudit:
                        item.namaGudang === opnameActiveGudang && activeSession.tanggalOpname
                          ? activeSession.tanggalOpname
                          : item.tanggalAudit,
                      jamMulai:
                        item.namaGudang === opnameActiveGudang && activeSession.jamMulai
                          ? activeSession.jamMulai
                          : item.jamMulai,
                      jamSelesai:
                        item.namaGudang === opnameActiveGudang && activeSession.jamSelesai
                          ? activeSession.jamSelesai
                          : item.jamSelesai,
                      purchasingStatus: 'Terkirim ke Adm Pembelian' as const
                    }));
                    setOpnameAuditList(updated);
                    try {
                      await fetch('/api/warehouse/opname', {
                        method: 'POST',
                        credentials: 'include',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ items: updated, sessions: opnameSessions })
                      });
                      window.dispatchEvent(new CustomEvent('akk-opname-purchasing-sync'));
                    } catch {}
                    setIsReloadingOpname(false);
                    setPopupModal({
                      title: 'Data Opname Berhasil Disimpan',
                      message: 'Hasil hitung fisik gudang beserta waktu opname telah tersimpan ke sistem dan diperbarui ke laporan Stok Opname.'
                    });
                  }}
                  className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 text-white text-xs font-bold flex items-center gap-1.5 transition cursor-pointer shadow-xs"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isReloadingOpname ? 'animate-spin' : ''}`} />
                  <span>Reload</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const rows = filteredGudangOpname.map(item => {
                      const h1 = item.hitungan1 !== undefined && item.hitungan1 !== null ? item.hitungan1 : '';
                      const sess = getWarehouseSession(item.namaGudang, item.cabang);
                      const dur = calculateOpnameDuration(item.jamMulai || sess.jamMulai, item.jamSelesai || sess.jamSelesai);
                      return {
                        Kode: item.kodeBarang,
                        'Nama Barang': item.namaBarang,
                        Selisih: '',
                        Satuan: item.satuan,
                        'Hitungan 1': h1,
                        'Hitungan 2': item.hitungan2 ?? '',
                        Keterangan: item.catatan || '',
                        Gudang: item.namaGudang,
                        Tanggal: item.tanggalAudit || sess.tanggalOpname,
                        'Jam Mulai': item.jamMulai || sess.jamMulai || '',
                        'Jam Selesai': item.jamSelesai || sess.jamSelesai || '',
                        'Lama Waktu': dur.label
                      };
                    });
                    const ws = XLSX.utils.json_to_sheet(rows);
                    ws['!cols'] = [
                      { wch: 14 },
                      { wch: 46 },
                      { wch: 12 },
                      { wch: 10 },
                      { wch: 13 },
                      { wch: 13 },
                      { wch: 32 },
                      { wch: 24 },
                      { wch: 13 },
                      { wch: 11 },
                      { wch: 12 },
                      { wch: 16 }
                    ];
                    const wb = XLSX.utils.book_new();
                    XLSX.utils.book_append_sheet(wb, ws, 'Opname Gudang');
                    XLSX.writeFile(wb, `opname-gudang-${new Date().toISOString().slice(0, 10)}.xlsx`);
                  }}
                  className="px-3.5 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 text-xs font-bold flex items-center gap-1.5 transition cursor-pointer shadow-xs"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                  <span>Export Excel</span>
                </button>
              </div>
            </div>

            {/* Waktu Pelaksanaan Opname Gudang (Jam Mulai & Jam Selesai) */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 items-end">
                <div>
                  <label className="text-[11px] font-bold text-slate-600 dark:text-slate-300 flex items-center gap-1 mb-1">
                    <Warehouse className="w-3.5 h-3.5 text-indigo-500" />
                    <span>Gudang Opname</span>
                  </label>
                  <select
                    value={opnameActiveGudang}
                    onChange={e => setOpnameActiveGudang(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs font-bold text-slate-800 dark:text-slate-100 cursor-pointer"
                  >
                    {availableOpnameWarehouses.map(g => (
                      <option key={g} value={g}>{g}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-[11px] font-bold text-slate-600 dark:text-slate-300 flex items-center gap-1 mb-1">
                    <Calendar className="w-3.5 h-3.5 text-indigo-500" />
                    <span>Tanggal Opname</span>
                  </label>
                  <input
                    type="date"
                    value={activeSession.tanggalOpname}
                    onChange={e => updateWarehouseSessionField(opnameActiveGudang, { tanggalOpname: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs font-bold text-slate-900 dark:text-white"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[11px] font-bold text-slate-600 dark:text-slate-300 flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5 text-emerald-500" />
                      <span>Jam Mulai</span>
                    </label>
                    <button
                      type="button"
                      onClick={() => updateWarehouseSessionField(opnameActiveGudang, { jamMulai: getCurrentHHMM() })}
                      className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
                    >
                      Mulai Sekarang
                    </button>
                  </div>
                  <input
                    type="time"
                    value={activeSession.jamMulai}
                    onChange={e => updateWarehouseSessionField(opnameActiveGudang, { jamMulai: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs font-mono font-bold text-slate-900 dark:text-white"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[11px] font-bold text-slate-600 dark:text-slate-300 flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5 text-rose-500" />
                      <span>Jam Selesai</span>
                    </label>
                    <button
                      type="button"
                      onClick={() => updateWarehouseSessionField(opnameActiveGudang, { jamSelesai: getCurrentHHMM() })}
                      className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 hover:underline cursor-pointer"
                    >
                      Selesai Sekarang
                    </button>
                  </div>
                  <input
                    type="time"
                    value={activeSession.jamSelesai}
                    onChange={e => updateWarehouseSessionField(opnameActiveGudang, { jamSelesai: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs font-mono font-bold text-slate-900 dark:text-white"
                  />
                </div>

                <div className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3.5 py-2 flex flex-col justify-center">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Lama Waktu Opname
                  </span>
                  <span className="text-sm font-black font-mono tabular-nums text-indigo-600 dark:text-indigo-400 mt-0.5">
                    {activeDuration.label}
                  </span>
                </div>
              </div>
            </div>

            {/* Filter Opname Gudang */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-3.5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={opnameSearch}
                  onChange={e => setOpnameSearch(e.target.value)}
                  placeholder="Cari Kode, Nama Barang, atau Keterangan..."
                  className="w-full pl-10 pr-4 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-blue-500"
                />
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <select
                  value={opnameBranchFilter}
                  onChange={e => setOpnameBranchFilter(e.target.value)}
                  className="px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs font-bold text-slate-800 dark:text-slate-200 cursor-pointer"
                >
                  <option value="ALL">Semua Cabang</option>
                  <option value="Banyuwangi">Cabang Banyuwangi</option>
                  <option value="Sidoarjo">Cabang Sidoarjo</option>
                  <option value="Jember">Cabang Jember</option>
                  <option value="Bali">Cabang Bali</option>
                </select>
              </div>
            </div>

            {/* Tabel Audit Fisik Gudang — Format Lembar Opname 7 Kolom */}
            <div className="bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl overflow-hidden shadow-xs">
              <div className="overflow-x-auto">
                <table className="w-full text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-50 dark:bg-slate-950 text-blue-900 dark:text-blue-300 font-bold text-xs">
                      <th className="py-2 px-2.5 text-center border-b border-r border-slate-300 dark:border-slate-700 w-[115px] whitespace-nowrap">
                        Kode
                      </th>
                      <th className="py-2 px-2.5 text-center border-b border-r border-slate-300 dark:border-slate-700 min-w-[260px]">
                        Nama Barang
                      </th>
                      <th className="py-2 px-2.5 text-center border-b border-r border-slate-300 dark:border-slate-700 w-[96px] whitespace-nowrap">
                        <span className="inline-flex items-center justify-center gap-1">
                          <Lock className="w-3 h-3 text-slate-400" />
                          <span>Selisih</span>
                        </span>
                      </th>
                      <th className="py-2 px-2.5 text-center border-b border-r border-slate-300 dark:border-slate-700 w-[80px] whitespace-nowrap">
                        Satuan
                      </th>
                      <th className="py-2 px-2.5 text-center border-b border-r border-slate-300 dark:border-slate-700 w-[108px] whitespace-nowrap">
                        Hitungan 1
                      </th>
                      <th className="py-2 px-2.5 text-center border-b border-r border-slate-300 dark:border-slate-700 w-[108px] whitespace-nowrap">
                        Hitungan 2
                      </th>
                      <th className="py-2 px-2.5 text-center border-b border-slate-300 dark:border-slate-700 min-w-[210px]">
                        Keterangan
                      </th>
                    </tr>
                  </thead>
                  <tbody className="text-slate-900 dark:text-slate-100">
                    {filteredGudangOpname.map(item => {
                      const hit1Val =
                        item.hitungan1 !== undefined && item.hitungan1 !== null ? String(item.hitungan1) : '';
                      const hit2Val =
                        item.hitungan2 !== undefined && item.hitungan2 !== null ? String(item.hitungan2) : '';

                      return (
                        <tr
                          key={item.id}
                          className="hover:bg-blue-50/40 dark:hover:bg-slate-800/40 transition-colors"
                        >
                          <td className="py-1 px-2.5 border-b border-r border-slate-300 dark:border-slate-700 font-mono font-bold text-slate-900 dark:text-slate-100 whitespace-nowrap">
                            {item.kodeBarang}
                          </td>
                          <td className="py-1 px-2.5 border-b border-r border-slate-300 dark:border-slate-700 font-bold text-slate-900 dark:text-white leading-tight">
                            {item.namaBarang}
                          </td>
                          {/* Kolom Selisih dikosongkan & terkunci untuk akses Gudang (diisi oleh Admin Opname) */}
                          <td
                            title="Terkunci — kolom Selisih diisi oleh Admin Opname"
                            className="py-1 px-2.5 border-b border-r border-slate-300 dark:border-slate-700 text-center bg-slate-100/80 dark:bg-slate-800/50 text-slate-400 select-none cursor-not-allowed whitespace-nowrap"
                          >
                            <span className="inline-flex items-center justify-center gap-1 text-[10px]">
                              <Lock className="w-2.5 h-2.5 opacity-60" />
                            </span>
                          </td>
                          <td className="py-1 px-2.5 border-b border-r border-slate-300 dark:border-slate-700 font-semibold uppercase text-slate-800 dark:text-slate-200 whitespace-nowrap">
                            {item.satuan}
                          </td>
                          <td className="p-0 border-b border-r border-slate-300 dark:border-slate-700">
                            <input
                              type="number"
                              value={hit1Val}
                              placeholder=""
                              aria-label={`Hitungan 1 ${item.kodeBarang}`}
                              onChange={e => {
                                const raw = e.target.value;
                                const parsed = raw === '' ? null : Math.max(0, Number(raw) || 0);
                                setOpnameAuditList(prev =>
                                  prev.map(row =>
                                    row.id === item.id
                                      ? {
                                          ...row,
                                          hitungan1: parsed,
                                          stokFisik: parsed ?? 0
                                        }
                                      : row
                                  )
                                );
                              }}
                              className="w-full h-full py-1 px-2.5 bg-transparent focus:bg-blue-50/70 dark:focus:bg-blue-950/40 font-mono tabular-nums font-bold text-slate-900 dark:text-white focus:outline-none"
                            />
                          </td>
                          <td className="p-0 border-b border-r border-slate-300 dark:border-slate-700">
                            <input
                              type="number"
                              value={hit2Val}
                              placeholder=""
                              aria-label={`Hitungan 2 ${item.kodeBarang}`}
                              onChange={e => {
                                const raw = e.target.value;
                                const parsed = raw === '' ? null : Math.max(0, Number(raw) || 0);
                                setOpnameAuditList(prev =>
                                  prev.map(row => (row.id === item.id ? { ...row, hitungan2: parsed } : row))
                                );
                              }}
                              className="w-full h-full py-1 px-2.5 bg-transparent focus:bg-blue-50/70 dark:focus:bg-blue-950/40 font-mono tabular-nums font-bold text-slate-900 dark:text-white focus:outline-none"
                            />
                          </td>
                          <td className="p-0 border-b border-slate-300 dark:border-slate-700">
                            <input
                              type="text"
                              value={item.catatan || ''}
                              placeholder=""
                              aria-label={`Keterangan ${item.kodeBarang}`}
                              onChange={e => {
                                const text = e.target.value;
                                setOpnameAuditList(prev =>
                                  prev.map(row => (row.id === item.id ? { ...row, catatan: text } : row))
                                );
                              }}
                              className="w-full h-full py-1 px-2.5 bg-transparent focus:bg-blue-50/70 dark:focus:bg-blue-950/40 text-xs text-slate-800 dark:text-slate-200 focus:outline-none"
                            />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ===================================================================== */}
      {/* TAB: STOK OPNAME (ADM PEMBELIAN)                                      */}
      {/* ===================================================================== */}
      {activeTab === 'purchasing_opname' && (() => {
        // Sub-halaman Upload Excel Stok Opname
        if (purchasingOpnameView === 'upload_excel') {
          const uploadDuration = calculateOpnameDuration(uploadOpnameMeta.jamMulai, uploadOpnameMeta.jamSelesai);
          const previewSelisihCount = parsedUploadOpnamePreview.filter(r => {
            const s = getOpnameSelisihValue(r);
            return s !== null && s !== 0;
          }).length;
          const previewKlopCount = parsedUploadOpnamePreview.filter(r => getOpnameSelisihValue(r) === 0).length;
          const previewErrorPct =
            parsedUploadOpnamePreview.length > 0
              ? ((previewSelisihCount / parsedUploadOpnamePreview.length) * 100).toFixed(1)
              : '0.0';

          const mappingFields: Array<{
            key: keyof typeof uploadOpnameColMap;
            label: string;
            required?: boolean;
          }> = [
            { key: 'kode', label: 'Kode Barang', required: true },
            { key: 'namaBarang', label: 'Nama Barang', required: true },
            { key: 'selisih', label: 'Selisih' },
            { key: 'satuan', label: 'Satuan' },
            { key: 'hitungan1', label: 'Hitungan 1' },
            { key: 'hitungan2', label: 'Hitungan 2' },
            { key: 'keterangan', label: 'Keterangan' }
          ];

          return (
            <div className="space-y-4">
              {/* Header Halaman Upload Excel */}
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                <div className="flex items-start gap-3">
                  <button
                    type="button"
                    onClick={() => setPurchasingOpnameView('main')}
                    className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition cursor-pointer shrink-0"
                    title="Kembali ke Stok Opname"
                  >
                    <ArrowLeft className="w-4 h-4" />
                  </button>
                  <div className="space-y-0.5">
                    <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-white tracking-tight">
                      Upload Excel Stok Opname
                    </h2>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Unggah lembar kerja Excel (.xlsx / .xls / .csv), periksa kolom yang terbaca, lengkapi tanggal &amp; nama admin, lalu simpan.
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => {
                      const sampleRows = [
                        {
                          Kode: '7GPJA001',
                          'Nama Barang': 'CUP PLST JAGUAR BR 10 OZ NAT @50 (40SLP/CRT)',
                          Selisih: 0,
                          Satuan: 'CRT',
                          'Hitungan 1': 95,
                          'Hitungan 2': 95,
                          Keterangan: ''
                        },
                        {
                          Kode: '7AFBG453',
                          'Nama Barang': 'ALUFOIL REFIL BAGUS 45X7,62M (24PCS/CRT)',
                          Selisih: -2,
                          Satuan: 'CRT',
                          'Hitungan 1': 60,
                          'Hitungan 2': 62,
                          Keterangan: 'Cek ulang rak B2'
                        }
                      ];
                      const ws = XLSX.utils.json_to_sheet(sampleRows);
                      ws['!cols'] = [
                        { wch: 14 },
                        { wch: 46 },
                        { wch: 10 },
                        { wch: 10 },
                        { wch: 13 },
                        { wch: 13 },
                        { wch: 28 }
                      ];
                      const wb = XLSX.utils.book_new();
                      XLSX.utils.book_append_sheet(wb, ws, 'Template Stok Opname');
                      XLSX.writeFile(wb, 'template-upload-stok-opname.xlsx');
                    }}
                    className="px-3.5 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                    <span>Download Template Excel</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setPurchasingOpnameView('main')}
                    className="px-3.5 py-2 rounded-xl bg-white dark:bg-slate-950 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 text-xs font-bold transition cursor-pointer"
                  >
                    Batal
                  </button>
                </div>
              </div>

              {/* Informasi Sesi Upload: Tanggal, Nama Gudang, Cabang, Nama Admin, Jam Mulai, Jam Selesai */}
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs space-y-4">
                <div className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-200">
                  1. Informasi Pelaksanaan Opname
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5 text-xs">
                  <div>
                    <label className="font-bold text-slate-600 dark:text-slate-300 block mb-1">Tanggal Opname *</label>
                    <input
                      type="date"
                      value={uploadOpnameMeta.tanggalOpname}
                      onChange={e => setUploadOpnameMeta(prev => ({ ...prev, tanggalOpname: e.target.value }))}
                      className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white font-semibold"
                    />
                  </div>
                  <div>
                    <label className="font-bold text-slate-600 dark:text-slate-300 block mb-1">Nama Gudang Opname *</label>
                    <input
                      type="text"
                      list="opname-warehouse-datalist"
                      value={uploadOpnameMeta.namaGudang}
                      onChange={e => setUploadOpnameMeta(prev => ({ ...prev, namaGudang: e.target.value }))}
                      placeholder="Pilih atau ketik nama gudang..."
                      className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white font-semibold"
                    />
                    <datalist id="opname-warehouse-datalist">
                      {availableOpnameWarehouses.map(g => (
                        <option key={g} value={g} />
                      ))}
                    </datalist>
                  </div>
                  <div>
                    <label className="font-bold text-slate-600 dark:text-slate-300 block mb-1">Cabang</label>
                    <select
                      value={uploadOpnameMeta.cabang}
                      onChange={e => setUploadOpnameMeta(prev => ({ ...prev, cabang: e.target.value }))}
                      className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white font-semibold cursor-pointer"
                    >
                      <option value="Banyuwangi">Banyuwangi</option>
                      <option value="Sidoarjo">Sidoarjo</option>
                      <option value="Jember">Jember</option>
                      <option value="Bali">Bali</option>
                    </select>
                  </div>
                  <div>
                    <label className="font-bold text-slate-600 dark:text-slate-300 block mb-1">Nama Admin Opname *</label>
                    <input
                      type="text"
                      value={uploadOpnameMeta.namaAdmin}
                      onChange={e => setUploadOpnameMeta(prev => ({ ...prev, namaAdmin: e.target.value }))}
                      placeholder="Contoh: Rina / Admin Pembelian"
                      className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white font-semibold"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2.5">
                    <div>
                      <label className="font-bold text-slate-600 dark:text-slate-300 block mb-1">Jam Mulai</label>
                      <input
                        type="time"
                        value={uploadOpnameMeta.jamMulai}
                        onChange={e => setUploadOpnameMeta(prev => ({ ...prev, jamMulai: e.target.value }))}
                        className="w-full px-2.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white font-mono font-bold"
                      />
                    </div>
                    <div>
                      <label className="font-bold text-slate-600 dark:text-slate-300 block mb-1">Jam Selesai</label>
                      <input
                        type="time"
                        value={uploadOpnameMeta.jamSelesai}
                        onChange={e => setUploadOpnameMeta(prev => ({ ...prev, jamSelesai: e.target.value }))}
                        className="w-full px-2.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white font-mono font-bold"
                      />
                    </div>
                  </div>
                  <div className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3.5 py-2 flex flex-col justify-center">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      Lama Waktu Opname
                    </span>
                    <span className="text-sm font-black font-mono tabular-nums text-indigo-600 dark:text-indigo-400 mt-0.5">
                      {uploadDuration.label}
                    </span>
                  </div>
                </div>
              </div>

              {/* Area Upload File Excel */}
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-200">
                    2. Pilih File Excel Stok Opname
                  </div>
                  {uploadOpnameFileName && (
                    <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                      <FileSpreadsheet className="w-3.5 h-3.5" />
                      <span>{uploadOpnameFileName} ({uploadOpnameRawRows.length} baris)</span>
                    </span>
                  )}
                </div>

                <input
                  ref={opnameExcelInputRef}
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  className="hidden"
                  onChange={e => {
                    const f = e.target.files?.[0];
                    if (f) handleOpnameExcelFileSelect(f);
                    e.target.value = '';
                  }}
                />
                <div
                  onClick={() => opnameExcelInputRef.current?.click()}
                  onDragOver={e => e.preventDefault()}
                  onDrop={e => {
                    e.preventDefault();
                    const f = e.dataTransfer.files?.[0];
                    if (f) handleOpnameExcelFileSelect(f);
                  }}
                  className="border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-indigo-500 dark:hover:border-indigo-400 rounded-2xl p-8 text-center cursor-pointer transition bg-slate-50/70 dark:bg-slate-950/60"
                >
                  <Upload className="w-8 h-8 text-indigo-500 mx-auto mb-2" />
                  <p className="text-sm font-bold text-slate-800 dark:text-white">
                    Klik untuk pilih file Excel atau seret file ke sini
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    Mendukung format .xlsx, .xls, dan .csv — sistem otomatis membaca seluruh nama kolom di sheet pertama.
                  </p>
                </div>
              </div>

              {/* Kolom yang Terbaca & Pemetaan Kolom */}
              {uploadOpnameHeaders.length > 0 && (
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <div className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-200">
                        3. Kolom yang Terbaca dari File Excel ({uploadOpnameHeaders.length} Kolom)
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                        Berikut daftar kolom yang terdeteksi dari file Excel Anda beserta pemetaannya ke tabel Stok Opname.
                      </p>
                    </div>
                  </div>

                  {/* Daftar Kolom Terdeteksi */}
                  <div className="flex flex-wrap gap-2 p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                    {uploadOpnameHeaders.map((header, i) => {
                      const isMapped = Object.values(uploadOpnameColMap).includes(header);
                      return (
                        <span
                          key={`${header}-${i}`}
                          className={`px-2.5 py-1 rounded-lg text-xs font-bold border ${
                            isMapped
                              ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-700'
                              : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700'
                          }`}
                        >
                          {i + 1}. {header} {isMapped ? '✓' : ''}
                        </span>
                      );
                    })}
                  </div>

                  {/* Mapping Dropdowns */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
                    {mappingFields.map(field => (
                      <div key={field.key}>
                        <label className="font-bold text-slate-600 dark:text-slate-300 block mb-1">
                          {field.label} {field.required && <span className="text-rose-500">*</span>}
                        </label>
                        <select
                          value={uploadOpnameColMap[field.key]}
                          onChange={e =>
                            setUploadOpnameColMap(prev => ({ ...prev, [field.key]: e.target.value }))
                          }
                          className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white font-semibold cursor-pointer"
                        >
                          <option value="">— Tidak Dipetakan —</option>
                          {uploadOpnameHeaders.map(h => (
                            <option key={h} value={h}>{h}</option>
                          ))}
                        </select>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Preview Data Terbaca & Simpan */}
              {parsedUploadOpnamePreview.length > 0 && (
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs space-y-4">
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                    <div>
                      <div className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-200">
                        4. Pratinjau Data Hasil Baca ({parsedUploadOpnamePreview.length} Barang)
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                        Selisih: <strong className="text-rose-600 dark:text-rose-400">{previewSelisihCount} SKU</strong> • Klop: <strong className="text-emerald-600 dark:text-emerald-400">{previewKlopCount} SKU</strong> • Prosentase Kesalahan: <strong className="font-mono text-slate-900 dark:text-white">{previewErrorPct}%</strong>
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <select
                        value={uploadOpnameImportMode}
                        onChange={e => setUploadOpnameImportMode(e.target.value as 'append' | 'replace_warehouse')}
                        className="px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs font-bold text-slate-800 dark:text-slate-200 cursor-pointer"
                      >
                        <option value="replace_warehouse">Ganti Data Gudang Ini ({uploadOpnameMeta.namaGudang})</option>
                        <option value="append">Tambahkan ke Data yang Ada</option>
                      </select>
                      <button
                        type="button"
                        disabled={isSavingOpnameUpload}
                        onClick={async () => {
                          if (!uploadOpnameMeta.namaGudang.trim()) {
                            setPopupModal({
                              title: 'Nama Gudang Wajib Diisi',
                              message: 'Silakan isi Nama Gudang Opname terlebih dahulu.'
                            });
                            return;
                          }
                          setIsSavingOpnameUpload(true);
                          const targetGudang = uploadOpnameMeta.namaGudang.trim();
                          const nextItems =
                            uploadOpnameImportMode === 'replace_warehouse'
                              ? [
                                  ...parsedUploadOpnamePreview,
                                  ...opnameAuditList.filter(i => i.namaGudang !== targetGudang)
                                ]
                              : [...parsedUploadOpnamePreview, ...opnameAuditList];

                          const nextSessions: Record<string, WarehouseOpnameSessionMeta> = {
                            ...opnameSessions,
                            [targetGudang]: {
                              namaGudang: targetGudang,
                              cabang: uploadOpnameMeta.cabang || 'Banyuwangi',
                              tanggalOpname: uploadOpnameMeta.tanggalOpname || new Date().toISOString().slice(0, 10),
                              namaAdmin: uploadOpnameMeta.namaAdmin.trim() || 'Admin Opname',
                              jamMulai: uploadOpnameMeta.jamMulai || '',
                              jamSelesai: uploadOpnameMeta.jamSelesai || ''
                            }
                          };

                          setOpnameAuditList(nextItems);
                          setOpnameSessions(nextSessions);
                          try {
                            await fetch('/api/warehouse/opname', {
                              method: 'POST',
                              credentials: 'include',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ items: nextItems, sessions: nextSessions })
                            });
                            window.dispatchEvent(new CustomEvent('akk-opname-purchasing-sync'));
                          } catch {}
                          setIsSavingOpnameUpload(false);
                          setUploadOpnameFileName('');
                          setUploadOpnameHeaders([]);
                          setUploadOpnameRawRows([]);
                          setPurchasingOpnameGudangFilter(targetGudang);
                          setPurchasingOpnameView('main');
                          setPopupModal({
                            title: 'Upload Excel Stok Opname Berhasil',
                            message: `${parsedUploadOpnamePreview.length} data barang untuk ${targetGudang} telah disimpan.`
                          });
                        }}
                        className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 text-white text-xs font-bold flex items-center gap-1.5 transition cursor-pointer shadow-xs"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>{isSavingOpnameUpload ? 'Menyimpan...' : `Simpan ${parsedUploadOpnamePreview.length} Data`}</span>
                      </button>
                    </div>
                  </div>

                  <div className="overflow-x-auto rounded-xl border border-slate-300 dark:border-slate-700 max-h-[380px]">
                    <table className="w-full text-xs border-collapse">
                      <thead className="sticky top-0 z-10">
                        <tr className="bg-slate-50 dark:bg-slate-950 text-blue-900 dark:text-blue-300 font-bold">
                          <th className="py-2 px-2.5 text-center border-b border-r border-slate-300 dark:border-slate-700 w-[110px]">Kode</th>
                          <th className="py-2 px-2.5 text-center border-b border-r border-slate-300 dark:border-slate-700 min-w-[240px]">Nama Barang</th>
                          <th className="py-2 px-2.5 text-center border-b border-r border-slate-300 dark:border-slate-700 w-[90px]">Selisih</th>
                          <th className="py-2 px-2.5 text-center border-b border-r border-slate-300 dark:border-slate-700 w-[75px]">Satuan</th>
                          <th className="py-2 px-2.5 text-center border-b border-r border-slate-300 dark:border-slate-700 w-[95px]">Hitungan 1</th>
                          <th className="py-2 px-2.5 text-center border-b border-r border-slate-300 dark:border-slate-700 w-[95px]">Hitungan 2</th>
                          <th className="py-2 px-2.5 text-center border-b border-slate-300 dark:border-slate-700 min-w-[160px]">Keterangan</th>
                        </tr>
                      </thead>
                      <tbody className="text-slate-900 dark:text-slate-100">
                        {parsedUploadOpnamePreview.slice(0, 30).map(row => {
                          const sVal = getOpnameSelisihValue(row);
                          return (
                            <tr key={row.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                              <td className="py-1 px-2.5 border-b border-r border-slate-300 dark:border-slate-700 font-mono font-bold">{row.kodeBarang}</td>
                              <td className="py-1 px-2.5 border-b border-r border-slate-300 dark:border-slate-700 font-semibold">{row.namaBarang}</td>
                              <td className={`py-1 px-2.5 border-b border-r border-slate-300 dark:border-slate-700 text-right font-mono font-bold ${
                                sVal === null ? '' : sVal > 0 ? 'bg-[#82c944] text-slate-950' : sVal < 0 ? 'bg-[#ffef00] text-slate-950' : 'bg-emerald-50 dark:bg-emerald-950/40'
                              }`}>
                                {sVal !== null ? sVal : '—'}
                              </td>
                              <td className="py-1 px-2.5 border-b border-r border-slate-300 dark:border-slate-700 uppercase font-semibold">{row.satuan}</td>
                              <td className="py-1 px-2.5 border-b border-r border-slate-300 dark:border-slate-700 font-mono tabular-nums">{row.hitungan1 ?? ''}</td>
                              <td className="py-1 px-2.5 border-b border-r border-slate-300 dark:border-slate-700 font-mono tabular-nums">{row.hitungan2 ?? ''}</td>
                              <td className="py-1 px-2.5 border-b border-slate-300 dark:border-slate-700">{row.catatan}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  {parsedUploadOpnamePreview.length > 30 && (
                    <div className="text-[11px] text-slate-500 dark:text-slate-400">
                      Menampilkan 30 baris pertama dari total {parsedUploadOpnamePreview.length} baris yang siap disimpan.
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        }

        // Main View: Stok Opname (Adm Pembelian)
        const totalDiopname = opnameAuditList.length;
        const totalSelisihCount = opnameAuditList.filter(i => {
          const s = getOpnameSelisihValue(i);
          return s !== null && s !== 0;
        }).length;
        const totalKlopCount = opnameAuditList.filter(i => getOpnameSelisihValue(i) === 0).length;
        const totalBelumDiisiCount = opnameAuditList.filter(i => getOpnameSelisihValue(i) === null).length;
        const overallErrorRate =
          totalDiopname > 0 ? ((totalSelisihCount / totalDiopname) * 100).toFixed(1) : '0.0';

        // Per-Warehouse Dashboard Summary
        const warehouseNamesPresent = Array.from(
          new Set<string>([
            ...opnameAuditList.map(i => i.namaGudang).filter(Boolean),
            ...Object.keys(opnameSessions)
          ])
        );
        const warehouseDashboardRows = warehouseNamesPresent
          .map(gudangName => {
            const itemsInWarehouse = opnameAuditList.filter(i => i.namaGudang === gudangName);
            const sess = getWarehouseSession(gudangName);
            const totalSku = itemsInWarehouse.length;
            const selisihSku = itemsInWarehouse.filter(i => {
              const s = getOpnameSelisihValue(i);
              return s !== null && s !== 0;
            }).length;
            const klopSku = itemsInWarehouse.filter(i => getOpnameSelisihValue(i) === 0).length;
            const errorPct = totalSku > 0 ? (selisihSku / totalSku) * 100 : 0;
            const jamMulai = sess.jamMulai || itemsInWarehouse.find(i => i.jamMulai)?.jamMulai || '';
            const jamSelesai = sess.jamSelesai || itemsInWarehouse.find(i => i.jamSelesai)?.jamSelesai || '';
            const duration = calculateOpnameDuration(jamMulai, jamSelesai);
            const tanggalOpname = sess.tanggalOpname || itemsInWarehouse[0]?.tanggalAudit || '—';
            const namaAdmin =
              sess.namaAdmin ||
              itemsInWarehouse.find(i => i.namaAdmin)?.namaAdmin ||
              itemsInWarehouse[0]?.auditor ||
              '—';
            return {
              namaGudang: gudangName,
              cabang: sess.cabang || itemsInWarehouse[0]?.cabang || 'Banyuwangi',
              tanggalOpname,
              namaAdmin,
              totalSku,
              selisihSku,
              klopSku,
              errorPct,
              jamMulai,
              jamSelesai,
              durationLabel: duration.label
            };
          })
          .filter(w => w.totalSku > 0 || w.jamMulai || w.jamSelesai);

        const activeEditGudang =
          purchasingOpnameGudangFilter !== 'ALL'
            ? purchasingOpnameGudangFilter
            : warehouseDashboardRows[0]?.namaGudang || 'Gudang Utama Banyuwangi';
        const activePurchasingSession = getWarehouseSession(activeEditGudang);
        const activePurchasingDuration = calculateOpnameDuration(
          activePurchasingSession.jamMulai,
          activePurchasingSession.jamSelesai
        );

        const filteredPurchasingOpname = opnameAuditList.filter(item => {
          const q = purchasingOpnameSearch.trim().toLowerCase();
          const matchQ =
            !q ||
            item.kodeBarang.toLowerCase().includes(q) ||
            item.namaBarang.toLowerCase().includes(q) ||
            item.namaGudang.toLowerCase().includes(q) ||
            (item.namaAdmin || item.auditor || '').toLowerCase().includes(q) ||
            (item.catatan || '').toLowerCase().includes(q);
          const matchBranch =
            purchasingOpnameBranchFilter === 'ALL' || item.cabang === purchasingOpnameBranchFilter;
          const matchGudang =
            purchasingOpnameGudangFilter === 'ALL' || item.namaGudang === purchasingOpnameGudangFilter;
          const matchDate =
            !purchasingOpnameDateFilter || (item.tanggalAudit || '').slice(0, 10) === purchasingOpnameDateFilter;
          const sVal = getOpnameSelisihValue(item);
          const matchCond =
            purchasingOpnameConditionFilter === 'ALL' ||
            (purchasingOpnameConditionFilter === 'SELISIH' && sVal !== null && sVal !== 0) ||
            (purchasingOpnameConditionFilter === 'KLOP' && sVal === 0) ||
            (purchasingOpnameConditionFilter === 'BELUM' && sVal === null);
          return matchQ && matchBranch && matchGudang && matchDate && matchCond;
        });

        return (
          <div className="space-y-4">
            {/* Header Stok Opname */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
              <div className="space-y-1">
                <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-white tracking-tight">
                  Stok Opname
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Analisa hasil opname barang per gudang, prosentase kesalahan, durasi opname, dan verifikasi selisih.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    setUploadOpnameMeta(prev => ({
                      ...prev,
                      namaGudang: activeEditGudang,
                      cabang: activePurchasingSession.cabang || prev.cabang,
                      tanggalOpname: activePurchasingSession.tanggalOpname || new Date().toISOString().slice(0, 10),
                      namaAdmin: activePurchasingSession.namaAdmin || prev.namaAdmin,
                      jamMulai: activePurchasingSession.jamMulai || prev.jamMulai || '08:00',
                      jamSelesai: activePurchasingSession.jamSelesai || prev.jamSelesai
                    }));
                    setPurchasingOpnameView('upload_excel');
                  }}
                  className="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold flex items-center gap-1.5 transition cursor-pointer shadow-xs"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>Upload Excel</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const rows = filteredPurchasingOpname.map(item => {
                      const sVal = getOpnameSelisihValue(item);
                      const sess = getWarehouseSession(item.namaGudang, item.cabang);
                      const dur = calculateOpnameDuration(item.jamMulai || sess.jamMulai, item.jamSelesai || sess.jamSelesai);
                      return {
                        Kode: item.kodeBarang,
                        'Nama Barang': item.namaBarang,
                        Selisih: sVal !== null ? sVal : '',
                        Satuan: item.satuan,
                        'Hitungan 1': item.hitungan1 ?? '',
                        'Hitungan 2': item.hitungan2 ?? '',
                        Keterangan: item.catatan || '',
                        Gudang: item.namaGudang,
                        Tanggal: item.tanggalAudit || sess.tanggalOpname,
                        'Nama Admin': item.namaAdmin || sess.namaAdmin || item.auditor || '',
                        'Jam Mulai': item.jamMulai || sess.jamMulai || '',
                        'Jam Selesai': item.jamSelesai || sess.jamSelesai || '',
                        'Lama Waktu': dur.label
                      };
                    });
                    const ws = XLSX.utils.json_to_sheet(rows);
                    ws['!cols'] = [
                      { wch: 14 },
                      { wch: 46 },
                      { wch: 12 },
                      { wch: 10 },
                      { wch: 13 },
                      { wch: 13 },
                      { wch: 30 },
                      { wch: 24 },
                      { wch: 13 },
                      { wch: 18 },
                      { wch: 11 },
                      { wch: 12 },
                      { wch: 16 }
                    ];
                    const wb = XLSX.utils.book_new();
                    XLSX.utils.book_append_sheet(wb, ws, 'Stok Opname');
                    XLSX.writeFile(wb, `stok-opname-${new Date().toISOString().slice(0, 10)}.xlsx`);
                  }}
                  className="px-3.5 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 text-xs font-bold flex items-center gap-1.5 transition cursor-pointer shadow-xs"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                  <span>Export Excel</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setNewOpnameForm(prev => ({
                      ...prev,
                      namaGudang: activeEditGudang,
                      cabang: activePurchasingSession.cabang || prev.cabang,
                      tanggalAudit: activePurchasingSession.tanggalOpname || new Date().toISOString().slice(0, 10),
                      namaAdmin: activePurchasingSession.namaAdmin || prev.namaAdmin,
                      jamMulai: activePurchasingSession.jamMulai || prev.jamMulai,
                      jamSelesai: activePurchasingSession.jamSelesai || prev.jamSelesai
                    }));
                    setIsAddOpnameModalOpen(true);
                  }}
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1.5 transition cursor-pointer shadow-xs"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Input Data Opname</span>
                </button>
              </div>
            </div>

            {/* Dashboard Analisa Ringkas Stok Opname */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-2xl shadow-xs">
                <div className="text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Barang Diopname
                </div>
                <div className="text-2xl font-black text-slate-900 dark:text-white mt-1 font-mono tabular-nums">
                  {totalDiopname} <span className="text-sm font-bold text-slate-500">SKU</span>
                </div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                  {totalBelumDiisiCount > 0
                    ? `${totalBelumDiisiCount} SKU belum diisi selisih`
                    : 'Seluruh SKU sudah diverifikasi'}
                </div>
              </div>

              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-2xl shadow-xs">
                <div className="text-[10px] font-black uppercase tracking-wider text-rose-600 dark:text-rose-400">
                  Total Selisih
                </div>
                <div className="text-2xl font-black text-rose-600 dark:text-rose-400 mt-1 font-mono tabular-nums">
                  {totalSelisihCount} <span className="text-sm font-bold">SKU</span>
                </div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                  Barang dengan nilai selisih lebih / kurang
                </div>
              </div>

              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-2xl shadow-xs">
                <div className="text-[10px] font-black uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                  Total Sesuai / Klop
                </div>
                <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1 font-mono tabular-nums">
                  {totalKlopCount} <span className="text-sm font-bold">SKU</span>
                </div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                  Barang dengan hasil opname sesuai (selisih 0)
                </div>
              </div>

              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-2xl shadow-xs">
                <div className="text-[10px] font-black uppercase tracking-wider text-amber-600 dark:text-amber-400">
                  Prosentase Kesalahan Total
                </div>
                <div className="text-2xl font-black text-amber-600 dark:text-amber-400 mt-1 font-mono tabular-nums">
                  {overallErrorRate}%
                </div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                  Dari {warehouseDashboardRows.length} gudang yang diopname
                </div>
              </div>
            </div>

            {/* Dashboard Per Gudang Opname: Nama Gudang, Tanggal, Nama Admin, Prosentase Kesalahan, Lama Waktu */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-xs space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <h3 className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
                    <Warehouse className="w-4 h-4 text-indigo-500" />
                    <span>Dashboard Opname Per Gudang</span>
                  </h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                    Ringkasan prosentase kesalahan, tanggal, nama admin, serta lama waktu opname masing-masing gudang. Klik gudang untuk memfilter tabel.
                  </p>
                </div>
                {purchasingOpnameGudangFilter !== 'ALL' && (
                  <button
                    type="button"
                    onClick={() => setPurchasingOpnameGudangFilter('ALL')}
                    className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-[11px] font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-200 cursor-pointer self-start"
                  >
                    Tampilkan Semua Gudang
                  </button>
                )}
              </div>

              <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
                <table className="w-full text-xs text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 dark:bg-slate-950 text-[11px] font-bold uppercase text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
                      <th className="py-2.5 px-3">Nama Gudang</th>
                      <th className="py-2.5 px-3">Tanggal</th>
                      <th className="py-2.5 px-3">Nama Admin</th>
                      <th className="py-2.5 px-3 text-right">SKU</th>
                      <th className="py-2.5 px-3 text-right">Klop</th>
                      <th className="py-2.5 px-3 text-right">Selisih</th>
                      <th className="py-2.5 px-3 min-w-[165px]">Prosentase Kesalahan</th>
                      <th className="py-2.5 px-3">Jam Mulai - Selesai</th>
                      <th className="py-2.5 px-3 text-right">Lama Waktu</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                    {warehouseDashboardRows.map(w => {
                      const isSelected = purchasingOpnameGudangFilter === w.namaGudang;
                      const pctColor =
                        w.errorPct === 0
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : w.errorPct < 10
                          ? 'text-amber-600 dark:text-amber-400'
                          : 'text-rose-600 dark:text-rose-400';
                      const barColor =
                        w.errorPct === 0
                          ? 'bg-emerald-500'
                          : w.errorPct < 10
                          ? 'bg-amber-500'
                          : 'bg-rose-500';
                      return (
                        <tr
                          key={w.namaGudang}
                          onClick={() =>
                            setPurchasingOpnameGudangFilter(prev =>
                              prev === w.namaGudang ? 'ALL' : w.namaGudang
                            )
                          }
                          className={`cursor-pointer transition ${
                            isSelected
                              ? 'bg-indigo-50/80 dark:bg-indigo-950/30'
                              : 'hover:bg-slate-50 dark:hover:bg-slate-800/40'
                          }`}
                        >
                          <td className="py-2.5 px-3">
                            <div className="font-bold text-slate-900 dark:text-white">{w.namaGudang}</div>
                            <div className="text-[10px] text-slate-500 dark:text-slate-400">Cabang {w.cabang}</div>
                          </td>
                          <td className="py-2.5 px-3 font-mono text-slate-700 dark:text-slate-300 whitespace-nowrap">
                            {w.tanggalOpname}
                          </td>
                          <td className="py-2.5 px-3 font-semibold text-slate-800 dark:text-slate-200">
                            {w.namaAdmin}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono tabular-nums font-bold text-slate-900 dark:text-white">
                            {w.totalSku}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono tabular-nums font-bold text-emerald-600 dark:text-emerald-400">
                            {w.klopSku}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono tabular-nums font-bold text-rose-600 dark:text-rose-400">
                            {w.selisihSku}
                          </td>
                          <td className="py-2.5 px-3">
                            <div className="flex items-center justify-between gap-2 mb-1">
                              <span className={`font-mono tabular-nums font-black ${pctColor}`}>
                                {w.errorPct.toFixed(1)}%
                              </span>
                              <span className="text-[10px] text-slate-400">
                                {w.selisihSku}/{w.totalSku} SKU
                              </span>
                            </div>
                            <div className="w-full h-1.5 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
                              <div
                                className={`h-full rounded-full ${barColor}`}
                                style={{ width: `${Math.min(100, Math.max(w.errorPct > 0 ? 4 : 0, w.errorPct))}%` }}
                              />
                            </div>
                          </td>
                          <td className="py-2.5 px-3 font-mono text-slate-700 dark:text-slate-300 whitespace-nowrap">
                            {w.jamMulai || '—'} – {w.jamSelesai || '—'}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono tabular-nums font-bold text-indigo-600 dark:text-indigo-400 whitespace-nowrap">
                            {w.durationLabel}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Editor Informasi Sesi Opname (Tanggal, Nama Admin, Jam Mulai, Jam Selesai) */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3 items-end text-xs">
                <div>
                  <label className="text-[11px] font-bold text-slate-600 dark:text-slate-300 flex items-center gap-1 mb-1">
                    <Warehouse className="w-3.5 h-3.5 text-indigo-500" />
                    <span>Gudang</span>
                  </label>
                  <select
                    value={activeEditGudang}
                    onChange={e => setPurchasingOpnameGudangFilter(e.target.value)}
                    className="w-full px-2.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 font-bold text-slate-800 dark:text-slate-100 cursor-pointer"
                  >
                    {availableOpnameWarehouses.map(g => (
                      <option key={g} value={g}>{g}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-[11px] font-bold text-slate-600 dark:text-slate-300 flex items-center gap-1 mb-1">
                    <Calendar className="w-3.5 h-3.5 text-indigo-500" />
                    <span>Tanggal Opname</span>
                  </label>
                  <input
                    type="date"
                    value={activePurchasingSession.tanggalOpname}
                    onChange={e => updateWarehouseSessionField(activeEditGudang, { tanggalOpname: e.target.value })}
                    className="w-full px-2.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 font-semibold text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-slate-600 dark:text-slate-300 flex items-center gap-1 mb-1">
                    <User className="w-3.5 h-3.5 text-indigo-500" />
                    <span>Nama Admin</span>
                  </label>
                  <input
                    type="text"
                    value={activePurchasingSession.namaAdmin}
                    placeholder="Isi nama admin..."
                    onChange={e => updateWarehouseSessionField(activeEditGudang, { namaAdmin: e.target.value })}
                    className="w-full px-2.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 font-semibold text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-slate-600 dark:text-slate-300 flex items-center gap-1 mb-1">
                    <Clock className="w-3.5 h-3.5 text-emerald-500" />
                    <span>Jam Mulai</span>
                  </label>
                  <input
                    type="time"
                    value={activePurchasingSession.jamMulai}
                    onChange={e => updateWarehouseSessionField(activeEditGudang, { jamMulai: e.target.value })}
                    className="w-full px-2.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 font-mono font-bold text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-slate-600 dark:text-slate-300 flex items-center gap-1 mb-1">
                    <Clock className="w-3.5 h-3.5 text-rose-500" />
                    <span>Jam Selesai</span>
                  </label>
                  <input
                    type="time"
                    value={activePurchasingSession.jamSelesai}
                    onChange={e => updateWarehouseSessionField(activeEditGudang, { jamSelesai: e.target.value })}
                    className="w-full px-2.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 font-mono font-bold text-slate-900 dark:text-white"
                  />
                </div>
                <div className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 flex flex-col justify-center">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Lama Waktu
                  </span>
                  <span className="text-xs font-black font-mono tabular-nums text-indigo-600 dark:text-indigo-400 mt-0.5">
                    {activePurchasingDuration.label}
                  </span>
                </div>
              </div>
            </div>

            {/* Filter Bar Stok Opname */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-3.5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={purchasingOpnameSearch}
                  onChange={e => setPurchasingOpnameSearch(e.target.value)}
                  placeholder="Cari Kode, Nama Barang, Gudang, Admin, atau Keterangan..."
                  className="w-full pl-10 pr-4 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500"
                />
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <input
                  type="date"
                  value={purchasingOpnameDateFilter}
                  onChange={e => setPurchasingOpnameDateFilter(e.target.value)}
                  title="Filter Tanggal Opname"
                  className="px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs font-bold text-slate-800 dark:text-slate-200"
                />
                {purchasingOpnameDateFilter && (
                  <button
                    type="button"
                    onClick={() => setPurchasingOpnameDateFilter('')}
                    className="px-2 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-slate-800 text-xs cursor-pointer"
                    title="Hapus filter tanggal"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
                <select
                  value={purchasingOpnameBranchFilter}
                  onChange={e => setPurchasingOpnameBranchFilter(e.target.value)}
                  className="px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs font-bold text-slate-800 dark:text-slate-200 cursor-pointer"
                >
                  <option value="ALL">Semua Cabang</option>
                  <option value="Banyuwangi">Cabang Banyuwangi</option>
                  <option value="Sidoarjo">Cabang Sidoarjo</option>
                  <option value="Jember">Cabang Jember</option>
                  <option value="Bali">Cabang Bali</option>
                </select>
                <select
                  value={purchasingOpnameConditionFilter}
                  onChange={e => setPurchasingOpnameConditionFilter(e.target.value as any)}
                  className="px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs font-bold text-slate-800 dark:text-slate-200 cursor-pointer"
                >
                  <option value="ALL">Semua Kondisi</option>
                  <option value="SELISIH">Ada Selisih</option>
                  <option value="KLOP">Sesuai / Klop (0)</option>
                  <option value="BELUM">Belum Diisi Selisih</option>
                </select>
              </div>
            </div>

            {/* Tabel Stok Opname — Format 7 Kolom Seragam dengan Opname Gudang */}
            <div className="bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl overflow-hidden shadow-xs">
              <div className="overflow-x-auto">
                <table className="w-full text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-50 dark:bg-slate-950 text-blue-900 dark:text-blue-300 font-bold text-xs">
                      <th className="py-2 px-2.5 text-center border-b border-r border-slate-300 dark:border-slate-700 w-[115px] whitespace-nowrap">
                        Kode
                      </th>
                      <th className="py-2 px-2.5 text-center border-b border-r border-slate-300 dark:border-slate-700 min-w-[260px]">
                        Nama Barang
                      </th>
                      <th className="py-2 px-2.5 text-center border-b border-r border-slate-300 dark:border-slate-700 w-[104px] whitespace-nowrap">
                        Selisih
                      </th>
                      <th className="py-2 px-2.5 text-center border-b border-r border-slate-300 dark:border-slate-700 w-[80px] whitespace-nowrap">
                        Satuan
                      </th>
                      <th className="py-2 px-2.5 text-center border-b border-r border-slate-300 dark:border-slate-700 w-[108px] whitespace-nowrap">
                        Hitungan 1
                      </th>
                      <th className="py-2 px-2.5 text-center border-b border-r border-slate-300 dark:border-slate-700 w-[108px] whitespace-nowrap">
                        Hitungan 2
                      </th>
                      <th className="py-2 px-2.5 text-center border-b border-slate-300 dark:border-slate-700 min-w-[210px]">
                        Keterangan
                      </th>
                    </tr>
                  </thead>
                  <tbody className="text-slate-900 dark:text-slate-100">
                    {filteredPurchasingOpname.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="py-8 text-center text-slate-400 text-xs">
                          Belum ada data stok opname yang sesuai filter.
                        </td>
                      </tr>
                    ) : (
                      filteredPurchasingOpname.map(item => {
                        const selisihVal = getOpnameSelisihValue(item);
                        const selisihStr = selisihVal !== null ? String(selisihVal) : '';
                        const selisihBgClass =
                          selisihVal === null
                            ? 'bg-white dark:bg-slate-900'
                            : selisihVal > 0
                            ? 'bg-[#82c944] dark:bg-emerald-500/45'
                            : selisihVal < 0
                            ? 'bg-[#ffef00] dark:bg-amber-400/50'
                            : 'bg-emerald-50/50 dark:bg-emerald-950/30';

                        return (
                          <tr
                            key={item.id}
                            className="hover:bg-blue-50/40 dark:hover:bg-slate-800/40 transition-colors"
                          >
                            <td className="py-1 px-2.5 border-b border-r border-slate-300 dark:border-slate-700 font-mono font-bold text-slate-900 dark:text-slate-100 whitespace-nowrap">
                              {item.kodeBarang}
                            </td>
                            <td className="py-1 px-2.5 border-b border-r border-slate-300 dark:border-slate-700 font-bold text-slate-900 dark:text-white leading-tight">
                              {item.namaBarang}
                            </td>
                            {/* Kolom Selisih: diisi oleh Admin Opname */}
                            <td className={`p-0 border-b border-r border-slate-300 dark:border-slate-700 ${selisihBgClass}`}>
                              <input
                                type="number"
                                value={selisihStr}
                                placeholder="—"
                                aria-label={`Selisih ${item.kodeBarang}`}
                                onChange={e => {
                                  const raw = e.target.value;
                                  const parsed = raw === '' ? null : Number(raw);
                                  const safeParsed = parsed !== null && !Number.isNaN(parsed) ? parsed : null;
                                  setOpnameAuditList(prev =>
                                    prev.map(row =>
                                      row.id === item.id
                                        ? {
                                            ...row,
                                            selisihOpname: safeParsed,
                                            reorderQty: safeParsed !== null && safeParsed < 0 ? Math.abs(safeParsed) : 0,
                                            purchasingStatus:
                                              safeParsed === 0
                                                ? 'Sesuai Sistem'
                                                : row.purchasingStatus
                                          }
                                        : row
                                    )
                                  );
                                }}
                                className="w-full h-full py-1 px-2.5 bg-transparent text-right font-mono tabular-nums font-bold text-slate-950 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-inset focus:ring-indigo-500"
                              />
                            </td>
                            <td className="py-1 px-2.5 border-b border-r border-slate-300 dark:border-slate-700 font-semibold uppercase text-slate-800 dark:text-slate-200 whitespace-nowrap">
                              {item.satuan}
                            </td>
                            <td className="py-1 px-2.5 border-b border-r border-slate-300 dark:border-slate-700 font-mono tabular-nums font-bold text-slate-900 dark:text-white whitespace-nowrap">
                              {item.hitungan1 !== undefined && item.hitungan1 !== null ? item.hitungan1 : ''}
                            </td>
                            <td className="py-1 px-2.5 border-b border-r border-slate-300 dark:border-slate-700 font-mono tabular-nums font-bold text-slate-900 dark:text-white whitespace-nowrap">
                              {item.hitungan2 !== undefined && item.hitungan2 !== null ? item.hitungan2 : ''}
                            </td>
                            <td className="p-0 border-b border-slate-300 dark:border-slate-700">
                              <input
                                type="text"
                                value={item.catatan || ''}
                                placeholder=""
                                aria-label={`Keterangan ${item.kodeBarang}`}
                                onChange={e => {
                                  const text = e.target.value;
                                  setOpnameAuditList(prev =>
                                    prev.map(row => (row.id === item.id ? { ...row, catatan: text } : row))
                                  );
                                }}
                                className="w-full h-full py-1 px-2.5 bg-transparent focus:bg-blue-50/70 dark:focus:bg-blue-950/40 text-xs text-slate-800 dark:text-slate-200 focus:outline-none"
                              />
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Modal Input Data Stok Opname (Dibuka dari Adm Pembelian -> Stok Opname) */}
      {isAddOpnameModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-xl p-5 space-y-4 shadow-2xl max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <h3 className="text-sm font-black text-slate-900 dark:text-white">
                Input Data Stok Opname
              </h3>
              <button
                type="button"
                onClick={() => setIsAddOpnameModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form
              onSubmit={e => {
                e.preventDefault();
                const h1 = newOpnameForm.hitungan1 === '' ? null : Math.max(0, Number(newOpnameForm.hitungan1) || 0);
                const h2 = newOpnameForm.hitungan2 === '' ? null : Math.max(0, Number(newOpnameForm.hitungan2) || 0);
                const selVal =
                  newOpnameForm.selisihOpname === ''
                    ? null
                    : Number.isNaN(Number(newOpnameForm.selisihOpname))
                    ? null
                    : Number(newOpnameForm.selisihOpname);
                const targetGudang = newOpnameForm.namaGudang.trim() || 'Gudang Utama Banyuwangi';
                const draft: WarehouseOpnameAuditItem = {
                  id: `OPN-${Date.now()}`,
                  kodeBarang: newOpnameForm.kodeBarang.trim().toUpperCase(),
                  namaBarang: newOpnameForm.namaBarang.trim(),
                  kategori: inferKategoriBarang(newOpnameForm.kodeBarang, newOpnameForm.namaBarang),
                  namaGudang: targetGudang,
                  cabang: newOpnameForm.cabang,
                  satuan: newOpnameForm.satuan.trim().toUpperCase() || 'PAK',
                  stokSistem: h1 ?? 0,
                  stokFisik: h1 ?? 0,
                  selisihOpname: selVal,
                  hitungan1: h1,
                  hitungan2: h2,
                  reorderQty: selVal !== null && selVal < 0 ? Math.abs(selVal) : 0,
                  tanggalAudit: newOpnameForm.tanggalAudit || new Date().toISOString().slice(0, 10),
                  auditor: newOpnameForm.namaAdmin.trim() || 'Admin Opname',
                  namaAdmin: newOpnameForm.namaAdmin.trim() || 'Admin Opname',
                  jamMulai: newOpnameForm.jamMulai || '',
                  jamSelesai: newOpnameForm.jamSelesai || '',
                  purchasingStatus: selVal === 0 ? 'Sesuai Sistem' : 'Terkirim ke Adm Pembelian',
                  catatan: newOpnameForm.catatan.trim()
                };

                setOpnameAuditList(prev => [draft, ...prev]);
                setOpnameSessions(prev => ({
                  ...prev,
                  [targetGudang]: {
                    namaGudang: targetGudang,
                    cabang: newOpnameForm.cabang,
                    tanggalOpname: draft.tanggalAudit,
                    namaAdmin: draft.namaAdmin || 'Admin Opname',
                    jamMulai: draft.jamMulai || '',
                    jamSelesai: draft.jamSelesai || ''
                  }
                }));
                setNewOpnameForm({
                  kodeBarang: '',
                  namaBarang: '',
                  namaGudang: targetGudang,
                  cabang: newOpnameForm.cabang,
                  tanggalAudit: draft.tanggalAudit,
                  namaAdmin: draft.namaAdmin || 'Admin Opname',
                  jamMulai: draft.jamMulai || '',
                  jamSelesai: draft.jamSelesai || '',
                  satuan: 'PAK',
                  selisihOpname: '',
                  hitungan1: '',
                  hitungan2: '',
                  catatan: ''
                });
                setIsAddOpnameModalOpen(false);
                setPopupModal({
                  title: 'Data Stok Opname Disimpan',
                  message: `Item ${draft.kodeBarang} berhasil ditambahkan ke daftar Stok Opname (${targetGudang}).`
                });
              }}
              className="space-y-3 text-xs"
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-600 dark:text-slate-300 block mb-1">Tanggal Opname</label>
                  <input
                    type="date"
                    required
                    value={newOpnameForm.tanggalAudit}
                    onChange={e => setNewOpnameForm({ ...newOpnameForm, tanggalAudit: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white font-semibold"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-600 dark:text-slate-300 block mb-1">Nama Admin</label>
                  <input
                    type="text"
                    required
                    placeholder="Contoh: Rina"
                    value={newOpnameForm.namaAdmin}
                    onChange={e => setNewOpnameForm({ ...newOpnameForm, namaAdmin: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white"
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-1">
                  <label className="font-bold text-slate-600 dark:text-slate-300 block mb-1">Nama Gudang</label>
                  <input
                    type="text"
                    list="opname-modal-warehouse-datalist"
                    required
                    value={newOpnameForm.namaGudang}
                    onChange={e => setNewOpnameForm({ ...newOpnameForm, namaGudang: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white"
                  />
                  <datalist id="opname-modal-warehouse-datalist">
                    {availableOpnameWarehouses.map(g => (
                      <option key={g} value={g} />
                    ))}
                  </datalist>
                </div>
                <div>
                  <label className="font-bold text-slate-600 dark:text-slate-300 block mb-1">Jam Mulai</label>
                  <input
                    type="time"
                    value={newOpnameForm.jamMulai}
                    onChange={e => setNewOpnameForm({ ...newOpnameForm, jamMulai: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white font-mono"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-600 dark:text-slate-300 block mb-1">Jam Selesai</label>
                  <input
                    type="time"
                    value={newOpnameForm.jamSelesai}
                    onChange={e => setNewOpnameForm({ ...newOpnameForm, jamSelesai: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white font-mono"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-600 dark:text-slate-300 block mb-1">Kode</label>
                  <input
                    type="text"
                    required
                    placeholder="Contoh: 7HTOS151"
                    value={newOpnameForm.kodeBarang}
                    onChange={e => setNewOpnameForm({ ...newOpnameForm, kodeBarang: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white font-mono"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-600 dark:text-slate-300 block mb-1">Cabang</label>
                  <select
                    value={newOpnameForm.cabang}
                    onChange={e => setNewOpnameForm({ ...newOpnameForm, cabang: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white"
                  >
                    <option value="Banyuwangi">Banyuwangi</option>
                    <option value="Sidoarjo">Sidoarjo</option>
                    <option value="Jember">Jember</option>
                    <option value="Bali">Bali</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="font-bold text-slate-600 dark:text-slate-300 block mb-1">Nama Barang</label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: HD TAS OVAL SPIRIT 15X23 SMILE @48 (120PAK/ZAK)"
                  value={newOpnameForm.namaBarang}
                  onChange={e => setNewOpnameForm({ ...newOpnameForm, namaBarang: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white"
                />
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div>
                  <label className="font-bold text-slate-600 dark:text-slate-300 block mb-1">Satuan</label>
                  <input
                    type="text"
                    required
                    placeholder="PAK"
                    value={newOpnameForm.satuan}
                    onChange={e => setNewOpnameForm({ ...newOpnameForm, satuan: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white uppercase"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-600 dark:text-slate-300 block mb-1">Selisih</label>
                  <input
                    type="number"
                    placeholder="Opsional"
                    value={newOpnameForm.selisihOpname}
                    onChange={e => setNewOpnameForm({ ...newOpnameForm, selisihOpname: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white font-mono"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-600 dark:text-slate-300 block mb-1">Hitungan 1</label>
                  <input
                    type="number"
                    placeholder="Opsional"
                    value={newOpnameForm.hitungan1}
                    onChange={e => setNewOpnameForm({ ...newOpnameForm, hitungan1: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white font-mono"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-600 dark:text-slate-300 block mb-1">Hitungan 2</label>
                  <input
                    type="number"
                    placeholder="Opsional"
                    value={newOpnameForm.hitungan2}
                    onChange={e => setNewOpnameForm({ ...newOpnameForm, hitungan2: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white font-mono"
                  />
                </div>
              </div>
              <div>
                <label className="font-bold text-slate-600 dark:text-slate-300 block mb-1">Keterangan</label>
                <input
                  type="text"
                  value={newOpnameForm.catatan}
                  onChange={e => setNewOpnameForm({ ...newOpnameForm, catatan: e.target.value })}
                  placeholder="Opsional..."
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAddOpnameModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold cursor-pointer"
                >
                  Simpan Opname
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* TAB: KARTU STOK DIGITAL (ADM PEMBELIAN — ANALISA SELISIH HARI)        */}
      {/* ===================================================================== */}
      {activeTab === 'kartu_stok' && (
        <div className="space-y-4">
          {/* Header Kartu Stok */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-lg bg-emerald-50 dark:bg-emerald-500/15 border border-emerald-200 dark:border-emerald-500/30 text-emerald-700 dark:text-emerald-300 text-[10px] font-black uppercase tracking-wider">
                  Adm Pembelian &bull; Analisa Otomatis Kartu Stok
                </span>
              </div>
              <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-white tracking-tight">
                Kartu Stok Digital (Analisa Selisih Hari Pengisian Stok)
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Unggah file Excel mentahan Kartu Stok untuk diolah otomatis oleh sistem menjadi laporan analisa tanggal kuantitas minimum/kosong, tanggal stok masuk, selisih hari, dan kuantitas terakhir per gudang.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={handleExportAnalisaKartuStok}
                className="px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Ekspor Excel</span>
              </button>
              <button
                type="button"
                onClick={() => setIsUploadKartuStokPageOpen(true)}
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1.5 transition cursor-pointer shadow-xs"
              >
                <Upload className="w-3.5 h-3.5" />
                <span>Unggah File (Excel Mentahan)</span>
              </button>
            </div>
          </div>

          {/* Filter & Search Bar Kartu Stok */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={ksSearch}
                onChange={(e) => setKsSearch(e.target.value)}
                placeholder="Cari Kode Barang, Nama Barang, atau Nama Gudang..."
                className="w-full pl-10 pr-4 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <select
                value={ksGudangFilter}
                onChange={(e) => setKsGudangFilter(e.target.value)}
                className="px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs font-bold text-slate-800 dark:text-slate-200 cursor-pointer"
              >
                <option value="ALL">Semua Gudang ({kartuStokList.length})</option>
                {availableGudangList.map((g) => (
                  <option key={g} value={g}>
                    {g}
                  </option>
                ))}
              </select>

              <div className="flex items-center gap-1.5 text-xs">
                <span className="text-slate-500 font-semibold">Baris:</span>
                <select
                  value={ksPageSize}
                  onChange={(e) => setKsPageSize(Number(e.target.value))}
                  className="px-2.5 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs font-bold text-slate-800 dark:text-slate-200 cursor-pointer"
                >
                  <option value={5}>5 / hal</option>
                  <option value={10}>10 / hal</option>
                  <option value={20}>20 / hal</option>
                  <option value={50}>50 / hal</option>
                </select>
              </div>
            </div>
          </div>

          {/* Tabel Analisa Otomatis Kartu Stok */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-xs">
            <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-black text-slate-900 dark:text-white">
                  Tabel Analisa Otomatis Kartu Stok
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Selisih Hari dihitung otomatis dari tanggal kuantitas minimum/kosong hingga tanggal stok masuk berikutnya.
                </p>
              </div>
              <span className="text-xs font-bold text-slate-500">
                Total: {filteredKartuStok.length} Barang
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-50 dark:bg-slate-950 text-slate-600 dark:text-slate-400 uppercase font-bold text-[10px] border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="py-3 px-4">Kode Barang</th>
                    <th className="py-3 px-4">Nama Barang</th>
                    <th className="py-3 px-4">Tgl Kuantitas Minimum</th>
                    <th className="py-3 px-4">Tgl Stok Masuk</th>
                    <th className="py-3 px-4 text-right">Kuantitas Masuk</th>
                    <th className="py-3 px-4 text-center">Selisih Hari</th>
                    <th className="py-3 px-4 text-right">Kuantitas Terakhir</th>
                    <th className="py-3 px-4">Nama Gudang</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800 text-slate-800 dark:text-slate-200">
                  {paginatedKartuStok.length > 0 ? (
                    paginatedKartuStok.map((item) => (
                      <tr key={item.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition">
                        <td className="py-3 px-4 font-mono font-bold text-indigo-600 dark:text-indigo-400">
                          {item.kodeBarang}
                        </td>
                        <td className="py-3 px-4 font-bold text-slate-900 dark:text-white">
                          {item.namaBarang}
                        </td>
                        <td className="py-3 px-4 font-mono font-semibold text-rose-600 dark:text-rose-400">
                          {item.tglKuantitasMinimum}
                        </td>
                        <td className="py-3 px-4 font-mono font-semibold text-emerald-600 dark:text-emerald-400">
                          {item.tglStokMasuk}
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-bold">
                          {item.kuantitasMasuk.toLocaleString('id-ID')}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span className="px-2.5 py-0.5 rounded-lg bg-amber-50 dark:bg-amber-500/15 border border-amber-200 dark:border-amber-500/30 font-mono font-black text-amber-700 dark:text-amber-300 text-[11px]">
                            {item.selisihHari} Hari
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-black text-slate-900 dark:text-white">
                          {item.kuantitasTerakhir.toLocaleString('id-ID')}
                        </td>
                        <td className="py-3 px-4 font-semibold text-slate-700 dark:text-slate-300">
                          {item.namaGudang}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={8} className="py-8 text-center text-slate-400 text-xs">
                        Tidak ada data analisa Kartu Stok yang sesuai pencarian.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination Bar Kartu Stok */}
            <div className="p-4 border-t border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
              <div className="text-slate-500 dark:text-slate-400 font-medium">
                Menampilkan{' '}
                <strong className="text-slate-900 dark:text-white">
                  {filteredKartuStok.length === 0 ? 0 : (currentKsPage - 1) * ksPageSize + 1}
                </strong>{' '}
                &ndash;{' '}
                <strong className="text-slate-900 dark:text-white">
                  {Math.min(currentKsPage * ksPageSize, filteredKartuStok.length)}
                </strong>{' '}
                dari <strong className="text-slate-900 dark:text-white">{filteredKartuStok.length}</strong> data analisa
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  disabled={currentKsPage <= 1}
                  onClick={() => setKsPage(p => Math.max(1, p - 1))}
                  className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-700 dark:text-slate-300 font-bold disabled:opacity-40 cursor-pointer flex items-center gap-1"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                  <span>Sebelumnya</span>
                </button>

                {Array.from({ length: totalKsPages }, (_, i) => i + 1).map((pageNum) => (
                  <button
                    key={pageNum}
                    type="button"
                    onClick={() => setKsPage(pageNum)}
                    className={`w-8 h-8 rounded-xl font-mono text-xs font-black transition cursor-pointer ${
                      pageNum === currentKsPage
                        ? 'bg-emerald-600 text-white'
                        : 'bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100'
                    }`}
                  >
                    {pageNum}
                  </button>
                ))}

                <button
                  type="button"
                  disabled={currentKsPage >= totalKsPages}
                  onClick={() => setKsPage(p => Math.min(totalKsPages, p + 1))}
                  className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-700 dark:text-slate-300 font-bold disabled:opacity-40 cursor-pointer flex items-center gap-1"
                >
                  <span>Selanjutnya</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* TAB: DATABASE BARANG (NOMOR BARANG, KETERANGAN, SATUAN, DOKUMENTASI)  */}
      {/* ===================================================================== */}
      {(activeTab === 'scanner' || activeTab === 'inventory' || activeTab === 'overview') && (
        <WarehouseDatabaseBarangView
          onSyncWithMasterSku={records => {
            setSkuItems(prev => {
              const existingByCode = new Map<string, MasterSkuRecord>();
              prev.forEach(item => {
                if (!isLegacySeededBarang(item.noBarang)) {
                  existingByCode.set(item.noBarang.trim().toUpperCase(), item);
                }
              });
              return records
                .filter(rec => !isLegacySeededBarang(rec.noBarang))
                .map(rec => {
                  const key = rec.noBarang.trim().toUpperCase();
                  const existing = existingByCode.get(key);
                  return {
                    id: existing?.id || rec.id,
                    kategoriBarang:
                      rec.kategoriBarang ||
                      existing?.kategoriBarang ||
                      inferKategoriBarang(rec.noBarang, rec.deskripsiBarang || rec.keteranganBarang),
                    noBarang: rec.noBarang,
                    namaBarang: rec.deskripsiBarang || rec.keteranganBarang,
                    stokTersedia: existing?.stokTersedia ?? rec.stokTersedia ?? 1000,
                    satuan: rec.unit1 || rec.satuan,
                    cabang: existing?.cabang || rec.cabang || 'Banyuwangi',
                    lokasiStock: existing?.lokasiStock || 'Gudang Utama Argopuro',
                    tanggalStok: rec.updatedAt,
                    panjangCm: rec.panjangCm,
                    lebarCm: rec.lebarCm,
                    tinggiCm: rec.tinggiCm,
                    kubikasiM3: rec.volM3,
                    beratKg: rec.beratKg
                  };
                });
            });
          }}
        />
      )}

      {/* ===================================================================== */}
      {/* POPUP MODAL NOTIFICATION (SUPPORTS ENTER KEY)                         */}
      {/* ===================================================================== */}
      {popupModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-md w-full p-6 text-center space-y-4 shadow-2xl animate-fade-in">
            <div className="w-12 h-12 rounded-2xl bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <div className="space-y-1.5">
              <h4 className="text-base font-black text-slate-900 dark:text-white">
                {popupModal.title}
              </h4>
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                {popupModal.message}
              </p>
            </div>
            <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                autoFocus
                onClick={() => setPopupModal(null)}
                className="w-full py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-black text-xs cursor-pointer transition shadow-sm"
              >
                Oke, Mengerti
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
