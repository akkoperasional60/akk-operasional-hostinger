import React, { useState, useEffect, useMemo } from 'react';
import { Sparkles, LayoutDashboard, Truck, ShoppingBag, TrendingUp, Clock, CheckCircle2, AlertTriangle, ArrowUpRight, FileText, Users, BarChart3, Layers, Calendar, MapPin, RotateCw, Ship, Radio, ChevronDown, ChevronRight, Filter, Check, Activity, Package, Timer, Award, ArrowRight, ExternalLink, Briefcase, Maximize2, X, Search, Download } from 'lucide-react';
import { ResponsiveContainer, AreaChart, Area, BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, Tooltip, Legend, CartesianGrid } from 'recharts';
import { logisticsStore } from '../services/store';
import { Schedule, Fleet, RetailStore, Crew, SalesOrder, AdminActivity, LoadingDurationRecord } from '../types';
import { NavTab } from './Sidebar';
import { DriverLoadBalancing } from './DriverLoadBalancing';
import { SlaGaugeWidget } from './SlaGaugeWidget';

interface ExecutiveDashboardProps {
  onNavigate: (tab: NavTab) => void;
}

// 8-week synchronized operational dispatches vs sales orders
const SYNC_WEEKLY_TREND = [
  { week: '20 Jul', salesOrders: 50, dispatches: 38, tonase: 112 },
  { week: '27 Jul', salesOrders: 52, dispatches: 41, tonase: 124 },
  { week: '3 Agu', salesOrders: 43, dispatches: 36, tonase: 98 },
  { week: '10 Agu', salesOrders: 51, dispatches: 42, tonase: 130 },
  { week: '17 Agu', salesOrders: 48, dispatches: 40, tonase: 118 },
  { week: '24 Agu', salesOrders: 45, dispatches: 39, tonase: 115 },
  { week: '31 Agu', salesOrders: 49, dispatches: 43, tonase: 132 },
  { week: '7 Sep', salesOrders: 54, dispatches: 46, tonase: 140 }
];

// Product distribution
const PRODUCT_COMPOSITION = [
  { name: 'Karton Box Corrugated (A1)', value: 45, color: '#3b82f6', koli: '6.680 Koli' },
  { name: 'Die-Cut Box E-Commerce', value: 23, color: '#0ea5e9', koli: '3.415 Koli' },
  { name: 'Heavy Duty Box Industri', value: 18, color: '#f59e0b', koli: '2.670 Koli' },
  { name: 'Sheet Corrugated Board', value: 14, color: '#10b981', koli: '2.085 Koli' }
];

// Department SLA compliance comparison
const SLA_COMPARISON_DATA = [
  { week: '20 Jul', logistikSla: 94, salesSla: 80 },
  { week: '27 Jul', logistikSla: 95, salesSla: 82 },
  { week: '3 Agu', logistikSla: 93, salesSla: 81 },
  { week: '10 Agu', logistikSla: 96, salesSla: 83 },
  { week: '17 Agu', logistikSla: 95, salesSla: 82 },
  { week: '24 Agu', logistikSla: 97, salesSla: 84 },
  { week: '31 Agu', logistikSla: 96, salesSla: 84 },
  { week: '7 Sep', logistikSla: 98, salesSla: 85 }
];

