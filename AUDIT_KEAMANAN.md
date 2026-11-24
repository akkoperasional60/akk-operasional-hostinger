# Laporan Audit & Revisi — akk60_operasionalbwi (target: Hostinger)

Tanggal audit: 12 November 2026. Metode: analisis statis seluruh source (server.ts, server/, scripts/, konfigurasi, 170 file TS/TSX/JS) + patch otomatis.

## A. Diperbaiki otomatis

| # | Tingkat | Temuan | Perbaikan |
|---|---------|--------|-----------|
| 1 | Kritis | `POST /api/schedules/:id/bypass-checklist` bisa dipanggil TANPA login (pengecekan peran dilewati bila tidak ada sesi) | Wajib login dengan peran `super_admin`/`admin` |
| 2 | Kritis | Endpoint data terbuka tanpa autentikasi: `fleet-checklists` (baca/tulis/hapus), `sales-rfid-invoices`, `admin-schedules`, seluruh `database-barang/*` (termasuk hapus), `yolo/*`, `scan-muat`, `wms-scanner/*` | Semua kini `requireAuth`. `DELETE /api/database-barang/:id` sebelumnya lolos bila tanpa sesi |
| 3 | Tinggi | `DELETE /api/driver-reports/:id` terbuka bila DB belum terkonfigurasi | Wajib `super_admin`/`admin` |
| 4 | Tinggi | Stored XSS pada fitur Cetak (SystemActivityLog): nama pengguna/detail aktivitas ditulis mentah via `document.write` | Semua nilai di-escape (`escapeHtml`) |
| 5 | Tinggi | Tidak ada pembatas percobaan login → brute force | Rate-limit: 10 gagal/akun/15 mnt, 100 gagal/IP/15 mnt (HTTP 429) |
| 6 | Tinggi | Registrasi tanpa batas → spam akun pending | Maks 10 registrasi/IP/15 mnt + validasi email |
| 7 | Tinggi | Body 35 MB diterima dari siapa pun sebelum autentikasi (DoS memori di shared hosting). Batas 50 MB per-route juga tidak pernah berlaku karena tertimpa parser global | Parser bertingkat: tanpa sesi valid maks 100 KB; sesi valid 35 MB; 50 MB hanya untuk impor jadwal |
| 8 | Tinggi | Secret sesi bisa jatuh ke nilai default yang bisa ditebak | Di production, tanpa `SESSION_SECRET`/DB creds → server menolak membuat sesi |
| 9 | Sedang | `/api/proxy-sheet` meneruskan token sesi aplikasi ke Google | Hanya meneruskan Authorization bila bukan token sesi aplikasi |
| 10 | Sedang | `/api/db-status` publik membocorkan pesan error MySQL & status password | Detail hanya untuk Super Admin |
| 11 | Sedang | Pesan error login/register membocorkan detail DB | Pesan generik di production |
| 12 | Sedang | Path traversal pada unduhan APK (`/downloads/:filename`) | Whitelist nama file + `path.basename` |
| 13 | Sedang | Login: status akun diungkap sebelum password diverifikasi (enumerasi akun); pencocokan nama depan bisa memilih akun salah | Status diungkap setelah password benar; urutan prioritas email → id → username |
| 14 | Sedang | Tidak ada header anti-clickjacking/HSTS di production | `X-Frame-Options`, `frame-ancestors`, HSTS, Permissions-Policy (preview AI Studio tetap boleh iframe) |
| 15 | Rendah | Tidak ada penangan error global / unhandledRejection (proses bisa mati di Hostinger) | Error handler JSON, handler proses, `startServer().catch` |
| 16 | Rendah | `data/server_app_state.json` (state runtime) ikut ter-commit | Ditambah ke `.gitignore`, file dihapus dari paket |

Catatan perilaku: request besar tanpa sesi valid dijawab 401 (bukan 413) agar antrean sinkronisasi offline sopir tidak membuang data.

## B. WAJIB Anda lakukan sebelum push

