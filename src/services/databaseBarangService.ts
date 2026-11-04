export interface DatabaseBarangRecord {
  id: string;
  noBarang: string;
  deskripsiBarang: string;
  keteranganBarang: string; // alias backwards compatibility
  unit1: string;
  satuan: string; // alias backwards compatibility
  unit2?: string;
  unit3?: string;
  rasio2?: number | string;
  rasio3?: number | string;
  panjangCm: number;
  lebarCm: number;
  tinggiCm: number;
  volM3: number;
  beratKg: number;
  dokumentasiUrl?: string;
  dokumentasiUrls?: string[];
  compressedSizeKb?: number;
  originalSizeKb?: number;
  compressionSavingsPct?: number;
  kategoriBarang?: string;
  stokTersedia?: number;
  cabang?: string;
  updatedAt: string;
}

export interface CompressedPhotoResult {
  dataUrl: string;
  originalSizeKb: number;
  compressedSizeKb: number;
  savingsPercent: number;
  width: number;
  height: number;
  format: string;
}

export const LS_KEY_DATABASE_BARANG = 'akk_wms_database_barang_v1';
const LS_KEY_MASTER_SKU = 'akk_wms_master_sku_v3';

export function calculateVolM3(panjangCm: number, lebarCm: number, tinggiCm: number): number {
  const p = Number(panjangCm) || 0;
  const l = Number(lebarCm) || 0;
  const t = Number(tinggiCm) || 0;
  if (!p || !l || !t) return 0;
  return Number(((p * l * t) / 1000000).toFixed(4));
}

