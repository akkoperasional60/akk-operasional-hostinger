import { logisticsStore } from './store';
import { RetailStore } from '../types';
import { sanitizeCoordinate } from '../components/GoogleSheetsStoreSyncModal';

export interface SyncLogEntry {
  id: string;
  timestamp: string;
  status: 'success' | 'error' | 'in_progress';
  totalStores: number;
  addedStores: number;
  updatedStores: number;
  message: string;
  sourceSheet: string;
}

export interface GoogleSheetsSyncConfig {
  isAutoSyncEnabled: boolean;
  autoSyncIntervalMinutes: number; // 1, 5, 15, 30, 60
  lastSyncTimestamp: string | null;
  sheetName: string;
  spreadsheetUrl: string;
  syncOnAppLaunch: boolean;
}

export interface CoordinateValidationResult {
  isValid: boolean;
  cleanLat: number;
  cleanLng: number;
  isLatCorrupted: boolean;
  isLngCorrupted: boolean;
  reason?: string;
}

export interface CorruptedStoreIssue {
  storeCode: string;
  storeName: string;
  rawLat: string | number;
  rawLng: string | number;
  cleanLat: number;
  cleanLng: number;
  reason: string;
}

/**
 * Robustly parses a single row string from Google Sheets or pasted text.
 * Correctly extracts store names (even with hyphens or numbers) and coordinates.
 */
