import React, { useState } from 'react';
import { useSalesAdminOptions } from './SalesHeaderFilter';
import { AdminActivitiesTab } from './AdminActivitiesTab';
import { AdminSchedulesTab } from './AdminSchedulesTab';
import { LoadingDurationTab } from './LoadingDurationTab';
import { SkillMatrixTab } from './SkillMatrixTab';
import { JobdeskConfigTab } from './JobdeskConfigTab';
import { SalesInvoiceSoTab, SalesRfidScannerAppTab } from './SalesLoadingRfidSystem';
import { SalesFormKirimTab } from './FormKirimSystem';

export type SalesAdminSubTab =
  | 'dashboard'
  | 'activities'
  | 'schedules'
  | 'loading_duration'
  | 'invoice_so'
  | 'form_kirim'
  | 'rfid_scanner'
  | 'skill_matrix'
  | 'jobdesk';

interface SalesAdminHubProps {
  activeSubTab: SalesAdminSubTab;
  onSelectSubTab: (subTab: SalesAdminSubTab) => void;
}

export const SalesAdminHub: React.FC<SalesAdminHubProps> = ({
  activeSubTab,
  onSelectSubTab
}) => {
  const adminOptions = useSalesAdminOptions();
  const [selectedRfidInvoiceId, setSelectedRfidInvoiceId] = useState<string | null>(null);
  const effectiveTab: SalesAdminSubTab = activeSubTab === 'dashboard' ? 'activities' : activeSubTab;

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
      {effectiveTab === 'skill_matrix' && (
        <SkillMatrixTab adminOptions={adminOptions} />
      )}
      {effectiveTab === 'jobdesk' && (
        <JobdeskConfigTab onNavigateSubTab={onSelectSubTab} adminOptions={adminOptions} />
      )}
    </div>
  );
};
