import React, { useState, useEffect, useMemo } from 'react';
import {
  LayoutDashboard,
  Truck,
  ShoppingBag,
  TrendingUp,
  Clock,
  CheckCircle2,
  AlertTriangle,
  ArrowUpRight,
  FileText,
  Users,
  BarChart3,
  Layers,
  Calendar,
  MapPin,
  RotateCw,
  Radio,
  ChevronDown,
  Activity,
  Package,
  ArrowRight,
  Briefcase,
  X,
  Search,
  Download,
  Wallet,
  DollarSign,
  FolderKanban,
  ShoppingCart
} from 'lucide-react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid
} from 'recharts';
import { logisticsStore } from '../services/store';
import {
  Schedule,
  Fleet,
  RetailStore,
  Crew,
  SalesOrder,
  AdminActivity
} from '../types';
import { NavTab } from './Sidebar';
import { DriverLoadBalancing } from './DriverLoadBalancing';

interface ExecutiveDashboardProps {
  onNavigate: (tab: NavTab) => void;
}

const REVENUE_EXPENSE_DATA_MONTH = [
  { date: '1 Okt', revenue: 520, expenses: 340, label: 'Rp 520.000.000' },
  { date: '5 Okt', revenue: 890, expenses: 580, label: 'Rp 890.000.000' },
  { date: '8 Okt', revenue: 910, expenses: 690, label: 'Rp 910.000.000' },
  { date: '12 Okt', revenue: 1320, expenses: 880, label: 'Rp 1.320.000.000' },
  { date: '15 Okt', revenue: 1180, expenses: 760, label: 'Rp 1.180.000.000' },
  { date: '19 Okt', revenue: 1210, expenses: 810, label: 'Rp 1.210.000.000' },
  { date: '22 Okt', revenue: 1420, expenses: 960, label: 'Rp 1.028.450.000' },
  { date: '26 Okt', revenue: 1340, expenses: 850, label: 'Rp 1.340.000.000' },
  { date: '31 Okt', revenue: 1390, expenses: 930, label: 'Rp 1.390.000.000' }
];

const REVENUE_EXPENSE_DATA_QUARTER = [
  { date: 'Agu M1', revenue: 980, expenses: 640, label: 'Rp 980.000.000' },
  { date: 'Agu M3', revenue: 1120, expenses: 720, label: 'Rp 1.120.000.000' },
  { date: 'Sep M1', revenue: 1050, expenses: 690, label: 'Rp 1.050.000.000' },
  { date: 'Sep M3', revenue: 1280, expenses: 810, label: 'Rp 1.280.000.000' },
  { date: 'Okt M1', revenue: 1190, expenses: 760, label: 'Rp 1.190.000.000' },
  { date: 'Okt M3', revenue: 1450, expenses: 910, label: 'Rp 1.450.000.000' }
];

const WORKFLOW_STATUS_DATA = [
  { name: 'Completed (Terkirim)', shortName: 'Completed', count: 20, pct: '35.7%', color: '#10b981' },
  { name: 'In Progress (Perjalanan)', shortName: 'In Progress', count: 18, pct: '32.1%', color: '#2563eb' },
  { name: 'Pending Review (Siap Muat)', shortName: 'Pending Review', count: 10, pct: '17.9%', color: '#f59e0b' },
  { name: 'On Hold (Tertunda)', shortName: 'On Hold', count: 8, pct: '14.3%', color: '#ef4444' }
];

const INVENTORY_OVERVIEW_DATA = [
  { name: 'In Stock (Tersedia)', shortName: 'In Stock', count: 1420, pct: '60.4%', color: '#10b981' },
  { name: 'Low Stock (Menipis)', shortName: 'Low Stock', count: 520, pct: '22.1%', color: '#f59e0b' },
  { name: 'Out of Stock (Habis)', shortName: 'Out of Stock', count: 230, pct: '9.8%', color: '#ef4444' },
  { name: 'On Order (Dipesan)', shortName: 'On Order', count: 180, pct: '7.7%', color: '#3b82f6' }
];

const PROJECTS_FLEET_OVERVIEW_DATA = [
  { name: 'On Track (Tepat Waktu)', shortName: 'On Track', count: 10, pct: '41.7%', color: '#10b981' },
  { name: 'At Risk (Rute Padat)', shortName: 'At Risk', count: 7, pct: '29.2%', color: '#f59e0b' },
  { name: 'Delayed (Terlambat)', shortName: 'Delayed', count: 4, pct: '16.7%', color: '#ef4444' },
  { name: 'Completed (Selesai)', shortName: 'Completed', count: 3, pct: '12.4%', color: '#3b82f6' }
];

