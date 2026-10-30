import type { NavTab } from '../components/Sidebar';

export const TAB_TO_PATH: Record<NavTab, string> = {
  dashboard: '/dashboard',
  operational_dashboard: '/dashboard-logistik',
  schedules: '/jadwal-pengiriman',
  fleets: '/armada',
  spareparts: '/sparepart',
  fuel_efficiency: '/efisiensi-bbm',
  crew_history: '/riwayat-pengiriman',
  tracking_eval: '/evaluasi-muat',
  fleet_forms: '/formulir-armada',
  driver_portal: '/portal-driver',
  driver_reports: '/laporan-driver',
  analytics_reports: '/analitik-armada',
  sales_dashboard: '/sales-dashboard',
  sales_activities: '/aktivitas-sales',
  sales_schedules: '/jadwal-sales',
  sales_loading_duration: '/durasi-muat',
  sales_skill_matrix: '/skill-matrix-sales',
  sales_jobdesk: '/jobdesk-sales',
  sales_kpi: '/kpi-sales',
  sales_kpi_individual: '/kpi-individu-sales',
  sales_kpi_fines: '/denda-checker',
  sales_kpi_nusantara: '/kiriman-nusantara',
  sales_kpi_omset: '/omset-sales',
  customer_map: '/jaringan-toko',
  purchasing_dashboard: '/dashboard-pembelian',
  purchasing_stock_overview: '/analisa-stok',
  purchasing_stock_forecast: '/prediksi-stok',
  hr_dashboard: '/hr-dashboard',
  ga_security: '/security',
  ga_hk: '/housekeeping',
  ga_aset: '/manajemen-aset',
  training_videos: '/video-training',
  training_karyawan: '/training-karyawan',
  finance_dashboard: '/finance-dashboard',
  warehouse_dashboard: '/wms-dashboard',
  warehouse_inventory: '/wms-inventaris',
  warehouse_inbound: '/wms-inbound',
  warehouse_outbound: '/wms-outbound',
  warehouse_scanner: '/wms-scanner',
  warehouse_slotting: '/wms-slotting',
  warehouse_opname: '/wms-opname',
  warehouse_cubication: '/wms-kubikasi-barang',
  warehouse_fleet_cubication: '/simulasi-kubikasi-armada',
  marketing_online: '/marketing-online',
  marketing_offline: '/marketing-offline',
  activity_log: '/log-aktivitas',
  branches: '/master-cabang',
  users: '/manajemen-user',
  e2e_testing: '/pengujian-e2e',
  architecture: '/skema-sql',
};