export function parseStoreLine(rawLine: string, lineIndex: number): {
  no: number;
  storeCode: string;
  storeName: string;
  phone: string;
  address: string;
  rawLat: string;
  rawLng: string;
  latitude: number;
  longitude: number;
  city: string;
  island: RetailStore['island'];
  storeCategory: RetailStore['storeCategory'];
} | null {
  const line = rawLine.trim();
  if (!line) return null;

  const lineUpper = line.toUpperCase();
  if (
    lineUpper.startsWith('NO\t') ||
    lineUpper.startsWith('NO,') ||
    lineUpper.startsWith('NO ;') ||
    lineUpper.includes('HALAMAN') ||
    lineUpper.includes('PAGE') ||
    lineUpper.includes('NAMA TOKO') ||
    lineUpper.includes('NAMA PELANGGAN')
  ) {
    return null;
  }

  let tokens: string[] = [];
  if (line.includes('\t')) {
    tokens = line.split('\t').map(t => t.trim().replace(/^"|"$/g, ''));
  } else if (line.includes(';') && (line.match(/;/g) || []).length >= 2) {
    tokens = line.split(';').map(t => t.trim().replace(/^"|"$/g, ''));
  } else if (line.includes(',') && (line.match(/,/g) || []).length >= 2) {
    tokens = line.split(',').map(t => t.trim().replace(/^"|"$/g, ''));
  } else {
    tokens = line.split(/\s+/).map(t => t.trim().replace(/^"|"$/g, ''));
  }

  tokens = tokens.filter(t => t.length > 0);
  if (tokens.length < 2) return null;

  // Find longitude index: numeric string with at least 4 digits, starts with '11' or '1.' or contains 114, no letters
  let lngIdx = -1;
  for (let i = tokens.length - 1; i >= 0; i--) {
    const t = tokens[i];
    if (/[a-zA-Z]/.test(t)) continue;
    const digits = t.replace(/[^\d]/g, '');
    if (digits.length >= 4 && (digits.startsWith('11') || digits.startsWith('114') || digits.startsWith('113') || digits.startsWith('115') || digits.startsWith('112') || digits.startsWith('1'))) {
      lngIdx = i;
      break;
    }
  }

  // Find latitude index: numeric string with at least 3 digits, starts with '-' or starts with '8', no letters
  let latIdx = -1;
  for (let i = tokens.length - 1; i >= 0; i--) {
    if (i === lngIdx) continue;
    const t = tokens[i];
    if (/[a-zA-Z]/.test(t)) continue;
    const digits = t.replace(/[^\d]/g, '');
    if (digits.length >= 3 && (t.startsWith('-') || digits.startsWith('8'))) {
      latIdx = i;
      break;
    }
  }

  let rawLat = '-';
  let rawLng = '-';
  let storeName = '';
  let no = lineIndex + 1;

  if (latIdx !== -1 && lngIdx !== -1) {
    rawLat = tokens[latIdx];
    rawLng = tokens[lngIdx];

    let nameStartIdx = 0;
    const firstTok = tokens[0];
    if (/^\d+$/.test(firstTok)) {
      no = parseInt(firstTok, 10);
      nameStartIdx = 1;
    }

    const nameParts = tokens.filter((_, idx) => idx >= nameStartIdx && idx !== latIdx && idx !== lngIdx);
    storeName = nameParts.join(' ').trim();
  } else if (tokens.length >= 4) {
    if (/^\d+$/.test(tokens[0])) {
      no = parseInt(tokens[0], 10);
      storeName = tokens[1];
      rawLat = tokens[2];
      rawLng = tokens[3];
    } else {
      storeName = tokens[0];
      rawLat = tokens[1];
      rawLng = tokens[2];
    }
  } else if (tokens.length === 3) {
    storeName = tokens[0];
    rawLat = tokens[1];
    rawLng = tokens[2];
  } else {
    storeName = tokens[0];
  }

  if (!storeName) {
    storeName = `Toko Retail ${no}`;
  }

  const cleanLat = sanitizeCoordinate(rawLat, false);
  const cleanLng = sanitizeCoordinate(rawLng, true);

  return {
    no,
    storeCode: `RET-BWI-${no.toString().padStart(3, '0')}`,
    storeName,
    phone: '-',
    address: 'Kabupaten Banyuwangi',
    rawLat,
    rawLng,
    latitude: cleanLat,
    longitude: cleanLng,
    city: 'Banyuwangi',
    island: 'Jawa',
    storeCategory: 'Supermarket'
  };
}
export function validateCoordinateData(
  rawLat: string | number | undefined,
  rawLng: string | number | undefined
): CoordinateValidationResult {
  const issues: string[] = [];
  let isLatCorrupted = false;
  let isLngCorrupted = false;

  const strLat = String(rawLat ?? '').trim();
  const strLng = String(rawLng ?? '').trim();

  // 1. Check for missing or placeholder values
  if (!strLat || strLat === '-' || strLat === 'null' || strLat === 'undefined' || strLat === 'N/A' || strLat === '0') {
    isLatCorrupted = true;
    issues.push('Latitude kosong atau bernilai nol');
  }

  if (!strLng || strLng === '-' || strLng === 'null' || strLng === 'undefined' || strLng === 'N/A' || strLng === '0') {
    isLngCorrupted = true;
    issues.push('Longitude kosong atau bernilai nol');
  }

  // 2. Sanitize coordinates
  const cleanLat = sanitizeCoordinate(strLat || '-8.3645', false);
  const cleanLng = sanitizeCoordinate(strLng || '114.1529', true);

  // 3. Check for NaN or non-finite numbers
  if (isNaN(cleanLat) || !isFinite(cleanLat)) {
    isLatCorrupted = true;
    issues.push(`Format Latitude cacat ("${strLat}")`);
  }

  if (isNaN(cleanLng) || !isFinite(cleanLng)) {
    isLngCorrupted = true;
    issues.push(`Format Longitude cacat ("${strLng}")`);
  }

  // 4. Check zero exact coordinate - removed, handled by broader bounds check
  /*
  if (cleanLat === 0) {
    isLatCorrupted = true;
    issues.push('Latitude bernilai 0.0000');
  }
  if (cleanLng === 0) {
    isLngCorrupted = true;
    issues.push('Longitude bernilai 0.0000');
  }
  */

  // 5. Geographic bounds check for Indonesia / East Java:
  // Latitude for Indonesia is strictly Southern/Equatorial (-11.5° to +6.0°).
  // For Banyuwangi & East Java region: expected roughly -7.5° to -9.0°.
  // If positive (> 0.2°) or below -12.0°, it indicates corrupt data.
  if (cleanLat > 0.2 || cleanLat < -12.0) {
    isLatCorrupted = true;
    issues.push(`Latitude [${cleanLat.toFixed(5)}] di luar batas geografis Indonesia`);
  }

  // Longitude for Indonesia is strictly between 95.0° and 142.0°.
  // For Banyuwangi / East Java: expected roughly 111.0° to 115.5°.
  if (cleanLng < 95.0 || cleanLng > 143.0) {
    isLngCorrupted = true;
    issues.push(`Longitude [${cleanLng.toFixed(5)}] di luar batas geografis Indonesia`);
  }

  const isValid = !isLatCorrupted && !isLngCorrupted && issues.length === 0;

  return {
    isValid,
    cleanLat: isNaN(cleanLat) || !isFinite(cleanLat) || cleanLat === 0 ? -8.3645 : cleanLat,
    cleanLng: isNaN(cleanLng) || !isFinite(cleanLng) || cleanLng === 0 ? 114.1529 : cleanLng,
    isLatCorrupted,
    isLngCorrupted,
    reason: issues.length > 0 ? issues.join(', ') : undefined
  };
}

