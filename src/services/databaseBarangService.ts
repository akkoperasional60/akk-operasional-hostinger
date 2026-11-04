export interface DatabaseBarangRecord {
  id: string;
  noBarang: string;
  keteranganBarang: string;
  satuan: string;
  dokumentasiUrl: string;
  compressedSizeKb: number;
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
    <text x="120" y="132" text-anchor="middle" fill="#94a3b8" font-family="sans-serif" font-size="7.5">DOKUMENTASI DATABASE BARANG (COMPRESSED)</text>
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

/**
 * Kompresi ekstra untuk foto dokumentasi Database Barang & Bukti Foto Faktur/SO.
 * Mengecilkan dimensi & kualitas WebP/JPEG secara bertahap hingga ukuran file sangat ringan (default target <= 14 KB).
 */
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
    image.onerror = () => reject(new Error('Gagal memuat objek gambar untuk kompresi'));
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

  // Uji dukungan WebP pada browser, fallback ke JPEG
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
    format: preferredMime === 'image/webp' ? 'WebP Ultra-Press' : 'JPEG Ultra-Press'
  };
}

const DEFAULT_DATABASE_BARANG: DatabaseBarangRecord[] = [
  {
    id: 'dbb-1',
    noBarang: 'AKK-KBX-001',
    keteranganBarang: 'Karton Box Corrugated B-Flute 60x40x40 cm (Polos)',
    satuan: 'Ikat',
    dokumentasiUrl: createDefaultBarangThumbnail('AKK-KBX-001', 'Karton Box Corrugated B-Flute 60x40x40 cm (Polos)', 'Ikat'),
    compressedSizeKb: 0.9,
    originalSizeKb: 420.0,
    compressionSavingsPct: 99,
    kategoriBarang: 'Karton Box Corrugated',
    stokTersedia: 4850,
    cabang: 'Banyuwangi',
    updatedAt: '2026-11-03'
  },
  {
    id: 'dbb-2',
    noBarang: 'AKK-KBX-002',
    keteranganBarang: 'Karton Box Double Wall CB-Flute Export 80x50x50 cm',
    satuan: 'Pcs',
    dokumentasiUrl: createDefaultBarangThumbnail('AKK-KBX-002', 'Karton Box Double Wall CB-Flute Export 80x50x50 cm', 'Pcs'),
    compressedSizeKb: 0.9,
    originalSizeKb: 380.0,
    compressionSavingsPct: 99,
    kategoriBarang: 'Karton Box Double Wall',
    stokTersedia: 1120,
    cabang: 'Banyuwangi',
    updatedAt: '2026-11-03'
  },
  {
    id: 'dbb-3',
    noBarang: 'AKK-KBX-003',
    keteranganBarang: 'Box Kemasan Makanan Food Grade Ivory 22x22x8 cm',
    satuan: 'Bal',
    dokumentasiUrl: createDefaultBarangThumbnail('AKK-KBX-003', 'Box Kemasan Makanan Food Grade Ivory 22x22x8 cm', 'Bal'),
    compressedSizeKb: 0.9,
    originalSizeKb: 510.0,
    compressionSavingsPct: 99,
    kategoriBarang: 'Box Kemasan Makanan',
    stokTersedia: 9400,
    cabang: 'Banyuwangi',
    updatedAt: '2026-11-03'
  },
  {
    id: 'dbb-4',
    noBarang: 'AKK-KBX-004',
    keteranganBarang: 'Karton Box Polos E-Flute 40x30x25 cm',
    satuan: 'Ikat',
    dokumentasiUrl: createDefaultBarangThumbnail('AKK-KBX-004', 'Karton Box Polos E-Flute 40x30x25 cm', 'Ikat'),
    compressedSizeKb: 0.9,
    originalSizeKb: 340.0,
    compressionSavingsPct: 99,
    kategoriBarang: 'Karton Box Corrugated',
    stokTersedia: 3600,
    cabang: 'Banyuwangi',
    updatedAt: '2026-11-03'
  },
  {
    id: 'dbb-5',
    noBarang: 'AKK-KBX-005',
    keteranganBarang: 'Karton Box C-Flute Tebal 50x35x35 cm',
    satuan: 'Pcs',
    dokumentasiUrl: createDefaultBarangThumbnail('AKK-KBX-005', 'Karton Box C-Flute Tebal 50x35x35 cm', 'Pcs'),
    compressedSizeKb: 0.9,
    originalSizeKb: 390.0,
    compressionSavingsPct: 99,
    kategoriBarang: 'Karton Box Corrugated',
    stokTersedia: 4100,
    cabang: 'Banyuwangi',
    updatedAt: '2026-11-03'
  },
  {
    id: 'dbb-6',
    noBarang: 'RFID-KB-002',
    keteranganBarang: 'Karton Box Duplex Cetak Custom 30x20x15',
    satuan: 'Box',
    dokumentasiUrl: createDefaultBarangThumbnail('RFID-KB-002', 'Karton Box Duplex Cetak Custom 30x20x15', 'Box'),
    compressedSizeKb: 0.9,
    originalSizeKb: 460.0,
    compressionSavingsPct: 99,
    kategoriBarang: 'Box Kemasan Makanan',
    stokTersedia: 2800,
    cabang: 'Banyuwangi',
    updatedAt: '2026-11-03'
  },
  {
    id: 'dbb-7',
    noBarang: 'RFID-KB-004',
    keteranganBarang: 'Box Pizza E-Flute Kraft Coklat 25x25x5',
    satuan: 'Ikat',
    dokumentasiUrl: createDefaultBarangThumbnail('RFID-KB-004', 'Box Pizza E-Flute Kraft Coklat 25x25x5', 'Ikat'),
    compressedSizeKb: 0.9,
    originalSizeKb: 310.0,
    compressionSavingsPct: 99,
    kategoriBarang: 'Box Kemasan Makanan',
    stokTersedia: 5200,
    cabang: 'Banyuwangi',
    updatedAt: '2026-11-03'
  },
  {
    id: 'dbb-8',
    noBarang: 'RFID-KB-005',
    keteranganBarang: 'Paper Bag Kraft Coklat Tebal Uk. L',
    satuan: 'Pack',
    dokumentasiUrl: createDefaultBarangThumbnail('RFID-KB-005', 'Paper Bag Kraft Coklat Tebal Uk. L', 'Pack'),
    compressedSizeKb: 0.9,
    originalSizeKb: 295.0,
    compressionSavingsPct: 99,
    kategoriBarang: 'Paper Cup & Food Pack',
    stokTersedia: 3100,
    cabang: 'Banyuwangi',
    updatedAt: '2026-11-03'
  }
];

