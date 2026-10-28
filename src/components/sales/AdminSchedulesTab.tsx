import React, { useState, useEffect } from 'react';
import {
  Calendar,
  Save,
  RotateCcw,
  Printer,
  FileSpreadsheet,
  Plus,
  Trash2,
  ChevronDown,
  Check
} from 'lucide-react';
import {
  SalesHeaderFilter,
  SalesTopTab
} from './SalesHeaderFilter';

interface AdminSchedulesTabProps {
  onNavigateSubTab?: (sub: 'dashboard' | 'activities' | 'schedules' | 'loading_duration' | 'skill_matrix' | 'jobdesk') => void;
  adminOptions: string[];
}

const ADMIN_NAMES = ['ISTI', 'IZZUL', 'SHOIM', 'FATA', 'BINTANG', 'BAYU'];

const DAYS_HEADER = [
  { key: 'senin', label: 'SENIN', date: '10 Agustus' },
  { key: 'selasa', label: 'SELASA', date: '11 Agustus' },
  { key: 'rabu', label: 'RABU', date: '12 Agustus' },
  { key: 'kamis', label: 'KAMIS', date: '13 Agustus' },
  { key: 'jumat', label: 'JUMAT', date: '14 Agustus' },
  { key: 'sabtu', label: 'SABTU', date: '15 Agustus' }
];

const DUTY_OPTIONS = [
  'Cek Eceran',
  'Cek Faktur Kuning',
  'Cek Faktur Toko',
  'Cek Surat Jalan Toko',
  'Input Retur Toko',
  'HP Telkomsel',
  'HP XL',
  'Muat Kelilingan',
  'Muat Toko',
  'Muat AKS',
  'Data Rekap',
  'Revisi Faktur Toko',
  'Back Up ACC',
  'Piket Pagi'
];

type ScheduleGrid = Record<string, Record<string, string[]>>; // adminName -> dayKey -> array of task strings
type BackupAccGrid = Record<string, string>; // dayKey -> adminName

const INITIAL_SCHEDULE_GRID: ScheduleGrid = {
  ISTI: { senin: ['Cek Eceran'], selasa: [], rabu: [], kamis: [], jumat: [], sabtu: [] },
  IZZUL: { senin: [], selasa: ['Input Faktur'], rabu: [], kamis: [], jumat: [], sabtu: [] },
  SHOIM: { senin: [], selasa: [], rabu: ['Muat Toko'], kamis: [], jumat: [], sabtu: [] },
  FATA: { senin: [], selasa: [], rabu: [], kamis: ['Data Rekap'], jumat: [], sabtu: [] },
  BINTANG: { senin: [], selasa: [], rabu: [], kamis: [], jumat: ['HP Telkomsel'], sabtu: [] },
  BAYU: { senin: [], selasa: [], rabu: [], kamis: [], jumat: [], sabtu: ['Muat Kelilingan'] }
};

const INITIAL_BACKUP_ACC: BackupAccGrid = {
  senin: '',
  selasa: '',
  rabu: '',
  kamis: '',
  jumat: '',
  sabtu: ''
};

