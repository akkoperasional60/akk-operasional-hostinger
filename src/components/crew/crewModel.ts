import type { Schedule, UserProfile, Crew } from '../../types';
import { branchStore } from '../../services/branchStore';
import { logisticsStore } from '../../services/store';

export const QA_STORAGE_KEY = 'akk_qa_kiriman_sandbox_v63';
export const QA_EVENT = 'akk-qa-kiriman-updated';
export type CrewSlot = 'driver' | 'helper';
export type TripPhase = 'waiting' | 'going' | 'returned';
export type WorkAction = 'bbm' | 'kendala' | 'toko' | 'retur' | 'form_kirim';
export type Member = { id: string; name: string };
export interface FieldReport {
  id: string;
  type: WorkAction;
  note: string;
  by: string;
  at: string;
  photo?: string;
  gps?: { latitude: number; longitude: number; accuracy: number };
}
export type VehicleChecklistKey =
  | 'oli_mesin'
  | 'air_radiator'
  | 'air_aki'
  | 'rem_minyak_rem'
  | 'kebersihan_kabin'
  | 'inventaris_mobil'
  | 'ban_cadangan';

export interface VehicleChecklistItemDef {
  key: VehicleChecklistKey;
  label: string;
  requiresPhoto: boolean;
  options: readonly [string, string];
}

export const VEHICLE_CHECKLIST_ITEMS: readonly VehicleChecklistItemDef[] = [
  { key: 'oli_mesin', label: 'Oli Mesin', requiresPhoto: true, options: ['Normal', 'Tidak Normal'] },
  { key: 'air_radiator', label: 'Air Radiator', requiresPhoto: true, options: ['Normal', 'Tidak Normal'] },
  { key: 'air_aki', label: 'Air Aki', requiresPhoto: false, options: ['Normal', 'Tidak Normal'] },
  { key: 'rem_minyak_rem', label: 'Rem Mobil & Minyak Rem', requiresPhoto: true, options: ['Normal', 'Tidak Normal'] },
  { key: 'kebersihan_kabin', label: 'Kebersihan Kabin', requiresPhoto: true, options: ['Bersih', 'Tidak'] },
  { key: 'inventaris_mobil', label: 'Inventaris Mobil', requiresPhoto: false, options: ['Normal', 'Tidak Normal'] },
  { key: 'ban_cadangan', label: 'Ban Cadangan', requiresPhoto: false, options: ['Ada', 'Tidak Ada'] }
] as const;

export interface InspectionChecklistEntry {
  key: VehicleChecklistKey;
  label: string;
  status: string;
  checked?: boolean;
  requiresPhoto: boolean;
  photo?: string;
  photoAttached?: boolean;
  capturedAt?: string;
  gps?: { latitude: number; longitude: number; accuracy: number };
}

export function validateVehicleChecklist(entries: unknown): string | null {
  if (!Array.isArray(entries)) {
    return 'Pemeriksaan armada wajib diisi lengkap.';
  }
  const byKey = new Map<string, any>();
  for (const item of entries) {
    if (item && typeof item === 'object' && typeof (item as any).key === 'string') {
      byKey.set((item as any).key, item);
    }
  }
  const unselected: string[] = [];
  const missingPhotos: string[] = [];
  for (const def of VEHICLE_CHECKLIST_ITEMS) {
    const entry = byKey.get(def.key);
    const chosen = typeof entry?.status === 'string' ? entry.status.trim() : '';
    if (!def.options.includes(chosen)) {
      unselected.push(def.label);
    }
    if (def.requiresPhoto) {
      const photo = typeof entry?.photo === 'string' ? entry.photo.trim() : '';
      const validPhoto = photo.startsWith('data:image/') && photo.length >= 80;
      if (!validPhoto) {
        missingPhotos.push(def.label);
      }
    }
  }
  if (missingPhotos.length > 0) {
    return `Foto bukti wajib belum lengkap: ${missingPhotos.join(', ')}.`;
  }
  if (unselected.length > 0) {
    return `Pilihan pemeriksaan belum diisi: ${unselected.join(', ')}.`;
  }
  return null;
}

export type DepartureSignatureKey = 'spvLogistik' | 'spvOperasional' | 'security' | 'crew';
export type FuelStationChoice = 'Farly' | 'Gajah Mada' | 'SPBU Lain (Urgent)';
export const FUEL_STATION_CHOICES: readonly FuelStationChoice[] = [
  'Farly',
  'Gajah Mada',
  'SPBU Lain (Urgent)'
] as const;

export interface DepartureValidationData {
  summary: {
    driverName: string;
    helperName: string;
    fleetLabel: string;
    areaName: string;
    recordedAt: string;
    recordedAtWib: string;
  };
  checks: {
    waybillMatch: boolean;
    documentsReady: boolean;
  };
  signatures: Record<DepartureSignatureKey, string>;
  signedAt: string;
  signedBy?: string;
  gps?: { latitude: number; longitude: number; accuracy: number };
}

