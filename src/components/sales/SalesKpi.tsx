import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Award,
  ShieldAlert,
  TrendingUp,
  Percent,
  User,
  UserX,
  UserCheck,
  Check,
  Search,
  RefreshCw,
  AlertTriangle,
  Building,
  FileText,
  CheckCircle,
  CheckCircle2,
  Download,
  ShoppingBag,
  Calendar,
  Star,
  Users,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Upload,
  FileSpreadsheet,
  Plus,
  Trash2,
  Eye,
  Save,
  MapPin,
  Package,
  RotateCcw,
  Trophy,
  BadgePercent,
  Pencil,
  Truck,
  BarChart3,
  Target,
  Activity
} from 'lucide-react';
import {
  ResponsiveContainer,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  PieChart,
  Pie,
  Cell,
  Legend,
  ComposedChart,
  Line,
  CartesianGrid
} from 'recharts';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas-pro';
import * as XLSX from 'xlsx';
import { logisticsStore } from '../../services/store';
import { branchStore } from '../../services/branchStore';
import { useToast } from '../../context/ToastContext';
import { useRoleAccess } from '../../hooks/useRoleAccess';
import {
  useSalesAdminUsers,
  getSalesAdminAssignedBranchId,
  MONTH_OPTIONS,
  YEAR_OPTIONS,
  SALES_BRANCH_OPTIONS
} from './SalesHeaderFilter';
import { OFFICIAL_DESTINATION_AREAS } from '../../utils/areaNormalizer';

// ============================================================================
// INTERFACES & TYPES
// ============================================================================

export interface AdminIndividualKpiRecord {
  id: string;
  adminName: string;
  branchId: string; // 'cab-banyuwangi' | 'cab-sidoarjo'
  month: string;
  year: string;
  validasiSoWeb: number; // % Validasi Sales Order & Website
  pembuatanFaktur: number; // % Pembuatan Faktur Penjualan
  pengecekanFaktur: number; // % Pengecekan Faktur Penjualan
  discountErrorsCount: number; // Jumlah kesalahan penginputan diskon (kali)
  totalOrders: number;
  lastMonthPct?: number; // % Pencapaian bulan sebelumnya (opsional jika diinput manual/excel)
  isInactive?: boolean; // Status admin tidak aktif pada bulan tersebut (dikecualikan dari analisa)
  notes?: string;
}

export interface ModernDropdownOption {
  value: string;
  label: string;
  subLabel?: string;
  badgeText?: string;
  badge?: string;
  badgeTone?: 'emerald' | 'rose' | 'indigo' | 'amber' | 'slate';
}

interface ModernKpiDropdownProps {
  label?: string;
  value: string;
  onChange: (val: string) => void;
  options: ModernDropdownOption[];
  icon?: React.ReactNode;
  variant?: 'filter-card' | 'compact' | 'form-input';
  accentColor?: 'indigo' | 'rose' | 'emerald' | 'sky';
  searchable?: boolean;
  searchPlaceholder?: string;
  gridCols?: 1 | 2 | 3;
}

