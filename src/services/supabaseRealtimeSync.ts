import { Schedule, ShipmentStatus } from '../types';

/**
 * Hostinger MySQL Live Synchronization & Driver Push Notification Service
 * --------------------------------------------------------------------
 * Uses lightweight polling against the Hostinger MySQL-backed API plus same-device custom events.
 * Enforces strict driver-level filtering so each driver only receives push
 * notifications and real-time updates for schedules assigned specifically to them.
 */

export interface DriverRealtimeNotificationPayload {
  id: string;
  eventType: 'INSERT' | 'UPDATE';
  notificationCategory: 'new_assignment' | 'schedule_updated' | 'status_changed';
  scheduleId: string;
  trackingNumber: string;
  crewId: string;
  crewName?: string;
  crewHelperId?: string;
  crewHelperName?: string;
  crewHelper2Id?: string;
  crewHelper2Name?: string;
  storeName: string;
  areaName?: string;
  plateNumber?: string;
  departureDate?: string;
  status: ShipmentStatus | string;
  previousStatus?: ShipmentStatus | string;
  title: string;
  message: string;
  urgent: boolean;
  timestamp: string;
  changedFields?: string[];
}

export interface DriverSubscriptionConfig {
  driverId: string;
  driverName?: string;
  onNotification: (notification: DriverRealtimeNotificationPayload, rawSchedule?: any) => void;
  onScheduleSync?: () => void;
}

export interface AdminStatusNotification {
  id: string;
  scheduleId: string;
  trackingNumber: string;
  storeName: string;
  areaName: string;
  fleetPlate: string;
  fleetInitialCode?: string;
  vehicleType?: string;
  driverName: string;
  helperName?: string;
  oldStatus?: ShipmentStatus | string;
  newStatus: ShipmentStatus | string;
  statusLabel: string;
  title: string;
  message: string;
  urgent: boolean;
  timestamp: string;
  isRead: boolean;
  notes?: string;
  source: 'supabase_realtime' | 'local_sync' | 'simulation';
}

const ADMIN_STATUS_STORAGE_KEY = 'akk_admin_status_notifications_v1';

const INITIAL_ADMIN_STATUS_NOTIFICATIONS: AdminStatusNotification[] = [];

