import React, { useState, useEffect, useMemo } from 'react';
import {
  Calendar,
  Save,
  RotateCcw,
  Printer,
  FileSpreadsheet,
  Plus,
  Trash2,
  ChevronDown,
  Check,
  UserCheck,
  Clock,
  ShieldCheck,
  X,
  ClipboardList,
  Sparkles
} from 'lucide-react';
import {
  SalesHeaderFilter,
  SalesTopTab,
  MONTH_OPTIONS,
  useSalesAdminUsers
} from './SalesHeaderFilter';

interface AdminSchedulesTabProps {
  onNavigateSubTab?: (sub: 'dashboard' | 'activities' | 'schedules' | 'loading_duration' | 'skill_matrix' | 'jobdesk') => void;
  adminOptions: string[];
}

export interface AdminDailyScheduleItem {
  id: string;
  date: string; // YYYY-MM-DD
  adminName: string;
  duties: string[];
  shiftTime: string;
  isBackupAcc: boolean;
  notes: string;
}

const DUTY_OPTIONS = [
  'Cek Eceran',
  'Cek Faktur Kuning',
  'Cek Faktur Toko',
  'Cek Surat Jalan Toko',
  'Input Retur Toko',
  'HP Telkomsel',
  'HP XL',
  'Muat Kelilingan',
  'Muat Toko',
  'Muat AKS',
  'Data Rekap',
  'Revisi Faktur Toko',
  'Back Up ACC',
  'Piket Pagi'
];

const DAY_NAMES_ID = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];

function getDaysInMonth(year: number, monthIndex: number): number {
  return new Date(year, monthIndex + 1, 0).getDate();
}

function getFirstDayOfMonth(year: number, monthIndex: number): number {
  return new Date(year, monthIndex, 1).getDay();
}

function formatDateIso(year: number, monthIndex: number, day: number): string {
  const m = String(monthIndex + 1).padStart(2, '0');
  const d = String(day).padStart(2, '0');
  return `${year}-${m}-${d}`;
}

function getDayNameFromIso(isoDate: string): string {
  const [y, m, d] = isoDate.split('-').map(Number);
  if (!y || !m || !d) return 'Senin';
  const dt = new Date(y, m - 1, d);
  return DAY_NAMES_ID[dt.getDay()] || 'Senin';
}

function formatReadableDateId(isoDate: string): string {
  const [y, m, d] = isoDate.split('-').map(Number);
  if (!y || !m || !d) return isoDate;
  const dayName = getDayNameFromIso(isoDate);
  const monthName = MONTH_OPTIONS[m - 1] || '';
  return `${dayName}, ${d} ${monthName} ${y}`;
}

function createInitialSchedules(adminNames: string[]): AdminDailyScheduleItem[] {
  const a0 = adminNames[0] || 'ADMIN PENJUALAN';
  const a1 = adminNames[1] || a0;
  const a2 = adminNames[2] || a0;

  return [
    {
      id: 'sch-1',
      date: '2026-08-10',
      adminName: a0,
      duties: ['Cek Eceran', 'HP Telkomsel', 'Input Retur Toko'],
      shiftTime: '08:00 - 16:00',
      isBackupAcc: true,
      notes: 'Fokus validasi faktur pagi & antrian toko retail'
    },
    {
      id: 'sch-2',
      date: '2026-08-10',
      adminName: a1,
      duties: ['Cek Faktur Toko', 'Muat Toko'],
      shiftTime: '08:00 - 16:00',
      isBackupAcc: false,
      notes: 'Koordinasi surat jalan area Rogojampi & Genteng'
    },
    {
      id: 'sch-3',
      date: '2026-08-11',
      adminName: a1,
      duties: ['Cek Faktur Kuning', 'Data Rekap'],
      shiftTime: '08:00 - 16:00',
      isBackupAcc: true,
      notes: 'Rekapitulasi PO masuk mingguan'
    },
    {
      id: 'sch-4',
      date: '2026-08-12',
      adminName: a2,
      duties: ['Muat Kelilingan', 'Cek Surat Jalan Toko'],
      shiftTime: '08:00 - 16:00',
      isBackupAcc: true,
      notes: 'Monitoring pemberangkatan armada pagi'
    }
  ];
}

