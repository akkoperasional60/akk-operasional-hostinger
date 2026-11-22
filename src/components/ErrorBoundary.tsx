import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  children?: ReactNode;
}

const CACHE_KEYS_TO_PURGE_ON_ERROR = [
  'akk_admin_schedules_v1',
  'akk_daily_checklist_v1',
  'akk_task_status_v1',
  'akk_master_jobdesk_v2',
  'akk_checklist_history',
  'akk_loading_fleets_v2',
  'akk_fines_data_v2',
  'akk_user_branch_permissions_v1',
  'akk_entity_branch_assignments_v1',
  'akk_multi_store_branches_v1',
  'akk_active_origin_branch_v1',
  'akk_simulasi_weeks_v2',
  'akk_notifications_v1',
  'akk_system_activities_v1'
];

function purgeCorruptedCacheKeys() {
  try {
    CACHE_KEYS_TO_PURGE_ON_ERROR.forEach(k => {
      try {
        localStorage.removeItem(k);
      } catch {}
    });
  } catch {}
}

function isChunkLoadError(error?: Error): boolean {
  const msg = String(error?.message || error || '').toLowerCase();
  return (
    msg.includes('failed to fetch dynamically imported module') ||
    msg.includes('importing a module script failed') ||
    msg.includes('error loading dynamically imported module') ||
    msg.includes('loading chunk')
  );
}

const SILENT_RELOAD_COUNT_KEY = 'akk_silent_reload_count_v1';
const SILENT_RELOAD_TS_KEY = 'akk_silent_reload_ts_v1';
const MAX_SILENT_RELOADS_WINDOW = 2;
const RELOAD_WINDOW_MS = 30000;

interface State {
  hasError: boolean;
  isAutoReloading: boolean;
  error?: Error;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    isAutoReloading: false
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, isAutoReloading: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught React Error:', error, errorInfo);

    const chunkErr = isChunkLoadError(error);
    if (!chunkErr) {
      purgeCorruptedCacheKeys();
    }

    try {
      const now = Date.now();
      const lastTs = Number(sessionStorage.getItem(SILENT_RELOAD_TS_KEY) || '0');
      const prevCount = Number(sessionStorage.getItem(SILENT_RELOAD_COUNT_KEY) || '0');
      const withinWindow = lastTs > 0 && now - lastTs < RELOAD_WINDOW_MS;
      const nextCount = withinWindow ? prevCount + 1 : 1;

      if (nextCount <= MAX_SILENT_RELOADS_WINDOW) {
        sessionStorage.setItem(SILENT_RELOAD_TS_KEY, String(now));
        sessionStorage.setItem(SILENT_RELOAD_COUNT_KEY, String(nextCount));
        window.setTimeout(() => {
          window.location.reload();
        }, 80);
        return;
      }
    } catch {
      window.setTimeout(() => {
        window.location.reload();
      }, 80);
      return;
    }

    this.setState({ isAutoReloading: false });
  }

  private handleReset = () => {
    const chunkErr = isChunkLoadError(this.state.error);
    if (!chunkErr) {
      purgeCorruptedCacheKeys();
    }
    try {
      sessionStorage.removeItem(SILENT_RELOAD_COUNT_KEY);
      sessionStorage.removeItem(SILENT_RELOAD_TS_KEY);
      sessionStorage.removeItem('akk_auto_recover_ts');
      sessionStorage.removeItem('akk_chunk_reload_ts');
    } catch {}
    this.setState({ hasError: false, isAutoReloading: false, error: undefined });
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      if (this.state.isAutoReloading) {
        return (
          <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center">
            <RefreshCw className="w-6 h-6 text-blue-600 dark:text-amber-400 animate-spin" />
          </div>
        );
      }

      return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex items-center justify-center p-6 text-center">
          <div className="max-w-sm w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-lg space-y-4">
            <div className="w-11 h-11 rounded-xl bg-blue-50 dark:bg-amber-500/10 border border-blue-200 dark:border-amber-500/25 flex items-center justify-center text-blue-600 dark:text-amber-400 mx-auto">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-300 font-medium">
              Halaman perlu dimuat ulang untuk melanjutkan.
            </p>
            <button
              onClick={this.handleReset}
              className="w-full py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 dark:bg-amber-500 dark:hover:bg-amber-400 text-white dark:text-slate-950 font-bold text-xs transition cursor-pointer active:scale-95 flex items-center justify-center gap-2"
            >
              <RefreshCw className="w-4 h-4" />
              <span>Muat Ulang</span>
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
