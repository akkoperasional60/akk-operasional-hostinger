import React, { useState, useMemo } from 'react';
import {
  FileSpreadsheet,
  Download,
  Calendar,
  Truck,
  Printer,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  MapPin,
  X,
  RotateCcw
} from 'lucide-react';
import { FuelLog } from '../types';
import {
  computeFleetRangeSummaries,
  exportFuelReportToExcel,
  exportFuelReportToPDF,
  formatRupiah
} from '../utils/fuelReportGenerator';

interface FuelWeeklyReportViewProps {
  fuelLogs: FuelLog[];
  onOpenExportModal?: () => void;
}

const MONTH_OPTIONS = [
  { value: 'all', label: 'Semua Bulan' },
  { value: '01', label: 'Januari' },
  { value: '02', label: 'Februari' },
  { value: '03', label: 'Maret' },
  { value: '04', label: 'April' },
  { value: '05', label: 'Mei' },
  { value: '06', label: 'Juni' },
  { value: '07', label: 'Juli' },
  { value: '08', label: 'Agustus' },
  { value: '09', label: 'September' },
  { value: '10', label: 'Oktober' },
  { value: '11', label: 'November' },
  { value: '12', label: 'Desember' }
];

const MONTHS_SHORT_ID = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
const MONTHS_FULL_ID = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

const normalizeLogIsoDate = (raw?: string): string => {
  if (!raw) return '';
  return raw.includes('T') ? raw.split('T')[0] : raw.slice(0, 10);
};

const formatDisplayDate = (iso: string): string => {
  if (!iso || iso.length < 10) return iso;
  const [y, m, d] = iso.split('-').map(Number);
  if (!y || !m || !d) return iso;
  return `${d} ${MONTHS_SHORT_ID[m - 1] || ''} ${y}`;
};

