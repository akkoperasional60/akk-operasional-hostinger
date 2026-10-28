import React, { useState, useMemo } from 'react';
import { attendanceService } from '../services/attendanceService';
import { 
  Users, 
  Truck, 
  Ship, 
  MapPin, 
  Calendar, 
  CheckCircle2, 
  AlertTriangle, 
  RefreshCw, 
  Download, 
  X, 
  UserCheck, 
  Shield, 
  Compass, 
  Navigation,
  Copy,
  Sparkles,
  Layers,
  ArrowRight,
  Clock,
  Activity,
  Award,
  LayoutGrid,
  Table2,
  Eye,
  CalendarCheck,
  TrendingUp,
  User,
  Zap,
  Coffee,
  Check,
  AlertCircle
} from 'lucide-react';
import { Crew, Fleet, RetailStore, Schedule, ShipmentStatus } from '../types';
import { logisticsStore } from '../services/store';
import { 
  WEEK_SIMULATION_CONFIGS, 
  buildWeekSchedule, 
  validateWeekCompliance,
  WeekSimulationConfig 
} from '../services/simulationScheduleEngine';
import { AreaRepetitionWarningModal } from './AreaRepetitionWarningModal';
import { 
  checkAreaRepetitionConflict, 
  auditWeekAreaRotations, 
  AreaRepetitionConflict 
} from '../services/areaRotationValidator';

interface CrewSimulationModalProps {
  isOpen: boolean;
  onClose: () => void;
  crews: Crew[];
  fleets: Fleet[];
  stores: RetailStore[];
}

export type DayOfWeek = 'Senin' | 'Selasa' | 'Rabu' | 'Kamis' | 'Jumat' | 'Sabtu';

export interface DailyScheduleRoute {
  id: string;
  day: DayOfWeek;
  route: string;
  category: 'Inter-Island' | 'Reguler' | 'Susulan' | 'Grosir';
  isLuarKota: boolean;
  ferryRoute?: string;
  driverId: string;
  helperId: string;
  truckId: string;
  distanceKm: number;
  estimatedHours: number;
  fatigueScore: 'Rendah (Aman)' | 'Normal' | 'Tinggi (Perlu Istirahat)';
  slaEst: string;
  coords: { x: number; y: number };
}

export const INITIAL_STRUCTURED_WEEKLY_ROUTES: Omit<DailyScheduleRoute, 'driverId' | 'helperId' | 'truckId' | 'fatigueScore' | 'slaEst'>[] = [
  // 1. HARI SENIN (5 Rute: 4 Luar Kota + 1 Lokal)
  { id: 'mon-1', day: 'Senin', route: 'Denpasar 1 (Bali)', category: 'Inter-Island', isLuarKota: true, ferryRoute: 'Ketapang - Gilimanuk (ASDP)', distanceKm: 145, estimatedHours: 10, coords: { x: 80, y: 35 } },
  { id: 'mon-2', day: 'Senin', route: 'Denpasar 2 (Bali)', category: 'Inter-Island', isLuarKota: true, ferryRoute: 'Ketapang - Gilimanuk (ASDP)', distanceKm: 150, estimatedHours: 11, coords: { x: 85, y: 55 } },
  { id: 'mon-3', day: 'Senin', route: 'Situbondo', category: 'Reguler', isLuarKota: true, distanceKm: 95, estimatedHours: 3.5, coords: { x: 50, y: 15 } },
  { id: 'mon-4', day: 'Senin', route: 'Bondowoso', category: 'Reguler', isLuarKota: true, distanceKm: 110, estimatedHours: 4, coords: { x: 40, y: 25 } },
  { id: 'mon-5', day: 'Senin', route: 'Susulan Genteng - Rogojampi', category: 'Susulan', isLuarKota: false, distanceKm: 35, estimatedHours: 2, coords: { x: 30, y: 65 } },

  // 2. HARI SELASA (6 Rute: 2 Luar Kota + 4 Lokal)
  { id: 'tue-1', day: 'Selasa', route: 'Jember Selatan', category: 'Reguler', isLuarKota: true, distanceKm: 125, estimatedHours: 4.5, coords: { x: 25, y: 75 } },
  { id: 'tue-2', day: 'Selasa', route: 'Singaraja (Bali)', category: 'Inter-Island', isLuarKota: true, ferryRoute: 'Ketapang - Gilimanuk (ASDP)', distanceKm: 135, estimatedHours: 9, coords: { x: 75, y: 20 } },
  { id: 'tue-3', day: 'Selasa', route: 'Sumberayu Retail', category: 'Reguler', isLuarKota: false, distanceKm: 45, estimatedHours: 2.5, coords: { x: 35, y: 60 } },
  { id: 'tue-4', day: 'Selasa', route: 'Galekan Retail', category: 'Reguler', isLuarKota: false, distanceKm: 40, estimatedHours: 2, coords: { x: 45, y: 50 } },
  { id: 'tue-5', day: 'Selasa', route: 'Grosir 1 (Banyuwangi Kota)', category: 'Grosir', isLuarKota: false, distanceKm: 15, estimatedHours: 1.5, coords: { x: 60, y: 40 } },
  { id: 'tue-6', day: 'Selasa', route: 'Susulan Sanggar - Jajag', category: 'Susulan', isLuarKota: false, distanceKm: 50, estimatedHours: 2.5, coords: { x: 35, y: 80 } },

  // 3. HARI RABU (6 Rute: 2 Luar Kota + 4 Lokal)
  { id: 'wed-1', day: 'Rabu', route: 'Denpasar 1 (Bali)', category: 'Inter-Island', isLuarKota: true, ferryRoute: 'Ketapang - Gilimanuk (ASDP)', distanceKm: 145, estimatedHours: 10, coords: { x: 80, y: 35 } },
  { id: 'wed-2', day: 'Rabu', route: 'Denpasar 2 (Bali)', category: 'Inter-Island', isLuarKota: true, ferryRoute: 'Ketapang - Gilimanuk (ASDP)', distanceKm: 150, estimatedHours: 11, coords: { x: 85, y: 55 } },
  { id: 'wed-3', day: 'Rabu', route: 'Genteng Retail', category: 'Reguler', isLuarKota: false, distanceKm: 38, estimatedHours: 2, coords: { x: 32, y: 55 } },
  { id: 'wed-4', day: 'Rabu', route: 'Rogojampi Retail', category: 'Reguler', isLuarKota: false, distanceKm: 22, estimatedHours: 1.5, coords: { x: 50, y: 48 } },
  { id: 'wed-5', day: 'Rabu', route: 'Muncar Pasar', category: 'Reguler', isLuarKota: false, distanceKm: 42, estimatedHours: 2.5, coords: { x: 65, y: 70 } },
  { id: 'wed-6', day: 'Rabu', route: 'Muncar Pinggir', category: 'Reguler', isLuarKota: false, distanceKm: 46, estimatedHours: 2.5, coords: { x: 70, y: 80 } },

  // 4. HARI KAMIS (6 Rute: 3 Luar Kota + 3 Lokal)
  { id: 'thu-1', day: 'Kamis', route: 'Susulan Singaraja (Bali)', category: 'Susulan', isLuarKota: true, ferryRoute: 'Ketapang - Gilimanuk (ASDP)', distanceKm: 135, estimatedHours: 9, coords: { x: 78, y: 22 } },
  { id: 'thu-2', day: 'Kamis', route: 'Susulan Situbondo - Bondowoso', category: 'Susulan', isLuarKota: true, distanceKm: 105, estimatedHours: 4, coords: { x: 45, y: 18 } },
  { id: 'thu-3', day: 'Kamis', route: 'Jember Barat', category: 'Reguler', isLuarKota: true, distanceKm: 130, estimatedHours: 5, coords: { x: 20, y: 45 } },
  { id: 'thu-4', day: 'Kamis', route: 'Grosir 2 (Retail Hub)', category: 'Grosir', isLuarKota: false, distanceKm: 25, estimatedHours: 2, coords: { x: 55, y: 35 } },
  { id: 'thu-5', day: 'Kamis', route: 'Songgon Retail', category: 'Reguler', isLuarKota: false, distanceKm: 32, estimatedHours: 2, coords: { x: 40, y: 40 } },
  { id: 'thu-6', day: 'Kamis', route: 'BWI Kota Selatan', category: 'Reguler', isLuarKota: false, distanceKm: 18, estimatedHours: 1.5, coords: { x: 58, y: 50 } },

  // 5. HARI JUMAT (6 Rute: 0 Luar Kota [Hari Istirahat / Pemulihan Kru Luar Kota] + 6 Lokal)
  { id: 'fri-1', day: 'Jumat', route: 'Ketapang - Wongsorejo', category: 'Reguler', isLuarKota: false, distanceKm: 30, estimatedHours: 2, coords: { x: 68, y: 25 } },
  { id: 'fri-2', day: 'Jumat', route: 'Sanggar Retail', category: 'Reguler', isLuarKota: false, distanceKm: 52, estimatedHours: 2.5, coords: { x: 38, y: 72 } },
  { id: 'fri-3', day: 'Jumat', route: 'Kalibaru Retail', category: 'Reguler', isLuarKota: false, distanceKm: 60, estimatedHours: 3, coords: { x: 22, y: 65 } },
  { id: 'fri-4', day: 'Jumat', route: 'Grosir 3 (Distribution)', category: 'Grosir', isLuarKota: false, distanceKm: 30, estimatedHours: 2, coords: { x: 52, y: 38 } },
  { id: 'fri-5', day: 'Jumat', route: 'Susulan Rogojampi - Muncar', category: 'Susulan', isLuarKota: false, distanceKm: 40, estimatedHours: 2.5, coords: { x: 58, y: 62 } },
  { id: 'fri-6', day: 'Jumat', route: 'Sempu Stail Retail', category: 'Reguler', isLuarKota: false, distanceKm: 36, estimatedHours: 2, coords: { x: 35, y: 48 } },

  // 6. HARI SABTU (7 Rute: 2 Luar Kota + 5 Lokal)
  { id: 'sat-1', day: 'Sabtu', route: 'Negara (Bali Barat)', category: 'Inter-Island', isLuarKota: true, ferryRoute: 'Ketapang - Gilimanuk (ASDP)', distanceKm: 90, estimatedHours: 6.5, coords: { x: 75, y: 50 } },
  { id: 'sat-2', day: 'Sabtu', route: 'Jember Kota', category: 'Reguler', isLuarKota: true, distanceKm: 115, estimatedHours: 4.5, coords: { x: 22, y: 35 } },
  { id: 'sat-3', day: 'Sabtu', route: 'Purwo Pasar', category: 'Reguler', isLuarKota: false, distanceKm: 55, estimatedHours: 2.5, coords: { x: 52, y: 78 } },
  { id: 'sat-4', day: 'Sabtu', route: 'Purwo Dambuntung', category: 'Reguler', isLuarKota: false, distanceKm: 58, estimatedHours: 3, coords: { x: 55, y: 85 } },
  { id: 'sat-5', day: 'Sabtu', route: 'Jajag Retail', category: 'Reguler', isLuarKota: false, distanceKm: 48, estimatedHours: 2.5, coords: { x: 42, y: 70 } },
  { id: 'sat-6', day: 'Sabtu', route: 'Srono Retail', category: 'Reguler', isLuarKota: false, distanceKm: 34, estimatedHours: 2, coords: { x: 48, y: 58 } },
  { id: 'sat-7', day: 'Sabtu', route: 'Grosir 4 (Hub)', category: 'Grosir', isLuarKota: false, distanceKm: 35, estimatedHours: 2, coords: { x: 54, y: 42 } },
];

