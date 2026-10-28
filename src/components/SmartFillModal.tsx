import React, { useState, useMemo } from 'react';
import { 
  Sparkles, 
  Calendar, 
  CheckCircle2, 
  AlertTriangle, 
  Clock, 
  Truck, 
  Ship, 
  Users, 
  ShieldCheck, 
  ShieldAlert, 
  Layers, 
  ArrowRight, 
  RotateCcw, 
  Check, 
  X, 
  Info,
  Zap,
  ChevronRight,
  Filter
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ScheduleInitializerService, 
  FIXED_WEEKLY_ROUTES_CONFIG, 
  SmartFillOptions, 
  SmartFillResult, 
  SmartFillValidationConflict 
} from '../services/scheduleInitializer';
import { Schedule, Crew, Fleet, RetailStore } from '../types';
import { logisticsStore } from '../services/store';

interface SmartFillModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (result: SmartFillResult) => void;
}

type DayName = 'Senin' | 'Selasa' | 'Rabu' | 'Kamis' | 'Jumat' | 'Sabtu';

export const SmartFillModal: React.FC<SmartFillModalProps> = ({
  isOpen,
  onClose,
  onSuccess
}) => {
  const [weekOffset, setWeekOffset] = useState<number>(0); // 0 = current, 1 = next week, 2 = 2 weeks ahead
  const [customStartDate, setCustomStartDate] = useState<string>('');
  const [fillMode, setFillMode] = useState<'full_priority' | 'outbound_only' | 'local_only' | 'custom_days'>('full_priority');
  const [selectedDays, setSelectedDays] = useState<DayName[]>(['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu']);
  const [overwriteExisting, setOverwriteExisting] = useState<boolean>(true);
  const [autoAssignFerry, setAutoAssignFerry] = useState<boolean>(true);
  const [enforce24hGap, setEnforce24hGap] = useState<boolean>(true);
  const [isUrgentOverride, setIsUrgentOverride] = useState<boolean>(false);

  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<'preview' | 'conflicts' | 'patterns'>('preview');

  // Calculate targeted Monday date
  const targetMonday = useMemo(() => {
    const base = customStartDate ? new Date(customStartDate) : new Date();
    const day = base.getDay();
    const diff = (day === 0 ? -6 : 1) - day;
    const monday = new Date(base);
    monday.setDate(base.getDate() + diff + (customStartDate ? 0 : weekOffset * 7));
    monday.setHours(7, 0, 0, 0);
    return monday;
  }, [customStartDate, weekOffset]);

  // Filter routes based on mode & days for preview
  const plannedRoutes = useMemo(() => {
    return FIXED_WEEKLY_ROUTES_CONFIG.filter(cfg => {
      if (fillMode === 'custom_days') {
        if (!selectedDays.includes(cfg.dayName)) return false;
      }
      if (fillMode === 'outbound_only' && !cfg.isLuarKota) return false;
      if (fillMode === 'local_only' && cfg.isLuarKota) return false;
      return true;
    });
  }, [fillMode, selectedDays]);

  const outboundCount = plannedRoutes.filter(r => r.isLuarKota).length;
  const localCount = plannedRoutes.filter(r => !r.isLuarKota).length;
  const ferryCount = plannedRoutes.filter(r => r.island !== 'Jawa').length;

  // Cross-Day Pre-validation Simulation
  const validationSimulation = useMemo(() => {
    // Current schedules in store
    const existing = logisticsStore.getSchedules();
    const conflicts = ScheduleInitializerService.validateCrossDayConflicts(existing);

    // Group planned routes by day
    const dayBreakdown: Record<DayName, { total: number; outbound: number; local: number; routes: typeof plannedRoutes }> = {
      'Senin': { total: 0, outbound: 0, local: 0, routes: [] },
      'Selasa': { total: 0, outbound: 0, local: 0, routes: [] },
      'Rabu': { total: 0, outbound: 0, local: 0, routes: [] },
      'Kamis': { total: 0, outbound: 0, local: 0, routes: [] },
      'Jumat': { total: 0, outbound: 0, local: 0, routes: [] },
      'Sabtu': { total: 0, outbound: 0, local: 0, routes: [] }
    };

    plannedRoutes.forEach(r => {
      if (dayBreakdown[r.dayName]) {
        dayBreakdown[r.dayName].total++;
        if (r.isLuarKota) dayBreakdown[r.dayName].outbound++;
        else dayBreakdown[r.dayName].local++;
        dayBreakdown[r.dayName].routes.push(r);
      }
    });

    return {
      conflicts,
      isClean: conflicts.length === 0,
      dayBreakdown
    };
  }, [plannedRoutes]);

  const handleToggleDay = (day: DayName) => {
    if (selectedDays.includes(day)) {
      if (selectedDays.length > 1) {
        setSelectedDays(selectedDays.filter(d => d !== day));
      }
    } else {
      setSelectedDays([...selectedDays, day]);
    }
  };

  const handleExecuteSmartFill = () => {
    setIsProcessing(true);
    setTimeout(() => {
      try {
        const options: SmartFillOptions = {
          weekOffset: customStartDate ? 0 : weekOffset,
          startDate: customStartDate ? new Date(customStartDate) : undefined,
          mode: fillMode,
          selectedDays: fillMode === 'custom_days' ? selectedDays : undefined,
          overwriteExisting,
          autoAssignFerryTicket: autoAssignFerry,
          enforce24hGap,
          isUrgent: isUrgentOverride
        };

        const result = ScheduleInitializerService.runSmartFill(options);
        setIsProcessing(false);
        onSuccess(result);
        onClose();
      } catch (err) {
        console.error('Failed to run Smart Fill:', err);
        setIsProcessing(false);
      }
    }, 400);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-md overflow-y-auto animate-fade-in">
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        className="bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden text-slate-200"
      >
        {/* Modal Header */}
        <div className="p-5 bg-gradient-to-r from-emerald-950 via-slate-900 to-indigo-950 border-b border-slate-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 shadow-md">
              <Sparkles className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  Algoritma Penjadwalan Cerdas
                </span>
                <span className="text-xs text-slate-400">Pola Prioritas Disepakati</span>
              </div>
              <h2 className="text-xl font-black text-white tracking-tight flex items-center gap-2">
                <span>Smart Fill Jadwal Mingguan</span>
              </h2>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body: Scrollable */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-6 flex-1 text-xs">
          {/* Target Week Selection */}
          <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <label className="text-xs font-bold text-white flex items-center gap-2">
                <Calendar className="w-4 h-4 text-indigo-400" />
                <span>Pilih Periode Minggu Pengiriman:</span>
              </label>

              <span className="text-xs text-slate-400">
                Mulai: <strong className="text-emerald-400 font-mono">Senin, {targetMonday.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</strong>
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
              <button
                type="button"
                onClick={() => { setWeekOffset(0); setCustomStartDate(''); }}
                className={`p-2.5 rounded-lg font-bold transition cursor-pointer flex flex-col items-center justify-center gap-0.5 border ${
                  weekOffset === 0 && !customStartDate
                    ? 'bg-blue-600 text-white border-blue-400 shadow-md'
                    : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white'
                }`}
              >
                <span>Minggu Ini</span>
                <span className="text-[10px] opacity-80">W0 (Aktif)</span>
              </button>

              <button
                type="button"
                onClick={() => { setWeekOffset(1); setCustomStartDate(''); }}
                className={`p-2.5 rounded-lg font-bold transition cursor-pointer flex flex-col items-center justify-center gap-0.5 border ${
                  weekOffset === 1 && !customStartDate
                    ? 'bg-blue-600 text-white border-blue-400 shadow-md'
                    : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white'
                }`}
              >
                <span>Minggu Depan</span>
                <span className="text-[10px] opacity-80">W+1 (Next Week)</span>
              </button>

              <button
                type="button"
                onClick={() => { setWeekOffset(2); setCustomStartDate(''); }}
                className={`p-2.5 rounded-lg font-bold transition cursor-pointer flex flex-col items-center justify-center gap-0.5 border ${
                  weekOffset === 2 && !customStartDate
                    ? 'bg-blue-600 text-white border-blue-400 shadow-md'
                    : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white'
                }`}
              >
                <span>2 Minggu Lagi</span>
                <span className="text-[10px] opacity-80">W+2</span>
              </button>

              <div className="relative">
                <input
                  type="date"
                  value={customStartDate}
                  onChange={(e) => setCustomStartDate(e.target.value)}
                  className="w-full h-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-indigo-500 cursor-pointer"
                  title="Pilih Tanggal Mulai Kustom"
                />
              </div>
            </div>
          </div>

          {/* Mode Smart Fill & Pola Prioritas */}
          <div className="space-y-3">
            <label className="text-xs font-bold text-white flex items-center gap-2">
              <Layers className="w-4 h-4 text-emerald-400" />
              <span>Pilih Pola Prioritas Pengisian:</span>
            </label>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
              {/* Mode 1: Pola Prioritas Lengkap */}
              <button
                type="button"
                onClick={() => setFillMode('full_priority')}
                className={`p-3 rounded-xl border text-left transition cursor-pointer flex flex-col justify-between gap-2 ${
                  fillMode === 'full_priority'
                    ? 'bg-emerald-950/60 border-emerald-500 text-white ring-2 ring-emerald-500/30'
                    : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs text-white">⭐ Pola Prioritas Lengkap</span>
                    <span className="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 text-[10px] font-bold">36 Rute</span>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
                    13 Luar Kota (Denpasar, Singaraja, Negara, Jember, Situbondo, Bondowoso) + 23 Lokal Banyuwangi.
                  </p>
                </div>
                <span className="text-[10px] text-emerald-400 font-semibold flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5" /> Jeda 24H Terproteksi
                </span>
              </button>

              {/* Mode 2: Prioritas Luar Kota Saja */}
              <button
                type="button"
                onClick={() => setFillMode('outbound_only')}
                className={`p-3 rounded-xl border text-left transition cursor-pointer flex flex-col justify-between gap-2 ${
                  fillMode === 'outbound_only'
                    ? 'bg-indigo-950/60 border-indigo-500 text-white ring-2 ring-indigo-500/30'
                    : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs text-white">🚚 Hanya Luar Kota</span>
                    <span className="px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-300 text-[10px] font-bold">13 Rute</span>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
                    Khusus rute jarak jauh & antar-pulau dengan alokasi armada Double & booking ASDP.
                  </p>
                </div>
                <span className="text-[10px] text-indigo-400 font-semibold flex items-center gap-1">
                  <Ship className="w-3.5 h-3.5" /> Auto-Tiket Kapal
                </span>
              </button>

              {/* Mode 3: Hanya Lokal */}
              <button
                type="button"
                onClick={() => setFillMode('local_only')}
                className={`p-3 rounded-xl border text-left transition cursor-pointer flex flex-col justify-between gap-2 ${
                  fillMode === 'local_only'
                    ? 'bg-purple-950/60 border-purple-500 text-white ring-2 ring-purple-500/30'
                    : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs text-white">📦 Hanya Distribusi Lokal</span>
                    <span className="px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-300 text-[10px] font-bold">23 Rute</span>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
                    Distribusi dalam kota (Genteng, Rogojampi, Muncar, Jajag, Kalibaru, Srono).
                  </p>
                </div>
                <span className="text-[10px] text-purple-400 font-semibold flex items-center gap-1">
                  <Truck className="w-3.5 h-3.5" /> Rotasi Beban Seimbang
                </span>
              </button>

              {/* Mode 4: Kustom Hari */}
              <button
                type="button"
                onClick={() => setFillMode('custom_days')}
                className={`p-3 rounded-xl border text-left transition cursor-pointer flex flex-col justify-between gap-2 ${
                  fillMode === 'custom_days'
                    ? 'bg-amber-950/60 border-amber-500 text-white ring-2 ring-amber-500/30'
                    : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs text-white">📅 Kustom Hari</span>
                    <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 text-[10px] font-bold">Pilih Hari</span>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
                    Pilih hari-hari tertentu yang ingin di-generate (misal hanya Senin & Rabu).
                  </p>
                </div>
                <span className="text-[10px] text-amber-400 font-semibold">
                  {selectedDays.length} Hari Terpilih
                </span>
              </button>
            </div>

            {/* Custom Day Checklist (Only visible if custom_days is active) */}
            {fillMode === 'custom_days' && (
              <div className="p-3 bg-slate-950/70 border border-slate-800 rounded-xl flex items-center gap-2 flex-wrap animate-fade-in">
                <span className="text-slate-400 text-xs font-bold mr-2">Pilih Hari:</span>
                {(['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'] as DayName[]).map(day => (
                  <button
                    key={day}
                    type="button"
                    onClick={() => handleToggleDay(day)}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                      selectedDays.includes(day)
                        ? 'bg-amber-600 text-white shadow'
                        : 'bg-slate-900 text-slate-500 border border-slate-800 hover:text-slate-300'
                    }`}
                  >
                    {selectedDays.includes(day) && <Check className="w-3.5 h-3.5" />}
                    <span>{day}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Smart Automation Options Checklist */}
          <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-4 space-y-3">
            <span className="text-xs font-bold text-white flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>Validasi Otomatis & Proteksi Operasional:</span>
            </span>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <label className="flex items-start gap-2.5 p-2.5 rounded-lg bg-slate-900/80 border border-slate-800 cursor-pointer hover:bg-slate-900">
                <input
                  type="checkbox"
                  checked={enforce24hGap}
                  onChange={(e) => setEnforce24hGap(e.target.checked)}
                  className="mt-0.5 rounded text-emerald-600 focus:ring-0 cursor-pointer"
                />
                <div>
                  <span className="font-bold text-white">Validasi Jeda 24 Jam Antar-Hari (Anti-Bentrok)</span>
                  <p className="text-[11px] text-slate-400">
                    Otomatis merotasi supir agar rute luar kota hari H tidak bentrok dengan hari H+1.
                  </p>
                </div>
              </label>

              <label className="flex items-start gap-2.5 p-2.5 rounded-lg bg-slate-900/80 border border-slate-800 cursor-pointer hover:bg-slate-900">
                <input
                  type="checkbox"
                  checked={autoAssignFerry}
                  onChange={(e) => setAutoAssignFerry(e.target.checked)}
                  className="mt-0.5 rounded text-indigo-600 focus:ring-0 cursor-pointer"
                />
                <div>
                  <span className="font-bold text-white">Auto-Generate Booking Kapal ASDP (Bali)</span>
                  <p className="text-[11px] text-slate-400">
                    Menyertakan kode booking tiket penyeberangan Ketapang - Gilimanuk untuk rute Bali.
                  </p>
                </div>
              </label>

              <label className="flex items-start gap-2.5 p-2.5 rounded-lg bg-slate-900/80 border border-slate-800 cursor-pointer hover:bg-slate-900 sm:col-span-2">
                <input
                  type="checkbox"
                  checked={overwriteExisting}
                  onChange={(e) => setOverwriteExisting(e.target.checked)}
                  className="mt-0.5 rounded text-blue-600 focus:ring-0 cursor-pointer"
                />
                <div>
                  <span className="font-bold text-white">Sinkronisasi & Perbarui Jadwal yang Sudah Ada (Overwrite)</span>
                  <p className="text-[11px] text-slate-400">
                    Jika tidak dicentang, sistem hanya akan menambahkan rute yang belum pernah dibuat pada minggu target.
                  </p>
                </div>
              </label>

              <label className="flex items-start gap-2.5 p-2.5 rounded-lg bg-rose-950/30 border border-rose-500/30 cursor-pointer hover:bg-rose-950/50 sm:col-span-2">
                <input
                  type="checkbox"
                  checked={isUrgentOverride}
                  onChange={(e) => setIsUrgentOverride(e.target.checked)}
                  className="mt-0.5 rounded text-rose-600 focus:ring-0 cursor-pointer"
                />
                <div>
                  <span className="font-bold text-rose-300">🚨 Mode Urgent: Izinkan Kru Lokal Dikirim ke Luar Kota (Bypass Larangan Luar Kota)</span>
                  <p className="text-[11px] text-slate-400">
                    Jika diaktifkan, kru yang dibatasi khusus area Banyuwangi (lokal) akan diizinkan menerima penugasan luar kota dalam kondisi mendesak/darurat.
                  </p>
                </div>
              </label>
            </div>
          </div>

          {/* Cross-Day Validation Indicator & Summary KPI */}
          <div className="border border-slate-800 rounded-xl p-4 bg-slate-950/80 space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-white">Status Validasi Lintas Hari (Cross-Day Safety):</span>
                <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold border flex items-center gap-1.5 ${
                  validationSimulation.isClean
                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                    : 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                }`}>
                  <span className={`w-2 h-2 rounded-full ${validationSimulation.isClean ? 'bg-emerald-400' : 'bg-rose-400'}`} />
                  {validationSimulation.isClean ? '✅ 100% AMAN (Bebas Bentrok H+1)' : `⚠️ ${validationSimulation.conflicts.length} Potensi Bentrok`}
                </span>
              </div>

              <div className="flex items-center gap-3 text-xs text-slate-400">
                <span>Total Rute: <strong className="text-white">{plannedRoutes.length}</strong></span>
                <span>•</span>
                <span className="text-indigo-400 font-bold">{outboundCount} Luar Kota</span>
                <span>•</span>
                <span className="text-purple-400 font-bold">{localCount} Lokal</span>
              </div>
            </div>

            {/* Daily Matrix Preview */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 pt-1">
              {(['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'] as DayName[]).map(day => {
                const info = validationSimulation.dayBreakdown[day];
                const isDayIncluded = plannedRoutes.some(r => r.dayName === day);

                return (
                  <div
                    key={day}
                    className={`p-2.5 rounded-lg border text-center ${
                      isDayIncluded
                        ? 'bg-slate-900/90 border-slate-800 text-white'
                        : 'bg-slate-950/30 border-slate-900 text-slate-600 opacity-60'
                    }`}
                  >
                    <div className="font-bold text-xs">{day}</div>
                    <div className="text-lg font-black text-emerald-400 my-0.5">{info.total}</div>
                    <div className="text-[10px] text-slate-400 flex items-center justify-center gap-1 font-mono">
                      <span className="text-indigo-300">{info.outbound} LK</span>
                      <span>/</span>
                      <span className="text-purple-300">{info.local} Lkl</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-4 sm:p-5 bg-slate-950 border-t border-slate-800 flex items-center justify-between gap-3 shrink-0">
          <div className="text-[11px] text-slate-400 hidden sm:block">
            Target: <strong className="text-slate-200">{plannedRoutes.length} Rute Terstruktur</strong> dengan standar jeda istirahat supir ≥ 24 jam.
          </div>

          <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition cursor-pointer"
            >
              Batal
            </button>

            <button
              type="button"
              onClick={handleExecuteSmartFill}
              disabled={isProcessing || plannedRoutes.length === 0}
              className="px-5 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-bold shadow-lg shadow-emerald-600/30 transition cursor-pointer flex items-center gap-2 disabled:opacity-50 ring-2 ring-emerald-400/40"
            >
              {isProcessing ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Memproses Smart Fill...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 text-emerald-200" />
                  <span>⚡ Jalankan Smart Fill ({plannedRoutes.length} Rute)</span>
                </>
              )}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
};
