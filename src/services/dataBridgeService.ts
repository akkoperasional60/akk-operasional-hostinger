import { googleSheetsApiService, ParsedSheetTrip } from './googleSheetsApiService';
import { logisticsStore } from './store';
import { RetailStore, Schedule, Fleet, Crew } from '../types';
import { standardizeAreaName } from '../utils/areaNormalizer';
import { scheduleImportValidator } from './scheduleImportValidator';

export interface DataBridgeConfig {
  isEnabled: boolean;
  intervalMinutes: number; // 5, 10, 15, 30, 60
  sheetTitle: string; // default: 'ALL'
  spreadsheetId: string;
  syncStores: boolean;
  syncSchedules: boolean;
  syncFleets: boolean;
  syncCrews: boolean;
  lastSyncTimestamp: string | null;
  lastSyncStatus: 'idle' | 'syncing' | 'success' | 'warning' | 'error';
  lastSyncMessage: string | null;
  serviceRoleKey?: string;
}

export interface DataBridgeSyncResult {
  success: boolean;
  timestamp: string;
  durationMs: number;
  storesUpserted: number;
  schedulesUpserted: number;
  fleetsUpserted: number;
  crewsUpserted: number;
  status: 'success' | 'warning' | 'error';
  message: string;
  rlsWarning?: boolean;
  tableMissingWarning?: boolean;
  details?: Record<string, any>;
}

export interface DataBridgeLogEntry {
  id: string;
  timestamp: string;
  status: 'success' | 'warning' | 'error';
  storesCount: number;
  schedulesCount: number;
  fleetsCount: number;
  crewsCount: number;
  message: string;
  triggerSource: string;
  durationMs: number;
}

const CONFIG_STORAGE_KEY = 'akk_databridge_config_v1';
const LOGS_STORAGE_KEY = 'akk_databridge_logs_v1';

class DataBridgeService {
  private config: DataBridgeConfig;
  private logs: DataBridgeLogEntry[] = [];
  private timerId: any = null;
  private isSyncing: boolean = false;
  private listeners: Set<() => void> = new Set();

  constructor() {
    this.config = this.loadConfig();
    this.logs = this.loadLogs();
    // Integrasi DataBridge ke Google Sheets telah dinonaktifkan
    this.config.isEnabled = false;
  }

  private loadConfig(): DataBridgeConfig {
    const defaultConfig: DataBridgeConfig = {
      isEnabled: false,
      intervalMinutes: 10,
      sheetTitle: 'ALL',
      spreadsheetId: '',
      syncStores: false,
      syncSchedules: false,
      syncFleets: false,
      syncCrews: false,
      lastSyncTimestamp: null,
      lastSyncStatus: 'idle',
      lastSyncMessage: null
    };

    try {
      if (typeof localStorage !== 'undefined') {
        const stored = localStorage.getItem(CONFIG_STORAGE_KEY);
        if (stored) {
          return { ...defaultConfig, ...JSON.parse(stored) };
        }
      }
    } catch (e) {
      console.warn('[DataBridge] Failed to load config from storage:', e);
    }
    return defaultConfig;
  }

