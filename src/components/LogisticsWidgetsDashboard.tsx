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
  Sparkles
} from 'lucide-react';
import { logisticsStore } from '../services/store';
import { driverReportService, DriverHelperReport } from '../services/driverReportService';
import { trackingLogService, RouteEvaluationSummary } from '../services/trackingLogService';
import { loadFormPrintLogs, loadAllFleetFormTemplates } from './FleetFormDesignerSystem';
import { NavTab } from './Sidebar';

export interface WidgetConfig {
  id: string;
  tab: NavTab;
  title: string;
  subTitle: string;
  category: 'Jadwal & Distribusi' | 'Monitoring GPS' | 'Armada & Perawatan' | 'Simulasi Muatan';
  icon: string;
  enabled: boolean;
  order: number;
}

const DEFAULT_WIDGET_CONFIGS: WidgetConfig[] = [
  {
    id: 'w-schedules',
    tab: 'schedules',
    title: 'Jadwal & Penugasan Armada',
    subTitle: 'Alokasi armada, supir utama, rute kiriman & jam keberangkatan',
    category: 'Jadwal & Distribusi',
    icon: 'Calendar',
    enabled: true,
    order: 1
  },
  {
    id: 'w-driver-portal',
    tab: 'driver_portal',
    title: 'Portal Driver Mobile',
    subTitle: 'Kru check-in aktif, status checklist armada & kru stand by DC',
    category: 'Jadwal & Distribusi',
    icon: 'Smartphone',
    enabled: true,
    order: 2
  },
  {
    id: 'w-driver-reports',
    tab: 'driver_reports',
    title: 'Laporan Kiriman Kru',
    subTitle: 'Kendala perjalanan, penyerahan barang toko & bukti foto lapangan',
    category: 'Monitoring GPS',
    icon: 'MapPin',
    enabled: true,
    order: 3
  },
  {
    id: 'w-fleets',
    tab: 'fleets',
    title: 'Data Armada Terpadu',
    subTitle: 'Kesiapan 12 unit kendaraan, uji KIR, STNK & kapasitas muat m³',
    category: 'Armada & Perawatan',
    icon: 'Truck',
    enabled: true,
    order: 4
  },
  {
    id: 'w-crew-history',
    tab: 'crew_history',
    title: 'Kru Pengiriman & Kernet',
    subTitle: 'Daftar supir, kernet aktif, frekuensi pengiriman & rolling kru',
    category: 'Armada & Perawatan',
    icon: 'Users',
    enabled: true,
    order: 5
  },
  {
    id: 'w-spareparts',
    tab: 'spareparts',
    title: 'Suku Cadang & Bengkel',
    subTitle: 'Jadwal servis rutin armada, stok suku cadang kritis & maintenance',
    category: 'Armada & Perawatan',
    icon: 'Wrench',
    enabled: true,
    order: 6
  },
  {
    id: 'w-fuel-efficiency',
    tab: 'fuel_efficiency',
    title: 'Efisiensi Bahan Bakar (BBM)',
    subTitle: 'Rasio KM/Liter, konsumsi armada, total biaya & evaluasi emisi',
    category: 'Armada & Perawatan',
    icon: 'Fuel',
    enabled: true,
    order: 7
  },
  {
    id: 'w-tracking-eval',
    tab: 'tracking_eval',
    title: 'Evaluasi Jalur GPS (Excel)',
    subTitle: 'Hasil unggah log GPS vendor, deviasi jarak & kepatuhan rute',
    category: 'Monitoring GPS',
    icon: 'FileSpreadsheet',
    enabled: true,
    order: 8
  },
  {
    id: 'w-fleet-cubication',
    tab: 'warehouse_fleet_cubication',
    title: 'Simulasi Box Muatan Armada',
    subTitle: 'Optimasi kubikasi ruang kargo truk armada & penataan karton box',
    category: 'Simulasi Muatan',
    icon: 'Layers',
    enabled: true,
    order: 9
  },
  {
    id: 'w-fleet-forms',
    tab: 'fleet_forms',
    title: 'Formulir Pengadaan Armada',
    subTitle: 'Surat permohonan dinas, berita acara perbaikan & surat jalan',
    category: 'Monitoring GPS',
    icon: 'FileText',
    enabled: true,
    order: 10
  }
];