1. **Regenerasi `package-lock.json`**: lock tidak memuat `sharp`, `onnxruntime-node`, `onnxruntime-web` (tidak sinkron dengan `package.json`). Jalankan `npm install` di komputer Anda lalu commit lock yang baru. (`npm install` di Hostinger tetap jalan, tapi `npm ci` akan gagal.)
2. **Jalankan `npm run build` & `npm run lint` secara lokal.** Saya tidak bisa menjalankan build/tsc: sandbox tanpa internet sehingga dependensi tidak bisa di-install. Yang tervalidasi: sintaks 170 file lolos, dan validator prebuild (`validate_hostinger_baseline`, `validate_env`) lolos.
3. Di Hostinger pastikan `SESSION_SECRET` (≥32 karakter acak) dan `DB_*` terisi — kini wajib, bila kosong login akan gagal.
4. Setelah deploy, uji: login, logout, jadwal, scan muat, checklist sopir, database barang, cetak laporan.
5. Firebase: pastikan `akkoperasional.com` ada di *Authorized domains*, dan batasi API key (`firebase-applet-config.json`) berdasarkan HTTP referrer di Google Cloud Console (key web memang publik, tetapi sebaiknya dibatasi).

## C. Temuan yang TIDAK saya ubah (butuh keputusan Anda)

- Token sesi juga disimpan di `localStorage` (selain cookie HttpOnly) — rentan bila ada XSS lain. Perlu perubahan arsitektur APK.
- Rate-limit per-akun dapat dipakai penyerang untuk mengunci sementara akun tertentu (15 menit). Trade-off standar.
- Rate-limit in-memory: reset saat server restart; cukup untuk 1 proses Node di Hostinger.
- `onnxruntime-node` (± ratusan MB) dan `sharp` berat untuk shared hosting; jika memori/instalasi bermasalah, pertimbangkan menonaktifkan fitur YOLO sisi server.
- Server berjalan lewat `tsx` saat runtime (`server.js` → `server.ts`): lebih lambat start & lebih boros memori dibanding hasil build; sengaja tidak diubah karena dilindungi baseline Hostinger.
- Ekspor CSV belum menetralkan sel berawalan `=`, `+`, `-`, `@` (CSV/formula injection di Excel).
- `publicUser()` memiliki pengecualian nama untuk satu alamat email tertentu (hardcode); sebaiknya dipindah ke data.
- Folder `notebooks/` (2,6 MB) dan `docs/` ikut ter-deploy; aman, tetapi bisa dikeluarkan dari repo produksi.
- State beberapa fitur (mis. admin-schedules, invoice RFID) di-cache in-memory per proses; bila Hostinger menjalankan lebih dari satu instance, data bisa tidak konsisten.

## D. Revisi tahap 2 (paket: Hostinger Unlimited / shared hosting)

| Perubahan | Detail |
|-----------|--------|
| Sesi di MySQL | Tabel baru `user_sessions` (dibuat otomatis, non-destruktif). Menyimpan hash ID sesi. Logout kini benar-benar mencabut sesi; ada `POST /api/auth/logout-all`; reset password mencabut semua sesi user itu. Token lama (tanpa sid) tetap berlaku sampai habis masa 30 harinya. Bila tabel bermasalah, login tetap jalan (tanpa kemampuan cabut) |
| Rate limit | Kunci kini per **akun+IP** (10 gagal/15 mnt), dengan batas global akun 40 gagal (serangan terdistribusi) dan per IP 100. Admin asli dari IP lain tidak ikut terkunci |
| `sharp` | Dimuat malas (dynamic import). Jika gagal ter-install, server tetap hidup |
| `onnxruntime-node` | Dipindah ke `optionalDependencies` agar kegagalan install tidak menggagalkan build. Kode sudah memakai `import()` + try/catch |
| Inferensi YOLO server | Dibatasi 1 proses bersamaan (`YOLO_SERVER_MAX_CONCURRENCY`); selebihnya dijawab 503 + Retry-After. Jalur utama sebaiknya tetap deteksi di browser (onnxruntime-web) |
| Schema DB | `ensureDatabaseSchema` kini di-memoize (sebelumnya dijalankan tiap login) |

Pengujian: logika sesi & rate-limit diuji dengan 14 skenario memakai kode asli dari `server.ts` dan DB tiruan (semua lulus). Belum diuji terhadap MySQL Hostinger sungguhan.

Tidak dikerjakan (tidak diperlukan di shared hosting yang menjalankan satu proses): migrasi penyimpanan in-memory ke MySQL untuk skenario multi-instance. Bila suatu saat pindah ke VPS/Cloud dengan banyak instance, kerjakan sesuai saran tahap sebelumnya.
