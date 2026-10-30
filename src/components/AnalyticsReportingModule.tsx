import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ComposedChart
} from 'recharts';
import {
  FileText,
  Download,
  Filter,
  Calendar,
  Truck,
  Users,
  Navigation,
  Gauge,
  Clock,
  CheckCircle2,
  AlertTriangle,
  TrendingUp,
  Search,
  RefreshCw,
  FileSpreadsheet,
  Award,
  Activity,
  Layers,
  ChevronDown,
  ChevronRight,
  MapPin,
  Fuel,
  ShieldCheck,
  Check,
  X
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { logisticsStore } from '../services/store';
import {
  trackingLogService,
  AnalyticsFilterParams,
  AnalyticsSummaryReport,
  RouteEvaluationSummary
} from '../services/trackingLogService';

function getInitials(name: string): string {
  const parts = (name || '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'KR';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

export const AnalyticsReportingModule: React.FC = () => {
  const [fleets, setFleets] = useState(logisticsStore.getFleets());
  const [crews, setCrews] = useState(logisticsStore.getCrews());
  const [users, setUsers] = useState(logisticsStore.getUsers());

  // Filter States
  const [datePreset, setDatePreset] = useState<'all' | 'today' | '7days' | 'month' | 'custom'>('all');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [selectedFleetId, setSelectedFleetId] = useState<string>('all');
  const [selectedCrewId, setSelectedCrewId] = useState<string>('all');
  const [selectedIsland, setSelectedIsland] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Custom Dropdown UI States
  const [isFleetDropdownOpen, setIsFleetDropdownOpen] = useState(false);
  const [fleetSearchText, setFleetSearchText] = useState('');
  const [isCrewDropdownOpen, setIsCrewDropdownOpen] = useState(false);
  const [crewSearchText, setCrewSearchText] = useState('');

  const fleetDropdownRef = useRef<HTMLDivElement>(null);
  const crewDropdownRef = useRef<HTMLDivElement>(null);

  // Active View Tab (Tanpa Telemetri tracking_logs)
  const [activeTab, setActiveTab] = useState<'overview' | 'fleet_crew' | 'routes'>('overview');
  const [selectedRouteDetail, setSelectedRouteDetail] = useState<RouteEvaluationSummary | null>(null);
  const [exportSuccessToast, setExportSuccessToast] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = logisticsStore.subscribe(() => {
      setFleets([...logisticsStore.getFleets()]);
      setCrews([...logisticsStore.getCrews()]);
      setUsers([...logisticsStore.getUsers()]);
    });
    return () => unsubscribe();
  }, []);

  // Close custom dropdowns on outside click / Escape
  useEffect(() => {
    const handleOutside = (e: MouseEvent) => {
      if (fleetDropdownRef.current && !fleetDropdownRef.current.contains(e.target as Node)) {
        setIsFleetDropdownOpen(false);
      }
      if (crewDropdownRef.current && !crewDropdownRef.current.contains(e.target as Node)) {
        setIsCrewDropdownOpen(false);
      }
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsFleetDropdownOpen(false);
        setIsCrewDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    window.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleOutside);
      window.removeEventListener('keydown', handleKey);
    };
  }, []);

  // Integrated Active Crew Options (Driver & Helper aktif dari Manajemen User + Kru)
  const activeCrewOptions = useMemo(() => {
    const list: Array<{ id: string; name: string; roleBadge: 'Driver' | 'Helper' }> = [];
    const seen = new Set<string>();

    users
      .filter(u => (u.role === 'driver' || u.role === 'crew_helper') && u.status === 'approved')
      .forEach(u => {
        const clean = (u.fullName || '').trim();
        if (clean && !seen.has(clean.toLowerCase())) {
          seen.add(clean.toLowerCase());
          const matchedCrew = crews.find(c => c.name.toLowerCase() === clean.toLowerCase());
          list.push({
            id: matchedCrew?.id || u.id,
            name: clean,
            roleBadge: u.role === 'crew_helper' ? 'Helper' : 'Driver'
          });
        }
      });

    crews.forEach(c => {
      const clean = (c.name || '').trim();
      if (clean && !seen.has(clean.toLowerCase())) {
        const nonActiveUser = users.find(
          u => (u.fullName || '').trim().toLowerCase() === clean.toLowerCase() && u.status !== 'approved'
        );
        if (!nonActiveUser) {
          seen.add(clean.toLowerCase());
          list.push({
            id: c.id,
            name: clean,
            roleBadge: c.role === 'Kernet / Helper' || c.id.includes('hlp') ? 'Helper' : 'Driver'
          });
        }
      }
    });

    return list.sort((a, b) => {
      if (a.roleBadge !== b.roleBadge) return a.roleBadge === 'Driver' ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
  }, [users, crews]);

  const filteredFleetOptions = useMemo(() => {
    const q = fleetSearchText.trim().toLowerCase();
    if (!q) return fleets;
    return fleets.filter(
      f =>
        f.plateNumber.toLowerCase().includes(q) ||
        (f.initialCode && f.initialCode.toLowerCase().includes(q)) ||
        f.vehicleType.toLowerCase().includes(q)
    );
  }, [fleets, fleetSearchText]);

  const filteredCrewOptions = useMemo(() => {
    const q = crewSearchText.trim().toLowerCase();
    if (!q) return activeCrewOptions;
    return activeCrewOptions.filter(
      c => c.name.toLowerCase().includes(q) || c.roleBadge.toLowerCase().includes(q)
    );
  }, [activeCrewOptions, crewSearchText]);

  // Apply Date Presets
  const handleDatePresetChange = (preset: 'all' | 'today' | '7days' | 'month' | 'custom') => {
    setDatePreset(preset);
    const now = new Date();
    const toIsoDate = (d: Date) =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const todayStr = toIsoDate(now);

    if (preset === 'all') {
      setStartDate('');
      setEndDate('');
    } else if (preset === 'today') {
      setStartDate(todayStr);
      setEndDate(todayStr);
    } else if (preset === '7days') {
      const d = new Date(now);
      d.setDate(d.getDate() - 7);
      setStartDate(toIsoDate(d));
      setEndDate(todayStr);
    } else if (preset === 'month') {
      const firstDay = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
      setStartDate(firstDay);
      setEndDate(todayStr);
    }
  };

  const resetAllFilters = () => {
    setDatePreset('all');
    setStartDate('');
    setEndDate('');
    setSelectedFleetId('all');
    setSelectedCrewId('all');
    setSelectedIsland('all');
    setSearchQuery('');
  };

  const filterParams: AnalyticsFilterParams = useMemo(() => ({
    startDate,
    endDate,
    fleetId: selectedFleetId,
    crewId: selectedCrewId,
    status: 'all',
    island: selectedIsland,
    searchQuery
  }), [startDate, endDate, selectedFleetId, selectedCrewId, selectedIsland, searchQuery, fleets, crews, users]);

  const report: AnalyticsSummaryReport = useMemo(() => {
    return trackingLogService.getAnalyticsReport(filterParams);
  }, [filterParams]);

  // Export to CSV Handler
  const handleExportCSV = (datasetType: 'routes' | 'fleet' | 'crew') => {
    let dataToExport: any[] = [];
    let filename = '';

    if (datasetType === 'routes') {
      filename = `Evaluasi_Rute_AKK_${new Date().toISOString().slice(0, 10)}.csv`;
      dataToExport = report.routeEvaluations.map(r => ({
        'No PO / Resi': r.trackingNumber,
        'Tanggal Kirim': r.date,
        'Tujuan Area': r.destinationStore,
        'Kota': r.destinationCity,
        'Plat Armada': r.plateNumber,
        'Inisial Armada': r.initialCode || '-',
        'Driver Utama': r.driverName,
        'Helper': r.helperName || '-',
        'KM Awal BBM (KM)': r.bbmStartKm,
        'Rata2 Kecepatan Evaluasi Jalur (KM/H)': r.avgSpeedKmh,
        'Kecepatan Maks (KM/H)': r.maxSpeedKmh,
        'Jadwal Berangkat': r.scheduledDepartureTime,
        'Aktual Gate-Out': r.actualGateOutTime,
        'Status Gate-Out': r.gateOutStatus === 'tepat_waktu' ? 'Tepat Waktu' : r.gateOutStatus === 'terlambat' ? 'Terlambat' : 'Belum Gate-Out',
        'Jadwal Pulang': r.scheduledReturnTime,
        'Aktual Tiba di Argo': r.actualArgoReturnTime,
        'Status Kepulangan Argo': r.argoReturnStatus === 'tepat_waktu' ? 'Tepat Waktu' : r.argoReturnStatus === 'terlambat' ? 'Terlambat' : 'Belum Tiba',
        'Ketepatan Tim': r.isOnTime ? 'Tepat Waktu' : 'Terlambat'
      }));
    } else if (datasetType === 'fleet') {
      filename = `Performa_Armada_AKK_${new Date().toISOString().slice(0, 10)}.csv`;
      dataToExport = report.fleetMetrics.map(f => ({
        'Plat Nomor': f.plateNumber,
        'Inisial': f.initialCode || '-',
        'Tipe Kendaraan': f.vehicleType,
        'Total Kiriman Terintegrasi': f.totalTrips,
        'Frekuensi Kru Pengiriman': f.crewMenuFrequency,
        'Total KM Awal BBM (KM)': f.totalDistanceKm,
        'Rata2 Kecepatan Evaluasi Jalur (KM/H)': f.avgSpeedKmh,
        'Kecepatan Maks (KM/H)': f.maxSpeedKmh,
        'Konsumsi BBM (Liter)': f.totalFuelLiters,
        'Rasio BBM (KM/L)': f.avgKmPerLiter,
        'Ketepatan Waktu SLA (%)': f.onTimeRatePercent
      }));
    } else {
      filename = `Performa_Kru_AKK_${new Date().toISOString().slice(0, 10)}.csv`;
      dataToExport = report.crewMetrics.map(c => ({
        'Nama Kru': c.crewName,
        'Posisi': c.cleanRoleLabel,
        'Tugas Sebagai Driver': c.totalTripsAsDriver,
        'Tugas Sebagai Helper': c.totalTripsAsHelper,
        'Total Kiriman Gabungan': c.totalTripsCombined,
        'Total KM Awal BBM (KM)': c.totalDistanceKm,
        'Rata2 Kecepatan (KM/H)': c.avgSpeedKmh,
        'Kiriman Tepat Waktu': c.onTimeDeliveries,
        'Kiriman Terlambat': c.lateDeliveries,
        'SLA Ketepatan (%)': c.onTimeRatePercent,
        'Skor Keselamatan': c.safetyScore
      }));
    }

    const ws = XLSX.utils.json_to_sheet(dataToExport);
    const csvOutput = XLSX.utils.sheet_to_csv(ws);
    const blob = new Blob([csvOutput], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    setExportSuccessToast(`Berhasil mengunduh CSV: ${filename}`);
    setTimeout(() => setExportSuccessToast(null), 4000);
  };

  // Export Multi-Sheet Excel (.xlsx)
  const handleExportMultiSheetExcel = () => {
    const wb = XLSX.utils.book_new();

    const summaryData = [
      { Metrik: 'Total Jarak Tempuh (KM Awal BBM)', Nilai: `${report.overall.totalDistanceKm} KM (${report.overall.bbmInputCount} Input BBM)` },
      { Metrik: 'Rata-rata Kecepatan (Evaluasi Jalur)', Nilai: `${report.overall.avgSpeedKmh} KM/H` },
      { Metrik: 'Kecepatan Tertinggi Tercatat', Nilai: `${report.overall.maxSpeedKmh} KM/H` },
      { Metrik: 'Total Kiriman (Terintegrasi Jadwal & Kru Pengiriman)', Nilai: `${report.overall.totalDeliveries} Kiriman` },
      { Metrik: 'Frekuensi Armada pada Kru Pengiriman', Nilai: `${report.overall.fleetFrequencyTotal} Penugasan` },
      { Metrik: 'Tingkat Ketepatan Waktu (SLA Gate-Out & Tiba di Argo)', Nilai: `${report.overall.onTimeRatePercent}%` },
      { Metrik: 'Tim Tepat Waktu vs Terlambat', Nilai: `${report.overall.onTimeCount} Tepat Waktu / ${report.overall.lateCount} Terlambat` },
      { Metrik: 'Gate-Out Tepat Waktu vs Terlambat', Nilai: `${report.overall.gateOutOnTimeCount} Tepat Waktu / ${report.overall.gateOutLateCount} Terlambat` },
      { Metrik: 'Tiba di Argo Tepat Waktu vs Terlambat', Nilai: `${report.overall.argoReturnOnTimeCount} Tepat Waktu / ${report.overall.argoReturnLateCount} Terlambat` }
    ];
    const wsSummary = XLSX.utils.json_to_sheet(summaryData);
    XLSX.utils.book_append_sheet(wb, wsSummary, 'Ringkasan Eksekutif');

    const fleetRows = report.fleetMetrics.map(f => ({
      'Plat Nomor': f.plateNumber,
      'Inisial': f.initialCode || '-',
      'Tipe Armada': f.vehicleType,
      'Total Kiriman': f.totalTrips,
      'Frekuensi Kru Pengiriman': f.crewMenuFrequency,
      'Total KM Awal BBM': f.totalDistanceKm,
      'Kecepatan Rata2 (KM/H)': f.avgSpeedKmh,
      'Kecepatan Maks (KM/H)': f.maxSpeedKmh,
      'Tepat Waktu': f.onTimeTripsCount,
      'Terlambat': f.lateTripsCount,
      'SLA On-Time (%)': f.onTimeRatePercent
    }));
    const wsFleet = XLSX.utils.json_to_sheet(fleetRows);
    XLSX.utils.book_append_sheet(wb, wsFleet, 'Performa Armada');

    const crewRows = report.crewMetrics.map(c => ({
      'Nama Kru': c.crewName,
      'Peran': c.cleanRoleLabel,
      'Kiriman Driver': c.totalTripsAsDriver,
      'Kiriman Helper': c.totalTripsAsHelper,
      'Total Kiriman': c.totalTripsCombined,
      'Total KM Awal BBM': c.totalDistanceKm,
      'Rata2 Kecepatan (KM/H)': c.avgSpeedKmh,
      'Tepat Waktu': c.onTimeDeliveries,
      'Terlambat': c.lateDeliveries,
      'SLA On-Time (%)': c.onTimeRatePercent
    }));
    const wsCrew = XLSX.utils.json_to_sheet(crewRows);
    XLSX.utils.book_append_sheet(wb, wsCrew, 'Performa Kru');

    const routeRows = report.routeEvaluations.map(r => ({
      'No PO': r.trackingNumber,
      'Tanggal Kirim': r.date,
      'Tujuan Area': r.destinationStore,
      'Plat Armada': r.plateNumber,
      'Driver': r.driverName,
      'Helper': r.helperName || '-',
      'KM Awal BBM': r.bbmStartKm,
      'Rata2 Kecepatan (KM/H)': r.avgSpeedKmh,
      'Jadwal Berangkat': r.scheduledDepartureTime,
      'Aktual Gate-Out': r.actualGateOutTime,
      'Jadwal Pulang': r.scheduledReturnTime,
      'Aktual Tiba di Argo': r.actualArgoReturnTime,
      'Ketepatan Tim': r.isOnTime ? 'Tepat Waktu' : 'Terlambat'
    }));
    const wsRoutes = XLSX.utils.json_to_sheet(routeRows);
    XLSX.utils.book_append_sheet(wb, wsRoutes, 'Evaluasi Rute');

    const filename = `Laporan_Analitik_Performa_AKK_${new Date().toISOString().slice(0, 10)}.xlsx`;
    XLSX.writeFile(wb, filename);

    setExportSuccessToast(`Berhasil mengunduh Workbook Lengkap: ${filename}`);
    setTimeout(() => setExportSuccessToast(null), 4000);
  };

  // Pie Chart Data for Punctuality (SLA Gate-Out & Tiba di Argo)
  const slaPieData = [
    { name: 'Tepat Waktu (Gate-Out & Argo)', value: Math.max(report.overall.onTimeCount, 1), color: '#10b981' },
    { name: 'Terlambat', value: report.overall.lateCount, color: '#f43f5e' }
  ];

  const selectedFleetObj = useMemo(
    () => fleets.find(f => f.id === selectedFleetId),
    [fleets, selectedFleetId]
  );

  const selectedCrewObj = useMemo(
    () => activeCrewOptions.find(c => c.id === selectedCrewId),
    [activeCrewOptions, selectedCrewId]
  );

  return (
    <div className="space-y-4">
      {/* Toast Notification */}
      {exportSuccessToast && (
        <div className="fixed bottom-5 right-5 z-50 flex items-center gap-2.5 bg-emerald-950/95 border border-emerald-500/50 text-emerald-200 px-4 py-3 rounded-xl shadow-2xl">
          <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          <span className="text-xs font-semibold">{exportSuccessToast}</span>
        </div>
      )}

      {/* Top Header & Export Toolbar */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-xl">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-amber-500/10 text-amber-400 border border-amber-500/30 flex items-center gap-1.5">
                <Activity className="w-3 h-3" />
                Evaluasi Performa Operasional Terintegrasi
              </span>
            </div>
            <h2 className="text-lg sm:text-xl font-black text-white tracking-tight">
              Laporan Analitik Performa Armada &amp; Kru
            </h2>
            <p className="text-slate-400 text-xs max-w-2xl">
              Terintegrasi langsung dengan KM Awal BBM, Evaluasi Jalur, Jadwal &amp; Penugasan, Frekuensi Armada pada Kru Pengiriman, serta Ketepatan Waktu Gate-Out &amp; Tiba di Gudang Argo.
            </p>
          </div>

          {/* Export Buttons */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={handleExportMultiSheetExcel}
              className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-lg shadow-emerald-600/20 transition cursor-pointer"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>Unduh Excel (.XLSX)</span>
            </button>

            <div className="relative group">
              <button className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition cursor-pointer">
                <Download className="w-3.5 h-3.5 text-amber-400" />
                <span>Ekspor CSV</span>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
              </button>
              <div className="absolute right-0 mt-1.5 w-52 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl py-1.5 z-30 hidden group-hover:block">
                <button
                  onClick={() => handleExportCSV('routes')}
                  className="w-full px-3.5 py-2 text-left text-xs text-slate-300 hover:bg-slate-800 hover:text-white flex items-center justify-between cursor-pointer"
                >
                  <span>Evaluasi Rute (CSV)</span>
                  <FileText className="w-3.5 h-3.5 text-cyan-400" />
                </button>
                <button
                  onClick={() => handleExportCSV('fleet')}
                  className="w-full px-3.5 py-2 text-left text-xs text-slate-300 hover:bg-slate-800 hover:text-white flex items-center justify-between cursor-pointer"
                >
                  <span>Performa Armada (CSV)</span>
                  <Truck className="w-3.5 h-3.5 text-amber-400" />
                </button>
                <button
                  onClick={() => handleExportCSV('crew')}
                  className="w-full px-3.5 py-2 text-left text-xs text-slate-300 hover:bg-slate-800 hover:text-white flex items-center justify-between cursor-pointer"
                >
                  <span>Performa Kru (CSV)</span>
                  <Users className="w-3.5 h-3.5 text-emerald-400" />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Navigation Tabs (3 Tab Utama Tanpa Telemetri tracking_logs) */}
        <div className="flex flex-wrap items-center gap-1.5 mt-4 pt-3.5 border-t border-slate-800/80">
          <button
            onClick={() => setActiveTab('overview')}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
              activeTab === 'overview'
                ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                : 'bg-slate-800/70 text-slate-400 hover:text-slate-200 hover:bg-slate-800'
            }`}
          >
            <TrendingUp className="w-3.5 h-3.5" />
            <span>Ringkasan &amp; Grafik Tren</span>
          </button>

          <button
            onClick={() => setActiveTab('fleet_crew')}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
              activeTab === 'fleet_crew'
                ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                : 'bg-slate-800/70 text-slate-400 hover:text-slate-200 hover:bg-slate-800'
            }`}
          >
            <Award className="w-3.5 h-3.5" />
            <span>Performa Armada &amp; Kru</span>
          </button>

          <button
            onClick={() => setActiveTab('routes')}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
              activeTab === 'routes'
                ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                : 'bg-slate-800/70 text-slate-400 hover:text-slate-200 hover:bg-slate-800'
            }`}
          >
            <Navigation className="w-3.5 h-3.5" />
            <span>Evaluasi Per Rute ({report.routeEvaluations.length})</span>
          </button>
        </div>
      </div>

      {/* Filter Panel: Rentang Disimpelkan, Custom Dropdown UI/UX Armada & Kru, Tanpa Status Pengiriman */}
      <div className="relative z-30 bg-slate-900/90 border border-slate-800 rounded-2xl p-3.5 shadow-lg space-y-3">
        {/* Baris 1: Rentang Waktu Simpel + Pencarian */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-2.5">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] font-bold text-slate-400 flex items-center gap-1 mr-1">
              <Calendar className="w-3.5 h-3.5 text-amber-400" />
              RENTANG:
            </span>
            {(
              [
                { id: 'all', label: 'Semua' },
                { id: 'today', label: 'Hari Ini' },
                { id: '7days', label: '7 Hari' },
                { id: 'month', label: 'Bulan Ini' },
                { id: 'custom', label: 'Kustom' }
              ] as const
            ).map(p => (
              <button
                key={p.id}
                type="button"
                onClick={() => handleDatePresetChange(p.id)}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                  datePreset === p.id
                    ? 'bg-amber-500 text-slate-950 shadow-xs'
                    : 'bg-slate-800 text-slate-300 hover:bg-slate-700 border border-slate-700/80'
                }`}
              >
                {p.label}
              </button>
            ))}

            {datePreset === 'custom' && (
              <div className="flex items-center gap-1.5 ml-1">
                <input
                  type="date"
                  value={startDate}
                  onChange={e => setStartDate(e.target.value)}
                  className="bg-slate-950 border border-slate-700 rounded-lg px-2 py-1 text-xs text-slate-200 focus:outline-none focus:border-amber-500"
                />
                <span className="text-slate-500 text-xs">s/d</span>
                <input
                  type="date"
                  value={endDate}
                  onChange={e => setEndDate(e.target.value)}
                  className="bg-slate-950 border border-slate-700 rounded-lg px-2 py-1 text-xs text-slate-200 focus:outline-none focus:border-amber-500"
                />
              </div>
            )}
          </div>

          {/* Search Input */}
          <div className="relative w-full lg:w-72">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Cari PO, area, sopir, plat..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-8 pr-7 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-amber-500/60"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Baris 2: Custom Modern Dropdown Filter Armada, Filter Kru, dan Reset */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 pt-2.5 border-t border-slate-800/60">
          {/* Custom Filter Armada */}
          <div ref={fleetDropdownRef} className="relative">
            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center justify-between mb-1">
              <span>Filter Armada</span>
              <span className="text-[10px] font-bold text-amber-400">{fleets.length} Unit</span>
            </label>
            <button
              type="button"
              onClick={() => {
                setIsFleetDropdownOpen(prev => !prev);
                setIsCrewDropdownOpen(false);
                setFleetSearchText('');
              }}
              className={`w-full flex items-center justify-between gap-2 bg-slate-950 border rounded-xl px-3 py-2 text-left transition cursor-pointer ${
                isFleetDropdownOpen
                  ? 'border-amber-500 ring-2 ring-amber-500/20'
                  : 'border-slate-800 hover:border-slate-700'
              }`}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <div className={`w-7 h-7 rounded-lg flex items-center justify-center font-black text-[10px] shrink-0 border ${
                  selectedFleetObj
                    ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                    : 'bg-slate-800 text-slate-400 border-slate-700'
                }`}>
                  {selectedFleetObj ? (selectedFleetObj.initialCode || 'TRK') : <Truck className="w-3.5 h-3.5" />}
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-bold text-white truncate">
                    {selectedFleetObj
                      ? `${selectedFleetObj.plateNumber}${selectedFleetObj.initialCode ? ` (${selectedFleetObj.initialCode})` : ''}`
                      : `Semua Armada (${fleets.length} Unit)`}
                  </div>
                  <div className="text-[10px] text-slate-400 truncate">
                    {selectedFleetObj ? selectedFleetObj.vehicleType : 'Menampilkan seluruh unit armada'}
                  </div>
                </div>
              </div>
              <ChevronDown className={`w-4 h-4 text-slate-400 shrink-0 transition-transform ${isFleetDropdownOpen ? 'rotate-180 text-amber-400' : ''}`} />
            </button>

            {isFleetDropdownOpen && (
              <div className="absolute left-0 right-0 mt-1.5 bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl z-50 overflow-hidden">
                <div className="p-2 border-b border-slate-800 bg-slate-950/60">
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={fleetSearchText}
                      onChange={e => setFleetSearchText(e.target.value)}
                      placeholder="Cari plat atau inisial armada..."
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg pl-8 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
                      autoFocus
                    />
                  </div>
                </div>
                <div className="max-h-56 overflow-y-auto p-1.5 space-y-1">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedFleetId('all');
                      setIsFleetDropdownOpen(false);
                    }}
                    className={`w-full flex items-center justify-between px-2.5 py-2 rounded-xl text-left text-xs font-bold transition cursor-pointer ${
                      selectedFleetId === 'all'
                        ? 'bg-amber-500 text-slate-950'
                        : 'text-slate-200 hover:bg-slate-800'
                    }`}
                  >
                    <span>Semua Armada ({fleets.length} Unit)</span>
                    {selectedFleetId === 'all' && <Check className="w-4 h-4 shrink-0" />}
                  </button>
                  {filteredFleetOptions.map(f => {
                    const isSel = selectedFleetId === f.id;
                    return (
                      <button
                        key={f.id}
                        type="button"
                        onClick={() => {
                          setSelectedFleetId(f.id);
                          setIsFleetDropdownOpen(false);
                        }}
                        className={`w-full flex items-center justify-between gap-2 px-2.5 py-2 rounded-xl text-left transition cursor-pointer ${
                          isSel ? 'bg-amber-500 text-slate-950' : 'text-slate-200 hover:bg-slate-800'
                        }`}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span className={`px-1.5 py-0.5 rounded font-mono text-[10px] font-black border shrink-0 ${
                            isSel
                              ? 'bg-slate-950/20 text-slate-950 border-slate-950/30'
                              : 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                          }`}>
                            {f.initialCode || 'UNIT'}
                          </span>
                          <div className="min-w-0">
                            <div className="text-xs font-bold truncate">{f.plateNumber}</div>
                            <div className={`text-[10px] truncate ${isSel ? 'text-slate-900/80' : 'text-slate-400'}`}>
                              {f.vehicleType}
                            </div>
                          </div>
                        </div>
                        {isSel && <Check className="w-4 h-4 shrink-0" />}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Custom Filter Kru (Driver / Helper) */}
          <div ref={crewDropdownRef} className="relative">
            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center justify-between mb-1">
              <span>Filter Kru (Driver / Helper)</span>
              <span className="text-[10px] font-bold text-emerald-400">{activeCrewOptions.length} Aktif</span>
            </label>
            <button
              type="button"
              onClick={() => {
                setIsCrewDropdownOpen(prev => !prev);
                setIsFleetDropdownOpen(false);
                setCrewSearchText('');
              }}
              className={`w-full flex items-center justify-between gap-2 bg-slate-950 border rounded-xl px-3 py-2 text-left transition cursor-pointer ${
                isCrewDropdownOpen
                  ? 'border-emerald-500 ring-2 ring-emerald-500/20'
                  : 'border-slate-800 hover:border-slate-700'
              }`}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <div className={`w-7 h-7 rounded-lg flex items-center justify-center font-black text-[10px] shrink-0 border ${
                  selectedCrewObj
                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                    : 'bg-slate-800 text-slate-400 border-slate-700'
                }`}>
                  {selectedCrewObj ? getInitials(selectedCrewObj.name) : <Users className="w-3.5 h-3.5" />}
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-bold text-white truncate">
                    {selectedCrewObj ? selectedCrewObj.name : `Semua Kru (${activeCrewOptions.length} Anggota)`}
                  </div>
                  <div className="text-[10px] text-slate-400 truncate">
                    {selectedCrewObj ? `Posisi: ${selectedCrewObj.roleBadge} • Aktif` : 'Filter berdasarkan Driver atau Helper'}
                  </div>
                </div>
              </div>
              <ChevronDown className={`w-4 h-4 text-slate-400 shrink-0 transition-transform ${isCrewDropdownOpen ? 'rotate-180 text-emerald-400' : ''}`} />
            </button>

            {isCrewDropdownOpen && (
              <div className="absolute left-0 right-0 mt-1.5 bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl z-50 overflow-hidden">
                <div className="p-2 border-b border-slate-800 bg-slate-950/60">
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={crewSearchText}
                      onChange={e => setCrewSearchText(e.target.value)}
                      placeholder="Cari nama driver atau helper..."
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg pl-8 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                      autoFocus
                    />
                  </div>
                </div>
                <div className="max-h-56 overflow-y-auto p-1.5 space-y-1">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedCrewId('all');
                      setIsCrewDropdownOpen(false);
                    }}
                    className={`w-full flex items-center justify-between px-2.5 py-2 rounded-xl text-left text-xs font-bold transition cursor-pointer ${
                      selectedCrewId === 'all'
                        ? 'bg-emerald-600 text-white'
                        : 'text-slate-200 hover:bg-slate-800'
                    }`}
                  >
                    <span>Semua Kru ({activeCrewOptions.length} Anggota)</span>
                    {selectedCrewId === 'all' && <Check className="w-4 h-4 shrink-0" />}
                  </button>
                  {filteredCrewOptions.map(c => {
                    const isSel = selectedCrewId === c.id;
                    return (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => {
                          setSelectedCrewId(c.id);
                          setIsCrewDropdownOpen(false);
                        }}
                        className={`w-full flex items-center justify-between gap-2 px-2.5 py-2 rounded-xl text-left transition cursor-pointer ${
                          isSel ? 'bg-emerald-600 text-white' : 'text-slate-200 hover:bg-slate-800'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className={`w-6 h-6 rounded-lg flex items-center justify-center font-black text-[10px] shrink-0 border ${
                            isSel
                              ? 'bg-white/20 text-white border-white/30'
                              : c.roleBadge === 'Driver'
                              ? 'bg-blue-500/15 text-blue-300 border-blue-500/30'
                              : 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                          }`}>
                            {getInitials(c.name)}
                          </div>
                          <div className="min-w-0">
                            <div className="text-xs font-bold truncate">{c.name}</div>
                            <div className={`text-[10px] flex items-center gap-1.5 ${isSel ? 'text-white/85' : 'text-slate-400'}`}>
                              <span>{c.roleBadge}</span>
                              <span>•</span>
                              <span className={isSel ? 'text-white' : 'text-emerald-400'}>● Aktif</span>
                            </div>
                          </div>
                        </div>
                        {isSel && <Check className="w-4 h-4 shrink-0" />}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Reset Button */}
          <div className="flex items-end">
            <button
              type="button"
              onClick={resetAllFilters}
              className="w-full flex items-center justify-center gap-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 rounded-xl px-3 py-2.5 text-xs font-bold transition cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5 text-amber-400" />
              <span>Reset Semua Filter</span>
            </button>
          </div>
        </div>
      </div>

      {/* 4 Kartu Metrik Utama (Tanpa Waktu Idle Mesin) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        {/* 1. Total Jarak Tempuh (Diambil dari Total KM Awal Inputan BBM) */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 shadow-lg">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Total Jarak Tempuh
            </span>
            <div className="w-8 h-8 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
              <Navigation className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="text-2xl font-black text-white font-mono">
              {report.overall.totalDistanceKm.toLocaleString('id-ID')}
            </span>
            <span className="text-xs font-bold text-slate-400">KM</span>
          </div>
          <div className="mt-2 pt-2 border-t border-slate-800/80 flex items-center justify-between text-[11px]">
            <span className="text-slate-400">Sumber KM Awal BBM:</span>
            <span className="text-cyan-400 font-bold">{report.overall.bbmInputCount} Input BBM</span>
          </div>
        </div>

        {/* 2. Rata-Rata Kecepatan (Diambil dari Evaluasi Jalur) */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 shadow-lg">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Rata-Rata Kecepatan
            </span>
            <div className="w-8 h-8 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <Gauge className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="text-2xl font-black text-white font-mono">
              {report.overall.avgSpeedKmh}
            </span>
            <span className="text-xs font-bold text-slate-400">KM/H</span>
          </div>
          <div className="mt-2 pt-2 border-t border-slate-800/80 flex items-center justify-between text-[11px]">
            <span className="text-slate-400">Sumber Data:</span>
            <span className="text-amber-400 font-bold">
              Evaluasi Jalur ({report.overall.evaluationRoutesCount} Rute)
            </span>
          </div>
        </div>

        {/* 3. Total Kiriman (Terintegrasi Jadwal & Penugasan serta Frekuensi Armada di Kru Pengiriman) */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 shadow-lg">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Total Kiriman
            </span>
            <div className="w-8 h-8 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="text-2xl font-black text-white font-mono">
              {report.overall.totalDeliveries}
            </span>
            <span className="text-xs font-bold text-slate-400">Kiriman</span>
          </div>
          <div className="mt-2 pt-2 border-t border-slate-800/80 flex items-center justify-between text-[11px]">
            <span className="text-slate-400">Jadwal &amp; Frekuensi Kru:</span>
            <span className="text-emerald-400 font-bold">
              {report.overall.fleetFrequencyTotal} Ritase Armada
            </span>
          </div>
        </div>

        {/* 4. Ketepatan Waktu (SLA: Gate-Out Keluar Gudang & Klik Tiba di Argo) */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 shadow-lg">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Ketepatan Waktu (SLA)
            </span>
            <div className="w-8 h-8 rounded-xl bg-teal-500/10 border border-teal-500/30 flex items-center justify-center text-teal-400">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-white font-mono">
              {report.overall.onTimeRatePercent}%
            </span>
            <span className={`text-[11px] font-bold ${report.overall.lateCount === 0 ? 'text-emerald-400' : 'text-amber-400'}`}>
              {report.overall.lateCount === 0 ? 'Tepat Waktu' : `${report.overall.lateCount} Terlambat`}
            </span>
          </div>
          <div className="mt-2 pt-2 border-t border-slate-800/80 flex items-center justify-between text-[11px]">
            <span className="text-slate-400">Gate-Out &amp; Tiba Argo:</span>
            <span className="text-teal-300 font-bold">
              {report.overall.onTimeCount} Tepat • {report.overall.lateCount} Terlambat
            </span>
          </div>
        </div>
      </div>

      {/* TAB 1: OVERVIEW & CHARTS */}
      {activeTab === 'overview' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Distance & Speed Trend Composed Chart */}
            <div className="lg:col-span-2 bg-slate-900/90 border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-xl">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
                <div>
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-cyan-400" />
                    <span>Tren Jarak Tempuh (KM Awal BBM) &amp; Kecepatan Evaluasi Jalur</span>
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Akumulasi KM awal inputan BBM (KM) vs kecepatan rata-rata evaluasi jalur (KM/H)
                  </p>
                </div>
              </div>

              <div className="h-72 w-full">
                {report.dailyTrends.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-slate-500 text-xs">
                    Tidak ada data tren pada rentang filter ini.
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={report.dailyTrends}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                      <XAxis dataKey="formattedDate" stroke="#64748b" fontSize={11} />
                      <YAxis yAxisId="left" stroke="#22d3ee" fontSize={11} unit=" km" />
                      <YAxis yAxisId="right" orientation="right" stroke="#f59e0b" fontSize={11} unit=" km/h" />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: '#0f172a',
                          borderColor: '#334155',
                          borderRadius: '12px',
                          fontSize: '12px',
                          color: '#f8fafc'
                        }}
                      />
                      <Legend wrapperStyle={{ fontSize: '11px' }} />
                      <Bar
                        yAxisId="left"
                        dataKey="totalDistanceKm"
                        name="Total KM Awal BBM (KM)"
                        fill="#06b6d4"
                        radius={[6, 6, 0, 0]}
                        barSize={28}
                      />
                      <Line
                        yAxisId="right"
                        type="monotone"
                        dataKey="avgSpeedKmh"
                        name="Rata-rata Kecepatan Evaluasi Jalur (KM/H)"
                        stroke="#f59e0b"
                        strokeWidth={2.5}
                        dot={{ r: 4, fill: '#f59e0b' }}
                      />
                    </ComposedChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>

            {/* SLA Punctuality Breakdown Pie Chart */}
            <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-xl flex flex-col justify-between">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span>Ketepatan Waktu Tim Pengiriman (SLA)</span>
                </h3>
                <p className="text-[11px] text-slate-400">
                  Berdasarkan klik Gate-Out keluar gudang &amp; klik Sudah Tiba di Argo
                </p>
              </div>

              <div className="h-52 w-full my-2">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={slaPieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={48}
                      outerRadius={72}
                      paddingAngle={4}
                      dataKey="value"
                    >
                      {slaPieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#0f172a',
                        borderColor: '#334155',
                        borderRadius: '10px',
                        fontSize: '12px',
                        color: '#f8fafc'
                      }}
                    />
                    <Legend wrapperStyle={{ fontSize: '11px' }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-800/80 text-center">
                <div className="bg-emerald-950/30 border border-emerald-500/30 rounded-xl p-2">
                  <span className="text-[10px] text-emerald-300 block">Tim Tepat Waktu</span>
                  <span className="text-sm font-black text-emerald-400 font-mono">
                    {report.overall.onTimeCount} Kiriman
                  </span>
                </div>
                <div className="bg-rose-950/30 border border-rose-500/30 rounded-xl p-2">
                  <span className="text-[10px] text-rose-300 block">Tim Terlambat</span>
                  <span className="text-sm font-black text-rose-400 font-mono">
                    {report.overall.lateCount} Kiriman
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Fleet Distance Comparison Chart */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-xl">
            <h3 className="text-sm font-bold text-white flex items-center gap-2 mb-1">
              <Truck className="w-4 h-4 text-amber-400" />
              <span>Perbandingan Total Kiriman &amp; KM Awal BBM per Unit Armada</span>
            </h3>
            <p className="text-[11px] text-slate-400 mb-4">
              Terintegrasi dengan Jadwal &amp; Penugasan, Frekuensi Armada pada Kru Pengiriman, dan Inputan BBM
            </p>

            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={report.fleetMetrics} layout="vertical" margin={{ left: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis type="number" stroke="#64748b" fontSize={11} />
                  <YAxis dataKey="plateNumber" type="category" stroke="#94a3b8" fontSize={11} width={95} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#0f172a',
                      borderColor: '#334155',
                      borderRadius: '10px',
                      fontSize: '12px',
                      color: '#f8fafc'
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: '11px' }} />
                  <Bar dataKey="totalTrips" name="Total Kiriman" fill="#10b981" radius={[0, 4, 4, 0]} barSize={14} />
                  <Bar dataKey="avgSpeedKmh" name="Rata2 Kecepatan (KM/H)" fill="#f59e0b" radius={[0, 4, 4, 0]} barSize={14} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: FLEET & CREW PERFORMANCE */}
      {activeTab === 'fleet_crew' && (
        <div className="space-y-5">
          {/* Fleet Performance Table */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
            <div className="p-4 sm:p-5 border-b border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Truck className="w-4 h-4 text-amber-400" />
                  <span>Tabel Analitik Performa Armada ({report.fleetMetrics.length} Unit)</span>
                </h3>
                <p className="text-[11px] text-slate-400">
                  Terintegrasi dengan Jadwal &amp; Penugasan, Frekuensi Armada di Kru Pengiriman, KM Awal BBM, dan Evaluasi Jalur
                </p>
              </div>
              <button
                onClick={() => handleExportCSV('fleet')}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-amber-400 text-xs font-semibold border border-slate-700 transition self-start sm:self-auto cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Unduh CSV Armada</span>
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-950/70 text-[10px] font-bold uppercase tracking-wider text-slate-400 border-b border-slate-800">
                    <th className="py-3 px-4">Unit Armada</th>
                    <th className="py-3 px-4 text-center">Total Kiriman</th>
                    <th className="py-3 px-4 text-center">Frekuensi Kru</th>
                    <th className="py-3 px-4 text-right">Total KM Awal (BBM)</th>
                    <th className="py-3 px-4 text-right">Rata2 Kecepatan</th>
                    <th className="py-3 px-4 text-center">Ketepatan Tim</th>
                    <th className="py-3 px-4 text-center">SLA On-Time</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/70 text-xs">
                  {report.fleetMetrics.map(f => (
                    <tr key={f.fleetId} className="hover:bg-slate-800/40 transition">
                      <td className="py-3 px-4">
                        <div className="font-bold text-white font-mono flex items-center gap-1.5">
                          <span>{f.plateNumber}</span>
                          {f.initialCode && (
                            <span className="px-1.5 py-0.2 rounded bg-amber-500/15 text-amber-300 border border-amber-500/30 text-[10px]">
                              {f.initialCode}
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] text-slate-400">{f.vehicleType}</div>
                      </td>
                      <td className="py-3 px-4 text-center font-mono font-bold text-emerald-400">
                        {f.totalTrips} Kiriman
                      </td>
                      <td className="py-3 px-4 text-center font-mono text-slate-300">
                        {f.crewMenuFrequency}x Penugasan
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-cyan-400">
                        {f.totalDistanceKm.toLocaleString('id-ID')} KM
                      </td>
                      <td className="py-3 px-4 text-right font-mono">
                        <span className="text-amber-400 font-bold">{f.avgSpeedKmh}</span>
                        <span className="text-slate-500 text-[10px]"> km/h</span>
                      </td>
                      <td className="py-3 px-4 text-center font-mono text-[11px]">
                        <span className="text-emerald-400 font-bold">{f.onTimeTripsCount} Tepat</span>
                        <span className="text-slate-600 mx-1">•</span>
                        <span className="text-rose-400 font-bold">{f.lateTripsCount} Terlambat</span>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className={`font-mono font-bold ${f.onTimeRatePercent >= 90 ? 'text-emerald-400' : 'text-amber-400'}`}>
                          {f.onTimeRatePercent}%
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Crew Performance Table */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
            <div className="p-4 sm:p-5 border-b border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Users className="w-4 h-4 text-emerald-400" />
                  <span>Tabel Produktivitas &amp; Ketepatan Waktu Kru ({report.crewMetrics.length} Personel)</span>
                </h3>
                <p className="text-[11px] text-slate-400">
                  Evaluasi jam terbang, frekuensi kiriman, kecepatan rata-rata evaluasi jalur, dan ketepatan waktu Gate-Out &amp; Tiba di Argo
                </p>
              </div>
              <button
                onClick={() => handleExportCSV('crew')}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-emerald-400 text-xs font-semibold border border-slate-700 transition self-start sm:self-auto cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Unduh CSV Kru</span>
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-950/70 text-[10px] font-bold uppercase tracking-wider text-slate-400 border-b border-slate-800">
                    <th className="py-3 px-4">Nama Kru</th>
                    <th className="py-3 px-4">Posisi</th>
                    <th className="py-3 px-4 text-center">Total Kiriman</th>
                    <th className="py-3 px-4 text-right">KM Awal BBM</th>
                    <th className="py-3 px-4 text-right">Rata2 Kecepatan</th>
                    <th className="py-3 px-4 text-center">Tepat Waktu / Terlambat</th>
                    <th className="py-3 px-4">Rute Dominan</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/70 text-xs">
                  {report.crewMetrics.map(c => (
                    <tr key={c.crewId} className="hover:bg-slate-800/40 transition">
                      <td className="py-3 px-4">
                        <div className="font-bold text-white">{c.crewName}</div>
                      </td>
                      <td className="py-3 px-4">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                          c.cleanRoleLabel === 'Driver'
                            ? 'bg-blue-500/10 text-blue-400 border-blue-500/30'
                            : 'bg-purple-500/10 text-purple-400 border-purple-500/30'
                        }`}>
                          {c.cleanRoleLabel}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center font-mono">
                        <span className="font-bold text-white">{c.totalTripsCombined}</span>
                        <span className="text-[10px] text-slate-400 block">
                          ({c.totalTripsAsDriver} Supir / {c.totalTripsAsHelper} Helper)
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-cyan-400">
                        {c.totalDistanceKm.toLocaleString('id-ID')} KM
                      </td>
                      <td className="py-3 px-4 text-right font-mono">
                        <span className="text-amber-400 font-bold">{c.avgSpeedKmh}</span>
                        <span className="text-slate-500 text-[10px]"> km/h</span>
                      </td>
                      <td className="py-3 px-4 text-center font-mono">
                        <span className="text-emerald-400 font-bold">{c.onTimeDeliveries} Tepat</span>
                        <span className="text-slate-600 mx-1">/</span>
                        <span className="text-rose-400 font-bold">{c.lateDeliveries} Terlambat</span>
                        <span className="block text-[10px] text-slate-400">SLA: {c.onTimeRatePercent}%</span>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex flex-wrap gap-1">
                          {c.PrimaryRoutes.length > 0 ? (
                            c.PrimaryRoutes.map((r, idx) => (
                              <span key={idx} className="px-2 py-0.5 bg-slate-800 text-slate-300 rounded text-[10px]">
                                {r}
                              </span>
                            ))
                          ) : (
                            <span className="text-slate-500 text-[10px]">-</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: ROUTE EVALUATIONS (GATE-OUT & TIBA DI ARGO PUNCTUALITY) */}
      {activeTab === 'routes' && (
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
          <div className="p-4 sm:p-5 border-b border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Navigation className="w-4 h-4 text-cyan-400" />
                <span>Daftar Evaluasi Rute, Gate-Out Gudang &amp; Kepulangan Tiba di Argo ({report.routeEvaluations.length} Rute)</span>
              </h3>
              <p className="text-[11px] text-slate-400">
                Ketepatan waktu terekam otomatis saat Driver/Helper klik Gate-Out keluar gudang dan saat klik Sudah Tiba di Argo
              </p>
            </div>
            <button
              onClick={() => handleExportCSV('routes')}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-cyan-400 text-xs font-semibold border border-slate-700 transition cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Ekspor Evaluasi Rute (CSV)</span>
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-950/70 text-[10px] font-bold uppercase tracking-wider text-slate-400 border-b border-slate-800">
                  <th className="py-3 px-4">Tanggal &amp; Area Tujuan</th>
                  <th className="py-3 px-4">Armada &amp; Kru</th>
                  <th className="py-3 px-4 text-right">KM Awal BBM</th>
                  <th className="py-3 px-4 text-right">Kecepatan Evaluasi</th>
                  <th className="py-3 px-4 text-center">Gate-Out (Keluar Gudang)</th>
                  <th className="py-3 px-4 text-center">Kepulangan (Tiba di Argo)</th>
                  <th className="py-3 px-4 text-center">Status Ketepatan Tim</th>
                  <th className="py-3 px-4 text-center">Rincian</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/70 text-xs">
                {report.routeEvaluations.map(ev => (
                  <tr
                    key={ev.scheduleId}
                    onClick={() => setSelectedRouteDetail(ev)}
                    className="hover:bg-slate-800/50 transition cursor-pointer"
                  >
                    <td className="py-3 px-4">
                      <div className="font-bold text-white">{ev.destinationStore}</div>
                      <div className="text-[10px] text-slate-400 font-mono">
                        {ev.date} • {ev.trackingNumber}
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-mono font-bold text-amber-400">
                        {ev.plateNumber}{ev.initialCode ? ` (${ev.initialCode})` : ''}
                      </div>
                      <div className="text-[10px] text-slate-300">
                        Supir: {ev.driverName} {ev.helperName && ev.helperName !== '-' ? `| Helper: ${ev.helperName}` : ''}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-right font-mono">
                      <span className="font-bold text-cyan-400">{ev.bbmStartKm.toLocaleString('id-ID')} KM</span>
                    </td>
                    <td className="py-3 px-4 text-right font-mono">
                      <span className="font-bold text-amber-400">{ev.avgSpeedKmh} km/h</span>
                      <div className="text-[10px] text-slate-500">Maks: {ev.maxSpeedKmh} km/h</div>
                    </td>
                    <td className="py-3 px-4 text-center font-mono">
                      <div className="text-[10px] text-slate-400">Jadwal: {ev.scheduledDepartureTime}</div>
                      <div className="text-[11px] font-bold text-white">Aktual: {ev.actualGateOutTime}</div>
                      <span className={`inline-block mt-0.5 px-2 py-0.2 rounded-full text-[9px] font-bold border ${
                        ev.gateOutStatus === 'tepat_waktu'
                          ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                          : ev.gateOutStatus === 'terlambat'
                          ? 'bg-rose-500/15 text-rose-400 border-rose-500/30'
                          : 'bg-slate-800 text-slate-400 border-slate-700'
                      }`}>
                        {ev.gateOutStatus === 'tepat_waktu'
                          ? 'Gate-Out Tepat Waktu'
                          : ev.gateOutStatus === 'terlambat'
                          ? 'Gate-Out Terlambat'
                          : 'Menunggu Gate-Out'}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center font-mono">
                      <div className="text-[10px] text-slate-400">Target: {ev.scheduledReturnTime}</div>
                      <div className="text-[11px] font-bold text-white">Tiba Argo: {ev.actualArgoReturnTime}</div>
                      <span className={`inline-block mt-0.5 px-2 py-0.2 rounded-full text-[9px] font-bold border ${
                        ev.argoReturnStatus === 'tepat_waktu'
                          ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                          : ev.argoReturnStatus === 'terlambat'
                          ? 'bg-rose-500/15 text-rose-400 border-rose-500/30'
                          : 'bg-slate-800 text-slate-400 border-slate-700'
                      }`}>
                        {ev.argoReturnStatus === 'tepat_waktu'
                          ? 'Tiba Tepat Waktu'
                          : ev.argoReturnStatus === 'terlambat'
                          ? 'Pulang Terlambat'
                          : 'Belum Tiba di Argo'}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center">
                      {ev.isOnTime ? (
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                          ✓ Tepat Waktu
                        </span>
                      ) : (
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/15 text-rose-400 border border-rose-500/30">
                          ! Terlambat ({ev.slaDelayMinutes} mnt)
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <button className="p-1.5 rounded-lg bg-slate-800 hover:bg-amber-500 hover:text-slate-950 text-slate-300 transition cursor-pointer">
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal Rincian Evaluasi Rute */}
      {selectedRouteDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-2xl w-full p-5 sm:p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between gap-4 border-b border-slate-800 pb-3">
              <div>
                <span className="text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/30">
                  Rincian Evaluasi Rute &amp; Ketepatan Waktu
                </span>
                <h3 className="text-base font-black text-white mt-1">
                  {selectedRouteDetail.trackingNumber} — {selectedRouteDetail.destinationStore}
                </h3>
                <p className="text-xs text-slate-400">
                  Tanggal Kirim: {selectedRouteDetail.date}
                </p>
              </div>
              <button
                onClick={() => setSelectedRouteDetail(null)}
                className="px-3 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold cursor-pointer"
              >
                Tutup
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="bg-slate-950 border border-slate-800 rounded-xl p-3">
                <span className="text-[10px] text-slate-400 block">KM Awal Input BBM</span>
                <span className="text-base font-black text-cyan-400 font-mono">
                  {selectedRouteDetail.bbmStartKm.toLocaleString('id-ID')} KM
                </span>
              </div>
              <div className="bg-slate-950 border border-slate-800 rounded-xl p-3">
                <span className="text-[10px] text-slate-400 block">Rata2 Kecepatan</span>
                <span className="text-base font-black text-amber-400 font-mono">
                  {selectedRouteDetail.avgSpeedKmh} KM/H
                </span>
              </div>
              <div className="bg-slate-950 border border-slate-800 rounded-xl p-3">
                <span className="text-[10px] text-slate-400 block">Gate-Out Gudang</span>
                <span className="text-sm font-black text-white font-mono">
                  {selectedRouteDetail.actualGateOutTime}
                </span>
                <span className="text-[10px] text-slate-400 block">
                  Jadwal: {selectedRouteDetail.scheduledDepartureTime}
                </span>
              </div>
              <div className="bg-slate-950 border border-slate-800 rounded-xl p-3">
                <span className="text-[10px] text-slate-400 block">Tiba di Argo</span>
                <span className="text-sm font-black text-emerald-400 font-mono">
                  {selectedRouteDetail.actualArgoReturnTime}
                </span>
                <span className="text-[10px] text-slate-400 block">
                  Target: {selectedRouteDetail.scheduledReturnTime}
                </span>
              </div>
            </div>

            <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-4 space-y-2 text-xs">
              <div className="flex justify-between py-1 border-b border-slate-800/60">
                <span className="text-slate-400">Armada Pengangkut:</span>
                <span className="font-bold text-white font-mono">
                  {selectedRouteDetail.plateNumber} ({selectedRouteDetail.vehicleType})
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-800/60">
                <span className="text-slate-400">Kru Bertugas:</span>
                <span className="font-bold text-white">
                  Driver: {selectedRouteDetail.driverName} | Helper: {selectedRouteDetail.helperName || '-'}
                </span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-slate-400">Status Ketepatan Tim Pengiriman:</span>
                <span className={`font-bold ${selectedRouteDetail.isOnTime ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {selectedRouteDetail.isOnTime
                    ? 'Tepat Waktu (Sesuai Jadwal Gate-Out & Kepulangan Argo)'
                    : `Terlambat (${selectedRouteDetail.slaDelayMinutes} menit dari jadwal)`}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
