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
    'Content-Type': 'application/json'
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
        store.put({
          ...r,
          orderIndex: idx
        });
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

  try {
    if (records.length === 0) {
      localStorage.removeItem(LS_KEY_DATABASE_BARANG + '_idb');
      return;
    }
    if (records.length <= 350) {
      localStorage.setItem(LS_KEY_DATABASE_BARANG, JSON.stringify(records));
      localStorage.removeItem(LS_KEY_DATABASE_BARANG + '_idb');
    } else {
      // Untuk ribuan baris (cth. 4075 baris), simpan versi ringan tanpa foto base64 di localStorage
      // agar pembukaan halaman secara sinkron langsung menampilkan data bersih (foto tetap utuh di IndexedDB & Server)
      const lightweight = records.map((r, idx) => ({
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
        kategoriBarang: r.kategoriBarang,
        stokTersedia: r.stokTersedia,
        cabang: r.cabang,
        updatedAt: r.updatedAt
      }));
      localStorage.setItem(LS_KEY_DATABASE_BARANG, JSON.stringify(lightweight));
      localStorage.setItem(LS_KEY_DATABASE_BARANG + '_idb', 'true');
    }
  } catch {
    try {
      localStorage.removeItem(LS_KEY_DATABASE_BARANG);
      localStorage.setItem(LS_KEY_DATABASE_BARANG + '_idb', 'true');
    } catch {}
  }
}