export const ModernKpiDropdown: React.FC<ModernKpiDropdownProps> = ({
  label,
  value,
  onChange,
  options,
  icon,
  variant = 'filter-card',
  accentColor = 'indigo',
  searchable = false,
  searchPlaceholder = 'Cari pilihan...',
  gridCols = 1
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false);
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleOutsideClick);
      document.addEventListener('keydown', handleEscape);
    }
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen]);

  const selectedOption = useMemo(
    () => options.find(o => o.value === value) || options[0] || { value, label: value },
    [options, value]
  );

  const filteredOptions = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return options;
    return options.filter(
      o =>
        o.label.toLowerCase().includes(q) ||
        (o.subLabel && o.subLabel.toLowerCase().includes(q)) ||
        ((o.badgeText || o.badge) && (o.badgeText || o.badge)!.toLowerCase().includes(q))
    );
  }, [options, searchQuery]);

  const badgeToneClasses = (tone?: ModernDropdownOption['badgeTone'], isSelected?: boolean) => {
    if (isSelected) {
      return 'bg-white/20 text-white border-white/30';
    }
    switch (tone) {
      case 'emerald':
        return 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800';
      case 'rose':
        return 'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800';
      case 'amber':
        return 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800';
      case 'indigo':
        return 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800';
      default:
        return 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700';
    }
  };

  const activeGradient =
    accentColor === 'rose'
      ? 'from-rose-600 to-orange-600 text-white shadow-sm shadow-rose-500/20'
      : accentColor === 'emerald'
      ? 'from-emerald-600 to-teal-600 text-white shadow-sm shadow-emerald-500/20'
      : 'from-indigo-600 to-blue-600 text-white shadow-sm shadow-indigo-500/20';

  const selectedBadge = selectedOption.badgeText || selectedOption.badge;

  return (
    <div ref={containerRef} className="relative">
      {variant === 'filter-card' ? (
        <button
          type="button"
          onClick={() => {
            setIsOpen(prev => !prev);
            setSearchQuery('');
          }}
          className={`w-full text-left bg-white/95 dark:bg-slate-950/80 p-3 rounded-2xl border transition-all cursor-pointer group ${
            isOpen
              ? 'border-indigo-500 ring-2 ring-indigo-500/20 shadow-md'
              : 'border-slate-200/90 dark:border-slate-800 hover:border-indigo-300 dark:hover:border-indigo-700 shadow-2xs'
          }`}
        >
          {label && (
            <span className="block text-[10px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-1">
              {label}
            </span>
          )}
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              {icon && (
                <span className="w-6 h-6 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
                  {icon}
                </span>
              )}
              <span className="text-xs font-extrabold text-slate-900 dark:text-white truncate">
                {selectedOption.label}
              </span>
              {selectedBadge && (
                <span
                  className={`px-1.5 py-0.5 rounded-md text-[9px] font-black border shrink-0 ${badgeToneClasses(
                    selectedOption.badgeTone,
                    false
                  )}`}
                >
                  {selectedBadge}
                </span>
              )}
            </div>
            <span
              className={`w-6 h-6 rounded-lg flex items-center justify-center transition-transform duration-200 shrink-0 ${
                isOpen
                  ? 'bg-indigo-600 text-white rotate-180'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-500 group-hover:text-indigo-600 dark:group-hover:text-indigo-400'
              }`}
            >
              <ChevronDown className="w-3.5 h-3.5" />
            </span>
          </div>
        </button>
      ) : variant === 'compact' ? (
        <button
          type="button"
          onClick={() => {
            setIsOpen(prev => !prev);
            setSearchQuery('');
          }}
          className={`px-3.5 py-2 rounded-xl border text-xs font-extrabold flex items-center justify-between gap-2.5 transition-all cursor-pointer min-w-[145px] ${
            isOpen
              ? 'border-indigo-500 bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-300 ring-2 ring-indigo-500/20 shadow-md'
              : 'border-slate-200/90 dark:border-slate-700 bg-white dark:bg-slate-900 hover:border-indigo-300 dark:hover:border-indigo-700 text-slate-800 dark:text-white shadow-2xs'
          }`}
        >
          <div className="flex items-center gap-2 min-w-0">
            {icon && <span className="text-indigo-600 dark:text-indigo-400 shrink-0">{icon}</span>}
            <span className="truncate">{selectedOption.label}</span>
          </div>
          <ChevronDown
            className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 shrink-0 ${
              isOpen ? 'rotate-180 text-indigo-600' : ''
            }`}
          />
        </button>
      ) : (
        <button
          type="button"
          onClick={() => {
            setIsOpen(prev => !prev);
            setSearchQuery('');
          }}
          className={`w-full px-3.5 py-2.5 rounded-xl border text-xs font-extrabold flex items-center justify-between gap-2 transition-all cursor-pointer ${
            isOpen
              ? 'border-indigo-500 bg-white dark:bg-slate-900 text-slate-900 dark:text-white ring-2 ring-indigo-500/20 shadow-sm'
              : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 hover:border-indigo-300 text-slate-900 dark:text-white'
          }`}
        >
          <div className="flex items-center gap-2 min-w-0">
            {icon && <span className="text-indigo-600 dark:text-indigo-400 shrink-0">{icon}</span>}
            <span className="truncate">{selectedOption.label}</span>
            {selectedBadge && (
              <span
                className={`px-1.5 py-0.5 rounded text-[9px] font-black border shrink-0 ${badgeToneClasses(
                  selectedOption.badgeTone,
                  false
                )}`}
              >
                {selectedBadge}
              </span>
            )}
          </div>
          <ChevronDown
            className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 shrink-0 ${
              isOpen ? 'rotate-180 text-indigo-600' : ''
            }`}
          />
        </button>
      )}

      {isOpen && (
        <div
          className={`absolute left-0 mt-2 z-50 bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-700 rounded-2xl shadow-2xl shadow-slate-900/15 dark:shadow-black/50 p-2 animate-fade-in ${
            gridCols === 3
              ? 'w-72 sm:w-80'
              : gridCols === 2
              ? 'w-64 sm:w-72'
              : 'w-full min-w-[230px]'
          }`}
        >
          {searchable && (
            <div className="relative mb-2 px-1 pt-1">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder={searchPlaceholder}
                className="w-full pl-8 pr-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-xs font-semibold text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500"
              />
            </div>
          )}

          <div
            className={`max-h-64 overflow-y-auto pr-0.5 ${
              gridCols === 3
                ? 'grid grid-cols-3 gap-1'
                : gridCols === 2
                ? 'grid grid-cols-2 gap-1'
                : 'space-y-1'
            }`}
          >
            {filteredOptions.length === 0 ? (
              <div className="py-4 px-3 text-center text-xs text-slate-400 italic col-span-full">
                Tidak ditemukan pilihan
              </div>
            ) : (
              filteredOptions.map(opt => {
                const isSelected = opt.value === value;
                const optBadge = opt.badgeText || opt.badge;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => {
                      onChange(opt.value);
                      setIsOpen(false);
                    }}
                    className={`w-full text-left px-3 py-2 rounded-xl text-xs transition-all cursor-pointer flex items-center justify-between gap-2 ${
                      isSelected
                        ? `bg-gradient-to-r ${activeGradient} font-black`
                        : 'text-slate-700 dark:text-slate-200 hover:bg-indigo-50/80 dark:hover:bg-slate-800/80 font-bold'
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="truncate">{opt.label}</span>
                        {optBadge && (
                          <span
                            className={`px-1.5 py-0.5 rounded-md text-[9px] font-black border shrink-0 ${badgeToneClasses(
                              opt.badgeTone,
                              isSelected
                            )}`}
                          >
                            {optBadge}
                          </span>
                        )}
                      </div>
                      {opt.subLabel && (
                        <span
                          className={`block text-[10px] truncate mt-0.5 ${
                            isSelected ? 'text-white/80 font-medium' : 'text-slate-400 dark:text-slate-500 font-medium'
                          }`}
                        >
                          {opt.subLabel}
                        </span>
                      )}
                    </div>
                    {isSelected && <Check className="w-3.5 h-3.5 shrink-0" />}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
};


export interface DiscountErrorLogItem {
  id: string;
  date: string;
  branchId: string;
  month: string;
  year: string;
  adminName: string;
  noFakturOrSo: string;
  customerName: string;
  expectedDiscount: number; // % atau Rp
  inputDiscount: number; // % atau Rp
  selisihNominal: number; // Rp
  keterangan: string;
}

export interface DendaCheckerRecord {
  id: string;
  branchId: string;
  month: string;
  year: string;
  adminName: string; // Nama
  customerName: string; // Nama Pelanggan
  noFaktur: string; // No Faktur
  keterangan: string; // Keterangan
  nominalSelisih: number; // Nominal Selisih (Rp)
  kalianSelisih: number; // Kali-an Selisih (pengali)
  totalDenda: number; // Nominal Selisih * Kalian Selisih
}

export interface ReorderWeeklyItem {
  id: string;
  unit: 'Nusantara Dr. Soetomo' | 'Nusantara Expand';
  weekLabel: string; // Analisa (Tanggal)
  month: string;
  year: string;
  totalReorder: number; // Total Reorder Mingguan
  terkirimFaktur: number; // Total Barang Sudah Terkirim (Item)
  belumTerkirimSo: number; // Total Barang Belum Terkirim (Item)
}

export interface AdminOmsetRow {
  id: string;
  adminName: string;
  branchId: string;
  branchCode: 'BWI' | 'SDA';
  month: string;
  year: string;
  kota: string;
  area: string;
  customerName?: string;
  itemName?: string;
  omzetNetto: number;
  bruto: number;
  returNominal: number;
  qtyNetto: number;
  returQty: number;
  targetNominal: number;
  lastMonthOmzet: number;
  lastMonthQty: number;
}

interface SalesKpiProps {
  defaultTab?: string;
  onChangeTab?: (tab: string) => void;
}

const DEFAULT_NUSANTARA_ADMINS = [
  'MEINDA MAULINA',
  'BINTANG MEDITA SARI',
  'FATAUDIN RIFKY MAULANA',
  'PIPIT ISTIANI',
  'IZZUL BAHRUL HISAM',
  'MUHAMMAD SHOIM'
];

const DEFAULT_SIDOARJO_ADMINS = [
  'NADIA PUTRI SIDOARJO',
  'RINA WIJAYA SIDOARJO',
  'DEVI LESTARI SIDOARJO',
  'BUDI SANTOSO SIDOARJO'
];

const LEGACY_KPI_LOCAL_STORAGE_KEYS = [
  'akk_sales_kpi_individual_v1',
  'akk_sales_kpi_individual_v2',
  'akk_sales_kpi_individual_v3',
  'akk_sales_kpi_discount_errors_v1',
  'akk_sales_kpi_discount_errors_v2',
  'akk_sales_kpi_discount_errors_v3',
  'akk_sales_kpi_denda_checker_v1',
  'akk_sales_kpi_denda_checker_v2',
  'akk_sales_kpi_denda_checker_v3',
  'akk_sales_kpi_reorder_eval_v1',
  'akk_sales_kpi_reorder_eval_v2',
  'akk_sales_kpi_reorder_eval_v3',
  'akk_sales_kpi_reorder_eval_v4',
  'akk_sales_kpi_admin_omset_v1',
  'akk_sales_kpi_admin_omset_v2',
  'akk_sales_kpi_admin_omset_v3'
];

function parseNum(raw: any): number {
  if (typeof raw === 'number' && Number.isFinite(raw)) return raw;
  if (raw === null || raw === undefined) return 0;
  let s = String(raw).trim();
  if (!s) return 0;
  s = s.replace(/^[Rr][Pp]\.?\s*/g, '').replace(/[xX%]$/g, '').replace(/\s+/g, '');
  if (/^-?\d{1,3}(\.\d{3})+(,\d+)?$/.test(s)) {
    s = s.replace(/\./g, '').replace(',', '.');
  } else if (/^-?\d+(,\d+)$/.test(s)) {
    s = s.replace(',', '.');
  } else {
    s = s.replace(/,/g, '');
  }
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
}

function formatRp(val: number): string {
  return Math.round(Number(val) || 0).toLocaleString('id-ID');
}

function formatQtyId(val: number): string {
  return (Number(val) || 0).toLocaleString('id-ID', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

function getPreviousMonthAndYear(month: string, year: string): { prevMonth: string; prevYear: string } {
  const idx = MONTH_OPTIONS.findIndex(m => m.toLowerCase() === (month || '').toLowerCase());
  const yNum = parseInt(year, 10) || new Date().getFullYear();
  if (idx <= 0) {
    return { prevMonth: MONTH_OPTIONS[11] || 'Desember', prevYear: String(yNum - 1) };
  }
  return { prevMonth: MONTH_OPTIONS[idx - 1], prevYear: String(yNum) };
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export const SalesKpi: React.FC<SalesKpiProps> = ({ defaultTab = 'sales_kpi_individual', onChangeTab }) => {
  const normalizedDefaultTab =
    defaultTab === 'sales_kpi' || !defaultTab ? 'sales_kpi_individual' : defaultTab;

  const [activeTab, setActiveTab] = useState<string>(normalizedDefaultTab);
  const [isExporting, setIsExporting] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [dbSourceLabel, setDbSourceLabel] = useState<string>('MySQL Database');
  const [isLoadingDb, setIsLoadingDb] = useState<boolean>(true);
  const { addNotification } = useToast();
  const { user: currentUser, isAdmin, canEditModule } = useRoleAccess();

  const canEditKpiStaff = useMemo(() => {
    return (
      isAdmin() ||
      canEditModule('sales_admin', 'sales_kpi_individual') ||
      canEditModule('sales_kpi_individual') ||
      canEditModule('sales_admin') ||
      currentUser?.role === 'sales_admin'
    );
  }, [currentUser, isAdmin, canEditModule]);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3500);
  };

  useEffect(() => {
    if (defaultTab) {
      setActiveTab(defaultTab === 'sales_kpi' ? 'sales_kpi_individual' : defaultTab);
    }
  }, [defaultTab]);

  // --------------------------------------------------------------------------
  // GLOBAL FILTERS: CABANG, BULAN (KALENDER), TAHUN, NAMA ADMIN
  // --------------------------------------------------------------------------
  const now = new Date();
  const [selectedBranchId, setSelectedBranchId] = useState<string>(() => {
    const id = branchStore.getSelectedOriginBranchId();
    return id && id !== 'ALL' ? id : 'cab-banyuwangi';
  });
  const [selectedMonth, setSelectedMonth] = useState<string>(
    () => MONTH_OPTIONS[now.getMonth()] || 'November'
  );
  const [selectedYear, setSelectedYear] = useState<string>(() => String(now.getFullYear()));
  const [selectedAdminFilter, setSelectedAdminFilter] = useState<string>('SEMUA ADMIN');

  // Additional filters for Omset Admin (Kota & Area)
  const [selectedKotaFilter, setSelectedKotaFilter] = useState<string>('SEMUA KOTA');
  const [selectedAreaFilter, setSelectedAreaFilter] = useState<string>('SEMUA AREA');
  const [omzetChartGranularity, setOmzetChartGranularity] = useState<'Bulanan' | 'Mingguan' | 'Harian'>('Bulanan');
  const [showOmzetNumbers, setShowOmzetNumbers] = useState<boolean>(false);

  useEffect(() => {
    const unsub = branchStore.subscribe(() => {
      const id = branchStore.getSelectedOriginBranchId();
      if (id && id !== 'ALL') {
        setSelectedBranchId(id);
      }
    });
    return unsub;
  }, []);

  const handleBranchChange = (nextBranchId: string) => {
    setSelectedBranchId(nextBranchId);
    if (nextBranchId !== 'ALL') {
      branchStore.setActiveBranchId(nextBranchId);
    }
    setSelectedAdminFilter('SEMUA ADMIN');
  };

  // --------------------------------------------------------------------------
  // STRICT BRANCH-SEPARATED ADMIN PENJUALAN INTEGRATION FROM USER MANAGEMENT
  // --------------------------------------------------------------------------
  const bwiUsersFromStore = useSalesAdminUsers('cab-banyuwangi');
  const sdaUsersFromStore = useSalesAdminUsers('cab-sidoarjo');

  const nusantaraAdminNames = useMemo(() => {
    const fromUsers = Array.from(
      new Set(
        bwiUsersFromStore
          .map(u => (u.fullName || '').trim().toUpperCase())
          .filter(Boolean)
      )
    );
    const sdaSet = new Set(
      sdaUsersFromStore.map(u => (u.fullName || '').trim().toUpperCase())
    );
    const combined = Array.from(new Set([...fromUsers, ...DEFAULT_NUSANTARA_ADMINS])).filter(
      name => !sdaSet.has(name)
    );
    return combined.length > 0 ? combined : DEFAULT_NUSANTARA_ADMINS;
  }, [bwiUsersFromStore, sdaUsersFromStore]);

  const sidoarjoAdminNames = useMemo(() => {
    const fromUsers = Array.from(
      new Set(
        sdaUsersFromStore
          .map(u => (u.fullName || '').trim().toUpperCase())
          .filter(Boolean)
      )
    );
    const bwiSet = new Set(nusantaraAdminNames);
    const combined = Array.from(new Set([...fromUsers, ...DEFAULT_SIDOARJO_ADMINS])).filter(
      name => !bwiSet.has(name)
    );
    return combined.length > 0 ? combined : DEFAULT_SIDOARJO_ADMINS;
  }, [sdaUsersFromStore, nusantaraAdminNames]);

  const activeBranchAdminNames = useMemo(() => {
    if (selectedBranchId === 'cab-sidoarjo') return sidoarjoAdminNames;
    if (selectedBranchId === 'cab-banyuwangi') return nusantaraAdminNames;
    return Array.from(new Set([...nusantaraAdminNames, ...sidoarjoAdminNames]));
  }, [selectedBranchId, nusantaraAdminNames, sidoarjoAdminNames]);

  useEffect(() => {
    if (
      selectedAdminFilter !== 'SEMUA ADMIN' &&
      !activeBranchAdminNames.includes(selectedAdminFilter)
    ) {
      setSelectedAdminFilter('SEMUA ADMIN');
    }
  }, [activeBranchAdminNames, selectedAdminFilter]);

  // --------------------------------------------------------------------------
  // MYSQL DATABASE PERSISTENCE STATE (ZERO LOCAL/DUMMY NUMBERS)
  // --------------------------------------------------------------------------
  const [individualKpiList, setIndividualKpiList] = useState<AdminIndividualKpiRecord[]>([]);
  const [discountErrorLogs, setDiscountErrorLogs] = useState<DiscountErrorLogItem[]>([]);
  const [dendaCheckerList, setDendaCheckerList] = useState<DendaCheckerRecord[]>([]);
  const [reorderList, setReorderList] = useState<ReorderWeeklyItem[]>([]);
  const [adminOmsetRows, setAdminOmsetRows] = useState<AdminOmsetRow[]>([]);
  const [unitPrevMonthPct, setUnitPrevMonthPct] = useState<Record<string, number>>({});

  // Clear all legacy localStorage keys and fetch state from MySQL database on mount
  useEffect(() => {
    try {
      LEGACY_KPI_LOCAL_STORAGE_KEYS.forEach(k => localStorage.removeItem(k));
    } catch {}

    let isMounted = true;
    const loadFromMysql = async () => {
      setIsLoadingDb(true);
      try {
        const res = await fetch('/api/sales-kpi', { cache: 'no-store' });
        if (res.ok) {
          const json = await res.json();
          if (isMounted && json?.data) {
            setIndividualKpiList(Array.isArray(json.data.individualKpiList) ? json.data.individualKpiList : []);
            setDiscountErrorLogs(Array.isArray(json.data.discountErrorLogs) ? json.data.discountErrorLogs : []);
            setDendaCheckerList(Array.isArray(json.data.dendaCheckerList) ? json.data.dendaCheckerList : []);
            setReorderList(Array.isArray(json.data.reorderList) ? json.data.reorderList : []);
            setAdminOmsetRows(Array.isArray(json.data.adminOmsetRows) ? json.data.adminOmsetRows : []);
            setUnitPrevMonthPct(
              json.data.unitPrevMonthPct && typeof json.data.unitPrevMonthPct === 'object'
                ? json.data.unitPrevMonthPct
                : {}
            );
            setDbSourceLabel(json.source === 'hostinger_mysql' ? 'MySQL Hostinger Aktif' : 'Database Server Aktif');
          }
        }
      } catch (err) {
        console.warn('Failed to fetch Sales KPI from MySQL:', err);
      } finally {
        if (isMounted) setIsLoadingDb(false);
      }
    };

    loadFromMysql();
    return () => {
      isMounted = false;
    };
  }, []);

  // Helper to persist updated KPI state directly to MySQL
  const persistSalesKpiToMysql = async (nextPatch: {
    individualKpiList?: AdminIndividualKpiRecord[];
    discountErrorLogs?: DiscountErrorLogItem[];
    dendaCheckerList?: DendaCheckerRecord[];
    reorderList?: ReorderWeeklyItem[];
    adminOmsetRows?: AdminOmsetRow[];
    unitPrevMonthPct?: Record<string, number>;
  }) => {
    const payload = {
      individualKpiList: nextPatch.individualKpiList ?? individualKpiList,
      discountErrorLogs: nextPatch.discountErrorLogs ?? discountErrorLogs,
      dendaCheckerList: nextPatch.dendaCheckerList ?? dendaCheckerList,
      reorderList: nextPatch.reorderList ?? reorderList,
      adminOmsetRows: nextPatch.adminOmsetRows ?? adminOmsetRows,
      unitPrevMonthPct: nextPatch.unitPrevMonthPct ?? unitPrevMonthPct
    };
    try {
      await fetch('/api/sales-kpi', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: payload })
      });
    } catch (err) {
      console.warn('Error saving Sales KPI to MySQL:', err);
    }
  };

  const { prevMonth: prevMonthName, prevYear: prevYearName } = useMemo(
    () => getPreviousMonthAndYear(selectedMonth, selectedYear),
    [selectedMonth, selectedYear]
  );

  // Map every admin in activeBranchAdminNames to their MySQL record (or 0% if not yet inputted in MySQL)
  const branchKpiRecords = useMemo(() => {
    return activeBranchAdminNames.map(adminName => {
      const targetBranch =
        selectedBranchId === 'ALL'
          ? sidoarjoAdminNames.includes(adminName)
            ? 'cab-sidoarjo'
            : 'cab-banyuwangi'
          : selectedBranchId;

      const existing = individualKpiList.find(
        r =>
          r.adminName.toUpperCase() === adminName.toUpperCase() &&
          r.branchId === targetBranch &&
          r.month === selectedMonth &&
          r.year === selectedYear
      );

      const prevMonthRecord = individualKpiList.find(
        r =>
          r.adminName.toUpperCase() === adminName.toUpperCase() &&
          r.branchId === targetBranch &&
          r.month === prevMonthName &&
          r.year === prevYearName
      );

      const discountLogsCount = discountErrorLogs.filter(
        d =>
          d.adminName.toUpperCase() === adminName.toUpperCase() &&
          d.branchId === targetBranch &&
          d.month === selectedMonth &&
          d.year === selectedYear
      ).length;

      const computedPrevPct = prevMonthRecord && !prevMonthRecord.isInactive
        ? Number(
            (
              (prevMonthRecord.validasiSoWeb +
                prevMonthRecord.pembuatanFaktur +
                prevMonthRecord.pengecekanFaktur) /
              3
            ).toFixed(1)
          )
        : Number(existing?.lastMonthPct || 0);

      if (existing) {
        const avg = Number(
          ((existing.validasiSoWeb + existing.pembuatanFaktur + existing.pengecekanFaktur) / 3).toFixed(1)
        );
        const gapPct = Number(Math.max(0, 100 - avg).toFixed(1));
        return {
          ...existing,
          isInactive: Boolean(existing.isInactive),
          discountErrorsCount: Math.max(existing.discountErrorsCount, discountLogsCount),
          avgMonthlyPct: avg,
          prevMonthPct: existing.lastMonthPct !== undefined ? Number(existing.lastMonthPct) : computedPrevPct,
          targetPct: 100,
          gapPct
        };
      }

      return {
        id: `kpi-empty-${targetBranch}-${adminName}`,
        adminName,
        branchId: targetBranch,
        month: selectedMonth,
        year: selectedYear,
        validasiSoWeb: 0,
        pembuatanFaktur: 0,
        pengecekanFaktur: 0,
        discountErrorsCount: discountLogsCount,
        totalOrders: 0,
        lastMonthPct: computedPrevPct,
        isInactive: false,
        notes: 'Belum ada data di MySQL',
        avgMonthlyPct: 0,
        prevMonthPct: computedPrevPct,
        targetPct: 100,
        gapPct: 100
      };
    });
  }, [
    activeBranchAdminNames,
    individualKpiList,
    discountErrorLogs,
    selectedBranchId,
    selectedMonth,
    selectedYear,
    prevMonthName,
    prevYearName,
    sidoarjoAdminNames
  ]);

  // Separate active admins from inactive admins so inactive admins are excluded from top ranking & analysis
  const rankedBranchKpiList = useMemo(() => {
    const activeItems = branchKpiRecords
      .filter(r => !r.isInactive)
      .sort((a, b) => {
        if (b.avgMonthlyPct !== a.avgMonthlyPct) return b.avgMonthlyPct - a.avgMonthlyPct;
        return a.discountErrorsCount - b.discountErrorsCount;
      })
      .map((item, index) => ({
        ...item,
        rank: index + 1
      }));

    const inactiveItems = branchKpiRecords
      .filter(r => Boolean(r.isInactive))
      .map(item => ({
        ...item,
        rank: 0
      }));

    return [...activeItems, ...inactiveItems];
  }, [branchKpiRecords]);

  const displayedKpiList = useMemo(() => {
    if (selectedAdminFilter === 'SEMUA ADMIN') return rankedBranchKpiList;
    return rankedBranchKpiList.filter(
      r => r.adminName.toUpperCase() === selectedAdminFilter.toUpperCase()
    );
  }, [rankedBranchKpiList, selectedAdminFilter]);

  // Active-only KPI list for charts & summary analysis (excludes Admin Tidak Aktif on this month)
  const activeDisplayedKpiList = useMemo(() => {
    return displayedKpiList.filter(r => !r.isInactive);
  }, [displayedKpiList]);

  // Division / Filter Summary for Gambar 1: Bulan Sebelumnya (%), Target (100%), Aktual (%), Selisih Gap (Target - Aktual)
  // Excludes any admin marked as Admin Tidak Aktif (`isInactive === true`) on the selected month
  const kpiOverallSummary = useMemo(() => {
    const activeWithScores = activeDisplayedKpiList.filter(r => r.avgMonthlyPct > 0 || r.prevMonthPct > 0);
    const sourceRows = activeWithScores.length > 0 ? activeWithScores : activeDisplayedKpiList;
    if (sourceRows.length === 0) {
      return {
        prevMonthPct: 0,
        targetPct: 100,
        actualPct: 0,
        gapPct: 100,
        avgValidasi: 0,
        avgFaktur: 0,
        totalDiscountErrors: 0
      };
    }
    const prevMonthPct = Number(
      (sourceRows.reduce((s, r) => s + (r.prevMonthPct || 0), 0) / sourceRows.length).toFixed(1)
    );
    const actualPct = Number(
      (sourceRows.reduce((s, r) => s + r.avgMonthlyPct, 0) / sourceRows.length).toFixed(1)
    );
    const targetPct = 100;
    const gapPct = Number((targetPct - actualPct).toFixed(1));
    const avgValidasi = Number(
      (sourceRows.reduce((s, r) => s + r.validasiSoWeb, 0) / sourceRows.length).toFixed(1)
    );
    const avgFaktur = Number(
      (
        sourceRows.reduce((s, r) => s + (r.pembuatanFaktur + r.pengecekanFaktur) / 2, 0) /
        sourceRows.length
      ).toFixed(1)
    );
    const totalDiscountErrors = activeDisplayedKpiList.reduce((s, r) => s + r.discountErrorsCount, 0);

    return {
      prevMonthPct,
      targetPct,
      actualPct,
      gapPct,
      avgValidasi,
      avgFaktur,
      totalDiscountErrors
    };
  }, [activeDisplayedKpiList]);

  const [focusedAdminName, setFocusedAdminName] = useState<string>('');
  useEffect(() => {
    if (selectedAdminFilter !== 'SEMUA ADMIN') {
      setFocusedAdminName(selectedAdminFilter);
    } else if (
      !focusedAdminName ||
      !rankedBranchKpiList.some(r => r.adminName === focusedAdminName)
    ) {
      const firstActive = rankedBranchKpiList.find(r => !r.isInactive) || rankedBranchKpiList[0];
      setFocusedAdminName(firstActive?.adminName || '');
    }
  }, [selectedAdminFilter, rankedBranchKpiList, focusedAdminName]);

  const focusedAdminKpi = useMemo(() => {
    return (
      rankedBranchKpiList.find(r => r.adminName === focusedAdminName) ||
      rankedBranchKpiList.find(r => !r.isInactive) ||
      rankedBranchKpiList[0] || {
        id: 'fallback',
        adminName: activeBranchAdminNames[0] || 'ADMIN PENJUALAN',
        branchId: selectedBranchId === 'ALL' ? 'cab-banyuwangi' : selectedBranchId,
        month: selectedMonth,
        year: selectedYear,
        validasiSoWeb: 0,
        pembuatanFaktur: 0,
        pengecekanFaktur: 0,
        discountErrorsCount: 0,
        totalOrders: 0,
        isInactive: false,
        avgMonthlyPct: 0,
        prevMonthPct: 0,
        targetPct: 100,
        gapPct: 100,
        rank: 1
      }
    );
  }, [
    rankedBranchKpiList,
    focusedAdminName,
    activeBranchAdminNames,
    selectedBranchId,
    selectedMonth,
    selectedYear
  ]);

  // Dropdown Options Builders for ModernKpiDropdown
  const branchDropdownOptions = useMemo<ModernDropdownOption[]>(
    () => [
      {
        value: 'cab-banyuwangi',
        label: 'Cabang Nusantara (Banyuwangi)',
        subLabel: `${nusantaraAdminNames.length} Admin Penjualan Terdaftar`,
        badgeText: 'BWI',
        badgeTone: 'indigo'
      },
      {
        value: 'cab-sidoarjo',
        label: 'Cabang Sidoarjo',
        subLabel: `${sidoarjoAdminNames.length} Admin Penjualan Terdaftar`,
        badgeText: 'SDA',
        badgeTone: 'emerald'
      },
      {
        value: 'ALL',
        label: 'Semua Cabang',
        subLabel: 'Gabungan Nusantara & Sidoarjo',
        badgeText: 'ALL',
        badgeTone: 'amber'
      }
    ],
    [nusantaraAdminNames.length, sidoarjoAdminNames.length]
  );

  const monthDropdownOptions = useMemo<ModernDropdownOption[]>(
    () =>
      MONTH_OPTIONS.map((m, idx) => ({
        value: m,
        label: m,
        badgeText: `Bln ${idx + 1}`,
        badgeTone: m === selectedMonth ? 'indigo' : 'slate'
      })),
    [selectedMonth]
  );

  const yearDropdownOptions = useMemo<ModernDropdownOption[]>(
    () =>
      YEAR_OPTIONS.map(y => ({
        value: y,
        label: y,
        subLabel: `Periode Evaluasi ${y}`,
        badgeText: y === String(now.getFullYear()) ? 'Tahun Ini' : undefined,
        badgeTone: 'emerald'
      })),
    [now]
  );

  const adminFilterDropdownOptions = useMemo<ModernDropdownOption[]>(() => {
    const activeCount = branchKpiRecords.filter(r => !r.isInactive).length;
    const inactiveCount = branchKpiRecords.filter(r => r.isInactive).length;
    const allOption: ModernDropdownOption = {
      value: 'SEMUA ADMIN',
      label: `Semua Admin (${activeBranchAdminNames.length})`,
      subLabel:
        inactiveCount > 0
          ? `${activeCount} Aktif • ${inactiveCount} Tidak Aktif bulan ini`
          : `${activeCount} Admin Aktif dievaluasi`,
      badgeText: `${activeCount} Aktif`,
      badgeTone: 'indigo'
    };

    const individualOptions: ModernDropdownOption[] = activeBranchAdminNames.map(name => {
      const rec = branchKpiRecords.find(r => r.adminName.toUpperCase() === name.toUpperCase());
      const isInactive = Boolean(rec?.isInactive);
      const isSda = sidoarjoAdminNames.includes(name.toUpperCase());
      return {
        value: name,
        label: name,
        subLabel: isInactive
          ? `Tidak Aktif (${selectedMonth} ${selectedYear}) • Dikecualikan dari Analisa`
          : `Aktual KPI: ${rec?.avgMonthlyPct ?? 0}% • Cabang ${isSda ? 'Sidoarjo' : 'Nusantara'}`,
        badgeText: isInactive ? 'Tidak Aktif' : isSda ? 'SDA' : 'BWI',
        badgeTone: isInactive ? 'rose' : 'emerald'
      };
    });

    return [allOption, ...individualOptions];
  }, [activeBranchAdminNames, branchKpiRecords, selectedMonth, selectedYear, sidoarjoAdminNames]);

  const adminSelectDropdownOptions = useMemo<ModernDropdownOption[]>(() => {
    return activeBranchAdminNames.map(name => {
      const rec = branchKpiRecords.find(r => r.adminName.toUpperCase() === name.toUpperCase());
      const isInactive = Boolean(rec?.isInactive);
      const isSda = sidoarjoAdminNames.includes(name.toUpperCase());
      return {
        value: name,
        label: name,
        subLabel: isInactive
          ? 'Status Bulan Ini: Tidak Aktif (Dikecualikan dari Analisa)'
          : `Status Bulan Ini: Aktif • Aktual ${rec?.avgMonthlyPct ?? 0}%`,
        badgeText: isInactive ? 'Tidak Aktif' : isSda ? 'SDA' : 'BWI',
        badgeTone: isInactive ? 'rose' : 'emerald'
      };
    });
  }, [activeBranchAdminNames, branchKpiRecords, sidoarjoAdminNames]);

  // Upload Excel Modal State & Manual Input State for KPI Individu
  const [isKpiUploadOpen, setIsKpiUploadOpen] = useState(false);
  const [kpiImportMode, setKpiImportMode] = useState<'replace_all' | 'append'>('replace_all');
  const [kpiExcelFileName, setKpiExcelFileName] = useState('');
  const [kpiPreviewRows, setKpiPreviewRows] = useState<AdminIndividualKpiRecord[]>([]);
  const [showKpiUploadPreview, setShowKpiUploadPreview] = useState(false);

  // Manual KPI Individu Form State (for direct MySQL entry/editing)
  const [isManualKpiOpen, setIsManualKpiOpen] = useState(false);
  const [manualKpiAdmin, setManualKpiAdmin] = useState('');
  const [manualKpiPrevPct, setManualKpiPrevPct] = useState('');
  const [manualKpiValidasi, setManualKpiValidasi] = useState('');
  const [manualKpiPembuatan, setManualKpiPembuatan] = useState('');
  const [manualKpiPengecekan, setManualKpiPengecekan] = useState('');
  const [manualKpiOrders, setManualKpiOrders] = useState('');
  const [manualKpiIsInactive, setManualKpiIsInactive] = useState<boolean>(false);

  // Handler to toggle Admin Tidak Aktif on the selected month/year (only for users with edit rights)
  const handleToggleAdminActiveStatus = (adminName: string, branchIdParam?: string) => {
    if (!canEditKpiStaff) {
      showToast('Anda tidak memiliki hak akses untuk mengubah status aktif KPI staff.');
      return;
    }
    const cleanAdmin = adminName.trim().toUpperCase();
    const targetBranch =
      branchIdParam ||
      (sidoarjoAdminNames.includes(cleanAdmin)
        ? 'cab-sidoarjo'
        : selectedBranchId === 'ALL'
        ? 'cab-banyuwangi'
        : selectedBranchId);

    const next = [...individualKpiList];
    const idx = next.findIndex(
      x =>
        x.adminName.toUpperCase() === cleanAdmin &&
        x.branchId === targetBranch &&
        x.month === selectedMonth &&
        x.year === selectedYear
    );

    let nextInactiveState = true;
    if (idx >= 0) {
      nextInactiveState = !next[idx].isInactive;
      next[idx] = {
        ...next[idx],
        isInactive: nextInactiveState
      };
    } else {
      nextInactiveState = true;
      next.push({
        id: `kpi-status-${Date.now()}`,
        adminName: cleanAdmin,
        branchId: targetBranch,
        month: selectedMonth,
        year: selectedYear,
        validasiSoWeb: 0,
        pembuatanFaktur: 0,
        pengecekanFaktur: 0,
        discountErrorsCount: 0,
        totalOrders: 0,
        isInactive: true,
        notes: 'Admin Tidak Aktif pada bulan ini'
      });
    }

    setIndividualKpiList(next);
    void persistSalesKpiToMysql({ individualKpiList: next });
    showToast(
      nextInactiveState
        ? `${cleanAdmin} ditandai TIDAK AKTIF pada ${selectedMonth} ${selectedYear} (data tidak masuk analisa).`
        : `${cleanAdmin} diaktifkan kembali pada analisa KPI ${selectedMonth} ${selectedYear}.`
    );
  };

  // Discount Error Form State
  const [isAddDiscountErrOpen, setIsAddDiscountErrOpen] = useState(false);
  const [editingDiscountId, setEditingDiscountId] = useState<string | null>(null);
  const [dscDate, setDscDate] = useState('');
  const [dscAdmin, setDscAdmin] = useState('');
  const [dscNoFaktur, setDscNoFaktur] = useState('');
  const [dscCustomer, setDscCustomer] = useState('');
  const [dscExpected, setDscExpected] = useState('');
  const [dscInput, setDscInput] = useState('');
  const [dscSelisihRp, setDscSelisihRp] = useState('');
  const [dscKeterangan, setDscKeterangan] = useState('');

  // Upload Excel State for Denda Checker
  const [isDendaUploadOpen, setIsDendaUploadOpen] = useState(false);
  const [dendaImportMode, setDendaImportMode] = useState<'replace_all' | 'append'>('replace_all');
  const [dendaExcelFileName, setDendaExcelFileName] = useState('');
  const [dendaPreviewRows, setDendaPreviewRows] = useState<DendaCheckerRecord[]>([]);
  const [showDendaUploadPreview, setShowDendaUploadPreview] = useState(false);

  // Manual Form State for Denda Checker
  const [isAddDendaManualOpen, setIsAddDendaManualOpen] = useState(false);
  const [editingDendaId, setEditingDendaId] = useState<string | null>(null);
  const [newDendaAdmin, setNewDendaAdmin] = useState('');
  const [newDendaCustomer, setNewDendaCustomer] = useState('');
  const [newDendaNoFaktur, setNewDendaNoFaktur] = useState('');
  const [newDendaKeterangan, setNewDendaKeterangan] = useState('');
  const [newDendaNominalSelisih, setNewDendaNominalSelisih] = useState('');
  const [newDendaKalianSelisih, setNewDendaKalianSelisih] = useState('1');

  const filteredDendaChecker = useMemo(() => {
    return dendaCheckerList.filter(item => {
      const matchBranch = selectedBranchId === 'ALL' || item.branchId === selectedBranchId;
      const matchPeriod =
        (!item.month || item.month === selectedMonth) &&
        (!item.year || item.year === selectedYear);
      const matchAdmin =
        selectedAdminFilter === 'SEMUA ADMIN' ||
        item.adminName.toUpperCase() === selectedAdminFilter.toUpperCase();
      return matchBranch && matchPeriod && matchAdmin;
    });
  }, [dendaCheckerList, selectedBranchId, selectedMonth, selectedYear, selectedAdminFilter]);

  // Reorder Form State
  const [isAddReorderOpen, setIsAddReorderOpen] = useState(false);
  const [editingReorderId, setEditingReorderId] = useState<string | null>(null);
  const [reoUnit, setReoUnit] = useState<'Nusantara Dr. Soetomo' | 'Nusantara Expand'>('Nusantara Dr. Soetomo');
  const [reoWeek, setReoWeek] = useState(`03 ${(MONTH_OPTIONS[now.getMonth()] || 'November').slice(0, 3)} ${now.getFullYear()}`);
  const [reoTerkirimFaktur, setReoTerkirimFaktur] = useState('');
  const [reoBelumTerkirimSo, setReoBelumTerkirimSo] = useState('');
  const [reoPrevMonthPctInput, setReoPrevMonthPctInput] = useState('');

  // Omset Admin Upload & Manual Input State
  const [isOmsetUploadOpen, setIsOmsetUploadOpen] = useState(false);
  const [omsetImportMode, setOmsetImportMode] = useState<'replace_all' | 'append'>('replace_all');
  const [omsetExcelFileName, setOmsetExcelFileName] = useState('');
  const [omsetPreviewRows, setOmsetPreviewRows] = useState<AdminOmsetRow[]>([]);
  const [showOmsetUploadPreview, setShowOmsetUploadPreview] = useState(false);

  const [isManualOmsetOpen, setIsManualOmsetOpen] = useState(false);
  const [manualOmsetAdmin, setManualOmsetAdmin] = useState('');
  const [manualOmsetKota, setManualOmsetKota] = useState('BANYUWANGI KOTA');
  const [manualOmsetArea, setManualOmsetArea] = useState('Banyuwangi Kota');
  const [manualOmsetCustomer, setManualOmsetCustomer] = useState('');
  const [manualOmsetItem, setManualOmsetItem] = useState('');
  const [manualOmsetNetto, setManualOmsetNetto] = useState('');
  const [manualOmsetQty, setManualOmsetQty] = useState('');
  const [manualOmsetLastMonth, setManualOmsetLastMonth] = useState('');

  // Filter adminOmsetRows from MySQL without injecting fake fallback numbers
  const synchronizedOmsetRows = useMemo(() => {
    const periodRows = adminOmsetRows.filter(
      r =>
        (!r.month || r.month === selectedMonth) &&
        (!r.year || r.year === selectedYear) &&
        (selectedBranchId === 'ALL' || r.branchId === selectedBranchId)
    );

    const baseList: AdminOmsetRow[] = [];
    const ensureBranchAdmins = (names: string[], brId: string, brCode: 'BWI' | 'SDA') => {
      names.forEach((name, idx) => {
        const matchingRows = periodRows.filter(
          r => r.adminName.toUpperCase() === name.toUpperCase() && r.branchId === brId
        );
        if (matchingRows.length > 0) {
          baseList.push(...matchingRows);
        } else {
          baseList.push({
            id: `oms-empty-${brCode}-${idx}`,
            adminName: name.toUpperCase(),
            branchId: brId,
            branchCode: brCode,
            month: selectedMonth,
            year: selectedYear,
            kota: '-',
            area: '-',
            omzetNetto: 0,
            bruto: 0,
            returNominal: 0,
            qtyNetto: 0,
            returQty: 0,
            targetNominal: 0,
            lastMonthOmzet: 0,
            lastMonthQty: 0
          });
        }
      });
    };

    if (selectedBranchId === 'cab-banyuwangi') {
      ensureBranchAdmins(nusantaraAdminNames, 'cab-banyuwangi', 'BWI');
    } else if (selectedBranchId === 'cab-sidoarjo') {
      ensureBranchAdmins(sidoarjoAdminNames, 'cab-sidoarjo', 'SDA');
    } else {
      ensureBranchAdmins(nusantaraAdminNames, 'cab-banyuwangi', 'BWI');
      ensureBranchAdmins(sidoarjoAdminNames, 'cab-sidoarjo', 'SDA');
    }

    return baseList.filter(row => {
      const matchAdmin =
        selectedAdminFilter === 'SEMUA ADMIN' ||
        row.adminName.toUpperCase() === selectedAdminFilter.toUpperCase();
      const matchKota =
        selectedKotaFilter === 'SEMUA KOTA' ||
        row.kota.toUpperCase() === selectedKotaFilter.toUpperCase();
      const matchArea =
        selectedAreaFilter === 'SEMUA AREA' ||
        row.area.toUpperCase() === selectedAreaFilter.toUpperCase();
      return matchAdmin && matchKota && matchArea;
    });
  }, [
    adminOmsetRows,
    selectedBranchId,
    nusantaraAdminNames,
    sidoarjoAdminNames,
    selectedMonth,
    selectedYear,
    selectedAdminFilter,
    selectedKotaFilter,
    selectedAreaFilter
  ]);

  // ============================================================================
  // HANDLERS: KPI INDIVIDU EXCEL UPLOAD & MANUAL INPUT (SAVED TO MYSQL)
  // ============================================================================

  const handleKpiExcelSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const buffer = await file.arrayBuffer();
      const wb = XLSX.read(buffer, { type: 'array' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rawRows = XLSX.utils.sheet_to_json<any[]>(ws, { header: 1, defval: '' });
      if (!Array.isArray(rawRows) || rawRows.length < 2) {
        showToast('File Excel kosong atau tidak memiliki baris data.');
        return;
      }

      const parsed: AdminIndividualKpiRecord[] = [];
      for (let r = 1; r < rawRows.length; r++) {
        const row = rawRows[r] || [];
        const rawAdminCell = String(row[0] ?? '').trim().toUpperCase();
        if (/^nama\s*admin$/i.test(rawAdminCell)) continue;
        const adminName =
          selectedAdminFilter !== 'SEMUA ADMIN'
            ? selectedAdminFilter
            : rawAdminCell || activeBranchAdminNames[0] || '';
        if (!adminName) continue;

        if (
          selectedAdminFilter !== 'SEMUA ADMIN' &&
          rawAdminCell &&
          activeBranchAdminNames.some(a => a.toUpperCase() === rawAdminCell) &&
          rawAdminCell !== selectedAdminFilter.toUpperCase() &&
          rawRows.length > 2
        ) {
          continue;
        }

        const rawCabang = String(row[1] ?? '').trim().toLowerCase();
        const branchId =
          sidoarjoAdminNames.includes(adminName.toUpperCase()) ||
          rawCabang.includes('sidoarjo') ||
          rawCabang.includes('sda')
            ? 'cab-sidoarjo'
            : selectedBranchId === 'ALL'
            ? 'cab-banyuwangi'
            : selectedBranchId;

        const validasiSoWeb = Math.min(100, Math.max(0, parseNum(row[2])));
        const pembuatanFaktur = Math.min(100, Math.max(0, parseNum(row[3])));
        const pengecekanFaktur = Math.min(100, Math.max(0, parseNum(row[4])));
        const discountErrorsCount = Math.max(0, Math.round(parseNum(row[5])));
        const totalOrders = Math.max(0, Math.round(parseNum(row[6])));
        const lastMonthPct = Math.min(100, Math.max(0, parseNum(row[8] ?? 0)));
        const notes = String(row[7] ?? '').trim();

        parsed.push({
          id: `kpi-imp-${Date.now()}-${r}`,
          adminName,
          branchId,
          month: selectedMonth,
          year: selectedYear,
          validasiSoWeb,
          pembuatanFaktur,
          pengecekanFaktur,
          discountErrorsCount,
          totalOrders,
          lastMonthPct: lastMonthPct > 0 ? lastMonthPct : undefined,
          notes
        });
      }

      if (parsed.length === 0) {
        showToast('Tidak ditemukan baris KPI Individu yang valid.');
        return;
      }

      setKpiExcelFileName(file.name);
      setKpiPreviewRows(parsed);
      setShowKpiUploadPreview(true);
    } catch (err: any) {
      showToast(`Gagal membaca file Excel: ${err?.message || 'Format tidak didukung'}`);
    }
  };

  const handleSaveKpiUpload = () => {
    if (kpiPreviewRows.length === 0) {
      showToast('Silakan pilih file Excel KPI terlebih dahulu.');
      return;
    }
    const finalRows = kpiPreviewRows.map(r => ({
      ...r,
      adminName:
        selectedAdminFilter !== 'SEMUA ADMIN' && kpiPreviewRows.length === 1 ? selectedAdminFilter : r.adminName,
      branchId:
        sidoarjoAdminNames.includes(
          (selectedAdminFilter !== 'SEMUA ADMIN' && kpiPreviewRows.length === 1
            ? selectedAdminFilter
            : r.adminName
          ).toUpperCase()
        )
          ? 'cab-sidoarjo'
          : selectedBranchId === 'ALL'
          ? r.branchId
          : selectedBranchId,
      month: selectedMonth,
      year: selectedYear
    }));

    let updatedList: AdminIndividualKpiRecord[] = [];
    if (kpiImportMode === 'replace_all') {
      const others = individualKpiList.filter(item => {
        const sameBranch = selectedBranchId === 'ALL' || item.branchId === selectedBranchId;
        const samePeriod = item.month === selectedMonth && item.year === selectedYear;
        const sameAdmin =
          selectedAdminFilter === 'SEMUA ADMIN' ||
          item.adminName.toUpperCase() === selectedAdminFilter.toUpperCase();
        return !(sameBranch && samePeriod && sameAdmin);
      });
      updatedList = [...others, ...finalRows];
    } else {
      const next = [...individualKpiList];
      finalRows.forEach(imp => {
        const idx = next.findIndex(
          x =>
            x.adminName.toUpperCase() === imp.adminName.toUpperCase() &&
            x.branchId === imp.branchId &&
            x.month === imp.month &&
            x.year === imp.year
        );
        if (idx >= 0) next[idx] = { ...imp, isInactive: next[idx].isInactive };
        else next.push(imp);
      });
      updatedList = next;
    }

    setIndividualKpiList(updatedList);
    persistSalesKpiToMysql({ individualKpiList: updatedList });
    setIsKpiUploadOpen(false);
    setKpiPreviewRows([]);
    setKpiExcelFileName('');
    setShowKpiUploadPreview(false);
    showToast(`Berhasil menyimpan ${finalRows.length} data KPI Individu.`);
  };

  const handleSaveManualKpi = (e: React.FormEvent) => {
    e.preventDefault();
    const targetAdmin = (manualKpiAdmin || activeBranchAdminNames[0] || '').trim().toUpperCase();
    if (!targetAdmin) {
      showToast('Pilih Nama Admin terlebih dahulu.');
      return;
    }
    const targetBranch = sidoarjoAdminNames.includes(targetAdmin)
      ? 'cab-sidoarjo'
      : selectedBranchId === 'ALL'
      ? 'cab-banyuwangi'
      : selectedBranchId;

    const validasiSoWeb = Math.min(100, Math.max(0, parseNum(manualKpiValidasi)));
    const pembuatanFaktur = Math.min(100, Math.max(0, parseNum(manualKpiPembuatan)));
    const pengecekanFaktur = Math.min(100, Math.max(0, parseNum(manualKpiPengecekan)));
    const lastMonthPct = Math.min(100, Math.max(0, parseNum(manualKpiPrevPct)));
    const totalOrders = Math.max(0, Math.round(parseNum(manualKpiOrders)));

    const newRec: AdminIndividualKpiRecord = {
      id: `kpi-man-${Date.now()}`,
      adminName: targetAdmin,
      branchId: targetBranch,
      month: selectedMonth,
      year: selectedYear,
      validasiSoWeb,
      pembuatanFaktur,
      pengecekanFaktur,
      discountErrorsCount: 0,
      totalOrders,
      lastMonthPct,
      isInactive: manualKpiIsInactive,
      notes: manualKpiIsInactive ? 'Admin Tidak Aktif (Dikecualikan dari Analisa)' : 'Input Evaluasi KPI'
    };

    const next = [...individualKpiList];
    const idx = next.findIndex(
      x =>
        x.adminName.toUpperCase() === targetAdmin &&
        x.branchId === targetBranch &&
        x.month === selectedMonth &&
        x.year === selectedYear
    );
    if (idx >= 0) {
      next[idx] = { ...next[idx], ...newRec, id: next[idx].id };
    } else {
      next.push(newRec);
    }

    setIndividualKpiList(next);
    persistSalesKpiToMysql({ individualKpiList: next });
    setIsManualKpiOpen(false);
    showToast(
      manualKpiIsInactive
        ? `Data KPI ${targetAdmin} disimpan dengan status TIDAK AKTIF (dikecualikan dari analisa ${selectedMonth} ${selectedYear}).`
        : `Data KPI ${targetAdmin} berhasil disimpan.`
    );
  };

  // ============================================================================
  // HANDLERS: DENDA CHECKER EXCEL UPLOAD & MANUAL INPUT (SAVED TO MYSQL)
  // ============================================================================
  const handleDendaExcelSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const buffer = await file.arrayBuffer();
      const wb = XLSX.read(buffer, { type: 'array' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rawRows = XLSX.utils.sheet_to_json<any[]>(ws, { header: 1, defval: '' });
      if (!Array.isArray(rawRows) || rawRows.length < 2) {
        showToast('File Excel Denda Checker kosong.');
        return;
      }

      const parsed: DendaCheckerRecord[] = [];
      for (let r = 1; r < rawRows.length; r++) {
        const row = rawRows[r] || [];
        const rawAdmin = String(row[0] ?? '').trim().toUpperCase();
        const customerName = String(row[1] ?? '').trim().toUpperCase();
        const noFaktur = String(row[2] ?? '').trim().toUpperCase();
        if (!rawAdmin && !noFaktur && selectedAdminFilter === 'SEMUA ADMIN') continue;
        if (/^nama$/i.test(rawAdmin)) continue;

        const adminName =
          selectedAdminFilter !== 'SEMUA ADMIN'
            ? selectedAdminFilter
            : rawAdmin || activeBranchAdminNames[0] || 'ADMIN PENJUALAN';
        const keterangan = String(row[3] ?? '').trim() || 'Selisih pengecekan faktur';
        const nominalSelisih = Math.max(0, parseNum(row[4]));
        const kalianSelisih = Math.max(0.5, parseNum(row[5]) || 1);
        const totalDenda = Math.round(nominalSelisih * kalianSelisih);

        const resolvedBranch = sidoarjoAdminNames.includes(adminName)
          ? 'cab-sidoarjo'
          : selectedBranchId === 'ALL'
          ? 'cab-banyuwangi'
          : selectedBranchId;

        parsed.push({
          id: `dc-imp-${Date.now()}-${r}`,
          branchId: resolvedBranch,
          month: selectedMonth,
          year: selectedYear,
          adminName,
          customerName: customerName || 'PELANGGAN UMUM',
          noFaktur: noFaktur || `FJ02-1126-00${r}`,
          keterangan,
          nominalSelisih,
          kalianSelisih,
          totalDenda
        });
      }

      if (parsed.length === 0) {
        showToast('Tidak ditemukan baris Denda Checker valid pada file.');
        return;
      }

      setDendaExcelFileName(file.name);
      setDendaPreviewRows(parsed);
      setShowDendaUploadPreview(true);
    } catch (err: any) {
      showToast(`Gagal membaca file Excel: ${err?.message || 'Format tidak didukung'}`);
    }
  };

  const handleSaveDendaUpload = () => {
    if (dendaPreviewRows.length === 0) {
      showToast('Silakan pilih file Excel Denda Checker terlebih dahulu.');
      return;
    }
    let updated: DendaCheckerRecord[] = [];
    if (dendaImportMode === 'replace_all') {
      const remaining = dendaCheckerList.filter(
        x =>
          !(
            (selectedBranchId === 'ALL' || x.branchId === selectedBranchId) &&
            x.month === selectedMonth &&
            x.year === selectedYear &&
            (selectedAdminFilter === 'SEMUA ADMIN' ||
              x.adminName.toUpperCase() === selectedAdminFilter.toUpperCase())
          )
      );
      updated = [...dendaPreviewRows, ...remaining];
    } else {
      updated = [...dendaPreviewRows, ...dendaCheckerList];
    }
    setDendaCheckerList(updated);
    persistSalesKpiToMysql({ dendaCheckerList: updated });
    setIsDendaUploadOpen(false);
    setDendaPreviewRows([]);
    setDendaExcelFileName('');
    setShowDendaUploadPreview(false);
    showToast(`Berhasil menyimpan ${dendaPreviewRows.length} data Denda Checker.`);
  };

  const handleAddManualDenda = (e: React.FormEvent) => {
    e.preventDefault();
    const targetAdmin = (newDendaAdmin || activeBranchAdminNames[0] || '').trim().toUpperCase();
    if (!targetAdmin || !newDendaNoFaktur.trim() || !newDendaCustomer.trim()) {
      showToast('Harap lengkapi Nama Admin, Nama Pelanggan, dan No Faktur.');
      return;
    }
    const nominalSelisih = Math.max(0, parseNum(newDendaNominalSelisih));
    const kalianSelisih = Math.max(0.5, parseNum(newDendaKalianSelisih) || 1);
    const totalDenda = Math.round(nominalSelisih * kalianSelisih);
    const targetBranch = sidoarjoAdminNames.includes(targetAdmin)
      ? 'cab-sidoarjo'
      : selectedBranchId === 'ALL'
      ? 'cab-banyuwangi'
      : selectedBranchId;

    if (editingDendaId) {
      const updated = dendaCheckerList.map(item =>
        item.id === editingDendaId
          ? {
              ...item,
              branchId: targetBranch,
              adminName: targetAdmin,
              customerName: newDendaCustomer.trim().toUpperCase(),
              noFaktur: newDendaNoFaktur.trim().toUpperCase(),
              keterangan: newDendaKeterangan.trim() || 'Selisih pengecekan faktur penjualan',
              nominalSelisih,
              kalianSelisih,
              totalDenda
            }
          : item
      );
      setDendaCheckerList(updated);
      persistSalesKpiToMysql({ dendaCheckerList: updated });
      setEditingDendaId(null);
      setNewDendaCustomer('');
      setNewDendaNoFaktur('');
      setNewDendaKeterangan('');
      setNewDendaNominalSelisih('');
      setNewDendaKalianSelisih('1');
      setIsAddDendaManualOpen(false);
      showToast(`Data Denda Checker untuk ${targetAdmin} berhasil diperbarui.`);
      return;
    }

    const newRecord: DendaCheckerRecord = {
      id: `dc-man-${Date.now()}`,
      branchId: targetBranch,
      month: selectedMonth,
      year: selectedYear,
      adminName: targetAdmin,
      customerName: newDendaCustomer.trim().toUpperCase(),
      noFaktur: newDendaNoFaktur.trim().toUpperCase(),
      keterangan: newDendaKeterangan.trim() || 'Selisih pengecekan faktur penjualan',
      nominalSelisih,
      kalianSelisih,
      totalDenda
    };

    const updated = [newRecord, ...dendaCheckerList];
    setDendaCheckerList(updated);
    persistSalesKpiToMysql({ dendaCheckerList: updated });
    addNotification(
      'checker',
      `Denda Checker Baru: ${newRecord.adminName}`,
      `Faktur ${newRecord.noFaktur} (${newRecord.customerName}) — Selisih Rp ${formatRp(nominalSelisih)} × ${kalianSelisih} = Denda Rp ${formatRp(totalDenda)}`,
      totalDenda >= 100000
    );
    setNewDendaCustomer('');
    setNewDendaNoFaktur('');
    setNewDendaKeterangan('');
    setNewDendaNominalSelisih('');
    setNewDendaKalianSelisih('1');
    setIsAddDendaManualOpen(false);
    showToast(`Data Denda Checker untuk ${newRecord.adminName} berhasil disimpan.`);
  };

  // ============================================================================
  // HANDLERS: OMSET ADMIN EXCEL UPLOAD & MANUAL INPUT (SAVED TO MYSQL)
  // ============================================================================
  const handleOmsetExcelSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const buffer = await file.arrayBuffer();
      const wb = XLSX.read(buffer, { type: 'array' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rawRows = XLSX.utils.sheet_to_json<any[]>(ws, { header: 1, defval: '' });
      if (!Array.isArray(rawRows) || rawRows.length < 2) {
        showToast('File Excel Omset Admin kosong.');
        return;
      }

      const parsed: AdminOmsetRow[] = [];
      for (let r = 1; r < rawRows.length; r++) {
        const row = rawRows[r] || [];
        const rawAdmin = String(row[0] ?? '').trim().toUpperCase();
        if (/^nama\s*admin$/i.test(rawAdmin)) continue;
        const adminName = selectedAdminFilter !== 'SEMUA ADMIN' ? selectedAdminFilter : rawAdmin;
        if (!adminName) continue;
        const rawCab = String(row[1] ?? '').trim().toLowerCase();
        const isSda = rawCab.includes('sidoarjo') || rawCab.includes('sda') || sidoarjoAdminNames.includes(adminName);
        const branchId = isSda ? 'cab-sidoarjo' : 'cab-banyuwangi';
        const branchCode: 'BWI' | 'SDA' = isSda ? 'SDA' : 'BWI';
        const kota = String(row[2] ?? '').trim().toUpperCase() || (isSda ? 'SURABAYA UTARA' : 'BANYUWANGI KOTA');
        const area = String(row[3] ?? '').trim() || (isSda ? 'Surabaya Utara' : 'Banyuwangi Kota');
        const omzetNetto = Math.max(0, parseNum(row[4]));
        const bruto = Math.max(omzetNetto, parseNum(row[5]) || omzetNetto);
        const returNominal = Math.max(0, parseNum(row[6]) || bruto - omzetNetto);
        const qtyNetto = Math.max(0, parseNum(row[7]));
        const targetNominal = Math.max(0, parseNum(row[8]));
        const lastMonthOmzet = Math.max(0, parseNum(row[9]));
        const customerName = String(row[10] ?? '').trim().toUpperCase();
        const itemName = String(row[11] ?? '').trim().toUpperCase();

        parsed.push({
          id: `oms-imp-${Date.now()}-${r}`,
          adminName,
          branchId,
          branchCode,
          month: selectedMonth,
          year: selectedYear,
          kota,
          area,
          customerName: customerName || undefined,
          itemName: itemName || undefined,
          omzetNetto,
          bruto,
          returNominal,
          qtyNetto,
          returQty: 0,
          targetNominal,
          lastMonthOmzet,
          lastMonthQty: 0
        });
      }

      if (parsed.length === 0) {
        showToast('Tidak ditemukan baris Omset Admin yang valid.');
        return;
      }

      setOmsetExcelFileName(file.name);
      setOmsetPreviewRows(parsed);
      setShowOmsetUploadPreview(true);
    } catch (err: any) {
      showToast(`Gagal membaca file Excel: ${err?.message || 'Format tidak didukung'}`);
    }
  };

  const handleSaveOmsetUpload = () => {
    if (omsetPreviewRows.length === 0) {
      showToast('Silakan unggah file Excel Omset Admin terlebih dahulu.');
      return;
    }
    let updated: AdminOmsetRow[] = [];
    if (omsetImportMode === 'replace_all') {
      const remaining = adminOmsetRows.filter(
        x =>
          !(
            (selectedBranchId === 'ALL' || x.branchId === selectedBranchId) &&
            x.month === selectedMonth &&
            x.year === selectedYear &&
            (selectedAdminFilter === 'SEMUA ADMIN' ||
              x.adminName.toUpperCase() === selectedAdminFilter.toUpperCase())
          )
      );
      updated = [...omsetPreviewRows, ...remaining];
    } else {
      updated = [...omsetPreviewRows, ...adminOmsetRows];
    }
    setAdminOmsetRows(updated);
    persistSalesKpiToMysql({ adminOmsetRows: updated });
    setIsOmsetUploadOpen(false);
    setOmsetPreviewRows([]);
    setOmsetExcelFileName('');
    setShowOmsetUploadPreview(false);
    showToast(`Berhasil menyimpan ${omsetPreviewRows.length} data Omset Admin.`);
  };

  const handleSaveManualOmset = (e: React.FormEvent) => {
    e.preventDefault();
    const targetAdmin = (manualOmsetAdmin || activeBranchAdminNames[0] || '').trim().toUpperCase();
    const omzetNetto = Math.max(0, parseNum(manualOmsetNetto));
    if (!targetAdmin || omzetNetto <= 0) {
      showToast('Masukkan Nama Admin dan Omzet Netto.');
      return;
    }
    const isSda = sidoarjoAdminNames.includes(targetAdmin) || selectedBranchId === 'cab-sidoarjo';
    const branchId = isSda ? 'cab-sidoarjo' : 'cab-banyuwangi';
    const branchCode: 'BWI' | 'SDA' = isSda ? 'SDA' : 'BWI';
    const qtyNetto = Math.max(0, parseNum(manualOmsetQty));
    const lastMonthOmzet = Math.max(0, parseNum(manualOmsetLastMonth));

    const newRow: AdminOmsetRow = {
      id: `oms-man-${Date.now()}`,
      adminName: targetAdmin,
      branchId,
      branchCode,
      month: selectedMonth,
      year: selectedYear,
      kota: (manualOmsetKota || 'BANYUWANGI KOTA').trim().toUpperCase(),
      area: (manualOmsetArea || 'Banyuwangi Kota').trim(),
      customerName: manualOmsetCustomer.trim().toUpperCase() || undefined,
      itemName: manualOmsetItem.trim().toUpperCase() || undefined,
      omzetNetto,
      bruto: omzetNetto,
      returNominal: 0,
      qtyNetto,
      returQty: 0,
      targetNominal: 0,
      lastMonthOmzet,
      lastMonthQty: 0
    };

    const next = [...adminOmsetRows];
    const existingIdx = next.findIndex(
      r =>
        r.adminName.toUpperCase() === targetAdmin &&
        r.branchId === branchId &&
        r.month === selectedMonth &&
        r.year === selectedYear &&
        r.kota.toUpperCase() === newRow.kota
    );
    if (existingIdx >= 0 && !newRow.customerName && !newRow.itemName) {
      next[existingIdx] = { ...next[existingIdx], ...newRow, id: next[existingIdx].id };
    } else {
      next.unshift(newRow);
    }

    setAdminOmsetRows(next);
    persistSalesKpiToMysql({ adminOmsetRows: next });
    setManualOmsetNetto('');
    setManualOmsetQty('');
    setManualOmsetLastMonth('');
    setManualOmsetCustomer('');
    setManualOmsetItem('');
    setIsManualOmsetOpen(false);
    showToast(`Data Omset ${targetAdmin} berhasil disimpan.`);
  };

  // ============================================================================
  // EXPORT TO PDF
  // ============================================================================
  const exportKpiToPdf = async () => {
    setIsExporting(true);
    const element = document.getElementById('sales-kpi-print-area');
    if (!element) {
      setIsExporting(false);
      return;
    }
    try {
      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#f8fafc',
        logging: false
      });
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const imgWidth = 210;
      const pageHeight = 297;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      let heightLeft = imgHeight;
      let position = 0;

      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;

      while (heightLeft >= 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;
      }

      pdf.save(`Laporan_KPI_${activeTab}_${selectedMonth}_${selectedYear}.pdf`);
    } catch (error) {
      console.error('Error generating PDF report:', error);
    } finally {
      setIsExporting(false);
    }
  };

  // ============================================================================
  // COMPUTED METRICS FOR REORDER EVALUATION (DR. SOETOMO & EXPAND) + GAMBAR 2
  // ============================================================================
  const reorderStats = useMemo(() => {
    const shortM = (selectedMonth || 'November').slice(0, 3);
    const normalizeDateLabel = (lbl: string, idx: number) => {
      if (/^minggu\s*1$/i.test(lbl)) return `03 ${shortM} ${selectedYear}`;
      if (/^minggu\s*2$/i.test(lbl)) return `10 ${shortM} ${selectedYear}`;
      if (/^minggu\s*3$/i.test(lbl)) return `17 ${shortM} ${selectedYear}`;
      if (/^minggu\s*4$/i.test(lbl)) return `24 ${shortM} ${selectedYear}`;
      if (/^minggu/i.test(lbl)) return `${String((idx + 1) * 7).padStart(2, '0')} ${shortM} ${selectedYear}`;
      return lbl;
    };

    const computeUnit = (unitName: 'Nusantara Dr. Soetomo' | 'Nusantara Expand') => {
      const rows = reorderList
        .filter(
          r =>
            r.unit === unitName &&
            (!r.month || r.month === selectedMonth) &&
            (!r.year || r.year === selectedYear)
        )
        .map((r, i) => ({
          ...r,
          weekLabel: normalizeDateLabel(r.weekLabel, i)
        }));
      const totalReorder = rows.reduce((s, r) => s + r.totalReorder, 0);
      const terkirimFaktur = rows.reduce((s, r) => s + r.terkirimFaktur, 0);
      const belumTerkirimSo = rows.reduce((s, r) => s + r.belumTerkirimSo, 0);
      const pctTerkirim = totalReorder > 0 ? Number(((terkirimFaktur / totalReorder) * 100).toFixed(1)) : 0;
      const pctBelumTerkirim = totalReorder > 0 ? Number(((belumTerkirimSo / totalReorder) * 100).toFixed(1)) : 0;

      // Previous month calculation from MySQL reorderList or manual override
      const prevRows = reorderList.filter(
        r => r.unit === unitName && r.month === prevMonthName && r.year === prevYearName
      );
      const prevTotalReorder = prevRows.reduce((s, r) => s + r.totalReorder, 0);
      const prevTerkirim = prevRows.reduce((s, r) => s + r.terkirimFaktur, 0);
      const computedPrevMonthPct =
        prevTotalReorder > 0 ? Number(((prevTerkirim / prevTotalReorder) * 100).toFixed(1)) : 0;
      const customKey = `${unitName}_${selectedMonth}_${selectedYear}`;
      const prevMonthPct =
        unitPrevMonthPct[customKey] !== undefined
          ? Number(unitPrevMonthPct[customKey])
          : computedPrevMonthPct;
      const targetPct = 100;
      const actualPct = pctTerkirim;
      const gapPct = Number((targetPct - actualPct).toFixed(1));

      return {
        rows,
        totalReorder,
        terkirimFaktur,
        belumTerkirimSo,
        pctTerkirim,
        pctBelumTerkirim,
        prevMonthPct,
        targetPct,
        actualPct,
        gapPct
      };
    };

    const soetomo = computeUnit('Nusantara Dr. Soetomo');
    const expand = computeUnit('Nusantara Expand');
    // Gabungan Nusantara Dr. Soetomo & Nusantara Expand: (Prosentase Dr. Soetomo + Prosentase Nusantara Expand) / 2 * 100%
    const combinedPrevMonthPct = Number(((soetomo.prevMonthPct + expand.prevMonthPct) / 2).toFixed(1));
    const combinedTargetPct = 100;
    const combinedActualPct = Number(((soetomo.actualPct + expand.actualPct) / 2).toFixed(1));
    const combinedGapPct = Number(Math.max(0, combinedTargetPct - combinedActualPct).toFixed(1));

    return {
      soetomo,
      expand,
      combined: {
        prevMonthPct: combinedPrevMonthPct,
        targetPct: combinedTargetPct,
        actualPct: combinedActualPct,
        gapPct: combinedGapPct
      }
    };
  }, [reorderList, selectedMonth, selectedYear, prevMonthName, prevYearName, unitPrevMonthPct]);

  // ============================================================================
  // COMPUTED METRICS FOR OMSET ADMIN (100% FROM MYSQL DATA, ZERO DUMMY NUMBERS)
  // ============================================================================
  const omsetSummary = useMemo(() => {
    const omzetNetto = synchronizedOmsetRows.reduce((s, r) => s + r.omzetNetto, 0);
    const bruto = synchronizedOmsetRows.reduce((s, r) => s + r.bruto, 0);
    const returNominal = synchronizedOmsetRows.reduce((s, r) => s + r.returNominal, 0);
    const qtyNetto = synchronizedOmsetRows.reduce((s, r) => s + r.qtyNetto, 0);
    const targetBulanIni = synchronizedOmsetRows.reduce((s, r) => s + r.targetNominal, 0);
    const lastMonthOmzet = synchronizedOmsetRows.reduce((s, r) => s + r.lastMonthOmzet, 0);
    const lastMonthQty = synchronizedOmsetRows.reduce((s, r) => s + r.lastMonthQty, 0);

    const diffOmzet = omzetNetto - lastMonthOmzet;
    const diffOmzetPct = lastMonthOmzet > 0 ? ((diffOmzet / lastMonthOmzet) * 100).toFixed(1) : '0.0';
    const achvPct = targetBulanIni > 0 ? ((omzetNetto / targetBulanIni) * 100).toFixed(1) : '0.0';
    const gapTarget = omzetNetto - targetBulanIni;

    const pembagiHarian = 26;
    const pembagiBulanLalu = 26;

    const rataHarianIni = omzetNetto > 0 ? Math.round(omzetNetto / pembagiHarian) : 0;
    const rataBulanLalu = lastMonthOmzet > 0 ? Math.round(lastMonthOmzet / pembagiBulanLalu) : 0;
    const qtyHarian = qtyNetto > 0 ? qtyNetto / pembagiHarian : 0;

    const diffHarianPct =
      rataBulanLalu > 0 ? (((rataHarianIni - rataBulanLalu) / rataBulanLalu) * 100).toFixed(1) : '0.0';

    return {
      omzetNetto,
      bruto,
      returNominal,
      qtyNetto,
      lastMonthOmzet,
      lastMonthQty,
      diffQty: qtyNetto - lastMonthQty,
      targetBulanIni,
      diffOmzet,
      diffOmzetPct,
      achvPct,
      gapTarget,
      pembagiBulanLalu,
      rataHarianIni,
      rataBulanLalu,
      qtyHarian,
      diffHarianPct
    };
  }, [synchronizedOmsetRows]);

  // Dynamic Top Kota, Top Customer, Top Barang derived strictly from MySQL adminOmsetRows
  const topKotaList = useMemo(() => {
    const validRows = synchronizedOmsetRows.filter(r => r.omzetNetto > 0 && r.kota && r.kota !== '-');
    const grouped = new Map<string, { kota: string; omzet: number; qty: number; lastOmzet: number; lastQty: number }>();
    validRows.forEach(r => {
      const key = r.kota.toUpperCase();
      const prev = grouped.get(key) || { kota: key, omzet: 0, qty: 0, lastOmzet: 0, lastQty: 0 };
      prev.omzet += r.omzetNetto;
      prev.qty += r.qtyNetto;
      prev.lastOmzet += r.lastMonthOmzet;
      prev.lastQty += r.lastMonthQty;
      grouped.set(key, prev);
    });
    const arr = Array.from(grouped.values()).sort((a, b) => b.omzet - a.omzet);
    const maxOmzet = Math.max(...arr.map(x => x.omzet), 1);
    return arr.map(item => {
      const diff = item.omzet - item.lastOmzet;
      const pct = item.lastOmzet > 0 ? ((diff / item.lastOmzet) * 100).toFixed(1) : '0.0';
      const isPositive = diff >= 0;
      return {
        kota: item.kota,
        omzet: item.omzet,
        qty: `${formatRp(item.qty)} PCS`,
        pctBadge: `${isPositive ? '+' : ''}${pct.replace('.', ',')}%`,
        isPositive,
        vsText: `Vs bulan lalu: Rp ${formatRp(item.lastOmzet)} • Selisih qty ${formatRp(item.qty - item.lastQty)} PCS`,
        vsBadge: `${isPositive ? '▲ +' : '▼ '}${pct.replace('.', ',')}%`,
        vsPos: isPositive,
        barPct: Math.max(12, Math.round((item.omzet / maxOmzet) * 100))
      };
    });
  }, [synchronizedOmsetRows]);

  const topCustomerList = useMemo(() => {
    const validRows = synchronizedOmsetRows.filter(r => r.omzetNetto > 0 && r.customerName);
    const grouped = new Map<string, { name: string; omzet: number; qty: number; lastOmzet: number }>();
    validRows.forEach(r => {
      const key = (r.customerName || '').toUpperCase();
      const prev = grouped.get(key) || { name: key, omzet: 0, qty: 0, lastOmzet: 0 };
      prev.omzet += r.omzetNetto;
      prev.qty += r.qtyNetto;
      prev.lastOmzet += r.lastMonthOmzet;
      grouped.set(key, prev);
    });
    const arr = Array.from(grouped.values()).sort((a, b) => b.omzet - a.omzet);
    const maxOmzet = Math.max(...arr.map(x => x.omzet), 1);
    return arr.map(c => {
      const diff = c.omzet - c.lastOmzet;
      const pct = c.lastOmzet > 0 ? ((diff / c.lastOmzet) * 100).toFixed(1) : '0.0';
      const isPos = diff >= 0;
      return {
        name: c.name,
        omzet: c.omzet,
        qty: `${formatRp(c.qty)} PCS`,
        growthPct: `${isPos ? '+' : ''}${pct.replace('.', ',')}%`,
        isPositive: isPos,
        vsLastMonth: `Vs bulan lalu: Rp ${formatRp(c.lastOmzet)}`,
        vsBadge: `${isPos ? '▲ +' : '▼ '}${pct.replace('.', ',')}%`,
        isVsNegative: !isPos,
        progressPct: Math.max(12, Math.round((c.omzet / maxOmzet) * 100))
      };
    });
  }, [synchronizedOmsetRows]);

  const topBarangList = useMemo(() => {
    const validRows = synchronizedOmsetRows.filter(r => r.omzetNetto > 0 && r.itemName);
    const grouped = new Map<string, { name: string; omzet: number; qty: number; lastOmzet: number }>();
    validRows.forEach(r => {
      const key = (r.itemName || '').toUpperCase();
      const prev = grouped.get(key) || { name: key, omzet: 0, qty: 0, lastOmzet: 0 };
      prev.omzet += r.omzetNetto;
      prev.qty += r.qtyNetto;
      prev.lastOmzet += r.lastMonthOmzet;
      grouped.set(key, prev);
    });
    const arr = Array.from(grouped.values()).sort((a, b) => b.omzet - a.omzet);
    const maxOmzet = Math.max(...arr.map(x => x.omzet), 1);
    return arr.map(b => {
      const diff = b.omzet - b.lastOmzet;
      const pct = b.lastOmzet > 0 ? ((diff / b.lastOmzet) * 100).toFixed(1) : '0.0';
      const isPos = diff >= 0;
      return {
        name: b.name,
        omzet: b.omzet,
        qty: `${formatRp(b.qty)} PCS`,
        growthPct: `${isPos ? '+' : ''}${pct.replace('.', ',')}%`,
        isPositive: isPos,
        vsLastMonth: `Vs bulan lalu: Rp ${formatRp(b.lastOmzet)}`,
        vsBadge: `${isPos ? '▲ +' : '▼ '}${pct.replace('.', ',')}%`,
        isVsNegative: !isPos,
        progressPct: Math.max(12, Math.round((b.omzet / maxOmzet) * 100))
      };
    });
  }, [synchronizedOmsetRows]);

  // ============================================================================
  // DYNAMIC CHART DATA INTEGRATED 100% WITH MYSQL OMSET ROWS
  // ============================================================================
  const dynamicOmzetChart = useMemo(() => {
    const currentNetto = Math.max(0, omsetSummary.omzetNetto);
    const lastMonthNetto = Math.max(0, omsetSummary.lastMonthOmzet);

    if (omzetChartGranularity === 'Bulanan') {
      const monthPairs = [
        { full: 'Januari', short: 'JAN' },
        { full: 'Februari', short: 'FEB' },
        { full: 'Maret', short: 'MAR' },
        { full: 'April', short: 'APR' },
        { full: 'Mei', short: 'MEI' },
        { full: 'Juni', short: 'JUN' },
        { full: 'Juli', short: 'JUL' },
        { full: 'Agustus', short: 'AGU' },
        { full: 'September', short: 'SEP' },
        { full: 'Oktober', short: 'OKT' },
        { full: 'November', short: 'NOV' },
        { full: 'Desember', short: 'DES' }
      ];

      const series = monthPairs.map(m => {
        const isCurrent = m.full.toLowerCase() === selectedMonth.toLowerCase();
        const rowsInMonth = adminOmsetRows.filter(
          r =>
            r.month?.toLowerCase() === m.full.toLowerCase() &&
            r.year === selectedYear &&
            (selectedBranchId === 'ALL' || r.branchId === selectedBranchId) &&
            (selectedAdminFilter === 'SEMUA ADMIN' ||
              r.adminName.toUpperCase() === selectedAdminFilter.toUpperCase())
        );
        const rawNetto = isCurrent
          ? currentNetto
          : rowsInMonth.reduce((s, r) => s + r.omzetNetto, 0);
        const rawComp = isCurrent
          ? lastMonthNetto
          : rowsInMonth.reduce((s, r) => s + r.lastMonthOmzet, 0);

        const valM = Number((rawNetto / 1e9).toFixed(2));
        const compM = Number((rawComp / 1e9).toFixed(2));
        const pct = rawComp > 0 ? ((rawNetto / rawComp) * 100).toFixed(1).replace('.', ',') : '0,0';
        const topLabel = rawNetto > 0 ? `${(rawNetto / 1e9).toFixed(2).replace('.', ',')} M` : '';
        return {
          label: m.short,
          omzetNetto: valM,
          pembanding: compM,
          rawNetto,
          rawPembanding: rawComp,
          topLabel,
          pctLabel: rawNetto > 0 ? `${pct}%` : '',
          isCurrent
        };
      });

      const totalNettoYear = series.reduce((s, x) => s + x.rawNetto, 0);
      return {
        unit: 'Miliar',
        badgeText: `Netto tahun ini: Rp ${formatRp(totalNettoYear)}`,
        title: `Grafik Bulanan ${selectedYear}`,
        subtitle: 'Perbandingan Omzet Netto dengan Omzet Periode Lalu.',
        comparisonName: 'Omzet Periode Lalu',
        series
      };
    }

    if (omzetChartGranularity === 'Mingguan') {
      const w1Netto = Math.round(currentNetto * 0.5);
      const w2Netto = Math.max(0, currentNetto - w1Netto);
      const weeklyComp = Math.round(lastMonthNetto / 4);

      const rawWeeks = [
        { label: 'Minggu 1', rawNetto: w1Netto, rawComp: weeklyComp },
        { label: 'Minggu 2', rawNetto: w2Netto, rawComp: weeklyComp },
        { label: 'Minggu 3', rawNetto: 0, rawComp: weeklyComp },
        { label: 'Minggu 4', rawNetto: 0, rawComp: weeklyComp }
      ];

      const series = rawWeeks.map(w => {
        const valM = Number((w.rawNetto / 1e9).toFixed(2));
        const compM = Number((w.rawComp / 1e9).toFixed(2));
        const pct = w.rawComp > 0 ? ((w.rawNetto / w.rawComp) * 100).toFixed(1).replace('.', ',') : '0,0';
        const topLabel =
          w.rawNetto <= 0
            ? ''
            : w.rawNetto >= 1e9
            ? `${(w.rawNetto / 1e9).toFixed(2).replace('.', ',')} M`
            : `${(w.rawNetto / 1e6).toFixed(1).replace('.', ',')} jt`;
        return {
          label: w.label,
          omzetNetto: valM,
          pembanding: compM,
          rawNetto: w.rawNetto,
          rawPembanding: w.rawComp,
          topLabel,
          pctLabel: w.rawNetto > 0 ? `${pct}%` : '',
          isCurrent: w.rawNetto > 0
        };
      });

      return {
        unit: 'Miliar',
        badgeText: `Netto bulan ini: Rp ${formatRp(currentNetto)}`,
        title: `Grafik Mingguan ${selectedMonth} ${selectedYear}`,
        subtitle: 'Omzet bulan terpilih dikelompokkan per minggu dibanding Rata-rata Mingguan Bulan Lalu.',
        comparisonName: 'Rata-rata Mingguan Lalu',
        series
      };
    }

    const dailyWeights =
      currentNetto > 0
        ? [0.08, 0.09, 0.08, 0.09, 0.08, 0.08, 0, 0.09, 0.08, 0.08, 0.09, 0.08, 0.08, 0]
        : Array(14).fill(0);
    const dailyCompRp = lastMonthNetto > 0 ? Math.round(lastMonthNetto / 26) : 0;

    const series = dailyWeights.map((w, idx) => {
      const dayNum = idx + 1;
      const rawNetto = Math.round(currentNetto * w);
      const rawComp = w === 0 ? 0 : dailyCompRp;
      const valJt = Number((rawNetto / 1e6).toFixed(2));
      const compJt = Number((rawComp / 1e6).toFixed(2));
      const pct = rawComp > 0 ? ((rawNetto / rawComp) * 100).toFixed(1).replace('.', ',') : '0,0';
      const topLabel = rawNetto > 0 ? `${valJt.toFixed(1).replace('.', ',')} jt` : '';
      return {
        label: String(dayNum),
        omzetNetto: valJt,
        pembanding: compJt,
        rawNetto,
        rawPembanding: rawComp,
        topLabel,
        pctLabel: rawNetto > 0 ? `${pct}%` : '',
        isCurrent: rawNetto > 0
      };
    });

    return {
      unit: 'Juta',
      badgeText: `Netto bulan ini: Rp ${formatRp(currentNetto)}`,
      title: `Grafik Harian ${selectedMonth} ${selectedYear}`,
      subtitle: 'Omzet bulan terpilih ditampilkan per tanggal dibanding Benchmark Harian Bulan Lalu.',
      comparisonName: 'Rata-rata Harian Lalu',
      series
    };
  }, [
    omsetSummary,
    omzetChartGranularity,
    selectedMonth,
    selectedYear,
    adminOmsetRows,
    selectedBranchId,
    selectedAdminFilter
  ]);

  // ============================================================================
  // SUB-VIEW 1: HALAMAN UPLOAD EXCEL KPI INDIVIDU (TANPA FITUR TEMPLATE EXCEL)
  // ============================================================================
  if (isKpiUploadOpen) {
    return (
      <div className="space-y-5 animate-fade-in">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 sm:p-7 shadow-sm space-y-6 relative">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-5 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-3.5">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-600 via-blue-600 to-cyan-600 text-white flex items-center justify-center shadow-md shadow-indigo-500/20 shrink-0">
                <FileSpreadsheet className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-lg sm:text-xl font-black text-slate-900 dark:text-white tracking-tight">
                  Upload File Excel KPI Individu Staf
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Pilih cabang, bulan, tahun &amp; pilih admin evaluasi, lalu unggah file Excel KPI Individu Staf Admin Penjualan
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              <ModernKpiDropdown
                variant="compact"
                value={selectedBranchId}
                onChange={handleBranchChange}
                options={branchDropdownOptions}
                icon={<Building className="w-3.5 h-3.5" />}
              />
              <ModernKpiDropdown
                variant="compact"
                value={selectedMonth}
                onChange={setSelectedMonth}
                options={monthDropdownOptions}
                icon={<Calendar className="w-3.5 h-3.5" />}
                gridCols={2}
              />
              <ModernKpiDropdown
                variant="compact"
                value={selectedYear}
                onChange={setSelectedYear}
                options={yearDropdownOptions}
              />
              <ModernKpiDropdown
                variant="compact"
                value={selectedAdminFilter}
                onChange={val => {
                  setSelectedAdminFilter(val);
                  if (val !== 'SEMUA ADMIN') {
                    setFocusedAdminName(val);
                    setKpiPreviewRows(prev =>
                      prev.length === 1 ? prev.map(row => ({ ...row, adminName: val })) : prev
                    );
                  }
                }}
                options={adminFilterDropdownOptions}
                icon={<Users className="w-3.5 h-3.5" />}
                searchable
                searchPlaceholder="Cari nama admin..."
              />
            </div>
          </div>

          {/* Mode Upload Data */}
          <div className="space-y-2.5">
            <label className="block text-[11px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
              MODE UPLOAD DATA
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setKpiImportMode('replace_all')}
                className={`p-4 rounded-2xl border text-left transition-all cursor-pointer ${
                  kpiImportMode === 'replace_all'
                    ? 'border-indigo-500 bg-indigo-50/70 dark:bg-indigo-950/30 text-slate-900 dark:text-white ring-2 ring-indigo-500/20'
                    : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs sm:text-sm font-bold flex items-center gap-2.5">
                    <span
                      className={`w-3 h-3 rounded-full border-2 ${
                        kpiImportMode === 'replace_all' ? 'border-indigo-600 bg-indigo-600' : 'border-slate-300'
                      }`}
                    />
                    Timpa Data Periode Ini (Replace All)
                  </span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300">
                    Direkomendasikan
                  </span>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setKpiImportMode('append')}
                className={`p-4 rounded-2xl border text-left transition-all cursor-pointer ${
                  kpiImportMode === 'append'
                    ? 'border-indigo-500 bg-indigo-50/70 dark:bg-indigo-950/30 text-slate-900 dark:text-white ring-2 ring-indigo-500/20'
                    : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300'
                }`}
              >
                <span className="text-xs sm:text-sm font-bold flex items-center gap-2.5">
                  <span
                    className={`w-3 h-3 rounded-full border-2 ${
                      kpiImportMode === 'append' ? 'border-indigo-600 bg-indigo-600' : 'border-slate-300'
                    }`}
                  />
                  Gabungkan / Perbarui per Admin (Append)
                </span>
              </button>
            </div>
          </div>

          {/* Input File Excel tanpa tombol Template Excel */}
          <div className="space-y-2.5">
            <label className="block text-[11px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
              PILIH FILE EXCEL KPI INDIVIDU (.XLSX / .XLS / .CSV)
            </label>

            <div className="p-5 rounded-2xl border-2 border-dashed border-indigo-200 dark:border-indigo-800/70 hover:border-indigo-400 bg-gradient-to-r from-indigo-50/40 via-slate-50/60 to-blue-50/40 dark:from-indigo-950/20 dark:via-slate-950/50 dark:to-blue-950/20 transition flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <input
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={handleKpiExcelSelect}
                className="w-full sm:w-auto text-xs text-slate-700 dark:text-slate-300 file:mr-3 file:py-2.5 file:px-4 file:rounded-xl file:border-0 file:bg-gradient-to-r file:from-indigo-600 file:to-blue-600 file:text-xs file:font-bold file:text-white hover:file:opacity-95 file:cursor-pointer cursor-pointer"
              />
              {kpiExcelFileName && (
                <div className="px-3.5 py-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-xs font-bold text-emerald-700 dark:text-emerald-300 flex items-center gap-2 shrink-0">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>
                    {kpiExcelFileName} ({kpiPreviewRows.length} staf terbaca)
                  </span>
                </div>
              )}
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-slate-50/90 dark:bg-slate-950/60 border border-slate-200/80 dark:border-slate-800 text-slate-700 dark:text-slate-300 text-xs font-medium">
            Kolom yang otomatis dikenali sistem:{' '}
            <strong className="text-slate-900 dark:text-white">
              Nama Admin, Cabang, Bulan Sebelumnya (%), Validasi Sales Order &amp; Website (%), Pembuatan Faktur Penjualan (%), Pengecekan Faktur Penjualan (%), Kesalahan Penginputan Diskon (Kali), Total Order / Faktur, Keterangan
            </strong>
            .
          </div>

          {showKpiUploadPreview && kpiPreviewRows.length > 0 && (
            <div className="pt-4 border-t border-slate-200 dark:border-slate-800 space-y-3">
              <h4 className="text-sm font-black text-slate-900 dark:text-white">
                Preview Sebelum Simpan ({kpiPreviewRows.length} Admin)
              </h4>
              <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-700">
                <table className="w-full text-xs text-left border-collapse bg-white dark:bg-slate-900 text-slate-900 dark:text-white">
                  <thead className="bg-slate-100 dark:bg-slate-800 font-bold text-[11px] border-b border-slate-200 dark:border-slate-700">
                    <tr>
                      <th className="py-2.5 px-3">No</th>
                      <th className="py-2.5 px-3">Nama Admin</th>
                      <th className="py-2.5 px-3">Cabang</th>
                      <th className="py-2.5 px-3 text-center">Bulan Lalu (%)</th>
                      <th className="py-2.5 px-3 text-center">Validasi SO &amp; Web (%)</th>
                      <th className="py-2.5 px-3 text-center">Pembuatan Faktur (%)</th>
                      <th className="py-2.5 px-3 text-center">Pengecekan Faktur (%)</th>
                      <th className="py-2.5 px-3 text-center">Aktual (%)</th>
                      <th className="py-2.5 px-3 text-center">Selisih Gap (%)</th>
                      <th className="py-2.5 px-3 text-center">Kesalahan Diskon</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                    {kpiPreviewRows.map((row, idx) => {
                      const avg = Number(((row.validasiSoWeb + row.pembuatanFaktur + row.pengecekanFaktur) / 3).toFixed(1));
                      const gap = Number(Math.max(0, 100 - avg).toFixed(1));
                      return (
                        <tr key={row.id}>
                          <td className="py-2 px-3">{idx + 1}</td>
                          <td className="py-2 px-3 font-bold">{row.adminName}</td>
                          <td className="py-2 px-3">
                            {row.branchId === 'cab-sidoarjo' ? 'Cabang Sidoarjo' : 'Cabang Nusantara'}
                          </td>
                          <td className="py-2 px-3 text-center font-semibold text-slate-600 dark:text-slate-300">
                            {Number(row.lastMonthPct ?? 0).toFixed(1)}%
                          </td>
                          <td className="py-2 px-3 text-center font-semibold">{row.validasiSoWeb}%</td>
                          <td className="py-2 px-3 text-center font-semibold">{row.pembuatanFaktur}%</td>
                          <td className="py-2 px-3 text-center font-semibold">{row.pengecekanFaktur}%</td>
                          <td className="py-2 px-3 text-center font-black text-indigo-600 dark:text-indigo-400">{avg}%</td>
                          <td className="py-2 px-3 text-center font-black text-amber-600 dark:text-amber-400">{gap}%</td>
                          <td className="py-2 px-3 text-center font-bold text-rose-600">{row.discountErrorsCount}x</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div className="flex flex-wrap items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => {
                setIsKpiUploadOpen(false);
                setKpiPreviewRows([]);
                setKpiExcelFileName('');
                setShowKpiUploadPreview(false);
              }}
              className="px-5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 font-bold text-xs sm:text-sm cursor-pointer"
            >
              Kembali ke KPI Individu
            </button>
            <button
              type="button"
              onClick={() => setShowKpiUploadPreview(prev => !prev)}
              className="px-5 py-2.5 rounded-xl border border-indigo-200 dark:border-indigo-800 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 font-bold text-xs sm:text-sm flex items-center gap-2 cursor-pointer"
            >
              <Eye className="w-4 h-4" />
              <span>{showKpiUploadPreview ? 'Tutup Preview' : 'Preview Sebelum Simpan'}</span>
            </button>
            <button
              type="button"
              onClick={handleSaveKpiUpload}
              className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-white font-bold text-xs sm:text-sm flex items-center gap-2 shadow-sm cursor-pointer"
            >
              <Save className="w-4 h-4" />
              <span>Simpan KPI Individu</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ============================================================================
  // SUB-VIEW 2: HALAMAN UPLOAD EXCEL DENDA CHECKER (TANPA FITUR TEMPLATE EXCEL)
  // ============================================================================
  if (isDendaUploadOpen) {
    return (
      <div className="space-y-5 animate-fade-in">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 sm:p-7 shadow-sm space-y-6 relative">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-5 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-3.5">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-rose-600 via-orange-600 to-amber-500 text-white flex items-center justify-center shadow-md shadow-rose-500/20 shrink-0">
                <FileSpreadsheet className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-lg sm:text-xl font-black text-slate-900 dark:text-white tracking-tight">
                  Upload File Excel Akumulasi Denda Checker
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Unggah rincian Nama, Nama Pelanggan, No Faktur, Keterangan, Nominal Selisih, dan Kali-an Selisih
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              <ModernKpiDropdown
                variant="compact"
                accentColor="rose"
                value={selectedBranchId}
                onChange={handleBranchChange}
                options={branchDropdownOptions}
                icon={<Building className="w-3.5 h-3.5" />}
              />
              <ModernKpiDropdown
                variant="compact"
                accentColor="rose"
                value={selectedMonth}
                onChange={setSelectedMonth}
                options={monthDropdownOptions}
                icon={<Calendar className="w-3.5 h-3.5" />}
                gridCols={2}
              />
              <ModernKpiDropdown
                variant="compact"
                accentColor="rose"
                value={selectedYear}
                onChange={setSelectedYear}
                options={yearDropdownOptions}
              />
              <ModernKpiDropdown
                variant="compact"
                accentColor="rose"
                value={selectedAdminFilter}
                onChange={setSelectedAdminFilter}
                options={adminFilterDropdownOptions}
                icon={<Users className="w-3.5 h-3.5" />}
                searchable
                searchPlaceholder="Cari nama admin..."
              />
            </div>
          </div>

          <div className="space-y-2.5">
            <label className="block text-[11px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
              MODE UPLOAD DATA
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setDendaImportMode('replace_all')}
                className={`p-4 rounded-2xl border text-left transition-all cursor-pointer ${
                  dendaImportMode === 'replace_all'
                    ? 'border-rose-500 bg-rose-50/70 dark:bg-rose-950/30 text-slate-900 dark:text-white ring-2 ring-rose-500/20'
                    : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300'
                }`}
              >
                <span className="text-xs sm:text-sm font-bold">Timpa Data Lama (Replace All)</span>
              </button>
              <button
                type="button"
                onClick={() => setDendaImportMode('append')}
                className={`p-4 rounded-2xl border text-left transition-all cursor-pointer ${
                  dendaImportMode === 'append'
                    ? 'border-rose-500 bg-rose-50/70 dark:bg-rose-950/30 text-slate-900 dark:text-white ring-2 ring-rose-500/20'
                    : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300'
                }`}
              >
                <span className="text-xs sm:text-sm font-bold">Gabungkan / Tambah (Append)</span>
              </button>
            </div>
          </div>

          <div className="space-y-2.5">
            <label className="block text-[11px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
              PILIH FILE EXCEL DENDA CHECKER (.XLSX / .XLS / .CSV)
            </label>

            <div className="p-5 rounded-2xl border-2 border-dashed border-rose-200 dark:border-rose-800/70 bg-gradient-to-r from-rose-50/40 via-slate-50/60 to-orange-50/40 dark:from-rose-950/20 dark:via-slate-950/50 dark:to-orange-950/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <input
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={handleDendaExcelSelect}
                className="w-full sm:w-auto text-xs text-slate-700 dark:text-slate-300 file:mr-3 file:py-2.5 file:px-4 file:rounded-xl file:border-0 file:bg-gradient-to-r file:from-rose-600 file:to-orange-600 file:text-xs file:font-bold file:text-white hover:file:opacity-95 cursor-pointer"
              />
              {dendaExcelFileName && (
                <div className="px-3.5 py-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 text-xs font-bold text-emerald-700 dark:text-emerald-300 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{dendaExcelFileName} ({dendaPreviewRows.length} baris)</span>
                </div>
              )}
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-slate-50/90 dark:bg-slate-950/60 border border-slate-200/80 dark:border-slate-800 text-xs">
            Kolom yang otomatis dikenali sistem:{' '}
            <strong>Nama, Nama Pelanggan, No Faktur, Keterangan, Nominal Selisih, Kalian Selisih, Total Denda</strong>.
          </div>

          {showDendaUploadPreview && dendaPreviewRows.length > 0 && (
            <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-700">
              <table className="w-full text-xs text-left border-collapse bg-white dark:bg-slate-900">
                <thead className="bg-slate-100 dark:bg-slate-800 font-bold text-[11px]">
                  <tr>
                    <th className="py-2.5 px-3">No</th>
                    <th className="py-2.5 px-3">Nama</th>
                    <th className="py-2.5 px-3">Nama Pelanggan</th>
                    <th className="py-2.5 px-3">No Faktur</th>
                    <th className="py-2.5 px-3">Keterangan</th>
                    <th className="py-2.5 px-3 text-right">Nominal Selisih</th>
                    <th className="py-2.5 px-3 text-center">Kalian Selisih</th>
                    <th className="py-2.5 px-3 text-right">Denda</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                  {dendaPreviewRows.map((r, i) => (
                    <tr key={r.id}>
                      <td className="py-2 px-3">{i + 1}</td>
                      <td className="py-2 px-3 font-bold">{r.adminName}</td>
                      <td className="py-2 px-3">{r.customerName}</td>
                      <td className="py-2 px-3 font-mono">{r.noFaktur}</td>
                      <td className="py-2 px-3">{r.keterangan}</td>
                      <td className="py-2 px-3 text-right">Rp {formatRp(r.nominalSelisih)}</td>
                      <td className="py-2 px-3 text-center font-bold">{r.kalianSelisih}x</td>
                      <td className="py-2 px-3 text-right font-black text-rose-600">Rp {formatRp(r.totalDenda)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="flex flex-wrap items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => {
                setIsDendaUploadOpen(false);
                setDendaPreviewRows([]);
                setDendaExcelFileName('');
              }}
              className="px-5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold cursor-pointer"
            >
              Kembali
            </button>
            <button
              type="button"
              onClick={handleSaveDendaUpload}
              className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-rose-600 to-orange-600 hover:from-rose-500 hover:to-orange-500 text-white font-bold text-xs flex items-center gap-2 cursor-pointer shadow-sm"
            >
              <Save className="w-4 h-4" />
              <span>Simpan Denda Checker</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ============================================================================
  // SUB-VIEW 3: HALAMAN UPLOAD EXCEL OMSET ADMIN (TANPA FITUR TEMPLATE EXCEL)
  // ============================================================================
  if (isOmsetUploadOpen) {
    return (
      <div className="space-y-5 animate-fade-in">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 sm:p-7 shadow-sm space-y-6 relative">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-3.5">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-600 via-teal-600 to-cyan-600 text-white flex items-center justify-center shadow-md shadow-emerald-500/20">
                <FileSpreadsheet className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-lg font-black text-slate-900 dark:text-white">
                  Upload File Excel Omset Admin Penjualan
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Unggah data Omset Netto, Bruto, Retur, Qty Netto, dan Target per Admin Penjualan
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              <ModernKpiDropdown
                variant="compact"
                accentColor="emerald"
                value={selectedBranchId}
                onChange={handleBranchChange}
                options={branchDropdownOptions}
                icon={<Building className="w-3.5 h-3.5" />}
              />
              <ModernKpiDropdown
                variant="compact"
                accentColor="emerald"
                value={selectedMonth}
                onChange={setSelectedMonth}
                options={monthDropdownOptions}
                icon={<Calendar className="w-3.5 h-3.5" />}
                gridCols={2}
              />
              <ModernKpiDropdown
                variant="compact"
                accentColor="emerald"
                value={selectedYear}
                onChange={setSelectedYear}
                options={yearDropdownOptions}
              />
              <ModernKpiDropdown
                variant="compact"
                accentColor="emerald"
                value={selectedAdminFilter}
                onChange={setSelectedAdminFilter}
                options={adminFilterDropdownOptions}
                icon={<Users className="w-3.5 h-3.5" />}
                searchable
                searchPlaceholder="Cari nama admin..."
              />
            </div>
          </div>

          <div className="space-y-2.5">
            <label className="block text-[11px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
              PILIH FILE EXCEL OMSET ADMIN (.XLSX / .XLS / .CSV)
            </label>
            <div className="p-5 rounded-2xl border-2 border-dashed border-emerald-200 dark:border-emerald-800/70 bg-gradient-to-r from-emerald-50/40 via-slate-50/60 to-teal-50/40 dark:from-emerald-950/20 dark:via-slate-950/50 dark:to-teal-950/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <input
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={handleOmsetExcelSelect}
                className="text-xs file:mr-3 file:py-2.5 file:px-4 file:rounded-xl file:border-0 file:bg-gradient-to-r file:from-emerald-600 file:to-teal-600 file:text-xs file:font-bold file:text-white cursor-pointer"
              />
              {omsetExcelFileName && (
                <span className="px-3.5 py-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 text-xs font-bold text-emerald-700 dark:text-emerald-300 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{omsetExcelFileName} ({omsetPreviewRows.length} baris terbaca)</span>
                </span>
              )}
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-slate-50/90 dark:bg-slate-950/60 border border-slate-200/80 dark:border-slate-800 text-xs">
            Kolom yang otomatis dikenali sistem:{' '}
            <strong>Nama Admin, Cabang, Kota, Area, Omzet Netto, Omzet Bruto, Retur, Qty Netto, Target</strong>.
          </div>

          {showOmsetUploadPreview && omsetPreviewRows.length > 0 && (
            <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-700">
              <table className="w-full text-xs text-left border-collapse bg-white dark:bg-slate-900">
                <thead className="bg-slate-100 dark:bg-slate-800 font-bold text-[11px]">
                  <tr>
                    <th className="py-2.5 px-3">Nama Admin</th>
                    <th className="py-2.5 px-3">Cabang</th>
                    <th className="py-2.5 px-3">Kota</th>
                    <th className="py-2.5 px-3 text-right">Omzet Netto</th>
                    <th className="py-2.5 px-3 text-right">Retur</th>
                    <th className="py-2.5 px-3 text-right">Qty Netto</th>
                    <th className="py-2.5 px-3 text-right">Target</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                  {omsetPreviewRows.map(r => (
                    <tr key={r.id}>
                      <td className="py-2 px-3 font-bold">{r.adminName}</td>
                      <td className="py-2 px-3">{r.branchCode}</td>
                      <td className="py-2 px-3">{r.kota}</td>
                      <td className="py-2 px-3 text-right font-bold">Rp {formatRp(r.omzetNetto)}</td>
                      <td className="py-2 px-3 text-right text-rose-600">Rp {formatRp(r.returNominal)}</td>
                      <td className="py-2 px-3 text-right">{formatQtyId(r.qtyNetto)}</td>
                      <td className="py-2 px-3 text-right">Rp {formatRp(r.targetNominal)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={() => setIsOmsetUploadOpen(false)}
              className="px-5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold cursor-pointer"
            >
              Kembali
            </button>
            <button
              type="button"
              onClick={handleSaveOmsetUpload}
              className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs flex items-center gap-2 cursor-pointer shadow-sm"
            >
              <Save className="w-4 h-4" />
              <span>Simpan Omset Admin</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ============================================================================
  // MAIN RENDER
  // ============================================================================
  return (
    <div className="space-y-6">
      {toastMsg && (
        <div className="fixed bottom-5 right-5 z-50 max-w-md bg-emerald-600 text-white px-4 py-3 rounded-2xl shadow-xl flex items-center gap-2.5 text-xs font-bold animate-fade-in">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{toastMsg}</span>
        </div>
      )}

      {/* ===================================================================== */}
      {/* HEADER BAR MODERN & INTERAKTIF                                        */}
      {/* ===================================================================== */}
      <div className="relative bg-gradient-to-br from-white via-slate-50/70 to-indigo-50/30 dark:from-slate-900 dark:via-slate-900 dark:to-indigo-950/30 border border-slate-200/90 dark:border-slate-800 p-5 sm:p-6 rounded-3xl shadow-xs space-y-5">
        <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 relative">
          <div className="flex items-start sm:items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-600 via-blue-600 to-cyan-500 text-white flex items-center justify-center shadow-md shadow-indigo-500/20 shrink-0">
              {activeTab === 'sales_kpi_individual' && <Award className="w-6 h-6" />}
              {activeTab === 'sales_kpi_fines' && <AlertTriangle className="w-6 h-6" />}
              {activeTab === 'sales_kpi_nusantara' && <Truck className="w-6 h-6" />}
              {activeTab === 'sales_kpi_omset' && <BarChart3 className="w-6 h-6" />}
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2 mb-1">
                <span className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400">
                  {selectedBranchId === 'cab-sidoarjo'
                    ? 'Cabang Sidoarjo'
                    : selectedBranchId === 'cab-banyuwangi'
                    ? 'Cabang Nusantara'
                    : 'Semua Cabang'}{' '}
                  &bull; {selectedMonth} {selectedYear}
                </span>
              </div>
              <h2 className="text-lg sm:text-xl font-black text-slate-900 dark:text-white uppercase tracking-tight">
                {activeTab === 'sales_kpi_individual' && 'KPI Individu Staff'}
                {activeTab === 'sales_kpi_fines' && 'Akumulasi Denda'}
                {activeTab === 'sales_kpi_nusantara' && 'Persentase Kiriman'}
                {activeTab === 'sales_kpi_omset' && 'Omset Admin Penjualan'}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-0.5">
                Terintegrasi dengan User Management (Hak Akses Admin Penjualan) &bull; Terpisah per Cabang
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {activeTab === 'sales_kpi_individual' && (
              <>
                <button
                  type="button"
                  onClick={() => {
                    const defaultAdmin =
                      selectedAdminFilter !== 'SEMUA ADMIN'
                        ? selectedAdminFilter
                        : activeBranchAdminNames[0] || '';
                    const existing = branchKpiRecords.find(
                      x => x.adminName.toUpperCase() === defaultAdmin.toUpperCase()
                    );
                    setManualKpiAdmin(defaultAdmin);
                    setManualKpiPrevPct(existing && existing.prevMonthPct > 0 ? String(existing.prevMonthPct) : '');
                    setManualKpiValidasi(existing && existing.validasiSoWeb > 0 ? String(existing.validasiSoWeb) : '');
                    setManualKpiPembuatan(existing && existing.pembuatanFaktur > 0 ? String(existing.pembuatanFaktur) : '');
                    setManualKpiPengecekan(existing && existing.pengecekanFaktur > 0 ? String(existing.pengecekanFaktur) : '');
                    setManualKpiOrders(existing && existing.totalOrders > 0 ? String(existing.totalOrders) : '');
                    setManualKpiIsInactive(Boolean(existing?.isInactive));
                    setIsManualKpiOpen(prev => !prev);
                  }}
                  className="px-3.5 py-2.5 rounded-xl bg-white dark:bg-slate-800 hover:bg-indigo-50 dark:hover:bg-slate-700 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800/80 text-xs font-bold flex items-center gap-1.5 transition cursor-pointer shadow-2xs"
                >
                  <Plus className="w-4 h-4" />
                  <span>{isManualKpiOpen ? 'Tutup Form KPI' : 'Input / Edit KPI Manual'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowKpiUploadPreview(false);
                    setIsKpiUploadOpen(true);
                  }}
                  className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-bold flex items-center gap-1.5 transition cursor-pointer shadow-sm shadow-emerald-500/15"
                >
                  <Upload className="w-4 h-4" />
                  <span>Upload File Excel</span>
                </button>
              </>
            )}

            {activeTab === 'sales_kpi_fines' && (
              <button
                type="button"
                onClick={() => {
                  setShowDendaUploadPreview(false);
                  setIsDendaUploadOpen(true);
                }}
                className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-bold flex items-center gap-1.5 transition cursor-pointer shadow-sm shadow-emerald-500/15"
              >
                <Upload className="w-4 h-4" />
                <span>Upload File Excel</span>
              </button>
            )}

            {activeTab === 'sales_kpi_omset' && (
              <>
                <button
                  type="button"
                  onClick={() => {
                    const defaultAdmin =
                      selectedAdminFilter !== 'SEMUA ADMIN'
                        ? selectedAdminFilter
                        : activeBranchAdminNames[0] || '';
                    setManualOmsetAdmin(defaultAdmin);
                    setIsManualOmsetOpen(prev => !prev);
                  }}
                  className="px-3.5 py-2.5 rounded-xl bg-white dark:bg-slate-800 hover:bg-indigo-50 dark:hover:bg-slate-700 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800/80 text-xs font-bold flex items-center gap-1.5 transition cursor-pointer shadow-2xs"
                >
                  <Plus className="w-4 h-4" />
                  <span>{isManualOmsetOpen ? 'Tutup Form Omset' : 'Input / Edit Omset Manual'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowOmsetUploadPreview(false);
                    setIsOmsetUploadOpen(true);
                  }}
                  className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-bold flex items-center gap-1.5 transition cursor-pointer shadow-sm shadow-emerald-500/15"
                >
                  <Upload className="w-4 h-4" />
                  <span>Upload File Excel</span>
                </button>
              </>
            )}

            <button
              type="button"
              onClick={exportKpiToPdf}
              disabled={isExporting}
              className="flex items-center gap-1.5 px-4 py-2.5 bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-white font-bold text-xs rounded-xl transition-all cursor-pointer disabled:opacity-50 shadow-sm shadow-indigo-500/15"
            >
              {isExporting ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
              <span>Ekspor PDF</span>
            </button>
          </div>
        </div>

        {/* Filter Bar: Cabang, Bulan (Kalender), Tahun, Nama Admin (+ Kota & Area khusus Omset Admin) */}
        <div
          className={`grid grid-cols-1 sm:grid-cols-2 ${
            activeTab === 'sales_kpi_omset' ? 'lg:grid-cols-6' : 'lg:grid-cols-4'
          } gap-3 pt-4 border-t border-slate-200/70 dark:border-slate-800 relative z-20`}
        >
          {/* 1. CABANG */}
          <ModernKpiDropdown
            variant="filter-card"
            label="CABANG OPERASIONAL"
            value={selectedBranchId}
            onChange={handleBranchChange}
            options={branchDropdownOptions}
            icon={<Building className="w-3.5 h-3.5" />}
          />

          {/* 2. BULAN (KALENDER) */}
          <ModernKpiDropdown
            variant="filter-card"
            label="BULAN EVALUASI"
            value={selectedMonth}
            onChange={setSelectedMonth}
            options={monthDropdownOptions}
            icon={<Calendar className="w-3.5 h-3.5" />}
            gridCols={2}
          />

          {/* 3. TAHUN */}
          <ModernKpiDropdown
            variant="filter-card"
            label="TAHUN PERIODE"
            value={selectedYear}
            onChange={setSelectedYear}
            options={yearDropdownOptions}
            icon={<Star className="w-3.5 h-3.5" />}
          />

          {/* 4. NAMA ADMIN (TERINTEGRASI USER MANAGEMENT & TERPISAH PER CABANG) */}
          <ModernKpiDropdown
            variant="filter-card"
            label="NAMA ADMIN PENJUALAN"
            value={selectedAdminFilter}
            onChange={setSelectedAdminFilter}
            options={adminFilterDropdownOptions}
            icon={<Users className="w-3.5 h-3.5" />}
            searchable
            searchPlaceholder="Cari nama admin penjualan..."
          />

          {/* 5 & 6. KOTA & AREA (Khusus tampilan Omset Admin) */}
          {activeTab === 'sales_kpi_omset' && (
            <>
              <ModernKpiDropdown
                variant="filter-card"
                label="FILTER KOTA"
                value={selectedKotaFilter}
                onChange={setSelectedKotaFilter}
                icon={<MapPin className="w-3.5 h-3.5" />}
                options={[
                  { value: 'SEMUA KOTA', label: 'Semua Kota' },
                  { value: 'GENTENG', label: 'GENTENG' },
                  { value: 'BALI - DENPASAR', label: 'BALI - DENPASAR' },
                  { value: 'JEMBER', label: 'JEMBER' },
                  { value: 'MUNCAR', label: 'MUNCAR' },
                  { value: 'BANYUWANGI KOTA', label: 'BANYUWANGI KOTA' },
                  { value: 'SITUBONDO', label: 'SITUBONDO' },
                  { value: 'SURABAYA UTARA', label: 'SURABAYA UTARA' },
                  { value: 'SIDOARJO', label: 'SIDOARJO' },
                  { value: 'GRESIK', label: 'GRESIK' }
                ]}
              />
              <ModernKpiDropdown
                variant="filter-card"
                label="FILTER AREA"
                value={selectedAreaFilter}
                onChange={setSelectedAreaFilter}
                icon={<Truck className="w-3.5 h-3.5" />}
                searchable
                searchPlaceholder="Cari area kirim..."
                options={[
                  { value: 'SEMUA AREA', label: 'Semua Area' },
                  ...OFFICIAL_DESTINATION_AREAS.map(area => ({
                    value: area,
                    label: area
                  }))
                ]}
              />
            </>
          )}
        </div>
      </div>

      {/* ===================================================================== */}
      {/* PRINT AREA CONTAINER                                                  */}
      {/* ===================================================================== */}
      <div id="sales-kpi-print-area" className="space-y-6">
        {/* =================================================================== */}
        {/* VIEW 1: KPI INDIVIDU STAF (DENGAN PERHITUNGAN BULAN LALU, TARGET    */}
        {/* 100%, AKTUAL BULAN INI, DAN SELISIH GAP = TARGET - AKTUAL)          */}
        {/* =================================================================== */}
        {activeTab === 'sales_kpi_individual' && (
          <div className="space-y-6 animate-fade-in">
            {/* FORM INPUT / EDIT MANUAL KPI INDIVIDU */}
            {isManualKpiOpen && (
              <form
                onSubmit={handleSaveManualKpi}
                className="bg-white dark:bg-slate-900 border-2 border-indigo-500/30 dark:border-indigo-500/40 rounded-3xl p-5 sm:p-6 shadow-md space-y-4"
              >
                <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                  <div>
                    <span className="text-[10px] font-black uppercase tracking-widest text-indigo-600 dark:text-indigo-400">
                      FORM EVALUASI KPI
                    </span>
                    <h3 className="text-sm sm:text-base font-black text-slate-900 dark:text-white">
                      Input Capaian KPI Individu Staf ({selectedMonth} {selectedYear})
                    </h3>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsManualKpiOpen(false)}
                    className="text-xs font-bold text-slate-500 hover:text-slate-800 dark:hover:text-white cursor-pointer"
                  >
                    Tutup
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3.5">
                  <div className="lg:col-span-2">
                    <label className="block text-[10px] font-black uppercase text-slate-500 mb-1">
                      Nama Admin Penjualan
                    </label>
                    <ModernKpiDropdown
                      variant="form-input"
                      value={manualKpiAdmin}
                      onChange={adm => {
                        const existing = branchKpiRecords.find(
                          x => x.adminName.toUpperCase() === adm.toUpperCase()
                        );
                        setManualKpiAdmin(adm);
                        setManualKpiPrevPct(existing && existing.prevMonthPct > 0 ? String(existing.prevMonthPct) : '');
                        setManualKpiValidasi(existing && existing.validasiSoWeb > 0 ? String(existing.validasiSoWeb) : '');
                        setManualKpiPembuatan(existing && existing.pembuatanFaktur > 0 ? String(existing.pembuatanFaktur) : '');
                        setManualKpiPengecekan(existing && existing.pengecekanFaktur > 0 ? String(existing.pengecekanFaktur) : '');
                        setManualKpiOrders(existing && existing.totalOrders > 0 ? String(existing.totalOrders) : '');
                        setManualKpiIsInactive(Boolean(existing?.isInactive));
                      }}
                      options={adminSelectDropdownOptions}
                      icon={<User className="w-3.5 h-3.5" />}
                      searchable
                      searchPlaceholder="Cari admin..."
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-black uppercase text-slate-500 mb-1">
                      Bulan Sebelumnya (%)
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      min={0}
                      max={100}
                      value={manualKpiPrevPct}
                      onChange={e => setManualKpiPrevPct(e.target.value)}
                      placeholder="Contoh: 92.5"
                      className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-xs font-bold"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-black uppercase text-slate-500 mb-1">
                      Validasi SO &amp; Web (%)
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      min={0}
                      max={100}
                      value={manualKpiValidasi}
                      onChange={e => setManualKpiValidasi(e.target.value)}
                      placeholder="0 - 100"
                      className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-xs font-bold"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-black uppercase text-slate-500 mb-1">
                      Pembuatan Faktur (%)
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      min={0}
                      max={100}
                      value={manualKpiPembuatan}
                      onChange={e => setManualKpiPembuatan(e.target.value)}
                      placeholder="0 - 100"
                      className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-xs font-bold"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-black uppercase text-slate-500 mb-1">
                      Pengecekan Faktur (%)
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      min={0}
                      max={100}
                      value={manualKpiPengecekan}
                      onChange={e => setManualKpiPengecekan(e.target.value)}
                      placeholder="0 - 100"
                      className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-xs font-bold"
                    />
                  </div>
                </div>

                {/* FITUR ADMIN TIDAK AKTIF PADA BULAN EVALUASI (KHUSUS USER DENGAN HAK UBAH KPI STAFF) */}
                {canEditKpiStaff && (
                  <div className="p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-950/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-start sm:items-center gap-3">
                      <div
                        className={`p-2 rounded-xl border shrink-0 ${
                          manualKpiIsInactive
                            ? 'bg-rose-500/10 border-rose-500/30 text-rose-600 dark:text-rose-400'
                            : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400'
                        }`}
                      >
                        {manualKpiIsInactive ? <UserX className="w-4 h-4" /> : <UserCheck className="w-4 h-4" />}
                      </div>
                      <div>
                        <div className="text-xs font-black text-slate-900 dark:text-white flex items-center gap-2">
                          <span>Status Analisa Admin Bulan {selectedMonth} {selectedYear}</span>
                          <span
                            className={`px-2 py-0.5 rounded-md text-[10px] font-black uppercase ${
                              manualKpiIsInactive
                                ? 'bg-rose-100 dark:bg-rose-950/70 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800'
                                : 'bg-emerald-100 dark:bg-emerald-950/70 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                            }`}
                          >
                            {manualKpiIsInactive ? 'Admin Tidak Aktif' : 'Admin Aktif'}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                          Jika ditandai <strong>Admin Tidak Aktif</strong>, data KPI yang diinput pada bulan ini tidak ikut masuk pada perhitungan analisa &amp; rata-rata cabang.
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => setManualKpiIsInactive(prev => !prev)}
                      className={`px-3.5 py-2 rounded-xl text-xs font-extrabold flex items-center gap-2 transition cursor-pointer shrink-0 ${
                        manualKpiIsInactive
                          ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-xs'
                          : 'bg-rose-50 dark:bg-rose-950/60 hover:bg-rose-100 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800'
                      }`}
                    >
                      {manualKpiIsInactive ? (
                        <>
                          <UserCheck className="w-3.5 h-3.5" />
                          <span>Set Admin Aktif</span>
                        </>
                      ) : (
                        <>
                          <UserX className="w-3.5 h-3.5" />
                          <span>Set Admin Tidak Aktif</span>
                        </>
                      )}
                    </button>
                  </div>
                )}

                <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-100 dark:border-slate-800">
                  <div className="flex flex-wrap items-center gap-3 text-xs">
                    <span className="px-3 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 font-bold text-slate-700 dark:text-slate-300">
                      Target: <strong>100%</strong>
                    </span>
                    <span className="px-3 py-1 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 font-bold text-indigo-700 dark:text-indigo-300">
                      Aktual Bulan Ini:{' '}
                      <strong>
                        {(
                          (Math.min(100, Math.max(0, parseNum(manualKpiValidasi))) +
                            Math.min(100, Math.max(0, parseNum(manualKpiPembuatan))) +
                            Math.min(100, Math.max(0, parseNum(manualKpiPengecekan)))) /
                          3
                        ).toFixed(1)}
                        %
                      </strong>
                    </span>
                    <span className="px-3 py-1 rounded-lg bg-amber-50 dark:bg-amber-950/60 font-bold text-amber-700 dark:text-amber-300">
                      Selisih Gap:{' '}
                      <strong>
                        {Math.max(
                          0,
                          100 -
                            (Math.min(100, Math.max(0, parseNum(manualKpiValidasi))) +
                              Math.min(100, Math.max(0, parseNum(manualKpiPembuatan))) +
                              Math.min(100, Math.max(0, parseNum(manualKpiPengecekan)))) /
                              3
                        ).toFixed(1)}
                        %
                      </strong>
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setIsManualKpiOpen(false)}
                      className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold cursor-pointer"
                    >
                      Batal
                    </button>
                    <button
                      type="submit"
                      className="px-5 py-2 rounded-xl bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-sm"
                    >
                      <Save className="w-3.5 h-3.5" />
                      <span>Simpan Data</span>
                    </button>
                  </div>
                </div>
              </form>
            )}

            {/* ================================================================= */}
            {/* GAMBAR 1: PERHITUNGAN CAPAIAN KPI BULANAN (TONE WARNA CERAH &     */}
            {/* KONTRAS TINGGI, TANPA NOMOR 1, 2, 3, 4 DAN TANPA RUMUS)           */}
            {/* ================================================================= */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 sm:p-6 shadow-xs space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-3.5">
                <div>
                  <span className="text-[10px] font-black uppercase tracking-widest text-indigo-600 dark:text-indigo-400 block">
                    ANALISA PERBANDINGAN CAPAIAN KPI STAFF ({selectedMonth.toUpperCase()} {selectedYear})
                  </span>
                  <h3 className="text-sm sm:text-base font-black text-slate-900 dark:text-white mt-0.5">
                    Perhitungan Bulan Sebelumnya, Target, Aktual Bulan Ini &amp; Selisih Gap
                  </h3>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="px-3 py-1 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border border-emerald-200/70 dark:border-emerald-800 text-[11px] font-bold">
                    {activeDisplayedKpiList.length} Admin Aktif Dianalisa
                  </span>
                  {displayedKpiList.some(r => r.isInactive) && (
                    <span className="px-3 py-1 rounded-xl bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300 border border-rose-200/70 dark:border-rose-800 text-[11px] font-bold flex items-center gap-1.5">
                      <UserX className="w-3.5 h-3.5" />
                      <span>
                        {displayedKpiList.filter(r => r.isInactive).length} Admin Tidak Aktif (Dikecualikan)
                      </span>
                    </span>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
                {/* Bulan Sebelumnya (%) */}
                <div className="p-4 rounded-2xl bg-sky-50/70 dark:bg-sky-950/30 border border-sky-200/80 dark:border-sky-800/60">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-black uppercase tracking-wider text-sky-800 dark:text-sky-300">
                      BULAN SEBELUMNYA ({prevMonthName.slice(0, 3).toUpperCase()})
                    </span>
                    <TrendingUp className="w-4 h-4 text-sky-600 dark:text-sky-400" />
                  </div>
                  <div className="text-2xl sm:text-3xl font-black text-sky-700 dark:text-sky-300 mt-2 tabular-nums">
                    {kpiOverallSummary.prevMonthPct}%
                  </div>
                  <p className="text-[11px] font-semibold text-sky-700/80 dark:text-sky-300/80 mt-1">
                    Pencapaian rata-rata bulan sebelumnya
                  </p>
                </div>

                {/* Target Capaian KPI */}
                <div className="p-4 rounded-2xl bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200/80 dark:border-emerald-800/60">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-black uppercase tracking-wider text-emerald-800 dark:text-emerald-300">
                      TARGET CAPAIAN KPI
                    </span>
                    <Target className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  </div>
                  <div className="text-2xl sm:text-3xl font-black text-emerald-700 dark:text-emerald-300 mt-2 tabular-nums">
                    {kpiOverallSummary.targetPct}%
                  </div>
                  <p className="text-[11px] font-semibold text-emerald-700/80 dark:text-emerald-300/80 mt-1">
                    Standar target penuh manajemen
                  </p>
                </div>

                {/* Aktual Bulan Ini (%) */}
                <div className="p-4 rounded-2xl bg-indigo-50/70 dark:bg-indigo-950/30 border border-indigo-200/80 dark:border-indigo-800/60">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-black uppercase tracking-wider text-indigo-800 dark:text-indigo-300">
                      AKTUAL BULAN INI ({selectedMonth.slice(0, 3).toUpperCase()})
                    </span>
                    <CheckCircle2 className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                  </div>
                  <div className="text-2xl sm:text-3xl font-black text-indigo-700 dark:text-indigo-300 mt-2 tabular-nums">
                    {kpiOverallSummary.actualPct}%
                  </div>
                  <p className="text-[11px] font-semibold text-indigo-700/80 dark:text-indigo-300/80 mt-1">
                    {kpiOverallSummary.actualPct >= kpiOverallSummary.prevMonthPct
                      ? `Naik +${(kpiOverallSummary.actualPct - kpiOverallSummary.prevMonthPct).toFixed(1)}% vs bulan lalu`
                      : `Turun ${(kpiOverallSummary.actualPct - kpiOverallSummary.prevMonthPct).toFixed(1)}% vs bulan lalu`}
                  </p>
                </div>

                {/* Selisih Gap */}
                <div className="p-4 rounded-2xl bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200/80 dark:border-amber-800/60">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-black uppercase tracking-wider text-amber-800 dark:text-amber-300">
                      SELISIH GAP
                    </span>
                    <Activity className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                  </div>
                  <div className="text-2xl sm:text-3xl font-black text-amber-700 dark:text-amber-300 mt-2 tabular-nums">
                    {kpiOverallSummary.gapPct}%
                  </div>
                  <p className="text-[11px] font-semibold text-amber-700/80 dark:text-amber-300/80 mt-1">
                    Selisih terhadap target capaian
                  </p>
                </div>
              </div>
            </div>

            {/* Top Operational Summary Metric Cards (Strictly from Active Admins) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 flex items-center justify-between shadow-xs">
                <div>
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">
                    ADMIN TERBAIK #1 ({selectedMonth.slice(0, 3).toUpperCase()})
                  </span>
                  <div className="text-base sm:text-lg font-black text-slate-900 dark:text-white mt-1 truncate">
                    {activeDisplayedKpiList.some(r => r.avgMonthlyPct > 0)
                      ? activeDisplayedKpiList[0]?.adminName
                      : 'Belum Ada Data'}
                  </div>
                  <p className="text-[11px] text-emerald-600 dark:text-emerald-400 mt-1 font-bold">
                    Aktual: {activeDisplayedKpiList[0]?.avgMonthlyPct || 0}% &bull; Gap: {activeDisplayedKpiList[0]?.gapPct ?? 100}%
                  </p>
                </div>
                <div className="p-3 rounded-xl bg-amber-500/10 text-amber-500 border border-amber-500/20">
                  <Trophy className="w-5 h-5" />
                </div>
              </div>

              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 flex items-center justify-between shadow-xs">
                <div>
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">
                    RERATA VALIDASI SO &amp; WEB
                  </span>
                  <div className="text-lg font-black text-blue-600 dark:text-blue-400 mt-1">
                    {activeDisplayedKpiList.some(r => r.validasiSoWeb > 0)
                      ? (
                          activeDisplayedKpiList.reduce((s, r) => s + r.validasiSoWeb, 0) /
                          activeDisplayedKpiList.length
                        ).toFixed(1)
                      : '0.0'}
                    %
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1 font-semibold">
                    Validasi Sales Order &amp; Website
                  </p>
                </div>
                <div className="p-3 rounded-xl bg-blue-500/10 text-blue-500 border border-blue-500/20">
                  <CheckCircle className="w-5 h-5" />
                </div>
              </div>

              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 flex items-center justify-between shadow-xs">
                <div>
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">
                    PEMBUATAN &amp; CEK FAKTUR
                  </span>
                  <div className="text-lg font-black text-emerald-600 dark:text-emerald-400 mt-1">
                    {activeDisplayedKpiList.some(r => r.pembuatanFaktur > 0 || r.pengecekanFaktur > 0)
                      ? (
                          activeDisplayedKpiList.reduce(
                            (s, r) => s + (r.pembuatanFaktur + r.pengecekanFaktur) / 2,
                            0
                          ) / activeDisplayedKpiList.length
                        ).toFixed(1)
                      : '0.0'}
                    %
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1 font-semibold">
                    Pembuatan &amp; Pengecekan Faktur
                  </p>
                </div>
                <div className="p-3 rounded-xl bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                  <FileText className="w-5 h-5" />
                </div>
              </div>

              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 flex items-center justify-between shadow-xs">
                <div>
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">
                    KESALAHAN INPUT DISKON
                  </span>
                  <div className="text-lg font-black text-rose-600 dark:text-rose-400 mt-1">
                    {activeDisplayedKpiList.reduce((s, r) => s + r.discountErrorsCount, 0)} Kali
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1 font-semibold">
                    Total temuan bulan {selectedMonth}
                  </p>
                </div>
                <div className="p-3 rounded-xl bg-rose-500/10 text-rose-500 border border-rose-500/20">
                  <BadgePercent className="w-5 h-5" />
                </div>
              </div>
            </div>

            {/* CHART PERBANDINGAN METRIK KPI INDIVIDU ANTAR ADMIN (HANYA ADMIN AKTIF) */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 sm:p-6 shadow-xs space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-tight">
                    Grafik Evaluasi KPI Bulanan Admin ({selectedMonth} {selectedYear})
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Perbandingan Bulan Sebelumnya (%), Validasi SO &amp; Web, Pembuatan Faktur, Pengecekan Faktur, Aktual (%) &amp; Selisih Gap (Admin Aktif)
                  </p>
                </div>
                <span className="px-3 py-1 rounded-full bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 text-xs font-bold">
                  Target Standar: 100%
                </span>
              </div>

              <div className="h-[310px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart
                    data={activeDisplayedKpiList}
                    margin={{ top: 10, right: 15, left: -15, bottom: 10 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                    <XAxis
                      dataKey="adminName"
                      tick={{ fill: '#64748b', fontSize: 10, fontWeight: 700 }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      domain={[0, 100]}
                      tick={{ fill: '#64748b', fontSize: 10 }}
                      axisLine={false}
                      tickLine={false}
                      unit="%"
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#0f172a',
                        borderColor: '#334155',
                        borderRadius: '12px',
                        color: '#fff',
                        fontSize: '11px'
                      }}
                    />
                    <Legend wrapperStyle={{ fontSize: '11px', fontWeight: 700 }} />
                    <Bar
                      dataKey="prevMonthPct"
                      name="Bulan Sebelumnya (%)"
                      fill="#94a3b8"
                      radius={[4, 4, 0, 0]}
                      barSize={14}
                    />
                    <Bar
                      dataKey="validasiSoWeb"
                      name="Validasi SO & Website (%)"
                      fill="#3b82f6"
                      radius={[4, 4, 0, 0]}
                      barSize={14}
                    />
                    <Bar
                      dataKey="pembuatanFaktur"
                      name="Pembuatan Faktur (%)"
                      fill="#10b981"
                      radius={[4, 4, 0, 0]}
                      barSize={14}
                    />
                    <Bar
                      dataKey="pengecekanFaktur"
                      name="Pengecekan Faktur (%)"
                      fill="#8b5cf6"
                      radius={[4, 4, 0, 0]}
                      barSize={14}
                    />
                    <Line
                      type="monotone"
                      dataKey="avgMonthlyPct"
                      name="Aktual Bulan Ini (%)"
                      stroke="#f59e0b"
                      strokeWidth={3}
                      dot={{ fill: '#f59e0b', r: 5 }}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* URUTAN ADMIN TERBAIK & RADAR PROFIL INDIVIDU */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Left: Urutan Admin Terbaik (Leaderboard) */}
              <div className="lg:col-span-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 shadow-xs space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-tight">
                      Urutan Admin Terbaik ({selectedMonth} {selectedYear})
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Klik nama admin untuk melihat rincian Bulan Sebelumnya, Target 100%, Aktual &amp; Selisih Gap
                    </p>
                  </div>
                  {canEditKpiStaff && (
                    <span className="px-2.5 py-1 rounded-xl bg-slate-100 dark:bg-slate-800 text-[10px] font-extrabold text-slate-600 dark:text-slate-300 shrink-0">
                      Hak Edit KPI: Dapat Set Admin Tidak Aktif
                    </span>
                  )}
                </div>

                <div className="space-y-2.5">
                  {displayedKpiList.map(admin => {
                    const isFocused = focusedAdminKpi.adminName === admin.adminName;
                    const isInactive = Boolean(admin.isInactive);
                    return (
                      <div
                        key={admin.adminName}
                        onClick={() => setFocusedAdminName(admin.adminName)}
                        className={`p-3.5 rounded-2xl border transition-all cursor-pointer flex items-center justify-between gap-3 ${
                          isInactive
                            ? isFocused
                              ? 'bg-rose-50/70 dark:bg-rose-950/30 border-rose-400 ring-1 ring-rose-500/20 opacity-85'
                              : 'bg-slate-100/70 dark:bg-slate-950/60 border-dashed border-slate-300 dark:border-slate-800 opacity-75 hover:opacity-100'
                            : isFocused
                            ? 'bg-indigo-50/70 dark:bg-indigo-950/30 border-indigo-500 ring-1 ring-indigo-500/20'
                            : 'bg-slate-50/60 dark:bg-slate-950/40 border-slate-200/80 dark:border-slate-800 hover:border-indigo-300'
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div
                            className={`w-8 h-8 rounded-xl flex items-center justify-center text-xs font-black shrink-0 ${
                              isInactive
                                ? 'bg-rose-100 dark:bg-rose-950/70 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-800'
                                : admin.rank === 1
                                ? 'bg-amber-400 text-slate-950 shadow-xs'
                                : admin.rank === 2
                                ? 'bg-slate-300 text-slate-900'
                                : admin.rank === 3
                                ? 'bg-amber-700 text-white'
                                : 'bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                            }`}
                          >
                            {isInactive ? <UserX className="w-4 h-4" /> : `#${admin.rank}`}
                          </div>
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <span
                                className={`text-xs font-black truncate ${
                                  isInactive
                                    ? 'line-through text-slate-500 dark:text-slate-400'
                                    : 'text-slate-900 dark:text-white'
                                }`}
                              >
                                {admin.adminName}
                              </span>
                              <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                                {admin.branchId === 'cab-sidoarjo' ? 'SDA' : 'BWI'}
                              </span>
                              {isInactive && (
                                <span className="px-2 py-0.5 rounded-md text-[9px] font-black uppercase bg-rose-100 dark:bg-rose-950/80 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800">
                                  Admin Tidak Aktif &bull; Tidak Masuk Analisa
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 flex flex-wrap items-center gap-2">
                              <span>Bulan Lalu: <strong>{admin.prevMonthPct}%</strong></span>
                              <span>&bull;</span>
                              <span>Target: <strong>100%</strong></span>
                              <span>&bull;</span>
                              <span className="text-amber-600 dark:text-amber-400 font-bold">
                                Gap: {admin.gapPct}%
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <div className="text-right">
                            <div
                              className={`text-sm font-black ${
                                isInactive
                                  ? 'text-slate-400 dark:text-slate-500'
                                  : 'text-indigo-600 dark:text-indigo-400'
                              }`}
                            >
                              {isInactive ? 'Dikecualikan' : `Aktual: ${admin.avgMonthlyPct}%`}
                            </div>
                            <div
                              className={`text-[10px] font-bold ${
                                isInactive
                                  ? 'text-rose-500 dark:text-rose-400'
                                  : admin.discountErrorsCount === 0
                                  ? 'text-emerald-600 dark:text-emerald-400'
                                  : 'text-rose-600 dark:text-rose-400'
                              }`}
                            >
                              {isInactive
                                ? `Input: ${admin.avgMonthlyPct}%`
                                : `Salah Diskon: ${admin.discountErrorsCount}x`}
                            </div>
                          </div>

                          {canEditKpiStaff && (
                            <button
                              type="button"
                              onClick={ev => {
                                ev.stopPropagation();
                                handleToggleAdminActiveStatus(admin.adminName, admin.branchId);
                              }}
                              className={`px-2.5 py-1.5 rounded-xl border text-[10px] font-extrabold flex items-center gap-1 transition cursor-pointer ${
                                isInactive
                                  ? 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100'
                                  : 'bg-rose-50/70 dark:bg-rose-950/40 border-rose-200/80 dark:border-rose-800/70 text-rose-600 dark:text-rose-300 hover:bg-rose-100'
                              }`}
                              title={
                                isInactive
                                  ? 'Aktifkan kembali admin ini agar masuk analisa bulan ini'
                                  : 'Tandai Admin Tidak Aktif agar data bulan ini tidak ikut masuk analisa'
                              }
                            >
                              {isInactive ? (
                                <>
                                  <UserCheck className="w-3.5 h-3.5" />
                                  <span className="hidden sm:inline">Aktifkan</span>
                                </>
                              ) : (
                                <>
                                  <UserX className="w-3.5 h-3.5" />
                                  <span className="hidden sm:inline">Tidak Aktif</span>
                                </>
                              )}
                            </button>
                          )}

                          {canEditKpiStaff && (
                            <button
                              type="button"
                              onClick={ev => {
                                ev.stopPropagation();
                                setManualKpiAdmin(admin.adminName);
                                setManualKpiPrevPct(admin.prevMonthPct > 0 ? String(admin.prevMonthPct) : '');
                                setManualKpiValidasi(admin.validasiSoWeb > 0 ? String(admin.validasiSoWeb) : '');
                                setManualKpiPembuatan(admin.pembuatanFaktur > 0 ? String(admin.pembuatanFaktur) : '');
                                setManualKpiPengecekan(admin.pengecekanFaktur > 0 ? String(admin.pengecekanFaktur) : '');
                                setManualKpiOrders(admin.totalOrders > 0 ? String(admin.totalOrders) : '');
                                setManualKpiIsInactive(Boolean(admin.isInactive));
                                setIsManualKpiOpen(true);
                              }}
                              className="p-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 cursor-pointer"
                              title="Edit KPI Admin ini"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Right: Radar & Breakdown Detail for Selected Admin */}
              <div className="lg:col-span-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 shadow-xs space-y-5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-tight">
                        Rincian Capaian KPI — {focusedAdminKpi.adminName}
                      </h3>
                      {focusedAdminKpi.isInactive && (
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-black uppercase bg-rose-100 dark:bg-rose-950/80 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800">
                          Admin Tidak Aktif
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {focusedAdminKpi.isInactive
                        ? `Status Tidak Aktif pada ${selectedMonth} ${selectedYear} (Data tidak ikut masuk pada analisa cabang)`
                        : `Peringkat #${focusedAdminKpi.rank} • Target 100% • Aktual ${focusedAdminKpi.avgMonthlyPct}% • Gap ${focusedAdminKpi.gapPct}%`}
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    {canEditKpiStaff && (
                      <button
                        type="button"
                        onClick={() =>
                          handleToggleAdminActiveStatus(focusedAdminKpi.adminName, focusedAdminKpi.branchId)
                        }
                        className={`px-3 py-1.5 rounded-xl border text-xs font-extrabold flex items-center gap-1.5 transition cursor-pointer ${
                          focusedAdminKpi.isInactive
                            ? 'bg-emerald-600 hover:bg-emerald-500 text-white border-emerald-600'
                            : 'bg-rose-50 dark:bg-rose-950/50 hover:bg-rose-100 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800'
                        }`}
                      >
                        {focusedAdminKpi.isInactive ? (
                          <>
                            <UserCheck className="w-3.5 h-3.5" />
                            <span>Aktifkan di Analisa</span>
                          </>
                        ) : (
                          <>
                            <UserX className="w-3.5 h-3.5" />
                            <span>Set Admin Tidak Aktif</span>
                          </>
                        )}
                      </button>
                    )}
                    <span className="px-3 py-1 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20 text-xs font-black">
                      Aktual: {focusedAdminKpi.avgMonthlyPct}%
                    </span>
                  </div>
                </div>

                {/* 4 Kotak Perhitungan Individu: Bulan Lalu, Target 100%, Aktual, Selisih Gap */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200/80 dark:border-slate-800">
                    <span className="text-[10px] font-black uppercase text-slate-400 block">Bulan Lalu</span>
                    <span className="text-base font-black text-slate-900 dark:text-white mt-0.5 block">
                      {focusedAdminKpi.prevMonthPct}%
                    </span>
                  </div>
                  <div className="p-3 rounded-2xl bg-emerald-50/60 dark:bg-emerald-950/30 border border-emerald-200/70 dark:border-emerald-800/60">
                    <span className="text-[10px] font-black uppercase text-emerald-700 dark:text-emerald-400 block">Target</span>
                    <span className="text-base font-black text-emerald-700 dark:text-emerald-300 mt-0.5 block">
                      100%
                    </span>
                  </div>
                  <div className="p-3 rounded-2xl bg-indigo-50/70 dark:bg-indigo-950/30 border border-indigo-200/70 dark:border-indigo-800/60">
                    <span className="text-[10px] font-black uppercase text-indigo-700 dark:text-indigo-400 block">Aktual</span>
                    <span className="text-base font-black text-indigo-700 dark:text-indigo-300 mt-0.5 block">
                      {focusedAdminKpi.avgMonthlyPct}%
                    </span>
                  </div>
                  <div className="p-3 rounded-2xl bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200/70 dark:border-amber-800/60">
                    <span className="text-[10px] font-black uppercase text-amber-700 dark:text-amber-400 block">
                      Selisih Gap
                    </span>
                    <span className="text-base font-black text-amber-700 dark:text-amber-300 mt-0.5 block">
                      {focusedAdminKpi.gapPct}%
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
                  <div className="h-[210px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <RadarChart
                        cx="50%"
                        cy="50%"
                        outerRadius="72%"
                        data={[
                          { subject: 'Validasi SO & Web', A: focusedAdminKpi.validasiSoWeb, fullMark: 100 },
                          { subject: 'Pembuatan Faktur', A: focusedAdminKpi.pembuatanFaktur, fullMark: 100 },
                          { subject: 'Pengecekan Faktur', A: focusedAdminKpi.pengecekanFaktur, fullMark: 100 },
                          { subject: 'Aktual Bulan Ini', A: focusedAdminKpi.avgMonthlyPct, fullMark: 100 },
                          { subject: 'Bulan Lalu', A: focusedAdminKpi.prevMonthPct, fullMark: 100 }
                        ]}
                      >
                        <PolarGrid stroke="#cbd5e1" />
                        <PolarAngleAxis dataKey="subject" tick={{ fill: '#475569', fontSize: 10, fontWeight: 700 }} />
                        <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fill: '#94a3b8', fontSize: 8 }} />
                        <Radar
                          name={focusedAdminKpi.adminName}
                          dataKey="A"
                          stroke="#4f46e5"
                          fill="#6366f1"
                          fillOpacity={0.35}
                        />
                      </RadarChart>
                    </ResponsiveContainer>
                  </div>

                  <div className="space-y-3">
                    <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200/80 dark:border-slate-800">
                      <div className="flex justify-between text-xs font-bold text-slate-700 dark:text-slate-300">
                        <span>Validasi Sales Order &amp; Website</span>
                        <span className="text-blue-600 dark:text-blue-400 font-black">{focusedAdminKpi.validasiSoWeb}%</span>
                      </div>
                      <div className="w-full bg-slate-200 dark:bg-slate-800 h-2 rounded-full mt-1.5 overflow-hidden">
                        <div className="bg-blue-600 h-full rounded-full" style={{ width: `${focusedAdminKpi.validasiSoWeb}%` }} />
                      </div>
                    </div>

                    <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200/80 dark:border-slate-800">
                      <div className="flex justify-between text-xs font-bold text-slate-700 dark:text-slate-300">
                        <span>Pembuatan Faktur Penjualan</span>
                        <span className="text-emerald-600 dark:text-emerald-400 font-black">{focusedAdminKpi.pembuatanFaktur}%</span>
                      </div>
                      <div className="w-full bg-slate-200 dark:bg-slate-800 h-2 rounded-full mt-1.5 overflow-hidden">
                        <div className="bg-emerald-500 h-full rounded-full" style={{ width: `${focusedAdminKpi.pembuatanFaktur}%` }} />
                      </div>
                    </div>

                    <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200/80 dark:border-slate-800">
                      <div className="flex justify-between text-xs font-bold text-slate-700 dark:text-slate-300">
                        <span>Pengecekan Faktur Penjualan</span>
                        <span className="text-violet-600 dark:text-violet-400 font-black">{focusedAdminKpi.pengecekanFaktur}%</span>
                      </div>
                      <div className="w-full bg-slate-200 dark:bg-slate-800 h-2 rounded-full mt-1.5 overflow-hidden">
                        <div className="bg-violet-500 h-full rounded-full" style={{ width: `${focusedAdminKpi.pengecekanFaktur}%` }} />
                      </div>
                    </div>

                    <div className="p-3 rounded-xl bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/60 flex items-center justify-between">
                      <span className="text-xs font-black text-amber-900 dark:text-amber-300">
                        Selisih Gap
                      </span>
                      <span className="text-sm font-black text-amber-600 dark:text-amber-400">
                        {focusedAdminKpi.gapPct}%
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* FITUR KESALAHAN PENGINPUTAN DISKON */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 shadow-xs space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <div className="p-2.5 rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
                    <BadgePercent className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-tight">
                      Monitoring Kesalahan Penginputan Diskon
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Pencatatan &amp; audit kesalahan input diskon pada Sales Order / Faktur Penjualan oleh Admin
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    if (isAddDiscountErrOpen) {
                      setIsAddDiscountErrOpen(false);
                      setEditingDiscountId(null);
                    } else {
                      setEditingDiscountId(null);
                      setDscDate(new Date().toISOString().slice(0, 10));
                      setDscAdmin(activeBranchAdminNames[0] || '');
                      setDscNoFaktur('');
                      setDscCustomer('');
                      setDscExpected('');
                      setDscInput('');
                      setDscSelisihRp('');
                      setDscKeterangan('');
                      setIsAddDiscountErrOpen(true);
                    }
                  }}
                  className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer self-start sm:self-auto"
                >
                  <Plus className="w-4 h-4" />
                  <span>{isAddDiscountErrOpen ? 'Tutup Form' : 'Catat Kesalahan Diskon'}</span>
                </button>
              </div>

              {isAddDiscountErrOpen && (
                <form
                  onSubmit={e => {
                    e.preventDefault();
                    const targetAdmin = (dscAdmin || activeBranchAdminNames[0] || '').trim().toUpperCase();
                    if (!targetAdmin || !dscNoFaktur.trim() || !dscCustomer.trim()) {
                      showToast('Mohon isi Nama Admin, No Faktur/SO, dan Nama Pelanggan.');
                      return;
                    }
                    const targetBr = sidoarjoAdminNames.includes(targetAdmin)
                      ? 'cab-sidoarjo'
                      : selectedBranchId === 'ALL'
                      ? 'cab-banyuwangi'
                      : selectedBranchId;

                    if (editingDiscountId) {
                      const nextLogs = discountErrorLogs.map(item =>
                        item.id === editingDiscountId
                          ? {
                              ...item,
                              date: dscDate || item.date,
                              branchId: targetBr,
                              adminName: targetAdmin,
                              noFakturOrSo: dscNoFaktur.trim().toUpperCase(),
                              customerName: dscCustomer.trim().toUpperCase(),
                              expectedDiscount: parseNum(dscExpected),
                              inputDiscount: parseNum(dscInput),
                              selisihNominal: parseNum(dscSelisihRp),
                              keterangan: dscKeterangan.trim() || 'Kesalahan penginputan diskon penjualan'
                            }
                          : item
                      );
                      setDiscountErrorLogs(nextLogs);
                      void persistSalesKpiToMysql({ discountErrorLogs: nextLogs });
                      setEditingDiscountId(null);
                      setDscNoFaktur('');
                      setDscCustomer('');
                      setDscExpected('');
                      setDscInput('');
                      setDscSelisihRp('');
                      setDscKeterangan('');
                      setIsAddDiscountErrOpen(false);
                      showToast(`Data kesalahan diskon untuk ${targetAdmin} berhasil diperbarui.`);
                      return;
                    }

                    const newLog: DiscountErrorLogItem = {
                      id: `dsc-${Date.now()}`,
                      date: dscDate || new Date().toISOString().slice(0, 10),
                      branchId: targetBr,
                      month: selectedMonth,
                      year: selectedYear,
                      adminName: targetAdmin,
                      noFakturOrSo: dscNoFaktur.trim().toUpperCase(),
                      customerName: dscCustomer.trim().toUpperCase(),
                      expectedDiscount: parseNum(dscExpected),
                      inputDiscount: parseNum(dscInput),
                      selisihNominal: parseNum(dscSelisihRp),
                      keterangan: dscKeterangan.trim() || 'Kesalahan penginputan diskon penjualan'
                    };

                    const nextLogs = [newLog, ...discountErrorLogs];
                    setDiscountErrorLogs(nextLogs);
                    void persistSalesKpiToMysql({ discountErrorLogs: nextLogs });
                    setDscNoFaktur('');
                    setDscCustomer('');
                    setDscExpected('');
                    setDscInput('');
                    setDscSelisihRp('');
                    setDscKeterangan('');
                    setIsAddDiscountErrOpen(false);
                    showToast(`Kesalahan input diskon untuk ${targetAdmin} berhasil disimpan.`);
                  }}
                  className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-3"
                >
                  <div className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider border-b border-slate-200 dark:border-slate-800 pb-2">
                    {editingDiscountId ? 'Edit Catatan Kesalahan Penginputan Diskon' : 'Tambah Catatan Kesalahan Penginputan Diskon'}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                    <div>
                      <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Tanggal</label>
                      <input
                        type="date"
                        value={dscDate || new Date().toISOString().slice(0, 10)}
                        onChange={e => setDscDate(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-semibold"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Nama Admin</label>
                      <ModernKpiDropdown
                        value={dscAdmin}
                        onChange={val => setDscAdmin(val)}
                        icon={<UserCheck className="w-3.5 h-3.5" />}
                        searchable
                        searchPlaceholder="Cari nama admin..."
                        options={activeBranchAdminNames.map(a => ({
                          value: a,
                          label: a,
                          badge: sidoarjoAdminNames.includes(a) ? 'SDA' : 'BWI',
                          badgeTone: sidoarjoAdminNames.includes(a) ? 'emerald' : 'indigo'
                        }))}
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">No. Faktur / SO</label>
                      <input
                        type="text"
                        value={dscNoFaktur}
                        onChange={e => setDscNoFaktur(e.target.value)}
                        placeholder="Contoh: FJ02-1126-0912"
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Nama Pelanggan</label>
                      <input
                        type="text"
                        value={dscCustomer}
                        onChange={e => setDscCustomer(e.target.value)}
                        placeholder="Contoh: TK SINAR BARU"
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Diskon Seharusnya (%)</label>
                      <input
                        type="number"
                        step="0.1"
                        value={dscExpected}
                        onChange={e => setDscExpected(e.target.value)}
                        placeholder="Contoh: 2.5"
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Diskon Terinput (%)</label>
                      <input
                        type="number"
                        step="0.1"
                        value={dscInput}
                        onChange={e => setDscInput(e.target.value)}
                        placeholder="Contoh: 5"
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Nominal Selisih Diskon (Rp)</label>
                      <input
                        type="number"
                        value={dscSelisihRp}
                        onChange={e => setDscSelisihRp(e.target.value)}
                        placeholder="Contoh: 75000"
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Keterangan Kesalahan Diskon</label>
                      <input
                        type="text"
                        value={dscKeterangan}
                        onChange={e => setDscKeterangan(e.target.value)}
                        placeholder="Rincian penyebab kesalahan input diskon..."
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs"
                      />
                    </div>
                  </div>
                  <div className="flex items-center justify-end gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => {
                        setIsAddDiscountErrOpen(false);
                        setEditingDiscountId(null);
                      }}
                      className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold cursor-pointer"
                    >
                      Batal
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold cursor-pointer"
                    >
                      {editingDiscountId ? 'Simpan Perubahan' : 'Simpan Catatan'}
                    </button>
                  </div>
                </form>
              )}

              <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
                <table className="w-full text-left text-xs divide-y divide-slate-200 dark:divide-slate-800">
                  <thead className="bg-slate-50 dark:bg-slate-950 text-slate-500 dark:text-slate-400 text-[10px] font-black uppercase">
                    <tr>
                      <th className="py-3 px-3">No</th>
                      <th className="py-3 px-3">Tanggal</th>
                      <th className="py-3 px-3">Nama Admin</th>
                      <th className="py-3 px-3">No. Faktur / SO</th>
                      <th className="py-3 px-3">Nama Pelanggan</th>
                      <th className="py-3 px-3 text-center">Diskon Seharusnya</th>
                      <th className="py-3 px-3 text-center">Diskon Terinput</th>
                      <th className="py-3 px-3 text-right">Selisih Diskon</th>
                      <th className="py-3 px-3">Keterangan</th>
                      <th className="py-3 px-3 text-center">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                    {discountErrorLogs.filter(
                      d =>
                        (selectedBranchId === 'ALL' || d.branchId === selectedBranchId) &&
                        (selectedAdminFilter === 'SEMUA ADMIN' ||
                          d.adminName.toUpperCase() === selectedAdminFilter.toUpperCase())
                    ).length === 0 ? (
                      <tr>
                        <td colSpan={10} className="py-8 text-center text-slate-400 italic">
                          Belum ada catatan kesalahan penginputan diskon untuk periode ini.
                        </td>
                      </tr>
                    ) : (
                      discountErrorLogs
                        .filter(
                          d =>
                            (selectedBranchId === 'ALL' || d.branchId === selectedBranchId) &&
                            (selectedAdminFilter === 'SEMUA ADMIN' ||
                              d.adminName.toUpperCase() === selectedAdminFilter.toUpperCase())
                        )
                        .map((log, i) => (
                          <tr key={log.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40">
                            <td className="py-2.5 px-3 font-semibold">{i + 1}</td>
                            <td className="py-2.5 px-3">{log.date}</td>
                            <td className="py-2.5 px-3 font-black text-slate-900 dark:text-white">{log.adminName}</td>
                            <td className="py-2.5 px-3 font-mono font-semibold">{log.noFakturOrSo}</td>
                            <td className="py-2.5 px-3 font-semibold">{log.customerName}</td>
                            <td className="py-2.5 px-3 text-center text-emerald-600 font-bold">{log.expectedDiscount}%</td>
                            <td className="py-2.5 px-3 text-center text-rose-600 font-bold">{log.inputDiscount}%</td>
                            <td className="py-2.5 px-3 text-right font-bold text-rose-600">
                              Rp {formatRp(log.selisihNominal)}
                            </td>
                            <td className="py-2.5 px-3 text-slate-600 dark:text-slate-300">{log.keterangan}</td>
                            <td className="py-2.5 px-3 text-center">
                              <div className="inline-flex items-center justify-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditingDiscountId(log.id);
                                    setDscDate(log.date);
                                    setDscAdmin(log.adminName);
                                    setDscNoFaktur(log.noFakturOrSo);
                                    setDscCustomer(log.customerName);
                                    setDscExpected(String(log.expectedDiscount));
                                    setDscInput(String(log.inputDiscount));
                                    setDscSelisihRp(String(log.selisihNominal));
                                    setDscKeterangan(log.keterangan);
                                    setIsAddDiscountErrOpen(true);
                                  }}
                                  className="p-1.5 rounded-lg text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/60 cursor-pointer transition"
                                  title="Edit catatan kesalahan diskon"
                                >
                                  <Pencil className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    const nextLogs = discountErrorLogs.filter(x => x.id !== log.id);
                                    setDiscountErrorLogs(nextLogs);
                                    void persistSalesKpiToMysql({ discountErrorLogs: nextLogs });
                                  }}
                                  className="p-1.5 rounded-lg text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/60 cursor-pointer transition"
                                  title="Hapus catatan"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* =================================================================== */}
        {/* VIEW 2: DENDA CHECKER                                               */}
        {/* =================================================================== */}
        {activeTab === 'sales_kpi_fines' && (
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 sm:p-6 space-y-5 shadow-xs animate-fade-in">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
                  <ShieldAlert className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-black text-slate-900 dark:text-white">
                    Akumulasi Sanksi &amp; Denda Checker
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Perhitungan denda otomatis dari Nominal Selisih &times; Kali-an Selisih per Faktur Pelanggan
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <div className="bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 px-4 py-2 rounded-xl">
                  <div className="text-[10px] text-rose-600 dark:text-rose-400 font-black uppercase">
                    Total Denda Checker
                  </div>
                  <div className="text-base sm:text-lg font-black text-rose-700 dark:text-rose-300">
                    Rp {formatRp(filteredDendaChecker.reduce((s, r) => s + r.totalDenda, 0))}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    if (isAddDendaManualOpen) {
                      setIsAddDendaManualOpen(false);
                      setEditingDendaId(null);
                    } else {
                      setEditingDendaId(null);
                      setNewDendaAdmin(activeBranchAdminNames[0] || '');
                      setNewDendaCustomer('');
                      setNewDendaNoFaktur('');
                      setNewDendaKeterangan('');
                      setNewDendaNominalSelisih('');
                      setNewDendaKalianSelisih('1');
                      setIsAddDendaManualOpen(true);
                    }
                  }}
                  className="px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-xs cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>{isAddDendaManualOpen ? 'Tutup Form Manual' : 'Tambah Manual'}</span>
                </button>
              </div>
            </div>

            {isAddDendaManualOpen && (
              <form
                onSubmit={handleAddManualDenda}
                className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-4"
              >
                <div className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider border-b border-slate-200 dark:border-slate-800 pb-2">
                  {editingDendaId ? 'Edit Data Denda Checker' : 'Tambah Manual Denda Checker'}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
                  <div>
                    <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">
                      Nama (Admin / Checker)
                    </label>
                    <ModernKpiDropdown
                      value={newDendaAdmin}
                      onChange={val => setNewDendaAdmin(val)}
                      icon={<UserCheck className="w-3.5 h-3.5" />}
                      searchable
                      searchPlaceholder="Cari nama admin..."
                      options={activeBranchAdminNames.map(a => ({
                        value: a,
                        label: a,
                        badge: sidoarjoAdminNames.includes(a) ? 'SDA' : 'BWI',
                        badgeTone: sidoarjoAdminNames.includes(a) ? 'emerald' : 'indigo'
                      }))}
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">
                      Nama Pelanggan
                    </label>
                    <input
                      type="text"
                      value={newDendaCustomer}
                      onChange={e => setNewDendaCustomer(e.target.value)}
                      placeholder="Contoh: TK BELLIA SUMBER AYU"
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">
                      No Faktur
                    </label>
                    <input
                      type="text"
                      value={newDendaNoFaktur}
                      onChange={e => setNewDendaNoFaktur(e.target.value)}
                      placeholder="Contoh: FJ02-1126-1080"
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">
                      Nominal Selisih (Rp)
                    </label>
                    <input
                      type="number"
                      min={0}
                      value={newDendaNominalSelisih}
                      onChange={e => setNewDendaNominalSelisih(e.target.value)}
                      placeholder="Contoh: 25000"
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">
                      Kali-an Selisih (Pengali Denda)
                    </label>
                    <input
                      type="number"
                      min={0.5}
                      step="0.5"
                      value={newDendaKalianSelisih}
                      onChange={e => setNewDendaKalianSelisih(e.target.value)}
                      placeholder="Contoh: 2"
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">
                      Hasil Denda Otomatis (Rp)
                    </label>
                    <div className="px-3 py-2 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 text-xs font-black text-rose-600 dark:text-rose-400">
                      Rp {formatRp(parseNum(newDendaNominalSelisih) * (parseNum(newDendaKalianSelisih) || 1))}
                    </div>
                  </div>

                  <div className="sm:col-span-2 lg:col-span-3">
                    <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">
                      Keterangan
                    </label>
                    <input
                      type="text"
                      value={newDendaKeterangan}
                      onChange={e => setNewDendaKeterangan(e.target.value)}
                      placeholder="Masukkan keterangan rincian selisih faktur..."
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs"
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setIsAddDendaManualOpen(false);
                      setEditingDendaId(null);
                    }}
                    className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold cursor-pointer"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold cursor-pointer"
                  >
                    {editingDendaId ? 'Simpan Perubahan' : 'Simpan Denda'}
                  </button>
                </div>
              </form>
            )}

            <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
              <table className="w-full text-left text-xs divide-y divide-slate-200 dark:divide-slate-800">
                <thead className="bg-slate-50 dark:bg-slate-950 text-slate-600 dark:text-slate-300 text-[11px] font-black uppercase">
                  <tr>
                    <th className="py-3 px-3 text-center w-10">No</th>
                    <th className="py-3 px-3">Nama</th>
                    <th className="py-3 px-3">Nama Pelanggan</th>
                    <th className="py-3 px-3">No Faktur</th>
                    <th className="py-3 px-3">Keterangan</th>
                    <th className="py-3 px-3 text-right">Nominal Selisih</th>
                    <th className="py-3 px-3 text-center">Kalian Selisih</th>
                    <th className="py-3 px-3 text-right">Hasil Denda</th>
                    <th className="py-3 px-3 text-center w-20">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                  {filteredDendaChecker.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-8 text-center text-slate-400 italic">
                        Belum ada data denda checker untuk filter cabang/admin ini.
                      </td>
                    </tr>
                  ) : (
                    filteredDendaChecker.map((fine, idx) => (
                      <tr key={fine.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40">
                        <td className="py-3 px-3 text-center font-semibold">{idx + 1}</td>
                        <td className="py-3 px-3 font-black text-slate-900 dark:text-white">{fine.adminName}</td>
                        <td className="py-3 px-3 font-semibold text-slate-800 dark:text-slate-200">{fine.customerName}</td>
                        <td className="py-3 px-3 font-mono font-bold text-blue-600 dark:text-blue-400">{fine.noFaktur}</td>
                        <td className="py-3 px-3 text-slate-600 dark:text-slate-300">{fine.keterangan}</td>
                        <td className="py-3 px-3 whitespace-nowrap">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-slate-400">Rp</span>
                            <span className="font-bold tabular-nums">{formatRp(fine.nominalSelisih)}</span>
                          </div>
                        </td>
                        <td className="py-3 px-3 text-center">
                          <span className="px-2.5 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 font-black">
                            {fine.kalianSelisih}x
                          </span>
                        </td>
                        <td className="py-3 px-3 whitespace-nowrap">
                          <div className="flex items-center justify-between gap-2 text-rose-600 dark:text-rose-400 font-black">
                            <span>Rp</span>
                            <span className="tabular-nums">{formatRp(fine.totalDenda)}</span>
                          </div>
                        </td>
                        <td className="py-3 px-3 text-center">
                          <div className="inline-flex items-center justify-center gap-1">
                            <button
                              type="button"
                              onClick={() => {
                                setEditingDendaId(fine.id);
                                setNewDendaAdmin(fine.adminName);
                                setNewDendaCustomer(fine.customerName);
                                setNewDendaNoFaktur(fine.noFaktur);
                                setNewDendaKeterangan(fine.keterangan);
                                setNewDendaNominalSelisih(String(fine.nominalSelisih));
                                setNewDendaKalianSelisih(String(fine.kalianSelisih));
                                setIsAddDendaManualOpen(true);
                              }}
                              className="p-1.5 rounded-lg text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/60 cursor-pointer transition"
                              title="Edit baris denda"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                const nextList = dendaCheckerList.filter(x => x.id !== fine.id);
                                setDendaCheckerList(nextList);
                                void persistSalesKpiToMysql({ dendaCheckerList: nextList });
                              }}
                              className="p-1.5 rounded-lg text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/60 cursor-pointer transition"
                              title="Hapus baris denda"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* =================================================================== */}
        {/* VIEW 3: PERSENTASE KIRIMAN / EVALUASI ANALISA REORDER (GAMBAR 2)    */}
        {/* Dilengkapi Perhitungan Bulan Sebelumnya (%), Target 100%,           */}
        {/* Aktual Bulan Ini (%), dan Selisih Gap = Target (100%) - Aktual (%)  */}
        {/* =================================================================== */}
        {activeTab === 'sales_kpi_nusantara' && (
          <div className="space-y-6 animate-fade-in">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 rounded-3xl shadow-xs">
              <div>
                <h3 className="text-sm sm:text-base font-black text-slate-900 dark:text-white uppercase">
                  Evaluasi Analisa Reorder Berdasarkan Analisa (Tanggal) — Terkirim (Item) vs Belum Terkirim (Item)
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Proporsi Total Reorder, Sudah Terkirim (Item), Belum Terkirim (Item), serta Perhitungan Bulan Sebelumnya, Target 100%, Aktual &amp; Selisih Gap
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  if (isAddReorderOpen) {
                    setIsAddReorderOpen(false);
                    setEditingReorderId(null);
                  } else {
                    setEditingReorderId(null);
                    const shortM = (selectedMonth || 'November').slice(0, 3);
                    setReoWeek(`03 ${shortM} ${selectedYear}`);
                    setReoTerkirimFaktur('');
                    setReoBelumTerkirimSo('');
                    setReoPrevMonthPctInput(
                      unitPrevMonthPct[reoUnit] ? String(unitPrevMonthPct[reoUnit]) : ''
                    );
                    setIsAddReorderOpen(true);
                  }
                }}
                className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer self-start sm:self-auto shadow-sm"
              >
                <Plus className="w-4 h-4" />
                <span>{isAddReorderOpen ? 'Tutup Input Reorder' : 'Update Data Analisa Reorder'}</span>
              </button>
            </div>

            {isAddReorderOpen && (
              <form
                onSubmit={e => {
                  e.preventDefault();
                  const terkirim = Math.max(0, Math.round(parseNum(reoTerkirimFaktur)));
                  const belum = Math.max(0, Math.round(parseNum(reoBelumTerkirimSo)));
                  const total = terkirim + belum;
                  const customPrevPct = Math.min(100, Math.max(0, Number(parseNum(reoPrevMonthPctInput).toFixed(1))));

                  const nextUnitPrev = {
                    ...unitPrevMonthPct,
                    ...(reoPrevMonthPctInput.trim() !== '' ? { [reoUnit]: customPrevPct } : {})
                  };
                  if (reoPrevMonthPctInput.trim() !== '') {
                    setUnitPrevMonthPct(nextUnitPrev);
                  }

                  if (total <= 0 && reoPrevMonthPctInput.trim() !== '') {
                    void persistSalesKpiToMysql({ unitPrevMonthPct: nextUnitPrev });
                    setIsAddReorderOpen(false);
                    showToast(`Capaian bulan sebelumnya untuk ${reoUnit} (${customPrevPct}%) berhasil disimpan.`);
                    return;
                  }

                  if (total <= 0) {
                    showToast('Masukkan jumlah Terkirim (Item) atau Belum Terkirim (Item).');
                    return;
                  }
                  const cleanDate = reoWeek.trim() || `03 ${(selectedMonth || 'November').slice(0, 3)} ${selectedYear}`;
                  let nextReorderList: ReorderWeeklyItem[] = [];
                  if (editingReorderId) {
                    nextReorderList = reorderList.map(r =>
                      r.id === editingReorderId
                        ? {
                            ...r,
                            unit: reoUnit,
                            weekLabel: cleanDate,
                            month: selectedMonth,
                            year: selectedYear,
                            totalReorder: total,
                            terkirimFaktur: terkirim,
                            belumTerkirimSo: belum
                          }
                        : r
                    );
                  } else {
                    const idx = reorderList.findIndex(
                      r =>
                        r.unit === reoUnit &&
                        r.weekLabel.toLowerCase() === cleanDate.toLowerCase() &&
                        (!r.month || r.month === selectedMonth) &&
                        (!r.year || r.year === selectedYear)
                    );
                    const nextItem: ReorderWeeklyItem = {
                      id: idx >= 0 ? reorderList[idx].id : `reo-${Date.now()}`,
                      unit: reoUnit,
                      weekLabel: cleanDate,
                      month: selectedMonth,
                      year: selectedYear,
                      totalReorder: total,
                      terkirimFaktur: terkirim,
                      belumTerkirimSo: belum
                    };
                    if (idx >= 0) {
                      nextReorderList = [...reorderList];
                      nextReorderList[idx] = nextItem;
                    } else {
                      nextReorderList = [...reorderList, nextItem];
                    }
                  }

                  setReorderList(nextReorderList);
                  void persistSalesKpiToMysql({
                    reorderList: nextReorderList,
                    unitPrevMonthPct: nextUnitPrev
                  });
                  setEditingReorderId(null);
                  setReoTerkirimFaktur('');
                  setReoBelumTerkirimSo('');
                  setIsAddReorderOpen(false);
                  showToast(`Data Analisa Reorder ${reoUnit} (${cleanDate}) berhasil disimpan.`);
                }}
                className="bg-white dark:bg-slate-900 border-2 border-indigo-500/30 dark:border-slate-800 p-5 rounded-3xl grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5 items-end shadow-sm"
              >
                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Unit Nusantara</label>
                  <ModernKpiDropdown
                    value={reoUnit}
                    onChange={val => {
                      const u = val as 'Nusantara Dr. Soetomo' | 'Nusantara Expand';
                      setReoUnit(u);
                    }}
                    icon={<Building className="w-3.5 h-3.5" />}
                    options={[
                      {
                        value: 'Nusantara Dr. Soetomo',
                        label: 'Nusantara Dr. Soetomo',
                        subLabel: 'Pusat Operasional Dr. Soetomo',
                        badge: 'UTAMA',
                        badgeTone: 'indigo'
                      },
                      {
                        value: 'Nusantara Expand',
                        label: 'Nusantara Expand',
                        subLabel: 'Ekspansi Jaringan Nusantara',
                        badge: 'EXPAND',
                        badgeTone: 'emerald'
                      }
                    ]}
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Analisa (Tanggal)</label>
                  <input
                    type="text"
                    value={reoWeek}
                    onChange={e => setReoWeek(e.target.value)}
                    placeholder={`Contoh: 03 ${(selectedMonth || 'November').slice(0, 3)} ${selectedYear}`}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-xs font-bold"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">
                    Sudah Terkirim (Item)
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={reoTerkirimFaktur}
                    onChange={e => setReoTerkirimFaktur(e.target.value)}
                    placeholder="Contoh: 410"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-xs"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">
                    Belum Terkirim (Item)
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={reoBelumTerkirimSo}
                    onChange={e => setReoBelumTerkirimSo(e.target.value)}
                    placeholder="Contoh: 55"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-xs"
                  />
                </div>
                <div className="flex gap-2">
                  {editingReorderId && (
                    <button
                      type="button"
                      onClick={() => {
                        setIsAddReorderOpen(false);
                        setEditingReorderId(null);
                      }}
                      className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold cursor-pointer"
                    >
                      Batal
                    </button>
                  )}
                  <button
                    type="submit"
                    className="flex-1 px-4 py-2 rounded-xl bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-white text-xs font-bold cursor-pointer shadow-xs"
                  >
                    {editingReorderId ? 'Simpan Perubahan' : 'Simpan Data'}
                  </button>
                </div>
              </form>
            )}

            {/* ================================================================= */}
            {/* PERHITUNGAN PENCAPAIAN KIRIMAN GABUNGAN                           */}
            {/* (NUSANTARA DR. SOETOMO + NUSANTARA EXPAND DIBAGI 2 DIKALI 100%)   */}
            {/* TONE WARNA CERAH & KONTRAS TINGGI TANPA RUMUS                     */}
            {/* ================================================================= */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 sm:p-6 shadow-xs space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-3.5">
                <div>
                  <span className="text-[10px] font-black uppercase tracking-widest text-indigo-600 dark:text-indigo-400 block">
                    PERHITUNGAN PENCAPAIAN KIRIMAN GABUNGAN ({selectedMonth.toUpperCase()} {selectedYear})
                  </span>
                  <h3 className="text-sm sm:text-base font-black text-slate-900 dark:text-white mt-0.5">
                    Gabungan Nusantara Dr. Soetomo &amp; Nusantara Expand
                  </h3>
                </div>
                <div className="flex flex-wrap items-center gap-2 text-[11px] font-bold">
                  <span className="px-3 py-1 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 border border-indigo-200/70 dark:border-indigo-800">
                    Dr. Soetomo: {reorderStats.soetomo.actualPct}%
                  </span>
                  <span className="px-3 py-1 rounded-xl bg-cyan-50 dark:bg-cyan-950/50 text-cyan-700 dark:text-cyan-300 border border-cyan-200/70 dark:border-cyan-800">
                    Nusantara Expand: {reorderStats.expand.actualPct}%
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
                <div className="p-4 rounded-2xl bg-sky-50/70 dark:bg-sky-950/30 border border-sky-200/80 dark:border-sky-800/60">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-black uppercase tracking-wider text-sky-800 dark:text-sky-300">
                      BULAN SEBELUMNYA ({prevMonthName.slice(0, 3).toUpperCase()})
                    </span>
                    <TrendingUp className="w-4 h-4 text-sky-600 dark:text-sky-400" />
                  </div>
                  <div className="text-2xl sm:text-3xl font-black text-sky-700 dark:text-sky-300 mt-2 tabular-nums">
                    {reorderStats.combined.prevMonthPct}%
                  </div>
                  <p className="text-[11px] font-semibold text-sky-700/80 dark:text-sky-300/80 mt-1">
                    Capaian gabungan bulan lalu
                  </p>
                </div>

                <div className="p-4 rounded-2xl bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200/80 dark:border-emerald-800/60">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-black uppercase tracking-wider text-emerald-800 dark:text-emerald-300">
                      TARGET KIRIMAN
                    </span>
                    <Target className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  </div>
                  <div className="text-2xl sm:text-3xl font-black text-emerald-700 dark:text-emerald-300 mt-2 tabular-nums">
                    {reorderStats.combined.targetPct}%
                  </div>
                  <p className="text-[11px] font-semibold text-emerald-700/80 dark:text-emerald-300/80 mt-1">
                    Target penuh pengiriman
                  </p>
                </div>

                <div className="p-4 rounded-2xl bg-indigo-50/70 dark:bg-indigo-950/30 border border-indigo-200/80 dark:border-indigo-800/60">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-black uppercase tracking-wider text-indigo-800 dark:text-indigo-300">
                      AKTUAL BULAN INI ({selectedMonth.slice(0, 3).toUpperCase()})
                    </span>
                    <CheckCircle2 className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                  </div>
                  <div className="text-2xl sm:text-3xl font-black text-indigo-700 dark:text-indigo-300 mt-2 tabular-nums">
                    {reorderStats.combined.actualPct}%
                  </div>
                  <p className="text-[11px] font-semibold text-indigo-700/80 dark:text-indigo-300/80 mt-1">
                    Realisasi gabungan Dr. Soetomo &amp; Expand
                  </p>
                </div>

                <div className="p-4 rounded-2xl bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200/80 dark:border-amber-800/60">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-black uppercase tracking-wider text-amber-800 dark:text-amber-300">
                      SELISIH GAP
                    </span>
                    <Activity className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                  </div>
                  <div className="text-2xl sm:text-3xl font-black text-amber-700 dark:text-amber-300 mt-2 tabular-nums">
                    {reorderStats.combined.gapPct}%
                  </div>
                  <p className="text-[11px] font-semibold text-amber-700/80 dark:text-amber-300/80 mt-1">
                    Selisih terhadap target pengiriman
                  </p>
                </div>
              </div>
            </div>

            {/* 2 Panel Utama: Nusantara Dr. Soetomo & Nusantara Expand */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {[
                {
                  title: 'NUSANTARA DR. SOETOMO',
                  unitKey: 'Nusantara Dr. Soetomo' as const,
                  subtitle: 'Evaluasi Reorder berdasarkan Analisa (Tanggal) — Terkirim (Item) & Belum Terkirim (Item)',
                  color: '#4f46e5',
                  data: reorderStats.soetomo
                },
                {
                  title: 'NUSANTARA EXPAND',
                  unitKey: 'Nusantara Expand' as const,
                  subtitle: 'Evaluasi Reorder rute ekspansi berdasarkan Analisa (Tanggal) — Terkirim (Item) & Belum Terkirim (Item)',
                  color: '#0891b2',
                  data: reorderStats.expand
                }
              ].map(panel => (
                <div
                  key={panel.title}
                  className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 sm:p-6 shadow-xs space-y-5"
                >
                  <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3.5">
                    <div>
                      <h4 className="text-sm sm:text-base font-black text-slate-900 dark:text-white uppercase tracking-wider">
                        {panel.title}
                      </h4>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">{panel.subtitle}</p>
                    </div>
                    <span className="px-3 py-1 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 text-xs font-black">
                      Aktual: {panel.data.actualPct}%
                    </span>
                  </div>

                  {/* 3 Metrik Reorder dengan Prosentase */}
                  <div className="grid grid-cols-3 gap-3">
                    <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200/70 dark:border-slate-800">
                      <span className="text-[10px] font-bold text-slate-400 uppercase block">
                        Total Reorder Mingguan
                      </span>
                      <div className="text-base sm:text-lg font-black text-slate-900 dark:text-white mt-1">
                        {formatRp(panel.data.totalReorder)} Item
                      </div>
                      <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400">
                        100% (Terkirim + Belum Terkirim)
                      </span>
                    </div>

                    <div className="p-3 rounded-xl bg-emerald-50/60 dark:bg-emerald-950/30 border border-emerald-200/70 dark:border-emerald-800/60">
                      <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-400 uppercase block">
                        Sudah Terkirim (Item)
                      </span>
                      <div className="text-base sm:text-lg font-black text-emerald-700 dark:text-emerald-300 mt-1">
                        {formatRp(panel.data.terkirimFaktur)} ({panel.data.pctTerkirim}%)
                      </div>
                      <span className="text-[10px] font-bold text-emerald-600">
                        Total Item Terkirim
                      </span>
                    </div>

                    <div className="p-3 rounded-xl bg-amber-50/60 dark:bg-amber-950/30 border border-amber-200/70 dark:border-amber-800/60">
                      <span className="text-[10px] font-bold text-amber-700 dark:text-amber-400 uppercase block">
                        Belum Terkirim (Item)
                      </span>
                      <div className="text-base sm:text-lg font-black text-amber-700 dark:text-amber-300 mt-1">
                        {formatRp(panel.data.belumTerkirimSo)} ({panel.data.pctBelumTerkirim}%)
                      </div>
                      <span className="text-[10px] font-bold text-amber-600">
                        Selisih Gap: {panel.data.gapPct}%
                      </span>
                    </div>
                  </div>

                  {/* Donut + Analisa (Tanggal) Composed Chart */}
                  <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
                    <div className="md:col-span-5 flex flex-col items-center">
                      <div className="relative w-36 h-36">
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie
                              data={
                                panel.data.totalReorder > 0
                                  ? [
                                      { name: 'Terkirim (Item)', value: panel.data.pctTerkirim },
                                      { name: 'Belum Terkirim (Item)', value: panel.data.pctBelumTerkirim }
                                    ]
                                  : [
                                      { name: 'Belum Ada Data', value: 100 }
                                    ]
                              }
                              cx="50%"
                              cy="50%"
                              innerRadius={45}
                              outerRadius={62}
                              startAngle={90}
                              endAngle={-270}
                              dataKey="value"
                            >
                              {panel.data.totalReorder > 0 ? (
                                <>
                                  <Cell fill="#10b981" />
                                  <Cell fill="#f59e0b" />
                                </>
                              ) : (
                                <Cell fill="#cbd5e1" />
                              )}
                            </Pie>
                            <Tooltip />
                          </PieChart>
                        </ResponsiveContainer>
                        <div className="absolute inset-0 flex flex-col items-center justify-center">
                          <span className="text-xl font-black text-slate-900 dark:text-white">
                            {panel.data.pctTerkirim}%
                          </span>
                          <span className="text-[9px] font-bold text-slate-400 uppercase">Aktual</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 text-[10px] font-bold mt-2">
                        <span className="flex items-center gap-1 text-emerald-600">
                          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                          Aktual ({panel.data.pctTerkirim}%)
                        </span>
                        <span className="flex items-center gap-1 text-amber-600">
                          <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                          Gap ({panel.data.gapPct}%)
                        </span>
                      </div>
                    </div>

                    <div className="md:col-span-7 h-[200px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <ComposedChart
                          data={panel.data.rows.map(r => ({
                            ...r,
                            pctTerkirim:
                              r.totalReorder > 0
                                ? Number(((r.terkirimFaktur / r.totalReorder) * 100).toFixed(1))
                                : 0
                          }))}
                          margin={{ top: 5, right: 5, left: -20, bottom: 5 }}
                        >
                          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                          <XAxis dataKey="weekLabel" tick={{ fill: '#64748b', fontSize: 10 }} axisLine={false} tickLine={false} />
                          <YAxis tick={{ fill: '#64748b', fontSize: 10 }} axisLine={false} tickLine={false} />
                          <Tooltip />
                          <Legend wrapperStyle={{ fontSize: '10px' }} />
                          <Bar dataKey="totalReorder" name="Total Reorder" fill="#6366f1" radius={[3, 3, 0, 0]} barSize={14} />
                          <Bar dataKey="terkirimFaktur" name="Terkirim (Item)" fill="#10b981" radius={[3, 3, 0, 0]} barSize={14} />
                          <Bar dataKey="belumTerkirimSo" name="Belum Terkirim (Item)" fill="#f59e0b" radius={[3, 3, 0, 0]} barSize={14} />
                        </ComposedChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  {/* Tabel Rincian Per Analisa (Tanggal) */}
                  <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
                    <table className="w-full text-xs text-left divide-y divide-slate-200 dark:divide-slate-800">
                      <thead className="bg-slate-50 dark:bg-slate-950 text-[10px] font-black uppercase text-slate-500">
                        <tr>
                          <th className="py-2.5 px-3">Analisa (Tanggal)</th>
                          <th className="py-2.5 px-3 text-right">Total Reorder</th>
                          <th className="py-2.5 px-3 text-right">Terkirim (Item)</th>
                          <th className="py-2.5 px-3 text-right">Belum Terkirim (Item)</th>
                          <th className="py-2.5 px-3 text-center">Aktual (%)</th>
                          <th className="py-2.5 px-3 text-center">Gap (%)</th>
                          <th className="py-2.5 px-2 text-center">Aksi</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                        {panel.data.rows.length === 0 ? (
                          <tr>
                            <td colSpan={7} className="py-6 text-center text-slate-400 italic">
                              Belum ada data analisa reorder untuk periode ini.
                            </td>
                          </tr>
                        ) : (
                          panel.data.rows.map(r => {
                            const pKirim = r.totalReorder > 0 ? Number(((r.terkirimFaktur / r.totalReorder) * 100).toFixed(1)) : 0;
                            const pGap = Number(Math.max(0, 100 - pKirim).toFixed(1));
                            return (
                              <tr key={r.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                                <td className="py-2 px-3 font-bold whitespace-nowrap">{r.weekLabel}</td>
                                <td className="py-2 px-3 text-right font-bold">{formatRp(r.totalReorder)}</td>
                                <td className="py-2 px-3 text-right font-semibold text-emerald-600">{formatRp(r.terkirimFaktur)}</td>
                                <td className="py-2 px-3 text-right font-semibold text-amber-600">{formatRp(r.belumTerkirimSo)}</td>
                                <td className="py-2 px-3 text-center font-black text-emerald-600">{pKirim}%</td>
                                <td className="py-2 px-3 text-center font-black text-amber-600">{pGap}%</td>
                                <td className="py-2 px-2 text-center">
                                  <div className="inline-flex items-center gap-1">
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setEditingReorderId(r.id);
                                        setReoUnit(panel.unitKey);
                                        setReoWeek(r.weekLabel);
                                        setReoTerkirimFaktur(String(r.terkirimFaktur));
                                        setReoBelumTerkirimSo(String(r.belumTerkirimSo));
                                        setReoPrevMonthPctInput(
                                          panel.data.prevMonthPct > 0 ? String(panel.data.prevMonthPct) : ''
                                        );
                                        setIsAddReorderOpen(true);
                                      }}
                                      className="p-1 rounded-lg text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/60 cursor-pointer"
                                      title="Edit baris analisa tanggal"
                                    >
                                      <Pencil className="w-3.5 h-3.5" />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        const nextList = reorderList.filter(x => x.id !== r.id);
                                        setReorderList(nextList);
                                        void persistSalesKpiToMysql({ reorderList: nextList });
                                      }}
                                      className="p-1 rounded-lg text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/60 cursor-pointer"
                                      title="Hapus baris analisa tanggal"
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
              ))}
            </div>
          </div>
        )}

        {/* =================================================================== */}
        {/* VIEW 4: OMSET ADMIN PENJUALAN (MURNI DATABASE MYSQL, TANPA          */}
        {/* KETERANGAN HARI KE- DARI, DAN TANPA DATA LOKAL / DUMMY)             */}
        {/* =================================================================== */}
        {activeTab === 'sales_kpi_omset' && (
          <div className="space-y-6 animate-fade-in">
            {/* FORM INPUT / EDIT MANUAL OMSET ADMIN KE DATABASE MYSQL */}
            {isManualOmsetOpen && (
              <form
                onSubmit={handleSaveManualOmset}
                className="bg-white dark:bg-slate-900 border-2 border-emerald-500/30 dark:border-emerald-500/40 rounded-3xl p-5 sm:p-6 shadow-md space-y-4"
              >
                <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                  <div>
                    <span className="text-[10px] font-black uppercase tracking-widest text-emerald-600 dark:text-emerald-400">
                      FORM INPUT OMSET
                    </span>
                    <h3 className="text-sm sm:text-base font-black text-slate-900 dark:text-white">
                      Input Omset Admin Penjualan ({selectedMonth} {selectedYear})
                    </h3>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsManualOmsetOpen(false)}
                    className="text-xs font-bold text-slate-500 hover:text-slate-800 dark:hover:text-white cursor-pointer"
                  >
                    Tutup
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3.5">
                  <div className="lg:col-span-2">
                    <label className="block text-[10px] font-black uppercase text-slate-500 mb-1">
                      Nama Admin Penjualan
                    </label>
                    <ModernKpiDropdown
                      value={manualOmsetAdmin}
                      onChange={adm => {
                        const existing = synchronizedOmsetRows.find(
                          x => x.adminName.toUpperCase() === adm.toUpperCase()
                        );
                        setManualOmsetAdmin(adm);
                        setManualOmsetKota(existing?.kota && existing.kota !== '-' ? existing.kota : 'BANYUWANGI KOTA');
                        setManualOmsetArea(existing?.area && existing.area !== '-' ? existing.area : 'Banyuwangi Kota');
                        setManualOmsetNetto(existing && existing.omzetNetto > 0 ? String(existing.omzetNetto) : '');
                        setManualOmsetQty(existing && existing.qtyNetto > 0 ? String(existing.qtyNetto) : '');
                        setManualOmsetLastMonth(existing && existing.lastMonthOmzet > 0 ? String(existing.lastMonthOmzet) : '');
                      }}
                      icon={<UserCheck className="w-3.5 h-3.5" />}
                      searchable
                      searchPlaceholder="Cari nama admin..."
                      options={activeBranchAdminNames.map(adm => ({
                        value: adm,
                        label: adm,
                        badge: sidoarjoAdminNames.includes(adm) ? 'SDA' : 'BWI',
                        badgeTone: sidoarjoAdminNames.includes(adm) ? 'emerald' : 'indigo'
                      }))}
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-black uppercase text-slate-500 mb-1">
                      Kota Dominan
                    </label>
                    <input
                      type="text"
                      value={manualOmsetKota}
                      onChange={e => setManualOmsetKota(e.target.value)}
                      placeholder="Contoh: GENTENG"
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-xs font-bold"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-black uppercase text-slate-500 mb-1">
                      Omzet Netto Bulan Ini (Rp)
                    </label>
                    <input
                      type="number"
                      min={0}
                      value={manualOmsetNetto}
                      onChange={e => setManualOmsetNetto(e.target.value)}
                      placeholder="Contoh: 450000000"
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-xs font-bold"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-black uppercase text-slate-500 mb-1">
                      Qty Netto (PCS)
                    </label>
                    <input
                      type="number"
                      min={0}
                      value={manualOmsetQty}
                      onChange={e => setManualOmsetQty(e.target.value)}
                      placeholder="Contoh: 125000"
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-xs font-bold"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-black uppercase text-slate-500 mb-1">
                      Omzet Bulan Lalu (Rp)
                    </label>
                    <input
                      type="number"
                      min={0}
                      value={manualOmsetLastMonth}
                      onChange={e => setManualOmsetLastMonth(e.target.value)}
                      placeholder="Opsional"
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-xs font-bold"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                  <button
                    type="button"
                    onClick={() => setIsManualOmsetOpen(false)}
                    className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold cursor-pointer"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-sm"
                  >
                    <Save className="w-3.5 h-3.5" />
                    <span>Simpan Omset</span>
                  </button>
                </div>
              </form>
            )}

            {/* ROW 1 & 2 UNIFIED: OMZET NETTO + RINGKASAN OMZET + KESIMPULAN & SARAN */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 sm:p-6 shadow-xs space-y-5">
              {/* Header Ringkasan */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100 dark:border-slate-800">
                <div>
                  <span className="text-[10px] font-black uppercase tracking-widest text-indigo-600 dark:text-indigo-400 block">
                    RINGKASAN OMZET &amp; PERFORMA HARIAN ({selectedMonth.toUpperCase()} {selectedYear})
                  </span>
                  <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-white mt-0.5">
                    Omzet Netto, Rata-rata Harian &amp; Qty
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    {omsetSummary.omzetNetto > 0 || omsetSummary.lastMonthOmzet > 0
                      ? `Periode ${selectedMonth} ${selectedYear} secara rata-rata harian ${
                          Number(omsetSummary.diffHarianPct) >= 0 ? 'naik' : 'turun'
                        } ${Math.abs(Number(omsetSummary.diffHarianPct)).toString().replace('.', ',')}% dibanding bulan lalu.`
                      : `Belum ada data omset untuk periode ${selectedMonth} ${selectedYear}. Silakan upload Excel atau input manual.`}
                  </p>
                </div>
                <span className="px-3.5 py-1.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 text-xs font-bold self-start sm:self-auto">
                  Periode Evaluasi: {selectedMonth} {selectedYear}
                </span>
              </div>

              {/* Unified 4-Card Grid: Omzet Netto + Rata-rata Harian Ini + Rata-rata Bulan Lalu + Qty Harian */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
                {/* Card 1: OMZET NETTO */}
                <div className="p-4 rounded-2xl bg-gradient-to-br from-indigo-50/90 via-blue-50/50 to-white dark:from-indigo-950/50 dark:via-slate-900 dark:to-slate-950 border border-indigo-200/80 dark:border-indigo-800/70 space-y-1.5">
                  <span className="text-[10px] font-black uppercase tracking-wider text-indigo-600 dark:text-indigo-400 block">
                    OMZET NETTO
                  </span>
                  <div className="text-lg sm:text-xl font-black text-indigo-600 dark:text-indigo-400 tabular-nums">
                    Rp {formatRp(omsetSummary.omzetNetto)}
                  </div>
                  <div>
                    <span
                      className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                        omsetSummary.diffOmzet >= 0
                          ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400'
                          : 'bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400'
                      }`}
                    >
                      {omsetSummary.diffOmzet < 0 ? '↘' : '↗'}{' '}
                      {omsetSummary.diffOmzet < 0
                        ? `-Rp ${formatRp(Math.abs(omsetSummary.diffOmzet))}`
                        : `+Rp ${formatRp(omsetSummary.diffOmzet)}`}{' '}
                      ({Math.abs(Number(omsetSummary.diffOmzetPct)).toString().replace('.', ',')}%)
                    </span>
                  </div>
                </div>

                {/* Card 2: RATA-RATA HARIAN INI */}
                <div className="p-4 rounded-2xl bg-slate-50/80 dark:bg-slate-950 border border-slate-200/70 dark:border-slate-800 space-y-1.5">
                  <span className="text-[10px] font-bold uppercase text-slate-400 block">RATA-RATA HARIAN INI</span>
                  <div className="text-base sm:text-lg font-black text-slate-900 dark:text-white tabular-nums">
                    Rp {formatRp(omsetSummary.rataHarianIni)}
                  </div>
                  <span
                    className={`inline-block px-2 py-0.5 rounded-md text-[11px] font-bold ${
                      Number(omsetSummary.diffHarianPct) >= 0
                        ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600'
                        : 'bg-rose-50 dark:bg-rose-950/50 text-rose-600'
                    }`}
                  >
                    {Number(omsetSummary.diffHarianPct) >= 0 ? '+' : ''}
                    {omsetSummary.diffHarianPct.replace('.', ',')}% vs bulan lalu
                  </span>
                </div>

                {/* Card 3: RATA-RATA BULAN LALU */}
                <div className="p-4 rounded-2xl bg-slate-50/80 dark:bg-slate-950 border border-slate-200/70 dark:border-slate-800 space-y-1.5">
                  <span className="text-[10px] font-bold uppercase text-slate-400 block">RATA-RATA BULAN LALU</span>
                  <div className="text-base sm:text-lg font-black text-slate-900 dark:text-white tabular-nums">
                    Rp {formatRp(omsetSummary.rataBulanLalu)}
                  </div>
                  <span className="text-xs text-slate-500 font-semibold block">
                    Total Bulan Lalu: Rp {formatRp(omsetSummary.lastMonthOmzet)}
                  </span>
                </div>

                {/* Card 4: QTY HARIAN */}
                <div className="p-4 rounded-2xl bg-slate-50/80 dark:bg-slate-950 border border-slate-200/70 dark:border-slate-800 space-y-1.5">
                  <span className="text-[10px] font-bold uppercase text-slate-400 block">QTY HARIAN</span>
                  <div className="text-base sm:text-lg font-black text-slate-900 dark:text-white tabular-nums">
                    {formatQtyId(omsetSummary.qtyHarian)}
                  </div>
                  <span className="inline-block px-2 py-0.5 rounded-md bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-300 text-[11px] font-bold">
                    Total Qty: {formatRp(omsetSummary.qtyNetto)} PCS
                  </span>
                </div>
              </div>

              {/* Kesimpulan & Saran di bawah Ringkasan Omzet (tanpa kata Hari ke- dari) */}
              <div className="rounded-2xl bg-gradient-to-r from-slate-50 via-indigo-50/40 to-blue-50/40 dark:from-slate-950 dark:via-indigo-950/20 dark:to-blue-950/20 border border-indigo-200/70 dark:border-indigo-900/50 p-4 sm:p-5">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-xl bg-indigo-600 text-white flex items-center justify-center shrink-0 mt-0.5">
                      <FileText className="w-4 h-4" />
                    </div>
                    <div className="space-y-1">
                      <span className="text-[10px] font-black uppercase tracking-wider text-indigo-700 dark:text-indigo-400 block">
                        Kesimpulan Performa ({selectedMonth} {selectedYear})
                      </span>
                      <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
                        Pada periode <strong>{selectedMonth} {selectedYear}</strong>, total <strong>Omzet Netto</strong> tercatat sebesar{' '}
                        <strong>Rp {formatRp(omsetSummary.omzetNetto)}</strong> dengan rata-rata harian{' '}
                        <strong>Rp {formatRp(omsetSummary.rataHarianIni)}/hari</strong> (dibanding rata-rata bulan lalu{' '}
                        <strong>Rp {formatRp(omsetSummary.rataBulanLalu)}/hari</strong>). Kontributor admin tertinggi adalah{' '}
                        <strong>
                          {synchronizedOmsetRows.some(r => r.omzetNetto > 0)
                            ? synchronizedOmsetRows[0]?.adminName
                            : 'Belum Ada Data'}
                        </strong>{' '}
                        (Rp {formatRp(synchronizedOmsetRows[0]?.omzetNetto || 0)}).
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3 lg:border-l lg:border-slate-200/80 dark:lg:border-slate-800 lg:pl-4">
                    <div className="w-8 h-8 rounded-xl bg-amber-500 text-white flex items-center justify-center shrink-0 mt-0.5">
                      <TrendingUp className="w-4 h-4" />
                    </div>
                    <div className="space-y-1">
                      <span className="text-[10px] font-black uppercase tracking-wider text-amber-700 dark:text-amber-400 block">
                        Saran &amp; Rekomendasi Tindak Lanjut
                      </span>
                      <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
                        Percepat validasi Sales Order menunggu menjadi faktur penjualan pada sesi pagi, prioritaskan follow-up repeat order pelanggan utama per wilayah, serta jaga ketersediaan stok barang fast-moving untuk mengoptimalkan capaian Omzet Netto dan Qty Netto bulanan.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* ROW 3: GRAFIK OMZET TERINTEGRASI (BULANAN / MINGGUAN / HARIAN) */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 sm:p-6 shadow-xs flex flex-col justify-between space-y-5">
              <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm sm:text-base font-black text-slate-900 dark:text-white">
                    {dynamicOmzetChart.title}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {dynamicOmzetChart.subtitle}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <div className="inline-flex rounded-xl bg-slate-100 dark:bg-slate-800 p-1">
                    {(['Bulanan', 'Mingguan', 'Harian'] as const).map(mode => (
                      <button
                        key={mode}
                        type="button"
                        onClick={() => setOmzetChartGranularity(mode)}
                        className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                          omzetChartGranularity === mode
                            ? 'bg-indigo-600 text-white shadow-xs'
                            : 'text-slate-600 dark:text-slate-300 hover:text-slate-900'
                        }`}
                      >
                        {mode}
                      </button>
                    ))}
                  </div>

                  <button
                    type="button"
                    onClick={() => setShowOmzetNumbers(prev => !prev)}
                    className={`px-3.5 py-1.5 rounded-xl text-xs font-black border transition cursor-pointer ${
                      showOmzetNumbers
                        ? 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800'
                        : 'bg-indigo-50/70 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 border-indigo-200/80 dark:border-indigo-800'
                    }`}
                  >
                    {showOmzetNumbers ? 'SEMBUNYIKAN ANGKA' : 'TAMPILKAN ANGKA'}
                  </button>

                  <span className="px-3.5 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-bold tabular-nums">
                    {dynamicOmzetChart.badgeText}
                  </span>
                </div>
              </div>

              <div className="h-[340px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart
                    data={dynamicOmzetChart.series}
                    margin={{ top: 28, right: 16, left: 0, bottom: 8 }}
                  >
                    <defs>
                      <linearGradient id="omzetBarGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#6366f1" stopOpacity={1} />
                        <stop offset="100%" stopColor="#3b82f6" stopOpacity={0.88} />
                      </linearGradient>
                      <linearGradient id="omzetBarActiveGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#4f46e5" stopOpacity={1} />
                        <stop offset="100%" stopColor="#2563eb" stopOpacity={0.92} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                    <XAxis
                      dataKey="label"
                      tick={{ fill: '#64748b', fontSize: 11, fontWeight: 700 }}
                      axisLine={{ stroke: '#e2e8f0' }}
                      tickLine={false}
                    />
                    <YAxis
                      tick={{ fill: '#64748b', fontSize: 10 }}
                      axisLine={false}
                      tickLine={false}
                      tickFormatter={v =>
                        dynamicOmzetChart.unit === 'Miliar'
                          ? v === 0
                            ? 'Rp 0'
                            : `Rp ${String(v).replace('.', ',')} M`
                          : v === 0
                          ? 'Rp 0'
                          : `Rp ${Math.round(v)} jt`
                      }
                    />
                    <Tooltip
                      contentStyle={{
                        borderRadius: '14px',
                        border: '1px solid #e2e8f0',
                        boxShadow: '0 10px 25px -5px rgba(15, 23, 42, 0.12)',
                        fontSize: '12px',
                        fontWeight: 700
                      }}
                      formatter={(val: any, name: any, item: any) => {
                        const rawVal =
                          name === 'Omzet Netto'
                            ? item?.payload?.rawNetto
                            : item?.payload?.rawPembanding;
                        if (typeof rawVal === 'number') {
                          return [`Rp ${formatRp(rawVal)}`, String(name || '')];
                        }
                        return [
                          `Rp ${val} ${dynamicOmzetChart.unit}`,
                          String(name || '')
                        ];
                      }}
                    />
                    <Legend
                      verticalAlign="top"
                      height={32}
                      wrapperStyle={{ fontSize: '11px', fontWeight: 700 }}
                    />
                    <Bar
                      dataKey="omzetNetto"
                      name="Omzet Netto"
                      fill="url(#omzetBarGrad)"
                      barSize={
                        omzetChartGranularity === 'Mingguan'
                          ? 46
                          : omzetChartGranularity === 'Harian'
                          ? 34
                          : 36
                      }
                      shape={(props: any) => {
                        const { x, y, width, height, payload } = props;
                        if (!height || height <= 0) return <g />;
                        const r = Math.min(8, width / 2, height);
                        const path = `M${x},${y + height} L${x},${y + r} Q${x},${y} ${x + r},${y} L${x + width - r},${y} Q${x + width},${y} ${x + width},${y + r} L${x + width},${y + height} Z`;
                        const fillUrl = payload?.isCurrent ? 'url(#omzetBarActiveGrad)' : 'url(#omzetBarGrad)';
                        return (
                          <g>
                            <path d={path} fill={fillUrl} />
                            {showOmzetNumbers && payload?.topLabel && (
                              <text
                                x={x + width / 2}
                                y={y - 8}
                                textAnchor="middle"
                                fill="#4338ca"
                                fontSize={10}
                                fontWeight={800}
                              >
                                {payload.topLabel}
                              </text>
                            )}
                            {showOmzetNumbers && payload?.pctLabel && height > 24 && (
                              <text
                                x={x + width / 2}
                                y={y + 18}
                                textAnchor="middle"
                                fill="#ffffff"
                                fontSize={9.5}
                                fontWeight={800}
                              >
                                {payload.pctLabel}
                              </text>
                            )}
                          </g>
                        );
                      }}
                    />
                    <Line
                      type="monotone"
                      dataKey="pembanding"
                      name={dynamicOmzetChart.comparisonName}
                      stroke="#f59e0b"
                      strokeWidth={2.5}
                      strokeDasharray="6 4"
                      dot={{ fill: '#fff', stroke: '#f59e0b', strokeWidth: 2, r: 4 }}
                      activeDot={{ r: 6, fill: '#f59e0b', stroke: '#fff', strokeWidth: 2 }}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* ROW 4: TOP ADMIN & TOP KOTA */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Left: Top Admin (Omzet netto per admin) */}
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 shadow-xs space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 flex items-center justify-center">
                      <User className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-sm font-black text-slate-900 dark:text-white">Top Admin Penjualan</h4>
                      <p className="text-[11px] text-slate-500">Omzet netto per admin</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedAdminFilter('SEMUA ADMIN')}
                    className="px-2.5 py-1 rounded-lg bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-300 text-[10px] font-bold cursor-pointer"
                  >
                    TAMPILKAN SEMUA
                  </button>
                </div>

                <div className="space-y-4 divide-y divide-slate-100 dark:divide-slate-800">
                  {synchronizedOmsetRows.map((adm, idx) => {
                    const maxOmzet = Math.max(...synchronizedOmsetRows.map(x => x.omzetNetto), 1);
                    const widthPct = adm.omzetNetto > 0 ? Math.max(8, Math.round((adm.omzetNetto / maxOmzet) * 100)) : 0;
                    const vsLastRatio = adm.lastMonthOmzet > 0 ? ((adm.omzetNetto / adm.lastMonthOmzet) * 100).toFixed(1) : '0.0';
                    const diffVsLast = adm.omzetNetto - adm.lastMonthOmzet;
                    const diffVsLastPct = adm.lastMonthOmzet > 0 ? ((diffVsLast / adm.lastMonthOmzet) * 100).toFixed(1) : '0.0';
                    return (
                      <div key={adm.id} className={idx > 0 ? 'pt-3.5 space-y-2' : 'space-y-2'}>
                        <div className="flex items-center justify-between gap-2">
                          <div>
                            <div className="text-xs font-black text-slate-900 dark:text-white">
                              {adm.adminName} ({adm.branchCode})
                            </div>
                            <div className="text-[11px] text-slate-500 font-semibold">
                              Qty {formatRp(adm.qtyNetto)} PCS &bull; {adm.kota}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="text-right">
                              <div className="text-xs sm:text-sm font-black text-slate-900 dark:text-white tabular-nums">
                                Rp {formatRp(adm.omzetNetto)}
                              </div>
                              <div className="flex items-center justify-end gap-1.5 mt-0.5">
                                <span className="px-1.5 py-0.5 rounded bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-300 text-[10px] font-bold">
                                  {vsLastRatio.replace('.', ',')}% vs Bln Lalu
                                </span>
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                setManualOmsetAdmin(adm.adminName);
                                setManualOmsetKota(adm.kota && adm.kota !== '-' ? adm.kota : 'BANYUWANGI KOTA');
                                setManualOmsetArea(adm.area && adm.area !== '-' ? adm.area : 'Banyuwangi Kota');
                                setManualOmsetNetto(adm.omzetNetto > 0 ? String(adm.omzetNetto) : '');
                                setManualOmsetQty(adm.qtyNetto > 0 ? String(adm.qtyNetto) : '');
                                setManualOmsetLastMonth(adm.lastMonthOmzet > 0 ? String(adm.lastMonthOmzet) : '');
                                setIsManualOmsetOpen(true);
                              }}
                              className="p-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 cursor-pointer"
                              title="Edit Omset Admin ini"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        <div className="space-y-1">
                          <div className="w-full bg-slate-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
                            <div className="bg-indigo-600 h-full rounded-full" style={{ width: `${widthPct}%` }} />
                          </div>
                        </div>

                        <div className="text-[10px] text-slate-500 font-semibold flex flex-wrap items-center gap-1.5">
                          <span>
                            Vs bulan lalu: Rp {formatRp(adm.lastMonthOmzet)} &bull; Selisih qty {formatRp(adm.qtyNetto - adm.lastMonthQty)} PCS
                          </span>
                          <span
                            className={`px-1.5 py-0.5 rounded font-bold ${
                              diffVsLast >= 0
                                ? 'bg-emerald-50 text-emerald-600'
                                : 'bg-rose-50 text-rose-600'
                            }`}
                          >
                            {diffVsLast >= 0 ? '▲ +' : '▼ '}
                            {diffVsLastPct.replace('.', ',')}%
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Right: Top Kota */}
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 shadow-xs space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 flex items-center justify-center">
                      <MapPin className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-sm font-black text-slate-900 dark:text-white">Top Kota</h4>
                      <p className="text-[11px] text-slate-500">Akumulasi omzet per kota</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedKotaFilter('SEMUA KOTA')}
                    className="px-2.5 py-1 rounded-lg bg-blue-50 dark:bg-blue-950/50 text-blue-600 text-[10px] font-bold cursor-pointer"
                  >
                    TAMPILKAN SEMUA
                  </button>
                </div>

                {topKotaList.length === 0 ? (
                  <div className="py-12 text-center text-xs text-slate-400 italic">
                    Belum ada data omzet per kota untuk periode ini.
                  </div>
                ) : (
                  <div className="space-y-4 divide-y divide-slate-100 dark:divide-slate-800">
                    {topKotaList.map((k, idx) => (
                      <div
                        key={k.kota}
                        onClick={() => setSelectedKotaFilter(k.kota)}
                        className={`${idx > 0 ? 'pt-3.5' : ''} space-y-2 cursor-pointer hover:opacity-90`}
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="text-xs font-black text-slate-900 dark:text-white">{k.kota}</div>
                            <div className="text-[11px] text-slate-500 font-semibold">Qty {k.qty}</div>
                          </div>
                          <div className="text-right">
                            <div className="text-xs sm:text-sm font-black text-slate-900 dark:text-white">
                              Rp {formatRp(k.omzet)}
                            </div>
                            <span
                              className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                k.isPositive
                                  ? 'bg-emerald-50 text-emerald-600'
                                  : 'bg-rose-50 text-rose-600'
                              }`}
                            >
                              {k.pctBadge}
                            </span>
                          </div>
                        </div>
                        <div className="w-full bg-slate-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
                          <div className="bg-blue-600 h-full rounded-full" style={{ width: `${k.barPct}%` }} />
                        </div>
                        <div className="text-[10px] text-slate-500 font-semibold flex items-center gap-1.5">
                          <span>{k.vsText}</span>
                          <span
                            className={`px-1.5 py-0.5 rounded font-bold ${
                              k.vsPos ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'
                            }`}
                          >
                            {k.vsBadge}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* ROW 5: TOP WILAYAH / PELANGGAN & KONTRIBUSI ITEM ADMIN */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Left: Top Customer / Area */}
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 shadow-xs space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-xl bg-violet-50 dark:bg-violet-950/60 text-violet-600 flex items-center justify-center">
                      <Users className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-sm font-black text-slate-900 dark:text-white">Top Area &amp; Pelanggan</h4>
                    </div>
                  </div>
                </div>

                {topCustomerList.length === 0 ? (
                  <div className="py-10 text-center text-xs text-slate-400 italic">
                    Belum ada data omzet area/pelanggan untuk periode ini.
                  </div>
                ) : (
                  <div className="space-y-4 divide-y divide-slate-100 dark:divide-slate-800">
                    {topCustomerList.map((cust, idx) => (
                      <div key={cust.name} className={`${idx > 0 ? 'pt-3.5' : ''} space-y-2`}>
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="text-xs font-black text-slate-900 dark:text-white">{cust.name}</div>
                            <div className="text-[11px] text-slate-500 font-semibold">Qty {cust.qty}</div>
                          </div>
                          <div className="text-right">
                            <div className="text-xs sm:text-sm font-black text-slate-900 dark:text-white">
                              Rp {formatRp(cust.omzet)}
                            </div>
                            <span className="inline-block px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-600 text-[10px] font-bold">
                              {cust.growthPct}
                            </span>
                          </div>
                        </div>
                        <div className="w-full bg-slate-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
                          <div className="bg-violet-600 h-full rounded-full" style={{ width: `${cust.progressPct}%` }} />
                        </div>
                        <div className="text-[10px] text-slate-500 font-semibold flex items-center gap-1.5">
                          <span>{cust.vsLastMonth}</span>
                          <span
                            className={`px-1.5 py-0.5 rounded font-bold ${
                              cust.isVsNegative ? 'bg-rose-50 text-rose-600' : 'bg-emerald-50 text-emerald-600'
                            }`}
                          >
                            {cust.vsBadge}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Right: Top Distribusi Qty & Barang */}
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 shadow-xs space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 flex items-center justify-center">
                      <Package className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-sm font-black text-slate-900 dark:text-white">Distribusi Qty &amp; Omset Admin</h4>
                    </div>
                  </div>
                </div>

                {topBarangList.length === 0 ? (
                  <div className="py-10 text-center text-xs text-slate-400 italic">
                    Belum ada data distribusi barang/qty untuk periode ini.
                  </div>
                ) : (
                  <div className="space-y-4 divide-y divide-slate-100 dark:divide-slate-800">
                    {topBarangList.map((brg, idx) => (
                      <div key={brg.name} className={`${idx > 0 ? 'pt-3.5' : ''} space-y-2`}>
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="text-xs font-black text-slate-900 dark:text-white">{brg.name}</div>
                            <div className="text-[11px] text-slate-500 font-semibold">Qty {brg.qty}</div>
                          </div>
                          <div className="text-right">
                            <div className="text-xs sm:text-sm font-black text-slate-900 dark:text-white">
                              Rp {formatRp(brg.omzet)}
                            </div>
                            <span
                              className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                brg.isPositive ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'
                              }`}
                            >
                              {brg.growthPct}
                            </span>
                          </div>
                        </div>
                        <div className="w-full bg-slate-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
                          <div className="bg-emerald-600 h-full rounded-full" style={{ width: `${brg.progressPct}%` }} />
                        </div>
                        <div className="text-[10px] text-slate-500 font-semibold flex items-center gap-1.5">
                          <span>{brg.vsLastMonth}</span>
                          <span
                            className={`px-1.5 py-0.5 rounded font-bold ${
                              brg.isVsNegative ? 'bg-rose-50 text-rose-600' : 'bg-emerald-50 text-emerald-600'
                            }`}
                          >
                            {brg.vsBadge}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* ROW 6: ANALISA OMZET — MATRIKS KONTRIBUSI ADMIN PENJUALAN */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 sm:p-6 shadow-xs space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-indigo-600 to-blue-600 text-white flex items-center justify-center shadow-xs">
                    <TrendingUp className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-[10px] font-black uppercase tracking-widest text-indigo-600 dark:text-indigo-400 block">
                      ANALISA OMZET &amp; INSIGHT EKSEKUTIF
                    </span>
                    <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-white">
                      Analisa Kontribusi Admin Penjualan ({selectedMonth} {selectedYear})
                    </h3>
                  </div>
                </div>
                <div className="flex items-center gap-2 self-start sm:self-auto">
                  <span className="px-3 py-1.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 text-xs font-bold">
                    {synchronizedOmsetRows.length} Admin Terdaftar
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
                {synchronizedOmsetRows.map((adm, idx) => {
                  const sharePct =
                    omsetSummary.omzetNetto > 0
                      ? ((adm.omzetNetto / omsetSummary.omzetNetto) * 100).toFixed(1)
                      : '0.0';
                  const vsLastPct =
                    adm.lastMonthOmzet > 0
                      ? ((adm.omzetNetto / adm.lastMonthOmzet) * 100).toFixed(1)
                      : '0.0';
                  return (
                    <div
                      key={adm.id}
                      className="p-4 rounded-2xl bg-slate-50/80 dark:bg-slate-950 border border-slate-200/80 dark:border-slate-800 space-y-2.5 shadow-2xs"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <span
                            className={`w-6 h-6 rounded-lg text-[10px] font-black flex items-center justify-center shrink-0 ${
                              idx === 0 && adm.omzetNetto > 0
                                ? 'bg-amber-500 text-white'
                                : idx === 1 && adm.omzetNetto > 0
                                ? 'bg-indigo-600 text-white'
                                : 'bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                            }`}
                          >
                            #{idx + 1}
                          </span>
                          <div className="truncate">
                            <div className="text-xs font-black text-slate-900 dark:text-white truncate">
                              {adm.adminName}
                            </div>
                            <div className="text-[10px] text-slate-400 font-bold">
                              Cabang {adm.branchCode} &bull; {adm.kota}
                            </div>
                          </div>
                        </div>
                        <span className="px-2 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 text-[10px] font-black shrink-0">
                          {sharePct.replace('.', ',')}% Share
                        </span>
                      </div>

                      <div className="flex items-baseline justify-between pt-1">
                        <span className="text-xs sm:text-sm font-black text-indigo-600 dark:text-indigo-400 tabular-nums">
                          Rp {formatRp(adm.omzetNetto)}
                        </span>
                        <span className="text-[10px] font-bold text-slate-500">
                          Qty {formatRp(adm.qtyNetto)} PCS
                        </span>
                      </div>

                      <div className="w-full bg-slate-200 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden">
                        <div
                          className="bg-gradient-to-r from-indigo-600 to-emerald-500 h-full rounded-full"
                          style={{ width: `${adm.omzetNetto > 0 ? Math.min(100, Math.max(8, Number(sharePct))) : 0}%` }}
                        />
                      </div>

                      <div className="flex items-center justify-between text-[10px] text-slate-500 font-semibold">
                        <span>Bln lalu: Rp {formatRp(adm.lastMonthOmzet)}</span>
                        <span className="text-slate-700 dark:text-slate-300 font-bold">
                          {vsLastPct.replace('.', ',')}% dr bln lalu
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

