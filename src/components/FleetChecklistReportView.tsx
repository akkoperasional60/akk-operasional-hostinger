import React, { useState, useEffect, useMemo } from 'react';
import {
  ShieldCheck,
  Truck,
  Calendar,
  AlertTriangle,
  CheckCircle2,
  Wrench,
  Search,
  FileSpreadsheet,
  RefreshCw,
  Eye,
  ChevronDown,
  ChevronRight,
  BookOpen,
  X,
  Trash2
} from 'lucide-react';
import { DriverVehicleChecklist } from '../types';
import { driverChecklistService } from '../services/driverChecklistService';
import { MAINTENANCE_COMPONENT_RULES, getMaintenanceRuleForItem, MaintenanceComponentRule } from '../services/maintenanceGuidanceService';
import { logisticsStore } from '../services/store';
import { useToast } from '../context/ToastContext';
import { listenCrewChanged } from './crew/crewApi';

interface FleetChecklistReportViewProps {
  onBackToOperationalReports?: () => void;
}

export const FleetChecklistReportView: React.FC<FleetChecklistReportViewProps> = ({
  onBackToOperationalReports
}) => {
  const { addNotification } = useToast();
  const [currentUser, setCurrentUser] = useState(() => logisticsStore.getCurrentUser());
  useEffect(() => {
    const unsub = logisticsStore.subscribe(() => {
      setCurrentUser(logisticsStore.getCurrentUser());
    });
    return () => unsub();
  }, []);
  const isSuperAdmin = useMemo(() => {
    const r = String(currentUser?.role || '').toLowerCase().trim().replace(/[\s_-]+/g, '');
    return r === 'superadmin';
  }, [currentUser]);

  const [checklists, setChecklists] = useState<DriverVehicleChecklist[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'passed' | 'warning' | 'failed'>('all');
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [fleetFilter, setFleetFilter] = useState<string>('all');
  const [selectedChecklistModal, setSelectedChecklistModal] = useState<DriverVehicleChecklist | null>(null);
  const [deleteConfirmChecklist, setDeleteConfirmChecklist] = useState<DriverVehicleChecklist | null>(null);
  const [showCatalogModal, setShowCatalogModal] = useState(false);
  const [catalogCategory, setCatalogCategory] = useState<string>('all');
  const [minimizedDirectives, setMinimizedDirectives] = useState<Record<string, boolean>>({});
  const [expandedFleetGroups, setExpandedFleetGroups] = useState<Record<string, boolean>>({});

  const allMasterFleets = useMemo(() => logisticsStore.getFleets(), [checklists]);

  const loadChecklists = async () => {
    const localList = driverChecklistService.getChecklists();
    setChecklists(localList);
    const syncedList = await driverChecklistService.syncFromServer();
    setChecklists(syncedList);
  };

  useEffect(() => {
    void loadChecklists();
    const handleUpdate = () => {
      setChecklists(driverChecklistService.getChecklists());
    };
    window.addEventListener('driver-checklist-updated', handleUpdate);
    const unsubCrew = listenCrewChanged(() => {
      void driverChecklistService.syncFromServer().then(setChecklists);
    });
    const interval = setInterval(() => {
      void driverChecklistService.syncFromServer().then(setChecklists);
    }, 10000);
    return () => {
      window.removeEventListener('driver-checklist-updated', handleUpdate);
      unsubCrew();
      clearInterval(interval);
    };
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
    <div className="space-y-4 animate-in fade-in duration-200">
      {/* Header Halaman */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 px-5 py-4 rounded-xl">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
            Laporan Checklist Pemeriksaan Per Armada
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            Klik armada untuk melihat riwayat inspeksi 9 poin &amp; panduan perbaikan.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap shrink-0">
          <button
            onClick={() => setShowCatalogModal(true)}
            className="h-9 px-3.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs sm:text-sm flex items-center gap-1.5 transition cursor-pointer"
            title="Buka panduan standar interval servis & tindakan darurat"
          >
            <BookOpen className="w-4 h-4" />
            <span>Katalog Servis</span>
          </button>

          <button
            onClick={loadChecklists}
            className="h-9 px-3 rounded-lg bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 text-xs sm:text-sm font-semibold flex items-center gap-1.5 transition cursor-pointer"
            title="Muat Ulang Data"
          >
            <RefreshCw className="w-4 h-4 text-slate-500" />
            <span>Segarkan</span>
          </button>

          <button
            onClick={handleExportCsv}
            className="h-9 px-3.5 rounded-lg bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 font-semibold text-xs sm:text-sm flex items-center gap-1.5 transition cursor-pointer"
            title="Unduh laporan checklist ke CSV / Excel"
          >
            <FileSpreadsheet className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            <span>Ekspor CSV</span>
          </button>
        </div>
      </div>

      {/* KPI Stats Cards (Flat & Minimal) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
          <span className="text-sm font-semibold text-slate-600 dark:text-slate-300 block">Total Inspeksi</span>
          <div className="flex items-baseline justify-between gap-2 mt-1.5">
            <span className="text-3xl font-bold text-slate-900 dark:text-white font-mono tabular-nums leading-none">
              {totalCount}
            </span>
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
              {uniqueFleets.length} Armada
            </span>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
          <span className="text-sm font-semibold text-emerald-700 dark:text-emerald-400 block">Siap Jalan (Aman)</span>
          <div className="flex items-baseline justify-between gap-2 mt-1.5">
            <span className="text-3xl font-bold text-emerald-600 dark:text-emerald-400 font-mono tabular-nums leading-none">
              {passedCount}
            </span>
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">9 poin OK</span>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
          <span className="text-sm font-semibold text-amber-700 dark:text-amber-400 block">Perlu Servis / Waspada</span>
          <div className="flex items-baseline justify-between gap-2 mt-1.5">
            <span className="text-3xl font-bold text-amber-600 dark:text-amber-400 font-mono tabular-nums leading-none">
              {warningCount}
            </span>
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">1-2 kendala</span>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
          <span className="text-sm font-semibold text-rose-700 dark:text-rose-400 block">Kritis (Dilarang Jalan)</span>
          <div className="flex items-baseline justify-between gap-2 mt-1.5">
            <span className="text-3xl font-bold text-rose-600 dark:text-rose-400 font-mono tabular-nums leading-none">
              {failedCount}
            </span>
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Vital gagal</span>
          </div>
        </div>
      </div>

      {/* Filter & Fleet Selector Bar */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3.5">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-2.5 items-center">
          <div className="lg:col-span-5 relative">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari nopol, inisial armada, nama driver, atau catatan..."
              className="w-full h-10 pl-10 pr-8 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-blue-600"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 dark:hover:text-white cursor-pointer"
                aria-label="Hapus pencarian"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          <div className="lg:col-span-3">
            <select
              value={fleetFilter}
              onChange={(e) => setFleetFilter(e.target.value)}
              aria-label="Filter Armada"
              className="w-full h-10 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 text-sm font-semibold rounded-lg px-3 focus:outline-none focus:border-blue-600 cursor-pointer"
            >
              <option value="all">Semua Armada ({uniqueFleets.length})</option>
              {uniqueFleets.map(f => (
                <option key={f.plate} value={f.plate}>
                  {f.plate}{f.initialCode ? ` (${f.initialCode})` : ''} · {f.count}x
                </option>
              ))}
            </select>
          </div>

          <div className="lg:col-span-2 flex items-center gap-1.5 h-10 bg-slate-50 dark:bg-slate-950 px-3 rounded-lg border border-slate-200 dark:border-slate-800 text-sm">
            <Calendar className="w-4 h-4 text-slate-400 shrink-0" />
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              aria-label="Filter Tanggal"
              className="w-full bg-transparent text-slate-900 dark:text-white focus:outline-none font-mono text-xs sm:text-sm cursor-pointer"
            />
          </div>

          <div className="lg:col-span-2 flex items-center gap-2">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              aria-label="Filter Status Kelayakan"
              className="w-full h-10 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 text-sm font-semibold rounded-lg px-3 focus:outline-none focus:border-blue-600 cursor-pointer"
            >
              <option value="all">Semua Status</option>
              <option value="passed">Siap Jalan (Aman)</option>
              <option value="warning">Perlu Servis</option>
              <option value="failed">Kritis</option>
            </select>
            {(searchQuery || statusFilter !== 'all' || selectedDate || fleetFilter !== 'all') && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setStatusFilter('all');
                  setSelectedDate('');
                  setFleetFilter('all');
                }}
                className="h-10 px-3 rounded-lg bg-white dark:bg-slate-800 hover:bg-slate-50 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 cursor-pointer shrink-0"
              >
                Reset
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Checklist List Section Grouped Per Armada */}
      <div className="space-y-3">
        {groupedChecklistsByFleet.length === 0 ? (
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-10 text-center space-y-2">
            <div className="w-11 h-11 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400 mx-auto">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div className="text-base font-bold text-slate-900 dark:text-white">Tidak Ada Data Checklist Ditemukan</div>
            <p className="text-sm text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
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
                className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-blue-400 dark:hover:border-blue-500/50 rounded-xl overflow-hidden transition"
              >
                {/* Header Armada */}
                <div
                  onClick={() =>
                    setExpandedFleetGroups(prev => ({
                      ...prev,
                      [fleetGroup.plateNumber]: !prev[fleetGroup.plateNumber]
                    }))
                  }
                  className="px-4 py-3.5 sm:px-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 cursor-pointer select-none hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition"
                >
                  <div className="flex items-center gap-3.5 min-w-0">
                    <div className="w-10 h-10 rounded-lg bg-blue-50 dark:bg-blue-500/15 border border-blue-200 dark:border-blue-500/30 flex items-center justify-center text-blue-600 dark:text-blue-400 shrink-0">
                      <Truck className="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white font-mono tracking-tight tabular-nums">
                          {fleetGroup.plateNumber}
                        </h3>
                        {fleetGroup.initialCode && (
                          <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700">
                            {fleetGroup.initialCode}
                          </span>
                        )}
                        <span className="text-sm font-medium text-slate-500 dark:text-slate-400">
                          · {fleetGroup.vehicleType}
                        </span>
                      </div>
                      <div className="text-sm text-slate-600 dark:text-slate-300 mt-0.5 flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-slate-800 dark:text-slate-200 tabular-nums">
                          {fleetGroup.items.length} Laporan
                        </span>
                        <span className="text-slate-300 dark:text-slate-600">·</span>
                        <span>
                          Driver Terakhir: <strong className="font-bold text-slate-900 dark:text-white">{fleetGroup.latestCheck.driverName}</strong>{' '}
                          <span className="font-mono tabular-nums text-slate-500 dark:text-slate-400">
                            ({fleetGroup.latestCheck.date} {fleetGroup.latestCheck.time} WIB)
                          </span>
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Ringkasan Status Per Armada */}
                  <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                    {fleetGroup.passedCount > 0 && (
                      <span className="px-2.5 py-1 rounded-lg text-xs sm:text-sm font-bold bg-emerald-50 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-500/30 tabular-nums">
                        {fleetGroup.passedCount} Aman
                      </span>
                    )}
                    {fleetGroup.warningCount > 0 && (
                      <span className="px-2.5 py-1 rounded-lg text-xs sm:text-sm font-bold bg-amber-50 dark:bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-500/30 tabular-nums">
                        {fleetGroup.warningCount} Waspada
                      </span>
                    )}
                    {fleetGroup.failedCount > 0 && (
                      <span className="px-2.5 py-1 rounded-lg text-xs sm:text-sm font-bold bg-rose-50 dark:bg-rose-500/15 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-500/30 tabular-nums">
                        {fleetGroup.failedCount} Kritis
                      </span>
                    )}
                    <div className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                      {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                    </div>
                  </div>
                </div>

                {/* Daftar Checklist Di Dalam Armada Ini */}
                {isExpanded && (
                  <div className="p-4 bg-slate-50/70 dark:bg-slate-950/50 border-t border-slate-200 dark:border-slate-800 divide-y divide-slate-200 dark:divide-slate-800 space-y-4">
                    {fleetGroup.items.map((checklist, idx) => {
                      const issueItems = checklist.items.filter(i => i.status === 'issue');

                      return (
                        <div
                          key={checklist.id}
                          className={`${idx > 0 ? 'pt-4' : ''} space-y-3`}
                        >
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-center text-blue-600 dark:text-blue-400 shrink-0 font-mono text-xs font-bold">
                                #{idx + 1}
                              </div>
                              <div>
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="font-mono font-bold text-slate-900 dark:text-white text-sm">
                                    {checklist.id}
                                  </span>
                                  <span className="text-xs px-2 py-0.5 rounded-md bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 font-semibold">
                                    {checklist.inspectionType === 'pre_trip' ? 'Pre-Trip' : 'Post-Trip'}
                                  </span>
                                </div>
                                <div className="text-sm text-slate-600 dark:text-slate-300 mt-0.5 flex items-center gap-2 flex-wrap">
                                  <span>Driver: <strong className="text-slate-900 dark:text-white">{checklist.driverName}</strong></span>
                                  <span className="text-slate-300 dark:text-slate-600">·</span>
                                  <span className="font-mono tabular-nums">{checklist.date} {checklist.time} WIB</span>
                                  <span className="text-slate-300 dark:text-slate-600">·</span>
                                  <span className="font-mono tabular-nums">Odometer: <strong className="text-slate-900 dark:text-white">{checklist.odometerKm.toLocaleString()} KM</strong></span>
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => setSelectedChecklistModal(checklist)}
                                className="px-3.5 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs sm:text-sm flex items-center gap-1.5 transition cursor-pointer"
                                title="Lihat seluruh poin pemeriksaan"
                              >
                                <Eye className="w-4 h-4" />
                                <span>Rincian ({checklist.passedCount}/{checklist.items.length} OK)</span>
                              </button>
                              {isSuperAdmin && (
                                <button
                                  type="button"
                                  onClick={() => setDeleteConfirmChecklist(checklist)}
                                  className="p-2 rounded-lg bg-rose-50 dark:bg-rose-500/15 hover:bg-rose-600 text-rose-600 dark:text-rose-400 hover:text-white border border-rose-200 dark:border-rose-500/35 hover:border-rose-600 transition cursor-pointer"
                                  title="Hapus Laporan Checklist (Khusus Super Admin)"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              )}
                            </div>
                          </div>

                          {checklist.notes && (
                            <div className="bg-white dark:bg-slate-900 p-3 rounded-lg border border-slate-200 dark:border-slate-800 text-sm">
                              <span className="font-bold text-slate-800 dark:text-slate-200 mr-1.5">Catatan Supir:</span>
                              <span className="text-slate-600 dark:text-slate-400">{checklist.notes}</span>
                            </div>
                          )}

                          {issueItems.length > 0 ? (
                            <div className="space-y-2">
                              <div className="flex items-center justify-between text-xs sm:text-sm font-bold text-rose-700 dark:text-rose-300">
                                <div className="flex items-center gap-1.5">
                                  <Wrench className="w-4 h-4" />
                                  <span>Rekomendasi Servis ({issueItems.length} Kendala):</span>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setMinimizedDirectives(prev => ({
                                      ...prev,
                                      [checklist.id]: !prev[checklist.id]
                                    }));
                                  }}
                                  className="px-2.5 py-1 rounded-lg bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 text-xs font-semibold hover:bg-slate-100 transition cursor-pointer"
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
                                        className="bg-white dark:bg-slate-900 border border-rose-200 dark:border-rose-500/30 rounded-xl p-3.5 space-y-2"
                                      >
                                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                                          <div className="flex items-center gap-2 flex-wrap">
                                            <span className="px-2 py-0.5 rounded-md text-xs font-bold bg-rose-50 dark:bg-rose-500/20 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-500/40">
                                              {item.categoryLabel}
                                            </span>
                                            <span className="text-sm font-bold text-slate-900 dark:text-white">
                                              {item.name}
                                            </span>
                                          </div>
                                          <span className="text-xs px-2.5 py-0.5 rounded-md font-bold bg-rose-100 dark:bg-rose-950 text-rose-800 dark:text-rose-300 self-start sm:self-auto">
                                            Perlu Perbaikan Segera
                                          </span>
                                        </div>

                                        {item.note && (
                                          <div className="text-sm text-rose-800 dark:text-rose-200 bg-rose-50/70 dark:bg-rose-500/10 p-2.5 rounded-lg border border-rose-200 dark:border-rose-500/20">
                                            <strong>Keluhan:</strong> {item.note}
                                          </div>
                                        )}

                                        {rule && (
                                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs sm:text-sm pt-1">
                                            <div>
                                              <span className="text-xs font-bold text-amber-700 dark:text-amber-400 block">
                                                Interval Servis Rutin:
                                              </span>
                                              <p className="text-slate-700 dark:text-slate-300 mt-0.5">
                                                {rule.standardInterval}
                                              </p>
                                            </div>
                                            <div>
                                              <span className="text-xs font-bold text-rose-700 dark:text-rose-400 block">
                                                Tindakan Segera:
                                              </span>
                                              <p className="text-rose-800 dark:text-rose-200 mt-0.5">
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
                            <div className="bg-emerald-50/70 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-500/20 rounded-lg px-3 py-2 text-sm text-emerald-800 dark:text-emerald-300 flex items-center gap-2">
                              <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                              <span>Seluruh 9 komponen pemeriksaan dalam kondisi prima dan siap jalan.</span>
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

      {/* MODAL RINCIAN LENGKAP 9 POIN CHECKLIST */}
      {selectedChecklistModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 flex items-center justify-center p-3 sm:p-6 animate-in fade-in duration-150">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-3xl w-full overflow-hidden flex flex-col max-h-[92vh]">
            <div className="px-5 py-4 bg-white dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3">
              <div>
                <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                  <span>Rincian Inspeksi: <span className="font-mono">{selectedChecklistModal.plateNumber}</span></span>
                </h3>
                <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                  Driver: {selectedChecklistModal.driverName} · {selectedChecklistModal.date} {selectedChecklistModal.time} WIB · Odometer: {selectedChecklistModal.odometerKm.toLocaleString()} KM
                </p>
              </div>
              <button
                onClick={() => setSelectedChecklistModal(null)}
                className="p-2 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 flex-1 overflow-y-auto space-y-4">
              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="bg-slate-50 dark:bg-slate-950 p-3 rounded-xl border border-slate-200 dark:border-slate-800">
                  <span className="text-xs font-medium text-slate-500 dark:text-slate-400 block">Status</span>
                  <span className="text-base font-bold text-slate-900 dark:text-white capitalize">{selectedChecklistModal.overallStatus}</span>
                </div>
                <div className="bg-slate-50 dark:bg-slate-950 p-3 rounded-xl border border-slate-200 dark:border-slate-800">
                  <span className="text-xs font-medium text-slate-500 dark:text-slate-400 block">Lolos (OK)</span>
                  <span className="text-base font-bold font-mono tabular-nums text-emerald-600 dark:text-emerald-400">{selectedChecklistModal.passedCount}</span>
                </div>
                <div className="bg-slate-50 dark:bg-slate-950 p-3 rounded-xl border border-slate-200 dark:border-slate-800">
                  <span className="text-xs font-medium text-slate-500 dark:text-slate-400 block">Bermasalah</span>
                  <span className="text-base font-bold font-mono tabular-nums text-rose-600 dark:text-rose-400">{selectedChecklistModal.issueCount}</span>
                </div>
              </div>

              <div className="space-y-2">
                <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200">
                  Daftar {selectedChecklistModal.items.length} Poin Pemeriksaan Fisik:
                </h4>
                <div className="divide-y divide-slate-200 dark:divide-slate-800 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden bg-white dark:bg-slate-950">
                  {selectedChecklistModal.items.map((item, idx) => (
                    <div key={item.id} className="p-3.5 flex items-start justify-between gap-3 hover:bg-slate-50 dark:hover:bg-slate-900/60 transition">
                      <div className="space-y-1 min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono text-xs text-slate-400">{idx + 1}.</span>
                          <span className="text-sm font-bold text-slate-900 dark:text-white">{item.name}</span>
                          <span className="text-xs px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-medium">
                            {item.categoryLabel}
                          </span>
                        </div>
                        <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 pl-4">{item.description}</p>
                        {item.photoUrl && (
                          <div className="pl-4 pt-1.5">
                            <img
                              src={item.photoUrl}
                              alt={item.name}
                              className="w-full max-w-xs max-h-36 object-cover rounded-lg border border-slate-200 dark:border-slate-700"
                            />
                          </div>
                        )}
                        {item.note && (
                          <div className="text-xs sm:text-sm text-rose-700 dark:text-rose-300 pl-4 mt-1">
                            <strong>Catatan Kendala:</strong> {item.note}
                          </div>
                        )}
                      </div>

                      <div className="shrink-0">
                        {item.status === 'ok' ? (
                          <span className="inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/30">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>OK</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-lg bg-rose-50 dark:bg-rose-500/15 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-500/30">
                            <AlertTriangle className="w-3.5 h-3.5" />
                            <span>KENDALA</span>
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-slate-50 dark:bg-slate-950 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 text-sm flex items-center justify-between gap-4">
                <div>
                  <span className="text-xs text-slate-500 dark:text-slate-400 block">Tanda Tangan Supir:</span>
                  <span className="font-bold text-slate-900 dark:text-white">{selectedChecklistModal.driverSignature || selectedChecklistModal.driverName}</span>
                </div>
                <div className="text-right">
                  <span className="text-xs text-slate-500 dark:text-slate-400 block">Petugas Checker DC:</span>
                  <span className="font-bold text-blue-600 dark:text-blue-400">{selectedChecklistModal.checkerName || 'Petugas Checker DC'} (Diverifikasi)</span>
                </div>
              </div>
            </div>

            <div className="px-5 py-3.5 bg-slate-50 dark:bg-slate-950 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <span className="text-xs text-slate-500">PT Anugrah Kemasan Kreatif · Banyuwangi DC Logistik</span>
              <button
                onClick={() => setSelectedChecklistModal(null)}
                className="px-4 py-2 rounded-lg bg-slate-900 dark:bg-slate-800 hover:bg-slate-800 dark:hover:bg-slate-700 text-white font-semibold text-xs sm:text-sm transition cursor-pointer"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL KATALOG STANDAR SERVIS ARMADA AKK */}
      {showCatalogModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 flex items-center justify-center p-3 sm:p-6 animate-in fade-in duration-150">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-4xl w-full overflow-hidden flex flex-col max-h-[92vh]">
            <div className="px-5 py-4 bg-white dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-blue-50 dark:bg-blue-500/20 border border-blue-200 dark:border-blue-500/30 flex items-center justify-center text-blue-600 dark:text-blue-400">
                  <BookOpen className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    Pedoman Standar Servis &amp; Penggantian Komponen
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Acuan interval servis dan tindakan perbaikan armada AKK.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowCatalogModal(false)}
                className="p-2 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="px-5 py-2.5 bg-slate-50 dark:bg-slate-950/70 border-b border-slate-200 dark:border-slate-800 flex items-center gap-2 overflow-x-auto text-xs sm:text-sm">
              <button
                onClick={() => setCatalogCategory('all')}
                className={`px-3 py-1.5 rounded-lg font-bold transition whitespace-nowrap cursor-pointer ${catalogCategory === 'all' ? 'bg-blue-600 text-white' : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300'}`}
              >
                Semua ({MAINTENANCE_COMPONENT_RULES.length})
              </button>
              <button
                onClick={() => setCatalogCategory('mesin_fluida')}
                className={`px-3 py-1.5 rounded-lg font-bold transition whitespace-nowrap cursor-pointer ${catalogCategory === 'mesin_fluida' ? 'bg-blue-600 text-white' : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300'}`}
              >
                Oli &amp; Radiator
              </button>
              <button
                onClick={() => setCatalogCategory('lampu_listrik')}
                className={`px-3 py-1.5 rounded-lg font-bold transition whitespace-nowrap cursor-pointer ${catalogCategory === 'lampu_listrik' ? 'bg-blue-600 text-white' : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300'}`}
              >
                Air Accu
              </button>
              <button
                onClick={() => setCatalogCategory('rem_roda')}
                className={`px-3 py-1.5 rounded-lg font-bold transition whitespace-nowrap cursor-pointer ${catalogCategory === 'rem_roda' ? 'bg-blue-600 text-white' : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300'}`}
              >
                Rem &amp; Ban
              </button>
              <button
                onClick={() => setCatalogCategory('fisik_dokumen')}
                className={`px-3 py-1.5 rounded-lg font-bold transition whitespace-nowrap cursor-pointer ${catalogCategory === 'fisik_dokumen' ? 'bg-blue-600 text-white' : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300'}`}
              >
                Kabin &amp; Inventaris
              </button>
            </div>

            <div className="p-5 flex-1 overflow-y-auto space-y-3">
              {MAINTENANCE_COMPONENT_RULES.filter(r => catalogCategory === 'all' || r.category === catalogCategory).map(rule => (
                <div key={rule.id} className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-4 space-y-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-slate-900 dark:text-white text-sm">{rule.name}</span>
                      <span className="text-xs px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-medium">
                        {rule.categoryLabel}
                      </span>
                    </div>
                    <span className={`text-xs px-2.5 py-0.5 rounded-md font-bold border ${rule.urgencyLevel === 'kritis' ? 'bg-rose-50 dark:bg-rose-500/15 text-rose-700 dark:text-rose-400 border-rose-200 dark:border-rose-500/30' : 'bg-amber-50 dark:bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-500/30'}`}>
                      {rule.urgencyLevel === 'kritis' ? 'Urgensi Kritis' : 'Urgensi Waspada'}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs sm:text-sm pt-1 border-t border-slate-100 dark:border-slate-800">
                    <div>
                      <span className="text-xs font-bold text-blue-600 dark:text-blue-400 block">Jadwal Servis Rutin</span>
                      <p className="text-slate-700 dark:text-slate-300 mt-0.5">{rule.standardInterval}</p>
                    </div>

                    <div>
                      <span className="text-xs font-bold text-amber-700 dark:text-amber-400 block">Kondisi Kendala</span>
                      <p className="text-slate-700 dark:text-slate-300 mt-0.5">{rule.issueTriggerCondition}</p>
                    </div>

                    <div>
                      <span className="text-xs font-bold text-rose-700 dark:text-rose-400 block">Tindakan Segera</span>
                      <p className="text-rose-700 dark:text-rose-200 mt-0.5">{rule.immediateAction}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="px-5 py-3.5 bg-slate-50 dark:bg-slate-950 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end">
              <button
                onClick={() => setShowCatalogModal(false)}
                className="px-4 py-2 rounded-lg bg-slate-900 dark:bg-slate-800 hover:bg-slate-800 dark:hover:bg-slate-700 text-white font-semibold text-xs sm:text-sm transition cursor-pointer"
              >
                Tutup Katalog
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Konfirmasi Hapus Laporan Checklist (Khusus Super Admin) */}
      {deleteConfirmChecklist && isSuperAdmin && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-rose-500/40 rounded-2xl max-w-md w-full overflow-hidden">
            <div className="px-5 py-4 bg-white dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-lg bg-rose-50 dark:bg-rose-500/20 border border-rose-200 dark:border-rose-500/30 flex items-center justify-center text-rose-600 dark:text-rose-400 shrink-0">
                  <Trash2 className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    Hapus Laporan Checklist
                  </h3>
                  <p className="text-xs font-semibold text-rose-600 dark:text-rose-400">
                    Otorisasi Super Admin
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setDeleteConfirmChecklist(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-3 text-sm">
              <p className="text-slate-600 dark:text-slate-300 leading-relaxed">
                Apakah Anda yakin ingin menghapus data checklist pemeriksaan armada ini secara permanen?
              </p>
              <div className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-3.5 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Driver:</span>
                  <span className="font-bold text-slate-900 dark:text-white">{deleteConfirmChecklist.driverName}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Armada:</span>
                  <span className="font-mono font-bold text-slate-900 dark:text-amber-300">{deleteConfirmChecklist.plateNumber}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Waktu:</span>
                  <span className="font-mono text-slate-700 dark:text-slate-200">{deleteConfirmChecklist.date} · {deleteConfirmChecklist.time} WIB</span>
                </div>
              </div>
            </div>

            <div className="px-5 py-3.5 bg-slate-50 dark:bg-slate-950 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setDeleteConfirmChecklist(null)}
                className="px-4 py-2 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 text-slate-700 dark:text-slate-300 font-semibold text-xs sm:text-sm transition cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={() => {
                  driverChecklistService.deleteChecklist(deleteConfirmChecklist.id);
                  loadChecklists();
                  addNotification(
                    'schedule',
                    'Checklist Berhasil Dihapus',
                    `Data checklist armada ${deleteConfirmChecklist.plateNumber} (${deleteConfirmChecklist.driverName}) telah dihapus oleh Super Admin.`
                  );
                  setDeleteConfirmChecklist(null);
                }}
                className="px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-semibold text-xs sm:text-sm flex items-center gap-1.5 transition cursor-pointer"
              >
                <Trash2 className="w-4 h-4" />
                <span>Ya, Hapus</span>
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
