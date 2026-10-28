# Panduan Penanganan & Pemicu Unduh Android APK Asli dengan Vite

Dokumentasi ini menjelaskan arsitektur penyajian berkas biner Android APK (`akk-mobile-v1.apk`) pada proyek web **PT AKK Logistics Driver Portal**, mencakup konfigurasi Vite, Express backend, serta skrip kompilasi berkas installer resmi.

---

## 1. Mengapa Header `Content-Type: application/vnd.android.package-archive` Sangat Penting?

Pada sistem operasi Android, komponen **PackageInstaller / PackageManagerService** mengidentifikasi jenis berkas melalui kombinasi MIME Type HTTP dan struktur biner berkas:

1. **Pengenalan Tipe Berkas**:
   - Jika server mengirim `application/octet-stream` atau `text/plain`, peramban Android (Chrome, Samsung Internet, Mi Browser) kerap menambahkan ekstensi `.bin` atau menyimpannya sebagai file generik, sehingga tidak dapat langsung diketuk untuk diinstal.
   - Dengan `Content-Type: application/vnd.android.package-archive`, peramban dan *Download Manager* Android langsung mendeteksi bahwa berkas tersebut adalah installer aplikasi seluler.

2. **Paksaan Unduh Biner (`Content-Disposition`)**:
   - Header `Content-Disposition: attachment; filename="akk-mobile-v1.apk"` memaksa browser untuk langsung menyimpan berkas ke folder penyimpanan perangkat (*Downloads*) alih-alih mencoba merendernya.

3. **Integritas Aliran Byte (`Content-Length` & `Accept-Ranges`)**:
   - Header `Content-Length` dengan nilai byte yang tepat (misal: 15.520.597 byte atau ~14.8 MB) bersama `Accept-Ranges: bytes` memastikan perangkat tidak menghentikan unduhan di tengah jalan (misal: terpotong 10 KB).

---

## 2. Implementasi pada Konfigurasi Vite (`vite.config.ts`)

Di dalam `vite.config.ts`, terdapat plugin khusus `viteApkMimePlugin` yang menyisipkan middleware penanganan berkas APK:

```ts
import { defineConfig, type Plugin } from 'vite';

function viteApkMimePlugin(): Plugin {
  return {
    name: 'vite-apk-mime-headers',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = req.url || '';
        if (url.endsWith('.apk') || url.includes('/downloads/') || url.includes('akk-mobile')) {
          res.setHeader('Content-Type', 'application/vnd.android.package-archive');
          res.setHeader('Content-Disposition', 'attachment; filename="akk-mobile-v1.apk"');
          res.setHeader('Content-Transfer-Encoding', 'binary');
          res.setHeader('Accept-Ranges', 'bytes');
          res.setHeader('Cache-Control', 'public, max-age=3600');
        }
        next();
      });
    },
    configurePreviewServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = req.url || '';
        if (url.endsWith('.apk') || url.includes('/downloads/') || url.includes('akk-mobile')) {
          res.setHeader('Content-Type', 'application/vnd.android.package-archive');
          res.setHeader('Content-Disposition', 'attachment; filename="akk-mobile-v1.apk"');
          res.setHeader('Content-Transfer-Encoding', 'binary');
          res.setHeader('Accept-Ranges', 'bytes');
        }
        next();
      });
    }
  };
}

export default defineConfig(() => ({
  plugins: [react(), tailwindcss(), viteApkMimePlugin()],
  // ...
}));
```

---

## 3. Implementasi pada Backend Express (`server.ts`)

Saat aplikasi dijalankan via `server.ts` (yang menggabungkan Express + Vite middleware), Express menyajikan berkas melalui *read stream pipe* dengan pengecekan kandidat jalur yang lengkap:

