# AKK Operasional — Hostinger Production Baseline

Dokumen ini adalah guardrail untuk Google AI Studio, GitHub, dan Hostinger. Jangan mengembalikan arsitektur lama.

## Production tetap

- Domain: `https://akkoperasional.com`
- GitHub branch: `main`
- Hostinger framework: Express
- Node.js: `24.x`
- Package manager: `npm`
- Root directory: `./`
- Entry file: `server.js`
- Backend utama: `server.ts`
- Frontend: React + Vite (`dist/`)
- Database: Hostinger MySQL/MariaDB (`DB_NAME=u649808503_ops_node`, `DB_USER=u649808503_ops_node`)
- Database host: `localhost:3306`
- Auth: MySQL + HttpOnly session cookie

## Jangan diubah oleh AI Studio

1. Jangan hapus `server.js`. Hostinger hanya menerima entry `.js`.
2. Jangan menambahkan top-level `await` pada `server.js`.
3. Jangan menurunkan Node dari 24.x.
4. Jangan mengembalikan Vercel/serverless `api/index.ts` atau Supabase sebagai database utama.
5. Jangan hardcode password, API key, DB password, `SESSION_SECRET`, atau credential Tracksolid ke source/frontend.
6. Jangan commit `.env`, `.env.local`, `node_modules/`, `dist/`, keystore APK, atau `public/assets/aistudio/`.
7. Jangan membuat user Super Admin otomatis dari login pertama. Bootstrap hanya melalui `BOOTSTRAP_ADMIN_*` yang eksplisit dan harus dihapus setelah akun pertama aktif.
8. Jangan `DROP`, `TRUNCATE`, reset, atau overwrite database production. Perubahan schema harus non-destruktif.
9. Jangan menambahkan email/password/hash default untuk akun preview di source. Preview login hanya melalui `PREVIEW_ADMIN_*` environment.

## Alur deploy resmi

`Google AI Studio → GitHub main → Hostinger auto-deploy → npm install → npm run build → node server.js`

`npm run build` menjalankan baseline validator. Jika AI Studio merusak konfigurasi production, build sengaja dihentikan sebelum deploy.
