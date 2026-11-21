import React, { useState, useEffect, useRef } from 'react';
import {
  LayoutDashboard,
  Calendar,
  Truck,
  MapPin,
  FileSpreadsheet,
  FileText,
  Users,
  Database,
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
  Clock,
  QrCode,
  DollarSign,
  Link2,
  Receipt,
  FileCheck2,
  Navigation
} from 'lucide-react';
import { AkkLogo } from './AkkLogo';
import { ThemeSwitcher } from './ThemeSwitcher';
import { UserProfile } from '../types';
import { logisticsStore } from '../services/store';
import { canAccess } from '../utils/rbac';
import { preloadTabModule } from '../utils/tabLoaders';

const AndroidApkDownloadModal = React.lazy(() =>
  import('./AndroidApkDownloadModal').then(m => ({ default: m.AndroidApkDownloadModal }))
);

export type NavTab =
  | 'dashboard'
  | 'driver_portal'
  | 'driver_reports'
  | 'analytics_reports'
  | 'operational_dashboard'
  | 'schedules'
  | 'portal_validation'
  | 'fleets'
  | 'spareparts'
  | 'maintenance_costs'
  | 'fuel_efficiency'
  | 'crew_history'
  | 'live_trips'
  | 'tracking_eval'
  | 'fleet_forms'
  | 'sales_dashboard'
  | 'sales_activities'
  | 'sales_schedules'
  | 'sales_loading_duration'
  | 'sales_invoice_so'
  | 'sales_form_kirim'
  | 'sales_rfid_scanner'
  | 'sales_muat_validation'
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
  | 'purchasing_stok_opname'
  | 'purchasing_kartu_stok'
  | 'hr_dashboard'
  | 'ga_security'
  | 'ga_hk'
  | 'ga_aset'
  | 'training_videos'
  | 'training_karyawan'
  | 'finance_overview'
  | 'finance_dashboard'
  | 'finance_customer_mapping'
  | 'finance_validasi_form_kirim'
  | 'finance_billing_app'
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
  | 'marketing_to_vo_ro'
  | 'marketing_invoice_validation'
  | 'marketing_sales_mapping'
  | 'marketing_billing_app'
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

// Multi-level Nested Dropdown navigation data structures
export interface SimpleDropdownItem {
  tab: NavTab;
  label: string;
  icon: React.ReactNode;
  badge?: React.ReactNode;
  description?: string;
}

export interface SimpleDropdownGroup {
  groupId: string;
  groupTitle?: string;
  groupIcon?: React.ReactNode;
  items: SimpleDropdownItem[];
}

export interface NavCategory {
  id: string;
  label: string;
  shortLabel?: string;
  icon: React.ReactNode;
  defaultTab?: NavTab;
  badge?: React.ReactNode;
  groups: SimpleDropdownGroup[];
  checkAccess: (user: UserProfile) => boolean;
}

