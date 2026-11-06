import React, { useState, useEffect, useRef, useCallback, startTransition } from 'react';
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
import { MasterCabang } from './components/MasterCabang';
import { NetworkStatusBanner } from './components/NetworkStatusBanner';
import { RealtimeShipmentListener } from './components/RealtimeShipmentListener';
import { ThreeDLogoLoader } from './components/ThreeDLogoLoader';
import { RetailStore } from './types';
import { logisticsStore } from './services/store';
import { branchStore, BranchRecord } from './services/branchStore';
import { ShieldCheck, Clock, AlertTriangle, LogIn, ChevronLeft, ChevronRight, ChevronDown, Calendar, Bell, Smartphone, Lock, Building2 } from 'lucide-react';
import { useToast } from './context/ToastContext';
import { canAccess, getDefaultTabForRole, getFirstAccessibleTabForUser } from './utils/rbac';
import { useRoleAccess } from './hooks/useRoleAccess';
import { getTabPath, normalizePathname, resolveTabFromUrl } from './utils/navigationRoutes';
import { ReadOnlyModuleBoundary } from './components/ReadOnlyModuleBoundary';
import { databaseBarangService } from './services/databaseBarangService';

const FLEET_MANAGEMENT_TABS: NavTab[] = [
  'schedules',
  'fleets',
  'spareparts',
  'fuel_efficiency',
  'fleet_forms'
];

