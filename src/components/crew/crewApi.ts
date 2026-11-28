import type { DriverVehicleChecklist, UserProfile, VehicleChecklistItem } from '../../types';
import { logisticsStore } from '../../services/store';
import { branchStore } from '../../services/branchStore';
import { driverChecklistService, STANDARD_CHECKLIST_ITEMS } from '../../services/driverChecklistService';
import { driverShiftService } from '../../services/driverShiftService';
import { driverReportService, getLocalDateStr } from '../../services/driverReportService';
import {
  assertTripVisible, fetchLiveTrips, fetchQaTrips, freshGps, getAuthHeaders, isQaAccount,
  QA_EVENT, slotForUser, isCompleted, validateVehicleChecklist,
  type CrewSlot, type DepartureValidationData, type FieldTrip, type FuelStationChoice,
  type InspectionChecklistEntry, type WorkAction
} from './crewModel';
export { freshGps };
import { validateCameraEvidence, type CameraEvidence } from './crewCaptureEvidence';

const CREW_CLAIM_LIVE_ENABLED = import.meta.env.VITE_AKK_ENABLE_CREW_CLAIM !== 'false';
const syncListeners = new Set<() => void>();
const CREW_CHANNEL_NAME = 'akk_crew_sync_v1';
let crewBroadcast: BroadcastChannel | null = null;
let sseAbortController: AbortController | null = null;
let sseReconnectTimer: number | null = null;
let sseActive = false;
let sseBackoffMs = 1500;

function getCrewBroadcast(): BroadcastChannel | null {
  if (crewBroadcast || typeof BroadcastChannel === 'undefined') return crewBroadcast;
  try {
    crewBroadcast = new BroadcastChannel(CREW_CHANNEL_NAME);
    crewBroadcast.onmessage = () => {
      syncListeners.forEach(cb => cb());
    };
  } catch {
    crewBroadcast = null;
  }
  return crewBroadcast;
}

function stopCrewSseIfIdle() {
  if (syncListeners.size > 0) return;
  sseActive = false;
  if (sseReconnectTimer !== null) {
    clearTimeout(sseReconnectTimer);
    sseReconnectTimer = null;
  }
  if (sseAbortController) {
    sseAbortController.abort();
    sseAbortController = null;
  }
}

function scheduleCrewSseReconnect() {
  if (syncListeners.size === 0 || sseReconnectTimer !== null) return;
  const delay = sseBackoffMs;
  sseBackoffMs = Math.min(10000, Math.round(sseBackoffMs * 1.6));
  sseReconnectTimer = window.setTimeout(() => {
    sseReconnectTimer = null;
    if (syncListeners.size > 0) void connectCrewSse();
  }, delay);
}

async function connectCrewSse() {
  if (sseActive || syncListeners.size === 0 || typeof fetch === 'undefined') return;
  sseActive = true;
  const ctrl = new AbortController();
  sseAbortController = ctrl;
  try {
    let headers = getAuthHeaders();
    if (!headers.Authorization && logisticsStore.isPreviewEnvironment()) {
      await logisticsStore.ensurePreviewServerSession(false);
      headers = getAuthHeaders();
    }
    const res = await fetch('/api/crew-assignments/events', {
      headers,
      credentials: 'same-origin',
      cache: 'no-store',
      signal: ctrl.signal
    });
    if (res.status === 401 && logisticsStore.isPreviewEnvironment()) {
      await logisticsStore.ensurePreviewServerSession(true);
      sseActive = false;
      scheduleCrewSseReconnect();
      return;
    }
    if (!res.ok || !res.body) {
      sseActive = false;
      scheduleCrewSseReconnect();
      return;
    }
    sseBackoffMs = 1500;
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    while (!ctrl.signal.aborted && syncListeners.size > 0) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split(/\r?\n/);
      buffer = lines.pop() || '';
      for (const line of lines) {
        if (!line.startsWith('data:')) continue;
        const raw = line.slice(5).trim();
        if (!raw) continue;
        try {
          const parsed = JSON.parse(raw);
          if (parsed?.type === 'crew_sync') {
            syncListeners.forEach(cb => cb());
          }
        } catch {
          /* ignore malformed keepalive payload */
        }
      }
    }
  } catch {
    /* reconnect below when still subscribed */
  } finally {
    if (sseAbortController === ctrl) sseAbortController = null;
    sseActive = false;
    if (!ctrl.signal.aborted && syncListeners.size > 0) {
      scheduleCrewSseReconnect();
    }
  }
}

