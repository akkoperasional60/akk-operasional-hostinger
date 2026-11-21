import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Calendar,
  Plus,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Check,
  UserCheck,
  X,
  ClipboardList,
  MapPin,
  Building2,
  Search,
  UserX,
  AlertCircle,
  Pencil,
  Trash2,
  Users,
  CheckCircle2,
  FileSpreadsheet,
  Lock,
  Percent,
  Briefcase,
  ShieldCheck
} from 'lucide-react';
import * as XLSX from 'xlsx';
import {
  SalesHeaderFilter,
  SalesTopTab,
  MONTH_OPTIONS,
  useSalesAdminUsers
} from './SalesHeaderFilter';
import {
  getOfficialAreasForBranch,
  standardizeAreaName
} from '../../utils/areaNormalizer';
import { branchStore } from '../../services/branchStore';
import { logisticsStore } from '../../services/store';
import { canEdit, getUserRoleDisplayTitle } from '../../utils/rbac';

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
  'BT',
  'Bantu Muat Kelilingan',
  'AKS'
];

// Istilah non-area yang tidak boleh masuk sebagai nama Area Kirim
export const NON_AREA_TERMS = [
  'Cek Eceran',
  'Input Retur Toko',
  'Cek Faktur Toko',
  'Muat Toko',
  'Cek Eceran Toko',
  'Cek Surat Jalan Toko',
  'Input Retur',
  'Area Pengiriman',
  'Area Kiriman',
  'Area Kirim'
];

const NON_AREA_TERM_SET = new Set(NON_AREA_TERMS.map(t => t.toLowerCase()));

function isNonAreaTerm(value?: string | null): boolean {
  const clean = String(value || '').trim().toLowerCase();
  if (!clean || clean === '-') return true;
  return NON_AREA_TERM_SET.has(clean);
}

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
const DAY_SHORT_ID = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];

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