export const AdminSchedulesTab: React.FC<AdminSchedulesTabProps> = ({
  onNavigateSubTab
}) => {
  const [selectedAdmin, setSelectedAdmin] = useState('SEMUA ADMIN');
  const [selectedMonth, setSelectedMonth] = useState('Agustus');
  const [selectedYear, setSelectedYear] = useState('2026');
  const [selectedWeek, setSelectedWeek] = useState('Minggu ke-3');
  const [saveToast, setSaveToast] = useState(false);

  const [scheduleGrid, setScheduleGrid] = useState<ScheduleGrid>(() => {
    const saved = localStorage.getItem('akk_schedule_grid_v2');
    return saved ? JSON.parse(saved) : INITIAL_SCHEDULE_GRID;
  });

  const [backupAccGrid, setBackupAccGrid] = useState<BackupAccGrid>(() => {
    const saved = localStorage.getItem('akk_backup_acc_grid_v2');
    return saved ? JSON.parse(saved) : INITIAL_BACKUP_ACC;
  });

  useEffect(() => {
    localStorage.setItem('akk_schedule_grid_v2', JSON.stringify(scheduleGrid));
  }, [scheduleGrid]);

  useEffect(() => {
    localStorage.setItem('akk_backup_acc_grid_v2', JSON.stringify(backupAccGrid));
  }, [backupAccGrid]);

  const handleTopTabChange = (tab: SalesTopTab) => {
    if (tab === 'checklist' || tab === 'aktivitas_view') {
      onNavigateSubTab?.('activities');
    } else if (tab === 'durasi_muat') {
      onNavigateSubTab?.('loading_duration');
    }
  };

  const handleSelectDuty = (admin: string, dayKey: string, duty: string) => {
    if (!duty) return;
    setScheduleGrid(prev => {
      const currentTasks = prev[admin]?.[dayKey] || [];
      if (!currentTasks.includes(duty)) {
        return {
          ...prev,
          [admin]: {
            ...prev[admin],
            [dayKey]: [...currentTasks, duty]
          }
        };
      }
      return prev;
    });
  };

  const handleRemoveDuty = (admin: string, dayKey: string, taskToRemove: string) => {
    setScheduleGrid(prev => {
      const currentTasks = prev[admin]?.[dayKey] || [];
      return {
        ...prev,
        [admin]: {
          ...prev[admin],
          [dayKey]: currentTasks.filter(t => t !== taskToRemove)
        }
      };
    });
  };

  const handleClearCell = (admin: string, dayKey: string) => {
    setScheduleGrid(prev => ({
      ...prev,
      [admin]: {
        ...prev[admin],
        [dayKey]: []
      }
    }));
  };

  const handleSaveAll = () => {
    localStorage.setItem('akk_schedule_grid_v2', JSON.stringify(scheduleGrid));
    localStorage.setItem('akk_backup_acc_grid_v2', JSON.stringify(backupAccGrid));
    setSaveToast(true);
    setTimeout(() => setSaveToast(false), 2500);
  };

  const handleReset = () => {
    if (window.confirm('Reset jadwal admin dan backup ACC ke konfigurasi awal?')) {
      setScheduleGrid(INITIAL_SCHEDULE_GRID);
      setBackupAccGrid(INITIAL_BACKUP_ACC);
      localStorage.removeItem('akk_schedule_grid_v2');
      localStorage.removeItem('akk_backup_acc_grid_v2');
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const handleExportExcel = () => {
    const csvRows: string[] = [];
    csvRows.push(`JADWAL CEK ADMIN SEMINGGU - PERIODE: ${selectedWeek.toUpperCase()} - ${selectedMonth.toUpperCase()} ${selectedYear}`);
    csvRows.push(['NO', 'NAMA', ...DAYS_HEADER.map(d => `${d.label} ${d.date}`)].join(','));

    // Backup ACC row
    csvRows.push(['', 'JADWAL BACK UP ACC', ...DAYS_HEADER.map(d => backupAccGrid[d.key] || '-')].join(','));

    // Admin rows
    ADMIN_NAMES.forEach((admin, idx) => {
      const row = [
        idx + 1,
        admin,
        ...DAYS_HEADER.map(d => (scheduleGrid[admin]?.[d.key] || []).join('; ') || '-')
      ];
      csvRows.push(row.join(','));
    });

    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `jadwal_admin_${selectedMonth}_${selectedYear}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Calculate total scheduled slots
  const totalSlotsCount = Object.values(scheduleGrid).reduce((sum, daysObj) => {
    return sum + Object.values(daysObj).reduce((s, arr) => s + arr.length, 0);
  }, 0);

  return (
    <div className="space-y-6">
      {/* Header & Unified Filter matching Screenshot 4 */}
      <SalesHeaderFilter
        title="Pemantauan Operasional & Aktivitas Admin"
        subtitle="Kelola dan pantau aktivitas harian, durasi muat, serta jadwal kerja admin dalam satu halaman terpadu."
        activeTab="jadwal_admin"
        onTabChange={handleTopTabChange}
        selectedAdmin={selectedAdmin}
        onAdminChange={setSelectedAdmin}
        selectedMonth={selectedMonth}
        onMonthChange={setSelectedMonth}
        selectedYear={selectedYear}
        onYearChange={setSelectedYear}
        jadwalInputCount={totalSlotsCount}
        pencapaianPercent={0}
        periodeLabel={`${selectedMonth.slice(0, 3)} ${selectedYear}`}
      />

      {/* Main Card matching Screenshot 4 */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs space-y-4">
        {/* Title and Top Toolbar */}
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 pb-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-emerald-50 text-emerald-700 flex items-center justify-center">
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">
                Jadwal Cek Admin & Back Up ACC Seminggu
              </h2>
              <p className="text-xs text-slate-400">
                Kelola jadwal harian dengan tampilan responsif dan interaktif.
              </p>
            </div>
          </div>

          {/* Right Action Controls matching Screenshot 4 */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Minggu Dropdown */}
            <div className="relative">
              <select
                value={selectedWeek}
                onChange={e => setSelectedWeek(e.target.value)}
                className="pl-3 pr-7 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 focus:outline-hidden focus:ring-2 focus:ring-emerald-500 cursor-pointer appearance-none"
              >
                <option value="Minggu ke-1">Minggu: Minggu ke-1</option>
                <option value="Minggu ke-2">Minggu: Minggu ke-2</option>
                <option value="Minggu ke-3">Minggu: Minggu ke-3</option>
                <option value="Minggu ke-4">Minggu: Minggu ke-4</option>
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-2.5 pointer-events-none" />
            </div>

            {/* Simpan Button */}
            <button
              onClick={handleSaveAll}
              className="flex items-center gap-1 px-3 py-1.5 bg-emerald-700 hover:bg-emerald-600 text-white rounded-lg text-xs font-semibold shadow-xs transition cursor-pointer"
            >
              <Save className="w-3.5 h-3.5" />
              <span>Simpan</span>
            </button>

            {/* Reset Button */}
            <button
              onClick={handleReset}
              className="flex items-center gap-1 px-3 py-1.5 border border-rose-300 text-rose-600 hover:bg-rose-50 rounded-lg text-xs font-semibold transition cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset</span>
            </button>

            {/* Cetak Button */}
            <button
              onClick={handlePrint}
              className="flex items-center gap-1 px-3 py-1.5 border border-slate-300 text-slate-700 hover:bg-slate-50 rounded-lg text-xs font-semibold transition cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Cetak</span>
            </button>

            {/* Excel Button */}
            <button
              onClick={handleExportExcel}
              className="flex items-center gap-1 px-3 py-1.5 bg-emerald-800 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold shadow-xs transition cursor-pointer"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span>Excel</span>
            </button>
          </div>
        </div>

        {/* Save feedback banner */}
        {saveToast && (
          <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs px-4 py-2 rounded-xl flex items-center gap-2">
            <Check className="w-4 h-4 text-emerald-600" />
            <span>Jadwal mingguan dan Back Up ACC berhasil disimpan ke sistem!</span>
          </div>
        )}

        {/* The Matrix Table matching Screenshot 4 */}
        <div className="overflow-x-auto rounded-xl border border-slate-200">
          <table className="w-full text-xs border-collapse">
            {/* ROW 1: Dark Green Bar JADWAL BACK UP ACC */}
            <thead>
              <tr className="bg-[#064e3b] text-white">
                <th colSpan={2} className="py-2.5 px-3 text-left font-bold uppercase tracking-wider text-[11px] border-r border-emerald-800">
                  JADWAL BACK UP ACC
                </th>
                {DAYS_HEADER.map(day => (
                  <th key={day.key} className="py-2 px-2 text-center border-r border-emerald-800 last:border-r-0 min-w-36">
                    <div className="relative">
                      <select
                        value={backupAccGrid[day.key] || ''}
                        onChange={e =>
                          setBackupAccGrid(prev => ({
                            ...prev,
                            [day.key]: e.target.value
                          }))
                        }
                        className="w-full py-1 pl-2 pr-6 bg-emerald-900/80 hover:bg-emerald-800 border border-emerald-600/50 rounded text-[11px] font-semibold text-emerald-100 cursor-pointer appearance-none text-left"
                      >
                        <option value="">+ Pilih Admin</option>
                        {ADMIN_NAMES.map(admin => (
                          <option key={admin} value={admin} className="text-slate-900 bg-white">
                            {admin}
                          </option>
                        ))}
                      </select>
                      <ChevronDown className="w-3 h-3 text-emerald-300 absolute right-1.5 top-2 pointer-events-none" />
                    </div>
                  </th>
                ))}
              </tr>

              {/* ROW 2: Subheader banner */}
              <tr className="bg-slate-100/90 text-slate-800 border-b border-slate-200">
                <th colSpan={4} className="py-2 px-3 text-left font-extrabold tracking-wide uppercase text-[11px]">
                  JADWAL CEK ADMIN SEMINGGU
                </th>
                <th colSpan={4} className="py-2 px-3 text-right font-bold text-slate-500 uppercase text-[10px]">
                  PERIODE: {selectedWeek.toUpperCase()} - {selectedMonth.toUpperCase()} {selectedYear}
                </th>
              </tr>

              {/* ROW 3: Column Headers NO | NAMA | DAYS */}
              <tr className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200">
                <th className="py-2.5 px-2 text-center w-10 border-r border-slate-200">NO</th>
                <th className="py-2.5 px-3 text-left w-24 border-r border-slate-200">NAMA</th>
                {DAYS_HEADER.map(day => (
                  <th key={day.key} className="py-2 px-2 text-center border-r border-slate-200 last:border-r-0">
                    <div className="font-bold text-slate-900">{day.label}</div>
                    <div className="text-[10px] text-slate-500 font-normal">{day.date}</div>
                  </th>
                ))}
              </tr>
            </thead>

            {/* Admin rows */}
            <tbody className="divide-y divide-slate-200">
              {ADMIN_NAMES.map((admin, idx) => (
                <tr key={admin} className="hover:bg-slate-50/70 transition">
                  <td className="py-3 px-2 text-center font-bold text-slate-500 bg-slate-50/40 border-r border-slate-200">
                    {idx + 1}
                  </td>
                  <td className="py-3 px-3 font-extrabold text-blue-700 bg-slate-50/30 border-r border-slate-200">
                    {admin}
                  </td>
                  {DAYS_HEADER.map(day => {
                    const assignedList = scheduleGrid[admin]?.[day.key] || [];

                    return (
                      <td
                        key={day.key}
                        className="py-2 px-2 border-r border-slate-200 last:border-r-0 align-top min-w-36"
                      >
                        <div className="space-y-1.5">
                          {/* Badges for selected duties */}
                          {assignedList.map(task => (
                            <div
                              key={task}
                              className="flex items-center justify-between gap-1 px-1.5 py-0.5 bg-blue-50 border border-blue-200 rounded text-[11px] font-semibold text-blue-800"
                            >
                              <span className="truncate">{task}</span>
                              <button
                                type="button"
                                onClick={() => handleRemoveDuty(admin, day.key, task)}
                                className="text-blue-400 hover:text-rose-600 transition shrink-0 cursor-pointer"
                              >
                                &times;
                              </button>
                            </div>
                          ))}

                          {/* Action Selector: + Pilih [v] + [+] + [Trash] */}
                          <div className="flex items-center gap-1">
                            <div className="relative flex-1">
                              <select
                                defaultValue=""
                                onChange={e => {
                                  handleSelectDuty(admin, day.key, e.target.value);
                                  e.target.value = '';
                                }}
                                className="w-full py-1 pl-1.5 pr-4 bg-white hover:bg-slate-50 border border-slate-200 rounded text-[10px] text-slate-700 cursor-pointer appearance-none"
                              >
                                <option value="">+ Pilih</option>
                                {DUTY_OPTIONS.map(opt => (
                                  <option key={opt} value={opt}>
                                    {opt}
                                  </option>
                                ))}
                              </select>
                              <ChevronDown className="w-2.5 h-2.5 text-slate-400 absolute right-1 top-2 pointer-events-none" />
                            </div>

                            {/* Clear cell button */}
                            {assignedList.length > 0 && (
                              <button
                                type="button"
                                title="Hapus semua di sel ini"
                                onClick={() => handleClearCell(admin, day.key)}
                                className="p-1 text-slate-300 hover:text-rose-500 rounded transition cursor-pointer"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            )}
                          </div>
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
