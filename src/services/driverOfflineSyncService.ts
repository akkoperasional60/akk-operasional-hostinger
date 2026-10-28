/**
 * Driver Offline Local State Synchronization Service
 * PT Anugrah Kemasan Kreatif (AKK Logistics DC Banyuwangi)
 *
 * Mengelola strategi sinkronisasi data lokal (menggunakan IndexedDB dengan fallback localStorage)
 * agar pengemudi (driver) dapat memperbarui status pengiriman (Pick Up, In Transit, Kendala, POD Foto)
 * secara lancar saat sinyal internet hilang/lemah di rute perjalanan, kemudian menyinkronkannya
 * secara otomatis begitu koneksi internet pulih.
 */

import { Schedule, ShipmentStatus } from '../types';
import { logisticsStore } from './store';
import { driverDeliveryService } from './driverDeliveryService';

export interface OfflineTaskAction {
  id: string; // Unique Action UUID
  scheduleId: string;
  trackingNumber: string;
  driverId: string;
  actionType: 'status_update';
  newStatus: ShipmentStatus;
  previousStatus?: ShipmentStatus;
  notes?: string;
  podData?: {
    podPhotoUrl?: string;
    podReceiverName?: string;
    podConditionNote?: string;
    podPhotoTimestamp?: string;
  };
  clientTimestamp: string; // ISO string saat pengemudi menekan aksi di HP
  status: 'pending' | 'syncing' | 'failed' | 'synced';
  retryCount: number;
  lastError?: string;
}

export interface DriverSyncState {
  isOnline: boolean;
  isSimulatedOffline: boolean;
  pendingQueue: OfflineTaskAction[];
  isSyncingQueue: boolean;
  lastSyncTime: string | null;
  lastSyncSuccessCount: number;
  totalSyncedCount: number;
}

type SyncStateListener = (state: DriverSyncState) => void;

const DB_NAME = 'AKK_DriverOfflineDB_v1';
const DB_VERSION = 1;
const STORE_QUEUE = 'offline_queue';
const STORE_DELIVERIES = 'cached_deliveries';

const LS_QUEUE_KEY = 'akk_driver_offline_queue_v1';
const LS_CACHE_KEY = 'akk_driver_cached_deliveries_v1';
const LS_SIMULATE_KEY = 'akk_driver_simulated_offline_v1';
const LS_LAST_SYNC_KEY = 'akk_driver_last_sync_v1';

class DriverOfflineSyncService {
  private isOnline: boolean = typeof navigator !== 'undefined' ? navigator.onLine : true;
  private isSimulatedOffline: boolean = false;
  private pendingQueue: OfflineTaskAction[] = [];
  private isSyncingQueue: boolean = false;
  private lastSyncTime: string | null = null;
  private lastSyncSuccessCount: number = 0;
  private totalSyncedCount: number = 0;
  private listeners: Set<SyncStateListener> = new Set();
  private db: IDBDatabase | null = null;
  private isDbReady: boolean = false;
  private pingIntervalId: ReturnType<typeof setInterval> | null = null;

  constructor() {
    this.initSimulatedState();
    this.initIndexedDb();
    this.initNetworkListeners();
    this.startPeriodicHealthCheck();
  }

  private initSimulatedState() {
    if (typeof window === 'undefined') return;
    try {
      const sim = localStorage.getItem(LS_SIMULATE_KEY);
      this.isSimulatedOffline = sim === 'true';
      this.lastSyncTime = localStorage.getItem(LS_LAST_SYNC_KEY) || null;
      // Load fallback queue immediately from localStorage
      const savedQueue = localStorage.getItem(LS_QUEUE_KEY);
      if (savedQueue) {
        this.pendingQueue = JSON.parse(savedQueue);
      }
    } catch {}
  }