export function canClaimLive(): boolean { return CREW_CLAIM_LIVE_ENABLED; }

async function jsonRequest(url: string, method: string, body: any): Promise<any> {
  const runFetch = async () => {
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), 8000);
    try {
      return await fetch(url, {
        method,
        headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        cache: 'no-store',
        body: JSON.stringify(body),
        signal: controller.signal
      });
    } catch (err: any) {
      if (err?.name === 'AbortError') {
        throw new Error('Koneksi lambat (batas waktu 8000ms). Tekan Coba Lagi.');
      }
      throw err;
    } finally {
      window.clearTimeout(timer);
    }
  };
  let response = await runFetch();
  if (response.status === 401 && logisticsStore.isPreviewEnvironment()) {
    const recovered = await logisticsStore.ensurePreviewServerSession(true);
    if (recovered) {
      response = await runFetch();
    }
  }
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || !payload?.success) throw new Error(payload?.error || `Gagal menyimpan (${response.status}).`);
  return payload;
}

export function notifyCrewChanged() {
  window.dispatchEvent(new Event(QA_EVENT));
  window.dispatchEvent(new Event('akk-portal-schedule-updated'));
  try {
    getCrewBroadcast()?.postMessage({ type: 'crew_sync', at: Date.now() });
  } catch {}
  syncListeners.forEach(cb => cb());
}

export function listenCrewChanged(listener: () => void): () => void {
  syncListeners.add(listener);
  getCrewBroadcast();
  void connectCrewSse();
  const handler = () => listener();
  window.addEventListener('storage', handler);
  window.addEventListener(QA_EVENT, handler);
  window.addEventListener('akk-portal-schedule-updated', handler);
  return () => {
    syncListeners.delete(listener);
    window.removeEventListener('storage', handler);
    window.removeEventListener(QA_EVENT, handler);
    window.removeEventListener('akk-portal-schedule-updated', handler);
    stopCrewSseIfIdle();
  };
}

export async function getTripsForUser(user: UserProfile): Promise<FieldTrip[]> {
  if (!isQaAccount(user) && branchStore.getActiveBranches().length === 0) {
    await branchStore.syncFromServer().catch(() => {});
  }
  const all = isQaAccount(user) ? await fetchQaTrips() : await fetchLiveTrips();
  const today = new Date();
  const earliest = new Date(today.getTime() - 90 * 86400000);
  const latest = new Date(today.getTime() + 60 * 86400000);
  return all.filter(t => {
    if (!assertTripVisible(user, t)) return false;
    if (isQaAccount(user) || (slotForUser(t,user) && !isCompleted(t))) return true;
    if (!t.date) return false;
    const d = new Date(t.date + 'T12:00:00');
    return d >= earliest && d <= latest;
  }).sort((a, b) => (a.date === b.date ? a.departureTime.localeCompare(b.departureTime) : b.date.localeCompare(a.date)));
}

function sameDayClaimed(all: FieldTrip[], user: UserProfile, date?: string): boolean {
  if (!date) return false;
  return all.some(t => t.date === date && Boolean(slotForUser(t, user)));
}

