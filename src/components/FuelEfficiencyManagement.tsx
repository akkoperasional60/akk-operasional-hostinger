import React, { useState, useEffect, useMemo } from 'react';
import {
  Fuel,
  TrendingUp,
  AlertTriangle,
  Award,
  Calendar,
  Search,
  Download,
  Plus,
  Truck,
  User,
  MapPin,
  CheckCircle2,
  DollarSign,
  Gauge,
  FileText,
  Calculator,
  ArrowRight,
  Info,
  RefreshCw,
  X,
  Printer,
  ChevronRight,
  Settings,
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Activity,
  FileSpreadsheet,
  ChevronDown,
  ChevronLeft,
  Check,
  Building2,
  Edit
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
  Cell
} from 'recharts';
import {
  FuelLog,
  FuelType,
  EfficiencyStatus,
  Fleet,
  Crew,
  VehicleType,
  FleetFuelSummary,
  DriverFuelScore
} from '../types';
import { logisticsStore } from '../services/store';
import { branchStore } from '../services/branchStore';
import {
  FUEL_TARGET_RATIOS,
  STANDARD_FUEL_PRICES
} from '../data/fuelMockData';
import { getCanonicalFleetOrderIndex, sortFleetsByCanonicalOrder } from '../data/mockData';
import { OFFICIAL_DESTINATION_AREAS } from '../utils/areaNormalizer';
import { FuelConsumptionReportModal } from './FuelConsumptionReportModal';
import { FuelWeeklyReportView } from './FuelWeeklyReportView';

interface FuelEfficiencyManagementProps {
  onNavigateToFleets?: () => void;
}

