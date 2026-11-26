import type { Express } from 'express';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { getDbPool, isDatabaseConfigured } from './db';
import { validateCameraEvidence } from '../src/components/crew/crewCaptureEvidence';
/* AKK_CREW_CAPTURE_V68 */

const QA_KEY = 'akk_qa_kiriman_server_v65';
const isPreviewRuntime = Boolean(process.env.K_SERVICE) || process.env.NODE_ENV !== 'production';
const APP_STATE_PATH = path.join(process.cwd(), 'data', 'server_app_state.json');

let qaChangeListener: ((tripId?: string) => void) | null = null;
export function setCrewQaChangedListener(cb: ((tripId?: string) => void) | null) {
  qaChangeListener = cb;
}
const emitQaChanged = (tripId?: string) => {
  try { qaChangeListener?.(tripId); } catch {}
};

let localQaQueue: Promise<void> = Promise.resolve();
const runSerializedQaLocal = async <T>(fn: () => Promise<T> | T): Promise<T> => {
  const prev = localQaQueue;
  let release!: () => void;
  localQaQueue = new Promise<void>(resolve => { release = resolve; });
  await prev;
  try {
    return await fn();
  } finally {
    release();
  }
};

const readLocalQaState = (): any[] => {
  try {
    if (!fs.existsSync(APP_STATE_PATH)) return [];
    const raw = JSON.parse(fs.readFileSync(APP_STATE_PATH, 'utf8'));
    const parsed = raw?.[QA_KEY];
    return Array.isArray(parsed?.schedules) ? parsed.schedules.slice(0, 150) : [];
  } catch {
    return [];
  }
};

