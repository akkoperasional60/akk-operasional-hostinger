import React, { useState, useMemo } from 'react';
import { 
  Ship, 
  MapPin, 
  Clock, 
  AlertTriangle, 
  CheckCircle2, 
  ChevronDown, 
  ChevronUp, 
  Users, 
  Truck, 
  Calendar, 
  ShieldCheck, 
  Sparkles, 
  Activity, 
  Zap, 
  ArrowRight,
  Info,
  Timer,
  Navigation,
  Compass,
  AlertCircle,
  RefreshCw
} from 'lucide-react';
import { Schedule, Crew, Fleet } from '../types';
import { ScheduleInitializerService } from '../services/scheduleInitializer';

interface OutboundGapMonitoringPanelProps {
  schedules: Schedule[];
  crews: Crew[];
  fleets: Fleet[];
  onOpenSimulation?: () => void;
  onSelectSchedule?: (schedule: Schedule) => void;
}

// Known Out-of-town locations & keywords
const LUAR_KOTA_KEYWORDS = [
  'denpasar',
  'singaraja',
  'negara',
  'bali',
  'situbondo',
  'bondowoso',
  'jember',
  'inter-island'
];

export const isLuarKotaSchedule = (s: Schedule): boolean => {
  if (s.isInterIsland) return true;
  const storeName = (s.store?.storeName || '').toLowerCase();
  const notes = (s.notes || '').toLowerCase();
  const city = (s.store?.city || '').toLowerCase();
  const island = (s.store?.island || '').toLowerCase();

  return (
    island !== 'jawa' ||
    LUAR_KOTA_KEYWORDS.some(k => storeName.includes(k) || notes.includes(k) || city.includes(k))
  );
};

