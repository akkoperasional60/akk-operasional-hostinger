import React, { lazy } from 'react';
import type { NavTab } from '../components/Sidebar';

// Keep the existing caching and import-retry behavior for every module.
// V65 only switches Driver/Helper's module entry to a single React gateway.
const cachedModulePromises = new Map<string, Promise<any>>();
async function retryImport<T>(factory: () => Promise<T>, retries = 1): Promise<T> {
  let lastErr: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try { return await factory(); }
    catch (err) {
      lastErr = err;
      if (attempt < retries) await new Promise(resolve => setTimeout(resolve, 1200 * (attempt + 1)));
    }
  }
  throw lastErr;
}
function loadOnce<T>(key: string, factory: () => Promise<T>): Promise<T> {
  const existing = cachedModulePromises.get(key);
  if (existing) return existing as Promise<T>;
  const promise = retryImport(factory, 1).catch(err => { cachedModulePromises.delete(key); throw err; });
  cachedModulePromises.set(key, promise);
  return promise;
}
export function lazyWithRetry<T extends React.ComponentType<any>>(loader: () => Promise<{ default: T }>): React.LazyExoticComponent<T> {
  return lazy(() => loader());
}

export const loadExecutiveDashboard = () => loadOnce('ExecutiveDashboard', () =>
  import('../components/ExecutiveDashboard').then(m => ({ default: m.ExecutiveDashboard })));
export const loadScheduleManagement = () => loadOnce('ScheduleManagement', () =>
  import('../components/ScheduleManagement').then(m => ({ default: m.ScheduleManagement })));
export const loadFleetCrewManagement = () => loadOnce('FleetCrewManagement', () =>
  import('../components/FleetCrewManagement').then(m => ({ default: m.FleetCrewManagement })));
export const loadSparePartManagement = () => loadOnce('SparePartManagement', () =>
  import('../components/SparePartManagement').then(m => ({ default: m.SparePartManagement })));
export const loadFleetMaintenanceCostManagement = () => loadOnce('FleetMaintenanceCostManagement', () =>
  import('../components/FleetMaintenanceCostManagement').then(m => ({ default: m.FleetMaintenanceCostManagement })));
export const loadFuelEfficiencyManagement = () => loadOnce('FuelEfficiencyManagement', () =>
  import('../components/FuelEfficiencyManagement').then(m => ({ default: m.FuelEfficiencyManagement })));
export const loadKmRecapManagement = () => loadOnce('KmRecapManagement', () =>
  import('../components/KmRecapManagement').then(m => ({ default: m.KmRecapManagement })));
export const loadUserManagement = () => loadOnce('UserManagement', () =>
  import('../components/UserManagement').then(m => ({ default: m.UserManagement })));
export const loadCustomerMapping = () => loadOnce('CustomerMapping', () =>
  import('../components/CustomerMapping').then(m => ({ default: m.CustomerMapping })));
export const loadFleetFormCenter = () => loadOnce('FleetFormCenter', () =>
  import('../components/FleetFormCenter').then(m => ({ default: m.FleetFormCenter })));
export const loadSupabaseSqlArchitecture = () => loadOnce('SupabaseSqlArchitecture', () =>
  import('../components/SupabaseSqlArchitecture').then(m => ({ default: m.SupabaseSqlArchitecture })));
export const loadSalesAdminHub = () => loadOnce('SalesAdminHub', () =>
  import('../components/sales/SalesAdminHub').then(m => ({ default: m.SalesAdminHub })));
export const loadFinanceValidasiFormKirimTab = () => loadOnce('FinanceValidasiFormKirimTab', () =>
  import('../components/sales/FormKirimSystem').then(m => ({ default: m.FinanceValidasiFormKirimTab })));
export const loadSalesKpi = () => loadOnce('SalesKpi', () =>
  import('../components/sales/SalesKpi').then(m => ({ default: m.SalesKpi })));
export const loadPurchasingStockAnalysis = () => loadOnce('PurchasingStockAnalysis', () =>
  import('../components/purchasing/PurchasingStockAnalysis').then(m => ({ default: m.PurchasingStockAnalysis })));
export const loadSystemActivityLog = () => loadOnce('SystemActivityLog', () =>
  import('../components/SystemActivityLog').then(m => ({ default: m.SystemActivityLog })));
export const loadDepartmentDashboard = () => loadOnce('DepartmentDashboard', () =>
  import('../components/DepartmentDashboard').then(m => ({ default: m.DepartmentDashboard })));
export const loadWarehouseManagementSystem = () => loadOnce('WarehouseManagementSystem', () =>
  import('../components/WarehouseManagementSystem').then(m => ({ default: m.WarehouseManagementSystem })));
export const loadMarketingDashboard = () => loadOnce('MarketingDashboard', () =>
  import('../components/MarketingDashboard').then(m => ({ default: m.MarketingDashboard })));

// Important: one gateway. The old DriverMobileView is no longer mounted behind
// the new staff UI. Admin/SPV still reach the legacy view via the gateway.
export const loadDriverMobileView = () => loadOnce('CrewPortalGatewayV65', () =>
  import('../components/crew/CrewPortalGateway').then(m => ({ default: m.CrewPortalGateway })));

