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
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (!id.includes('node_modules')) return;
            if (id.includes('react-dom') || id.includes('/react/') || id.includes('scheduler')) {
              return 'react-vendor';
            }
            if (id.includes('lucide-react')) {
              return 'icons-vendor';
            }
            if (id.includes('recharts') || id.includes('d3-')) {
              return 'charts-vendor';
            }
            if (id.includes('leaflet')) {
              return 'map-vendor';
            }
            if (id.includes('three')) {
              return 'three-vendor';
            }
            if (id.includes('jspdf') || id.includes('html2canvas')) {
              return 'pdf-vendor';
            }
            if (id.includes('xlsx')) {
              return 'xlsx-vendor';
            }
            if (id.includes('firebase')) {
              return 'firebase-vendor';
            }
          },
        },
      },
    },
    define: {
      'import.meta.env.VITE_BUILD_TARGET': JSON.stringify(buildTarget),
    },
    resolve: {
      dedupe: ['react', 'react-dom'],
      alias: {
        '@': path.resolve(import.meta.dirname || '.'),
      },
    },
    optimizeDeps: {
      entries: ['index.html'],
      include: [
        'react',
        'react-dom',
        'react-dom/client',
        'react/jsx-dev-runtime',
        'react/jsx-runtime',
        'lucide-react',
      ],
      exclude: ['onnxruntime-web'],
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var or K_SERVICE.
      hmr: process.env.DISABLE_HMR !== 'true' && !process.env.K_SERVICE,
      watch: {},
    },
  };
});
