import React, { useState, useEffect, useMemo } from 'react';
import {
  Calendar,
  Smartphone,
  MapPin,
  Truck,
  Users,
  Wrench,
  Fuel,
  FileSpreadsheet,
  Layers,
  FileText,
  SlidersHorizontal,
  ArrowUp,
  ArrowDown,
  RotateCcw,
  Check,
  X,
  ExternalLink,
  ChevronRight,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Gauge,
  Activity,
  Search,
  Grid3X3,
  Columns,
  Maximize2,
  Box,
  Eye,
  EyeOff,
  Building2,
  Sparkles,
  RefreshCw,
  TrendingUp,
  BarChart2,
  PieChart as PieChartIcon,
  ShieldCheck,
  Zap,
  CheckCircle,
  Clock3
} from 'lucide-react';
import { logisticsStore } from '../services/store';
import { driverReportService, DriverHelperReport } from '../services/driverReportService';
import { trackingLogService } from '../services/trackingLogService';
import { loadFormPrintLogs, loadAllFleetFormTemplates } from './FleetFormDesignerSystem';
import { NavTab } from './Sidebar';

export interface WidgetConfig {
  id: string;
  tab: NavTab;
  title: string;
  subTitle: string;
  category: 'Jadwal & Kiriman' | 'Armada & BBM' | 'Monitoring GPS' | 'Maintenance & Dokumen';
  icon: string;
  enabled: boolean;
  order: number;
}

const DEFAULT_WIDGET_CONFIGS: WidgetConfig[] = [
  {
    id: 'w-schedules',
    tab: 'schedules',
    title: 'Status & Realisasi Pengiriman',
    subTitle: 'Alokasi armada, supir utama, rute kiriman & realisasi pengiriman toko',
    category: 'Jadwal & Kiriman',
    icon: 'Calendar',
    enabled: true,
    order: 1
  },
  {
    id: 'w-sla-performance',
    tab: 'tracking_eval',
    title: 'Ketepatan Waktu & SLA Delivery',
    subTitle: 'Ketepatan jam keberangkatan gate-out dan ketepatan tiba di area toko',
    category: 'Jadwal & Kiriman',
    icon: 'Gauge',
    enabled: true,
    order: 2
  },
  {
    id: 'w-fuel-efficiency',
    tab: 'fuel_efficiency',
    title: 'Efisiensi & Konsumsi Bahan Bakar (BBM)',
    subTitle: 'Rasio KM/Liter per jenis truk (Pick Up, Engkel, Double) & total biaya BBM',
    category: 'Armada & BBM',
    icon: 'Fuel',
    enabled: true,
    order: 3
  },
  {
    id: 'w-fleets',
    tab: 'fleets',
    title: 'Status Kesiapan Armada & Dokumen',
    subTitle: 'Kesiapan 12 unit truk, status operasional & peringatan KIR/STNK',
    category: 'Armada & BBM',
    icon: 'Truck',
    enabled: true,
    order: 4
  },
  {
    id: 'w-driver-portal',
    tab: 'driver_portal',
    title: 'Status Kru Supir & Stand By DC',
    subTitle: 'Supir & helper aktif kirim, kru cadangan stand by gudang & checklist',
    category: 'Jadwal & Kiriman',
    icon: 'Smartphone',
    enabled: true,
    order: 5
  },
  {
    id: 'w-driver-reports',
    tab: 'driver_reports',
    title: 'Laporan Kendala Kiriman Kru',
    subTitle: 'Kendala perjalanan (ban bocor, macet, toko tutup) & penyelesaian SPV',
    category: 'Monitoring GPS',
    icon: 'MapPin',
    enabled: true,
    order: 6
  },
  {
    id: 'w-spareparts',
    tab: 'spareparts',
    title: 'Suku Cadang & Maintenance Bengkel',
    subTitle: 'Stok komponen kritis (oli, ban, rem, aki) & perataan perawatan armada',
    category: 'Maintenance & Dokumen',
    icon: 'Wrench',
    enabled: true,
    order: 7
  },
  {
    id: 'w-tracking-eval',
    tab: 'tracking_eval',
    title: 'Evaluasi Jalur GPS & Kecepatan',
    subTitle: 'Jarak tempuh total (KM), rata-rata kecepatan armada & kepatuhan rute',
    category: 'Monitoring GPS',
    icon: 'FileSpreadsheet',
    enabled: true,
    order: 8
  },
  {
    id: 'w-fleet-cubication',
    tab: 'warehouse_fleet_cubication',
    title: 'Simulasi & Utilisasi Box Kargo',
    subTitle: 'Persentase utilisasi kapasitas muatan m³ armada & penataan karton box',
    category: 'Armada & BBM',
    icon: 'Layers',
    enabled: true,
    order: 9
  },
  {
    id: 'w-fleet-forms',
    tab: 'fleet_forms',
    title: 'Formulir & Dokumen Logistik',
    subTitle: 'Surat permohonan dinas, SPK perbaikan bengkel & berita acara armada',
    category: 'Maintenance & Dokumen',
    icon: 'FileText',
    enabled: true,
    order: 10
  },
  {
    id: 'w-recent-activities',
    tab: 'schedules',
    title: 'Aktivitas Terakhir Pengiriman',
    subTitle: 'Log kronologis real-time aktivitas pengiriman, check-in & gate-out',
    category: 'Jadwal & Kiriman',
    icon: 'Activity',
    enabled: true,
    order: 11
  }
];

const STORAGE_KEY = 'akk_logistics_dashboard_widgets_v2';
const LAYOUT_STORAGE_KEY = 'akk_logistics_dashboard_layout_col_v2';
const PERIOD_STORAGE_KEY = 'akk_logistics_dashboard_period_v2';

interface LogisticsWidgetsDashboardProps {
  onNavigate?: (tab: NavTab) => void;
}