export interface FieldTrip {
  id: string;
  branchId: string;
  area: string;
  fleetLabel: string;
  date: string;
  departureTime: string;
  trackingNumber?: string;
  driver: Member | null;
  helper: Member | null;
  phase: TripPhase;
  createdAt: string;
  departedAt?: string;
  returnedAt?: string;
  odometerStart?: string;
  odometerEnd?: string;
  odometerEndAt?: string;
  inspectionDone?: boolean;
  inspectionChecklist?: InspectionChecklistEntry[];
  waybillValidated?: boolean;
  departureValidation?: DepartureValidationData;
  reports: FieldReport[];
  source: 'qa' | 'live';
  schedule?: Schedule;
}

export const WORK_LABELS: Record<WorkAction, string> = {
  bbm: 'Isi BBM', kendala: 'Lapor Kendala', toko: 'Absen Toko', retur: 'Retur Barang', form_kirim: 'Form Kirim'
};
export const WORK_FOR_SLOT: Record<CrewSlot, WorkAction[]> = {
  driver: ['bbm', 'kendala'], helper: ['toko', 'kendala', 'retur', 'form_kirim']
};

export const isQaAccount = (user: UserProfile | null | undefined): boolean =>
  Boolean(user?.status === 'approved' &&
    /^akk-qa-(driver|helper)-[a-z0-9-]+@example\.com$/i.test(String(user.email || '')) &&
    String(user.notes || '').includes('AKK_QA_TEST_ACCOUNT'));

export function userMatchesMember(user: UserProfile, member?: Member | null): boolean {
  if (!member) return false;
  const a = String(user.id || '').toLowerCase().replace(/^(usr-|crw-)/, '');
  const b = String(member.id || '').toLowerCase().replace(/^(usr-|crw-)/, '');
  if (a.length >= 3 && b.length >= 3 && a === b) return true;
  const uname = String(user.fullName || '').trim().toLocaleLowerCase('id-ID');
  const mname = String(member.name || '').trim().toLocaleLowerCase('id-ID');
  return Boolean(uname.length >= 4 && uname === mname);
}

export function slotForUser(trip: FieldTrip, user: UserProfile): CrewSlot | null {
  return userMatchesMember(user, trip.driver) ? 'driver' : userMatchesMember(user, trip.helper) ? 'helper' : null;
}

export function readQaTrips(): FieldTrip[] {
  try {
    const rows: any[] = JSON.parse(localStorage.getItem(QA_STORAGE_KEY) || '[]');
    if (!Array.isArray(rows)) return [];
    return rows.filter(t => t && typeof t.id === 'string' && typeof t.branchId === 'string' && typeof t.area === 'string')
      .slice(0, 120).map(t => ({
        id: t.id, branchId: t.branchId, area: t.area, fleetLabel: t.fleetLabel || 'Belum dipilih',
        date: t.date || '', departureTime: t.departureTime || '07:30', trackingNumber: t.trackingNumber || t.id,
        driver: t.driver || null, helper: t.helper || null,
        phase: t.phase === 'returned' || t.phase === 'going' ? t.phase : 'waiting',
        createdAt: t.createdAt || '', departedAt: t.departedAt, returnedAt: t.returnedAt,
        odometerStart: t.odometerStart, odometerEnd: t.odometerEnd, odometerEndAt: t.odometerEndAt,
        inspectionDone: t.inspectionDone, waybillValidated: t.waybillValidated,
        departureValidation: t.departureValidation || undefined,
        reports: Array.isArray(t.reports) ? t.reports : [], source: 'qa' as const
      }));
  } catch { return []; }
}

export function saveQaTripPatch(tripId: string, change: (trip: FieldTrip) => FieldTrip): FieldTrip {
  const all = readQaTrips();
  const found = all.find(t => t.id === tripId);
  if (!found) throw new Error('Kiriman uji tidak tersedia. Muat ulang halaman.');
  const updated = change(found);
  const next = all.map(t => t.id === tripId ? updated : t).map(({ source: _source, schedule: _schedule, ...rest }) => rest);
  localStorage.setItem(QA_STORAGE_KEY, JSON.stringify(next));
  window.dispatchEvent(new Event(QA_EVENT));
  return updated;
}

export function assertTripVisible(user: UserProfile, trip: FieldTrip): boolean {
  if (!trip.branchId) return false;
  return branchStore.getActiveBranches().some(b => b.id === trip.branchId) &&
    branchStore.canUserAccessBranch(user, trip.branchId);
}

export function memberFromUser(user: UserProfile): Member {
  return { id: `crw-${user.id}`, name: user.fullName || user.email || 'Kru AKK' };
}

