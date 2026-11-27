import type { Express } from 'express';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { getDbPool, isDatabaseConfigured } from './db';
import { validateCameraEvidence } from '../src/components/crew/crewCaptureEvidence';
/* AKK_CREW_CAPTURE_V68 */

/**
 * V65 crew slot ownership API. This is deliberately separate from the generic
 * schedule-snapshot writer: SELECT ... FOR UPDATE makes two phones claiming the
 * same position serialize on the actual MySQL row, not on browser localStorage.
 * The actor is ALWAYS the authenticated session, never a userId from the body.
 */
interface CrewApiOptions {
  requireAuth: any;
  onSchedulesChanged: (payload: any) => void;
  saveReport: (report: any) => Promise<void>;
  getReports: () => Promise<any[]>;
  getSchedulesPayload?: () => Promise<any> | any;
  resolveFleetInfo?: (trip: any) => Promise<{
    fleetId?: string;
    plateNumber: string;
    vehicleType?: string;
    initialCode?: string;
    fuelLevelPercent?: number;
  }>;
  syncFleetChecklist?: (params: {
    trip: any;
    actor: any;
    checklist: any[];
    odometerKm: number;
    now: string;
  }) => Promise<void>;
  upsertDepartureShift?: (params: {
    trip: any;
    action: 'depart' | 'arrive';
    actor: any;
    now: string;
    gps: { latitude: number; longitude: number; accuracy: number };
  }) => Promise<void>;
}

type Position = 'driver' | 'helper';
const MAX_REPORT_EVENTS = 180;
const ALLOWED_CREW_ROLES = new Set(['driver', 'crew_helper']);
const isPreviewRuntime = Boolean(process.env.K_SERVICE) || process.env.NODE_ENV !== 'production';
const APP_STATE_PATH = path.join(process.cwd(), 'data', 'server_app_state.json');

let localMutationQueue: Promise<void> = Promise.resolve();
const runSerializedLocal = async <T>(fn: () => Promise<T> | T): Promise<T> => {
  const prev = localMutationQueue;
  let release!: () => void;
  localMutationQueue = new Promise<void>(resolve => { release = resolve; });
  await prev;
  try {
    return await fn();
  } finally {
    release();
  }
};

const readLocalAppState = (key: string): any | null => {
  try {
    if (!fs.existsSync(APP_STATE_PATH)) return null;
    const raw = JSON.parse(fs.readFileSync(APP_STATE_PATH, 'utf8'));
    return key in raw ? raw[key] : null;
  } catch {
    return null;
  }
};

const writeLocalAppState = (key: string, value: any): void => {
  try {
    const dir = path.dirname(APP_STATE_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    let data: Record<string, any> = {};
    if (fs.existsSync(APP_STATE_PATH)) {
      try { data = JSON.parse(fs.readFileSync(APP_STATE_PATH, 'utf8')); } catch {}
    }
    data[key] = value;
    data[`${key}_updated_at`] = new Date().toISOString();
    fs.writeFileSync(APP_STATE_PATH, JSON.stringify(data, null, 2), 'utf8');
  } catch {}
};

const jsonValue = (raw: unknown): any => {
  if (!raw) return null;
  if (typeof raw === 'object') return raw;
  try { return JSON.parse(String(raw)); } catch { return null; }
};
const clean = (value: unknown) => String(value ?? '').trim();
const ident = (value: unknown) => clean(value).toLocaleLowerCase('id-ID').replace(/^(?:(?:crw|usr)-)+/, '');

function tripDayKey(s: any): string {
  const deliv = clean(s?.deliveryDate);
  if (/^\d{4}-\d{2}-\d{2}/.test(deliv)) return deliv.slice(0, 10);
  const dep = clean(s?.departureDate);
  if (!dep) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(dep)) return dep;
  const d = new Date(dep);
  if (!Number.isNaN(d.getTime())) {
    return d.toLocaleDateString('sv-SE', { timeZone: 'Asia/Jakarta' });
  }
  return dep.slice(0, 10);
}

function scheduleBranch(schedule: any): string | null {
  const direct = clean(schedule?.originBranchId || schedule?.branchId);
  if (direct === 'cab-sidoarjo' || direct === 'cab-banyuwangi') return direct;
  const origin = clean(schedule?.originName).toLowerCase();
  if (/sidoarjo|surabaya/.test(origin)) return 'cab-sidoarjo';
  if (/nusantara|banyuwangi/.test(origin)) return 'cab-banyuwangi';
  const fleetBranch = clean(schedule?.fleet?.branchId);
  if (fleetBranch === 'cab-sidoarjo' || fleetBranch === 'cab-banyuwangi') return fleetBranch;
  return null; // Never silently assume Nusantara for unknown origin.
}

function branchAllowed(
  actor: any,
  branchId: string,
  write = false,
  branchStateUserPerms?: Record<string, any> | null
): boolean {
  if (!branchId) return false;
  if (actor?.role === 'super_admin') return true;
  const permissions = jsonValue(actor?.permissions_json ?? actor?.permissions) || {};
  const rawPerBranch = permissions.branchPermissions;
  const hasActorPerBranch = Boolean(rawPerBranch && typeof rawPerBranch === 'object' && Object.keys(rawPerBranch).length > 0);
  const hasStatePerBranch = Boolean(branchStateUserPerms && typeof branchStateUserPerms === 'object' && Object.keys(branchStateUserPerms).length > 0);
  const perBranch = hasActorPerBranch ? rawPerBranch : (hasStatePerBranch ? branchStateUserPerms : null);
  const isCrewRole = ALLOWED_CREW_ROLES.has(String(actor?.role || ''));

  if (perBranch) {
    const entry = perBranch[branchId];
    if (entry && typeof entry === 'object') {
      if (!entry.enabled) return false;
      if (entry.allAccess) return true;
      const logistics = entry.modules?.logistics ?? permissions.modules?.logistics;
      if (!logistics) return isCrewRole;
      if (!logistics.enabled) return false;
      const dp = logistics.subMenus?.driver_portal;
      const pd = logistics.subMenus?.portal_driver;
      const levels = [dp, pd];
      if (levels.includes('full_access') || (!write && levels.includes('read_only'))) return true;
      if (isCrewRole && dp !== 'none' && pd !== 'none') return true;
      return false;
    }
    const anyOtherEnabled = Object.entries(perBranch).some(([k, v]: [string, any]) => k !== branchId && Boolean(v?.enabled));
    if (anyOtherEnabled) return false;
  }

  // Fallback untuk akun Driver/Helper yang baru disetujui atau belum pernah disimpan ulang per-cabang (selaras dengan default branchStore: cab-banyuwangi)
  if (branchId !== 'cab-banyuwangi') return false;
  const legacyLogistics = permissions.modules?.logistics;
  if (legacyLogistics && typeof legacyLogistics === 'object') {
    if (!legacyLogistics.enabled) return false;
    const dp = legacyLogistics.subMenus?.driver_portal;
    const pd = legacyLogistics.subMenus?.portal_driver;
    const levels = [dp, pd];
    if (levels.includes('full_access') || (!write && levels.includes('read_only'))) return true;
    if (isCrewRole && dp !== 'none' && pd !== 'none') return true;
    return false;
  }
  return isCrewRole && String(actor?.status || '').toLowerCase() === 'approved';
}

