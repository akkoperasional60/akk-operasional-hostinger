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
  // Pertahankan ukuran & ketajaman asli (HD hingga 1600px, kualitas 0.92) agar tulisan ukuran/OZ pada kardus tetap tajam dan verifikasi kamera sangat responsif
  const maxDimension = Math.max(options?.maxDimension ?? 1600, 1440);
  const initialQuality = Math.max(options?.initialQuality ?? 0.92, 0.90);

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

  const origW = img.naturalWidth || img.width || 1280;
  const origH = img.naturalHeight || img.height || 960;

  // Jika ukuran gambar sudah wajar (<= 1600px dan <= 900 KB), langsung gunakan gambar ukuran semula (tanpa kompresi yang membuat buram)
  if (Math.max(origW, origH) <= maxDimension && originalSizeKb <= 900) {
    return {
      dataUrl: sourceDataUrl,
      originalSizeKb,
      compressedSizeKb: originalSizeKb,
      savingsPercent: 0,
      width: origW,
      height: origH,
      format: sourceDataUrl.startsWith('data:image/png')
        ? 'PNG'
        : sourceDataUrl.startsWith('data:image/webp')
        ? 'WebP'
        : 'JPEG'
    };
  }

  const ratio = Math.min(1, maxDimension / Math.max(origW, origH));
  const width = Math.max(320, Math.round(origW * ratio));
  const height = Math.max(240, Math.round(origH * ratio));

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, 0, 0, width, height);
  }

  const highResUrl = canvas.toDataURL('image/jpeg', initialQuality);
  const finalSizeKb = estimateDataUrlSizeKb(highResUrl);
  const effectiveOriginalKb = Math.max(originalSizeKb, finalSizeKb);
  const savingsPercent =
    effectiveOriginalKb > finalSizeKb
      ? Math.min(99, Math.max(0, Math.round(((effectiveOriginalKb - finalSizeKb) / effectiveOriginalKb) * 100)))
      : 0;

  return {
    dataUrl: highResUrl,
    originalSizeKb: effectiveOriginalKb,
    compressedSizeKb: finalSizeKb,
    savingsPercent,
    width,
    height,
    format: 'JPEG'
  };
}

export const LEGACY_REMOVED_BARANG_CODES = new Set([
  '7MKDMR51',
  'AKK-KBX-001', 'AKK-KBX-002', 'AKK-KBX-003', 'AKK-KBX-004', 'AKK-KBX-005',
  'AKK-KBX-006', 'AKK-KBX-007', 'AKK-KBX-008', 'AKK-KBX-009', 'AKK-KBX-010',
  'AKK-PLS-014', 'AKK-PLS-019', 'AKK-PLS-022', 'AKK-PLS-030', 'AKK-PLS-034',
  'AKK-MPK-007', 'AKK-MPK-008', 'AKK-MPK-011', 'AKK-MPK-015',
  'AKK-PRD-025', 'AKK-PRD-028', 'AKK-PRD-031', 'AKK-PRD-035', 'AKK-KBX-040',
  'RFID-KB-002', 'RFID-KB-004', 'RFID-KB-005'
]);

export function isLegacySeededBarang(noBarang?: string): boolean {
  const code = String(noBarang || '').trim().toUpperCase();
  if (!code) return false;
  if (LEGACY_REMOVED_BARANG_CODES.has(code)) return true;
  if (/^(AKK-(KBX|PLS|MPK|PRD)-\d+|RFID-KB-\d+)$/i.test(code)) return true;
  return false;
}

const DEFAULT_DATABASE_BARANG: DatabaseBarangRecord[] = [];

