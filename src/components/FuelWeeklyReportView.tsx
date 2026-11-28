import React, { useState, useMemo } from 'react';
import {
  FileSpreadsheet,
  Download,
  Calendar,
  Printer,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  MapPin,
  X,
  RotateCcw,
  ArrowUpDown
} from 'lucide-react';
import { EfficiencyStatus, FuelLog } from '../types';
import {
  computeFleetRangeSummaries,
  exportFuelReportToExcel,
  exportFuelReportToPDF,
  formatRupiah,
  WeeklyFleetFuelSummary
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
  const [sortOrder, setSortOrder] = useState<'efficient_first' | 'wasteful_first' | 'unit_asc' | 'distance_desc'>('efficient_first');
  const [statusFilter, setStatusFilter] = useState<'all' | EfficiencyStatus>('all');
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [exportError, setExportError] = useState<string>('');

  const availableYears = useMemo(() => {
    const set = new Set<string>(['2025', '2026', String(new Date().getFullYear())]);
    fuelLogs.forEach(l => {
      const iso = normalizeLogIsoDate(l.date);
      if (iso.length >= 4) set.add(iso.slice(0, 4));
    });
    return Array.from(set).sort((a, b) => b.localeCompare(a));
  }, [fuelLogs]);

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
    const spbuTag = selectedSpbu !== 'all' ? ` · ${selectedSpbu}` : '';
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

  const normalizePlate = (raw?: string) => String(raw || '').replace(/\s+/g, '').toUpperCase();

  const buildEfficiencyReason = useMemo(() => {
    const logsByPlate = new Map<string, FuelLog[]>();
    filteredLogs.forEach(l => {
      const key = normalizePlate(l.plateNumber) || l.fleetId;
      const existing = logsByPlate.get(key) || [];
      existing.push(l);
      logsByPlate.set(key, existing);
    });

    const map: Record<string, string> = {};
    fleetSummaries.forEach(f => {
      if (f.refuelCount === 0 || f.totalDistanceKm <= 0 || f.avgKmPerLiter <= 0) {
        map[f.id] = 'Belum ada data jarak & pengisian BBM pada periode ini.';
        return;
      }

      const key = normalizePlate(f.plateNumber) || f.fleetId;
      const unitLogs = logsByPlate.get(key) || [];
      const routeCounts = new Map<string, number>();
      unitLogs.forEach(l => {
        const rt = (l.routeTrip || '').trim();
        if (rt && rt !== '-') routeCounts.set(rt, (routeCounts.get(rt) || 0) + 1);
      });
      const topRoutes = Array.from(routeCounts.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 2)
        .map(([r]) => r);
      const routeContext = topRoutes.length > 0 ? ` Rute dominan: ${topRoutes.join(', ')}.` : '';

      const diffPct = Math.abs(f.variancePercent);
      const avgTripKm = Math.round(f.totalDistanceKm / Math.max(1, f.refuelCount));

      if (f.status === 'Sangat Efisien') {
        map[f.id] = `${f.avgKmPerLiter} KM/L (+${diffPct}% di atas target ${f.targetRatio} KM/L, rata-rata ${avgTripKm} KM/isi). Tarikan stabil & rute lancar.${routeContext}`;
      } else if (f.status === 'Efisien / Normal') {
        const sign = f.variancePercent >= 0 ? '+' : '';
        map[f.id] = `${f.avgKmPerLiter} KM/L (${sign}${f.variancePercent}% vs target ${f.targetRatio} KM/L). Konsumsi wajar sesuai standar pabrikan.${routeContext}`;
      } else if (f.status === 'Boros') {
        map[f.id] = `${f.avgKmPerLiter} KM/L (${diffPct}% di bawah target ${f.targetRatio} KM/L). Terindikasi rute padat/antre, muatan berat, atau idling mesin tinggi.${routeContext}`;
      } else {
        map[f.id] = `${f.avgKmPerLiter} KM/L (${diffPct}% jauh di bawah target ${f.targetRatio} KM/L). Perlu cek filter solar, injektor, atau akurasi KM odometer.${routeContext}`;
      }
    });
    return map;
  }, [fleetSummaries, filteredLogs]);

  const displayedFleetSummaries = useMemo(() => {
    const filtered = statusFilter === 'all'
      ? [...fleetSummaries]
      : fleetSummaries.filter(f => f.status === statusFilter);

    const hasValidRatio = (f: WeeklyFleetFuelSummary) => f.refuelCount > 0 && f.totalDistanceKm > 0 && f.avgKmPerLiter > 0;

    return filtered.sort((a, b) => {
      if (sortOrder === 'unit_asc') {
        return (a.initialCode || a.plateNumber).localeCompare(b.initialCode || b.plateNumber);
      }
      if (sortOrder === 'distance_desc') {
        return b.totalDistanceKm - a.totalDistanceKm;
      }

      const aValid = hasValidRatio(a);
      const bValid = hasValidRatio(b);
      if (aValid !== bValid) return aValid ? -1 : 1;

      if (sortOrder === 'efficient_first') {
        // Higher positive variance vs target & lower L/KM ratio first
        if (b.variancePercent !== a.variancePercent) {
          return b.variancePercent - a.variancePercent;
        }
        return a.avgLiterPerKm - b.avgLiterPerKm;
      }

      // wasteful_first: most negative variance & highest L/KM first
      if (a.variancePercent !== b.variancePercent) {
        return a.variancePercent - b.variancePercent;
      }
      return b.avgLiterPerKm - a.avgLiterPerKm;
    });
  }, [fleetSummaries, statusFilter, sortOrder]);

  const activeMetrics = useMemo(() => {
    const totalLiters = Number(displayedFleetSummaries.reduce((sum, f) => sum + f.totalLiters, 0).toFixed(2));
    const totalCost = displayedFleetSummaries.reduce((sum, f) => sum + f.totalCost, 0);
    const totalDistance = displayedFleetSummaries.reduce((sum, f) => sum + f.totalDistanceKm, 0);
    const totalRefuels = displayedFleetSummaries.reduce((sum, f) => sum + f.refuelCount, 0);
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
  }, [displayedFleetSummaries]);

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
    setStatusFilter('all');
    setSortOrder('efficient_first');
  };

  const hasActiveFilter =
    selectedMonth !== 'all' ||
    selectedYear !== 'all' ||
    Boolean(rangeStart) ||
    selectedSpbu !== 'all' ||
    statusFilter !== 'all' ||
    sortOrder !== 'efficient_first';

  const periodSlug = rangeStart
    ? `${rangeStart}_${rangeEnd || rangeStart}`
    : `${selectedYear}_${selectedMonth}`;

  const handleExportPDF = () => {
    setIsExporting(true);
    setExportError('');
    try {
      exportFuelReportToPDF({
        fleetSummaries: displayedFleetSummaries,
        driverSummaries: [],
        filterWeekKey: periodSlug,
        filterWeekLabel: activePeriodLabel,
        printedBy: 'Super Admin Logistik PT AKK'
      });
    } catch (err) {
      console.error(err);
      setExportError('Gagal membuat file PDF. Pastikan data periode terisi.');
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportExcel = () => {
    setIsExporting(true);
    setExportError('');
    try {
      exportFuelReportToExcel({
        fleetSummaries: displayedFleetSummaries,
        driverSummaries: [],
        detailedLogs: filteredLogs,
        efficiencyNotesByFleetId: buildEfficiencyReason,
        filterWeekKey: periodSlug,
        filterWeekLabel: activePeriodLabel
      });
    } catch (err) {
      console.error(err);
      setExportError('Gagal membuat file Excel.');
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
    <div className="akk-flat-fuel space-y-5">
      {/* HEADER & FILTER */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <h3 className="text-lg font-bold text-slate-900">
              Rekapitulasi BBM Armada
            </h3>
            <p className="text-sm text-slate-500 mt-0.5">
              Urutkan unit dari paling efisien ke boros beserta alasan kondisi konsumsi BBM per periode.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handleExportPDF}
              disabled={isExporting}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-semibold text-xs transition cursor-pointer disabled:opacity-50 whitespace-nowrap"
            >
              <Download className="w-4 h-4 text-slate-500" />
              <span>Export PDF</span>
            </button>

            <button
              type="button"
              onClick={handleExportExcel}
              disabled={isExporting}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs transition cursor-pointer disabled:opacity-50 whitespace-nowrap"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>Export Excel</span>
            </button>

            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold transition cursor-pointer whitespace-nowrap"
            >
              <Printer className="w-4 h-4 text-slate-500" />
              <span>Print</span>
            </button>
          </div>
        </div>

        {exportError && (
          <div className="px-3.5 py-2 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs font-medium flex items-center justify-between">
            <span>{exportError}</span>
            <button type="button" onClick={() => setExportError('')} className="text-red-500 hover:text-red-700 cursor-pointer">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* FILTER CONTROLS */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pt-4 border-t border-slate-100">
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="relative min-w-[155px]">
              <Calendar className="w-4 h-4 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
              <select
                value={selectedMonth}
                onChange={(e) => applyMonthDropdown(e.target.value)}
                aria-label="Filter Bulan"
                className="w-full pl-9 pr-8 py-2 rounded-lg bg-white border border-slate-200 text-sm text-slate-800 font-medium focus:outline-none focus:border-blue-600 cursor-pointer appearance-none"
              >
                {MONTH_OPTIONS.map(m => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </select>
              <ChevronDown className="w-4 h-4 text-slate-400 absolute right-2.5 top-2.5 pointer-events-none" />
            </div>

            <div className="relative min-w-[140px]">
              <Calendar className="w-4 h-4 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
              <select
                value={selectedYear}
                onChange={(e) => applyYearDropdown(e.target.value)}
                aria-label="Filter Tahun"
                className="w-full pl-9 pr-8 py-2 rounded-lg bg-white border border-slate-200 text-sm text-slate-800 font-medium focus:outline-none focus:border-blue-600 cursor-pointer appearance-none"
              >
                <option value="all">Semua Tahun</option>
                {availableYears.map(yr => (
                  <option key={yr} value={yr}>
                    Tahun {yr}
                  </option>
                ))}
              </select>
              <ChevronDown className="w-4 h-4 text-slate-400 absolute right-2.5 top-2.5 pointer-events-none" />
            </div>

            <div className="relative">
              <div className="flex items-center">
                <button
                  type="button"
                  onClick={() => setIsCalendarOpen(prev => !prev)}
                  className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg border text-sm font-medium transition cursor-pointer ${
                    rangeStart
                      ? 'bg-blue-50 border-blue-200 text-blue-700'
                      : 'bg-white border-slate-200 text-slate-700 hover:border-slate-300'
                  }`}
                >
                  <Calendar className="w-4 h-4 text-slate-400 shrink-0" />
                  <span>
                    {rangeStart
                      ? (normalizedLow === normalizedHigh
                        ? formatDisplayDate(normalizedLow)
                        : `${formatDisplayDate(normalizedLow)} – ${formatDisplayDate(normalizedHigh)}`)
                      : 'Rentang Tanggal'}
                  </span>
                  <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${isCalendarOpen ? 'rotate-180 text-blue-600' : ''}`} />
                </button>
                {rangeStart && (
                  <button
                    type="button"
                    onClick={() => {
                      setRangeStart('');
                      setRangeEnd('');
                    }}
                    title="Hapus rentang kalender"
                    className="ml-1 p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-500 cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {isCalendarOpen && (
                <div className="absolute left-0 top-full mt-2 z-50 w-80 bg-white border border-slate-200 rounded-xl p-3.5 space-y-3">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                    <button
                      type="button"
                      onClick={() => setCalendarMonthDate(new Date(calendarYear, calendarMonthIdx - 1, 1))}
                      className="p-1.5 rounded-lg bg-slate-50 border border-slate-200 text-slate-600 hover:border-blue-600 cursor-pointer"
                      aria-label="Bulan sebelumnya"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <div className="text-sm font-bold text-slate-900">
                      {MONTHS_FULL_ID[calendarMonthIdx]} {calendarYear}
                    </div>
                    <button
                      type="button"
                      onClick={() => setCalendarMonthDate(new Date(calendarYear, calendarMonthIdx + 1, 1))}
                      className="p-1.5 rounded-lg bg-slate-50 border border-slate-200 text-slate-600 hover:border-blue-600 cursor-pointer"
                      aria-label="Bulan berikutnya"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="text-xs text-slate-600 bg-slate-50 px-2.5 py-1.5 rounded-lg border border-slate-200 flex items-center justify-between">
                    <span>
                      {!rangeStart
                        ? 'Klik tanggal awal & akhir'
                        : !rangeEnd
                        ? `Awal: ${formatDisplayDate(rangeStart)}`
                        : `${formatDisplayDate(normalizedLow)} – ${formatDisplayDate(normalizedHigh)}`}
                    </span>
                    <span className="text-emerald-700 font-semibold">Bertanda = Ada BBM</span>
                  </div>

                  <div className="grid grid-cols-7 gap-1 text-center">
                    {['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'].map(d => (
                      <div key={d} className="text-[11px] font-semibold text-slate-500 py-0.5">
                        {d}
                      </div>
                    ))}
                  </div>

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
                          className={`relative h-8 rounded-lg text-xs font-mono font-semibold flex flex-col items-center justify-center transition cursor-pointer ${
                            isStart || isEnd
                              ? 'bg-blue-600 text-white'
                              : inRange
                              ? 'bg-blue-50 text-blue-700 border border-blue-200'
                              : hasLogs
                              ? 'text-slate-900 bg-emerald-50/70 hover:bg-blue-50'
                              : 'text-slate-700 hover:bg-slate-100'
                          }`}
                        >
                          <span>{day}</span>
                        </button>
                      );
                    })}
                  </div>

                  <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={() => {
                        setRangeStart('');
                        setRangeEnd('');
                      }}
                      className="px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50 cursor-pointer"
                    >
                      Reset
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsCalendarOpen(false)}
                      className="px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold cursor-pointer"
                    >
                      Terapkan
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div className="relative min-w-[160px]">
              <MapPin className="w-4 h-4 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
              <select
                value={selectedSpbu}
                onChange={(e) => setSelectedSpbu(e.target.value as 'all' | 'Farly' | 'Gajah Mada' | 'SPBU Lain')}
                aria-label="Filter SPBU"
                className="w-full pl-9 pr-8 py-2 rounded-lg bg-white border border-slate-200 text-sm text-slate-800 font-medium focus:outline-none focus:border-blue-600 cursor-pointer appearance-none"
              >
                <option value="all">Semua SPBU</option>
                <option value="Farly">SPBU Farly</option>
                <option value="Gajah Mada">SPBU Gajah Mada</option>
                <option value="SPBU Lain">SPBU Lain (Urgent)</option>
              </select>
              <ChevronDown className="w-4 h-4 text-slate-400 absolute right-2.5 top-2.5 pointer-events-none" />
            </div>

            <div className="relative min-w-[185px]">
              <ArrowUpDown className="w-4 h-4 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
              <select
                value={sortOrder}
                onChange={(e) => setSortOrder(e.target.value as typeof sortOrder)}
                aria-label="Urutkan Efisiensi"
                className="w-full pl-9 pr-8 py-2 rounded-lg bg-white border border-slate-200 text-sm text-slate-800 font-medium focus:outline-none focus:border-blue-600 cursor-pointer appearance-none"
              >
                <option value="efficient_first">Terefisien ke Boros</option>
                <option value="wasteful_first">Boros ke Terefisien</option>
                <option value="distance_desc">Jarak Tempuh Terjauh</option>
                <option value="unit_asc">Urutan Kode Armada</option>
              </select>
              <ChevronDown className="w-4 h-4 text-slate-400 absolute right-2.5 top-2.5 pointer-events-none" />
            </div>

            <div className="relative min-w-[175px]">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
                aria-label="Filter Status Efisiensi"
                className="w-full pl-3.5 pr-8 py-2 rounded-lg bg-white border border-slate-200 text-sm text-slate-800 font-medium focus:outline-none focus:border-blue-600 cursor-pointer appearance-none"
              >
                <option value="all">Semua Status Efisiensi</option>
                <option value="Sangat Efisien">Sangat Efisien</option>
                <option value="Efisien / Normal">Efisien / Normal</option>
                <option value="Boros">Boros</option>
                <option value="Kritis / Potensi Anomali">Kritis / Anomali</option>
              </select>
              <ChevronDown className="w-4 h-4 text-slate-400 absolute right-2.5 top-2.5 pointer-events-none" />
            </div>

            {hasActiveFilter && (
              <button
                type="button"
                onClick={resetAllFilters}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reset</span>
              </button>
            )}
          </div>

          <div className="text-xs text-slate-500 font-medium shrink-0">
            Periode: <span className="font-semibold text-slate-900">{activePeriodLabel}</span>
          </div>
        </div>

        {/* 5 SUMMARY STRIPS */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 pt-2">
          <div className="p-3.5 rounded-lg border border-slate-200 bg-white">
            <span className="text-xs text-slate-500 block font-medium">Total Konsumsi</span>
            <span className="text-xl font-bold text-slate-900 font-mono tabular-nums mt-0.5 block">
              {activeMetrics.totalLiters.toLocaleString('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} L
            </span>
            <span className="text-xs text-slate-500 block mt-0.5">{activeMetrics.totalRefuels}x pengisian</span>
          </div>

          <div className="p-3.5 rounded-lg border border-slate-200 bg-white">
            <span className="text-xs text-slate-500 block font-medium">Total Biaya BBM</span>
            <span className="text-xl font-bold text-slate-900 font-mono tabular-nums mt-0.5 block">
              {formatRupiah(activeMetrics.totalCost)}
            </span>
            <span className="text-xs text-slate-500 block mt-0.5">Rp {activeMetrics.avgCostPerKm.toLocaleString('id-ID')}/KM</span>
          </div>

          <div className="p-3.5 rounded-lg border border-slate-200 bg-white">
            <span className="text-xs text-slate-500 block font-medium">Jarak Tempuh Total</span>
            <span className="text-xl font-bold text-blue-600 font-mono tabular-nums mt-0.5 block">
              {activeMetrics.totalDistance.toLocaleString('id-ID')} KM
            </span>
            <span className="text-xs text-slate-500 block mt-0.5">Tersinkron KM driver</span>
          </div>

          <div className="p-3.5 rounded-lg border border-slate-200 bg-white">
            <span className="text-xs text-slate-500 block font-medium">Rerata Rasio</span>
            <span className="text-xl font-bold text-slate-900 font-mono tabular-nums mt-0.5 block">
              {activeMetrics.avgKmPerLiter} KM/L
            </span>
            <span className="text-xs text-slate-500 block mt-0.5">Target standar 7.5 KM/L</span>
          </div>

          <div className="p-3.5 rounded-lg border border-slate-200 bg-white">
            <span className="text-xs text-slate-500 block font-medium">Konsumsi Liter / KM</span>
            <span className="text-xl font-bold text-slate-900 font-mono tabular-nums mt-0.5 block">
              {activeMetrics.avgLiterPerKm}
            </span>
            <span className="text-xs text-slate-500 block mt-0.5">{(activeMetrics.avgLiterPerKm * 100).toFixed(2)} L/100KM</span>
          </div>
        </div>
      </div>

      {/* TABLE: REKAPITULASI BBM PER ARMADA */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2">
          <div className="text-sm font-bold text-slate-900">
            Rekapitulasi BBM Per Armada ({displayedFleetSummaries.length} Unit)
          </div>
          <span className="text-xs text-slate-500 tabular-nums">
            {sortOrder === 'efficient_first'
              ? 'Urutan: Terefisien ke Boros'
              : sortOrder === 'wasteful_first'
              ? 'Urutan: Boros ke Terefisien'
              : sortOrder === 'distance_desc'
              ? 'Urutan: Jarak Terjauh'
              : 'Urutan: Kode Armada'}{' '}
            · {filteredLogs.length} transaksi BBM
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-700">
            <thead className="bg-slate-50 text-xs font-semibold text-slate-500 border-b border-slate-200 whitespace-nowrap">
              <tr>
                <th className="py-3 px-3.5">No</th>
                <th className="py-3 px-3.5">Armada &amp; Plat</th>
                <th className="py-3 px-3.5">Tipe</th>
                <th className="py-3 px-3.5 text-right">Isi</th>
                <th className="py-3 px-3.5 text-right">Total Liter</th>
                <th className="py-3 px-3.5 text-right">Jarak (KM)</th>
                <th className="py-3 px-3.5 text-right">Biaya BBM</th>
                <th className="py-3 px-3.5 text-right">Rasio (KM/L)</th>
                <th className="py-3 px-3.5 text-right">Liter / KM</th>
                <th className="py-3 px-3.5 text-right">Target</th>
                <th className="py-3 px-3.5 text-center">Status</th>
                <th className="py-3 px-3.5 min-w-[260px]">Keterangan Efisiensi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {displayedFleetSummaries.length === 0 ? (
                <tr>
                  <td colSpan={12} className="py-12 text-center text-slate-500 text-sm">
                    Tidak ada data konsumsi BBM armada untuk periode &amp; filter yang dipilih.
                  </td>
                </tr>
              ) : (
                displayedFleetSummaries.map((f, i) => (
                  <tr key={f.id} className="hover:bg-slate-50/80 transition">
                    <td className="py-3.5 px-3.5 text-slate-400 text-xs font-mono tabular-nums whitespace-nowrap">
                      {i + 1}
                    </td>
                    <td className="py-3.5 px-3.5 whitespace-nowrap">
                      <div className="font-semibold text-slate-900">{f.initialCode || f.plateNumber}</div>
                      <div className="text-xs text-slate-500 font-mono">{f.plateNumber}</div>
                    </td>
                    <td className="py-3.5 px-3.5 text-slate-600 text-xs whitespace-nowrap">{f.vehicleType}</td>
                    <td className="py-3.5 px-3.5 text-right font-mono tabular-nums text-slate-700 whitespace-nowrap">{f.refuelCount}x</td>
                    <td className="py-3.5 px-3.5 text-right font-mono tabular-nums font-semibold text-slate-900 whitespace-nowrap">{Number(f.totalLiters || 0).toFixed(2)} L</td>
                    <td className="py-3.5 px-3.5 text-right font-mono tabular-nums font-semibold text-blue-600 whitespace-nowrap">{f.totalDistanceKm.toLocaleString('id-ID')}</td>
                    <td className="py-3.5 px-3.5 text-right font-mono tabular-nums font-semibold text-slate-900 whitespace-nowrap">{formatRupiah(f.totalCost)}</td>
                    <td className="py-3.5 px-3.5 text-right font-mono tabular-nums font-bold text-slate-900 whitespace-nowrap">{f.avgKmPerLiter}</td>
                    <td className="py-3.5 px-3.5 text-right font-mono tabular-nums whitespace-nowrap">
                      <span className="font-semibold text-slate-900">{f.avgLiterPerKm}</span>
                    </td>
                    <td className="py-3.5 px-3.5 text-right font-mono tabular-nums text-slate-500 text-xs whitespace-nowrap">{f.targetRatio}</td>
                    <td className="py-3.5 px-3.5 text-center whitespace-nowrap">
                      <span className={`px-2.5 py-1 rounded-md text-xs font-semibold border inline-block ${
                        f.status === 'Sangat Efisien'
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          : f.status === 'Efisien / Normal'
                          ? 'bg-blue-50 text-blue-700 border-blue-200'
                          : f.status === 'Boros'
                          ? 'bg-amber-50 text-amber-700 border-amber-200'
                          : 'bg-red-50 text-red-700 border-red-200'
                      }`}>
                        {f.status}
                      </span>
                    </td>
                    <td className="py-3.5 px-3.5 text-xs text-slate-600 leading-relaxed max-w-sm">
                      {buildEfficiencyReason[f.id]}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