function normalizeText(str: string): string {
  return String(str || '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

export const databaseBarangService = {
  getAll(): DatabaseBarangRecord[] {
    try {
      const saved = localStorage.getItem(LS_KEY_DATABASE_BARANG);
      let list: DatabaseBarangRecord[] = [];
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          list = parsed;
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
            const desc = String(sku?.namaBarang || '').trim();
            const unit = String(sku?.satuan || 'Pcs').trim();
            if (!code || !desc) return;
            const existing = mapByNo.get(code);
            if (!existing) {
              const docUrl = createDefaultBarangThumbnail(code, desc, unit);
              const newItem: DatabaseBarangRecord = {
                id: sku.id || `dbb-sync-${Date.now()}-${idx}`,
                noBarang: code,
                keteranganBarang: desc,
                satuan: unit,
                dokumentasiUrl: docUrl,
                compressedSizeKb: estimateDataUrlSizeKb(docUrl),
                originalSizeKb: 350,
                compressionSavingsPct: 99,
                kategoriBarang: sku.kategoriBarang || 'Karton Box Corrugated',
                stokTersedia: Number(sku.stokTersedia) || 0,
                cabang: sku.cabang || 'Banyuwangi',
                updatedAt: sku.tanggalStok || new Date().toISOString().split('T')[0]
              };
              mapByNo.set(code, newItem);
              list.push(newItem);
              changed = true;
            }
          });

          if (changed) {
            localStorage.setItem(LS_KEY_DATABASE_BARANG, JSON.stringify(list));
          }
        }
      }

      return list;
    } catch {
      return [...DEFAULT_DATABASE_BARANG];
    }
  },

  saveAll(records: DatabaseBarangRecord[]): void {
    try {
      localStorage.setItem(LS_KEY_DATABASE_BARANG, JSON.stringify(records));
      window.dispatchEvent(new CustomEvent('akk-database-barang-updated'));
    } catch (err) {
      console.error('Gagal menyimpan Database Barang:', err);
    }
  },

  findMatch(queryNoOrName: string, optionalName?: string): DatabaseBarangRecord | undefined {
    const list = this.getAll();
    const q1 = normalizeText(queryNoOrName);
    const q2 = normalizeText(optionalName || '');

    if (!q1 && !q2) return undefined;

    // 1. Exact match by noBarang or keteranganBarang
    const exact = list.find(item => {
      const codeNorm = normalizeText(item.noBarang);
      const descNorm = normalizeText(item.keteranganBarang);
      return (
        (q1 && (codeNorm === q1 || descNorm === q1)) ||
        (q2 && (codeNorm === q2 || descNorm === q2))
      );
    });
    if (exact) return exact;

    // 2. Partial match by keteranganBarang
    return list.find(item => {
      const descNorm = normalizeText(item.keteranganBarang);
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
    keteranganBarang: string;
    satuan: string;
    dokumentasiUrl?: string;
    compressedSizeKb?: number;
    originalSizeKb?: number;
    compressionSavingsPct?: number;
    kategoriBarang?: string;
    stokTersedia?: number;
  }): DatabaseBarangRecord {
    const list = this.getAll();
    const cleanCode = input.noBarang.trim().toUpperCase();
    const cleanDesc = input.keteranganBarang.trim();
    const cleanUnit = input.satuan.trim() || 'Pcs';

    const idx = list.findIndex(
      item =>
        (input.id && item.id === input.id) ||
        item.noBarang.trim().toUpperCase() === cleanCode
    );

    const docUrl =
      input.dokumentasiUrl ||
      (idx >= 0 ? list[idx].dokumentasiUrl : createDefaultBarangThumbnail(cleanCode, cleanDesc, cleanUnit));
    const compKb = input.compressedSizeKb ?? estimateDataUrlSizeKb(docUrl);

    const record: DatabaseBarangRecord = {
      id: input.id || (idx >= 0 ? list[idx].id : `dbb-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`),
      noBarang: cleanCode,
      keteranganBarang: cleanDesc,
      satuan: cleanUnit,
      dokumentasiUrl: docUrl,
      compressedSizeKb: compKb,
      originalSizeKb: input.originalSizeKb ?? (idx >= 0 ? list[idx].originalSizeKb : 380),
      compressionSavingsPct: input.compressionSavingsPct ?? (idx >= 0 ? list[idx].compressionSavingsPct : 97),
      kategoriBarang: input.kategoriBarang || (idx >= 0 ? list[idx].kategoriBarang : 'Karton Box Corrugated'),
      stokTersedia: input.stokTersedia ?? (idx >= 0 ? list[idx].stokTersedia : 1000),
      cabang: idx >= 0 ? list[idx].cabang : 'Banyuwangi',
      updatedAt: new Date().toISOString().split('T')[0]
    };

    if (idx >= 0) {
      list[idx] = record;
    } else {
      list.unshift(record);
    }

    this.saveAll(list);
    return record;
  },

  deleteItem(id: string): void {
    const list = this.getAll().filter(i => i.id !== id);
    this.saveAll(list);
  }
};
