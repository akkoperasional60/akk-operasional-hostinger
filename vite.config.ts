import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, type Plugin} from 'vite';

/**
 * Vite Plugin: APK MIME Type & Direct Binary Download Headers
 * -----------------------------------------------------------
 * Konfigurasi ini menjamin bahwa server Vite (dev server & preview)
 * menyajikan berkas installer Android dengan header standar industri:
 *
 * 1. Content-Type: 'application/vnd.android.package-archive'
 *    -> Diperlukan oleh Android OS PackageInstaller agar berkas dikenali
 *       sebagai aplikasi Android yang dapat diinstal, bukan teks/octet-stream.
 *
 * 2. Content-Disposition: 'attachment; filename="akk-mobile-v1.apk"'
 *    -> Memastikan browser dan download manager Android mengunduh biner asli
 *       ke folder Unduhan HP tanpa mencoba merendernya di peramban.
 *
 * 3. Content-Transfer-Encoding: 'binary' & Accept-Ranges: 'bytes'
 *    -> Menjamin integritas unduhan biner utuh (14.8 MB) tanpa pemotongan chunk.
 */
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

export default defineConfig(() => {
  const buildTarget = process.env.BUILD_TARGET || 'dist';
  const outDir = buildTarget === 'driver' 
    ? 'dist-driver' 
    : (process.env.BUILD_TARGET === 'portal' ? 'dist-portal' : 'dist');

  return {
    plugins: [react(), tailwindcss(), viteApkMimePlugin()],
    build: {
      outDir,
      emptyOutDir: true,
    },
    define: {
      'import.meta.env.VITE_BUILD_TARGET': JSON.stringify(buildTarget),
    },
    resolve: {
      alias: {
        '@': path.resolve(import.meta.dirname || '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