  /**
   * Inisialisasi IndexedDB untuk kapasitas penyimpanan offline yang besar (mendukung foto POD base64)
   */
  private async initIndexedDb() {
    if (typeof window === 'undefined' || !window.indexedDB) {
      this.isDbReady = false;
      this.loadQueueFromLocalStorage();
      return;
    }

    try {
      const request = window.indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event: IDBVersionChangeEvent) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(STORE_QUEUE)) {
          db.createObjectStore(STORE_QUEUE, { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains(STORE_DELIVERIES)) {
          db.createObjectStore(STORE_DELIVERIES, { keyPath: 'id' });
        }
      };

      request.onsuccess = async (event: Event) => {
        this.db = (event.target as IDBOpenDBRequest).result;
        this.isDbReady = true;
        await this.reloadQueueFromStorage();
      };

      request.onerror = () => {
        console.warn('[DriverOfflineSync] IndexedDB failed to open, falling back to localStorage');
        this.isDbReady = false;
        this.loadQueueFromLocalStorage();
      };
    } catch (e) {
      this.isDbReady = false;
      this.loadQueueFromLocalStorage();
    }
  }

  /**
   * Monitor status konektivitas jaringan peramban
   */
  private initNetworkListeners() {
    if (typeof window === 'undefined') return;

    window.addEventListener('online', () => {
      this.isOnline = true;
      this.notify();
      if (!this.isSimulatedOffline && this.pendingQueue.length > 0) {
        console.info('[DriverOfflineSync] Network reconnected, syncing pending actions queue...');
        this.syncQueue();
      }
    });

    window.addEventListener('offline', () => {
      this.isOnline = false;
      this.notify();
    });

    window.addEventListener('akk-force-online-mode', () => {
      if (this.isSimulatedOffline) {
        this.setSimulatedOffline(false);
      }
    });
  }

  /**
   * Periodically check if connection is really functional and sync queue if pending
   */
  private startPeriodicHealthCheck() {
    if (typeof window === 'undefined') return;
    if (this.pingIntervalId) clearInterval(this.pingIntervalId);

    this.pingIntervalId = setInterval(async () => {
      if (this.isEffectivelyOnline() && this.pendingQueue.length > 0 && !this.isSyncingQueue) {
        // Coba sinkronisasi otomatis jika ada antrean tertunda
        await this.syncQueue();
      }
    }, 20000); // Tiap 20 detik
  }

  public isEffectivelyOnline(): boolean {
    return this.isOnline && !this.isSimulatedOffline;
  }

  public getSyncState(): DriverSyncState {
    return {
      isOnline: this.isOnline,
      isSimulatedOffline: this.isSimulatedOffline,
      pendingQueue: [...this.pendingQueue],
      isSyncingQueue: this.isSyncingQueue,
      lastSyncTime: this.lastSyncTime,
      lastSyncSuccessCount: this.lastSyncSuccessCount,
      totalSyncedCount: this.totalSyncedCount
    };
  }

  public subscribe(listener: SyncStateListener): () => void {
    this.listeners.add(listener);
    listener(this.getSyncState());
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify() {
    const state = this.getSyncState();
    this.listeners.forEach(fn => {
      try {
        fn(state);
      } catch (err) {
        console.error('[DriverOfflineSync] Listener error:', err);
      }
    });
  }

  /**
   * Toggle simulasi offline untuk keperluan demo / pengujian sopir di area tanpa sinyal
   */
  public setSimulatedOffline(enabled: boolean) {
    this.isSimulatedOffline = enabled;
    try {
      localStorage.setItem(LS_SIMULATE_KEY, enabled ? 'true' : 'false');
    } catch {}
    this.notify();

    // Jika dimatikan (kembali online) dan ada antrean, langsung sinkronkan
    if (!enabled && this.isOnline && this.pendingQueue.length > 0) {
      this.syncQueue();
    }
  }

  /**
   * Simpan antrean aksi ke IndexedDB dan fallback localStorage
   */
  private async persistQueue() {
    // 1. Simpan ke localStorage (fallback cepat)
    try {
      localStorage.setItem(LS_QUEUE_KEY, JSON.stringify(this.pendingQueue));
    } catch (e) {
      console.warn('[DriverOfflineSync] LocalStorage queue persist quota warning:', e);
    }

    // 2. Simpan ke IndexedDB jika tersedia
    if (this.isDbReady && this.db) {
      try {
        const tx = this.db.transaction(STORE_QUEUE, 'readwrite');
        const store = tx.objectStore(STORE_QUEUE);
        // Clear old records & write all
        await new Promise<void>((resolve, reject) => {
          const clearReq = store.clear();
          clearReq.onsuccess = () => {
            if (this.pendingQueue.length === 0) {
              resolve();
              return;
            }
            let count = 0;
            this.pendingQueue.forEach(item => {
              const putReq = store.put(item);
              putReq.onsuccess = () => {
                count++;
                if (count === this.pendingQueue.length) resolve();
              };
              putReq.onerror = () => reject(putReq.error);
            });
          };
          clearReq.onerror = () => reject(clearReq.error);
        });
      } catch (idbErr) {
        console.warn('[DriverOfflineSync] IndexedDB queue save error:', idbErr);
      }
    }
  }

  private loadQueueFromLocalStorage() {
    try {
      const raw = localStorage.getItem(LS_QUEUE_KEY);
      if (raw) {
        this.pendingQueue = JSON.parse(raw);
        this.notify();
      }
    } catch {}
  }

  private async reloadQueueFromStorage() {
    if (this.isDbReady && this.db) {
      try {
        const tx = this.db.transaction(STORE_QUEUE, 'readonly');
        const store = tx.objectStore(STORE_QUEUE);
        const req = store.getAll();
        req.onsuccess = () => {
          const items = req.result as OfflineTaskAction[];
          if (Array.isArray(items) && items.length > 0) {
            this.pendingQueue = items;
          } else {
            this.loadQueueFromLocalStorage();
          }
          this.notify();
        };
        req.onerror = () => {
          this.loadQueueFromLocalStorage();
        };
        return;
      } catch {
        this.loadQueueFromLocalStorage();
      }
    } else {
      this.loadQueueFromLocalStorage();
    }
  }

  /**
   * Catat pembaruan tugas pengiriman ke antrean lokal (Local State Synchronization).
   * Selalu memperbarui store lokal secara optimistik agar UI pengemudi seketika berubah,
   * lalu jika online langsung dikirim ke backend, jika offline disimpan aman di antrean lokal.
   */
  public async recordTaskUpdate(params: {
    scheduleId: string;
    trackingNumber: string;
    driverId: string;
    newStatus: ShipmentStatus;
    previousStatus?: ShipmentStatus;
    notes?: string;
    podData?: {
      podPhotoUrl?: string;
      podReceiverName?: string;
      podConditionNote?: string;
      podPhotoTimestamp?: string;
    };
  }): Promise<{ action: OfflineTaskAction; syncedImmediately: boolean; message: string }> {
    const actionId = `off-act-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const nowIso = new Date().toISOString();

    const action: OfflineTaskAction = {
      id: actionId,
      scheduleId: params.scheduleId,
      trackingNumber: params.trackingNumber,
      driverId: params.driverId,
      actionType: 'status_update',
      newStatus: params.newStatus,
      previousStatus: params.previousStatus,
      notes: params.notes,
      podData: params.podData,
      clientTimestamp: nowIso,
      status: 'pending',
      retryCount: 0
    };

    // 1. Optimistic Update pada Logistics Store & Local Storage
    logisticsStore.updateScheduleStatus(
      params.scheduleId,
      params.newStatus,
      params.notes,
      params.podData
    );

    // Perbarui snapshot cache pengiriman di IndexedDB & LocalStorage
    try {
      this.cacheDeliveries(logisticsStore.getSchedules());
    } catch {}

    // 2. Evaluasi apakah saat ini sedang dalam koneksi online nyata
    const canSyncNow = this.isEffectivelyOnline();

    if (!canSyncNow) {
      // Masukkan ke antrean offline
      this.pendingQueue.push(action);
      await this.persistQueue();
      this.notify();

      return {
        action,
        syncedImmediately: false,
        message: `Status disimpan secara lokal di HP (Mode Offline). Akan disinkronkan otomatis saat ada koneksi internet.`
      };
    }

    // 3. Jika online, coba kirim langsung ke backend
    try {
      const syncResult = await driverDeliveryService.updateDeliveryStatus(
        params.scheduleId,
        params.trackingNumber,
        params.newStatus,
        params.notes,
        params.podData
      );

      this.lastSyncTime = new Date().toLocaleTimeString('id-ID');
      this.totalSyncedCount++;
      try {
        localStorage.setItem(LS_LAST_SYNC_KEY, this.lastSyncTime);
      } catch {}

      this.notify();

      return {
        action: { ...action, status: 'synced' },
        syncedImmediately: true,
        message: syncResult.message
      };
    } catch (err: any) {
      // Jika request online gagal mendadak (misal koneksi drop saat pengiriman payload),
      // simpan tindakan ke antrean offline agar tidak hilang!
      console.warn('[DriverOfflineSync] Immediate sync failed, queuing for offline retry:', err);
      action.lastError = err?.message || 'Gagal mengirim saat online';
      this.pendingQueue.push(action);
      await this.persistQueue();
      this.notify();

      return {
        action,
        syncedImmediately: false,
        message: `Koneksi terputus saat mengirim. Status tersimpan aman di HP & akan otomatis dicoba lagi.`
      };
    }
  }

  /**
   * Eksekusi sinkronisasi seluruh antrean offline ke server pusat (FIFO).
   */
  public async syncQueue(): Promise<{ synced: number; failed: number }> {
    if (this.isSyncingQueue || this.pendingQueue.length === 0) {
      return { synced: 0, failed: 0 };
    }

    if (!this.isEffectivelyOnline()) {
      return { synced: 0, failed: this.pendingQueue.length };
    }

    this.isSyncingQueue = true;
    this.notify();

    let syncedCount = 0;
    let failedCount = 0;
    const remainingQueue: OfflineTaskAction[] = [];

    const queueCopy = [...this.pendingQueue];

    for (const item of queueCopy) {
      try {
        item.status = 'syncing';
        this.notify();

        const result = await driverDeliveryService.updateDeliveryStatus(
          item.scheduleId,
          item.trackingNumber,
          item.newStatus,
          item.notes,
          item.podData
        );

        if (result.success) {
          syncedCount++;
          item.status = 'synced';
        } else {
          item.retryCount++;
          item.status = 'failed';
          item.lastError = result.message || 'Gagal sinkronisasi';
          remainingQueue.push(item);
          failedCount++;
        }
      } catch (err: any) {
        item.retryCount++;
        item.status = 'failed';
        item.lastError = err?.message || 'Kesalahan jaringan';
        remainingQueue.push(item);
        failedCount++;
      }
    }

    this.pendingQueue = remainingQueue;
    this.lastSyncSuccessCount = syncedCount;
    this.totalSyncedCount += syncedCount;
    if (syncedCount > 0) {
      this.lastSyncTime = new Date().toLocaleTimeString('id-ID');
      try {
        localStorage.setItem(LS_LAST_SYNC_KEY, this.lastSyncTime);
      } catch {}
    }

    await this.persistQueue();
    this.isSyncingQueue = false;
    this.notify();

    // Dispatch event agar komponen UI dapat memunculkan toast
    if (typeof window !== 'undefined' && syncedCount > 0) {
      window.dispatchEvent(
        new CustomEvent('driver-offline-synced', {
          detail: {
            syncedCount,
            failedCount,
            time: this.lastSyncTime
          }
        })
      );
    }

    return { synced: syncedCount, failed: failedCount };
  }

  /**
   * Sinkronkan satu aksi tertentu dari antrean (manual per-item)
   */
  public async syncAction(actionId: string): Promise<{ success: boolean; message: string }> {
    const item = this.pendingQueue.find(a => a.id === actionId);
    if (!item) return { success: false, message: 'Aksi tidak ditemukan dalam antrean.' };

    if (!this.isEffectivelyOnline()) {
      return { success: false, message: 'Perangkat sedang offline atau dalam mode simulasi. Sambungkan internet terlebih dahulu.' };
    }

    try {
      item.status = 'syncing';
      this.notify();

      const result = await driverDeliveryService.updateDeliveryStatus(
        item.scheduleId,
        item.trackingNumber,
        item.newStatus,
        item.notes,
        item.podData
      );

      if (result.success) {
        item.status = 'synced';
        this.pendingQueue = this.pendingQueue.filter(a => a.id !== actionId);
        this.lastSyncSuccessCount++;
        this.totalSyncedCount++;
        this.lastSyncTime = new Date().toLocaleTimeString('id-ID');
        try {
          localStorage.setItem(LS_LAST_SYNC_KEY, this.lastSyncTime);
        } catch {}
        await this.persistQueue();
        this.notify();

        if (typeof window !== 'undefined') {
          window.dispatchEvent(
            new CustomEvent('driver-offline-synced', {
              detail: {
                syncedCount: 1,
                failedCount: 0,
                time: this.lastSyncTime
              }
            })
          );
        }

        return { success: true, message: result.message };
      } else {
        item.retryCount++;
        item.status = 'failed';
        item.lastError = result.message || 'Gagal sinkronisasi';
        await this.persistQueue();
        this.notify();
        return { success: false, message: item.lastError || 'Gagal sinkronisasi' };
      }
    } catch (err: any) {
      item.retryCount++;
      item.status = 'failed';
      item.lastError = err?.message || 'Kesalahan jaringan';
      await this.persistQueue();
      this.notify();
      return { success: false, message: item.lastError || 'Kesalahan jaringan' };
    }
  }

  /**
   * Hapus aksi tertentu dari antrean (misal dibatalkan manual)
   */
  public async removeAction(actionId: string) {
    this.pendingQueue = this.pendingQueue.filter(a => a.id !== actionId);
    await this.persistQueue();
    this.notify();
  }

  /**
   * Bersihkan seluruh antrean
   */
  public async clearQueue() {
    this.pendingQueue = [];
    await this.persistQueue();
    this.notify();
  }

  /**
   * Cek apakah suatu pengiriman memiliki antrean offline pending
   */
  public getPendingActionForSchedule(scheduleId: string): OfflineTaskAction | undefined {
    return this.pendingQueue.find(a => a.scheduleId === scheduleId);
  }

  /**
   * Simpan snapshot daftar tugas pengiriman ke cache lokal untuk akses saat offline
   */
  public async cacheDeliveries(deliveries: Schedule[]) {
    try {
      localStorage.setItem(LS_CACHE_KEY, JSON.stringify(deliveries));
    } catch {}

    if (this.isDbReady && this.db) {
      try {
        const tx = this.db.transaction(STORE_DELIVERIES, 'readwrite');
        const store = tx.objectStore(STORE_DELIVERIES);
        store.clear();
        deliveries.forEach(d => store.put(d));
      } catch {}
    }
  }

  /**
   * Ambil snapshot tugas pengiriman yang tersimpan di cache offline
   */
  public async getCachedDeliveries(driverId?: string): Promise<Schedule[]> {
    if (this.isDbReady && this.db) {
      try {
        const tx = this.db.transaction(STORE_DELIVERIES, 'readonly');
        const store = tx.objectStore(STORE_DELIVERIES);
        const req = store.getAll();
        return new Promise((resolve) => {
          req.onsuccess = () => {
            const list = req.result as Schedule[];
            if (Array.isArray(list) && list.length > 0) {
              resolve(driverId ? list.filter(d => d.crewId === driverId) : list);
            } else {
              resolve(this.getFallbackCachedDeliveries(driverId));
            }
          };
          req.onerror = () => resolve(this.getFallbackCachedDeliveries(driverId));
        });
      } catch {
        return this.getFallbackCachedDeliveries(driverId);
      }
    }
    return this.getFallbackCachedDeliveries(driverId);
  }

  private getFallbackCachedDeliveries(driverId?: string): Schedule[] {
    try {
      const raw = localStorage.getItem(LS_CACHE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Schedule[];
        return driverId ? parsed.filter(d => d.crewId === driverId) : parsed;
      }
    } catch {}
    return logisticsStore.getSchedules();
  }
}

// Singleton Instance
export const driverOfflineSyncService = new DriverOfflineSyncService();
