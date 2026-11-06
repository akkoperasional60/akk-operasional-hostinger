import React, { useState, useEffect, useMemo } from 'react';
import {
  Fuel,
  TrendingUp,
  AlertTriangle,
  Award,
  Calendar,
  Search,
  Filter,
  Download,
  Plus,
  Truck,
  User,
  MapPin,
  CheckCircle2,
  DollarSign,
  Gauge,
  HelpCircle,
  FileText,
  Calculator,
  ArrowRight,
  Info,
  RefreshCw,
  X,
  Printer,
  ChevronRight,
  ShieldCheck,
  Zap,
  Clock,
  Sparkles,
  Settings,
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Layers,
  Activity,
  FileSpreadsheet,
  ChevronDown,
  ChevronLeft,
  Check
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
  ReferenceLine
} from 'recharts';
import {
  FuelLog,
  FuelType,
  EfficiencyStatus,
  Fleet,
  Crew,
  VehicleType
} from '../types';
import { logisticsStore } from '../services/store';
import {
  FUEL_TARGET_RATIOS,
  STANDARD_FUEL_PRICES,
  COMMON_GAS_STATIONS
} from '../data/fuelMockData';
import { getCanonicalFleetOrderIndex, sortFleetsByCanonicalOrder } from '../data/mockData';
import { OFFICIAL_DESTINATION_AREAS } from '../utils/areaNormalizer';
import { FuelConsumptionReportModal } from './FuelConsumptionReportModal';
import { FuelWeeklyReportView } from './FuelWeeklyReportView';

interface FuelEfficiencyManagementProps {
  onNavigateToFleets?: () => void;
}

