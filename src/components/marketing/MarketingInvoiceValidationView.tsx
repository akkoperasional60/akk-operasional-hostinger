import React, { useState, useEffect, useMemo, useRef } from 'react';
import * as XLSX from 'xlsx';
import {
  ClipboardCheck,
  Calendar,
  Search,
  Plus,
  CheckCircle2,
  Send,
  MessageSquare,
  User,
  Trash2,
  Edit3,
  X,
  Phone,
  Users,
  Upload,
  Link2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  FileSpreadsheet,
  ArrowLeft,
  Check,
  AlertCircle,
  DollarSign,
  Sparkles
} from 'lucide-react';
import { logisticsStore } from '../../services/store';
import { branchStore } from '../../services/branchStore';
import { canAccess, getUserRoleDisplayTitle } from '../../utils/rbac';
import { UserProfile } from '../../types';

function getEligibleMarketingSalesUsers(
  allUsers: UserProfile[],
  activeBranchId: string
): UserProfile[] {
  return allUsers.filter(u => {
    if (u.status !== 'approved') return false;
    // Kecualikan Admin Penjualan & Super Admin dari daftar Sales Marketing
    if (
      u.role === 'sales_admin' ||
      u.role === 'spv_sales_admin' ||
      u.role === 'super_admin'
    ) {
      return false;
    }
    const branchPerms = branchStore.getUserBranchPermissions(
      u.id,
      u.role,
      u.permissions?.modules,
      u.permissions?.branchPermissions
    );
    const activePerm = branchPerms[activeBranchId];
    if (!activePerm || !activePerm.enabled) return false;
    const mktMod = activePerm.modules?.marketing;
    if (!mktMod || !mktMod.enabled) return false;
    const subs = mktMod.subMenus || {};
    return (
      subs.marketing_invoice_validation === 'full_access' ||
      subs.marketing_invoice_validation === 'read_only' ||
      subs.marketing_offline === 'full_access' ||
      subs.marketing_offline === 'read_only' ||
      subs.marketing_online === 'full_access' ||
      subs.marketing_online === 'read_only' ||
      subs.marketing_sales_mapping === 'full_access' ||
      subs.marketing_sales_mapping === 'read_only'
    );
  });
}

export type MarketingValidationStatus =
  | 'Menunggu Validasi'
  | 'Tervalidasi Siap Kirim'
  | 'Revisi';

export interface InvoiceLineItem {
  id: string;
  keteranganBarang: string;
  ktsFaktur: number;
  satuan: string;
  hargaSatuan: number;
  persenDiskon: number | string;
  nominalDiskon: number;
  totalHarga: number;
}

export interface MarketingInvoiceValidationItem {
  id: string;
  noInvoice: string;
  invoiceDate: string;
  deliveryTomorrowDate: string; // YYYY-MM-DD
  customerName: string;
  areaName: string;
  paymentCategory: 'COD' | 'TEMPO';
  nominalTagihan: number;
  itemSummary: string;
  masterSalesName: string; // Nama Sales di Faktur / Excel (contoh: "17. ZAINAL LKT BALI")
  salesName: string; // Nama Akun di User Management (contoh: "Zainal Abidinsyah")
  salesUserId?: string;
  salesWhatsapp: string;
  validationStatus: MarketingValidationStatus;
  validatedBy?: string;
  validatedAt?: string;
  marketingNotes: string;
  waNotifiedAt?: string;
  lineItems?: InvoiceLineItem[];
}

export interface SalesNameMappingRecord {
  id: string;
  userId: string;
  userFullName: string;
  userPhone: string;
  masterSalesName1: string;
  masterSalesName2: string;
}

export const SALES_MAPPINGS_UPDATED_EVENT = 'akk-sales-mappings-updated';

export const DEFAULT_SALES_MAPPINGS: SalesNameMappingRecord[] = [
  {
    id: 'MAP-SLS-1',
    userId: 'usr-marketing-offline',
    userFullName: 'Zainal Abidinsyah',
    userPhone: '0813-4455-6677',
    masterSalesName1: '17. ZAINAL LKT BALI',
    masterSalesName2: '18. ZAINAL BANYUWANGI'
  },
  {
    id: 'MAP-SLS-2',
    userId: 'usr-operasional',
    userFullName: 'Bayu Novianto Dimas Permana',
    userPhone: '0812-3456-7801',
    masterSalesName1: '23. DIMAS LKT',
    masterSalesName2: 'DIMAS REGULER'
  },
  {
    id: 'MAP-SLS-3',
    userId: 'usr-marketing-gilang',
    userFullName: 'Gilang Arya Pramuditya',
    userPhone: '0813-5566-7788',
    masterSalesName1: '24. GILANG ARYA PRAMUDITYA',
    masterSalesName2: 'GILANG LKT'
  },
  {
    id: 'MAP-SLS-4',
    userId: 'usr-marketing-wongso',
    userFullName: 'Wongso Arrohman Hidayat',
    userPhone: '0813-6677-8899',
    masterSalesName1: '6. WONGSO ARROHMAN HIDAYAT',
    masterSalesName2: 'WONGSO REGULER'
  }
];

let cachedSalesMappings: SalesNameMappingRecord[] = [...DEFAULT_SALES_MAPPINGS];

export function getCachedSalesNameMappings(): SalesNameMappingRecord[] {
  return cachedSalesMappings;
}

export async function fetchSalesNameMappingsFromMysql(): Promise<SalesNameMappingRecord[]> {
  try {
    const res = await fetch('/api/marketing-invoice-validations', { cache: 'no-store' }).then(r => r.json());
    if (res && res.success && Array.isArray(res.salesMappings) && res.salesMappings.length > 0) {
      cachedSalesMappings = res.salesMappings;
      window.dispatchEvent(new CustomEvent(SALES_MAPPINGS_UPDATED_EVENT, { detail: cachedSalesMappings }));
      return cachedSalesMappings;
    }
  } catch {
    // ignore fetch error
  }
  return cachedSalesMappings;
}

function stripNumericSalesPrefix(raw: string): string {
  return String(raw || '')
    .trim()
    .toUpperCase()
    .replace(/^\d+[\s.\-_:]*/, '')
    .trim();
}