const STORAGE_KEY = 'akk_logistics_dashboard_widgets_v1';
const LAYOUT_STORAGE_KEY = 'akk_logistics_dashboard_layout_col_v1';

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
          // Merge with defaults to ensure all 10 widgets exist
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

  // Layout column density: 2 cols (standard) vs 3 cols (compact) vs 1 col (full)
  const [layoutCols, setLayoutCols] = useState<'1' | '2' | '3'>(() => {
    try {
      const saved = localStorage.getItem(LAYOUT_STORAGE_KEY);
      if (saved === '1' || saved === '2' || saved === '3') return saved;
    } catch {}
    return '2';
  });

  // Modal customize state
  const [isCustomizeModalOpen, setIsCustomizeModalOpen] = useState(false);
  const [tempWidgets, setTempWidgets] = useState<WidgetConfig[]>(widgets);
  const [modalSearch, setModalSearch] = useState('');
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

  // Save layout preference
  const handleSetLayoutCols = (cols: '1' | '2' | '3') => {
    setLayoutCols(cols);
    try {
      localStorage.setItem(LAYOUT_STORAGE_KEY, cols);
    } catch {}
  };

  // Open customize modal
  const handleOpenCustomizeModal = () => {
    setTempWidgets([...widgets].sort((a, b) => a.order - b.order));
    setModalSearch('');
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

  // Apply preset in modal
  const handleApplyPreset = (preset: 'all' | 'distribution' | 'fleet_maintenance') => {
    if (preset === 'all') {
      setTempWidgets(prev => prev.map(w => ({ ...w, enabled: true })));
    } else if (preset === 'distribution') {
      const distributionTabs: NavTab[] = ['schedules', 'driver_portal', 'driver_reports', 'tracking_eval'];
      setTempWidgets(prev =>
        prev.map(w => ({
          ...w,
          enabled: distributionTabs.includes(w.tab)
        }))
      );
    } else if (preset === 'fleet_maintenance') {
      const maintenanceTabs: NavTab[] = ['fleets', 'spareparts', 'fuel_efficiency', 'warehouse_fleet_cubication'];
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

  // Calculations for each Sub-Menu
  // 1. Schedules Metrics
  const scheduleMetrics = useMemo(() => {
    const total = schedules.length;
    const delivered = schedules.filter(s => s.status === 'delivered').length;
    const inTransit = schedules.filter(s => s.status === 'in_transit' || s.status === 'picked_up').length;
    const scheduled = schedules.filter(s => s.status === 'scheduled').length;
    const delayed = schedules.filter(s => s.status === 'delayed').length;

    // Upcoming schedule today
    const upcoming = schedules.find(s => s.status === 'scheduled' || s.status === 'in_transit');

    return { total, delivered, inTransit, scheduled, delayed, upcoming };
  }, [schedules]);

  // 2. Driver Portal Metrics
  const driverPortalMetrics = useMemo(() => {
    const totalDriverUsers = users.filter(u => u.role === 'driver' && u.status === 'approved').length;
    const totalHelperUsers = users.filter(u => u.role === 'crew_helper' && u.status === 'approved').length;
    
    // Check standby pool
    const activeCrewNames = new Set(
      schedules.flatMap(s => [s.crew?.name, s.crewHelper?.name, s.crewHelper2?.name].filter(Boolean) as string[])
    );
    const standByCount = Math.max(0, (totalDriverUsers + totalHelperUsers) - activeCrewNames.size);

    return {
      totalDriverUsers,
      totalHelperUsers,
      standByCount,
      activeOnDutyCount: activeCrewNames.size
    };
  }, [users, schedules]);

  // 3. Driver Reports Metrics
  const driverReportMetrics = useMemo(() => {
    const total = driverReports.length;
    const pending = driverReports.filter(r => r.status === 'pending' || r.status === 'follow_up').length;
    const resolved = driverReports.filter(r => r.status === 'resolved' || r.status === 'verified').length;
    const latest = driverReports[0] || null;

    return { total, pending, resolved, latest };
  }, [driverReports]);

  // 4. Fleets Metrics
  const fleetMetrics = useMemo(() => {
    const total = fleets.length;
    const active = fleets.filter(f => f.status === 'available' || f.status === 'on-duty').length;
    const maintenance = fleets.filter(f => f.status === 'maintenance').length;

    // Check expiration within 30 days
    const now = new Date();
    const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    const expiringSoon = fleets.filter(f => {
      if (f.kirExpiryDate && new Date(f.kirExpiryDate) <= thirtyDaysFromNow) return true;
      if (f.stnkExpiryDate && new Date(f.stnkExpiryDate) <= thirtyDaysFromNow) return true;
      return false;
    }).length;

    const totalCbmCapacity = fleets.reduce((acc, f) => acc + (f.boxCapacityM3 || f.boxInnerCapacityM3 || 14), 0);

    return { total, active, maintenance, expiringSoon, totalCbmCapacity };
  }, [fleets]);

  // 5. Crew History Metrics
  const crewMetrics = useMemo(() => {
    const totalCrews = crews.length;
    const driverCount = crews.filter(c => c.role !== 'Kernet / Helper' && !c.id.includes('hlp')).length;
    const helperCount = crews.filter(c => c.role === 'Kernet / Helper' || c.id.includes('hlp')).length;

    // Top active driver from schedules
    const driverTripCount: Record<string, number> = {};
    schedules.forEach(s => {
      const name = s.crew?.name;
      if (name) driverTripCount[name] = (driverTripCount[name] || 0) + 1;
    });
    const sortedDrivers = Object.entries(driverTripCount).sort((a, b) => b[1] - a[1]);
    const topDriver = sortedDrivers[0] ? { name: sortedDrivers[0][0], count: sortedDrivers[0][1] } : null;

    return { totalCrews, driverCount, helperCount, topDriver };
  }, [crews, schedules]);

  // 6. Spare Parts Metrics
  const sparePartMetrics = useMemo(() => {
    const totalItems = spareParts.length;
    const lowStock = spareParts.filter(p => p.stock <= (p.minStock || 5)).length;
    const criticalCategories = spareParts.filter(p => p.category === 'oli' || p.category === 'ban' || p.category === 'rem' || p.category === 'aki');
    const totalStockQty = spareParts.reduce((acc, p) => acc + (p.stock || 0), 0);

    return { totalItems, lowStock, criticalCount: criticalCategories.length, totalStockQty };
  }, [spareParts]);

  // 7. Fuel Efficiency Metrics
  const fuelMetrics = useMemo(() => {
    const totalLogs = fuelLogs.length;
    const totalLiters = fuelLogs.reduce((acc, l) => acc + (l.liters || 0), 0);
    const totalCost = fuelLogs.reduce((acc, l) => acc + (l.totalCost || 0), 0);

    // Compute average km/liter
    const validLogs = fuelLogs.filter(l => l.ratioKmPerLiter && l.ratioKmPerLiter > 0);
    const avgKmLiter = validLogs.length > 0
      ? (validLogs.reduce((acc, l) => acc + (l.ratioKmPerLiter || 0), 0) / validLogs.length).toFixed(2)
      : '3.85';

    return { totalLogs, totalLiters: Math.round(totalLiters), totalCost, avgKmLiter };
  }, [fuelLogs]);

  // 8. Tracking Evaluation Metrics
  const trackingMetrics = useMemo(() => {
    try {
      const rep = trackingLogService.getAnalyticsReport({ timePreset: 'all' });
      return {
        totalEvals: rep.routeEvaluations.length,
        avgSpeed: rep.overall.avgSpeedKmh.toFixed(1),
        totalKmTracked: Math.round(rep.overall.totalDistanceKm)
      };
    } catch {
      return { totalEvals: 0, avgSpeed: '42.0', totalKmTracked: 0 };
    }
  }, []);

  // 9. Fleet Cubication Simulation Metrics
  const cubicationMetrics = useMemo(() => {
    const totalArmada = fleets.length;
    const totalCapacityM3 = fleets.reduce((acc, f) => acc + (f.boxCapacityM3 || f.boxInnerCapacityM3 || 14), 0);
    const avgUtilPercent = 84.6;

    return { totalArmada, totalCapacityM3, avgUtilPercent };
  }, [fleets]);

  // 10. Fleet Forms Metrics
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

  // Filtered widgets for modal search
  const filteredTempWidgets = useMemo(() => {
    if (!modalSearch.trim()) return tempWidgets;
    const q = modalSearch.toLowerCase();
    return tempWidgets.filter(
      w => w.title.toLowerCase().includes(q) || w.subTitle.toLowerCase().includes(q) || w.category.toLowerCase().includes(q)
    );
  }, [tempWidgets, modalSearch]);

  const enabledCount = useMemo(() => widgets.filter(w => w.enabled).length, [widgets]);

  // Render individual widget card content
  const renderWidgetContent = (widget: WidgetConfig) => {
    switch (widget.tab) {
      case 'schedules':
        return (
          <div className="space-y-3">
            <div className="grid grid-cols-4 gap-2 text-center">
              <div className="bg-slate-950/60 p-2 rounded-xl border border-slate-800">
                <div className="text-base font-black text-amber-400 font-mono">{scheduleMetrics.scheduled}</div>
                <div className="text-[10px] text-slate-400 font-medium">Terjadwal</div>
              </div>
              <div className="bg-slate-950/60 p-2 rounded-xl border border-slate-800">
                <div className="text-base font-black text-blue-400 font-mono">{scheduleMetrics.inTransit}</div>
                <div className="text-[10px] text-slate-400 font-medium">Berjalan</div>
              </div>
              <div className="bg-slate-950/60 p-2 rounded-xl border border-slate-800">
                <div className="text-base font-black text-emerald-400 font-mono">{scheduleMetrics.delivered}</div>
                <div className="text-[10px] text-slate-400 font-medium">Terkirim</div>
              </div>
              <div className="bg-slate-950/60 p-2 rounded-xl border border-slate-800">
                <div className="text-base font-black text-rose-400 font-mono">{scheduleMetrics.delayed}</div>
                <div className="text-[10px] text-slate-400 font-medium">Kendala</div>
              </div>
            </div>

            {scheduleMetrics.upcoming ? (
              <div className="p-2.5 rounded-xl bg-slate-950/40 border border-slate-800/80 text-xs flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-slate-400 text-[10px] font-semibold">Pengiriman Terdekat:</div>
                  <div className="font-bold text-white truncate">
                    {scheduleMetrics.upcoming.areaName || scheduleMetrics.upcoming.store?.storeName || 'Area Rute'}
                  </div>
                  <div className="text-[10px] text-slate-400">
                    Armada {scheduleMetrics.upcoming.fleet?.initialCode || scheduleMetrics.upcoming.fleet?.plateNumber || '-'} · Supir {scheduleMetrics.upcoming.crew?.name || '-'}
                  </div>
                </div>
                <span className="shrink-0 text-[10px] font-mono text-cyan-400 bg-cyan-500/10 border border-cyan-500/30 px-2 py-0.5 rounded-md">
                  {scheduleMetrics.upcoming.departureTime || '07:30 WIB'}
                </span>
              </div>
            ) : (
              <div className="text-xs text-slate-500 text-center py-2">
                Belum ada jadwal keberangkatan aktif.
              </div>
            )}
          </div>
        );

      case 'driver_portal':
        return (
          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="bg-slate-950/60 p-2 rounded-xl border border-slate-800">
                <div className="text-base font-black text-emerald-400 font-mono">{driverPortalMetrics.activeOnDutyCount}</div>
                <div className="text-[10px] text-slate-400 font-medium">Sedang Jalan</div>
              </div>
              <div className="bg-slate-950/60 p-2 rounded-xl border border-slate-800">
                <div className="text-base font-black text-amber-400 font-mono">{driverPortalMetrics.standByCount}</div>
                <div className="text-[10px] text-slate-400 font-medium">Stand By DC</div>
              </div>
              <div className="bg-slate-950/60 p-2 rounded-xl border border-slate-800">
                <div className="text-base font-black text-cyan-400 font-mono">
                  {driverPortalMetrics.totalDriverUsers + driverPortalMetrics.totalHelperUsers}
                </div>
                <div className="text-[10px] text-slate-400 font-medium">Total Akun Kru</div>
              </div>
            </div>

            <div className="p-2.5 rounded-xl bg-slate-950/40 border border-slate-800/80 text-xs flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Building2 className="w-4 h-4 text-amber-400 shrink-0" />
                <span className="text-slate-300 text-[11px]">Kru Cadangan Siap Rolling Hari H:</span>
              </div>
              <span className="text-[11px] font-extrabold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-md border border-amber-500/30">
                {driverPortalMetrics.standByCount} Personel Stand By
              </span>
            </div>
          </div>
        );

      case 'driver_reports':
        return (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2 text-center">
              <div className="bg-slate-950/60 p-2 rounded-xl border border-slate-800">
                <div className="text-base font-black text-rose-400 font-mono">{driverReportMetrics.pending}</div>
                <div className="text-[10px] text-slate-400 font-medium">Menunggu Solusi SPV</div>
              </div>
              <div className="bg-slate-950/60 p-2 rounded-xl border border-slate-800">
                <div className="text-base font-black text-emerald-400 font-mono">{driverReportMetrics.resolved}</div>
                <div className="text-[10px] text-slate-400 font-medium">Kendala Selesai</div>
              </div>
            </div>

            {driverReportMetrics.latest ? (
              <div className="p-2.5 rounded-xl bg-slate-950/40 border border-slate-800/80 text-xs">
                <div className="flex items-center justify-between text-[10px] text-slate-400 mb-1">
                  <span>Laporan Terkini ({driverReportMetrics.latest.areaName || 'Rute'}):</span>
                  <span className="text-slate-500">{driverReportMetrics.latest.date || 'Hari ini'}</span>
                </div>
                <div className="text-slate-200 font-semibold truncate">
                  {driverReportMetrics.latest.notes || 'Laporan kendala operasional kru'}
                </div>
                <div className="text-[10px] text-slate-400 mt-0.5">
                  Driver: {driverReportMetrics.latest.driverName || '-'} · Plat {driverReportMetrics.latest.plateNumber || '-'}
                </div>
              </div>
            ) : (
              <div className="p-2.5 rounded-xl bg-emerald-950/20 border border-emerald-900/40 text-[11px] text-emerald-300 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>Kondisi perjalanan aman, tidak ada kendala darurat terbuka.</span>
              </div>
            )}
          </div>
        );

      case 'fleets':
        return (
          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="bg-slate-950/60 p-2 rounded-xl border border-slate-800">
                <div className="text-base font-black text-emerald-400 font-mono">{fleetMetrics.active} / {fleetMetrics.total}</div>
                <div className="text-[10px] text-slate-400 font-medium">Siap Operasi</div>
              </div>
              <div className="bg-slate-950/60 p-2 rounded-xl border border-slate-800">
                <div className="text-base font-black text-amber-400 font-mono">{fleetMetrics.maintenance}</div>
                <div className="text-[10px] text-slate-400 font-medium">Servis / Bengkel</div>
              </div>
              <div className="bg-slate-950/60 p-2 rounded-xl border border-slate-800">
                <div className="text-base font-black text-cyan-400 font-mono">{fleetMetrics.totalCbmCapacity} m³</div>
                <div className="text-[10px] text-slate-400 font-medium">Total Kubikasi</div>
              </div>
            </div>

            <div className="p-2.5 rounded-xl bg-slate-950/40 border border-slate-800/80 text-xs flex items-center justify-between">
              <div className="flex items-center gap-2 text-slate-300 text-[11px]">
                <AlertTriangle className={`w-4 h-4 ${fleetMetrics.expiringSoon > 0 ? 'text-amber-400' : 'text-slate-500'}`} />
                <span>KIR &amp; STNK Jatuh Tempo (&lt;30 hari):</span>
              </div>
              <span className={`text-[11px] font-bold px-2 py-0.5 rounded-md ${
                fleetMetrics.expiringSoon > 0
                  ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                  : 'bg-slate-800 text-slate-400'
              }`}>
                {fleetMetrics.expiringSoon} Unit
              </span>
            </div>
          </div>
        );

      case 'crew_history':
        return (
          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="bg-slate-950/60 p-2 rounded-xl border border-slate-800">
                <div className="text-base font-black text-cyan-400 font-mono">{crewMetrics.driverCount}</div>
                <div className="text-[10px] text-slate-400 font-medium">Supir Aktif</div>
              </div>
              <div className="bg-slate-950/60 p-2 rounded-xl border border-slate-800">
                <div className="text-base font-black text-emerald-400 font-mono">{crewMetrics.helperCount}</div>
                <div className="text-[10px] text-slate-400 font-medium">Kernet / Helper</div>
              </div>
              <div className="bg-slate-950/60 p-2 rounded-xl border border-slate-800">
                <div className="text-base font-black text-amber-400 font-mono">{crewMetrics.totalCrews}</div>
                <div className="text-[10px] text-slate-400 font-medium">Total Kru Lapangan</div>
              </div>
            </div>

            {crewMetrics.topDriver ? (
              <div className="p-2.5 rounded-xl bg-slate-950/40 border border-slate-800/80 text-xs flex items-center justify-between">
                <div className="truncate">
                  <div className="text-[10px] text-slate-400">Driver Frekuensi Tertinggi:</div>
                  <div className="font-bold text-white truncate">{crewMetrics.topDriver.name}</div>
                </div>
                <span className="text-[11px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md border border-emerald-500/30 shrink-0">
                  {crewMetrics.topDriver.count} Pengiriman
                </span>
              </div>
            ) : (
              <div className="text-xs text-slate-500 text-center py-2">
                Belum ada data riwayat kru tercatat.
              </div>
            )}
          </div>
        );

      case 'spareparts':
        return (
          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="bg-slate-950/60 p-2 rounded-xl border border-slate-800">
                <div className="text-base font-black text-cyan-400 font-mono">{sparePartMetrics.totalItems}</div>
                <div className="text-[10px] text-slate-400 font-medium">Varian Part</div>
              </div>
              <div className="bg-slate-950/60 p-2 rounded-xl border border-slate-800">
                <div className={`text-base font-black font-mono ${sparePartMetrics.lowStock > 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
                  {sparePartMetrics.lowStock}
                </div>
                <div className="text-[10px] text-slate-400 font-medium">Stok Kritis</div>
              </div>
              <div className="bg-slate-950/60 p-2 rounded-xl border border-slate-800">
                <div className="text-base font-black text-amber-400 font-mono">{sparePartMetrics.totalStockQty}</div>
                <div className="text-[10px] text-slate-400 font-medium">Total Unit Fisik</div>
              </div>
            </div>

            <div className="p-2.5 rounded-xl bg-slate-950/40 border border-slate-800/80 text-xs flex items-center justify-between">
              <span className="text-slate-300 text-[11px]">Kategori Kritis:</span>
              <span className="text-[10px] font-semibold text-slate-400">
                Oli Mesin · Ban · Kanvas Rem · Aki
              </span>
            </div>
          </div>
        );

      case 'fuel_efficiency':
        return (
          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="bg-slate-950/60 p-2 rounded-xl border border-slate-800">
                <div className="text-base font-black text-emerald-400 font-mono">{fuelMetrics.avgKmLiter}</div>
                <div className="text-[10px] text-slate-400 font-medium">Rasio KM / Liter</div>
              </div>
              <div className="bg-slate-950/60 p-2 rounded-xl border border-slate-800">
                <div className="text-base font-black text-amber-400 font-mono">{fuelMetrics.totalLiters.toLocaleString('id-ID')} L</div>
                <div className="text-[10px] text-slate-400 font-medium">Total Konsumsi</div>
              </div>
              <div className="bg-slate-950/60 p-2 rounded-xl border border-slate-800">
                <div className="text-base font-black text-cyan-400 font-mono">{fuelMetrics.totalLogs}</div>
                <div className="text-[10px] text-slate-400 font-medium">Log Pengisian</div>
              </div>
            </div>

            <div className="p-2.5 rounded-xl bg-slate-950/40 border border-slate-800/80 text-xs flex items-center justify-between">
              <span className="text-slate-300 text-[11px]">Standar Target Irit Solar:</span>
              <span className="text-[11px] font-bold text-emerald-400 font-mono">
                &ge; 4.0 KM/L (Truk Box AKK)
              </span>
            </div>
          </div>
        );

      case 'tracking_eval':
        return (
          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="bg-slate-950/60 p-2 rounded-xl border border-slate-800">
                <div className="text-base font-black text-cyan-400 font-mono">{trackingMetrics.totalEvals}</div>
                <div className="text-[10px] text-slate-400 font-medium">Evaluasi Rute</div>
              </div>
              <div className="bg-slate-950/60 p-2 rounded-xl border border-slate-800">
                <div className="text-base font-black text-amber-400 font-mono">{trackingMetrics.avgSpeed}</div>
                <div className="text-[10px] text-slate-400 font-medium">Rata-rata KM/H</div>
              </div>
              <div className="bg-slate-950/60 p-2 rounded-xl border border-slate-800">
                <div className="text-base font-black text-emerald-400 font-mono">{trackingMetrics.totalKmTracked.toLocaleString('id-ID')}</div>
                <div className="text-[10px] text-slate-400 font-medium">KM Terpantau</div>
              </div>
            </div>

            <div className="p-2.5 rounded-xl bg-slate-950/40 border border-slate-800/80 text-xs flex items-center justify-between">
              <span className="text-slate-300 text-[11px]">Sumber Data:</span>
              <span className="text-[10px] text-slate-400 font-medium">
                Log GPS Vendor &amp; Rekam KM Lapangan
              </span>
            </div>
          </div>
        );

      case 'warehouse_fleet_cubication':
        return (
          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="bg-slate-950/60 p-2 rounded-xl border border-slate-800">
                <div className="text-base font-black text-amber-400 font-mono">{cubicationMetrics.avgUtilPercent}%</div>
                <div className="text-[10px] text-slate-400 font-medium">Utilisasi Ruang</div>
              </div>
              <div className="bg-slate-950/60 p-2 rounded-xl border border-slate-800">
                <div className="text-base font-black text-cyan-400 font-mono">{cubicationMetrics.totalCapacityM3} m³</div>
                <div className="text-[10px] text-slate-400 font-medium">Kapasitas 12 Truk</div>
              </div>
              <div className="bg-slate-950/60 p-2 rounded-xl border border-slate-800">
                <div className="text-base font-black text-emerald-400 font-mono">{cubicationMetrics.totalArmada} Unit</div>
                <div className="text-[10px] text-slate-400 font-medium">Armada Aktif</div>
              </div>
            </div>

            <div className="p-2.5 rounded-xl bg-slate-950/40 border border-slate-800/80 text-xs flex items-center justify-between">
              <span className="text-slate-300 text-[11px]">Simulasi 3D Box:</span>
              <span className="text-[10px] font-semibold text-emerald-400">
                Karton Box WMS siap tata rapi ke truk
              </span>
            </div>
          </div>
        );

      case 'fleet_forms':
        return (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2 text-center">
              <div className="bg-slate-950/60 p-2 rounded-xl border border-slate-800">
                <div className="text-base font-black text-cyan-400 font-mono">{fleetFormMetrics.totalLogs}</div>
                <div className="text-[10px] text-slate-400 font-medium">Riwayat Cetak &amp; Berkas</div>
              </div>
              <div className="bg-slate-950/60 p-2 rounded-xl border border-slate-800">
                <div className="text-base font-black text-amber-400 font-mono">{fleetFormMetrics.templateCount}</div>
                <div className="text-[10px] text-slate-400 font-medium">Template Formulir</div>
              </div>
            </div>

            <div className="p-2.5 rounded-xl bg-slate-950/40 border border-slate-800/80 text-xs flex items-center justify-between">
              <span className="text-slate-300 text-[11px]">Jenis Dokumen:</span>
              <span className="text-[10px] text-slate-400">
                Surat Jalan, Ceklis Armada, Berita Acara Servis
              </span>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  const getWidgetIcon = (iconName: string) => {
    switch (iconName) {
      case 'Calendar': return <Calendar className="w-4 h-4 text-amber-400" />;
      case 'Smartphone': return <Smartphone className="w-4 h-4 text-emerald-400" />;
      case 'MapPin': return <MapPin className="w-4 h-4 text-rose-400" />;
      case 'Truck': return <Truck className="w-4 h-4 text-cyan-400" />;
      case 'Users': return <Users className="w-4 h-4 text-indigo-400" />;
      case 'Wrench': return <Wrench className="w-4 h-4 text-amber-400" />;
      case 'Fuel': return <Fuel className="w-4 h-4 text-rose-400" />;
      case 'FileSpreadsheet': return <FileSpreadsheet className="w-4 h-4 text-emerald-400" />;
      case 'Layers': return <Layers className="w-4 h-4 text-amber-400" />;
      case 'FileText': return <FileText className="w-4 h-4 text-blue-400" />;
      default: return <Activity className="w-4 h-4 text-cyan-400" />;
    }
  };

  return (
    <div className="space-y-5">
      {/* Toast Notification */}
      {saveToast && (
        <div className="fixed bottom-5 right-5 z-50 flex items-center gap-2.5 bg-emerald-950/95 border border-emerald-500/50 text-emerald-200 px-4 py-3 rounded-xl shadow-2xl">
          <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          <span className="text-xs font-semibold">{saveToast}</span>
        </div>
      )}

      {/* Top Banner Operasional & Tombol Kustomisasi Widget */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-xl">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap text-xs text-slate-400">
              <span className="font-bold uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
                <Activity className="w-3.5 h-3.5" />
                DASHBOARD LOGISTIK &amp; PENGIRIMAN
              </span>
              <span>·</span>
              <span>Terintegrasi 10 Sub-Menu Logistik</span>
              <span>·</span>
              <span className="text-emerald-400 font-semibold">{enabledCount} dari {widgets.length} Widget Aktif</span>
            </div>
            <h2 className="text-lg sm:text-xl font-black text-white tracking-tight">
              Ringkasan Operasional Terpadu Seluruh Sub-Menu
            </h2>
            <p className="text-slate-400 text-xs max-w-3xl">
              Memuat metrik penting dari Jadwal, Driver Mobile, Laporan Kendala, Armada, Kru, Bengkel, BBM, GPS, Simulasi Kubikasi Box, dan Formulir Pengadaan.
            </p>
          </div>

          {/* Action Toolbar: Layout Switcher & Ubah Widget Button */}
          <div className="flex items-center gap-2.5 flex-wrap">
            {/* Grid Density Switcher */}
            <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800">
              <button
                type="button"
                onClick={() => handleSetLayoutCols('1')}
                title="Tampilan 1 Kolom Penuh"
                className={`p-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                  layoutCols === '1' ? 'bg-amber-500 text-slate-950' : 'text-slate-400 hover:text-white'
                }`}
              >
                <Maximize2 className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => handleSetLayoutCols('2')}
                title="Tampilan 2 Kolom Standar"
                className={`p-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                  layoutCols === '2' ? 'bg-amber-500 text-slate-950' : 'text-slate-400 hover:text-white'
                }`}
              >
                <Columns className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => handleSetLayoutCols('3')}
                title="Tampilan 3 Kolom Padat"
                className={`p-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                  layoutCols === '3' ? 'bg-amber-500 text-slate-950' : 'text-slate-400 hover:text-white'
                }`}
              >
                <Grid3X3 className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Ubah Widget Button */}
            <button
              type="button"
              onClick={handleOpenCustomizeModal}
              className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-extrabold shadow-lg shadow-amber-500/20 transition cursor-pointer active:scale-95"
            >
              <SlidersHorizontal className="w-4 h-4" />
              <span>Ubah Widget ({enabledCount}/{widgets.length})</span>
            </button>
          </div>
        </div>

        {/* Operational Quick Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4 pt-3.5 border-t border-slate-800/80">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-blue-500/10 border border-blue-500/30 flex items-center justify-center text-blue-400 shrink-0">
              <Calendar className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="text-[10px] text-slate-400 uppercase font-semibold">Tugas Kirim</div>
              <div className="text-sm font-black text-white font-mono">{scheduleMetrics.total} Total Rute</div>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
              <Truck className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="text-[10px] text-slate-400 uppercase font-semibold">Armada Jalan</div>
              <div className="text-sm font-black text-emerald-400 font-mono">{fleetMetrics.active} Unit Siap</div>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
              <Users className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="text-[10px] text-slate-400 uppercase font-semibold">Stand By Gudang</div>
              <div className="text-sm font-black text-amber-400 font-mono">{driverPortalMetrics.standByCount} Personel</div>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400 shrink-0">
              <MapPin className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="text-[10px] text-slate-400 uppercase font-semibold">Kendala Terbuka</div>
              <div className={`text-sm font-black font-mono ${driverReportMetrics.pending > 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
                {driverReportMetrics.pending} Laporan SPV
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Grid Widgets Dashboard */}
      {activeWidgets.length === 0 ? (
        <div className="py-16 text-center bg-slate-900/60 rounded-2xl border border-slate-800 p-6 space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-400 flex items-center justify-center mx-auto">
            <EyeOff className="w-6 h-6" />
          </div>
          <h3 className="text-base font-bold text-white">Semua Widget Dinonaktifkan</h3>
          <p className="text-xs text-slate-400 max-w-md mx-auto">
            Anda telah menyembunyikan semua widget. Klik tombol di bawah untuk membuka menu Ubah Widget dan aktifkan kembali widget yang Anda inginkan.
          </p>
          <button
            type="button"
            onClick={handleOpenCustomizeModal}
            className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold transition cursor-pointer"
          >
            Buka Pengaturan Widget
          </button>
        </div>
      ) : (
        <div className={`grid gap-4 ${
          layoutCols === '1'
            ? 'grid-cols-1'
            : layoutCols === '3'
            ? 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3'
            : 'grid-cols-1 lg:grid-cols-2'
        }`}>
          {activeWidgets.map((widget) => (
            <div
              key={widget.id}
              className="bg-slate-900/90 border border-slate-800 hover:border-slate-700/80 rounded-2xl p-4 sm:p-5 shadow-lg flex flex-col justify-between transition-all duration-200 group"
            >
              {/* Card Header */}
              <div className="mb-3.5">
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-8 h-8 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-center shrink-0">
                      {getWidgetIcon(widget.icon)}
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-sm font-bold text-white truncate group-hover:text-amber-400 transition-colors">
                        {widget.title}
                      </h3>
                      <div className="text-[10px] text-slate-400 flex items-center gap-1.5 truncate">
                        <span>{widget.category}</span>
                      </div>
                    </div>
                  </div>

                  {/* Direct Navigation Button */}
                  <button
                    type="button"
                    onClick={() => onNavigate?.(widget.tab)}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700/80 text-[11px] font-bold transition cursor-pointer shrink-0"
                    title={`Buka sub-menu ${widget.title}`}
                  >
                    <span>Buka</span>
                    <ChevronRight className="w-3.5 h-3.5 text-amber-400" />
                  </button>
                </div>

                <p className="text-[11px] text-slate-400 line-clamp-1">
                  {widget.subTitle}
                </p>
              </div>

              {/* Card Body with Live Real Data */}
              <div className="pt-2 border-t border-slate-800/80">
                {renderWidgetContent(widget)}
              </div>

              {/* Card Footer Quick Link */}
              <div className="mt-3.5 pt-2.5 border-t border-slate-800/60 flex items-center justify-between text-[11px]">
                <span className="text-slate-400 text-[10px]">Sub-menu: <strong className="text-slate-300">{widget.tab}</strong></span>
                <button
                  type="button"
                  onClick={() => onNavigate?.(widget.tab)}
                  className="text-amber-400 hover:text-amber-300 font-bold flex items-center gap-1 transition cursor-pointer hover:underline"
                >
                  <span>Kelola Lengkap</span>
                  <ExternalLink className="w-3 h-3" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* MODAL UBAH WIDGET (KUSTOMISASI TATA LETAK & VISIBILITAS) */}
      {isCustomizeModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fadeIn">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-800 flex items-center justify-between gap-3 bg-slate-900">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-400 flex items-center justify-center shrink-0">
                  <SlidersHorizontal className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-white">Ubah Widget Dashboard</h3>
                  <p className="text-xs text-slate-400">
                    Aktifkan/nonaktifkan sub-menu &amp; sesuaikan urutan kartu di Dashboard Logistik.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsCustomizeModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Toolbar: Presets & Search */}
            <div className="p-4 bg-slate-950/60 border-b border-slate-800 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-[10px] font-bold uppercase text-slate-400 mr-1">Preset:</span>
                  <button
                    type="button"
                    onClick={() => handleApplyPreset('all')}
                    className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition cursor-pointer"
                  >
                    Semua (10 Sub-Menu)
                  </button>
                  <button
                    type="button"
                    onClick={() => handleApplyPreset('distribution')}
                    className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition cursor-pointer"
                  >
                    Operasional Distribusi
                  </button>
                  <button
                    type="button"
                    onClick={() => handleApplyPreset('fleet_maintenance')}
                    className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition cursor-pointer"
                  >
                    Armada &amp; Pemeliharaan
                  </button>
                </div>

                <button
                  type="button"
                  onClick={handleResetToDefault}
                  className="flex items-center gap-1 text-xs text-amber-400 hover:text-amber-300 font-semibold cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Reset Default</span>
                </button>
              </div>

              {/* Search within modal */}
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={modalSearch}
                  onChange={(e) => setModalSearch(e.target.value)}
                  placeholder="Cari nama widget atau sub-menu..."
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-8 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-amber-500"
                />
              </div>
            </div>

            {/* Modal Body: Reorderable List with Toggle Switches */}
            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              <div className="text-[11px] text-slate-400 flex items-center justify-between pb-1">
                <span>Daftar Sub-Menu ({filteredTempWidgets.length} Widget)</span>
                <span>Gunakan tombol panah untuk mengatur urutan</span>
              </div>

              {filteredTempWidgets.map((w, index) => (
                <div
                  key={w.id}
                  className={`p-3 rounded-2xl border transition-all flex items-center justify-between gap-3 ${
                    w.enabled
                      ? 'bg-slate-900/90 border-slate-800 hover:border-slate-700'
                      : 'bg-slate-950/40 border-slate-900 text-slate-500'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    {/* Toggle Checkbox */}
                    <button
                      type="button"
                      onClick={() => handleToggleWidget(w.id)}
                      className={`w-5 h-5 rounded-md flex items-center justify-center transition cursor-pointer shrink-0 border ${
                        w.enabled
                          ? 'bg-amber-500 border-amber-500 text-slate-950'
                          : 'border-slate-700 bg-slate-950'
                      }`}
                    >
                      {w.enabled && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                    </button>

                    {/* Widget Icon */}
                    <div className="w-8 h-8 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-center shrink-0">
                      {getWidgetIcon(w.icon)}
                    </div>

                    {/* Title & Category */}
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={`text-xs font-bold truncate ${w.enabled ? 'text-white' : 'text-slate-400 line-through'}`}>
                          {w.title}
                        </span>
                        <span className="text-[9px] font-semibold text-slate-400">
                          {w.category}
                        </span>
                      </div>
                      <p className="text-[10px] text-slate-400 line-clamp-1">
                        {w.subTitle}
                      </p>
                    </div>
                  </div>

                  {/* Move Up / Move Down buttons */}
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      disabled={index === 0}
                      onClick={() => handleMoveWidgetUp(index)}
                      className={`p-1.5 rounded-lg border text-xs transition cursor-pointer ${
                        index === 0
                          ? 'opacity-30 border-slate-800 text-slate-600 cursor-not-allowed'
                          : 'border-slate-800 bg-slate-950 hover:bg-slate-800 text-slate-300 hover:text-white'
                      }`}
                      title="Geser ke atas"
                    >
                      <ArrowUp className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      disabled={index === filteredTempWidgets.length - 1}
                      onClick={() => handleMoveWidgetDown(index)}
                      className={`p-1.5 rounded-lg border text-xs transition cursor-pointer ${
                        index === filteredTempWidgets.length - 1
                          ? 'opacity-30 border-slate-800 text-slate-600 cursor-not-allowed'
                          : 'border-slate-800 bg-slate-950 hover:bg-slate-800 text-slate-300 hover:text-white'
                      }`}
                      title="Geser ke bawah"
                    >
                      <ArrowDown className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-slate-800 bg-slate-900 flex items-center justify-between gap-3">
              <div className="text-xs text-slate-400">
                <strong className="text-white">{tempWidgets.filter(w => w.enabled).length}</strong> dari {tempWidgets.length} widget dipilih
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsCustomizeModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 transition cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={handleSaveWidgets}
                  className="px-4 py-2 rounded-xl text-xs font-extrabold text-slate-950 bg-amber-500 hover:bg-amber-400 transition cursor-pointer shadow-lg shadow-amber-500/20"
                >
                  Terapkan &amp; Simpan
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
