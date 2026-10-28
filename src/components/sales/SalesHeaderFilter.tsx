import React from 'react';
import {
  Activity,
  Clock,
  Calendar,
  Layers,
  User,
  ChevronDown
} from 'lucide-react';

export type SalesTopTab = 'checklist' | 'durasi_muat' | 'jadwal_admin' | 'aktivitas_view';

interface SalesHeaderFilterProps {
  title: string;
  subtitle: string;
  activeTab: SalesTopTab;
  onTabChange: (tab: SalesTopTab) => void;
  selectedAdmin: string;
  onAdminChange: (admin: string) => void;
  selectedMonth: string;
  onMonthChange: (month: string) => void;
  selectedYear: string;
  onYearChange: (year: string) => void;
  jadwalInputCount?: number;
  pencapaianPercent?: number;
  periodeLabel?: string;
  adminOptions?: string[]; // Add optional prop for dynamic list
}

export const ADMIN_OPTIONS = [
  'SEMUA ADMIN',
  'ISTI',
  'IZZUL',
  'SHOIM',
  'FATA',
  'BINTANG',
  'BAYU'
];

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
  activeTab,
  onTabChange,
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
  const displayPeriod = periodeLabel || `${selectedMonth.slice(0, 3)} ${selectedYear}`;
  const optionsToRender = adminOptions || ADMIN_OPTIONS;

  return (
    <div className="space-y-4">
      {/* Top Header & Navigation Tabs */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">{title}</h1>
          <p className="text-xs text-slate-500 mt-1">{subtitle}</p>
        </div>

        {/* Top Right Navigation Pills matching Screenshots 2, 3, 4, 5 */}
        <div className="flex items-center gap-1.5 p-1 bg-white border border-slate-200 rounded-xl shadow-xs overflow-x-auto">
          <button
            type="button"
            onClick={() => onTabChange('checklist')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition cursor-pointer ${
              activeTab === 'checklist'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <Activity className="w-3.5 h-3.5" />
            <span>Checklist</span>
          </button>

          <button
            type="button"
            onClick={() => onTabChange('durasi_muat')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition cursor-pointer ${
              activeTab === 'durasi_muat'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>Durasi Muat</span>
          </button>

          <button
            type="button"
            onClick={() => onTabChange('jadwal_admin')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition cursor-pointer ${
              activeTab === 'jadwal_admin'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <Calendar className="w-3.5 h-3.5" />
            <span>Jadwal Admin</span>
          </button>

          <button
            type="button"
            onClick={() => onTabChange('aktivitas_view')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition cursor-pointer ${
              activeTab === 'aktivitas_view'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Aktivitas View (Semua)</span>
          </button>
        </div>
      </div>

      {/* Unified Filter Bar matching Screenshots */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-xs">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3.5 items-center">
          {/* Admin Selector */}
          <div className="md:col-span-4">
            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
              FILTER ADMIN PENGGUNA:
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                <User className="w-4 h-4 text-blue-600" />
              </div>
              <select
                value={selectedAdmin}
                onChange={e => onAdminChange(e.target.value)}
                className="w-full pl-9 pr-8 py-2 bg-slate-50 hover:bg-slate-100/80 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 transition focus:outline-hidden focus:ring-2 focus:ring-blue-500 cursor-pointer appearance-none"
              >
                {optionsToRender.map(admin => (
                  <option key={admin} value={admin}>
                    {admin}
                  </option>
                ))}
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-3 pointer-events-none" />
            </div>
          </div>

          {/* Month & Year Selectors */}
          <div className="md:col-span-4">
            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
              PERIODE BULAN & TAHUN:
            </label>
            <div className="grid grid-cols-2 gap-2">
              <div className="relative">
                <select
                  value={selectedMonth}
                  onChange={e => onMonthChange(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 hover:bg-slate-100/80 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 transition focus:outline-hidden focus:ring-2 focus:ring-blue-500 cursor-pointer appearance-none"
                >
                  {MONTH_OPTIONS.map(m => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-3 pointer-events-none" />
              </div>
              <div className="relative">
                <select
                  value={selectedYear}
                  onChange={e => onYearChange(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 hover:bg-slate-100/80 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 transition focus:outline-hidden focus:ring-2 focus:ring-blue-500 cursor-pointer appearance-none"
                >
                  {YEAR_OPTIONS.map(y => (
                    <option key={y} value={y}>
                      {y}
                    </option>
                  ))}
                </select>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-3 pointer-events-none" />
              </div>
            </div>
          </div>

          {/* KPI Mini Cards Right Side */}
          <div className="md:col-span-4 grid grid-cols-3 gap-2">
            <div className="bg-slate-50 border border-slate-100 rounded-xl p-2.5 text-center">
              <span className="block text-[9px] font-bold uppercase tracking-wider text-slate-400">
                JADWAL INPUT
              </span>
              <span className="block text-sm font-extrabold text-slate-900 mt-0.5">
                {jadwalInputCount}
              </span>
            </div>

            <div className="bg-slate-50 border border-slate-100 rounded-xl p-2.5 text-center">
              <span className="block text-[9px] font-bold uppercase tracking-wider text-slate-400">
                PENCAPAIAN
              </span>
              <span className={`block text-sm font-extrabold mt-0.5 ${pencapaianPercent > 0 ? 'text-blue-600' : 'text-blue-700'}`}>
                {pencapaianPercent}%
              </span>
            </div>

            <div className="bg-slate-50 border border-slate-100 rounded-xl p-2.5 text-center">
              <span className="block text-[9px] font-bold uppercase tracking-wider text-slate-400">
                PERIODE
              </span>
              <span className="block text-xs font-extrabold text-slate-800 mt-1">
                {displayPeriod}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
