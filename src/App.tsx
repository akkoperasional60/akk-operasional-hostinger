import React, { useState, useEffect, useRef } from 'react';
import { Sidebar, NavTab } from './components/Sidebar';
import { ExecutiveDashboard } from './components/ExecutiveDashboard';
import { DashboardOverview } from './components/DashboardOverview';
import { ScheduleManagement } from './components/ScheduleManagement';
import { FleetCrewManagement } from './components/FleetCrewManagement';
import { SparePartManagement } from './components/SparePartManagement';
import { FuelEfficiencyManagement } from './components/FuelEfficiencyManagement';
import { CrewDeliveryHistoryView } from './components/CrewDeliveryHistoryView';
import { UserManagement } from './components/UserManagement';
import { ExcelTrackingEvaluator } from './components/ExcelTrackingEvaluator';
import { CustomerMapping } from './components/CustomerMapping';
import { FleetFormCenter } from './components/FleetFormCenter';
import { SupabaseSqlArchitecture } from './components/SupabaseSqlArchitecture';
import { SalesAdminHub, SalesAdminSubTab } from './components/sales/SalesAdminHub';
import { SalesKpi } from './components/sales/SalesKpi';
import { PurchasingStockAnalysis } from './components/purchasing/PurchasingStockAnalysis';
import { HelpDeskChat } from './components/HelpDeskChat';
import { AuthModal } from './components/AuthModal';
import { LoginPage } from './components/LoginPage';
import { ThemeSwitcher } from './components/ThemeSwitcher';
import { SystemActivityLog } from './components/SystemActivityLog';
import { DepartmentDashboard } from './components/DepartmentDashboard';
import { WarehouseManagementSystem, WmsSubTab } from './components/WarehouseManagementSystem';
import { MarketingDashboard } from './components/MarketingDashboard';
import { DriverMobileView } from './components/DriverMobileView';
import { DriverReportsManagement } from './components/DriverReportsManagement';
import { AnalyticsReportingModule } from './components/AnalyticsReportingModule';
import { E2ETesterModule } from './components/E2ETesterModule';
import { NetworkStatusBanner } from './components/NetworkStatusBanner';
import { RealtimeShipmentListener } from './components/RealtimeShipmentListener';
import { RetailStore } from './types';
import { logisticsStore } from './services/store';
import { ShieldCheck, Clock, AlertTriangle, LogIn, ChevronLeft, ChevronRight, Bell, Smartphone, Lock } from 'lucide-react';
import { useToast } from './context/ToastContext';
import { canAccess, getDefaultTabForRole } from './utils/rbac';
import { useRoleAccess } from './hooks/useRoleAccess';
import { getTabPath, normalizePathname, resolveTabFromUrl } from './utils/navigationRoutes';

const FLEET_MANAGEMENT_TABS: NavTab[] = [
  'schedules',
  'fleets',
  'spareparts',
  'fuel_efficiency',
  'fleet_forms'
];

const LiveClockBadge: React.FC = () => {
  const [time, setTime] = useState(() =>
    new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) + ' WIB'
  );

  useEffect(() => {
    const updateTime = () => {
      setTime(
        new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) + ' WIB'
      );
    };
    const timer = setInterval(updateTime, 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="hidden xl:flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-slate-300 font-mono text-xs tabular-nums">
      <Clock className="w-3.5 h-3.5 text-amber-400" />
      <span className="font-semibold">{time}</span>
    </div>
  );
};