export const FuelEfficiencyManagement: React.FC<FuelEfficiencyManagementProps> = ({
  onNavigateToFleets
}) => {
  const [fuelLogs, setFuelLogs] = useState<FuelLog[]>(logisticsStore.getFuelLogs());
  const [fleets, setFleets] = useState<Fleet[]>(logisticsStore.getFleets());
  const [crews, setCrews] = useState<Crew[]>(logisticsStore.getCrews());
  const [activeTab, setActiveTab] = useState<'overview' | 'daily' | 'liter_km' | 'weekly_report' | 'leaderboard' | 'logs' | 'calculator'>('overview');
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);

  // Daily Bar Chart Filter States
  const [dailyFleetFilter, setDailyFleetFilter] = useState<string>('all');
  const [dailyRangeDays, setDailyRangeDays] = useState<number>(14); // 7, 14, 30, or 0 (all)
  const [dailyMetric, setDailyMetric] = useState<'liters' | 'literPerKm' | 'distanceKm'>('liters');
  const [dailyChartMode, setDailyChartMode] = useState<'grouped' | 'stacked'>('grouped');

  // Liter per KM Unit Analysis Filter States
  const [lKmSortBy, setLKmSortBy] = useState<'canonical_order' | 'lKm_asc' | 'lKm_desc' | 'efficiency_desc' | 'distance_desc'>('canonical_order');
  const [lKmSearch, setLKmSearch] = useState<string>('');
  const [comparisonSelectedFleetId, setComparisonSelectedFleetId] = useState<string>('all');

  // Interactive Converter Calculator
  const [simKmL, setSimKmL] = useState<number>(0);
  const [simLKm, setSimLKm] = useState<number>(0);

  // Search & Filters for logs table
  const [searchQuery, setSearchQuery] = useState('');
  const [filterFleetId, setFilterFleetId] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterFuelType, setFilterFuelType] = useState<string>('all');

  // Modal states
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [selectedLogForDetail, setSelectedLogForDetail] = useState<FuelLog | null>(null);

  // Form states for new fuel log
  const [formFleetId, setFormFleetId] = useState<string>('');
  const [formDriverName, setFormDriverName] = useState<string>('');
  const [formDriverId, setFormDriverId] = useState<string>('');
  const [formDate, setFormDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [formFuelType, setFormFuelType] = useState<FuelType>('BioSolar');
  const [formLiters, setFormLiters] = useState<string>('');
  const [formCostPerLiter, setFormCostPerLiter] = useState<string>('');
  const [formStartOdo, setFormStartOdo] = useState<string>('');
  const [formEndOdo, setFormEndOdo] = useState<string>('');
  const [formGasStation, setFormGasStation] = useState<string>('SPBU Farly');
  const [isGasStationDropdownOpen, setIsGasStationDropdownOpen] = useState<boolean>(false);
  const [formReceiptNumber, setFormReceiptNumber] = useState<string>('');
  const [formRouteTrip, setFormRouteTrip] = useState<string>('');
  const [formCargoLoadTon, setFormCargoLoadTon] = useState<string>('');
  const [formNotes, setFormNotes] = useState<string>('');

  // Modern Custom Popover Dropdown & Calendar States
  const [activeModalDropdown, setActiveModalDropdown] = useState<'fleet' | 'driver' | 'area' | 'date' | 'fuel' | 'chart_fleet' | null>(null);
  const [driverSearchFilter, setDriverSearchFilter] = useState<string>('');
  const [areaSearchFilter, setAreaSearchFilter] = useState<string>('');
  const [calendarViewMonth, setCalendarViewMonth] = useState<Date>(() => new Date());

  // Tersinkronisasi 100% dengan daftar Area Tujuan pada Jadwal & Penugasan
  const deliveryAreaOptions = useMemo(() => {
    const set = new Set<string>(OFFICIAL_DESTINATION_AREAS);
    try {
      const schedules = logisticsStore.getSchedules?.() || [];
      schedules.forEach((s: any) => {
        if (s?.destination && typeof s.destination === 'string' && s.destination.trim()) {
          set.add(s.destination.trim());
        }
      });
    } catch {
      // ignore
    }
    return Array.from(set);
  }, []);

  // Daftar nama driver untuk dropdown pengisian manual BBM
  const driverDropdownOptions = useMemo(() => {
    const defaultDrivers = [
      'Zainul Agustiar',
      'Ach Taufiq',
      'Faisol Arifin',
      'Aldi Wahyu Pradana',
      'Arif Bagus Muhammad Iqbal',
      'Budiono',
      'Suwarno',
      'Rudin Slamet',
      'Supriyanto',
      'Nanda Tegar Hadi Saputra',
      'Adit',
      'Aan Adi Saputra',
      'Bintang Wahyu Pratama',
      'Alphian Bayu Nugraha',
      'Mohamad Rohman',
      'Riki Novandito Ardiansyah',
      'Saifur Rizal'
    ];
    const map = new Map<string, { id: string; name: string; role: string }>();
    crews.forEach(c => {
      if (c.name && c.name.trim()) {
        map.set(c.name.trim().toLowerCase(), {
          id: c.id,
          name: c.name.trim(),
          role: c.role || 'Driver'
        });
      }
    });
    defaultDrivers.forEach((name, idx) => {
      const key = name.toLowerCase();
      if (!map.has(key)) {
        map.set(key, { id: `drv-${idx + 1}`, name, role: 'Driver' });
      }
    });
    return Array.from(map.values());
  }, [crews]);

  // Trip route calculator state
  const [calcFleetType, setCalcFleetType] = useState<VehicleType>('Engkel Long');
  const [calcDistanceKm, setCalcDistanceKm] = useState<number>(620); // Default Banyuwangi - Surabaya PP
  const [calcSelectedRoute, setCalcSelectedRoute] = useState<string>('bwi-sby-pp');
  const [calcFuelType, setCalcFuelType] = useState<FuelType>('BioSolar');
  const [calcCustomPrice, setCalcCustomPrice] = useState<number>(STANDARD_FUEL_PRICES['BioSolar']);
  const [calcCargoBoxes, setCalcCargoBoxes] = useState<number>(12000); // 12,000 pcs corrugated boxes

  useEffect(() => {
    return logisticsStore.subscribe(() => {
      setFuelLogs(logisticsStore.getFuelLogs());
      setFleets(logisticsStore.getFleets());
      setCrews(logisticsStore.getCrews());
    });
  }, []);

  // When formFleetId changes, autofill default odometer only if previous fuel log exists
  const handleFleetSelection = (fleetId: string) => {
    setFormFleetId(fleetId);
    const flt = fleets.find(f => f.id === fleetId);
    if (flt) {
      const latestFleetLog = fuelLogs.find(l => l.fleetId === flt.id || l.plateNumber === flt.plateNumber);
      if (latestFleetLog && latestFleetLog.endOdometerKm > 0) {
        setFormStartOdo(latestFleetLog.endOdometerKm.toString());
      } else {
        setFormStartOdo('');
      }
      // If driver is assigned to fleet or current crew
      const assignedCrew = crews.find(c => c.currentFleetId === flt.id);
      if (assignedCrew) {
        setFormDriverName(assignedCrew.name);
        setFormDriverId(assignedCrew.id);
      }
    }
  };

  // When fuel type changes in form
  const handleFuelTypeChange = (type: FuelType) => {
    setFormFuelType(type);
  };

  // Live calculation for Add Form
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
    const flt = fleets.find(f => f.id === formFleetId);
    const target = flt ? (FUEL_TARGET_RATIOS[flt.vehicleType]?.target || 7.5) : 7.5;
    if (liveFormRatio <= 0) return { status: 'Menunggu input' as const, color: 'text-slate-400' };
    if (liveFormRatio >= target * 1.05) {
      return { status: 'Sangat Efisien (Irit)', color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30' };
    }
    if (liveFormRatio >= target * 0.90) {
      return { status: 'Normal / Efisien', color: 'text-blue-400 bg-blue-500/10 border-blue-500/30' };
    }
    if (liveFormRatio >= target * 0.75) {
      return { status: 'Boros (Perlu Evaluasi)', color: 'text-amber-400 bg-amber-500/10 border-amber-500/30' };
    }
    return { status: 'Kritis / Potensi Anomali', color: 'text-rose-400 bg-rose-500/10 border-rose-500/30' };
  }, [liveFormRatio, formFleetId, fleets]);

  const handleSaveFuelLog = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formFleetId || !formLiters || !formStartOdo || !formEndOdo || !formDriverName) {
      return;
    }

    const flt = fleets.find(f => f.id === formFleetId);
    if (!flt) return;

    const startKm = Number(formStartOdo);
    const endKm = Number(formEndOdo);
    if (endKm <= startKm) {
      return;
    }

    logisticsStore.addFuelLog({
      fleetId: flt.id,
      plateNumber: flt.plateNumber,
      initialCode: flt.initialCode,
      vehicleType: flt.vehicleType,
      driverId: formDriverId || undefined,
      driverName: formDriverName,
      date: formDate,
      fuelType: formFuelType,
      liters: Number(formLiters),
      costPerLiter: Number(formCostPerLiter) || 0,
      startOdometerKm: startKm,
      endOdometerKm: endKm,
      gasStation: formGasStation,
      receiptNumber: formReceiptNumber || undefined,
      routeTrip: formRouteTrip || undefined,
      cargoLoadTon: formCargoLoadTon ? Number(formCargoLoadTon) : undefined,
      notes: formNotes || undefined
    });

    // Reset form
    setIsAddModalOpen(false);
    setFormLiters('');
    setFormCostPerLiter('');
    setFormStartOdo('');
    setFormEndOdo('');
    setFormNotes('');
    setFormReceiptNumber('');
    setFormRouteTrip('');
    setFormCargoLoadTon('');
  };

  // Summaries & Stats
  const kpiSummary = useMemo(() => {
    return logisticsStore.getFuelKPISummary();
  }, [fuelLogs, fleets]);

  const fleetSummaries = useMemo(() => {
    return logisticsStore.getFleetFuelSummary();
  }, [fuelLogs, fleets]);

  const driverScores = useMemo(() => {
    return logisticsStore.getDriverFuelScores();
  }, [fuelLogs]);

  // Chart Data: Realization vs Target per fleet
  const fleetComparisonChartData = useMemo(() => {
    return fleetSummaries.map(fs => ({
      name: fs.initialCode || fs.plateNumber,
      plate: fs.plateNumber,
      realisasi: fs.avgKmPerLiter,
      target: fs.targetRatio,
      tipe: fs.vehicleType
    }));
  }, [fleetSummaries]);

  // Chart Data: Timeline fuel consumption (last 7 days or recent logs)
  const timelineChartData = useMemo(() => {
    const map = new Map<string, { date: string; liters: number; distance: number }>();
    const sorted = [...fuelLogs].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    sorted.forEach(l => {
      if (!map.has(l.date)) {
        map.set(l.date, { date: l.date.substring(5), liters: 0, distance: 0 });
      }
      const item = map.get(l.date)!;
      item.liters += l.liters;
      item.distance += l.distanceKm;
    });
    return Array.from(map.values()).slice(-7);
  }, [fuelLogs]);

  // Fuel Type Breakdown
  const fuelTypePieData = useMemo(() => {
    const counts: Record<string, number> = {};
    fuelLogs.forEach(l => {
      counts[l.fuelType] = (counts[l.fuelType] || 0) + l.liters;
    });
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [fuelLogs]);

  const PIE_COLORS = ['#3b82f6', '#f59e0b', '#10b981', '#ec4899', '#8b5cf6'];

  // Color palette and labels for AKK Fleets
  const FLEET_COLORS: Record<string, { fill: string; stroke: string; label: string }> = {
    'EL-01': { fill: '#f59e0b', stroke: '#d97706', label: 'EL-01 (Engkel Long)' },
    'DS-02': { fill: '#3b82f6', stroke: '#2563eb', label: 'DS-02 (Double STD)' },
    'ES-03': { fill: '#10b981', stroke: '#059669', label: 'ES-03 (Engkel STD)' },
    'DS-04': { fill: '#a855f7', stroke: '#9333ea', label: 'DS-04 (Double STD)' },
    'PB-05': { fill: '#06b6d4', stroke: '#0891b2', label: 'PB-05 (Pick Up Box)' },
    'DS-06': { fill: '#f43f5e', stroke: '#e11d48', label: 'DS-06 (Double STD)' },
  };

  // 1. Process Daily Fuel Consumption Data for Bar Chart
  const dailyConsumptionData = useMemo(() => {
    const now = new Date('2026-09-22');
    const filteredByDays = fuelLogs.filter(l => {
      if (dailyRangeDays === 0) return true;
      const d = new Date(l.date);
      const diffTime = Math.abs(now.getTime() - d.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      return diffDays <= dailyRangeDays;
    });

    const dateMap = new Map<string, {
      date: string;
      displayDate: string;
      totalLiters: number;
      totalDistanceKm: number;
      dailyLKm: number;
      dailyKmL: number;
      recordsCount: number;
      details: { fleetCode: string; plateNumber: string; liters: number; distanceKm: number; driverName: string; routeTrip: string; lKm: number }[];
      [key: string]: any;
    }>();

    const sortedLogs = [...filteredByDays].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    sortedLogs.forEach(l => {
      const dKey = l.date;
      if (!dateMap.has(dKey)) {
        const dObj = new Date(dKey);
        const displayDate = dObj.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
        dateMap.set(dKey, {
          date: dKey,
          displayDate,
          totalLiters: 0,
          totalDistanceKm: 0,
          dailyLKm: 0,
          dailyKmL: 0,
          recordsCount: 0,
          details: []
        });
      }

      const item = dateMap.get(dKey)!;
      const code = l.initialCode || l.plateNumber;
      item[code] = Number(((item[code] || 0) + l.liters).toFixed(1));
      item[`${code}_km`] = (item[`${code}_km`] || 0) + l.distanceKm;
      const singleLKm = l.distanceKm > 0 ? Number((l.liters / l.distanceKm).toFixed(4)) : 0;
      item[`${code}_lkm`] = singleLKm;

      item.totalLiters = Number((item.totalLiters + l.liters).toFixed(1));
      item.totalDistanceKm += l.distanceKm;
      item.recordsCount += 1;
      item.details.push({
        fleetCode: code,
        plateNumber: l.plateNumber,
        liters: l.liters,
        distanceKm: l.distanceKm,
        driverName: l.driverName,
        routeTrip: l.routeTrip || 'Rute Operasional AKK',
        lKm: singleLKm
      });
    });

    return Array.from(dateMap.values()).map(item => {
      item.dailyLKm = item.totalDistanceKm > 0 ? Number((item.totalLiters / item.totalDistanceKm).toFixed(4)) : 0;
      item.dailyKmL = item.totalLiters > 0 ? Number((item.totalDistanceKm / item.totalLiters).toFixed(2)) : 0;
      return item;
    });
  }, [fuelLogs, dailyRangeDays]);

  // Single Fleet Daily Chart Data
  const singleFleetDailyData = useMemo(() => {
    if (dailyFleetFilter === 'all') return [];
    const flt = fleets.find(f => f.id === dailyFleetFilter);
    const code = flt?.initialCode || flt?.plateNumber || '';
    return dailyConsumptionData.map(d => {
      const liters = d[code] || 0;
      const distance = d[`${code}_km`] || 0;
      const lkm = d[`${code}_lkm`] || (distance > 0 ? Number((liters / distance).toFixed(4)) : 0);
      return {
        date: d.date,
        displayDate: d.displayDate,
        liters,
        distance,
        lkm,
        hasData: liters > 0,
        fleetCode: code,
        plateNumber: flt?.plateNumber
      };
    }).filter(d => d.hasData);
  }, [dailyConsumptionData, dailyFleetFilter, fleets]);

  // Daily Bar Chart Aggregate Statistics
  const dailyChartStats = useMemo(() => {
    let totalLiters = 0;
    let totalDistance = 0;
    let peakDay = { date: '-', liters: 0 };
    const fleetTotals: Record<string, number> = {};

    dailyConsumptionData.forEach(d => {
      totalLiters += d.totalLiters;
      totalDistance += d.totalDistanceKm;
      if (d.totalLiters > peakDay.liters) {
        peakDay = { date: d.displayDate, liters: d.totalLiters };
      }
      d.details.forEach(det => {
        fleetTotals[det.fleetCode] = (fleetTotals[det.fleetCode] || 0) + det.liters;
      });
    });

    let topFleet = { code: '-', liters: 0 };
    Object.entries(fleetTotals).forEach(([code, liters]) => {
      if (liters > topFleet.liters) {
        topFleet = { code, liters };
      }
    });

    const activeDays = dailyConsumptionData.length;
    const avgLitersPerDay = activeDays > 0 ? Number((totalLiters / activeDays).toFixed(1)) : 0;
    const avgLKmPeriod = totalDistance > 0 ? Number((totalLiters / totalDistance).toFixed(4)) : 0;

    return {
      totalLiters: Number(totalLiters.toFixed(1)),
      totalDistance,
      avgLitersPerDay,
      avgLKmPeriod,
      peakDay,
      topFleet,
      activeDays
    };
  }, [dailyConsumptionData]);

  // 2. Unit Vehicles L/KM Calculation and In-depth Analysis (Sorted N1, A3, N3, N4, N5, N20, N21, N22, N23, S5, DS4, DS5)
  const unitLKmAnalysis = useMemo(() => {
    const orderedSummaries = [...fleetSummaries].sort(
      (a, b) => getCanonicalFleetOrderIndex(a.initialCode || a.plateNumber) - getCanonicalFleetOrderIndex(b.initialCode || b.plateNumber)
    );

    const list = orderedSummaries.map(fs => {
      const hasData = fs.totalDistanceKm > 0 && fs.totalLiters > 0;
      const avgLKm = hasData ? Number((fs.totalLiters / fs.totalDistanceKm).toFixed(4)) : 0;
      const avgL100Km = hasData ? Number(((fs.totalLiters / fs.totalDistanceKm) * 100).toFixed(2)) : 0;
      const targetLKm = hasData && fs.targetRatio > 0 ? Number((1 / fs.targetRatio).toFixed(4)) : 0;
      const targetL100Km = hasData && fs.targetRatio > 0 ? Number((100 / fs.targetRatio).toFixed(2)) : 0;

      const savingPct = hasData && targetLKm > 0 ? Number((((targetLKm - avgLKm) / targetLKm) * 100).toFixed(1)) : 0;
      const isSaving = savingPct >= 0;

      const avgCostPerKm = hasData ? Math.round(fs.totalCost / fs.totalDistanceKm) : 0;
      let statusColor = 'text-slate-400 bg-slate-800/60 border-slate-700';
      if (hasData) {
        if (fs.status === 'Sangat Efisien') statusColor = 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30';
        else if (fs.status === 'Efisien / Normal') statusColor = 'text-blue-400 bg-blue-500/10 border-blue-500/30';
        else if (fs.status === 'Boros') statusColor = 'text-amber-400 bg-amber-500/10 border-amber-500/30';
        else if (fs.status === 'Kritis / Potensi Anomali') statusColor = 'text-rose-400 bg-rose-500/10 border-rose-500/30';
      }

      // Resolve latest driverName & areaKirim from fuelLogs for this unit
      const unitLogs = fuelLogs.filter(
        l => l.fleetId === fs.fleetId || (l.plateNumber && l.plateNumber.toUpperCase() === fs.plateNumber.toUpperCase())
      );
      const latestLog = unitLogs[0];
      const driverName = latestLog?.driverName || '-';
      const areaKirim = latestLog?.routeTrip || '-';

      return {
        ...fs,
        hasData,
        avgLKm,
        avgL100Km,
        targetLKm,
        targetL100Km,
        avgCostPerKm,
        statusColor,
        savingPct,
        isSaving,
        driverName,
        areaKirim
      };
    });

    // Apply search filter
    const filtered = list.filter(item => {
      if (!lKmSearch) return true;
      const q = lKmSearch.toLowerCase();
      return (
        item.plateNumber.toLowerCase().includes(q) ||
        (item.initialCode && item.initialCode.toLowerCase().includes(q)) ||
        item.vehicleType.toLowerCase().includes(q) ||
        item.driverName.toLowerCase().includes(q) ||
        item.areaKirim.toLowerCase().includes(q)
      );
    });

    // Apply sorting (default: canonical sequence N1, A3, N3, N4, N5, N20, N21, N22, N23, S5, DS4, DS5)
    return filtered.sort((a, b) => {
      if (lKmSortBy === 'canonical_order') {
        return getCanonicalFleetOrderIndex(a.initialCode || a.plateNumber) - getCanonicalFleetOrderIndex(b.initialCode || b.plateNumber);
      }
      if (lKmSortBy === 'lKm_asc') return a.avgLKm - b.avgLKm;
      if (lKmSortBy === 'lKm_desc') return b.avgLKm - a.avgLKm;
      if (lKmSortBy === 'efficiency_desc') return b.efficiencyScore - a.efficiencyScore;
      if (lKmSortBy === 'distance_desc') return b.totalDistanceKm - a.totalDistanceKm;
      return getCanonicalFleetOrderIndex(a.initialCode || a.plateNumber) - getCanonicalFleetOrderIndex(b.initialCode || b.plateNumber);
    });
  }, [fleetSummaries, fuelLogs, lKmSearch, lKmSortBy]);

  // Chart data for comparing Liter per KM vs Target L/KM (Strictly ordered N1..DS5)
  const lKmComparisonChartData = useMemo(() => {
    const orderedSummaries = [...fleetSummaries].sort(
      (a, b) => getCanonicalFleetOrderIndex(a.initialCode || a.plateNumber) - getCanonicalFleetOrderIndex(b.initialCode || b.plateNumber)
    );
    const mapped = orderedSummaries.map(fs => {
      const hasData = fs.totalDistanceKm > 0 && fs.totalLiters > 0;
      const avgLKm = hasData ? Number((fs.totalLiters / fs.totalDistanceKm).toFixed(4)) : 0;
      const targetLKm = hasData && fs.targetRatio > 0 ? Number((1 / fs.targetRatio).toFixed(4)) : 0;
      const unitLogs = fuelLogs.filter(
        l => l.fleetId === fs.fleetId || (l.plateNumber && l.plateNumber.toUpperCase() === fs.plateNumber.toUpperCase())
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
        targetLKm: targetLKm,
        aktualL100Km: Number((avgLKm * 100).toFixed(2)),
        targetL100Km: Number((targetLKm * 100).toFixed(2)),
        aktualKmL: hasData ? fs.avgKmPerLiter : 0,
        targetKmL: hasData ? fs.targetRatio : 0
      };
    });
    if (comparisonSelectedFleetId !== 'all') {
      return mapped.filter(m => m.fleetId === comparisonSelectedFleetId);
    }
    return mapped;
  }, [fleetSummaries, fuelLogs, comparisonSelectedFleetId]);

  // Filtered Fuel Logs
  const filteredLogs = useMemo(() => {
    return fuelLogs.filter(log => {
      const q = searchQuery.toLowerCase();
      const matchQuery =
        !searchQuery ||
        log.plateNumber.toLowerCase().includes(q) ||
        (log.initialCode && log.initialCode.toLowerCase().includes(q)) ||
        log.driverName.toLowerCase().includes(q) ||
        log.gasStation.toLowerCase().includes(q) ||
        (log.routeTrip && log.routeTrip.toLowerCase().includes(q)) ||
        (log.receiptNumber && log.receiptNumber.toLowerCase().includes(q));

      const matchFleet = filterFleetId === 'all' || log.fleetId === filterFleetId;
      const matchStatus = filterStatus === 'all' || log.efficiencyStatus === filterStatus;
      const matchFuel = filterFuelType === 'all' || log.fuelType === filterFuelType;

      return matchQuery && matchFleet && matchStatus && matchFuel;
    });
  }, [fuelLogs, searchQuery, filterFleetId, filterStatus, filterFuelType]);

  // Route Preset Selection Handler for Calculator
  const handlePresetRouteChange = (routeKey: string) => {
    setCalcSelectedRoute(routeKey);
    switch (routeKey) {
      case 'bwi-sby-pp':
        setCalcDistanceKm(620);
        break;
      case 'bwi-mlg-pp':
        setCalcDistanceKm(560);
        break;
      case 'bwi-jbr-pp':
        setCalcDistanceKm(210);
        break;
      case 'bwi-dps-pp':
        setCalcDistanceKm(340);
        break;
      case 'bwi-solo-pp':
        setCalcDistanceKm(820);
        break;
      case 'custom':
        break;
    }
  };

  // Calculator Outputs
  const calcOutput = useMemo(() => {
    const target = FUEL_TARGET_RATIOS[calcFleetType]?.target || 7.5;
    const estLiters = Number((calcDistanceKm / target).toFixed(1));
    const estTotalCost = Math.round(estLiters * calcCustomPrice);
    const costPerKm = calcDistanceKm > 0 ? Math.round(estTotalCost / calcDistanceKm) : 0;
    const costPerBox = calcCargoBoxes > 0 ? Math.round(estTotalCost / calcCargoBoxes) : 0;

    return {
      target,
      estLiters,
      estTotalCost,
      costPerKm,
      costPerBox
    };
  }, [calcFleetType, calcDistanceKm, calcCustomPrice, calcCargoBoxes]);

  // Export to CSV
  const handleExportCSV = () => {
    const headers = [
      'ID Log',
      'Tanggal',
      'Plat Nomor',
      'Inisial',
      'Tipe Kendaraan',
      'Driver',
      'Jenis BBM',
      'Liter',
      'Harga/L',
      'Total Biaya (Rp)',
      'KM Awal',
      'KM Akhir',
      'Jarak (KM)',
      'Rasio (KM/L)',
      'Standar Target',
      'Status Efisiensi',
      'SPBU',
      'No Struk',
      'Rute Perjalanan',
      'Catatan'
    ];

    const rows = filteredLogs.map(l => [
      l.id,
      l.date,
      l.plateNumber,
      l.initialCode || '-',
      l.vehicleType,
      l.driverName,
      l.fuelType,
      l.liters,
      l.costPerLiter,
      l.totalCost,
      l.startOdometerKm,
      l.endOdometerKm,
      l.distanceKm,
      l.ratioKmPerLiter,
      l.targetRatio,
      l.efficiencyStatus,
      `"${l.gasStation}"`,
      l.receiptNumber || '-',
      `"${l.routeTrip || '-'}"`,
      `"${l.notes || '-'}"`
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `rekap_efisiensi_bbm_akk_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      {/* ========================================================================= */}
      {/* 1. TOP HEADER & ACTION BAR                                               */}
      {/* ========================================================================= */}
      <div className="bg-slate-900/90 border border-slate-800/80 rounded-2xl p-5 shadow-lg relative overflow-hidden backdrop-blur-sm">
        <div className="absolute -right-16 -top-16 w-56 h-56 bg-amber-500/5 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 relative z-10">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-400">
                <Fuel className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-xl font-black text-white tracking-tight">
                    Efisiensi BBM & Manajemen Konsumsi Armada
                  </h1>
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                    Eco-Fleet
                  </span>
                </div>
                <p className="text-xs text-slate-400">
                  Pemantauan rasio kilometer per liter (KM/L), audit biaya operasional pengisian bahan bakar, dan analisis eco-driving kru pengiriman PT Anugrah Kemasan Kreatif.
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              onClick={() => setIsAddModalOpen(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs shadow-md transition active:scale-95 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Catat Pengisian BBM</span>
            </button>

            <button
              onClick={() => setIsExportModalOpen(true)}
              className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-md transition active:scale-95 cursor-pointer"
              title="Export Laporan Konsumsi BBM Format PDF / Excel (Ringkasan Mingguan per Driver & Armada)"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>Export Laporan BBM</span>
              <span className="px-1.5 py-0.2 rounded text-[9px] bg-emerald-700/70 text-emerald-100 font-extrabold uppercase">
                PDF/Excel
              </span>
            </button>

            <button
              onClick={() => setActiveTab('calculator')}
              className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold transition cursor-pointer"
            >
              <Calculator className="w-4 h-4 text-amber-400" />
              <span>Kalkulator Rute</span>
            </button>

            <button
              onClick={handleExportCSV}
              className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold transition cursor-pointer"
              title="Ekspor Data Rekap ke CSV"
            >
              <Download className="w-4 h-4 text-emerald-400" />
              <span className="hidden sm:inline">Ekspor CSV</span>
            </button>
          </div>
        </div>

        {/* 5 PRIMARY METRICS ROW */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 pt-5 mt-5 border-t border-slate-800/70">
          <div className="bg-slate-950/60 p-3.5 rounded-xl border border-slate-800">
            <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
              <span className="font-semibold">Rata-rata Rasio Armada</span>
              <Gauge className="w-4 h-4 text-blue-400" />
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl font-black text-white font-mono">
                {kpiSummary.overallAvgKmPerLiter}
              </span>
              <span className="text-xs text-slate-400 font-bold">KM / L</span>
            </div>
            <div className="text-[11px] text-emerald-400 mt-1 flex items-center gap-1 font-medium">
              <CheckCircle2 className="w-3 h-3" />
              <span>Target Standard: 7.5 KM/L</span>
            </div>
          </div>

          <div className="bg-slate-950/60 p-3.5 rounded-xl border border-slate-800 ring-1 ring-amber-500/20">
            <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
              <span className="font-semibold text-amber-300">Rata-rata Liter / KM</span>
              <Activity className="w-4 h-4 text-amber-400" />
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl font-black text-amber-400 font-mono">
                {kpiSummary.overallAvgLiterPerKm || 0}
              </span>
              <span className="text-xs text-amber-300/80 font-bold">L / KM</span>
            </div>
            <div className="text-[11px] text-slate-300 mt-1 flex items-center gap-1 font-mono">
              <span>{kpiSummary.overallAvgLiterPer100Km || 0} L/100 KM</span>
            </div>
          </div>

          <div className="bg-slate-950/60 p-3.5 rounded-xl border border-slate-800">
            <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
              <span className="font-semibold">Total BBM Terdata</span>
              <Fuel className="w-4 h-4 text-amber-400" />
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl font-black text-white font-mono">
                {kpiSummary.totalLiters.toLocaleString('id-ID')}
              </span>
              <span className="text-xs text-slate-400 font-bold">Liter</span>
            </div>
            <div className="text-[11px] text-slate-400 mt-1">
              Jarak Total: <span className="font-bold text-slate-300">{kpiSummary.totalDistanceKm.toLocaleString('id-ID')} KM</span>
            </div>
          </div>

          <div className="bg-slate-950/60 p-3.5 rounded-xl border border-slate-800">
            <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
              <span className="font-semibold">Total Pengeluaran BBM</span>
              <DollarSign className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="text-2xl font-black text-white font-mono">
              Rp {(kpiSummary.totalCost / 1000000).toFixed(2)} <span className="text-xs font-normal text-slate-400">Juta</span>
            </div>
            <div className="text-[11px] text-slate-400 mt-1">
              Biaya rata-rata: <span className="font-bold text-emerald-400">Rp {kpiSummary.overallAvgCostPerKm.toLocaleString('id-ID')} / KM</span>
            </div>
          </div>

          <div className="bg-slate-950/60 p-3.5 rounded-xl border border-slate-800">
            <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
              <span className="font-semibold">Anomali / Perlu Cek</span>
              <AlertTriangle className={`w-4 h-4 ${kpiSummary.totalAnomalies > 0 ? 'text-rose-400' : 'text-emerald-400'}`} />
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className={`text-2xl font-black font-mono ${kpiSummary.totalAnomalies > 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
                {kpiSummary.totalAnomalies}
              </span>
              <span className="text-xs text-slate-400 font-bold">Armada</span>
            </div>
            <div className="text-[11px] text-rose-300 mt-1 truncate">
              {kpiSummary.leastFleet ? (
                <span>Truk {kpiSummary.leastFleet.initialCode || kpiSummary.leastFleet.plateNumber} ({kpiSummary.leastFleet.avgKmPerLiter} KM/L)</span>
              ) : 'Semua armada efisien'}
            </div>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 2. TAB CONTROLS                                                           */}
      {/* ========================================================================= */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-2 overflow-x-auto">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTab('overview')}
            className={`flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-xs font-bold transition cursor-pointer whitespace-nowrap ${
              activeTab === 'overview'
                ? 'bg-amber-500 text-slate-950 shadow-md'
                : 'bg-slate-900 text-slate-300 hover:bg-slate-800 border border-slate-800'
            }`}
          >
            <TrendingUp className="w-4 h-4" />
            <span>Grafik & Analisis Efisiensi</span>
          </button>

          <button
            onClick={() => setActiveTab('daily')}
            className={`flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-xs font-bold transition cursor-pointer whitespace-nowrap ${
              activeTab === 'daily'
                ? 'bg-amber-500 text-slate-950 shadow-md'
                : 'bg-slate-900 text-slate-300 hover:bg-slate-800 border border-slate-800'
            }`}
          >
            <BarChart className="w-4 h-4" />
            <span>Grafik Konsumsi Harian Armada</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-slate-950/40 text-current">
              {dailyConsumptionData.length} Hari
            </span>
          </button>

          <button
            onClick={() => setActiveTab('liter_km')}
            className={`flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-xs font-bold transition cursor-pointer whitespace-nowrap ${
              activeTab === 'liter_km'
                ? 'bg-amber-500 text-slate-950 shadow-md'
                : 'bg-slate-900 text-slate-300 hover:bg-slate-800 border border-slate-800'
            }`}
          >
            <Gauge className="w-4 h-4" />
            <span>Rata-rata Liter/KM Kendaraan</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-slate-950/40 text-current">
              {fleetSummaries.length} Unit
            </span>
          </button>

          <button
            onClick={() => setActiveTab('weekly_report')}
            className={`flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-xs font-bold transition cursor-pointer whitespace-nowrap ${
              activeTab === 'weekly_report'
                ? 'bg-amber-500 text-slate-950 shadow-md'
                : 'bg-slate-900 text-slate-300 hover:bg-slate-800 border border-slate-800'
            }`}
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
            <span>Laporan & Rekap Mingguan</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
              PDF/Excel
            </span>
          </button>

          <button
            onClick={() => setActiveTab('leaderboard')}
            className={`flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-xs font-bold transition cursor-pointer whitespace-nowrap ${
              activeTab === 'leaderboard'
                ? 'bg-amber-500 text-slate-950 shadow-md'
                : 'bg-slate-900 text-slate-300 hover:bg-slate-800 border border-slate-800'
            }`}
          >
            <Award className="w-4 h-4" />
            <span>Papan Peringkat Eco-Driver</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-slate-950/40 text-current">
              {driverScores.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('logs')}
            className={`flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-xs font-bold transition cursor-pointer whitespace-nowrap ${
              activeTab === 'logs'
                ? 'bg-amber-500 text-slate-950 shadow-md'
                : 'bg-slate-900 text-slate-300 hover:bg-slate-800 border border-slate-800'
            }`}
          >
            <FileText className="w-4 h-4" />
            <span>Audit Riwayat Pengisian BBM</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-slate-950/40 text-current">
              {fuelLogs.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('calculator')}
            className={`flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-xs font-bold transition cursor-pointer whitespace-nowrap ${
              activeTab === 'calculator'
                ? 'bg-amber-500 text-slate-950 shadow-md'
                : 'bg-slate-900 text-slate-300 hover:bg-slate-800 border border-slate-800'
            }`}
          >
            <Calculator className="w-4 h-4" />
            <span>Kalkulator Rute & Estimasi BBM</span>
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 3. TAB 1: OVERVIEW & CHARTS                                               */}
      {/* ========================================================================= */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* ANOMALY ALERT BANNER IF APPLICABLE */}
          {kpiSummary.totalAnomalies > 0 && (
            <div className="bg-rose-500/10 border border-rose-500/30 rounded-2xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className="p-2 bg-rose-500/20 text-rose-400 rounded-xl mt-0.5">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-rose-300">
                    Peringatan Anomali Konsumsi BBM Terdeteksi ({kpiSummary.totalAnomalies} Catatan)
                  </h4>
                  <p className="text-xs text-slate-300 mt-0.5 leading-relaxed">
                    Terdapat armada dengan rasio konsumsi jauh di bawah target efisiensi pabrik (&lt; 5.0 KM/L). Mohon periksa kondisi nozzle injektor, filter solar, potensi kebocoran tangki, atau durasi idling mesin terlalu lama saat antrean muat karton box.
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  setFilterStatus('Kritis / Potensi Anomali');
                  setActiveTab('logs');
                }}
                className="shrink-0 px-3 py-1.5 rounded-lg bg-rose-500 hover:bg-rose-600 text-white text-xs font-bold transition cursor-pointer"
              >
                Lihat Rincian Anomali &rarr;
              </button>
            </div>
          )}

          {/* STANDAR EFISIENSI PER JENIS KENDARAAN BANNER */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {Object.entries(FUEL_TARGET_RATIOS).map(([vType, cfg]) => (
              <div key={vType} className="bg-slate-900/80 p-3 rounded-xl border border-slate-800">
                <div className="text-[11px] text-slate-400 font-semibold">{vType}</div>
                <div className="text-lg font-black text-amber-400 font-mono">{cfg.label}</div>
                <div className="text-[10px] text-slate-400">Batas Wajar Min: {cfg.minAcceptable} KM/L</div>
              </div>
            ))}
          </div>

          {/* ========================================================================= */}
          {/* SECTION A: VISUALISASI KONSUMSI BBM HARIAN PER ARMADA (GRAFIK BATANG)      */}
          {/* ========================================================================= */}
          <div className="bg-slate-900 p-5 rounded-2xl border border-slate-800 shadow-sm space-y-4">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-800 pb-4">
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <div className="p-2 rounded-xl bg-amber-500/15 text-amber-400 border border-amber-500/30">
                    <BarChart className="w-5 h-5" />
                  </div>
                  <h3 className="text-base font-bold text-white tracking-tight">
                    Visualisasi Konsumsi BBM Harian per Armada
                  </h3>
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/15 text-amber-400 border border-amber-500/30">
                    Grafik Batang Harian
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-1">
                  Grafik batang konsumsi bahan bakar (Liter) harian masing-masing armada PT AKK dengan filter rentang waktu dan unit truk.
                </p>
              </div>

              {/* Interactive Controls Bar */}
              <div className="flex flex-wrap items-center gap-2">
                {/* Fleet Filter */}
                <div className="flex items-center gap-1.5 bg-slate-950 px-2.5 py-1.5 rounded-xl border border-slate-800 text-xs">
                  <Truck className="w-3.5 h-3.5 text-slate-400" />
                  <select
                    value={dailyFleetFilter}
                    onChange={(e) => setDailyFleetFilter(e.target.value)}
                    className="bg-transparent text-slate-200 font-semibold text-xs focus:outline-none cursor-pointer"
                  >
                    <option value="all" className="bg-slate-900">Semua Armada</option>
                    {fleets.map(f => (
                      <option key={f.id} value={f.id} className="bg-slate-900">
                        {f.initialCode || f.plateNumber} ({f.plateNumber})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Day Range Filter */}
                <div className="flex items-center gap-1.5 bg-slate-950 px-2.5 py-1.5 rounded-xl border border-slate-800 text-xs">
                  <Calendar className="w-3.5 h-3.5 text-slate-400" />
                  <select
                    value={dailyRangeDays}
                    onChange={(e) => setDailyRangeDays(Number(e.target.value))}
                    className="bg-transparent text-slate-200 font-semibold text-xs focus:outline-none cursor-pointer"
                  >
                    <option value={7} className="bg-slate-900">7 Hari Terakhir</option>
                    <option value={14} className="bg-slate-900">14 Hari Terakhir</option>
                    <option value={30} className="bg-slate-900">30 Hari Terakhir</option>
                    <option value={0} className="bg-slate-900">Semua Riwayat</option>
                  </select>
                </div>

                {/* Metric Selector */}
                {dailyFleetFilter === 'all' && (
                  <div className="flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs">
                    <button
                      onClick={() => setDailyMetric('liters')}
                      className={`px-2.5 py-1 rounded-lg font-semibold transition cursor-pointer text-[11px] ${
                        dailyMetric === 'liters' ? 'bg-amber-500 text-slate-950 font-bold shadow-xs' : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      Liter BBM
                    </button>
                    <button
                      onClick={() => setDailyMetric('literPerKm')}
                      className={`px-2.5 py-1 rounded-lg font-semibold transition cursor-pointer text-[11px] ${
                        dailyMetric === 'literPerKm' ? 'bg-amber-500 text-slate-950 font-bold shadow-xs' : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      Liter / KM
                    </button>
                    <button
                      onClick={() => setDailyMetric('distanceKm')}
                      className={`px-2.5 py-1 rounded-lg font-semibold transition cursor-pointer text-[11px] ${
                        dailyMetric === 'distanceKm' ? 'bg-amber-500 text-slate-950 font-bold shadow-xs' : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      Jarak (KM)
                    </button>
                  </div>
                )}

                {/* Stacked or Grouped Bar Mode */}
                {dailyFleetFilter === 'all' && dailyMetric === 'liters' && (
                  <div className="flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs">
                    <button
                      onClick={() => setDailyChartMode('grouped')}
                      className={`px-2.5 py-1 rounded-lg font-semibold transition cursor-pointer text-[11px] ${
                        dailyChartMode === 'grouped' ? 'bg-blue-600 text-white font-bold shadow-xs' : 'text-slate-400 hover:text-white'
                      }`}
                      title="Batang Berdampingan"
                    >
                      Berdampingan
                    </button>
                    <button
                      onClick={() => setDailyChartMode('stacked')}
                      className={`px-2.5 py-1 rounded-lg font-semibold transition cursor-pointer text-[11px] ${
                        dailyChartMode === 'stacked' ? 'bg-blue-600 text-white font-bold shadow-xs' : 'text-slate-400 hover:text-white'
                      }`}
                      title="Batang Bertumpuk (Total Harian)"
                    >
                      Bertumpuk
                    </button>
                  </div>
                )}

                <button
                  onClick={() => setActiveTab('daily')}
                  className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-amber-400 hover:text-amber-300 border border-slate-700 text-xs font-bold transition cursor-pointer flex items-center gap-1.5"
                >
                  <span>Tampilan Detail Harian</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Quick Metrics of the Filtered Period */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="bg-slate-950/70 p-3 rounded-xl border border-slate-800/80">
                <div className="text-[11px] text-slate-400 font-medium">Total BBM Periode Ini</div>
                <div className="text-lg font-black text-amber-400 font-mono mt-0.5">
                  {dailyChartStats.totalLiters.toLocaleString('id-ID')} <span className="text-xs font-normal text-slate-400">Liter</span>
                </div>
                <div className="text-[10px] text-slate-400 mt-0.5">{dailyChartStats.activeDays} hari operasional aktif</div>
              </div>

              <div className="bg-slate-950/70 p-3 rounded-xl border border-slate-800/80">
                <div className="text-[11px] text-slate-400 font-medium">Rata-rata Konsumsi Harian</div>
                <div className="text-lg font-black text-blue-400 font-mono mt-0.5">
                  {dailyChartStats.avgLitersPerDay} <span className="text-xs font-normal text-slate-400">L / Hari</span>
                </div>
                <div className="text-[10px] text-slate-400 mt-0.5">Rasio: {dailyChartStats.avgLKmPeriod} L/KM</div>
              </div>

              <div className="bg-slate-950/70 p-3 rounded-xl border border-slate-800/80">
                <div className="text-[11px] text-slate-400 font-medium">Hari Puncak Konsumsi (Peak)</div>
                <div className="text-lg font-black text-rose-400 font-mono mt-0.5">
                  {dailyChartStats.peakDay.liters} <span className="text-xs font-normal text-slate-400">Liter</span>
                </div>
                <div className="text-[10px] text-slate-400 mt-0.5">Tanggal {dailyChartStats.peakDay.date}</div>
              </div>

              <div className="bg-slate-950/70 p-3 rounded-xl border border-slate-800/80">
                <div className="text-[11px] text-slate-400 font-medium">Armada Konsumsi Tertinggi</div>
                <div className="text-lg font-black text-emerald-400 font-mono mt-0.5">
                  {dailyChartStats.topFleet.code}
                </div>
                <div className="text-[10px] text-slate-400 mt-0.5">{dailyChartStats.topFleet.liters} Liter di periode ini</div>
              </div>
            </div>

            {/* THE BAR CHART */}
            <div className="bg-slate-950/40 p-4 rounded-xl border border-slate-800/70">
              <div className="h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  {dailyFleetFilter === 'all' ? (
                    <BarChart
                      data={dailyConsumptionData}
                      margin={{ top: 15, right: 15, left: -15, bottom: 5 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                      <XAxis dataKey="displayDate" stroke="#94a3b8" fontSize={11} />
                      <YAxis
                        stroke="#94a3b8"
                        fontSize={11}
                        unit={dailyMetric === 'liters' ? ' L' : dailyMetric === 'literPerKm' ? '' : ' KM'}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: '#0f172a',
                          borderColor: '#334155',
                          borderRadius: '10px',
                          fontSize: '12px',
                          boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.5)'
                        }}
                        formatter={(val: any, name: any) => {
                          if (dailyMetric === 'literPerKm') return [`${val} L / KM`, 'Rata-rata Liter/KM'];
                          if (dailyMetric === 'distanceKm') return [`${val} KM`, 'Total Jarak Tempuh'];
                          return [`${val} Liter`, name];
                        }}
                        labelFormatter={(label, payload) => {
                          const item = payload && payload[0]?.payload;
                          return `Tanggal: ${label} (Total: ${item?.totalLiters || 0} Liter | ${item?.totalDistanceKm || 0} KM)`;
                        }}
                      />
                      <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />

                      {dailyMetric === 'liters' ? (
                        fleets.map((flt) => {
                          const code = flt.initialCode || flt.plateNumber;
                          const color = FLEET_COLORS[code]?.fill || '#3b82f6';
                          return (
                            <Bar
                              key={flt.id}
                              dataKey={code}
                              name={`${code} (${flt.vehicleType})`}
                              fill={color}
                              stackId={dailyChartMode === 'stacked' ? 'dailyStack' : undefined}
                              radius={dailyChartMode === 'stacked' ? undefined : [4, 4, 0, 0]}
                            />
                          );
                        })
                      ) : dailyMetric === 'literPerKm' ? (
                        <>
                          <ReferenceLine y={0.1333} stroke="#f59e0b" strokeDasharray="3 3" label={{ value: 'Target 0.1333 L/KM', fill: '#f59e0b', fontSize: 10, position: 'top' }} />
                          <Bar
                            dataKey="dailyLKm"
                            name="Rata-rata Konsumsi Harian (L/KM)"
                            fill="#10b981"
                            radius={[4, 4, 0, 0]}
                          />
                        </>
                      ) : (
                        <Bar
                          dataKey="totalDistanceKm"
                          name="Total Jarak Tempuh Seluruh Armada (KM)"
                          fill="#3b82f6"
                          radius={[4, 4, 0, 0]}
                        />
                      )}
                    </BarChart>
                  ) : (
                    // Single Fleet Bar Chart
                    <BarChart
                      data={singleFleetDailyData}
                      margin={{ top: 15, right: 15, left: -15, bottom: 5 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                      <XAxis dataKey="displayDate" stroke="#94a3b8" fontSize={11} />
                      <YAxis stroke="#94a3b8" fontSize={11} unit=" L" />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: '#0f172a',
                          borderColor: '#334155',
                          borderRadius: '10px',
                          fontSize: '12px'
                        }}
                        formatter={(val: any, name: any, item: any) => [
                          `${val} Liter (${item.payload.distance} KM • ${item.payload.lkm} L/KM)`,
                          'Konsumsi BBM'
                        ]}
                      />
                      <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                      <Bar
                        dataKey="liters"
                        name={`Konsumsi BBM Harian (Liter)`}
                        fill="#f59e0b"
                        radius={[4, 4, 0, 0]}
                      />
                    </BarChart>
                  )}
                </ResponsiveContainer>
              </div>

              {/* Chart Footer Indicator */}
              <div className="flex flex-wrap items-center justify-between text-[11px] text-slate-400 pt-2 border-t border-slate-800/80 mt-2">
                <div className="flex items-center gap-2">
                  <Info className="w-3.5 h-3.5 text-amber-400" />
                  <span>
                    Data diakumulasikan berdasarkan tanggal pengisian bahan bakar resmi SPBU tercatat di sistem logistik AKK.
                  </span>
                </div>
                <div className="font-mono text-slate-300">
                  {dailyConsumptionData.length} hari terdata
                </div>
              </div>
            </div>
          </div>

          {/* ========================================================================= */}
          {/* SECTION B: ANALISIS RATA-RATA KONSUMSI LITER PER KM TIAP UNIT KENDARAAN    */}
          {/* ========================================================================= */}
          <div className="bg-slate-900 p-5 rounded-2xl border border-slate-800 shadow-sm space-y-4">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-800 pb-4">
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <div className="p-2 rounded-xl bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                    <Gauge className="w-5 h-5" />
                  </div>
                  <h3 className="text-base font-bold text-white tracking-tight">
                    Rata-rata Konsumsi Liter per Kilometer (L/KM) Tiap Unit Kendaraan
                  </h3>
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                    Metrik Standar L/KM
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-1">
                  Perhitungan matematis volume bahan bakar yang dihabiskan untuk menempuh setiap 1 kilometer jarak tempuh (L/KM) dan 100 kilometer (L/100 KM) pada setiap armada.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setActiveTab('liter_km')}
                  className="px-3.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-emerald-400 hover:text-emerald-300 border border-slate-700 text-xs font-bold transition cursor-pointer flex items-center gap-1.5"
                >
                  <span>Buka Tabel & Kalkulator L/KM Lengkap</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* FORMULA CALLOUT BANNER */}
            <div className="bg-slate-950/60 p-3.5 rounded-xl border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-blue-500/15 text-blue-400 border border-blue-500/30 font-mono font-bold text-xs shrink-0">
                  L/KM
                </div>
                <div>
                  <span className="font-bold text-white">Rumus Konsumsi: </span>
                  <span className="font-mono text-amber-400 font-bold bg-slate-900 px-2 py-0.5 rounded border border-slate-800">
                    Liter / KM = Total Liter &divide; Total Jarak (KM)
                  </span>
                  <span className="text-slate-400 ml-2">
                    &bull; Semakin <strong className="text-emerald-400">rendah</strong> angka L/KM, armada semakin hemat!
                  </span>
                </div>
              </div>
              <div className="text-[11px] font-mono text-slate-400">
                Rata-rata Seluruh Truk: <strong className="text-amber-400">{kpiSummary.overallAvgLiterPerKm || 0} L/KM</strong> ({kpiSummary.overallAvgLiterPer100Km || 0} L/100 KM)
              </div>
            </div>

            {/* SIDE-BY-SIDE: BAR CHART L/KM VS TARGET & SUMMARY TABLE */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
              {/* L/KM Comparison Bar Chart (5 Cols) */}
              <div className="lg:col-span-5 bg-slate-950/50 p-4 rounded-xl border border-slate-800/80 flex flex-col gap-4">
                <div className="flex items-start justify-between gap-2 border-b border-slate-800/80 pb-3">
                  <div>
                    <h4 className="text-xs font-bold text-white flex items-center gap-1.5">
                      <BarChart className="w-4 h-4 text-emerald-400" />
                      <span>Komparasi Aktual L/KM vs Target Pabrikan</span>
                    </h4>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Pilih armada dari daftar untuk membandingkan konsumsi BBM seluruh unit armada.
                    </p>
                  </div>
                  <span className="px-2 py-0.5 rounded-md bg-emerald-500/10 border border-emerald-500/30 text-[10px] font-bold text-emerald-400 shrink-0">
                    {unitLKmAnalysis.filter(d => d.hasData && d.avgLKm <= d.targetLKm).length}/{unitLKmAnalysis.length} Unit Irit
                  </span>
                </div>

                {/* Summary Pill Row + Modern List Armada Selector */}
                <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-stretch">
                  <div className="sm:col-span-3 bg-slate-900/90 p-2.5 rounded-xl border border-slate-800 flex flex-col justify-center">
                    <div className="text-[10px] text-slate-400">Rata-rata Aktual</div>
                    <div className="text-sm font-black text-emerald-400 font-mono mt-0.5">
                      {comparisonSelectedFleetId === 'all'
                        ? (kpiSummary.overallAvgLiterPerKm || 0)
                        : (unitLKmAnalysis.find(u => u.fleetId === comparisonSelectedFleetId)?.avgLKm || 0)}{' '}
                      <span className="text-[10px] font-normal text-slate-400">L/KM</span>
                    </div>
                  </div>
                  <div className="sm:col-span-3 bg-slate-900/90 p-2.5 rounded-xl border border-slate-800 flex flex-col justify-center">
                    <div className="text-[10px] text-slate-400">Standar Pabrik</div>
                    <div className="text-sm font-black text-slate-300 font-mono mt-0.5">
                      {comparisonSelectedFleetId === 'all'
                        ? (fuelLogs.length > 0 ? 0.1333 : 0)
                        : (unitLKmAnalysis.find(u => u.fleetId === comparisonSelectedFleetId)?.targetLKm || 0)}{' '}
                      <span className="text-[10px] font-normal text-slate-400">L/KM</span>
                    </div>
                  </div>
                  <div className="sm:col-span-6 bg-slate-900/90 p-2 rounded-xl border border-slate-800 relative">
                    <div className="text-[10px] text-slate-400 mb-1 flex items-center justify-between">
                      <span>List Armada</span>
                      <span className="text-[9px] text-amber-400/90 font-semibold">Komparasi Unit</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setActiveModalDropdown(activeModalDropdown === 'chart_fleet' ? null : 'chart_fleet')}
                      className="w-full bg-slate-950 hover:bg-slate-900 border border-slate-700/80 hover:border-amber-500/60 rounded-lg px-2.5 py-1.5 text-xs font-bold text-amber-400 flex items-center justify-between gap-2 transition cursor-pointer"
                    >
                      <span className="truncate flex items-center gap-1.5">
                        <Truck className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                        {comparisonSelectedFleetId === 'all'
                          ? `Semua Armada (${unitLKmAnalysis.length} Unit)`
                          : (() => {
                              const found = unitLKmAnalysis.find(u => u.fleetId === comparisonSelectedFleetId);
                              return found ? `${found.initialCode || found.plateNumber} (${found.plateNumber})` : 'Semua Armada';
                            })()}
                      </span>
                      <ChevronDown className={`w-3.5 h-3.5 text-slate-400 shrink-0 transition-transform ${activeModalDropdown === 'chart_fleet' ? 'rotate-180 text-amber-400' : ''}`} />
                    </button>

                    {activeModalDropdown === 'chart_fleet' && (
                      <div className="absolute right-0 left-0 top-full mt-1.5 z-40 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl overflow-hidden max-h-64 overflow-y-auto">
                        <button
                          type="button"
                          onClick={() => {
                            setComparisonSelectedFleetId('all');
                            setActiveModalDropdown(null);
                          }}
                          className={`w-full px-3 py-2 text-left text-xs flex items-center justify-between transition cursor-pointer ${
                            comparisonSelectedFleetId === 'all'
                              ? 'bg-amber-500/15 text-amber-300 font-bold'
                              : 'text-slate-200 hover:bg-slate-800'
                          }`}
                        >
                          <span>Semua Armada ({unitLKmAnalysis.length} Unit)</span>
                          {comparisonSelectedFleetId === 'all' && <Check className="w-3.5 h-3.5 text-amber-400" />}
                        </button>
                        {unitLKmAnalysis.map(u => {
                          const isSel = comparisonSelectedFleetId === u.fleetId;
                          return (
                            <button
                              key={u.fleetId}
                              type="button"
                              onClick={() => {
                                setComparisonSelectedFleetId(u.fleetId);
                                setActiveModalDropdown(null);
                              }}
                              className={`w-full px-3 py-2 text-left text-xs flex items-center justify-between border-t border-slate-800/60 transition cursor-pointer ${
                                isSel ? 'bg-amber-500/15 text-amber-300 font-bold' : 'text-slate-200 hover:bg-slate-800'
                              }`}
                            >
                              <div className="min-w-0 pr-2">
                                <div className="font-mono font-bold truncate">
                                  {u.initialCode || u.plateNumber} <span className="text-slate-400 font-normal">({u.plateNumber})</span>
                                </div>
                                <div className="text-[10px] text-slate-400 truncate">
                                  {u.driverName} • {u.areaKirim}
                                </div>
                              </div>
                              {isSel && <Check className="w-3.5 h-3.5 text-amber-400 shrink-0" />}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>

                {/* Horizontal Comparison Bars (All 12 Units Displayed in Order N1..DS5) */}
                <div className="h-80 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={lKmComparisonChartData}
                      layout="vertical"
                      margin={{ top: 4, right: 18, left: 6, bottom: 4 }}
                      barCategoryGap="18%"
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" horizontal={true} vertical={false} />
                      <XAxis type="number" stroke="#94a3b8" fontSize={10} domain={[0, 0.22]} unit=" L" />
                      <YAxis
                        type="category"
                        dataKey="unit"
                        interval={0}
                        stroke="#94a3b8"
                        fontSize={10}
                        width={76}
                        tick={{ fontWeight: 700 }}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: '#0f172a',
                          borderColor: '#334155',
                          borderRadius: '10px',
                          fontSize: '11px'
                        }}
                        formatter={(val: any, name: any, item: any) => [
                          `${val} L/KM (${Number((val * 100).toFixed(2))} L/100KM • ${
                            name === 'aktualLKm' ? item.payload.aktualKmL : item.payload.targetKmL
                          } KM/L)`,
                          name === 'aktualLKm' ? 'Realisasi Aktual' : 'Target Pabrikan'
                        ]}
                        labelFormatter={(label, payload) => {
                          const p = payload?.[0]?.payload;
                          return p
                            ? `Armada ${label} (${p.plate} • ${p.tipe}) | Driver: ${p.driverName} | Area: ${p.areaKirim}`
                            : `Armada ${label}`;
                        }}
                      />
                      <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '6px' }} />
                      <Bar dataKey="aktualLKm" name="Realisasi L/KM" fill="#10b981" radius={[0, 4, 4, 0]} barSize={7}>
                        {lKmComparisonChartData.map((entry, idx) => (
                          <Cell
                            key={`cell-akt-${idx}`}
                            fill={entry.aktualLKm <= entry.targetLKm ? '#10b981' : '#f59e0b'}
                          />
                        ))}
                      </Bar>
                      <Bar dataKey="targetLKm" name="Target Pabrikan L/KM" fill="#64748b" radius={[0, 4, 4, 0]} barSize={7} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                {/* Legend Status Guide */}
                <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-800/80 text-[10px] text-slate-400">
                  <div className="flex items-center gap-3">
                    <span className="flex items-center gap-1">
                      <span className="w-2.5 h-2.5 rounded-xs bg-emerald-500 inline-block" />
                      <span>Hemat (&le; Target)</span>
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="w-2.5 h-2.5 rounded-xs bg-amber-500 inline-block" />
                      <span>Melebihi Target</span>
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="w-2.5 h-2.5 rounded-xs bg-slate-500 inline-block" />
                      <span>Batas Target</span>
                    </span>
                  </div>
                  <span className="font-mono">Satuan: L/KM</span>
                </div>
              </div>

              {/* L/KM Summary Table (7 Cols) */}
              <div className="lg:col-span-7 bg-slate-950/50 rounded-xl border border-slate-800/80 overflow-hidden flex flex-col justify-between">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-900/90 text-slate-400 text-[11px] uppercase border-b border-slate-800">
                      <tr>
                        <th className="py-2.5 px-3">Unit Armada</th>
                        <th className="py-2.5 px-3">Nama Driver</th>
                        <th className="py-2.5 px-3">Area Kirim</th>
                        <th className="py-2.5 px-3">Tipe Truk</th>
                        <th className="py-2.5 px-3 text-right">Jarak (KM)</th>
                        <th className="py-2.5 px-3 text-right font-bold text-amber-300">Rata-rata L/KM</th>
                        <th className="py-2.5 px-3 text-right">L / 100 KM</th>
                        <th className="py-2.5 px-3 text-center">Deviasi vs Target</th>
                        <th className="py-2.5 px-3 text-center">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 font-mono">
                      {unitLKmAnalysis.map((item) => (
                        <tr
                          key={item.fleetId}
                          onClick={() => setComparisonSelectedFleetId(prev => prev === item.fleetId ? 'all' : item.fleetId)}
                          className={`hover:bg-slate-900/40 transition cursor-pointer ${
                            comparisonSelectedFleetId === item.fleetId ? 'bg-amber-500/10' : ''
                          }`}
                        >
                          <td className="py-2 px-3">
                            <div className="font-bold text-white font-sans">{item.initialCode || '-'}</div>
                            <div className="text-[10px] text-slate-400">{item.plateNumber}</div>
                          </td>
                          <td className="py-2 px-3 font-sans text-slate-200 text-[11px]">
                            {item.driverName}
                          </td>
                          <td className="py-2 px-3 font-sans text-slate-300 text-[11px]">
                            {item.areaKirim}
                          </td>
                          <td className="py-2 px-3 font-sans text-slate-300 text-[11px]">
                            {item.vehicleType}
                          </td>
                          <td className="py-2 px-3 text-right text-slate-300">
                            {item.totalDistanceKm.toLocaleString('id-ID')}
                          </td>
                          <td className="py-2 px-3 text-right font-bold text-amber-400">
                            {item.avgLKm} <span className="text-[10px] font-normal text-slate-400">L/KM</span>
                          </td>
                          <td className="py-2 px-3 text-right text-slate-300">
                            {item.avgL100Km} <span className="text-[10px] text-slate-500">L</span>
                          </td>
                          <td className="py-2 px-3 text-center font-sans">
                            {!item.hasData ? (
                              <span className="text-slate-500 text-[11px] font-semibold">0%</span>
                            ) : item.isSaving ? (
                              <span className="text-emerald-400 text-[11px] font-bold flex items-center justify-center gap-0.5">
                                <ArrowDown className="w-3 h-3 text-emerald-400" />
                                +{item.savingPct}% Irit
                              </span>
                            ) : (
                              <span className="text-rose-400 text-[11px] font-bold flex items-center justify-center gap-0.5">
                                <ArrowUp className="w-3 h-3 text-rose-400" />
                                {item.savingPct}% Boros
                              </span>
                            )}
                          </td>
                          <td className="py-2 px-3 text-center font-sans">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${item.statusColor}`}>
                              {item.hasData ? item.status.split(' ')[0] : '-'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="p-2.5 bg-slate-900/70 border-t border-slate-800 text-[11px] text-slate-400 flex items-center justify-between">
                  <span>Total terhitung: {unitLKmAnalysis.length} unit kendaraan operasional PT AKK</span>
                  <button
                    onClick={() => setActiveTab('liter_km')}
                    className="text-amber-400 hover:underline font-semibold cursor-pointer"
                  >
                    Buka Rincian Lengkap &rarr;
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* TIMELINE AREA CHART */}
          <div className="bg-slate-900/80 p-5 rounded-2xl border border-slate-800">
            <h3 className="text-sm font-bold text-white flex items-center gap-2 mb-1">
              <TrendingUp className="w-4 h-4 text-blue-400" />
              <span>Tren Pengisian BBM & Jarak Tempuh Harian</span>
            </h3>
            <p className="text-xs text-slate-400 mb-4">Volume liter yang diisikan dan akumulasi jarak tempuh kendaraan.</p>

            <div className="h-56 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={timelineChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorLiters" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="colorDistance" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                  <XAxis dataKey="date" stroke="#94a3b8" fontSize={11} />
                  <YAxis stroke="#94a3b8" fontSize={11} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px', fontSize: '12px' }}
                  />
                  <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                  <Area type="monotone" dataKey="liters" name="Volume BBM (Liter)" stroke="#f59e0b" fillOpacity={1} fill="url(#colorLiters)" />
                  <Area type="monotone" dataKey="distance" name="Jarak Tempuh (KM)" stroke="#3b82f6" fillOpacity={1} fill="url(#colorDistance)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 4. TAB: GRAFIK KONSUMSI BBM HARIAN PER ARMADA                             */}
      {/* ========================================================================= */}
      {activeTab === 'daily' && (
        <div className="space-y-6">
          <div className="bg-slate-900/80 p-5 rounded-2xl border border-slate-800 shadow-xl space-y-4">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-800 pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-xl bg-amber-500/20 text-amber-400">
                    <BarChart className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-white tracking-tight">
                      Visualisasi Grafik Batang Konsumsi BBM Harian per Armada
                    </h2>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Analisis fluktuasi harian konsumsi bahan bakar setiap unit kendaraan operasional ekspedisi karton box PT Anugrah Kemasan Kreatif.
                    </p>
                  </div>
                </div>
              </div>

              {/* FILTER CONTROLS */}
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center gap-1.5 bg-slate-950 px-3 py-1.5 rounded-xl border border-slate-800 text-xs">
                  <span className="text-slate-400 font-medium">Armada:</span>
                  <select
                    value={dailyFleetFilter}
                    onChange={(e) => setDailyFleetFilter(e.target.value)}
                    className="bg-transparent text-slate-200 text-xs focus:outline-none cursor-pointer font-semibold"
                  >
                    <option value="all" className="bg-slate-900">Semua Armada (Berdampingan)</option>
                    {fleets.map(f => (
                      <option key={f.id} value={f.id} className="bg-slate-900">
                        {f.initialCode || f.plateNumber} ({f.plateNumber} - {f.vehicleType})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center gap-1.5 bg-slate-950 px-3 py-1.5 rounded-xl border border-slate-800 text-xs">
                  <Calendar className="w-3.5 h-3.5 text-slate-400" />
                  <select
                    value={dailyRangeDays}
                    onChange={(e) => setDailyRangeDays(Number(e.target.value))}
                    className="bg-transparent text-slate-200 text-xs focus:outline-none cursor-pointer font-semibold"
                  >
                    <option value={7} className="bg-slate-900">7 Hari Terakhir</option>
                    <option value={14} className="bg-slate-900">14 Hari Terakhir</option>
                    <option value={30} className="bg-slate-900">30 Hari Terakhir</option>
                    <option value={0} className="bg-slate-900">Semua Tanggal Operasional</option>
                  </select>
                </div>

                {dailyFleetFilter === 'all' && (
                  <>
                    <div className="flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs">
                      <button
                        onClick={() => setDailyMetric('liters')}
                        className={`px-3 py-1 rounded-lg font-medium transition cursor-pointer text-xs ${
                          dailyMetric === 'liters' ? 'bg-amber-500 text-slate-950 font-bold' : 'text-slate-400 hover:text-white'
                        }`}
                      >
                        Liter BBM
                      </button>
                      <button
                        onClick={() => setDailyMetric('literPerKm')}
                        className={`px-3 py-1 rounded-lg font-medium transition cursor-pointer text-xs ${
                          dailyMetric === 'literPerKm' ? 'bg-amber-500 text-slate-950 font-bold' : 'text-slate-400 hover:text-white'
                        }`}
                      >
                        Liter / KM
                      </button>
                      <button
                        onClick={() => setDailyMetric('distanceKm')}
                        className={`px-3 py-1 rounded-lg font-medium transition cursor-pointer text-xs ${
                          dailyMetric === 'distanceKm' ? 'bg-amber-500 text-slate-950 font-bold' : 'text-slate-400 hover:text-white'
                        }`}
                      >
                        Jarak (KM)
                      </button>
                    </div>

                    {dailyMetric === 'liters' && (
                      <div className="flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs">
                        <button
                          onClick={() => setDailyChartMode('grouped')}
                          className={`px-2.5 py-1 rounded-lg font-medium transition cursor-pointer text-xs ${
                            dailyChartMode === 'grouped' ? 'bg-slate-700 text-white font-bold' : 'text-slate-400 hover:text-white'
                          }`}
                        >
                          Berdampingan
                        </button>
                        <button
                          onClick={() => setDailyChartMode('stacked')}
                          className={`px-2.5 py-1 rounded-lg font-medium transition cursor-pointer text-xs ${
                            dailyChartMode === 'stacked' ? 'bg-slate-700 text-white font-bold' : 'text-slate-400 hover:text-white'
                          }`}
                        >
                          Bertumpuk
                        </button>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>

            {/* SUMMARY STATS BAR */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              <div className="bg-slate-950/60 p-3.5 rounded-xl border border-slate-800">
                <span className="text-[11px] text-slate-400 font-medium">Total Konsumsi BBM</span>
                <div className="text-xl font-black text-amber-400 font-mono mt-1">
                  {dailyChartStats.totalLiters.toLocaleString('id-ID')} <span className="text-xs font-normal text-slate-400">Liter</span>
                </div>
                <div className="text-[10px] text-slate-400 mt-1">{dailyChartStats.activeDays} Hari Terdata</div>
              </div>

              <div className="bg-slate-950/60 p-3.5 rounded-xl border border-slate-800">
                <span className="text-[11px] text-slate-400 font-medium">Rata-rata Konsumsi Harian</span>
                <div className="text-xl font-black text-blue-400 font-mono mt-1">
                  {dailyChartStats.avgLitersPerDay} <span className="text-xs font-normal text-slate-400">L / Hari</span>
                </div>
                <div className="text-[10px] text-emerald-400 mt-1">Standar AKK: &le; 180 L/Hari</div>
              </div>

              <div className="bg-slate-950/60 p-3.5 rounded-xl border border-slate-800">
                <span className="text-[11px] text-slate-400 font-medium">Rata-rata Periode (L/KM)</span>
                <div className="text-xl font-black text-emerald-400 font-mono mt-1">
                  {dailyChartStats.avgLKmPeriod} <span className="text-xs font-normal text-slate-400">L / KM</span>
                </div>
                <div className="text-[10px] text-slate-400 mt-1">{Number((dailyChartStats.avgLKmPeriod * 100).toFixed(2))} L/100 KM</div>
              </div>

              <div className="bg-slate-950/60 p-3.5 rounded-xl border border-slate-800">
                <span className="text-[11px] text-slate-400 font-medium">Hari Konsumsi Puncak</span>
                <div className="text-xl font-black text-rose-400 font-mono mt-1">
                  {dailyChartStats.peakDay.liters} <span className="text-xs font-normal text-slate-400">Liter</span>
                </div>
                <div className="text-[10px] text-slate-400 mt-1">Tanggal: {dailyChartStats.peakDay.date}</div>
              </div>

              <div className="bg-slate-950/60 p-3.5 rounded-xl border border-slate-800">
                <span className="text-[11px] text-slate-400 font-medium">Unit Konsumsi Terbesar</span>
                <div className="text-xl font-black text-white font-mono mt-1">
                  {dailyChartStats.topFleet.code}
                </div>
                <div className="text-[10px] text-slate-400 mt-1">{dailyChartStats.topFleet.liters} Liter di periode</div>
              </div>
            </div>

            {/* MAIN DAILY BAR CHART */}
            <div className="bg-slate-950/50 p-4 rounded-xl border border-slate-800/80">
              <div className="h-80 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  {dailyFleetFilter === 'all' ? (
                    <BarChart
                      data={dailyConsumptionData}
                      margin={{ top: 20, right: 20, left: -10, bottom: 5 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                      <XAxis dataKey="displayDate" stroke="#94a3b8" fontSize={11} />
                      <YAxis
                        stroke="#94a3b8"
                        fontSize={11}
                        unit={dailyMetric === 'liters' ? ' L' : dailyMetric === 'literPerKm' ? '' : ' KM'}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: '#0f172a',
                          borderColor: '#334155',
                          borderRadius: '10px',
                          fontSize: '12px',
                          boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.5)'
                        }}
                        formatter={(val: any, name: any) => {
                          if (dailyMetric === 'literPerKm') return [`${val} L / KM`, 'Rata-rata Konsumsi'];
                          if (dailyMetric === 'distanceKm') return [`${val} KM`, 'Total Jarak Tempuh'];
                          return [`${val} Liter`, name];
                        }}
                        labelFormatter={(label, payload) => {
                          const item = payload && payload[0]?.payload;
                          return `Tanggal: ${label} (Total: ${item?.totalLiters || 0} Liter | ${item?.totalDistanceKm || 0} KM)`;
                        }}
                      />
                      <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />

                      {dailyMetric === 'liters' ? (
                        fleets.map((flt) => {
                          const code = flt.initialCode || flt.plateNumber;
                          const color = FLEET_COLORS[code]?.fill || '#3b82f6';
                          return (
                            <Bar
                              key={flt.id}
                              dataKey={code}
                              name={`${code} (${flt.vehicleType})`}
                              fill={color}
                              stackId={dailyChartMode === 'stacked' ? 'dailyStack' : undefined}
                              radius={dailyChartMode === 'stacked' ? undefined : [4, 4, 0, 0]}
                            />
                          );
                        })
                      ) : dailyMetric === 'literPerKm' ? (
                        <>
                          <ReferenceLine y={0.1333} stroke="#f59e0b" strokeDasharray="3 3" label={{ value: 'Target 0.1333 L/KM', fill: '#f59e0b', fontSize: 10, position: 'top' }} />
                          <Bar
                            dataKey="dailyLKm"
                            name="Rata-rata Konsumsi Harian (L/KM)"
                            fill="#10b981"
                            radius={[4, 4, 0, 0]}
                          />
                        </>
                      ) : (
                        <Bar
                          dataKey="totalDistanceKm"
                          name="Total Jarak Tempuh Seluruh Armada (KM)"
                          fill="#3b82f6"
                          radius={[4, 4, 0, 0]}
                        />
                      )}
                    </BarChart>
                  ) : (
                    <BarChart
                      data={singleFleetDailyData}
                      margin={{ top: 20, right: 20, left: -10, bottom: 5 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                      <XAxis dataKey="displayDate" stroke="#94a3b8" fontSize={11} />
                      <YAxis stroke="#94a3b8" fontSize={11} unit=" L" />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: '#0f172a',
                          borderColor: '#334155',
                          borderRadius: '10px',
                          fontSize: '12px'
                        }}
                        formatter={(val: any, name: any, item: any) => [
                          `${val} Liter (${item.payload.distance} KM • ${item.payload.lkm} L/KM)`,
                          'Konsumsi BBM'
                        ]}
                      />
                      <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                      <Bar
                        dataKey="liters"
                        name={`Konsumsi BBM Harian (Liter)`}
                        fill="#f59e0b"
                        radius={[4, 4, 0, 0]}
                      />
                    </BarChart>
                  )}
                </ResponsiveContainer>
              </div>
            </div>

            {/* TABULAR BREAKDOWN PER DAY */}
            <div className="bg-slate-950/60 rounded-xl border border-slate-800/80 overflow-hidden">
              <div className="p-3 bg-slate-900/80 border-b border-slate-800 flex items-center justify-between">
                <h4 className="text-xs font-bold text-white flex items-center gap-2">
                  <FileText className="w-4 h-4 text-amber-400" />
                  <span>Rincian Pengisian BBM Harian Periode Terpilih</span>
                </h4>
                <span className="text-[11px] text-slate-400">
                  Menampilkan {dailyConsumptionData.length} hari operasional
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-900/60 text-slate-400 text-[11px] uppercase border-b border-slate-800">
                    <tr>
                      <th className="py-2.5 px-3">Tanggal</th>
                      <th className="py-2.5 px-3">Armada yang Beroperasi</th>
                      <th className="py-2.5 px-3 text-right">Total Liter</th>
                      <th className="py-2.5 px-3 text-right">Total Jarak (KM)</th>
                      <th className="py-2.5 px-3 text-right font-bold text-amber-300">Rasio Harian L/KM</th>
                      <th className="py-2.5 px-3 text-right">KM / Liter</th>
                      <th className="py-2.5 px-3 text-center">Status Rata-rata</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 font-mono">
                    {dailyConsumptionData.map((d) => (
                      <tr key={d.date} className="hover:bg-slate-900/40 transition">
                        <td className="py-2.5 px-3 text-white font-bold font-sans">
                          {d.date} <span className="text-[10px] text-slate-400 font-normal">({d.displayDate})</span>
                        </td>
                        <td className="py-2.5 px-3 font-sans">
                          <div className="flex flex-wrap gap-1.5">
                            {d.details.map((det, i) => (
                              <span
                                key={i}
                                className="px-2 py-0.5 rounded text-[10px] font-bold border border-slate-800 bg-slate-900 text-slate-200"
                                title={`${det.driverName} - ${det.routeTrip} (${det.liters} L / ${det.distanceKm} KM = ${det.lKm} L/KM)`}
                              >
                                {det.fleetCode}: <span className="text-amber-400">{det.liters}L</span>
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="py-2.5 px-3 text-right font-bold text-amber-400">
                          {d.totalLiters} <span className="text-[10px] font-normal text-slate-400">L</span>
                        </td>
                        <td className="py-2.5 px-3 text-right text-slate-300">
                          {d.totalDistanceKm.toLocaleString('id-ID')} KM
                        </td>
                        <td className="py-2.5 px-3 text-right font-bold text-emerald-400">
                          {d.dailyLKm} <span className="text-[10px] font-normal text-slate-400">L/KM</span>
                        </td>
                        <td className="py-2.5 px-3 text-right text-blue-400">
                          {d.dailyKmL} <span className="text-[10px] font-normal text-slate-400">KM/L</span>
                        </td>
                        <td className="py-2.5 px-3 text-center font-sans">
                          {d.dailyLKm <= 0.1333 ? (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                              Efisien
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30">
                              Perlu Review
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
        </div>
      )}

      {/* ========================================================================= */}
      {/* 5. TAB: RATA-RATA LITER PER KILOMETER (L/KM) TIAP UNIT KENDARAAN          */}
      {/* ========================================================================= */}
      {activeTab === 'liter_km' && (
        <div className="space-y-6">
          <div className="bg-slate-900/80 p-5 rounded-2xl border border-slate-800 shadow-xl space-y-5">
            {/* HEADER */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-800 pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-xl bg-emerald-500/20 text-emerald-400">
                    <Gauge className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-white tracking-tight">
                      Perhitungan Rata-rata Konsumsi Liter per Kilometer (L/KM) Tiap Unit Kendaraan
                    </h2>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Standar metrik konsumsi bahan bakar logistik per 1 KM dan per 100 KM untuk seluruh unit armada PT Anugrah Kemasan Kreatif.
                    </p>
                  </div>
                </div>
              </div>

              {/* SEARCH & SORT CONTROLS */}
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Cari unit truk / plat nomor..."
                    value={lKmSearch}
                    onChange={(e) => setLKmSearch(e.target.value)}
                    className="bg-slate-950 border border-slate-800 rounded-xl pl-8 pr-3 py-1.5 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div className="flex items-center gap-1.5 bg-slate-950 px-3 py-1.5 rounded-xl border border-slate-800 text-xs">
                  <ArrowUpDown className="w-3.5 h-3.5 text-slate-400" />
                  <select
                    value={lKmSortBy}
                    onChange={(e) => setLKmSortBy(e.target.value as any)}
                    className="bg-transparent text-slate-200 text-xs focus:outline-none cursor-pointer font-semibold"
                  >
                    <option value="canonical_order" className="bg-slate-900">Urutan Standar (N1 - DS5)</option>
                    <option value="lKm_asc" className="bg-slate-900">L/KM Terendah (Paling Irit)</option>
                    <option value="lKm_desc" className="bg-slate-900">L/KM Tertinggi (Paling Boros)</option>
                    <option value="efficiency_desc" className="bg-slate-900">Skor Efisiensi Tertinggi</option>
                    <option value="distance_desc" className="bg-slate-900">Jarak Operasional Terjauh</option>
                  </select>
                </div>
              </div>
            </div>

            {/* BENCHMARK EXPLANATION CARDS */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="bg-slate-950/70 p-3.5 rounded-xl border border-slate-800/80">
                <div className="flex items-center gap-2 text-emerald-400 mb-1">
                  <CheckCircle2 className="w-4 h-4" />
                  <span className="text-xs font-bold text-white">Interpretasi Angka L/KM</span>
                </div>
                <p className="text-[11px] text-slate-300 leading-relaxed">
                  Semakin <strong>rendah</strong> nilai Liter/KM, kendaraan semakin hemat. Misalnya <strong>0.1250 L/KM</strong> berarti 1 liter solar dapat menempuh 8 kilometer (8 KM/L).
                </p>
              </div>

              <div className="bg-slate-950/70 p-3.5 rounded-xl border border-slate-800/80">
                <div className="flex items-center gap-2 text-blue-400 mb-1">
                  <Calculator className="w-4 h-4" />
                  <span className="text-xs font-bold text-white">Standar Industri (L / 100 KM)</span>
                </div>
                <p className="text-[11px] text-slate-300 leading-relaxed">
                  Dihitung dari <code className="text-amber-300 font-mono">Liter/KM &times; 100</code>. Nilai standar truk engkel AKK muatan karton box berada di kisaran <strong>12.0 &ndash; 14.5 L/100 KM</strong>.
                </p>
              </div>

              <div className="bg-slate-950/70 p-3.5 rounded-xl border border-slate-800/80">
                <div className="flex items-center gap-2 text-amber-400 mb-1">
                  <Award className="w-4 h-4" />
                  <span className="text-xs font-bold text-white">Standar Pabrikan per Tipe</span>
                </div>
                <p className="text-[11px] text-slate-300 leading-relaxed">
                  Engkel Long: <strong>0.1333 L/KM</strong> (7.5 KM/L) &bull; Double STD: <strong>0.1538 L/KM</strong> (6.5 KM/L) &bull; Pick Up: <strong>0.1053 L/KM</strong> (9.5 KM/L).
                </p>
              </div>
            </div>

            {/* COMPARISON BAR CHART: ACTUAL L/KM VS TARGET */}
            <div className="bg-slate-950/50 p-4 rounded-xl border border-slate-800/80 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-bold text-white flex items-center gap-2">
                    <BarChart className="w-4 h-4 text-emerald-400" />
                    <span>Grafik Batang Komparasi Rata-rata Konsumsi Liter/KM vs Target Standar Pabrik</span>
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Nilai bar menunjukkan rata-rata konsumsi liter per kilometer (L/KM) aktual setiap unit kendaraan.
                  </p>
                </div>
                <div className="text-[11px] font-mono text-slate-400">
                  Satuan: <strong className="text-emerald-400">Liter / KM</strong>
                </div>
              </div>

              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={lKmComparisonChartData}
                    margin={{ top: 15, right: 15, left: -20, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                    <XAxis dataKey="unit" stroke="#94a3b8" fontSize={11} />
                    <YAxis stroke="#94a3b8" fontSize={11} domain={[0, 0.22]} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#0f172a',
                        borderColor: '#334155',
                        borderRadius: '10px',
                        fontSize: '12px'
                      }}
                      formatter={(val: any, name: any, item: any) => [
                        `${val} L / KM (${item.payload.aktualL100Km} L/100 KM • ${item.payload.aktualKmL} KM/L)`,
                        name === 'aktualLKm' ? 'Realisasi Aktual' : 'Target Standar'
                      ]}
                    />
                    <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} />
                    <Bar dataKey="aktualLKm" name="Realisasi L/KM Armada" fill="#10b981" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="targetLKm" name="Target Standar Pabrikan L/KM" fill="#64748b" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* FULL DETAIL TABLE FOR EACH FLEET UNIT */}
            <div className="bg-slate-950/60 rounded-xl border border-slate-800/80 overflow-hidden">
              <div className="p-3 bg-slate-900/80 border-b border-slate-800 flex items-center justify-between">
                <h3 className="text-xs font-bold text-white flex items-center gap-2">
                  <Truck className="w-4 h-4 text-amber-400" />
                  <span>Tabel Lengkap Perhitungan Konsumsi Liter per Kilometer Tiap Unit Kendaraan</span>
                </h3>
                <span className="text-[11px] text-slate-400">
                  Total terdata: {unitLKmAnalysis.length} unit armada
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-900 text-slate-400 text-[11px] uppercase border-b border-slate-800">
                    <tr>
                      <th className="py-3 px-3.5">Unit Armada</th>
                      <th className="py-3 px-3.5">Nama Driver</th>
                      <th className="py-3 px-3.5">Area Kirim</th>
                      <th className="py-3 px-3.5">Tipe Kendaraan</th>
                      <th className="py-3 px-3 text-right">Jarak (KM)</th>
                      <th className="py-3 px-3 text-right">BBM (Liter)</th>
                      <th className="py-3 px-3.5 text-right font-black text-amber-400 bg-amber-500/5">
                        Rata-rata L/KM
                      </th>
                      <th className="py-3 px-3 text-right font-bold text-slate-300">
                        L / 100 KM
                      </th>
                      <th className="py-3 px-3 text-right text-slate-400">
                        Target Pabrikan
                      </th>
                      <th className="py-3 px-3.5 text-center">
                        Deviasi / Penghematan
                      </th>
                      <th className="py-3 px-3 text-right text-slate-400">
                        Biaya / KM
                      </th>
                      <th className="py-3 px-3.5 text-center">
                        Status Efisiensi
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 font-mono">
                    {unitLKmAnalysis.map((item) => (
                      <tr key={item.fleetId} className="hover:bg-slate-900/50 transition">
                        <td className="py-3 px-3.5">
                          <div className="font-bold text-white font-sans text-sm flex items-center gap-1.5">
                            <span>{item.initialCode || item.plateNumber}</span>
                            <span className="text-[10px] text-slate-400 font-normal">({item.plateNumber})</span>
                          </div>
                          <div className="text-[10px] text-slate-500 font-sans">{item.totalLogs} catatan pengisian</div>
                        </td>

                        <td className="py-3 px-3.5 font-sans text-slate-200 text-xs">
                          {item.driverName}
                        </td>

                        <td className="py-3 px-3.5 font-sans text-slate-300 text-xs">
                          {item.areaKirim}
                        </td>

                        <td className="py-3 px-3.5 font-sans text-slate-300">
                          <span className="px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-[11px]">
                            {item.vehicleType}
                          </span>
                        </td>

                        <td className="py-3 px-3 text-right text-slate-300">
                          {item.totalDistanceKm.toLocaleString('id-ID')} KM
                        </td>

                        <td className="py-3 px-3 text-right text-slate-300">
                          {item.totalLiters.toLocaleString('id-ID')} L
                        </td>

                        {/* RATA-RATA L/KM (PRIMARY REQUESTED METRIC) */}
                        <td className="py-3 px-3.5 text-right font-black text-amber-400 bg-amber-500/5 text-sm">
                          {item.avgLKm}{' '}
                          <span className="text-[10px] font-normal text-slate-400">L/KM</span>
                        </td>

                        <td className="py-3 px-3 text-right font-bold text-slate-200">
                          {item.avgL100Km}{' '}
                          <span className="text-[10px] font-normal text-slate-500">L</span>
                        </td>

                        <td className="py-3 px-3 text-right text-slate-400">
                          <div>{item.targetLKm} L/KM</div>
                          <div className="text-[10px] text-slate-500 font-sans">({item.hasData ? item.targetRatio : 0} KM/L)</div>
                        </td>

                        <td className="py-3 px-3.5 text-center font-sans">
                          {!item.hasData ? (
                            <span className="text-slate-500 text-xs font-semibold">0%</span>
                          ) : item.isSaving ? (
                            <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 text-xs font-bold">
                              <ArrowDown className="w-3 h-3" />
                              <span>+{item.savingPct}% Lebih Irit</span>
                            </div>
                          ) : (
                            <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-rose-500/15 text-rose-400 border border-rose-500/30 text-xs font-bold">
                              <ArrowUp className="w-3 h-3" />
                              <span>{item.savingPct}% Lebih Boros</span>
                            </div>
                          )}
                        </td>

                        <td className="py-3 px-3 text-right font-sans text-slate-300 text-xs">
                          Rp {item.avgCostPerKm.toLocaleString('id-ID')}
                        </td>

                        <td className="py-3 px-3.5 text-center font-sans">
                          <span className={`px-2.5 py-1 rounded-full text-xs font-bold border ${item.statusColor}`}>
                            {item.hasData ? item.status : '-'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* QUICK TWO-WAY CONVERTER CALCULATOR */}
            <div className="bg-slate-950/70 p-4 rounded-xl border border-slate-800 space-y-3">
              <div className="flex items-center gap-2 text-amber-400">
                <Calculator className="w-4 h-4" />
                <h4 className="text-xs font-bold text-white">Kalkulator Konversi Cepat KM/L &harr; Liter/KM</h4>
              </div>
              <p className="text-xs text-slate-400">
                Uji coba perbandingan angka kilometer per liter dengan konsumsi liter per kilometer:
              </p>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                <div className="space-y-1">
                  <label className="text-slate-400 font-medium">Input KM per Liter (KM/L):</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      step="0.1"
                      value={simKmL}
                      onChange={(e) => {
                        const val = Number(e.target.value);
                        setSimKmL(val);
                        if (val > 0) setSimLKm(Number((1 / val).toFixed(4)));
                      }}
                      className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-white font-mono font-bold focus:outline-none focus:border-amber-500"
                    />
                    <span className="text-slate-400 font-bold shrink-0">KM/L</span>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-slate-400 font-medium">Hasil Konversi Liter/KM:</label>
                  <div className="p-1.5 rounded-lg bg-slate-900 border border-slate-800 font-mono font-bold text-amber-400 text-sm flex items-center justify-between">
                    <span>{simKmL > 0 ? (1 / simKmL).toFixed(4) : '0'}</span>
                    <span className="text-xs text-slate-400">L / KM</span>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-slate-400 font-medium">Hasil Standar Liter/100 KM:</label>
                  <div className="p-1.5 rounded-lg bg-slate-900 border border-slate-800 font-mono font-bold text-emerald-400 text-sm flex items-center justify-between">
                    <span>{simKmL > 0 ? ((1 / simKmL) * 100).toFixed(2) : '0'}</span>
                    <span className="text-xs text-slate-400">L / 100 KM</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 6. TAB 2: DRIVER ECO-LEADERBOARD                                          */}
      {/* ========================================================================= */}
      {activeTab === 'leaderboard' && (
        <div className="space-y-6">
          <div className="bg-slate-900/80 p-5 rounded-2xl border border-slate-800">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Award className="w-5 h-5 text-amber-400" />
                  <span>Papan Peringkat Eco-Driver PT Anugrah Kemasan Kreatif</span>
                </h3>
                <p className="text-xs text-slate-400">
                  Evaluasi gaya mengemudi, konsistensi akselerasi halus, dan efisiensi BBM armada yang dikemudikan para driver.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {driverScores.map((ds) => {
                const isTop1 = ds.ranking === 1;
                const isTop2 = ds.ranking === 2;
                const isTop3 = ds.ranking === 3;

                return (
                  <div
                    key={ds.driverName}
                    className={`p-4 rounded-2xl border relative flex flex-col justify-between transition ${
                      isTop1
                        ? 'bg-amber-500/10 border-amber-500/40 shadow-lg'
                        : isTop2
                        ? 'bg-slate-900 border-slate-700'
                        : isTop3
                        ? 'bg-slate-900 border-slate-800'
                        : 'bg-slate-950/60 border-slate-800/80'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2.5">
                          <div
                            className={`w-9 h-9 rounded-full flex items-center justify-center font-black text-sm ${
                              isTop1
                                ? 'bg-amber-400 text-slate-950 shadow-md'
                                : isTop2
                                ? 'bg-slate-300 text-slate-900'
                                : isTop3
                                ? 'bg-amber-700 text-amber-100'
                                : 'bg-slate-800 text-slate-300'
                            }`}
                          >
                            #{ds.ranking}
                          </div>
                          <div>
                            <h4 className="font-bold text-white text-sm flex items-center gap-1.5">
                              <span>{ds.driverName}</span>
                            </h4>
                            <span className="text-[11px] text-slate-400">{ds.totalTrips} Perjalanan BBM</span>
                          </div>
                        </div>

                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                            ds.badge === 'Master Eco-Driver'
                              ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                              : ds.badge === 'Driver Efisien'
                              ? 'bg-blue-500/15 text-blue-400 border-blue-500/30'
                              : 'bg-amber-500/15 text-amber-400 border-amber-500/30'
                          }`}
                        >
                          {ds.badge}
                        </span>
                      </div>

                      {/* STATS MATRIX */}
                      <div className="grid grid-cols-2 gap-2 bg-slate-950/60 p-2.5 rounded-xl border border-slate-800 text-xs my-3">
                        <div>
                          <div className="text-[10px] text-slate-400">Rata-rata Rasio</div>
                          <div className="text-base font-black text-white font-mono">{ds.avgKmPerLiter} KM/L</div>
                        </div>
                        <div>
                          <div className="text-[10px] text-slate-400">Skor Eco-Driving</div>
                          <div className="text-base font-black text-amber-400 font-mono">{ds.ecoDrivingScore} / 100</div>
                        </div>
                        <div>
                          <div className="text-[10px] text-slate-400">Total Jarak</div>
                          <div className="font-bold text-slate-300">{ds.totalDistanceKm.toLocaleString('id-ID')} KM</div>
                        </div>
                        <div>
                          <div className="text-[10px] text-slate-400">Total Solar/BBM</div>
                          <div className="font-bold text-slate-300">{ds.totalLiters.toLocaleString('id-ID')} Liter</div>
                        </div>
                      </div>

                      <p className="text-[11px] text-slate-300 italic bg-slate-900/70 p-2 rounded-lg border border-slate-800/80">
                        &ldquo;{ds.recommendation}&rdquo;
                      </p>
                    </div>

                    <div className="mt-3 pt-2 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400">
                      <span>Status Insentif:</span>
                      <span className={`font-semibold ${ds.ecoDrivingScore >= 85 ? 'text-emerald-400' : 'text-slate-400'}`}>
                        {ds.ecoDrivingScore >= 85 ? 'Memenuhi Syarat Bonus Eco' : 'Sesuai Standar Pokok'}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 5. TAB 3: AUDIT LOGS & TABLE                                              */}
      {/* ========================================================================= */}
      {activeTab === 'logs' && (
        <div className="space-y-4">
          {/* FILTER AND SEARCH CONTROLS */}
          <div className="bg-slate-900/80 p-4 rounded-2xl border border-slate-800 flex flex-col md:flex-row items-center justify-between gap-3">
            <div className="relative w-full md:w-80">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Cari plat, inisial, driver, SPBU, rute..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
              <select
                value={filterFleetId}
                onChange={(e) => setFilterFleetId(e.target.value)}
                className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-amber-500"
              >
                <option value="all">Semua Armada</option>
                {fleets.map(f => (
                  <option key={f.id} value={f.id}>{f.initialCode || f.plateNumber} ({f.plateNumber})</option>
                ))}
              </select>

              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-amber-500"
              >
                <option value="all">Semua Status Efisiensi</option>
                <option value="Sangat Efisien">Sangat Efisien</option>
                <option value="Efisien / Normal">Efisien / Normal</option>
                <option value="Boros">Boros</option>
                <option value="Kritis / Potensi Anomali">Kritis / Potensi Anomali</option>
              </select>

              <select
                value={filterFuelType}
                onChange={(e) => setFilterFuelType(e.target.value)}
                className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-amber-500"
              >
                <option value="all">Semua Jenis BBM</option>
                <option value="BioSolar">BioSolar</option>
                <option value="Dexlite">Dexlite</option>
                <option value="Pertamina Dex">Pertamina Dex</option>
                <option value="Pertalite">Pertalite</option>
              </select>

              {(searchQuery || filterFleetId !== 'all' || filterStatus !== 'all' || filterFuelType !== 'all') && (
                <button
                  onClick={() => {
                    setSearchQuery('');
                    setFilterFleetId('all');
                    setFilterStatus('all');
                    setFilterFuelType('all');
                  }}
                  className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold cursor-pointer"
                  title="Reset Filter"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* FUEL LOGS TABLE */}
          <div className="bg-slate-900/80 rounded-2xl border border-slate-800 overflow-hidden shadow-lg">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-950/80 text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-800">
                  <tr>
                    <th className="px-4 py-3">Tanggal & Armada</th>
                    <th className="px-4 py-3">Driver & Rute</th>
                    <th className="px-4 py-3">BBM & Biaya</th>
                    <th className="px-4 py-3">KM Awal / Akhir</th>
                    <th className="px-4 py-3 text-center">Jarak</th>
                    <th className="px-4 py-3 text-center">Rasio (KM/L)</th>
                    <th className="px-4 py-3 text-center">Status Efisiensi</th>
                    <th className="px-4 py-3 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {filteredLogs.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-4 py-8 text-center text-slate-400">
                        Tidak ada catatan pengisian BBM yang sesuai filter.
                      </td>
                    </tr>
                  ) : (
                    filteredLogs.map(log => {
                      const isAnomaly = log.efficiencyStatus === 'Kritis / Potensi Anomali';
                      const isHighEfficient = log.efficiencyStatus === 'Sangat Efisien';
                      const isWaste = log.efficiencyStatus === 'Boros';

                      return (
                        <tr key={log.id} className="hover:bg-slate-800/40 transition">
                          <td className="px-4 py-3 whitespace-nowrap">
                            <div className="font-semibold text-white">{log.date}</div>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              <span className="font-bold text-amber-400 font-mono">
                                {log.initialCode || log.plateNumber}
                              </span>
                              <span className="text-[10px] text-slate-400">({log.plateNumber})</span>
                            </div>
                            <span className="text-[9px] px-1.5 py-0.2 rounded bg-slate-800 text-slate-400">
                              {log.vehicleType}
                            </span>
                          </td>

                          <td className="px-4 py-3">
                            <div className="font-semibold text-slate-200 flex items-center gap-1">
                              <User className="w-3 h-3 text-slate-400" />
                              <span>{log.driverName}</span>
                            </div>
                            <div className="text-[11px] text-slate-400 truncate max-w-xs mt-0.5" title={log.routeTrip}>
                              {log.routeTrip || 'Rute lokal AKK'}
                            </div>
                            <div className="text-[10px] text-slate-400 truncate max-w-xs flex items-center gap-1">
                              <MapPin className="w-2.5 h-2.5 text-blue-400" />
                              <span>{log.gasStation}</span>
                            </div>
                          </td>

                          <td className="px-4 py-3 whitespace-nowrap">
                            <div className="font-bold text-slate-200">
                              {log.liters} L <span className="text-slate-400 font-normal">({log.fuelType})</span>
                            </div>
                            <div className="text-amber-400 font-mono font-semibold">
                              Rp {log.totalCost.toLocaleString('id-ID')}
                            </div>
                            <div className="text-[10px] text-slate-400">
                              Rp {log.costPerKm.toLocaleString('id-ID')} / KM
                            </div>
                          </td>

                          <td className="px-4 py-3 whitespace-nowrap font-mono text-[11px] text-slate-300">
                            <div>{log.startOdometerKm.toLocaleString('id-ID')} KM</div>
                            <div className="text-slate-400">&darr; {log.endOdometerKm.toLocaleString('id-ID')} KM</div>
                          </td>

                          <td className="px-4 py-3 text-center whitespace-nowrap font-mono font-bold text-white">
                            {log.distanceKm.toLocaleString('id-ID')} KM
                          </td>

                          <td className="px-4 py-3 text-center whitespace-nowrap">
                            <div className="font-black text-sm font-mono text-white">
                              {log.ratioKmPerLiter}
                            </div>
                            <div className="text-[10px] text-slate-400">
                              Target: {log.targetRatio} KM/L
                            </div>
                          </td>

                          <td className="px-4 py-3 text-center whitespace-nowrap">
                            <span
                              className={`inline-block px-2.5 py-1 rounded-full text-[10px] font-bold border ${
                                isHighEfficient
                                  ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                                  : isWaste
                                  ? 'bg-amber-500/15 text-amber-400 border-amber-500/30'
                                  : isAnomaly
                                  ? 'bg-rose-500/15 text-rose-400 border-rose-500/30 animate-pulse'
                                  : 'bg-blue-500/15 text-blue-400 border-blue-500/30'
                              }`}
                            >
                              {log.efficiencyStatus}
                            </span>
                          </td>

                          <td className="px-4 py-3 text-right whitespace-nowrap space-x-2">
                            <button
                              onClick={() => setSelectedLogForDetail(log)}
                              className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white font-semibold text-[11px] transition cursor-pointer"
                            >
                              Detail / Slip
                            </button>
                            <button
                              onClick={() => {
                                if (confirm(`Hapus catatan BBM ${log.plateNumber} (${log.liters} L)?`)) {
                                  logisticsStore.deleteFuelLog(log.id);
                                }
                              }}
                              className="px-2 py-1 rounded-lg bg-rose-500/10 hover:bg-rose-500 text-rose-400 hover:text-white font-semibold text-[11px] transition cursor-pointer"
                            >
                              Hapus
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 6. TAB 4: ROUTE & FUEL CALCULATOR                                         */}
      {/* ========================================================================= */}
      {activeTab === 'calculator' && (
        <div className="bg-slate-900/80 p-6 rounded-2xl border border-slate-800 space-y-6">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-amber-500/15 text-amber-400 border border-amber-500/30">
              <Calculator className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">
                Kalkulator Estimasi Kebutuhan & Biaya BBM Rute Distribusi
              </h3>
              <p className="text-xs text-slate-400">
                Gunakan simulator ini untuk menghitung alokasi dana operasional solar supir sebelum jadwal pengiriman karton box diberangkatkan dari Pabrik AKK Banyuwangi.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 pt-4 border-t border-slate-800">
            {/* INPUT CONTROLS */}
            <div className="space-y-4">
              <h4 className="text-sm font-bold text-amber-400 flex items-center gap-2">
                <Settings className="w-4 h-4" />
                <span>Parameter Pengiriman & Rute</span>
              </h4>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Pilih Armada / Tipe Kendaraan
                </label>
                <select
                  value={calcFleetType}
                  onChange={(e) => setCalcFleetType(e.target.value as VehicleType)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:border-amber-500"
                >
                  <option value="Pick Up Box">Pick Up Box (Target: 11.0 KM/L)</option>
                  <option value="Engkel STD">Engkel STD - 4 Roda (Target: 8.2 KM/L)</option>
                  <option value="Engkel Long">Engkel Long - 4 Roda (Target: 7.5 KM/L)</option>
                  <option value="Double STD">Double STD - 6 Roda (Target: 6.2 KM/L)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Preset Rute Distribusi Pabrik AKK Banyuwangi
                </label>
                <select
                  value={calcSelectedRoute}
                  onChange={(e) => handlePresetRouteChange(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:border-amber-500"
                >
                  <option value="bwi-sby-pp">Banyuwangi &harr; Surabaya Hub (620 KM Pulang-Pergi via Tol Probolinggo)</option>
                  <option value="bwi-mlg-pp">Banyuwangi &harr; Malang Raya (560 KM Pulang-Pergi)</option>
                  <option value="bwi-jbr-pp">Banyuwangi &harr; Jember & Lumajang (210 KM Pulang-Pergi via Gumitir)</option>
                  <option value="bwi-dps-pp">Banyuwangi &harr; Denpasar Bali (340 KM PP + Ferry Ketapang-Gilimanuk)</option>
                  <option value="bwi-solo-pp">Banyuwangi &harr; Solo / Yogyakarta (820 KM Pulang-Pergi Tol Trans-Jawa)</option>
                  <option value="custom">Kustom Jarak Tempuh Sendiri</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Jarak Tempuh (KM)
                  </label>
                  <input
                    type="number"
                    value={calcDistanceKm}
                    onChange={(e) => {
                      setCalcDistanceKm(Number(e.target.value) || 0);
                      setCalcSelectedRoute('custom');
                    }}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white font-mono focus:border-amber-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Muatan Karton Box (Pcs)
                  </label>
                  <input
                    type="number"
                    value={calcCargoBoxes}
                    onChange={(e) => setCalcCargoBoxes(Number(e.target.value) || 0)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white font-mono focus:border-amber-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Jenis Bahan Bakar
                  </label>
                  <select
                    value={calcFuelType}
                    onChange={(e) => {
                      const ft = e.target.value as FuelType;
                      setCalcFuelType(ft);
                      setCalcCustomPrice(STANDARD_FUEL_PRICES[ft] || 6800);
                    }}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:border-amber-500"
                  >
                    <option value="BioSolar">BioSolar (Subsidi)</option>
                    <option value="Dexlite">Dexlite (Non-Subsidi)</option>
                    <option value="Pertamina Dex">Pertamina Dex</option>
                    <option value="Pertalite">Pertalite</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Harga / Liter (Rp)
                  </label>
                  <input
                    type="number"
                    value={calcCustomPrice}
                    onChange={(e) => setCalcCustomPrice(Number(e.target.value) || 0)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white font-mono focus:border-amber-500"
                  />
                </div>
              </div>
            </div>

            {/* OUTPUT PREVIEW PANEL */}
            <div className="bg-slate-950/80 p-5 rounded-2xl border border-slate-800/90 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-4">
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                    Hasil Kalkulasi Estimasi
                  </span>
                  <span className="text-xs font-bold text-amber-400 bg-amber-500/15 px-2.5 py-0.5 rounded-full border border-amber-500/30">
                    Standar Rasio: {calcOutput.target} KM / Liter
                  </span>
                </div>

                <div className="space-y-4">
                  <div className="bg-slate-900/90 p-4 rounded-xl border border-slate-800">
                    <div className="text-xs text-slate-400">Total Kebutuhan Bahan Bakar:</div>
                    <div className="text-3xl font-black text-amber-400 font-mono mt-0.5">
                      {calcOutput.estLiters} <span className="text-sm text-slate-400 font-bold">Liter {calcFuelType}</span>
                    </div>
                  </div>

                  <div className="bg-slate-900/90 p-4 rounded-xl border border-slate-800">
                    <div className="text-xs text-slate-400">Estimasi Total Biaya BBM:</div>
                    <div className="text-3xl font-black text-emerald-400 font-mono mt-0.5">
                      Rp {calcOutput.estTotalCost.toLocaleString('id-ID')}
                    </div>
                    <div className="text-[11px] text-slate-400 mt-1">
                      Biaya per Kilometer: <strong className="text-slate-200">Rp {calcOutput.costPerKm.toLocaleString('id-ID')} / KM</strong>
                    </div>
                  </div>

                  <div className="p-3 rounded-xl bg-blue-500/10 border border-blue-500/25 flex items-center justify-between">
                    <div>
                      <div className="text-xs font-semibold text-blue-300">Biaya Bahan Bakar Per Karton Box:</div>
                      <div className="text-[11px] text-slate-400">Berdasarkan muatan {calcCargoBoxes.toLocaleString('id-ID')} pcs</div>
                    </div>
                    <div className="text-xl font-black text-blue-400 font-mono">
                      Rp {calcOutput.costPerBox} <span className="text-xs text-slate-400">/ pcs</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-6 pt-4 border-t border-slate-800 text-[11px] text-slate-400 flex items-center gap-2">
                <Info className="w-4 h-4 text-amber-400 shrink-0" />
                <span>Rekomendasi SPBU di rute ini: Rest Area Tol Probolinggo KM 833 atau SPBU Klatak Kalipuro sebelum berangkat.</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 6. TAB: LAPORAN & REKAP MINGGUAN (PER DRIVER & ARMADA)                    */}
      {/* ========================================================================= */}
      {activeTab === 'weekly_report' && (
        <FuelWeeklyReportView
          fuelLogs={fuelLogs}
          onOpenExportModal={() => setIsExportModalOpen(true)}
        />
      )}

      {/* ========================================================================= */}
      {/* 7. MODAL: CATAT PENGISIAN BBM BARU                                        */}
      {/* ========================================================================= */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-200 my-8">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/70">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-amber-500/15 text-amber-400">
                  <Fuel className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Catat Pengisian Bahan Bakar Baru</h3>
                  <p className="text-xs text-slate-400">Entri data struk SPBU dan kilometer armada logistik AKK.</p>
                </div>
              </div>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveFuelLog} className="p-6 space-y-4 max-h-[82vh] overflow-y-auto">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {/* 1. Custom Dropdown: Armada Truk */}
                <div className="relative">
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Armada Truk <span className="text-rose-400">*</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => setActiveModalDropdown(activeModalDropdown === 'fleet' ? null : 'fleet')}
                    className={`w-full bg-slate-950/90 hover:bg-slate-900 border ${
                      activeModalDropdown === 'fleet' ? 'border-amber-500 ring-2 ring-amber-500/20' : 'border-slate-800 hover:border-slate-700'
                    } rounded-xl px-3 py-2.5 text-xs text-left flex items-center justify-between gap-2 transition cursor-pointer shadow-inner`}
                  >
                    <span className="flex items-center gap-2 min-w-0">
                      <span className="w-6 h-6 rounded-lg bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
                        <Truck className="w-3.5 h-3.5" />
                      </span>
                      {formFleetId ? (
                        (() => {
                          const f = fleets.find(fl => fl.id === formFleetId);
                          return f ? (
                            <span className="truncate font-bold text-white">
                              {f.initialCode || f.plateNumber}{' '}
                              <span className="text-slate-400 font-normal">({f.plateNumber})</span>
                            </span>
                          ) : (
                            <span className="text-slate-400">Pilih Armada...</span>
                          );
                        })()
                      ) : (
                        <span className="text-slate-400">-- Pilih Armada --</span>
                      )}
                    </span>
                    <ChevronDown className={`w-4 h-4 text-slate-400 shrink-0 transition-transform duration-200 ${activeModalDropdown === 'fleet' ? 'rotate-180 text-amber-400' : ''}`} />
                  </button>

                  {activeModalDropdown === 'fleet' && (
                    <div className="absolute left-0 right-0 top-full mt-1.5 z-50 bg-slate-900/95 backdrop-blur-xl border border-slate-700/90 rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
                      <div className="px-3 py-2 bg-slate-950/80 border-b border-slate-800 flex items-center justify-between">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Pilih Unit Armada (12 Unit)</span>
                        <span className="text-[10px] text-amber-400 font-mono">N1 – DS5</span>
                      </div>
                      <div className="max-h-60 overflow-y-auto divide-y divide-slate-800/60">
                        {sortFleetsByCanonicalOrder(fleets).map(f => {
                          const isSelected = formFleetId === f.id;
                          return (
                            <button
                              key={f.id}
                              type="button"
                              onClick={() => {
                                handleFleetSelection(f.id);
                                setActiveModalDropdown(null);
                              }}
                              className={`w-full px-3 py-2.5 text-left flex items-center justify-between gap-2 transition cursor-pointer ${
                                isSelected ? 'bg-amber-500/15 text-amber-300' : 'hover:bg-slate-800/80 text-slate-200'
                              }`}
                            >
                              <div className="min-w-0">
                                <div className="text-xs font-bold flex items-center gap-1.5">
                                  <span className="px-1.5 py-0.5 rounded bg-slate-950 border border-slate-700 font-mono text-[10px] text-amber-400">
                                    {f.initialCode || f.plateNumber}
                                  </span>
                                  <span className="truncate">{f.plateNumber}</span>
                                </div>
                                <div className="text-[10px] text-slate-400 truncate mt-0.5">
                                  {f.vehicleType} {f.brand ? `• ${f.brand}` : ''}
                                </div>
                              </div>
                              {isSelected && <Check className="w-4 h-4 text-amber-400 shrink-0" />}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>

                {/* 2. Custom Dropdown: Nama Driver */}
                <div className="relative">
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Nama Driver <span className="text-rose-400">*</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setActiveModalDropdown(activeModalDropdown === 'driver' ? null : 'driver');
                      setDriverSearchFilter('');
                    }}
                    className={`w-full bg-slate-950/90 hover:bg-slate-900 border ${
                      activeModalDropdown === 'driver' ? 'border-amber-500 ring-2 ring-amber-500/20' : 'border-slate-800 hover:border-slate-700'
                    } rounded-xl px-3 py-2.5 text-xs text-left flex items-center justify-between gap-2 transition cursor-pointer shadow-inner`}
                  >
                    <span className="flex items-center gap-2 min-w-0">
                      <span className="w-6 h-6 rounded-lg bg-sky-500/15 border border-sky-500/30 flex items-center justify-center text-sky-400 shrink-0">
                        <User className="w-3.5 h-3.5" />
                      </span>
                      {formDriverName ? (
                        <span className="truncate font-bold text-white">{formDriverName}</span>
                      ) : (
                        <span className="text-slate-400">-- Pilih Nama Driver --</span>
                      )}
                    </span>
                    <ChevronDown className={`w-4 h-4 text-slate-400 shrink-0 transition-transform duration-200 ${activeModalDropdown === 'driver' ? 'rotate-180 text-amber-400' : ''}`} />
                  </button>

                  {activeModalDropdown === 'driver' && (
                    <div className="absolute left-0 right-0 top-full mt-1.5 z-50 bg-slate-900/95 backdrop-blur-xl border border-slate-700/90 rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
                      <div className="p-2 bg-slate-950/90 border-b border-slate-800">
                        <div className="relative">
                          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                          <input
                            type="text"
                            value={driverSearchFilter}
                            onChange={(e) => setDriverSearchFilter(e.target.value)}
                            placeholder="Cari nama driver..."
                            className="w-full bg-slate-900 border border-slate-700/80 rounded-lg pl-8 pr-2.5 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
                          />
                        </div>
                      </div>
                      <div className="max-h-56 overflow-y-auto divide-y divide-slate-800/60">
                        {driverDropdownOptions
                          .filter(d => !driverSearchFilter.trim() || d.name.toLowerCase().includes(driverSearchFilter.toLowerCase()))
                          .map(d => {
                            const isSelected = formDriverName === d.name;
                            return (
                              <button
                                key={d.id}
                                type="button"
                                onClick={() => {
                                  setFormDriverName(d.name);
                                  setFormDriverId(d.id);
                                  setActiveModalDropdown(null);
                                }}
                                className={`w-full px-3 py-2 text-left flex items-center justify-between gap-2 transition cursor-pointer ${
                                  isSelected ? 'bg-sky-500/15 text-sky-300 font-bold' : 'hover:bg-slate-800/80 text-slate-200'
                                }`}
                              >
                                <div className="flex items-center gap-2 min-w-0">
                                  <span className="w-5 h-5 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-[10px] font-bold text-sky-400 shrink-0">
                                    {d.name.charAt(0).toUpperCase()}
                                  </span>
                                  <span className="text-xs truncate">{d.name}</span>
                                </div>
                                {isSelected && <Check className="w-4 h-4 text-sky-400 shrink-0" />}
                              </button>
                            );
                          })}
                      </div>
                    </div>
                  )}
                </div>

                {/* 3. Custom Dropdown: Area Kirim (Tersinkronisasi dengan Jadwal & Penugasan) */}
                <div className="relative">
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Area Kirim <span className="text-rose-400">*</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setActiveModalDropdown(activeModalDropdown === 'area' ? null : 'area');
                      setAreaSearchFilter('');
                    }}
                    className={`w-full bg-slate-950/90 hover:bg-slate-900 border ${
                      activeModalDropdown === 'area' ? 'border-amber-500 ring-2 ring-amber-500/20' : 'border-slate-800 hover:border-slate-700'
                    } rounded-xl px-3 py-2.5 text-xs text-left flex items-center justify-between gap-2 transition cursor-pointer shadow-inner`}
                  >
                    <span className="flex items-center gap-2 min-w-0">
                      <span className="w-6 h-6 rounded-lg bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
                        <MapPin className="w-3.5 h-3.5" />
                      </span>
                      {formRouteTrip ? (
                        <span className="truncate font-bold text-white">{formRouteTrip}</span>
                      ) : (
                        <span className="text-slate-400">-- Pilih Area Kirim --</span>
                      )}
                    </span>
                    <ChevronDown className={`w-4 h-4 text-slate-400 shrink-0 transition-transform duration-200 ${activeModalDropdown === 'area' ? 'rotate-180 text-amber-400' : ''}`} />
                  </button>

                  {activeModalDropdown === 'area' && (
                    <div className="absolute left-0 right-0 top-full mt-1.5 z-50 bg-slate-900/95 backdrop-blur-xl border border-slate-700/90 rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
                      <div className="p-2 bg-slate-950/90 border-b border-slate-800 space-y-1.5">
                        <div className="flex items-center justify-between px-1">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400">Area Jadwal & Penugasan</span>
                          <span className="text-[10px] text-slate-400">{deliveryAreaOptions.length} Rute</span>
                        </div>
                        <div className="relative">
                          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                          <input
                            type="text"
                            value={areaSearchFilter}
                            onChange={(e) => {
                              setAreaSearchFilter(e.target.value);
                              setFormRouteTrip(e.target.value);
                            }}
                            placeholder="Cari atau ketik area kirim..."
                            className="w-full bg-slate-900 border border-slate-700/80 rounded-lg pl-8 pr-2.5 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                          />
                        </div>
                      </div>
                      <div className="max-h-56 overflow-y-auto divide-y divide-slate-800/60">
                        {deliveryAreaOptions
                          .filter(area => !areaSearchFilter.trim() || area.toLowerCase().includes(areaSearchFilter.toLowerCase()))
                          .map(area => {
                            const isSelected = formRouteTrip.toLowerCase() === area.toLowerCase();
                            return (
                              <button
                                key={area}
                                type="button"
                                onClick={() => {
                                  setFormRouteTrip(area);
                                  setActiveModalDropdown(null);
                                }}
                                className={`w-full px-3 py-2 text-left flex items-center justify-between gap-2 transition cursor-pointer ${
                                  isSelected ? 'bg-emerald-500/15 text-emerald-300 font-bold' : 'hover:bg-slate-800/80 text-slate-200'
                                }`}
                              >
                                <span className="text-xs truncate flex items-center gap-2">
                                  <MapPin className="w-3 h-3 text-emerald-400 shrink-0" />
                                  {area}
                                </span>
                                {isSelected && <Check className="w-4 h-4 text-emerald-400 shrink-0" />}
                              </button>
                            );
                          })}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {/* 4. Modern Interactive Calendar Date Picker: Tanggal Isi */}
                <div className="relative">
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Tanggal Isi <span className="text-rose-400">*</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      if (activeModalDropdown !== 'date') {
                        const parsed = formDate ? new Date(`${formDate}T00:00:00`) : new Date();
                        if (!isNaN(parsed.getTime())) setCalendarViewMonth(parsed);
                      }
                      setActiveModalDropdown(activeModalDropdown === 'date' ? null : 'date');
                    }}
                    className={`w-full bg-slate-950/90 hover:bg-slate-900 border ${
                      activeModalDropdown === 'date' ? 'border-amber-500 ring-2 ring-amber-500/20' : 'border-slate-800 hover:border-slate-700'
                    } rounded-xl px-3 py-2.5 text-xs text-left flex items-center justify-between gap-2 transition cursor-pointer shadow-inner`}
                  >
                    <span className="flex items-center gap-2 min-w-0">
                      <span className="w-6 h-6 rounded-lg bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center text-indigo-400 shrink-0">
                        <Calendar className="w-3.5 h-3.5" />
                      </span>
                      <span className="font-bold text-white truncate">
                        {formDate
                          ? new Date(`${formDate}T00:00:00`).toLocaleDateString('id-ID', {
                              day: '2-digit',
                              month: 'short',
                              year: 'numeric'
                            })
                          : 'Pilih Tanggal'}
                      </span>
                    </span>
                    <ChevronDown className={`w-4 h-4 text-slate-400 shrink-0 transition-transform duration-200 ${activeModalDropdown === 'date' ? 'rotate-180 text-amber-400' : ''}`} />
                  </button>

                  {activeModalDropdown === 'date' && (() => {
                    const year = calendarViewMonth.getFullYear();
                    const month = calendarViewMonth.getMonth();
                    const monthNames = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
                    const firstDayIndex = new Date(year, month, 1).getDay();
                    const daysInMonth = new Date(year, month + 1, 0).getDate();
                    const todayIso = new Date().toISOString().split('T')[0];
                    const yesterdayDate = new Date();
                    yesterdayDate.setDate(yesterdayDate.getDate() - 1);
                    const yesterdayIso = yesterdayDate.toISOString().split('T')[0];

                    const dayCells: (number | null)[] = [];
                    for (let i = 0; i < firstDayIndex; i++) dayCells.push(null);
                    for (let d = 1; d <= daysInMonth; d++) dayCells.push(d);

                    return (
                      <div className="absolute left-0 top-full mt-1.5 z-50 w-72 bg-slate-900/95 backdrop-blur-xl border border-slate-700/90 rounded-2xl shadow-2xl p-3 animate-in fade-in zoom-in-95 duration-150">
                        {/* Calendar Header */}
                        <div className="flex items-center justify-between mb-2.5 pb-2 border-b border-slate-800">
                          <button
                            type="button"
                            onClick={() => setCalendarViewMonth(new Date(year, month - 1, 1))}
                            className="p-1.5 rounded-lg bg-slate-950 hover:bg-slate-800 text-slate-300 border border-slate-800 transition cursor-pointer"
                          >
                            <ChevronLeft className="w-3.5 h-3.5" />
                          </button>
                          <div className="text-xs font-extrabold text-white tracking-wide">
                            {monthNames[month]} {year}
                          </div>
                          <button
                            type="button"
                            onClick={() => setCalendarViewMonth(new Date(year, month + 1, 1))}
                            className="p-1.5 rounded-lg bg-slate-950 hover:bg-slate-800 text-slate-300 border border-slate-800 transition cursor-pointer"
                          >
                            <ChevronRight className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        {/* Quick Select Pills */}
                        <div className="flex items-center gap-1.5 mb-2.5">
                          <button
                            type="button"
                            onClick={() => {
                              setFormDate(todayIso);
                              setActiveModalDropdown(null);
                            }}
                            className={`flex-1 py-1 rounded-lg text-[10px] font-bold border transition cursor-pointer ${
                              formDate === todayIso
                                ? 'bg-indigo-500/20 border-indigo-500/50 text-indigo-300'
                                : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                            }`}
                          >
                            Hari Ini
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setFormDate(yesterdayIso);
                              setActiveModalDropdown(null);
                            }}
                            className={`flex-1 py-1 rounded-lg text-[10px] font-bold border transition cursor-pointer ${
                              formDate === yesterdayIso
                                ? 'bg-indigo-500/20 border-indigo-500/50 text-indigo-300'
                                : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                            }`}
                          >
                            Kemarin
                          </button>
                        </div>

                        {/* Day Names */}
                        <div className="grid grid-cols-7 gap-1 text-center mb-1">
                          {['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'].map(d => (
                            <div key={d} className="text-[9px] font-bold text-slate-500 uppercase">
                              {d}
                            </div>
                          ))}
                        </div>

                        {/* Calendar Grid */}
                        <div className="grid grid-cols-7 gap-1">
                          {dayCells.map((day, idx) => {
                            if (day === null) {
                              return <div key={`empty-${idx}`} className="h-7" />;
                            }
                            const iso = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                            const isSelected = formDate === iso;
                            const isToday = todayIso === iso;
                            return (
                              <button
                                key={iso}
                                type="button"
                                onClick={() => {
                                  setFormDate(iso);
                                  setActiveModalDropdown(null);
                                }}
                                className={`h-7 rounded-lg text-[11px] font-mono font-bold flex items-center justify-center transition cursor-pointer ${
                                  isSelected
                                    ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/25'
                                    : isToday
                                    ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/40'
                                    : 'text-slate-200 hover:bg-slate-800'
                                }`}
                              >
                                {day}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })()}
                </div>

                {/* 5. Custom Dropdown: Jenis Bahan Bakar */}
                <div className="relative">
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Jenis Bahan Bakar <span className="text-rose-400">*</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => setActiveModalDropdown(activeModalDropdown === 'fuel' ? null : 'fuel')}
                    className={`w-full bg-slate-950/90 hover:bg-slate-900 border ${
                      activeModalDropdown === 'fuel' ? 'border-amber-500 ring-2 ring-amber-500/20' : 'border-slate-800 hover:border-slate-700'
                    } rounded-xl px-3 py-2.5 text-xs text-left flex items-center justify-between gap-2 transition cursor-pointer shadow-inner`}
                  >
                    <span className="flex items-center gap-2 min-w-0">
                      <span className="w-6 h-6 rounded-lg bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
                        <Fuel className="w-3.5 h-3.5" />
                      </span>
                      <span className="font-bold text-white truncate">
                        {formFuelType === 'BioSolar' ? 'Solar (BioSolar Subsidi)' : formFuelType}
                      </span>
                    </span>
                    <ChevronDown className={`w-4 h-4 text-slate-400 shrink-0 transition-transform duration-200 ${activeModalDropdown === 'fuel' ? 'rotate-180 text-amber-400' : ''}`} />
                  </button>

                  {activeModalDropdown === 'fuel' && (
                    <div className="absolute left-0 right-0 top-full mt-1.5 z-50 bg-slate-900/95 backdrop-blur-xl border border-slate-700/90 rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
                      {([
                        { value: 'BioSolar' as FuelType, label: 'Solar (BioSolar)', price: STANDARD_FUEL_PRICES['BioSolar'] },
                        { value: 'Dexlite' as FuelType, label: 'Dexlite', price: STANDARD_FUEL_PRICES['Dexlite'] },
                        { value: 'Pertamina Dex' as FuelType, label: 'Pertamina Dex', price: STANDARD_FUEL_PRICES['Pertamina Dex'] }
                      ]).map(opt => {
                        const isSelected = formFuelType === opt.value;
                        return (
                          <button
                            key={opt.value}
                            type="button"
                            onClick={() => {
                              handleFuelTypeChange(opt.value);
                              setActiveModalDropdown(null);
                            }}
                            className={`w-full px-3 py-2.5 text-left flex items-center justify-between gap-2 border-b last:border-b-0 border-slate-800/60 transition cursor-pointer ${
                              isSelected ? 'bg-amber-500/15 text-amber-300 font-bold' : 'hover:bg-slate-800/80 text-slate-200'
                            }`}
                          >
                            <div>
                              <div className="text-xs font-bold">{opt.label}</div>
                              <div className="text-[10px] text-slate-400 font-mono">Rp {opt.price.toLocaleString('id-ID')}/L</div>
                            </div>
                            {isSelected && <Check className="w-4 h-4 text-amber-400 shrink-0" />}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Harga per Liter (Rp)
                  </label>
                  <input
                    type="number"
                    placeholder="misal 6800"
                    value={formCostPerLiter}
                    onChange={(e) => setFormCostPerLiter(e.target.value)}
                    required
                    className="w-full bg-slate-950/90 border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-white font-mono focus:border-amber-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Volume BBM (Liter) <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    placeholder="misal 65"
                    value={formLiters}
                    onChange={(e) => setFormLiters(e.target.value)}
                    required
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white font-mono focus:border-amber-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Kilometer Awal (KM) <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="number"
                    placeholder="Odo saat isi sebelumnya"
                    value={formStartOdo}
                    onChange={(e) => setFormStartOdo(e.target.value)}
                    required
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white font-mono focus:border-amber-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Kilometer Akhir (KM) <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="number"
                    placeholder="Odo saat ini / refuel"
                    value={formEndOdo}
                    onChange={(e) => setFormEndOdo(e.target.value)}
                    required
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white font-mono focus:border-amber-500"
                  />
                </div>
              </div>

              {/* LIVE CALCULATION BAR */}
              <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                <div className="text-[11px] font-bold text-slate-400 flex items-center justify-between">
                  <span>Kalkulasi Otomatis Sistem:</span>
                  <span className={`px-2 py-0.5 rounded-md border text-[10px] ${liveFormEfficiency.color}`}>
                    {liveFormEfficiency.status}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-2 text-xs">
                  <div>
                    <span className="text-slate-400 text-[10px]">Jarak Tempuh:</span>
                    <div className="font-mono font-bold text-white">{liveFormDistance} KM</div>
                  </div>
                  <div>
                    <span className="text-slate-400 text-[10px]">Total Biaya BBM:</span>
                    <div className="font-mono font-bold text-emerald-400">Rp {liveFormTotalCost.toLocaleString('id-ID')}</div>
                  </div>
                  <div>
                    <span className="text-slate-400 text-[10px]">Rasio Efisiensi:</span>
                    <div className="font-mono font-black text-amber-400">{liveFormRatio} KM / Liter</div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="relative">
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Lokasi SPBU <span className="text-rose-400">*</span>
                  </label>

                  <button
                    type="button"
                    onClick={() => setIsGasStationDropdownOpen(prev => !prev)}
                    className={`w-full bg-slate-950 border rounded-xl px-3 py-2 text-xs text-white flex items-center justify-between gap-2 transition cursor-pointer ${
                      isGasStationDropdownOpen
                        ? 'border-amber-400 ring-2 ring-amber-500/20'
                        : 'border-slate-800 hover:border-amber-500/60'
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <MapPin
                        className={`w-3.5 h-3.5 shrink-0 ${
                          formGasStation.includes('Farly')
                            ? 'text-amber-400'
                            : formGasStation.includes('Gajah Mada')
                            ? 'text-blue-400'
                            : 'text-rose-400'
                        }`}
                      />
                      <span className="font-bold text-white truncate">
                        {formGasStation.replace(/^SPBU\s+/i, '')}
                      </span>
                      {!formGasStation.includes('Farly') && !formGasStation.includes('Gajah Mada') && (
                        <span className="px-1.5 py-0.2 rounded text-[9px] font-bold border bg-rose-500/20 text-rose-300 border-rose-500/30">
                          Urgent
                        </span>
                      )}
                    </div>
                    <ChevronDown
                      className={`w-4 h-4 text-slate-400 shrink-0 transition-transform duration-200 ${
                        isGasStationDropdownOpen ? 'rotate-180 text-amber-400' : ''
                      }`}
                    />
                  </button>

                  {isGasStationDropdownOpen && (
                    <div className="mt-1.5 rounded-xl bg-slate-900 border border-slate-700/90 shadow-2xl overflow-hidden divide-y divide-slate-800/80 animate-in fade-in zoom-in-95 duration-150 z-30 relative">
                      {[
                        {
                          value: 'SPBU Farly',
                          label: 'Farly',
                          badge: '',
                          desc: 'Pos Pengisian Solar Reguler Farly • Banyuwangi',
                          badgeCls: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
                          iconCls: 'text-amber-400 bg-amber-500/15 border-amber-500/30'
                        },
                        {
                          value: 'SPBU Gajah Mada',
                          label: 'Gajah Mada',
                          badge: '',
                          desc: 'Pos Pengisian Solar Gajah Mada • Banyuwangi',
                          badgeCls: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
                          iconCls: 'text-blue-400 bg-blue-500/15 border-blue-500/30'
                        },
                        {
                          value: 'SPBU Lain (Urgent)',
                          label: 'SPBU Lain (Urgent)',
                          badge: 'Darurat / Urgent',
                          desc: 'Pengisian Darurat Rute Luar Kota / Lintas Pulau',
                          badgeCls: 'bg-rose-500/20 text-rose-300 border-rose-500/30',
                          iconCls: 'text-rose-400 bg-rose-500/15 border-rose-500/30'
                        }
                      ].map(opt => {
                        const isSelected = formGasStation === opt.value;
                        return (
                          <button
                            key={opt.value}
                            type="button"
                            onClick={() => {
                              setFormGasStation(opt.value);
                              setIsGasStationDropdownOpen(false);
                            }}
                            className={`w-full px-3 py-2.5 text-left flex items-center justify-between gap-2 transition cursor-pointer ${
                              isSelected ? 'bg-amber-500/10' : 'hover:bg-slate-800/80'
                            }`}
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 border ${opt.iconCls}`}>
                                <Fuel className="w-3.5 h-3.5" />
                              </div>
                              <div className="min-w-0">
                                <div className="flex items-center gap-1.5">
                                  <span className="text-xs font-black text-white">{opt.label}</span>
                                  {opt.badge && (
                                    <span className={`px-1.5 py-0.2 rounded text-[9px] font-bold border ${opt.badgeCls}`}>
                                      {opt.badge}
                                    </span>
                                  )}
                                </div>
                                <div className="text-[10px] text-slate-400 truncate mt-0.5">{opt.desc}</div>
                              </div>
                            </div>
                            <div
                              className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 border ${
                                isSelected
                                  ? 'bg-amber-500 border-amber-400 text-slate-950'
                                  : 'border-slate-700 bg-slate-950 text-transparent'
                              }`}
                            >
                              <Check className="w-3 h-3 stroke-[3]" />
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Nomor Struk / Nota SPBU
                  </label>
                  <input
                    type="text"
                    placeholder="Contoh: SPBU-833-1029"
                    value={formReceiptNumber}
                    onChange={(e) => setFormReceiptNumber(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:border-amber-500"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold shadow-md transition cursor-pointer"
                >
                  Simpan Catatan BBM
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 8. MODAL: DETAIL / SLIP BUKTI BBM                                         */}
      {/* ========================================================================= */}
      {selectedLogForDetail && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-950">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-amber-400" />
                <h3 className="font-bold text-white text-sm">Slip Bukti Pengisian BBM</h3>
              </div>
              <button
                onClick={() => setSelectedLogForDetail(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4 text-xs">
              <div className="text-center border-b border-dashed border-slate-800 pb-3">
                <div className="font-black text-white text-sm">PT ANUGRAH KEMASAN KREATIF</div>
                <div className="text-[10px] text-slate-400">Divisi Distribusi & Logistik Armada</div>
                <div className="text-[11px] font-mono text-amber-400 mt-1">
                  NO STRUK: {selectedLogForDetail.receiptNumber || selectedLogForDetail.id}
                </div>
              </div>

              <div className="space-y-2 font-mono">
                <div className="flex justify-between">
                  <span className="text-slate-400">Tanggal:</span>
                  <span className="text-white font-bold">{selectedLogForDetail.date}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Armada:</span>
                  <span className="text-white font-bold">{selectedLogForDetail.initialCode || selectedLogForDetail.plateNumber} ({selectedLogForDetail.plateNumber})</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Driver:</span>
                  <span className="text-white">{selectedLogForDetail.driverName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">SPBU:</span>
                  <span className="text-white truncate max-w-[200px]" title={selectedLogForDetail.gasStation}>{selectedLogForDetail.gasStation}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Rute:</span>
                  <span className="text-white truncate max-w-[200px]">{selectedLogForDetail.routeTrip || '-'}</span>
                </div>
                <div className="flex justify-between border-t border-slate-800 pt-2">
                  <span className="text-slate-400">Volume BBM:</span>
                  <span className="text-white font-bold">{selectedLogForDetail.liters} L ({selectedLogForDetail.fuelType})</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Harga per Liter:</span>
                  <span className="text-white">Rp {selectedLogForDetail.costPerLiter.toLocaleString('id-ID')}</span>
                </div>
                <div className="flex justify-between text-amber-400 font-bold text-sm border-b border-slate-800 pb-2">
                  <span>TOTAL BIAYA:</span>
                  <span>Rp {selectedLogForDetail.totalCost.toLocaleString('id-ID')}</span>
                </div>
                <div className="flex justify-between text-[11px] pt-1">
                  <span className="text-slate-400">Jarak Ditempuh:</span>
                  <span className="text-white font-bold">{selectedLogForDetail.distanceKm} KM ({selectedLogForDetail.startOdometerKm} - {selectedLogForDetail.endOdometerKm})</span>
                </div>
                <div className="flex justify-between text-[11px]">
                  <span className="text-slate-400">Rasio Konsumsi:</span>
                  <span className="text-emerald-400 font-bold">{selectedLogForDetail.ratioKmPerLiter} KM / L</span>
                </div>
                <div className="flex justify-between text-[11px]">
                  <span className="text-slate-400">Status Efisiensi:</span>
                  <span className="text-amber-400 font-bold">{selectedLogForDetail.efficiencyStatus}</span>
                </div>
              </div>

              {selectedLogForDetail.notes && (
                <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-[11px] text-slate-300">
                  <span className="font-semibold text-slate-400">Catatan:</span> {selectedLogForDetail.notes}
                </div>
              )}

              <div className="pt-2 flex items-center justify-between">
                <button
                  onClick={() => window.print()}
                  className="w-full flex items-center justify-center gap-2 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs transition"
                >
                  <Printer className="w-4 h-4" />
                  <span>Cetak Slip Rekap</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 9. MODAL: EXPORT LAPORAN KONSUMSI BBM (PDF / EXCEL)                       */}
      {/* ========================================================================= */}
      <FuelConsumptionReportModal
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        fuelLogs={fuelLogs}
      />
    </div>
  );
};
