import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  Award,
  Calculator,
  Calendar,
  Download,
  Edit,
  FileSpreadsheet,
  FileText,
  Plus,
  Printer,
  RefreshCw,
  Search,
  Trash2,
  X
} from 'lucide-react';
import {
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  AreaChart,
  Area
} from 'recharts';
import {
  FuelLog,
  FuelType,
  EfficiencyStatus,
  Fleet,
  Crew,
  VehicleType,
  FleetFuelSummary,
  DriverFuelScore,
  UserProfile,
  Schedule
} from '../types';
import { logisticsStore } from '../services/store';
import { branchStore } from '../services/branchStore';
import {
  FUEL_TARGET_RATIOS,
  STANDARD_FUEL_PRICES
} from '../data/fuelMockData';
import { getCanonicalFleetOrderIndex, sortFleetsByCanonicalOrder } from '../data/mockData';
import * as XLSX from 'xlsx';
import { OFFICIAL_DESTINATION_AREAS } from '../utils/areaNormalizer';
import { FuelConsumptionReportModal } from './FuelConsumptionReportModal';
import { FuelEntryFormModal } from './FuelEntryFormModal';
import { FuelWeeklyReportView } from './FuelWeeklyReportView';
import { KmRecapManagement } from './KmRecapManagement';

interface FuelEfficiencyManagementProps {
  onNavigateToFleets?: () => void;
  onNavigateToKmRecap?: () => void;
}

type ReconciledFuelLog = FuelLog & {
  distanceSource: 'portal' | 'manual';
  portalKmStart?: number;
  portalKmEnd?: number;
  portalTripCount?: number;
  originalDistanceKm: number;
};

const FUEL_TYPES: FuelType[] = ['BioSolar', 'Dexlite', 'Pertamina Dex', 'Pertalite', 'Pertamax'];
const MONTHS_FULL_ID = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
];

