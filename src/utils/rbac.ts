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
  purchasing_dashboard: { moduleId: 'purchasing', subMenuId: 'purchasing_dashboard' },
  purchasing_stock_overview: { moduleId: 'purchasing', subMenuId: 'purchasing_stock_overview' },
  purchasing_stock_forecast: { moduleId: 'purchasing', subMenuId: 'purchasing_stock_forecast' },
  finance_dashboard: { moduleId: 'finance_tax', subMenuId: 'finance_dashboard' },
  hr_dashboard: { moduleId: 'hr', subMenuId: 'hr_dashboard' },
  ga_security: { moduleId: 'hr', subMenuId: 'ga_security' },
  ga_hk: { moduleId: 'hr', subMenuId: 'ga_hk' },
  ga_aset: { moduleId: 'hr', subMenuId: 'ga_aset' },
  training_videos: { moduleId: 'hr', subMenuId: 'training_videos' },
  training_karyawan: { moduleId: 'hr', subMenuId: 'training_karyawan' },
  activity_log: { moduleId: 'sistem_pengguna', subMenuId: 'activity_log' },
  branches: { moduleId: 'sistem_pengguna', subMenuId: 'branches' },
  users: { moduleId: 'sistem_pengguna', subMenuId: 'users' },
  e2e_testing: { moduleId: 'sistem_pengguna', subMenuId: 'e2e_testing' },
  architecture: { moduleId: 'sistem_pengguna', subMenuId: 'architecture' }
};

