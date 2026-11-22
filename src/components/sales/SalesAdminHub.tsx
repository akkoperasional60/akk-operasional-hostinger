import React, { useState } from 'react';
import { useSalesAdminOptions } from './SalesHeaderFilter';
import { SalesAdminDashboardTab } from './SalesAdminDashboardTab';
import { AdminActivitiesTab } from './AdminActivitiesTab';
import { AdminSchedulesTab } from './AdminSchedulesTab';
import { LoadingDurationTab } from './LoadingDurationTab';
import { SkillMatrixTab } from './SkillMatrixTab';
import { JobdeskConfigTab } from './JobdeskConfigTab';
import { SalesInvoiceSoTab, SalesRfidScannerAppTab } from './SalesLoadingRfidSystem';
import { SalesFormKirimTab } from './FormKirimSystem';
import { MuatReturValidationTab } from './MuatReturValidationTab';
import type { NavTab } from '../Sidebar';

export type SalesAdminSubTab =
  | 'dashboard'
  | 'activities'
  | 'schedules'
  | 'loading_duration'
  | 'invoice_so'
  | 'form_kirim'
  | 'rfid_scanner'
  | 'muat_validation'
  | 'skill_matrix'
  | 'jobdesk';

interface SalesAdminHubProps {
  activeSubTab: SalesAdminSubTab;
  onSelectSubTab: (subTab: SalesAdminSubTab) => void;
  onNavigateTab?: (tab: NavTab) => void;
}

export const SalesAdminHub: React.FC<SalesAdminHubProps> = ({
  activeSubTab,
  onSelectSubTab,
  onNavigateTab
}) => {
  const adminOptions = useSalesAdminOptions();
  const [selectedRfidInvoiceId, setSelectedRfidInvoiceId] = useState<string | null>(null);
  const effectiveTab: SalesAdminSubTab = activeSubTab || 'dashboard';

  if (effectiveTab === 'rfid_scanner') {
    return (
      <SalesRfidScannerAppTab
        initialInvoiceId={selectedRfidInvoiceId}
        onNavigateToInvoiceInput={() => onSelectSubTab('invoice_so')}
      />
    );
  }

  return (
    <div className="space-y-4">
      {effectiveTab === 'dashboard' && (
        <SalesAdminDashboardTab
          onNavigateTab={(tab) => {
            if (onNavigateTab) {
              onNavigateTab(tab);
            } else if (tab.startsWith('sales_')) {
              onSelectSubTab(tab.replace(/^sales_/, '') as SalesAdminSubTab);
            }
          }}
        />
      )}
      {effectiveTab === 'activities' && (
        <AdminActivitiesTab onNavigateSubTab={onSelectSubTab} adminOptions={adminOptions} />
      )}
      {effectiveTab === 'schedules' && (
        <AdminSchedulesTab onNavigateSubTab={onSelectSubTab} adminOptions={adminOptions} />
      )}
      {effectiveTab === 'loading_duration' && (
        <LoadingDurationTab onNavigateSubTab={onSelectSubTab} adminOptions={adminOptions} />
      )}
      {effectiveTab === 'invoice_so' && (
        <SalesInvoiceSoTab
          onOpenRfidScannerForInvoice={(invoiceId) => {
            setSelectedRfidInvoiceId(invoiceId);
            onSelectSubTab('rfid_scanner');
          }}
        />
      )}
      {effectiveTab === 'form_kirim' && (
        <SalesFormKirimTab />
      )}
      {effectiveTab === 'muat_validation' && (
        <MuatReturValidationTab />
      )}
      {effectiveTab === 'skill_matrix' && (
        <SkillMatrixTab adminOptions={adminOptions} />
      )}
      {effectiveTab === 'jobdesk' && (
        <JobdeskConfigTab onNavigateSubTab={onSelectSubTab} adminOptions={adminOptions} />
      )}
    </div>
  );
};
