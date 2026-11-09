import { UserProfile, UserRole, UserPermissions } from '../types';

export const isSpvLogistikRole = (role: UserRole | string): boolean => {
  return role === 'spv_logistik' || role === 'spv logistik' || role === 'dispatcher' || role === 'operasional' || role === 'pengiriman';
};

export const isDispatcherRole = (role: UserRole | string): boolean => {
  return isSpvLogistikRole(role);
};

export const isDriverRole = (role: UserRole | string): boolean => {
  return role === 'driver' || role === 'crew_helper';
};

export const isSuperAdminRole = (role: UserRole | string): boolean => {
  const norm = String(role || '').toLowerCase().trim().replace(/[\s_-]+/g, '');
  return norm === 'superadmin' || norm === 'admin' || norm === 'manager';
};

export const hasRequiredRole = (
  user: UserProfile | null | undefined,
  allowedRoles: Array<UserRole | 'dispatcher' | 'manager'>
): boolean => {
  if (!user || user.status !== 'approved') return false;
  if (isSuperAdminRole(user.role)) return true;

  return allowedRoles.some(allowed => {
    if (allowed === 'manager' || allowed === 'super_admin') {
      return isSuperAdminRole(user.role);
    }
    if (allowed === 'dispatcher' || allowed === 'spv_logistik') {
      return isSpvLogistikRole(user.role);
    }
    if (allowed === 'driver') {
      return isDriverRole(user.role);
    }
    return user.role === allowed;
  });
};

export const getUserRoleDisplayTitle = (role: UserRole | string): string => {
  switch (role) {
    case 'super_admin':
      return 'Super Admin / Manager';
    case 'dispatcher':
    case 'spv_logistik':
    case 'spv logistik':
      return 'SPV Logistik';
    case 'operasional':
      return 'Operasional (Operational Lead)';
    case 'pengiriman':
      return 'Pengiriman';
    case 'security':
      return 'Security (Pos Satpam & Keamanan)';
    case 'driver':
      return 'Kru Supir / Driver';
    case 'crew_helper':
      return 'Kru Helper / Kernet';
    case 'sales_admin':
      return 'Adm. Penjualan';
    case 'purchasing_admin':
      return 'Adm. Pembelian';
    case 'hr_admin':
      return 'HR Admin';
    case 'finance_tax_admin':
      return 'Finance & Tax';
    case 'warehouse_admin':
      return 'Gudang';
    case 'marketing_online':
      return 'Marketing Online';
    case 'marketing_offline':
      return 'Marketing Offline';
    case 'unassigned':
      return 'Perlu Diisi (Belum Ditentukan)';
    default:
      return 'Perlu Diisi (Belum Ditentukan)';
  }
};

export const getDefaultTabForRole = (role: UserRole | string): string => {
  switch (role) {
    case 'super_admin':
      return 'dashboard';
    case 'spv_logistik':
    case 'dispatcher':
    case 'operasional':
    case 'pengiriman':
      return 'operational_dashboard';
    case 'driver':
    case 'crew_helper':
      return 'driver_portal';
    case 'sales_admin':
      return 'sales_dashboard';
    case 'purchasing_admin':
      return 'purchasing_dashboard';
    case 'hr_admin':
      return 'hr_dashboard';
    case 'security':
      return 'ga_security';
    case 'finance_tax_admin':
      return 'finance_dashboard';
    case 'warehouse_admin':
      return 'warehouse_dashboard';
    case 'marketing_online':
      return 'marketing_online';
    case 'marketing_offline':
      return 'marketing_offline';
    default:
      return 'operational_dashboard';
  }
};

