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

function branchAllowed(actor: any, branchId: string, write = false): boolean {
  if (!branchId) return false;
  if (actor?.role === 'super_admin') return true;
  const permissions = jsonValue(actor?.permissions_json ?? actor?.permissions) || {};
  const perBranch = permissions.branchPermissions;
  if (!perBranch || typeof perBranch !== 'object') return false;
  const entry = perBranch[branchId];
  if (!entry?.enabled) return false;
  if (entry.allAccess) return true;
  const logistics = entry.modules?.logistics;
  if (!logistics?.enabled) return false;
  const levels = [logistics.subMenus?.driver_portal, logistics.subMenus?.portal_driver];
  return levels.includes('full_access') || (!write && levels.includes('read_only'));
}

function currentCrewPosition(schedule: any, actor: any): Position | null {
  const mine = ident(actor?.id);
  const name = clean(actor?.full_name || actor?.fullName).toLocaleLowerCase('id-ID');
  const match = (crew: any, id: unknown) => {
    const sourceId = ident(crew?.id || id);
    return Boolean(mine.length >= 3 && sourceId === mine) ||
      Boolean(name.length >= 4 && clean(crew?.name).toLocaleLowerCase('id-ID') === name);
  };
  if (match(schedule?.crew, schedule?.crewId)) return 'driver';
  if (match(schedule?.crewHelper, schedule?.crewHelperId)) return 'helper';
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

export function registerCrewClaimRoutes(app: Express, opts: CrewApiOptions): void {
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
      const payload = await readSchedulesPayload();
      const schedules = Array.isArray(payload.schedules) ? payload.schedules : [];
      const earliest = Date.now() - 95 * 86400000, latest = Date.now() + 65 * 86400000;
      const ownBranch = schedules.filter((s: any) => {
        const branch = scheduleBranch(s);
        if (!branch || !branchAllowed(actor, branch)) return false;
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
      return res.json({ success: true, schedules: ownBranch, reports: reportMeta });
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
      const { result } = await mutateSchedulesPayload(async (payload, conn) => {
        const trip = payload.schedules.find((s: any) => clean(s?.id) === clean(req.params.id));
        if (!trip) throw Object.assign(new Error('Kiriman tidak ditemukan.'), { status: 404 });
        const branchId = scheduleBranch(trip);
        if (!branchId || !branchAllowed(actor, branchId, true)) throw Object.assign(new Error('Cabang kiriman tidak sesuai akses akun.'), { status: 403 });
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
        const filled = (v: unknown) => Boolean(clean(v) && !/^(?:-|none|pending|tbd|drv-pending|crew-driver-tbd)$/i.test(clean(v)));
        const assigned = filled(trip[idKey]) || filled(trip[crewKey]?.id);
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
        return { scheduleId: trip.id, action, status: trip.status, at: now, gpsAccuracy: gps.accuracy };
      });
      return res.json({ success: true, ...result });
    } catch (error: any) {
      const status = Number(error?.status) || 503;
      return res.status(status).json({ success: false, error: status === 503 ? 'Perubahan status gagal disimpan.' : error.message });
    }
  });

  app.post('/api/crew-assignments/:id/task', opts.requireAuth, async (req: any, res: any) => {
    const actor = requiredActor(req, res);
    if (!actor) return;
    const task = clean(req.body?.action);
    if (!['km', 'inspection', 'waybill'].includes(task)) return res.status(400).json({ success: false, error: 'Tugas tidak dikenal.' });
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
        if (String(trip.status || 'scheduled') !== 'scheduled') throw Object.assign(new Error('Persiapan hanya bisa dicatat sebelum berangkat.'), { status: 409 });
        if (task === 'km') {
          if (slot !== 'driver') throw Object.assign(new Error('KM awal hanya tugas Driver.'), { status: 403 });
          const value = Number(req.body.value);
          if (!Number.isFinite(value) || value <= 0 || value > 99999999) throw Object.assign(new Error('KM awal tidak valid.'), { status: 400 });
          if (trip.crewOdometerStart) throw Object.assign(new Error('KM awal sudah tercatat, tidak bisa diubah dari akun kru.'), { status: 409 });
          trip.crewOdometerStart = String(value);
        } else if (task === 'inspection') {
          if (slot !== 'driver') throw Object.assign(new Error('Checklist kendaraan hanya tugas Driver.'), { status: 403 });
          trip.crewInspectionDone = true;
        } else {
          if (slot !== 'helper') throw Object.assign(new Error('Surat jalan hanya tugas Helper.'), { status: 403 });
          trip.crewWaybillValidated = true;
        }
        const now = new Date().toISOString();
        trip.crewFieldEvents = (Array.isArray(trip.crewFieldEvents) ? trip.crewFieldEvents : []).slice(-(MAX_REPORT_EVENTS - 1));
        trip.crewFieldEvents.push({
          action: task, actorId: clean(actor.id), actorName: clean(actor.full_name), position: slot,
          value: task === 'km' ? trip.crewOdometerStart : undefined, gps, at: now
        });
        trip.updatedAt = now;
        payload.updatedAt = now;
        if (conn) {
          await conn.execute('UPDATE schedules SET payload_json=?,updated_at=NOW() WHERE id=?', [JSON.stringify(trip), trip.id]);
        }
        return { task, at: now };
      });
      return res.json({ success: true, ...result });
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
    const gps = checkLocation({ latitude: report.gpsLatitude, longitude: report.gpsLongitude, accuracy: report.gpsAccuracy });
    if (!gps) return res.status(422).json({ success: false, error: 'GPS aktual wajib tersedia.' });
    const photo = typeof report.photoUrl === 'string' ? report.photoUrl : '';
    const capture = { photo, source: report.photoSource, capturedAt: report.photoCapturedAt, gpsCapturedAt: report.gpsCapturedAt,
      gps: { latitude: report.gpsLatitude, longitude: report.gpsLongitude, accuracy: report.gpsAccuracy } };
    const evidenceError = validateCameraEvidence(capture);
    if (evidenceError) return res.status(422).json({ success: false, error: evidenceError });
    if (photo && (photo.length > 3_500_000 || !/^data:image\/(jpeg|png|webp);base64,/i.test(photo))) {
      return res.status(413).json({ success: false, error: 'Foto terlalu besar atau format tidak didukung.' });
    }
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
      const timestamp = new Date().toISOString();
      const row = {
        id: `crew-v65-${crypto.randomUUID()}`, scheduleId: trip.id, trackingNumber: trip.trackingNumber,
        reportType: kind, type: kind, userRole: position === 'driver' ? 'Driver' : 'Helper',
        driverName: trip.crew?.name || '-', helperName: trip.crewHelper?.name || '-',
        userId: clean(actor.id), actorName: clean(actor.full_name),
        plateNumber: trip.armada || trip.fleet?.plateNumber || '-', area: trip.areaName || trip.store?.storeName || '-',
        notes: note, note, photoUrl: photo, photoSource: 'camera',
        photoCapturedAt: capture.capturedAt, gpsCapturedAt: capture.gpsCapturedAt,
        gpsLatitude: gps.latitude, gpsLongitude: gps.longitude, gpsAccuracy: gps.accuracy,
        timestamp, status: 'submitted', source: 'crew_v65'
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
        delete trip.crewHelper2Id;
        delete trip.crewHelper2;
        delete trip.backupCrewName;
        delete trip.backupPosition;
        delete trip.backupTargetName;
        trip.status = 'scheduled';
        delete trip.actualDeparture;
        delete trip.actualArrival;
        delete trip.crewOdometerStart;
        delete trip.crewInspectionDone;
        delete trip.crewWaybillValidated;
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
