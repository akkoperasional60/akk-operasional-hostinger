import { logisticsStore } from './store';
import { RetailStore } from '../types';
import { STANDARD_AREAS, StandardAreaName, standardizeAreaName } from '../utils/areaNormalizer';

export type AreaMatchConfidence = 'exact' | 'high' | 'suggested' | 'unmapped';

export interface OfficialAreaItem {
  id: string;
  name: string;
  storeId?: string;
  city: string;
  island: 'Jawa' | 'Bali & Nusa Tenggara' | 'Sumatera' | 'Kalimantan' | 'Sulawesi' | 'Papua & Maluku';
  category: string;
  address?: string;
  isInterIsland: boolean;
  source: 'official_store' | 'standard_area' | 'custom_created';
}

export interface AreaMappingEntry {
  rawArea: string;
  occurrenceCount: number;
  matchedOfficialArea: string | null;
  matchedStoreId: string | null;
  confidence: AreaMatchConfidence;
  confidenceScore: number;
  similarityReason: string;
  isUserOverridden: boolean;
  isNewlyCreated?: boolean;
}

export interface NewAreaPayload {
  name: string;
  storeCode?: string;
  city: string;
  island: 'Jawa' | 'Bali & Nusa Tenggara' | 'Sumatera' | 'Kalimantan' | 'Sulawesi' | 'Papua & Maluku';
  category?: 'Hypermarket' | 'Supermarket' | 'Distribution Hub' | 'Minimarket Cluster' | 'Toko Kelontong / Minimarket' | 'Horeca & Corporate' | 'Mitra Distributor' | 'Needs Correction';
  address?: string;
  contactPerson?: string;
  phone?: string;
  deliveryWindow?: string;
  routeCorridor?: string;
}

const STORAGE_KEY_CUSTOM_AREAS = 'akk_custom_registered_areas_v1';
const STORAGE_KEY_SAVED_MAPPINGS = 'akk_saved_spreadsheet_area_mappings_v1';

// Known abbreviation dictionary for Indonesian logistics
const LOGISTICS_ALIAS_DICTIONARY: Record<string, string> = {
  'DPS': 'DENPASAR',
  'DPS1': 'DENPASAR 1',
  'DPS2': 'DENPASAR 2',
  'BDWS': 'BONDOWOSO',
  'STB': 'SITUBONDO',
  'STBD': 'SITUBONDO',
  'RGJ': 'ROGOJAMPI',
  'GTG': 'GENTENG',
  'BWI': 'BANYUWANGI',
  'SGR': 'SINGARAJA',
  'KBR': 'KALIBARU',
  'SGG': 'SONGGON',
  'SRN': 'SRONO',
  'PW': 'PURWO PASAR',
  'DAMBUNTUNG': 'PURWO DAMBUNTUNG',
  'PASAR': 'PURWO PASAR',
  'SUMBERAYU': 'SUMBERAYU RETAIL',
  'SUMBERAYUY': 'SUMBERAYU RETAIL',
  'SBY': 'SUMBERAYU RETAIL',
  'SGR2': 'SANGGAR',
  'XSTAIL': 'KALISTAIL',
  'SMP': 'SEMPU',
  'JMB': 'JEMBER'
};

/**
 * Calculates string similarity using Levenshtein distance (0 to 100)
 */
function calculateLevenshteinSimilarity(str1: string, str2: string): number {
  const s1 = str1.trim().toUpperCase();
  const s2 = str2.trim().toUpperCase();
  
  if (s1 === s2) return 100;
  if (!s1.length || !s2.length) return 0;

  const track = Array(s2.length + 1).fill(null).map(() =>
    Array(s1.length + 1).fill(null));

  for (let i = 0; i <= s1.length; i += 1) {
    track[0][i] = i;
  }
  for (let j = 0; j <= s2.length; j += 1) {
    track[j][0] = j;
  }

  for (let j = 1; j <= s2.length; j += 1) {
    for (let i = 1; i <= s1.length; i += 1) {
      const indicator = s1[i - 1] === s2[j - 1] ? 0 : 1;
      track[j][i] = Math.min(
        track[j][i - 1] + 1, // deletion
        track[j - 1][i] + 1, // insertion
        track[j - 1][i - 1] + indicator // substitution
      );
    }
  }

  const distance = track[s2.length][s1.length];
  const maxLen = Math.max(s1.length, s2.length);
  return Math.round(((maxLen - distance) / maxLen) * 100);
}

