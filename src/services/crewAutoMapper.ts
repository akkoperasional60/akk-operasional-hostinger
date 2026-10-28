import { logisticsStore } from './store';
import { Crew } from '../types';

export type CrewMatchConfidence = 'exact' | 'high' | 'suggested' | 'unmapped';

export interface OfficialCrewItem {
  id: string;
  name: string;
  role: 'Driver' | 'Helper' | 'Driver Cadangan' | 'Staff Logistik';
  licenseType: string;
  phone: string;
  tripsCompleted: number;
  rating: number;
  isAvailable: boolean;
  source: 'database_crew' | 'custom_registered';
}

export interface CrewMappingEntry {
  rawName: string;
  roleHint?: 'Driver' | 'Helper';
  occurrenceCount: number;
  matchedCrewId: string | null;
  matchedCrewName: string | null;
  matchedCrewRole: string | null;
  confidence: CrewMatchConfidence;
  confidenceScore: number;
  similarityReason: string;
  isUserOverridden: boolean;
  isNewlyCreated?: boolean;
}

export interface NewCrewPayload {
  name: string;
  role: 'Driver' | 'Helper' | 'Driver Cadangan';
  licenseType: 'B1' | 'B2' | 'B2 Umum' | 'A' | 'C' | 'Non-SIM';
  phone?: string;
  emergencyContact?: string;
}

const STORAGE_KEY_SAVED_CREW_MAPPINGS = 'akk_saved_spreadsheet_crew_mappings_v1';

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
 * Clean & tokenize raw crew string
 */
function tokenizeCrewString(text: string): string[] {
  return text
    .toUpperCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(token => token.length > 1 && !['PAK', 'BP', 'BAPAK', 'MAS', 'DRIVER', 'SUPIR', 'HELPER', 'KERNET', 'KRU', 'PENGEMUDI'].includes(token));
}

