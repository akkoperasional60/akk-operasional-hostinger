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
  hasPhoto?: boolean;
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

export interface PendingPhotoQueueEntry {
  noBarang: string; // keyPath (UPPERCASE)
  itemId: string;
  deskripsiBarang: string;
  photos: string[];
  replacePhotos: boolean;
  queuedAt: string;
}

export interface DirectPhotoUploadResult {
  success: boolean;
  queuedOffline: boolean;
  deletedOnServer?: boolean;
  record: DatabaseBarangRecord;
  error?: string;
}

export interface DatabaseBarangUpsertInput {
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
}

export const LS_KEY_DATABASE_BARANG = 'akk_wms_database_barang_v1';

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
  _options?: {
    maxDimension?: number;
    targetMaxKb?: number;
    initialQuality?: number;
  }
): Promise<CompressedPhotoResult> {
  // Pertahankan ukuran file, resolusi, dan kualitas asli 100% TANPA kompresi
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

  let origW = 0;
  let origH = 0;
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image();
      image.crossOrigin = 'anonymous';
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error('Gagal memuat objek gambar'));
      image.src = sourceDataUrl;
    });
    origW = img.naturalWidth || img.width || 0;
    origH = img.naturalHeight || img.height || 0;
  } catch {
    origW = 0;
    origH = 0;
  }

  const format = sourceDataUrl.startsWith('data:image/png')
    ? 'PNG'
    : sourceDataUrl.startsWith('data:image/webp')
    ? 'WebP'
    : sourceDataUrl.startsWith('data:image/heic')
    ? 'HEIC'
    : 'JPEG';

  return {
    dataUrl: sourceDataUrl,
    originalSizeKb,
    compressedSizeKb: originalSizeKb,
    savingsPercent: 0,
    width: origW,
    height: origH,
    format
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

function extractCleanPhotosRaw(item?: Partial<DatabaseBarangRecord> | null): string[] {
  if (!item) return [];
  const list = Array.isArray(item.dokumentasiUrls)
    ? item.dokumentasiUrls.filter(
        (u): u is string => typeof u === 'string' && u.trim() !== '' && !u.startsWith('data:image/svg+xml')
      )
    : [];
  const single = typeof item.dokumentasiUrl === 'string' ? item.dokumentasiUrl.trim() : '';
  if (single && !single.startsWith('data:image/svg+xml') && !list.includes(single)) {
    list.unshift(single);
  }
  return Array.from(new Set(list));
}

function sanitizeRecord(item: any, fallbackIndex = 0): DatabaseBarangRecord {
  const code =
    String(item?.noBarang || '').trim().toUpperCase() ||
    `AKK-BRG-${String(fallbackIndex + 1).padStart(3, '0')}`;
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

  if (isLegacySyntheticDimensionFallback(p, l, t, v, b)) {
    p = 0;
    l = 0;
    t = 0;
    v = 0;
    b = 0;
  }

  // Ambil foto murni dari data yang diberikan (TIDAK pernah menghidupkan kembali foto dari cache lokal)
  const rawUrls = extractCleanPhotosRaw(item);
  const primaryDoc = rawUrls[0] || '';
  const hasPhoto = Boolean(item?.hasPhoto || rawUrls.length > 0);

  const rec: DatabaseBarangRecordWithOrder = {
    id:
      item?.id ||
      `dbb-${String(fallbackIndex + 1).padStart(6, '0')}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
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
    hasPhoto,
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

// Legacy IndexedDB yang dulu menyimpan seluruh katalog & foto (harus selalu dibersihkan agar tidak membangkitkan barang terhapus)
const LEGACY_IDB_NAME = 'AKK_WMS_DATABASE_V1';
const LEGACY_IDB_STORE = 'database_barang';
const LEGACY_IDB_VERSION = 1;

// Antrean sementara KHUSUS foto yang gagal terkirim karena sinyal jelek/offline (otomatis dihapus bersih saat 100% terunggah)
const PENDING_QUEUE_IDB_NAME = 'AKK_WMS_PENDING_PHOTO_QUEUE_V1';
const PENDING_QUEUE_STORE = 'pending_photos';
const PENDING_QUEUE_VERSION = 1;

const LS_KEY_CLEARED_PHOTO_CODES = 'akk_db_barang_cleared_photo_codes_v2';
const LS_KEY_DELETED_PHOTO_URLS = 'akk_db_barang_deleted_photo_urls_v2';
const LS_KEY_EXPLICIT_PHOTO_OVERRIDES = 'akk_db_barang_photo_overrides_v2';

export interface PhotoDeletionApprovalRequest {
  id: string;
  noBarang: string;
  deskripsiBarang: string;
  photoUrl: string;
  clearAll: boolean;
  requestedByUserId: string;
  requestedByName: string;
  requestedByRole: string;
  reason: string;
  status: 'pending' | 'approved' | 'rejected';
  requestedAt: string;
  decidedByName?: string;
  decidedAt?: string;
}

function purgeDatabaseBarangLocalStorage(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(LS_KEY_DATABASE_BARANG);
    localStorage.removeItem(LS_KEY_DATABASE_BARANG + '_idb');
    localStorage.removeItem(LS_KEY_CLEARED_PHOTO_CODES);
    localStorage.removeItem(LS_KEY_DELETED_PHOTO_URLS);
    localStorage.removeItem(LS_KEY_EXPLICIT_PHOTO_OVERRIDES);
  } catch {}
}

// Hapus seluruh sisa localStorage lama segera saat modul dimuat
purgeDatabaseBarangLocalStorage();

function deleteIndexedDbByName(dbName: string): Promise<void> {
  return new Promise(resolve => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      resolve();
      return;
    }
    try {
      const req = window.indexedDB.deleteDatabase(dbName);
      req.onsuccess = () => resolve();
      req.onerror = () => resolve();
      req.onblocked = () => resolve();
    } catch {
      resolve();
    }
  });
}

// Kompatibilitas ekspor: Database Barang 100% langsung ke server database, tidak menggunakan IndexedDB/localStorage browser
export async function purgeAllDevicePhotoStorage(): Promise<void> {
  purgeDatabaseBarangLocalStorage();
  await Promise.all([
    deleteIndexedDbByName(LEGACY_IDB_NAME),
    deleteIndexedDbByName(PENDING_QUEUE_IDB_NAME)
  ]);
  updateSyncStatus({ pendingOfflineCount: 0 });
}

export async function saveRecordsToIndexedDb(_records: DatabaseBarangRecord[]): Promise<void> {
  purgeDatabaseBarangLocalStorage();
  await deleteIndexedDbByName(LEGACY_IDB_NAME);
}

export async function loadRecordsFromIndexedDb(): Promise<DatabaseBarangRecord[]> {
  return [];
}

let inMemoryItems: DatabaseBarangRecord[] | null = null;
let hasHydratedFromServer = false;
let hydrationPromise: Promise<DatabaseBarangRecord[]> | null = null;
let photoBatchSyncPromise: Promise<boolean> | null = null;

export interface DatabaseBarangSyncStatus {
  isSyncing: boolean;
  isUploadingPhoto?: boolean;
  progressPct: number;
  lastSyncedAt: string | null;
  serverCount: number;
  pendingOfflineCount: number;
  error: string | null;
}

let syncStatusState: DatabaseBarangSyncStatus = {
  isSyncing: false,
  isUploadingPhoto: false,
  progressPct: 0,
  lastSyncedAt: null,
  serverCount: 0,
  pendingOfflineCount: 0,
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

let photoUploadChain: Promise<void> = Promise.resolve();
const pendingItemUploads = new Map<string, Promise<boolean>>();

export interface DatabaseBarangPhotoRecoveryResult {
  localPhotoSkuCount: number;
  attemptedSkuCount: number;
  succeededSkuCount: number;
  failedSkuCount: number;
  skippedDeletedCount: number;
  beforePhotoSkuCount: number;
  afterPhotoSkuCount: number;
  failedCodes: string[];
  deviceStorageCleared: boolean;
}

export const databaseBarangService = {
  getSyncStatus(): DatabaseBarangSyncStatus {
    return { ...syncStatusState };
  },

  async getPendingOfflinePhotoCount(): Promise<number> {
    await purgeAllDevicePhotoStorage();
    return 0;
  },

  async fetchCatalogFromServer(): Promise<DatabaseBarangRecord[] | null> {
    if (typeof window === 'undefined') return null;
    try {
      let res = await fetch('/api/database-barang/catalog', {
        method: 'GET',
        credentials: 'include',
        headers: getAuthHeaders(),
        cache: 'no-store'
      });
      if (res.status === 404) {
        res = await fetch('/api/database-barang', {
          method: 'GET',
          credentials: 'include',
          headers: getAuthHeaders(),
          cache: 'no-store'
        });
      }
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        updateSyncStatus({
          isSyncing: false,
          error: errData?.error || `Server mengembalikan HTTP ${res.status} saat memuat data barang.`
        });
        return null;
      }
      const data = await res.json();
      if (!data || !Array.isArray(data.items)) {
        updateSyncStatus({ isSyncing: false, error: 'Format respons data barang dari server tidak valid.' });
        return null;
      }
      const existingPhotoByCode = new Map<string, string[]>();
      if (Array.isArray(inMemoryItems)) {
        for (const ex of inMemoryItems) {
          const c = String(ex?.noBarang || '').trim().toUpperCase();
          const urls = extractCleanPhotosRaw(ex);
          if (c && urls.length > 0) existingPhotoByCode.set(c, urls);
        }
      }
      const cleaned = data.items
        .filter((item: any) => !isLegacySeededBarang(item?.noBarang))
        .map((item: any, idx: number) => {
          const rec = sanitizeRecord(item, idx);
          const code = String(rec.noBarang || '').trim().toUpperCase();
          const existingUrls = existingPhotoByCode.get(code) || [];
          const incomingUrls = extractCleanPhotosRaw(rec);
          if (incomingUrls.length === 0 && existingUrls.length > 0 && rec.hasPhoto !== false) {
            return {
              ...rec,
              hasPhoto: true,
              dokumentasiUrls: existingUrls,
              dokumentasiUrl: existingUrls[0] || ''
            };
          }
          return rec;
        });
      updateSyncStatus({
        serverCount: cleaned.length,
        lastSyncedAt: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
        error: null
      });
      return cleaned;
    } catch (err: any) {
      console.warn('Peringatan: Gagal mengambil katalog Database Barang dari server:', err?.message || err);
      updateSyncStatus({
        isSyncing: false,
        error: err?.message || 'Tidak dapat terhubung ke server untuk memuat Database Barang.'
      });
      return null;
    }
  },

  async fetchFromServer(): Promise<DatabaseBarangRecord[] | null> {
    if (typeof window === 'undefined') return null;
    updateSyncStatus({ isSyncing: true, progressPct: 15, error: null });
    const catalog = await this.fetchCatalogFromServer();
    if (catalog === null) {
      return null;
    }
    inMemoryItems = catalog;
    hasHydratedFromServer = true;
    const hasPendingPhotoDownload = catalog.some(it => it.hasPhoto && extractCleanPhotosRaw(it).length === 0);
    updateSyncStatus({
      isSyncing: hasPendingPhotoDownload,
      progressPct: hasPendingPhotoDownload ? 35 : 100,
      serverCount: catalog.length,
      error: null
    });
    window.dispatchEvent(new CustomEvent('akk-database-barang-updated'));
    if (hasPendingPhotoDownload) {
      void this.syncRealtimePhotosFromServer();
    }
    return catalog;
  },

  async fetchItemPhotosFromServer(noBarang: string): Promise<DatabaseBarangRecord | null> {
    if (typeof window === 'undefined') return null;
    const cleanCode = String(noBarang || '').trim().toUpperCase();
    if (!cleanCode) return null;
    try {
      const res = await fetch(`/api/database-barang/item-photos/${encodeURIComponent(cleanCode)}`, {
        method: 'GET',
        credentials: 'include',
        headers: getAuthHeaders(),
        cache: 'no-store'
      });
      if (!res.ok) return null;
      const data = await res.json();
      if (!data?.success) return null;
      const urls = Array.isArray(data.dokumentasiUrls)
        ? data.dokumentasiUrls.filter((u: any) => typeof u === 'string' && u.trim() && !u.startsWith('data:image/svg+xml'))
        : [];
      const currentList = inMemoryItems ? [...inMemoryItems] : [];
      const idx = currentList.findIndex(it => String(it.noBarang || '').trim().toUpperCase() === cleanCode);
      if (idx >= 0) {
        const updated: DatabaseBarangRecord = {
          ...currentList[idx],
          hasPhoto: urls.length > 0,
          dokumentasiUrls: urls,
          dokumentasiUrl: urls[0] || ''
        };
        currentList[idx] = updated;
        inMemoryItems = currentList;
        window.dispatchEvent(new CustomEvent('akk-database-barang-updated'));
        return updated;
      }
      return null;
    } catch {
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
        const slice = records.slice(offset, offset + CHUNK_SIZE).map((r, i) => {
          const globalIdx = offset + i;
          const cleanPhotos = extractCleanPhotosRaw(r);
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
        error: err?.message || 'Gagal sinkronisasi ke server database'
      });
      return false;
    }
  },

  async pushItemToServer(
    record: DatabaseBarangRecord,
    orderIndex?: number,
    replacePhotos = false,
    onlyIfExists = false
  ): Promise<{ ok: boolean; deleted?: boolean; item?: DatabaseBarangRecord; error?: string }> {
    if (typeof window === 'undefined') return { ok: false, error: 'Bukan lingkungan browser' };

    const payloadUrls = extractCleanPhotosRaw(record);
    let lastError = 'Gagal menyimpan ke server database';

    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const res = await fetch('/api/database-barang/item', {
          method: 'POST',
          credentials: 'include',
          headers: getAuthHeaders(),
          body: JSON.stringify({
            item: {
              ...record,
              dokumentasiUrls: payloadUrls,
              dokumentasiUrl: payloadUrls[0] || '',
              orderIndex
            },
            replacePhotos,
            onlyIfExists
          })
        });
        const data = await res.json().catch(() => ({}));
        if (res.status === 404 && data?.deleted) {
          return {
            ok: false,
            deleted: true,
            error: data.error || `Barang ${record.noBarang} sudah dihapus dari database.`
          };
        }
        if (res.ok && data.success) {
          const savedItem = data.item ? sanitizeRecord(data.item, orderIndex ?? 0) : record;
          updateSyncStatus({
            lastSyncedAt: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
            error: null
          });
          return { ok: true, item: savedItem };
        }
        lastError = data.error || `HTTP ${res.status}: gagal simpan ke server database`;
        break;
      } catch (err: any) {
        lastError = err?.message || 'Koneksi jaringan sedang tidak stabil';
        if (attempt === 0) {
          continue;
        }
      }
    }

    updateSyncStatus({ error: lastError });
    return { ok: false, error: lastError };
  },

  // Upload foto LANGSUNG ke server database (100% langsung ke server, tanpa localStorage/IndexedDB)
  async uploadPhotosForItem(
    item: DatabaseBarangRecord,
    newPhotoUrls: string[],
    options?: { replaceAllUrls?: string[] }
  ): Promise<DirectPhotoUploadResult> {
    const cleanCode = String(item.noBarang || '').trim().toUpperCase();
    const isReplace = Array.isArray(options?.replaceAllUrls);
    const existingList = this.getAll();
    const idx = existingList.findIndex(
      i => (item.id && i.id === item.id) || String(i.noBarang || '').trim().toUpperCase() === cleanCode
    );
    const baseItem = idx >= 0 ? existingList[idx] : item;
    const baseUrls = extractCleanPhotosRaw(baseItem);
    const cleanNewUrls = newPhotoUrls.filter(u => typeof u === 'string' && u.trim() && !u.startsWith('data:image/svg+xml'));
    const nextUrls = isReplace
      ? (options!.replaceAllUrls || []).filter(u => typeof u === 'string' && u.trim() && !u.startsWith('data:image/svg+xml'))
      : Array.from(new Set([...baseUrls, ...cleanNewUrls]));

    const optimisticRecord: DatabaseBarangRecord = {
      ...baseItem,
      noBarang: cleanCode,
      dokumentasiUrls: nextUrls,
      dokumentasiUrl: nextUrls[0] || '',
      compressedSizeKb: nextUrls.reduce((acc, u) => acc + estimateDataUrlSizeKb(u), 0),
      updatedAt: new Date().toISOString().split('T')[0]
    };

    updateSyncStatus({ isUploadingPhoto: true, error: null });
    try {
      const photosToSend = isReplace ? nextUrls : cleanNewUrls;
      const sendRecord: DatabaseBarangRecord = {
        ...optimisticRecord,
        dokumentasiUrls: photosToSend,
        dokumentasiUrl: photosToSend[0] || ''
      };

      const res = await this.pushItemToServer(sendRecord, idx >= 0 ? idx : existingList.length, isReplace, true);

      if (res.deleted) {
        const filtered = this.getAll().filter(
          i => i.id !== baseItem.id && String(i.noBarang || '').trim().toUpperCase() !== cleanCode
        );
        inMemoryItems = filtered;
        await purgeAllDevicePhotoStorage();
        window.dispatchEvent(new CustomEvent('akk-database-barang-updated'));
        return {
          success: false,
          queuedOffline: false,
          deletedOnServer: true,
          record: optimisticRecord,
          error: res.error || `Barang ${cleanCode} sudah dihapus oleh pengguna lain.`
        };
      }

      if (res.ok && res.item) {
        const latestList = this.getAll();
        const latestIdx = latestList.findIndex(
          i => i.id === res.item!.id || String(i.noBarang || '').trim().toUpperCase() === cleanCode
        );
        if (latestIdx >= 0) {
          latestList[latestIdx] = res.item;
        } else {
          latestList.push(res.item);
        }
        inMemoryItems = latestList;
        await purgeAllDevicePhotoStorage();
        window.dispatchEvent(new CustomEvent('akk-database-barang-updated'));
        return {
          success: true,
          queuedOffline: false,
          record: res.item
        };
      }

      return {
        success: false,
        queuedOffline: false,
        record: baseItem,
        error: res.error || 'Gagal mengunggah foto langsung ke server database. Periksa koneksi jaringan Anda lalu coba lagi.'
      };
    } finally {
      updateSyncStatus({ isUploadingPhoto: false });
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
      const validItemsPayload = entries
        .map(entry => {
          const cleanPhotos = extractCleanPhotosRaw(entry.record);
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
        if (res.ok && data.success) {
          return;
        }
      } catch (err: any) {
        console.warn('Micro-batch photo sync retry item-by-item:', err?.message || err);
      }

      for (const entry of entries) {
        const photos = extractCleanPhotosRaw(entry.record);
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
                  photoItems: [
                    {
                      ...entry.record,
                      orderIndex: entry.idx,
                      dokumentasiUrl: photo,
                      dokumentasiUrls: [photo]
                    }
                  ]
                })
              });
              const data = await res.json().catch(() => ({}));
              if (res.ok && data.success) {
                saved = true;
                break;
              }
              lastError = data.error || `HTTP ${res.status}`;
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

  // Sinkronisasi murni 100% dari server database (TIDAK PERNAH menarik data dari localStorage / IndexedDB)
  async recoverLocalPhotosToMysql(): Promise<DatabaseBarangPhotoRecoveryResult> {
    if (typeof window === 'undefined') throw new Error('Hanya tersedia di browser.');
    updateSyncStatus({ isSyncing: true, progressPct: 20, error: null });

    try {
      await purgeAllDevicePhotoStorage();
      const freshRemote = await this.fetchFromServer();
      if (freshRemote === null) {
        throw new Error('Tidak dapat terhubung ke server database. Periksa koneksi internet Anda lalu coba lagi.');
      }

      inMemoryItems = freshRemote;
      hasHydratedFromServer = true;
      updateSyncStatus({ progressPct: 100, serverCount: freshRemote.length, error: null });
      window.dispatchEvent(new CustomEvent('akk-database-barang-updated'));

      const serverPhotoCount = freshRemote.filter(
        it => extractCleanPhotosRaw(it).length > 0
      ).length;

      return {
        localPhotoSkuCount: 0,
        attemptedSkuCount: 0,
        succeededSkuCount: 0,
        failedSkuCount: 0,
        skippedDeletedCount: 0,
        beforePhotoSkuCount: serverPhotoCount,
        afterPhotoSkuCount: serverPhotoCount,
        failedCodes: [],
        deviceStorageCleared: true
      };
    } catch (err: any) {
      updateSyncStatus({ error: err?.message || 'Gagal sinkronisasi dengan server database' });
      throw err;
    } finally {
      updateSyncStatus({ isSyncing: false });
    }
  },

  async deleteItemFromServer(id: string, noBarang?: string): Promise<{ ok: boolean; error?: string }> {
    if (typeof window === 'undefined') return { ok: false, error: 'Bukan lingkungan browser' };
    try {
      const qs = noBarang ? `?noBarang=${encodeURIComponent(noBarang.trim().toUpperCase())}` : '';
      const res = await fetch(`/api/database-barang/${encodeURIComponent(id)}${qs}`, {
        method: 'DELETE',
        credentials: 'include',
        headers: getAuthHeaders()
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) {
        return { ok: false, error: data.error || `HTTP ${res.status}: gagal menghapus barang dari server` };
      }
      return { ok: true };
    } catch (err: any) {
      console.warn('Gagal hapus item di server:', err);
      return { ok: false, error: err?.message || 'Gagal menghubungi server database' };
    }
  },

  // Tarik pembaruan foto & jumlah barang terbaru HANYA dari server database secara bertahap (aman untuk ratusan foto resolusi penuh)
  async syncRealtimePhotosFromServer(): Promise<boolean> {
    if (typeof window === 'undefined') return false;
    if (photoBatchSyncPromise) {
      return photoBatchSyncPromise;
    }

    photoBatchSyncPromise = (async () => {
      try {
        await purgeAllDevicePhotoStorage();

        if (!hasHydratedFromServer || inMemoryItems === null) {
          const freshCatalog = await this.fetchCatalogFromServer();
          if (freshCatalog !== null) {
            inMemoryItems = freshCatalog;
            hasHydratedFromServer = true;
            window.dispatchEvent(new CustomEvent('akk-database-barang-updated'));
          } else {
            return false;
          }
        }

        const BATCH_LIMIT = 8;
        let offset = 0;
        let hasMore = true;
        let anyChanged = false;
        let lastServerTotalCount = inMemoryItems ? inMemoryItems.length : 0;

        while (hasMore && offset < 20000) {
          const res = await fetch(`/api/database-barang/photos-sync?offset=${offset}&limit=${BATCH_LIMIT}`, {
            method: 'GET',
            credentials: 'include',
            headers: getAuthHeaders(),
            cache: 'no-store'
          });
          if (!res.ok) {
            const errData = await res.json().catch(() => ({}));
            updateSyncStatus({
              isSyncing: false,
              error: errData?.error || `HTTP ${res.status} saat sinkronisasi foto`
            });
            return anyChanged;
          }

          const data = await res.json();
          if (!data || !data.success || !Array.isArray(data.photoItems)) {
            return anyChanged;
          }

          const serverTotalCount = Number(data.totalCount) || 0;
          const totalPhotoCount = Number(data.photoCount) || 0;
          lastServerTotalCount = serverTotalCount;

          if (offset === 0 && inMemoryItems !== null && serverTotalCount > 0 && inMemoryItems.length !== serverTotalCount) {
            const refreshedCatalog = await this.fetchCatalogFromServer();
            if (refreshedCatalog !== null) {
              inMemoryItems = refreshedCatalog;
              anyChanged = true;
            }
          }

          const batchMap = new Map<string, DatabaseBarangRecord>();
          for (const rawItem of data.photoItems) {
            const code = String(rawItem?.noBarang || '').trim().toUpperCase();
            if (!code) continue;
            batchMap.set(code, sanitizeRecord(rawItem, rawItem.orderIndex ?? 0));
          }

          const currentList: DatabaseBarangRecord[] = inMemoryItems ? [...inMemoryItems] : [];
          let batchChanged = false;
          const updatedList: DatabaseBarangRecord[] = currentList.map((item: DatabaseBarangRecord) => {
            const code = String(item.noBarang || '').trim().toUpperCase();
            const remoteMatch = batchMap.get(code);
            if (!remoteMatch) {
              // Jika server menyatakan 0 foto secara global pada offset 0, bersihkan foto lama yang sudah dihapus
              if (offset === 0 && totalPhotoCount === 0 && extractCleanPhotosRaw(item).length > 0) {
                batchChanged = true;
                return {
                  ...item,
                  hasPhoto: false,
                  dokumentasiUrls: [],
                  dokumentasiUrl: ''
                };
              }
              return item;
            }
            const serverUrls = extractCleanPhotosRaw(remoteMatch);
            const localUrls = extractCleanPhotosRaw(item);
            const urlsChanged =
              serverUrls.length !== localUrls.length ||
              serverUrls.some((u, i) => u !== localUrls[i]);
            if (!urlsChanged && item.hasPhoto === (serverUrls.length > 0)) {
              return item;
            }
            batchChanged = true;
            return {
              ...item,
              hasPhoto: serverUrls.length > 0,
              dokumentasiUrls: serverUrls,
              dokumentasiUrl: serverUrls[0] || ''
            };
          });

          if (batchChanged) {
            inMemoryItems = updatedList;
            anyChanged = true;
            window.dispatchEvent(new CustomEvent('akk-database-barang-updated'));
          }

          const processedCount = offset + data.photoItems.length;
          const pct = totalPhotoCount > 0
            ? Math.min(99, Math.max(40, Math.round((processedCount / totalPhotoCount) * 100)))
            : 100;
          const serverHasMore = Boolean(data.hasMore) && data.photoItems.length > 0;
          updateSyncStatus({
            isSyncing: serverHasMore,
            progressPct: serverHasMore ? pct : 100,
            serverCount: lastServerTotalCount,
            error: null
          });

          hasMore = serverHasMore;
          offset += BATCH_LIMIT;
        }

        updateSyncStatus({
          isSyncing: false,
          progressPct: 100,
          serverCount: lastServerTotalCount,
          lastSyncedAt: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
          error: null
        });
        return anyChanged;
      } catch (err: any) {
        updateSyncStatus({
          isSyncing: false,
          error: err?.message || 'Gagal sinkronisasi foto otomatis dari server'
        });
        return false;
      } finally {
        photoBatchSyncPromise = null;
      }
    })();

    return photoBatchSyncPromise;
  },

  async forceSyncNow(): Promise<{ count: number; items: DatabaseBarangRecord[] }> {
    hasHydratedFromServer = false;
    hydrationPromise = null;
    await purgeAllDevicePhotoStorage();
    const remoteList = await this.fetchFromServer();
    if (remoteList !== null) {
      inMemoryItems = remoteList;
      hasHydratedFromServer = true;
      window.dispatchEvent(new CustomEvent('akk-database-barang-updated'));
      return { count: inMemoryItems.length, items: [...inMemoryItems] };
    }
    const current = this.getAll();
    return { count: current.length, items: current };
  },

  async ensureHydrated(): Promise<DatabaseBarangRecord[]> {
    await purgeAllDevicePhotoStorage();
    if (hasHydratedFromServer && inMemoryItems !== null) {
      return [...inMemoryItems];
    }
    if (hydrationPromise) {
      return hydrationPromise;
    }

    hydrationPromise = (async () => {
      try {
        const remoteList = await this.fetchFromServer();
        if (remoteList !== null) {
          inMemoryItems = remoteList;
          hasHydratedFromServer = true;
          window.dispatchEvent(new CustomEvent('akk-database-barang-updated'));
          return [...inMemoryItems];
        }
        // Jangan kunci hasHydratedFromServer=true jika gagal agar percobaan berikutnya tetap menarik data server
        hasHydratedFromServer = false;
        return this.getAll();
      } catch {
        hasHydratedFromServer = false;
        return this.getAll();
      } finally {
        hydrationPromise = null;
      }
    })();

    return hydrationPromise;
  },

  getAll(): DatabaseBarangRecord[] {
    purgeDatabaseBarangLocalStorage();
    if (inMemoryItems && inMemoryItems.length > 0) {
      const cleanedMem = inMemoryItems
        .filter(item => !isLegacySeededBarang(item.noBarang))
        .map((item, idx) => sanitizeRecord(item, idx));
      inMemoryItems = cleanedMem;
      return [...inMemoryItems];
    }
    return [];
  },

  saveAll(records: DatabaseBarangRecord[], syncRemote = true): void {
    purgeDatabaseBarangLocalStorage();
    const sanitized = records
      .filter(r => !isLegacySeededBarang(r?.noBarang))
      .map((r, idx) => sanitizeRecord(r, idx));
    inMemoryItems = sanitized;
    hasHydratedFromServer = true;

    if (syncRemote) {
      void this.syncAllToServer(sanitized, 'replace_all');
    }

    window.dispatchEvent(new CustomEvent('akk-database-barang-updated'));
  },

  getItemThumbnail(item: {
    noBarang?: string;
    deskripsiBarang?: string;
    unit1?: string;
    dokumentasiUrl?: string;
    dokumentasiUrls?: string[];
  }): string {
    if (
      item.dokumentasiUrls &&
      item.dokumentasiUrls.length > 0 &&
      item.dokumentasiUrls[0] &&
      !item.dokumentasiUrls[0].startsWith('data:image/svg+xml')
    ) {
      return item.dokumentasiUrls[0];
    }
    if (item.dokumentasiUrl && item.dokumentasiUrl.trim() && !item.dokumentasiUrl.startsWith('data:image/svg+xml')) {
      return item.dokumentasiUrl;
    }
    return createDefaultBarangThumbnail(
      item.noBarang || 'AKK-BRG',
      item.deskripsiBarang || 'Barang Kemasan AKK',
      item.unit1 || 'Pcs'
    );
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

    const sanitizedBatch: DatabaseBarangRecord[] = records.map((item, idx) => {
      const code =
        String(item.noBarang || '').trim().toUpperCase() || `AKK-BRG-${String(idx + 1).padStart(4, '0')}`;
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
      const b = item.beratKg !== undefined && item.beratKg !== null ? Number(item.beratKg) || 0 : 0;

      const incomingUrls = extractCleanPhotosRaw(item);
      const prevUrls = extractCleanPhotosRaw(prev);
      const finalUrls = incomingUrls.length > 0 ? incomingUrls : prevUrls;

      const rec: DatabaseBarangRecordWithOrder = {
        id:
          prev?.id ||
          item.id ||
          `dbb-${String(idx + 1).padStart(6, '0')}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
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
        stokTersedia: item.stokTersedia !== undefined ? Number(item.stokTersedia) : prev?.stokTersedia ?? 1000,
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

    inMemoryItems = finalRecords;
    hasHydratedFromServer = true;

    purgeDatabaseBarangLocalStorage();
    void deleteIndexedDbByName(LEGACY_IDB_NAME);
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

    if (combinedRaw.includes(q)) return true;

    const combinedNormalized = normalizeText(combinedRaw);
    const compactAlnum = combinedNormalized.replace(/\s+/g, '');

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

    const exact = list.find(item => {
      const codeNorm = normalizeText(item.noBarang);
      const descNorm = normalizeText(item.deskripsiBarang || item.keteranganBarang);
      return (
        (q1 && (codeNorm === q1 || descNorm === q1)) ||
        (q2 && (codeNorm === q2 || descNorm === q2))
      );
    });
    if (exact) return exact;

    const partial = list.find(item => {
      const descNorm = normalizeText(item.deskripsiBarang || item.keteranganBarang);
      const codeNorm = normalizeText(item.noBarang);
      return (
        (q1.length >= 3 && (descNorm.includes(q1) || q1.includes(descNorm) || codeNorm.includes(q1))) ||
        (q2.length >= 3 && (descNorm.includes(q2) || q2.includes(descNorm)))
      );
    });
    if (partial) return partial;

    const rawQuery = (optionalName || queryNoOrName || '').trim();
    if (rawQuery.length >= 2) {
      return list.find(item => this.matchesSearchQuery(item, rawQuery));
    }
    return undefined;
  },

  buildRecordFromInput(input: DatabaseBarangUpsertInput): {
    record: DatabaseBarangRecord;
    list: DatabaseBarangRecord[];
    idx: number;
    explicitPhotoReplace: boolean;
  } {
    const list = this.getAll();
    const cleanCode = input.noBarang.trim().toUpperCase();
    const cleanDesc = (input.deskripsiBarang || input.keteranganBarang || '').trim();
    const cleanUnit1 = (input.unit1 || input.satuan || 'Pcs').trim();

    const idx = list.findIndex(
      item => (input.id && item.id === input.id) || item.noBarang.trim().toUpperCase() === cleanCode
    );
    const prev = idx >= 0 ? list[idx] : undefined;

    const p = input.panjangCm !== undefined ? Number(input.panjangCm) || 0 : prev?.panjangCm ?? 0;
    const l = input.lebarCm !== undefined ? Number(input.lebarCm) || 0 : prev?.lebarCm ?? 0;
    const t = input.tinggiCm !== undefined ? Number(input.tinggiCm) || 0 : prev?.tinggiCm ?? 0;
    const v =
      input.volM3 !== undefined && input.volM3 !== null
        ? Number(input.volM3) || 0
        : p > 0 && l > 0 && t > 0
        ? calculateVolM3(p, l, t)
        : prev?.volM3 ?? 0;
    const b = input.beratKg !== undefined && input.beratKg !== null ? Number(input.beratKg) || 0 : prev?.beratKg ?? 0;

    const explicitPhotoReplace = Array.isArray(input.dokumentasiUrls);
    let urls: string[] = [];
    if (Array.isArray(input.dokumentasiUrls)) {
      urls = input.dokumentasiUrls.filter(u => u && !u.startsWith('data:image/svg+xml'));
    } else if (input.dokumentasiUrl && !input.dokumentasiUrl.startsWith('data:image/svg+xml')) {
      urls = [input.dokumentasiUrl];
    } else if (prev) {
      urls = extractCleanPhotosRaw(prev);
    }

    const docUrl = urls[0] || '';
    const compKb =
      input.compressedSizeKb ??
      (urls.length > 0 ? urls.reduce((acc, u) => acc + estimateDataUrlSizeKb(u), 0) : 0);

    const record: DatabaseBarangRecord = {
      id: input.id || prev?.id || `dbb-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      noBarang: cleanCode,
      deskripsiBarang: cleanDesc,
      keteranganBarang: cleanDesc,
      unit1: cleanUnit1,
      satuan: cleanUnit1,
      unit2: input.unit2 !== undefined ? String(input.unit2).trim() : prev?.unit2 ?? '',
      unit3: input.unit3 !== undefined ? String(input.unit3).trim() : prev?.unit3 ?? '',
      rasio2:
        input.rasio2 !== undefined && input.rasio2 !== ''
          ? !isNaN(Number(input.rasio2))
            ? Number(input.rasio2)
            : input.rasio2
          : prev?.rasio2 ?? 0,
      rasio3:
        input.rasio3 !== undefined && input.rasio3 !== ''
          ? !isNaN(Number(input.rasio3))
            ? Number(input.rasio3)
            : input.rasio3
          : prev?.rasio3 ?? 0,
      panjangCm: p,
      lebarCm: l,
      tinggiCm: t,
      volM3: v,
      beratKg: b,
      dokumentasiUrl: docUrl,
      dokumentasiUrls: urls,
      compressedSizeKb: compKb,
      originalSizeKb: input.originalSizeKb ?? prev?.originalSizeKb ?? 380,
      compressionSavingsPct: input.compressionSavingsPct ?? prev?.compressionSavingsPct ?? 97,
      kategoriBarang: input.kategoriBarang || prev?.kategoriBarang || 'Karton Box Corrugated',
      stokTersedia: input.stokTersedia ?? prev?.stokTersedia ?? 1000,
      cabang: input.cabang || prev?.cabang || 'Banyuwangi',
      updatedAt: new Date().toISOString().split('T')[0]
    };

    return { record, list, idx, explicitPhotoReplace };
  },

  upsertItem(input: DatabaseBarangUpsertInput): DatabaseBarangRecord {
    const { record, list, idx, explicitPhotoReplace } = this.buildRecordFromInput(input);
    const targetOrderIdx = idx >= 0 ? idx : list.length;
    if (idx >= 0) {
      list[idx] = record;
    } else {
      list.push(record);
    }

    inMemoryItems = list;
    purgeDatabaseBarangLocalStorage();
    window.dispatchEvent(new CustomEvent('akk-database-barang-updated'));

    const job = this.pushItemToServer(record, targetOrderIdx, explicitPhotoReplace, false).then(async res => {
      if (res.ok && res.item) {
        const cur = this.getAll();
        const i = cur.findIndex(x => x.id === res.item!.id || x.noBarang === res.item!.noBarang);
        if (i >= 0) cur[i] = res.item;
        inMemoryItems = cur;
        await purgeAllDevicePhotoStorage();
        window.dispatchEvent(new CustomEvent('akk-database-barang-updated'));
        return true;
      }
      return false;
    });
    pendingItemUploads.set(record.noBarang, job);
    void job.finally(() => {
      if (pendingItemUploads.get(record.noBarang) === job) pendingItemUploads.delete(record.noBarang);
    });
    return record;
  },

  async upsertItemAsync(
    input: DatabaseBarangUpsertInput
  ): Promise<{ success: boolean; queuedOffline: boolean; record: DatabaseBarangRecord; error?: string }> {
    const { record, list, idx, explicitPhotoReplace } = this.buildRecordFromInput(input);
    const targetOrderIdx = idx >= 0 ? idx : list.length;

    updateSyncStatus({ isUploadingPhoto: true, error: null });
    try {
      const res = await this.pushItemToServer(record, targetOrderIdx, explicitPhotoReplace, false);
      if (res.ok && res.item) {
        if (idx >= 0) {
          list[idx] = res.item;
        } else {
          list.push(res.item);
        }
        inMemoryItems = list;
        await purgeAllDevicePhotoStorage();
        window.dispatchEvent(new CustomEvent('akk-database-barang-updated'));
        return { success: true, queuedOffline: false, record: res.item };
      }

      return {
        success: false,
        queuedOffline: false,
        record,
        error: res.error || 'Gagal menyimpan ke server database'
      };
    } finally {
      updateSyncStatus({ isUploadingPhoto: false });
    }
  },

  deleteItem(id: string): void {
    const target = this.getAll().find(i => i.id === id);
    const list = this.getAll().filter(i => i.id !== id);
    inMemoryItems = list;
    void purgeAllDevicePhotoStorage();
    window.dispatchEvent(new CustomEvent('akk-database-barang-updated'));
    void this.deleteItemFromServer(id, target?.noBarang);
  },

  async deleteItemAsync(id: string, noBarang?: string): Promise<{ success: boolean; error?: string }> {
    const current = this.getAll();
    const target = current.find(i => i.id === id);
    const code = (noBarang || target?.noBarang || '').trim().toUpperCase();

    const res = await this.deleteItemFromServer(id, code || undefined);
    if (!res.ok) {
      return { success: false, error: res.error };
    }

    inMemoryItems = current.filter(
      i => i.id !== id && (!code || String(i.noBarang || '').trim().toUpperCase() !== code)
    );
    await purgeAllDevicePhotoStorage();
    window.dispatchEvent(new CustomEvent('akk-database-barang-updated'));
    return { success: true };
  },

  deletePhoto(code: string, photoUrl: string): void {
    void this.deletePhotoAsync(code, photoUrl);
  },

  async deletePhotoAsync(code: string, photoUrl: string): Promise<DatabaseBarangRecord | null> {
    const cleanCode = String(code || '').trim().toUpperCase();
    if (!cleanCode) return null;

    const list = this.getAll();
    const idx = list.findIndex(r => String(r.noBarang || '').trim().toUpperCase() === cleanCode);
    const itemPhotos = idx >= 0 ? extractCleanPhotosRaw(list[idx]) : [];
    const remaining = itemPhotos.filter(u => u !== photoUrl);

    let updatedRecord: DatabaseBarangRecord | null = null;
    if (idx >= 0) {
      updatedRecord = {
        ...list[idx],
        dokumentasiUrls: remaining,
        dokumentasiUrl: remaining[0] || '',
        updatedAt: new Date().toISOString().split('T')[0]
      };
      list[idx] = updatedRecord;
      inMemoryItems = list;
      purgeDatabaseBarangLocalStorage();
    }

    if (typeof window !== 'undefined') {
      try {
        await fetch('/api/database-barang/delete-photo', {
          method: 'POST',
          credentials: 'include',
          headers: getAuthHeaders(),
          body: JSON.stringify({
            noBarang: cleanCode,
            photoUrl,
            clearAll: remaining.length === 0,
            updatedUrls: remaining,
            approvedBySuperAdmin: true
          })
        });
      } catch {}
      window.dispatchEvent(new CustomEvent('akk-database-barang-updated'));
    }

    return updatedRecord;
  },

  clearAllPhotos(code: string): void {
    void this.clearAllPhotosAsync(code);
  },

  async clearAllPhotosAsync(code: string): Promise<DatabaseBarangRecord | null> {
    const cleanCode = String(code || '').trim().toUpperCase();
    if (!cleanCode) return null;

    const list = this.getAll();
    const idx = list.findIndex(r => String(r.noBarang || '').trim().toUpperCase() === cleanCode);
    let updatedRecord: DatabaseBarangRecord | null = null;
    if (idx >= 0) {
      updatedRecord = {
        ...list[idx],
        dokumentasiUrls: [],
        dokumentasiUrl: '',
        updatedAt: new Date().toISOString().split('T')[0]
      };
      list[idx] = updatedRecord;
      inMemoryItems = list;
      purgeDatabaseBarangLocalStorage();
    }

    if (typeof window !== 'undefined') {
      try {
        await fetch('/api/database-barang/delete-photo', {
          method: 'POST',
          credentials: 'include',
          headers: getAuthHeaders(),
          body: JSON.stringify({
            noBarang: cleanCode,
            clearAll: true,
            updatedUrls: [],
            approvedBySuperAdmin: true
          })
        });
      } catch {}
      window.dispatchEvent(new CustomEvent('akk-database-barang-updated'));
    }

    return updatedRecord;
  },

  async fetchPhotoDeleteRequests(): Promise<PhotoDeletionApprovalRequest[]> {
    if (typeof window === 'undefined') return [];
    try {
      const res = await fetch('/api/database-barang/photo-delete-requests', {
        method: 'GET',
        credentials: 'include',
        headers: getAuthHeaders(),
        cache: 'no-store'
      });
      if (!res.ok) return [];
      const data = await res.json();
      return Array.isArray(data?.requests) ? data.requests : [];
    } catch {
      return [];
    }
  },

  async requestPhotoDeletion(payload: {
    noBarang: string;
    deskripsiBarang?: string;
    photoUrl?: string;
    clearAll?: boolean;
    reason?: string;
    requestedByUserId?: string;
    requestedByName?: string;
    requestedByRole?: string;
  }): Promise<{ success: boolean; request?: PhotoDeletionApprovalRequest; message?: string }> {
    try {
      const res = await fetch('/api/database-barang/photo-delete-requests', {
        method: 'POST',
        credentials: 'include',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          action: 'create',
          ...payload
        })
      });
      const data = await res.json().catch(() => ({}));
      return {
        success: Boolean(res.ok && data?.success),
        request: data?.request,
        message: data?.message || data?.error
      };
    } catch (err: any) {
      return { success: false, message: err?.message || 'Gagal mengirim permohonan ke Super Admin' };
    }
  },

  async decidePhotoDeleteRequest(
    requestId: string,
    decision: 'approved' | 'rejected',
    decidedByName?: string,
    decidedByRole?: string
  ): Promise<{ success: boolean; requests?: PhotoDeletionApprovalRequest[]; error?: string }> {
    try {
      const res = await fetch('/api/database-barang/photo-delete-requests', {
        method: 'POST',
        credentials: 'include',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          action: 'decide',
          requestId,
          decision,
          decidedByName,
          decidedByRole
        })
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data?.success) {
        if (decision === 'approved') {
          await this.forceSyncNow();
        }
        return { success: true, requests: data.requests || [] };
      }
      return { success: false, error: data?.error || 'Gagal memproses persetujuan Super Admin' };
    } catch (err: any) {
      return { success: false, error: err?.message || 'Gagal menghubungi server database' };
    }
  },

  async bulkDeletePhotos(target: {
    codes?: string[];
    keepCodes?: string[];
  }): Promise<{ success: boolean; deletedCount: number; remainingPhotoCount: number }> {
    const list = this.getAll();
    let codesToClear: string[] = [];

    if (target.keepCodes) {
      const keep = new Set(target.keepCodes.map(c => String(c).trim().toUpperCase()));
      codesToClear = list
        .filter(it => {
          const c = String(it.noBarang || '').trim().toUpperCase();
          return extractCleanPhotosRaw(it).length > 0 && !keep.has(c);
        })
        .map(it => String(it.noBarang || '').trim().toUpperCase());
    } else if (target.codes) {
      codesToClear = target.codes.map(c => String(c).trim().toUpperCase());
    }

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
    await purgeAllDevicePhotoStorage();

    let resData = {
      success: true,
      deletedCount: codesToClear.length,
      remainingPhotoCount: updated.filter(it => extractCleanPhotosRaw(it).length > 0).length
    };
    if (typeof window !== 'undefined') {
      try {
        const res = await fetch('/api/database-barang/photos/bulk-delete', {
          method: 'POST',
          credentials: 'include',
          headers: getAuthHeaders(),
          body: JSON.stringify({ ...target, approvedBySuperAdmin: true })
        });
        if (res.ok) {
          const d = await res.json();
          resData = d;
        }
      } catch (e) {
        console.warn('Gagal bulk-delete foto ke server:', e);
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

// Sinkronisasi Real-Time otomatis antar perangkat (PC <-> HP) secara hemat kuota jaringan
if (typeof window !== 'undefined' && typeof window.indexedDB !== 'undefined') {
  let isRealtimeSyncRunning = false;
  let lastSyncRunAt = 0;

  const triggerRealtimePhotoSync = () => {
    const now = Date.now();
    if (
      isRealtimeSyncRunning ||
      now - lastSyncRunAt < 15000 ||
      (typeof document !== 'undefined' && document.visibilityState === 'hidden')
    ) {
      return;
    }
    try {
      const hasSession = Boolean(
        localStorage.getItem('akk_auth_session_user_id') ||
          sessionStorage.getItem('akk_auth_session_user_id')
      );
      if (!hasSession) return;
    } catch {
      return;
    }
    isRealtimeSyncRunning = true;
    lastSyncRunAt = now;
    void databaseBarangService.syncRealtimePhotosFromServer().finally(() => {
      isRealtimeSyncRunning = false;
    });
  };

  setInterval(triggerRealtimePhotoSync, 60000);
  if (typeof document !== 'undefined' && typeof document.addEventListener === 'function') {
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        triggerRealtimePhotoSync();
      }
    });
  }
  window.addEventListener('online', () => {
    lastSyncRunAt = 0;
    triggerRealtimePhotoSync();
  });
}
