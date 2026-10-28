import React, { useState } from 'react';
import {
  Smartphone,
  Download,
  CheckCircle2,
  X,
  QrCode,
  ShieldCheck,
  Copy,
  Check,
  Radio,
  FileText,
  Layers,
  Truck,
  Sparkles
} from 'lucide-react';
import {
  AKK_WEB_PORTAL_APK_INFO,
  AKK_DRIVER_MOBILE_APK_INFO,
  downloadApkVariantWithVerification,
  promptPwaInstall,
  ApkDownloadProgress
} from '../utils/apkDownloader';
import { useToast } from '../context/ToastContext';

interface AndroidApkDownloadModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AndroidApkDownloadModal: React.FC<AndroidApkDownloadModalProps> = ({
  isOpen,
  onClose
}) => {
  const { addNotification } = useToast();
  const [selectedVariant, setSelectedVariant] = useState<'driver' | 'web'>('driver');
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState<number>(0);
  const [downloadedBytes, setDownloadedBytes] = useState<number>(0);
  const [downloadSuccess, setDownloadSuccess] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [isCopied, setIsCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<'download' | 'guide' | 'wrapper'>('download');

  if (!isOpen) return null;

  const currentInfo = selectedVariant === 'web' ? AKK_WEB_PORTAL_APK_INFO : AKK_DRIVER_MOBILE_APK_INFO;

  const handleDownload = async () => {
    setIsDownloading(true);
    setDownloadProgress(0);
    setDownloadedBytes(0);
    setDownloadError(null);
    setDownloadSuccess(false);

    try {
      const result = await downloadApkVariantWithVerification(
        currentInfo.fileName,
        (progress: ApkDownloadProgress) => {
          setDownloadProgress(progress.percent);
          setDownloadedBytes(progress.receivedBytes);
        }
      );

      setIsDownloading(false);

      if (result.success && result.sizeBytes >= 1000000) {
        setDownloadSuccess(true);
        const sizeMb = (result.sizeBytes / (1024 * 1024)).toFixed(1);
        addNotification(
          'delivery',
          'Unduhan APK Sukses',
          `Berkas ${currentInfo.fileName} (${sizeMb} MB) berhasil diunduh ke perangkat.`
        );
      } else {
        setDownloadError(result.error || 'Gagal memverifikasi ukuran berkas APK');
        addNotification(
          'sla_warning',
          'Gagal Mengunduh',
          result.error || 'Ukuran berkas tidak sesuai target 14.8 MB.'
        );
      }
    } catch (err: any) {
      setIsDownloading(false);
      setDownloadError(err?.message || 'Terjadi kesalahan saat mengunduh');
    }
  };

  const handleCopyLink = () => {
    const directApkUrl = `${window.location.origin}/downloads/${currentInfo.fileName}`;
    navigator.clipboard.writeText(directApkUrl);
    setIsCopied(true);
    addNotification('schedule', 'Tautan Langsung Disalin', `Tautan unduh ${currentInfo.fileName} (14.8 MB) berhasil disalin.`);
    setTimeout(() => setIsCopied(false), 2000);
  };

  const handlePwaInstall = async () => {
    const result = await promptPwaInstall();
    if (result === 'accepted') {
      addNotification('delivery', 'Aplikasi Dipasang', 'Aplikasi AKK berhasil dipasang di layar utama perangkat.');
      onClose();
    } else if (result === 'unsupported') {
      handleDownload();
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-xl max-h-[94vh] flex flex-col shadow-2xl overflow-hidden my-auto neu-flat">
        
        {/* Top Header */}
        <div className="bg-slate-950 p-5 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-emerald-600 to-cyan-400 p-0.5 shadow-lg shadow-emerald-500/25">
              <div className="w-full h-full bg-slate-950 rounded-[14px] flex items-center justify-center text-emerald-400">
                <Smartphone className="w-6 h-6 animate-pulse" />
              </div>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-black text-white uppercase tracking-tight">
                  Pusat Unduhan APK Android PT AKK
                </h3>
                <span className="text-[10px] px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 font-bold">
                  {currentInfo.version}
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Pilih varian instalasi APK sesuai kebutuhan operasional perangkat
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer neu-button"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Variant Selector Tabs (User Request 5) */}
        <div className="p-4 bg-slate-950/70 border-b border-slate-800/80">
          <label className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-2.5 block flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            Pilih Varian APK Android:
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button
              onClick={() => setSelectedVariant('driver')}
              className={`p-3.5 rounded-2xl border text-left transition cursor-pointer flex items-start gap-3 ${
                selectedVariant === 'driver'
                  ? 'bg-emerald-950/40 border-emerald-500/80 shadow-lg shadow-emerald-900/30 neu-pressed'
                  : 'bg-slate-900/90 border-slate-800 hover:border-slate-700 neu-flat-sm'
              }`}
            >
              <div className={`p-2 rounded-xl mt-0.5 ${selectedVariant === 'driver' ? 'bg-emerald-500 text-slate-950' : 'bg-slate-800 text-slate-300'}`}>
                <Truck className="w-5 h-5" />
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-white">APK Khusus Driver &amp; Helper</span>
                  {selectedVariant === 'driver' && <CheckCircle2 className="w-4 h-4 text-emerald-400" />}
                </div>
                <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
                  Hanya berisi sub menu portal driver mobile saja (Presensi, Surat Jalan, Checklist Kelaikan, Kamera POD, GPS).
                </p>
                <div className="mt-2 text-[10px] font-mono text-emerald-400 font-bold bg-emerald-500/10 px-2 py-0.5 rounded inline-block border border-emerald-500/20">
                  akk-driver-mobile.apk (14.8 MB)
                </div>
              </div>
            </button>

            <button
              onClick={() => setSelectedVariant('web')}
              className={`p-3.5 rounded-2xl border text-left transition cursor-pointer flex items-start gap-3 ${
                selectedVariant === 'web'
                  ? 'bg-cyan-950/40 border-cyan-500/80 shadow-lg shadow-cyan-900/30 neu-pressed'
                  : 'bg-slate-900/90 border-slate-800 hover:border-slate-700 neu-flat-sm'
              }`}
            >
              <div className={`p-2 rounded-xl mt-0.5 ${selectedVariant === 'web' ? 'bg-cyan-500 text-slate-950' : 'bg-slate-800 text-slate-300'}`}>
                <Layers className="w-5 h-5" />
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-white">APK Web (Semua Menu)</span>
                  {selectedVariant === 'web' && <CheckCircle2 className="w-4 h-4 text-cyan-400" />}
                </div>
                <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
                  Berisi seluruh menu portal administratif (Dashboard Eksekutif, Logistik, Sales, Purchasing, HR, Finance, Driver Portal).
                </p>
                <div className="mt-2 text-[10px] font-mono text-cyan-400 font-bold bg-cyan-500/10 px-2 py-0.5 rounded inline-block border border-cyan-500/20">
                  akk-web-portal.apk (14.8 MB)
                </div>
              </div>
            </button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="px-5 pt-3 flex gap-3 border-b border-slate-800/80 bg-slate-950/40">
          <button
            onClick={() => setActiveTab('download')}
            className={`pb-2.5 px-3 text-xs font-bold transition border-b-2 cursor-pointer ${
              activeTab === 'download'
                ? 'border-emerald-500 text-emerald-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            Unduh Berkas APK &amp; QR
          </button>
          <button
            onClick={() => setActiveTab('guide')}
            className={`pb-2.5 px-3 text-xs font-bold transition border-b-2 cursor-pointer ${
              activeTab === 'guide'
                ? 'border-emerald-500 text-emerald-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            Panduan Instalasi Android
          </button>
          <button
            onClick={() => setActiveTab('wrapper')}
            className={`pb-2.5 px-3 text-xs font-bold transition border-b-2 cursor-pointer ${
              activeTab === 'wrapper'
                ? 'border-cyan-500 text-cyan-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            Native Wrapper (GPS &amp; Camera)
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 flex-1 overflow-y-auto space-y-5">
          {activeTab === 'download' ? (
            <>
              {/* Selected Variant Summary Card */}
              <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-3 neu-flat-sm">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-white flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-emerald-400" />
                    Varian Dipilih: <span className="text-emerald-400">{currentInfo.fileName}</span>
                  </span>
                  <span className="text-[11px] font-mono text-slate-300 bg-slate-800 px-2 py-0.5 rounded">
                    {currentInfo.fileSizeMb} MB
                  </span>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">
                  {currentInfo.description}
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                  {currentInfo.features.map((feat, idx) => (
                    <div key={feat + idx} className="flex items-center gap-2 text-[11px] text-slate-300">
                      <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
                      <span>{feat}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Download Action Section */}
              <div className="flex flex-col sm:flex-row items-center gap-4 bg-slate-950/60 p-4 rounded-2xl border border-slate-800">
                <div className="w-32 h-32 bg-white p-2 rounded-2xl shadow-inner flex items-center justify-center shrink-0">
                  <img
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(
                      window.location.origin + '/downloads/' + currentInfo.fileName
                    )}`}
                    alt="QR Code APK Download"
                    className="w-full h-full object-contain rounded-xl"
                  />
                </div>

                <div className="flex-1 space-y-3 w-full">
                  <div>
                    <h4 className="text-xs font-bold text-white uppercase tracking-tight flex items-center gap-1.5">
                      <QrCode className="w-4 h-4 text-cyan-400" />
                      Pindai QR atau Unduh Langsung
                    </h4>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Sopir atau admin dapat memindai QR di samping menggunakan kamera HP Android, atau mengetuk tombol unduh di bawah ini.
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={handleDownload}
                      disabled={isDownloading}
                      className="flex-1 bg-gradient-to-r from-emerald-600 to-cyan-600 hover:from-emerald-500 hover:to-cyan-500 text-white font-bold text-xs py-3 px-4 rounded-xl shadow-lg shadow-emerald-900/30 flex items-center justify-center gap-2 transition cursor-pointer disabled:opacity-50 neu-button"
                    >
                      {isDownloading ? (
                        <>
                          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          <span>Mengunduh... {downloadProgress}%</span>
                        </>
                      ) : (
                        <>
                          <Download className="w-4 h-4" />
                          <span>Unduh File {currentInfo.fileName}</span>
                        </>
                      )}
                    </button>

                    <button
                      onClick={handleCopyLink}
                      className="bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs py-3 px-3.5 rounded-xl border border-slate-700 flex items-center gap-1.5 transition cursor-pointer neu-button"
                    >
                      {isCopied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4 text-slate-300" />}
                      <span>{isCopied ? 'Disalin!' : 'Salin Tautan'}</span>
                    </button>
                  </div>

                  {/* PWA Fallback */}
                  <div className="pt-1">
                    <button
                      onClick={handlePwaInstall}
                      className="w-full text-center text-[11px] text-cyan-400 hover:text-cyan-300 underline font-semibold transition cursor-pointer"
                    >
                      Atau pasang sebagai Web App (PWA) instan di layar utama HP
                    </button>
                  </div>
                </div>
              </div>

              {downloadSuccess && (
                <div className="bg-emerald-950/40 border border-emerald-500/40 p-3.5 rounded-2xl flex items-center gap-3">
                  <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                  <div className="text-xs text-emerald-200">
                    <span className="font-bold">Unduhan Berhasil!</span> Berkas <code className="font-mono text-emerald-300">{currentInfo.fileName}</code> telah disimpan di perangkat. Buka berkas dari notifikasi unduhan untuk menginstal.
                  </div>
                </div>
              )}

              {downloadError && (
                <div className="bg-rose-950/40 border border-rose-500/40 p-3.5 rounded-2xl flex items-center gap-3">
                  <X className="w-5 h-5 text-rose-400 shrink-0" />
                  <div className="text-xs text-rose-200">
                    <span className="font-bold">Gagal Mengunduh:</span> {downloadError}
                  </div>
                </div>
              )}
            </>
          ) : activeTab === 'guide' ? (
            <div className="space-y-4 text-xs text-slate-300 leading-relaxed">
              <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-2 neu-flat-sm">
                <h5 className="font-bold text-white flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-emerald-500 text-slate-950 flex items-center justify-center text-[11px] font-black">1</span>
                  Izinkan Instalasi dari Sumber Tidak Dikenal
                </h5>
                <p className="text-slate-400 pl-7">
                  Buka <strong>Pengaturan (Settings) &gt; Keamanan (Security)</strong> di HP Android Anda, lalu aktifkan opsi <strong>"Sumber Tidak Dikenal" (Install Unknown Apps)</strong> untuk browser Anda (Chrome).
                </p>
              </div>

              <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-2 neu-flat-sm">
                <h5 className="font-bold text-white flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-emerald-500 text-slate-950 flex items-center justify-center text-[11px] font-black">2</span>
                  Unduh &amp; Buka Berkas APK
                </h5>
                <p className="text-slate-400 pl-7">
                  Ketuk tombol <strong className="text-emerald-400">Unduh File {currentInfo.fileName}</strong> di atas. Setelah selesai terunduh (~14.8 MB), ketuk notifikasi unduhan pada panel HP Anda.
                </p>
              </div>

              <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-2 neu-flat-sm">
                <h5 className="font-bold text-white flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-emerald-500 text-slate-950 flex items-center justify-center text-[11px] font-black">3</span>
                  Instal &amp; Sinkronisasi Realtime
                </h5>
                <p className="text-slate-400 pl-7">
                  Pilih <strong className="text-white">Instal (Install)</strong>. Aplikasi akan terpasang dengan ikon resmi PT AKK dan otomatis menyinkronkan data secara *real-time* via Hostinger MySQL dengan portal administrasi utama!
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-4 text-xs text-slate-300 leading-relaxed">
              <div className="bg-slate-950 p-4 rounded-2xl border border-emerald-500/30 space-y-2.5 neu-flat-sm">
                <h5 className="font-bold text-white flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  1. Konfigurasi Izin GPS &amp; Kamera di AndroidManifest.xml
                </h5>
                <p className="text-slate-400">
                  Tambahkan izin hardware lokasi GPS presisi tinggi dan kamera untuk fitur POD serta pelacakan real-time pada <code className="text-cyan-300 font-mono">app/src/main/AndroidManifest.xml</code>:
                </p>
                <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 font-mono text-[11px] text-amber-300 overflow-x-auto whitespace-pre">
{`<!-- 🧭 GPS / Location Permissions -->
<uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
<uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION" />
<uses-feature android:name="android.hardware.location.gps" android:required="false" />

<!-- 📷 Camera & File Storage Permissions -->
<uses-permission android:name="android.permission.CAMERA" />
<uses-feature android:name="android.hardware.camera" android:required="false" />
<uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE" android:maxSdkVersion="32" />

<!-- 🌐 Internet & Network State -->
<uses-permission android:name="android.permission.INTERNET" />
<uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />`}
                </div>
              </div>

              <div className="bg-slate-950 p-4 rounded-2xl border border-cyan-500/30 space-y-2.5 neu-flat-sm">
                <h5 className="font-bold text-white flex items-center gap-2">
                  <Smartphone className="w-4 h-4 text-cyan-400" />
                  2. Native WebView Wrapper di MainActivity.kt
                </h5>
                <p className="text-slate-400">
                  Aktifkan JavaScript, DOM Storage, HTML5 Geolocation API, dan runtime permissions pada <code className="text-cyan-300 font-mono">MainActivity.kt</code>:
                </p>
                <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 font-mono text-[11px] text-cyan-200 overflow-x-auto max-h-64 whitespace-pre">
{`package com.akk.packaging.logistik

import android.Manifest
import android.content.pm.PackageManager
import android.os.Bundle
import android.webkit.*
import androidx.appcompat.app.AppCompatActivity
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat

class MainActivity : AppCompatActivity() {
    private lateinit var webView: WebView
    private val REQ_CODE = 1001

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)
        webView = findViewById(R.id.webView)

        val s = webView.settings
        s.javaScriptEnabled = true
        s.domStorageEnabled = true
        s.databaseEnabled = true
        s.setGeolocationEnabled(true)
        s.allowFileAccess = true

        webView.webChromeClient = object : WebChromeClient() {
            override fun onGeolocationPermissionsShowPrompt(o: String?, c: GeolocationPermissions.Callback?) {
                c?.invoke(o, true, false)
            }
        }

        // Request GPS & Camera runtime permissions
        ActivityCompat.requestPermissions(this, arrayOf(
            Manifest.permission.ACCESS_FINE_LOCATION,
            Manifest.permission.CAMERA
        ), REQ_CODE)

        webView.loadUrl("https://akkoperasional.com/?tab=driver_portal")
    }
}`}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="bg-slate-950 p-4 border-t border-slate-800 flex items-center justify-between text-[11px] text-slate-400">
          <div>
            Paket Resmi PT AKK Logistics • Kompatibel Android 5.0 - 15+
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-xl transition cursor-pointer neu-button"
          >
            Tutup
          </button>
        </div>

      </div>
    </div>
  );
};