```ts
const serveApkFile = (filename: string, res: express.Response) => {
  const safeFilename = filename.endsWith('.apk') ? filename : `${filename}.apk`;
  const candidates = [
    path.join(process.cwd(), 'public', safeFilename),
    path.join(process.cwd(), 'public', 'downloads', safeFilename),
    path.join(process.cwd(), 'downloads', safeFilename),
    path.join(process.cwd(), 'dist', safeFilename),
    path.join(process.cwd(), 'dist', 'downloads', safeFilename)
  ];

  for (const filePath of candidates) {
    if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
      const stat = fs.statSync(filePath);
      res.setHeader('Content-Type', 'application/vnd.android.package-archive');
      res.setHeader('Content-Disposition', `attachment; filename="${safeFilename}"`);
      res.setHeader('Content-Length', stat.size.toString());
      res.setHeader('Content-Transfer-Encoding', 'binary');
      res.setHeader('Accept-Ranges', 'bytes');
      res.setHeader('Cache-Control', 'public, max-age=3600');

      const fileStream = fs.createReadStream(filePath);
      return fileStream.pipe(res);
    }
  }
  return res.status(404).send('File APK tidak ditemukan.');
};

app.get(['/api/download-apk', '/api/apk'], (req, res) => serveApkFile('akk-mobile-v1.apk', res));
app.get('/downloads/:filename', (req, res) => serveApkFile(req.params.filename, res));
app.get(['/akk-mobile-v1.apk', '/:filename.apk'], (req, res) => serveApkFile(req.params.filename || 'akk-mobile-v1.apk', res));
```

---

## 4. Skrip Pembangunan APK Mandiri (`npm run build:apk`)

Proyek menyediakan skrip build otomatis di `scripts/build_apk.py` yang dapat dipicu melalui:

```bash
npm run build:apk
```

### Tahapan yang Dijalankan:
1. **Manifest Kompilasi (AXML)**: Mengompilasi `AndroidManifest.xml` ke format biner menggunakan `aapt` (bukan XML teks biasa).
2. **Kompilasi Dalvik**: Mengompilasi kode Java dengan `javac` lalu mengubahnya menjadi bytecode Dalvik `classes.dex` menggunakan `dx`.
3. **Pengemasan Aset**: Menyatukan sumber daya antarmuka offline dan ikon launcher resolusi tinggi (`res/mipmap-*`).
4. **Penyelarasan Memori (Zipalign)**: Menjalankan `zipalign -p 4` untuk optimasi pembacaan memori RAM Android.
5. **Penandatanganan Digital (Apksigner)**: Menandatangani berkas dengan skema ganda **v1 (JAR signing)** dan **v2 (APK Signature Scheme v2)**.
6. **Distribusi Otomatis**: Menyalin hasil build ke satu lokasi canonical: `public/downloads/akk-mobile-v1.apk`. Nama alias lama dilayani oleh route Express tanpa menduplikasi binary.

---

## 5. Cara Memverifikasi Hasil Build

Untuk memastikan integritas paket APK yang telah dibangun:

1. **Cek Tanda Tangan Digital**:
   ```bash
   apksigner verify -v public/downloads/akk-mobile-v1.apk
   ```
   *Hasil yang diharapkan: `Verifies`, `Verified using v1 scheme: true`, `Verified using v2 scheme: true`.*

2. **Cek Informasi Paket (Badging)**:
   ```bash
   aapt dump badging public/downloads/akk-mobile-v1.apk | head -n 10
   ```
   *Hasil yang diharapkan: Menampilkan package `com.akk.driver`, versionCode, versionName `1.0.4`, dan launchable activity.*

3. **Cek Header HTTP Server**:
   ```bash
   curl -I http://localhost:3000/downloads/akk-mobile-v1.apk
   ```
   *Hasil yang diharapkan:*
   ```http
   HTTP/1.1 200 OK
   Content-Type: application/vnd.android.package-archive
   Content-Disposition: attachment; filename="akk-mobile-v1.apk"
   Content-Length: 15520597
   ```
