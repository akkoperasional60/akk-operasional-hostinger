import React, { useState, useEffect, useMemo } from 'react';
import { logisticsStore } from '../services/store';
import { SystemActivity } from '../types';
import {
  History,
  Search,
  Filter,
  X,
  BarChart3,
  Download,
  Printer,
  PlusCircle,
  Edit3,
  Trash2,
  UserCheck,
  RefreshCw,
  Database
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';

const escapeHtml = (value: unknown): string =>
  String(value ?? '').replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string)
  );

type DataChangeCategory = 'tambah' | 'ubah' | 'kurangi';

const classifyActivityChangeType = (activity: SystemActivity): DataChangeCategory => {
  if (activity.changeType === 'tambah' || activity.changeType === 'ubah' || activity.changeType === 'kurangi') {
    return activity.changeType;
  }
  const combined = `${activity.action || ''} ${activity.details || ''}`.toLowerCase();
  if (/\b(hapus|kurang|potong|nonaktif|tolak|reset|keluar|pemakaian|ganti komponen)\b/.test(combined)) {
    return 'kurangi';
  }
  if (/\b(tambah|buat|input|upload|unggah|restock|registrasi|approval|disetujui|aktifkan)\b/.test(combined)) {
    return 'tambah';
  }
  return 'ubah';
};

const getChangeCategoryMeta = (cat: DataChangeCategory) => {
  if (cat === 'tambah') {
    return {
      label: 'Menambah Data',
      shortLabel: '+ Tambah Data',
      badgeClass:
        'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-300 dark:border-emerald-500/30',
      icon: PlusCircle
    };
  }
  if (cat === 'kurangi') {
    return {
      label: 'Mengurangi / Hapus Data',
      shortLabel: '− Kurangi / Hapus',
      badgeClass:
        'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-500/15 dark:text-rose-300 dark:border-rose-500/30',
      icon: Trash2
    };
  }
  return {
    label: 'Merubah Data',
    shortLabel: '✎ Merubah Data',
    badgeClass:
      'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-500/15 dark:text-indigo-300 dark:border-indigo-500/30',
    icon: Edit3
  };
};

const CustomTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const item = payload[0].payload;
    return (
      <div className="bg-slate-900 text-white border border-slate-700 px-3 py-2 rounded-xl text-[11px] shadow-xl">
        <p className="font-bold text-white">{item.fullName}</p>
        <p className="text-indigo-300 font-bold mt-0.5">{item.count} Perubahan Data</p>
        <p className="text-[10px] text-slate-300 mt-0.5">
          +{item.tambah} Tambah • ✎{item.ubah} Ubah • −{item.kurangi} Kurangi/Hapus
        </p>
      </div>
    );
  }
  return null;
};

