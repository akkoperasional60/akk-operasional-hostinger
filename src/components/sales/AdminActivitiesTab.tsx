import React, { useState, useEffect, useMemo } from 'react';
import {
  CheckCircle2,
  Plus,
  Search,
  Layers,
  Check,
  CalendarCheck,
  Sparkles
} from 'lucide-react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer
} from 'recharts';
import {
  SalesHeaderFilter,
  SalesTopTab,
  useSalesAdminUsers
} from './SalesHeaderFilter';
import { logisticsStore } from '../../services/store';
import { AdminActivity } from '../../types';
import { LoadingDurationTab } from './LoadingDurationTab';
import { AdminSchedulesTab } from './AdminSchedulesTab';

interface AdminActivitiesTabProps {
  onNavigateSubTab?: (sub: 'dashboard' | 'activities' | 'schedules' | 'loading_duration' | 'skill_matrix' | 'jobdesk') => void;
}

interface TaskStatusRow {
  id: string;
  taskName: string;
  adminPic: string;
  targetTime: string;
  status: 'Selesai' | 'Proses' | 'Pending';
}

interface ChecklistRow {
  id: string;
  name: string;
  days: boolean[];
}

const DEFAULT_CHECKLIST_JOBS = [
  'Cek Eceran',
  'Cek Faktur Kuning',
  'Cek Faktur Toko',
  'Cek Surat Jalan Toko',
  'Input Retur Toko',
  'HP Telkomsel',
  'Membuat Pesanan Penjualan & Faktur (1)',
  'Data Rekap'
];

const INITIAL_TASK_STATUSES: TaskStatusRow[] = [
  {
    id: 't1',
    taskName: 'Cek Retur Penjual Harian',
    adminPic: 'ISTI',
    targetTime: '08:00 WIB',
    status: 'Selesai'
  },
  {
    id: 't2',
    taskName: 'Input Faktur Ritel Rogojampi',
    adminPic: 'IZZUL',
    targetTime: '09:30 WIB',
    status: 'Proses'
  },
  {
    id: 't3',
    taskName: 'Validasi Surat Jalan Toko',
    adminPic: 'SHOIM',
    targetTime: '11:00 WIB',
    status: 'Selesai'
  },
  {
    id: 't4',
    taskName: 'Ekspor Argo & Cek BT',
    adminPic: 'FATA',
    targetTime: '13:15 WIB',
    status: 'Pending'
  }
];

