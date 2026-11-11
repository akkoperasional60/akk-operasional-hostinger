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
  Sparkles
} from 'lucide-react';
import {
  SalesHeaderFilter,
  SalesTopTab
} from './SalesHeaderFilter';
import { logisticsStore } from '../../services/store';
import { Fleet, Crew, Schedule } from '../../types';
import { OFFICIAL_DESTINATION_AREAS, standardizeAreaName } from '../../utils/areaNormalizer';

interface LoadingDurationTabProps {
  onNavigateSubTab?: (sub: 'dashboard' | 'activities' | 'schedules' | 'loading_duration' | 'skill_matrix' | 'jobdesk') => void;
  adminOptions: string[];
}

export interface LoadingFleetRecord {
  id: string;
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

const DAY_OPTIONS = [
  'Senin',
  'Selasa',
  'Rabu',
  'Kamis',
  'Jumat',
  'Sabtu',
  'Minggu'
];

const DAY_NAMES_FROM_JS = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];

function getDayNameFromDateStr(dateStr?: string): string | null {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return null;
  return DAY_NAMES_FROM_JS[d.getDay()] || null;
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

function formatFleetOptionLabel(fleet: Fleet): string {
  const code = fleet.initialCode ? `[${fleet.initialCode}] ` : '';
  return `${code}${fleet.plateNumber} — ${fleet.vehicleType}`;
}

export const LoadingDurationTab: React.FC<LoadingDurationTabProps> = ({
  onNavigateSubTab,
  adminOptions
}) => {
  const [selectedAdmin, setSelectedAdmin] = useState('SEMUA ADMIN');
  const [selectedMonth, setSelectedMonth] = useState('Agustus');
  const [selectedYear, setSelectedYear] = useState('2026');

  // Subscribe to Data Armada Terpadu, Kru Pengiriman, & Jadwal Penugasan from logisticsStore
  const [fleets, setFleets] = useState<Fleet[]>(() => logisticsStore.getFleets());
  const [crews, setCrews] = useState<Crew[]>(() => logisticsStore.getCrews());
  const [schedules, setSchedules] = useState<Schedule[]>(() => logisticsStore.getSchedules());

  useEffect(() => {
    setFleets(logisticsStore.getFleets());
    setCrews(logisticsStore.getCrews());
    setSchedules(logisticsStore.getSchedules());
    const unsub = logisticsStore.subscribe(() => {
      setFleets([...logisticsStore.getFleets()]);
      setCrews([...logisticsStore.getCrews()]);
      setSchedules([...logisticsStore.getSchedules()]);
    });
    return unsub;
  }, []);

  const fleetOptions = useMemo(() => {
    return fleets.map(f => ({
      id: f.id,
      initialCode: f.initialCode || 'UNIT',
      plateNumber: f.plateNumber,
      vehicleType: f.vehicleType,
      brand: f.brand || 'Standar',
      boxCapacityM3: f.boxCapacityM3 || 5.5,
      label: formatFleetOptionLabel(f)
    }));
  }, [fleets]);

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

    // Sort schedules newest first so latest assignment wins
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
        const dayStr = getDayNameFromDateStr(sch.departureDate) || undefined;
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

    // Also include all OFFICIAL_DESTINATION_AREAS from Jadwal & Penugasan
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

  const crewNamesList = useMemo(() => {
    const names = crews.map(c => (c.name || '').trim()).filter(Boolean);
    return Array.from(new Set(names));
  }, [crews]);

  const defaultInitialRecords = useMemo<LoadingFleetRecord[]>(() => {
    const f0 = fleetOptions[0]?.label || '[NL1] P 8476 V — CDE Box';
    const f1 = fleetOptions[1]?.label || '[N21 / NL2] P 8711 UW — CDD Box';
    const f2 = fleetOptions[2]?.label || '[N22] P 9318 UV — CDD Long Box';

    return [
      {
        id: 'ld-1',
        dayName: 'Senin',
        areaName: 'DENPASAR 1',
        fleetDisplay: f0,
        startTime: '08:00',
        endTime: '09:45',
        loadingTimeRange: '08:00 - 09:45',
        durationLabel: '1 jam 45 mnt',
        durationMinutes: 105,
        helpingCrews: ['Faisol Arifin', 'Bintang Wahyu Pratama']
      },
      {
        id: 'ld-2',
        dayName: 'Selasa',
        areaName: 'KALIBARU',
        fleetDisplay: f1,
        startTime: '09:00',
        endTime: '11:15',
        loadingTimeRange: '09:00 - 11:15',
        durationLabel: '2 jam 15 mnt',
        durationMinutes: 135,
        helpingCrews: ['Ahmad Yani', 'Rizky Pratama']
      },
      {
        id: 'ld-3',
        dayName: 'Rabu',
        areaName: 'JEMBER KOTA',
        fleetDisplay: f2,
        startTime: '10:15',
        endTime: '11:45',
        loadingTimeRange: '10:15 - 11:45',
        durationLabel: '1 jam 30 mnt',
        durationMinutes: 90,
        helpingCrews: ['Hendra Wijaya', 'Dedi Kurniawan']
      }
    ];
  }, [fleetOptions]);

  const [fleetRecords, setFleetRecords] = useState<LoadingFleetRecord[]>(() => {
    const saved = localStorage.getItem('akk_loading_fleets_v2');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      } catch (e) {
        console.error(e);
      }
    }
    return defaultInitialRecords;
  });

  // Modal Form State matching exact table columns
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newDayName, setNewDayName] = useState('Senin');
  const [newAreaName, setNewAreaName] = useState('DENPASAR 1');
  const [newFleetDisplay, setNewFleetDisplay] = useState(() => fleetOptions[0]?.label || '');
  const [newStartTime, setNewStartTime] = useState('08:00');
  const [newEndTime, setNewEndTime] = useState('09:30');
  const [selectedHelpingCrews, setSelectedHelpingCrews] = useState<string[]>([]);
  const [customCrewInput, setCustomCrewInput] = useState('');

  // Custom Dropdown State inside Modal Input Sesi Muat Armada Baru
  const [openModalDropdown, setOpenModalDropdown] = useState<null | 'day' | 'area' | 'fleet'>(null);
  const [areaSearchQuery, setAreaSearchQuery] = useState('');
  const [fleetSearchQuery, setFleetSearchQuery] = useState('');

  useEffect(() => {
    if (!newFleetDisplay && fleetOptions.length > 0) {
      setNewFleetDisplay(fleetOptions[0].label);
    }
  }, [fleetOptions, newFleetDisplay]);

  const liveDurationPreview = useMemo(
    () => calculateDuration(newStartTime, newEndTime),
    [newStartTime, newEndTime]
  );

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
    dayName?: string;
    crews?: string[];
  }) => {
    setNewAreaName(areaItem.areaName);
    if (areaItem.fleetDisplay) {
      setNewFleetDisplay(areaItem.fleetDisplay);
    }
    if (areaItem.dayName) {
      setNewDayName(areaItem.dayName);
    }
    if (areaItem.crews && areaItem.crews.length > 0) {
      setSelectedHelpingCrews(areaItem.crews);
    }
    setOpenModalDropdown(null);
    setAreaSearchQuery('');
  };

  const openInputModal = () => {
    const firstScheduled = areaScheduleOptions[0];
    setNewDayName(firstScheduled?.dayName || 'Senin');
    setNewAreaName(firstScheduled?.areaName || 'DENPASAR 1');
    setNewFleetDisplay(firstScheduled?.fleetDisplay || fleetOptions[0]?.label || '');
    setNewStartTime('08:00');
    setNewEndTime('09:30');
    setSelectedHelpingCrews(
      firstScheduled?.crews && firstScheduled.crews.length > 0
        ? firstScheduled.crews
        : crewNamesList.slice(0, 2)
    );
    setCustomCrewInput('');
    setOpenModalDropdown(null);
    setAreaSearchQuery('');
    setFleetSearchQuery('');
    setIsAddModalOpen(true);
  };

  const handleAddFleet = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFleetDisplay || !newAreaName) return;

    const { diffMinutes, durationLabel } = calculateDuration(newStartTime, newEndTime);

    const newRecord: LoadingFleetRecord = {
      id: 'ld-' + Math.random().toString(36).substring(2, 8),
      dayName: newDayName,
      areaName: newAreaName.toUpperCase(),
      fleetDisplay: newFleetDisplay,
      startTime: newStartTime,
      endTime: newEndTime,
      loadingTimeRange: `${newStartTime} - ${newEndTime}`,
      durationLabel,
      durationMinutes: diffMinutes,
      helpingCrews:
        selectedHelpingCrews.length > 0 ? selectedHelpingCrews : ['Kru Gudang & Armada']
    };

    const updated = [newRecord, ...fleetRecords];
    setFleetRecords(updated);
    localStorage.setItem('akk_loading_fleets_v2', JSON.stringify(updated));
    setIsAddModalOpen(false);
    setOpenModalDropdown(null);
  };

  const handleDeleteRecord = (id: string) => {
    const updated = fleetRecords.filter(r => r.id !== id);
    setFleetRecords(updated);
    localStorage.setItem('akk_loading_fleets_v2', JSON.stringify(updated));
  };

  return (
    <div className="space-y-6">
      {/* Header & Unified Filter (Tanpa Filter Admin sesuai permintaan) */}
      <SalesHeaderFilter
        title="Pemantauan Durasi Muat Armada"
        subtitle="Pantau waktu mulai hingga selesai muat armada, area tujuan kirim, serta kru yang membantu proses muat."
        activeTab="durasi_muat"
        onTabChange={handleTopTabChange}
        selectedAdmin={selectedAdmin}
        onAdminChange={setSelectedAdmin}
        selectedMonth={selectedMonth}
        onMonthChange={setSelectedMonth}
        selectedYear={selectedYear}
        onYearChange={setSelectedYear}
        jadwalInputCount={fleetRecords.length}
        pencapaianPercent={100}
        periodeLabel={`${selectedMonth.slice(0, 3)} ${selectedYear}`}
        adminOptions={adminOptions}
        hideAdminFilter={true}
      />

      {/* Main Card: Pemantauan Durasi Muat */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-xs">
        <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                Pemantauan Durasi Muat (SLA)
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Terintegrasi dengan Jadwal &amp; Penugasan serta Data Armada Terpadu ({fleets.length} unit kendaraan aktif)
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 self-start sm:self-auto">
            <span className="text-xs font-bold text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/50 px-3 py-1.5 rounded-lg border border-indigo-200/70 dark:border-indigo-800/60 font-mono tabular-nums">
              {fleetRecords.length} Sesi Muat
            </span>
            <button
              onClick={openInputModal}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold shadow-xs transition cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Input Muat</span>
            </button>
          </div>
        </div>

        {/* Table with the exact 7 requested columns:
            No | Hari | Nama Area Kirim | Armada | Jam Muat (Mulai Jam - Sampai Jam) | Durasi | Kru yang Membantu */}
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead>
              <tr className="bg-slate-50/90 dark:bg-slate-800/70 border-b border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 uppercase text-[10px] tracking-wider font-extrabold">
                <th className="py-3.5 px-4 w-12 text-center">NO</th>
                <th className="py-3.5 px-4">HARI</th>
                <th className="py-3.5 px-4">NAMA AREA KIRIM</th>
                <th className="py-3.5 px-4">ARMADA (DATA ARMADA TERPADU)</th>
                <th className="py-3.5 px-4">JAM MUAT (MULAI JAM - SAMPAI JAM)</th>
                <th className="py-3.5 px-4">DURASI</th>
                <th className="py-3.5 px-4">KRU YANG MEMBANTU</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {fleetRecords.map((item, idx) => (
                <tr key={item.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition">
                  {/* 1. No */}
                  <td className="py-3.5 px-4 text-center font-bold text-slate-500 font-mono tabular-nums">
                    {idx + 1}
                  </td>

                  {/* 2. Hari */}
                  <td className="py-3.5 px-4 whitespace-nowrap">
                    <span className="inline-flex items-center gap-1.5 font-bold text-slate-900 dark:text-white">
                      <Calendar className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                      {item.dayName || 'Senin'}
                    </span>
                  </td>

                  {/* 3. Nama Area Kirim */}
                  <td className="py-3.5 px-4 whitespace-nowrap">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-bold bg-indigo-50 dark:bg-indigo-950/50 text-indigo-800 dark:text-indigo-300 border border-indigo-200/70 dark:border-indigo-800/60">
                      <MapPin className="w-3 h-3 shrink-0" />
                      {item.areaName}
                    </span>
                  </td>

                  {/* 4. Armada */}
                  <td className="py-3.5 px-4 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      <Truck className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                      <span className="font-bold text-slate-900 dark:text-white">
                        {item.fleetDisplay}
                      </span>
                    </div>
                  </td>

                  {/* 5. Jam Muat (Mulai Jam - Sampai Jam) */}
                  <td className="py-3.5 px-4 whitespace-nowrap">
                    <span className="inline-flex items-center gap-1.5 font-mono tabular-nums font-bold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 px-2.5 py-1 rounded-md">
                      <Clock className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                      {item.loadingTimeRange}
                    </span>
                  </td>

                  {/* 6. Durasi */}
                  <td className="py-3.5 px-4 whitespace-nowrap">
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md font-extrabold text-[11px] bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 font-mono tabular-nums">
                      <Timer className="w-3.5 h-3.5" />
                      {item.durationLabel}
                    </span>
                  </td>

                  {/* 7. Kru yang Membantu */}
                  <td className="py-3.5 px-4">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex flex-wrap gap-1.5">
                        {(item.helpingCrews || []).map(crew => (
                          <span
                            key={crew}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700"
                          >
                            <Users className="w-3 h-3 text-indigo-600 dark:text-indigo-400" />
                            {crew}
                          </span>
                        ))}
                      </div>

                      <button
                        type="button"
                        onClick={() => handleDeleteRecord(item.id)}
                        title="Hapus Data Muat"
                        className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition cursor-pointer shrink-0"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Input Muat - Redesigned with Custom Interactive Dropdowns synced with Jadwal & Penugasan */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-800 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800 mb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
                  <Truck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    Input Sesi Muat Armada Baru
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Area kirim &amp; armada tersinkronisasi dengan Jadwal &amp; Penugasan
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsAddModalOpen(false);
                  setOpenModalDropdown(null);
                }}
                className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-white rounded-lg cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAddFleet} className="space-y-4 text-xs">
              {/* Row 1: Hari Muat & Nama Area Kirim (Custom Dropdowns) */}
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-3.5">
                {/* Hari Muat Custom Dropdown (4 cols) */}
                <div className="sm:col-span-4 relative">
                  <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1">
                    Hari Muat *
                  </label>
                  <button
                    type="button"
                    onClick={() => setOpenModalDropdown(openModalDropdown === 'day' ? null : 'day')}
                    className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-950 hover:bg-slate-100 dark:hover:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-indigo-500/50 rounded-xl text-slate-900 dark:text-white font-bold flex items-center justify-between gap-2 transition cursor-pointer"
                  >
                    <div className="flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                      <span>{newDayName}</span>
                    </div>
                    <ChevronDown className={`w-4 h-4 text-slate-400 shrink-0 transition-transform ${openModalDropdown === 'day' ? 'rotate-180 text-indigo-500' : ''}`} />
                  </button>

                  {openModalDropdown === 'day' && (
                    <div className="absolute z-50 left-0 right-0 mt-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-2xl overflow-hidden divide-y divide-slate-100 dark:divide-slate-800">
                      {DAY_OPTIONS.map(day => {
                        const isSel = newDayName === day;
                        return (
                          <button
                            key={day}
                            type="button"
                            onClick={() => {
                              setNewDayName(day);
                              setOpenModalDropdown(null);
                            }}
                            className={`w-full px-3 py-2 text-left text-xs font-bold flex items-center justify-between transition cursor-pointer ${
                              isSel
                                ? 'bg-indigo-50 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-300'
                                : 'hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200'
                            }`}
                          >
                            <span>{day}</span>
                            {isSel && <Check className="w-3.5 h-3.5 text-indigo-500" />}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Nama Area Kirim (Mengikuti Area Jadwal & Penugasan) Custom Dropdown (8 cols) */}
                <div className="sm:col-span-8 relative">
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
                                  onChange={(e) => setAreaSearchQuery(e.target.value)}
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

              {/* Row 2: Armada (Custom Interactive Dropdown dari Data Armada Terpadu) */}
              <div className="relative">
                <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1 flex items-center justify-between">
                  <span>Armada (Data Armada Terpadu) *</span>
                  <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold">
                    {fleetOptions.length} Unit Tersedia
                  </span>
                </label>
                {(() => {
                  const selectedFleetItem =
                    fleetOptions.find(f => f.label === newFleetDisplay) || fleetOptions[0];
                  const filteredFleetsForModal = fleetOptions.filter(f => {
                    const q = fleetSearchQuery.trim().toLowerCase();
                    if (!q) return true;
                    return (
                      f.label.toLowerCase().includes(q) ||
                      f.plateNumber.toLowerCase().includes(q) ||
                      f.initialCode.toLowerCase().includes(q) ||
                      f.vehicleType.toLowerCase().includes(q) ||
                      f.brand.toLowerCase().includes(q)
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
                            <span className="text-slate-500 dark:text-slate-400 text-[11px] truncate">
                              — {selectedFleetItem.vehicleType} ({selectedFleetItem.boxCapacityM3} m³)
                            </span>
                          </div>
                        ) : (
                          <span className="font-bold text-slate-900 dark:text-white">{newFleetDisplay || 'Pilih Armada'}</span>
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
                                placeholder="Cari plat nomor, kode inisial (N1/NL1), atau tipe..."
                                value={fleetSearchQuery}
                                onChange={(e) => setFleetSearchQuery(e.target.value)}
                                className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-indigo-500"
                              />
                            </div>
                          </div>

                          <div className="max-h-60 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800/70">
                            {filteredFleetsForModal.map(f => {
                              const isSel = f.label === newFleetDisplay;
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
                                    <div className="min-w-0">
                                      <div className="font-mono font-bold text-xs text-slate-900 dark:text-white">
                                        {f.plateNumber}
                                      </div>
                                      <div className="text-[10px] text-slate-500 dark:text-slate-400">
                                        {f.vehicleType} &bull; {f.brand}
                                      </div>
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-2 shrink-0">
                                    <span className="px-1.5 py-0.5 rounded bg-cyan-500/15 text-cyan-600 dark:text-cyan-300 border border-cyan-500/30 font-mono text-[10px] font-bold">
                                      {f.boxCapacityM3} m³
                                    </span>
                                    {isSel && <Check className="w-4 h-4 text-indigo-500" />}
                                  </div>
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

              {/* Row 4: Kru yang Membantu */}
              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1.5">
                  Kru yang Membantu ({selectedHelpingCrews.length} personel dipilih)
                </label>
                <div className="flex flex-wrap gap-1.5 p-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl max-h-36 overflow-y-auto">
                  {crewNamesList.map(crewName => {
                    const isSelected = selectedHelpingCrews.includes(crewName);
                    return (
                      <button
                        key={crewName}
                        type="button"
                        onClick={() => handleToggleCrew(crewName)}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition cursor-pointer ${
                          isSelected
                            ? 'bg-indigo-600 text-white shadow-2xs'
                            : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-800 hover:border-indigo-400'
                        }`}
                      >
                        {isSelected ? `✓ ${crewName}` : `+ ${crewName}`}
                      </button>
                    );
                  })}
                </div>

                {/* Custom Crew Input */}
                <div className="flex items-center gap-2 mt-2">
                  <input
                    type="text"
                    placeholder="Ketik nama kru tambahan bila belum ada di daftar..."
                    value={customCrewInput}
                    onChange={e => setCustomCrewInput(e.target.value)}
                    className="flex-1 px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-white"
                  />
                  <button
                    type="button"
                    onClick={handleAddCustomCrew}
                    className="px-3 py-2 bg-slate-800 dark:bg-slate-700 text-white rounded-xl font-semibold hover:bg-slate-700 cursor-pointer"
                  >
                    Tambah Kru
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => {
                    setIsAddModalOpen(false);
                    setOpenModalDropdown(null);
                  }}
                  className="px-4 py-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl font-semibold cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold shadow-xs cursor-pointer"
                >
                  Simpan Sesi Muat
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
