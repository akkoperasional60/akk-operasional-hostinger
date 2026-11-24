/** V70: grant read-only portal monitoring to approved staff with portal permission.
 * Only the GET route changes. All crew mutation endpoints retain requiredActor.
 * Never grant a crew role to an admin or bypass branch-level authorization.
 */
import fs from 'node:fs';
import path from 'node:path';
const target = path.join(process.cwd(), 'server/crewClaims.ts');
const source = fs.readFileSync(target, 'utf8');
const marker = '/* AKK_CREW_MONITOR_V70 */';
const original = `  app.get('/api/crew-assignments', opts.requireAuth, async (req: any, res: any) => {
    const actor = requiredActor(req, res);
    if (!actor) return;`;
const updated = `  app.get('/api/crew-assignments', opts.requireAuth, async (req: any, res: any) => {
    ${marker}
    const actor = req.authUser;
    if (!actor || actor.status !== 'approved') {
      return res.status(403).json({ success: false, error: 'Akun yang disetujui diperlukan.' });
    }
    if (!ALLOWED_CREW_ROLES.has(String(actor.role)) && actor.role !== 'super_admin' &&
        !['cab-sidoarjo', 'cab-banyuwangi'].some(branch => branchAllowed(actor, branch, false))) {
      return res.status(403).json({ success: false, error: 'Akses Portal Driver tidak tersedia.' });
    }`;
// Every returned schedule is still filtered by branchAllowed in the existing GET body.
const reportBefore = `      const byTracking = new Map(ownBranch.map((row: any) => [clean(row.trackingNumber), clean(row.id)]));
      const allReports = await opts.getReports();
      const reportMeta = (Array.isArray(allReports) ? allReports : [])
        .filter((r: any) => allowedIds.has(clean(r.scheduleId)) || byTracking.has(clean(r.trackingNumber)))`;
const reportAfter = `      const byTracking = new Map(ownBranch.filter((row: any) => clean(row.trackingNumber)).map((row: any) => [clean(row.trackingNumber), clean(row.id)]));
      const allReports = await opts.getReports();
      const reportMeta = (Array.isArray(allReports) ? allReports : [])
        .filter((r: any) => {
          const scheduleId = clean(r.scheduleId);
          const tracking = clean(r.trackingNumber);
          return scheduleId ? allowedIds.has(scheduleId) : Boolean(tracking && byTracking.has(tracking));
        })`;
function replaceOne(input, before, after) {
  const at = input.indexOf(before);
  if (at < 0 || input.indexOf(before, at + before.length) >= 0) throw new Error('[V70] Source GET Portal Driver tidak cocok; integrasi dibatalkan.');
  return input.slice(0, at) + after + input.slice(at + before.length);
}
let next = source;
if (!source.includes(marker)) {
  next = replaceOne(next, original, updated);
  next = replaceOne(next, reportBefore, reportAfter);
}
if (!next.includes(updated) || !next.includes(reportAfter) || !next.includes('branchAllowed(actor, branch)')) throw new Error('[V70] Validasi akses baca portal tidak lengkap.');
for (const action of ['claim','action','task','report']) {
  const anchor = `app.post('/api/crew-assignments/:id/${action}', opts.requireAuth, async (req: any, res: any) => {\n    const actor = requiredActor(req, res);\n    if (!actor) return;`;
  if (!next.includes(anchor)) throw new Error(`[V70] Pengaman endpoint ${action} berubah; integrasi dibatalkan.`);
}
if (next !== source) fs.writeFileSync(target, next, 'utf8');
console.log('[V70] Portal monitoring modern aktif; endpoint tindakan kru tetap terlindungi.');
