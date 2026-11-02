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
  Clock
} from 'lucide-react';
import { AkkLogo } from './AkkLogo';
import { ThemeSwitcher } from './ThemeSwitcher';
import { AndroidApkDownloadModal } from './AndroidApkDownloadModal';
import { UserProfile } from '../types';
import { logisticsStore } from '../services/store';
import { driverReportService } from '../services/driverReportService';
import { canAccess } from '../utils/rbac';

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

// Simple Dropdown navigation data structures
export interface SimpleDropdownItem {
  tab: NavTab;
  label: string;
  icon: React.ReactNode;
  badge?: React.ReactNode;
  description?: string;
}

export interface SimpleDropdownGroup {
  groupTitle?: string;
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
  const [isApkModalOpen, setIsApkModalOpen] = useState(false);

  // Active category dropdown state (Simple Dropdown pattern)
  const [activeCategoryId, setActiveCategoryId] = useState<string | null>(null);
  const [dropdownTop, setDropdownTop] = useState<number>(80);

  const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const closeTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const dropdownRef = useRef<HTMLDivElement | null>(null);
  const asideRef = useRef<HTMLElement | null>(null);
  const categoryRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  // Mobile accordion state
  const [mobileExpandedCat, setMobileExpandedCat] = useState<string | null>(null);

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
    const syncUser = () => {
      setCurrentUser({ ...logisticsStore.getCurrentUser() });
      setPendingUsersCount(logisticsStore.getPendingUsersCount());
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
      // Clamp so dropdown fits comfortably inside viewport without jumping
      const clamped = Math.max(16, Math.min(rect.top, window.innerHeight - 440));
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

  // Define Navigation Schema with "Dashboard Operasional" & "Analitik Armada & Kru" in Logistik & Pengiriman
  const categories: NavCategory[] = [
    {
      id: 'dashboard',
      label: 'Dashboard & Eksekutif',
      shortLabel: 'Overview',
      icon: <LayoutDashboard className="w-5 h-5" />,
      defaultTab: 'dashboard',
      checkAccess: (user) => canAccess(user, 'dashboard') || canAccess(user, 'logistics', 'dashboard_logistik'),
      groups: [
        {
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
      badge: pendingReportsCount > 0 ? (
        <span className="text-[10px] font-bold bg-rose-500 text-white px-1.5 py-0.2 rounded-full">
          {pendingReportsCount}
        </span>
      ) : undefined,
      checkAccess: (user) =>
        canAccess(user, 'logistics', 'portal_driver') ||
        canAccess(user, 'logistics', 'monitoring_sla') ||
        canAccess(user, 'logistics', 'dashboard_logistik') ||
        canAccess(user, 'logistics', 'rencana_rute') ||
        canAccess(user, 'logistics', 'armada_ceklis'),
      groups: [
        {
          groupTitle: 'Dashboard & Analitik Logistik',
          items: [
            {
              tab: 'operational_dashboard',
              label: 'Dashboard Operasional',
              icon: <Truck className="w-4 h-4 text-blue-500" />,
              description: 'Monitoring armada & status pengiriman real-time'
            },
            {
              tab: 'analytics_reports',
              label: 'Analitik Armada & Kru',
              icon: <BarChart3 className="w-4 h-4 text-indigo-500" />,
              description: 'Metrik produktivitas supir dan utilitas kendaraan'
            }
          ]
        },
        {
          groupTitle: 'Jadwal & Distribusi',
          items: [
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
            }
          ]
        },
        {
          groupTitle: 'Monitoring & Rute GPS',
          items: [
            {
              tab: 'fleet_forms',
              label: 'Formulir & Ceklis Muat',
              icon: <FileText className="w-4 h-4 text-amber-500" />,
              description: 'Checklist sebelum jalan & surat jalan'
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
              description: 'Kendala perjalanan, penyerahan & foto bukti'
            },
            {
              tab: 'tracking_eval',
              label: 'Evaluasi Jalur GPS (Excel)',
              icon: <FileSpreadsheet className="w-4 h-4 text-emerald-500" />,
              description: 'Unggah file Excel tracking GPS vendor'
            },
            {
              tab: 'customer_map',
              label: 'Jaringan Toko & Wilayah Mitra',
              icon: <MapIcon className="w-4 h-4 text-indigo-500" />,
              description: 'Peta sebaran retail store Jawa Timur & Bali'
            }
          ]
        },
        {
          groupTitle: 'Armada & Perawatan',
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
              tab: 'fuel_efficiency',
              label: 'Efisiensi Bahan Bakar (BBM)',
              icon: <Fuel className="w-4 h-4 text-rose-500" />,
              description: 'Analisis rasio km/liter dan konsumsi armada'
            }
          ]
        },
        {
          groupTitle: 'Simulasi Muatan Armada',
          items: [
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
      checkAccess: (user) =>
        canAccess(user, 'warehouse', 'stok_barang') ||
        canAccess(user, 'warehouse', 'permintaan_barang') ||
        canAccess(user, 'warehouse', 'opname_stok') ||
        canAccess(user, 'warehouse', 'ceklis_muat'),
      groups: [
        {
          groupTitle: 'Spesifikasi & Kubikasi',
          items: [
            {
              tab: 'warehouse_cubication',
              label: 'Dimensi & Kubikasi Barang',
              icon: <Layers className="w-4 h-4 text-emerald-500" />,
              badge: <span className="text-[9px] font-bold text-emerald-600 dark:text-emerald-400">m³ & Kg</span>,
              description: 'Master ukuran m³ & berat satuan kemasan'
            }
          ]
        },
        {
          groupTitle: 'Inventori & Rak Gudang',
          items: [
            {
              tab: 'warehouse_dashboard',
              label: 'Ringkasan Gudang (WMS)',
              icon: <Building2 className="w-4 h-4 text-blue-500" />,
              description: 'Statistik okupansi ruang dan kapasitas'
            },
            {
              tab: 'warehouse_inventory',
              label: 'Master SKU & Stok Bin',
              icon: <Package className="w-4 h-4 text-indigo-500" />,
              description: 'Daftar produk, karton box, dan stok aktif'
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
          groupTitle: 'Operasi Muat & Inbound',
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
              label: 'Stok Opname & Kartu Stok',
              icon: <ClipboardCheck className="w-4 h-4 text-purple-500" />,
              description: 'Audit periodik fisik vs sistem'
            },
            {
              tab: 'warehouse_scanner',
              label: 'Pemindaian Barcode & AI',
              icon: <Camera className="w-4 h-4 text-amber-500" />,
              description: 'Scan label karton box menggunakan kamera'
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
      checkAccess: (user) =>
        canAccess(user, 'sales_admin', 'dashboard_penjualan') ||
        canAccess(user, 'sales_admin', 'aktivitas_harian') ||
        canAccess(user, 'sales_admin', 'jadwal_admin') ||
        canAccess(user, 'sales_admin', 'durasi_muat') ||
        canAccess(user, 'sales_admin', 'matriks_skil') ||
        canAccess(user, 'sales_admin', 'data_kpi'),
      groups: [
        {
          groupTitle: 'Aktivitas Harian Admin',
          items: [
            {
              tab: 'sales_dashboard',
              label: 'Dashboard Sales Hub',
              icon: <Briefcase className="w-4 h-4 text-blue-500" />,
              description: 'Monitoring aktivitas terpadu sales admin'
            },
            {
              tab: 'sales_activities',
              label: 'Checklist Aktivitas Harian',
              icon: <Activity className="w-4 h-4 text-blue-500" />,
              description: 'Input dan verifikasi checklist tugas'
            },
            {
              tab: 'sales_schedules',
              label: 'Jadwal Admin & Produksi',
              icon: <Calendar className="w-4 h-4 text-indigo-500" />,
              description: 'Sinkronisasi pesanan kirim dengan pabrik'
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
          groupTitle: 'Kompetensi & Jobdesk',
          items: [
            {
              tab: 'sales_skill_matrix',
              label: 'Matriks Skill Admin',
              icon: <Award className="w-4 h-4 text-emerald-500" />,
              description: 'Level keahlian dan sertifikasi admin'
            },
            {
              tab: 'sales_jobdesk',
              label: 'Pengaturan SOP & Jobdesk',
              icon: <Settings className="w-4 h-4 text-slate-500" />,
              description: 'Pembagian wewenang dan alur kerja'
            }
          ]
        },
        {
          groupTitle: 'Data KPI Penjualan',
          items: [
            {
              tab: 'sales_kpi_individual',
              label: '1. KPI Individu Staf',
              icon: <User className="w-4 h-4 text-blue-500" />,
              description: 'Skor performa dan pemenuhan target'
            },
            {
              tab: 'sales_kpi_fines',
              label: '2. Akumulasi Denda',
              icon: <ShieldAlert className="w-4 h-4 text-rose-500" />,
              description: 'Pinalti keterlambatan atau ketidaksesuaian'
            },
            {
              tab: 'sales_kpi_nusantara',
              label: '3. Persentase Kiriman',
              icon: <Percent className="w-4 h-4 text-indigo-500" />,
              description: 'Tingkat keberhasilan distribusi nusantara'
            },
            {
              tab: 'sales_kpi_omset',
              label: '4. Omset Admin Penjualan',
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
      checkAccess: (user) =>
        canAccess(user, 'purchasing', 'permintaan_pembelian') ||
        canAccess(user, 'purchasing', 'po_vendor') ||
        user.role === 'super_admin' ||
        user.role === 'spv_logistik',
      groups: [
        {
          groupTitle: 'Admin Pembelian (PO)',
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
        }
      ]
    },
    {
      id: 'marketing',
      label: 'Marketing',
      shortLabel: 'Marketing',
      icon: <Megaphone className="w-5 h-5" />,
      checkAccess: (user) =>
        canAccess(user, 'marketing', 'kampanye') ||
        canAccess(user, 'finance_tax', 'kas_bank') ||
        user.role === 'super_admin' ||
        user.role === 'spv_logistik',
      groups: [
        {
          groupTitle: 'Marketing & Keuangan',
          items: [
            {
              tab: 'marketing_online',
              label: 'Marketing Online & Ads',
              icon: <Globe className="w-4 h-4 text-cyan-500" />,
              description: 'Kampanye digital dan inbound leads'
            },
            {
              tab: 'marketing_offline',
              label: 'Marketing Offline / Kunjungan',
              icon: <Megaphone className="w-4 h-4 text-amber-500" />,
              description: 'Pipeline prospek pabrik dan industri'
            },
            {
              tab: 'finance_dashboard',
              label: 'Finance & Tagihan Pelanggan',
              icon: <FileText className="w-4 h-4 text-emerald-500" />,
              description: 'Faktur penjualan dan konfirmasi piutang'
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
        canAccess(user, 'hr', 'hr_data_karyawan') ||
        user.role === 'super_admin' ||
        user.role === 'spv_logistik',
      groups: [
        {
          groupTitle: 'Personalia & Presensi',
          items: [
            {
              tab: 'hr_dashboard',
              label: 'Dashboard SDM & Presensi',
              icon: <Users className="w-4 h-4 text-indigo-500" />,
              description: 'Data karyawan, presensi kru & rekap kehadiran'
            }
          ]
        }
      ]
    },
    {
      id: 'ga',
      label: 'GA',
      shortLabel: 'GA',
      icon: <ShieldAlert className="w-5 h-5" />,
      checkAccess: (user) =>
        canAccess(user, 'hr', 'ga_security') ||
        user.role === 'super_admin' ||
        user.role === 'spv_logistik',
      groups: [
        {
          groupTitle: 'General Affair (GA)',
          items: [
            {
              tab: 'ga_security',
              label: 'Security & Keamanan',
              icon: <ShieldAlert className="w-4 h-4 text-rose-500" />,
              description: 'Log buku tamu dan jadwal patroli gerbang'
            },
            {
              tab: 'ga_hk',
              label: 'Housekeeping (Sanitasi)',
              icon: <Brush className="w-4 h-4 text-cyan-500" />,
              description: 'Ceklis kebersihan gudang dan kantor'
            },
            {
              tab: 'ga_aset',
              label: 'Manajemen Aset Pabrik',
              icon: <Building2 className="w-4 h-4 text-amber-500" />,
              description: 'Inventaris mesin, forklift, dan perlengkapan'
            }
          ]
        }
      ]
    },
    {
      id: 'training_dev',
      label: 'Training Development',
      shortLabel: 'Training',
      icon: <Award className="w-5 h-5" />,
      checkAccess: (user) =>
        canAccess(user, 'hr', 'td_video_training') ||
        user.role === 'super_admin' ||
        user.role === 'spv_logistik',
      groups: [
        {
          groupTitle: 'Pelatihan & SOP',
          items: [
            {
              tab: 'training_videos',
              label: 'Video Training SOP',
              icon: <Video className="w-4 h-4 text-blue-500" />,
              description: 'Video panduan muat dan keselamatan kerja'
            },
            {
              tab: 'training_karyawan',
              label: 'Modul Pelatihan Karyawan',
              icon: <Award className="w-4 h-4 text-emerald-500" />,
              description: 'Ujian pemahaman dan sertifikasi internal'
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
      checkAccess: (user) =>
        canAccess(user, 'sistem_pengguna', 'daftar_pengguna') ||
        canAccess(user, 'sistem_pengguna', 'log_aktivitas_sistem') ||
        user.role === 'super_admin' ||
        user.role === 'spv_logistik',
      groups: [
        {
          groupTitle: 'Organisasi & Hak Akses',
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
          groupTitle: 'Audit & Arsitektur',
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

  // Determine if a category contains the currently active tab
  const isCategoryActive = (cat: NavCategory): boolean => {
    if (cat.defaultTab === currentTab) return true;
    for (const group of cat.groups) {
      if (group.items.some(item => item.tab === currentTab)) return true;
    }
    return false;
  };

  // Determine active category object
  const activeCategory = visibleCategories.find(c => c.id === activeCategoryId);

  return (
    <>
      {/* ============================================================== */}
      {/* MOBILE TOP BAR (lg:hidden)                                     */}
      {/* ============================================================== */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-40 h-16 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 px-4 flex items-center justify-between">
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
        className={`hidden lg:block fixed inset-y-0 left-0 z-30 transition-[width] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] will-change-[width] overflow-visible ${
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
                    title={isMinimized ? cat.label : undefined}
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

                    {/* Small badge dot for minimized mode */}
                    {isMinimized && cat.badge && (
                      <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-rose-500 ring-2 ring-white dark:ring-slate-900" />
                    )}
                  </button>
                </div>
              );
            })}
          </nav>

          {/* ========================================================== */}
          {/* SIMPLE DROPDOWN CARD (Style inspired by Lumen Dropdown)    */}
          {/* Single clean card right beside the sidebar without jitter  */}
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
                zIndex: 60
              }}
              className="hidden lg:block animate-in fade-in zoom-in-95 duration-150 before:absolute before:-left-6 before:top-0 before:bottom-0 before:w-8 before:bg-transparent"
            >
              <div className="w-80 max-h-[calc(100vh-80px)] overflow-y-auto rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-2xl shadow-slate-900/15 dark:shadow-slate-950/70 p-2.5 text-left">
                {/* Clean Category Header */}
                <div className="px-2.5 py-2 border-b border-slate-100 dark:border-slate-800/80 mb-1.5 flex items-center justify-between">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-blue-600 dark:text-blue-400 shrink-0">
                      {activeCategory.icon}
                    </span>
                    <span className="text-xs font-bold text-slate-900 dark:text-white truncate">
                      {activeCategory.label}
                    </span>
                  </div>
                  {activeCategory.badge}
                </div>

                {/* Vertical Grouped List of Items (Simple Dropdown) */}
                <div className="space-y-2">
                  {activeCategory.groups.map((group, groupIdx) => (
                    <div key={groupIdx} className="space-y-0.5">
                      {group.groupTitle && (
                        <div className="px-2.5 pt-2 pb-1 text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                          {group.groupTitle}
                        </div>
                      )}
                      {group.items.map((item) => {
                        const isItemActive = currentTab === item.tab;

                        return (
                          <button
                            key={item.tab}
                            type="button"
                            onClick={() => handleTabClick(item.tab)}
                            className={`w-full flex items-start gap-2.5 px-3 py-2 rounded-xl text-left transition-all cursor-pointer ${
                              isItemActive
                                ? 'bg-blue-600 text-white font-semibold shadow-xs'
                                : 'hover:bg-slate-100/80 dark:hover:bg-slate-800/80 text-slate-700 dark:text-slate-200'
                            }`}
                          >
                            <span className={`mt-0.5 shrink-0 ${isItemActive ? 'text-white' : 'text-slate-400 dark:text-slate-400'}`}>
                              {item.icon}
                            </span>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center justify-between gap-1">
                                <span className="text-xs truncate font-medium">
                                  {item.label}
                                </span>
                                {item.badge}
                              </div>
                              {item.description && (
                                <div className={`text-[10px] leading-tight truncate mt-0.5 ${
                                  isItemActive ? 'text-blue-100' : 'text-slate-400 dark:text-slate-500'
                                }`}>
                                  {item.description}
                                </div>
                              )}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Sidebar Bottom Footer (Aksi Cepat removed) */}
          {isMinimized ? (
            <div className="p-3 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-col items-center gap-2 shrink-0">
              <ThemeSwitcher variant="icon-only" />

              <button
                onClick={() => setIsApkModalOpen(true)}
                className="p-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-emerald-600 dark:text-emerald-400 hover:bg-slate-100 dark:hover:bg-slate-700 transition cursor-pointer"
                title="Unduh Berkas APK Driver Mobile"
              >
                <Smartphone className="w-4 h-4" />
              </button>

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
                  onClick={() => setIsApkModalOpen(true)}
                  className="py-1.5 px-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 text-emerald-600 dark:text-emerald-400 text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
                  title="Unduh Berkas APK Driver Mobile"
                >
                  <Smartphone className="w-3.5 h-3.5" />
                  <span>APK Driver</span>
                </button>
              </div>

              {/* Keluar atau Log Out */}
              <button
                type="button"
                onClick={() => logisticsStore.logoutUser()}
                className="w-full py-2 px-3 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 hover:bg-rose-50 dark:hover:bg-rose-500/15 hover:border-rose-300 text-slate-600 dark:text-slate-300 hover:text-rose-600 dark:hover:text-rose-400 text-xs font-semibold flex items-center justify-center gap-2 transition cursor-pointer"
                title="Keluar Sesi"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Keluar Sesi</span>
              </button>
            </div>
          )}
        </div>
      </aside>

      {/* ============================================================== */}
      {/* MOBILE ACCORDION DRAWER (lg:hidden)                            */}
      {/* ============================================================== */}
      {isMobileOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
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
                      <div className="p-2 space-y-2 bg-white dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800">
                        {cat.groups.map((group, gIdx) => (
                          <div key={gIdx} className="space-y-1">
                            {group.groupTitle && (
                              <div className="px-2 pt-1 text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                                {group.groupTitle}
                              </div>
                            )}
                            {group.items.map((item) => {
                              const isCur = currentTab === item.tab;
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
                                  <div className="flex items-center gap-2">
                                    <span className={isCur ? 'text-white' : 'text-slate-400'}>{item.icon}</span>
                                    <span>{item.label}</span>
                                  </div>
                                  {item.badge}
                                </button>
                              );
                            })}
                          </div>
                        ))}
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

      {/* Android APK Modal */}
      <AndroidApkDownloadModal
        isOpen={isApkModalOpen}
        onClose={() => setIsApkModalOpen(false)}
      />
    </>
  );
};

export default Sidebar;