async function claimLiveTrip(user: UserProfile, tripId: string, slot: CrewSlot): Promise<void> {
  // Existing server /api/schedules/persist is a merge writer, NOT an atomic claim endpoint.
  // Never silently substitute it: concurrent phones could overwrite each other.
  if (!CREW_CLAIM_LIVE_ENABLED) {
    throw new Error('Ambil Kiriman nyata belum aktif. Penguncian slot di server harus dipasang sebelum digunakan.');
  }
  const all = await fetchLiveTrips();
  if (all.some(t => !isCompleted(t) && slotForUser(t,user))) throw new Error('Selesaikan kiriman aktif sebelum mengambil kiriman lain.');
  const live = all.find(t => t.id === tripId);
  if (!live?.schedule || !assertTripVisible(user, live)) throw new Error('Kiriman tidak tersedia untuk akun ini.');
  if (sameDayClaimed(all, user, live.date)) {
    throw new Error('Sudah memilih kiriman pada hari ini. Reset oleh Super Admin diperlukan untuk mengganti.');
  }
  if (live.phase !== 'waiting') throw new Error('Kiriman sudah berjalan atau selesai.');
  if (slotForUser(live, user)) throw new Error('Kamu sudah mengambil posisi lain di kiriman ini.');
  if (live[slot]) throw new Error('Posisi sudah diambil. Muat ulang daftar kiriman.');
  // Intentionally use a DEDICATED endpoint: the server must implement atomic CAS and server-side branch/RBAC checks.
  await jsonRequest(`/api/crew-assignments/${encodeURIComponent(tripId)}/claim`, 'POST', { slot, confirmed: true });
}

export async function claimTrip(user: UserProfile, tripId: string, slot: CrewSlot): Promise<void> {
  if (!isQaAccount(user)) { await claimLiveTrip(user, tripId, slot); notifyCrewChanged(); return; }
  const all = await fetchQaTrips();
  if (all.some(t => !isCompleted(t) && slotForUser(t,user))) throw new Error('Selesaikan kiriman aktif sebelum mengambil kiriman lain.');
  const target = all.find(t => t.id === tripId);
  if (target && sameDayClaimed(all, user, target.date)) {
    throw new Error('Sudah memilih kiriman pada hari ini. Reset oleh Super Admin diperlukan untuk mengganti.');
  }
  await jsonRequest(`/api/crew-qa/trips/${encodeURIComponent(tripId)}/claim`, 'POST', { slot, confirmed: true });
  notifyCrewChanged();
}

export async function resetTripAssignment(user: UserProfile, tripId: string): Promise<void> {
  if (user.role !== 'super_admin' || user.status !== 'approved') {
    throw new Error('Hanya Super Admin yang dapat mereset kiriman.');
  }
  const url = isQaAccount(user)
    ? `/api/crew-qa/trips/${encodeURIComponent(tripId)}/reset`
    : `/api/crew-assignments/${encodeURIComponent(tripId)}/reset`;
  await jsonRequest(url, 'POST', { confirmed: true });
  notifyCrewChanged();
}

export async function recordKm(user: UserProfile, tripId: string, value: string): Promise<void> {
  const num = Number(value);
  if (!Number.isFinite(num) || num <= 0 || num > 99999999) throw new Error('KM harus berupa angka yang benar.');
  if (!isQaAccount(user)) {
    const gps = await freshGps();
    await jsonRequest(`/api/crew-assignments/${encodeURIComponent(tripId)}/task`, 'POST', { action:'km', value:String(num), gps });
    void logisticsStore.hydrateOperationalDataFromHostinger(true);
    notifyCrewChanged();
    return;
  }
  await jsonRequest(`/api/crew-qa/trips/${encodeURIComponent(tripId)}/action`, 'POST', { action: 'km', value: String(num) });
  notifyCrewChanged();
}

export async function recordEndKm(user: UserProfile, tripId: string, value: string, minStartKm?: number): Promise<void> {
  const num = Number(value);
  if (!Number.isFinite(num) || num <= 0 || num > 99999999) {
    throw new Error('KM akhir harus berupa angka yang valid.');
  }
  if (minStartKm && minStartKm > 0 && num <= minStartKm) {
    throw new Error(`KM akhir harus lebih besar dari KM awal (${minStartKm.toLocaleString('id-ID')} km).`);
  }
  if (!isQaAccount(user)) {
    const gps = await freshGps();
    await jsonRequest(`/api/crew-assignments/${encodeURIComponent(tripId)}/task`, 'POST', { action: 'km_end', value: String(num), gps });
    void logisticsStore.hydrateOperationalDataFromHostinger(true);
    notifyCrewChanged();
    return;
  }
  await jsonRequest(`/api/crew-qa/trips/${encodeURIComponent(tripId)}/action`, 'POST', { action: 'km_end', value: String(num) });
  notifyCrewChanged();
}