export const CrewSimulationModal: React.FC<CrewSimulationModalProps> = ({
  isOpen,
  onClose,
  crews,
  fleets,
  stores,
}) => {
  // Step 1: 'luar_kota' (Priority #1), Step 2: 'kiriman_sisa' (Step #2), Step 3: 'matriks_terpadu' (Step #3)
  const [activeStepTab, setActiveStepTab] = useState<'luar_kota' | 'kiriman_sisa' | 'matriks_terpadu'>('luar_kota');
  const [selectedMonth, setSelectedMonth] = useState('Oktober 2026');
  const [selectedWeek, setSelectedWeek] = useState<number>(1); // 1, 2, 3, 4
  const [selectedDayTab, setSelectedDayTab] = useState<DayOfWeek | 'Semua'>('Semua');
  const [viewLayoutMode, setViewLayoutMode] = useState<'grid' | 'table'>('grid');
  const [activeNodeId, setActiveNodeId] = useState<string>('mon-1');
  const [notificationMsg, setNotificationMsg] = useState<string | null>(null);

  // States for Area Repetition Warning & Urgent Override
  const [areaConflict, setAreaConflict] = useState<AreaRepetitionConflict | null>(null);
  const [pendingChange, setPendingChange] = useState<{ routeId: string; field: 'driverId' | 'helperId'; value: string } | null>(null);
  const [selectedStep3Route, setSelectedStep3Route] = useState<DailyScheduleRoute | null>(null);

  const daysList: DayOfWeek[] = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
  const dayIndexMap: Record<DayOfWeek, number> = {
    Senin: 0,
    Selasa: 1,
    Rabu: 2,
    Kamis: 3,
    Jumat: 4,
    Sabtu: 5
  };

  const driversList = useMemo(() => crews.filter(c => !c.role.includes('Helper') && c.role !== 'Kernet / Helper'), [crews]);
  const helpersList = useMemo(() => crews.filter(c => c.role.includes('Helper') || c.role === 'Kernet / Helper'), [crews]);

  const todayDate = '2026-09-23';
  const absentCrew = useMemo(() => {
    return crews.filter(c => !attendanceService.isCrewAvailable(c.id, todayDate));
  }, [crews, todayDate]);

  const handleAutoAlignAttendance = () => {
    setAllWeeksData(prev => {
      const updatedWeek = prev[selectedWeek].map(route => {
        const isDriverAbsent = !attendanceService.isCrewAvailable(route.driverId, todayDate);
        const isHelperAbsent = !attendanceService.isCrewAvailable(route.helperId, todayDate);
        
        if (isDriverAbsent || isHelperAbsent) {
          const availableDrivers = driversList.filter(d => attendanceService.isCrewAvailable(d.id, todayDate));
          const availableHelpers = helpersList.filter(h => attendanceService.isCrewAvailable(h.id, todayDate));
          
          return {
            ...route,
            driverId: isDriverAbsent ? (availableDrivers[0]?.id || route.driverId) : route.driverId,
            helperId: isHelperAbsent ? (availableHelpers[0]?.id || route.helperId) : route.helperId
          };
        }
        return route;
      });
      return { ...prev, [selectedWeek]: updatedWeek };
    });
    setNotificationMsg(`✅ Jadwal diselaraskan dengan absensi hari ini (${todayDate}). Kru pengganti telah ditugaskan.`);
    setTimeout(() => setNotificationMsg(null), 4000);
  };

  // Initial intelligent assignment enforcing Rest Gap Rule
  const buildRestGapCompliantSchedule = (): DailyScheduleRoute[] => {
    const dList = driversList.length > 0 ? driversList : crews;
    const hList = helpersList.length > 0 ? helpersList : crews;
    const fList = fleets.length > 0 ? fleets : [];

    // Luar Kota rotation groups (preventing consecutive day Luar Kota assignment)
    // Group A drivers (e.g. index 0, 1, 2, 3) -> Monday (4 LK) & Wednesday (2 LK)
    // Group B drivers (e.g. index 4, 5) -> Tuesday (2 LK)
    // Group C drivers (e.g. index 2, 3, 4) -> Thursday (3 LK)
    // Friday -> 0 LK (All rest from LK)
    // Saturday -> Group A / B (e.g. index 0, 5) -> Saturday (2 LK)

    return INITIAL_STRUCTURED_WEEKLY_ROUTES.map((item, index) => {
      let driverIndex = 0;
      let helperIndex = 0;

      if (item.isLuarKota) {
        if (item.day === 'Senin') {
          // Senin 4 rute luar kota: Drivers 0, 1, 2, 3
          const monLkIdx = ['mon-1', 'mon-2', 'mon-3', 'mon-4'].indexOf(item.id);
          driverIndex = monLkIdx >= 0 ? monLkIdx % dList.length : 0;
          helperIndex = driverIndex % hList.length;
        } else if (item.day === 'Selasa') {
          // Selasa 2 rute luar kota: Drivers 4, 5 (Drivers 0-3 rested!)
          const tueLkIdx = ['tue-1', 'tue-2'].indexOf(item.id);
          driverIndex = (4 + (tueLkIdx >= 0 ? tueLkIdx : 0)) % dList.length;
          helperIndex = driverIndex % hList.length;
        } else if (item.day === 'Rabu') {
          // Rabu 2 rute luar kota: Drivers 0, 1 (Rested on Tuesday!)
          const wedLkIdx = ['wed-1', 'wed-2'].indexOf(item.id);
          driverIndex = (wedLkIdx >= 0 ? wedLkIdx : 0) % dList.length;
          helperIndex = driverIndex % hList.length;
        } else if (item.day === 'Kamis') {
          // Kamis 3 rute luar kota: Drivers 2, 3, 4 (Rested on Wednesday!)
          const thuLkIdx = ['thu-1', 'thu-2', 'thu-3'].indexOf(item.id);
          driverIndex = (2 + (thuLkIdx >= 0 ? thuLkIdx : 0)) % dList.length;
          helperIndex = driverIndex % hList.length;
        } else if (item.day === 'Sabtu') {
          // Sabtu 2 rute luar kota: Drivers 0, 5 (All rested Friday!)
          const satLkIdx = ['sat-1', 'sat-2'].indexOf(item.id);
          driverIndex = (satLkIdx === 0 ? 0 : 5) % dList.length;
          helperIndex = driverIndex % hList.length;
        }
      } else {
        // Local routes: distributed across remaining pool
        driverIndex = (index * 2 + 1) % dList.length;
        helperIndex = (index * 3 + 2) % hList.length;
      }

      const driver = dList[driverIndex]?.id || '';
      const helper = hList[helperIndex]?.id || '';
      const fleet = fList[index % (fList.length || 1)]?.id || '';

      return {
        ...item,
        driverId: driver,
        helperId: helper,
        truckId: fleet,
        fatigueScore: item.isLuarKota ? 'Normal' : 'Rendah (Aman)',
        slaEst: (97 + (index % 3) * 0.8).toFixed(1) + '%'
      };
    });
  };

  // State for all 4 weeks with week-specific requirements
  const [allWeeksData, setAllWeeksData] = useState<Record<number, DailyScheduleRoute[]>>(() => {
    try {
      const saved = localStorage.getItem('akk_simulasi_weeks_v2');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed[1] && parsed[2] && parsed[3] && parsed[4]) {
          return parsed;
        }
      }
    } catch {
      // fallback
    }
    return {
      1: buildWeekSchedule(1, crews, fleets),
      2: buildWeekSchedule(2, crews, fleets),
      3: buildWeekSchedule(3, crews, fleets),
      4: buildWeekSchedule(4, crews, fleets)
    };
  });

  const currentWeekRoutes = allWeeksData[selectedWeek] || allWeeksData[1];
  const weekConfig = WEEK_SIMULATION_CONFIGS[selectedWeek] || WEEK_SIMULATION_CONFIGS[1];

  // Live compliance check for current week and all weeks
  const weekCompliance = useMemo(() => {
    return validateWeekCompliance(selectedWeek, currentWeekRoutes, crews);
  }, [selectedWeek, currentWeekRoutes, crews]);

  const allWeeksCompliance = useMemo(() => {
    return {
      1: validateWeekCompliance(1, allWeeksData[1] || [], crews),
      2: validateWeekCompliance(2, allWeeksData[2] || [], crews),
      3: validateWeekCompliance(3, allWeeksData[3] || [], crews),
      4: validateWeekCompliance(4, allWeeksData[4] || [], crews),
    };
  }, [allWeeksData, crews]);

  // Luar Kota routes only (13 routes)
  const luarKotaRoutes = useMemo(() => {
    return currentWeekRoutes.filter(r => r.isLuarKota);
  }, [currentWeekRoutes]);

  // Sisa Kiriman Lokal only (23 routes)
  const sisaLokalRoutes = useMemo(() => {
    return currentWeekRoutes.filter(r => !r.isLuarKota);
  }, [currentWeekRoutes]);

  // Filtered by selected day
  const displayedRoutes = useMemo(() => {
    let baseList = currentWeekRoutes;
    if (activeStepTab === 'luar_kota') {
      baseList = luarKotaRoutes;
    } else if (activeStepTab === 'kiriman_sisa') {
      baseList = sisaLokalRoutes;
    }

    if (selectedDayTab === 'Semua') return baseList;
    return baseList.filter(r => r.day === selectedDayTab);
  }, [currentWeekRoutes, luarKotaRoutes, sisaLokalRoutes, activeStepTab, selectedDayTab]);

  // REST GAP VALIDATOR ENGINE (Anti-Back-to-Back Check)
  const restGapAnalysis = useMemo(() => {
    // Track each driver's assigned days for Luar Kota
    const driverLuarKotaDays = new Map<string, number[]>(); // driverId -> day indices [0..5]
    
    currentWeekRoutes.forEach(r => {
      if (r.isLuarKota && r.driverId) {
        const dayIdx = dayIndexMap[r.day];
        const existing = driverLuarKotaDays.get(r.driverId) || [];
        if (!existing.includes(dayIdx)) {
          existing.push(dayIdx);
          driverLuarKotaDays.set(r.driverId, existing.sort((a, b) => a - b));
        }
      }
    });

    // Check violations (consecutive days)
    const violations: { driverId: string; day1: DayOfWeek; day2: DayOfWeek }[] = [];
    driverLuarKotaDays.forEach((days, driverId) => {
      for (let i = 0; i < days.length - 1; i++) {
        if (days[i + 1] === days[i] + 1) {
          violations.push({
            driverId,
            day1: daysList[days[i]],
            day2: daysList[days[i + 1]]
          });
        }
      }
    });

    return {
      driverLuarKotaDays,
      violations,
      isFullyCompliant: violations.length === 0
    };
  }, [currentWeekRoutes]);

  // AREA ROTATION AUDIT (Anti-Area-Repetition Check)
  const areaRotationAudit = useMemo(() => {
    return auditWeekAreaRotations(currentWeekRoutes, crews);
  }, [currentWeekRoutes, crews]);

  if (!isOpen) return null;

  const getDriverName = (id: string) => crews.find(c => c.id === id)?.name || 'Belum Ditunjuk';
  const getHelperName = (id: string) => crews.find(c => c.id === id)?.name || 'Tanpa Helper';
  const getFleetName = (id: string) => {
    const f = fleets.find(item => item.id === id);
    return f ? `${f.plateNumber}${f.initialCode ? ` (${f.initialCode})` : ''}` : 'Armada Standar';
  };

  const applyRouteChange = (routeId: string, field: 'driverId' | 'helperId' | 'truckId', value: string) => {
    setAllWeeksData(prev => {
      const updatedWeek = prev[selectedWeek].map(route => {
        if (route.id === routeId) {
          return { ...route, [field]: value };
        }
        return route;
      });
      const newState = { ...prev, [selectedWeek]: updatedWeek };
      try {
        localStorage.setItem('akk_simulasi_weeks_v2', JSON.stringify(newState));
      } catch {
        // ignore
      }
      return newState;
    });
  };

  const handleRouteChange = (routeId: string, field: 'driverId' | 'helperId' | 'truckId', value: string) => {
    // If updating Driver or Helper, validate if candidate crew is already assigned to this area previously
    if (field === 'driverId' || field === 'helperId') {
      const targetRoute = currentWeekRoutes.find(r => r.id === routeId);
      if (targetRoute && value) {
        const conflict = checkAreaRepetitionConflict(
          routeId,
          targetRoute.route,
          targetRoute.day,
          value,
          field,
          currentWeekRoutes,
          crews,
          selectedWeek
        );

        if (conflict) {
          // Open warning pop up for user to choose: proceed (urgent) or replace with alternative crew
          setPendingChange({ routeId, field, value });
          setAreaConflict(conflict);
          return;
        }
      }
    }

    applyRouteChange(routeId, field, value);
  };

  // Auto-allocate Luar Kota ensuring the week's specific rules and zero back-to-back violations
  const handleAutoAllocateLuarKota = () => {
    const compliant = buildWeekSchedule(selectedWeek, crews, fleets);
    setAllWeeksData(prev => {
      const current = prev[selectedWeek] || [];
      const merged = current.map(item => {
        const matched = compliant.find(c => c.id === item.id);
        if (matched && matched.isLuarKota) {
          return { ...item, driverId: matched.driverId, helperId: matched.helperId, truckId: matched.truckId };
        }
        return item;
      });
      const newState = { ...prev, [selectedWeek]: merged };
      try {
        localStorage.setItem('akk_simulasi_weeks_v2', JSON.stringify(newState));
      } catch {
        // ignore
      }
      return newState;
    });
    setNotificationMsg(`✅ Penugasan Luar Kota Minggu ${selectedWeek} (${weekConfig.theme}) berhasil diselaraskan 100%!`);
    setTimeout(() => setNotificationMsg(null), 4000);
  };

  // Synchronize special designated crew requirements for the current week
  const handleSyncSpecialRequirement = () => {
    if (selectedWeek === 1) {
      // Find Monday Denpasar 1 and sync to Wednesday
      setAllWeeksData(prev => {
        const weekRoutes = [...(prev[1] || [])];
        const seninDp1 = weekRoutes.find(r => r.day === 'Senin' && r.route === 'Denpasar 1 (Bali)');
        if (seninDp1 && seninDp1.driverId) {
          const updated = weekRoutes.map(r => {
            if (r.day === 'Rabu' && r.route === 'Denpasar 1 (Bali)') {
              return { ...r, driverId: seninDp1.driverId, helperId: seninDp1.helperId, truckId: seninDp1.truckId };
            }
            return r;
          });
          const newState = { ...prev, 1: updated };
          localStorage.setItem('akk_simulasi_weeks_v2', JSON.stringify(newState));
          return newState;
        }
        return prev;
      });
      setNotificationMsg('✅ Kru Denpasar 1 (Senin & Rabu) berhasil disamakan: Driver & Helper identik!');
    } else if (selectedWeek === 2) {
      // Find Tuesday Singaraja and sync to Thursday Susulan Singaraja
      setAllWeeksData(prev => {
        const weekRoutes = [...(prev[2] || [])];
        const tueSingaraja = weekRoutes.find(r => r.day === 'Selasa' && r.route === 'Singaraja (Bali)');
        if (tueSingaraja && tueSingaraja.driverId) {
          const updated = weekRoutes.map(r => {
            if (r.day === 'Kamis' && r.route.includes('Singaraja')) {
              return { ...r, driverId: tueSingaraja.driverId, helperId: tueSingaraja.helperId, truckId: tueSingaraja.truckId };
            }
            return r;
          });
          const newState = { ...prev, 2: updated };
          localStorage.setItem('akk_simulasi_weeks_v2', JSON.stringify(newState));
          return newState;
        }
        return prev;
      });
      setNotificationMsg('✅ Kru Singaraja (Selasa) dan Susulan Singaraja (Kamis) berhasil disamakan: Driver & Helper identik!');
    } else if (selectedWeek === 3) {
      const compliant = buildWeekSchedule(3, crews, fleets);
      setAllWeeksData(prev => {
        const newState = { ...prev, 3: compliant };
        localStorage.setItem('akk_simulasi_weeks_v2', JSON.stringify(newState));
        return newState;
      });
      setNotificationMsg('✅ Klaster Jember (Selatan, Barat, Kota) berhasil dialokasikan selang 1 hari dengan jeda istirahat penuh!');
    } else if (selectedWeek === 4) {
      const compliant = buildWeekSchedule(4, crews, fleets);
      setAllWeeksData(prev => {
        const newState = { ...prev, 4: compliant };
        localStorage.setItem('akk_simulasi_weeks_v2', JSON.stringify(newState));
        return newState;
      });
      setNotificationMsg('✅ Rute Tapal Kuda & Bali Barat (Situbondo/Bondowoso, Susulan, Negara) berhasil diselaraskan!');
    }
    setTimeout(() => setNotificationMsg(null), 4000);
  };

  // Auto-allocate local deliveries
  const handleAutoAllocateKirimanSisa = () => {
    setAllWeeksData(prev => {
      const current = prev[selectedWeek];
      const updated = current.map((item, idx) => {
        if (!item.isLuarKota) {
          // assign rested crews
          const driver = driversList[(idx * 2 + 1) % (driversList.length || 1)]?.id || item.driverId;
          const helper = helpersList[(idx * 3 + 2) % (helpersList.length || 1)]?.id || item.helperId;
          return { ...item, driverId: driver, helperId: helper };
        }
        return item;
      });
      const newState = { ...prev, [selectedWeek]: updated };
      try {
        localStorage.setItem('akk_simulasi_weeks_v2', JSON.stringify(newState));
      } catch {
        // ignore
      }
      return newState;
    });
    setNotificationMsg('✅ Kiriman sisa lokal Banyuwangi berhasil disesuaikan dengan kru & armada yang tersedia!');
    setTimeout(() => setNotificationMsg(null), 4000);
  };

  // Reset or reapply designated week template
  const handleResetCurrentWeek = () => {
    const fresh = buildWeekSchedule(selectedWeek, crews, fleets);
    setAllWeeksData(prev => {
      const newState = { ...prev, [selectedWeek]: fresh };
      try {
        localStorage.setItem('akk_simulasi_weeks_v2', JSON.stringify(newState));
      } catch {
        // ignore
      }
      return newState;
    });
    setNotificationMsg(`✅ Jadwal Minggu ${selectedWeek} di-reset ke alokasi resmi sesuai persyaratan!`);
    setTimeout(() => setNotificationMsg(null), 4000);
  };

  // Save to database
  const handleSaveAndSyncToDatabase = () => {
    try {
      localStorage.setItem('akk_simulasi_weeks_v2', JSON.stringify(allWeeksData));
    } catch {
      // ignore
    }
    setNotificationMsg(`✅ Berhasil! Simulasi jadwal mingguan (${currentWeekRoutes.length} rute untuk ${weekConfig.title}) telah dikunci & disinkronkan ke sistem.`);
    setTimeout(() => setNotificationMsg(null), 4000);
  };

  // Check if a specific driver on a specific route has a back-to-back conflict
  const checkDriverConflict = (driverId: string, day: DayOfWeek) => {
    if (!driverId) return null;
    const assignedDays = restGapAnalysis.driverLuarKotaDays.get(driverId) || [];
    const currentDayIdx = dayIndexMap[day];

    const hasPrevDay = assignedDays.includes(currentDayIdx - 1);
    const hasNextDay = assignedDays.includes(currentDayIdx + 1);

    if (hasPrevDay || hasNextDay) {
      const conflictDay = hasPrevDay ? daysList[currentDayIdx - 1] : daysList[currentDayIdx + 1];
      return `Peringatan: Driver ini juga dinas Luar Kota di hari ${conflictDay}. Butuh jeda istirahat min. 1 hari!`;
    }
    return null;
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-sm flex items-center justify-center p-3 md:p-5 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-6xl overflow-hidden shadow-2xl flex flex-col max-h-[92vh]">
        
        {/* Modal Header */}
        <div className="bg-slate-950 px-6 py-4 border-b border-slate-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/20 border border-indigo-500/40 flex items-center justify-center text-indigo-400">
              <Compass className="w-5 h-5 text-indigo-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-black text-white">Simulasi Penugasan Area & Rotasi Kru</h3>
                <span className="px-2 py-0.5 bg-indigo-500/20 text-indigo-300 text-[10px] font-bold rounded-md border border-indigo-500/30">
                  Prioritas Luar Kota & Jeda Istirahat
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Alur cerdas: Alokasikan kiriman luar kota & antar-pulau terlebih dahulu dengan jeda istirahat 1 hari, lalu atur sisa kiriman lokal.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-slate-900 hover:bg-slate-800 flex items-center justify-center text-slate-400 hover:text-white transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* SIKLUS SIMULASI 4 PEKAN (URUTAN JADWAL LUAR KOTA) */}
        <div className="bg-slate-900/95 px-6 py-2.5 border-b border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5 shrink-0">
              <Calendar className="w-3.5 h-3.5 text-indigo-400" />
              <span>Siklus 4 Pekan:</span>
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 flex-1 max-w-4xl">
            {[1, 2, 3, 4].map(wNum => {
              const cfg = WEEK_SIMULATION_CONFIGS[wNum];
              const comp = allWeeksCompliance[wNum as 1 | 2 | 3 | 4];
              const isSelected = selectedWeek === wNum;
              return (
                <button
                  key={wNum}
                  onClick={() => setSelectedWeek(wNum)}
                  className={`p-2 rounded-xl border text-left transition cursor-pointer flex flex-col justify-between ${
                    isSelected
                      ? 'bg-indigo-600/20 border-indigo-500 text-white shadow-sm ring-1 ring-indigo-500/50'
                      : 'bg-slate-950/60 border-slate-800 text-slate-300 hover:border-slate-700 hover:bg-slate-900/80'
                  }`}
                >
                  <div className="flex items-center justify-between gap-1">
                    <span className="font-black text-xs">Pekan {wNum}</span>
                    <span className={`text-[9px] px-1.5 py-0.2 rounded-full font-bold ${
                      comp?.isCompliant ? 'bg-emerald-500/20 text-emerald-300' : 'bg-amber-500/20 text-amber-300'
                    }`}>
                      {comp?.isCompliant ? '✅ Sesuai' : '⚠️ Cek'}
                    </span>
                  </div>
                  <div className="text-[10px] text-slate-400 truncate mt-0.5" title={cfg.theme}>
                    {cfg.theme}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* 3-STEP WORKFLOW TAB SWITCHER */}
        <div className="bg-slate-950/90 px-6 py-3 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex items-center bg-slate-900 p-1 rounded-xl border border-slate-800 flex-wrap gap-1">
            <button
              onClick={() => setActiveStepTab('luar_kota')}
              className={`px-3.5 py-2 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-2 ${
                activeStepTab === 'luar_kota'
                  ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Ship className="w-4 h-4 text-purple-300" />
              <span>1. Prioritas Luar Kota & Antar-Pulau ({luarKotaRoutes.length} Rute)</span>
            </button>

            <button
              onClick={() => setActiveStepTab('kiriman_sisa')}
              className={`px-3.5 py-2 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-2 ${
                activeStepTab === 'kiriman_sisa'
                  ? 'bg-indigo-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Truck className="w-4 h-4 text-indigo-300" />
              <span>2. Atur Kiriman Sisa / Lokal ({sisaLokalRoutes.length} Rute)</span>
            </button>

            <button
              onClick={() => setActiveStepTab('matriks_terpadu')}
              className={`px-3.5 py-2 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-2 ${
                activeStepTab === 'matriks_terpadu'
                  ? 'bg-emerald-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <LayoutGrid className="w-4 h-4 text-emerald-300" />
              <span>3. Matriks & Audit Jeda Kru</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleSaveAndSyncToDatabase}
              className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold shadow transition cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Simpan & Terapkan Jadwal</span>
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 text-xs">
          
          {/* Notification Alert Banner */}
          {notificationMsg && (
            <div className="bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 p-3 rounded-xl flex items-center gap-2 font-medium animate-fade-in">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
              <span>{notificationMsg}</span>
            </div>
          )}

          {absentCrew.length > 0 && (
            <div className="bg-rose-500/15 border border-rose-500/30 text-rose-300 p-4 rounded-xl flex items-center justify-between gap-4 font-medium">
              <div className="flex items-center gap-3">
                <AlertCircle className="w-5 h-5 shrink-0 text-rose-400" />
                <div>
                  <div className="font-bold">⚠️ {absentCrew.length} Kru Tidak Masuk Hari Ini ({todayDate})</div>
                  <div className="text-xs text-rose-200/80 mt-0.5">
                    {absentCrew.map(c => c.name).join(', ')} sedang berhalangan hadir. Jadwal memerlukan penyesuaian.
                  </div>
                </div>
              </div>
              <button 
                onClick={handleAutoAlignAttendance}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-xs font-bold transition cursor-pointer"
              >
                Auto-Align Jadwal
              </button>
            </div>
          )}

          {/* =========================================================================
              STEP 1: SIMULASI PRIORITAS LUAR KOTA & ANTAR-PULAU
              ========================================================================= */}
          {activeStepTab === 'luar_kota' && (
            <div className="space-y-6">
              
              {/* Header Box & Anti-Fatigue Rest Rule Info */}
              <div className="bg-gradient-to-r from-purple-950/50 via-slate-950 to-indigo-950/40 p-5 rounded-2xl border border-purple-900/40 shadow-sm">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="px-2.5 py-1 bg-purple-500/20 text-purple-300 rounded-lg font-black text-xs border border-purple-500/30 flex items-center gap-1.5">
                        <Zap className="w-3.5 h-3.5 text-purple-400" />
                        <span>LANGKAH 1: PRIORITAS LUAR KOTA & ANTAR-PULAU</span>
                      </span>
                      <span className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                        restGapAnalysis.isFullyCompliant ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                      }`}>
                        {restGapAnalysis.isFullyCompliant ? '✅ Jeda Istirahat: 100% Terpenuhi' : `⚠️ Ada ${restGapAnalysis.violations.length} Pelanggaran Jeda`}
                      </span>
                    </div>
                    <h4 className="font-black text-white text-base mt-2">
                      Jadwal Rute Luar Kota & Penyeberangan Bali (Senin s/d Sabtu)
                    </h4>
                    <p className="text-slate-300 text-xs mt-1 max-w-3xl leading-relaxed">
                      <strong>Aturan Jeda Istirahat:</strong> Driver yang bertugas ke luar kota / antar-pulau <strong>tidak boleh ditugaskan ke luar kota pada hari berikutnya</strong>. Harus ada jeda pemulihan / rute lokal ringan minimal 1 hari.
                    </p>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    <button
                      onClick={handleAutoAllocateLuarKota}
                      className="px-4 py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white rounded-xl text-xs font-bold shadow-md transition cursor-pointer flex items-center gap-2"
                    >
                      <Sparkles className="w-4 h-4 text-purple-200" />
                      <span>Auto-Alokasi Luar Kota (Anti-Kelelahan)</span>
                    </button>

                    <button
                      onClick={() => setActiveStepTab('kiriman_sisa')}
                      className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-bold border border-slate-700 transition cursor-pointer flex items-center gap-1.5"
                    >
                      <span>Lanjut ke Kiriman Sisa</span>
                      <ArrowRight className="w-4 h-4 text-indigo-400" />
                    </button>
                  </div>
                </div>

                {/* Day Schedule Summary Pill List */}
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 mt-4 pt-4 border-t border-slate-800/80 text-[11px]">
                  <div className="bg-slate-900/80 p-2.5 rounded-xl border border-slate-800">
                    <div className="font-bold text-white flex items-center justify-between">
                      <span>Senin (4 LK)</span>
                      <span className="text-purple-400 font-mono">4 Rute</span>
                    </div>
                    <div className="text-[10px] text-slate-400 mt-1">Denpasar 1, Denpasar 2, Situbondo, Bondowoso</div>
                  </div>

                  <div className="bg-slate-900/80 p-2.5 rounded-xl border border-slate-800">
                    <div className="font-bold text-white flex items-center justify-between">
                      <span>Selasa (2 LK)</span>
                      <span className="text-purple-400 font-mono">2 Rute</span>
                    </div>
                    <div className="text-[10px] text-slate-400 mt-1">Jember Selatan, Singaraja</div>
                  </div>

                  <div className="bg-slate-900/80 p-2.5 rounded-xl border border-slate-800">
                    <div className="font-bold text-white flex items-center justify-between">
                      <span>Rabu (2 LK)</span>
                      <span className="text-purple-400 font-mono">2 Rute</span>
                    </div>
                    <div className="text-[10px] text-slate-400 mt-1">Denpasar 1, Denpasar 2</div>
                  </div>

                  <div className="bg-slate-900/80 p-2.5 rounded-xl border border-slate-800">
                    <div className="font-bold text-white flex items-center justify-between">
                      <span>Kamis (3 LK)</span>
                      <span className="text-purple-400 font-mono">3 Rute</span>
                    </div>
                    <div className="text-[10px] text-slate-400 mt-1">Susulan Singaraja, Susulan Situbondo-Bondowoso, Jember Barat</div>
                  </div>

                  <div className="bg-emerald-950/30 p-2.5 rounded-xl border border-emerald-800/40">
                    <div className="font-bold text-emerald-300 flex items-center justify-between">
                      <span>Jumat (0 LK)</span>
                      <span className="text-emerald-400 font-mono font-bold">OFF / Lokal</span>
                    </div>
                    <div className="text-[10px] text-emerald-200/80 mt-1">Hari Jeda Pemulihan Kru Luar Kota & Servis Armada</div>
                  </div>

                  <div className="bg-slate-900/80 p-2.5 rounded-xl border border-slate-800">
                    <div className="font-bold text-white flex items-center justify-between">
                      <span>Sabtu (2 LK)</span>
                      <span className="text-purple-400 font-mono">2 Rute</span>
                    </div>
                    <div className="text-[10px] text-slate-400 mt-1">Negara (Bali Barat), Jember Kota</div>
                  </div>
                </div>
              </div>

              {/* Persyaratan Khusus Rotasi Luar Kota Pekan Ini */}
              <div className={`p-4 rounded-2xl border transition shadow-sm ${
                weekCompliance.isCompliant
                  ? 'bg-gradient-to-r from-emerald-950/40 via-slate-950 to-indigo-950/30 border-emerald-500/40'
                  : 'bg-gradient-to-r from-amber-950/40 via-slate-950 to-purple-950/30 border-amber-500/40'
              }`}>
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className={`px-2.5 py-1 rounded-lg font-black text-xs border flex items-center gap-1.5 ${
                        weekCompliance.isCompliant 
                          ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' 
                          : 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                      }`}>
                        <Shield className="w-3.5 h-3.5" />
                        <span>PERSYARATAN PEKAN {selectedWeek}: {weekConfig.theme}</span>
                      </span>
                      <span className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                        weekCompliance.isCompliant ? 'bg-emerald-500/20 text-emerald-300' : 'bg-amber-500/20 text-amber-300'
                      }`}>
                        {weekCompliance.statusText}
                      </span>
                    </div>
                    <h5 className="font-bold text-white text-sm mt-1.5 flex items-center gap-2">
                      <span>"{weekConfig.requirement}"</span>
                    </h5>
                    <p className="text-slate-300 text-xs mt-1 leading-relaxed">
                      {weekCompliance.summaryText}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap shrink-0">
                    <button
                      onClick={handleSyncSpecialRequirement}
                      className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow"
                    >
                      <Sparkles className="w-3.5 h-3.5 text-indigo-200" />
                      <span>{weekCompliance.fixButtonLabel || 'Selaraskan Kru Khusus'}</span>
                    </button>

                    <button
                      onClick={handleResetCurrentWeek}
                      className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl text-xs font-bold border border-slate-700 transition flex items-center gap-1.5 cursor-pointer"
                      title="Reset kembali ke alokasi resmi"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      <span>Reset Pekan {selectedWeek}</span>
                    </button>
                  </div>
                </div>

                {/* Checklist criteria */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mt-3 pt-3 border-t border-slate-800/80 text-[11px]">
                  {weekCompliance.checklist.map(chk => (
                    <div key={chk.id} className="bg-slate-900/80 p-2.5 rounded-xl border border-slate-800/80 flex items-start gap-2">
                      {chk.passed ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                      ) : (
                        <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                      )}
                      <div>
                        <div className={`font-bold ${chk.passed ? 'text-emerald-300' : 'text-amber-300'}`}>
                          {chk.label}
                        </div>
                        <div className="text-[10px] text-slate-400 mt-0.5">{chk.detail}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Day filter tabs for Luar Kota */}
              <div className="flex items-center justify-between bg-slate-950 p-2 rounded-xl border border-slate-800 flex-wrap gap-2">
                <div className="flex items-center gap-1 flex-wrap">
                  <button
                    onClick={() => setSelectedDayTab('Semua')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                      selectedDayTab === 'Semua' ? 'bg-purple-600 text-white' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Semua Hari ({luarKotaRoutes.length})
                  </button>
                  {daysList.map(day => {
                    const count = luarKotaRoutes.filter(r => r.day === day).length;
                    return (
                      <button
                        key={day}
                        onClick={() => setSelectedDayTab(day)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                          selectedDayTab === day ? 'bg-purple-600 text-white' : 'text-slate-400 hover:text-white'
                        }`}
                      >
                        <span>{day}</span>
                        <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                          count > 0 ? (selectedDayTab === day ? 'bg-purple-800 text-white' : 'bg-slate-800 text-slate-300') : 'bg-emerald-950 text-emerald-300'
                        }`}>
                          {count > 0 ? count : 'OFF'}
                        </span>
                      </button>
                    );
                  })}
                </div>

                <div className="text-[11px] text-slate-400">
                  Total Rute Luar Kota: <strong className="text-white">{displayedRoutes.length} Rute</strong>
                </div>
              </div>

              {/* List of Luar Kota Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {displayedRoutes.map((item) => {
                  const driverConflict = checkDriverConflict(item.driverId, item.day);
                  const isBali = item.category === 'Inter-Island';

                  return (
                    <div 
                      key={item.id}
                      className={`p-4 rounded-2xl border transition shadow-sm ${
                        driverConflict 
                          ? 'bg-rose-950/20 border-rose-800/80 ring-1 ring-rose-500/30' 
                          : 'bg-slate-950 border-slate-800 hover:border-slate-700'
                      }`}
                    >
                      {/* Special Week Requirement Tag */}
                      {(() => {
                        let reqBadge: { title: string; color: string } | null = null;
                        if (selectedWeek === 1 && item.route === 'Denpasar 1 (Bali)') {
                          reqBadge = { title: '⭐ Syarat Minggu 1: Driver & Helper Denpasar 1 Sama (Senin & Rabu)', color: 'bg-purple-500/20 text-purple-300 border-purple-500/40' };
                        } else if (selectedWeek === 2 && item.route.includes('Singaraja')) {
                          reqBadge = { title: '⭐ Syarat Minggu 2: Driver & Helper Singaraja & Susulan Sama', color: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40' };
                        } else if (selectedWeek === 3 && (item.route === 'Jember Selatan' || item.route === 'Jember Barat' || item.route === 'Jember Kota')) {
                          reqBadge = { title: `⭐ Syarat Minggu 3: Klaster Jember (${item.route})`, color: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40' };
                        } else if (selectedWeek === 4 && (item.route === 'Situbondo' || item.route === 'Bondowoso' || item.route.includes('Situbondo') || item.route.includes('Negara'))) {
                          reqBadge = { title: `⭐ Syarat Minggu 4: ${item.route}`, color: 'bg-amber-500/20 text-amber-300 border-amber-500/40' };
                        }
                        if (!reqBadge) return null;
                        return (
                          <div className={`p-2 rounded-xl border text-[11px] font-bold mb-3 flex items-center justify-between ${reqBadge.color}`}>
                            <span>{reqBadge.title}</span>
                            <span className="text-[9px] uppercase font-mono px-1.5 py-0.5 bg-slate-900/60 rounded">Prioritas</span>
                          </div>
                        );
                      })()}

                      {/* Top Bar */}
                      <div className="flex items-start justify-between gap-2 mb-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-xs bg-purple-950/80 text-purple-300 px-2 py-0.5 rounded border border-purple-800/60">
                              Hari {item.day}
                            </span>
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              isBali ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30' : 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                            }`}>
                              {isBali ? 'Inter-Island (Bali)' : 'Luar Kota (Jawa Timur)'}
                            </span>
                          </div>
                          <h5 className="font-black text-white text-sm mt-1.5 flex items-center gap-1.5">
                            <MapPin className="w-4 h-4 text-emerald-400" />
                            <span>{item.route}</span>
                          </h5>
                        </div>

                        <div className="text-right">
                          <div className="font-mono text-emerald-400 font-bold text-xs">
                            SLA {item.slaEst}
                          </div>
                          <div className="text-[10px] text-slate-400 mt-0.5 font-mono">
                            ⚡ {item.distanceKm} KM • ~{item.estimatedHours} Jam
                          </div>
                        </div>
                      </div>

                      {/* Transit / Ferry Info if Bali */}
                      {item.ferryRoute && (
                        <div className="bg-indigo-950/40 p-2.5 rounded-xl border border-indigo-900/50 mb-3 flex items-center justify-between text-[11px] text-indigo-200">
                          <div className="flex items-center gap-2">
                            <Ship className="w-4 h-4 text-indigo-400 shrink-0" />
                            <span>Penyeberangan Ferry ASDP: <strong>{item.ferryRoute}</strong></span>
                          </div>
                          <span className="text-[10px] bg-indigo-500/20 text-indigo-300 px-2 py-0.5 rounded font-mono font-bold">
                            Tiket Terkunci
                          </span>
                        </div>
                      )}

                      {/* Conflict Warning or Compliant Badge */}
                      {driverConflict ? (
                        <div className="bg-rose-500/15 border border-rose-500/30 text-rose-300 p-2.5 rounded-xl text-[11px] flex items-center gap-2 mb-3">
                          <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                          <span>{driverConflict}</span>
                        </div>
                      ) : (
                        <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 p-2 rounded-xl text-[10px] flex items-center justify-between mb-3">
                          <span className="flex items-center gap-1.5">
                            <Check className="w-3.5 h-3.5 text-emerald-400" />
                            <span>Jeda Istirahat Driver Terpenuhi (Tidak Berturut-turut Luar Kota)</span>
                          </span>
                          <span className="font-bold text-emerald-400">Aman</span>
                        </div>
                      )}

                      {/* Assignment Selectors */}
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-slate-800/80">
                        <div>
                          <label className="text-[10px] font-bold text-slate-400 uppercase flex items-center gap-1">
                            <User className="w-3 h-3 text-indigo-400" />
                            <span>Driver Utama</span>
                          </label>
                          <select
                            value={item.driverId}
                            onChange={(e) => handleRouteChange(item.id, 'driverId', e.target.value)}
                            className="bg-slate-900 border border-slate-800 text-white rounded-lg px-2 py-1.5 focus:outline-none w-full text-xs font-medium mt-1"
                          >
                            {driversList.map(d => (
                              <option key={d.id} value={d.id}>{d.name} ({d.licenseType})</option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className="text-[10px] font-bold text-slate-400 uppercase flex items-center gap-1">
                            <Users className="w-3 h-3 text-emerald-400" />
                            <span>Helper / Kernet</span>
                          </label>
                          <select
                            value={item.helperId}
                            onChange={(e) => handleRouteChange(item.id, 'helperId', e.target.value)}
                            className="bg-slate-900 border border-slate-800 text-white rounded-lg px-2 py-1.5 focus:outline-none w-full text-xs font-medium mt-1"
                          >
                            <option value="">-- Tanpa Helper --</option>
                            {helpersList.map(h => (
                              <option key={h.id} value={h.id}>{h.name}</option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className="text-[10px] font-bold text-slate-400 uppercase flex items-center gap-1">
                            <Truck className="w-3 h-3 text-amber-400" />
                            <span>Armada Truk</span>
                          </label>
                          <select
                            value={item.truckId}
                            onChange={(e) => handleRouteChange(item.id, 'truckId', e.target.value)}
                            className="bg-slate-900 border border-slate-800 text-white rounded-lg px-2 py-1.5 focus:outline-none w-full text-xs font-medium mt-1"
                          >
                            {fleets.map(f => (
                              <option key={f.id} value={f.id}>
                                {f.plateNumber} {f.initialCode ? `(${f.initialCode})` : ''} ({f.vehicleType})
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>

                    </div>
                  );
                })}
              </div>

              {/* Step Navigation Footer */}
              <div className="p-4 bg-slate-950 border border-slate-800 rounded-2xl flex items-center justify-between">
                <div className="text-slate-400 text-xs">
                  Semua 13 rute luar kota & antar-pulau telah diprioritaskan. Klik tombol di kanan untuk melanjutkan ke kiriman sisa.
                </div>
                <button
                  onClick={() => setActiveStepTab('kiriman_sisa')}
                  className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl shadow cursor-pointer text-xs flex items-center gap-2"
                >
                  <span>Lanjut: Atur Kiriman Sisa ({sisaLokalRoutes.length} Rute)</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>

            </div>
          )}

          {/* =========================================================================
              STEP 2: SIMULASI KIRIMAN SISA (LOKAL & RETAIL BANYUWANGI)
              ========================================================================= */}
          {activeStepTab === 'kiriman_sisa' && (
            <div className="space-y-6">
              
              <div className="bg-slate-950 p-5 rounded-2xl border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <span className="px-2.5 py-1 bg-indigo-500/20 text-indigo-300 rounded-lg font-black text-xs border border-indigo-500/30">
                    LANGKAH 2: KIRIMAN SISA (LOKAL & RETAIL BANYUWANGI)
                  </span>
                  <h4 className="font-black text-white text-base mt-2">
                    Penugasan 23 Rute Distribusi Lokal & Grosir Dalam Kota
                  </h4>
                  <p className="text-slate-400 text-xs mt-1">
                    Kru yang sedang jeda istirahat dari luar kota dapat dialokasikan rute lokal jarak pendek (Genteng, Rogojampi, Muncar, Srono, Jajag, Grosir Hub).
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={handleAutoAllocateKirimanSisa}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold shadow transition cursor-pointer flex items-center gap-1.5"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Auto-Alokasi Kiriman Sisa</span>
                  </button>
                </div>
              </div>

              {/* Day Tabs for Local */}
              <div className="flex items-center bg-slate-950 p-2 rounded-xl border border-slate-800 flex-wrap gap-1">
                <button
                  onClick={() => setSelectedDayTab('Semua')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                    selectedDayTab === 'Semua' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Semua ({sisaLokalRoutes.length})
                </button>
                {daysList.map(day => {
                  const count = sisaLokalRoutes.filter(r => r.day === day).length;
                  return (
                    <button
                      key={day}
                      onClick={() => setSelectedDayTab(day)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                        selectedDayTab === day ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      <span>{day}</span>
                      <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-slate-800 text-slate-300">
                        {count}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Table of Local Routes */}
              <div className="border border-slate-800 rounded-2xl overflow-hidden bg-slate-950">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-900 text-slate-400 border-b border-slate-800 text-[10px] uppercase font-bold tracking-wider">
                      <tr>
                        <th className="p-3.5">Hari</th>
                        <th className="p-3.5">Rute Lokal / Cluster</th>
                        <th className="p-3.5">Kategori</th>
                        <th className="p-3.5">Driver Utama</th>
                        <th className="p-3.5">Helper / Kernet</th>
                        <th className="p-3.5">Armada Truk</th>
                        <th className="p-3.5">Jarak & Est</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/80 text-white">
                      {displayedRoutes.map((item) => (
                        <tr key={item.id} className="hover:bg-slate-900/60 transition">
                          <td className="p-3.5">
                            <span className="font-bold text-indigo-400 bg-indigo-950/60 px-2 py-1 rounded-md border border-indigo-900/60">
                              {item.day}
                            </span>
                          </td>

                          <td className="p-3.5 font-bold text-white">
                            {item.route}
                          </td>

                          <td className="p-3.5">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              item.category === 'Grosir' ? 'bg-blue-500/20 text-blue-300' :
                              item.category === 'Susulan' ? 'bg-amber-500/20 text-amber-300' :
                              'bg-emerald-500/20 text-emerald-300'
                            }`}>
                              {item.category}
                            </span>
                          </td>

                          <td className="p-3.5">
                            <select
                              value={item.driverId}
                              onChange={(e) => handleRouteChange(item.id, 'driverId', e.target.value)}
                              className="bg-slate-900 border border-slate-800 text-white rounded-lg px-2 py-1 text-xs w-full"
                            >
                              {driversList.map(d => (
                                <option key={d.id} value={d.id}>{d.name}</option>
                              ))}
                            </select>
                          </td>

                          <td className="p-3.5">
                            <select
                              value={item.helperId}
                              onChange={(e) => handleRouteChange(item.id, 'helperId', e.target.value)}
                              className="bg-slate-900 border border-slate-800 text-white rounded-lg px-2 py-1 text-xs w-full"
                            >
                              <option value="">-- Tanpa Helper --</option>
                              {helpersList.map(h => (
                                <option key={h.id} value={h.id}>{h.name}</option>
                              ))}
                            </select>
                          </td>

                          <td className="p-3.5">
                            <select
                              value={item.truckId}
                              onChange={(e) => handleRouteChange(item.id, 'truckId', e.target.value)}
                              className="bg-slate-900 border border-slate-800 text-white rounded-lg px-2 py-1 text-xs w-full"
                            >
                              {fleets.map(f => (
                                <option key={f.id} value={f.id}>
                                  {f.plateNumber} {f.initialCode ? `(${f.initialCode})` : ''} ({f.vehicleType})
                                </option>
                              ))}
                            </select>
                          </td>

                          <td className="p-3.5 text-slate-400 font-mono text-[11px]">
                            {item.distanceKm} KM • ~{item.estimatedHours} Jam
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Step Navigation Footer */}
              <div className="p-4 bg-slate-950 border border-slate-800 rounded-2xl flex items-center justify-between">
                <button
                  onClick={() => setActiveStepTab('luar_kota')}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-xl text-xs flex items-center gap-1.5"
                >
                  <span>⬅️ Kembali ke Prioritas Luar Kota</span>
                </button>
                <button
                  onClick={() => setActiveStepTab('matriks_terpadu')}
                  className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl shadow text-xs flex items-center gap-2"
                >
                  <span>Lihat Matriks Mingguan Lengkap ➡️</span>
                </button>
              </div>

            </div>
          )}

          {/* =========================================================================
              STEP 3: MATRIKS TERPADU & AUDIT JEDA KRU (SENIN - SABTU)
              ========================================================================= */}
          {activeStepTab === 'matriks_terpadu' && (
            <div className="space-y-6">
              
              {/* Pekan Status Banner in Step 3 */}
              <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400 font-black text-sm shrink-0">
                    W{selectedWeek}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-white text-sm">Audit Matriks Pekan {selectedWeek}: {weekConfig.theme}</span>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        weekCompliance.isCompliant ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                      }`}>
                        {weekCompliance.statusText}
                      </span>
                    </div>
                    <div className="text-slate-400 text-xs mt-0.5">
                      Persyaratan: <em>"{weekConfig.requirement}"</em> • {weekCompliance.summaryText}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0 flex-wrap">
                  <button
                    onClick={handleSyncSpecialRequirement}
                    className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>{weekCompliance.fixButtonLabel}</span>
                  </button>
                  <button
                    onClick={handleResetCurrentWeek}
                    className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg text-xs font-bold border border-slate-700 transition flex items-center gap-1 cursor-pointer"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Reset Pekan {selectedWeek}</span>
                  </button>
                </div>
              </div>

              {/* Summary Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 bg-slate-950 p-4 rounded-2xl border border-slate-800 text-xs">
                <div className="p-3 rounded-xl bg-slate-900 border border-slate-800">
                  <div className="text-slate-400 text-[10px]">Total Rute Terstruktur</div>
                  <div className="text-lg font-black text-white mt-0.5">36 Rute</div>
                  <div className="text-[10px] text-indigo-400 mt-1">13 Luar Kota • 23 Lokal</div>
                </div>

                <div className="p-3 rounded-xl bg-slate-900 border border-slate-800">
                  <div className="text-slate-400 text-[10px]">Kepatuhan Jeda Istirahat</div>
                  <div className="text-lg font-black text-emerald-400 mt-0.5">
                    {restGapAnalysis.isFullyCompliant ? '100% Sempurna' : `${restGapAnalysis.violations.length} Konflik`}
                  </div>
                  <div className="text-[10px] text-emerald-300 mt-1">Anti-Kelelahan Terverifikasi</div>
                </div>

                <div className="p-3 rounded-xl bg-slate-900 border border-slate-800">
                  <div className="text-slate-400 text-[10px]">Rotasi Variasi Area Kru</div>
                  <div className={`text-lg font-black mt-0.5 ${
                    areaRotationAudit.isFullyVaried ? 'text-emerald-400' : 'text-amber-400'
                  }`}>
                    {areaRotationAudit.isFullyVaried ? '100% Beragam' : `${areaRotationAudit.repeatedAssignmentsCount} Berulang`}
                  </div>
                  <div className="text-[10px] text-slate-400 mt-1">
                    {areaRotationAudit.isFullyVaried ? 'Bebas Pengulangan Area' : 'Override Mendesak Terpantau'}
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-slate-900 border border-slate-800">
                  <div className="text-slate-400 text-[10px]">Rute Inter-Island Bali</div>
                  <div className="text-lg font-black text-purple-400 mt-0.5">6 Rute</div>
                  <div className="text-[10px] text-purple-300 mt-1">Denpasar, Singaraja, Negara</div>
                </div>

                <div className="p-3 rounded-xl bg-slate-900 border border-slate-800">
                  <div className="text-slate-400 text-[10px]">Hari Pemulihan Penuh</div>
                  <div className="text-lg font-black text-amber-400 mt-0.5">Jumat</div>
                  <div className="text-[10px] text-amber-300 mt-1">0 Luar Kota • Servis Armada</div>
                </div>
              </div>

              {/* 6-Column Grid View */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
                {daysList.map((day) => {
                  const dayRoutes = currentWeekRoutes.filter(r => r.day === day);
                  const lkRoutes = dayRoutes.filter(r => r.isLuarKota);
                  const totalKm = dayRoutes.reduce((acc, r) => acc + r.distanceKm, 0);

                  return (
                    <div key={day} className="bg-slate-950 border border-slate-800 rounded-2xl p-3 flex flex-col justify-between space-y-3">
                      <div className="pb-2.5 border-b border-slate-800">
                        <div className="flex items-center justify-between">
                          <span className="font-black text-white text-xs uppercase flex items-center gap-1">
                            <Calendar className="w-3.5 h-3.5 text-indigo-400" />
                            <span>{day}</span>
                          </span>
                          <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                            lkRoutes.length > 0 ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30' : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                          }`}>
                            {lkRoutes.length} LK • {dayRoutes.length} Tot
                          </span>
                        </div>
                        <div className="text-[10px] text-slate-400 mt-1">
                          Total: <strong className="text-slate-200">{totalKm} KM</strong>
                        </div>
                      </div>

                      <div className="space-y-2 flex-1">
                        {dayRoutes.map((r, idx) => {
                          const driver = crews.find(c => c.id === r.driverId);
                          const helper = crews.find(c => c.id === r.helperId);
                          const fleet = fleets.find(f => f.id === r.truckId);

                          return (
                            <div 
                              key={r.id}
                              onClick={() => setSelectedStep3Route(r)}
                              title="Klik untuk melihat detail & rotasi penugasan kru"
                              className={`p-2 rounded-xl border text-left text-[10px] cursor-pointer transition hover:scale-[1.02] hover:shadow-lg ${
                                r.isLuarKota 
                                  ? 'bg-purple-950/40 border-purple-800/60 ring-1 ring-purple-500/20 hover:border-purple-400' 
                                  : 'bg-slate-900/70 border-slate-800 hover:border-slate-600'
                              }`}
                            >
                              <div className="flex items-center justify-between gap-1 mb-1">
                                <span className="font-bold text-white truncate max-w-[100px]" title={r.route}>
                                  {r.route}
                                </span>
                                <span className={`px-1 py-0.2 rounded text-[8px] font-bold ${
                                  r.isLuarKota ? 'bg-purple-500/20 text-purple-300' : 'bg-slate-800 text-slate-400'
                                }`}>
                                  {r.isLuarKota ? 'Luar Kota' : 'Lokal'}
                                </span>
                              </div>

                              <div className="text-slate-400 flex items-center justify-between">
                                <span className="text-slate-300 font-semibold truncate max-w-[70px]">
                                  👨‍✈️ {driver ? driver.name.split(' ')[0] : '-'}
                                </span>
                                <span className="font-mono text-slate-400 text-[9px]">
                                  🚛 {fleet ? fleet.plateNumber : '-'}
                                </span>
                              </div>

                              {helper && (
                                <div className="text-[8px] text-slate-500 truncate mt-0.5">
                                  Helper: {helper.name.split(' ')[0]}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>

            </div>
          )}

        </div>

        {/* Modal Footer */}
        <div className="bg-slate-950 px-6 py-4 border-t border-slate-800 flex items-center justify-between shrink-0 text-xs">
          <div className="text-slate-400 flex items-center gap-2">
            <Shield className="w-4 h-4 text-emerald-400" />
            <span>Siklus Penugasan Area Terstruktur • Validasi Jeda Istirahat & Rotasi Area Aktif</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold transition cursor-pointer"
            >
              Tutup Simulasi
            </button>
            <button
              onClick={handleSaveAndSyncToDatabase}
              className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold transition cursor-pointer shadow flex items-center gap-1.5"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>Kunci & Terapkan Jadwal</span>
            </button>
          </div>
        </div>

      </div>

      {/* Pop-up Peringatan Rotasi Area (Area Berulang / Keadaan Mendesak) */}
      <AreaRepetitionWarningModal
        isOpen={Boolean(areaConflict)}
        conflict={areaConflict}
        onProceedUrgent={() => {
          if (pendingChange) {
            applyRouteChange(pendingChange.routeId, pendingChange.field, pendingChange.value);
            setNotificationMsg(`⚠️ Penugasan Area Berulang Diterapkan (Keadaan Mendesak): ${areaConflict?.crewName} ke area ${areaConflict?.areaName}`);
            setTimeout(() => setNotificationMsg(null), 5000);
          }
          setAreaConflict(null);
          setPendingChange(null);
        }}
        onSelectAlternative={(newCrewId) => {
          if (pendingChange) {
            applyRouteChange(pendingChange.routeId, pendingChange.field, newCrewId);
            const altCrew = crews.find(c => c.id === newCrewId);
            setNotificationMsg(`✅ Berhasil Mengganti Kru: Ditugaskan ke ${altCrew ? altCrew.name : 'Kru Baru'}`);
            setTimeout(() => setNotificationMsg(null), 5000);
          }
          setAreaConflict(null);
          setPendingChange(null);
        }}
        onCancel={() => {
          setAreaConflict(null);
          setPendingChange(null);
        }}
      />

      {/* Quick Route Reassign Modal for Step 3 Matriks */}
      {selectedStep3Route && (
        <div className="fixed inset-0 z-[110] bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-md w-full p-5 space-y-4 shadow-2xl animate-fade-in">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-400">
                  Rotasi & Penugasan Kru ({selectedStep3Route.day})
                </span>
                <h4 className="text-base font-bold text-white mt-0.5">{selectedStep3Route.route}</h4>
              </div>
              <button
                onClick={() => setSelectedStep3Route(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Route Stats */}
            <div className="grid grid-cols-3 gap-2 text-center text-xs">
              <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800">
                <div className="text-slate-500 text-[10px]">Tipe</div>
                <div className="font-bold text-slate-200 mt-0.5">{selectedStep3Route.isLuarKota ? 'Luar Kota' : 'Lokal'}</div>
              </div>
              <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800">
                <div className="text-slate-500 text-[10px]">Jarak</div>
                <div className="font-bold text-slate-200 mt-0.5">{selectedStep3Route.distanceKm} KM</div>
              </div>
              <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800">
                <div className="text-slate-500 text-[10px]">Estimasi</div>
                <div className="font-bold text-slate-200 mt-0.5">{selectedStep3Route.estimatedHours} Jam</div>
              </div>
            </div>

            {/* Driver Select */}
            <div className="space-y-1.5 text-xs">
              <label className="text-slate-300 font-semibold flex items-center justify-between">
                <span>Driver Utama:</span>
                <span className="text-[10px] text-slate-400 font-normal">Cek Rotasi Area Aktif</span>
              </label>
              <select
                value={currentWeekRoutes.find(r => r.id === selectedStep3Route.id)?.driverId || ''}
                onChange={(e) => handleRouteChange(selectedStep3Route.id, 'driverId', e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white text-xs focus:ring-1 focus:ring-indigo-500"
              >
                <option value="">-- Pilih Driver Utama --</option>
                {driversList.map(d => (
                  <option key={d.id} value={d.id}>
                    {d.name} ({d.licenseType})
                  </option>
                ))}
              </select>
            </div>

            {/* Helper Select */}
            <div className="space-y-1.5 text-xs">
              <label className="text-slate-300 font-semibold flex items-center justify-between">
                <span>Helper / Kernet:</span>
                <span className="text-[10px] text-slate-400 font-normal">Cek Rotasi Area Aktif</span>
              </label>
              <select
                value={currentWeekRoutes.find(r => r.id === selectedStep3Route.id)?.helperId || ''}
                onChange={(e) => handleRouteChange(selectedStep3Route.id, 'helperId', e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white text-xs focus:ring-1 focus:ring-indigo-500"
              >
                <option value="">-- Tanpa Helper / Pilih --</option>
                {helpersList.map(h => (
                  <option key={h.id} value={h.id}>
                    {h.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Fleet Select */}
            <div className="space-y-1.5 text-xs">
              <label className="text-slate-300 font-semibold">Armada Truk:</label>
              <select
                value={currentWeekRoutes.find(r => r.id === selectedStep3Route.id)?.truckId || ''}
                onChange={(e) => handleRouteChange(selectedStep3Route.id, 'truckId', e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white text-xs focus:ring-1 focus:ring-indigo-500"
              >
                <option value="">-- Pilih Truk --</option>
                {fleets.map(f => (
                  <option key={f.id} value={f.id}>
                    {f.plateNumber} {f.initialCode ? `(${f.initialCode})` : ''} ({f.vehicleType} - {f.tonnageCapacity || 2} Ton)
                  </option>
                ))}
              </select>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                onClick={() => setSelectedStep3Route(null)}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold text-xs transition cursor-pointer"
              >
                Selesai & Tutup
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