export const getDefaultPermissionsForRole = (role: UserRole | string): UserPermissions['modules'] => {
  const isAll = role === 'super_admin';
  const isLogistikStaff = role === 'spv_logistik' || role === 'spv logistik' || role === 'dispatcher' || role === 'operasional' || role === 'pengiriman';
  const isCrew = role === 'driver' || role === 'crew_helper';
  const isSales = role === 'sales_admin';
  const isWarehouse = role === 'warehouse_admin';
  const isMktOnline = role === 'marketing_online';
  const isMktOffline = role === 'marketing_offline';
  const isPurchasing = role === 'purchasing_admin';
  const isFinance = role === 'finance_tax_admin';
  const isHr = role === 'hr_admin';
  const isSecurity = role === 'security';

  return {
    logistics: {
      enabled: isAll || isLogistikStaff || isCrew,
      subMenus: {
        operational_dashboard: isAll || isLogistikStaff ? 'full_access' : 'none',
        schedules: isAll || isLogistikStaff ? 'full_access' : 'none',
        driver_portal: isAll || isLogistikStaff || isCrew ? 'full_access' : 'none',
        fleet_forms: isAll || isLogistikStaff ? 'full_access' : 'none',
        driver_reports: isAll || isLogistikStaff ? 'full_access' : 'none',
        tracking_eval: isAll || isLogistikStaff ? 'full_access' : 'none',
        fleets: isAll || isLogistikStaff ? 'full_access' : 'none',
        crew_history: isAll || isLogistikStaff ? 'full_access' : 'none',
        spareparts: isAll || isLogistikStaff ? 'full_access' : 'none',
        fuel_efficiency: isAll || isLogistikStaff ? 'full_access' : 'none',
        warehouse_fleet_cubication: isAll || isLogistikStaff ? 'full_access' : 'none',
        // Legacy keys preserved for backward compatibility
        dashboard_logistik: isAll || isLogistikStaff ? 'full_access' : 'none',
        armada_ceklis: isAll || isLogistikStaff ? 'full_access' : 'none',
        live_map: isAll || isLogistikStaff ? 'full_access' : 'none',
        monitoring_sla: isAll || isLogistikStaff ? 'full_access' : 'none',
        rencana_rute: isAll || isLogistikStaff ? 'full_access' : 'none',
        portal_driver: isAll || isLogistikStaff || isCrew ? 'full_access' : 'none'
      }
    },
    sales_admin: {
      enabled: isAll || isSales,
      subMenus: {
        sales_dashboard: isAll || isSales ? 'full_access' : 'none',
        sales_activities: isAll || isSales ? 'full_access' : 'none',
        sales_schedules: isAll || isSales ? 'full_access' : 'none',
        sales_loading_duration: isAll || isSales ? 'full_access' : 'none',
        sales_invoice_so: isAll || isSales ? 'full_access' : 'none',
        sales_form_kirim: isAll || isSales ? 'full_access' : 'none',
        sales_rfid_scanner: isAll || isSales ? 'full_access' : 'none',
        sales_skill_matrix: isAll || isSales ? 'full_access' : 'none',
        sales_jobdesk: isAll || isSales ? 'full_access' : 'none',
        sales_kpi_individual: isAll || isSales ? 'full_access' : 'none',
        sales_kpi_fines: isAll || isSales ? 'full_access' : 'none',
        sales_kpi_nusantara: isAll || isSales ? 'full_access' : 'none',
        sales_kpi_omset: isAll || isSales ? 'full_access' : 'none',
        // Legacy keys
        dashboard_penjualan: isAll || isSales ? 'full_access' : 'none',
        aktivitas_harian: isAll || isSales ? 'full_access' : 'none',
        jadwal_admin: isAll || isSales ? 'full_access' : 'none',
        durasi_muat: isAll || isSales ? 'full_access' : 'none',
        input_faktur_so: isAll || isSales ? 'full_access' : 'none',
        aplikasi_rfid_muat: isAll || isSales ? 'full_access' : 'none',
        matriks_skil: isAll || isSales ? 'full_access' : 'none',
        pengaturan_sop: isAll || isSales ? 'full_access' : 'none',
        data_kpi: isAll || isSales ? 'full_access' : 'none'
      }
    },
    warehouse: {
      enabled: isAll || isWarehouse,
      subMenus: {
        warehouse_scanner: isAll || isWarehouse ? 'full_access' : 'none',
        warehouse_dashboard: isAll || isWarehouse ? 'full_access' : 'none',
        warehouse_inventory: isAll || isWarehouse ? 'full_access' : 'none',
        warehouse_slotting: isAll || isWarehouse ? 'full_access' : 'none',
        warehouse_inbound: isAll || isWarehouse ? 'full_access' : 'none',
        warehouse_outbound: isAll || isWarehouse ? 'full_access' : 'none',
        warehouse_opname: isAll || isWarehouse ? 'full_access' : 'none',
        // Legacy keys
        stok_barang: isAll || isWarehouse ? 'full_access' : 'none',
        permintaan_barang: isAll || isWarehouse ? 'full_access' : 'none',
        opname_stok: isAll || isWarehouse ? 'full_access' : 'none',
        ceklis_muat: isAll || isWarehouse ? 'full_access' : 'none'
      }
    },
    marketing: {
      enabled: isAll || isMktOnline || isMktOffline,
      subMenus: {
        marketing_online: isAll || isMktOnline ? 'full_access' : 'none',
        marketing_offline: isAll || isMktOffline ? 'full_access' : 'none',
        marketing_to_vo_ro: isAll || isMktOnline || isMktOffline ? 'full_access' : 'none',
        customer_map: isAll || isMktOnline || isMktOffline ? 'full_access' : 'none',
        // Legacy keys
        kampanye: isAll || isMktOnline ? 'full_access' : 'none',
        leads_pipeline: isAll || isMktOffline ? 'full_access' : 'none',
        laporan_kunjungan: isAll || isMktOnline || isMktOffline ? 'full_access' : 'none'
      }
    },
    purchasing: {
      enabled: isAll || isPurchasing,
      subMenus: {
        purchasing_dashboard: isAll || isPurchasing ? 'full_access' : 'none',
        purchasing_stok_opname: isAll || isPurchasing ? 'full_access' : 'none',
        purchasing_stock_overview: isAll || isPurchasing ? 'full_access' : 'none',
        purchasing_stock_forecast: isAll || isPurchasing ? 'full_access' : 'none',
        // Legacy keys
        permintaan_pembelian: isAll || isPurchasing ? 'full_access' : 'none',
        po_vendor: isAll || isPurchasing ? 'full_access' : 'none',
        evaluasi_harga: isAll || isPurchasing ? 'full_access' : 'none'
      }
    },
    finance_tax: {
      enabled: isAll || isFinance,
      subMenus: {
        finance_dashboard: isAll || isFinance ? 'full_access' : 'none',
        finance_validasi_form_kirim: isAll || isFinance ? 'full_access' : 'none',
        finance_billing_app: isAll || isFinance ? 'full_access' : 'none',
        // Legacy keys
        kas_bank: isAll || isFinance ? 'full_access' : 'none',
        faktur_pajak: isAll || isFinance ? 'full_access' : 'none',
        rekonsiliasi: isAll || isFinance ? 'full_access' : 'none',
        laba_rugi: isAll || isFinance ? 'full_access' : 'none'
      }
    },
    hr: {
      enabled: isAll || isHr || isSecurity,
      subMenus: {
        hr_dashboard: isAll || isHr ? 'full_access' : 'none',
        ga_security: isAll || isHr || isSecurity ? 'full_access' : 'none',
        ga_hk: isAll || isHr ? 'full_access' : 'none',
        ga_aset: isAll || isHr ? 'full_access' : 'none',
        training_videos: isAll || isHr ? 'full_access' : 'none',
        training_karyawan: isAll || isHr ? 'full_access' : 'none',
        // Legacy keys
        hr_data_karyawan: isAll || isHr ? 'full_access' : 'none',
        hr_gaji_kpi: isAll || isHr ? 'full_access' : 'none',
        td_video_training: isAll || isHr ? 'full_access' : 'none',
        td_training_karyawan: isAll || isHr ? 'full_access' : 'none'
      }
    },
    sistem_pengguna: {
      enabled: isAll,
      subMenus: {
        dashboard: isAll ? 'full_access' : 'none',
        users: isAll ? 'full_access' : 'none',
        branches: isAll ? 'full_access' : 'none',
        activity_log: isAll ? 'full_access' : 'none',
        e2e_testing: isAll ? 'full_access' : 'none',
        architecture: isAll ? 'full_access' : 'none',
        // Legacy keys
        daftar_pengguna: isAll ? 'full_access' : 'none',
        manajemen_hak_akses: isAll ? 'full_access' : 'none',
        dashboard_eksekutif: isAll ? 'full_access' : 'none',
        log_aktivitas_sistem: isAll ? 'full_access' : 'none',
        persetujuan_akun: isAll ? 'full_access' : 'none'
      }
    }
  };
};