function normalizeText(str: string): string {
  return String(str || '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

export interface DatabaseBarangRecordWithOrder extends DatabaseBarangRecord {
  orderIndex?: number;
}

function isLegacySyntheticUnitFallback(
  u2: string | undefined | null,
  u3: string | undefined | null,
  r2: number | string | undefined | null,
  r3: number | string | undefined | null
): boolean {
  return (
    String(u2 || '').trim().toLowerCase() === 'ikat' &&
    String(u3 || '').trim().toLowerCase() === 'palet' &&
    Number(r2) === 25 &&
    Number(r3) === 500
  );
}

function isLegacySyntheticDimensionFallback(p: number, l: number, t: number, v: number, b: number): boolean {
  return (
    p === 50 &&
    l === 35 &&
    t === 30 &&
    (Math.abs(v - 0.0525) < 0.0005 || v === 0) &&
    (b === 0.5 || b === 0)
  );
}

function sanitizeRecord(item: any, fallbackIndex = 0): DatabaseBarangRecord {
  const code = String(item?.noBarang || '').trim().toUpperCase() || `AKK-BRG-${String(fallbackIndex + 1).padStart(3, '0')}`;
  const desc = String(item?.deskripsiBarang || item?.keteranganBarang || 'Barang Kemasan AKK').trim();
  const u1 = String(item?.unit1 || item?.satuan || 'Pcs').trim();
  const rawU2 = item?.unit2 !== undefined && item?.unit2 !== null ? String(item.unit2).trim() : '';
  const rawU3 = item?.unit3 !== undefined && item?.unit3 !== null ? String(item.unit3).trim() : '';
  let u2 = rawU2 === '-' ? '' : rawU2;
  let u3 = rawU3 === '-' ? '' : rawU3;
  let r2: number | string =
    item?.rasio2 !== undefined && item?.rasio2 !== null && item?.rasio2 !== '' && item?.rasio2 !== '-'
      ? !isNaN(Number(item.rasio2))
        ? Number(item.rasio2)
        : item.rasio2
      : 0;
  let r3: number | string =
    item?.rasio3 !== undefined && item?.rasio3 !== null && item?.rasio3 !== '' && item?.rasio3 !== '-'
      ? !isNaN(Number(item.rasio3))
        ? Number(item.rasio3)
        : item.rasio3
      : 0;

  // Bersihkan nilai bawaan lama (Ikat / Palet / 25 / 500) yang sebelumnya memaksa kolom kosong terisi
  if (isLegacySyntheticUnitFallback(u2, u3, r2, r3)) {
    u2 = '';
    u3 = '';
    r2 = 0;
    r3 = 0;
  }

  let p = Number(item?.panjangCm) || 0;
  let l = Number(item?.lebarCm) || 0;
  let t = Number(item?.tinggiCm) || 0;
  let v = 0;
  if (item?.volM3 !== undefined && item?.volM3 !== null && item?.volM3 !== '') {
    v = Number(item.volM3) || 0;
  } else if (p > 0 && l > 0 && t > 0) {
    v = calculateVolM3(p, l, t);
  }
  let b =
    item?.beratKg !== undefined && item?.beratKg !== null && item?.beratKg !== ''
      ? Number(item.beratKg) || 0
      : 0;

  // Bersihkan dimensi bawaan lama (50 x 35 x 30 = 0.0525 M3, berat 0.5 kg) yang sebelumnya memaksa kolom 0 terisi
  if (isLegacySyntheticDimensionFallback(p, l, t, v, b)) {
    p = 0;
    l = 0;
    t = 0;
    v = 0;
    b = 0;
  }

  // Hanya simpan foto jika memang foto kustom / unggahan pengguna, jangan simpan inline SVG ribuan kali di localStorage
  let rawUrls: string[] = Array.isArray(item?.dokumentasiUrls)
    ? item.dokumentasiUrls.filter((u: any) => typeof u === 'string' && u.trim() && !u.startsWith('data:image/svg+xml'))
    : [];
  const singleDoc = item?.dokumentasiUrl && !item.dokumentasiUrl.startsWith('data:image/svg+xml')
    ? item.dokumentasiUrl
    : '';
  if (singleDoc && !rawUrls.includes(singleDoc)) {
    rawUrls.unshift(singleDoc);
  }

  // Proteksi anti-hilang foto: jika item dari localStorage kehilangan base64 karena batas 5MB, pulihkan otomatis dari preservedPhotosByCode (IndexedDB/Memory)
  if (rawUrls.length === 0 && code && preservedPhotosByCode.has(code) && !explicitlyClearedPhotoCodes.has(code)) {
    rawUrls = [...(preservedPhotosByCode.get(code) || [])];
  } else if (rawUrls.length > 0 && code && !explicitlyClearedPhotoCodes.has(code)) {
    const existingPreserved = preservedPhotosByCode.get(code) || [];
    const hasExplicitReplace = explicitPhotoReplaceTimestampByCode.has(code);
    const mergedPreserved = hasExplicitReplace
      ? rawUrls
      : Array.from(new Set([...rawUrls, ...existingPreserved]));
    rawUrls = mergedPreserved;
    preservedPhotosByCode.set(code, mergedPreserved);
  }

  const primaryDoc = rawUrls[0] || '';

  const rec: DatabaseBarangRecordWithOrder = {
    id: item?.id || `dbb-${ String(fallbackIndex + 1).padStart(6, '0') }-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    orderIndex: typeof item?.orderIndex === 'number' ? item.orderIndex : fallbackIndex,
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
  return rec;
}

const IDB_NAME = 'AKK_WMS_DATABASE_V1';
const IDB_STORE = 'database_barang';
const IDB_VERSION = 1;

const LS_KEY_CLEARED_PHOTO_CODES = 'akk_db_barang_cleared_photo_codes_v2';
const LS_KEY_DELETED_PHOTO_URLS = 'akk_db_barang_deleted_photo_urls_v2';
const LS_KEY_EXPLICIT_PHOTO_OVERRIDES = 'akk_db_barang_photo_overrides_v2';

function loadPersistentSet(key: string): Set<string> {
  if (typeof window === 'undefined') return new Set();
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return new Set();
    const arr = JSON.parse(raw);
    return new Set(Array.isArray(arr) ? arr : []);
  } catch {
    return new Set();
  }
}

function savePersistentSet(key: string, set: Set<string>): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(key, JSON.stringify(Array.from(set)));
  } catch {}
}

function loadPersistentMap(key: string): Map<string, string[]> {
  if (typeof window === 'undefined') return new Map();
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return new Map();
    const obj = JSON.parse(raw);
    return new Map(Object.entries(obj || {}));
  } catch {
    return new Map();
  }
}

function savePersistentMap(key: string, map: Map<string, string[]>): void {
  if (typeof window === 'undefined') return;
  try {
    const obj: Record<string, string[]> = {};
    map.forEach((val, k) => { obj[k] = val; });
    localStorage.setItem(key, JSON.stringify(obj));
  } catch {}
}

const preservedPhotosByCode = new Map<string, string[]>();
const explicitPhotoReplaceTimestampByCode = new Map<string, number>();
const explicitlyClearedPhotoCodes = loadPersistentSet(LS_KEY_CLEARED_PHOTO_CODES);
const deletedPhotoUrls = loadPersistentSet(LS_KEY_DELETED_PHOTO_URLS);
const photoOverridesByCode = loadPersistentMap(LS_KEY_EXPLICIT_PHOTO_OVERRIDES);

let inMemoryItems: DatabaseBarangRecord[] | null = null;
let hasHydratedFromIdb = false;
let hydrationPromise: Promise<DatabaseBarangRecord[]> | null = null;

export interface DatabaseBarangSyncStatus {
  isSyncing: boolean;
  progressPct: number;
  lastSyncedAt: string | null;
  serverCount: number;
  error: string | null;
}

let syncStatusState: DatabaseBarangSyncStatus = {
  isSyncing: false,
  progressPct: 0,
  lastSyncedAt: null,
  serverCount: 0,
  error: null
};

function updateSyncStatus(partial: Partial<DatabaseBarangSyncStatus>): void {
  syncStatusState = { ...syncStatusState, ...partial };
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('akk-database-barang-sync-status', { detail: syncStatusState }));
  }
}

function getAuthHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json'
  };
  if (typeof window !== 'undefined') {
    try {
      const token = localStorage.getItem('akk_session_token') || sessionStorage.getItem('akk_session_token');
      if (token) {
        headers['x-akk-session-token'] = token;
      }
    } catch {}
  }
  return headers;
}

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
      records.forEach((r, idx) => {
        const cleanPhotos = extractCleanPhotos(r);
        const finalRec: DatabaseBarangRecord & { orderIndex: number } = {
          ...r,
          dokumentasiUrls: cleanPhotos,
          dokumentasiUrl: cleanPhotos[0] || '',
          orderIndex: idx
        };
        store.put(finalRec);
      });
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
        const res = Array.isArray(req.result) ? req.result : [];
        res.forEach((r: any) => {
          const code = String(r?.noBarang || '').trim().toUpperCase();
          if (!code || explicitlyClearedPhotoCodes.has(code)) return;
          const urls = extractCleanPhotos(r);
          if (urls.length > 0) {
            const prev = preservedPhotosByCode.get(code) || [];
            preservedPhotosByCode.set(code, Array.from(new Set([...urls, ...prev])));
          }
        });
        res.sort((a: any, b: any) => {
          const oa = typeof a?.orderIndex === 'number' ? a.orderIndex : 999999;
          const ob = typeof b?.orderIndex === 'number' ? b.orderIndex : 999999;
          if (oa !== ob) return oa - ob;
          return String(a?.id || '').localeCompare(String(b?.id || ''), undefined, { numeric: true });
        });
        resolve(res);
      };
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn('Peringatan: Gagal memuat data barang dari IndexedDB:', err);
    return [];
  }
}

function writeSafeLocalStorageCache(records: DatabaseBarangRecord[]): void {
  if (typeof window === 'undefined') return;
  try {
    // Selalu hapus data lama terlebih dahulu agar tidak pernah tersisa data usang saat kuota penuh
    localStorage.removeItem(LS_KEY_DATABASE_BARANG);
  } catch {}

  const buildLightweightList = (maxPhotoItems: number) => {
    let preservedPhotoCount = 0;
    return records.map((r, idx) => {
      const hasPhoto =
        Boolean(r.dokumentasiUrl && !r.dokumentasiUrl.startsWith('data:image/svg+xml')) ||
        Boolean(r.dokumentasiUrls && r.dokumentasiUrls.length > 0);
      const keepPhoto = hasPhoto && preservedPhotoCount < maxPhotoItems;
      if (keepPhoto) preservedPhotoCount++;
      return {
        id: r.id,
        orderIndex: idx,
        noBarang: r.noBarang,
        deskripsiBarang: r.deskripsiBarang,
        keteranganBarang: r.keteranganBarang,
        unit1: r.unit1,
        satuan: r.satuan,
        unit2: r.unit2 || '',
        unit3: r.unit3 || '',
        rasio2: r.rasio2 || 0,
        rasio3: r.rasio3 || 0,
        panjangCm: r.panjangCm || 0,
        lebarCm: r.lebarCm || 0,
        tinggiCm: r.tinggiCm || 0,
        volM3: r.volM3 || 0,
        beratKg: r.beratKg || 0,
        dokumentasiUrl: keepPhoto ? r.dokumentasiUrl || '' : '',
        dokumentasiUrls: keepPhoto ? (r.dokumentasiUrls || []).slice(0, 3) : [],
        kategoriBarang: r.kategoriBarang,
        stokTersedia: r.stokTersedia,
        cabang: r.cabang,
        updatedAt: r.updatedAt
      };
    });
  };

  try {
    if (records.length === 0) {
      localStorage.removeItem(LS_KEY_DATABASE_BARANG + '_idb');
      return;
    }
    if (records.length <= 350) {
      localStorage.setItem(LS_KEY_DATABASE_BARANG, JSON.stringify(records));
      localStorage.removeItem(LS_KEY_DATABASE_BARANG + '_idb');
    } else {
      const lightweight = buildLightweightList(15);
      localStorage.setItem(LS_KEY_DATABASE_BARANG, JSON.stringify(lightweight));
      localStorage.setItem(LS_KEY_DATABASE_BARANG + '_idb', 'true');
    }
  } catch {
    try {
      // Jika 69+ foto resolusi penuh melebihi kuota 5MB localStorage, simpan daftar barang tanpa base64 di localStorage (sedangkan 100% foto tersimpan utuh di IndexedDB & Memory)
      const metadataOnly = buildLightweightList(0);
      localStorage.setItem(LS_KEY_DATABASE_BARANG, JSON.stringify(metadataOnly));
      localStorage.setItem(LS_KEY_DATABASE_BARANG + '_idb', 'true');
    } catch {
      try {
        localStorage.removeItem(LS_KEY_DATABASE_BARANG);
        localStorage.setItem(LS_KEY_DATABASE_BARANG + '_idb', 'true');
      } catch {}
    }
  }
}

function extractCleanPhotos(item?: Partial<DatabaseBarangRecord> | null): string[] {
  if (!item) return [];
  const code = String(item.noBarang || '').trim().toUpperCase();
  if (code && explicitlyClearedPhotoCodes.has(code)) {
    return [];
  }
  if (code && photoOverridesByCode.has(code)) {
    const overridden = photoOverridesByCode.get(code) || [];
    return overridden.filter(u => typeof u === 'string' && u.trim() && !u.startsWith('data:image/svg+xml') && !deletedPhotoUrls.has(u));
  }
  const list = Array.isArray(item.dokumentasiUrls)
    ? item.dokumentasiUrls.filter((u): u is string => typeof u === 'string' && u.trim() !== '' && !u.startsWith('data:image/svg+xml') && !deletedPhotoUrls.has(u))
    : [];
  const single = typeof item.dokumentasiUrl === 'string' ? item.dokumentasiUrl.trim() : '';
  if (single && !single.startsWith('data:image/svg+xml') && !deletedPhotoUrls.has(single) && !list.includes(single)) {
    list.unshift(single);
  }
  return list;
}

function mergeLocalAndRemoteRecords(
  localRecords: DatabaseBarangRecord[],
  remoteRecords: DatabaseBarangRecord[]
): {
  merged: DatabaseBarangRecord[];
  shouldPushToServer: boolean;
  shouldSaveLocally: boolean;
  itemsWithLocalPhotosToPush: Array<{ record: DatabaseBarangRecord; idx: number }>;
} {
  if (localRecords.length === 0 && remoteRecords.length === 0) {
    return { merged: [], shouldPushToServer: false, shouldSaveLocally: false, itemsWithLocalPhotosToPush: [] };
  }
  // Jika HP/browser baru belum punya data lokal tapi server sudah punya data -> tarik dari server ke HP
  if (localRecords.length === 0 && remoteRecords.length > 0) {
    return { merged: remoteRecords, shouldPushToServer: false, shouldSaveLocally: true, itemsWithLocalPhotosToPush: [] };
  }
  // Jika PC/HP sudah punya data lokal tapi server masih kosong -> dorong ke server
  if (localRecords.length > 0 && remoteRecords.length === 0) {
    const withPhotos = localRecords
      .map((record, idx) => ({ record, idx }))
      .filter(entry => extractCleanPhotos(entry.record).length > 0);
    return {
      merged: localRecords,
      shouldPushToServer: true,
      shouldSaveLocally: false,
      itemsWithLocalPhotosToPush: withPhotos
    };
  }

  // Jika keduanya ada data, pilih sumber yang lebih lengkap sebagai basis dan gabungkan seluruh SKU & foto dokumentasi dari kedua sisi
  const useLocalAsPrimary = localRecords.length >= remoteRecords.length;
  const primary = useLocalAsPrimary ? localRecords : remoteRecords;
  const secondary = useLocalAsPrimary ? remoteRecords : localRecords;

  const localByCode = new Map<string, DatabaseBarangRecord>();
  localRecords.forEach(item => {
    localByCode.set(item.noBarang.trim().toUpperCase(), item);
  });

  const remoteByCode = new Map<string, DatabaseBarangRecord>();
  remoteRecords.forEach(item => {
    remoteByCode.set(item.noBarang.trim().toUpperCase(), item);
  });

  const secondaryByCode = useLocalAsPrimary ? remoteByCode : localByCode;

  const primaryCodes = new Set<string>();
  let shouldPush = localRecords.length > remoteRecords.length;
  let shouldSaveLocal = remoteRecords.length > localRecords.length;
  const itemsWithLocalPhotosToPush: Array<{ record: DatabaseBarangRecord; idx: number }> = [];

  const merged = primary.map((item, idx) => {
    const code = item.noBarang.trim().toUpperCase();
    primaryCodes.add(code);
    const sec = secondaryByCode.get(code);
    const localItem = localByCode.get(code);
    const remoteItem = remoteByCode.get(code);

    const localPhotos = extractCleanPhotos(localItem);
    const remotePhotos = extractCleanPhotos(remoteItem);
    const isCleared = explicitlyClearedPhotoCodes.has(code);
    const hasExplicitReplace = explicitPhotoReplaceTimestampByCode.has(code);

    let combinedPhotos: string[] = [];
    if (isCleared) {
      combinedPhotos = [];
    } else if (hasExplicitReplace || photoOverridesByCode.has(code)) {
      combinedPhotos = localPhotos;
    } else if (localItem && localPhotos.length === 0) {
      // Jika lokal sudah ada dan fotonya kosong / dihapus, JANGAN hidupkan kembali dari remote
      combinedPhotos = [];
    } else if (localPhotos.length > 0) {
      combinedPhotos = localPhotos;
    } else {
      combinedPhotos = remotePhotos;
    }

    if (combinedPhotos.length > 0 && !explicitlyClearedPhotoCodes.has(code)) {
      preservedPhotosByCode.set(code, combinedPhotos);
    }

    if (combinedPhotos.length > localPhotos.length) {
      shouldSaveLocal = true;
    }

    if (!sec) {
      const sanitizedSingle = sanitizeRecord(
        {
          ...item,
          dokumentasiUrls: combinedPhotos,
          dokumentasiUrl: combinedPhotos[0] || ''
        },
        idx
      );
      if (combinedPhotos.length > remotePhotos.length) {
        shouldPush = true;
        itemsWithLocalPhotosToPush.push({ record: sanitizedSingle, idx });
      }
      return sanitizedSingle;
    }

    // Jika salah satu sisi memiliki dimensi/berat yang sudah diisi sedangkan sisi lain masih 0, pertahankan yang sudah terisi
    const hasPrimaryDim = (item.panjangCm || 0) > 0 || (item.volM3 || 0) > 0;
    const hasSecDim = (sec.panjangCm || 0) > 0 || (sec.volM3 || 0) > 0;

    const mergedRecord = sanitizeRecord(
      {
        ...item,
        deskripsiBarang: sec.deskripsiBarang || item.deskripsiBarang,
        keteranganBarang: sec.keteranganBarang || item.keteranganBarang,
        panjangCm: hasPrimaryDim ? item.panjangCm : (hasSecDim ? sec.panjangCm : item.panjangCm),
        lebarCm: hasPrimaryDim ? item.lebarCm : (hasSecDim ? sec.lebarCm : item.lebarCm),
        tinggiCm: hasPrimaryDim ? item.tinggiCm : (hasSecDim ? sec.tinggiCm : item.tinggiCm),
        volM3: hasPrimaryDim ? item.volM3 : (hasSecDim ? sec.volM3 : item.volM3),
        beratKg: (item.beratKg || 0) > 0 ? item.beratKg : ((sec.beratKg || 0) > 0 ? sec.beratKg : item.beratKg),
        dokumentasiUrls: combinedPhotos,
        dokumentasiUrl: combinedPhotos[0] || ''
      },
      idx
    );

    if (combinedPhotos.length > remotePhotos.length) {
      shouldPush = true;
      itemsWithLocalPhotosToPush.push({ record: mergedRecord, idx });
    }

    return mergedRecord;
  });

  // Tambahkan item dari secondary yang belum ada di primary agar item baru dari PC/Server tidak pernah hilang
  for (const secItem of secondary) {
    const code = secItem.noBarang.trim().toUpperCase();
    if (code && !primaryCodes.has(code)) {
      primaryCodes.add(code);
      const nextIdx = merged.length;
      const sanitizedExtra = sanitizeRecord(secItem, nextIdx);
      merged.push(sanitizedExtra);
      if (useLocalAsPrimary) {
        shouldSaveLocal = true;
      } else {
        shouldPush = true;
        if (extractCleanPhotos(sanitizedExtra).length > 0) {
          itemsWithLocalPhotosToPush.push({ record: sanitizedExtra, idx: nextIdx });
        }
      }
    }
  }

  return {
    merged,
    shouldPushToServer: shouldPush,
    shouldSaveLocally: shouldSaveLocal,
    itemsWithLocalPhotosToPush
  };
}

// Satu foto per request agar data lama dari IndexedDB tidak terkena HTTP 413.
// Foto lokal tidak dikurangi/ditimpa saat dibuat versi lebih ringan untuk jaringan.
async function photoForServer(original: string, maxEdge: number, quality: number): Promise<string> {
  if (typeof window === 'undefined' || !original.startsWith('data:image/')) return original;
  try {
    const img = new Image();
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error('Foto tidak bisa dibaca'));
      img.src = original;
    });
    const w = img.naturalWidth || img.width;
    const h = img.naturalHeight || img.height;
    if (!w || !h) return original;
    const scale = Math.min(1, maxEdge / Math.max(w, h));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(w * scale));
    canvas.height = Math.max(1, Math.round(h * scale));
    const ctx = canvas.getContext('2d');
    if (!ctx) return original;
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    const compressed = canvas.toDataURL('image/jpeg', quality);
    return compressed.length < original.length ? compressed : original;
  } catch {
    return original;
  }
}

// Serialisasi upload supaya sinkronisasi otomatis dan pemulihan manual tidak saling menimpa.
let photoUploadChain: Promise<void> = Promise.resolve();
const pendingItemUploads = new Map<string, Promise<boolean>>();

export interface DatabaseBarangPhotoRecoveryResult {
  localPhotoSkuCount: number;
  attemptedSkuCount: number;
  succeededSkuCount: number;
  failedSkuCount: number;
  beforePhotoSkuCount: number;
  afterPhotoSkuCount: number;
  failedCodes: string[];
}

export const databaseBarangService = {
  getSyncStatus(): DatabaseBarangSyncStatus {
    return { ...syncStatusState };
  },

  async fetchFromServer(): Promise<DatabaseBarangRecord[] | null> {
    if (typeof window === 'undefined') return null;
    try {
      const res = await fetch('/api/database-barang', {
        method: 'GET',
        credentials: 'include',
        headers: getAuthHeaders(),
        cache: 'no-store'
      });
      if (!res.ok) return null;
      const data = await res.json();
      if (!data || !Array.isArray(data.items)) return null;
      const cleaned = data.items
        .filter((item: any) => !isLegacySeededBarang(item?.noBarang))
        .map((item: any, idx: number) => sanitizeRecord(item, idx));
      updateSyncStatus({
        serverCount: cleaned.length,
        lastSyncedAt: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
        error: null
      });
      return cleaned;
    } catch (err: any) {
      console.warn('Peringatan: Gagal mengambil Database Barang dari server:', err?.message || err);
      return null;
    }
  },

  async syncAllToServer(
    records: DatabaseBarangRecord[],
    mode: 'replace_all' | 'append' = 'replace_all'
  ): Promise<boolean> {
    if (typeof window === 'undefined') return false;
    try {
      updateSyncStatus({ isSyncing: true, progressPct: 5, error: null });
      const CHUNK_SIZE = 250;
      const total = records.length;

      if (total === 0) {
        const res = await fetch('/api/database-barang/sync', {
          method: 'POST',
          credentials: 'include',
          headers: getAuthHeaders(),
          body: JSON.stringify({ items: [], mode: 'replace_all', chunkIndex: 0, chunkOffset: 0 })
        });
        updateSyncStatus({
          isSyncing: false,
          progressPct: 100,
          serverCount: 0,
          lastSyncedAt: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
        });
        return res.ok;
      }

      const itemsWithPhotos: Array<{ record: DatabaseBarangRecord; idx: number }> = [];
      const totalChunks = Math.ceil(total / CHUNK_SIZE);
      for (let chunkIdx = 0; chunkIdx < totalChunks; chunkIdx++) {
        const offset = chunkIdx * CHUNK_SIZE;
        // Kirim metadata tanpa beban base64 raksasa pada bulk chunk agar tidak pernah terkena batas 413 Payload Too Large di Nginx Hostinger;
        // Server secara otomatis mempertahankan foto yang sudah ada, lalu kita kirim foto via pushPhotosBatchToServer secara micro-batch!
        const slice = records.slice(offset, offset + CHUNK_SIZE).map((r, i) => {
          const globalIdx = offset + i;
          const cleanPhotos = extractCleanPhotos(r);
          if (cleanPhotos.length > 0) {
            itemsWithPhotos.push({ record: r, idx: globalIdx });
          }
          return {
            ...r,
            dokumentasiUrl: '',
            dokumentasiUrls: [],
            orderIndex: globalIdx
          };
        });
        const res = await fetch('/api/database-barang/sync', {
          method: 'POST',
          credentials: 'include',
          headers: getAuthHeaders(),
          body: JSON.stringify({
            items: slice,
            mode: chunkIdx === 0 ? mode : 'append',
            chunkIndex: chunkIdx,
            chunkOffset: offset,
            totalChunks
          })
        });
        if (!res.ok) {
          const errPayload = await res.json().catch(() => ({}));
          throw new Error(errPayload?.error || `HTTP ${res.status}`);
        }
        const pct = Math.min(85, Math.round(((chunkIdx + 1) / totalChunks) * 85));
        updateSyncStatus({ isSyncing: true, progressPct: pct });
      }

      if (itemsWithPhotos.length > 0) {
        await this.pushPhotosBatchToServer(itemsWithPhotos);
      }

      updateSyncStatus({
        isSyncing: false,
        progressPct: 100,
        serverCount: total,
        lastSyncedAt: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
        error: null
      });
      return true;
    } catch (err: any) {
      console.warn('Peringatan: Gagal sinkronisasi Database Barang ke server:', err?.message || err);
      updateSyncStatus({
        isSyncing: false,
        progressPct: 0,
        error: err?.message || 'Gagal sinkronisasi ke server'
      });
      return false;
    }
  },

  async pushItemToServer(
    record: DatabaseBarangRecord,
    orderIndex?: number,
    replacePhotos = false
  ): Promise<boolean> {
    if (typeof window === 'undefined') return false;
    try {
      const res = await fetch('/api/database-barang/item', {
        method: 'POST',
        credentials: 'include',
        headers: getAuthHeaders(),
        body: JSON.stringify({ item: { ...record, orderIndex }, replacePhotos })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) {
        throw new Error(data.error || `HTTP ${res.status}: gagal simpan ke MySQL`);
      }
      if (res.ok) {
        updateSyncStatus({
          lastSyncedAt: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
        });
      }
      return res.ok;
    } catch (err: any) {
      updateSyncStatus({ error: `Gagal simpan barang/foto ke MySQL: ${err?.message || err}` });
      console.warn('Gagal sinkron item ke server:', err);
      return false;
    }
  },

  async waitForItemUpload(code: string): Promise<boolean> {
    const job = pendingItemUploads.get(String(code || '').trim().toUpperCase());
    return job ? await job : false;
  },

  async pushPhotosBatchToServer(
    entries: Array<{ record: DatabaseBarangRecord; idx: number }>
  ): Promise<void> {
    if (typeof window === 'undefined' || entries.length === 0) return;
    const upload = async (): Promise<void> => {
      // 1. Coba kirimkan seluruh micro-batch sekaligus (jauh lebih cepat: 1 round trip untuk beberapa item)
      const validItemsPayload = entries
        .map(entry => {
          const cleanPhotos = extractCleanPhotos(entry.record);
          if (cleanPhotos.length === 0) return null;
          return {
            ...entry.record,
            orderIndex: entry.idx,
            dokumentasiUrl: cleanPhotos[0],
            dokumentasiUrls: cleanPhotos
          };
        })
        .filter(Boolean);

      if (validItemsPayload.length === 0) return;

      try {
        const res = await fetch('/api/database-barang/photos-sync', {
          method: 'POST',
          credentials: 'include',
          headers: getAuthHeaders(),
          body: JSON.stringify({ photoItems: validItemsPayload })
        });
        const data = await res.json().catch(() => ({}));
        if (res.ok && data.success && Number(data.updatedCount) > 0) {
          return;
        }
      } catch (err: any) {
        console.warn('Micro-batch photo sync retry item-by-item:', err?.message || err);
      }

      // 2. Fallback kirim per-item jika micro-batch ukuran payload terlalu besar
      for (const entry of entries) {
        const photos = extractCleanPhotos(entry.record);
        for (const originalPhoto of photos) {
          let photo = originalPhoto;
          let lastError = 'Gagal upload foto';
          let saved = false;
          for (let attempt = 0; attempt < 2; attempt++) {
            try {
              const res = await fetch('/api/database-barang/photos-sync', {
                method: 'POST',
                credentials: 'include',
                headers: getAuthHeaders(),
                body: JSON.stringify({
                  photoItems: [{
                    ...entry.record,
                    orderIndex: entry.idx,
                    dokumentasiUrl: photo,
                    dokumentasiUrls: [photo]
                  }]
                })
              });
              const data = await res.json().catch(() => ({}));
              if (res.ok && data.success && Number(data.updatedCount) > 0) {
                saved = true;
                break;
              }
              lastError = data.error || `HTTP ${res.status}`;
              if (res.status === 401 || res.status === 403 || res.status === 404) {
                const fallbackOk = await this.pushItemToServer(
                  {
                    ...entry.record,
                    dokumentasiUrl: photo,
                    dokumentasiUrls: photos
                  },
                  entry.idx,
                  false
                );
                if (fallbackOk) {
                  saved = true;
                  break;
                }
              }
              if (res.status === 413 || /packet.*large|too.*large|payload.*large/i.test(lastError)) {
                photo = await photoForServer(originalPhoto, attempt === 0 ? 1100 : 850, attempt === 0 ? 0.75 : 0.65);
              }
            } catch (err: any) {
              lastError = err?.message || 'Jaringan gagal';
            }
          }
          if (!saved) {
            console.warn('[Database Barang Photos] Warning fallback item:', entry.record.noBarang, lastError);
          }
        }
      }
    };
    const job = photoUploadChain.then(upload, upload);
    photoUploadChain = job.catch(() => {});
    return job;
  },

  // Jalankan pada perangkat/browser ASAL tempat foto lama masih tersimpan di IndexedDB.
  // Hanya mengambil foto dari data aktif saat ini dan membersihkan foto lama yang telah dihapus di MySQL!
  async recoverLocalPhotosToMysql(): Promise<DatabaseBarangPhotoRecoveryResult> {
    if (typeof window === 'undefined') throw new Error('Hanya tersedia di browser.');
    updateSyncStatus({ isSyncing: true, progressPct: 5, error: null });
    try {
      const activeRecords = this.getAll();
      const byCode = new Map<string, { record: DatabaseBarangRecord; idx: number; photos: string[] }>();
      activeRecords.forEach((record, idx) => {
        const code = String(record.noBarang || '').trim().toUpperCase();
        if (!code || explicitlyClearedPhotoCodes.has(code)) return;
        const cleanPhotos = extractCleanPhotos(record);
        if (cleanPhotos.length > 0) {
          byCode.set(code, { record, idx, photos: cleanPhotos });
        }
      });
      const localPhotoSkuCount = byCode.size;

      // Bersihkan secara otomatis seluruh foto di MySQL yang sudah tidak ada / telah dihapus pada data aktif browser ini
      try {
        await fetch('/api/database-barang/photos/bulk-delete', {
          method: 'POST',
          credentials: 'include',
          headers: getAuthHeaders(),
          body: JSON.stringify({ keepCodes: Array.from(byCode.keys()) })
        });
      } catch (err: any) {
        console.warn('Gagal sinkronisasi bulk-delete foto ke MySQL:', err);
      }

      // Pastikan IndexedDB dan localStorage juga tersimpan bersih tanpa foto lama
      await saveRecordsToIndexedDb(activeRecords);
      writeSafeLocalStorageCache(activeRecords);

      const readSummary = async (): Promise<number> => {
        try {
          const res = await fetch('/api/database-barang/photos-summary', {
            credentials: 'include', headers: getAuthHeaders(), cache: 'no-store'
          });
          const data = await res.json().catch(() => ({}));
          return Number(data.photoSkuCount) || 0;
        } catch {
          return 0;
        }
      };
      const beforePhotoSkuCount = await readSummary();
      let succeededSkuCount = 0;
      let failedSkuCount = 0;
      const failedCodes: string[] = [];
      let processed = 0;

      // Kelompokkan dalam batch 8 item agar proses sangat cepat dan tidak lambat
      const allEntries = Array.from(byCode.values()).map(item => ({
        record: {
          ...item.record,
          dokumentasiUrl: item.photos[0],
          dokumentasiUrls: item.photos
        },
        idx: item.idx
      }));

      const BATCH_SIZE = 8;
      const batches: Array<typeof allEntries> = [];
      for (let i = 0; i < allEntries.length; i += BATCH_SIZE) {
        batches.push(allEntries.slice(i, i + BATCH_SIZE));
      }

      const CONCURRENCY = 3;
      let currentBatchIdx = 0;
      const worker = async () => {
        while (currentBatchIdx < batches.length) {
          const batchIndex = currentBatchIdx++;
          const currentBatch = batches[batchIndex];
          if (!currentBatch) break;
          try {
            await this.pushPhotosBatchToServer(currentBatch);
            succeededSkuCount += currentBatch.length;
          } catch (err: any) {
            failedSkuCount += currentBatch.length;
            currentBatch.forEach(c => failedCodes.push(c.record.noBarang));
          }
          processed += currentBatch.length;
          updateSyncStatus({ progressPct: Math.min(95, Math.round((processed / Math.max(1, localPhotoSkuCount)) * 95)) });
        }
      };

      if (batches.length > 0) {
        const workerPromises = Array.from({ length: Math.min(CONCURRENCY, batches.length) }, () => worker());
        await Promise.all(workerPromises);
      }

      const afterPhotoSkuCount = await readSummary();
      updateSyncStatus({
        progressPct: 100,
        lastSyncedAt: new Date().toLocaleTimeString('id-ID'),
        error: failedSkuCount ? `${failedSkuCount} SKU foto gagal dikirim; data lokal tetap disimpan.` : null
      });
      return {
        localPhotoSkuCount,
        attemptedSkuCount: processed,
        succeededSkuCount,
        failedSkuCount,
        beforePhotoSkuCount,
        afterPhotoSkuCount,
        failedCodes
      };
    } catch (err: any) {
      updateSyncStatus({ error: err?.message || 'Gagal memulihkan foto lokal' });
      throw err;
    } finally {
      updateSyncStatus({ isSyncing: false });
    }
  },

  async deleteItemFromServer(id: string): Promise<void> {
    if (typeof window === 'undefined') return;
    try {
      await fetch(`/api/database-barang/${encodeURIComponent(id)}`, {
        method: 'DELETE',
        credentials: 'include',
        headers: getAuthHeaders()
      });
    } catch (err) {
      console.warn('Gagal hapus item di server:', err);
    }
  },

  // Sinkronisasi Real-Time Dua Arah untuk Foto Dokumentasi & Spesifikasi Item antar Device (HP <-> PC)
  async syncRealtimePhotosFromServer(): Promise<boolean> {
    if (typeof window === 'undefined') return false;
    try {
      // 1. Pastikan IndexedDB sudah dimuat terlebih dahulu! Di HP, 69+ foto dokumentasi disimpan di IndexedDB karena melebihi kuota 5MB localStorage
      const idbRecords = await loadRecordsFromIndexedDb();
      let currentLocal = this.getAll();
      if (idbRecords && idbRecords.length > 0) {
        if (currentLocal.length === 0) {
          currentLocal = idbRecords.map((it, idx) => sanitizeRecord(it, idx));
          inMemoryItems = currentLocal;
        } else {
          const idbByCode = new Map<string, DatabaseBarangRecord>();
          idbRecords.forEach(r => {
            if (r?.noBarang) idbByCode.set(String(r.noBarang).trim().toUpperCase(), r);
          });
          let mergedWithIdb = false;
          currentLocal = currentLocal.map((item, idx) => {
            const code = item.noBarang.trim().toUpperCase();
            if (explicitlyClearedPhotoCodes.has(code)) return item;
            const memPhotos = extractCleanPhotos(item);
            // Jika foto pada memori lokal sudah kosong / telah dihapus, JANGAN PERNAH ambil foto usang dari IndexedDB
            if (memPhotos.length === 0) {
              return item;
            }
            if (memPhotos.length > 0) {
              preservedPhotosByCode.set(code, memPhotos);
            }
            return item;
          });
        }
      }

      const res = await fetch('/api/database-barang/photos-sync', {
        method: 'GET',
        credentials: 'include',
        headers: getAuthHeaders(),
        cache: 'no-store'
      });
      if (!res.ok) return false;
      const data = await res.json();
      if (!data || !data.success || !Array.isArray(data.photoItems)) return false;

      const localList = currentLocal;
      // Jika device ini masih kosong sedangkan server sudah memiliki ribuan barang, tarik penuh dari server
      if (localList.length === 0 && Number(data.totalCount) > 0) {
        hasHydratedFromIdb = false;
        await this.ensureHydrated();
        return true;
      }

      const remotePhotoByCode = new Map<string, DatabaseBarangRecord>();
      for (const rawItem of data.photoItems) {
        const code = String(rawItem?.noBarang || '').trim().toUpperCase();
        if (!code) continue;
        const cleanUrls = extractCleanPhotos(rawItem);
        const clean: DatabaseBarangRecord = {
          ...sanitizeRecord(rawItem, rawItem.orderIndex ?? 0),
          dokumentasiUrls: cleanUrls,
          dokumentasiUrl: cleanUrls[0] || ''
        };
        remotePhotoByCode.set(code, clean);
      }

      let localChanged = false;
      const localItemsToPushToServer: Array<{ record: DatabaseBarangRecord; idx: number }> = [];

      const updatedLocal = localList.map((item, idx) => {
        const code = item.noBarang.trim().toUpperCase();
        const localUrls = extractCleanPhotos(item);
        const remoteMatch = remotePhotoByCode.get(code);
        const remoteUrls = extractCleanPhotos(remoteMatch);
        const hasExplicitLocalReplace = explicitPhotoReplaceTimestampByCode.has(code);

        // Sinkronisasi spesifikasi dimensi/satuan dua arah jika salah satu device mengupdate spesifikasi
        const nextDesc = remoteMatch?.deskripsiBarang && remoteMatch.deskripsiBarang !== 'Barang Kemasan AKK'
          ? remoteMatch.deskripsiBarang
          : item.deskripsiBarang;
        const nextUnit1 = remoteMatch?.unit1 || item.unit1;
        const nextUnit2 = remoteMatch?.unit2 !== undefined && remoteMatch.unit2 !== '' ? remoteMatch.unit2 : item.unit2;
        const nextRasio2 = remoteMatch?.rasio2 !== undefined && Number(remoteMatch.rasio2) > 0 ? remoteMatch.rasio2 : item.rasio2;
        const nextP = (remoteMatch?.panjangCm || 0) > 0 ? remoteMatch!.panjangCm : item.panjangCm;
        const nextL = (remoteMatch?.lebarCm || 0) > 0 ? remoteMatch!.lebarCm : item.lebarCm;
        const nextT = (remoteMatch?.tinggiCm || 0) > 0 ? remoteMatch!.tinggiCm : item.tinggiCm;
        const nextVol = (remoteMatch?.volM3 || 0) > 0 ? remoteMatch!.volM3 : item.volM3;
        const nextBerat = (remoteMatch?.beratKg || 0) > 0 ? remoteMatch!.beratKg : item.beratKg;

        const metaDiff =
          nextDesc !== item.deskripsiBarang ||
          nextUnit1 !== item.unit1 ||
          nextUnit2 !== item.unit2 ||
          nextRasio2 !== item.rasio2 ||
          nextP !== item.panjangCm ||
          nextL !== item.lebarCm ||
          nextT !== item.tinggiCm ||
          nextVol !== item.volM3 ||
          nextBerat !== item.beratKg;

        if (localUrls.length === 0 && remoteUrls.length === 0) {
          if (metaDiff) {
            localChanged = true;
            return {
              ...item,
              deskripsiBarang: nextDesc,
              keteranganBarang: nextDesc,
              unit1: nextUnit1,
              satuan: nextUnit1,
              unit2: nextUnit2,
              rasio2: nextRasio2,
              panjangCm: nextP,
              lebarCm: nextL,
              tinggiCm: nextT,
              volM3: nextVol,
              beratKg: nextBerat
            };
          }
          return item;
        }

        const isCleared = explicitlyClearedPhotoCodes.has(code);
        let mergedUrls: string[] = [];
        if (isCleared) {
          mergedUrls = [];
        } else if (hasExplicitLocalReplace || photoOverridesByCode.has(code)) {
          mergedUrls = localUrls;
        } else if (localUrls.length === 0) {
          // Jika lokal kosong / foto telah dihapus, JANGAN hidupkan kembali dari remote
          mergedUrls = [];
        } else {
          mergedUrls = localUrls;
        }

        if (mergedUrls.length > 0 && !explicitlyClearedPhotoCodes.has(code)) {
          preservedPhotosByCode.set(code, mergedUrls);
        }

        if (
          metaDiff ||
          mergedUrls.length !== localUrls.length ||
          (mergedUrls[0] || '') !== (item.dokumentasiUrl || '')
        ) {
          localChanged = true;
        }

        const mergedRec: DatabaseBarangRecord = {
          ...item,
          deskripsiBarang: nextDesc,
          keteranganBarang: nextDesc,
          unit1: nextUnit1,
          satuan: nextUnit1,
          unit2: nextUnit2,
          rasio2: nextRasio2,
          panjangCm: nextP,
          lebarCm: nextL,
          tinggiCm: nextT,
          volM3: nextVol,
          beratKg: nextBerat,
          dokumentasiUrls: mergedUrls,
          dokumentasiUrl: mergedUrls[0] || ''
        };

        // Jika device ini memiliki foto yang belum ada di server (mis. 69 foto di HP), antrekan untuk didorong ke server
        const remoteSet = new Set(remoteUrls);
        const hasUnpushedLocalPhoto = mergedUrls.some(u => !remoteSet.has(u));
        if (hasUnpushedLocalPhoto && !explicitlyClearedPhotoCodes.has(code)) {
          localItemsToPushToServer.push({ record: mergedRec, idx });
        }

        return mergedRec;
      });

      // Jika ada item berfoto dari server yang belum ada sama sekali di localList
      const existingCodes = new Set(updatedLocal.map(i => i.noBarang.trim().toUpperCase()));
      remotePhotoByCode.forEach((remoteItem, code) => {
        if (!existingCodes.has(code)) {
          updatedLocal.push(remoteItem);
          localChanged = true;
        }
      });

      if (localChanged) {
        inMemoryItems = updatedLocal;
        hasHydratedFromIdb = true;
        await saveRecordsToIndexedDb(updatedLocal);
        writeSafeLocalStorageCache(updatedLocal);
        window.dispatchEvent(new CustomEvent('akk-database-barang-updated'));
      }

      // Jika device ini memiliki foto dokumentasi yang belum masuk ke server (misal 69 foto di HP), dorong semuanya secara micro-batch ke server!
      if (localItemsToPushToServer.length > 0) {
        await this.pushPhotosBatchToServer(localItemsToPushToServer);
      }

      updateSyncStatus({
        serverCount: Number(data.totalCount) || updatedLocal.length,
        lastSyncedAt: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        error: null
      });
      return localChanged;
    } catch (err: any) {
      updateSyncStatus({ error: err?.message || 'Gagal sinkronisasi foto otomatis' });
      return false;
    }
  },

  async forceSyncNow(): Promise<{ count: number; items: DatabaseBarangRecord[] }> {
    hasHydratedFromIdb = false;
    hydrationPromise = null;
    await this.syncRealtimePhotosFromServer();
    const localList = this.getAll();
    const remoteList = await this.fetchFromServer();

    if (localList.length > 0 && (!remoteList || remoteList.length < localList.length)) {
      await this.syncAllToServer(localList, 'replace_all');
      return { count: localList.length, items: localList };
    }
    if (remoteList && remoteList.length > 0) {
      const { merged, shouldPushToServer, itemsWithLocalPhotosToPush } = mergeLocalAndRemoteRecords(localList, remoteList);
      inMemoryItems = merged;
      hasHydratedFromIdb = true;
      await saveRecordsToIndexedDb(merged);
      writeSafeLocalStorageCache(merged);
      if (itemsWithLocalPhotosToPush.length > 0) {
        await this.pushPhotosBatchToServer(itemsWithLocalPhotosToPush);
      }
      if (shouldPushToServer) {
        await this.syncAllToServer(merged, 'replace_all');
      }
      window.dispatchEvent(new CustomEvent('akk-database-barang-updated'));
      return { count: merged.length, items: merged };
    }
    return { count: localList.length, items: localList };
  },

  async ensureHydrated(): Promise<DatabaseBarangRecord[]> {
    if (hasHydratedFromIdb && inMemoryItems && inMemoryItems.length > 0) {
      return [...inMemoryItems];
    }
    if (hydrationPromise) {
      return hydrationPromise;
    }

    hydrationPromise = (async () => {
      try {
        // 1. Muat data dari IndexedDB DAN localStorage lalu gabungkan agar 69 foto di IndexedDB HP tidak pernah tertimpa
        const idbRawList = await loadRecordsFromIndexedDb();
        const lsRawList = this.getAll();

        let localList: DatabaseBarangRecord[] = [];
        if (idbRawList && idbRawList.length > 0) {
          const filteredIdb = idbRawList
            .filter(item => !isLegacySeededBarang(item?.noBarang))
            .map((item, idx) => sanitizeRecord(item, idx));
          if (lsRawList.length > 0) {
            const mergedLocal = mergeLocalAndRemoteRecords(filteredIdb, lsRawList);
            localList = mergedLocal.merged;
          } else {
            localList = filteredIdb;
          }
          inMemoryItems = localList;
          window.dispatchEvent(new CustomEvent('akk-database-barang-updated'));
        } else {
          localList = lsRawList;
          if (localList.length > 0) {
            await saveRecordsToIndexedDb(localList);
            writeSafeLocalStorageCache(localList);
          }
        }

        // 2. Sinkronisasi dengan Server MySQL (/api/database-barang) agar PC & HP menampilkan data yang sama
        const remoteList = await this.fetchFromServer();
        if (remoteList !== null) {
          const {
            merged,
            shouldPushToServer,
            shouldSaveLocally,
            itemsWithLocalPhotosToPush
          } = mergeLocalAndRemoteRecords(localList, remoteList);
          inMemoryItems = merged;
          hasHydratedFromIdb = true;

          if (shouldSaveLocally || merged.length !== localList.length) {
            await saveRecordsToIndexedDb(merged);
            writeSafeLocalStorageCache(merged);
            window.dispatchEvent(new CustomEvent('akk-database-barang-updated'));
          }

          // Dorong segera semua item yang memiliki foto di device ini (misal 69 foto di HP) tapi belum ada di server!
          if (itemsWithLocalPhotosToPush.length > 0) {
            void this.pushPhotosBatchToServer(itemsWithLocalPhotosToPush).catch(err => {
              updateSyncStatus({ error: err?.message || 'Gagal kirim foto ke MySQL' });
            });
          } else if (shouldPushToServer && merged.length > 0) {
            void this.syncAllToServer(merged, 'replace_all');
          }

          return [...merged];
        }

        hasHydratedFromIdb = true;
        return [...localList];
      } catch {
        hasHydratedFromIdb = true;
        return this.getAll();
      } finally {
        hydrationPromise = null;
      }
    })();

    return hydrationPromise;
  },

  getAll(): DatabaseBarangRecord[] {
    if (inMemoryItems && inMemoryItems.length > 0) {
      const cleanedMem = inMemoryItems
        .filter(item => !isLegacySeededBarang(item.noBarang))
        .map((item, idx) => sanitizeRecord(item, idx));
      inMemoryItems = cleanedMem;
      return [...inMemoryItems];
    }

    try {
      const saved = localStorage.getItem(LS_KEY_DATABASE_BARANG);
      let list: DatabaseBarangRecord[] = [];
      let needsCleanWrite = false;
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const filtered = parsed.filter(item => !isLegacySeededBarang(item?.noBarang));
          if (filtered.length !== parsed.length) {
            needsCleanWrite = true;
          }
          list = filtered.map((item, idx) => {
            if (
              isLegacySyntheticUnitFallback(String(item?.unit2 || ''), String(item?.unit3 || ''), item?.rasio2, item?.rasio3) ||
              isLegacySyntheticDimensionFallback(
                Number(item?.panjangCm) || 0,
                Number(item?.lebarCm) || 0,
                Number(item?.tinggiCm) || 0,
                Number(item?.volM3) || 0,
                Number(item?.beratKg) || 0
              )
            ) {
              needsCleanWrite = true;
            }
            return sanitizeRecord(item, idx);
          });
        }
      }

      if (needsCleanWrite) {
        writeSafeLocalStorageCache(list);
      }

      inMemoryItems = list;
      return [...list];
    } catch {
      return inMemoryItems ? [...inMemoryItems] : [];
    }
  },

  saveAll(records: DatabaseBarangRecord[], syncRemote = true): void {
    const sanitized = records
      .filter(r => !isLegacySeededBarang(r?.noBarang))
      .map((r, idx) => sanitizeRecord(r, idx));
    inMemoryItems = sanitized;
    hasHydratedFromIdb = true;

    // Simpan ke IndexedDB (kapasitas besar, cocok untuk ribuan baris + foto, otomatis menggabungkan foto yang sudah ada di IndexedDB)
    void saveRecordsToIndexedDb(sanitized);

    // Simpan ke localStorage secara aman tanpa pernah meninggalkan cache lama
    writeSafeLocalStorageCache(sanitized);

    if (syncRemote) {
      void this.syncAllToServer(sanitized, 'replace_all');
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
    const existingAll = this.getAll();
    const existingByCode = new Map<string, DatabaseBarangRecord>();
    existingAll.forEach(item => {
      existingByCode.set(item.noBarang.trim().toUpperCase(), item);
    });

    // Pertahankan urutan baris persis sesuai file Excel; nilai kosong tetap '' dan nilai 0 tetap 0
    const sanitizedBatch: DatabaseBarangRecord[] = records.map((item, idx) => {
      const code = String(item.noBarang || '').trim().toUpperCase() || `AKK-BRG-${String(idx + 1).padStart(4, '0')}`;
      const prev = existingByCode.get(code);
      const desc = String(item.deskripsiBarang || item.keteranganBarang || prev?.deskripsiBarang || 'Barang Kemasan AKK').trim();
      const u1 = String(item.unit1 || item.satuan || prev?.unit1 || 'Pcs').trim();
      const rawU2 = item.unit2 !== undefined && item.unit2 !== null ? String(item.unit2).trim() : '';
      const rawU3 = item.unit3 !== undefined && item.unit3 !== null ? String(item.unit3).trim() : '';
      const u2 = rawU2 === '-' ? '' : rawU2;
      const u3 = rawU3 === '-' ? '' : rawU3;
      const r2 =
        item.rasio2 !== undefined && item.rasio2 !== null && item.rasio2 !== '' && item.rasio2 !== '-'
          ? !isNaN(Number(item.rasio2))
            ? Number(item.rasio2)
            : item.rasio2
          : 0;
      const r3 =
        item.rasio3 !== undefined && item.rasio3 !== null && item.rasio3 !== '' && item.rasio3 !== '-'
          ? !isNaN(Number(item.rasio3))
            ? Number(item.rasio3)
            : item.rasio3
          : 0;
      const p = Number(item.panjangCm) || 0;
      const l = Number(item.lebarCm) || 0;
      const t = Number(item.tinggiCm) || 0;
      let v = 0;
      if (item.volM3 !== undefined && item.volM3 !== null && Number(item.volM3) > 0) {
        v = Number(item.volM3) || 0;
      } else if (p > 0 && l > 0 && t > 0) {
        v = calculateVolM3(p, l, t);
      }
      const b =
        item.beratKg !== undefined && item.beratKg !== null
          ? Number(item.beratKg) || 0
          : 0;

      // Pertahankan foto dokumentasi jika barang sebelumnya sudah pernah difoto oleh user
      const incomingUrls: string[] = Array.isArray(item.dokumentasiUrls)
        ? item.dokumentasiUrls.filter((u: any) => typeof u === 'string' && u.trim() && !u.startsWith('data:image/svg+xml'))
        : [];
      const rawDoc = item.dokumentasiUrl && !item.dokumentasiUrl.startsWith('data:image/svg+xml') ? item.dokumentasiUrl : '';
      if (rawDoc && !incomingUrls.includes(rawDoc)) {
        incomingUrls.unshift(rawDoc);
      }
      const idbPreserved = preservedPhotosByCode.get(code) || [];
      const finalUrls =
        incomingUrls.length > 0
          ? incomingUrls
          : idbPreserved.length > 0
          ? idbPreserved
          : Array.isArray(prev?.dokumentasiUrls) && prev.dokumentasiUrls.length > 0
          ? prev.dokumentasiUrls.filter(u => u && !u.startsWith('data:image/svg+xml'))
          : prev?.dokumentasiUrl && !prev.dokumentasiUrl.startsWith('data:image/svg+xml')
          ? [prev.dokumentasiUrl]
          : [];

      if (finalUrls.length > 0) {
        preservedPhotosByCode.set(code, finalUrls);
      }

      const rec: DatabaseBarangRecordWithOrder = {
        id: prev?.id || item.id || `dbb-${String(idx + 1).padStart(6, '0')}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        orderIndex: idx,
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
        dokumentasiUrl: finalUrls[0] || '',
        dokumentasiUrls: finalUrls,
        compressedSizeKb: item.compressedSizeKb ?? prev?.compressedSizeKb ?? 0,
        originalSizeKb: item.originalSizeKb ?? prev?.originalSizeKb ?? 0,
        compressionSavingsPct: item.compressionSavingsPct ?? prev?.compressionSavingsPct ?? 0,
        kategoriBarang: item.kategoriBarang || prev?.kategoriBarang || 'Karton Box Corrugated',
        stokTersedia: item.stokTersedia !== undefined ? Number(item.stokTersedia) : (prev?.stokTersedia ?? 1000),
        cabang: item.cabang || prev?.cabang || 'Banyuwangi',
        updatedAt: item.updatedAt || today
      };
      return rec;
    });

    let finalRecords: DatabaseBarangRecord[] = [];
    if (mode === 'replace_all') {
      finalRecords = sanitizedBatch;
    } else {
      const codeMap = new Map<string, number>();
      existingAll.forEach((item, idx) => codeMap.set(item.noBarang.trim().toUpperCase(), idx));

      finalRecords = [...existingAll];
      sanitizedBatch.forEach(item => {
        const existingIdx = codeMap.get(item.noBarang.trim().toUpperCase());
        if (existingIdx !== undefined) {
          finalRecords[existingIdx] = {
            ...finalRecords[existingIdx],
            ...item,
            orderIndex: existingIdx
          } as DatabaseBarangRecord;
        } else {
          finalRecords.push({
            ...item,
            orderIndex: finalRecords.length
          } as DatabaseBarangRecord);
        }
      });
    }

    // Perbarui in-memory cache segera
    inMemoryItems = finalRecords;
    hasHydratedFromIdb = true;

    // Simpan ke IndexedDB, localStorage, dan Server MySQL secara konsisten
    void saveRecordsToIndexedDb(finalRecords);
    writeSafeLocalStorageCache(finalRecords);
    void this.syncAllToServer(finalRecords, 'replace_all');

    window.dispatchEvent(new CustomEvent('akk-database-barang-updated'));
    return { count: finalRecords.length, saved: finalRecords };
  },

  matchesSearchQuery(item: DatabaseBarangRecord, rawQuery: string): boolean {
    const q = (rawQuery || '').trim().toLowerCase();
    if (!q) return true;

    const combinedRaw = [
      item.noBarang || '',
      item.deskripsiBarang || '',
      item.keteranganBarang || '',
      item.unit1 || '',
      item.satuan || '',
      item.unit2 || '',
      item.unit3 || ''
    ]
      .join(' ')
      .toLowerCase();

    // Direct substring match
    if (combinedRaw.includes(q)) return true;

    const combinedNormalized = normalizeText(combinedRaw);
    const compactAlnum = combinedNormalized.replace(/\s+/g, '');

    // Split query into tokens so non-contiguous words/numbers (e.g. "ola bola" or "bola 200") match in any position/order
    const tokens = q.split(/\s+/).filter(Boolean);
    if (tokens.length === 0) return true;

    return tokens.every(token => {
      if (combinedRaw.includes(token)) return true;
      const normToken = normalizeText(token);
      if (!normToken) return true;
      return combinedNormalized.includes(normToken) || compactAlnum.includes(normToken.replace(/\s+/g, ''));
    });
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

    // 2. Partial substring match by deskripsiBarang
    const partial = list.find(item => {
      const descNorm = normalizeText(item.deskripsiBarang || item.keteranganBarang);
      const codeNorm = normalizeText(item.noBarang);
      return (
        (q1.length >= 3 && (descNorm.includes(q1) || q1.includes(descNorm) || codeNorm.includes(q1))) ||
        (q2.length >= 3 && (descNorm.includes(q2) || q2.includes(descNorm)))
      );
    });
    if (partial) return partial;

    // 3. Non-contiguous multi-token match (e.g. "OLA BOLA" -> "CUP PLST OLALA 200ML BOLA @50")
    const rawQuery = (optionalName || queryNoOrName || '').trim();
    if (rawQuery.length >= 2) {
      return list.find(item => this.matchesSearchQuery(item, rawQuery));
    }
    return undefined;
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

    const explicitPhotoReplace = Array.isArray(input.dokumentasiUrls);
    let urls: string[] = [];
    if (Array.isArray(input.dokumentasiUrls)) {
      urls = input.dokumentasiUrls.filter(u => u && !u.startsWith('data:image/svg+xml') && !deletedPhotoUrls.has(u));
      if (urls.length === 0) {
        explicitlyClearedPhotoCodes.add(cleanCode);
        savePersistentSet(LS_KEY_CLEARED_PHOTO_CODES, explicitlyClearedPhotoCodes);
        photoOverridesByCode.delete(cleanCode);
        savePersistentMap(LS_KEY_EXPLICIT_PHOTO_OVERRIDES, photoOverridesByCode);
        preservedPhotosByCode.delete(cleanCode);
        explicitPhotoReplaceTimestampByCode.set(cleanCode, Date.now());
      } else {
        explicitlyClearedPhotoCodes.delete(cleanCode);
        savePersistentSet(LS_KEY_CLEARED_PHOTO_CODES, explicitlyClearedPhotoCodes);
        photoOverridesByCode.set(cleanCode, urls);
        savePersistentMap(LS_KEY_EXPLICIT_PHOTO_OVERRIDES, photoOverridesByCode);
        preservedPhotosByCode.set(cleanCode, urls);
        explicitPhotoReplaceTimestampByCode.set(cleanCode, Date.now());
      }
    } else if (input.dokumentasiUrl && !input.dokumentasiUrl.startsWith('data:image/svg+xml') && !deletedPhotoUrls.has(input.dokumentasiUrl)) {
      urls = [input.dokumentasiUrl];
      explicitlyClearedPhotoCodes.delete(cleanCode);
      savePersistentSet(LS_KEY_CLEARED_PHOTO_CODES, explicitlyClearedPhotoCodes);
      photoOverridesByCode.set(cleanCode, urls);
      savePersistentMap(LS_KEY_EXPLICIT_PHOTO_OVERRIDES, photoOverridesByCode);
      preservedPhotosByCode.set(cleanCode, urls);
      explicitPhotoReplaceTimestampByCode.set(cleanCode, Date.now());
    } else if (prev?.dokumentasiUrls && prev.dokumentasiUrls.length > 0) {
      urls = prev.dokumentasiUrls.filter(u => !deletedPhotoUrls.has(u));
    } else if (prev?.dokumentasiUrl && !prev.dokumentasiUrl.startsWith('data:image/svg+xml') && !deletedPhotoUrls.has(prev.dokumentasiUrl)) {
      urls = [prev.dokumentasiUrl];
    } else if (!explicitlyClearedPhotoCodes.has(cleanCode) && (photoOverridesByCode.has(cleanCode) || preservedPhotosByCode.has(cleanCode))) {
      urls = [...((photoOverridesByCode.get(cleanCode) || preservedPhotosByCode.get(cleanCode) || []).filter(u => !deletedPhotoUrls.has(u)))];
    }

    const docUrl = urls[0] || (!explicitPhotoReplace && input.dokumentasiUrl && !input.dokumentasiUrl.startsWith('data:image/svg+xml') ? input.dokumentasiUrl : '');
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

    const targetOrderIdx = idx >= 0 ? idx : list.length;
    if (idx >= 0) {
      list[idx] = record;
    } else {
      list.push(record);
    }

    this.saveAll(list, false);
    const job = this.pushItemToServer(record, targetOrderIdx, explicitPhotoReplace);
    pendingItemUploads.set(cleanCode, job);
    void job.finally(() => {
      if (pendingItemUploads.get(cleanCode) === job) pendingItemUploads.delete(cleanCode);
    });
    return record;
  },

  deleteItem(id: string): void {
    const list = this.getAll().filter(i => i.id !== id);
    this.saveAll(list, false);
    void this.deleteItemFromServer(id);
  },

  deletePhoto(code: string, photoUrl: string): void {
    const cleanCode = String(code || '').trim().toUpperCase();
    if (!cleanCode) return;
    if (photoUrl) {
      deletedPhotoUrls.add(photoUrl);
      savePersistentSet(LS_KEY_DELETED_PHOTO_URLS, deletedPhotoUrls);
    }
    const currentPhotos = photoOverridesByCode.get(cleanCode) || preservedPhotosByCode.get(cleanCode) || [];
    const remaining = currentPhotos.filter(u => u !== photoUrl && !deletedPhotoUrls.has(u));
    if (remaining.length === 0) {
      explicitlyClearedPhotoCodes.add(cleanCode);
      savePersistentSet(LS_KEY_CLEARED_PHOTO_CODES, explicitlyClearedPhotoCodes);
      photoOverridesByCode.delete(cleanCode);
      savePersistentMap(LS_KEY_EXPLICIT_PHOTO_OVERRIDES, photoOverridesByCode);
      preservedPhotosByCode.delete(cleanCode);
    } else {
      photoOverridesByCode.set(cleanCode, remaining);
      savePersistentMap(LS_KEY_EXPLICIT_PHOTO_OVERRIDES, photoOverridesByCode);
      preservedPhotosByCode.set(cleanCode, remaining);
    }
    explicitPhotoReplaceTimestampByCode.set(cleanCode, Date.now());

    // Update in-memory items, IndexedDB, and localStorage immediately
    const list = this.getAll();
    const idx = list.findIndex(r => String(r.noBarang || '').trim().toUpperCase() === cleanCode);
    if (idx >= 0) {
      list[idx] = {
        ...list[idx],
        dokumentasiUrls: remaining,
        dokumentasiUrl: remaining[0] || '',
        updatedAt: new Date().toISOString().split('T')[0]
      };
      inMemoryItems = list;
      void saveRecordsToIndexedDb(list);
      writeSafeLocalStorageCache(list);
    }

    if (typeof window !== 'undefined') {
      fetch('/api/database-barang/delete-photo', {
        method: 'POST',
        credentials: 'include',
        headers: getAuthHeaders(),
        body: JSON.stringify({ noBarang: cleanCode, photoUrl, clearAll: remaining.length === 0, updatedUrls: remaining })
      }).catch(() => {});
      window.dispatchEvent(new CustomEvent('akk-database-barang-updated'));
    }
  },

  clearAllPhotos(code: string): void {
    const cleanCode = String(code || '').trim().toUpperCase();
    if (!cleanCode) return;
    const current = photoOverridesByCode.get(cleanCode) || preservedPhotosByCode.get(cleanCode) || [];
    current.forEach(u => deletedPhotoUrls.add(u));
    savePersistentSet(LS_KEY_DELETED_PHOTO_URLS, deletedPhotoUrls);
    explicitlyClearedPhotoCodes.add(cleanCode);
    savePersistentSet(LS_KEY_CLEARED_PHOTO_CODES, explicitlyClearedPhotoCodes);
    photoOverridesByCode.delete(cleanCode);
    savePersistentMap(LS_KEY_EXPLICIT_PHOTO_OVERRIDES, photoOverridesByCode);
    preservedPhotosByCode.delete(cleanCode);
    explicitPhotoReplaceTimestampByCode.set(cleanCode, Date.now());

    // Update in-memory items, IndexedDB, and localStorage immediately
    const list = this.getAll();
    const idx = list.findIndex(r => String(r.noBarang || '').trim().toUpperCase() === cleanCode);
    if (idx >= 0) {
      list[idx] = {
        ...list[idx],
        dokumentasiUrls: [],
        dokumentasiUrl: '',
        updatedAt: new Date().toISOString().split('T')[0]
      };
      inMemoryItems = list;
      void saveRecordsToIndexedDb(list);
      writeSafeLocalStorageCache(list);
    }

    if (typeof window !== 'undefined') {
      fetch('/api/database-barang/delete-photo', {
        method: 'POST',
        credentials: 'include',
        headers: getAuthHeaders(),
        body: JSON.stringify({ noBarang: cleanCode, clearAll: true, updatedUrls: [] })
      }).catch(() => {});
      window.dispatchEvent(new CustomEvent('akk-database-barang-updated'));
    }
  },

  async bulkDeletePhotos(target: { codes?: string[]; keepCodes?: string[] }): Promise<{ success: boolean; deletedCount: number; remainingPhotoCount: number }> {
    const list = this.getAll();
    let codesToClear: string[] = [];

    if (target.keepCodes) {
      const keep = new Set(target.keepCodes.map(c => String(c).trim().toUpperCase()));
      codesToClear = list
        .filter(it => {
          const c = String(it.noBarang || '').trim().toUpperCase();
          const hasPhoto = (Array.isArray(it.dokumentasiUrls) && it.dokumentasiUrls.length > 0) ||
            (typeof it.dokumentasiUrl === 'string' && it.dokumentasiUrl.trim() !== '' && !it.dokumentasiUrl.startsWith('data:image/svg+xml'));
          return hasPhoto && !keep.has(c);
        })
        .map(it => String(it.noBarang || '').trim().toUpperCase());
    } else if (target.codes) {
      codesToClear = target.codes.map(c => String(c).trim().toUpperCase());
    }

    codesToClear.forEach(cleanCode => {
      explicitlyClearedPhotoCodes.add(cleanCode);
      photoOverridesByCode.delete(cleanCode);
      preservedPhotosByCode.delete(cleanCode);
      explicitPhotoReplaceTimestampByCode.set(cleanCode, Date.now());
    });
    savePersistentSet(LS_KEY_CLEARED_PHOTO_CODES, explicitlyClearedPhotoCodes);
    savePersistentMap(LS_KEY_EXPLICIT_PHOTO_OVERRIDES, photoOverridesByCode);

    const clearSet = new Set(codesToClear);
    const updated = list.map(it => {
      const c = String(it.noBarang || '').trim().toUpperCase();
      if (clearSet.has(c)) {
        return {
          ...it,
          dokumentasiUrl: '',
          dokumentasiUrls: [],
          updatedAt: new Date().toISOString().split('T')[0]
        };
      }
      return it;
    });

    inMemoryItems = updated;
    await saveRecordsToIndexedDb(updated);
    writeSafeLocalStorageCache(updated);

    let resData = { success: true, deletedCount: codesToClear.length, remainingPhotoCount: list.filter(it => (it.dokumentasiUrls?.length || 0) > 0).length };
    if (typeof window !== 'undefined') {
      try {
        const res = await fetch('/api/database-barang/photos/bulk-delete', {
          method: 'POST',
          credentials: 'include',
          headers: getAuthHeaders(),
          body: JSON.stringify(target)
        });
        if (res.ok) {
          const d = await res.json();
          resData = d;
        }
      } catch (e) {
        console.warn('Gagal bulk-delete foto ke MySQL server:', e);
      }
      window.dispatchEvent(new CustomEvent('akk-database-barang-updated'));
    }

    return resData;
  },

  resolveBySkuOrClassName(rawLabelOrSku: string): DatabaseBarangRecord | undefined {
    const clean = (rawLabelOrSku || '').trim().toUpperCase();
    if (!clean) return undefined;
    const list = this.getAll();
    const direct = list.find(item => item.noBarang.trim().toUpperCase() === clean);
    if (direct) return direct;
    // Handle format "[7GPJA181] CUP PLST..." or "7GPJA181 - CUP..."
    const bracketMatch = clean.match(/\[([A-Z0-9\-_]+)\]/);
    if (bracketMatch?.[1]) {
      const byBracket = list.find(item => item.noBarang.trim().toUpperCase() === bracketMatch[1]);
      if (byBracket) return byBracket;
    }
    return this.findMatch(clean, clean);
  },

  async exportYoloDatasetFromServer(): Promise<{
    success: boolean;
    count: number;
    classes: string[];
    class_map: Record<string, string>;
    data_yaml: string;
    items: Array<{
      class_id: number;
      sku_code: string;
      no_barang: string;
      item_name: string;
      deskripsi_barang: string;
      unit: string;
      photo_url: string;
      photo_urls: string[];
    }>;
  } | null> {
    try {
      const res = await fetch('/api/yolo/export-dataset', {
        method: 'GET',
        credentials: 'include',
        headers: getAuthHeaders(),
        cache: 'no-store'
      });
      if (!res.ok) return null;
      return await res.json();
    } catch {
      return null;
    }
  }
};

// Aktifkan sinkronisasi Real-Time otomatis antar perangkat (PC <-> HP) segera saat aplikasi dibuka, setiap 3 detik & saat tab kembali aktif
if (typeof window !== 'undefined' && typeof window.indexedDB !== 'undefined') {
  let isRealtimeSyncRunning = false;
  const triggerRealtimePhotoSync = () => {
    if (isRealtimeSyncRunning || (typeof document !== 'undefined' && document.visibilityState === 'hidden')) return;
    isRealtimeSyncRunning = true;
    void databaseBarangService
      .syncRealtimePhotosFromServer()
      .finally(() => {
        isRealtimeSyncRunning = false;
      });
  };

  setTimeout(() => {
    void databaseBarangService.ensureHydrated().then(() => {
      triggerRealtimePhotoSync();
    });
  }, 150);

  setInterval(triggerRealtimePhotoSync, 3000);
  if (typeof window.addEventListener === 'function') {
    window.addEventListener('focus', triggerRealtimePhotoSync);
  }
  if (typeof document !== 'undefined' && typeof document.addEventListener === 'function') {
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        triggerRealtimePhotoSync();
      }
    });
  }
}
