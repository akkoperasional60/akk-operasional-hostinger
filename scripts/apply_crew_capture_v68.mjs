/** Apply the V68 evidence migration to the existing V65 route sources.
 * Both files are checked before writing. Refuse incompatible source rather than
 * silently dropping the new guard or overwriting unrelated changes.
 */
import fs from 'node:fs';
import path from 'node:path';
const root = process.cwd();
const signature = '/* AKK_CREW_CAPTURE_V68 */';
const imp = "import { validateCameraEvidence } from '../src/components/crew/crewCaptureEvidence';";
function replaceOne(source, before, after, label) {
  const at = source.indexOf(before);
  if (at < 0 || source.indexOf(before, at + before.length) >= 0) throw new Error(`[V68] Anchor tidak cocok: ${label}. Tidak ada file yang diubah.`);
  return source.slice(0, at) + after + source.slice(at + before.length);
}
const edits = [
  { file:'server/crewClaims.ts', required:[imp, 'validateCameraEvidence(capture)', 'photoCapturedAt: capture.capturedAt', 'gpsCapturedAt: capture.gpsCapturedAt'], changes:[
    ["import { getDbPool, isDatabaseConfigured } from './db';", "import { getDbPool, isDatabaseConfigured } from './db';\n" + imp + '\n' + signature],
    ["    const photo = typeof report.photoUrl === 'string' ? report.photoUrl : '';", `    const photo = typeof report.photoUrl === 'string' ? report.photoUrl : '';
    const capture = { photo, source: report.photoSource, capturedAt: report.photoCapturedAt, gpsCapturedAt: report.gpsCapturedAt,
      gps: { latitude: report.gpsLatitude, longitude: report.gpsLongitude, accuracy: report.gpsAccuracy } };
    const evidenceError = validateCameraEvidence(capture);
    if (evidenceError) return res.status(422).json({ success: false, error: evidenceError });`],
    ["        notes: note, note, photoUrl: photo || undefined,", "        notes: note, note, photoUrl: photo, photoSource: 'camera',\n        photoCapturedAt: capture.capturedAt, gpsCapturedAt: capture.gpsCapturedAt,"],
  ]},
  { file:'server/crewQa.ts', required:[imp, 'validateCameraEvidence(evidence)', 'photoCapturedAt:evidence.capturedAt', 'gpsCapturedAt:evidence.gpsCapturedAt'], changes:[
    ["import { getDbPool, isDatabaseConfigured } from './db';", "import { getDbPool, isDatabaseConfigured } from './db';\n" + imp + '\n' + signature],
    ["          const rows=Array.isArray(t.reports)?t.reports:[];\n          t.reports=[...rows.slice(-99),{id:`qa-report-${crypto.randomUUID()}`,type,note,by:str(u.full_name),at:new Date().toISOString(),photoAttached:Boolean(req.body?.photoAttached)}];", `          const evidence=req.body?.evidence;
          const invalid=validateCameraEvidence(evidence);
          if(invalid)throw err(invalid,422);
          const rows=Array.isArray(t.reports)?t.reports:[];
          // QA retains metadata only so the test state never grows with base64 images.
          t.reports=[...rows.slice(-99),{id:\`qa-report-\${crypto.randomUUID()}\`,type,note,by:str(u.full_name),at:new Date().toISOString(),photoAttached:true,photoSource:'camera',photoCapturedAt:evidence.capturedAt,gpsCapturedAt:evidence.gpsCapturedAt,gps:evidence.gps}];`],
  ]}
];
const updated = edits.map(({file, required, changes}) => {
  const target = path.join(root,file);
  const original = fs.readFileSync(target,'utf8');
  let source = original;
  if (!source.includes(signature)) {
    for (const [before,after] of changes) source = replaceOne(source,before,after,file);
  }
  for (const key of required) if (!source.includes(key)) throw new Error(`[V68] Integrasi tidak lengkap: ${file}: ${key}`);
  return {target, source, changed: source !== original};
});
for (const entry of updated) if (entry.changed) fs.writeFileSync(entry.target,entry.source,'utf8');
console.log('[V68] Validasi bukti foto kamera dan GPS aktif untuk laporan real dan QA.');