export interface RolePolicySummary {
  roleKey: 'super_admin' | 'dispatcher' | 'driver';
  title: string;
  badgeColor: string;
  allowedModules: string[];
  databaseRlsSummary: string[];
}

export const RBAC_ROLE_MATRIX: RolePolicySummary[] = [
  {
    roleKey: 'super_admin',
    title: 'Super Admin / Manager',
    badgeColor: 'text-amber-400 border-amber-500/30 bg-amber-500/10',
    allowedModules: [
      'Executive & Operational Dashboards',
      'User Management & RBAC Approval',
      'Fleet, Crew, Store & Schedule Management',
      'Finance, Tax, Sales KPI & Hostinger MySQL Architecture'
    ],
    databaseRlsSummary: [
      'Express API: user management endpoints memakai requireSuperAdmin di server',
      'Super Admin memiliki otoritas penuh; validasi dilakukan server-side sebelum query MySQL'
    ]
  },
  {
    roleKey: 'dispatcher',
    title: 'Dispatcher / SPV Logistik',
    badgeColor: 'text-blue-400 border-blue-500/30 bg-blue-500/10',
    allowedModules: [
      'Operational Dashboard & Live GPS Tracking',
      'Schedule & Dispatch Management (Assign Driver & Fleet)',
      'Fleet, Sparepart, Fuel & Store Coordinate Registry',
      'Driver Delivery Reports & Issue Resolution'
    ],
    databaseRlsSummary: [
      'Express API: perubahan jadwal/armada/kru/toko dibatasi role operasional pada server',
      'Tidak dapat mengubah role/user karena endpoint User Management khusus Super Admin'
    ]
  },
  {
    roleKey: 'driver',
    title: 'Driver / Crew Helper',
    badgeColor: 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10',
    allowedModules: [
      'Mobile Driver Portal (Assigned Deliveries Only)',
      'Delivery Status Updates (In Transit, Delivered + POD Photo, Delayed)',
      'Live GPS Geolocation Sync & Outbound Waybill (58mm)',
      'Vehicle Pre/Post-Trip Checklist & Shift PIN Check-In'
    ],
    databaseRlsSummary: [
      'GET jadwal driver difilter server-side berdasarkan penugasan driver/helper',
      'PATCH status jadwal ditolak bila jadwal bukan penugasan akun yang sedang login',
      'Cookie sesi HttpOnly diverifikasi Express sebelum akses data MySQL'
    ]
  }
];