export const AdminSchedulesTab: React.FC<AdminSchedulesTabProps> = ({
  onNavigateSubTab,
  adminOptions
}) => {
  const salesAdminUsers = useSalesAdminUsers();
  const salesAdminNames = useMemo(() => {
    const names = salesAdminUsers
      .map(u => (u.fullName || '').trim().toUpperCase())
      .filter(Boolean);
    return names.length > 0 ? Array.from(new Set(names)) : ['ADMIN PENJUALAN'];
  }, [salesAdminUsers]);

  const [selectedAdmin, setSelectedAdmin] = useState('SEMUA ADMIN');
  const [selectedMonth, setSelectedMonth] = useState('Agustus');
  const [selectedYear, setSelectedYear] = useState('2026');
  const [saveToast, setSaveToast] = useState<string | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);

  const monthIndex = Math.max(0, MONTH_OPTIONS.indexOf(selectedMonth));
  const yearNum = Number(selectedYear) || 2026;

  const [selectedDateIso, setSelectedDateIso] = useState<string>(() =>
    formatDateIso(yearNum, monthIndex, 10)
  );

  // Sync selectedDateIso when month or year changes
  useEffect(() => {
    const parts = selectedDateIso.split('-').map(Number);
    const currentDay = parts[2] || 1;
    const maxDays = getDaysInMonth(yearNum, monthIndex);
    const clampedDay = Math.min(currentDay, maxDays);
    setSelectedDateIso(formatDateIso(yearNum, monthIndex, clampedDay));
  }, [selectedMonth, selectedYear, yearNum, monthIndex]);

  const [schedules, setSchedules] = useState<AdminDailyScheduleItem[]>(() => {
    const saved = localStorage.getItem('akk_admin_calendar_schedules_v1');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      } catch (e) {
        console.error(e);
      }
    }
    return createInitialSchedules(salesAdminNames);
  });

  useEffect(() => {
    localStorage.setItem('akk_admin_calendar_schedules_v1', JSON.stringify(schedules));
  }, [schedules]);

  // Manual Schedule Modal State
  const [isManualModalOpen, setIsManualModalOpen] = useState(false);
  const [manualDate, setManualDate] = useState(selectedDateIso);
  const [manualAdmin, setManualAdmin] = useState(() => salesAdminNames[0] || '');
  const [manualDuties, setManualDuties] = useState<string[]>(['Cek Eceran']);
  const [customDutyInput, setCustomDutyInput] = useState('');
  const [manualStartTime, setManualStartTime] = useState('08:00');
  const [manualEndTime, setManualEndTime] = useState('16:00');
  const [manualIsBackupAcc, setManualIsBackupAcc] = useState(false);
  const [manualNotes, setManualNotes] = useState('');

  useEffect(() => {
    if (salesAdminNames.length > 0 && !salesAdminNames.includes(manualAdmin)) {
      setManualAdmin(salesAdminNames[0]);
    }
  }, [salesAdminNames, manualAdmin]);

  const openManualModalForDate = (dateIso?: string) => {
    setManualDate(dateIso || selectedDateIso);
    setManualAdmin(
      selectedAdmin !== 'SEMUA ADMIN'
        ? selectedAdmin
        : salesAdminNames[0] || 'ADMIN PENJUALAN'
    );
    setManualDuties(['Cek Eceran']);
    setCustomDutyInput('');
    setManualStartTime('08:00');
    setManualEndTime('16:00');
    setManualIsBackupAcc(false);
    setManualNotes('');
    setIsManualModalOpen(true);
  };

  const handleTopTabChange = (tab: SalesTopTab) => {
    if (tab === 'checklist' || tab === 'aktivitas_view') {
      onNavigateSubTab?.('activities');
    } else if (tab === 'durasi_muat') {
      onNavigateSubTab?.('loading_duration');
    }
  };

  // Filtered schedules for the selected month/year and selectedAdmin
  const monthPrefix = `${yearNum}-${String(monthIndex + 1).padStart(2, '0')}`;

  const filteredMonthSchedules = useMemo(() => {
    return schedules.filter(item => {
      const matchMonth = item.date.startsWith(monthPrefix);
      const matchAdmin =
        selectedAdmin === 'SEMUA ADMIN' ||
        item.adminName.toUpperCase() === selectedAdmin.toUpperCase();
      return matchMonth && matchAdmin;
    });
  }, [schedules, monthPrefix, selectedAdmin]);

  const schedulesByDate = useMemo(() => {
    const map: Record<string, AdminDailyScheduleItem[]> = {};
    filteredMonthSchedules.forEach(item => {
      if (!map[item.date]) map[item.date] = [];
      map[item.date].push(item);
    });
    return map;
  }, [filteredMonthSchedules]);

  const selectedDateSchedules = useMemo(() => {
    return schedules.filter(item => {
      const matchDate = item.date === selectedDateIso;
      const matchAdmin =
        selectedAdmin === 'SEMUA ADMIN' ||
        item.adminName.toUpperCase() === selectedAdmin.toUpperCase();
      return matchDate && matchAdmin;
    });
  }, [schedules, selectedDateIso, selectedAdmin]);

  const backupAccOnSelectedDate = useMemo(() => {
    const found = schedules.find(s => s.date === selectedDateIso && s.isBackupAcc);
    return found?.adminName || '';
  }, [schedules, selectedDateIso]);

  const handleSetBackupAccForDate = (dateIso: string, adminName: string) => {
    setSchedules(prev => {
      const existingForDate = prev.filter(s => s.date === dateIso);
      const updated = prev.map(s => {
        if (s.date !== dateIso) return s;
        return {
          ...s,
          isBackupAcc: adminName !== '' && s.adminName.toUpperCase() === adminName.toUpperCase()
        };
      });

      // If the selected admin doesn't have a row on this date yet, create one automatically
      if (
        adminName &&
        !existingForDate.some(s => s.adminName.toUpperCase() === adminName.toUpperCase())
      ) {
        updated.push({
          id: 'sch-' + Math.random().toString(36).substring(2, 8),
          date: dateIso,
          adminName,
          duties: ['Back Up ACC'],
          shiftTime: '08:00 - 16:00',
          isBackupAcc: true,
          notes: 'Penugasan Back Up ACC Harian'
        });
      }
      return updated;
    });
  };

  const handleAddDutyToSchedule = (scheduleId: string, duty: string) => {
    if (!duty) return;
    setSchedules(prev =>
      prev.map(item => {
        if (item.id !== scheduleId) return item;
        if (item.duties.includes(duty)) return item;
        return { ...item, duties: [...item.duties, duty] };
      })
    );
  };

  const handleRemoveDutyFromSchedule = (scheduleId: string, dutyToRemove: string) => {
    setSchedules(prev =>
      prev.map(item => {
        if (item.id !== scheduleId) return item;
        return { ...item, duties: item.duties.filter(d => d !== dutyToRemove) };
      })
    );
  };

  const handleDeleteScheduleItem = (scheduleId: string) => {
    setSchedules(prev => prev.filter(item => item.id !== scheduleId));
  };

  const handleToggleManualDuty = (duty: string) => {
    setManualDuties(prev =>
      prev.includes(duty) ? prev.filter(d => d !== duty) : [...prev, duty]
    );
  };

  const handleAddCustomDuty = () => {
    const trimmed = customDutyInput.trim();
    if (!trimmed) return;
    if (!manualDuties.includes(trimmed)) {
      setManualDuties(prev => [...prev, trimmed]);
    }
    setCustomDutyInput('');
  };

  const handleSaveManualSchedule = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualAdmin || !manualDate) return;

    const finalDuties = manualDuties.length > 0 ? manualDuties : ['Tugas Operasional Admin'];
    const shiftTime = `${manualStartTime} - ${manualEndTime}`;

    setSchedules(prev => {
      let next = [...prev];
      if (manualIsBackupAcc) {
        next = next.map(item =>
          item.date === manualDate ? { ...item, isBackupAcc: false } : item
        );
      }

      const existingIdx = next.findIndex(
        item =>
          item.date === manualDate &&
          item.adminName.toUpperCase() === manualAdmin.toUpperCase()
      );

      if (existingIdx >= 0) {
        const existing = next[existingIdx];
        const mergedDuties = Array.from(new Set([...existing.duties, ...finalDuties]));
        next[existingIdx] = {
          ...existing,
          duties: mergedDuties,
          shiftTime,
          isBackupAcc: manualIsBackupAcc || existing.isBackupAcc,
          notes: manualNotes || existing.notes
        };
      } else {
        next.push({
          id: 'sch-' + Math.random().toString(36).substring(2, 9),
          date: manualDate,
          adminName: manualAdmin,
          duties: finalDuties,
          shiftTime,
          isBackupAcc: manualIsBackupAcc,
          notes: manualNotes || 'Jadwal kerja harian admin penjualan'
        });
      }

      return next;
    });

    setSelectedDateIso(manualDate);
    setIsManualModalOpen(false);
    setSaveToast(`Jadwal manual untuk ${manualAdmin} pada ${formatReadableDateId(manualDate)} berhasil ditambahkan!`);
    setTimeout(() => setSaveToast(null), 3000);
  };

  const handleSaveAll = () => {
    localStorage.setItem('akk_admin_calendar_schedules_v1', JSON.stringify(schedules));
    setSaveToast('Seluruh perubahan jadwal kalender dan Back Up ACC berhasil disimpan!');
    setTimeout(() => setSaveToast(null), 2500);
  };

  const handleConfirmReset = () => {
    const initial = createInitialSchedules(salesAdminNames);
    setSchedules(initial);
    localStorage.setItem('akk_admin_calendar_schedules_v1', JSON.stringify(initial));
    setConfirmReset(false);
    setSaveToast('Jadwal berhasil direset ke konfigurasi awal.');
    setTimeout(() => setSaveToast(null), 2500);
  };

  const handleExportExcel = () => {
    const csvRows: string[] = [];
    csvRows.push(`JADWAL KALENDER & PENUGASAN ADMIN PENJUALAN - PERIODE ${selectedMonth.toUpperCase()} ${selectedYear}`);
    csvRows.push(['NO', 'TANGGAL', 'HARI', 'NAMA ADMIN', 'JAM KERJA', 'BACK UP ACC', 'JOBDESK / TUGAS', 'CATATAN'].join(','));

    filteredMonthSchedules
      .slice()
      .sort((a, b) => a.date.localeCompare(b.date))
      .forEach((item, idx) => {
        const row = [
          idx + 1,
          item.date,
          getDayNameFromIso(item.date),
          `"${item.adminName}"`,
          `"${item.shiftTime}"`,
          item.isBackupAcc ? 'YA (BACK UP ACC)' : 'TIDAK',
          `"${item.duties.join('; ')}"`,
          `"${(item.notes || '').replace(/"/g, '""')}"`
        ];
        csvRows.push(row.join(','));
      });

    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `jadwal_kalender_admin_${selectedMonth}_${selectedYear}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Calendar Grid Computation
  const daysInMonth = getDaysInMonth(yearNum, monthIndex);
  const firstDayOfWeek = getFirstDayOfMonth(yearNum, monthIndex);

  const calendarCells = useMemo(() => {
    const cells: Array<{ day: number | null; isoDate: string | null }> = [];
    for (let i = 0; i < firstDayOfWeek; i++) {
      cells.push({ day: null, isoDate: null });
    }
    for (let day = 1; day <= daysInMonth; day++) {
      cells.push({
        day,
        isoDate: formatDateIso(yearNum, monthIndex, day)
      });
    }
    return cells;
  }, [firstDayOfWeek, daysInMonth, yearNum, monthIndex]);

  return (
    <div className="space-y-6">
      {/* Unified Header Filter */}
      <SalesHeaderFilter
        title="Jadwal Kalender & Penugasan Admin Penjualan"
        subtitle="Kelola jadwal kerja bulanan, penugasan jobdesk harian, dan Back Up ACC dengan tampilan kalender interaktif."
        activeTab="jadwal_admin"
        onTabChange={handleTopTabChange}
        selectedAdmin={selectedAdmin}
        onAdminChange={setSelectedAdmin}
        selectedMonth={selectedMonth}
        onMonthChange={setSelectedMonth}
        selectedYear={selectedYear}
        onYearChange={setSelectedYear}
        jadwalInputCount={filteredMonthSchedules.length}
        pencapaianPercent={100}
        periodeLabel={`${selectedMonth.slice(0, 3)} ${selectedYear}`}
        adminOptions={adminOptions}
      />

      {/* TOP SECTION: INTERACTIVE MONTHLY CALENDAR (Like Jadwal & Penugasan Armada) */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs space-y-5">
        {/* Calendar Header & Action Buttons */}
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 pb-4 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                Kalender Penugasan Admin &amp; Back Up ACC ({selectedMonth} {selectedYear})
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Klik tanggal pada kalender untuk melihat rincian jadwal di bagian bawah atau tambahkan jadwal manual.
              </p>
            </div>
          </div>

          {/* Action Toolbar */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => openManualModalForDate(selectedDateIso)}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold shadow-xs transition cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Buat Jadwal Manual</span>
            </button>

            <button
              onClick={handleSaveAll}
              className="flex items-center gap-1.5 px-3 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-semibold shadow-xs transition cursor-pointer"
            >
              <Save className="w-3.5 h-3.5" />
              <span>Simpan</span>
            </button>

            {confirmReset ? (
              <div className="flex items-center gap-1 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 px-2.5 py-1 rounded-xl">
                <span className="text-[11px] font-semibold text-rose-700 dark:text-rose-300">Yakin reset?</span>
                <button
                  onClick={handleConfirmReset}
                  className="px-2 py-0.5 bg-rose-600 text-white rounded text-[10px] font-bold cursor-pointer"
                >
                  Ya
                </button>
                <button
                  onClick={() => setConfirmReset(false)}
                  className="px-2 py-0.5 text-slate-600 dark:text-slate-300 text-[10px] font-semibold cursor-pointer"
                >
                  Batal
                </button>
              </div>
            ) : (
              <button
                onClick={() => setConfirmReset(true)}
                className="flex items-center gap-1 px-3 py-2 border border-rose-200 dark:border-rose-800/70 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-xl text-xs font-semibold transition cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reset</span>
              </button>
            )}

            <button
              onClick={() => window.print()}
              className="flex items-center gap-1 px-3 py-2 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-xl text-xs font-semibold transition cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Cetak</span>
            </button>

            <button
              onClick={handleExportExcel}
              className="flex items-center gap-1 px-3 py-2 bg-slate-800 dark:bg-slate-700 hover:bg-slate-700 text-white rounded-xl text-xs font-semibold shadow-xs transition cursor-pointer"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span>Excel</span>
            </button>
          </div>
        </div>

        {/* Save Toast */}
        {saveToast && (
          <div className="bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 text-emerald-800 dark:text-emerald-300 text-xs px-4 py-2.5 rounded-xl flex items-center justify-between">
            <div className="flex items-center gap-2 font-semibold">
              <Check className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{saveToast}</span>
            </div>
            <button onClick={() => setSaveToast(null)} className="text-emerald-600 hover:text-emerald-800">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* 7-Column Calendar Grid (Modeled after Jadwal & Penugasan Armada) */}
        <div>
          <div className="grid grid-cols-7 gap-2 mb-2">
            {['MINGGU', 'SENIN', 'SELASA', 'RABU', 'KAMIS', 'JUMAT', 'SABTU'].map((dayLabel, idx) => (
              <div
                key={dayLabel}
                className={`text-center text-[11px] font-extrabold uppercase tracking-wider py-2 rounded-lg ${
                  idx === 0
                    ? 'text-rose-600 dark:text-rose-400 bg-rose-50/60 dark:bg-rose-950/20'
                    : 'text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-800/60'
                }`}
              >
                {dayLabel}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-2">
            {calendarCells.map((cell, index) => {
              if (!cell.day || !cell.isoDate) {
                return (
                  <div
                    key={`empty-${index}`}
                    className="min-h-24 rounded-xl bg-slate-50/40 dark:bg-slate-900/30 border border-dashed border-slate-200/60 dark:border-slate-800/50"
                  />
                );
              }

              const daySchedules = schedulesByDate[cell.isoDate] || [];
              const isSelected = selectedDateIso === cell.isoDate;
              const backupItem = daySchedules.find(s => s.isBackupAcc);
              const isSunday = index % 7 === 0;

              return (
                <div
                  key={cell.isoDate}
                  onClick={() => setSelectedDateIso(cell.isoDate!)}
                  className={`min-h-24 p-2.5 rounded-xl border transition-all cursor-pointer flex flex-col justify-between ${
                    isSelected
                      ? 'bg-indigo-50/70 dark:bg-indigo-950/40 border-indigo-600 dark:border-indigo-500 ring-2 ring-indigo-500/20 shadow-xs'
                      : daySchedules.length > 0
                      ? 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-indigo-300 dark:hover:border-indigo-700'
                      : 'bg-slate-50/50 dark:bg-slate-950/40 border-slate-200/70 dark:border-slate-800/70 hover:border-slate-300'
                  }`}
                >
                  {/* Top row: Date number + count badge */}
                  <div className="flex items-center justify-between gap-1">
                    <span
                      className={`text-xs font-extrabold font-mono tabular-nums w-6 h-6 rounded-lg flex items-center justify-center ${
                        isSelected
                          ? 'bg-indigo-600 text-white'
                          : isSunday
                          ? 'text-rose-600 dark:text-rose-400'
                          : 'text-slate-800 dark:text-slate-200'
                      }`}
                    >
                      {cell.day}
                    </span>

                    {daySchedules.length > 0 && (
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 font-mono tabular-nums">
                        {daySchedules.length} Admin
                      </span>
                    )}
                  </div>

                  {/* Middle preview: Assigned admins & Back Up ACC */}
                  <div className="mt-1.5 space-y-1 overflow-hidden">
                    {backupItem && (
                      <div className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-100/90 dark:bg-amber-950/60 text-amber-900 dark:text-amber-300 truncate">
                        ACC: {backupItem.adminName}
                      </div>
                    )}
                    {daySchedules.slice(0, 2).map(s => (
                      <div
                        key={s.id}
                        className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 truncate"
                      >
                        <strong className="text-indigo-700 dark:text-indigo-300">{s.adminName}:</strong>{' '}
                        {s.duties[0] || 'Tugas'}
                      </div>
                    ))}
                    {daySchedules.length > 2 && (
                      <div className="text-[10px] font-semibold text-indigo-600 dark:text-indigo-400 pl-1">
                        +{daySchedules.length - 2} jadwal lainnya
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* BOTTOM SECTION: RINCIAN JADWAL & PENUGASAN ADMIN PADA TANGGAL TERPILIH */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-xs">
        {/* Rincian Header Banner */}
        <div className="bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-800 px-5 py-4 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-indigo-600 text-white flex items-center justify-center shrink-0">
              <ClipboardList className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white">
                  Rincian Jadwal &amp; Tugas Admin — {formatReadableDateId(selectedDateIso)}
                </h3>
                <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-md bg-indigo-100 dark:bg-indigo-950/60 text-indigo-800 dark:text-indigo-300 font-mono tabular-nums">
                  {selectedDateSchedules.length} Penugasan
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Daftar rincian admin penjualan yang bertugas beserta jobdesk harian dan status Back Up ACC pada tanggal terpilih.
              </p>
            </div>
          </div>

          {/* Right Controls: Back Up ACC Selector for Selected Date + Add Manual Button */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">
                Back Up ACC:
              </span>
              <select
                value={backupAccOnSelectedDate}
                onChange={e => handleSetBackupAccForDate(selectedDateIso, e.target.value)}
                className="text-xs font-bold text-indigo-700 dark:text-indigo-300 bg-transparent focus:outline-hidden cursor-pointer"
              >
                <option value="">-- Pilih Admin ACC --</option>
                {salesAdminNames.map(name => (
                  <option key={name} value={name} className="text-slate-900 bg-white">
                    {name}
                  </option>
                ))}
              </select>
            </div>

            <button
              onClick={() => openManualModalForDate(selectedDateIso)}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold shadow-xs transition cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Tambah Jadwal di Tanggal Ini</span>
            </button>
          </div>
        </div>

        {/* Rincian Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead>
              <tr className="bg-slate-50/70 dark:bg-slate-900/60 border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 uppercase text-[10px] tracking-wider font-extrabold">
                <th className="py-3 px-4 w-12 text-center">NO</th>
                <th className="py-3 px-4">NAMA ADMIN (ADM. PENJUALAN)</th>
                <th className="py-3 px-4">RINCIAN TUGAS / JOBDESK HARIAN</th>
                <th className="py-3 px-4">JAM KERJA / SHIFT</th>
                <th className="py-3 px-4">STATUS BACK UP ACC</th>
                <th className="py-3 px-4">CATATAN</th>
                <th className="py-3 px-4 text-center w-20">AKSI</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {selectedDateSchedules.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-10 px-4 text-center">
                    <div className="max-w-sm mx-auto space-y-2">
                      <p className="text-xs font-bold text-slate-700 dark:text-slate-300">
                        Belum ada jadwal admin pada tanggal {formatReadableDateId(selectedDateIso)}.
                      </p>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">
                        Klik tombol <strong>Buat Jadwal Manual</strong> untuk menambahkan penugasan admin penjualan pada tanggal ini.
                      </p>
                      <button
                        onClick={() => openManualModalForDate(selectedDateIso)}
                        className="mt-2 inline-flex items-center gap-1.5 px-3.5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Buat Jadwal Manual</span>
                      </button>
                    </div>
                  </td>
                </tr>
              ) : (
                selectedDateSchedules.map((item, idx) => (
                  <tr key={item.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition align-top">
                    <td className="py-3.5 px-4 text-center font-bold text-slate-500 font-mono tabular-nums">
                      {idx + 1}
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-lg bg-indigo-100 dark:bg-indigo-950/70 text-indigo-700 dark:text-indigo-300 font-extrabold text-xs flex items-center justify-center shrink-0">
                          {item.adminName.slice(0, 2)}
                        </div>
                        <div>
                          <span className="font-extrabold text-slate-900 dark:text-white block">
                            {item.adminName}
                          </span>
                          <span className="text-[10px] text-slate-500 dark:text-slate-400">
                            Role: Adm. Penjualan
                          </span>
                        </div>
                      </div>
                    </td>
                    <td className="py-3.5 px-4 min-w-64">
                      <div className="flex flex-wrap gap-1.5 mb-2">
                        {item.duties.map(duty => (
                          <span
                            key={duty}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-semibold bg-indigo-50 dark:bg-indigo-950/50 text-indigo-800 dark:text-indigo-300 border border-indigo-200/70 dark:border-indigo-800/60"
                          >
                            <span>{duty}</span>
                            <button
                              type="button"
                              onClick={() => handleRemoveDutyFromSchedule(item.id, duty)}
                              className="text-indigo-400 hover:text-rose-600 transition cursor-pointer"
                            >
                              &times;
                            </button>
                          </span>
                        ))}
                      </div>
                      <div className="relative max-w-xs">
                        <select
                          defaultValue=""
                          onChange={e => {
                            handleAddDutyToSchedule(item.id, e.target.value);
                            e.target.value = '';
                          }}
                          className="w-full py-1 pl-2.5 pr-6 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-[11px] font-medium text-slate-700 dark:text-slate-300 cursor-pointer"
                        >
                          <option value="">+ Tambah Tugas Jobdesk...</option>
                          {DUTY_OPTIONS.map(opt => (
                            <option key={opt} value={opt}>
                              {opt}
                            </option>
                          ))}
                        </select>
                      </div>
                    </td>
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <span className="inline-flex items-center gap-1.5 font-mono tabular-nums text-slate-700 dark:text-slate-300 font-semibold bg-slate-100 dark:bg-slate-800 px-2.5 py-1 rounded-md">
                        <Clock className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                        {item.shiftTime}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      {item.isBackupAcc ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-bold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60">
                          <UserCheck className="w-3.5 h-3.5" />
                          <span>Back Up ACC Aktif</span>
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleSetBackupAccForDate(item.date, item.adminName)}
                          className="text-[11px] font-semibold text-slate-500 hover:text-indigo-600 dark:text-slate-400 dark:hover:text-indigo-400 underline cursor-pointer"
                        >
                          Jadikan Back Up ACC
                        </button>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-slate-600 dark:text-slate-400 max-w-xs">
                      {item.notes || '-'}
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <button
                        type="button"
                        onClick={() => handleDeleteScheduleItem(item.id)}
                        title="Hapus Jadwal Ini"
                        className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL BUAT JADWAL MANUAL */}
      {isManualModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-lg w-full p-6 shadow-xl border border-slate-200 dark:border-slate-800 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800 mb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
                  <Calendar className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    Buat Jadwal Manual Admin Penjualan
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Tambahkan penugasan harian admin ke dalam kalender operasional
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsManualModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveManualSchedule} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1">
                    Tanggal Jadwal *
                  </label>
                  <input
                    type="date"
                    required
                    value={manualDate}
                    onChange={e => setManualDate(e.target.value)}
                    className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-white font-semibold font-mono tabular-nums"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1">
                    Pilih Admin (Adm. Penjualan) *
                  </label>
                  <select
                    value={manualAdmin}
                    onChange={e => setManualAdmin(e.target.value)}
                    className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-white font-bold"
                  >
                    {salesAdminNames.map(name => (
                      <option key={name} value={name}>
                        {name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Shift / Jam Kerja */}
              <div className="grid grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1">
                    Jam Mulai Kerja
                  </label>
                  <input
                    type="time"
                    value={manualStartTime}
                    onChange={e => setManualStartTime(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-white font-mono tabular-nums"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1">
                    Jam Selesai Kerja
                  </label>
                  <input
                    type="time"
                    value={manualEndTime}
                    onChange={e => setManualEndTime(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-white font-mono tabular-nums"
                  />
                </div>
              </div>

              {/* Pilih Tugas / Jobdesk */}
              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1.5">
                  Pilih Rincian Tugas / Jobdesk ({manualDuties.length} dipilih)
                </label>
                <div className="flex flex-wrap gap-1.5 p-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl max-h-40 overflow-y-auto">
                  {DUTY_OPTIONS.map(duty => {
                    const active = manualDuties.includes(duty);
                    return (
                      <button
                        key={duty}
                        type="button"
                        onClick={() => handleToggleManualDuty(duty)}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition cursor-pointer ${
                          active
                            ? 'bg-indigo-600 text-white shadow-2xs'
                            : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-800 hover:border-indigo-400'
                        }`}
                      >
                        {active ? `✓ ${duty}` : `+ ${duty}`}
                      </button>
                    );
                  })}
                </div>

                {/* Custom Jobdesk Input */}
                <div className="flex items-center gap-2 mt-2">
                  <input
                    type="text"
                    placeholder="Tambah tugas manual lainnya..."
                    value={customDutyInput}
                    onChange={e => setCustomDutyInput(e.target.value)}
                    className="flex-1 px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-white"
                  />
                  <button
                    type="button"
                    onClick={handleAddCustomDuty}
                    className="px-3 py-2 bg-slate-800 dark:bg-slate-700 text-white rounded-xl font-semibold hover:bg-slate-700 cursor-pointer"
                  >
                    Tambah Tugas
                  </button>
                </div>
              </div>

              {/* Toggle Back Up ACC */}
              <label className="flex items-center gap-2.5 p-3 rounded-xl bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/60 cursor-pointer">
                <input
                  type="checkbox"
                  checked={manualIsBackupAcc}
                  onChange={e => setManualIsBackupAcc(e.target.checked)}
                  className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 accent-emerald-600"
                />
                <div>
                  <span className="font-bold text-emerald-900 dark:text-emerald-200 block">
                    Tetapkan sebagai Admin Back Up ACC pada tanggal ini
                  </span>
                  <span className="text-[11px] text-emerald-700 dark:text-emerald-400">
                    Admin ini akan ditandai sebagai penanggung jawab Back Up ACC di kalender.
                  </span>
                </div>
              </label>

              {/* Catatan */}
              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1">
                  Catatan Penugasan
                </label>
                <input
                  type="text"
                  placeholder="Catatan tambahan shift atau fokus area..."
                  value={manualNotes}
                  onChange={e => setManualNotes(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-white"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsManualModalOpen(false)}
                  className="px-4 py-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl font-semibold cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold shadow-xs cursor-pointer"
                >
                  Simpan Jadwal Manual
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
