import React, { useState } from 'react';
import {
  User,
  Clock,
  FileText,
  CheckCircle2,
  RotateCw,
  Truck
} from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar
} from 'recharts';

// Data matching Screenshot 1
const WEEKLY_ACTIVITY_DATA = [
  { date: '20 Jul', tercatat: 50, selesai: 48 },
  { date: '27 Jul', tercatat: 52, selesai: 50 },
  { date: '3 Agu', tercatat: 43, selesai: 41 },
  { date: '10 Agu', tercatat: 51, selesai: 49 },
  { date: '17 Agu', tercatat: 48, selesai: 47 },
  { date: '24 Agu', tercatat: 45, selesai: 44 },
  { date: '31 Agu', tercatat: 49, selesai: 48 },
  { date: '7 Sep', tercatat: 49, selesai: 48 }
];

const WEEKLY_DELIVERY_DATA = [
  { week: 'W1', avgDuration: 12.5, slaTarget: 10 },
  { week: 'W2', avgDuration: 10.2, slaTarget: 10 },
  { week: 'W3', avgDuration: 11.8, slaTarget: 10 },
  { week: 'W4', avgDuration: 9.5, slaTarget: 10 },
];

const SKILL_DISTRIBUTION_DATA = [
  { name: 'Input Resi', value: 124, percent: '45%', color: '#6366f1' },
  { name: 'Processing Order', value: 64, percent: '23%', color: '#0ea5e9' },
  { name: 'Retur', value: 46, percent: '17%', color: '#f59e0b' },
  { name: 'Handling Complaint', value: 39, percent: '14%', color: '#ec4899' }
];

const SLA_TREND_DATA = [
  { date: '20 Jul', compliance: 10 },
  { date: '27 Jul', compliance: 10 },
  { date: '3 Agu', compliance: 10 },
  { date: '10 Agu', compliance: 10 },
  { date: '17 Agu', compliance: 10 },
  { date: '24 Agu', compliance: 72 },
  { date: '31 Agu', compliance: 73 },
  { date: '7 Sep', compliance: 75 }
];

const SKILL_MATRIX_ROWS = [
  {
    skill: 'Input Resi',
    target: 'target 5 mnt',
    ahli: 2,
    menengah: 1,
    pemula: 0,
    belum: 0
  },
  {
    skill: 'Processing Order',
    target: 'target 20 mnt',
    ahli: 1,
    menengah: 2,
    pemula: 0,
    belum: 0
  },
  {
    skill: 'Retur',
    target: 'target 25 mnt',
    ahli: 0,
    menengah: 3,
    pemula: 0,
    belum: 0
  },
  {
    skill: 'Handling Complaint',
    target: 'target 30 mnt',
    ahli: 0,
    menengah: 2,
    pemula: 1,
    belum: 0
  }
];

