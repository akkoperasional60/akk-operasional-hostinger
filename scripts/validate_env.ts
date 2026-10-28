import fs from 'fs';
import path from 'path';

console.log('🔍 [Pre-Build] Memeriksa konfigurasi Environment Website Hostinger...');

const envPath = path.resolve(process.cwd(), '.env');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf-8');
  envContent.split('\n').forEach(line => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx <= 0) return;
    const key = trimmed.substring(0, eqIdx).trim();
    const val = trimmed.substring(eqIdx + 1).trim().replace(/^["']|["']$/g, '');
    if (!process.env[key]) process.env[key] = val;
  });
}

// 1. Cek variabel wajib untuk runtime Hostinger MySQL
const requiredAtRuntime = ['DB_HOST', 'DB_PORT', 'DB_NAME', 'DB_USER', 'DB_PASSWORD'];
const missing = requiredAtRuntime.filter(key => !String(process.env[key] || '').trim());

if (missing.length > 0) {
  console.warn('⚠️ [Pre-Build] Environment database belum lengkap pada proses build:');
  missing.forEach(k => console.warn(`   - ${k}`));
  console.warn('   Build frontend tetap dilanjutkan. Pastikan semua variabel tersebut diatur di Hostinger sebelum aplikasi dijalankan.');
} else {
  console.log('✅ [Pre-Build] Environment Hostinger MySQL terdeteksi lengkap.');
}

// 1b. Cek URL production (warning saja agar staging/preview tetap bisa dibangun)
const appUrl = String(process.env.APP_URL || '').trim().replace(/\/+$/, '');
if (!appUrl) {
  console.warn('⚠️ [Pre-Build] APP_URL belum diisi. Production Hostinger harus memakai https://akkoperasional.com');
} else if (process.env.NODE_ENV === 'production' && appUrl !== 'https://akkoperasional.com') {
  console.warn(`⚠️ [Pre-Build] APP_URL production saat ini ${appUrl}. Baseline production resmi adalah https://akkoperasional.com`);
}

// 2. Cek SESSION_SECRET
const sessionSecret = String(process.env.SESSION_SECRET || '').trim();
if (sessionSecret.length < 32) {
  console.warn('⚠️ [Pre-Build] SESSION_SECRET belum diisi / kurang dari 32 karakter. Runtime production membutuhkan SESSION_SECRET minimal 32 karakter.');
}

// 3. Cek larangan penggunaan VITE_ untuk password / secret
const dangerousViteVars = Object.keys(process.env).filter(key =>
  key.startsWith('VITE_') &&
  /(PASSWORD|SECRET|KEYSTORE|DB_|SESSION_SECRET|BOOTSTRAP_ADMIN|WHATSAPP_API_KEY)/i.test(key)
);
if (dangerousViteVars.length > 0) {
  console.warn('🚨 [Keamanan] Terdeteksi variabel VITE_ yang berpotensi membocorkan secret/password ke frontend browser:');
  dangerousViteVars.forEach(k => console.warn(`   - ${k} (SEGERA HAPUS! Jangan pernah pakai prefix VITE_ untuk password/secret)`));
}

// 4. Cek variabel APK_* yang seharusnya DIHAPUS dari Environment Variables web Hostinger
const apkVarsInWebEnv = [
  'APK_KEYSTORE_PASSWORD',
  'APK_KEY_PASSWORD',
  'APK_KEY_ALIAS',
  'APK_PORTAL_URL',
  'APK_FALLBACK_PORTAL_URL'
].filter(key => Boolean(String(process.env[key] || '').trim()));

if (apkVarsInWebEnv.length > 0) {
  console.warn('⚠️ [Keamanan Hostinger] Variabel khusus build APK berikut terdeteksi di environment web dan sebaiknya DIHAPUS dari Hostinger:');
  apkVarsInWebEnv.forEach(k => console.warn(`   - ${k}`));
  console.warn('   Kelima variabel APK_* tersebut khusus untuk build APK Android, bukan kebutuhan runtime website Node.js.');
}

// 5. Cek konfigurasi BOOTSTRAP_ADMIN_*
const bootstrapEmail = String(process.env.BOOTSTRAP_ADMIN_EMAIL || '').trim();
const bootstrapPassword = String(process.env.BOOTSTRAP_ADMIN_PASSWORD || '');
if ((bootstrapEmail || bootstrapPassword) && (!bootstrapEmail || bootstrapPassword.length < 12)) {
  console.warn('⚠️ [Bootstrap Admin] Konfigurasi belum lengkap: isi BOOTSTRAP_ADMIN_EMAIL dan BOOTSTRAP_ADMIN_PASSWORD minimal 12 karakter, atau hapus setelah Super Admin pertama berhasil dibuat dan login.');
} else if (bootstrapPassword) {
  console.log('ℹ️ [Bootstrap Admin] BOOTSTRAP_ADMIN_PASSWORD aktif. Ingat: segera hapus BOOTSTRAP_ADMIN_PASSWORD (serta BOOTSTRAP_ADMIN_EMAIL & BOOTSTRAP_ADMIN_NAME) dari Hostinger setelah Super Admin berhasil dibuat dan login.');
}

console.log('🚀 [Pre-Build] Validasi selesai.');
process.exit(0);