function buildChecklistFromCrewInspection(
  trip: FieldTrip,
  user: UserProfile,
  entries: InspectionChecklistEntry[]
): DriverVehicleChecklist {
  const byKey = new Map<string, InspectionChecklistEntry>();
  entries.forEach(entry => byKey.set(entry.key, entry));
  const isOkStatus = (raw?: string) => {
    const v = String(raw || '').trim().toLowerCase();
    return v === 'normal' || v === 'bersih' || v === 'ada' || v === 'ok';
  };
  const oli = byKey.get('oli_mesin');
  const rad = byKey.get('air_radiator');
  const aki = byKey.get('air_aki');
  const rem = byKey.get('rem_minyak_rem');
  const kabin = byKey.get('kebersihan_kabin');
  const inv = byKey.get('inventaris_mobil');
  const ban = byKey.get('ban_cadangan');

  const resolvedMap: Record<string, { status: 'ok' | 'issue'; note: string; photoUrl?: string }> = {
    'Oli Mesin': {
      status: isOkStatus(oli?.status) ? 'ok' : 'issue',
      note: isOkStatus(oli?.status) ? '' : `Temuan kru: ${oli?.status || 'Tidak Normal'}`,
      photoUrl: oli?.photo
    },
    'Air Radiator': {
      status: isOkStatus(rad?.status) ? 'ok' : 'issue',
      note: isOkStatus(rad?.status) ? '' : `Temuan kru: ${rad?.status || 'Tidak Normal'}`,
      photoUrl: rad?.photo
    },
    'Foto Oli Mesin & Air Radiator': {
      status: isOkStatus(oli?.status) && isOkStatus(rad?.status) && Boolean(oli?.photo || rad?.photo) ? 'ok' : 'issue',
      note: isOkStatus(oli?.status) && isOkStatus(rad?.status) ? '' : 'Periksa kondisi oli mesin / air radiator pada foto bukti',
      photoUrl: oli?.photo || rad?.photo
    },
    'Air Accu': {
      status: isOkStatus(aki?.status) ? 'ok' : 'issue',
      note: isOkStatus(aki?.status) ? '' : `Temuan kru: ${aki?.status || 'Tidak Normal'}`
    },
    'Rem Mobil & Minyak Rem': {
      status: isOkStatus(rem?.status) ? 'ok' : 'issue',
      note: isOkStatus(rem?.status) ? '' : `Temuan kru: ${rem?.status || 'Tidak Normal'}`,
      photoUrl: rem?.photo
    },
    'Foto Minyak Rem': {
      status: isOkStatus(rem?.status) && Boolean(rem?.photo) ? 'ok' : 'issue',
      note: isOkStatus(rem?.status) ? '' : 'Periksa kondisi rem / minyak rem pada foto bukti',
      photoUrl: rem?.photo
    },
    'Kebersihan Kabin': {
      status: isOkStatus(kabin?.status) ? 'ok' : 'issue',
      note: isOkStatus(kabin?.status) ? '' : `Temuan kru: ${kabin?.status || 'Tidak Bersih'}`,
      photoUrl: kabin?.photo
    },
    'Inventaris Mobil': {
      status: isOkStatus(inv?.status) ? 'ok' : 'issue',
      note: isOkStatus(inv?.status) ? '' : `Temuan kru: ${inv?.status || 'Tidak Normal'}`
    },
    'Ban Cadangan': {
      status: isOkStatus(ban?.status) ? 'ok' : 'issue',
      note: isOkStatus(ban?.status) ? '' : `Temuan kru: ${ban?.status || 'Tidak Ada'}`
    }
  };

  const now = new Date();
  const timeWib = now.toLocaleTimeString('id-ID', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Jakarta',
    hour12: false
  }).replace('.', ':');

  const items: VehicleChecklistItem[] = STANDARD_CHECKLIST_ITEMS.map((std, idx) => {
    const matched = resolvedMap[std.name] || { status: 'ok' as const, note: '' };
    return {
      id: `item-${trip.id}-${idx + 1}`,
      ...std,
      status: matched.status,
      note: matched.note,
      photoUrl: matched.photoUrl
    };
  });

  const passedCount = items.filter(i => i.status === 'ok').length;
  const issueCount = items.filter(i => i.status === 'issue').length;
  const overallStatus = issueCount === 0 ? 'passed' : issueCount <= 2 ? 'warning' : 'failed';
  const rawPlate = trip.schedule?.fleet?.plateNumber || trip.fleetLabel || '-';
  const cleanPlate = /^FLT-\d+$/i.test(rawPlate) || rawPlate.toUpperCase().endsWith('AKK') ? '-' : rawPlate;

  return {
    id: `CHK-CREW-${trip.id}`,
    driverId: trip.driver?.id || user.id,
    driverName: trip.driver?.name || user.fullName || 'Driver AKK',
    fleetId: trip.schedule?.fleetId || trip.schedule?.fleet?.id || `fleet-${trip.id}`,
    plateNumber: cleanPlate,
    vehicleType: trip.schedule?.fleet?.vehicleType || trip.fleetLabel || 'Armada Kiriman',
    date: trip.date || getLocalDateStr(now),
    time: timeWib,
    odometerKm: Number(trip.odometerStart || 0),
    fuelLevelPercent: trip.schedule?.fleet?.fuelLevelPercent ?? 80,
    inspectionType: 'pre_trip',
    overallStatus,
    passedCount,
    issueCount,
    items,
    notes: `Checklist Portal Driver (${trip.area}) · ${passedCount}/${items.length} komponen OK`,
    driverSignature: `${trip.driver?.name || user.fullName || 'Driver'} (Portal Kru)`,
    checkerName: 'Portal Driver AKK',
    checkerSigned: true,
    synced: true,
    createdAt: now.toISOString()
  };
}

