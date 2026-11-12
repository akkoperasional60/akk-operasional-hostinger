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
  AlertCircle,
  Pencil,
  Trash2,
  Edit3
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

// Jobdesk Tambahan sesuai standar
export const ADDITIONAL_JOBDESK_OPTIONS = [
  'Ekspor Argo',
  'Ekspor Transaksi',
  'HP Telkomsel',
  'HP XL',
  'NX',
  'Retur',
  'BT'
];

// Istilah non-area yang tidak boleh masuk sebagai nama Area Kirim
export const NON_AREA_TERMS = [
  'Cek Eceran',
  'Input Retur Toko',
  'Cek Faktur Toko',
  'Muat Toko',
  'Cek Eceran Toko',
  'Cek Surat Jalan Toko',
  'Input Retur'
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
  const a0 = adminNames[0] || 'MUHAMMAD SHOIM';
  const a1 = adminNames[1] || 'ISTI';
  const a2 = adminNames[2] || 'IZZUL';
  const a3 = adminNames[3] || 'FATA';

  return [
    {
      id: 'sch-1',
      date: '2026-08-10',
      adminName: a0,
      branchId: 'cab-banyuwangi',
      duties: ['Muncar Pasar', 'Muncar Pinggir'],
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
      duties: ['Rogojampi Retail', 'Genteng Retail'],
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
      duties: ['Denpasar 1', 'Singaraja'],
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
      duties: ['Jember Kota', 'Situbondo'],
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
  const [selectedBranchId, setSelectedBranchId] = useState<string>(() => {
    const id = branchStore.getSelectedOriginBranchId();
    return id && id !== 'ALL' ? id : 'cab-banyuwangi';
  });

  useEffect(() => {
    const unsub = branchStore.subscribe(() => {
      const id = branchStore.getSelectedOriginBranchId();
      setSelectedBranchId(id && id !== 'ALL' ? id : 'cab-banyuwangi');
    });
    return unsub;
  }, []);

  const allSalesAdminUsers = useSalesAdminUsers();
  const salesAdminUsers = useSalesAdminUsers(selectedBranchId);
  const salesAdminNames = useMemo(() => {
    const names = salesAdminUsers
      .map(u => (u.fullName || '').trim().toUpperCase())
      .filter(Boolean);
    return names.length > 0 ? Array.from(new Set(names)) : ['ADMIN PENJUALAN'];
  }, [salesAdminUsers]);

  // Admin -> Branch mapping
  const [adminBranchMap, setAdminBranchMap] = useState<Record<string, string>>(() => loadAdminBranchMap());

  const getAdminBranchId = (adminName: string): string => {
    const key = (adminName || '').trim().toUpperCase();
    const matchedUser = allSalesAdminUsers.find(
      u => (u.fullName || '').trim().toUpperCase() === key
    );
    if (matchedUser) {
      const perms = branchStore.getUserBranchPermissions(
        matchedUser.id,
        matchedUser.role,
        matchedUser.permissions?.modules,
        matchedUser.permissions?.branchPermissions
      );
      const sdaEnabled = Boolean(perms['cab-sidoarjo']?.enabled);
      const bwiEnabled = Boolean(perms['cab-banyuwangi']?.enabled);
      if (sdaEnabled && !bwiEnabled) return 'cab-sidoarjo';
      if (bwiEnabled && !sdaEnabled) return 'cab-banyuwangi';
    }
    if (adminBranchMap[key] && adminBranchMap[key] !== 'ALL') return adminBranchMap[key];
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
    const matchedUser = allSalesAdminUsers.find(
      u => (u.fullName || '').trim().toUpperCase() === key
    );
    if (matchedUser) {
      branchStore.setCrewBranchId(matchedUser.id, branchId, matchedUser.fullName);
    }
  };

  const handleBranchFilterChange = (branchId: string) => {
    setSelectedBranchId(branchId);
    branchStore.setActiveBranchId(branchId);
  };

  // Synchronized Nama Area Kirim (Strictly Area Destinations Only)
  const synchronizedDeliveryAreas = useMemo(() => {
    const areaSet = new Set<string>(OFFICIAL_DESTINATION_AREAS);
    const liveSchedules = logisticsStore.getSchedules();
    liveSchedules.forEach(s => {
      const raw = s.areaName || s.store?.city || '';
      if (raw && !NON_AREA_TERMS.includes(raw)) {
        const std = standardizeAreaName(raw);
        if (std && std !== '-' && !NON_AREA_TERMS.includes(std)) areaSet.add(std);
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

  // Edit Modal State
  const [editingSchedule, setEditingSchedule] = useState<AdminDailyScheduleItem | null>(null);
  const [editBranchId, setEditBranchId] = useState<string>('cab-banyuwangi');
  const [editAdmin, setEditAdmin] = useState<string>('');
  const [editAttendanceStatus, setEditAttendanceStatus] = useState<AdminAttendanceStatus>('hadir');
  const [editAbsenceReason, setEditAbsenceReason] = useState<string>('');
  const [editAreaDuties, setEditAreaDuties] = useState<string[]>([]);
  const [editAdditionalDuties, setEditAdditionalDuties] = useState<string[]>([]);
  const [editIsBackupAcc, setEditIsBackupAcc] = useState<boolean>(false);
  const [editAreaSearchQuery, setEditAreaSearchQuery] = useState<string>('');
  const [isEditAdminDropdownOpen, setIsEditAdminDropdownOpen] = useState(false);

  // Delete Confirmation State
  const [deletingSchedule, setDeletingSchedule] = useState<AdminDailyScheduleItem | null>(null);

  const filteredAreaOptionsForModal = useMemo(() => {
    return synchronizedDeliveryAreas.filter(area => {
      if (areaSearchQuery.trim()) {
        return area.toLowerCase().includes(areaSearchQuery.trim().toLowerCase());
      }
      return true;
    });
  }, [synchronizedDeliveryAreas, areaSearchQuery]);

  const filteredAreaOptionsForEditModal = useMemo(() => {
    return synchronizedDeliveryAreas.filter(area => {
      if (editAreaSearchQuery.trim()) {
        return area.toLowerCase().includes(editAreaSearchQuery.trim().toLowerCase());
      }
      return true;
    });
  }, [synchronizedDeliveryAreas, editAreaSearchQuery]);

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

  const handleOpenEditModal = (item: AdminDailyScheduleItem) => {
    const effBranch = item.branchId || getAdminBranchId(item.adminName);
    setEditingSchedule(item);
    setEditBranchId(effBranch);
    setEditAdmin(item.adminName);
    setEditAttendanceStatus(item.attendanceStatus || 'hadir');
    setEditAbsenceReason(item.absenceReason || '');
    setEditAreaDuties(
      item.duties.filter(
        d => !ADDITIONAL_JOBDESK_OPTIONS.includes(d) && d !== 'Back Up ACC' && !NON_AREA_TERMS.includes(d)
      )
    );
    setEditAdditionalDuties(
      Array.from(
        new Set([
          ...item.duties.filter(d => ADDITIONAL_JOBDESK_OPTIONS.includes(d)),
          ...(item.additionalDuties || [])
        ])
      )
    );
    setEditIsBackupAcc(item.isBackupAcc);
    setEditAreaSearchQuery('');
    setIsEditAdminDropdownOpen(false);
  };

  const handleTopTabChange = (tab: SalesTopTab) => {
    if (tab === 'checklist' || tab === 'aktivitas_view') {
      onNavigateSubTab?.('activities');
    } else if (tab === 'durasi_muat') {
      onNavigateSubTab?.('loading_duration');
    }
  };

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
    setSaveToast(`Jadwal penugasan ${manualAdmin} pada ${formatReadableDateId(manualDate)} berhasil disimpan!`);
    setTimeout(() => setSaveToast(null), 3000);
  };

  const handleSaveEditSchedule = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSchedule || !editAdmin) return;

    setAdminBranchId(editAdmin, editBranchId);

    const isAbsent = editAttendanceStatus === 'ijin' || editAttendanceStatus === 'sakit';
    const combinedDuties = isAbsent
      ? []
      : Array.from(new Set([...editAreaDuties, ...editAdditionalDuties]));

    setSchedules(prev => {
      let next = [...prev];
      if (!isAbsent && editIsBackupAcc) {
        next = next.map(s =>
          s.date === editingSchedule.date &&
          getScheduleEffectiveBranchId(s) === editBranchId &&
          s.id !== editingSchedule.id
            ? { ...s, isBackupAcc: false }
            : s
        );
      }

      return next.map(item => {
        if (item.id === editingSchedule.id) {
          return {
            ...item,
            branchId: editBranchId,
            adminName: editAdmin,
            duties: combinedDuties,
            additionalDuties: isAbsent ? [] : editAdditionalDuties,
            isBackupAcc: isAbsent ? false : editIsBackupAcc,
            attendanceStatus: editAttendanceStatus,
            absenceReason: isAbsent ? editAbsenceReason.trim() : undefined
          };
        }
        return item;
      });
    });

    setEditingSchedule(null);
    setSaveToast(`Jadwal penugasan ${editAdmin} berhasil diperbarui!`);
    setTimeout(() => setSaveToast(null), 3000);
  };

  const handleConfirmDeleteSchedule = () => {
    if (!deletingSchedule) return;
    const name = deletingSchedule.adminName;
    setSchedules(prev => prev.filter(s => s.id !== deletingSchedule.id));
    setDeletingSchedule(null);
    setSaveToast(`Penugasan ${name} telah berhasil dihapus.`);
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
        const cleanDuties = item.duties.filter(d => !NON_AREA_TERMS.includes(d));
        const row = [
          idx + 1,
          item.date,
          getDayNameFromIso(item.date),
          `"${item.adminName}"`,
          `"${brName}"`,
          `"${attStatus}"`,
          item.isBackupAcc ? 'YA (BACK UP ACC)' : 'TIDAK',
          `"${cleanDuties.join('; ')}"`
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
    <div className="space-y-4">
      {/* Sales Header Filter */}
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

      {/* TOP SECTION: INTERACTIVE MONTHLY CALENDAR (Compact Dense Grid View) */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-2xs space-y-3">
        {/* Calendar Header & Action Button */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
              <Calendar className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-sm font-extrabold text-slate-900 dark:text-white">
                  Kalender Jadwal &amp; Penugasan Admin ({selectedMonth} {selectedYear})
                </h2>
                <span className="text-xs font-bold text-slate-500 dark:text-slate-400">
                  ·{' '}
                  {selectedBranchId === 'cab-banyuwangi'
                    ? 'Cabang Nusantara'
                    : selectedBranchId === 'cab-sidoarjo'
                    ? 'Cabang Sidoarjo'
                    : 'Semua Cabang'}
                </span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                Klik tanggal pada kalender untuk melihat dan mengelola rincian jadwal area kirim &amp; jobdesk di tabel bawah.
              </p>
            </div>
          </div>

          <button
            onClick={() => openManualModalForDate(selectedDateIso)}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-bold shadow-2xs transition cursor-pointer whitespace-nowrap self-start sm:self-auto"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Buat Jadwal Manual</span>
          </button>
        </div>

        {/* Save Toast */}
        {saveToast && (
          <div className="bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 text-emerald-800 dark:text-emerald-300 text-xs px-3.5 py-2 rounded-lg flex items-center justify-between">
            <div className="flex items-center gap-2 font-bold">
              <Check className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{saveToast}</span>
            </div>
            <button onClick={() => setSaveToast(null)} className="text-emerald-600 hover:text-emerald-800 cursor-pointer">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* 7-Column Calendar Grid */}
        <div>
          <div className="grid grid-cols-7 gap-1.5 mb-1.5">
            {['MINGGU', 'SENIN', 'SELASA', 'RABU', 'KAMIS', 'JUMAT', 'SABTU'].map((dayLabel, idx) => (
              <div
                key={dayLabel}
                className={`text-center text-[10px] font-extrabold uppercase tracking-wider py-1.5 rounded-md ${
                  idx === 0
                    ? 'text-rose-600 dark:text-rose-400 bg-rose-50/60 dark:bg-rose-950/20'
                    : 'text-slate-600 dark:text-slate-300 bg-slate-100/70 dark:bg-slate-800/60'
                }`}
              >
                {dayLabel}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1.5">
            {calendarCells.map((cell, index) => {
              if (!cell.day || !cell.isoDate) {
                return (
                  <div
                    key={`empty-${index}`}
                    className="min-h-[110px] rounded-lg bg-slate-50/30 dark:bg-slate-900/20 border border-dashed border-slate-200/50 dark:border-slate-800/40"
                  />
                );
              }

              const daySchedules = schedulesByDate[cell.isoDate] || [];
              const isSelected = selectedDateIso === cell.isoDate;
              const isSunday = index % 7 === 0;

              return (
                <div
                  key={cell.isoDate}
                  onClick={() => setSelectedDateIso(cell.isoDate!)}
                  className={`min-h-[110px] p-2 rounded-lg border transition-all cursor-pointer flex flex-col justify-between ${
                    isSelected
                      ? 'bg-indigo-50/80 dark:bg-indigo-950/40 border-indigo-600 dark:border-indigo-500 ring-2 ring-indigo-500/20 shadow-2xs'
                      : daySchedules.length > 0
                      ? 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-indigo-300 dark:hover:border-indigo-700'
                      : 'bg-slate-50/40 dark:bg-slate-950/30 border-slate-200/60 dark:border-slate-800/60 hover:border-slate-300'
                  }`}
                >
                  {/* Top row: Date number + count */}
                  <div className="flex items-center justify-between gap-1 mb-1">
                    <span
                      className={`text-xs font-extrabold font-mono tabular-nums w-5 h-5 rounded-md flex items-center justify-center ${
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
                      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 font-mono tabular-nums">
                        {daySchedules.length} Admin
                      </span>
                    )}
                  </div>

                  {/* Middle preview: Render up to 6-7 admin items cleanly */}
                  <div className="space-y-0.5 overflow-y-auto max-h-[82px] pr-0.5 scrollbar-thin">
                    {daySchedules.slice(0, 7).map(s => {
                      const isIjin = s.attendanceStatus === 'ijin';
                      const isSakit = s.attendanceStatus === 'sakit';
                      const isBackup = s.isBackupAcc && !isIjin && !isSakit;
                      const cleanDuties = s.duties.filter(
                        d => !ADDITIONAL_JOBDESK_OPTIONS.includes(d) && d !== 'Back Up ACC' && !NON_AREA_TERMS.includes(d)
                      );
                      const mainDuty = isIjin
                        ? 'Ijin'
                        : isSakit
                        ? 'Sakit'
                        : cleanDuties[0] || s.additionalDuties?.[0] || 'Tugas';
                      const shortName = s.adminName.split(' ')[0] || s.adminName;

                      return (
                        <div
                          key={s.id}
                          className={`text-[9px] font-medium px-1 py-0.5 rounded flex items-center justify-between gap-1 leading-tight ${
                            isBackup
                              ? 'bg-emerald-100/90 dark:bg-emerald-950/70 text-emerald-900 dark:text-emerald-200 font-bold border-l-2 border-emerald-500'
                              : isIjin
                              ? 'bg-amber-100/80 dark:bg-amber-950/50 text-amber-900 dark:text-amber-200'
                              : isSakit
                              ? 'bg-rose-100/80 dark:bg-rose-950/50 text-rose-900 dark:text-rose-200'
                              : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                          }`}
                        >
                          <span className="font-extrabold truncate max-w-[55px]">{shortName}</span>
                          <span className="truncate text-[8.5px] opacity-90">{mainDuty}</span>
                        </div>
                      );
                    })}
                    {daySchedules.length > 7 && (
                      <div className="text-[8.5px] font-bold text-indigo-600 dark:text-indigo-400 pl-0.5">
                        +{daySchedules.length - 7} admin lainnya
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* BOTTOM SECTION: RINCIAN JADWAL & PENUGASAN ADMIN (CLEAN TABLE UI WITH AKSI EDIT & HAPUS) */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-2xs">
        {/* Rincian Header Banner */}
        <div className="bg-slate-50/90 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-600 text-white flex items-center justify-center shrink-0">
              <ClipboardList className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-sm font-extrabold text-slate-900 dark:text-white">
                  Rincian Jadwal &amp; Penugasan Admin — {formatReadableDateId(selectedDateIso)}
                </h3>
                <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400 font-mono tabular-nums">
                  · {selectedDateSchedules.length} Penugasan
                </span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                Tabel penugasan admin penjualan harian beserta rincian area kirim, jobdesk tambahan, dan status kehadiran.
              </p>
            </div>
          </div>
        </div>

        {/* Clean Table with 4 Columns: NO | NAMA ADMIN | RINCIAN JADWAL & JOBDESK | AKSI */}
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left border-collapse">
            <thead>
              <tr className="bg-slate-100/80 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 uppercase text-[10px] tracking-wider font-extrabold">
                <th className="py-2.5 px-3 w-12 text-center border-r border-slate-200/80 dark:border-slate-800">NO</th>
                <th className="py-2.5 px-4 w-56 border-r border-slate-200/80 dark:border-slate-800">NAMA ADMIN</th>
                <th className="py-2.5 px-4 border-r border-slate-200/80 dark:border-slate-800">RINCIAN JADWAL (AREA KIRIM) &amp; JOBDESK TAMBAHAN</th>
                <th className="py-2.5 px-3 w-32 text-center">AKSI</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {selectedDateSchedules.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-8 px-4 text-center">
                    <div className="max-w-sm mx-auto space-y-1.5">
                      <p className="text-xs font-bold text-slate-700 dark:text-slate-300">
                        Belum ada jadwal admin pada tanggal {formatReadableDateId(selectedDateIso)}
                        {selectedBranchId !== 'ALL'
                          ? ` (Cabang ${selectedBranchId === 'cab-sidoarjo' ? 'Sidoarjo' : 'Nusantara'})`
                          : ''}.
                      </p>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">
                        Gunakan tombol <strong>Buat Jadwal Manual</strong> di atas untuk menambahkan penugasan admin.
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

                  // Clean Area Kirim List (strictly filter out non-area terms like Cek Eceran, Input Retur)
                  const areaDutiesList = item.duties.filter(
                    d =>
                      !ADDITIONAL_JOBDESK_OPTIONS.includes(d) &&
                      d !== 'Back Up ACC' &&
                      !NON_AREA_TERMS.includes(d)
                  );

                  const jobdeskDutiesList = Array.from(
                    new Set([
                      ...item.duties.filter(d => ADDITIONAL_JOBDESK_OPTIONS.includes(d)),
                      ...(item.additionalDuties || [])
                    ])
                  );

                  return (
                    <tr key={item.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition align-top">
                      {/* NO */}
                      <td className="py-2.5 px-3 text-center font-bold text-slate-500 font-mono tabular-nums border-r border-slate-100 dark:border-slate-800/80">
                        {idx + 1}
                      </td>

                      {/* NAMA ADMIN */}
                      <td className="py-2.5 px-4 border-r border-slate-100 dark:border-slate-800/80">
                        <div className="flex items-center gap-2.5">
                          <div
                            className={`w-8 h-8 rounded-lg font-extrabold text-[11px] flex items-center justify-center shrink-0 ${
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
                            <span className="font-extrabold text-slate-900 dark:text-white text-xs block">
                              {item.adminName}
                            </span>
                            <span className="text-[10px] text-slate-500 dark:text-slate-400">
                              Adm. Penjualan
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* RINCIAN JADWAL (AREA KIRIM) & JOBDESK TAMBAHAN */}
                      <td className="py-2.5 px-4 border-r border-slate-100 dark:border-slate-800/80">
                        <div className="space-y-2">
                          {/* Badges & Status line */}
                          <div className="flex flex-wrap items-center gap-2">
                            <span
                              className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                                attStatus === 'hadir'
                                  ? 'bg-emerald-100 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-300'
                                  : isIjin
                                  ? 'bg-amber-100 dark:bg-amber-950/70 text-amber-800 dark:text-amber-300'
                                  : 'bg-rose-100 dark:bg-rose-950/70 text-rose-800 dark:text-rose-300'
                              }`}
                            >
                              {attStatus === 'hadir' ? 'Hadir Kerja' : isIjin ? 'Ijin' : 'Sakit'}
                            </span>

                            {item.isBackupAcc && !isAbsent && (
                              <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-100 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-300 inline-flex items-center gap-1 border border-emerald-300/80 dark:border-emerald-700">
                                <ShieldCheck className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                                <span>Back Up ACC Aktif</span>
                              </span>
                            )}
                          </div>

                          {/* Content: Absent vs Active Duties */}
                          {isAbsent ? (
                            <div className="text-[11px] text-slate-600 dark:text-slate-400 font-semibold bg-amber-50/50 dark:bg-slate-950/40 p-2 rounded-lg border border-amber-200/60 dark:border-slate-800">
                              <span>Admin tidak masuk kerja ({isIjin ? 'Ijin' : 'Sakit'}).</span>
                              {item.absenceReason && (
                                <span className="block text-[10px] text-slate-500 mt-0.5">
                                  Keterangan: {item.absenceReason}
                                </span>
                              )}
                            </div>
                          ) : (
                            <div className="space-y-1.5">
                              {/* Area Kirim Badges */}
                              {areaDutiesList.length > 0 && (
                                <div className="flex flex-wrap items-center gap-1.5">
                                  <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 flex items-center gap-1">
                                    <MapPin className="w-3 h-3" /> Area Kirim:
                                  </span>
                                  {areaDutiesList.map(duty => (
                                    <span
                                      key={duty}
                                      className="px-2 py-0.5 rounded-md text-[11px] font-semibold bg-indigo-50 dark:bg-indigo-950/60 text-indigo-900 dark:text-indigo-200 border border-indigo-200/80 dark:border-indigo-800/60"
                                    >
                                      {duty}
                                    </span>
                                  ))}
                                </div>
                              )}

                              {/* Jobdesk Tambahan Badges */}
                              {jobdeskDutiesList.length > 0 && (
                                <div className="flex flex-wrap items-center gap-1.5">
                                  <span className="text-[10px] font-bold text-amber-700 dark:text-amber-400 flex items-center gap-1">
                                    <Briefcase className="w-3 h-3" /> Jobdesk Tambahan:
                                  </span>
                                  {jobdeskDutiesList.map(jb => (
                                    <span
                                      key={jb}
                                      className="px-2 py-0.5 rounded-md text-[11px] font-semibold bg-amber-50 dark:bg-amber-950/60 text-amber-900 dark:text-amber-300 border border-amber-200/80 dark:border-amber-800/60"
                                    >
                                      {jb}
                                    </span>
                                  ))}
                                </div>
                              )}

                              {areaDutiesList.length === 0 && jobdeskDutiesList.length === 0 && (
                                <span className="text-[11px] text-slate-400 italic">
                                  Belum ada area kirim atau jobdesk tambahan ditugaskan.
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      </td>

                      {/* AKSI COLUMN (EDIT & HAPUS BUTTONS) */}
                      <td className="py-2.5 px-3 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleOpenEditModal(item)}
                            className="px-2.5 py-1 rounded-lg bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/60 dark:hover:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 font-bold text-[11px] flex items-center gap-1 transition cursor-pointer"
                            title="Edit Penugasan Admin"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                            <span>Edit</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => setDeletingSchedule(item)}
                            className="px-2.5 py-1 rounded-lg bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/60 dark:hover:bg-rose-900/60 text-rose-700 dark:text-rose-300 font-bold text-[11px] flex items-center gap-1 transition cursor-pointer"
                            title="Hapus Penugasan Admin"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>Hapus</span>
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

      {/* MODAL BUAT JADWAL MANUAL */}
      {isManualModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-xl w-full p-5 shadow-2xl border border-slate-200 dark:border-slate-800 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800 mb-3.5">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
                  <Calendar className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                    Buat Jadwal Manual Admin Penjualan
                  </h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Atur penugasan harian, area kirim, dan jobdesk tambahan.
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

            <form onSubmit={handleSaveManualSchedule} className="space-y-3.5 text-xs">
              {/* Branch selector */}
              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1">
                  Pilih Cabang Admin Penjualan *
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setManualBranchId('cab-banyuwangi');
                      const nusAdmins = salesAdminNames.filter(n => getAdminBranchId(n) === 'cab-banyuwangi');
                      if (nusAdmins.length > 0) setManualAdmin(nusAdmins[0]);
                    }}
                    className={`p-2 rounded-lg border text-left transition flex items-center justify-between cursor-pointer ${
                      manualBranchId === 'cab-banyuwangi'
                        ? 'bg-emerald-50/80 dark:bg-emerald-950/40 border-emerald-500 text-emerald-900 dark:text-emerald-200 font-bold'
                        : 'bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <Building2 className={`w-3.5 h-3.5 ${manualBranchId === 'cab-banyuwangi' ? 'text-emerald-600' : 'text-slate-400'}`} />
                      <div>
                        <span className="font-extrabold block text-xs">Cabang Nusantara</span>
                        <span className="text-[10px] text-slate-500">Gudang Nusantara (BWI)</span>
                      </div>
                    </div>
                    {manualBranchId === 'cab-banyuwangi' && <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />}
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setManualBranchId('cab-sidoarjo');
                      const sdaAdmins = salesAdminNames.filter(n => getAdminBranchId(n) === 'cab-sidoarjo');
                      if (sdaAdmins.length > 0) setManualAdmin(sdaAdmins[0]);
                    }}
                    className={`p-2 rounded-lg border text-left transition flex items-center justify-between cursor-pointer ${
                      manualBranchId === 'cab-sidoarjo'
                        ? 'bg-blue-50/80 dark:bg-blue-950/40 border-blue-500 text-blue-900 dark:text-blue-200 font-bold'
                        : 'bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <Building2 className={`w-3.5 h-3.5 ${manualBranchId === 'cab-sidoarjo' ? 'text-blue-600' : 'text-slate-400'}`} />
                      <div>
                        <span className="font-extrabold block text-xs">Cabang Sidoarjo</span>
                        <span className="text-[10px] text-slate-500">Gudang Sidoarjo</span>
                      </div>
                    </div>
                    {manualBranchId === 'cab-sidoarjo' && <Check className="w-3.5 h-3.5 text-blue-600 shrink-0" />}
                  </button>
                </div>
              </div>

              {/* Date & Admin Picker */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1">
                    Tanggal *
                  </label>
                  <input
                    type="date"
                    required
                    value={manualDate}
                    onChange={e => setManualDate(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-900 dark:text-white font-semibold font-mono tabular-nums"
                  />
                </div>

                <div className="relative">
                  <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1">
                    Pilih Admin *
                  </label>
                  <button
                    type="button"
                    onClick={() => setIsManualAdminDropdownOpen(prev => !prev)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 hover:bg-slate-100 dark:hover:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-900 dark:text-white font-bold flex items-center justify-between gap-2 cursor-pointer transition"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="w-5 h-5 rounded bg-indigo-100 text-indigo-700 font-extrabold text-[10px] flex items-center justify-center shrink-0">
                        {(manualAdmin || 'AD').slice(0, 2)}
                      </span>
                      <span className="truncate text-xs">{manualAdmin || 'Pilih Admin'}</span>
                    </div>
                    <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />
                  </button>

                  {isManualAdminDropdownOpen && (
                    <div className="absolute left-0 right-0 z-50 mt-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg shadow-xl overflow-hidden max-h-48 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
                      {salesAdminNames.map(name => {
                        const isSel = manualAdmin === name;
                        return (
                          <button
                            key={name}
                            type="button"
                            onClick={() => {
                              setManualAdmin(name);
                              setIsManualAdminDropdownOpen(false);
                            }}
                            className={`w-full px-3 py-2 text-left text-xs font-bold flex items-center justify-between transition cursor-pointer ${
                              isSel
                                ? 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300'
                                : 'hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200'
                            }`}
                          >
                            <span>{name}</span>
                            {isSel && <Check className="w-3.5 h-3.5 text-indigo-600 shrink-0" />}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              {/* Kehadiran Status */}
              <div className="space-y-1.5">
                <label className="block text-slate-700 dark:text-slate-300 font-bold">
                  Status Kehadiran
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setManualAttendanceStatus('hadir')}
                    className={`py-2 px-2.5 rounded-lg border text-center transition cursor-pointer text-xs ${
                      manualAttendanceStatus === 'hadir'
                        ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-500 text-emerald-900 dark:text-emerald-200 font-bold'
                        : 'bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    Hadir Kerja
                  </button>

                  <button
                    type="button"
                    onClick={() => setManualAttendanceStatus('ijin')}
                    className={`py-2 px-2.5 rounded-lg border text-center transition cursor-pointer text-xs ${
                      manualAttendanceStatus === 'ijin'
                        ? 'bg-amber-50 dark:bg-amber-950/40 border-amber-500 text-amber-900 dark:text-amber-200 font-bold'
                        : 'bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    Ijin
                  </button>

                  <button
                    type="button"
                    onClick={() => setManualAttendanceStatus('sakit')}
                    className={`py-2 px-2.5 rounded-lg border text-center transition cursor-pointer text-xs ${
                      manualAttendanceStatus === 'sakit'
                        ? 'bg-rose-50 dark:bg-rose-950/40 border-rose-500 text-rose-900 dark:text-rose-200 font-bold'
                        : 'bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    Sakit
                  </button>
                </div>

                {(manualAttendanceStatus === 'ijin' || manualAttendanceStatus === 'sakit') && (
                  <input
                    type="text"
                    placeholder={`Keterangan ${manualAttendanceStatus === 'ijin' ? 'ijin' : 'sakit'}...`}
                    value={manualAbsenceReason}
                    onChange={e => setManualAbsenceReason(e.target.value)}
                    className="w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-900 dark:text-white"
                  />
                )}
              </div>

              {/* Area Kirim & Jobdesk Tambahan */}
              {manualAttendanceStatus === 'hadir' && (
                <>
                  <div className="space-y-1.5">
                    <label className="text-slate-700 dark:text-slate-300 font-bold flex items-center justify-between">
                      <span className="flex items-center gap-1">
                        <MapPin className="w-3.5 h-3.5 text-indigo-600" /> Area Kirim ({manualAreaDuties.length} dipilih)
                      </span>
                    </label>

                    <input
                      type="text"
                      placeholder="Cari area kirim (Muncar, Genteng, Jember, Denpasar)..."
                      value={areaSearchQuery}
                      onChange={e => setAreaSearchQuery(e.target.value)}
                      className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-xs"
                    />

                    <div className="flex flex-wrap gap-1.5 p-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg max-h-36 overflow-y-auto">
                      {filteredAreaOptionsForModal.map(areaName => {
                        const active = manualAreaDuties.includes(areaName);
                        return (
                          <button
                            key={areaName}
                            type="button"
                            onClick={() =>
                              setManualAreaDuties(prev =>
                                prev.includes(areaName)
                                  ? prev.filter(d => d !== areaName)
                                  : [...prev, areaName]
                              )
                            }
                            className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition cursor-pointer flex items-center gap-1 ${
                              active
                                ? 'bg-indigo-600 text-white'
                                : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-800'
                            }`}
                          >
                            {active && <Check className="w-3 h-3 shrink-0" />}
                            <span>{areaName}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Jobdesk Tambahan */}
                  <div className="space-y-1.5">
                    <label className="text-slate-700 dark:text-slate-300 font-bold flex items-center gap-1">
                      <Briefcase className="w-3.5 h-3.5 text-amber-600" /> Jobdesk Tambahan ({manualAdditionalDuties.length} dipilih)
                    </label>

                    <div className="flex flex-wrap gap-1.5 p-2 bg-amber-50/40 dark:bg-slate-950 border border-amber-200/60 dark:border-slate-800 rounded-lg">
                      {ADDITIONAL_JOBDESK_OPTIONS.map(jobdesk => {
                        const active = manualAdditionalDuties.includes(jobdesk);
                        return (
                          <button
                            key={jobdesk}
                            type="button"
                            onClick={() =>
                              setManualAdditionalDuties(prev =>
                                prev.includes(jobdesk)
                                  ? prev.filter(d => d !== jobdesk)
                                  : [...prev, jobdesk]
                              )
                            }
                            className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition cursor-pointer flex items-center gap-1 ${
                              active
                                ? 'bg-amber-600 text-white'
                                : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-800'
                            }`}
                          >
                            {active && <Check className="w-3 h-3 shrink-0" />}
                            <span>{jobdesk}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Back Up ACC Checkbox */}
                  <label className="flex items-center gap-2 p-2 rounded-lg bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/60 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={manualIsBackupAcc}
                      onChange={e => setManualIsBackupAcc(e.target.checked)}
                      className="w-4 h-4 rounded text-emerald-600 accent-emerald-600"
                    />
                    <span className="font-bold text-emerald-900 dark:text-emerald-200 text-xs">
                      Tetapkan sebagai Admin Back Up ACC
                    </span>
                  </label>
                </>
              )}

              <div className="flex items-center justify-end gap-2 pt-2.5 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsManualModalOpen(false)}
                  className="px-3.5 py-1.5 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg font-semibold cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-bold shadow-2xs cursor-pointer"
                >
                  Simpan Jadwal
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL EDIT PENUGASAN ADMIN */}
      {editingSchedule && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-xl w-full p-5 shadow-2xl border border-slate-200 dark:border-slate-800 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800 mb-3.5">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
                  <Pencil className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                    Edit Penugasan Admin — {editingSchedule.adminName}
                  </h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Ubah rincian area kirim, jobdesk tambahan, status kehadiran, atau status Back Up ACC.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEditingSchedule(null)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveEditSchedule} className="space-y-3.5 text-xs">
              {/* Branch Selector */}
              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1">
                  Cabang Admin *
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setEditBranchId('cab-banyuwangi')}
                    className={`p-2 rounded-lg border text-left transition cursor-pointer ${
                      editBranchId === 'cab-banyuwangi'
                        ? 'bg-emerald-50/80 dark:bg-emerald-950/40 border-emerald-500 text-emerald-900 dark:text-emerald-200 font-bold'
                        : 'bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    <span className="font-bold block text-xs">Cabang Nusantara</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setEditBranchId('cab-sidoarjo')}
                    className={`p-2 rounded-lg border text-left transition cursor-pointer ${
                      editBranchId === 'cab-sidoarjo'
                        ? 'bg-blue-50/80 dark:bg-blue-950/40 border-blue-500 text-blue-900 dark:text-blue-200 font-bold'
                        : 'bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    <span className="font-bold block text-xs">Cabang Sidoarjo</span>
                  </button>
                </div>
              </div>

              {/* Status Kehadiran */}
              <div className="space-y-1.5">
                <label className="block text-slate-700 dark:text-slate-300 font-bold">
                  Status Kehadiran
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setEditAttendanceStatus('hadir')}
                    className={`py-2 px-2.5 rounded-lg border text-center transition cursor-pointer text-xs ${
                      editAttendanceStatus === 'hadir'
                        ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-500 text-emerald-900 dark:text-emerald-200 font-bold'
                        : 'bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    Hadir Kerja
                  </button>

                  <button
                    type="button"
                    onClick={() => setEditAttendanceStatus('ijin')}
                    className={`py-2 px-2.5 rounded-lg border text-center transition cursor-pointer text-xs ${
                      editAttendanceStatus === 'ijin'
                        ? 'bg-amber-50 dark:bg-amber-950/40 border-amber-500 text-amber-900 dark:text-amber-200 font-bold'
                        : 'bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    Ijin
                  </button>

                  <button
                    type="button"
                    onClick={() => setEditAttendanceStatus('sakit')}
                    className={`py-2 px-2.5 rounded-lg border text-center transition cursor-pointer text-xs ${
                      editAttendanceStatus === 'sakit'
                        ? 'bg-rose-50 dark:bg-rose-950/40 border-rose-500 text-rose-900 dark:text-rose-200 font-bold'
                        : 'bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    Sakit
                  </button>
                </div>

                {(editAttendanceStatus === 'ijin' || editAttendanceStatus === 'sakit') && (
                  <input
                    type="text"
                    placeholder={`Keterangan ${editAttendanceStatus === 'ijin' ? 'ijin' : 'sakit'}...`}
                    value={editAbsenceReason}
                    onChange={e => setEditAbsenceReason(e.target.value)}
                    className="w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-900 dark:text-white"
                  />
                )}
              </div>

              {/* Area Kirim & Jobdesk Tambahan */}
              {editAttendanceStatus === 'hadir' && (
                <>
                  <div className="space-y-1.5">
                    <label className="text-slate-700 dark:text-slate-300 font-bold flex items-center justify-between">
                      <span className="flex items-center gap-1">
                        <MapPin className="w-3.5 h-3.5 text-indigo-600" /> Area Kirim ({editAreaDuties.length} dipilih)
                      </span>
                    </label>

                    <input
                      type="text"
                      placeholder="Cari area kirim (Muncar, Genteng, Jember, Denpasar)..."
                      value={editAreaSearchQuery}
                      onChange={e => setEditAreaSearchQuery(e.target.value)}
                      className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-xs"
                    />

                    <div className="flex flex-wrap gap-1.5 p-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg max-h-36 overflow-y-auto">
                      {filteredAreaOptionsForEditModal.map(areaName => {
                        const active = editAreaDuties.includes(areaName);
                        return (
                          <button
                            key={areaName}
                            type="button"
                            onClick={() =>
                              setEditAreaDuties(prev =>
                                prev.includes(areaName)
                                  ? prev.filter(d => d !== areaName)
                                  : [...prev, areaName]
                              )
                            }
                            className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition cursor-pointer flex items-center gap-1 ${
                              active
                                ? 'bg-indigo-600 text-white'
                                : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-800'
                            }`}
                          >
                            {active && <Check className="w-3 h-3 shrink-0" />}
                            <span>{areaName}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Jobdesk Tambahan */}
                  <div className="space-y-1.5">
                    <label className="text-slate-700 dark:text-slate-300 font-bold flex items-center gap-1">
                      <Briefcase className="w-3.5 h-3.5 text-amber-600" /> Jobdesk Tambahan ({editAdditionalDuties.length} dipilih)
                    </label>

                    <div className="flex flex-wrap gap-1.5 p-2 bg-amber-50/40 dark:bg-slate-950 border border-amber-200/60 dark:border-slate-800 rounded-lg">
                      {ADDITIONAL_JOBDESK_OPTIONS.map(jobdesk => {
                        const active = editAdditionalDuties.includes(jobdesk);
                        return (
                          <button
                            key={jobdesk}
                            type="button"
                            onClick={() =>
                              setEditAdditionalDuties(prev =>
                                prev.includes(jobdesk)
                                  ? prev.filter(d => d !== jobdesk)
                                  : [...prev, jobdesk]
                              )
                            }
                            className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition cursor-pointer flex items-center gap-1 ${
                              active
                                ? 'bg-amber-600 text-white'
                                : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-800'
                            }`}
                          >
                            {active && <Check className="w-3 h-3 shrink-0" />}
                            <span>{jobdesk}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Back Up ACC Checkbox */}
                  <label className="flex items-center gap-2 p-2 rounded-lg bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/60 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={editIsBackupAcc}
                      onChange={e => setEditIsBackupAcc(e.target.checked)}
                      className="w-4 h-4 rounded text-emerald-600 accent-emerald-600"
                    />
                    <span className="font-bold text-emerald-900 dark:text-emerald-200 text-xs">
                      Tetapkan sebagai Admin Back Up ACC
                    </span>
                  </label>
                </>
              )}

              <div className="flex items-center justify-end gap-2 pt-2.5 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setEditingSchedule(null)}
                  className="px-3.5 py-1.5 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg font-semibold cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-bold shadow-2xs cursor-pointer"
                >
                  Simpan Perubahan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL KONFIRMASI HAPUS PENUGASAN */}
      {deletingSchedule && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-sm w-full p-5 shadow-2xl border border-slate-200 dark:border-slate-800 text-center space-y-4">
            <div className="w-12 h-12 rounded-full bg-rose-100 dark:bg-rose-950/80 text-rose-600 dark:text-rose-400 flex items-center justify-center mx-auto">
              <Trash2 className="w-6 h-6" />
            </div>

            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Konfirmasi Hapus Penugasan
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Yakin menghapus penugasan <strong>{deletingSchedule.adminName}</strong> pada tanggal{' '}
                <strong>{formatReadableDateId(deletingSchedule.date)}</strong>?
              </p>
            </div>

            <div className="flex items-center justify-center gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setDeletingSchedule(null)}
                className="px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl font-semibold text-xs cursor-pointer hover:bg-slate-200"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteSchedule}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-xl font-bold text-xs shadow-2xs cursor-pointer"
              >
                Ya, Hapus Penugasan
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
