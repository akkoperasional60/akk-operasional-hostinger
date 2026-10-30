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
  Filter
} from 'lucide-react';
import { Warehouse3DSimulation } from './Warehouse3DSimulation';
import {
  WarehouseItemCubicationView,
  WarehouseFleetCubicationSimulator
} from './WarehouseCubicationModules';
import { branchStore, BranchRecord } from '../services/branchStore';

export type WmsSubTab =
  | 'overview'
  | 'inventory'
  | 'inbound'
  | 'outbound'
  | 'scanner'
  | 'slotting'
  | 'opname'
  | 'cubication'
  | 'fleet_cubication';

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

const INITIAL_MASTER_SKUS: MasterSkuRecord[] = [
  { id: 'sku-1', kategoriBarang: 'Karton Box Corrugated', noBarang: 'AKK-KBX-001', namaBarang: 'Karton Box Corrugated B-Flute 60x40x40 cm (Polos)', stokTersedia: 4850, satuan: 'Pcs', cabang: 'Banyuwangi', lokasiStock: 'Gudang Utama Argopuro', tanggalStok: '2026-10-29' },
  { id: 'sku-2', kategoriBarang: 'Karton Box Double Wall', noBarang: 'AKK-KBX-002', namaBarang: 'Karton Box Double Wall CB-Flute Export 80x50x50 cm', stokTersedia: 1120, satuan: 'Pcs', cabang: 'Banyuwangi', lokasiStock: 'Gudang Utama Argopuro', tanggalStok: '2026-10-29' },
  { id: 'sku-3', kategoriBarang: 'Box Kemasan Makanan', noBarang: 'AKK-KBX-003', namaBarang: 'Box Kemasan Makanan Food Grade Ivory 22x22x8 cm', stokTersedia: 9400, satuan: 'Pcs', cabang: 'Banyuwangi', lokasiStock: 'Gudang Utama Argopuro', tanggalStok: '2026-10-29' },
  { id: 'sku-4', kategoriBarang: 'Karton Box Corrugated', noBarang: 'AKK-KBX-004', namaBarang: 'Karton Box Polos E-Flute 40x30x25 cm', stokTersedia: 3600, satuan: 'Pcs', cabang: 'Banyuwangi', lokasiStock: 'Gudang Utama Argopuro', tanggalStok: '2026-10-29' },
  { id: 'sku-5', kategoriBarang: 'Karton Box Corrugated', noBarang: 'AKK-KBX-005', namaBarang: 'Karton Box C-Flute Tebal 50x35x35 cm', stokTersedia: 4100, satuan: 'Pcs', cabang: 'Banyuwangi', lokasiStock: 'Gudang Utama Argopuro', tanggalStok: '2026-10-29' }
];

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

  // Master SKU State (persisted in localStorage)
  const [skuItems, setSkuItems] = useState<MasterSkuRecord[]>(() => {
    try {
      // Prefer the current v3 store, but migrate existing v2 data instead of
      // silently discarding user-imported Master SKU records on upgrade.
      const savedV3 = localStorage.getItem(LS_KEY_MASTER_SKU);
      const savedLegacy = localStorage.getItem(LS_KEY_MASTER_SKU_LEGACY);
      const saved = savedV3 || savedLegacy;

      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          // Only replace the exact 24-row legacy demo dataset. Do not wipe
          // arbitrary user-imported data merely because it contains sku-6.
          const legacyDemoCodes = new Set([
            'AKK-KBX-001', 'AKK-KBX-002', 'AKK-KBX-003', 'AKK-KBX-004', 'AKK-KBX-005',
            'AKK-KBX-006', 'AKK-KBX-007', 'AKK-KBX-008', 'AKK-KBX-009', 'AKK-KBX-010',
            'AKK-PLS-014', 'AKK-PLS-019', 'AKK-PLS-022', 'AKK-PLS-030', 'AKK-PLS-034',
            'AKK-MPK-007', 'AKK-MPK-008', 'AKK-MPK-011', 'AKK-MPK-015',
            'AKK-PRD-025', 'AKK-PRD-028', 'AKK-PRD-031', 'AKK-PRD-035', 'AKK-KBX-040'
          ]);
          const isExactLegacyDemo =
            parsed.length === legacyDemoCodes.size &&
            parsed.every((item: any) => legacyDemoCodes.has(String(item?.noBarang || '').toUpperCase()));

          if (isExactLegacyDemo) {
            return INITIAL_MASTER_SKUS;
          }

          return parsed.map((item: any) => ({
            ...item,
            kategoriBarang: inferKategoriBarang(item.noBarang || '', item.namaBarang || '', item.kategoriBarang)
          }));
        }
      }
    } catch {
      // ignore malformed local cache and fall back to initial data
    }
    return INITIAL_MASTER_SKUS;
  });

  // Kartu Stok Analysis State (persisted in localStorage)
  const [kartuStokList, setKartuStokList] = useState<KartuStokAnalysisRecord[]>(() => {
    try {
      const saved = localStorage.getItem(LS_KEY_KARTU_STOK);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {
      // ignore
    }
    return INITIAL_KARTU_STOK_ANALYSIS;
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

  useEffect(() => {
    try {
      localStorage.setItem(LS_KEY_MASTER_SKU, JSON.stringify(skuItems));
    } catch {
      // ignore
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
      message: `${count} data barang dari file Excel berhasil diimport ke Master Barang.`
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
    setIsAddSkuModalOpen(false);
    setNewSkuForm({ kategoriBarang: 'Karton Box Corrugated', noBarang: '', namaBarang: '', stokTersedia: '', satuan: 'Pcs' });
    setPopupModal({
      title: 'Data Berhasil Disimpan',
      message: `Barang "${item.namaBarang}" (${item.noBarang}) berhasil ditambahkan ke Gudang ${targetBranch?.name || 'Nusantara'}.`
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
      {/* TAB: KARTU STOK & ANALISA OTOMATIS                                    */}
      {/* ===================================================================== */}
      {activeTab === 'opname' && (
        <div className="space-y-4">
          {/* Header Kartu Stok */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-lg bg-emerald-50 dark:bg-emerald-500/15 border border-emerald-200 dark:border-emerald-500/30 text-emerald-700 dark:text-emerald-300 text-[10px] font-black uppercase tracking-wider">
                  Analisa Otomatis Kartu Stok
                </span>
              </div>
              <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-white tracking-tight">
                Kartu Stok Digital &amp; Analisa Selisih Hari Pengisian Stok
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
      {/* TAB: MASTER SKU & STOK BIN GUDANG (DEFAULT FOR OVERVIEW / INVENTORY)  */}
      {/* ===================================================================== */}
      {(activeTab === 'inventory' || activeTab === 'overview' || activeTab === 'scanner') && (
        <div className="space-y-4">
          {/* Header Banner WMS */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-lg bg-blue-50 dark:bg-blue-500/15 border border-blue-200 dark:border-blue-500/30 text-blue-700 dark:text-blue-300 text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5">
                  <Building2 className="w-3.5 h-3.5" />
                  <span>Master SKU &amp; Stok Gudang</span>
                </span>
              </div>
              <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-white tracking-tight">
                Warehouse Management System (WMS) &mdash; PT Anugrah Kemasan Kreatif
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Daftar Master SKU dan ketersediaan stok barang gudang. Gunakan fitur <strong>Unggah File</strong> untuk mengimport file Excel stok mentah secara otomatis.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setIsUploadSkuPageOpen(true)}
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1.5 transition cursor-pointer shadow-xs"
              >
                <Upload className="w-3.5 h-3.5" />
                <span>Unggah File (Upload Excel)</span>
              </button>
              <button
                type="button"
                onClick={() => setIsAddSkuModalOpen(true)}
                className="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold flex items-center gap-1.5 transition cursor-pointer shadow-xs"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Tambah Master SKU</span>
              </button>
            </div>
          </div>

          {/* Multi-Store Branch Selector Bar */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-3.5 shadow-xs flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Warehouse className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <span className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider">
                Filter Cabang (Multi-Store Inventaris):
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={() => {
                  branchStore.setSelectedOriginBranchId('ALL');
                  setSkuPage(1);
                }}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer border ${
                  selectedBranchId === 'ALL'
                    ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                    : 'bg-slate-50 dark:bg-slate-950 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-800 hover:border-emerald-400'
                }`}
              >
                Semua Cabang ({skuItems.length} SKU)
              </button>
              {branches.map((b) => {
                const count = skuItems.filter(i => branchStore.getInventoryBranch(i.id).id === b.id).length;
                const active = selectedBranchId === b.id;
                return (
                  <button
                    key={b.id}
                    type="button"
                    onClick={() => {
                      branchStore.setSelectedOriginBranchId(b.id);
                      setSkuPage(1);
                    }}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer border ${
                      active
                        ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                        : 'bg-slate-50 dark:bg-slate-950 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-800 hover:border-emerald-400'
                    }`}
                  >
                    {b.name} ({count} SKU)
                  </button>
                );
              })}
            </div>
          </div>

          {/* Search, Filter & Page Size Controls */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={skuSearch}
                onChange={(e) => setSkuSearch(e.target.value)}
                placeholder="Cari No Barang / Kode Barang atau Nama Barang..."
                className="w-full pl-10 pr-4 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-blue-500"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <select
                value={skuKategoriFilter}
                onChange={(e) => setSkuKategoriFilter(e.target.value)}
                className="px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs font-bold text-slate-800 dark:text-slate-200 cursor-pointer"
              >
                <option value="ALL">Semua Kategori Barang ({availableKategoriList.length})</option>
                {availableKategoriList.map((kat) => (
                  <option key={kat} value={kat}>
                    {kat}
                  </option>
                ))}
              </select>

              <select
                value={skuSatuanFilter}
                onChange={(e) => setSkuSatuanFilter(e.target.value)}
                className="px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs font-bold text-slate-800 dark:text-slate-200 cursor-pointer"
              >
                <option value="ALL">Semua Satuan ({skuItems.length})</option>
                {availableSatuanList.map((sat) => (
                  <option key={sat} value={sat}>
                    Satuan: {sat}
                  </option>
                ))}
              </select>

              <div className="flex items-center gap-1.5 text-xs">
                <span className="text-slate-500 font-semibold">Batas Halaman:</span>
                <select
                  value={skuPageSize}
                  onChange={(e) => setSkuPageSize(Number(e.target.value))}
                  className="px-2.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs font-bold text-slate-800 dark:text-slate-200 cursor-pointer"
                >
                  <option value={5}>5 Baris / Hal</option>
                  <option value={10}>10 Baris / Hal</option>
                  <option value={20}>20 Baris / Hal</option>
                  <option value={50}>50 Baris / Hal</option>
                </select>
              </div>
            </div>
          </div>

          {/* Master Barang Table with 5 Required Columns: Kategori Barang, No Barang, Nama Barang, Stok Tersedia, Satuan */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-xs">
            <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-black text-slate-900 dark:text-white">
                  Daftar Master Barang &amp; Stok Tersedia
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Menampilkan Kategori Barang, No Barang, Nama Barang, Stok Tersedia, dan Satuan.
                </p>
              </div>
              <span className="text-xs font-bold text-slate-600 dark:text-slate-300">
                Total Barang: <span className="font-mono text-indigo-600 dark:text-indigo-400">{filteredSkus.length}</span>
              </span>
            </div>

            <div className="overflow-x-auto">
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
                  {paginatedSkus.length > 0 ? (
                    paginatedSkus.map((item) => {
                      const itemBranch = branchStore.getInventoryBranch(item.id);
                      return (
                        <tr key={item.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition">
                          <td className="py-3 px-4">
                            <span className="px-2.5 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/30 text-emerald-700 dark:text-emerald-300 font-bold text-[11px] inline-block">
                              {item.kategoriBarang || 'Karton Box Corrugated'}
                            </span>
                          </td>
                          <td className="py-3 px-4 font-mono font-bold text-indigo-600 dark:text-indigo-400">
                            {item.noBarang}
                          </td>
                          <td className="py-3 px-4">
                            <div className="font-bold text-slate-900 dark:text-white">{item.namaBarang}</div>
                            <div className="flex items-center gap-1.5 mt-1">
                              <span className="text-[10px] text-slate-400 font-semibold">Cabang:</span>
                              <select
                                value={itemBranch.id}
                                onChange={(e) => {
                                  branchStore.setInventoryBranch(item.id, e.target.value);
                                  setBranches(branchStore.getActiveBranches());
                                }}
                                className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-[10px] font-bold text-emerald-700 dark:text-emerald-300 cursor-pointer focus:outline-none"
                              >
                                {branches.map((b) => (
                                  <option key={b.id} value={b.id}>
                                    Gudang {b.name} ({b.slug})
                                  </option>
                                ))}
                              </select>
                            </div>
                          </td>
                          <td className="py-3 px-4 text-right font-mono font-black text-slate-900 dark:text-white">
                            {item.stokTersedia.toLocaleString('id-ID')}
                          </td>
                          <td className="py-3 px-4 font-semibold text-slate-700 dark:text-slate-300">
                            {item.satuan}
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-slate-400 text-xs">
                        Tidak ada data barang yang cocok dengan pencarian.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination (Pagging) Controls */}
            <div className="p-4 border-t border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
              <div className="text-slate-500 dark:text-slate-400 font-medium">
                Menampilkan{' '}
                <strong className="text-slate-900 dark:text-white">
                  {filteredSkus.length === 0 ? 0 : (currentSkuPage - 1) * skuPageSize + 1}
                </strong>{' '}
                &ndash;{' '}
                <strong className="text-slate-900 dark:text-white">
                  {Math.min(currentSkuPage * skuPageSize, filteredSkus.length)}
                </strong>{' '}
                dari <strong className="text-slate-900 dark:text-white">{filteredSkus.length}</strong> barang (Halaman {currentSkuPage} dari {totalSkuPages})
              </div>

              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  disabled={currentSkuPage <= 1}
                  onClick={() => setSkuPage(p => Math.max(1, p - 1))}
                  className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-700 dark:text-slate-300 font-bold disabled:opacity-40 cursor-pointer flex items-center gap-1"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                  <span>Sebelumnya</span>
                </button>

                {Array.from({ length: totalSkuPages }, (_, i) => i + 1).map((pageNum) => (
                  <button
                    key={pageNum}
                    type="button"
                    onClick={() => setSkuPage(pageNum)}
                    className={`w-8 h-8 rounded-xl font-mono text-xs font-black transition cursor-pointer ${
                      pageNum === currentSkuPage
                        ? 'bg-indigo-600 text-white'
                        : 'bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100'
                    }`}
                  >
                    {pageNum}
                  </button>
                ))}

                <button
                  type="button"
                  disabled={currentSkuPage >= totalSkuPages}
                  onClick={() => setSkuPage(p => Math.min(totalSkuPages, p + 1))}
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
      {/* MODAL: TAMBAH MASTER SKU MANUAL                                       */}
      {/* ===================================================================== */}
      {isAddSkuModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-xl">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-black text-slate-900 dark:text-white">
                Tambah Master SKU Baru
              </h4>
              <button
                onClick={() => setIsAddSkuModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-900 dark:hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAddManualSku} className="space-y-3 text-xs">
              <div className="space-y-1">
                <label className="font-bold text-slate-600 dark:text-slate-400 uppercase text-[10px]">
                  Kategori Barang
                </label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: Karton Box Corrugated"
                  value={newSkuForm.kategoriBarang}
                  onChange={(e) => setNewSkuForm({ ...newSkuForm, kategoriBarang: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white font-bold"
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-600 dark:text-slate-400 uppercase text-[10px]">
                  No Barang / Kode Barang
                </label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: AKK-KBX-055"
                  value={newSkuForm.noBarang}
                  onChange={(e) => setNewSkuForm({ ...newSkuForm, noBarang: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white font-mono font-bold"
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-600 dark:text-slate-400 uppercase text-[10px]">
                  Nama Barang / Deskripsi
                </label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: Karton Box B-Flute 60x40x40 cm"
                  value={newSkuForm.namaBarang}
                  onChange={(e) => setNewSkuForm({ ...newSkuForm, namaBarang: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white font-bold"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-bold text-slate-600 dark:text-slate-400 uppercase text-[10px]">
                    Stok Tersedia
                  </label>
                  <input
                    type="number"
                    required
                    placeholder="Contoh: 1500"
                    value={newSkuForm.stokTersedia}
                    onChange={(e) => setNewSkuForm({ ...newSkuForm, stokTersedia: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white font-mono font-bold"
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-bold text-slate-600 dark:text-slate-400 uppercase text-[10px]">
                    Satuan
                  </label>
                  <select
                    value={newSkuForm.satuan}
                    onChange={(e) => setNewSkuForm({ ...newSkuForm, satuan: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white font-bold"
                  >
                    <option value="Pcs">Pcs</option>
                    <option value="Ball">Ball</option>
                    <option value="Roll">Roll</option>
                    <option value="Karton">Karton</option>
                    <option value="Ikat">Ikat</option>
                  </select>
                </div>
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddSkuModalOpen(false)}
                  className="px-3.5 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold cursor-pointer"
                >
                  Simpan Barang
                </button>
              </div>
            </form>
          </div>
        </div>
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