const TAB_TO_MODULE_MAP: Record<string, { moduleId: string; subMenuId?: string }> = {
  dashboard: { moduleId: 'sistem_pengguna', subMenuId: 'dashboard' },
  driver_portal: { moduleId: 'logistics', subMenuId: 'driver_portal' },
  driver_reports: { moduleId: 'logistics', subMenuId: 'driver_reports' },
  operational_dashboard: { moduleId: 'logistics', subMenuId: 'operational_dashboard' },
  analytics_reports: { moduleId: 'logistics', subMenuId: 'operational_dashboard' },
  schedules: { moduleId: 'logistics', subMenuId: 'schedules' },
  fleets: { moduleId: 'logistics', subMenuId: 'fleets' },
  spareparts: { moduleId: 'logistics', subMenuId: 'spareparts' },
  fuel_efficiency: { moduleId: 'logistics', subMenuId: 'fuel_efficiency' },
  crew_history: { moduleId: 'logistics', subMenuId: 'crew_history' },
  tracking_eval: { moduleId: 'logistics', subMenuId: 'tracking_eval' },
  fleet_forms: { moduleId: 'logistics', subMenuId: 'fleet_forms' },
  customer_map: { moduleId: 'marketing', subMenuId: 'customer_map' },
  sales_dashboard: { moduleId: 'sales_admin', subMenuId: 'sales_dashboard' },
  sales_activities: { moduleId: 'sales_admin', subMenuId: 'sales_activities' },
  sales_schedules: { moduleId: 'sales_admin', subMenuId: 'sales_schedules' },
  sales_loading_duration: { moduleId: 'sales_admin', subMenuId: 'sales_loading_duration' },
  sales_invoice_so: { moduleId: 'sales_admin', subMenuId: 'sales_invoice_so' },
  sales_form_kirim: { moduleId: 'sales_admin', subMenuId: 'sales_form_kirim' },
  sales_rfid_scanner: { moduleId: 'sales_admin', subMenuId: 'sales_rfid_scanner' },
  sales_skill_matrix: { moduleId: 'sales_admin', subMenuId: 'sales_skill_matrix' },
  sales_jobdesk: { moduleId: 'sales_admin', subMenuId: 'sales_jobdesk' },
  sales_kpi: { moduleId: 'sales_admin', subMenuId: 'sales_kpi_individual' },
  sales_kpi_individual: { moduleId: 'sales_admin', subMenuId: 'sales_kpi_individual' },
  sales_kpi_fines: { moduleId: 'sales_admin', subMenuId: 'sales_kpi_fines' },
  sales_kpi_nusantara: { moduleId: 'sales_admin', subMenuId: 'sales_kpi_nusantara' },
  sales_kpi_omset: { moduleId: 'sales_admin', subMenuId: 'sales_kpi_omset' },
  warehouse_dashboard: { moduleId: 'warehouse', subMenuId: 'warehouse_dashboard' },
  warehouse_inventory: { moduleId: 'warehouse', subMenuId: 'warehouse_inventory' },
  warehouse_inbound: { moduleId: 'warehouse', subMenuId: 'warehouse_inbound' },
  warehouse_outbound: { moduleId: 'warehouse', subMenuId: 'warehouse_outbound' },
  warehouse_scanner: { moduleId: 'warehouse', subMenuId: 'warehouse_scanner' },
  warehouse_slotting: { moduleId: 'warehouse', subMenuId: 'warehouse_slotting' },
  warehouse_opname: { moduleId: 'warehouse', subMenuId: 'warehouse_opname' },
  warehouse_cubication: { moduleId: 'warehouse', subMenuId: 'warehouse_scanner' },
  warehouse_fleet_cubication: { moduleId: 'logistics', subMenuId: 'warehouse_fleet_cubication' },
  marketing_online: { moduleId: 'marketing', subMenuId: 'marketing_online' },
  marketing_offline: { moduleId: 'marketing', subMenuId: 'marketing_offline' },
  marketing_to_vo_ro: { moduleId: 'marketing', subMenuId: 'marketing_to_vo_ro' },
  purchasing_dashboard: { moduleId: 'purchasing', subMenuId: 'purchasing_dashboard' },
  purchasing_stok_opname: { moduleId: 'purchasing', subMenuId: 'purchasing_stok_opname' },
  purchasing_stock_overview: { moduleId: 'purchasing', subMenuId: 'purchasing_stock_overview' },
  purchasing_stock_forecast: { moduleId: 'purchasing', subMenuId: 'purchasing_stock_forecast' },
  finance_dashboard: { moduleId: 'finance_tax', subMenuId: 'finance_dashboard' },
  finance_validasi_form_kirim: { moduleId: 'finance_tax', subMenuId: 'finance_validasi_form_kirim' },
  finance_billing_app: { moduleId: 'finance_tax', subMenuId: 'finance_billing_app' },
  hr_dashboard: { moduleId: 'hr', subMenuId: 'hr_dashboard' },
  ga_security: { moduleId: 'hr', subMenuId: 'ga_security' },
  ga_hk: { moduleId: 'hr', subMenuId: 'ga_security' },
  ga_aset: { moduleId: 'hr', subMenuId: 'ga_security' },
  training_videos: { moduleId: 'hr', subMenuId: 'training_videos' },
  training_karyawan: { moduleId: 'hr', subMenuId: 'training_videos' },
  activity_log: { moduleId: 'sistem_pengguna', subMenuId: 'activity_log' },
  branches: { moduleId: 'sistem_pengguna', subMenuId: 'branches' },
  users: { moduleId: 'sistem_pengguna', subMenuId: 'users' },
  e2e_testing: { moduleId: 'sistem_pengguna', subMenuId: 'e2e_testing' },
  architecture: { moduleId: 'sistem_pengguna', subMenuId: 'architecture' }
};

export const LEGACY_SUBMENU_KEY_MAP: Record<string, string[]> = {
  sales_kpi_individual: ['data_kpi'],
  sales_kpi_fines: ['data_kpi'],
  sales_kpi_nusantara: ['data_kpi'],
  sales_kpi_omset: ['data_kpi'],
  sales_dashboard: ['dashboard_penjualan'],
  sales_activities: ['aktivitas_harian'],
  sales_schedules: ['jadwal_admin'],
  sales_loading_duration: ['durasi_muat'],
  sales_invoice_so: ['input_faktur_so'],
  sales_form_kirim: ['sales_invoice_so', 'input_faktur_so', 'sales_dashboard', 'dashboard_penjualan'],
  sales_rfid_scanner: ['aplikasi_rfid_muat'],
  sales_skill_matrix: ['matriks_skil'],
  sales_jobdesk: ['pengaturan_sop'],
  warehouse_scanner: ['stok_barang'],
  warehouse_dashboard: ['stok_barang'],
  warehouse_inventory: ['stok_barang'],
  warehouse_slotting: ['stok_barang'],
  warehouse_inbound: ['permintaan_barang'],
  warehouse_outbound: ['ceklis_muat'],
  warehouse_opname: ['opname_stok'],
  operational_dashboard: ['dashboard_logistik'],
  schedules: ['rencana_rute'],
  driver_portal: ['portal_driver'],
  fleet_forms: ['armada_ceklis'],
  fleets: ['armada_ceklis'],
  spareparts: ['armada_ceklis'],
  fuel_efficiency: ['armada_ceklis'],
  warehouse_fleet_cubication: ['armada_ceklis'],
  driver_reports: ['monitoring_sla'],
  crew_history: ['monitoring_sla'],
  tracking_eval: ['monitoring_sla'],
  marketing_online: ['kampanye'],
  marketing_offline: ['leads_pipeline'],
  marketing_to_vo_ro: ['leads_pipeline', 'laporan_kunjungan', 'marketing_offline', 'marketing_online'],
  customer_map: ['laporan_kunjungan'],
  purchasing_dashboard: ['permintaan_pembelian'],
  purchasing_stok_opname: ['permintaan_pembelian', 'po_vendor', 'purchasing_dashboard', 'warehouse_opname'],
  purchasing_stock_overview: ['po_vendor'],
  purchasing_stock_forecast: ['po_vendor'],
  finance_dashboard: ['kas_bank', 'faktur_pajak'],
  finance_validasi_form_kirim: ['finance_dashboard', 'kas_bank', 'faktur_pajak'],
  finance_billing_app: ['finance_dashboard', 'kas_bank', 'faktur_pajak'],
  hr_dashboard: ['hr_data_karyawan'],
  ga_security: ['ga_hk', 'ga_aset'],
  ga_hk: ['ga_security'],
  ga_aset: ['ga_security'],
  training_videos: ['td_video_training', 'training_karyawan', 'td_training_karyawan'],
  training_karyawan: ['training_videos', 'td_training_karyawan'],
  dashboard: ['dashboard_eksekutif'],
  users: ['daftar_pengguna', 'persetujuan_akun'],
  branches: ['daftar_pengguna'],
  e2e_testing: ['daftar_pengguna'],
  architecture: ['manajemen_hak_akses'],
  activity_log: ['log_aktivitas_sistem']
};