export const canAccess = (user: UserProfile, moduleId: string, subMenuId?: string): boolean => {
  if (!user) return false;
  if (user.status === 'inactive' || user.status === 'rejected') return false;
  if (isSuperAdminRole(user.role)) return true;
  if (user.role === 'unassigned') return false;

  // Composite tab checks so enabling any sub-option in User Management grants access to the corresponding view
  if (!subMenuId) {
    if (moduleId === 'finance_dashboard') {
      return (
        canAccess(user, 'finance_tax', 'kas_bank') ||
        canAccess(user, 'finance_tax', 'faktur_pajak') ||
        canAccess(user, 'finance_tax', 'rekonsiliasi') ||
        canAccess(user, 'finance_tax', 'laba_rugi')
      );
    }
    if (moduleId === 'hr_dashboard') {
      return (
        canAccess(user, 'hr', 'hr_data_karyawan') ||
        canAccess(user, 'hr', 'hr_gaji_kpi')
      );
    }
    if (moduleId === 'users') {
      return (
        canAccess(user, 'sistem_pengguna', 'daftar_pengguna') ||
        canAccess(user, 'sistem_pengguna', 'persetujuan_akun')
      );
    }
    if (moduleId === 'purchasing_dashboard') {
      return (
        canAccess(user, 'purchasing', 'permintaan_pembelian') ||
        canAccess(user, 'purchasing', 'evaluasi_harga')
      );
    }
  }

  // Map NavTab to (moduleId, subMenuId) if moduleId is a tab name
  let resolvedModuleId = moduleId;
  let resolvedSubMenuId = subMenuId;
  if (!subMenuId && TAB_TO_MODULE_MAP[moduleId]) {
    resolvedModuleId = TAB_TO_MODULE_MAP[moduleId].moduleId;
    resolvedSubMenuId = TAB_TO_MODULE_MAP[moduleId].subMenuId;
  }

  const defaultModules = getDefaultPermissionsForRole(user.role);
  const defaultMod = defaultModules[resolvedModuleId];

  // Authorization strictly follows user.permissions.modules saved in User Management (Hostinger MySQL),
  // falling back to role defaults ONLY when user.permissions.modules does not have this module configured.
  const userModules = user.permissions?.modules;
  const userMod = userModules?.[resolvedModuleId];
  const isCrew = isDriverRole(user.role);

  const modulePerms = userMod !== undefined ? userMod : defaultMod;

  if (!modulePerms || !modulePerms.enabled) return false;

  if (resolvedSubMenuId) {
    let subPerm = modulePerms.subMenus?.[resolvedSubMenuId];

    // Legacy submenu backward-compatibility resolution:
    if (subPerm === undefined && modulePerms.enabled) {
      const LEGACY_KEY_MAP: Record<string, string[]> = {
        sales_kpi_individual: ['data_kpi'],
        sales_kpi_fines: ['data_kpi'],
        sales_kpi_nusantara: ['data_kpi'],
        sales_kpi_omset: ['data_kpi'],
        sales_dashboard: ['dashboard_penjualan'],
        sales_activities: ['aktivitas_harian'],
        sales_schedules: ['jadwal_admin'],
        sales_loading_duration: ['durasi_muat'],
        sales_invoice_so: ['input_faktur_so', 'durasi_muat', 'aktivitas_harian'],
        sales_rfid_scanner: ['aplikasi_rfid_muat', 'durasi_muat', 'aktivitas_harian'],
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
        customer_map: ['laporan_kunjungan'],
        purchasing_dashboard: ['permintaan_pembelian'],
        purchasing_stock_overview: ['po_vendor'],
        purchasing_stock_forecast: ['po_vendor'],
        finance_dashboard: ['kas_bank', 'faktur_pajak'],
        hr_dashboard: ['hr_data_karyawan'],
        training_videos: ['td_video_training'],
        training_karyawan: ['td_training_karyawan'],
        dashboard: ['dashboard_eksekutif'],
        users: ['daftar_pengguna', 'persetujuan_akun'],
        branches: ['daftar_pengguna'],
        e2e_testing: ['daftar_pengguna'],
        architecture: ['manajemen_hak_akses'],
        activity_log: ['log_aktivitas_sistem']
      };

      const fallbackKeys = LEGACY_KEY_MAP[resolvedSubMenuId];
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

    // Legacy migration guard: for driver / crew_helper accounts that had old default (portal_driver + monitoring_sla only)
    // without explicit branch permissions, only portal_driver is enabled by default.
    if (
      isCrew &&
      resolvedModuleId === 'logistics' &&
      resolvedSubMenuId === 'monitoring_sla' &&
      userMod?.subMenus &&
      !user.permissions?.branchPermissions
    ) {
      const activeKeys = Object.entries(userMod.subMenus)
        .filter(([, v]) => v === 'full_access' || v === 'read_only')
        .map(([k]) => k);
      if (
        activeKeys.length === 2 &&
        activeKeys.includes('portal_driver') &&
        activeKeys.includes('monitoring_sla')
      ) {
        subPerm = 'none';
      }
    }

    if (!subPerm || subPerm === 'none') return false;
  }

  return true;
};

export const getFirstAccessibleTabForUser = (user: UserProfile): string => {
  const roleDefault = getDefaultTabForRole(user.role);
  if (canAccess(user, roleDefault)) {
    return roleDefault;
  }
  const priorityTabs = [
    'operational_dashboard',
    'schedules',
    'driver_portal',
    'fleet_forms',
    'driver_reports',
    'tracking_eval',
    'fleets',
    'crew_history',
    'spareparts',
    'fuel_efficiency',
    'warehouse_fleet_cubication',
    'sales_dashboard',
    'sales_activities',
    'sales_schedules',
    'sales_loading_duration',
    'sales_invoice_so',
    'sales_rfid_scanner',
    'sales_skill_matrix',
    'sales_jobdesk',
    'sales_kpi_individual',
    'warehouse_dashboard',
    'warehouse_inventory',
    'warehouse_inbound',
    'warehouse_outbound',
    'warehouse_opname',
    'marketing_online',
    'marketing_offline',
    'customer_map',
    'purchasing_dashboard',
    'purchasing_stock_overview',
    'finance_dashboard',
    'hr_dashboard',
    'ga_security',
    'ga_hk',
    'ga_aset',
    'training_videos',
    'training_karyawan',
    'dashboard',
    'users',
    'branches',
    'activity_log'
  ];
  for (const tab of priorityTabs) {
    if (canAccess(user, tab)) {
      return tab;
    }
  }
  return roleDefault;
};