function formatWibClock(isoOrDate: string | Date): string {
  const d = isoOrDate instanceof Date ? isoOrDate : new Date(isoOrDate);
  const t = d.toLocaleTimeString('id-ID', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Jakarta',
    hour12: false
  }).replace('.', ':');
  return `${t} WIB`;
}

export async function markTask(
  user: UserProfile,
  tripId: string,
  task: 'inspection' | 'waybill',
  checklist?: InspectionChecklistEntry[],
  departureValidation?: DepartureValidationData
): Promise<void> {
  if (task === 'inspection') {
    const checklistError = validateVehicleChecklist(checklist);
    if (checklistError) throw new Error(checklistError);
  }
  if (task === 'waybill') {
    if (
      !departureValidation ||
      !departureValidation.checks?.waybillMatch ||
      !departureValidation.checks?.documentsReady
    ) {
      throw new Error('Lengkapi konfirmasi cek surat jalan dan dokumen terlebih dahulu.');
    }
    const sigKeys: Array<keyof DepartureValidationData['signatures']> = [
      'spvLogistik',
      'spvOperasional',
      'security',
      'crew'
    ];
    for (const key of sigKeys) {
      const val = String(departureValidation.signatures?.[key] || '');
      if (!val.startsWith('data:image/') || val.length < 120) {
        throw new Error('Seluruh 4 tanda tangan digital pada Form Keluar wajib diisi lengkap.');
      }
    }
  }
  if (!isQaAccount(user)) {
    const gps = await freshGps();
    await jsonRequest(`/api/crew-assignments/${encodeURIComponent(tripId)}/task`, 'POST', {
      action: task,
      gps,
      ...(task === 'inspection' ? { checklist } : {}),
      ...(task === 'waybill' && departureValidation ? { departureValidation } : {})
    });
    if (task === 'inspection') {
      void driverChecklistService.syncFromServer(true);
    }
    notifyCrewChanged();
    return;
  }
  const res = await jsonRequest(`/api/crew-qa/trips/${encodeURIComponent(tripId)}/action`, 'POST', {
    action: task,
    ...(task === 'inspection' ? { checklist } : {}),
    ...(task === 'waybill' && departureValidation ? { departureValidation } : {})
  });
  if (task === 'inspection' && checklist) {
    const qaTrip = (await fetchQaTrips()).find(t => t.id === tripId) || res?.trip;
    if (qaTrip) {
      const mapped = buildChecklistFromCrewInspection(qaTrip, user, checklist);
      driverChecklistService.saveChecklist(mapped);
    }
  }
  notifyCrewChanged();
}

