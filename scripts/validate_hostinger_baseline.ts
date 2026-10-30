import fs from 'fs';
import path from 'path';

const root = process.cwd();
const failures: string[] = [];
const warnings: string[] = [];

const read = (rel: string) => fs.readFileSync(path.join(root, rel), 'utf8');
const exists = (rel: string) => fs.existsSync(path.join(root, rel));

const pkg = JSON.parse(read('package.json'));
if (pkg?.engines?.node !== '24.x') failures.push('package.json engines.node harus 24.x');
if (pkg?.main !== 'server.js') failures.push('package.json main harus server.js');
if (pkg?.scripts?.start !== 'node server.js') failures.push('package.json scripts.start harus "node server.js"');

if (!exists('server.js')) failures.push('server.js wajib ada di root repository');
else {
  const entry = read('server.js');
  if (!entry.includes("import('./server.ts')")) failures.push('server.js harus menjalankan server.ts');
  if (/\bawait\s+import\s*\(/.test(entry)) failures.push('server.js tidak boleh memakai top-level await (Hostinger ERR_REQUIRE_ASYNC_MODULE)');
}

const envExample = read('.env.example');
for (const token of [
  'APP_URL=https://akkoperasional.com',
  'DB_HOST=localhost',
  'DB_PORT=3306',
  'DB_NAME=u649808503_ops_node',
  'DB_USER=u649808503_ops_node'
]) {
  if (!envExample.includes(token)) failures.push(`.env.example kehilangan baseline: ${token}`);
}

const forbiddenPaths = ['vercel.json', '.vercelignore', 'api/index.ts', '.env', '.env.local', 'bun.lock'];
for (const rel of forbiddenPaths) if (exists(rel)) failures.push(`File legacy/secret tidak boleh masuk source production: ${rel}`);
if (exists('public/assets/aistudio')) failures.push('public/assets/aistudio tidak boleh ikut build/public website');

const forbiddenText = [
  'honeydew-capybara-825103.hostingersite.com',
  'lavender-crow-224717.hostingersite.com',
  'u194997008_akk_operasional',
  'u194997008_akk_app',
  "'operasional123'",
  '"operasional123"',
  "'admin123'",
  '"admin123"'
];

const sourceExt = new Set(['.ts', '.tsx', '.js', '.jsx', '.json', '.md', '.html']);
function walk(dir: string) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    if (['node_modules', '.git', 'dist', 'dist-portal', 'dist-driver'].includes(ent.name)) continue;
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(full);
    else if (sourceExt.has(path.extname(ent.name))) {
      const rel = path.relative(root, full);
      if (rel === 'scripts/validate_hostinger_baseline.ts') continue;
      const text = fs.readFileSync(full, 'utf8');
      for (const token of forbiddenText) if (text.includes(token)) failures.push(`${rel}: masih mengandung nilai legacy/credential terlarang (${token})`);
    }
  }
}
walk(root);

if (exists('firebase-applet-config.json')) warnings.push('firebase-applet-config.json dipertahankan karena Google Auth masih dipakai. Pastikan akkoperasional.com ada di Firebase Authorized domains.');

if (warnings.length) {
  console.warn('⚠️ [Hostinger Baseline] Catatan:');
  warnings.forEach(x => console.warn(`   - ${x}`));
}
if (failures.length) {
  console.error('❌ [Hostinger Baseline] Source tidak sesuai baseline production:');
  failures.forEach(x => console.error(`   - ${x}`));
  process.exit(1);
}
console.log('✅ [Hostinger Baseline] Source sesuai baseline GitHub → Hostinger production.');