export const crewAutoMapper = {
  /**
   * Mengambil semua daftar kru resmi aktif dari logisticsStore
   */
  getOfficialCrewList(): OfficialCrewItem[] {
    const crews = logisticsStore.getCrews();
    return crews.map(c => ({
      id: c.id,
      name: c.name,
      role: c.role.includes('Helper') ? 'Helper' : (c.role.includes('Cadangan') ? 'Driver Cadangan' : 'Driver'),
      licenseType: c.licenseType,
      phone: c.phone,
      tripsCompleted: c.tripsCompleted,
      rating: c.rating,
      isAvailable: c.status === 'available',
      source: 'database_crew'
    }));
  },

  /**
   * Deteksi Cerdas: Menyamakan satu nama kru mentah dari spreadsheet
   * dengan database kru resmi di AKK (Driver / Helper)
   */
  matchRawCrew(
    rawCrewName: string, 
    roleHint?: 'Driver' | 'Helper',
    officialList?: OfficialCrewItem[]
  ): CrewMappingEntry {
    const catalog = officialList || this.getOfficialCrewList();
    const cleanRaw = (rawCrewName || '').trim();
    const upperRaw = cleanRaw.toUpperCase();

    // Check user-saved custom mapping dictionary first
    try {
      const savedMappings = localStorage.getItem(STORAGE_KEY_SAVED_CREW_MAPPINGS);
      if (savedMappings) {
        const map = JSON.parse(savedMappings) as Record<string, string>;
        if (map[cleanRaw] || map[upperRaw]) {
          const targetName = map[cleanRaw] || map[upperRaw];
          const found = catalog.find(c => c.name.toUpperCase() === targetName.toUpperCase());
          if (found) {
            return {
              rawName: cleanRaw,
              roleHint,
              occurrenceCount: 1,
              matchedCrewId: found.id,
              matchedCrewName: found.name,
              matchedCrewRole: found.role,
              confidence: 'exact',
              confidenceScore: 100,
              similarityReason: 'Dicocokkan berdasarkan riwayat pemetaan kru sebelumnya',
              isUserOverridden: true
            };
          }
        }
      }
    } catch {
      // ignore
    }

    // 1. Exact Name Match (100% Identical, case-insensitive)
    const exactMatch = catalog.find(item => item.name.toUpperCase() === upperRaw);
    if (exactMatch) {
      return {
        rawName: cleanRaw,
        roleHint,
        occurrenceCount: 1,
        matchedCrewId: exactMatch.id,
        matchedCrewName: exactMatch.name,
        matchedCrewRole: exactMatch.role,
        confidence: 'exact',
        confidenceScore: 100,
        similarityReason: 'Nama kru 100% identik dengan database resmi AKK',
        isUserOverridden: false
      };
    }

    // 2. First Name / Single-word match (e.g. "SUPRI" matches "Supriyanto" or "Supri")
    const rawTokens = tokenizeCrewString(cleanRaw);
    if (rawTokens.length > 0) {
      const primaryToken = rawTokens[0];
      const startMatch = catalog.find(item => {
        const itemUpper = item.name.toUpperCase();
        return itemUpper.startsWith(primaryToken) || itemUpper.includes(primaryToken);
      });
      if (startMatch) {
        const score = calculateLevenshteinSimilarity(upperRaw, startMatch.name.toUpperCase());
        const confidence = score >= 70 ? 'high' : 'suggested';
        return {
          rawName: cleanRaw,
          roleHint,
          occurrenceCount: 1,
          matchedCrewId: startMatch.id,
          matchedCrewName: startMatch.name,
          matchedCrewRole: startMatch.role,
          confidence,
          confidenceScore: Math.max(score, 85),
          similarityReason: `Kecocokan nama panggilan '${primaryToken}' dengan database '${startMatch.name}' (${startMatch.role})`,
          isUserOverridden: false
        };
      }
    }

    // 3. Fuzzy Similarity Search
    let bestMatch: OfficialCrewItem | null = null;
    let highestScore = 0;
    let matchReason = '';

    for (const item of catalog) {
      const itemTokens = tokenizeCrewString(item.name);
      
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
          ? `Kemiripan kata (${commonTokens.join(', ')}) dengan '${item.name}' (${Math.round(compositeScore)}%)`
          : `Kemiripan fonetik/teks ${Math.round(compositeScore)}% dengan '${item.name}'`;
      }
    }

    if (bestMatch && highestScore >= 70) {
      return {
        rawName: cleanRaw,
        roleHint,
        occurrenceCount: 1,
        matchedCrewId: bestMatch.id,
        matchedCrewName: bestMatch.name,
        matchedCrewRole: bestMatch.role,
        confidence: 'high',
        confidenceScore: Math.round(highestScore),
        similarityReason: matchReason,
        isUserOverridden: false
      };
    }

    if (bestMatch && highestScore >= 45) {
      return {
        rawName: cleanRaw,
        roleHint,
        occurrenceCount: 1,
        matchedCrewId: bestMatch.id,
        matchedCrewName: bestMatch.name,
        matchedCrewRole: bestMatch.role,
        confidence: 'suggested',
        confidenceScore: Math.round(highestScore),
        similarityReason: `${matchReason} - Disarankan untuk ditinjau`,
        isUserOverridden: false
      };
    }

    return {
      rawName: cleanRaw,
      roleHint,
      occurrenceCount: 1,
      matchedCrewId: null,
      matchedCrewName: null,
      matchedCrewRole: null,
      confidence: 'unmapped',
      confidenceScore: 0,
      similarityReason: 'Nama kru belum terdaftar di database kru resmi AKK',
      isUserOverridden: false
    };
  },

  /**
   * Memproses daftar kumpulan kru dari spreadsheet
   */
  processRawCrewBatch(
    items: Array<{ name: string; roleHint?: 'Driver' | 'Helper' }>
  ): Record<string, CrewMappingEntry> {
    const officialList = this.getOfficialCrewList();
    const map: Record<string, CrewMappingEntry> = {};

    items.forEach(item => {
      const cleanName = (item.name || '').trim();
      if (!cleanName || cleanName === '-' || cleanName === '0' || cleanName.toUpperCase() === 'N/A') return;

      if (map[cleanName]) {
        map[cleanName].occurrenceCount += 1;
      } else {
        map[cleanName] = this.matchRawCrew(cleanName, item.roleHint, officialList);
      }
    });

    return map;
  },

  /**
   * Menyimpan pemetaan preferensi kru pengguna ke localStorage
   */
  saveMappingPreference(rawName: string, targetCrewName: string): void {
    try {
      const existing = localStorage.getItem(STORAGE_KEY_SAVED_CREW_MAPPINGS);
      const map: Record<string, string> = existing ? JSON.parse(existing) : {};
      map[rawName.trim()] = targetCrewName.trim();
      map[rawName.trim().toUpperCase()] = targetCrewName.trim();
      localStorage.setItem(STORAGE_KEY_SAVED_CREW_MAPPINGS, JSON.stringify(map));
    } catch {
      // ignore
    }
  },

  /**
   * Mendaftarkan Kru Baru langsung ke database AKK
   */
  registerNewCrew(payload: NewCrewPayload): OfficialCrewItem {
    const cleanName = payload.name.trim();
    const mappedRole = payload.role === 'Helper' ? 'Kernet / Helper' : (payload.role === 'Driver Cadangan' ? 'Driver Cadangan' : 'Driver Utama');
    const mappedLicense = payload.licenseType.includes('B2') ? 'SIM B2 Umum' : (payload.licenseType.includes('B1') ? 'SIM B1 Umum' : 'SIM A');

    const created = logisticsStore.addCrew({
      name: cleanName,
      role: mappedRole,
      licenseType: mappedLicense,
      licenseNumber: 'SIM-' + Math.floor(Math.random() * 900000 + 100000),
      phone: payload.phone || '0812-3456-7890',
      status: 'available'
    });

    // Save mapping preference
    this.saveMappingPreference(cleanName, cleanName);

    return {
      id: created.id,
      name: created.name,
      role: payload.role || 'Driver',
      licenseType: created.licenseType,
      phone: created.phone,
      tripsCompleted: created.tripsCompleted,
      rating: created.rating,
      isAvailable: true,
      source: 'custom_registered'
    };
  }
};