export interface CanonicalModuleDef {
  id: string;
  name: string;
  description: string;
  borderClass: string;
  iconBgClass: string;
  subMenus: Array<{ id: string; name: string }>;
}

/**
 * Single Source of Truth antara Sidebar Navigasi & Hak Akses User Management.
 * Setiap perubahan menu/sub-menu di sini otomatis tersinkron ke Sidebar, RBAC, dan User Management.
 */
export const CANONICAL_SIDEBAR_MODULES: CanonicalModuleDef[] = [
  {
    id: 'logistics',
    name: 'Logistik & Pengiriman',
    description: 'Dashboard logistik, jadwal pengiriman, armada, simulasi kubikasi armada, dan portal driver per cabang.',
    borderClass: 'border-blue-500/30',
    iconBgClass: 'bg-blue-500/15 text-blue-400',
    subMenus: [
      { id: 'operational_dashboard', name: 'Dashboard Logistik & Pengiriman' },
      { id: 'schedules', name: 'Jadwal & Penugasan Armada' },
      { id: 'driver_portal', name: 'Portal Driver Mobile' },
      { id: 'fleet_forms', name: 'Formulir Pengadaan Armada' },
      { id: 'driver_reports', name: 'Laporan Kiriman Kru' },
      { id: 'tracking_eval', name: 'Evaluasi Jalur GPS (Excel)' },
      { id: 'fleets', name: 'Data Armada Terpadu' },
      { id: 'crew_history', name: 'Kru Pengiriman & Kernet' },
      { id: 'spareparts', name: 'Suku Cadang & Bengkel' },
      { id: 'fuel_efficiency', name: 'Efisiensi Bahan Bakar (BBM)' },
      { id: 'warehouse_fleet_cubication', name: 'Simulasi Box Muatan Armada (2D)' }
    ]
  },
  {
    id: 'warehouse',
    name: 'Gudang (WMS)',
    description: 'Database barang, dashboard gudang, master SKU & stok bin, denah rak, inbound/outbound, dan opname gudang integrasi pembelian.',
    borderClass: 'border-emerald-500/30',
    iconBgClass: 'bg-emerald-500/15 text-emerald-400',
    subMenus: [
      { id: 'warehouse_scanner', name: 'Database Barang (m³ & Kg)' },
      { id: 'warehouse_dashboard', name: 'Ringkasan Gudang (WMS)' },
      { id: 'warehouse_inventory', name: 'Master SKU & Stok Bin' },
      { id: 'warehouse_slotting', name: 'Denah Rak & Slotting' },
      { id: 'warehouse_inbound', name: 'Inbound (Barang Masuk)' },
      { id: 'warehouse_outbound', name: 'Outbound (Picking & Muat)' },
      { id: 'warehouse_opname', name: 'Opname Gudang (Integrasi Pembelian)' }
    ]
  },
  {
    id: 'sales_admin',
    name: 'Admin Penjualan',
    description: 'Aktivitas harian admin, jadwal produksi, durasi muat, pengeluaran & scan barang muat, matriks skill, dan data KPI penjualan.',
    borderClass: 'border-indigo-500/30',
    iconBgClass: 'bg-indigo-500/15 text-indigo-400',
    subMenus: [
      { id: 'sales_dashboard', name: 'Dashboard Sales Hub' },
      { id: 'sales_activities', name: 'Checklist Aktivitas Harian' },
      { id: 'sales_schedules', name: 'Jadwal Admin & Produksi' },
      { id: 'sales_loading_duration', name: 'Durasi & Kecepatan Muat' },
      { id: 'sales_invoice_so', name: 'Input Faktur / Sales Order (SO)' },
      { id: 'sales_form_kirim', name: 'Form Kirim (Integrasi Finance & Portal Driver)' },
      { id: 'sales_rfid_scanner', name: 'Aplikasi Scan & Foto Muat' },
      { id: 'sales_skill_matrix', name: 'Matriks Skill Admin' },
      { id: 'sales_jobdesk', name: 'Pengaturan SOP & Jobdesk' },
      { id: 'sales_kpi_individual', name: '1. KPI Individu Staf' },
      { id: 'sales_kpi_fines', name: '2. Akumulasi Denda' },
      { id: 'sales_kpi_nusantara', name: '3. Persentase Kiriman' },
      { id: 'sales_kpi_omset', name: '4. Omset Admin Penjualan' }
    ]
  },
  {
    id: 'purchasing',
    name: 'Adm Pembelian (Purchasing)',
    description: 'Dashboard pembelian, stok opname & kartu stok digital (integrasi gudang), ringkasan stok bahan, dan prediksi kebutuhan reorder.',
    borderClass: 'border-purple-500/30',
    iconBgClass: 'bg-purple-500/15 text-purple-400',
    subMenus: [
      { id: 'purchasing_dashboard', name: 'Dashboard Pembelian' },
      { id: 'purchasing_stok_opname', name: 'Stok Opname & Kartu Stok' },
      { id: 'purchasing_stock_overview', name: 'Ringkasan Stok Bahan' },
      { id: 'purchasing_stock_forecast', name: 'Prediksi Kebutuhan Stok' }
    ]
  },
  {
    id: 'marketing',
    name: 'Marketing',
    description: 'Marketing online, marketing offline/kunjungan, prosentase TO/VO/RO, serta jaringan toko & wilayah mitra per cabang.',
    borderClass: 'border-amber-500/30',
    iconBgClass: 'bg-amber-500/15 text-amber-400',
    subMenus: [
      { id: 'marketing_online', name: 'Marketing Online & Ads' },
      { id: 'marketing_offline', name: 'Marketing Offline / Kunjungan' },
      { id: 'marketing_to_vo_ro', name: 'Prosentase TO, VO & RO' },
      { id: 'customer_map', name: 'Jaringan Toko & Wilayah Mitra' }
    ]
  },
  {
    id: 'finance_tax',
    name: 'Finance & Tax',
    description: 'Monitoring tagihan pelanggan belum terlunasi, jatuh tempo piutang, dan Aplikasi Mobile Penagihan Pelanggan per cabang.',
    borderClass: 'border-cyan-500/30',
    iconBgClass: 'bg-cyan-500/15 text-cyan-400',
    subMenus: [
      { id: 'finance_dashboard', name: 'Finance & Tagihan Pelanggan' },
      { id: 'finance_validasi_form_kirim', name: 'Validasi Form Kirim' },
      { id: 'finance_billing_app', name: 'Aplikasi Penagihan Pelanggan (Mobile)' }
    ]
  },
  {
    id: 'hr',
    name: 'HR (HR, GA & Training Development)',
    description: '3 Sub-Menu Utama Departemen HR: 1. HR (Presensi & SDM), 2. GA (Security, Housekeeping, Aset), dan 3. Training & Development.',
    borderClass: 'border-rose-500/30',
    iconBgClass: 'bg-rose-500/15 text-rose-400',
    subMenus: [
      { id: 'hr_dashboard', name: '1. HR (Presensi & SDM)' },
      { id: 'ga_security', name: '2. GA (Security, Housekeeping & Aset)' },
      { id: 'training_videos', name: '3. Training & Development' }
    ]
  },
  {
    id: 'sistem_pengguna',
    name: 'Master Data & Sistem',
    description: 'Dashboard eksekutif, master cabang, manajemen user & approval, log aktivitas sistem, pengujian E2E, dan skema database.',
    borderClass: 'border-slate-600/40',
    iconBgClass: 'bg-slate-700/40 text-slate-300',
    subMenus: [
      { id: 'dashboard', name: 'Dashboard Eksekutif' },
      { id: 'users', name: 'Manajemen User & Approval' },
      { id: 'branches', name: 'Master Cabang Operasional' },
      { id: 'activity_log', name: 'Log Aktivitas Sistem' },
      { id: 'e2e_testing', name: 'Pengujian E2E Otomatis' },
      { id: 'architecture', name: 'Skema Database SQL' }
    ]
  }
];