export const ExecutiveDashboard: React.FC<ExecutiveDashboardProps> = ({ onNavigate }) => {
  const [schedules, setSchedules] = useState<Schedule[]>(logisticsStore.getSchedules());
  const [fleets, setFleets] = useState<Fleet[]>(logisticsStore.getFleets());
  const [stores, setStores] = useState<RetailStore[]>(logisticsStore.getStores());
  const [crews, setCrews] = useState<Crew[]>(logisticsStore.getCrews());
  const [salesOrders, setSalesOrders] = useState<SalesOrder[]>(logisticsStore.getSalesOrders());
  const [adminActivities, setAdminActivities] = useState<AdminActivity[]>(logisticsStore.getAdminActivities());
  const [loadingRecords, setLoadingRecords] = useState<LoadingDurationRecord[]>(logisticsStore.getLoadingRecords());

  const [activeFilterTab, setActiveFilterTab] = useState<'all' | 'ops' | 'sales'>('all');
  const [selectedPeriod, setSelectedPeriod] = useState<'today' | 'week' | 'month' | 'ytd'>('month');
  const [isRefreshing, setIsRefreshing] = useState(false);

  const [widgetsConfig, setWidgetsConfig] = useState<{
    driverLoadBalancing: boolean;
    quickActionAdmin: boolean;
    emergencyMap: boolean;
    kpiRibbon: boolean;
    chartsSection: boolean;
    pillarsSection: boolean;
    pipelineTable: boolean;
    customerDistribution: boolean;
    recentActivities: boolean;
  }>(() => {
    try {
      const saved = localStorage.getItem('akk_exec_widgets_v1');
      if (saved) {
        const parsed = JSON.parse(saved);
        return {
          driverLoadBalancing: parsed.driverLoadBalancing ?? true,
          quickActionAdmin: parsed.quickActionAdmin ?? true,
          emergencyMap: parsed.emergencyMap ?? true,
          kpiRibbon: parsed.kpiRibbon ?? true,
          chartsSection: parsed.chartsSection ?? true,
          pillarsSection: parsed.pillarsSection ?? true,
          pipelineTable: parsed.pipelineTable ?? true,
          customerDistribution: parsed.customerDistribution ?? true,
          recentActivities: parsed.recentActivities ?? true,
        };
      }
    } catch (e) {}
    return {
      driverLoadBalancing: true,
      quickActionAdmin: true,
      emergencyMap: true,
      kpiRibbon: true,
      chartsSection: true,
      pillarsSection: true,
      pipelineTable: true,
      customerDistribution: true,
      recentActivities: true
    };
  });

  const allWidgetsDisabled = !widgetsConfig.driverLoadBalancing &&
    !widgetsConfig.quickActionAdmin &&
    !widgetsConfig.emergencyMap &&
    !widgetsConfig.kpiRibbon &&
    !widgetsConfig.chartsSection &&
    !widgetsConfig.pillarsSection &&
    !widgetsConfig.pipelineTable;

  useEffect(() => {
    try {
      localStorage.setItem('akk_exec_widgets_v1', JSON.stringify(widgetsConfig));
    } catch (e) {}
  }, [widgetsConfig]);

  const [isWidgetModalOpen, setIsWidgetModalOpen] = useState(false);

  const [searchQuery, setSearchQuery] = useState('');
  const [inspectedItem, setInspectedItem] = useState<{
    type: 'pengiriman' | 'kru' | 'pelanggan' | 'pesanan';
    item: any;
  } | null>(null);

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

  useEffect(() => {
    return logisticsStore.subscribe(() => {
      setSchedules(logisticsStore.getSchedules());
      setFleets(logisticsStore.getFleets());
      setStores(logisticsStore.getStores());
      setCrews(logisticsStore.getCrews());
      setSalesOrders(logisticsStore.getSalesOrders());
      setAdminActivities(logisticsStore.getAdminActivities());
      setLoadingRecords(logisticsStore.getLoadingRecords());
    });
  }, []);

  const handleRefresh = () => {
    setIsRefreshing(true);
    setTimeout(() => setIsRefreshing(false), 600);
  };

  // Operational metrics
  const activeFleetsCount = useMemo(() => fleets.filter(f => f.status === 'on-duty').length, [fleets]);
  const inTransitCount = useMemo(() => schedules.filter(s => s.status === 'in_transit').length, [schedules]);
  const scheduledCount = useMemo(() => schedules.filter(s => s.status === 'scheduled').length, [schedules]);
  const deliveredCount = useMemo(() => schedules.filter(s => s.status === 'delivered').length, [schedules]);
  const totalFleetCount = fleets.length || 6;
  const fleetUtilizationRate = Math.round((activeFleetsCount / totalFleetCount) * 100);

  // Sales metrics
  const totalOrders = salesOrders.length || 120;
  const readyToLoadOrders = useMemo(() => salesOrders.filter(o => o.orderStatus === 'Siap Muat').length, [salesOrders]);
  const inProductionOrders = useMemo(() => salesOrders.filter(o => o.orderStatus === 'SPK Produksi').length, [salesOrders]);
  const deliveredSalesOrders = useMemo(() => salesOrders.filter(o => o.orderStatus === 'Terkirim').length, [salesOrders]);
  const activeAdminsCount = 3; // Dewi Kartika, Rina Setyowati, Budi Santoso
  const avgLoadingDuration = 34.9;
  const salesSlaRate = 84.8;

  // Integrated sync pipeline: Recent orders matching active distribution
  const orderLogisticsPipeline = useMemo(() => {
    return salesOrders.slice(0, 5).map((order, idx) => {
      const assignedFleet = fleets[idx % fleets.length];
      const assignedCrew = crews[idx % crews.length];
      const matchSchedule = schedules[idx % schedules.length];

      return {
        id: order.id,
        poNumber: order.poNumber,
        clientName: order.clientName,
        productType: order.productType,
        quantityPcs: order.quantityPcs,
        orderStatus: order.orderStatus,
        adminPic: order.adminPic,
        deliveryDestination: order.deliveryDestination,
        assignedFleetPlate: assignedFleet ? assignedFleet.plateNumber : 'DK-8192-AK',
        assignedFleetType: assignedFleet ? assignedFleet.vehicleType : 'Fuso Fighter 220PS',
        driverName: assignedCrew ? assignedCrew.name : 'Sugeng Riyadi',
        logisticsStatus: matchSchedule ? matchSchedule.status : (idx === 0 ? 'in_transit' : 'scheduled'),
        ferryStatus: idx % 2 === 0 ? 'Ketapang - Gilimanuk (Boarded)' : 'Rute Darat Jawa Timur'
      };
    });
  }, [salesOrders, fleets, crews, schedules]);

  const exportDashboardSnapshotCsv = () => {
    const csvRows = [
      ['"KATEGORI METRIK"', '"NILAI / STATUS"', '"KETERANGAN"'],
      ['"Nama Hub"', '"Banyuwangi Central Hub"', '"PT Anugerah Kemasan Kreatif"'],
      ['"Tanggal Ekspor"', `"${new Date().toLocaleString('id-ID')}"`, '"Snapshot Kinerja Mingguan Eksekutif"'],
      ['"Jadwal Aktif Hari Ini"', `"${schedules.filter(s => s.status === 'in_transit' || s.status === 'scheduled').length}"`, '"Pengiriman aktif dan terjadwal"'],
      ['"Armada Beroperasi"', `"${activeFleetsCount}"`, '"Armada aktif lintas rute"'],
      ['"Total Pelanggan Toko"', `"${stores.length}"`, '"Destinasi retail aktif"'],
      ['"Total Pesanan Penjualan"', `"${salesOrders.length}"`, '"PO Kemasan tercatat"'],
      ['"Rata-rata Kepatuhan SLA Logistik"', '"96.5%"', '"Target minimum 95%"'],
      ['"Rata-rata Kepatuhan SLA Sales"', '"82.4%"', '"Pemenuhan pesanan tepat waktu"']
    ];

    const csvContent = "data:text/csv;charset=utf-8," + csvRows.map(e => e.join(',')).join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `snapshot_kinerja_eksekutif_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      {widgetsConfig.driverLoadBalancing && <DriverLoadBalancing />}
      {/* ============================================================ */}
      {/* 1. TOP EXECUTIVE HEADER                                      */}
      {/* ============================================================ */}
      <div className="bg-slate-900 border border-slate-800/90 rounded-2xl p-5 sm:p-6 shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="inline-flex items-center gap-1.5 text-[10px] uppercase font-black tracking-wider px-2.5 py-0.5 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/30">
                <Sparkles className="w-3 h-3 text-amber-400" />
                DASHBOARD EKSEKUTIF UTAMA
              </span>
              <span className="text-slate-500 text-xs">&bull;</span>
              <span className="text-xs font-semibold text-slate-400">
                PT Anugrah Kemasan Kreatif &bull; Banyuwangi Central Hub
              </span>
            </div>

            <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight mt-1.5 flex items-center gap-2.5">
              <span>Dashboard Rangkuman Operasional & Penjualan</span>
            </h1>

            <p className="text-slate-400 text-xs sm:text-sm mt-1 max-w-3xl leading-relaxed">
              Konsolidasi data kinerja real-time dari seluruh divisi logistik armada distribusi antar-pulau
              dan pemenuhan pesanan administrasi penjualan kemasan karton box.
            </p>

            {/* Search Bar Feature */}
            <div className="relative mt-4 max-w-xl">
              <div className="relative">
                <input
                  type="text"
                  placeholder="Cari pengiriman (No. Tracking), kru (nama), pelanggan (toko), atau PO..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-slate-950 hover:bg-slate-950/90 focus:bg-slate-950 text-slate-100 text-xs rounded-xl pl-9 pr-8 py-2.5 border border-slate-800 focus:border-amber-500/80 focus:outline-hidden transition placeholder:text-slate-500 font-medium"
                />
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                  <Search className="w-4 h-4 text-slate-500" />
                </span>
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white cursor-pointer p-0.5"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Autocomplete dropdown list */}
              {searchQuery && (
                <div className="absolute z-50 left-0 right-0 mt-1.5 bg-slate-900 border border-slate-800 rounded-xl shadow-2xl overflow-hidden max-h-80 overflow-y-auto divide-y divide-slate-800/60">
                  {searchResults.length > 0 ? (
                    searchResults.map((res) => {
                      let icon = <FileText className="w-4 h-4 text-slate-400" />;
                      let catColor = 'bg-slate-800 text-slate-300';
                      if (res.type === 'pengiriman') {
                        icon = <Truck className="w-4 h-4 text-blue-400" />;
                        catColor = 'bg-blue-500/10 text-blue-300 border-blue-500/20';
                      } else if (res.type === 'kru') {
                        icon = <Users className="w-4 h-4 text-amber-400" />;
                        catColor = 'bg-amber-500/10 text-amber-300 border-amber-500/20';
                      } else if (res.type === 'pelanggan') {
                        icon = <ShoppingBag className="w-4 h-4 text-emerald-400" />;
                        catColor = 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20';
                      } else if (res.type === 'pesanan') {
                        icon = <Package className="w-4 h-4 text-rose-400" />;
                        catColor = 'bg-rose-500/10 text-rose-300 border-rose-500/20';
                      }

                      return (
                        <div
                          key={`${res.type}-${res.id}`}
                          onClick={() => {
                            setInspectedItem({ type: res.type, item: res.raw });
                            setSearchQuery('');
                          }}
                          className="flex items-center gap-3 px-3.5 py-2.5 hover:bg-slate-800/80 cursor-pointer transition select-none group"
                        >
                          <div className="p-1.5 rounded-lg bg-slate-950 group-hover:bg-slate-900 border border-slate-800/60">
                            {icon}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-xs font-bold text-slate-100 truncate">{res.title}</span>
                              <span className={`text-[8px] font-black uppercase px-1.5 py-0.2 rounded border ${catColor}`}>
                                {res.category}
                              </span>
                            </div>
                            <p className="text-[10px] text-slate-400 truncate mt-0.5">{res.subtitle}</p>
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div className="p-4 text-center text-[11px] text-slate-500">
                      Tidak ditemukan hasil pencarian untuk &quot;<span className="text-slate-400 font-bold">{searchQuery}</span>&quot;
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Daily Summary Statistics */}
          <div className="flex items-center gap-3 p-3 bg-slate-950/50 rounded-xl border border-slate-800 self-start">
            <div className="flex flex-col items-center px-3 border-r border-slate-800">
              <span className="text-[10px] uppercase font-bold text-slate-400">Jadwal Aktif Hari Ini</span>
              <span className="text-xl font-black text-white">{schedules.filter(s => s.status === 'in_transit' || s.status === 'scheduled').length}</span>
            </div>
            <div className="flex flex-col items-center px-3">
              <span className="text-[10px] uppercase font-bold text-slate-400">Armada Beroperasi</span>
              <span className="text-xl font-black text-blue-400">{activeFleetsCount}</span>
            </div>
          </div>

          {/* Quick Filter & Deep-Dive Actions */}
          <div className="flex flex-wrap items-center gap-2.5 self-start lg:self-auto">
            {/* View Mode Pill Switcher */}
            <div className="flex items-center bg-slate-950/80 p-1 rounded-xl border border-slate-800 text-xs">
              <button
                onClick={() => setActiveFilterTab('all')}
                className={`px-3 py-1.5 rounded-lg font-bold transition cursor-pointer ${
                  activeFilterTab === 'all'
                    ? 'bg-amber-500 text-slate-950 shadow-xs'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Semua
              </button>
              <button
                onClick={() => setActiveFilterTab('ops')}
                className={`px-3 py-1.5 rounded-lg font-bold transition cursor-pointer flex items-center gap-1.5 ${
                  activeFilterTab === 'ops'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-slate-400 hover:text-blue-300'
                }`}
              >
                <Truck className="w-3.5 h-3.5" />
                <span>Operasional</span>
              </button>
              <button
                onClick={() => setActiveFilterTab('sales')}
                className={`px-3 py-1.5 rounded-lg font-bold transition cursor-pointer flex items-center gap-1.5 ${
                  activeFilterTab === 'sales'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'text-slate-400 hover:text-emerald-300'
                }`}
              >
                <ShoppingBag className="w-3.5 h-3.5" />
                <span>Penjualan</span>
              </button>
            </div>

            {/* Refresh Button */}
            <button
              onClick={handleRefresh}
              className="p-2 rounded-xl bg-slate-950/80 hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-white transition cursor-pointer"
              title="Perbarui Sinkronisasi Data"
            >
              <RotateCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-amber-400' : ''}`} />
            </button>

            {/* Atur Widget Button */}
            <button
              onClick={() => setIsWidgetModalOpen(true)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-950/80 hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-white transition cursor-pointer text-xs font-semibold"
              title="Atur Widget Dashboard"
            >
              <Layers className="w-4 h-4 text-amber-400" />
              <span>Atur Widget</span>
            </button>

            {/* Ekspor Data Dashboard Button */}
            <button
              onClick={exportDashboardSnapshotCsv}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 transition cursor-pointer text-xs font-black shadow-md"
              title="Unduh snapshot data kinerja saat ini dalam format CSV / Excel"
            >
              <Download className="w-4 h-4" />
              <span>Ekspor Data Dashboard</span>
            </button>
          </div>
        </div>

        {/* Quick Jump Buttons to Dedicated Dashboards */}
        <div className="mt-4 pt-4 border-t border-slate-800/70 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2 text-slate-400">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>Sistem Terintegrasi: GPS Tracksolid &bull; ERP Sales Order &bull; Logistik Antar-Pulau</span>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={() => onNavigate('operational_dashboard')}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-500/15 hover:bg-blue-500/25 text-blue-400 border border-blue-500/30 font-bold transition cursor-pointer"
            >
              <Truck className="w-3.5 h-3.5" />
              <span>Buka Dashboard Operasional</span>
              <ArrowRight className="w-3 h-3" />
            </button>

            <button
              onClick={() => onNavigate('sales_activities')}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 text-amber-400 border border-amber-500/30 font-bold transition cursor-pointer"
            >
              <ShoppingBag className="w-3.5 h-3.5" />
              <span>Buka Aktivitas Admin Penjualan</span>
              <ArrowRight className="w-3 h-3" />
            </button>
          </div>
        </div>
      </div>

      {(!widgetsConfig.driverLoadBalancing && !widgetsConfig.quickActionAdmin) && (
        <div className="bg-slate-900 border border-amber-500/40 rounded-2xl p-6 text-center space-y-3 shadow-xl my-4">
          <div className="w-10 h-10 rounded-xl bg-amber-500/15 text-amber-400 flex items-center justify-center mx-auto">
            <Layers className="w-5 h-5" />
          </div>
          <div className="space-y-1">
            <h3 className="text-sm font-bold text-white">Semua Widget Sedang Disembunyikan</h3>
            <p className="text-xs text-slate-400 max-w-md mx-auto">
              Anda telah menyembunyikan semua panel widget di dashboard ini melalui menu pengaturan widget. Klik tombol di bawah untuk menampilkan kembali semuanya.
            </p>
          </div>
          <button
            onClick={() => setWidgetsConfig({
              driverLoadBalancing: true,
              quickActionAdmin: true,
              emergencyMap: false,
              kpiRibbon: false,
              chartsSection: false,
              pillarsSection: false,
              pipelineTable: false,
              customerDistribution: false,
              recentActivities: false
            })}
            className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black transition cursor-pointer shadow"
          >
            Tampilkan Kembali Semua Widget
          </button>
        </div>
      )}

      {/* ============================================================ */}
      {/* QUICK ACTIONS INTEGRATION                                    */}
      {/* ============================================================ */}
      {widgetsConfig.quickActionAdmin && (
        <div className="bg-slate-900 border border-slate-800/90 rounded-2xl p-4 shadow-xs space-y-3">
        <div className="flex items-center justify-between border-b border-slate-800/80 pb-2.5">
          <div className="flex items-center gap-2">
            <Radio className="w-4 h-4 text-rose-500 animate-pulse" />
            <div>
              <h2 className="text-sm font-black text-white uppercase tracking-tight">Pusat Tindakan Cepat (Quick Action Admin)</h2>
              <p className="text-[10px] text-slate-500 font-semibold">Tindakan operasional & pengiriman darurat bypass langsung ke sistem</p>
            </div>
          </div>
          <span className="text-[10px] bg-slate-950 px-2 py-1 rounded-lg border border-slate-800 text-slate-400 font-mono">Bypass Mode Aktif</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {/* Action 1: Pengiriman Darurat */}
          <div className="bg-slate-950/60 p-3.5 rounded-xl border border-rose-500/20 hover:border-rose-500/40 transition space-y-2.5 flex flex-col justify-between">
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-rose-500/10 text-rose-400 flex items-center justify-center">
                  <AlertTriangle className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-black text-rose-400">Pengiriman Darurat (Emergency Dispatch)</h4>
                  <p className="text-[9px] text-slate-500">Kirim armada dengan rute prioritas antar-pulau</p>
                </div>
              </div>
              <p className="text-[10px] text-slate-400 leading-relaxed">
                Secara otomatis mencatatkan jadwal pengiriman instan prioritas tinggi, melompati antrean dermaga penyeberangan Ketapang.
              </p>
            </div>
            
            <button
              onClick={() => {
                const trackingNumber = `TRK-EMG-${Math.floor(1000 + Math.random() * 9000)}`;
                const randomStore = stores[Math.floor(Math.random() * stores.length)] || { id: 'ST-001', storeName: 'Hub Denpasar Bali' };
                const availableFleet = fleets.find(f => f.status === 'available') || fleets[0];
                const availableCrew = crews.find(c => c.status === 'available') || crews[0];

                const emgSchedule = {
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
                  notes: 'DISPATCH DARURAT - MEMOTONG ANTRIAN PELABUHAN',
                  areaApprovalStatus: 'approved' as const
                };

                logisticsStore.addSchedule(emgSchedule);
                
                logisticsStore.emitNotification(
                  'schedule',
                  '🚨 EMERGENCY DISPATCH AKTIF!',
                  `Armada ${trackingNumber} diberangkatkan segera ke ${randomStore.storeName} untuk pengiriman darurat kemasan pengganti.`,
                  true
                );
              }}
              className="w-full py-2 px-3 rounded-lg bg-rose-500 hover:bg-rose-400 text-slate-950 text-xs font-black transition text-center cursor-pointer active:scale-95 flex items-center justify-center gap-1.5 shadow"
            >
              <Radio className="w-3.5 h-3.5" />
              <span>Kirim Armada Darurat Sekarang</span>
            </button>
          </div>

          {/* Action 2: Catat Konsumsi BBM Cepat */}
          <div className="bg-slate-950/60 p-3.5 rounded-xl border border-blue-500/20 hover:border-blue-500/40 transition space-y-2.5 flex flex-col justify-between">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-blue-500/10 text-blue-400 flex items-center justify-center">
                  <Truck className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-black text-blue-400">Isi BBM Cepat (Quick Fuel Log)</h4>
                  <p className="text-[9px] text-slate-500">Input pengisian solar untuk efisiensi armada</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 pt-1">
                <select
                  id="quick-fuel-fleet"
                  className="text-[10px] p-1.5 rounded bg-slate-900 border border-slate-800 text-slate-200"
                >
                  {fleets.slice(0, 4).map(f => (
                    <option key={f.id} value={f.id}>{f.plateNumber} ({f.vehicleType.slice(0, 10)})</option>
                  ))}
                </select>
                <input
                  id="quick-fuel-liters"
                  type="number"
                  placeholder="Jumlah Liter"
                  className="text-[10px] p-1.5 rounded bg-slate-900 border border-slate-800 text-slate-200 placeholder-slate-600"
                />
              </div>
            </div>

            <button
              onClick={() => {
                const fleetSelect = document.getElementById('quick-fuel-fleet') as HTMLSelectElement;
                const litersInput = document.getElementById('quick-fuel-liters') as HTMLInputElement;
                
                if (!litersInput || !litersInput.value) {
                  return;
                }

                const fleetId = fleetSelect?.value || 'FL-001';
                const liters = parseFloat(litersInput.value) || 50;
                const targetFleet = fleets.find(f => f.id === fleetId);

                logisticsStore.logActivity(
                  'Isi BBM',
                  targetFleet ? targetFleet.plateNumber : 'DK-8192-AK',
                  `Pengisian solar cepat sebanyak ${liters} Liter.`
                );

                litersInput.value = '';

                logisticsStore.emitNotification(
                  'delivery',
                  '⛽ Pengisian BBM Cepat Tercatat',
                  `BBM armada ${targetFleet ? targetFleet.plateNumber : 'DK-8192-AK'} diisi ulang sebanyak ${liters} Liter.`,
                  false
                );
              }}
              className="w-full py-2 px-3 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-black transition text-center cursor-pointer active:scale-95 flex items-center justify-center gap-1.5"
            >
              <span>Catat Solar & Update</span>
            </button>
          </div>

          {/* Action 3: Broadcaster Memo */}
          <div className="bg-slate-950/60 p-3.5 rounded-xl border border-emerald-500/20 hover:border-emerald-500/40 transition space-y-2.5 flex flex-col justify-between">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
                  <FileText className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-black text-emerald-400">Papan Pengumuman Admin (Broadcaster)</h4>
                  <p className="text-[9px] text-slate-500">Kirim instruksi langsung ke laci notifikasi admin</p>
                </div>
              </div>

              <input
                id="quick-announcement-text"
                type="text"
                placeholder="Ketik memo atau instruksi darurat..."
                className="w-full text-[10px] p-1.5 rounded bg-slate-900 border border-slate-800 text-slate-200 placeholder-slate-600 mt-1"
              />
            </div>

            <button
              onClick={() => {
                const textInput = document.getElementById('quick-announcement-text') as HTMLInputElement;
                if (!textInput || !textInput.value) {
                  return;
                }

                const memo = textInput.value;
                textInput.value = '';

                logisticsStore.emitNotification(
                  'schedule',
                  '📢 Instruksi Admin Baru',
                  `Memo: "${memo}"`,
                  true
                );
              }}
              className="w-full py-2 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black transition text-center cursor-pointer active:scale-95 flex items-center justify-center gap-1.5"
            >
              <span>Siarkan Instruksi Cepat</span>
            </button>
          </div>
        </div>
      </div>
      )}

      {/* 2. SEARCH INSPECTOR DIALOG MODAL */}
      {inspectedItem && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xs">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full overflow-hidden shadow-2xl animate-in fade-in-50 zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-4 border-b border-slate-800 bg-slate-950/40">
              <div className="flex items-center gap-2">
                <span className={`text-[9px] font-black uppercase px-2.5 py-0.5 rounded-full border ${
                  inspectedItem.type === 'pengiriman' ? 'bg-blue-500/10 text-blue-300 border-blue-500/20' :
                  inspectedItem.type === 'kru' ? 'bg-amber-500/10 text-amber-300 border-amber-500/20' :
                  inspectedItem.type === 'pelanggan' ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20' :
                  'bg-rose-500/10 text-rose-300 border-rose-500/20'
                }`}>
                  Detail {inspectedItem.type}
                </span>
              </div>
              <button
                onClick={() => setInspectedItem(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-5 space-y-4 max-h-[80vh] overflow-y-auto">
              {inspectedItem.type === 'pengiriman' && (() => {
                const s = inspectedItem.item as Schedule;
                const fleet = fleets.find(f => f.id === s.fleetId);
                const crew = crews.find(c => c.id === s.crewId);
                const store = stores.find(st => st.id === s.storeId);
                
                return (
                  <div className="space-y-3.5 text-xs">
                    <div className="flex justify-between items-start border-b border-slate-800/60 pb-3">
                      <div>
                        <div className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">No. Tracking</div>
                        <div className="text-sm font-black text-white mt-0.5">{s.trackingNumber}</div>
                      </div>
                      <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded border ${
                        s.status === 'delivered' ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20' :
                        s.status === 'in_transit' ? 'bg-blue-500/10 text-blue-300 border-blue-500/20' :
                        s.status === 'delayed' ? 'bg-rose-500/10 text-rose-300 border-rose-500/20' :
                        'bg-amber-500/10 text-amber-300 border-amber-500/20'
                      }`}>
                        {s.status.replace('_', ' ')}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-3 pt-1">
                      <div>
                        <div className="text-[10px] text-slate-500 font-bold">Rute Keberangkatan</div>
                        <div className="text-slate-200 font-semibold mt-0.5">{s.originName}</div>
                      </div>
                      <div>
                        <div className="text-[10px] text-slate-500 font-bold">Toko Penerima</div>
                        <div className="text-slate-200 font-semibold mt-0.5">{store ? store.storeName : 'Mitra Retail'}</div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <div className="text-[10px] text-slate-500 font-bold">Waktu Berangkat</div>
                        <div className="text-slate-200 mt-0.5">{new Date(s.departureDate).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })}</div>
                      </div>
                      <div>
                        <div className="text-[10px] text-slate-500 font-bold">Estimasi Tiba</div>
                        <div className="text-slate-200 mt-0.5">{new Date(s.estimatedArrival).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })}</div>
                      </div>
                    </div>

                    <div className="border-t border-slate-800/60 pt-3 space-y-2">
                      <div className="flex justify-between">
                        <span className="text-slate-500 font-medium">Deskripsi Muatan:</span>
                        <span className="text-slate-200 font-semibold">{s.cargoDescription}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500 font-medium">Berat Muatan:</span>
                        <span className="text-slate-200 font-semibold">{s.cargoWeightTon} Ton</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500 font-medium">Lintas Selat:</span>
                        <span className="text-slate-200 font-semibold">{s.isInterIsland ? 'Ketapang - Gilimanuk (Ferry)' : 'Darat Jawa Timur'}</span>
                      </div>
                      {s.ferryBookingCode && (
                        <div className="flex justify-between">
                          <span className="text-slate-500 font-medium">Tiket Ferry:</span>
                          <span className="text-amber-300 font-mono font-bold">{s.ferryBookingCode}</span>
                        </div>
                      )}
                    </div>

                    <div className="border-t border-slate-800/60 pt-3 grid grid-cols-2 gap-3">
                      <div className="p-2.5 bg-slate-950/40 rounded-xl border border-slate-800">
                        <div className="text-[9px] text-slate-500 font-bold">Armada Penjemput</div>
                        <div className="text-blue-400 font-bold mt-1 text-xs">{fleet ? fleet.plateNumber : 'N/A'}</div>
                        <div className="text-[9px] text-slate-400 mt-0.5">{fleet ? fleet.vehicleType : 'N/A'}</div>
                      </div>
                      <div className="p-2.5 bg-slate-950/40 rounded-xl border border-slate-800">
                        <div className="text-[9px] text-slate-500 font-bold">Kru Driver</div>
                        <div className="text-amber-400 font-bold mt-1 text-xs">{crew ? crew.name : 'N/A'}</div>
                        <div className="text-[9px] text-slate-400 mt-0.5">{crew ? crew.role : 'N/A'}</div>
                      </div>
                    </div>
                  </div>
                );
              })()}

              {inspectedItem.type === 'kru' && (() => {
                const c = inspectedItem.item as Crew;
                const fleet = fleets.find(f => f.id === c.currentFleetId);
                
                return (
                  <div className="space-y-3.5 text-xs">
                    <div className="flex items-center gap-3 border-b border-slate-800/60 pb-3">
                      <div className="p-2.5 rounded-full bg-amber-500/10 text-amber-400">
                        <Users className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="text-sm font-black text-white">{c.name}</div>
                        <div className="text-[10px] text-slate-400 font-bold uppercase mt-0.5">{c.role}</div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3 pt-1">
                      <div>
                        <div className="text-[10px] text-slate-500 font-bold">Nomor Telepon</div>
                        <div className="text-slate-200 font-semibold mt-0.5">{c.phone}</div>
                      </div>
                      <div>
                        <div className="text-[10px] text-slate-500 font-bold">Lisensi Driver (SIM)</div>
                        <div className="text-slate-200 font-semibold mt-0.5">{c.licenseType} ({c.licenseNumber})</div>
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-2 py-1">
                      <div className="p-2 bg-slate-950/40 border border-slate-800 rounded-lg text-center">
                        <div className="text-[8px] text-slate-500 font-bold">Total Ritase</div>
                        <div className="text-white font-bold text-sm mt-0.5">{c.tripsCompleted}</div>
                      </div>
                      <div className="p-2 bg-slate-950/40 border border-slate-800 rounded-lg text-center">
                        <div className="text-[8px] text-slate-500 font-bold">Rating Layanan</div>
                        <div className="text-amber-400 font-bold text-sm mt-0.5">★ {c.rating.toFixed(1)}</div>
                      </div>
                      <div className="p-2 bg-slate-950/40 border border-slate-800 rounded-lg text-center">
                        <div className="text-[8px] text-slate-500 font-bold">Status Kru</div>
                        <span className={`inline-block text-[8px] font-black uppercase mt-1 px-1.5 py-0.2 rounded border ${
                          c.status === 'available' ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20' :
                          c.status === 'on-duty' ? 'bg-blue-500/10 text-blue-300 border-blue-500/20' :
                          'bg-slate-500/10 text-slate-300 border-slate-500/20'
                        }`}>
                          {c.status}
                        </span>
                      </div>
                    </div>

                    {fleet && (
                      <div className="p-3 bg-slate-950/40 border border-slate-800 rounded-xl space-y-1">
                        <div className="text-[9px] text-slate-500 font-bold">Kendaraan Terkait Saat Ini</div>
                        <div className="flex items-center justify-between text-xs pt-1">
                          <span className="font-bold text-blue-400">{fleet.plateNumber}</span>
                          <span className="text-slate-300">{fleet.vehicleType}</span>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()}

              {inspectedItem.type === 'pelanggan' && (() => {
                const st = inspectedItem.item as RetailStore;
                
                return (
                  <div className="space-y-3.5 text-xs">
                    <div className="flex items-center gap-3 border-b border-slate-800/60 pb-3">
                      <div className="p-2.5 rounded-full bg-emerald-500/10 text-emerald-400">
                        <ShoppingBag className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="text-sm font-black text-white">{st.storeName}</div>
                        <div className="text-[10px] text-slate-400 font-bold uppercase mt-0.5">{st.storeCode} &bull; {st.storeCategory}</div>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <div>
                        <div className="text-[10px] text-slate-500 font-bold">Kontak Person</div>
                        <div className="text-slate-200 mt-0.5">{st.contactPerson} &bull; {st.phone}</div>
                      </div>
                      <div>
                        <div className="text-[10px] text-slate-500 font-bold">Jadwal Pengiriman Pilihan (SLA)</div>
                        <div className="text-slate-200 mt-0.5">{st.deliveryWindow}</div>
                      </div>
                      <div>
                        <div className="text-[10px] text-slate-500 font-bold">Wilayah & Kepulauan</div>
                        <div className="text-slate-200 mt-0.5">{st.island} &bull; Provinsi {st.province} &bull; {st.city}</div>
                      </div>
                      <div>
                        <div className="text-[10px] text-slate-500 font-bold">Alamat Pengiriman Lengkap</div>
                        <div className="text-slate-300 mt-1 leading-relaxed bg-slate-950/30 p-2.5 rounded-lg border border-slate-800">{st.address}</div>
                      </div>
                    </div>
                  </div>
                );
              })()}

              {inspectedItem.type === 'pesanan' && (() => {
                const o = inspectedItem.item as SalesOrder;
                
                return (
                  <div className="space-y-3.5 text-xs">
                    <div className="flex justify-between items-start border-b border-slate-800/60 pb-3">
                      <div>
                        <div className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Nomor PO Penjualan</div>
                        <div className="text-sm font-black text-white mt-0.5">{o.poNumber}</div>
                      </div>
                      <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded border ${
                        o.orderStatus === 'Terkirim' ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20' :
                        o.orderStatus === 'Siap Muat' ? 'bg-blue-500/10 text-blue-300 border-blue-500/20' :
                        o.orderStatus === 'SPK Produksi' ? 'bg-amber-500/10 text-amber-300 border-amber-500/20' :
                        'bg-slate-500/10 text-slate-300 border-slate-500/20'
                      }`}>
                        {o.orderStatus}
                      </span>
                    </div>

                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-slate-500">Nama Pelanggan:</span>
                        <span className="text-slate-200 font-semibold">{o.clientName}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">Kategori Produk:</span>
                        <span className="text-slate-200 font-semibold">{o.productType}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">Jumlah Pesanan:</span>
                        <span className="text-slate-200 font-bold">{o.quantityPcs.toLocaleString('id-ID')} Pcs</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">Destinasi Pengiriman:</span>
                        <span className="text-slate-200 font-semibold">{o.deliveryDestination}</span>
                      </div>
                      <div className="flex justify-between pt-1 border-t border-slate-800/50">
                        <span className="text-slate-500 font-medium">PIC Sales Admin:</span>
                        <span className="text-amber-400 font-semibold">{o.adminPic}</span>
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-slate-950/40 border-t border-slate-800 flex justify-end gap-2.5">
              <button
                onClick={() => setInspectedItem(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white font-bold transition text-xs cursor-pointer"
              >
                Tutup Detail
              </button>
            </div>
          </div>
        </div>
      )}

      {/* WIDGET CUSTOMIZATION MODAL */}
      {isWidgetModalOpen && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xs">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full overflow-hidden shadow-2xl animate-in fade-in-50 zoom-in-95 duration-150">
            <div className="flex items-center justify-between p-4 border-b border-slate-800 bg-slate-950/50">
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-amber-400" />
                <h3 className="text-sm font-black text-white uppercase tracking-tight">Atur Widget Dashboard Eksekutif</h3>
              </div>
              <button
                onClick={() => setIsWidgetModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto">
              <p className="text-xs text-slate-400 leading-relaxed">
                Pilih widget operasional mana saja yang ingin Anda tampilkan di Dashboard Eksekutif.
              </p>

              <div className="space-y-2.5">
                {[
                  { key: 'driverLoadBalancing', label: 'Load Balancing Driver (Distribusi Muatan per Bulan)', desc: 'Visualisasi beban tugas sopir antar-pulau' },
                  { key: 'quickActionAdmin', label: 'Pusat Tindakan Cepat (Quick Action Admin)', desc: 'Bypass darurat pengiriman, isi BBM, & broadcaster memo' },
                ].map(item => (
                  <label
                    key={item.key}
                    className="flex items-start gap-3 p-3 rounded-xl bg-slate-950/60 border border-slate-800/80 hover:border-slate-700 transition cursor-pointer select-none"
                  >
                    <input
                      type="checkbox"
                      checked={(widgetsConfig as any)[item.key]}
                      onChange={(e) => setWidgetsConfig({ ...widgetsConfig, [item.key]: e.target.checked })}
                      className="mt-0.5 rounded border-slate-700 text-amber-500 focus:ring-amber-500/20 bg-slate-900 cursor-pointer w-4 h-4"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-bold text-slate-100">{item.label}</div>
                      <div className="text-[10px] text-slate-400 mt-0.5">{item.desc}</div>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            <div className="p-4 border-t border-slate-800 bg-slate-950/50 flex items-center justify-between">
              <button
                onClick={() => {
                  setWidgetsConfig({
                    driverLoadBalancing: true,
                    quickActionAdmin: true,
                    emergencyMap: false,
                    kpiRibbon: false,
                    chartsSection: false,
                    pillarsSection: false,
                    pipelineTable: false,
                    customerDistribution: false,
                    recentActivities: false
                  });
                }}
                className="text-xs font-bold text-slate-400 hover:text-white transition cursor-pointer"
              >
                Reset Default Semua
              </button>

              <button
                onClick={() => setIsWidgetModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black transition cursor-pointer shadow"
              >
                Simpan & Terapkan
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
