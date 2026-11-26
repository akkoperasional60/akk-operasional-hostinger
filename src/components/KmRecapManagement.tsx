import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Download,
  Edit3,
  Fuel,
  Gauge,
  RefreshCw,
  Search,
  Truck,
  X,
} from 'lucide-react';
import { Crew, Fleet, Schedule } from '../types';
import { logisticsStore } from '../services/store';
import { branchStore } from '../services/branchStore';
import { sortFleetsByCanonicalOrder } from '../data/mockData';

interface KmRecapManagementProps {
  onNavigateToFuel?: () => void;
  embedded?: boolean;
  branchFilterExternal?: 'all' | 'cab-banyuwangi' | 'cab-sidoarjo';
}

type KmRowStatus = 'valid' | 'waiting_end' | 'waiting_start' | 'anomaly';

interface KmRecapRow {
  scheduleId: string;
  dateIso: string;
  branchId: 'cab-banyuwangi' | 'cab-sidoarjo';
  fleetId: string;
  initialCode: string;
  plateNumber: string;
  vehicleType: string;
  kmStart: number;
  kmEnd: number;
  distanceKm: number;
  driverName: string;
  helperName: string;
  destination: string;
  tripPhaseLabel: string;
  kmStatus: KmRowStatus;
  anomalyReason?: string;
  kmEndAt?: string;
}

const MONTHS_SHORT_ID = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
const WEEKDAYS_ID = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];

const formatDateShort = (iso: string): string => {
  if (!iso || iso.length < 10) return iso || '-';
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  if (!y || !m || !d) return iso;
  return `${String(d).padStart(2, '0')} ${MONTHS_SHORT_ID[m - 1] || ''} ${y}`;
};

const formatWeekdayShort = (iso: string): string => {
  if (!iso || iso.length < 10) return '';
  const dt = new Date(`${iso.slice(0, 10)}T12:00:00`);
  if (Number.isNaN(dt.getTime())) return '';
  return WEEKDAYS_ID[dt.getDay()] || '';
};

const resolveScheduleDate = (s: Schedule): string => {
  const raw = s.deliveryDate || s.departureDate || s.createdAt || '';
  const match = String(raw).match(/^\d{4}-\d{2}-\d{2}/);
  return match ? match[0] : '';
};

const resolveScheduleBranch = (s: Schedule): 'cab-banyuwangi' | 'cab-sidoarjo' => {
  const extra = s as Schedule & { originBranchId?: string; branchId?: string };
  if (extra.originBranchId === 'cab-sidoarjo' || extra.branchId === 'cab-sidoarjo') return 'cab-sidoarjo';
  if (extra.originBranchId === 'cab-banyuwangi' || extra.branchId === 'cab-banyuwangi') return 'cab-banyuwangi';
  const explicit = branchStore.getExplicitScheduleBranchId(s.id);
  if (explicit === 'cab-sidoarjo') return 'cab-sidoarjo';
  const origin = String(s.originName || '').toLowerCase();
  if (/sidoarjo|surabaya/.test(origin)) return 'cab-sidoarjo';
  const fleetBranch = s.fleet?.branchId || branchStore.getFleetBranchId(s.fleetId, s.fleet?.plateNumber, s.fleet?.initialCode);
  return fleetBranch === 'cab-sidoarjo' ? 'cab-sidoarjo' : 'cab-banyuwangi';
};