const SidebarComponent: React.FC<SidebarProps> = ({
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
  const [isApkModalOpen, setIsApkModalOpen] = useState(false);

  // Active category dropdown state (Multi-Level Nested Dropdown)
  const [activeCategoryId, setActiveCategoryId] = useState<string | null>(null);
  const [dropdownTop, setDropdownTop] = useState<number>(80);
  const [expandedSubGroups, setExpandedSubGroups] = useState<Record<string, boolean>>({});

  const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const closeTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const dropdownRef = useRef<HTMLDivElement | null>(null);
  const asideRef = useRef<HTMLElement | null>(null);
  const categoryRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  // Mobile accordion state
  const [mobileExpandedCat, setMobileExpandedCat] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const updateReports = () => {
      void import('../services/driverReportService')
        .then(({ driverReportService }) => {
          if (!active) return;
          const reps = driverReportService.getReports();
          setPendingReportsCount(reps.filter(r => r.status === 'pending').length);
        })
        .catch(() => {});
    };
    const initTimer = setTimeout(updateReports, 400);
    window.addEventListener('driver-report-updated', updateReports);
    return () => {
      active = false;
      clearTimeout(initTimer);
      window.removeEventListener('driver-report-updated', updateReports);
    };
  }, []);

  useEffect(() => {
    const syncUser = () => {
      const nextUser = logisticsStore.getCurrentUser();
      setCurrentUser(prev => {
        if (
          prev.id === nextUser.id &&
          prev.fullName === nextUser.fullName &&
          prev.role === nextUser.role &&
          prev.status === nextUser.status &&
          prev.email === nextUser.email &&
          JSON.stringify(prev.permissions) === JSON.stringify(nextUser.permissions)
        ) {
          return prev;
        }
        return { ...nextUser };
      });
      const nextPending = logisticsStore.getPendingUsersCount();
      setPendingUsersCount(prev => (prev === nextPending ? prev : nextPending));
    };
    const unsub = logisticsStore.subscribe(syncUser);
    window.addEventListener('akk-branch-updated', syncUser);
    return () => {
      unsub();
      window.removeEventListener('akk-branch-updated', syncUser);
    };
  }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(target) &&
        asideRef.current &&
        !asideRef.current.contains(target)
      ) {
        setActiveCategoryId(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const updateDropdownPosition = (catId: string) => {
    const btn = categoryRefs.current[catId];
    if (btn) {
      const rect = btn.getBoundingClientRect();
      const cat = categories.find(c => c.id === catId);
      const totalItems = cat ? cat.groups.reduce((acc, g) => acc + g.items.length, 0) : 5;
      const totalGroups = cat ? cat.groups.length : 1;
      const estimatedHeight = Math.min(
        window.innerHeight - 24,
        100 + totalGroups * 46 + Math.min(totalItems, 6) * 44
      );
      const clamped = Math.max(12, Math.min(rect.top, window.innerHeight - estimatedHeight - 12));
      setDropdownTop(clamped);
    }
  };

  const handleTabClick = (tabId: NavTab) => {
    onSelectTab(tabId);
    setActiveCategoryId(null);
    setIsMobileOpen(false);
  };

  const handleMouseEnterCat = (catId: string) => {
    if (closeTimeoutRef.current) {
      clearTimeout(closeTimeoutRef.current);
      closeTimeoutRef.current = null;
    }
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
      hoverTimeoutRef.current = null;
    }

    if (activeCategoryId === catId) return;

    if (!activeCategoryId) {
      updateDropdownPosition(catId);
      setActiveCategoryId(catId);
    } else {
      hoverTimeoutRef.current = setTimeout(() => {
        updateDropdownPosition(catId);
        setActiveCategoryId(catId);
      }, 120);
    }
  };

  const handleMouseLeaveCat = () => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
      hoverTimeoutRef.current = null;
    }
    closeTimeoutRef.current = setTimeout(() => {
      setActiveCategoryId(null);
    }, 250);
  };

  const handleMouseEnterDropdown = () => {
    if (closeTimeoutRef.current) {
      clearTimeout(closeTimeoutRef.current);
      closeTimeoutRef.current = null;
    }
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
      hoverTimeoutRef.current = null;
    }
  };

  const handleMouseLeaveDropdown = () => {
    closeTimeoutRef.current = setTimeout(() => {
      setActiveCategoryId(null);
    }, 250);
  };

  const handleCategoryClick = (cat: NavCategory) => {
    // If the category has only 1 item and no sub-groups, directly navigate!
    const totalItems = cat.groups.reduce((acc, g) => acc + g.items.length, 0);
    if (totalItems === 1 && cat.groups[0]?.items[0]) {
      handleTabClick(cat.groups[0].items[0].tab);
      return;
    }

    if (activeCategoryId === cat.id) {
      setActiveCategoryId(null);
    } else {
      if (closeTimeoutRef.current) clearTimeout(closeTimeoutRef.current);
      if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
      updateDropdownPosition(cat.id);
      setActiveCategoryId(cat.id);
    }
  };

  // Define Navigation Schema with detailed multi-level nested groups
  const categories: NavCategory[] = [
    {
      id: 'dashboard',
      label: 'Dashboard & Eksekutif',
      shortLabel: 'Overview',
      icon: <LayoutDashboard className="w-5 h-5" />,
      defaultTab: 'dashboard',
      checkAccess: (user) => canAccess(user, 'dashboard'),
      groups: [
        {
          groupId: 'dashboard-exec',
          items: [
            {
              tab: 'dashboard',
              label: 'Dashboard Eksekutif',
              icon: <LayoutDashboard className="w-4 h-4 text-blue-500" />,
              description: 'Ringkasan KPI bisnis, omset & performa perusahaan'
            }
          ]
        }
      ]
    },
    {
      id: 'logistik',
      label: 'Logistik & Pengiriman',
      shortLabel: 'Logistik',
      icon: <Truck className="w-5 h-5" />,
      defaultTab: 'operational_dashboard',
      badge: pendingReportsCount > 0 ? (
        <span className="text-[10px] font-bold bg-rose-500 text-white px-1.5 py-0.2 rounded-full">
          {pendingReportsCount}
        </span>
      ) : undefined,
      checkAccess: (user) => canAccess(user, 'logistics'),
      groups: [
        {
          groupId: 'logistik-dashboard-jadwal',
          groupTitle: 'Dashboard & Penjadwalan',
          groupIcon: <Calendar className="w-4 h-4 text-blue-500" />,
          items: [
            {
              tab: 'operational_dashboard',
              label: 'Dashboard Logistik & Pengiriman',
              icon: <BarChart3 className="w-4 h-4 text-blue-500" />,
              description: 'Analitik performa armada, kru & ketepatan waktu kirim'
            },
            {
              tab: 'schedules',
              label: 'Jadwal & Penugasan Armada',
              icon: <Calendar className="w-4 h-4 text-blue-500" />,
              description: 'Alokasi armada, supir, dan rute kirim'
            },
            {
              tab: 'driver_portal',
              label: 'Portal Driver Mobile',
              icon: <Smartphone className="w-4 h-4 text-emerald-500" />,
              description: 'Tampilan antarmuka khusus mobile supir'
            },
            {
              tab: 'portal_validation',
              label: 'Validasi Portal',
              icon: <FileCheck2 className="w-4 h-4 text-indigo-500" />,
              description: 'Validasi kesesuaian jadwal admin dengan check-in portal kru'
            }
          ]
        },
        {
          groupId: 'logistik-monitoring',
          groupTitle: 'Monitoring, GPS & Laporan',
          groupIcon: <MapPin className="w-4 h-4 text-emerald-500" />,
          items: [
            {
              tab: 'live_trips',
              label: 'Live Trips & Playback Rute',
              icon: <Navigation className="w-4 h-4 text-blue-500" />,
              description: 'Pantau armada live di jalan, riwayat rute & playback perjalanan'
            },
            {
              tab: 'driver_reports',
              label: 'Laporan Kiriman Kru',
              icon: <MapPin className="w-4 h-4 text-blue-500" />,
              badge: pendingReportsCount > 0 ? (
                <span className="text-[9px] font-bold bg-rose-500 text-white px-1.5 py-0.2 rounded-full">
                  {pendingReportsCount} baru
                </span>
              ) : undefined,
              description: 'Kendala perjalanan, penyerahan & riwayat GPS'
            },
            {
              tab: 'tracking_eval',
              label: 'Evaluasi Jalur GPS (Excel)',
              icon: <FileSpreadsheet className="w-4 h-4 text-emerald-500" />,
              description: 'Unggah file Excel tracking GPS vendor'
            },
            {
              tab: 'fleet_forms',
              label: 'Formulir Pengadaan Armada',
              icon: <FileText className="w-4 h-4 text-amber-500" />,
              description: 'Formulir pengadaan armada, servis & surat jalan'
            }
          ]
        },
        {
          groupId: 'logistik-armada',
          groupTitle: 'Armada, Kru & Perawatan',
          groupIcon: <Truck className="w-4 h-4 text-indigo-500" />,
          items: [
            {
              tab: 'fleets',
              label: 'Data Armada Terpadu',
              icon: <Truck className="w-4 h-4 text-blue-500" />,
              description: 'Profil kendaraan, STNK, KIR, dan kapasitas m³'
            },
            {
              tab: 'crew_history',
              label: 'Kru Pengiriman & Kernet',
              icon: <Users className="w-4 h-4 text-indigo-500" />,
              description: 'Riwayat penugasan dan jam terbang supir'
            },
            {
              tab: 'spareparts',
              label: 'Suku Cadang & Bengkel',
              icon: <Wrench className="w-4 h-4 text-amber-500" />,
              description: 'Jadwal servis berkala dan stok sparepart'
            },
            {
              tab: 'maintenance_costs',
              label: 'Biaya Servis & Pemeliharaan',
              icon: <Receipt className="w-4 h-4 text-emerald-500" />,
              description: 'Catat pengeluaran servis rutin, perbaikan, ban, KIR & nota bengkel'
            },
            {
              tab: 'fuel_efficiency',
              label: 'Efisiensi Bahan Bakar (BBM)',
              icon: <Fuel className="w-4 h-4 text-rose-500" />,
              description: 'Analisis rasio km/liter dan konsumsi armada'
            },
            {
              tab: 'warehouse_fleet_cubication',
              label: 'Simulasi Box Muatan Armada',
              icon: <Layers className="w-4 h-4 text-amber-500" />,
              description: 'Simulasi kubikasi 3D karton box ke truk armada'
            }
          ]
        }
      ]
    },
    {
      id: 'warehouse',
      label: 'Gudang',
      shortLabel: 'Gudang',
      icon: <Building2 className="w-5 h-5" />,
      badge: (
        <span className="text-[9px] font-extrabold uppercase bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 px-1.5 py-0.5 rounded-full">
          WMS
        </span>
      ),
      checkAccess: (user) => canAccess(user, 'warehouse'),
      groups: [
        {
          groupId: 'warehouse-master',
          groupTitle: 'Master Barang & Denah Rak',
          groupIcon: <Database className="w-4 h-4 text-emerald-500" />,
          items: [
            {
              tab: 'warehouse_scanner',
              label: 'Database Barang',
              icon: <Database className="w-4 h-4 text-emerald-500" />,
              description: 'Nomor barang, dimensi, kubikasi & dokumentasi'
            },
            {
              tab: 'warehouse_slotting',
              label: 'Denah Rak & Slotting',
              icon: <MapIcon className="w-4 h-4 text-amber-500" />,
              description: 'Visualisasi penempatan palet di area gudang'
            }
          ]
        },
        {
          groupId: 'warehouse-ops',
          groupTitle: 'Operasi Inbound & Outbound',
          groupIcon: <Package className="w-4 h-4 text-blue-500" />,
          items: [
            {
              tab: 'warehouse_inbound',
              label: 'Inbound (Barang Masuk)',
              icon: <ArrowDownToLine className="w-4 h-4 text-blue-500" />,
              description: 'Penerimaan barang dari pabrik produksi'
            },
            {
              tab: 'warehouse_outbound',
              label: 'Outbound (Picking & Muat)',
              icon: <ArrowUpFromLine className="w-4 h-4 text-emerald-500" />,
              description: 'Penataan muatan karton box ke truk armada'
            },
            {
              tab: 'warehouse_opname',
              label: 'Opname Gudang',
              icon: <ClipboardCheck className="w-4 h-4 text-purple-500" />,
              description: 'Pencatatan hasil hitung fisik barang gudang'
            }
          ]
        }
      ]
    },
    {
      id: 'sales_admin',
      label: 'Admin Penjualan',
      shortLabel: 'Admin Penjualan',
      icon: <Briefcase className="w-5 h-5" />,
      checkAccess: (user) => canAccess(user, 'sales_admin'),
      groups: [
        {
          groupId: 'sales-aktivitas',
          groupTitle: 'Aktivitas Harian Admin',
          groupIcon: <BarChart3 className="w-4 h-4 text-blue-500" />,
          items: [
            {
              tab: 'sales_dashboard',
              label: 'Dashboard Admin Penjualan',
              icon: <BarChart3 className="w-4 h-4 text-blue-500" />,
              description: 'Grafik & analitik performa seluruh modul Admin Penjualan'
            },
            {
              tab: 'sales_schedules',
              label: 'Jadwal & Penugasan Admin',
              icon: <Calendar className="w-4 h-4 text-indigo-500" />,
              description: 'Jadwal penugasan harian admin penjualan'
            },
            {
              tab: 'sales_loading_duration',
              label: 'Durasi & Kecepatan Muat',
              icon: <Timer className="w-4 h-4 text-amber-500" />,
              description: 'Pencatatan SLA proses pemuatan barang'
            }
          ]
        },
        {
          groupId: 'sales-muat',
          groupTitle: 'Faktur, Form Kirim & Scan Muat',
          groupIcon: <FileText className="w-4 h-4 text-indigo-500" />,
          items: [
            {
              tab: 'sales_invoice_so',
              label: 'Input Faktur / Sales Order (SO)',
              icon: <FileText className="w-4 h-4 text-indigo-500" />,
              badge: (
                <span className="text-[9px] font-bold bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 px-1.5 py-0.5 rounded-full">
                  Order Muat
                </span>
              ),
              description: 'Input faktur & daftar item barang muatan armada box'
            },
            {
              tab: 'sales_form_kirim',
              label: 'Form Kirim',
              icon: <Truck className="w-4 h-4 text-blue-500" />,
              badge: (
                <span className="text-[9px] font-bold bg-blue-500/15 text-blue-600 dark:text-blue-400 px-1.5 py-0.5 rounded-full">
                  Finance & Driver
                </span>
              ),
              description: 'Pengajuan Form Kirim terintegrasi Validasi Finance & Portal Driver'
            },
            {
              tab: 'sales_rfid_scanner',
              label: 'Aplikasi Scan & Foto Muat',
              icon: <QrCode className="w-4 h-4 text-emerald-500" />,
              description: 'Foto item sesuai faktur, deteksi otomatis YOLO & verifikasi muat'
            },
            {
              tab: 'sales_muat_validation',
              label: 'Validasi Muat & Retur',
              icon: <ShieldCheck className="w-4 h-4 text-indigo-500" />,
              badge: (
                <span className="text-[9px] font-bold bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 px-1.5 py-0.5 rounded-full">
                  Driver &amp; Helper
                </span>
              ),
              description: 'Validasi laporan salah muat, kurang muat & barang retur dari Portal Driver & Helper'
            }
          ]
        },
        {
          groupId: 'sales-kpi',
          groupTitle: 'Data KPI Penjualan',
          groupIcon: <Award className="w-4 h-4 text-amber-500" />,
          items: [
            {
              tab: 'sales_kpi_individual',
              label: 'KPI Individu Staff',
              icon: <User className="w-4 h-4 text-blue-500" />,
              description: 'Skor performa dan pemenuhan target'
            },
            {
              tab: 'sales_kpi_fines',
              label: 'Akumulasi Denda',
              icon: <ShieldAlert className="w-4 h-4 text-rose-500" />,
              description: 'Pinalti keterlambatan atau ketidaksesuaian'
            },
            {
              tab: 'sales_kpi_nusantara',
              label: 'Persentase Kiriman',
              icon: <Percent className="w-4 h-4 text-indigo-500" />,
              description: 'Tingkat keberhasilan distribusi nusantara'
            },
            {
              tab: 'sales_kpi_omset',
              label: 'Omset Admin Penjualan',
              icon: <TrendingUp className="w-4 h-4 text-emerald-500" />,
              description: 'Akumulasi omset kiriman terverifikasi'
            }
          ]
        }
      ]
    },
    {
      id: 'purchasing',
      label: 'Adm Pembelian',
      shortLabel: 'Pembelian',
      icon: <ShoppingBag className="w-5 h-5" />,
      checkAccess: (user) => canAccess(user, 'purchasing'),
      groups: [
        {
          groupId: 'purchasing-po',
          groupTitle: 'Pembelian & Analisis Stok',
          groupIcon: <ShoppingBag className="w-4 h-4 text-purple-500" />,
          items: [
            {
              tab: 'purchasing_dashboard',
              label: 'Dashboard Pembelian',
              icon: <ShoppingBag className="w-4 h-4 text-purple-500" />,
              description: 'Permintaan barang dan PO supplier'
            },
            {
              tab: 'purchasing_stock_overview',
              label: 'Ringkasan Stok Bahan',
              icon: <Database className="w-4 h-4 text-blue-500" />,
              description: 'Monitoring bahan baku karton box & lem'
            },
            {
              tab: 'purchasing_stock_forecast',
              label: 'Prediksi Kebutuhan Stok',
              icon: <TrendingUp className="w-4 h-4 text-emerald-500" />,
              description: 'Perhitungan titik reorder point (ROP)'
            }
          ]
        },
        {
          groupId: 'purchasing-opname',
          groupTitle: 'Stok Opname & Kartu Stok',
          groupIcon: <ClipboardCheck className="w-4 h-4 text-indigo-500" />,
          items: [
            {
              tab: 'purchasing_stok_opname',
              label: 'Stok Opname',
              icon: <ClipboardCheck className="w-4 h-4 text-indigo-500" />,
              description: 'Analisa dan pencatatan hasil stok opname barang'
            },
            {
              tab: 'purchasing_kartu_stok',
              label: 'Kartu Stok',
              icon: <FileText className="w-4 h-4 text-emerald-500" />,
              badge: (
                <span className="text-[9px] font-bold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 px-1.5 py-0.5 rounded-full">
                  Analisa Hari
                </span>
              ),
              description: 'Kartu stok digital & analisa otomatis selisih hari pengisian stok'
            }
          ]
        }
      ]
    },
    {
      id: 'marketing',
      label: 'Marketing',
      shortLabel: 'Marketing',
      icon: <Megaphone className="w-5 h-5" />,
      checkAccess: (user) => canAccess(user, 'marketing'),
      groups: [
        {
          groupId: 'marketing-online-grp',
          groupTitle: 'Marketing Online',
          groupIcon: <Globe className="w-4 h-4 text-cyan-500" />,
          items: [
            {
              tab: 'marketing_online',
              label: 'Marketing Online & Ads',
              icon: <Globe className="w-4 h-4 text-cyan-500" />,
              description: 'Kampanye digital dan inbound leads'
            }
          ]
        },
        {
          groupId: 'marketing-offline-grp',
          groupTitle: 'Marketing Offline & Faktur',
          groupIcon: <Megaphone className="w-4 h-4 text-amber-500" />,
          items: [
            {
              tab: 'marketing_offline',
              label: 'Marketing Offline / Kunjungan',
              icon: <Megaphone className="w-4 h-4 text-amber-500" />,
              description: 'Pipeline prospek pabrik, laporan penjualan & input tagihan'
            },
            {
              tab: 'marketing_invoice_validation',
              label: 'Validasi Faktur',
              icon: <ClipboardCheck className="w-4 h-4 text-blue-500" />,
              badge: (
                <span className="text-[9px] font-bold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 px-1.5 py-0.5 rounded-full">
                  WA Sales
                </span>
              ),
              description: 'Validasi faktur kirim esok hari & integrasi WA Sales'
            },
            {
              tab: 'marketing_sales_mapping',
              label: 'Mapping Nama Sales',
              icon: <Link2 className="w-4 h-4 text-indigo-500" />,
              badge: (
                <span className="text-[9px] font-bold bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 px-1.5 py-0.5 rounded-full">
                  2 Master
                </span>
              ),
              description: 'Mapping 1 Sales = 2 Master Nama Sales (Integrasi Validasi Faktur & Aplikasi Penagihan)'
            }
          ]
        },
        {
          groupId: 'marketing-analytics-grp',
          groupTitle: 'Analisa Pelanggan & Penagihan',
          groupIcon: <TrendingUp className="w-4 h-4 text-emerald-500" />,
          items: [
            {
              tab: 'marketing_to_vo_ro',
              label: 'Prosentase TO, VO & RO',
              icon: <Percent className="w-4 h-4 text-emerald-500" />,
              badge: (
                <span className="text-[9px] font-bold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 px-1.5 py-0.5 rounded-full">
                  TO/VO/RO
                </span>
              ),
              description: 'Analisa prosentase Take Order (TO), Visit Order (VO) & Repeat Order (RO)'
            },
            {
              tab: 'customer_map',
              label: 'Jaringan Toko & Wilayah Mitra',
              icon: <MapIcon className="w-4 h-4 text-indigo-500" />,
              description: 'Peta sebaran retail store Jawa Timur & Bali'
            },
            {
              tab: 'marketing_billing_app',
              label: 'Aplikasi Penagihan Pelanggan',
              icon: <DollarSign className="w-4 h-4 text-amber-500" />,
              badge: (
                <span className="text-[9px] font-bold bg-amber-500/15 text-amber-600 dark:text-amber-400 px-1.5 py-0.5 rounded-full">
                  Kolektor
                </span>
              ),
              description: 'Aplikasi HP penagihan ke pelanggan, foto bukti, kendala & lunas'
            }
          ]
        }
      ]
    },
    {
      id: 'finance_tax',
      label: 'Finance & Tax',
      shortLabel: 'Finance',
      icon: <FileText className="w-5 h-5" />,
      checkAccess: (user) => canAccess(user, 'finance_tax'),
      groups: [
        {
          groupId: 'finance-master',
          groupTitle: 'Ringkasan, Tagihan & Master Pelanggan',
          groupIcon: <LayoutDashboard className="w-4 h-4 text-cyan-500" />,
          items: [
            {
              tab: 'finance_overview',
              label: 'Dashboard',
              icon: <LayoutDashboard className="w-4 h-4 text-cyan-500" />,
              description: 'Ringkasan piutang, jatuh tempo, limit kredit & validasi form kirim'
            },
            {
              tab: 'finance_dashboard',
              label: 'Finance & Tagihan Pelanggan',
              icon: <FileText className="w-4 h-4 text-emerald-500" />,
              description: 'Monitoring buku besar tagihan & piutang pelanggan per wilayah'
            },
            {
              tab: 'finance_customer_mapping',
              label: 'Mapping Master Pelanggan',
              icon: <Users className="w-4 h-4 text-indigo-500" />,
              description: 'Pengkategorian pelanggan Tempo & COD, sisa limit & umur jatuh tempo'
            }
          ]
        },
        {
          groupId: 'finance-validasi',
          groupTitle: 'Validasi & Penagihan Lapangan',
          groupIcon: <ShieldCheck className="w-4 h-4 text-blue-500" />,
          items: [
            {
              tab: 'finance_validasi_form_kirim',
              label: 'Validasi Form Kirim',
              icon: <ShieldCheck className="w-4 h-4 text-blue-500" />,
              badge: (
                <span className="text-[9px] font-bold bg-blue-500/15 text-blue-600 dark:text-blue-400 px-1.5 py-0.5 rounded-full">
                  Integrasi
                </span>
              ),
              description: 'Validasi Form Kirim Admin Penjualan sebelum masuk Portal Driver'
            },
            {
              tab: 'finance_billing_app',
              label: 'Aplikasi Penagihan Pelanggan',
              icon: <DollarSign className="w-4 h-4 text-amber-500" />,
              badge: (
                <span className="text-[9px] font-bold bg-amber-500/15 text-amber-600 dark:text-amber-400 px-1.5 py-0.5 rounded-full">
                  Kolektor
                </span>
              ),
              description: 'Aplikasi HP penagihan ke pelanggan, foto bukti, kendala & lunas'
            }
          ]
        }
      ]
    },
    {
      id: 'hr',
      label: 'HR',
      shortLabel: 'HR',
      icon: <Users className="w-5 h-5" />,
      checkAccess: (user) =>
        canAccess(user, 'hr') ||
        canAccess(user, 'hr', 'hr_dashboard') ||
        canAccess(user, 'hr', 'ga_security') ||
        canAccess(user, 'hr', 'ga_hk') ||
        canAccess(user, 'hr', 'ga_aset') ||
        canAccess(user, 'hr', 'training_videos') ||
        canAccess(user, 'hr', 'training_karyawan'),
      groups: [
        {
          groupId: 'hr-personalia',
          groupTitle: 'Data, Rolling & History Karyawan',
          groupIcon: <Users className="w-4 h-4 text-indigo-500" />,
          items: [
            {
              tab: 'hr_dashboard',
              label: 'HR',
              icon: <Users className="w-4 h-4 text-indigo-500" />,
              description: 'Data karyawan, rolling posisi & history departemen'
            }
          ]
        },
        {
          groupId: 'hr-ga',
          groupTitle: 'General Affairs (GA) & Keamanan',
          groupIcon: <ShieldAlert className="w-4 h-4 text-rose-500" />,
          items: [
            {
              tab: 'ga_security',
              label: 'GA',
              icon: <ShieldAlert className="w-4 h-4 text-rose-500" />,
              description: 'Security pos gerbang, housekeeping 5R & manajemen aset pabrik'
            }
          ]
        },
        {
          groupId: 'hr-training',
          groupTitle: 'Pengembangan & Training',
          groupIcon: <Award className="w-4 h-4 text-emerald-500" />,
          items: [
            {
              tab: 'training_videos',
              label: 'Training & Development',
              icon: <Award className="w-4 h-4 text-emerald-500" />,
              description: 'Video training SOP & pelatihan sertifikasi karyawan'
            }
          ]
        }
      ]
    },
    {
      id: 'system_master',
      label: 'Master Data & Sistem',
      shortLabel: 'Sistem',
      icon: <Settings className="w-5 h-5" />,
      badge: pendingUsersCount > 0 ? (
        <span className="text-[10px] font-bold bg-amber-500 text-slate-950 px-1.5 py-0.2 rounded-full animate-pulse">
          {pendingUsersCount}
        </span>
      ) : undefined,
      checkAccess: (user) => canAccess(user, 'sistem_pengguna'),
      groups: [
        {
          groupId: 'sys-org',
          groupTitle: 'Organisasi & Hak Akses',
          groupIcon: <Users className="w-4 h-4 text-blue-500" />,
          items: [
            {
              tab: 'users',
              label: 'Manajemen User & Approval',
              icon: <Users className="w-4 h-4 text-blue-500" />,
              badge: pendingUsersCount > 0 ? (
                <span className="text-[9px] font-bold bg-amber-500 text-slate-950 px-1.5 py-0.2 rounded-full">
                  {pendingUsersCount} antre
                </span>
              ) : undefined,
              description: 'Kelola akun staf, supir, dan persetujuan'
            },
            {
              tab: 'branches',
              label: 'Master Cabang Operasional',
              icon: <Building2 className="w-4 h-4 text-indigo-500" />,
              description: 'Cabang Banyuwangi, Surabaya, Denpasar, dll.'
            }
          ]
        },
        {
          groupId: 'sys-audit',
          groupTitle: 'Audit, Pengujian & Arsitektur',
          groupIcon: <Database className="w-4 h-4 text-cyan-500" />,
          items: [
            {
              tab: 'activity_log',
              label: 'Log Aktivitas Sistem',
              icon: <History className="w-4 h-4 text-amber-500" />,
              description: 'Catatan audit jejak login dan perubahan data'
            },
            {
              tab: 'e2e_testing',
              label: 'Pengujian E2E Otomatis',
              icon: <ShieldCheck className="w-4 h-4 text-emerald-500" />,
              description: 'Simulasi alur logistik end-to-end'
            },
            {
              tab: 'architecture',
              label: 'Skema Database SQL',
              icon: <Database className="w-4 h-4 text-cyan-500" />,
              description: 'Struktur relasional dan blueprint penyimpanan'
            }
          ]
        }
      ]
    }
  ];

  // Filter categories AND their sub-menu items based on granular RBAC permissions
  const visibleCategories: NavCategory[] = categories
    .filter(cat => cat.checkAccess(currentUser))
    .map(cat => {
      const filteredGroups = cat.groups
        .map(group => ({
          ...group,
          items: group.items.filter(item => canAccess(currentUser, item.tab))
        }))
        .filter(group => group.items.length > 0);

      // Hide pendingReportsCount badge on Logistik category if user does not have access to driver_reports
      const canSeeDriverReports = filteredGroups.some(g =>
        g.items.some(i => i.tab === 'driver_reports')
      );

      return {
        ...cat,
        badge: cat.id === 'logistik' && !canSeeDriverReports ? undefined : cat.badge,
        groups: filteredGroups
      };
    })
    .filter(cat => cat.groups.length > 0);

  const isNavItemActive = (itemTab: NavTab): boolean => {
    if (currentTab === itemTab) return true;
    if (itemTab === 'operational_dashboard' && currentTab === 'analytics_reports') return true;
    if (itemTab === 'ga_security' && (currentTab === 'ga_hk' || currentTab === 'ga_aset')) return true;
    if (itemTab === 'training_videos' && currentTab === 'training_karyawan') return true;
    return false;
  };

  // Determine if a category contains the currently active tab
  const isCategoryActive = (cat: NavCategory): boolean => {
    if (cat.defaultTab === currentTab) return true;
    if (cat.id === 'logistik' && (currentTab === 'operational_dashboard' || currentTab === 'analytics_reports')) return true;
    if (
      cat.id === 'hr' &&
      ['hr_dashboard', 'ga_security', 'ga_hk', 'ga_aset', 'training_videos', 'training_karyawan'].includes(currentTab)
    ) {
      return true;
    }
    for (const group of cat.groups) {
      if (group.items.some(item => isNavItemActive(item.tab))) return true;
    }
    return false;
  };

  // Determine active category object
  const activeCategory = visibleCategories.find(c => c.id === activeCategoryId);

  const isSubGroupExpanded = (cat: NavCategory, group: SimpleDropdownGroup): boolean => {
    const key = `${cat.id}::${group.groupId}`;
    return Boolean(expandedSubGroups[key]);
  };

  const toggleSubGroup = (catId: string, groupId: string, currentlyExpanded: boolean) => {
    const key = `${catId}::${groupId}`;
    setExpandedSubGroups(currentlyExpanded ? {} : { [key]: true });
  };

  return (
    <>
      {/* ============================================================== */}
      {/* MOBILE TOP BAR (lg:hidden)                                     */}
      {/* ============================================================== */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-[1100] h-16 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 px-4 flex items-center justify-between">
        <button
          onClick={() => setIsMobileOpen(!isMobileOpen)}
          className="p-2 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer transition active:scale-95"
          aria-label="Toggle Navigation Menu"
        >
          {isMobileOpen ? <X className="w-5 h-5 text-amber-500" /> : <Menu className="w-5 h-5" />}
        </button>

        <AkkLogo size="sm" showSubtitle={false} />

        <div className="flex items-center gap-2">
          <ThemeSwitcher variant="icon-only" />
          <button
            onClick={() => onOpenAuth('login')}
            className="p-2 rounded-xl border border-slate-200 dark:border-slate-800 text-amber-500 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer transition active:scale-95"
            title="Masuk / Kelola Akun"
          >
            <LogIn className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* ============================================================== */}
      {/* DESKTOP SIDEBAR CONTAINER (lg:block)                           */}
      {/* ============================================================== */}
      <aside
        ref={asideRef}
        onMouseLeave={handleMouseLeaveCat}
        className={`hidden lg:block fixed inset-y-0 left-0 z-[1100] transition-[width] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] will-change-[width] overflow-visible ${
          isMinimized ? 'w-20' : 'w-72'
        }`}
      >
        <div className="h-full relative flex flex-col justify-between bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800">
          {/* Top Brand Header */}
          <div className={`border-b border-slate-200 dark:border-slate-800 transition-all ${
            isMinimized ? 'p-3 flex flex-col items-center justify-center' : 'px-5 py-4'
          }`}>
            {isMinimized ? (
              <div className="flex flex-col items-center gap-3 w-full">
                <div
                  onClick={() => handleTabClick('dashboard')}
                  className="cursor-pointer hover:opacity-85 transition"
                  title="PT Anugrah Kemasan Kreatif"
                >
                  <AkkLogo size="md" showText={false} />
                </div>

                {onToggleMinimize && (
                  <button
                    onClick={onToggleMinimize}
                    className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-blue-600 hover:text-white dark:hover:bg-blue-600 dark:hover:text-white flex items-center justify-center transition cursor-pointer shadow-xs"
                    title="Perlebar Sidebar"
                    aria-label="Perlebar Sidebar"
                  >
                    <ChevronRight className="w-4 h-4 stroke-[2.5]" />
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

                {onToggleMinimize && (
                  <button
                    onClick={onToggleMinimize}
                    className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-blue-600 hover:text-white dark:hover:bg-blue-600 dark:hover:text-white flex items-center justify-center transition cursor-pointer shrink-0 shadow-xs"
                    title="Minimalkan Sidebar"
                    aria-label="Minimalkan Sidebar"
                  >
                    <ChevronLeft className="w-4 h-4 stroke-[2.5]" />
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Primary Menu Column (Level 1 Categories - Zero vertical scrolling!) */}
          <nav className="p-2.5 space-y-1.5 flex-1 overflow-visible">
            {!isMinimized && (
              <div className="px-3 pt-1 pb-1">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                  Modul Operasional
                </span>
              </div>
            )}

            {visibleCategories.map((cat) => {
              const active = isCategoryActive(cat);
              const isOpen = activeCategoryId === cat.id;

              return (
                <div key={cat.id} className="relative">
                  <button
                    ref={(el) => { categoryRefs.current[cat.id] = el; }}
                    type="button"
                    onClick={() => handleCategoryClick(cat)}
                    onMouseEnter={() => handleMouseEnterCat(cat.id)}
                    className={`group relative w-full flex items-center transition-all duration-200 rounded-xl cursor-pointer ${
                      isMinimized
                        ? 'justify-center p-3'
                        : 'justify-between px-3.5 py-2.5'
                    } ${
                      isOpen
                        ? 'bg-blue-600 text-white font-semibold shadow-md shadow-blue-500/20'
                        : active
                        ? 'bg-blue-50 dark:bg-blue-500/15 text-blue-600 dark:text-blue-400 font-semibold'
                        : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/80 font-medium'
                    }`}
                    title={isMinimized && activeCategoryId !== cat.id ? cat.label : undefined}
                  >
                    <div className={`flex items-center min-w-0 ${isMinimized ? 'gap-0' : 'gap-3'}`}>
                      <span className={`shrink-0 transition-colors ${
                        isOpen
                          ? 'text-white'
                          : active
                          ? 'text-blue-600 dark:text-blue-400'
                          : 'text-slate-500 dark:text-slate-400 group-hover:text-slate-900 dark:group-hover:text-white'
                      }`}>
                        {cat.icon}
                      </span>
                      {!isMinimized && (
                        <span className="text-xs truncate tracking-tight">
                          {cat.label}
                        </span>
                      )}
                    </div>

                    {!isMinimized && (
                      <div className="flex items-center gap-1.5 shrink-0 ml-1">
                        {cat.badge}
                        <ChevronRight className={`w-3.5 h-3.5 transition-transform duration-200 ${
                          isOpen ? 'translate-x-0.5 text-white' : 'text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-300'
                        }`} />
                      </div>
                    )}
                  </button>
                </div>
              );
            })}
          </nav>

          {/* ========================================================== */}
          {/* MULTI-LEVEL NESTED DROPDOWN CARD                           */}
          {/* Level 1 (Category) -> Level 2 (Sub-Group Accordion) ->     */}
          {/* Level 3 (Sub-Menu Items)                                   */}
          {/* ========================================================== */}
          {activeCategory && activeCategoryId && (
            <div
              ref={dropdownRef}
              onMouseEnter={handleMouseEnterDropdown}
              onMouseLeave={handleMouseLeaveDropdown}
              style={{
                position: 'fixed',
                left: isMinimized ? '88px' : '296px',
                top: `${dropdownTop}px`,
                zIndex: 1200
              }}
              className="hidden lg:block animate-in fade-in zoom-in-95 duration-150 before:absolute before:-left-6 before:top-0 before:bottom-0 before:w-8 before:bg-transparent"
            >
              <div
                style={{ maxHeight: `calc(100vh - ${dropdownTop + 16}px)` }}
                className="w-[340px] overflow-y-auto overscroll-contain rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-2xl shadow-slate-900/15 dark:shadow-slate-950/70 p-2.5 pb-3.5 text-left"
              >
                {/* Level 1 Category Header + Expand/Collapse All */}
                <div className="px-2.5 py-2 border-b border-slate-100 dark:border-slate-800/80 mb-2 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-blue-600 dark:text-blue-400 shrink-0">
                      {activeCategory.icon}
                    </span>
                    <span className="text-xs font-bold text-slate-900 dark:text-white truncate">
                      {activeCategory.label}
                    </span>
                  </div>
                  {activeCategory.badge && (
                    <div className="flex items-center gap-1.5 shrink-0">
                      {activeCategory.badge}
                    </div>
                  )}
                </div>

                {/* Level 2 Nested Sub-Group Dropdowns -> Level 3 Items */}
                <div className="space-y-1.5">
                  {activeCategory.groups.map((group) => {
                    const hasGroupActiveItem = group.items.some(item => isNavItemActive(item.tab));
                    const isGroupOpen = isSubGroupExpanded(activeCategory, group);

                    if (!group.groupTitle) {
                      return (
                        <div key={group.groupId} className="space-y-0.5">
                          {group.items.map((item) => {
                            const isItemActive = isNavItemActive(item.tab);
                            return (
                              <button
                                key={item.tab}
                                type="button"
                                onMouseEnter={() => preloadTabModule(item.tab)}
                                onFocus={() => preloadTabModule(item.tab)}
                                onClick={() => handleTabClick(item.tab)}
                                className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-left transition-all cursor-pointer ${
                                  isItemActive
                                    ? 'bg-blue-600 text-white font-semibold shadow-xs'
                                    : 'hover:bg-slate-100/80 dark:hover:bg-slate-800/80 text-slate-700 dark:text-slate-200'
                                }`}
                              >
                                <span className={`shrink-0 ${isItemActive ? 'text-white' : 'text-slate-400 dark:text-slate-400'}`}>
                                  {item.icon}
                                </span>
                                <span className="text-xs truncate font-medium flex-1">
                                  {item.label}
                                </span>
                                {item.badge && !isItemActive && <span className="shrink-0">{item.badge}</span>}
                              </button>
                            );
                          })}
                        </div>
                      );
                    }

                    return (
                      <div
                        key={group.groupId}
                        className={`rounded-xl border transition-colors ${
                          isGroupOpen
                            ? 'border-slate-200/90 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/35'
                            : 'border-transparent hover:border-slate-200/70 dark:hover:border-slate-800/80 bg-transparent'
                        }`}
                      >
                        {/* Level 2 Group Toggle Button */}
                        <button
                          type="button"
                          onClick={() => toggleSubGroup(activeCategory.id, group.groupId, isGroupOpen)}
                          className={`w-full flex items-center justify-between gap-2 px-2.5 py-2 rounded-xl text-left transition cursor-pointer ${
                            hasGroupActiveItem
                              ? 'text-blue-600 dark:text-blue-400'
                              : 'text-slate-700 dark:text-slate-200 hover:bg-slate-100/80 dark:hover:bg-slate-800/70'
                          }`}
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="w-6 h-6 rounded-lg bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700/80 flex items-center justify-center shrink-0 shadow-2xs">
                              {group.groupIcon || <Layers className="w-3.5 h-3.5 text-slate-500" />}
                            </span>
                            <span className="text-[11.5px] font-bold tracking-tight truncate">
                              {group.groupTitle}
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            {hasGroupActiveItem && (
                              <span className="w-1.5 h-1.5 rounded-full bg-blue-600 dark:bg-blue-400" />
                            )}
                            <span className="text-[10px] font-semibold px-1.5 py-0.2 rounded-full bg-slate-200/70 dark:bg-slate-700/80 text-slate-600 dark:text-slate-300">
                              {group.items.length}
                            </span>
                            <ChevronDown
                              className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ${
                                isGroupOpen ? 'rotate-180 text-blue-600 dark:text-blue-400' : ''
                              }`}
                            />
                          </div>
                        </button>

                        {/* Level 3 Nested Sub-Menu Items */}
                        {isGroupOpen && (
                          <div className="pl-4 pr-1.5 pb-2 pt-0.5 space-y-0.5 ml-4 border-l-2 border-slate-200 dark:border-slate-700/90">
                            {group.items.map((item) => {
                              const isItemActive = isNavItemActive(item.tab);
                              return (
                                <button
                                  key={item.tab}
                                  type="button"
                                  onMouseEnter={() => preloadTabModule(item.tab)}
                                  onFocus={() => preloadTabModule(item.tab)}
                                  onClick={() => handleTabClick(item.tab)}
                                  className={`w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-left transition-all cursor-pointer ${
                                    isItemActive
                                      ? 'bg-blue-600 text-white font-semibold shadow-xs'
                                      : 'hover:bg-white dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200'
                                  }`}
                                >
                                  <span className={`shrink-0 ${isItemActive ? 'text-white' : 'text-slate-400 dark:text-slate-400'}`}>
                                    {item.icon}
                                  </span>
                                  <span className="text-[11.5px] truncate font-medium flex-1">
                                    {item.label}
                                  </span>
                                  {item.badge && !isItemActive && (
                                    <span className="shrink-0">{item.badge}</span>
                                  )}
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Sidebar Bottom Footer */}
          {isMinimized ? (
            <div className="p-3 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-col items-center gap-2 shrink-0">
              <ThemeSwitcher variant="icon-only" />

              <button
                onClick={() => logisticsStore.logoutUser()}
                className="p-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-500 hover:text-rose-600 dark:hover:text-rose-400 transition cursor-pointer"
                title="Keluar Sesi (Logout)"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <div className="p-3.5 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-2 shrink-0">
              <div className="flex items-center justify-between gap-2">
                <ThemeSwitcher />
                <button
                  type="button"
                  onClick={() => logisticsStore.logoutUser()}
                  className="py-2 px-3 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 hover:bg-rose-50 dark:hover:bg-rose-500/15 hover:border-rose-300 text-slate-600 dark:text-slate-300 hover:text-rose-600 dark:hover:text-rose-400 text-xs font-semibold flex items-center justify-center gap-1.5 transition cursor-pointer"
                  title="Keluar Sesi"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Keluar Sesi</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </aside>

      {/* ============================================================== */}
      {/* MOBILE ACCORDION DRAWER (lg:hidden)                            */}
      {/* ============================================================== */}
      {isMobileOpen && (
        <div className="lg:hidden fixed inset-0 z-[1200] flex">
          <div
            className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs transition-opacity duration-300"
            onClick={() => setIsMobileOpen(false)}
          />
          <div className="relative w-80 max-w-[85vw] h-full bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 flex flex-col justify-between overflow-y-auto shadow-2xl z-10 animate-in slide-in-from-left duration-200 ease-out">
            <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <AkkLogo size="sm" showSubtitle={true} />
              <button
                onClick={() => setIsMobileOpen(false)}
                className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <nav className="p-3 space-y-2 flex-1 overflow-y-auto">
              {visibleCategories.map((cat) => {
                const isCatExpanded = mobileExpandedCat === cat.id;
                const active = isCategoryActive(cat);

                return (
                  <div key={cat.id} className="rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
                    <button
                      type="button"
                      onClick={() => {
                        const totalItems = cat.groups.reduce((acc, g) => acc + g.items.length, 0);
                        if (totalItems === 1 && cat.groups[0]?.items[0]) {
                          handleTabClick(cat.groups[0].items[0].tab);
                        } else {
                          setMobileExpandedCat(isCatExpanded ? null : cat.id);
                        }
                      }}
                      className={`w-full flex items-center justify-between p-3 text-xs font-bold transition ${
                        active
                          ? 'bg-blue-50 dark:bg-blue-500/15 text-blue-600 dark:text-blue-400'
                          : 'bg-slate-50 dark:bg-slate-800/50 text-slate-800 dark:text-slate-200'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <span className={active ? 'text-blue-600 dark:text-blue-400' : 'text-slate-500'}>
                          {cat.icon}
                        </span>
                        <span>{cat.label}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        {cat.badge}
                        <ChevronDown className={`w-4 h-4 transition-transform ${isCatExpanded ? 'rotate-180' : ''}`} />
                      </div>
                    </button>

                    {isCatExpanded && (
                      <div className="p-2 space-y-1.5 bg-white dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800">
                        {cat.groups.map((group) => {
                          const hasGroupActiveItem = group.items.some(item => isNavItemActive(item.tab));
                          const isGroupOpen = isSubGroupExpanded(cat, group);

                          if (!group.groupTitle) {
                            return (
                              <div key={group.groupId} className="space-y-0.5">
                                {group.items.map((item) => {
                                  const isCur = isNavItemActive(item.tab);
                                  return (
                                    <button
                                      key={item.tab}
                                      onClick={() => handleTabClick(item.tab)}
                                      className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium text-left transition ${
                                        isCur
                                          ? 'bg-blue-600 text-white font-semibold'
                                          : 'text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                                      }`}
                                    >
                                      <div className="flex items-center gap-2 min-w-0">
                                        <span className={isCur ? 'text-white' : 'text-slate-400'}>{item.icon}</span>
                                        <span className="truncate">{item.label}</span>
                                      </div>
                                      {item.badge && !isCur && <span className="shrink-0 ml-1">{item.badge}</span>}
                                    </button>
                                  );
                                })}
                              </div>
                            );
                          }

                          return (
                            <div
                              key={group.groupId}
                              className={`rounded-xl border transition-colors ${
                                isGroupOpen
                                  ? 'border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40'
                                  : 'border-slate-100 dark:border-slate-800/60 bg-transparent'
                              }`}
                            >
                              {/* Mobile Level 2 Group Header */}
                              <button
                                type="button"
                                onClick={() => toggleSubGroup(cat.id, group.groupId, isGroupOpen)}
                                className={`w-full flex items-center justify-between gap-2 px-2.5 py-2 text-left text-[11.5px] font-bold transition ${
                                  hasGroupActiveItem
                                    ? 'text-blue-600 dark:text-blue-400'
                                    : 'text-slate-700 dark:text-slate-200'
                                }`}
                              >
                                <div className="flex items-center gap-2 min-w-0">
                                  <span className="shrink-0">{group.groupIcon || <Layers className="w-3.5 h-3.5 text-slate-400" />}</span>
                                  <span className="truncate">{group.groupTitle}</span>
                                </div>
                                <div className="flex items-center gap-1.5 shrink-0">
                                  <span className="text-[10px] font-semibold px-1.5 py-0.2 rounded-full bg-slate-200/70 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                                    {group.items.length}
                                  </span>
                                  <ChevronDown className={`w-3.5 h-3.5 transition-transform ${isGroupOpen ? 'rotate-180 text-blue-600 dark:text-blue-400' : 'text-slate-400'}`} />
                                </div>
                              </button>

                              {/* Mobile Level 3 Items */}
                              {isGroupOpen && (
                                <div className="pl-3 pr-1.5 pb-2 pt-0.5 space-y-0.5 ml-3.5 border-l-2 border-slate-200 dark:border-slate-700">
                                  {group.items.map((item) => {
                                    const isCur = isNavItemActive(item.tab);
                                    return (
                                      <button
                                        key={item.tab}
                                        onClick={() => handleTabClick(item.tab)}
                                        className={`w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-[11.5px] font-medium text-left transition ${
                                          isCur
                                            ? 'bg-blue-600 text-white font-semibold'
                                            : 'text-slate-700 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-800'
                                        }`}
                                      >
                                        <div className="flex items-center gap-2 min-w-0">
                                          <span className={isCur ? 'text-white' : 'text-slate-400'}>{item.icon}</span>
                                          <span className="truncate">{item.label}</span>
                                        </div>
                                        {item.badge && !isCur && <span className="shrink-0 ml-1">{item.badge}</span>}
                                      </button>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </nav>

            <div className="p-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <ThemeSwitcher />
              <button
                onClick={() => logisticsStore.logoutUser()}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30"
              >
                <LogOut className="w-4 h-4" />
                <span>Keluar</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Android APK Modal (lazy-loaded only when opened) */}
      {isApkModalOpen && (
        <React.Suspense fallback={null}>
          <AndroidApkDownloadModal
            isOpen={isApkModalOpen}
            onClose={() => setIsApkModalOpen(false)}
          />
        </React.Suspense>
      )}
    </>
  );
};

export const Sidebar = React.memo(SidebarComponent);
export default Sidebar;