export const AdminActivitiesTab: React.FC<AdminActivitiesTabProps & { adminOptions: string[] }> = ({
  onNavigateSubTab,
  adminOptions
}) => {
  const salesAdminUsers = useSalesAdminUsers();
  const salesAdminNames = useMemo(() => {
    const names = salesAdminUsers
      .map(u => (u.fullName || '').trim().toUpperCase())
      .filter(Boolean);
    return names.length > 0 ? Array.from(new Set(names)) : ['ADMIN PENJUALAN'];
  }, [salesAdminUsers]);

  const [selectedAdmin, setSelectedAdmin] = useState('SEMUA ADMIN');
  const [selectedMonth, setSelectedMonth] = useState('Agustus');
  const [selectedYear, setSelectedYear] = useState('2026');
  const [saveToastMsg, setSaveToastMsg] = useState<string | null>(null);

  const [checklistRows, setChecklistRows] = useState<ChecklistRow[]>(() => {
    let jobdeskConfig: Record<string, any> = {};
    let history: any[] = [];
    try {
      const rawCfg = JSON.parse(localStorage.getItem('akk_master_jobdesk_v2') || '{}');
      if (rawCfg && typeof rawCfg === 'object') jobdeskConfig = rawCfg;
    } catch {}
    try {
      const rawHist = JSON.parse(localStorage.getItem('akk_checklist_history') || '[]');
      if (Array.isArray(rawHist)) history = rawHist;
    } catch {}

    const configuredJobs = jobdeskConfig[selectedAdmin === 'SEMUA ADMIN' ? 'SEMUA ADMIN' : selectedAdmin];
    const jobsForAdmin = Array.isArray(configuredJobs) && configuredJobs.length > 0
      ? configuredJobs
      : DEFAULT_CHECKLIST_JOBS;
    const periodKey = `${selectedAdmin}_${selectedMonth}_${selectedYear}`;
    const existingPeriod = history.find((h: any) => h && h.key === periodKey);

    if (existingPeriod && Array.isArray(existingPeriod.rows) && existingPeriod.rows.length > 0) {
      return existingPeriod.rows.map((r: any, idx: number) => ({
        id: String(r?.id || idx + 1),
        name: String(r?.name || 'Tugas'),
        days: Array.isArray(r?.days) ? r.days : Array(30).fill(false)
      }));
    }

    return jobsForAdmin.map((job: string, index: number) => ({
      id: String(index + 1),
      name: job,
      days: Array(30).fill(false)
    }));
  });

  useEffect(() => {
    let jobdeskConfig: Record<string, any> = {};
    let history: any[] = [];
    try {
      const rawCfg = JSON.parse(localStorage.getItem('akk_master_jobdesk_v2') || '{}');
      if (rawCfg && typeof rawCfg === 'object') jobdeskConfig = rawCfg;
    } catch {}
    try {
      const rawHist = JSON.parse(localStorage.getItem('akk_checklist_history') || '[]');
      if (Array.isArray(rawHist)) history = rawHist;
    } catch {}

    const configuredJobs = jobdeskConfig[selectedAdmin === 'SEMUA ADMIN' ? 'SEMUA ADMIN' : selectedAdmin];
    const jobsForAdmin = Array.isArray(configuredJobs) && configuredJobs.length > 0
      ? configuredJobs
      : DEFAULT_CHECKLIST_JOBS;
    const periodKey = `${selectedAdmin}_${selectedMonth}_${selectedYear}`;
    const existingPeriod = history.find((h: any) => h && h.key === periodKey);

    if (existingPeriod && Array.isArray(existingPeriod.rows) && existingPeriod.rows.length > 0) {
      setChecklistRows(
        existingPeriod.rows.map((r: any, idx: number) => ({
          id: String(r?.id || idx + 1),
          name: String(r?.name || 'Tugas'),
          days: Array.isArray(r?.days) ? r.days : Array(30).fill(false)
        }))
      );
    } else {
      setChecklistRows(
        jobsForAdmin.map((job: string, index: number) => ({
          id: String(index + 1),
          name: job,
          days: Array(30).fill(false)
        }))
      );
    }
  }, [selectedAdmin, selectedMonth, selectedYear]);

  const [taskStatuses, setTaskStatuses] = useState<TaskStatusRow[]>(() => {
    try {
      const saved = localStorage.getItem('akk_task_status_v1');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {}
    return INITIAL_TASK_STATUSES;
  });

  const [activeViewMode, setActiveViewMode] = useState<'checklist' | 'all_activities'>('checklist');

  // For "Aktivitas View (Semua)"
  const [activities, setActivities] = useState<AdminActivity[]>(logisticsStore.getAdminActivities());
  const [searchTerm, setSearchTerm] = useState('');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  // New activity form
  const [newAdmin, setNewAdmin] = useState(() => salesAdminNames[0] || 'ADMIN PENJUALAN');
  const [newActionType, setNewActionType] = useState<AdminActivity['actionType']>('Input PO');
  const [newClient, setNewClient] = useState('');
  const [newNotes, setNewNotes] = useState('');
  const [newDuration, setNewDuration] = useState(25);

  useEffect(() => {
    if (salesAdminNames.length > 0 && !salesAdminNames.includes(newAdmin)) {
      setNewAdmin(salesAdminNames[0]);
    }
  }, [salesAdminNames, newAdmin]);

  useEffect(() => {
    localStorage.setItem('akk_daily_checklist_v1', JSON.stringify(checklistRows));
  }, [checklistRows]);

  useEffect(() => {
    localStorage.setItem('akk_task_status_v1', JSON.stringify(taskStatuses));
  }, [taskStatuses]);

  useEffect(() => {
    return logisticsStore.subscribe(() => {
      setActivities(logisticsStore.getAdminActivities());
    });
  }, []);

  const handleToggleDay = (rowId: string, dayIndex: number) => {
    setChecklistRows(prev =>
      prev.map(row => {
        if (row.id === rowId) {
          const nextDays = [...row.days];
          nextDays[dayIndex] = !nextDays[dayIndex];
          return { ...row, days: nextDays };
        }
        return row;
      })
    );
  };

  const handleTopTabChange = (tab: SalesTopTab) => {
    if (tab === 'checklist') {
      setActiveViewMode('checklist');
    } else if (tab === 'aktivitas_view') {
      setActiveViewMode('all_activities');
    } else if (tab === 'durasi_muat') {
      onNavigateSubTab?.('loading_duration');
    } else if (tab === 'jadwal_admin') {
      onNavigateSubTab?.('schedules');
    }
  };

  const handleSavePeriod = () => {
    const history = JSON.parse(localStorage.getItem('akk_checklist_history') || '[]');
    const periodKey = `${selectedAdmin}_${selectedMonth}_${selectedYear}`;

    const filteredHistory = history.filter((h: any) => h.key !== periodKey);
    filteredHistory.push({
      key: periodKey,
      admin: selectedAdmin,
      month: selectedMonth,
      year: selectedYear,
      rows: checklistRows,
      savedAt: new Date().toISOString()
    });

    localStorage.setItem('akk_checklist_history', JSON.stringify(filteredHistory));
    setSaveToastMsg(`Data checklist ${selectedAdmin} (${selectedMonth} ${selectedYear}) berhasil disimpan!`);
    setTimeout(() => setSaveToastMsg(null), 3000);
  };

  // Metrics
  const totalChecksChecked = checklistRows.reduce(
    (sum, r) => sum + r.days.filter(Boolean).length,
    0
  );
  const totalPossibleChecks = checklistRows.length * 30;
  const achievementRate = totalPossibleChecks > 0
    ? Math.round((totalChecksChecked / totalPossibleChecks) * 100)
    : 0;

  const handleAddActivity = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newClient) return;

    logisticsStore.addAdminActivity({
      adminName: newAdmin,
      actionType: newActionType,
      clientName: newClient,
      timestamp: new Date().toISOString(),
      status: 'completed',
      notes: newNotes || 'Selesai diproses sesuai SOP',
      durationMinutes: newDuration
    });

    setIsAddModalOpen(false);
    setNewClient('');
    setNewNotes('');
  };

  return (
    <div className="space-y-6">
      {/* Header & Unified Filter */}
      <SalesHeaderFilter
        title="Pemantauan Operasional & Aktivitas Admin"
        subtitle="Kelola dan pantau aktivitas harian, durasi muat, serta jadwal kerja admin dalam satu halaman terpadu."
        activeTab={activeViewMode === 'all_activities' ? 'aktivitas_view' : 'checklist'}
        onTabChange={handleTopTabChange}
        selectedAdmin={selectedAdmin}
        onAdminChange={setSelectedAdmin}
        selectedMonth={selectedMonth}
        onMonthChange={setSelectedMonth}
        selectedYear={selectedYear}
        onYearChange={setSelectedYear}
        jadwalInputCount={checklistRows.length}
        pencapaianPercent={achievementRate}
        periodeLabel={`${selectedMonth.slice(0, 3)} ${selectedYear}`}
        adminOptions={adminOptions}
      />

      {activeViewMode === 'checklist' ? (
        <div className="space-y-6">
          {/* SECTION 1: AKTIVITAS & JOBDESK HARIAN ADMIN (CHECKLIST TANGGAL) - Refreshed Color Tone */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-xs">
            {/* Clean High-Contrast Header Banner */}
            <div className="bg-indigo-600 text-white px-5 py-3.5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-white/15 flex items-center justify-center shrink-0">
                  <CalendarCheck className="w-4 h-4 text-white" />
                </div>
                <div>
                  <h2 className="text-xs sm:text-sm font-bold text-white tracking-wide uppercase">
                    1. Aktivitas &amp; Jobdesk Harian Admin (Checklist Tanggal)
                  </h2>
                  <p className="text-[11px] text-indigo-100">
                    Monitoring realisasi pengerjaan jobdesk harian tanggal T1 s/d T30
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={handleSavePeriod}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold px-3.5 py-1.5 rounded-lg shadow-xs transition cursor-pointer flex items-center gap-1.5"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>Simpan Periode Ini</span>
                </button>
                <span className="text-[11px] font-semibold text-white bg-indigo-700 border border-indigo-400/40 px-3 py-1.5 rounded-lg">
                  Pengguna: {selectedAdmin === 'SEMUA ADMIN' ? 'ALL' : selectedAdmin} ({selectedMonth} {selectedYear})
                </span>
              </div>
            </div>

            {saveToastMsg && (
              <div className="bg-emerald-50 dark:bg-emerald-950/40 border-b border-emerald-200 dark:border-emerald-800/60 px-5 py-2.5 text-xs font-semibold text-emerald-800 dark:text-emerald-300 flex items-center gap-2">
                <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>{saveToastMsg}</span>
              </div>
            )}

            {/* Wave Chart Visualization with Clean Indigo/Emerald Tone */}
            <div className="h-32 p-4 bg-slate-50/70 dark:bg-slate-950/50 border-b border-slate-200 dark:border-slate-800">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={Array.from({ length: 30 }, (_, i) => ({
                    day: `T${i + 1}`,
                    total: checklistRows.reduce((sum, r) => sum + (r.days[i] ? 1 : 0), 0)
                  }))}
                >
                  <defs>
                    <linearGradient id="checklistAreaGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.28} />
                      <stop offset="95%" stopColor="#4f46e5" stopOpacity={0.03} />
                    </linearGradient>
                  </defs>
                  <Area
                    type="monotone"
                    dataKey="total"
                    stroke="#4f46e5"
                    fill="url(#checklistAreaGrad)"
                    strokeWidth={2.5}
                  />
                  <XAxis dataKey="day" hide />
                  <YAxis hide />
                  <Tooltip
                    contentStyle={{
                      borderRadius: '10px',
                      fontSize: '11px',
                      border: '1px solid #e2e8f0'
                    }}
                    formatter={(value: any) => [`${value} Jobdesk Selesai`, 'Realisasi']}
                    labelFormatter={label => `Tanggal: ${label}`}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            {/* Checklist Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  {/* Daily Percentages Row */}
                  <tr className="bg-slate-50/90 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800">
                    <td className="py-2 px-4 text-left font-bold text-[10px] uppercase tracking-wider text-slate-400">
                      Realisasi Harian
                    </td>
                    <td className="py-2 px-3 text-center font-bold text-[10px] text-indigo-600 dark:text-indigo-400 border-r border-slate-200 dark:border-slate-800 font-mono tabular-nums">
                      {achievementRate}%
                    </td>
                    {Array.from({ length: 30 }, (_, i) => {
                      const dayChecks = checklistRows.reduce((sum, r) => sum + (r.days[i] ? 1 : 0), 0);
                      const percent = checklistRows.length > 0 ? Math.round((dayChecks / checklistRows.length) * 100) : 0;
                      const colorClass =
                        percent >= 70
                          ? 'text-emerald-600 dark:text-emerald-400 bg-emerald-50/50 dark:bg-emerald-950/20'
                          : percent > 0
                          ? 'text-indigo-600 dark:text-indigo-400 bg-indigo-50/40 dark:bg-indigo-950/20'
                          : 'text-slate-400 dark:text-slate-500';
                      return (
                        <td
                          key={'activity-day-' + i}
                          className={`py-1.5 text-center font-bold text-[10px] border-r border-slate-100 dark:border-slate-800/80 font-mono tabular-nums ${colorClass}`}
                        >
                          {percent}%
                        </td>
                      );
                    })}
                  </tr>
                  {/* Header Row: Dates */}
                  <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200 font-bold bg-slate-100/70 dark:bg-slate-800/70">
                    <th className="py-3 px-4 text-left bg-indigo-50/80 dark:bg-indigo-950/40 text-indigo-950 dark:text-indigo-200 font-extrabold min-w-52 border-r border-slate-200 dark:border-slate-800">
                      JOBDESK ADMIN
                    </th>
                    <th className="py-3 px-3 text-center bg-slate-100/90 dark:bg-slate-800 font-extrabold w-16 border-r border-slate-200 dark:border-slate-800">
                      TOTAL
                    </th>
                    {Array.from({ length: 30 }, (_, i) => i + 1).map(day => (
                      <th
                        key={day}
                        className="py-3 px-2 text-center text-slate-700 dark:text-slate-300 font-bold border-r border-slate-200/70 dark:border-slate-800 last:border-r-0 min-w-9 font-mono tabular-nums"
                      >
                        T{day}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/70">
                  {checklistRows.map(row => {
                    const rowTotal = row.days.filter(Boolean).length;
                    return (
                      <tr key={row.id} className="hover:bg-indigo-50/30 dark:hover:bg-slate-800/50 transition">
                        <td className="py-3 px-4 font-semibold text-slate-800 dark:text-slate-200 whitespace-nowrap border-r border-slate-100 dark:border-slate-800">
                          {row.name}
                        </td>
                        <td className="py-3 px-3 text-center font-extrabold text-indigo-700 dark:text-indigo-300 bg-indigo-50/30 dark:bg-indigo-950/20 border-r border-slate-200 dark:border-slate-800 font-mono tabular-nums">
                          {rowTotal}
                        </td>
                        {row.days.slice(0, 30).map((checked: boolean, idx: number) => (
                          <td
                            key={idx}
                            className={`py-2.5 px-2 text-center border-r border-slate-100 dark:border-slate-800/60 last:border-r-0 ${
                              checked ? 'bg-emerald-50/40 dark:bg-emerald-950/20' : ''
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => handleToggleDay(row.id, idx)}
                              className="w-4 h-4 rounded-md border-slate-300 dark:border-slate-700 text-indigo-600 focus:ring-indigo-500 cursor-pointer accent-indigo-600"
                            />
                          </td>
                        ))}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* SECTION 2: STATUS TUGAS HARIAN ADMIN */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
                  <CheckCircle2 className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">Status Tugas Harian Admin</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Monitoring status pengerjaan checklist admin penjualan</p>
                </div>
              </div>
              <span className="text-xs font-bold text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/50 px-3 py-1 rounded-lg border border-indigo-200/70 dark:border-indigo-800/60 font-mono tabular-nums">
                {taskStatuses.length} Tugas Total
              </span>
            </div>

            {/* Tasks Table */}
            <div className="overflow-x-auto mt-2">
              <table className="w-full text-xs text-left">
                <thead>
                  <tr className="border-b border-slate-100 dark:border-slate-800 text-slate-500 dark:text-slate-400 uppercase text-[10px] tracking-wider font-bold">
                    <th className="py-3 px-2">NAMA TUGAS / CHECKLIST</th>
                    <th className="py-3 px-2">ADMIN PIC</th>
                    <th className="py-3 px-2">JAM TARGET</th>
                    <th className="py-3 px-2">STATUS</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {taskStatuses.map(item => (
                    <tr key={item.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/50 transition">
                      <td className="py-3.5 px-2 font-semibold text-slate-800 dark:text-slate-200">
                        {item.taskName}
                      </td>
                      <td className="py-3.5 px-2 font-bold text-indigo-600 dark:text-indigo-400">
                        {item.adminPic}
                      </td>
                      <td className="py-3.5 px-2 text-slate-600 dark:text-slate-400 font-mono tabular-nums">
                        {item.targetTime}
                      </td>
                      <td className="py-3.5 px-2">
                        <span
                          className={`inline-block px-2.5 py-1 rounded-md font-bold text-[11px] ${
                            item.status === 'Selesai'
                              ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300'
                              : item.status === 'Proses'
                              ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300'
                              : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                          }`}
                        >
                          {item.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : (
        /* AKTIVITAS VIEW (SEMUA) - Log & Record View */
        <div className="space-y-6">
          {/* Jobdesks for Selected Admin */}
          <div className="bg-indigo-50/70 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-800/60 rounded-2xl p-5 shadow-xs">
            <h4 className="text-sm font-bold text-indigo-950 dark:text-indigo-200 mb-3 flex items-center gap-2">
              <Layers className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
              Tugas Jobdesk Anda: {selectedAdmin === 'SEMUA ADMIN' ? 'Semua Admin' : selectedAdmin}
            </h4>
            <div className="flex flex-wrap gap-2">
              {(() => {
                let jobs = DEFAULT_CHECKLIST_JOBS;
                try {
                  const raw = JSON.parse(localStorage.getItem('akk_master_jobdesk_v2') || '{}');
                  const target = raw?.[selectedAdmin === 'SEMUA ADMIN' ? 'SEMUA ADMIN' : selectedAdmin];
                  if (Array.isArray(target) && target.length > 0) jobs = target;
                } catch {}
                return jobs.map((job: string) => (
                  <span key={job} className="bg-white dark:bg-slate-900 text-indigo-800 dark:text-indigo-300 text-xs font-semibold px-3 py-1 rounded-lg border border-indigo-200 dark:border-indigo-800">
                    {job}
                  </span>
                ));
              })()}
            </div>
          </div>

          {/* Activities Log */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">Seluruh Log Aktivitas Admin</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">Daftar riwayat aktivitas harian seluruh staf admin penjualan</p>
              </div>
              <button
                onClick={() => setIsAddModalOpen(true)}
                className="flex items-center gap-1.5 px-3.5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold shadow-xs transition cursor-pointer self-start sm:self-auto"
              >
                <Plus className="w-4 h-4" />
                <span>Input Aktivitas Baru</span>
              </button>
            </div>

            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
              <input
                type="text"
                placeholder="Cari aktivitas, klien, atau nama admin..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-800 dark:text-slate-200 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead>
                  <tr className="border-b border-slate-100 dark:border-slate-800 text-slate-500 uppercase text-[10px] tracking-wider font-semibold">
                    <th className="py-2.5 px-2">ADMIN</th>
                    <th className="py-2.5 px-2">JENIS TUGAS</th>
                    <th className="py-2.5 px-2">KLIEN / TOKO</th>
                    <th className="py-2.5 px-2">DURASI</th>
                    <th className="py-2.5 px-2">STATUS</th>
                    <th className="py-2.5 px-2">CATATAN</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {activities
                    .filter(
                      a =>
                        a.adminName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                        a.clientName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                        a.notes.toLowerCase().includes(searchTerm.toLowerCase())
                    )
                    .map(act => (
                      <tr key={act.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/50 transition">
                        <td className="py-3 px-2 font-bold text-slate-800 dark:text-slate-200">{act.adminName}</td>
                        <td className="py-3 px-2 font-medium text-slate-700 dark:text-slate-300">{act.actionType}</td>
                        <td className="py-3 px-2 text-slate-600 dark:text-slate-400">{act.clientName}</td>
                        <td className="py-3 px-2 text-slate-600 dark:text-slate-400 font-mono tabular-nums">{act.durationMinutes} mnt</td>
                        <td className="py-3 px-2">
                          <span className="inline-block px-2.5 py-0.5 rounded-md font-semibold text-[11px] bg-indigo-100 dark:bg-indigo-950/60 text-indigo-800 dark:text-indigo-300">
                            {act.status}
                          </span>
                        </td>
                        <td className="py-3 px-2 text-slate-500 max-w-xs truncate">{act.notes}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>

          <LoadingDurationTab adminOptions={adminOptions} />
          <AdminSchedulesTab adminOptions={adminOptions} />
        </div>
      )}

      {/* Modal Add Activity */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-200 dark:border-slate-800">
            <h3 className="text-base font-bold text-slate-900 dark:text-white mb-4">Input Aktivitas Admin</h3>
            <form onSubmit={handleAddActivity} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-600 dark:text-slate-300 font-semibold mb-1">
                  Nama Admin (Adm. Penjualan)
                </label>
                <select
                  value={newAdmin}
                  onChange={e => setNewAdmin(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-white font-semibold"
                >
                  {salesAdminNames.map(name => (
                    <option key={name} value={name}>
                      {name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-600 dark:text-slate-300 font-semibold mb-1">Jenis Aktivitas</label>
                <select
                  value={newActionType}
                  onChange={e => setNewActionType(e.target.value as AdminActivity['actionType'])}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-white"
                >
                  <option value="Input PO">Input PO</option>
                  <option value="Follow Up Pembayaran">Follow Up Pembayaran</option>
                  <option value="Terbitkan DO">Terbitkan DO</option>
                  <option value="Koordinasi Sampel">Koordinasi Sampel</option>
                  <option value="Approval Diskon">Approval Diskon</option>
                  <option value="Update Resi Logistik">Update Resi Logistik</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-600 dark:text-slate-300 font-semibold mb-1">Nama Klien / Toko Retail</label>
                <input
                  type="text"
                  required
                  placeholder="cth. PT Indomarco Prismatama DC Banyuwangi"
                  value={newClient}
                  onChange={e => setNewClient(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-slate-600 dark:text-slate-300 font-semibold mb-1">Durasi (Menit)</label>
                <input
                  type="number"
                  min="1"
                  value={newDuration}
                  onChange={e => setNewDuration(Number(e.target.value))}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-white font-mono tabular-nums"
                />
              </div>

              <div>
                <label className="block text-slate-600 dark:text-slate-300 font-semibold mb-1">Catatan</label>
                <textarea
                  rows={2}
                  placeholder="Detail pengerjaan..."
                  value={newNotes}
                  onChange={e => setNewNotes(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-white"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl font-medium"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold shadow-xs"
                >
                  Simpan Aktivitas
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