export const SystemActivityLog: React.FC = () => {
  const [activities, setActivities] = useState<SystemActivity[]>(() => logisticsStore.getSystemActivities());
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedUser, setSelectedUser] = useState('');
  const [selectedChangeCategory, setSelectedChangeCategory] = useState<'' | DataChangeCategory>('');
  const [selectedDept, setSelectedDept] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    void logisticsStore.hydrateSystemActivitiesFromServer();
    return logisticsStore.subscribe(() => {
      setActivities(logisticsStore.getSystemActivities());
    });
  }, []);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await logisticsStore.hydrateSystemActivitiesFromServer();
      setActivities(logisticsStore.getSystemActivities());
    } finally {
      setTimeout(() => setIsRefreshing(false), 300);
    }
  };

  // Enrich activities with normalized change category
  const enrichedActivities = useMemo(() => {
    return activities.map((a) => ({
      ...a,
      resolvedCategory: classifyActivityChangeType(a)
    }));
  }, [activities]);

  // Unique accounts for filter dropdown
  const uniqueAccounts = useMemo(() => {
    const accounts = new Set<string>();
    enrichedActivities.forEach((a) => {
      if (a.userFullName) accounts.add(a.userFullName);
    });
    return Array.from(accounts).sort((a, b) => a.localeCompare(b, 'id-ID'));
  }, [enrichedActivities]);

  // Unique departments for filter dropdown
  const uniqueDepartments = useMemo(() => {
    const depts = new Set<string>();
    enrichedActivities.forEach((a) => {
      if (a.department) depts.add(a.department);
    });
    return Array.from(depts).sort((a, b) => a.localeCompare(b, 'id-ID'));
  }, [enrichedActivities]);

  // Apply filter rules
  const filteredActivities = useMemo(() => {
    return enrichedActivities.filter((a) => {
      const q = searchTerm.trim().toLowerCase();
      const matchesSearch =
        !q ||
        a.userFullName.toLowerCase().includes(q) ||
        (a.userEmail || '').toLowerCase().includes(q) ||
        a.action.toLowerCase().includes(q) ||
        a.target.toLowerCase().includes(q) ||
        a.details.toLowerCase().includes(q) ||
        (a.department || '').toLowerCase().includes(q);

      const matchesUser = !selectedUser || a.userFullName === selectedUser;
      const matchesCategory = !selectedChangeCategory || a.resolvedCategory === selectedChangeCategory;
      const matchesDept = !selectedDept || a.department === selectedDept;

      let matchesDate = true;
      if (startDate || endDate) {
        const logDate = new Date(a.timestamp);
        if (startDate) {
          const start = new Date(startDate);
          start.setHours(0, 0, 0, 0);
          if (logDate < start) matchesDate = false;
        }
        if (endDate) {
          const end = new Date(endDate);
          end.setHours(23, 59, 59, 999);
          if (logDate > end) matchesDate = false;
        }
      }

      return matchesSearch && matchesUser && matchesCategory && matchesDept && matchesDate;
    });
  }, [enrichedActivities, searchTerm, selectedUser, selectedChangeCategory, selectedDept, startDate, endDate]);

  // Summary counts for Tambah, Ubah, Kurangi/Hapus
  const summaryCounts = useMemo(() => {
    let tambah = 0;
    let ubah = 0;
    let kurangi = 0;
    filteredActivities.forEach((a) => {
      if (a.resolvedCategory === 'tambah') tambah++;
      else if (a.resolvedCategory === 'kurangi') kurangi++;
      else ubah++;
    });
    return {
      total: filteredActivities.length,
      tambah,
      ubah,
      kurangi
    };
  }, [filteredActivities]);

  // Frequency of data changes per User Account for chart
  const accountChartData = useMemo(() => {
    const map = new Map<
      string,
      { fullName: string; count: number; tambah: number; ubah: number; kurangi: number }
    >();
    filteredActivities.forEach((a) => {
      const key = a.userFullName || 'Super Admin';
      const prev = map.get(key) || { fullName: key, count: 0, tambah: 0, ubah: 0, kurangi: 0 };
      prev.count += 1;
      if (a.resolvedCategory === 'tambah') prev.tambah += 1;
      else if (a.resolvedCategory === 'kurangi') prev.kurangi += 1;
      else prev.ubah += 1;
      map.set(key, prev);
    });

    return Array.from(map.values())
      .map((item) => ({
        ...item,
        name: item.fullName.length > 16 ? `${item.fullName.substring(0, 16)}...` : item.fullName
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  }, [filteredActivities]);

  const handleResetFilters = () => {
    setSearchTerm('');
    setSelectedUser('');
    setSelectedChangeCategory('');
    setSelectedDept('');
    setStartDate('');
    setEndDate('');
  };

  const hasActiveFilters = Boolean(
    searchTerm || selectedUser || selectedChangeCategory || selectedDept || startDate || endDate
  );
  const colors = ['#4f46e5', '#6366f1', '#818cf8', '#93c5fd', '#a5b4fc'];

  const exportActivitiesCsv = () => {
    const headers = [
      'Waktu',
      'Akun Pengguna',
      'Email / Role',
      'Departemen',
      'Kategori Perubahan',
      'Aksi',
      'Data Target',
      'Rincian Perubahan Data'
    ];
    const rows = filteredActivities.map((a) => {
      const catMeta = getChangeCategoryMeta(a.resolvedCategory);
      return [
        `"${new Date(a.timestamp).toLocaleString('id-ID')}"`,
        `"${a.userFullName}"`,
        `"${a.userEmail || a.userRole || '-'}"`,
        `"${a.department || '-'}"`,
        `"${catMeta.label}"`,
        `"${a.action}"`,
        `"${a.target}"`,
        `"${a.details.replace(/"/g, '""')}"`
      ];
    });
    const csvContent =
      'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `log_perubahan_data_akun_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const exportActivitiesPdf = () => {
    window.print();
  };

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 sm:p-6 shadow-sm space-y-5">
      {/* Header & Actions */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-4">
        <div className="flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-2xl bg-indigo-50 dark:bg-indigo-500/15 border border-indigo-200 dark:border-indigo-500/30 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shrink-0">
            <History className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-white tracking-tight">
              Pusat Log Aktivitas Perubahan Data
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Rekam jejak akun pengguna yang menambah, merubah, dan mengurangi/menghapus data operasional
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={handleRefresh}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold transition cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
            <span>Segarkan Log</span>
          </button>

          <button
            type="button"
            onClick={exportActivitiesCsv}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-600/20 dark:hover:bg-emerald-600/30 border border-emerald-200 dark:border-emerald-500/40 text-emerald-700 dark:text-emerald-300 text-xs font-bold transition cursor-pointer shadow-xs"
            title="Unduh format Excel / CSV"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Unduh Excel</span>
          </button>

          <button
            type="button"
            onClick={exportActivitiesPdf}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-600/20 dark:hover:bg-indigo-600/30 border border-indigo-200 dark:border-indigo-500/40 text-indigo-700 dark:text-indigo-300 text-xs font-bold transition cursor-pointer shadow-xs"
            title="Cetak atau Unduh Format PDF"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Cetak / PDF</span>
          </button>
        </div>
      </div>

      {/* Ringkasan Kategori Perubahan Data (Tambah, Ubah, Kurangi/Hapus) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <button
          type="button"
          onClick={() => setSelectedChangeCategory('')}
          className={`p-4 rounded-2xl border text-left transition cursor-pointer ${
            selectedChangeCategory === ''
              ? 'bg-slate-900 text-white border-slate-900 dark:bg-indigo-600 dark:border-indigo-500 shadow-sm'
              : 'bg-slate-50/80 dark:bg-slate-950/50 border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white hover:border-slate-300'
          }`}
        >
          <div className="flex items-center justify-between">
            <span
              className={`text-[10px] font-black uppercase tracking-wider ${
                selectedChangeCategory === '' ? 'text-slate-300 dark:text-indigo-100' : 'text-slate-500 dark:text-slate-400'
              }`}
            >
              Total Aktivitas Data
            </span>
            <Database className="w-4 h-4 opacity-80" />
          </div>
          <div className="text-xl font-black mt-1 tabular-nums">{summaryCounts.total}</div>
          <div
            className={`text-[11px] mt-0.5 ${
              selectedChangeCategory === '' ? 'text-slate-300 dark:text-indigo-100' : 'text-slate-500 dark:text-slate-400'
            }`}
          >
            Semua perubahan data oleh akun
          </div>
        </button>

        <button
          type="button"
          onClick={() => setSelectedChangeCategory(selectedChangeCategory === 'tambah' ? '' : 'tambah')}
          className={`p-4 rounded-2xl border text-left transition cursor-pointer ${
            selectedChangeCategory === 'tambah'
              ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
              : 'bg-emerald-50/60 dark:bg-emerald-950/25 border-emerald-200 dark:border-emerald-800/60 text-slate-900 dark:text-white hover:border-emerald-300'
          }`}
        >
          <div className="flex items-center justify-between">
            <span
              className={`text-[10px] font-black uppercase tracking-wider ${
                selectedChangeCategory === 'tambah' ? 'text-emerald-100' : 'text-emerald-700 dark:text-emerald-400'
              }`}
            >
              Menambah Data (+)
            </span>
            <PlusCircle className="w-4 h-4 text-emerald-500 dark:text-emerald-400" />
          </div>
          <div className="text-xl font-black mt-1 tabular-nums">{summaryCounts.tambah}</div>
          <div
            className={`text-[11px] mt-0.5 ${
              selectedChangeCategory === 'tambah' ? 'text-emerald-100' : 'text-slate-500 dark:text-slate-400'
            }`}
          >
            Data baru yang ditambahkan akun
          </div>
        </button>

        <button
          type="button"
          onClick={() => setSelectedChangeCategory(selectedChangeCategory === 'ubah' ? '' : 'ubah')}
          className={`p-4 rounded-2xl border text-left transition cursor-pointer ${
            selectedChangeCategory === 'ubah'
              ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
              : 'bg-indigo-50/60 dark:bg-indigo-950/25 border-indigo-200 dark:border-indigo-800/60 text-slate-900 dark:text-white hover:border-indigo-300'
          }`}
        >
          <div className="flex items-center justify-between">
            <span
              className={`text-[10px] font-black uppercase tracking-wider ${
                selectedChangeCategory === 'ubah' ? 'text-indigo-100' : 'text-indigo-700 dark:text-indigo-400'
              }`}
            >
              Merubah Data (✎)
            </span>
            <Edit3 className="w-4 h-4 text-indigo-500 dark:text-indigo-400" />
          </div>
          <div className="text-xl font-black mt-1 tabular-nums">{summaryCounts.ubah}</div>
          <div
            className={`text-[11px] mt-0.5 ${
              selectedChangeCategory === 'ubah' ? 'text-indigo-100' : 'text-slate-500 dark:text-slate-400'
            }`}
          >
            Data yang diperbarui / diubah akun
          </div>
        </button>

        <button
          type="button"
          onClick={() => setSelectedChangeCategory(selectedChangeCategory === 'kurangi' ? '' : 'kurangi')}
          className={`p-4 rounded-2xl border text-left transition cursor-pointer ${
            selectedChangeCategory === 'kurangi'
              ? 'bg-rose-600 text-white border-rose-600 shadow-sm'
              : 'bg-rose-50/60 dark:bg-rose-950/25 border-rose-200 dark:border-rose-800/60 text-slate-900 dark:text-white hover:border-rose-300'
          }`}
        >
          <div className="flex items-center justify-between">
            <span
              className={`text-[10px] font-black uppercase tracking-wider ${
                selectedChangeCategory === 'kurangi' ? 'text-rose-100' : 'text-rose-700 dark:text-rose-400'
              }`}
            >
              Mengurangi / Hapus Data (−)
            </span>
            <Trash2 className="w-4 h-4 text-rose-500 dark:text-rose-400" />
          </div>
          <div className="text-xl font-black mt-1 tabular-nums">{summaryCounts.kurangi}</div>
          <div
            className={`text-[11px] mt-0.5 ${
              selectedChangeCategory === 'kurangi' ? 'text-rose-100' : 'text-slate-500 dark:text-slate-400'
            }`}
          >
            Data yang dikurangi / dihapus akun
          </div>
        </button>
      </div>

      {/* Search Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="relative w-full sm:w-96">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Cari nama akun, jenis perubahan, target data, atau rincian..."
            className="w-full pl-10 pr-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-indigo-500"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        {hasActiveFilters && (
          <button
            type="button"
            onClick={handleResetFilters}
            className="flex items-center gap-1.5 text-xs font-bold text-rose-600 dark:text-rose-400 hover:underline transition cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
            <span>Atur Ulang Filter</span>
          </button>
        )}
      </div>

      {/* Grid: Left - Filter Lanjutan, Right - Frekuensi Perubahan Data per Akun */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        <div className="lg:col-span-7 bg-slate-50/70 dark:bg-slate-950/40 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-4 space-y-3.5">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-700 dark:text-slate-200">
            <Filter className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
            <span>Filter Lanjutan Log Perubahan Data</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {/* Filter Akun Pengguna */}
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                Akun Pengguna
              </label>
              <select
                className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-2.5 py-2 text-xs text-slate-800 dark:text-white focus:outline-none focus:border-indigo-500 cursor-pointer"
                value={selectedUser}
                onChange={(e) => setSelectedUser(e.target.value)}
              >
                <option value="">Semua Akun Pengguna</option>
                {uniqueAccounts.map((acc) => (
                  <option key={acc} value={acc}>
                    {acc}
                  </option>
                ))}
              </select>
            </div>

            {/* Filter Kategori Perubahan Data */}
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                Jenis Perubahan Data
              </label>
              <select
                className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-2.5 py-2 text-xs text-slate-800 dark:text-white focus:outline-none focus:border-indigo-500 cursor-pointer"
                value={selectedChangeCategory}
                onChange={(e) => setSelectedChangeCategory(e.target.value as '' | DataChangeCategory)}
              >
                <option value="">Semua (Tambah, Ubah, Kurangi)</option>
                <option value="tambah">Menambah Data (+)</option>
                <option value="ubah">Merubah Data (✎)</option>
                <option value="kurangi">Mengurangi / Hapus Data (−)</option>
              </select>
            </div>

            {/* Filter Departemen */}
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                Departemen
              </label>
              <select
                className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-2.5 py-2 text-xs text-slate-800 dark:text-white focus:outline-none focus:border-indigo-500 cursor-pointer"
                value={selectedDept}
                onChange={(e) => setSelectedDept(e.target.value)}
              >
                <option value="">Semua Departemen</option>
                {uniqueDepartments.map((dept) => (
                  <option key={dept} value={dept}>
                    {dept}
                  </option>
                ))}
              </select>
            </div>

            {/* Mulai Tanggal */}
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                Mulai Tanggal
              </label>
              <input
                type="date"
                className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-2.5 py-1.5 text-xs text-slate-800 dark:text-white focus:outline-none focus:border-indigo-500 cursor-pointer"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>

            {/* Sampai Tanggal */}
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                Sampai Tanggal
              </label>
              <input
                type="date"
                className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-2.5 py-1.5 text-xs text-slate-800 dark:text-white focus:outline-none focus:border-indigo-500 cursor-pointer"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
          </div>
        </div>

        {/* Mini Chart Panel: Aktivitas Perubahan Data per Akun */}
        <div className="lg:col-span-5 bg-slate-50/70 dark:bg-slate-950/40 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-4 flex flex-col min-h-[180px] justify-between">
          <div className="flex items-center gap-2 mb-2">
            <BarChart3 className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
            <span className="text-xs font-bold text-slate-700 dark:text-slate-200">
              Frekuensi Perubahan Data per Akun
            </span>
          </div>

          <div className="h-[130px] w-full">
            {accountChartData.length === 0 ? (
              <div className="h-full flex items-center justify-center text-xs text-slate-400">
                Belum ada riwayat perubahan data
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={accountChartData}
                  layout="vertical"
                  margin={{ top: 5, right: 15, left: -15, bottom: 5 }}
                >
                  <XAxis type="number" hide />
                  <YAxis
                    dataKey="name"
                    type="category"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: '#64748b', fontSize: 10, fontWeight: 600 }}
                    width={110}
                  />
                  <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(99, 102, 241, 0.06)' }} />
                  <Bar dataKey="count" radius={[0, 6, 6, 0]} barSize={12}>
                    {accountChartData.map((_entry, index) => (
                      <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>

      {/* Tabel Log Aktivitas Perubahan Data */}
      <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800">
        {filteredActivities.length === 0 ? (
          <div className="text-center py-12 px-4 text-slate-500 dark:text-slate-400 text-xs space-y-1">
            <p className="font-bold text-slate-700 dark:text-slate-200">
              Belum ada catatan penambahan, perubahan, atau pengurangan data yang sesuai filter.
            </p>
            <p className="text-[11px]">
              Setiap aksi tambah, ubah, atau hapus data oleh akun pengguna akan tercatat otomatis di sini.
            </p>
          </div>
        ) : (
          <table className="w-full text-xs text-left border-collapse">
            <thead className="bg-slate-50 dark:bg-slate-800/70 text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800 uppercase text-[10px] font-black tracking-wider">
              <tr>
                <th className="py-3 px-4 w-[150px]">Waktu</th>
                <th className="py-3 px-4 w-[190px]">Akun Pengguna</th>
                <th className="py-3 px-4 w-[170px]">Departemen</th>
                <th className="py-3 px-4 w-[210px]">Jenis Perubahan Data</th>
                <th className="py-3 px-4 w-[200px]">Data Target</th>
                <th className="py-3 px-4">Rincian Perubahan Data</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/70 text-slate-800 dark:text-slate-100">
              {filteredActivities.map((a) => {
                const catMeta = getChangeCategoryMeta(a.resolvedCategory);
                const CatIcon = catMeta.icon;
                return (
                  <tr
                    key={a.id}
                    className="hover:bg-slate-50/80 dark:hover:bg-slate-800/30 transition-colors align-middle"
                  >
                    <td className="py-3 px-4 text-slate-500 dark:text-slate-400 whitespace-nowrap font-mono text-[11px]">
                      {new Date(a.timestamp).toLocaleString('id-ID', {
                        year: 'numeric',
                        month: '2-digit',
                        day: '2-digit',
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit'
                      })}
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-lg bg-indigo-50 dark:bg-indigo-500/15 border border-indigo-200/80 dark:border-indigo-500/30 flex items-center justify-center text-indigo-600 dark:text-indigo-300 font-black text-[11px] shrink-0">
                          {escapeHtml((a.userFullName || 'U').charAt(0).toUpperCase())}
                        </div>
                        <div className="min-w-0">
                          <div className="font-bold text-slate-900 dark:text-white truncate flex items-center gap-1">
                            <span>{a.userFullName}</span>
                            <UserCheck className="w-3 h-3 text-emerald-500 shrink-0" />
                          </div>
                          {a.userEmail && (
                            <div className="text-[10px] text-slate-400 truncate">{a.userEmail}</div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-slate-600 dark:text-slate-300 font-medium">
                      {a.department || '-'}
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex flex-col items-start gap-1">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg text-[10px] font-black border ${catMeta.badgeClass}`}
                        >
                          <CatIcon className="w-3 h-3 shrink-0" />
                          <span>{catMeta.shortLabel}</span>
                        </span>
                        <span className="text-[11px] font-bold text-slate-700 dark:text-slate-200">
                          {a.action}
                        </span>
                      </div>
                    </td>
                    <td className="py-3 px-4 font-bold text-slate-800 dark:text-slate-200 break-words">
                      {a.target}
                    </td>
                    <td className="py-3 px-4 text-slate-600 dark:text-slate-300 leading-relaxed break-words">
                      {a.details}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};
