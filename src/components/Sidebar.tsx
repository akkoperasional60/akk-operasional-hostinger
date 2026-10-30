import React, { useState, useEffect } from 'react';
import {
  LayoutDashboard,
  Calendar,
  Truck,
  MapPin,
  FileSpreadsheet,
  FileText,
  Users,
  Database,
  Radio,
  History,
  Menu,
  X,
  LogOut,
  LogIn,
  ChevronDown,
  ChevronRight,
  ChevronLeft,
  Building2,
  ShoppingBag,
  Activity,
  Timer,
  Award,
  Settings,
  Briefcase,
  Layers,
  Sparkles,
  User,
  ShieldAlert,
  Percent,
  TrendingUp,
  Wrench,
  Fuel,
  Globe,
  Megaphone,
  Smartphone,
  Download,
  Zap,
  KeyRound,
  ShieldCheck,
  Video,
  Brush,
  BarChart3,
  Camera,
  Package,
  ArrowDownToLine,
  ArrowUpFromLine,
  ClipboardCheck,
  Map as MapIcon,
  MessageSquare
} from 'lucide-react';
import { AkkLogo } from './AkkLogo';
import { ThemeSwitcher } from './ThemeSwitcher';
import { AndroidApkDownloadModal } from './AndroidApkDownloadModal';
import { UserProfile } from '../types';
import { logisticsStore } from '../services/store';
import { driverReportService } from '../services/driverReportService';
import { canAccess } from '../utils/rbac';
import { getTabPath } from '../utils/navigationRoutes';

export type NavTab =
  | 'dashboard'
  | 'driver_portal'
  | 'driver_reports'
  | 'analytics_reports'
  | 'operational_dashboard'
  | 'schedules'
  | 'fleets'
  | 'spareparts'
  | 'fuel_efficiency'
  | 'crew_history'
  | 'tracking_eval'
  | 'fleet_forms'
  | 'sales_dashboard'
  | 'sales_activities'
  | 'sales_schedules'
  | 'sales_loading_duration'
  | 'sales_skill_matrix'
  | 'sales_jobdesk'
  | 'sales_kpi'
  | 'sales_kpi_individual'
  | 'sales_kpi_fines'
  | 'sales_kpi_nusantara'
  | 'sales_kpi_omset'
  | 'customer_map'
  | 'purchasing_dashboard'
  | 'purchasing_stock_overview'
  | 'purchasing_stock_forecast'
  | 'hr_dashboard'
  | 'ga_security'
  | 'ga_hk'
  | 'ga_aset'
  | 'training_videos'
  | 'training_karyawan'
  | 'finance_dashboard'
  | 'warehouse_dashboard'
  | 'warehouse_inventory'
  | 'warehouse_inbound'
  | 'warehouse_outbound'
  | 'warehouse_scanner'
  | 'warehouse_slotting'
  | 'warehouse_opname'
  | 'warehouse_cubication'
  | 'warehouse_fleet_cubication'
  | 'marketing_online'
  | 'marketing_offline'
  | 'activity_log'
  | 'users'
  | 'branches'
  | 'architecture'
  | 'e2e_testing';

