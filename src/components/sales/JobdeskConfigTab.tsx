import React, { useState, useEffect } from 'react';
import {
  Save,
  Check,
  CheckSquare,
  Square,
  Sparkles,
  Info
} from 'lucide-react';
import { logisticsStore } from '../../services/store';
import {
  SalesHeaderFilter,
  SalesTopTab
} from './SalesHeaderFilter';

interface JobdeskConfigTabProps {
  onNavigateSubTab?: (sub: 'dashboard' | 'activities' | 'schedules' | 'loading_duration' | 'skill_matrix' | 'jobdesk') => void;
  adminOptions: string[];
}

// 27 exact items from Screenshot 5 organized into 3 columns
const JOBDESK_COLUMN_1 = [
  'Cek barang belum terkirim',
  'Cek Faktur Kuning',
  'Cek kembali',
  'HP XL',
  'Indikator Kinerja Utama',
  'Muat AKS',
  'Muat NX',
  'Muat Toko (3)',
  'Data Rekap'
];

const JOBDESK_COLUMN_2 = [
  'Cek Eceran',
  'Cek Faktur Toko',
  'Cek Surat Jalan Toko',
  'Masukan Armada',
  'Membuat Pesanan Penjualan & Faktur (1)',
  'Muat Kelilingan (1)',
  'Muat Toko (1)',
  'Layanan Pelanggan Offline',
  'Revisi Faktur Kelilingan'
];

const JOBDESK_COLUMN_3 = [
  'Cek eceran toko',
  'Cek Kode 7 & 2',
  'HP Telkomsel',
  'Input Retur Toko',
  'Membuat Pesanan Penjualan & Faktur (2)',
  'Muat Kelilingan (2)',
  'Muat Toko (2)',
  'Pembuatan SO Transaksi',
  'Revisi Faktur Toko'
];

const DEFAULT_CHECKED_FOR_ALL = ['HP Telkomsel'];

