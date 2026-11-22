import React, { useState, useEffect, useRef, useCallback, Suspense } from 'react';
import { Sidebar, NavTab } from './components/Sidebar';
import type { WmsSubTab } from './components/WarehouseManagementSystem';
import { LoginPage } from './components/LoginPage';
import { ThemeSwitcher } from './components/ThemeSwitcher';
import { NetworkStatusBanner } from './components/NetworkStatusBanner';
import { RealtimeShipmentListener } from './components/RealtimeShipmentListener';
import { AkkLogo } from './components/AkkLogo';

const AuthModal = React.lazy(() =>
  import('./components/AuthModal').then(m => ({ default: m.AuthModal }))
);
import { RetailStore } from './types';
import { logisticsStore } from './services/store';
import { branchStore, BranchRecord } from './services/branchStore';
import { Clock, ChevronDown, Bell, Lock, User, KeyRound, X, CheckCircle2, Mail, Phone, ShieldCheck } from 'lucide-react';
import { useToast } from './context/ToastContext';
import { canAccess, getFirstAccessibleTabForUser, getUserRoleDisplayTitle } from './utils/rbac';
import { useRoleAccess } from './hooks/useRoleAccess';
import { getTabPath, normalizePathname, resolveTabFromUrl } from './utils/navigationRoutes';
import { ReadOnlyModuleBoundary } from './components/ReadOnlyModuleBoundary';
import { ExecutiveDashboard } from './components/ExecutiveDashboard';
import {
  loadScheduleManagement,
  loadFleetCrewManagement,
  loadSparePartManagement,
  loadFleetMaintenanceCostManagement,
  loadFuelEfficiencyManagement,
  loadUserManagement,
  loadExcelTrackingEvaluator,
  loadCustomerMapping,
  loadFleetFormCenter,
  loadSupabaseSqlArchitecture,
  loadSalesAdminHub,
  loadFinanceValidasiFormKirimTab,
  loadSalesKpi,
  loadPurchasingStockAnalysis,
  loadSystemActivityLog,
  loadDepartmentDashboard,
  loadWarehouseManagementSystem,
  loadMarketingDashboard,
  loadDriverMobileView,
  loadDriverReportsManagement,
  loadAnalyticsReportingModule,
  loadE2ETesterModule,
  loadMasterCabang,
  loadSchedulePortalValidationReport,
  loadLiveTripsMonitorPanel,
  preloadTabsSequential,
  lazyWithRetry
} from './utils/tabLoaders';

if (typeof window !== 'undefined') {
  try {
    const initialTab = resolveTabFromUrl(window.location).tab;
    if (initialTab) {
      preloadTabsSequential([initialTab], 0);
    }
  } catch {}
}

const ScheduleManagement = lazyWithRetry(loadScheduleManagement);
const FleetCrewManagement = lazyWithRetry(loadFleetCrewManagement);
const SparePartManagement = lazyWithRetry(loadSparePartManagement);
const FleetMaintenanceCostManagement = lazyWithRetry(loadFleetMaintenanceCostManagement);
const FuelEfficiencyManagement = lazyWithRetry(loadFuelEfficiencyManagement);
const UserManagement = lazyWithRetry(loadUserManagement);
const ExcelTrackingEvaluator = lazyWithRetry(loadExcelTrackingEvaluator);
const CustomerMapping = lazyWithRetry(loadCustomerMapping);
const FleetFormCenter = lazyWithRetry(loadFleetFormCenter);
const SupabaseSqlArchitecture = lazyWithRetry(loadSupabaseSqlArchitecture);
const SalesAdminHub = lazyWithRetry(loadSalesAdminHub);
const FinanceValidasiFormKirimTab = lazyWithRetry(loadFinanceValidasiFormKirimTab);
const SalesKpi = lazyWithRetry(loadSalesKpi);
const PurchasingStockAnalysis = lazyWithRetry(loadPurchasingStockAnalysis);
const SystemActivityLog = lazyWithRetry(loadSystemActivityLog);
const DepartmentDashboard = lazyWithRetry(loadDepartmentDashboard);
const WarehouseManagementSystem = lazyWithRetry(loadWarehouseManagementSystem);
const MarketingDashboard = lazyWithRetry(loadMarketingDashboard);
const DriverMobileView = lazyWithRetry(loadDriverMobileView);
const DriverReportsManagement = lazyWithRetry(loadDriverReportsManagement);
const AnalyticsReportingModule = lazyWithRetry(loadAnalyticsReportingModule);
const E2ETesterModule = lazyWithRetry(loadE2ETesterModule);
const MasterCabang = lazyWithRetry(loadMasterCabang);
const SchedulePortalValidationReport = lazyWithRetry(loadSchedulePortalValidationReport);
const LiveTripsMonitorPanel = lazyWithRetry(loadLiveTripsMonitorPanel);

