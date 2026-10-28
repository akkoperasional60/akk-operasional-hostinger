import React, { useState, useEffect } from 'react';
import {
  CheckCircle2,
  Clock,
  Plus,
  Search,
  Filter,
  Layers,
  Calendar,
  User,
  AlertCircle
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
  SalesTopTab
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
  const [selectedAdmin, setSelectedAdmin] = useState('SEMUA ADMIN');
  const [selectedMonth, setSelectedMonth] = useState('Agustus');
  const [selectedYear, setSelectedYear] = useState('2026');
  const [checklistRows, setChecklistRows] = useState<ChecklistRow[]>(() => {
    const jobdeskConfig = JSON.parse(localStorage.getItem('akk_master_jobdesk_v2') || '{}');
    const jobsForAdmin = jobdeskConfig[selectedAdmin === 'SEMUA ADMIN' ? 'SEMUA ADMIN' : selectedAdmin] || [];
    const history = JSON.parse(localStorage.getItem('akk_checklist_history') || '[]');
    const periodKey = `${selectedAdmin}_${selectedMonth}_${selectedYear}`;
    const existingPeriod = history.find((h: any) => h.key === periodKey);

    if (existingPeriod) return existingPeriod.rows;

    return jobsForAdmin.map((job: string, index: number) => ({
        id: String(index + 1),
        name: job,
        days: Array(30).fill(false)
    }));
  });

  useEffect(() => {
    const jobdeskConfig = JSON.parse(localStorage.getItem('akk_master_jobdesk_v2') || '{}');
    const jobsForAdmin = jobdeskConfig[selectedAdmin === 'SEMUA ADMIN' ? 'SEMUA ADMIN' : selectedAdmin] || [];
    const history = JSON.parse(localStorage.getItem('akk_checklist_history') || '[]');
    const periodKey = `${selectedAdmin}_${selectedMonth}_${selectedYear}`;
    const existingPeriod = history.find((h: any) => h.key === periodKey);

    if (existingPeriod) {
        setChecklistRows(existingPeriod.rows);
    } else {
        setChecklistRows(jobsForAdmin.map((job: string, index: number) => ({
            id: String(index + 1),
            name: job,
            days: Array(30).fill(false)
        })));
    }
  }, [selectedAdmin, selectedMonth, selectedYear]);
  const [taskStatuses, setTaskStatuses] = useState<TaskStatusRow[]>(() => {
    const saved = localStorage.getItem('akk_task_status_v1');
    return saved ? JSON.parse(saved) : INITIAL_TASK_STATUSES;
  });

  const [activeViewMode, setActiveViewMode] = useState<'checklist' | 'all_activities'>('checklist');

  // For "Aktivitas View (Semua)"
  const [activities, setActivities] = useState<AdminActivity[]>(logisticsStore.getAdminActivities());
  const [searchTerm, setSearchTerm] = useState('');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  // New activity form
  const [newAdmin, setNewAdmin] = useState('ISTI');
  const [newActionType, setNewActionType] = useState<AdminActivity['actionType']>('Input PO');
  const [newClient, setNewClient] = useState('');
  const [newNotes, setNewNotes] = useState('');
  const [newDuration, setNewDuration] = useState(25);

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

  // Metrics
  const totalChecksChecked = checklistRows.reduce(
    (sum, r) => sum + r.days.filter(Boolean).length,
    0
  );
  const totalPossibleChecks = checklistRows.length * 12;
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
        jadwalInputCount={0}
        pencapaianPercent={achievementRate}
        periodeLabel={`${selectedMonth.slice(0, 3)} ${selectedYear}`}
        adminOptions={adminOptions}
      />

      {activeViewMode === 'checklist' ? (
        <div className="space-y-6">
          {/* SECTION 1: AKTIVITAS & JOBDESK HARIAN ADMIN (CHECKLIST TANGGAL) */}
          <div className="bg-white border border-slate-200/90 rounded-2xl overflow-hidden shadow-xs">
            {/* Dark Blue Banner Header matching Screenshot 2 */}
            <div className="bg-[#1e3a8a] px-5 py-3.5 flex items-center justify-between">
              <h2 className="text-xs sm:text-sm font-bold text-white tracking-wide uppercase">
                1. AKTIVITAS & JOBDESK HARIAN ADMIN (CHECKLIST TANGGAL)
              </h2>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
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
                    alert(`Data untuk ${selectedAdmin} (${selectedMonth} ${selectedYear}) berhasil disimpan sebagai riwayat!`);
                  }}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold px-3 py-1 rounded-lg transition"
                >
                  Simpan Periode Ini
                </button>
                <span className="text-[11px] font-semibold text-blue-100 bg-blue-950/60 border border-blue-700/50 px-3 py-1 rounded-full">
                  Pengguna: {selectedAdmin === 'SEMUA ADMIN' ? 'ALL' : selectedAdmin} ({selectedMonth} {selectedYear})
                </span>
              </div>
            </div>

            {/* Wave Chart Visualization */}
            <div className="h-28 p-4 bg-slate-50 border-b border-slate-200">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={Array.from({ length: 30 }, (_, i) => ({
                  day: i + 1,
                  total: checklistRows.reduce((sum, r) => sum + (r.days[i] ? 1 : 0), 0)
                }))}>
                  <Area
                    type="monotone"
                    dataKey="total"
                    stroke="#1e3a8a"
                    fill="#bfdbfe"
                    strokeWidth={2}
                  />
                  <XAxis dataKey="day" hide />
                  <YAxis hide />
                  <Tooltip
                    contentStyle={{ borderRadius: '12px', fontSize: '10px' }}
                    labelFormatter={(label) => `Tanggal: ${label}`}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            {/* Checklist Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  {/* Daily Percentages Row */}
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <td className="py-2 px-4 text-left font-bold text-slate-500"></td>
                    <td className="py-2 px-3 text-center font-bold text-slate-500 border-r border-slate-200"></td>
                    {Array.from({ length: 30 }, (_, i) => {
                      const dayChecks = checklistRows.reduce((sum, r) => sum + (r.days[i] ? 1 : 0), 0);
                      const percent = checklistRows.length > 0 ? Math.round((dayChecks / checklistRows.length) * 100) : 0;
                      const colorClass = percent < 30 ? 'text-emerald-600' : percent <= 60 ? 'text-amber-600' : 'text-rose-600';
                      return (
                        <td key={'activity-day-' + i} className={`py-1 text-center font-bold text-[10px] border-r border-slate-100 ${colorClass}`}>
                          {percent}%
                        </td>
                      );
                    })}
                  </tr>
                  {/* Header Row: Dates */}
                  <tr className="border-b border-slate-200 text-slate-700 font-bold">
                    <th className="py-3 px-4 text-left bg-blue-100/70 text-slate-800 font-extrabold w-48">
                      JOBDESK ADMIN
                    </th>
                    <th className="py-3 px-3 text-center bg-slate-50 font-extrabold w-16 border-r border-slate-200">
                      TOTAL
                    </th>
                    {Array.from({ length: 30 }, (_, i) => i + 1).map(day => (
                      <th
                        key={day}
                        className="py-3 px-2 text-center text-slate-700 font-bold border-r border-slate-100 last:border-r-0 min-w-8"
                      >
                        T{day}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {checklistRows.map(row => {
                    const rowTotal = row.days.filter(Boolean).length;
                    return (
                      <tr key={row.id} className="hover:bg-slate-50/70 transition">
                        <td className="py-3 px-4 font-semibold text-slate-800 whitespace-nowrap">
                          {row.name}
                        </td>
                        <td className="py-3 px-3 text-center font-bold text-slate-700 bg-slate-50/50 border-r border-slate-200">
                          {rowTotal}
                        </td>
                        {row.days.slice(0, 30).map((checked: boolean, idx: number) => (
                          <td
                            key={idx}
                            className="py-3 px-2 text-center border-r border-slate-100 last:border-r-0"
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => handleToggleDay(row.id, idx)}
                              className="w-4 h-4 rounded-md border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer accent-emerald-600"
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

          {/* SECTION 2: STATUS TUGAS HARIAN ADMIN matching Screenshot 2 */}
          <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center">
                  <CheckCircle2 className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Status Tugas Harian Admin</h3>
                  <p className="text-xs text-slate-400">Monitoring status pengerjaan checklist admin</p>
                </div>
              </div>
              <span className="text-xs font-bold text-blue-700 bg-blue-50 px-3 py-1 rounded-full border border-blue-100">
                {taskStatuses.length} Tugas Total
              </span>
            </div>

            {/* Tasks Table */}
            <div className="overflow-x-auto mt-2">
              <table className="w-full text-xs text-left">
                <thead>
                  <tr className="border-b border-slate-100 text-slate-400 uppercase text-[10px] tracking-wider font-semibold">
                    <th className="py-3 px-2">NAMA TUGAS / CHECKLIST</th>
                    <th className="py-3 px-2">ADMIN PIC</th>
                    <th className="py-3 px-2">JAM TARGET</th>
                    <th className="py-3 px-2">STATUS</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {taskStatuses.map(item => (
                    <tr key={item.id} className="hover:bg-slate-50/70 transition">
                      <td className="py-3.5 px-2 font-medium text-slate-800">
                        {item.taskName}
                      </td>
                      <td className="py-3.5 px-2 font-bold text-blue-600">
                        {item.adminPic}
                      </td>
                      <td className="py-3.5 px-2 text-slate-600">
                        {item.targetTime}
                      </td>
                      <td className="py-3.5 px-2">
                        <span
                          className={`inline-block px-3 py-1 rounded-full font-bold text-[11px] ${
                            item.status === 'Selesai'
                              ? 'bg-emerald-100 text-emerald-800'
                              : item.status === 'Proses'
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-slate-100 text-slate-600'
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
          <div className="bg-blue-50 border border-blue-200 rounded-2xl p-5 shadow-xs">
            <h4 className="text-sm font-bold text-blue-900 mb-3 flex items-center gap-2">
              <Layers className="w-4 h-4" />
              Tugas Jobdesk Anda: {selectedAdmin === 'SEMUA ADMIN' ? 'Semua' : selectedAdmin}
            </h4>
            <div className="flex flex-wrap gap-2">
              {(JSON.parse(localStorage.getItem('akk_master_jobdesk_v2') || '{}')[selectedAdmin === 'SEMUA ADMIN' ? 'SEMUA ADMIN' : selectedAdmin] || []).map((job: string) => (
                <span key={job} className="bg-blue-100 text-blue-800 text-xs font-semibold px-3 py-1 rounded-full border border-blue-200">
                  {job}
                </span>
              ))}
            </div>
          </div>

          {/* Activities Log */}
          <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Seluruh Log Aktivitas Admin</h3>
                <p className="text-xs text-slate-400">Daftar riwayat aktivitas harian seluruh staf admin penjualan</p>
              </div>
              <button
                onClick={() => setIsAddModalOpen(true)}
                className="flex items-center gap-1.5 px-3.5 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-semibold shadow-xs transition cursor-pointer self-start sm:self-auto"
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
                className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead>
                  <tr className="border-b border-slate-100 text-slate-400 uppercase text-[10px] tracking-wider font-semibold">
                    <th className="py-2.5 px-2">ADMIN</th>
                    <th className="py-2.5 px-2">JENIS TUGAS</th>
                    <th className="py-2.5 px-2">KLIEN / TOKO</th>
                    <th className="py-2.5 px-2">DURASI</th>
                    <th className="py-2.5 px-2">STATUS</th>
                    <th className="py-2.5 px-2">CATATAN</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {activities
                    .filter(
                      a =>
                        a.adminName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                        a.clientName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                        a.notes.toLowerCase().includes(searchTerm.toLowerCase())
                    )
                    .map(act => (
                      <tr key={act.id} className="hover:bg-slate-50/70 transition">
                        <td className="py-3 px-2 font-bold text-slate-800">{act.adminName}</td>
                        <td className="py-3 px-2 font-medium text-slate-700">{act.actionType}</td>
                        <td className="py-3 px-2 text-slate-600">{act.clientName}</td>
                        <td className="py-3 px-2 text-slate-600">{act.durationMinutes} mnt</td>
                        <td className="py-3 px-2">
                          <span className="inline-block px-2.5 py-0.5 rounded-full font-semibold text-[11px] bg-blue-100 text-blue-800">
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
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-200">
            <h3 className="text-base font-bold text-slate-900 mb-4">Input Aktivitas Admin</h3>
            <form onSubmit={handleAddActivity} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-600 font-semibold mb-1">Nama Admin</label>
                <select
                  value={newAdmin}
                  onChange={e => setNewAdmin(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl"
                >
                  {['ISTI', 'IZZUL', 'SHOIM', 'FATA', 'BINTANG', 'BAYU'].map(name => (
                    <option key={name} value={name}>
                      {name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-600 font-semibold mb-1">Jenis Aktivitas</label>
                <select
                  value={newActionType}
                  onChange={e => setNewActionType(e.target.value as AdminActivity['actionType'])}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl"
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
                <label className="block text-slate-600 font-semibold mb-1">Nama Klien / Toko Retail</label>
                <input
                  type="text"
                  required
                  placeholder="cth. PT Indomarco Prismatama DC Banyuwangi"
                  value={newClient}
                  onChange={e => setNewClient(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl"
                />
              </div>

              <div>
                <label className="block text-slate-600 font-semibold mb-1">Durasi (Menit)</label>
                <input
                  type="number"
                  min="1"
                  value={newDuration}
                  onChange={e => setNewDuration(Number(e.target.value))}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl"
                />
              </div>

              <div>
                <label className="block text-slate-600 font-semibold mb-1">Catatan</label>
                <textarea
                  rows={2}
                  placeholder="Detail pengerjaan..."
                  value={newNotes}
                  onChange={e => setNewNotes(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-xl font-medium"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold shadow-xs"
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