export const loadDriverReportsManagement = () => loadOnce('DriverReportsManagement', () =>
  import('../components/DriverReportsManagement').then(m => ({ default: m.DriverReportsManagement })));
export const loadAnalyticsReportingModule = () => loadOnce('AnalyticsReportingModule', () =>
  import('../components/AnalyticsReportingModule').then(m => ({ default: m.AnalyticsReportingModule })));
export const loadE2ETesterModule = () => loadOnce('E2ETesterModule', () =>
  import('../components/E2ETesterModule').then(m => ({ default: m.E2ETesterModule })));
export const loadMasterCabang = () => loadOnce('MasterCabang', () =>
  import('../components/MasterCabang').then(m => ({ default: m.MasterCabang })));
export const loadSchedulePortalValidationReport = () => loadOnce('SchedulePortalValidationReport', () =>
  import('../components/SchedulePortalValidationReport').then(m => ({ default: m.SchedulePortalValidationReport })));
export const loadIntegratedRouteValidation = () => loadOnce('IntegratedRouteValidation', () =>
  import('../components/IntegratedRouteValidation').then(m => ({ default: m.IntegratedRouteValidation })));

export function getLoaderForTab(tab: NavTab): (() => Promise<any>) | null {
  switch (tab) {
    case 'dashboard': return loadExecutiveDashboard;
    case 'driver_portal': return loadDriverMobileView;
    case 'driver_reports': return loadDriverReportsManagement;
    case 'operational_dashboard':
    case 'analytics_reports': return loadAnalyticsReportingModule;
    case 'schedules': return loadScheduleManagement;
    case 'portal_validation': return loadSchedulePortalValidationReport;
    case 'integrated_validation': return loadIntegratedRouteValidation;
    case 'fleets':
    case 'crew_history': return loadFleetCrewManagement;
    case 'spareparts': return loadSparePartManagement;
    case 'maintenance_costs': return loadFleetMaintenanceCostManagement;
    case 'fuel_efficiency': return loadFuelEfficiencyManagement;
    case 'km_recap': return loadKmRecapManagement;
    case 'customer_map': return loadCustomerMapping;
    case 'fleet_forms': return loadFleetFormCenter;
    case 'sales_dashboard':
    case 'sales_activities':
    case 'sales_schedules':
    case 'sales_loading_duration':
    case 'sales_invoice_so':
    case 'sales_form_kirim':
    case 'sales_rfid_scanner':
    case 'sales_muat_validation':
    case 'sales_skill_matrix':
    case 'sales_jobdesk': return loadSalesAdminHub;
    case 'sales_kpi':
    case 'sales_kpi_individual':
    case 'sales_kpi_fines':
    case 'sales_kpi_nusantara':
    case 'sales_kpi_omset': return loadSalesKpi;
    case 'hr_dashboard':
    case 'ga_security':
    case 'ga_hk':
    case 'ga_aset':
    case 'training_videos':
    case 'training_karyawan':
    case 'finance_overview':
    case 'finance_dashboard':
    case 'finance_customer_mapping':
    case 'finance_billing_app':
    case 'marketing_billing_app':
    case 'purchasing_dashboard': return loadDepartmentDashboard;
    case 'finance_validasi_form_kirim': return loadFinanceValidasiFormKirimTab;
    case 'warehouse_dashboard':
    case 'warehouse_inventory':
    case 'warehouse_inbound':
    case 'warehouse_outbound':
    case 'warehouse_scanner':
    case 'warehouse_slotting':
    case 'warehouse_opname':
    case 'warehouse_retur_muat':
    case 'warehouse_cubication':
    case 'warehouse_fleet_cubication':
    case 'purchasing_stok_opname':
    case 'purchasing_kartu_stok': return loadWarehouseManagementSystem;
    case 'purchasing_stock_overview':
    case 'purchasing_stock_forecast': return loadPurchasingStockAnalysis;
    case 'marketing_online':
    case 'marketing_offline':
    case 'marketing_to_vo_ro':
    case 'marketing_invoice_validation':
    case 'marketing_sales_mapping': return loadMarketingDashboard;
    case 'activity_log': return loadSystemActivityLog;
    case 'branches': return loadMasterCabang;
    case 'users': return loadUserManagement;
    case 'architecture': return loadSupabaseSqlArchitecture;
    case 'e2e_testing': return loadE2ETesterModule;
    default: return null;
  }
}

export function preloadTabModule(tab: NavTab): void {
  if (!import.meta.env.PROD) return;
  const loader = getLoaderForTab(tab);
  if (loader) void loader().catch(() => {});
}
export function preloadTabsSequential(tabs: NavTab[], gapMs = 500): () => void {
  if (!import.meta.env.PROD) return () => {};
  let cancelled = false;
  const run = async () => {
    for (const tab of tabs) {
      if (cancelled) return;
      const loader = getLoaderForTab(tab);
      if (loader) { try { await loader(); } catch {} }
      if (cancelled) return;
      await new Promise(resolve => setTimeout(resolve, gapMs));
    }
  };
  void run();
  return () => { cancelled = true; };
}