const isFilledSlotValue = (v: unknown) =>
  Boolean(clean(v) && !/^(?:-|none|pending|tbd|drv-pending|crew-driver-tbd)$/i.test(clean(v)));

function getPortalSlotMember(schedule: any, slot: Position): { id: string; name: string; crewObj?: any } | null {
  if (!schedule || typeof schedule !== 'object') return null;
  const portalId = slot === 'driver' ? schedule.portalCrewId : schedule.portalCrewHelperId;
  const portalCrew = slot === 'driver' ? schedule.portalCrew : schedule.portalCrewHelper;
  if (isFilledSlotValue(portalId) || isFilledSlotValue(portalCrew?.id)) {
    const id = clean(portalCrew?.id || portalId);
    const name = clean(portalCrew?.name);
    return { id, name, crewObj: portalCrew && typeof portalCrew === 'object' ? portalCrew : undefined };
  }
  const audit = Array.isArray(schedule.crewClaimAudit) ? schedule.crewClaimAudit : [];
  const claimed = [...audit].reverse().find((entry: any) => entry?.slot === slot && clean(entry?.actorId));
  if (!claimed) return null;
  const legacyId = slot === 'driver' ? schedule.crewId : schedule.crewHelperId;
  const legacyCrew = slot === 'driver' ? schedule.crew : schedule.crewHelper;
  if (isFilledSlotValue(legacyId) || isFilledSlotValue(legacyCrew?.id)) {
    const id = clean(legacyCrew?.id || legacyId);
    const name = clean(legacyCrew?.name || claimed.actorName);
    return { id, name, crewObj: legacyCrew && typeof legacyCrew === 'object' ? legacyCrew : undefined };
  }
  return {
    id: `crw-${clean(claimed.actorId)}`,
    name: clean(claimed.actorName) || 'Kru AKK'
  };
}

function sanitizeScheduleForPortal(schedule: any): any {
  const portalDriver = getPortalSlotMember(schedule, 'driver');
  const portalHelper = getPortalSlotMember(schedule, 'helper');
  return {
    ...schedule,
    crewId: portalDriver ? portalDriver.id : '',
    crew: portalDriver
      ? portalDriver.crewObj || { id: portalDriver.id, name: portalDriver.name || 'Driver' }
      : undefined,
    crewHelperId: portalHelper ? portalHelper.id : undefined,
    crewHelper: portalHelper
      ? portalHelper.crewObj || { id: portalHelper.id, name: portalHelper.name || 'Helper' }
      : undefined,
    crewHelper2Id: undefined,
    crewHelper2: undefined,
    backupCrewId: undefined,
    backupCrewName: undefined,
    backupPosition: undefined,
    backupTargetName: undefined
  };
}

function currentCrewPosition(schedule: any, actor: any): Position | null {
  const mine = ident(actor?.id);
  const name = clean(actor?.full_name || actor?.fullName).toLocaleLowerCase('id-ID');
  const match = (member: { id: string; name: string } | null) => {
    if (!member) return false;
    const sourceId = ident(member.id);
    return Boolean(mine.length >= 3 && sourceId === mine) ||
      Boolean(name.length >= 4 && clean(member.name).toLocaleLowerCase('id-ID') === name);
  };
  if (match(getPortalSlotMember(schedule, 'driver'))) return 'driver';
  if (match(getPortalSlotMember(schedule, 'helper'))) return 'helper';
  return null;
}

function requiredActor(req: any, res: any): any | null {
  const actor = req.authUser;
  if (!actor || !ALLOWED_CREW_ROLES.has(String(actor.role)) || actor.status !== 'approved') {
    res.status(403).json({ success: false, error: 'Akun Driver atau Helper yang disetujui diperlukan.' });
    return null;
  }
  return actor;
}

function checkLocation(input: unknown) {
  const p = input && typeof input === 'object' ? input as any : null;
  const latitude = Number(p?.latitude), longitude = Number(p?.longitude), accuracy = Number(p?.accuracy);
  if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90 ||
      !Number.isFinite(longitude) || longitude < -180 || longitude > 180 ||
      !Number.isFinite(accuracy) || accuracy <= 0 || accuracy > 5000) return null;
  return { latitude, longitude, accuracy };
}

const REQUIRED_VEHICLE_CHECKLIST = [
  { key: 'oli_mesin', label: 'Oli Mesin', requiresPhoto: true, options: ['Normal', 'Tidak Normal'] },
  { key: 'air_radiator', label: 'Air Radiator', requiresPhoto: true, options: ['Normal', 'Tidak Normal'] },
  { key: 'air_aki', label: 'Air Aki', requiresPhoto: false, options: ['Normal', 'Tidak Normal'] },
  { key: 'rem_minyak_rem', label: 'Rem Mobil & Minyak Rem', requiresPhoto: true, options: ['Normal', 'Tidak Normal'] },
  { key: 'kebersihan_kabin', label: 'Kebersihan Kabin', requiresPhoto: true, options: ['Bersih', 'Tidak'] },
  { key: 'inventaris_mobil', label: 'Inventaris Mobil', requiresPhoto: false, options: ['Normal', 'Tidak Normal'] },
  { key: 'ban_cadangan', label: 'Ban Cadangan', requiresPhoto: false, options: ['Ada', 'Tidak Ada'] }
] as const;

