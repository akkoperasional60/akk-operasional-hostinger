import {
  Fleet,
  Crew,
  RetailStore,
  Schedule,
  TracksolidDevice,
  UserProfile,
  UserRole,
  UserApprovalStatus,
  CrewDeliveryHistory,
  AreaDeliveryStat,
  AreaApprovalRequest,
  SalesOrder,
  AdminActivity,
  AdminSchedule,
  LoadingDurationRecord,
  AdminSkillProfile,
  JobdeskConfig,
  SystemActivity,
  SparePart,
  SparePartUsage,
  SparePartCategory,
  FuelLog,
  FuelType,
  EfficiencyStatus,
  FleetFuelSummary,
  DriverFuelScore,
  ShipmentStatus,
  SwapShiftRequest,
  FleetTireWearPrediction,
  TaxKirReminderItem,
  TaxKirType,
  TaxKirUrgency,
  ImageRecord,
  AutoSyncStatus,
  ScannedDocumentLog,
  ScannedDocumentType,
  SecurityGateLog
} from '../types';
import {
  INITIAL_FLEETS,
  INITIAL_CREWS,
  INITIAL_STORES,
  INITIAL_SCHEDULES,
  INITIAL_TRACKSOLID_DEVICES,
  INITIAL_PROFILES,
  INITIAL_CREW_HISTORY,
  INITIAL_AREA_APPROVALS,
  INITIAL_SCANNED_DOCUMENTS
} from '../data/mockData';
import {
  INITIAL_SALES_ORDERS,
  INITIAL_ADMIN_ACTIVITIES,
  INITIAL_ADMIN_SCHEDULES,
  INITIAL_LOADING_RECORDS,
  INITIAL_SKILL_PROFILES,
  INITIAL_JOBDESK_CONFIGS
} from '../data/salesMockData';
import {
  INITIAL_SPARE_PARTS,
  INITIAL_SPARE_PART_USAGES
} from '../data/sparePartsMockData';
import {
  INITIAL_FUEL_LOGS,
  FUEL_TARGET_RATIOS
} from '../data/fuelMockData';
import { getDefaultPermissionsForRole } from '../utils/rbac';
import { AREA_CODE_MAP, standardizeAreaName } from '../utils/areaNormalizer';
import { googleSheetsApiService } from './googleSheetsApiService';
import { supabaseRealtimeSync } from './supabaseRealtimeSync';
import {
  createFleetInSupabase,
  updateFleetInSupabase,
  deleteFleetInSupabase,
  createCrewInSupabase,
  updateCrewInSupabase,
  deleteCrewInSupabase,
  syncFleetsAndCrewsWithSupabase as syncSupabaseFleetsAndCrews
} from './supabaseService';

export interface ScheduleChangeLogEntry {
  id: string;
  timestamp: string;
  fileName: string;
  userName: string;
  userRole: string;
  actionType: 'upload_excel' | 'tambah_jadwal' | 'edit_jadwal' | 'hapus_jadwal' | 'manual_create' | 'manual_edit' | 'delete_schedule';
  summary: string;
  changes: string[];
  status?: 'Sukses' | 'Sebagian' | 'Gagal' | 'Peringatan';
  rowCount?: number;
}

const STORAGE_KEYS = {
  FLEETS: 'akk_fleets_v1',
  CREWS: 'akk_crews_v2',
  STORES: 'akk_stores_v1',
  SCHEDULES: 'akk_schedules_v1',
  DEVICES: 'akk_devices_v1',
  CURRENT_USER: 'akk_user_v2',
  AUTH_SESSION: 'akk_auth_session_active_v1',
  USERS: 'akk_users_list_v5',
  SUPABASE_CONFIG: 'akk_supabase_config_v1',
  CREW_HISTORY: 'akk_crew_history_v1',
  AREA_APPROVALS: 'akk_area_approvals_v1',
  AREA_THRESHOLD: 'akk_area_threshold_v1',
  SALES_ORDERS: 'akk_sales_orders_v1',
  ADMIN_ACTIVITIES: 'akk_admin_activities_v1',
  ADMIN_SCHEDULES: 'akk_admin_schedules_v1',
  LOADING_RECORDS: 'akk_loading_records_v1',
  SKILL_PROFILES: 'akk_skill_profiles_v1',
  JOBDESK_CONFIGS: 'akk_jobdesk_configs_v1',
  SPARE_PARTS: 'akk_spare_parts_v1',
  SPARE_PART_USAGES: 'akk_spare_part_usages_v1',
  FUEL_LOGS: 'akk_fuel_logs_v1',
  IMAGES: 'akk_images_storage_v1',
  SCANNED_DOCUMENTS: 'akk_scanned_documents_v1',
  SECURITY_LOGS: 'akk_security_logs_v1',
  SCHEDULE_CHANGE_LOGS: 'akk_schedule_change_logs_v1'
};

export const GUEST_USER_PROFILE: UserProfile = {
  id: 'guest',
  email: 'guest@akk-packaging.co.id',
  fullName: 'Tamu / Belum Login',
  role: 'unassigned',
  department: 'Tamu',
  status: 'pending'
};

export const INITIAL_SCHEDULE_CHANGE_LOGS: ScheduleChangeLogEntry[] = [
  {
    id: 'scl-101',
    timestamp: '2026-10-09T21:30:00+07:00',
    fileName: 'Roster_DC_Banyuwangi_Jan2026.xlsx',
    userName: 'Muhammad Syaiful Bahri',
    userRole: 'SPV Logistik',
    actionType: 'upload_excel',
    summary: '121 Baris Tervalidasi • Periode Januari 2026',
    changes: [
      'Menambahkan 38 ritase pengiriman baru pada Minggu 1 - Minggu 4 Januari 2026',
      'Memperbarui alokasi armada DS3 (Supriyanto & Rifaldi) untuk rute DENPASAR 1',
      'Memperbarui penugasan kru Budi Santoso & Rizal untuk rute PURWO PASAR (NS1)',
      'Menyelaraskan 25 nama area kirim dengan standar katalog distribusi AKK'
    ],
    status: 'Sukses'
  },
  {
    id: 'scl-102',
    timestamp: '2026-10-05T14:15:00+07:00',
    fileName: 'Schedule_Sheet_ALL_v2.csv',
    userName: 'Super Admin',
    userRole: 'Super Admin',
    actionType: 'upload_excel',
    summary: '115 Baris Tervalidasi • Sinkronisasi Jadwal Pengiriman',
    changes: [
      'Mengimpor 115 baris jadwal pengiriman dari Sheet ALL',
      'Menyesuaikan rotasi supir luar kota (Bali & Situbondo-Bondowoso)',
      'Memvalidasi 19 personel kru pengemudi dan helper aktif'
    ],
    status: 'Sukses'
  }
];

export const INITIAL_SECURITY_LOGS: SecurityGateLog[] = [
  { id: 'SEC-101', timestamp: new Date(Date.now() - 3600000 * 5).toISOString(), time: '08:15 WIB', type: 'Kendaraan Masuk', entity: 'Truk Box Isuzu W 8229 US', driver: 'Ach Taufiq', purpose: 'Muat Karton Box Ekspedisi Bali', status: 'Diizinkan', plateNumber: 'W 8229 US', securityOfficer: 'Regu A (Bripka Joko)' },
  { id: 'SEC-102', timestamp: new Date(Date.now() - 3600000 * 4).toISOString(), time: '09:30 WIB', type: 'Tamu Rekanan', entity: 'PT Surya Paperindo Utama', driver: 'Ir. Hendra (Vendor Kertas)', purpose: 'Inspeksi Bahan Baku Roll', status: 'Selesai', securityOfficer: 'Regu A (Hairul Rozikin)' },
  { id: 'SEC-103', timestamp: new Date(Date.now() - 3600000 * 2).toISOString(), time: '11:00 WIB', type: 'Kendaraan Keluar', entity: 'Pick Up Box P 8125 VC [N1]', initialCode: 'N1', driver: 'Zainul Agustiar', purpose: 'Pengiriman Retail Banyuwangi', status: 'Gate-Out', plateNumber: 'P 8125 VC', securityOfficer: 'Regu A (Hairul Rozikin)' },
  { id: 'SEC-104', timestamp: new Date(Date.now() - 1800000).toISOString(), time: '13:45 WIB', type: 'Patroli Satpam', entity: 'Area Gudang DC & Tangki Solar', driver: 'Regu A (Bripka Joko dkk)', purpose: 'Pengecekan Segel Gerbang & APAR', status: 'Aman', securityOfficer: 'Regu A (Bripka Joko)' }
];

export interface SupabaseConfig {
  url: string;
  anonKey: string;
  isConnected: boolean;
}

export interface OfflineScheduleStatusUpdate {
  id: string;
  scheduleId: string;
  trackingNumber: string;
  status: Schedule['status'];
  extraNotes?: string;
  podData?: {
    podPhotoUrl?: string;
    podReceiverName?: string;
    podConditionNote?: string;
    podPhotoTimestamp?: string;
  };
  timestamp: string;
}

/**
 * Filter helper to ensure delivery route areas / destinations are NOT treated as retail stores.
 */
export function isAreaRouteItem(store: Partial<RetailStore>): boolean {
  if (!store) return false;
  if (store.id && (store.id.startsWith('str-smart-') || store.id.startsWith('area-dest-') || store.id.startsWith('area-'))) return true;
  if (store.storeCode && (
    store.storeCode.startsWith('STR-DEN-') ||
    store.storeCode.startsWith('STR-SIT-') ||
    store.storeCode.startsWith('STR-BON-') ||
    store.storeCode.startsWith('STR-JEM-') ||
    store.storeCode.startsWith('STR-BUL-') ||
    store.storeCode.startsWith('STR-BAN-') ||
    store.storeCode.startsWith('STR-') ||
    store.storeCode.startsWith('ARE-') ||
    store.storeCode.startsWith('AREA-')
  )) return true;

  const AREA_DESTINATION_NAMES = new Set([
    'denpasar 1 retail utama',
    'denpasar 2 supermarket hub',
    'situbondo retail cluster',
    'bondowoso distribution hub',
    'susulan genteng - rogojampi',
    'jember selatan retail hub',
    'singaraja bali distribution',
    'sumberayu retail store',
    'galekan retail mart',
    'grosir 1 banyuwangi kota',
    'susulan sanggar - jajag',
    'genteng retail store',
    'rogojampi retail store',
    'muncar pasar central',
    'muncar pinggir retail',
    'susulan singaraja bali',
    'susulan situbondo - bondowoso',
    'jember barat distribution',
    'grosir 2 retail hub',
    'songgon retail mart',
    'bwi kota selatan retail',
    'ketapang - wongsorejo store',
    'sanggar retail mart',
    'kalibaru retail hub',
    'grosir 3 distribution',
    'susulan rogojampi - muncar',
    'sempu stail retail store',
    'negara bali barat mart',
    'jember kota central mall hub',
    'purwo pasar central',
    'purwo dambuntung retail',
    'jajag retail hub',
    'srono retail store',
    'grosir 4 hub banyuwangi'
  ]);

  const nameLower = (store.storeName || '').trim().toLowerCase();
  if (AREA_DESTINATION_NAMES.has(nameLower)) return true;
  return false;
}

export const KNOWN_PO_AREA_MAP: Record<string, string> = {
  'PO-AKK-20260105-DS3-1': 'DENPASAR 1',
  'PO-AKK-20260105-DS1-2': 'DENPASAR 2',
  'PO-AKK-20260105-NS3-3': 'BONDOWOSO',
  'PO-AKK-20260105-DS2-4': 'SITUBONDO',
  'PO-AKK-20260105-DS4-5': 'SUSULAN GENTENG - ROGOJAMPI',
  'PO-AKK-20260105-NS2-6': 'PURWO DAMBUNTUNG',
  'PO-AKK-20260105-NS1-7': 'PURWO PASAR',
  'PO-AKK-20260105-N20-8': 'JAJAG RETAIL',
  'PO-AKK-20260106-DS5-1': 'SINGARAJA',
  'PO-AKK-20260106-NL2-2': 'SUMBERAYU RETAIL',
  'PO-AKK-20260106-NL1-3': 'GALEKAN',
  'PO-AKK-20260106-DS4-4': 'GROSIR BWI - ROGOJAMPI',
  'PO-AKK-20260106-NS1-5': 'SUSULAN SANGGAR JAJAG',
};

export const SMART_ROUTE_AREA_MAP: Record<string, string> = {
  'str-smart-senin-0': 'Denpasar 1',
  'str-smart-senin-1': 'Denpasar 2',
  'str-smart-senin-2': 'Situbondo',
  'str-smart-senin-3': 'Bondowoso',
  'str-smart-senin-4': 'Susulan Genteng - Rogojampi',
  'str-smart-selasa-0': 'Jember Selatan',
  'str-smart-selasa-1': 'Singaraja Bali',
  'str-smart-selasa-2': 'Sumberayu',
  'str-smart-selasa-3': 'Galekan',
  'str-smart-selasa-4': 'Grosir 1 Banyuwangi Kota',
  'str-smart-selasa-5': 'Susulan Sanggar - Jajag',
  'str-smart-rabu-0': 'Denpasar 1',
  'str-smart-rabu-1': 'Denpasar 2',
  'str-smart-rabu-2': 'Genteng',
  'str-smart-rabu-3': 'Rogojampi',
  'str-smart-rabu-4': 'Muncar Pasar Central',
  'str-smart-rabu-5': 'Muncar Pinggir',
  'str-smart-kamis-0': 'Susulan Singaraja Bali',
  'str-smart-kamis-1': 'Susulan Situbondo - Bondowoso',
  'str-smart-kamis-2': 'Jember Barat',
  'str-smart-kamis-3': 'Grosir 2 Banyuwangi',
  'str-smart-kamis-4': 'Songgon',
  'str-smart-kamis-5': 'BWI Kota Selatan',
  'str-smart-jumat-0': 'Ketapang - Wongsorejo',
  'str-smart-jumat-1': 'Sanggar',
  'str-smart-jumat-2': 'Kalibaru',
  'str-smart-jumat-3': 'Grosir 3 Banyuwangi',
  'str-smart-jumat-4': 'Susulan Rogojampi - Muncar',
  'str-smart-jumat-5': 'Sempu Stail',
  'str-smart-sabtu-0': 'Negara Bali Barat',
  'str-smart-sabtu-1': 'Jember Kota',
  'str-smart-sabtu-2': 'Purwo Pasar Central',
  'str-smart-sabtu-3': 'Purwo Dambuntung',
  'str-smart-sabtu-4': 'Jajag',
  'str-smart-sabtu-5': 'Srono',
  'str-smart-sabtu-6': 'Grosir 4 Banyuwangi'
};

export const INITIAL_TRK_AREA_MAP: Record<string, string> = {
  'TRK-2026-09-082': 'Denpasar 1 (Bali)',
  'TRK-2026-09-083': 'Situbondo - Probolinggo',
  'TRK-2026-09-084': 'Balikpapan & Luar Pulau',
  'TRK-2026-09-085': 'Jember Kota',
  'TRK-2026-09-079': 'Singaraja (Bali Utara)',
};

/**
 * Resolves the official Delivery Area Name (Nama Area Kirim) for any schedule,
 * preventing accidental display of customer store names like "BU TIWI GENTENG"
 */
export function resolveScheduleAreaName(sch: Partial<Schedule>): string {
  if (!sch) return 'Area Pengiriman';

  // 0. If explicit areaName is provided and valid, prioritize it
  if (sch.areaName && sch.areaName.trim() && !sch.areaName.startsWith('str-') && !sch.areaName.startsWith('RET-') && !sch.areaName.toLowerCase().includes('tiwi') && !sch.areaName.toLowerCase().includes('holly')) {
    const cleanArea = sch.areaName.trim();
    const upperClean = cleanArea.toUpperCase();
    if (upperClean === 'DENPASAR 1 & 2' || upperClean === 'DENPASAR 1&2' || upperClean === 'DENPASAR 1 / 2' || upperClean === 'DENPASAR') {
      return 'DENPASAR 1';
    }
    if (AREA_CODE_MAP[upperClean]) {
      return AREA_CODE_MAP[upperClean];
    }
    return standardizeAreaName(cleanArea);
  }

  // 1. Direct storeId match against AREA_CODE_MAP or SMART_ROUTE_AREA_MAP
  const sId = (sch.storeId || sch.store?.id || '').trim();
  const sIdUpper = sId.toUpperCase();
  if (AREA_CODE_MAP[sIdUpper]) return AREA_CODE_MAP[sIdUpper];
  if ( sIdUpper === 'SITUBONDO') return 'SITUBONDO';
  if (sIdUpper === 'TOKO_DR_SOETOMO' || sIdUpper === 'TOKO DR. SOETOMO') return 'TOKO DR. SOETOMO';
  if (sIdUpper === 'NUSANTARA_EXPAND' || sIdUpper === 'NUSANTARA EXPAND') return 'NUSANTARA EXPAND';
  if (SMART_ROUTE_AREA_MAP[sId]) return SMART_ROUTE_AREA_MAP[sId];

  // 2. Direct tracking number / PO match
  const trk = (sch.trackingNumber || '').trim().toUpperCase();
  if (KNOWN_PO_AREA_MAP[trk]) return KNOWN_PO_AREA_MAP[trk];
  if (INITIAL_TRK_AREA_MAP[trk]) return INITIAL_TRK_AREA_MAP[trk];

  // 3. Extract from cargoDescription (e.g. "Karton Box & Sheet Kemasan - Area DENPASAR 2")
  if (sch.cargoDescription) {
    const areaMatch = sch.cargoDescription.match(/Area\s+([^,•\n\-]+)/i);
    if (areaMatch && areaMatch[1] && areaMatch[1].trim()) {
      return areaMatch[1].trim().toUpperCase();
    }
  }

  // 4. Extract from notes
  if (sch.notes) {
    const noteMatch = sch.notes.match(/Area\s+([^,•\n\-]+)/i);
    if (noteMatch && noteMatch[1] && noteMatch[1].trim()) {
      return noteMatch[1].trim();
    }
  }

  // 5. If store exists, check its storeName
  if (sch.store) {
    if (isAreaRouteItem(sch.store)) {
      return sch.store.storeName
        .replace(/(Retail Utama|Supermarket Hub|Retail Cluster|Distribution Hub|Store|Mart)$/i, '')
        .trim();
    }
    if (sch.store.city && sch.store.city !== 'Banyuwangi') {
      return sch.store.city.replace(/^Banyuwangi\s*\((.*?)\)$/i, '$1').trim();
    }
  }

  return 'Area Pengiriman';
}

/**
 * Safe localStorage writer that handles QuotaExceededError automatically by purging temporary caches
 */
export function safeSetItem(key: string, value: string): boolean {
  try {
    localStorage.setItem(key, value);
    return true;
  } catch {
    // Purge temporary/cached keys silently to free quota without crashing or throwing
    const tempKeysToPurge = [
      'akk_simulasi_weeks_v2',
      'akk_schedule_grid_v2',
      'akk_backup_acc_grid_v2',
      'akk_checklist_history',
      'procurement_form_draft',
      'service_form_draft',
      'akk_offline_sync_queue',
      'akk_notifications_v1',
      'RAW_ADMIN_SPREADSHEET_CSV',
      'akk_csv_raw_backup',
      'akk_admin_schedule_weeks_cache',
      'akk_system_activities_v1',
      'akk_gsheets_sync_logs_v1',
      'akk_crew_history_v1'
    ];

    tempKeysToPurge.forEach(k => {
      try { localStorage.removeItem(k); } catch {}
    });

    // Try saving again
    try {
      localStorage.setItem(key, value);
      return true;
    } catch {
      // If still fails, clear old monthly caches and non-essential history keys
      try {
        Object.keys(localStorage).forEach(lk => {
          if (lk.startsWith('akk_admin_schedule_cache_') || lk.startsWith('akk_images_')) {
            try { localStorage.removeItem(lk); } catch {}
          }
        });
        localStorage.setItem(key, value);
        return true;
      } catch {
        // Return false silently so app continues operating smoothly in memory without crashing React
        return false;
      }
    }
  }
}

export type EntityType = 'schedule' | 'fleet' | 'crew' | 'store' | 'image' | 'manifest' | 'admin_schedule' | 'fuel' | 'approval';
export type EntityAction = 'create' | 'update' | 'delete' | 'status_change' | 'upload';

export interface EntityChangeEvent<T = any> {
  entityType: EntityType;
  action: EntityAction;
  id: string;
  data: T;
  previousData?: T;
  timestamp: string;
  metadata?: Record<string, any>;
}

export type StoreMiddleware = (event: EntityChangeEvent) => Promise<void> | void;

class LogisticsStore {
  private fleets: Fleet[] = [];
  private crews: Crew[] = [];
  private stores: RetailStore[] = [];
  private schedules: Schedule[] = [];
  private devices: TracksolidDevice[] = [];
  private users: UserProfile[] = [];
  private currentUser: UserProfile;
  private supabaseConfig: SupabaseConfig;
  private crewHistory: CrewDeliveryHistory[] = [];
  private areaApprovals: AreaApprovalRequest[] = [];
  private areaThreshold: number = 3;
  private salesOrders: SalesOrder[] = [];
  private adminActivities: AdminActivity[] = [];
  private adminSchedules: AdminSchedule[] = [];
  private loadingRecords: LoadingDurationRecord[] = [];
  private skillProfiles: AdminSkillProfile[] = [];
  private jobdeskConfigs: JobdeskConfig[] = [];
  private systemActivities: SystemActivity[] = [];
  private spareParts: SparePart[] = [];
  private sparePartUsages: SparePartUsage[] = [];
  private fuelLogs: FuelLog[] = [];
  private imageRecords: ImageRecord[] = [];
  private scannedDocuments: ScannedDocumentLog[] = [];
  private securityLogs: SecurityGateLog[] = [];
  private scheduleChangeLogs: ScheduleChangeLogEntry[] = [];
  private autoSyncStatus: AutoSyncStatus = {
    isSyncing: false,
    lastSyncTime: null,
    syncedCount: 0,
    pendingQueue: 0,
    lastError: null,
    lastSyncedEntity: null
  };
  private autoSyncListeners: Array<(status: AutoSyncStatus) => void> = [];
  private listeners: Array<() => void> = [];
  private notificationListeners: Array<(notif: any) => void> = [];
  private middlewares: StoreMiddleware[] = [];
  private offlineScheduleQueue: OfflineScheduleStatusUpdate[] = [];