export const SalesDashboardTab: React.FC = () => {
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = () => {
    setIsRefreshing(true);
    setTimeout(() => setIsRefreshing(false), 500);
  };

  return (
    <div className="space-y-6">
      {/* Top Header matching Screenshot 1 */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Dashboard</h1>
          <p className="text-xs text-slate-400 mt-0.5">
            13 Sep 2026 · ringkasan operasional admin penjualan
          </p>
        </div>

        {/* User Pill Dewi Kartika */}
        <div className="flex items-center gap-2 px-3 py-1.5 bg-white border border-slate-200/90 rounded-full shadow-xs self-start sm:self-auto">
          <div className="w-5 h-5 rounded-full bg-slate-100 flex items-center justify-center text-slate-600">
            <User className="w-3 h-3" />
          </div>
          <span className="text-xs font-medium text-slate-700">Dewi Kartika</span>
        </div>
      </div>

      {/* 5 KPI Metric Cards matching Screenshot 1 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
        {/* 1. ADMIN AKTIF */}
        <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              ADMIN AKTIF
            </span>
            <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
              <User className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-3xl font-bold text-slate-900">3</div>
            <div className="text-xs text-slate-400 mt-1">1 menunggu approval</div>
          </div>
        </div>

        {/* 2. ON DUTY HARI INI */}
        <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              ON DUTY HARI INI
            </span>
            <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-3xl font-bold text-slate-900">3</div>
            <div className="text-xs text-slate-400 mt-1">shift pagi/siang aktif</div>
          </div>
        </div>

        {/* 3. TOTAL TUGAS */}
        <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              TOTAL TUGAS
            </span>
            <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
              <FileText className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-3xl font-bold text-slate-900">120</div>
            <div className="text-xs text-slate-400 mt-1">bulan berjalan</div>
          </div>
        </div>

        {/* 4. RATA-RATA DURASI MUAT */}
        <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              RATA-RATA DURASI MUAT
            </span>
            <div className="w-7 h-7 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-3xl font-bold text-slate-900">34.9 mnt</div>
            <div className="text-xs text-slate-400 mt-1">389 sesi (30 hari)</div>
          </div>
        </div>

        {/* 5. SLA COMPLIANCE */}
        <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              SLA COMPLIANCE
            </span>
            <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-3xl font-bold text-slate-900">84,8%</div>
            <div className="text-xs text-slate-400 mt-1">59 sesi over SLA</div>
          </div>
        </div>
      </div>

      {/* Middle Row: Tren Aktivitas Mingguan & Distribusi Kategori Skill */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Tren Aktivitas Mingguan (approx 7.5 cols) */}
        <div className="lg:col-span-8 bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Tren Aktivitas Mingguan</h3>
                <p className="text-xs text-slate-400 mt-0.5">8 minggu terakhir</p>
              </div>
              <button
                onClick={handleRefresh}
                className="flex items-center gap-1 text-xs font-semibold text-slate-500 hover:text-slate-800 transition cursor-pointer"
              >
                <RotateCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
                <span>Perbarui</span>
              </button>
            </div>

            {/* Custom Legend */}
            <div className="flex items-center gap-4 mt-3 text-xs">
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-blue-600 inline-block" />
                <span className="text-slate-600 font-medium">Tugas tercatat</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" />
                <span className="text-slate-600 font-medium">Tugas selesai</span>
              </div>
            </div>
          </div>

          <div className="h-64 mt-4">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={WEEKLY_ACTIVITY_DATA} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="tercatatGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <XAxis
                  dataKey="date"
                  tickLine={false}
                  axisLine={{ stroke: '#e2e8f0' }}
                  tick={{ fontSize: 11, fill: '#64748b' }}
                />
                <YAxis
                  domain={[0, 80]}
                  ticks={[0, 20, 40, 60, 80]}
                  tickLine={false}
                  axisLine={{ stroke: '#e2e8f0' }}
                  tick={{ fontSize: 11, fill: '#64748b' }}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#0f172a',
                    borderColor: '#1e293b',
                    borderRadius: '8px',
                    color: '#fff',
                    fontSize: '12px'
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="tercatat"
                  name="Tugas tercatat"
                  stroke="#3b82f6"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#tercatatGrad)"
                />
                <Line
                  type="monotone"
                  dataKey="selesai"
                  name="Tugas selesai"
                  stroke="#10b981"
                  strokeWidth={2}
                  dot={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Distribusi Kategori Skill (approx 4.5 cols) */}
        <div className="lg:col-span-4 bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs flex flex-col justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-900">Distribusi Kategori Skill</h3>
            <p className="text-xs text-slate-400 mt-0.5">Aktivitas selesai 30 hari terakhir</p>
          </div>

          <div className="relative h-48 my-2 flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={SKILL_DISTRIBUTION_DATA}
                  innerRadius={55}
                  outerRadius={75}
                  paddingAngle={3}
                  dataKey="value"
                >
                  {SKILL_DISTRIBUTION_DATA.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(val: any) => [`${val} tugas`, 'Volume']}
                  contentStyle={{
                    backgroundColor: '#0f172a',
                    borderColor: '#1e293b',
                    borderRadius: '8px',
                    color: '#fff',
                    fontSize: '12px'
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
            {/* Center Label in Donut */}
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="text-2xl font-bold text-slate-900">273</span>
              <span className="text-[10px] text-slate-400">total tugas</span>
            </div>
          </div>

          {/* Legend under Donut matching Screenshot 1 */}
          <div className="grid grid-cols-2 gap-x-2 gap-y-1.5 text-xs pt-2 border-t border-slate-100">
            {SKILL_DISTRIBUTION_DATA.map(item => (
              <div key={item.name} className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                <span className="text-slate-700 truncate">
                  {item.name} <span className="text-slate-400 text-[11px]">{item.value} ({item.percent})</span>
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Bottom Row: Tren SLA Durasi Muat & Matriks Skill Tim */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Tren SLA Durasi Muat */}
        <div className="lg:col-span-6 bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs flex flex-col justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-900">Tren SLA Durasi Muat</h3>
            <p className="text-xs text-slate-400 mt-0.5">Persentase sesi muat dalam batas SLA</p>
          </div>

          <div className="h-56 mt-4">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={SLA_TREND_DATA} margin={{ top: 10, right: 15, left: -25, bottom: 0 }}>
                <XAxis
                  dataKey="date"
                  tickLine={false}
                  axisLine={{ stroke: '#e2e8f0' }}
                  tick={{ fontSize: 11, fill: '#64748b' }}
                />
                <YAxis
                  domain={[0, 100]}
                  ticks={[0, 25, 50, 75, 100]}
                  tickLine={false}
                  axisLine={{ stroke: '#e2e8f0' }}
                  tick={{ fontSize: 11, fill: '#64748b' }}
                />
                <Tooltip
                  formatter={(val: any) => [`${val}%`, 'SLA Compliance']}
                  contentStyle={{
                    backgroundColor: '#0f172a',
                    borderColor: '#1e293b',
                    borderRadius: '8px',
                    color: '#fff',
                    fontSize: '12px'
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="compliance"
                  stroke="#8b5cf6"
                  strokeWidth={2.5}
                  dot={{ r: 4, fill: '#8b5cf6', stroke: '#fff', strokeWidth: 2 }}
                  activeDot={{ r: 6 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Laporan Performa Pengiriman Mingguan */}
        <div className="lg:col-span-6 bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2">
              <Truck className="w-4 h-4 text-indigo-500" />
              <h3 className="text-sm font-bold text-slate-900">Performa Pengiriman Mingguan</h3>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">Durasi aktual vs Target SLA (jam)</p>
          </div>

          <div className="h-56 mt-4">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={WEEKLY_DELIVERY_DATA} margin={{ top: 10, right: 15, left: -25, bottom: 0 }}>
                <XAxis
                  dataKey="week"
                  tickLine={false}
                  axisLine={{ stroke: '#e2e8f0' }}
                  tick={{ fontSize: 11, fill: '#64748b' }}
                />
                <YAxis
                  tickLine={false}
                  axisLine={{ stroke: '#e2e8f0' }}
                  tick={{ fontSize: 11, fill: '#64748b' }}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#0f172a',
                    borderColor: '#1e293b',
                    borderRadius: '8px',
                    color: '#fff',
                    fontSize: '12px'
                  }}
                />
                <Bar dataKey="avgDuration" name="Durasi Aktual" fill="#6366f1" radius={[4, 4, 0, 0]} />
                <Bar dataKey="slaTarget" name="Target SLA" fill="#cbd5e1" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Matriks Skill Tim */}
        <div className="lg:col-span-6 bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs flex flex-col justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-900">Matriks Skill Tim</h3>
            <p className="text-xs text-slate-400 mt-0.5">Sebaran level per jenis keahlian</p>
          </div>

          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-100 text-slate-400 uppercase text-[10px] tracking-wider font-semibold">
                  <th className="pb-2.5">SKILL</th>
                  <th className="pb-2.5 text-center">AHLI</th>
                  <th className="pb-2.5 text-center">MENENGAH</th>
                  <th className="pb-2.5 text-center">PEMULA</th>
                  <th className="pb-2.5 text-center">BELUM DINILAI</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {SKILL_MATRIX_ROWS.map(row => (
                  <tr key={row.skill} className="hover:bg-slate-50/70 transition">
                    <td className="py-3">
                      <div className="font-semibold text-slate-800">{row.skill}</div>
                      <div className="text-[11px] text-slate-400">{row.target}</div>
                    </td>
                    <td className="py-3 text-center">
                      <span className={`inline-block w-6 py-0.5 text-center rounded-md font-bold text-xs ${
                        row.ahli > 0
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-emerald-50 text-emerald-300'
                      }`}>
                        {row.ahli}
                      </span>
                    </td>
                    <td className="py-3 text-center">
                      <span className={`inline-block w-6 py-0.5 text-center rounded-md font-bold text-xs ${
                        row.menengah > 0
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-amber-50 text-amber-300'
                      }`}>
                        {row.menengah}
                      </span>
                    </td>
                    <td className="py-3 text-center">
                      <span className={`inline-block w-6 py-0.5 text-center rounded-md font-bold text-xs ${
                        row.pemula > 0
                          ? 'bg-orange-100 text-orange-800'
                          : 'bg-slate-100 text-slate-400'
                      }`}>
                        {row.pemula}
                      </span>
                    </td>
                    <td className="py-3 text-center">
                      <span className="inline-block w-6 py-0.5 text-center rounded-md font-bold text-xs bg-slate-100 text-slate-400">
                        {row.belum}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};
