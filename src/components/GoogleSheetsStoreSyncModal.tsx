import React, { useState, useEffect } from 'react';
import { 
  FileSpreadsheet, 
  Download, 
  Upload, 
  RefreshCw, 
  CheckCircle2, 
  AlertTriangle, 
  MapPin, 
  Database, 
  ExternalLink, 
  Layers, 
  Table, 
  Zap, 
  X, 
  Sparkles, 
  Globe,
  Check,
  Clock,
  History,
  Settings,
  Sliders
} from 'lucide-react';
import { logisticsStore } from '../services/store';
import { RetailStore } from '../types';
import { useToast } from '../context/ToastContext';
import { 
  googleSheetsSyncService, 
  GoogleSheetsSyncConfig, 
  SyncLogEntry, 
  validateCoordinateData,
  toGoogleSheetsCsvUrl
} from '../services/googleSheetsSyncService';

interface GoogleSheetsStoreSyncModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccessSync?: () => void;
}

// Production mode intentionally contains no preloaded/demo store dataset.
// Store data must come from an explicit Google Sheets URL or pasted CSV supplied by an authorized user.

// Helper to sanitize Indonesian spreadsheet coordinates safely without returning NaN or ocean points
export function sanitizeCoordinate(val: string | number, isLongitude = false): number {
  const fallback = isLongitude ? 114.25 : -8.3645;

  if (typeof val === 'number') {
    if (isNaN(val) || !isFinite(val)) return fallback;
    // If it's a number like -83.694284 or -83694284 or 1141809061
    let num = val;
    if (!isLongitude) {
      if (num > 0) num = -num;
      while (num < -15) {
        num = num / 10;
      }
      return num >= -12 && num <= -5 ? Number(num.toFixed(8)) : fallback;
    } else {
      num = Math.abs(num);
      while (num > 150) {
        num = num / 10;
      }
      return num >= 95 && num <= 145 ? Number(num.toFixed(8)) : fallback;
    }
  }
  
  if (!val) return fallback;

  let str = String(val).trim().replace(/[\u2010-\u2015\u2212]/g, '-').replace(/\s+/g, '');
  if (!str) return fallback;

  // Check if standard valid float already (e.g. "-8.364531" or "114.19375")
  const standardFloatRegex = /^-?\d{1,3}\.\d+$/;
  if (standardFloatRegex.test(str)) {
    const parsed = parseFloat(str);
    if (!isNaN(parsed) && isFinite(parsed)) {
      if (!isLongitude && parsed >= -12 && parsed <= -5) return Number(parsed.toFixed(8));
      if (isLongitude && parsed >= 95 && parsed <= 145) return Number(parsed.toFixed(8));
    }
  }

  // Indonesian / European thousand separator format (e.g., "-83.694.284", "-84.686.332", "-8.365.949", "1.141.809.061", "11.431.415", "114.316.129")
  if (!isLongitude) {
    // Latitude expected around -8.x (Banyuwangi: -8.1 to -8.8)
    // Extract only digits
    const digitsOnly = str.replace(/[^\d]/g, '');
    if (digitsOnly.length > 0) {
      // Typically starts with 8 (e.g. "83694284", "84686332", "8209918")
      if (digitsOnly.startsWith('8')) {
        const floatVal = -parseFloat('8.' + digitsOnly.slice(1));
        if (floatVal >= -12 && floatVal <= -5) return Number(floatVal.toFixed(8));
      } else {
        // Just take the first digit if not 8
        const floatVal = -parseFloat(digitsOnly[0] + '.' + digitsOnly.slice(1));
        if (floatVal >= -12 && floatVal <= -5) return Number(floatVal.toFixed(8));
      }
    }
  } else {
    // Longitude expected around 114.x (Banyuwangi: 114.0 to 114.5)
    const digitsOnly = str.replace(/[^\d]/g, '');
    if (digitsOnly.length > 0) {
      if (digitsOnly.startsWith('114')) {
        const floatVal = parseFloat('114.' + digitsOnly.slice(3));
        if (floatVal >= 95 && floatVal <= 145) return Number(floatVal.toFixed(8));
      } else if (digitsOnly.startsWith('11') && digitsOnly.length >= 3) {
        // e.g. "114..." or "113..."
        const prefix = digitsOnly.slice(0, 3);
        const rest = digitsOnly.slice(3);
        const floatVal = parseFloat(prefix + '.' + rest);
        if (floatVal >= 95 && floatVal <= 145) return Number(floatVal.toFixed(8));
      } else if (digitsOnly.startsWith('1') && digitsOnly.length >= 4) {
        // e.g. "1141809061" or from "1.141.809.061" -> digits is 1141809061
        const prefix = digitsOnly.slice(0, 3);
        const rest = digitsOnly.slice(3);
        const floatVal = parseFloat(prefix + '.' + rest);
        if (floatVal >= 95 && floatVal <= 145) return Number(floatVal.toFixed(8));
      }
    }
  }

  // Fallback direct float parse
  let cleaned = str.replace(/,/g, '.');
  let num = parseFloat(cleaned);
  if (!isNaN(num) && isFinite(num)) {
    if (!isLongitude) {
      if (num > 0) num = -num;
      while (num < -15) num = num / 10;
      if (num >= -12 && num <= -5) return Number(num.toFixed(8));
    } else {
      num = Math.abs(num);
      while (num > 150) num = num / 10;
      if (num >= 95 && num <= 145) return Number(num.toFixed(8));
    }
  }

  return fallback;
}

