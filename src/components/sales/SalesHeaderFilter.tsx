import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  User,
  ChevronDown,
  Calendar,
  CheckCircle2,
  ClipboardList,
  FileSpreadsheet,
  Building2,
  Lock
} from 'lucide-react';
import { logisticsStore } from '../../services/store';
import { branchStore } from '../../services/branchStore';
import { UserProfile } from '../../types';
import { canAccess } from '../../utils/rbac';

export type SalesTopTab = 'checklist' | 'durasi_muat' | 'jadwal_admin' | 'aktivitas_view';

export interface SalesHeaderFilterProps {
  title: string;
  subtitle: string;
  activeTab?: SalesTopTab;
  onTabChange?: (tab: SalesTopTab) => void;
  selectedAdmin: string;
  onAdminChange: (admin: string) => void;
  selectedMonth: string;
  onMonthChange: (month: string) => void;
  selectedYear: string;
  onYearChange: (year: string) => void;
  jadwalInputCount?: number;
  pencapaianPercent?: number;
  periodeLabel?: string;
  adminOptions?: string[];
  hideAdminFilter?: boolean;
  hideStatsCards?: boolean;
  selectedBranchId?: string;
  onBranchChange?: (branchId: string) => void;
  showBranchFilter?: boolean;
  onExportExcel?: () => void;
}

const NON_SALES_ADMIN_ROLES = new Set([
  'driver',
  'crew_helper',
  'security',
  'driver_coordinator',
  'warehouse_coordinator',
  'hr_admin',
  'finance_tax',
  'spv_purchase_admin',
  'spv_marketing_offline'
]);

export function getSalesAdminAssignedBranchId(u: UserProfile): string {
  if (!u || u.status !== 'approved') return 'NONE';

  // Never include field crew, security, or unrelated operational roles in Admin Penjualan mapping
  if (NON_SALES_ADMIN_ROLES.has(u.role)) {
    return 'NONE';
  }

  const deptClean = (u.department || '').trim().toLowerCase();
  const isSalesRole = u.role === 'sales_admin' || u.role === 'spv_sales_admin';
  const deptMatch =
    deptClean.includes('adm. penjualan') ||
    deptClean.includes('admin penjualan') ||
    deptClean.includes('sales admin') ||
    deptClean.includes('penjualan');

  if (u.role === 'super_admin' && !deptMatch) {
    return 'NONE';
  }

  if (!isSalesRole && u.role !== 'super_admin') {
    const hasExplicitSalesModule = Boolean(u.permissions?.modules?.sales_admin?.enabled);
    const hasSalesAccess = canAccess(u, 'sales_admin');
    if (!hasExplicitSalesModule || !hasSalesAccess || !deptMatch) {
      return 'NONE';
    }
  }

  if (u.permissions?.modules?.sales_admin && u.permissions.modules.sales_admin.enabled === false) {
    return 'NONE';
  }

  const branchPerms = branchStore.getUserBranchPermissions(
    u.id,
    u.role,
    u.permissions?.modules,
    u.permissions?.branchPermissions
  );

  const activeBranches = branchStore.getBranches();
  const enabledSalesBranches: string[] = [];

  activeBranches.forEach(br => {
    const bEntry = branchPerms[br.id];
    if (!bEntry || !bEntry.enabled) return;
    const salesMod = bEntry.modules?.sales_admin;
    if (salesMod && salesMod.enabled) {
      const subVals = Object.values(salesMod.subMenus || {});
      const hasSub = subVals.length === 0 || subVals.some(v => v === 'full_access' || v === 'read_only');
      if (hasSub) {
        enabledSalesBranches.push(br.id);
        return;
      }
    }
    if (isSalesRole && (!salesMod || salesMod.enabled !== false)) {
      enabledSalesBranches.push(br.id);
    }
  });

  if (enabledSalesBranches.length === 0) {
    return 'NONE';
  }
  if (enabledSalesBranches.length === 1) {
    return enabledSalesBranches[0];
  }

  // Priority 1: explicit saved branchPermissions on user profile (User Management RBAC)
  const rawSavedPerms = u.permissions?.branchPermissions;
  if (rawSavedPerms && typeof rawSavedPerms === 'object') {
    const rawSda = Boolean(rawSavedPerms['cab-sidoarjo']?.enabled);
    const rawBwi = Boolean(rawSavedPerms['cab-banyuwangi']?.enabled);
    if (rawSda && !rawBwi && enabledSalesBranches.includes('cab-sidoarjo')) return 'cab-sidoarjo';
    if (rawBwi && !rawSda && enabledSalesBranches.includes('cab-banyuwangi')) return 'cab-banyuwangi';

    // Also check if sales_admin module is enabled only in one branch inside rawSavedPerms
    const sdaSalesOn = Boolean(rawSavedPerms['cab-sidoarjo']?.enabled && rawSavedPerms['cab-sidoarjo']?.modules?.sales_admin?.enabled);
    const bwiSalesOn = Boolean(rawSavedPerms['cab-banyuwangi']?.enabled && rawSavedPerms['cab-banyuwangi']?.modules?.sales_admin?.enabled);
    if (sdaSalesOn && !bwiSalesOn && enabledSalesBranches.includes('cab-sidoarjo')) return 'cab-sidoarjo';
    if (bwiSalesOn && !sdaSalesOn && enabledSalesBranches.includes('cab-banyuwangi')) return 'cab-banyuwangi';
  }

  // Priority 2: explicit text hint from User Management profile (department / notes / email)
  const textHint = `${u.department || ''} ${u.notes || ''} ${u.email || ''}`.toLowerCase();
  if ((textHint.includes('sidoarjo') || textHint.includes('sda')) && enabledSalesBranches.includes('cab-sidoarjo')) {
    return 'cab-sidoarjo';
  }
  if ((textHint.includes('nusantara') || textHint.includes('banyuwangi') || textHint.includes('bwi')) && enabledSalesBranches.includes('cab-banyuwangi')) {
    return 'cab-banyuwangi';
  }

  const crewBranch = branchStore.getCrewBranchId(u.id, u.fullName);
  if (crewBranch && enabledSalesBranches.includes(crewBranch)) {
    return crewBranch;
  }

  return enabledSalesBranches.includes('cab-banyuwangi') ? 'cab-banyuwangi' : enabledSalesBranches[0];
}

