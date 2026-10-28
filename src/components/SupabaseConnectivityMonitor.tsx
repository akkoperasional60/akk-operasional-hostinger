import React, { useState, useEffect, useCallback } from 'react';
import { Activity, CheckCircle2, XCircle, RefreshCw, Server, Shield, Clock, Wifi } from 'lucide-react';
import { testSupabaseConnection } from '../services/supabaseService';

/**
 * Legacy filename retained for import compatibility.
 * The monitor now checks the Hostinger MySQL backend through /api/db-status.
 */
export const SupabaseConnectivityMonitor: React.FC = () => {
  const [status, setStatus] = useState<'checking' | 'connected' | 'disconnected'>('checking');
  const [latencyMs, setLatencyMs] = useState<number | null>(null);
  const [lastChecked, setLastChecked] = useState<Date | null>(null);
  const [message, setMessage] = useState<string>('Menyiapkan pemantauan Hostinger MySQL...');
  const [autoPing, setAutoPing] = useState<boolean>(true);

  const runCheck = useCallback(async () => {
    setStatus('checking');
    const startTime = performance.now();
    try {
      const result = await testSupabaseConnection();
      setLatencyMs(Math.round(performance.now() - startTime));
      setLastChecked(new Date());
      setStatus(result.success ? 'connected' : 'disconnected');
      setMessage(result.message);
    } catch (err: any) {
      setLatencyMs(Math.round(performance.now() - startTime));
      setLastChecked(new Date());
      setStatus('disconnected');
      setMessage(`Gagal terhubung: ${err?.message || 'Network error'}`);
    }
  }, []);

  useEffect(() => { runCheck(); }, [runCheck]);
  useEffect(() => {
    if (!autoPing) return;
    const interval = setInterval(runCheck, 30000);
    return () => clearInterval(interval);
  }, [autoPing, runCheck]);

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm space-y-4">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 pb-4 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <div className={`p-2.5 rounded-xl ${status === 'connected' ? 'bg-emerald-500/10 text-emerald-400' : status === 'checking' ? 'bg-amber-500/10 text-amber-400' : 'bg-red-500/10 text-red-400'}`}>
            <Activity className={`w-5 h-5 ${status === 'checking' ? 'animate-spin' : ''}`} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold text-white tracking-tight">Hostinger MySQL Connectivity Monitor</h3>
              <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold ${status === 'connected' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : status === 'checking' ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' : 'bg-red-500/20 text-red-300 border border-red-500/30'}`}>
                <span className={`w-2 h-2 rounded-full ${status === 'connected' ? 'bg-emerald-400 animate-pulse' : status === 'checking' ? 'bg-amber-400 animate-ping' : 'bg-red-400'}`} />
                {status === 'connected' ? 'Connected' : status === 'checking' ? 'Checking...' : 'Disconnected'}
              </span>
            </div>
            <p className="text-slate-400 text-xs mt-0.5">Pemantauan koneksi Express API ke database MySQL Hostinger.</p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start md:self-center">
          <button onClick={runCheck} disabled={status === 'checking'} className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-200 text-xs font-semibold transition cursor-pointer">
            <RefreshCw className={`w-3.5 h-3.5 ${status === 'checking' ? 'animate-spin' : ''}`} />
            <span>Periksa Sekarang</span>
          </button>
          <label className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-slate-300 text-xs cursor-pointer select-none">
            <input type="checkbox" checked={autoPing} onChange={(e) => setAutoPing(e.target.checked)} className="rounded bg-slate-900 border-slate-700 text-blue-600 focus:ring-blue-500 w-3.5 h-3.5" />
            <span>Auto-Ping (30s)</span>
          </label>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
        <div className="bg-slate-950 border border-slate-800 p-3 rounded-lg flex flex-col justify-between">
          <span className="text-slate-500 flex items-center gap-1.5"><Server className="w-3.5 h-3.5 text-blue-400" /><span>Backend</span></span>
          <span className="text-white font-mono font-semibold mt-2 truncate">Hostinger MySQL</span>
        </div>
        <div className="bg-slate-950 border border-slate-800 p-3 rounded-lg flex flex-col justify-between">
          <span className="text-slate-500 flex items-center gap-1.5"><Wifi className="w-3.5 h-3.5 text-emerald-400" /><span>Latency (RTT)</span></span>
          <span className="text-white font-mono font-semibold mt-2">{latencyMs !== null ? `${latencyMs} ms` : 'Mengukur...'}</span>
        </div>
        <div className="bg-slate-950 border border-slate-800 p-3 rounded-lg flex flex-col justify-between">
          <span className="text-slate-500 flex items-center gap-1.5"><Shield className="w-3.5 h-3.5 text-amber-400" /><span>Kredensial DB</span></span>
          <span className="text-emerald-400 font-semibold mt-2">Server-side ENV</span>
        </div>
        <div className="bg-slate-950 border border-slate-800 p-3 rounded-lg flex flex-col justify-between">
          <span className="text-slate-500 flex items-center gap-1.5"><Clock className="w-3.5 h-3.5 text-purple-400" /><span>Terakhir Diperiksa</span></span>
          <span className="text-slate-300 font-mono mt-2">{lastChecked ? lastChecked.toLocaleTimeString() : '-'}</span>
        </div>
      </div>

      {message && (
        <div className={`p-3 rounded-lg text-xs whitespace-pre-line border flex items-start gap-2.5 ${status === 'connected' ? 'bg-emerald-950/40 border-emerald-800/60 text-emerald-300' : status === 'checking' ? 'bg-amber-950/40 border-amber-800/60 text-amber-300' : 'bg-red-950/40 border-red-800/60 text-red-300'}`}>
          {status === 'connected' ? <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" /> : status === 'checking' ? <Activity className="w-4 h-4 text-amber-400 shrink-0 mt-0.5 animate-spin" /> : <XCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />}
          <div><span className="font-semibold block mb-0.5">Status Detail:</span><span>{message}</span></div>
        </div>
      )}
    </div>
  );
};