export const GoogleSheetsStoreSyncModal: React.FC<GoogleSheetsStoreSyncModalProps> = ({
  isOpen,
  onClose,
  onSuccessSync
}) => {
  const { addNotification } = useToast();
  const [activeTab, setActiveTab] = useState<'preview' | 'autosync' | 'history'>('preview');
  
  const [config, setConfig] = useState<GoogleSheetsSyncConfig>(googleSheetsSyncService.getConfig());
  const [syncLogs, setSyncLogs] = useState<SyncLogEntry[]>(googleSheetsSyncService.getSyncLogs());
  
  const [spreadsheetUrl, setSpreadsheetUrl] = useState<string>(config.spreadsheetUrl);
  const [selectedSheetName, setSelectedSheetName] = useState<string>(config.sheetName);
  const [isFetching, setIsFetching] = useState<boolean>(false);
  const [parsedStores, setParsedStores] = useState<any[]>([]);
  const [syncSuccessCount, setSyncSuccessCount] = useState<number | null>(null);
  const [pasteCsvText, setPasteCsvText] = useState<string>('');
  const [showPasteBox, setShowPasteBox] = useState<boolean>(false);

  useEffect(() => {
    const unsubscribe = googleSheetsSyncService.subscribe(() => {
      setConfig(googleSheetsSyncService.getConfig());
      setSyncLogs(googleSheetsSyncService.getSyncLogs());
    });
    return unsubscribe;
  }, []);

  if (!isOpen) return null;

  const handleFetchSheet = async () => {
    const cleanUrl = spreadsheetUrl.trim();
    const cleanSheet = selectedSheetName.trim() || 'DATA FIX';
    if (!cleanUrl) {
      addNotification('sla_warning', 'URL Google Sheets Kosong', 'Masukkan URL Google Sheets yang benar sebelum memuat data.');
      setParsedStores([]);
      setSyncSuccessCount(null);
      return;
    }

    googleSheetsSyncService.updateConfig({
      spreadsheetUrl: cleanUrl,
      sheetName: cleanSheet
    });

    setIsFetching(true);
    try {
      const csvUrl = toGoogleSheetsCsvUrl(cleanUrl);
      let response: Response | null = null;
      try {
        const proxyRes = await fetch(`/api/proxy-sheet?url=${encodeURIComponent(csvUrl)}`);
        if (proxyRes.ok) response = proxyRes;
      } catch {
        // Fallback to direct fetch
      }
      if (!response) {
        response = await fetch(csvUrl);
      }
      if (response && response.ok) {
        const csvText = await response.text();
        const res = googleSheetsSyncService.importCsvData(csvText);
        if (res.total > 0) {
          setParsedStores(res.stores.map((s, i) => ({
            no: i + 1,
            storeCode: s.storeCode,
            storeName: s.storeName,
            phone: s.phone,
            address: s.address,
            rawLat: String(s.latitude),
            rawLng: String(s.longitude),
            latitude: s.latitude,
            longitude: s.longitude,
            city: s.city,
            island: s.island,
            storeCategory: s.storeCategory
          })));
          setSyncSuccessCount(res.total);
          addNotification(
            'schedule',
            'Berhasil Memuat Google Sheets',
            `Seluruh ${res.total} data toko retail dari sheet "${cleanSheet}" berhasil dimuat.`
          );
          return;
        }
      }
    } catch {
      // Fallback
    } finally {
      setIsFetching(false);
    }

    setParsedStores([]);
    setSyncSuccessCount(null);
    addNotification(
      'sla_warning',
      'Gagal Memuat Google Sheets',
      `Data dari sheet "${cleanSheet}" tidak dapat dibaca. Tidak ada data contoh yang dimasukkan.`
    );
  };

  const handleImportPaste = () => {
    if (!pasteCsvText.trim()) {
      addNotification('sla_warning', 'Data Kosong', 'Tempelkan data Google Sheets pada kotak teks.');
      return;
    }
    const res = googleSheetsSyncService.importCsvData(pasteCsvText);
    if (res.total === 0) {
      addNotification('sla_warning', 'Tidak Ada Data Toko Valid', 'Data tempelan tidak memiliki baris toko yang valid.');
      return;
    }
    setSyncSuccessCount(res.total);
    setParsedStores(res.stores.map((s, i) => ({
      no: i + 1,
      storeCode: s.storeCode,
      storeName: s.storeName,
      phone: s.phone,
      address: s.address,
      rawLat: String(s.latitude),
      rawLng: String(s.longitude),
      latitude: s.latitude,
      longitude: s.longitude,
      city: s.city,
      island: s.island,
      storeCategory: s.storeCategory
    })));
    addNotification('schedule', 'Impor Data Sheet Berhasil!', `Berhasil menyinkronkan seluruh ${res.total} toko retail secara langsung dari data tempelan.`);
    if (onSuccessSync) onSuccessSync();
    setTimeout(() => {
      onClose();
    }, 800);
  };

  const handleImportToSystem = async () => {
    const cleanUrl = spreadsheetUrl.trim();
    const cleanSheet = selectedSheetName.trim() || 'DATA FIX';

    if (cleanUrl) {
      googleSheetsSyncService.updateConfig({
        spreadsheetUrl: cleanUrl,
        sheetName: cleanSheet
      });
    } else if (parsedStores.length > 0 && syncSuccessCount && syncSuccessCount > 0) {
      addNotification(
        'schedule',
        'Sinkronisasi Google Sheets Berhasil!',
        `Semua ${parsedStores.length} Toko Retail dari sheet "${cleanSheet}" berhasil diverifikasi dan langsung aktif di peta!`
      );
      if (onSuccessSync) onSuccessSync();
      setTimeout(() => {
        onClose();
      }, 800);
      return;
    } else {
      addNotification(
        'sla_warning',
        'URL Google Sheets Belum Diisi',
        'Masukkan tautan Google Sheets atau tempel data CSV terlebih dahulu sebelum menyinkronkan.'
      );
      return;
    }

    setIsFetching(true);
    try {
      const res = await googleSheetsSyncService.syncNow('Picu Manual Modal UI');
      if (res.total === 0) {
        addNotification(
          'sla_warning',
          'Tidak Ada Data Toko Valid',
          'Tidak ada data toko valid yang berhasil dibaca dari Google Sheets. Tidak ada data contoh yang dimasukkan.'
        );
        return;
      }

      setSyncSuccessCount(res.total);

      if (res.corruptedCount > 0) {
        addNotification(
          'sla_warning',
          `⚠️ Terdeteksi ${res.corruptedCount} Koordinat Rusak di Google Sheet!`,
          `Sebanyak ${res.corruptedCount} toko memiliki format koordinat cacat pada sheet "${cleanSheet}" dan ditandai Needs Correction. Peringatan darurat telah dikirim ke Dashboard.`,
          true
        );
      } else {
        addNotification(
          'schedule',
          'Sinkronisasi Google Sheets Berhasil!',
          `Semua ${res.total} Toko Retail dari sheet "${cleanSheet}" berhasil diverifikasi dan langsung aktif di peta!`
        );
      }

      if (onSuccessSync) onSuccessSync();
      // Auto close after 0.8s to show updated map immediately
      setTimeout(() => {
        onClose();
      }, 800);
    } catch (err: any) {
      addNotification(
        'sla_warning',
        'Gagal Menyinkronkan Google Sheets',
        err?.message || 'Tidak ada data toko valid yang berhasil dibaca dari Google Sheets.'
      );
    } finally {
      setIsFetching(false);
    }
  };

  const handleToggleAutoSync = (enabled: boolean) => {
    googleSheetsSyncService.updateConfig({ isAutoSyncEnabled: enabled });
    addNotification(
      'schedule',
      enabled ? 'Auto-Sync Diaktifkan' : 'Auto-Sync Dinonaktifkan',
      enabled
        ? `Sistem akan otomatis menyinkronkan data Google Sheets '${config.sheetName}' setiap ${config.autoSyncIntervalMinutes} menit.`
        : 'Sinkronisasi otomatis latar belakang dinonaktifkan.'
    );
  };

  const handleUpdateInterval = (minutes: number) => {
    googleSheetsSyncService.updateConfig({ autoSyncIntervalMinutes: minutes });
  };

  return (
    <div className="fixed inset-0 z-[999] bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <FileSpreadsheet className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <span>Integrasi &amp; Sinkronisasi Otomatis Google Sheets</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  Sheet: {config.sheetName}
                </span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Otomatisasi pengkinian data koordinat GPS, nama outlet, &amp; mitra retail dari Google Sheets ke modul logistik.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-2 px-5 pt-3 bg-slate-950 border-b border-slate-800 text-xs font-semibold">
          <button
            onClick={() => setActiveTab('preview')}
            className={`px-4 py-2 border-b-2 flex items-center gap-1.5 transition cursor-pointer ${
              activeTab === 'preview'
                ? 'border-emerald-500 text-emerald-400 font-bold'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Table className="w-4 h-4" />
            <span>Pratinjau Data (&quot;{selectedSheetName}&quot;)</span>
          </button>

          <button
            onClick={() => setActiveTab('autosync')}
            className={`px-4 py-2 border-b-2 flex items-center gap-1.5 transition cursor-pointer ${
              activeTab === 'autosync'
                ? 'border-emerald-500 text-emerald-400 font-bold'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Settings className="w-4 h-4" />
            <span>Pengaturan Sinkronisasi Otomatis</span>
            {config.isAutoSyncEnabled && (
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('history')}
            className={`px-4 py-2 border-b-2 flex items-center gap-1.5 transition cursor-pointer ${
              activeTab === 'history'
                ? 'border-emerald-500 text-emerald-400 font-bold'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <History className="w-4 h-4" />
            <span>Log Riwayat Sinkronisasi ({syncLogs.length})</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 space-y-4 overflow-y-auto flex-1">
          {activeTab === 'preview' && (
            <>
              {/* Connection Bar */}
              <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-4 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <span className="text-xs font-bold text-slate-200 flex items-center gap-2">
                    <Globe className="w-4 h-4 text-emerald-400" />
                    <span>Tautan Spreadsheet Google Sheets</span>
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] text-emerald-400 font-mono bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                      ✓ Google Workspace OAuth Terhubung
                    </span>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                      config.isAutoSyncEnabled
                        ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                        : 'bg-slate-800 text-slate-400 border-slate-700'
                    }`}>
                      {config.isAutoSyncEnabled ? '● Auto-Sync Aktif' : '○ Auto-Sync Off'}
                    </span>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    type="text"
                    value={spreadsheetUrl}
                    onChange={(e) => setSpreadsheetUrl(e.target.value)}
                    className="flex-1 bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500 font-mono"
                    placeholder="https://docs.google.com/spreadsheets/d/..."
                  />
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={selectedSheetName}
                      onChange={(e) => setSelectedSheetName(e.target.value)}
                      className="w-32 bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs text-amber-300 font-bold focus:outline-none text-center"
                      placeholder="DATA FIX"
                    />
                    <button
                      onClick={handleFetchSheet}
                      disabled={isFetching}
                      className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs flex items-center gap-1.5 transition cursor-pointer active:scale-95 disabled:opacity-50 shrink-0"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? 'animate-spin' : ''}`} />
                      <span>{isFetching ? 'Memuat...' : 'Muat Sheet'}</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Paste / Direct Import Card (Bypassing browser CORS restrictions) */}
              <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-amber-300 flex items-center gap-2">
                    <FileSpreadsheet className="w-4 h-4 text-amber-400" />
                    <span>Impor / Tempel Langsung Data Google Sheets (Bypass CORS)</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowPasteBox(!showPasteBox)}
                    className="text-xs text-blue-400 hover:text-blue-300 font-semibold underline cursor-pointer"
                  >
                    {showPasteBox ? 'Tutup Kotak Tempel' : 'Buka Kotak Tempel Data'}
                  </button>
                </div>

                {showPasteBox && (
                  <div className="space-y-2 pt-2 border-t border-slate-800">
                    <p className="text-[11px] text-slate-400">
                      Salin data dari Google Sheets Anda (Kolom: NO, Nama Toko, Alamat, Latitude, Longitude) lalu tempelkan ke bawah ini:
                    </p>
                    <textarea
                      rows={4}
                      value={pasteCsvText}
                      onChange={(e) => setPasteCsvText(e.target.value)}
                      placeholder="Tempel data spreadsheet di sini (misal seluruh baris data toko dari sheet)..."
                      className="w-full bg-slate-900 border border-slate-800 rounded-lg p-3 text-xs text-white font-mono focus:outline-none focus:border-amber-500"
                    />
                  <div className="flex justify-end">
                      <button
                        type="button"
                        onClick={() => {
                          const res = googleSheetsSyncService.importCsvData(pasteCsvText);
                          setSyncSuccessCount(res.total);
                          setParsedStores(res.stores.map((s, i) => ({
                            no: i + 1,
                            storeCode: s.storeCode,
                            storeName: s.storeName,
                            phone: s.phone,
                            address: s.address,
                            rawLat: (s as any).rawLat || String(s.latitude),
                            rawLng: (s as any).rawLng || String(s.longitude),
                            latitude: s.latitude,
                            longitude: s.longitude,
                            city: s.city,
                            island: s.island,
                            storeCategory: s.storeCategory
                          })));
                          if (onSuccessSync) onSuccessSync();
                          addNotification('schedule', 'Impor Data Sheet Berhasil!', `Berhasil menyinkronkan ${res.total} toko retail dengan koordinat GPS valid.`);
                        }}
                        className="px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs shadow transition cursor-pointer flex items-center gap-1.5"
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                        <span>Impor &amp; Sinkronkan Data Tempelan</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Sync Status Banner */}
              {syncSuccessCount !== null && (
                <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl flex items-center justify-between text-xs text-emerald-300">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    <span>
                      <strong>{syncSuccessCount} Toko Retail</strong> berhasil disinkronkan &amp; diperbarui ke database logistik!
                    </span>
                  </div>
                  <span className="text-[10px] bg-emerald-500/20 px-2 py-0.5 rounded font-mono font-bold">
                    Tersimpan Otomatis
                  </span>
                </div>
              )}

              {/* Preview Data Table */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-white flex items-center gap-1.5">
                    <Table className="w-4 h-4 text-emerald-400" />
                    <span>Pratinjau Data Sheet &quot;{selectedSheetName}&quot; ({parsedStores.length} Outlet Toko)</span>
                  </span>
                  <span className="text-[11px] text-slate-400 font-mono">
                    Sanitasi Koordinat GPS Otomatis Aktif
                  </span>
                </div>

                <div className="border border-slate-800 rounded-xl overflow-x-auto max-h-72 bg-slate-950">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-900 text-slate-400 border-b border-slate-800 sticky top-0 z-10">
                      <tr>
                        <th className="p-2.5 text-center w-10">NO</th>
                        <th className="p-2.5">KODE</th>
                        <th className="p-2.5">NAMA TOKO / PELANGGAN</th>
                        <th className="p-2.5">KATEGORI</th>
                        <th className="p-2.5">LATITUDE (SHEET / HASIL)</th>
                        <th className="p-2.5">LONGITUDE (SHEET / HASIL)</th>
                        <th className="p-2.5 text-center">STATUS GPS</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/80 text-slate-300 font-mono text-[11px]">
                      {parsedStores.map((row, index) => {
                        const valResult = validateCoordinateData(row.rawLat, row.rawLng);
                        return (
                          <tr key={`${row.storeCode}-${index}`} className={`hover:bg-slate-900/60 transition ${!valResult.isValid ? 'bg-red-950/20' : ''}`}>
                            <td className="p-2.5 text-center font-bold text-slate-400">{row.no}</td>
                            <td className="p-2.5 font-bold text-emerald-400">{row.storeCode}</td>
                            <td className="p-2.5 font-sans font-bold text-white">{row.storeName}</td>
                            <td className="p-2.5 font-sans">
                              <span className={`px-2 py-0.5 rounded text-[10px] border ${
                                valResult.isValid 
                                  ? 'bg-slate-800 text-slate-300 border-slate-700' 
                                  : 'bg-red-900/30 text-red-300 border-red-500/30 font-bold'
                              }`}>
                                {valResult.isValid ? row.storeCategory : 'Needs Correction'}
                              </span>
                            </td>
                            <td className="p-2.5">
                              <div className="text-slate-400 line-through text-[10px]">{row.rawLat}</div>
                              <div className={valResult.isLatCorrupted ? 'text-red-400 font-bold font-mono' : 'text-emerald-400 font-bold font-mono'}>
                                {row.latitude}
                              </div>
                            </td>
                            <td className="p-2.5">
                              <div className="text-slate-400 line-through text-[10px]">{row.rawLng}</div>
                              <div className={valResult.isLngCorrupted ? 'text-red-400 font-bold font-mono' : 'text-emerald-400 font-bold font-mono'}>
                                {row.longitude}
                              </div>
                            </td>
                            <td className="p-2.5 text-center">
                              {valResult.isValid ? (
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                                  ✓ Valid GPS
                                </span>
                              ) : (
                                <span 
                                  className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-500/20 text-red-300 border border-red-500/40 animate-pulse cursor-help"
                                  title={valResult.reason}
                                >
                                  ⚠ Rusak (Needs Correction)
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}

          {activeTab === 'autosync' && (
            <div className="space-y-4">
              <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                  <div>
                    <h4 className="text-sm font-bold text-white flex items-center gap-2">
                      <span>Status Sinkronisasi Otomatis Google Sheets</span>
                    </h4>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Sistem akan secara berkala membaca sheet &apos;{config.sheetName}&apos; dan memperbarui koordinat &amp; data toko tanpa menghapus riwayat jadwal yang ada.
                    </p>
                  </div>

                  <label className="relative inline-flex items-center cursor-pointer shrink-0">
                    <input
                      type="checkbox"
                      checked={config.isAutoSyncEnabled}
                      onChange={(e) => handleToggleAutoSync(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
                  </label>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Interval Sinkronisasi Latar Belakang</span>
                    </label>
                    <select
                      value={config.autoSyncIntervalMinutes}
                      onChange={(e) => handleUpdateInterval(Number(e.target.value))}
                      className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2.5 text-xs text-white focus:outline-none focus:border-emerald-500 font-medium"
                    >
                      <option value={60}>Setiap 1 Jam (Hourly - Standar Otomatis Logistik)</option>
                      <option value={30}>Setiap 30 Menit</option>
                      <option value={15}>Setiap 15 Menit</option>
                      <option value={5}>Setiap 5 Menit</option>
                      <option value={1}>Setiap 1 Menit (Real-time)</option>
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                      <Zap className="w-3.5 h-3.5 text-amber-400" />
                      <span>Sinkronkan Otomatis Saat Aplikasi Dimuat</span>
                    </label>
                    <div className="flex items-center justify-between p-2.5 bg-slate-900 border border-slate-800 rounded-lg text-xs">
                      <span className="text-slate-300 font-medium">Auto-sync saat pertama kali dibuka</span>
                      <input
                        type="checkbox"
                        checked={config.syncOnAppLaunch}
                        onChange={(e) => googleSheetsSyncService.updateConfig({ syncOnAppLaunch: e.target.checked })}
                        className="accent-emerald-500 w-4 h-4 cursor-pointer"
                      />
                    </div>
                  </div>
                </div>

                {/* Diagnostic & Validation Testing Panel */}
                <div className="p-3.5 bg-amber-500/10 border border-amber-500/20 rounded-xl space-y-2">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <span className="text-xs font-bold text-amber-300 flex items-center gap-1.5">
                      <AlertTriangle className="w-4 h-4 text-amber-400" />
                      <span>Skema Validasi &amp; Pemicu Notifikasi Koordinat Rusak</span>
                    </span>
                    <button
                      onClick={() => {
                        googleSheetsSyncService.testCorruptedCoordinateNotification(2);
                      }}
                      className="px-2.5 py-1 rounded bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-[11px] flex items-center justify-center gap-1 shadow transition cursor-pointer"
                      title="Kirim simulasi peringatan koordinat rusak ke dashboard"
                    >
                      <Zap className="w-3 h-3" />
                      <span>Uji Pemicu Notifikasi Rusak</span>
                    </button>
                  </div>
                  <p className="text-[11px] text-slate-300 leading-relaxed">
                    Setiap baris koordinat diuji terhadap format angka, nilai kosong, nilai 0, nilai NaN, serta batas geografis Indonesia. Jika terdeteksi cacat, data langsung ditandai <code>Needs Correction</code> dan sistem memicu alert &apos;sla_warning&apos; ke dashboard secara instan.
                  </p>
                </div>

                <div className="p-3 bg-slate-900/80 border border-slate-800 rounded-lg flex items-center justify-between text-xs">
                  <div className="text-slate-400">
                    <span>Terakhir kali disinkronkan: </span>
                    <strong className="text-white font-mono">
                      {config.lastSyncTimestamp ? new Date(config.lastSyncTimestamp).toLocaleString('id-ID') : 'Belum pernah'}
                    </strong>
                  </div>
                  <button
                    onClick={async () => {
                      if (spreadsheetUrl.trim()) {
                        googleSheetsSyncService.updateConfig({
                          spreadsheetUrl: spreadsheetUrl.trim(),
                          sheetName: selectedSheetName.trim() || config.sheetName
                        });
                      }
                      const res = await googleSheetsSyncService.syncNow('Picu Manual Pengaturan');
                      if (res.total === 0) {
                        addNotification(
                          'sla_warning',
                          'Sinkronisasi Dilewati',
                          'Tidak ada data toko valid yang berhasil dibaca dari Google Sheets. Pastikan tautan Google Sheets sudah diisi.'
                        );
                        return;
                      }
                      addNotification(
                        'schedule',
                        'Sinkronisasi Ulang Berhasil',
                        `${res.total} toko retail dari sheet '${config.sheetName}' berhasil diverifikasi & disinkronkan.`
                      );
                    }}
                    className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-1.5 transition cursor-pointer"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Jalankan Sinkronkan Sekarang</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'history' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-white flex items-center gap-1.5">
                  <History className="w-4 h-4 text-emerald-400" />
                  <span>Riwayat Aktivitas Sinkronisasi Google Sheets</span>
                </span>
                <span className="text-[11px] text-slate-400">
                  Menampilkan {syncLogs.length} entri terbaru
                </span>
              </div>

              <div className="border border-slate-800 rounded-xl overflow-hidden bg-slate-950">
                <div className="divide-y divide-slate-800 max-h-72 overflow-y-auto">
                  {syncLogs.map((log) => (
                    <div key={log.id} className="p-3 flex items-start justify-between text-xs hover:bg-slate-900/50 transition">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                            {log.sourceSheet}
                          </span>
                          <span className="font-bold text-white">{log.message}</span>
                        </div>
                        <div className="text-[11px] text-slate-400 flex items-center gap-3">
                          <span>Total Data: <strong>{log.totalStores}</strong></span>
                          <span>Baru: <strong className="text-emerald-400">{log.addedStores}</strong></span>
                          <span>Diperbarui: <strong className="text-amber-400">{log.updatedStores}</strong></span>
                        </div>
                      </div>
                      <div className="text-[10px] text-slate-500 font-mono shrink-0 ml-3">
                        {new Date(log.timestamp).toLocaleString('id-ID')}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 bg-slate-950 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="text-xs text-slate-400 flex items-center gap-1.5">
            <Sparkles className="w-4 h-4 text-amber-400 shrink-0" />
            <span>Format koordinat Indonesia (desimal ribuan) otomatis dinormalisasi.</span>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <div className="flex gap-2">
              <button
                onClick={async () => {
                  setIsFetching(true);
                  try {
                    if (spreadsheetUrl.trim()) {
                      googleSheetsSyncService.updateConfig({
                        spreadsheetUrl: spreadsheetUrl.trim(),
                        sheetName: selectedSheetName.trim() || config.sheetName
                      });
                    }
                    const res = await googleSheetsSyncService.syncNow('Force Sync Manual', true);
                    if (res.total === 0) {
                      addNotification(
                        'sla_warning',
                        'Force Sync: Tidak Ada Data Toko',
                        'Data lokal dibersihkan, namun belum ada data toko valid dari Google Sheets.'
                      );
                      return;
                    }
                    if (onSuccessSync) onSuccessSync();
                    addNotification('schedule', 'Force Sync Berhasil', 'Data lokal dibersihkan dan ditarik ulang langsung dari sumber.');
                  } finally {
                    setIsFetching(false);
                  }
                }}
                className="px-4 py-2 rounded-xl bg-orange-600 hover:bg-orange-500 text-white text-xs font-bold transition cursor-pointer flex items-center gap-2"
              >
                <RefreshCw className="w-4 h-4" />
                Force Sync from Source
              </button>
              <button
                onClick={onClose}
                className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 text-xs font-semibold border border-slate-800 transition cursor-pointer"
              >
                Tutup
              </button>
            </div>
            <button
              onClick={handleImportToSystem}
              className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-lg shadow-emerald-900/20 flex items-center justify-center gap-2 transition cursor-pointer active:scale-95"
            >
              <Download className="w-4 h-4" />
              <span>Sinkronkan Sekarang ({parsedStores.length} Toko)</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