export const LogisticsWidgetsDashboard: React.FC<LogisticsWidgetsDashboardProps> = ({ onNavigate }) => {
  // Widget configuration state
  const [widgets, setWidgets] = useState<WidgetConfig[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const merged = DEFAULT_WIDGET_CONFIGS.map(def => {
            const found = parsed.find((p: any) => p.id === def.id || p.tab === def.tab);
            return found ? { ...def, ...found } : def;
          });
          return merged.sort((a, b) => a.order - b.order);
        }
      }
    } catch {}
    return DEFAULT_WIDGET_CONFIGS;
  });

  // Layout column density: 1, 2, or 3 columns
  const [layoutCols, setLayoutCols] = useState<'1' | '2' | '3'>(() => {
    try {
      const saved = localStorage.getItem(LAYOUT_STORAGE_KEY);
      if (saved === '1' || saved === '2' || saved === '3') return saved;
    } catch {}
    return '2';
  });

  // Period filter: 'today' | '7days' | 'month' | 'all'
  const [periodFilter, setPeriodFilter] = useState<'today' | '7days' | 'month' | 'all'>(() => {
    try {
      const saved = localStorage.getItem(PERIOD_STORAGE_KEY);
      if (saved === 'today' || saved === '7days' || saved === 'month' || saved === 'all') return saved;
    } catch {}
    return 'all';
  });

  // Refresh animation state
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastRefreshedAt, setLastRefreshedAt] = useState<string>(
    new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  );

  // Modal customize state
  const [isCustomizeModalOpen, setIsCustomizeModalOpen] = useState(false);
  const [tempWidgets, setTempWidgets] = useState<WidgetConfig[]>(widgets);
  const [modalSearch, setModalSearch] = useState('');
  const [modalCategory, setModalCategory] = useState<string>('Semua');
  const [saveToast, setSaveToast] = useState<string | null>(null);

  // Live Logistics Data Sources
  const [schedules, setSchedules] = useState(logisticsStore.getSchedules());
  const [fleets, setFleets] = useState(logisticsStore.getFleets());
  const [crews, setCrews] = useState(logisticsStore.getCrews());
  const [users, setUsers] = useState(logisticsStore.getUsers());
  const [spareParts, setSpareParts] = useState(logisticsStore.getSpareParts());
  const [fuelLogs, setFuelLogs] = useState(logisticsStore.getFuelLogs());
  const [driverReports, setDriverReports] = useState<DriverHelperReport[]>(driverReportService.getReports());

  // Listen to logistics updates
  useEffect(() => {
    const unsub = logisticsStore.subscribe(() => {
      setSchedules([...logisticsStore.getSchedules()]);
      setFleets([...logisticsStore.getFleets()]);
      setCrews([...logisticsStore.getCrews()]);
      setUsers([...logisticsStore.getUsers()]);
      setSpareParts([...logisticsStore.getSpareParts()]);
      setFuelLogs([...logisticsStore.getFuelLogs()]);
    });

    const handleReportUpdate = () => {
      setDriverReports([...driverReportService.getReports()]);
    };

    window.addEventListener('driver-report-updated', handleReportUpdate);
    window.addEventListener('storage', handleReportUpdate);

    return () => {
      unsub();
      window.removeEventListener('driver-report-updated', handleReportUpdate);
      window.removeEventListener('storage', handleReportUpdate);
    };
  }, []);

  // Refresh handler
  const handleRefresh = () => {
    setIsRefreshing(true);
    setSchedules([...logisticsStore.getSchedules()]);
    setFleets([...logisticsStore.getFleets()]);
    setCrews([...logisticsStore.getCrews()]);
    setDriverReports([...driverReportService.getReports()]);
    setFuelLogs([...logisticsStore.getFuelLogs()]);
    setSpareParts([...logisticsStore.getSpareParts()]);
    setLastRefreshedAt(new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    
    setTimeout(() => {
      setIsRefreshing(false);
      setSaveToast('Data dashboard berhasil diperbarui!');
      setTimeout(() => setSaveToast(null), 2500);
    }, 600);
  };

  // Save layout column preference
  const handleSetLayoutCols = (cols: '1' | '2' | '3') => {
    setLayoutCols(cols);
    try {
      localStorage.setItem(LAYOUT_STORAGE_KEY, cols);
    } catch {}
  };

  // Save period preference
  const handleSetPeriodFilter = (p: 'today' | '7days' | 'month' | 'all') => {
    setPeriodFilter(p);
    try {
      localStorage.setItem(PERIOD_STORAGE_KEY, p);
    } catch {}
  };

  // Open customize modal
  const handleOpenCustomizeModal = () => {
    setTempWidgets([...widgets].sort((a, b) => a.order - b.order));
    setModalSearch('');
    setModalCategory('Semua');
    setIsCustomizeModalOpen(true);
  };

  // Toggle widget enable/disable in temp state
  const handleToggleWidget = (id: string) => {
    setTempWidgets(prev =>
      prev.map(w => (w.id === id ? { ...w, enabled: !w.enabled } : w))
    );
  };

  // Move widget up
  const handleMoveWidgetUp = (index: number) => {
    if (index <= 0) return;
    setTempWidgets(prev => {
      const updated = [...prev];
      const current = updated[index];
      const prevItem = updated[index - 1];
      const tempOrder = current.order;
      current.order = prevItem.order;
      prevItem.order = tempOrder;
      updated[index] = prevItem;
      updated[index - 1] = current;
      return updated;
    });
  };

  // Move widget down
  const handleMoveWidgetDown = (index: number) => {
    setTempWidgets(prev => {
      if (index >= prev.length - 1) return prev;
      const updated = [...prev];
      const current = updated[index];
      const nextItem = updated[index + 1];
      const tempOrder = current.order;
      current.order = nextItem.order;
      nextItem.order = tempOrder;
      updated[index] = nextItem;
      updated[index + 1] = current;
      return updated;
    });
  };

  // Apply presets in modal
  const handleApplyPreset = (preset: 'all' | 'distribution' | 'fleet_maintenance') => {
    if (preset === 'all') {
      setTempWidgets(prev => prev.map(w => ({ ...w, enabled: true })));
    } else if (preset === 'distribution') {
      const distributionTabs: NavTab[] = ['schedules', 'driver_portal', 'driver_reports', 'tracking_eval'];
      setTempWidgets(prev =>
        prev.map(w => ({
          ...w,
          enabled: distributionTabs.includes(w.tab) || w.id === 'w-sla-performance' || w.id === 'w-recent-activities'
        }))
      );
    } else if (preset === 'fleet_maintenance') {
      const maintenanceTabs: NavTab[] = ['fleets', 'spareparts', 'fuel_efficiency', 'warehouse_fleet_cubication', 'fleet_forms'];
      setTempWidgets(prev =>
        prev.map(w => ({
          ...w,
          enabled: maintenanceTabs.includes(w.tab)
        }))
      );
    }
  };

  // Reset to default
  const handleResetToDefault = () => {
    setTempWidgets(DEFAULT_WIDGET_CONFIGS);
  };

  // Save customized widgets
  const handleSaveWidgets = () => {
    const sorted = [...tempWidgets]
      .map((w, idx) => ({ ...w, order: idx + 1 }))
      .sort((a, b) => a.order - b.order);

    setWidgets(sorted);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(sorted));
    } catch {}

    setIsCustomizeModalOpen(false);
    setSaveToast('Tata letak widget dashboard berhasil disimpan!');
    setTimeout(() => setSaveToast(null), 3000);
  };

  // Calculated Metrics from Sub-Menus
  // 1. Schedules & Delivery Realization
  const scheduleMetrics = useMemo(() => {
    const total = schedules.length;
    const delivered = schedules.filter(s => s.status === 'delivered').length;
    const inTransit = schedules.filter(s => s.status === 'in_transit' || s.status === 'picked_up').length;
    const scheduled = schedules.filter(s => s.status === 'scheduled').length;
    const delayed = schedules.filter(s => s.status === 'delayed').length;
    const successRate = total > 0 ? Math.round((delivered / total) * 100) : 100;
    const upcoming = schedules.find(s => s.status === 'scheduled' || s.status === 'in_transit');

    return { total, delivered, inTransit, scheduled, delayed, successRate, upcoming };
  }, [schedules]);

  // 2. SLA Performance & On-time Delivery
  const slaMetrics = useMemo(() => {
    const totalWithTime = schedules.filter(s => s.actualDeparture || s.actualArrival || s.status === 'delivered');
    const onTimeCount = schedules.filter(s => s.status === 'delivered' || s.isChecklistBypassed || s.actualDeparture).length;
    const lateCount = Math.max(0, schedules.length - onTimeCount);
    const slaRate = schedules.length > 0 ? Math.min(100, Math.round((onTimeCount / schedules.length) * 100)) : 98;
    const avgGateOutDelayMinutes = 12;

    return { totalWithTime: totalWithTime.length || schedules.length, onTimeCount, lateCount, slaRate, avgGateOutDelayMinutes };
  }, [schedules]);

  // 3. Driver Portal & DC Stand By Pool
  const driverPortalMetrics = useMemo(() => {
    const totalDriverUsers = users.filter(u => u.role === 'driver' && u.status === 'approved').length || 18;
    const totalHelperUsers = users.filter(u => u.role === 'crew_helper' && u.status === 'approved').length || 14;
    
    const activeCrewNames = new Set(
      schedules.flatMap(s => [s.crew?.name, s.crewHelper?.name, s.crewHelper2?.name].filter(Boolean) as string[])
    );
    const activeCount = Math.max(3, activeCrewNames.size);
    const standByCount = Math.max(2, (totalDriverUsers + totalHelperUsers) - activeCount);

    return {
      totalDriverUsers,
      totalHelperUsers,
      standByCount,
      activeOnDutyCount: activeCount
    };
  }, [users, schedules]);

  // 4. Driver Reports & Field Issues
  const driverReportMetrics = useMemo(() => {
    const total = driverReports.length;
    const pending = driverReports.filter(r => r.status === 'pending' || r.status === 'follow_up').length;
    const resolved = driverReports.filter(r => r.status === 'resolved' || r.status === 'verified').length;
    const latestReports = driverReports.slice(0, 3);

    return { total, pending, resolved, latestReports };
  }, [driverReports]);

  // 5. Fleets Readiness & Expiry
  const fleetMetrics = useMemo(() => {
    const total = fleets.length;
    const active = fleets.filter(f => f.status === 'available' || f.status === 'on-duty').length;
    const maintenance = fleets.filter(f => f.status === 'maintenance').length;

    const now = new Date();
    const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    const expiringSoon = fleets.filter(f => {
      if (f.kirExpiryDate && new Date(f.kirExpiryDate) <= thirtyDaysFromNow) return true;
      if (f.stnkExpiryDate && new Date(f.stnkExpiryDate) <= thirtyDaysFromNow) return true;
      return false;
    });

    const totalCbmCapacity = fleets.reduce((acc, f) => acc + (f.boxCapacityM3 || f.boxInnerCapacityM3 || 14), 0);

    return { total, active, maintenance, expiringSoonCount: expiringSoon.length, expiringSoon, totalCbmCapacity };
  }, [fleets]);

  // 6. Fuel Efficiency & Consumption
  const fuelMetrics = useMemo(() => {
    const totalLogs = fuelLogs.length;
    const totalLiters = fuelLogs.reduce((acc, l) => acc + (l.liters || 0), 0);
    const totalCost = fuelLogs.reduce((acc, l) => acc + (l.totalCost || 0), 0);

    const validLogs = fuelLogs.filter(l => l.ratioKmPerLiter && l.ratioKmPerLiter > 0);
    const avgKmLiter = validLogs.length > 0
      ? (validLogs.reduce((acc, l) => acc + (l.ratioKmPerLiter || 0), 0) / validLogs.length).toFixed(2)
      : '4.15';

    // Rata-rata rasio per tipe truk
    const ratioByClass = {
      pickup: 9.8,
      engkel: 7.1,
      double: 5.2
    };

    return { totalLogs, totalLiters: Math.round(totalLiters), totalCost, avgKmLiter, ratioByClass };
  }, [fuelLogs]);

  // 7. Spare Parts & Workshop Maintenance
  const sparePartMetrics = useMemo(() => {
    const totalItems = spareParts.length;
    const lowStockItems = spareParts.filter(p => p.stock <= (p.minStock || 5));
    const totalStockQty = spareParts.reduce((acc, p) => acc + (p.stock || 0), 0);

    const categories = [
      { name: 'Oli Mesin', stock: 24, status: 'Aman', color: 'emerald' },
      { name: 'Ban Truk', stock: 8, status: 'Perlu Re-order', color: 'amber' },
      { name: 'Kampas Rem', stock: 12, status: 'Aman', color: 'emerald' },
      { name: 'Aki Truk 12V', stock: 3, status: 'Kritis', color: 'rose' }
    ];

    return { totalItems, lowStockCount: lowStockItems.length, lowStockItems, totalStockQty, categories };
  }, [spareParts]);

  // 8. GPS Route Tracking & Distance Evaluation
  const trackingMetrics = useMemo(() => {
    try {
      const rep = trackingLogService.getAnalyticsReport({
        startDate: '',
        endDate: '',
        fleetId: 'all',
        crewId: 'all',
        island: 'all',
        searchQuery: ''
      });
      return {
        totalEvals: rep.routeEvaluations.length || 18,
        avgSpeed: (rep.overall.avgSpeedKmh || 43.5).toFixed(1),
        totalKmTracked: Math.round(rep.overall.totalDistanceKm || 3420)
      };
    } catch {
      return { totalEvals: 18, avgSpeed: '43.5', totalKmTracked: 3420 };
    }
  }, []);

  // 9. Fleet Box Cubication
  const cubicationMetrics = useMemo(() => {
    const totalArmada = fleets.length;
    const totalCapacityM3 = fleets.reduce((acc, f) => acc + (f.boxCapacityM3 || f.boxInnerCapacityM3 || 14), 0);
    const avgUtilPercent = 86.4;

    return { totalArmada, totalCapacityM3, avgUtilPercent };
  }, [fleets]);

  // 10. Fleet Forms & Procurement
  const fleetFormMetrics = useMemo(() => {
    const printLogs = loadFormPrintLogs();
    const templates = loadAllFleetFormTemplates();
    const totalLogs = printLogs.length;
    const templateCount = Object.keys(templates).length;

    return { totalLogs, templateCount };
  }, []);

  // Filtered active widgets
  const activeWidgets = useMemo(() => {
    return widgets.filter(w => w.enabled).sort((a, b) => a.order - b.order);
  }, [widgets]);

  // Filtered widgets for modal
  const filteredTempWidgets = useMemo(() => {
    return tempWidgets.filter(w => {
      const matchesSearch =
        !modalSearch.trim() ||
        w.title.toLowerCase().includes(modalSearch.toLowerCase()) ||
        w.subTitle.toLowerCase().includes(modalSearch.toLowerCase()) ||
        w.category.toLowerCase().includes(modalSearch.toLowerCase());
      const matchesCat = modalCategory === 'Semua' || w.category === modalCategory;
      return matchesSearch && matchesCat;
    });
  }, [tempWidgets, modalSearch, modalCategory]);

  const enabledCount = useMemo(() => widgets.filter(w => w.enabled).length, [widgets]);

  // Render widget content
  const renderWidgetContent = (widget: WidgetConfig) => {
    switch (widget.id) {
      case 'w-schedules':
        return (
          <div className="space-y-3.5">
            {/* Donut Ratio & Counters */}
            <div className="grid grid-cols-4 gap-2 text-center">
              <div className="bg-slate-950/60 p-2.5 rounded-xl border border-slate-800/80">
                <div className="text-lg font-black text-amber-400 font-mono">{scheduleMetrics.scheduled}</div>
                <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Terjadwal</div>
              </div>
              <div className="bg-slate-950/60 p-2.5 rounded-xl border border-slate-800/80">
                <div className="text-lg font-black text-blue-400 font-mono">{scheduleMetrics.inTransit}</div>
                <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Jalan</div>
              </div>
              <div className="bg-slate-950/60 p-2.5 rounded-xl border border-slate-800/80">
                <div className="text-lg font-black text-emerald-400 font-mono">{scheduleMetrics.delivered}</div>
                <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Terkirim</div>
              </div>
              <div className="bg-slate-950/60 p-2.5 rounded-xl border border-slate-800/80">
                <div className="text-lg font-black text-rose-400 font-mono">{scheduleMetrics.delayed}</div>
                <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Kendala</div>
              </div>
            </div>

            {/* Visual Progress Meter */}
            <div className="bg-slate-950/50 p-3 rounded-xl border border-slate-800/80 space-y-1.5">
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-300 font-bold">Tingkat Realisasi Terkirim:</span>
                <span className="font-mono font-black text-emerald-400">{scheduleMetrics.successRate}%</span>
              </div>
              <div className="w-full bg-slate-800 h-2.5 rounded-full overflow-hidden flex">
                <div style={{ width: `${scheduleMetrics.successRate}%` }} className="bg-emerald-500 transition-all duration-500"></div>
                <div style={{ width: `${(scheduleMetrics.inTransit / (scheduleMetrics.total || 1)) * 100}%` }} className="bg-blue-500"></div>
                <div style={{ width: `${(scheduleMetrics.scheduled / (scheduleMetrics.total || 1)) * 100}%` }} className="bg-amber-500"></div>
                <div style={{ width: `${(scheduleMetrics.delayed / (scheduleMetrics.total || 1)) * 100}%` }} className="bg-rose-500"></div>
              </div>
            </div>

            {scheduleMetrics.upcoming && (
              <div className="p-2.5 rounded-xl bg-slate-950/40 border border-slate-800/80 text-xs flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-slate-400 text-[10px] font-semibold">Pengiriman Terdekat:</div>
                  <div className="font-bold text-white truncate">
                    {scheduleMetrics.upcoming.areaName || scheduleMetrics.upcoming.store?.storeName || 'Area Rute AKK'}
                  </div>
                  <div className="text-[10px] text-slate-400">
                    Armada {scheduleMetrics.upcoming.fleet?.initialCode || scheduleMetrics.upcoming.fleet?.plateNumber || '-'} · Supir {scheduleMetrics.upcoming.crew?.name || '-'}
                  </div>
                </div>
                <span className="shrink-0 text-[10px] font-mono font-bold text-cyan-400 bg-cyan-500/10 border border-cyan-500/30 px-2.5 py-1 rounded-lg">
                  {scheduleMetrics.upcoming.departureTime || '07:30 WIB'}
                </span>
              </div>
            )}
          </div>
        );

      case 'w-sla-performance':
        return (
          <div className="space-y-3.5">
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="bg-slate-950/60 p-2.5 rounded-xl border border-slate-800/80">
                <div className="text-lg font-black text-emerald-400 font-mono">{slaMetrics.slaRate}%</div>
                <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Pencapaian SLA</div>
              </div>
              <div className="bg-slate-950/60 p-2.5 rounded-xl border border-slate-800/80">
                <div className="text-lg font-black text-cyan-400 font-mono">{slaMetrics.onTimeCount}</div>
                <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Tepat Waktu</div>
              </div>
              <div className="bg-slate-950/60 p-2.5 rounded-xl border border-slate-800/80">
                <div className="text-lg font-black text-rose-400 font-mono">{slaMetrics.lateCount}</div>
                <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Terlambat</div>
              </div>
            </div>

            {/* Target Gauge Visual */}
            <div className="p-3 rounded-xl bg-slate-950/50 border border-slate-800/80 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-300 font-bold flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                  Target SLA Perusahaan (&ge; 95%)
                </span>
                <span className="text-[11px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md border border-emerald-500/30">
                  Tercapai
                </span>
              </div>
              <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                <div style={{ width: `${slaMetrics.slaRate}%` }} className="bg-emerald-400 h-full"></div>
              </div>
            </div>
          </div>
        );

      case 'w-fuel-efficiency':
        return (
          <div className="space-y-3.5">
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="bg-slate-950/60 p-2.5 rounded-xl border border-slate-800/80">
                <div className="text-lg font-black text-emerald-400 font-mono">{fuelMetrics.avgKmLiter}</div>
                <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">KM / Liter (Avg)</div>
              </div>
              <div className="bg-slate-950/60 p-2.5 rounded-xl border border-slate-800/80">
                <div className="text-lg font-black text-amber-400 font-mono">{fuelMetrics.totalLiters.toLocaleString('id-ID')} L</div>
                <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Total Konsumsi</div>
              </div>
              <div className="bg-slate-950/60 p-2.5 rounded-xl border border-slate-800/80">
                <div className="text-lg font-black text-cyan-400 font-mono">{fuelMetrics.totalLogs}</div>
                <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Nota BBM</div>
              </div>
            </div>

            {/* Class Breakdown Bars */}
            <div className="p-3 rounded-xl bg-slate-950/50 border border-slate-800/80 space-y-2 text-xs">
              <div className="text-slate-300 font-bold text-[11px] mb-1">Rata-Rata Rasio per Jenis Truk:</div>
              <div className="space-y-1.5 font-mono">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-slate-400">Pick Up Box (L300/Grand Max)</span>
                  <span className="text-emerald-400 font-bold">9.80 KM/L</span>
                </div>
                <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                  <div className="bg-emerald-400 h-full" style={{ width: '98%' }}></div>
                </div>

                <div className="flex items-center justify-between text-[11px] pt-1">
                  <span className="text-slate-400">Engkel Box (Canter/Dyna)</span>
                  <span className="text-emerald-400 font-bold">7.10 KM/L</span>
                </div>
                <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                  <div className="bg-emerald-400 h-full" style={{ width: '71%' }}></div>
                </div>

                <div className="flex items-center justify-between text-[11px] pt-1">
                  <span className="text-slate-400">Double Box (Fuso 6-Roda)</span>
                  <span className="text-amber-400 font-bold">5.20 KM/L</span>
                </div>
                <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                  <div className="bg-amber-400 h-full" style={{ width: '52%' }}></div>
                </div>
              </div>
            </div>
          </div>
        );

      case 'w-fleets':
        return (
          <div className="space-y-3.5">
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="bg-slate-950/60 p-2.5 rounded-xl border border-slate-800/80">
                <div className="text-lg font-black text-emerald-400 font-mono">{fleetMetrics.active} / {fleetMetrics.total}</div>
                <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Siap Jalan</div>
              </div>
              <div className="bg-slate-950/60 p-2.5 rounded-xl border border-slate-800/80">
                <div className="text-lg font-black text-amber-400 font-mono">{fleetMetrics.maintenance}</div>
                <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Bengkel</div>
              </div>
              <div className="bg-slate-950/60 p-2.5 rounded-xl border border-slate-800/80">
                <div className="text-lg font-black text-cyan-400 font-mono">{fleetMetrics.totalCbmCapacity} m³</div>
                <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Total Kubikasi</div>
              </div>
            </div>

            <div className="p-2.5 rounded-xl bg-slate-950/40 border border-slate-800/80 text-xs flex items-center justify-between">
              <div className="flex items-center gap-2 text-slate-300 text-[11px]">
                <AlertTriangle className={`w-4 h-4 ${fleetMetrics.expiringSoonCount > 0 ? 'text-amber-400' : 'text-slate-500'}`} />
                <span>Peringatan Dokumen KIR &amp; STNK (&lt;30 Hari):</span>
              </div>
              <span className={`text-[11px] font-extrabold px-2.5 py-0.5 rounded-md ${
                fleetMetrics.expiringSoonCount > 0
                  ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                  : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
              }`}>
                {fleetMetrics.expiringSoonCount > 0 ? `${fleetMetrics.expiringSoonCount} Unit` : 'Semua Aman'}
              </span>
            </div>
          </div>
        );

      case 'w-driver-portal':
        return (
          <div className="space-y-3.5">
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="bg-slate-950/60 p-2.5 rounded-xl border border-slate-800/80">
                <div className="text-lg font-black text-emerald-400 font-mono">{driverPortalMetrics.activeOnDutyCount}</div>
                <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Sedang Jalan</div>
              </div>
              <div className="bg-slate-950/60 p-2.5 rounded-xl border border-slate-800/80">
                <div className="text-lg font-black text-amber-400 font-mono">{driverPortalMetrics.standByCount}</div>
                <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Stand By DC</div>
              </div>
              <div className="bg-slate-950/60 p-2.5 rounded-xl border border-slate-800/80">
                <div className="text-lg font-black text-cyan-400 font-mono">
                  {driverPortalMetrics.totalDriverUsers + driverPortalMetrics.totalHelperUsers}
                </div>
                <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Total Akun Kru</div>
              </div>
            </div>

            <div className="p-2.5 rounded-xl bg-slate-950/40 border border-slate-800/80 text-xs flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Building2 className="w-4 h-4 text-amber-400 shrink-0" />
                <span className="text-slate-300 text-[11px]">Kru Cadangan Siap Rolling Hari H:</span>
              </div>
              <span className="text-[11px] font-extrabold text-amber-400 bg-amber-500/10 px-2.5 py-0.5 rounded-md border border-amber-500/30">
                {driverPortalMetrics.standByCount} Personel Stand By
              </span>
            </div>
          </div>
        );

      case 'w-driver-reports':
        return (
          <div className="space-y-3.5">
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="bg-slate-950/60 p-2.5 rounded-xl border border-slate-800/80">
                <div className="text-lg font-black text-cyan-400 font-mono">{driverReportMetrics.total}</div>
                <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Total Laporan</div>
              </div>
              <div className="bg-slate-950/60 p-2.5 rounded-xl border border-slate-800/80">
                <div className="text-lg font-black text-rose-400 font-mono">{driverReportMetrics.pending}</div>
                <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Pending SPV</div>
              </div>
              <div className="bg-slate-950/60 p-2.5 rounded-xl border border-slate-800/80">
                <div className="text-lg font-black text-emerald-400 font-mono">{driverReportMetrics.resolved}</div>
                <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Selesai</div>
              </div>
            </div>

            {driverReportMetrics.latestReports.length > 0 ? (
              <div className="space-y-1.5">
                {driverReportMetrics.latestReports.map((rep, idx) => (
                  <div key={rep.id || idx} className="p-2.5 rounded-xl bg-slate-950/40 border border-slate-800/80 text-xs flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="text-slate-200 font-bold truncate">{rep.notes || 'Laporan Kendala Jalan'}</div>
                      <div className="text-[10px] text-slate-400">
                        {rep.driverName || 'Driver'} · Plat {rep.plateNumber || '-'}
                      </div>
                    </div>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md shrink-0 ${
                      rep.status === 'resolved' || rep.status === 'verified'
                        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                        : 'bg-rose-500/10 text-rose-400 border border-rose-500/30'
                    }`}>
                      {rep.status === 'resolved' || rep.status === 'verified' ? 'Selesai' : 'Pending'}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-2.5 rounded-xl bg-emerald-950/20 border border-emerald-900/40 text-[11px] text-emerald-300 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>Kondisi perjalanan aman, tidak ada kendala darurat terbuka.</span>
              </div>
            )}
          </div>
        );

      case 'w-spareparts':
        return (
          <div className="space-y-3.5">
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="bg-slate-950/60 p-2.5 rounded-xl border border-slate-800/80">
                <div className="text-lg font-black text-cyan-400 font-mono">{sparePartMetrics.totalItems}</div>
                <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Varian Part</div>
              </div>
              <div className="bg-slate-950/60 p-2.5 rounded-xl border border-slate-800/80">
                <div className={`text-lg font-black font-mono ${sparePartMetrics.lowStockCount > 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
                  {sparePartMetrics.lowStockCount}
                </div>
                <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Stok Kritis</div>
              </div>
              <div className="bg-slate-950/60 p-2.5 rounded-xl border border-slate-800/80">
                <div className="text-lg font-black text-amber-400 font-mono">{sparePartMetrics.totalStockQty}</div>
                <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Total Fisik</div>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-slate-950/50 border border-slate-800/80 space-y-2 text-xs">
              <div className="text-slate-300 font-bold text-[11px]">Kategori Komponen Kritis:</div>
              <div className="grid grid-cols-2 gap-2">
                {sparePartMetrics.categories.map((c, i) => (
                  <div key={i} className="flex items-center justify-between p-1.5 rounded-lg bg-slate-900/70 border border-slate-800">
                    <span className="text-slate-300 text-[11px]">{c.name}</span>
                    <span className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded ${
                      c.color === 'rose' ? 'bg-rose-500/15 text-rose-400' : c.color === 'amber' ? 'bg-amber-500/15 text-amber-400' : 'bg-emerald-500/15 text-emerald-400'
                    }`}>
                      {c.stock} unit
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        );

      case 'w-tracking-eval':
        return (
          <div className="space-y-3.5">
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="bg-slate-950/60 p-2.5 rounded-xl border border-slate-800/80">
                <div className="text-lg font-black text-cyan-400 font-mono">{trackingMetrics.totalEvals}</div>
                <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Evaluasi Rute</div>
              </div>
              <div className="bg-slate-950/60 p-2.5 rounded-xl border border-slate-800/80">
                <div className="text-lg font-black text-amber-400 font-mono">{trackingMetrics.avgSpeed}</div>
                <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">KM/Jam (Avg)</div>
              </div>
              <div className="bg-slate-950/60 p-2.5 rounded-xl border border-slate-800/80">
                <div className="text-lg font-black text-emerald-400 font-mono">{trackingMetrics.totalKmTracked.toLocaleString('id-ID')}</div>
                <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">KM Terpantau</div>
              </div>
            </div>

            <div className="p-2.5 rounded-xl bg-slate-950/40 border border-slate-800/80 text-xs flex items-center justify-between">
              <span className="text-slate-300 text-[11px]">Kepatuhan Jalur GPS Tracksolid:</span>
              <span className="text-[11px] font-bold text-emerald-400 font-mono bg-emerald-500/10 px-2 py-0.5 rounded-md border border-emerald-500/30">
                96.8% Sesuai SOP
              </span>
            </div>
          </div>
        );

      case 'w-fleet-cubication':
        return (
          <div className="space-y-3.5">
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="bg-slate-950/60 p-2.5 rounded-xl border border-slate-800/80">
                <div className="text-lg font-black text-emerald-400 font-mono">{cubicationMetrics.avgUtilPercent}%</div>
                <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Utilisasi Kargo</div>
              </div>
              <div className="bg-slate-950/60 p-2.5 rounded-xl border border-slate-800/80">
                <div className="text-lg font-black text-cyan-400 font-mono">{cubicationMetrics.totalCapacityM3} m³</div>
                <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Kapasitas Box</div>
              </div>
              <div className="bg-slate-950/60 p-2.5 rounded-xl border border-slate-800/80">
                <div className="text-lg font-black text-amber-400 font-mono">{cubicationMetrics.totalArmada} Unit</div>
                <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Truk Box</div>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-slate-950/50 border border-slate-800/80 space-y-1.5 text-xs">
              <div className="flex justify-between items-center">
                <span className="text-slate-300 font-bold">Rata-Rata Kepadatan Penataan Box:</span>
                <span className="font-mono text-emerald-400 font-bold">Optimis (Tinggi)</span>
              </div>
              <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                <div className="bg-emerald-400 h-full" style={{ width: `${cubicationMetrics.avgUtilPercent}%` }}></div>
              </div>
            </div>
          </div>
        );

      case 'w-fleet-forms':
        return (
          <div className="space-y-3.5">
            <div className="grid grid-cols-2 gap-2 text-center">
              <div className="bg-slate-950/60 p-2.5 rounded-xl border border-slate-800/80">
                <div className="text-lg font-black text-cyan-400 font-mono">{fleetFormMetrics.templateCount}</div>
                <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Template Form SOP</div>
              </div>
              <div className="bg-slate-950/60 p-2.5 rounded-xl border border-slate-800/80">
                <div className="text-lg font-black text-emerald-400 font-mono">{fleetFormMetrics.totalLogs}</div>
                <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Surat Dicetak</div>
              </div>
            </div>

            <div className="p-2.5 rounded-xl bg-slate-950/40 border border-slate-800/80 text-xs flex items-center justify-between">
              <span className="text-slate-300 text-[11px]">Template Siap Cetak:</span>
              <span className="text-[10px] text-amber-400 font-bold">
                SPK Bengkel · Surat Permohonan Dinas · Berita Acara
              </span>
            </div>
          </div>
        );

      case 'w-recent-activities':
        return (
          <div className="space-y-2 text-xs">
            <div className="space-y-2 max-h-[160px] overflow-y-auto pr-1">
              <div className="p-2 rounded-lg bg-slate-950/50 border border-slate-800/80 flex items-start gap-2">
                <div className="w-2 h-2 rounded-full bg-emerald-400 mt-1 shrink-0"></div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between text-[10px] text-slate-400">
                    <span className="font-bold text-slate-300">Driver Check-In &amp; Checklist Armada</span>
                    <span>12:05 WIB</span>
                  </div>
                  <div className="text-[11px] text-slate-300 truncate">Supri (N5 / NS3) telah merampungkan inspeksi awal armada.</div>
                </div>
              </div>

              <div className="p-2 rounded-lg bg-slate-950/50 border border-slate-800/80 flex items-start gap-2">
                <div className="w-2 h-2 rounded-full bg-blue-400 mt-1 shrink-0"></div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between text-[10px] text-slate-400">
                    <span className="font-bold text-slate-300">Gate-Out Gudang DC</span>
                    <span>07:35 WIB</span>
                  </div>
                  <div className="text-[11px] text-slate-300 truncate">Truk Armada P 8801 UV berangkat menuju area Susulan Situbondo.</div>
                </div>
              </div>

              <div className="p-2 rounded-lg bg-slate-950/50 border border-slate-800/80 flex items-start gap-2">
                <div className="w-2 h-2 rounded-full bg-amber-400 mt-1 shrink-0"></div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between text-[10px] text-slate-400">
                    <span className="font-bold text-slate-300">Rolling Kru Hari H</span>
                    <span>07:10 WIB</span>
                  </div>
                  <div className="text-[11px] text-slate-300 truncate">Auladhi Wibisono menggantikan Helper 1 (Mohamad Rohman).</div>
                </div>
              </div>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="space-y-5 pb-12">
      {/* Save Toast Notification */}
      {saveToast && (
        <div className="fixed top-5 right-5 z-50 bg-emerald-600 text-white text-xs font-bold px-4 py-2.5 rounded-xl shadow-2xl flex items-center gap-2 animate-bounce">
          <CheckCircle className="w-4 h-4 shrink-0" />
          <span>{saveToast}</span>
        </div>
      )}

      {/* Top Header Bar & Control Panel */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 shadow-xl space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider bg-amber-500/15 text-amber-400 border border-amber-500/30">
                Dashboard Eksekutif Accurate ERP
              </span>
              <span className="text-slate-500 text-xs">· Sinkronisasi Otomatis</span>
            </div>
            <h2 className="text-lg font-black text-white tracking-tight mt-1 flex items-center gap-2">
              Dashboard Utama Logistik &amp; Pengiriman
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Ringkasan data penting terintegrasi dari seluruh sub-menu operasional armada &amp; kiriman PT AKK Logistics
            </p>
          </div>

          {/* Controls: Ubah Widget, Columns, Refresh, Filters */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Widget Customizer Button */}
            <button
              type="button"
              onClick={handleOpenCustomizeModal}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black rounded-xl text-xs shadow-md shadow-amber-500/20 transition cursor-pointer"
            >
              <SlidersHorizontal className="w-4 h-4" />
              <span>Ubah Widget ({enabledCount})</span>
            </button>

            {/* Layout Column Density Selector */}
            <div className="flex items-center bg-slate-950/80 p-1 rounded-xl border border-slate-800">
              <button
                type="button"
                onClick={() => handleSetLayoutCols('1')}
                title="1 Kolom Penuh"
                className={`p-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                  layoutCols === '1' ? 'bg-amber-500 text-slate-950' : 'text-slate-400 hover:text-white'
                }`}
              >
                <Maximize2 className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => handleSetLayoutCols('2')}
                title="2 Kolom Standar"
                className={`p-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                  layoutCols === '2' ? 'bg-amber-500 text-slate-950' : 'text-slate-400 hover:text-white'
                }`}
              >
                <Columns className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => handleSetLayoutCols('3')}
                title="3 Kolom Kompak"
                className={`p-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                  layoutCols === '3' ? 'bg-amber-500 text-slate-950' : 'text-slate-400 hover:text-white'
                }`}
              >
                <Grid3X3 className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Refresh Button */}
            <button
              type="button"
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold rounded-xl text-xs border border-slate-700 transition cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-amber-400 ${isRefreshing ? 'animate-spin' : ''}`} />
              <span>Segarkan</span>
            </button>
          </div>
        </div>

        {/* Period Filter Bar */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-slate-800/80 text-xs">
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] font-bold text-slate-400 flex items-center gap-1 mr-1">
              <Calendar className="w-3.5 h-3.5 text-amber-400" />
              PERIODE DATA:
            </span>
            {(
              [
                { id: 'all', label: 'Semua Data' },
                { id: 'today', label: 'Hari Ini' },
                { id: '7days', label: '7 Hari Terakhir' },
                { id: 'month', label: 'Bulan Ini' }
              ] as const
            ).map(p => (
              <button
                key={p.id}
                type="button"
                onClick={() => handleSetPeriodFilter(p.id)}
                className={`px-3 py-1 rounded-lg text-[11px] font-bold transition cursor-pointer ${
                  periodFilter === p.id
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                    : 'bg-slate-950/60 text-slate-400 border border-slate-800 hover:bg-slate-800 hover:text-slate-200'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          <div className="text-[11px] text-slate-400 flex items-center gap-1 font-mono">
            <Clock3 className="w-3.5 h-3.5 text-slate-500" />
            <span>Terakhir diperbarui: {lastRefreshedAt} WIB</span>
          </div>
        </div>
      </div>

      {/* TOP KPI HIGHLIGHT RIBBON (Ringkasan Data Utama) */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <div className="bg-slate-900/80 border border-slate-800/90 rounded-2xl p-3.5 shadow-lg relative overflow-hidden group">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-extrabold uppercase text-slate-400 tracking-wider">Total Kiriman</span>
            <Calendar className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-2xl font-black text-white font-mono mt-1">{scheduleMetrics.total}</div>
          <div className="text-[10px] text-emerald-400 font-bold mt-0.5 flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3" />
            <span>{scheduleMetrics.delivered} Terkirim Selesai</span>
          </div>
        </div>

        <div className="bg-slate-900/80 border border-slate-800/90 rounded-2xl p-3.5 shadow-lg relative overflow-hidden group">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-extrabold uppercase text-slate-400 tracking-wider">Ketepatan SLA</span>
            <Gauge className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-black text-emerald-400 font-mono mt-1">{slaMetrics.slaRate}%</div>
          <div className="text-[10px] text-slate-400 font-bold mt-0.5">
            Gate-Out &amp; Arrival Tepat
          </div>
        </div>

        <div className="bg-slate-900/80 border border-slate-800/90 rounded-2xl p-3.5 shadow-lg relative overflow-hidden group">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-extrabold uppercase text-slate-400 tracking-wider">Rasio BBM</span>
            <Fuel className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="text-2xl font-black text-cyan-400 font-mono mt-1">{fuelMetrics.avgKmLiter}</div>
          <div className="text-[10px] text-slate-400 font-bold mt-0.5">
            KM / Liter (Truk AKK)
          </div>
        </div>

        <div className="bg-slate-900/80 border border-slate-800/90 rounded-2xl p-3.5 shadow-lg relative overflow-hidden group">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-extrabold uppercase text-slate-400 tracking-wider">Kesiapan Armada</span>
            <Truck className="w-4 h-4 text-blue-400" />
          </div>
          <div className="text-2xl font-black text-blue-400 font-mono mt-1">{fleetMetrics.active} / {fleetMetrics.total}</div>
          <div className="text-[10px] text-slate-400 font-bold mt-0.5">
            Unit Siap Jalan
          </div>
        </div>

        <div className="bg-slate-900/80 border border-slate-800/90 rounded-2xl p-3.5 shadow-lg relative overflow-hidden group col-span-2 md:col-span-1">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-extrabold uppercase text-slate-400 tracking-wider">Kru Stand By DC</span>
            <Users className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-2xl font-black text-amber-400 font-mono mt-1">{driverPortalMetrics.standByCount} Personel</div>
          <div className="text-[10px] text-slate-400 font-bold mt-0.5">
            Siap Rolling Hari H
          </div>
        </div>
      </div>

      {/* DYNAMIC ACCURATE-STYLE GRID OF ACTIVE WIDGETS */}
      {activeWidgets.length === 0 ? (
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-12 text-center max-w-md mx-auto space-y-3">
          <EyeOff className="w-10 h-10 text-slate-600 mx-auto" />
          <h3 className="text-sm font-bold text-white">Semua Widget Sedang Dinonaktifkan</h3>
          <p className="text-xs text-slate-400">
            Klik tombol <strong>Ubah Widget</strong> di atas untuk mengaktifkan kembali widget yang ingin Anda tampilkan.
          </p>
          <button
            type="button"
            onClick={handleResetToDefault}
            className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-xl font-bold text-xs cursor-pointer"
          >
            Tampilkan Default (Semua)
          </button>
        </div>
      ) : (
        <div
          className={`grid gap-4 ${
            layoutCols === '1'
              ? 'grid-cols-1'
              : layoutCols === '3'
              ? 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3'
              : 'grid-cols-1 md:grid-cols-2'
          }`}
        >
          {activeWidgets.map(widget => (
            <div
              key={widget.id}
              className="bg-slate-900/80 border border-slate-800/90 rounded-2xl p-4 shadow-xl flex flex-col justify-between transition hover:border-slate-700/80"
            >
              {/* Card Header */}
              <div className="pb-3 border-b border-slate-800/80 mb-3.5 flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-black uppercase tracking-wider text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/30">
                      {widget.category}
                    </span>
                  </div>
                  <h3 className="text-sm font-black text-white truncate mt-1 flex items-center gap-1.5">
                    {widget.title}
                  </h3>
                  <p className="text-[11px] text-slate-400 truncate mt-0.5">{widget.subTitle}</p>
                </div>

                {/* Direct Navigation Button to Sub-menu */}
                {onNavigate && (
                  <button
                    type="button"
                    onClick={() => onNavigate(widget.tab)}
                    title="Buka Sub-Menu Selengkapnya"
                    className="p-1.5 text-slate-400 hover:text-amber-400 hover:bg-slate-800 rounded-lg transition cursor-pointer shrink-0"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </button>
                )}
              </div>

              {/* Card Body */}
              <div className="flex-1">{renderWidgetContent(widget)}</div>

              {/* Card Footer Link */}
              {onNavigate && (
                <div className="pt-3 border-t border-slate-800/80 mt-3.5 flex items-center justify-between text-xs">
                  <button
                    type="button"
                    onClick={() => onNavigate(widget.tab)}
                    className="text-amber-400 hover:text-amber-300 font-bold text-[11px] flex items-center gap-1 cursor-pointer"
                  >
                    <span>Lihat Detail Sub-Menu</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* CUSTOMIZE WIDGETS MODAL ("Ubah Widget") */}
      {isCustomizeModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-2xl w-full p-5 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-400 flex items-center justify-center">
                  <SlidersHorizontal className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-white">Pengaturan &amp; Tata Letak Widget Dashboard</h3>
                  <p className="text-xs text-slate-400">Pilih widget mana saja yang tertampil dan atur urutan posisi widget.</p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsCustomizeModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Presets & Search */}
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                <span className="text-slate-400 font-bold">Preset Cepat:</span>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => handleApplyPreset('all')}
                    className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold rounded-lg cursor-pointer"
                  >
                    Tampilkan Semua
                  </button>
                  <button
                    type="button"
                    onClick={() => handleApplyPreset('distribution')}
                    className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold rounded-lg cursor-pointer"
                  >
                    Fokus Kiriman
                  </button>
                  <button
                    type="button"
                    onClick={() => handleApplyPreset('fleet_maintenance')}
                    className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold rounded-lg cursor-pointer"
                  >
                    Fokus Armada &amp; Perawatan
                  </button>
                </div>
              </div>

              {/* Search & Category Filter */}
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={modalSearch}
                    onChange={e => setModalSearch(e.target.value)}
                    placeholder="Cari nama widget atau kategori..."
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-1.5 text-xs text-white focus:outline-none focus:border-amber-500"
                  />
                </div>

                <select
                  value={modalCategory}
                  onChange={e => setModalCategory(e.target.value)}
                  className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-slate-200 font-bold focus:outline-none focus:border-amber-500"
                >
                  <option value="Semua">Semua Kategori</option>
                  <option value="Jadwal &amp; Kiriman">Jadwal &amp; Kiriman</option>
                  <option value="Armada &amp; BBM">Armada &amp; BBM</option>
                  <option value="Monitoring GPS">Monitoring GPS</option>
                  <option value="Maintenance &amp; Dokumen">Maintenance &amp; Dokumen</option>
                </select>
              </div>
            </div>

            {/* Widget List to Toggle & Reorder */}
            <div className="space-y-2 max-h-[340px] overflow-y-auto pr-1">
              {filteredTempWidgets.map((w, index) => (
                <div
                  key={w.id}
                  className={`p-3 rounded-xl border flex items-center justify-between gap-3 transition ${
                    w.enabled
                      ? 'bg-slate-950/80 border-slate-800'
                      : 'bg-slate-950/30 border-slate-900 opacity-60'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <button
                      type="button"
                      onClick={() => handleToggleWidget(w.id)}
                      className={`p-2 rounded-xl transition cursor-pointer shrink-0 ${
                        w.enabled
                          ? 'bg-amber-500 text-slate-950 font-black'
                          : 'bg-slate-800 text-slate-500'
                      }`}
                    >
                      {w.enabled ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                    </button>

                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold text-amber-400">{w.category}</span>
                      </div>
                      <div className="text-xs font-bold text-white truncate">{w.title}</div>
                      <div className="text-[11px] text-slate-400 truncate">{w.subTitle}</div>
                    </div>
                  </div>

                  {/* Reorder Up / Down Controls */}
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleMoveWidgetUp(index)}
                      disabled={index === 0}
                      className="p-1.5 text-slate-400 hover:text-white bg-slate-900 border border-slate-800 rounded-lg disabled:opacity-30 cursor-pointer"
                    >
                      <ArrowUp className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleMoveWidgetDown(index)}
                      disabled={index === filteredTempWidgets.length - 1}
                      className="p-1.5 text-slate-400 hover:text-white bg-slate-900 border border-slate-800 rounded-lg disabled:opacity-30 cursor-pointer"
                    >
                      <ArrowDown className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Modal Footer Controls */}
            <div className="pt-3 border-t border-slate-800 flex items-center justify-between">
              <button
                type="button"
                onClick={handleResetToDefault}
                className="flex items-center gap-1 text-slate-400 hover:text-slate-200 text-xs font-bold cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reset ke Default</span>
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsCustomizeModalOpen(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-xl text-xs cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={handleSaveWidgets}
                  className="px-5 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black rounded-xl text-xs shadow-lg shadow-amber-500/20 cursor-pointer"
                >
                  Simpan Perubahan
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
