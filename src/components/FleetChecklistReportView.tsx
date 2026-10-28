import React, { useState, useEffect, useMemo } from 'react';
import {
  ShieldCheck,
  Truck,
  User,
  Calendar,
  AlertTriangle,
  CheckCircle2,
  Wrench,
  Search,
  Filter,
  FileSpreadsheet,
  RefreshCw,
  Eye,
  Clock,
  Gauge,
  Fuel,
  Info,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  BookOpen,
  Sparkles,
  AlertOctagon,
  X,
  FileText
} from 'lucide-react';
import { DriverVehicleChecklist, VehicleChecklistItem } from '../types';
import { driverChecklistService } from '../services/driverChecklistService';
import { MAINTENANCE_COMPONENT_RULES, getMaintenanceRuleForItem, MaintenanceComponentRule } from '../services/maintenanceGuidanceService';
import { logisticsStore } from '../services/store';
import { useToast } from '../context/ToastContext';

interface FleetChecklistReportViewProps {
  onBackToOperationalReports?: () => void;
}

export const FleetChecklistReportView: React.FC<FleetChecklistReportViewProps> = ({
  onBackToOperationalReports
}) => {
  const { addNotification } = useToast();
  const [checklists, setChecklists] = useState<DriverVehicleChecklist[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'passed' | 'warning' | 'failed'>('all');
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [fleetFilter, setFleetFilter] = useState<string>('all');
  const [selectedChecklistModal, setSelectedChecklistModal] = useState<DriverVehicleChecklist | null>(null);
  const [showCatalogModal, setShowCatalogModal] = useState(false);
  const [catalogCategory, setCatalogCategory] = useState<string>('all');
  const [minimizedDirectives, setMinimizedDirectives] = useState<Record<string, boolean>>({});
  const [expandedFleetGroups, setExpandedFleetGroups] = useState<Record<string, boolean>>({});

  const allMasterFleets = useMemo(() => logisticsStore.getFleets(), [checklists]);

  const loadChecklists = () => {
    const list = driverChecklistService.getChecklists();
    setChecklists(list);
  };

  useEffect(() => {
    loadChecklists();
  }, []);

  // Unique fleets in checklists enriched with initialCode / Nama Armada
  const uniqueFleets = useMemo(() => {
    const map = new Map<string, { plate: string; type: string; initialCode: string; count: number }>();
    checklists.forEach(c => {
      const matched = allMasterFleets.find(f => f.plateNumber.toLowerCase() === c.plateNumber.toLowerCase());
      const existing = map.get(c.plateNumber);
      if (existing) {
        existing.count += 1;
      } else {
        map.set(c.plateNumber, {
          plate: c.plateNumber,
          type: matched?.vehicleType || c.vehicleType,
          initialCode: matched?.initialCode || '',
          count: 1
        });
      }
    });
    return Array.from(map.values());
  }, [checklists, allMasterFleets]);

  // Filtered checklists
  const filteredChecklists = useMemo(() => {
    return checklists.filter(c => {
      if (statusFilter !== 'all' && c.overallStatus !== statusFilter) return false;
      if (fleetFilter !== 'all' && c.plateNumber !== fleetFilter) return false;
      if (selectedDate && c.date !== selectedDate) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matched = allMasterFleets.find(f => f.plateNumber.toLowerCase() === c.plateNumber.toLowerCase());
        const matchDriver = c.driverName.toLowerCase().includes(q);
        const matchPlate = c.plateNumber.toLowerCase().includes(q);
        const matchInitial = matched?.initialCode ? matched.initialCode.toLowerCase().includes(q) : false;
        const matchNotes = c.notes ? c.notes.toLowerCase().includes(q) : false;
        const matchType = c.vehicleType.toLowerCase().includes(q);
        return matchDriver || matchPlate || matchInitial || matchNotes || matchType;
      }
      return true;
    });
  }, [checklists, statusFilter, fleetFilter, selectedDate, searchQuery, allMasterFleets]);

  // Pengelompokan Laporan Checklist Per Nama Armada (Tidak Jadi Satu / Tidak Tercampur)
  const groupedChecklistsByFleet = useMemo(() => {
    const groupMap = new Map<
      string,
      {
        plateNumber: string;
        vehicleType: string;
        initialCode: string;
        brand: string;
        items: DriverVehicleChecklist[];
        passedCount: number;
        warningCount: number;
        failedCount: number;
        latestCheck: DriverVehicleChecklist;
      }
    >();

    filteredChecklists.forEach(chk => {
      const key = chk.plateNumber.trim();
      const matched = allMasterFleets.find(f => f.plateNumber.toLowerCase() === key.toLowerCase());
      const current = groupMap.get(key);
      if (current) {
        current.items.push(chk);
        if (chk.overallStatus === 'passed') current.passedCount += 1;
        else if (chk.overallStatus === 'warning') current.warningCount += 1;
        else if (chk.overallStatus === 'failed') current.failedCount += 1;
      } else {
        groupMap.set(key, {
          plateNumber: key,
          vehicleType: matched?.vehicleType || chk.vehicleType,
          initialCode: matched?.initialCode || '',
          brand: matched?.brand || '',
          items: [chk],
          passedCount: chk.overallStatus === 'passed' ? 1 : 0,
          warningCount: chk.overallStatus === 'warning' ? 1 : 0,
          failedCount: chk.overallStatus === 'failed' ? 1 : 0,
          latestCheck: chk
        });
      }
    });

    return Array.from(groupMap.values());
  }, [filteredChecklists, allMasterFleets]);

  // KPI Statistics
  const totalCount = checklists.length;
  const passedCount = checklists.filter(c => c.overallStatus === 'passed').length;
  const warningCount = checklists.filter(c => c.overallStatus === 'warning').length;
  const failedCount = checklists.filter(c => c.overallStatus === 'failed').length;

  const handleExportCsv = () => {
    if (filteredChecklists.length === 0) return;

    const headers = ['ID Checklist', 'Tanggal', 'Jam', 'Nama Armada / Plat', 'Inisial Armada', 'Tipe Armada', 'Nama Driver', 'Odometer (KM)', 'Status Kelayakan', 'Poin Lolos', 'Poin Kendala', 'Catatan'];
    const rows = filteredChecklists.map(c => {
      const matched = allMasterFleets.find(f => f.plateNumber.toLowerCase() === c.plateNumber.toLowerCase());
      return [
        c.id,
        c.date,
        c.time,
        c.plateNumber,
        `"${matched?.initialCode || '-'}"`,
        `"${c.vehicleType}"`,
        `"${c.driverName}"`,
        c.odometerKm,
        c.overallStatus === 'passed' ? 'Lolos (Aman)' : c.overallStatus === 'warning' ? 'Perlu Servis' : 'Kritis (Dilarang Jalan)',
        c.passedCount,
        c.issueCount,
        `"${(c.notes || '-').replace(/"/g, '""')}"`
      ];
    });

    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Laporan_Checklist_Per_Armada_AKK_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    addNotification('schedule', 'Export Selesai', 'Data laporan checklist per armada berhasil diekspor ke format CSV.');
  };

  return (
    <div className="space-y-5 animate-in fade-in duration-200">
      
      {/* Top Banner & Title */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 rounded-2xl shadow-xs">
        <div className="flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-blue-50 dark:bg-blue-500/15 border border-blue-200 dark:border-blue-500/30 flex items-center justify-center text-blue-600 dark:text-blue-400 shrink-0">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-white tracking-tight">
                Laporan Checklist Pemeriksaan Per Armada
              </h2>
              <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-blue-50 dark:bg-blue-500/20 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-500/30 font-bold">
                Ringkas Per Armada
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Klik pada kartu armada di bawah untuk membuka rincian 23 poin pemeriksaan kendaraan.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setShowCatalogModal(true)}
            className="px-3.5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs flex items-center gap-1.5 transition cursor-pointer shadow-sm active:scale-95"
            title="Buka panduan standar interval servis & tindakan darurat"
          >
            <BookOpen className="w-4 h-4 text-white" />
            <span>Katalog &amp; Aturan Servis</span>
          </button>

          <button
            onClick={loadChecklists}
            className="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition cursor-pointer border border-slate-200 dark:border-slate-700"
            title="Muat Ulang Data"
          >
            <RefreshCw className="w-4 h-4" />
          </button>

          <button
            onClick={handleExportCsv}
            className="px-3.5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-1.5 transition cursor-pointer shadow-sm active:scale-95"
            title="Unduh laporan checklist ke CSV / Excel"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>Ekspor CSV</span>
          </button>
        </div>
      </div>

      {/* KPI Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-600 dark:text-slate-400">Total Inspeksi Selesai</span>
            <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/20 flex items-center justify-center text-blue-600 dark:text-blue-400">
              <FileText className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-slate-900 dark:text-white mt-2 font-mono">{totalCount}</div>
          <div className="text-[11px] text-slate-500 mt-1">Pemeriksaan pre/post trip ({uniqueFleets.length} Armada)</div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-emerald-700 dark:text-emerald-300">Siap Jalan (Aman)</span>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-2 font-mono">{passedCount}</div>
          <div className="text-[11px] text-slate-500 mt-1">Seluruh 23 poin memenuhi syarat</div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-amber-700 dark:text-amber-300">Perlu Servis / Waspada</span>
            <div className="w-8 h-8 rounded-lg bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 flex items-center justify-center text-amber-600 dark:text-amber-400">
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-amber-600 dark:text-amber-400 mt-2 font-mono">{warningCount}</div>
          <div className="text-[11px] text-slate-500 mt-1">1-2 kendala ringan terdeteksi</div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-rose-700 dark:text-rose-300">Kritis (Dilarang Jalan)</span>
            <div className="w-8 h-8 rounded-lg bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/20 flex items-center justify-center text-rose-600 dark:text-rose-400">
              <AlertOctagon className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-rose-600 dark:text-rose-400 mt-2 font-mono">{failedCount}</div>
          <div className="text-[11px] text-slate-500 mt-1">&gt;2 kendala / komponen vital gagal</div>
        </div>
      </div>

      {/* Filter and Simple Fleet Selector Bar */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-xs space-y-3">
        <div className="flex flex-col sm:flex-row gap-2.5">
          {/* Search Input */}
          <div className="flex-1 relative">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari nomor polisi, inisial armada, nama driver, atau catatan..."
              className="w-full pl-10 pr-4 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-blue-500"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 dark:hover:text-white cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Date Filter */}
          <div className="flex items-center gap-1.5 bg-slate-50 dark:bg-slate-950 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 text-xs">
            <Calendar className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 shrink-0" />
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="bg-transparent text-slate-900 dark:text-white focus:outline-none font-mono text-xs cursor-pointer"
            />
            {selectedDate && (
              <button
                onClick={() => setSelectedDate('')}
                className="text-[10px] text-rose-600 dark:text-rose-400 hover:underline font-bold ml-1 cursor-pointer"
              >
                Reset
              </button>
            )}
          </div>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 text-xs font-medium rounded-xl px-3 py-2 focus:outline-none focus:border-blue-500 cursor-pointer"
          >
            <option value="all">Semua Status</option>
            <option value="passed">✓ Siap Jalan (Aman)</option>
            <option value="warning">⚠️ Perlu Servis</option>
            <option value="failed">⛔ Kritis</option>
          </select>
        </div>

        {/* Pilihan Armada yang Simpel */}
        <div className="pt-2.5 border-t border-slate-100 dark:border-slate-800 flex items-center gap-1.5 flex-wrap">
          <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 mr-1">
            Armada:
          </span>
          <button
            type="button"
            onClick={() => setFleetFilter('all')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
              fleetFilter === 'all'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
            }`}
          >
            Semua ({uniqueFleets.length})
          </button>

          {uniqueFleets.map(f => {
            const isSelected = fleetFilter === f.plate;
            return (
              <button
                key={f.plate}
                type="button"
                onClick={() => setFleetFilter(isSelected ? 'all' : f.plate)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                  isSelected
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
              >
                <span className="font-mono font-bold">{f.plate}</span>
                {f.initialCode && (
                  <span className={`text-[10px] font-mono ${isSelected ? 'text-blue-100' : 'text-slate-500 dark:text-slate-400'}`}>
                    ({f.initialCode})
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Checklist List Section Grouped Per Nama Armada (Otomatis Ringkas / Collapsed by Default) */}
      <div className="space-y-3">
        {groupedChecklistsByFleet.length === 0 ? (
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-10 text-center space-y-2">
            <div className="w-11 h-11 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400 mx-auto">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div className="text-sm font-bold text-slate-900 dark:text-white">Tidak Ada Data Checklist Ditemukan</div>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
              {searchQuery || statusFilter !== 'all' || selectedDate || fleetFilter !== 'all'
                ? 'Tidak ada laporan checklist yang cocok dengan kriteria filter saat ini.'
                : 'Belum ada data checklist pemeriksaan yang diunggah oleh kru supir.'}
            </p>
          </div>
        ) : (
          groupedChecklistsByFleet.map(fleetGroup => {
            const isExpanded = Boolean(expandedFleetGroups[fleetGroup.plateNumber]);

            return (
              <div
                key={fleetGroup.plateNumber}
                className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-blue-400 dark:hover:border-blue-500/50 rounded-2xl overflow-hidden shadow-xs transition"
              >
                {/* Header Container Ringkas Per Nama Armada (Warna Bersih & Kontras Tinggi) */}
                <div
                  onClick={() =>
                    setExpandedFleetGroups(prev => ({
                      ...prev,
                      [fleetGroup.plateNumber]: !prev[fleetGroup.plateNumber]
                    }))
                  }
                  className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 cursor-pointer select-none hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition"
                >
                  <div className="flex items-center gap-3.5">
                    <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-500/15 border border-blue-200 dark:border-blue-500/30 flex items-center justify-center text-blue-600 dark:text-blue-400 shrink-0">
                      <Truck className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-sm sm:text-base font-black text-slate-900 dark:text-white font-mono tracking-tight">
                          {fleetGroup.plateNumber}
                        </h3>
                        {fleetGroup.initialCode && (
                          <span className="text-[11px] font-mono font-bold px-2 py-0.5 rounded-md bg-amber-50 dark:bg-amber-500/15 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-500/30">
                            {fleetGroup.initialCode}
                          </span>
                        )}
                        <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-2.5 py-0.5 rounded-md border border-slate-200 dark:border-slate-700">
                          {fleetGroup.vehicleType}
                        </span>
                      </div>
                      <div className="text-xs text-slate-500 dark:text-slate-400 mt-1 flex items-center gap-2 flex-wrap">
                        <span>
                          Riwayat: <strong className="text-slate-800 dark:text-slate-200">{fleetGroup.items.length} Laporan</strong>
                        </span>
                        <span>•</span>
                        <span>
                          Driver Terakhir: <strong className="text-blue-600 dark:text-blue-400">{fleetGroup.latestCheck.driverName}</strong> ({fleetGroup.latestCheck.date} {fleetGroup.latestCheck.time} WIB)
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Ringkasan Status Per Armada & Tombol Expand/Collapse */}
                  <div className="flex items-center gap-2 self-end sm:self-center">
                    {fleetGroup.passedCount > 0 && (
                      <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-emerald-50 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-500/30">
                        ✓ {fleetGroup.passedCount} Aman
                      </span>
                    )}
                    {fleetGroup.warningCount > 0 && (
                      <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-amber-50 dark:bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-500/30">
                        ⚠️ {fleetGroup.warningCount} Waspada
                      </span>
                    )}
                    {fleetGroup.failedCount > 0 && (
                      <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-rose-50 dark:bg-rose-500/15 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-500/30">
                        ⛔ {fleetGroup.failedCount} Kritis
                      </span>
                    )}
                    <div className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                      {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                    </div>
                  </div>
                </div>

                {/* Daftar Checklist Di Dalam Armada Ini (Muncul Saat Diklik) */}
                {isExpanded && (
                  <div className="p-4 bg-slate-50/60 dark:bg-slate-950/50 border-t border-slate-200 dark:border-slate-800 space-y-4 divide-y divide-slate-200 dark:divide-slate-800">
                    {fleetGroup.items.map((checklist, idx) => {
                      const issueItems = checklist.items.filter(i => i.status === 'issue');

                      return (
                        <div
                          key={checklist.id}
                          className={`${idx > 0 ? 'pt-4' : ''} space-y-3`}
                        >
                          {/* Header Row */}
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-center text-blue-600 dark:text-blue-400 shrink-0 font-mono text-xs font-black">
                                #{idx + 1}
                              </div>
                              <div>
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="font-mono font-bold text-slate-900 dark:text-white text-xs">
                                    ID: {checklist.id}
                                  </span>
                                  <span className="text-[10px] px-2 py-0.5 rounded-md bg-slate-200/80 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold">
                                    {checklist.inspectionType === 'pre_trip' ? 'Pre-Trip (Sebelum Berangkat)' : 'Post-Trip (Setelah Pulang)'}
                                  </span>
                                </div>
                                <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 flex items-center gap-2 flex-wrap">
                                  <span>Driver: <strong className="text-slate-800 dark:text-slate-200">{checklist.driverName}</strong></span>
                                  <span>•</span>
                                  <span className="font-mono">{checklist.date} {checklist.time} WIB</span>
                                  <span>•</span>
                                  <span className="font-mono">Odometer: <strong className="text-slate-800 dark:text-slate-200">{checklist.odometerKm.toLocaleString()} KM</strong></span>
                                </div>
                              </div>
                            </div>

                            {/* Status Badge & Actions */}
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => setSelectedChecklistModal(checklist)}
                                className="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs flex items-center gap-1.5 transition cursor-pointer shadow-xs"
                                title="Lihat seluruh 23 poin pemeriksaan"
                              >
                                <Eye className="w-3.5 h-3.5" />
                                <span>Rincian 23 Poin ({checklist.passedCount}/{checklist.items.length} OK)</span>
                              </button>
                            </div>
                          </div>

                          {/* General Driver Notes if any */}
                          {checklist.notes && (
                            <div className="bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-200 dark:border-slate-800 text-xs">
                              <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300 block mb-0.5">Catatan Supir:</span>
                              <p className="text-slate-600 dark:text-slate-400 leading-relaxed">{checklist.notes}</p>
                            </div>
                          )}

                          {/* KENDALA & INSTRUKSI KAPAN HARUS DIGANTI / DISERVIS */}
                          {issueItems.length > 0 ? (
                            <div className="space-y-2.5">
                              <div className="flex items-center justify-between text-xs font-bold text-rose-700 dark:text-rose-300">
                                <div className="flex items-center gap-1.5">
                                  <Wrench className="w-3.5 h-3.5" />
                                  <span>Rekomendasi Servis Berdasarkan Kendala ({issueItems.length}):</span>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setMinimizedDirectives(prev => ({
                                      ...prev,
                                      [checklist.id]: !prev[checklist.id]
                                    }));
                                  }}
                                  className="px-2.5 py-1 rounded-lg bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 text-[10px] font-bold hover:bg-slate-100 transition cursor-pointer"
                                >
                                  {minimizedDirectives[checklist.id] ? 'Tampilkan Arahan' : 'Sembunyikan'}
                                </button>
                              </div>

                              {!minimizedDirectives[checklist.id] && (
                                <div className="space-y-2">
                                  {issueItems.map(item => {
                                    const rule = getMaintenanceRuleForItem(item.name);

                                    return (
                                      <div
                                        key={item.id}
                                        className="bg-white dark:bg-slate-900 border border-rose-200 dark:border-rose-500/30 rounded-xl p-3 space-y-2"
                                      >
                                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                                          <div className="flex items-center gap-2">
                                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-50 dark:bg-rose-500/20 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-500/40">
                                              {item.categoryLabel}
                                            </span>
                                            <span className="text-xs font-bold text-slate-900 dark:text-white">
                                              {item.name}
                                            </span>
                                          </div>
                                          <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-rose-100 dark:bg-rose-950 text-rose-800 dark:text-rose-300">
                                            Perlu Perbaikan Segera
                                          </span>
                                        </div>

                                        {item.note && (
                                          <div className="text-xs text-rose-800 dark:text-rose-200 bg-rose-50 dark:bg-rose-500/10 p-2 rounded-lg border border-rose-200 dark:border-rose-500/20">
                                            <strong>Keluhan Supir:</strong> {item.note}
                                          </div>
                                        )}

                                        {rule && (
                                          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-[11px]">
                                            <div className="bg-slate-50 dark:bg-slate-950 p-2.5 rounded-lg border border-slate-200 dark:border-slate-800">
                                              <span className="text-[10px] font-bold text-amber-700 dark:text-amber-400 block mb-0.5">
                                                Interval Servis Rutin:
                                              </span>
                                              <p className="text-slate-700 dark:text-slate-300 leading-tight">
                                                {rule.standardInterval}
                                              </p>
                                            </div>

                                            <div className="bg-rose-50/50 dark:bg-slate-950 p-2.5 rounded-lg border border-rose-200 dark:border-rose-500/30">
                                              <span className="text-[10px] font-bold text-rose-700 dark:text-rose-400 block mb-0.5">
                                                Tindakan Segera:
                                              </span>
                                              <p className="text-rose-800 dark:text-rose-200 leading-tight">
                                                {rule.immediateAction}
                                              </p>
                                            </div>
                                          </div>
                                        )}
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          ) : (
                            <div className="bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-500/20 rounded-xl p-2.5 text-xs text-emerald-800 dark:text-emerald-300 flex items-center gap-2">
                              <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                              <span>Seluruh 23 komponen pemeriksaan dalam kondisi prima dan siap jalan.</span>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* MODAL RINCIAN LENGKAP 23 POIN CHECKLIST */}
      {selectedChecklistModal && (
        <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-3xl w-full overflow-hidden shadow-2xl flex flex-col max-h-[92vh]">
            
            {/* Modal Header */}
            <div className="p-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-cyan-400" />
                  <span>Rincian Lengkap Inspeksi: {selectedChecklistModal.plateNumber}</span>
                </h3>
                <p className="text-[10px] text-slate-400 mt-0.5">
                  Driver: {selectedChecklistModal.driverName} · Tanggal: {selectedChecklistModal.date} {selectedChecklistModal.time} WIB · Odometer: {selectedChecklistModal.odometerKm.toLocaleString()} KM
                </p>
              </div>
              <button
                onClick={() => setSelectedChecklistModal(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-4 flex-1 overflow-y-auto space-y-4">
              
              <div className="grid grid-cols-3 gap-2 text-center text-xs">
                <div className="bg-slate-950 p-2 rounded-xl border border-slate-800">
                  <span className="text-[10px] text-slate-400 block">Status Keseluruhan</span>
                  <span className="font-bold text-white capitalize">{selectedChecklistModal.overallStatus}</span>
                </div>
                <div className="bg-slate-950 p-2 rounded-xl border border-slate-800">
                  <span className="text-[10px] text-slate-400 block">Poin Lolos (OK)</span>
                  <span className="font-bold text-emerald-400">{selectedChecklistModal.passedCount}</span>
                </div>
                <div className="bg-slate-950 p-2 rounded-xl border border-slate-800">
                  <span className="text-[10px] text-slate-400 block">Poin Bermasalah</span>
                  <span className="font-bold text-rose-400">{selectedChecklistModal.issueCount}</span>
                </div>
              </div>

              {/* 23 Points Checklist Table */}
              <div className="space-y-2">
                <h4 className="text-xs font-bold text-slate-300">Daftar 23 Poin Pemeriksaan Fisik:</h4>
                <div className="divide-y divide-slate-800/80 border border-slate-800 rounded-xl overflow-hidden bg-slate-950">
                  {selectedChecklistModal.items.map((item, idx) => (
                    <div key={item.id} className="p-3 text-xs flex items-start justify-between gap-3 hover:bg-slate-900/60 transition">
                      <div className="space-y-0.5 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-[10px] text-slate-500">{idx + 1}.</span>
                          <span className="font-bold text-white">{item.name}</span>
                          <span className="text-[9px] px-1.5 py-0.2 rounded bg-slate-800 text-slate-400 font-mono">
                            {item.categoryLabel}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-400 pl-4">{item.description}</p>
                        {item.note && (
                          <div className="text-[11px] text-rose-300 pl-4 mt-1">
                            <strong>Catatan Kendala:</strong> {item.note}
                          </div>
                        )}
                      </div>

                      <div className="shrink-0">
                        {item.status === 'ok' ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                            <CheckCircle2 className="w-3 h-3" />
                            <span>OK</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-500/15 text-rose-400 border border-rose-500/30 animate-pulse">
                            <AlertTriangle className="w-3 h-3" />
                            <span>KENDALA</span>
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Verifikasi Checker & Signature */}
              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 text-xs flex items-center justify-between">
                <div>
                  <span className="text-[10px] text-slate-400 block">Tanda Tangan Supir:</span>
                  <span className="font-bold text-white">{selectedChecklistModal.driverSignature || selectedChecklistModal.driverName}</span>
                </div>
                <div className="text-right">
                  <span className="text-[10px] text-slate-400 block">Petugas Checker DC:</span>
                  <span className="font-bold text-cyan-400">{selectedChecklistModal.checkerName || 'Petugas Checker DC'} (Diverifikasi)</span>
                </div>
              </div>

            </div>

            {/* Modal Footer */}
            <div className="p-3 bg-slate-950 border-t border-slate-800 flex items-center justify-between">
              <span className="text-[10px] text-slate-500">PT Anugrah Kemasan Kreatif · Banyuwangi DC Logistik</span>
              <button
                onClick={() => setSelectedChecklistModal(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs transition cursor-pointer"
              >
                Tutup
              </button>
            </div>

          </div>
        </div>
      )}

      {/* MODAL KATALOG STANDAR SERVIS ARMADA AKK */}
      {showCatalogModal && (
        <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-4xl w-full overflow-hidden shadow-2xl flex flex-col max-h-[92vh]">
            
            {/* Header */}
            <div className="p-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-blue-500/20 border border-blue-500/30 flex items-center justify-center text-blue-400">
                  <BookOpen className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">
                    Pedoman Standar Servis &amp; Penggantian Komponen Truk AKK
                  </h3>
                  <p className="text-[10px] text-slate-400">
                    Katalog acuan interval penggantian, kondisi kendala, dan tindakan darurat bagi SPV logistik, mekanik, &amp; supir
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowCatalogModal(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Category Filter Pills */}
            <div className="px-4 py-2 bg-slate-950/70 border-b border-slate-800 flex items-center gap-1.5 overflow-x-auto text-xs">
              <button
                onClick={() => setCatalogCategory('all')}
                className={`px-3 py-1 rounded-lg font-bold transition whitespace-nowrap cursor-pointer ${catalogCategory === 'all' ? 'bg-cyan-500 text-slate-950' : 'bg-slate-900 text-slate-400 hover:text-white'}`}
              >
                Semua Komponen ({MAINTENANCE_COMPONENT_RULES.length})
              </button>
              <button
                onClick={() => setCatalogCategory('mesin_fluida')}
                className={`px-3 py-1 rounded-lg font-bold transition whitespace-nowrap cursor-pointer ${catalogCategory === 'mesin_fluida' ? 'bg-cyan-500 text-slate-950' : 'bg-slate-900 text-slate-400 hover:text-white'}`}
              >
                Mesin &amp; Fluida
              </button>
              <button
                onClick={() => setCatalogCategory('rem_roda')}
                className={`px-3 py-1 rounded-lg font-bold transition whitespace-nowrap cursor-pointer ${catalogCategory === 'rem_roda' ? 'bg-cyan-500 text-slate-950' : 'bg-slate-900 text-slate-400 hover:text-white'}`}
              >
                Rem &amp; Roda
              </button>
              <button
                onClick={() => setCatalogCategory('lampu_listrik')}
                className={`px-3 py-1 rounded-lg font-bold transition whitespace-nowrap cursor-pointer ${catalogCategory === 'lampu_listrik' ? 'bg-cyan-500 text-slate-950' : 'bg-slate-900 text-slate-400 hover:text-white'}`}
              >
                Lampu &amp; Kelistrikan
              </button>
              <button
                onClick={() => setCatalogCategory('fisik_dokumen')}
                className={`px-3 py-1 rounded-lg font-bold transition whitespace-nowrap cursor-pointer ${catalogCategory === 'fisik_dokumen' ? 'bg-cyan-500 text-slate-950' : 'bg-slate-900 text-slate-400 hover:text-white'}`}
              >
                Dokumen &amp; Fisik
              </button>
              <button
                onClick={() => setCatalogCategory('darurat_k3')}
                className={`px-3 py-1 rounded-lg font-bold transition whitespace-nowrap cursor-pointer ${catalogCategory === 'darurat_k3' ? 'bg-cyan-500 text-slate-950' : 'bg-slate-900 text-slate-400 hover:text-white'}`}
              >
                Perlengkapan K3
              </button>
            </div>

            {/* Content List */}
            <div className="p-4 flex-1 overflow-y-auto space-y-3">
              {MAINTENANCE_COMPONENT_RULES.filter(r => catalogCategory === 'all' || r.category === catalogCategory).map(rule => (
                <div key={rule.id} className="bg-slate-950 border border-slate-800 rounded-xl p-3.5 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-white text-xs">{rule.name}</span>
                      <span className="text-[9px] px-2 py-0.5 rounded bg-slate-800 text-slate-400 font-mono">
                        {rule.categoryLabel}
                      </span>
                    </div>
                    <span className={`text-[9px] px-2 py-0.5 rounded-full font-bold border ${rule.urgencyLevel === 'kritis' ? 'bg-rose-500/15 text-rose-400 border-rose-500/30' : 'bg-amber-500/15 text-amber-300 border-amber-500/30'}`}>
                      {rule.urgencyLevel === 'kritis' ? 'Urgensi Kritis' : 'Urgensi Waspada'}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-[11px]">
                    <div className="bg-slate-900 p-2.5 rounded-lg border border-slate-800/80">
                      <span className="text-[10px] font-bold text-cyan-400 block">Jadwal Servis Rutin</span>
                      <p className="text-slate-300 mt-0.5">{rule.standardInterval}</p>
                    </div>

                    <div className="bg-slate-900 p-2.5 rounded-lg border border-slate-800/80">
                      <span className="text-[10px] font-bold text-amber-400 block">Kondisi Kendala Checklist</span>
                      <p className="text-slate-300 mt-0.5">{rule.issueTriggerCondition}</p>
                    </div>

                    <div className="bg-slate-900 p-2.5 rounded-lg border border-rose-500/30">
                      <span className="text-[10px] font-bold text-rose-400 block">Tindakan Segera Perbaikan</span>
                      <p className="text-rose-200 mt-0.5">{rule.immediateAction}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Footer */}
            <div className="p-3 bg-slate-950 border-t border-slate-800 flex items-center justify-end">
              <button
                onClick={() => setShowCatalogModal(false)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs transition cursor-pointer"
              >
                Tutup Katalog
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
};