export const MODERN_SUBMENU_KEYS_BY_MODULE: Record<string, string[]> = Object.fromEntries(
  CANONICAL_SIDEBAR_MODULES.map(mod => [mod.id, mod.subMenus.map(sub => sub.id)])
);

const maxAccessLevel = (
  ...levels: Array<'full_access' | 'read_only' | 'none' | undefined>
): 'full_access' | 'read_only' | 'none' => {
  let result: 'full_access' | 'read_only' | 'none' = 'none';
  for (const lvl of levels) {
    if (lvl === 'full_access') return 'full_access';
    if (lvl === 'read_only') result = 'read_only';
  }
  return result;
};

/**
 * Normalizes and synchronizes user permissions for both legacy/old accounts and newly created accounts.
 * Ensures only canonical modern submenu keys are retained so badge counts and permission checks are 100% accurate,
 * and ensures Hak Akses (permissions) is the single source of truth regardless of the user's descriptive role label.
 */
export const normalizeUserPermissions = (
  role: UserRole | string,
  permissions?: UserPermissions | null
): UserPermissions => {
  const roleDefaults = getDefaultPermissionsForRole(role);
  if (!permissions || (!permissions.modules && !permissions.branchPermissions)) {
    const cleanDefaultModules: UserPermissions['modules'] = {};
    Object.keys(roleDefaults).forEach(modId => {
      const defMod = roleDefaults[modId];
      const modernKeys = MODERN_SUBMENU_KEYS_BY_MODULE[modId] || Object.keys(defMod?.subMenus || {});
      const nextSubs: Record<string, 'read_only' | 'full_access' | 'none'> = {};
      modernKeys.forEach(subId => {
        nextSubs[subId] = defMod?.enabled ? (defMod?.subMenus?.[subId] || 'none') : 'none';
      });
      const hasActive = modernKeys.some(k => nextSubs[k] === 'full_access' || nextSubs[k] === 'read_only');
      cleanDefaultModules[modId] = {
        enabled: Boolean(defMod?.enabled && hasActive),
        subMenus: nextSubs
      };
    });
    return {
      modules: cleanDefaultModules
    };
  }

  const rawModules = permissions.modules || {};

  const normalizeSingleModulesMap = (
    sourceModules: UserPermissions['modules'],
    fallbackModules?: UserPermissions['modules']
  ): UserPermissions['modules'] => {
    const normalized: UserPermissions['modules'] = {};

    Object.keys(roleDefaults).forEach(modId => {
      const defaultMod = roleDefaults[modId];
      const srcMod = sourceModules?.[modId];
      const fbMod = fallbackModules?.[modId];

      const modEnabled =
        srcMod !== undefined
          ? Boolean(srcMod.enabled)
          : fbMod !== undefined
          ? Boolean(fbMod.enabled)
          : Boolean(defaultMod?.enabled);

      const nextSubs: Record<string, 'read_only' | 'full_access' | 'none'> = {};
      const modernKeys = MODERN_SUBMENU_KEYS_BY_MODULE[modId] || Object.keys(defaultMod?.subMenus || {});

      modernKeys.forEach(subId => {
        if (!modEnabled) {
          nextSubs[subId] = 'none';
          return;
        }
        let val: 'full_access' | 'read_only' | 'none' | undefined = srcMod?.subMenus?.[subId];
        if (val === undefined && fbMod?.subMenus?.[subId] !== undefined) {
          val = fbMod.subMenus[subId];
        }
        if (val === undefined && srcMod?.subMenus) {
          const legacyKeys = LEGACY_SUBMENU_KEY_MAP[subId];
          if (legacyKeys) {
            for (const lk of legacyKeys) {
              if (srcMod.subMenus[lk] !== undefined) {
                val = srcMod.subMenus[lk];
                break;
              }
            }
          }
        }
        if (val === undefined) {
          val = defaultMod?.subMenus?.[subId] || 'none';
        }
        nextSubs[subId] = val;
      });

      const hasActiveSub = modernKeys.some(k => nextSubs[k] === 'full_access' || nextSubs[k] === 'read_only');

      normalized[modId] = {
        enabled: modEnabled && hasActiveSub,
        subMenus: nextSubs
      };
    });

    return normalized;
  };

  const normalizedTopModules = normalizeSingleModulesMap(rawModules);

  if (permissions.branchPermissions && Object.keys(permissions.branchPermissions).length > 0) {
    const normalizedBranches: NonNullable<UserPermissions['branchPermissions']> = {};
    Object.entries(permissions.branchPermissions).forEach(([branchId, branchEntry]) => {
      if (!branchEntry) return;
      const normBranchMods = normalizeSingleModulesMap(branchEntry.modules || {}, normalizedTopModules);
      const anyModActive = Object.values(normBranchMods).some(
        m => m?.enabled && Object.values(m.subMenus || {}).some(v => v === 'full_access' || v === 'read_only')
      );
      normalizedBranches[branchId] = {
        ...branchEntry,
        branchId: branchEntry.branchId || branchId,
        enabled: Boolean(branchEntry.enabled && anyModActive),
        modules: normBranchMods
      };
    });

    // Recompute merged top-level modules from enabled branches so modules & branchPermissions never diverge
    const mergedModules: UserPermissions['modules'] = {};
    Object.keys(roleDefaults).forEach(modId => {
      const modernKeys = MODERN_SUBMENU_KEYS_BY_MODULE[modId] || Object.keys(roleDefaults[modId]?.subMenus || {});
      const subMenus: Record<string, 'read_only' | 'full_access' | 'none'> = {};
      modernKeys.forEach(k => {
        subMenus[k] = 'none';
      });

      let anyModEnabled = false;
      Object.values(normalizedBranches).forEach(bEntry => {
        if (!bEntry?.enabled) return;
        const m = bEntry.modules?.[modId];
        if (m?.enabled) {
          anyModEnabled = true;
          modernKeys.forEach(subKey => {
            const val = m.subMenus?.[subKey] || 'none';
            subMenus[subKey] = maxAccessLevel(subMenus[subKey], val);
          });
        }
      });

      const hasActiveModern = modernKeys.some(k => subMenus[k] === 'full_access' || subMenus[k] === 'read_only');
      mergedModules[modId] = {
        enabled: anyModEnabled && hasActiveModern,
        subMenus
      };
    });

    return {
      modules: mergedModules,
      branchPermissions: normalizedBranches
    };
  }

  return {
    modules: normalizedTopModules
  };
};