  constructor() {
    const isProd = Boolean(import.meta.env.PROD);
    this.offlineScheduleQueue = this.loadFromStorage('akk_offline_sync_queue', []);
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => {
        this.syncOfflineQueueToSupabase();
      });
      window.addEventListener('storage', (e) => {
        if (e.key && Object.values(STORAGE_KEYS).includes(e.key)) {
          this.fleets = this.loadFromStorage(STORAGE_KEYS.FLEETS, isProd ? [] : INITIAL_FLEETS);
          this.crews = this.loadFromStorage(STORAGE_KEYS.CREWS, isProd ? [] : INITIAL_CREWS);
          this.stores = this.loadFromStorage(STORAGE_KEYS.STORES, isProd ? [] : INITIAL_STORES);
          this.schedules = this.loadFromStorage(STORAGE_KEYS.SCHEDULES, []);
          this.users = this.loadFromStorage(STORAGE_KEYS.USERS, isProd ? [] : INITIAL_PROFILES);
          this.crewHistory = this.loadFromStorage(STORAGE_KEYS.CREW_HISTORY, isProd ? [] : INITIAL_CREW_HISTORY);
          this.notify();
        }
      });
      setInterval(() => {
        if (navigator.onLine && this.offlineScheduleQueue.length > 0) {
          this.syncOfflineQueueToSupabase();
        }
      }, 30000);
    }
    this.fleets = this.loadFromStorage(STORAGE_KEYS.FLEETS, isProd ? [] : INITIAL_FLEETS);
    this.crews = this.loadFromStorage(STORAGE_KEYS.CREWS, isProd ? [] : INITIAL_CREWS);
    this.stores = this.loadFromStorage(STORAGE_KEYS.STORES, isProd ? [] : INITIAL_STORES);
    this.schedules = this.loadFromStorage(STORAGE_KEYS.SCHEDULES, []);
    this.devices = this.loadFromStorage(STORAGE_KEYS.DEVICES, isProd ? [] : INITIAL_TRACKSOLID_DEVICES);
    this.users = this.loadFromStorage(STORAGE_KEYS.USERS, isProd ? [] : INITIAL_PROFILES);

    // Initial authentication session from sessionStorage (Menutup browser otomatis mereset sesi)
    const sessionUserId = typeof sessionStorage !== 'undefined' ? sessionStorage.getItem(STORAGE_KEYS.AUTH_SESSION) : null;
    if (sessionUserId) {
      const activeMatch = this.users.find(u => u.id === sessionUserId && u.status === 'approved');
      this.currentUser = activeMatch ? { ...activeMatch } : { ...GUEST_USER_PROFILE };
    } else {
      this.currentUser = { ...GUEST_USER_PROFILE };
    }

    // Kosongkan jadwal awal secara otomatis (one-time migration v4) sesuai instruksi operasional
    try {
      if (typeof localStorage !== 'undefined' && localStorage.getItem('akk_schedules_empty_init_v4') !== 'true') {
        this.schedules = [];
        this.saveToStorage(STORAGE_KEYS.SCHEDULES, []);
        localStorage.removeItem('akk_driver_cached_deliveries_v2');
        localStorage.setItem('akk_schedules_empty_init_v4', 'true');
      }
    } catch {}

    // Passwords are never stored in browser state; authentication is handled by Hostinger MySQL.
    if (!isProd && (!this.users || this.users.length === 0)) {
      const existingById = new Map((this.users || []).map(u => [u.id, u]));
      this.users = INITIAL_PROFILES.map(initU => {
        const existing = existingById.get(initU.id);
        return {
          ...(existing || {} as UserProfile),
          ...initU,
          password: undefined,
          permissions: existing?.permissions || initU.permissions,
          status: existing?.status || initU.status
        } as UserProfile;
      });
    }
    this.users = (this.users || []).map(u => ({ ...u, password: undefined } as UserProfile));
    this.saveToStorage(STORAGE_KEYS.USERS, this.users);

    // Sync active session if authenticated
    if (this.currentUser && this.currentUser.id !== 'guest') {
      const match = this.users.find(u => u.id === this.currentUser.id && u.status === 'approved');
      if (match) {
        this.currentUser = { ...match };
        this.saveToStorage(STORAGE_KEYS.CURRENT_USER, this.currentUser);
      } else {
        this.currentUser = { ...GUEST_USER_PROFILE };
        try {
          if (typeof sessionStorage !== 'undefined') {
            sessionStorage.removeItem(STORAGE_KEYS.AUTH_SESSION);
          }
        } catch {}
      }
    }
    this.crewHistory = this.loadFromStorage(STORAGE_KEYS.CREW_HISTORY, isProd ? [] : INITIAL_CREW_HISTORY);
    this.areaApprovals = this.loadFromStorage(STORAGE_KEYS.AREA_APPROVALS, isProd ? [] : INITIAL_AREA_APPROVALS);
    this.areaThreshold = this.loadFromStorage(STORAGE_KEYS.AREA_THRESHOLD, 3);
    this.salesOrders = this.loadFromStorage(STORAGE_KEYS.SALES_ORDERS, isProd ? [] : INITIAL_SALES_ORDERS);
    this.adminActivities = this.loadFromStorage(STORAGE_KEYS.ADMIN_ACTIVITIES, isProd ? [] : INITIAL_ADMIN_ACTIVITIES);
    this.adminSchedules = this.loadFromStorage(STORAGE_KEYS.ADMIN_SCHEDULES, isProd ? [] : INITIAL_ADMIN_SCHEDULES);
    this.loadingRecords = this.loadFromStorage(STORAGE_KEYS.LOADING_RECORDS, isProd ? [] : INITIAL_LOADING_RECORDS);
    this.skillProfiles = this.loadFromStorage(STORAGE_KEYS.SKILL_PROFILES, isProd ? [] : INITIAL_SKILL_PROFILES);
    this.jobdeskConfigs = this.loadFromStorage(STORAGE_KEYS.JOBDESK_CONFIGS, isProd ? [] : INITIAL_JOBDESK_CONFIGS);
    this.spareParts = this.loadFromStorage(STORAGE_KEYS.SPARE_PARTS, isProd ? [] : INITIAL_SPARE_PARTS);
    this.sparePartUsages = this.loadFromStorage(STORAGE_KEYS.SPARE_PART_USAGES, isProd ? [] : INITIAL_SPARE_PART_USAGES);
    this.fuelLogs = this.loadFromStorage(STORAGE_KEYS.FUEL_LOGS, isProd ? [] : INITIAL_FUEL_LOGS);
    this.imageRecords = this.loadFromStorage(STORAGE_KEYS.IMAGES, []);
    this.scannedDocuments = this.loadFromStorage(STORAGE_KEYS.SCANNED_DOCUMENTS, isProd ? [] : INITIAL_SCANNED_DOCUMENTS);
    this.securityLogs = this.loadFromStorage(STORAGE_KEYS.SECURITY_LOGS, isProd ? [] : INITIAL_SECURITY_LOGS);
    this.scheduleChangeLogs = this.loadFromStorage(STORAGE_KEYS.SCHEDULE_CHANGE_LOGS, isProd ? [] : INITIAL_SCHEDULE_CHANGE_LOGS);
    this.systemActivities = this.loadFromStorage('akk_system_activities_v1', []);
    // Legacy config object retained only so older UI state does not crash after migration.
    // No Supabase URL/key is embedded in the browser anymore; Hostinger MySQL is accessed via /api/*.
    const savedSupabaseConf = this.loadFromStorage(STORAGE_KEYS.SUPABASE_CONFIG, {
      url: '',
      anonKey: '',
      isConnected: true
    });
    this.supabaseConfig = {
      url: savedSupabaseConf?.url || '',
      anonKey: savedSupabaseConf?.anonKey || '',
      isConnected: savedSupabaseConf?.isConnected ?? true
    };

    // Synchronize crew pool directly with User Management (driver & crew_helper)
    if (!this.crews || !Array.isArray(this.crews)) {
      this.crews = [];
    }

    if (!isProd) {
      const isCorruptedStackedStores = this.stores && this.stores.length > 5 && this.stores.filter(s => Math.abs(s.latitude - (-8.36)) < 0.01 && Math.abs(s.longitude - 114.15) < 0.01).length > this.stores.length * 0.8;
      if (!this.stores || this.stores.length === 0 || isCorruptedStackedStores) {
        this.stores = [...INITIAL_STORES];
        this.saveToStorage(STORAGE_KEYS.STORES, this.stores);
      } else {
        let storesUpdated = false;
        const filteredStores = this.stores.filter(s => !isAreaRouteItem(s));
        if (filteredStores.length !== this.stores.length) {
          storesUpdated = true;
        }
        this.stores = filteredStores.map((s, idx) => {
          const ref = INITIAL_STORES.find(initS => initS.id === s.id || initS.storeCode === s.storeCode || initS.storeName.toLowerCase() === (s.storeName || '').toLowerCase());
          const nextKecamatan = s.kecamatan || ref?.kecamatan || ((s.city || '').match(/\((.*?)\)/)?.[1]) || s.city || 'Genteng';
          const nextKabupaten = s.kabupaten || ref?.kabupaten || (s.city || '').replace(/\s*\(.*?\)/g, '').replace(/^Kota\s+/i, '') || 'Banyuwangi';
          const nextNomor = s.nomor ?? ref?.nomor ?? idx + 1;
          if (s.kecamatan !== nextKecamatan || s.kabupaten !== nextKabupaten || s.nomor !== nextNomor) {
            storesUpdated = true;
            return {
              ...s,
              nomor: nextNomor,
              kecamatan: nextKecamatan,
              kabupaten: nextKabupaten
            };
          }
          return s;
        });

        INITIAL_STORES.forEach(initStore => {
          const exists = this.stores.some(
            s => s.id === initStore.id || s.storeCode === initStore.storeCode || (s.storeName || '').trim().toLowerCase() === initStore.storeName.trim().toLowerCase()
          );
          if (!exists) {
            this.stores.push({ ...initStore });
            storesUpdated = true;
          }
        });

        if (storesUpdated) {
          this.saveToStorage(STORAGE_KEYS.STORES, this.stores);
        }
      }
    } else {
      this.stores = Array.isArray(this.stores) ? this.stores.filter(s => !isAreaRouteItem(s)) : [];
    }

    this.runDataMigrations();
  }

  private deduplicateSuperAdmins(usersList: UserProfile[]): UserProfile[] {
    const isProd = Boolean(import.meta.env.PROD);
    let primarySuperAdmin: UserProfile | null = null;
    const filtered: UserProfile[] = [];

    for (const u of usersList) {
      // Fix legacy usr-hendri role if still super_admin
      if (u.id === 'usr-hendri' && u.role === 'super_admin') {
        filtered.push({
          ...u,
          role: 'operasional',
          permissions: { modules: getDefaultPermissionsForRole('operasional') }
        });
        continue;
      }

      const isDuplicateSuperAdmin =
        u.role === 'super_admin' ||
        u.id === 'usr-001' ||
        u.id.startsWith('usr-preview-') ||
        u.id.startsWith('usr-bootstrap-') ||
        (u.fullName || '').trim().toLowerCase().startsWith('super admin') ||
        (u.email || '').trim().toLowerCase() === 'admin@gmail.com';

      if (isDuplicateSuperAdmin) {
        if (!primarySuperAdmin) {
          // Di production pertahankan identitas dari MySQL apa adanya.
          // Jangan pernah mengganti email/id user production menjadi nilai mock/default.
          primarySuperAdmin = {
            ...u,
            role: 'super_admin',
            department: u.department || 'Manajemen & Direksi',
            status: 'approved',
            permissions: { modules: getDefaultPermissionsForRole('super_admin') }
          };
          filtered.push(primarySuperAdmin);
        }
        continue;
      }

      filtered.push(u);
    }

    // Hanya preview/development yang boleh memiliki fallback user lokal.
    // Production harus mengambil user dari Hostinger MySQL; database kosong berarti UI kosong.
    if (!primarySuperAdmin && !isProd) {
      const previewDefault = INITIAL_PROFILES.find(u => u.role === 'super_admin');
      if (previewDefault) filtered.unshift({ ...previewDefault, password: undefined } as UserProfile);
    }

    return filtered;
  }

  private runDataMigrations() {
    // 1. Deduplicate Super Admin accounts so only 1 primary Super Admin exists
    this.users = this.deduplicateSuperAdmins(this.users);

    // 2. Ensure each user has valid permissions initialized for their role (and fix partial logistics submenus for SPV Logistik / Operasional / Pengiriman)
    const primaryLogisticsRoles = ['spv_logistik', 'operasional', 'pengiriman', 'dispatcher'];
    this.users = this.users.map(u => {
      if (!u.permissions || !u.permissions.modules || Object.keys(u.permissions.modules).length === 0) {
        return {
          ...u,
          permissions: {
            modules: getDefaultPermissionsForRole(u.role)
          }
        };
      }
      if (primaryLogisticsRoles.includes(u.role)) {
        const logMod = u.permissions.modules.logistics;
        const activeSubCount = logMod?.subMenus
          ? Object.values(logMod.subMenus).filter(lvl => lvl !== 'none').length
          : 0;
        if (!logMod || !logMod.enabled || activeSubCount <= 1) {
          const defaultMods = getDefaultPermissionsForRole(u.role);
          return {
            ...u,
            permissions: {
              modules: {
                ...defaultMods,
                ...u.permissions.modules,
                logistics: defaultMods.logistics
              }
            }
          };
        }
      }
      return u;
    });
    this.saveToStorage(STORAGE_KEYS.USERS, this.users);

    if (this.currentUser) {
      const matchedUser = this.users.find(u => u.id === this.currentUser.id || u.role === this.currentUser.role);
      if (matchedUser) {
        this.currentUser = {
          ...matchedUser
        };
        this.saveToStorage(STORAGE_KEYS.CURRENT_USER, this.currentUser);
      } else if (!this.currentUser.permissions) {
        this.currentUser = {
          ...this.currentUser,
          permissions: {
            modules: getDefaultPermissionsForRole(this.currentUser.role)
          }
        };
        this.saveToStorage(STORAGE_KEYS.CURRENT_USER, this.currentUser);
      }
    }

    // Synchronize crews strictly with User Management (driver & crew_helper)
    this.syncUsersWithCrews();

    let updatedFleets = false;

    // Purge any fleet whose plate number ends with 'AKK'
    const hasAkkFleets = this.fleets.some(f => (f.plateNumber || '').trim().toUpperCase().endsWith('AKK'));
    if (hasAkkFleets) {
      this.fleets = this.fleets.filter(f => !(f.plateNumber || '').trim().toUpperCase().endsWith('AKK'));
      updatedFleets = true;
    }

    // Merge initial fleets only in development preview mode
    if (!import.meta.env.PROD) {
      INITIAL_FLEETS.forEach(initF => {
        const exists = this.fleets.some(f => f.id === initF.id || f.plateNumber === initF.plateNumber);
        if (!exists && !(initF.plateNumber || '').toUpperCase().endsWith('AKK')) {
          this.fleets.push({ ...initF });
          updatedFleets = true;
        }
      });
    }

    this.fleets = this.fleets.map((f, idx) => {
      let changed = false;

      // Migrate specific vehicle P 8125 VC (Mitsubishi L300)
      if (f.id === 'flt-01' || f.plateNumber === 'B 9421 UXT') {
        return {
          ...f,
          id: 'flt-01',
          plateNumber: 'P 8125 VC',
          vehicleType: 'Pick Up Box',
          initialCode: 'N1 / NP1',
          brand: 'Mitsubishi L300',
          engineCc: '2477 CC',
          boxCapacityM3: 5.5,
          boxDimensions: '2.4 x 1.6 x 1.4 m',
          year: 2004,
          gpsImei: '',
          lastMaintenance: '2026-12-23',
          taxDueDate: '2027-06-25',
          stnkExpiryDate: '2029-06-25'
        };
      }

      // Migrate specific vehicle P 8509 VQ (Traga Pick Up Box)
      if (f.id === 'flt-02' || f.plateNumber === 'B 9128 UYX') {
        return {
          ...f,
          id: 'flt-02',
          plateNumber: 'P 8509 VQ',
          vehicleType: 'Pick Up Box',
          initialCode: 'A3 / NP3',
          brand: 'Traga',
          engineCc: '2499 CC',
          boxCapacityM3: 6.2,
          boxDimensions: '2.8 x 1.6 x 1.4 m',
          year: 2021,
          gpsImei: '',
          lastMaintenance: '2027-02-05',
          taxDueDate: '2027-08-03',
          stnkExpiryDate: '2031-08-03'
        };
      }

      // Migrate specific vehicle P 8848 U (Mitsubishi Canter Engkel STD)
      if (f.id === 'flt-03' || f.plateNumber === 'B 9802 KLS') {
        return {
          ...f,
          id: 'flt-03',
          plateNumber: 'P 8848 U',
          vehicleType: 'Engkel STD',
          initialCode: 'N3 / NS1',
          brand: 'Mitsubishi Canter',
          engineCc: '3908 CC',
          boxCapacityM3: 9.0,
          boxDimensions: '3.1 x 1.7 x 1.7 m',
          year: 2008,
          gpsImei: '',
          lastMaintenance: '2027-01-29',
          taxDueDate: '2027-08-03',
          stnkExpiryDate: '2027-08-03'
        };
      }

      // Migrate specific vehicle P 9677 VB (Mitsubishi Canter Engkel STD)
      if (f.id === 'flt-04' || f.plateNumber === 'B 9301 TXR') {
        return {
          ...f,
          id: 'flt-04',
          plateNumber: 'P 9677 VB',
          vehicleType: 'Engkel STD',
          initialCode: 'N4 / NS2',
          brand: 'Mitsubishi Canter',
          engineCc: '3298 CC',
          boxCapacityM3: 9.0,
          boxDimensions: '3.1 x 1.7 x 1.7 m',
          year: 2005,
          gpsImei: '',
          lastMaintenance: '2026-11-27',
          taxDueDate: '2027-05-17',
          stnkExpiryDate: '2029-05-27'
        };
      }

      // Migrate specific vehicle P 8801 UV (Mitsubishi Canter Engkel STD)
      if (f.id === 'flt-05' || f.plateNumber === 'B 9655 PQZ') {
        return {
          ...f,
          id: 'flt-05',
          plateNumber: 'P 8801 UV',
          vehicleType: 'Engkel STD',
          initialCode: 'N5 / NS3',
          brand: 'Mitsubishi Canter',
          engineCc: '3908 CC',
          boxCapacityM3: 9.0,
          boxDimensions: '3.1 x 1.7 x 1.7 m',
          year: 2008,
          gpsImei: '',
          lastMaintenance: '2026-08-11',
          taxDueDate: '2026-10-07',
          stnkExpiryDate: '2026-10-07'
        };
      }

      // Migrate specific vehicle P 8381 VE (Hino Engkel Long)
      if (f.id === 'flt-06' || f.plateNumber === 'B 9044 MLK') {
        return {
          ...f,
          id: 'flt-06',
          plateNumber: 'P 8381 VE',
          vehicleType: 'Engkel Long',
          initialCode: 'N20 / NL1',
          brand: 'Hino',
          engineCc: '4009 CC',
          boxCapacityM3: 14.0,
          boxDimensions: '4.2 x 1.8 x 1.8 m',
          year: 2013,
          gpsImei: '',
          lastMaintenance: '2026-12-01',
          taxDueDate: '2027-01-16',
          stnkExpiryDate: '2030-01-16'
        };
      }

      let initialCode = f.initialCode;
      if (!initialCode) {
        changed = true;
        const prefix = f.vehicleType.includes('Wingbox') ? 'WB' :
                       f.vehicleType.includes('Fuso') ? 'FS' :
                       f.vehicleType.includes('CDD') ? 'CD' :
                       f.vehicleType.includes('CDE') ? 'CH' :
                       f.vehicleType.includes('Container') ? 'CT' : 'ARM';
        initialCode = `${prefix}-0${idx + 1}`;
      }
      let taxDueDate = f.taxDueDate;
      if (!taxDueDate) {
        changed = true;
        taxDueDate = '2026-11-20';
      }
      let stnkExpiryDate = f.stnkExpiryDate;
      if (!stnkExpiryDate) {
        changed = true;
        stnkExpiryDate = '2028-11-20';
      }
      let boxCapacityM3 = f.boxCapacityM3;
      let boxDimensions = f.boxDimensions;
      if (!boxCapacityM3) {
        changed = true;
        const matchingInit = INITIAL_FLEETS.find(initF => initF.id === f.id || initF.plateNumber === f.plateNumber);
        if (matchingInit && matchingInit.boxCapacityM3) {
          boxCapacityM3 = matchingInit.boxCapacityM3;
          boxDimensions = matchingInit.boxDimensions;
        } else if (f.vehicleType === 'Pick Up Box') {
          boxCapacityM3 = (f.brand || '').toLowerCase().includes('traga') ? 6.2 : 5.5;
          boxDimensions = (f.brand || '').toLowerCase().includes('traga') ? '2.8 x 1.6 x 1.4 m' : '2.4 x 1.6 x 1.4 m';
        } else if (f.vehicleType === 'Engkel Long') {
          boxCapacityM3 = 14.0;
          boxDimensions = '4.2 x 1.8 x 1.8 m';
        } else if (f.vehicleType === 'Engkel STD') {
          boxCapacityM3 = 9.0;
          boxDimensions = '3.1 x 1.7 x 1.7 m';
        } else if (f.vehicleType === 'Double STD') {
          boxCapacityM3 = (f.brand || '').toLowerCase().includes('isuzu') ? 18.0 : 17.5;
          boxDimensions = (f.brand || '').toLowerCase().includes('isuzu') ? '4.4 x 2.0 x 2.0 m' : '4.3 x 2.0 x 2.0 m';
        } else {
          boxCapacityM3 = 10.0;
          boxDimensions = '3.5 x 1.8 x 1.8 m';
        }
      }
      if (changed) {
        updatedFleets = true;
        return {
          ...f,
          initialCode,
          taxDueDate,
          stnkExpiryDate,
          boxCapacityM3,
          boxDimensions
        };
      }
      return f;
    });

    // Sinkronisasi status armada (Ready / Kirim / Servis) dengan jadwal pengiriman aktif:
    // - Status 'maintenance' (Servis) tetap dipertahankan.
    // - Status 'on-duty' (Kirim) hanya aktif apabila armada sedang memiliki jadwal yang sudah Gate-Out ('in_transit' / 'picked_up' / 'delayed').
    // - Selain itu otomatis menjadi 'available' (Ready) agar siap digunakan jadwal berikutnya.
    this.fleets = this.fleets.map(f => {
      if (f.status === 'maintenance') return f;
      const hasActiveTrip = (this.schedules || []).some(
        sch =>
          ['in_transit', 'picked_up', 'delayed'].includes(sch.status) &&
          (sch.fleetId === f.id ||
            (sch.fleet?.plateNumber &&
              sch.fleet.plateNumber.trim().toUpperCase() === f.plateNumber.trim().toUpperCase()))
      );
      const targetStatus: Fleet['status'] = hasActiveTrip ? 'on-duty' : 'available';
      if (f.status !== targetStatus) {
        updatedFleets = true;
        return { ...f, status: targetStatus };
      }
      return f;
    });

    this.saveToStorage(STORAGE_KEYS.FLEETS, this.fleets);

    // Auto-migrate any cached state from Cikarang DC to Banyuwangi DC & sanitize combined Denpasar 1 & 2
    let updatedSchedules = false;
    this.schedules = this.schedules.map(s => {
      let nextS = s;
      if (s.originCoords && s.originCoords[0] === -6.3262) {
        updatedSchedules = true;
        nextS = {
          ...nextS,
          originName: 'Gudang Pusat Banyuwangi DC',
          originCoords: [-8.1906, 114.3708] as [number, number]
        };
      }
      const rawA = (nextS.areaName || nextS.store?.storeName || '').trim().toUpperCase();
      if (rawA === 'DENPASAR 1 & 2' || rawA === 'DENPASAR 1&2' || rawA === 'DENPASAR') {
        updatedSchedules = true;
        nextS = {
          ...nextS,
          areaName: 'DENPASAR 1',
          store: nextS.store ? { ...nextS.store, storeName: 'DENPASAR 1', address: 'Area Pengiriman Distribusi DENPASAR 1' } : nextS.store
        };
      }
      return nextS;
    });
    if (updatedSchedules) {
      this.saveToStorage(STORAGE_KEYS.SCHEDULES, this.schedules);
    }

    // Jangan menyuntikkan fuel log contoh di production. Hanya migrasikan record yang memang sudah ada.
    if (!import.meta.env.PROD && this.fuelLogs.length < INITIAL_FUEL_LOGS.length) {
      this.fuelLogs = [...INITIAL_FUEL_LOGS];
      this.saveToStorage(STORAGE_KEYS.FUEL_LOGS, this.fuelLogs);
    } else {
      let updatedFuel = false;
      this.fuelLogs = this.fuelLogs.map(l => {
        if (l.literPerKm === undefined || l.literPer100Km === undefined) {
          updatedFuel = true;
          const dist = l.distanceKm > 0 ? l.distanceKm : Math.max(0, l.endOdometerKm - l.startOdometerKm);
          return {
            ...l,
            distanceKm: dist,
            literPerKm: dist > 0 ? Number((l.liters / dist).toFixed(4)) : 0,
            literPer100Km: dist > 0 ? Number(((l.liters / dist) * 100).toFixed(2)) : 0
          };
        }
        return l;
      });
      if (updatedFuel) {
        this.saveToStorage(STORAGE_KEYS.FUEL_LOGS, this.fuelLogs);
      }
    }

    // Ensure GPS devices in development preview mode only (do not inject mock devices in production)
    if (!import.meta.env.PROD) {
      const hasLeadDevice = this.devices.some(d => d.imei === '353701090461274');
      if (!hasLeadDevice || this.devices.length !== INITIAL_TRACKSOLID_DEVICES.length) {
        this.devices = [...INITIAL_TRACKSOLID_DEVICES];
        this.saveToStorage(STORAGE_KEYS.DEVICES, this.devices);
      } else {
        let updatedDevices = false;
        this.devices = this.devices.map(d => {
          if (d.latitude === -6.3262 && d.longitude === 107.1518) {
            updatedDevices = true;
            return {
              ...d,
              latitude: -8.1906,
              longitude: 114.3708,
              address: 'Staging Area Gudang Pusat Banyuwangi DC (Gate 2, Jl. Argopuro No.60)'
            };
          }
          return d;
        });
        if (updatedDevices) {
          this.saveToStorage(STORAGE_KEYS.DEVICES, this.devices);
        }
      }
    }

    // Auto-sync all active schedules directly into Crew Delivery History & Authorization
    this.syncSchedulesToCrewHistory(this.schedules);

    // Register built-in Middleware: Automated write to backend / Google Sheets / Image Storage / Activity Audit
    this.registerDefaultMiddlewares();

    // Auto-sync active user session with driver portal identity
    this.syncCurrentUserToCrew();
  }

  /**
   * RBAC Middleware Guard: Ensures users with 'driver' or 'crew_helper' roles cannot access or execute operational or administrative tasks outside of 'Portal Driver Mobile'.
   */
  public verifyDriverAccess(actionCategory: string): void {
    const user = this.getCurrentUser();
    if (user && (user.role === 'driver' || user.role === 'crew_helper')) {
      const allowedActions = [
        'update_schedule_status',
        'upload_pod',
        'driver_report',
        'checkin',
        'vehicle_checklist',
        'sign_waybill',
        'get_schedules',
        'get_fleets',
        'get_crews',
        'updateScheduleStatus',
        'uploadPod',
        'getSchedules',
        'getStores'
      ];
      if (!allowedActions.includes(actionCategory)) {
        throw new Error(`Akses Ditolak [RBAC Middleware]: Peran '${user.role}' (${user.fullName}) tidak diizinkan mengakses fungsi admin/operasional '${actionCategory}'. Akses dibatasi khusus Portal Driver Mobile.`);
      }
    }
  }

  /**
   * RBAC Helper: Checks if a role has access to specific sub-menu or operation
   */
  public hasSubMenuAccess(role?: string, module?: string, subMenu?: string, accessLevel?: string): boolean {
    if (!role) return true;
    const r = String(role).toLowerCase();
    if (r === 'super_admin' || r === 'spv_logistik' || r === 'operasional' || r === 'pengiriman' || r === 'dispatcher' || r === 'admin') {
      return true;
    }
    if (r === 'driver' || r === 'crew_helper' || r === 'helper') {
      return subMenu === 'driver_mobile' || subMenu === 'driver_reports';
    }
    return true;
  }

  public hasMenuAccess(role?: string, menuId?: string): boolean {
    if (!role) return true;
    const r = String(role).toLowerCase();
    if (r === 'super_admin' || r === 'spv_logistik' || r === 'operasional' || r === 'pengiriman' || r === 'dispatcher' || r === 'admin') {
      return true;
    }
    if (r === 'driver' || r === 'crew_helper' || r === 'helper') {
      return menuId === 'driver_mobile' || menuId === 'driver_reports';
    }
    return true;
  }

  /**
   * Register core middlewares that automatically process writes, Google Sheets sync, images, and telemetry
   */
  private registerDefaultMiddlewares() {
    // 1. Backend Auto-Writer & Queue Middleware
    this.use(async (event: EntityChangeEvent) => {
      await this.handleBackendAutoWrite(event);
    });

    // 2. Google Sheets & Cloud Schedule Auto-Write Middleware
    this.use(async (event: EntityChangeEvent) => {
      await this.handleGoogleSheetsAutoWrite(event);
    });

    // 3. Fleet & Crew Status Auto-Sync Middleware
    this.use(async (event: EntityChangeEvent) => {
      await this.handleFleetCrewStatusAutoSync(event);
    });

    // 4. Image & Document Storage Middleware
    this.use(async (event: EntityChangeEvent) => {
      await this.handleImageStorageAutoSync(event);
    });

    // 5. System Audit Activity Trail Middleware
    this.use(async (event: EntityChangeEvent) => {
      await this.handleSystemAuditMiddleware(event);
    });
  }

  /**
   * Backend auto-writer that asynchronously sends entity updates to /api/sync-entity with debounce and retry handling
   */
  private async handleBackendAutoWrite(event: EntityChangeEvent) {
    // Skip single-item backend sync on bulk/batch operations to prevent network flooding and thread lockup
    if (event.metadata?.isBatch || event.metadata?.source === 'google_sheets_sync') {
      return;
    }

    // Non-blocking background sync
    setTimeout(async () => {
      this.autoSyncStatus = {
        ...this.autoSyncStatus,
        isSyncing: true,
        pendingQueue: this.autoSyncStatus.pendingQueue + 1
      };
      this.notifyAutoSync();

      try {
        const response = await fetch('/api/sync-entity', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(event)
        });

        if (response.ok) {
          this.autoSyncStatus = {
            isSyncing: false,
            lastSyncTime: new Date().toISOString(),
            syncedCount: this.autoSyncStatus.syncedCount + 1,
            pendingQueue: Math.max(0, this.autoSyncStatus.pendingQueue - 1),
            lastError: null,
            lastSyncedEntity: `${event.entityType}:${event.action}`
          };
        } else {
          this.autoSyncStatus = {
            ...this.autoSyncStatus,
            isSyncing: false,
            pendingQueue: Math.max(0, this.autoSyncStatus.pendingQueue - 1)
          };
        }
      } catch {
        this.autoSyncStatus = {
          ...this.autoSyncStatus,
          isSyncing: false,
          pendingQueue: Math.max(0, this.autoSyncStatus.pendingQueue - 1),
          lastError: null,
          lastSyncTime: new Date().toISOString()
        };
      }
      this.notifyAutoSync();
    }, 10);
  }

  /**
   * Google Sheets auto-write handler for schedules and admin spreadsheet weeks
   */
  private async handleGoogleSheetsAutoWrite(event: EntityChangeEvent) {
    // Prevent recursion if the change originated from Google Sheets sync or is a batch import
    if (event.metadata?.source === 'google_sheets_sync' || event.metadata?.isBatch) {
      return;
    }

    // Run in background timeout so main thread is never frozen
    setTimeout(async () => {
      try {
        if (event.entityType === 'schedule') {
          if (googleSheetsApiService) {
            if (event.action === 'create' || event.action === 'update' || event.action === 'status_change') {
              googleSheetsApiService.writeScheduleToGoogleSheets(event.data, event.action === 'status_change' ? 'update' : event.action).catch(() => {});
            }
          }
        } else if (event.entityType === 'admin_schedule' && event.action === 'update') {
          localStorage.setItem('akk_last_admin_schedule_auto_synced', new Date().toISOString());
        }
      } catch (err) {
        console.warn('[Google Sheets Auto-Write Middleware Warning]', err);
      }
    }, 20);
  }

  /**
   * Fleet and crew status auto-sync handler
   */
  private async handleFleetCrewStatusAutoSync(event: EntityChangeEvent) {
    if (event.metadata?.isBatch) return;

    setTimeout(async () => {
      try {
        if (event.entityType === 'fleet' && (event.action === 'status_change' || event.action === 'update')) {
          if (googleSheetsApiService) {
            googleSheetsApiService.writeFleetStatusToGoogleSheets(
              event.id,
              event.data?.status || 'available',
              event.data
            ).catch(() => {});
          }
        }
      } catch (err) {
        console.warn('[Fleet Status Auto-Sync Warning]', err);
      }
    }, 20);
  }

  /**
   * Image and document storage auto-sync handler
   */
  private async handleImageStorageAutoSync(event: EntityChangeEvent) {
    try {
      if (event.entityType === 'image' || event.entityType === 'manifest') {
        const payload = event.data || {};
        const newImg: ImageRecord = {
          id: payload.id || `img-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`,
          entityId: payload.entityId || payload.scheduleId || event.id,
          entityType: payload.entityType || (event.entityType === 'manifest' ? 'manifest' : 'schedule'),
          imageUrl: payload.imageUrl || payload.url || '',
          category: payload.category || payload.type || 'proof_of_delivery',
          title: payload.title || `Unggah ${payload.type || 'Gambar'}`,
          notes: payload.notes,
          uploadedBy: payload.uploadedBy || this.currentUser.fullName,
          timestamp: payload.timestamp || new Date().toISOString(),
          syncedToCloud: true
        };

        // Store image record
        const exists = this.imageRecords.some(img => img.id === newImg.id);
        if (!exists) {
          this.imageRecords = [newImg, ...this.imageRecords];
          this.saveToStorage(STORAGE_KEYS.IMAGES, this.imageRecords);
        }

        // Send to backend attachment proxy
        if (googleSheetsApiService) {
          googleSheetsApiService.writeImageAttachmentToBackend(
            newImg.entityId,
            newImg.imageUrl,
            newImg.category,
            newImg.notes
          ).catch(() => {});
        }
      }
    } catch (err) {
      console.warn('[Image Auto-Sync Warning]', err);
    }
  }

  /**
   * System audit activity auto-sync handler
   */
  private async handleSystemAuditMiddleware(event: EntityChangeEvent) {
    if (event.metadata?.isBatch || event.metadata?.source === 'google_sheets_sync') {
      return;
    }

    try {
      const targetLabel = `${event.entityType.toUpperCase()}: ${event.id}`;
      const actionLabel = `Auto-Sync [${event.action.toUpperCase()}]`;
      const details = `Middleware otomatis memicu proses penulisan entitas ${event.entityType} (${event.action}) ke Backend & Google Sheets`;

      const newActivity: SystemActivity = {
        id: `sys-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 5)}`,
        timestamp: new Date().toISOString(),
        userFullName: this.currentUser?.fullName || 'Sistem Auto-Sync Middleware',
        department: 'Sistem Integrasi Data & Google Sheets',
        action: actionLabel,
        target: targetLabel,
        details
      };

      this.systemActivities = [newActivity, ...this.systemActivities.slice(0, 25)];
      this.saveToStorage('akk_system_activities_v1', this.systemActivities);
    } catch {
      // Ignore non-critical audit log errors
    }
  }

  /**
   * Register a custom middleware that runs automatically on every entity creation, update, or status change
   */
  public use(middleware: StoreMiddleware): () => void {
    this.middlewares.push(middleware);
    return () => {
      this.middlewares = this.middlewares.filter(m => m !== middleware);
    };
  }

  /**
   * Dispatch an entity change event across all registered middlewares
   */
  public async dispatchMiddleware(event: EntityChangeEvent) {
    for (const mw of this.middlewares) {
      try {
        await mw(event);
      } catch (err) {
        console.warn(`[Store Middleware Error] ${event.entityType}:${event.action}`, err);
      }
    }
  }

  /**
   * Auto-Sync Status Observers
   */
  public getAutoSyncStatus(): AutoSyncStatus {
    return { ...this.autoSyncStatus };
  }

  public onAutoSyncStatusChange(listener: (status: AutoSyncStatus) => void): () => void {
    this.autoSyncListeners.push(listener);
    // Immediately invoke with current state
    try {
      listener({ ...this.autoSyncStatus });
    } catch {}
    return () => {
      this.autoSyncListeners = this.autoSyncListeners.filter(l => l !== listener);
    };
  }

  private notifyAutoSync() {
    this.autoSyncListeners.forEach(l => {
      try {
        l({ ...this.autoSyncStatus });
      } catch {}
    });
  }

  /**
   * Upload and manage entity images with automatic middleware dispatch
   */
  public uploadImage(record: Omit<ImageRecord, 'id' | 'timestamp'>): ImageRecord {
    const newRecord: ImageRecord = {
      ...record,
      id: `img-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`,
      timestamp: new Date().toISOString(),
      uploadedBy: record.uploadedBy || this.currentUser.fullName,
      syncedToCloud: true
    };

    this.imageRecords = [newRecord, ...this.imageRecords];
    this.saveToStorage(STORAGE_KEYS.IMAGES, this.imageRecords);

    this.dispatchMiddleware({
      entityType: 'image',
      action: 'upload',
      id: newRecord.entityId,
      data: newRecord,
      timestamp: newRecord.timestamp
    });

    this.logActivity('Unggah Gambar', newRecord.entityId, `Unggah ${newRecord.category}: ${newRecord.title || newRecord.id}`);
    this.notify();
    return newRecord;
  }

  public getImagesByEntity(entityId: string): ImageRecord[] {
    return this.imageRecords.filter(img => img.entityId === entityId);
  }

  public getAllImages(): ImageRecord[] {
    return [...this.imageRecords];
  }

  public deleteImage(id: string): void {
    const target = this.imageRecords.find(img => img.id === id);
    this.imageRecords = this.imageRecords.filter(img => img.id !== id);
    this.saveToStorage(STORAGE_KEYS.IMAGES, this.imageRecords);

    if (target) {
      this.dispatchMiddleware({
        entityType: 'image',
        action: 'delete',
        id: target.id,
        data: target,
        timestamp: new Date().toISOString()
      });
    }
    this.notify();
  }

  public attachFleetPhoto(fleetId: string, imageUrl: string, notes?: string) {
    this.uploadImage({
      entityId: fleetId,
      entityType: 'fleet',
      imageUrl,
      category: 'vehicle_condition',
      title: `Foto Kondisi Armada ${fleetId}`,
      notes
    });
  }

  public attachFuelReceiptPhoto(fuelLogId: string, imageUrl: string, notes?: string) {
    this.uploadImage({
      entityId: fuelLogId,
      entityType: 'fuel',
      imageUrl,
      category: 'fuel_receipt',
      title: `Foto Struk/Nota BBM ${fuelLogId}`,
      notes
    });
  }

  private loadFromStorage<T>(key: string, fallback: T): T {
    try {
      const data = localStorage.getItem(key);
      return data ? JSON.parse(data) : fallback;
    } catch {
      return fallback;
    }
  }

  private saveToStorage(key: string, data: any) {
    try {
      let sanitizedData = data;
      if (Array.isArray(data)) {
        if (key === STORAGE_KEYS.SCHEDULES) {
          // Strip duplicated heavy sub-objects before stringify while preserving lightweight crew/helper identity
          sanitizedData = data.slice(0, 5000).map((sch: any) => {
            if (!sch || typeof sch !== 'object') return sch;
            const { store, fleet, crew, crewHelper, crewHelper2, ...compact } = sch;
            return {
              ...compact,
              ...(crew && crew.name ? { crew: { id: crew.id, name: crew.name, phone: crew.phone, role: crew.role } } : {}),
              ...(crewHelper && crewHelper.name ? { crewHelper: { id: crewHelper.id, name: crewHelper.name, phone: crewHelper.phone, role: crewHelper.role } } : {}),
              ...(crewHelper2 && crewHelper2.name ? { crewHelper2: { id: crewHelper2.id, name: crewHelper2.name, phone: crewHelper2.phone, role: crewHelper2.role } } : {})
            };
          });
        } else if (key === STORAGE_KEYS.CREW_HISTORY) {
          // Compact crew history records and limit to 50 items max
          sanitizedData = data.slice(0, 50).map((item: any) => {
            if (!item || typeof item !== 'object') return item;
            return {
              id: item.id,
              crewId: item.crewId,
              crewName: item.crewName,
              scheduleId: item.scheduleId,
              trackingNumber: item.trackingNumber,
              storeName: item.storeName,
              area: item.area,
              city: item.city,
              island: item.island,
              vehiclePlate: item.vehiclePlate,
              initialCode: item.initialCode,
              vehicleType: item.vehicleType,
              completionDate: item.completionDate,
              status: item.status,
              onTimeStatus: item.onTimeStatus
            };
          });
        } else if (key === 'akk_system_activities_v1') {
          sanitizedData = data.slice(0, 20);
        } else if (key === STORAGE_KEYS.IMAGES) {
          sanitizedData = data.slice(0, 20);
        } else if (key === STORAGE_KEYS.SALES_ORDERS) {
          sanitizedData = data.slice(0, 50);
        }
      }
      safeSetItem(key, JSON.stringify(sanitizedData));
    } catch {
      // Safe fallback - in-memory state remains fully intact
    }
    this.notify();
  }

  private notify() {
    queueMicrotask(() => {
      this.listeners.forEach(l => {
        try {
          l();
        } catch (err) {
          console.error('[Store] listener error:', err);
        }
      });
    });
  }

  public subscribe(listener: () => void): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  public onNotification(listener: (notif: any) => void): () => void {
    this.notificationListeners.push(listener);
    return () => {
      this.notificationListeners = this.notificationListeners.filter(l => l !== listener);
    };
  }

  public emitNotification(type: 'delivery' | 'checker' | 'schedule' | 'sla_warning' | 'geofence', title: string, message: string, urgent?: boolean, data?: any) {
    // Jika pengguna aktif adalah Driver atau Helper dan notifikasi terkait jadwal tertentu,
    // pastikan hanya driver yang ditugaskan pada jadwal tersebut yang menerima notifikasi.
    if (data?.schedule) {
      const role = String(this.currentUser?.role || '').toLowerCase();
      if (role === 'driver' || role === 'crew_helper') {
        const activeCrew = this.getActiveDriverCrew();
        const targetId = (activeCrew?.id || this.currentUser?.id || '').trim().toLowerCase();
        const targetName = (activeCrew?.name || this.currentUser?.fullName || '').trim().toLowerCase();
        const sch = data.schedule as Schedule;
        const crewIds = [sch.crewId, sch.crewHelperId, sch.crewHelper2Id, sch.crew?.id]
          .filter(Boolean)
          .map(x => String(x).trim().toLowerCase());
        const crewNames = [sch.crew?.name, sch.crewHelper?.name, sch.crewHelper2?.name]
          .filter(Boolean)
          .map(x => String(x).trim().toLowerCase());

        const strippedTargetId = targetId.replace(/^(usr-|crw-)/, '');
        const idMatched = Boolean(
          targetId &&
            crewIds.some(cid => cid === targetId || (strippedTargetId.length >= 3 && cid.replace(/^(usr-|crw-)/, '') === strippedTargetId))
        );
        const nameMatched = Boolean(
          targetName &&
            targetName.length >= 3 &&
            crewNames.some(cname => cname === targetName || cname.includes(targetName) || targetName.includes(cname))
        );

        if (!idMatched && !nameMatched) {
          return;
        }
      }
    }
    this.notificationListeners.forEach(l => l({ type, title, message, urgent, data }));
  }

  // Getters
  public getSecurityLogs(): SecurityGateLog[] {
    return [...this.securityLogs];
  }

  public addSecurityLog(logData: Omit<SecurityGateLog, 'id' | 'timestamp'>): SecurityGateLog {
    const newLog: SecurityGateLog = {
      ...logData,
      id: `SEC-${Math.floor(100 + Math.random() * 900)}`,
      timestamp: new Date().toISOString()
    };
    this.securityLogs = [newLog, ...this.securityLogs].slice(0, 100);
    this.saveToStorage(STORAGE_KEYS.SECURITY_LOGS, this.securityLogs);
    this.notify();
    return newLog;
  }

  public recordGateOut(
    scheduleId: string | undefined,
    plateNumber: string,
    driverName: string,
    destination: string,
    initialCode?: string
  ): SecurityGateLog {
    const now = new Date();
    const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')} WIB`;
    const fleetInitial = initialCode || (this.fleets.find(f => f.plateNumber.replace(/\s+/g, '') === (plateNumber || '').replace(/\s+/g, ''))?.initialCode);
    const initialText = fleetInitial ? ` [${fleetInitial}]` : '';

    if (scheduleId) {
      const sch = this.schedules.find(s => s.id === scheduleId);
      if (sch && (sch.status === 'scheduled' || sch.status === 'picked_up')) {
        sch.status = 'in_transit';
        this.saveToStorage(STORAGE_KEYS.SCHEDULES, this.schedules);
      }
    }

    const newLog = this.addSecurityLog({
      time: timeStr,
      type: 'Kendaraan Keluar',
      entity: `${plateNumber}${initialText}`,
      initialCode: fleetInitial,
      driver: driverName || 'Driver AKK',
      purpose: `Pengiriman ke ${destination || 'Area Distribusi'} (Gate-Out)`,
      status: 'Gate-Out',
      scheduleId,
      plateNumber,
      securityOfficer: 'Pos Satpam Gerbang DC'
    });

    this.emitNotification(
      'schedule',
      'Kendaraan Keluar (Gate-Out)',
      `Armada ${plateNumber}${initialText} (${driverName}) resmi dicatat Gate-Out oleh Security.`,
      false
    );
    return newLog;
  }

  public recordGateIn(
    scheduleId: string | undefined,
    plateNumber: string,
    driverName: string,
    notes?: string,
    initialCode?: string
  ): SecurityGateLog {
    const now = new Date();
    const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')} WIB`;
    const fleetInitial = initialCode || (this.fleets.find(f => f.plateNumber.replace(/\s+/g, '') === (plateNumber || '').replace(/\s+/g, ''))?.initialCode);
    const initialText = fleetInitial ? ` [${fleetInitial}]` : '';

    if (scheduleId) {
      const sch = this.schedules.find(s => s.id === scheduleId);
      if (sch) {
        sch.actualArrival = `${now.toISOString().split('T')[0]} ${timeStr}`;
        sch.status = 'delivered';
        this.saveToStorage(STORAGE_KEYS.SCHEDULES, this.schedules);
      }
    }

    const newLog = this.addSecurityLog({
      time: timeStr,
      type: 'Kendaraan Masuk',
      entity: `${plateNumber}${initialText}`,
      initialCode: fleetInitial,
      driver: driverName || 'Driver AKK',
      purpose: notes || 'Armada Tiba Kembali di Gudang DC Banyuwangi',
      status: 'Tiba di Gudang',
      scheduleId,
      plateNumber,
      notes,
      securityOfficer: 'Pos Satpam Gerbang DC'
    });

    this.emitNotification(
      'delivery',
      'Armada Tiba di Gudang',
      `Armada ${plateNumber}${initialText} (${driverName}) telah tiba di gudang dan berhasil dicatat di sistem database Security.`,
      false
    );
    return newLog;
  }

  public getFleets(): Fleet[] {
    return [...this.fleets];
  }

  public setFleets(fleets: Fleet[]): void {
    const validFleets = fleets.filter(f => !(f.plateNumber || '').trim().toUpperCase().endsWith('AKK'));
    this.fleets = validFleets;
    this.saveToStorage(STORAGE_KEYS.FLEETS, this.fleets);
    this.notify();
  }

  /**
   * Menghitung daftar kru yang tersinkronisasi dari Manajemen User (role: driver / crew_helper)
   * tanpa memicu efek samping penyimpanan atau notifikasi listener.
   */
  private computeSyncedCrews(): Crew[] {
    const syncedCrews: Crew[] = [];
    const seenNames = new Set<string>();
    const defaultFleetId = this.fleets?.[0]?.id;

    for (const u of this.users) {
      if (u.role !== 'driver' && u.role !== 'crew_helper') continue;
      const cleanName = (u.fullName || '').trim();
      if (!cleanName) continue;
      const lowerName = cleanName.toLowerCase();
      if (lowerName === 'super admin' || lowerName === 'tamu / belum login' || seenNames.has(lowerName)) continue;

      const existingInStore = (this.crews || []).find(
        c => c && c.name && (c.name.trim().toLowerCase() === lowerName || c.id === `crw-${u.id}`)
      );
      const existingInInitial = INITIAL_CREWS.find(
        c => c.name.trim().toLowerCase() === lowerName
      );
      const refCrew = existingInStore || existingInInitial;

      const crewId = refCrew?.id || `crw-${u.id}`;
      const crewRole: Crew['role'] = u.role === 'crew_helper'
        ? 'Kernet / Helper'
        : (refCrew && !refCrew.role.includes('Helper') ? refCrew.role : 'Driver Utama');

      const crewStatus: Crew['status'] = u.status === 'inactive'
        ? 'off'
        : (existingInStore?.status === 'on-duty' ? 'on-duty' : 'available');

      const crewItem: Crew = {
        id: crewId,
        name: cleanName,
        phone: u.phone && u.phone !== '-' ? u.phone : (refCrew?.phone || ''),
        role: crewRole,
        licenseNumber: refCrew?.licenseNumber || '',
        licenseType: u.role === 'crew_helper' ? 'SIM A' : (refCrew?.licenseType || 'SIM B1 Umum'),
        status: crewStatus,
        currentFleetId: existingInStore?.currentFleetId || refCrew?.currentFleetId || undefined,
        tripsCompleted: refCrew?.tripsCompleted ?? 0,
        rating: refCrew?.rating ?? 0
      };

      seenNames.add(lowerName);
      syncedCrews.push(crewItem);
    }

    return syncedCrews;
  }

  /**
   * Sinkronisasi 2 arah antara Manajemen User (role: driver / crew_helper) dan daftar Kru Jadwal Penugasan
   */
  public syncUsersWithCrews(): Crew[] {
    const syncedCrews = this.computeSyncedCrews();
    this.crews = syncedCrews;
    try {
      safeSetItem(STORAGE_KEYS.CREWS, JSON.stringify(this.crews));
    } catch {}
    return syncedCrews;
  }

  public getCrews(): Crew[] {
    return this.computeSyncedCrews();
  }

  public getDriverCrews(): Crew[] {
    const all = this.computeSyncedCrews();
    const drivers = all.filter(c => {
      const linkedUser = this.users.find(
        u => (u.role === 'driver' || u.role === 'crew_helper') &&
          (u.fullName.trim().toLowerCase() === c.name.trim().toLowerCase() || `crw-${u.id}` === c.id)
      );
      if (linkedUser) return linkedUser.role === 'driver';
      return !c.role.toLowerCase().includes('helper') && !c.role.toLowerCase().includes('kernet');
    });
    return drivers.length > 0 ? drivers : all;
  }

  public getHelperCrews(): Crew[] {
    const all = this.computeSyncedCrews();
    const helpers = all.filter(c => {
      const linkedUser = this.users.find(
        u => (u.role === 'driver' || u.role === 'crew_helper') &&
          (u.fullName.trim().toLowerCase() === c.name.trim().toLowerCase() || `crw-${u.id}` === c.id)
      );
      if (linkedUser) return linkedUser.role === 'crew_helper';
      return c.role.toLowerCase().includes('helper') || c.role.toLowerCase().includes('kernet');
    });
    return helpers.length > 0 ? helpers : all;
  }

  public setCrews(crews: Crew[]): void {
    const uniqueMap = new Map<string, Crew>();
    crews.forEach(c => {
      if (c && c.id && c.name.trim().toLowerCase() !== 'super admin') {
        uniqueMap.set(c.id, c);
      }
    });
    this.crews = Array.from(uniqueMap.values());
    this.saveToStorage(STORAGE_KEYS.CREWS, this.crews);
    this.notify();
  }

  public getScheduleChangeLogs(): ScheduleChangeLogEntry[] {
    return [...this.scheduleChangeLogs];
  }

  public addScheduleChangeLog(
    entry: Omit<ScheduleChangeLogEntry, 'id' | 'timestamp' | 'userName' | 'userRole'> & {
      userName?: string;
      userRole?: string;
    }
  ): ScheduleChangeLogEntry {
    const current = this.getCurrentUser();
    const roleLabelMap: Record<string, string> = {
      super_admin: 'Super Admin',
      spv_logistik: 'SPV Logistik',
      pengiriman: 'Pengiriman',
      driver: 'Kru Supir',
      crew_helper: 'Kru Helper',
      admin_penjualan: 'Admin Penjualan',
      operasional: 'Operasional',
      security: 'Security'
    };
    const newEntry: ScheduleChangeLogEntry = {
      id: 'scl-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6),
      timestamp: new Date().toISOString(),
      fileName: entry.fileName,
      userName: entry.userName || current?.fullName || 'Super Admin',
      userRole: entry.userRole || roleLabelMap[current?.role || 'super_admin'] || current?.role || 'Admin',
      actionType: entry.actionType,
      summary: entry.summary,
      changes: entry.changes,
      status: entry.status
    };
    this.scheduleChangeLogs = [newEntry, ...this.scheduleChangeLogs].slice(0, 50);
    this.saveToStorage(STORAGE_KEYS.SCHEDULE_CHANGE_LOGS, this.scheduleChangeLogs);
    this.notify();
    return newEntry;
  }

  public getStores(): RetailStore[] {
    return this.stores.filter(s => !isAreaRouteItem(s));
  }

  public getSchedules(): Schedule[] {
    return this.schedules.map(sch => {
      const areaName = resolveScheduleAreaName(sch);
      const isBali = sch.isInterIsland || areaName.toUpperCase().includes('BALI') || areaName.toUpperCase().includes('DENPASAR') || areaName.toUpperCase().includes('SINGARAJA') || areaName.toUpperCase().includes('NEGARA');

      const areaStore: RetailStore = {
        id: sch.storeId && !sch.storeId.startsWith('str-fix-') ? sch.storeId : `area-${areaName.toLowerCase().replace(/[^a-z0-9]/g, '-')}`,
        storeCode: `AREA-${areaName.substring(0, 4).toUpperCase().replace(/[^A-Z0-9]/g, '')}`,
        storeName: areaName, // ALWAYS NAMA AREA KIRIM
        island: isBali ? 'Bali & Nusa Tenggara' : 'Jawa',
        province: isBali ? 'Bali' : 'Jawa Timur',
        city: isBali ? 'Denpasar' : (areaName.toUpperCase().includes('JEMBER') ? 'Jember' : (areaName.toUpperCase().includes('SITUBONDO') ? 'Situbondo' : (areaName.toUpperCase().includes('BONDOWOSO') ? 'Bondowoso' : 'Banyuwangi'))),
        address: `Area Pengiriman Distribusi ${areaName}`,
        latitude: isBali ? -8.6705 : -8.219,
        longitude: isBali ? 115.2126 : 114.369,
        contactPerson: 'PIC Distribusi Area',
        phone: '-',
        deliveryWindow: '08:00 - 17:00',
        storeCategory: 'Distribution Hub'
      };

      const findMatchingCrew = (id?: string, refCrew?: Crew): Crew | undefined => {
        if (id) {
          const byId = this.crews.find(c => c.id === id);
          if (byId) return byId;
        }
        if (refCrew?.name) {
          const byName = this.crews.find(c => c.name.trim().toLowerCase() === refCrew.name.trim().toLowerCase());
          if (byName) return byName;
        }
        return refCrew;
      };

      return {
        ...sch,
        areaName,
        store: areaStore,
        fleet: this.fleets.find(f => f.id === sch.fleetId) || sch.fleet,
        crew: findMatchingCrew(sch.crewId, sch.crew),
        crewHelper: (sch.crewHelperId || sch.crewHelper) ? findMatchingCrew(sch.crewHelperId, sch.crewHelper) : undefined,
        crewHelper2: (sch.crewHelper2Id || sch.crewHelper2) ? findMatchingCrew(sch.crewHelper2Id, sch.crewHelper2) : undefined
      };
    });
  }

  public getDevices(): TracksolidDevice[] {
    return [...this.devices];
  }

  public updateDevices(updatedDevices: TracksolidDevice[]) {
    this.devices = [...updatedDevices];
    this.saveToStorage(STORAGE_KEYS.DEVICES, this.devices);
    this.notify();
  }

  public resetDevices() {
    this.devices = [...INITIAL_TRACKSOLID_DEVICES];
    this.saveToStorage(STORAGE_KEYS.DEVICES, this.devices);
    this.notify();
  }

  public getCurrentUser(): UserProfile {
    return this.currentUser || { ...GUEST_USER_PROFILE };
  }

  public isAuthenticated(): boolean {
    if (!this.currentUser || this.currentUser.id === 'guest' || this.currentUser.status !== 'approved') {
      return false;
    }
    if (typeof sessionStorage !== 'undefined') {
      const sessionUserId = sessionStorage.getItem(STORAGE_KEYS.AUTH_SESSION);
      return Boolean(sessionUserId && sessionUserId === this.currentUser.id);
    }
    return true;
  }

  /**
   * Returns the official name of the Koordinator Logistik / SPV Logistik.
   * Dynamically integrates with user management roles and names:
   * 1. If currently logged-in user is an active spv_logistik, returns their name.
   * 2. Finds approved users with role 'spv_logistik'.
   *    If Muhammad Syaiful Bahri is an approved spv_logistik, uses his name (including any edited name).
   *    Otherwise, uses the first approved user holding the 'spv_logistik' role.
   * 3. Fallback to any user matching Syaiful Bahri or official default.
   */
  public getLogisticsCoordinator(): string {
    if (this.currentUser && this.currentUser.role === 'spv_logistik' && this.currentUser.status === 'approved') {
      return this.currentUser.fullName;
    }
    const approvedSpvLogistiks = this.users.filter(u => u.role === 'spv_logistik' && u.status === 'approved');
    const bahriSpvLogistik = approvedSpvLogistiks.find(u => u.fullName.toLowerCase().includes('syaiful bahri'));
    if (bahriSpvLogistik) {
      return bahriSpvLogistik.fullName;
    }
    if (approvedSpvLogistiks.length > 0) {
      return approvedSpvLogistiks[0].fullName;
    }
    const anyBahri = this.users.find(u => u.fullName.toLowerCase().includes('syaiful bahri'));
    if (anyBahri) {
      return anyBahri.fullName;
    }
    return 'Muhammad Syaiful Bahri';
  }

  /**
   * Returns the official name and title for the Super Admin / Manager Operasional.
   * Dynamically integrates with user management roles and names:
   * 1. If currently logged-in user is an approved super_admin, returns their name.
   * 2. Finds approved users with role 'super_admin' and returns their name.
   * 3. Fallback to official default.
   */
  public getSuperAdminOrManager(): { name: string; title: string } {
    if (this.currentUser && this.currentUser.role === 'super_admin' && this.currentUser.status === 'approved') {
      return {
        name: this.currentUser.fullName,
        title: 'Super Admin / Manager'
      };
    }
    const admin = this.users.find(u => u.role === 'super_admin' && u.status === 'approved');
    if (admin) {
      return {
        name: admin.fullName,
        title: 'Super Admin / Manager'
      };
    }
    return {
      name: 'Super Admin',
      title: 'Super Admin / Manager'
    };
  }

  public getSupabaseConfig(): SupabaseConfig {
    return this.supabaseConfig;
  }

  public getCrewDeliveryHistory(crewId?: string): CrewDeliveryHistory[] {
    if (crewId) {
      return this.crewHistory.filter(h => h.crewId === crewId);
    }
    return [...this.crewHistory];
  }

  public getCrewAreaStats(crewId: string): AreaDeliveryStat[] {
    const history = this.getCrewDeliveryHistory(crewId);
    const areaMap = new Map<string, { count: number; island: string; lastDate: string }>();

    history.forEach(item => {
      const existing = areaMap.get(item.area);
      if (existing) {
        existing.count += 1;
        if (new Date(item.completionDate) > new Date(existing.lastDate)) {
          existing.lastDate = item.completionDate;
        }
      } else {
        areaMap.set(item.area, {
          count: 1,
          island: item.island,
          lastDate: item.completionDate
        });
      }
    });

    const stats: AreaDeliveryStat[] = [];
    areaMap.forEach((val, key) => {
      stats.push({
        area: key,
        island: val.island,
        totalTrips: val.count,
        lastTripDate: val.lastDate,
        requiresApproval: val.count >= this.areaThreshold
      });
    });

    return stats.sort((a, b) => b.totalTrips - a.totalTrips);
  }

  public checkCrewAreaThreshold(crewId: string, areaName: string): {
    tripCount: number;
    threshold: number;
    requiresApproval: boolean;
    isApproved: boolean;
    recentTrips: CrewDeliveryHistory[];
  } {
    const allCrewTrips = this.getCrewDeliveryHistory(crewId);
    // Match area name or city or island
    const matchedTrips = allCrewTrips.filter(t => 
      t.area.toLowerCase().includes(areaName.toLowerCase()) ||
      areaName.toLowerCase().includes(t.area.toLowerCase()) ||
      t.city.toLowerCase().includes(areaName.toLowerCase()) ||
      areaName.toLowerCase().includes(t.city.toLowerCase())
    );

    const tripCount = matchedTrips.length;
    const requiresApproval = tripCount >= this.areaThreshold;

    // Check if there is an approved request for this crew and area
    const hasApproval = this.areaApprovals.some(
      a => a.crewId === crewId && 
           (a.targetArea.toLowerCase().includes(areaName.toLowerCase()) || areaName.toLowerCase().includes(a.targetArea.toLowerCase())) &&
           a.status === 'approved'
    );

    return {
      tripCount,
      threshold: this.areaThreshold,
      requiresApproval,
      isApproved: hasApproval,
      recentTrips: matchedTrips
    };
  }

  public getAreaApprovalRequests(): AreaApprovalRequest[] {
    return [...this.areaApprovals];
  }

  public createAreaApprovalRequest(req: Omit<AreaApprovalRequest, 'id' | 'requestedAt'>): AreaApprovalRequest {
    const newReq: AreaApprovalRequest = {
      ...req,
      id: 'appr-' + Math.random().toString(36).substring(2, 9),
      requestedAt: new Date().toISOString()
    };
    this.areaApprovals = [newReq, ...this.areaApprovals];
    this.saveToStorage(STORAGE_KEYS.AREA_APPROVALS, this.areaApprovals);
    return newReq;
  }

  public decideAreaApproval(requestId: string, status: 'approved' | 'rejected', notes?: string, decidedBy?: string) {
    this.areaApprovals = this.areaApprovals.map(req => {
      if (req.id === requestId) {
        return {
          ...req,
          status,
          notes: notes !== undefined ? notes : req.notes,
          decidedAt: new Date().toISOString(),
          decidedBy: decidedBy || this.currentUser.fullName
        };
      }
      return req;
    });
    this.saveToStorage(STORAGE_KEYS.AREA_APPROVALS, this.areaApprovals);
  }

  public getAreaDeliveryThreshold(): number {
    return this.areaThreshold;
  }

  public setAreaDeliveryThreshold(val: number) {
    this.areaThreshold = val;
    this.saveToStorage(STORAGE_KEYS.AREA_THRESHOLD, val);
  }

  /**
   * Menyelaraskan seluruh data jadwal operasional aktif ke submenu 'Histori & Otorisasi Kru'
   */
  public syncSchedulesToCrewHistory(schedules?: Schedule[]): number {
    const targetSchedules = schedules || this.schedules || [];
    let addedCount = 0;

    targetSchedules.forEach((sch) => {
      const crew = this.crews.find(c => c.id === sch.crewId);
      if (!crew) return;

      const helper = sch.crewHelperId ? this.crews.find(c => c.id === sch.crewHelperId) : (sch.crewHelper ? sch.crewHelper : null);
      const fleet = this.fleets.find(f => f.id === sch.fleetId);
      const store = this.stores.find(s => s.id === sch.storeId);
      
      const areaName = resolveScheduleAreaName(sch) || store?.storeName || sch.cargoDescription || 'Area Kirim';
      const island = areaName.toUpperCase().includes('DENPASAR') || areaName.toUpperCase().includes('SINGARAJA') || areaName.toUpperCase().includes('NEGARA') || areaName.toUpperCase().includes('BALI')
        ? 'Bali & Nusa Tenggara' 
        : 'Jawa';
      const city = areaName.toUpperCase().includes('DENPASAR') ? 'Denpasar' 
        : (areaName.toUpperCase().includes('SINGARAJA') ? 'Singaraja' 
        : (areaName.toUpperCase().includes('BONDOWOSO') ? 'Bondowoso' 
        : (areaName.toUpperCase().includes('SITUBONDO') ? 'Situbondo' 
        : (areaName.toUpperCase().includes('JEMBER') ? 'Jember' : 'Banyuwangi'))));
      
      const departureDate = sch.departureDate || '2026-01-05T07:30:00Z';
      const trackingNumber = sch.trackingNumber || `PO-AKK-20260105-${fleet?.plateNumber || sch.fleetId || 'DS3'}`;

      // Extract Inisial Mobil (e.g. DS1, DS3, NS2, NL1, N20)
      const poCodeMatch = trackingNumber.match(/PO-AKK-\d+-([A-Za-z0-9]+)/i);
      const extractedCode = poCodeMatch ? poCodeMatch[1] : null;
      const initialCode = fleet?.initialCode || sch.fleet?.initialCode || extractedCode || sch.fleetId || 'DS3';

      const existingIndex = this.crewHistory.findIndex(
        h => (h.scheduleId === sch.id || h.trackingNumber === trackingNumber) && h.crewId === crew.id
      );

      const areaStats = this.checkCrewAreaThreshold(crew.id, areaName);
      const seqNum = (existingIndex !== -1 ? this.crewHistory[existingIndex].areaTripSequenceNumber : areaStats.tripCount + 1) || 1;
      const totalAreaTrips = this.crewHistory.filter(h => h.area.toUpperCase() === areaName.toUpperCase()).length + 1;
      const reqAppr = seqNum >= this.areaThreshold;

      const historyItem: CrewDeliveryHistory = {
        id: existingIndex !== -1 
          ? this.crewHistory[existingIndex].id 
          : `cdh-sync-drv-${crew.id}-${sch.id || Math.random().toString(36).substring(2, 9)}`,
        crewId: crew.id,
        crewName: crew.name,
        scheduleId: sch.id,
        trackingNumber,
        storeName: areaName,
        area: areaName,
        city,
        island,
        vehiclePlate: fleet?.plateNumber || sch.fleetId || 'DS3',
        initialCode,
        vehicleType: fleet?.vehicleType || 'Engkel STD',
        cargoWeightTon: sch.cargoWeightTon || 3.5,
        cargoDescription: sch.cargoDescription || `Pengiriman ritase ke ${areaName}`,
        completionDate: departureDate,
        status: 'delivered',
        onTimeStatus: 'Tepat Waktu',
        ratingReceived: 5.0,
        areaTripSequenceNumber: seqNum,
        totalAreaTrips,
        requiresAreaApproval: reqAppr,
        areaApprovalStatus: reqAppr ? 'approved' : 'not_required',
        notes: helper ? `Kru Driver: ${crew.name} | Helper: ${helper.name}` : `Kru Driver: ${crew.name}`
      };

      if (existingIndex !== -1) {
        this.crewHistory[existingIndex] = historyItem;
      } else {
        this.crewHistory.unshift(historyItem);
        addedCount++;
      }

      // Also track Helper history if assigned
      if (helper) {
        const helperExistingIndex = this.crewHistory.findIndex(
          h => (h.scheduleId === sch.id || h.trackingNumber === trackingNumber) && h.crewId === helper.id
        );
        const helperHistoryItem: CrewDeliveryHistory = {
          id: helperExistingIndex !== -1 
            ? this.crewHistory[helperExistingIndex].id 
            : `cdh-sync-hlp-${helper.id}-${sch.id || Math.random().toString(36).substring(2, 9)}`,
          crewId: helper.id,
          crewName: helper.name,
          scheduleId: sch.id,
          trackingNumber,
          storeName: areaName,
          area: areaName,
          city,
          island,
          vehiclePlate: fleet?.plateNumber || sch.fleetId || 'DS3',
          initialCode,
          vehicleType: fleet?.vehicleType || 'Engkel STD',
          cargoWeightTon: sch.cargoWeightTon || 3.5,
          cargoDescription: sch.cargoDescription || `Pengiriman ritase ke ${areaName} (Sebagai Helper)`,
          completionDate: departureDate,
          status: 'delivered',
          onTimeStatus: 'Tepat Waktu',
          ratingReceived: 5.0,
          areaTripSequenceNumber: 1,
          requiresAreaApproval: false,
          areaApprovalStatus: 'not_required',
          notes: `Tugas Helper mendampingi Driver: ${crew.name}`
        };

        if (helperExistingIndex !== -1) {
          this.crewHistory[helperExistingIndex] = helperHistoryItem;
        } else {
          this.crewHistory.unshift(helperHistoryItem);
          addedCount++;
        }
      }
    });

    // Deduplicate crewHistory array to ensure 100% unique React keys
    const seenIds = new Set<string>();
    this.crewHistory = this.crewHistory.map((item, index) => {
      if (seenIds.has(item.id)) {
        const uniqueId = `${item.id}-uniq-${index}-${Math.floor(Math.random() * 1000)}`;
        return { ...item, id: uniqueId };
      }
      seenIds.add(item.id);
      return item;
    });

    this.saveToStorage(STORAGE_KEYS.CREW_HISTORY, this.crewHistory);
    this.notify();
    return addedCount;
  }

  // User Management & Authentication
  public getUsers(): UserProfile[] {
    return this.users;
  }

  public async refreshUsersFromHostinger(): Promise<boolean> {
    try {
      const response = await fetch('/api/users', { credentials: 'same-origin' });
      if (!response.ok) return false;
      const payload = await response.json();
      if (!Array.isArray(payload?.data)) return false;
      const localById = new Map(this.users.map(u => [u.id, u]));
      const mappedUsers = payload.data.map((r: any) => {
        const local = localById.get(r.id);
        const role = (r.role || local?.role || 'unassigned') as UserRole;
        const remotePerms = r.permissions && r.permissions.modules ? r.permissions : undefined;
        return {
          ...(local || {} as UserProfile),
          id: r.id,
          email: r.email || local?.email || '',
          fullName: r.fullName || r.name || local?.fullName || r.email || 'User',
          role,
          department: r.department || local?.department || 'Logistics Operations',
          phone: r.phone || local?.phone || '',
          status: r.status || local?.status || 'pending',
          createdAt: r.createdAt || local?.createdAt,
          approvedAt: r.approvedAt || local?.approvedAt,
          approvedBy: r.approvedBy || local?.approvedBy,
          notes: r.notes ?? local?.notes,
          password: undefined,
          permissions: remotePerms || local?.permissions || { modules: getDefaultPermissionsForRole(role) }
        } as UserProfile;
      });
      this.users = this.deduplicateSuperAdmins(mappedUsers);
      this.saveToStorage(STORAGE_KEYS.USERS, this.users);
      this.syncUsersWithCrews();
      this.notify();
      return true;
    } catch (err) {
      console.warn('[Hostinger Users] Gagal refresh:', err);
      return false;
    }
  }

  private syncUserToHostinger(userId: string, data: Partial<UserProfile>): void {
    const payload: Record<string, any> = { ...data };
    delete payload.password;
    fetch(`/api/users/${encodeURIComponent(userId)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify(payload)
    }).catch(err => console.warn('[Hostinger Users] Sync update gagal:', err));
  }

  public getPendingUsersCount(): number {
    return this.users.filter(u => u.status === 'pending').length;
  }

  public approveUser(userId: string, notes?: string) {
    this.verifyDriverAccess('user_management');
    const approverName = this.currentUser.fullName || 'Manager Operasional AKK';
    this.users = this.users.map(u => {
      if (u.id === userId) {
        this.logActivity('Approval User', u.fullName, `Disetujui oleh ${approverName}`);
        return {
          ...u,
          status: 'approved' as const,
          approvedAt: new Date().toISOString(),
          approvedBy: approverName,
          notes: notes || 'Disetujui oleh ' + approverName
        };
      }
      return u;
    });

    // If current user is the one approved, update currentUser too
    if (this.currentUser.id === userId) {
      this.currentUser = {
        ...this.currentUser,
        status: 'approved',
        approvedAt: new Date().toISOString(),
        approvedBy: approverName
      };
      this.saveToStorage(STORAGE_KEYS.CURRENT_USER, this.currentUser);
    }

    this.saveToStorage(STORAGE_KEYS.USERS, this.users);
    this.syncUsersWithCrews();
    const approved = this.users.find(u => u.id === userId);
    if (approved) this.syncUserToHostinger(userId, approved);
    this.notify();
  }

  public rejectUser(userId: string, reason?: string) {
    this.verifyDriverAccess('user_management');
    this.users = this.users.map(u => {
      if (u.id === userId) {
        return {
          ...u,
          status: 'rejected' as const,
          notes: reason || 'Ditolak oleh Administrator AKK'
        };
      }
      return u;
    });

    if (this.currentUser.id === userId) {
      this.currentUser = {
        ...this.currentUser,
        status: 'rejected',
        notes: reason || 'Ditolak oleh Administrator AKK'
      };
      this.saveToStorage(STORAGE_KEYS.CURRENT_USER, this.currentUser);
    }

    this.saveToStorage(STORAGE_KEYS.USERS, this.users);
    this.syncUsersWithCrews();
    const rejected = this.users.find(u => u.id === userId);
    if (rejected) this.syncUserToHostinger(userId, rejected);
    this.notify();
  }

  public deactivateUser(userId: string, reason?: string): boolean {
    this.verifyDriverAccess('user_management');
    const userIndex = this.users.findIndex(u => u.id === userId);
    if (userIndex === -1) return false;

    const user = this.users[userIndex];
    const adminName = this.currentUser.fullName || 'Super Admin';
    this.users[userIndex] = {
      ...user,
      status: 'inactive',
      notes: reason || `Akun dinonaktifkan oleh ${adminName} (Data histori tetap tersimpan)`
    };

    if (this.currentUser.id === userId) {
      this.currentUser = {
        ...this.currentUser,
        status: 'inactive'
      };
      this.saveToStorage(STORAGE_KEYS.CURRENT_USER, this.currentUser);
    }

    this.saveToStorage(STORAGE_KEYS.USERS, this.users);
    this.syncUsersWithCrews();
    this.logActivity('Nonaktifkan User', user.fullName, `Akun ${user.fullName} dinonaktifkan. Hak akses ditutup, histori data tetap tersimpan.`);
    this.syncUserToHostinger(userId, this.users[userIndex]);
    this.notify();
    return true;
  }

  public activateUser(userId: string, notes?: string): boolean {
    this.verifyDriverAccess('user_management');
    const userIndex = this.users.findIndex(u => u.id === userId);
    if (userIndex === -1) return false;

    const user = this.users[userIndex];
    const approverName = this.currentUser.fullName || 'Super Admin';
    this.users[userIndex] = {
      ...user,
      status: 'approved',
      approvedAt: new Date().toISOString(),
      approvedBy: approverName,
      notes: notes || `Akun diaktifkan kembali oleh ${approverName}`
    };

    if (this.currentUser.id === userId) {
      this.currentUser = {
        ...this.currentUser,
        status: 'approved',
        approvedAt: new Date().toISOString(),
        approvedBy: approverName
      };
      this.saveToStorage(STORAGE_KEYS.CURRENT_USER, this.currentUser);
    }

    this.saveToStorage(STORAGE_KEYS.USERS, this.users);
    this.syncUsersWithCrews();
    this.logActivity('Aktifkan User', user.fullName, `Akun ${user.fullName} diaktifkan kembali dan hak akses dipulihkan.`);
    this.syncUserToHostinger(userId, this.users[userIndex]);
    this.notify();
    return true;
  }

  public getActiveUsers(): UserProfile[] {
    return this.users.filter(u => u.status === 'approved');
  }

  public updateUserRole(userId: string, role: UserRole) {
    this.updateUserProfile(userId, { role });
  }

  public updateUserProfile(userId: string, data: Partial<UserProfile>): boolean {
    this.verifyDriverAccess('user_management');
    const userIndex = this.users.findIndex(u => u.id === userId);
    if (userIndex === -1) return false;

    const existing = this.users[userIndex];
    const oldName = existing.fullName;
    const targetRole = (data.role || existing.role) as UserRole;
    const isLogisticsLead = ['spv_logistik', 'operasional', 'pengiriman', 'dispatcher'].includes(targetRole);

    let nextPermissions = data.permissions
      ? data.permissions
      : (data.role && data.role !== existing.role)
      ? { modules: getDefaultPermissionsForRole(data.role) }
      : existing.permissions || { modules: getDefaultPermissionsForRole(targetRole) };

    if (isLogisticsLead && nextPermissions?.modules?.logistics) {
      const logMod = nextPermissions.modules.logistics;
      const activeSubCount = logMod.subMenus
        ? Object.values(logMod.subMenus).filter(lvl => lvl !== 'none').length
        : 0;
      if (logMod.enabled && activeSubCount <= 1 && !data.permissions) {
        const defaultMods = getDefaultPermissionsForRole(targetRole);
        nextPermissions = {
          modules: {
            ...defaultMods,
            ...nextPermissions.modules,
            logistics: defaultMods.logistics
          }
        };
      }
    }

    const updatedUser: UserProfile = {
      ...existing,
      ...data,
      permissions: nextPermissions,
      id: userId
    };

    this.users[userIndex] = updatedUser;

    if (this.currentUser.id === userId) {
      this.currentUser = { ...updatedUser };
      this.saveToStorage(STORAGE_KEYS.CURRENT_USER, this.currentUser);
    }

    // Direct synchronization: If name or phone changed, sync with crew pool & active schedules
    if (data.fullName && data.fullName !== oldName) {
      const newName = data.fullName;
      let crewsUpdated = false;
      this.crews = this.crews.map(c => {
        if (c.name.toLowerCase() === oldName.toLowerCase() || (c.phone && existing.phone && c.phone === existing.phone)) {
          crewsUpdated = true;
          return { ...c, name: newName, phone: data.phone || c.phone };
        }
        return c;
      });
      if (crewsUpdated) {
        this.saveToStorage(STORAGE_KEYS.CREWS, this.crews);
      }

      let schUpdated = false;
      this.schedules = this.schedules.map(s => {
        let changed = false;
        let newCrew = s.crew;
        let newHelper = s.crewHelper;
        let newHelper2 = s.crewHelper2;

        if (s.crew && s.crew.name.toLowerCase() === oldName.toLowerCase()) {
          newCrew = { ...s.crew, name: newName };
          changed = true;
        }
        if (s.crewHelper && s.crewHelper.name.toLowerCase() === oldName.toLowerCase()) {
          newHelper = { ...s.crewHelper, name: newName };
          changed = true;
        }
        if (s.crewHelper2 && s.crewHelper2.name.toLowerCase() === oldName.toLowerCase()) {
          newHelper2 = { ...s.crewHelper2, name: newName };
          changed = true;
        }
        if (changed) {
          schUpdated = true;
          return { ...s, crew: newCrew, crewHelper: newHelper, crewHelper2: newHelper2 };
        }
        return s;
      });
      if (schUpdated) {
        this.saveToStorage(STORAGE_KEYS.SCHEDULES, this.schedules);
      }
    }

    this.saveToStorage(STORAGE_KEYS.USERS, this.users);
    this.syncUsersWithCrews();
    this.syncUserToHostinger(userId, updatedUser);
    this.notify();
    return true;
  }

  public deleteUser(userId: string) {
    this.users = this.users.filter(u => u.id !== userId);
    this.saveToStorage(STORAGE_KEYS.USERS, this.users);
    this.syncUsersWithCrews();
    fetch(`/api/users/${encodeURIComponent(userId)}`, { method: 'DELETE', credentials: 'same-origin' })
      .catch(err => console.warn('[Hostinger Users] Hapus user gagal:', err));
    this.notify();
  }

  public registerUser(data: {
    fullName: string;
    email: string;
    role?: UserRole;
    department: string;
    phone?: string;
    notes?: string;
    password?: string;
    status?: UserApprovalStatus;
  }): UserProfile {
    const resolvedRole: UserRole = data.role || 'unassigned';
    const newUser: UserProfile = {
      id: 'usr-' + Math.random().toString(36).substring(2, 8),
      fullName: data.fullName,
      email: data.email,
      role: resolvedRole,
      department: data.department || 'Logistik & Pengiriman',
      phone: data.phone || '0812-3456-7890',
      password: undefined,
      status: data.status || 'pending',
      createdAt: new Date().toISOString(),
      notes: data.notes || 'Pendaftaran mandiri melalui portal AKK - Menunggu persetujuan (acc) Super Admin',
      permissions: {
        modules: getDefaultPermissionsForRole(resolvedRole)
      }
    };

    this.users = [newUser, ...this.users];
    this.saveToStorage(STORAGE_KEYS.USERS, this.users);
    this.syncUsersWithCrews();
    const endpoint = this.currentUser?.role === 'super_admin' ? '/api/users' : '/api/auth/register';
    fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({
        id: newUser.id,
        fullName: newUser.fullName,
        email: newUser.email,
        phone: newUser.phone,
        role: newUser.role,
        department: newUser.department,
        status: newUser.status,
        notes: newUser.notes,
        password: data.password || ''
      })
    }).catch(err => console.warn('[Hostinger Users] Registrasi user gagal disinkronkan:', err));
    this.notify();

    return newUser;
  }

  /**
   * Mendeteksi akun pengguna secara cerdas melalui berbagai input:
   * 1. Email lengkap (e.g. budiono@gmail.com)
   * 2. Username saja (e.g. budiono)
   * 3. ID pengguna (e.g. usr-budiono atau budiono)
   * 4. Nama lengkap pengguna (e.g. Budiono, MUHAMMAD SYAIFUL BAHRI)
   * 5. Nama kru supir / helper (e.g. Budiono, Zainul Agustiar)
   * 6. Alias admin resmi (admin, superadmin, bayun791)
   */
  public findUserByIdentifier(identifier: string): UserProfile | undefined {
    const cleanId = (identifier || '').trim().toLowerCase();
    if (!cleanId) return undefined;

    // SKEMA VALIDASI KETAT:
    // Jika input mengandung '@', perlakukan sebagai format EMAIL murni
    if (cleanId.includes('@')) {
      let match = this.users.find(u => u.email && u.email.trim().toLowerCase() === cleanId);
      if (match) return match;

      // Preview-only fallback. Production users always come from Hostinger MySQL.
      if (!import.meta.env.PROD) {
        const initMatch = INITIAL_PROFILES.find(p => p.email && p.email.trim().toLowerCase() === cleanId);
        if (initMatch) {
          match = this.users.find(u => u.id === initMatch.id);
          if (match) return match;
        }
      }

      const emailPrefix = cleanId.split('@')[0].trim().toLowerCase();
      if (['admin', 'superadmin', 'super.admin'].includes(emailPrefix)) {
        return this.users.find(u => u.role === 'super_admin' || u.id === 'usr-001');
      }
      if (['bayun791', 'bayun', 'bayu', 'operasional', 'ops'].includes(emailPrefix)) {
        return this.users.find(u => u.id === 'usr-operasional' || u.role === 'operasional');
      }
      return undefined;
    }

    // Jika input TIDAK mengandung '@', perlakukan secara ketat sebagai USERNAME / NAMA / ID
    // 1. Cek ID pengguna persis (contoh: 'usr-budiono' atau 'usr-001')
    let user = this.users.find(u => u.id && u.id.trim().toLowerCase() === cleanId);
    if (user) return user;

    // 2. Cek username sebelum '@' pada email (contoh: 'budiono' dari 'budiono@gmail.com')
    user = this.users.find(u => {
      if (!u.email) return false;
      const emailUser = u.email.split('@')[0].trim().toLowerCase();
      return emailUser === cleanId;
    });
    if (user) return user;

    // 3. Cek ID tanpa prefix 'usr-' (contoh: 'budiono' dari 'usr-budiono')
    user = this.users.find(u => {
      if (!u.id) return false;
      const strippedId = u.id.replace(/^usr-/, '').trim().toLowerCase();
      return strippedId === cleanId;
    });
    if (user) return user;

    // 4. Cek nama lengkap secara persis (contoh: 'Budiono', 'BUDIONO')
    user = this.users.find(u => (u.fullName || '').trim().toLowerCase() === cleanId);
    if (user) return user;

    // 5. Cek kata depan nama lengkap atau kemiripan kata
    user = this.users.find(u => {
      const fNameLower = (u.fullName || '').trim().toLowerCase();
      const words = fNameLower.split(/\s+/);
      return words.includes(cleanId) || (cleanId.length >= 3 && fNameLower.includes(cleanId));
    });
    if (user) return user;

    // 6. Cek daftar kru (supir / helper di lapangan)
    const matchedCrew = this.crews.find(c => {
      const cNameLower = (c.name || '').trim().toLowerCase();
      return (
        c.id.toLowerCase() === cleanId ||
        cNameLower === cleanId ||
        cNameLower.split(/\s+/).includes(cleanId) ||
        (cleanId.length >= 3 && cNameLower.includes(cleanId))
      );
    });
    if (matchedCrew) {
      let crewUser = this.users.find(u => 
        (u.fullName || '').trim().toLowerCase() === matchedCrew.name.trim().toLowerCase() ||
        (u.id === `usr-${matchedCrew.id}`) ||
        (u.email && u.email.toLowerCase().includes(matchedCrew.name.toLowerCase().split(' ')[0]))
      );
      if (crewUser) return crewUser;

      const targetRole: UserRole = matchedCrew.role.toLowerCase().includes('helper') ? 'crew_helper' : 'driver';
      const roleUser = this.users.find(u => u.role === targetRole);
      if (roleUser) return roleUser;
    }

    // 7. Alias Super Admin khusus (hanya jika kata kunci admin/bayun)
    if (['admin', 'superadmin', 'super admin', 'bayun791', 'bayun'].includes(cleanId)) {
      return this.users.find(u => u.role === 'super_admin' || u.id === 'usr-001');
    }

    return undefined;
  }

  public loginUser(identifier: string, password?: string): UserProfile | null {
    // Legacy local login is intentionally strict and kept only for offline/dev compatibility.
    // Production UI authenticates against Hostinger MySQL through loginUserRemote().
    const existing = this.findUserByIdentifier(identifier);
    if (!existing || existing.status !== 'approved') return null;
    const expected = String(existing.password || '');
    const supplied = String(password || '');
    if (!expected || !supplied || supplied !== expected) return null;
    this.setCurrentUser(existing);
    return existing;
  }

  private lastAuthError: { status: number; message: string } | null = null;

  public getLastAuthError(): { status: number; message: string } | null {
    return this.lastAuthError;
  }

  public async loginUserRemote(identifier: string, password: string): Promise<UserProfile | null> {
    this.lastAuthError = null;
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ identifier: identifier.trim(), password })
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        this.lastAuthError = {
          status: response.status,
          message: String(payload?.error || 'Gagal memproses login ke server.')
        };
        return null;
      }
      const remote = payload?.user;
      if (!remote?.id) return null;

      const isRemoteSuperAdmin = remote.role === 'super_admin';
      const existing = this.users.find(u =>
        u.id === remote.id ||
        u.email?.toLowerCase() === String(remote.email || '').toLowerCase() ||
        (isRemoteSuperAdmin && u.role === 'super_admin')
      );
      const role = (remote.role || existing?.role || 'unassigned') as UserRole;
      const user: UserProfile = {
        ...(existing || {} as UserProfile),
        id: isRemoteSuperAdmin ? (existing?.id || remote.id) : remote.id,
        email: remote.email || existing?.email || '',
        fullName: isRemoteSuperAdmin ? 'Super Admin' : (remote.name || existing?.fullName || remote.email || 'User'),
        role,
        department: remote.department || existing?.department || 'Logistics Operations',
        phone: remote.phone || existing?.phone || '',
        status: remote.status || existing?.status || 'approved',
        permissions: (remote.permissions && remote.permissions.modules)
          ? remote.permissions
          : (existing?.permissions || { modules: getDefaultPermissionsForRole(role) })
      } as UserProfile;

      const idx = this.users.findIndex(u =>
        u.id === user.id ||
        (isRemoteSuperAdmin && u.role === 'super_admin') ||
        (user.email && u.email?.toLowerCase() === user.email.toLowerCase())
      );
      if (idx >= 0) this.users[idx] = { ...this.users[idx], ...user, password: undefined } as UserProfile;
      else this.users = [{ ...user, password: undefined } as UserProfile, ...this.users];
      this.users = this.deduplicateSuperAdmins(this.users);
      this.saveToStorage(STORAGE_KEYS.USERS, this.users);
      this.setCurrentUser({ ...user, password: undefined } as UserProfile);
      void this.hydrateOperationalDataFromHostinger();
      if (user.role === 'super_admin') await this.refreshUsersFromHostinger();
      return user;
    } catch (err: any) {
      this.lastAuthError = {
        status: 503,
        message: 'Tidak dapat terhubung ke server autentikasi. Periksa koneksi jaringan atau status server.'
      };
      console.warn('[Hostinger Auth] Login gagal:', err);
      return null;
    }
  }

  public async hydrateOperationalDataFromHostinger(): Promise<boolean> {
    try {
      const [fleetRes, crewRes, storeRes, scheduleRes] = await Promise.all([
        fetch('/api/fleets', { credentials: 'same-origin' }),
        fetch('/api/crews', { credentials: 'same-origin' }),
        fetch('/api/stores', { credentials: 'same-origin' }),
        fetch('/api/schedules/persisted', { credentials: 'same-origin' })
      ]);

      const [fleetPayload, crewPayload, storePayload, schedulePayload] = await Promise.all([
        fleetRes.ok ? fleetRes.json().catch(() => ({})) : Promise.resolve({}),
        crewRes.ok ? crewRes.json().catch(() => ({})) : Promise.resolve({}),
        storeRes.ok ? storeRes.json().catch(() => ({})) : Promise.resolve({}),
        scheduleRes.ok ? scheduleRes.json().catch(() => ({})) : Promise.resolve({})
      ]);

      if (fleetRes.ok && Array.isArray(fleetPayload?.data) && (fleetPayload.source === 'hostinger_mysql' || fleetPayload.data.length > 0)) {
        this.fleets = fleetPayload.data;
        this.saveToStorage(STORAGE_KEYS.FLEETS, this.fleets);
      }
      if (crewRes.ok && Array.isArray(crewPayload?.data) && (crewPayload.source === 'hostinger_mysql' || crewPayload.data.length > 0)) {
        this.crews = crewPayload.data;
        this.saveToStorage(STORAGE_KEYS.CREWS, this.crews);
      }
      if (storeRes.ok && Array.isArray(storePayload?.data) && (storePayload.source === 'hostinger_mysql' || storePayload.data.length > 0)) {
        this.stores = storePayload.data.filter((item: RetailStore) => !isAreaRouteItem(item));
        this.saveToStorage(STORAGE_KEYS.STORES, this.stores);
      }
      if (scheduleRes.ok && (schedulePayload?.source === 'hostinger_mysql' || schedulePayload?.exists)) {
        this.schedules = Array.isArray(schedulePayload?.schedules) ? schedulePayload.schedules : [];
        this.saveToStorage(STORAGE_KEYS.SCHEDULES, this.schedules);
      }

      this.syncUsersWithCrews();
      this.notify();
      return fleetRes.ok || crewRes.ok || storeRes.ok || scheduleRes.ok;
    } catch (err) {
      console.warn('[Hostinger MySQL] Gagal hydrate data operasional:', err);
      return false;
    }
  }

  public async restoreServerSession(): Promise<boolean> {
    try {
      const response = await fetch('/api/auth/me', {
        method: 'GET',
        credentials: 'same-origin',
        headers: { 'Accept': 'application/json' }
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload?.user?.id) {
        this.currentUser = { ...GUEST_USER_PROFILE };
        try {
          sessionStorage.removeItem(STORAGE_KEYS.AUTH_SESSION);
          localStorage.removeItem(STORAGE_KEYS.CURRENT_USER);
        } catch {}
        this.notify();
        return false;
      }

      const remote = payload.user;
      const role = (remote.role || 'unassigned') as UserRole;
      const isRemoteSuperAdmin = role === 'super_admin';
      const existing = this.users.find(u =>
        u.id === remote.id ||
        u.email?.toLowerCase() === String(remote.email || '').toLowerCase() ||
        (isRemoteSuperAdmin && u.role === 'super_admin')
      );
      const user: UserProfile = {
        ...(existing || {} as UserProfile),
        id: isRemoteSuperAdmin ? (existing?.id || remote.id) : remote.id,
        email: remote.email || existing?.email || '',
        fullName: isRemoteSuperAdmin ? 'Super Admin' : (remote.name || remote.fullName || existing?.fullName || 'Pengguna'),
        role,
        department: remote.department || existing?.department || 'Logistik',
        phone: remote.phone || existing?.phone || '',
        status: remote.status || existing?.status || 'approved',
        createdAt: remote.createdAt || existing?.createdAt || new Date().toISOString(),
        approvedAt: remote.approvedAt || existing?.approvedAt,
        approvedBy: remote.approvedBy || existing?.approvedBy,
        notes: remote.notes ?? existing?.notes,
        permissions: (remote.permissions && remote.permissions.modules)
          ? remote.permissions
          : (existing?.permissions || { modules: getDefaultPermissionsForRole(role) }),
        password: undefined
      } as UserProfile;

      const idx = this.users.findIndex(u =>
        u.id === user.id ||
        (isRemoteSuperAdmin && u.role === 'super_admin') ||
        (user.email && u.email?.toLowerCase() === user.email.toLowerCase())
      );
      if (idx >= 0) this.users[idx] = { ...this.users[idx], ...user, password: undefined } as UserProfile;
      else this.users = [user, ...this.users];
      this.users = this.deduplicateSuperAdmins(this.users);
      this.saveToStorage(STORAGE_KEYS.USERS, this.users);
      this.setCurrentUser(user);
      void this.hydrateOperationalDataFromHostinger();
      if (user.role === 'super_admin') void this.refreshUsersFromHostinger();
      return true;
    } catch (err) {
      console.warn('[Hostinger Auth] Restore session gagal:', err);
      this.currentUser = { ...GUEST_USER_PROFILE };
      try {
        sessionStorage.removeItem(STORAGE_KEYS.AUTH_SESSION);
        localStorage.removeItem(STORAGE_KEYS.CURRENT_USER);
      } catch {}
      this.notify();
      return false;
    }
  }

  public async registerUserRemote(data: {
    fullName: string;
    email: string;
    phone?: string;
    department?: string;
    password: string;
  }): Promise<UserProfile | null> {
    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify(data)
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload?.user?.id) return null;
      const remote = payload.user;
      const user: UserProfile = {
        id: remote.id,
        email: remote.email,
        fullName: remote.name || data.fullName,
        role: remote.role || 'unassigned',
        department: remote.department || data.department || 'Logistik',
        phone: remote.phone || data.phone || '',
        status: remote.status || 'pending',
        createdAt: remote.createdAt || new Date().toISOString(),
        permissions: { modules: getDefaultPermissionsForRole((remote.role || 'unassigned') as UserRole) }
      } as UserProfile;
      this.users = [user, ...this.users.filter(u => u.id !== user.id && u.email?.toLowerCase() !== user.email.toLowerCase())];
      this.saveToStorage(STORAGE_KEYS.USERS, this.users);
      this.notify();
      return user;
    } catch (err) {
      console.warn('[Hostinger Auth] Registrasi gagal:', err);
      return null;
    }
  }

  public switchCurrentUser(userId: string) {
    const target = this.users.find(u => u.id === userId);
    if (target) {
      this.currentUser = target;
      try {
        if (typeof sessionStorage !== 'undefined') {
          sessionStorage.setItem(STORAGE_KEYS.AUTH_SESSION, target.id);
        }
      } catch {}
      this.saveToStorage(STORAGE_KEYS.CURRENT_USER, this.currentUser);
      this.syncCurrentUserToCrew();
      this.notify();
    }
  }

  public setCurrentUser(user: UserProfile) {
    this.currentUser = user;
    try {
      if (typeof sessionStorage !== 'undefined') {
        sessionStorage.setItem(STORAGE_KEYS.AUTH_SESSION, user.id);
      }
    } catch {}
    this.saveToStorage(STORAGE_KEYS.CURRENT_USER, this.currentUser);
    this.syncCurrentUserToCrew();
    this.notify();
  }

  public logoutUser() {
    fetch('/api/auth/logout', { method: 'POST', credentials: 'same-origin' }).catch(() => {});
    this.currentUser = { ...GUEST_USER_PROFILE };
    try {
      if (typeof sessionStorage !== 'undefined') {
        sessionStorage.removeItem(STORAGE_KEYS.AUTH_SESSION);
      }
      localStorage.removeItem(STORAGE_KEYS.CURRENT_USER);
      localStorage.removeItem('akk_driver_auth_session');
    } catch {}
    this.notify();
  }

  public updateUserFullName(newFullName: string): void {
    if (this.currentUser) {
      this.currentUser.fullName = newFullName;
      const userInList = this.users.find(u => u.id === this.currentUser.id);
      if (userInList) {
        userInList.fullName = newFullName;
      }
      this.saveToStorage(STORAGE_KEYS.USERS, this.users);
      this.saveToStorage(STORAGE_KEYS.CURRENT_USER, this.currentUser);
      this.syncCurrentUserToCrew();
      this.notify();
    }
  }

  public async resetUserPassword(userId: string, newPassword: string): Promise<boolean> {
    const userIndex = this.users.findIndex(u => u.id === userId);
    if (userIndex === -1 || newPassword.length < 8) return false;

    try {
      const response = await fetch(`/api/users/${encodeURIComponent(userId)}/password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ password: newPassword })
      });
      if (!response.ok) return false;

      // Never persist plaintext passwords in browser storage. Password hashing happens on the server.
      this.users[userIndex] = { ...this.users[userIndex], password: undefined } as UserProfile;
      this.saveToStorage(STORAGE_KEYS.USERS, this.users);
      this.logActivity('Reset Password', this.users[userIndex].fullName, 'Password direset oleh Super Admin melalui backend Hostinger');
      this.notify();
      return true;
    } catch (err) {
      console.warn('[Hostinger Users] Reset password gagal:', err);
      return false;
    }
  }

  public getPortalDisplayName(): string {
    if (!this.currentUser) return 'Driver Operasional';
    if (this.currentUser.role === 'super_admin') {
      return this.currentUser.fullName || 'Super Admin';
    }
    return this.currentUser.fullName || this.currentUser.email || 'Pengguna AKK';
  }

  /**
   * Memastikan sinkronisasi dua arah real-time antara profil pengguna aktif dan identitas supir/portal:
   * 1. Menjaga 'displayName' portal selalu sama persis dengan 'fullName' pengguna.
   * 2. Menyelaraskan daftar kru (`this.crews`) agar supir aktif memiliki nama yang identik dengan profil pengguna.
   * 3. Menyimpan sesi supir lokal (`akk_driver_auth_session`) secara konsisten.
   */
  public syncPortalDisplayName(fullName?: string): string {
    const targetName = (fullName || this.currentUser?.fullName || '').trim();
    if (!targetName) return this.getPortalDisplayName();

    if (this.currentUser && this.currentUser.fullName !== targetName) {
      this.currentUser.fullName = targetName;
      const userInList = this.users.find(u => u.id === this.currentUser.id);
      if (userInList) {
        userInList.fullName = targetName;
      }
      this.saveToStorage(STORAGE_KEYS.USERS, this.users);
      this.saveToStorage(STORAGE_KEYS.CURRENT_USER, this.currentUser);
    }

    this.syncCurrentUserToCrew();
    this.notify();
    return this.getPortalDisplayName();
  }

  /**
   * Helper utama untuk menyelaraskan currentUser dengan Crew dan session storage supir
   */
  public syncCurrentUserToCrew(): Crew {
    if (!this.crews || this.crews.length === 0) {
      this.crews = this.computeSyncedCrews();
    }
    const user = this.getCurrentUser();
    const cleanUserName = (user?.fullName || '').trim();
    const lowerName = cleanUserName.toLowerCase();
    const isCrewRole = user?.role === 'driver' || user?.role === 'crew_helper';

    // Jika user yang login BUKAN driver atau helper (misal: Super Admin, SPV Logistik, dll.),
    // JANGAN membuat entri Crew baru atas nama Super Admin agar tidak mengotori daftar Kru Supir/Helper!
    if (!isCrewRole) {
      return this.crews[0];
    }

    const expectedCrewId = `crw-${user?.id || 'usr'}`;

    // 1. Cari kru yang cocok berdasarkan ID atau kata nama lengkap (mencegah 'Budi' menimpa 'Budiono')
    let matchedCrew = this.crews.find(c => {
      if (c.id === expectedCrewId) return true;
      const cName = (c.name || '').trim().toLowerCase();
      if (cName === lowerName) return true;
      const cTokens = cName.split(/[\s,/&.-]+/).filter(w => w.length >= 3);
      const uTokens = lowerName.split(/[\s,/&.-]+/).filter(w => w.length >= 3);
      if (cTokens.length > 0 && uTokens.length > 0) {
        return cTokens.every(t => uTokens.includes(t)) || uTokens.every(t => cTokens.includes(t));
      }
      return false;
    });

    if (matchedCrew) {
      let changed = false;
      if (cleanUserName && matchedCrew.name !== cleanUserName) {
        matchedCrew.name = cleanUserName;
        changed = true;
      }
      if (changed) {
        try {
          safeSetItem(STORAGE_KEYS.CREWS, JSON.stringify(this.crews));
        } catch {}
      }
    } else {
      matchedCrew = {
        id: expectedCrewId,
        name: cleanUserName || 'Driver Operasional',
        phone: user?.phone && user.phone !== '-' ? user.phone : '',
        role: user?.role === 'crew_helper' ? 'Kernet / Helper' : 'Driver Utama',
        licenseNumber: '',
        licenseType: user?.role === 'crew_helper' ? 'SIM A' : 'SIM B1 Umum',
        status: 'available',
        currentFleetId: undefined,
        tripsCompleted: 0,
        rating: 0,
        certifications: [],
        routeExperience: []
      };
      const existingIdx = this.crews.findIndex(c => c.id === expectedCrewId);
      if (existingIdx !== -1) {
        this.crews[existingIdx] = matchedCrew;
      } else {
        this.crews.push(matchedCrew);
      }
      try {
        safeSetItem(STORAGE_KEYS.CREWS, JSON.stringify(this.crews));
      } catch {}
    }

    try {
      localStorage.setItem('akk_driver_auth_session', JSON.stringify(matchedCrew));
    } catch {}

    return matchedCrew;
  }

  public getActiveDriverCrew(): Crew | null {
    return this.syncCurrentUserToCrew();
  }

  // Actions
  public setCurrentRole(role: UserRole) {
    const profile = this.users.find(p => p.role === role && p.status === 'approved') || {
      ...this.currentUser,
      role
    };
    this.currentUser = profile;
    this.saveToStorage(STORAGE_KEYS.CURRENT_USER, this.currentUser);
    this.notify();
  }

  public setSchedules(schedules: Schedule[]): void {
    this.schedules = [...schedules];
    this.saveToStorage(STORAGE_KEYS.SCHEDULES, this.schedules);
    this.syncSchedulesToCrewHistory(this.schedules);
    this.notify();
  }

  public addSchedule(schedule: Omit<Schedule, 'id' | 'createdAt'>): Schedule {
    const areaName = resolveScheduleAreaName(schedule);
    const isBali = schedule.isInterIsland || areaName.toUpperCase().includes('BALI') || areaName.toUpperCase().includes('DENPASAR') || areaName.toUpperCase().includes('SINGARAJA') || areaName.toUpperCase().includes('NEGARA');

    const depMatch = (schedule.departureDate || '').match(/T(\d{2}:\d{2})/);
    const arrMatch = (schedule.estimatedArrival || '').match(/T(\d{2}:\d{2})/);
    const resolvedDeliveryWindow =
      schedule.store?.deliveryWindow && schedule.store.deliveryWindow !== '08:00 - 17:00'
        ? schedule.store.deliveryWindow
        : depMatch && arrMatch
        ? `${depMatch[1]} - ${arrMatch[1]}`
        : schedule.store?.deliveryWindow || '07:30 - 17:00';

    const areaStore: RetailStore = {
      id: schedule.storeId && !schedule.storeId.startsWith('str-fix-') ? schedule.storeId : `area-${areaName.toLowerCase().replace(/[^a-z0-9]/g, '-')}`,
      storeCode: `AREA-${areaName.substring(0, 4).toUpperCase().replace(/[^A-Z0-9]/g, '')}`,
      storeName: areaName,
      island: isBali ? 'Bali & Nusa Tenggara' : 'Jawa',
      province: isBali ? 'Bali' : 'Jawa Timur',
      city: isBali ? 'Denpasar' : (areaName.toUpperCase().includes('JEMBER') ? 'Jember' : (areaName.toUpperCase().includes('SITUBONDO') ? 'Situbondo' : (areaName.toUpperCase().includes('BONDOWOSO') ? 'Bondowoso' : 'Banyuwangi'))),
      address: `Area Pengiriman Distribusi ${areaName}`,
      latitude: isBali ? -8.6705 : -8.219,
      longitude: isBali ? 115.2126 : 114.369,
      contactPerson: 'PIC Distribusi Area',
      phone: '-',
      deliveryWindow: resolvedDeliveryWindow,
      storeCategory: 'Distribution Hub'
    };

    const newSchedule: Schedule = {
      ...schedule,
      id: 'sch-' + Math.random().toString(36).substring(2, 9),
      areaName,
      store: areaStore,
      createdAt: new Date().toISOString()
    };

    // Status armada berubah menjadi 'on-duty' (Kirim) hanya saat sudah Gate-Out ('in_transit' / 'picked_up')
    if (newSchedule.status === 'in_transit' || newSchedule.status === 'picked_up') {
      this.updateFleetStatus(newSchedule.fleetId, 'on-duty', newSchedule.cargoWeightTon);
      this.updateCrewStatus(newSchedule.crewId, 'on-duty');
    }

    this.schedules = [newSchedule, ...this.schedules];
    this.saveToStorage(STORAGE_KEYS.SCHEDULES, this.schedules);
    this.syncSchedulesToCrewHistory(this.schedules);

    const hydratedNewSchedule: Schedule = {
      ...newSchedule,
      fleet: this.fleets.find(f => f.id === newSchedule.fleetId) || newSchedule.fleet,
      crew: this.crews.find(c => c.id === newSchedule.crewId) || newSchedule.crew,
      crewHelper: newSchedule.crewHelperId ? (this.crews.find(c => c.id === newSchedule.crewHelperId) || newSchedule.crewHelper) : undefined,
      crewHelper2: newSchedule.crewHelper2Id ? (this.crews.find(c => c.id === newSchedule.crewHelper2Id) || newSchedule.crewHelper2) : undefined
    };

    // Trigger auto-write middleware
    this.dispatchMiddleware({
      entityType: 'schedule',
      action: 'create',
      id: newSchedule.id,
      data: hydratedNewSchedule,
      timestamp: new Date().toISOString()
    });

    // Publish real-time assignment notification via Supabase Realtime (filtered to assigned driver)
    try {
      supabaseRealtimeSync.publishScheduleChange('INSERT', hydratedNewSchedule, null).catch(() => {});
    } catch {}

    return hydratedNewSchedule;
  }

  public updateSchedule(id: string, updatedSchedule: Partial<Omit<Schedule, 'id' | 'createdAt'>>) {
    let oldSch: Schedule | null = null;
    let newSch: Schedule | null = null;
    this.schedules = this.schedules.map(sch => {
      if (sch.id === id) {
        oldSch = sch;
        const result = { ...sch, ...updatedSchedule };
        newSch = result;
        this.logActivity('Update Jadwal', sch.trackingNumber, `Perubahan pada jadwal ${id}`);
        return result;
      }
      return sch;
    });
    this.saveToStorage(STORAGE_KEYS.SCHEDULES, this.schedules);
    this.syncSchedulesToCrewHistory(this.schedules);

    if (newSch) {
      const hydratedUpdated: Schedule = {
        ...(newSch as Schedule),
        fleet: this.fleets.find(f => f.id === (newSch as Schedule).fleetId) || (newSch as Schedule).fleet,
        crew: this.crews.find(c => c.id === (newSch as Schedule).crewId) || (newSch as Schedule).crew,
        crewHelper: (newSch as Schedule).crewHelperId ? (this.crews.find(c => c.id === (newSch as Schedule).crewHelperId) || (newSch as Schedule).crewHelper) : undefined,
        crewHelper2: (newSch as Schedule).crewHelper2Id ? (this.crews.find(c => c.id === (newSch as Schedule).crewHelper2Id) || (newSch as Schedule).crewHelper2) : undefined
      };

      this.dispatchMiddleware({
        entityType: 'schedule',
        action: 'update',
        id,
        data: hydratedUpdated,
        previousData: oldSch || undefined,
        timestamp: new Date().toISOString()
      });

      try {
        supabaseRealtimeSync.publishScheduleChange('UPDATE', hydratedUpdated, oldSch).catch(() => {});
      } catch {}
    }

    this.notify();
  }

  public deleteSchedule(id: string) {
    const target = this.schedules.find(sch => sch.id === id);
    this.schedules = this.schedules.filter(sch => sch.id !== id);
    this.saveToStorage(STORAGE_KEYS.SCHEDULES, this.schedules);
    this.syncSchedulesToCrewHistory(this.schedules);

    this.dispatchMiddleware({
      entityType: 'schedule',
      action: 'delete',
      id,
      data: target || { id },
      timestamp: new Date().toISOString()
    });

    this.notify();
  }

  public clearAllSchedules() {
    this.schedules = [];
    this.saveToStorage(STORAGE_KEYS.SCHEDULES, []);
    try {
      localStorage.removeItem('akk_driver_cached_deliveries_v2');
    } catch {}
    this.notify();
  }

  /**
   * Batch add or update multiple schedules efficiently without thread locking or UI freeze.
   * On Google Sheets import, replaces old unedited schedules for the target month with fresh validated data.
   */
  public batchSyncSchedules(
    itemsToAdd: Schedule[],
    itemsToUpdate: { id: string; data: Partial<Schedule> }[] = [],
    options: { isImport?: boolean; replaceMonth?: boolean } = {}
  ): { addedCount: number; updatedCount: number } {
    // On import or explicit replace request, purge old unedited schedules for the affected month(s)
    if (options.isImport || options.replaceMonth) {
      const datesToReplace = new Set<string>();
      [...itemsToAdd, ...itemsToUpdate.map(u => u.data as Schedule)].forEach(item => {
        if (item && item.departureDate) {
          const d = new Date(item.departureDate);
          if (!isNaN(d.getTime())) {
            const monthKey = `${d.getFullYear()}-${d.getMonth()}`;
            datesToReplace.add(monthKey);
          }
        }
      });

      if (datesToReplace.size > 0) {
        this.schedules = this.schedules.filter(sch => {
          if (sch.isManuallyEdited) return true; // Preserve user's manual edits
          if (!sch.departureDate) return false;
          const d = new Date(sch.departureDate);
          if (isNaN(d.getTime())) return false;
          const monthKey = `${d.getFullYear()}-${d.getMonth()}`;
          return !datesToReplace.has(monthKey);
        });
      }
    }

    const updateMap = new Map<string, Partial<Schedule>>();
    itemsToUpdate.forEach(u => updateMap.set(u.id, u.data));

    // 1. In-memory update existing items
    if (updateMap.size > 0) {
      this.schedules = this.schedules.map(sch => {
        if (updateMap.has(sch.id)) {
          return { ...sch, ...updateMap.get(sch.id)! };
        }
        return sch;
      });
    }

    // 2. In-memory prepend new items (deduplicated by ID)
    const existingIdSet = new Set(this.schedules.map(s => s.id));
    const cleanNewItems = itemsToAdd.filter(item => !existingIdSet.has(item.id));
    this.schedules = [...cleanNewItems, ...this.schedules];

    // 3. Single disk save
    this.saveToStorage(STORAGE_KEYS.SCHEDULES, this.schedules);

    // 4. Single crew history recalculation
    this.syncSchedulesToCrewHistory(this.schedules);

    // 5. Single batched middleware dispatch (non-blocking)
    setTimeout(() => {
      this.dispatchMiddleware({
        entityType: 'schedule',
        action: 'update',
        id: `batch-${Date.now()}`,
        data: { added: cleanNewItems.length, updated: itemsToUpdate.length },
        metadata: { isBatch: true, source: options.isImport ? 'google_sheets_sync' : 'batch' },
        timestamp: new Date().toISOString()
      });
    }, 50);

    this.notify();
    return { addedCount: cleanNewItems.length, updatedCount: itemsToUpdate.length };
  }

  /**
   * Mengambil data minggu jadwal admin Sheet ALL dari cache persistent atau mengonversi dari jadwal operasional aktif
   */
  public getAdminScheduleWeeks(year: number, month: number): any[] | null {
    const effectiveMonth = month === -1 ? 0 : month;
    const cacheKey = `akk_admin_schedule_cache_${year}_${effectiveMonth}`;
    try {
      const saved = localStorage.getItem(cacheKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0 && parsed[0]?.days?.length > 0) {
          return parsed;
        }
      }
    } catch (e) {
      console.warn('Gagal membaca cache admin schedule weeks:', e);
    }
    return null;
  }

  /**
   * Menyimpan data minggu jadwal admin Sheet ALL ke cache persistent
   */
  public saveAdminScheduleWeeks(year: number, month: number, weeks: any[]) {
    const effectiveMonth = month === -1 ? 0 : month;
    const cacheKey = `akk_admin_schedule_cache_${year}_${effectiveMonth}`;
    try {
      localStorage.setItem(cacheKey, JSON.stringify(weeks));
      localStorage.setItem('akk_admin_schedule_weeks_cache', JSON.stringify(weeks));
      localStorage.setItem('akk_last_admin_schedule_sync_time', new Date().toISOString());
    } catch (e) {
      console.warn('Gagal menyimpan admin schedule weeks:', e);
    }

    this.dispatchMiddleware({
      entityType: 'admin_schedule',
      action: 'update',
      id: `weeks_${year}_${effectiveMonth}`,
      data: weeks,
      timestamp: new Date().toISOString()
    });

    this.notify();
  }

  /**
   * Upload or attach image (Proof of delivery, manifest, photo) with automatic middleware dispatch
   */
  public attachImageToSchedule(scheduleId: string, imageUrl: string, imageType: string = 'proof_of_delivery', notes?: string) {
    this.dispatchMiddleware({
      entityType: 'image',
      action: 'upload',
      id: scheduleId,
      data: {
        scheduleId,
        url: imageUrl,
        type: imageType,
        notes,
        timestamp: new Date().toISOString()
      },
      timestamp: new Date().toISOString()
    });
    this.logActivity('Unggah Gambar / Dokumen', scheduleId, `Unggah ${imageType} pada jadwal ${scheduleId}`);
    this.notify();
  }

  public updateScheduleStatus(
    id: string,
    status: Schedule['status'],
    extraNotes?: string,
    podData?: {
      podPhotoUrl?: string;
      podReceiverName?: string;
      podConditionNote?: string;
      podPhotoTimestamp?: string;
    },
    postTripFleetStatus?: Fleet['status']
  ) {
    let deliveredSchedule: Schedule | null = null;
    let targetSch: Schedule | null = null;

    this.schedules = this.schedules.map(sch => {
      if (sch.id === id) {
        targetSch = sch;
        const updatedNotes = extraNotes 
          ? (sch.notes ? `${sch.notes} [${new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}: ${extraNotes}]` : extraNotes)
          : sch.notes;
        const updated: Schedule = {
          ...sch,
          status,
          notes: updatedNotes,
          ...(podData?.podPhotoUrl ? { podPhotoUrl: podData.podPhotoUrl } : {}),
          ...(podData?.podPhotoTimestamp ? { podPhotoTimestamp: podData.podPhotoTimestamp } : {}),
          ...(podData?.podReceiverName ? { podReceiverName: podData.podReceiverName } : {}),
          ...(podData?.podConditionNote ? { podConditionNote: podData.podConditionNote } : {}),
        };
        const targetFleetKey = sch.fleetId || sch.fleet?.plateNumber || '';
        if (status === 'delivered') {
          updated.actualArrival = new Date().toISOString();
          deliveredSchedule = updated;
          this.logActivity('Update Status', 'Pengiriman', `Status ${sch.trackingNumber} menjadi delivered`);
          if (podData?.podPhotoUrl) {
            this.attachImageToSchedule(sch.id, podData.podPhotoUrl, 'proof_of_delivery', `POD Penerima: ${podData.podReceiverName || 'PIC'}`);
          }
          // Ketika driver/helper klik sudah berada di gudang, status armada otomatis berubah menjadi Ready ('available') atau Servis ('maintenance')
          const resolvedPostStatus: Fleet['status'] = postTripFleetStatus || 'available';
          if (targetFleetKey) {
            this.updateFleetStatus(targetFleetKey, resolvedPostStatus, 0);
          }
          this.updateCrewStatus(sch.crewId, 'available');
          const fltDelivered = this.fleets.find(f => f.id === sch.fleetId || f.plateNumber === sch.fleet?.plateNumber);
          const crwDelivered = this.crews.find(c => c.id === sch.crewId);
          const alreadyGateIn = this.securityLogs.some(l => l.scheduleId === sch.id && l.status === 'Tiba di Gudang');
          if (!alreadyGateIn) {
            this.recordGateIn(
              sch.id,
              fltDelivered?.plateNumber || sch.trackingNumber,
              crwDelivered?.name || 'Driver AKK',
              'Armada Selesai Pengantaran & Tiba Kembali di Gudang DC',
              fltDelivered?.initialCode
            );
          }
        } else if (status === 'picked_up' || status === 'in_transit') {
          // Ketika driver/helper klik Gate-Out, status armada otomatis berubah menjadi Kirim ('on-duty')
          if (targetFleetKey) {
            this.updateFleetStatus(targetFleetKey, 'on-duty');
          }
          this.updateCrewStatus(sch.crewId, 'on-duty');
          this.logActivity('Update Status Driver', 'Pengiriman', `Status ${sch.trackingNumber} menjadi ${status}`);
          if (status === 'in_transit') {
            const flt = this.fleets.find(f => f.id === sch.fleetId || f.plateNumber === sch.fleet?.plateNumber);
            const crw = this.crews.find(c => c.id === sch.crewId);
            const store = this.stores.find(s => s.id === sch.storeId);
            const alreadyLogged = this.securityLogs.some(l => l.scheduleId === sch.id && l.status === 'Gate-Out');
            if (!alreadyLogged) {
              this.recordGateOut(
                sch.id,
                flt?.plateNumber || sch.trackingNumber,
                crw?.name || 'Driver AKK',
                sch.areaName || store?.storeName || 'Area Distribusi',
                flt?.initialCode
              );
            }
          }
        } else if (status === 'delayed') {
          this.logActivity('Kendala Pengiriman Driver', 'Pengiriman', `Status ${sch.trackingNumber} delayed: ${extraNotes || 'Tertunda'}`);
        }
        return updated;
      }
      return sch;
    });
    this.saveToStorage(STORAGE_KEYS.SCHEDULES, this.schedules);

    if (targetSch) {
      const sch = targetSch as Schedule;
      const hydratedStatusSch: Schedule = {
        ...sch,
        status,
        fleet: this.fleets.find(f => f.id === sch.fleetId) || sch.fleet,
        crew: this.crews.find(c => c.id === sch.crewId) || sch.crew,
        crewHelper: sch.crewHelperId ? (this.crews.find(c => c.id === sch.crewHelperId) || sch.crewHelper) : undefined,
        crewHelper2: sch.crewHelper2Id ? (this.crews.find(c => c.id === sch.crewHelper2Id) || sch.crewHelper2) : undefined
      };

      try {
        supabaseRealtimeSync.publishScheduleChange('UPDATE', hydratedStatusSch, sch).catch(() => {});
        supabaseRealtimeSync.publishScheduleStatusChange(hydratedStatusSch, sch.status, extraNotes).catch(() => {});
      } catch {}

      const updateItem: OfflineScheduleStatusUpdate = {
        id: 'off-upd-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6),
        scheduleId: sch.id,
        trackingNumber: sch.trackingNumber,
        status,
        extraNotes,
        podData,
        timestamp: new Date().toISOString()
      };

      if (typeof navigator !== 'undefined' && navigator.onLine) {
        this.syncSingleUpdateToSupabase(updateItem).then(success => {
          if (!success) {
            this.pushToOfflineQueue(updateItem);
          }
        }).catch(() => {
          this.pushToOfflineQueue(updateItem);
        });
      } else {
        this.pushToOfflineQueue(updateItem);
      }
    }

    // Record delivery in crew history
    if (deliveredSchedule) {
      const sch = deliveredSchedule as Schedule;
      const store = this.stores.find(s => s.id === sch.storeId);
      const crew = this.crews.find(c => c.id === sch.crewId);
      const fleet = this.fleets.find(f => f.id === sch.fleetId);

      if (crew && store) {
        const areaName = `${store.island} (${store.city})`;
        const areaStats = this.checkCrewAreaThreshold(crew.id, areaName);

        const newHistoryItem: CrewDeliveryHistory = {
          id: 'cdh-' + Math.random().toString(36).substring(2, 9),
          crewId: crew.id,
          crewName: crew.name,
          scheduleId: sch.id,
          trackingNumber: sch.trackingNumber,
          storeName: store.storeName,
          area: areaName,
          city: store.city,
          island: store.island,
          vehiclePlate: fleet?.plateNumber || '-',
          vehicleType: fleet?.vehicleType || 'Pick Up Box',
          cargoWeightTon: sch.cargoWeightTon,
          cargoDescription: sch.cargoDescription,
          completionDate: new Date().toISOString(),
          status: 'delivered',
          onTimeStatus: 'Tepat Waktu',
          ratingReceived: 5.0,
          podPhotoUrl: sch.podPhotoUrl,
          podReceiverName: sch.podReceiverName,
          areaTripSequenceNumber: areaStats.tripCount + 1,
          requiresAreaApproval: (areaStats.tripCount + 1) >= this.areaThreshold,
          areaApprovalStatus: (areaStats.tripCount + 1) >= this.areaThreshold ? 'approved' : 'not_required'
        };

        this.crewHistory = [newHistoryItem, ...this.crewHistory];
        this.saveToStorage(STORAGE_KEYS.CREW_HISTORY, this.crewHistory);

        // Increment trips completed on crew
        this.crews = this.crews.map(c => c.id === crew.id ? { ...c, tripsCompleted: c.tripsCompleted + 1 } : c);
        this.saveToStorage(STORAGE_KEYS.CREWS, this.crews);
      }
    }

    this.dispatchMiddleware({
      entityType: 'schedule',
      action: 'status_change',
      id,
      data: { id, status, actualArrival: status === 'delivered' ? new Date().toISOString() : undefined },
      timestamp: new Date().toISOString()
    });

    this.notify();
  }

  private pushToOfflineQueue(item: OfflineScheduleStatusUpdate) {
    const existingIdx = this.offlineScheduleQueue.findIndex(q => q.scheduleId === item.scheduleId);
    if (existingIdx >= 0) {
      this.offlineScheduleQueue[existingIdx] = item;
    } else {
      this.offlineScheduleQueue.push(item);
    }
    this.saveToStorage('akk_offline_sync_queue', this.offlineScheduleQueue);
  }

  private async syncSingleUpdateToSupabase(item: OfflineScheduleStatusUpdate): Promise<boolean> {
    // Legacy method name retained for compatibility; persistence now targets Hostinger MySQL.
    try {
      const notes = item.extraNotes && item.extraNotes.trim()
        ? item.extraNotes.trim()
        : item.podData?.podReceiverName
          ? `Diterima: ${item.podData.podReceiverName} (${item.podData.podConditionNote || 'Kondisi Baik'})${item.podData.podPhotoUrl ? ' [Bukti Foto POD OK]' : ''}`
          : undefined;
      const response = await fetch(`/api/schedules/${encodeURIComponent(item.scheduleId)}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({
          status: item.status,
          notes,
          trackingNumber: item.trackingNumber,
          actualArrival: item.status === 'delivered' ? new Date().toISOString() : undefined
        })
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  public async syncOfflineQueueToSupabase(): Promise<{ synced: number; remaining: number }> {
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      return { synced: 0, remaining: this.offlineScheduleQueue.length };
    }
    if (this.offlineScheduleQueue.length === 0) {
      return { synced: 0, remaining: 0 };
    }

    let syncedCount = 0;
    const remaining: OfflineScheduleStatusUpdate[] = [];

    for (const item of [...this.offlineScheduleQueue]) {
      const success = await this.syncSingleUpdateToSupabase(item);
      if (success) {
        syncedCount++;
      } else {
        remaining.push(item);
      }
    }

    this.offlineScheduleQueue = remaining;
    this.saveToStorage('akk_offline_sync_queue', this.offlineScheduleQueue);

    if (syncedCount > 0) {
      console.info(`[LogisticsStore] Successfully synced ${syncedCount} offline delivery updates to Supabase database.`);
      this.emitNotification(
        'delivery',
        'Sinkronisasi Offline Berhasil',
        `${syncedCount} pembaruan status pengiriman yang tertunda saat offline kini telah disinkronkan ke Supabase.`
      );
    }

    return { synced: syncedCount, remaining: this.offlineScheduleQueue.length };
  }

  public getOfflineScheduleQueue(): OfflineScheduleStatusUpdate[] {
    return [...this.offlineScheduleQueue];
  }

  public addFleet(fleet: Omit<Fleet, 'id'>): Fleet {
    // Prevent adding any fleet with plate ending in AKK
    if ((fleet.plateNumber || '').trim().toUpperCase().endsWith('AKK')) {
      console.warn(`[Store] Dilarang menambahkan armada berakhiran AKK (${fleet.plateNumber}). Menggunakan armada resmi.`);
      const fallback = this.fleets.find(f => !(f.plateNumber || '').toUpperCase().endsWith('AKK')) || INITIAL_FLEETS[0];
      return fallback;
    }

    const newFleet: Fleet = {
      ...fleet,
      id: 'flt-' + Math.random().toString(36).substring(2, 8)
    };
    this.fleets = [...this.fleets, newFleet];
    this.saveToStorage(STORAGE_KEYS.FLEETS, this.fleets);

    // Asynchronous backend integration with Supabase
    createFleetInSupabase(newFleet).then(res => {
      if (res.data?.id && res.data.id !== newFleet.id) {
        newFleet.id = res.data.id;
        this.saveToStorage(STORAGE_KEYS.FLEETS, this.fleets);
        this.notify();
      }
    }).catch(err => console.warn('[Supabase Store Auto-Create Fleet Note]', err));

    this.dispatchMiddleware({
      entityType: 'fleet',
      action: 'create',
      id: newFleet.id,
      data: newFleet,
      timestamp: new Date().toISOString()
    });

    this.notify();
    return newFleet;
  }

  public purgeAkkFleets(): { removedCount: number; remainingCount: number } {
    const originalCount = this.fleets.length;
    this.fleets = this.fleets.filter(f => !(f.plateNumber || '').trim().toUpperCase().endsWith('AKK'));
    
    // Ensure all 12 initial fleets are present
    INITIAL_FLEETS.forEach(initF => {
      const exists = this.fleets.some(f => f.id === initF.id || f.plateNumber === initF.plateNumber);
      if (!exists && !(initF.plateNumber || '').toUpperCase().endsWith('AKK')) {
        this.fleets.push({ ...initF });
      }
    });
    
    this.saveToStorage(STORAGE_KEYS.FLEETS, this.fleets);

    // Re-map any schedules pointing to deleted AKK fleets
    this.schedules = this.schedules.map(sch => {
      const currentF = this.fleets.find(f => f.id === sch.fleetId);
      if (!currentF || (currentF.plateNumber || '').trim().toUpperCase().endsWith('AKK')) {
        const fallback = this.fleets.find(f => !(f.plateNumber || '').toUpperCase().endsWith('AKK')) || this.fleets[0];
        return { ...sch, fleetId: fallback.id, fleet: fallback };
      }
      return sch;
    });
    this.saveToStorage(STORAGE_KEYS.SCHEDULES, this.schedules);
    this.notify();

    return {
      removedCount: Math.max(0, originalCount - this.fleets.length),
      remainingCount: this.fleets.length
    };
  }

  public updateFleetStatus(idOrPlate: string, status: Fleet['status'], tonnage?: number) {
    const cleanTarget = (idOrPlate || '').trim().toUpperCase();
    let matchedId = idOrPlate;
    this.fleets = this.fleets.map(f => {
      if (
        f.id === idOrPlate ||
        f.plateNumber.trim().toUpperCase() === cleanTarget ||
        (f.initialCode && f.initialCode.trim().toUpperCase() === cleanTarget)
      ) {
        matchedId = f.id;
        return {
          ...f,
          status,
          currentTonnage: tonnage !== undefined ? tonnage : f.currentTonnage
        };
      }
      return f;
    });
    this.saveToStorage(STORAGE_KEYS.FLEETS, this.fleets);

    // Asynchronous backend integration with Supabase
    updateFleetInSupabase(matchedId, { status, currentTonnage: tonnage }).catch(err => console.warn('[Supabase Fleet Status Sync Note]', err));

    this.dispatchMiddleware({
      entityType: 'fleet',
      action: 'status_change',
      id: matchedId,
      data: { id: matchedId, status, currentTonnage: tonnage },
      timestamp: new Date().toISOString()
    });

    this.notify();
  }

  /**
   * Mengambil informasi status kondisi armada secara real-time terintegrasi dengan:
   * - Check-In / Gate-Out / Tiba di Gudang (Check-Out) Tim Pengiriman
   * - Jadwal Pengiriman Hari Ini
   * - Data Armada & Portal Driver
   *
   * 3 Status Kondisi Armada:
   * 1. Ready ('available'): Siap digunakan jadwal esok harinya (setelah klik sudah berada di gudang / normal). Penanda: Titik Besar Hijau.
   * 2. Kirim ('on-duty'): Sedang dipakai kirim tim pengiriman (setelah driver/helper klik Gate-Out). Penanda: Titik Besar Biru + Area Kirim hari tersebut.
   * 3. Servis ('maintenance'): Dalam keadaan perbaikan dan TIDAK BISA diaturkan kirim. Penanda: Titik Besar Merah.
   */
  public getFleetLiveOperationalInfo(
    fleetOrId: Fleet | string,
    targetDateStr?: string
  ): {
    effectiveStatus: 'available' | 'on-duty' | 'maintenance';
    statusLabel: 'Ready' | 'Kirim' | 'Servis';
    dotColorClass: string;
    badgeColorClass: string;
    areaName: string | null;
    driverName: string | null;
    helperName: string | null;
    canBeScheduled: boolean;
    statusDescription: string;
    scheduleStatus: Schedule['status'] | null;
  } {
    const fleet =
      typeof fleetOrId === 'string'
        ? this.fleets.find(
            f =>
              f.id === fleetOrId ||
              f.plateNumber.trim().toUpperCase() === fleetOrId.trim().toUpperCase()
          )
        : fleetOrId;

    if (!fleet) {
      return {
        effectiveStatus: 'available',
        statusLabel: 'Ready',
        dotColorClass: 'bg-emerald-500 ring-4 ring-emerald-500/20',
        badgeColorClass: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
        areaName: null,
        driverName: null,
        helperName: null,
        canBeScheduled: true,
        statusDescription: 'Siap digunakan jadwal esok harinya',
        scheduleStatus: null
      };
    }

    const todayIso = targetDateStr || new Date().toISOString().slice(0, 10);
    const cleanPlate = (fleet.plateNumber || '').trim().toUpperCase();

    const matchesFleet = (sch: Schedule) => {
      if (sch.fleetId === fleet.id) return true;
      const schPlate = (sch.fleet?.plateNumber || '').trim().toUpperCase();
      if (schPlate && schPlate === cleanPlate) return true;
      return false;
    };

    // 1. Cari jadwal yang sedang aktif di jalan (sudah klik Gate-Out: in_transit, picked_up, delayed)
    const activeTripSch = (this.schedules || []).find(
      sch => ['in_transit', 'picked_up', 'delayed'].includes(sch.status) && matchesFleet(sch)
    );

    // 2. Cari jadwal pada tanggal hari ini (atau tanggal terpilih) untuk menampilkan info area kirim hari tersebut
    const dateMatchedSch =
      activeTripSch ||
      (this.schedules || []).find(
        sch =>
          matchesFleet(sch) &&
          (sch.departureDate || sch.createdAt || '').slice(0, 10) === todayIso
      ) ||
      (this.schedules || []).find(sch => matchesFleet(sch) && sch.status === 'scheduled');

    let resolvedArea: string | null = null;
    let resolvedDriver: string | null = null;
    let resolvedHelper: string | null = null;

    if (dateMatchedSch) {
      resolvedArea =
        dateMatchedSch.areaName ||
        dateMatchedSch.store?.storeName ||
        null;
      resolvedDriver =
        dateMatchedSch.crew?.name ||
        this.crews.find(c => c.id === dateMatchedSch.crewId)?.name ||
        null;
      resolvedHelper =
        dateMatchedSch.crewHelper?.name ||
        (dateMatchedSch.crewHelperId
          ? this.crews.find(c => c.id === dateMatchedSch.crewHelperId)?.name || null
          : null);
    }

    // Cek juga dari data Check-In shift aktif hari ini jika belum ada di jadwal
    if (!resolvedArea && typeof localStorage !== 'undefined') {
      try {
        const rawShifts = localStorage.getItem('akk_driver_shifts_v2');
        if (rawShifts) {
          const shifts: any[] = JSON.parse(rawShifts);
          const activeShift = shifts.find(
            s =>
              s.date === todayIso &&
              s.status !== 'checked_out' &&
              (s.fleetId === fleet.id ||
                (s.plateNumber && s.plateNumber.trim().toUpperCase() === cleanPlate))
          );
          if (activeShift) {
            resolvedDriver = resolvedDriver || activeShift.driverName || null;
          }
        }
      } catch {}
    }

    // Penentuan 3 Status Kondisi Armada:
    // - Servis ('maintenance'): Armada dalam perbaikan (tidak bisa diaturkan kirim)
    // - Kirim ('on-duty'): Armada sedang dipakai kirim (setelah klik Gate-Out atau status armada 'on-duty')
    // - Ready ('available'): Armada siap digunakan jadwal esok harinya (setelah klik sudah berada di gudang / standby)
    let effectiveStatus: 'available' | 'on-duty' | 'maintenance' = 'available';
    if (fleet.status === 'maintenance') {
      effectiveStatus = 'maintenance';
    } else if (activeTripSch || fleet.status === 'on-duty') {
      effectiveStatus = 'on-duty';
    } else {
      effectiveStatus = 'available';
    }

    if (effectiveStatus === 'maintenance') {
      return {
        effectiveStatus: 'maintenance',
        statusLabel: 'Servis',
        dotColorClass: 'bg-rose-500 ring-4 ring-rose-500/25',
        badgeColorClass: 'bg-rose-500/15 text-rose-300 border-rose-500/40',
        areaName: resolvedArea,
        driverName: resolvedDriver,
        helperName: resolvedHelper,
        canBeScheduled: false,
        statusDescription: 'Dalam perbaikan (Tidak bisa diaturkan kirim)',
        scheduleStatus: dateMatchedSch?.status || null
      };
    }

    if (effectiveStatus === 'on-duty') {
      return {
        effectiveStatus: 'on-duty',
        statusLabel: 'Kirim',
        dotColorClass: 'bg-blue-500 ring-4 ring-blue-500/25',
        badgeColorClass: 'bg-blue-500/15 text-blue-300 border-blue-500/40',
        areaName: resolvedArea,
        driverName: resolvedDriver,
        helperName: resolvedHelper,
        canBeScheduled: true,
        statusDescription: resolvedArea
          ? `Sedang Kirim • Area: ${resolvedArea}`
          : 'Sedang dipakai kirim tim pengiriman (Gate-Out)',
        scheduleStatus: dateMatchedSch?.status || 'in_transit'
      };
    }

    return {
      effectiveStatus: 'available',
      statusLabel: 'Ready',
      dotColorClass: 'bg-emerald-500 ring-4 ring-emerald-500/25',
      badgeColorClass: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40',
      areaName: resolvedArea,
      driverName: resolvedDriver,
      helperName: resolvedHelper,
      canBeScheduled: true,
      statusDescription: resolvedArea
        ? `Siap jadwal esok • Area Hari Ini: ${resolvedArea}`
        : 'Siap untuk digunakan jadwal esok harinya',
      scheduleStatus: dateMatchedSch?.status || null
    };
  }

  public updateFleet(id: string, updatedFields: Partial<Fleet>) {
    this.verifyDriverAccess('updateFleet');

    let updatedFleet: Fleet | null = null;
    this.fleets = this.fleets.map(f => {
      if (f.id === id) {
        updatedFleet = { ...f, ...updatedFields };
        return updatedFleet;
      }
      return f;
    });
    this.saveToStorage(STORAGE_KEYS.FLEETS, this.fleets);

    if (updatedFleet) {
      // Asynchronous backend integration with Supabase
      updateFleetInSupabase(id, updatedFields).catch(err => console.warn('[Supabase Fleet Update Sync Note]', err));

      this.dispatchMiddleware({
        entityType: 'fleet',
        action: 'update',
        id,
        data: updatedFleet,
        timestamp: new Date().toISOString()
      });
    }

    this.notify();
  }

  public deleteFleet(id: string) {
    const deletedFleet = this.fleets.find(f => f.id === id);
    this.fleets = this.fleets.filter(f => f.id !== id);
    this.saveToStorage(STORAGE_KEYS.FLEETS, this.fleets);
    if (deletedFleet) {
      this.logActivity('Hapus Armada', deletedFleet.plateNumber, `Menghapus armada ${deletedFleet.plateNumber} (${deletedFleet.vehicleType})`);
      
      // Asynchronous backend integration with Supabase
      deleteFleetInSupabase(id, deletedFleet.plateNumber).catch(err => console.warn('[Supabase Fleet Delete Sync Note]', err));

      this.dispatchMiddleware({
        entityType: 'fleet',
        action: 'delete',
        id,
        data: deletedFleet,
        timestamp: new Date().toISOString()
      });
    }
    this.notify();
  }

  public addCrew(crew: Omit<Crew, 'id' | 'tripsCompleted' | 'rating'>): Crew {
    const cleanName = (crew.name || '').trim();
    const isHelper = (crew.role || '').toLowerCase().includes('helper') || (crew.role || '').toLowerCase().includes('kernet');
    const targetUserRole: UserRole = isHelper ? 'crew_helper' : 'driver';

    // Ensure a corresponding user exists in Manajemen User
    const existingUser = this.users.find(u => u.fullName.trim().toLowerCase() === cleanName.toLowerCase());
    if (!existingUser && cleanName) {
      const emailSlug = cleanName.toLowerCase().replace(/[^a-z0-9]/g, '') || 'kru';
      const createdUser: UserProfile = {
        id: 'usr-' + Math.random().toString(36).substring(2, 8),
        fullName: cleanName,
        email: `${emailSlug}@gmail.com`,
        password: undefined,
        role: targetUserRole,
        department: 'Logistik & Pengiriman',
        phone: crew.phone || '0812-3456-7890',
        status: 'pending',
        createdAt: new Date().toISOString(),
        notes: `Terintegrasi dari Data Kru & Jadwal Pengiriman (${crew.role}) — akun login menunggu verifikasi Super Admin`,
        permissions: {
          modules: getDefaultPermissionsForRole(targetUserRole)
        }
      };
      this.users = [createdUser, ...this.users];
      this.saveToStorage(STORAGE_KEYS.USERS, this.users);
      // Bootstrap a pending server account with a one-time random password. Super Admin must reset it before activation.
      const bootstrapPassword = (typeof crypto !== 'undefined' && 'randomUUID' in crypto)
        ? `${crypto.randomUUID()}!A9`
        : `${Math.random().toString(36).slice(2)}${Date.now()}!A9`;
      fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({
          fullName: createdUser.fullName,
          email: createdUser.email,
          phone: createdUser.phone,
          department: createdUser.department,
          password: bootstrapPassword
        })
      }).catch(err => console.warn('[Hostinger Users] Bootstrap akun kru gagal:', err));
    } else if (existingUser && existingUser.role !== 'driver' && existingUser.role !== 'crew_helper') {
      existingUser.role = targetUserRole;
      this.saveToStorage(STORAGE_KEYS.USERS, this.users);
    }

    const newCrew: Crew = {
      ...crew,
      id: 'crw-' + Math.random().toString(36).substring(2, 8),
      tripsCompleted: 0,
      rating: 5.0
    };
    this.crews = [...this.crews, newCrew];
    this.syncUsersWithCrews();
    this.logActivity('Tambah Kru', newCrew.name, `Menambahkan kru baru ${newCrew.name} sebagai ${newCrew.role}`);
    
    // Asynchronous backend integration with Supabase
    createCrewInSupabase(newCrew).then(res => {
      if (res.data?.id && res.data.id !== newCrew.id) {
        newCrew.id = res.data.id;
        this.saveToStorage(STORAGE_KEYS.CREWS, this.crews);
        this.notify();
      }
    }).catch(err => console.warn('[Supabase Crew Create Sync Note]', err));

    this.dispatchMiddleware({
      entityType: 'crew',
      action: 'create',
      id: newCrew.id,
      data: newCrew,
      timestamp: new Date().toISOString()
    });

    this.notify();
    return newCrew;
  }

  public updateCrewStatus(id: string, status: Crew['status']) {
    this.crews = this.crews.map(c => (c.id === id ? { ...c, status } : c));
    this.saveToStorage(STORAGE_KEYS.CREWS, this.crews);
    
    // Asynchronous backend integration with Supabase
    updateCrewInSupabase(id, { status }).catch(err => console.warn('[Supabase Crew Status Sync Note]', err));

    this.dispatchMiddleware({
      entityType: 'crew',
      action: 'status_change',
      id,
      data: { id, status },
      timestamp: new Date().toISOString()
    });

    this.notify();
  }

  public updateCrew(id: string, updatedFields: Partial<Crew>) {
    let updatedCrew: Crew | null = null;
    this.crews = this.crews.map(c => {
      if (c.id === id) {
        updatedCrew = { ...c, ...updatedFields };
        return updatedCrew;
      }
      return c;
    });
    this.saveToStorage(STORAGE_KEYS.CREWS, this.crews);

    if (updatedCrew) {
      // Asynchronous backend integration with Supabase
      updateCrewInSupabase(id, updatedFields).catch(err => console.warn('[Supabase Crew Update Sync Note]', err));

      this.dispatchMiddleware({
        entityType: 'crew',
        action: 'update',
        id,
        data: updatedCrew,
        timestamp: new Date().toISOString()
      });
    }

    this.notify();
  }

  public deleteCrew(id: string) {
    const deletedCrew = this.crews.find(c => c.id === id);
    this.crews = this.crews.filter(c => c.id !== id);
    this.saveToStorage(STORAGE_KEYS.CREWS, this.crews);
    if (deletedCrew) {
      this.logActivity('Hapus Kru', deletedCrew.name, `Menghapus kru ${deletedCrew.name} (${deletedCrew.role}) dari sistem armada`);
      
      // Asynchronous backend integration with Supabase
      deleteCrewInSupabase(id, deletedCrew.name).catch(err => console.warn('[Supabase Crew Delete Sync Note]', err));

      this.dispatchMiddleware({
        entityType: 'crew',
        action: 'delete',
        id,
        data: deletedCrew,
        timestamp: new Date().toISOString()
      });
    }
    this.notify();
  }

  public async syncFleetsAndCrewsWithSupabase(): Promise<{ success: boolean; fleetsCount: number; crewsCount: number; message: string }> {
    return syncSupabaseFleetsAndCrews();
  }

  public addStore(store: Omit<RetailStore, 'id'>): RetailStore {
    if (isAreaRouteItem(store)) {
      console.warn(`[Store Protection] Blocked adding non-retail area item "${store.storeName}" to Retail Stores table.`);
      return {
        ...store,
        id: 'area-dest-' + Math.random().toString(36).substring(2, 8)
      } as RetailStore;
    }
    const newStore: RetailStore = {
      ...store,
      id: 'str-' + Math.random().toString(36).substring(2, 8)
    };
    this.stores = [...this.stores.filter(s => !isAreaRouteItem(s)), newStore];
    this.saveToStorage(STORAGE_KEYS.STORES, this.stores);
    fetch('/api/stores', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin', body: JSON.stringify(newStore)
    }).catch(err => console.warn('[Hostinger Stores] Tambah toko gagal disinkronkan:', err));
    
    this.dispatchMiddleware({
      entityType: 'store',
      action: 'create',
      id: newStore.id,
      data: newStore,
      timestamp: new Date().toISOString()
    });

    this.notify();
    return newStore;
  }

  public setStores(newStores: RetailStore[]): void {
    this.stores = newStores.filter(s => !isAreaRouteItem(s));
    this.saveToStorage(STORAGE_KEYS.STORES, this.stores);
    fetch('/api/stores/batch', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin', body: JSON.stringify({ stores: this.stores })
    }).catch(err => console.warn('[Hostinger Stores] Batch toko gagal disinkronkan:', err));
    
    this.dispatchMiddleware({
      entityType: 'store',
      action: 'update',
      id: 'all_stores',
      data: { count: this.stores.length },
      metadata: { isBatch: true },
      timestamp: new Date().toISOString()
    });

    this.notify();
  }

  public updateStore(id: string, updatedFields: Partial<RetailStore>): void {
    let updatedStore: RetailStore | null = null;
    this.stores = this.stores.map(s => {
      if (s.id === id) {
        updatedStore = { ...s, ...updatedFields };
        return updatedStore;
      }
      return s;
    });
    this.saveToStorage(STORAGE_KEYS.STORES, this.stores);

    if (updatedStore) {
      fetch(`/api/stores/${encodeURIComponent(id)}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin', body: JSON.stringify(updatedStore)
      }).catch(err => console.warn('[Hostinger Stores] Update toko gagal disinkronkan:', err));
      this.dispatchMiddleware({
        entityType: 'store',
        action: 'update',
        id,
        data: updatedStore,
        timestamp: new Date().toISOString()
      });
    }

    this.notify();
  }

  public deleteStore(id: string): void {
    const target = this.stores.find(s => s.id === id);
    this.stores = this.stores.filter(s => s.id !== id);
    this.saveToStorage(STORAGE_KEYS.STORES, this.stores);

    if (target) {
      fetch(`/api/stores/${encodeURIComponent(id)}`, { method: 'DELETE', credentials: 'same-origin' })
        .catch(err => console.warn('[Hostinger Stores] Hapus toko gagal disinkronkan:', err));
      this.dispatchMiddleware({
        entityType: 'store',
        action: 'delete',
        id,
        data: target,
        timestamp: new Date().toISOString()
      });
    }
    this.notify();
  }

  public setSupabaseConfig(config: SupabaseConfig) {
    this.supabaseConfig = config;
    this.saveToStorage(STORAGE_KEYS.SUPABASE_CONFIG, config);
  }

  // ==========================================
  // SALES ADMIN (ADMIN PENJUALAN) METHODS
  // ==========================================

  public getSalesOrders(): SalesOrder[] {
    return this.salesOrders;
  }

  public addSalesOrder(order: Omit<SalesOrder, 'id'>): SalesOrder {
    this.verifyDriverAccess('addSalesOrder');

    const newOrder: SalesOrder = {
      ...order,
      id: 'so-' + Math.random().toString(36).substring(2, 8)
    };
    this.salesOrders = [newOrder, ...this.salesOrders];
    this.saveToStorage(STORAGE_KEYS.SALES_ORDERS, this.salesOrders);
    return newOrder;
  }

  public updateSalesOrderStatus(id: string, status: SalesOrder['orderStatus']) {
    this.salesOrders = this.salesOrders.map(o => (o.id === id ? { ...o, orderStatus: status } : o));
    this.saveToStorage(STORAGE_KEYS.SALES_ORDERS, this.salesOrders);
  }

  public getAdminActivities(): AdminActivity[] {
    return this.adminActivities;
  }

  public addAdminActivity(activity: Omit<AdminActivity, 'id'>): AdminActivity {
    const newActivity: AdminActivity = {
      ...activity,
      id: 'act-' + Math.random().toString(36).substring(2, 8)
    };
    this.adminActivities = [newActivity, ...this.adminActivities];
    this.saveToStorage(STORAGE_KEYS.ADMIN_ACTIVITIES, this.adminActivities);
    return newActivity;
  }

  public updateAdminActivityStatus(id: string, status: AdminActivity['status']) {
    this.adminActivities = this.adminActivities.map(a => (a.id === id ? { ...a, status } : a));
    this.saveToStorage(STORAGE_KEYS.ADMIN_ACTIVITIES, this.adminActivities);
  }

  public getAdminSchedules(): AdminSchedule[] {
    return this.adminSchedules;
  }

  public addAdminSchedule(schedule: Omit<AdminSchedule, 'id'>): AdminSchedule {
    const newSchedule: AdminSchedule = {
      ...schedule,
      id: 'sch-' + Math.random().toString(36).substring(2, 8)
    };
    this.adminSchedules = [newSchedule, ...this.adminSchedules];
    this.saveToStorage(STORAGE_KEYS.ADMIN_SCHEDULES, this.adminSchedules);
    return newSchedule;
  }

  public updateAdminScheduleStatus(id: string, status: AdminSchedule['status']) {
    this.adminSchedules = this.adminSchedules.map(s => (s.id === id ? { ...s, status } : s));
    this.saveToStorage(STORAGE_KEYS.ADMIN_SCHEDULES, this.adminSchedules);
  }

  public getLoadingRecords(): LoadingDurationRecord[] {
    return this.loadingRecords;
  }

  public addLoadingRecord(record: Omit<LoadingDurationRecord, 'id'>): LoadingDurationRecord {
    const newRecord: LoadingDurationRecord = {
      ...record,
      id: 'load-' + Math.random().toString(36).substring(2, 8)
    };
    this.loadingRecords = [newRecord, ...this.loadingRecords];
    this.saveToStorage(STORAGE_KEYS.LOADING_RECORDS, this.loadingRecords);
    return newRecord;
  }

  public getSkillProfiles(): AdminSkillProfile[] {
    return this.skillProfiles;
  }

  public updateSkillProfile(id: string, updatedSkills: AdminSkillProfile['skills']) {
    this.skillProfiles = this.skillProfiles.map(p => {
      if (p.id === id) {
        const avgScore = Math.round(
          (updatedSkills.reduce((acc, s) => acc + s.level, 0) / (updatedSkills.length * 5)) * 100
        );
        return {
          ...p,
          skills: updatedSkills,
          overallScore: avgScore
        };
      }
      return p;
    });
    this.saveToStorage(STORAGE_KEYS.SKILL_PROFILES, this.skillProfiles);
  }

  public getJobdeskConfigs(): JobdeskConfig[] {
    return this.jobdeskConfigs;
  }

  public getSystemActivities(): SystemActivity[] {
    return [...this.systemActivities];
  }

  public logActivity(action: string, target: string, details: string) {
    const newActivity: SystemActivity = {
      id: 'log-' + Math.random().toString(36).substring(2, 9),
      timestamp: new Date().toISOString(),
      userFullName: this.currentUser.fullName,
      department: this.currentUser.department,
      action,
      target,
      details
    };
    this.systemActivities = [newActivity, ...this.systemActivities].slice(0, 100);
    this.saveToStorage('akk_system_activities_v1', this.systemActivities);
    this.notify();
  }

  public updateJobdeskConfig(id: string, updated: Partial<JobdeskConfig>) {
    this.jobdeskConfigs = this.jobdeskConfigs.map(j => (j.id === id ? { ...j, ...updated } : j));
    this.saveToStorage(STORAGE_KEYS.JOBDESK_CONFIGS, this.jobdeskConfigs);
  }

  // ==========================================
  // SPARE PARTS & ROUTINE MAINTENANCE METHODS
  // ==========================================
  public getSpareParts(): SparePart[] {
    return [...this.spareParts];
  }

  public addSparePart(part: Omit<SparePart, 'id'>): SparePart {
    const newPart: SparePart = {
      ...part,
      id: 'sp-' + Math.random().toString(36).substring(2, 9)
    };
    this.spareParts = [newPart, ...this.spareParts];
    this.saveToStorage(STORAGE_KEYS.SPARE_PARTS, this.spareParts);
    this.logActivity(
      'Tambah Sparepart Baru',
      newPart.name,
      `Stok Awal: ${newPart.stock} ${newPart.unit} (Lokasi: ${newPart.storageLocation})`
    );
    this.notify();
    return newPart;
  }

  public updateSparePart(id: string, updated: Partial<SparePart>): void {
    this.spareParts = this.spareParts.map(p => p.id === id ? { ...p, ...updated } : p);
    this.saveToStorage(STORAGE_KEYS.SPARE_PARTS, this.spareParts);
    this.notify();
  }

  public deleteSparePart(id: string): void {
    const part = this.spareParts.find(p => p.id === id);
    this.spareParts = this.spareParts.filter(p => p.id !== id);
    this.saveToStorage(STORAGE_KEYS.SPARE_PARTS, this.spareParts);
    if (part) {
      this.logActivity(
        'Hapus Master Sparepart',
        part.name,
        `Part ID: ${id} dihapus dari master inventaris`
      );
    }
    this.notify();
  }

  public restockSparePart(id: string, amount: number, notes?: string): void {
    const part = this.spareParts.find(p => p.id === id);
    if (!part) return;
    const newStock = part.stock + amount;
    const today = new Date().toISOString().substring(0, 10);
    this.spareParts = this.spareParts.map(p => 
      p.id === id ? { ...p, stock: newStock, lastRestockDate: today, notes: notes || p.notes } : p
    );
    this.saveToStorage(STORAGE_KEYS.SPARE_PARTS, this.spareParts);
    this.logActivity(
      'Restock Sparepart Masuk',
      part.name,
      `Penambahan +${amount} ${part.unit} (Total kini: ${newStock} ${part.unit}). Catatan: ${notes || '-'}`
    );
    this.notify();
  }

  public getSparePartUsages(fleetId?: string): SparePartUsage[] {
    if (fleetId) {
      return this.sparePartUsages.filter(u => u.fleetId === fleetId);
    }
    return [...this.sparePartUsages];
  }

  public recordSparePartUsage(usage: Omit<SparePartUsage, 'id'>): SparePartUsage {
    const newUsage: SparePartUsage = {
      ...usage,
      id: 'usg-' + Math.random().toString(36).substring(2, 9)
    };

    // 1. Simpan ke daftar riwayat pemakaian
    this.sparePartUsages = [newUsage, ...this.sparePartUsages];
    this.saveToStorage(STORAGE_KEYS.SPARE_PART_USAGES, this.sparePartUsages);

    // 2. Potong stok otomatis di master inventaris gudang jika partId cocok
    if (usage.partId) {
      this.spareParts = this.spareParts.map(p => {
        if (p.id === usage.partId) {
          const reducedStock = Math.max(0, p.stock - usage.quantity);
          return { ...p, stock: reducedStock };
        }
        return p;
      });
      this.saveToStorage(STORAGE_KEYS.SPARE_PARTS, this.spareParts);
    }

    // 3. Sinkronisasi tanggal servis terakhir pada armada
    if (usage.fleetId) {
      this.fleets = this.fleets.map(f => {
        if (f.id === usage.fleetId) {
          return {
            ...f,
            lastMaintenance: usage.replacementDate,
            odometerKm: Math.max(f.odometerKm || 0, usage.odometerKm)
          };
        }
        return f;
      });
      this.saveToStorage(STORAGE_KEYS.FLEETS, this.fleets);
    }

    // 4. Catat ke audit log aktivitas sistem
    this.logActivity(
      'Ganti Komponen Rutin',
      `${usage.plateNumber} (${usage.initialCode || 'Armada'})`,
      `Penggantian ${usage.quantity} ${usage.unit} ${usage.partName} pada ${usage.odometerKm} KM oleh ${usage.mechanicOrWorkshop}`
    );

    this.notify();
    return newUsage;
  }

  public deleteSparePartUsage(id: string): void {
    const item = this.sparePartUsages.find(u => u.id === id);
    this.sparePartUsages = this.sparePartUsages.filter(u => u.id !== id);
    this.saveToStorage(STORAGE_KEYS.SPARE_PART_USAGES, this.sparePartUsages);
    if (item) {
      this.logActivity(
        'Hapus Log Ganti Sparepart',
        item.plateNumber,
        `Catatan penggantian ${item.partName} dihapus`
      );
    }
    this.notify();
  }

  public getFleetRoutineComponentsStatus(fleetId: string) {
    const usages = this.sparePartUsages.filter(u => u.fleetId === fleetId);
    const fleet = this.fleets.find(f => f.id === fleetId);
    const currentKm = fleet?.odometerKm || 50000;
    const now = new Date().getTime();

    // Helper untuk cari penggantian terakhir per kategori
    const getLatest = (cat: SparePartCategory) => {
      const match = usages
        .filter(u => u.category === cat)
        .sort((a, b) => new Date(b.replacementDate).getTime() - new Date(a.replacementDate).getTime())[0];
      return match;
    };

    const latestOil = getLatest('oli');
    const latestTire = getLatest('ban');
    const latestBattery = getLatest('aki');
    const latestFilter = getLatest('filter');

    const calculateStatus = (usage: SparePartUsage | undefined, defaultDays: number, defaultKm: number) => {
      if (!usage) {
        return {
          status: 'warning' as const,
          label: 'Perlu Cek',
          lastDate: '-',
          lastKm: 0,
          nextTarget: `${defaultKm.toLocaleString('id-ID')} KM`
        };
      }

      const diffDays = Math.floor((now - new Date(usage.replacementDate).getTime()) / (1000 * 60 * 60 * 24));
      const targetKm = usage.nextReplacementKm || (usage.odometerKm + defaultKm);
      const remainingKm = targetKm - currentKm;

      if (remainingKm <= 0 || diffDays > defaultDays) {
        return {
          status: 'urgent' as const,
          label: 'Wajib Ganti Segera',
          lastDate: usage.replacementDate,
          lastKm: usage.odometerKm,
          nextTarget: `${targetKm.toLocaleString('id-ID')} KM`,
          detail: `Sudah lewat ${Math.abs(remainingKm).toLocaleString('id-ID')} KM (${diffDays} hari lalu)`
        };
      }

      if (remainingKm <= 1500 || diffDays >= defaultDays * 0.8) {
        return {
          status: 'warning' as const,
          label: 'Segera Jadwalkan',
          lastDate: usage.replacementDate,
          lastKm: usage.odometerKm,
          nextTarget: `${targetKm.toLocaleString('id-ID')} KM`,
          detail: `Sisa ${remainingKm.toLocaleString('id-ID')} KM (${diffDays} hari pakai)`
        };
      }

      return {
        status: 'good' as const,
        label: 'Kondisi Prima',
        lastDate: usage.replacementDate,
        lastKm: usage.odometerKm,
        nextTarget: `${targetKm.toLocaleString('id-ID')} KM`,
        detail: `Pemakaian ${diffDays} hari (${remainingKm.toLocaleString('id-ID')} KM lagi)`
      };
    };

    return {
      fleet,
      oil: {
        latest: latestOil,
        ...calculateStatus(latestOil, 90, 10000) // Oli: 3 bulan / 10.000 KM
      },
      tire: {
        latest: latestTire,
        ...calculateStatus(latestTire, 365, 50000) // Ban: 1 tahun / 50.000 KM
      },
      battery: {
        latest: latestBattery,
        ...calculateStatus(latestBattery, 540, 80000) // Aki: 1.5 tahun / 80.000 KM
      },
      filter: {
        latest: latestFilter,
        ...calculateStatus(latestFilter, 90, 10000)
      }
    };
  }

  public resetToDefault() {
    localStorage.removeItem(STORAGE_KEYS.FLEETS);
    localStorage.removeItem(STORAGE_KEYS.CREWS);
    localStorage.removeItem(STORAGE_KEYS.STORES);
    localStorage.removeItem(STORAGE_KEYS.SCHEDULES);
    localStorage.removeItem(STORAGE_KEYS.SALES_ORDERS);
    localStorage.removeItem(STORAGE_KEYS.ADMIN_ACTIVITIES);
    localStorage.removeItem(STORAGE_KEYS.ADMIN_SCHEDULES);
    localStorage.removeItem(STORAGE_KEYS.LOADING_RECORDS);
    localStorage.removeItem(STORAGE_KEYS.SKILL_PROFILES);
    localStorage.removeItem(STORAGE_KEYS.JOBDESK_CONFIGS);
    localStorage.removeItem(STORAGE_KEYS.SPARE_PARTS);
    localStorage.removeItem(STORAGE_KEYS.SPARE_PART_USAGES);
    localStorage.removeItem(STORAGE_KEYS.FUEL_LOGS);
    this.fleets = [...INITIAL_FLEETS];
    this.crews = [...INITIAL_CREWS];
    this.stores = [...INITIAL_STORES];
    this.schedules = [...INITIAL_SCHEDULES];
    this.salesOrders = [...INITIAL_SALES_ORDERS];
    this.adminActivities = [...INITIAL_ADMIN_ACTIVITIES];
    this.adminSchedules = [...INITIAL_ADMIN_SCHEDULES];
    this.loadingRecords = [...INITIAL_LOADING_RECORDS];
    this.skillProfiles = [...INITIAL_SKILL_PROFILES];
    this.jobdeskConfigs = [...INITIAL_JOBDESK_CONFIGS];
    this.spareParts = [...INITIAL_SPARE_PARTS];
    this.sparePartUsages = [...INITIAL_SPARE_PART_USAGES];
    this.fuelLogs = [...INITIAL_FUEL_LOGS];
    this.saveToStorage(STORAGE_KEYS.FLEETS, this.fleets);
    this.saveToStorage(STORAGE_KEYS.CREWS, this.crews);
    this.saveToStorage(STORAGE_KEYS.STORES, this.stores);
    this.saveToStorage(STORAGE_KEYS.SCHEDULES, this.schedules);
    this.saveToStorage(STORAGE_KEYS.SALES_ORDERS, this.salesOrders);
    this.saveToStorage(STORAGE_KEYS.ADMIN_ACTIVITIES, this.adminActivities);
    this.saveToStorage(STORAGE_KEYS.ADMIN_SCHEDULES, this.adminSchedules);
    this.saveToStorage(STORAGE_KEYS.LOADING_RECORDS, this.loadingRecords);
    this.saveToStorage(STORAGE_KEYS.SKILL_PROFILES, this.skillProfiles);
    this.saveToStorage(STORAGE_KEYS.JOBDESK_CONFIGS, this.jobdeskConfigs);
    this.saveToStorage(STORAGE_KEYS.SPARE_PARTS, this.spareParts);
    this.saveToStorage(STORAGE_KEYS.SPARE_PART_USAGES, this.sparePartUsages);
    this.saveToStorage(STORAGE_KEYS.FUEL_LOGS, this.fuelLogs);
  }

  // ==========================================
  // MANAJEMEN EFISIENSI BBM ARMADA (FUEL STORE)
  // ==========================================
  public getFuelLogs(): FuelLog[] {
    return [...this.fuelLogs].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }

  public getFuelLogById(id: string): FuelLog | undefined {
    return this.fuelLogs.find(log => log.id === id);
  }

  public addFuelLog(data: Omit<FuelLog, 'id' | 'createdAt' | 'ratioKmPerLiter' | 'costPerKm' | 'efficiencyStatus' | 'totalCost' | 'distanceKm' | 'targetRatio'>): FuelLog {
    const fleet = this.fleets.find(f => f.id === data.fleetId);
    const vehicleType = data.vehicleType || fleet?.vehicleType || 'Engkel Long';
    const targetConfig = FUEL_TARGET_RATIOS[vehicleType] || { target: 7.5, minAcceptable: 6.4, label: '7.5 KM / L' };
    const targetRatio = targetConfig.target;

    const distanceKm = Math.max(0, data.endOdometerKm - data.startOdometerKm);
    const totalCost = Math.round(data.liters * data.costPerLiter);
    const ratioKmPerLiter = data.liters > 0 ? Number((distanceKm / data.liters).toFixed(2)) : 0;
    const literPerKm = distanceKm > 0 ? Number((data.liters / distanceKm).toFixed(4)) : 0;
    const literPer100Km = distanceKm > 0 ? Number(((data.liters / distanceKm) * 100).toFixed(2)) : 0;
    const costPerKm = distanceKm > 0 ? Math.round(totalCost / distanceKm) : 0;

    let efficiencyStatus: EfficiencyStatus = 'Efisien / Normal';
    if (ratioKmPerLiter >= targetRatio * 1.05) {
      efficiencyStatus = 'Sangat Efisien';
    } else if (ratioKmPerLiter >= targetRatio * 0.90) {
      efficiencyStatus = 'Efisien / Normal';
    } else if (ratioKmPerLiter >= targetRatio * 0.75) {
      efficiencyStatus = 'Boros';
    } else {
      efficiencyStatus = 'Kritis / Potensi Anomali';
    }

    const newLog: FuelLog = {
      ...data,
      id: `fuel-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 5)}`,
      vehicleType,
      targetRatio,
      distanceKm,
      totalCost,
      ratioKmPerLiter,
      literPerKm,
      literPer100Km,
      costPerKm,
      efficiencyStatus,
      createdAt: new Date().toISOString(),
      verifiedBy: data.verifiedBy || this.currentUser.fullName
    };

    this.fuelLogs = [newLog, ...this.fuelLogs];
    this.saveToStorage(STORAGE_KEYS.FUEL_LOGS, this.fuelLogs);

    if (fleet && data.endOdometerKm > (fleet.odometerKm || 0)) {
      this.fleets = this.fleets.map(f =>
        f.id === fleet.id ? { ...f, odometerKm: data.endOdometerKm } : f
      );
      this.saveToStorage(STORAGE_KEYS.FLEETS, this.fleets);
    }

    this.logActivity(
      'Pencatatan BBM Armada',
      `${newLog.plateNumber} (${newLog.initialCode || 'Armada'})`,
      `Pengisian ${newLog.liters} L ${newLog.fuelType} (Rp ${totalCost.toLocaleString('id-ID')}) - Rasio: ${ratioKmPerLiter} KM/L [${efficiencyStatus}]`
    );

    this.dispatchMiddleware({
      entityType: 'fuel',
      action: 'create',
      id: newLog.id,
      data: newLog,
      timestamp: new Date().toISOString()
    });

    this.notify();
    return newLog;
  }

  public updateFuelLog(id: string, updates: Partial<FuelLog>) {
    const existing = this.fuelLogs.find(l => l.id === id);
    if (!existing) return;

    const merged = { ...existing, ...updates };
    const fleet = this.fleets.find(f => f.id === merged.fleetId);
    const vehicleType = merged.vehicleType || fleet?.vehicleType || 'Engkel Long';
    const targetConfig = FUEL_TARGET_RATIOS[vehicleType] || { target: 7.5, minAcceptable: 6.4, label: '7.5 KM / L' };
    const targetRatio = targetConfig.target;

    const distanceKm = Math.max(0, merged.endOdometerKm - merged.startOdometerKm);
    const totalCost = Math.round(merged.liters * merged.costPerLiter);
    const ratioKmPerLiter = merged.liters > 0 ? Number((distanceKm / merged.liters).toFixed(2)) : 0;
    const literPerKm = distanceKm > 0 ? Number((merged.liters / distanceKm).toFixed(4)) : 0;
    const literPer100Km = distanceKm > 0 ? Number(((merged.liters / distanceKm) * 100).toFixed(2)) : 0;
    const costPerKm = distanceKm > 0 ? Math.round(totalCost / distanceKm) : 0;

    let efficiencyStatus: EfficiencyStatus = 'Efisien / Normal';
    if (ratioKmPerLiter >= targetRatio * 1.05) {
      efficiencyStatus = 'Sangat Efisien';
    } else if (ratioKmPerLiter >= targetRatio * 0.90) {
      efficiencyStatus = 'Efisien / Normal';
    } else if (ratioKmPerLiter >= targetRatio * 0.75) {
      efficiencyStatus = 'Boros';
    } else {
      efficiencyStatus = 'Kritis / Potensi Anomali';
    }

    const updatedLog: FuelLog = {
      ...merged,
      targetRatio,
      distanceKm,
      totalCost,
      ratioKmPerLiter,
      literPerKm,
      literPer100Km,
      costPerKm,
      efficiencyStatus
    };

    this.fuelLogs = this.fuelLogs.map(l => l.id === id ? updatedLog : l);
    this.saveToStorage(STORAGE_KEYS.FUEL_LOGS, this.fuelLogs);

    this.logActivity(
      'Edit Log Pengisian BBM',
      updatedLog.plateNumber,
      `Pembaruan catatan BBM ID: ${id}`
    );

    this.dispatchMiddleware({
      entityType: 'fuel',
      action: 'update',
      id,
      data: updatedLog,
      timestamp: new Date().toISOString()
    });

    this.notify();
  }

  public deleteFuelLog(id: string) {
    const item = this.fuelLogs.find(l => l.id === id);
    this.fuelLogs = this.fuelLogs.filter(l => l.id !== id);
    this.saveToStorage(STORAGE_KEYS.FUEL_LOGS, this.fuelLogs);

    if (item) {
      this.logActivity(
        'Hapus Log Pengisian BBM',
        item.plateNumber,
        `Catatan pengisian BBM ${item.liters} L pada tanggal ${item.date} dihapus`
      );

      this.dispatchMiddleware({
        entityType: 'fuel',
        action: 'delete',
        id,
        data: item,
        timestamp: new Date().toISOString()
      });
    }
    this.notify();
  }

  public getFleetFuelSummary(): FleetFuelSummary[] {
    return this.fleets.map(fleet => {
      const logs = this.fuelLogs.filter(l => l.fleetId === fleet.id);
      const totalLogs = logs.length;
      const totalLiters = logs.reduce((acc, l) => acc + l.liters, 0);
      const totalCost = logs.reduce((acc, l) => acc + l.totalCost, 0);
      const totalDistanceKm = logs.reduce((acc, l) => acc + l.distanceKm, 0);

      const targetConfig = FUEL_TARGET_RATIOS[fleet.vehicleType] || { target: 7.5, minAcceptable: 6.4, label: '7.5 KM / L' };
      const targetRatio = targetConfig.target;
      const avgKmPerLiter = totalLiters > 0 ? Number((totalDistanceKm / totalLiters).toFixed(2)) : targetRatio;
      
      // Rata-rata Konsumsi Liter per Kilometer
      const avgLiterPerKm = totalDistanceKm > 0 ? Number((totalLiters / totalDistanceKm).toFixed(4)) : (targetRatio > 0 ? Number((1 / targetRatio).toFixed(4)) : 0);
      const avgLiterPer100Km = totalDistanceKm > 0 ? Number(((totalLiters / totalDistanceKm) * 100).toFixed(2)) : (targetRatio > 0 ? Number((100 / targetRatio).toFixed(2)) : 0);
      const targetLiterPerKm = targetRatio > 0 ? Number((1 / targetRatio).toFixed(4)) : 0;
      const targetLiterPer100Km = targetRatio > 0 ? Number((100 / targetRatio).toFixed(2)) : 0;

      const avgCostPerKm = totalDistanceKm > 0 ? Math.round(totalCost / totalDistanceKm) : 0;
      const efficiencyScore = targetRatio > 0 ? Math.round((avgKmPerLiter / targetRatio) * 100) : 100;
      const anomaliesCount = logs.filter(l => l.efficiencyStatus === 'Boros' || l.efficiencyStatus === 'Kritis / Potensi Anomali').length;

      let status: EfficiencyStatus = 'Efisien / Normal';
      if (efficiencyScore >= 105) status = 'Sangat Efisien';
      else if (efficiencyScore >= 90) status = 'Efisien / Normal';
      else if (efficiencyScore >= 75) status = 'Boros';
      else status = 'Kritis / Potensi Anomali';

      return {
        fleetId: fleet.id,
        plateNumber: fleet.plateNumber,
        initialCode: fleet.initialCode,
        vehicleType: fleet.vehicleType,
        totalLogs,
        totalLiters,
        totalCost,
        totalDistanceKm,
        avgKmPerLiter,
        avgLiterPerKm,
        avgLiterPer100Km,
        targetRatio,
        targetLiterPerKm,
        targetLiterPer100Km,
        avgCostPerKm,
        efficiencyScore,
        status,
        anomaliesCount
      };
    });
  }

  public getDriverFuelScores(): DriverFuelScore[] {
    const driverMap = new Map<string, {
      driverId: string;
      driverName: string;
      logs: FuelLog[];
    }>();

    this.fuelLogs.forEach(log => {
      const key = log.driverName || 'Driver Tidak Terdaftar';
      if (!driverMap.has(key)) {
        driverMap.set(key, {
          driverId: log.driverId || key,
          driverName: key,
          logs: []
        });
      }
      driverMap.get(key)!.logs.push(log);
    });

    const scores: DriverFuelScore[] = Array.from(driverMap.values()).map(item => {
      const totalTrips = item.logs.length;
      const totalDistanceKm = item.logs.reduce((acc, l) => acc + l.distanceKm, 0);
      const totalLiters = item.logs.reduce((acc, l) => acc + l.liters, 0);
      const avgKmPerLiter = totalLiters > 0 ? Number((totalDistanceKm / totalLiters).toFixed(2)) : 0;

      const avgEfficiencyRatio = item.logs.reduce((acc, l) => acc + (l.ratioKmPerLiter / (l.targetRatio || 7.5)), 0) / (totalTrips || 1);
      const ecoDrivingScore = Math.min(100, Math.max(40, Math.round(avgEfficiencyRatio * 90)));

      let badge: 'Master Eco-Driver' | 'Driver Efisien' | 'Perlu Pembinaan' = 'Driver Efisien';
      let recommendation = 'Menjaga kecepatan stabil dan pola perpindahan gigi yang tepat.';

      if (ecoDrivingScore >= 90) {
        badge = 'Master Eco-Driver';
        recommendation = 'Pengemudi teladan dengan akselerasi halus, pengereman terencana, dan efisiensi BBM prima.';
      } else if (ecoDrivingScore < 75) {
        badge = 'Perlu Pembinaan';
        recommendation = 'Perlu evaluasi pola idling berlebih saat antre muat dan hindari akselerasi agresif di tanjakan.';
      }

      return {
        driverId: item.driverId,
        driverName: item.driverName,
        totalTrips,
        totalDistanceKm,
        totalLiters,
        avgKmPerLiter,
        ecoDrivingScore,
        ranking: 0,
        badge,
        recommendation
      };
    });

    scores.sort((a, b) => b.ecoDrivingScore - a.ecoDrivingScore);
    scores.forEach((s, idx) => {
      s.ranking = idx + 1;
    });

    return scores;
  }

  public getFuelKPISummary() {
    const totalLiters = this.fuelLogs.reduce((acc, l) => acc + l.liters, 0);
    const totalCost = this.fuelLogs.reduce((acc, l) => acc + l.totalCost, 0);
    const totalDistanceKm = this.fuelLogs.reduce((acc, l) => acc + l.distanceKm, 0);
    const overallAvgKmPerLiter = totalLiters > 0 ? Number((totalDistanceKm / totalLiters).toFixed(2)) : 0;
    const overallAvgLiterPerKm = totalDistanceKm > 0 ? Number((totalLiters / totalDistanceKm).toFixed(4)) : 0;
    const overallAvgLiterPer100Km = totalDistanceKm > 0 ? Number(((totalLiters / totalDistanceKm) * 100).toFixed(2)) : 0;
    const overallAvgCostPerKm = totalDistanceKm > 0 ? Math.round(totalCost / totalDistanceKm) : 0;
    const totalAnomalies = this.fuelLogs.filter(l => l.efficiencyStatus === 'Boros' || l.efficiencyStatus === 'Kritis / Potensi Anomali').length;

    const fleetSummaries = this.getFleetFuelSummary();
    const sortedFleets = [...fleetSummaries].sort((a, b) => b.efficiencyScore - a.efficiencyScore);
    const topFleet = sortedFleets[0];
    const leastFleet = sortedFleets[sortedFleets.length - 1];

    const driverScores = this.getDriverFuelScores();
    const topDriver = driverScores[0];

    return {
      totalLiters,
      totalCost,
      totalDistanceKm,
      overallAvgKmPerLiter,
      overallAvgLiterPerKm,
      overallAvgLiterPer100Km,
      overallAvgCostPerKm,
      totalAnomalies,
      topFleet,
      leastFleet,
      topDriver,
      totalRecords: this.fuelLogs.length
    };
  }

  // Swap Shift Methods
  private swapShiftRequests: SwapShiftRequest[] = [];

  public getSwapShiftRequests(): SwapShiftRequest[] {
    return [...this.swapShiftRequests];
  }

  public submitSwapShiftRequest(req: Omit<SwapShiftRequest, 'id' | 'status' | 'requestedAt'>): SwapShiftRequest {
    const newReq: SwapShiftRequest = {
      ...req,
      id: 'swp-' + Math.random().toString(36).substring(2, 9),
      status: 'pending',
      requestedAt: new Date().toISOString()
    };
    this.swapShiftRequests = [newReq, ...this.swapShiftRequests];
    // Normally save to storage here if persistent
    this.notify();
    return newReq;
  }

  // ==========================================
  // TIRE WEAR PREDICTION (PREDIKSI KEAUSAN BAN)
  // Berdasarkan total jarak tempuh harian armada dari Tracksolid
  // ==========================================
  public getFleetTireWearPredictions(): FleetTireWearPrediction[] {
    const devices = this.getDevices();
    const tireUsages = this.sparePartUsages.filter(u => u.category === 'ban');
    const now = new Date();

    return this.fleets.map(fleet => {
      // Find matching Tracksolid GPS device
      const matchedDevice = devices.find(d =>
        d.vehiclePlate.toLowerCase().replace(/\s+/g, '') === fleet.plateNumber.toLowerCase().replace(/\s+/g, '') ||
        (fleet.gpsImei && d.imei === fleet.gpsImei) ||
        (fleet.initialCode && d.vehicleName && d.vehicleName.toLowerCase().includes(fleet.initialCode.toLowerCase().split('/')[0].trim()))
      );

      // Total daily mileage from Tracksolid (todayMileageKm)
      // If Tracksolid has 0 or unavailable, fall back to realistic daily route average
      const dailyMileage = matchedDevice?.todayMileageKm && matchedDevice.todayMileageKm > 0
        ? matchedDevice.todayMileageKm
        : fleet.status === 'on-duty' ? 88.5 : fleet.status === 'available' ? 42.0 : 0;

      // Find latest tire change record from spare parts usage
      const latestUsage = tireUsages
        .filter(u => u.fleetId === fleet.id || u.plateNumber.toLowerCase().replace(/\s+/g, '') === fleet.plateNumber.toLowerCase().replace(/\s+/g, ''))
        .sort((a, b) => new Date(b.replacementDate).getTime() - new Date(a.replacementDate).getTime())[0];

      // Fleet specific parameters
      const isPickUp = fleet.vehicleType === 'Pick Up Box';
      const isDouble = fleet.vehicleType === 'Double STD';
      const isEngkel = fleet.vehicleType === 'Engkel STD' || fleet.vehicleType === 'Engkel Long';

      const initialTreadDepthMm = isPickUp ? 10.0 : isDouble ? 15.0 : 13.0; // Ketebalan tapak ban baru
      const minTreadDepthLegalMm = 2.0; // Batas minimal alur ban aman (legal limit 1.6mm - safety limit 2.0mm)
      const usableTreadDepthMm = initialTreadDepthMm - minTreadDepthLegalMm;

      // Tire brand & model
      const tireBrandModel = isPickUp 
        ? 'Bridgestone Ecopia R156 8PR' 
        : isDouble 
        ? 'Gajah Tunggal Super Lug Heavy Duty' 
        : 'Michelin X Multi Z Radial';

      const tireSize = isPickUp 
        ? '185/80 R14' 
        : isDouble 
        ? '7.50-16 14PR' 
        : '7.50-16 12PR';

      const maxLifespanKm = isPickUp ? 45000 : isDouble ? 60000 : 55000;
      const currentOdo = fleet.odometerKm || 50000;
      
      // Determine installed kilometer
      const installedAtKm = latestUsage ? latestUsage.odometerKm : Math.max(0, currentOdo - (currentOdo % maxLifespanKm));
      const accumulatedKm = Math.max(1200, currentOdo - installedAtKm);
      const remainingKm = Math.max(0, maxLifespanKm - accumulatedKm);
      
      // Calculate wear percentage (0% to 100%)
      const wearPercentage = Math.min(100, Number(((accumulatedKm / maxLifespanKm) * 100).toFixed(1)));
      const healthScore = Math.max(0, Number((100 - wearPercentage).toFixed(1)));

      // Current tread depth based on accumulated mileage
      const treadConsumedMm = (accumulatedKm / maxLifespanKm) * usableTreadDepthMm;
      const currentTreadDepthMm = Math.max(minTreadDepthLegalMm, Number((initialTreadDepthMm - treadConsumedMm).toFixed(2)));

      // Daily wear rate (mm per day) based on Tracksolid daily mileage
      // Formula: (usableTreadDepthMm / maxLifespanKm) * dailyMileage
      const dailyWearRateMm = dailyMileage > 0 
        ? Number(((usableTreadDepthMm / maxLifespanKm) * dailyMileage).toFixed(4)) 
        : 0.005;

      // Estimated days remaining until replacement
      const effectiveDailyKm = Math.max(dailyMileage, 35);
      const estimatedDaysRemaining = remainingKm > 0 
        ? Math.round(remainingKm / effectiveDailyKm) 
        : 0;

      // Projected replacement date
      const projectedDate = new Date(now.getTime() + estimatedDaysRemaining * 24 * 60 * 60 * 1000);
      const projectedReplacementDate = projectedDate.toISOString().substring(0, 10);

      // Rotation due every 10,000 km
      const rotationIntervalKm = 10000;
      const rotationDueKm = installedAtKm + (Math.floor(accumulatedKm / rotationIntervalKm) + 1) * rotationIntervalKm;
      const isRotationNeeded = (accumulatedKm % rotationIntervalKm) >= 8500;

      // Tire status logic
      let status: 'Optimal' | 'Waspada' | 'Kritis' = 'Optimal';
      let statusLabel = 'Kondisi Prima';
      let recommendation = 'Tekanan angin stabil, lanjutkan pemantauan harian.';

      if (remainingKm <= 3500 || currentTreadDepthMm <= 3.0 || wearPercentage >= 85) {
        status = 'Kritis';
        statusLabel = 'Wajib Ganti Segera';
        recommendation = `Alur tapak ban menipis (${currentTreadDepthMm} mm). Segera jadwalkan penggantian ban baru di gudang sparepart sebelum muatan berat.`;
      } else if (remainingKm <= 9000 || currentTreadDepthMm <= 5.0 || wearPercentage >= 65) {
        status = 'Waspada';
        statusLabel = 'Perlu Rotasi & Jadwal Ganti';
        recommendation = isRotationNeeded 
          ? `Disarankan rotasi ban silang (depan-belakang) pada ${rotationDueKm.toLocaleString('id-ID')} KM untuk mencegah aus tidak merata.`
          : `Ban masuk fase aus moderat. Pantau tekanan angin mingguan dan batasi beban overload.`;
      } else {
        status = 'Optimal';
        statusLabel = 'Kondisi Prima';
        recommendation = `Ban dalam performa terbaik (${healthScore}% health). Rekomendasi rotasi berikutnya pada ${rotationDueKm.toLocaleString('id-ID')} KM.`;
      }

      // Pressure (PSI)
      const recommendedPressurePsi = isPickUp ? 45 : isDouble ? 95 : 85;
      const pressureOffset = status === 'Kritis' ? -8 : status === 'Waspada' ? -4 : 0;
      const pressurePsi = recommendedPressurePsi + pressureOffset;

      return {
        fleetId: fleet.id,
        plateNumber: fleet.plateNumber,
        initialCode: fleet.initialCode,
        vehicleType: fleet.vehicleType,
        brand: fleet.brand || 'Mitsubishi',
        currentOdometerKm: currentOdo,
        todayMileageKm: Number(dailyMileage.toFixed(2)),
        trackedImei: matchedDevice?.imei,
        isGpsOnline: matchedDevice ? (matchedDevice.status === 'Online' || matchedDevice.status === 'Sleeping') : false,
        tireBrandModel,
        tireSize,
        initialTreadDepthMm,
        currentTreadDepthMm,
        minTreadDepthLegalMm,
        installedAtKm,
        accumulatedKm,
        maxLifespanKm,
        remainingKm,
        wearPercentage,
        healthScore,
        dailyWearRateMm,
        estimatedDaysRemaining,
        projectedReplacementDate,
        status,
        statusLabel,
        recommendation,
        rotationDueKm,
        isRotationNeeded,
        pressurePsi,
        recommendedPressurePsi
      };
    });
  }

  // ==========================================
  // DOCUMENT SCANNING & SEARCHABLE LOGS
  // ==========================================
  public getScannedDocuments(): ScannedDocumentLog[] {
    return [...this.scannedDocuments];
  }

  public addScannedDocument(doc: Omit<ScannedDocumentLog, 'id' | 'timestamp'>): ScannedDocumentLog {
    const newDoc: ScannedDocumentLog = {
      ...doc,
      id: `DOC-SCAN-${Date.now()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`,
      timestamp: new Date().toISOString()
    };
    this.scannedDocuments = [newDoc, ...this.scannedDocuments];
    this.saveToStorage(STORAGE_KEYS.SCANNED_DOCUMENTS, this.scannedDocuments);
    this.logActivity(
      'Scan Dokumen',
      newDoc.documentNumber,
      `Dokumen digital dipindai & diarsipkan: ${newDoc.documentTypeLabel} (${newDoc.documentNumber})`
    );
    this.notify();
    return newDoc;
  }

  public updateScannedDocument(id: string, updates: Partial<ScannedDocumentLog>): void {
    this.scannedDocuments = this.scannedDocuments.map(d => d.id === id ? { ...d, ...updates } : d);
    this.saveToStorage(STORAGE_KEYS.SCANNED_DOCUMENTS, this.scannedDocuments);
    this.notify();
  }

  public deleteScannedDocument(id: string): void {
    this.scannedDocuments = this.scannedDocuments.filter(d => d.id !== id);
    this.saveToStorage(STORAGE_KEYS.SCANNED_DOCUMENTS, this.scannedDocuments);
    this.notify();
  }
}

export const logisticsStore = new LogisticsStore();
