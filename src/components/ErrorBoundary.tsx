import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, Copy, Home, RefreshCw } from 'lucide-react';

interface Props {
  children?: ReactNode;
}

interface State {
  hasError: boolean;
  isRecovering: boolean;
  error?: Error;
  componentStack?: string;
  errorStack?: string;
}

const CHUNK_RETRY_KEY = 'akk_chunk_recovery_attempt_v2';
const CHUNK_RETRY_WINDOW_MS = 120_000;

function errorMessage(error?: Error): string {
  return String(error?.message || error || 'Kesalahan tidak diketahui').slice(0, 1200);
}

function isChunkLoadError(error?: Error): boolean {
  const msg = errorMessage(error).toLowerCase();
  return (
    msg.includes('failed to fetch dynamically imported module') ||
    msg.includes('importing a module script failed') ||
    msg.includes('error loading dynamically imported module') ||
    msg.includes('loading chunk') ||
    msg.includes('chunkloaderror') ||
    msg.includes('failed to load module script') ||
    msg.includes('dynamically imported module')
  );
}

function getFreshPageUrl(): string {
  const url = new URL(window.location.href);
  url.searchParams.set('__akk_refresh', String(Date.now()));
  return url.toString();
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    isRecovering: false
  };

  public static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, isRecovering: false, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Keep the full error in the browser console for diagnosis, but do not expose
    // stack traces until the user opens the technical-details disclosure.
    console.error('[AKK App ErrorBoundary]', error, errorInfo);
    this.setState({
      componentStack: errorInfo.componentStack || '',
      errorStack: error?.stack || ''
    });

    // Only retry once for a likely stale/missing Vite chunk. Do not purge business
    // data from localStorage when a regular React rendering error occurs.
    if (isChunkLoadError(error) && typeof window !== 'undefined' && navigator.onLine) {
      try {
        const now = Date.now();
        const urlRefreshTs = Number(new URLSearchParams(window.location.search).get('__akk_refresh') || '0');
        const previousAttempt = Math.max(
          Number(sessionStorage.getItem(CHUNK_RETRY_KEY) || '0'),
          Number.isFinite(urlRefreshTs) ? urlRefreshTs : 0
        );
        if (!previousAttempt || now - previousAttempt > CHUNK_RETRY_WINDOW_MS) {
          sessionStorage.setItem(CHUNK_RETRY_KEY, String(now));
          this.setState({ isRecovering: true });
          window.setTimeout(() => window.location.replace(getFreshPageUrl()), 350);
        }
      } catch {
        // Storage restrictions should never prevent the error screen from rendering.
      }
    }
  }

  private handleReset = () => {
    try {
      sessionStorage.removeItem(CHUNK_RETRY_KEY);
    } catch {}
    window.location.replace(getFreshPageUrl());
  };

  private handleGoHome = () => {
    window.location.assign('/');
  };

  private handleCopyDiagnostics = async () => {
    const details = [
      'AKK Portal diagnostic',
      `URL: ${window.location.href}`,
      `Waktu: ${new Date().toISOString()}`,
      `Error: ${this.state.error?.name || 'Error'}: ${errorMessage(this.state.error)}`,
      `JavaScript stack: ${this.state.errorStack || '(tidak tersedia)'}`,
      `Component stack: ${this.state.componentStack || '(tidak tersedia)'}`,
      `Build target: ${import.meta.env.VITE_BUILD_TARGET || 'dist'}`,
      `User agent: ${navigator.userAgent}`
    ].join('\n');

    try {
      await navigator.clipboard.writeText(details);
    } catch {
      // If clipboard access is blocked, the details remain visible in the disclosure.
      console.warn('[AKK diagnostics]', details);
    }
  };

  public render() {
    if (this.state.hasError) {
      if (this.state.isRecovering) {
        return (
          <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center p-6">
            <div className="text-center space-y-3">
              <RefreshCw className="w-7 h-7 mx-auto text-blue-600 dark:text-amber-400 animate-spin" />
              <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">Memuat ulang file aplikasi yang terbaru...</p>
            </div>
          </div>
        );
      }

      const chunkError = isChunkLoadError(this.state.error);
      return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex items-center justify-center p-5">
          <div className="max-w-lg w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 sm:p-6 shadow-lg space-y-4">
            <div className="w-11 h-11 rounded-xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/25 flex items-center justify-center text-amber-600 dark:text-amber-400 mx-auto">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div className="text-center space-y-1">
              <h1 className="text-base font-extrabold">Portal belum dapat dimuat</h1>
              <p className="text-xs text-slate-600 dark:text-slate-300">
                {chunkError
                  ? 'File modul aplikasi belum berhasil dimuat. Periksa koneksi atau pastikan seluruh file hasil build sudah terunggah.'
                  : 'Aplikasi mengalami kesalahan saat menampilkan halaman. Detail teknis tersedia di bawah untuk membantu pemeriksaan.'}
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-2">
              <button
                onClick={this.handleReset}
                className="flex-1 py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs transition cursor-pointer active:scale-[0.99] flex items-center justify-center gap-2"
              >
                <RefreshCw className="w-4 h-4" />
                <span>Muat Ulang Aman</span>
              </button>
              <button
                onClick={this.handleGoHome}
                className="py-2.5 px-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold text-xs transition cursor-pointer flex items-center justify-center gap-2"
              >
                <Home className="w-4 h-4" />
                <span>Halaman Utama</span>
              </button>
            </div>

            <p className="text-[11px] text-center text-emerald-700 dark:text-emerald-300">
              Data jadwal, laporan, dan akun tidak dihapus oleh proses pemulihan ini.
            </p>

            <details open className="rounded-xl border border-slate-200 dark:border-slate-700 p-3">
              <summary className="cursor-pointer text-xs font-bold text-slate-600 dark:text-slate-300">Detail teknis untuk pengelola</summary>
              <div className="mt-3 space-y-2">
                <p className="text-[11px] break-all text-slate-500 dark:text-slate-400">URL: {typeof window !== 'undefined' ? window.location.href : '-'}</p>
                <p className="text-xs font-semibold text-rose-600 dark:text-rose-300 break-words">{this.state.error?.name || 'Error'}: {errorMessage(this.state.error)}</p>
                {this.state.errorStack && (
                  <pre className="max-h-36 overflow-auto whitespace-pre-wrap break-words text-[10px] text-slate-500 dark:text-slate-400">{this.state.errorStack}</pre>
                )}
                {this.state.componentStack && (
                  <pre className="max-h-36 overflow-auto whitespace-pre-wrap break-words text-[10px] text-slate-500 dark:text-slate-400">{this.state.componentStack}</pre>
                )}
                <button
                  onClick={this.handleCopyDiagnostics}
                  className="w-full py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-bold flex items-center justify-center gap-2 hover:bg-slate-50 dark:hover:bg-slate-800"
                >
                  <Copy className="w-3.5 h-3.5" /> Salin detail error
                </button>
              </div>
            </details>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}