export const JobdeskConfigTab: React.FC<JobdeskConfigTabProps> = ({
  onNavigateSubTab,
  adminOptions
}) => {
  const [selectedAdmin, setSelectedAdmin] = useState('SEMUA ADMIN');
  const [selectedMonth, setSelectedMonth] = useState('Agustus');
  const [selectedYear, setSelectedYear] = useState('2026');
  const [saveToast, setSaveToast] = useState(false);

  // Load all users to populate the admin dropdown correctly
  const allUsers = logisticsStore.getUsers();
  
  // Admin assignments storage: adminKey -> string[]
  const [assignments, setAssignments] = useState<Record<string, string[]>>(() => {
    const saved = localStorage.getItem('akk_master_jobdesk_v2');
    let config: Record<string, string[]> = {};
    
    if (saved) {
      try {
        config = JSON.parse(saved);
      } catch (e) {
        console.error(e);
      }
    }
    
    // Ensure default structure exists or merge it
    const defaultStructure = {
      'SEMUA ADMIN': DEFAULT_CHECKED_FOR_ALL,
      ISTI: ['Cek Eceran', 'HP Telkomsel', 'Input Retur Toko'],
      IZZUL: ['Cek Faktur Toko', 'Cek Faktur Kuning', 'Membuat Pesanan Penjualan & Faktur (1)'],
      SHOIM: ['Cek Surat Jalan Toko', 'Muat Toko (1)', 'Muat Toko (2)'],
      FATA: ['Data Rekap', 'Masukan Armada', 'Revisi Faktur Toko'],
      BINTANG: ['HP XL', 'Muat Kelilingan (1)', 'Muat Kelilingan (2)'],
      BAYU: ['Muat AKS', 'Muat NX', 'Muat Toko (3)']
    };
    
    // Merge default and saved config
    config = { ...defaultStructure, ...config };
    
    // Add any Adm. Penjualan users found in store to assignments if not already there
    allUsers.forEach(user => {
      if (user.role === 'sales_admin' && !config[user.fullName.toUpperCase()]) {
        config[user.fullName.toUpperCase()] = ['Membuat Pesanan Penjualan & Faktur (1)', 'Input Retur Toko'];
      }
    });
    
    return config;
  });

  const currentAdminChecked = assignments[selectedAdmin] || [];

  const handleTopTabChange = (tab: SalesTopTab) => {
    if (tab === 'checklist' || tab === 'aktivitas_view') {
      onNavigateSubTab?.('activities');
    } else if (tab === 'durasi_muat') {
      onNavigateSubTab?.('loading_duration');
    } else if (tab === 'jadwal_admin') {
      onNavigateSubTab?.('schedules');
    }
  };

  const handleToggleItem = (itemTitle: string) => {
    setAssignments(prev => {
      const currentList = prev[selectedAdmin] || [];
      const updatedList = currentList.includes(itemTitle)
        ? currentList.filter(t => t !== itemTitle)
        : [...currentList, itemTitle];

      return {
        ...prev,
        [selectedAdmin]: updatedList
      };
    });
  };

  const handleSave = () => {
    localStorage.setItem('akk_master_jobdesk_v2', JSON.stringify(assignments));
    setSaveToast(true);
    setTimeout(() => setSaveToast(false), 2500);
  };

  const handleSelectAllInColumn = (columnItems: string[]) => {
    setAssignments(prev => {
      const currentList = prev[selectedAdmin] || [];
      const allSelected = columnItems.every(item => currentList.includes(item));
      const updatedList = allSelected
        ? currentList.filter(item => !columnItems.includes(item))
        : Array.from(new Set([...currentList, ...columnItems]));

      return {
        ...prev,
        [selectedAdmin]: updatedList
      };
    });
  };

  return (
    <div className="space-y-6">
      {/* Header & Unified Filter matching Screenshot 5 */}
      <SalesHeaderFilter
        title="Pengaturan Master Jobdesk"
        subtitle="Atur penugasan master jobdesk bulanan untuk setiap pengguna."
        activeTab="checklist"
        onTabChange={handleTopTabChange}
        adminOptions={adminOptions}
        selectedAdmin={selectedAdmin}
        onAdminChange={setSelectedAdmin}
        selectedMonth={selectedMonth}
        onMonthChange={setSelectedMonth}
        selectedYear={selectedYear}
        onYearChange={setSelectedYear}
        jadwalInputCount={0}
        pencapaianPercent={0}
        periodeLabel={`${selectedMonth.slice(0, 3)} ${selectedYear}`}
      />

      {/* Main Card: Penugasan Master Jobdesk Admin */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-6 shadow-xs space-y-5">
        {/* Card Header & Save Button */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-4 border-b border-slate-100">
          <div>
            <h2 className="text-base font-bold text-slate-900">
              Penugasan Master Jobdesk Admin
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Centang jobdesk di bawah ini untuk ditugaskan kepada Admin:{' '}
              <span className="font-bold text-blue-700">
                {selectedAdmin === 'SEMUA ADMIN' ? 'ALL' : selectedAdmin}
              </span>
            </p>
          </div>

          <button
            onClick={() => {
              const saved = localStorage.getItem('akk_master_jobdesk_v2');
              if (saved) setAssignments(JSON.parse(saved));
            }}
            className="flex items-center gap-1.5 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold shadow-xs transition cursor-pointer"
          >
            <span>Batal</span>
          </button>
          <button
            onClick={handleSave}
            className="flex items-center gap-1.5 px-4 py-2 bg-blue-700 hover:bg-blue-600 text-white rounded-xl text-xs font-semibold shadow-xs transition cursor-pointer self-start sm:self-auto"
          >
            <Save className="w-3.5 h-3.5" />
            <span>Simpan Perubahan Jobdesk</span>
          </button>
        </div>

        {/* Save feedback banner */}
        {saveToast && (
          <div className="bg-blue-50 border border-blue-200 text-blue-800 text-xs px-4 py-2.5 rounded-xl flex items-center gap-2">
            <Check className="w-4 h-4 text-blue-600 shrink-0" />
            <span>
              Perubahan master jobdesk untuk Admin{' '}
              <strong>{selectedAdmin}</strong> berhasil disimpan ke penyimpanan lokal!
            </span>
          </div>
        )}

        {/* 3-Column Grid of 27 Rounded Card Items matching Screenshot 5 */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* COLUMN 1 */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between px-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Kategori Operasional A
              </span>
              <button
                type="button"
                onClick={() => handleSelectAllInColumn(JOBDESK_COLUMN_1)}
                className="text-[10px] text-blue-700 hover:underline font-semibold cursor-pointer"
              >
                Pilih Semua
              </button>
            </div>
            {JOBDESK_COLUMN_1.map(item => {
              const isChecked = currentAdminChecked.includes(item);
              return (
                <label
                  key={item}
                  onClick={() => handleToggleItem(item)}
                  className={`flex items-center gap-3 p-3 rounded-xl border transition cursor-pointer select-none ${
                    isChecked
                      ? 'bg-blue-50/50 border-blue-300 text-slate-900 shadow-xs'
                      : 'bg-white border-slate-200/90 hover:border-slate-300 hover:bg-slate-50/60 text-slate-700'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={() => {}} // handled by label onClick
                    className="w-4 h-4 rounded-md border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer accent-blue-600 shrink-0"
                  />
                  <span className="text-xs font-semibold">{item}</span>
                </label>
              );
            })}
          </div>

          {/* COLUMN 2 */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between px-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Kategori Operasional B
              </span>
              <button
                type="button"
                onClick={() => handleSelectAllInColumn(JOBDESK_COLUMN_2)}
                className="text-[10px] text-blue-700 hover:underline font-semibold cursor-pointer"
              >
                Pilih Semua
              </button>
            </div>
            {JOBDESK_COLUMN_2.map(item => {
              const isChecked = currentAdminChecked.includes(item);
              return (
                <label
                  key={item}
                  onClick={() => handleToggleItem(item)}
                  className={`flex items-center gap-3 p-3 rounded-xl border transition cursor-pointer select-none ${
                    isChecked
                      ? 'bg-blue-50/50 border-blue-300 text-slate-900 shadow-xs'
                      : 'bg-white border-slate-200/90 hover:border-slate-300 hover:bg-slate-50/60 text-slate-700'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={() => {}}
                    className="w-4 h-4 rounded-md border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer accent-blue-600 shrink-0"
                  />
                  <span className="text-xs font-semibold">{item}</span>
                </label>
              );
            })}
          </div>

          {/* COLUMN 3 */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between px-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Kategori Operasional C
              </span>
              <button
                type="button"
                onClick={() => handleSelectAllInColumn(JOBDESK_COLUMN_3)}
                className="text-[10px] text-blue-700 hover:underline font-semibold cursor-pointer"
              >
                Pilih Semua
              </button>
            </div>
            {JOBDESK_COLUMN_3.map(item => {
              const isChecked = currentAdminChecked.includes(item);
              return (
                <label
                  key={item}
                  onClick={() => handleToggleItem(item)}
                  className={`flex items-center gap-3 p-3 rounded-xl border transition cursor-pointer select-none ${
                    isChecked
                      ? 'bg-blue-50/50 border-blue-300 text-slate-900 shadow-xs'
                      : 'bg-white border-slate-200/90 hover:border-slate-300 hover:bg-slate-50/60 text-slate-700'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={() => {}}
                    className="w-4 h-4 rounded-md border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer accent-blue-600 shrink-0"
                  />
                  <span className="text-xs font-semibold">{item}</span>
                </label>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
