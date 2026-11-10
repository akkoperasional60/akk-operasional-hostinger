import {
  DriverVehicleChecklist,
  VehicleChecklistItem,
  OverallChecklistStatus
} from '../types';
import { getLocalDateStr } from './driverReportService';
import { safeSetItem } from './store';

const STORAGE_KEY = 'akk_driver_vehicle_checklists_v4';

export const STANDARD_CHECKLIST_ITEMS: Omit<VehicleChecklistItem, 'id' | 'status' | 'note' | 'photoUrl'>[] = [
  // 1. Oli Mesin
  {
    category: 'mesin_fluida',
    categoryLabel: 'Mesin & Cairan Fluida',
    name: 'Oli Mesin',
    description: 'Periksa volume dan kondisi warna oli mesin pada dipstick berada di batas aman'
  },
  // 2. Air Radiator
  {
    category: 'mesin_fluida',
    categoryLabel: 'Mesin & Cairan Fluida',
    name: 'Air Radiator',
    description: 'Periksa level air radiator (coolant) pada tabung reservoir dan pastikan tutup rapat'
  },
  // 3. Foto Oli Mesin & Air Radiator
  {
    category: 'mesin_fluida',
    categoryLabel: 'Mesin & Cairan Fluida',
    name: 'Foto Oli Mesin & Air Radiator',
    description: 'Ambil foto bukti fisik pengecekan oli mesin dan air radiator armada'
  },
  // 4. Air Accu
  {
    category: 'lampu_listrik',
    categoryLabel: 'Kelistrikan & Accu',
    name: 'Air Accu',
    description: 'Periksa batas level cairan air accu (aki) berada di antara garis Upper dan Lower'
  },
  // 5. Rem Mobil & Minyak Rem
  {
    category: 'rem_roda',
    categoryLabel: 'Rem & Roda',
    name: 'Rem Mobil & Minyak Rem',
    description: 'Periksa fungsi pijakan rem mobil pakem serta level minyak rem pada tabung master'
  },
  // 6. Foto Minyak Rem
  {
    category: 'rem_roda',
    categoryLabel: 'Rem & Roda',
    name: 'Foto Minyak Rem',
    description: 'Ambil foto bukti fisik level tabung minyak rem armada'
  },
  // 7. Kebersihan Kabin
  {
    category: 'fisik_dokumen',
    categoryLabel: 'Kabin & Inventaris',
    name: 'Kebersihan Kabin',
    description: 'Pastikan ruang kabin pengemudi bersih, rapi, dan bebas dari sampah/kotoran'
  },
  // 8. Inventaris Mobil
  {
    category: 'fisik_dokumen',
    categoryLabel: 'Kabin & Inventaris',
    name: 'Inventaris Mobil',
    description: 'Periksa kelengkapan inventaris wajib mobil (dongkrak, kunci roda, dokumen jalan)'
  },
  // 9. Ban Cadangan
  {
    category: 'rem_roda',
    categoryLabel: 'Rem & Roda',
    name: 'Ban Cadangan',
    description: 'Pastikan ban cadangan terpasang kuat dan memiliki tekanan angin siap pakai'
  }
];

const LEGACY_NAME_ALIASES: Record<string, string> = {
  'oli mesin & indikator dipstick': 'oli mesin',
  'air radiator (coolant) & reservoir': 'air radiator',
  'baterai / aki & indikator dashboard': 'air accu',
  'minyak rem & minyak kopling': 'rem mobil & minyak rem',
  'ban serep & tekanan udara': 'ban cadangan'
};

class DriverChecklistService {
  private memoryChecklists: DriverVehicleChecklist[] | null = null;
  private isSyncing: boolean = false;

  constructor() {
    if (typeof window !== 'undefined') {
      window.addEventListener('storage', (evt) => {
        if (evt.key === STORAGE_KEY || evt.key === 'akk_driver_vehicle_checklists_v3') {
          this.memoryChecklists = null;
          window.dispatchEvent(new CustomEvent('driver-checklist-updated'));
        }
      });
      setTimeout(() => {
        void this.syncFromServer();
      }, 300);
    }
  }

