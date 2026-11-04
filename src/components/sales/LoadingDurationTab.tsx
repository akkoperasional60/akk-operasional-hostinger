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
  Timer
} from 'lucide-react';
import {
  SalesHeaderFilter,
  SalesTopTab
} from './SalesHeaderFilter';
import { logisticsStore } from '../../services/store';
import { Fleet, Crew } from '../../types';
import { OFFICIAL_DESTINATION_AREAS } from '../../utils/areaNormalizer';

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

  // Subscribe to Data Armada Terpadu & Kru Pengiriman from logisticsStore
  const [fleets, setFleets] = useState<Fleet[]>(() => logisticsStore.getFleets());
  const [crews, setCrews] = useState<Crew[]>(() => logisticsStore.getCrews());

  useEffect(() => {
    setFleets(logisticsStore.getFleets());
    setCrews(logisticsStore.getCrews());
    const unsub = logisticsStore.subscribe(() => {
      setFleets([...logisticsStore.getFleets()]);
      setCrews([...logisticsStore.getCrews()]);
    });
    return unsub;
  }, []);

  const fleetOptions = useMemo(() => {
    return fleets.map(f => ({
      id: f.id,
      label: formatFleetOptionLabel(f)
    }));
  }, [fleets]);

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

  const openInputModal = () => {
    setNewDayName('Senin');
    setNewAreaName('DENPASAR 1');
    setNewFleetDisplay(fleetOptions[0]?.label || '');
    setNewStartTime('08:00');
    setNewEndTime('09:30');
    setSelectedHelpingCrews(crewNamesList.slice(0, 2));
    setCustomCrewInput('');
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
  };

  const handleDeleteRecord = (id: string) => {
    const updated = fleetRecords.filter(r => r.id !== id);
    setFleetRecords(updated);
    localStorage.setItem('akk_loading_fleets_v2', JSON.stringify(updated));
  };

  return (
    <div className="space-y-6">
      {/* Header & Unified Filter */}
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
                Terintegrasi dengan Data Armada Terpadu ({fleets.length} unit kendaraan aktif)
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

      {/* Modal Input Muat - Redesigned to match exact Pemantauan Durasi Muat columns */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-lg w-full p-6 shadow-xl border border-slate-200 dark:border-slate-800 max-h-[90vh] overflow-y-auto">
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
                    Formulir terintegrasi dengan kolom Pemantauan Durasi Muat &amp; Data Armada Terpadu
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAddFleet} className="space-y-4 text-xs">
              {/* Row 1: Hari & Nama Area Kirim */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1">
                    Hari Muat *
                  </label>
                  <select
                    value={newDayName}
                    onChange={e => setNewDayName(e.target.value)}
                    className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-white font-semibold"
                  >
                    {DAY_OPTIONS.map(day => (
                      <option key={day} value={day}>
                        {day}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1">
                    Nama Area Kirim *
                  </label>
                  <input
                    type="text"
                    required
                    list="official-area-kirim-list"
                    placeholder="Pilih atau ketik area kirim..."
                    value={newAreaName}
                    onChange={e => setNewAreaName(e.target.value)}
                    className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-white font-semibold"
                  />
                  <datalist id="official-area-kirim-list">
                    {OFFICIAL_DESTINATION_AREAS.map(area => (
                      <option key={area} value={area} />
                    ))}
                  </datalist>
                </div>
              </div>

              {/* Row 2: Armada (Dropdown dari Data Armada Terpadu) */}
              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1">
                  Armada (Data Armada Terpadu) *
                </label>
                <select
                  value={newFleetDisplay}
                  onChange={e => setNewFleetDisplay(e.target.value)}
                  required
                  className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-white font-bold"
                >
                  {fleetOptions.map(f => (
                    <option key={f.id} value={f.label}>
                      {f.label}
                    </option>
                  ))}
                </select>
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
                  onClick={() => setIsAddModalOpen(false)}
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