export async function moveTrip(user: UserProfile, tripId: string, next: 'going' | 'returned'): Promise<void> {
  if (isQaAccount(user)) {
    const qaRes = await jsonRequest(`/api/crew-qa/trips/${encodeURIComponent(tripId)}/action`, 'POST', {
      action: next === 'going' ? 'depart' : 'arrive'
    });
    const qaTrip = qaRes?.trip as FieldTrip | undefined;
    if (qaTrip) {
      const nowIso = new Date().toISOString();
      const wibTime = formatWibClock(nowIso);
      const rawPlate = qaTrip.fleetLabel || '-';
      const qaDriverId = qaTrip.driver?.id || user.id;
      const qaDriverName = qaTrip.driver?.name || user.fullName || 'Driver QA';
      if (next === 'going') {
        const pin = driverShiftService.getPin(qaDriverId, qaDriverName);
        await driverShiftService.checkInDriver({
          driverId: qaDriverId,
          driverName: qaDriverName,
          helper1Id: qaTrip.helper?.id,
          helper1Name: qaTrip.helper?.name,
          fleetId: `fleet-${tripId}`,
          plateNumber: rawPlate,
          checkinRole: 'driver',
          areaName: qaTrip.area,
          verificationMethod: 'pin',
          pin,
          notes: `Berangkat via Portal Kru QA · ${qaTrip.area}`
        });
      } else {
        await driverShiftService.checkOutDriver(
          qaDriverId,
          `Tiba di gudang via Portal Kru QA · ${wibTime}`,
          {
            driverName: qaDriverName,
            plateNumber: rawPlate,
            areaName: qaTrip.area
          }
        );
        await driverShiftService.checkOutCrewTeamForTrip({
          actorDriverId: qaDriverId,
          actorName: user.fullName || qaDriverName,
          plateNumber: rawPlate,
          areaName: qaTrip.area,
          tripDate: qaTrip.date,
          crewNames: [qaTrip.driver?.name, qaTrip.helper?.name],
          arrivedAtWarehouseAt: nowIso,
          notes: `Tiba di gudang via Portal Kru QA · ${wibTime}`
        });
      }
    }
    notifyCrewChanged();
    return;
  }
  const gps = await freshGps();
  // One authenticated MySQL transaction updates the shared trip and shift check-in/out for both accounts.
  await jsonRequest(`/api/crew-assignments/${encodeURIComponent(tripId)}/action`, 'POST', {
    action: next === 'going' ? 'depart' : 'arrive', gps
  });
  void driverShiftService.syncFromServer();
  void driverReportService.syncWithServer(true);
  notifyCrewChanged();
}

export interface WorkReportExtra {
  fuelLocation?: FuelStationChoice;
  fuelUrgentReason?: string;
  photoUrls?: string[];
  customerOutletName?: string;
  invoiceNumber?: string;
  issueItemName?: string;
  issueQty?: string;
  kendalaSubType?: 'jalan_rute' | 'antri_customer';
}