export function isSalesAdminUser(u: UserProfile, targetBranchId?: string): boolean {
  const assignedBranchId = getSalesAdminAssignedBranchId(u);
  if (assignedBranchId === 'NONE') return false;
  if (!targetBranchId || targetBranchId === 'ALL') return true;
  return assignedBranchId === targetBranchId;
}

export function useSalesAdminUsers(targetBranchId?: string): UserProfile[] {
  const [users, setUsers] = useState<UserProfile[]>(() => logisticsStore.getUsers());

  useEffect(() => {
    const syncUsers = () => {
      setUsers([...logisticsStore.getUsers()]);
    };
    syncUsers();
    const unsubscribe = logisticsStore.subscribe(syncUsers);
    window.addEventListener('akk-branch-updated', syncUsers);
    return () => {
      unsubscribe();
      window.removeEventListener('akk-branch-updated', syncUsers);
    };
  }, []);

  return useMemo(() => {
    return users.filter(u => isSalesAdminUser(u, targetBranchId));
  }, [users, targetBranchId]);
}

export function useSalesAdminOptions(targetBranchId?: string): string[] {
  const salesUsers = useSalesAdminUsers(targetBranchId);
  return useMemo(() => {
    const names = Array.from(
      new Set(
        salesUsers
          .map(u => (u.fullName || '').trim().toUpperCase())
          .filter(Boolean)
      )
    );
    return ['SEMUA ADMIN', ...names];
  }, [salesUsers]);
}

export const ADMIN_OPTIONS = ['SEMUA ADMIN'];