function validateAndNormalizeChecklist(raw: unknown) {
  if (!Array.isArray(raw)) {
    throw Object.assign(new Error('Pemeriksaan armada wajib diisi lengkap.'), { status: 422 });
  }
  const byKey = new Map<string, any>();
  for (const item of raw) {
    if (item && typeof item === 'object' && typeof (item as any).key === 'string') {
      byKey.set((item as any).key, item);
    }
  }
  const missingPhotos: string[] = [];
  const unselected: string[] = [];
  const normalized: any[] = [];
  for (const def of REQUIRED_VEHICLE_CHECKLIST) {
    const entry = byKey.get(def.key);
    const chosen = clean(entry?.status);
    if (!(def.options as readonly string[]).includes(chosen)) {
      unselected.push(def.label);
      continue;
    }
    if (def.requiresPhoto) {
      const photo = typeof entry.photo === 'string' ? entry.photo.trim() : '';
      if (!/^data:image\/(jpeg|png|webp);base64,/i.test(photo) || photo.length < 80) {
        missingPhotos.push(def.label);
        continue;
      }
      if (photo.length > 3_500_000) {
        throw Object.assign(new Error(`Foto ${def.label} terlalu besar.`), { status: 413 });
      }
      const itemGps = checkLocation(entry.gps) || undefined;
      normalized.push({
        key: def.key,
        label: def.label,
        status: chosen,
        checked: true,
        requiresPhoto: true,
        photo,
        photoAttached: true,
        capturedAt: clean(entry.capturedAt) || new Date().toISOString(),
        ...(itemGps ? { gps: itemGps } : {})
      });
    } else {
      normalized.push({
        key: def.key,
        label: def.label,
        status: chosen,
        checked: true,
        requiresPhoto: false
      });
    }
  }
  if (missingPhotos.length > 0) {
    throw Object.assign(new Error(`Foto bukti wajib belum lengkap: ${missingPhotos.join(', ')}.`), { status: 422 });
  }
  if (unselected.length > 0) {
    throw Object.assign(new Error(`Pilihan pemeriksaan belum diisi: ${unselected.join(', ')}.`), { status: 422 });
  }
  return normalized;
}

const DEPARTURE_SIGNATURE_KEYS = ['spvLogistik', 'spvOperasional', 'security', 'crew'] as const;

function validateAndNormalizeDepartureForm(raw: unknown, trip: any, actor: any, now: string, gps: { latitude: number; longitude: number; accuracy: number }) {
  if (!raw || typeof raw !== 'object') {
    throw Object.assign(new Error('Form Keluar beserta 4 tanda tangan digital wajib dilengkapi.'), { status: 422 });
  }
  const input = raw as any;
  const signatures: Record<string, string> = {};
  for (const key of DEPARTURE_SIGNATURE_KEYS) {
    const val = typeof input.signatures?.[key] === 'string' ? input.signatures[key].trim() : '';
    if (!/^data:image\/(png|jpeg|webp);base64,/i.test(val) || val.length < 120) {
      throw Object.assign(new Error('Seluruh 4 kotak tanda tangan (SPV Logistik, SPV Operasional, Security, Driver/Helper) wajib diisi.'), { status: 422 });
    }
    if (val.length > 500_000) {
      throw Object.assign(new Error('Ukuran gambar tanda tangan terlalu besar.'), { status: 413 });
    }
    signatures[key] = val;
  }
  const wibTime = new Date(now).toLocaleTimeString('id-ID', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Jakarta',
    hour12: false
  }).replace('.', ':');
  const wibDate = new Date(now).toLocaleDateString('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: 'Asia/Jakarta'
  });
  const branchRaw = clean(input.summary?.branchName) || (scheduleBranch(trip) === 'cab-sidoarjo' ? 'Cabang Sidoarjo' : 'Cabang Nusantara');
  const depTimeRaw = clean(input.summary?.departureTime) || clean(trip?.departureTime) || wibTime;
  return {
    summary: {
      branchName: branchRaw,
      driverName: clean(input.summary?.driverName) || clean(trip?.portalCrew?.name || trip?.crew?.name) || '-',
      helperName: clean(input.summary?.helperName) || clean(trip?.portalCrewHelper?.name || trip?.crewHelper?.name) || '-',
      fleetLabel: clean(input.summary?.fleetLabel) || clean(trip?.fleet?.initialCode || trip?.armada || trip?.fleet?.plateNumber) || '-',
      departureTime: depTimeRaw,
      areaName: clean(input.summary?.areaName) || clean(trip?.areaName || trip?.store?.storeName) || '-',
      recordedAt: now,
      recordedAtWib: clean(input.summary?.recordedAtWib) || `${wibTime} WIB · ${wibDate}`
    },
    signerSelections: input.signerSelections && typeof input.signerSelections === 'object'
      ? {
          spvLogistik: clean(input.signerSelections.spvLogistik),
          spvOperasional: clean(input.signerSelections.spvOperasional),
          security: clean(input.signerSelections.security),
          crew: clean(input.signerSelections.crew)
        }
      : undefined,
    signatures,
    signedAt: now,
    signedBy: clean(actor?.full_name || actor?.fullName) || 'Kru AKK',
    gps
  };
}