const AppShellSkeleton: React.FC<{
  statusLabel?: string;
}> = ({ statusLabel = 'Memverifikasi sesi...' }) => {
  const [logoImgFailed, setLogoImgFailed] = useState(false);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex">
      {/* Top Progress Bar */}
      <div className="fixed top-0 left-0 right-0 h-[3px] z-50 bg-blue-500/15 overflow-hidden">
        <div className="h-full w-1/3 bg-gradient-to-r from-blue-600 via-sky-400 to-indigo-500 rounded-full animate-[shimmer_1.2s_infinite]" />
      </div>

      {/* Desktop Sidebar Skeleton */}
      <aside className="hidden lg:flex w-72 shrink-0 flex-col justify-between bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 p-4">
        <div className="space-y-5">
          <div className="flex items-center gap-3 pb-4 border-b border-slate-100 dark:border-slate-800">
            <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-slate-800 border border-blue-200/70 dark:border-slate-700 p-1.5 flex items-center justify-center shrink-0">
              {!logoImgFailed ? (
                <img
                  src="/favicon.svg"
                  alt="AKK Operasional"
                  className="w-full h-full object-contain"
                  onError={() => setLogoImgFailed(true)}
                />
              ) : (
                <AkkLogo size="sm" showText={false} />
              )}
            </div>
            <div className="min-w-0">
              <div className="text-sm font-extrabold tracking-tight text-slate-900 dark:text-white truncate">
                AKK Operasional
              </div>
              <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400 truncate">
                PT. Anugrah Kemasan Kreatif
              </div>
            </div>
          </div>

          <div className="space-y-2.5">
            <div className="h-3 w-24 rounded-md skeleton-wave" />
            {[100, 88, 94, 82, 96, 76].map((w, idx) => (
              <div
                key={idx}
                style={{ width: `${w}%` }}
                className="h-9 rounded-xl skeleton-wave"
              />
            ))}
          </div>
        </div>

        <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
          <div className="h-9 w-9 rounded-xl skeleton-wave" />
          <div className="h-9 flex-1 rounded-xl skeleton-wave" />
        </div>
      </aside>

      {/* Main Content Skeleton */}
      <div className="flex-1 min-w-0 flex flex-col">
        <header className="h-16 bg-white/95 dark:bg-slate-900/95 border-b border-slate-200/80 dark:border-slate-800 px-4 sm:px-6 lg:px-8 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="lg:hidden w-9 h-9 rounded-xl bg-blue-50 dark:bg-slate-800 border border-blue-200/60 dark:border-slate-700 p-1.5 flex items-center justify-center shrink-0">
              {!logoImgFailed ? (
                <img
                  src="/favicon.svg"
                  alt="AKK"
                  className="w-full h-full object-contain"
                  onError={() => setLogoImgFailed(true)}
                />
              ) : (
                <AkkLogo size="sm" showText={false} />
              )}
            </div>
            <div className="min-w-0">
              <div className="text-xs sm:text-sm font-extrabold text-slate-900 dark:text-white truncate">
                AKK Operasional
              </div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                {statusLabel}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            <div className="hidden sm:block h-9 w-36 rounded-xl skeleton-wave" />
            <div className="h-9 w-9 rounded-xl skeleton-wave" />
            <div className="h-9 w-9 rounded-full skeleton-wave" />
          </div>
        </header>

        <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 space-y-5">
          {/* Status Header Card */}
          <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 p-4 sm:p-5 flex flex-wrap items-center justify-between gap-4 shadow-xs">
            <div className="flex items-center gap-3.5 min-w-0">
              <div className="w-12 h-12 rounded-2xl bg-blue-50 dark:bg-slate-800 border border-blue-200/80 dark:border-slate-700 p-2 flex items-center justify-center shrink-0">
                {!logoImgFailed ? (
                  <img
                    src="/favicon.svg"
                    alt="Logo PT Anugrah Kemasan Kreatif"
                    className="w-full h-full object-contain"
                    onError={() => setLogoImgFailed(true)}
                  />
                ) : (
                  <AkkLogo size="md" showText={false} />
                )}
              </div>
              <div className="space-y-1 min-w-0">
                <div className="text-sm font-extrabold text-slate-900 dark:text-white">
                  AKK Operasional
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400">
                  {statusLabel}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-blue-50 dark:bg-blue-500/10 border border-blue-200/80 dark:border-blue-500/25 text-xs font-bold text-blue-700 dark:text-blue-300">
                <span className="w-2 h-2 rounded-full bg-blue-500 animate-ping" />
                <span>Menyiapkan Ruang Kerja</span>
              </span>
            </div>
          </div>

          {/* 4 KPI Bento Skeletons */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
            {[0, 1, 2, 3].map((i) => (
              <div
                key={i}
                className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 p-4 space-y-3"
              >
                <div className="flex items-center justify-between">
                  <div className="h-3 w-20 rounded-md skeleton-wave" />
                  <div className="h-7 w-7 rounded-lg skeleton-wave" />
                </div>
                <div className="h-7 w-28 rounded-lg skeleton-wave" />
                <div className="h-2.5 w-24 rounded-md skeleton-wave" />
              </div>
            ))}
          </div>

          {/* Asymmetric Content Bento Skeleton */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 p-5 space-y-3.5">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
                <div className="h-4 w-44 rounded-lg skeleton-wave" />
                <div className="h-8 w-28 rounded-xl skeleton-wave" />
              </div>
              {[0, 1, 2, 3].map((row) => (
                <div key={row} className="h-12 w-full rounded-xl skeleton-wave" />
              ))}
            </div>

            <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 p-5 space-y-3.5">
              <div className="h-4 w-36 rounded-lg skeleton-wave" />
              <div className="h-36 w-full rounded-xl skeleton-wave" />
              <div className="h-10 w-full rounded-xl skeleton-wave" />
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};

const ModuleLoaderFallback: React.FC = () => (
  <div className="space-y-4">
    <div className="h-1 w-full bg-blue-500/15 rounded-full overflow-hidden relative">
      <div className="absolute inset-y-0 left-0 w-1/3 bg-gradient-to-r from-blue-600 via-sky-400 to-indigo-500 rounded-full animate-[shimmer_1.1s_infinite]" />
    </div>

    <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 p-5 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl skeleton-wave shrink-0" />
          <div className="space-y-2">
            <div className="h-4 w-48 rounded-lg skeleton-wave" />
            <div className="h-3 w-72 max-w-[60vw] rounded-md skeleton-wave" />
          </div>
        </div>
        <div className="hidden sm:block h-9 w-28 rounded-xl skeleton-wave" />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-20 rounded-xl skeleton-wave" />
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3.5">
        <div className="lg:col-span-2 space-y-2.5">
          <div className="h-12 rounded-xl skeleton-wave" />
          <div className="h-12 rounded-xl skeleton-wave" />
          <div className="h-12 rounded-xl skeleton-wave" />
        </div>
        <div className="h-40 rounded-xl skeleton-wave" />
      </div>
    </div>
  </div>
);

const FLEET_MANAGEMENT_TABS: NavTab[] = [
  'schedules',
  'fleets',
  'spareparts',
  'maintenance_costs',
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

  const { notifications, setOnNavigateCallback, setIsDrawerOpen, addNotification } = useToast();
  const unreadCount = notifications.filter(n => !n.read).length;

  // Profile Dropdown & Account Modals State
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const profileMenuRef = useRef<HTMLDivElement | null>(null);
  const [isAccountProfileOpen, setIsAccountProfileOpen] = useState(false);
  const [isChangePasswordOpen, setIsChangePasswordOpen] = useState(false);
  const [profileForm, setProfileForm] = useState({
    fullName: '',
    email: '',
    phone: '',
    department: ''
  });
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [isSavingPassword, setIsSavingPassword] = useState(false);

  useEffect(() => {
    const handleClickOutsideProfile = (e: MouseEvent) => {
      if (profileMenuRef.current && !profileMenuRef.current.contains(e.target as Node)) {
        setIsProfileMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutsideProfile);
    return () => document.removeEventListener('mousedown', handleClickOutsideProfile);
  }, []);

  const handleOpenAccountProfileModal = () => {
    setIsProfileMenuOpen(false);
    setProfileForm({
      fullName: currentUser.fullName || '',
      email: currentUser.email || '',
      phone: currentUser.phone || '',
      department: currentUser.department || getUserRoleDisplayTitle(currentUser.role)
    });
    setIsAccountProfileOpen(true);
  };

  const handleOpenChangePasswordModal = () => {
    setIsProfileMenuOpen(false);
    setPasswordForm({
      currentPassword: '',
      newPassword: '',
      confirmPassword: ''
    });
    setIsChangePasswordOpen(true);
  };

  const handleSaveAccountProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profileForm.fullName.trim()) {
      addNotification('sla_warning', 'Validasi Profil', 'Nama lengkap tidak boleh kosong.');
      return;
    }
    setIsSavingProfile(true);
    try {
      const res = await fetch('/api/auth/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          userId: currentUser.id,
          fullName: profileForm.fullName.trim(),
          email: profileForm.email.trim(),
          phone: profileForm.phone.trim(),
          department: profileForm.department.trim()
        })
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(json.error || 'Gagal menyimpan perubahan profil.');
      }
      await logisticsStore.restoreServerSession().catch(() => {});
      addNotification('schedule', 'Profil Diperbarui', 'Data profil akun berhasil disimpan ke database MySQL.');
      setIsAccountProfileOpen(false);
    } catch (err: any) {
      addNotification('sla_warning', 'Gagal Menyimpan', err?.message || 'Terjadi kesalahan saat menyimpan profil.');
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleSaveChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (passwordForm.newPassword.trim().length < 4) {
      addNotification('sla_warning', 'Validasi Password', 'Password baru minimal 4 karakter.');
      return;
    }
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      addNotification('sla_warning', 'Konfirmasi Tidak Cocok', 'Konfirmasi password baru harus sama dengan password baru.');
      return;
    }
    setIsSavingPassword(true);
    try {
      const res = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          userId: currentUser.id,
          currentPassword: passwordForm.currentPassword,
          newPassword: passwordForm.newPassword
        })
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(json.error || 'Gagal mengubah password.');
      }
      addNotification('schedule', 'Password Berhasil Diubah', 'Password akun Anda telah diperbarui di database MySQL.');
      setIsChangePasswordOpen(false);
    } catch (err: any) {
      addNotification('sla_warning', 'Gagal Ganti Password', err?.message || 'Terjadi kesalahan saat mengganti password.');
    } finally {
      setIsSavingPassword(false);
    }
  };

  const [activeNavTab, setActiveNavTab] = useState<NavTab>(currentTab);

  const selectTabImmediate = useCallback((nextTab: NavTab) => {
    setActiveNavTab(nextTab);
    setCurrentTab(nextTab);
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
      if (active) {
        setIsAuthChecking(false);
      }
    }, 400);

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
      clearTimeout(authTimeout);
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (isAuthChecking || !isAuthenticated || !import.meta.env.PROD) return;
    const basePriorityTabs: NavTab[] = [
      'sales_form_kirim',
      'finance_validasi_form_kirim',
      'schedules'
    ];
    if (isDriver(currentUser)) {
      basePriorityTabs.unshift('driver_portal');
    }

    const priorityTabs = basePriorityTabs.filter(
      (t): t is NavTab => t !== currentTab && canAccess(currentUser, t)
    );

    if (priorityTabs.length === 0) return;

    let stopWarmup: (() => void) | null = null;
    const timer = setTimeout(() => {
      stopWarmup = preloadTabsSequential(priorityTabs, 600);
    }, 2500);

    return () => {
      clearTimeout(timer);
      if (stopWarmup) stopWarmup();
    };
  }, [isAuthChecking, isAuthenticated, currentUser.id, currentUser.role, isDriver]);

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
    const isWarehouseTab = [
      'warehouse_scanner',
      'warehouse_cubication',
      'warehouse_fleet_cubication',
      'warehouse_inventory',
      'warehouse_dashboard',
      'wms_inbound_outbound',
      'wms_opname'
    ].includes(currentTab);
    if (isWarehouseTab) {
      void import('./services/databaseBarangService').then(({ databaseBarangService }) =>
        databaseBarangService.ensureHydrated()
      );
    }
  }, [currentTab]);

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
      case 'portal_validation': return 'Validasi Portal Driver & Helper';
      case 'live_trips': return 'Live Trips, Riwayat Rute & Playback Perjalanan';
      case 'fleets': return 'Manajemen Armada & Kru Supir';
      case 'spareparts': return 'Manajemen Stok & Pemakaian Sparepart';
      case 'maintenance_costs': return 'Biaya Servis & Pemeliharaan Armada';
      case 'fuel_efficiency': return 'Efisiensi Bahan Bakar (BBM) & Konsumsi Armada';
      case 'crew_history': return 'Riwayat Pengiriman & Audit SLA Kru';
      case 'tracking_eval': return 'Audit Evaluasi Muat & Bongkar (Excel)';
      case 'fleet_forms': return 'Formulir Pengadaan Armada';
      case 'sales_dashboard': return 'Dashboard Admin Penjualan';
      case 'sales_activities': return 'Sales Hub: Aktivitas Harian Admin';
      case 'sales_schedules': return 'Admin Penjualan: Jadwal & Penugasan Admin';
      case 'sales_loading_duration': return 'Sales Hub: Durasi Muat Real-Time';
      case 'sales_form_kirim': return 'Sales Hub: Form Kirim Barang';
      case 'sales_muat_validation': return 'Admin Penjualan: Validasi Muat & Retur (Salah Muat, Kurang Muat & Retur)';
      case 'sales_skill_matrix': return 'Sales Hub: Matriks Keterampilan Admin';
      case 'sales_jobdesk': return 'Sales Hub: Konfigurasi SOP & Jobdesk';
      case 'sales_kpi': return 'Sales Hub: Data Kinerja & KPI Penjualan';
      case 'sales_kpi_individual': return 'KPI Individu Masing-masing Admin Penjualan';
      case 'sales_kpi_fines': return 'Data Akumulasi Denda Checker';
      case 'sales_kpi_nusantara': return 'Persentase Kiriman Nusantara';
      case 'sales_kpi_omset': return 'Omset Admin Penjualan';
      case 'hr_dashboard': return 'HR: Data Karyawan, Rolling & History Departemen';
      case 'ga_security': return 'General Affair (GA): Security & Pos Keamanan Pabrik';
      case 'ga_hk': return 'General Affair (GA): Housekeeping (HK) & Kebersihan 5R';
      case 'ga_aset': return 'General Affair (GA): Manajemen Aset & Fasilitas Pabrik';
      case 'training_videos': return 'Training & Development: Video Pembelajaran & SOP';
      case 'training_karyawan': return 'Training & Development: Pelatihan & Sertifikasi Kru';
      case 'finance_overview': return 'Finance & Tax: Dashboard Ringkasan Piutang & Penagihan';
      case 'finance_dashboard': return 'Finance & Tax: Tagihan Pelanggan Belum Terlunasi';
      case 'finance_customer_mapping': return 'Finance & Tax: Mapping Master Pelanggan';
      case 'finance_validasi_form_kirim': return 'Finance & Tax: Validasi Form Kirim';
      case 'finance_billing_app': return 'Finance & Tax: Aplikasi Penagihan Pelanggan';
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
      case 'marketing_invoice_validation': return 'Departemen Marketing: Validasi Faktur & Rincian Barang Pengiriman';
      case 'marketing_sales_mapping': return 'Departemen Marketing: Mapping Nama Sales (Integrasi Validasi Faktur & Aplikasi Penagihan)';
      case 'marketing_to_vo_ro': return 'Departemen Marketing: Prosentase TO, VO & RO';
      case 'marketing_billing_app': return 'Departemen Marketing: Aplikasi Penagihan Pelanggan';
      case 'finance_billing_app': return 'Finance & Tax: Aplikasi Penagihan Pelanggan';
      case 'activity_log': return 'Audit Log & Aktivitas Sistem';
      case 'customer_map': return 'Pemetaan Toko Retail & Mitra';
      case 'branches': return 'Master Cabang (Multi-Store)';
      case 'users': return 'Approval & Manajemen Pengguna';
      case 'architecture': return 'Arsitektur Database Server';
      case 'e2e_testing': return 'Pusat Pengujian E2E & Simulasi Akun Pengguna';
      default: return 'Sistem Operasional AKK';
    }
  };

  // Sinkronisasi URL Browser (/login, /manajemen-user, /dashboard, dll.) & Judul Tab
  useEffect(() => {
    if (isAuthChecking) return;

    try {
      const currentPath = normalizePathname(window.location.pathname);

      document.title = 'Sistem Terpadu Operasional PT. Anugrah Kemasan Kreatif';

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
        const resolvedCurrent = resolveTabFromUrl(window.location);
        const isSameTabAlias = resolvedCurrent.tab === currentTab;
        if (currentPath === '/' || currentPath === '/login' || isSameTabAlias) {
          window.history.replaceState({ tab: currentTab }, '', targetPath);
        } else {
          window.history.pushState({ tab: currentTab }, '', targetPath);
        }
      }
    } catch {}
  }, [currentTab, isAuthenticated, isAuthChecking]);

  // Dukungan navigasi lintas komponen (mis. klik Simpan Form Kirim -> langsung buka Portal Driver)
  useEffect(() => {
    const handleNavigateEvent = (evt: Event) => {
      const customEvt = evt as CustomEvent<{ tab?: NavTab; subTab?: string; formKirimId?: string }>;
      const targetTab = customEvt.detail?.tab;
      if (targetTab) {
        setCurrentTab(targetTab);
      }
    };
    window.addEventListener('akk-navigate-tab', handleNavigateEvent);
    return () => window.removeEventListener('akk-navigate-tab', handleNavigateEvent);
  }, []);

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
    return <AppShellSkeleton statusLabel="Memverifikasi sesi & menyinkronkan data..." />;
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
        <header className="hidden lg:flex sticky top-0 z-[1050] h-16 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-slate-100 dark:border-slate-800 px-6 lg:px-8 items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <h1 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white tracking-tight truncate">
              Selamat datang kembali, {currentUser.fullName ? currentUser.fullName.split(' ')[0] : 'Admin'}!
            </h1>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            {/* Date Range Pill */}
            <LiveClockBadge />

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

            {/* User Profile Dropdown (Profil Akun & Ganti Password) */}
            <div ref={profileMenuRef} className="relative">
              <button
                type="button"
                onClick={() => setIsProfileMenuOpen(prev => !prev)}
                className="flex items-center gap-2.5 pl-2 pr-3 py-1.5 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/80 border border-transparent hover:border-slate-200/80 dark:hover:border-slate-700/80 transition cursor-pointer text-left"
                title="Menu Profil Akun & Ganti Password"
              >
                <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-600 to-indigo-600 text-white font-bold text-xs flex items-center justify-center shrink-0 shadow-xs">
                  {currentUser.fullName ? currentUser.fullName.charAt(0).toUpperCase() : 'A'}
                </div>
                <div className="hidden sm:block min-w-0">
                  <div className="text-xs font-bold text-slate-900 dark:text-white truncate max-w-[130px]">
                    {currentUser.fullName || 'Pengguna'}
                  </div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400 capitalize truncate">
                    {String(currentUser.role || 'unassigned').replace(/_/g, ' ')}
                  </div>
                </div>
                <ChevronDown className={`w-3.5 h-3.5 text-slate-400 shrink-0 transition-transform duration-200 ${isProfileMenuOpen ? 'rotate-180 text-blue-600' : ''}`} />
              </button>

              {isProfileMenuOpen && (
                <div className="absolute right-0 mt-2 w-64 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-2xl shadow-slate-900/20 py-2 z-[1200] animate-in fade-in zoom-in-95 duration-150">
                  <div className="px-4 py-2.5 border-b border-slate-100 dark:border-slate-800">
                    <div className="text-xs font-extrabold text-slate-900 dark:text-white truncate">
                      {currentUser.fullName || 'Pengguna'}
                    </div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate mt-0.5">
                      {currentUser.email || 'user@akk-logistics.co.id'}
                    </div>
                    <span className="inline-flex items-center gap-1 mt-1.5 px-2 py-0.5 rounded-md bg-blue-50 dark:bg-blue-500/15 text-[10px] font-bold text-blue-600 dark:text-blue-400">
                      <ShieldCheck className="w-3 h-3" />
                      {getUserRoleDisplayTitle(currentUser.role)}
                    </span>
                  </div>

                  <div className="p-1.5 space-y-0.5">
                    <button
                      type="button"
                      onClick={handleOpenAccountProfileModal}
                      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-blue-50 dark:hover:bg-blue-500/15 hover:text-blue-600 dark:hover:text-blue-400 transition cursor-pointer text-left"
                    >
                      <div className="w-7 h-7 rounded-lg bg-blue-50 dark:bg-blue-500/15 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
                        <User className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="font-bold">Profil Akun</div>
                        <div className="text-[10px] text-slate-400 dark:text-slate-500 font-normal">Lihat & perbarui informasi akun</div>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={handleOpenChangePasswordModal}
                      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-amber-50 dark:hover:bg-amber-500/15 hover:text-amber-600 dark:hover:text-amber-400 transition cursor-pointer text-left"
                    >
                      <div className="w-7 h-7 rounded-lg bg-amber-50 dark:bg-amber-500/15 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                        <KeyRound className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="font-bold">Ganti Password</div>
                        <div className="text-[10px] text-slate-400 dark:text-slate-500 font-normal">Ubah kata sandi keamanan akun</div>
                      </div>
                    </button>
                  </div>
                </div>
              )}
            </div>
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
          <Suspense fallback={<ModuleLoaderFallback />}>
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
            <AnalyticsReportingModule onNavigate={(tab) => setCurrentTab(tab as NavTab)} />
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

          {currentTab === 'portal_validation' && (canManageFleet() || canAccess(currentUser, 'portal_validation')) && (
            <SchedulePortalValidationReport />
          )}

          {currentTab === 'live_trips' && (canManageFleet() || canAccess(currentUser, 'live_trips')) && (
            <LiveTripsMonitorPanel />
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

          {currentTab === 'maintenance_costs' && (canManageFleet() || canAccess(currentUser, 'maintenance_costs')) && (
            <FleetMaintenanceCostManagement
              onNavigateToFleets={() => setCurrentTab('fleets')}
              onNavigateToSpareParts={() => setCurrentTab('spareparts')}
            />
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
              activeSubTab="dashboard"
              onSelectSubTab={(sub) => setCurrentTab(('sales_' + sub) as NavTab)}
              onNavigateTab={(tab) => setCurrentTab(tab as NavTab)}
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

          {currentTab === 'sales_form_kirim' && (
            <SalesAdminHub
              activeSubTab="form_kirim"
              onSelectSubTab={(sub) => setCurrentTab(('sales_' + sub) as NavTab)}
            />
          )}

          {currentTab === 'sales_rfid_scanner' && (
            <SalesAdminHub
              activeSubTab="rfid_scanner"
              onSelectSubTab={(sub) => setCurrentTab(('sales_' + sub) as NavTab)}
            />
          )}

          {currentTab === 'sales_muat_validation' && (
            <SalesAdminHub
              activeSubTab="muat_validation"
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
          {currentTab === 'finance_overview' && (
            <DepartmentDashboard
              dashboardType="finance"
              initialFinanceMode="overview"
              onNavigateTab={(tab) => setCurrentTab(tab as NavTab)}
            />
          )}
          {currentTab === 'finance_dashboard' && (
            <DepartmentDashboard
              dashboardType="finance"
              initialFinanceMode="monitoring"
              onNavigateTab={(tab) => setCurrentTab(tab as NavTab)}
            />
          )}
          {currentTab === 'finance_customer_mapping' && (
            <DepartmentDashboard
              dashboardType="finance"
              initialFinanceMode="customer_mapping"
              onNavigateTab={(tab) => setCurrentTab(tab as NavTab)}
            />
          )}
          {currentTab === 'finance_validasi_form_kirim' && (
            <FinanceValidasiFormKirimTab />
          )}
          {(currentTab === 'finance_billing_app' || currentTab === 'marketing_billing_app') && (
            <DepartmentDashboard
              dashboardType="finance"
              initialFinanceMode="billing_app"
              initialBillingTeamFilter={currentTab === 'marketing_billing_app' ? 'SALES' : 'FINANCE'}
              onNavigateTab={(tab) => setCurrentTab(tab as NavTab)}
            />
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
                  : 'scanner'
              }
              onNavigateTab={(tab: WmsSubTab) => {
                const map: Record<WmsSubTab, NavTab> = {
                  overview: 'warehouse_scanner',
                  inventory: 'warehouse_scanner',
                  inbound: 'warehouse_inbound',
                  outbound: 'warehouse_outbound',
                  scanner: 'warehouse_scanner',
                  slotting: 'warehouse_slotting',
                  opname: 'warehouse_opname',
                  purchasing_opname: 'purchasing_stok_opname',
                  kartu_stok: 'purchasing_kartu_stok',
                  cubication: 'warehouse_cubication',
                  fleet_cubication: 'warehouse_fleet_cubication'
                };
                setCurrentTab(map[tab] || 'warehouse_scanner');
              }}
            />
          )}
          {currentTab === 'purchasing_dashboard' && (
            <DepartmentDashboard dashboardType="purchasing" />
          )}
          {currentTab === 'purchasing_stok_opname' && (
            <WarehouseManagementSystem
              initialTab="purchasing_opname"
              onNavigateTab={(tab: WmsSubTab) => {
                if (tab === 'opname') {
                  setCurrentTab('warehouse_opname');
                } else if (tab === 'kartu_stok') {
                  setCurrentTab('purchasing_kartu_stok');
                }
              }}
            />
          )}
          {currentTab === 'purchasing_kartu_stok' && (
            <WarehouseManagementSystem
              initialTab="kartu_stok"
              onNavigateTab={(tab: WmsSubTab) => {
                if (tab === 'opname') {
                  setCurrentTab('warehouse_opname');
                } else if (tab === 'purchasing_opname') {
                  setCurrentTab('purchasing_stok_opname');
                }
              }}
            />
          )}
          {currentTab === 'purchasing_stock_overview' && (
            <PurchasingStockAnalysis tab="overview" />
          )}
          {currentTab === 'purchasing_stock_forecast' && (
            <PurchasingStockAnalysis tab="forecast" />
          )}

          {(currentTab === 'marketing_online' ||
            currentTab === 'marketing_offline' ||
            currentTab === 'marketing_to_vo_ro' ||
            currentTab === 'marketing_invoice_validation' ||
            currentTab === 'marketing_sales_mapping') && (
            <MarketingDashboard
              activeTab={currentTab}
              onNavigateTab={(tab) => setCurrentTab(tab as NavTab)}
            />
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
          </Suspense>
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

      {/* Modal Profil Akun */}
      {isAccountProfileOpen && (
        <div className="fixed inset-0 z-[1300] bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="px-6 py-4 bg-gradient-to-r from-blue-600 to-indigo-600 text-white flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-white/15 flex items-center justify-center">
                  <User className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-extrabold">Profil Akun Pengguna</h3>
                  <p className="text-[11px] text-blue-100">Informasi identitas & kontak akun aktif</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsAccountProfileOpen(false)}
                className="p-1.5 rounded-lg hover:bg-white/15 transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveAccountProfile} className="p-6 space-y-4">
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
                  Nama Lengkap *
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    required
                    value={profileForm.fullName}
                    onChange={e => setProfileForm(prev => ({ ...prev, fullName: e.target.value }))}
                    className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 text-xs font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Nama Lengkap"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
                  Alamat Email
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="email"
                    value={profileForm.email}
                    onChange={e => setProfileForm(prev => ({ ...prev, email: e.target.value }))}
                    className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 text-xs font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="email@perusahaan.com"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
                  Nomor Telepon / WhatsApp
                </label>
                <div className="relative">
                  <Phone className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={profileForm.phone}
                    onChange={e => setProfileForm(prev => ({ ...prev, phone: e.target.value }))}
                    className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 text-xs font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="0812xxxxxxxx"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
                  Jabatan / Role Sistem
                </label>
                <input
                  type="text"
                  disabled
                  value={getUserRoleDisplayTitle(currentUser.role)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-800/40 text-xs font-bold text-slate-500 dark:text-slate-400 cursor-not-allowed"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsAccountProfileOpen(false)}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSavingProfile}
                  className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-bold flex items-center gap-2 shadow-md shadow-blue-500/20 transition cursor-pointer"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{isSavingProfile ? 'Menyimpan...' : 'Simpan Profil'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Ganti Password */}
      {isChangePasswordOpen && (
        <div className="fixed inset-0 z-[1300] bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="px-6 py-4 bg-gradient-to-r from-amber-500 to-orange-600 text-white flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-white/15 flex items-center justify-center">
                  <KeyRound className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-extrabold">Ganti Password Akun</h3>
                  <p className="text-[11px] text-amber-100">Perbarui kata sandi keamanan akun Anda</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsChangePasswordOpen(false)}
                className="p-1.5 rounded-lg hover:bg-white/15 transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveChangePassword} className="p-6 space-y-4">
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
                  Password Saat Ini (Opsional)
                </label>
                <input
                  type="password"
                  value={passwordForm.currentPassword}
                  onChange={e => setPasswordForm(prev => ({ ...prev, currentPassword: e.target.value }))}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 text-xs font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                  placeholder="Masukkan password saat ini"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
                  Password Baru *
                </label>
                <input
                  type="password"
                  required
                  value={passwordForm.newPassword}
                  onChange={e => setPasswordForm(prev => ({ ...prev, newPassword: e.target.value }))}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 text-xs font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                  placeholder="Minimal 4 karakter"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
                  Konfirmasi Password Baru *
                </label>
                <input
                  type="password"
                  required
                  value={passwordForm.confirmPassword}
                  onChange={e => setPasswordForm(prev => ({ ...prev, confirmPassword: e.target.value }))}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 text-xs font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                  placeholder="Ulangi password baru"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsChangePasswordOpen(false)}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSavingPassword}
                  className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 text-xs font-extrabold flex items-center gap-2 shadow-md shadow-amber-500/20 transition cursor-pointer"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{isSavingPassword ? 'Menyimpan...' : 'Simpan Password'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Authentication Modal (lazy-loaded only when opened) */}
      {isAuthOpen && (
        <Suspense fallback={null}>
          <AuthModal
            isOpen={isAuthOpen}
            onClose={() => setIsAuthOpen(false)}
            defaultTab={authDefaultTab}
          />
        </Suspense>
      )}
    </div>
  );
}
