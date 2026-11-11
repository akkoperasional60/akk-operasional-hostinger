import React, { useState, useEffect, useMemo } from 'react';
import {
  Calendar,
  Plus,
  ChevronDown,
  Check,
  UserCheck,
  ShieldCheck,
  X,
  ClipboardList,
  MapPin,
  Briefcase,
  Building2,
  Search,
  UserX,
  AlertCircle
} from 'lucide-react';
import {
  SalesHeaderFilter,
  SalesTopTab,
  MONTH_OPTIONS,
  useSalesAdminUsers
} from './SalesHeaderFilter';
import { OFFICIAL_DESTINATION_AREAS, standardizeAreaName } from '../../utils/areaNormalizer';
import { branchStore } from '../../services/branchStore';
import { logisticsStore } from '../../services/store';

interface AdminSchedulesTabProps {
  onNavigateSubTab?: (sub: 'dashboard' | 'activities' | 'schedules' | 'loading_duration' | 'skill_matrix' | 'jobdesk') => void;
  adminOptions: string[];
}

export type AdminAttendanceStatus = 'hadir' | 'ijin' | 'sakit';

export interface AdminDailyScheduleItem {
  id: string;
  date: string; // YYYY-MM-DD
  adminName: string;
  branchId?: string; // 'cab-banyuwangi' (Nusantara) | 'cab-sidoarjo' (Sidoarjo)
  duties: string[];
  additionalDuties?: string[];
  shiftTime: string;
  isBackupAcc: boolean;
  notes: string;
  attendanceStatus?: AdminAttendanceStatus;
  absenceReason?: string;
}

// Jobdesk Tambahan sesuai permintaan
export const ADDITIONAL_JOBDESK_OPTIONS = [
  'Ekspor Argo',
  'Ekspor Transaksi',
  'HP Telkomsel',
  'HP XL',
  'NX',
  'Retur',
  'BT'
];

const LS_ADMIN_BRANCH_MAP_KEY = 'akk_sales_admin_branch_map_v1';

