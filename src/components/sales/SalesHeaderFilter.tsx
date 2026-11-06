import React, { useState, useEffect, useMemo } from 'react';
import {
  User,
  ChevronDown,
  Calendar,
  CheckCircle2,
  ClipboardList,
  ShieldCheck
} from 'lucide-react';
import { logisticsStore } from '../../services/store';
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
}

export function isSalesAdminUser(u: UserProfile): boolean {
  if (!u || u.status === 'rejected' || u.status === 'inactive') return false;
  const deptClean = (u.department || '').trim().toLowerCase();
  const deptMatch = deptClean === 'adm. penjualan' || deptClean === 'admin penjualan';
  if (u.role === 'super_admin') {
    return deptMatch;
  }
  const hasSalesAccess = canAccess(u, 'sales_admin');
  return hasSalesAccess || u.role === 'sales_admin' || deptMatch;
}

export function useSalesAdminUsers(): UserProfile[] {
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
    return users.filter(isSalesAdminUser);
  }, [users]);
}

export function useSalesAdminOptions(): string[] {
  const salesUsers = useSalesAdminUsers();
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
  adminOptions
}) => {
  const liveSalesAdminOptions = useSalesAdminOptions();
  const salesAdminUsers = useSalesAdminUsers();

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

  return (
    <div className="space-y-4">
      {/* Page Title Header (Clean & Minimalist - Topbar Navigation Removed) */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
            {title}
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            {subtitle}
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto text-xs text-slate-500 dark:text-slate-400">
          <ShieldCheck className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
          <span>
            Terintegrasi Hak Akses User (<strong className="text-slate-800 dark:text-slate-200">{salesAdminUsers.length} User Akses Penjualan</strong>)
          </span>
        </div>
      </div>

      {/* Unified Filter Bar with Refreshed Modern Color Tone */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 sm:p-5 shadow-xs">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-center">
          {/* Admin Selector (Integrated with User Management Hak Akses: Adm. Penjualan) */}
          <div className="lg:col-span-4">
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">
                Filter Admin Pengguna (Adm. Penjualan)
              </label>
              <span className="text-[10px] font-semibold text-indigo-600 dark:text-indigo-400">
                Hak Akses: Adm. Penjualan
              </span>
            </div>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                <User className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
              </div>
              <select
                value={selectedAdmin}
                onChange={e => onAdminChange(e.target.value)}
                className="w-full pl-10 pr-9 py-2.5 bg-slate-50/90 dark:bg-slate-950 hover:bg-slate-100/80 dark:hover:bg-slate-800/80 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-bold text-slate-900 dark:text-white transition focus:outline-hidden focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 cursor-pointer appearance-none"
              >
                {optionsToRender.map(admin => (
                  <option key={admin} value={admin}>
                    {admin === 'SEMUA ADMIN' ? 'SEMUA ADMIN (ADM. PENJUALAN)' : admin}
                  </option>
                ))}
              </select>
              <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>

          {/* Month & Year Selectors */}
          <div className="lg:col-span-4">
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-1.5">
              Periode Bulan &amp; Tahun
            </label>
            <div className="grid grid-cols-2 gap-2.5">
              <div className="relative">
                <select
                  value={selectedMonth}
                  onChange={e => onMonthChange(e.target.value)}
                  className="w-full pl-3.5 pr-8 py-2.5 bg-slate-50/90 dark:bg-slate-950 hover:bg-slate-100/80 dark:hover:bg-slate-800/80 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-semibold text-slate-900 dark:text-white transition focus:outline-hidden focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 cursor-pointer appearance-none"
                >
                  {MONTH_OPTIONS.map(m => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
              <div className="relative">
                <select
                  value={selectedYear}
                  onChange={e => onYearChange(e.target.value)}
                  className="w-full pl-3.5 pr-8 py-2.5 bg-slate-50/90 dark:bg-slate-950 hover:bg-slate-100/80 dark:hover:bg-slate-800/80 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-semibold text-slate-900 dark:text-white transition focus:outline-hidden focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 cursor-pointer appearance-none font-mono tabular-nums"
                >
                  {YEAR_OPTIONS.map(y => (
                    <option key={y} value={y}>
                      {y}
                    </option>
                  ))}
                </select>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            </div>
          </div>

          {/* KPI Summary Cards Right Side */}
          <div className="lg:col-span-4 grid grid-cols-3 gap-2.5">
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
        </div>
      </div>
    </div>
  );
};