const SYNC_CONFIG_STORAGE_KEY = 'akk_gsheets_sync_config_v1';
const SYNC_LOGS_STORAGE_KEY = 'akk_gsheets_sync_logs_v1';

export function toGoogleSheetsCsvUrl(rawUrl: string): string {
  const trimmed = (rawUrl || '').trim();
  if (!trimmed) return '';
  if (trimmed.includes('/export?format=csv') || trimmed.includes('/gviz/tq')) {
    return trimmed;
  }
  const idMatch = trimmed.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  const gidMatch = trimmed.match(/[?&#]gid=([0-9]+)/);
  if (idMatch && idMatch[1]) {
    return `https://docs.google.com/spreadsheets/d/${idMatch[1]}/export?format=csv${gidMatch ? `&gid=${gidMatch[1]}` : ''}`;
  }
  return trimmed
    .replace('/edit#gid=', '/export?format=csv&gid=')
    .replace('/edit?usp=sharing', '/export?format=csv')
    .replace(/\/edit.*$/, '/export?format=csv');
}

class GoogleSheetsSyncService {
  private config: GoogleSheetsSyncConfig;
  private syncLogs: SyncLogEntry[] = [];
  private timerId: NodeJS.Timeout | null = null;
  private listeners: Array<() => void> = [];
  private latestCorruptedStores: CorruptedStoreIssue[] = [];
  private isSyncing: boolean = false;

  constructor() {
    this.config = this.loadConfig();
    this.syncLogs = this.loadLogs();

    // Auto-sync on launch only if explicitly enabled, a valid URL is configured, and user session is active
    const currentStores = logisticsStore.getStores();
    if (
      this.config.syncOnAppLaunch &&
      this.config.spreadsheetUrl.trim() &&
      logisticsStore.isAuthenticated() &&
      currentStores.length === 0
    ) {
      setTimeout(() => {
        this.syncNow('Sinkronisasi Otomatis Sheet DATA FIX').catch(err => {
          console.warn('[BatchSync] Auto-sync on launch skipped:', err?.message || err);
        });
      }, 300);
    }

    this.restartAutoSyncTimer();
  }

  private loadConfig(): GoogleSheetsSyncConfig {
    try {
      const saved = localStorage.getItem(SYNC_CONFIG_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        const savedUrl = String(parsed.spreadsheetUrl || '').trim();
        // Clean up legacy sample student spreadsheet URL if still cached in browser localStorage
        const isLegacyDemoUrl = savedUrl.includes('1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms');
        if (isLegacyDemoUrl) {
          const cleaned: GoogleSheetsSyncConfig = {
            isAutoSyncEnabled: false,
            autoSyncIntervalMinutes: Number(parsed.autoSyncIntervalMinutes) || 60,
            lastSyncTimestamp: null,
            sheetName: parsed.sheetName || 'DATA FIX',
            spreadsheetUrl: '',
            syncOnAppLaunch: false
          };
          try {
            localStorage.setItem(SYNC_CONFIG_STORAGE_KEY, JSON.stringify(cleaned));
          } catch {
            // ignore storage errors
          }
          return cleaned;
        }
        return {
          isAutoSyncEnabled: Boolean(parsed.isAutoSyncEnabled && savedUrl),
          autoSyncIntervalMinutes: Number(parsed.autoSyncIntervalMinutes) || 60,
          lastSyncTimestamp: parsed.lastSyncTimestamp || null,
          sheetName: parsed.sheetName || 'DATA FIX',
          spreadsheetUrl: savedUrl,
          syncOnAppLaunch: Boolean(parsed.syncOnAppLaunch && savedUrl)
        };
      }
    } catch (e) {
      console.warn('Failed to load gsheets sync config:', e);
    }
    return {
      isAutoSyncEnabled: false,
      autoSyncIntervalMinutes: 60,
      lastSyncTimestamp: null,
      sheetName: 'DATA FIX',
      spreadsheetUrl: '',
      syncOnAppLaunch: false
    };
  }

  private saveConfig() {
    try {
      localStorage.setItem(SYNC_CONFIG_STORAGE_KEY, JSON.stringify(this.config));
    } catch (e) {
      console.warn('Failed to save gsheets sync config:', e);
    }
    this.notify();
  }

  private loadLogs(): SyncLogEntry[] {
    try {
      const saved = localStorage.getItem(SYNC_LOGS_STORAGE_KEY);
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.warn('Failed to load sync logs:', e);
    }
    return [];
  }

  private saveLogs() {
    try {
      localStorage.setItem(SYNC_LOGS_STORAGE_KEY, JSON.stringify(this.syncLogs.slice(0, 50)));
    } catch (e) {
      console.warn('Failed to save sync logs:', e);
    }
    this.notify();
  }

  private notify() {
    this.listeners.forEach(cb => cb());
  }

  public subscribe(listener: () => void): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  public getConfig(): GoogleSheetsSyncConfig {
    return { ...this.config };
  }

  public getSyncLogs(): SyncLogEntry[] {
    return [...this.syncLogs];
  }

  public getCorruptedStores(): CorruptedStoreIssue[] {
    return [...this.latestCorruptedStores];
  }

  public updateConfig(newConfig: Partial<GoogleSheetsSyncConfig>) {
    this.config = { ...this.config, ...newConfig };
    this.saveConfig();
    this.restartAutoSyncTimer();
  }

  public restartAutoSyncTimer() {
    if (this.timerId) {
      clearInterval(this.timerId);
      this.timerId = null;
    }

    if (this.config.isAutoSyncEnabled && this.config.spreadsheetUrl.trim()) {
      const ms = Math.max(1, this.config.autoSyncIntervalMinutes) * 60 * 1000;
      this.timerId = setInterval(() => {
        if (!this.config.spreadsheetUrl.trim() || !logisticsStore.isAuthenticated()) return;
        this.syncNow('Siklus Otomatis Latar Belakang').catch(err => {
          console.warn('[BatchSync] Background sync skipped:', err?.message || err);
        });
      }, ms);
    }
  }

  /**
   * Triggers a simulated corrupted coordinate notification so user and QA can inspect
   * dashboard toast alerts and badge reactions immediately.
   */
  public testCorruptedCoordinateNotification(simulateCount: number = 2): void {
    const mockCorrupted: CorruptedStoreIssue[] = [
      {
        storeCode: 'RET-TEST-01',
        storeName: 'TOKO UJI KOORDINAT CORRUPT',
        rawLat: 'CORRUPTED_LAT_NaN',
        rawLng: '114.156',
        cleanLat: -8.3645,
        cleanLng: 114.1529,
        reason: 'Format Latitude cacat ("CORRUPTED_LAT_NaN")'
      },
      {
        storeCode: 'RET-TEST-02',
        storeName: 'OUTLET RAW NOL & DILUAR BATAS',
        rawLat: '0.0000',
        rawLng: '999.999',
        cleanLat: -8.3645,
        cleanLng: 114.1529,
        reason: 'Latitude bernilai 0.0000; Longitude [999.999] di luar batas geografis Indonesia'
      }
    ].slice(0, simulateCount);

    this.latestCorruptedStores = mockCorrupted;
    this.notify();

    logisticsStore.emitNotification(
      'sla_warning',
      `⚠️ Peringatan: ${mockCorrupted.length} Data Koordinat Rusak di Google Sheet`,
      `[UJI VALIDASI SISTEM] Terdeteksi data koordinat GPS rusak pada sheet '${this.config.sheetName}' untuk: ${mockCorrupted.map(m => `${m.storeName} (${m.storeCode})`).join(', ')}. Data ditandai 'Needs Correction'. Mohon segera periksa & perbaiki koordinat di spreadsheet Google Sheet.`,
      true,
      { corruptedStores: mockCorrupted, sheetName: this.config.sheetName, timestamp: new Date().toISOString() }
    );
  }

  public getIsSyncing(): boolean {
    return this.isSyncing;
  }

  public async syncNow(triggerSource: string = 'Manual Sync', forceClear: boolean = false): Promise<{
    total: number;
    added: number;
    updated: number;
    corruptedCount: number;
  }> {
    this.isSyncing = true;
    this.notify();
    console.log(`[BatchSync START] Initiating batched store sync (Source: ${triggerSource}, ForceClear: ${forceClear})...`);

    try {
      const rawSpreadsheetUrl = this.config.spreadsheetUrl.trim();
      if (!rawSpreadsheetUrl) {
        const msg = 'URL Google Sheets belum dikonfigurasi. Sinkronisasi dibatalkan agar sistem tidak memakai data contoh.';
        console.warn(`[BatchSync] ${msg}`);
        const emptyLog: SyncLogEntry = {
          id: 'log-' + Math.random().toString(36).substring(2, 8),
          timestamp: new Date().toISOString(),
          status: 'error',
          totalStores: 0,
          addedStores: 0,
          updatedStores: 0,
          message: msg,
          sourceSheet: this.config.sheetName
        };
        this.syncLogs = [emptyLog, ...this.syncLogs];
        this.saveLogs();
        return { total: 0, added: 0, updated: 0, corruptedCount: 0 };
      }

      // Clear local storage cache if forceClear is requested
      if (forceClear) {
        console.log('[BatchSync] Force clearing local records...');
        logisticsStore.setStores([]);
      }

      let storeRecords: any[] = []; // Initialize empty to fetch fresh data

      // Attempt online fetch if available, fallback smoothly if blocked by CORS or offline
      try {
        const csvUrl = toGoogleSheetsCsvUrl(rawSpreadsheetUrl);
        let response: Response | null = null;

        // 1. Try server-side proxy route first (bypasses browser CORS & network drops)
        try {
          const proxyUrl = `/api/proxy-sheet?url=${encodeURIComponent(csvUrl)}`;
          const controller = new AbortController();
          const timeoutId = setTimeout(() => {
            try { controller.abort(); } catch { /* ignore */ }
          }, 8000);

          try {
            const proxyRes = await fetch(proxyUrl, { signal: controller.signal });
            clearTimeout(timeoutId);
            if (proxyRes && proxyRes.ok) {
              response = proxyRes;
            }
          } catch {
            clearTimeout(timeoutId);
          }
        } catch {
          // Server proxy unavailable or timed out, attempt direct fetch
        }

        // 2. Fallback to direct fetch if proxy route wasn't available
        if (!response) {
          try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => {
              try { controller.abort(); } catch { /* ignore */ }
            }, 6000);

            try {
              const directRes = await fetch(csvUrl, { signal: controller.signal });
              clearTimeout(timeoutId);
              if (directRes && directRes.ok) {
                response = directRes;
              }
            } catch {
              clearTimeout(timeoutId);
            }
          } catch {
            // Fallback smoothly without unhandled errors
          }
        }

        if (response && response.ok) {
          const csvText = await response.text();
          const trimmedText = csvText.trim();
          const isHtmlResponse = trimmedText.startsWith('<!DOCTYPE') || trimmedText.toLowerCase().startsWith('<html');
          if (trimmedText && !isHtmlResponse) {
            const lines = trimmedText.split(/\r?\n/).filter(l => l.trim().length > 0);
            if (lines.length > 0) {
              const headerLower = lines[0].toLowerCase();
              const isSampleStudentDataset =
                headerLower.includes('student name') ||
                headerLower.includes('class level') ||
                headerLower.includes('extracurricular') ||
                headerLower.includes('major');

              if (!isSampleStudentDataset) {
                const parsed = lines
                  .map((line, idx) => parseStoreLine(line, idx))
                  .filter((s): s is NonNullable<typeof s> => !!s && !!s.storeName && !s.storeName.includes('Freshman'));

                if (parsed.length > 0) {
                  storeRecords = parsed;
                }
              }
            }
          }
        }
      } catch (error: any) {
        console.warn('[BatchSync] Google Sheet tidak dapat dibaca:', error?.message || error);
        storeRecords = [];
      }

      if (storeRecords.length === 0) {
        const emptyMsg = 'Tidak ada data toko valid yang berhasil dibaca dari Google Sheets. Tidak ada data contoh yang dimasukkan.';
        console.warn(`[BatchSync] ${emptyMsg}`);
        const errLog: SyncLogEntry = {
          id: 'log-' + Math.random().toString(36).substring(2, 8),
          timestamp: new Date().toISOString(),
          status: 'error',
          totalStores: 0,
          addedStores: 0,
          updatedStores: 0,
          message: emptyMsg,
          sourceSheet: this.config.sheetName
        };
        this.syncLogs = [errLog, ...this.syncLogs];
        this.saveLogs();
        return { total: 0, added: 0, updated: 0, corruptedCount: 0 };
      }


    console.log(`[BatchSync] Total records to process: ${storeRecords.length}. Processing in batches of 50 to prevent timeout...`);

    // 2. Process records in batches of 50 to avoid main thread timeout & ensure smooth UI rendering
    const BATCH_SIZE = 50;
    const corruptedStores: CorruptedStoreIssue[] = [];
    const newRetailStores: RetailStore[] = [];

    for (let i = 0; i < storeRecords.length; i += BATCH_SIZE) {
      const batch = storeRecords.slice(i, i + BATCH_SIZE);
      console.log(`[BatchSync] Processing batch ${Math.floor(i / BATCH_SIZE) + 1} (items ${i + 1} to ${Math.min(i + BATCH_SIZE, storeRecords.length)})`);

      for (let j = 0; j < batch.length; j++) {
        const p = batch[j];
        const idx = i + j;
        const valResult = validateCoordinateData(p.rawLat, p.rawLng);

        if (!valResult.isValid) {
          const issue: CorruptedStoreIssue = {
            storeCode: p.storeCode,
            storeName: p.storeName,
            rawLat: p.rawLat || '-',
            rawLng: p.rawLng || '-',
            cleanLat: valResult.cleanLat,
            cleanLng: valResult.cleanLng,
            reason: valResult.reason || 'Format koordinat GPS tidak valid'
          };
          corruptedStores.push(issue);
        }

        newRetailStores.push({
          id: `str-fix-${(idx + 1).toString().padStart(3, '0')}`,
          storeCode: p.storeCode,
          storeName: p.storeName,
          island: p.island || 'Jawa',
          province: 'Jawa Timur',
          city: p.city || 'Banyuwangi',
          address: p.address,
          latitude: valResult.isValid && p.latitude && !isNaN(p.latitude) && p.latitude !== 0 ? p.latitude : (valResult.isValid ? valResult.cleanLat : 0),
          longitude: valResult.isValid && p.longitude && !isNaN(p.longitude) && p.longitude !== 0 ? p.longitude : (valResult.isValid ? valResult.cleanLng : 0),
          contactPerson: 'Penanggung Jawab Toko',
          phone: p.phone && p.phone !== '-' ? p.phone : '-',
          deliveryWindow: '08:00 - 16:00',
          storeCategory: valResult.isValid ? (p.storeCategory || 'Supermarket') : 'Needs Correction'
        });
      }

      // Yield event loop thread between batches to ensure smooth UI responsiveness
      if (i + BATCH_SIZE < storeRecords.length) {
        await new Promise(resolve => setTimeout(resolve, 25));
      }
    }

    if (corruptedStores.length > 0) {
      console.info(`[Data Diagnostic Summary] ${corruptedStores.length} stores require coordinate verification out of ${storeRecords.length} total.`);
    }

    this.latestCorruptedStores = corruptedStores;

    // 3. Atomically replace stores in logisticsStore
    logisticsStore.setStores(newRetailStores);

    const nowIso = new Date().toISOString();
    this.config.lastSyncTimestamp = nowIso;
    this.saveConfig();

    console.log(`[BatchSync COMPLETE] Successfully synced all ${newRetailStores.length} stores in batches.`);

    // 4. Trigger notifications based on coordinate validation results
    if (corruptedStores.length > 0) {
      const sampleNames = corruptedStores
        .slice(0, 3)
        .map(s => `${s.storeName} (${s.storeCode})`)
        .join(', ');
      const moreNote = corruptedStores.length > 3 ? ` dan ${corruptedStores.length - 3} toko lainnya` : '';

      // Direct critical warning notification to dashboard
      logisticsStore.emitNotification(
        'sla_warning',
        `⚠️ Peringatan: ${corruptedStores.length} Data Koordinat Rusak di Google Sheet`,
        `Terdeteksi data koordinat GPS rusak pada sheet '${this.config.sheetName}' untuk: ${sampleNames}${moreNote}. Data otomatis ditandai 'Needs Correction' di sistem. Mohon periksa & perbaiki koordinat di spreadsheet Google Sheet.`,
        true, // URGENT flag: prompts audio chime and persistent toast alert in dashboard
        { corruptedStores, sheetName: this.config.sheetName, timestamp: nowIso }
      );

      const warnLog: SyncLogEntry = {
        id: 'log-' + Math.random().toString(36).substring(2, 8),
        timestamp: nowIso,
        status: 'error',
        totalStores: newRetailStores.length,
        addedStores: newRetailStores.length,
        updatedStores: 0,
        message: `Peringatan: ${corruptedStores.length} koordinat gagal terparsing pada sheet '${this.config.sheetName}' dan ditandai 'Needs Correction'.`,
        sourceSheet: this.config.sheetName
      };

      this.syncLogs = [warnLog, ...this.syncLogs];
    } else {
      // All coordinates valid
      logisticsStore.emitNotification(
        'schedule',
        `Sinkronisasi Google Sheets ('${this.config.sheetName}')`,
        `Validasi sukses: Seluruh ${newRetailStores.length} outlet memiliki koordinat GPS valid dan terpetakan (${triggerSource}).`,
        false
      );

      const successLog: SyncLogEntry = {
        id: 'log-' + Math.random().toString(36).substring(2, 8),
        timestamp: nowIso,
        status: 'success',
        totalStores: newRetailStores.length,
        addedStores: newRetailStores.length,
        updatedStores: 0,
        message: `Sinkronisasi '${this.config.sheetName}' berhasil: ${newRetailStores.length} outlet terdaftar & dipetakan tanpa galat koordinat.`,
        sourceSheet: this.config.sheetName
      };

      this.syncLogs = [successLog, ...this.syncLogs];
    }

    this.saveLogs();

    return {
      total: newRetailStores.length,
      added: newRetailStores.length,
      updated: 0,
      corruptedCount: corruptedStores.length
    };
    } finally {
      this.isSyncing = false;
      this.notify();
    }
  }

  public importCsvData(csvText: string): { total: number; corruptedCount: number; stores: RetailStore[] } {
    const lines = csvText.split('\n').filter(l => l.trim().length > 0);
    const parsedRecords = lines
      .map((line, idx) => parseStoreLine(line, idx))
      .filter((s): s is NonNullable<typeof s> => !!s && !!s.storeName && !s.storeName.includes('Freshman'));

    const recordsToUse = parsedRecords;
    const corruptedStores: CorruptedStoreIssue[] = [];
    const newRetailStores: RetailStore[] = recordsToUse.map((p, idx) => {
      const valResult = validateCoordinateData(p.rawLat, p.rawLng);
      if (!valResult.isValid) {
        corruptedStores.push({
          storeCode: p.storeCode,
          storeName: p.storeName,
          rawLat: p.rawLat,
          rawLng: p.rawLng,
          cleanLat: valResult.cleanLat,
          cleanLng: valResult.cleanLng,
          reason: valResult.reason || 'Koordinat tidak valid'
        });
      }
      return {
        id: `str-fix-${(idx + 1).toString().padStart(3, '0')}`,
        storeCode: p.storeCode,
        storeName: p.storeName,
        island: 'Jawa',
        province: 'Jawa Timur',
        city: p.city || 'Banyuwangi',
        address: p.address,
        latitude: valResult.isValid && p.latitude && !isNaN(p.latitude) && p.latitude !== 0 ? p.latitude : (valResult.isValid ? valResult.cleanLat : 0),
        longitude: valResult.isValid && p.longitude && !isNaN(p.longitude) && p.longitude !== 0 ? p.longitude : (valResult.isValid ? valResult.cleanLng : 0),
        contactPerson: 'PIC Toko',
        phone: p.phone && p.phone !== '-' ? p.phone : '-',
        deliveryWindow: '08:00 - 16:00',
        storeCategory: valResult.isValid ? p.storeCategory || 'Supermarket' : 'Needs Correction'
      };
    });

    this.latestCorruptedStores = corruptedStores;
    logisticsStore.setStores(newRetailStores);
    this.config.lastSyncTimestamp = new Date().toISOString();
    this.saveConfig();

    const successLog: SyncLogEntry = {
      id: 'log-' + Math.random().toString(36).substring(2, 8),
      timestamp: this.config.lastSyncTimestamp,
      status: 'success',
      totalStores: newRetailStores.length,
      addedStores: newRetailStores.length,
      updatedStores: 0,
      message: `Impor CSV langsung berhasil: ${newRetailStores.length} outlet tersinkronisasi dari data tempelan spreadsheet.`,
      sourceSheet: this.config.sheetName
    };
    this.syncLogs = [successLog, ...this.syncLogs];
    this.saveLogs();

    return { total: newRetailStores.length, corruptedCount: corruptedStores.length, stores: newRetailStores };
  }
}

export const googleSheetsSyncService = new GoogleSheetsSyncService();
