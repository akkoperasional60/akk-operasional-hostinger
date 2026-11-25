/**
 * AKK V65 - deterministic registration of crew APIs into the existing server.ts.
 * It preserves every existing code path and does not replace the production server.
 * Run automatically via npm prebuild/predev/prestart; fail closed on incompatible source.
 */
import './apply_crew_capture_v68.mjs';
import './apply_crew_monitor_v70.mjs';
import './apply_crew_lock_v71.mjs';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const target = path.join(root, 'server.ts');
for (const file of ['server/crewClaims.ts', 'server/crewQa.ts']) {
  if (!fs.existsSync(path.join(root, file))) throw new Error(`V65: missing ${file}`);
}
if (!fs.existsSync(target)) throw new Error('V65: server.ts tidak ditemukan.');
let source = fs.readFileSync(target, 'utf8');
const signature = '/* AKK_CREW_V65_BACKEND_INTEGRATION */';
const dbImport = 'import { query as mysqlQuery, testConnection as testMysqlConnection, isDatabaseConfigured } from "./server/db";';
const routeAnchor = '  app.get("/api/driver-reports", async (_req, res) => {';

if (source.includes(signature)) {
  for (const required of ['registerCrewClaimRoutes(app, {', 'registerCrewQaRoutes(app, requireAuth);']) {
    if (!source.includes(required)) {
      throw new Error(`V65: integrasi lama tidak lengkap (${required}); periksa server.ts.`);
    }
  }
  console.log('[V65] API kru dan akun uji sudah terpasang.');
  process.exit(0);
}
if (!source.includes(dbImport) || !source.includes(routeAnchor) ||
    !source.includes('  let inMemorySchedulesPayload: any = (() => {') ||
    !source.includes('  const loadDriverReportsFromDbIfNeeded = async ') ||
    !source.includes('  const persistDriverReportsToDb = async ') ||
    !source.includes('  const broadcastDriverReportEvent = ')) {
  throw new Error('V65: source server terbaru tidak cocok. Integrasi dibatalkan agar tidak merusak backend.');
}
source = source.replace(dbImport, `${dbImport}\nimport { registerCrewClaimRoutes } from './server/crewClaims';\nimport { registerCrewQaRoutes } from './server/crewQa';`);
const injected = `  ${signature}
  // QA data uses a separate MySQL key and cannot write operational schedules.
  registerCrewQaRoutes(app, requireAuth);
  // Only these endpoints can claim a vacant live slot using a locked transaction.
  registerCrewClaimRoutes(app, {
    requireAuth,
    onSchedulesChanged: (payload: any) => {
      inMemorySchedulesPayload = payload;
      lastSchedulesDbSyncAt = Date.now();
      writePersistentAppState('schedules_payload', payload);
    },
    getReports: async () => loadDriverReportsFromDbIfNeeded(),
    saveReport: async (report: any) => {
      await loadDriverReportsFromDbIfNeeded();
      const rows = [report, ...inMemoryDriverReports.filter((entry: any) => entry.id !== report.id)].slice(0, 1500);
      await persistDriverReportsToDb(rows);
      // Legacy persistence suppresses DB errors. Do not report success to a crew
      // member until their record is actually visible in the MySQL state.
      const verifiedRows = await mysqlQuery<any[]>(
        'SELECT state_json FROM app_state WHERE state_key=? LIMIT 1', ['driver_reports_payload']);
      const latest = verifiedRows?.[0]?.state_json;
      const persisted = typeof latest === 'string' ? JSON.parse(latest) : latest;
      if (!Array.isArray(persisted) || !persisted.some((entry: any) => entry?.id === report.id)) {
        throw new Error('Gagal memverifikasi laporan di database.');
      }
      broadcastDriverReportEvent('report_upserted', report);
    }
  });

`;
source = source.replace(routeAnchor, injected + routeAnchor);
fs.writeFileSync(target, source, 'utf8');
console.log('[V65] API kru dan QA berhasil didaftarkan di server.ts.');