function getTodayIso(): string {
  const now = new Date();
  return formatDateIso(now.getFullYear(), now.getMonth(), now.getDate());
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

function formatShortDateId(isoDate: string): string {
  const [y, m, d] = isoDate.split('-').map(Number);
  if (!y || !m || !d) return isoDate;
  const monthName = (MONTH_OPTIONS[m - 1] || '').slice(0, 3);
  return `${d} ${monthName} ${y}`;
}

function getInitials(name: string): string {
  const parts = (name || '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'AD';
  return parts[0].slice(0, 2).toUpperCase();
}

function getShortAdminName(name: string): string {
  const parts = (name || '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'ADMIN';
  return parts[0].toUpperCase();
}

function getCompactAreaLabel(area: string): string {
  const idx = area.indexOf('(');
  if (idx > 0) return area.slice(0, idx).trim();
  return area;
}

function createInitialSchedules(_adminNames?: string[]): AdminDailyScheduleItem[] {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  const getD = (day: number) => formatDateIso(y, m, Math.min(day, getDaysInMonth(y, m)));

  const buildDayEntries = (
    day: number,
    rows: Array<{
      adminName: string;
      duties: string[];
      additionalDuties: string[];
      attendanceStatus?: AdminAttendanceStatus;
      isBackupAcc?: boolean;
    }>
  ): AdminDailyScheduleItem[] =>
    rows.map((r, idx) => ({
      id: `sch-${day}-${idx + 1}`,
      date: getD(day),
      adminName: r.adminName,
      branchId: 'cab-banyuwangi',
      duties: r.duties,
      additionalDuties: r.additionalDuties,
      shiftTime: '08:00 - 16:00',
      isBackupAcc: Boolean(r.isBackupAcc),
      notes: '',
      attendanceStatus: r.attendanceStatus || 'hadir'
    }));

  const standardSevenRows = [
    {
      adminName: 'MEINDA MAULINA',
      duties: ['Toko DR. Soetomo'],
      additionalDuties: [],
      attendanceStatus: 'hadir' as const,
      isBackupAcc: true
    },
    {
      adminName: 'CANDRA MAULANA',
      duties: ['Sanggar Retail'],
      additionalDuties: [],
      attendanceStatus: 'hadir' as const,
      isBackupAcc: false
    },
    {
      adminName: 'BINTANG MEDITA SARI',
      duties: ['Ketapang Wongsorejo'],
      additionalDuties: ['NX', 'AKS'],
      attendanceStatus: 'hadir' as const,
      isBackupAcc: false
    },
    {
      adminName: 'FATAUDIN RIFKY MAULANA',
      duties: ['Kalibaru Retail'],
      additionalDuties: ['Ekspor Argo', 'BT'],
      attendanceStatus: 'hadir' as const,
      isBackupAcc: false
    },
    {
      adminName: 'PIPIT ISTIANI',
      duties: ['Grosir Srono Sumberayu Muncar'],
      additionalDuties: ['HP Telkomsel', 'Retur'],
      attendanceStatus: 'hadir' as const,
      isBackupAcc: false
    },
    {
      adminName: 'IZZUL BAHRUL HISAM',
      duties: ['Susulan Rogojampi Muncar'],
      additionalDuties: ['HP XL', 'Ekspor Transaksi'],
      attendanceStatus: 'hadir' as const,
      isBackupAcc: false
    },
    {
      adminName: 'MOHAMMAD SHOIM',
      duties: ['Sempu Stail'],
      additionalDuties: [],
      attendanceStatus: 'hadir' as const,
      isBackupAcc: false
    }
  ];

  return [
    ...buildDayEntries(12, [
      { adminName: 'FATAUDIN RIFKY MAULANA', duties: ['Kalibaru Retail'], additionalDuties: ['Ekspor Argo', 'BT'] },
      { adminName: 'BINTANG MEDITA SARI', duties: ['Ketapang Wongsorejo'], additionalDuties: ['NX', 'AKS'] },
      { adminName: 'PIPIT ISTIANI', duties: ['Grosir Srono Sumberayu Muncar'], additionalDuties: ['HP Telkomsel', 'Retur'] },
      { adminName: 'IZZUL BAHRUL HISAM', duties: ['Susulan Rogojampi Muncar'], additionalDuties: ['HP XL', 'Ekspor Transaksi'] },
      { adminName: 'MOHAMMAD SHOIM', duties: ['Sempu Stail'], additionalDuties: [] },
      { adminName: 'MEINDA MAULINA', duties: ['Toko DR. Soetomo'], additionalDuties: [], isBackupAcc: true }
    ]),
    ...buildDayEntries(13, [
      { adminName: 'MEINDA MAULINA', duties: ['Toko DR. Soetomo'], additionalDuties: [], isBackupAcc: true },
      { adminName: 'BINTANG MEDITA SARI', duties: ['Srono Retail'], additionalDuties: ['NX', 'Retur'] },
      { adminName: 'PIPIT ISTIANI', duties: ['Grosir Jajag Sanggar Purwo'], additionalDuties: ['HP Telkomsel'] },
      { adminName: 'FATAUDIN RIFKY MAULANA', duties: ['Purwo Pasar'], additionalDuties: ['Ekspor Argo', 'BT'] },
      { adminName: 'IZZUL BAHRUL HISAM', duties: ['Negara'], additionalDuties: ['HP XL', 'Ekspor Transaksi'] },
      { adminName: 'MOHAMMAD SHOIM', duties: ['Jember Kota'], additionalDuties: ['AKS'] }
    ]),
    ...buildDayEntries(14, [
      { adminName: 'MEINDA MAULINA', duties: ['Toko DR. Soetomo'], additionalDuties: [], isBackupAcc: true },
      { adminName: 'BINTANG MEDITA SARI', duties: ['Susulan Genteng Rogojampi'], additionalDuties: ['NX'] },
      { adminName: 'PIPIT ISTIANI', duties: ['Kanvas LKT'], additionalDuties: ['HP Telkomsel', 'Retur'] },
      { adminName: 'FATAUDIN RIFKY MAULANA', duties: ['Denpasar 1'], additionalDuties: ['Ekspor Argo', 'BT'] },
      { adminName: 'IZZUL BAHRUL HISAM', duties: ['Situbondo'], additionalDuties: ['HP XL', 'Ekspor Transaksi'] },
      { adminName: 'MOHAMMAD SHOIM', duties: ['Bondowoso'], additionalDuties: ['AKS'] }
    ]),
    ...buildDayEntries(16, [
      { adminName: 'MEINDA MAULINA', duties: ['Toko DR. Soetomo'], additionalDuties: [], isBackupAcc: true },
      { adminName: 'BINTANG MEDITA SARI', duties: ['Galekan Retail'], additionalDuties: ['NX', 'AKS'] },
      { adminName: 'FATAUDIN RIFKY MAULANA', duties: ['Sumberayu Retail'], additionalDuties: ['Ekspor Argo', 'BT'] },
      { adminName: 'PIPIT ISTIANI', duties: ['Grosir Banyuwangi Rogojampi'], additionalDuties: ['HP Telkomsel', 'Retur'] },
      { adminName: 'IZZUL BAHRUL HISAM', duties: ['Susulan Sanggar Jajag'], additionalDuties: ['HP XL', 'Ekspor Transaksi'] },
      { adminName: 'MOHAMMAD SHOIM', duties: ['Muncar Pinggir'], additionalDuties: [] }
    ]),
    ...buildDayEntries(17, [
      { adminName: 'MEINDA MAULINA', duties: ['Toko DR. Soetomo'], additionalDuties: [], isBackupAcc: true },
      { adminName: 'BINTANG MEDITA SARI', duties: ['Muncar Pasar'], additionalDuties: ['NX', 'AKS'] },
      { adminName: 'FATAUDIN RIFKY MAULANA', duties: ['Denpasar 1'], additionalDuties: ['Ekspor Argo', 'BT'] },
      { adminName: 'PIPIT ISTIANI', duties: ['Rogojampi Retail'], additionalDuties: ['HP Telkomsel', 'Retur'] },
      { adminName: 'IZZUL BAHRUL HISAM', duties: ['Genteng Retail'], additionalDuties: ['HP XL', 'Ekspor Transaksi'] },
      { adminName: 'MOHAMMAD SHOIM', duties: ['Jember Selatan'], additionalDuties: [] }
    ]),
    ...buildDayEntries(18, [
      { adminName: 'MEINDA MAULINA', duties: ['Toko DR. Soetomo'], additionalDuties: [], isBackupAcc: true },
      { adminName: 'BINTANG MEDITA SARI', duties: ['BWI Kota Selatan'], additionalDuties: ['NX', 'AKS'] },
      { adminName: 'FATAUDIN RIFKY MAULANA', duties: ['Jember Barat'], additionalDuties: ['Ekspor Argo', 'BT'] },
      { adminName: 'PIPIT ISTIANI', duties: ['Grosir Genteng Gendoh'], additionalDuties: ['HP Telkomsel', 'Retur'] },
      { adminName: 'IZZUL BAHRUL HISAM', duties: ['Singaraja'], additionalDuties: ['HP XL', 'Ekspor Transaksi'] },
      { adminName: 'MOHAMMAD SHOIM', duties: ['Denpasar 2'], additionalDuties: [] }
    ]),
    ...buildDayEntries(19, standardSevenRows),
    ...buildDayEntries(20, standardSevenRows),
    ...buildDayEntries(21, standardSevenRows)
  ];
}

// Custom Indonesian Calendar Date Picker (zero native <input type="date">)
const InlineDatePickerField: React.FC<{
  label: string;
  value: string;
  onChange: (iso: string) => void;
}> = ({ label, value, onChange }) => {
  const [open, setOpen] = useState(false);
  const [yInit, mInit] = value.split('-').map(Number);
  const [viewYear, setViewYear] = useState(yInit || new Date().getFullYear());
  const [viewMonth, setViewMonth] = useState((mInit ? mInit - 1 : new Date().getMonth()));
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const [yy, mm] = value.split('-').map(Number);
    if (yy && mm) {
      setViewYear(yy);
      setViewMonth(mm - 1);
    }
  }, [value]);

  useEffect(() => {
    const onOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onOutside);
    return () => document.removeEventListener('mousedown', onOutside);
  }, []);

  const daysInM = getDaysInMonth(viewYear, viewMonth);
  const firstD = getFirstDayOfMonth(viewYear, viewMonth);
  const todayIso = getTodayIso();

  const shiftMonth = (delta: number) => {
    let nextM = viewMonth + delta;
    let nextY = viewYear;
    if (nextM < 0) {
      nextM = 11;
      nextY -= 1;
    } else if (nextM > 11) {
      nextM = 0;
      nextY += 1;
    }
    setViewMonth(nextM);
    setViewYear(nextY);
  };

  return (
    <div ref={containerRef} className="relative">
      <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-1.5">
        {label}
      </label>
      <button
        type="button"
        onClick={() => setOpen(prev => !prev)}
        className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-950 hover:bg-slate-100/80 dark:hover:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-900 dark:text-white flex items-center justify-between gap-2 transition cursor-pointer"
      >
        <span className="flex items-center gap-2 min-w-0">
          <Calendar className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
          <span className="truncate tabular-nums">{formatReadableDateId(value)}</span>
        </span>
        <ChevronDown className={`w-4 h-4 text-slate-400 shrink-0 transition-transform ${open ? 'rotate-180 text-indigo-500' : ''}`} />
      </button>

      {open && (
        <div className="absolute left-0 right-0 sm:w-72 mt-1.5 z-50 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-2xl p-3 space-y-2.5">
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={() => shiftMonth(-1)}
              className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-xs font-black text-slate-900 dark:text-white">
              {MONTH_OPTIONS[viewMonth]} {viewYear}
            </span>
            <button
              type="button"
              onClick={() => shiftMonth(1)}
              className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 cursor-pointer"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-bold text-slate-400">
            {DAY_SHORT_ID.map((d, idx) => (
              <div key={d} className={idx === 0 ? 'text-rose-500' : ''}>{d}</div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1">
            {Array.from({ length: firstD }).map((_, idx) => (
              <div key={`pad-${idx}`} className="h-7" />
            ))}
            {Array.from({ length: daysInM }).map((_, idx) => {
              const dayNum = idx + 1;
              const iso = formatDateIso(viewYear, viewMonth, dayNum);
              const isSelected = iso === value;
              const isToday = iso === todayIso;
              return (
                <button
                  key={iso}
                  type="button"
                  onClick={() => {
                    onChange(iso);
                    setOpen(false);
                  }}
                  className={`h-7 rounded-lg text-[11px] font-bold tabular-nums transition cursor-pointer ${
                    isSelected
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : isToday
                      ? 'bg-indigo-50 dark:bg-indigo-500/20 text-indigo-700 dark:text-indigo-300 border border-indigo-300 dark:border-indigo-700'
                      : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                >
                  {dayNum}
                </button>
              );
            })}
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={() => {
                onChange(todayIso);
                setOpen(false);
              }}
              className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
            >
              Hari Ini
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="text-[11px] font-semibold text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 cursor-pointer"
            >
              Tutup
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export const AdminSchedulesTab: React.FC<AdminSchedulesTabProps> = ({
  onNavigateSubTab,
  adminOptions
}) => {
  const currentUser = logisticsStore.getCurrentUser();
  const accessibleBranches = useMemo(() => {
    const list = branchStore.getAccessibleBranchesForUser(currentUser);
    return list.length > 0 ? list : branchStore.getActiveBranches();
  }, [currentUser]);

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

  // Clamp selectedBranchId to user's RBAC accessible branches
  useEffect(() => {
    if (accessibleBranches.length === 0) return;
    if (!accessibleBranches.some(b => b.id === selectedBranchId)) {
      const fallback = accessibleBranches[0].id;
      setSelectedBranchId(fallback);
      branchStore.setActiveBranchId(fallback);
    }
  }, [accessibleBranches, selectedBranchId]);

  const effectiveBranchId = useMemo(() => {
    if (selectedBranchId && selectedBranchId !== 'ALL' && accessibleBranches.some(b => b.id === selectedBranchId)) {
      return selectedBranchId;
    }
    return accessibleBranches[0]?.id || 'cab-banyuwangi';
  }, [selectedBranchId, accessibleBranches]);

  const activeBranchName = effectiveBranchId === 'cab-sidoarjo' ? 'Sidoarjo' : 'Nusantara';
  const isSidoarjoBranch = effectiveBranchId === 'cab-sidoarjo';

  const canEditSchedules =
    (canEdit(currentUser, 'sales_admin') || canEdit(currentUser, 'sales_schedules')) &&
    branchStore.canUserAccessBranch(currentUser, effectiveBranchId);

  const allSalesAdminUsers = useSalesAdminUsers();
  const salesAdminUsers = useSalesAdminUsers(effectiveBranchId);

  const salesAdminNames = useMemo(() => {
    return Array.from(
      new Set(
        salesAdminUsers
          .map(u => (u.fullName || '').trim().toUpperCase())
          .filter(Boolean)
      )
    );
  }, [salesAdminUsers]);

  const adminMetaMap = useMemo(() => {
    const map = new Map<string, { roleLabel: string; department: string; branchId: string }>();
    allSalesAdminUsers.forEach(u => {
      const key = (u.fullName || '').trim().toUpperCase();
      if (!key) return;
      map.set(key, {
        roleLabel: getUserRoleDisplayTitle(u.role) || 'Adm. Penjualan',
        department: u.department || 'Adm. Penjualan',
        branchId: effectiveBranchId
      });
    });
    return map;
  }, [allSalesAdminUsers, effectiveBranchId]);

  // Admin -> Branch mapping
  const [adminBranchMap, setAdminBranchMap] = useState<Record<string, string>>(() => loadAdminBranchMap());

  const getAdminBranchId = (adminName: string): string => {
    const key = (adminName || '').trim().toUpperCase();
    const matchedUser = allSalesAdminUsers.find(
      u => (u.fullName || '').trim().toUpperCase() === key
    );
    if (matchedUser) {
      const rawPerms = matchedUser.permissions?.branchPermissions;
      if (rawPerms && typeof rawPerms === 'object') {
        const sdaOn = Boolean(rawPerms['cab-sidoarjo']?.enabled);
        const bwiOn = Boolean(rawPerms['cab-banyuwangi']?.enabled);
        if (sdaOn && !bwiOn) return 'cab-sidoarjo';
        if (bwiOn && !sdaOn) return 'cab-banyuwangi';
      }
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
    return 'cab-banyuwangi';
  };

  const setAdminBranchId = (adminName: string, branchId: string) => {
    const key = (adminName || '').trim().toUpperCase();
    if (!key) return;
    setAdminBranchMap(prev => {
      const next = { ...prev, [key]: branchId };
      try {
        localStorage.setItem(LS_ADMIN_BRANCH_MAP_KEY, JSON.stringify(next));
      } catch {}
      return next;
    });
  };

  // Synchronized Nama Area Kirim strictly scoped by active branch (Sidoarjo 9 areas vs Nusantara 37 areas)
  const synchronizedDeliveryAreas = useMemo(() => {
    const officialForBranch = getOfficialAreasForBranch(effectiveBranchId);
    const areaSet = new Set<string>(officialForBranch);
    const liveSchedules = logisticsStore.getSchedules();
    liveSchedules.forEach(s => {
      const schBranch = branchStore.getScheduleBranchId(s.id, s.originName || s.areaName, s.fleetId);
      if (schBranch !== effectiveBranchId) return;
      const raw = (s.areaName || s.store?.city || '').trim();
      if (raw && !isNonAreaTerm(raw)) {
        const std = standardizeAreaName(raw, effectiveBranchId);
        if (std && !isNonAreaTerm(std)) {
          areaSet.add(std);
        }
      }
    });
    return Array.from(areaSet).filter(area => !isNonAreaTerm(area));
  }, [effectiveBranchId]);

  const nowCurrent = new Date();
  const currentMonthName = MONTH_OPTIONS[nowCurrent.getMonth()] || 'November';
  const currentYearStr = String(nowCurrent.getFullYear());

  const [selectedAdmin, setSelectedAdmin] = useState('SEMUA ADMIN');
  const [selectedMonth, setSelectedMonth] = useState<string>(() => currentMonthName);
  const [selectedYear, setSelectedYear] = useState<string>(() => currentYearStr);
  const [saveToast, setSaveToast] = useState<string | null>(null);
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  const monthIndex = Math.max(0, MONTH_OPTIONS.indexOf(selectedMonth));
  const yearNum = Number(selectedYear) || nowCurrent.getFullYear();

  const [selectedDateIso, setSelectedDateIso] = useState<string>(() => {
    const today = nowCurrent.getDate();
    return formatDateIso(nowCurrent.getFullYear(), nowCurrent.getMonth(), today);
  });

  useEffect(() => {
    const parts = selectedDateIso.split('-').map(Number);
    const currentDay = parts[2] || 1;
    const maxDays = getDaysInMonth(yearNum, monthIndex);
    const clampedDay = Math.min(currentDay, maxDays);
    setSelectedDateIso(formatDateIso(yearNum, monthIndex, clampedDay));
  }, [selectedMonth, selectedYear, yearNum, monthIndex]);

  const [schedules, setSchedules] = useState<AdminDailyScheduleItem[]>(() => {
    return createInitialSchedules();
  });

  const persistAdminSchedulesToServer = (nextSchedules: AdminDailyScheduleItem[]) => {
    try {
      localStorage.setItem('akk_admin_calendar_schedules_v1', JSON.stringify(nextSchedules));
      localStorage.setItem('akk_admin_calendar_initialized_v1', 'true');
    } catch {}
    fetch('/api/admin-schedules', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ schedules: nextSchedules })
    }).catch(err => console.warn('[Admin Schedules Sync Warning]', err));
  };

  // Load and hydrate admin schedules from Hostinger MySQL database (/api/admin-schedules)
  useEffect(() => {
    let active = true;
    fetch('/api/admin-schedules', { cache: 'no-store' })
      .then(r => r.json())
      .then(res => {
        if (!active) return;
        const incoming = Array.isArray(res?.schedules) ? res.schedules : [];
        const isLegacyFourStub =
          incoming.length <= 4 &&
          incoming.every((it: any) => ['sch-1', 'sch-2', 'sch-3', 'sch-4'].includes(String(it?.id || '')));
        if (res && res.success && incoming.length > 0 && !isLegacyFourStub) {
          setSchedules(incoming);
          try {
            localStorage.setItem('akk_admin_calendar_schedules_v1', JSON.stringify(incoming));
          } catch {}
        } else {
          const initial = createInitialSchedules();
          setSchedules(initial);
          persistAdminSchedulesToServer(initial);
        }
      })
      .catch(err => {
        console.warn('[Admin Schedules Fetch from MySQL Error]', err);
        try {
          const saved = localStorage.getItem('akk_admin_calendar_schedules_v1');
          if (saved) {
            const parsed = JSON.parse(saved);
            if (Array.isArray(parsed) && parsed.length > 4) {
              setSchedules(parsed);
            }
          }
        } catch {}
      });
    return () => {
      active = false;
    };
  }, []);

  const showToastMessage = (msg: string) => {
    setSaveToast(msg);
    setTimeout(() => setSaveToast(null), 3200);
  };

  // Manual Schedule Modal State
  const [isManualModalOpen, setIsManualModalOpen] = useState(false);
  const [manualDate, setManualDate] = useState(selectedDateIso);
  const [manualBranchId, setManualBranchId] = useState<string>(effectiveBranchId);
  const [manualAdmin, setManualAdmin] = useState('');
  const [isManualAdminDropdownOpen, setIsManualAdminDropdownOpen] = useState(false);
  const [manualAttendanceStatus, setManualAttendanceStatus] = useState<AdminAttendanceStatus>('hadir');
  const [manualAbsenceReason, setManualAbsenceReason] = useState('');
  const [manualAreaDuties, setManualAreaDuties] = useState<string[]>([]);
  const [manualAdditionalDuties, setManualAdditionalDuties] = useState<string[]>([]);
  const [areaSearchQuery, setAreaSearchQuery] = useState('');
  const [customDutyInput, setCustomDutyInput] = useState('');
  const [manualIsBackupAcc, setManualIsBackupAcc] = useState(false);

  // Edit Modal State
  const [editingSchedule, setEditingSchedule] = useState<AdminDailyScheduleItem | null>(null);
  const [editBranchId, setEditBranchId] = useState<string>(effectiveBranchId);
  const [editAdmin, setEditAdmin] = useState<string>('');
  const [editAttendanceStatus, setEditAttendanceStatus] = useState<AdminAttendanceStatus>('hadir');
  const [editAbsenceReason, setEditAbsenceReason] = useState<string>('');
  const [editAreaDuties, setEditAreaDuties] = useState<string[]>([]);
  const [editAdditionalDuties, setEditAdditionalDuties] = useState<string[]>([]);
  const [editCustomDutyInput, setEditCustomDutyInput] = useState<string>('');
  const [editIsBackupAcc, setEditIsBackupAcc] = useState<boolean>(false);
  const [editAreaSearchQuery, setEditAreaSearchQuery] = useState<string>('');
  const [isEditAdminDropdownOpen, setIsEditAdminDropdownOpen] = useState(false);

  // Delete Confirmation State
  const [deletingSchedule, setDeletingSchedule] = useState<AdminDailyScheduleItem | null>(null);

  const filteredAreaOptionsForModal = useMemo(() => {
    const q = areaSearchQuery.trim().toLowerCase();
    return q
      ? synchronizedDeliveryAreas.filter(area => area.toLowerCase().includes(q))
      : synchronizedDeliveryAreas;
  }, [synchronizedDeliveryAreas, areaSearchQuery]);

  const filteredAreaOptionsForEditModal = useMemo(() => {
    const q = editAreaSearchQuery.trim().toLowerCase();
    return q
      ? synchronizedDeliveryAreas.filter(area => area.toLowerCase().includes(q))
      : synchronizedDeliveryAreas;
  }, [synchronizedDeliveryAreas, editAreaSearchQuery]);

  const openManualModalForDate = (dateIso?: string) => {
    if (!canEditSchedules) return;
    setManualDate(dateIso || selectedDateIso);
    setManualBranchId(effectiveBranchId);
    const defaultAdmin =
      selectedAdmin !== 'SEMUA ADMIN' && salesAdminNames.includes(selectedAdmin)
        ? selectedAdmin
        : salesAdminNames[0] || '';
    setManualAdmin(defaultAdmin);
    setIsManualAdminDropdownOpen(false);
    setManualAttendanceStatus('hadir');
    setManualAbsenceReason('');
    setManualAreaDuties(synchronizedDeliveryAreas[0] ? [synchronizedDeliveryAreas[0]] : []);
    setManualAdditionalDuties([]);
    setAreaSearchQuery('');
    setCustomDutyInput('');
    setManualIsBackupAcc(false);
    setIsManualModalOpen(true);
  };

  const handleOpenEditModal = (item: AdminDailyScheduleItem) => {
    if (!canEditSchedules) return;
    const safeDuties = Array.isArray(item.duties) ? item.duties : [];
    const safeAdd = Array.isArray(item.additionalDuties) ? item.additionalDuties : [];
    const effBranch = item.branchId || effectiveBranchId;
    setEditingSchedule(item);
    setEditBranchId(effBranch);
    setEditAdmin(item.adminName || '');
    setEditAttendanceStatus(item.attendanceStatus || 'hadir');
    setEditAbsenceReason(item.absenceReason || '');
    setEditAreaDuties(
      safeDuties.filter(
        d => typeof d === 'string' && !ADDITIONAL_JOBDESK_OPTIONS.includes(d) && d !== 'Back Up ACC' && !isNonAreaTerm(d)
      )
    );
    setEditAdditionalDuties(
      Array.from(
        new Set([
          ...safeDuties.filter(d => typeof d === 'string' && ADDITIONAL_JOBDESK_OPTIONS.includes(d)),
          ...safeAdd.filter(d => typeof d === 'string')
        ])
      )
    );
    setEditIsBackupAcc(Boolean(item.isBackupAcc));
    setEditCustomDutyInput('');
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
    if (item?.branchId === 'cab-sidoarjo' || item?.branchId === 'cab-banyuwangi') return item.branchId;
    return getAdminBranchId(item?.adminName || '');
  };

  const filteredMonthSchedules = useMemo(() => {
    return (schedules || []).filter(item => {
      if (!item || typeof item !== 'object') return false;
      const dateStr = String(item.date || '');
      const adminStr = String(item.adminName || '');
      const matchMonth = dateStr.startsWith(monthPrefix);
      const matchAdmin =
        selectedAdmin === 'SEMUA ADMIN' ||
        adminStr.toUpperCase() === selectedAdmin.toUpperCase();
      const itemBranch = getScheduleEffectiveBranchId(item);
      const matchBranch = itemBranch === effectiveBranchId;
      return matchMonth && matchAdmin && matchBranch;
    });
  }, [schedules, monthPrefix, selectedAdmin, effectiveBranchId, adminBranchMap]);

  const schedulesByDate = useMemo(() => {
    const map: Record<string, AdminDailyScheduleItem[]> = {};
    filteredMonthSchedules.forEach(item => {
      if (!item?.date) return;
      if (!map[item.date]) map[item.date] = [];
      map[item.date].push(item);
    });
    return map;
  }, [filteredMonthSchedules]);

  const selectedDateSchedules = useMemo(() => {
    return (schedules || []).filter(item => {
      if (!item || typeof item !== 'object') return false;
      const dateStr = String(item.date || '');
      const adminStr = String(item.adminName || '');
      const matchDate = dateStr === selectedDateIso;
      const matchAdmin =
        selectedAdmin === 'SEMUA ADMIN' ||
        adminStr.toUpperCase() === selectedAdmin.toUpperCase();
      const itemBranch = getScheduleEffectiveBranchId(item);
      const matchBranch = itemBranch === effectiveBranchId;
      return matchDate && matchAdmin && matchBranch;
    });
  }, [schedules, selectedDateIso, selectedAdmin, effectiveBranchId, adminBranchMap]);

  // KPI metrics for compact dashboard summary strip
  const kpiStats = useMemo(() => {
    const hadirToday = selectedDateSchedules.filter(
      s => !s.attendanceStatus || s.attendanceStatus === 'hadir'
    );
    const absentToday = selectedDateSchedules.filter(
      s => s.attendanceStatus === 'ijin' || s.attendanceStatus === 'sakit'
    );
    const totalMonthEntries = filteredMonthSchedules.length;
    const hadirMonthCount = filteredMonthSchedules.filter(
      s => !s.attendanceStatus || s.attendanceStatus === 'hadir'
    ).length;
    const absentMonthCount = filteredMonthSchedules.filter(
      s => s.attendanceStatus === 'ijin' || s.attendanceStatus === 'sakit'
    ).length;
    const attendancePercent =
      totalMonthEntries > 0 ? Math.round((hadirMonthCount / totalMonthEntries) * 100) : 0;

    return {
      totalMonthEntries,
      hadirTodayCount: hadirToday.length,
      absentTodayCount: absentToday.length,
      hadirMonthCount,
      absentMonthCount,
      attendancePercent
    };
  }, [filteredMonthSchedules, selectedDateSchedules]);

  const handleSaveManualSchedule = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canEditSchedules || !manualAdmin || !manualDate) return;

    const targetBranch = effectiveBranchId;
    setAdminBranchId(manualAdmin, targetBranch);

    const isAbsent = manualAttendanceStatus === 'ijin' || manualAttendanceStatus === 'sakit';
    const isTargetSidoarjo = targetBranch === 'cab-sidoarjo';
    const fallbackArea = synchronizedDeliveryAreas[0] || (isSidoarjoBranch ? 'SIDOARJO' : 'Muncar Pasar');
    const finalDuties = isAbsent
      ? []
      : manualAreaDuties.length > 0
      ? Array.from(new Set(manualAreaDuties))
      : [fallbackArea];
    const finalAdditionalDuties =
      isAbsent || isTargetSidoarjo
        ? []
        : Array.from(new Set(manualAdditionalDuties.map(d => d.trim()).filter(Boolean)));
    const finalBackupAcc = !isAbsent && !isTargetSidoarjo && manualIsBackupAcc;

    setSchedules(prev => {
      const next = [...prev];
      const existingIdx = next.findIndex(
        item =>
          item.date === manualDate &&
          item.adminName.toUpperCase() === manualAdmin.toUpperCase() &&
          getScheduleEffectiveBranchId(item) === targetBranch
      );

      if (existingIdx >= 0) {
        const existing = next[existingIdx];
        const mergedDuties = isAbsent
          ? []
          : Array.from(new Set([...existing.duties, ...finalDuties]));
        const existingAdd = Array.isArray(existing.additionalDuties) ? existing.additionalDuties : [];
        const mergedAdditionalDuties =
          isAbsent || isTargetSidoarjo
            ? []
            : Array.from(new Set([...existingAdd, ...finalAdditionalDuties]));
        next[existingIdx] = {
          ...existing,
          branchId: targetBranch,
          duties: mergedDuties,
          additionalDuties: mergedAdditionalDuties,
          isBackupAcc: isAbsent || isTargetSidoarjo ? false : Boolean(existing.isBackupAcc || finalBackupAcc),
          attendanceStatus: manualAttendanceStatus,
          absenceReason: isAbsent ? manualAbsenceReason.trim() : undefined
        };
      } else {
        next.push({
          id: 'sch-' + Math.random().toString(36).substring(2, 9),
          date: manualDate,
          adminName: manualAdmin,
          branchId: targetBranch,
          duties: finalDuties,
          additionalDuties: finalAdditionalDuties,
          shiftTime: '08:00 - 16:00',
          isBackupAcc: finalBackupAcc,
          notes: '',
          attendanceStatus: manualAttendanceStatus,
          absenceReason: isAbsent ? manualAbsenceReason.trim() : undefined
        });
      }

      persistAdminSchedulesToServer(next);
      return next;
    });

    setSelectedDateIso(manualDate);
    setIsManualModalOpen(false);
    showToastMessage(`Jadwal penugasan ${manualAdmin} (Cabang ${activeBranchName}) berhasil disimpan.`);
  };

  const handleSaveEditSchedule = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canEditSchedules || !editingSchedule || !editAdmin) return;

    const targetBranch = editBranchId || effectiveBranchId;
    const isTargetSidoarjo = targetBranch === 'cab-sidoarjo';
    setAdminBranchId(editAdmin, targetBranch);

    const isAbsent = editAttendanceStatus === 'ijin' || editAttendanceStatus === 'sakit';
    const finalDuties = isAbsent ? [] : Array.from(new Set(editAreaDuties));
    const finalAdditionalDuties =
      isAbsent || isTargetSidoarjo
        ? []
        : Array.from(new Set(editAdditionalDuties.map(d => d.trim()).filter(Boolean)));
    const finalBackupAcc = !isAbsent && !isTargetSidoarjo && editIsBackupAcc;

    setSchedules(prev => {
      const updatedList = prev.map(item => {
        if (item.id === editingSchedule.id) {
          return {
            ...item,
            branchId: targetBranch,
            adminName: editAdmin,
            duties: finalDuties,
            additionalDuties: finalAdditionalDuties,
            isBackupAcc: finalBackupAcc,
            attendanceStatus: editAttendanceStatus,
            absenceReason: isAbsent ? editAbsenceReason.trim() : undefined
          };
        }
        return item;
      });
      persistAdminSchedulesToServer(updatedList);
      return updatedList;
    });

    setEditingSchedule(null);
    showToastMessage(`Perubahan penugasan ${editAdmin} berhasil diperbarui.`);
  };

  const handleConfirmDeleteSchedule = () => {
    if (!canEditSchedules || !deletingSchedule) return;
    const deletedName = deletingSchedule.adminName;
    setSchedules(prev => {
      const next = prev.filter(item => item.id !== deletingSchedule.id);
      persistAdminSchedulesToServer(next);
      return next;
    });
    setDeletingSchedule(null);
    showToastMessage(`Jadwal penugasan ${deletedName} berhasil dihapus.`);
  };

  const handleConfirmClearBranchMonth = () => {
    if (!canEditSchedules) return;
    setSchedules(prev => {
      const next = prev.filter(item => {
        const isSameBranch = getScheduleEffectiveBranchId(item) === effectiveBranchId;
        const isSameMonth = String(item.date || '').startsWith(monthPrefix);
        return !(isSameBranch && isSameMonth);
      });
      persistAdminSchedulesToServer(next);
      return next;
    });
    setShowClearConfirm(false);
    showToastMessage(`Jadwal Cabang ${activeBranchName} bulan ${selectedMonth} ${selectedYear} berhasil dikosongkan.`);
  };

  const handleExportExcel = () => {
    const rows = filteredMonthSchedules
      .slice()
      .sort((a, b) => (a.date || '').localeCompare(b.date || '') || (a.adminName || '').localeCompare(b.adminName || ''))
      .map((item, idx) => {
        const safeDuties = Array.isArray(item.duties) ? item.duties : [];
        const safeAdd = Array.isArray(item.additionalDuties) ? item.additionalDuties : [];
        const areaDuties = safeDuties.filter(
          d => !ADDITIONAL_JOBDESK_OPTIONS.includes(d) && d !== 'Back Up ACC' && !isNonAreaTerm(d)
        );
        const addDuties = Array.from(
          new Set([
            ...safeDuties.filter(d => ADDITIONAL_JOBDESK_OPTIONS.includes(d)),
            ...safeAdd,
            ...(item.isBackupAcc ? ['Back Up ACC'] : [])
          ])
        );
        const statusLabel =
          item.attendanceStatus === 'ijin'
            ? 'Ijin'
            : item.attendanceStatus === 'sakit'
            ? 'Sakit'
            : 'Hadir';
        const baseRow: Record<string, any> = {
          No: idx + 1,
          Tanggal: item.date,
          Hari: getDayNameFromIso(item.date),
          Cabang: `Cabang ${activeBranchName}`,
          'Admin Penjualan': item.adminName,
          Kehadiran: statusLabel,
          'Area Handling': areaDuties.map(getCompactAreaLabel).join(', ') || '-'
        };
        if (!isSidoarjoBranch) {
          baseRow['Jobdesk Tambahan'] = addDuties.join(', ') || '-';
        }
        baseRow['Keterangan / Alasan'] = item.absenceReason || item.notes || '-';
        return baseRow;
      });

    const emptyRow: Record<string, any> = {
      No: 1,
      Tanggal: selectedDateIso,
      Hari: getDayNameFromIso(selectedDateIso),
      Cabang: `Cabang ${activeBranchName}`,
      'Admin Penjualan': '-',
      Kehadiran: '-',
      'Area Handling': '-'
    };
    if (!isSidoarjoBranch) {
      emptyRow['Jobdesk Tambahan'] = '-';
    }
    emptyRow['Keterangan / Alasan'] = 'Belum ada penugasan pada periode ini';

    const worksheet = XLSX.utils.json_to_sheet(rows.length > 0 ? rows : [emptyRow]);
    worksheet['!cols'] = [
      { wch: 5 },
      { wch: 13 },
      { wch: 11 },
      { wch: 18 },
      { wch: 24 },
      { wch: 12 },
      { wch: 42 },
      ...(isSidoarjoBranch ? [] : [{ wch: 30 }]),
      { wch: 28 }
    ];
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, `Jadwal_${activeBranchName}`);
    XLSX.writeFile(
      workbook,
      `Jadwal_Admin_Penjualan_${activeBranchName}_${selectedMonth}_${selectedYear}.xlsx`
    );
  };

  const daysInMonth = getDaysInMonth(yearNum, monthIndex);
  const firstDayOfWeek = getFirstDayOfMonth(yearNum, monthIndex);
  const todayIso = getTodayIso();

  const toggleManualAreaDuty = (area: string) => {
    setManualAreaDuties(prev =>
      prev.includes(area) ? prev.filter(a => a !== area) : [...prev, area]
    );
  };

  const toggleManualAdditionalDuty = (duty: string) => {
    setManualAdditionalDuties(prev =>
      prev.includes(duty) ? prev.filter(d => d !== duty) : [...prev, duty]
    );
  };

  const toggleEditAreaDuty = (area: string) => {
    setEditAreaDuties(prev =>
      prev.includes(area) ? prev.filter(a => a !== area) : [...prev, area]
    );
  };

  const toggleEditAdditionalDuty = (duty: string) => {
    setEditAdditionalDuties(prev =>
      prev.includes(duty) ? prev.filter(d => d !== duty) : [...prev, duty]
    );
  };

  const addCustomManualDuty = () => {
    const trimmed = customDutyInput.trim();
    if (!trimmed) return;
    if (!manualAdditionalDuties.includes(trimmed)) {
      setManualAdditionalDuties(prev => [...prev, trimmed]);
    }
    setCustomDutyInput('');
  };

  const addCustomEditDuty = () => {
    const trimmed = editCustomDutyInput.trim();
    if (!trimmed) return;
    if (!editAdditionalDuties.includes(trimmed)) {
      setEditAdditionalDuties(prev => [...prev, trimmed]);
    }
    setEditCustomDutyInput('');
  };

  return (
    <div className="space-y-5">
      {/* Page Title & Subtitle */}
      <div>
        <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
          Jadwal &amp; Penugasan Admin Penjualan
        </h1>
        <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
          Kelola jadwal kerja bulanan, rincian jadwal area kirim, jobdesk tambahan harian, dan pemilahan Admin Cabang Nusantara &amp; Sidoarjo.
        </p>
      </div>

      {/* Filter Bar Card (Cabang, Periode Bulan & Tahun, Ekspor to Excel) */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl p-4 sm:p-5 shadow-2xs">
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
          <div className="flex flex-col sm:flex-row sm:items-end gap-4 flex-1">
            {/* Filter Cabang Admin Penjualan */}
            <div className="w-full sm:w-72">
              <label className="block text-[11px] font-extrabold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1.5">
                Filter Cabang Admin Penjualan
              </label>
              <div className="relative">
                <select
                  value={effectiveBranchId}
                  onChange={e => {
                    const nextId = e.target.value;
                    setSelectedBranchId(nextId);
                    branchStore.setActiveBranchId(nextId);
                    setSelectedAdmin('SEMUA ADMIN');
                  }}
                  className="w-full appearance-none px-3.5 py-2.5 pr-9 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500 cursor-pointer"
                >
                  {accessibleBranches.map(b => (
                    <option key={b.id} value={b.id}>
                      Cabang {b.id === 'cab-sidoarjo' ? 'Sidoarjo' : 'Nusantara'}
                    </option>
                  ))}
                </select>
                <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            </div>

            {/* Periode Bulan & Tahun */}
            <div>
              <label className="block text-[11px] font-extrabold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1.5">
                Periode Bulan &amp; Tahun
              </label>
              <div className="flex items-center gap-2.5">
                <div className="relative w-40 sm:w-44">
                  <Calendar className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <select
                    value={selectedMonth}
                    onChange={e => setSelectedMonth(e.target.value)}
                    className="w-full appearance-none pl-9 pr-8 py-2.5 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500 cursor-pointer"
                  >
                    {MONTH_OPTIONS.map(m => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="w-4 h-4 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>

                <div className="relative w-28 sm:w-32">
                  <select
                    value={selectedYear}
                    onChange={e => setSelectedYear(e.target.value)}
                    className="w-full appearance-none px-3.5 pr-8 py-2.5 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500 cursor-pointer tabular-nums"
                  >
                    {['2025', '2026', '2027'].map(y => (
                      <option key={y} value={y}>
                        {y}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="w-4 h-4 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={handleExportExcel}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-xs transition cursor-pointer shrink-0"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>Ekspor to Excel</span>
          </button>
        </div>
      </div>

      {/* Toast Notification */}
      {saveToast && (
        <div className="flex items-center justify-between gap-3 px-4 py-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200 text-xs font-bold shadow-xs animate-in fade-in duration-150">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span>{saveToast}</span>
          </div>
          <button
            type="button"
            onClick={() => setSaveToast(null)}
            className="text-emerald-600 dark:text-emerald-400 hover:opacity-75 cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Monthly Calendar Card */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl p-4 sm:p-5 shadow-2xs space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-100 dark:border-indigo-800/70 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-black text-slate-900 dark:text-white tracking-tight">
                Kalender Jadwal &amp; Penugasan Admin ({selectedMonth} {selectedYear}){' '}
                <span className="font-semibold text-slate-500 dark:text-slate-400">
                  · Cabang {activeBranchName}
                </span>
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Klik tanggal pada kalender untuk melihat dan mengelola rincian jadwal area kirim &amp; jobdesk di tabel bawah.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            {canEditSchedules ? (
              <button
                type="button"
                onClick={() => openManualModalForDate(selectedDateIso)}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-xs transition cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Buat Jadwal</span>
              </button>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 text-xs font-bold border border-slate-200 dark:border-slate-700">
                <Lock className="w-3.5 h-3.5" />
                <span>Hanya Lihat</span>
              </span>
            )}
          </div>
        </div>

        {/* 7-Column Weekday Header */}
        <div className="grid grid-cols-7 gap-2 text-center text-[11px] font-black uppercase tracking-wider">
          <div className="py-2 rounded-xl bg-rose-50/70 dark:bg-rose-950/30 text-rose-600 dark:text-rose-400">
            Minggu
          </div>
          <div className="py-2 rounded-xl bg-slate-50 dark:bg-slate-950/60 text-slate-600 dark:text-slate-300">
            Senin
          </div>
          <div className="py-2 rounded-xl bg-slate-50 dark:bg-slate-950/60 text-slate-600 dark:text-slate-300">
            Selasa
          </div>
          <div className="py-2 rounded-xl bg-slate-50 dark:bg-slate-950/60 text-slate-600 dark:text-slate-300">
            Rabu
          </div>
          <div className="py-2 rounded-xl bg-slate-50 dark:bg-slate-950/60 text-slate-600 dark:text-slate-300">
            Kamis
          </div>
          <div className="py-2 rounded-xl bg-slate-50 dark:bg-slate-950/60 text-slate-600 dark:text-slate-300">
            Jumat
          </div>
          <div className="py-2 rounded-xl bg-slate-50 dark:bg-slate-950/60 text-slate-600 dark:text-slate-300">
            Sabtu
          </div>
        </div>

        {/* Calendar Grid */}
        <div className="grid grid-cols-7 gap-2">
          {Array.from({ length: firstDayOfWeek }).map((_, idx) => (
            <div
              key={`empty-${idx}`}
              className="min-h-[116px] sm:min-h-[126px] rounded-2xl bg-slate-50/40 dark:bg-slate-950/20 border border-dashed border-slate-200/70 dark:border-slate-800/50"
            />
          ))}

          {Array.from({ length: daysInMonth }).map((_, idx) => {
            const dayNum = idx + 1;
            const dateIso = formatDateIso(yearNum, monthIndex, dayNum);
            const daySchedules = schedulesByDate[dateIso] || [];
            const isSelected = dateIso === selectedDateIso;
            const dayOfWeek = (firstDayOfWeek + idx) % 7;
            const isSunday = dayOfWeek === 0;

            return (
              <div
                key={dateIso}
                onClick={() => setSelectedDateIso(dateIso)}
                className={`min-h-[116px] sm:min-h-[126px] p-2.5 rounded-2xl border transition-all cursor-pointer flex flex-col select-none ${
                  isSelected
                    ? 'bg-indigo-50/40 dark:bg-indigo-950/35 border-indigo-500 ring-2 ring-indigo-500/20 shadow-xs z-10'
                    : isSunday
                    ? 'bg-rose-50/20 dark:bg-rose-950/15 border-rose-100/90 dark:border-rose-900/40 hover:border-rose-200'
                    : 'bg-white dark:bg-slate-900 border-slate-200/80 dark:border-slate-800 hover:border-indigo-300 dark:hover:border-indigo-700'
                }`}
              >
                {/* Cell Header */}
                <div className="flex items-center justify-between gap-1 mb-1.5">
                  <span
                    className={`inline-flex items-center justify-center text-xs font-black tabular-nums ${
                      isSelected
                        ? 'w-6 h-6 rounded-lg bg-indigo-600 text-white'
                        : isSunday
                        ? 'text-rose-600 dark:text-rose-400'
                        : 'text-slate-900 dark:text-white'
                    }`}
                  >
                    {dayNum}
                  </span>

                  {daySchedules.length > 0 && (
                    <span className="px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200/80 dark:border-emerald-800/70 tabular-nums">
                      {daySchedules.length} Admin
                    </span>
                  )}
                </div>

                {/* Cell Content (Admin Name + Area Kirim Badge) */}
                {daySchedules.length > 0 && (
                  <div className="space-y-1 overflow-y-auto max-h-[86px] pr-0.5">
                    {daySchedules.map(item => {
                      const isAbsent =
                        item.attendanceStatus === 'ijin' || item.attendanceStatus === 'sakit';
                      const safeDuties = Array.isArray(item.duties) ? item.duties : [];
                      const areaDuties = safeDuties.filter(
                        d =>
                          typeof d === 'string' &&
                          !ADDITIONAL_JOBDESK_OPTIONS.includes(d) &&
                          d !== 'Back Up ACC' &&
                          !isNonAreaTerm(d)
                      );
                      const primaryAreaLabel = isAbsent
                        ? item.attendanceStatus === 'sakit'
                          ? 'Sakit'
                          : 'Ijin'
                        : areaDuties.length > 0
                        ? getCompactAreaLabel(areaDuties[0])
                        : 'Bertugas';

                      return (
                        <div
                          key={item.id}
                          className="flex items-center justify-between gap-1 px-1.5 py-0.5 rounded-md bg-slate-50/90 dark:bg-slate-800/80 border border-slate-200/60 dark:border-slate-700/60 text-[10px] leading-tight"
                          title={`${item.adminName} — ${primaryAreaLabel}`}
                        >
                          <span className="font-black text-slate-800 dark:text-slate-200 truncate max-w-[44%]">
                            {getShortAdminName(item.adminName)}
                          </span>
                          <span
                            className={`px-1.5 py-0.5 rounded font-semibold truncate max-w-[54%] ${
                              isAbsent
                                ? 'bg-rose-50 dark:bg-rose-950/70 text-rose-700 dark:text-rose-300'
                                : 'bg-indigo-50 dark:bg-indigo-950/70 text-indigo-700 dark:text-indigo-300'
                            }`}
                          >
                            {primaryAreaLabel}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Selected Day Detail Table Card (Desain Semula Sesuai Gambar 2) */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl shadow-2xs overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200/80 dark:border-slate-800 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div className="flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-xs shrink-0">
              <ClipboardList className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <h3 className="text-sm sm:text-base font-black text-slate-900 dark:text-white tracking-tight">
                  Rincian Jadwal &amp; Penugasan Admin — {formatReadableDateId(selectedDateIso)}
                </h3>
                <span className="px-2.5 py-0.5 rounded-lg text-xs font-bold bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-300 border border-indigo-200/80 dark:border-indigo-800 tabular-nums">
                  {selectedDateSchedules.length} Admin
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {isSidoarjoBranch
                  ? 'Rincian penugasan harian area kirim faktur dan kehadiran.'
                  : 'Rincian penugasan harian area kirim faktur, jobdesk tambahan, status Back Up ACC, dan kehadiran.'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 tabular-nums">
              <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
              Hadir: {kpiStats.hadirTodayCount}
            </span>

            {!isSidoarjoBranch && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 tabular-nums">
                <ShieldCheck className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400 shrink-0" />
                Back Up ACC:{' '}
                {
                  selectedDateSchedules.filter(
                    s => s.isBackupAcc && s.attendanceStatus !== 'ijin' && s.attendanceStatus !== 'sakit'
                  ).length
                }
              </span>
            )}
          </div>
        </div>

        {selectedDateSchedules.length === 0 ? (
          <div className="px-6 py-10 text-center space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-400 flex items-center justify-center mx-auto">
              <Users className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <p className="text-sm font-bold text-slate-800 dark:text-slate-200">
                Belum ada penugasan admin pada {formatReadableDateId(selectedDateIso)}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto">
                {salesAdminNames.length === 0
                  ? `Belum ada akun Adm. Penjualan yang terpetakan ke Cabang ${activeBranchName} di menu User Manajemen.`
                  : `Gunakan tombol "Buat Jadwal" di atas kalender untuk mengatur jadwal penugasan Admin Penjualan Cabang ${activeBranchName}.`}
              </p>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[780px]">
              <thead>
                <tr className="bg-slate-50/90 dark:bg-slate-950/60 border-b border-slate-200/80 dark:border-slate-800 text-[11px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  <th className="py-3.5 px-4 text-center w-14 border-r border-slate-100 dark:border-slate-800/70">
                    NO
                  </th>
                  <th className="py-3.5 px-5 w-72 border-r border-slate-100 dark:border-slate-800/70">
                    NAMA ADMIN
                  </th>
                  <th className="py-3.5 px-5 w-48 border-r border-slate-100 dark:border-slate-800/70">
                    STATUS &amp; PERAN
                  </th>
                  <th className="py-3.5 px-5 border-r border-slate-100 dark:border-slate-800/70">
                    RINCIAN JADWAL (AREA KIRIM)
                  </th>
                  {!isSidoarjoBranch && (
                    <th
                      className={`py-3.5 px-5 w-80 ${
                        canEditSchedules ? 'border-r border-slate-100 dark:border-slate-800/70' : ''
                      }`}
                    >
                      JOBDESK TAMBAHAN
                    </th>
                  )}
                  {canEditSchedules && <th className="py-3.5 px-4 text-right w-24">AKSI</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80 text-xs">
                {selectedDateSchedules.map((item, idx) => {
                  const safeDuties = Array.isArray(item.duties) ? item.duties : [];
                  const safeAdditional = Array.isArray(item.additionalDuties) ? item.additionalDuties : [];
                  const areaDuties = safeDuties.filter(
                    d =>
                      typeof d === 'string' &&
                      !ADDITIONAL_JOBDESK_OPTIONS.includes(d) &&
                      d !== 'Back Up ACC' &&
                      !isNonAreaTerm(d)
                  );
                  const rowAdditionalDuties = Array.from(
                    new Set([
                      ...safeDuties.filter(d => typeof d === 'string' && ADDITIONAL_JOBDESK_OPTIONS.includes(d)),
                      ...safeAdditional.filter(d => typeof d === 'string' && d.trim() !== '')
                    ])
                  );
                  const isAbsent =
                    item.attendanceStatus === 'ijin' || item.attendanceStatus === 'sakit';
                  const meta = adminMetaMap.get((item.adminName || '').trim().toUpperCase());

                  return (
                    <tr
                      key={item.id}
                      className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors"
                    >
                      {/* NO */}
                      <td className="py-4 px-4 text-center font-bold text-slate-600 dark:text-slate-400 text-xs tabular-nums border-r border-slate-100 dark:border-slate-800/70">
                        {idx + 1}
                      </td>

                      {/* NAMA ADMIN */}
                      <td className="py-4 px-5 border-r border-slate-100 dark:border-slate-800/70">
                        <div className="flex items-center gap-3.5">
                          <div
                            className={`w-10 h-10 rounded-2xl flex items-center justify-center text-xs font-black shrink-0 border ${
                              isAbsent
                                ? 'bg-rose-100/80 dark:bg-rose-950/80 text-rose-600 dark:text-rose-300 border-rose-200/80 dark:border-rose-800'
                                : 'bg-indigo-100/80 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-300 border-indigo-200/80 dark:border-indigo-800'
                            }`}
                          >
                            {getInitials(item.adminName)}
                          </div>
                          <div className="min-w-0">
                            <div className="font-black text-slate-900 dark:text-white uppercase tracking-tight truncate">
                              {item.adminName}
                            </div>
                            <div className="text-[11px] text-slate-500 dark:text-slate-400 font-medium truncate mt-0.5">
                              {meta?.roleLabel || 'Adm. Penjualan'}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* STATUS & PERAN */}
                      <td className="py-4 px-5 border-r border-slate-100 dark:border-slate-800/70">
                        <div className="flex flex-wrap items-center gap-1.5">
                          {item.attendanceStatus === 'sakit' ? (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-300 border border-rose-200 dark:border-rose-800">
                              <span className="w-1.5 h-1.5 rounded-full bg-rose-500 shrink-0" />
                              Sakit
                            </span>
                          ) : item.attendanceStatus === 'ijin' ? (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                              <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />
                              Ijin
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                              Hadir Kerja
                            </span>
                          )}

                          {isAbsent && item.absenceReason && (
                            <span className="text-[11px] text-slate-500 dark:text-slate-400 leading-snug block w-full">
                              {item.absenceReason}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* RINCIAN JADWAL (AREA KIRIM) */}
                      <td className="py-4 px-5 border-r border-slate-100 dark:border-slate-800/70">
                        {isAbsent ? (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-amber-50/60 dark:bg-amber-950/40 text-slate-700 dark:text-amber-200 border border-amber-200/90 dark:border-amber-800">
                            <UserX className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
                            <span>
                              Tidak bertugas ({item.attendanceStatus === 'sakit' ? 'Sakit' : 'Ijin'})
                            </span>
                          </span>
                        ) : areaDuties.length === 0 ? (
                          <span className="text-slate-400 italic">Belum ada area kirim</span>
                        ) : (
                          <div className="flex flex-wrap gap-2">
                            {areaDuties.map(area => (
                              <span
                                key={area}
                                title={area}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-indigo-50/70 dark:bg-indigo-950/50 text-indigo-950 dark:text-indigo-200 border border-indigo-200/80 dark:border-indigo-800/80"
                              >
                                <MapPin className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400 shrink-0" />
                                <span>{getCompactAreaLabel(area)}</span>
                              </span>
                            ))}
                          </div>
                        )}
                      </td>

                      {/* JOBDESK TAMBAHAN (Khusus Non-Sidoarjo / Cabang Nusantara) */}
                      {!isSidoarjoBranch && (
                        <td
                          className={`py-4 px-5 ${
                            canEditSchedules ? 'border-r border-slate-100 dark:border-slate-800/70' : ''
                          }`}
                        >
                          {isAbsent ? (
                            <span className="text-slate-400 font-bold">—</span>
                          ) : rowAdditionalDuties.length === 0 ? (
                            <span className="text-xs italic text-slate-400 dark:text-slate-500">
                              Tidak ada jobdesk tambahan
                            </span>
                          ) : (
                            <div className="flex flex-wrap gap-2">
                              {rowAdditionalDuties.map(duty => (
                                <span
                                  key={duty}
                                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-amber-50/70 dark:bg-amber-950/50 text-amber-900 dark:text-amber-200 border border-amber-200/90 dark:border-amber-800/80"
                                >
                                  <Briefcase className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
                                  <span>{duty}</span>
                                </span>
                              ))}
                            </div>
                          )}
                        </td>
                      )}

                      {/* AKSI */}
                      {canEditSchedules && (
                        <td className="py-4 px-4 text-right">
                          <div className="inline-flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => handleOpenEditModal(item)}
                              className="p-1.5 rounded-lg text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/50 transition cursor-pointer"
                              title="Edit Penugasan"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setDeletingSchedule(item)}
                              className="p-1.5 rounded-lg text-slate-500 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/50 transition cursor-pointer"
                              title="Hapus Penugasan"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal: Buat Jadwal Manual */}
      {isManualModalOpen && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-xl shadow-2xl flex flex-col max-h-[88vh] overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-xs shrink-0">
                  <Plus className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900 dark:text-white">
                    Buat Jadwal Penugasan Admin
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Cabang {activeBranchName}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsManualModalOpen(false)}
                className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 flex items-center justify-center transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Form Body */}
            <form onSubmit={handleSaveManualSchedule} className="flex flex-col flex-1 overflow-hidden">
              <div className="p-5 space-y-4 overflow-y-auto flex-1">
                {/* Date & Admin Row */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <InlineDatePickerField
                    label="Tanggal Penugasan *"
                    value={manualDate}
                    onChange={setManualDate}
                  />

                  {/* Branch-Scoped User Management Admin Dropdown */}
                  <div className="relative">
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-1.5">
                      Admin Penjualan (Cabang {activeBranchName}) *
                    </label>
                    <button
                      type="button"
                      onClick={() => setIsManualAdminDropdownOpen(prev => !prev)}
                      className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-950 hover:bg-slate-100/80 dark:hover:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-900 dark:text-white flex items-center justify-between gap-2 transition cursor-pointer"
                    >
                      <span className="truncate">
                        {manualAdmin || (salesAdminNames.length === 0 ? 'Belum ada akun Adm. Penjualan' : 'Pilih Admin...')}
                      </span>
                      <ChevronDown className={`w-4 h-4 text-slate-400 shrink-0 transition-transform ${isManualAdminDropdownOpen ? 'rotate-180 text-indigo-500' : ''}`} />
                    </button>

                    {isManualAdminDropdownOpen && (
                      <div className="absolute left-0 right-0 mt-1.5 z-50 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-2xl max-h-56 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
                        {salesAdminUsers.length === 0 ? (
                          <div className="p-3 text-xs text-slate-500 dark:text-slate-400 text-center">
                            Belum ada akun Adm. Penjualan untuk Cabang {activeBranchName} di User Manajemen.
                          </div>
                        ) : (
                          salesAdminUsers.map(u => {
                            const nameUpper = (u.fullName || '').trim().toUpperCase();
                            const isSel = manualAdmin === nameUpper;
                            return (
                              <button
                                key={u.id}
                                type="button"
                                onClick={() => {
                                  setManualAdmin(nameUpper);
                                  setIsManualAdminDropdownOpen(false);
                                }}
                                className={`w-full px-3 py-2.5 text-left flex items-center justify-between gap-2 transition cursor-pointer ${
                                  isSel
                                    ? 'bg-indigo-50 dark:bg-indigo-500/20 text-indigo-700 dark:text-indigo-300'
                                    : 'hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200'
                                }`}
                              >
                                <div className="min-w-0">
                                  <div className="text-xs font-bold truncate">{nameUpper}</div>
                                  <div className="text-[10px] text-slate-500 dark:text-slate-400 truncate">
                                    {getUserRoleDisplayTitle(u.role) || 'Adm. Penjualan'} · Cabang {activeBranchName}
                                  </div>
                                </div>
                                {isSel && <Check className="w-4 h-4 text-indigo-600 shrink-0" />}
                              </button>
                            );
                          })
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {salesAdminUsers.length === 0 && (
                  <div className="flex items-start gap-2.5 p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-200 text-xs">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>
                      Belum ada user dengan role <strong>Adm. Penjualan / SPV Adm Penjualan</strong> yang memiliki akses ke <strong>Cabang {activeBranchName}</strong> pada menu User Manajemen.
                    </span>
                  </div>
                )}

                {/* Segmented Attendance Status */}
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-1.5">
                    Status Kehadiran
                  </label>
                  <div className="grid grid-cols-3 gap-2 p-1 rounded-xl bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                    {(
                      [
                        { id: 'hadir', label: 'Hadir', activeClass: 'bg-white dark:bg-slate-800 text-emerald-700 dark:text-emerald-300 shadow-xs' },
                        { id: 'ijin', label: 'Ijin', activeClass: 'bg-white dark:bg-slate-800 text-amber-700 dark:text-amber-300 shadow-xs' },
                        { id: 'sakit', label: 'Sakit', activeClass: 'bg-white dark:bg-slate-800 text-rose-700 dark:text-rose-300 shadow-xs' }
                      ] as const
                    ).map(opt => (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => setManualAttendanceStatus(opt.id)}
                        className={`py-2 rounded-lg text-xs font-bold transition cursor-pointer ${
                          manualAttendanceStatus === opt.id
                            ? opt.activeClass
                            : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                {manualAttendanceStatus !== 'hadir' ? (
                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-1.5">
                      Alasan / Keterangan {manualAttendanceStatus === 'sakit' ? 'Sakit' : 'Ijin'}
                    </label>
                    <input
                      type="text"
                      value={manualAbsenceReason}
                      onChange={e => setManualAbsenceReason(e.target.value)}
                      placeholder="Contoh: Keperluan keluarga / Surat keterangan dokter..."
                      className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                ) : (
                  <>
                    {/* Area Handling (Synced with Branch Official Areas) */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <label className="text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">
                          Area Handling ({manualAreaDuties.length} Dipilih)
                        </label>
                        <div className="flex items-center gap-2 text-[11px] font-bold">
                          <button
                            type="button"
                            onClick={() => setManualAreaDuties([...synchronizedDeliveryAreas])}
                            className="text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
                          >
                            Pilih Semua
                          </button>
                          <span className="text-slate-300 dark:text-slate-700">|</span>
                          <button
                            type="button"
                            onClick={() => setManualAreaDuties([])}
                            className="text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 cursor-pointer"
                          >
                            Reset
                          </button>
                        </div>
                      </div>

                      <div className="relative">
                        <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                        <input
                          type="text"
                          value={areaSearchQuery}
                          onChange={e => setAreaSearchQuery(e.target.value)}
                          placeholder={
                            isSidoarjoBranch
                              ? 'Cari area handling (BLIKETUT, PONOMADI, SURABAYA, MALANG...)'
                              : 'Cari area handling Cabang Nusantara...'
                          }
                          className="w-full pl-8 pr-8 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500"
                        />
                        {areaSearchQuery && (
                          <button
                            type="button"
                            onClick={() => setAreaSearchQuery('')}
                            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>

                      <div className="max-h-56 overflow-y-auto p-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                        {filteredAreaOptionsForModal.map(area => {
                          const checked = manualAreaDuties.includes(area);
                          return (
                            <button
                              key={area}
                              type="button"
                              onClick={() => toggleManualAreaDuty(area)}
                              className={`flex items-center justify-between gap-2 px-2.5 py-2 rounded-lg text-left text-xs border transition cursor-pointer ${
                                checked
                                  ? 'bg-indigo-50 dark:bg-indigo-950/60 border-indigo-400 dark:border-indigo-600 text-indigo-800 dark:text-indigo-200 font-bold'
                                  : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-700 font-medium'
                              }`}
                            >
                              <span className="truncate" title={area}>{area}</span>
                              {checked && <Check className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400 shrink-0" />}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Jobdesk Tambahan (Khusus Cabang Nusantara; disembunyikan untuk Cabang Sidoarjo) */}
                    {!isSidoarjoBranch && (
                      <div className="space-y-2.5 pt-2 border-t border-slate-200 dark:border-slate-800">
                        <div className="flex items-center justify-between gap-2">
                          <label className="text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">
                            Jobdesk Tambahan ({manualAdditionalDuties.length} Dipilih)
                          </label>
                          <div className="flex items-center gap-2 text-[11px] font-bold">
                            <button
                              type="button"
                              onClick={() =>
                                setManualAdditionalDuties(prev =>
                                  Array.from(new Set([...prev, ...ADDITIONAL_JOBDESK_OPTIONS]))
                                )
                              }
                              className="text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
                            >
                              Pilih Semua
                            </button>
                            <span className="text-slate-300 dark:text-slate-700">|</span>
                            <button
                              type="button"
                              onClick={() => {
                                setManualAdditionalDuties([]);
                                setManualIsBackupAcc(false);
                              }}
                              className="text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 cursor-pointer"
                            >
                              Reset
                            </button>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                          {Array.from(new Set([...ADDITIONAL_JOBDESK_OPTIONS, ...manualAdditionalDuties])).map(duty => {
                            const checked = manualAdditionalDuties.includes(duty);
                            return (
                              <button
                                key={duty}
                                type="button"
                                onClick={() => toggleManualAdditionalDuty(duty)}
                                className={`flex items-center justify-between gap-1.5 px-2.5 py-2 rounded-lg text-left text-xs border transition cursor-pointer ${
                                  checked
                                    ? 'bg-indigo-50 dark:bg-indigo-950/60 border-indigo-400 dark:border-indigo-600 text-indigo-800 dark:text-indigo-200 font-bold'
                                    : 'bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-700 font-medium'
                                }`}
                              >
                                <span className="truncate" title={duty}>{duty}</span>
                                {checked && <Check className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400 shrink-0" />}
                              </button>
                            );
                          })}
                        </div>

                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            value={customDutyInput}
                            onChange={e => setCustomDutyInput(e.target.value)}
                            onKeyDown={e => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                addCustomManualDuty();
                              }
                            }}
                            placeholder="Tambah jobdesk tambahan lainnya..."
                            className="flex-1 px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500"
                          />
                          <button
                            type="button"
                            onClick={addCustomManualDuty}
                            disabled={!customDutyInput.trim()}
                            className="px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-indigo-600 hover:text-white disabled:opacity-40 text-slate-700 dark:text-slate-200 text-xs font-bold transition cursor-pointer shrink-0"
                          >
                            + Tambah
                          </button>
                        </div>

                        <button
                          type="button"
                          onClick={() => setManualIsBackupAcc(prev => !prev)}
                          className={`w-full flex items-center justify-between px-3 py-2 rounded-xl border text-xs font-bold transition cursor-pointer ${
                            manualIsBackupAcc
                              ? 'bg-amber-50 dark:bg-amber-950/50 border-amber-400 dark:border-amber-600 text-amber-800 dark:text-amber-200'
                              : 'bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:border-slate-300'
                          }`}
                        >
                          <span>Status Back Up ACC</span>
                          <span className="inline-flex items-center gap-1.5">
                            {manualIsBackupAcc ? 'Aktif (Back Up ACC)' : 'Tidak'}
                            {manualIsBackupAcc && <Check className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />}
                          </span>
                        </button>
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* Modal Footer */}
              <div className="px-5 py-3.5 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end gap-2 bg-slate-50/70 dark:bg-slate-950/40 shrink-0">
                <button
                  type="button"
                  onClick={() => setIsManualModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold hover:bg-slate-100 dark:hover:bg-slate-700 transition cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={!manualAdmin}
                  className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-bold shadow-xs transition cursor-pointer"
                >
                  Simpan Penugasan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Edit Penugasan Admin */}
      {editingSchedule && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-xl shadow-2xl flex flex-col max-h-[88vh] overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-indigo-600 text-white flex items-center justify-center shrink-0">
                  <Pencil className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900 dark:text-white">
                    Edit Penugasan Admin
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {formatReadableDateId(editingSchedule.date)} · Cabang {activeBranchName}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEditingSchedule(null)}
                className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 flex items-center justify-center transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveEditSchedule} className="flex flex-col flex-1 overflow-hidden">
              <div className="p-5 space-y-4 overflow-y-auto flex-1">
                {/* Admin Selector */}
                <div className="relative">
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-1.5">
                    Admin Penjualan (Cabang {activeBranchName}) *
                  </label>
                  <button
                    type="button"
                    onClick={() => setIsEditAdminDropdownOpen(prev => !prev)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-900 dark:text-white flex items-center justify-between gap-2 cursor-pointer"
                  >
                    <span className="truncate">{editAdmin}</span>
                    <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${isEditAdminDropdownOpen ? 'rotate-180 text-indigo-500' : ''}`} />
                  </button>
                  {isEditAdminDropdownOpen && (
                    <div className="absolute left-0 right-0 mt-1.5 z-50 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-2xl max-h-52 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
                      {salesAdminUsers.map(u => {
                        const nameUpper = (u.fullName || '').trim().toUpperCase();
                        const isSel = editAdmin === nameUpper;
                        return (
                          <button
                            key={u.id}
                            type="button"
                            onClick={() => {
                              setEditAdmin(nameUpper);
                              setIsEditAdminDropdownOpen(false);
                            }}
                            className={`w-full px-3 py-2.5 text-left flex items-center justify-between gap-2 text-xs font-bold transition cursor-pointer ${
                              isSel
                                ? 'bg-indigo-50 dark:bg-indigo-500/20 text-indigo-700 dark:text-indigo-300'
                                : 'hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200'
                            }`}
                          >
                            <span>{nameUpper}</span>
                            {isSel && <Check className="w-4 h-4 text-indigo-600 shrink-0" />}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Attendance Status */}
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-1.5">
                    Status Kehadiran
                  </label>
                  <div className="grid grid-cols-3 gap-2 p-1 rounded-xl bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                    {(
                      [
                        { id: 'hadir', label: 'Hadir', activeClass: 'bg-white dark:bg-slate-800 text-emerald-700 dark:text-emerald-300 shadow-xs' },
                        { id: 'ijin', label: 'Ijin', activeClass: 'bg-white dark:bg-slate-800 text-amber-700 dark:text-amber-300 shadow-xs' },
                        { id: 'sakit', label: 'Sakit', activeClass: 'bg-white dark:bg-slate-800 text-rose-700 dark:text-rose-300 shadow-xs' }
                      ] as const
                    ).map(opt => (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => setEditAttendanceStatus(opt.id)}
                        className={`py-2 rounded-lg text-xs font-bold transition cursor-pointer ${
                          editAttendanceStatus === opt.id
                            ? opt.activeClass
                            : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                {editAttendanceStatus !== 'hadir' ? (
                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-1.5">
                      Alasan / Keterangan {editAttendanceStatus === 'sakit' ? 'Sakit' : 'Ijin'}
                    </label>
                    <input
                      type="text"
                      value={editAbsenceReason}
                      onChange={e => setEditAbsenceReason(e.target.value)}
                      placeholder="Masukkan keterangan..."
                      className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                ) : (
                  <>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <label className="text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">
                          Area Handling ({editAreaDuties.length} Dipilih)
                        </label>
                        <button
                          type="button"
                          onClick={() => setEditAreaDuties([])}
                          className="text-[11px] font-bold text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 cursor-pointer"
                        >
                          Reset
                        </button>
                      </div>

                      <div className="relative">
                        <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                        <input
                          type="text"
                          value={editAreaSearchQuery}
                          onChange={e => setEditAreaSearchQuery(e.target.value)}
                          placeholder="Cari area handling..."
                          className="w-full pl-8 pr-8 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500"
                        />
                      </div>

                      <div className="max-h-56 overflow-y-auto p-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                        {filteredAreaOptionsForEditModal.map(area => {
                          const checked = editAreaDuties.includes(area);
                          return (
                            <button
                              key={area}
                              type="button"
                              onClick={() => toggleEditAreaDuty(area)}
                              className={`flex items-center justify-between gap-2 px-2.5 py-2 rounded-lg text-left text-xs border transition cursor-pointer ${
                                checked
                                  ? 'bg-indigo-50 dark:bg-indigo-950/60 border-indigo-400 dark:border-indigo-600 text-indigo-800 dark:text-indigo-200 font-bold'
                                  : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:border-slate-300 font-medium'
                              }`}
                            >
                              <span className="truncate" title={area}>{area}</span>
                              {checked && <Check className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400 shrink-0" />}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Jobdesk Tambahan (Khusus Cabang Nusantara; disembunyikan untuk Cabang Sidoarjo) */}
                    {(editBranchId || effectiveBranchId) !== 'cab-sidoarjo' && (
                      <div className="space-y-2.5 pt-2 border-t border-slate-200 dark:border-slate-800">
                        <div className="flex items-center justify-between gap-2">
                          <label className="text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">
                            Jobdesk Tambahan ({editAdditionalDuties.length} Dipilih)
                          </label>
                          <div className="flex items-center gap-2 text-[11px] font-bold">
                            <button
                              type="button"
                              onClick={() =>
                                setEditAdditionalDuties(prev =>
                                  Array.from(new Set([...prev, ...ADDITIONAL_JOBDESK_OPTIONS]))
                                )
                              }
                              className="text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
                            >
                              Pilih Semua
                            </button>
                            <span className="text-slate-300 dark:text-slate-700">|</span>
                            <button
                              type="button"
                              onClick={() => {
                                setEditAdditionalDuties([]);
                                setEditIsBackupAcc(false);
                              }}
                              className="text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 cursor-pointer"
                            >
                              Reset
                            </button>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                          {Array.from(new Set([...ADDITIONAL_JOBDESK_OPTIONS, ...editAdditionalDuties])).map(duty => {
                            const checked = editAdditionalDuties.includes(duty);
                            return (
                              <button
                                key={duty}
                                type="button"
                                onClick={() => toggleEditAdditionalDuty(duty)}
                                className={`flex items-center justify-between gap-1.5 px-2.5 py-2 rounded-lg text-left text-xs border transition cursor-pointer ${
                                  checked
                                    ? 'bg-indigo-50 dark:bg-indigo-950/60 border-indigo-400 dark:border-indigo-600 text-indigo-800 dark:text-indigo-200 font-bold'
                                    : 'bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-700 font-medium'
                                }`}
                              >
                                <span className="truncate" title={duty}>{duty}</span>
                                {checked && <Check className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400 shrink-0" />}
                              </button>
                            );
                          })}
                        </div>

                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            value={editCustomDutyInput}
                            onChange={e => setEditCustomDutyInput(e.target.value)}
                            onKeyDown={e => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                addCustomEditDuty();
                              }
                            }}
                            placeholder="Tambah jobdesk tambahan lainnya..."
                            className="flex-1 px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500"
                          />
                          <button
                            type="button"
                            onClick={addCustomEditDuty}
                            disabled={!editCustomDutyInput.trim()}
                            className="px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-indigo-600 hover:text-white disabled:opacity-40 text-slate-700 dark:text-slate-200 text-xs font-bold transition cursor-pointer shrink-0"
                          >
                            + Tambah
                          </button>
                        </div>

                        <button
                          type="button"
                          onClick={() => setEditIsBackupAcc(prev => !prev)}
                          className={`w-full flex items-center justify-between px-3 py-2 rounded-xl border text-xs font-bold transition cursor-pointer ${
                            editIsBackupAcc
                              ? 'bg-amber-50 dark:bg-amber-950/50 border-amber-400 dark:border-amber-600 text-amber-800 dark:text-amber-200'
                              : 'bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:border-slate-300'
                          }`}
                        >
                          <span>Status Back Up ACC</span>
                          <span className="inline-flex items-center gap-1.5">
                            {editIsBackupAcc ? 'Aktif (Back Up ACC)' : 'Tidak'}
                            {editIsBackupAcc && <Check className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />}
                          </span>
                        </button>
                      </div>
                    )}
                  </>
                )}
              </div>

              <div className="px-5 py-3.5 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end gap-2 bg-slate-50/70 dark:bg-slate-950/40 shrink-0">
                <button
                  type="button"
                  onClick={() => setEditingSchedule(null)}
                  className="px-4 py-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold hover:bg-slate-100 dark:hover:bg-slate-700 transition cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-xs transition cursor-pointer"
                >
                  Simpan Perubahan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Konfirmasi Hapus 1 Penugasan */}
      {deletingSchedule && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-100 dark:bg-rose-950/70 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-black text-slate-900 dark:text-white">
                  Hapus Penugasan Admin?
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                  Jadwal penugasan <strong>{deletingSchedule.adminName}</strong> pada{' '}
                  <strong>{formatReadableDateId(deletingSchedule.date)}</strong> akan dihapus dari database.
                </p>
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setDeletingSchedule(null)}
                className="px-3.5 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-bold hover:bg-slate-200 dark:hover:bg-slate-700 cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteSchedule}
                className="px-3.5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold shadow-xs cursor-pointer"
              >
                Ya, Hapus
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Konfirmasi Kosongkan Bulan Ini (Cabang Aktif Saja) */}
      {showClearConfirm && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-100 dark:bg-rose-950/70 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0">
                <AlertCircle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-black text-slate-900 dark:text-white">
                  Kosongkan Jadwal Bulan Ini?
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                  Semua penugasan Admin Penjualan untuk <strong>Cabang {activeBranchName}</strong> pada periode{' '}
                  <strong>{selectedMonth} {selectedYear}</strong> akan dihapus. Data cabang lain tidak terpengaruh.
                </p>
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setShowClearConfirm(false)}
                className="px-3.5 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-bold hover:bg-slate-200 dark:hover:bg-slate-700 cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleConfirmClearBranchMonth}
                className="px-3.5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold shadow-xs cursor-pointer"
              >
                Ya, Kosongkan
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