const resolveSubMenuLevelFromMod = (
  modulePerms: { enabled: boolean; subMenus: Record<string, 'read_only' | 'full_access' | 'none'> } | undefined,
  defaultMod: { enabled: boolean; subMenus: Record<string, 'read_only' | 'full_access' | 'none'> } | undefined,
  resolvedModuleId: string,
  resolvedSubMenuId: string | undefined
): 'full_access' | 'read_only' | 'none' => {
  if (!modulePerms || !modulePerms.enabled) return 'none';
  if (!resolvedSubMenuId) {
    // Module-level check: return highest submenu level in this module
    const modernKeys = MODERN_SUBMENU_KEYS_BY_MODULE[resolvedModuleId];
    const entries = Object.entries(modulePerms.subMenus || {});
    const filtered = modernKeys && modernKeys.length > 0
      ? entries.filter(([k]) => modernKeys.includes(k))
      : entries;
    if (filtered.length === 0) return 'full_access';
    return maxAccessLevel(...filtered.map(([, v]) => v));
  }

  let subPerm = modulePerms.subMenus?.[resolvedSubMenuId];

  if (subPerm === undefined && modulePerms.enabled) {
    const fallbackKeys = LEGACY_SUBMENU_KEY_MAP[resolvedSubMenuId];
    if (fallbackKeys) {
      for (const k of fallbackKeys) {
        if (modulePerms.subMenus?.[k] !== undefined) {
          subPerm = modulePerms.subMenus[k];
          break;
        }
      }
    }
    if (subPerm === undefined) {
      subPerm = defaultMod?.subMenus?.[resolvedSubMenuId] || 'none';
    }
  }

  if (subPerm === 'full_access' || subPerm === 'read_only') {
    return subPerm;
  }
  return 'none';
};