  private getAuthHeaders(): Record<string, string> {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    try {
      const token =
        localStorage.getItem('akk_session_token') ||
        localStorage.getItem('session_token') ||
        sessionStorage.getItem('akk_session_token') ||
        '';
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
        headers['x-akk-session-token'] = token;
      }
    } catch {}
    return headers;
  }

  public syncItemsWithStandard(existingItems?: VehicleChecklistItem[]): VehicleChecklistItem[] {
    const existingMap = new Map<string, VehicleChecklistItem>();
    if (Array.isArray(existingItems)) {
      existingItems.forEach(item => {
        const lower = item.name.toLowerCase().trim();
        existingMap.set(lower, item);
        const mappedAlias = LEGACY_NAME_ALIASES[lower];
        if (mappedAlias && !existingMap.has(mappedAlias)) {
          existingMap.set(mappedAlias, item);
        }
      });
    }
    return STANDARD_CHECKLIST_ITEMS.map((std, idx) => {
      const matched = existingMap.get(std.name.toLowerCase());
      return {
        id: matched?.id || `item-${Date.now()}-${idx + 1}`,
        ...std,
        status: matched?.status || 'ok',
        note: matched?.note || '',
        photoUrl: matched?.photoUrl
      };
    });
  }

  private normalizeChecklist(chk: DriverVehicleChecklist): DriverVehicleChecklist {
    const syncedItems = this.syncItemsWithStandard(chk.items);
    const { overallStatus, passedCount, issueCount } = this.calculateStatus(syncedItems);
    return {
      ...chk,
      items: syncedItems,
      overallStatus,
      passedCount,
      issueCount
    };
  }

  private loadAllChecklists(): DriverVehicleChecklist[] {
    if (this.memoryChecklists !== null) {
      return this.memoryChecklists;
    }
    try {
      const raw = localStorage.getItem(STORAGE_KEY) || localStorage.getItem('akk_driver_vehicle_checklists_v3');
      let list: DriverVehicleChecklist[] = raw ? JSON.parse(raw) : [];
      if (!Array.isArray(list)) {
        list = [];
      }

      // Filter out legacy fake sample checklists (CHK-INIT-...)
      list = list
        .filter(chk => chk && chk.id && !String(chk.id).startsWith('CHK-INIT-'))
        .map(chk => this.normalizeChecklist(chk));

      list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      this.memoryChecklists = list;
      return list;
    } catch {
      this.memoryChecklists = [];
      return [];
    }
  }

  public async syncFromServer(): Promise<DriverVehicleChecklist[]> {
    if (typeof window === 'undefined' || this.isSyncing) {
      return this.loadAllChecklists();
    }
    this.isSyncing = true;
    try {
      const res = await fetch('/api/fleet-checklists', {
        method: 'GET',
        credentials: 'same-origin',
        headers: this.getAuthHeaders()
      });
      if (!res.ok) {
        return this.loadAllChecklists();
      }
      const data = await res.json();
      const serverList: DriverVehicleChecklist[] = Array.isArray(data?.checklists) ? data.checklists : [];
      const localList = this.loadAllChecklists();

      const mergedMap = new Map<string, DriverVehicleChecklist>();
      serverList.forEach(chk => {
        if (chk && chk.id && !String(chk.id).startsWith('CHK-INIT-')) {
          mergedMap.set(String(chk.id), this.normalizeChecklist({ ...chk, synced: true }));
        }
      });

      const unsyncedLocal: DriverVehicleChecklist[] = [];
      localList.forEach(chk => {
        if (chk && chk.id && !String(chk.id).startsWith('CHK-INIT-')) {
          if (!mergedMap.has(String(chk.id))) {
            mergedMap.set(String(chk.id), this.normalizeChecklist(chk));
            if (!chk.synced) {
              unsyncedLocal.push(chk);
            }
          }
        }
      });

      // Push any unsynced local checklists to server
      for (const localChk of unsyncedLocal.slice(0, 10)) {
        try {
          await fetch('/api/fleet-checklists', {
            method: 'POST',
            credentials: 'same-origin',
            headers: this.getAuthHeaders(),
            body: JSON.stringify({ checklist: { ...localChk, synced: true } })
          });
        } catch {}
      }

      const merged = Array.from(mergedMap.values()).sort(
        (a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
      );
      this.persistLocal(merged);
      window.dispatchEvent(new CustomEvent('driver-checklist-updated'));
      return merged;
    } catch {
      return this.loadAllChecklists();
    } finally {
      this.isSyncing = false;
    }
  }

  private persistLocal(list: DriverVehicleChecklist[]): void {
    const trimmedAll = list.slice(0, 60).map((chk, idx) => {
      if (idx < 8) return chk;
      return {
        ...chk,
        photoEvidenceUrl: chk.photoEvidenceUrl?.startsWith('data:') ? undefined : chk.photoEvidenceUrl,
        items: chk.items.map(it => ({
          ...it,
          photoUrl: it.photoUrl?.startsWith('data:') ? undefined : it.photoUrl
        }))
      };
    });
    this.memoryChecklists = trimmedAll;
    const savedOk = safeSetItem(STORAGE_KEY, JSON.stringify(trimmedAll));
    if (!savedOk) {
      safeSetItem(STORAGE_KEY, JSON.stringify(trimmedAll.slice(0, 5)));
    }
    try {
      if (typeof sessionStorage !== 'undefined') {
        sessionStorage.setItem(STORAGE_KEY, JSON.stringify(trimmedAll.slice(0, 5)));
      }
    } catch {}
  }

  public getChecklists(driverId?: string, fleetId?: string): DriverVehicleChecklist[] {
    let list = [...this.loadAllChecklists()];
    if (driverId) {
      const lowerDriver = driverId.toLowerCase();
      list = list.filter(c => c.driverId === driverId || c.driverName.toLowerCase().includes(lowerDriver));
    }
    if (fleetId) {
      list = list.filter(c => c.fleetId === fleetId || c.plateNumber === fleetId);
    }
    return list;
  }

  public getLatestChecklistForDriver(driverId: string): DriverVehicleChecklist | null {
    const all = this.getChecklists(driverId);
    return all.length > 0 ? all[0] : null;
  }

  public saveChecklist(checklist: DriverVehicleChecklist): boolean {
    try {
      const normalizedChecklist = this.normalizeChecklist({
        ...checklist,
        synced: true,
        createdAt: checklist.createdAt || new Date().toISOString()
      });
      const all = this.getChecklists();
      const existingIdx = all.findIndex(c => c.id === normalizedChecklist.id);
      if (existingIdx >= 0) {
        all[existingIdx] = normalizedChecklist;
      } else {
        all.unshift(normalizedChecklist);
      }
      this.persistLocal(all);

      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('driver-checklist-updated'));
        void fetch('/api/fleet-checklists', {
          method: 'POST',
          credentials: 'same-origin',
          headers: this.getAuthHeaders(),
          body: JSON.stringify({ checklist: normalizedChecklist })
        }).catch(err => console.warn('[DriverChecklistService] Sync to server failed:', err));
      }
      return true;
    } catch (err) {
      console.error('Failed to save checklist:', err);
      return false;
    }
  }

  public createNewChecklistTemplate(
    driverId: string,
    driverName: string,
    fleetId: string,
    plateNumber: string,
    vehicleType: string,
    odometerKm: number = 0,
    fuelPercent: number = 80
  ): DriverVehicleChecklist {
    const now = new Date();
    const dateStr = getLocalDateStr(now);
    const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    const items: VehicleChecklistItem[] = STANDARD_CHECKLIST_ITEMS.map((item, idx) => ({
      id: `item-${Date.now()}-${idx + 1}`,
      ...item,
      status: 'ok',
      note: ''
    }));

    return {
      id: `CHK-${Date.now()}-${Math.floor(Math.random() * 900 + 100)}`,
      driverId,
      driverName,
      fleetId,
      plateNumber,
      vehicleType,
      date: dateStr,
      time: timeStr,
      odometerKm,
      fuelLevelPercent: fuelPercent,
      inspectionType: 'pre_trip',
      overallStatus: 'passed',
      passedCount: items.length,
      issueCount: 0,
      items,
      notes: '',
      driverSignature: `${driverName} (Checklist Diverifikasi)`,
      checkerName: 'Petugas Checker DC PT AKK',
      checkerSigned: true,
      synced: false,
      createdAt: now.toISOString()
    };
  }

  public calculateStatus(items: VehicleChecklistItem[]): {
    overallStatus: OverallChecklistStatus;
    passedCount: number;
    issueCount: number;
  } {
    const passedCount = items.filter(i => i.status === 'ok').length;
    const issueCount = items.filter(i => i.status === 'issue').length;

    let overallStatus: OverallChecklistStatus = 'passed';
    if (issueCount > 0 && issueCount <= 2) {
      overallStatus = 'warning';
    } else if (issueCount > 2) {
      overallStatus = 'failed';
    }

    return { overallStatus, passedCount, issueCount };
  }

  public deleteChecklist(id: string): boolean {
    const cleanId = String(id || '').trim();
    if (!cleanId) return false;
    try {
      const list = this.loadAllChecklists();
      const filtered = list.filter(c => c.id !== cleanId);
      this.memoryChecklists = filtered;
      safeSetItem(STORAGE_KEY, JSON.stringify(filtered));
      safeSetItem('akk_driver_vehicle_checklists_v3', JSON.stringify(filtered));
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('driver-checklist-updated'));
        void fetch(`/api/fleet-checklists/${encodeURIComponent(cleanId)}`, {
          method: 'DELETE',
          credentials: 'same-origin',
          headers: this.getAuthHeaders()
        }).catch(() => {});
      }
      return true;
    } catch {
      return false;
    }
  }
}

export const driverChecklistService = new DriverChecklistService();