const compactPersonKey = (raw?: string): string =>
  (raw || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');

export const FuelEfficiencyManagement: React.FC<FuelEfficiencyManagementProps> = () => {
  const [fuelLogs, setFuelLogs] = useState<FuelLog[]>(logisticsStore.getFuelLogs());
  const [fleets, setFleets] = useState<Fleet[]>(logisticsStore.getFleets());
  const [crews, setCrews] = useState<Crew[]>(logisticsStore.getCrews());
  const [activeTab, setActiveTab] = useState<'overview' | 'liter_km' | 'weekly_report' | 'leaderboard' | 'logs'>('overview');
  const [selectedBranchFilter, setSelectedBranchFilter] = useState<'all' | 'cab-banyuwangi' | 'cab-sidoarjo'>('all');
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [isCalculatorModalOpen, setIsCalculatorModalOpen] = useState(false);

  // Liter per KM Unit Analysis Filter States
  const [lKmSortBy, setLKmSortBy] = useState<'canonical_order' | 'lKm_asc' | 'lKm_desc' | 'efficiency_desc' | 'distance_desc'>('canonical_order');
  const [lKmSearch, setLKmSearch] = useState<string>('');
  const [comparisonSelectedFleetId, setComparisonSelectedFleetId] = useState<string>('all');

  // Interactive Converter Calculator
  const [simKmL, setSimKmL] = useState<number>(0);

  // Search & Filters for logs table
  const [searchQuery, setSearchQuery] = useState('');
  const [filterFleetId, setFilterFleetId] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterFuelType, setFilterFuelType] = useState<string>('all');
  const [filterSpbu, setFilterSpbu] = useState<'all' | 'Farly' | 'Gajah Mada' | 'SPBU Lain'>('all');
  const [logSortBy, setLogSortBy] = useState<'date_desc' | 'efficient_asc' | 'wasteful_desc'>('date_desc');

  // Modal states
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingLogId, setEditingLogId] = useState<string | null>(null);
  const [selectedLogForDetail, setSelectedLogForDetail] = useState<FuelLog | null>(null);

  // Form states for new / edit fuel log
  const [formBranchId, setFormBranchId] = useState<'cab-banyuwangi' | 'cab-sidoarjo'>('cab-banyuwangi');
  const [formFleetId, setFormFleetId] = useState<string>('');
  const [formDriverName, setFormDriverName] = useState<string>('');
  const [formDriverId, setFormDriverId] = useState<string>('');
  const [formHelperName, setFormHelperName] = useState<string>('');
  const [formHelperId, setFormHelperId] = useState<string>('');
  const [formDate, setFormDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [formFuelType, setFormFuelType] = useState<FuelType>('BioSolar');
  const [formLiters, setFormLiters] = useState<string>('');
  const [formCostPerLiter, setFormCostPerLiter] = useState<string>('6800');
  const [formStartOdo, setFormStartOdo] = useState<string>('');
  const [formEndOdo, setFormEndOdo] = useState<string>('');
  const [formGasStation, setFormGasStation] = useState<string>('SPBU Farly');
  const [isGasStationDropdownOpen, setIsGasStationDropdownOpen] = useState<boolean>(false);
  const [formRouteTrip, setFormRouteTrip] = useState<string>('');
  const [formCargoLoadTon, setFormCargoLoadTon] = useState<string>('');
  const [formNotes, setFormNotes] = useState<string>('');

  // Modern Custom Popover Dropdown & Calendar States
  const [activeModalDropdown, setActiveModalDropdown] = useState<'fleet' | 'driver' | 'helper' | 'area' | 'date' | 'fuel' | 'chart_fleet' | null>(null);
  const [fleetSearchFilter, setFleetSearchFilter] = useState<string>('');
  const [driverSearchFilter, setDriverSearchFilter] = useState<string>('');
  const [helperSearchFilter, setHelperSearchFilter] = useState<string>('');
  const [areaSearchFilter, setAreaSearchFilter] = useState<string>('');
  const [calendarViewMonth, setCalendarViewMonth] = useState<Date>(() => new Date());

  const resolveFleetBranchId = (fleet: Fleet): 'cab-banyuwangi' | 'cab-sidoarjo' => {
    const resolved = branchStore.getFleetBranchId(fleet.id, fleet.plateNumber, fleet.initialCode);
    return resolved === 'cab-sidoarjo' ? 'cab-sidoarjo' : 'cab-banyuwangi';
  };

  const resolveLogBranchId = (log: FuelLog): 'cab-banyuwangi' | 'cab-sidoarjo' => {
    const resolved = log.branchId || branchStore.getFleetBranchId(log.fleetId, log.plateNumber, log.initialCode);
    return resolved === 'cab-sidoarjo' ? 'cab-sidoarjo' : 'cab-banyuwangi';
  };

  // Branch-scoped Fleets & Fuel Logs for Dashboard & Analytics
  const branchScopedFleets = useMemo(() => {
    const ordered = sortFleetsByCanonicalOrder(fleets);
    if (selectedBranchFilter === 'all') return ordered;
    return ordered.filter(f => resolveFleetBranchId(f) === selectedBranchFilter);
  }, [fleets, selectedBranchFilter]);

  const branchScopedLogs = useMemo(() => {
    if (selectedBranchFilter === 'all') return fuelLogs;
    return fuelLogs.filter(l => resolveLogBranchId(l) === selectedBranchFilter);
  }, [fuelLogs, selectedBranchFilter]);

  // Modal Branch-scoped Fleets
  const modalBranchFleets = useMemo(() => {
    return sortFleetsByCanonicalOrder(
      fleets.filter(f => resolveFleetBranchId(f) === formBranchId)
    );
  }, [fleets, formBranchId]);

  const filteredModalFleets = useMemo(() => {
    const q = fleetSearchFilter.trim().toLowerCase();
    if (!q) return modalBranchFleets;
    return modalBranchFleets.filter(f =>
      (f.initialCode || '').toLowerCase().includes(q) ||
      (f.plateNumber || '').toLowerCase().includes(q) ||
      (f.vehicleType || '').toLowerCase().includes(q) ||
      (f.brand || '').toLowerCase().includes(q)
    );
  }, [modalBranchFleets, fleetSearchFilter]);

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

  const filteredAreaOptions = useMemo(() => {
    const q = areaSearchFilter.trim().toLowerCase();
    if (!q) return deliveryAreaOptions;
    return deliveryAreaOptions.filter(a => a.toLowerCase().includes(q));
  }, [deliveryAreaOptions, areaSearchFilter]);

  // Daftar Kru (Driver & Helper) terscoping Cabang + Deduplikasi Spasi (mengatasi Arif Bagus Muhammadiqbal vs Arif Bagus Muhammad Iqbal)
  const crewOptionsForModal = useMemo(() => {
    const map = new Map<string, { id: string; name: string; role: string }>();

    // 1. User Management aktif sesuai cabang terpilih
    try {
      const activeUsers = logisticsStore.getUsers ? logisticsStore.getUsers() : [];
      activeUsers.forEach(u => {
        if (logisticsStore.isActiveDeliveryCrewUser(u, formBranchId) && u.fullName?.trim()) {
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
    } catch {
      // ignore
    }

    // 2. Data master kru cabang terpilih
    crews.forEach(c => {
      if (!c.name || !c.name.trim()) return;
      const cBranch = branchStore.getCrewBranchId(c.id, c.name);
      if (cBranch !== formBranchId) return;
      const cleanName = c.name.trim();
      const cKey = compactPersonKey(cleanName);
      if (cKey && !map.has(cKey)) {
        map.set(cKey, {
          id: c.id,
          name: cleanName,
          role: c.role || 'Driver'
        });
      }
    });

    // 3. Fallback default khusus Nusantara bila belum ada di user/crew
    if (formBranchId === 'cab-banyuwangi') {
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
      defaultDrivers.forEach((name, idx) => {
        const cKey = compactPersonKey(name);
        if (cKey && !map.has(cKey)) {
          map.set(cKey, { id: `drv-${idx + 1}`, name, role: 'Driver' });
        }
      });
    }

    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [crews, formBranchId]);

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

  // Trip route calculator state
  const [calcFleetType, setCalcFleetType] = useState<VehicleType>('Engkel Long');
  const [calcDistanceKm, setCalcDistanceKm] = useState<number>(620);
  const [calcSelectedRoute, setCalcSelectedRoute] = useState<string>('bwi-sby-pp');
  const [calcFuelType, setCalcFuelType] = useState<FuelType>('BioSolar');
  const [calcCustomPrice, setCalcCustomPrice] = useState<number>(STANDARD_FUEL_PRICES['BioSolar'] || 6800);
  const [calcCargoBoxes, setCalcCargoBoxes] = useState<number>(12000);

  useEffect(() => {
    return logisticsStore.subscribe(() => {
      setFuelLogs(logisticsStore.getFuelLogs());
      setFleets(logisticsStore.getFleets());
      setCrews(logisticsStore.getCrews());
    });
  }, []);

  // Reset all fields cleanly before opening Add Fuel modal
  const openAddFuelModal = () => {
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
    setFormCargoLoadTon('');
    setFormNotes('');
    setFleetSearchFilter('');
    setDriverSearchFilter('');
    setHelperSearchFilter('');
    setAreaSearchFilter('');
    setActiveModalDropdown(null);
    setIsGasStationDropdownOpen(false);
    setIsAddModalOpen(true);
  };

  // Populate modal fields for Editing an existing FuelLog
  const openEditFuelModal = (log: FuelLog) => {
    setEditingLogId(log.id);
    setFormBranchId(resolveLogBranchId(log));
    setFormFleetId(log.fleetId || '');
    setFormDriverId(log.driverId || '');
    setFormDriverName(log.driverName || '');
    setFormHelperId(log.helperId || '');
    setFormHelperName(log.helperName || '');
    setFormRouteTrip(log.routeTrip || '');
    setFormDate(log.date || new Date().toISOString().split('T')[0]);
    setFormFuelType(log.fuelType || 'BioSolar');
    setFormCostPerLiter(log.costPerLiter !== undefined ? String(log.costPerLiter) : '6800');
    setFormLiters(String(log.liters || ''));
    setFormStartOdo(String(log.startOdometerKm || ''));
    setFormEndOdo(String(log.endOdometerKm || ''));
    setFormGasStation(log.gasStation || 'SPBU Farly');
    setFormCargoLoadTon(log.cargoLoadTon ? String(log.cargoLoadTon) : '');
    setFormNotes(log.notes || '');
    setFleetSearchFilter('');
    setDriverSearchFilter('');
    setHelperSearchFilter('');
    setAreaSearchFilter('');
    setActiveModalDropdown(null);
    setIsGasStationDropdownOpen(false);
    setIsAddModalOpen(true);
  };

  // Autofill Kilometer Awal (KM) from the latest Kilometer Isi (endOdometerKm) of the fleet across ANY SPBU
  const handleFleetSelection = (fleetId: string) => {
    setFormFleetId(fleetId);
    const flt = fleets.find(f => f.id === fleetId);
    if (flt) {
      const targetPlateClean = (flt.plateNumber || '').replace(/\s+/g, '').toUpperCase();
      const matchingLogs = fuelLogs
        .filter(l => {
          if (editingLogId && l.id === editingLogId) return false;
          const logPlateClean = (l.plateNumber || '').replace(/\s+/g, '').toUpperCase();
          return l.fleetId === flt.id || (targetPlateClean && logPlateClean === targetPlateClean);
        })
        .sort((a, b) => {
          const dateDiff = (b.date || '').localeCompare(a.date || '');
          if (dateDiff !== 0) return dateDiff;
          const createdDiff = (b.createdAt || '').localeCompare(a.createdAt || '');
          if (createdDiff !== 0) return createdDiff;
          return (b.endOdometerKm || 0) - (a.endOdometerKm || 0);
        });

      const latestFleetLog = matchingLogs[0];
      if (!editingLogId) {
        if (latestFleetLog && latestFleetLog.endOdometerKm > 0) {
          setFormStartOdo(String(latestFleetLog.endOdometerKm));
        } else {
          setFormStartOdo('');
        }
      }

      if (!formDriverName) {
        const assignedCrew = crews.find(
          c => c.currentFleetId === flt.id && branchStore.getCrewBranchId(c.id, c.name) === formBranchId
        );
        if (assignedCrew) {
          setFormDriverName(assignedCrew.name);
          setFormDriverId(assignedCrew.id);
        }
      }
    }
  };

  // When fuel type changes in form (BioSolar fixed default 6800, others update if still empty or default)
  const handleFuelTypeChange = (type: FuelType) => {
    setFormFuelType(type);
    if (!formCostPerLiter.trim()) {
      setFormCostPerLiter(String(STANDARD_FUEL_PRICES[type] || 6800));
    }
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
      liters: Number(formLiters),
      costPerLiter: Number(formCostPerLiter) || 6800,
      startOdometerKm: startKm,
      endOdometerKm: endKm,
      gasStation: formGasStation,
      routeTrip: formRouteTrip || undefined,
      cargoLoadTon: formCargoLoadTon ? Number(formCargoLoadTon) : undefined,
      notes: formNotes || undefined
    };

    if (editingLogId) {
      logisticsStore.updateFuelLog(editingLogId, payload);
    } else {
      logisticsStore.addFuelLog(payload);
    }

    setIsAddModalOpen(false);
    setEditingLogId(null);
    setFormLiters('');
    setFormCostPerLiter('6800');
    setFormStartOdo('');
    setFormEndOdo('');
    setFormDriverId('');
    setFormDriverName('');
    setFormHelperId('');
    setFormHelperName('');
    setFormNotes('');
    setFormRouteTrip('');
    setFormCargoLoadTon('');
  };

  // Branch-scoped Fleet Summaries
  const fleetSummaries: FleetFuelSummary[] = useMemo(() => {
    return branchScopedFleets.map(fleet => {
      const logs = branchScopedLogs.filter(
        l => l.fleetId === fleet.id || (l.plateNumber && l.plateNumber.toUpperCase() === fleet.plateNumber.toUpperCase())
      );
      const totalLogs = logs.length;
      const totalLiters = logs.reduce((acc, l) => acc + l.liters, 0);
      const totalCost = logs.reduce((acc, l) => acc + l.totalCost, 0);
      const totalDistanceKm = logs.reduce((acc, l) => acc + l.distanceKm, 0);

      const targetConfig = FUEL_TARGET_RATIOS[fleet.vehicleType] || { target: 7.5, minAcceptable: 6.4, label: '7.5 KM / L' };
      const targetRatio = targetConfig.target;
      const avgKmPerLiter = totalLiters > 0 && totalDistanceKm > 0 ? Number((totalDistanceKm / totalLiters).toFixed(2)) : 0;
      const avgLiterPerKm = totalDistanceKm > 0 && totalLiters > 0 ? Number((totalLiters / totalDistanceKm).toFixed(4)) : 0;
      const avgLiterPer100Km = totalDistanceKm > 0 && totalLiters > 0 ? Number(((totalLiters / totalDistanceKm) * 100).toFixed(2)) : 0;
      const targetLiterPerKm = targetRatio > 0 ? Number((1 / targetRatio).toFixed(4)) : 0;
      const targetLiterPer100Km = targetRatio > 0 ? Number((100 / targetRatio).toFixed(2)) : 0;

      const avgCostPerKm = totalDistanceKm > 0 ? Math.round(totalCost / totalDistanceKm) : 0;
      const efficiencyScore = totalDistanceKm > 0 && targetRatio > 0 ? Math.round((avgKmPerLiter / targetRatio) * 100) : 0;
      const anomaliesCount = logs.filter(l => l.efficiencyStatus === 'Boros' || l.efficiencyStatus === 'Kritis / Potensi Anomali').length;

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
  }, [branchScopedFleets, branchScopedLogs]);

  // Branch-scoped Driver Eco Scores (deduplicated by space-collapsed key so Arif Bagus never splits)
  const driverScores: DriverFuelScore[] = useMemo(() => {
    const driverMap = new Map<string, { driverId: string; driverName: string; logs: FuelLog[] }>();
    branchScopedLogs.forEach(log => {
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

      const avgEfficiencyRatio = item.logs.reduce((acc, l) => acc + (l.ratioKmPerLiter / (l.targetRatio || 7.5)), 0) / (totalTrips || 1);
      const ecoDrivingScore = Math.min(100, Math.max(40, Math.round(avgEfficiencyRatio * 90)));

      let badge: 'Master Eco-Driver' | 'Driver Efisien' | 'Perlu Pembinaan' = 'Driver Efisien';
      let recommendation = 'Menjaga kecepatan stabil dan pola perpindahan gigi yang tepat.';

      if (ecoDrivingScore >= 90) {
        badge = 'Master Eco-Driver';
        recommendation = 'Pengemudi teladan dengan akselerasi halus, pengereman terencana, dan efisiensi BBM prima.';
      } else if (ecoDrivingScore < 75) {
        badge = 'Perlu Pembinaan';
        recommendation = 'Perlu evaluasi pola idling berlebih saat antre muat dan hindari akselerasi agresif di tanjakan.';
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
  }, [branchScopedLogs]);

  // Branch-scoped KPI Summary
  const kpiSummary = useMemo(() => {
    const totalLiters = branchScopedLogs.reduce((acc, l) => acc + l.liters, 0);
    const totalCost = branchScopedLogs.reduce((acc, l) => acc + l.totalCost, 0);
    const totalDistanceKm = branchScopedLogs.reduce((acc, l) => acc + l.distanceKm, 0);
    const overallAvgKmPerLiter = totalLiters > 0 ? Number((totalDistanceKm / totalLiters).toFixed(2)) : 0;
    const overallAvgLiterPerKm = totalDistanceKm > 0 ? Number((totalLiters / totalDistanceKm).toFixed(4)) : 0;
    const overallAvgLiterPer100Km = totalDistanceKm > 0 ? Number(((totalLiters / totalDistanceKm) * 100).toFixed(2)) : 0;
    const overallAvgCostPerKm = totalDistanceKm > 0 ? Math.round(totalCost / totalDistanceKm) : 0;
    const totalAnomalies = branchScopedLogs.filter(
      l => l.efficiencyStatus === 'Boros' || l.efficiencyStatus === 'Kritis / Potensi Anomali'
    ).length;

    const activeFleets = fleetSummaries.filter(f => f.totalLogs > 0);
    const sortedFleets = [...(activeFleets.length > 0 ? activeFleets : fleetSummaries)].sort(
      (a, b) => b.efficiencyScore - a.efficiencyScore
    );
    const topFleet = sortedFleets[0];
    const leastFleet = sortedFleets[sortedFleets.length - 1];
    const topDriver = driverScores[0];

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
      topDriver,
      totalRecords: branchScopedLogs.length
    };
  }, [branchScopedLogs, fleetSummaries, driverScores]);

  // Chart Data: Timeline fuel consumption
  const timelineChartData = useMemo(() => {
    const map = new Map<string, { date: string; liters: number; distance: number }>();
    const sorted = [...branchScopedLogs].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    sorted.forEach(l => {
      if (!map.has(l.date)) {
        map.set(l.date, { date: l.date.substring(5), liters: 0, distance: 0 });
      }
      const item = map.get(l.date)!;
      item.liters += l.liters;
      item.distance += l.distanceKm;
    });
    return Array.from(map.values()).slice(-7);
  }, [branchScopedLogs]);

  // Unit Vehicles L/KM Calculation and In-depth Analysis
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

      const unitLogs = branchScopedLogs.filter(
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
  }, [fleetSummaries, branchScopedLogs, lKmSearch, lKmSortBy]);

  // Chart data for comparing Liter per KM vs Target L/KM
  const lKmComparisonChartData = useMemo(() => {
    const orderedSummaries = [...fleetSummaries].sort(
      (a, b) => getCanonicalFleetOrderIndex(a.initialCode || a.plateNumber) - getCanonicalFleetOrderIndex(b.initialCode || b.plateNumber)
    );
    const mapped = orderedSummaries.map(fs => {
      const hasData = fs.totalDistanceKm > 0 && fs.totalLiters > 0;
      const avgLKm = hasData ? Number((fs.totalLiters / fs.totalDistanceKm).toFixed(4)) : 0;
      const targetLKm = hasData && fs.targetRatio > 0 ? Number((1 / fs.targetRatio).toFixed(4)) : 0;
      const unitLogs = branchScopedLogs.filter(
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
  }, [fleetSummaries, branchScopedLogs, comparisonSelectedFleetId]);

  // Filtered & Sorted Fuel Logs
  const filteredLogs = useMemo(() => {
    const list = branchScopedLogs.filter(log => {
      const q = searchQuery.toLowerCase();
      const matchQuery =
        !searchQuery ||
        log.plateNumber.toLowerCase().includes(q) ||
        (log.initialCode && log.initialCode.toLowerCase().includes(q)) ||
        log.driverName.toLowerCase().includes(q) ||
        (log.helperName && log.helperName.toLowerCase().includes(q)) ||
        log.gasStation.toLowerCase().includes(q) ||
        (log.routeTrip && log.routeTrip.toLowerCase().includes(q));

      const matchFleet = filterFleetId === 'all' || log.fleetId === filterFleetId;
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

      return matchQuery && matchFleet && matchStatus && matchFuel && matchSpbu;
    });

    if (logSortBy === 'efficient_asc') {
      return [...list].sort((a, b) => b.ratioKmPerLiter - a.ratioKmPerLiter);
    }
    if (logSortBy === 'wasteful_desc') {
      return [...list].sort((a, b) => a.ratioKmPerLiter - b.ratioKmPerLiter);
    }
    return [...list].sort((a, b) => (b.date || '').localeCompare(a.date || '') || (b.createdAt || '').localeCompare(a.createdAt || ''));
  }, [branchScopedLogs, searchQuery, filterFleetId, filterStatus, filterFuelType, filterSpbu, logSortBy]);

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
      'Cabang',
      'Plat Nomor',
      'Inisial',
      'Tipe Kendaraan',
      'Driver',
      'Helper',
      'Jenis BBM',
      'Liter',
      'Harga/L',
      'Total Biaya (Rp)',
      'KM Awal',
      'KM Isi',
      'Jarak (KM)',
      'Rasio (KM/L)',
      'Standar Target',
      'Status Efisiensi',
      'SPBU',
      'Rute Perjalanan',
      'Catatan'
    ];

    const rows = filteredLogs.map(l => {
      const bId = l.branchId || branchStore.getFleetBranchId(l.fleetId, l.plateNumber, l.initialCode);
      const bLabel = bId === 'cab-sidoarjo' ? 'Cabang Sidoarjo' : 'Cabang Nusantara';
      return [
        l.id,
        l.date,
        bLabel,
        l.plateNumber,
        l.initialCode || '-',
        l.vehicleType,
        l.driverName,
        l.helperName || '-',
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
        `"${l.routeTrip || '-'}"`,
        `"${l.notes || '-'}"`
      ];
    });

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
    <div className="space-y-4">
      {/* ========================================================================= */}
      {/* 1. TOP HEADER, CABANG SWITCHER & COMPACT KPI SUMMARY                      */}
      {/* ========================================================================= */}
      <div className="bg-slate-900/90 border border-slate-800/80 rounded-2xl p-3.5 shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-400 shrink-0">
                <Fuel className="w-5 h-5" />
              </div>
              <div>
                <h1 className="text-base sm:text-lg font-bold text-white tracking-tight">
                  Efisiensi BBM Armada
                </h1>
                <p className="text-[11px] text-slate-400">
                  Rasio KM/L, L/KM &amp; audit BBM terbagi per cabang
                </p>
              </div>
            </div>

            {/* Pembagian Cabang (Nusantara vs Sidoarjo) */}
            <div className="inline-flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800">
              <Building2 className="w-3.5 h-3.5 text-amber-400 ml-1.5 mr-0.5 shrink-0" />
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
                  }}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition cursor-pointer ${
                    selectedBranchFilter === br.id
                      ? 'bg-amber-500 text-slate-950 shadow-xs'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {br.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={openAddFuelModal}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs transition cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Catat BBM</span>
            </button>

            <button
              type="button"
              onClick={() => setIsExportModalOpen(true)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition cursor-pointer"
              title="Export Laporan Konsumsi BBM (PDF / Excel)"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span>Export Laporan</span>
            </button>

            <button
              type="button"
              onClick={() => setIsCalculatorModalOpen(true)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold transition cursor-pointer"
            >
              <Calculator className="w-3.5 h-3.5 text-amber-400" />
              <span>Kalkulator</span>
            </button>

            <button
              type="button"
              onClick={handleExportCSV}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold transition cursor-pointer"
              title="Ekspor Data Rekap ke CSV"
            >
              <Download className="w-3.5 h-3.5 text-emerald-400" />
              <span>CSV</span>
            </button>
          </div>
        </div>

        {/* 5 PRIMARY METRICS ROW (COMPACT) */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2.5 pt-3.5 mt-3.5 border-t border-slate-800/70">
          <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800">
            <div className="flex items-center justify-between text-slate-400 text-[11px] mb-0.5">
              <span className="font-semibold">Rata-rata Rasio</span>
              <Gauge className="w-3.5 h-3.5 text-blue-400" />
            </div>
            <div className="flex items-baseline gap-1">
              <span className="text-xl font-black text-white font-mono">
                {kpiSummary.overallAvgKmPerLiter}
              </span>
              <span className="text-[11px] text-slate-400 font-bold">KM / L</span>
            </div>
            <div className="text-[10px] text-emerald-400 mt-0.5 flex items-center gap-1 font-medium">
              <CheckCircle2 className="w-3 h-3" />
              <span>Target: 7.5 KM/L</span>
            </div>
          </div>

          <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800 ring-1 ring-amber-500/20">
            <div className="flex items-center justify-between text-slate-400 text-[11px] mb-0.5">
              <span className="font-semibold text-amber-300">Rata-rata Liter / KM</span>
              <Activity className="w-3.5 h-3.5 text-amber-400" />
            </div>
            <div className="flex items-baseline gap-1">
              <span className="text-xl font-black text-amber-400 font-mono">
                {kpiSummary.overallAvgLiterPerKm || 0}
              </span>
              <span className="text-[11px] text-amber-300/80 font-bold">L / KM</span>
            </div>
            <div className="text-[10px] text-slate-300 mt-0.5 font-mono">
              {kpiSummary.overallAvgLiterPer100Km || 0} L/100 KM
            </div>
          </div>

          <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800">
            <div className="flex items-center justify-between text-slate-400 text-[11px] mb-0.5">
              <span className="font-semibold">Total BBM Terdata</span>
              <Fuel className="w-3.5 h-3.5 text-amber-400" />
            </div>
            <div className="flex items-baseline gap-1">
              <span className="text-xl font-black text-white font-mono">
                {kpiSummary.totalLiters.toLocaleString('id-ID')}
              </span>
              <span className="text-[11px] text-slate-400 font-bold">Liter</span>
            </div>
            <div className="text-[10px] text-slate-400 mt-0.5">
              Jarak: <span className="font-bold text-slate-300">{kpiSummary.totalDistanceKm.toLocaleString('id-ID')} KM</span>
            </div>
          </div>

          <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800">
            <div className="flex items-center justify-between text-slate-400 text-[11px] mb-0.5">
              <span className="font-semibold">Total Pengeluaran</span>
              <DollarSign className="w-3.5 h-3.5 text-emerald-400" />
            </div>
            <div className="text-xl font-black text-white font-mono">
              Rp {(kpiSummary.totalCost / 1000000).toFixed(2)} <span className="text-[11px] font-normal text-slate-400">Juta</span>
            </div>
            <div className="text-[10px] text-slate-400 mt-0.5">
              Rata-rata: <span className="font-bold text-emerald-400">Rp {kpiSummary.overallAvgCostPerKm.toLocaleString('id-ID')}/KM</span>
            </div>
          </div>

          <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800">
            <div className="flex items-center justify-between text-slate-400 text-[11px] mb-0.5">
              <span className="font-semibold">Anomali / Perlu Cek</span>
              <AlertTriangle className={`w-3.5 h-3.5 ${kpiSummary.totalAnomalies > 0 ? 'text-rose-400' : 'text-emerald-400'}`} />
            </div>
            <div className="flex items-baseline gap-1">
              <span className={`text-xl font-black font-mono ${kpiSummary.totalAnomalies > 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
                {kpiSummary.totalAnomalies}
              </span>
              <span className="text-[11px] text-slate-400 font-bold">Log</span>
            </div>
            <div className="text-[10px] text-rose-300 mt-0.5 truncate">
              {kpiSummary.leastFleet ? (
                <span>Truk {kpiSummary.leastFleet.initialCode || kpiSummary.leastFleet.plateNumber} ({kpiSummary.leastFleet.avgKmPerLiter} KM/L)</span>
              ) : 'Semua armada efisien'}
            </div>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 2. TAB CONTROLS (WRAP RINGKAS, TANPA DAILY & CALCULATOR TAB)              */}
      {/* ========================================================================= */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-800 pb-2.5">
        <button
          type="button"
          onClick={() => setActiveTab('overview')}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition cursor-pointer whitespace-nowrap ${
            activeTab === 'overview'
              ? 'bg-amber-500 text-slate-950 shadow-md'
              : 'bg-slate-900 text-slate-300 hover:bg-slate-800 border border-slate-800'
          }`}
        >
          <TrendingUp className="w-3.5 h-3.5" />
          <span>Analisis Efisiensi</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('liter_km')}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition cursor-pointer whitespace-nowrap ${
            activeTab === 'liter_km'
              ? 'bg-amber-500 text-slate-950 shadow-md'
              : 'bg-slate-900 text-slate-300 hover:bg-slate-800 border border-slate-800'
          }`}
        >
          <Gauge className="w-3.5 h-3.5" />
          <span>Liter/KM Kendaraan</span>
          <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-slate-950/40 text-current">
            {fleetSummaries.length} Unit
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('weekly_report')}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition cursor-pointer whitespace-nowrap ${
            activeTab === 'weekly_report'
              ? 'bg-amber-500 text-slate-950 shadow-md'
              : 'bg-slate-900 text-slate-300 hover:bg-slate-800 border border-slate-800'
          }`}
        >
          <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
          <span>Rekap Mingguan</span>
          <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
            PDF/Excel
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('leaderboard')}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition cursor-pointer whitespace-nowrap ${
            activeTab === 'leaderboard'
              ? 'bg-amber-500 text-slate-950 shadow-md'
              : 'bg-slate-900 text-slate-300 hover:bg-slate-800 border border-slate-800'
          }`}
        >
          <Award className="w-3.5 h-3.5" />
          <span>Eco-Driver</span>
          <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-slate-950/40 text-current">
            {driverScores.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('logs')}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition cursor-pointer whitespace-nowrap ${
            activeTab === 'logs'
              ? 'bg-amber-500 text-slate-950 shadow-md'
              : 'bg-slate-900 text-slate-300 hover:bg-slate-800 border border-slate-800'
          }`}
        >
          <FileText className="w-3.5 h-3.5" />
          <span>Audit Riwayat BBM</span>
          <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-slate-950/40 text-current">
            {branchScopedLogs.length}
          </span>
        </button>
      </div>

      {/* ========================================================================= */}
      {/* 3. TAB 1: OVERVIEW & CHARTS                                               */}
      {/* ========================================================================= */}
      {activeTab === 'overview' && (
        <div className="space-y-4">
          {/* ANOMALY ALERT BANNER IF APPLICABLE */}
          {kpiSummary.totalAnomalies > 0 && (
            <div className="bg-rose-500/10 border border-rose-500/30 rounded-2xl p-3.5 flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div className="flex items-start gap-2.5">
                <div className="p-2 bg-rose-500/20 text-rose-400 rounded-xl mt-0.5">
                  <AlertTriangle className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-rose-300">
                    Peringatan Anomali Konsumsi BBM Terdeteksi ({kpiSummary.totalAnomalies} Catatan)
                  </h4>
                  <p className="text-[11px] text-slate-300 mt-0.5 leading-relaxed">
                    Terdapat armada dengan rasio konsumsi jauh di bawah target efisiensi pabrik. Mohon periksa kondisi nozzle injektor, filter solar, atau durasi idling mesin.
                  </p>
                </div>
              </div>
              <button
                type="button"
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
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
            {Object.entries(FUEL_TARGET_RATIOS).map(([vType, cfg]) => (
              <div key={vType} className="bg-slate-900/80 p-2.5 rounded-xl border border-slate-800">
                <div className="text-[11px] text-slate-400 font-semibold">{vType}</div>
                <div className="text-base font-black text-amber-400 font-mono">{cfg.label}</div>
                <div className="text-[10px] text-slate-400">Batas Wajar Min: {cfg.minAcceptable} KM/L</div>
              </div>
            ))}
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
                        ? (branchScopedLogs.length > 0 ? 0.1333 : 0)
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
      {/* 4. TAB: RATA-RATA LITER PER KILOMETER (L/KM) TIAP UNIT KENDARAAN          */}
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
      {/* 5. TAB: AUDIT LOGS & TABLE (FILTER SPBU, SORT TEREFISIEN-BOROS, EDIT)     */}
      {/* ========================================================================= */}
      {activeTab === 'logs' && (
        <div className="space-y-4">
          {/* FILTER AND SEARCH CONTROLS */}
          <div className="bg-slate-900/80 p-3.5 rounded-2xl border border-slate-800 flex flex-col lg:flex-row lg:items-center justify-between gap-2.5">
            <div className="relative w-full lg:w-72">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Cari plat, inisial, driver, helper, SPBU..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto">
              <select
                value={filterFleetId}
                onChange={(e) => setFilterFleetId(e.target.value)}
                className="bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-2 text-xs text-slate-200 focus:outline-none focus:border-amber-500"
              >
                <option value="all">Semua Armada ({branchScopedFleets.length})</option>
                {branchScopedFleets.map(f => (
                  <option key={f.id} value={f.id}>{f.initialCode || f.plateNumber} ({f.plateNumber})</option>
                ))}
              </select>

              <select
                value={filterSpbu}
                onChange={(e) => setFilterSpbu(e.target.value as any)}
                className="bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-2 text-xs text-slate-200 focus:outline-none focus:border-amber-500"
              >
                <option value="all">Semua SPBU</option>
                <option value="Farly">SPBU Farly</option>
                <option value="Gajah Mada">SPBU Gajah Mada</option>
                <option value="SPBU Lain">SPBU Lain (Urgent)</option>
              </select>

              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-2 text-xs text-slate-200 focus:outline-none focus:border-amber-500"
              >
                <option value="all">Semua Status</option>
                <option value="Sangat Efisien">Sangat Efisien</option>
                <option value="Efisien / Normal">Efisien / Normal</option>
                <option value="Boros">Boros</option>
                <option value="Kritis / Potensi Anomali">Kritis / Potensi Anomali</option>
              </select>

              <select
                value={filterFuelType}
                onChange={(e) => setFilterFuelType(e.target.value)}
                className="bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-2 text-xs text-slate-200 focus:outline-none focus:border-amber-500"
              >
                <option value="all">Semua BBM</option>
                <option value="BioSolar">BioSolar</option>
                <option value="Dexlite">Dexlite</option>
                <option value="Pertamina Dex">Pertamina Dex</option>
                <option value="Pertalite">Pertalite</option>
              </select>

              <select
                value={logSortBy}
                onChange={(e) => setLogSortBy(e.target.value as any)}
                className="bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-2 text-xs text-amber-300 font-semibold focus:outline-none focus:border-amber-500"
              >
                <option value="date_desc">Urut: Terbaru</option>
                <option value="efficient_asc">Terefisien &rarr; Paling Boros</option>
                <option value="wasteful_desc">Paling Boros &rarr; Terefisien</option>
              </select>

              {(searchQuery || filterFleetId !== 'all' || filterSpbu !== 'all' || filterStatus !== 'all' || filterFuelType !== 'all' || logSortBy !== 'date_desc') && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery('');
                    setFilterFleetId('all');
                    setFilterSpbu('all');
                    setFilterStatus('all');
                    setFilterFuelType('all');
                    setLogSortBy('date_desc');
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
                    <th className="px-4 py-3">Tanggal &amp; Armada</th>
                    <th className="px-4 py-3">Kru (Driver / Helper) &amp; Rute</th>
                    <th className="px-4 py-3">BBM &amp; Biaya</th>
                    <th className="px-4 py-3">KM Awal / Isi</th>
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
                      const logBranchId = resolveLogBranchId(log);

                      return (
                        <tr key={log.id} className="hover:bg-slate-800/40 transition">
                          <td className="px-4 py-3 whitespace-nowrap">
                            <div className="flex items-center gap-1.5">
                              <span className="font-semibold text-white">{log.date}</span>
                              <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold border ${
                                logBranchId === 'cab-sidoarjo'
                                  ? 'bg-cyan-500/10 text-cyan-300 border-cyan-500/30'
                                  : 'bg-amber-500/10 text-amber-300 border-amber-500/30'
                              }`}>
                                {logBranchId === 'cab-sidoarjo' ? 'Sidoarjo' : 'Nusantara'}
                              </span>
                            </div>
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
                            {log.helperName && (
                              <div className="text-[10px] text-amber-300 mt-0.5">
                                Helper: {log.helperName}
                              </div>
                            )}
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
                            <div>Awal: {log.startOdometerKm.toLocaleString('id-ID')} KM</div>
                            <div className="text-amber-300">Isi: {log.endOdometerKm.toLocaleString('id-ID')} KM</div>
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

                          <td className="px-4 py-3 text-right whitespace-nowrap space-x-1.5">
                            <button
                              type="button"
                              onClick={() => openEditFuelModal(log)}
                              className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-amber-500/15 hover:bg-amber-500 text-amber-300 hover:text-slate-950 font-semibold text-[11px] transition cursor-pointer"
                            >
                              <Edit className="w-3 h-3" />
                              <span>Edit</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => setSelectedLogForDetail(log)}
                              className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white font-semibold text-[11px] transition cursor-pointer"
                            >
                              Detail
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                logisticsStore.deleteFuelLog(log.id);
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
      {/* 6. POPUP MODAL: KALKULATOR ESTIMASI KEBUTUHAN & BIAYA BBM RUTE            */}
      {/* ========================================================================= */}
      {isCalculatorModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-4xl overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-200 my-6">
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-800 bg-slate-950/80">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-amber-500/15 text-amber-400 border border-amber-500/30">
                  <Calculator className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">
                    Kalkulator Estimasi Kebutuhan &amp; Biaya BBM Rute
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Hitung estimasi solar, biaya operasional per KM/box, dan konversi KM/L &harr; L/KM.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsCalculatorModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 grid grid-cols-1 lg:grid-cols-2 gap-6 max-h-[82vh] overflow-y-auto">
              {/* INPUT CONTROLS */}
              <div className="space-y-3.5">
                <h4 className="text-xs font-bold text-amber-400 flex items-center gap-2">
                  <Settings className="w-4 h-4" />
                  <span>Parameter Pengiriman &amp; Rute</span>
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
                    Preset Rute Distribusi
                  </label>
                  <select
                    value={calcSelectedRoute}
                    onChange={(e) => handlePresetRouteChange(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:border-amber-500"
                  >
                    <option value="bwi-sby-pp">Banyuwangi &harr; Surabaya Hub (620 KM PP)</option>
                    <option value="bwi-mlg-pp">Banyuwangi &harr; Malang Raya (560 KM PP)</option>
                    <option value="bwi-jbr-pp">Banyuwangi &harr; Jember &amp; Lumajang (210 KM PP)</option>
                    <option value="bwi-dps-pp">Banyuwangi &harr; Denpasar Bali (340 KM PP)</option>
                    <option value="bwi-solo-pp">Banyuwangi &harr; Solo / Yogyakarta (820 KM PP)</option>
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
              <div className="bg-slate-950/80 p-4 rounded-2xl border border-slate-800/90 flex flex-col justify-between space-y-3">
                <div>
                  <div className="flex items-center justify-between pb-2.5 border-b border-slate-800 mb-3">
                    <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                      Hasil Kalkulasi Estimasi
                    </span>
                    <span className="text-[11px] font-bold text-amber-400 bg-amber-500/15 px-2 py-0.5 rounded-full border border-amber-500/30">
                      Standar: {calcOutput.target} KM/L
                    </span>
                  </div>

                  <div className="space-y-3">
                    <div className="bg-slate-900/90 p-3 rounded-xl border border-slate-800">
                      <div className="text-[11px] text-slate-400">Total Kebutuhan Bahan Bakar:</div>
                      <div className="text-2xl font-black text-amber-400 font-mono mt-0.5">
                        {calcOutput.estLiters} <span className="text-xs text-slate-400 font-bold">Liter {calcFuelType}</span>
                      </div>
                    </div>

                    <div className="bg-slate-900/90 p-3 rounded-xl border border-slate-800">
                      <div className="text-[11px] text-slate-400">Estimasi Total Biaya BBM:</div>
                      <div className="text-2xl font-black text-emerald-400 font-mono mt-0.5">
                        Rp {calcOutput.estTotalCost.toLocaleString('id-ID')}
                      </div>
                      <div className="text-[11px] text-slate-400 mt-0.5">
                        Biaya per KM: <strong className="text-slate-200">Rp {calcOutput.costPerKm.toLocaleString('id-ID')}/KM</strong>
                      </div>
                    </div>

                    <div className="p-2.5 rounded-xl bg-blue-500/10 border border-blue-500/25 flex items-center justify-between">
                      <div>
                        <div className="text-[11px] font-semibold text-blue-300">Biaya BBM Per Box:</div>
                        <div className="text-[10px] text-slate-400">Muatan {calcCargoBoxes.toLocaleString('id-ID')} pcs</div>
                      </div>
                      <div className="text-lg font-black text-blue-400 font-mono">
                        Rp {calcOutput.costPerBox} <span className="text-[10px] text-slate-400">/ pcs</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="pt-2.5 border-t border-slate-800 text-[10px] text-slate-400 flex items-center gap-2">
                  <Info className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  <span>Gunakan estimasi ini sebagai acuan uang saku BBM operasional sebelum keberangkatan.</span>
                </div>
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
          fuelLogs={branchScopedLogs}
          onOpenExportModal={() => setIsExportModalOpen(true)}
        />
      )}

      {/* ========================================================================= */}
      {/* 7. MODAL: CATAT / EDIT PENGISIAN BBM                                      */}
      {/* ========================================================================= */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-3xl overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-200 my-6">
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-800 bg-slate-950/70">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-amber-500/15 text-amber-400">
                  <Fuel className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">
                    {editingLogId ? 'Edit Catatan Pengisian BBM' : 'Catat Pengisian Bahan Bakar Baru'}
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Entri data pengisian BBM cabang, driver, helper &amp; kilometer armada.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveFuelLog} className="p-5 space-y-4 max-h-[82vh] overflow-y-auto">
              {/* Filter Cabang Modal */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-2.5 rounded-xl bg-slate-950/80 border border-slate-800">
                <div className="flex items-center gap-2 text-xs text-slate-300 font-semibold">
                  <Building2 className="w-4 h-4 text-amber-400" />
                  <span>Cabang Operasional (Kru &amp; Armada):</span>
                </div>
                <div className="inline-flex items-center gap-1 bg-slate-900 p-1 rounded-lg border border-slate-800">
                  {([
                    { id: 'cab-banyuwangi', label: 'Cabang Nusantara' },
                    { id: 'cab-sidoarjo', label: 'Cabang Sidoarjo' }
                  ] as const).map(b => (
                    <button
                      key={b.id}
                      type="button"
                      onClick={() => {
                        if (formBranchId === b.id) return;
                        setFormBranchId(b.id);
                        if (!editingLogId) {
                          setFormFleetId('');
                          setFormDriverId('');
                          setFormDriverName('');
                          setFormHelperId('');
                          setFormHelperName('');
                          setFormStartOdo('');
                        }
                        setFleetSearchFilter('');
                        setDriverSearchFilter('');
                        setHelperSearchFilter('');
                      }}
                      className={`px-3 py-1 rounded-md text-xs font-bold transition cursor-pointer ${
                        formBranchId === b.id
                          ? 'bg-amber-500 text-slate-950 shadow-xs'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      {b.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {/* 1. Custom Searchable Dropdown: Armada Truk (Ketik + Enter) */}
                <div className="relative">
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Armada Truk <span className="text-rose-400">*</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setActiveModalDropdown(activeModalDropdown === 'fleet' ? null : 'fleet');
                      setFleetSearchFilter('');
                    }}
                    className={`w-full bg-slate-950/90 hover:bg-slate-900 border ${
                      activeModalDropdown === 'fleet' ? 'border-amber-500 ring-2 ring-amber-500/20' : 'border-slate-800 hover:border-slate-700'
                    } rounded-xl px-3 py-2 text-xs text-left flex items-center justify-between gap-2 transition cursor-pointer shadow-inner`}
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
                    <div className="absolute left-0 right-0 top-full mt-1.5 z-50 bg-slate-900/95 backdrop-blur-xl border border-slate-700/90 rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150 min-w-[230px]">
                      <div className="p-2 bg-slate-950/90 border-b border-slate-800">
                        <div className="relative">
                          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                          <input
                            type="text"
                            autoFocus
                            value={fleetSearchFilter}
                            onChange={(e) => setFleetSearchFilter(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                if (filteredModalFleets.length > 0) {
                                  handleFleetSelection(filteredModalFleets[0].id);
                                  setActiveModalDropdown(null);
                                }
                              } else if (e.key === 'Escape') {
                                setActiveModalDropdown(null);
                              }
                            }}
                            placeholder="Ketik inisial / plat lalu Enter..."
                            className="w-full bg-slate-900 border border-slate-700/80 rounded-lg pl-8 pr-2.5 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
                          />
                        </div>
                      </div>
                      <div className="max-h-56 overflow-y-auto divide-y divide-slate-800/60">
                        {filteredModalFleets.length === 0 ? (
                          <div className="p-3 text-center text-[11px] text-slate-400">Armada cabang tidak ditemukan</div>
                        ) : (
                          filteredModalFleets.map(f => {
                            const isSelected = formFleetId === f.id;
                            return (
                              <button
                                key={f.id}
                                type="button"
                                onClick={() => {
                                  handleFleetSelection(f.id);
                                  setActiveModalDropdown(null);
                                }}
                                className={`w-full px-3 py-2 text-left flex items-center justify-between gap-2 transition cursor-pointer ${
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
                          })
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* 2. Custom Dropdown: Nama Driver (Ketik + Enter) */}
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
                    } rounded-xl px-3 py-2 text-xs text-left flex items-center justify-between gap-2 transition cursor-pointer shadow-inner`}
                  >
                    <span className="flex items-center gap-2 min-w-0">
                      <span className="w-6 h-6 rounded-lg bg-sky-500/15 border border-sky-500/30 flex items-center justify-center text-sky-400 shrink-0">
                        <User className="w-3.5 h-3.5" />
                      </span>
                      {formDriverName ? (
                        <span className="truncate font-bold text-white">{formDriverName}</span>
                      ) : (
                        <span className="text-slate-400">-- Pilih Driver --</span>
                      )}
                    </span>
                    <ChevronDown className={`w-4 h-4 text-slate-400 shrink-0 transition-transform duration-200 ${activeModalDropdown === 'driver' ? 'rotate-180 text-amber-400' : ''}`} />
                  </button>

                  {activeModalDropdown === 'driver' && (
                    <div className="absolute left-0 right-0 top-full mt-1.5 z-50 bg-slate-900/95 backdrop-blur-xl border border-slate-700/90 rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150 min-w-[220px]">
                      <div className="p-2 bg-slate-950/90 border-b border-slate-800">
                        <div className="relative">
                          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                          <input
                            type="text"
                            autoFocus
                            value={driverSearchFilter}
                            onChange={(e) => setDriverSearchFilter(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                if (filteredDriverOptions.length > 0) {
                                  setFormDriverName(filteredDriverOptions[0].name);
                                  setFormDriverId(filteredDriverOptions[0].id);
                                  setActiveModalDropdown(null);
                                }
                              } else if (e.key === 'Escape') {
                                setActiveModalDropdown(null);
                              }
                            }}
                            placeholder="Ketik nama lalu Enter..."
                            className="w-full bg-slate-900 border border-slate-700/80 rounded-lg pl-8 pr-2.5 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
                          />
                        </div>
                      </div>
                      <div className="max-h-56 overflow-y-auto divide-y divide-slate-800/60">
                        {filteredDriverOptions.map(d => {
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
                              {isSelected && (
                                <Check className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>

                {/* 3. Custom Dropdown: Nama Helper (Ketik + Enter) */}
                <div className="relative">
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Nama Helper
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setActiveModalDropdown(activeModalDropdown === 'helper' ? null : 'helper');
                      setHelperSearchFilter('');
                    }}
                    className={`w-full bg-slate-950/90 hover:bg-slate-900 border ${
                      activeModalDropdown === 'helper' ? 'border-amber-500 ring-2 ring-amber-500/20' : 'border-slate-800 hover:border-slate-700'
                    } rounded-xl px-3 py-2 text-xs text-left flex items-center justify-between gap-2 transition cursor-pointer shadow-inner`}
                  >
                    <span className="flex items-center gap-2 min-w-0">
                      <span className="w-6 h-6 rounded-lg bg-violet-500/15 border border-violet-500/30 flex items-center justify-center text-violet-400 shrink-0">
                        <User className="w-3.5 h-3.5" />
                      </span>
                      {formHelperName ? (
                        <span className="truncate font-bold text-white">{formHelperName}</span>
                      ) : (
                        <span className="text-slate-400">-- Opsional Helper --</span>
                      )}
                    </span>
                    <ChevronDown className={`w-4 h-4 text-slate-400 shrink-0 transition-transform duration-200 ${activeModalDropdown === 'helper' ? 'rotate-180 text-amber-400' : ''}`} />
                  </button>

                  {activeModalDropdown === 'helper' && (
                    <div className="absolute left-0 right-0 top-full mt-1.5 z-50 bg-slate-900/95 backdrop-blur-xl border border-slate-700/90 rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150 min-w-[220px]">
                      <div className="p-2 bg-slate-950/90 border-b border-slate-800 space-y-1.5">
                        <div className="relative">
                          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                          <input
                            type="text"
                            autoFocus
                            value={helperSearchFilter}
                            onChange={(e) => setHelperSearchFilter(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                if (filteredHelperOptions.length > 0) {
                                  setFormHelperName(filteredHelperOptions[0].name);
                                  setFormHelperId(filteredHelperOptions[0].id);
                                  setActiveModalDropdown(null);
                                }
                              } else if (e.key === 'Escape') {
                                setActiveModalDropdown(null);
                              }
                            }}
                            placeholder="Ketik helper lalu Enter..."
                            className="w-full bg-slate-900 border border-slate-700/80 rounded-lg pl-8 pr-2.5 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-violet-500"
                          />
                        </div>
                        {formHelperName && (
                          <button
                            type="button"
                            onClick={() => {
                              setFormHelperName('');
                              setFormHelperId('');
                              setActiveModalDropdown(null);
                            }}
                            className="w-full text-[10px] text-rose-400 hover:text-rose-300 text-left px-1 font-semibold cursor-pointer"
                          >
                            &times; Kosongkan Pilihan Helper
                          </button>
                        )}
                      </div>
                      <div className="max-h-56 overflow-y-auto divide-y divide-slate-800/60">
                        {filteredHelperOptions.map(d => {
                          const isSelected = formHelperName === d.name;
                          return (
                            <button
                              key={`hlp-${d.id}`}
                              type="button"
                              onClick={() => {
                                setFormHelperName(d.name);
                                setFormHelperId(d.id);
                                setActiveModalDropdown(null);
                              }}
                              className={`w-full px-3 py-2 text-left flex items-center justify-between gap-2 transition cursor-pointer ${
                                isSelected ? 'bg-violet-500/15 text-violet-300 font-bold' : 'hover:bg-slate-800/80 text-slate-200'
                              }`}
                            >
                              <div className="flex items-center gap-2 min-w-0">
                                <span className="w-5 h-5 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-[10px] font-bold text-violet-400 shrink-0">
                                  {d.name.charAt(0).toUpperCase()}
                                </span>
                                <span className="text-xs truncate">{d.name}</span>
                              </div>
                              {isSelected && (
                                <Check className="w-3.5 h-3.5 text-violet-400 shrink-0" />
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>

                {/* 4. Custom Dropdown: Area Kirim (Ketik + Enter) */}
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
                    } rounded-xl px-3 py-2 text-xs text-left flex items-center justify-between gap-2 transition cursor-pointer shadow-inner`}
                  >
                    <span className="flex items-center gap-2 min-w-0">
                      <span className="w-6 h-6 rounded-lg bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
                        <MapPin className="w-3.5 h-3.5" />
                      </span>
                      {formRouteTrip ? (
                        <span className="truncate font-bold text-white">{formRouteTrip}</span>
                      ) : (
                        <span className="text-slate-400">-- Pilih Area --</span>
                      )}
                    </span>
                    <ChevronDown className={`w-4 h-4 text-slate-400 shrink-0 transition-transform duration-200 ${activeModalDropdown === 'area' ? 'rotate-180 text-amber-400' : ''}`} />
                  </button>

                  {activeModalDropdown === 'area' && (
                    <div className="absolute left-0 right-0 top-full mt-1.5 z-50 bg-slate-900/95 backdrop-blur-xl border border-slate-700/90 rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150 min-w-[220px]">
                      <div className="p-2 bg-slate-950/90 border-b border-slate-800 space-y-1.5">
                        <div className="relative">
                          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                          <input
                            type="text"
                            autoFocus
                            value={areaSearchFilter}
                            onChange={(e) => {
                              setAreaSearchFilter(e.target.value);
                            }}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                if (filteredAreaOptions.length > 0) {
                                  setFormRouteTrip(filteredAreaOptions[0]);
                                } else if (areaSearchFilter.trim()) {
                                  setFormRouteTrip(areaSearchFilter.trim());
                                }
                                setActiveModalDropdown(null);
                              } else if (e.key === 'Escape') {
                                setActiveModalDropdown(null);
                              }
                            }}
                            placeholder="Ketik area lalu Enter..."
                            className="w-full bg-slate-900 border border-slate-700/80 rounded-lg pl-8 pr-2.5 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                          />
                        </div>
                      </div>
                      <div className="max-h-56 overflow-y-auto divide-y divide-slate-800/60">
                        {filteredAreaOptions.map(area => {
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
                    placeholder="Otomatis dari KM isi terakhir"
                    value={formStartOdo}
                    onChange={(e) => setFormStartOdo(e.target.value)}
                    required
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white font-mono focus:border-amber-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Kilometer Isi (KM) <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="number"
                    placeholder="Kilometer saat pengisian BBM"
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
                    Catatan (Opsional)
                  </label>
                  <input
                    type="text"
                    placeholder="Catatan tambahan pengiriman..."
                    value={formNotes}
                    onChange={(e) => setFormNotes(e.target.value)}
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
                  {editingLogId ? 'Simpan Perubahan BBM' : 'Simpan Catatan BBM'}
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
                type="button"
                onClick={() => setSelectedLogForDetail(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4 text-xs">
              <div className="text-center border-b border-dashed border-slate-800 pb-3">
                <div className="font-black text-white text-sm">PT ANUGRAH KEMASAN KREATIF</div>
                <div className="text-[10px] text-slate-400">Divisi Distribusi &amp; Logistik Armada</div>
                <div className="text-[11px] font-mono text-amber-400 mt-1">
                  ID LOG: {selectedLogForDetail.id}
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
                {selectedLogForDetail.helperName && (
                  <div className="flex justify-between">
                    <span className="text-slate-400">Helper:</span>
                    <span className="text-amber-300">{selectedLogForDetail.helperName}</span>
                  </div>
                )}
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
                  <span className="text-white font-bold">{selectedLogForDetail.distanceKm} KM (Awal: {selectedLogForDetail.startOdometerKm} - Isi: {selectedLogForDetail.endOdometerKm})</span>
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
                  type="button"
                  onClick={() => window.print()}
                  className="w-full flex items-center justify-center gap-2 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs transition cursor-pointer"
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
        fuelLogs={branchScopedLogs}
      />
    </div>
  );
};