function strictScheduleBranch(s: Schedule): string | null {
  const extra = s as Schedule & { originBranchId?: string; branchId?: string };
  const branches = branchStore.getActiveBranches();
  if (extra.originBranchId && branches.some(b => b.id === extra.originBranchId)) return extra.originBranchId;
  if (extra.branchId && branches.some(b => b.id === extra.branchId)) return extra.branchId;
  const explicit = branchStore.getExplicitScheduleBranchId(s.id);
  if (explicit) return explicit;
  const origin = (s.originName || '').toLocaleLowerCase('id-ID');
  if (/sidoarjo|surabaya/.test(origin)) return 'cab-sidoarjo';
  if (/banyuwangi|nusantara/.test(origin)) return 'cab-banyuwangi';
  if (s.fleet?.branchId && branches.some(b => b.id === s.fleet?.branchId)) return s.fleet.branchId;
  return null;
}

function getMember(crew?: Crew | null, id?: string): Member | null {
  if (crew?.id && crew?.name) return { id: crew.id, name: crew.name };
  if (!id || id === '-' || /pending|tbd|none/i.test(id)) return null;
  const mapped = logisticsStore.getCrews().find(c => c.id === id);
  return mapped?.name ? { id: mapped.id, name: mapped.name } : null;
}

function getPortalSlotMember(s: Schedule, slot: CrewSlot): Member | null {
  const explicit =
    slot === 'driver'
      ? getMember(s.portalCrew, s.portalCrewId)
      : getMember(s.portalCrewHelper, s.portalCrewHelperId);
  if (explicit) return explicit;
  const audit = Array.isArray(s.crewClaimAudit) ? s.crewClaimAudit : [];
  const claimed = [...audit].reverse().find(entry => entry?.slot === slot && String(entry?.actorId || '').trim());
  if (!claimed) return null;
  const legacy = slot === 'driver' ? getMember(s.crew, s.crewId) : getMember(s.crewHelper, s.crewHelperId);
  if (legacy) return legacy;
  return {
    id: `crw-${String(claimed.actorId).trim()}`,
    name: String(claimed.actorName || '').trim() || 'Kru AKK'
  };
}

export function normalizeLiveSchedule(s: Schedule): FieldTrip | null {
  const branchId = strictScheduleBranch(s);
  if (!branchId || !s.id) return null;
  const status = String(s.status || '').toLowerCase();
  const hasArrived =
    status === 'delivered' ||
    status === 'completed' ||
    status === 'returned' ||
    Boolean(s.actualArrival);
  const phase: TripPhase = hasArrived
    ? 'returned'
    : status === 'picked_up' || status === 'in_transit'
      ? 'going'
      : 'waiting';
  const dateRaw = s.deliveryDate || s.departureDate || '';
  const date = dateRaw.match(/^\d{4}-\d{2}-\d{2}/)?.[0] || '';
  const driver = getPortalSlotMember(s, 'driver');
  const helper = getPortalSlotMember(s, 'helper');
  return {
    id: s.id, branchId, area: s.areaName || s.store?.storeName || 'Area belum ditentukan',
    fleetLabel: s.fleet?.initialCode || s.armada || s.fleet?.plateNumber || 'Armada belum dipilih',
    date, departureTime: s.departureTime || s.departureDate?.match(/T(\d{2}:\d{2})/)?.[1] || '07:30',
    trackingNumber: s.trackingNumber, driver, helper, phase,
    createdAt: s.createdAt, departedAt: s.actualDeparture, returnedAt: s.actualArrival,
    odometerStart: String((s as any).crewOdometerStart || ''),
    odometerEnd: (s as any).crewOdometerEnd ? String((s as any).crewOdometerEnd) : undefined,
    odometerEndAt: (s as any).crewOdometerEndAt ? String((s as any).crewOdometerEndAt) : undefined,
    inspectionDone: Boolean((s as any).crewInspectionDone),
    inspectionChecklist: Array.isArray((s as any).crewInspectionChecklist) ? (s as any).crewInspectionChecklist : undefined,
    waybillValidated: Boolean((s as any).crewWaybillValidated),
    departureValidation: (s as any).departureValidation || undefined,
    reports: [], source: 'live', schedule: s
  };
}

export function getAuthHeaders(): Record<string, string> {
  const token = localStorage.getItem('akk_session_token_v1') || sessionStorage.getItem('akk_session_token_v1') || '';
  return token ? { Authorization: `Bearer ${token}`, 'x-akk-session-token': token } : {};
}