export const MONTH_OPTIONS = [
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

export const YEAR_OPTIONS = ['2025', '2026', '2027'];

export const SALES_BRANCH_OPTIONS = [
  { id: 'cab-banyuwangi', name: 'Nusantara', badge: 'Gudang Nusantara' },
  { id: 'cab-sidoarjo', name: 'Sidoarjo', badge: 'Gudang Sidoarjo' }
];

export const SalesHeaderFilter: React.FC<SalesHeaderFilterProps> = ({
  title,
  subtitle,
  selectedAdmin,
  onAdminChange,
  selectedMonth,
  onMonthChange,
  selectedYear,
  onYearChange,
  jadwalInputCount = 0,
  pencapaianPercent = 0,
  periodeLabel,
  adminOptions,
  hideAdminFilter = false,
  hideStatsCards = false,
  selectedBranchId = 'cab-banyuwangi',
  onBranchChange,
  showBranchFilter = false,
  onExportExcel
}) => {
  const currentUser = logisticsStore.getCurrentUser();
  const accessibleBranchOptions = useMemo(() => {
    const allowed = branchStore.getAccessibleBranchesForUser(currentUser);
    const allowedIds = new Set(allowed.map(b => b.id));
    const filtered = SALES_BRANCH_OPTIONS.filter(opt => allowedIds.has(opt.id));
    return filtered.length > 0 ? filtered : SALES_BRANCH_OPTIONS;
  }, [currentUser]);

  const effectiveBranchId = useMemo(() => {
    if (selectedBranchId && selectedBranchId !== 'ALL' && accessibleBranchOptions.some(b => b.id === selectedBranchId)) {
      return selectedBranchId;
    }
    return accessibleBranchOptions[0]?.id || 'cab-banyuwangi';
  }, [selectedBranchId, accessibleBranchOptions]);

  useEffect(() => {
    if (showBranchFilter && onBranchChange && selectedBranchId !== effectiveBranchId) {
      onBranchChange(effectiveBranchId);
    }
  }, [showBranchFilter, onBranchChange, selectedBranchId, effectiveBranchId]);

  const liveSalesAdminOptions = useSalesAdminOptions(effectiveBranchId);
  const [openMenu, setOpenMenu] = useState<null | 'admin' | 'month' | 'year' | 'branch'>(null);
  const filterBarRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const onOutside = (ev: MouseEvent) => {
      if (filterBarRef.current && !filterBarRef.current.contains(ev.target as Node)) {
        setOpenMenu(null);
      }
    };
    document.addEventListener('mousedown', onOutside);
    return () => document.removeEventListener('mousedown', onOutside);
  }, []);

  const optionsToRender = useMemo(() => {
    if (liveSalesAdminOptions.length > 1) {
      return liveSalesAdminOptions;
    }
    if (adminOptions && adminOptions.length > 0) {
      return adminOptions;
    }
    return ['SEMUA ADMIN'];
  }, [liveSalesAdminOptions, adminOptions]);

  useEffect(() => {
    if (selectedAdmin !== 'SEMUA ADMIN' && !optionsToRender.includes(selectedAdmin)) {
      onAdminChange('SEMUA ADMIN');
    }
  }, [optionsToRender, selectedAdmin, onAdminChange]);

  const displayPeriod = periodeLabel || `${selectedMonth.slice(0, 3)} ${selectedYear}`;
  const activeBranchMeta =
    accessibleBranchOptions.find(b => b.id === effectiveBranchId) || accessibleBranchOptions[0] || SALES_BRANCH_OPTIONS[0];

  return (
    <div className="space-y-4">
      {/* Page Title Header (Clean & Minimalist) */}
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
          {title}
        </h1>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
          {subtitle}
        </p>
      </div>

      {/* Unified Filter Bar — Clean Single-Row Alignment */}
      <div
        ref={filterBarRef}
        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-xs"
      >
        <div
          className={`grid grid-cols-1 gap-3.5 items-end ${
            hideStatsCards && !onExportExcel
              ? !hideAdminFilter && showBranchFilter
                ? 'md:grid-cols-3'
                : 'md:grid-cols-2'
              : 'lg:grid-cols-12'
          }`}
        >
          {/* Admin Selector (Only rendered when hideAdminFilter is false) */}
          {!hideAdminFilter && (
            <div className={hideStatsCards && !onExportExcel ? 'relative' : showBranchFilter ? 'lg:col-span-3 relative' : 'lg:col-span-4 relative'}>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
                Filter Nama Admin
              </label>
              <button
                type="button"
                onClick={() => setOpenMenu(openMenu === 'admin' ? null : 'admin')}
                className="w-full px-3.5 py-2.5 bg-slate-50/90 dark:bg-slate-950 hover:bg-slate-100/80 dark:hover:bg-slate-800/80 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-bold text-slate-900 dark:text-white transition flex items-center justify-between gap-2 cursor-pointer"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <User className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
                  <span className="truncate">
                    {selectedAdmin === 'SEMUA ADMIN' ? 'Semua Admin' : selectedAdmin}
                  </span>
                </div>
                <ChevronDown className={`w-4 h-4 text-slate-400 shrink-0 transition-transform ${openMenu === 'admin' ? 'rotate-180 text-indigo-500' : ''}`} />
              </button>

              {openMenu === 'admin' && (
                <div className="absolute z-50 left-0 right-0 mt-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-2xl overflow-hidden max-h-60 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
                  {optionsToRender.map(admin => {
                    const isSel = selectedAdmin === admin;
                    return (
                      <button
                        key={admin}
                        type="button"
                        onClick={() => {
                          onAdminChange(admin);
                          setOpenMenu(null);
                        }}
                        className={`w-full px-3.5 py-2.5 text-left text-xs font-bold flex items-center justify-between transition cursor-pointer ${
                          isSel
                            ? 'bg-indigo-50 dark:bg-indigo-500/20 text-indigo-700 dark:text-indigo-300'
                            : 'hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200'
                        }`}
                      >
                        <span>{admin === 'SEMUA ADMIN' ? 'Semua Admin' : admin}</span>
                        {isSel && <CheckCircle2 className="w-4 h-4 text-indigo-500 shrink-0" />}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Cabang Selector (When showBranchFilter is enabled) */}
          {showBranchFilter && (
            <div className={hideStatsCards && !onExportExcel ? 'relative' : hideAdminFilter ? 'lg:col-span-4 relative' : 'lg:col-span-3 relative'}>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
                Filter Cabang
              </label>
              <button
                type="button"
                disabled={accessibleBranchOptions.length <= 1}
                onClick={() => accessibleBranchOptions.length > 1 && setOpenMenu(openMenu === 'branch' ? null : 'branch')}
                className={`w-full px-3.5 py-2.5 bg-slate-50/90 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-bold text-slate-900 dark:text-white transition flex items-center justify-between gap-2 ${
                  accessibleBranchOptions.length > 1
                    ? 'hover:bg-slate-100/80 dark:hover:bg-slate-800/80 cursor-pointer'
                    : 'cursor-default opacity-90'
                }`}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <Building2 className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400 shrink-0" />
                  <span className="truncate">
                    Cabang {activeBranchMeta.name}
                  </span>
                </div>
                {accessibleBranchOptions.length > 1 ? (
                  <ChevronDown className={`w-3.5 h-3.5 text-slate-400 shrink-0 transition-transform ${openMenu === 'branch' ? 'rotate-180 text-indigo-500' : ''}`} />
                ) : (
                  <Lock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                )}
              </button>

              {openMenu === 'branch' && accessibleBranchOptions.length > 1 && (
                <div className="absolute z-50 left-0 right-0 mt-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-2xl overflow-hidden divide-y divide-slate-100 dark:divide-slate-800">
                  {accessibleBranchOptions.map(br => {
                    const isSel = effectiveBranchId === br.id;
                    return (
                      <button
                        key={br.id}
                        type="button"
                        onClick={() => {
                          onBranchChange?.(br.id);
                          setOpenMenu(null);
                        }}
                        className={`w-full px-3.5 py-2.5 text-left text-xs font-bold flex items-center justify-between transition cursor-pointer ${
                          isSel
                            ? 'bg-indigo-50 dark:bg-indigo-500/20 text-indigo-700 dark:text-indigo-300'
                            : 'hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200'
                        }`}
                      >
                        <div>
                          <span className="block">Cabang {br.name}</span>
                          <span className="text-[10px] font-medium text-slate-500 dark:text-slate-400">{br.badge}</span>
                        </div>
                        {isSel && <CheckCircle2 className="w-4 h-4 text-indigo-500 shrink-0" />}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Month & Year Selectors */}
          <div
            className={
              hideStatsCards && !onExportExcel
                ? ''
                : showBranchFilter
                ? hideAdminFilter
                  ? 'lg:col-span-5'
                  : 'lg:col-span-4'
                : hideAdminFilter
                ? hideStatsCards
                  ? 'lg:col-span-8'
                  : 'lg:col-span-6'
                : 'lg:col-span-4'
            }
          >
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
              Periode Bulan &amp; Tahun
            </label>
            <div className="grid grid-cols-2 gap-2.5">
              {/* Custom Month Selector */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setOpenMenu(openMenu === 'month' ? null : 'month')}
                  className="w-full px-3.5 py-2.5 bg-slate-50/90 dark:bg-slate-950 hover:bg-slate-100/80 dark:hover:bg-slate-800/80 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-bold text-slate-900 dark:text-white transition flex items-center justify-between gap-2 cursor-pointer"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <Calendar className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400 shrink-0" />
                    <span className="truncate">{selectedMonth}</span>
                  </div>
                  <ChevronDown className={`w-3.5 h-3.5 text-slate-400 shrink-0 transition-transform ${openMenu === 'month' ? 'rotate-180 text-indigo-500' : ''}`} />
                </button>
                {openMenu === 'month' && (
                  <div className="absolute z-50 left-0 right-0 mt-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-2xl overflow-hidden max-h-60 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
                    {MONTH_OPTIONS.map(m => {
                      const isSel = selectedMonth === m;
                      return (
                        <button
                          key={m}
                          type="button"
                          onClick={() => {
                            onMonthChange(m);
                            setOpenMenu(null);
                          }}
                          className={`w-full px-3.5 py-2 text-left text-xs font-bold flex items-center justify-between transition cursor-pointer ${
                            isSel
                              ? 'bg-indigo-50 dark:bg-indigo-500/20 text-indigo-700 dark:text-indigo-300'
                              : 'hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200'
                          }`}
                        >
                          <span>{m}</span>
                          {isSel && <CheckCircle2 className="w-3.5 h-3.5 text-indigo-500 shrink-0" />}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Custom Year Selector */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setOpenMenu(openMenu === 'year' ? null : 'year')}
                  className="w-full px-3.5 py-2.5 bg-slate-50/90 dark:bg-slate-950 hover:bg-slate-100/80 dark:hover:bg-slate-800/80 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-mono font-bold text-slate-900 dark:text-white transition flex items-center justify-between gap-2 cursor-pointer"
                >
                  <span>{selectedYear}</span>
                  <ChevronDown className={`w-3.5 h-3.5 text-slate-400 shrink-0 transition-transform ${openMenu === 'year' ? 'rotate-180 text-indigo-500' : ''}`} />
                </button>
                {openMenu === 'year' && (
                  <div className="absolute z-50 left-0 right-0 mt-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-2xl overflow-hidden divide-y divide-slate-100 dark:divide-slate-800">
                    {YEAR_OPTIONS.map(y => {
                      const isSel = selectedYear === y;
                      return (
                        <button
                          key={y}
                          type="button"
                          onClick={() => {
                            onYearChange(y);
                            setOpenMenu(null);
                          }}
                          className={`w-full px-3.5 py-2 text-left text-xs font-mono font-bold flex items-center justify-between transition cursor-pointer ${
                            isSel
                              ? 'bg-indigo-50 dark:bg-indigo-500/20 text-indigo-700 dark:text-indigo-300'
                              : 'hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200'
                          }`}
                        >
                          <span>{y}</span>
                          {isSel && <CheckCircle2 className="w-3.5 h-3.5 text-indigo-500 shrink-0" />}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Optional Export Button (Single Row) OR KPI Summary Cards Right Side */}
          {hideStatsCards ? (
            onExportExcel ? (
              <div className={showBranchFilter ? 'lg:col-span-2' : 'lg:col-span-4'}>
                <button
                  type="button"
                  onClick={onExportExcel}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold shadow-xs transition cursor-pointer whitespace-nowrap"
                >
                  <FileSpreadsheet className="w-4 h-4 shrink-0" />
                  <span>Ekspor Excel</span>
                </button>
              </div>
            ) : null
          ) : (
            <div className={`${hideAdminFilter ? 'lg:col-span-6' : 'lg:col-span-4'} grid grid-cols-3 gap-2.5`}>
              <div className="bg-slate-50/90 dark:bg-slate-950 border border-slate-200/80 dark:border-slate-800 rounded-xl p-2.5 text-center">
                <div className="flex items-center justify-center gap-1 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  <ClipboardList className="w-3 h-3 text-indigo-600 dark:text-indigo-400 shrink-0" />
                  <span className="truncate">Jadwal Input</span>
                </div>
                <span className="block text-sm sm:text-base font-extrabold text-slate-900 dark:text-white mt-0.5 font-mono tabular-nums">
                  {jadwalInputCount}
                </span>
              </div>

              <div className="bg-emerald-50/60 dark:bg-emerald-950/30 border border-emerald-200/70 dark:border-emerald-800/60 rounded-xl p-2.5 text-center">
                <div className="flex items-center justify-center gap-1 text-[10px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
                  <CheckCircle2 className="w-3 h-3 shrink-0" />
                  <span className="truncate">Pencapaian</span>
                </div>
                <span className="block text-sm sm:text-base font-extrabold mt-0.5 text-emerald-700 dark:text-emerald-300 font-mono tabular-nums">
                  {pencapaianPercent}%
                </span>
              </div>

              <div className="bg-indigo-50/60 dark:bg-indigo-950/30 border border-indigo-200/70 dark:border-indigo-800/60 rounded-xl p-2.5 text-center">
                <div className="flex items-center justify-center gap-1 text-[10px] font-bold uppercase tracking-wider text-indigo-700 dark:text-indigo-400">
                  <Calendar className="w-3 h-3 shrink-0" />
                  <span className="truncate">Periode</span>
                </div>
                <span className="block text-xs sm:text-sm font-extrabold text-indigo-900 dark:text-indigo-200 mt-1 truncate">
                  {displayPeriod}
                </span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