const compactPersonKey = (raw?: string): string =>
  (raw || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');

const normalizePlateKey = (raw?: string): string =>
  String(raw || '').replace(/\s+/g, '').toUpperCase();

const normalizeCodeKey = (raw?: string): string =>
  String(raw || '').replace(/[^a-zA-Z0-9]/g, '').toUpperCase();

const normalizeIsoDate = (raw?: string): string => {
  if (!raw) return '';
  const match = String(raw).match(/^\d{4}-\d{2}-\d{2}/);
  return match ? match[0] : '';
};

const evaluateEfficiencyStatus = (ratioKmPerLiter: number, targetRatio: number): EfficiencyStatus => {
  if (ratioKmPerLiter <= 0 || targetRatio <= 0) return 'Efisien / Normal';
  const pct = (ratioKmPerLiter / targetRatio) * 100;
  if (pct >= 105) return 'Sangat Efisien';
  if (pct >= 90) return 'Efisien / Normal';
  if (pct >= 75) return 'Boros';
  return 'Kritis / Potensi Anomali';
};

export const FuelEfficiencyManagement: React.FC<FuelEfficiencyManagementProps> = ({
  onNavigateToKmRecap
}) => {
  const [fuelLogs, setFuelLogs] = useState<FuelLog[]>(() => logisticsStore.getFuelLogs());
  const [fleets, setFleets] = useState<Fleet[]>(() => logisticsStore.getFleets());
  const [crews, setCrews] = useState<Crew[]>(() => logisticsStore.getCrews());
  const [users, setUsers] = useState<UserProfile[]>(() => logisticsStore.getUsers());
  const [schedules, setSchedules] = useState<Schedule[]>(() => logisticsStore.getSchedules());

  const [activeTab, setActiveTab] = useState<
    'overview' | 'liter_km' | 'km_recap' | 'weekly_report' | 'leaderboard' | 'logs'
  >('overview');
  const [selectedBranchFilter, setSelectedBranchFilter] = useState<'all' | 'cab-banyuwangi' | 'cab-sidoarjo'>('all');
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [isCalculatorModalOpen, setIsCalculatorModalOpen] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // L/KM Unit Analysis filters
  const [lKmSortBy, setLKmSortBy] = useState<
    'canonical_order' | 'lKm_asc' | 'lKm_desc' | 'efficiency_desc' | 'distance_desc'
  >('canonical_order');
  const [lKmFilterFleetId, setLKmFilterFleetId] = useState<string>('all');
  const [comparisonSelectedFleetId, setComparisonSelectedFleetId] = useState<string>('all');

  // Audit logs filters & pagination
  const [searchQuery, setSearchQuery] = useState('');
  const [filterFleetId, setFilterFleetId] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterFuelType] = useState<string>('all');
  const [filterSpbu, setFilterSpbu] = useState<'all' | 'Farly' | 'Gajah Mada' | 'SPBU Lain'>('all');
  const [filterDateStart, setFilterDateStart] = useState<string>('');
  const [filterDateEnd, setFilterDateEnd] = useState<string>('');
  const [filterArea, setFilterArea] = useState<string>('all');
  const [logSortBy, setLogSortBy] = useState<'date_desc' | 'date_asc' | 'efficient_asc' | 'wasteful_desc'>('date_desc');
  const [logsCurrentPage, setLogsCurrentPage] = useState<number>(1);
  const LOGS_PER_PAGE = 10;

  // Inline delete confirm & error state
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deletingLogId, setDeletingLogId] = useState<string | null>(null);
  const [fuelActionError, setFuelActionError] = useState<string>('');

  // Modal states
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingLogId, setEditingLogId] = useState<string | null>(null);
  const [selectedLogForDetail, setSelectedLogForDetail] = useState<ReconciledFuelLog | null>(null);

  // Add/Edit form states
  const [formBranchId, setFormBranchId] = useState<'cab-banyuwangi' | 'cab-sidoarjo'>('cab-banyuwangi');
  const [formFleetId, setFormFleetId] = useState<string>('');
  const [formDriverName, setFormDriverName] = useState<string>('');
  const [formDriverId, setFormDriverId] = useState<string>('');
  const [formHelperName, setFormHelperName] = useState<string>('');
  const [formHelperId, setFormHelperId] = useState<string>('');
  const [formDate, setFormDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [formFuelType, setFormFuelType] = useState<FuelType>('BioSolar');
  const [formLiters, setFormLiters] = useState<string>('');
  const [formCostPerLiter, setFormCostPerLiter] = useState<string>('6800');
  const [formStartOdo, setFormStartOdo] = useState<string>('');
  const [formEndOdo, setFormEndOdo] = useState<string>('');
  const [formGasStation, setFormGasStation] = useState<string>('SPBU Farly');
  const [isGasStationDropdownOpen, setIsGasStationDropdownOpen] = useState<boolean>(false);
  const [formRouteTrip, setFormRouteTrip] = useState<string>('');
  const [formError, setFormError] = useState<string>('');
  const [isSavingFuelLog, setIsSavingFuelLog] = useState<boolean>(false);
  const [hoveredChartFleetId, setHoveredChartFleetId] = useState<string | null>(null);

  // Dropdown popovers inside modal / overview
  const [activeModalDropdown, setActiveModalDropdown] = useState<
    'fleet' | 'driver' | 'helper' | 'area' | 'date' | 'fuel' | null
  >(null);
  const [fleetSearchFilter, setFleetSearchFilter] = useState<string>('');
  const [driverSearchFilter, setDriverSearchFilter] = useState<string>('');
  const [helperSearchFilter, setHelperSearchFilter] = useState<string>('');
  const [areaSearchFilter, setAreaSearchFilter] = useState<string>('');
  const [calendarViewMonth, setCalendarViewMonth] = useState<Date>(() => new Date());

  // Calculator modal states
  const [calcFleetType, setCalcFleetType] = useState<VehicleType>('Engkel Long');
  const [calcDistanceKm, setCalcDistanceKm] = useState<number>(620);
  const [calcSelectedRoute, setCalcSelectedRoute] = useState<string>('bwi-sby-pp');
  const [calcFuelType, setCalcFuelType] = useState<FuelType>('BioSolar');
  const [calcCustomPrice, setCalcCustomPrice] = useState<number>(STANDARD_FUEL_PRICES['BioSolar'] || 6800);
  const [calcCargoBoxes, setCalcCargoBoxes] = useState<number>(12000);

  const modalDropdownRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    logisticsStore.refreshUsersFromHostinger?.().catch(() => {});
    logisticsStore.refreshFuelLogsFromServer?.().catch(() => {});
    return logisticsStore.subscribe(() => {
      setFuelLogs([...logisticsStore.getFuelLogs()]);
      setFleets([...logisticsStore.getFleets()]);
      setCrews([...logisticsStore.getCrews()]);
      setUsers([...logisticsStore.getUsers()]);
      setSchedules([...logisticsStore.getSchedules()]);
    });
  }, []);

  useEffect(() => {
    setLogsCurrentPage(1);
  }, [searchQuery, filterFleetId, filterSpbu, filterStatus, filterFuelType, filterDateStart, filterDateEnd, filterArea, logSortBy, selectedBranchFilter]);

  useEffect(() => {
    if (!activeModalDropdown && !isGasStationDropdownOpen) return;
    const handlePointerDown = (e: MouseEvent) => {
      if (modalDropdownRef.current && !modalDropdownRef.current.contains(e.target as Node)) {
        setActiveModalDropdown(null);
        setIsGasStationDropdownOpen(false);
      }
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setActiveModalDropdown(null);
        setIsGasStationDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKey);
    };
  }, [activeModalDropdown, isGasStationDropdownOpen]);

  const handleRefreshAll = async () => {
    setIsRefreshing(true);
    try {
      await Promise.all([
        logisticsStore.refreshFuelLogsFromServer?.(),
        logisticsStore.hydrateOperationalDataFromHostinger?.(true)
      ]);
      setFuelLogs([...logisticsStore.getFuelLogs()]);
      setSchedules([...logisticsStore.getSchedules()]);
      setFleets([...logisticsStore.getFleets()]);
    } finally {
      setIsRefreshing(false);
    }
  };

  const resolveFleetBranchId = (fleet: Fleet): 'cab-banyuwangi' | 'cab-sidoarjo' => {
    const resolved = branchStore.getFleetBranchId(fleet.id, fleet.plateNumber, fleet.initialCode);
    return resolved === 'cab-sidoarjo' ? 'cab-sidoarjo' : 'cab-banyuwangi';
  };

  const resolveLogBranchId = (log: FuelLog): 'cab-banyuwangi' | 'cab-sidoarjo' => {
    const resolved = log.branchId || branchStore.getFleetBranchId(log.fleetId, log.plateNumber, log.initialCode);
    return resolved === 'cab-sidoarjo' ? 'cab-sidoarjo' : 'cab-banyuwangi';
  };

  const resolveScheduleBranchId = (s: Schedule): 'cab-banyuwangi' | 'cab-sidoarjo' => {
    const extra = s as Schedule & { originBranchId?: string; branchId?: string };
    if (extra.originBranchId === 'cab-sidoarjo' || extra.branchId === 'cab-sidoarjo') return 'cab-sidoarjo';
    if (extra.originBranchId === 'cab-banyuwangi' || extra.branchId === 'cab-banyuwangi') return 'cab-banyuwangi';
    const explicit = branchStore.getExplicitScheduleBranchId(s.id);
    if (explicit === 'cab-sidoarjo') return 'cab-sidoarjo';
    const fleetBranch = s.fleet?.branchId || branchStore.getFleetBranchId(s.fleetId, s.fleet?.plateNumber, s.fleet?.initialCode);
    return fleetBranch === 'cab-sidoarjo' ? 'cab-sidoarjo' : 'cab-banyuwangi';
  };

  const cleanCanonicalFleets = useMemo(() => {
    const seenPlates = new Set<string>();
    const valid = fleets.filter(f => {
      const plate = String(f.plateNumber || '').trim();
      const clean = plate.replace(/\s+/g, '').toUpperCase();
      if (!clean || /^FLT-\d+$/i.test(plate) || clean.endsWith('AKK')) return false;
      if (seenPlates.has(clean)) return false;
      seenPlates.add(clean);
      return true;
    });
    return sortFleetsByCanonicalOrder(valid);
  }, [fleets]);

  const resolveFleetForLog = (
    log: Partial<FuelLog> & { fleetId?: string; plateNumber?: string; initialCode?: string }
  ): Fleet | undefined => {
    const pool = cleanCanonicalFleets.length > 0 ? cleanCanonicalFleets : fleets;
    if (log.fleetId) {
      const byId = pool.find(fl => fl.id === log.fleetId) || fleets.find(fl => fl.id === log.fleetId);
      if (byId) {
        const byIdPlate = normalizePlateKey(byId.plateNumber);
        const canonicalByPlate = byIdPlate ? pool.find(fl => normalizePlateKey(fl.plateNumber) === byIdPlate) : undefined;
        return canonicalByPlate || byId;
      }
    }
    const targetPlate = normalizePlateKey(log.plateNumber);
    if (targetPlate && !/^FLT\d+$/i.test(targetPlate)) {
      const byPlate = pool.find(fl => normalizePlateKey(fl.plateNumber) === targetPlate);
      if (byPlate) return byPlate;
    }
    const candidates = [log.initialCode, log.fleetId]
      .filter(Boolean)
      .flatMap(val => [String(val), ...String(val).split('/')])
      .map(v => normalizeCodeKey(v))
      .filter(Boolean);
    if (candidates.length > 0) {
      const byCode = pool.find(fl => {
        const flFull = normalizeCodeKey(fl.initialCode);
        const flTokens = String(fl.initialCode || '').split('/').map(t => normalizeCodeKey(t)).filter(Boolean);
        return candidates.some(c => c === flFull || flTokens.includes(c));
      });
      if (byCode) return byCode;
    }
    return logisticsStore.findFleetByCodeOrPlate(log.initialCode || log.plateNumber || log.fleetId);
  };

  // Build map of Driver Portal completed KM trips indexed by `${canonicalFleetKey}|${dateIso}`
  const portalKmByFleetDate = useMemo(() => {
    const map = new Map<
      string,
      {
        fleetKey: string;
        dateIso: string;
        totalDistanceKm: number;
        minStartKm: number;
        maxEndKm: number;
        tripCount: number;
      }
    >();

    schedules.forEach(s => {
      if (selectedBranchFilter !== 'all' && resolveScheduleBranchId(s) !== selectedBranchFilter) return;
      const kmStart = Number(s.crewOdometerStart || 0);
      const kmEnd = Number(s.crewOdometerEnd || 0);
      if (!(kmStart > 0 && kmEnd > kmStart)) return;
      const dist = kmEnd - kmStart;
      if (dist <= 0 || dist > 1500) return;

      const dateIso = normalizeIsoDate(s.deliveryDate || s.departureDate || s.createdAt);
      if (!dateIso) return;

      const matchedFleet =
        s.fleet ||
        fleets.find(f => f.id === s.fleetId) ||
        logisticsStore.findFleetByCodeOrPlate(s.armada || s.fleetId);
      const plateKey = normalizePlateKey(matchedFleet?.plateNumber);
      const fleetKey = plateKey || matchedFleet?.id || normalizeCodeKey(s.armada || s.fleetId);
      if (!fleetKey) return;

      const bucketKey = `${fleetKey}|${dateIso}`;
      const existing = map.get(bucketKey);
      if (!existing) {
        map.set(bucketKey, {
          fleetKey,
          dateIso,
          totalDistanceKm: dist,
          minStartKm: kmStart,
          maxEndKm: kmEnd,
          tripCount: 1
        });
      } else {
        existing.totalDistanceKm += dist;
        existing.minStartKm = Math.min(existing.minStartKm, kmStart);
        existing.maxEndKm = Math.max(existing.maxEndKm, kmEnd);
        existing.tripCount += 1;
      }
    });

    return map;
  }, [schedules, fleets, selectedBranchFilter]);

  const portalGlobalStats = useMemo(() => {
    let completedTrips = 0;
    let waitingEndTrips = 0;
    let totalPortalDistanceKm = 0;
    const dailyPortalDistance = new Map<string, number>();

    schedules.forEach(s => {
      if (selectedBranchFilter !== 'all' && resolveScheduleBranchId(s) !== selectedBranchFilter) return;
      const kmStart = Number(s.crewOdometerStart || 0);
      const kmEnd = Number(s.crewOdometerEnd || 0);
      if (kmStart > 0 && kmEnd > kmStart && (kmEnd - kmStart) <= 1500) {
        const dist = kmEnd - kmStart;
        completedTrips += 1;
        totalPortalDistanceKm += dist;
        const dateIso = normalizeIsoDate(s.deliveryDate || s.departureDate || s.createdAt);
        if (dateIso) {
          dailyPortalDistance.set(dateIso, (dailyPortalDistance.get(dateIso) || 0) + dist);
        }
      } else if (kmStart > 0) {
        waitingEndTrips += 1;
      }
    });

    return { completedTrips, waitingEndTrips, totalPortalDistanceKm, dailyPortalDistance };
  }, [schedules, selectedBranchFilter]);

  const branchScopedFleets = useMemo(() => {
    if (selectedBranchFilter === 'all') return cleanCanonicalFleets;
    return cleanCanonicalFleets.filter(f => resolveFleetBranchId(f) === selectedBranchFilter);
  }, [cleanCanonicalFleets, selectedBranchFilter]);

  // Reconcile FuelLogs with Driver Portal KM Awal & KM Akhir automatically
  const reconciledLogs = useMemo<ReconciledFuelLog[]>(() => {
    const rawScoped =
      selectedBranchFilter === 'all'
        ? fuelLogs
        : fuelLogs.filter(l => resolveLogBranchId(l) === selectedBranchFilter);

    // Count how many fuel logs share the same (fleetKey, dateIso) so multiple fills on 1 day don't double-count portal trip km
    const bucketLogCounts = new Map<string, number>();
    const resolvedFleetKeys = rawScoped.map(log => {
      const flt = resolveFleetForLog(log);
      const fleetKey =
        normalizePlateKey(flt?.plateNumber || log.plateNumber) ||
        flt?.id ||
        normalizeCodeKey(log.initialCode || log.fleetId);
      const dateIso = normalizeIsoDate(log.date);
      const bKey = `${fleetKey}|${dateIso}`;
      bucketLogCounts.set(bKey, (bucketLogCounts.get(bKey) || 0) + 1);
      return { log, flt, bKey };
    });

    const consumedPortalBuckets = new Set<string>();

    return resolvedFleetKeys.map(({ log, flt, bKey }) => {
      const portalMatch = portalKmByFleetDate.get(bKey);
      const targetRatio =
        FUEL_TARGET_RATIOS[flt?.vehicleType || log.vehicleType]?.target || log.targetRatio || 7.5;

      if (portalMatch && !consumedPortalBuckets.has(bKey)) {
        consumedPortalBuckets.add(bKey);
        const distanceKm = portalMatch.totalDistanceKm;
        const ratioKmPerLiter =
          log.liters > 0 ? Number((distanceKm / log.liters).toFixed(2)) : log.ratioKmPerLiter;
        const efficiencyStatus = evaluateEfficiencyStatus(ratioKmPerLiter, targetRatio);

        return {
          ...log,
          distanceKm,
          startOdometerKm: portalMatch.minStartKm,
          endOdometerKm: portalMatch.maxEndKm,
          ratioKmPerLiter,
          targetRatio,
          efficiencyStatus,
          distanceSource: 'portal',
          portalKmStart: portalMatch.minStartKm,
          portalKmEnd: portalMatch.maxEndKm,
          portalTripCount: portalMatch.tripCount,
          originalDistanceKm: log.distanceKm
        };
      }

      return {
        ...log,
        distanceSource: 'manual',
        originalDistanceKm: log.distanceKm
      };
    });
  }, [fuelLogs, selectedBranchFilter, portalKmByFleetDate, cleanCanonicalFleets, fleets]);

  const portalSyncedLogCount = useMemo(
    () => reconciledLogs.filter(l => l.distanceSource === 'portal').length,
    [reconciledLogs]
  );

  // Branch-scoped Fleet Summaries
  const fleetSummaries: FleetFuelSummary[] = useMemo(() => {
    return branchScopedFleets.map(fleet => {
      const logs = reconciledLogs.filter(
        l =>
          l.fleetId === fleet.id ||
          (l.plateNumber && normalizePlateKey(l.plateNumber) === normalizePlateKey(fleet.plateNumber))
      );
      const totalLogs = logs.length;
      const totalLiters = logs.reduce((acc, l) => acc + l.liters, 0);
      const totalCost = logs.reduce((acc, l) => acc + l.totalCost, 0);
      const totalDistanceKm = logs.reduce((acc, l) => acc + l.distanceKm, 0);

      const targetConfig =
        FUEL_TARGET_RATIOS[fleet.vehicleType] || { target: 7.5, minAcceptable: 6.4, label: '7.5 KM / L' };
      const targetRatio = targetConfig.target;
      const avgKmPerLiter =
        totalLiters > 0 && totalDistanceKm > 0 ? Number((totalDistanceKm / totalLiters).toFixed(2)) : 0;
      const avgLiterPerKm =
        totalDistanceKm > 0 && totalLiters > 0 ? Number((totalLiters / totalDistanceKm).toFixed(4)) : 0;
      const avgLiterPer100Km =
        totalDistanceKm > 0 && totalLiters > 0 ? Number(((totalLiters / totalDistanceKm) * 100).toFixed(2)) : 0;
      const targetLiterPerKm = targetRatio > 0 ? Number((1 / targetRatio).toFixed(4)) : 0;
      const targetLiterPer100Km = targetRatio > 0 ? Number((100 / targetRatio).toFixed(2)) : 0;

      const avgCostPerKm = totalDistanceKm > 0 ? Math.round(totalCost / totalDistanceKm) : 0;
      const efficiencyScore =
        totalDistanceKm > 0 && targetRatio > 0 ? Math.round((avgKmPerLiter / targetRatio) * 100) : 0;
      const anomaliesCount = logs.filter(
        l => l.efficiencyStatus === 'Boros' || l.efficiencyStatus === 'Kritis / Potensi Anomali'
      ).length;

      let status: EfficiencyStatus = 'Efisien / Normal';
      if (totalLogs === 0 || totalDistanceKm === 0) {
        status = 'Efisien / Normal';
      } else if (efficiencyScore >= 105) {
        status = 'Sangat Efisien';
      } else if (efficiencyScore >= 90) {
        status = 'Efisien / Normal';
      } else if (efficiencyScore >= 75) {
        status = 'Boros';
      } else {
        status = 'Kritis / Potensi Anomali';
      }

      return {
        fleetId: fleet.id,
        plateNumber: fleet.plateNumber,
        initialCode: fleet.initialCode,
        vehicleType: fleet.vehicleType,
        totalLogs,
        totalLiters,
        totalCost,
        totalDistanceKm,
        avgKmPerLiter,
        avgLiterPerKm,
        avgLiterPer100Km,
        targetRatio,
        targetLiterPerKm,
        targetLiterPer100Km,
        avgCostPerKm,
        efficiencyScore,
        status,
        anomaliesCount
      };
    });
  }, [branchScopedFleets, reconciledLogs]);

  // Driver Eco Scores
  const driverScores: DriverFuelScore[] = useMemo(() => {
    const driverMap = new Map<string, { driverId: string; driverName: string; logs: ReconciledFuelLog[] }>();
    reconciledLogs.forEach(log => {
      const displayName = (log.driverName || 'Driver Tidak Terdaftar').trim();
      const key = compactPersonKey(displayName) || displayName.toLowerCase();
      if (!driverMap.has(key)) {
        driverMap.set(key, {
          driverId: log.driverId || key,
          driverName: displayName,
          logs: []
        });
      } else if (displayName.length > driverMap.get(key)!.driverName.length) {
        driverMap.get(key)!.driverName = displayName;
      }
      driverMap.get(key)!.logs.push(log);
    });

    const scores: DriverFuelScore[] = Array.from(driverMap.values()).map(item => {
      const totalTrips = item.logs.length;
      const totalDistanceKm = item.logs.reduce((acc, l) => acc + l.distanceKm, 0);
      const totalLiters = item.logs.reduce((acc, l) => acc + l.liters, 0);
      const avgKmPerLiter = totalLiters > 0 ? Number((totalDistanceKm / totalLiters).toFixed(2)) : 0;

      const avgEfficiencyRatio =
        item.logs.reduce((acc, l) => acc + l.ratioKmPerLiter / (l.targetRatio || 7.5), 0) / (totalTrips || 1);
      const ecoDrivingScore = Math.min(100, Math.max(40, Math.round(avgEfficiencyRatio * 90)));

      let badge: 'Master Eco-Driver' | 'Driver Efisien' | 'Perlu Pembinaan' = 'Driver Efisien';
      let recommendation = 'Menjaga kecepatan stabil dan pola perpindahan gigi yang tepat.';

      if (ecoDrivingScore >= 90) {
        badge = 'Master Eco-Driver';
        recommendation = 'Pengemudi teladan dengan akselerasi halus dan efisiensi BBM stabil.';
      } else if (ecoDrivingScore < 75) {
        badge = 'Perlu Pembinaan';
        recommendation = 'Evaluasi durasi idling saat antre muat dan hindari akselerasi berlebih.';
      }

      return {
        driverId: item.driverId,
        driverName: item.driverName,
        totalTrips,
        totalDistanceKm,
        totalLiters,
        avgKmPerLiter,
        ecoDrivingScore,
        ranking: 0,
        badge,
        recommendation
      };
    });

    scores.sort((a, b) => b.ecoDrivingScore - a.ecoDrivingScore);
    scores.forEach((s, idx) => {
      s.ranking = idx + 1;
    });
    return scores;
  }, [reconciledLogs]);

  // Branch-scoped KPI Summary
  const kpiSummary = useMemo(() => {
    const totalLiters = Number(reconciledLogs.reduce((acc, l) => acc + l.liters, 0).toFixed(2));
    const totalCost = reconciledLogs.reduce((acc, l) => acc + l.totalCost, 0);
    const totalDistanceKm = reconciledLogs.reduce((acc, l) => acc + l.distanceKm, 0);
    const overallAvgKmPerLiter = totalLiters > 0 ? Number((totalDistanceKm / totalLiters).toFixed(2)) : 0;
    const overallAvgLiterPerKm = totalDistanceKm > 0 ? Number((totalLiters / totalDistanceKm).toFixed(4)) : 0;
    const overallAvgLiterPer100Km =
      totalDistanceKm > 0 ? Number(((totalLiters / totalDistanceKm) * 100).toFixed(2)) : 0;
    const overallAvgCostPerKm = totalDistanceKm > 0 ? Math.round(totalCost / totalDistanceKm) : 0;
    const totalAnomalies = reconciledLogs.filter(
      l => l.efficiencyStatus === 'Boros' || l.efficiencyStatus === 'Kritis / Potensi Anomali'
    ).length;

    const activeFleets = fleetSummaries.filter(f => f.totalLogs > 0);
    const sortedFleets = [...(activeFleets.length > 0 ? activeFleets : fleetSummaries)].sort(
      (a, b) => b.efficiencyScore - a.efficiencyScore
    );
    const topFleet = sortedFleets[0];
    const leastFleet = sortedFleets[sortedFleets.length - 1];

    return {
      totalLiters,
      totalCost,
      totalDistanceKm,
      overallAvgKmPerLiter,
      overallAvgLiterPerKm,
      overallAvgLiterPer100Km,
      overallAvgCostPerKm,
      totalAnomalies,
      topFleet,
      leastFleet,
      totalRecords: reconciledLogs.length
    };
  }, [reconciledLogs, fleetSummaries]);

  // Chart Data: Timeline fuel consumption & distance (merging portal KM dates)
  const timelineChartData = useMemo(() => {
    const map = new Map<string, { fullDate: string; date: string; liters: number; distance: number }>();
    reconciledLogs.forEach(l => {
      const iso = normalizeIsoDate(l.date);
      if (!iso) return;
      if (!map.has(iso)) {
        map.set(iso, { fullDate: iso, date: iso.slice(5), liters: 0, distance: 0 });
      }
      const item = map.get(iso)!;
      item.liters = Number((item.liters + l.liters).toFixed(2));
      item.distance += l.distanceKm;
    });

    // Include portal distance dates that don't have refuels yet
    portalGlobalStats.dailyPortalDistance.forEach((dist, iso) => {
      if (!map.has(iso)) {
        map.set(iso, { fullDate: iso, date: iso.slice(5), liters: 0, distance: dist });
      }
    });

    return Array.from(map.values())
      .sort((a, b) => a.fullDate.localeCompare(b.fullDate))
      .slice(-10);
  }, [reconciledLogs, portalGlobalStats]);

  // Unit Vehicles L/KM analysis
  const unitLKmAnalysis = useMemo(() => {
    const orderedSummaries = [...fleetSummaries].sort(
      (a, b) =>
        getCanonicalFleetOrderIndex(a.initialCode || a.plateNumber) -
        getCanonicalFleetOrderIndex(b.initialCode || b.plateNumber)
    );

    const list = orderedSummaries.map(fs => {
      const hasData = fs.totalDistanceKm > 0 && fs.totalLiters > 0;
      const avgLKm = hasData ? Number((fs.totalLiters / fs.totalDistanceKm).toFixed(4)) : 0;
      const avgL100Km = hasData ? Number(((fs.totalLiters / fs.totalDistanceKm) * 100).toFixed(2)) : 0;
      const targetLKm = fs.targetRatio > 0 ? Number((1 / fs.targetRatio).toFixed(4)) : 0;
      const targetL100Km = fs.targetRatio > 0 ? Number((100 / fs.targetRatio).toFixed(2)) : 0;

      const savingPct = hasData && targetLKm > 0 ? Number((((targetLKm - avgLKm) / targetLKm) * 100).toFixed(1)) : 0;
      const isSaving = savingPct >= 0;
      const avgCostPerKm = hasData ? Math.round(fs.totalCost / fs.totalDistanceKm) : 0;

      const unitLogs = reconciledLogs.filter(
        l =>
          l.fleetId === fs.fleetId ||
          (l.plateNumber && normalizePlateKey(l.plateNumber) === normalizePlateKey(fs.plateNumber))
      );
      const latestLog = [...unitLogs].sort((a, b) => (b.date || '').localeCompare(a.date || ''))[0];
      const hasPortalKm = unitLogs.some(l => l.distanceSource === 'portal');

      return {
        ...fs,
        hasData,
        hasPortalKm,
        avgLKm,
        avgL100Km,
        targetLKm,
        targetL100Km,
        avgCostPerKm,
        savingPct,
        isSaving,
        driverName: latestLog?.driverName || '-',
        areaKirim: latestLog?.routeTrip || '-'
      };
    });

    const filtered = list.filter(item => lKmFilterFleetId === 'all' || item.fleetId === lKmFilterFleetId);

    return filtered.sort((a, b) => {
      if (lKmSortBy === 'lKm_asc') return a.avgLKm - b.avgLKm;
      if (lKmSortBy === 'lKm_desc') return b.avgLKm - a.avgLKm;
      if (lKmSortBy === 'efficiency_desc') return b.efficiencyScore - a.efficiencyScore;
      if (lKmSortBy === 'distance_desc') return b.totalDistanceKm - a.totalDistanceKm;
      return (
        getCanonicalFleetOrderIndex(a.initialCode || a.plateNumber) -
        getCanonicalFleetOrderIndex(b.initialCode || b.plateNumber)
      );
    });
  }, [fleetSummaries, reconciledLogs, lKmFilterFleetId, lKmSortBy]);

  const lKmComparisonChartData = useMemo(() => {
    const orderedSummaries = [...fleetSummaries].sort(
      (a, b) =>
        getCanonicalFleetOrderIndex(a.initialCode || a.plateNumber) -
        getCanonicalFleetOrderIndex(b.initialCode || b.plateNumber)
    );
    const mapped = orderedSummaries.map(fs => {
      const hasData = fs.totalDistanceKm > 0 && fs.totalLiters > 0;
      const avgLKm = hasData ? Number((fs.totalLiters / fs.totalDistanceKm).toFixed(4)) : 0;
      const targetLKm = fs.targetRatio > 0 ? Number((1 / fs.targetRatio).toFixed(4)) : 0;
      const unitLogs = reconciledLogs.filter(
        l =>
          l.fleetId === fs.fleetId ||
          (l.plateNumber && normalizePlateKey(l.plateNumber) === normalizePlateKey(fs.plateNumber))
      );
      const latestLog = unitLogs[0];
      return {
        fleetId: fs.fleetId,
        unit: fs.initialCode || fs.plateNumber,
        plate: fs.plateNumber,
        tipe: fs.vehicleType,
        driverName: latestLog?.driverName || '-',
        areaKirim: latestLog?.routeTrip || '-',
        aktualLKm: avgLKm,
        targetLKm: hasData ? targetLKm : 0,
        aktualKmL: hasData ? fs.avgKmPerLiter : 0,
        targetKmL: fs.targetRatio
      };
    });
    if (comparisonSelectedFleetId !== 'all') {
      return mapped.filter(m => m.fleetId === comparisonSelectedFleetId);
    }
    return mapped;
  }, [fleetSummaries, reconciledLogs, comparisonSelectedFleetId]);

  // Modal helpers & data
  const editingLogObj = useMemo(
    () => (editingLogId ? fuelLogs.find(l => l.id === editingLogId) || null : null),
    [editingLogId, fuelLogs]
  );

  const selectedFormFleet = useMemo(() => {
    if (!formFleetId && !editingLogObj) return undefined;
    const direct =
      cleanCanonicalFleets.find(fl => fl.id === formFleetId) ||
      fleets.find(fl => fl.id === formFleetId);
    if (direct) return direct;
    if (editingLogObj) {
      const resolved = resolveFleetForLog(editingLogObj);
      if (resolved) return resolved;
      if (editingLogObj.plateNumber || editingLogObj.initialCode) {
        return {
          id: editingLogObj.fleetId || formFleetId || 'legacy-fleet',
          plateNumber: editingLogObj.plateNumber || '-',
          initialCode: editingLogObj.initialCode || editingLogObj.plateNumber || 'Armada',
          vehicleType: editingLogObj.vehicleType || 'Double STD'
        } as Fleet;
      }
    }
    return undefined;
  }, [formFleetId, cleanCanonicalFleets, fleets, editingLogObj]);

  const modalBranchFleets = useMemo(
    () => cleanCanonicalFleets.filter(f => resolveFleetBranchId(f) === formBranchId),
    [cleanCanonicalFleets, formBranchId]
  );

  const filteredModalFleets = useMemo(() => {
    const q = fleetSearchFilter.trim().toLowerCase();
    if (!q) return modalBranchFleets;
    return modalBranchFleets.filter(
      f =>
        (f.initialCode || '').toLowerCase().includes(q) ||
        (f.plateNumber || '').toLowerCase().includes(q) ||
        (f.vehicleType || '').toLowerCase().includes(q) ||
        (f.brand || '').toLowerCase().includes(q)
    );
  }, [modalBranchFleets, fleetSearchFilter]);

  const deliveryAreaOptions = useMemo(() => {
    const set = new Set<string>(OFFICIAL_DESTINATION_AREAS);
    schedules.forEach(s => {
      const legacyDest = (s as Schedule & { destination?: string }).destination;
      if (legacyDest && typeof legacyDest === 'string' && legacyDest.trim()) {
        set.add(legacyDest.trim());
      }
      if (s?.areaName && typeof s.areaName === 'string' && s.areaName.trim()) {
        set.add(s.areaName.trim());
      }
    });
    return Array.from(set);
  }, [schedules]);

  const filteredAreaOptions = useMemo(() => {
    const q = areaSearchFilter.trim().toLowerCase();
    if (!q) return deliveryAreaOptions;
    return deliveryAreaOptions.filter(a => a.toLowerCase().includes(q));
  }, [deliveryAreaOptions, areaSearchFilter]);

  const crewOptionsForModal = useMemo(() => {
    const map = new Map<string, { id: string; name: string; role: string }>();
    const registeredUsers = users && users.length > 0 ? users : logisticsStore.getUsers();
    registeredUsers.forEach(u => {
      const normalizedStatus = String(u?.status || '').trim().toLowerCase();
      if (
        u &&
        normalizedStatus === 'approved' &&
        (u as UserProfile & { isActive?: boolean }).isActive !== false &&
        logisticsStore.isActiveDeliveryCrewUser(u, formBranchId) &&
        u.fullName?.trim()
      ) {
        const cleanName = u.fullName.trim();
        const cKey = compactPersonKey(cleanName);
        if (cKey && !map.has(cKey)) {
          map.set(cKey, {
            id: u.id,
            name: cleanName,
            role: u.role === 'crew_helper' ? 'Helper' : 'Driver'
          });
        }
      }
    });
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name, 'id'));
  }, [users, formBranchId]);

  const filteredDriverOptions = useMemo(() => {
    const q = driverSearchFilter.trim().toLowerCase();
    const list = [...crewOptionsForModal].sort((a, b) => {
      const aIsDrv = a.role.toLowerCase().includes('driver') ? 0 : 1;
      const bIsDrv = b.role.toLowerCase().includes('driver') ? 0 : 1;
      if (aIsDrv !== bIsDrv) return aIsDrv - bIsDrv;
      return a.name.localeCompare(b.name);
    });
    if (!q) return list;
    return list.filter(d => d.name.toLowerCase().includes(q));
  }, [crewOptionsForModal, driverSearchFilter]);

  const filteredHelperOptions = useMemo(() => {
    const q = helperSearchFilter.trim().toLowerCase();
    const list = [...crewOptionsForModal].sort((a, b) => {
      const aIsHlp = a.role.toLowerCase().includes('helper') ? 0 : 1;
      const bIsHlp = b.role.toLowerCase().includes('helper') ? 0 : 1;
      if (aIsHlp !== bIsHlp) return aIsHlp - bIsHlp;
      return a.name.localeCompare(b.name);
    });
    if (!q) return list;
    return list.filter(d => d.name.toLowerCase().includes(q));
  }, [crewOptionsForModal, helperSearchFilter]);

  const liveFormDistance = useMemo(() => {
    const s = Number(formStartOdo) || 0;
    const e = Number(formEndOdo) || 0;
    return Math.max(0, e - s);
  }, [formStartOdo, formEndOdo]);

  const liveFormTotalCost = useMemo(() => {
    const l = Number(formLiters) || 0;
    const price = Number(formCostPerLiter) || 0;
    return Math.round(l * price);
  }, [formLiters, formCostPerLiter]);

  const liveFormRatio = useMemo(() => {
    const l = Number(formLiters) || 0;
    if (l <= 0 || liveFormDistance <= 0) return 0;
    return Number((liveFormDistance / l).toFixed(2));
  }, [formLiters, liveFormDistance]);

  const liveFormEfficiency = useMemo(() => {
    const flt = selectedFormFleet;
    const target = flt ? FUEL_TARGET_RATIOS[flt.vehicleType]?.target || 7.5 : 7.5;
    if (liveFormRatio <= 0) return { status: 'Menunggu input', tone: 'text-slate-500 bg-slate-100 border-slate-200' };
    if (liveFormRatio >= target * 1.05) {
      return { status: 'Sangat Efisien', tone: 'text-emerald-700 bg-emerald-50 border-emerald-200' };
    }
    if (liveFormRatio >= target * 0.9) {
      return { status: 'Normal / Efisien', tone: 'text-blue-700 bg-blue-50 border-blue-200' };
    }
    if (liveFormRatio >= target * 0.75) {
      return { status: 'Boros', tone: 'text-amber-700 bg-amber-50 border-amber-200' };
    }
    return { status: 'Anomali / Kritis', tone: 'text-red-700 bg-red-50 border-red-200' };
  }, [liveFormRatio, selectedFormFleet]);

  const openAddFuelModal = () => {
    logisticsStore.refreshUsersFromHostinger?.().catch(() => {});
    const todayIso = new Date().toISOString().split('T')[0];
    setEditingLogId(null);
    setFormBranchId(selectedBranchFilter === 'cab-sidoarjo' ? 'cab-sidoarjo' : 'cab-banyuwangi');
    setFormFleetId('');
    setFormDriverId('');
    setFormDriverName('');
    setFormHelperId('');
    setFormHelperName('');
    setFormRouteTrip('');
    setFormDate(todayIso);
    setFormFuelType('BioSolar');
    setFormCostPerLiter('6800');
    setFormLiters('');
    setFormStartOdo('');
    setFormEndOdo('');
    setFormGasStation('SPBU Farly');
    setFleetSearchFilter('');
    setDriverSearchFilter('');
    setHelperSearchFilter('');
    setAreaSearchFilter('');
    setActiveModalDropdown(null);
    setIsGasStationDropdownOpen(false);
    setFormError('');
    setIsAddModalOpen(true);
  };

  const openEditFuelModal = (log: FuelLog) => {
    logisticsStore.refreshUsersFromHostinger?.().catch(() => {});
    const matchedFleet = resolveFleetForLog(log);
    setEditingLogId(log.id);
    setFormBranchId(matchedFleet ? resolveFleetBranchId(matchedFleet) : resolveLogBranchId(log));
    setFormFleetId(matchedFleet?.id || log.fleetId || log.plateNumber || log.initialCode || '');
    setFormDriverId(log.driverId || '');
    setFormDriverName(log.driverName || '');
    setFormHelperId(log.helperId || '');
    setFormHelperName(log.helperName || '');
    setFormRouteTrip(log.routeTrip || '');
    setFormDate(log.date || new Date().toISOString().split('T')[0]);
    setFormFuelType(log.fuelType || 'BioSolar');
    setFormCostPerLiter(log.costPerLiter !== undefined ? String(log.costPerLiter) : '6800');
    setFormLiters(log.liters ? Number(log.liters).toFixed(2) : '');
    setFormStartOdo(String(log.startOdometerKm || ''));
    setFormEndOdo(String(log.endOdometerKm || ''));
    setFormGasStation(log.gasStation || 'SPBU Farly');
    setFleetSearchFilter('');
    setDriverSearchFilter('');
    setHelperSearchFilter('');
    setAreaSearchFilter('');
    setActiveModalDropdown(null);
    setIsGasStationDropdownOpen(false);
    setFormError('');
    setIsAddModalOpen(true);
  };

  // Autofill KM Awal & KM Akhir from Driver Portal schedules if available on selected date/fleet, otherwise latest FuelLog endOdometerKm
  const handleFleetSelection = (fleetId: string) => {
    setFormFleetId(fleetId);
    const flt = fleets.find(f => f.id === fleetId);
    if (!flt) return;
    const targetPlateClean = normalizePlateKey(flt.plateNumber);

    if (!editingLogId) {
      // Check Driver Portal KM first for selected date
      const portalMatch = portalKmByFleetDate.get(`${targetPlateClean || flt.id}|${formDate}`);
      if (portalMatch) {
        setFormStartOdo(String(portalMatch.minStartKm));
        setFormEndOdo(String(portalMatch.maxEndKm));
      } else {
        const matchingLogs = fuelLogs
          .filter(l => {
            const logPlateClean = normalizePlateKey(l.plateNumber);
            return l.fleetId === flt.id || (targetPlateClean && logPlateClean === targetPlateClean);
          })
          .sort((a, b) => {
            const dateDiff = (b.date || '').localeCompare(a.date || '');
            if (dateDiff !== 0) return dateDiff;
            return (b.endOdometerKm || 0) - (a.endOdometerKm || 0);
          });

        const latestFleetLog = matchingLogs[0];
        if (latestFleetLog && latestFleetLog.endOdometerKm > 0) {
          setFormStartOdo(String(latestFleetLog.endOdometerKm));
        } else {
          setFormStartOdo('');
        }
      }
    }

    if (!formDriverName) {
      const assignedCrew = crews.find(
        c => c.currentFleetId === flt.id && branchStore.getCrewBranchId(c.id, c.name) === formBranchId
      );
      if (assignedCrew) {
        const activeValidCrew = crewOptionsForModal.find(
          opt => compactPersonKey(opt.name) === compactPersonKey(assignedCrew.name)
        );
        if (activeValidCrew) {
          setFormDriverName(activeValidCrew.name);
          setFormDriverId(activeValidCrew.id);
        }
      }
    }
  };

  const handleFuelTypeChange = (type: FuelType) => {
    setFormFuelType(type);
    setFormCostPerLiter(String(STANDARD_FUEL_PRICES[type] || 6800));
  };

  const handleSaveFuelLog = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSavingFuelLog) return;
    setFormError('');
    setFuelActionError('');

    if (!formFleetId && !selectedFormFleet) {
      setFormError('Silakan pilih armada terlebih dahulu.');
      return;
    }
    if (!formDriverName) {
      setFormError('Silakan pilih nama driver terlebih dahulu.');
      return;
    }
    if (!editingLogId) {
      const driverActive = crewOptionsForModal.some(
        opt => compactPersonKey(opt.name) === compactPersonKey(formDriverName)
      );
      if (!driverActive) {
        setFormError('Akun driver yang dipilih sudah nonaktif di cabang ini.');
        return;
      }
      if (formHelperName) {
        const helperActive = crewOptionsForModal.some(
          opt => compactPersonKey(opt.name) === compactPersonKey(formHelperName)
        );
        if (!helperActive) {
          setFormError('Akun helper yang dipilih sudah nonaktif di cabang ini.');
          return;
        }
      }
    }
    if (!formLiters || Number(formLiters) <= 0) {
      setFormError('Volume BBM (Liter) harus lebih dari 0.');
      return;
    }
    if (formStartOdo === '' || formEndOdo === '') {
      setFormError('KM Awal dan KM Isi / Akhir wajib diisi.');
      return;
    }

    const flt = selectedFormFleet;
    if (!flt) {
      setFormError('Data armada tidak ditemukan.');
      return;
    }

    const startKm = Number(formStartOdo);
    const endKm = Number(formEndOdo);
    if (endKm <= startKm) {
      setFormError('KM Isi / Akhir harus lebih besar dari KM Awal.');
      return;
    }

    const payload = {
      fleetId: flt.id,
      plateNumber: flt.plateNumber,
      initialCode: flt.initialCode,
      vehicleType: flt.vehicleType,
      branchId: formBranchId,
      driverId: formDriverId || undefined,
      driverName: formDriverName,
      helperId: formHelperId || undefined,
      helperName: formHelperName || undefined,
      date: formDate,
      fuelType: formFuelType,
      liters: Number(Number(formLiters).toFixed(2)),
      costPerLiter: Number(formCostPerLiter) || 6800,
      startOdometerKm: startKm,
      endOdometerKm: endKm,
      gasStation: formGasStation,
      routeTrip: formRouteTrip || undefined,
      cargoLoadTon: editingLogObj?.cargoLoadTon,
      notes: editingLogObj?.notes
    };

    setIsSavingFuelLog(true);
    try {
      if (editingLogId) {
        await logisticsStore.updateFuelLogAsync(editingLogId, payload);
      } else {
        await logisticsStore.addFuelLogAsync(payload);
      }
      setIsAddModalOpen(false);
      setEditingLogId(null);
      setFormError('');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Gagal menyimpan catatan BBM ke database MySQL.';
      setFormError(msg);
    } finally {
      setIsSavingFuelLog(false);
    }
  };

  const handleDeleteLog = async (logId: string) => {
    setDeletingLogId(logId);
    setFuelActionError('');
    try {
      await logisticsStore.deleteFuelLogAsync(logId);
      setConfirmDeleteId(null);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Gagal menghapus catatan BBM dari MySQL.';
      setFuelActionError(msg);
    } finally {
      setDeletingLogId(null);
    }
  };

  const auditAreaOptions = useMemo(() => {
    const set = new Set<string>(OFFICIAL_DESTINATION_AREAS);
    reconciledLogs.forEach(l => {
      if (l.routeTrip && l.routeTrip.trim()) {
        set.add(l.routeTrip.trim());
      }
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'id'));
  }, [reconciledLogs]);

  // Filtered & Sorted Logs for Audit Tab
  const filteredLogs = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const list = reconciledLogs.filter(log => {
      const matchQuery =
        !q ||
        log.plateNumber.toLowerCase().includes(q) ||
        (log.initialCode && log.initialCode.toLowerCase().includes(q)) ||
        log.driverName.toLowerCase().includes(q) ||
        (log.helperName && log.helperName.toLowerCase().includes(q)) ||
        log.gasStation.toLowerCase().includes(q) ||
        (log.routeTrip && log.routeTrip.toLowerCase().includes(q));

      const resolvedLogFleet = resolveFleetForLog(log);
      const matchFleet =
        filterFleetId === 'all' ||
        log.fleetId === filterFleetId ||
        resolvedLogFleet?.id === filterFleetId;
      const matchStatus = filterStatus === 'all' || log.efficiencyStatus === filterStatus;
      const matchFuel = filterFuelType === 'all' || log.fuelType === filterFuelType;

      const gsLower = (log.gasStation || '').toLowerCase();
      const matchSpbu =
        filterSpbu === 'all'
          ? true
          : filterSpbu === 'Farly'
          ? gsLower.includes('farly')
          : filterSpbu === 'Gajah Mada'
          ? gsLower.includes('gajah mada')
          : !gsLower.includes('farly') && !gsLower.includes('gajah mada');

      const logIso = normalizeIsoDate(log.date);
      const matchDateStart = !filterDateStart || (logIso !== '' && logIso >= filterDateStart);
      const matchDateEnd = !filterDateEnd || (logIso !== '' && logIso <= filterDateEnd);
      const matchArea =
        filterArea === 'all' ||
        String(log.routeTrip || '').trim().toLowerCase() === filterArea.trim().toLowerCase();

      return matchQuery && matchFleet && matchStatus && matchFuel && matchSpbu && matchDateStart && matchDateEnd && matchArea;
    });

    if (logSortBy === 'efficient_asc') {
      return [...list].sort((a, b) => b.ratioKmPerLiter - a.ratioKmPerLiter);
    }
    if (logSortBy === 'wasteful_desc') {
      return [...list].sort((a, b) => a.ratioKmPerLiter - b.ratioKmPerLiter);
    }
    if (logSortBy === 'date_asc') {
      return [...list].sort((a, b) => (a.date || '').localeCompare(b.date || '') || (a.createdAt || '').localeCompare(b.createdAt || ''));
    }
    return [...list].sort((a, b) => (b.date || '').localeCompare(a.date || '') || (b.createdAt || '').localeCompare(a.createdAt || ''));
  }, [reconciledLogs, searchQuery, filterFleetId, filterStatus, filterFuelType, filterSpbu, filterDateStart, filterDateEnd, filterArea, logSortBy, cleanCanonicalFleets, fleets]);

  const totalLogsPages = useMemo(
    () => Math.max(1, Math.ceil(filteredLogs.length / LOGS_PER_PAGE)),
    [filteredLogs.length]
  );
  const safeLogsPage = Math.min(logsCurrentPage, totalLogsPages);
  const paginatedLogs = useMemo(() => {
    const start = (safeLogsPage - 1) * LOGS_PER_PAGE;
    return filteredLogs.slice(start, start + LOGS_PER_PAGE);
  }, [filteredLogs, safeLogsPage]);

  // Calculator handlers
  const handlePresetRouteChange = (routeKey: string) => {
    setCalcSelectedRoute(routeKey);
    const distances: Record<string, number> = {
      'bwi-sby-pp': 620,
      'bwi-mlg-pp': 560,
      'bwi-jbr-pp': 210,
      'bwi-dps-pp': 340,
      'bwi-solo-pp': 820
    };
    if (distances[routeKey]) setCalcDistanceKm(distances[routeKey]);
  };

  const calcOutput = useMemo(() => {
    const target = FUEL_TARGET_RATIOS[calcFleetType]?.target || 7.5;
    const estLiters = Number((calcDistanceKm / target).toFixed(2));
    const estTotalCost = Math.round(estLiters * calcCustomPrice);
    const costPerKm = calcDistanceKm > 0 ? Math.round(estTotalCost / calcDistanceKm) : 0;
    const costPerBox = calcCargoBoxes > 0 ? Math.round(estTotalCost / calcCargoBoxes) : 0;
    return { target, estLiters, estTotalCost, costPerKm, costPerBox };
  }, [calcFleetType, calcDistanceKm, calcCustomPrice, calcCargoBoxes]);

  const handleExportExcel = () => {
    const sourceRows = filteredLogs.length > 0 ? filteredLogs : reconciledLogs;
    const excelRows = sourceRows.map(l => {
      const bId = resolveLogBranchId(l);
      const bLabel = bId === 'cab-sidoarjo' ? 'Cabang Sidoarjo' : 'Cabang Nusantara';
      return {
        'ID Log': l.id,
        'Tanggal': l.date,
        'Cabang': bLabel,
        'Plat Nomor': l.plateNumber,
        'Inisial Armada': l.initialCode || '-',
        'Tipe Kendaraan': l.vehicleType,
        'Driver': l.driverName,
        'Helper': l.helperName || '-',
        'Jenis BBM': l.fuelType,
        'Volume (Liter)': Number(Number(l.liters || 0).toFixed(2)),
        'Harga per Liter (Rp)': Number(l.costPerLiter || 0),
        'Total Biaya (Rp)': Number(l.totalCost || 0),
        'KM Awal': Number(l.startOdometerKm || 0),
        'KM Akhir': Number(l.endOdometerKm || 0),
        'Jarak Tempuh (KM)': Number(l.distanceKm || 0),
        'Sumber Jarak': l.distanceSource === 'portal' ? 'Portal Driver' : 'Input BBM',
        'Rasio (KM/L)': Number(Number(l.ratioKmPerLiter || 0).toFixed(2)),
        'Standar Target (KM/L)': Number(Number(l.targetRatio || 0).toFixed(2)),
        'Status Efisiensi': l.efficiencyStatus,
        'SPBU': l.gasStation,
        'Area / Rute': l.routeTrip || '-'
      };
    });

    const ws = XLSX.utils.json_to_sheet(excelRows);
    ws['!cols'] = [
      { wch: 18 }, { wch: 12 }, { wch: 18 }, { wch: 14 }, { wch: 14 }, { wch: 15 },
      { wch: 24 }, { wch: 20 }, { wch: 12 }, { wch: 14 }, { wch: 16 }, { wch: 16 },
      { wch: 11 }, { wch: 11 }, { wch: 14 }, { wch: 14 }, { wch: 13 }, { wch: 16 },
      { wch: 22 }, { wch: 20 }, { wch: 24 }
    ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Efisiensi BBM');
    XLSX.writeFile(wb, `Efisiensi_BBM_AKK_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  return (
    <div className="akk-flat-fuel bg-slate-50 min-h-full p-4 sm:p-6 space-y-5 text-slate-900">
      {/* 1. HEADER & ACTION BAR */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-5">
        <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
              Efisiensi BBM Armada
            </h1>
            <p className="text-sm text-slate-500 mt-0.5">
              Pantau rasio L/KM, konsumsi solar per unit, serta sinkronisasi jarak tempuh otomatis dari Portal Driver.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* Branch Filter Segmented */}
            <div className="inline-flex items-center p-1 bg-slate-100 rounded-lg border border-slate-200">
              {([
                { id: 'all', label: 'Semua Cabang' },
                { id: 'cab-banyuwangi', label: 'Nusantara' },
                { id: 'cab-sidoarjo', label: 'Sidoarjo' }
              ] as const).map(br => (
                <button
                  key={br.id}
                  type="button"
                  onClick={() => {
                    setSelectedBranchFilter(br.id);
                    setComparisonSelectedFleetId('all');
                    setFilterFleetId('all');
                    setLKmFilterFleetId('all');
                  }}
                  className={`px-3 py-1.5 rounded-md text-xs font-semibold transition cursor-pointer whitespace-nowrap ${
                    selectedBranchFilter === br.id
                      ? 'bg-white text-slate-900 border border-slate-200'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {br.label}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={handleRefreshAll}
              disabled={isRefreshing}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold transition cursor-pointer whitespace-nowrap"
              title="Segarkan data BBM & Portal KM"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
              <span>Segarkan</span>
            </button>

            <button
              type="button"
              onClick={() => setIsCalculatorModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold transition cursor-pointer whitespace-nowrap"
            >
              <Calculator className="w-3.5 h-3.5 text-slate-500" />
              <span>Kalkulator</span>
            </button>

            <button
              type="button"
              onClick={() => setIsExportModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold transition cursor-pointer whitespace-nowrap"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-slate-500" />
              <span>Export Laporan</span>
            </button>

            <button
              type="button"
              onClick={handleExportExcel}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold transition cursor-pointer whitespace-nowrap"
              title="Unduh data efisiensi BBM format Excel (.xlsx)"
            >
              <Download className="w-3.5 h-3.5 text-slate-500" />
              <span>Excel</span>
            </button>

            <button
              type="button"
              onClick={openAddFuelModal}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold transition cursor-pointer whitespace-nowrap"
            >
              <Plus className="w-4 h-4" />
              <span>Catat BBM</span>
            </button>
          </div>
        </div>

        {/* 4 CLEAN KPI CARDS */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-4 border-t border-slate-100">
          <div className="p-4 rounded-xl border border-slate-200 bg-white">
            <div className="text-xs font-semibold text-slate-500">Total Konsumsi &amp; Biaya BBM</div>
            <div className="text-2xl font-bold text-slate-900 font-mono tabular-nums mt-1">
              {kpiSummary.totalLiters.toLocaleString('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} <span className="text-sm font-medium text-slate-500">Liter</span>
            </div>
            <div className="text-xs text-slate-500 mt-1 tabular-nums">
              Rp {(kpiSummary.totalCost / 1000000).toFixed(2)} Juta · Rp {kpiSummary.overallAvgCostPerKm.toLocaleString('id-ID')}/KM
            </div>
          </div>

          <div className="p-4 rounded-xl border border-slate-200 bg-white">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-semibold text-slate-500">Jarak Tempuh &amp; Portal Driver</span>
              {portalSyncedLogCount > 0 && (
                <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded px-1.5 py-0.5">
                  {portalSyncedLogCount} tersinkron
                </span>
              )}
            </div>
            <div className="text-2xl font-bold text-blue-600 font-mono tabular-nums mt-1">
              {kpiSummary.totalDistanceKm.toLocaleString('id-ID')} <span className="text-sm font-medium text-slate-500">KM</span>
            </div>
            <div className="text-xs text-slate-500 mt-1 tabular-nums">
              Portal: {portalGlobalStats.totalPortalDistanceKm.toLocaleString('id-ID')} KM ({portalGlobalStats.completedTrips} rit selesai)
            </div>
          </div>

          <div className="p-4 rounded-xl border border-slate-200 bg-white">
            <div className="text-xs font-semibold text-slate-500">Rata-Rata L/KM &amp; KM/L</div>
            <div className="text-2xl font-bold text-slate-900 font-mono tabular-nums mt-1">
              {kpiSummary.overallAvgLiterPerKm || 0} <span className="text-sm font-medium text-slate-500">L/KM</span>
            </div>
            <div className="text-xs text-slate-500 mt-1 tabular-nums">
              Rasio {kpiSummary.overallAvgKmPerLiter} KM/L · {kpiSummary.overallAvgLiterPer100Km} L/100KM
            </div>
          </div>

          <div className="p-4 rounded-xl border border-slate-200 bg-white">
            <div className="text-xs font-semibold text-slate-500">Status Efisiensi &amp; Anomali</div>
            <div
              className={`text-2xl font-bold font-mono tabular-nums mt-1 ${
                kpiSummary.totalAnomalies > 0 ? 'text-red-600' : 'text-emerald-600'
              }`}
            >
              {kpiSummary.totalAnomalies} <span className="text-sm font-medium text-slate-500">Log Boros/Anomali</span>
            </div>
            <div className="text-xs text-slate-500 mt-1 truncate">
              {kpiSummary.leastFleet && kpiSummary.leastFleet.totalLogs > 0
                ? `Perlu cek: ${kpiSummary.leastFleet.initialCode || kpiSummary.leastFleet.plateNumber} (${kpiSummary.leastFleet.avgKmPerLiter} KM/L)`
                : 'Semua unit dalam batas target'}
            </div>
          </div>
        </div>
      </div>

      {fuelActionError && (
        <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-semibold flex items-center justify-between gap-2">
          <span className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            {fuelActionError}
          </span>
          <button
            type="button"
            onClick={() => setFuelActionError('')}
            className="p-1 text-red-500 hover:text-red-700 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* 2. NAVIGATION TABS */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex flex-wrap items-center gap-1 p-1 bg-white border border-slate-200 rounded-xl">
          {[
            { id: 'overview', label: 'Analisis Efisiensi' },
            { id: 'liter_km', label: `L/KM Unit (${fleetSummaries.length})` },
            { id: 'km_recap', label: 'Rekap KM Berangkat & Pulang' },
            { id: 'weekly_report', label: 'Rekapitulasi BBM' },
            { id: 'leaderboard', label: `Eco-Driver (${driverScores.length})` },
            { id: 'logs', label: `Audit Riwayat BBM (${reconciledLogs.length})` }
          ].map(tab => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id as typeof activeTab)}
              className={`px-3.5 py-2 rounded-lg text-xs font-semibold transition cursor-pointer whitespace-nowrap ${
                activeTab === tab.id
                  ? 'bg-blue-600 text-white'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {onNavigateToKmRecap && activeTab !== 'km_recap' && (
          <button
            type="button"
            onClick={() => setActiveTab('km_recap')}
            className="text-xs font-semibold text-blue-600 hover:text-blue-700 cursor-pointer whitespace-nowrap"
          >
            Buka Halaman Rekap KM Penuh &rarr;
          </button>
        )}
      </div>

      {/* =================================================================== */}
      {/* TAB 1: ANALISIS EFISIENSI (IMPROVED CHARTS + CLEAN UNIT OVERVIEW)    */}
      {/* =================================================================== */}
      {activeTab === 'overview' && (
        <div className="space-y-5">
          {kpiSummary.totalAnomalies > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <div className="text-sm font-bold text-amber-900">
                  Terdeteksi {kpiSummary.totalAnomalies} catatan konsumsi melebihi batas target
                </div>
                <p className="text-xs text-amber-800 mt-0.5">
                  Periksa catatan KM Awal/Akhir, filter solar, atau durasi mesin menyala saat antre bongkar.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setFilterStatus('Kritis / Potensi Anomali');
                  setActiveTab('logs');
                }}
                className="shrink-0 px-3.5 py-2 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold transition cursor-pointer"
              >
                Tinjau Catatan Anomali
              </button>
            </div>
          )}

          {/* TARGET STANDAR PER TIPE KENDARAAN */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {Object.entries(FUEL_TARGET_RATIOS).map(([vType, cfg]) => (
              <div key={vType} className="bg-white border border-slate-200 rounded-xl px-4 py-3 flex items-center justify-between">
                <div>
                  <div className="text-xs font-medium text-slate-500">{vType}</div>
                  <div className="text-base font-bold text-slate-900 font-mono tabular-nums mt-0.5">{cfg.label}</div>
                </div>
                <div className="text-xs text-slate-500 text-right tabular-nums">
                  Min {cfg.minAcceptable} KM/L
                </div>
              </div>
            ))}
          </div>

          {/* CHARTS ROW: BAR COMPARISON + AREA TREND */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            {/* Bullet / Dot-Plot Comparison: Aktual L/KM vs Target Pabrikan */}
            <div className="lg:col-span-6 bg-white border border-slate-200 rounded-xl p-5 flex flex-col gap-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    Komparasi Aktual L/KM vs Target
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Garis vertikal menandai batas Target L/KM; posisi titik lebih kiri berarti konsumsi lebih hemat.
                  </p>
                </div>

                <select
                  value={comparisonSelectedFleetId}
                  onChange={e => setComparisonSelectedFleetId(e.target.value)}
                  aria-label="Filter unit grafik L/KM"
                  className="px-3 py-1.5 rounded-lg bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-800 focus:outline-none focus:border-blue-600 cursor-pointer shrink-0"
                >
                  <option value="all">Semua Armada ({unitLKmAnalysis.length})</option>
                  {unitLKmAnalysis.map(u => (
                    <option key={u.fleetId} value={u.fleetId}>
                      {u.initialCode || u.plateNumber} ({u.plateNumber})
                    </option>
                  ))}
                </select>
              </div>

              {lKmComparisonChartData.every(d => d.aktualLKm === 0) ? (
                <div className="h-80 flex items-center justify-center text-sm text-slate-500 border border-dashed border-slate-200 rounded-lg">
                  Belum ada data pengisian BBM pada cabang ini untuk ditampilkan di grafik.
                </div>
              ) : (
                (() => {
                  const visibleRows = lKmComparisonChartData.filter(
                    d => d.aktualLKm > 0 || comparisonSelectedFleetId !== 'all'
                  );
                  const rawMax = Math.max(
                    0.2,
                    ...visibleRows.map(d => Math.max(d.aktualLKm, d.targetLKm) * 1.15)
                  );
                  const scaleMax = Math.ceil(rawMax * 20) / 20; // crisp 0.05 L/KM intervals
                  const axisTicks = [0, 0.25, 0.5, 0.75, 1].map(ratio =>
                    Number((scaleMax * ratio).toFixed(2))
                  );

                  return (
                    <div className="flex flex-col gap-3">
                      <div className="flex flex-wrap items-center gap-4 text-[11px] font-medium text-slate-600">
                        <span className="inline-flex items-center gap-1.5">
                          <span className="w-2.5 h-2.5 rounded-full bg-emerald-600 inline-block" />
                          <span>Aktual &le; Target (Hemat)</span>
                        </span>
                        <span className="inline-flex items-center gap-1.5">
                          <span className="w-2.5 h-2.5 rounded-full bg-red-600 inline-block" />
                          <span>Aktual &gt; Target (Boros)</span>
                        </span>
                        <span className="inline-flex items-center gap-1.5">
                          <span className="w-0.5 h-3.5 bg-slate-800 inline-block" />
                          <span>Batas Target L/KM</span>
                        </span>
                      </div>

                      <div className="max-h-[268px] overflow-y-auto pr-1 space-y-2">
                        {visibleRows.map(entry => {
                          const hasReading = entry.aktualLKm > 0;
                          const isEfficient = hasReading && entry.aktualLKm <= entry.targetLKm;
                          const actualPct = Math.min(100, Math.max(0, (entry.aktualLKm / scaleMax) * 100));
                          const targetPct = Math.min(100, Math.max(0, (entry.targetLKm / scaleMax) * 100));
                          const diffLeft = Math.min(actualPct, targetPct);
                          const diffWidth = Math.abs(actualPct - targetPct);
                          const diffPctVsTarget =
                            entry.targetLKm > 0 && hasReading
                              ? Number((((entry.aktualLKm - entry.targetLKm) / entry.targetLKm) * 100).toFixed(1))
                              : 0;
                          const isHovered = hoveredChartFleetId === entry.fleetId;
                          const isSelected = comparisonSelectedFleetId === entry.fleetId;

                          return (
                            <div
                              key={entry.fleetId}
                              onMouseEnter={() => setHoveredChartFleetId(entry.fleetId)}
                              onMouseLeave={() => setHoveredChartFleetId(null)}
                              onClick={() =>
                                setComparisonSelectedFleetId(prev =>
                                  prev === entry.fleetId ? 'all' : entry.fleetId
                                )
                              }
                              className={`relative flex items-center gap-3 px-2.5 py-2 rounded-lg border transition cursor-pointer ${
                                isSelected
                                  ? 'bg-blue-50/70 border-blue-200'
                                  : isHovered
                                  ? 'bg-slate-50 border-slate-200'
                                  : 'bg-white border-transparent hover:border-slate-200'
                              }`}
                            >
                              <div className="w-20 sm:w-24 shrink-0">
                                <div className="text-xs font-bold text-slate-900 truncate">{entry.unit}</div>
                                <div className="text-[11px] text-slate-500 truncate">{entry.tipe}</div>
                              </div>

                              <div className="flex-1 relative h-7 flex items-center min-w-[120px]">
                                <div className="w-full h-1.5 bg-slate-100 rounded-full relative">
                                  {hasReading && (
                                    <div
                                      className={`absolute top-0 h-1.5 rounded-full ${
                                        isEfficient ? 'bg-emerald-200' : 'bg-red-200'
                                      }`}
                                      style={{ left: `${diffLeft}%`, width: `${Math.max(diffWidth, 0.5)}%` }}
                                    />
                                  )}
                                </div>

                                {entry.targetLKm > 0 && (
                                  <div
                                    className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-0.5 h-5 bg-slate-800 z-10"
                                    style={{ left: `${targetPct}%` }}
                                  />
                                )}

                                {hasReading && (
                                  <div
                                    className={`absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-3 h-3 rounded-full border-2 border-white z-20 ${
                                      isEfficient ? 'bg-emerald-600' : 'bg-red-600'
                                    }`}
                                    style={{ left: `${actualPct}%` }}
                                  />
                                )}

                                {isHovered && (
                                  <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-1.5 z-30 w-60 bg-white border border-slate-200 rounded-lg p-2.5 text-xs pointer-events-none">
                                    <div className="font-bold text-slate-900">
                                      {entry.unit} · {entry.plate}
                                    </div>
                                    <div className="text-[11px] text-slate-500 mt-0.5">
                                      Driver: {entry.driverName} · Area: {entry.areaKirim}
                                    </div>
                                    <div className="mt-1.5 pt-1.5 border-t border-slate-100 space-y-0.5 font-mono tabular-nums text-[11px]">
                                      <div className="flex justify-between">
                                        <span className="text-slate-500">Aktual:</span>
                                        <span className={`font-bold ${isEfficient ? 'text-emerald-700' : 'text-red-600'}`}>
                                          {hasReading ? `${entry.aktualLKm.toFixed(4)} L/KM (${entry.aktualKmL} KM/L)` : 'Belum ada data'}
                                        </span>
                                      </div>
                                      <div className="flex justify-between">
                                        <span className="text-slate-500">Target Maks:</span>
                                        <span className="font-semibold text-slate-800">
                                          {entry.targetLKm.toFixed(4)} L/KM ({entry.targetKmL} KM/L)
                                        </span>
                                      </div>
                                      {hasReading && (
                                        <div className="flex justify-between">
                                          <span className="text-slate-500">Selisih:</span>
                                          <span className={`font-semibold ${isEfficient ? 'text-emerald-700' : 'text-red-600'}`}>
                                            {diffPctVsTarget > 0 ? `+${diffPctVsTarget}% Boros` : `${Math.abs(diffPctVsTarget)}% Hemat`}
                                          </span>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                )}
                              </div>

                              <div className="w-28 sm:w-32 shrink-0 text-right font-mono tabular-nums">
                                <div
                                  className={`text-xs font-bold ${
                                    !hasReading
                                      ? 'text-slate-400'
                                      : isEfficient
                                      ? 'text-emerald-700'
                                      : 'text-red-600'
                                  }`}
                                >
                                  {hasReading ? `${entry.aktualLKm.toFixed(3)} L/KM` : 'Belum ada'}
                                </div>
                                <div className="text-[11px] text-slate-500">
                                  Tgt {entry.targetLKm > 0 ? entry.targetLKm.toFixed(3) : '-'} · {entry.aktualKmL || 0} KM/L
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      <div className="flex items-center gap-3 px-2.5 pt-2 border-t border-slate-100">
                        <div className="w-20 sm:w-24 shrink-0 text-[10px] font-semibold text-slate-400 uppercase tracking-wide">
                          Skala L/KM
                        </div>
                        <div className="flex-1 flex items-center justify-between text-[11px] font-mono tabular-nums text-slate-500">
                          {axisTicks.map(tick => (
                            <span key={tick}>{tick.toFixed(2)}</span>
                          ))}
                        </div>
                        <div className="w-28 sm:w-32 shrink-0" />
                      </div>
                    </div>
                  );
                })()
              )}
            </div>

            {/* Area Chart: Tren Konsumsi BBM & Jarak Tempuh */}
            <div className="lg:col-span-6 bg-white border border-slate-200 rounded-xl p-5 flex flex-col gap-4">
              <div className="pb-3 border-b border-slate-100">
                <h3 className="text-base font-bold text-slate-900">
                  Tren Volume BBM (L) &amp; Jarak Tempuh (KM)
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Perbandingan harian liter BBM dan akumulasi jarak KM dari Portal Driver &amp; odometer BBM.
                </p>
              </div>

              <div className="h-80 w-full">
                {timelineChartData.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-sm text-slate-500 border border-dashed border-slate-200 rounded-lg">
                    Belum ada riwayat harian BBM maupun jarak trip driver.
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={timelineChartData} margin={{ top: 10, right: 16, left: 0, bottom: 6 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                      <XAxis dataKey="date" stroke="#64748b" tick={{ fontSize: 11, fill: '#475569' }} />
                      <YAxis yAxisId="left" stroke="#2563eb" tick={{ fontSize: 11, fill: '#475569' }} />
                      <YAxis yAxisId="right" orientation="right" stroke="#16a34a" tick={{ fontSize: 11, fill: '#475569' }} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: '#ffffff',
                          borderColor: '#cbd5e1',
                          borderRadius: '8px',
                          fontSize: '12px',
                          color: '#0f172a',
                          boxShadow: 'none'
                        }}
                      />
                      <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '8px' }} />
                      <Area
                        yAxisId="left"
                        type="monotone"
                        dataKey="distance"
                        name="Jarak Tempuh (KM)"
                        stroke="#2563eb"
                        strokeWidth={2}
                        fill="#dbeafe"
                        fillOpacity={0.55}
                      />
                      <Area
                        yAxisId="right"
                        type="monotone"
                        dataKey="liters"
                        name="Volume BBM (Liter)"
                        stroke="#16a34a"
                        strokeWidth={2}
                        fill="#dcfce7"
                        fillOpacity={0.55}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>
          </div>

          {/* COMPACT UNIT EFFICIENCY TABLE */}
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="px-5 py-3.5 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Ringkasan Efisiensi Per Unit Armada ({unitLKmAnalysis.length} Unit)
                </h3>
                <p className="text-xs text-slate-500">
                  Klik baris unit untuk memfokuskan grafik perbandingan di atas.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setActiveTab('liter_km')}
                className="text-xs font-semibold text-blue-600 hover:text-blue-700 cursor-pointer self-start sm:self-center"
              >
                Lihat Analisis L/KM Lengkap &rarr;
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-slate-700">
                <thead className="bg-slate-50 text-xs font-semibold text-slate-500 border-b border-slate-200 whitespace-nowrap">
                  <tr>
                    <th className="py-3 px-4">Armada</th>
                    <th className="py-3 px-4">Tipe</th>
                    <th className="py-3 px-4">Driver Terakhir</th>
                    <th className="py-3 px-4 text-right">Jarak (KM)</th>
                    <th className="py-3 px-4 text-right">Total Liter</th>
                    <th className="py-3 px-4 text-right">Rata-rata L/KM</th>
                    <th className="py-3 px-4 text-right">Rasio KM/L</th>
                    <th className="py-3 px-4 text-center">Selisih Target</th>
                    <th className="py-3 px-4 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {unitLKmAnalysis.map(item => (
                    <tr
                      key={item.fleetId}
                      onClick={() =>
                        setComparisonSelectedFleetId(prev => (prev === item.fleetId ? 'all' : item.fleetId))
                      }
                      className={`hover:bg-slate-50 transition cursor-pointer ${
                        comparisonSelectedFleetId === item.fleetId ? 'bg-blue-50/70' : ''
                      }`}
                    >
                      <td className="py-3 px-4 whitespace-nowrap">
                        <div className="font-semibold text-slate-900">{item.initialCode || '-'}</div>
                        <div className="text-xs text-slate-500 font-mono">{item.plateNumber}</div>
                      </td>
                      <td className="py-3 px-4 text-xs text-slate-600 whitespace-nowrap">{item.vehicleType}</td>
                      <td className="py-3 px-4 text-xs font-medium text-slate-800 whitespace-nowrap">{item.driverName}</td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums font-semibold text-slate-900 whitespace-nowrap">
                        {item.totalDistanceKm.toLocaleString('id-ID')}
                        {item.hasPortalKm && (
                          <span className="ml-1.5 text-[10px] font-sans font-semibold text-blue-600">Portal</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-700 whitespace-nowrap">
                        {Number(item.totalLiters || 0).toLocaleString('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} L
                      </td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums font-bold text-slate-900 whitespace-nowrap">
                        {item.avgLKm}
                      </td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums font-semibold text-slate-700 whitespace-nowrap">
                        {item.avgKmPerLiter} KM/L
                      </td>
                      <td className="py-3 px-4 text-center whitespace-nowrap">
                        {!item.hasData ? (
                          <span className="text-xs text-slate-400">-</span>
                        ) : item.isSaving ? (
                          <span className="inline-flex items-center gap-0.5 text-xs font-semibold text-emerald-700">
                            <ArrowDown className="w-3 h-3" />+{item.savingPct}% Hemat
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-0.5 text-xs font-semibold text-red-600">
                            <ArrowUp className="w-3 h-3" />{item.savingPct}% Boros
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-center whitespace-nowrap">
                        {!item.hasData ? (
                          <span className="text-xs text-slate-400">Belum ada log</span>
                        ) : (
                          <span
                            className={`px-2.5 py-0.5 rounded-md text-xs font-semibold border inline-block ${
                              item.status === 'Sangat Efisien'
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                : item.status === 'Efisien / Normal'
                                ? 'bg-blue-50 text-blue-700 border-blue-200'
                                : item.status === 'Boros'
                                ? 'bg-amber-50 text-amber-700 border-amber-200'
                                : 'bg-red-50 text-red-700 border-red-200'
                            }`}
                          >
                            {item.status}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* TAB 2: DETAIL LITER PER KM KENDARAAN                                */}
      {/* =================================================================== */}
      {activeTab === 'liter_km' && (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="p-5 border-b border-slate-200 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div>
              <h3 className="text-base font-bold text-slate-900">
                Detail Konsumsi Liter per Kilometer (L/KM) Tiap Armada
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Rumus: Total Liter ÷ Total Jarak KM (memprioritaskan jarak KM Awal &amp; KM Akhir Portal Driver).
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              <select
                value={lKmFilterFleetId}
                onChange={e => setLKmFilterFleetId(e.target.value)}
                aria-label="Filter unit"
                className="px-3 py-2 rounded-lg bg-white border border-slate-200 text-xs font-semibold text-slate-700 focus:outline-none focus:border-blue-600 cursor-pointer"
              >
                <option value="all">Semua Unit ({fleetSummaries.length})</option>
                {branchScopedFleets.map(f => (
                  <option key={f.id} value={f.id}>
                    {f.initialCode || f.plateNumber} ({f.plateNumber})
                  </option>
                ))}
              </select>

              <select
                value={lKmSortBy}
                onChange={e => setLKmSortBy(e.target.value as typeof lKmSortBy)}
                aria-label="Urutkan"
                className="px-3 py-2 rounded-lg bg-white border border-slate-200 text-xs font-semibold text-slate-700 focus:outline-none focus:border-blue-600 cursor-pointer"
              >
                <option value="canonical_order">Urutan Armada Resmi</option>
                <option value="lKm_asc">L/KM Paling Hemat</option>
                <option value="lKm_desc">L/KM Paling Tinggi</option>
                <option value="efficiency_desc">Skor Efisiensi Tertinggi</option>
                <option value="distance_desc">Jarak Tempuh Terjauh</option>
              </select>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-700">
              <thead className="bg-slate-50 text-xs font-semibold text-slate-500 border-b border-slate-200 whitespace-nowrap">
                <tr>
                  <th className="py-3 px-4">Armada &amp; Plat</th>
                  <th className="py-3 px-4">Tipe</th>
                  <th className="py-3 px-4">Area Terakhir</th>
                  <th className="py-3 px-4 text-right">Isi</th>
                  <th className="py-3 px-4 text-right">Total Liter</th>
                  <th className="py-3 px-4 text-right">Jarak (KM)</th>
                  <th className="py-3 px-4 text-right">Biaya/KM</th>
                  <th className="py-3 px-4 text-right">Aktual L/KM</th>
                  <th className="py-3 px-4 text-right">Target L/KM</th>
                  <th className="py-3 px-4 text-right">L / 100 KM</th>
                  <th className="py-3 px-4 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {unitLKmAnalysis.map(item => (
                  <tr key={item.fleetId} className="hover:bg-slate-50 transition">
                    <td className="py-3 px-4 whitespace-nowrap">
                      <div className="font-semibold text-slate-900">{item.initialCode || '-'}</div>
                      <div className="text-xs text-slate-500 font-mono">{item.plateNumber}</div>
                    </td>
                    <td className="py-3 px-4 text-xs text-slate-600 whitespace-nowrap">{item.vehicleType}</td>
                    <td className="py-3 px-4 text-xs text-slate-600 whitespace-nowrap">{item.areaKirim}</td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums">{item.totalLogs}x</td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums font-semibold text-slate-900">
                      {Number(item.totalLiters || 0).toLocaleString('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} L
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums font-semibold text-blue-600">
                      {item.totalDistanceKm.toLocaleString('id-ID')}
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums text-xs text-slate-700">
                      Rp {item.avgCostPerKm.toLocaleString('id-ID')}
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums font-bold text-slate-900">
                      {item.avgLKm}
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums text-xs text-slate-500">
                      {item.targetLKm}
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-700">
                      {item.avgL100Km}
                    </td>
                    <td className="py-3 px-4 text-center whitespace-nowrap">
                      <span
                        className={`px-2.5 py-0.5 rounded-md text-xs font-semibold border inline-block ${
                          !item.hasData
                            ? 'bg-slate-50 text-slate-500 border-slate-200'
                            : item.status === 'Sangat Efisien'
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : item.status === 'Efisien / Normal'
                            ? 'bg-blue-50 text-blue-700 border-blue-200'
                            : item.status === 'Boros'
                            ? 'bg-amber-50 text-amber-700 border-amber-200'
                            : 'bg-red-50 text-red-700 border-red-200'
                        }`}
                      >
                        {item.hasData ? item.status : 'Belum ada data'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* TAB 3: EMBEDDED REKAP KM BERANGKAT & PULANG                         */}
      {/* =================================================================== */}
      {activeTab === 'km_recap' && (
        <KmRecapManagement
          embedded
          branchFilterExternal={selectedBranchFilter}
          onNavigateToFuel={() => setActiveTab('overview')}
        />
      )}

      {/* =================================================================== */}
      {/* TAB 4: REKAPITULASI MINGGUAN / RENTANG TANGGAL                      */}
      {/* =================================================================== */}
      {activeTab === 'weekly_report' && (
        <FuelWeeklyReportView
          fuelLogs={reconciledLogs}
          onOpenExportModal={() => setIsExportModalOpen(true)}
        />
      )}

      {/* =================================================================== */}
      {/* TAB 5: ECO-DRIVER LEADERBOARD                                       */}
      {/* =================================================================== */}
      {activeTab === 'leaderboard' && (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="p-5 border-b border-slate-200">
            <h3 className="text-base font-bold text-slate-900">
              Peringkat Efisiensi Driver (Eco-Driving)
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Berdasarkan perbandingan rasio aktual terhadap standar pabrik tiap armada yang dikemudikan.
            </p>
          </div>

          {driverScores.length === 0 ? (
            <div className="py-12 text-center text-sm text-slate-500">
              Belum ada data pengisian BBM untuk menghitung skor driver.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-slate-700">
                <thead className="bg-slate-50 text-xs font-semibold text-slate-500 border-b border-slate-200 whitespace-nowrap">
                  <tr>
                    <th className="py-3 px-4">Peringkat</th>
                    <th className="py-3 px-4">Nama Driver</th>
                    <th className="py-3 px-4 text-right">Ritase Log</th>
                    <th className="py-3 px-4 text-right">Total Jarak (KM)</th>
                    <th className="py-3 px-4 text-right">Total Solar (L)</th>
                    <th className="py-3 px-4 text-right">Rerata KM/L</th>
                    <th className="py-3 px-4 text-center">Skor</th>
                    <th className="py-3 px-4 text-center">Kategori</th>
                    <th className="py-3 px-4">Catatan Evaluasi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {driverScores.map(d => (
                    <tr key={d.driverId} className="hover:bg-slate-50 transition">
                      <td className="py-3 px-4 font-mono tabular-nums font-bold text-slate-900">#{d.ranking}</td>
                      <td className="py-3 px-4 font-semibold text-slate-900 whitespace-nowrap">{d.driverName}</td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums">{d.totalTrips}x</td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums font-semibold text-blue-600">
                        {d.totalDistanceKm.toLocaleString('id-ID')} KM
                      </td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums">{Number(d.totalLiters || 0).toLocaleString('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} L</td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums font-bold text-slate-900">
                        {d.avgKmPerLiter}
                      </td>
                      <td className="py-3 px-4 text-center font-mono tabular-nums font-bold text-slate-900">
                        {d.ecoDrivingScore}/100
                      </td>
                      <td className="py-3 px-4 text-center whitespace-nowrap">
                        <span
                          className={`px-2.5 py-0.5 rounded-md text-xs font-semibold border inline-flex items-center gap-1 ${
                            d.badge === 'Master Eco-Driver'
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : d.badge === 'Driver Efisien'
                              ? 'bg-blue-50 text-blue-700 border-blue-200'
                              : 'bg-amber-50 text-amber-700 border-amber-200'
                          }`}
                        >
                          <Award className="w-3 h-3" />
                          {d.badge}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-xs text-slate-600 max-w-xs">{d.recommendation}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* =================================================================== */}
      {/* TAB 6: AUDIT RIWAYAT BBM                                            */}
      {/* =================================================================== */}
      {activeTab === 'logs' && (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="p-5 border-b border-slate-200 space-y-3">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Audit Riwayat Pengisian BBM ({filteredLogs.length})
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Baris bertanda <span className="font-semibold text-blue-600">Portal KM</span> memakai jarak otomatis dari KM Awal &amp; KM Akhir driver.
                </p>
              </div>
              <button
                type="button"
                onClick={openAddFuelModal}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold transition cursor-pointer self-start lg:self-auto"
              >
                <Plus className="w-4 h-4" />
                <span>Tambah Log BBM</span>
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-2.5">
              <div className="relative lg:col-span-2">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
                <input
                  type="text"
                  placeholder="Cari plat, inisial, driver, SPBU, atau area..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-blue-600 focus:bg-white"
                />
              </div>

              <select
                value={filterFleetId}
                onChange={e => setFilterFleetId(e.target.value)}
                aria-label="Filter Armada"
                className="px-3 py-2 rounded-lg bg-slate-50 border border-slate-200 text-xs font-medium text-slate-800 focus:outline-none focus:border-blue-600 cursor-pointer"
              >
                <option value="all">Semua Armada</option>
                {branchScopedFleets.map(f => (
                  <option key={f.id} value={f.id}>
                    {f.initialCode || f.plateNumber} ({f.plateNumber})
                  </option>
                ))}
              </select>

              <select
                value={filterSpbu}
                onChange={e => setFilterSpbu(e.target.value as typeof filterSpbu)}
                aria-label="Filter SPBU"
                className="px-3 py-2 rounded-lg bg-slate-50 border border-slate-200 text-xs font-medium text-slate-800 focus:outline-none focus:border-blue-600 cursor-pointer"
              >
                <option value="all">Semua SPBU</option>
                <option value="Farly">SPBU Farly</option>
                <option value="Gajah Mada">SPBU Gajah Mada</option>
                <option value="SPBU Lain">SPBU Lain</option>
              </select>

              <select
                value={filterStatus}
                onChange={e => setFilterStatus(e.target.value)}
                aria-label="Filter Status"
                className="px-3 py-2 rounded-lg bg-slate-50 border border-slate-200 text-xs font-medium text-slate-800 focus:outline-none focus:border-blue-600 cursor-pointer"
              >
                <option value="all">Semua Status</option>
                <option value="Sangat Efisien">Sangat Efisien</option>
                <option value="Efisien / Normal">Efisien / Normal</option>
                <option value="Boros">Boros</option>
                <option value="Kritis / Potensi Anomali">Kritis / Potensi Anomali</option>
              </select>

              <select
                value={logSortBy}
                onChange={e => setLogSortBy(e.target.value as typeof logSortBy)}
                aria-label="Urutkan Log"
                className="px-3 py-2 rounded-lg bg-slate-50 border border-slate-200 text-xs font-medium text-slate-800 focus:outline-none focus:border-blue-600 cursor-pointer"
              >
                <option value="date_desc">Tanggal Terbaru</option>
                <option value="date_asc">Tanggal Terlama</option>
                <option value="efficient_asc">Rasio Paling Hemat</option>
                <option value="wasteful_desc">Rasio Paling Boros</option>
              </select>
            </div>

            {/* Filter Kalender & Area Pengiriman */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-2.5 pt-2 border-t border-slate-100">
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-50 border border-slate-200 lg:col-span-2">
                <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <span className="text-[11px] font-semibold text-slate-500 shrink-0">Dari:</span>
                <input
                  type="date"
                  aria-label="Tanggal Mulai Audit BBM"
                  value={filterDateStart}
                  onChange={e => setFilterDateStart(e.target.value)}
                  className="w-full bg-transparent text-xs font-mono text-slate-800 focus:outline-none cursor-pointer"
                />
              </div>

              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-50 border border-slate-200 lg:col-span-2">
                <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <span className="text-[11px] font-semibold text-slate-500 shrink-0">Sampai:</span>
                <input
                  type="date"
                  aria-label="Tanggal Akhir Audit BBM"
                  value={filterDateEnd}
                  onChange={e => setFilterDateEnd(e.target.value)}
                  className="w-full bg-transparent text-xs font-mono text-slate-800 focus:outline-none cursor-pointer"
                />
              </div>

              <select
                value={filterArea}
                onChange={e => setFilterArea(e.target.value)}
                aria-label="Filter Area Pengiriman"
                className="px-3 py-2 rounded-lg bg-slate-50 border border-slate-200 text-xs font-medium text-slate-800 focus:outline-none focus:border-blue-600 cursor-pointer"
              >
                <option value="all">Semua Area</option>
                {auditAreaOptions.map(area => (
                  <option key={area} value={area}>
                    {area}
                  </option>
                ))}
              </select>

              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setFilterFleetId('all');
                  setFilterSpbu('all');
                  setFilterStatus('all');
                  setFilterDateStart('');
                  setFilterDateEnd('');
                  setFilterArea('all');
                  setLogSortBy('date_desc');
                }}
                disabled={
                  !searchQuery &&
                  filterFleetId === 'all' &&
                  filterSpbu === 'all' &&
                  filterStatus === 'all' &&
                  !filterDateStart &&
                  !filterDateEnd &&
                  filterArea === 'all' &&
                  logSortBy === 'date_desc'
                }
                className="px-3 py-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold transition cursor-pointer disabled:opacity-45 disabled:cursor-default"
              >
                Reset Filter
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-700">
              <thead className="bg-slate-50 text-xs font-semibold text-slate-500 border-b border-slate-200 whitespace-nowrap">
                <tr>
                  <th className="py-3 px-4">Tanggal</th>
                  <th className="py-3 px-4">Armada</th>
                  <th className="py-3 px-4">Driver</th>
                  <th className="py-3 px-4">Area &amp; SPBU</th>
                  <th className="py-3 px-4 text-right">Volume &amp; Biaya</th>
                  <th className="py-3 px-4 text-right">Jarak (KM)</th>
                  <th className="py-3 px-4 text-right">Rasio</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4 text-center">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {paginatedLogs.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-12 text-center text-sm text-slate-500">
                      Tidak ada catatan BBM yang sesuai filter pencarian.
                    </td>
                  </tr>
                ) : (
                  paginatedLogs.map(log => {
                    const lPerKm = log.distanceKm > 0 ? (log.liters / log.distanceKm).toFixed(3) : '0.000';
                    return (
                      <tr key={log.id} className="hover:bg-slate-50/80 transition">
                        <td className="py-3.5 px-4 font-mono tabular-nums text-xs text-slate-700 whitespace-nowrap">
                          {log.date}
                        </td>
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <span className="font-semibold text-slate-900">{log.initialCode || log.plateNumber}</span>
                          <span className="text-xs text-slate-500 font-mono ml-1.5">{log.plateNumber}</span>
                        </td>
                        <td
                          className="py-3.5 px-4 text-xs font-medium text-slate-800 whitespace-nowrap"
                          title={log.helperName ? `Driver: ${log.driverName} · Helper: ${log.helperName}` : log.driverName}
                        >
                          {log.driverName}
                        </td>
                        <td className="py-3.5 px-4 max-w-[210px]">
                          <div className="text-xs text-slate-800 truncate">
                            <span className="font-medium">{log.routeTrip || '-'}</span>
                            <span className="text-slate-400 mx-1">·</span>
                            <span className="text-slate-500">{log.gasStation}</span>
                          </div>
                        </td>
                        <td className="py-3.5 px-4 text-right font-mono tabular-nums whitespace-nowrap text-xs">
                          <span className="font-semibold text-slate-900">{Number(log.liters || 0).toFixed(2)} L</span>
                          <span className="text-slate-400 mx-1">·</span>
                          <span className="text-slate-600">Rp {log.totalCost.toLocaleString('id-ID')}</span>
                        </td>
                        <td
                          className="py-3.5 px-4 text-right font-mono tabular-nums whitespace-nowrap text-xs"
                          title={`Odometer: ${log.startOdometerKm.toLocaleString('id-ID')} – ${log.endOdometerKm.toLocaleString('id-ID')} KM`}
                        >
                          <span className="font-bold text-blue-600">{log.distanceKm.toLocaleString('id-ID')} KM</span>
                          {log.distanceSource === 'portal' && (
                            <span className="ml-1.5 text-[11px] font-sans font-semibold text-slate-500">(Portal)</span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-right font-mono tabular-nums whitespace-nowrap text-xs">
                          <span className="font-bold text-slate-900">{log.ratioKmPerLiter} KM/L</span>
                          <span className="text-slate-400 mx-1">/</span>
                          <span className="text-slate-500">{lPerKm} L/KM</span>
                        </td>
                        <td className="py-3.5 px-4 text-center whitespace-nowrap">
                          <span
                            className={`px-2.5 py-0.5 rounded-md text-xs font-semibold border inline-block ${
                              log.efficiencyStatus === 'Sangat Efisien'
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                : log.efficiencyStatus === 'Efisien / Normal'
                                ? 'bg-blue-50 text-blue-700 border-blue-200'
                                : log.efficiencyStatus === 'Boros'
                                ? 'bg-amber-50 text-amber-700 border-amber-200'
                                : 'bg-red-50 text-red-700 border-red-200'
                            }`}
                          >
                            {log.efficiencyStatus}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-center whitespace-nowrap">
                          {confirmDeleteId === log.id ? (
                            <div className="inline-flex items-center gap-1">
                              <button
                                type="button"
                                disabled={deletingLogId === log.id}
                                onClick={() => handleDeleteLog(log.id)}
                                className="px-2 py-1 rounded bg-red-600 hover:bg-red-700 text-white text-xs font-semibold cursor-pointer"
                              >
                                {deletingLogId === log.id ? '...' : 'Hapus'}
                              </button>
                              <button
                                type="button"
                                onClick={() => setConfirmDeleteId(null)}
                                className="px-2 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold cursor-pointer"
                              >
                                Batal
                              </button>
                            </div>
                          ) : (
                            <div className="inline-flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => setSelectedLogForDetail(log)}
                                className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 cursor-pointer"
                                title="Lihat Slip Detail"
                              >
                                <FileText className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => openEditFuelModal(log)}
                                className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-blue-600 cursor-pointer"
                                title="Edit Catatan"
                              >
                                <Edit className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => setConfirmDeleteId(log.id)}
                                className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-red-50 text-red-600 cursor-pointer"
                                title="Hapus Catatan"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {totalLogsPages > 1 && (
            <div className="px-5 py-3 border-t border-slate-200 bg-slate-50 flex items-center justify-between text-xs text-slate-600">
              <span>
                Halaman {safeLogsPage} dari {totalLogsPages} ({filteredLogs.length} catatan)
              </span>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  disabled={safeLogsPage <= 1}
                  onClick={() => setLogsCurrentPage(p => Math.max(1, p - 1))}
                  className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-50 font-semibold cursor-pointer"
                >
                  Sebelumnya
                </button>
                <button
                  type="button"
                  disabled={safeLogsPage >= totalLogsPages}
                  onClick={() => setLogsCurrentPage(p => Math.min(totalLogsPages, p + 1))}
                  className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-50 font-semibold cursor-pointer"
                >
                  Berikutnya
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* =================================================================== */}
      {/* MODAL 1: CATAT / EDIT BBM                                           */}
      {/* =================================================================== */}
      <FuelEntryFormModal
        isOpen={isAddModalOpen}
        editingLogId={editingLogId}
        formError={formError}
        formBranchId={formBranchId}
        onBranchChange={branchId => {
          setFormBranchId(branchId);
          setFormFleetId('');
          setFormDriverId('');
          setFormDriverName('');
          setFormHelperId('');
          setFormHelperName('');
        }}
        formFleetId={formFleetId}
        selectedFormFleet={selectedFormFleet}
        filteredModalFleets={filteredModalFleets}
        fleetSearchFilter={fleetSearchFilter}
        onFleetSearchFilterChange={setFleetSearchFilter}
        onSelectFleet={handleFleetSelection}
        formDate={formDate}
        onDateChange={setFormDate}
        calendarViewMonth={calendarViewMonth}
        onCalendarViewMonthChange={setCalendarViewMonth}
        formDriverName={formDriverName}
        filteredDriverOptions={filteredDriverOptions}
        driverSearchFilter={driverSearchFilter}
        onDriverSearchFilterChange={setDriverSearchFilter}
        onSelectDriver={(id, name) => {
          setFormDriverId(id);
          setFormDriverName(name);
        }}
        formHelperName={formHelperName}
        filteredHelperOptions={filteredHelperOptions}
        helperSearchFilter={helperSearchFilter}
        onHelperSearchFilterChange={setHelperSearchFilter}
        onSelectHelper={(id, name) => {
          setFormHelperId(id);
          setFormHelperName(name);
        }}
        formFuelType={formFuelType}
        fuelTypes={FUEL_TYPES}
        onFuelTypeChange={handleFuelTypeChange}
        formCostPerLiter={formCostPerLiter}
        onCostPerLiterChange={setFormCostPerLiter}
        formLiters={formLiters}
        onLitersChange={setFormLiters}
        formGasStation={formGasStation}
        onGasStationChange={setFormGasStation}
        isGasStationDropdownOpen={isGasStationDropdownOpen}
        onGasStationDropdownOpenChange={setIsGasStationDropdownOpen}
        formStartOdo={formStartOdo}
        onStartOdoChange={setFormStartOdo}
        formEndOdo={formEndOdo}
        onEndOdoChange={setFormEndOdo}
        formRouteTrip={formRouteTrip}
        filteredAreaOptions={filteredAreaOptions}
        areaSearchFilter={areaSearchFilter}
        onAreaSearchFilterChange={setAreaSearchFilter}
        onSelectArea={setFormRouteTrip}
        activeModalDropdown={activeModalDropdown}
        onActiveModalDropdownChange={setActiveModalDropdown}
        modalDropdownRef={modalDropdownRef}
        liveFormDistance={liveFormDistance}
        liveFormTotalCost={liveFormTotalCost}
        liveFormRatio={liveFormRatio}
        liveFormEfficiency={liveFormEfficiency}
        isSavingFuelLog={isSavingFuelLog}
        onClose={() => setIsAddModalOpen(false)}
        onSubmit={handleSaveFuelLog}
      />

      {/* =================================================================== */}
      {/* MODAL 2: KALKULATOR ESTIMASI BBM                                    */}
      {/* =================================================================== */}
      {isCalculatorModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-3 sm:p-5 overflow-y-auto">
          <div className="bg-white border border-slate-200 rounded-xl w-full max-w-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-slate-900">Kalkulator Estimasi Biaya BBM Rute</h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Hitung kebutuhan liter dan biaya per KM / per box berdasarkan standar rasio tipe armada.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsCalculatorModalOpen(false)}
                className="p-2 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Preset Rute</label>
                  <select
                    value={calcSelectedRoute}
                    onChange={e => handlePresetRouteChange(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-white border border-slate-200 text-sm text-slate-900 focus:outline-none focus:border-blue-600"
                  >
                    <option value="bwi-sby-pp">Banyuwangi – Surabaya PP (620 KM)</option>
                    <option value="bwi-mlg-pp">Banyuwangi – Malang PP (560 KM)</option>
                    <option value="bwi-dps-pp">Banyuwangi – Denpasar PP (340 KM)</option>
                    <option value="bwi-jbr-pp">Banyuwangi – Jember PP (210 KM)</option>
                    <option value="bwi-solo-pp">Banyuwangi – Solo PP (820 KM)</option>
                    <option value="custom">Input Jarak Manual</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Jarak Tempuh (KM)</label>
                  <input
                    type="number"
                    min="1"
                    value={calcDistanceKm}
                    onChange={e => {
                      setCalcSelectedRoute('custom');
                      setCalcDistanceKm(Number(e.target.value) || 0);
                    }}
                    className="w-full px-3 py-2 rounded-lg bg-white border border-slate-200 text-sm font-mono text-slate-900 focus:outline-none focus:border-blue-600"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Tipe Kendaraan</label>
                  <select
                    value={calcFleetType}
                    onChange={e => setCalcFleetType(e.target.value as VehicleType)}
                    className="w-full px-3 py-2 rounded-lg bg-white border border-slate-200 text-sm text-slate-900 focus:outline-none focus:border-blue-600"
                  >
                    {(Object.keys(FUEL_TARGET_RATIOS) as VehicleType[]).map(vt => (
                      <option key={vt} value={vt}>
                        {vt} (Target {FUEL_TARGET_RATIOS[vt].target} KM/L)
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Jenis &amp; Harga BBM</label>
                  <div className="grid grid-cols-2 gap-2">
                    <select
                      value={calcFuelType}
                      onChange={e => {
                        const ft = e.target.value as FuelType;
                        setCalcFuelType(ft);
                        setCalcCustomPrice(STANDARD_FUEL_PRICES[ft] || 6800);
                      }}
                      className="px-2.5 py-2 rounded-lg bg-white border border-slate-200 text-xs text-slate-900 focus:outline-none focus:border-blue-600"
                    >
                      {FUEL_TYPES.map(ft => (
                        <option key={ft} value={ft}>{ft}</option>
                      ))}
                    </select>
                    <input
                      type="number"
                      min="0"
                      value={calcCustomPrice}
                      onChange={e => setCalcCustomPrice(Number(e.target.value) || 0)}
                      className="px-2.5 py-2 rounded-lg bg-white border border-slate-200 text-xs font-mono text-slate-900 focus:outline-none focus:border-blue-600"
                    />
                  </div>
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Kapasitas Muatan (Box Kemasan)</label>
                  <input
                    type="number"
                    min="1"
                    value={calcCargoBoxes}
                    onChange={e => setCalcCargoBoxes(Number(e.target.value) || 1)}
                    className="w-full px-3 py-2 rounded-lg bg-white border border-slate-200 text-sm font-mono text-slate-900 focus:outline-none focus:border-blue-600"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 rounded-xl bg-slate-50 border border-slate-200">
                <div>
                  <div className="text-xs text-slate-500">Estimasi BBM</div>
                  <div className="text-lg font-bold text-slate-900 font-mono tabular-nums">{calcOutput.estLiters.toFixed(2)} L</div>
                  <div className="text-[11px] text-slate-500">Target {calcOutput.target} KM/L</div>
                </div>
                <div>
                  <div className="text-xs text-slate-500">Estimasi Biaya</div>
                  <div className="text-lg font-bold text-blue-600 font-mono tabular-nums">
                    Rp {calcOutput.estTotalCost.toLocaleString('id-ID')}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-slate-500">Biaya per KM</div>
                  <div className="text-lg font-bold text-slate-900 font-mono tabular-nums">
                    Rp {calcOutput.costPerKm.toLocaleString('id-ID')}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-slate-500">Biaya per Box</div>
                  <div className="text-lg font-bold text-slate-900 font-mono tabular-nums">
                    Rp {calcOutput.costPerBox.toLocaleString('id-ID')}
                  </div>
                </div>
              </div>
            </div>

            <div className="px-5 py-3.5 border-t border-slate-200 bg-slate-50 flex justify-end">
              <button
                type="button"
                onClick={() => setIsCalculatorModalOpen(false)}
                className="px-4 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold cursor-pointer"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* MODAL 3: SLIP DETAIL PENGISIAN BBM                                  */}
      {/* =================================================================== */}
      {selectedLogForDetail && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-xl w-full max-w-md overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-900">Slip Bukti Pengisian BBM</h3>
                <p className="text-xs text-slate-500 font-mono mt-0.5">ID: {selectedLogForDetail.id}</p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedLogForDetail(null)}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-2.5 text-sm">
              {[
                { label: 'Tanggal', value: selectedLogForDetail.date },
                { label: 'Armada', value: `${selectedLogForDetail.initialCode || selectedLogForDetail.plateNumber} (${selectedLogForDetail.plateNumber})` },
                { label: 'Driver', value: selectedLogForDetail.driverName },
                ...(selectedLogForDetail.helperName ? [{ label: 'Helper', value: selectedLogForDetail.helperName }] : []),
                { label: 'SPBU', value: selectedLogForDetail.gasStation },
                { label: 'Area Kirim', value: selectedLogForDetail.routeTrip || '-' },
                { label: 'Volume & Jenis', value: `${Number(selectedLogForDetail.liters || 0).toFixed(2)} L (${selectedLogForDetail.fuelType})` },
                { label: 'Total Biaya', value: `Rp ${selectedLogForDetail.totalCost.toLocaleString('id-ID')}` },
                { label: 'Odometer', value: `${selectedLogForDetail.startOdometerKm} – ${selectedLogForDetail.endOdometerKm} KM` },
                {
                  label: 'Jarak & Sumber',
                  value: `${selectedLogForDetail.distanceKm} KM (${
                    selectedLogForDetail.distanceSource === 'portal' ? 'Portal Driver' : 'Input BBM'
                  })`
                },
                { label: 'Rasio Aktual', value: `${selectedLogForDetail.ratioKmPerLiter} KM/L` },
                { label: 'Status', value: selectedLogForDetail.efficiencyStatus }
              ].map(row => (
                <div key={row.label} className="flex items-center justify-between gap-4 py-1.5 border-b border-slate-100 last:border-b-0">
                  <span className="text-xs text-slate-500">{row.label}</span>
                  <span className="text-xs font-semibold text-slate-900 text-right">{row.value}</span>
                </div>
              ))}

              {selectedLogForDetail.notes && (
                <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-700 mt-2">
                  <span className="font-semibold text-slate-900">Catatan:</span> {selectedLogForDetail.notes}
                </div>
              )}
            </div>

            <div className="px-5 py-3.5 border-t border-slate-200 bg-slate-50 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => window.print()}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 text-xs font-semibold cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Cetak</span>
              </button>
              <button
                type="button"
                onClick={() => setSelectedLogForDetail(null)}
                className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold cursor-pointer"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* EXPORT REPORT MODAL */}
      <FuelConsumptionReportModal
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        fuelLogs={reconciledLogs}
      />
    </div>
  );
};
