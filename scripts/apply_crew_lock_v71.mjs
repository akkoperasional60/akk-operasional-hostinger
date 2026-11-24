/** V71: one unfinished assignment per person, for live and QA claims.
 * The check executes inside the same MySQL transaction / FOR UPDATE lock
 * used by the original claim route. Never rely on the browser for enforcement.
 * Keep V68 camera validation and V70 monitor authorization intact.
 */
import fs from 'node:fs';
import path from 'node:path';
const marker = '/* AKK_CREW_LOCK_V71 */';
const liveCheck = `      ${marker}
      // Scan the complete locked payload, across branches and dates. A change
      // from Driver to Helper does not release an existing assignment.
      const activeElsewhere = payload.schedules.some((other: any) =>
        other && clean(other.id) !== clean(trip.id) &&
        clean(other.status).toLowerCase() !== 'delivered' &&
        Boolean(currentCrewPosition(other, actor)));
      if (activeElsewhere) throw Object.assign(new Error('Selesaikan kiriman aktif sebelum mengambil kiriman lain.'), { status: 409 });
`;
const qaCheck = `        ${marker}
        if (list.some(other => other && other.id !== t.id && other.phase !== 'returned' && roleOf(other,u))) {
          throw err('Selesaikan kiriman aktif sebelum mengambil kiriman lain.',409);
        }
`;
function replaceOne(src, from, to, label) {
  const at = src.indexOf(from);
  if (at < 0 || src.indexOf(from, at + from.length) >= 0) throw new Error('[V71] Anchor tidak cocok: ' + label);
  return src.slice(0, at) + to + src.slice(at + from.length);
}
const livePath = path.join(process.cwd(), 'server/crewClaims.ts');
const qaPath = path.join(process.cwd(), 'server/crewQa.ts');
const serverPath = path.join(process.cwd(), 'server.ts');
const live = fs.readFileSync(livePath, 'utf8');
const qa = fs.readFileSync(qaPath, 'utf8');
const server = fs.readFileSync(serverPath,'utf8');
let nextLive = live, nextQa = qa, nextServer = server;
if (!live.includes(marker)) {
  const start = live.indexOf('      const start = new Date(trip.departureDate || trip.deliveryDate || 0).getTime();');
  const end = live.indexOf("      const idKey = slot === 'driver' ? 'crewId' : 'crewHelperId';", start);
  if (start < 0 || end < start || !live.slice(start,end).includes('busyElsewhere')) throw new Error('[V71] Validasi jadwal lama tidak cocok.');
  nextLive = live.slice(0,start) + liveCheck + live.slice(end);
  nextLive = replaceOne(nextLive,
    "        const date = new Date(s.departureDate || s.deliveryDate || 0).getTime();\n        return date > earliest && date < latest;",
    "        // Do not hide an unfinished assignment merely because it is outside the normal date window.\n        if (ALLOWED_CREW_ROLES.has(String(actor.role)) && clean(s.status).toLowerCase() !== 'delivered' && currentCrewPosition(s, actor)) return true;\n        const date = new Date(s.departureDate || s.deliveryDate || 0).getTime();\n        return date > earliest && date < latest;", 'active assignment visibility');
  nextLive = replaceOne(nextLive,
    "    const slot: Position = req.body?.slot;",
    "    if (req.body?.confirmed !== true) return res.status(400).json({ success: false, error: 'Konfirmasi pengambilan kiriman diperlukan. Muat ulang aplikasi.' });\n    const slot: Position = req.body?.slot;", 'live confirmation');
}
if (!qa.includes(marker)) {
  nextQa = replaceOne(nextQa, 'fn: (t: any) => void)', 'fn: (t: any, list: any[]) => void)', 'QA mutation signature');
  nextQa = replaceOne(nextQa, '    fn(row);', '    fn(row, list);', 'QA locked list');
  nextQa = replaceOne(nextQa, "    const slot=req.body?.slot;", "    if(req.body?.confirmed!==true)return res.status(400).json({success:false,error:'Konfirmasi pengambilan kiriman diperlukan. Muat ulang aplikasi.'});\n    const slot=req.body?.slot;", 'QA confirmation');
  nextQa = replaceOne(nextQa,
    "      const trip=await mutate(u,req.params.id,t=>{\n        if(t.phase!=='waiting')throw err('Kiriman sudah berjalan.',409);",
    "      const trip=await mutate(u,req.params.id,(t,list)=>{\n        if(t.phase!=='waiting')throw err('Kiriman sudah berjalan.',409);\n" + qaCheck.trimEnd(), 'QA one assignment');
}
// The legacy schedule read route reopens delivered rows without POD. Modern
// crew arrival records are already authenticated and GPS-validated; preserve
// that completion so this read does not re-lock a completed assignment.
const oldSanitize = "        if (depIso >= '2026-11-12' && sch?.status === 'delivered' && !sch?.podPhotoUrl && !sch?.isChecklistBypassed) {";
const newSanitize = `        /* AKK_CREW_ARRIVAL_V71 */
        const crewArrivalRecorded = Boolean(sch?.actualArrival && Array.isArray(sch?.crewFieldEvents) && sch.crewFieldEvents.some((event: any) =>
          event?.action === 'arrive' && event?.at === sch.actualArrival && event?.actorId && event?.gps));
        if (depIso >= '2026-11-12' && sch?.status === 'delivered' && !sch?.podPhotoUrl && !sch?.isChecklistBypassed && !crewArrivalRecorded) {`;
if (!server.includes('AKK_CREW_ARRIVAL_V71')) nextServer = replaceOne(server,oldSanitize,newSanitize,'preserve recorded crew arrival');
if (!nextServer.includes(newSanitize)) throw new Error('[V71] Validasi status selesai tidak lengkap.');
// Validate both complete sources before writing, including previous integrations.
if (!nextLive.includes(liveCheck) || !nextQa.includes(qaCheck.trimEnd()) || !nextLive.includes('req.body?.confirmed !== true') || !nextQa.includes('req.body?.confirmed!==true') || !nextLive.includes('FOR UPDATE') || !nextQa.includes('FOR UPDATE') || !nextQa.includes('fn(row, list);')) throw new Error('[V71] Validasi penguncian tidak lengkap.');
if (!nextLive.includes('AKK_CREW_MONITOR_V70') || !nextLive.includes('AKK_CREW_CAPTURE_V68') || !nextQa.includes('AKK_CREW_CAPTURE_V68')) throw new Error('[V71] Integrasi V68/V70 belum tersedia.');
if (nextLive !== live) fs.writeFileSync(livePath,nextLive,'utf8');
if (nextQa !== qa) fs.writeFileSync(qaPath,nextQa,'utf8');
if (nextServer !== server) fs.writeFileSync(serverPath,nextServer,'utf8');
console.log('[V71] Konfirmasi + satu kiriman aktif per kru (produksi dan simulasi) aktif.');
