import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  children?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

const CACHE_KEYS_TO_PURGE_ON_ERROR = [
  'akk_admin_calendar_schedules_v1',
  'akk_sales_admin_branch_map_v1',
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

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught React Error:', error, errorInfo);
    purgeCorruptedCacheKeys();

    // Auto-recover once per 15 seconds so stale browser localStorage never traps the user
    try {
      const now = Date.now();
      const lastRecover = Number(sessionStorage.getItem('akk_auto_recover_ts') || '0');
      if (!lastRecover || now - lastRecover > 15000) {
        sessionStorage.setItem('akk_auto_recover_ts', String(now));
        this.setState({ hasError: false, error: undefined });
      }
    } catch {}
  }

  private handleReset = () => {
    purgeCorruptedCacheKeys();
    try {
      sessionStorage.removeItem('akk_auto_recover_ts');
    } catch {}
    this.setState({ hasError: false, error: undefined });
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-6 text-center selection:bg-amber-500 selection:text-slate-950">
          <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-2xl p-8 shadow-2xl space-y-6">
            <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/25 flex items-center justify-center text-amber-400 mx-auto">
              <AlertTriangle className="w-8 h-8" />
            </div>

            <div className="space-y-2">
              <h2 className="text-xl font-black text-white tracking-tight">Sistem Mengalami Pemulihan Otomatis</h2>
              <p className="text-xs text-slate-400 leading-relaxed">
                Aplikasi telah mengamankan data Anda dan mengosongkan memori sementara untuk menjaga stabilitas operasional.
              </p>
            </div>

            <div className="pt-2">
              <button
                onClick={this.handleReset}
                className="w-full py-3 px-4 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs shadow-lg shadow-amber-500/10 transition cursor-pointer active:scale-95 flex items-center justify-center gap-2"
              >
                <RefreshCw className="w-4 h-4" />
                <span>Muat Ulang Sistem Operasional AKK</span>
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
