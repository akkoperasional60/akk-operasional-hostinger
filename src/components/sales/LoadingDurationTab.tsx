import React, { useState, useEffect, useMemo } from 'react';
import {
  Clock,
  Plus,
  Truck,
  Users,
  MapPin,
  Calendar,
  Trash2,
  X,
  Timer,
  ChevronDown,
  Search,
  Check,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  Edit3
} from 'lucide-react';
import {
  SalesHeaderFilter,
  SalesTopTab,
  MONTH_OPTIONS
} from './SalesHeaderFilter';
import { logisticsStore } from '../../services/store';
import { Fleet, Crew, Schedule, UserProfile } from '../../types';
import { OFFICIAL_DESTINATION_AREAS, standardizeAreaName } from '../../utils/areaNormalizer';

interface LoadingDurationTabProps {
  onNavigateSubTab?: (sub: 'dashboard' | 'activities' | 'schedules' | 'loading_duration' | 'skill_matrix' | 'jobdesk') => void;
  adminOptions: string[];
}

export interface LoadingFleetRecord {
  id: string;
  loadingDate: string; // YYYY-MM-DD
  dayName: string;
  areaName: string;
  fleetDisplay: string;
  startTime: string;
  endTime: string;
  loadingTimeRange: string;
  durationLabel: string;
  durationMinutes: number;
  helpingCrews: string[];
}

const DAY_NAMES_FROM_JS = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
const SHORT_MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];

function getDayNameFromDateStr(dateStr?: string): string {
  if (!dateStr) return 'Senin';
  const parts = dateStr.split('-').map(Number);
  if (parts.length === 3 && parts[0] && parts[1] && parts[2]) {
    const d = new Date(parts[0], parts[1] - 1, parts[2]);
    if (!isNaN(d.getTime())) {
      return DAY_NAMES_FROM_JS[d.getDay()] || 'Senin';
    }
  }
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return 'Senin';
  return DAY_NAMES_FROM_JS[d.getDay()] || 'Senin';
}

export function formatDayAndDateLabel(loadingDate?: string, fallbackDayName?: string): string {
  if (!loadingDate) return fallbackDayName || 'Senin';
  const parts = loadingDate.split('-').map(Number);
  if (parts.length === 3 && parts[0] && parts[1] && parts[2]) {
    const [y, m, d] = parts;
    const dayName = fallbackDayName || getDayNameFromDateStr(loadingDate);
    const shortMonth = SHORT_MONTH_NAMES[m - 1] || '';
    return `${dayName}, ${String(d).padStart(2, '0')} ${shortMonth} ${y}`;
  }
  return fallbackDayName || loadingDate;
}

export function cleanFleetDisplayLabel(raw: string): string {
  if (!raw) return '';
  return raw.split('—')[0].trim();
}

function formatFleetOptionLabel(fleet: Fleet): string {
  const code = fleet.initialCode ? `[${fleet.initialCode}] ` : '';
  return `${code}${fleet.plateNumber}`.trim();
}

function calculateDuration(startTime: string, endTime: string): {
  diffMinutes: number;
  durationLabel: string;
} {
  const [h1, m1] = (startTime || '08:00').split(':').map(Number);
  const [h2, m2] = (endTime || '09:30').split(':').map(Number);
  let diffMinutes = h2 * 60 + m2 - (h1 * 60 + m1);
  if (diffMinutes < 0) diffMinutes += 24 * 60;

  const hours = Math.floor(diffMinutes / 60);
  const mins = diffMinutes % 60;
  const durationLabel =
    hours > 0
      ? mins > 0
        ? `${hours} jam ${mins} mnt`
        : `${hours} jam`
      : `${mins} mnt`;

  return { diffMinutes, durationLabel };
}