function mergeLocalAndRemoteRecords(
  localRecords: DatabaseBarangRecord[],
  remoteRecords: DatabaseBarangRecord[]
): { merged: DatabaseBarangRecord[]; shouldPushToServer: boolean; shouldSaveLocally: boolean } {
  if (localRecords.length === 0 && remoteRecords.length === 0) {
    return { merged: [], shouldPushToServer: false, shouldSaveLocally: false };
  }
  // Jika HP/browser baru belum punya data lokal tapi server sudah punya data -> tarik dari server ke HP
  if (localRecords.length === 0 && remoteRecords.length > 0) {
    return { merged: remoteRecords, shouldPushToServer: false, shouldSaveLocally: true };
  }
  // Jika PC sudah punya data lokal (misal 4.075 barang) tapi server masih kosong -> dorong dari PC ke server
  if (localRecords.length > 0 && remoteRecords.length === 0) {
    return { merged: localRecords, shouldPushToServer: true, shouldSaveLocally: false };
  }

  // Jika keduanya ada data, pilih sumber yang lebih lengkap sebagai basis namun tetap gabungkan foto dokumentasi dari kedua sisi
  const useLocalAsPrimary = localRecords.length > remoteRecords.length;
  const primary = useLocalAsPrimary ? localRecords : remoteRecords;
  const secondary = useLocalAsPrimary ? remoteRecords : localRecords;

  const secondaryByCode = new Map<string, DatabaseBarangRecord>();
  secondary.forEach(item => {
    secondaryByCode.set(item.noBarang.trim().toUpperCase(), item);
  });

  let shouldPush = localRecords.length > remoteRecords.length;
  let shouldSaveLocal = remoteRecords.length > localRecords.length;

  const merged = primary.map((item, idx) => {
    const code = item.noBarang.trim().toUpperCase();
    const sec = secondaryByCode.get(code);
    if (!sec) return sanitizeRecord(item, idx);

    const primaryPhotos = Array.isArray(item.dokumentasiUrls)
      ? item.dokumentasiUrls.filter(u => u && !u.startsWith('data:image/svg+xml'))
      : [];
    const secPhotos = Array.isArray(sec.dokumentasiUrls)
      ? sec.dokumentasiUrls.filter(u => u && !u.startsWith('data:image/svg+xml'))
      : [];

    const combinedPhotos = Array.from(new Set([...primaryPhotos, ...secPhotos]));
    if (combinedPhotos.length > primaryPhotos.length) {
      if (useLocalAsPrimary) shouldSaveLocal = true;
      else shouldPush = true;
    }

    // Jika salah satu sisi memiliki dimensi/berat yang sudah diisi sedangkan sisi lain masih 0, pertahankan yang sudah terisi
    const hasPrimaryDim = (item.panjangCm || 0) > 0 || (item.volM3 || 0) > 0;
    const hasSecDim = (sec.panjangCm || 0) > 0 || (sec.volM3 || 0) > 0;

    return sanitizeRecord(
      {
        ...item,
        panjangCm: hasPrimaryDim ? item.panjangCm : (hasSecDim ? sec.panjangCm : item.panjangCm),
        lebarCm: hasPrimaryDim ? item.lebarCm : (hasSecDim ? sec.lebarCm : item.lebarCm),
        tinggiCm: hasPrimaryDim ? item.tinggiCm : (hasSecDim ? sec.tinggiCm : item.tinggiCm),
        volM3: hasPrimaryDim ? item.volM3 : (hasSecDim ? sec.volM3 : item.volM3),
        beratKg: (item.beratKg || 0) > 0 ? item.beratKg : ((sec.beratKg || 0) > 0 ? sec.beratKg : item.beratKg),
        dokumentasiUrls: combinedPhotos,
        dokumentasiUrl: combinedPhotos[0] || item.dokumentasiUrl || sec.dokumentasiUrl || ''
      },
      idx
    );
  });

  return { merged, shouldPushToServer: shouldPush, shouldSaveLocally: shouldSaveLocal };
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
        headers: getAuthHeaders()
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
      const CHUNK_SIZE = 350;
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

      const totalChunks = Math.ceil(total / CHUNK_SIZE);
      for (let chunkIdx = 0; chunkIdx < totalChunks; chunkIdx++) {
        const offset = chunkIdx * CHUNK_SIZE;
        const slice = records.slice(offset, offset + CHUNK_SIZE).map((r, i) => ({
          ...r,
          orderIndex: offset + i
        }));
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
        const pct = Math.min(99, Math.round(((chunkIdx + 1) / totalChunks) * 100));
        updateSyncStatus({ isSyncing: true, progressPct: pct });
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

  async pushItemToServer(record: DatabaseBarangRecord, orderIndex?: number): Promise<void> {
    if (typeof window === 'undefined') return;
    try {
      await fetch('/api/database-barang/item', {
        method: 'POST',
        credentials: 'include',
        headers: getAuthHeaders(),
        body: JSON.stringify({ item: { ...record, orderIndex } })
      });
      updateSyncStatus({
        lastSyncedAt: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
      });
    } catch (err) {
      console.warn('Gagal sinkron item ke server:', err);
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

  async forceSyncNow(): Promise<{ count: number; items: DatabaseBarangRecord[] }> {
    hasHydratedFromIdb = false;
    hydrationPromise = null;
    const localList = this.getAll();
    const remoteList = await this.fetchFromServer();

    if (localList.length > 0 && (!remoteList || remoteList.length < localList.length)) {
      await this.syncAllToServer(localList, 'replace_all');
      return { count: localList.length, items: localList };
    }
    if (remoteList && remoteList.length > 0) {
      const { merged, shouldPushToServer } = mergeLocalAndRemoteRecords(localList, remoteList);
      inMemoryItems = merged;
      hasHydratedFromIdb = true;
      await saveRecordsToIndexedDb(merged);
      writeSafeLocalStorageCache(merged);
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
        // 1. Muat data lokal terlebih dahulu (IndexedDB -> fallback localStorage)
        let localList: DatabaseBarangRecord[] = [];
        const idbList = await loadRecordsFromIndexedDb();
        if (idbList && idbList.length > 0) {
          let needsResave = false;
          const filteredIdb = idbList.filter(item => !isLegacySeededBarang(item?.noBarang));
          if (filteredIdb.length !== idbList.length) {
            needsResave = true;
          }
          localList = filteredIdb.map((item, idx) => {
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
              needsResave = true;
            }
            return sanitizeRecord(item, idx);
          });

          inMemoryItems = localList;
          if (needsResave) {
            await saveRecordsToIndexedDb(localList);
            writeSafeLocalStorageCache(localList);
          }
          window.dispatchEvent(new CustomEvent('akk-database-barang-updated'));
        } else {
          localList = this.getAll();
          if (localList.length > 0) {
            await saveRecordsToIndexedDb(localList);
            writeSafeLocalStorageCache(localList);
          }
        }

        // 2. Sinkronisasi dengan Server MySQL (/api/database-barang) agar PC & HP menampilkan data yang sama
        const remoteList = await this.fetchFromServer();
        if (remoteList !== null) {
          const { merged, shouldPushToServer, shouldSaveLocally } = mergeLocalAndRemoteRecords(localList, remoteList);
          inMemoryItems = merged;
          hasHydratedFromIdb = true;

          if (shouldSaveLocally) {
            await saveRecordsToIndexedDb(merged);
            writeSafeLocalStorageCache(merged);
            window.dispatchEvent(new CustomEvent('akk-database-barang-updated'));
          }

          if (shouldPushToServer && merged.length > 0) {
            // Otomatis unggah 4.075 barang dari browser PC ke Hostinger MySQL di latar belakang
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

    // Simpan ke IndexedDB (kapasitas besar, cocok untuk ribuan baris + foto)
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
      const finalUrls =
        incomingUrls.length > 0
          ? incomingUrls
          : Array.isArray(prev?.dokumentasiUrls) && prev.dokumentasiUrls.length > 0
          ? prev.dokumentasiUrls.filter(u => u && !u.startsWith('data:image/svg+xml'))
          : prev?.dokumentasiUrl && !prev.dokumentasiUrl.startsWith('data:image/svg+xml')
          ? [prev.dokumentasiUrl]
          : [];

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

    const targetOrderIdx = idx >= 0 ? idx : list.length;
    if (idx >= 0) {
      list[idx] = record;
    } else {
      list.push(record);
    }

    this.saveAll(list, false);
    void this.pushItemToServer(record, targetOrderIdx);
    return record;
  },

  deleteItem(id: string): void {
    const list = this.getAll().filter(i => i.id !== id);
    this.saveAll(list, false);
    void this.deleteItemFromServer(id);
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
        headers: { Accept: 'application/json' },
        cache: 'no-store'
      });
      if (!res.ok) return null;
      return await res.json();
    } catch {
      return null;
    }
  }
};