export const getAccessLevel = (
  user: UserProfile | null | undefined,
  moduleId: string,
  subMenuId?: string,
  branchId?: string
): 'full_access' | 'read_only' | 'none' => {
  if (!user) return 'none';
  if (user.status === 'inactive' || user.status === 'rejected') return 'none';
  if (isSuperAdminRole(user.role)) return 'full_access';

  // Composite tab checks
  if (!subMenuId) {
    if (moduleId === 'finance_dashboard') {
      return maxAccessLevel(
        getAccessLevel(user, 'finance_tax', 'finance_dashboard', branchId),
        getAccessLevel(user, 'finance_tax', 'kas_bank', branchId),
        getAccessLevel(user, 'finance_tax', 'faktur_pajak', branchId),
        getAccessLevel(user, 'finance_tax', 'rekonsiliasi', branchId),
        getAccessLevel(user, 'finance_tax', 'laba_rugi', branchId)
      );
    }
    if (moduleId === 'hr_dashboard') {
      return maxAccessLevel(
        getAccessLevel(user, 'hr', 'hr_dashboard', branchId),
        getAccessLevel(user, 'hr', 'hr_data_karyawan', branchId),
        getAccessLevel(user, 'hr', 'hr_gaji_kpi', branchId)
      );
    }
    if (moduleId === 'users') {
      return maxAccessLevel(
        getAccessLevel(user, 'sistem_pengguna', 'users', branchId),
        getAccessLevel(user, 'sistem_pengguna', 'daftar_pengguna', branchId),
        getAccessLevel(user, 'sistem_pengguna', 'persetujuan_akun', branchId)
      );
    }
    if (moduleId === 'purchasing_dashboard') {
      return maxAccessLevel(
        getAccessLevel(user, 'purchasing', 'purchasing_dashboard', branchId),
        getAccessLevel(user, 'purchasing', 'permintaan_pembelian', branchId),
        getAccessLevel(user, 'purchasing', 'evaluasi_harga', branchId)
      );
    }
  }

  let resolvedModuleId = moduleId;
  let resolvedSubMenuId = subMenuId;
  if (!subMenuId && TAB_TO_MODULE_MAP[moduleId]) {
    resolvedModuleId = TAB_TO_MODULE_MAP[moduleId].moduleId;
    resolvedSubMenuId = TAB_TO_MODULE_MAP[moduleId].subMenuId;
  }

  const defaultModules = getDefaultPermissionsForRole(user.role);
  const defaultMod = defaultModules[resolvedModuleId];
  const branchPerms = user.permissions?.branchPermissions;
  const hasBranchPerms = Boolean(branchPerms && Object.keys(branchPerms).length > 0);

  // If branchPermissions are configured on the user profile, evaluate branch-level permissions accurately
  if (hasBranchPerms && branchPerms) {
    if (branchId && branchPerms[branchId]) {
      const bEntry = branchPerms[branchId];
      if (!bEntry.enabled) return 'none';
      const bMod = bEntry.modules?.[resolvedModuleId];
      return resolveSubMenuLevelFromMod(bMod, defaultMod, resolvedModuleId, resolvedSubMenuId);
    }

    // Aggregate across all enabled branches in branchPermissions
    let branchAggregated: 'full_access' | 'read_only' | 'none' = 'none';
    for (const bEntry of Object.values(branchPerms)) {
      if (!bEntry?.enabled) continue;
      const bMod = bEntry.modules?.[resolvedModuleId];
      const lvl = resolveSubMenuLevelFromMod(bMod, defaultMod, resolvedModuleId, resolvedSubMenuId);
      branchAggregated = maxAccessLevel(branchAggregated, lvl);
    }

    const userMod = user.permissions?.modules?.[resolvedModuleId];
    if (userMod !== undefined && resolvedSubMenuId && userMod.subMenus?.[resolvedSubMenuId] !== undefined) {
      const explicitTopLevel = userMod.subMenus[resolvedSubMenuId];
      if (!userMod.enabled || explicitTopLevel === 'none') return 'none';
      if (explicitTopLevel === 'read_only' && branchAggregated === 'full_access') {
        return 'read_only';
      }
    }

    return branchAggregated;
  }

  const userModules = user.permissions?.modules;
  const userMod = userModules?.[resolvedModuleId];
  const modulePerms = userMod !== undefined ? userMod : defaultMod;

  return resolveSubMenuLevelFromMod(modulePerms, defaultMod, resolvedModuleId, resolvedSubMenuId);
};

export const canAccess = (
  user: UserProfile | null | undefined,
  moduleId: string,
  subMenuId?: string,
  branchId?: string
): boolean => {
  return getAccessLevel(user, moduleId, subMenuId, branchId) !== 'none';
};

export const canEdit = (
  user: UserProfile | null | undefined,
  moduleId: string,
  subMenuId?: string,
  branchId?: string
): boolean => {
  return getAccessLevel(user, moduleId, subMenuId, branchId) === 'full_access';
};

export const isReadOnlyAccess = (
  user: UserProfile | null | undefined,
  moduleId: string,
  subMenuId?: string,
  branchId?: string
): boolean => {
  return getAccessLevel(user, moduleId, subMenuId, branchId) === 'read_only';
};

export const getFirstAccessibleTabForUser = (user: UserProfile): string => {
  const roleDefault = getDefaultTabForRole(user.role);
  if (canAccess(user, roleDefault)) {
    return roleDefault;
  }
  const priorityTabs = CANONICAL_SIDEBAR_MODULES.flatMap(mod => mod.subMenus.map(sub => sub.id));
  for (const tab of priorityTabs) {
    if (canAccess(user, tab)) {
      return tab;
    }
  }
  return roleDefault;
};