export const LoadingDurationTab: React.FC<LoadingDurationTabProps> = ({
  onNavigateSubTab,
  adminOptions
}) => {
  const now = new Date();
  const currentMonthName = MONTH_OPTIONS[now.getMonth()] || 'November';
  const currentYearStr = String(now.getFullYear());
  const todayIso = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

  const [selectedAdmin, setSelectedAdmin] = useState('SEMUA ADMIN');
  const [selectedMonth, setSelectedMonth] = useState<string>(() => currentMonthName);
  const [selectedYear, setSelectedYear] = useState<string>(() => currentYearStr);
  const [searchQuery, setSearchQuery] = useState('');
  const [areaFilter, setAreaFilter] = useState('SEMUA AREA');

  // Subscribe to Data Armada Terpadu, Kru Pengiriman & Kernet, Users, & Jadwal Penugasan
  const [fleets, setFleets] = useState<Fleet[]>(() => logisticsStore.getFleets());
  const [crews, setCrews] = useState<Crew[]>(() => logisticsStore.getCrews());
  const [users, setUsers] = useState<UserProfile[]>(() => logisticsStore.getUsers());
  const [schedules, setSchedules] = useState<Schedule[]>(() => logisticsStore.getSchedules());

  useEffect(() => {
    const syncStore = () => {
      setFleets([...logisticsStore.getFleets()]);
      setCrews([...logisticsStore.getCrews()]);
      setUsers([...logisticsStore.getUsers()]);
      setSchedules([...logisticsStore.getSchedules()]);
    };
    syncStore();
    const unsub = logisticsStore.subscribe(syncStore);
    return unsub;
  }, []);

  const fleetOptions = useMemo(() => {
    return fleets.map(f => ({
      id: f.id,
      initialCode: f.initialCode || 'UNIT',
      plateNumber: f.plateNumber,
      label: formatFleetOptionLabel(f)
    }));
  }, [fleets]);

  // Integrated Kru Pengiriman & Kernet (Drivers + Crew Helpers from Crew Store & User Store)
  const integratedCrewsAndHelpers = useMemo(() => {
    const map = new Map<string, { name: string; roleLabel: 'Supir' | 'Kernet' }>();

    for (const c of crews) {
      const driverName = (c.name || '').trim();
      if (driverName && driverName !== '-') {
        const isHelperRole = String(c.role || '').toLowerCase().includes('kernet') || String(c.role || '').toLowerCase().includes('helper');
        map.set(driverName.toUpperCase(), {
          name: driverName,
          roleLabel: isHelperRole ? 'Kernet' : 'Supir'
        });
      }
      const helperName = ((c as any).helperName || '').trim();
      if (helperName && helperName !== '-') {
        if (!map.has(helperName.toUpperCase())) {
          map.set(helperName.toUpperCase(), {
            name: helperName,
            roleLabel: 'Kernet'
          });
        }
      }
    }

    for (const u of users) {
      if (u.status !== 'approved') continue;
      if (u.role === 'driver' || u.role === 'crew_helper') {
        const fullName = (u.fullName || '').trim();
        if (fullName && !map.has(fullName.toUpperCase())) {
          map.set(fullName.toUpperCase(), {
            name: fullName,
            roleLabel: u.role === 'crew_helper' ? 'Kernet' : 'Supir'
          });
        }
      }
    }

    return Array.from(map.values()).sort((a, b) => {
      if (a.roleLabel !== b.roleLabel) return a.roleLabel === 'Supir' ? -1 : 1;
      return a.name.localeCompare(b.name, 'id');
    });
  }, [crews, users]);

  // Build Area Kirim options synced directly from Jadwal & Penugasan (plus Official Areas)
  const areaScheduleOptions = useMemo(() => {
    const map = new Map<
      string,
      {
        areaName: string;
        isScheduled: boolean;
        fleetDisplay?: string;
        fleetCode?: string;
        plateNumber?: string;
        dayName?: string;
        scheduleDate?: string;
        crews?: string[];
      }
    >();

    const sortedSchedules = [...schedules].sort((a, b) =>
      (b.departureDate || '').localeCompare(a.departureDate || '')
    );

    for (const sch of sortedSchedules) {
      const rawArea = (sch.areaName || sch.store?.city || sch.store?.storeName || '').trim();
      if (!rawArea) continue;
      const normalized = standardizeAreaName(rawArea).toUpperCase();
      if (!normalized || normalized === '-') continue;

      if (!map.has(normalized)) {
        const schPlate = sch.fleet?.plateNumber;
        const matchedFleet =
          fleets.find(
            f =>
              f.id === sch.fleetId ||
              (schPlate && f.plateNumber.toUpperCase() === schPlate.toUpperCase())
          ) || sch.fleet;
        const dayStr = getDayNameFromDateStr(sch.departureDate);
        const driverObj = sch.crew || crews.find(c => c.id === sch.crewId);
        const helperObj = sch.crewHelper || crews.find(c => c.id === sch.crewHelperId);
        const assignedCrews = [driverObj?.name, helperObj?.name]
          .map(c => (c || '').trim())
          .filter(c => c && c !== '-');

        map.set(normalized, {
          areaName: normalized,
          isScheduled: true,
          fleetDisplay: matchedFleet ? formatFleetOptionLabel(matchedFleet) : undefined,
          fleetCode: matchedFleet?.initialCode || undefined,
          plateNumber: matchedFleet?.plateNumber || undefined,
          dayName: dayStr,
          scheduleDate: sch.departureDate,
          crews: assignedCrews.length > 0 ? assignedCrews : undefined
        });
      }
    }

    for (const officialArea of OFFICIAL_DESTINATION_AREAS) {
      const upper = officialArea.trim().toUpperCase();
      if (upper && !map.has(upper)) {
        map.set(upper, {
          areaName: upper,
          isScheduled: false
        });
      }
    }

    return Array.from(map.values()).sort((a, b) => {
      if (a.isScheduled !== b.isScheduled) return a.isScheduled ? -1 : 1;
      return a.areaName.localeCompare(b.areaName, 'id');
    });
  }, [schedules, fleets, crews]);

  const defaultInitialRecords = useMemo<LoadingFleetRecord[]>(() => {
    const f0 = fleetOptions[0]?.label || '[N1 / NP1] P 8125 VC';
    const f1 = fleetOptions[1]?.label || '[A3 / NP3] P 8509 VQ';
    const f2 = fleetOptions[2]?.label || '[N3 / NS1] P 8848 U';
    const yr = now.getFullYear();
    const mo = String(now.getMonth() + 1).padStart(2, '0');
    const d1 = `${yr}-${mo}-09`;
    const d2 = `${yr}-${mo}-10`;
    const d3 = `${yr}-${mo}-11`;

    return [
      {
        id: 'ld-1',
        loadingDate: d1,
        dayName: getDayNameFromDateStr(d1),
        areaName: 'DENPASAR 1',
        fleetDisplay: cleanFleetDisplayLabel(f0),
        startTime: '08:00',
        endTime: '09:45',
        loadingTimeRange: '08:00 - 09:45',
        durationLabel: '1 jam 45 mnt',
        durationMinutes: 105,
        helpingCrews: ['Faisol Arifin', 'Bintang Wahyu Pratama']
      },
      {
        id: 'ld-2',
        loadingDate: d2,
        dayName: getDayNameFromDateStr(d2),
        areaName: 'KALIBARU',
        fleetDisplay: cleanFleetDisplayLabel(f1),
        startTime: '09:00',
        endTime: '11:15',
        loadingTimeRange: '09:00 - 11:15',
        durationLabel: '2 jam 15 mnt',
        durationMinutes: 135,
        helpingCrews: ['Ahmad Yani', 'Rizky Pratama']
      },
      {
        id: 'ld-3',
        loadingDate: d3,
        dayName: getDayNameFromDateStr(d3),
        areaName: 'JEMBER KOTA',
        fleetDisplay: cleanFleetDisplayLabel(f2),
        startTime: '10:15',
        endTime: '11:45',
        loadingTimeRange: '10:15 - 11:45',
        durationLabel: '1 jam 30 mnt',
        durationMinutes: 90,
        helpingCrews: ['Hendra Wijaya', 'Dedi Kurniawan']
      }
    ];
  }, [fleetOptions]);

  const [fleetRecords, setFleetRecords] = useState<LoadingFleetRecord[]>(defaultInitialRecords);
  const [isSyncingMysql, setIsSyncingMysql] = useState(false);

  const persistRecordsToMysql = async (nextRecords: LoadingFleetRecord[]) => {
    setIsSyncingMysql(true);
    try {
      await fetch('/api/loading-durations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ records: nextRecords })
      });
    } catch (err) {
      console.warn('[MySQL Loading Durations Sync Error]', err);
    } finally {
      setIsSyncingMysql(false);
    }
  };

  // Load directly from MySQL (/api/loading-durations) without localStorage
  useEffect(() => {
    let active = true;
    fetch('/api/loading-durations', { cache: 'no-store' })
      .then(r => r.json())
      .then(res => {
        if (!active) return;
        if (res && res.success && Array.isArray(res.records) && res.records.length > 0) {
          const normalized: LoadingFleetRecord[] = res.records.map((rec: any, idx: number) => {
            const fallbackDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(Math.min(28, 9 + idx)).padStart(2, '0')}`;
            const loadingDate = rec.loadingDate || fallbackDate;
            return {
              ...rec,
              loadingDate,
              dayName: rec.dayName || getDayNameFromDateStr(loadingDate),
              fleetDisplay: cleanFleetDisplayLabel(rec.fleetDisplay || '')
            };
          });
          setFleetRecords(normalized);
        } else {
          setFleetRecords(defaultInitialRecords);
          void persistRecordsToMysql(defaultInitialRecords);
        }
      })
      .catch(err => {
        console.warn('[MySQL Loading Durations Fetch Error]', err);
      });
    return () => {
      active = false;
    };
  }, []);

  // Modal Form State
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingRecordId, setEditingRecordId] = useState<string | null>(null);
  const [newLoadingDate, setNewLoadingDate] = useState<string>(todayIso);
  const [newAreaName, setNewAreaName] = useState('DENPASAR 1');
  const [newFleetDisplay, setNewFleetDisplay] = useState(() => fleetOptions[0]?.label || '');
  const [newStartTime, setNewStartTime] = useState('08:00');
  const [newEndTime, setNewEndTime] = useState('09:30');
  const [selectedHelpingCrews, setSelectedHelpingCrews] = useState<string[]>([]);
  const [crewSearchQuery, setCrewSearchQuery] = useState('');
  const [customCrewInput, setCustomCrewInput] = useState('');

  const [openModalDropdown, setOpenModalDropdown] = useState<null | 'area' | 'fleet'>(null);
  const [areaSearchQuery, setAreaSearchQuery] = useState('');
  const [fleetSearchQuery, setFleetSearchQuery] = useState('');

  useEffect(() => {
    if (!newFleetDisplay && fleetOptions.length > 0) {
      setNewFleetDisplay(fleetOptions[0].label);
    }
  }, [fleetOptions, newFleetDisplay]);

  const derivedDayName = useMemo(() => getDayNameFromDateStr(newLoadingDate), [newLoadingDate]);

  const liveDurationPreview = useMemo(
    () => calculateDuration(newStartTime, newEndTime),
    [newStartTime, newEndTime]
  );

  // Filter records by selectedMonth, selectedYear, areaFilter, and searchQuery
  const filteredRecords = useMemo(() => {
    const targetMonthIndex = MONTH_OPTIONS.indexOf(selectedMonth);
    const targetYearNum = Number(selectedYear) || now.getFullYear();
    const q = searchQuery.trim().toLowerCase();

    return fleetRecords.filter(rec => {
      if (rec.loadingDate) {
        const parts = rec.loadingDate.split('-').map(Number);
        if (parts.length === 3 && parts[0] && parts[1]) {
          if (parts[0] !== targetYearNum || parts[1] - 1 !== targetMonthIndex) {
            return false;
          }
        }
      }
      if (areaFilter !== 'SEMUA AREA' && rec.areaName.toUpperCase() !== areaFilter.toUpperCase()) {
        return false;
      }
      if (q) {
        const matchArea = rec.areaName.toLowerCase().includes(q);
        const matchFleet = rec.fleetDisplay.toLowerCase().includes(q);
        const matchDay = formatDayAndDateLabel(rec.loadingDate, rec.dayName).toLowerCase().includes(q);
        const matchCrew = (rec.helpingCrews || []).some(c => c.toLowerCase().includes(q));
        if (!matchArea && !matchFleet && !matchDay && !matchCrew) return false;
      }
      return true;
    });
  }, [fleetRecords, selectedMonth, selectedYear, areaFilter, searchQuery]);

  // Analytics metrics for current period
  const metrics = useMemo(() => {
    const totalSesi = filteredRecords.length;
    const totalMinutes = filteredRecords.reduce((acc, r) => acc + (r.durationMinutes || 0), 0);
    const avgMinutes = totalSesi > 0 ? Math.round(totalMinutes / totalSesi) : 0;
    const avgHours = Math.floor(avgMinutes / 60);
    const avgRemMins = avgMinutes % 60;
    const avgLabel =
      avgHours > 0
        ? avgRemMins > 0
          ? `${avgHours} jam ${avgRemMins} mnt`
          : `${avgHours} jam`
        : `${avgMinutes} mnt`;

    const onSlaCount = filteredRecords.filter(r => (r.durationMinutes || 0) <= 120).length;
    const slaPct = totalSesi > 0 ? Math.round((onSlaCount / totalSesi) * 100) : 100;

    const uniqueCrews = new Set<string>();
    filteredRecords.forEach(r => (r.helpingCrews || []).forEach(c => uniqueCrews.add(c)));

    return {
      totalSesi,
      avgLabel,
      avgMinutes,
      onSlaCount,
      slaPct,
      uniqueCrewCount: uniqueCrews.size
    };
  }, [filteredRecords]);

  const distinctAreasInPeriod = useMemo(() => {
    const set = new Set<string>();
    fleetRecords.forEach(r => {
      if (r.areaName) set.add(r.areaName.toUpperCase());
    });
    return ['SEMUA AREA', ...Array.from(set).sort()];
  }, [fleetRecords]);

  const handleTopTabChange = (tab: SalesTopTab) => {
    if (tab === 'checklist' || tab === 'aktivitas_view') {
      onNavigateSubTab?.('activities');
    } else if (tab === 'jadwal_admin') {
      onNavigateSubTab?.('schedules');
    }
  };

  const handleToggleCrew = (crewName: string) => {
    setSelectedHelpingCrews(prev =>
      prev.includes(crewName)
        ? prev.filter(c => c !== crewName)
        : [...prev, crewName]
    );
  };

  const handleAddCustomCrew = () => {
    const trimmed = customCrewInput.trim();
    if (!trimmed) return;
    if (!selectedHelpingCrews.includes(trimmed)) {
      setSelectedHelpingCrews(prev => [...prev, trimmed]);
    }
    setCustomCrewInput('');
  };

  const handleSelectAreaFromSchedule = (areaItem: {
    areaName: string;
    fleetDisplay?: string;
    scheduleDate?: string;
    crews?: string[];
  }) => {
    setNewAreaName(areaItem.areaName);
    if (areaItem.fleetDisplay) {
      setNewFleetDisplay(cleanFleetDisplayLabel(areaItem.fleetDisplay));
    }
    if (areaItem.scheduleDate) {
      setNewLoadingDate(areaItem.scheduleDate);
    }
    if (areaItem.crews && areaItem.crews.length > 0) {
      setSelectedHelpingCrews(areaItem.crews);
    }
    setOpenModalDropdown(null);
    setAreaSearchQuery('');
  };

  const openInputModal = () => {
    const firstScheduled = areaScheduleOptions[0];
    const targetMonthIdx = Math.max(0, MONTH_OPTIONS.indexOf(selectedMonth));
    const targetYr = Number(selectedYear) || now.getFullYear();
    const defaultDateForSelectedPeriod =
      targetYr === now.getFullYear() && targetMonthIdx === now.getMonth()
        ? todayIso
        : `${targetYr}-${String(targetMonthIdx + 1).padStart(2, '0')}-15`;

    setEditingRecordId(null);
    setNewLoadingDate(firstScheduled?.scheduleDate || defaultDateForSelectedPeriod);
    setNewAreaName(firstScheduled?.areaName || 'DENPASAR 1');
    setNewFleetDisplay(
      cleanFleetDisplayLabel(firstScheduled?.fleetDisplay || fleetOptions[0]?.label || '')
    );
    setNewStartTime('08:00');
    setNewEndTime('09:30');
    setSelectedHelpingCrews(
      firstScheduled?.crews && firstScheduled.crews.length > 0
        ? firstScheduled.crews
        : integratedCrewsAndHelpers.slice(0, 2).map(c => c.name)
    );
    setCustomCrewInput('');
    setCrewSearchQuery('');
    setOpenModalDropdown(null);
    setAreaSearchQuery('');
    setFleetSearchQuery('');
    setIsAddModalOpen(true);
  };

  const openEditModal = (rec: LoadingFleetRecord) => {
    setEditingRecordId(rec.id);
    setNewLoadingDate(rec.loadingDate || todayIso);
    setNewAreaName(rec.areaName);
    setNewFleetDisplay(cleanFleetDisplayLabel(rec.fleetDisplay));
    setNewStartTime(rec.startTime || '08:00');
    setNewEndTime(rec.endTime || '09:30');
    setSelectedHelpingCrews(rec.helpingCrews || []);
    setCustomCrewInput('');
    setCrewSearchQuery('');
    setOpenModalDropdown(null);
    setAreaSearchQuery('');
    setFleetSearchQuery('');
    setIsAddModalOpen(true);
  };

  const handleSaveFleetSession = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFleetDisplay || !newAreaName || !newLoadingDate) return;

    const { diffMinutes, durationLabel } = calculateDuration(newStartTime, newEndTime);
    const computedDayName = getDayNameFromDateStr(newLoadingDate);

    // Sync selectedMonth & selectedYear to the saved date so user immediately sees the record
    const dateParts = newLoadingDate.split('-').map(Number);
    if (dateParts.length === 3 && dateParts[0] && dateParts[1]) {
      const mName = MONTH_OPTIONS[dateParts[1] - 1];
      if (mName) setSelectedMonth(mName);
      setSelectedYear(String(dateParts[0]));
    }

    const payload: LoadingFleetRecord = {
      id: editingRecordId || 'ld-' + Math.random().toString(36).substring(2, 8),
      loadingDate: newLoadingDate,
      dayName: computedDayName,
      areaName: newAreaName.toUpperCase(),
      fleetDisplay: cleanFleetDisplayLabel(newFleetDisplay),
      startTime: newStartTime,
      endTime: newEndTime,
      loadingTimeRange: `${newStartTime} - ${newEndTime}`,
      durationLabel,
      durationMinutes: diffMinutes,
      helpingCrews:
        selectedHelpingCrews.length > 0 ? selectedHelpingCrews : ['Kru Gudang & Armada']
    };

    const updated = editingRecordId
      ? fleetRecords.map(r => (r.id === editingRecordId ? payload : r))
      : [payload, ...fleetRecords];

    setFleetRecords(updated);
    void persistRecordsToMysql(updated);
    setIsAddModalOpen(false);
    setEditingRecordId(null);
    setOpenModalDropdown(null);
  };

  const handleDeleteRecord = (id: string) => {
    const updated = fleetRecords.filter(r => r.id !== id);
    setFleetRecords(updated);
    void persistRecordsToMysql(updated);
  };

  const filteredCrewSelectionList = useMemo(() => {
    const q = crewSearchQuery.trim().toLowerCase();
    if (!q) return integratedCrewsAndHelpers;
    return integratedCrewsAndHelpers.filter(
      c => c.name.toLowerCase().includes(q) || c.roleLabel.toLowerCase().includes(q)
    );
  }, [integratedCrewsAndHelpers, crewSearchQuery]);

  return (
    <div className="space-y-6">
      {/* Header & Unified Filter (Periode otomatis menyesuaikan bulan berjalan) */}
      <SalesHeaderFilter
        title="Pemantauan Durasi Muat Armada"
        subtitle="Pantau tanggal & hari muat, area tujuan kirim, durasi muat armada, serta kru pengiriman & kernet yang membantu."
        activeTab="durasi_muat"
        onTabChange={handleTopTabChange}
        selectedAdmin={selectedAdmin}
        onAdminChange={setSelectedAdmin}
        selectedMonth={selectedMonth}
        onMonthChange={setSelectedMonth}
        selectedYear={selectedYear}
        onYearChange={setSelectedYear}
        jadwalInputCount={filteredRecords.length}
        pencapaianPercent={metrics.slaPct}
        periodeLabel={`${selectedMonth.slice(0, 3)} ${selectedYear}`}
        adminOptions={adminOptions}
        hideAdminFilter={true}
      />

      {/* Executive Summary Cards (Redesigned UI/UX) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400 block">
              TOTAL SESI MUAT ({selectedMonth.slice(0, 3).toUpperCase()} {selectedYear})
            </span>
            <div className="text-2xl font-black text-slate-900 dark:text-white mt-1 font-mono tabular-nums">
              {metrics.totalSesi} <span className="text-xs font-bold text-slate-500">Armada</span>
            </div>
            <span className="text-[11px] font-medium text-indigo-600 dark:text-indigo-400 mt-1 block">
              Tersinkronisasi Jadwal &amp; Armada
            </span>
          </div>
          <div className="w-11 h-11 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200/60 dark:border-indigo-800/60 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shrink-0">
            <Truck className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400 block">
              RATA-RATA DURASI MUAT
            </span>
            <div className="text-2xl font-black text-amber-600 dark:text-amber-400 mt-1 font-mono tabular-nums">
              {metrics.avgLabel}
            </div>
            <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 mt-1 block">
              Target SLA Muat &le; 2 Jam (120 mnt)
            </span>
          </div>
          <div className="w-11 h-11 rounded-2xl bg-amber-50 dark:bg-amber-950/60 border border-amber-200/60 dark:border-amber-800/60 flex items-center justify-center text-amber-600 dark:text-amber-400 shrink-0">
            <Timer className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400 block">
              KEPATUHAN SLA MUAT
            </span>
            <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1 font-mono tabular-nums">
              {metrics.slaPct}%
            </div>
            <span className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400 mt-1 block">
              {metrics.onSlaCount} dari {metrics.totalSesi} sesi sesuai target
            </span>
          </div>
          <div className="w-11 h-11 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200/60 dark:border-emerald-800/60 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shrink-0">
            <CheckCircle2 className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400 block">
              KRU PENGIRIMAN &amp; KERNET
            </span>
            <div className="text-2xl font-black text-cyan-600 dark:text-cyan-400 mt-1 font-mono tabular-nums">
              {integratedCrewsAndHelpers.length} <span className="text-xs font-bold text-slate-500">Personel</span>
            </div>
            <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 mt-1 block">
              {metrics.uniqueCrewCount} kru terlibat bulan ini
            </span>
          </div>
          <div className="w-11 h-11 rounded-2xl bg-cyan-50 dark:bg-cyan-950/60 border border-cyan-200/60 dark:border-cyan-800/60 flex items-center justify-center text-cyan-600 dark:text-cyan-400 shrink-0">
            <Users className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Main Card: Pemantauan Durasi Muat */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-xs">
        <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-indigo-600 to-blue-600 text-white flex items-center justify-center shrink-0 shadow-xs">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-extrabold text-slate-900 dark:text-white">
                  Daftar Realisasi Durasi Muat Armada
                </h2>
                {isSyncingMysql && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-300 animate-pulse">
                    Menyimpan...
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Terintegrasi dengan Jadwal &amp; Penugasan, Data Armada Terpadu ({fleets.length} unit), serta Kru Pengiriman &amp; Kernet
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* Search Box */}
            <div className="relative min-w-[200px] sm:min-w-[240px]">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Cari area, nopol, tanggal, kru..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs font-medium text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-indigo-500"
              />
            </div>

            {/* Area Filter */}
            <select
              value={areaFilter}
              onChange={e => setAreaFilter(e.target.value)}
              className="px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs font-bold text-slate-800 dark:text-slate-200 focus:outline-none focus:border-indigo-500 cursor-pointer"
            >
              {distinctAreasInPeriod.map(area => (
                <option key={area} value={area}>
                  {area}
                </option>
              ))}
            </select>

            <button
              onClick={openInputModal}
              className="flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-white rounded-xl text-xs font-bold shadow-xs transition cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Input Muat</span>
            </button>
          </div>
        </div>

        {/* Table with Hari & Tanggal | Nama Area Kirim | Armada (Tanpa Model Mobil) | Jam Muat | Durasi | Kru yang Membantu | Aksi */}
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead>
              <tr className="bg-slate-50/95 dark:bg-slate-800/70 border-b border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 uppercase text-[10px] tracking-wider font-extrabold">
                <th className="py-3.5 px-4 w-12 text-center">NO</th>
                <th className="py-3.5 px-4">HARI &amp; TANGGAL</th>
                <th className="py-3.5 px-4">NAMA AREA KIRIM</th>
                <th className="py-3.5 px-4">ARMADA (DATA ARMADA TERPADU)</th>
                <th className="py-3.5 px-4">JAM MUAT (MULAI - SELESAI)</th>
                <th className="py-3.5 px-4">DURASI &amp; SLA</th>
                <th className="py-3.5 px-4">KRU YANG MEMBANTU (SUPIR &amp; KERNET)</th>
                <th className="py-3.5 px-4 text-right">AKSI</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filteredRecords.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 px-4 text-center">
                    <div className="max-w-sm mx-auto space-y-2">
                      <div className="w-10 h-10 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-400 flex items-center justify-center mx-auto">
                        <Calendar className="w-5 h-5" />
                      </div>
                      <p className="text-xs font-bold text-slate-700 dark:text-slate-300">
                        Belum ada data durasi muat pada periode {selectedMonth} {selectedYear}
                      </p>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">
                        Klik tombol <strong>+ Input Muat</strong> untuk mencatat sesi muat armada baru.
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredRecords.map((item, idx) => {
                  const isOverSla = (item.durationMinutes || 0) > 120;
                  const cleanFleet = cleanFleetDisplayLabel(item.fleetDisplay);
                  const dayAndDateStr = formatDayAndDateLabel(item.loadingDate, item.dayName);

                  return (
                    <tr
                      key={item.id}
                      className="hover:bg-indigo-50/30 dark:hover:bg-slate-800/50 transition group"
                    >
                      {/* 1. No */}
                      <td className="py-3.5 px-4 text-center font-bold text-slate-500 font-mono tabular-nums">
                        {idx + 1}
                      </td>

                      {/* 2. Hari & Tanggal */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <div className="inline-flex items-center gap-2 px-2.5 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/70">
                          <Calendar className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400 shrink-0" />
                          <span className="font-extrabold text-slate-900 dark:text-white">
                            {dayAndDateStr}
                          </span>
                        </div>
                      </td>

                      {/* 3. Nama Area Kirim */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-[11px] font-extrabold bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200/70 dark:border-indigo-800/60">
                          <MapPin className="w-3 h-3 shrink-0" />
                          {item.areaName}
                        </span>
                      </td>

                      {/* 4. Armada (Tanpa Keterangan Model Mobil) */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-lg bg-emerald-50/70 dark:bg-emerald-950/40 border border-emerald-200/70 dark:border-emerald-800/50">
                          <Truck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                          <span className="font-mono font-black text-slate-900 dark:text-white">
                            {cleanFleet}
                          </span>
                        </div>
                      </td>

                      {/* 5. Jam Muat (Mulai Jam - Sampai Jam) */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <span className="inline-flex items-center gap-1.5 font-mono tabular-nums font-bold text-slate-800 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 px-2.5 py-1 rounded-lg border border-slate-200/70 dark:border-slate-700">
                          <Clock className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                          {item.loadingTimeRange}
                        </span>
                      </td>

                      {/* 6. Durasi */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg font-extrabold text-[11px] font-mono tabular-nums border ${
                            isOverSla
                              ? 'bg-amber-50 dark:bg-amber-950/50 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-800/60'
                              : 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/60'
                          }`}
                        >
                          {isOverSla ? (
                            <AlertTriangle className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                          ) : (
                            <Timer className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                          )}
                          {item.durationLabel}
                        </span>
                      </td>

                      {/* 7. Kru yang Membantu */}
                      <td className="py-3.5 px-4">
                        <div className="flex flex-wrap gap-1.5">
                          {(item.helpingCrews || []).map(crew => {
                            const meta = integratedCrewsAndHelpers.find(
                              c => c.name.toLowerCase() === crew.toLowerCase()
                            );
                            return (
                              <span
                                key={crew}
                                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700"
                              >
                                <Users className="w-3 h-3 text-indigo-600 dark:text-indigo-400 shrink-0" />
                                <span>{crew}</span>
                                {meta && (
                                  <span
                                    className={`px-1.5 py-0.2 rounded text-[9px] font-black uppercase ${
                                      meta.roleLabel === 'Kernet'
                                        ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300'
                                        : 'bg-blue-500/15 text-blue-700 dark:text-blue-300'
                                    }`}
                                  >
                                    {meta.roleLabel}
                                  </span>
                                )}
                              </span>
                            );
                          })}
                        </div>
                      </td>

                      {/* 8. Aksi Edit & Hapus */}
                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => openEditModal(item)}
                            title="Edit Sesi Muat"
                            className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 rounded-lg transition cursor-pointer"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteRecord(item.id)}
                            title="Hapus Data Muat"
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Input / Edit Sesi Muat Armada (Kalender Tanggal Muat & Kru Terintegrasi Kru Pengiriman & Kernet) */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-xl w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-800 max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800 mb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
                  <Truck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    {editingRecordId ? 'Edit Sesi Muat Armada' : 'Input Sesi Muat Armada Baru'}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Tersinkronisasi dengan Jadwal &amp; Penugasan, Armada, serta Kru Pengiriman &amp; Kernet
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsAddModalOpen(false);
                  setEditingRecordId(null);
                  setOpenModalDropdown(null);
                }}
                className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-white rounded-lg cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveFleetSession} className="space-y-4 text-xs">
              {/* Row 1: Kalender Tanggal Muat & Nama Area Kirim */}
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-3.5">
                {/* Kalender Tanggal Muat (5 cols) */}
                <div className="sm:col-span-5">
                  <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1 flex items-center justify-between">
                    <span>Tanggal Muat (Kalender) *</span>
                    <span className="px-2 py-0.5 rounded bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-300 text-[10px] font-extrabold">
                      {derivedDayName}
                    </span>
                  </label>
                  <div className="relative">
                    <input
                      type="date"
                      required
                      value={newLoadingDate}
                      onChange={e => setNewLoadingDate(e.target.value)}
                      className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 focus:border-indigo-500 rounded-xl text-slate-900 dark:text-white font-bold cursor-pointer focus:outline-none"
                    />
                  </div>
                </div>

                {/* Nama Area Kirim (Area Jadwal) Custom Dropdown (7 cols) */}
                <div className="sm:col-span-7 relative">
                  <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1 flex items-center justify-between">
                    <span>Nama Area Kirim (Area Jadwal) *</span>
                    <span className="text-[10px] font-semibold text-indigo-500 flex items-center gap-1">
                      <Sparkles className="w-3 h-3" />
                      Sinkron Jadwal
                    </span>
                  </label>
                  {(() => {
                    const currentAreaMeta = areaScheduleOptions.find(
                      a => a.areaName.toUpperCase() === newAreaName.toUpperCase()
                    );
                    const filteredAreaList = areaScheduleOptions.filter(a => {
                      const q = areaSearchQuery.trim().toLowerCase();
                      if (!q) return true;
                      return (
                        a.areaName.toLowerCase().includes(q) ||
                        (a.plateNumber || '').toLowerCase().includes(q) ||
                        (a.fleetCode || '').toLowerCase().includes(q)
                      );
                    });

                    return (
                      <>
                        <button
                          type="button"
                          onClick={() => setOpenModalDropdown(openModalDropdown === 'area' ? null : 'area')}
                          className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-950 hover:bg-slate-100 dark:hover:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-indigo-500/50 rounded-xl text-slate-900 dark:text-white font-bold flex items-center justify-between gap-2 transition cursor-pointer"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="p-1 rounded-md bg-indigo-500/15 text-indigo-500 dark:text-indigo-400 border border-indigo-500/30 shrink-0">
                              <MapPin className="w-3.5 h-3.5" />
                            </span>
                            <span className="truncate font-extrabold">{newAreaName || 'Pilih Area Kirim'}</span>
                            {currentAreaMeta?.isScheduled && (
                              <span className="px-1.5 py-0.5 rounded text-[9px] font-black uppercase bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 shrink-0">
                                Terjadwal
                              </span>
                            )}
                          </div>
                          <ChevronDown className={`w-4 h-4 text-slate-400 shrink-0 transition-transform ${openModalDropdown === 'area' ? 'rotate-180 text-indigo-500' : ''}`} />
                        </button>

                        {openModalDropdown === 'area' && (
                          <div className="absolute z-50 left-0 right-0 mt-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-2xl overflow-hidden">
                            <div className="p-2 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/90">
                              <div className="relative">
                                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                                <input
                                  type="text"
                                  placeholder="Cari atau ketik nama area jadwal..."
                                  value={areaSearchQuery}
                                  onChange={e => setAreaSearchQuery(e.target.value)}
                                  className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-indigo-500"
                                />
                              </div>
                              {areaSearchQuery.trim().length > 0 &&
                                !filteredAreaList.some(
                                  a => a.areaName.toLowerCase() === areaSearchQuery.trim().toLowerCase()
                                ) && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setNewAreaName(areaSearchQuery.trim().toUpperCase());
                                      setOpenModalDropdown(null);
                                      setAreaSearchQuery('');
                                    }}
                                    className="mt-1.5 w-full px-2.5 py-1.5 rounded-lg bg-indigo-600 text-white text-[11px] font-bold flex items-center justify-center gap-1.5 cursor-pointer"
                                  >
                                    <Plus className="w-3.5 h-3.5" />
                                    <span>Gunakan Area "{areaSearchQuery.trim().toUpperCase()}"</span>
                                  </button>
                                )}
                            </div>

                            <div className="max-h-60 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800/70">
                              {filteredAreaList.map(item => {
                                const isSel = item.areaName.toUpperCase() === newAreaName.toUpperCase();
                                return (
                                  <button
                                    key={item.areaName}
                                    type="button"
                                    onClick={() => handleSelectAreaFromSchedule(item)}
                                    className={`w-full px-3.5 py-2.5 text-left flex items-center justify-between gap-2 transition cursor-pointer ${
                                      isSel
                                        ? 'bg-indigo-50 dark:bg-indigo-500/20 text-indigo-900 dark:text-white'
                                        : 'hover:bg-slate-50 dark:hover:bg-slate-800/80 text-slate-700 dark:text-slate-200'
                                    }`}
                                  >
                                    <div className="min-w-0">
                                      <div className="flex items-center gap-1.5">
                                        <MapPin className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                                        <span className="font-bold text-xs truncate">{item.areaName}</span>
                                        {item.isScheduled && (
                                          <span className="px-1.5 py-0.2 rounded text-[9px] font-black uppercase bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                                            Jadwal Aktif
                                          </span>
                                        )}
                                      </div>
                                      {item.plateNumber && (
                                        <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5 pl-5 flex items-center gap-1.5">
                                          <span>Armada Jadwal:</span>
                                          <span className="font-mono font-bold text-indigo-600 dark:text-indigo-300">
                                            {item.fleetCode ? `[${item.fleetCode}] ` : ''}{item.plateNumber}
                                          </span>
                                          {item.dayName && <span>&bull; {item.dayName}</span>}
                                        </div>
                                      )}
                                    </div>
                                    {isSel && <Check className="w-4 h-4 text-indigo-500 shrink-0" />}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </>
                    );
                  })()}
                </div>
              </div>

              {/* Row 2: Armada (Tanpa Keterangan Model Mobil) */}
              <div className="relative">
                <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1 flex items-center justify-between">
                  <span>Armada (Data Armada Terpadu) *</span>
                  <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold">
                    {fleetOptions.length} Unit Tersedia
                  </span>
                </label>
                {(() => {
                  const cleanCurrent = cleanFleetDisplayLabel(newFleetDisplay);
                  const selectedFleetItem =
                    fleetOptions.find(f => f.label === cleanCurrent) || fleetOptions[0];
                  const filteredFleetsForModal = fleetOptions.filter(f => {
                    const q = fleetSearchQuery.trim().toLowerCase();
                    if (!q) return true;
                    return (
                      f.label.toLowerCase().includes(q) ||
                      f.plateNumber.toLowerCase().includes(q) ||
                      f.initialCode.toLowerCase().includes(q)
                    );
                  });

                  return (
                    <>
                      <button
                        type="button"
                        onClick={() => setOpenModalDropdown(openModalDropdown === 'fleet' ? null : 'fleet')}
                        className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-950 hover:bg-slate-100 dark:hover:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-indigo-500/50 rounded-xl text-left flex items-center justify-between gap-2 transition cursor-pointer"
                      >
                        {selectedFleetItem ? (
                          <div className="flex items-center gap-2.5 min-w-0">
                            <span className="px-2 py-0.5 rounded-md bg-indigo-500/15 text-indigo-600 dark:text-indigo-300 border border-indigo-500/30 font-mono text-[11px] font-black shrink-0">
                              {selectedFleetItem.initialCode}
                            </span>
                            <span className="font-mono font-black text-slate-900 dark:text-white text-xs shrink-0">
                              {selectedFleetItem.plateNumber}
                            </span>
                          </div>
                        ) : (
                          <span className="font-bold text-slate-900 dark:text-white">{cleanCurrent || 'Pilih Armada'}</span>
                        )}
                        <ChevronDown className={`w-4 h-4 text-slate-400 shrink-0 transition-transform ${openModalDropdown === 'fleet' ? 'rotate-180 text-indigo-500' : ''}`} />
                      </button>

                      {openModalDropdown === 'fleet' && (
                        <div className="absolute z-50 left-0 right-0 mt-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-2xl overflow-hidden">
                          <div className="p-2 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/90">
                            <div className="relative">
                              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                              <input
                                type="text"
                                placeholder="Cari plat nomor atau kode armada (N1/NL1)..."
                                value={fleetSearchQuery}
                                onChange={e => setFleetSearchQuery(e.target.value)}
                                className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-indigo-500"
                              />
                            </div>
                          </div>

                          <div className="max-h-60 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800/70">
                            {filteredFleetsForModal.map(f => {
                              const isSel = f.label === cleanCurrent;
                              return (
                                <button
                                  key={f.id}
                                  type="button"
                                  onClick={() => {
                                    setNewFleetDisplay(f.label);
                                    setOpenModalDropdown(null);
                                    setFleetSearchQuery('');
                                  }}
                                  className={`w-full px-3.5 py-2.5 text-left flex items-center justify-between gap-2 transition cursor-pointer ${
                                    isSel
                                      ? 'bg-indigo-50 dark:bg-indigo-500/20 text-indigo-900 dark:text-white'
                                      : 'hover:bg-slate-50 dark:hover:bg-slate-800/80 text-slate-700 dark:text-slate-200'
                                  }`}
                                >
                                  <div className="flex items-center gap-2.5 min-w-0">
                                    <span className="px-2 py-0.5 rounded bg-indigo-500/15 text-indigo-600 dark:text-indigo-300 border border-indigo-500/30 font-mono text-[10px] font-black shrink-0">
                                      {f.initialCode}
                                    </span>
                                    <span className="font-mono font-bold text-xs text-slate-900 dark:text-white">
                                      {f.plateNumber}
                                    </span>
                                  </div>
                                  {isSel && <Check className="w-4 h-4 text-indigo-500 shrink-0" />}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </>
                  );
                })()}
              </div>

              {/* Row 3: Jam Muat (Mulai Jam - Sampai Jam) & Kalkulasi Durasi Otomatis */}
              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-700 dark:text-slate-300">
                    Jam Muat (Mulai Jam - Sampai Jam) *
                  </span>
                  <span className="px-2.5 py-0.5 rounded-md bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 font-extrabold font-mono tabular-nums">
                    Durasi: {liveDurationPreview.durationLabel}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] text-slate-500 dark:text-slate-400 font-semibold mb-1">
                      Mulai Jam
                    </label>
                    <input
                      type="time"
                      value={newStartTime}
                      onChange={e => setNewStartTime(e.target.value)}
                      className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-white font-mono tabular-nums font-bold"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-500 dark:text-slate-400 font-semibold mb-1">
                      Sampai Jam
                    </label>
                    <input
                      type="time"
                      value={newEndTime}
                      onChange={e => setNewEndTime(e.target.value)}
                      className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-white font-mono tabular-nums font-bold"
                    />
                  </div>
                </div>
              </div>

              {/* Row 4: Kru yang Membantu (Terintegrasi Kru Pengiriman & Kernet) */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="block text-slate-700 dark:text-slate-300 font-bold">
                    Kru yang Membantu ({selectedHelpingCrews.length} personel dipilih)
                  </label>
                  <span className="text-[10px] font-bold text-cyan-600 dark:text-cyan-400 flex items-center gap-1">
                    <Users className="w-3 h-3" />
                    Terintegrasi Kru Pengiriman &amp; Kernet
                  </span>
                </div>

                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Cari nama Supir atau Kernet..."
                    value={crewSearchQuery}
                    onChange={e => setCrewSearchQuery(e.target.value)}
                    className="w-full pl-8 pr-3 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div className="flex flex-wrap gap-1.5 p-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl max-h-40 overflow-y-auto">
                  {filteredCrewSelectionList.map(crewItem => {
                    const isSelected = selectedHelpingCrews.includes(crewItem.name);
                    return (
                      <button
                        key={crewItem.name}
                        type="button"
                        onClick={() => handleToggleCrew(crewItem.name)}
                        className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold transition cursor-pointer flex items-center gap-1.5 ${
                          isSelected
                            ? 'bg-indigo-600 text-white shadow-2xs'
                            : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-800 hover:border-indigo-400'
                        }`}
                      >
                        <span>{isSelected ? `✓ ${crewItem.name}` : `+ ${crewItem.name}`}</span>
                        <span
                          className={`px-1.5 py-0.2 rounded text-[9px] font-black uppercase ${
                            isSelected
                              ? 'bg-white/20 text-white'
                              : crewItem.roleLabel === 'Kernet'
                              ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300'
                              : 'bg-blue-500/15 text-blue-700 dark:text-blue-300'
                          }`}
                        >
                          {crewItem.roleLabel}
                        </span>
                      </button>
                    );
                  })}
                </div>

                {/* Custom Crew Input */}
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    placeholder="Ketik nama kru tambahan bila belum ada di daftar..."
                    value={customCrewInput}
                    onChange={e => setCustomCrewInput(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddCustomCrew();
                      }
                    }}
                    className="flex-1 px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-white"
                  />
                  <button
                    type="button"
                    onClick={handleAddCustomCrew}
                    className="px-3 py-2 bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 rounded-xl font-bold transition cursor-pointer"
                  >
                    Tambah Kru
                  </button>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => {
                    setIsAddModalOpen(false);
                    setEditingRecordId(null);
                    setOpenModalDropdown(null);
                  }}
                  className="px-4 py-2 text-slate-600 dark:text-slate-400 font-bold rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-white font-bold rounded-xl shadow-xs cursor-pointer"
                >
                  {editingRecordId ? 'Simpan Perubahan' : 'Simpan Sesi Muat'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