export const KmRecapManagement: React.FC<KmRecapManagementProps> = ({
  onNavigateToFuel,
  embedded = false,
  branchFilterExternal,
}) => {
  const [schedules, setSchedules] = useState<Schedule[]>(() => logisticsStore.getSchedules());
  const [fleets, setFleets] = useState<Fleet[]>(() => logisticsStore.getFleets());
  const [crews, setCrews] = useState<Crew[]>(() => logisticsStore.getCrews());

  const [branchFilter, setBranchFilter] = useState<'all' | 'cab-banyuwangi' | 'cab-sidoarjo'>(
    branchFilterExternal || 'all'
  );
  const [monthFilter, setMonthFilter] = useState<string>('all');
  const [fleetFilter, setFleetFilter] = useState<string>('all');
  const [driverFilter, setDriverFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | KmRowStatus>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Admin correction modal
  const [editingRow, setEditingRow] = useState<KmRecapRow | null>(null);
  const [editStartKm, setEditStartKm] = useState<string>('');
  const [editEndKm, setEditEndKm] = useState<string>('');
  const [editError, setEditError] = useState<string>('');

  useEffect(() => {
    if (branchFilterExternal) {
      setBranchFilter(branchFilterExternal);
    }
  }, [branchFilterExternal]);

  useEffect(() => {
    return logisticsStore.subscribe(() => {
      setSchedules([...logisticsStore.getSchedules()]);
      setFleets([...logisticsStore.getFleets()]);
      setCrews([...logisticsStore.getCrews()]);
    });
  }, []);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await logisticsStore.hydrateOperationalDataFromHostinger(true);
      setSchedules([...logisticsStore.getSchedules()]);
      setFleets([...logisticsStore.getFleets()]);
    } finally {
      setIsRefreshing(false);
    }
  };

  const canonicalFleets = useMemo(() => {
    const valid = fleets.filter(f => {
      const cleanPlate = String(f.plateNumber || '').replace(/\s+/g, '').toUpperCase();
      return cleanPlate && !/^FLT-\d+$/i.test(f.plateNumber || '') && !cleanPlate.endsWith('AKK');
    });
    return sortFleetsByCanonicalOrder(valid);
  }, [fleets]);

  const rows = useMemo<KmRecapRow[]>(() => {
    return schedules
      .map((s): KmRecapRow | null => {
        const dateIso = resolveScheduleDate(s);
        if (!dateIso) return null;
        const branchId = resolveScheduleBranch(s);
        const matchedFleet =
          s.fleet ||
          fleets.find(f => f.id === s.fleetId) ||
          logisticsStore.findFleetByCodeOrPlate(s.armada || s.fleetId);

        const initialCode = matchedFleet?.initialCode || s.armada || '-';
        const plateNumber = matchedFleet?.plateNumber || '-';
        const vehicleType = matchedFleet?.vehicleType || '-';

        const kmStart = Number(s.crewOdometerStart || 0);
        const kmEnd = Number(s.crewOdometerEnd || 0);

        const driverObj =
          s.portalCrew ||
          s.crew ||
          (s.portalCrewId ? crews.find(c => c.id === s.portalCrewId) : undefined) ||
          (s.crewId ? crews.find(c => c.id === s.crewId) : undefined);
        const helperObj =
          s.portalCrewHelper ||
          s.crewHelper ||
          (s.portalCrewHelperId ? crews.find(c => c.id === s.portalCrewHelperId) : undefined) ||
          (s.crewHelperId ? crews.find(c => c.id === s.crewHelperId) : undefined);

        const driverName = driverObj?.name || 'Belum diisi';
        const helperName = helperObj?.name || '-';
        const destination = s.areaName || s.store?.storeName || '-';

        const st = String(s.status || '').toLowerCase();
        const isArrived = st === 'delivered' || st === 'completed' || st === 'returned' || Boolean(s.actualArrival);
        const tripPhaseLabel = isArrived
          ? 'Tiba di Gudang'
          : st === 'in_transit' || st === 'picked_up'
          ? 'Sedang Kirim'
          : 'Terjadwal';

        let kmStatus: KmRowStatus = 'waiting_start';
        let anomalyReason: string | undefined;
        let distanceKm = 0;

        if (kmStart > 0 && kmEnd > 0) {
          distanceKm = kmEnd - kmStart;
          if (distanceKm <= 0) {
            kmStatus = 'anomaly';
            anomalyReason = 'KM pulang <= KM berangkat';
            distanceKm = 0;
          } else if (distanceKm > 1500) {
            kmStatus = 'anomaly';
            anomalyReason = 'Jarak melebihi 1.500 KM / ritase';
          } else {
            kmStatus = 'valid';
          }
        } else if (kmStart > 0) {
          kmStatus = 'waiting_end';
        } else {
          kmStatus = 'waiting_start';
        }

        return {
          scheduleId: s.id,
          dateIso,
          branchId,
          fleetId: matchedFleet?.id || s.fleetId || '',
          initialCode,
          plateNumber,
          vehicleType,
          kmStart: Number.isFinite(kmStart) && kmStart > 0 ? kmStart : 0,
          kmEnd: Number.isFinite(kmEnd) && kmEnd > 0 ? kmEnd : 0,
          distanceKm,
          driverName,
          helperName,
          destination,
          tripPhaseLabel,
          kmStatus,
          anomalyReason,
          kmEndAt: s.crewOdometerEndAt,
        };
      })
      .filter((r): r is KmRecapRow => Boolean(r))
      .sort((a, b) => b.dateIso.localeCompare(a.dateIso) || a.initialCode.localeCompare(b.initialCode));
  }, [schedules, fleets, crews]);

  const branchScopedRows = useMemo(() => {
    if (branchFilter === 'all') return rows;
    return rows.filter(r => r.branchId === branchFilter);
  }, [rows, branchFilter]);

  const availableMonths = useMemo(() => {
    const set = new Set<string>();
    branchScopedRows.forEach(r => {
      if (r.dateIso.length >= 7) set.add(r.dateIso.slice(0, 7));
    });
    return Array.from(set).sort((a, b) => b.localeCompare(a));
  }, [branchScopedRows]);

  const availableDrivers = useMemo(() => {
    const set = new Set<string>();
    branchScopedRows.forEach(r => {
      if (r.driverName && r.driverName !== 'Belum diisi') set.add(r.driverName);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'id'));
  }, [branchScopedRows]);

  const filteredRows = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return branchScopedRows.filter(r => {
      if (monthFilter !== 'all' && !r.dateIso.startsWith(monthFilter)) return false;
      if (fleetFilter !== 'all' && r.fleetId !== fleetFilter && r.plateNumber !== fleetFilter) return false;
      if (driverFilter !== 'all' && r.driverName !== driverFilter) return false;
      if (statusFilter !== 'all' && r.kmStatus !== statusFilter) return false;
      if (q) {
        const hay = `${r.initialCode} ${r.plateNumber} ${r.vehicleType} ${r.driverName} ${r.helperName} ${r.destination} ${r.dateIso}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [branchScopedRows, monthFilter, fleetFilter, driverFilter, statusFilter, searchQuery]);

  const kpi = useMemo(() => {
    const totalTrips = filteredRows.length;
    const totalDistanceKm = filteredRows.reduce((sum, r) => sum + (r.kmStatus === 'valid' ? r.distanceKm : 0), 0);
    const validCount = filteredRows.filter(r => r.kmStatus === 'valid').length;
    const waitingEndCount = filteredRows.filter(r => r.kmStatus === 'waiting_end').length;
    const anomalyCount = filteredRows.filter(r => r.kmStatus === 'anomaly').length;
    return {
      totalTrips,
      totalDistanceKm,
      validCount,
      waitingEndCount,
      anomalyCount,
    };
  }, [filteredRows]);

  const handleOpenEditKm = (row: KmRecapRow) => {
    setEditingRow(row);
    setEditStartKm(row.kmStart > 0 ? String(row.kmStart) : '');
    setEditEndKm(row.kmEnd > 0 ? String(row.kmEnd) : '');
    setEditError('');
  };

  const handleSaveEditKm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingRow) return;
    const startVal = editStartKm.trim() ? Number(editStartKm) : undefined;
    const endVal = editEndKm.trim() ? Number(editEndKm) : undefined;
    if (startVal !== undefined && (!Number.isFinite(startVal) || startVal <= 0)) {
      setEditError('KM Berangkat harus angka positif lebih dari 0.');
      return;
    }
    if (endVal !== undefined && (!Number.isFinite(endVal) || endVal <= 0)) {
      setEditError('KM Pulang harus angka positif lebih dari 0.');
      return;
    }
    if (startVal !== undefined && endVal !== undefined && endVal <= startVal) {
      setEditError('KM Pulang harus lebih besar dari KM Berangkat.');
      return;
    }
    logisticsStore.updateScheduleOdometer(editingRow.scheduleId, startVal, endVal);
    setEditingRow(null);
  };

  const handleExportCsv = () => {
    const headers = [
      'TGL',
      'CABANG',
      'INISIAL',
      'PLAT NOMOR',
      'JENIS MOBIL',
      'KM BERANGKAT',
      'KM PULANG',
      'JARAK KM',
      'SOPIR',
      'HELPER',
      'TUJUAN',
      'STATUS KM',
    ];
    const csvRows = filteredRows.map(r => [
      r.dateIso,
      r.branchId === 'cab-sidoarjo' ? 'Sidoarjo' : 'Nusantara',
      `"${r.initialCode}"`,
      `"${r.plateNumber}"`,
      `"${r.vehicleType}"`,
      r.kmStart || '',
      r.kmEnd || '',
      r.distanceKm || '',
      `"${r.driverName}"`,
      `"${r.helperName}"`,
      `"${r.destination}"`,
      r.kmStatus === 'valid'
        ? 'Valid / Lengkap'
        : r.kmStatus === 'waiting_end'
        ? 'Menunggu KM Pulang'
        : r.kmStatus === 'anomaly'
        ? `Anomali (${r.anomalyReason || ''})`
        : 'Belum KM Berangkat',
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...csvRows.map(x => x.join(','))].join('\n');
    const link = document.createElement('a');
    link.setAttribute('href', encodeURI(csvContent));
    link.setAttribute('download', `rekap_km_berangkat_pulang_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className={`akk-flat-fuel ${embedded ? '' : 'bg-slate-50 p-4 sm:p-6 min-h-full'} space-y-5 text-slate-900`}>
      {/* Header */}
      {!embedded && (
        <div className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1">
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
              Rekap KM Berangkat &amp; Pulang
            </h1>
            <p className="text-sm text-slate-500">
              Sinkron otomatis dari KM Awal &amp; KM Akhir driver di Portal Driver dan terhubung ke jarak tempuh Efisiensi BBM.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2.5">
            {onNavigateToFuel && (
              <button
                type="button"
                onClick={onNavigateToFuel}
                className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-sm font-semibold transition cursor-pointer"
              >
                <Fuel className="w-4 h-4 text-blue-600" />
                <span>Efisiensi BBM</span>
              </button>
            )}
            <button
              type="button"
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-sm font-semibold transition cursor-pointer disabled:opacity-60"
            >
              <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
              <span>Segarkan</span>
            </button>
            <button
              type="button"
              onClick={handleExportCsv}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold transition cursor-pointer"
            >
              <Download className="w-4 h-4" />
              <span>Ekspor CSV / Excel</span>
            </button>
          </div>
        </div>
      )}

      {/* 4 KPI Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="flex items-center justify-between text-slate-500 text-sm font-medium mb-2">
            <span>Total Ritase Kiriman</span>
            <Truck className="w-4 h-4 text-slate-400" />
          </div>
          <div className="text-2xl sm:text-3xl font-bold text-slate-900 tabular-nums">
            {kpi.totalTrips.toLocaleString('id-ID')}
          </div>
          <p className="text-xs text-slate-500 mt-1">Jadwal operasional terdata</p>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="flex items-center justify-between text-slate-500 text-sm font-medium mb-2">
            <span>Total Jarak Tempuh</span>
            <Gauge className="w-4 h-4 text-blue-600" />
          </div>
          <div className="text-2xl sm:text-3xl font-bold text-blue-600 tabular-nums">
            {kpi.totalDistanceKm.toLocaleString('id-ID')} <span className="text-base font-semibold text-slate-500">KM</span>
          </div>
          <p className="text-xs text-slate-500 mt-1">Akumulasi KM Pulang - KM Berangkat</p>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="flex items-center justify-between text-slate-500 text-sm font-medium mb-2">
            <span>KM Lengkap</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl sm:text-3xl font-bold text-emerald-600 tabular-nums">
            {kpi.validCount.toLocaleString('id-ID')}
          </div>
          <p className="text-xs text-slate-500 mt-1">Berangkat &amp; pulang tervalidasi</p>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="flex items-center justify-between text-slate-500 text-sm font-medium mb-2">
            <span>Menunggu / Anomali</span>
            {kpi.anomalyCount > 0 ? (
              <AlertTriangle className="w-4 h-4 text-rose-600" />
            ) : (
              <Clock className="w-4 h-4 text-amber-600" />
            )}
          </div>
          <div className="text-2xl sm:text-3xl font-bold text-amber-600 tabular-nums">
            {(kpi.waitingEndCount + kpi.anomalyCount).toLocaleString('id-ID')}
          </div>
          <p className="text-xs text-slate-500 mt-1">
            {kpi.waitingEndCount} menunggu pulang · {kpi.anomalyCount} anomali
          </p>
        </div>
      </div>

      {/* Compact Filter Bar */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {!branchFilterExternal && (
            <div className="inline-flex items-center gap-1 bg-slate-100 p-1 rounded-lg border border-slate-200">
              {([
                { id: 'all', label: 'Semua Cabang' },
                { id: 'cab-banyuwangi', label: 'Nusantara' },
                { id: 'cab-sidoarjo', label: 'Sidoarjo' },
              ] as const).map(b => (
                <button
                  key={b.id}
                  type="button"
                  onClick={() => {
                    setBranchFilter(b.id);
                    setFleetFilter('all');
                  }}
                  className={`px-3 py-1.5 rounded-md text-xs font-semibold transition cursor-pointer ${
                    branchFilter === b.id
                      ? 'bg-blue-600 text-white'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {b.label}
                </button>
              ))}
            </div>
          )}

          {embedded && (
            <div className="flex items-center gap-2 ml-auto">
              <button
                type="button"
                onClick={handleExportCsv}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Ekspor Rekap KM</span>
              </button>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Cari area, sopir, helper, plat..."
              className="w-full h-9 pl-9 pr-3 bg-white border border-slate-200 rounded-lg text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none"
            />
          </div>

          <select
            value={monthFilter}
            onChange={e => setMonthFilter(e.target.value)}
            aria-label="Filter Bulan"
            className="h-9 px-3 bg-white border border-slate-200 rounded-lg text-sm text-slate-800 focus:border-blue-600 focus:outline-none"
          >
            <option value="all">Semua Bulan</option>
            {availableMonths.map(m => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>

          <select
            value={fleetFilter}
            onChange={e => setFleetFilter(e.target.value)}
            aria-label="Filter Armada"
            className="h-9 px-3 bg-white border border-slate-200 rounded-lg text-sm text-slate-800 focus:border-blue-600 focus:outline-none"
          >
            <option value="all">Semua Armada</option>
            {canonicalFleets
              .filter(f => branchFilter === 'all' || branchStore.getFleetBranchId(f.id, f.plateNumber, f.initialCode) === branchFilter)
              .map(f => (
                <option key={f.id} value={f.id}>
                  {f.initialCode || f.plateNumber} ({f.plateNumber})
                </option>
              ))}
          </select>

          <select
            value={driverFilter}
            onChange={e => setDriverFilter(e.target.value)}
            aria-label="Filter Sopir"
            className="h-9 px-3 bg-white border border-slate-200 rounded-lg text-sm text-slate-800 focus:border-blue-600 focus:outline-none"
          >
            <option value="all">Semua Sopir</option>
            {availableDrivers.map(d => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>

          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value as any)}
            aria-label="Filter Status KM"
            className="h-9 px-3 bg-white border border-slate-200 rounded-lg text-sm text-slate-800 focus:border-blue-600 focus:outline-none"
          >
            <option value="all">Semua Status KM</option>
            <option value="valid">Lengkap / Valid</option>
            <option value="waiting_end">Menunggu KM Pulang</option>
            <option value="waiting_start">Belum KM Berangkat</option>
            <option value="anomaly">Anomali Jarak</option>
          </select>
        </div>
      </div>

      {/* Main Excel-Style Clean Flat Table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between">
          <span className="text-sm font-bold text-slate-900">
            Catatan Odometer Perjalanan ({filteredRows.length} Kiriman)
          </span>
          <span className="text-xs text-slate-500">
            Jarak KM terhitung otomatis: KM Pulang − KM Berangkat
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600 uppercase tracking-wide whitespace-nowrap">
                <th className="py-3 px-4">TGL</th>
                <th className="py-3 px-4">Armada &amp; Jenis Mobil</th>
                <th className="py-3 px-4 text-right">KM Berangkat</th>
                <th className="py-3 px-4 text-right">KM Pulang</th>
                <th className="py-3 px-4 text-right">Jarak KM</th>
                <th className="py-3 px-4">Sopir &amp; Helper</th>
                <th className="py-3 px-4">Tujuan</th>
                <th className="py-3 px-4 text-center">Status</th>
                <th className="py-3 px-4 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-sm">
              {filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-10 text-center text-slate-500">
                    Tidak ada data kiriman yang sesuai filter.
                  </td>
                </tr>
              ) : (
                filteredRows.map(row => (
                  <tr key={row.scheduleId} className="hover:bg-slate-50 transition-colors">
                    <td className="py-3 px-4 whitespace-nowrap">
                      <div className="font-semibold text-slate-900 tabular-nums">{formatDateShort(row.dateIso)}</div>
                      <div className="text-xs text-slate-500">
                        {formatWeekdayShort(row.dateIso)} · {row.tripPhaseLabel}
                      </div>
                    </td>

                    <td className="py-3 px-4 whitespace-nowrap">
                      <div className="font-bold text-slate-900">
                        {row.initialCode !== '-' ? `${row.initialCode} · ` : ''}
                        {row.plateNumber}
                      </div>
                      <div className="text-xs text-slate-500">{row.vehicleType}</div>
                    </td>

                    <td className="py-3 px-4 text-right whitespace-nowrap tabular-nums">
                      {row.kmStart > 0 ? (
                        <span className="font-semibold text-slate-900">
                          {row.kmStart.toLocaleString('id-ID')}
                        </span>
                      ) : (
                        <span className="text-slate-400">-</span>
                      )}
                    </td>

                    <td className="py-3 px-4 text-right whitespace-nowrap tabular-nums">
                      {row.kmEnd > 0 ? (
                        <span className="font-semibold text-slate-900">
                          {row.kmEnd.toLocaleString('id-ID')}
                        </span>
                      ) : row.kmStart > 0 ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-amber-50 border border-amber-200 text-amber-700 text-xs font-semibold">
                          Menunggu KM Pulang
                        </span>
                      ) : (
                        <span className="text-slate-400">-</span>
                      )}
                    </td>

                    <td className="py-3 px-4 text-right whitespace-nowrap tabular-nums">
                      {row.kmStatus === 'valid' ? (
                        <span className="font-bold text-blue-600 text-base">
                          {row.distanceKm.toLocaleString('id-ID')} km
                        </span>
                      ) : row.kmStatus === 'anomaly' ? (
                        <span className="font-bold text-rose-600">
                          {row.distanceKm > 0 ? `${row.distanceKm.toLocaleString('id-ID')} km` : 'Invalid'}
                        </span>
                      ) : (
                        <span className="text-slate-400">-</span>
                      )}
                    </td>

                    <td className="py-3 px-4">
                      <div className="font-semibold text-slate-900">{row.driverName}</div>
                      {row.helperName !== '-' && (
                        <div className="text-xs text-slate-500">Helper: {row.helperName}</div>
                      )}
                    </td>

                    <td className="py-3 px-4 font-medium text-slate-800">{row.destination}</td>

                    <td className="py-3 px-4 text-center whitespace-nowrap">
                      {row.kmStatus === 'valid' ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-semibold">
                          Valid / Selesai
                        </span>
                      ) : row.kmStatus === 'waiting_end' ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-amber-50 border border-amber-200 text-amber-700 text-xs font-semibold">
                          Menunggu Pulang
                        </span>
                      ) : row.kmStatus === 'anomaly' ? (
                        <span
                          title={row.anomalyReason}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold"
                        >
                          Anomali
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2.5 py-1 rounded-md bg-slate-100 border border-slate-200 text-slate-600 text-xs font-semibold">
                          Belum KM Awal
                        </span>
                      )}
                    </td>

                    <td className="py-3 px-4 text-right whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => handleOpenEditKm(row)}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold cursor-pointer"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                        <span>Koreksi</span>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Admin Edit / Correction Modal */}
      {editingRow && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 flex items-center justify-center p-4 akk-flat-fuel">
          <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-md overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-900">Koreksi Odometer Kiriman</h3>
                <p className="text-xs text-slate-500">
                  {formatDateShort(editingRow.dateIso)} · {editingRow.initialCode} ({editingRow.plateNumber}) · {editingRow.destination}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEditingRow(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEditKm} className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">KM Berangkat</label>
                  <input
                    type="number"
                    min="1"
                    max="99999999"
                    value={editStartKm}
                    onChange={e => setEditStartKm(e.target.value)}
                    placeholder="Contoh: 124510"
                    className="w-full h-10 px-3 border border-slate-200 rounded-lg text-sm font-semibold tabular-nums focus:border-blue-600 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">KM Pulang</label>
                  <input
                    type="number"
                    min="1"
                    max="99999999"
                    value={editEndKm}
                    onChange={e => setEditEndKm(e.target.value)}
                    placeholder="Contoh: 124785"
                    className="w-full h-10 px-3 border border-slate-200 rounded-lg text-sm font-semibold tabular-nums focus:border-blue-600 focus:outline-none"
                  />
                </div>
              </div>

              {Number(editStartKm) > 0 && Number(editEndKm) > Number(editStartKm) && (
                <div className="px-3 py-2 rounded-lg bg-blue-50 border border-blue-200 text-xs font-semibold text-blue-700">
                  Jarak Tempuh Terhitung: {(Number(editEndKm) - Number(editStartKm)).toLocaleString('id-ID')} KM
                </div>
              )}

              {editError && (
                <div className="px-3 py-2 rounded-lg bg-rose-50 border border-rose-200 text-xs font-semibold text-rose-700">
                  {editError}
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setEditingRow(null)}
                  className="px-4 py-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-sm font-semibold cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold cursor-pointer"
                >
                  Simpan Perubahan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default KmRecapManagement;