export const ExecutiveDashboard: React.FC<ExecutiveDashboardProps> = ({ onNavigate }) => {
  const [schedules, setSchedules] = useState<Schedule[]>(logisticsStore.getSchedules());
  const [fleets, setFleets] = useState<Fleet[]>(logisticsStore.getFleets());
  const [stores, setStores] = useState<RetailStore[]>(logisticsStore.getStores());
  const [crews, setCrews] = useState<Crew[]>(logisticsStore.getCrews());
  const [salesOrders, setSalesOrders] = useState<SalesOrder[]>(logisticsStore.getSalesOrders());
  const [adminActivities, setAdminActivities] = useState<AdminActivity[]>(logisticsStore.getAdminActivities());

  const [chartPeriod, setChartPeriod] = useState<'month' | 'quarter'>('month');
  const [workflowFilter, setWorkflowFilter] = useState<'all' | 'logistics' | 'sales'>('all');
  const [warehouseFilter, setWarehouseFilter] = useState<'all' | 'utama' | 'nusantara'>('all');
  const [fleetFilter, setFleetFilter] = useState<'all' | 'bali' | 'jatim'>('all');
  const [taskFilter, setTaskFilter] = useState<'all' | 'ops' | 'sales'>('all');
  const [showOpsTools, setShowOpsTools] = useState<boolean>(false);

  const [searchQuery, setSearchQuery] = useState('');
  const [inspectedItem, setInspectedItem] = useState<{
    type: 'pengiriman' | 'kru' | 'pelanggan' | 'pesanan';
    item: any;
  } | null>(null);

  useEffect(() => {
    return logisticsStore.subscribe(() => {
      setSchedules(logisticsStore.getSchedules());
      setFleets(logisticsStore.getFleets());
      setStores(logisticsStore.getStores());
      setCrews(logisticsStore.getCrews());
      setSalesOrders(logisticsStore.getSalesOrders());
      setAdminActivities(logisticsStore.getAdminActivities());
    });
  }, []);

  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const q = searchQuery.toLowerCase().trim();

    const matchedSchedules = schedules
      .filter(s => s.trackingNumber.toLowerCase().includes(q) || s.cargoDescription.toLowerCase().includes(q) || s.id.toLowerCase().includes(q))
      .map(s => ({ id: s.id, category: 'Pengiriman', title: s.trackingNumber, subtitle: s.cargoDescription, raw: s, type: 'pengiriman' as const }));

    const matchedCrews = crews
      .filter(c => c.name.toLowerCase().includes(q) || c.role.toLowerCase().includes(q) || c.id.toLowerCase().includes(q))
      .map(c => ({ id: c.id, category: 'Kru', title: c.name, subtitle: `${c.role} • SIM ${c.licenseType}`, raw: c, type: 'kru' as const }));

    const matchedStores = stores
      .filter(st => st.storeName.toLowerCase().includes(q) || st.storeCode.toLowerCase().includes(q) || st.city.toLowerCase().includes(q))
      .map(st => ({ id: st.id, category: 'Pelanggan', title: st.storeName, subtitle: `${st.storeCode} • ${st.city}, ${st.province}`, raw: st, type: 'pelanggan' as const }));

    const matchedOrders = salesOrders
      .filter(o => o.poNumber.toLowerCase().includes(q) || o.clientName.toLowerCase().includes(q) || o.productType.toLowerCase().includes(q))
      .map(o => ({ id: o.id, category: 'Pesanan', title: o.poNumber, subtitle: `${o.clientName} • ${o.productType}`, raw: o, type: 'pesanan' as const }));

    return [...matchedSchedules, ...matchedCrews, ...matchedStores, ...matchedOrders].slice(0, 10);
  }, [searchQuery, schedules, crews, stores, salesOrders]);

  const activeFleetsCount = useMemo(() => fleets.filter(f => f.status === 'on-duty').length, [fleets]);

  const orderLogisticsPipeline = useMemo(() => {
    const base = salesOrders.slice(0, 6).map((order, idx) => {
      const assignedFleet = fleets[idx % Math.max(1, fleets.length)];
      const assignedCrew = crews[idx % Math.max(1, crews.length)];
      const matchSchedule = schedules[idx % Math.max(1, schedules.length)];

      return {
        id: order.id,
        poNumber: order.poNumber,
        clientName: order.clientName,
        productType: order.productType,
        quantityPcs: order.quantityPcs,
        orderStatus: order.orderStatus,
        adminPic: order.adminPic,
        deliveryDestination: order.deliveryDestination,
        assignedFleetPlate: assignedFleet ? assignedFleet.plateNumber : 'P 8381 VE',
        driverName: assignedCrew ? assignedCrew.name : 'Budiono',
        logisticsStatus: matchSchedule ? matchSchedule.status : (idx === 0 ? 'in_transit' : 'scheduled'),
        rawOrder: order
      };
    });
    if (taskFilter === 'ops') return base.filter(x => x.logisticsStatus === 'in_transit' || x.logisticsStatus === 'scheduled');
    if (taskFilter === 'sales') return base.filter(x => x.orderStatus !== 'Terkirim');
    return base;
  }, [salesOrders, fleets, crews, schedules, taskFilter]);

  const exportDashboardSnapshotCsv = () => {
    const csvRows = [
      ['"KATEGORI METRIK"', '"NILAI / STATUS"', '"KETERANGAN"'],
      ['"Nama Hub"', '"Banyuwangi Central Hub"', '"PT Anugrah Kemasan Kreatif"'],
      ['"Tanggal Ekspor"', `"${new Date().toLocaleString('id-ID')}"`, '"Snapshot Kinerja Eksekutif"'],
      ['"Total Revenue"', '"Rp 1.246.800.000"', '"+12.6% vs bulan lalu"'],
      ['"Total Expenses"', '"Rp 834.250.000"', '"+8.4% vs bulan lalu"'],
      ['"Net Profit"', '"Rp 412.550.000"', '"+15.3% vs bulan lalu"'],
      ['"Jadwal & Proyek Aktif"', `"${schedules.length || 24}"`, '"Pengiriman aktif dan terjadwal"'],
      ['"Karyawan & Kru Aktif"', '"128"', '"Staf operasional, gudang, dan kru armada"']
    ];

    const csvContent = 'data:text/csv;charset=utf-8,' + csvRows.map(e => e.join(',')).join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `snapshot_kinerja_eksekutif_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const activeLineData = chartPeriod === 'month' ? REVENUE_EXPENSE_DATA_MONTH : REVENUE_EXPENSE_DATA_QUARTER;

  return (
    <div className="space-y-5">
      {/* ============================================================ */}
      {/* COMPACT UTILITY & SEARCH BAR                                 */}
      {/* ============================================================ */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        {/* Global Quick Search */}
        <div className="relative flex-1 max-w-md">
          <input
            type="text"
            placeholder="Cari pengiriman (No. Tracking), kru, pelanggan, atau PO..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 text-xs rounded-xl pl-9 pr-8 py-2.5 border border-slate-200/80 dark:border-slate-800 focus:border-blue-500 focus:outline-hidden transition placeholder:text-slate-400 shadow-2xs"
          />
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 dark:hover:text-white cursor-pointer p-0.5"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}

          {/* Search Autocomplete Dropdown */}
          {searchQuery && (
            <div className="absolute z-50 left-0 right-0 mt-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl overflow-hidden max-h-80 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
              {searchResults.length > 0 ? (
                searchResults.map((res) => (
                  <div
                    key={`${res.type}-${res.id}`}
                    onClick={() => {
                      setInspectedItem({ type: res.type, item: res.raw });
                      setSearchQuery('');
                    }}
                    className="flex items-center gap-3 px-4 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-800/70 cursor-pointer transition"
                  >
                    <div className="p-2 rounded-xl bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400">
                      <FileText className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-bold text-slate-900 dark:text-white truncate">{res.title}</span>
                        <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400">
                          {res.category}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">{res.subtitle}</p>
                    </div>
                  </div>
                ))
              ) : (
                <div className="p-4 text-center text-xs text-slate-500">
                  Tidak ditemukan hasil untuk &quot;{searchQuery}&quot;
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right Utility Actions */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => setShowOpsTools(!showOpsTools)}
            className={`px-3.5 py-2 rounded-xl text-xs font-semibold border transition cursor-pointer flex items-center gap-2 shadow-2xs ${
              showOpsTools
                ? 'bg-blue-50 text-blue-600 border-blue-200 dark:bg-blue-500/15 dark:text-blue-400 dark:border-blue-500/30'
                : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 border-slate-200/80 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800'
            }`}
          >
            <Layers className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
            <span>{showOpsTools ? 'Sembunyikan Panel Darurat & Beban Kru' : 'Panel Darurat & Beban Kru'}</span>
          </button>

          <button
            type="button"
            onClick={exportDashboardSnapshotCsv}
            className="px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold transition cursor-pointer flex items-center gap-2 shadow-2xs"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Ekspor CSV</span>
          </button>
        </div>
      </div>

      {/* ============================================================ */}
      {/* ROW 1: 5 CLEAN KPI STAT CARDS (MATCHING REFERENCE IMAGE)     */}
      {/* ============================================================ */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4">
        {/* KPI 1: Total Revenue / Omset */}
        <div
          onClick={() => onNavigate('sales_kpi_omset')}
          className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-100 dark:border-slate-800 shadow-2xs hover:shadow-md transition cursor-pointer"
        >
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-full bg-emerald-50 dark:bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
              <DollarSign className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="text-xs font-medium text-slate-500 dark:text-slate-400 truncate">
                Total Revenue
              </div>
              <div className="text-xl font-extrabold text-slate-900 dark:text-white tracking-tight tabular-nums mt-0.5">
                Rp 1.246,8 Jt
              </div>
            </div>
          </div>
          <div className="mt-3.5 flex items-center gap-1.5 text-xs">
            <span className="text-emerald-600 dark:text-emerald-400 font-bold tabular-nums">
              &uarr; 12.6%
            </span>
            <span className="text-slate-400 dark:text-slate-500">vs bulan lalu</span>
          </div>
        </div>

        {/* KPI 2: Total Expenses / Biaya Operasional */}
        <div
          onClick={() => onNavigate('fuel_efficiency')}
          className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-100 dark:border-slate-800 shadow-2xs hover:shadow-md transition cursor-pointer"
        >
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-full bg-amber-50 dark:bg-amber-500/15 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
              <Wallet className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="text-xs font-medium text-slate-500 dark:text-slate-400 truncate">
                Total Expenses
              </div>
              <div className="text-xl font-extrabold text-slate-900 dark:text-white tracking-tight tabular-nums mt-0.5">
                Rp 834,25 Jt
              </div>
            </div>
          </div>
          <div className="mt-3.5 flex items-center gap-1.5 text-xs">
            <span className="text-emerald-600 dark:text-emerald-400 font-bold tabular-nums">
              &uarr; 8.4%
            </span>
            <span className="text-slate-400 dark:text-slate-500">vs bulan lalu</span>
          </div>
        </div>

        {/* KPI 3: Net Profit / Margin Operasional */}
        <div
          onClick={() => onNavigate('finance_dashboard')}
          className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-100 dark:border-slate-800 shadow-2xs hover:shadow-md transition cursor-pointer"
        >
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-full bg-blue-50 dark:bg-blue-500/15 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
              <FileText className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="text-xs font-medium text-slate-500 dark:text-slate-400 truncate">
                Net Profit
              </div>
              <div className="text-xl font-extrabold text-slate-900 dark:text-white tracking-tight tabular-nums mt-0.5">
                Rp 412,55 Jt
              </div>
            </div>
          </div>
          <div className="mt-3.5 flex items-center gap-1.5 text-xs">
            <span className="text-emerald-600 dark:text-emerald-400 font-bold tabular-nums">
              &uarr; 15.3%
            </span>
            <span className="text-slate-400 dark:text-slate-500">vs bulan lalu</span>
          </div>
        </div>

        {/* KPI 4: Open Projects / Jadwal Kirim Aktif */}
        <div
          onClick={() => onNavigate('schedules')}
          className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-100 dark:border-slate-800 shadow-2xs hover:shadow-md transition cursor-pointer"
        >
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-full bg-purple-50 dark:bg-purple-500/15 text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0">
              <FolderKanban className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="text-xs font-medium text-slate-500 dark:text-slate-400 truncate">
                Jadwal Kirim Aktif
              </div>
              <div className="text-xl font-extrabold text-slate-900 dark:text-white tracking-tight tabular-nums mt-0.5">
                {schedules.length || 24}
              </div>
            </div>
          </div>
          <div className="mt-3.5 flex items-center gap-1.5 text-xs">
            <span className="text-emerald-600 dark:text-emerald-400 font-bold tabular-nums">
              &uarr; 9%
            </span>
            <span className="text-slate-400 dark:text-slate-500">vs bulan lalu</span>
          </div>
        </div>

        {/* KPI 5: Active Employees / Staf & Kru Aktif */}
        <div
          onClick={() => onNavigate('hr_dashboard')}
          className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-100 dark:border-slate-800 shadow-2xs hover:shadow-md transition cursor-pointer"
        >
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-full bg-sky-50 dark:bg-sky-500/15 text-sky-600 dark:text-sky-400 flex items-center justify-center shrink-0">
              <Users className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="text-xs font-medium text-slate-500 dark:text-slate-400 truncate">
                Karyawan &amp; Kru Aktif
              </div>
              <div className="text-xl font-extrabold text-slate-900 dark:text-white tracking-tight tabular-nums mt-0.5">
                128
              </div>
            </div>
          </div>
          <div className="mt-3.5 flex items-center gap-1.5 text-xs">
            <span className="text-emerald-600 dark:text-emerald-400 font-bold tabular-nums">
              &uarr; 6%
            </span>
            <span className="text-slate-400 dark:text-slate-500">vs bulan lalu</span>
          </div>
        </div>
      </div>

      {/* ============================================================ */}
      {/* ROW 2: REVENUE VS EXPENSES (7 COLS) & WORKFLOW STATUS (5)    */}
      {/* ============================================================ */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left Card: Revenue vs Expenses Dual Line Chart */}
        <div className="lg:col-span-7 bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-100 dark:border-slate-800 shadow-2xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                Revenue vs Expenses
              </h2>
              <select
                value={chartPeriod}
                onChange={(e) => setChartPeriod(e.target.value as 'month' | 'quarter')}
                className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-medium text-slate-600 dark:text-slate-300 cursor-pointer"
              >
                <option value="month">Bulan Ini</option>
                <option value="quarter">Kuartal Ini</option>
              </select>
            </div>

            {/* Legend Dots */}
            <div className="flex items-center gap-5 mt-2.5 text-xs font-medium text-slate-600 dark:text-slate-300">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-blue-600 inline-block" />
                <span>Revenue (Omset)</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-orange-500 inline-block" />
                <span>Expenses (Operasional)</span>
              </div>
            </div>
          </div>

          <div className="h-64 w-full mt-4">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={activeLineData} margin={{ top: 10, right: 12, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" opacity={0.6} />
                <XAxis
                  dataKey="date"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 11, fill: '#64748b' }}
                  dy={8}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 11, fill: '#64748b' }}
                  tickFormatter={(v) => (v >= 1000 ? `${(v / 1000).toFixed(1)}M` : `${v}Jt`)}
                />
                <Tooltip
                  content={({ active, payload, label }) => {
                    if (active && payload && payload.length) {
                      return (
                        <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-700 rounded-xl px-3.5 py-2.5 shadow-lg text-xs">
                          <div className="text-slate-400 font-medium mb-1">{label}</div>
                          <div className="text-sm font-extrabold text-slate-900 dark:text-white tabular-nums">
                            Rp {(Number(payload[0].value) * 1000000).toLocaleString('id-ID')}
                          </div>
                          {payload[1] && (
                            <div className="text-[11px] font-semibold text-orange-500 tabular-nums mt-0.5">
                              Biaya: Rp {(Number(payload[1].value) * 1000000).toLocaleString('id-ID')}
                            </div>
                          )}
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="revenue"
                  stroke="#2563eb"
                  strokeWidth={2.5}
                  dot={{ r: 4, fill: '#2563eb', strokeWidth: 2, stroke: '#ffffff' }}
                  activeDot={{ r: 6, fill: '#2563eb', stroke: '#ffffff', strokeWidth: 2 }}
                />
                <Line
                  type="monotone"
                  dataKey="expenses"
                  stroke="#f97316"
                  strokeWidth={2.5}
                  dot={{ r: 4, fill: '#f97316', strokeWidth: 2, stroke: '#ffffff' }}
                  activeDot={{ r: 6, fill: '#f97316', stroke: '#ffffff', strokeWidth: 2 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Right Card: Workflow Status Donut Chart */}
        <div className="lg:col-span-5 bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-100 dark:border-slate-800 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-base font-bold text-slate-900 dark:text-white">
              Workflow Status
            </h2>
            <select
              value={workflowFilter}
              onChange={(e) => setWorkflowFilter(e.target.value as any)}
              className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-medium text-slate-600 dark:text-slate-300 cursor-pointer"
            >
              <option value="all">Semua Alur</option>
              <option value="logistics">Logistik Kirim</option>
              <option value="sales">Sales Order</option>
            </select>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 my-auto py-4">
            {/* Donut Chart with Center Label */}
            <div className="relative w-44 h-44 shrink-0">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={WORKFLOW_STATUS_DATA}
                    dataKey="count"
                    nameKey="shortName"
                    cx="50%"
                    cy="50%"
                    innerRadius={52}
                    outerRadius={76}
                    paddingAngle={1.5}
                    stroke="none"
                  >
                    {WORKFLOW_STATUS_DATA.map((entry, index) => (
                      <Cell key={`wf-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-xs text-slate-400 font-medium">Total</span>
                <span className="text-2xl font-extrabold text-slate-900 dark:text-white tabular-nums">
                  56
                </span>
              </div>
            </div>

            {/* Right Legend Breakdown */}
            <div className="flex-1 w-full space-y-3">
              {WORKFLOW_STATUS_DATA.map((item) => (
                <div key={item.shortName} className="flex items-center justify-between text-xs gap-2">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: item.color }}
                    />
                    <span className="text-slate-700 dark:text-slate-300 font-medium truncate">
                      {item.shortName}
                    </span>
                  </div>
                  <div className="text-slate-500 dark:text-slate-400 font-semibold tabular-nums shrink-0">
                    <span className="text-slate-800 dark:text-slate-200 font-bold">{item.count}</span>{' '}
                    <span>({item.pct})</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ============================================================ */}
      {/* ROW 3: INVENTORY (5), PENDING PROCUREMENT (3), PROJECTS (4)  */}
      {/* ============================================================ */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Card 1: Inventory Overview (5 Cols) */}
        <div className="lg:col-span-5 bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-100 dark:border-slate-800 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-base font-bold text-slate-900 dark:text-white">
              Inventory Overview
            </h2>
            <select
              value={warehouseFilter}
              onChange={(e) => setWarehouseFilter(e.target.value as any)}
              className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-medium text-slate-600 dark:text-slate-300 cursor-pointer"
            >
              <option value="all">Semua Gudang</option>
              <option value="utama">Gudang Utama</option>
              <option value="nusantara">Cabang Nusantara</option>
            </select>
          </div>

          <div
            onClick={() => onNavigate('warehouse_inventory')}
            className="flex flex-col sm:flex-row items-center justify-between gap-4 my-auto py-3 cursor-pointer"
          >
            <div className="relative w-40 h-40 shrink-0">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={INVENTORY_OVERVIEW_DATA}
                    dataKey="count"
                    nameKey="shortName"
                    cx="50%"
                    cy="50%"
                    innerRadius={48}
                    outerRadius={70}
                    paddingAngle={1.5}
                    stroke="none"
                  >
                    {INVENTORY_OVERVIEW_DATA.map((entry, index) => (
                      <Cell key={`inv-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-[11px] text-slate-400 font-medium">Total Items</span>
                <span className="text-lg font-extrabold text-slate-900 dark:text-white tabular-nums">
                  2,350
                </span>
              </div>
            </div>

            <div className="flex-1 w-full space-y-2.5">
              {INVENTORY_OVERVIEW_DATA.map((item) => (
                <div key={item.shortName} className="flex items-center justify-between text-xs gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: item.color }}
                    />
                    <span className="text-slate-700 dark:text-slate-300 font-medium truncate">
                      {item.shortName}
                    </span>
                  </div>
                  <div className="text-slate-500 dark:text-slate-400 font-semibold tabular-nums shrink-0">
                    <span className="text-slate-800 dark:text-slate-200 font-bold">
                      {item.count.toLocaleString('en-US')}
                    </span>{' '}
                    <span>({item.pct})</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Card 2: Pending Procurement (3 Cols) */}
        <div className="lg:col-span-3 bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-100 dark:border-slate-800 shadow-2xs flex flex-col justify-between">
          <h2 className="text-base font-bold text-slate-900 dark:text-white">
            Pending Procurement
          </h2>

          <div className="my-auto py-3 space-y-4">
            <div className="flex items-center gap-3.5">
              <div className="w-13 h-13 rounded-full bg-blue-500 text-white flex items-center justify-center shrink-0 shadow-xs">
                <ShoppingCart className="w-6 h-6" />
              </div>
              <div>
                <div className="text-2xl font-extrabold text-slate-900 dark:text-white tabular-nums leading-none">
                  18
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-1">
                  Purchase Orders
                </div>
              </div>
            </div>

            <div>
              <div className="text-xs text-slate-400 dark:text-slate-500 font-medium">
                Total Value
              </div>
              <div className="text-lg font-extrabold text-slate-900 dark:text-white tabular-nums mt-0.5">
                Rp 245.760.000
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => onNavigate('purchasing_dashboard')}
            className="w-full py-2 px-4 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-blue-400 hover:bg-blue-50/50 dark:hover:bg-slate-800 text-blue-600 dark:text-blue-400 text-xs font-semibold transition cursor-pointer"
          >
            View All POs
          </button>
        </div>

        {/* Card 3: Projects / Fleet Overview (4 Cols) */}
        <div className="lg:col-span-4 bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-100 dark:border-slate-800 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-base font-bold text-slate-900 dark:text-white">
              Projects &amp; Fleet Overview
            </h2>
            <select
              value={fleetFilter}
              onChange={(e) => setFleetFilter(e.target.value as any)}
              className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-medium text-slate-600 dark:text-slate-300 cursor-pointer"
            >
              <option value="all">Semua Rute</option>
              <option value="bali">Rute Bali</option>
              <option value="jatim">Rute Jatim</option>
            </select>
          </div>

          <div
            onClick={() => onNavigate('schedules')}
            className="flex flex-col sm:flex-row items-center justify-between gap-3 my-auto py-3 cursor-pointer"
          >
            <div className="relative w-36 h-36 shrink-0">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={PROJECTS_FLEET_OVERVIEW_DATA}
                    dataKey="count"
                    nameKey="shortName"
                    cx="50%"
                    cy="50%"
                    innerRadius={44}
                    outerRadius={64}
                    paddingAngle={1.5}
                    stroke="none"
                  >
                    {PROJECTS_FLEET_OVERVIEW_DATA.map((entry, index) => (
                      <Cell key={`prj-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-[11px] text-slate-400 font-medium">Total</span>
                <span className="text-lg font-extrabold text-slate-900 dark:text-white tabular-nums">
                  24
                </span>
              </div>
            </div>

            <div className="flex-1 w-full space-y-2.5">
              {PROJECTS_FLEET_OVERVIEW_DATA.map((item) => (
                <div key={item.shortName} className="flex items-center justify-between text-xs gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: item.color }}
                    />
                    <span className="text-slate-700 dark:text-slate-300 font-medium truncate">
                      {item.shortName}
                    </span>
                  </div>
                  <div className="text-slate-500 dark:text-slate-400 font-semibold tabular-nums shrink-0">
                    <span className="text-slate-800 dark:text-slate-200 font-bold">{item.count}</span>{' '}
                    <span>({item.pct})</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ============================================================ */}
      {/* ROW 4: TEAM TASKS (7 COLS) & RECENT ACTIVITIES (5 COLS)      */}
      {/* ============================================================ */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left Card: Team Tasks & Active Pipeline (7 Cols) */}
        <div className="lg:col-span-7 bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-100 dark:border-slate-800 shadow-2xs space-y-4">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-base font-bold text-slate-900 dark:text-white">
              Team Tasks &amp; Jadwal Pengiriman
            </h2>
            <select
              value={taskFilter}
              onChange={(e) => setTaskFilter(e.target.value as any)}
              className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-medium text-slate-600 dark:text-slate-300 cursor-pointer"
            >
              <option value="all">My Tasks (Semua)</option>
              <option value="ops">Tugas Logistik</option>
              <option value="sales">Tugas Sales Admin</option>
            </select>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-100 dark:border-slate-800 text-[11px] font-semibold text-slate-400 dark:text-slate-500">
                  <th className="pb-2.5 pr-3">PO / Tugas</th>
                  <th className="pb-2.5 px-3">Pelanggan &amp; Tujuan</th>
                  <th className="pb-2.5 px-3">PIC / Armada</th>
                  <th className="pb-2.5 pl-3 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/70 text-xs">
                {orderLogisticsPipeline.map((row) => (
                  <tr
                    key={row.id}
                    onClick={() => setInspectedItem({ type: 'pesanan', item: row.rawOrder })}
                    className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition cursor-pointer"
                  >
                    <td className="py-3 pr-3">
                      <div className="font-bold text-slate-900 dark:text-white">{row.poNumber}</div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate max-w-[160px]">
                        {row.productType}
                      </div>
                    </td>
                    <td className="py-3 px-3">
                      <div className="font-semibold text-slate-800 dark:text-slate-200">{row.clientName}</div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400">{row.deliveryDestination}</div>
                    </td>
                    <td className="py-3 px-3">
                      <div className="font-medium text-slate-700 dark:text-slate-300">{row.driverName}</div>
                      <div className="text-[11px] text-slate-400 font-mono">{row.assignedFleetPlate}</div>
                    </td>
                    <td className="py-3 pl-3 text-right">
                      <span
                        className={`inline-flex items-center px-2.5 py-1 rounded-lg text-[11px] font-semibold ${
                          row.orderStatus === 'Terkirim'
                            ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300'
                            : row.orderStatus === 'Siap Muat'
                            ? 'bg-blue-50 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300'
                            : 'bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300'
                        }`}
                      >
                        {row.orderStatus}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right Card: Recent Activities (5 Cols) */}
        <div className="lg:col-span-5 bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-100 dark:border-slate-800 shadow-2xs space-y-4">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-base font-bold text-slate-900 dark:text-white">
              Recent Activities
            </h2>
            <button
              type="button"
              onClick={() => onNavigate('activity_log')}
              className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
            >
              View All
            </button>
          </div>

          <div className="space-y-3.5">
            {adminActivities.slice(0, 5).map((act, idx) => (
              <div
                key={act.id || idx}
                onClick={() => onNavigate('sales_activities')}
                className="flex items-start gap-3 p-2.5 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/50 transition cursor-pointer"
              >
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-xs font-bold ${
                    idx % 3 === 0
                      ? 'bg-blue-50 text-blue-600 dark:bg-blue-500/15 dark:text-blue-400'
                      : idx % 3 === 1
                      ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400'
                      : 'bg-amber-50 text-amber-600 dark:bg-amber-500/15 dark:text-amber-400'
                  }`}
                >
                  {act.adminName ? act.adminName.charAt(0).toUpperCase() : 'A'}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold text-slate-900 dark:text-white truncate">
                      {act.adminName}
                    </span>
                    <span className="text-[11px] text-slate-400 tabular-nums shrink-0">
                      {act.timestamp}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">
                    {act.actionType} &middot; {act.clientName}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ============================================================ */}
      {/* EXPANDABLE OPERATIONAL TOOLS (DRIVER LOAD BALANCING & QUICK) */}
      {/* ============================================================ */}
      {showOpsTools && (
        <div className="space-y-5 pt-2">
          <DriverLoadBalancing />

          <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl p-5 shadow-2xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div>
                <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                  Pusat Tindakan Cepat (Quick Action Admin)
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Tindakan operasional &amp; pengiriman darurat langsung ke sistem
                </p>
              </div>
              <span className="text-xs text-slate-500 dark:text-slate-400 font-mono">
                Armada Aktif: {activeFleetsCount} Unit
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Action 1: Emergency Dispatch */}
              <div className="bg-slate-50/70 dark:bg-slate-950/60 p-4 rounded-xl border border-slate-200/70 dark:border-slate-800 space-y-3 flex flex-col justify-between">
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-rose-50 dark:bg-rose-500/15 text-rose-600 dark:text-rose-400 flex items-center justify-center">
                      <AlertTriangle className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-slate-900 dark:text-white">
                        Pengiriman Darurat (Emergency Dispatch)
                      </h4>
                      <p className="text-[11px] text-slate-500">Prioritas lintas cabang &amp; pelabuhan</p>
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => {
                    const trackingNumber = `TRK-EMG-${Math.floor(1000 + Math.random() * 9000)}`;
                    const randomStore = stores[Math.floor(Math.random() * stores.length)] || { id: 'ST-001', storeName: 'Hub Denpasar Bali' };
                    const availableFleet = fleets.find(f => f.status === 'available') || fleets[0];
                    const availableCrew = crews.find(c => c.status === 'available') || crews[0];

                    logisticsStore.addSchedule({
                      trackingNumber,
                      originName: 'Banyuwangi Central Hub',
                      originCoords: [-8.21, 114.36] as [number, number],
                      storeId: randomStore.id,
                      fleetId: availableFleet ? availableFleet.id : 'FL-001',
                      crewId: availableCrew ? availableCrew.id : 'CR-001',
                      status: 'in_transit' as const,
                      departureDate: new Date().toISOString(),
                      estimatedArrival: new Date(Date.now() + 8 * 3600 * 1000).toISOString(),
                      cargoDescription: 'BAHAN BAKU KARTON KORUGASI (URGENT REPLACEMENT)',
                      cargoWeightTon: 4.5,
                      isInterIsland: true,
                      ferryBookingCode: 'FERRY-EMG-BALI92',
                      notes: 'DISPATCH DARURAT - PRIORITAS UTAMA',
                      areaApprovalStatus: 'approved' as const
                    });

                    logisticsStore.emitNotification(
                      'schedule',
                      'EMERGENCY DISPATCH AKTIF',
                      `Armada ${trackingNumber} diberangkatkan segera ke ${randomStore.storeName}.`,
                      true
                    );
                  }}
                  className="w-full py-2 px-3 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold transition cursor-pointer"
                >
                  Kirim Armada Darurat
                </button>
              </div>

              {/* Action 2: Quick Fuel Log */}
              <div className="bg-slate-50/70 dark:bg-slate-950/60 p-4 rounded-xl border border-slate-200/70 dark:border-slate-800 space-y-3 flex flex-col justify-between">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-500/15 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                      <Truck className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-slate-900 dark:text-white">
                        Isi BBM Cepat (Quick Fuel Log)
                      </h4>
                      <p className="text-[11px] text-slate-500">Catat pengisian solar armada</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <select
                      id="quick-fuel-fleet"
                      className="text-xs p-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200"
                    >
                      {fleets.slice(0, 5).map(f => (
                        <option key={f.id} value={f.id}>{f.plateNumber}</option>
                      ))}
                    </select>
                    <input
                      id="quick-fuel-liters"
                      type="number"
                      placeholder="Liter"
                      className="text-xs p-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200"
                    />
                  </div>
                </div>

                <button
                  onClick={() => {
                    const fleetSelect = document.getElementById('quick-fuel-fleet') as HTMLSelectElement;
                    const litersInput = document.getElementById('quick-fuel-liters') as HTMLInputElement;
                    if (!litersInput || !litersInput.value) return;
                    const fleetId = fleetSelect?.value || 'FL-001';
                    const liters = parseFloat(litersInput.value) || 50;
                    const targetFleet = fleets.find(f => f.id === fleetId);

                    logisticsStore.logActivity(
                      'Isi BBM',
                      targetFleet ? targetFleet.plateNumber : 'P 8381 VE',
                      `Pengisian solar cepat sebanyak ${liters} Liter.`
                    );
                    litersInput.value = '';
                    logisticsStore.emitNotification(
                      'delivery',
                      'Pengisian BBM Tercatat',
                      `BBM armada ${targetFleet ? targetFleet.plateNumber : 'P 8381 VE'} diisi ${liters} Liter.`,
                      false
                    );
                  }}
                  className="w-full py-2 px-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold transition cursor-pointer"
                >
                  Catat Solar &amp; Update
                </button>
              </div>

              {/* Action 3: Broadcaster Memo */}
              <div className="bg-slate-50/70 dark:bg-slate-950/60 p-4 rounded-xl border border-slate-200/70 dark:border-slate-800 space-y-3 flex flex-col justify-between">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-emerald-50 dark:bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                      <FileText className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-slate-900 dark:text-white">
                        Siaran Instruksi Admin
                      </h4>
                      <p className="text-[11px] text-slate-500">Kirim memo ke pusat notifikasi</p>
                    </div>
                  </div>

                  <input
                    id="quick-announcement-text"
                    type="text"
                    placeholder="Ketik memo operasional..."
                    className="w-full text-xs p-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200"
                  />
                </div>

                <button
                  onClick={() => {
                    const textInput = document.getElementById('quick-announcement-text') as HTMLInputElement;
                    if (!textInput || !textInput.value) return;
                    const memo = textInput.value;
                    textInput.value = '';
                    logisticsStore.emitNotification('schedule', 'Instruksi Admin Baru', `Memo: "${memo}"`, true);
                  }}
                  className="w-full py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold transition cursor-pointer"
                >
                  Siarkan Instruksi
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* SEARCH INSPECTOR DIALOG MODAL                                */}
      {/* ============================================================ */}
      {inspectedItem && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-md w-full overflow-hidden shadow-2xl">
            <div className="flex items-center justify-between p-4 border-b border-slate-100 dark:border-slate-800">
              <span className="text-xs font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400">
                Detail {inspectedItem.type}
              </span>
              <button
                onClick={() => setInspectedItem(null)}
                className="text-slate-400 hover:text-slate-700 dark:hover:text-white p-1 rounded-lg transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-3 text-xs">
              {inspectedItem.type === 'pesanan' && (() => {
                const o = inspectedItem.item as SalesOrder;
                return (
                  <div className="space-y-2.5">
                    <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-800 pb-2.5">
                      <div>
                        <div className="text-[11px] text-slate-400">Nomor PO</div>
                        <div className="text-sm font-bold text-slate-900 dark:text-white">{o.poNumber}</div>
                      </div>
                      <span className="px-2.5 py-1 rounded-lg bg-blue-50 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300 font-semibold">
                        {o.orderStatus}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Pelanggan:</span>
                      <span className="font-semibold text-slate-900 dark:text-white">{o.clientName}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Produk:</span>
                      <span className="font-semibold text-slate-900 dark:text-white">{o.productType}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Kuantitas:</span>
                      <span className="font-bold text-slate-900 dark:text-white tabular-nums">
                        {o.quantityPcs.toLocaleString('id-ID')} Pcs
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Tujuan:</span>
                      <span className="font-semibold text-slate-900 dark:text-white">{o.deliveryDestination}</span>
                    </div>
                  </div>
                );
              })()}

              {inspectedItem.type !== 'pesanan' && (
                <div className="space-y-2">
                  <div className="text-sm font-bold text-slate-900 dark:text-white">
                    {inspectedItem.item?.trackingNumber || inspectedItem.item?.name || inspectedItem.item?.storeName}
                  </div>
                  <div className="text-slate-500 dark:text-slate-400">
                    {inspectedItem.item?.cargoDescription || inspectedItem.item?.role || inspectedItem.item?.address}
                  </div>
                </div>
              )}
            </div>

            <div className="p-4 bg-slate-50 dark:bg-slate-950/50 border-t border-slate-100 dark:border-slate-800 flex justify-end">
              <button
                onClick={() => setInspectedItem(null)}
                className="px-4 py-2 rounded-xl bg-slate-900 dark:bg-slate-800 text-white text-xs font-semibold cursor-pointer"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
