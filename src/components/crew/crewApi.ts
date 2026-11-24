import type { UserProfile } from '../../types';
import { logisticsStore } from '../../services/store';
import {
  assertTripVisible, fetchLiveTrips, fetchQaTrips, freshGps, getAuthHeaders, isQaAccount,
  QA_EVENT, slotForUser, isCompleted, type CrewSlot, type FieldTrip, type WorkAction
} from './crewModel';
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
  let response = await fetch(url, {
    method, headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
    credentials: 'same-origin', cache: 'no-store', body: JSON.stringify(body)
  });
  if (response.status === 401 && logisticsStore.isPreviewEnvironment()) {
    const recovered = await logisticsStore.ensurePreviewServerSession(true);
    if (recovered) {
      response = await fetch(url, {
        method, headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
        credentials: 'same-origin', cache: 'no-store', body: JSON.stringify(body)
      });
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
    notifyCrewChanged();
    return;
  }
  await jsonRequest(`/api/crew-qa/trips/${encodeURIComponent(tripId)}/action`, 'POST', { action: 'km', value: String(num) });
  notifyCrewChanged();
}

export async function markTask(user: UserProfile, tripId: string, task: 'inspection' | 'waybill'): Promise<void> {
  if (!isQaAccount(user)) {
    const gps = await freshGps();
    await jsonRequest(`/api/crew-assignments/${encodeURIComponent(tripId)}/task`, 'POST', { action:task, gps });
    notifyCrewChanged();
    return;
  }
  await jsonRequest(`/api/crew-qa/trips/${encodeURIComponent(tripId)}/action`, 'POST', { action: task });
  notifyCrewChanged();
}

export async function moveTrip(user: UserProfile, tripId: string, next: 'going' | 'returned'): Promise<void> {
  if (isQaAccount(user)) {
    await jsonRequest(`/api/crew-qa/trips/${encodeURIComponent(tripId)}/action`, 'POST', {
      action: next === 'going' ? 'depart' : 'arrive'
    });
    notifyCrewChanged();
    return;
  }
  const live = (await fetchLiveTrips()).find(t => t.id === tripId);
  if (!live || !assertTripVisible(user, live)) throw new Error('Kiriman tidak ditemukan.');
  if (!slotForUser(live, user)) throw new Error('Kamu belum mengambil posisi pada kiriman ini.');
  if (!live.driver || !live.helper) throw new Error('Tim belum lengkap.');
  if (next === 'going' && live.phase !== 'waiting') throw new Error('Kiriman sudah berjalan.');
  if (next === 'returned' && live.phase !== 'going') throw new Error('Kiriman belum berjalan.');
  const gps = await freshGps();
  // One authenticated MySQL transaction updates the shared trip for both accounts.
  await jsonRequest(`/api/crew-assignments/${encodeURIComponent(tripId)}/action`, 'POST', {
    action: next === 'going' ? 'depart' : 'arrive', gps
  });
  notifyCrewChanged();
}

export async function submitWorkReport(
  user: UserProfile, tripId: string, kind: WorkAction, note: string, evidence: CameraEvidence
): Promise<void> {
  if (note.trim().length < 3) throw new Error('Keterangan minimal 3 huruf.');
  const error = validateCameraEvidence(evidence);
  if (error) throw new Error(error);
  if (isQaAccount(user)) {
    // QA receives the actual capture for validation, but stores only evidence metadata.
    await jsonRequest(`/api/crew-qa/trips/${encodeURIComponent(tripId)}/action`, 'POST', {
      action: 'report', kind, note: note.trim(), evidence
    });
    notifyCrewChanged();
    return;
  }
  const live = (await fetchLiveTrips()).find(t => t.id === tripId);
  if (!live || !assertTripVisible(user, live) || !slotForUser(live, user)) throw new Error('Kiriman tidak tersedia untuk akun ini.');
  const slot = slotForUser(live, user)!;
  const allowed = slot === 'driver' ? ['bbm','kendala'] : ['toko','kendala','retur','form_kirim'];
  if (!allowed.includes(kind)) throw new Error('Jenis laporan tidak sesuai posisi kiriman.');
  const expired = validateCameraEvidence(evidence);
  if (expired) throw new Error(expired);
  // Use the GPS fix collected at capture; never replace it with the save location.
  const gps = evidence.gps;
  await jsonRequest(`/api/crew-assignments/${encodeURIComponent(tripId)}/report`, 'POST', {
    report: { id: `crew-v68-${Date.now()}-${Math.random().toString(36).slice(2,8)}`,
      scheduleId: tripId, trackingNumber: live.trackingNumber,
      driverName: live.driver?.name || '-', helperName: live.helper?.name || '-', userId: user.id,
      userRole: slot === 'driver' ? 'Driver' : 'Helper', reportType: kind, type: kind,
      area: live.area, plateNumber: live.fleetLabel, notes: note.trim(), note: note.trim(),
      photoUrl: evidence.photo, photoSource: evidence.source, photoCapturedAt: evidence.capturedAt,
      gpsCapturedAt: evidence.gpsCapturedAt, gpsLatitude: gps.latitude, gpsLongitude: gps.longitude, gpsAccuracy: gps.accuracy,
      timestamp: new Date().toISOString(), status: 'submitted', source: 'crew_v65' }
  });
  notifyCrewChanged();
}