function loadAdminBranchMap(): Record<string, string> {
  try {
    const raw = localStorage.getItem(LS_ADMIN_BRANCH_MAP_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') return parsed;
    }
  } catch {}
  return {};
}

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
      branchId: 'cab-banyuwangi',
      duties: ['Muncar Pasar', 'Muncar Pinggir', 'HP Telkomsel'],
      additionalDuties: ['HP Telkomsel', 'Ekspor Transaksi'],
      shiftTime: '08:00 - 16:00',
      isBackupAcc: true,
      notes: 'Fokus validasi faktur area Muncar & Ekspor Transaksi',
      attendanceStatus: 'hadir'
    },
    {
      id: 'sch-2',
      date: '2026-08-10',
      adminName: a1,
      branchId: 'cab-banyuwangi',
      duties: ['Rogojampi Retail', 'Genteng Retail', 'Retur'],
      additionalDuties: ['Retur'],
      shiftTime: '08:00 - 16:00',
      isBackupAcc: false,
      notes: 'Koordinasi surat jalan area Rogojampi & Genteng',
      attendanceStatus: 'hadir'
    },
    {
      id: 'sch-3',
      date: '2026-08-11',
      adminName: a1,
      branchId: 'cab-banyuwangi',
      duties: ['Denpasar 1', 'Singaraja', 'Ekspor Argo'],
      additionalDuties: ['Ekspor Argo'],
      shiftTime: '08:00 - 16:00',
      isBackupAcc: true,
      notes: 'Rekapitulasi PO masuk area Bali',
      attendanceStatus: 'hadir'
    },
    {
      id: 'sch-4',
      date: '2026-08-12',
      adminName: a2,
      branchId: 'cab-banyuwangi',
      duties: ['Jember Kota', 'Situbondo', 'BT'],
      additionalDuties: ['BT'],
      shiftTime: '08:00 - 16:00',
      isBackupAcc: true,
      notes: 'Monitoring pemberangkatan armada pagi',
      attendanceStatus: 'hadir'
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

  // Admin -> Branch mapping ('cab-banyuwangi' = Nusantara, 'cab-sidoarjo' = Sidoarjo)
  const [adminBranchMap, setAdminBranchMap] = useState<Record<string, string>>(() => loadAdminBranchMap());

  const getAdminBranchId = (adminName: string): string => {
    const key = (adminName || '').trim().toUpperCase();
    if (adminBranchMap[key]) return adminBranchMap[key];
    const matchedUser = salesAdminUsers.find(
      u => (u.fullName || '').trim().toUpperCase() === key
    );
    if (matchedUser) {
      const fromCrewStore = branchStore.getCrewBranchId(matchedUser.id, matchedUser.fullName);
      if (fromCrewStore) return fromCrewStore;
    }
    return 'cab-banyuwangi';
  };

  const setAdminBranchId = (adminName: string, branchId: string) => {
    const key = (adminName || '').trim().toUpperCase();
    setAdminBranchMap(prev => {
      const next = { ...prev, [key]: branchId };
      try {
        localStorage.setItem(LS_ADMIN_BRANCH_MAP_KEY, JSON.stringify(next));
      } catch {}
      return next;
    });
    const matchedUser = salesAdminUsers.find(
      u => (u.fullName || '').trim().toUpperCase() === key
    );
    if (matchedUser) {
      branchStore.setCrewBranchId(matchedUser.id, branchId, matchedUser.fullName);
    }
  };

  const [selectedBranchId, setSelectedBranchId] = useState<string>(() =>
    branchStore.getSelectedOriginBranchId()
  );

  useEffect(() => {
    const unsub = branchStore.subscribe(() => {
      setSelectedBranchId(branchStore.getSelectedOriginBranchId());
    });
    return unsub;
  }, []);

  const handleBranchFilterChange = (branchId: string) => {
    setSelectedBranchId(branchId);
    branchStore.setActiveBranchId(branchId);
  };

  // Synchronized Nama Area Kirim from Driver/Helper Jadwal & Penugasan
  const synchronizedDeliveryAreas = useMemo(() => {
    const areaSet = new Set<string>(OFFICIAL_DESTINATION_AREAS);
    const liveSchedules = logisticsStore.getSchedules();
    liveSchedules.forEach(s => {
      const raw = s.areaName || s.store?.city || '';
      if (raw) {
        const std = standardizeAreaName(raw);
        if (std && std !== '-') areaSet.add(std);
      }
    });
    return Array.from(areaSet);
  }, []);

  const [selectedAdmin, setSelectedAdmin] = useState('SEMUA ADMIN');
  const [selectedMonth, setSelectedMonth] = useState('Agustus');
  const [selectedYear, setSelectedYear] = useState('2026');
  const [saveToast, setSaveToast] = useState<string | null>(null);

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
  const [manualBranchId, setManualBranchId] = useState<string>('cab-banyuwangi');
  const [manualAdmin, setManualAdmin] = useState(() => salesAdminNames[0] || '');
  const [isManualAdminDropdownOpen, setIsManualAdminDropdownOpen] = useState(false);
  const [manualAttendanceStatus, setManualAttendanceStatus] = useState<AdminAttendanceStatus>('hadir');
  const [manualAbsenceReason, setManualAbsenceReason] = useState('');
  const [manualAreaDuties, setManualAreaDuties] = useState<string[]>(['Muncar Pasar']);
  const [manualAdditionalDuties, setManualAdditionalDuties] = useState<string[]>(['HP Telkomsel']);
  const [areaSearchQuery, setAreaSearchQuery] = useState('');
  const [customDutyInput, setCustomDutyInput] = useState('');
  const [manualIsBackupAcc, setManualIsBackupAcc] = useState(false);

  // Custom dropdown state in table rows
  const [openRowAddMenuId, setOpenRowAddMenuId] = useState<string | null>(null);

  // Admins available inside the Manual Modal filtered by manualBranchId
  const modalBranchAdmins = useMemo(() => {
    return salesAdminNames.filter(name => getAdminBranchId(name) === manualBranchId);
  }, [salesAdminNames, manualBranchId, adminBranchMap]);

  useEffect(() => {
    if (modalBranchAdmins.length > 0 && !modalBranchAdmins.includes(manualAdmin)) {
      setManualAdmin(modalBranchAdmins[0]);
    } else if (modalBranchAdmins.length === 0 && salesAdminNames.length > 0 && !manualAdmin) {
      setManualAdmin(salesAdminNames[0]);
    }
  }, [modalBranchAdmins, salesAdminNames, manualAdmin]);

  const filteredAreaOptionsForModal = useMemo(() => {
    return synchronizedDeliveryAreas.filter(area => {
      if (areaSearchQuery.trim()) {
        return area.toLowerCase().includes(areaSearchQuery.trim().toLowerCase());
      }
      return true;
    });
  }, [synchronizedDeliveryAreas, areaSearchQuery]);

  const openManualModalForDate = (dateIso?: string) => {
    const effBranch = selectedBranchId !== 'ALL' ? selectedBranchId : 'cab-banyuwangi';
    setManualDate(dateIso || selectedDateIso);
    setManualBranchId(effBranch);
    const branchAdmins = salesAdminNames.filter(n => getAdminBranchId(n) === effBranch);
    setManualAdmin(
      selectedAdmin !== 'SEMUA ADMIN'
        ? selectedAdmin
        : branchAdmins[0] || salesAdminNames[0] || 'ADMIN PENJUALAN'
    );
    setIsManualAdminDropdownOpen(false);
    setManualAttendanceStatus('hadir');
    setManualAbsenceReason('');
    setManualAreaDuties(['Muncar Pasar']);
    setManualAdditionalDuties(['HP Telkomsel']);
    setAreaSearchQuery('');
    setCustomDutyInput('');
    setManualIsBackupAcc(false);
    setIsManualModalOpen(true);
  };

  const handleTopTabChange = (tab: SalesTopTab) => {
    if (tab === 'checklist' || tab === 'aktivitas_view') {
      onNavigateSubTab?.('activities');
    } else if (tab === 'durasi_muat') {
      onNavigateSubTab?.('loading_duration');
    }
  };

  // Filtered schedules for the selected month/year, selectedAdmin, and selectedBranchId
  const monthPrefix = `${yearNum}-${String(monthIndex + 1).padStart(2, '0')}`;

  const getScheduleEffectiveBranchId = (item: AdminDailyScheduleItem): string => {
    if (item.branchId) return item.branchId;
    return getAdminBranchId(item.adminName);
  };

  const filteredMonthSchedules = useMemo(() => {
    return schedules.filter(item => {
      const matchMonth = item.date.startsWith(monthPrefix);
      const matchAdmin =
        selectedAdmin === 'SEMUA ADMIN' ||
        item.adminName.toUpperCase() === selectedAdmin.toUpperCase();
      const itemBranch = getScheduleEffectiveBranchId(item);
      const matchBranch = selectedBranchId === 'ALL' || itemBranch === selectedBranchId;
      return matchMonth && matchAdmin && matchBranch;
    });
  }, [schedules, monthPrefix, selectedAdmin, selectedBranchId, adminBranchMap]);

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
      const itemBranch = getScheduleEffectiveBranchId(item);
      const matchBranch = selectedBranchId === 'ALL' || itemBranch === selectedBranchId;
      return matchDate && matchAdmin && matchBranch;
    });
  }, [schedules, selectedDateIso, selectedAdmin, selectedBranchId, adminBranchMap]);

  const handleToggleBackupAccItem = (scheduleId: string) => {
    setSchedules(prev => {
      const target = prev.find(s => s.id === scheduleId);
      if (!target) return prev;
      const targetBranch = getScheduleEffectiveBranchId(target);
      const nextState = !target.isBackupAcc;

      return prev.map(s => {
        if (s.date !== target.date) return s;
        if (s.id === scheduleId) {
          return { ...s, isBackupAcc: nextState };
        }
        if (nextState && getScheduleEffectiveBranchId(s) === targetBranch) {
          return { ...s, isBackupAcc: false };
        }
        return s;
      });
    });
  };

  const handleUpdateRowAttendance = (scheduleId: string, nextStatus: AdminAttendanceStatus) => {
    setSchedules(prev =>
      prev.map(item => {
        if (item.id !== scheduleId) return item;
        return {
          ...item,
          attendanceStatus: nextStatus,
          isBackupAcc: nextStatus === 'hadir' ? item.isBackupAcc : false
        };
      })
    );
  };

  const handleAddDutyToSchedule = (scheduleId: string, duty: string) => {
    if (!duty) return;
    setSchedules(prev =>
      prev.map(item => {
        if (item.id !== scheduleId) return item;
        if (item.duties.includes(duty)) return item;
        const isAddJobdesk = ADDITIONAL_JOBDESK_OPTIONS.includes(duty);
        const nextAdd = isAddJobdesk
          ? Array.from(new Set([...(item.additionalDuties || []), duty]))
          : item.additionalDuties;
        return {
          ...item,
          attendanceStatus: 'hadir',
          duties: [...item.duties, duty],
          additionalDuties: nextAdd
        };
      })
    );
  };

  const handleRemoveDutyFromSchedule = (scheduleId: string, dutyToRemove: string) => {
    setSchedules(prev =>
      prev.map(item => {
        if (item.id !== scheduleId) return item;
        return {
          ...item,
          duties: item.duties.filter(d => d !== dutyToRemove),
          additionalDuties: (item.additionalDuties || []).filter(d => d !== dutyToRemove)
        };
      })
    );
  };

  const handleToggleManualAreaDuty = (areaName: string) => {
    setManualAreaDuties(prev =>
      prev.includes(areaName) ? prev.filter(d => d !== areaName) : [...prev, areaName]
    );
  };

  const handleToggleManualAdditionalDuty = (jobdesk: string) => {
    setManualAdditionalDuties(prev =>
      prev.includes(jobdesk) ? prev.filter(d => d !== jobdesk) : [...prev, jobdesk]
    );
  };

  const handleAddCustomDuty = () => {
    const trimmed = customDutyInput.trim();
    if (!trimmed) return;
    if (!manualAreaDuties.includes(trimmed) && !manualAdditionalDuties.includes(trimmed)) {
      setManualAdditionalDuties(prev => [...prev, trimmed]);
    }
    setCustomDutyInput('');
  };

  const handleSaveManualSchedule = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualAdmin || !manualDate) return;

    setAdminBranchId(manualAdmin, manualBranchId);

    const isAbsent = manualAttendanceStatus === 'ijin' || manualAttendanceStatus === 'sakit';
    const combinedDuties = isAbsent
      ? []
      : Array.from(new Set([...manualAreaDuties, ...manualAdditionalDuties]));
    const finalDuties = isAbsent
      ? []
      : combinedDuties.length > 0
      ? combinedDuties
      : ['Muncar Pasar'];

    setSchedules(prev => {
      let next = [...prev];
      if (!isAbsent && manualIsBackupAcc) {
        next = next.map(item =>
          item.date === manualDate && getScheduleEffectiveBranchId(item) === manualBranchId
            ? { ...item, isBackupAcc: false }
            : item
        );
      }

      const existingIdx = next.findIndex(
        item =>
          item.date === manualDate &&
          item.adminName.toUpperCase() === manualAdmin.toUpperCase()
      );

      if (existingIdx >= 0) {
        const existing = next[existingIdx];
        const mergedDuties = isAbsent
          ? []
          : Array.from(new Set([...existing.duties, ...finalDuties]));
        const mergedAdditional = isAbsent
          ? []
          : Array.from(new Set([...(existing.additionalDuties || []), ...manualAdditionalDuties]));
        next[existingIdx] = {
          ...existing,
          branchId: manualBranchId,
          duties: mergedDuties,
          additionalDuties: mergedAdditional,
          isBackupAcc: isAbsent ? false : manualIsBackupAcc || existing.isBackupAcc,
          attendanceStatus: manualAttendanceStatus,
          absenceReason: isAbsent ? manualAbsenceReason.trim() : undefined
        };
      } else {
        next.push({
          id: 'sch-' + Math.random().toString(36).substring(2, 9),
          date: manualDate,
          adminName: manualAdmin,
          branchId: manualBranchId,
          duties: finalDuties,
          additionalDuties: isAbsent ? [] : manualAdditionalDuties,
          shiftTime: '08:00 - 16:00',
          isBackupAcc: isAbsent ? false : manualIsBackupAcc,
          notes: '',
          attendanceStatus: manualAttendanceStatus,
          absenceReason: isAbsent ? manualAbsenceReason.trim() : undefined
        });
      }

      return next;
    });

    setSelectedDateIso(manualDate);
    setIsManualModalOpen(false);
    const statusLabel =
      manualAttendanceStatus === 'ijin'
        ? 'Status Ijin'
        : manualAttendanceStatus === 'sakit'
        ? 'Status Sakit'
        : 'Jadwal Kerja';
    setSaveToast(
      `${statusLabel} untuk ${manualAdmin} pada ${formatReadableDateId(manualDate)} berhasil disimpan!`
    );
    setTimeout(() => setSaveToast(null), 3000);
  };

  const handleExportExcel = () => {
    const csvRows: string[] = [];
    csvRows.push(`JADWAL & PENUGASAN ADMIN PENJUALAN - PERIODE ${selectedMonth.toUpperCase()} ${selectedYear}`);
    csvRows.push(['NO', 'TANGGAL', 'HARI', 'NAMA ADMIN', 'CABANG', 'STATUS KEHADIRAN', 'STATUS BACK UP ACC', 'RINCIAN JADWAL (AREA KIRIM) & JOBDESK TAMBAHAN'].join(','));

    filteredMonthSchedules
      .slice()
      .sort((a, b) => a.date.localeCompare(b.date))
      .forEach((item, idx) => {
        const brId = getScheduleEffectiveBranchId(item);
        const brName = brId === 'cab-sidoarjo' ? 'Sidoarjo' : 'Nusantara';
        const attStatus =
          item.attendanceStatus === 'ijin'
            ? `IJIN${item.absenceReason ? ` (${item.absenceReason})` : ''}`
            : item.attendanceStatus === 'sakit'
            ? `SAKIT${item.absenceReason ? ` (${item.absenceReason})` : ''}`
            : 'HADIR';
        const row = [
          idx + 1,
          item.date,
          getDayNameFromIso(item.date),
          `"${item.adminName}"`,
          `"${brName}"`,
          `"${attStatus}"`,
          item.isBackupAcc ? 'YA (BACK UP ACC)' : 'TIDAK',
          `"${item.duties.join('; ')}"`
        ];
        csvRows.push(row.join(','));
      });

    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `jadwal_penugasan_admin_penjualan_${selectedMonth}_${selectedYear}.csv`);
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
      {/* Unified Header Filter: Judul "Jadwal & Penugasan Admin Penjualan" + Fitur Cabang + Ekspor to Excel */}
      <SalesHeaderFilter
        title="Jadwal & Penugasan Admin Penjualan"
        subtitle="Kelola jadwal kerja bulanan, rincian jadwal area kirim, jobdesk tambahan harian, dan pemilahan Admin Cabang Nusantara & Sidoarjo."
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
        hideAdminFilter={true}
        hideStatsCards={true}
        showBranchFilter={true}
        selectedBranchId={selectedBranchId}
        onBranchChange={handleBranchFilterChange}
        onExportExcel={handleExportExcel}
      />

      {/* TOP SECTION: INTERACTIVE MONTHLY CALENDAR */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs space-y-5">
        {/* Calendar Header & Action Button */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base font-bold text-slate-900 dark:text-white">
                  Kalender Jadwal &amp; Penugasan Admin Penjualan ({selectedMonth} {selectedYear})
                </h2>
                <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                  ·{' '}
                  {selectedBranchId === 'cab-banyuwangi'
                    ? 'Cabang Nusantara'
                    : selectedBranchId === 'cab-sidoarjo'
                    ? 'Cabang Sidoarjo'
                    : 'Semua Cabang'}
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Klik tanggal pada kalender untuk melihat rincian jadwal area kirim &amp; jobdesk tambahan di bagian bawah.
              </p>
            </div>
          </div>

          {/* Action Toolbar: Buat Jadwal Manual */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => openManualModalForDate(selectedDateIso)}
              className="flex items-center gap-1.5 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold shadow-xs transition cursor-pointer whitespace-nowrap"
            >
              <Plus className="w-4 h-4" />
              <span>Buat Jadwal Manual</span>
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

        {/* 7-Column Calendar Grid */}
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
              const backupItem = daySchedules.find(s => s.isBackupAcc && s.attendanceStatus !== 'ijin' && s.attendanceStatus !== 'sakit');
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
                  {/* Top row: Date number + count */}
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

                  {/* Middle preview: Assigned admins & Back Up ACC / Ijin / Sakit */}
                  <div className="mt-1.5 space-y-1 overflow-hidden">
                    {backupItem && (
                      <div className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-100/90 dark:bg-emerald-950/60 text-emerald-900 dark:text-emerald-300 truncate">
                        Back Up ACC: {backupItem.adminName}
                      </div>
                    )}
                    {daySchedules.slice(0, 2).map(s => {
                      const isIjin = s.attendanceStatus === 'ijin';
                      const isSakit = s.attendanceStatus === 'sakit';
                      return (
                        <div
                          key={s.id}
                          className={`text-[10px] font-medium px-1.5 py-0.5 rounded truncate ${
                            isIjin
                              ? 'bg-amber-100/80 dark:bg-amber-950/50 text-amber-900 dark:text-amber-300'
                              : isSakit
                              ? 'bg-rose-100/80 dark:bg-rose-950/50 text-rose-900 dark:text-rose-300'
                              : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                          }`}
                        >
                          <strong className={isIjin ? 'text-amber-800 dark:text-amber-200' : isSakit ? 'text-rose-800 dark:text-rose-200' : 'text-indigo-700 dark:text-indigo-300'}>
                            {s.adminName}:
                          </strong>{' '}
                          {isIjin ? 'Ijin' : isSakit ? 'Sakit' : s.duties[0] || 'Tugas'}
                        </div>
                      );
                    })}
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
        {/* Rincian Header Banner (Clean without Back Up ACC dropdown & Tambah Jadwal button - Item 7) */}
        <div className="bg-slate-50/80 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 px-5 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-indigo-600 text-white flex items-center justify-center shrink-0">
              <ClipboardList className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white">
                  Rincian Jadwal &amp; Penugasan Admin — {formatReadableDateId(selectedDateIso)}
                </h3>
                <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400 font-mono tabular-nums">
                  · {selectedDateSchedules.length} Penugasan
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Daftar rincian admin penjualan beserta rincian jadwal (area kirim), jobdesk tambahan, status Back Up ACC, dan kehadiran pada tanggal terpilih.
              </p>
            </div>
          </div>
        </div>

        {/* Rincian Table (Refined UI/UX: NO | NAMA ADMIN | RINCIAN JADWAL (AREA KIRIM), JOBDESK TAMBAHAN & STATUS BACK UP) */}
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead>
              <tr className="bg-slate-50/70 dark:bg-slate-900/60 border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 uppercase text-[10px] tracking-wider font-extrabold">
                <th className="py-3.5 px-5 w-14 text-center">NO</th>
                <th className="py-3.5 px-5 w-64">NAMA ADMIN</th>
                <th className="py-3.5 px-5">RINCIAN JADWAL (AREA KIRIM) &amp; JOBDESK TAMBAHAN</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {selectedDateSchedules.length === 0 ? (
                <tr>
                  <td colSpan={3} className="py-10 px-5 text-center">
                    <div className="max-w-sm mx-auto space-y-2">
                      <p className="text-xs font-bold text-slate-700 dark:text-slate-300">
                        Belum ada jadwal admin pada tanggal {formatReadableDateId(selectedDateIso)}
                        {selectedBranchId !== 'ALL'
                          ? ` untuk Cabang ${selectedBranchId === 'cab-sidoarjo' ? 'Sidoarjo' : 'Nusantara'}`
                          : ''}.
                      </p>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">
                        Gunakan tombol <strong>Buat Jadwal Manual</strong> di bagian atas kalender untuk menambahkan penugasan admin penjualan.
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                selectedDateSchedules.map((item, idx) => {
                  const attStatus: AdminAttendanceStatus = item.attendanceStatus || 'hadir';
                  const isIjin = attStatus === 'ijin';
                  const isSakit = attStatus === 'sakit';
                  const isAbsent = isIjin || isSakit;

                  const areaDutiesList = item.duties.filter(
                    d => !ADDITIONAL_JOBDESK_OPTIONS.includes(d) && d !== 'Back Up ACC'
                  );
                  const jobdeskDutiesList = Array.from(
                    new Set([
                      ...item.duties.filter(d => ADDITIONAL_JOBDESK_OPTIONS.includes(d)),
                      ...(item.additionalDuties || [])
                    ])
                  );

                  return (
                    <tr key={item.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/30 transition align-top">
                      <td className="py-4 px-5 text-center font-bold text-slate-500 font-mono tabular-nums">
                        {idx + 1}
                      </td>

                      {/* Kolom NAMA ADMIN (Tanpa Cabang - Item 6) */}
                      <td className="py-4 px-5">
                        <div className="flex items-center gap-3">
                          <div
                            className={`w-9 h-9 rounded-xl font-extrabold text-xs flex items-center justify-center shrink-0 ${
                              isIjin
                                ? 'bg-amber-100 dark:bg-amber-950/70 text-amber-700 dark:text-amber-300'
                                : isSakit
                                ? 'bg-rose-100 dark:bg-rose-950/70 text-rose-700 dark:text-rose-300'
                                : 'bg-indigo-100 dark:bg-indigo-950/70 text-indigo-700 dark:text-indigo-300'
                            }`}
                          >
                            {item.adminName.slice(0, 2)}
                          </div>
                          <div>
                            <span className="font-extrabold text-slate-900 dark:text-white text-xs sm:text-sm block">
                              {item.adminName}
                            </span>
                            <span className="text-[11px] text-slate-500 dark:text-slate-400">
                              Adm. Penjualan
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Kolom Gabungan: RINCIAN JADWAL (AREA KIRIM), JOBDESK TAMBAHAN & STATUS BACK UP / KEHADIRAN (Item 5) */}
                      <td className="py-4 px-5">
                        <div className="space-y-3">
                          {/* Baris Status Kehadiran & Status Back Up ACC terintegrasi */}
                          <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-slate-100 dark:border-slate-800/80">
                            <div className="flex flex-wrap items-center gap-2">
                              {/* Status Kehadiran Selector (Hadir / Ijin / Sakit) */}
                              <div className="inline-flex items-center bg-slate-100 dark:bg-slate-800/90 p-0.5 rounded-lg border border-slate-200/80 dark:border-slate-700">
                                <button
                                  type="button"
                                  onClick={() => handleUpdateRowAttendance(item.id, 'hadir')}
                                  className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition cursor-pointer ${
                                    attStatus === 'hadir'
                                      ? 'bg-white dark:bg-slate-900 text-emerald-700 dark:text-emerald-300 shadow-2xs'
                                      : 'text-slate-500 dark:text-slate-400 hover:text-slate-800'
                                  }`}
                                >
                                  Hadir Kerja
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleUpdateRowAttendance(item.id, 'ijin')}
                                  className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition cursor-pointer ${
                                    isIjin
                                      ? 'bg-amber-500 text-white shadow-2xs'
                                      : 'text-slate-500 dark:text-slate-400 hover:text-amber-600'
                                  }`}
                                >
                                  Ijin
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleUpdateRowAttendance(item.id, 'sakit')}
                                  className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition cursor-pointer ${
                                    isSakit
                                      ? 'bg-rose-600 text-white shadow-2xs'
                                      : 'text-slate-500 dark:text-slate-400 hover:text-rose-600'
                                  }`}
                                >
                                  Sakit
                                </button>
                              </div>

                              {/* Status Back Up ACC dijadikan satu dengan Rincian Jadwal & Jobdesk Tambahan */}
                              {!isAbsent && (
                                <button
                                  type="button"
                                  onClick={() => handleToggleBackupAccItem(item.id)}
                                  className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-[11px] font-bold border transition cursor-pointer ${
                                    item.isBackupAcc
                                      ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border-emerald-300 dark:border-emerald-700'
                                      : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-800 hover:border-emerald-400 hover:text-emerald-700'
                                  }`}
                                >
                                  {item.isBackupAcc ? (
                                    <>
                                      <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                                      <span>Status: Back Up ACC Aktif</span>
                                    </>
                                  ) : (
                                    <>
                                      <UserCheck className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                      <span>Jadikan Back Up ACC</span>
                                    </>
                                  )}
                                </button>
                              )}
                            </div>

                            {/* Popover Tambah Rincian Area / Jobdesk Tambahan */}
                            {!isAbsent && (
                              <div className="relative">
                                <button
                                  type="button"
                                  onClick={() =>
                                    setOpenRowAddMenuId(prev => (prev === item.id ? null : item.id))
                                  }
                                  className="py-1 px-3 bg-slate-50 dark:bg-slate-950 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 rounded-lg text-[11px] font-bold text-indigo-600 dark:text-indigo-400 flex items-center gap-1.5 cursor-pointer transition"
                                >
                                  <span>Tambah Area / Jobdesk</span>
                                  <ChevronDown className="w-3.5 h-3.5" />
                                </button>

                                {openRowAddMenuId === item.id && (
                                  <div className="absolute right-0 z-40 mt-1.5 w-72 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-2xl p-3 space-y-2.5 max-h-64 overflow-y-auto">
                                    <div>
                                      <span className="text-[10px] font-extrabold uppercase tracking-wider text-amber-600 dark:text-amber-400 block px-1 mb-1">
                                        Jobdesk Tambahan
                                      </span>
                                      <div className="flex flex-wrap gap-1">
                                        {ADDITIONAL_JOBDESK_OPTIONS.map(jb => {
                                          const active = jobdeskDutiesList.includes(jb);
                                          return (
                                            <button
                                              key={jb}
                                              type="button"
                                              onClick={() => {
                                                if (active) {
                                                  handleRemoveDutyFromSchedule(item.id, jb);
                                                } else {
                                                  handleAddDutyToSchedule(item.id, jb);
                                                }
                                              }}
                                              className={`px-2.5 py-1 rounded-md text-[10px] font-bold border transition cursor-pointer ${
                                                active
                                                  ? 'bg-amber-600 text-white border-amber-600'
                                                  : 'bg-amber-50/70 hover:bg-amber-100 dark:bg-amber-950/50 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-800'
                                              }`}
                                            >
                                              {jb}
                                            </button>
                                          );
                                        })}
                                      </div>
                                    </div>

                                    <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
                                      <span className="text-[10px] font-extrabold uppercase tracking-wider text-indigo-600 dark:text-indigo-400 block px-1 mb-1">
                                        Rincian Jadwal (Nama Area Kirim)
                                      </span>
                                      <div className="space-y-0.5">
                                        {synchronizedDeliveryAreas.map(area => {
                                          const active = areaDutiesList.includes(area);
                                          return (
                                            <button
                                              key={area}
                                              type="button"
                                              onClick={() => {
                                                if (active) {
                                                  handleRemoveDutyFromSchedule(item.id, area);
                                                } else {
                                                  handleAddDutyToSchedule(item.id, area);
                                                }
                                              }}
                                              className={`w-full px-2.5 py-1.5 rounded-lg text-left text-[11px] font-semibold flex items-center justify-between cursor-pointer ${
                                                active
                                                  ? 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 font-bold'
                                                  : 'hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300'
                                              }`}
                                            >
                                              <span>{area}</span>
                                              {active && <Check className="w-3.5 h-3.5 text-indigo-600" />}
                                            </button>
                                          );
                                        })}
                                      </div>
                                    </div>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>

                          {/* Konten Rincian: Jika Ijin/Sakit vs Hadir Kerja */}
                          {isAbsent ? (
                            <div
                              className={`flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl border ${
                                isIjin
                                  ? 'bg-amber-50/70 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800/70 text-amber-900 dark:text-amber-200'
                                  : 'bg-rose-50/70 dark:bg-rose-950/30 border-rose-200 dark:border-rose-800/70 text-rose-900 dark:text-rose-200'
                              }`}
                            >
                              <UserX className="w-4 h-4 shrink-0" />
                              <div>
                                <span className="font-bold block">
                                  Admin Tidak Masuk Kerja — Status: {isIjin ? 'IJIN' : 'SAKIT'}
                                </span>
                                {item.absenceReason && (
                                  <span className="text-[11px] opacity-85">
                                    Keterangan: {item.absenceReason}
                                  </span>
                                )}
                              </div>
                            </div>
                          ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                              {/* Grup 1: Rincian Jadwal (Area Kirim) */}
                              <div className="bg-slate-50/70 dark:bg-slate-950/60 border border-slate-200/80 dark:border-slate-800 rounded-xl p-3">
                                <div className="flex items-center gap-1.5 text-[10px] font-extrabold uppercase tracking-wider text-indigo-600 dark:text-indigo-400 mb-2">
                                  <MapPin className="w-3.5 h-3.5 shrink-0" />
                                  <span>Rincian Jadwal — Area Kirim ({areaDutiesList.length})</span>
                                </div>
                                {areaDutiesList.length === 0 ? (
                                  <span className="text-[11px] text-slate-400 italic">
                                    Belum ada area kirim dipilih
                                  </span>
                                ) : (
                                  <div className="flex flex-wrap gap-1.5">
                                    {areaDutiesList.map(duty => (
                                      <span
                                        key={duty}
                                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-white dark:bg-slate-900 text-indigo-900 dark:text-indigo-200 border border-indigo-200/80 dark:border-indigo-800/60"
                                      >
                                        <span>{duty}</span>
                                        <button
                                          type="button"
                                          onClick={() => handleRemoveDutyFromSchedule(item.id, duty)}
                                          className="text-slate-400 hover:text-rose-600 transition cursor-pointer"
                                        >
                                          &times;
                                        </button>
                                      </span>
                                    ))}
                                  </div>
                                )}
                              </div>

                              {/* Grup 2: Jobdesk Tambahan */}
                              <div className="bg-amber-50/30 dark:bg-slate-950/60 border border-amber-200/70 dark:border-slate-800 rounded-xl p-3">
                                <div className="flex items-center gap-1.5 text-[10px] font-extrabold uppercase tracking-wider text-amber-700 dark:text-amber-400 mb-2">
                                  <Briefcase className="w-3.5 h-3.5 shrink-0" />
                                  <span>Jobdesk Tambahan ({jobdeskDutiesList.length})</span>
                                </div>
                                {jobdeskDutiesList.length === 0 ? (
                                  <span className="text-[11px] text-slate-400 italic">
                                    Tidak ada jobdesk tambahan
                                  </span>
                                ) : (
                                  <div className="flex flex-wrap gap-1.5">
                                    {jobdeskDutiesList.map(jb => (
                                      <span
                                        key={jb}
                                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold bg-white dark:bg-slate-900 text-amber-900 dark:text-amber-300 border border-amber-200/90 dark:border-amber-800/60"
                                      >
                                        <span>{jb}</span>
                                        <button
                                          type="button"
                                          onClick={() => handleRemoveDutyFromSchedule(item.id, jb)}
                                          className="text-slate-400 hover:text-rose-600 transition cursor-pointer"
                                        >
                                          &times;
                                        </button>
                                      </span>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </div>
                          )}
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

      {/* MODAL BUAT JADWAL MANUAL ADMIN PENJUALAN */}
      {isManualModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-2xl w-full p-6 shadow-xl border border-slate-200 dark:border-slate-800 max-h-[92vh] overflow-y-auto">
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
                    Atur penugasan harian admin, pilih lebih dari satu area kirim &amp; jobdesk tambahan, atau catat status tidak masuk kerja (Ijin / Sakit).
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsManualModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveManualSchedule} className="space-y-4 text-xs">
              {/* Row 1: Pilih Cabang Admin */}
              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1.5">
                  Pilih Cabang Admin Penjualan *
                </label>
                <div className="grid grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={() => {
                      setManualBranchId('cab-banyuwangi');
                      const nusAdmins = salesAdminNames.filter(n => getAdminBranchId(n) === 'cab-banyuwangi');
                      if (nusAdmins.length > 0) setManualAdmin(nusAdmins[0]);
                    }}
                    className={`p-2.5 rounded-xl border text-left transition flex items-center justify-between cursor-pointer ${
                      manualBranchId === 'cab-banyuwangi'
                        ? 'bg-emerald-50/80 dark:bg-emerald-950/40 border-emerald-500 text-emerald-900 dark:text-emerald-200 ring-1 ring-emerald-500/30'
                        : 'bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <Building2 className={`w-4 h-4 ${manualBranchId === 'cab-banyuwangi' ? 'text-emerald-600' : 'text-slate-400'}`} />
                      <div>
                        <span className="font-extrabold block">Cabang Nusantara</span>
                        <span className="text-[10px] text-slate-500">Gudang Nusantara (Banyuwangi)</span>
                      </div>
                    </div>
                    {manualBranchId === 'cab-banyuwangi' && <Check className="w-4 h-4 text-emerald-600 shrink-0" />}
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setManualBranchId('cab-sidoarjo');
                      const sdaAdmins = salesAdminNames.filter(n => getAdminBranchId(n) === 'cab-sidoarjo');
                      if (sdaAdmins.length > 0) setManualAdmin(sdaAdmins[0]);
                    }}
                    className={`p-2.5 rounded-xl border text-left transition flex items-center justify-between cursor-pointer ${
                      manualBranchId === 'cab-sidoarjo'
                        ? 'bg-blue-50/80 dark:bg-blue-950/40 border-blue-500 text-blue-900 dark:text-blue-200 ring-1 ring-blue-500/30'
                        : 'bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <Building2 className={`w-4 h-4 ${manualBranchId === 'cab-sidoarjo' ? 'text-blue-600' : 'text-slate-400'}`} />
                      <div>
                        <span className="font-extrabold block">Cabang Sidoarjo</span>
                        <span className="text-[10px] text-slate-500">Gudang Sidoarjo</span>
                      </div>
                    </div>
                    {manualBranchId === 'cab-sidoarjo' && <Check className="w-4 h-4 text-blue-600 shrink-0" />}
                  </button>
                </div>
              </div>

              {/* Row 2: Tanggal Jadwal & Custom Dropdown Pilih Admin */}
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

                <div className="relative">
                  <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1">
                    Pilih Admin (Adm. Penjualan) *
                  </label>
                  <button
                    type="button"
                    onClick={() => setIsManualAdminDropdownOpen(prev => !prev)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-950 hover:bg-slate-100 dark:hover:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-white font-bold flex items-center justify-between gap-2 cursor-pointer transition"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="w-6 h-6 rounded-lg bg-indigo-100 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-300 font-extrabold text-[10px] flex items-center justify-center shrink-0">
                        {(manualAdmin || 'AD').slice(0, 2)}
                      </span>
                      <span className="truncate">{manualAdmin || 'Pilih Admin'}</span>
                    </div>
                    <ChevronDown className={`w-4 h-4 text-slate-400 shrink-0 transition-transform ${isManualAdminDropdownOpen ? 'rotate-180 text-indigo-500' : ''}`} />
                  </button>

                  {isManualAdminDropdownOpen && (
                    <div className="absolute left-0 right-0 z-50 mt-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-2xl overflow-hidden max-h-60 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
                      {salesAdminNames.map(name => {
                        const isSel = manualAdmin === name;
                        const currentBr = getAdminBranchId(name);
                        const isCurrentBranch = currentBr === manualBranchId;
                        return (
                          <button
                            key={name}
                            type="button"
                            onClick={() => {
                              setManualAdmin(name);
                              setIsManualAdminDropdownOpen(false);
                            }}
                            className={`w-full px-3.5 py-2.5 text-left text-xs font-bold flex items-center justify-between transition cursor-pointer ${
                              isSel
                                ? 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300'
                                : 'hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200'
                            }`}
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="w-6 h-6 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-extrabold text-[10px] flex items-center justify-center shrink-0">
                                {name.slice(0, 2)}
                              </span>
                              <div className="truncate">
                                <span className="block truncate">{name}</span>
                                <span className={`text-[10px] font-semibold ${
                                  isCurrentBranch ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400'
                                }`}>
                                  Cabang {currentBr === 'cab-sidoarjo' ? 'Sidoarjo' : 'Nusantara'}
                                </span>
                              </div>
                            </div>
                            {isSel && <Check className="w-4 h-4 text-indigo-600 shrink-0" />}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              {/* Row 3: Desain Status Kehadiran Admin (Hadir Kerja / Tidak Masuk Kerja: Ijin / Sakit - Item 4) */}
              <div className="space-y-2">
                <label className="block text-slate-700 dark:text-slate-300 font-bold">
                  Status Kehadiran Admin Penjualan
                </label>
                <div className="grid grid-cols-3 gap-2.5">
                  <button
                    type="button"
                    onClick={() => setManualAttendanceStatus('hadir')}
                    className={`p-2.5 rounded-xl border text-left transition flex items-center justify-between cursor-pointer ${
                      manualAttendanceStatus === 'hadir'
                        ? 'bg-emerald-50/90 dark:bg-emerald-950/40 border-emerald-500 text-emerald-900 dark:text-emerald-200 ring-1 ring-emerald-500/30'
                        : 'bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:border-slate-300'
                    }`}
                  >
                    <div>
                      <span className="font-extrabold block">Hadir Kerja</span>
                      <span className="text-[10px] text-slate-500">Aktif Bertugas</span>
                    </div>
                    {manualAttendanceStatus === 'hadir' && <Check className="w-4 h-4 text-emerald-600 shrink-0" />}
                  </button>

                  <button
                    type="button"
                    onClick={() => setManualAttendanceStatus('ijin')}
                    className={`p-2.5 rounded-xl border text-left transition flex items-center justify-between cursor-pointer ${
                      manualAttendanceStatus === 'ijin'
                        ? 'bg-amber-50/90 dark:bg-amber-950/40 border-amber-500 text-amber-900 dark:text-amber-200 ring-1 ring-amber-500/30'
                        : 'bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:border-amber-300'
                    }`}
                  >
                    <div>
                      <span className="font-extrabold block">Tidak Masuk (Ijin)</span>
                      <span className="text-[10px] text-slate-500">Ijin Keperluan / Cuti</span>
                    </div>
                    {manualAttendanceStatus === 'ijin' && <Check className="w-4 h-4 text-amber-600 shrink-0" />}
                  </button>

                  <button
                    type="button"
                    onClick={() => setManualAttendanceStatus('sakit')}
                    className={`p-2.5 rounded-xl border text-left transition flex items-center justify-between cursor-pointer ${
                      manualAttendanceStatus === 'sakit'
                        ? 'bg-rose-50/90 dark:bg-rose-950/40 border-rose-500 text-rose-900 dark:text-rose-200 ring-1 ring-rose-500/30'
                        : 'bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:border-rose-300'
                    }`}
                  >
                    <div>
                      <span className="font-extrabold block">Tidak Masuk (Sakit)</span>
                      <span className="text-[10px] text-slate-500">Istirahat Medis</span>
                    </div>
                    {manualAttendanceStatus === 'sakit' && <Check className="w-4 h-4 text-rose-600 shrink-0" />}
                  </button>
                </div>

                {(manualAttendanceStatus === 'ijin' || manualAttendanceStatus === 'sakit') && (
                  <div className="p-3.5 rounded-xl bg-amber-50/60 dark:bg-slate-950 border border-amber-200 dark:border-slate-800 space-y-2 mt-2">
                    <div className="flex items-center gap-2 text-amber-800 dark:text-amber-300 font-bold">
                      <AlertCircle className="w-4 h-4 shrink-0" />
                      <span>
                        Keterangan Admin Tidak Masuk Kerja ({manualAttendanceStatus === 'ijin' ? 'Ijin' : 'Sakit'})
                      </span>
                    </div>
                    <input
                      type="text"
                      placeholder={`Masukkan keterangan ${manualAttendanceStatus === 'ijin' ? 'ijin' : 'sakit'} (opsional)...`}
                      value={manualAbsenceReason}
                      onChange={e => setManualAbsenceReason(e.target.value)}
                      className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-white"
                    />
                  </div>
                )}
              </div>

              {/* SECTION 1 & 2: Pilih Rincian Jadwal & Jobdesk Tambahan (Bisa pilih lebih dari satu, tanpa tanda + dan tanpa filter tab area - Item 4) */}
              {manualAttendanceStatus === 'hadir' && (
                <>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <label className="text-slate-700 dark:text-slate-300 font-bold flex items-center gap-1.5">
                        <MapPin className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                        <span>Pilih Rincian Jadwal — Nama Area Kirim ({manualAreaDuties.length} dipilih, bisa pilih lebih dari satu)</span>
                      </label>
                    </div>

                    {/* Search Area Kirim */}
                    <div className="relative">
                      <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        placeholder="Cari nama area kirim (contoh: Muncar, Genteng, Jember, Denpasar)..."
                        value={areaSearchQuery}
                        onChange={e => setAreaSearchQuery(e.target.value)}
                        className="w-full pl-8 pr-3 py-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-900 dark:text-white"
                      />
                    </div>

                    <div className="flex flex-wrap gap-1.5 p-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl max-h-44 overflow-y-auto">
                      {filteredAreaOptionsForModal.map(areaName => {
                        const active = manualAreaDuties.includes(areaName);
                        return (
                          <button
                            key={areaName}
                            type="button"
                            onClick={() => handleToggleManualAreaDuty(areaName)}
                            className={`px-3 py-1.5 rounded-lg text-[11px] font-semibold transition cursor-pointer flex items-center gap-1.5 ${
                              active
                                ? 'bg-indigo-600 text-white shadow-2xs'
                                : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-800 hover:border-indigo-400'
                            }`}
                          >
                            {active && <Check className="w-3 h-3 shrink-0" />}
                            <span>{areaName}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* SECTION 2: Pilih Jobdesk Tambahan (Tanpa tanda +, multi-select) */}
                  <div className="space-y-1.5">
                    <label className="text-slate-700 dark:text-slate-300 font-bold flex items-center gap-1.5">
                      <Briefcase className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                      <span>Pilih Jobdesk Tambahan ({manualAdditionalDuties.length} dipilih, bisa pilih lebih dari satu)</span>
                    </label>
                    <div className="flex flex-wrap gap-1.5 p-3 bg-amber-50/40 dark:bg-slate-950 border border-amber-200/70 dark:border-slate-800 rounded-xl">
                      {ADDITIONAL_JOBDESK_OPTIONS.map(jobdesk => {
                        const active = manualAdditionalDuties.includes(jobdesk);
                        return (
                          <button
                            key={jobdesk}
                            type="button"
                            onClick={() => handleToggleManualAdditionalDuty(jobdesk)}
                            className={`px-3 py-1.5 rounded-lg text-[11px] font-bold transition cursor-pointer flex items-center gap-1.5 ${
                              active
                                ? 'bg-amber-600 text-white shadow-2xs'
                                : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-800 hover:border-amber-400'
                            }`}
                          >
                            {active && <Check className="w-3 h-3 shrink-0" />}
                            <span>{jobdesk}</span>
                          </button>
                        );
                      })}
                    </div>

                    {/* Custom Jobdesk Input */}
                    <div className="flex items-center gap-2 mt-2">
                      <input
                        type="text"
                        placeholder="Tambah jobdesk tambahan lainnya..."
                        value={customDutyInput}
                        onChange={e => setCustomDutyInput(e.target.value)}
                        className="flex-1 px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-white"
                      />
                      <button
                        type="button"
                        onClick={handleAddCustomDuty}
                        className="px-3 py-2 bg-slate-800 dark:bg-slate-700 text-white rounded-xl font-semibold hover:bg-slate-700 cursor-pointer"
                      >
                        Tambah Jobdesk
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
                        Status Back Up ACC akan ditampilkan bersama rincian jadwal &amp; jobdesk tambahan admin ini.
                      </span>
                    </div>
                  </label>
                </>
              )}

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
