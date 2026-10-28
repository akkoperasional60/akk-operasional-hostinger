import React, { useState, useMemo } from 'react';
import {
  BarChart3,
  TrendingUp,
  Gauge,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Truck,
  Users,
  Calendar,
  Search,
  Download,
  Printer,
  RotateCcw,
  MapPin,
  Activity,
  FileText,
  ChevronRight,
  X,
  SlidersHorizontal,
  Navigation,
  Fuel,
  Percent,
  Radio,
  ExternalLink
} from 'lucide-react';
import {
  trackingLogService,
  TimeRangePreset,
  AnalyticsFilterParams
} from '../services/trackingLogService';
import { logisticsStore } from '../services/store';
import {
  FleetPerformanceMetric,
  CrewPerformanceMetric,
  Schedule,
  TrackingLog
} from '../types';

export const AnalyticsReportingModule: React.FC = () => {
  // Filter States
  const [timePreset, setTimePreset] = useState<TimeRangePreset>('all');
  const [customStartDate, setCustomStartDate] = useState<string>('');
  const [customEndDate, setCustomEndDate] = useState<string>('');
  const [selectedFleetId, setSelectedFleetId] = useState<string>('all');
  const [selectedCrewId, setSelectedCrewId] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Active Tab: 'fleet' | 'crew' | 'visuals' | 'raw_logs'
  const [activeTab, setActiveTab] = useState<'fleet' | 'crew' | 'visuals' | 'raw_logs'>('fleet');

  // Detail Modal States
  const [selectedDetailFleet, setSelectedDetailFleet] = useState<FleetPerformanceMetric | null>(null);
  const [selectedDetailCrew, setSelectedDetailCrew] = useState<CrewPerformanceMetric | null>(null);
  const [isPrintModalOpen, setIsPrintModalOpen] = useState<boolean>(false);
  const [isExportDropdownOpen, setIsExportDropdownOpen] = useState<boolean>(false);

  // Available Fleets & Crews from Store
  const fleets = logisticsStore.getFleets();
  const crews = logisticsStore.getCrews();

  // Filter params object
  const filterParams: AnalyticsFilterParams = useMemo(() => ({
    timePreset,
    customStartDate: timePreset === 'custom' ? customStartDate : undefined,
    customEndDate: timePreset === 'custom' ? customEndDate : undefined,
    fleetId: selectedFleetId,
    crewId: selectedCrewId,
    status: selectedStatus,
    searchQuery
  }), [timePreset, customStartDate, customEndDate, selectedFleetId, selectedCrewId, selectedStatus, searchQuery]);

  // Derived Analytics Data
  const summary = useMemo(() => trackingLogService.getOverallSummary(filterParams), [filterParams]);
  const fleetMetrics = useMemo(() => trackingLogService.getFleetPerformance(filterParams), [filterParams]);
  const crewMetrics = useMemo(() => trackingLogService.getCrewPerformance(filterParams), [filterParams]);
  const filteredSchedules = useMemo(() => trackingLogService.filterSchedules(filterParams), [filterParams]);
  const rawTrackingLogs = useMemo(() => {
    const schedIds = new Set(filteredSchedules.map(s => s.id));
    return trackingLogService.getTrackingLogs().filter(l => schedIds.has(l.schedule_id));
  }, [filteredSchedules]);

  // Reset Filters Handler
  const handleResetFilters = () => {
    setTimePreset('all');
    setCustomStartDate('');
    setCustomEndDate('');
    setSelectedFleetId('all');
    setSelectedCrewId('all');
    setSelectedStatus('all');
    setSearchQuery('');
  };

  const isFiltered = timePreset !== 'all' || selectedFleetId !== 'all' || selectedCrewId !== 'all' || selectedStatus !== 'all' || searchQuery.trim() !== '';

  return (
    <div className="p-4 lg:p-8 space-y-6 max-w-7xl mx-auto text-slate-100">
      {/* ========================================================================= */}
      {/* 1. HEADER SECTION                                                         */}
      {/* ========================================================================= */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2 text-xs text-slate-400 mb-1">
            <span>Logistik &amp; Distribusi</span>
            <span aria-hidden="true">&bull;</span>
            <span className="text-amber-400 font-semibold">Telemetri GPS &amp; Penjadwalan</span>
            <span aria-hidden="true">&bull;</span>
            <span>PT AKK Banyuwangi DC</span>
          </div>
          <h1 className="text-xl lg:text-2xl font-black text-white tracking-tight flex items-center gap-2.5">
            <BarChart3 className="w-6 h-6 text-amber-400" />
            <span>Laporan Analitik Performa Armada &amp; Kru</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1 max-w-2xl leading-relaxed">
            Ringkasan terpadu efisiensi rute, total jarak tempuh (km), rata-rata kecepatan, persentase idle time, dan indeks ketepatan waktu pengiriman berdasarkan integrasi data <code className="text-cyan-300 font-mono">schedules</code> dan log telemetri <code className="text-cyan-300 font-mono">tracking_logs</code>.
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0 relative">
          {/* Print / PDF Document Button */}
          <button
            onClick={() => setIsPrintModalOpen(true)}
            className="px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 hover:border-slate-600 text-slate-200 text-xs font-bold transition flex items-center gap-2 cursor-pointer shadow-sm active:scale-95"
            title="Buka Pratinjau Dokumen Cetak / PDF Resmi"
          >
            <Printer className="w-4 h-4 text-cyan-400" />
            <span>Cetak PDF</span>
          </button>

          {/* Export CSV Dropdown */}
          <div className="relative">
            <button
              onClick={() => setIsExportDropdownOpen(!isExportDropdownOpen)}
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 text-slate-950 text-xs font-black transition flex items-center gap-2 cursor-pointer shadow-lg shadow-amber-500/20 active:scale-95"
            >
              <Download className="w-4 h-4 text-slate-950" />
              <span>Ekspor Data</span>
            </button>

            {isExportDropdownOpen && (
              <div className="absolute right-0 mt-2 w-56 bg-slate-900 border border-slate-800 rounded-xl shadow-2xl p-1.5 z-30 animate-in fade-in zoom-in-95 duration-150">
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 px-3 py-1.5">
                  Format Spreadsheet (CSV)
                </div>
                <button
                  onClick={() => {
                    trackingLogService.exportToCsv('fleet', filterParams);
                    setIsExportDropdownOpen(false);
                  }}
                  className="w-full text-left px-3 py-2 text-xs rounded-lg text-slate-200 hover:bg-slate-800 hover:text-amber-400 flex items-center gap-2 transition"
                >
                  <Truck className="w-3.5 h-3.5 text-amber-400" />
                  <span>Performa Armada</span>
                </button>
                <button
                  onClick={() => {
                    trackingLogService.exportToCsv('crew', filterParams);
                    setIsExportDropdownOpen(false);
                  }}
                  className="w-full text-left px-3 py-2 text-xs rounded-lg text-slate-200 hover:bg-slate-800 hover:text-amber-400 flex items-center gap-2 transition"
                >
                  <Users className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Performa Kru Supir</span>
                </button>
                <button
                  onClick={() => {
                    trackingLogService.exportToCsv('schedules', filterParams);
                    setIsExportDropdownOpen(false);
                  }}
                  className="w-full text-left px-3 py-2 text-xs rounded-lg text-slate-200 hover:bg-slate-800 hover:text-amber-400 flex items-center gap-2 transition"
                >
                  <Calendar className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Riwayat Jadwal &amp; GPS</span>
                </button>
                <button
                  onClick={() => {
                    trackingLogService.exportToCsv('raw_tracking_logs', filterParams);
                    setIsExportDropdownOpen(false);
                  }}
                  className="w-full text-left px-3 py-2 text-xs rounded-lg text-slate-200 hover:bg-slate-800 hover:text-amber-400 flex items-center gap-2 transition border-t border-slate-800 mt-1"
                >
                  <Radio className="w-3.5 h-3.5 text-rose-400" />
                  <span>Log Mentah (tracking_logs)</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 2. COMPREHENSIVE FILTER CONTROLS BAR                                      */}
      {/* ========================================================================= */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 space-y-3 shadow-lg">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          {/* Preset Buttons for Time Range */}
          <div className="flex items-center flex-wrap gap-1">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5 mr-2">
              <Calendar className="w-3.5 h-3.5 text-amber-400" />
              <span>Rentang:</span>
            </span>
            {(
              [
                { id: 'all', label: 'Semua Waktu' },
                { id: 'today', label: 'Hari Ini' },
                { id: '7days', label: '7 Hari Terakhir' },
                { id: '30days', label: '30 Hari' },
                { id: 'this_month', label: 'Bulan Ini' },
                { id: 'custom', label: 'Kustom Tanggal' }
              ] as const
            ).map((item) => (
              <button
                key={item.id}
                onClick={() => setTimePreset(item.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                  timePreset === item.id
                    ? 'bg-amber-500 text-slate-950 font-bold shadow-md shadow-amber-500/20'
                    : 'bg-slate-950 text-slate-400 hover:text-slate-200 border border-slate-800 hover:border-slate-700'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>

          {/* Quick Search Input */}
          <div className="relative min-w-[220px]">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari PO, toko, sopir, plat..."
              className="w-full pl-8 pr-3 py-1.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-amber-500 placeholder-slate-500"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-2 text-slate-400 hover:text-white"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>

        {/* Custom Date Pickers (if 'custom' selected) */}
        {timePreset === 'custom' && (
          <div className="flex flex-wrap items-center gap-3 p-3 bg-slate-950 rounded-xl border border-slate-800 animate-in fade-in duration-150">
            <span className="text-xs text-slate-400">Pilih Periode Kustom:</span>
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500">Dari:</span>
              <input
                type="date"
                value={customStartDate}
                onChange={(e) => setCustomStartDate(e.target.value)}
                className="bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1 text-xs text-slate-200 focus:outline-none focus:border-amber-500"
              />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500">Sampai:</span>
              <input
                type="date"
                value={customEndDate}
                onChange={(e) => setCustomEndDate(e.target.value)}
                className="bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1 text-xs text-slate-200 focus:outline-none focus:border-amber-500"
              />
            </div>
          </div>
        )}

        {/* Dropdown Filters: Armada, Kru, Status */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 pt-2 border-t border-slate-800/80">
          {/* Armada Filter */}
          <div>
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
              Filter Armada:
            </label>
            <select
              value={selectedFleetId}
              onChange={(e) => setSelectedFleetId(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-2 text-xs text-slate-200 focus:outline-none focus:border-amber-500"
            >
              <option value="all">Semua Armada ({fleets.length} Unit)</option>
              {fleets.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.plateNumber} {f.initialCode ? `[${f.initialCode}]` : ''} - {f.vehicleType}
                </option>
              ))}
            </select>
          </div>

          {/* Kru Filter */}
          <div>
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
              Filter Kru (Driver / Helper):
            </label>
            <select
              value={selectedCrewId}
              onChange={(e) => setSelectedCrewId(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-2 text-xs text-slate-200 focus:outline-none focus:border-amber-500"
            >
              <option value="all">Semua Kru ({crews.length} Anggota)</option>
              {crews.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.role})
                </option>
              ))}
            </select>
          </div>

          {/* Status Filter */}
          <div>
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
              Status Pengiriman:
            </label>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-2 text-xs text-slate-200 focus:outline-none focus:border-amber-500"
            >
              <option value="all">Semua Status Jadwal</option>
              <option value="delivered">Terkirim / Selesai (Delivered)</option>
              <option value="in_transit">Sedang Jalan (In Transit)</option>
              <option value="scheduled">Terjadwal (Scheduled)</option>
              <option value="delayed">Mengalami Kendala (Delayed)</option>
            </select>
          </div>

          {/* Active Filter Indicators & Reset */}
          <div className="flex items-end">
            <button
              onClick={handleResetFilters}
              disabled={!isFiltered}
              className={`w-full py-2 px-3 rounded-xl border text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                isFiltered
                  ? 'bg-rose-500/15 border-rose-500/40 text-rose-300 hover:bg-rose-500/25 active:scale-95'
                  : 'bg-slate-950 border-slate-800 text-slate-600 cursor-not-allowed'
              }`}
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset Semua Filter</span>
            </button>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 3. CORE TELEMETRY METRIC CARDS (5 HERO METRICS)                           */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
        {/* Metric 1: Total Jarak Tempuh */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 relative overflow-hidden group hover:border-slate-700 transition shadow-md">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider">Total Jarak Tempuh</span>
            <div className="w-8 h-8 rounded-xl bg-cyan-500/15 text-cyan-400 flex items-center justify-center">
              <Navigation className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-white font-mono tracking-tight">
            {summary.totalDistanceKm.toLocaleString('id-ID')} <span className="text-sm font-normal text-slate-400">KM</span>
          </div>
          <div className="mt-2 pt-2 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400">
            <span>Rata2 per Rute:</span>
            <span className="font-mono font-semibold text-cyan-300">
              {summary.totalScheduledDeliveries > 0 ? (summary.totalDistanceKm / summary.totalScheduledDeliveries).toFixed(0) : 0} KM
            </span>
          </div>
        </div>

        {/* Metric 2: Rata-Rata Kecepatan */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 relative overflow-hidden group hover:border-slate-700 transition shadow-md">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider">Rata-Rata Kecepatan</span>
            <div className="w-8 h-8 rounded-xl bg-amber-500/15 text-amber-400 flex items-center justify-center">
              <Gauge className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-white font-mono tracking-tight">
            {summary.avgFleetSpeedKmh} <span className="text-sm font-normal text-slate-400">KM/H</span>
          </div>
          <div className="mt-2 pt-2 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400">
            <span>Kondisi Mesin Bergerak:</span>
            <span className="font-semibold text-amber-300">Normal (30-75 KM/H)</span>
          </div>
        </div>

        {/* Metric 3: Persentase Waktu Idle */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 relative overflow-hidden group hover:border-slate-700 transition shadow-md">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider">Waktu Idle Mesin</span>
            <div className="w-8 h-8 rounded-xl bg-orange-500/15 text-orange-400 flex items-center justify-center">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <div className="text-2xl font-black text-white font-mono tracking-tight">
              {summary.overallIdlePercentage}%
            </div>
            <span className={`text-[10px] font-bold ${summary.overallIdlePercentage < 20 ? 'text-emerald-400' : 'text-rose-400'}`}>
              {summary.overallIdlePercentage < 20 ? 'Efisien' : 'Perlu Evaluasi'}
            </span>
          </div>
          <div className="mt-2 pt-2 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400">
            <span>Ambang Standar:</span>
            <span className="font-mono text-slate-300">&le; 20% Durasi Rute</span>
          </div>
        </div>

        {/* Metric 4: Pengiriman Selesai */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 relative overflow-hidden group hover:border-slate-700 transition shadow-md">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider">Pengiriman Selesai</span>
            <div className="w-8 h-8 rounded-xl bg-emerald-500/15 text-emerald-400 flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-white font-mono tracking-tight">
            {summary.totalCompletedDeliveries} <span className="text-sm font-normal text-slate-400">/ {summary.totalScheduledDeliveries}</span>
          </div>
          <div className="mt-2 pt-2 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400">
            <span>Total Muatan:</span>
            <span className="font-mono font-semibold text-emerald-300">
              {summary.totalCargoTon} Ton
            </span>
          </div>
        </div>

        {/* Metric 5: Data Ketepatan Waktu (On-Time) */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 relative overflow-hidden group hover:border-slate-700 transition shadow-md">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider">Ketepatan Waktu (SLA)</span>
            <div className="w-8 h-8 rounded-xl bg-emerald-500/15 text-emerald-400 flex items-center justify-center">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <div className="text-2xl font-black text-white font-mono tracking-tight">
              {summary.overallOnTimePercentage}%
            </div>
            <span className="text-[10px] font-bold text-emerald-400">On-Time</span>
          </div>
          <div className="mt-2 pt-2 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400">
            <span>Rata2 Waktu Tempuh:</span>
            <span className="font-mono text-slate-300">{summary.averageDeliveryDurationHours} Jam</span>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 4. SEGMENTED TABS: ARMADA vs KRU vs GRAFIK TREN vs RAW LOGS               */}
      {/* ========================================================================= */}
      <div className="flex items-center justify-between flex-wrap gap-3 border-b border-slate-800 pb-2">
        <div className="flex items-center gap-1.5 p-1 bg-slate-900 border border-slate-800 rounded-xl">
          <button
            onClick={() => setActiveTab('fleet')}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
              activeTab === 'fleet'
                ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Truck className="w-3.5 h-3.5" />
            <span>Ringkasan Performa Armada ({fleetMetrics.length})</span>
          </button>
          <button
            onClick={() => setActiveTab('crew')}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
              activeTab === 'crew'
                ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>Ringkasan Performa Kru ({crewMetrics.length})</span>
          </button>
          <button
            onClick={() => setActiveTab('visuals')}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
              activeTab === 'visuals'
                ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Activity className="w-3.5 h-3.5" />
            <span>Grafik &amp; Analisis Komparatif</span>
          </button>
          <button
            onClick={() => setActiveTab('raw_logs')}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
              activeTab === 'raw_logs'
                ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Radio className="w-3.5 h-3.5" />
            <span>Telemetri tracking_logs ({rawTrackingLogs.length})</span>
          </button>
        </div>

        <div className="text-xs text-slate-400 flex items-center gap-2">
          <span>Menampilkan data untuk:</span>
          <span className="font-bold text-white">
            {timePreset === 'all'
              ? 'Seluruh Riwayat'
              : timePreset === 'today'
              ? 'Hari Ini'
              : timePreset === '7days'
              ? '7 Hari Terakhir'
              : timePreset === '30days'
              ? '30 Hari'
              : timePreset === 'this_month'
              ? 'Bulan Berjalan'
              : `${customStartDate || 'Awal'} s/d ${customEndDate || 'Sekarang'}`}
          </span>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: PERFORMA ARMADA TABLE                                              */}
      {/* ========================================================================= */}
      {activeTab === 'fleet' && (
        <div className="space-y-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
            <div className="p-4 border-b border-slate-800 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Truck className="w-4 h-4 text-amber-400" />
                  <span>Metrik Kinerja Armada Kendaraan Operasional</span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Dihitung dari kumulatif titik koordinat GPS pada tabel <code className="text-cyan-300">tracking_logs</code> dan status penugasan <code className="text-cyan-300">schedules</code>.
                </p>
              </div>
              <div className="text-xs text-slate-400">
                Total Armada Terpantau: <strong className="text-white">{fleetMetrics.length} Unit</strong>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-950/80 text-[10px] uppercase font-bold text-slate-400 tracking-wider border-b border-slate-800">
                  <tr>
                    <th className="py-3 px-4">Plat &amp; Inisial</th>
                    <th className="py-3 px-3">Tipe / Merk</th>
                    <th className="py-3 px-3 text-right">Total Jarak</th>
                    <th className="py-3 px-3 text-right">Rata2 Kecepatan</th>
                    <th className="py-3 px-3 text-right">Kecepatan Max</th>
                    <th className="py-3 px-3 text-right">% Waktu Idle</th>
                    <th className="py-3 px-3 text-center">Jadwal Selesai</th>
                    <th className="py-3 px-3 text-right">On-Time Rate</th>
                    <th className="py-3 px-3 text-right">Est. Solar (L)</th>
                    <th className="py-3 px-4 text-center">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/70">
                  {fleetMetrics.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="py-8 text-center text-slate-500">
                        Tidak ada data armada yang memenuhi kriteria filter saat ini.
                      </td>
                    </tr>
                  ) : (
                    fleetMetrics.map((fm, idx) => (
                      <tr key={fm.fleetId} className="hover:bg-slate-800/40 transition">
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-2.5">
                            <span className="w-5 h-5 rounded-md bg-slate-950 border border-slate-800 text-[10px] font-mono font-bold flex items-center justify-center text-slate-400">
                              {idx + 1}
                            </span>
                            <div>
                              <div className="font-mono font-bold text-white text-xs flex items-center gap-1.5">
                                <span>{fm.plateNumber}</span>
                                {fm.initialCode && fm.initialCode !== '-' && (
                                  <span className="text-[10px] text-amber-400 font-sans">[{fm.initialCode}]</span>
                                )}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="py-3.5 px-3">
                          <div className="text-slate-200 font-medium">{fm.vehicleType}</div>
                          <div className="text-[10px] text-slate-400">{fm.brand}</div>
                        </td>
                        <td className="py-3.5 px-3 text-right font-mono font-bold text-cyan-300">
                          {fm.totalDistanceKm.toLocaleString('id-ID')} km
                        </td>
                        <td className="py-3.5 px-3 text-right font-mono text-slate-200">
                          {fm.avgSpeedKmh} km/h
                        </td>
                        <td className="py-3.5 px-3 text-right font-mono text-slate-400">
                          {fm.maxSpeedKmh} km/h
                        </td>
                        <td className="py-3.5 px-3 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <span className={`font-mono font-bold ${fm.idlePercentage > 25 ? 'text-rose-400' : fm.idlePercentage > 15 ? 'text-amber-400' : 'text-emerald-400'}`}>
                              {fm.idlePercentage}%
                            </span>
                            <span className="text-[10px] text-slate-500">({fm.idleTimeMinutes}m)</span>
                          </div>
                        </td>
                        <td className="py-3.5 px-3 text-center">
                          <span className="font-mono font-bold text-white">{fm.completedDeliveries}</span>
                          <span className="text-slate-500"> / {fm.totalSchedules}</span>
                        </td>
                        <td className="py-3.5 px-3 text-right">
                          <div className="inline-flex items-center gap-1 font-mono font-bold text-emerald-400">
                            <span>{fm.onTimePercentage}%</span>
                          </div>
                          {fm.avgDelayMinutes > 0 && (
                            <div className="text-[10px] text-rose-400">+{fm.avgDelayMinutes}m telat</div>
                          )}
                        </td>
                        <td className="py-3.5 px-3 text-right font-mono text-slate-300">
                          {fm.fuelUsedEstimatedLiters} L
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          <button
                            onClick={() => setSelectedDetailFleet(fm)}
                            className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-amber-300 text-[11px] font-bold border border-slate-700 hover:border-amber-500/50 transition cursor-pointer"
                          >
                            Rincian
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: PERFORMA KRU SUPIR & HELPER TABLE                                  */}
      {/* ========================================================================= */}
      {activeTab === 'crew' && (
        <div className="space-y-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
            <div className="p-4 border-b border-slate-800 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Users className="w-4 h-4 text-cyan-400" />
                  <span>Metrik Kinerja &amp; Ketepatan Waktu Kru Supir</span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Evaluasi jarak jelajah, rata-rata kecepatan, persentase idle time, dan skor kepatuhan jadwal kedatangan retail.
                </p>
              </div>
              <div className="text-xs text-slate-400">
                Total Kru Terdaftar: <strong className="text-white">{crewMetrics.length} Personel</strong>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-950/80 text-[10px] uppercase font-bold text-slate-400 tracking-wider border-b border-slate-800">
                  <tr>
                    <th className="py-3 px-4">Nama Kru &amp; Kontak</th>
                    <th className="py-3 px-3">Peran / Jabatan</th>
                    <th className="py-3 px-3 text-center">Rating</th>
                    <th className="py-3 px-3 text-right">Total Jarak (KM)</th>
                    <th className="py-3 px-3 text-right">Rata2 Kecepatan</th>
                    <th className="py-3 px-3 text-right">% Waktu Idle</th>
                    <th className="py-3 px-3 text-center">Selesai / Tugas</th>
                    <th className="py-3 px-3 text-right">Ketepatan (On-Time)</th>
                    <th className="py-3 px-3 text-center">Skor Disiplin</th>
                    <th className="py-3 px-3">Rute Dominan</th>
                    <th className="py-3 px-4 text-center">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/70">
                  {crewMetrics.length === 0 ? (
                    <tr>
                      <td colSpan={11} className="py-8 text-center text-slate-500">
                        Tidak ada data kru yang memenuhi kriteria filter saat ini.
                      </td>
                    </tr>
                  ) : (
                    crewMetrics.map((cm, idx) => (
                      <tr key={cm.crewId} className="hover:bg-slate-800/40 transition">
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-2.5">
                            <span className="w-5 h-5 rounded-md bg-slate-950 border border-slate-800 text-[10px] font-mono font-bold flex items-center justify-center text-slate-400">
                              {idx + 1}
                            </span>
                            <div>
                              <div className="font-bold text-white text-xs">{cm.name}</div>
                              <div className="text-[10px] text-slate-400 font-mono">{cm.phone}</div>
                            </div>
                          </div>
                        </td>
                        <td className="py-3.5 px-3">
                          <span className={`text-[11px] font-semibold ${
                            cm.role.includes('Utama') ? 'text-amber-300' : cm.role.includes('Cadangan') ? 'text-blue-300' : 'text-slate-300'
                          }`}>
                            {cm.role}
                          </span>
                        </td>
                        <td className="py-3.5 px-3 text-center font-bold text-amber-400">
                          ⭐ {cm.rating.toFixed(1)}
                        </td>
                        <td className="py-3.5 px-3 text-right font-mono font-bold text-cyan-300">
                          {cm.totalDistanceKm.toLocaleString('id-ID')} km
                        </td>
                        <td className="py-3.5 px-3 text-right font-mono text-slate-200">
                          {cm.avgSpeedKmh} km/h
                        </td>
                        <td className="py-3.5 px-3 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <span className={`font-mono font-bold ${cm.idlePercentage > 25 ? 'text-rose-400' : 'text-emerald-400'}`}>
                              {cm.idlePercentage}%
                            </span>
                          </div>
                        </td>
                        <td className="py-3.5 px-3 text-center">
                          <span className="font-mono font-bold text-white">{cm.completedDeliveries}</span>
                          <span className="text-slate-500"> / {cm.totalSchedules}</span>
                        </td>
                        <td className="py-3.5 px-3 text-right">
                          <span className="font-mono font-bold text-emerald-400">
                            {cm.onTimePercentage}%
                          </span>
                        </td>
                        <td className="py-3.5 px-3 text-center">
                          <div className="inline-flex items-center justify-center px-2 py-0.5 rounded-md font-mono font-black text-[11px] bg-slate-950 border border-slate-700 text-white">
                            {cm.punctualityScore}/100
                          </div>
                        </td>
                        <td className="py-3.5 px-3 text-slate-300 truncate max-w-[140px]" title={cm.topDestinationArea}>
                          {cm.topDestinationArea}
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          <button
                            onClick={() => setSelectedDetailCrew(cm)}
                            className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-cyan-300 text-[11px] font-bold border border-slate-700 hover:border-cyan-500/50 transition cursor-pointer"
                          >
                            Rincian
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: VISUAL CHARTS & COMPARATIVE METRICS                                 */}
      {/* ========================================================================= */}
      {activeTab === 'visuals' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Chart 1: Perbandingan Jarak Tempuh Armada */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Navigation className="w-4 h-4 text-cyan-400" />
                <span>Peringkat Jarak Tempuh per Armada (KM)</span>
              </h3>
              <span className="text-xs text-slate-400 font-mono">Top Unit</span>
            </div>

            <div className="space-y-3 pt-2">
              {fleetMetrics.slice(0, 7).map((fm) => {
                const maxKm = Math.max(...fleetMetrics.map(f => f.totalDistanceKm), 1);
                const percent = Math.min(100, Math.round((fm.totalDistanceKm / maxKm) * 100));

                return (
                  <div key={fm.fleetId} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-mono font-bold text-slate-200">
                        {fm.plateNumber} <span className="text-slate-400 font-sans text-[11px]">({fm.vehicleType})</span>
                      </span>
                      <span className="font-mono font-bold text-cyan-300">
                        {fm.totalDistanceKm} KM
                      </span>
                    </div>
                    <div className="w-full bg-slate-950 h-2.5 rounded-full overflow-hidden border border-slate-800">
                      <div
                        className="bg-gradient-to-r from-cyan-500 to-blue-500 h-full rounded-full transition-all duration-500"
                        style={{ width: `${percent}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Chart 2: Analisis Waktu Idle & Efisiensi Bahan Bakar */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Clock className="w-4 h-4 text-orange-400" />
                <span>Persentase Idle Time per Armada (%)</span>
              </h3>
              <span className="text-xs text-slate-400">Batas Aman &le; 20%</span>
            </div>

            <div className="space-y-3 pt-2">
              {fleetMetrics.slice(0, 7).map((fm) => {
                const isOver = fm.idlePercentage > 20;
                return (
                  <div key={fm.fleetId} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-mono font-bold text-slate-200">
                        {fm.plateNumber}
                      </span>
                      <span className={`font-mono font-bold ${isOver ? 'text-rose-400' : 'text-emerald-400'}`}>
                        {fm.idlePercentage}% ({fm.idleTimeMinutes} Menit)
                      </span>
                    </div>
                    <div className="w-full bg-slate-950 h-2.5 rounded-full overflow-hidden border border-slate-800">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${
                          isOver ? 'bg-gradient-to-r from-amber-500 to-rose-500' : 'bg-gradient-to-r from-emerald-500 to-teal-400'
                        }`}
                        style={{ width: `${Math.min(100, fm.idlePercentage * 2.5)}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Chart 3: Distribusi Status Ketepatan Waktu Pengiriman */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4 lg:col-span-2">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-emerald-400" />
              <span>Ringkasan SLA &amp; Kepatuhan Jam Pengiriman (On-Time Performance)</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
              <div className="bg-slate-950 p-4 rounded-xl border border-emerald-500/30 text-center">
                <div className="text-xs text-slate-400 font-bold uppercase mb-1">Pengiriman Tepat Waktu (On-Time)</div>
                <div className="text-3xl font-black text-emerald-400 font-mono">
                  {summary.overallOnTimePercentage}%
                </div>
                <div className="text-[11px] text-slate-400 mt-1">
                  {summary.totalCompletedDeliveries} kiriman terkonfirmasi sampai sebelum batas SLA
                </div>
              </div>

              <div className="bg-slate-950 p-4 rounded-xl border border-amber-500/30 text-center">
                <div className="text-xs text-slate-400 font-bold uppercase mb-1">Total Kiriman Dalam Perjalanan</div>
                <div className="text-3xl font-black text-amber-400 font-mono">
                  {summary.totalScheduledDeliveries - summary.totalCompletedDeliveries}
                </div>
                <div className="text-[11px] text-slate-400 mt-1">
                  Armada sedang bergerak aktif di jalur distribusi
                </div>
              </div>

              <div className="bg-slate-950 p-4 rounded-xl border border-cyan-500/30 text-center">
                <div className="text-xs text-slate-400 font-bold uppercase mb-1">Rata2 Durasi Pengiriman</div>
                <div className="text-3xl font-black text-cyan-400 font-mono">
                  {summary.averageDeliveryDurationHours} Jam
                </div>
                <div className="text-[11px] text-slate-400 mt-1">
                  Waktu tempuh dari DC Banyuwangi hingga bongkar muatan
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 4: RAW TRACKING_LOGS TELEMETRY EXPLORER                                */}
      {/* ========================================================================= */}
      {activeTab === 'raw_logs' && (
        <div className="space-y-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
            <div className="p-4 border-b border-slate-800 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Radio className="w-4 h-4 text-rose-400" />
                  <span>Log Telemetri GPS Langsung (<code className="text-cyan-300">tracking_logs</code>)</span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Menampilkan rekaman log mentah dengan koordinat latitude, longitude, kecepatan, dan status mesin kendaraan.
                </p>
              </div>
              <div className="text-xs text-slate-400 font-mono">
                {rawTrackingLogs.length} Titik GPS Tersimpan
              </div>
            </div>

            <div className="overflow-x-auto max-h-[550px]">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-950/95 sticky top-0 z-10 text-[10px] uppercase font-bold text-slate-400 tracking-wider border-b border-slate-800">
                  <tr>
                    <th className="py-2.5 px-3">Log ID</th>
                    <th className="py-2.5 px-3">ID Jadwal (Schedule)</th>
                    <th className="py-2.5 px-3">Waktu (Timestamp)</th>
                    <th className="py-2.5 px-3">Koordinat (Lat, Lng)</th>
                    <th className="py-2.5 px-3 text-right">Kecepatan</th>
                    <th className="py-2.5 px-3 text-center">Status Mesin</th>
                    <th className="py-2.5 px-4">Nama Lokasi / Waypoint</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/70 font-mono">
                  {rawTrackingLogs.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-slate-500 font-sans">
                        Tidak ada log telemetri yang tersedia untuk jadwal yang dipilih.
                      </td>
                    </tr>
                  ) : (
                    rawTrackingLogs.slice(0, 100).map((log) => (
                      <tr key={log.id} className="hover:bg-slate-800/40 transition">
                        <td className="py-2 px-3 text-slate-400 text-[11px] truncate max-w-[100px]" title={log.id}>
                          {log.id}
                        </td>
                        <td className="py-2 px-3 text-cyan-400 text-[11px] font-bold">
                          {log.schedule_id}
                        </td>
                        <td className="py-2 px-3 text-slate-300 text-[11px]">
                          {new Date(log.timestamp).toLocaleString('id-ID', {
                            dateStyle: 'short',
                            timeStyle: 'medium'
                          })}
                        </td>
                        <td className="py-2 px-3 text-slate-400 text-[11px]">
                          {log.latitude.toFixed(5)}, {log.longitude.toFixed(5)}
                        </td>
                        <td className="py-2 px-3 text-right text-slate-200 font-bold">
                          {log.speed} km/h
                        </td>
                        <td className="py-2 px-3 text-center">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              log.engine_status === 'RUNNING'
                                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                                : log.engine_status === 'IDLE'
                                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                                : 'bg-slate-800 text-slate-400 border border-slate-700'
                            }`}
                          >
                            {log.engine_status}
                          </span>
                        </td>
                        <td className="py-2 px-4 text-slate-300 font-sans text-[11px] truncate max-w-[200px]" title={log.location_name}>
                          {log.location_name || '-'}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {rawTrackingLogs.length > 100 && (
              <div className="p-3 bg-slate-950 border-t border-slate-800 text-center text-xs text-slate-400">
                Menampilkan 100 log terbaru dari total {rawTrackingLogs.length} titik GPS. Gunakan tombol "Ekspor Data" di atas untuk mengunduh seluruh rekaman ke CSV.
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 5. DRILL-DOWN MODAL: RINCIAN PERFORMA ARMADA                              */}
      {/* ========================================================================= */}
      {selectedDetailFleet && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
            {/* Modal Header */}
            <div className="p-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center font-bold">
                  <Truck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-white flex items-center gap-2">
                    <span>{selectedDetailFleet.plateNumber}</span>
                    <span className="text-xs text-amber-400 font-sans font-bold">
                      [{selectedDetailFleet.initialCode}]
                    </span>
                  </h3>
                  <p className="text-xs text-slate-400">
                    {selectedDetailFleet.vehicleType} &bull; {selectedDetailFleet.brand}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedDetailFleet(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body: Metrics Grid */}
            <div className="p-5 space-y-4 overflow-y-auto">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                  <span className="text-[10px] text-slate-400 uppercase font-bold block">Total Jarak</span>
                  <span className="text-lg font-black text-cyan-300 font-mono">
                    {selectedDetailFleet.totalDistanceKm} KM
                  </span>
                </div>
                <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                  <span className="text-[10px] text-slate-400 uppercase font-bold block">Rata2 Kecepatan</span>
                  <span className="text-lg font-black text-white font-mono">
                    {selectedDetailFleet.avgSpeedKmh} KM/H
                  </span>
                </div>
                <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                  <span className="text-[10px] text-slate-400 uppercase font-bold block">Persentase Idle</span>
                  <span className="text-lg font-black text-amber-400 font-mono">
                    {selectedDetailFleet.idlePercentage}%
                  </span>
                </div>
                <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                  <span className="text-[10px] text-slate-400 uppercase font-bold block">Ketepatan On-Time</span>
                  <span className="text-lg font-black text-emerald-400 font-mono">
                    {selectedDetailFleet.onTimePercentage}%
                  </span>
                </div>
              </div>

              {/* Schedules Table for this fleet */}
              <div className="space-y-2">
                <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                  Riwayat Jadwal Penugasan Armada ({selectedDetailFleet.totalSchedules} Jadwal):
                </h4>
                <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                  {filteredSchedules
                    .filter(s => s.fleetId === selectedDetailFleet.fleetId)
                    .map(sch => {
                      const gps = trackingLogService.calculateScheduleGpsMetrics(sch.id);
                      return (
                        <div key={sch.id} className="p-3 bg-slate-950 rounded-xl border border-slate-800 flex items-center justify-between text-xs">
                          <div>
                            <div className="font-mono font-bold text-white flex items-center gap-2">
                              <span>{sch.trackingNumber}</span>
                              <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                sch.status === 'delivered' ? 'bg-emerald-500/20 text-emerald-300' : 'bg-amber-500/20 text-amber-300'
                              }`}>
                                {sch.status}
                              </span>
                            </div>
                            <div className="text-slate-400 text-[11px] mt-0.5">
                              Tujuan: {sch.store?.storeName || sch.areaName} ({sch.store?.city || 'Jawa Timur'})
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="font-mono font-bold text-cyan-300">
                              {gps.totalDistanceKm} KM
                            </div>
                            <div className="text-[10px] text-slate-400">
                              Idle: {gps.idleMinutes}m &bull; Avg: {gps.avgSpeedKmh} km/h
                            </div>
                          </div>
                        </div>
                      );
                    })}
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-slate-950 border-t border-slate-800 flex justify-end">
              <button
                onClick={() => setSelectedDetailFleet(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold transition cursor-pointer"
              >
                Tutup Pratinjau
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 6. DRILL-DOWN MODAL: RINCIAN PERFORMA KRU                                 */}
      {/* ========================================================================= */}
      {selectedDetailCrew && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
            {/* Modal Header */}
            <div className="p-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-cyan-500/20 text-cyan-400 flex items-center justify-center font-bold">
                  <Users className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-white">
                    {selectedDetailCrew.name}
                  </h3>
                  <p className="text-xs text-slate-400">
                    {selectedDetailCrew.role} &bull; {selectedDetailCrew.phone} &bull; Rating ⭐ {selectedDetailCrew.rating}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedDetailCrew(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 space-y-4 overflow-y-auto">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                  <span className="text-[10px] text-slate-400 uppercase font-bold block">Total Jarak</span>
                  <span className="text-lg font-black text-cyan-300 font-mono">
                    {selectedDetailCrew.totalDistanceKm} KM
                  </span>
                </div>
                <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                  <span className="text-[10px] text-slate-400 uppercase font-bold block">Kecepatan Rata2</span>
                  <span className="text-lg font-black text-white font-mono">
                    {selectedDetailCrew.avgSpeedKmh} KM/H
                  </span>
                </div>
                <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                  <span className="text-[10px] text-slate-400 uppercase font-bold block">Skor Disiplin</span>
                  <span className="text-lg font-black text-amber-400 font-mono">
                    {selectedDetailCrew.punctualityScore}/100
                  </span>
                </div>
                <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                  <span className="text-[10px] text-slate-400 uppercase font-bold block">Ketepatan Waktu</span>
                  <span className="text-lg font-black text-emerald-400 font-mono">
                    {selectedDetailCrew.onTimePercentage}%
                  </span>
                </div>
              </div>

              {/* Schedules Table for this crew */}
              <div className="space-y-2">
                <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                  Daftar Penugasan Pengiriman ({selectedDetailCrew.totalSchedules} Tugas):
                </h4>
                <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                  {filteredSchedules
                    .filter(s => s.crewId === selectedDetailCrew.crewId || s.crewHelperId === selectedDetailCrew.crewId || s.crewHelper2Id === selectedDetailCrew.crewId)
                    .map(sch => (
                      <div key={sch.id} className="p-3 bg-slate-950 rounded-xl border border-slate-800 flex items-center justify-between text-xs">
                        <div>
                          <div className="font-mono font-bold text-white flex items-center gap-2">
                            <span>{sch.trackingNumber}</span>
                            <span className="text-slate-400 font-sans">[{sch.fleet?.plateNumber || 'Armada'}]</span>
                          </div>
                          <div className="text-slate-400 text-[11px] mt-0.5">
                            {sch.store?.storeName || sch.areaName} ({sch.cargoWeightTon} Ton)
                          </div>
                        </div>
                        <div className="text-right">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            sch.status === 'delivered' ? 'bg-emerald-500/20 text-emerald-300' : 'bg-amber-500/20 text-amber-300'
                          }`}>
                            {sch.status}
                          </span>
                          <div className="text-[10px] text-slate-400 mt-1">
                            {new Date(sch.departureDate).toLocaleDateString('id-ID')}
                          </div>
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-slate-950 border-t border-slate-800 flex justify-end">
              <button
                onClick={() => setSelectedDetailCrew(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold transition cursor-pointer"
              >
                Tutup Pratinjau
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 7. PRINTABLE / PDF REPORT MODAL VIEW                                      */}
      {/* ========================================================================= */}
      {isPrintModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white text-slate-950 rounded-2xl w-full max-w-4xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden print:m-0 print:p-0">
            {/* Modal Action Bar (Hidden on actual print) */}
            <div className="p-4 bg-slate-100 border-b border-slate-200 flex items-center justify-between print:hidden">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-700">
                <Printer className="w-4 h-4 text-slate-900" />
                <span>Pratinjau Cetak Dokumen Eksekutif</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => window.print()}
                  className="px-4 py-2 rounded-xl bg-slate-950 text-white text-xs font-bold hover:bg-slate-800 transition flex items-center gap-1.5 cursor-pointer"
                >
                  <Printer className="w-4 h-4" />
                  <span>Cetak Sekarang (Print)</span>
                </button>
                <button
                  onClick={() => setIsPrintModalOpen(false)}
                  className="p-1.5 rounded-lg text-slate-500 hover:text-slate-950 hover:bg-slate-200 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Document Layout */}
            <div className="p-8 space-y-6 overflow-y-auto font-sans">
              {/* Document Header Letterhead */}
              <div className="border-b-2 border-slate-900 pb-4 flex items-center justify-between">
                <div>
                  <h1 className="text-xl font-black tracking-tight text-slate-950">
                    PT ANUGRAH KEMASAN KREATIF
                  </h1>
                  <p className="text-xs text-slate-600">
                    Gudang Pusat Banyuwangi DC: Jl. Argopuro No.60, Sukowidi, Banyuwangi
                  </p>
                  <p className="text-xs font-bold text-slate-800 mt-1 uppercase tracking-wider">
                    LAPORAN ANALITIK KINERJA ARMADA &amp; KRU LOGISTIK
                  </p>
                </div>
                <div className="text-right text-xs text-slate-600">
                  <div>Tanggal Cetak: <strong>{new Date().toLocaleDateString('id-ID', { dateStyle: 'full' })}</strong></div>
                  <div>Status Dokumen: <strong className="text-emerald-700">Resmi Operasional</strong></div>
                </div>
              </div>

              {/* Summary Stats Table */}
              <div className="grid grid-cols-5 gap-3 text-center border border-slate-300 rounded-xl p-3 bg-slate-50">
                <div>
                  <div className="text-[10px] uppercase font-bold text-slate-500">Total Jarak</div>
                  <div className="text-base font-black text-slate-950 font-mono">{summary.totalDistanceKm} KM</div>
                </div>
                <div>
                  <div className="text-[10px] uppercase font-bold text-slate-500">Rata2 Kecepatan</div>
                  <div className="text-base font-black text-slate-950 font-mono">{summary.avgFleetSpeedKmh} KM/H</div>
                </div>
                <div>
                  <div className="text-[10px] uppercase font-bold text-slate-500">Idle Time</div>
                  <div className="text-base font-black text-slate-950 font-mono">{summary.overallIdlePercentage}%</div>
                </div>
                <div>
                  <div className="text-[10px] uppercase font-bold text-slate-500">Pengiriman Selesai</div>
                  <div className="text-base font-black text-slate-950 font-mono">{summary.totalCompletedDeliveries} / {summary.totalScheduledDeliveries}</div>
                </div>
                <div>
                  <div className="text-[10px] uppercase font-bold text-slate-500">Ketepatan (On-Time)</div>
                  <div className="text-base font-black text-emerald-700 font-mono">{summary.overallOnTimePercentage}%</div>
                </div>
              </div>

              {/* Fleet Table */}
              <div className="space-y-2">
                <h3 className="text-xs font-black uppercase text-slate-900 border-b border-slate-300 pb-1">
                  1. Ringkasan Kinerja Armada Kendaraan
                </h3>
                <table className="w-full text-left text-[11px] border-collapse">
                  <thead>
                    <tr className="border-b border-slate-400 bg-slate-100 text-slate-700">
                      <th className="p-1.5">No</th>
                      <th className="p-1.5">Plat Nomor</th>
                      <th className="p-1.5">Tipe Armada</th>
                      <th className="p-1.5 text-right">Total KM</th>
                      <th className="p-1.5 text-right">Rata2 Kecepatan</th>
                      <th className="p-1.5 text-right">% Idle</th>
                      <th className="p-1.5 text-center">Selesai</th>
                      <th className="p-1.5 text-right">On-Time</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {fleetMetrics.map((fm, i) => (
                      <tr key={fm.fleetId}>
                        <td className="p-1.5">{i + 1}</td>
                        <td className="p-1.5 font-bold font-mono">{fm.plateNumber} [{fm.initialCode}]</td>
                        <td className="p-1.5">{fm.vehicleType}</td>
                        <td className="p-1.5 text-right font-mono">{fm.totalDistanceKm} km</td>
                        <td className="p-1.5 text-right font-mono">{fm.avgSpeedKmh} km/h</td>
                        <td className="p-1.5 text-right font-mono">{fm.idlePercentage}%</td>
                        <td className="p-1.5 text-center font-mono">{fm.completedDeliveries}</td>
                        <td className="p-1.5 text-right font-mono font-bold text-emerald-800">{fm.onTimePercentage}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Signatures */}
              <div className="grid grid-cols-2 pt-8 text-center text-xs">
                <div>
                  <p className="text-slate-500">Dibuat Oleh:</p>
                  <p className="font-bold text-slate-900 mt-12 underline">SPV Logistik &amp; Distribusi</p>
                  <p className="text-[10px] text-slate-500">PT Anugrah Kemasan Kreatif</p>
                </div>
                <div>
                  <p className="text-slate-500">Mengetahui &amp; Menyetujui:</p>
                  <p className="font-bold text-slate-900 mt-12 underline">Head of Operations (AKK DC)</p>
                  <p className="text-[10px] text-slate-500">Bambang Sudiro, S.T.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