export function createDefaultBarangThumbnail(
  noBarang: string,
  keteranganBarang: string,
  satuan: string
): string {
  const safeCode = (noBarang || 'BRG-001').replace(/[<>&"']/g, '').slice(0, 18);
  const safeDesc = (keteranganBarang || 'Barang Kemasan AKK').replace(/[<>&"']/g, '').slice(0, 34);
  const safeUnit = (satuan || 'Pcs').replace(/[<>&"']/g, '').slice(0, 10);

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="240" height="160" viewBox="0 0 240 160">
    <rect width="240" height="160" rx="12" fill="#0f172a"/>
    <rect x="10" y="10" width="220" height="140" rx="8" fill="none" stroke="#334155" stroke-width="1.5" stroke-dasharray="5 4"/>
    <rect x="78" y="34" width="84" height="58" rx="6" fill="#f59e0b" fill-opacity="0.18" stroke="#f59e0b" stroke-width="1.8"/>
    <line x1="78" y1="52" x2="162" y2="52" stroke="#f59e0b" stroke-width="1.4"/>
    <line x1="120" y1="34" x2="120" y2="52" stroke="#f59e0b" stroke-width="1.4"/>
    <rect x="18" y="18" width="86" height="18" rx="4" fill="#0284c7"/>
    <text x="24" y="30" fill="#ffffff" font-family="monospace" font-size="9" font-weight="bold">${safeCode}</text>
    <rect x="172" y="18" width="50" height="18" rx="4" fill="#059669"/>
    <text x="197" y="30" text-anchor="middle" fill="#ffffff" font-family="sans-serif" font-size="8.5" font-weight="bold">${safeUnit}</text>
    <text x="120" y="114" text-anchor="middle" fill="#f8fafc" font-family="sans-serif" font-size="9.5" font-weight="bold">${safeDesc}</text>
    <text x="120" y="132" text-anchor="middle" fill="#94a3b8" font-family="sans-serif" font-size="7.5">DOKUMENTASI DATABASE BARANG</text>
  </svg>`;

  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

export function estimateDataUrlSizeKb(dataUrl: string): number {
  if (!dataUrl) return 0;
  if (dataUrl.startsWith('data:image/svg+xml')) {
    return Number((new Blob([dataUrl]).size / 1024).toFixed(1));
  }
  const base64Index = dataUrl.indexOf(';base64,');
  if (base64Index !== -1) {
    const base64Length = dataUrl.length - (base64Index + 8);
    const byteLength = (base64Length * 3) / 4;
    return Number(Math.max(0.5, byteLength / 1024).toFixed(1));
  }
  return Number(Math.max(0.5, dataUrl.length / 1024).toFixed(1));
}

export async function compressDocumentationPhoto(
  fileOrDataUrl: File | string,
  options?: {
    maxDimension?: number;
    targetMaxKb?: number;
    initialQuality?: number;
  }
): Promise<CompressedPhotoResult> {
  const maxDimension = options?.maxDimension ?? 320;
  const targetMaxKb = options?.targetMaxKb ?? 14;
  const initialQuality = options?.initialQuality ?? 0.48;

  let originalSizeKb = 0;
  let sourceDataUrl = '';

  if (typeof fileOrDataUrl === 'string') {
    sourceDataUrl = fileOrDataUrl;
    originalSizeKb = estimateDataUrlSizeKb(fileOrDataUrl);
  } else {
    originalSizeKb = Number(Math.max(1, fileOrDataUrl.size / 1024).toFixed(1));
    sourceDataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = () => reject(new Error('Gagal membaca file gambar'));
      reader.readAsDataURL(fileOrDataUrl);
    });
  }

  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = 'anonymous';
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Gagal memuat objek gambar'));
    image.src = sourceDataUrl;
  });

  const renderAtScale = (limitPx: number, quality: number, mimeType: string): { url: string; w: number; h: number } => {
    const origW = img.naturalWidth || img.width || 320;
    const origH = img.naturalHeight || img.height || 240;
    const ratio = Math.min(1, limitPx / Math.max(origW, origH));
    const width = Math.max(64, Math.round(origW * ratio));
    const height = Math.max(48, Math.round(origH * ratio));

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(0, 0, width, height);
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, 0, 0, width, height);
    }
    const url = canvas.toDataURL(mimeType, quality);
    return { url, w: width, h: height };
  };

  let preferredMime = 'image/webp';
  const testWebp = renderAtScale(64, 0.5, 'image/webp').url;
  if (!testWebp.startsWith('data:image/webp')) {
    preferredMime = 'image/jpeg';
  }

  const steps = [
    { dim: maxDimension, q: initialQuality },
    { dim: maxDimension, q: 0.36 },
    { dim: Math.round(maxDimension * 0.85), q: 0.30 },
    { dim: Math.round(maxDimension * 0.72), q: 0.24 },
    { dim: 200, q: 0.20 }
  ];

  let bestResult = renderAtScale(maxDimension, initialQuality, preferredMime);
  let bestSizeKb = estimateDataUrlSizeKb(bestResult.url);

  for (const step of steps) {
    const candidate = renderAtScale(step.dim, step.q, preferredMime);
    const sizeKb = estimateDataUrlSizeKb(candidate.url);
    bestResult = candidate;
    bestSizeKb = sizeKb;
    if (sizeKb <= targetMaxKb) {
      break;
    }
  }

  const effectiveOriginalKb = Math.max(originalSizeKb, bestSizeKb);
  const savingsPercent =
    effectiveOriginalKb > bestSizeKb
      ? Math.min(99, Math.max(1, Math.round(((effectiveOriginalKb - bestSizeKb) / effectiveOriginalKb) * 100)))
      : 0;

  return {
    dataUrl: bestResult.url,
    originalSizeKb: effectiveOriginalKb,
    compressedSizeKb: bestSizeKb,
    savingsPercent,
    width: bestResult.w,
    height: bestResult.h,
    format: preferredMime === 'image/webp' ? 'WebP' : 'JPEG'
  };
}

const DEFAULT_DATABASE_BARANG: DatabaseBarangRecord[] = [
  {
    id: 'dbb-1',
    noBarang: 'AKK-KBX-001',
    deskripsiBarang: 'Karton Box Corrugated B-Flute 60x40x40 cm (Polos)',
    keteranganBarang: 'Karton Box Corrugated B-Flute 60x40x40 cm (Polos)',
    unit1: 'Pcs',
    satuan: 'Pcs',
    unit2: 'Ikat',
    unit3: 'Palet',
    rasio2: 25,
    rasio3: 500,
    panjangCm: 60,
    lebarCm: 40,
    tinggiCm: 40,
    volM3: 0.096,
    beratKg: 0.65,
    dokumentasiUrl: createDefaultBarangThumbnail('AKK-KBX-001', 'Karton Box Corrugated B-Flute 60x40x40 cm (Polos)', 'Pcs'),
    compressedSizeKb: 0.9,
    originalSizeKb: 420.0,
    compressionSavingsPct: 99,
    kategoriBarang: 'Karton Box Corrugated',
    stokTersedia: 4850,
    cabang: 'Banyuwangi',
    updatedAt: '2026-11-04'
  },
  {
    id: 'dbb-2',
    noBarang: 'AKK-KBX-002',
    deskripsiBarang: 'Karton Box Double Wall CB-Flute Export 80x50x50 cm',
    keteranganBarang: 'Karton Box Double Wall CB-Flute Export 80x50x50 cm',
    unit1: 'Pcs',
    satuan: 'Pcs',
    unit2: 'Ikat',
    unit3: 'Palet',
    rasio2: 20,
    rasio3: 300,
    panjangCm: 80,
    lebarCm: 50,
    tinggiCm: 50,
    volM3: 0.200,
    beratKg: 1.25,
    dokumentasiUrl: createDefaultBarangThumbnail('AKK-KBX-002', 'Karton Box Double Wall CB-Flute Export 80x50x50 cm', 'Pcs'),
    compressedSizeKb: 0.9,
    originalSizeKb: 380.0,
    compressionSavingsPct: 99,
    kategoriBarang: 'Karton Box Double Wall',
    stokTersedia: 1120,
    cabang: 'Banyuwangi',
    updatedAt: '2026-11-04'
  },
  {
    id: 'dbb-3',
    noBarang: 'AKK-KBX-003',
    deskripsiBarang: 'Box Kemasan Makanan Food Grade Ivory 22x22x8 cm',
    keteranganBarang: 'Box Kemasan Makanan Food Grade Ivory 22x22x8 cm',
    unit1: 'Pcs',
    satuan: 'Pcs',
    unit2: 'Pack',
    unit3: 'Karton',
    rasio2: 50,
    rasio3: 500,
    panjangCm: 22,
    lebarCm: 22,
    tinggiCm: 8,
    volM3: 0.0039,
    beratKg: 0.08,
    dokumentasiUrl: createDefaultBarangThumbnail('AKK-KBX-003', 'Box Kemasan Makanan Food Grade Ivory 22x22x8 cm', 'Pcs'),
    compressedSizeKb: 0.9,
    originalSizeKb: 510.0,
    compressionSavingsPct: 99,
    kategoriBarang: 'Box Kemasan Makanan',
    stokTersedia: 9400,
    cabang: 'Banyuwangi',
    updatedAt: '2026-11-04'
  },
  {
    id: 'dbb-4',
    noBarang: 'AKK-KBX-004',
    deskripsiBarang: 'Karton Box Polos E-Flute 40x30x25 cm',
    keteranganBarang: 'Karton Box Polos E-Flute 40x30x25 cm',
    unit1: 'Pcs',
    satuan: 'Pcs',
    unit2: 'Ikat',
    unit3: 'Palet',
    rasio2: 25,
    rasio3: 600,
    panjangCm: 40,
    lebarCm: 30,
    tinggiCm: 25,
    volM3: 0.030,
    beratKg: 0.35,
    dokumentasiUrl: createDefaultBarangThumbnail('AKK-KBX-004', 'Karton Box Polos E-Flute 40x30x25 cm', 'Pcs'),
    compressedSizeKb: 0.9,
    originalSizeKb: 340.0,
    compressionSavingsPct: 99,
    kategoriBarang: 'Karton Box Corrugated',
    stokTersedia: 3600,
    cabang: 'Banyuwangi',
    updatedAt: '2026-11-04'
  },
  {
    id: 'dbb-5',
    noBarang: 'AKK-KBX-005',
    deskripsiBarang: 'Karton Box C-Flute Tebal 50x35x35 cm',
    keteranganBarang: 'Karton Box C-Flute Tebal 50x35x35 cm',
    unit1: 'Pcs',
    satuan: 'Pcs',
    unit2: 'Ikat',
    unit3: 'Palet',
    rasio2: 20,
    rasio3: 400,
    panjangCm: 50,
    lebarCm: 35,
    tinggiCm: 35,
    volM3: 0.0613,
    beratKg: 0.52,
    dokumentasiUrl: createDefaultBarangThumbnail('AKK-KBX-005', 'Karton Box C-Flute Tebal 50x35x35 cm', 'Pcs'),
    compressedSizeKb: 0.9,
    originalSizeKb: 390.0,
    compressionSavingsPct: 99,
    kategoriBarang: 'Karton Box Corrugated',
    stokTersedia: 4100,
    cabang: 'Banyuwangi',
    updatedAt: '2026-11-04'
  },
  {
    id: 'dbb-6',
    noBarang: 'RFID-KB-002',
    deskripsiBarang: 'Karton Box Duplex Cetak Custom 30x20x15 cm',
    keteranganBarang: 'Karton Box Duplex Cetak Custom 30x20x15 cm',
    unit1: 'Pcs',
    satuan: 'Pcs',
    unit2: 'Box',
    unit3: 'Bal',
    rasio2: 50,
    rasio3: 500,
    panjangCm: 30,
    lebarCm: 20,
    tinggiCm: 15,
    volM3: 0.009,
    beratKg: 0.18,
    dokumentasiUrl: createDefaultBarangThumbnail('RFID-KB-002', 'Karton Box Duplex Cetak Custom 30x20x15 cm', 'Pcs'),
    compressedSizeKb: 0.9,
    originalSizeKb: 460.0,
    compressionSavingsPct: 99,
    kategoriBarang: 'Box Kemasan Makanan',
    stokTersedia: 2800,
    cabang: 'Banyuwangi',
    updatedAt: '2026-11-04'
  },
  {
    id: 'dbb-7',
    noBarang: 'RFID-KB-004',
    deskripsiBarang: 'Box Pizza E-Flute Kraft Coklat 25x25x5 cm',
    keteranganBarang: 'Box Pizza E-Flute Kraft Coklat 25x25x5 cm',
    unit1: 'Pcs',
    satuan: 'Pcs',
    unit2: 'Ikat',
    unit3: 'Karton',
    rasio2: 50,
    rasio3: 1000,
    panjangCm: 25,
    lebarCm: 25,
    tinggiCm: 5,
    volM3: 0.0031,
    beratKg: 0.09,
    dokumentasiUrl: createDefaultBarangThumbnail('RFID-KB-004', 'Box Pizza E-Flute Kraft Coklat 25x25x5 cm', 'Pcs'),
    compressedSizeKb: 0.9,
    originalSizeKb: 310.0,
    compressionSavingsPct: 99,
    kategoriBarang: 'Box Kemasan Makanan',
    stokTersedia: 5200,
    cabang: 'Banyuwangi',
    updatedAt: '2026-11-04'
  },
  {
    id: 'dbb-8',
    noBarang: 'RFID-KB-005',
    deskripsiBarang: 'Paper Bag Kraft Coklat Tebal Uk. L 32x26x11 cm',
    keteranganBarang: 'Paper Bag Kraft Coklat Tebal Uk. L 32x26x11 cm',
    unit1: 'Pcs',
    satuan: 'Pcs',
    unit2: 'Pack',
    unit3: 'Bal',
    rasio2: 50,
    rasio3: 1000,
    panjangCm: 32,
    lebarCm: 26,
    tinggiCm: 11,
    volM3: 0.0092,
    beratKg: 0.06,
    dokumentasiUrl: createDefaultBarangThumbnail('RFID-KB-005', 'Paper Bag Kraft Coklat Tebal Uk. L 32x26x11 cm', 'Pcs'),
    compressedSizeKb: 0.9,
    originalSizeKb: 295.0,
    compressionSavingsPct: 99,
    kategoriBarang: 'Paper Cup & Food Pack',
    stokTersedia: 3100,
    cabang: 'Banyuwangi',
    updatedAt: '2026-11-04'
  }
];

function normalizeText(str: string): string {
  return String(str || '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

function sanitizeRecord(item: any, fallbackIndex = 0): DatabaseBarangRecord {
  const code = String(item?.noBarang || '').trim().toUpperCase() || `AKK-BRG-${String(fallbackIndex + 1).padStart(3, '0')}`;
  const desc = String(item?.deskripsiBarang || item?.keteranganBarang || 'Barang Kemasan AKK').trim();
  const u1 = String(item?.unit1 || item?.satuan || 'Pcs').trim();
  const u2 = item?.unit2 !== undefined && item?.unit2 !== null ? String(item.unit2).trim() : '';
  const u3 = item?.unit3 !== undefined && item?.unit3 !== null ? String(item.unit3).trim() : '';
  const r2 = item?.rasio2 !== undefined && item?.rasio2 !== null && item?.rasio2 !== ''
    ? (!isNaN(Number(item.rasio2)) ? Number(item.rasio2) : item.rasio2)
    : 0;
  const r3 = item?.rasio3 !== undefined && item?.rasio3 !== null && item?.rasio3 !== ''
    ? (!isNaN(Number(item.rasio3)) ? Number(item.rasio3) : item.rasio3)
    : 0;
  const p = Number(item?.panjangCm) || 0;
  const l = Number(item?.lebarCm) || 0;
  const t = Number(item?.tinggiCm) || 0;
  let v = 0;
  if (item?.volM3 !== undefined && item?.volM3 !== null && item?.volM3 !== '') {
    v = Number(item.volM3) || 0;
  } else if (p > 0 && l > 0 && t > 0) {
    v = calculateVolM3(p, l, t);
  }
  const b = item?.beratKg !== undefined && item?.beratKg !== null && item?.beratKg !== ''
    ? Number(item.beratKg) || 0
    : 0;

  // Hanya simpan foto jika memang foto kustom / unggahan pengguna, jangan simpan inline SVG ribuan kali di localStorage
  const rawUrls: string[] = Array.isArray(item?.dokumentasiUrls)
    ? item.dokumentasiUrls.filter((u: any) => typeof u === 'string' && u.trim() && !u.startsWith('data:image/svg+xml'))
    : [];
  const singleDoc = item?.dokumentasiUrl && !item.dokumentasiUrl.startsWith('data:image/svg+xml')
    ? item.dokumentasiUrl
    : '';
  if (singleDoc && !rawUrls.includes(singleDoc)) {
    rawUrls.unshift(singleDoc);
  }
  const primaryDoc = rawUrls[0] || singleDoc || '';

  return {
    id: item?.id || `dbb-${fallbackIndex + 1}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    noBarang: code,
    deskripsiBarang: desc,
    keteranganBarang: desc,
    unit1: u1,
    satuan: u1,
    unit2: u2,
    unit3: u3,
    rasio2: r2,
    rasio3: r3,
    panjangCm: p,
    lebarCm: l,
    tinggiCm: t,
    volM3: v,
    beratKg: b,
    dokumentasiUrl: primaryDoc,
    dokumentasiUrls: rawUrls,
    compressedSizeKb: item?.compressedSizeKb ?? 0,
    originalSizeKb: item?.originalSizeKb ?? 0,
    compressionSavingsPct: item?.compressionSavingsPct ?? 0,
    kategoriBarang: item?.kategoriBarang || 'Karton Box Corrugated',
    stokTersedia: item?.stokTersedia !== undefined ? Number(item.stokTersedia) : 1000,
    cabang: item?.cabang || 'Banyuwangi',
    updatedAt: item?.updatedAt || new Date().toISOString().split('T')[0]
  };
}

const IDB_NAME = 'AKK_WMS_DATABASE_V1';
const IDB_STORE = 'database_barang';
const IDB_VERSION = 1;

let inMemoryItems: DatabaseBarangRecord[] | null = null;
let isHydratingIdb = false;

function openIndexedDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      return reject(new Error('IndexedDB tidak didukung pada environment ini'));
    }
    const req = window.indexedDB.open(IDB_NAME, IDB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(IDB_STORE)) {
        db.createObjectStore(IDB_STORE, { keyPath: 'id' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error('Gagal membuka IndexedDB'));
  });
}

export async function saveRecordsToIndexedDb(records: DatabaseBarangRecord[]): Promise<void> {
  try {
    const db = await openIndexedDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(IDB_STORE, 'readwrite');
      const store = tx.objectStore(IDB_STORE);
      store.clear();
      for (const r of records) {
        store.put(r);
      }
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    console.warn('Peringatan: Gagal menyimpan data barang ke IndexedDB:', err);
  }
}

export async function loadRecordsFromIndexedDb(): Promise<DatabaseBarangRecord[]> {
  try {
    const db = await openIndexedDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(IDB_STORE, 'readonly');
      const store = tx.objectStore(IDB_STORE);
      const req = store.getAll();
      req.onsuccess = () => {
        const res = req.result;
        resolve(Array.isArray(res) ? res : []);
      };
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn('Peringatan: Gagal memuat data barang dari IndexedDB:', err);
    return [];
  }
}

export const databaseBarangService = {
  async ensureHydrated(): Promise<DatabaseBarangRecord[]> {
    if (inMemoryItems && inMemoryItems.length > 0) {
      return [...inMemoryItems];
    }
    if (isHydratingIdb) {
      return inMemoryItems ? [...inMemoryItems] : [...DEFAULT_DATABASE_BARANG];
    }
    isHydratingIdb = true;
    try {
      const idbList = await loadRecordsFromIndexedDb();
      if (idbList && idbList.length > 0) {
        inMemoryItems = idbList;
        window.dispatchEvent(new CustomEvent('akk-database-barang-updated'));
        return [...inMemoryItems];
      }

      // Jika IndexedDB masih kosong, periksa localStorage untuk migrasi awal
      const localList = this.getAll();
      if (localList && localList.length > 0) {
        await saveRecordsToIndexedDb(localList);
      }
      return localList;
    } catch {
      return this.getAll();
    } finally {
      isHydratingIdb = false;
    }
  },

  getAll(): DatabaseBarangRecord[] {
    if (inMemoryItems && inMemoryItems.length > 0) {
      return [...inMemoryItems];
    }

    try {
      const saved = localStorage.getItem(LS_KEY_DATABASE_BARANG);
      let list: DatabaseBarangRecord[] = [];
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          list = parsed.map((item, idx) => sanitizeRecord(item, idx));
        }
      }
      if (list.length === 0) {
        list = [...DEFAULT_DATABASE_BARANG];
      }

      // Sinkronkan juga dari Master SKU jika ada barang baru yang belum masuk
      const rawSku = localStorage.getItem(LS_KEY_MASTER_SKU);
      if (rawSku) {
        const skuList = JSON.parse(rawSku);
        if (Array.isArray(skuList)) {
          const mapByNo = new Map<string, DatabaseBarangRecord>();
          list.forEach(item => mapByNo.set(item.noBarang.trim().toUpperCase(), item));

          let changed = false;
          skuList.forEach((sku: any, idx: number) => {
            const code = String(sku?.noBarang || '').trim().toUpperCase();
            const desc = String(sku?.namaBarang || sku?.keterangan || '').trim();
            const unit = String(sku?.satuan || 'Pcs').trim();
            if (!code || !desc) return;
            const existing = mapByNo.get(code);
            if (!existing) {
              const p = Number(sku?.panjangCm) || 50;
              const l = Number(sku?.lebarCm) || 35;
              const t = Number(sku?.tinggiCm) || 30;
              const newItem = sanitizeRecord(
                {
                  id: sku.id || `dbb-sync-${Date.now()}-${idx}`,
                  noBarang: code,
                  deskripsiBarang: desc,
                  keteranganBarang: desc,
                  unit1: unit,
                  satuan: unit,
                  unit2: 'Ikat',
                  unit3: 'Palet',
                  rasio2: 25,
                  rasio3: 500,
                  panjangCm: p,
                  lebarCm: l,
                  tinggiCm: t,
                  volM3: calculateVolM3(p, l, t),
                  beratKg: Number(sku?.beratKg) || 0.5,
                  kategoriBarang: sku.kategoriBarang || 'Karton Box Corrugated',
                  stokTersedia: Number(sku.stokTersedia) || 0,
                  cabang: sku.cabang || 'Banyuwangi',
                  updatedAt: sku.tanggalStok || new Date().toISOString().split('T')[0]
                },
                idx
              );
              mapByNo.set(code, newItem);
              list.push(newItem);
              changed = true;
            }
          });

          if (changed) {
            try {
              if (list.length <= 400) {
                localStorage.setItem(LS_KEY_DATABASE_BARANG, JSON.stringify(list));
              }
            } catch {
              // Abaikan jika kuota localStorage penuh
            }
          }
        }
      }

      inMemoryItems = list;
      return list;
    } catch {
      return inMemoryItems || [...DEFAULT_DATABASE_BARANG];
    }
  },

  saveAll(records: DatabaseBarangRecord[]): void {
    const sanitized = records.map((r, idx) => sanitizeRecord(r, idx));
    inMemoryItems = sanitized;

    // Simpan ke IndexedDB (kapasitas tidak terbatas, cocok untuk ribuan baris)
    saveRecordsToIndexedDb(sanitized);

    // Simpan ke localStorage dengan aman tanpa menyebabkan QuotaExceededError
    try {
      if (sanitized.length <= 400) {
        localStorage.setItem(LS_KEY_DATABASE_BARANG, JSON.stringify(sanitized));
      } else {
        localStorage.setItem(LS_KEY_DATABASE_BARANG + '_idb', 'true');
        localStorage.removeItem(LS_KEY_DATABASE_BARANG);
      }
    } catch (quotaErr) {
      console.warn('LocalStorage kuota penuh, data tetap tersimpan aman di IndexedDB:', quotaErr);
      try {
        localStorage.removeItem(LS_KEY_DATABASE_BARANG);
      } catch {}
    }

    window.dispatchEvent(new CustomEvent('akk-database-barang-updated'));
  },

  getItemThumbnail(item: { noBarang?: string; deskripsiBarang?: string; unit1?: string; dokumentasiUrl?: string; dokumentasiUrls?: string[] }): string {
    if (item.dokumentasiUrls && item.dokumentasiUrls.length > 0 && item.dokumentasiUrls[0] && !item.dokumentasiUrls[0].startsWith('data:image/svg+xml')) {
      return item.dokumentasiUrls[0];
    }
    if (item.dokumentasiUrl && item.dokumentasiUrl.trim() && !item.dokumentasiUrl.startsWith('data:image/svg+xml')) {
      return item.dokumentasiUrl;
    }
    return createDefaultBarangThumbnail(item.noBarang || 'AKK-BRG', item.deskripsiBarang || 'Barang Kemasan AKK', item.unit1 || 'Pcs');
  },

  importBatch(
    records: Partial<DatabaseBarangRecord>[],
    mode: 'replace_all' | 'append' = 'replace_all'
  ): { count: number; saved: DatabaseBarangRecord[] } {
    const today = new Date().toISOString().split('T')[0];

    // Maintain EXACT row order from file, sterilkan dokumentasiUrl agar tidak menyimpan jutaan string SVG
    const sanitizedBatch: DatabaseBarangRecord[] = records.map((item, idx) => {
      const code = String(item.noBarang || '').trim().toUpperCase() || `AKK-BRG-${String(idx + 1).padStart(4, '0')}`;
      const desc = String(item.deskripsiBarang || item.keteranganBarang || 'Barang Kemasan AKK').trim();
      const u1 = String(item.unit1 || item.satuan || 'Pcs').trim();
      const u2 = item.unit2 !== undefined && item.unit2 !== null ? String(item.unit2).trim() : '';
      const u3 = item.unit3 !== undefined && item.unit3 !== null ? String(item.unit3).trim() : '';
      const r2 = item.rasio2 !== undefined && item.rasio2 !== null && item.rasio2 !== ''
        ? (!isNaN(Number(item.rasio2)) ? Number(item.rasio2) : item.rasio2)
        : 0;
      const r3 = item.rasio3 !== undefined && item.rasio3 !== null && item.rasio3 !== ''
        ? (!isNaN(Number(item.rasio3)) ? Number(item.rasio3) : item.rasio3)
        : 0;
      const p = Number(item.panjangCm) || 0;
      const l = Number(item.lebarCm) || 0;
      const t = Number(item.tinggiCm) || 0;
      let v = 0;
      if (item.volM3 !== undefined && item.volM3 !== null) {
        v = Number(item.volM3) || 0;
      } else if (p > 0 && l > 0 && t > 0) {
        v = calculateVolM3(p, l, t);
      }
      const b = item.beratKg !== undefined && item.beratKg !== null
        ? Number(item.beratKg) || 0
        : 0;

      // Ambil foto dokumentasi jika ada foto kustom asli
      const rawUrls: string[] = Array.isArray(item.dokumentasiUrls)
        ? item.dokumentasiUrls.filter((u: any) => typeof u === 'string' && u.trim() && !u.startsWith('data:image/svg+xml'))
        : [];
      const rawDoc = item.dokumentasiUrl || '';
      const docUrl = rawDoc.startsWith('data:image/svg+xml') ? '' : rawDoc;
      if (docUrl && !rawUrls.includes(docUrl)) {
        rawUrls.unshift(docUrl);
      }

      return {
        id: item.id || `dbb-${idx + 1}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        noBarang: code,
        deskripsiBarang: desc,
        keteranganBarang: desc,
        unit1: u1,
        satuan: u1,
        unit2: u2,
        unit3: u3,
        rasio2: r2,
        rasio3: r3,
        panjangCm: p,
        lebarCm: l,
        tinggiCm: t,
        volM3: v,
        beratKg: b,
        dokumentasiUrl: rawUrls[0] || docUrl || '',
        dokumentasiUrls: rawUrls,
        compressedSizeKb: item.compressedSizeKb ?? 0,
        originalSizeKb: item.originalSizeKb ?? 0,
        compressionSavingsPct: item.compressionSavingsPct ?? 0,
        kategoriBarang: item.kategoriBarang || 'Karton Box Corrugated',
        stokTersedia: item.stokTersedia !== undefined ? Number(item.stokTersedia) : 1000,
        cabang: item.cabang || 'Banyuwangi',
        updatedAt: item.updatedAt || today
      };
    });

    let finalRecords: DatabaseBarangRecord[] = [];
    if (mode === 'replace_all') {
      finalRecords = sanitizedBatch;
    } else {
      const existing = this.getAll();
      const codeMap = new Map<string, number>();
      existing.forEach((item, idx) => codeMap.set(item.noBarang.trim().toUpperCase(), idx));

      finalRecords = [...existing];
      sanitizedBatch.forEach(item => {
        const existingIdx = codeMap.get(item.noBarang.trim().toUpperCase());
        if (existingIdx !== undefined) {
          finalRecords[existingIdx] = { ...finalRecords[existingIdx], ...item };
        } else {
          finalRecords.push(item);
        }
      });
    }

    // Perbarui in-memory cache segera
    inMemoryItems = finalRecords;

    // Simpan ke IndexedDB (asinkron, kapasitas ratusan MB / GB tanpa batasan kuota 5MB)
    saveRecordsToIndexedDb(finalRecords);

    // Simpan ke localStorage secara aman tanpa crash QuotaExceededError
    try {
      if (finalRecords.length <= 400) {
        localStorage.setItem(LS_KEY_DATABASE_BARANG, JSON.stringify(finalRecords));
      } else {
        localStorage.setItem(LS_KEY_DATABASE_BARANG + '_idb', 'true');
        localStorage.removeItem(LS_KEY_DATABASE_BARANG);
      }
    } catch (quotaErr) {
      console.warn('LocalStorage kuota terlampaui, seluruh data tersimpan aman di IndexedDB:', quotaErr);
      try {
        localStorage.removeItem(LS_KEY_DATABASE_BARANG);
      } catch {}
    }

    window.dispatchEvent(new CustomEvent('akk-database-barang-updated'));
    return { count: finalRecords.length, saved: finalRecords };
  },

  findMatch(queryNoOrName: string, optionalName?: string): DatabaseBarangRecord | undefined {
    const list = this.getAll();
    const q1 = normalizeText(queryNoOrName);
    const q2 = normalizeText(optionalName || '');

    if (!q1 && !q2) return undefined;

    // 1. Exact match by noBarang or deskripsiBarang/keteranganBarang
    const exact = list.find(item => {
      const codeNorm = normalizeText(item.noBarang);
      const descNorm = normalizeText(item.deskripsiBarang || item.keteranganBarang);
      return (
        (q1 && (codeNorm === q1 || descNorm === q1)) ||
        (q2 && (codeNorm === q2 || descNorm === q2))
      );
    });
    if (exact) return exact;

    // 2. Partial match by deskripsiBarang
    return list.find(item => {
      const descNorm = normalizeText(item.deskripsiBarang || item.keteranganBarang);
      const codeNorm = normalizeText(item.noBarang);
      return (
        (q1.length >= 4 && (descNorm.includes(q1) || q1.includes(descNorm) || codeNorm.includes(q1))) ||
        (q2.length >= 4 && (descNorm.includes(q2) || q2.includes(descNorm)))
      );
    });
  },

  upsertItem(input: {
    id?: string;
    noBarang: string;
    deskripsiBarang?: string;
    keteranganBarang?: string;
    unit1?: string;
    satuan?: string;
    unit2?: string;
    unit3?: string;
    rasio2?: number | string;
    rasio3?: number | string;
    panjangCm?: number;
    lebarCm?: number;
    tinggiCm?: number;
    volM3?: number;
    beratKg?: number;
    dokumentasiUrl?: string;
    dokumentasiUrls?: string[];
    compressedSizeKb?: number;
    originalSizeKb?: number;
    compressionSavingsPct?: number;
    kategoriBarang?: string;
    stokTersedia?: number;
    cabang?: string;
  }): DatabaseBarangRecord {
    const list = this.getAll();
    const cleanCode = input.noBarang.trim().toUpperCase();
    const cleanDesc = (input.deskripsiBarang || input.keteranganBarang || '').trim();
    const cleanUnit1 = (input.unit1 || input.satuan || 'Pcs').trim();

    const idx = list.findIndex(
      item =>
        (input.id && item.id === input.id) ||
        item.noBarang.trim().toUpperCase() === cleanCode
    );

    const prev = idx >= 0 ? list[idx] : undefined;

    const p = input.panjangCm !== undefined ? Number(input.panjangCm) || 0 : (prev?.panjangCm ?? 0);
    const l = input.lebarCm !== undefined ? Number(input.lebarCm) || 0 : (prev?.lebarCm ?? 0);
    const t = input.tinggiCm !== undefined ? Number(input.tinggiCm) || 0 : (prev?.tinggiCm ?? 0);
    const v = input.volM3 !== undefined && input.volM3 !== null
      ? Number(input.volM3) || 0
      : (p > 0 && l > 0 && t > 0 ? calculateVolM3(p, l, t) : (prev?.volM3 ?? 0));
    const b = input.beratKg !== undefined && input.beratKg !== null
      ? Number(input.beratKg) || 0
      : (prev?.beratKg ?? 0);

    // Kumpulkan foto-foto dokumentasi
    let urls: string[] = [];
    if (Array.isArray(input.dokumentasiUrls) && input.dokumentasiUrls.length > 0) {
      urls = input.dokumentasiUrls.filter(u => u && !u.startsWith('data:image/svg+xml'));
    } else if (input.dokumentasiUrl && !input.dokumentasiUrl.startsWith('data:image/svg+xml')) {
      urls = [input.dokumentasiUrl];
    } else if (prev?.dokumentasiUrls && prev.dokumentasiUrls.length > 0) {
      urls = [...prev.dokumentasiUrls];
    } else if (prev?.dokumentasiUrl && !prev.dokumentasiUrl.startsWith('data:image/svg+xml')) {
      urls = [prev.dokumentasiUrl];
    }

    const docUrl = urls[0] || (input.dokumentasiUrl && !input.dokumentasiUrl.startsWith('data:image/svg+xml') ? input.dokumentasiUrl : '');
    const compKb = input.compressedSizeKb ?? (urls.length > 0 ? urls.reduce((acc, u) => acc + estimateDataUrlSizeKb(u), 0) : 0);

    const record: DatabaseBarangRecord = {
      id: input.id || (prev?.id || `dbb-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`),
      noBarang: cleanCode,
      deskripsiBarang: cleanDesc,
      keteranganBarang: cleanDesc,
      unit1: cleanUnit1,
      satuan: cleanUnit1,
      unit2: input.unit2 !== undefined ? String(input.unit2).trim() : (prev?.unit2 ?? ''),
      unit3: input.unit3 !== undefined ? String(input.unit3).trim() : (prev?.unit3 ?? ''),
      rasio2: input.rasio2 !== undefined && input.rasio2 !== ''
        ? (!isNaN(Number(input.rasio2)) ? Number(input.rasio2) : input.rasio2)
        : (prev?.rasio2 ?? 0),
      rasio3: input.rasio3 !== undefined && input.rasio3 !== ''
        ? (!isNaN(Number(input.rasio3)) ? Number(input.rasio3) : input.rasio3)
        : (prev?.rasio3 ?? 0),
      panjangCm: p,
      lebarCm: l,
      tinggiCm: t,
      volM3: v,
      beratKg: b,
      dokumentasiUrl: docUrl,
      dokumentasiUrls: urls,
      compressedSizeKb: compKb,
      originalSizeKb: input.originalSizeKb ?? (prev?.originalSizeKb ?? 380),
      compressionSavingsPct: input.compressionSavingsPct ?? (prev?.compressionSavingsPct ?? 97),
      kategoriBarang: input.kategoriBarang || (prev?.kategoriBarang ?? 'Karton Box Corrugated'),
      stokTersedia: input.stokTersedia ?? (prev?.stokTersedia ?? 1000),
      cabang: prev?.cabang || 'Banyuwangi',
      updatedAt: new Date().toISOString().split('T')[0]
    };

    if (idx >= 0) {
      list[idx] = record;
    } else {
      list.push(record);
    }

    this.saveAll(list);
    return record;
  },

  deleteItem(id: string): void {
    const list = this.getAll().filter(i => i.id !== id);
    this.saveAll(list);
  }
};