export function registerCrewClaimRoutes(app: Express, opts: CrewApiOptions): void {
  const readBranchStateUserPerms = async (userId: string): Promise<Record<string, any> | null> => {
    if (!userId) return null;
    try {
      let state: any = null;
      if (isDatabaseConfigured()) {
        const pool = getDbPool();
        const [rows] = await pool.execute('SELECT state_json FROM app_state WHERE state_key=? LIMIT 1', ['branch_state_payload']);
        state = jsonValue((rows as any[])[0]?.state_json);
      } else if (isPreviewRuntime) {
        state = readLocalAppState('branch_state_payload');
      }
      const map = state?.userBranchPerms;
      if (map && typeof map === 'object' && map[userId] && typeof map[userId] === 'object') {
        return map[userId];
      }
    } catch {}
    return null;
  };

  const readSchedulesPayload = async (): Promise<any> => {
    if (isDatabaseConfigured()) {
      const pool = getDbPool();
      const [rows] = await pool.execute('SELECT state_json FROM app_state WHERE state_key=? LIMIT 1', ['schedules_payload']);
      return jsonValue((rows as any[])[0]?.state_json) || {};
    }
    if (!isPreviewRuntime) throw Object.assign(new Error('Database belum siap.'), { status: 503 });
    const fromMemory = opts.getSchedulesPayload ? await opts.getSchedulesPayload() : null;
    if (fromMemory && typeof fromMemory === 'object') return fromMemory;
    return readLocalAppState('schedules_payload') || {};
  };

  const mutateSchedulesPayload = async <T>(
    mutator: (payload: any, conn: any | null) => Promise<T> | T
  ): Promise<{ payload: any; result: T }> => {
    if (isDatabaseConfigured()) {
      let conn: any;
      try {
        conn = await getDbPool().getConnection();
        await conn.beginTransaction();
        const [rows] = await conn.execute('SELECT state_json FROM app_state WHERE state_key=? LIMIT 1 FOR UPDATE', ['schedules_payload']);
        const payload = jsonValue((rows as any[])[0]?.state_json);
        if (!payload || !Array.isArray(payload.schedules)) throw Object.assign(new Error('Jadwal belum tersedia.'), { status: 404 });
        const result = await mutator(payload, conn);
        await conn.execute('UPDATE app_state SET state_json=?,updated_at=NOW() WHERE state_key=?', [JSON.stringify(payload), 'schedules_payload']);
        await conn.commit();
        opts.onSchedulesChanged(payload);
        return { payload, result };
      } catch (error) {
        if (conn) try { await conn.rollback(); } catch {}
        throw error;
      } finally {
        if (conn) conn.release();
      }
    }
    if (!isPreviewRuntime) throw Object.assign(new Error('Database belum siap.'), { status: 503 });
    return runSerializedLocal(async () => {
      const fromMemory = opts.getSchedulesPayload ? await opts.getSchedulesPayload() : null;
      const source = (fromMemory && typeof fromMemory === 'object' ? fromMemory : null) || readLocalAppState('schedules_payload');
      const payload = source && Array.isArray(source.schedules) ? JSON.parse(JSON.stringify(source)) : null;
      if (!payload || !Array.isArray(payload.schedules)) throw Object.assign(new Error('Jadwal belum tersedia.'), { status: 404 });
      const result = await mutator(payload, null);
      writeLocalAppState('schedules_payload', payload);
      opts.onSchedulesChanged(payload);
      return { payload, result };
    });
  };

  app.get('/api/crew-assignments', opts.requireAuth, async (req: any, res: any) => {
    /* AKK_CREW_MONITOR_V70 */
    const actor = req.authUser;
    if (!actor || actor.status !== 'approved') {
      return res.status(403).json({ success: false, error: 'Akun yang disetujui diperlukan.' });
    }
    if (!ALLOWED_CREW_ROLES.has(String(actor.role)) && actor.role !== 'super_admin' &&
        !['cab-sidoarjo', 'cab-banyuwangi'].some(branch => branchAllowed(actor, branch, false))) {
      return res.status(403).json({ success: false, error: 'Akses Portal Driver tidak tersedia.' });
    }
    if (!isDatabaseConfigured() && !isPreviewRuntime) return res.status(503).json({ success: false, error: 'Database belum siap.' });
    try {
      const [payload, actorBranchStatePerms] = await Promise.all([
        readSchedulesPayload(),
        readBranchStateUserPerms(clean(actor.id))
      ]);
      const schedules = Array.isArray(payload.schedules) ? payload.schedules : [];
      const earliest = Date.now() - 95 * 86400000, latest = Date.now() + 65 * 86400000;
      const checkBranch = (branch: string) => branchAllowed(actor, branch, false, actorBranchStatePerms);
      const ownBranch = schedules.filter((s: any) => {
        const branch = scheduleBranch(s);
        // V70 prebuild anchor: branchAllowed(actor, branch)
        if (!branch || !checkBranch(branch)) return false;
        // Do not hide an unfinished assignment merely because it is outside the normal date window.
        if (ALLOWED_CREW_ROLES.has(String(actor.role)) && clean(s.status).toLowerCase() !== 'delivered' && currentCrewPosition(s, actor)) return true;
        const date = new Date(s.departureDate || s.deliveryDate || 0).getTime();
        return date > earliest && date < latest;
      });
      const allowedIds = new Set(ownBranch.map((row: any) => clean(row.id)));
      const byTracking = new Map(ownBranch.filter((row: any) => clean(row.trackingNumber)).map((row: any) => [clean(row.trackingNumber), clean(row.id)]));
      const allReports = await opts.getReports();
      const reportMeta = (Array.isArray(allReports) ? allReports : [])
        .filter((r: any) => {
          const scheduleId = clean(r.scheduleId);
          const tracking = clean(r.trackingNumber);
          return scheduleId ? allowedIds.has(scheduleId) : Boolean(tracking && byTracking.has(tracking));
        })
        .slice(0, 300)
        .map((r: any) => ({
          id: r.id, scheduleId: clean(r.scheduleId) || byTracking.get(clean(r.trackingNumber)),
          type: r.reportType || r.type, note: r.notes || r.note || '',
          by: r.actorName || r.driverName || '', at: r.timestamp || r.createdAt || '',
          photoAttached: Boolean(r.photoUrl || r.photos?.length),
          gps: r.gpsLatitude != null && r.gpsLongitude != null ? {
            latitude: Number(r.gpsLatitude), longitude: Number(r.gpsLongitude), accuracy: Number(r.gpsAccuracy || 0)
          } : undefined
        }));
      const isSuperAdmin = String(actor.role || '') === 'super_admin';
      const portalSchedules = ownBranch.map((row: any) => {
        const sanitized = sanitizeScheduleForPortal(row);
        if (isSuperAdmin) return sanitized;
        const compactEvents = Array.isArray(sanitized.crewFieldEvents)
          ? sanitized.crewFieldEvents.slice(-10)
          : undefined;
        const compactChecklist = Array.isArray(sanitized.crewInspectionChecklist)
          ? sanitized.crewInspectionChecklist.map((c: any) =>
              c && typeof c === 'object' ? { ...c, photo: undefined } : c
            )
          : undefined;
        const compactDeparture = sanitized.departureValidation && typeof sanitized.departureValidation === 'object'
          ? {
              ...sanitized.departureValidation,
              signatures: undefined,
              signaturesAttached: Boolean(sanitized.departureValidation.signatures)
            }
          : undefined;
        return {
          ...sanitized,
          crewFieldEvents: compactEvents,
          crewInspectionChecklist: compactChecklist,
          departureValidation: compactDeparture,
          podPhotoUrl: undefined
        };
      });
      return res.json({ success: true, schedules: portalSchedules, reports: reportMeta });
    } catch (error: any) { return res.status(Number(error?.status) || 503).json({ success: false, error: 'Jadwal tidak dapat dibaca dari database.' }); }
  });

  app.post('/api/crew-assignments/:id/claim', opts.requireAuth, async (req: any, res: any) => {
    const actor = requiredActor(req, res);
    if (!actor) return;
    if (req.body?.confirmed !== true) return res.status(400).json({ success: false, error: 'Konfirmasi pengambilan kiriman diperlukan. Muat ulang aplikasi.' });
    const slot: Position = req.body?.slot;
    if (slot !== 'driver' && slot !== 'helper') return res.status(400).json({ success: false, error: 'Pilih Driver atau Helper.' });
    if (!isDatabaseConfigured() && !isPreviewRuntime) return res.status(503).json({ success: false, error: 'Database belum siap.' });
    try {
      const actorBranchStatePerms = await readBranchStateUserPerms(clean(actor.id));
      const { result } = await mutateSchedulesPayload(async (payload, conn) => {
        const trip = payload.schedules.find((s: any) => clean(s?.id) === clean(req.params.id));
        if (!trip) throw Object.assign(new Error('Kiriman tidak ditemukan.'), { status: 404 });
        const branchId = scheduleBranch(trip);
        if (!branchId || !branchAllowed(actor, branchId, true, actorBranchStatePerms)) throw Object.assign(new Error('Cabang kiriman tidak sesuai akses akun.'), { status: 403 });
        if (String(trip.status || 'scheduled') !== 'scheduled') throw Object.assign(new Error('Kiriman sudah berangkat atau selesai.'), { status: 409 });
        if (currentCrewPosition(trip, actor)) throw Object.assign(new Error('Kamu sudah terdaftar pada kiriman ini.'), { status: 409 });
      /* AKK_CREW_LOCK_V71 */
      // Scan the complete locked payload, across branches and dates. A change
      // from Driver to Helper does not release an existing assignment.
      const activeElsewhere = payload.schedules.some((other: any) =>
        other && clean(other.id) !== clean(trip.id) &&
        clean(other.status).toLowerCase() !== 'delivered' &&
        Boolean(currentCrewPosition(other, actor)));
      if (activeElsewhere) throw Object.assign(new Error('Selesaikan kiriman aktif sebelum mengambil kiriman lain.'), { status: 409 });
        const tripDay = tripDayKey(trip);
        if (tripDay) {
          const sameDayClaimed = payload.schedules.some((other: any) =>
            other && clean(other.id) !== clean(trip.id) &&
            tripDayKey(other) === tripDay &&
            Boolean(currentCrewPosition(other, actor)));
          if (sameDayClaimed) {
            throw Object.assign(new Error('Sudah memilih kiriman pada hari ini. Reset oleh Super Admin diperlukan untuk mengganti.'), { status: 409 });
          }
        }
        const idKey = slot === 'driver' ? 'crewId' : 'crewHelperId';
        const crewKey = slot === 'driver' ? 'crew' : 'crewHelper';
        const portalIdKey = slot === 'driver' ? 'portalCrewId' : 'portalCrewHelperId';
        const portalCrewKey = slot === 'driver' ? 'portalCrew' : 'portalCrewHelper';
        const assigned = Boolean(getPortalSlotMember(trip, slot));
        if (assigned) throw Object.assign(new Error(`Slot ${slot === 'driver' ? 'Driver' : 'Helper'} sudah diambil.`), { status: 409 });
        const actorId = clean(actor.id);
        const actorName = clean(actor.full_name || actor.fullName);
        if (!actorId || !actorName) throw Object.assign(new Error('Profil akun belum lengkap.'), { status: 403 });
        const crew = {
          id: `crw-${actorId}`, name: actorName, phone: clean(actor.phone),
          role: slot === 'driver' ? 'Driver' : 'Kernet / Helper',
          licenseNumber: '-', licenseType: '-', status: 'available', tripsCompleted: 0, rating: 0,
          branchId
        };
        const now = new Date().toISOString();
        trip[portalIdKey] = crew.id;
        trip[portalCrewKey] = crew;
        trip[idKey] = crew.id;
        trip[crewKey] = crew;
        trip.originBranchId = branchId;
        trip.crewClaimVersion = Number(trip.crewClaimVersion || 0) + 1;
        trip.crewClaimAudit = Array.isArray(trip.crewClaimAudit) ? trip.crewClaimAudit.slice(-29) : [];
        trip.crewClaimAudit.push({ slot, at: now, actorId, actorName });
        trip.updatedAt = now;
        payload.updatedAt = now;
        if (conn) {
          await conn.execute('UPDATE schedules SET crew_id=?,crew_helper_id=?,payload_json=?,updated_at=NOW() WHERE id=?',
            [trip.crewId || null, trip.crewHelperId || null, JSON.stringify(trip), trip.id]);
        }
        return { scheduleId: trip.id, slot, crew: { id: crew.id, name: crew.name }, version: trip.crewClaimVersion };
      });
      return res.json({ success: true, ...result });
    } catch (error: any) {
      const status = Number(error?.status) || 503;
      return res.status(status).json({ success: false, error: status === 503 ? 'Gagal mengunci slot kiriman. Coba lagi.' : error.message });
    }
  });

  app.post('/api/crew-assignments/:id/action', opts.requireAuth, async (req: any, res: any) => {
    const actor = requiredActor(req, res);
    if (!actor) return;
    const action = req.body?.action;
    if (action !== 'depart' && action !== 'arrive') return res.status(400).json({ success: false, error: 'Aksi tidak dikenal.' });
    const gps = checkLocation(req.body?.gps);
    if (!gps) return res.status(422).json({ success: false, error: 'GPS aktual diperlukan. Aktifkan izin lokasi.' });
    if (!isDatabaseConfigured() && !isPreviewRuntime) return res.status(503).json({ success: false, error: 'Database belum siap.' });
    try {
      const { result } = await mutateSchedulesPayload(async (payload, conn) => {
        const trip = payload.schedules.find((s: any) => clean(s?.id) === clean(req.params.id));
        if (!trip) throw Object.assign(new Error('Kiriman tidak ditemukan.'), { status: 404 });
        const branchId = scheduleBranch(trip);
        if (!branchId || !branchAllowed(actor, branchId, true)) throw Object.assign(new Error('Akses cabang tidak sesuai.'), { status: 403 });
        const role = currentCrewPosition(trip, actor);
        if (!role) throw Object.assign(new Error('Kamu belum terdaftar di kiriman ini.'), { status: 403 });
        if (!trip.crewId || !trip.crewHelperId) throw Object.assign(new Error('Driver dan Helper harus lengkap.'), { status: 409 });
        const currentStatus = String(trip.status || 'scheduled');
        if (action === 'depart' && currentStatus !== 'scheduled') throw Object.assign(new Error('Kiriman sudah berangkat.'), { status: 409 });
        if (action === 'depart' && (!trip.crewOdometerStart || !trip.crewInspectionDone || !trip.crewWaybillValidated)) {
          throw Object.assign(new Error('Selesaikan KM awal, cek kendaraan, dan validasi SJ dahulu.'), { status: 409 });
        }
        if (action === 'arrive' && currentStatus !== 'in_transit' && currentStatus !== 'picked_up') throw Object.assign(new Error('Kiriman belum berangkat atau sudah selesai.'), { status: 409 });
        const now = new Date().toISOString();
        trip.status = action === 'depart' ? 'in_transit' : 'delivered';
        if (action === 'depart') trip.actualDeparture = now;
        else trip.actualArrival = now;
        trip.crewFieldEvents = (Array.isArray(trip.crewFieldEvents) ? trip.crewFieldEvents : []).slice(-(MAX_REPORT_EVENTS - 1));
        trip.crewFieldEvents.push({ action, actorId: clean(actor.id), actorName: clean(actor.full_name), position: role, gps, at: now });
        trip.updatedAt = now;
        payload.updatedAt = now;
        if (conn) {
          await conn.execute('UPDATE schedules SET status=?,actual_arrival=?,payload_json=?,updated_at=NOW() WHERE id=?',
            [trip.status, trip.actualArrival ? new Date(trip.actualArrival).toISOString().slice(0, 19).replace('T', ' ') : null, JSON.stringify(trip), trip.id]);
        }
        return { scheduleId: trip.id, action, status: trip.status, at: now, gpsAccuracy: gps.accuracy, tripSnapshot: JSON.parse(JSON.stringify(trip)) };
      });
      if (opts.upsertDepartureShift && result.tripSnapshot) {
        const snapshot = result.tripSnapshot;
        const actionAt = result.at;
        setImmediate(() => {
          void opts.upsertDepartureShift!({
            trip: snapshot,
            action,
            actor,
            now: actionAt,
            gps
          }).catch(err => console.warn('[Crew Shift Sync Warning]', err?.message || err));
        });
      }
      const { tripSnapshot: _omitTripSnapshot, ...clientResult } = result;
      return res.json({ success: true, ...clientResult });
    } catch (error: any) {
      const status = Number(error?.status) || 503;
      return res.status(status).json({ success: false, error: status === 503 ? 'Perubahan status gagal disimpan.' : error.message });
    }
  });

  app.post('/api/crew-assignments/:id/task', opts.requireAuth, async (req: any, res: any) => {
    const actor = requiredActor(req, res);
    if (!actor) return;
    const task = clean(req.body?.action);
    if (!['km', 'km_end', 'inspection', 'waybill'].includes(task)) return res.status(400).json({ success: false, error: 'Tugas tidak dikenal.' });
    const gps = checkLocation(req.body?.gps);
    if (!gps) return res.status(422).json({ success: false, error: 'Lokasi GPS aktual wajib diperoleh sebelum menyimpan.' });
    if (!isDatabaseConfigured() && !isPreviewRuntime) return res.status(503).json({ success: false, error: 'Database belum terhubung.' });
    try {
      const { result } = await mutateSchedulesPayload(async (payload, conn) => {
        const trip = payload.schedules.find((s: any) => clean(s?.id) === clean(req.params.id));
        if (!trip) throw Object.assign(new Error('Kiriman tidak ditemukan.'), { status: 404 });
        const branch = scheduleBranch(trip);
        if (!branch || !branchAllowed(actor, branch, true)) throw Object.assign(new Error('Akses cabang ditolak.'), { status: 403 });
        const slot = currentCrewPosition(trip, actor);
        if (!slot) throw Object.assign(new Error('Belum mengambil posisi pada kiriman ini.'), { status: 403 });
        const tripStatusLower = String(trip.status || 'scheduled').toLowerCase();
        const hasArrived =
          tripStatusLower === 'delivered' ||
          tripStatusLower === 'completed' ||
          tripStatusLower === 'returned' ||
          Boolean(trip.actualArrival);
        if (task === 'km_end') {
          if (!hasArrived) {
            throw Object.assign(new Error('KM akhir hanya dapat diisi setelah Driver menekan Tiba di Gudang.'), { status: 409 });
          }
        } else if (tripStatusLower !== 'scheduled') {
          throw Object.assign(new Error('Persiapan hanya bisa dicatat sebelum berangkat.'), { status: 409 });
        }
        const now = new Date().toISOString();
        let normalizedChecklist: any[] | undefined;
        if (task === 'km') {
          if (slot !== 'driver') throw Object.assign(new Error('KM awal hanya tugas Driver.'), { status: 403 });
          const value = Number(req.body.value);
          if (!Number.isFinite(value) || value <= 0 || value > 99999999) throw Object.assign(new Error('KM awal tidak valid.'), { status: 400 });
          if (trip.crewOdometerStart) throw Object.assign(new Error('KM awal sudah tercatat, tidak bisa diubah dari akun kru.'), { status: 409 });
          trip.crewOdometerStart = String(value);
        } else if (task === 'km_end') {
          if (slot !== 'driver') throw Object.assign(new Error('KM akhir hanya tugas Driver.'), { status: 403 });
          const value = Number(req.body.value);
          if (!Number.isFinite(value) || value <= 0 || value > 99999999) throw Object.assign(new Error('KM akhir tidak valid.'), { status: 400 });
          const startVal = Number(trip.crewOdometerStart || 0);
          if (startVal > 0 && value <= startVal) {
            throw Object.assign(new Error(`KM akhir harus lebih besar dari KM awal (${startVal.toLocaleString('id-ID')} km).`), { status: 400 });
          }
          if (trip.crewOdometerEnd) throw Object.assign(new Error('KM akhir sudah tercatat. Hubungi Admin jika perlu koreksi.'), { status: 409 });
          trip.crewOdometerEnd = String(value);
          trip.crewOdometerEndAt = now;
        } else if (task === 'inspection') {
          if (slot !== 'driver') throw Object.assign(new Error('Checklist kendaraan hanya tugas Driver.'), { status: 403 });
          if (!trip.crewOdometerStart) throw Object.assign(new Error('Isi KM awal terlebih dahulu sebelum mengisi checklist kendaraan.'), { status: 409 });
          normalizedChecklist = validateAndNormalizeChecklist(req.body?.checklist);
          trip.crewInspectionChecklist = normalizedChecklist;
          trip.crewInspectionDone = true;
        } else {
          if (slot !== 'helper') throw Object.assign(new Error('Form Keluar & Surat jalan hanya tugas Helper.'), { status: 403 });
          if (req.body?.departureValidation) {
            trip.departureValidation = validateAndNormalizeDepartureForm(req.body.departureValidation, trip, actor, now, gps);
          }
          trip.crewWaybillValidated = true;
        }
        trip.crewFieldEvents = (Array.isArray(trip.crewFieldEvents) ? trip.crewFieldEvents : []).slice(-(MAX_REPORT_EVENTS - 1));
        trip.crewFieldEvents.push({
          action: task, actorId: clean(actor.id), actorName: clean(actor.full_name), position: slot,
          value: task === 'km' ? trip.crewOdometerStart : task === 'km_end' ? trip.crewOdometerEnd : undefined, gps, at: now
        });
        trip.updatedAt = now;
        payload.updatedAt = now;
        if (conn) {
          await conn.execute('UPDATE schedules SET payload_json=?,updated_at=NOW() WHERE id=?', [JSON.stringify(trip), trip.id]);
        }
        return {
          task,
          at: now,
          normalizedChecklist,
          tripSnapshot: task === 'inspection' ? JSON.parse(JSON.stringify(trip)) : undefined
        };
      });
      if (task === 'inspection' && opts.syncFleetChecklist && result.tripSnapshot && result.normalizedChecklist) {
        const snapshot = result.tripSnapshot;
        const normalizedChecklist = result.normalizedChecklist;
        const taskAt = result.at;
        setImmediate(() => {
          void opts.syncFleetChecklist!({
            trip: snapshot,
            actor,
            checklist: normalizedChecklist,
            odometerKm: Number(snapshot.crewOdometerStart || 0),
            now: taskAt
          }).catch(err => console.warn('[Crew Checklist Sync Warning]', err?.message || err));
        });
      }
      return res.json({ success: true, task: result.task, at: result.at });
    } catch (e: any) {
      const status = Number(e?.status) || 503;
      return res.status(status).json({ success: false, error: status === 503 ? 'Gagal menyimpan tugas di database.' : e.message });
    }
  });

  app.post('/api/crew-assignments/:id/report', opts.requireAuth, async (req: any, res: any) => {
    const actor = requiredActor(req, res);
    if (!actor) return;
    const { report } = req.body || {};
    if (!report || typeof report !== 'object') return res.status(400).json({ success: false, error: 'Isi laporan tidak valid.' });
    const kind = clean(report.reportType || report.type);
    const note = clean(report.notes || report.note);
    if (!['bbm', 'kendala', 'toko', 'retur', 'form_kirim'].includes(kind) || note.length < 3 || note.length > 1200) {
      return res.status(400).json({ success: false, error: 'Jenis atau keterangan laporan tidak valid.' });
    }
    const fuelLocation = kind === 'bbm' ? (clean(report.fuelLocation) || 'Farly') : undefined;
    const fuelUrgentReason = kind === 'bbm' ? clean(report.fuelUrgentReason) : undefined;
    if (kind === 'bbm') {
      if (!['Farly', 'Gajah Mada', 'SPBU Lain (Urgent)'].includes(fuelLocation || '')) {
        return res.status(400).json({ success: false, error: 'Lokasi SPBU wajib dipilih (Farly, Gajah Mada, atau SPBU Lain Urgent).' });
      }
      if (fuelLocation === 'SPBU Lain (Urgent)' && (!fuelUrgentReason || fuelUrgentReason.length < 3 || fuelUrgentReason.length > 400)) {
        return res.status(422).json({ success: false, error: 'Alasan pengisian SPBU Lain (Urgent) wajib diisi minimal 3 huruf.' });
      }
    }
    const customerOutletName = clean(report.customerOutletName).slice(0, 140);
    const invoiceNumber = clean(report.invoiceNumber).slice(0, 80);
    const issueItemName = clean(report.issueItemName).slice(0, 160);
    const issueQty = clean(report.issueQty).slice(0, 60);
    const kendalaSubType = clean(report.kendalaSubType);
    if (kind === 'toko' && customerOutletName.length < 2) {
      return res.status(422).json({ success: false, error: 'Nama pelanggan / toko wajib diisi pada Absen Toko.' });
    }
    if (kind === 'retur' && (!customerOutletName || !issueItemName)) {
      return res.status(422).json({ success: false, error: 'Nama pelanggan dan nama item barang retur wajib diisi.' });
    }
    const gps = checkLocation({ latitude: report.gpsLatitude, longitude: report.gpsLongitude, accuracy: report.gpsAccuracy });
    if (!gps) return res.status(422).json({ success: false, error: 'GPS aktual wajib tersedia.' });
    const rawPhotoUrls = Array.isArray(report.photoUrls) ? report.photoUrls : [];
    const validatedPhotoUrls: string[] = [];
    for (const candidate of rawPhotoUrls.slice(0, 6)) {
      if (typeof candidate !== 'string' || candidate.length < 80 || candidate.length > 3_500_000 || !/^data:image\/(jpeg|png|webp);base64,/i.test(candidate)) {
        return res.status(422).json({ success: false, error: 'Salah satu foto unggahan tidak valid atau terlalu besar.' });
      }
      validatedPhotoUrls.push(candidate);
    }
    const photo = typeof report.photoUrl === 'string' ? report.photoUrl : '';
    const capture = { photo, source: report.photoSource, capturedAt: report.photoCapturedAt, gpsCapturedAt: report.gpsCapturedAt,
      gps: { latitude: report.gpsLatitude, longitude: report.gpsLongitude, accuracy: report.gpsAccuracy } };
    if (kind !== 'form_kirim' || photo) {
      const evidenceError = validateCameraEvidence(capture);
      if (evidenceError) return res.status(422).json({ success: false, error: evidenceError });
    }
    if (photo && (photo.length > 3_500_000 || !/^data:image\/(jpeg|png|webp);base64,/i.test(photo))) {
      return res.status(413).json({ success: false, error: 'Foto terlalu besar atau format tidak didukung.' });
    }
    const finalPhotoUrls = validatedPhotoUrls.length > 0 ? validatedPhotoUrls : (photo ? [photo] : []);
    if (!isDatabaseConfigured() && !isPreviewRuntime) return res.status(503).json({ success: false, error: 'Database belum terhubung.' });
    try {
      const payload = await readSchedulesPayload();
      const trip = (Array.isArray(payload?.schedules) ? payload.schedules : []).find((s: any) => clean(s?.id) === clean(req.params.id));
      if (!trip) return res.status(404).json({ success: false, error: 'Kiriman tidak ditemukan.' });
      const branch = scheduleBranch(trip);
      if (!branch || !branchAllowed(actor, branch, true)) return res.status(403).json({ success: false, error: 'Cabang tidak sesuai akun.' });
      const position = currentCrewPosition(trip, actor);
      if (!position) return res.status(403).json({ success: false, error: 'Belum mengambil posisi pada kiriman.' });
      if (position === 'driver' && ['toko', 'retur', 'form_kirim'].includes(kind) || position === 'helper' && kind === 'bbm') {
        return res.status(403).json({ success: false, error: 'Laporan bukan tugas posisi ini.' });
      }
      const fleetResolved = opts.resolveFleetInfo
        ? await opts.resolveFleetInfo(trip).catch(() => null)
        : null;
      const canonicalPlate = fleetResolved?.plateNumber || trip.fleet?.plateNumber || trip.armada || '-';
      const areaName = trip.areaName || trip.store?.storeName || '-';
      const timestamp = new Date().toISOString();
      const dateStr = new Date(timestamp).toLocaleDateString('sv-SE', { timeZone: 'Asia/Jakarta' });
      const timeWib = new Date(timestamp).toLocaleTimeString('id-ID', {
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'Asia/Jakarta',
        hour12: false
      }).replace('.', ':') + ' WIB';
      const categoryMap: Record<string, string> = {
        bbm: 'isi_bbm',
        kendala: 'kendala_jalan',
        toko: 'istirahat',
        retur: 'retur',
        form_kirim: 'akhir_kiriman'
      };
      const reportNotes =
        kind === 'bbm' && fuelLocation === 'SPBU Lain (Urgent)' && fuelUrgentReason
          ? `[SPBU Lain (Urgent): ${fuelUrgentReason}] ${note}`
          : kind === 'toko' && customerOutletName && !note.includes('[ABSEN KIRIMAN PELANGGAN:')
          ? `[ABSEN KIRIMAN PELANGGAN: ${customerOutletName}] ${note}`
          : note;
      const isAntriQueue = kind === 'kendala' && (kendalaSubType === 'antri_customer' || /antri/i.test(note));
      const row = {
        id: `crew-v65-${crypto.randomUUID()}`, scheduleId: trip.id, deliveryId: trip.id, trackingNumber: trip.trackingNumber,
        reportType: kind, type: kind, category: categoryMap[kind] || 'kendala_jalan',
        userRole: position === 'driver' ? 'Driver' : 'Helper',
        driverId: clean(trip.crew?.id || actor.id),
        driverName: trip.crew?.name || clean(actor.full_name) || '-', helperName: trip.crewHelper?.name || '-',
        userId: clean(actor.id), actorName: clean(actor.full_name),
        plateNumber: canonicalPlate, area: areaName, areaName,
        ...(kind === 'bbm' ? { fuelLocation, ...(fuelUrgentReason ? { fuelUrgentReason } : {}) } : {}),
        ...(customerOutletName ? { customerOutletName } : {}),
        ...(invoiceNumber ? { invoiceNumber } : {}),
        ...(issueItemName ? { issueItemName } : {}),
        ...(issueQty ? { issueQty } : {}),
        ...(isAntriQueue
          ? {
              customerQueueStatus: 'sedang_mengantri',
              customerQueueStartIso: timestamp,
              customerQueueStartFormatted: timeWib
            }
          : {}),
        notes: reportNotes, note: reportNotes, photoUrl: photo || finalPhotoUrls[0] || '', photoUrls: finalPhotoUrls,
        photoSource: photo ? 'camera' : 'manifest_no_photo',
        photoCapturedAt: capture.capturedAt || timestamp, gpsCapturedAt: capture.gpsCapturedAt || timestamp,
        gpsLatitude: gps.latitude, gpsLongitude: gps.longitude, gpsAccuracy: gps.accuracy,
        latitude: gps.latitude, longitude: gps.longitude,
        gmapsUrl: `https://maps.google.com/?q=${gps.latitude},${gps.longitude}`,
        date: dateStr, timestamp,
        status: kind === 'kendala' || kind === 'retur' ? 'pending' : 'verified',
        source: 'crew_v65'
      };
      await opts.saveReport(row);
      return res.json({ success: true, reportId: row.id });
    } catch (error: any) { return res.status(503).json({ success: false, error: 'Laporan gagal disimpan.' }); }
  });

  // Super Admin-only endpoint: resets a claimed/in-progress/delivered portal assignment back to 'scheduled'
  app.post('/api/crew-assignments/:id/reset', opts.requireAuth, async (req: any, res: any) => {
    const actor = req.authUser;
    if (!actor || actor.role !== 'super_admin' || actor.status !== 'approved') {
      return res.status(403).json({ success: false, error: 'Hanya Super Admin yang dapat mereset kiriman.' });
    }
    if (!isDatabaseConfigured() && !isPreviewRuntime) return res.status(503).json({ success: false, error: 'Database belum siap.' });
    try {
      const { result } = await mutateSchedulesPayload(async (payload, conn) => {
        const trip = payload.schedules.find((s: any) => clean(s?.id) === clean(req.params.id));
        if (!trip) throw Object.assign(new Error('Kiriman tidak ditemukan.'), { status: 404 });
        const now = new Date().toISOString();
        trip.crewId = '';
        delete trip.crew;
        delete trip.crewHelperId;
        delete trip.crewHelper;
        delete trip.portalCrewId;
        delete trip.portalCrew;
        delete trip.portalCrewHelperId;
        delete trip.portalCrewHelper;
        delete trip.crewHelper2Id;
        delete trip.crewHelper2;
        delete trip.backupCrewName;
        delete trip.backupPosition;
        delete trip.backupTargetName;
        trip.status = 'scheduled';
        delete trip.actualDeparture;
        delete trip.actualArrival;
        delete trip.crewOdometerStart;
        delete trip.crewOdometerEnd;
        delete trip.crewOdometerEndAt;
        delete trip.crewInspectionDone;
        delete trip.crewInspectionChecklist;
        delete trip.crewWaybillValidated;
        delete trip.departureValidation;
        trip.crewFieldEvents = [];
        trip.crewClaimAudit = [];
        trip.crewClaimVersion = Number(trip.crewClaimVersion || 0) + 1;
        delete trip.gateOutAt;
        delete trip.gateOutTimestamp;
        delete trip.securityVerifiedAt;
        delete trip.securityVerifiedBy;
        delete trip.podPhotoUrl;
        delete trip.podReceiverName;
        delete trip.podConditionNote;
        delete trip.podPhotoTimestamp;
        trip.isChecklistBypassed = false;
        delete trip.checklistBypassedBy;
        delete trip.checklistBypassedAt;
        trip.updatedAt = now;
        payload.updatedAt = now;
        if (conn) {
          await conn.execute(
            'UPDATE schedules SET status=?,crew_id=NULL,crew_helper_id=NULL,crew_helper2_id=NULL,actual_arrival=NULL,payload_json=?,updated_at=NOW() WHERE id=?',
            ['scheduled', JSON.stringify(trip), trip.id]
          );
        }
        return { scheduleId: trip.id, status: 'scheduled' };
      });
      return res.json({ success: true, ...result });
    } catch (error: any) {
      const status = Number(error?.status) || 503;
      return res.status(status).json({ success: false, error: status === 503 ? 'Gagal mereset kiriman.' : error.message });
    }
  });
}