export async function fetchQaTrips(): Promise<FieldTrip[]> {
  const response = await fetch('/api/crew-qa/trips', {headers:getAuthHeaders(),credentials:'same-origin',cache:'no-store'});
  if (!response.ok) throw new Error('Jadwal uji server belum tersedia. Coba buka ulang.');
  const result = await response.json();
  if (!result?.success || !Array.isArray(result.trips)) throw new Error('Data jadwal uji tidak valid.');
  return result.trips.map((t:any): FieldTrip => ({
    id:t.id, branchId:t.branchId, area:t.area, fleetLabel:t.fleetLabel || 'Armada Uji',
    date:t.date, departureTime:t.departureTime, trackingNumber:t.id,
    driver:t.driver || null, helper:t.helper || null, createdAt:t.createdAt || '',
    phase:t.phase === 'going' || t.phase === 'returned' ? t.phase : 'waiting',
    departedAt:t.departedAt, returnedAt:t.returnedAt, odometerStart:t.odometerStart,
    odometerEnd:t.odometerEnd, odometerEndAt:t.odometerEndAt,
    inspectionDone:!!t.inspectionDone,
    inspectionChecklist:Array.isArray(t.inspectionChecklist)?t.inspectionChecklist:undefined,
    waybillValidated:!!t.waybillValidated,
    departureValidation:t.departureValidation || undefined,
    reports:Array.isArray(t.reports)?t.reports:[],source:'qa'
  }));
}

export async function fetchLiveTrips(): Promise<FieldTrip[]> {
  let response = await fetch('/api/crew-assignments', { headers: getAuthHeaders(), credentials: 'same-origin', cache: 'no-store' });
  if (response.status === 401 && logisticsStore.isPreviewEnvironment()) {
    const recovered = await logisticsStore.ensurePreviewServerSession(true);
    if (recovered) {
      await logisticsStore.hydrateOperationalDataFromHostinger(true);
      response = await fetch('/api/crew-assignments', { headers: getAuthHeaders(), credentials: 'same-origin', cache: 'no-store' });
    }
  }
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result?.error || 'Jadwal server belum bisa dibaca. Coba ulangi.');
  if (!result?.success || !Array.isArray(result?.schedules)) throw new Error('Data jadwal dari server tidak valid.');
  const reportBySchedule = new Map<string, FieldReport[]>();
  for (const item of Array.isArray(result.reports) ? result.reports : []) {
    if (!item || typeof item.scheduleId !== 'string' || !WORK_LABELS[item.type as WorkAction]) continue;
    const reports = reportBySchedule.get(item.scheduleId) || [];
    reports.push({ id: String(item.id), type: item.type as WorkAction,
      note: String(item.note || ''), by: String(item.by || ''), at: String(item.at || ''),
      gps: item.gps || undefined });
    reportBySchedule.set(item.scheduleId, reports);
  }
  return (result.schedules as Schedule[]).map(normalizeLiveSchedule)
    .filter((x): x is FieldTrip => Boolean(x))
    .map(t => ({ ...t, reports: reportBySchedule.get(t.id) || [] }));
}

export function safeDate(iso: string): string {
  if (!iso) return '-';
  const [y, m, d] = iso.slice(0, 10).split('-');
  return y && m && d ? `${d}/${m}/${y}` : iso;
}

export function getTodayTomorrowJakarta(): { today: string; tomorrow: string } {
  const today = new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Jakarta' });
  const baseMs = Date.parse(`${today}T12:00:00Z`);
  const tomorrow = Number.isFinite(baseMs)
    ? new Date(baseMs + 86400000).toISOString().slice(0, 10)
    : today;
  return { today, tomorrow };
}

export function isTodayOrTomorrowTrip(trip: FieldTrip): boolean {
  const { today, tomorrow } = getTodayTomorrowJakarta();
  const candidates = [
    trip.date,
    trip.schedule?.deliveryDate,
    trip.schedule?.departureDate
  ]
    .map(v => String(v || '').match(/^\d{4}-\d{2}-\d{2}/)?.[0] || '')
    .filter(Boolean);
  return candidates.some(d => d === today || d === tomorrow);
}

export const isCompleted = (t: FieldTrip): boolean =>
  t.phase === 'returned' ||
  Boolean(t.returnedAt) ||
  String(t.schedule?.status || '').toLowerCase() === 'delivered';
export const tripPhaseLabel = (t: FieldTrip): string => isCompleted(t) ? 'Selesai' : t.phase === 'going' ? 'Dalam perjalanan' : 'Belum berangkat';

export function freshGps(): Promise<{ latitude: number; longitude: number; accuracy: number }> {
  return new Promise((resolve, reject) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      reject(new Error('GPS tidak tersedia pada perangkat ini.'));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      p => resolve({ latitude: p.coords.latitude, longitude: p.coords.longitude, accuracy: p.coords.accuracy }),
      e => reject(new Error(e.code === 1 ? 'Izin lokasi ditolak. Aktifkan GPS untuk melanjutkan.' :
        'Lokasi belum bisa dibaca. Periksa GPS lalu coba lagi.')),
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 }
    );
  });
}