interface SidebarProps {
  currentTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
  onOpenAuth: (defaultTab?: 'login' | 'register') => void;
  isMinimized?: boolean;
  onToggleMinimize?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentTab,
  onSelectTab,
  onOpenAuth,
  isMinimized = false,
  onToggleMinimize
}) => {
  const [currentUser, setCurrentUser] = useState<UserProfile>(logisticsStore.getCurrentUser());
  const [pendingUsersCount, setPendingUsersCount] = useState<number>(logisticsStore.getPendingUsersCount());
  const [pendingReportsCount, setPendingReportsCount] = useState<number>(0);
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  const [isLogistikOpen, setIsLogistikOpen] = useState(true);
  const [isSalesAdminOpen, setIsSalesAdminOpen] = useState(true);
  const [isKpiDropdownOpen, setIsKpiDropdownOpen] = useState(false);
  const [isPurchasingOpen, setIsPurchasingOpen] = useState(true);
  const [isPurchasingStockOpen, setIsPurchasingStockOpen] = useState(false);
  const [isHrOpen, setIsHrOpen] = useState(true);
  const [isFinanceOpen, setIsFinanceOpen] = useState(true);
  const [isWarehouseOpen, setIsWarehouseOpen] = useState(true);
  const [isMarketingOpen, setIsMarketingOpen] = useState(true);
  const [isRbacOpen, setIsRbacOpen] = useState(false);
  const [isApkModalOpen, setIsApkModalOpen] = useState(false);
  const [currentTime, setCurrentTime] = useState<string>('');

  const isKpiActive = currentTab === 'sales_kpi' || (currentTab && currentTab.startsWith('sales_kpi_'));

  useEffect(() => {
    if (isKpiActive) {
      setIsKpiDropdownOpen(true);
    }
  }, [currentTab, isKpiActive]);

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTime(
        now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) + ' WIB'
      );
    };
    updateTime();
    const timer = setInterval(updateTime, 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const updateReports = () => {
      try {
        const reps = driverReportService.getReports();
        setPendingReportsCount(reps.filter(r => r.status === 'pending').length);
      } catch {}
    };
    updateReports();
    window.addEventListener('driver-report-updated', updateReports);
    return () => window.removeEventListener('driver-report-updated', updateReports);
  }, []);

  useEffect(() => {
    return logisticsStore.subscribe(() => {
      setCurrentUser(logisticsStore.getCurrentUser());
      setPendingUsersCount(logisticsStore.getPendingUsersCount());
    });
  }, []);

  const handleTabClick = (tabId: NavTab) => {
    onSelectTab(tabId);
    setIsMobileOpen(false);
  };

  /**
   * Render Navigation Item with Neon UI Experience V2 Animations
   * - Neumorphic pressed state on active
   * - Smooth neon sweep and slide animation on hover
   * - Glowing vertical neon indicator bar on active item
   * - Subtle cyber neon icon glow
   */
  const renderNavItem = (
    tab: NavTab,
    label: string,
    icon: React.ReactNode,
    badge?: React.ReactNode
  ) => {
    const isActive = currentTab === tab;
    const targetPath = getTabPath(tab);

    return (
      <a
        key={tab}
        href={targetPath}
        onClick={(e) => {
          if (!e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey && e.button === 0) {
            e.preventDefault();
            handleTabClick(tab);
          }
        }}
        title={isMinimized ? label : undefined}
        className={`group relative w-full flex items-center no-underline ${
          isMinimized ? 'justify-center px-2' : 'justify-between px-3'
        } py-2 rounded-lg text-xs font-medium cursor-pointer transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] select-none overflow-hidden ${
          isActive
            ? 'bg-blue-600 text-white font-semibold shadow-xs'
            : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/70'
        }`}
      >
        <div className={`flex items-center min-w-0 transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${isMinimized ? 'gap-0' : 'gap-2.5'}`}>
          <span
            className={`shrink-0 transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:scale-105 ${
              isActive
                ? 'text-white'
                : 'text-slate-500 dark:text-slate-400 group-hover:text-slate-900 dark:group-hover:text-white'
            }`}
          >
            {icon}
          </span>
          <span
            className={`truncate whitespace-nowrap transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] origin-left ${
              isMinimized
                ? 'max-w-0 opacity-0 -translate-x-2 pointer-events-none'
                : 'max-w-[180px] opacity-100 translate-x-0'
            }`}
          >
            {label}
          </span>
        </div>

        {badge && (
          <span
            className={`shrink-0 transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${
              isMinimized
                ? 'max-w-0 opacity-0 scale-75 pointer-events-none overflow-hidden'
                : 'max-w-[60px] opacity-100 scale-100'
            }`}
          >
            {badge}
          </span>
        )}
      </a>
    );
  };

  const renderSidebarContent = () => (
    <div className="h-full flex flex-col justify-between overflow-y-auto overflow-x-hidden bg-slate-900 border-r border-slate-800 transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]">
      {/* Brand Header */}
      <div className={`border-b border-slate-800 transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${isMinimized ? 'p-3 flex flex-col items-center justify-center' : 'p-4'}`}>
        {isMinimized ? (
          <div className="flex flex-col items-center gap-2.5 w-full">
            <div
              onClick={() => handleTabClick('dashboard')}
              className="cursor-pointer hover:opacity-85 transition"
              title="PT Anugrah Kemasan Kreatif"
            >
              <AkkLogo size="md" showText={false} />
            </div>

            {/* Single Sidebar Expand Arrow Button */}
            {onToggleMinimize && (
              <button
                onClick={onToggleMinimize}
                className="w-9 h-8 rounded-lg bg-slate-950 border border-slate-800 text-amber-400 hover:bg-amber-500 hover:text-slate-950 hover:border-amber-500 hover:scale-105 active:scale-95 flex items-center justify-center transition-all duration-200 cursor-pointer shadow-xs"
                title="Perlebar Sidebar"
                aria-label="Perlebar Sidebar"
              >
                <ChevronRight className="w-4 h-4 stroke-[2.5] transition-transform duration-300" />
              </button>
            )}
          </div>
        ) : (
          <div className="flex items-center justify-between w-full gap-2">
            <div
              onClick={() => handleTabClick('dashboard')}
              className="cursor-pointer hover:opacity-90 transition-opacity min-w-0"
            >
              <AkkLogo size="sm" showSubtitle={true} />
            </div>

            {/* Single Sidebar Minimize Arrow Button */}
            {onToggleMinimize && (
              <button
                onClick={onToggleMinimize}
                className="w-8 h-8 rounded-lg bg-slate-950 border border-slate-800 text-slate-300 hover:bg-amber-500 hover:text-slate-950 hover:border-amber-500 hover:scale-105 active:scale-95 flex items-center justify-center transition-all duration-200 cursor-pointer shrink-0 shadow-xs"
                title="Minimalkan Sidebar"
                aria-label="Minimalkan Sidebar"
              >
                <ChevronLeft className="w-4 h-4 stroke-[2.5] transition-transform duration-300" />
              </button>
            )}
          </div>
        )}
      </div>

      {/* Structured Navigation Menu */}
      <nav className={`${isMinimized ? 'p-2 space-y-1.5' : 'p-3 space-y-3'} flex-1 overflow-x-hidden transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]`}>
        {/* ============================================================ */}
        {/* MENU UTAMA PALING ATAS: DASHBOARD                            */}
        {/* ============================================================ */}
        {canAccess(currentUser, 'dashboard') && (
          <div className="space-y-1 pb-2 border-b border-slate-800">
            {!isMinimized && (
              <div className="px-2 mb-1">
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
                  Dashboard Utama
                </span>
              </div>
            )}

            {renderNavItem(
              'dashboard',
              'Dashboard Eksekutif',
              <LayoutDashboard className="w-4 h-4" />
            )}
          </div>
        )}

        {/* ============================================================ */}
        {/* BAGIAN 1: LOGISTIK & PENGIRIMAN                             */}
        {/* ============================================================ */}
        {(() => {
          const canLogisticsPortal = canAccess(currentUser, 'logistics', 'portal_driver');
          const canLogisticsReports = canAccess(currentUser, 'logistics', 'monitoring_sla');
          const canLogisticsOps = canAccess(currentUser, 'logistics', 'dashboard_logistik');
          const canLogisticsSched = canAccess(currentUser, 'logistics', 'rencana_rute');
          const canLogisticsFleets = canAccess(currentUser, 'logistics', 'armada_ceklis');
          const canLogisticsTrack = canAccess(currentUser, 'logistics', 'live_map');
          const hasLogistics = canLogisticsPortal || canLogisticsReports || canLogisticsOps || canLogisticsSched || canLogisticsFleets || canLogisticsTrack;

          if (!hasLogistics) return null;

          return (
            <div className="space-y-1">
              {isMinimized ? (
                <div className="pt-1 pb-0.5 flex justify-center" title="Logistik & Pengiriman">
                  <div className="w-6 h-px bg-slate-800" />
                </div>
              ) : (
                <div className="flex items-center justify-between px-2 mb-1">
                  <button
                    onClick={() => setIsLogistikOpen(!isLogistikOpen)}
                    className="flex items-center gap-1.5 text-[10px] font-extrabold uppercase tracking-wider text-slate-400 hover:text-blue-400 transition cursor-pointer text-left w-full"
                  >
                    <Truck className="w-3.5 h-3.5 text-blue-400" />
                    <span>Logistik & Pengiriman</span>
                    <span className="ml-auto text-slate-400">
                      {isLogistikOpen ? (
                        <ChevronDown className="w-3.5 h-3.5 text-blue-400" />
                      ) : (
                        <ChevronRight className="w-3.5 h-3.5" />
                      )}
                    </span>
                  </button>
                </div>
              )}

              {(!isMinimized ? isLogistikOpen : true) && (
                <div className={`space-y-0.5 ${!isMinimized ? 'pl-2 border-l border-slate-800 ml-2.5 my-1' : ''}`}>
                  {canLogisticsPortal && renderNavItem(
                    'driver_portal',
                    'Portal Driver Mobile',
                    <Smartphone className="w-4 h-4 text-emerald-500" />
                  )}
                  {canLogisticsReports && renderNavItem(
                    'driver_reports',
                    'Laporan Kiriman Kru',
                    <MapPin className="w-4 h-4 text-blue-500" />,
                    pendingReportsCount > 0 ? (
                      <span className="text-[10px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30 px-1.5 py-0.2 rounded-full">
                        {pendingReportsCount}
                      </span>
                    ) : undefined
                  )}
                  {canLogisticsOps && renderNavItem('operational_dashboard', 'Dashboard Operasional', <Truck className="w-4 h-4" />)}
                  {canLogisticsOps && renderNavItem('analytics_reports', 'Analitik Armada & Kru', <BarChart3 className="w-4 h-4" />)}
                  {canLogisticsSched && renderNavItem('schedules', 'Jadwal & Penugasan', <Calendar className="w-4 h-4" />)}
                  {canLogisticsFleets && renderNavItem('fleets', 'Data Armada Terpadu', <Truck className="w-4 h-4" />)}
                  {canLogisticsFleets && renderNavItem('warehouse_fleet_cubication', 'Simulasi Kubikasi Armada', <Layers className="w-4 h-4 text-amber-400" />)}
                  {canLogisticsFleets && renderNavItem('crew_history', 'Kru Pengiriman', <Users className="w-4 h-4" />)}
                  {canLogisticsReports && renderNavItem('tracking_eval', 'Evaluasi Jalur (Excel)', <FileSpreadsheet className="w-4 h-4" />)}
                </div>
              )}
            </div>
          );
        })()}

        {/* ============================================================ */}
        {/* BAGIAN 2: ADMIN PENJUALAN                                   */}
        {/* ============================================================ */}
        {(() => {
          const canSalesDash = canAccess(currentUser, 'sales_admin', 'dashboard_penjualan');
          const canSalesActs = canAccess(currentUser, 'sales_admin', 'aktivitas_harian');
          const canSalesSched = canAccess(currentUser, 'sales_admin', 'jadwal_admin');
          const canSalesDur = canAccess(currentUser, 'sales_admin', 'durasi_muat');
          const canSalesMat = canAccess(currentUser, 'sales_admin', 'matriks_skil');
          const canSalesJob = canAccess(currentUser, 'sales_admin', 'pengaturan_sop');
          const canSalesKpi = canAccess(currentUser, 'sales_admin', 'data_kpi');
          const hasSales = canSalesDash || canSalesActs || canSalesSched || canSalesDur || canSalesMat || canSalesJob || canSalesKpi;

          if (!hasSales) return null;

          return (
            <div className={`space-y-1 ${!isMinimized ? 'pt-2 border-t border-slate-800' : ''}`}>
              {isMinimized ? (
                <div className="pt-1 pb-0.5 flex justify-center" title="Admin Penjualan">
                  <div className="w-6 h-px bg-slate-800" />
                </div>
              ) : (
                <div className="flex items-center justify-between px-2 mb-1">
                  <button
                    onClick={() => setIsSalesAdminOpen(!isSalesAdminOpen)}
                    className="flex items-center gap-1.5 text-[10px] font-extrabold uppercase tracking-wider text-slate-400 hover:text-amber-400 transition cursor-pointer text-left w-full"
                  >
                    <Briefcase className="w-3.5 h-3.5 text-amber-400" />
                    <span>Admin Penjualan</span>
                    <span className="ml-auto text-slate-400">
                      {isSalesAdminOpen ? (
                        <ChevronDown className="w-3.5 h-3.5 text-amber-400" />
                      ) : (
                        <ChevronRight className="w-3.5 h-3.5" />
                      )}
                    </span>
                  </button>
                </div>
              )}

              {(!isMinimized ? isSalesAdminOpen : true) && (
                <div className={`space-y-0.5 ${!isMinimized ? 'pl-2 border-l border-slate-800 ml-2.5 my-1' : ''}`}>
                  {canSalesActs && renderNavItem('sales_activities', 'Aktivitas Harian Admin', <Activity className="w-4 h-4" />)}
                  {canSalesSched && renderNavItem('sales_schedules', 'Jadwal Admin & Produksi', <Calendar className="w-4 h-4" />)}
                  {canSalesDur && renderNavItem('sales_loading_duration', 'Durasi Muat Admin', <Timer className="w-4 h-4" />)}
                  {canSalesMat && renderNavItem('sales_skill_matrix', 'Matriks Skill Admin', <Award className="w-4 h-4" />)}
                  {canSalesJob && renderNavItem('sales_jobdesk', 'Pengaturan SOP & Jobdesk', <Settings className="w-4 h-4" />)}

                  {canSalesKpi && (
                    isMinimized ? (
                      renderNavItem('sales_kpi_individual', 'Data KPI Penjualan', <Sparkles className="w-4 h-4" />)
                    ) : (
                      <div className="space-y-1">
                        <button
                          onClick={() => setIsKpiDropdownOpen(!isKpiDropdownOpen)}
                          className={`group w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition cursor-pointer ${
                            isKpiActive
                              ? 'bg-blue-600 text-white font-semibold'
                              : 'text-slate-400 hover:text-white hover:bg-slate-800/70'
                          }`}
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <Sparkles className="w-4 h-4 shrink-0" />
                            <span className="truncate">Data KPI Penjualan</span>
                          </div>
                          {isKpiDropdownOpen ? (
                            <ChevronDown className="w-3.5 h-3.5" />
                          ) : (
                            <ChevronRight className="w-3.5 h-3.5" />
                          )}
                        </button>

                        {isKpiDropdownOpen && (
                          <div className="space-y-0.5 pl-2.5 border-l border-slate-800 ml-3 my-1">
                            {renderNavItem('sales_kpi_individual', '1. KPI Individu Staf', <User className="w-3.5 h-3.5" />)}
                            {renderNavItem('sales_kpi_fines', '2. Akumulasi Denda', <ShieldAlert className="w-3.5 h-3.5" />)}
                            {renderNavItem('sales_kpi_nusantara', '3. Persentase Kiriman', <Percent className="w-3.5 h-3.5" />)}
                            {renderNavItem('sales_kpi_omset', '4. Omset Admin Penjualan', <TrendingUp className="w-3.5 h-3.5" />)}
                          </div>
                        )}
                      </div>
                    )
                  )}
                </div>
              )}
            </div>
          );
        })()}

        {/* ============================================================ */}
        {/* BAGIAN 3: GUDANG                                            */}
        {/* ============================================================ */}
        {(() => {
          const canWh = canAccess(currentUser, 'warehouse', 'stok_barang') || canAccess(currentUser, 'warehouse', 'permintaan_barang') || canAccess(currentUser, 'warehouse', 'opname_stok') || canAccess(currentUser, 'warehouse', 'ceklis_muat');
          if (!canWh) return null;

          return (
            <div className={`space-y-1 ${!isMinimized ? 'pt-2 border-t border-slate-800' : ''}`}>
              {isMinimized ? (
                <div className="pt-1 pb-0.5 flex justify-center" title="Gudang">
                  <div className="w-6 h-px bg-slate-800" />
                </div>
              ) : (
                <div className="flex items-center justify-between px-2 mb-1">
                  <button
                    onClick={() => setIsWarehouseOpen(!isWarehouseOpen)}
                    className="flex items-center gap-1.5 text-[10px] font-extrabold uppercase tracking-wider text-slate-400 hover:text-blue-400 transition cursor-pointer text-left w-full"
                  >
                    <Building2 className="w-3.5 h-3.5 text-blue-400" />
                    <span>Gudang</span>
                    <span className="ml-auto">
                      {isWarehouseOpen ? <ChevronDown className="w-3.5 h-3.5 text-blue-400" /> : <ChevronRight className="w-3.5 h-3.5" />}
                    </span>
                  </button>
                </div>
              )}

              {(!isMinimized ? isWarehouseOpen : true) && (
                <div className={`space-y-0.5 ${!isMinimized ? 'pl-2 border-l border-slate-800 ml-2.5 my-1' : ''}`}>
                  {renderNavItem('warehouse_dashboard', 'Dashboard', <Building2 className="w-4 h-4" />)}
                  {canAccess(currentUser, 'warehouse', 'stok_barang') && renderNavItem('warehouse_inventory', 'Master SKU & Stok Bin', <Package className="w-4 h-4" />)}
                  {canAccess(currentUser, 'warehouse', 'permintaan_barang') && renderNavItem('warehouse_inbound', 'Inbound (Barang Masuk)', <ArrowDownToLine className="w-4 h-4" />)}
                  {canAccess(currentUser, 'warehouse', 'ceklis_muat') && renderNavItem('warehouse_outbound', 'Outbound (Picking & Muat)', <ArrowUpFromLine className="w-4 h-4" />)}
                  {renderNavItem(
                    'warehouse_scanner',
                    'Pemindaian Foto Barang',
                    <Camera className="w-4 h-4 text-blue-400" />,
                    <span className="px-1.5 py-0.5 rounded bg-blue-500/15 text-blue-300 font-extrabold text-[9px] uppercase tracking-wide">
                      Scan
                    </span>
                  )}
                  {canAccess(currentUser, 'warehouse', 'stok_barang') && renderNavItem('warehouse_slotting', 'Denah Rak & Kapasitas', <MapIcon className="w-4 h-4" />)}
                  {canAccess(currentUser, 'warehouse', 'opname_stok') && renderNavItem('warehouse_opname', 'Stok Opname & Kartu Stok', <ClipboardCheck className="w-4 h-4" />)}
                  {canAccess(currentUser, 'warehouse', 'stok_barang') && renderNavItem('warehouse_cubication', 'Kubikasi & Berat Barang', <Layers className="w-4 h-4 text-emerald-400" />)}
                </div>
              )}
            </div>
          );
        })()}

        {/* ============================================================ */}
        {/* BAGIAN 4: MARKETING                                         */}
        {/* ============================================================ */}
        {(() => {
          const canMkt = canAccess(currentUser, 'marketing', 'kampanye') || canAccess(currentUser, 'marketing', 'leads_pipeline') || canAccess(currentUser, 'marketing', 'laporan_kunjungan');
          if (!canMkt) return null;

          return (
            <div className={`space-y-1 ${!isMinimized ? 'pt-2 border-t border-slate-800' : ''}`}>
              {isMinimized ? (
                <div className="pt-1 pb-0.5 flex justify-center" title="Marketing">
                  <div className="w-6 h-px bg-slate-800" />
                </div>
              ) : (
                <div className="flex items-center justify-between px-2 mb-1">
                  <button
                    onClick={() => setIsMarketingOpen(!isMarketingOpen)}
                    className="flex items-center gap-1.5 text-[10px] font-extrabold uppercase tracking-wider text-slate-400 hover:text-emerald-400 transition cursor-pointer text-left w-full"
                  >
                    <Megaphone className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Marketing</span>
                    <span className="ml-auto">
                      {isMarketingOpen ? <ChevronDown className="w-3.5 h-3.5 text-emerald-400" /> : <ChevronRight className="w-3.5 h-3.5" />}
                    </span>
                  </button>
                </div>
              )}

              {(!isMinimized ? isMarketingOpen : true) && (
                <div className={`space-y-0.5 ${!isMinimized ? 'pl-2 border-l border-slate-800 ml-2.5 my-1' : ''}`}>
                  {canAccess(currentUser, 'marketing', 'kampanye') && renderNavItem('marketing_online', 'Marketing Online', <Globe className="w-4 h-4" />)}
                  {canAccess(currentUser, 'marketing', 'leads_pipeline') && renderNavItem('marketing_offline', 'Marketing Offline', <Megaphone className="w-4 h-4" />)}
                  {canAccess(currentUser, 'marketing', 'laporan_kunjungan') && renderNavItem('customer_map', 'Jaringan Toko & Mitra', <MapPin className="w-4 h-4" />)}
                </div>
              )}
            </div>
          );
        })()}

        {/* ============================================================ */}
        {/* BAGIAN 5: ADMIN PEMBELIAN (PURCHASING)                      */}
        {/* ============================================================ */}
        {(() => {
          const canPur = canAccess(currentUser, 'purchasing', 'permintaan_pembelian') || canAccess(currentUser, 'purchasing', 'po_vendor') || canAccess(currentUser, 'purchasing', 'evaluasi_harga');
          if (!canPur) return null;

          return (
            <div className={`space-y-1 ${!isMinimized ? 'pt-2 border-t border-slate-800' : ''}`}>
              {isMinimized ? (
                <div className="pt-1 pb-0.5 flex justify-center" title="Admin Pembelian">
                  <div className="w-6 h-px bg-slate-800" />
                </div>
              ) : (
                <div className="flex items-center justify-between px-2 mb-1">
                  <button
                    onClick={() => setIsPurchasingOpen(!isPurchasingOpen)}
                    className="flex items-center gap-1.5 text-[10px] font-extrabold uppercase tracking-wider text-slate-400 hover:text-purple-400 transition cursor-pointer text-left w-full"
                  >
                    <ShoppingBag className="w-3.5 h-3.5 text-purple-400" />
                    <span>Admin Pembelian</span>
                    <span className="ml-auto">
                      {isPurchasingOpen ? <ChevronDown className="w-3.5 h-3.5 text-purple-400" /> : <ChevronRight className="w-3.5 h-3.5" />}
                    </span>
                  </button>
                </div>
              )}

              {(!isMinimized ? isPurchasingOpen : true) && (
                <div className={`space-y-0.5 ${!isMinimized ? 'pl-2 border-l border-slate-800 ml-2.5 my-1' : ''}`}>
                  {canAccess(currentUser, 'purchasing', 'permintaan_pembelian') && renderNavItem('purchasing_dashboard', 'Dashboard Pembelian', <ShoppingBag className="w-4 h-4" />)}

                  {canAccess(currentUser, 'purchasing', 'po_vendor') && (
                    isMinimized ? (
                      renderNavItem('purchasing_stock_overview', 'Analisa Stok', <Layers className="w-4 h-4" />)
                    ) : (
                      <div className="space-y-1">
                        <button
                          onClick={() => setIsPurchasingStockOpen(!isPurchasingStockOpen)}
                          className={`group w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition cursor-pointer ${
                            currentTab === 'purchasing_stock_overview' || currentTab === 'purchasing_stock_forecast'
                              ? 'bg-blue-600 text-white font-semibold'
                              : 'text-slate-400 hover:text-white hover:bg-slate-800/70'
                          }`}
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <Layers className="w-4 h-4 shrink-0" />
                            <span className="truncate">Analisa Stok</span>
                          </div>
                          {isPurchasingStockOpen ? (
                            <ChevronDown className="w-3.5 h-3.5" />
                          ) : (
                            <ChevronRight className="w-3.5 h-3.5" />
                          )}
                        </button>

                        {isPurchasingStockOpen && (
                          <div className="space-y-0.5 pl-2.5 border-l border-slate-800 ml-3 my-1">
                            {renderNavItem('purchasing_stock_overview', 'Ringkasan Stok', <Database className="w-3.5 h-3.5" />)}
                            {renderNavItem('purchasing_stock_forecast', 'Prediksi Kebutuhan', <TrendingUp className="w-3.5 h-3.5" />)}
                          </div>
                        )}
                      </div>
                    )
                  )}
                </div>
              )}
            </div>
          );
        })()}

        {/* ============================================================ */}
        {/* BAGIAN 6: FINANCE & TAX                                      */}
        {/* ============================================================ */}
        {(() => {
          const canFin = canAccess(currentUser, 'finance_tax', 'kas_bank') || canAccess(currentUser, 'finance_tax', 'faktur_pajak') || canAccess(currentUser, 'finance_tax', 'rekonsiliasi') || canAccess(currentUser, 'finance_tax', 'laba_rugi');
          if (!canFin) return null;

          return (
            <div className={`space-y-1 ${!isMinimized ? 'pt-2 border-t border-slate-800' : ''}`}>
              {isMinimized ? (
                <div className="pt-1 pb-0.5 flex justify-center" title="Finance & Tax">
                  <div className="w-6 h-px bg-slate-800" />
                </div>
              ) : (
                <div className="flex items-center justify-between px-2 mb-1">
                  <button
                    onClick={() => setIsFinanceOpen(!isFinanceOpen)}
                    className="flex items-center gap-1.5 text-[10px] font-extrabold uppercase tracking-wider text-slate-400 hover:text-amber-400 transition cursor-pointer text-left w-full"
                  >
                    <Database className="w-3.5 h-3.5 text-amber-400" />
                    <span>Finance & Tax</span>
                    <span className="ml-auto">
                      {isFinanceOpen ? <ChevronDown className="w-3.5 h-3.5 text-amber-400" /> : <ChevronRight className="w-3.5 h-3.5" />}
                    </span>
                  </button>
                </div>
              )}

              {(!isMinimized ? isFinanceOpen : true) && (
                <div className={`space-y-0.5 ${!isMinimized ? 'pl-2 border-l border-slate-800 ml-2.5 my-1' : ''}`}>
                  {renderNavItem('finance_dashboard', 'Tagihan Pelanggan', <FileText className="w-4 h-4" />)}
                </div>
              )}
            </div>
          );
        })()}

        {/* ============================================================ */}
        {/* BAGIAN 7: HR                                                */}
        {/* ============================================================ */}
        {(() => {
          const canHr = canAccess(currentUser, 'hr', 'hr_data_karyawan') || canAccess(currentUser, 'hr', 'hr_gaji_kpi') || canAccess(currentUser, 'hr', 'ga_security') || canAccess(currentUser, 'hr', 'ga_hk') || canAccess(currentUser, 'hr', 'ga_aset') || canAccess(currentUser, 'hr', 'td_video_training') || canAccess(currentUser, 'hr', 'td_training_karyawan');
          if (!canHr) return null;

          return (
            <div className={`space-y-1 ${!isMinimized ? 'pt-2 border-t border-slate-800' : ''}`}>
              {isMinimized ? (
                <div className="pt-1 pb-0.5 flex justify-center" title="Human Resources">
                  <div className="w-6 h-px bg-slate-800" />
                </div>
              ) : (
                <div className="flex items-center justify-between px-2 mb-1">
                  <button
                    onClick={() => setIsHrOpen(!isHrOpen)}
                    className="flex items-center gap-1.5 text-[10px] font-extrabold uppercase tracking-wider text-slate-400 hover:text-indigo-400 transition cursor-pointer text-left w-full"
                  >
                    <Users className="w-3.5 h-3.5 text-indigo-400" />
                    <span>Human Resources</span>
                    <span className="ml-auto">
                      {isHrOpen ? <ChevronDown className="w-3.5 h-3.5 text-indigo-400" /> : <ChevronRight className="w-3.5 h-3.5" />}
                    </span>
                  </button>
                </div>
              )}

              {(!isMinimized ? isHrOpen : true) && (
                <div className={`space-y-0.5 ${!isMinimized ? 'pl-2 border-l border-slate-800 ml-2.5 my-1' : ''}`}>
                  {canAccess(currentUser, 'hr', 'hr_data_karyawan') && (
                    <>
                      {!isMinimized && (
                        <div className="text-[9px] font-black uppercase tracking-wider text-indigo-400 px-2 pt-1">
                          1. HR
                        </div>
                      )}
                      {renderNavItem('hr_dashboard', 'Dashboard & Presensi', <Users className="w-4 h-4" />)}
                    </>
                  )}

                  {canAccess(currentUser, 'hr', 'ga_security') && (
                    <>
                      {!isMinimized && (
                        <div className="text-[9px] font-black uppercase tracking-wider text-indigo-400 px-2 pt-2 border-t border-slate-800/50">
                          2. General Affair (GA)
                        </div>
                      )}
                      {renderNavItem('ga_security', 'Security (Keamanan)', <ShieldAlert className="w-4 h-4" />)}
                      {renderNavItem('ga_hk', 'HK (Housekeeping)', <Brush className="w-4 h-4" />)}
                      {renderNavItem('ga_aset', 'Aset (Inventaris Pabrik)', <Building2 className="w-4 h-4" />)}
                    </>
                  )}

                  {canAccess(currentUser, 'hr', 'td_video_training') && (
                    <>
                      {!isMinimized && (
                        <div className="text-[9px] font-black uppercase tracking-wider text-indigo-400 px-2 pt-2 border-t border-slate-800/50">
                          3. Training &amp; Dev
                        </div>
                      )}
                      {renderNavItem('training_videos', 'Video Training SOP', <Video className="w-4 h-4" />)}
                      {renderNavItem('training_karyawan', 'Training Karyawan', <Award className="w-4 h-4" />)}
                    </>
                  )}
                </div>
              )}
            </div>
          );
        })()}

        {/* ============================================================ */}
        {/* BAGIAN 8: PENGGUNA & ARSITEKTUR                              */}
        {/* ============================================================ */}
        {(() => {
          const canSysLog = canAccess(currentUser, 'sistem_pengguna', 'log_aktivitas_sistem');
          const canSysUsers = canAccess(currentUser, 'sistem_pengguna', 'daftar_pengguna') || canAccess(currentUser, 'sistem_pengguna', 'persetujuan_akun');
          const canSysArch = canAccess(currentUser, 'sistem_pengguna', 'manajemen_hak_akses');
          const hasSys = canSysLog || canSysUsers || canSysArch;

          if (!hasSys) return null;

          return (
            <div className={`space-y-1 ${!isMinimized ? 'pt-2 border-t border-slate-800' : ''}`}>
              {isMinimized ? (
                <div className="pt-1 pb-0.5 flex justify-center" title="Sistem & Pengguna">
                  <div className="w-6 h-px bg-slate-800" />
                </div>
              ) : (
                <div className="px-2 mb-1 text-[10px] font-extrabold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Sistem & Pengguna</span>
                </div>
              )}

              <div className={`space-y-0.5 ${!isMinimized ? 'pl-2 border-l border-slate-800 ml-2.5 my-1' : ''}`}>
                {canSysLog && renderNavItem('activity_log', 'Log Aktivitas Sistem', <History className="w-4 h-4" />)}
                {canSysUsers && renderNavItem('branches', 'Cabang', <Building2 className="w-4 h-4 text-blue-400" />)}
                {canSysUsers && renderNavItem(
                  'users',
                  'Manajemen User & Approval',
                  <Users className="w-4 h-4" />,
                  pendingUsersCount > 0 ? (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500 text-slate-950">
                      {pendingUsersCount}
                    </span>
                  ) : undefined
                )}
                {canSysUsers && renderNavItem('e2e_testing', 'Pengujian E2E & Simulasi', <ShieldCheck className="w-4 h-4 text-emerald-400" />)}
                {canSysArch && renderNavItem('architecture', 'Skema SQL MySQL', <Database className="w-4 h-4" />)}
              </div>
            </div>
          );
        })()}
      </nav>

      {/* Sidebar Footer */}
      {isMinimized ? (
        <div className="p-2.5 border-t border-slate-800 bg-slate-950 flex flex-col items-center gap-2">
          <ThemeSwitcher variant="icon-only" />

          {/* Unduh APK Android Driver Mobile (Minimized) */}
          <button
            onClick={() => setIsApkModalOpen(true)}
            className="p-2 rounded-lg bg-slate-900 border border-slate-800 text-emerald-400 hover:bg-slate-800 transition cursor-pointer"
            title="Unduh Berkas APK Android (v1.0.4) untuk Portal Driver & Helper Mobile"
          >
            <Smartphone className="w-4 h-4" />
          </button>

          {/* Keluar Sesi / Logout (Minimized) */}
          <button
            onClick={() => {
              logisticsStore.logoutUser();
            }}
            className="p-2 rounded-lg bg-slate-900 border border-slate-800 text-slate-400 hover:text-rose-400 hover:border-rose-500/40 transition cursor-pointer"
            title="Keluar Sesi (Logout)"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      ) : (
        <div className="p-3 border-t border-slate-800 bg-slate-950 space-y-2">
          {/* DC Status & Time */}
          <div className="flex items-center justify-between text-[11px] text-slate-400 px-1">
            <div className="flex items-center gap-1.5">
              <Building2 className="w-3.5 h-3.5 text-amber-400" />
              <span className="font-semibold">AKK Banyuwangi DC</span>
            </div>
            <span className="font-mono text-[10px]">
              {currentTime}
            </span>
          </div>

          {/* Unduh APK Android Driver Mobile */}
          <button
            type="button"
            onClick={() => setIsApkModalOpen(true)}
            className="w-full p-2 rounded-lg bg-slate-900 border border-slate-800 hover:bg-slate-800 text-xs flex items-center justify-between gap-2 transition cursor-pointer"
            title="Unduh Berkas APK Android (v1.0.4) untuk Portal Driver & Helper Mobile"
          >
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-6 h-6 rounded bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 flex items-center justify-center shrink-0">
                <Smartphone className="w-3.5 h-3.5" />
              </div>
              <div className="text-left min-w-0">
                <div className="text-[11px] font-bold text-white truncate">
                  APK Driver v1.0.4
                </div>
              </div>
            </div>
            <Download className="w-3.5 h-3.5 text-slate-400 shrink-0" />
          </button>

          {/* Keluar atau Log Out */}
          <button
            type="button"
            onClick={() => {
              logisticsStore.logoutUser();
            }}
            className="w-full py-2 px-3 rounded-lg bg-slate-900 border border-slate-800 hover:bg-rose-500/15 hover:border-rose-500/30 text-slate-300 hover:text-rose-400 text-xs font-bold flex items-center justify-center gap-2 transition cursor-pointer"
            title="Keluar Sesi / Log Out dari Sistem PT AKK"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Keluar (Log Out)</span>
          </button>
        </div>
      )}
    </div>
  );

  return (
    <>
      {/* Mobile Top Header */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-40 h-16 bg-slate-900/95 backdrop-blur-md border-b border-slate-800 px-4 flex items-center justify-between neu-flat">
        <button
          onClick={() => setIsMobileOpen(!isMobileOpen)}
          className="p-2 rounded-xl neu-button text-slate-300 hover:text-blue-400 cursor-pointer transition active:scale-95"
          aria-label="Toggle Navigation Menu"
        >
          {isMobileOpen ? <X className="w-5 h-5 text-amber-500" /> : <Menu className="w-5 h-5" />}
        </button>
        <AkkLogo size="sm" showSubtitle={false} />
        <div className="flex items-center gap-2">
          <ThemeSwitcher variant="icon-only" />
          <button
            onClick={() => onOpenAuth('login')}
            className="p-2 rounded-xl neu-button text-amber-500 hover:bg-slate-800 cursor-pointer transition active:scale-95"
            title="Masuk / Kelola Akun"
          >
            <LogIn className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Desktop Sidebar (Fixed on lg+) */}
      <aside className={`hidden lg:block fixed inset-y-0 left-0 z-30 transition-[width] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] will-change-[width] overflow-hidden ${isMinimized ? 'w-20' : 'w-72'}`}>
        {renderSidebarContent()}
      </aside>

      {/* Mobile Backdrop & Drawer */}
      {isMobileOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div
            className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm transition-opacity duration-300"
            onClick={() => setIsMobileOpen(false)}
          />
          <div className="relative w-72 max-w-[85vw] h-full shadow-2xl z-10 animate-in slide-in-from-left duration-300 ease-out">
            {renderSidebarContent()}
          </div>
        </div>
      )}


      {/* Android APK Download Modal for Driver Mobile */}
      <AndroidApkDownloadModal
        isOpen={isApkModalOpen}
        onClose={() => setIsApkModalOpen(false)}
      />
    </>
  );
};

export default Sidebar;