const writeLocalQaState = (schedules: any[]): void => {
  try {
    const dir = path.dirname(APP_STATE_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    let data: Record<string, any> = {};
    if (fs.existsSync(APP_STATE_PATH)) {
      try { data = JSON.parse(fs.readFileSync(APP_STATE_PATH, 'utf8')); } catch {}
    }
    data[QA_KEY] = { version: 65, updatedAt: new Date().toISOString(), schedules: schedules.slice(0, 150) };
    fs.writeFileSync(APP_STATE_PATH, JSON.stringify(data, null, 2), 'utf8');
  } catch {}
};

const json = (raw: any) => {
  if (!raw) return null;
  if (typeof raw === 'object') return raw;
  try { return JSON.parse(String(raw)); } catch { return null; }
};
const str = (raw: any) => String(raw ?? '').trim();
const isQa = (u: any) => u && u.status === 'approved' && ['driver','crew_helper'].includes(u.role) &&
  /^akk-qa-(driver|helper)-[a-z0-9-]+@example\.com$/i.test(str(u.email)) &&
  str(u.notes).includes('AKK_QA_TEST_ACCOUNT');
const isAdmin = (u: any) => u && u.status === 'approved' && u.role === 'super_admin';
const permitted = (u: any, branchId: string) => {
  if (isAdmin(u)) return true;
  const perms = json(u.permissions_json) || json(u.permissions) || {};
  return Boolean(perms.branchPermissions?.[branchId]?.enabled &&
    perms.branchPermissions?.[branchId]?.modules?.logistics?.enabled);
};
const same = (a: any, b: any) => {
  const aa=str(a).toLowerCase().replace(/^(?:(?:crw|usr)-)+/, '');
  const bb=str(b).toLowerCase().replace(/^(?:(?:crw|usr)-)+/, '');
  return Boolean(aa && bb && aa===bb);
};
const roleOf = (trip: any, u: any): 'driver' | 'helper' | null => same(trip.driver?.id, u.id) ? 'driver' : same(trip.helper?.id, u.id) ? 'helper' : null;
const err = (message: string, status = 400) => Object.assign(new Error(message), { status });
const QA_VEHICLE_CHECKLIST = [
  { key: 'oli_mesin', label: 'Oli Mesin', requiresPhoto: true, options: ['Normal', 'Tidak Normal'] },
  { key: 'air_radiator', label: 'Air Radiator', requiresPhoto: true, options: ['Normal', 'Tidak Normal'] },
  { key: 'air_aki', label: 'Air Aki', requiresPhoto: false, options: ['Normal', 'Tidak Normal'] },
  { key: 'rem_minyak_rem', label: 'Rem Mobil & Minyak Rem', requiresPhoto: true, options: ['Normal', 'Tidak Normal'] },
  { key: 'kebersihan_kabin', label: 'Kebersihan Kabin', requiresPhoto: true, options: ['Bersih', 'Tidak'] },
  { key: 'inventaris_mobil', label: 'Inventaris Mobil', requiresPhoto: false, options: ['Normal', 'Tidak Normal'] },
  { key: 'ban_cadangan', label: 'Ban Cadangan', requiresPhoto: false, options: ['Ada', 'Tidak Ada'] }
] as const;
const validateQaChecklist = (raw: unknown) => {
  if (!Array.isArray(raw)) throw err('Pemeriksaan armada wajib diisi lengkap.', 422);
  const byKey = new Map<string, any>();
  for (const item of raw) {
    if (item && typeof item === 'object' && typeof (item as any).key === 'string') byKey.set((item as any).key, item);
  }
  const missingPhotos: string[] = [];
  const unselected: string[] = [];
  const summary: any[] = [];
  for (const def of QA_VEHICLE_CHECKLIST) {
    const entry = byKey.get(def.key);
    const chosen = str(entry?.status);
    if (!(def.options as readonly string[]).includes(chosen)) { unselected.push(def.label); continue; }
    if (def.requiresPhoto) {
      const photo = typeof entry.photo === 'string' ? entry.photo.trim() : '';
      if (!/^data:image\/(jpeg|png|webp);base64,/i.test(photo) || photo.length < 80) {
        missingPhotos.push(def.label);
        continue;
      }
      summary.push({ key: def.key, label: def.label, status: chosen, checked: true, requiresPhoto: true, photoAttached: true, capturedAt: str(entry.capturedAt) || new Date().toISOString() });
    } else {
      summary.push({ key: def.key, label: def.label, status: chosen, checked: true, requiresPhoto: false });
    }
  }
  if (missingPhotos.length > 0) throw err(`Foto bukti wajib belum lengkap: ${missingPhotos.join(', ')}.`, 422);
  if (unselected.length > 0) throw err(`Pilihan pemeriksaan belum diisi: ${unselected.join(', ')}.`, 422);
  return summary;
};
const getRows = async (conn: any, lock = false): Promise<any[]> => {
  const [rows] = await conn.execute(`SELECT state_json FROM app_state WHERE state_key=? LIMIT 1 ${lock?'FOR UPDATE':''}`, [QA_KEY]);
  const parsed = json(rows?.[0]?.state_json);
  return Array.isArray(parsed?.schedules) ? parsed.schedules.slice(0, 150) : [];
};
const storeRows = async (conn: any, schedules: any[]) => {
  await conn.execute('INSERT INTO app_state(state_key,state_json,updated_at) VALUES(?,?,NOW()) ON DUPLICATE KEY UPDATE state_json=VALUES(state_json),updated_at=NOW()',
    [QA_KEY, JSON.stringify({version:65,updatedAt:new Date().toISOString(),schedules:schedules.slice(0,150)})]);
};
const check = (req: any, res: any): any | null => {
  const u = req.authUser;
  if (!isAdmin(u) && !isQa(u)) { res.status(403).json({success:false,error:'Hanya akun uji atau Super Admin.'}); return null; }
  if (!isDatabaseConfigured() && !isPreviewRuntime) {res.status(503).json({success:false,error:'Database tidak tersedia.'});return null;}
  return u;
};
const mutate = async (u: any, id: string, fn: (t: any, list: any[]) => void) => {
  if (!isDatabaseConfigured()) {
    return runSerializedQaLocal(() => {
      const list = readLocalQaState();
      const row = list.find(t => t.id === id);
      if (!row) throw err('Kiriman uji tidak ditemukan.', 404);
      if (!permitted(u, row.branchId)) throw err('Cabang tidak sesuai akses akun.', 403);
      fn(row, list);
      writeLocalQaState(list);
      return row;
    });
  }
  let conn: any;
  try {
    conn = await getDbPool().getConnection();
    await conn.execute('INSERT IGNORE INTO app_state(state_key,state_json,updated_at) VALUES(?,?,NOW())', [QA_KEY, JSON.stringify({version:65,schedules:[]})]);
    await conn.beginTransaction();
    const list = await getRows(conn, true);
    const row = list.find(t => t.id === id);
    if (!row) throw err('Kiriman uji tidak ditemukan.',404);
    if (!permitted(u,row.branchId)) throw err('Cabang tidak sesuai akses akun.',403);
    fn(row, list);
    await storeRows(conn,list);
    await conn.commit();
    return row;
  } catch (e) { if(conn)try{await conn.rollback()}catch{};throw e; }
  finally {if(conn)conn.release();}
};

export function registerCrewQaRoutes(app: Express, requireAuth: any) {
  const errorResponse = (res: any, e: any) => res.status(Number(e?.status)||503).json({success:false,error:e?.message||'Penyimpanan uji gagal.'});
  app.get('/api/crew-qa/trips', requireAuth, async (req: any, res: any) => {
    const u = check(req,res); if(!u)return;
    try {
      let list: any[];
      if (!isDatabaseConfigured()) {
        list = readLocalQaState();
      } else {
        const [rows] = await getDbPool().execute('SELECT state_json FROM app_state WHERE state_key=? LIMIT 1',[QA_KEY]);
        const data = json((rows as any[])[0]?.state_json);
        list = Array.isArray(data?.schedules) ? data.schedules : [];
      }
      return res.json({success:true,trips:list.filter((t:any)=>permitted(u,t.branchId))});
    } catch(e) {return errorResponse(res,e);}
  });
  app.post('/api/crew-qa/trips', requireAuth, async (req: any, res: any) => {
    const u = check(req,res); if(!u)return;
    if(!isAdmin(u))return res.status(403).json({success:false,error:'Hanya Admin yang boleh membuat kiriman uji.'});
    const {branchId,area,fleetLabel,date,departureTime} = req.body||{};
    if(!['cab-sidoarjo','cab-banyuwangi'].includes(branchId)||str(area).length<3||str(area).length>100||
      !/^\d{4}-\d{2}-\d{2}$/.test(str(date))||!/^\d{2}:\d{2}$/.test(str(departureTime)))
      return res.status(400).json({success:false,error:'Cabang, tanggal, jam atau area belum valid.'});
    const trip = {id:`qa-v65-${crypto.randomUUID()}`,branchId,area:str(area),fleetLabel:str(fleetLabel)||'Armada Uji',date,departureTime,
      driver:null,helper:null,createdAt:new Date().toISOString(),phase:'waiting',reports:[]};
    if (!isDatabaseConfigured()) {
      await runSerializedQaLocal(() => {
        const rows = readLocalQaState();
        writeLocalQaState([trip, ...rows].slice(0, 150));
      });
      emitQaChanged(trip.id);
      return res.json({success:true,trip});
    }
    let conn: any;
    try {
      conn=await getDbPool().getConnection();
      await conn.execute('INSERT IGNORE INTO app_state(state_key,state_json,updated_at) VALUES(?,?,NOW())', [QA_KEY, JSON.stringify({version:65,schedules:[]})]);
      await conn.beginTransaction();
      const rows=await getRows(conn,true);
      await storeRows(conn,[trip,...rows].slice(0,150));
      await conn.commit();
      emitQaChanged(trip.id);
      return res.json({success:true,trip});
    } catch(e){if(conn)try{await conn.rollback()}catch{};return errorResponse(res,e)}finally{if(conn)conn.release()}
  });
  app.delete('/api/crew-qa/trips/:id', requireAuth, async (req:any,res:any)=>{
    const u=check(req,res);if(!u)return;
    if(!isAdmin(u))return res.status(403).json({success:false,error:'Hanya Admin yang dapat menghapus uji.'});
    if (!isDatabaseConfigured()) {
      await runSerializedQaLocal(() => {
        const rows = readLocalQaState();
        writeLocalQaState(rows.filter(t => t.id !== req.params.id));
      });
      emitQaChanged(req.params.id);
      return res.json({success:true});
    }
    let conn: any;
    try{conn=await getDbPool().getConnection();
      await conn.execute('INSERT IGNORE INTO app_state(state_key,state_json,updated_at) VALUES(?,?,NOW())', [QA_KEY, JSON.stringify({version:65,schedules:[]})]);
      await conn.beginTransaction();const rows=await getRows(conn,true);await storeRows(conn,rows.filter(t=>t.id!==req.params.id));await conn.commit();emitQaChanged(req.params.id);return res.json({success:true})}
    catch(e){if(conn)try{await conn.rollback()}catch{};return errorResponse(res,e)}finally{if(conn)conn.release()}
  });
  app.post('/api/crew-qa/trips/:id/claim',requireAuth,async(req:any,res:any)=>{
    const u=check(req,res);if(!u)return;
    if(!isQa(u))return res.status(403).json({success:false,error:'Hanya akun kru uji yang dapat mengambil slot.'});
    if(req.body?.confirmed!==true)return res.status(400).json({success:false,error:'Konfirmasi pengambilan kiriman diperlukan. Muat ulang aplikasi.'});
    const slot=req.body?.slot;
    if(slot!=='driver'&&slot!=='helper')return res.status(400).json({success:false,error:'Posisi tidak dikenal.'});
    try{
      const trip=await mutate(u,req.params.id,(t,list)=>{
        if(t.phase!=='waiting')throw err('Kiriman sudah berjalan.',409);
        /* AKK_CREW_LOCK_V71 */
        if (list.some(other => other && other.id !== t.id && other.phase !== 'returned' && roleOf(other,u))) {
          throw err('Selesaikan kiriman aktif sebelum mengambil kiriman lain.',409);
        }
        if (t.date && list.some(other => other && other.id !== t.id && other.date === t.date && roleOf(other, u))) {
          throw err('Sudah memilih kiriman pada hari ini. Reset oleh Super Admin diperlukan untuk mengganti.', 409);
        }
        if(t.driver?.id && same(t.driver.id,u.id)||t.helper?.id&&same(t.helper.id,u.id))throw err('Sudah mengambil posisi lain.',409);
        if(t[slot])throw err('Slot sudah diambil orang lain.',409);
        t[slot]={id:`crw-${u.id}`,name:str(u.full_name)};
        t.updatedAt=new Date().toISOString();
      });
      emitQaChanged(trip.id);
      return res.json({success:true,trip});
    }catch(e){return errorResponse(res,e)}
  });
  app.post('/api/crew-qa/trips/:id/action',requireAuth,async(req:any,res:any)=>{
    const u=check(req,res);if(!u)return;
    if(!isQa(u))return res.status(403).json({success:false,error:'Aksi hanya untuk kru uji.'});
    const action=str(req.body?.action);
    if(!['km','km_end','inspection','waybill','depart','arrive','report'].includes(action))return res.status(400).json({success:false,error:'Aksi tidak dikenal.'});
    try{
      const trip=await mutate(u,req.params.id,t=>{
        const slot=roleOf(t,u);
        if(!slot)throw err('Belum mengambil posisi pada kiriman ini.',403);
        if(action==='km'){
          if(slot!=='driver')throw err('KM hanya untuk Driver.',403);
          const km=Number(req.body?.value);
          if(!Number.isFinite(km)||km<=0||km>99999999)throw err('KM tidak valid.');
          t.odometerStart=String(km);
        }else if(action==='km_end'){
          if(slot!=='driver')throw err('KM akhir hanya untuk Driver.',403);
          if(t.phase!=='returned')throw err('KM akhir hanya dapat diisi setelah Tiba di Gudang.',409);
          const km=Number(req.body?.value);
          if(!Number.isFinite(km)||km<=0||km>99999999)throw err('KM akhir tidak valid.');
          const startKm=Number(t.odometerStart||0);
          if(startKm>0 && km<=startKm)throw err(`KM akhir harus lebih besar dari KM awal (${startKm.toLocaleString('id-ID')} km).`);
          t.odometerEnd=String(km);
          t.odometerEndAt=new Date().toISOString();
        }else if(action==='inspection'){
          if(slot!=='driver')throw err('Checklist armada hanya untuk Driver.',403);
          if(!t.odometerStart)throw err('Isi KM awal terlebih dahulu sebelum mengisi checklist kendaraan.',409);
          t.inspectionChecklist=validateQaChecklist(req.body?.checklist);
          t.inspectionDone=true;
        }else if(action==='waybill'){
          if(slot!=='helper')throw err('Validasi SJ hanya untuk Helper.',403);
          const dv = req.body?.departureValidation;
          if(dv && typeof dv === 'object'){
            if(!dv.checks?.waybillMatch || !dv.checks?.documentsReady) throw err('Konfirmasi surat jalan dan dokumen wajib dicentang.',422);
            for(const k of ['spvLogistik','spvOperasional','security','crew']){
              const sVal = typeof dv.signatures?.[k]==='string' ? dv.signatures[k].trim() : '';
              if(!/^data:image\/(png|jpeg|webp);base64,/i.test(sVal) || sVal.length < 120) throw err('Seluruh 4 tanda tangan digital wajib diisi.',422);
            }
            t.departureValidation = {
              summary: {
                driverName: str(dv.summary?.driverName) || t.driver?.name || '-',
                helperName: str(dv.summary?.helperName) || t.helper?.name || '-',
                fleetLabel: str(dv.summary?.fleetLabel) || t.fleetLabel || '-',
                areaName: str(dv.summary?.areaName) || t.area || '-',
                recordedAt: new Date().toISOString(),
                recordedAtWib: str(dv.summary?.recordedAtWib) || '-'
              },
              checks: { waybillMatch: true, documentsReady: true },
              signatures: {
                spvLogistik: dv.signatures.spvLogistik,
                spvOperasional: dv.signatures.spvOperasional,
                security: dv.signatures.security,
                crew: dv.signatures.crew
              },
              signedAt: new Date().toISOString(),
              signedBy: str(u.full_name)
            };
          }
          t.waybillValidated=true;
        }else if(action==='depart'){
          if(!t.driver||!t.helper)throw err('Tim belum lengkap.',409);
          if(t.phase!=='waiting')throw err('Kiriman sudah berangkat.',409);
          if(!t.odometerStart||!t.inspectionDone||!t.waybillValidated)throw err('Isi KM, checklist dan validasi SJ dahulu.',409);
          t.phase='going';t.departedAt=new Date().toISOString();
        }else if(action==='arrive'){
          if(t.phase!=='going')throw err('Kiriman belum berangkat.',409);
          t.phase='returned';t.returnedAt=new Date().toISOString();
        }else if(action==='report'){
          const type=str(req.body?.kind),note=str(req.body?.note);
          if(!['bbm','kendala','toko','retur','form_kirim'].includes(type)||note.length<3||note.length>1200)throw err('Laporan tidak valid.');
          if(slot==='driver'&&['toko','retur','form_kirim'].includes(type)||slot==='helper'&&type==='bbm')throw err('Jenis laporan bukan tugas posisi ini.',403);
          const evidence=req.body?.evidence;
          const rows=Array.isArray(t.reports)?t.reports:[];
          if(type==='form_kirim'&&!evidence){
            const manifestGps=req.body?.manifestGps;
            const gps=manifestGps&&Number.isFinite(Number(manifestGps.latitude))?{latitude:Number(manifestGps.latitude),longitude:Number(manifestGps.longitude),accuracy:Number(manifestGps.accuracy)||20}:{latitude:-8.1906,longitude:114.3708,accuracy:20};
            const nowIso=new Date().toISOString();
            t.reports=[...rows.slice(-99),{id:`qa-report-${crypto.randomUUID()}`,type,note,by:str(u.full_name),at:nowIso,photoAttached:false,photoSource:'manifest_no_photo',photoCapturedAt:nowIso,gpsCapturedAt:nowIso,gps}];
          }else{
            const invalid=validateCameraEvidence(evidence);
            if(invalid)throw err(invalid,422);
            const fuelLocation=type==='bbm'?(str(req.body?.fuelLocation)||'Farly'):undefined;
            const fuelUrgentReason=type==='bbm'?str(req.body?.fuelUrgentReason):undefined;
            const customerOutletName=str(req.body?.customerOutletName).slice(0,140)||undefined;
            const invoiceNumber=str(req.body?.invoiceNumber).slice(0,80)||undefined;
            const issueItemName=str(req.body?.issueItemName).slice(0,160)||undefined;
            const issueQty=str(req.body?.issueQty).slice(0,60)||undefined;
            const kendalaSubType=str(req.body?.kendalaSubType)||undefined;
            const photoCount=(type==='bbm'||type==='retur')?Math.max(1,Math.min(6,Number(req.body?.photoCount)||1)):1;
            // QA retains metadata only so the test state never grows with base64 images.
            t.reports=[...rows.slice(-99),{
              id:`qa-report-${crypto.randomUUID()}`,type,note,by:str(u.full_name),at:new Date().toISOString(),
              photoAttached:true,photoSource:'camera',photoCapturedAt:evidence.capturedAt,gpsCapturedAt:evidence.gpsCapturedAt,gps:evidence.gps,photoCount,
              ...(fuelLocation?{fuelLocation,...(fuelUrgentReason?{fuelUrgentReason}:{})}:{}),
              ...(customerOutletName?{customerOutletName}:{}),
              ...(invoiceNumber?{invoiceNumber}:{}),
              ...(issueItemName?{issueItemName}:{}),
              ...(issueQty?{issueQty}:{}),
              ...(kendalaSubType?{kendalaSubType}:{})
            }];
          }
        }
        t.updatedAt=new Date().toISOString();
      });
      emitQaChanged(trip.id);
      return res.json({success:true,trip});
    }catch(e){return errorResponse(res,e)}
  });
  app.post('/api/crew-qa/trips/:id/reset', requireAuth, async (req: any, res: any) => {
    const u = check(req, res); if (!u) return;
    if (!isAdmin(u)) return res.status(403).json({ success: false, error: 'Hanya Super Admin yang dapat mereset kiriman uji.' });
    try {
      const trip = await mutate(u, req.params.id, t => {
        t.driver = null;
        t.helper = null;
        t.phase = 'waiting';
        delete t.departedAt;
        delete t.returnedAt;
        delete t.odometerStart;
        delete t.odometerEnd;
        delete t.odometerEndAt;
        delete t.inspectionDone;
        delete t.inspectionChecklist;
        delete t.waybillValidated;
        delete t.departureValidation;
        t.reports = [];
        t.updatedAt = new Date().toISOString();
      });
      emitQaChanged(trip.id);
      return res.json({ success: true, trip });
    } catch (e) { return errorResponse(res, e); }
  });
}
