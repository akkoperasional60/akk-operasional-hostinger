import React, { useState, useMemo, useEffect } from 'react';
import { 
  Users, 
  Truck, 
  Calendar, 
  Sparkles, 
  AlertTriangle, 
  CheckCircle2, 
  Shield, 
  Filter, 
  Search, 
  RefreshCw, 
  Download, 
  Clock, 
  MapPin, 
  Ship, 
  GripVertical, 
  Move, 
  Info, 
  Check, 
  Layers, 
  LayoutGrid, 
  Columns,
  Eye,
  ArrowRight,
  Zap,
  Repeat
} from 'lucide-react';
import { Crew, Fleet, RetailStore, ShipmentStatus } from '../types';
import { logisticsStore } from '../services/store';
import { 
  DailyScheduleRoute, 
  DayOfWeek 
} from './CrewSimulationModal';
import { 
  WEEK_SIMULATION_CONFIGS, 
  buildWeekSchedule, 
  validateWeekCompliance 
} from '../services/simulationScheduleEngine';
import { AreaRepetitionWarningModal } from './AreaRepetitionWarningModal';
import { 
  checkAreaRepetitionConflict, 
  auditWeekAreaRotations, 
  AreaRepetitionConflict 
} from '../services/areaRotationValidator';

interface WeeklyRoutePlannerProps {
  crews: Crew[];
  fleets: Fleet[];
  stores: RetailStore[];
  onClose?: () => void;
}

type PlannerMode = 'by_driver' | 'by_fleet' | 'by_day';

const DAYS_OF_WEEK: DayOfWeek[] = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];