const LiveClockBadge: React.FC = () => {
  const [now, setNow] = useState<Date>(new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setNow(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const dateStr = now.toLocaleDateString('id-ID', {
    weekday: 'long',
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  });

  const timeStr = now.toLocaleTimeString('id-ID', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  }).replace(/\./g, ':');

  return (
    <div className="hidden xl:flex items-center gap-2.5 px-3.5 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 text-slate-700 dark:text-slate-200 text-xs font-semibold shadow-2xs font-mono">
      <div className="flex items-center gap-2">
        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
        <span className="font-sans font-medium text-slate-600 dark:text-slate-300">{dateStr}</span>
        <span className="text-slate-300 dark:text-slate-700">&bull;</span>
        <span className="font-bold text-slate-900 dark:text-white tracking-wider">{timeStr} WIB</span>
      </div>
      <Clock className="w-3.5 h-3.5 text-blue-500 ml-0.5" />
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

  const [activeNavTab, setActiveNavTab] = useState<NavTab>(currentTab);

  const selectTabImmediate = useCallback((nextTab: NavTab) => {
    setActiveNavTab(nextTab);
    startTransition(() => {
      setCurrentTab(nextTab);
    });
  }, []);

  useEffect(() => {
    setActiveNavTab(currentTab);
  }, [currentTab]);

  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => logisticsStore.isAuthenticated());
  const [isAuthChecking, setIsAuthChecking] = useState<boolean>(() => !logisticsStore.isAuthenticated());
  const [branches, setBranches] = useState<BranchRecord[]>(() => branchStore.getActiveBranches());
  const [selectedOriginBranchId, setSelectedOriginBranchId] = useState<string>(() =>
    branchStore.getSelectedOriginBranchId()
  );

  useEffect(() => {
    const syncBranches = () => {
      setBranches(branchStore.getActiveBranches());
      setSelectedOriginBranchId(branchStore.getSelectedOriginBranchId());
    };
    const unsubscribeBranch = branchStore.subscribe(syncBranches);
    return () => unsubscribeBranch();
  }, []);

  useEffect(() => {
    let active = true;
    const authTimeout = setTimeout(() => {
      if (active && isAuthChecking) {
        setIsAuthChecking(false);
      }
    }, 3000);

    void logisticsStore.restoreServerSession().catch(() => {}).finally(() => {
      if (active) {
        clearTimeout(authTimeout);
        setIsAuthenticated(logisticsStore.isAuthenticated());
        setIsAuthChecking(false);
      }
    });

    const unsubscribe = logisticsStore.subscribe(() => {
      if (active) {
        const nextAuth = logisticsStore.isAuthenticated();
        setIsAuthenticated(prev => (prev === nextAuth ? prev : nextAuth));
      }
    });
    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    setOnNavigateCallback((tab) => selectTabImmediate(tab as NavTab));
  }, [setOnNavigateCallback, selectTabImmediate]);

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
    void databaseBarangService.ensureHydrated();
  }, []);

  useEffect(() => {
    if (isAuthChecking || !isAuthenticated) return;

    // Safety guard: Pending users stay on their current requested tab with warning banner, avoid infinite redirect loop
    if (currentUser.status === 'pending') return;

    const userChanged = prevUserRef.current.id !== currentUser.id;

    if (userChanged) {
      prevUserRef.current = { id: currentUser.id, role: currentUser.role };
      const requestedTab = initialRequestedTabRef.current;
      initialRequestedTabRef.current = null;
      if (requestedTab && canAccess(currentUser, requestedTab)) {
        setCurrentTab(requestedTab);
        return;
      }
      const defaultTab = getFirstAccessibleTabForUser(currentUser) as NavTab;
      if (currentTab !== defaultTab) {
        setCurrentTab(defaultTab);
      }
      return;
    }

    const isFleetTabBlocked = FLEET_MANAGEMENT_TABS.includes(currentTab) && !canManageFleet(currentUser) && !canAccess(currentUser, currentTab);
    const isAdminTabBlocked = currentTab === 'users' && !isAdmin(currentUser) && !canAccess(currentUser, 'users');

    if (isFleetTabBlocked || isAdminTabBlocked || !canAccess(currentUser, currentTab)) {
      const defaultTab = getFirstAccessibleTabForUser(currentUser) as NavTab;
      if (currentTab !== defaultTab) {
        setCurrentTab(defaultTab);
      }
    }
  }, [currentUser, currentTab, canManageFleet, isDriver, isAdmin, isAuthChecking, isAuthenticated]);

  const getTabTitle = (tab: NavTab): string => {
    switch (tab) {
      case 'dashboard': return 'Dashboard Eksekutif';
      case 'driver_portal': return 'Portal Driver Mobile (Tugas Pengiriman & Status Supir)';
      case 'driver_reports': return 'Laporan & Kendala Kiriman Kru (Driver & Helper)';
      case 'analytics_reports': return 'Dashboard Logistik & Pengiriman';
      case 'operational_dashboard': return 'Dashboard Logistik & Pengiriman';
      case 'schedules': return 'Manajemen Jadwal Pengiriman & Muat';
      case 'fleets': return 'Manajemen Armada & Kru Supir';
      case 'spareparts': return 'Manajemen Stok & Pemakaian Sparepart';
      case 'fuel_efficiency': return 'Efisiensi Bahan Bakar (BBM) & Konsumsi Armada';
      case 'crew_history': return 'Riwayat Pengiriman & Audit SLA Kru';
      case 'tracking_eval': return 'Audit Evaluasi Muat & Bongkar (Excel)';
      case 'fleet_forms': return 'Formulir Pengadaan Armada';
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
      case 'finance_dashboard': return 'Finance & Tax: Tagihan Pelanggan Belum Terlunasi';
      case 'warehouse_dashboard': return 'WMS: Ringkasan & Control Tower Gudang';
      case 'warehouse_inventory': return 'WMS: Master SKU & Stok Bin Gudang';
      case 'warehouse_inbound': return 'WMS: Inbound (Receiving & Putaway)';
      case 'warehouse_outbound': return 'WMS: Outbound (Picking & Muat)';
      case 'warehouse_scanner': return 'WMS: Database Barang (Nomor Barang, Keterangan, Satuan & Dokumentasi)';
      case 'warehouse_slotting': return 'WMS: Denah Rak & Kapasitas Zona Gudang';
      case 'warehouse_opname': return 'WMS: Stok Opname & Kartu Stok Digital';
      case 'warehouse_cubication': return 'WMS: Kubikasi Barang & Berat Barang';
      case 'warehouse_fleet_cubication': return 'WMS: Simulasi Kubikasi Box Armada & Item Barang';
      case 'purchasing_dashboard': return 'Dashboard Departemen Adm. Pembelian';
      case 'purchasing_stock_overview': return 'Analisa Stok: Ringkasan & Status';
      case 'purchasing_stock_forecast': return 'Analisa Stok: Prediksi Kebutuhan';
      case 'marketing_online': return 'Departemen Marketing: Prospek & Proaktif Online';
      case 'marketing_offline': return 'Departemen Marketing: Laporan Kunjungan & Laporan Penjualan';
      case 'activity_log': return 'Audit Log & Aktivitas Sistem';
      case 'customer_map': return 'Pemetaan Toko Retail & Mitra';
      case 'branches': return 'Master Cabang (Multi-Store)';
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

      document.title = 'AKK Operasional - PT Anugrah Kemasan Kreatif';

      if (!isAuthenticated) {
        const resolved = resolveTabFromUrl(window.location);
        if (resolved.tab) {
          initialRequestedTabRef.current = resolved.tab;
        }
        if (currentPath !== '/login') {
          window.history.replaceState({ tab: 'login' }, '', '/login');
        }
        return;
      }

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
      <div className="min-h-screen bg-slate-950 text-slate-200 flex items-center justify-center p-4 selection:bg-amber-500 selection:text-slate-950">
        <ThreeDLogoLoader
          statusText="Memverifikasi sesi Hostinger..."
          subText="Autentikasi diperiksa langsung ke backend sebelum aplikasi dibuka."
        />
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
          const defaultTab = getFirstAccessibleTabForUser(loggedInUser) as NavTab;
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
        currentTab={activeNavTab}
        onSelectTab={selectTabImmediate}
        onOpenAuth={handleOpenAuth}
        isMinimized={isSidebarMinimized}
        onToggleMinimize={toggleSidebar}
      />

      {/* Main Content Area with smooth offset transition for Sidebar */}
      <div className={`flex-1 flex flex-col min-h-screen w-full transition-[padding] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] will-change-[padding] ${isSidebarMinimized ? 'lg:pl-20' : 'lg:pl-72'}`}>
        {/* Desktop Top Header Bar Matching Modern SaaS Layout */}
        <header className="hidden lg:flex sticky top-0 z-[1050] h-20 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-slate-100 dark:border-slate-800 px-6 lg:px-8 items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <div className="min-w-0">
              <h1 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white tracking-tight truncate">
                Selamat datang kembali, {currentUser.fullName ? currentUser.fullName.split(' ')[0] : 'Admin'}!
              </h1>
              <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1.5 mt-0.5 truncate">
                <span>Berikut ringkasan bisnis &amp; operasional hari ini</span>
                <span>&middot;</span>
                <span className="font-medium text-slate-700 dark:text-slate-300 truncate">
                  {getTabTitle(activeNavTab)}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            {/* Date Range Pill */}
            <LiveClockBadge />

            {/* Quick Driver Mobile Mode Switcher */}
            <button
              onClick={() =>
                selectTabImmediate(
                  activeNavTab === 'driver_portal'
                    ? isAdmin()
                      ? 'dashboard'
                      : 'operational_dashboard'
                    : 'driver_portal'
                )
              }
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition cursor-pointer border ${
                currentTab === 'driver_portal'
                  ? 'bg-blue-600 text-white border-blue-600 shadow-2xs'
                  : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 border-slate-200/90 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800'
              }`}
              title="Buka Tampilan Khusus Mobile Supir (Driver Portal)"
            >
              <Smartphone className={`w-3.5 h-3.5 ${currentTab === 'driver_portal' ? 'text-white' : 'text-blue-600 dark:text-blue-400'}`} />
              <span>{currentTab === 'driver_portal' ? 'Portal Admin' : 'Driver Mobile'}</span>
            </button>

            {/* Clean Icon-Only Theme Switcher */}
            <ThemeSwitcher variant="icon-only" />

            {/* Notification Bell Button */}
            <button
              onClick={() => setIsDrawerOpen(true)}
              className="relative p-2.5 rounded-xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition cursor-pointer flex items-center justify-center shadow-2xs"
              title="Pusat Notifikasi Admin"
            >
              <Bell className="w-4 h-4 text-slate-600 dark:text-slate-300" />
              <span className="absolute -top-1 -right-1 flex h-4 min-w-4 px-1 items-center justify-center rounded-full bg-blue-600 text-[9px] font-bold text-white shadow-xs">
                {unreadCount > 0 ? unreadCount : 3}
              </span>
            </button>

            {/* User Profile Block (Avatar + Name + Role + ChevronDown) */}
            <button
              onClick={() => handleOpenAuth('login')}
              className="flex items-center gap-2.5 pl-2 pr-3 py-1.5 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/80 transition cursor-pointer text-left"
              title="Ganti Akun atau Kelola Sesi"
            >
              <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-600 to-indigo-600 text-white font-bold text-xs flex items-center justify-center shrink-0 shadow-xs">
                {currentUser.fullName ? currentUser.fullName.charAt(0).toUpperCase() : 'A'}
              </div>
              <div className="hidden sm:block min-w-0">
                <div className="text-xs font-bold text-slate-900 dark:text-white truncate max-w-[130px]">
                  {currentUser.fullName || 'Pengguna'}
                </div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400 capitalize truncate">
                  {currentUser.role.replace('_', ' ')}
                </div>
              </div>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0" />
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

        <main className={`flex-1 max-w-7xl w-full mx-auto ${
          currentTab === 'driver_portal' || currentTab === 'sales_rfid_scanner'
            ? 'px-0 pb-0 pt-14 lg:pt-0'
            : `p-4 sm:p-6 lg:p-8 ${currentUser.status === 'pending' ? 'pt-28 lg:pt-6' : 'pt-20 sm:pt-20 lg:pt-6'}`
        }`}>
          <ReadOnlyModuleBoundary user={currentUser} activeTab={currentTab}>
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
                    {isDriver() ? 'Ke Portal Driver Mobile \u2192' : 'Ke Dashboard Logistik & Pengiriman \u2192'}
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

          {(currentTab === 'operational_dashboard' || currentTab === 'analytics_reports') && (
            <AnalyticsReportingModule />
          )}

          {currentTab === 'driver_reports' && (
            <DriverReportsManagement />
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

          {currentTab === 'branches' && (isAdmin() || canAccess(currentUser, 'branches')) && (
            <MasterCabang />
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

          {currentTab === 'sales_invoice_so' && (
            <SalesAdminHub
              activeSubTab="invoice_so"
              onSelectSubTab={(sub) => setCurrentTab(('sales_' + sub) as NavTab)}
            />
          )}

          {currentTab === 'sales_rfid_scanner' && (
            <SalesAdminHub
              activeSubTab="rfid_scanner"
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
            currentTab === 'warehouse_opname' ||
            currentTab === 'warehouse_cubication' ||
            currentTab === 'warehouse_fleet_cubication') && (
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
                  : currentTab === 'warehouse_cubication'
                  ? 'cubication'
                  : currentTab === 'warehouse_fleet_cubication'
                  ? 'fleet_cubication'
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
                  opname: 'warehouse_opname',
                  cubication: 'warehouse_cubication',
                  fleet_cubication: 'warehouse_fleet_cubication'
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
          </ReadOnlyModuleBoundary>
        </main>

        {/* Enterprise AKK Footer (hidden on driver portal & sales rfid scanner to keep clean mobile bottom bar) */}
        {currentTab !== 'driver_portal' && currentTab !== 'sales_rfid_scanner' && (
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
        )}
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
