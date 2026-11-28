import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Wifi, WifiOff, RefreshCw, X, ChevronUp, ChevronDown, Radio, CheckCircle2 } from 'lucide-react';
import { driverOfflineSyncService } from '../services/driverOfflineSyncService';

interface NetworkStatusBannerProps {
  onStatusChange?: (isOnline: boolean) => void;
}

export const NetworkStatusBanner: React.FC<NetworkStatusBannerProps> = ({ onStatusChange }) => {
  const [isOffline, setIsOffline] = useState<boolean>(() => {
    return typeof navigator !== 'undefined' ? !navigator.onLine : false;
  });
  const [showReconnected, setShowReconnected] = useState<boolean>(false);
  const [isRetrying, setIsRetrying] = useState<boolean>(false);
  const [isMinimized, setIsMinimized] = useState<boolean>(false);
  const wasOfflineRef = useRef<boolean>(isOffline);

  // Keep ref in sync with state
  useEffect(() => {
    wasOfflineRef.current = isOffline;
  }, [isOffline]);

  // Comprehensive Force Data Sync action when connection is restored
  const triggerForceDataSync = useCallback(async () => {
    try {
      console.info('[NetworkStatusBanner] Connection restored after offline. Automatically triggering Force Data Sync...');
      await Promise.allSettled([
        driverOfflineSyncService.syncQueue()
      ]);
    } catch (err) {
      console.warn('[NetworkStatusBanner] Force Data Sync error:', err);
    }
  }, []);

  // Check connection status
  const checkConnection = useCallback(async () => {
    setIsRetrying(true);
    try {
      // Ping check to verify actual internet connectivity
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000);
      
      const response = await fetch('/api/db-status', {
        method: 'GET',
        cache: 'no-store',
        signal: controller.signal
      }).catch(() => null);

      clearTimeout(timeoutId);

      if (response && response.ok) {
        const wasOffline = wasOfflineRef.current;
        setIsOffline(false);
        setShowReconnected(true);
        setTimeout(() => setShowReconnected(false), 3500);

        if (wasOffline) {
          triggerForceDataSync();
        }
      } else if (!navigator.onLine) {
        setIsOffline(true);
      }
    } catch {
      if (!navigator.onLine) {
        setIsOffline(true);
      }
    } finally {
      setIsRetrying(false);
    }
  }, [triggerForceDataSync]);

  useEffect(() => {
    const handleOnline = () => {
      const wasOffline = wasOfflineRef.current;
      setIsOffline(false);
      setShowReconnected(true);
      setIsMinimized(false);
      onStatusChange?.(true);

      if (wasOffline) {
        triggerForceDataSync();
      }

      // Auto-dismiss the reconnected notification after 3.5 seconds
      const timer = setTimeout(() => {
        setShowReconnected(false);
      }, 3500);

      return () => clearTimeout(timer);
    };

    const handleOffline = () => {
      setIsOffline(true);
      setShowReconnected(false);
      onStatusChange?.(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Initial check
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      setIsOffline(true);
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [onStatusChange, triggerForceDataSync]);

  // If online and not showing the temporary "reconnected" state, render nothing
  if (!isOffline && !showReconnected) {
    return null;
  }

  // Temporary subtle reconnected banner
  if (showReconnected && !isOffline) {
    return (
      <div
        role="status"
        aria-live="polite"
        className="fixed top-0 left-0 right-0 z-50 bg-white border-b border-emerald-200 text-slate-800"
      >
        <div className="max-w-7xl mx-auto px-4 py-2 flex items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-6 h-6 rounded-lg bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600 shrink-0">
              <CheckCircle2 className="w-3.5 h-3.5" />
            </div>
            <div className="flex items-center gap-2 truncate">
              <span className="font-semibold text-slate-900 text-xs">Koneksi Internet Pulih Kembali</span>
              <span className="text-slate-300 hidden sm:inline">|</span>
              <span className="text-emerald-700 text-[11px] truncate hidden sm:inline">
                Sinkronisasi data MySQL &amp; pelacakan armada real-time kembali aktif.
              </span>
            </div>
          </div>
          <button
            onClick={() => setShowReconnected(false)}
            className="p-1 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer shrink-0"
            aria-label="Tutup Notifikasi"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    );
  }

  // Minimized compact status button for users who collapsed the banner
  if (isMinimized) {
    return (
      <div
        role="alert"
        aria-live="assertive"
        className="fixed top-2 right-4 z-50"
      >
        <button
          onClick={() => setIsMinimized(false)}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white border border-amber-300 text-amber-800 text-xs font-semibold hover:bg-amber-50 transition cursor-pointer"
          title="Klik untuk melihat detail status koneksi & pelacakan armada"
        >
          <WifiOff className="w-3.5 h-3.5 text-amber-600" />
          <span>Offline • Koneksi Dijeda</span>
          <ChevronDown className="w-3 h-3 text-amber-600" />
        </button>
      </div>
    );
  }

  // Full Flat top-banner notification when internet is lost
  return (
    <div
      role="alert"
      aria-live="assertive"
      className="fixed top-0 left-0 right-0 z-50 bg-white border-b border-amber-200 text-slate-800"
    >
      <div className="max-w-7xl mx-auto px-4 py-2 flex items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-7 h-7 rounded-lg bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600 shrink-0">
            <WifiOff className="w-4 h-4" />
          </div>

          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-semibold text-slate-900 text-xs">
                Koneksi Internet Terputus
              </span>
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-50 border border-amber-200 text-[10px] font-semibold text-amber-800">
                <Radio className="w-2.5 h-2.5 text-amber-600" />
                <span>Sinkronisasi MySQL Dijeda</span>
              </span>
            </div>
            <p className="text-[11px] text-slate-500 leading-tight mt-0.5 truncate hidden sm:block">
              Koneksi server &amp; pelacakan armada dijeda sementara. Klik Coba Hubungkan Ulang setelah jaringan tersedia.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={checkConnection}
            disabled={isRetrying}
            className="px-2.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold text-[11px] flex items-center gap-1.5 transition cursor-pointer disabled:opacity-50"
            title="Periksa ulang sambungan internet & database"
          >
            <RefreshCw className={`w-3 h-3 ${isRetrying ? 'animate-spin' : ''}`} />
            <span className="hidden md:inline">{isRetrying ? 'Memeriksa...' : 'Coba Hubungkan Ulang'}</span>
            <span className="md:hidden">{isRetrying ? '...' : 'Cek'}</span>
          </button>

          <button
            onClick={() => setIsMinimized(true)}
            className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-700 transition cursor-pointer"
            title="Sembunyikan banner ke status ringkas"
            aria-label="Sembunyikan Banner"
          >
            <ChevronUp className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};