export const WeeklyRoutePlanner: React.FC<WeeklyRoutePlannerProps> = ({
  crews,
  fleets,
  stores,
  onClose
}) => {
  // Selected week (1 - 4)
  const [selectedWeek, setSelectedWeek] = useState<number>(1);
  // Planner grouping mode: by_driver (Kru) vs by_fleet (Mobil) vs by_day (Hari)
  const [plannerMode, setPlannerMode] = useState<PlannerMode>('by_driver');
  // Filters
  const [selectedDayFilter, setSelectedDayFilter] = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState<'all' | 'luar_kota' | 'lokal'>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  
  // Notification toast
  const [toastMessage, setToastMessage] = useState<{ type: 'success' | 'warning' | 'info'; text: string } | null>(null);

  // Drag & drop tracking state
  const [draggedRoute, setDraggedRoute] = useState<DailyScheduleRoute | null>(null);
  const [dragOverTargetId, setDragOverTargetId] = useState<string | null>(null);

  // Detail Modal State
  const [selectedRouteDetail, setSelectedRouteDetail] = useState<DailyScheduleRoute | null>(null);

  // States for Area Repetition Conflict & Urgent Override
  const [areaConflict, setAreaConflict] = useState<AreaRepetitionConflict | null>(null);
  const [pendingDrop, setPendingDrop] = useState<{
    route: DailyScheduleRoute;
    targetDriverId: string;
    sameDayRoute?: DailyScheduleRoute;
  } | null>(null);

  // 4-Week Schedule State loaded from store/localStorage
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

  // Current active week routes
  const currentWeekRoutes = useMemo(() => {
    return allWeeksData[selectedWeek] || allWeeksData[1];
  }, [allWeeksData, selectedWeek]);

  // Current week config
  const weekConfig = WEEK_SIMULATION_CONFIGS[selectedWeek] || WEEK_SIMULATION_CONFIGS[1];

  // Compliance check for current week
  const weekCompliance = useMemo(() => {
    return validateWeekCompliance(selectedWeek, currentWeekRoutes, crews);
  }, [selectedWeek, currentWeekRoutes, crews]);

  // Anti-Back-to-Back Rest Gap calculation for all drivers
  const driverRestAnalysis = useMemo(() => {
    const dayIndices: Record<DayOfWeek, number> = {
      'Senin': 0, 'Selasa': 1, 'Rabu': 2, 'Kamis': 3, 'Jumat': 4, 'Sabtu': 5
    };

    const driverAssignments = new Map<string, { days: number[]; dayNames: DayOfWeek[]; routes: DailyScheduleRoute[] }>();

    currentWeekRoutes.forEach(route => {
      if (route.driverId && route.isLuarKota) {
        const existing = driverAssignments.get(route.driverId) || { days: [], dayNames: [], routes: [] };
        const dayIdx = dayIndices[route.day];
        if (!existing.days.includes(dayIdx)) {
          existing.days.push(dayIdx);
          existing.dayNames.push(route.day);
          existing.days.sort((a, b) => a - b);
        }
        existing.routes.push(route);
        driverAssignments.set(route.driverId, existing);
      }
    });

    const conflicts = new Map<string, string[]>();

    driverAssignments.forEach((data, driverId) => {
      const issues: string[] = [];
      for (let i = 0; i < data.days.length - 1; i++) {
        if (data.days[i + 1] === data.days[i] + 1) {
          const d1 = DAYS_OF_WEEK[data.days[i]];
          const d2 = DAYS_OF_WEEK[data.days[i + 1]];
          issues.push(`Dinas Luar Kota berurutan tanpa istirahat: ${d1} & ${d2}!`);
        }
      }
      if (issues.length > 0) {
        conflicts.set(driverId, issues);
      }
    });

    return {
      conflicts,
      hasConflicts: conflicts.size > 0
    };
  }, [currentWeekRoutes]);

  // Area Rotation & Anti-Repetition Audit
  const areaRotationAudit = useMemo(() => {
    return auditWeekAreaRotations(currentWeekRoutes, crews);
  }, [currentWeekRoutes, crews]);

  // Helper lists
  const driversList = useMemo(() => {
    return crews.filter(c => c.role === 'Driver Utama' || c.role === 'Driver Cadangan');
  }, [crews]);

  const helpersList = useMemo(() => {
    return crews.filter(c => c.role === 'Kernet / Helper');
  }, [crews]);

  // Save changes to localStorage and optionally sync to store
  const saveWeeksData = (newData: Record<number, DailyScheduleRoute[]>) => {
    setAllWeeksData(newData);
    try {
      localStorage.setItem('akk_simulasi_weeks_v2', JSON.stringify(newData));
    } catch {
      // ignore
    }
  };

  // Helper to execute driver reassignment
  const executeDriverDrop = (
    route: DailyScheduleRoute,
    targetDriverId: string,
    sameDayRoute?: DailyScheduleRoute,
    isUrgentOverride: boolean = false
  ) => {
    const targetDriver = crews.find(c => c.id === targetDriverId);
    const driverName = targetDriver ? targetDriver.name : 'Kru Baru';

    const updatedRoutes = currentWeekRoutes.map(r => {
      if (r.id === route.id) {
        return { ...r, driverId: targetDriverId };
      }
      return r;
    });

    const updatedAllWeeks = {
      ...allWeeksData,
      [selectedWeek]: updatedRoutes
    };

    saveWeeksData(updatedAllWeeks);

    if (isUrgentOverride) {
      setToastMessage({
        type: 'warning',
        text: `⚠️ Override Mendesak Diterapkan: Rute "${route.route}" (${route.day}) ditugaskan ke Driver: ${driverName} (Area Berulang).`
      });
    } else if (sameDayRoute) {
      setToastMessage({
        type: 'warning',
        text: `⚠️ Perhatian: ${driverName} sekarang memiliki 2 rute pada hari ${route.day} (${route.route} & ${sameDayRoute.route}).`
      });
    } else {
      setToastMessage({
        type: 'success',
        text: `✅ Rute "${route.route}" (${route.day}) berhasil dipindahkan ke Driver: ${driverName}.`
      });
    }

    setDraggedRoute(null);
    setTimeout(() => setToastMessage(null), 4000);
  };

  // Drag Handlers
  const handleDragStart = (e: React.DragEvent, route: DailyScheduleRoute) => {
    setDraggedRoute(route);
    e.dataTransfer.setData('text/plain', route.id);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverTargetId !== targetId) {
      setDragOverTargetId(targetId);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOverTargetId(null);
  };

  const handleDropOnDriver = (e: React.DragEvent, targetDriverId: string) => {
    e.preventDefault();
    setDragOverTargetId(null);
    if (!draggedRoute) return;

    if (draggedRoute.driverId === targetDriverId) {
      setDraggedRoute(null);
      return;
    }

    // Check if target driver already has a route on this day
    const sameDayRoute = currentWeekRoutes.find(r => r.driverId === targetDriverId && r.day === draggedRoute.day && r.id !== draggedRoute.id);

    // Validate Anti-Area-Repetition Rule:
    // If driver already scheduled to Area A, warn and ask to proceed (urgent) or replace with alternative
    const conflict = checkAreaRepetitionConflict(
      draggedRoute.id,
      draggedRoute.route,
      draggedRoute.day,
      targetDriverId,
      'driverId',
      currentWeekRoutes,
      crews,
      selectedWeek
    );

    if (conflict) {
      setPendingDrop({ route: draggedRoute, targetDriverId, sameDayRoute });
      setAreaConflict(conflict);
      setDraggedRoute(null);
      return;
    }

    // Normal execution if no repetition conflict
    executeDriverDrop(draggedRoute, targetDriverId, sameDayRoute, false);
  };

  const handleDropOnFleet = (e: React.DragEvent, targetFleetId: string) => {
    e.preventDefault();
    setDragOverTargetId(null);
    if (!draggedRoute) return;

    if (draggedRoute.truckId === targetFleetId) {
      setDraggedRoute(null);
      return;
    }

    const targetFleet = fleets.find(f => f.id === targetFleetId);
    const plate = targetFleet ? `${targetFleet.plateNumber} (${targetFleet.vehicleType})` : 'Armada Baru';

    const updatedRoutes = currentWeekRoutes.map(r => {
      if (r.id === draggedRoute.id) {
        return { ...r, truckId: targetFleetId };
      }
      return r;
    });

    const updatedAllWeeks = {
      ...allWeeksData,
      [selectedWeek]: updatedRoutes
    };

    saveWeeksData(updatedAllWeeks);

    setToastMessage({
      type: 'success',
      text: `✅ Armada untuk rute "${draggedRoute.route}" berhasil dialihkan ke Truk: ${plate}.`
    });

    setDraggedRoute(null);
    setTimeout(() => setToastMessage(null), 4000);
  };

  const handleDropOnDay = (e: React.DragEvent, targetDay: DayOfWeek) => {
    e.preventDefault();
    setDragOverTargetId(null);
    if (!draggedRoute) return;

    if (draggedRoute.day === targetDay) {
      setDraggedRoute(null);
      return;
    }

    const updatedRoutes = currentWeekRoutes.map(r => {
      if (r.id === draggedRoute.id) {
        return { ...r, day: targetDay };
      }
      return r;
    });

    const updatedAllWeeks = {
      ...allWeeksData,
      [selectedWeek]: updatedRoutes
    };

    saveWeeksData(updatedAllWeeks);

    setToastMessage({
      type: 'success',
      text: `✅ Jadwal rute "${draggedRoute.route}" digeser ke hari ${targetDay}.`
    });

    setDraggedRoute(null);
    setTimeout(() => setToastMessage(null), 4000);
  };

  // Reassignment directly from detail modal with repetition check
  const handleRouteChangeInPlanner = (routeId: string, field: 'driverId' | 'helperId' | 'truckId', value: string) => {
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
          setPendingDrop({
            route: targetRoute,
            targetDriverId: value
          });
          setAreaConflict(conflict);
          return;
        }
      }
    }

    const updatedRoutes = currentWeekRoutes.map(r => {
      if (r.id === routeId) {
        const updated = { ...r, [field]: value };
        if (selectedRouteDetail?.id === routeId) {
          setSelectedRouteDetail(updated);
        }
        return updated;
      }
      return r;
    });

    const updatedAllWeeks = {
      ...allWeeksData,
      [selectedWeek]: updatedRoutes
    };
    saveWeeksData(updatedAllWeeks);

    const crewName = crews.find(c => c.id === value)?.name || 'Kru';
    setToastMessage({
      type: 'success',
      text: `✅ Penugasan berhasil diperbarui ke ${crewName}.`
    });
    setTimeout(() => setToastMessage(null), 3000);
  };

  // Reset current week to original simulation allocation
  const handleResetCurrentWeek = () => {
    const fresh = buildWeekSchedule(selectedWeek, crews, fleets);
    const updated = {
      ...allWeeksData,
      [selectedWeek]: fresh
    };
    saveWeeksData(updated);
    setToastMessage({
      type: 'info',
      text: `🔄 Jadwal Pekan ${selectedWeek} telah dikembalikan ke template resmi simulasi!`
    });
    setTimeout(() => setToastMessage(null), 4000);
  };

  // Synchronize designated requirement
  const handleApplyWeekRequirement = () => {
    const fresh = buildWeekSchedule(selectedWeek, crews, fleets);
    const updated = {
      ...allWeeksData,
      [selectedWeek]: fresh
    };
    saveWeeksData(updated);
    setToastMessage({
      type: 'success',
      text: `⭐ Persyaratan Pekan ${selectedWeek} (${weekConfig.theme}) berhasil diselaraskan 100%! Driver & Helper disamakan.`
    });
    setTimeout(() => setToastMessage(null), 4000);
  };

  // Filter routes based on day, category, and search query
  const filterRouteItem = (route: DailyScheduleRoute) => {
    if (selectedDayFilter !== 'all' && route.day !== selectedDayFilter) return false;
    if (categoryFilter === 'luar_kota' && !route.isLuarKota) return false;
    if (categoryFilter === 'lokal' && route.isLuarKota) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const driver = crews.find(c => c.id === route.driverId);
      const fleet = fleets.find(f => f.id === route.truckId);
      const helper = crews.find(c => c.id === route.helperId);
      const matchRoute = route.route.toLowerCase().includes(q);
      const matchDriver = driver?.name.toLowerCase().includes(q);
      const matchFleet = fleet?.plateNumber.toLowerCase().includes(q);
      const matchHelper = helper?.name.toLowerCase().includes(q);
      const matchDay = route.day.toLowerCase().includes(q);
      if (!matchRoute && !matchDriver && !matchFleet && !matchHelper && !matchDay) return false;
    }
    return true;
  };

  // Render Route Card (Draggable Item)
  const renderRouteCard = (item: DailyScheduleRoute) => {
    const driver = crews.find(c => c.id === item.driverId);
    const helper = crews.find(c => c.id === item.helperId);
    const fleet = fleets.find(f => f.id === item.truckId);
    const isDragging = draggedRoute?.id === item.id;
    const isBali = item.category === 'Inter-Island';

    // Requirement tag highlight
    let reqHighlight: string | null = null;
    if (selectedWeek === 1 && item.route === 'Denpasar 1 (Bali)') {
      reqHighlight = '⭐ Syarat P1: Kru Denpasar 1 Sama';
    } else if (selectedWeek === 2 && item.route.includes('Singaraja')) {
      reqHighlight = '⭐ Syarat P2: Kru Singaraja & Susulan Sama';
    } else if (selectedWeek === 3 && item.route.includes('Jember')) {
      reqHighlight = '⭐ Syarat P3: Klaster Jember';
    } else if (selectedWeek === 4 && (item.route.includes('Situbondo') || item.route.includes('Bondowoso') || item.route.includes('Negara'))) {
      reqHighlight = '⭐ Syarat P4: Tapal Kuda / Negara';
    }

    // Driver conflict warning
    const driverHasConflict = driver && driverRestAnalysis.conflicts.has(driver.id) && item.isLuarKota;

    return (
      <div
        key={item.id}
        draggable
        onDragStart={(e) => handleDragStart(e, item)}
        onClick={() => setSelectedRouteDetail(item)}
        className={`p-2.5 rounded-xl border text-xs cursor-grab active:cursor-grabbing transition-all select-none group relative shadow-sm ${
          isDragging
            ? 'opacity-40 scale-95 border-dashed border-indigo-400 bg-indigo-950/40'
            : driverHasConflict
            ? 'bg-rose-950/30 border-rose-800/70 hover:border-rose-600'
            : item.isLuarKota
            ? 'bg-purple-950/40 border-purple-800/60 hover:border-purple-600 hover:shadow-purple-900/20'
            : 'bg-slate-900/90 border-slate-800 hover:border-slate-700 hover:shadow-md'
        }`}
        title="Klik untuk detail atau geser (drag-and-drop) untuk memindahkan jadwal"
      >
        {/* Drag handle header */}
        <div className="flex items-center justify-between gap-1.5 mb-1.5">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="cursor-grab active:cursor-grabbing text-slate-500 group-hover:text-indigo-400 transition">
              <GripVertical className="w-3.5 h-3.5" />
            </span>
            <span className="font-mono font-bold text-[10px] px-1.5 py-0.5 rounded bg-indigo-950/80 text-indigo-300 border border-indigo-800/60">
              {item.day}
            </span>
            <span className={`text-[9px] font-bold px-1.5 py-0.2 rounded ${
              isBali ? 'bg-purple-500/20 text-purple-300' :
              item.isLuarKota ? 'bg-blue-500/20 text-blue-300' :
              'bg-slate-800 text-slate-400'
            }`}>
              {item.category}
            </span>
          </div>

          <span className="text-[10px] font-mono text-emerald-400 font-bold">
            {item.distanceKm} km
          </span>
        </div>

        {/* Route destination title */}
        <div className="font-bold text-white text-xs flex items-center gap-1.5 mb-1 truncate">
          <MapPin className="w-3 h-3 text-emerald-400 shrink-0" />
          <span className="truncate">{item.route}</span>
        </div>

        {/* Highlight badge for week's focal condition */}
        {reqHighlight && (
          <div className="text-[9px] font-bold text-amber-300 bg-amber-500/15 border border-amber-500/30 px-1.5 py-0.5 rounded mb-1.5 flex items-center justify-between">
            <span>{reqHighlight}</span>
            <span className="text-[8px] font-mono uppercase bg-amber-500/20 px-1 rounded">Fokus</span>
          </div>
        )}

        {/* Conflict alert badge if back-to-back */}
        {driverHasConflict && (
          <div className="text-[9px] font-bold text-rose-300 bg-rose-500/20 border border-rose-500/30 p-1 rounded mb-1.5 flex items-center gap-1">
            <AlertTriangle className="w-3 h-3 text-rose-400 shrink-0" />
            <span className="truncate">Perhatian: Jeda Istirahat Luar Kota Terganggu!</span>
          </div>
        )}

        {/* Meta details: Driver, Helper, Fleet */}
        <div className="grid grid-cols-2 gap-1 text-[10px] text-slate-400 pt-1.5 border-t border-slate-800/80">
          <div className="truncate flex items-center gap-1" title={driver ? driver.name : 'Belum Ditunjuk'}>
            <span className="text-slate-500">Supir:</span>
            <strong className="text-slate-200 truncate">{driver ? driver.name.split(' ')[0] : '-'}</strong>
          </div>
          <div className="truncate flex items-center gap-1" title={fleet ? fleet.plateNumber : 'Armada'}>
            <span className="text-slate-500">Truk:</span>
            <strong className="text-slate-200 font-mono truncate">{fleet ? fleet.plateNumber : '-'}</strong>
          </div>
          <div className="truncate col-span-2 flex items-center gap-1" title={helper ? helper.name : 'Tanpa Helper'}>
            <span className="text-slate-500">Helper:</span>
            <span className="text-slate-300 truncate">{helper ? helper.name : 'Tanpa Helper'}</span>
          </div>
        </div>

        {item.ferryRoute && (
          <div className="mt-1 text-[9px] text-purple-300/80 flex items-center gap-1 bg-purple-950/30 px-1.5 py-0.5 rounded border border-purple-900/40 truncate">
            <Ship className="w-2.5 h-2.5 shrink-0" />
            <span className="truncate">Kapal: {item.ferryRoute}</span>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      
      {/* Toast Notification Banner */}
      {toastMessage && (
        <div className={`p-3 rounded-xl border flex items-center justify-between gap-3 text-xs font-medium animate-fade-in shadow-lg ${
          toastMessage.type === 'success' 
            ? 'bg-emerald-950/80 border-emerald-500/50 text-emerald-200' 
            : toastMessage.type === 'warning'
            ? 'bg-amber-950/80 border-amber-500/50 text-amber-200'
            : 'bg-indigo-950/80 border-indigo-500/50 text-indigo-200'
        }`}>
          <div className="flex items-center gap-2">
            {toastMessage.type === 'success' && <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />}
            {toastMessage.type === 'warning' && <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />}
            {toastMessage.type === 'info' && <Info className="w-4 h-4 text-indigo-400 shrink-0" />}
            <span>{toastMessage.text}</span>
          </div>
          <button
            onClick={() => setToastMessage(null)}
            className="text-slate-400 hover:text-white text-xs underline cursor-pointer"
          >
            Tutup
          </button>
        </div>
      )}

      {/* Main Header & Simulation Context */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="px-2.5 py-1 rounded-lg bg-indigo-500/20 text-indigo-300 text-xs font-black border border-indigo-500/30 flex items-center gap-1.5">
                <Move className="w-3.5 h-3.5 text-indigo-400" />
                <span>PLANNER RUTE MINGGUAN (DRAG & DROP)</span>
              </span>
              <span className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                weekCompliance.isCompliant ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
              }`}>
                {weekCompliance.statusText}
              </span>
            </div>
            <h3 className="text-lg font-black text-white">
              Visual Board Penjadwalan & Pemindahan Rute Antar Kru / Armada
            </h3>
            <p className="text-xs text-slate-400 mt-1 max-w-3xl leading-relaxed">
              Tarik dan lepas kartu rute pengiriman langsung ke kolom Supir, Truk, atau Hari. Perubahan langsung tervalidasi dengan <strong>Aturan Jeda Istirahat Luar Kota</strong> dan <strong>Persyaratan Siklus 4 Pekan</strong>.
            </p>
          </div>

          {/* Top Actions */}
          <div className="flex items-center gap-2 flex-wrap shrink-0">
            <button
              onClick={handleApplyWeekRequirement}
              className="px-3.5 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white rounded-xl text-xs font-bold shadow transition flex items-center gap-1.5 cursor-pointer"
              title="Terapkan pola otomatis sesuai persyaratan pekan ini"
            >
              <Sparkles className="w-3.5 h-3.5 text-purple-200" />
              <span>Selaraskan Pekan {selectedWeek}</span>
            </button>

            <button
              onClick={handleResetCurrentWeek}
              className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl text-xs font-bold border border-slate-700 transition flex items-center gap-1.5 cursor-pointer"
              title="Kembalikan penugasan ke template resmi simulasi"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Reset Simulasi</span>
            </button>
          </div>
        </div>

        {/* SIKLUS SIMULASI 4 PEKAN SWITCHER */}
        <div className="mt-5 pt-4 border-t border-slate-800">
          <div className="flex items-center justify-between gap-2 mb-2">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-indigo-400" />
              <span>Pilih Siklus Simulasi 4 Pekan:</span>
            </span>
            <span className="text-[11px] text-slate-500">
              Total Rute Aktif: <strong className="text-white">{currentWeekRoutes.length} Rute</strong>
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
            {[1, 2, 3, 4].map(wNum => {
              const cfg = WEEK_SIMULATION_CONFIGS[wNum];
              const isSelected = selectedWeek === wNum;
              return (
                <button
                  key={wNum}
                  onClick={() => setSelectedWeek(wNum)}
                  className={`p-3 rounded-xl border text-left transition cursor-pointer flex flex-col justify-between ${
                    isSelected
                      ? 'bg-indigo-600/20 border-indigo-500 text-white shadow-md ring-1 ring-indigo-500/40'
                      : 'bg-slate-950/70 border-slate-800 text-slate-300 hover:border-slate-700 hover:bg-slate-900'
                  }`}
                >
                  <div className="flex items-center justify-between gap-1">
                    <span className="font-black text-xs">Pekan {wNum}</span>
                    <span className={`text-[9px] px-1.5 py-0.2 rounded-full font-bold ${
                      isSelected ? 'bg-indigo-500/30 text-indigo-200' : 'bg-slate-800 text-slate-400'
                    }`}>
                      {wNum === 1 && 'Denpasar 1'}
                      {wNum === 2 && 'Singaraja & Susulan'}
                      {wNum === 3 && 'Klaster Jember'}
                      {wNum === 4 && 'Tapal Kuda & Bali'}
                    </span>
                  </div>
                  <div className="text-[11px] font-medium text-slate-300 mt-1 line-clamp-1">
                    {cfg.theme}
                  </div>
                  <div className="text-[10px] text-slate-500 mt-0.5 line-clamp-1">
                    "{cfg.requirement}"
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Pekan Requirement Banner */}
        <div className="mt-3 p-3 rounded-xl bg-slate-950 border border-slate-800/80 flex flex-col md:flex-row md:items-center justify-between gap-2.5 text-xs">
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-indigo-400 shrink-0" />
            <div>
              <span className="font-bold text-white">Syarat Resmi Pekan {selectedWeek}: </span>
              <span className="text-slate-300 font-medium">"{weekConfig.requirement}"</span>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <span className={`px-2 py-0.5 rounded text-[11px] font-bold border ${
              areaRotationAudit.isFullyVaried
                ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                : 'bg-amber-500/20 text-amber-300 border-amber-500/30'
            }`}>
              {areaRotationAudit.isFullyVaried
                ? '✓ Rotasi Area: 100% Beragam'
                : `⚠️ Rotasi Area: ${areaRotationAudit.repeatedAssignmentsCount} Berulang`}
            </span>
            <span className="text-[11px] text-slate-400">
              {weekCompliance.summaryText}
            </span>
          </div>
        </div>
      </div>

      {/* Controller Bar: Group Mode Switcher (Kru vs Mobil vs Hari) & Filters */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-3 shadow-sm text-xs">
        
        {/* Planner Mode Tabs */}
        <div className="flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800 flex-wrap gap-1">
          <button
            onClick={() => setPlannerMode('by_driver')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
              plannerMode === 'by_driver'
                ? 'bg-indigo-600 text-white shadow'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>Papan Antar Kru ({driversList.length} Supir)</span>
          </button>

          <button
            onClick={() => setPlannerMode('by_fleet')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
              plannerMode === 'by_fleet'
                ? 'bg-indigo-600 text-white shadow'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Truck className="w-3.5 h-3.5" />
            <span>Papan Antar Mobil ({fleets.length} Truk)</span>
          </button>

          <button
            onClick={() => setPlannerMode('by_day')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
              plannerMode === 'by_day'
                ? 'bg-indigo-600 text-white shadow'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Calendar className="w-3.5 h-3.5" />
            <span>Papan Jadwal Hari (Senin - Sabtu)</span>
          </button>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Day Filter */}
          <select
            value={selectedDayFilter}
            onChange={(e) => setSelectedDayFilter(e.target.value)}
            className="bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-indigo-500 cursor-pointer"
          >
            <option value="all">Semua Hari (Senin - Sabtu)</option>
            {DAYS_OF_WEEK.map(d => (
              <option key={d} value={d}>Hari {d}</option>
            ))}
          </select>

          {/* Category Filter */}
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value as any)}
            className="bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-indigo-500 cursor-pointer"
          >
            <option value="all">Semua Rute (36)</option>
            <option value="luar_kota">Luar Kota Saja (13)</option>
            <option value="lokal">Lokal Saja (23)</option>
          </select>

          {/* Search Input */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-2.5" />
            <input
              type="text"
              placeholder="Cari rute / kru..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 pr-3 py-1.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 w-44"
            />
          </div>
        </div>
      </div>

      {/* =======================================================================
          VIEW 1: PAPAN BERDASARKAN KRU (BY DRIVER)
          ======================================================================= */}
      {plannerMode === 'by_driver' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between text-xs text-slate-400 px-1">
            <span>
              💡 <em>Tips Drag-and-Drop:</em> Tarik kartu jadwal pengiriman dan jatuhkan (drop) ke kolom supir lain untuk mengalihkan tugas secara langsung.
            </span>
            <span className="font-mono text-indigo-400">
              {driversList.length} Supir Terdaftar
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 items-start">
            {driversList.map(driver => {
              const driverRoutes = currentWeekRoutes.filter(r => r.driverId === driver.id && filterRouteItem(r));
              const lkRoutes = driverRoutes.filter(r => r.isLuarKota);
              const isTargeted = dragOverTargetId === driver.id;
              const hasConflict = driverRestAnalysis.conflicts.has(driver.id);

              return (
                <div
                  key={driver.id}
                  onDragOver={(e) => handleDragOver(e, driver.id)}
                  onDragLeave={handleDragLeave}
                  onDrop={(e) => handleDropOnDriver(e, driver.id)}
                  className={`rounded-2xl border transition-all flex flex-col min-h-[300px] ${
                    isTargeted
                      ? 'bg-indigo-950/40 border-indigo-400 ring-2 ring-indigo-500/50 shadow-xl'
                      : hasConflict
                      ? 'bg-slate-950/90 border-rose-900/50'
                      : 'bg-slate-950/70 border-slate-800'
                  }`}
                >
                  {/* Driver Column Header */}
                  <div className={`p-3.5 border-b rounded-t-2xl flex items-center justify-between gap-2 ${
                    hasConflict 
                      ? 'bg-rose-950/30 border-rose-900/50' 
                      : 'bg-slate-900/90 border-slate-800'
                  }`}>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <h4 className="font-bold text-white text-xs truncate max-w-[150px]" title={driver.name}>
                          {driver.name}
                        </h4>
                        <span className={`text-[9px] px-1.5 py-0.2 rounded font-mono font-bold ${
                          driver.role === 'Driver Utama' ? 'bg-blue-500/20 text-blue-300' : 'bg-amber-500/20 text-amber-300'
                        }`}>
                          {driver.role === 'Driver Utama' ? 'Utama' : 'Cadangan'}
                        </span>
                      </div>
                      <div className="text-[10px] text-slate-400 mt-0.5 flex items-center gap-2">
                        <span>{driverRoutes.length} Jadwal</span>
                        <span>•</span>
                        <span className="text-purple-300">{lkRoutes.length} Luar Kota</span>
                      </div>
                    </div>

                    <div className="w-7 h-7 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-300 text-xs font-bold">
                      {driverRoutes.length}
                    </div>
                  </div>

                  {/* Conflict Notice */}
                  {hasConflict && (
                    <div className="px-3 py-1.5 bg-rose-500/15 border-b border-rose-500/20 text-[10px] text-rose-300 flex items-center gap-1.5">
                      <AlertTriangle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                      <span>Konflik Jeda: Ada jadwal Luar Kota di hari berurutan!</span>
                    </div>
                  )}

                  {/* Droppable Card Container */}
                  <div className="p-3 space-y-2.5 flex-1 overflow-y-auto max-h-[550px]">
                    {driverRoutes.length === 0 ? (
                      <div className={`h-36 rounded-xl border border-dashed flex flex-col items-center justify-center text-center p-4 transition ${
                        isTargeted ? 'border-indigo-400 bg-indigo-500/10 text-indigo-200' : 'border-slate-800 text-slate-500'
                      }`}>
                        <Move className="w-5 h-5 mb-1 opacity-50" />
                        <span className="text-[11px] font-medium">Kosong</span>
                        <span className="text-[10px] text-slate-500 mt-0.5">Tarik rute ke sini untuk menugaskan</span>
                      </div>
                    ) : (
                      driverRoutes.map(item => renderRouteCard(item))
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* =======================================================================
          VIEW 2: PAPAN BERDASARKAN MOBIL / ARMADA (BY FLEET)
          ======================================================================= */}
      {plannerMode === 'by_fleet' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between text-xs text-slate-400 px-1">
            <span>
              💡 <em>Tips Drag-and-Drop:</em> Tarik kartu jadwal pengiriman dan jatuhkan (drop) ke kolom truk lain untuk mengalihkan armada angkut.
            </span>
            <span className="font-mono text-indigo-400">
              {fleets.length} Unit Truk Operasional
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 items-start">
            {fleets.map(fleet => {
              const fleetRoutes = currentWeekRoutes.filter(r => r.truckId === fleet.id && filterRouteItem(r));
              const isTargeted = dragOverTargetId === fleet.id;
              const totalKm = fleetRoutes.reduce((acc, r) => acc + r.distanceKm, 0);

              return (
                <div
                  key={fleet.id}
                  onDragOver={(e) => handleDragOver(e, fleet.id)}
                  onDragLeave={handleDragLeave}
                  onDrop={(e) => handleDropOnFleet(e, fleet.id)}
                  className={`rounded-2xl border transition-all flex flex-col min-h-[300px] ${
                    isTargeted
                      ? 'bg-indigo-950/40 border-indigo-400 ring-2 ring-indigo-500/50 shadow-xl'
                      : 'bg-slate-950/70 border-slate-800'
                  }`}
                >
                  {/* Fleet Column Header */}
                  <div className="p-3.5 bg-slate-900/90 border-b border-slate-800 rounded-t-2xl flex items-center justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono font-bold text-white text-xs">
                          {fleet.plateNumber}
                        </span>
                        <span className="text-[9px] px-1.5 py-0.2 rounded font-mono font-bold bg-emerald-500/20 text-emerald-300">
                          {fleet.vehicleType}
                        </span>
                      </div>
                      <div className="text-[10px] text-slate-400 mt-0.5 flex items-center gap-2">
                        <span>{fleetRoutes.length} Jadwal</span>
                        <span>•</span>
                        <span className="font-mono text-slate-300">{totalKm} KM Total</span>
                      </div>
                    </div>

                    <div className="w-7 h-7 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-300 text-xs font-bold">
                      {fleetRoutes.length}
                    </div>
                  </div>

                  {/* Droppable Card Container */}
                  <div className="p-3 space-y-2.5 flex-1 overflow-y-auto max-h-[550px]">
                    {fleetRoutes.length === 0 ? (
                      <div className={`h-36 rounded-xl border border-dashed flex flex-col items-center justify-center text-center p-4 transition ${
                        isTargeted ? 'border-indigo-400 bg-indigo-500/10 text-indigo-200' : 'border-slate-800 text-slate-500'
                      }`}>
                        <Truck className="w-5 h-5 mb-1 opacity-50" />
                        <span className="text-[11px] font-medium">Belum Ada Rute</span>
                        <span className="text-[10px] text-slate-500 mt-0.5">Tarik rute ke sini untuk menugaskan truk</span>
                      </div>
                    ) : (
                      fleetRoutes.map(item => renderRouteCard(item))
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* =======================================================================
          VIEW 3: PAPAN BERDASARKAN HARI (BY DAY: SENIN - SABTU)
          ======================================================================= */}
      {plannerMode === 'by_day' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between text-xs text-slate-400 px-1">
            <span>
              💡 <em>Tips Drag-and-Drop:</em> Tarik kartu jadwal pengiriman dan jatuhkan (drop) ke hari lain untuk menjadwalkan ulang keberangkatan.
            </span>
            <span className="font-mono text-indigo-400">
              Jadwal Mingguan Terpadu
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3 items-start">
            {DAYS_OF_WEEK.map(day => {
              const dayRoutes = currentWeekRoutes.filter(r => r.day === day && filterRouteItem(r));
              const lkCount = dayRoutes.filter(r => r.isLuarKota).length;
              const isTargeted = dragOverTargetId === day;
              const totalKm = dayRoutes.reduce((acc, r) => acc + r.distanceKm, 0);

              return (
                <div
                  key={day}
                  onDragOver={(e) => handleDragOver(e, day)}
                  onDragLeave={handleDragLeave}
                  onDrop={(e) => handleDropOnDay(e, day)}
                  className={`rounded-2xl border transition-all flex flex-col min-h-[350px] ${
                    isTargeted
                      ? 'bg-indigo-950/40 border-indigo-400 ring-2 ring-indigo-500/50 shadow-xl'
                      : day === 'Jumat'
                      ? 'bg-emerald-950/20 border-emerald-800/40'
                      : 'bg-slate-950/70 border-slate-800'
                  }`}
                >
                  {/* Day Column Header */}
                  <div className={`p-3 border-b rounded-t-2xl flex items-center justify-between gap-1.5 ${
                    day === 'Jumat' ? 'bg-emerald-950/40 border-emerald-800/50' : 'bg-slate-900/90 border-slate-800'
                  }`}>
                    <div>
                      <h4 className="font-bold text-white text-xs flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5 text-indigo-400" />
                        <span>{day}</span>
                      </h4>
                      <div className="text-[10px] text-slate-400 mt-0.5">
                        <span className="text-purple-300 font-bold">{lkCount} Luar Kota</span> • {dayRoutes.length} Total
                      </div>
                    </div>

                    <div className="text-right">
                      <span className="text-[10px] font-mono text-slate-400 font-bold">
                        {totalKm} km
                      </span>
                    </div>
                  </div>

                  {/* Day Special Info (e.g. Jumat Hari Pemulihan) */}
                  {day === 'Jumat' && (
                    <div className="p-2 bg-emerald-500/10 border-b border-emerald-500/20 text-[9px] text-emerald-300 font-medium">
                      🛠️ Hari Pemulihan Kru & Servis Armada (0 Luar Kota)
                    </div>
                  )}

                  {/* Droppable Container */}
                  <div className="p-2.5 space-y-2 flex-1 overflow-y-auto max-h-[600px]">
                    {dayRoutes.length === 0 ? (
                      <div className={`h-36 rounded-xl border border-dashed flex flex-col items-center justify-center text-center p-3 transition ${
                        isTargeted ? 'border-indigo-400 bg-indigo-500/10 text-indigo-200' : 'border-slate-800 text-slate-500'
                      }`}>
                        <Calendar className="w-4 h-4 mb-1 opacity-50" />
                        <span className="text-[10px] font-medium">Tidak ada jadwal</span>
                        <span className="text-[9px] text-slate-500 mt-0.5">Drop kartu ke sini</span>
                      </div>
                    ) : (
                      dayRoutes.map(item => renderRouteCard(item))
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* =======================================================================
          MODAL DETAIL RUTE PENGIRIMAN (CLICK TO VIEW DETAILS)
          ======================================================================= */}
      {selectedRouteDetail && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg p-5 shadow-2xl text-xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <span className="font-bold text-xs bg-indigo-500/20 text-indigo-300 px-2.5 py-1 rounded-lg border border-indigo-500/30">
                  Hari {selectedRouteDetail.day}
                </span>
                <span className="font-black text-white text-sm">
                  {selectedRouteDetail.route}
                </span>
              </div>
              <button
                onClick={() => setSelectedRouteDetail(null)}
                className="w-7 h-7 rounded-lg bg-slate-800 hover:bg-slate-700 flex items-center justify-center text-slate-400 hover:text-white transition cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 bg-slate-950 p-3.5 rounded-xl border border-slate-800">
              <div>
                <span className="text-slate-400 text-[10px]">Kategori:</span>
                <div className="font-bold text-white mt-0.5">{selectedRouteDetail.category}</div>
              </div>
              <div>
                <span className="text-slate-400 text-[10px]">Jarak & Waktu Tempuh:</span>
                <div className="font-bold text-emerald-400 font-mono mt-0.5">
                  {selectedRouteDetail.distanceKm} KM (~{selectedRouteDetail.estimatedHours} Jam)
                </div>
              </div>
              <div className="col-span-2 sm:col-span-1 space-y-1">
                <span className="text-slate-400 text-[10px] block font-semibold">Driver Utama:</span>
                <select
                  value={selectedRouteDetail.driverId || ''}
                  onChange={(e) => handleRouteChangeInPlanner(selectedRouteDetail.id, 'driverId', e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white text-xs font-semibold focus:ring-1 focus:ring-indigo-500"
                >
                  <option value="">-- Pilih Driver --</option>
                  {driversList.map(d => (
                    <option key={d.id} value={d.id}>{d.name} ({d.licenseType})</option>
                  ))}
                </select>
              </div>
              <div className="col-span-2 sm:col-span-1 space-y-1">
                <span className="text-slate-400 text-[10px] block font-semibold">Helper / Kernet:</span>
                <select
                  value={selectedRouteDetail.helperId || ''}
                  onChange={(e) => handleRouteChangeInPlanner(selectedRouteDetail.id, 'helperId', e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white text-xs font-semibold focus:ring-1 focus:ring-indigo-500"
                >
                  <option value="">-- Tanpa Helper --</option>
                  {helpersList.map(h => (
                    <option key={h.id} value={h.id}>{h.name}</option>
                  ))}
                </select>
              </div>
              <div className="col-span-2 space-y-1">
                <span className="text-slate-400 text-[10px] block font-semibold">Armada Truk:</span>
                <select
                  value={selectedRouteDetail.truckId || ''}
                  onChange={(e) => handleRouteChangeInPlanner(selectedRouteDetail.id, 'truckId', e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white text-xs font-mono focus:ring-1 focus:ring-indigo-500"
                >
                  <option value="">-- Pilih Truk --</option>
                  {fleets.map(f => (
                    <option key={f.id} value={f.id}>
                      {f.plateNumber} ({f.vehicleType} - {f.tonnageCapacity || 2} Ton)
                    </option>
                  ))}
                </select>
              </div>
              {selectedRouteDetail.ferryRoute && (
                <div className="col-span-2 bg-purple-950/40 p-2.5 rounded-lg border border-purple-800/40 text-purple-200">
                  <div className="font-bold flex items-center gap-1.5">
                    <Ship className="w-3.5 h-3.5 text-purple-400" />
                    <span>Penyeberangan Ferry ASDP:</span>
                  </div>
                  <div className="text-[11px] mt-0.5">{selectedRouteDetail.ferryRoute} (Ketapang ⇄ Gilimanuk)</div>
                </div>
              )}
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setSelectedRouteDetail(null)}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl text-xs transition cursor-pointer"
              >
                Selesai & Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Pop-up Peringatan Rotasi Area (Area Berulang / Keadaan Mendesak) */}
      <AreaRepetitionWarningModal
        isOpen={Boolean(areaConflict)}
        conflict={areaConflict}
        onProceedUrgent={() => {
          if (pendingDrop) {
            executeDriverDrop(pendingDrop.route, pendingDrop.targetDriverId, pendingDrop.sameDayRoute, true);
            if (selectedRouteDetail?.id === pendingDrop.route.id) {
              setSelectedRouteDetail(prev => prev ? { ...prev, [areaConflict?.field || 'driverId']: pendingDrop.targetDriverId } : null);
            }
          }
          setAreaConflict(null);
          setPendingDrop(null);
        }}
        onSelectAlternative={(newCrewId) => {
          if (pendingDrop) {
            executeDriverDrop(pendingDrop.route, newCrewId, undefined, false);
            if (selectedRouteDetail?.id === pendingDrop.route.id) {
              setSelectedRouteDetail(prev => prev ? { ...prev, [areaConflict?.field || 'driverId']: newCrewId } : null);
            }
          }
          setAreaConflict(null);
          setPendingDrop(null);
        }}
        onCancel={() => {
          setAreaConflict(null);
          setPendingDrop(null);
        }}
      />

    </div>
  );
};
