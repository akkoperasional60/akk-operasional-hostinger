import React from 'react';
import {
  Activity,
  Calendar,
  Timer,
  Award,
  Settings
} from 'lucide-react';
import { logisticsStore } from '../../services/store';
import { AdminActivitiesTab } from './AdminActivitiesTab';
import { AdminSchedulesTab } from './AdminSchedulesTab';
import { LoadingDurationTab } from './LoadingDurationTab';
import { SkillMatrixTab } from './SkillMatrixTab';
import { JobdeskConfigTab } from './JobdeskConfigTab';

export type SalesAdminSubTab =
  | 'dashboard'
  | 'activities'
  | 'schedules'
  | 'loading_duration'
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
  const users = logisticsStore.getUsers();
  const adminOptions = [
    'SEMUA ADMIN',
    ...users
      .filter(u => u.status === 'approved' && u.role === 'sales_admin')
      .map(u => u.fullName.toUpperCase())
  ];

  const effectiveTab: SalesAdminSubTab = activeSubTab === 'dashboard' ? 'activities' : activeSubTab;

  const tabs = [
    {
      id: 'activities' as SalesAdminSubTab,
      label: '1. Aktivitas Admin',
      icon: Activity,
      description: 'Log Tugas & Tindak Lanjut'
    },
    {
      id: 'schedules' as SalesAdminSubTab,
      label: '2. Jadwal Admin',
      icon: Calendar,
      description: 'Shift & Agenda Meeting'
    },
    {
      id: 'loading_duration' as SalesAdminSubTab,
      label: '3. Durasi Muat Admin',
      icon: Timer,
      description: 'SLA Muat Truk di Gudang'
    },
    {
      id: 'skill_matrix' as SalesAdminSubTab,
      label: '4. Skill Matrix',
      icon: Award,
      description: 'Kompetensi & Sertifikasi'
    },
    {
      id: 'jobdesk' as SalesAdminSubTab,
      label: '5. Pengaturan Jobdesk',
      icon: Settings,
      description: 'SOP, KPI & Batas Approval'
    }
  ];

  return (
    <div className="space-y-4">
      {/* Sub-Navigation Tabs Bar */}
      <div className="bg-white rounded-xl border border-slate-200 p-1.5 shadow-sm">
        <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none">
          {tabs.map(tab => {
            const Icon = tab.icon;
            const isActive = effectiveTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => onSelectSubTab(tab.id)}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold whitespace-nowrap transition-all duration-150 shrink-0 ${
                  isActive
                    ? 'bg-blue-900 text-white shadow-sm'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'text-amber-400' : 'text-slate-400'}`} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Sub-Tab View Rendering */}
      <div>
        {effectiveTab === 'activities' && <AdminActivitiesTab onNavigateSubTab={onSelectSubTab} adminOptions={adminOptions} />}
        {effectiveTab === 'schedules' && <AdminSchedulesTab onNavigateSubTab={onSelectSubTab} adminOptions={adminOptions} />}
        {effectiveTab === 'loading_duration' && <LoadingDurationTab onNavigateSubTab={onSelectSubTab} adminOptions={adminOptions} />}
        {effectiveTab === 'skill_matrix' && <SkillMatrixTab adminOptions={adminOptions} />}
        {effectiveTab === 'jobdesk' && <JobdeskConfigTab onNavigateSubTab={onSelectSubTab} adminOptions={adminOptions} />}
      </div>
    </div>
  );
};