export const FuelWeeklyReportView: React.FC<FuelWeeklyReportViewProps> = ({
  fuelLogs
}) => {
  const [selectedMonth, setSelectedMonth] = useState<string>('all');
  const [selectedYear, setSelectedYear] = useState<string>('all');
  const [rangeStart, setRangeStart] = useState<string>('');
  const [rangeEnd, setRangeEnd] = useState<string>('');
  const [isCalendarOpen, setIsCalendarOpen] = useState<boolean>(false);
  const [calendarMonthDate, setCalendarMonthDate] = useState<Date>(() => {
    const latestDate = fuelLogs
      .map(l => normalizeLogIsoDate(l.date))
      .filter(Boolean)
      .sort((a, b) => b.localeCompare(a))[0];
    if (latestDate) {
      const [y, m] = latestDate.split('-').map(Number);
      if (y && m) return new Date(y, m - 1, 1);
    }
    return new Date();
  });
  const [selectedSpbu, setSelectedSpbu] = useState<'all' | 'Farly' | 'Gajah Mada' | 'SPBU Lain'>('all');
  const [isExporting, setIsExporting] = useState<boolean>(false);

  // Extract distinct years present in logs merged with current/surrounding operational years
  const availableYears = useMemo(() => {
    const set = new Set<string>(['2025', '2026', String(new Date().getFullYear())]);
    fuelLogs.forEach(l => {
      const iso = normalizeLogIsoDate(l.date);
      if (iso.length >= 4) set.add(iso.slice(0, 4));
    });
    return Array.from(set).sort((a, b) => b.localeCompare(a));
  }, [fuelLogs]);

  // Dates with logs (for subtle indicator dots in calendar)
  const logDatesSet = useMemo(() => {
    const set = new Set<string>();
    fuelLogs.forEach(l => {
      if (selectedSpbu !== 'all') {
        const gs = (l.gasStation || '').toLowerCase();
        if (selectedSpbu === 'Farly' && !gs.includes('farly')) return;
        if (selectedSpbu === 'Gajah Mada' && !gs.includes('gajah mada')) return;
        if (selectedSpbu === 'SPBU Lain' && (gs.includes('farly') || gs.includes('gajah mada'))) return;
      }
      const iso = normalizeLogIsoDate(l.date);
      if (iso) set.add(iso);
    });
    return set;
  }, [fuelLogs, selectedSpbu]);

  // Filter logs cleanly by SPBU, Year, Month, and Custom Calendar Day Range
  const filteredLogs = useMemo(() => {
    return fuelLogs.filter(log => {
      const iso = normalizeLogIsoDate(log.date);
      if (!iso) return false;

      if (selectedSpbu !== 'all') {
        const gs = (log.gasStation || '').toLowerCase();
        if (selectedSpbu === 'Farly' && !gs.includes('farly')) return false;
        if (selectedSpbu === 'Gajah Mada' && !gs.includes('gajah mada')) return false;
        if (selectedSpbu === 'SPBU Lain' && (gs.includes('farly') || gs.includes('gajah mada'))) return false;
      }

      if (rangeStart) {
        const effectiveEnd = rangeEnd || rangeStart;
        const low = rangeStart <= effectiveEnd ? rangeStart : effectiveEnd;
        const high = rangeStart <= effectiveEnd ? effectiveEnd : rangeStart;
        if (iso < low || iso > high) return false;
      } else {
        const [y, m] = iso.split('-');
        if (selectedYear !== 'all' && y !== selectedYear) return false;
        if (selectedMonth !== 'all' && m !== selectedMonth) return false;
      }

      return true;
    });
  }, [fuelLogs, selectedSpbu, rangeStart, rangeEnd, selectedYear, selectedMonth]);

  const activePeriodLabel = useMemo(() => {
    const spbuTag = selectedSpbu !== 'all' ? ` • ${selectedSpbu}` : '';
    if (rangeStart) {
      const effectiveEnd = rangeEnd || rangeStart;
      const low = rangeStart <= effectiveEnd ? rangeStart : effectiveEnd;
      const high = rangeStart <= effectiveEnd ? effectiveEnd : rangeStart;
      if (low === high) {
        return `${formatDisplayDate(low)}${spbuTag}`;
      }
      return `${formatDisplayDate(low)} – ${formatDisplayDate(high)}${spbuTag}`;
    }
    const monthName = selectedMonth !== 'all'
      ? MONTH_OPTIONS.find(m => m.value === selectedMonth)?.label || selectedMonth
      : '';
    if (monthName && selectedYear !== 'all') return `${monthName} ${selectedYear}${spbuTag}`;
    if (monthName) return `Bulan ${monthName}${spbuTag}`;
    if (selectedYear !== 'all') return `Tahun ${selectedYear}${spbuTag}`;
    return `Seluruh Periode Terdata${spbuTag}`;
  }, [rangeStart, rangeEnd, selectedMonth, selectedYear, selectedSpbu]);

  const fleetSummaries = useMemo(
    () => computeFleetRangeSummaries(filteredLogs, activePeriodLabel, rangeStart, rangeEnd || rangeStart),
    [filteredLogs, activePeriodLabel, rangeStart, rangeEnd]
  );

  // Aggregate Metrics for Active Filter
  const activeMetrics = useMemo(() => {
    const totalLiters = Number(fleetSummaries.reduce((sum, f) => sum + f.totalLiters, 0).toFixed(1));
    const totalCost = fleetSummaries.reduce((sum, f) => sum + f.totalCost, 0);
    const totalDistance = fleetSummaries.reduce((sum, f) => sum + f.totalDistanceKm, 0);
    const totalRefuels = fleetSummaries.reduce((sum, f) => sum + f.refuelCount, 0);
    const avgKmPerLiter = totalLiters > 0 && totalDistance > 0
      ? Number((totalDistance / totalLiters).toFixed(2))
      : 0;
    const avgLiterPerKm = totalDistance > 0
      ? Number((totalLiters / totalDistance).toFixed(4))
      : 0;
    const avgCostPerKm = totalDistance > 0 ? Math.round(totalCost / totalDistance) : 0;

    return {
      totalLiters,
      totalCost,
      totalDistance,
      totalRefuels,
      avgKmPerLiter,
      avgLiterPerKm,
      avgCostPerKm
    };
  }, [fleetSummaries]);

  const handleDayClick = (iso: string) => {
    if (!rangeStart || (rangeStart && rangeEnd)) {
      setRangeStart(iso);
      setRangeEnd('');
      return;
    }
    if (iso === rangeStart) {
      setRangeEnd(iso);
    } else if (iso < rangeStart) {
      setRangeEnd(rangeStart);
      setRangeStart(iso);
    } else {
      setRangeEnd(iso);
    }
  };

  const applyMonthDropdown = (nextMonth: string) => {
    setSelectedMonth(nextMonth);
    setRangeStart('');
    setRangeEnd('');
    if (nextMonth !== 'all') {
      const targetYear = selectedYear !== 'all' ? Number(selectedYear) : calendarMonthDate.getFullYear();
      setCalendarMonthDate(new Date(targetYear, Number(nextMonth) - 1, 1));
    }
  };

  const applyYearDropdown = (nextYear: string) => {
    setSelectedYear(nextYear);
    setRangeStart('');
    setRangeEnd('');
    if (nextYear !== 'all') {
      const targetMonth = selectedMonth !== 'all' ? Number(selectedMonth) - 1 : calendarMonthDate.getMonth();
      setCalendarMonthDate(new Date(Number(nextYear), targetMonth, 1));
    }
  };

  const resetAllFilters = () => {
    setSelectedMonth('all');
    setSelectedYear('all');
    setRangeStart('');
    setRangeEnd('');
    setSelectedSpbu('all');
  };

  const hasActiveFilter = selectedMonth !== 'all' || selectedYear !== 'all' || Boolean(rangeStart) || selectedSpbu !== 'all';

  const periodSlug = rangeStart
    ? `${rangeStart}_${rangeEnd || rangeStart}`
    : `${selectedYear}_${selectedMonth}`;

  const handleExportPDF = () => {
    setIsExporting(true);
    try {
      exportFuelReportToPDF({
        fleetSummaries,
        driverSummaries: [],
        filterWeekKey: periodSlug,
        filterWeekLabel: activePeriodLabel,
        printedBy: 'Super Admin Logistik PT AKK'
      });
    } catch (err) {
      console.error(err);
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportExcel = () => {
    setIsExporting(true);
    try {
      exportFuelReportToExcel({
        fleetSummaries,
        driverSummaries: [],
        detailedLogs: filteredLogs,
        filterWeekKey: periodSlug,
        filterWeekLabel: activePeriodLabel
      });
    } catch (err) {
      console.error(err);
    } finally {
      setIsExporting(false);
    }
  };

  const calendarYear = calendarMonthDate.getFullYear();
  const calendarMonthIdx = calendarMonthDate.getMonth();
  const firstDayOffset = new Date(calendarYear, calendarMonthIdx, 1).getDay();
  const daysInCalMonth = new Date(calendarYear, calendarMonthIdx + 1, 0).getDate();
  const calendarCells: (number | null)[] = [];
  for (let i = 0; i < firstDayOffset; i++) calendarCells.push(null);
  for (let d = 1; d <= daysInCalMonth; d++) calendarCells.push(d);

  const normalizedLow = rangeStart ? (rangeEnd && rangeEnd < rangeStart ? rangeEnd : rangeStart) : '';
  const normalizedHigh = rangeStart ? (rangeEnd ? (rangeEnd > rangeStart ? rangeEnd : rangeStart) : rangeStart) : '';

  return (
    <div className="space-y-5">
      {/* SECTION HEADER & QUICK EXPORT ACTIONS */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-sm space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2.5">
              <span className="p-2 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-400">
                <FileSpreadsheet className="w-5 h-5" />
              </span>
              <div>
                <h3 className="text-base font-bold text-white">
                  Rekapitulasi Konsumsi BBM Armada
                </h3>
                <p className="text-xs text-slate-400">
                  Pilih bulan, tahun, dan rentang hari pada kalender untuk merekap konsumsi BBM serta biaya operasional tiap armada.
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleExportPDF}
              disabled={isExporting}
              className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs shadow-md transition active:scale-95 cursor-pointer disabled:opacity-50"
            >
              <Download className="w-4 h-4" />
              <span>Export PDF</span>
            </button>

            <button
              type="button"
              onClick={handleExportExcel}
              disabled={isExporting}
              className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-md transition active:scale-95 cursor-pointer disabled:opacity-50"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>Export Excel</span>
            </button>

            <button
              type="button"
              onClick={() => window.print()}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 text-xs font-semibold transition cursor-pointer"
            >
              <Printer className="w-4 h-4 text-slate-400" />
              <span>Print</span>
            </button>
          </div>
        </div>

        {/* SIMPLIFIED FILTER BAR: BULAN + TAHUN + KALENDER RENTANG HARI + SPBU */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pt-3 border-t border-slate-800/80">
          <div className="flex flex-wrap items-center gap-2.5">
            {/* 1. Dropdown Filter Bulan */}
            <div className="relative min-w-[155px]">
              <Calendar className="w-3.5 h-3.5 text-amber-400 absolute left-3 top-2.5 pointer-events-none" />
              <select
                value={selectedMonth}
                onChange={(e) => applyMonthDropdown(e.target.value)}
                aria-label="Filter Bulan"
                className="w-full pl-8 pr-7 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white font-semibold focus:outline-none focus:border-amber-500 cursor-pointer appearance-none"
              >
                {MONTH_OPTIONS.map(m => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-2.5 pointer-events-none" />
            </div>

            {/* 2. Dropdown Filter Tahun */}
            <div className="relative min-w-[130px]">
              <Calendar className="w-3.5 h-3.5 text-cyan-400 absolute left-3 top-2.5 pointer-events-none" />
              <select
                value={selectedYear}
                onChange={(e) => applyYearDropdown(e.target.value)}
                aria-label="Filter Tahun"
                className="w-full pl-8 pr-7 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white font-semibold focus:outline-none focus:border-amber-500 cursor-pointer appearance-none"
              >
                <option value="all">Semua Tahun</option>
                {availableYears.map(yr => (
                  <option key={yr} value={yr}>
                    Tahun {yr}
                  </option>
                ))}
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-2.5 pointer-events-none" />
            </div>

            {/* 3. Custom Calendar & Date Range Picker */}
            <div className="relative">
              <div className="flex items-center">
                <button
                  type="button"
                  onClick={() => setIsCalendarOpen(prev => !prev)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-xs font-semibold transition cursor-pointer ${
                    rangeStart
                      ? 'bg-amber-500/15 border-amber-500/60 text-amber-300'
                      : 'bg-slate-950 border-slate-800 text-slate-200 hover:border-amber-500/50'
                  }`}
                >
                  <Calendar className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  <span>
                    {rangeStart
                      ? (normalizedLow === normalizedHigh
                        ? formatDisplayDate(normalizedLow)
                        : `${formatDisplayDate(normalizedLow)} – ${formatDisplayDate(normalizedHigh)}`)
                      : 'Pilih Kalender (Rentang Hari)'}
                  </span>
                  <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform ${isCalendarOpen ? 'rotate-180 text-amber-400' : ''}`} />
                </button>
                {rangeStart && (
                  <button
                    type="button"
                    onClick={() => {
                      setRangeStart('');
                      setRangeEnd('');
                    }}
                    title="Hapus rentang kalender"
                    className="ml-1 p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-rose-400 cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {isCalendarOpen && (
                <div className="absolute left-0 top-full mt-2 z-50 w-80 bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl p-3.5 space-y-3">
                  {/* Calendar Month & Year Navigation */}
                  <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                    <button
                      type="button"
                      onClick={() => setCalendarMonthDate(new Date(calendarYear, calendarMonthIdx - 1, 1))}
                      className="p-1.5 rounded-lg bg-slate-950 border border-slate-800 text-slate-300 hover:border-amber-500 cursor-pointer"
                      aria-label="Bulan sebelumnya"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <div className="text-xs font-black text-white">
                      {MONTHS_FULL_ID[calendarMonthIdx]} {calendarYear}
                    </div>
                    <button
                      type="button"
                      onClick={() => setCalendarMonthDate(new Date(calendarYear, calendarMonthIdx + 1, 1))}
                      className="p-1.5 rounded-lg bg-slate-950 border border-slate-800 text-slate-300 hover:border-amber-500 cursor-pointer"
                      aria-label="Bulan berikutnya"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Helper Text */}
                  <div className="text-[10px] text-slate-400 bg-slate-950 px-2.5 py-1.5 rounded-lg border border-slate-800 flex items-center justify-between">
                    <span>
                      {!rangeStart
                        ? 'Klik tanggal awal, lalu klik tanggal akhir'
                        : !rangeEnd
                        ? `Awal: ${formatDisplayDate(rangeStart)} • Pilih tanggal akhir`
                        : `${formatDisplayDate(normalizedLow)} – ${formatDisplayDate(normalizedHigh)}`}
                    </span>
                    <span className="inline-flex items-center gap-1 text-emerald-400 font-semibold">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block" /> Ada BBM
                    </span>
                  </div>

                  {/* Weekday Headers */}
                  <div className="grid grid-cols-7 gap-1 text-center">
                    {['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'].map(d => (
                      <div key={d} className="text-[10px] font-bold text-slate-500 py-0.5">
                        {d}
                      </div>
                    ))}
                  </div>

                  {/* Calendar Grid */}
                  <div className="grid grid-cols-7 gap-1">
                    {calendarCells.map((day, idx) => {
                      if (day === null) return <div key={`empty-${idx}`} className="h-8" />;
                      const iso = `${calendarYear}-${String(calendarMonthIdx + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                      const isStart = normalizedLow === iso;
                      const isEnd = normalizedHigh === iso;
                      const inRange = Boolean(normalizedLow && normalizedHigh && iso >= normalizedLow && iso <= normalizedHigh);
                      const hasLogs = logDatesSet.has(iso);

                      return (
                        <button
                          key={iso}
                          type="button"
                          onClick={() => handleDayClick(iso)}
                          className={`relative h-8 rounded-lg text-[11px] font-mono font-bold flex flex-col items-center justify-center transition cursor-pointer ${
                            isStart || isEnd
                              ? 'bg-amber-500 text-slate-950 shadow-sm'
                              : inRange
                              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                              : 'text-slate-200 hover:bg-amber-500/10'
                          }`}
                        >
                          <span>{day}</span>
                          {hasLogs && (
                            <span
                              className={`w-1 h-1 rounded-full absolute bottom-0.5 ${
                                isStart || isEnd ? 'bg-slate-950' : 'bg-emerald-400'
                              }`}
                            />
                          )}
                        </button>
                      );
                    })}
                  </div>

                  {/* Quick Footer Actions */}
                  <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-800">
                    <button
                      type="button"
                      onClick={() => {
                        setRangeStart('');
                        setRangeEnd('');
                      }}
                      className="px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-[11px] font-semibold text-slate-300 hover:border-slate-600 cursor-pointer"
                    >
                      Reset Hari
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsCalendarOpen(false)}
                      className="px-3.5 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 text-[11px] font-bold cursor-pointer"
                    >
                      Terapkan
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* 4. Filter SPBU */}
            <div className="relative min-w-[155px]">
              <MapPin className="w-3.5 h-3.5 text-blue-400 absolute left-3 top-2.5 pointer-events-none" />
              <select
                value={selectedSpbu}
                onChange={(e) => setSelectedSpbu(e.target.value as any)}
                aria-label="Filter SPBU"
                className="w-full pl-8 pr-7 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white font-semibold focus:outline-none focus:border-amber-500 cursor-pointer appearance-none"
              >
                <option value="all">Semua SPBU</option>
                <option value="Farly">SPBU Farly</option>
                <option value="Gajah Mada">SPBU Gajah Mada</option>
                <option value="SPBU Lain">SPBU Lain (Urgent)</option>
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-2.5 pointer-events-none" />
            </div>

            {hasActiveFilter && (
              <button
                type="button"
                onClick={resetAllFilters}
                className="flex items-center gap-1 px-2.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 text-xs font-semibold transition cursor-pointer"
                title="Reset semua filter"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reset</span>
              </button>
            )}
          </div>

          <div className="text-xs text-slate-400 font-medium shrink-0">
            Periode: <span className="font-bold text-amber-400">{activePeriodLabel}</span>
          </div>
        </div>

        {/* 5 FLEET SUMMARY KPI CARDS */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5 pt-2">
          <div className="bg-slate-950/70 p-3 rounded-xl border border-slate-800">
            <span className="text-[10px] text-slate-400 block font-semibold">Total Konsumsi</span>
            <span className="text-lg font-black text-white font-mono">{activeMetrics.totalLiters.toLocaleString('id-ID')} L</span>
            <span className="text-[10px] text-slate-500 block">{activeMetrics.totalRefuels}x isi BBM</span>
          </div>

          <div className="bg-slate-950/70 p-3 rounded-xl border border-slate-800">
            <span className="text-[10px] text-slate-400 block font-semibold">Total Biaya Operasional</span>
            <span className="text-lg font-black text-emerald-400 font-mono">{formatRupiah(activeMetrics.totalCost)}</span>
            <span className="text-[10px] text-slate-500 block">Rp {activeMetrics.avgCostPerKm.toLocaleString('id-ID')}/KM</span>
          </div>

          <div className="bg-slate-950/70 p-3 rounded-xl border border-slate-800">
            <span className="text-[10px] text-slate-400 block font-semibold">Jarak Tempuh Total</span>
            <span className="text-lg font-black text-cyan-400 font-mono">{activeMetrics.totalDistance.toLocaleString('id-ID')} KM</span>
            <span className="text-[10px] text-slate-500 block">Akumulasi ritase</span>
          </div>

          <div className="bg-slate-950/70 p-3 rounded-xl border border-slate-800">
            <span className="text-[10px] text-slate-400 block font-semibold">Rerata Rasio Armada</span>
            <span className="text-lg font-black text-amber-400 font-mono">{activeMetrics.avgKmPerLiter} KM/L</span>
            <span className="text-[10px] text-slate-500 block">Target: 7.5 KM/L</span>
          </div>

          <div className="bg-slate-950/70 p-3 rounded-xl border border-slate-800">
            <span className="text-[10px] text-slate-400 block font-semibold">Konsumsi Liter / KM</span>
            <span className="text-lg font-black text-white font-mono">{activeMetrics.avgLiterPerKm}</span>
            <span className="text-[10px] text-slate-500 block">{(activeMetrics.avgLiterPerKm * 100).toFixed(2)} L/100KM</span>
          </div>
        </div>
      </div>

      {/* TABLE: REKAPITULASI PER ARMADA */}
      <div className="overflow-x-auto bg-slate-900 border border-slate-800 rounded-2xl shadow-sm">
        <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs font-bold text-white">
            <Truck className="w-4 h-4 text-amber-400" />
            <span>Rekapitulasi Per Armada ({fleetSummaries.length} Unit)</span>
          </div>
          <span className="text-[11px] text-slate-400">
            Menampilkan {filteredLogs.length} transaksi BBM
          </span>
        </div>

        <table className="w-full text-left text-xs text-slate-300">
          <thead className="bg-slate-950 text-[11px] uppercase tracking-wider text-slate-400 font-bold border-b border-slate-800 whitespace-nowrap">
            <tr>
              <th className="py-2 px-2.5">No</th>
              <th className="py-2 px-2.5">Armada &amp; Plat</th>
              <th className="py-2 px-2.5">Tipe Kendaraan</th>
              <th className="py-2 px-2.5 text-right">Isi</th>
              <th className="py-2 px-2.5 text-right">Total Liter</th>
              <th className="py-2 px-2.5 text-right">Jarak (KM)</th>
              <th className="py-2 px-2.5 text-right">Biaya BBM (Rp)</th>
              <th className="py-2 px-2.5 text-right">Rasio (KM/L)</th>
              <th className="py-2 px-2.5 text-right">Liter / KM</th>
              <th className="py-2 px-2.5 text-right">Target</th>
              <th className="py-2 px-2.5 text-center">Status Evaluasi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60 font-mono">
            {fleetSummaries.length === 0 ? (
              <tr>
                <td colSpan={11} className="py-10 text-center text-slate-500 font-sans text-sm">
                  Tidak ada data konsumsi BBM armada untuk periode yang dipilih.
                </td>
              </tr>
            ) : (
              fleetSummaries.map((f, i) => (
                <tr key={f.id} className="hover:bg-slate-800/40 transition">
                  <td className="py-1.5 px-2.5 text-slate-400 font-sans text-xs whitespace-nowrap">{i + 1}</td>
                  <td className="py-1.5 px-2.5 whitespace-nowrap">
                    <div className="flex items-baseline gap-1.5 leading-tight">
                      <Truck className="w-3.5 h-3.5 text-blue-400 shrink-0 self-center" />
                      <span className="font-extrabold text-white text-sm font-sans">{f.initialCode || f.plateNumber}</span>
                      <span className="text-xs text-slate-400 font-medium">({f.plateNumber})</span>
                    </div>
                  </td>
                  <td className="py-1.5 px-2.5 font-sans text-slate-300 text-xs font-medium whitespace-nowrap">{f.vehicleType}</td>
                  <td className="py-1.5 px-2.5 text-right text-slate-200 text-sm font-semibold whitespace-nowrap">{f.refuelCount}x</td>
                  <td className="py-1.5 px-2.5 text-right font-bold text-white text-sm whitespace-nowrap">{f.totalLiters} L</td>
                  <td className="py-1.5 px-2.5 text-right text-cyan-300 font-bold text-sm whitespace-nowrap">{f.totalDistanceKm.toLocaleString('id-ID')}</td>
                  <td className="py-1.5 px-2.5 text-right text-emerald-400 font-bold text-sm whitespace-nowrap">{formatRupiah(f.totalCost)}</td>
                  <td className="py-1.5 px-2.5 text-right font-black text-amber-400 text-base whitespace-nowrap">{f.avgKmPerLiter}</td>
                  <td className="py-1.5 px-2.5 text-right text-slate-200 whitespace-nowrap leading-tight">
                    <div className="text-sm font-bold">{f.avgLiterPerKm}</div>
                    <div className="text-[11px] text-slate-500">({f.avgLiterPer100Km} L/100KM)</div>
                  </td>
                  <td className="py-1.5 px-2.5 text-right text-slate-400 text-xs font-semibold whitespace-nowrap">{f.targetRatio}</td>
                  <td className="py-1.5 px-2.5 font-sans text-center whitespace-nowrap">
                    <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold border inline-block text-center ${
                      f.status === 'Sangat Efisien'
                        ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                        : f.status === 'Efisien / Normal'
                        ? 'bg-blue-500/15 text-blue-400 border-blue-500/30'
                        : f.status === 'Boros'
                        ? 'bg-amber-500/15 text-amber-400 border-amber-500/30'
                        : 'bg-rose-500/15 text-rose-400 border-rose-500/30'
                    }`}>
                      {f.status}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