const PATH_TO_TAB: Record<string, NavTab> = {
  '/dashboard': 'dashboard',
  '/dashboard-eksekutif': 'dashboard',
  '/dashboard-logistik': 'operational_dashboard',
  '/dashboard-operasional': 'operational_dashboard',
  '/operational_dashboard': 'operational_dashboard',
  '/operasional': 'operational_dashboard',
  '/jadwal-pengiriman': 'schedules',
  '/schedules': 'schedules',
  '/armada': 'fleets',
  '/fleets': 'fleets',
  '/sparepart': 'spareparts',
  '/spareparts': 'spareparts',
  '/efisiensi-bbm': 'fuel_efficiency',
  '/fuel_efficiency': 'fuel_efficiency',
  '/riwayat-pengiriman': 'crew_history',
  '/crew_history': 'crew_history',
  '/evaluasi-muat': 'tracking_eval',
  '/tracking_eval': 'tracking_eval',
  '/formulir-armada': 'fleet_forms',
  '/fleet_forms': 'fleet_forms',
  '/portal-driver': 'driver_portal',
  '/driver_portal': 'driver_portal',
  '/driver': 'driver_portal',
  '/laporan-driver': 'driver_reports',
  '/driver_reports': 'driver_reports',
  '/analitik-armada': 'analytics_reports',
  '/analytics_reports': 'analytics_reports',
  '/sales-dashboard': 'sales_dashboard',
  '/sales_dashboard': 'sales_dashboard',
  '/aktivitas-sales': 'sales_activities',
  '/sales_activities': 'sales_activities',
  '/jadwal-sales': 'sales_schedules',
  '/sales_schedules': 'sales_schedules',
  '/durasi-muat': 'sales_loading_duration',
  '/sales_loading_duration': 'sales_loading_duration',
  '/skill-matrix-sales': 'sales_skill_matrix',
  '/sales_skill_matrix': 'sales_skill_matrix',
  '/jobdesk-sales': 'sales_jobdesk',
  '/sales_jobdesk': 'sales_jobdesk',
  '/kpi-sales': 'sales_kpi',
  '/sales_kpi': 'sales_kpi',
  '/kpi-individu-sales': 'sales_kpi_individual',
  '/sales_kpi_individual': 'sales_kpi_individual',
  '/denda-checker': 'sales_kpi_fines',
  '/sales_kpi_fines': 'sales_kpi_fines',
  '/kiriman-nusantara': 'sales_kpi_nusantara',
  '/sales_kpi_nusantara': 'sales_kpi_nusantara',
  '/omset-sales': 'sales_kpi_omset',
  '/sales_kpi_omset': 'sales_kpi_omset',
  '/jaringan-toko': 'customer_map',
  '/customer_map': 'customer_map',
  '/dashboard-pembelian': 'purchasing_dashboard',
  '/purchasing_dashboard': 'purchasing_dashboard',
  '/analisa-stok': 'purchasing_stock_overview',
  '/purchasing_stock_overview': 'purchasing_stock_overview',
  '/prediksi-stok': 'purchasing_stock_forecast',
  '/purchasing_stock_forecast': 'purchasing_stock_forecast',
  '/hr-dashboard': 'hr_dashboard',
  '/hr_dashboard': 'hr_dashboard',
  '/security': 'ga_security',
  '/ga_security': 'ga_security',
  '/housekeeping': 'ga_hk',
  '/ga_hk': 'ga_hk',
  '/manajemen-aset': 'ga_aset',
  '/ga_aset': 'ga_aset',
  '/video-training': 'training_videos',
  '/training_videos': 'training_videos',
  '/training-karyawan': 'training_karyawan',
  '/training_karyawan': 'training_karyawan',
  '/finance-dashboard': 'finance_dashboard',
  '/finance_dashboard': 'finance_dashboard',
  '/tagihan-pelanggan': 'finance_dashboard',
  '/wms-dashboard': 'warehouse_dashboard',
  '/warehouse_dashboard': 'warehouse_dashboard',
  '/wms-inventaris': 'warehouse_inventory',
  '/warehouse_inventory': 'warehouse_inventory',
  '/wms-inbound': 'warehouse_inbound',
  '/warehouse_inbound': 'warehouse_inbound',
  '/wms-outbound': 'warehouse_outbound',
  '/warehouse_outbound': 'warehouse_outbound',
  '/wms-scanner': 'warehouse_scanner',
  '/warehouse_scanner': 'warehouse_scanner',
  '/wms-slotting': 'warehouse_slotting',
  '/warehouse_slotting': 'warehouse_slotting',
  '/wms-opname': 'warehouse_opname',
  '/warehouse_opname': 'warehouse_opname',
  '/wms-kubikasi-barang': 'warehouse_cubication',
  '/warehouse_cubication': 'warehouse_cubication',
  '/simulasi-kubikasi-armada': 'warehouse_fleet_cubication',
  '/wms-simulasi-kubikasi-armada': 'warehouse_fleet_cubication',
  '/warehouse_fleet_cubication': 'warehouse_fleet_cubication',
  '/marketing-online': 'marketing_online',
  '/marketing_online': 'marketing_online',
  '/marketing-offline': 'marketing_offline',
  '/marketing_offline': 'marketing_offline',
  '/log-aktivitas': 'activity_log',
  '/activity_log': 'activity_log',
  '/master-cabang': 'branches',
  '/cabang': 'branches',
  '/branches': 'branches',
  '/manajemen-user': 'users',
  '/manajemen-pengguna': 'users',
  '/users': 'users',
  '/pengujian-e2e': 'e2e_testing',
  '/e2e_testing': 'e2e_testing',
  '/skema-sql': 'architecture',
  '/architecture': 'architecture',
};

export function getTabPath(tab: NavTab): string {
  return TAB_TO_PATH[tab] || '/dashboard';
}

export function normalizePathname(pathname: string): string {
  const trimmed = String(pathname || '/').trim().toLowerCase();
  if (!trimmed || trimmed === '/') return '/';
  return trimmed.endsWith('/') ? trimmed.slice(0, -1) : trimmed;
}

export function resolveTabFromUrl(locationObj: Location = window.location): {
  tab: NavTab | null;
  isLoginPath: boolean;
} {
  const normalizedPath = normalizePathname(locationObj.pathname);
  if (normalizedPath === '/login' || normalizedPath === '/masuk') {
    return { tab: null, isLoginPath: true };
  }

  if (PATH_TO_TAB[normalizedPath]) {
    return { tab: PATH_TO_TAB[normalizedPath], isLoginPath: false };
  }

  const params = new URLSearchParams(locationObj.search);
  const queryTab = (params.get('tab') || '').trim().toLowerCase();
  if (queryTab) {
    if (PATH_TO_TAB[`/${queryTab}`]) {
      return { tab: PATH_TO_TAB[`/${queryTab}`], isLoginPath: false };
    }
    if ((queryTab as NavTab) in TAB_TO_PATH) {
      return { tab: queryTab as NavTab, isLoginPath: false };
    }
  }

  const hashTab = locationObj.hash.replace(/^#\/?/, '').trim().toLowerCase();
  if (hashTab) {
    if (hashTab === 'login') return { tab: null, isLoginPath: true };
    if (PATH_TO_TAB[`/${hashTab}`]) {
      return { tab: PATH_TO_TAB[`/${hashTab}`], isLoginPath: false };
    }
    if ((hashTab as NavTab) in TAB_TO_PATH) {
      return { tab: hashTab as NavTab, isLoginPath: false };
    }
  }

  return { tab: null, isLoginPath: false };
}
