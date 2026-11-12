import React, { useState, useEffect, useMemo } from 'react';
import {
  User,
  ChevronDown,
  Calendar,
  CheckCircle2,
  ClipboardList,
  ShieldCheck,
  FileSpreadsheet
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

export function isSalesAdminUser(u: UserProfile, targetBranchId?: string): boolean {
  if (!u || u.status !== 'approved') return false;
  const deptClean = (u.department || '').trim().toLowerCase();
  const deptMatch = deptClean === 'adm. penjualan' || deptClean === 'admin penjualan';
  if (u.role === 'super_admin') {
    return deptMatch;
  }

  const branchPerms = branchStore.getUserBranchPermissions(
    u.id,
    u.role,
    u.permissions?.modules,
    u.permissions?.branchPermissions
  );

  if (targetBranchId && targetBranchId !== 'ALL') {
    const bEntry = branchPerms[targetBranchId];
    if (!bEntry || !bEntry.enabled) return false;
    const salesMod = bEntry.modules?.sales_admin;
    if (salesMod && salesMod.enabled) {
      const hasSub = Object.values(salesMod.subMenus || {}).some(v => v === 'full_access' || v === 'read_only');
      if (hasSub) return true;
    }
    return u.role === 'sales_admin' && bEntry.enabled && (!salesMod || salesMod.enabled !== false);
  }

  const hasSalesAccess = canAccess(u, 'sales_admin');
  if (u.permissions?.modules?.sales_admin && u.permissions.modules.sales_admin.enabled === false) {
    return false;
  }
  return u.role === 'sales_admin' || hasSalesAccess;
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
  const effectiveBranchId = selectedBranchId && selectedBranchId !== 'ALL' ? selectedBranchId : 'cab-banyuwangi';
  const liveSalesAdminOptions = useSalesAdminOptions(effectiveBranchId);
  const salesAdminUsers = useSalesAdminUsers(effectiveBranchId);
  const [openMenu, setOpenMenu] = useState<null | 'admin' | 'month' | 'year' | 'branch'>(null);

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
    SALES_BRANCH_OPTIONS.find(b => b.id === effectiveBranchId) || SALES_BRANCH_OPTIONS[0];

  return (
    <div className="space-y-4">
      {/* Page Title Header (Clean & Minimalist) */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
            {title}
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            {subtitle}
          </p>
        </div>

        {!hideAdminFilter && (
          <div className="flex items-center gap-2 self-start sm:self-auto text-xs text-slate-500 dark:text-slate-400">
            <ShieldCheck className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
            <span>
              Terintegrasi Hak Akses User (<strong className="text-slate-800 dark:text-slate-200">{salesAdminUsers.length} User Akses Penjualan</strong>)
            </span>
          </div>
        )}
      </div>

      {/* Unified Filter Bar with Refreshed Modern Color Tone */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 sm:p-5 shadow-xs">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-end">
          {/* Admin Selector (Only rendered when hideAdminFilter is false) */}
          {!hideAdminFilter && (
            <div className="lg:col-span-4 relative">
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">
                  Filter Admin Pengguna (Adm. Penjualan)
                </label>
                <span className="text-[10px] font-semibold text-indigo-600 dark:text-indigo-400">
                  Hak Akses: Adm. Penjualan
                </span>
              </div>
              <button
                type="button"
                onClick={() => setOpenMenu(openMenu === 'admin' ? null : 'admin')}
                className="w-full px-3.5 py-2.5 bg-slate-50/90 dark:bg-slate-950 hover:bg-slate-100/80 dark:hover:bg-slate-800/80 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-bold text-slate-900 dark:text-white transition flex items-center justify-between gap-2 cursor-pointer"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <User className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
                  <span className="truncate">
                    {selectedAdmin === 'SEMUA ADMIN' ? 'SEMUA ADMIN (ADM. PENJUALAN)' : selectedAdmin}
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
                        <span>{admin === 'SEMUA ADMIN' ? 'SEMUA ADMIN (ADM. PENJUALAN)' : admin}</span>
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
            <div className={hideAdminFilter ? 'lg:col-span-4 relative' : 'lg:col-span-3 relative'}>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">
                  Filter Cabang Admin Penjualan
                </label>
              </div>
              <button
                type="button"
                onClick={() => setOpenMenu(openMenu === 'branch' ? null : 'branch')}
                className="w-full px-3.5 py-2.5 bg-slate-50/90 dark:bg-slate-950 hover:bg-slate-100/80 dark:hover:bg-slate-800/80 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-bold text-slate-900 dark:text-white transition flex items-center justify-between gap-2 cursor-pointer"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className="truncate">
                    {activeBranchMeta.id === 'ALL' ? 'Semua Cabang (Nusantara & Sidoarjo)' : `Cabang ${activeBranchMeta.name}`}
                  </span>
                </div>
                <ChevronDown className={`w-3.5 h-3.5 text-slate-400 shrink-0 transition-transform ${openMenu === 'branch' ? 'rotate-180 text-indigo-500' : ''}`} />
              </button>

              {openMenu === 'branch' && (
                <div className="absolute z-50 left-0 right-0 mt-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-2xl overflow-hidden divide-y divide-slate-100 dark:divide-slate-800">
                  {SALES_BRANCH_OPTIONS.map(br => {
                    const isSel = selectedBranchId === br.id;
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
                          <span className="block">{br.id === 'ALL' ? 'Semua Cabang' : `Cabang ${br.name}`}</span>
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
              showBranchFilter
                ? hideAdminFilter
                  ? 'lg:col-span-4'
                  : 'lg:col-span-3'
                : hideAdminFilter
                ? hideStatsCards
                  ? 'lg:col-span-8'
                  : 'lg:col-span-6'
                : 'lg:col-span-4'
            }
          >
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-1.5">
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

          {/* KPI Summary Cards Right Side + Ekspor to Excel */}
          {hideStatsCards ? (
            <div className={showBranchFilter ? 'lg:col-span-4' : 'lg:col-span-4'}>
              <div className="flex items-center justify-end">
                {onExportExcel && (
                  <button
                    type="button"
                    onClick={onExportExcel}
                    className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold shadow-xs transition cursor-pointer whitespace-nowrap shrink-0"
                  >
                    <FileSpreadsheet className="w-4 h-4 shrink-0" />
                    <span>Ekspor to Excel</span>
                  </button>
                )}
              </div>
            </div>
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