/**
 * Clean & tokenize raw area name
 */
function tokenizeAreaString(text: string): string[] {
  return text
    .toUpperCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(token => token.length > 1 && !['AREA', 'RUTE', 'KAB', 'KOTA', 'TOKO', 'DISTRIBUSI', 'PENGIRIMAN', 'JADWAL'].includes(token));
}

export const areaAutoMapper = {
  /**
   * Mengambil semua daftar area resmi yang diakui di tabel 'Jadwal Pengiriman & Muat'
   * (Hanya memuat Wilayah/Area Pengiriman, bukan toko retail/pelanggan)
   */
  getOfficialAreaList(): OfficialAreaItem[] {
    const list: OfficialAreaItem[] = [];
    const seenNames = new Set<string>();

    // 1. From STANDARD_AREAS (Official Delivery Areas - NO retail store customer names)
    STANDARD_AREAS.forEach(areaName => {
      const upper = areaName.toUpperCase();
      if (!seenNames.has(upper)) {
        seenNames.add(upper);
        const isBali = upper.includes('DENPASAR') || upper.includes('SINGARAJA') || upper.includes('NEGARA');
        let city = 'Banyuwangi';
        if (upper.includes('DENPASAR')) city = 'Denpasar';
        else if (upper.includes('SINGARAJA')) city = 'Singaraja';
        else if (upper.includes('NEGARA')) city = 'Negara';
        else if (upper.includes('SITUBONDO')) city = 'Situbondo';
        else if (upper.includes('BONDOWOSO')) city = 'Bondowoso';
        else if (upper.includes('JEMBER')) city = 'Jember';
        else if (upper.includes('MUNCAR')) city = 'Muncar';
        else if (upper.includes('GENTENG')) city = 'Genteng';
        else if (upper.includes('JAJAG')) city = 'Jajag';
        else if (upper.includes('ROGOJAMPI')) city = 'Rogojampi';
        else if (upper.includes('SONGGON')) city = 'Songgon';
        else if (upper.includes('KALIBARU')) city = 'Kalibaru';
        else if (upper.includes('SRONO')) city = 'Srono';

        list.push({
          id: `std-${upper.replace(/[^A-Z0-9]/g, '_')}`,
          name: areaName,
          city,
          island: isBali ? 'Bali & Nusa Tenggara' : 'Jawa',
          category: 'Distribution Hub',
          isInterIsland: isBali,
          source: 'standard_area'
        });
      }
    });

    // 2. From custom saved delivery areas in localStorage
    try {
      const savedCustom = localStorage.getItem(STORAGE_KEY_CUSTOM_AREAS);
      if (savedCustom) {
        const customItems = JSON.parse(savedCustom) as OfficialAreaItem[];
        customItems.forEach(item => {
          const upper = item.name.trim().toUpperCase();
          if (!seenNames.has(upper)) {
            seenNames.add(upper);
            list.push(item);
          }
        });
      }
    } catch {
      // ignore
    }

    return list;
  },

  /**
   * Deteksi Cerdas: Menyamakan satu nama area mentah dari spreadsheet
   * dengan daftar area yang ada di tabel 'Jadwal Pengiriman & Muat'
   */
  matchRawArea(rawArea: string, officialList?: OfficialAreaItem[]): AreaMappingEntry {
    const catalog = officialList || this.getOfficialAreaList();
    const cleanRaw = (rawArea || '').trim();
    const upperRaw = cleanRaw.toUpperCase();

    // Check user-saved custom mapping dictionary first
    try {
      const savedMappings = localStorage.getItem(STORAGE_KEY_SAVED_MAPPINGS);
      if (savedMappings) {
        const map = JSON.parse(savedMappings) as Record<string, string>;
        if (map[cleanRaw] || map[upperRaw]) {
          const targetName = map[cleanRaw] || map[upperRaw];
          const found = catalog.find(c => c.name.toUpperCase() === targetName.toUpperCase());
          if (found) {
            return {
              rawArea: cleanRaw,
              occurrenceCount: 1,
              matchedOfficialArea: found.name,
              matchedStoreId: found.storeId || found.id,
              confidence: 'exact',
              confidenceScore: 100,
              similarityReason: 'Dicocokkan berdasarkan riwayat pemetaan pengguna sebelumnya',
              isUserOverridden: true
            };
          }
        }
      }
    } catch {
      // ignore
    }

    // 1. Exact Name Match (100% Identical)
    const exactMatch = catalog.find(item => item.name.toUpperCase() === upperRaw);
    if (exactMatch) {
      return {
        rawArea: cleanRaw,
        occurrenceCount: 1,
        matchedOfficialArea: exactMatch.name,
        matchedStoreId: exactMatch.storeId || exactMatch.id,
        confidence: 'exact',
        confidenceScore: 100,
        similarityReason: 'Nama area 100% identik dengan area resmi di Jadwal',
        isUserOverridden: false
      };
    }

    // 2. Standard Area Normalizer Match (Built-in logistics domain logic)
    const normalizedByStandardizer = standardizeAreaName(cleanRaw);
    const standardMatch = catalog.find(item => item.name.toUpperCase() === normalizedByStandardizer.toUpperCase());
    if (standardMatch) {
      return {
        rawArea: cleanRaw,
        occurrenceCount: 1,
        matchedOfficialArea: standardMatch.name,
        matchedStoreId: standardMatch.storeId || standardMatch.id,
        confidence: 'high',
        confidenceScore: 95,
        similarityReason: `Harmonisasi cerdas logistik AKK: '${cleanRaw}' terpetakan ke '${standardMatch.name}'`,
        isUserOverridden: false
      };
    }

    // 3. Keyword / Alias Match
    const rawTokens = tokenizeAreaString(cleanRaw);
    for (const token of rawTokens) {
      const aliasTarget = LOGISTICS_ALIAS_DICTIONARY[token];
      if (aliasTarget) {
        const aliasMatch = catalog.find(c => c.name.toUpperCase().includes(aliasTarget));
        if (aliasMatch) {
          return {
            rawArea: cleanRaw,
            occurrenceCount: 1,
            matchedOfficialArea: aliasMatch.name,
            matchedStoreId: aliasMatch.storeId || aliasMatch.id,
            confidence: 'high',
            confidenceScore: 90,
            similarityReason: `Singkatan '${token}' cocok dengan koridor '${aliasTarget}'`,
            isUserOverridden: false
          };
        }
      }
    }

    // 4. Token Overlap & Fuzzy Similarity Search
    let bestMatch: OfficialAreaItem | null = null;
    let highestScore = 0;
    let matchReason = '';

    for (const item of catalog) {
      const itemTokens = tokenizeAreaString(item.name);
      
      // Token overlap check
      const commonTokens = rawTokens.filter(t => itemTokens.includes(t));
      const tokenScore = rawTokens.length > 0 ? (commonTokens.length / Math.max(rawTokens.length, itemTokens.length)) * 100 : 0;

      // Levenshtein similarity check
      const levScore = calculateLevenshteinSimilarity(upperRaw, item.name.toUpperCase());
      const compositeScore = Math.max(tokenScore, levScore);

      if (compositeScore > highestScore) {
        highestScore = compositeScore;
        bestMatch = item;
        matchReason = commonTokens.length > 0
          ? `Kemiripan kata kunci (${commonTokens.join(', ')}) dengan '${item.name}' (${Math.round(compositeScore)}%)`
          : `Kemiripan fonetik/teks ${Math.round(compositeScore)}% dengan '${item.name}'`;
      }
    }

    if (bestMatch && highestScore >= 70) {
      return {
        rawArea: cleanRaw,
        occurrenceCount: 1,
        matchedOfficialArea: bestMatch.name,
        matchedStoreId: bestMatch.storeId || bestMatch.id,
        confidence: 'high',
        confidenceScore: Math.round(highestScore),
        similarityReason: matchReason,
        isUserOverridden: false
      };
    }

    if (bestMatch && highestScore >= 45) {
      return {
        rawArea: cleanRaw,
        occurrenceCount: 1,
        matchedOfficialArea: bestMatch.name,
        matchedStoreId: bestMatch.storeId || bestMatch.id,
        confidence: 'suggested',
        confidenceScore: Math.round(highestScore),
        similarityReason: `${matchReason} - Disarankan untuk ditinjau`,
        isUserOverridden: false
      };
    }

    // 5. Unmapped (Not found in catalog)
    return {
      rawArea: cleanRaw,
      occurrenceCount: 1,
      matchedOfficialArea: null,
      matchedStoreId: null,
      confidence: 'unmapped',
      confidenceScore: Math.round(highestScore),
      similarityReason: 'Tidak ada kemiripan yang cukup dengan area jadwal yang ada. Siap dibuatkan area baru.',
      isUserOverridden: false
    };
  },

  /**
   * Memproses daftar area mentah secara massal dari spreadsheet
   */
  processRawAreaBatch(rawAreas: string[]): Record<string, AreaMappingEntry> {
    const catalog = this.getOfficialAreaList();
    const countMap: Record<string, number> = {};

    rawAreas.forEach(area => {
      const clean = (area || '').trim();
      if (!clean) return;
      countMap[clean] = (countMap[clean] || 0) + 1;
    });

    const result: Record<string, AreaMappingEntry> = {};

    Object.keys(countMap).forEach(rawArea => {
      const matched = this.matchRawArea(rawArea, catalog);
      matched.occurrenceCount = countMap[rawArea];
      result[rawArea] = matched;
    });

    return result;
  },

  /**
   * Membuat area baru secara cepat melalui dialog dan langsung menyimpannya ke database
   * (Menambahkan ke tabel stores di logisticsStore & catalog area jadwal)
   */
  quickCreateOfficialArea(payload: NewAreaPayload): { store: RetailStore; officialArea: OfficialAreaItem } {
    const cleanName = payload.name.trim().toUpperCase();
    const isInterIsland = payload.island !== 'Jawa';
    
    // Generate clean code if not provided
    const storeCode = payload.storeCode || ('ARE-' + cleanName.replace(/[^A-Z0-9]/g, '').substring(0, 4) + '-' + Math.floor(Math.random() * 90 + 10));

    // Create virtual RetailStore representation for schedule item mapping
    const newStore: RetailStore = {
      id: 'area-custom-' + Math.random().toString(36).substring(2, 8),
      storeCode,
      storeName: cleanName,
      island: payload.island,
      province: payload.island === 'Jawa' ? 'Jawa Timur' : (payload.island === 'Bali & Nusa Tenggara' ? 'Bali' : payload.island),
      city: payload.city || (isInterIsland ? 'Denpasar' : 'Banyuwangi'),
      address: payload.address || `Area Distribusi & Staging ${cleanName}, Koridor ${payload.routeCorridor || 'Reguler'}`,
      latitude: isInterIsland ? -8.6705 : -8.2192,
      longitude: isInterIsland ? 115.2126 : 114.3692,
      contactPerson: payload.contactPerson || 'PIC Logistik Area',
      phone: payload.phone || '0812-3456-7890',
      deliveryWindow: payload.deliveryWindow || '08:00 - 17:00',
      storeCategory: payload.category || (cleanName.includes('GROSIR') ? 'Distribution Hub' : 'Supermarket')
    };

    const officialItem: OfficialAreaItem = {
      id: newStore.id,
      name: cleanName,
      storeId: newStore.id,
      city: newStore.city,
      island: newStore.island,
      category: newStore.storeCategory,
      address: newStore.address,
      isInterIsland,
      source: 'custom_created'
    };

    // Save to persistent custom areas cache
    try {
      const existing = localStorage.getItem(STORAGE_KEY_CUSTOM_AREAS);
      const list: OfficialAreaItem[] = existing ? JSON.parse(existing) : [];
      if (!list.some(i => i.name.toUpperCase() === cleanName)) {
        list.push(officialItem);
        localStorage.setItem(STORAGE_KEY_CUSTOM_AREAS, JSON.stringify(list));
      }
    } catch {
      // ignore
    }

    logisticsStore.emitNotification(
      'schedule',
      '✨ Area Pengiriman Baru Ditambahkan',
      `Area resmi '${cleanName}' (${payload.city}) berhasil didaftarkan ke Jadwal Pengiriman & Muat.`,
      false
    );

    return { store: newStore, officialArea: officialItem };
  },

  /**
   * Simpan preferensi pemetaan pengguna agar dapat diingat pada impor berikutnya
   */
  saveUserMappingPreference(rawArea: string, targetOfficialArea: string): void {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_SAVED_MAPPINGS);
      const map: Record<string, string> = saved ? JSON.parse(saved) : {};
      map[rawArea] = targetOfficialArea;
      localStorage.setItem(STORAGE_KEY_SAVED_MAPPINGS, JSON.stringify(map));
    } catch {
      // ignore
    }
  }
};