export const OutboundGapMonitoringPanel: React.FC<OutboundGapMonitoringPanelProps> = ({
  schedules,
  crews,
  fleets,
  onOpenSimulation,
  onSelectSchedule
}) => {
  const [isExpanded, setIsExpanded] = useState<boolean>(true);
  const [categoryFilter, setCategoryFilter] = useState<'all' | 'bali' | 'jatim'>('all');
  const [selectedDriverFilter, setSelectedDriverFilter] = useState<string>('all');
  const [actionFeedback, setActionFeedback] = useState<string | null>(null);

  const handleAutoRebalance = () => {
    const result = ScheduleInitializerService.rebalanceExistingSchedulesWithGapRule();
    if (result.violationsResolved > 0) {
      setActionFeedback(`⚡ Berhasil menyelesaikan ${result.violationsResolved} konflik jadwal luar kota! Jeda 24 jam berhasil diseimbangkan.`);
    } else {
      setActionFeedback(`✅ Semua jadwal luar kota saat ini sudah mematuhi jeda istirahat minimum 24 jam.`);
    }
    setTimeout(() => setActionFeedback(null), 5000);
  };

  // Filter ONLY Luar Kota & Inter-Island schedules
  const outboundSchedules = useMemo(() => {
    return schedules.filter(isLuarKotaSchedule).sort((a, b) => {
      return new Date(a.departureDate).getTime() - new Date(b.departureDate).getTime();
    });
  }, [schedules]);

  // Compute 24-Hour Gap Audit for each driver and each schedule
  const gapAuditResults = useMemo(() => {
    const driverSchedulesMap = new Map<string, Schedule[]>();
    
    // Group schedules by assigned driver
    outboundSchedules.forEach(s => {
      if (s.crewId) {
        const list = driverSchedulesMap.get(s.crewId) || [];
        list.push(s);
        driverSchedulesMap.set(s.crewId, list);
      }
    });

    // Per-schedule gap calculations
    const scheduleGapMap = new Map<string, {
      prevSchedule?: Schedule;
      nextSchedule?: Schedule;
      gapHoursFromPrev?: number;
      gapHoursToNext?: number;
      hasViolation: boolean;
      statusText: string;
      statusType: 'safe' | 'warning' | 'isolated';
    }>();

    let totalViolations = 0;

    driverSchedulesMap.forEach((driverScheds, driverId) => {
      // Sort by departure time
      const sorted = [...driverScheds].sort((a, b) => 
        new Date(a.departureDate).getTime() - new Date(b.departureDate).getTime()
      );

      for (let i = 0; i < sorted.length; i++) {
        const current = sorted[i];
        const prev = i > 0 ? sorted[i - 1] : undefined;
        const next = i < sorted.length - 1 ? sorted[i + 1] : undefined;

        let gapFromPrev: number | undefined;
        let gapToNext: number | undefined;
        let isViolating = false;
        let statusType: 'safe' | 'warning' | 'isolated' = 'isolated';
        let statusText = 'Jeda Optimal (Trip Tunggal)';

        if (prev) {
          // Time diff in hours from previous departure/arrival
          const prevDep = new Date(prev.departureDate).getTime();
          const currDep = new Date(current.departureDate).getTime();
          gapFromPrev = Math.round(((currDep - prevDep) / (1000 * 60 * 60)) * 10) / 10;

          if (gapFromPrev < 24) {
            isViolating = true;
          }
        }

        if (next) {
          const currDep = new Date(current.departureDate).getTime();
          const nextDep = new Date(next.departureDate).getTime();
          gapToNext = Math.round(((nextDep - currDep) / (1000 * 60 * 60)) * 10) / 10;

          if (gapToNext < 24) {
            isViolating = true;
          }
        }

        if (isViolating) {
          totalViolations++;
          statusType = 'warning';
          const minGap = Math.min(
            gapFromPrev !== undefined ? gapFromPrev : 999,
            gapToNext !== undefined ? gapToNext : 999
          );
          statusText = `⚠️ Jeda < 24 Jam (${minGap} Jam) - Risiko Kelelahan!`;
        } else if (gapFromPrev !== undefined || gapToNext !== undefined) {
          statusType = 'safe';
          const minGap = Math.min(
            gapFromPrev !== undefined ? gapFromPrev : 999,
            gapToNext !== undefined ? gapToNext : 999
          );
          statusText = `✅ Jeda Aman (${minGap} Jam Recovery)`;
        }

        scheduleGapMap.set(current.id, {
          prevSchedule: prev,
          nextSchedule: next,
          gapHoursFromPrev: gapFromPrev,
          gapHoursToNext: gapToNext,
          hasViolation: isViolating,
          statusText,
          statusType
        });
      }
    });

    return {
      scheduleGapMap,
      driverSchedulesMap,
      totalViolations,
      isAllCompliant: totalViolations === 0 && outboundSchedules.length > 0
    };
  }, [outboundSchedules]);

  // Filtered schedules for rendering
  const displayedOutbound = useMemo(() => {
    return outboundSchedules.filter(s => {
      const isBali = s.isInterIsland || (s.store?.city || '').toLowerCase().includes('bali') || (s.store?.storeName || '').toLowerCase().includes('denpasar') || (s.store?.storeName || '').toLowerCase().includes('singaraja') || (s.store?.storeName || '').toLowerCase().includes('negara');
      
      if (categoryFilter === 'bali' && !isBali) return false;
      if (categoryFilter === 'jatim' && isBali) return false;

      if (selectedDriverFilter !== 'all' && s.crewId !== selectedDriverFilter) return false;

      return true;
    });
  }, [outboundSchedules, categoryFilter, selectedDriverFilter]);

  // Statistics
  const interIslandCount = outboundSchedules.filter(s => s.isInterIsland).length;
  const jatimCount = outboundSchedules.length - interIslandCount;

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl no-print transition-all">
      {/* Panel Banner Header */}
      <div className="bg-gradient-to-r from-purple-950/80 via-slate-950 to-indigo-950/70 p-4 sm:p-5 border-b border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-start sm:items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-purple-500/20 border border-purple-500/40 flex items-center justify-center text-purple-400 shrink-0">
            <Compass className="w-5 h-5 text-purple-400 animate-spin-slow" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="px-2 py-0.5 rounded-md bg-purple-500/20 text-purple-300 text-[10px] font-black tracking-wider uppercase border border-purple-500/30">
                PANEL EKSKLUSIF
              </span>
              <h3 className="text-base font-black text-white tracking-tight">
                Monitoring Status Kiriman Luar Kota & Audit Jeda 24 Jam
              </h3>
              <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold border flex items-center gap-1 ${
                gapAuditResults.totalViolations === 0
                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                  : 'bg-rose-500/20 text-rose-300 border-rose-500/30 animate-pulse'
              }`}>
                {gapAuditResults.totalViolations === 0 ? (
                  <>
                    <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                    <span>Jeda 24 Jam: 100% Terpenuhi</span>
                  </>
                ) : (
                  <>
                    <AlertTriangle className="w-3 h-3 text-rose-400" />
                    <span>{gapAuditResults.totalViolations} Jadwal Melanggar Jeda &lt;24 Jam</span>
                  </>
                )}
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1 max-w-3xl">
              Memantau jadwal pengiriman Antar-Pulau (Bali) & Luar Kota (Jember, Situbondo, Bondowoso). Memastikan setiap supir memiliki interval pemulihan minimum 24 jam sebelum keberangkatan luar kota berikutnya.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start md:self-center shrink-0 flex-wrap">
          <button
            onClick={handleAutoRebalance}
            className={`px-3 py-1.5 rounded-xl text-white text-xs font-bold transition cursor-pointer flex items-center gap-1.5 shadow-md ${
              gapAuditResults.totalViolations > 0
                ? 'bg-rose-600 hover:bg-rose-500 animate-pulse ring-2 ring-rose-400/50'
                : 'bg-emerald-700 hover:bg-emerald-600'
            }`}
            title="Selesaikan potensi konflik jeda < 24 jam dengan rotasi alternatif"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>{gapAuditResults.totalViolations > 0 ? '⚡ Atasi Konflik Jeda' : 'Auto-Rebalance 24H'}</span>
          </button>

          {onOpenSimulation && (
            <button
              onClick={onOpenSimulation}
              className="px-3 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold transition cursor-pointer flex items-center gap-1.5 shadow-md"
            >
              <Sparkles className="w-3.5 h-3.5 text-purple-200" />
              <span>Simulasi Rotasi Kru</span>
            </button>
          )}

          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition cursor-pointer"
            title={isExpanded ? 'Sembunyikan Panel' : 'Buka Panel'}
          >
            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {actionFeedback && (
        <div className="bg-indigo-950/90 border-b border-indigo-800/80 px-4 py-2.5 text-xs text-indigo-200 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{actionFeedback}</span>
        </div>
      )}

      {/* Expandable Content Area */}
      {isExpanded && (
        <div className="p-4 sm:p-5 space-y-4">
          
          {/* Top Quick Metrics & Rest Schedule Guideline */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
              <div className="text-[10px] text-slate-400 font-medium">Total Kiriman Luar Kota</div>
              <div className="text-lg font-black text-white mt-0.5">{outboundSchedules.length} Jadwal</div>
              <div className="text-[10px] text-purple-400 mt-1 font-mono">
                {interIslandCount} Bali • {jatimCount} Jatim
              </div>
            </div>

            <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
              <div className="text-[10px] text-slate-400 font-medium">Kepatuhan Jeda Min. 24 Jam</div>
              <div className={`text-lg font-black mt-0.5 ${
                gapAuditResults.totalViolations === 0 ? 'text-emerald-400' : 'text-rose-400'
              }`}>
                {gapAuditResults.totalViolations === 0 ? '100% Sempurna' : `${gapAuditResults.totalViolations} Pelanggaran`}
              </div>
              <div className="text-[10px] text-slate-400 mt-1">
                {gapAuditResults.totalViolations === 0 ? 'Zero Fatigue Risk' : 'Perlu Reschedule'}
              </div>
            </div>

            <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
              <div className="text-[10px] text-slate-400 font-medium">Tiket Kapal ASDP (Bali)</div>
              <div className="text-lg font-black text-indigo-400 mt-0.5">{interIslandCount} Rute</div>
              <div className="text-[10px] text-indigo-300 mt-1">Ketapang ⇄ Gilimanuk</div>
            </div>

            <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
              <div className="text-[10px] text-slate-400 font-medium">Hari Jeda Terbuka (OFF LK)</div>
              <div className="text-lg font-black text-amber-400 mt-0.5">Jumat (0 LK)</div>
              <div className="text-[10px] text-amber-300 mt-1">Fokus Distribusi Lokal BWI</div>
            </div>
          </div>

          {/* Standard Outbound Schedule Sequence Guide */}
          <div className="bg-slate-950/70 p-3 rounded-xl border border-slate-800/80">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-bold text-slate-300 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-indigo-400" />
                <span>Pola Distribusi Luar Kota Mingguan (Wajib Jeda 24 Jam Antar Hari):</span>
              </span>
              <span className="text-[10px] text-slate-500 font-mono">Standar SOP Logistik</span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 text-[10px]">
              <div className="bg-slate-900/90 p-2 rounded-lg border border-purple-900/40">
                <div className="font-bold text-purple-300">Senin (4 Rute LK)</div>
                <div className="text-slate-400 mt-0.5 truncate">Denpasar 1 & 2, Situbondo, Bondowoso</div>
              </div>
              <div className="bg-slate-900/90 p-2 rounded-lg border border-purple-900/40">
                <div className="font-bold text-purple-300">Selasa (2 Rute LK)</div>
                <div className="text-slate-400 mt-0.5 truncate">Jember Selatan, Singaraja</div>
              </div>
              <div className="bg-slate-900/90 p-2 rounded-lg border border-purple-900/40">
                <div className="font-bold text-purple-300">Rabu (2 Rute LK)</div>
                <div className="text-slate-400 mt-0.5 truncate">Denpasar 1 & 2</div>
              </div>
              <div className="bg-slate-900/90 p-2 rounded-lg border border-purple-900/40">
                <div className="font-bold text-purple-300">Kamis (3 Rute LK)</div>
                <div className="text-slate-400 mt-0.5 truncate">Singaraja, Situbondo-Bdw, Jbr Barat</div>
              </div>
              <div className="bg-emerald-950/40 p-2 rounded-lg border border-emerald-800/50">
                <div className="font-bold text-emerald-300">Jumat (0 LK)</div>
                <div className="text-emerald-400 mt-0.5 truncate font-semibold">Jeda Pemulihan Kru & Servis</div>
              </div>
              <div className="bg-slate-900/90 p-2 rounded-lg border border-purple-900/40">
                <div className="font-bold text-purple-300">Sabtu (2 Rute LK)</div>
                <div className="text-slate-400 mt-0.5 truncate">Negara, Jember Kota</div>
              </div>
            </div>
          </div>

          {/* Filter Toolbar for Panel */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
            <div className="flex items-center gap-2 bg-slate-950 p-1 rounded-xl border border-slate-800 flex-wrap">
              <button
                onClick={() => setCategoryFilter('all')}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                  categoryFilter === 'all' ? 'bg-purple-600 text-white shadow' : 'text-slate-400 hover:text-white'
                }`}
              >
                Semua Luar Kota ({outboundSchedules.length})
              </button>
              <button
                onClick={() => setCategoryFilter('bali')}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                  categoryFilter === 'bali' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-white'
                }`}
              >
                <Ship className="w-3.5 h-3.5" />
                <span>Antar-Pulau Bali ({interIslandCount})</span>
              </button>
              <button
                onClick={() => setCategoryFilter('jatim')}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                  categoryFilter === 'jatim' ? 'bg-blue-600 text-white shadow' : 'text-slate-400 hover:text-white'
                }`}
              >
                <Truck className="w-3.5 h-3.5" />
                <span>Luar Kota Jawa Timur ({jatimCount})</span>
              </button>
            </div>

            {/* Filter by Driver */}
            <div className="flex items-center gap-2 text-xs">
              <span className="text-slate-400 text-[11px] font-medium">Supir:</span>
              <select
                value={selectedDriverFilter}
                onChange={(e) => setSelectedDriverFilter(e.target.value)}
                className="bg-slate-950 border border-slate-800 text-white rounded-lg px-2.5 py-1 text-xs focus:outline-none"
              >
                <option value="all">Semua Supir Luar Kota</option>
                {crews.filter(c => !c.role.includes('Helper')).map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
          </div>

          {/* List / Cards of Exclusive Outbound Schedules with 24h Gap Status */}
          {displayedOutbound.length === 0 ? (
            <div className="bg-slate-950 p-8 rounded-xl border border-slate-800 text-center">
              <Compass className="w-8 h-8 text-slate-600 mx-auto mb-2" />
              <div className="text-slate-300 font-bold text-xs">Tidak ada jadwal luar kota yang sesuai filter</div>
              <p className="text-slate-500 text-[11px] mt-1">
                Gunakan tombol "Inisialisasi Rute Rutin" atau "Simulasi Rotasi Kru" untuk memuat jadwal luar kota.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {displayedOutbound.map(s => {
                const gapInfo = gapAuditResults.scheduleGapMap.get(s.id);
                const isBali = s.isInterIsland || (s.store?.island || '').toLowerCase().includes('bali') || (s.store?.storeName || '').toLowerCase().includes('denpasar') || (s.store?.storeName || '').toLowerCase().includes('singaraja') || (s.store?.storeName || '').toLowerCase().includes('negara');
                const depDate = new Date(s.departureDate);
                const arrDate = new Date(s.estimatedArrival);

                return (
                  <div
                    key={s.id}
                    onClick={() => onSelectSchedule && onSelectSchedule(s)}
                    className={`p-3.5 rounded-xl border transition-all text-xs flex flex-col justify-between space-y-3 cursor-pointer ${
                      gapInfo?.hasViolation
                        ? 'bg-rose-950/20 border-rose-800/80 hover:border-rose-700 ring-1 ring-rose-500/20'
                        : 'bg-slate-950 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    {/* Header */}
                    <div>
                      <div className="flex items-center justify-between gap-2 mb-1.5">
                        <div className="flex items-center gap-1.5">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            isBali ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30' : 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                          }`}>
                            {isBali ? 'Inter-Island (Bali)' : 'Luar Kota (Jatim)'}
                          </span>
                          <span className="font-mono text-slate-500 text-[10px]">{s.trackingNumber}</span>
                        </div>

                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold capitalize ${
                          s.status === 'in_transit' ? 'bg-amber-500/20 text-amber-300' :
                          s.status === 'delivered' ? 'bg-emerald-500/20 text-emerald-300' :
                          'bg-slate-800 text-slate-300'
                        }`}>
                          {s.status === 'in_transit' ? 'Jalan' : s.status === 'scheduled' ? 'Terjadwal' : s.status}
                        </span>
                      </div>

                      {/* Area Kirim / Destination */}
                      <div className="font-bold text-white text-sm flex items-center gap-1.5 mt-1">
                        <MapPin className="w-4 h-4 text-emerald-400 shrink-0" />
                        <span className="truncate">{s.areaName || s.store?.storeName || 'Area Tujuan Luar Kota'}</span>
                      </div>
                      <div className="text-[11px] text-slate-400 mt-0.5">
                        {s.store?.city}, {s.store?.island} • {s.cargoWeightTon} Ton ({s.cargoDescription || 'Logistik'})
                      </div>
                    </div>

                    {/* Ferry ASDP Info if Bali */}
                    {s.isInterIsland && (
                      <div className="bg-indigo-950/40 p-2 rounded-lg border border-indigo-900/50 text-[10px] text-indigo-300 flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <Ship className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                          <span className="truncate">{s.transitPort || 'Ketapang ⇄ Gilimanuk'}</span>
                        </div>
                        {s.ferryBookingCode && (
                          <span className="font-mono text-indigo-200 text-[9px] font-bold">
                            {s.ferryBookingCode}
                          </span>
                        )}
                      </div>
                    )}

                    {/* Departure / Arrival Time */}
                    <div className="bg-slate-900/90 p-2.5 rounded-lg border border-slate-800/80 text-[11px] space-y-1">
                      <div className="flex items-center justify-between text-slate-300">
                        <span className="text-slate-400 flex items-center gap-1">
                          <Clock className="w-3 h-3 text-indigo-400" />
                          <span>Berangkat:</span>
                        </span>
                        <span className="font-mono font-bold text-white">
                          {depDate.toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric', month: 'short' })}, {depDate.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-slate-400 text-[10px]">
                        <span>Est. Tiba:</span>
                        <span className="font-mono">
                          {arrDate.toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric', month: 'short' })}, {arrDate.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    </div>

                    {/* Crew & Fleet */}
                    <div className="flex items-center justify-between text-[11px] text-slate-300 pt-1 border-t border-slate-800/60">
                      <div className="flex items-center gap-1.5 truncate max-w-[150px]">
                        <Users className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                        <span className="font-semibold text-white truncate">
                          {s.crew?.name || 'Supir Ditugaskan'}
                        </span>
                      </div>
                      <div className="flex items-center gap-1 text-slate-400 font-mono text-[10px]">
                        <Truck className="w-3 h-3 text-amber-400" />
                        <span>{s.fleet?.plateNumber || 'Armada'}</span>
                      </div>
                    </div>

                    {/* 24-HOUR MINIMUM GAP BADGE & STATUS */}
                    <div className="pt-2 border-t border-slate-800/60">
                      {gapInfo?.hasViolation ? (
                        <div className="bg-rose-500/15 border border-rose-500/30 text-rose-300 p-2 rounded-lg text-[10px] flex items-center justify-between">
                          <div className="flex items-center gap-1.5 font-bold">
                            <AlertTriangle className="w-3.5 h-3.5 text-rose-400 shrink-0 animate-pulse" />
                            <span>{gapInfo.statusText}</span>
                          </div>
                          <span className="bg-rose-950 text-rose-300 px-1.5 py-0.5 rounded font-mono text-[9px] font-black border border-rose-800">
                            REVISE
                          </span>
                        </div>
                      ) : (
                        <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 p-2 rounded-lg text-[10px] flex items-center justify-between">
                          <div className="flex items-center gap-1.5 font-medium">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                            <span>{gapInfo?.statusText || '✅ Jeda Minimum 24 Jam Terpenuhi'}</span>
                          </div>
                          <span className="text-emerald-400 font-bold font-mono text-[9px]">
                            AMAN
                          </span>
                        </div>
                      )}
                    </div>

                  </div>
                );
              })}
            </div>
          )}

        </div>
      )}
    </div>
  );
};