  private saveConfigToStorage(): void {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(CONFIG_STORAGE_KEY, JSON.stringify(this.config));
      }
    } catch (e) {
      console.error('[DataBridge] Failed to persist config:', e);
    }
  }

  private loadLogs(): DataBridgeLogEntry[] {
    try {
      if (typeof localStorage !== 'undefined') {
        const stored = localStorage.getItem(LOGS_STORAGE_KEY);
        if (stored) {
          return JSON.parse(stored);
        }
      }
    } catch (e) {
      console.warn('[DataBridge] Failed to load logs from storage:', e);
    }
    return [];
  }

  private saveLogsToStorage(): void {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(LOGS_STORAGE_KEY, JSON.stringify(this.logs.slice(0, 50)));
      }
    } catch (e) {
      console.error('[DataBridge] Failed to persist logs:', e);
    }
  }

  public notifyListeners(): void {
    this.listeners.forEach(cb => {
      try {
        cb();
      } catch (err) {
        console.error('[DataBridge] Listener error:', err);
      }
    });
  }

  public subscribe(cb: () => void): () => void {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  }

  public getConfig(): DataBridgeConfig {
    return { ...this.config };
  }

  public updateConfig(partial: Partial<DataBridgeConfig>): void {
    const wasEnabled = this.config.isEnabled;
    const oldInterval = this.config.intervalMinutes;

    this.config = { ...this.config, ...partial };
    this.saveConfigToStorage();

    if (this.config.isEnabled && (!wasEnabled || this.config.intervalMinutes !== oldInterval)) {
      this.startPeriodicSync(this.config.intervalMinutes);
    } else if (!this.config.isEnabled && wasEnabled) {
      this.stopPeriodicSync();
    }

    this.notifyListeners();
  }

  public getLogs(): DataBridgeLogEntry[] {
    return [...this.logs];
  }

  public clearLogs(): void {
    this.logs = [];
    this.saveLogsToStorage();
    this.notifyListeners();
  }

  public isPeriodicSyncActive(): boolean {
    return this.timerId !== null && this.config.isEnabled;
  }

  public isBusy(): boolean {
    return this.isSyncing;
  }

  /**
   * Start periodic timer for automated background synchronization
   */
  public startPeriodicSync(intervalMinutes?: number): void {
    this.stopPeriodicSync();

    const interval = Math.max(1, intervalMinutes || this.config.intervalMinutes || 10);
    this.config.intervalMinutes = interval;
    this.config.isEnabled = true;
    this.saveConfigToStorage();

    const intervalMs = interval * 60 * 1000;
    console.log(`[DataBridge] Starting periodic sync every ${interval} minutes (${intervalMs}ms)...`);

    this.timerId = setInterval(() => {
      console.log('[DataBridge] Triggering automated periodic sync cycle...');
      this.syncNow(`Periodic (${interval}m)`).catch(err => {
        console.error('[DataBridge] Scheduled periodic sync error:', err);
      });
    }, intervalMs);

    this.notifyListeners();
  }

  /**
   * Stop automated periodic timer
   */
  public stopPeriodicSync(): void {
    if (this.timerId) {
      clearInterval(this.timerId);
      this.timerId = null;
      console.log('[DataBridge] Stopped periodic sync timer.');
    }
    this.config.isEnabled = false;
    this.saveConfigToStorage();
    this.notifyListeners();
  }

  /**
   * Core Engine: Pull from Google Sheets API and upsert into Hostinger MySQL through same-origin APIs
   */
  public async syncNow(triggerSource: string = 'Manual'): Promise<DataBridgeSyncResult> {
    if (this.isSyncing) {
      return {
        success: false,
        timestamp: new Date().toISOString(),
        durationMs: 0,
        storesUpserted: 0,
        schedulesUpserted: 0,
        fleetsUpserted: 0,
        crewsUpserted: 0,
        status: 'warning',
        message: 'Sinkronisasi DataBridge sedang berjalan. Silakan tunggu beberapa saat.'
      };
    }

    this.isSyncing = true;
    const startTime = performance.now();
    this.config.lastSyncStatus = 'syncing';
    this.config.lastSyncMessage = `Sedang menyinkronkan Google Sheets & Hostinger MySQL (${triggerSource})...`;
    this.saveConfigToStorage();
    this.notifyListeners();

    const requestJson = async (url: string, init?: RequestInit): Promise<any> => {
      const response = await fetch(url, init);
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data?.error || `HTTP ${response.status}`);
      return data;
    };

    try {
      // Optional Google Sheets pull is retained to refresh the local operational cache.
      const gsheetsConf = googleSheetsApiService.getConfig();
      let sheetId = this.config.spreadsheetId || gsheetsConf.spreadsheetId;
      if (!sheetId && gsheetsConf.spreadsheetUrl) {
        sheetId = googleSheetsApiService.extractSpreadsheetId(gsheetsConf.spreadsheetUrl);
      }
      if (sheetId) {
        try {
          const sheetTitle = this.config.sheetTitle || gsheetsConf.selectedSheetTitle || 'ALL';
          const rawRows = await googleSheetsApiService.getSheetValues(sheetId, `${sheetTitle}!A:Z`);
          if (rawRows?.length) {
            const parsed: ParsedSheetTrip[] = googleSheetsApiService.parseScheduleRows(rawRows);
            console.log(`[DataBridge] Pulled ${parsed.length} parsed trips from Google Sheet "${sheetTitle}".`);
          }
        } catch (fetchErr: any) {
          console.warn('[DataBridge] Google Sheets pull notice:', fetchErr?.message || fetchErr);
        }
      }

      const localSchedules = logisticsStore.getSchedules();
      const localStores = logisticsStore.getStores();
      const localFleets = logisticsStore.getFleets();
      const localCrews = logisticsStore.getCrews();

      let storesUpserted = 0;
      let fleetsUpserted = 0;
      let crewsUpserted = 0;
      let schedulesUpserted = 0;

      if (this.config.syncFleets) {
        for (const fleet of localFleets.filter(f => !(f.plateNumber || '').trim().toUpperCase().endsWith('AKK'))) {
          await requestJson('/api/fleets', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(fleet)
          });
          fleetsUpserted++;
        }
      }

      if (this.config.syncCrews) {
        for (const crew of localCrews) {
          await requestJson('/api/crews', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(crew)
          });
          crewsUpserted++;
        }
      }

      if (this.config.syncStores) {
        for (const store of localStores) {
          await requestJson('/api/stores', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(store)
          });
          storesUpserted++;
        }
      }

      if (this.config.syncSchedules) {
        await requestJson('/api/schedules/persist', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            schedules: localSchedules,
            weeks: [],
            source: `databridge:${triggerSource}`
          })
        });
        schedulesUpserted = localSchedules.length;
      }

      const durationMs = Math.round(performance.now() - startTime);
      const timestampIso = new Date().toISOString();
      const message = `Sinkronisasi DataBridge berhasil (${durationMs}ms): ${schedulesUpserted} jadwal, ${storesUpserted} toko, ${fleetsUpserted} armada, ${crewsUpserted} kru tersimpan di Hostinger MySQL.`;

      this.config.lastSyncTimestamp = timestampIso;
      this.config.lastSyncStatus = 'success';
      this.config.lastSyncMessage = message;
      this.saveConfigToStorage();

      const logEntry: DataBridgeLogEntry = {
        id: `db-log-${Date.now()}`,
        timestamp: timestampIso,
        status: 'success',
        storesCount: storesUpserted,
        schedulesCount: schedulesUpserted,
        fleetsCount: fleetsUpserted,
        crewsCount: crewsUpserted,
        message,
        triggerSource,
        durationMs
      };
      this.logs = [logEntry, ...this.logs.slice(0, 49)];
      this.saveLogsToStorage();

      try {
        await requestJson('/api/databridge/log', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...logEntry, sheetName: this.config.sheetTitle || 'ALL' })
        });
      } catch (logErr) {
        console.warn('[DataBridge] Remote audit log notice:', logErr);
      }

      this.isSyncing = false;
      this.notifyListeners();
      return {
        success: true,
        timestamp: timestampIso,
        durationMs,
        storesUpserted,
        schedulesUpserted,
        fleetsUpserted,
        crewsUpserted,
        status: 'success',
        message,
        rlsWarning: false,
        tableMissingWarning: false
      };
    } catch (err: any) {
      const durationMs = Math.round(performance.now() - startTime);
      const timestampIso = new Date().toISOString();
      const errMsg = err?.message || 'Terjadi kesalahan saat sinkronisasi DataBridge ke Hostinger MySQL.';
      this.config.lastSyncTimestamp = timestampIso;
      this.config.lastSyncStatus = 'error';
      this.config.lastSyncMessage = errMsg;
      this.saveConfigToStorage();
      this.logs = [{
        id: `db-log-${Date.now()}`,
        timestamp: timestampIso,
        status: 'error',
        storesCount: 0,
        schedulesCount: 0,
        fleetsCount: 0,
        crewsCount: 0,
        message: errMsg,
        triggerSource,
        durationMs
      }, ...this.logs.slice(0, 49)];
      this.saveLogsToStorage();
      this.isSyncing = false;
      this.notifyListeners();
      return {
        success: false,
        timestamp: timestampIso,
        durationMs,
        storesUpserted: 0,
        schedulesUpserted: 0,
        fleetsUpserted: 0,
        crewsUpserted: 0,
        status: 'error',
        message: errMsg
      };
    }
  }

}

export const dataBridgeService = new DataBridgeService();
export { DataBridgeService };