function escapeRegexLiteral(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function containsWholeWord(haystackUpper: string, wordUpper: string): boolean {
  if (!haystackUpper || !wordUpper || wordUpper.length < 3) return false;
  const rx = new RegExp(`(?:^|[^A-Z0-9])${escapeRegexLiteral(wordUpper)}(?:$|[^A-Z0-9])`, 'i');
  return rx.test(haystackUpper);
}

export function resolveSalesFromMappings(
  rawSalesInput: string,
  mappings: SalesNameMappingRecord[],
  allUsers: UserProfile[] = [],
  explicitUserId?: string
): {
  userId: string;
  userFullName: string;
  userPhone: string;
  masterSalesName: string;
  pairedMasterNames: string[];
} {
  const rawMaster = String(rawSalesInput || '').trim();
  const normMaster = rawMaster.toUpperCase();
  const strippedMaster = stripNumericSalesPrefix(rawMaster);

  const matchMasterToTarget = (candidateRaw: string): boolean => {
    const c = String(candidateRaw || '').trim().toUpperCase();
    if (!c || !normMaster) return false;
    if (normMaster === c) return true;
    const strippedC = stripNumericSalesPrefix(c);
    if (strippedC && strippedMaster && strippedMaster === strippedC) return true;
    if (c.length >= 4 && normMaster.length >= 4 && (normMaster.includes(c) || c.includes(normMaster))) {
      return true;
    }
    if (strippedC.length >= 4 && strippedMaster.length >= 4 && (strippedMaster.includes(strippedC) || strippedC.includes(strippedMaster))) {
      return true;
    }
    return false;
  };

  // Priority 1: Explicit userId or exact mapping match
  const matchedMapping =
    mappings.find(m => explicitUserId && m.userId === explicitUserId) ||
    mappings.find(m => {
      const m1 = String(m.masterSalesName1 || '').trim().toUpperCase();
      const m2 = String(m.masterSalesName2 || '').trim().toUpperCase();
      return (m1 && normMaster === m1) || (m2 && normMaster === m2);
    }) ||
    mappings.find(m => {
      const m1 = String(m.masterSalesName1 || '').trim().toUpperCase();
      const m2 = String(m.masterSalesName2 || '').trim().toUpperCase();
      const uName = String(m.userFullName || '').trim().toUpperCase();
      return (
        matchMasterToTarget(m1) ||
        matchMasterToTarget(m2) ||
        (uName && normMaster && (normMaster === uName || normMaster.includes(uName) || containsWholeWord(normMaster, uName.split(' ')[0])))
      );
    });

  if (matchedMapping) {
    const liveUser = allUsers.find(u => u.id === matchedMapping.userId);
    const userFullName = liveUser?.fullName || matchedMapping.userFullName;
    const userPhone = liveUser?.phone || matchedMapping.userPhone || '0813-4455-6677';
    const paired = [matchedMapping.masterSalesName1, matchedMapping.masterSalesName2].filter(Boolean);
    return {
      userId: matchedMapping.userId,
      userFullName,
      userPhone,
      masterSalesName: rawMaster || matchedMapping.masterSalesName1,
      pairedMasterNames: paired
    };
  }

  // Prioritize marketing/sales-eligible users before checking general staff
  const prioritizedUsers = [
    ...allUsers.filter(
      u => u.role === 'marketing_offline' || u.role === 'marketing_online' || u.role === 'spv_marketing_offline'
    ),
    ...allUsers.filter(
      u => u.role !== 'marketing_offline' && u.role !== 'marketing_online' && u.role !== 'spv_marketing_offline' && u.role !== 'sales_admin' && u.role !== 'spv_sales_admin' && u.role !== 'super_admin'
    )
  ];

  const directUser =
    (explicitUserId ? allUsers.find(u => u.id === explicitUserId) : undefined) ||
    prioritizedUsers.find(u => {
      const uFull = String(u.fullName || '').trim().toUpperCase();
      if (!uFull || !normMaster) return false;
      return uFull === normMaster || uFull === strippedMaster || normMaster.includes(uFull);
    }) ||
    prioritizedUsers.find(u => {
      const tokens = String(u.fullName || '')
        .trim()
        .toUpperCase()
        .split(/\s+/)
        .filter(t => t.length >= 4);
      return tokens.some(t => containsWholeWord(strippedMaster || normMaster, t));
    });

  if (directUser) {
    return {
      userId: directUser.id,
      userFullName: directUser.fullName,
      userPhone: directUser.phone || '0813-4455-6677',
      masterSalesName: rawMaster || directUser.fullName.toUpperCase(),
      pairedMasterNames: [rawMaster || directUser.fullName.toUpperCase()]
    };
  }

  return {
    userId: explicitUserId || '',
    userFullName: rawMaster || 'Tim Marketing',
    userPhone: '0813-4455-6677',
    masterSalesName: rawMaster || 'SALES MARKETING',
    pairedMasterNames: [rawMaster || 'SALES MARKETING']
  };
}

export function doesInvoiceBelongToUser(
  item: MarketingInvoiceValidationItem,
  targetUser: UserProfile | null | undefined,
  mappings: SalesNameMappingRecord[],
  allUsers: UserProfile[] = []
): boolean {
  if (!targetUser || !targetUser.id) return false;
  const resolved = resolveSalesFromMappings(
    item.masterSalesName || item.salesName,
    mappings,
    allUsers,
    item.salesUserId
  );

  if (item.salesUserId && item.salesUserId === targetUser.id) return true;
  if (resolved.userId && resolved.userId === targetUser.id) return true;

  const targetFullLower = String(targetUser.fullName || '').trim().toLowerCase();
  if (targetFullLower) {
    if (resolved.userFullName.trim().toLowerCase() === targetFullLower) return true;
    if (String(item.salesName || '').trim().toLowerCase() === targetFullLower) return true;
  }

  // Check if any mapping entry belongs to targetUser by ID or exact name
  const userMappings = mappings.filter(
    m =>
      m.userId === targetUser.id ||
      (targetFullLower && String(m.userFullName || '').trim().toLowerCase() === targetFullLower)
  );
  const rawMasterUpper = String(item.masterSalesName || item.salesName || '').trim().toUpperCase();
  const strippedItemMaster = stripNumericSalesPrefix(rawMasterUpper);

  for (const m of userMappings) {
    for (const candidate of [m.masterSalesName1, m.masterSalesName2]) {
      const cUpper = String(candidate || '').trim().toUpperCase();
      if (!cUpper) continue;
      const strippedC = stripNumericSalesPrefix(cUpper);
      if (
        rawMasterUpper === cUpper ||
        (strippedItemMaster && strippedC && strippedItemMaster === strippedC) ||
        (cUpper.length >= 4 && rawMasterUpper.includes(cUpper)) ||
        (strippedC.length >= 4 && strippedItemMaster.includes(strippedC))
      ) {
        return true;
      }
    }
  }

  // If already assigned to a different specific userId, do not guess by partial name
  if (resolved.userId && resolved.userId !== targetUser.id) {
    return false;
  }

  const tokens = String(targetUser.fullName || '')
    .trim()
    .toUpperCase()
    .split(/\s+/)
    .filter(t => t.length >= 4);
  return tokens.some(t => containsWholeWord(strippedItemMaster || rawMasterUpper, t));
}

function getTomorrowIso(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function getTodayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function normalizeValidationStatus(raw?: string): MarketingValidationStatus {
  if (!raw) return 'Menunggu Validasi';
  if (raw === 'Tervalidasi Siap Kirim') return 'Tervalidasi Siap Kirim';
  if (raw === 'Revisi' || raw === 'Revisi / Tunda Kirim' || raw.toLowerCase().includes('revisi')) {
    return 'Revisi';
  }
  return 'Menunggu Validasi';
}

function formatReadableDate(iso: string): string {
  if (!iso) return '-';
  const parts = iso.split('-').map(Number);
  if (parts.length !== 3 || !parts[0] || !parts[1] || !parts[2]) return iso;
  const dt = new Date(parts[0], parts[1] - 1, parts[2]);
  return dt.toLocaleDateString('id-ID', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  });
}

function normalizeWaPhone(raw: string): string {
  const digits = String(raw || '').replace(/\D/g, '');
  if (!digits) return '6281344556677';
  if (digits.startsWith('0')) return '62' + digits.slice(1);
  if (digits.startsWith('8')) return '62' + digits;
  return digits;
}

function formatRupiahNumber(num: number): string {
  if (!num || Number.isNaN(num) || num <= 0) return '';
  return Math.round(num).toLocaleString('id-ID');
}

// ============================================================================
// KOMPONEN CUSTOM DROPDOWN MODERN (PENGGANTI NATIVE <select>)
// ============================================================================
export interface ValidationDropdownOption {
  value: string;
  label: string;
  subLabel?: string;
  badge?: string;
  badgeTone?: 'emerald' | 'amber' | 'rose' | 'indigo' | 'blue' | 'slate';
}

interface ModernValidationDropdownProps {
  value: string;
  onChange: (val: string) => void;
  options: ValidationDropdownOption[];
  icon?: React.ReactNode;
  placeholder?: string;
  searchable?: boolean;
  searchPlaceholder?: string;
  align?: 'left' | 'right';
  minWidthClass?: string;
}

export const ModernValidationDropdown: React.FC<ModernValidationDropdownProps> = ({
  value,
  onChange,
  options,
  icon,
  placeholder = 'Pilih...',
  searchable = false,
  searchPlaceholder = 'Cari pilihan...',
  align = 'left',
  minWidthClass = 'min-w-[230px]'
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const handleOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false);
    };
    document.addEventListener('mousedown', handleOutside);
    document.addEventListener('keydown', handleEsc);
    return () => {
      document.removeEventListener('mousedown', handleOutside);
      document.removeEventListener('keydown', handleEsc);
    };
  }, [isOpen]);

  const selected = useMemo(
    () => options.find(o => o.value === value) || options[0] || { value, label: placeholder },
    [options, value, placeholder]
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter(
      o =>
        o.label.toLowerCase().includes(q) ||
        (o.subLabel && o.subLabel.toLowerCase().includes(q)) ||
        (o.badge && o.badge.toLowerCase().includes(q))
    );
  }, [options, query]);

  const getBadgeClass = (tone?: ValidationDropdownOption['badgeTone'], isSelected?: boolean) => {
    if (isSelected) return 'bg-white/20 text-white border-white/30';
    switch (tone) {
      case 'emerald':
        return 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800';
      case 'amber':
        return 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800';
      case 'rose':
        return 'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800';
      case 'indigo':
        return 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800';
      case 'blue':
        return 'bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800';
      default:
        return 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700';
    }
  };

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => {
          setIsOpen(prev => !prev);
          setQuery('');
        }}
        className={`w-full px-3 py-2 rounded-xl border text-xs font-bold flex items-center justify-between gap-2 transition-all cursor-pointer ${minWidthClass} ${
          isOpen
            ? 'bg-white dark:bg-slate-900 border-blue-500 ring-2 ring-blue-500/20 text-slate-900 dark:text-white shadow-sm'
            : 'bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 hover:border-blue-400 dark:hover:border-blue-700 text-slate-800 dark:text-slate-100'
        }`}
      >
        <div className="flex items-center gap-2 min-w-0">
          {icon && (
            <span className="w-6 h-6 rounded-lg bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
              {icon}
            </span>
          )}
          <span className="truncate">{selected.label}</span>
          {selected.badge && (
            <span
              className={`px-1.5 py-0.5 rounded-md text-[9px] font-extrabold border shrink-0 ${getBadgeClass(
                selected.badgeTone,
                false
              )}`}
            >
              {selected.badge}
            </span>
          )}
        </div>
        <span
          className={`w-5 h-5 rounded-md flex items-center justify-center transition-transform duration-150 shrink-0 ${
            isOpen
              ? 'bg-blue-600 text-white rotate-180'
              : 'bg-slate-200/70 dark:bg-slate-800 text-slate-500'
          }`}
        >
          <ChevronDown className="w-3.5 h-3.5" />
        </span>
      </button>

      {isOpen && (
        <div
          className={`absolute ${
            align === 'right' ? 'right-0' : 'left-0'
          } mt-1.5 z-50 w-full min-w-[260px] sm:min-w-[300px] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-2xl p-2 space-y-1.5`}
        >
          {searchable && (
            <div className="relative px-1 pt-0.5">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder={searchPlaceholder}
                className="w-full pl-8 pr-3 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-900 dark:text-white focus:outline-none focus:border-blue-500"
              />
            </div>
          )}

          <div className="max-h-64 overflow-y-auto space-y-1 pr-0.5">
            {filtered.length === 0 ? (
              <div className="py-4 px-3 text-center text-xs text-slate-400">
                Tidak ada pilihan yang cocok
              </div>
            ) : (
              filtered.map(opt => {
                const isSelected = opt.value === value;
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
                        ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-extrabold shadow-xs'
                        : 'text-slate-700 dark:text-slate-200 hover:bg-blue-50/70 dark:hover:bg-slate-800/80 font-bold'
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="truncate">{opt.label}</span>
                        {opt.badge && (
                          <span
                            className={`px-1.5 py-0.5 rounded-md text-[9px] font-extrabold border shrink-0 ${getBadgeClass(
                              opt.badgeTone,
                              isSelected
                            )}`}
                          >
                            {opt.badge}
                          </span>
                        )}
                      </div>
                      {opt.subLabel && (
                        <span
                          className={`block text-[10px] truncate mt-0.5 ${
                            isSelected ? 'text-blue-100 font-medium' : 'text-slate-400 dark:text-slate-500 font-medium'
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

// ============================================================================
// KOMPONEN KALENDER POPOVER MODERN (PENGGANTI NATIVE DATE PICKER)
// ============================================================================
const INDONESIAN_MONTHS = [
  'Januari',
  'Februari',
  'Maret',
  'April',
  'Mei',
  'Juni',
  'Juli',
  'Agustus',
  'September',
  'Oktober',
  'November',
  'Desember'
];

const SHORT_DAYS = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];

interface ModernCalendarPopoverProps {
  value: string; // '' or 'YYYY-MM-DD'
  onChange: (isoDate: string) => void;
  labelPrefix?: string;
  allowEmpty?: boolean;
  emptyLabel?: string;
}

export const ModernCalendarPopover: React.FC<ModernCalendarPopoverProps> = ({
  value,
  onChange,
  labelPrefix = 'Kalender Kirim:',
  allowEmpty = true,
  emptyLabel = 'Semua Tanggal'
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const initialDate = useMemo(() => {
    if (value) {
      const [y, m] = value.split('-').map(Number);
      if (y && m) return { year: y, month: m - 1 };
    }
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() };
  }, [value]);

  const [viewYear, setViewYear] = useState(initialDate.year);
  const [viewMonth, setViewMonth] = useState(initialDate.month);

  useEffect(() => {
    if (value) {
      const [y, m] = value.split('-').map(Number);
      if (y && m) {
        setViewYear(y);
        setViewMonth(m - 1);
      }
    }
  }, [value]);

  useEffect(() => {
    if (!isOpen) return;
    const handleOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, [isOpen]);

  const calendarDays = useMemo(() => {
    const firstDayOfWeek = new Date(viewYear, viewMonth, 1).getDay();
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
    const cells: Array<{ day: number | null; iso: string }> = [];

    for (let i = 0; i < firstDayOfWeek; i++) {
      cells.push({ day: null, iso: '' });
    }
    for (let d = 1; d <= daysInMonth; d++) {
      const iso = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      cells.push({ day: d, iso });
    }
    return cells;
  }, [viewYear, viewMonth]);

  const handlePrevMonth = () => {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear(y => y - 1);
    } else {
      setViewMonth(m => m - 1);
    }
  };

  const handleNextMonth = () => {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear(y => y + 1);
    } else {
      setViewMonth(m => m + 1);
    }
  };

  const todayIso = getTodayIso();
  const tomorrowIso = getTomorrowIso();

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setIsOpen(prev => !prev)}
        className={`px-3 py-2 rounded-xl border text-xs font-bold flex items-center justify-between gap-2 transition-all cursor-pointer ${
          isOpen
            ? 'bg-white dark:bg-slate-900 border-blue-500 ring-2 ring-blue-500/20 text-slate-900 dark:text-white shadow-sm'
            : 'bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 hover:border-blue-400 dark:hover:border-blue-700 text-slate-800 dark:text-slate-100'
        }`}
      >
        <div className="flex items-center gap-2">
          <span className="w-6 h-6 rounded-lg bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
            <Calendar className="w-3.5 h-3.5" />
          </span>
          {labelPrefix && (
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 dark:text-slate-500">
              {labelPrefix}
            </span>
          )}
          <span className="font-mono font-extrabold text-slate-900 dark:text-white">
            {value ? formatReadableDate(value) : emptyLabel}
          </span>
        </div>
        <span
          className={`w-5 h-5 rounded-md flex items-center justify-center transition-transform duration-150 shrink-0 ${
            isOpen
              ? 'bg-blue-600 text-white rotate-180'
              : 'bg-slate-200/70 dark:bg-slate-800 text-slate-500'
          }`}
        >
          <ChevronDown className="w-3.5 h-3.5" />
        </span>
      </button>

      {isOpen && (
        <div className="absolute left-0 mt-1.5 z-50 w-72 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-2xl p-3.5 space-y-3">
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={handlePrevMonth}
              className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <div className="text-xs font-extrabold text-slate-900 dark:text-white">
              {INDONESIAN_MONTHS[viewMonth]} {viewYear}
            </div>
            <button
              type="button"
              onClick={handleNextMonth}
              className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 cursor-pointer"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-7 gap-1 text-center">
            {SHORT_DAYS.map(d => (
              <div key={d} className="text-[10px] font-extrabold text-slate-400 py-1">
                {d}
              </div>
            ))}
            {calendarDays.map((cell, idx) => {
              if (!cell.day) {
                return <div key={`empty-${idx}`} className="h-7" />;
              }
              const isSelected = cell.iso === value;
              const isToday = cell.iso === todayIso;
              return (
                <button
                  key={cell.iso}
                  type="button"
                  onClick={() => {
                    onChange(cell.iso);
                    setIsOpen(false);
                  }}
                  className={`h-7 rounded-lg text-[11px] font-mono font-bold transition cursor-pointer flex items-center justify-center ${
                    isSelected
                      ? 'bg-blue-600 text-white font-extrabold shadow-xs'
                      : isToday
                      ? 'bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-300 border border-blue-200 dark:border-blue-800'
                      : 'text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                >
                  {cell.day}
                </button>
              );
            })}
          </div>

          <div className="flex items-center justify-between gap-1.5 pt-2 border-t border-slate-100 dark:border-slate-800">
            {allowEmpty && (
              <button
                type="button"
                onClick={() => {
                  onChange('');
                  setIsOpen(false);
                }}
                className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-600 dark:text-slate-300 text-[10px] font-bold cursor-pointer"
              >
                Semua Tanggal
              </button>
            )}
            <div className="flex items-center gap-1 ml-auto">
              <button
                type="button"
                onClick={() => {
                  onChange(todayIso);
                  setIsOpen(false);
                }}
                className="px-2.5 py-1 rounded-lg bg-blue-50 dark:bg-blue-950/50 hover:bg-blue-100 text-blue-600 dark:text-blue-300 text-[10px] font-bold cursor-pointer"
              >
                Hari Ini
              </button>
              <button
                type="button"
                onClick={() => {
                  onChange(tomorrowIso);
                  setIsOpen(false);
                }}
                className="px-2.5 py-1 rounded-lg bg-indigo-50 dark:bg-indigo-950/50 hover:bg-indigo-100 text-indigo-600 dark:text-indigo-300 text-[10px] font-bold cursor-pointer"
              >
                Besok
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ============================================================================
// KOMPONEN STATUS VALIDASI DROPDOWN COMPACT PER BARIS FAKTUR
// ============================================================================
const ROW_STATUS_OPTIONS: Array<{
  value: MarketingValidationStatus;
  shortLabel: string;
  fullLabel: string;
  tone: 'emerald' | 'amber' | 'rose';
}> = [
  {
    value: 'Tervalidasi Siap Kirim',
    shortLabel: 'Tervalidasi',
    fullLabel: 'Tervalidasi Siap Kirim',
    tone: 'emerald'
  },
  {
    value: 'Menunggu Validasi',
    shortLabel: 'Menunggu',
    fullLabel: 'Menunggu Validasi',
    tone: 'amber'
  },
  {
    value: 'Revisi',
    shortLabel: 'Revisi',
    fullLabel: 'Revisi',
    tone: 'rose'
  }
];

const RowStatusDropdown: React.FC<{
  value: MarketingValidationStatus;
  onChange: (status: MarketingValidationStatus) => void;
}> = ({ value, onChange }) => {
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const handleOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, [isOpen]);

  const normalized = normalizeValidationStatus(value);
  const currentOpt = ROW_STATUS_OPTIONS.find(o => o.value === normalized) || ROW_STATUS_OPTIONS[1];

  const triggerClass =
    currentOpt.tone === 'emerald'
      ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800 hover:border-emerald-400'
      : currentOpt.tone === 'rose'
      ? 'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800 hover:border-rose-400'
      : 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800 hover:border-amber-400';

  return (
    <div ref={ref} className="relative flex-1 min-w-0">
      <button
        type="button"
        onClick={() => setIsOpen(prev => !prev)}
        className={`w-full h-7 px-2 rounded-lg border text-[10px] font-extrabold flex items-center justify-between gap-1 transition cursor-pointer ${triggerClass}`}
        title={currentOpt.fullLabel}
      >
        <span className="truncate">{currentOpt.shortLabel}</span>
        <ChevronDown className={`w-3 h-3 shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-1 z-50 w-44 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl p-1.5 space-y-1">
          {ROW_STATUS_OPTIONS.map(opt => {
            const isSelected = opt.value === normalized;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => {
                  onChange(opt.value);
                  setIsOpen(false);
                }}
                className={`w-full text-left px-2.5 py-1.5 rounded-lg text-[11px] font-bold flex items-center justify-between gap-2 transition cursor-pointer ${
                  isSelected
                    ? opt.tone === 'emerald'
                      ? 'bg-emerald-600 text-white'
                      : opt.tone === 'rose'
                      ? 'bg-rose-600 text-white'
                      : 'bg-amber-500 text-white'
                    : 'text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                <span>{opt.fullLabel}</span>
                {isSelected && <Check className="w-3.5 h-3.5 shrink-0" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

// ============================================================================
// SUB-MENU BARU MARKETING OFFLINE: MAPPING NAMA SALES
// Terintegrasi langsung ke Validasi Faktur & Aplikasi Penagihan Pelanggan
// ============================================================================
export const MarketingSalesMappingView: React.FC<{
  onNavigateTab?: (tab: string) => void;
}> = ({ onNavigateTab }) => {
  const [allUsers, setAllUsers] = useState<UserProfile[]>(() => logisticsStore.getUsers());
  const [activeBranchId, setActiveBranchId] = useState<string>(() => branchStore.getSelectedOriginBranchId());
  useEffect(() => {
    const syncUsers = () => setAllUsers([...logisticsStore.getUsers()]);
    const unsubUsers = logisticsStore.subscribe(syncUsers);
    const unsubBranch = branchStore.subscribe(() => setActiveBranchId(branchStore.getSelectedOriginBranchId()));
    return () => {
      unsubUsers();
      unsubBranch();
    };
  }, []);

  const validationUsers = useMemo(
    () => getEligibleMarketingSalesUsers(allUsers, activeBranchId),
    [allUsers, activeBranchId]
  );

  const [salesMappings, setSalesMappings] = useState<SalesNameMappingRecord[]>(DEFAULT_SALES_MAPPINGS);
  const [editingMappingId, setEditingMappingId] = useState<string | null>(null);
  const [mapUserId, setMapUserId] = useState<string>(() => validationUsers[0]?.id || '');
  useEffect(() => {
    if (validationUsers.length === 0) {
      setMapUserId('');
    } else if (!validationUsers.some(u => u.id === mapUserId)) {
      setMapUserId(validationUsers[0].id);
    }
  }, [validationUsers, mapUserId]);
  const [mapMasterName1, setMapMasterName1] = useState<string>('');
  const [mapMasterName2, setMapMasterName2] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isSavingMysql, setIsSavingMysql] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  useEffect(() => {
    let active = true;
    fetch('/api/marketing-invoice-validations', { cache: 'no-store' })
      .then(r => r.json())
      .then(res => {
        if (!active) return;
        if (res && res.success && Array.isArray(res.salesMappings) && res.salesMappings.length > 0) {
          setSalesMappings(res.salesMappings);
          cachedSalesMappings = res.salesMappings;
        } else {
          setSalesMappings(DEFAULT_SALES_MAPPINGS);
          cachedSalesMappings = DEFAULT_SALES_MAPPINGS;
          void fetch('/api/marketing-invoice-validations', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ salesMappings: DEFAULT_SALES_MAPPINGS })
          });
        }
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  const persistMappingsToMysql = async (nextMappings: SalesNameMappingRecord[]) => {
    setIsSavingMysql(true);
    try {
      cachedSalesMappings = nextMappings;
      window.dispatchEvent(new CustomEvent(SALES_MAPPINGS_UPDATED_EVENT, { detail: nextMappings }));
      await fetch('/api/marketing-invoice-validations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ salesMappings: nextMappings })
      });
    } catch (err) {
      console.warn('[MySQL Sales Mapping Sync Error]', err);
    } finally {
      setIsSavingMysql(false);
    }
  };

  const handleSaveMapping = (e: React.FormEvent) => {
    e.preventDefault();
    const targetUser = allUsers.find(u => u.id === mapUserId);
    if (!targetUser || !mapMasterName1.trim()) {
      showToast('Pilih Akun User Management dan isi minimal Master Nama Sales 1.');
      return;
    }

    const entry: SalesNameMappingRecord = {
      id: editingMappingId || `MAP-SLS-${Date.now()}`,
      userId: targetUser.id,
      userFullName: targetUser.fullName,
      userPhone: targetUser.phone || '0813-4455-6677',
      masterSalesName1: mapMasterName1.trim().toUpperCase(),
      masterSalesName2: mapMasterName2.trim().toUpperCase()
    };

    const nextMappings = editingMappingId
      ? salesMappings.map(m => (m.id === editingMappingId ? entry : m))
      : [...salesMappings, entry];

    setSalesMappings(nextMappings);
    void persistMappingsToMysql(nextMappings);
    setEditingMappingId(null);
    setMapMasterName1('');
    setMapMasterName2('');
    showToast(
      `Mapping Nama Sales untuk ${entry.userFullName} tersimpan ke database & terintegrasi ke Validasi Faktur dan Aplikasi Penagihan.`
    );
  };

  const handleEditMapping = (m: SalesNameMappingRecord) => {
    setEditingMappingId(m.id);
    setMapUserId(m.userId);
    setMapMasterName1(m.masterSalesName1);
    setMapMasterName2(m.masterSalesName2);
  };

  const handleDeleteMapping = (id: string) => {
    const nextMappings = salesMappings.filter(m => m.id !== id);
    setSalesMappings(nextMappings);
    void persistMappingsToMysql(nextMappings);
    showToast('Data Mapping Nama Sales berhasil dihapus dari database.');
  };

  const filteredMappings = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return salesMappings;
    return salesMappings.filter(
      m =>
        m.userFullName.toLowerCase().includes(q) ||
        m.masterSalesName1.toLowerCase().includes(q) ||
        m.masterSalesName2.toLowerCase().includes(q) ||
        m.userPhone.toLowerCase().includes(q)
    );
  }, [salesMappings, searchQuery]);

  return (
    <div className="space-y-5 w-full max-w-full">
      {toastMessage && (
        <div className="fixed bottom-5 right-5 z-50 bg-emerald-600 text-white px-4 py-2.5 rounded-xl shadow-xl text-xs font-bold flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header Sub-Menu Mapping Nama Sales */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-2xs">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="w-11 h-11 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shrink-0 shadow-sm">
              <Link2 className="w-5 h-5" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-lg sm:text-xl font-extrabold text-slate-900 dark:text-white tracking-tight">
                  Mapping Nama Sales (1 Sales = 2 Master Nama Sales)
                </h1>
                {isSavingMysql && (
                  <span className="text-xs font-semibold text-indigo-600 dark:text-indigo-400">
                    &middot; Menyimpan ke database...
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Hubungkan 1 Akun Sales pada User Management (beserta Nomor WA) dengan 2 Master Nama Sales yang terintegrasi otomatis ke Validasi Faktur &amp; Aplikasi Penagihan Pelanggan.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {onNavigateTab && (
              <>
                <button
                  type="button"
                  onClick={() => onNavigateTab('marketing_invoice_validation')}
                  className="px-3.5 py-2 rounded-xl bg-blue-50 dark:bg-blue-950/50 hover:bg-blue-100 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
                >
                  <ClipboardCheck className="w-3.5 h-3.5" />
                  <span>Buka Validasi Faktur</span>
                </button>
                <button
                  type="button"
                  onClick={() => onNavigateTab('marketing_billing_app')}
                  className="px-3.5 py-2 rounded-xl bg-amber-50 dark:bg-amber-950/50 hover:bg-amber-100 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800 text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
                >
                  <DollarSign className="w-3.5 h-3.5" />
                  <span>Buka Aplikasi Penagihan</span>
                </button>
              </>
            )}
          </div>
        </div>

        {/* Ringkasan Integrasi */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-4 pt-4 border-t border-slate-100 dark:border-slate-800">
          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200/80 dark:border-slate-800">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
              Total Akun Sales Termapping
            </span>
            <div className="text-lg font-extrabold text-slate-900 dark:text-white mt-0.5 font-mono tabular-nums">
              {salesMappings.length} Akun Sales
            </div>
          </div>
          <div className="p-3 rounded-xl bg-blue-50/50 dark:bg-blue-950/30 border border-blue-200/70 dark:border-blue-800/50">
            <span className="text-[10px] font-bold uppercase tracking-wider text-blue-700 dark:text-blue-300 block">
              Total Master Nama Sales Aktif
            </span>
            <div className="text-lg font-extrabold text-blue-700 dark:text-blue-300 mt-0.5 font-mono tabular-nums">
              {salesMappings.reduce(
                (acc, m) => acc + (m.masterSalesName1 ? 1 : 0) + (m.masterSalesName2 ? 1 : 0),
                0
              )}{' '}
              Master Nama
            </div>
          </div>
          <div className="p-3 rounded-xl bg-emerald-50/50 dark:bg-emerald-950/30 border border-emerald-200/70 dark:border-emerald-800/50">
            <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-300 block">
              Modul Terintegrasi Otomatis
            </span>
            <div className="text-xs font-extrabold text-emerald-700 dark:text-emerald-300 mt-1">
              Validasi Faktur &bull; Aplikasi Penagihan &bull; WA Sales
            </div>
          </div>
        </div>
      </div>

      {/* Form Input / Edit Mapping Nama Sales */}
      <form
        onSubmit={handleSaveMapping}
        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-2xs space-y-4"
      >
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
          <div>
            <h2 className="text-sm font-extrabold text-slate-900 dark:text-white">
              {editingMappingId ? 'Perbarui Data Mapping Nama Sales' : 'Tambah Mapping Nama Sales Baru'}
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Pilih Akun User Management yang memiliki akses validasi/penagihan lalu hubungkan dengan Master Nama Sales 1 &amp; Master Nama Sales 2
            </p>
          </div>
          {editingMappingId && (
            <button
              type="button"
              onClick={() => {
                setEditingMappingId(null);
                setMapMasterName1('');
                setMapMasterName2('');
              }}
              className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-600 dark:text-slate-300 cursor-pointer"
            >
              Batal Edit
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1.5">
              Akun User Management (Akses Validasi &amp; Penagihan) *
            </label>
            <ModernValidationDropdown
              value={mapUserId}
              onChange={val => setMapUserId(val)}
              icon={<User className="w-3.5 h-3.5" />}
              searchable
              searchPlaceholder="Cari nama user atau nomor WA..."
              options={validationUsers.map(u => ({
                value: u.id,
                label: u.fullName,
                subLabel: `${getUserRoleDisplayTitle(u.role)} • WA: ${u.phone || '-'}`,
                badge: u.phone || 'No WA',
                badgeTone: 'emerald'
              }))}
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1.5">
              Master Nama Sales 1 (Pada Faktur / Excel) *
            </label>
            <input
              type="text"
              required
              value={mapMasterName1}
              onChange={e => setMapMasterName1(e.target.value)}
              placeholder="Contoh: 17. ZAINAL LKT BALI"
              className="w-full px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs font-bold text-slate-900 dark:text-white uppercase focus:outline-none focus:border-blue-500"
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1.5">
              Master Nama Sales 2 (Opsional)
            </label>
            <input
              type="text"
              value={mapMasterName2}
              onChange={e => setMapMasterName2(e.target.value)}
              placeholder="Contoh: 18. ZAINAL BANYUWANGI"
              className="w-full px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs font-bold text-slate-900 dark:text-white uppercase focus:outline-none focus:border-blue-500"
            />
          </div>
        </div>

        <div className="flex items-center justify-end pt-1">
          <button
            type="submit"
            className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-extrabold flex items-center gap-2 shadow-xs transition cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>{editingMappingId ? 'Simpan Perubahan Mapping' : 'Simpan Mapping Nama Sales'}</span>
          </button>
        </div>
      </form>

      {/* Tabel Daftar Mapping Nama Sales */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-2xs">
        <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-extrabold text-slate-900 dark:text-white">
              Daftar Mapping Nama Sales Aktif ({filteredMappings.length})
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Setiap Master Nama Sales otomatis terhubung dengan Nomor WA Sales pada Validasi Faktur &amp; Aplikasi Penagihan
            </p>
          </div>
          <div className="relative w-full sm:w-72">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Cari akun sales atau master nama..."
              className="w-full pl-8 pr-3 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-900 dark:text-white focus:outline-none focus:border-blue-500"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-800 text-[10px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400 h-10">
                <th className="px-4">No</th>
                <th className="px-4">Akun User Management</th>
                <th className="px-4">No. Telepon / WA Sales</th>
                <th className="px-4">Master Nama Sales 1</th>
                <th className="px-4">Master Nama Sales 2</th>
                <th className="px-4">Integrasi Modul</th>
                <th className="px-4 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
              {filteredMappings.map((m, idx) => {
                const liveUser = allUsers.find(u => u.id === m.userId);
                const phoneDisplay = liveUser?.phone || m.userPhone || '-';
                const nameDisplay = liveUser?.fullName || m.userFullName;
                return (
                  <tr key={m.id} className="h-11 hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors">
                    <td className="px-4 font-mono font-bold text-slate-500">{idx + 1}</td>
                    <td className="px-4 font-extrabold text-slate-900 dark:text-white whitespace-nowrap">
                      {nameDisplay}
                      {liveUser && (
                        <span className="ml-2 text-[10px] font-medium text-slate-400">
                          &middot; {getUserRoleDisplayTitle(liveUser.role)}
                        </span>
                      )}
                    </td>
                    <td className="px-4 font-mono font-bold text-emerald-600 dark:text-emerald-400 whitespace-nowrap">
                      {phoneDisplay}
                    </td>
                    <td className="px-4 font-extrabold text-blue-700 dark:text-blue-300 whitespace-nowrap">
                      {m.masterSalesName1}
                    </td>
                    <td className="px-4 font-extrabold text-indigo-700 dark:text-indigo-300 whitespace-nowrap">
                      {m.masterSalesName2 || '-'}
                    </td>
                    <td className="px-4 text-[11px] text-slate-500 dark:text-slate-400 whitespace-nowrap">
                      Validasi Faktur &middot; Aplikasi Penagihan
                    </td>
                    <td className="px-4 text-right whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => handleEditMapping(m)}
                        className="px-2.5 py-1 rounded-lg text-[11px] font-bold text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/50 mr-1 cursor-pointer"
                      >
                        Ubah
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteMapping(m.id)}
                        className="px-2.5 py-1 rounded-lg text-[11px] font-bold text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/50 cursor-pointer"
                      >
                        Hapus
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// KOMPONEN UTAMA: VALIDASI FAKTUR & RINCIAN BARANG PENGIRIMAN
// ============================================================================
export const MarketingInvoiceValidationView: React.FC<{
  onNavigateTab?: (tab: string) => void;
}> = ({ onNavigateTab }) => {
  const tomorrowIso = useMemo(() => getTomorrowIso(), []);
  const todayIso = useMemo(() => getTodayIso(), []);
  const excelInputRef = useRef<HTMLInputElement | null>(null);

  // View Mode: 'table' (Tabel Utama) atau 'upload_excel' (Halaman Upload Excel & Panduan Kolom Terbaca)
  const [viewMode, setViewMode] = useState<'table' | 'upload_excel'>('table');

  // State khusus Halaman Upload Excel
  const [uploadTargetDate, setUploadTargetDate] = useState<string>(tomorrowIso);
  const [uploadFileName, setUploadFileName] = useState<string>('');
  const [uploadPreviewInvoices, setUploadPreviewInvoices] = useState<MarketingInvoiceValidationItem[]>([]);
  const [uploadSkippedEmptyRows, setUploadSkippedEmptyRows] = useState<number>(0);

  // Subscribe to User Management users, current logged-in user & active branch
  const [allUsers, setAllUsers] = useState<UserProfile[]>(() => logisticsStore.getUsers());
  const [currentUser, setCurrentUser] = useState<UserProfile>(() => logisticsStore.getCurrentUser());
  const [activeBranchId, setActiveBranchId] = useState<string>(() => branchStore.getSelectedOriginBranchId());
  useEffect(() => {
    const syncUsers = () => {
      setAllUsers([...logisticsStore.getUsers()]);
      setCurrentUser(logisticsStore.getCurrentUser());
    };
    const unsubUsers = logisticsStore.subscribe(syncUsers);
    const unsubBranch = branchStore.subscribe(() => {
      setActiveBranchId(branchStore.getSelectedOriginBranchId());
    });
    return () => {
      unsubUsers();
      unsubBranch();
    };
  }, []);

  const canViewAllSalesAccounts = useMemo(() => {
    const r = String(currentUser?.role || '').toLowerCase();
    return (
      r === 'super_admin' ||
      r === 'spv_marketing_offline' ||
      r === 'spv_sales_admin' ||
      r === 'sales_admin' ||
      r === 'operasional'
    );
  }, [currentUser]);
  const isPersonalSalesMode = !canViewAllSalesAccounts;

  const activeBranchName = useMemo(
    () => branchStore.getBranchById(activeBranchId)?.name || 'Cabang Aktif',
    [activeBranchId]
  );

  // Hanya tampilkan user yang disetujui, BUKAN Adm. Penjualan, aktif di cabang terpilih, dan punya akses modul Marketing
  const validationUsers = useMemo(
    () => getEligibleMarketingSalesUsers(allUsers, activeBranchId),
    [allUsers, activeBranchId]
  );

  // Murni dari Server Database (/api/marketing-invoice-validations)
  const [records, setRecords] = useState<MarketingInvoiceValidationItem[]>([]);
  const [salesMappings, setSalesMappings] = useState<SalesNameMappingRecord[]>(DEFAULT_SALES_MAPPINGS);
  const [isLoadingMysql, setIsLoadingMysql] = useState<boolean>(true);
  const [isSyncingMysql, setIsSyncingMysql] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Filters
  const [selectedDeliveryDate, setSelectedDeliveryDate] = useState<string>(''); // '' = Semua Tanggal
  const [selectedSalesUserFilter, setSelectedSalesUserFilter] = useState<string>('ALL');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  useEffect(() => {
    if (isPersonalSalesMode && currentUser?.id) {
      setSelectedSalesUserFilter(currentUser.id);
      return;
    }
    if (
      selectedSalesUserFilter !== 'ALL' &&
      !validationUsers.some(u => u.id === selectedSalesUserFilter)
    ) {
      setSelectedSalesUserFilter('ALL');
    }
  }, [isPersonalSalesMode, currentUser?.id, activeBranchId, validationUsers, selectedSalesUserFilter]);

  // Modal Tambah Faktur
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formNoInvoice, setFormNoInvoice] = useState('');
  const [formDeliveryDate, setFormDeliveryDate] = useState(tomorrowIso);
  const [formCustomerName, setFormCustomerName] = useState('');
  const [formAreaName, setFormAreaName] = useState('BANYUWANGI');
  const [formPaymentCategory, setFormPaymentCategory] = useState<'COD' | 'TEMPO'>('TEMPO');
  const [formMasterSalesName, setFormMasterSalesName] = useState('17. ZAINAL LKT BALI');
  const [formSalesUserId, setFormSalesUserId] = useState(() => validationUsers[0]?.id || '');
  useEffect(() => {
    if (isPersonalSalesMode && currentUser?.id) {
      setFormSalesUserId(currentUser.id);
      return;
    }
    if (validationUsers.length === 0) {
      if (formSalesUserId) setFormSalesUserId('');
    } else if (!validationUsers.some(u => u.id === formSalesUserId)) {
      setFormSalesUserId(validationUsers[0].id);
    }
  }, [isPersonalSalesMode, currentUser?.id, validationUsers, formSalesUserId]);
  const [formStatus, setFormStatus] = useState<MarketingValidationStatus>('Menunggu Validasi');
  const [formNotes, setFormNotes] = useState('');
  const [formLineItems, setFormLineItems] = useState<InvoiceLineItem[]>([
    {
      id: 'LI-NEW-1',
      keteranganBarang: '',
      ktsFaktur: 1,
      satuan: 'ZAK',
      hargaSatuan: 0,
      persenDiskon: '',
      nominalDiskon: 0,
      totalHarga: 0
    }
  ]);

  // Modal Integrasi WhatsApp Sales
  const [waModalData, setWaModalData] = useState<{
    title: string;
    salesUserId?: string;
    salesName: string;
    masterSalesNames: string;
    salesWhatsapp: string;
    messageText: string;
    targetIds: string[];
  } | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const persistToMysql = async (
    nextRecords?: MarketingInvoiceValidationItem[],
    nextMappings?: SalesNameMappingRecord[]
  ) => {
    setIsSyncingMysql(true);
    try {
      const payload: Record<string, any> = {};
      if (nextRecords) payload.records = nextRecords;
      if (nextMappings) payload.salesMappings = nextMappings;
      await fetch('/api/marketing-invoice-validations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
    } catch (err) {
      console.warn('[MySQL Marketing Invoice Validations Sync Error]', err);
    } finally {
      setIsSyncingMysql(false);
    }
  };

  // Hydrate murni dari MySQL (/api/marketing-invoice-validations)
  useEffect(() => {
    let active = true;
    setIsLoadingMysql(true);
    fetch('/api/marketing-invoice-validations', { cache: 'no-store' })
      .then(r => r.json())
      .then(res => {
        if (!active) return;
        if (res && res.success && Array.isArray(res.records)) {
          const normalized = res.records
            .map((r: MarketingInvoiceValidationItem) => ({
              ...r,
              validationStatus: normalizeValidationStatus(r.validationStatus),
              lineItems: (Array.isArray(r.lineItems) ? r.lineItems : []).filter(
                li => (Number(li.totalHarga) || 0) > 0 || (Number(li.hargaSatuan) || 0) > 0
              )
            }))
            .filter((r: MarketingInvoiceValidationItem) => (Number(r.nominalTagihan) || 0) > 0);
          setRecords(normalized);
        } else {
          setRecords([]);
        }

        if (res && res.success && Array.isArray(res.salesMappings) && res.salesMappings.length > 0) {
          setSalesMappings(res.salesMappings);
          cachedSalesMappings = res.salesMappings;
        } else {
          setSalesMappings(DEFAULT_SALES_MAPPINGS);
          cachedSalesMappings = DEFAULT_SALES_MAPPINGS;
        }
      })
      .catch(err => {
        console.warn('[MySQL Marketing Validations Fetch Error]', err);
      })
      .finally(() => {
        if (active) setIsLoadingMysql(false);
      });

    const handleMappingUpdated = (evt: Event) => {
      const customEvt = evt as CustomEvent<SalesNameMappingRecord[]>;
      if (Array.isArray(customEvt.detail)) {
        setSalesMappings(customEvt.detail);
      }
    };
    window.addEventListener(SALES_MAPPINGS_UPDATED_EVENT, handleMappingUpdated);
    return () => {
      active = false;
      window.removeEventListener(SALES_MAPPINGS_UPDATED_EVENT, handleMappingUpdated);
    };
  }, []);

  const resolveSalesInfo = (item: MarketingInvoiceValidationItem) => {
    return resolveSalesFromMappings(
      item.masterSalesName || item.salesName,
      salesMappings,
      allUsers,
      item.salesUserId
    );
  };

  // Parse file Excel pada Halaman Upload Excel (mengabaikan baris dengan nominal kosong / 0)
  const handleExcelFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadFileName(file.name);

    const reader = new FileReader();
    reader.onload = evt => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsName = wb.SheetNames[0];
        const ws = wb.Sheets[wsName];
        const rows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });

        let currentSales = '';
        let currentCustomer = '';
        let currentInvoiceNo = '';
        let skippedZeroNominal = 0;
        const invoiceMap = new Map<string, MarketingInvoiceValidationItem>();

        const parseNum = (val: any): number => {
          if (typeof val === 'number') return Number.isFinite(val) ? val : 0;
          const raw = String(val || '').trim();
          if (!raw || raw === '-' || raw.toLowerCase() === 'rp -' || raw.toLowerCase() === 'rp-') {
            return 0;
          }
          const cleaned = raw
            .replace(/Rp/gi, '')
            .replace(/\s+/g, '')
            .replace(/\./g, '')
            .replace(/,/g, '.')
            .replace(/[^\d.-]/g, '');
          const n = parseFloat(cleaned);
          return Number.isFinite(n) ? n : 0;
        };

        rows.forEach((row, rIdx) => {
          if (!Array.isArray(row) || row.length < 4) return;
          const col0 = String(row[0] || '').trim();
          const col1 = String(row[1] || '').trim();
          const col2 = String(row[2] || '').trim();
          const col3 = String(row[3] || '').trim();

          // Skip header row
          if (
            col0.toLowerCase().includes('nama sales') ||
            col2.toLowerCase().includes('no faktur') ||
            col3.toLowerCase().includes('keterangan barang')
          ) {
            return;
          }

          if (col0) currentSales = col0.toUpperCase();
          if (col1) currentCustomer = col1.toUpperCase();
          if (col2) currentInvoiceNo = col2.toUpperCase();

          if (!currentInvoiceNo || !col3) return;

          const kts = parseNum(row[4]);
          const sat = String(row[5] || 'PAK').trim().toUpperCase();
          const hargaSatuan = parseNum(row[6]);
          const persenVal = parseNum(row[7]);
          const persenRaw = persenVal > 0 ? persenVal : '';
          const diskon = Math.max(0, parseNum(row[8]));
          const rawTotalHarga = parseNum(row[9]);
          const computedTotal =
            rawTotalHarga > 0
              ? rawTotalHarga
              : kts > 0 && hargaSatuan > 0
              ? Math.max(0, kts * hargaSatuan - diskon)
              : 0;

          // Request 4: Untuk nominal yang kosongan tidak perlu terbaca untuk dimasukkan ke dalam data tabel
          if (computedTotal <= 0 && hargaSatuan <= 0) {
            skippedZeroNominal += 1;
            return;
          }

          const lineItem: InvoiceLineItem = {
            id: `LI-XLS-${Date.now()}-${rIdx}`,
            keteranganBarang: col3.toUpperCase(),
            ktsFaktur: kts > 0 ? kts : 1,
            satuan: sat || 'PAK',
            hargaSatuan: hargaSatuan > 0 ? hargaSatuan : computedTotal,
            persenDiskon: persenRaw,
            nominalDiskon: diskon > 0 ? diskon : 0,
            totalHarga: computedTotal
          };

          const existing = invoiceMap.get(currentInvoiceNo);
          if (existing) {
            existing.lineItems = [...(existing.lineItems || []), lineItem];
            existing.nominalTagihan = existing.lineItems.reduce((s, l) => s + l.totalHarga, 0);
            existing.itemSummary = existing.lineItems.map(l => l.keteranganBarang).join(', ');
          } else {
            const tempRecord: MarketingInvoiceValidationItem = {
              id: `MIV-XLS-${Date.now()}-${rIdx}`,
              noInvoice: currentInvoiceNo,
              invoiceDate: todayIso,
              deliveryTomorrowDate: uploadTargetDate || tomorrowIso,
              customerName: currentCustomer || 'PELANGGAN',
              areaName: 'BANYUWANGI',
              paymentCategory: 'TEMPO',
              nominalTagihan: computedTotal,
              itemSummary: lineItem.keteranganBarang,
              masterSalesName: currentSales,
              salesName: currentSales,
              salesWhatsapp: '0813-4455-6677',
              validationStatus: 'Menunggu Validasi',
              marketingNotes: 'Diimpor dari file Excel Validasi Faktur',
              lineItems: [lineItem]
            };
            const resolved = resolveSalesInfo(tempRecord);
            tempRecord.salesUserId = resolved.userId;
            tempRecord.salesName = resolved.userFullName;
            tempRecord.salesWhatsapp = resolved.userPhone;
            invoiceMap.set(currentInvoiceNo, tempRecord);
          }
        });

        const parsedInvoices = Array.from(invoiceMap.values()).filter(inv => inv.nominalTagihan > 0);
        setUploadPreviewInvoices(parsedInvoices);
        setUploadSkippedEmptyRows(skippedZeroNominal);

        if (parsedInvoices.length === 0) {
          showToast('Tidak ditemukan baris faktur dengan nominal valid pada file Excel tersebut.');
        } else {
          showToast(
            `${parsedInvoices.length} faktur valid terbaca dari file Excel${
              skippedZeroNominal > 0 ? ` (${skippedZeroNominal} baris nominal kosong dilewati)` : ''
            }.`
          );
        }
      } catch (err) {
        console.warn('[Excel Import Error]', err);
        showToast('Gagal membaca file Excel. Pastikan format kolom sesuai panduan.');
      } finally {
        if (excelInputRef.current) excelInputRef.current.value = '';
      }
    };
    reader.readAsBinaryString(file);
  };

  const handleConfirmSaveUploadedExcel = async () => {
    if (uploadPreviewInvoices.length === 0) return;
    const syncedWithDate = uploadPreviewInvoices.map(inv => ({
      ...inv,
      deliveryTomorrowDate: uploadTargetDate || inv.deliveryTomorrowDate || tomorrowIso
    }));
    const importedNoSet = new Set(syncedWithDate.map(i => i.noInvoice.toUpperCase()));

    // Tarik snapshot server terbaru sebelum menggabungkan agar data sales lain tidak tertimpa
    let latestServerRecords = records;
    try {
      const latestRes = await fetch('/api/marketing-invoice-validations', { cache: 'no-store' }).then(r => r.json());
      if (latestRes?.success && Array.isArray(latestRes.records)) {
        latestServerRecords = latestRes.records;
      }
    } catch {}

    const merged = [
      ...syncedWithDate,
      ...latestServerRecords.filter(r => !importedNoSet.has(r.noInvoice.toUpperCase()))
    ];
    setRecords(merged);
    await persistToMysql(merged, undefined);

    if (isPersonalSalesMode) {
      const ownCount = syncedWithDate.filter(inv =>
        doesInvoiceBelongToUser(inv, currentUser, salesMappings, allUsers)
      ).length;
      showToast(
        `${syncedWithDate.length} faktur tersimpan ke database (${ownCount} faktur milik akun ${currentUser.fullName} ditampilkan).`
      );
    } else {
      showToast(`${syncedWithDate.length} faktur berhasil disimpan ke database.`);
    }
    setUploadPreviewInvoices([]);
    setUploadFileName('');
    setViewMode('table');
  };

  // Scoping per akun: Akun Sales hanya melihat faktur miliknya; Admin/SPV melihat semua & bisa filter per akun
  const accountScopedRecords = useMemo(() => {
    const validPositive = records.filter(item => (Number(item.nominalTagihan) || 0) > 0);
    if (!isPersonalSalesMode) {
      return validPositive;
    }
    return validPositive.filter(item =>
      doesInvoiceBelongToUser(item, currentUser, salesMappings, allUsers)
    );
  }, [records, isPersonalSalesMode, currentUser, salesMappings, allUsers]);

  // Ringkasan distribusi faktur per Akun Sales (untuk dropdown & quick-filter Admin/SPV)
  const salesAccountSummary = useMemo(() => {
    const countMap = new Map<string, { label: string; count: number; total: number }>();
    accountScopedRecords.forEach(item => {
      if (selectedDeliveryDate && item.deliveryTomorrowDate !== selectedDeliveryDate) return;
      const res = resolveSalesInfo(item);
      const key = res.userId || res.userFullName;
      const prev = countMap.get(key);
      if (prev) {
        prev.count += 1;
        prev.total += Number(item.nominalTagihan) || 0;
      } else {
        countMap.set(key, {
          label: res.userFullName,
          count: 1,
          total: Number(item.nominalTagihan) || 0
        });
      }
    });
    return countMap;
  }, [accountScopedRecords, selectedDeliveryDate, salesMappings, allUsers]);

  const currentUserMasterLabel = useMemo(() => {
    const userFullLower = String(currentUser?.fullName || '').trim().toLowerCase();
    const mapped = salesMappings.filter(
      m =>
        m.userId === currentUser?.id ||
        (userFullLower && String(m.userFullName || '').trim().toLowerCase() === userFullLower)
    );
    const names = mapped
      .flatMap(m => [m.masterSalesName1, m.masterSalesName2])
      .filter(Boolean);
    return names.length > 0 ? names.join(' / ') : currentUser?.fullName || '';
  }, [currentUser, salesMappings]);

  const filteredRecords = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const list = accountScopedRecords.filter(item => {
      const resolved = resolveSalesInfo(item);
      const itemStatus = normalizeValidationStatus(item.validationStatus);

      if (selectedDeliveryDate && item.deliveryTomorrowDate !== selectedDeliveryDate) {
        return false;
      }

      if (!isPersonalSalesMode && selectedSalesUserFilter !== 'ALL') {
        const targetUser = allUsers.find(u => u.id === selectedSalesUserFilter);
        const matchesUser = targetUser
          ? doesInvoiceBelongToUser(item, targetUser, salesMappings, allUsers)
          : resolved.userId === selectedSalesUserFilter ||
            resolved.userFullName.toLowerCase() === selectedSalesUserFilter.toLowerCase() ||
            resolved.masterSalesName.toLowerCase() === selectedSalesUserFilter.toLowerCase();
        if (!matchesUser) return false;
      }

      if (selectedStatusFilter !== 'ALL' && itemStatus !== selectedStatusFilter) {
        return false;
      }

      if (q) {
        const matchInv = item.noInvoice.toLowerCase().includes(q);
        const matchCust = item.customerName.toLowerCase().includes(q);
        const matchMasterSales = resolved.masterSalesName.toLowerCase().includes(q);
        const matchUserSales = resolved.userFullName.toLowerCase().includes(q);
        const matchBarang =
          item.itemSummary.toLowerCase().includes(q) ||
          (item.lineItems || []).some(li => li.keteranganBarang.toLowerCase().includes(q));
        if (!matchInv && !matchCust && !matchMasterSales && !matchUserSales && !matchBarang) {
          return false;
        }
      }
      return true;
    });

    // Kelompokkan per Akun Sales agar faktur dari Excel campuran rapi per masing-masing Sales
    return [...list].sort((a, b) => {
      const ra = resolveSalesInfo(a);
      const rb = resolveSalesInfo(b);
      const ka = (ra.userFullName || ra.masterSalesName || '').toUpperCase();
      const kb = (rb.userFullName || rb.masterSalesName || '').toUpperCase();
      if (ka !== kb) return ka.localeCompare(kb);
      const ma = (ra.masterSalesName || '').toUpperCase();
      const mb = (rb.masterSalesName || '').toUpperCase();
      if (ma !== mb) return ma.localeCompare(mb);
      return a.customerName.localeCompare(b.customerName);
    });
  }, [
    accountScopedRecords,
    isPersonalSalesMode,
    salesMappings,
    allUsers,
    selectedDeliveryDate,
    selectedSalesUserFilter,
    selectedStatusFilter,
    searchQuery
  ]);

  // Flatten invoices into rows — filtering out any line items with empty/zero nominal!
  const flattenedExcelRows = useMemo(() => {
    const rows: Array<{
      rowKey: string;
      invoice: MarketingInvoiceValidationItem;
      resolvedSales: ReturnType<typeof resolveSalesInfo>;
      lineItem: InvoiceLineItem;
      isFirstOfSales: boolean;
      isFirstOfCustomer: boolean;
      isFirstOfInvoice: boolean;
      invoiceLineCount: number;
    }> = [];

    let prevSalesKey = '';
    let prevCustomerKey = '';
    let prevInvoiceKey = '';

    filteredRecords.forEach(inv => {
      const resolvedSales = resolveSalesInfo(inv);
      const rawLines: InvoiceLineItem[] =
        Array.isArray(inv.lineItems) && inv.lineItems.length > 0
          ? inv.lineItems
          : [
              {
                id: `${inv.id}-LI-0`,
                keteranganBarang: inv.itemSummary || 'BARANG KEMASAN',
                ktsFaktur: 1,
                satuan: 'CRT',
                hargaSatuan: inv.nominalTagihan || 0,
                persenDiskon: '',
                nominalDiskon: 0,
                totalHarga: inv.nominalTagihan || 0
              }
            ];

      // Request 4: Nominal kosongan / 0 tidak dimasukkan ke dalam tabel
      const validLines = rawLines.filter(
        li => (Number(li.totalHarga) || 0) > 0 || (Number(li.hargaSatuan) || 0) > 0
      );
      if (validLines.length === 0) return;

      const salesKey = resolvedSales.masterSalesName.toUpperCase();
      const customerKey = `${salesKey}__${inv.customerName.toUpperCase()}`;
      const invoiceKey = `${customerKey}__${inv.noInvoice.toUpperCase()}`;

      validLines.forEach((li, idx) => {
        const isFirstOfSales = salesKey !== prevSalesKey;
        const isFirstOfCustomer = customerKey !== prevCustomerKey;
        const isFirstOfInvoice = invoiceKey !== prevInvoiceKey && idx === 0;

        rows.push({
          rowKey: `${inv.id}-${li.id}-${idx}`,
          invoice: inv,
          resolvedSales,
          lineItem: li,
          isFirstOfSales,
          isFirstOfCustomer,
          isFirstOfInvoice,
          invoiceLineCount: validLines.length
        });

        prevSalesKey = salesKey;
        prevCustomerKey = customerKey;
        prevInvoiceKey = invoiceKey;
      });
    });

    return rows;
  }, [filteredRecords, salesMappings, allUsers]);

  const stats = useMemo(() => {
    const totalInvoices = filteredRecords.length;
    const totalItems = flattenedExcelRows.length;
    const totalNominal = filteredRecords.reduce((acc, r) => acc + (Number(r.nominalTagihan) || 0), 0);
    const validated = filteredRecords.filter(
      r => normalizeValidationStatus(r.validationStatus) === 'Tervalidasi Siap Kirim'
    ).length;
    const pending = filteredRecords.filter(
      r => normalizeValidationStatus(r.validationStatus) === 'Menunggu Validasi'
    ).length;
    const revision = filteredRecords.filter(
      r => normalizeValidationStatus(r.validationStatus) === 'Revisi'
    ).length;
    return { totalInvoices, totalItems, totalNominal, validated, pending, revision };
  }, [filteredRecords, flattenedExcelRows]);

  const handleQuickStatusUpdate = async (id: string, nextStatus: MarketingValidationStatus) => {
    const validatorName = currentUser?.fullName || 'Tim Marketing Offline';
    const nowIso = new Date().toISOString();

    const next = records.map(item =>
      item.id === id
        ? {
            ...item,
            validationStatus: nextStatus,
            validatedBy: validatorName,
            validatedAt: nowIso
          }
        : item
    );
    setRecords(next);
    setIsSyncingMysql(true);
    try {
      await fetch('/api/marketing-invoice-validations/status', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id,
          validationStatus: nextStatus,
          validatedBy: validatorName,
          validatedAt: nowIso
        })
      });
    } catch {
      void persistToMysql(next, undefined);
    } finally {
      setIsSyncingMysql(false);
    }
    showToast(`Status faktur diperbarui menjadi "${nextStatus}".`);
  };

  const openAddModal = () => {
    setEditingId(null);
    const nextNum = String(records.length + 1390).padStart(4, '0');
    const lockedUser = isPersonalSalesMode ? currentUser : validationUsers[0];
    const firstMap =
      salesMappings.find(m => m.userId === lockedUser?.id) ||
      (isPersonalSalesMode ? undefined : salesMappings[0]);
    setFormNoInvoice(`FJ02-1126-${nextNum}`);
    setFormDeliveryDate(selectedDeliveryDate || tomorrowIso);
    setFormCustomerName('');
    setFormAreaName('BANYUWANGI');
    setFormPaymentCategory('TEMPO');
    setFormSalesUserId(firstMap?.userId || lockedUser?.id || '');
    setFormMasterSalesName(
      firstMap?.masterSalesName1 || lockedUser?.fullName?.toUpperCase() || 'SALES MARKETING'
    );
    setFormStatus('Menunggu Validasi');
    setFormNotes('');
    setFormLineItems([
      {
        id: `LI-NEW-${Date.now()}`,
        keteranganBarang: '',
        ktsFaktur: 1,
        satuan: 'ZAK',
        hargaSatuan: 0,
        persenDiskon: '',
        nominalDiskon: 0,
        totalHarga: 0
      }
    ]);
    setIsFormModalOpen(true);
  };

  const handleAddLineItemRow = () => {
    setFormLineItems(prev => [
      ...prev,
      {
        id: `LI-NEW-${Date.now()}-${prev.length}`,
        keteranganBarang: '',
        ktsFaktur: 1,
        satuan: 'PAK',
        hargaSatuan: 0,
        persenDiskon: '',
        nominalDiskon: 0,
        totalHarga: 0
      }
    ]);
  };

  const handleUpdateLineItemRow = (index: number, field: keyof InvoiceLineItem, value: any) => {
    setFormLineItems(prev =>
      prev.map((li, i) => {
        if (i !== index) return li;
        const updated = { ...li, [field]: value };
        const kts = Number(updated.ktsFaktur) || 0;
        const harga = Number(updated.hargaSatuan) || 0;
        const pct = Number(updated.persenDiskon) || 0;
        if (field === 'ktsFaktur' || field === 'hargaSatuan' || field === 'persenDiskon') {
          const discNominal = pct > 0 ? Math.round((kts * harga * pct) / 100) : Number(updated.nominalDiskon) || 0;
          updated.nominalDiskon = discNominal;
          updated.totalHarga = Math.max(0, kts * harga - discNominal);
        } else if (field === 'nominalDiskon') {
          const discNominal = Number(value) || 0;
          updated.totalHarga = Math.max(0, kts * harga - discNominal);
        }
        return updated;
      })
    );
  };

  const handleRemoveLineItemRow = (index: number) => {
    setFormLineItems(prev => (prev.length > 1 ? prev.filter((_, i) => i !== index) : prev));
  };

  const handleSaveForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formNoInvoice.trim() || !formCustomerName.trim()) return;

    // Nominal kosongan tidak dimasukkan ke dalam data tabel
    const validLines = formLineItems
      .filter(
        li =>
          li.keteranganBarang.trim().length > 0 &&
          ((Number(li.totalHarga) || 0) > 0 || (Number(li.hargaSatuan) || 0) > 0)
      )
      .map(li => {
        const kts = Number(li.ktsFaktur) || 1;
        const harga = Number(li.hargaSatuan) || 0;
        const disc = Math.max(0, Number(li.nominalDiskon) || 0);
        const total = Number(li.totalHarga) > 0 ? Number(li.totalHarga) : Math.max(0, kts * harga - disc);
        return {
          ...li,
          keteranganBarang: li.keteranganBarang.trim().toUpperCase(),
          satuan: (li.satuan || 'PAK').trim().toUpperCase(),
          ktsFaktur: kts,
          hargaSatuan: harga,
          nominalDiskon: disc,
          totalHarga: total
        };
      });

    if (validLines.length === 0) {
      showToast('Masukkan minimal 1 baris barang dengan Harga Satuan / Total Harga lebih dari Rp 0.');
      return;
    }

    const totalTagihan = validLines.reduce((acc, l) => acc + (Number(l.totalHarga) || 0), 0);
    const summaryText = validLines.map(l => l.keteranganBarang).join(', ');

    const selectedUser = isPersonalSalesMode
      ? currentUser
      : allUsers.find(u => u.id === formSalesUserId);
    const validatorName = currentUser?.fullName || 'Tim Marketing Offline';

    const payload: MarketingInvoiceValidationItem = {
      id: editingId || `MIV-${Date.now()}`,
      noInvoice: formNoInvoice.trim().toUpperCase(),
      invoiceDate: todayIso,
      deliveryTomorrowDate: formDeliveryDate || tomorrowIso,
      customerName: formCustomerName.trim().toUpperCase(),
      areaName: formAreaName.trim().toUpperCase() || 'BANYUWANGI',
      paymentCategory: formPaymentCategory,
      nominalTagihan: totalTagihan,
      itemSummary: summaryText,
      masterSalesName: formMasterSalesName.trim().toUpperCase() || selectedUser?.fullName.toUpperCase() || 'SALES',
      salesName: selectedUser?.fullName || formMasterSalesName.trim(),
      salesUserId: selectedUser?.id || formSalesUserId,
      salesWhatsapp: selectedUser?.phone || '0813-4455-6677',
      validationStatus: formStatus,
      validatedBy: validatorName,
      validatedAt: new Date().toISOString(),
      marketingNotes: formNotes.trim(),
      lineItems: validLines
    };

    // Tarik snapshot terbaru dari server agar faktur milik akun Sales lain tidak tertimpa
    let baseRecords = records;
    try {
      const latestRes = await fetch('/api/marketing-invoice-validations', { cache: 'no-store' }).then(r => r.json());
      if (latestRes?.success && Array.isArray(latestRes.records)) {
        baseRecords = latestRes.records;
      }
    } catch {}

    const next = editingId
      ? baseRecords.map(r => (r.id === editingId ? { ...r, ...payload } : r))
      : [payload, ...baseRecords];

    setRecords(next);
    await persistToMysql(next, undefined);
    setIsFormModalOpen(false);
    showToast(`Faktur ${payload.noInvoice} berhasil disimpan ke database.`);
  };

  // Build WhatsApp message for single invoice
  const openWaModalForInvoice = (item: MarketingInvoiceValidationItem) => {
    const resolved = resolveSalesInfo(item);
    const readableDate = formatReadableDate(item.deliveryTomorrowDate);
    const lines = (item.lineItems || [])
      .filter(li => (Number(li.totalHarga) || 0) > 0)
      .map(
        (li, i) =>
          `  ${i + 1}. ${li.keteranganBarang} — ${li.ktsFaktur} ${li.satuan} x Rp ${formatRupiahNumber(li.hargaSatuan)}${
            li.nominalDiskon > 0
              ? ` (Disc${li.persenDiskon ? ` ${li.persenDiskon}%` : ''}: Rp ${formatRupiahNumber(li.nominalDiskon)})`
              : ''
          } = *Rp ${formatRupiahNumber(li.totalHarga)}*`
      );

    const msg =
      `Halo *${resolved.userFullName}* (${resolved.masterSalesName}),\n` +
      `Berikut konfirmasi *Validasi Faktur Pengiriman (${readableDate})* dari Tim Marketing:\n\n` +
      `• *Nama Sales*: ${resolved.masterSalesName}\n` +
      `• *Nama Pelanggan*: ${item.customerName}\n` +
      `• *No. Faktur*: ${item.noInvoice}\n` +
      `• *Rincian Barang*:\n${lines.join('\n')}\n` +
      `• *Total Harga Faktur*: *Rp ${formatRupiahNumber(item.nominalTagihan)}*\n` +
      `• *Status Validasi*: *${normalizeValidationStatus(item.validationStatus)}*\n\n` +
      `Mohon konfirmasi ke pelanggan agar penerimaan barang berjalan lancar. Terima kasih.`;

    setWaModalData({
      title: `Kirim Validasi WA Sales — ${item.noInvoice}`,
      salesName: resolved.userFullName,
      masterSalesNames: resolved.pairedMasterNames.join(' / '),
      salesWhatsapp: resolved.userPhone,
      messageText: msg,
      targetIds: [item.id]
    });
  };

  // Build Batch WhatsApp message for an eligible Marketing Sales user in the active branch
  const openBatchWaModalForSales = (targetUserFilter?: string) => {
    const firstResolved = filteredRecords[0] ? resolveSalesInfo(filteredRecords[0]) : null;
    const requestedId = isPersonalSalesMode
      ? currentUser.id
      : targetUserFilter && targetUserFilter !== 'ALL'
      ? targetUserFilter
      : firstResolved?.userId;

    const chosenUser = isPersonalSalesMode
      ? currentUser
      : (requestedId ? validationUsers.find(u => u.id === requestedId) : undefined) ||
        validationUsers[0];

    if (!chosenUser) {
      showToast(
        `Belum ada akun Sales Marketing yang memiliki akses di cabang ${activeBranchName}. Atur hak akses cabang & modul Marketing di Manajemen User.`
      );
      return;
    }

    const salesItems = filteredRecords.filter(r =>
      doesInvoiceBelongToUser(r, chosenUser, salesMappings, allUsers)
    );

    const targetList = salesItems;
    const sampleResolved = targetList[0] ? resolveSalesInfo(targetList[0]) : null;
    const mapEntry = salesMappings.find(m => m.userId === chosenUser.id);
    const pairedMasters =
      sampleResolved?.pairedMasterNames.join(' & ') ||
      [mapEntry?.masterSalesName1, mapEntry?.masterSalesName2].filter(Boolean).join(' & ') ||
      chosenUser.fullName;

    const salesFullName = chosenUser.fullName;
    const salesPhone = chosenUser.phone || mapEntry?.userPhone || '';
    const readableDate = formatReadableDate(selectedDeliveryDate || tomorrowIso);

    const lines = targetList.map((it, idx) => {
      const itemCount = Array.isArray(it.lineItems) ? it.lineItems.length : 1;
      return `${idx + 1}. *${it.customerName}* [${it.masterSalesName}] — Faktur: *${it.noInvoice}* (${itemCount} item) | Total: *Rp ${formatRupiahNumber(it.nominalTagihan) || '0'}* | *${normalizeValidationStatus(it.validationStatus)}*`;
    });

    const grandTotal = targetList.reduce((acc, it) => acc + (Number(it.nominalTagihan) || 0), 0);
    const grandTotalText = grandTotal > 0 ? formatRupiahNumber(grandTotal) : '0';

    const msg =
      `Halo *${salesFullName}* (Master Sales: *${pairedMasters}*),\n` +
      `Berikut *Rekap Validasi Faktur Pengiriman (${readableDate})*:\n\n` +
      (lines.length > 0 ? lines.join('\n') : 'Belum ada daftar faktur.') +
      `\n\nTotal Rekap: *${targetList.length} Faktur* (*Rp ${grandTotalText}*).\n` +
      `Mohon koordinasi dengan toko terkait jadwal pengiriman. Terima kasih.`;

    setWaModalData({
      title: `Rekap WA Sales — ${salesFullName}`,
      salesUserId: chosenUser.id,
      salesName: salesFullName,
      masterSalesNames: pairedMasters,
      salesWhatsapp: salesPhone,
      messageText: msg,
      targetIds: targetList.map(i => i.id)
    });
  };

  const handleConfirmSendWa = async () => {
    if (!waModalData) return;
    const cleanPhone = normalizeWaPhone(waModalData.salesWhatsapp);
    const encoded = encodeURIComponent(waModalData.messageText);
    const waUrl = `https://wa.me/${cleanPhone}?text=${encoded}`;

    const nowIso = new Date().toISOString();
    const idSet = new Set(waModalData.targetIds);
    const next = records.map(r =>
      idSet.has(r.id)
        ? {
            ...r,
            salesWhatsapp: waModalData.salesWhatsapp,
            waNotifiedAt: nowIso
          }
        : r
    );
    setRecords(next);

    if (waModalData.targetIds.length > 0) {
      setIsSyncingMysql(true);
      try {
        await fetch('/api/marketing-invoice-validations/status', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ids: waModalData.targetIds,
            salesWhatsapp: waModalData.salesWhatsapp,
            waNotifiedAt: nowIso
          })
        });
      } catch {
        void persistToMysql(next, undefined);
      } finally {
        setIsSyncingMysql(false);
      }
    }

    const a = document.createElement('a');
    a.href = waUrl;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    setWaModalData(null);
    showToast(`Validasi faktur diteruskan ke WhatsApp ${waModalData.salesName} (${waModalData.salesWhatsapp}).`);
  };

  const masterSalesOptionsForSelectedUser = useMemo(() => {
    const m = salesMappings.find(x => x.userId === formSalesUserId);
    const opts = new Set<string>();
    if (m) {
      if (m.masterSalesName1) opts.add(m.masterSalesName1);
      if (m.masterSalesName2) opts.add(m.masterSalesName2);
    }
    salesMappings.forEach(sm => {
      if (sm.masterSalesName1) opts.add(sm.masterSalesName1);
      if (sm.masterSalesName2) opts.add(sm.masterSalesName2);
    });
    return Array.from(opts);
  }, [salesMappings, formSalesUserId]);

  const READABLE_EXCEL_COLUMNS = [
    {
      no: '01',
      name: 'Nama Sales',
      desc: 'Nama Master Sales pada Faktur (otomatis terhubung ke Akun User Management & WA Sales melalui Mapping Nama Sales).'
    },
    {
      no: '02',
      name: 'Nama Pelanggan',
      desc: 'Nama Toko / Pelanggan tujuan pengiriman (otomatis meneruskan nama pelanggan untuk baris berikutnya).'
    },
    {
      no: '03',
      name: 'No Faktur',
      desc: 'Nomor Faktur Penjualan (contoh: FJ02-1126-1384). Multi-baris barang otomatis digabung per faktur.'
    },
    {
      no: '04',
      name: 'Keterangan Barang',
      desc: 'Nama lengkap dan spesifikasi kemasan barang yang dikirimkan.'
    },
    {
      no: '05',
      name: 'Kts. Faktur',
      desc: 'Kuantitas / jumlah barang pada baris faktur.'
    },
    {
      no: '06',
      name: 'sat',
      desc: 'Satuan kemasan barang (ZAK, CRT, PAK, SLP, ROL, SET, KG, PCS, DZN, BOX).'
    },
    {
      no: '07',
      name: 'Harga satuan',
      desc: 'Harga satuan barang dalam Rupiah.'
    },
    {
      no: '08',
      name: '%',
      desc: 'Persentase diskon item barang (opsional; dikosongkan bila tanpa diskon).'
    },
    {
      no: '09',
      name: 'Diskon',
      desc: 'Nominal potongan diskon Rupiah (jika kosong / Rp - otomatis dikosongkan tanpa menampilkan Rp -).'
    },
    {
      no: '10',
      name: 'Total Harga',
      desc: 'Total nilai bersih baris barang. Baris dengan nominal kosong / 0 otomatis tidak dimasukkan ke tabel.'
    }
  ];

  // ==========================================================================
  // RENDER HALAMAN UPLOAD EXCEL VALIDASI FAKTUR (Request 1)
  // ==========================================================================
  if (viewMode === 'upload_excel') {
    const totalPreviewLines = uploadPreviewInvoices.reduce(
      (acc, inv) => acc + (inv.lineItems?.length || 0),
      0
    );
    const totalPreviewNominal = uploadPreviewInvoices.reduce(
      (acc, inv) => acc + (Number(inv.nominalTagihan) || 0),
      0
    );

    const previewPerSales = (() => {
      const grouped = new Map<
        string,
        {
          key: string;
          userFullName: string;
          masterNames: Set<string>;
          invoiceCount: number;
          lineCount: number;
          totalNominal: number;
          isCurrentUser: boolean;
        }
      >();
      uploadPreviewInvoices.forEach(inv => {
        const res = resolveSalesInfo(inv);
        const key = res.userId || res.userFullName;
        const isCurrent = doesInvoiceBelongToUser(inv, currentUser, salesMappings, allUsers);
        const existing = grouped.get(key);
        if (existing) {
          existing.invoiceCount += 1;
          existing.lineCount += inv.lineItems?.length || 0;
          existing.totalNominal += Number(inv.nominalTagihan) || 0;
          existing.masterNames.add(res.masterSalesName);
          if (isCurrent) existing.isCurrentUser = true;
        } else {
          grouped.set(key, {
            key,
            userFullName: res.userFullName,
            masterNames: new Set([res.masterSalesName]),
            invoiceCount: 1,
            lineCount: inv.lineItems?.length || 0,
            totalNominal: Number(inv.nominalTagihan) || 0,
            isCurrentUser: isCurrent
          });
        }
      });
      return Array.from(grouped.values()).sort((a, b) => a.userFullName.localeCompare(b.userFullName));
    })();

    return (
      <div className="space-y-5 w-full max-w-full">
        {toastMessage && (
          <div className="fixed bottom-5 right-5 z-50 bg-emerald-600 text-white px-4 py-2.5 rounded-xl shadow-xl text-xs font-bold flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{toastMessage}</span>
          </div>
        )}

        <input
          ref={excelInputRef}
          type="file"
          accept=".xlsx,.xls,.csv"
          onChange={handleExcelFileSelected}
          className="hidden"
        />

        {/* Top Bar Halaman Upload Excel */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="w-11 h-11 rounded-2xl bg-blue-600 text-white flex items-center justify-center shrink-0">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-lg sm:text-xl font-extrabold text-slate-900 dark:text-white tracking-tight">
                Halaman Upload Excel — Validasi Faktur &amp; Rincian Barang
              </h1>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Unggah satu file Excel gabungan dari seluruh Sales (Sales A, B, C, dst) — sistem otomatis memisahkan tampilan faktur sesuai akun masing-masing Sales saat login.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setViewMode('table')}
            className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-extrabold flex items-center gap-2 transition cursor-pointer self-start sm:self-auto"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Kembali ke Tabel Validasi Faktur</span>
          </button>
        </div>

        {/* Informasi Data & Kolom Apa Saja yang Bisa Terbaca dari File Excel */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-2xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
            <div>
              <h2 className="text-sm font-extrabold text-slate-900 dark:text-white">
                Struktur Kolom &amp; Data yang Dapat Terbaca Otomatis dari File Excel
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Sistem membaca urutan 10 kolom standar faktur di bawah ini dan otomatis mendistribusikan faktur per Akun Sales
              </p>
            </div>
            {onNavigateTab && (
              <button
                type="button"
                onClick={() => onNavigateTab('marketing_sales_mapping')}
                className="px-3 py-1.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 text-xs font-bold flex items-center gap-1.5 cursor-pointer self-start sm:self-auto"
              >
                <Link2 className="w-3.5 h-3.5" />
                <span>Kelola Mapping Nama Sales</span>
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            {READABLE_EXCEL_COLUMNS.map(col => (
              <div
                key={col.no}
                className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200/80 dark:border-slate-800 flex flex-col justify-between gap-1.5"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-extrabold text-blue-700 dark:text-blue-300">
                    {col.name}
                  </span>
                  <span className="text-[10px] font-mono font-bold text-slate-400">
                    Kolom {col.no}
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                  {col.desc}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Zona Pilih Tanggal Kirim & Pilih File Excel */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-2xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-extrabold text-slate-900 dark:text-white">
                Pilih Tanggal Kirim &amp; File Excel (.xlsx / .xls / .csv)
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Data faktur dari berbagai Sales dapat diunggah sekaligus dalam satu file Excel; baris tanpa nominal otomatis dilewati
              </p>
            </div>
            <ModernCalendarPopover
              value={uploadTargetDate}
              onChange={iso => setUploadTargetDate(iso || tomorrowIso)}
              labelPrefix="Tanggal Kirim Faktur:"
              allowEmpty={false}
            />
          </div>

          <div
            onClick={() => excelInputRef.current?.click()}
            className="border-2 border-dashed border-blue-300 dark:border-blue-800 hover:border-blue-500 bg-blue-50/30 dark:bg-blue-950/20 rounded-2xl p-8 text-center transition cursor-pointer space-y-2"
          >
            <div className="w-12 h-12 rounded-2xl bg-blue-600/10 text-blue-600 dark:text-blue-400 flex items-center justify-center mx-auto">
              <Upload className="w-6 h-6" />
            </div>
            <div className="text-sm font-extrabold text-slate-900 dark:text-white">
              {uploadFileName ? `File Terpilih: ${uploadFileName}` : 'Klik untuk Memilih File Excel Validasi Faktur'}
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Mendukung format .xlsx, .xls, dan .csv sesuai 10 kolom di atas
            </p>
          </div>

          {uploadPreviewInvoices.length > 0 && (
            <div className="space-y-4 pt-2">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/60">
                <div className="space-y-0.5">
                  <div className="text-xs font-extrabold text-emerald-900 dark:text-emerald-200">
                    Hasil Pembacaan File Excel Siap Disimpan ke Database ({previewPerSales.length} Akun Sales)
                  </div>
                  <div className="text-[11px] text-emerald-700 dark:text-emerald-300 font-medium">
                    Terbaca <strong>{uploadPreviewInvoices.length} Faktur</strong> ({totalPreviewLines} Baris Barang) dengan Total Nilai{' '}
                    <strong className="font-mono">Rp {formatRupiahNumber(totalPreviewNominal)}</strong>
                    {uploadSkippedEmptyRows > 0 && (
                      <span> &middot; {uploadSkippedEmptyRows} baris nominal kosong dilewati otomatis</span>
                    )}
                  </div>
                  {isPersonalSalesMode && (
                    <div className="text-[11px] text-blue-700 dark:text-blue-300 font-semibold pt-0.5">
                      Saat Anda klik Simpan, seluruh faktur tersimpan ke database dan akun <strong>{currentUser.fullName}</strong> hanya menampilkan faktur milik Anda sendiri.
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  onClick={handleConfirmSaveUploadedExcel}
                  className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-extrabold flex items-center gap-2 shadow-sm cursor-pointer shrink-0"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Simpan ke Database ({uploadPreviewInvoices.length} Faktur)</span>
                </button>
              </div>

              {/* Distribusi Per Akun Sales dari Excel Campuran */}
              {previewPerSales.length > 0 && (
                <div className="space-y-2">
                  <div className="text-[11px] font-extrabold uppercase tracking-wider text-slate-600 dark:text-slate-300">
                    Distribusi Otomatis Per Akun Sales ({previewPerSales.length} Akun Terdeteksi)
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
                    {previewPerSales.map(group => (
                      <div
                        key={group.key}
                        className={`p-3 rounded-xl border ${
                          group.isCurrentUser
                            ? 'bg-blue-50/70 dark:bg-blue-950/30 border-blue-300 dark:border-blue-800'
                            : 'bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-extrabold text-slate-900 dark:text-white truncate">
                            {group.userFullName}
                          </span>
                          <span className="px-2 py-0.5 rounded-lg bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300 text-[10px] font-extrabold font-mono shrink-0">
                            {group.invoiceCount} Faktur
                          </span>
                        </div>
                        <div className="text-[10px] text-slate-500 dark:text-slate-400 truncate mt-1">
                          Master: {Array.from(group.masterNames).join(' / ')}
                        </div>
                        <div className="text-[11px] font-mono font-bold text-slate-800 dark:text-slate-200 mt-1">
                          Rp {formatRupiahNumber(group.totalNominal)}{' '}
                          <span className="font-normal text-slate-400">&middot; {group.lineCount} item</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden max-h-80 overflow-y-auto">
                <table className="w-full text-xs text-left border-collapse">
                  <thead className="bg-slate-100 dark:bg-slate-800 text-[10px] font-extrabold uppercase text-slate-600 dark:text-slate-300 sticky top-0">
                    <tr className="h-9">
                      <th className="px-3">Nama Sales (Master &amp; Akun)</th>
                      <th className="px-3">Nama Pelanggan</th>
                      <th className="px-3">No Faktur</th>
                      <th className="px-3 text-center">Jumlah Item</th>
                      <th className="px-3 text-right">Total Nilai Faktur</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                    {uploadPreviewInvoices.map(inv => {
                      const res = resolveSalesInfo(inv);
                      return (
                        <tr key={inv.id} className="h-10 hover:bg-slate-50 dark:hover:bg-slate-800/40">
                          <td className="px-3 font-bold text-slate-900 dark:text-white">
                            {res.masterSalesName}{' '}
                            <span className="text-[10px] font-normal text-slate-500">
                              ({res.userFullName} &bull; {res.userPhone})
                            </span>
                          </td>
                          <td className="px-3 font-bold text-slate-800 dark:text-slate-200">{inv.customerName}</td>
                          <td className="px-3 font-mono font-bold text-blue-600 dark:text-blue-400">{inv.noInvoice}</td>
                          <td className="px-3 text-center font-mono font-bold">{inv.lineItems?.length || 1} Item</td>
                          <td className="px-3 text-right font-mono font-extrabold text-slate-900 dark:text-white">
                            Rp {formatRupiahNumber(inv.nominalTagihan)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ==========================================================================
  // RENDER UTAMA: TABEL VALIDASI FAKTUR & RINCIAN BARANG PENGIRIMAN
  // ==========================================================================
  return (
    <div className="space-y-4 w-full max-w-full">
      {toastMessage && (
        <div className="fixed bottom-5 right-5 z-50 bg-emerald-600 text-white px-4 py-2.5 rounded-xl shadow-xl text-xs font-bold flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Top Header & KPI Strip (Tanpa tombol Mapping Nama Sales & tanpa Sinkron Form Kirim / SO) */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 sm:p-5 shadow-2xs">
        <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0">
              <ClipboardCheck className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-lg sm:text-xl font-extrabold text-slate-900 dark:text-white tracking-tight">
                  Validasi Faktur &amp; Rincian Barang Pengiriman
                </h1>
                {isSyncingMysql && (
                  <span className="text-[11px] font-semibold text-blue-600 dark:text-blue-400">
                    &middot; Menyimpan ke database...
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {isPersonalSalesMode
                  ? `Menampilkan khusus faktur milik akun ${currentUser.fullName} (Master: ${currentUserMasterLabel}) yang tersinkronisasi dari file Excel pengiriman.`
                  : 'Rekapitulasi validasi faktur penjualan per Akun Sales — upload Excel gabungan otomatis terfilter sesuai masing-masing akun saat Sales login.'}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setViewMode('upload_excel')}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700 text-xs font-bold transition cursor-pointer whitespace-nowrap"
            >
              <Upload className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
              <span>Upload Excel</span>
            </button>

            <button
              type="button"
              onClick={() => openBatchWaModalForSales(selectedSalesUserFilter)}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition cursor-pointer whitespace-nowrap"
            >
              <MessageSquare className="w-3.5 h-3.5" />
              <span>Rekap WA Sales</span>
            </button>

            <button
              type="button"
              onClick={openAddModal}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition cursor-pointer whitespace-nowrap"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Tambah Faktur</span>
            </button>
          </div>
        </div>

        {/* 4 Summary Metrics */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-4 pt-4 border-t border-slate-100 dark:border-slate-800">
          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200/80 dark:border-slate-800">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
              Total Faktur &amp; Baris Barang
            </span>
            <div className="text-lg font-extrabold text-slate-900 dark:text-white mt-0.5 font-mono tabular-nums">
              {stats.totalInvoices} Faktur <span className="text-xs font-normal text-slate-500">&middot; {stats.totalItems} Item</span>
            </div>
          </div>

          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200/80 dark:border-slate-800">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
              Total Nilai Faktur
            </span>
            <div className="text-lg font-extrabold text-blue-600 dark:text-blue-400 mt-0.5 font-mono tabular-nums">
              {stats.totalNominal > 0 ? `Rp ${formatRupiahNumber(stats.totalNominal)}` : 'Rp 0'}
            </div>
          </div>

          <div className="p-3 rounded-xl bg-emerald-50/60 dark:bg-emerald-950/30 border border-emerald-200/70 dark:border-emerald-800/50">
            <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-800 dark:text-emerald-300 block">
              Tervalidasi Siap Kirim
            </span>
            <div className="text-lg font-extrabold text-emerald-700 dark:text-emerald-300 mt-0.5 font-mono tabular-nums">
              {stats.validated} Faktur
            </div>
          </div>

          <div className="p-3 rounded-xl bg-amber-50/60 dark:bg-amber-950/30 border border-amber-200/70 dark:border-amber-800/50">
            <span className="text-[10px] font-bold uppercase tracking-wider text-amber-800 dark:text-amber-300 block">
              Menunggu Validasi &amp; Revisi
            </span>
            <div className="text-lg font-extrabold text-amber-700 dark:text-amber-300 mt-0.5 font-mono tabular-nums">
              {stats.pending} Menunggu <span className="text-xs font-normal text-rose-600 dark:text-rose-400">&middot; {stats.revision} Revisi</span>
            </div>
          </div>
        </div>
      </div>

      {/* Filter Bar dengan Custom Kalender & Custom Dropdown UI/UX + Akun Sales Scoping */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-3.5 shadow-2xs space-y-3">
        <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-3">
          <div className="relative flex-1 min-w-0">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Cari Nama Sales, Nama Pelanggan, No Faktur, atau Keterangan Barang..."
              className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs font-medium text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-blue-500"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {/* Custom Kalender Kirim Popover */}
            <ModernCalendarPopover
              value={selectedDeliveryDate}
              onChange={iso => setSelectedDeliveryDate(iso)}
              labelPrefix="Kalender Kirim:"
              allowEmpty
              emptyLabel="Semua Tanggal"
            />

            {isPersonalSalesMode ? (
              <div
                className="flex items-center gap-2 px-3 py-2 rounded-xl bg-blue-50 dark:bg-blue-950/50 border border-blue-200 dark:border-blue-800/80 text-xs"
                title={`Akun aktif terfilter otomatis ke faktur milik ${currentUser.fullName} (Master: ${currentUserMasterLabel})`}
              >
                <Users className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 shrink-0" />
                <span className="font-bold text-slate-600 dark:text-slate-300">Akun Aktif:</span>
                <span className="font-extrabold text-blue-700 dark:text-blue-300">
                  {currentUser.fullName}
                </span>
                <span className="px-1.5 py-0.5 rounded-md bg-blue-100 dark:bg-blue-900/70 text-[10px] font-bold text-blue-800 dark:text-blue-200">
                  Faktur Pribadi
                </span>
              </div>
            ) : (
              /* Custom Dropdown Sales (Terintegrasi User Management & Mapping Nama Sales) */
              <ModernValidationDropdown
                value={selectedSalesUserFilter}
                onChange={val => setSelectedSalesUserFilter(val)}
                icon={<Users className="w-3.5 h-3.5" />}
                searchable
                searchPlaceholder="Cari nama sales atau master sales..."
                minWidthClass="min-w-[240px]"
                options={[
                  {
                    value: 'ALL',
                    label: 'Semua Sales (User Akses Validasi)',
                    subLabel: `Tampilkan faktur sales marketing cabang ${activeBranchName}`,
                    badge: `${validationUsers.length} User`,
                    badgeTone: 'indigo'
                  },
                  ...validationUsers.map(u => {
                    const mapInfo = salesMappings.find(m => m.userId === u.id);
                    const pairedMasters = mapInfo
                      ? [mapInfo.masterSalesName1, mapInfo.masterSalesName2].filter(Boolean).join(' & ')
                      : u.fullName.toUpperCase();
                    const summary = salesAccountSummary.get(u.id) || salesAccountSummary.get(u.fullName);
                    return {
                      value: u.id,
                      label: u.fullName,
                      subLabel: `Master: ${pairedMasters} • WA: ${u.phone || '-'}`,
                      badge: summary ? `${summary.count} Faktur` : u.phone || '0 Faktur',
                      badgeTone: summary ? ('blue' as const) : ('slate' as const)
                    };
                  })
                ]}
              />
            )}

            {/* Custom Dropdown Status Validasi */}
            <ModernValidationDropdown
              value={selectedStatusFilter}
              onChange={val => setSelectedStatusFilter(val)}
              align="right"
              minWidthClass="min-w-[195px]"
              options={[
                {
                  value: 'ALL',
                  label: 'Semua Status Validasi',
                  subLabel: 'Seluruh status faktur pengiriman',
                  badge: 'SEMUA',
                  badgeTone: 'slate'
                },
                {
                  value: 'Menunggu Validasi',
                  label: 'Menunggu Validasi',
                  subLabel: 'Faktur belum divalidasi marketing',
                  badge: `${stats.pending}`,
                  badgeTone: 'amber'
                },
                {
                  value: 'Tervalidasi Siap Kirim',
                  label: 'Tervalidasi Siap Kirim',
                  subLabel: 'Faktur siap dimuat & dikirim',
                  badge: `${stats.validated}`,
                  badgeTone: 'emerald'
                },
                {
                  value: 'Revisi',
                  label: 'Revisi',
                  subLabel: 'Faktur memerlukan revisi sales',
                  badge: `${stats.revision}`,
                  badgeTone: 'rose'
                }
              ]}
            />
          </div>
        </div>

        {/* Quick Switcher Per Akun Sales untuk Admin/SPV ketika tersedia data beberapa Sales */}
        {!isPersonalSalesMode && salesAccountSummary.size > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 pt-2.5 border-t border-slate-100 dark:border-slate-800">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 mr-1">
              Tampilan Per Akun:
            </span>
            <button
              type="button"
              onClick={() => setSelectedSalesUserFilter('ALL')}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition cursor-pointer ${
                selectedSalesUserFilter === 'ALL'
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
              }`}
            >
              Semua Akun ({accountScopedRecords.filter(r => !selectedDeliveryDate || r.deliveryTomorrowDate === selectedDeliveryDate).length})
            </button>
            {Array.from(salesAccountSummary.entries()).map(([key, info]) => {
              const matchedUser = validationUsers.find(
                u => u.id === key || u.fullName.toLowerCase() === info.label.toLowerCase()
              );
              const filterVal = matchedUser?.id || key;
              const isSelected = selectedSalesUserFilter === filterVal;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setSelectedSalesUserFilter(filterVal)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition cursor-pointer flex items-center gap-1.5 ${
                    isSelected
                      ? 'bg-blue-600 text-white'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700'
                  }`}
                >
                  <span>{info.label}</span>
                  <span
                    className={`px-1.5 py-0.2 rounded text-[10px] font-mono font-extrabold ${
                      isSelected
                        ? 'bg-blue-500 text-white'
                        : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300'
                    }`}
                  >
                    {info.count}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Tabel Spreadsheet Validasi Faktur dengan Ukuran Baris Seragam (h-10) & Tanpa Ikon Pensil/Sampah */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-2xs w-full">
        <table className="w-full table-fixed border-collapse text-[11px]">
          <thead>
            <tr className="h-10 bg-slate-100/90 dark:bg-slate-800/90 border-b border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 font-extrabold uppercase tracking-wider text-[10px]">
              <th className="w-[14%] px-2.5 text-left border-r border-slate-200 dark:border-slate-700">
                Nama Sales
              </th>
              <th className="w-[13%] px-2.5 text-left border-r border-slate-200 dark:border-slate-700">
                Nama Pelanggan
              </th>
              <th className="w-[10%] px-2.5 text-left border-r border-slate-200 dark:border-slate-700">
                No Faktur
              </th>
              <th className="w-[21%] px-2.5 text-left border-r border-slate-200 dark:border-slate-700">
                Keterangan Barang
              </th>
              <th className="w-[5%] px-1.5 text-center border-r border-slate-200 dark:border-slate-700">
                Kts. Faktur
              </th>
              <th className="w-[4%] px-1.5 text-center border-r border-slate-200 dark:border-slate-700">
                sat
              </th>
              <th className="w-[8%] px-2 text-right border-r border-slate-200 dark:border-slate-700">
                Harga satuan
              </th>
              <th className="w-[3%] px-1 text-center border-r border-slate-200 dark:border-slate-700">
                %
              </th>
              <th className="w-[6%] px-2 text-right border-r border-slate-200 dark:border-slate-700">
                Diskon
              </th>
              <th className="w-[8%] px-2 text-right border-r border-slate-200 dark:border-slate-700">
                Total Harga
              </th>
              <th className="w-[8%] px-2 text-center">
                Validasi &amp; WA
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200/80 dark:divide-slate-800">
            {isLoadingMysql ? (
              <tr className="h-24">
                <td colSpan={11} className="px-4 text-center text-slate-400 text-xs">
                  Memuat data Validasi Faktur dari Server Database...
                </td>
              </tr>
            ) : flattenedExcelRows.length === 0 ? (
              <tr className="h-32">
                <td colSpan={11} className="px-4 text-center">
                  <div className="max-w-md mx-auto space-y-2 py-4">
                    <div className="text-xs font-extrabold text-slate-700 dark:text-slate-200">
                      {isPersonalSalesMode && records.length > 0 && accountScopedRecords.length === 0
                        ? `Belum Ada Faktur untuk Akun ${currentUser.fullName}`
                        : 'Belum Ada Data Validasi Faktur di Database'}
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      {isPersonalSalesMode && records.length > 0 && accountScopedRecords.length === 0
                        ? `Saat ini tersedia ${records.length} faktur milik akun Sales lain. Akun Anda (${currentUser.fullName}) hanya menampilkan faktur yang terdaftar atas nama Sales Anda.`
                        : 'Silakan unggah file Excel melalui tombol Upload Excel atau klik Tambah Faktur untuk menambahkan data ke database.'}
                    </p>
                    <div className="flex items-center justify-center gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => setViewMode('upload_excel')}
                        className="px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold cursor-pointer"
                      >
                        Buka Halaman Upload Excel
                      </button>
                      <button
                        type="button"
                        onClick={openAddModal}
                        className="px-3.5 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-bold cursor-pointer"
                      >
                        + Tambah Faktur Manual
                      </button>
                    </div>
                  </div>
                </td>
              </tr>
            ) : (
              flattenedExcelRows.map(row => {
                const {
                  rowKey,
                  invoice,
                  resolvedSales,
                  lineItem,
                  isFirstOfSales,
                  isFirstOfCustomer,
                  isFirstOfInvoice
                } = row;

                const hargaFormatted = formatRupiahNumber(lineItem.hargaSatuan);
                const diskonFormatted = formatRupiahNumber(lineItem.nominalDiskon);
                const totalFormatted = formatRupiahNumber(lineItem.totalHarga);

                return (
                  <tr
                    key={rowKey}
                    className={`h-10 hover:bg-blue-50/40 dark:hover:bg-slate-800/50 transition-colors ${
                      isFirstOfSales ? 'border-t border-slate-300 dark:border-slate-700' : ''
                    }`}
                  >
                    {/* 1. Nama Sales — Baris seragam 1 baris (h-10) */}
                    <td
                      className="h-10 px-2.5 align-middle border-r border-slate-200/80 dark:border-slate-800 overflow-hidden"
                      title={
                        isFirstOfSales
                          ? `${resolvedSales.masterSalesName} • ${resolvedSales.userFullName} (${resolvedSales.userPhone})`
                          : undefined
                      }
                    >
                      {isFirstOfSales ? (
                        <div className="flex items-center justify-between gap-1.5 truncate">
                          <span className="font-extrabold text-slate-900 dark:text-white uppercase truncate">
                            {resolvedSales.masterSalesName}
                          </span>
                          <span className="text-[10px] font-mono font-semibold text-emerald-600 dark:text-emerald-400 shrink-0">
                            {resolvedSales.userPhone}
                          </span>
                        </div>
                      ) : null}
                    </td>

                    {/* 2. Nama Pelanggan — Baris seragam 1 baris (h-10) */}
                    <td
                      className="h-10 px-2.5 align-middle border-r border-slate-200/80 dark:border-slate-800 overflow-hidden"
                      title={isFirstOfCustomer ? invoice.customerName : undefined}
                    >
                      {isFirstOfCustomer ? (
                        <div className="font-extrabold text-slate-900 dark:text-white uppercase truncate">
                          {invoice.customerName}
                        </div>
                      ) : null}
                    </td>

                    {/* 3. No Faktur — Baris seragam 1 baris (h-10) */}
                    <td
                      className="h-10 px-2.5 align-middle border-r border-slate-200/80 dark:border-slate-800 overflow-hidden"
                      title={
                        isFirstOfInvoice
                          ? `${invoice.noInvoice} • Kirim: ${invoice.deliveryTomorrowDate}`
                          : undefined
                      }
                    >
                      {isFirstOfInvoice ? (
                        <div className="font-mono font-extrabold text-blue-700 dark:text-blue-300 truncate">
                          {invoice.noInvoice}
                        </div>
                      ) : null}
                    </td>

                    {/* 4. Keterangan Barang — Baris seragam 1 baris (h-10) */}
                    <td
                      className="h-10 px-2.5 align-middle border-r border-slate-200/80 dark:border-slate-800 text-slate-800 dark:text-slate-200 font-medium overflow-hidden"
                      title={lineItem.keteranganBarang}
                    >
                      <div className="truncate">{lineItem.keteranganBarang}</div>
                    </td>

                    {/* 5. Kts. Faktur */}
                    <td className="h-10 px-1.5 align-middle text-center border-r border-slate-200/80 dark:border-slate-800 font-mono tabular-nums font-bold text-slate-900 dark:text-white whitespace-nowrap">
                      {lineItem.ktsFaktur}
                    </td>

                    {/* 6. sat */}
                    <td className="h-10 px-1.5 align-middle text-center border-r border-slate-200/80 dark:border-slate-800 font-semibold text-slate-600 dark:text-slate-300 uppercase whitespace-nowrap">
                      {lineItem.satuan}
                    </td>

                    {/* 7. Harga satuan (Tanpa Rp - jika kosong) */}
                    <td className="h-10 px-2 align-middle text-right border-r border-slate-200/80 dark:border-slate-800 font-mono tabular-nums text-slate-800 dark:text-slate-200 whitespace-nowrap">
                      {hargaFormatted ? (
                        <>
                          <span className="text-slate-400 mr-0.5">Rp</span>
                          {hargaFormatted}
                        </>
                      ) : null}
                    </td>

                    {/* 8. % */}
                    <td className="h-10 px-1 align-middle text-center border-r border-slate-200/80 dark:border-slate-800 font-mono tabular-nums text-slate-700 dark:text-slate-300 whitespace-nowrap">
                      {lineItem.persenDiskon !== '' && Number(lineItem.persenDiskon) > 0
                        ? lineItem.persenDiskon
                        : ''}
                    </td>

                    {/* 9. Diskon (Request 4: Kosongkan jika 0, tidak menampilkan Rp -) */}
                    <td className="h-10 px-2 align-middle text-right border-r border-slate-200/80 dark:border-slate-800 font-mono tabular-nums text-slate-700 dark:text-slate-300 whitespace-nowrap">
                      {diskonFormatted ? (
                        <>
                          <span className="text-slate-400 mr-0.5">Rp</span>
                          {diskonFormatted}
                        </>
                      ) : null}
                    </td>

                    {/* 10. Total Harga */}
                    <td className="h-10 px-2 align-middle text-right border-r border-slate-200/80 dark:border-slate-800 font-mono tabular-nums font-extrabold text-slate-900 dark:text-white whitespace-nowrap">
                      {totalFormatted ? (
                        <>
                          <span className="text-slate-400 font-normal mr-0.5">Rp</span>
                          {totalFormatted}
                        </>
                      ) : null}
                    </td>

                    {/* 11. Validasi & WA (Request 3, 5, 6: Satu baris sejajar tanpa ikon pensil & sampah) */}
                    <td className="h-10 px-2 align-middle">
                      {isFirstOfInvoice ? (
                        <div className="flex items-center gap-1 h-7">
                          <RowStatusDropdown
                            value={invoice.validationStatus}
                            onChange={nextSt => handleQuickStatusUpdate(invoice.id, nextSt)}
                          />
                          <button
                            type="button"
                            onClick={() => openWaModalForInvoice(invoice)}
                            className="h-7 px-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] font-extrabold flex items-center justify-center gap-1 transition cursor-pointer shrink-0"
                            title={`Kirim WA ke ${resolvedSales.userFullName} (${resolvedSales.userPhone})`}
                          >
                            <Send className="w-2.5 h-2.5 shrink-0" />
                            <span>WA</span>
                          </button>
                        </div>
                      ) : null}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Modal Tambah Faktur & Rincian Barang */}
      {isFormModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-3xl w-full p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div>
                <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
                  Tambah Faktur &amp; Rincian Barang
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Tersimpan langsung ke Server Database serta terintegrasi dengan Mapping Nama Sales
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsFormModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-white rounded-lg cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveForm} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Akun Sales (User Management) *
                  </label>
                  {isPersonalSalesMode ? (
                    <div className="w-full px-3 py-2 rounded-xl bg-blue-50 dark:bg-blue-950/50 border border-blue-200 dark:border-blue-800 font-bold text-blue-800 dark:text-blue-200 flex items-center justify-between gap-2">
                      <span className="truncate">{currentUser.fullName}</span>
                      <span className="text-[10px] font-mono text-blue-600 dark:text-blue-300 shrink-0">
                        {currentUser.phone || 'Akun Pribadi'}
                      </span>
                    </div>
                  ) : (
                    <ModernValidationDropdown
                      value={formSalesUserId}
                      onChange={uid => {
                        setFormSalesUserId(uid);
                        const foundMap = salesMappings.find(m => m.userId === uid);
                        if (foundMap?.masterSalesName1) {
                          setFormMasterSalesName(foundMap.masterSalesName1);
                        } else {
                          const u = allUsers.find(x => x.id === uid);
                          if (u) setFormMasterSalesName(u.fullName.toUpperCase());
                        }
                      }}
                      searchable
                      searchPlaceholder="Cari akun sales..."
                      minWidthClass="w-full"
                      options={validationUsers.map(u => ({
                        value: u.id,
                        label: u.fullName,
                        subLabel: `WA: ${u.phone || '-'}`,
                        badge: u.phone || 'No WA',
                        badgeTone: 'emerald'
                      }))}
                    />
                  )}
                </div>

                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Nama Sales pada Faktur (Master) *
                  </label>
                  <input
                    type="text"
                    required
                    list="master-sales-list"
                    value={formMasterSalesName}
                    onChange={e => setFormMasterSalesName(e.target.value)}
                    placeholder="Contoh: 17. ZAINAL LKT BALI"
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 font-bold text-slate-900 dark:text-white uppercase"
                  />
                  <datalist id="master-sales-list">
                    {masterSalesOptionsForSelectedUser.map(opt => (
                      <option key={opt} value={opt} />
                    ))}
                  </datalist>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Kalender Tanggal Kirim *
                  </label>
                  <ModernCalendarPopover
                    value={formDeliveryDate}
                    onChange={iso => setFormDeliveryDate(iso || tomorrowIso)}
                    labelPrefix=""
                    allowEmpty={false}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Nama Pelanggan *
                  </label>
                  <input
                    type="text"
                    required
                    value={formCustomerName}
                    onChange={e => setFormCustomerName(e.target.value)}
                    placeholder="Contoh: BP UCE BADDRUDIN"
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 font-bold text-slate-900 dark:text-white uppercase"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    No. Faktur *
                  </label>
                  <input
                    type="text"
                    required
                    value={formNoInvoice}
                    onChange={e => setFormNoInvoice(e.target.value)}
                    placeholder="FJ02-1126-1384"
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 font-mono font-bold text-slate-900 dark:text-white uppercase"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Status Validasi Marketing
                  </label>
                  <ModernValidationDropdown
                    value={formStatus}
                    onChange={val => setFormStatus(val as MarketingValidationStatus)}
                    minWidthClass="w-full"
                    options={[
                      {
                        value: 'Menunggu Validasi',
                        label: 'Menunggu Validasi',
                        badge: 'PENDING',
                        badgeTone: 'amber'
                      },
                      {
                        value: 'Tervalidasi Siap Kirim',
                        label: 'Tervalidasi Siap Kirim',
                        badge: 'SIAP KIRIM',
                        badgeTone: 'emerald'
                      },
                      {
                        value: 'Revisi',
                        label: 'Revisi',
                        badge: 'REVISI',
                        badgeTone: 'rose'
                      }
                    ]}
                  />
                </div>
              </div>

              {/* Rincian Baris Barang */}
              <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <div className="flex items-center justify-between">
                  <label className="font-extrabold text-slate-800 dark:text-slate-200">
                    Rincian Barang (Keterangan Barang, Kts. Faktur, sat, Harga satuan, %, Diskon, Total Harga)
                  </label>
                  <button
                    type="button"
                    onClick={handleAddLineItemRow}
                    className="px-2.5 py-1 rounded-lg bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 font-bold text-[11px] cursor-pointer"
                  >
                    + Tambah Baris Barang
                  </button>
                </div>

                <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                  {formLineItems.map((li, idx) => (
                    <div
                      key={li.id}
                      className="grid grid-cols-12 gap-2 items-center bg-slate-50 dark:bg-slate-950 p-2 rounded-xl border border-slate-200 dark:border-slate-800"
                    >
                      <div className="col-span-4">
                        <input
                          type="text"
                          required
                          value={li.keteranganBarang}
                          onChange={e => handleUpdateLineItemRow(idx, 'keteranganBarang', e.target.value)}
                          placeholder="Keterangan Barang"
                          className="w-full px-2 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-[11px] font-semibold uppercase"
                        />
                      </div>
                      <div className="col-span-1">
                        <input
                          type="number"
                          min={1}
                          value={li.ktsFaktur}
                          onChange={e => handleUpdateLineItemRow(idx, 'ktsFaktur', Number(e.target.value))}
                          placeholder="Kts"
                          className="w-full px-1.5 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-[11px] text-center font-mono"
                        />
                      </div>
                      <div className="col-span-1">
                        <input
                          type="text"
                          value={li.satuan}
                          onChange={e => handleUpdateLineItemRow(idx, 'satuan', e.target.value)}
                          placeholder="SAT"
                          className="w-full px-1.5 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-[11px] text-center uppercase font-bold"
                        />
                      </div>
                      <div className="col-span-2">
                        <input
                          type="number"
                          min={0}
                          value={li.hargaSatuan || ''}
                          onChange={e => handleUpdateLineItemRow(idx, 'hargaSatuan', Number(e.target.value))}
                          placeholder="Harga Satuan"
                          className="w-full px-2 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-[11px] text-right font-mono"
                        />
                      </div>
                      <div className="col-span-1">
                        <input
                          type="number"
                          min={0}
                          step="0.01"
                          value={li.persenDiskon}
                          onChange={e => handleUpdateLineItemRow(idx, 'persenDiskon', e.target.value)}
                          placeholder="%"
                          className="w-full px-1.5 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-[11px] text-center font-mono"
                        />
                      </div>
                      <div className="col-span-2">
                        <div className="px-2 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-[11px] text-right font-mono font-bold">
                          {li.totalHarga > 0 ? `Rp ${formatRupiahNumber(li.totalHarga)}` : 'Rp 0'}
                        </div>
                      </div>
                      <div className="col-span-1 text-center">
                        <button
                          type="button"
                          onClick={() => handleRemoveLineItemRow(idx)}
                          className="p-1 text-slate-400 hover:text-rose-600 cursor-pointer"
                          title="Hapus baris"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsFormModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-bold cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold cursor-pointer"
                >
                  Simpan Faktur
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Integrasi WhatsApp Sales */}
      {waModalData && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center">
                  <MessageSquare className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-extrabold text-slate-900 dark:text-white">
                    {waModalData.title}
                  </h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Akun User Mgmt: <strong className="text-slate-700 dark:text-slate-200">{waModalData.salesName}</strong> ({waModalData.masterSalesNames})
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setWaModalData(null)}
                className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-white rounded-lg cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              {!isPersonalSalesMode && validationUsers.length > 0 && waModalData.salesUserId !== undefined && (
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Pilih Penerima Sales Marketing (Cabang {activeBranchName})
                  </label>
                  <select
                    value={waModalData.salesUserId}
                    onChange={e => openBatchWaModalForSales(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 font-bold text-slate-900 dark:text-white cursor-pointer"
                  >
                    {validationUsers.map(u => (
                      <option key={u.id} value={u.id}>
                        {u.fullName} ({getUserRoleDisplayTitle(u.role)})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Nomor WhatsApp Sales (Otomatis dari User Management)
                </label>
                <input
                  type="text"
                  value={waModalData.salesWhatsapp}
                  onChange={e =>
                    setWaModalData(prev => (prev ? { ...prev, salesWhatsapp: e.target.value } : null))
                  }
                  placeholder="Contoh: 0812-3456-7890"
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 font-mono font-bold text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Isi Pesan Validasi Faktur
                </label>
                <textarea
                  rows={8}
                  value={waModalData.messageText}
                  onChange={e =>
                    setWaModalData(prev => (prev ? { ...prev, messageText: e.target.value } : null))
                  }
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 font-mono text-[11px] text-slate-800 dark:text-slate-200"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setWaModalData(null)}
                className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-600 dark:text-slate-300 cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleConfirmSendWa}
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Kirim ke WhatsApp Sales</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