export function getAdminStatusNotifications(): AdminStatusNotification[] {
  try {
    const raw = localStorage.getItem(ADMIN_STATUS_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch {}
  return [...INITIAL_ADMIN_STATUS_NOTIFICATIONS];
}

export function saveAdminStatusNotifications(notifs: AdminStatusNotification[]): void {
  try {
    localStorage.setItem(ADMIN_STATUS_STORAGE_KEY, JSON.stringify(notifs.slice(0, 50)));
  } catch {}
}

const adminStatusListeners: Array<(notif: AdminStatusNotification) => void> = [];

export function subscribeAdminStatusNotifications(callback: (notif: AdminStatusNotification) => void): () => void {
  if (!adminStatusListeners.includes(callback)) {
    adminStatusListeners.push(callback);
  }
  return () => {
    const idx = adminStatusListeners.indexOf(callback);
    if (idx !== -1) adminStatusListeners.splice(idx, 1);
  };
}

export function markAdminStatusNotificationRead(id: string): void {
  const current = getAdminStatusNotifications();
  const updated = current.map(n => (n.id === id ? { ...n, isRead: true } : n));
  saveAdminStatusNotifications(updated);
  window.dispatchEvent(new CustomEvent('akk-admin-status-updated', { detail: { notifs: updated } }));
}

export function markAllAdminStatusNotificationsRead(): void {
  const current = getAdminStatusNotifications();
  const updated = current.map(n => ({ ...n, isRead: true }));
  saveAdminStatusNotifications(updated);
  window.dispatchEvent(new CustomEvent('akk-admin-status-updated', { detail: { notifs: updated } }));
}

export function clearAdminStatusNotifications(): void {
  saveAdminStatusNotifications([]);
  window.dispatchEvent(new CustomEvent('akk-admin-status-updated', { detail: { notifs: [] } }));
}

let realtimeChannel: any = null;
let isSubscribed = false;
const listeners: Array<(event: { table: string; eventType: string; payload: any }) => void> = [];
const driverSubscribers = new Map<string, DriverSubscriptionConfig>();
const driverFilteredChannels = new Map<string, any>();
const recentEventSignatures = new Map<string, number>();

export const STATUS_LABELS: Record<string, string> = {
  scheduled: 'Terjadwal',
  picked_up: 'Telah Dimuat (Picked Up)',
  in_transit: 'Dalam Perjalanan (In Transit)',
  delivered: 'Terkirim (Delivered)',
  delayed: 'Tertunda (Delayed)'
};

function normalizeIdentifier(val?: string | null): string {
  return (val || '').trim().toLowerCase();
}

/**
 * Checks whether a schedule record (from Supabase DB row or client Schedule object)
 * is assigned to the specified driver (either as primary Driver or Helper 1/2).
 */
export function isScheduleAssignedToDriver(
  schedule: Partial<Schedule> & Record<string, any>,
  targetDriverId?: string,
  targetDriverName?: string
): boolean {
  if (!schedule) return false;

  const cleanTargetId = normalizeIdentifier(targetDriverId);
  const cleanTargetName = normalizeIdentifier(targetDriverName);

  if (!cleanTargetId && !cleanTargetName) return false;

  const rowCrewId = normalizeIdentifier(schedule.crewId || schedule.crew_id || schedule.crew?.id);
  const rowHelper1Id = normalizeIdentifier(schedule.crewHelperId || schedule.crew_helper_id || schedule.crewHelper?.id);
  const rowHelper2Id = normalizeIdentifier(schedule.crewHelper2Id || schedule.crew_helper2_id || schedule.crewHelper2?.id);

  // 1. Exact ID match (including usr- / crw- prefix normalization)
  if (cleanTargetId) {
    const strippedTargetId = cleanTargetId.replace(/^(usr-|crw-)/, '');
    const candidateIds = [rowCrewId, rowHelper1Id, rowHelper2Id].filter(Boolean);
    for (const cid of candidateIds) {
      const strippedCid = cid.replace(/^(usr-|crw-)/, '');
      if (cid === cleanTargetId || (strippedTargetId.length >= 3 && strippedCid === strippedTargetId)) {
        return true;
      }
    }
  }

  // 2. Driver / Helper Name match
  if (cleanTargetName && cleanTargetName.length >= 3) {
    const rowCrewName = normalizeIdentifier(schedule.crew?.name || schedule.crewName || schedule.crew_name);
    const rowHelper1Name = normalizeIdentifier(schedule.crewHelper?.name || schedule.crewHelperName || schedule.crew_helper_name);
    const rowHelper2Name = normalizeIdentifier(schedule.crewHelper2?.name || schedule.crewHelper2Name || schedule.crew_helper2_name);

    const candidateNames = [rowCrewName, rowHelper1Name, rowHelper2Name].filter(Boolean);
    for (const cname of candidateNames) {
      if (cname === cleanTargetName || cname.includes(cleanTargetName) || cleanTargetName.includes(cname)) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Deduplicate rapid identical realtime events (e.g. broadcast + postgres_changes)
 */
function isDuplicateEvent(signature: string): boolean {
  const now = Date.now();
  const prev = recentEventSignatures.get(signature);
  if (prev && now - prev < 3500) {
    return true;
  }
  recentEventSignatures.set(signature, now);
  if (recentEventSignatures.size > 200) {
    const cutoff = now - 10000;
    for (const [k, ts] of recentEventSignatures.entries()) {
      if (ts < cutoff) recentEventSignatures.delete(k);
    }
  }
  return false;
}

/**
 * Triggers native Browser Push Notification & Haptic Vibration if supported
 */
export function triggerNativeDriverPush(notif: DriverRealtimeNotificationPayload): void {
  try {
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate(notif.urgent ? [250, 100, 250, 100, 300] : [180, 80, 180]);
    }
  } catch {}

  try {
    if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
      new Notification(notif.title, {
        body: notif.message,
        tag: notif.id,
        requireInteraction: notif.urgent
      });
    }
  } catch {}
}

/**
 * Builds a structured DriverRealtimeNotificationPayload from a schedule INSERT or UPDATE event
 */
export function buildDriverNotificationPayload(
  eventType: 'INSERT' | 'UPDATE',
  newSchedule: Partial<Schedule> & Record<string, any>,
  oldSchedule?: (Partial<Schedule> & Record<string, any>) | null
): DriverRealtimeNotificationPayload {
  const scheduleId = String(newSchedule.id || oldSchedule?.id || `sch-${Date.now()}`);
  const trackingNumber = String(newSchedule.trackingNumber || newSchedule.tracking_number || oldSchedule?.trackingNumber || 'TRK-AKK');
  const crewId = String(newSchedule.crewId || newSchedule.crew_id || newSchedule.crew?.id || '');
  const crewName = String(newSchedule.crew?.name || newSchedule.crewName || newSchedule.crew_name || '');
  const crewHelperId = String(newSchedule.crewHelperId || newSchedule.crew_helper_id || newSchedule.crewHelper?.id || '');
  const crewHelperName = String(newSchedule.crewHelper?.name || newSchedule.crewHelperName || '');
  const crewHelper2Id = String(newSchedule.crewHelper2Id || newSchedule.crew_helper2_id || newSchedule.crewHelper2?.id || '');
  const crewHelper2Name = String(newSchedule.crewHelper2?.name || newSchedule.crewHelper2Name || '');

  const storeName = String(
    newSchedule.store?.storeName ||
      newSchedule.areaName ||
      newSchedule.area_name ||
      newSchedule.origin_name ||
      'Toko / Area Tujuan'
  );
  const areaName = String(newSchedule.areaName || newSchedule.area_name || storeName);
  const plateNumber = String(newSchedule.fleet?.plateNumber || newSchedule.plateNumber || newSchedule.fleet_id || 'Armada AKK');
  const departureDate = String(newSchedule.departureDate || newSchedule.departure_date || '');
  const status = String(newSchedule.status || 'scheduled');
  const previousStatus = oldSchedule ? String(oldSchedule.status || '') : undefined;

  const depFormatted = departureDate
    ? new Date(departureDate).toLocaleString('id-ID', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })
    : 'Sesuai Jadwal';

  const oldCrewId = oldSchedule ? String(oldSchedule.crewId || oldSchedule.crew_id || oldSchedule.crew?.id || '') : '';
  const isReassignedToNewDriver = Boolean(eventType === 'UPDATE' && oldCrewId && crewId && oldCrewId !== crewId);

  if (eventType === 'INSERT' || isReassignedToNewDriver) {
    return {
      id: `rt-notif-${scheduleId}-${Date.now()}`,
      eventType: 'INSERT',
      notificationCategory: 'new_assignment',
      scheduleId,
      trackingNumber,
      crewId,
      crewName,
      crewHelperId,
      crewHelperName,
      crewHelper2Id,
      crewHelper2Name,
      storeName,
      areaName,
      plateNumber,
      departureDate,
      status,
      previousStatus,
      title: '📦 Penugasan Jadwal Pengiriman Baru',
      message: `Anda menerima tugas pengiriman baru ${trackingNumber} tujuan ${storeName} menggunakan armada ${plateNumber}. Waktu berangkat: ${depFormatted}.`,
      urgent: Boolean(newSchedule.isInterIsland || newSchedule.isUrgentOverride),
      timestamp: new Date().toISOString(),
      changedFields: ['assignment']
    };
  }

  // Determine what changed on an ongoing schedule
  const changedFields: string[] = [];
  const changeDescriptions: string[] = [];

  if (oldSchedule) {
    if (previousStatus && previousStatus !== status) {
      changedFields.push('status');
      changeDescriptions.push(`Status: ${STATUS_LABELS[previousStatus] || previousStatus} → ${STATUS_LABELS[status] || status}`);
    }
    const oldDep = String(oldSchedule.departureDate || oldSchedule.departure_date || '');
    if (oldDep && departureDate && oldDep.slice(0, 16) !== departureDate.slice(0, 16)) {
      changedFields.push('departureDate');
      changeDescriptions.push(`Jadwal berangkat: ${depFormatted}`);
    }
    const oldFleet = String(oldSchedule.fleet?.plateNumber || oldSchedule.fleetId || oldSchedule.fleet_id || '');
    const newFleet = String(newSchedule.fleet?.plateNumber || newSchedule.fleetId || newSchedule.fleet_id || '');
    if (oldFleet && newFleet && oldFleet !== newFleet) {
      changedFields.push('fleet');
      changeDescriptions.push(`Armada: ${plateNumber}`);
    }
    const oldStore = String(oldSchedule.store?.storeName || oldSchedule.areaName || oldSchedule.storeId || '');
    const newStore = String(newSchedule.store?.storeName || newSchedule.areaName || newSchedule.storeId || '');
    if (oldStore && newStore && oldStore !== newStore) {
      changedFields.push('destination');
      changeDescriptions.push(`Tujuan: ${storeName}`);
    }
    const oldNotes = String(oldSchedule.notes || '').trim();
    const newNotes = String(newSchedule.notes || '').trim();
    if (newNotes && oldNotes !== newNotes) {
      changedFields.push('notes');
      changeDescriptions.push(`Catatan: "${newNotes}"`);
    }
  }

  const isStatusChangeOnly = changedFields.length === 1 && changedFields[0] === 'status';
  const summaryText =
    changeDescriptions.length > 0
      ? changeDescriptions.join(' • ')
      : `Status jadwal ${trackingNumber} menuju ${storeName} kini: ${STATUS_LABELS[status] || status}.`;

  const isUrgent = status === 'delayed' || Boolean(newSchedule.isUrgentOverride);

  return {
    id: `rt-notif-${scheduleId}-${Date.now()}`,
    eventType: 'UPDATE',
    notificationCategory: isStatusChangeOnly ? 'status_changed' : 'schedule_updated',
    scheduleId,
    trackingNumber,
    crewId,
    crewName,
    crewHelperId,
    crewHelperName,
    crewHelper2Id,
    crewHelper2Name,
    storeName,
    areaName,
    plateNumber,
    departureDate,
    status,
    previousStatus,
    title:
      status === 'delayed'
        ? '⚠️ Peringatan Jadwal Pengiriman Tertunda'
        : isStatusChangeOnly
        ? '🚚 Pembaruan Status Jadwal Berjalan'
        : '🔄 Perubahan Jadwal Pengiriman Berjalan',
    message: `Jadwal ${trackingNumber} (${storeName}): ${summaryText}`,
    urgent: isUrgent,
    timestamp: new Date().toISOString(),
    changedFields
  };
}

function dispatchToMatchingDrivers(
  eventType: 'INSERT' | 'UPDATE',
  newRow: any,
  oldRow?: any,
  prebuiltNotif?: DriverRealtimeNotificationPayload
) {
  if (!newRow) return;

  const notif = prebuiltNotif || buildDriverNotificationPayload(eventType, newRow, oldRow);
  const sig = `${notif.eventType}:${notif.scheduleId}:${notif.status}:${notif.departureDate || ''}:${(notif.changedFields || []).join(',')}`;
  if (isDuplicateEvent(sig)) return;

  // Simpan notifikasi perubahan jadwal agar tampil di menu Laporan Kiriman Kru
  try {
    const raw = localStorage.getItem('akk_schedule_change_notifs_v1');
    const prevList: DriverRealtimeNotificationPayload[] = raw ? JSON.parse(raw) : [];
    const nextList = [notif, ...prevList.filter(item => item.id !== notif.id)].slice(0, 30);
    localStorage.setItem('akk_schedule_change_notifs_v1', JSON.stringify(nextList));
    window.dispatchEvent(
      new CustomEvent('akk-driver-schedule-realtime', {
        detail: { eventType, schedule: newRow, previousSchedule: oldRow, notification: notif }
      })
    );
  } catch {}

  driverSubscribers.forEach((sub) => {
    const isMatched = isScheduleAssignedToDriver(newRow, sub.driverId, sub.driverName);
    if (isMatched) {
      try {
        sub.onNotification(notif, newRow);
        sub.onScheduleSync?.();
      } catch (err) {
        console.error('[SupabaseRealtime] Error in driver notification callback:', err);
      }
    }
  });
}

/**
 * Dispatches real-time status change notification to SPV Logistik & Super Admin
 */
export function dispatchToAdminLogistics(
  newRow: any,
  oldRow?: any,
  source: 'supabase_realtime' | 'local_sync' | 'simulation' = 'supabase_realtime'
): AdminStatusNotification | null {
  if (!newRow) return null;
  const newStatus = String(newRow.status || 'scheduled');
  const oldStatus = oldRow ? String(oldRow.status || '') : undefined;

  // In postgres_changes, if old status is provided and is identical, ignore
  if (oldStatus && oldStatus === newStatus && source === 'supabase_realtime') {
    return null;
  }

  const scheduleId = String(newRow.id || `sch-${Date.now()}`);
  const trackingNumber = String(
    newRow.trackingNumber || newRow.tracking_number || `PO-AKK-${Date.now().toString().slice(-6)}`
  );
  const storeName = String(
    newRow.store?.storeName ||
      newRow.store_name ||
      newRow.areaName ||
      newRow.area_name ||
      'Area Distribusi'
  );
  const areaName = String(newRow.areaName || newRow.area_name || storeName);
  const fleetPlate = String(
    newRow.fleet?.plateNumber || newRow.plateNumber || newRow.plate_number || 'Armada AKK'
  );
  const fleetInitialCode = String(
    newRow.fleet?.initialCode || newRow.initialCode || newRow.initial_code || ''
  );
  const vehicleType = String(
    newRow.fleet?.vehicleType || newRow.vehicleType || newRow.vehicle_type || 'Truk Box'
  );
  const driverName = String(
    newRow.crew?.name || newRow.crewName || newRow.crew_name || newRow.driver || 'Driver AKK'
  );
  const helperName = String(
    newRow.crewHelper?.name || newRow.crewHelperName || newRow.helper || ''
  );
  const notes = String(newRow.notes || '');

  const oldLabel = oldStatus ? (STATUS_LABELS[oldStatus] || oldStatus) : undefined;
  const newLabel = STATUS_LABELS[newStatus] || newStatus;

  const urgent = newStatus === 'delayed' || Boolean(newRow.isUrgentOverride);

  let title = `🚚 Perubahan Status: ${newLabel}`;
  if (newStatus === 'in_transit') {
    title = `🚛 Armada Berangkat (In Transit): ${areaName}`;
  } else if (newStatus === 'delivered') {
    title = `✅ Pengiriman Berhasil (Delivered): ${storeName}`;
  } else if (newStatus === 'picked_up') {
    title = `📦 Muatan Dimuat (Picked Up): ${fleetPlate}`;
  } else if (newStatus === 'delayed') {
    title = `⚠️ Kendala Pengiriman (Delayed): ${areaName}`;
  }

  const message =
    oldLabel && oldLabel !== newLabel
      ? `Jadwal ${trackingNumber} (${storeName}) berganti status: "${oldLabel}" ➔ "${newLabel}". Driver: ${driverName} • Armada: ${fleetPlate}${fleetInitialCode ? ` (${fleetInitialCode})` : ''}.`
      : `Jadwal ${trackingNumber} (${storeName}) kini berstatus "${newLabel}". Driver: ${driverName} • Armada: ${fleetPlate}.`;

  const notif: AdminStatusNotification = {
    id: `asn-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    scheduleId,
    trackingNumber,
    storeName,
    areaName,
    fleetPlate,
    fleetInitialCode,
    vehicleType,
    driverName,
    helperName,
    oldStatus,
    newStatus,
    statusLabel: newLabel,
    title,
    message,
    urgent,
    timestamp: new Date().toISOString(),
    isRead: false,
    notes,
    source
  };

  const prev = getAdminStatusNotifications();
  const next = [notif, ...prev.filter(item => item.id !== notif.id)].slice(0, 50);
  saveAdminStatusNotifications(next);

  // Notify registered callbacks
  adminStatusListeners.forEach((cb) => {
    try {
      cb(notif);
    } catch (e) {
      console.error(e);
    }
  });

  // Emit window events for DashboardOverview & RealtimeShipmentListener
  try {
    window.dispatchEvent(
      new CustomEvent('akk-admin-status-notification', { detail: notif })
    );
    window.dispatchEvent(
      new CustomEvent('akk-admin-status-updated', { detail: { notifs: next } })
    );
  } catch {}

  return notif;
}

let hostingerPollTimer: ReturnType<typeof setInterval> | null = null;
let lastHostingerSchedules = new Map<string, any>();
let pollInitialized = false;

function scheduleSignature(schedule: any): string {
  return JSON.stringify({
    id: schedule?.id,
    status: schedule?.status,
    crewId: schedule?.crewId || schedule?.crew_id,
    crewHelperId: schedule?.crewHelperId || schedule?.crew_helper_id,
    crewHelper2Id: schedule?.crewHelper2Id || schedule?.crew_helper2_id,
    fleetId: schedule?.fleetId || schedule?.fleet_id,
    storeId: schedule?.storeId || schedule?.store_id,
    departureDate: schedule?.departureDate || schedule?.departure_date,
    estimatedArrival: schedule?.estimatedArrival || schedule?.estimated_arrival,
    actualArrival: schedule?.actualArrival || schedule?.actual_arrival,
    notes: schedule?.notes,
    areaName: schedule?.areaName || schedule?.area_name,
    trackingNumber: schedule?.trackingNumber || schedule?.tracking_number
  });
}

async function pollHostingerSchedules(): Promise<void> {
  if (typeof fetch === 'undefined') return;
  try {
    const response = await fetch('/api/schedules/persisted', { cache: 'no-store' });
    if (!response.ok) return;
    const payload = await response.json();
    const schedules = Array.isArray(payload?.schedules) ? payload.schedules : [];
    const nextMap = new Map<string, any>();
    schedules.forEach((schedule: any) => {
      if (schedule?.id) nextMap.set(String(schedule.id), schedule);
    });

    if (!pollInitialized) {
      lastHostingerSchedules = nextMap;
      pollInitialized = true;
      triggerStoreSync();
      return;
    }

    nextMap.forEach((schedule, id) => {
      const previous = lastHostingerSchedules.get(id);
      if (!previous) {
        notifyListeners('schedules', 'INSERT', schedule);
        dispatchToMatchingDrivers('INSERT', schedule, null);
      } else if (scheduleSignature(previous) !== scheduleSignature(schedule)) {
        notifyListeners('schedules', 'UPDATE', schedule);
        dispatchToMatchingDrivers('UPDATE', schedule, previous);
        dispatchToAdminLogistics(schedule, previous, 'local_sync');
      }
    });

    lastHostingerSchedules.forEach((previous, id) => {
      if (!nextMap.has(id)) notifyListeners('schedules', 'DELETE', previous);
    });

    lastHostingerSchedules = nextMap;
    triggerStoreSync();
  } catch (err) {
    console.warn('[HostingerLive] Schedule polling skipped:', err);
  }
}

function ensureHostingerPolling(): void {
  if (hostingerPollTimer || typeof window === 'undefined') return;
  void pollHostingerSchedules();
  hostingerPollTimer = setInterval(() => void pollHostingerSchedules(), 15000);
  isSubscribed = true;
}

export const supabaseRealtimeSync = {
  /** Legacy object name retained so existing UI imports stay compatible. */
  subscribe(onDataChanged?: (event: { table: string; eventType: string; payload: any }) => void): void {
    if (onDataChanged && !listeners.includes(onDataChanged)) listeners.push(onDataChanged);
    ensureHostingerPolling();
  },

  subscribeForDriver(config: DriverSubscriptionConfig): () => void {
    const key = `${normalizeIdentifier(config.driverId)}:${normalizeIdentifier(config.driverName)}` || `driver-${Date.now()}`;
    driverSubscribers.set(key, config);
    ensureHostingerPolling();
    return () => {
      driverSubscribers.delete(key);
    };
  },

  async publishScheduleChange(
    eventType: 'INSERT' | 'UPDATE',
    schedule: Partial<Schedule> & Record<string, any>,
    previousSchedule?: (Partial<Schedule> & Record<string, any>) | null
  ): Promise<DriverRealtimeNotificationPayload | null> {
    if (!schedule) return null;
    const notif = buildDriverNotificationPayload(eventType, schedule, previousSchedule || null);
    notifyListeners('schedules', eventType, schedule);
    dispatchToMatchingDrivers(eventType, schedule, previousSchedule || null, notif);

    try {
      window.dispatchEvent(new CustomEvent('akk-driver-schedule-realtime', {
        detail: { eventType, schedule, previousSchedule, notification: notif }
      }));
    } catch {}

    if (eventType === 'UPDATE' && previousSchedule && previousSchedule.status !== schedule.status) {
      dispatchToAdminLogistics(schedule, previousSchedule, 'local_sync');
    }
    triggerStoreSync();
    return notif;
  },

  async publishScheduleStatusChange(
    schedule: Partial<Schedule> & Record<string, any>,
    oldStatus?: ShipmentStatus | string,
    extraNotes?: string
  ): Promise<AdminStatusNotification | null> {
    if (!schedule) return null;
    const previousSchedule = { ...schedule, status: oldStatus || schedule.status };
    const scheduleWithNotes = { ...schedule, notes: extraNotes ?? schedule.notes };
    const notif = dispatchToAdminLogistics(scheduleWithNotes, previousSchedule, 'local_sync');

    try {
      if (schedule.id) {
        await fetch(`/api/schedules/${encodeURIComponent(String(schedule.id))}/status`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            status: schedule.status,
            notes: extraNotes ?? schedule.notes,
            trackingNumber: schedule.trackingNumber || schedule.tracking_number,
            actualArrival: schedule.status === 'delivered' ? new Date().toISOString() : schedule.actualArrival
          })
        });
      }
    } catch (err) {
      console.warn('[HostingerLive] Status persistence skipped:', err);
    }

    triggerStoreSync();
    return notif;
  },

  unsubscribe(): void {
    if (hostingerPollTimer) clearInterval(hostingerPollTimer);
    hostingerPollTimer = null;
    isSubscribed = false;
    pollInitialized = false;
    lastHostingerSchedules = new Map();
  },

  addListener(callback: (event: { table: string; eventType: string; payload: any }) => void): () => void {
    if (!listeners.includes(callback)) listeners.push(callback);
    ensureHostingerPolling();
    return () => {
      const idx = listeners.indexOf(callback);
      if (idx !== -1) listeners.splice(idx, 1);
    };
  },

  isChannelActive(): boolean {
    return isSubscribed;
  }
};

function notifyListeners(table: string, eventType: string, payload: any) {
  for (const l of listeners) {
    try {
      l({ table, eventType, payload });
    } catch (err) {
      console.error('[HostingerLive] Error in listener callback:', err);
    }
  }
}

function triggerStoreSync() {
  try {
    window.dispatchEvent(new CustomEvent('akk-realtime-synced', { detail: { timestamp: Date.now(), source: 'hostinger_mysql' } }));
  } catch {}
}

export const publishScheduleStatusChange = supabaseRealtimeSync.publishScheduleStatusChange.bind(supabaseRealtimeSync);