export default function App() {
  const { user: currentUser, canManageFleet, isDriver, isAdmin } = useRoleAccess();

  const initialRequestedTabRef = useRef<NavTab | null>((() => {
    try {
      return resolveTabFromUrl(window.location).tab;
    } catch {
      return null;
    }
  })());

  const [currentTab, setCurrentTab] = useState<NavTab>(() => {
    try {
      const resolved = resolveTabFromUrl(window.location);
      if (resolved.tab) return resolved.tab;
      if (typeof navigator !== 'undefined' && navigator.userAgent && navigator.userAgent.includes('AKKDriverMobile')) {
        return 'driver_portal';
      }
    } catch {}
    return 'dashboard';
  });
  const [preselectedStore, setPreselectedStore] = useState<RetailStore | null>(null);
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [authDefaultTab, setAuthDefaultTab] = useState<'login' | 'register'>('login');
  const [isSidebarMinimized, setIsSidebarMinimized] = useState<boolean>(() => {
    try {
      return localStorage.getItem('akk_sidebar_minimized') === 'true';
    } catch {
      return false;
    }
  });

  const { notifications, setOnNavigateCallback, setIsDrawerOpen } = useToast();
  const unreadCount = notifications.filter(n => !n.read).length;

  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [isAuthChecking, setIsAuthChecking] = useState<boolean>(true);

  useEffect(() => {
    let active = true;
    void logisticsStore.restoreServerSession().finally(() => {
      if (active) {
        setIsAuthenticated(logisticsStore.isAuthenticated());
        setIsAuthChecking(false);
      }
    });

    const unsubscribe = logisticsStore.subscribe(() => {
      if (active) setIsAuthenticated(logisticsStore.isAuthenticated());
    });
    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    setOnNavigateCallback((tab) => setCurrentTab(tab as NavTab));
  }, [setOnNavigateCallback]);

  const toggleSidebar = () => {
    setIsSidebarMinimized(prev => {
      const next = !prev;
      try {
        localStorage.setItem('akk_sidebar_minimized', String(next));
      } catch {}
      return next;
    });
  };

  const prevUserRef = useRef<{ id: string; role: string }>({
    id: currentUser.id,
    role: currentUser.role
  });

  useEffect(() => {
    if (isAuthChecking || !isAuthenticated) return;

    const userOrRoleChanged =
      prevUserRef.current.id !== currentUser.id ||
      prevUserRef.current.role !== currentUser.role;

    if (userOrRoleChanged) {
      prevUserRef.current = { id: currentUser.id, role: currentUser.role };
      const requestedTab = initialRequestedTabRef.current;
      initialRequestedTabRef.current = null;
      if (requestedTab && canAccess(currentUser, requestedTab)) {
        setCurrentTab(requestedTab);
        return;
      }
      setCurrentTab(getDefaultTabForRole(currentUser.role) as NavTab);
      return;
    }

    const isFleetTabBlocked = FLEET_MANAGEMENT_TABS.includes(currentTab) && !canManageFleet(currentUser) && !canAccess(currentUser, currentTab);
    const isAdminTabBlocked = currentTab === 'users' && !isAdmin(currentUser) && !canAccess(currentUser, 'users');

    if (isFleetTabBlocked || isAdminTabBlocked || !canAccess(currentUser, currentTab)) {
      setCurrentTab(getDefaultTabForRole(currentUser.role) as NavTab);
    }
  }, [currentUser, currentTab, canManageFleet, isDriver, isAdmin, isAuthChecking, isAuthenticated]);

  const getTabTitle = (tab: NavTab): string => {
    switch (tab) {
      case 'dashboard': return 'Dashboard Eksekutif (Rangkuman Operasional & Penjualan)';
      case 'driver_portal': return 'Portal Driver Mobile (Tugas Pengiriman & Status Supir)';
      case 'driver_reports': return 'Laporan & Kendala Kiriman Kru (Driver & Helper)';
      case 'analytics_reports': return 'Laporan Analitik Performa Armada & Kru';
      case 'operational_dashboard': return 'Dashboard Logistik & Operasional';
      case 'schedules': return 'Manajemen Jadwal Pengiriman & Muat';
      case 'fleets': return 'Manajemen Armada & Kru Supir';
      case 'spareparts': return 'Manajemen Stok & Pemakaian Sparepart';
      case 'fuel_efficiency': return 'Efisiensi Bahan Bakar (BBM) & Konsumsi Armada';
      case 'crew_history': return 'Riwayat Pengiriman & Audit SLA Kru';
      case 'tracking_eval': return 'Audit Evaluasi Muat & Bongkar (Excel)';
      case 'fleet_forms': return 'Formulir Operasional Armada';
      case 'sales_dashboard': return 'Sales Hub: Dashboard & SLA Penjualan';
      case 'sales_activities': return 'Sales Hub: Aktivitas Harian Admin';
      case 'sales_schedules': return 'Sales Hub: Jadwal Produksi & Kirim';
      case 'sales_loading_duration': return 'Sales Hub: Durasi Muat Real-Time';
      case 'sales_skill_matrix': return 'Sales Hub: Matriks Keterampilan Admin';
      case 'sales_jobdesk': return 'Sales Hub: Konfigurasi SOP & Jobdesk';
      case 'sales_kpi': return 'Sales Hub: Data Kinerja & KPI Penjualan';
      case 'sales_kpi_individual': return 'KPI Individu Masing-masing Admin Penjualan';
      case 'sales_kpi_fines': return 'Data Akumulasi Denda Checker';
      case 'sales_kpi_nusantara': return 'Persentase Kiriman Nusantara';
      case 'sales_kpi_omset': return 'Omset Admin Penjualan';
      case 'hr_dashboard': return 'Dashboard Departemen HR (Presensi & Master Staff)';
      case 'ga_security': return 'General Affair (GA): Security & Pos Keamanan Pabrik';
      case 'ga_hk': return 'General Affair (GA): Housekeeping (HK) & Kebersihan 5R';
      case 'ga_aset': return 'General Affair (GA): Manajemen Aset & Fasilitas Pabrik';
      case 'training_videos': return 'Training & Development: Video Pembelajaran & SOP';
      case 'training_karyawan': return 'Training & Development: Pelatihan & Sertifikasi Kru';
      case 'finance_dashboard': return 'Dashboard Departemen Finance & Tax';
      case 'warehouse_dashboard': return 'WMS: Ringkasan & Control Tower Gudang';
      case 'warehouse_inventory': return 'WMS: Master SKU & Stok Bin Gudang';
      case 'warehouse_inbound': return 'WMS: Inbound (Receiving & Putaway)';
      case 'warehouse_outbound': return 'WMS: Outbound (Picking & Ceklis Muat)';
      case 'warehouse_scanner': return 'WMS: Pemindaian Foto Barang & Sinkronisasi Inventaris';
      case 'warehouse_slotting': return 'WMS: Denah Rak & Kapasitas Zona Gudang';
      case 'warehouse_opname': return 'WMS: Stok Opname & Kartu Stok Digital';
      case 'purchasing_dashboard': return 'Dashboard Departemen Adm. Pembelian';
      case 'purchasing_stock_overview': return 'Analisa Stok: Ringkasan & Status';
      case 'purchasing_stock_forecast': return 'Analisa Stok: Prediksi Kebutuhan';
      case 'marketing_online': return 'Departemen Marketing: Prospek & Proaktif Online';
      case 'marketing_offline': return 'Departemen Marketing: Canvasing & Kunjungan Offline';
      case 'activity_log': return 'Audit Log & Aktivitas Sistem';
      case 'customer_map': return 'Pemetaan Toko Retail & Mitra';
      case 'users': return 'Approval & Manajemen Pengguna';
      case 'architecture': return 'Arsitektur Database Hostinger MySQL';
      case 'e2e_testing': return 'Pusat Pengujian E2E & Simulasi Akun Pengguna';
      default: return 'Sistem Operasional AKK';
    }
  };

  // Sinkronisasi URL Browser (/login, /manajemen-user, /dashboard, dll.) & Judul Tab
  useEffect(() => {
    if (isAuthChecking) return;

    try {
      const currentPath = normalizePathname(window.location.pathname);

      if (!isAuthenticated) {
        document.title = 'Login Portal | AKK Operasional - PT Anugrah Kemasan Kreatif';
        const resolved = resolveTabFromUrl(window.location);
        if (resolved.tab) {
          initialRequestedTabRef.current = resolved.tab;
        }
        if (currentPath !== '/login') {
          window.history.replaceState({ tab: 'login' }, '', '/login');
        }
        return;
      }

      const activeTitle = getTabTitle(currentTab);
      document.title = `${activeTitle} | AKK Operasional - PT Anugrah Kemasan Kreatif`;

      const targetPath = getTabPath(currentTab);
      if (currentPath !== targetPath) {
        if (currentPath === '/' || currentPath === '/login') {
          window.history.replaceState({ tab: currentTab }, '', targetPath);
        } else {
          window.history.pushState({ tab: currentTab }, '', targetPath);
        }
      }
    } catch {}
  }, [currentTab, isAuthenticated, isAuthChecking]);

  // Dukungan tombol Back / Forward pada browser
  useEffect(() => {
    const handlePopState = () => {
      try {
        const resolved = resolveTabFromUrl(window.location);
        if (isAuthenticated && resolved.tab && canAccess(currentUser, resolved.tab)) {
          setCurrentTab(resolved.tab);
        }
      } catch {}
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [isAuthenticated, currentUser]);

  const handleScheduleForStore = (store: RetailStore) => {
    setPreselectedStore(store);
    setCurrentTab('schedules');
  };

  const handleOpenAuth = (defaultTab: 'login' | 'register' = 'login') => {
    setAuthDefaultTab(defaultTab);
    setIsAuthOpen(true);
  };


  if (isAuthChecking) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-200 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-center">
          <ShieldCheck className="w-9 h-9 text-emerald-400 animate-pulse" />
          <div className="text-sm font-semibold">Memverifikasi sesi Hostinger...</div>
          <div className="text-xs text-slate-500">Autentikasi diperiksa langsung ke backend sebelum aplikasi dibuka.</div>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <LoginPage
        onLoginSuccess={(loggedInUser) => {
          setIsAuthenticated(true);
          const requestedTab = initialRequestedTabRef.current;
          initialRequestedTabRef.current = null;
          if (requestedTab && canAccess(loggedInUser, requestedTab)) {
            setCurrentTab(requestedTab);
            return;
          }
          const defaultTab = getDefaultTabForRole(loggedInUser.role) as NavTab;
          setCurrentTab(defaultTab);
        }}
      />
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex antialiased selection:bg-amber-500 selection:text-slate-950">
      {/* Network Connectivity & Offline Real-Time Tracking Warning Banner */}
      <NetworkStatusBanner />
      <RealtimeShipmentListener />

      {/* Sidebar Navigation - Left Rail (Fixed on Desktop, Drawer on Mobile) */}
      <Sidebar
        currentTab={currentTab}
        onSelectTab={setCurrentTab}
        onOpenAuth={handleOpenAuth}
        isMinimized={isSidebarMinimized}
        onToggleMinimize={toggleSidebar}
      />

      {/* Main Content Area with smooth offset transition for Sidebar */}
      <div className={`flex-1 flex flex-col min-h-screen w-full transition-[padding] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] will-change-[padding] ${isSidebarMinimized ? 'lg:pl-20' : 'lg:pl-72'}`}>
        {/* Desktop Top Header Bar with High-Contrast Readability */}
        <header className="hidden lg:flex sticky top-0 z-20 h-16 bg-slate-900 border-b border-slate-800 px-6 lg:px-8 items-center justify-between shadow-xs">
          <div className="flex items-center gap-3 min-w-0">
            <div className="min-w-0">
              <div className="text-[11px] font-medium text-slate-400 flex items-center gap-1.5">
                <span className="text-amber-400 font-semibold">PT Anugrah Kemasan Kreatif</span>
                <span>&middot;</span>
                <span>Banyuwangi Hub</span>
              </div>
              <h1 className="text-sm sm:text-base font-bold text-white tracking-tight truncate">
                {getTabTitle(currentTab)}
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            {/* Quick Driver Mobile Mode Switcher */}
            <button
              onClick={() =>
                setCurrentTab(
                  currentTab === 'driver_portal'
                    ? isAdmin()
                      ? 'dashboard'
                      : 'operational_dashboard'
                    : 'driver_portal'
                )
              }
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer border ${
                currentTab === 'driver_portal'
                  ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                  : 'bg-slate-950 text-slate-200 border-slate-800 hover:bg-slate-800'
              }`}
              title="Buka Tampilan Khusus Mobile Supir (Driver Portal)"
            >
              <Smartphone className={`w-3.5 h-3.5 ${currentTab === 'driver_portal' ? 'text-white' : 'text-blue-400'}`} />
              <span>{currentTab === 'driver_portal' ? 'Portal Admin' : 'Mode Driver Mobile'}</span>
            </button>

            {/* Clean Icon-Only Theme Switcher */}
            <ThemeSwitcher variant="icon-only" />

            {/* Live Time */}
            <LiveClockBadge />

            {/* Notification Bell Button */}
            <button
              onClick={() => setIsDrawerOpen(true)}
              className="relative p-2 rounded-lg border border-slate-800 bg-slate-950 text-slate-200 hover:bg-slate-800 transition cursor-pointer flex items-center justify-center"
              title="Pusat Notifikasi Admin"
            >
              <Bell className="w-4 h-4 text-amber-400" />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 flex h-4 min-w-4 px-1 items-center justify-center rounded-full bg-blue-600 text-[9px] font-bold text-white shadow-xs">
                  {unreadCount}
                </span>
              )}
            </button>

            {/* Quick Profile Pill */}
            <button
              onClick={() => handleOpenAuth('login')}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-slate-800 bg-slate-950 text-xs text-white hover:bg-slate-800 transition cursor-pointer"
              title="Ganti Akun atau Kelola Sesi"
            >
              <div className="w-5 h-5 rounded-full bg-blue-600 text-white font-bold text-[10px] flex items-center justify-center shrink-0">
                {currentUser.fullName ? currentUser.fullName.charAt(0).toUpperCase() : 'U'}
              </div>
              <span className="font-bold max-w-[120px] truncate text-white">
                {currentUser.fullName || 'Pengguna'}
              </span>
            </button>
          </div>
        </header>

        {/* Pending Approval Top Banner Alert if current user is pending */}
        {currentUser.status === 'pending' && (
          <div className="bg-amber-500/15 border-b border-amber-500/30 px-4 py-2.5 text-xs text-amber-200 flex flex-wrap items-center justify-between gap-2 mt-14 lg:mt-0">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-amber-400 shrink-0 animate-pulse" />
              <span>
                <strong>Perhatian:</strong> Akun Anda (<em>{currentUser.fullName}</em>) saat ini berstatus <strong>Menunggu Persetujuan (Pending Approval)</strong> dari Manager Operasional AKK.
              </span>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => {
                  logisticsStore.approveUser(currentUser.id);
                }}
                className="px-2.5 py-1 rounded bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-[11px] shadow transition cursor-pointer"
              >
                Simulasi: Setujui Sekarang
              </button>
              <button
                onClick={() => setCurrentTab('users')}
                className="underline hover:text-white text-[11px]"
              >
                Lihat Menu Approval &rarr;
              </button>
            </div>
          </div>
        )}

        <main className={`flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 ${
          currentUser.status === 'pending' ? 'pt-4' : 'pt-18 lg:pt-6'
        }`}>
          {currentTab === 'dashboard' && (
            isAdmin() || canAccess(currentUser, 'dashboard') ? (
              <ExecutiveDashboard onNavigate={(tab) => setCurrentTab(tab as NavTab)} />
            ) : (
              <div className="max-w-2xl mx-auto mt-16 p-8 rounded-2xl bg-slate-900 border border-amber-500/30 text-center space-y-6 shadow-2xl">
                <div className="w-16 h-16 mx-auto rounded-full bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
                  <Lock className="w-8 h-8" />
                </div>
                <div className="space-y-2">
                  <h2 className="text-xl font-bold text-amber-300">Akses Terbatas: Dashboard Eksekutif</h2>
                  <p className="text-sm text-slate-300">
                    Akun Anda (<span className="text-amber-400 font-semibold">{currentUser.fullName}</span> / <span className="text-cyan-400">{currentUser.role}</span>) tidak memiliki izin untuk melihat Dashboard Eksekutif.
                    Fitur ini dikhususkan untuk manajemen eksekutif dan akun dengan hak akses khusus yang dikonfigurasi melalui Manajemen Hak Akses.
                  </p>
                </div>
                <div className="pt-4 flex justify-center gap-3">
                  <button
                    onClick={() => setCurrentTab(isDriver() ? 'driver_portal' : 'operational_dashboard')}
                    className="px-5 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-semibold text-xs transition cursor-pointer shadow-[0_0_12px_rgba(6,182,212,0.4)]"
                  >
                    {isDriver() ? 'Ke Portal Driver Mobile \u2192' : 'Ke Dashboard Operasional \u2192'}
                  </button>
                  {isAdmin() && (
                    <button
                      onClick={() => setCurrentTab('users')}
                      className="px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs transition cursor-pointer border border-slate-700"
                    >
                      Buka Manajemen Hak Akses
                    </button>
                  )}
                </div>
              </div>
            )
          )}

          {currentTab === 'operational_dashboard' && (
            <DashboardOverview onNavigate={(tab) => setCurrentTab(tab as NavTab)} />
          )}

          {currentTab === 'driver_reports' && (
            <DriverReportsManagement />
          )}

          {currentTab === 'analytics_reports' && (
            <AnalyticsReportingModule />
          )}

          {currentTab === 'schedules' && (canManageFleet() || canAccess(currentUser, 'schedules')) && (
            <ScheduleManagement
              preselectedStore={preselectedStore}
              onClearPreselectedStore={() => setPreselectedStore(null)}
            />
          )}

          {currentTab === 'fleets' && (canManageFleet() || canAccess(currentUser, 'fleets')) && (
            <FleetCrewManagement
              initialTab="fleets"
              onNavigateToSpareParts={() => setCurrentTab('spareparts')}
              onNavigateToFuelEfficiency={() => setCurrentTab('fuel_efficiency')}
            />
          )}

          {currentTab === 'spareparts' && (canManageFleet() || canAccess(currentUser, 'spareparts')) && (
            <SparePartManagement onNavigateToFleets={() => setCurrentTab('fleets')} />
          )}

          {currentTab === 'fuel_efficiency' && (canManageFleet() || canAccess(currentUser, 'fuel_efficiency')) && (
            <FuelEfficiencyManagement onNavigateToFleets={() => setCurrentTab('fleets')} />
          )}

          {currentTab === 'crew_history' && (
            <FleetCrewManagement
              initialTab="crews"
              initialSubTab="history"
            />
          )}

          {currentTab === 'users' && (isAdmin() || canAccess(currentUser, 'users')) && (
            <UserManagement
              onNavigateToE2E={() => setCurrentTab('e2e_testing')}
            />
          )}

          {currentTab === 'tracking_eval' && (
            <ExcelTrackingEvaluator />
          )}

          {currentTab === 'customer_map' && (
            <CustomerMapping onScheduleForStore={handleScheduleForStore} />
          )}

          {currentTab === 'fleet_forms' && (canManageFleet() || canAccess(currentUser, 'fleet_forms')) && (
            <FleetFormCenter />
          )}

          {currentTab === 'sales_dashboard' && (
            <SalesAdminHub
              activeSubTab="activities"
              onSelectSubTab={(sub) => setCurrentTab(('sales_' + sub) as NavTab)}
            />
          )}

          {currentTab === 'sales_activities' && (
            <SalesAdminHub
              activeSubTab="activities"
              onSelectSubTab={(sub) => setCurrentTab(('sales_' + sub) as NavTab)}
            />
          )}

          {currentTab === 'sales_schedules' && (
            <SalesAdminHub
              activeSubTab="schedules"
              onSelectSubTab={(sub) => setCurrentTab(('sales_' + sub) as NavTab)}
            />
          )}

          {currentTab === 'sales_loading_duration' && (
            <SalesAdminHub
              activeSubTab="loading_duration"
              onSelectSubTab={(sub) => setCurrentTab(('sales_' + sub) as NavTab)}
            />
          )}

          {currentTab === 'sales_skill_matrix' && (
            <SalesAdminHub
              activeSubTab="skill_matrix"
              onSelectSubTab={(sub) => setCurrentTab(('sales_' + sub) as NavTab)}
            />
          )}

          {currentTab === 'sales_jobdesk' && (
            <SalesAdminHub
              activeSubTab="jobdesk"
              onSelectSubTab={(sub) => setCurrentTab(('sales_' + sub) as NavTab)}
            />
          )}

          {(currentTab === 'sales_kpi' || (currentTab && currentTab.startsWith('sales_kpi_'))) && (
            <SalesKpi defaultTab={currentTab} onChangeTab={(tab) => setCurrentTab(tab as NavTab)} />
          )}

          {currentTab === 'activity_log' && (
            <SystemActivityLog />
          )}

          {(currentTab === 'hr_dashboard' || currentTab === 'ga_security' || currentTab === 'ga_hk' || currentTab === 'ga_aset' || currentTab === 'training_videos' || currentTab === 'training_karyawan') && (
            <DepartmentDashboard 
              dashboardType="hr" 
              initialHrTab={
                currentTab === 'ga_security' ? 'ga_security' :
                currentTab === 'ga_hk' ? 'ga_hk' :
                currentTab === 'ga_aset' ? 'ga_aset' :
                currentTab === 'training_videos' ? 'training_videos' :
                currentTab === 'training_karyawan' ? 'training_karyawan' : 'hr_core'
              } 
            />
          )}
          {currentTab === 'finance_dashboard' && (
            <DepartmentDashboard dashboardType="finance" />
          )}
          {(currentTab === 'warehouse_dashboard' ||
            currentTab === 'warehouse_inventory' ||
            currentTab === 'warehouse_inbound' ||
            currentTab === 'warehouse_outbound' ||
            currentTab === 'warehouse_scanner' ||
            currentTab === 'warehouse_slotting' ||
            currentTab === 'warehouse_opname') && (
            <WarehouseManagementSystem
              initialTab={
                currentTab === 'warehouse_inventory'
                  ? 'inventory'
                  : currentTab === 'warehouse_inbound'
                  ? 'inbound'
                  : currentTab === 'warehouse_outbound'
                  ? 'outbound'
                  : currentTab === 'warehouse_scanner'
                  ? 'scanner'
                  : currentTab === 'warehouse_slotting'
                  ? 'slotting'
                  : currentTab === 'warehouse_opname'
                  ? 'opname'
                  : 'overview'
              }
              onNavigateTab={(tab: WmsSubTab) => {
                const map: Record<WmsSubTab, NavTab> = {
                  overview: 'warehouse_dashboard',
                  inventory: 'warehouse_inventory',
                  inbound: 'warehouse_inbound',
                  outbound: 'warehouse_outbound',
                  scanner: 'warehouse_scanner',
                  slotting: 'warehouse_slotting',
                  opname: 'warehouse_opname'
                };
                setCurrentTab(map[tab] || 'warehouse_dashboard');
              }}
            />
          )}
          {currentTab === 'purchasing_dashboard' && (
            <DepartmentDashboard dashboardType="purchasing" />
          )}
          {currentTab === 'purchasing_stock_overview' && (
            <PurchasingStockAnalysis tab="overview" />
          )}
          {currentTab === 'purchasing_stock_forecast' && (
            <PurchasingStockAnalysis tab="forecast" />
          )}

          {(currentTab === 'marketing_online' || currentTab === 'marketing_offline') && (
            <MarketingDashboard activeTab={currentTab} />
          )}

          {currentTab === 'driver_portal' && (
            <DriverMobileView
              currentUser={currentUser}
              initialDriverId={logisticsStore.getActiveDriverCrew()?.id}
              onBackToPortal={() => setCurrentTab('dashboard')}
            />
          )}

          {currentTab === 'architecture' && (
            <SupabaseSqlArchitecture />
          )}

          {currentTab === 'e2e_testing' && (
            <E2ETesterModule onNavigate={(tab) => setCurrentTab(tab)} />
          )}
        </main>

        {/* Enterprise AKK Footer */}
        <footer className="bg-slate-950 border-t border-slate-900 py-4 text-slate-500 text-xs text-center mt-auto">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-2">
            <div className="text-slate-400">
              <span>&copy; {new Date().getFullYear()} PT Anugrah Kemasan Kreatif &middot; Sistem Distribusi &amp; Manajemen Operasional</span>
            </div>
            <div className="flex items-center gap-4 text-slate-500 text-[11px]">
              <span>Banyuwangi Distribution Hub</span>
            </div>
          </div>
        </footer>
      </div>

      {/* Authentication Modal (Login & Register) */}
      <AuthModal
        isOpen={isAuthOpen}
        onClose={() => setIsAuthOpen(false)}
        defaultTab={authDefaultTab}
      />
      <HelpDeskChat activeTab={currentTab} user={currentUser} />
    </div>
  );
}
