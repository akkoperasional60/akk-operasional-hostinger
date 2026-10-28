import React, { useEffect, useState } from 'react';
import { ArrowRightLeft, RefreshCw, Database, FileSpreadsheet, CheckCircle2, XCircle, Clock } from 'lucide-react';
import { dataBridgeService, DataBridgeConfig, DataBridgeLogEntry } from '../services/dataBridgeService';

export const DataBridgeMonitor: React.FC = () => {
  const [config, setConfig] = useState<DataBridgeConfig>(() => dataBridgeService.getConfig());
  const [logs, setLogs] = useState<DataBridgeLogEntry[]>(() => dataBridgeService.getLogs());
  const [isSyncing, setIsSyncing] = useState<boolean>(dataBridgeService.isBusy());
  const [showLogs, setShowLogs] = useState(false);

  useEffect(() => dataBridgeService.subscribe(() => {
    setConfig(dataBridgeService.getConfig());
    setLogs(dataBridgeService.getLogs());
    setIsSyncing(dataBridgeService.isBusy());
  }), []);

  const handleTogglePeriodic = () => {
    if (config.isEnabled) dataBridgeService.stopPeriodicSync();
    else dataBridgeService.startPeriodicSync(config.intervalMinutes || 10);
  };

  const handleIntervalChange = (mins: number) => {
    dataBridgeService.updateConfig({ intervalMinutes: mins });
    if (config.isEnabled) dataBridgeService.startPeriodicSync(mins);
  };

  const handleManualSync = async () => {
    await dataBridgeService.syncNow('Manual Dashboard');
  };

  const statusClass = config.lastSyncStatus === 'success'
    ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30'
    : config.lastSyncStatus === 'error'
      ? 'text-red-400 bg-red-500/10 border-red-500/30'
      : 'text-amber-400 bg-amber-500/10 border-amber-500/30';

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg space-y-4">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center">
            <ArrowRightLeft className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-base font-bold text-white">DataBridge: Google Sheets ↔ Hostinger MySQL</h3>
              <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold border ${statusClass}`}>
                {isSyncing ? 'Sinkronisasi...' : config.lastSyncStatus === 'success' ? 'Sinkron' : config.lastSyncStatus === 'error' ? 'Error' : 'Siap'}
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">Data operasional ditulis melalui Express API ke MySQL Hostinger. Kredensial database tidak pernah dikirim ke browser.</p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={handleTogglePeriodic} className={`px-3 py-1.5 rounded-xl text-xs font-bold border ${config.isEnabled ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40' : 'bg-slate-800 text-slate-400 border-slate-700'}`}>
            <Clock className="w-3.5 h-3.5 inline mr-1" />
            {config.isEnabled ? `Otomatis ${config.intervalMinutes}m` : 'Otomatis Nonaktif'}
          </button>
          <button onClick={handleManualSync} disabled={isSyncing} className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-bold">
            <RefreshCw className={`w-3.5 h-3.5 inline mr-1 ${isSyncing ? 'animate-spin' : ''}`} />
            {isSyncing ? 'Memproses...' : 'Sinkronkan Sekarang'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-3">
          <div className="text-[10px] uppercase font-bold text-slate-400">Sumber</div>
          <div className="text-xs font-extrabold text-white mt-1 flex items-center gap-2"><FileSpreadsheet className="w-4 h-4 text-emerald-400" />Google Sheets ({config.sheetTitle || 'ALL'})</div>
        </div>
        <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-3">
          <div className="text-[10px] uppercase font-bold text-slate-400">Database</div>
          <div className="text-xs font-extrabold text-white mt-1 flex items-center gap-2"><Database className="w-4 h-4 text-blue-400" />Hostinger MySQL</div>
        </div>
        <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-3">
          <div className="text-[10px] uppercase font-bold text-slate-400">Interval</div>
          <div className="flex gap-1.5 mt-1">
            {[5, 10, 15, 30].map(mins => <button key={mins} onClick={() => handleIntervalChange(mins)} className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${config.intervalMinutes === mins ? 'bg-emerald-600 text-white' : 'bg-slate-800 text-slate-400'}`}>{mins}m</button>)}
          </div>
        </div>
        <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-3">
          <div className="text-[10px] uppercase font-bold text-slate-400">Terakhir Sinkron</div>
          <div className="text-xs font-mono font-bold text-slate-300 mt-1">{config.lastSyncTimestamp ? new Date(config.lastSyncTimestamp).toLocaleString('id-ID') : 'Belum pernah'}</div>
        </div>
      </div>

      {config.lastSyncMessage && (
        <div className={`p-3 rounded-xl border text-xs flex items-start gap-2.5 ${config.lastSyncStatus === 'success' ? 'bg-emerald-950/30 border-emerald-800/50 text-emerald-300' : 'bg-red-950/30 border-red-800/50 text-red-300'}`}>
          {config.lastSyncStatus === 'success' ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <XCircle className="w-4 h-4 shrink-0" />}
          <span>{config.lastSyncMessage}</span>
        </div>
      )}

      <div>
        <button onClick={() => setShowLogs(!showLogs)} className="text-xs font-bold text-slate-300 hover:text-white">{showLogs ? 'Sembunyikan Riwayat' : 'Lihat Riwayat Sinkronisasi'}</button>
        {showLogs && (
          <div className="mt-3 space-y-2 max-h-64 overflow-auto">
            {logs.length === 0 ? <div className="text-xs text-slate-500">Belum ada riwayat.</div> : logs.map(log => (
              <div key={log.id} className="bg-slate-950 border border-slate-800 rounded-lg p-3 text-xs">
                <div className="flex justify-between gap-3"><span className="font-bold text-white">{log.status.toUpperCase()}</span><span className="text-slate-500">{new Date(log.timestamp).toLocaleString('id-ID')}</span></div>
                <div className="text-slate-400 mt-1">{log.message}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