export async function submitWorkReport(
  user: UserProfile,
  tripId: string,
  kind: WorkAction,
  note: string,
  evidence?: CameraEvidence | null,
  extra?: WorkReportExtra
): Promise<void> {
  if (note.trim().length < 3) throw new Error('Keterangan minimal 3 huruf.');
  const isManifestForm = kind === 'form_kirim';
  if (!isManifestForm) {
    const error = validateCameraEvidence(evidence);
    if (error) throw new Error(error);
  }
  if (kind === 'bbm') {
    const loc = extra?.fuelLocation || 'Farly';
    if (!['Farly', 'Gajah Mada', 'SPBU Lain (Urgent)'].includes(loc)) {
      throw new Error('Pilih lokasi pengisian SPBU terlebih dahulu.');
    }
    if (loc === 'SPBU Lain (Urgent)' && String(extra?.fuelUrgentReason || '').trim().length < 3) {
      throw new Error('Tuliskan alasan pengisian di SPBU Lain (Urgent).');
    }
  }
  if (kind === 'toko' && String(extra?.customerOutletName || '').trim().length < 2) {
    throw new Error('Nama pelanggan / toko wajib diisi.');
  }
  if (kind === 'retur') {
    if (String(extra?.customerOutletName || '').trim().length < 2) {
      throw new Error('Nama pelanggan untuk retur barang wajib diisi.');
    }
    if (String(extra?.issueItemName || '').trim().length < 2) {
      throw new Error('Nama item barang retur wajib diisi.');
    }
  }
  const extraPhotos = Array.isArray(extra?.photoUrls)
    ? extra!.photoUrls.filter(p => typeof p === 'string' && p.startsWith('data:image/')).slice(0, 6)
    : [];
  const mergedPhotos = extraPhotos.length > 0
    ? extraPhotos
    : (evidence?.photo ? [evidence.photo] : []);

  const gpsFix = evidence?.gps || (isManifestForm ? await freshGps().catch(() => ({ latitude: -8.1906, longitude: 114.3708, accuracy: 20 })) : undefined);
  const manifestCapturedAt = new Date().toISOString();
  const cleanOutlet = extra?.customerOutletName?.trim() || undefined;
  const cleanInvoice = extra?.invoiceNumber?.trim() || undefined;
  const cleanItemName = extra?.issueItemName?.trim() || undefined;
  const cleanItemQty = extra?.issueQty?.trim() || undefined;
  const cleanKendalaSub = extra?.kendalaSubType;

  if (isQaAccount(user)) {
    // QA receives the actual capture for validation, or manifest confirmation metadata when kind === 'form_kirim'.
    await jsonRequest(`/api/crew-qa/trips/${encodeURIComponent(tripId)}/action`, 'POST', {
      action: 'report',
      kind,
      note: note.trim(),
      ...(kind === 'bbm' ? {
        fuelLocation: extra?.fuelLocation || 'Farly',
        fuelUrgentReason: extra?.fuelUrgentReason?.trim() || undefined,
        photoCount: mergedPhotos.length || 1
      } : {}),
      ...(kind === 'retur' ? { photoCount: mergedPhotos.length || 1 } : {}),
      ...(cleanOutlet ? { customerOutletName: cleanOutlet } : {}),
      ...(cleanInvoice ? { invoiceNumber: cleanInvoice } : {}),
      ...(cleanItemName ? { issueItemName: cleanItemName } : {}),
      ...(cleanItemQty ? { issueQty: cleanItemQty } : {}),
      ...(cleanKendalaSub ? { kendalaSubType: cleanKendalaSub } : {}),
      ...(evidence ? { evidence } : { manifestGps: gpsFix, capturedAt: manifestCapturedAt })
    });

    const qaTrip = (await fetchQaTrips()).find(t => t.id === tripId);
    const slotRole = qaTrip ? slotForUser(qaTrip, user) : null;
    const qaCategoryMap: Record<WorkAction, 'isi_bbm' | 'kendala_jalan' | 'istirahat' | 'retur' | 'akhir_kiriman'> = {
      bbm: 'isi_bbm',
      kendala: 'kendala_jalan',
      toko: 'istirahat',
      retur: 'retur',
      form_kirim: 'akhir_kiriman'
    };
    const urgentReason = kind === 'bbm' ? extra?.fuelUrgentReason?.trim() : undefined;
    const formattedNote =
      kind === 'bbm' && urgentReason
        ? `[SPBU Lain (Urgent): ${urgentReason}] ${note.trim()}`
        : kind === 'toko' && cleanOutlet && !note.includes('[ABSEN KIRIMAN PELANGGAN:')
        ? `[ABSEN KIRIMAN PELANGGAN: ${cleanOutlet}] ${note.trim()}`
        : note.trim();
    const isAntri = kind === 'kendala' && (cleanKendalaSub === 'antri_customer' || /antri/i.test(note));

    driverReportService.addReport({
      driverId: qaTrip?.driver?.id || user.id,
      driverName: qaTrip?.driver?.name || user.fullName || 'Kru QA',
      helperName: qaTrip?.helper?.name,
      userRole: slotRole === 'helper' ? 'Helper' : 'Driver',
      plateNumber: qaTrip?.fleetLabel || '-',
      category: qaCategoryMap[kind],
      areaName: qaTrip?.area || 'Rute QA',
      deliveryId: tripId,
      notes: formattedNote,
      ...(kind === 'bbm' ? {
        fuelLocation: extra?.fuelLocation || 'Farly',
        fuelUrgentReason: urgentReason || undefined
      } : {}),
      ...(cleanOutlet ? { customerOutletName: cleanOutlet } : {}),
      ...(cleanInvoice ? { invoiceNumber: cleanInvoice } : {}),
      ...(cleanItemName ? { issueItemName: cleanItemName } : {}),
      ...(cleanItemQty ? { issueQty: cleanItemQty } : {}),
      ...(isAntri ? {
        customerQueueStatus: 'sedang_mengantri' as const,
        customerQueueStartIso: manifestCapturedAt,
        customerQueueStartFormatted: formatWibClock(manifestCapturedAt)
      } : {}),
      photoUrl: mergedPhotos[0] || evidence?.photo || null,
      photoUrls: mergedPhotos,
      latitude: gpsFix?.latitude,
      longitude: gpsFix?.longitude,
      status: kind === 'kendala' || kind === 'retur' ? 'pending' : 'verified'
    });
    notifyCrewChanged();
    return;
  }
  const live = (await fetchLiveTrips()).find(t => t.id === tripId);
  if (!live || !assertTripVisible(user, live) || !slotForUser(live, user)) throw new Error('Kiriman tidak tersedia untuk akun ini.');
  const slot = slotForUser(live, user)!;
  const allowed = slot === 'driver' ? ['bbm','kendala'] : ['toko','kendala','retur','form_kirim'];
  if (!allowed.includes(kind)) throw new Error('Jenis laporan tidak sesuai posisi kiriman.');
  if (!isManifestForm) {
    const expired = validateCameraEvidence(evidence);
    if (expired || !evidence) throw new Error(expired || 'Ambil foto terlebih dahulu.');
  }
  const gps = evidence?.gps || gpsFix!;
  const resolvedPlate = live.schedule?.fleet?.plateNumber || live.fleetLabel;
  await jsonRequest(`/api/crew-assignments/${encodeURIComponent(tripId)}/report`, 'POST', {
    report: {
      id: `crew-v68-${Date.now()}-${Math.random().toString(36).slice(2,8)}`,
      scheduleId: tripId,
      trackingNumber: live.trackingNumber,
      driverName: live.driver?.name || '-',
      helperName: live.helper?.name || '-',
      userId: user.id,
      userRole: slot === 'driver' ? 'Driver' : 'Helper',
      reportType: kind,
      type: kind,
      area: live.area,
      plateNumber: resolvedPlate,
      notes: note.trim(),
      note: note.trim(),
      ...(kind === 'bbm' ? {
        fuelLocation: extra?.fuelLocation || 'Farly',
        fuelUrgentReason: extra?.fuelUrgentReason?.trim() || undefined
      } : {}),
      ...(mergedPhotos.length > 0 ? { photoUrls: mergedPhotos } : {}),
      ...(cleanOutlet ? { customerOutletName: cleanOutlet } : {}),
      ...(cleanInvoice ? { invoiceNumber: cleanInvoice } : {}),
      ...(cleanItemName ? { issueItemName: cleanItemName } : {}),
      ...(cleanItemQty ? { issueQty: cleanItemQty } : {}),
      ...(cleanKendalaSub ? { kendalaSubType: cleanKendalaSub } : {}),
      photoUrl: evidence?.photo || mergedPhotos[0] || '',
      photoSource: evidence ? evidence.source : 'manifest_no_photo',
      photoCapturedAt: evidence?.capturedAt || manifestCapturedAt,
      gpsCapturedAt: evidence?.gpsCapturedAt || manifestCapturedAt,
      gpsLatitude: gps.latitude,
      gpsLongitude: gps.longitude,
      gpsAccuracy: gps.accuracy,
      timestamp: new Date().toISOString(),
      status: 'submitted',
      source: 'crew_v65'
    }
  });
  void driverReportService.syncWithServer(true);
  notifyCrewChanged();
}
