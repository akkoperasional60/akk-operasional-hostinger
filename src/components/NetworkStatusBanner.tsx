import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Wifi, WifiOff, RefreshCw, X, ChevronUp, ChevronDown, Radio, CheckCircle2 } from 'lucide-react';
import { googleSheetsSyncService } from '../services/googleSheetsSyncService';
import { dataBridgeService } from '../services/dataBridgeService';
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
        googleSheetsSyncService.syncNow('Force Data Sync (Reconnected)', false),
        dataBridgeService.syncNow('Force Data Sync (Reconnected)'),
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
        className="fixed top-0 left-0 right-0 z-50 bg-gradient-to-r from-emerald-950/95 via-slate-900/95 to-emerald-950/95 border-b border-emerald-500/40 text-emerald-100 backdrop-blur-md shadow-md animate-in slide-in-from-top-2 duration-300 transition-all"
      >
        <div className="max-w-7xl mx-auto px-4 py-2 flex items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-6 h-6 rounded-lg bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 shrink-0">
              <CheckCircle2 className="w-3.5 h-3.5" />
            </div>
            <div className="flex items-center gap-2 truncate">
              <span className="font-bold text-white text-xs">Koneksi Internet Pulih Kembali</span>
              <span className="text-slate-400 hidden sm:inline">&bull;</span>
              <span className="text-emerald-300 text-[11px] truncate hidden sm:inline">
                Pembaruan pelacakan armada real-time (GPS Tracksolid) telah diaktifkan kembali.
              </span>
            </div>
          </div>
          <button
            onClick={() => setShowReconnected(false)}
            className="p-1 rounded-md text-emerald-300 hover:text-white hover:bg-emerald-500/20 transition cursor-pointer shrink-0"
            aria-label="Tutup Notifikasi"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    );
  }

  // Minimized floating pill for users who collapsed the banner
  if (isMinimized) {
    return (
      <div 
        role="alert"
        aria-live="assertive"
        className="fixed top-2 right-4 z-50 animate-in fade-in duration-200"
      >
        <button
          onClick={() => setIsMinimized(false)}
          className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-950/90 border border-amber-500/50 text-amber-200 text-xs font-bold shadow-lg backdrop-blur-md hover:bg-amber-900/90 transition cursor-pointer active:scale-95 group"
          title="Klik untuk melihat detail status koneksi & pelacakan armada"
        >
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
          </span>
          <WifiOff className="w-3.5 h-3.5 text-amber-400" />
          <span>Offline &bull; Tracking Dijeda</span>
          <ChevronDown className="w-3 h-3 text-amber-400 group-hover:translate-y-0.5 transition-transform" />
        </button>
      </div>
    );
  }

  // Full subtle top-banner notification when internet is lost
  return (
    <div 
      role="alert"
      aria-live="assertive"
      className="fixed top-0 left-0 right-0 z-50 bg-gradient-to-r from-amber-950/95 via-slate-900/95 to-amber-950/95 border-b border-amber-500/40 text-amber-100 backdrop-blur-md shadow-lg animate-in slide-in-from-top-2 duration-300 transition-all"
    >
      <div className="max-w-7xl mx-auto px-4 py-2 sm:py-2.5 flex items-center justify-between gap-3 text-xs">
        {/* Left: Icon & Warning copy */}
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-7 h-7 rounded-lg bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 shrink-0 shadow-inner">
            <WifiOff className="w-4 h-4 animate-pulse" />
          </div>

          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
              <span className="font-black text-amber-300 text-xs tracking-tight">
                Koneksi Internet Terputus
              </span>
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-amber-500/20 border border-amber-500/30 text-[10px] font-bold text-amber-300 font-mono">
                <Radio className="w-2.5 h-2.5 text-amber-400" />
                <span>Pelacakan Real-Time Dijeda</span>
              </span>
            </div>
            <p className="text-[11px] text-slate-300 leading-tight mt-0.5 truncate hidden sm:block">
              Pembaruan lokasi GPS armada Tracksolid dijeda sementara. Lokasi terakhir tersimpan aman di peramban dan akan diperbarui otomatis saat koneksi internet pulih.
            </p>
            <p className="text-[10px] text-slate-300 leading-tight mt-0.5 truncate sm:hidden">
              Pembaruan GPS armada dijeda. Tersimpan di cache lokal.
            </p>
          </div>
        </div>

        {/* Right: Actions (Retry Check, Minimize, Dismiss) */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={checkConnection}
            disabled={isRetrying}
            className="px-2.5 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-300 font-bold text-[11px] flex items-center gap-1.5 transition active:scale-95 cursor-pointer disabled:opacity-50"
            title="Periksa ulang sambungan internet"
          >
            <RefreshCw className={`w-3 h-3 ${isRetrying ? 'animate-spin' : ''}`} />
            <span className="hidden md:inline">{isRetrying ? 'Memeriksa...' : 'Coba Sambungkan'}</span>
            <span className="md:hidden">{isRetrying ? '...' : 'Cek'}</span>
          </button>

          <button
            onClick={() => setIsMinimized(true)}
            className="p-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-800 text-slate-400 hover:text-amber-300 transition cursor-pointer"
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
