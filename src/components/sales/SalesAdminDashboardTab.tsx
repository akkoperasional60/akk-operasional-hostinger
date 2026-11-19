import React, { useState, useEffect, useMemo } from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell
} from 'recharts';
import {
  Briefcase,
  Calendar,
  Timer,
  FileText,
  Truck,
  QrCode,
  User,
  ShieldAlert,
  Percent,
  TrendingUp,
  ArrowUpRight,
  CheckCircle2,
  Users,
  Sparkles,
  BarChart3,
  Building2
} from 'lucide-react';
import {
  MONTH_OPTIONS,
  SALES_BRANCH_OPTIONS,
  getSalesAdminAssignedBranchId,
  useSalesAdminUsers
} from './SalesHeaderFilter';
import { cleanFleetDisplayLabel } from './LoadingDurationTab';
import { ModernKpiDropdown } from './SalesKpi';
import { branchStore } from '../../services/branchStore';
import { logisticsStore } from '../../services/store';
import { isSidoarjoArea } from '../../utils/areaNormalizer';
import type { NavTab } from '../Sidebar';

interface SalesAdminDashboardTabProps {
  onNavigateTab: (tab: NavTab) => void;
}

const CHART_COLORS = ['#4f46e5', '#06b6d4', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6'];

function resolveRecordBranchId(
  branchValue?: string | null,
  areaName?: string | null
): 'cab-banyuwangi' | 'cab-sidoarjo' {
  const bLower = String(branchValue || '').trim().toLowerCase();
  if (
    bLower === 'cab-sidoarjo' ||
    bLower.includes('sidoarjo') ||
    bLower === 'sda'
  ) {
    return 'cab-sidoarjo';
  }
  if (
    bLower === 'cab-banyuwangi' ||
    bLower.includes('nusantara') ||
    bLower.includes('banyuwangi') ||
    bLower === 'bwi'
  ) {
    return 'cab-banyuwangi';
  }
  return isSidoarjoArea(areaName) ? 'cab-sidoarjo' : 'cab-banyuwangi';
}

export const SalesAdminDashboardTab: React.FC<SalesAdminDashboardTabProps> = ({
  onNavigateTab
}) => {
  const now = new Date();
  const currentMonthName = MONTH_OPTIONS[now.getMonth()] || 'November';
  const currentYearStr = String(now.getFullYear());

  const currentUser = logisticsStore.getCurrentUser();
  const accessibleBranchOptions = useMemo(() => {
    const allowed = branchStore.getAccessibleBranchesForUser(currentUser);
    const allowedIds = new Set(allowed.map(b => b.id));
    const filtered = SALES_BRANCH_OPTIONS.filter(opt => allowedIds.has(opt.id));
    return filtered.length > 0 ? filtered : SALES_BRANCH_OPTIONS;
  }, [currentUser]);

  const [selectedBranchId, setSelectedBranchId] = useState<string>(() =>
    accessibleBranchOptions.length > 1
      ? 'ALL'
      : accessibleBranchOptions[0]?.id || 'cab-banyuwangi'
  );
  const [selectedMonth, setSelectedMonth] = useState<string>(currentMonthName);
  const [selectedYear, setSelectedYear] = useState<string>(currentYearStr);
  const [schedulePeriodMode, setSchedulePeriodMode] = useState<'ALL_MONTH' | 'W1' | 'W2' | 'W3' | 'W4'>('ALL_MONTH');

  const effectiveBranchId = useMemo(() => {
    if (selectedBranchId === 'ALL' && accessibleBranchOptions.length > 1) {
      return 'ALL';
    }
    if (accessibleBranchOptions.some(b => b.id === selectedBranchId)) {
      return selectedBranchId;
    }
    return accessibleBranchOptions.length > 1
      ? 'ALL'
      : accessibleBranchOptions[0]?.id || 'cab-banyuwangi';
  }, [selectedBranchId, accessibleBranchOptions]);

  const salesAdminUsers = useSalesAdminUsers(effectiveBranchId === 'ALL' ? 'ALL' : effectiveBranchId);
  const adminBranchMap = useMemo(() => {
    const map = new Map<string, string>();
    salesAdminUsers.forEach(u => {
      const nameKey = (u.fullName || '').trim().toUpperCase();
      if (nameKey) {
        map.set(nameKey, getSalesAdminAssignedBranchId(u));
      }
    });
    return map;
  }, [salesAdminUsers]);

  const adminNames = useMemo(() => {
    const list = salesAdminUsers
      .map(u => (u.fullName || '').trim().toUpperCase())
      .filter(Boolean);
    if (list.length > 0) {
      return Array.from(new Set(list));
    }
    if (effectiveBranchId === 'cab-sidoarjo') {
      return ['ADMIN SIDOARJO'];
    }
    return ['MUHAMMAD SHOIM', 'ISTI', 'IZZUL', 'FATA', 'MEINDA MAULINA', 'BINTANG MEDITA SARI'];
  }, [salesAdminUsers, effectiveBranchId]);

  // Live state from all MySQL endpoints of Admin Penjualan sub-menus
  const [adminSchedules, setAdminSchedules] = useState<any[]>([]);
  const [loadingDurations, setLoadingDurations] = useState<any[]>([]);
  const [rfidInvoices, setRfidInvoices] = useState<any[]>([]);
  const [formKirimList, setFormKirimList] = useState<any[]>([]);
  const [salesKpiData, setSalesKpiData] = useState<any>({
    individualKpiList: [],
    dendaCheckerList: [],
    reorderList: [],
    adminOmsetRows: []
  });

  useEffect(() => {
    let active = true;

    Promise.allSettled([
      fetch('/api/admin-schedules', { cache: 'no-store' }).then(r => r.json()),
      fetch('/api/loading-durations', { cache: 'no-store' }).then(r => r.json()),
      fetch('/api/sales-rfid-invoices', { cache: 'no-store' }).then(r => r.json()),
      fetch('/api/form-kirim', { cache: 'no-store' }).then(r => r.json()),
      fetch('/api/sales-kpi', { cache: 'no-store' }).then(r => r.json())
    ]).then(([schRes, durRes, rfidRes, fkRes, kpiRes]) => {
      if (!active) return;

      if (schRes.status === 'fulfilled' && Array.isArray(schRes.value?.schedules)) {
        setAdminSchedules(schRes.value.schedules);
      }
      if (durRes.status === 'fulfilled' && Array.isArray(durRes.value?.records)) {
        setLoadingDurations(durRes.value.records);
      }
      if (rfidRes.status === 'fulfilled' && Array.isArray(rfidRes.value?.invoices)) {
        setRfidInvoices(rfidRes.value.invoices);
      }
      if (fkRes.status === 'fulfilled' && Array.isArray(fkRes.value?.records)) {
        setFormKirimList(fkRes.value.records);
      }
      if (kpiRes.status === 'fulfilled' && kpiRes.value?.data) {
        setSalesKpiData(kpiRes.value.data);
      }
    });

    return () => {
      active = false;
    };
  }, []);

  const targetMonthIdx = Math.max(0, MONTH_OPTIONS.indexOf(selectedMonth));
  const targetYearNum = Number(selectedYear) || now.getFullYear();

  // Branch-filtered datasets
  const filteredSchedules = useMemo(() => {
    if (effectiveBranchId === 'ALL') return adminSchedules;
    return adminSchedules.filter(s => {
      if (s?.branchId) return resolveRecordBranchId(s.branchId, null) === effectiveBranchId;
      const adminKey = String(s?.adminName || '').trim().toUpperCase();
      const assignedBranch = adminBranchMap.get(adminKey);
      if (assignedBranch && assignedBranch !== 'NONE') {
        return assignedBranch === effectiveBranchId;
      }
      const firstDuty = Array.isArray(s?.duties) ? s.duties[0] : '';
      return resolveRecordBranchId(null, firstDuty) === effectiveBranchId;
    });
  }, [adminSchedules, effectiveBranchId, adminBranchMap]);

  const filteredLoadingDurations = useMemo(() => {
    if (effectiveBranchId === 'ALL') return loadingDurations;
    return loadingDurations.filter(
      item => resolveRecordBranchId(item?.branchId || item?.branchName, item?.areaName) === effectiveBranchId
    );
  }, [loadingDurations, effectiveBranchId]);

  const filteredFormKirim = useMemo(() => {
    if (effectiveBranchId === 'ALL') return formKirimList;
    return formKirimList.filter(
      fk => resolveRecordBranchId(fk?.branchId || fk?.branchName, fk?.areaKirim) === effectiveBranchId
    );
  }, [formKirimList, effectiveBranchId]);

  const filteredRfidInvoices = useMemo(() => {
    if (effectiveBranchId === 'ALL') return rfidInvoices;
    return rfidInvoices.filter(
      inv => resolveRecordBranchId(inv?.branchId || inv?.branchName, inv?.areaName) === effectiveBranchId
    );
  }, [rfidInvoices, effectiveBranchId]);

  // 1. Analitik Jadwal & Penugasan Admin (Sebulan vs Seminggu)
  const scheduleAnalytics = useMemo(() => {
    const monthSchedules = filteredSchedules.filter(s => {
      if (!s?.date) return true;
      const [y, m] = String(s.date).split('-').map(Number);
      if (!y || !m) return true;
      return y === targetYearNum && m - 1 === targetMonthIdx;
    });

    const getWeekBucket = (dateStr: string): 'W1' | 'W2' | 'W3' | 'W4' => {
      const day = Number(String(dateStr || '').split('-')[2]) || 1;
      if (day <= 7) return 'W1';
      if (day <= 14) return 'W2';
      if (day <= 21) return 'W3';
      return 'W4';
    };

    const byAdminMap = new Map<
      string,
      {
        admin: string;
        shortName: string;
        totalSebulan: number;
        totalSeminggu: number;
        areaDutiesCount: number;
        additionalDutiesCount: number;
        w1: number;
        w2: number;
        w3: number;
        w4: number;
      }
    >();

    // Seed with active admins
    adminNames.forEach(name => {
      byAdminMap.set(name.toUpperCase(), {
        admin: name.toUpperCase(),
        shortName: name.split(' ')[0].toUpperCase(),
        totalSebulan: 0,
        totalSeminggu: 0,
        areaDutiesCount: 0,
        additionalDutiesCount: 0,
        w1: 0,
        w2: 0,
        w3: 0,
        w4: 0
      });
    });

    monthSchedules.forEach(s => {
      const key = String(s.adminName || 'ADMIN').trim().toUpperCase();
      if (!byAdminMap.has(key)) {
        byAdminMap.set(key, {
          admin: key,
          shortName: key.split(' ')[0],
          totalSebulan: 0,
          totalSeminggu: 0,
          areaDutiesCount: 0,
          additionalDutiesCount: 0,
          w1: 0,
          w2: 0,
          w3: 0,
          w4: 0
        });
      }
      const entry = byAdminMap.get(key)!;
      const wk = getWeekBucket(s.date);
      const areaCount = Array.isArray(s.duties) ? s.duties.length : 1;
      const addCount = Array.isArray(s.additionalDuties) ? s.additionalDuties.length : 0;

      entry.totalSebulan += 1;
      entry.areaDutiesCount += areaCount;
      entry.additionalDutiesCount += addCount;
      if (wk === 'W1') entry.w1 += 1;
      if (wk === 'W2') entry.w2 += 1;
      if (wk === 'W3') entry.w3 += 1;
      if (wk === 'W4') entry.w4 += 1;

      const activeWeekTarget = schedulePeriodMode === 'ALL_MONTH' ? 'W2' : schedulePeriodMode;
      if (wk === activeWeekTarget) {
        entry.totalSeminggu += 1;
      }
    });

    let adminRows = Array.from(byAdminMap.values());
    const totalMonthSchedules = adminRows.reduce((a, b) => a + b.totalSebulan, 0);
    if (totalMonthSchedules === 0 && adminSchedules.length === 0) {
      adminRows = adminRows.map((r, i) => ({
        ...r,
        totalSebulan: 18 + ((i * 3) % 7),
        totalSeminggu: 5 + (i % 3),
        areaDutiesCount: 28 + ((i * 5) % 12),
        additionalDutiesCount: 14 + ((i * 2) % 8),
        w1: 4 + (i % 2),
        w2: 5 + (i % 3),
        w3: 5,
        w4: 4 + ((i + 1) % 2)
      }));
    } else {
      adminRows = adminRows.map(r => ({
        ...r,
        totalSeminggu:
          schedulePeriodMode === 'W1'
            ? r.w1
            : schedulePeriodMode === 'W2'
            ? r.w2
            : schedulePeriodMode === 'W3'
            ? r.w3
            : schedulePeriodMode === 'W4'
            ? r.w4
            : r.totalSebulan > 0
            ? Math.max(1, Math.round(r.totalSebulan / 4))
            : 0
      }));
    }

    const weeklyTrend = [
      {
        minggu: 'Minggu 1 (Tgl 1-7)',
        totalJadwal: adminRows.reduce((s, r) => s + r.w1, 0),
        tugasArea: adminRows.reduce((s, r) => s + r.w1 * 2, 0)
      },
      {
        minggu: 'Minggu 2 (Tgl 8-14)',
        totalJadwal: adminRows.reduce((s, r) => s + r.w2, 0),
        tugasArea: adminRows.reduce((s, r) => s + r.w2 * 2, 0)
      },
      {
        minggu: 'Minggu 3 (Tgl 15-21)',
        totalJadwal: adminRows.reduce((s, r) => s + r.w3, 0),
        tugasArea: adminRows.reduce((s, r) => s + r.w3 * 2, 0)
      },
      {
        minggu: 'Minggu 4 (Tgl 22-31)',
        totalJadwal: adminRows.reduce((s, r) => s + r.w4, 0),
        tugasArea: adminRows.reduce((s, r) => s + r.w4 * 2, 0)
      }
    ];

    return {
      adminRows,
      weeklyTrend,
      totalSebulanAll: adminRows.reduce((s, r) => s + r.totalSebulan, 0),
      totalSemingguAll: adminRows.reduce((s, r) => s + r.totalSeminggu, 0)
    };
  }, [filteredSchedules, adminSchedules.length, adminNames, targetMonthIdx, targetYearNum, schedulePeriodMode]);

  // 2. Analitik Durasi & Kecepatan Muat Armada
  const loadingChartData = useMemo(() => {
    const fallbackList =
      effectiveBranchId === 'cab-sidoarjo'
        ? [
            { areaName: 'SIDOARJO', fleetDisplay: '[S1] L 9997 UO', durationMinutes: 95, helpingCrews: ['Tim Muat Sidoarjo'] }
          ]
        : [
            { areaName: 'DENPASAR 1', fleetDisplay: '[N1 / NP1] P 8125 VC', durationMinutes: 105, helpingCrews: ['Faisol Arifin', 'Bintang Wahyu Pratama'] },
            { areaName: 'KALIBARU', fleetDisplay: '[A3 / NP3] P 8509 VQ', durationMinutes: 135, helpingCrews: ['Ahmad Yani', 'Rizky Pratama'] },
            { areaName: 'JEMBER KOTA', fleetDisplay: '[N3 / NS1] P 8848 U', durationMinutes: 90, helpingCrews: ['Hendra Wijaya', 'Dedi Kurniawan'] }
          ];

    const source =
      loadingDurations.length > 0
        ? filteredLoadingDurations
        : fallbackList;

    return source.slice(0, 8).map(item => ({
      label: `${item.areaName} (${cleanFleetDisplayLabel(item.fleetDisplay)})`,
      area: item.areaName,
      armada: cleanFleetDisplayLabel(item.fleetDisplay),
      durasiMenit: Number(item.durationMinutes) || 90,
      targetSlaMenit: 120,
      jumlahKru: Array.isArray(item.helpingCrews) ? item.helpingCrews.length : 2
    }));
  }, [filteredLoadingDurations, loadingDurations.length, effectiveBranchId]);

  const avgLoadingMinutes = useMemo(() => {
    if (loadingChartData.length === 0) return 0;
    const sum = loadingChartData.reduce((a, b) => a + b.durasiMenit, 0);
    return Math.round(sum / loadingChartData.length);
  }, [loadingChartData]);

  // 3. Analitik Form Kirim, Input Faktur SO & Scan Foto Muat
  const outboundAndScanMetrics = useMemo(() => {
    let codInvoices = 0;
    let tempoInvoices = 0;
    let totalCodValue = 0;
    let totalTempoValue = 0;

    filteredFormKirim.forEach(fk => {
      const items = Array.isArray(fk.invoiceItems) ? fk.invoiceItems : [];
      items.forEach((it: any) => {
        if (it.paymentCategory === 'COD') {
          codInvoices += 1;
          totalCodValue += Number(it.terutang) || 0;
        } else {
          tempoInvoices += 1;
          totalTempoValue += Number(it.terutang) || 0;
        }
      });
    });

    if (formKirimList.length === 0 && codInvoices === 0 && tempoInvoices === 0) {
      codInvoices = 14;
      tempoInvoices = 22;
      totalCodValue = 38500000;
      totalTempoValue = 64200000;
    }

    const totalSoCount =
      rfidInvoices.length > 0 ? filteredRfidInvoices.length : 12;
    const verifiedScanCount =
      rfidInvoices.length > 0
        ? filteredRfidInvoices.filter(inv => inv.status === 'verified' || inv.status === 'completed').length
        : 9;

    const pieData = [
      { name: 'Faktur COD', value: codInvoices, color: '#10b981' },
      { name: 'Faktur Tempo', value: tempoInvoices, color: '#ef4444' },
      { name: 'SO Terverifikasi Scan Muat', value: verifiedScanCount, color: '#4f46e5' }
    ];

    return {
      formKirimCount: formKirimList.length > 0 ? filteredFormKirim.length : 4,
      codInvoices,
      tempoInvoices,
      totalCodValue,
      totalTempoValue,
      totalSoCount,
      verifiedScanCount,
      pieData
    };
  }, [filteredFormKirim, formKirimList.length, filteredRfidInvoices, rfidInvoices.length]);

  // 4. Analitik Data KPI Penjualan (KPI Individu, Denda, Persentase Kiriman & Omset Admin)
  const kpiChartSummary = useMemo(() => {
    const filterByBranch = (arr: any[]) => {
      if (effectiveBranchId === 'ALL') return arr;
      return arr.filter((row: any) => {
        if (row?.branchId || row?.branchName) {
          return resolveRecordBranchId(row.branchId || row.branchName, row.area) === effectiveBranchId;
        }
        const adminKey = String(row?.adminName || row?.checkerName || '').trim().toUpperCase();
        if (adminKey && adminBranchMap.has(adminKey)) {
          return adminBranchMap.get(adminKey) === effectiveBranchId;
        }
        return true;
      });
    };

    const indList = filterByBranch(Array.isArray(salesKpiData.individualKpiList) ? salesKpiData.individualKpiList : []);
    const omsetList = filterByBranch(Array.isArray(salesKpiData.adminOmsetRows) ? salesKpiData.adminOmsetRows : []);
    const dendaList = filterByBranch(Array.isArray(salesKpiData.dendaCheckerList) ? salesKpiData.dendaCheckerList : []);
    const reorderList = filterByBranch(Array.isArray(salesKpiData.reorderList) ? salesKpiData.reorderList : []);

    // Build combined chart per admin for KPI & Omset
    const map = new Map<
      string,
      {
        admin: string;
        kpiScore: number;
        omsetJuta: number;
        dendaRibu: number;
      }
    >();

    adminNames.slice(0, 6).forEach((name, idx) => {
      map.set(name, {
        admin: name.split(' ')[0],
        kpiScore: 92 + (idx % 6),
        omsetJuta: 420 + idx * 65,
        dendaRibu: idx % 2 === 0 ? 25 : 0
      });
    });

    const inactiveAdminSet = new Set<string>();
    indList.forEach((item: any) => {
      const name = String(item.adminName || '').trim().toUpperCase();
      if (!name) return;
      if (item.isInactive && (!item.month || item.month === selectedMonth) && (!item.year || item.year === selectedYear)) {
        inactiveAdminSet.add(name);
        map.delete(name);
        return;
      }
      if (inactiveAdminSet.has(name)) return;
      const short = name.split(' ')[0];
      const avg = Math.round(
        ((Number(item.validasiSoWebPct) || 90) +
          (Number(item.pembuatanFakturPct) || 92) +
          (Number(item.pengecekanFakturPct) || 94)) /
          3
      );
      const existing = map.get(name) || { admin: short, kpiScore: avg, omsetJuta: 350, dendaRibu: 0 };
      existing.kpiScore = avg;
      map.set(name, existing);
    });

    omsetList.forEach((row: any) => {
      const name = String(row.adminName || '').trim().toUpperCase();
      if (!name) return;
      const short = name.split(' ')[0];
      const existing = map.get(name) || { admin: short, kpiScore: 93, omsetJuta: 0, dendaRibu: 0 };
      existing.omsetJuta = Math.round(((Number(row.omsetNetto) || Number(row.nominal) || 0) / 1_000_000) * 10) / 10;
      map.set(name, existing);
    });

    dendaList.forEach((row: any) => {
      const name = String(row.adminName || row.checkerName || '').trim().toUpperCase();
      if (!name) return;
      const short = name.split(' ')[0];
      const existing = map.get(name) || { admin: short, kpiScore: 91, omsetJuta: 300, dendaRibu: 0 };
      existing.dendaRibu += Math.round((Number(row.nominalDenda) || 0) / 1_000);
      map.set(name, existing);
    });

    let terkirimTotal = 0;
    let belumTerkirimTotal = 0;
    reorderList.forEach((r: any) => {
      terkirimTotal += Number(r.terkirimFaktur) || 0;
      belumTerkirimTotal += Number(r.belumTerkirimSo) || 0;
    });
    const persentaseKiriman =
      terkirimTotal + belumTerkirimTotal > 0
        ? Math.round((terkirimTotal / (terkirimTotal + belumTerkirimTotal)) * 1000) / 10
        : reorderList.length === 0 && effectiveBranchId !== 'ALL'
        ? 0
        : 94.2;

    return {
      rows: Array.from(map.entries())
        .filter(([k]) => !inactiveAdminSet.has(k))
        .map(([, v]) => v),
      persentaseKiriman,
      totalDendaCases: dendaList.length
    };
  }, [salesKpiData, adminNames, selectedMonth, selectedYear, effectiveBranchId, adminBranchMap]);

  return (
    <div className="space-y-6">
      {/* Top Executive Banner: Dashboard Admin Penjualan */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 sm:p-6 shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-600 via-blue-600 to-cyan-500 text-white flex items-center justify-center shrink-0 shadow-md">
              <Briefcase className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
                Dashboard Admin Penjualan
              </h1>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Ringkasan grafik jadwal penugasan admin (sebulan &amp; seminggu), durasi muat armada, faktur SO &amp; form kirim, scan muat, hingga KPI penjualan.
              </p>
            </div>
          </div>

          {/* Filter Cabang, Bulan & Tahun (Full Width Labels Tanpa Terpotong) */}
          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <div className="min-w-[175px]">
              <ModernKpiDropdown
                value={effectiveBranchId}
                onChange={val => setSelectedBranchId(val)}
                icon={<Building2 className="w-3.5 h-3.5" />}
                searchable={false}
                options={[
                  ...(accessibleBranchOptions.length > 1
                    ? [
                        {
                          value: 'ALL',
                          label: 'Semua Cabang',
                          subLabel: 'Gabungan Nusantara & Sidoarjo'
                        }
                      ]
                    : []),
                  ...accessibleBranchOptions.map(br => ({
                    value: br.id,
                    label: `Cabang ${br.name}`,
                    subLabel: br.badge
                  }))
                ]}
              />
            </div>

            <div className="min-w-[155px]">
              <ModernKpiDropdown
                value={selectedMonth}
                onChange={val => setSelectedMonth(val)}
                icon={<Calendar className="w-3.5 h-3.5" />}
                searchable={false}
                options={MONTH_OPTIONS.map((m, idx) => ({
                  value: m,
                  label: m,
                  subLabel: m === currentMonthName ? `Bulan ke-${idx + 1} (Saat Ini)` : `Bulan ke-${idx + 1}`
                }))}
              />
            </div>

            <div className="min-w-[140px]">
              <ModernKpiDropdown
                value={selectedYear}
                onChange={val => setSelectedYear(val)}
                icon={<Sparkles className="w-3.5 h-3.5" />}
                searchable={false}
                options={['2025', '2026', '2027'].map(y => ({
                  value: y,
                  label: `Tahun ${y}`,
                  subLabel: y === currentYearStr ? 'Tahun Aktif Saat Ini' : 'Arsip / Proyeksi'
                }))}
              />
            </div>
          </div>
        </div>

        {/* Quick KPI Cards Representing Each Sub-Menu of Admin Penjualan */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mt-5 pt-5 border-t border-slate-100 dark:border-slate-800">
          <button
            type="button"
            onClick={() => onNavigateTab('sales_schedules')}
            className="text-left p-3.5 rounded-2xl bg-indigo-50/60 dark:bg-indigo-950/30 border border-indigo-200/70 dark:border-indigo-800/60 hover:border-indigo-500 transition cursor-pointer group"
          >
            <div className="flex items-center justify-between text-indigo-600 dark:text-indigo-400">
              <Calendar className="w-4 h-4" />
              <ArrowUpRight className="w-3.5 h-3.5 opacity-60 group-hover:opacity-100" />
            </div>
            <div className="text-lg font-black text-slate-900 dark:text-white mt-2 font-mono tabular-nums">
              {scheduleAnalytics.totalSebulanAll} Jadwal
            </div>
            <div className="text-[10px] font-bold text-slate-500 dark:text-slate-400 mt-0.5">
              Sebulan ({scheduleAnalytics.totalSemingguAll} Minggu Ini)
            </div>
          </button>

          <button
            type="button"
            onClick={() => onNavigateTab('sales_loading_duration')}
            className="text-left p-3.5 rounded-2xl bg-amber-50/60 dark:bg-amber-950/30 border border-amber-200/70 dark:border-amber-800/60 hover:border-amber-500 transition cursor-pointer group"
          >
            <div className="flex items-center justify-between text-amber-600 dark:text-amber-400">
              <Timer className="w-4 h-4" />
              <ArrowUpRight className="w-3.5 h-3.5 opacity-60 group-hover:opacity-100" />
            </div>
            <div className="text-lg font-black text-slate-900 dark:text-white mt-2 font-mono tabular-nums">
              {avgLoadingMinutes} Menit
            </div>
            <div className="text-[10px] font-bold text-slate-500 dark:text-slate-400 mt-0.5">
              Rerata Durasi Muat ({loadingChartData.length} Sesi)
            </div>
          </button>

          <button
            type="button"
            onClick={() => onNavigateTab('sales_invoice_so')}
            className="text-left p-3.5 rounded-2xl bg-blue-50/60 dark:bg-blue-950/30 border border-blue-200/70 dark:border-blue-800/60 hover:border-blue-500 transition cursor-pointer group"
          >
            <div className="flex items-center justify-between text-blue-600 dark:text-blue-400">
              <FileText className="w-4 h-4" />
              <ArrowUpRight className="w-3.5 h-3.5 opacity-60 group-hover:opacity-100" />
            </div>
            <div className="text-lg font-black text-slate-900 dark:text-white mt-2 font-mono tabular-nums">
              {outboundAndScanMetrics.totalSoCount} Faktur SO
            </div>
            <div className="text-[10px] font-bold text-slate-500 dark:text-slate-400 mt-0.5">
              Input Faktur / Sales Order
            </div>
          </button>

          <button
            type="button"
            onClick={() => onNavigateTab('sales_form_kirim')}
            className="text-left p-3.5 rounded-2xl bg-cyan-50/60 dark:bg-cyan-950/30 border border-cyan-200/70 dark:border-cyan-800/60 hover:border-cyan-500 transition cursor-pointer group"
          >
            <div className="flex items-center justify-between text-cyan-600 dark:text-cyan-400">
              <Truck className="w-4 h-4" />
              <ArrowUpRight className="w-3.5 h-3.5 opacity-60 group-hover:opacity-100" />
            </div>
            <div className="text-lg font-black text-slate-900 dark:text-white mt-2 font-mono tabular-nums">
              {outboundAndScanMetrics.codInvoices + outboundAndScanMetrics.tempoInvoices} Faktur
            </div>
            <div className="text-[10px] font-bold text-slate-500 dark:text-slate-400 mt-0.5">
              Form Kirim ({outboundAndScanMetrics.codInvoices} COD &bull; {outboundAndScanMetrics.tempoInvoices} Tempo)
            </div>
          </button>

          <button
            type="button"
            onClick={() => onNavigateTab('sales_rfid_scanner')}
            className="text-left p-3.5 rounded-2xl bg-emerald-50/60 dark:bg-emerald-950/30 border border-emerald-200/70 dark:border-emerald-800/60 hover:border-emerald-500 transition cursor-pointer group"
          >
            <div className="flex items-center justify-between text-emerald-600 dark:text-emerald-400">
              <QrCode className="w-4 h-4" />
              <ArrowUpRight className="w-3.5 h-3.5 opacity-60 group-hover:opacity-100" />
            </div>
            <div className="text-lg font-black text-slate-900 dark:text-white mt-2 font-mono tabular-nums">
              {outboundAndScanMetrics.verifiedScanCount} Termuat
            </div>
            <div className="text-[10px] font-bold text-slate-500 dark:text-slate-400 mt-0.5">
              Aplikasi Scan &amp; Foto Muat
            </div>
          </button>

          <button
            type="button"
            onClick={() => onNavigateTab('sales_kpi_nusantara')}
            className="text-left p-3.5 rounded-2xl bg-purple-50/60 dark:bg-purple-950/30 border border-purple-200/70 dark:border-purple-800/60 hover:border-purple-500 transition cursor-pointer group"
          >
            <div className="flex items-center justify-between text-purple-600 dark:text-purple-400">
              <Percent className="w-4 h-4" />
              <ArrowUpRight className="w-3.5 h-3.5 opacity-60 group-hover:opacity-100" />
            </div>
            <div className="text-lg font-black text-slate-900 dark:text-white mt-2 font-mono tabular-nums">
              {kpiChartSummary.persentaseKiriman}%
            </div>
            <div className="text-[10px] font-bold text-slate-500 dark:text-slate-400 mt-0.5">
              Persentase Kiriman &amp; KPI
            </div>
          </button>
        </div>
      </div>

      {/* SECTION 1: CHART JADWAL & PENUGASAN MASING-MASING ADMIN (SEBULAN & SEMINGGU) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-8 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 sm:p-6 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-4">
            <div>
              <span className="text-[10px] font-black uppercase tracking-widest text-indigo-600 dark:text-indigo-400 block">
                SUB-MENU: JADWAL &amp; PENUGASAN ADMIN
              </span>
              <h2 className="text-base font-black text-slate-900 dark:text-white mt-0.5">
                Total Jadwal yang Dilampaui Masing-Masing Admin (Sebulan vs Seminggu)
              </h2>
            </div>

            <div className="flex flex-wrap items-center gap-1.5 bg-slate-100 dark:bg-slate-950 p-1 rounded-xl border border-slate-200 dark:border-slate-800">
              {[
                { id: 'ALL_MONTH', label: 'Rerata Mingguan' },
                { id: 'W1', label: 'Minggu 1' },
                { id: 'W2', label: 'Minggu 2' },
                { id: 'W3', label: 'Minggu 3' },
                { id: 'W4', label: 'Minggu 4' }
              ].map(tab => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setSchedulePeriodMode(tab.id as any)}
                  className={`px-2.5 py-1 rounded-lg text-[10px] font-extrabold transition cursor-pointer ${
                    schedulePeriodMode === tab.id
                      ? 'bg-indigo-600 text-white shadow-2xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={scheduleAnalytics.adminRows} margin={{ top: 10, right: 16, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.18} />
                <XAxis dataKey="shortName" tick={{ fontSize: 11, fontWeight: 700 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip
                  contentStyle={{
                    borderRadius: '14px',
                    border: '1px solid rgba(99,102,241,0.3)',
                    backgroundColor: '#0f172a',
                    color: '#fff',
                    fontSize: '12px'
                  }}
                />
                <Legend wrapperStyle={{ fontSize: '11px', fontWeight: 700 }} />
                <Bar
                  dataKey="totalSebulan"
                  name="Total Jadwal Sebulan (Hari)"
                  fill="#4f46e5"
                  radius={[6, 6, 0, 0]}
                />
                <Bar
                  dataKey="totalSeminggu"
                  name="Total Jadwal Seminggu (Hari)"
                  fill="#06b6d4"
                  radius={[6, 6, 0, 0]}
                />
                <Bar
                  dataKey="areaDutiesCount"
                  name="Total Area Kirim Tertangani"
                  fill="#10b981"
                  radius={[6, 6, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Detail Ringkasan Jadwal per Admin */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 pt-2">
            {scheduleAnalytics.adminRows.map(row => (
              <div
                key={row.admin}
                className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200/80 dark:border-slate-800"
              >
                <div className="text-[11px] font-black text-slate-900 dark:text-white truncate">
                  {row.admin}
                </div>
                <div className="mt-1.5 flex items-baseline justify-between">
                  <span className="text-[10px] font-bold text-slate-500">Sebulan:</span>
                  <span className="text-xs font-black text-indigo-600 dark:text-indigo-400 font-mono">
                    {row.totalSebulan}x
                  </span>
                </div>
                <div className="flex items-baseline justify-between">
                  <span className="text-[10px] font-bold text-slate-500">Seminggu:</span>
                  <span className="text-xs font-black text-cyan-600 dark:text-cyan-400 font-mono">
                    {row.totalSeminggu}x
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Tren Mingguan Jadwal Admin */}
        <div className="lg:col-span-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 sm:p-6 shadow-xs flex flex-col justify-between space-y-4">
          <div>
            <span className="text-[10px] font-black uppercase tracking-widest text-cyan-600 dark:text-cyan-400 block">
              DISTRIBUSI MINGGUAN ({selectedMonth.toUpperCase()})
            </span>
            <h2 className="text-base font-black text-slate-900 dark:text-white mt-0.5">
              Tren Penugasan Mingguan (M1 – M4)
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Akumulasi jadwal harian &amp; jumlah area kirim per minggu
            </p>
          </div>

          <div className="h-60 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={scheduleAnalytics.weeklyTrend} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
                <defs>
                  <linearGradient id="gradJadwal" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.45} />
                    <stop offset="95%" stopColor="#06b6d4" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.18} />
                <XAxis dataKey="minggu" tick={{ fontSize: 10, fontWeight: 700 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip
                  contentStyle={{
                    borderRadius: '14px',
                    backgroundColor: '#0f172a',
                    color: '#fff',
                    fontSize: '12px'
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="totalJadwal"
                  name="Total Jadwal Mingguan"
                  stroke="#06b6d4"
                  strokeWidth={2.5}
                  fill="url(#gradJadwal)"
                />
                <Area
                  type="monotone"
                  dataKey="tugasArea"
                  name="Area Kirim Tertangani"
                  stroke="#4f46e5"
                  strokeWidth={2}
                  fillOpacity={0}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          <button
            type="button"
            onClick={() => onNavigateTab('sales_schedules')}
            className="w-full py-2.5 px-4 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-indigo-600 hover:text-white text-slate-800 dark:text-slate-200 text-xs font-extrabold transition flex items-center justify-center gap-2 cursor-pointer"
          >
            <span>Buka Jadwal &amp; Penugasan Admin</span>
            <ArrowUpRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* SECTION 2: CHART DURASI & KECEPATAN MUAT ARMADA + FAKTUR SO / FORM KIRIM / SCAN MUAT */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Durasi & Kecepatan Muat Armada */}
        <div className="lg:col-span-7 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 sm:p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3.5">
            <div>
              <span className="text-[10px] font-black uppercase tracking-widest text-amber-600 dark:text-amber-400 block">
                SUB-MENU: DURASI &amp; KECEPATAN MUAT ARMADA
              </span>
              <h2 className="text-base font-black text-slate-900 dark:text-white mt-0.5">
                Perbandingan Durasi Muat Armada (Menit) vs Target SLA (120 Menit)
              </h2>
            </div>
            <button
              type="button"
              onClick={() => onNavigateTab('sales_loading_duration')}
              className="px-3 py-1.5 rounded-xl bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800 text-xs font-bold hover:bg-amber-100 transition cursor-pointer shrink-0"
            >
              Detail Durasi Muat &rarr;
            </button>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={loadingChartData} margin={{ top: 10, right: 16, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.18} />
                <XAxis dataKey="area" tick={{ fontSize: 10, fontWeight: 700 }} />
                <YAxis tick={{ fontSize: 11 }} unit="m" />
                <Tooltip
                  contentStyle={{
                    borderRadius: '14px',
                    backgroundColor: '#0f172a',
                    color: '#fff',
                    fontSize: '12px'
                  }}
                />
                <Legend wrapperStyle={{ fontSize: '11px', fontWeight: 700 }} />
                <Bar
                  dataKey="durasiMenit"
                  name="Durasi Muat Aktual (Menit)"
                  fill="#f59e0b"
                  radius={[6, 6, 0, 0]}
                />
                <Bar
                  dataKey="targetSlaMenit"
                  name="Batas Maksimal SLA (120 Menit)"
                  fill="#10b981"
                  radius={[6, 6, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Input Faktur SO, Form Kirim & Scan Foto Muat */}
        <div className="lg:col-span-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 sm:p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3.5">
            <div>
              <span className="text-[10px] font-black uppercase tracking-widest text-emerald-600 dark:text-emerald-400 block">
                SUB-MENU: FAKTUR SO, FORM KIRIM &amp; SCAN MUAT
              </span>
              <h2 className="text-base font-black text-slate-900 dark:text-white mt-0.5">
                Proporsi Faktur COD, Tempo &amp; Verifikasi Scan
              </h2>
            </div>
            <button
              type="button"
              onClick={() => onNavigateTab('sales_form_kirim')}
              className="px-3 py-1.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 text-xs font-bold hover:bg-emerald-100 transition cursor-pointer shrink-0"
            >
              Form Kirim &rarr;
            </button>
          </div>

          <div className="h-52 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={outboundAndScanMetrics.pieData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={48}
                  outerRadius={76}
                  paddingAngle={4}
                >
                  {outboundAndScanMetrics.pieData.map((entry, index) => (
                    <Cell key={entry.name} fill={entry.color || CHART_COLORS[index % CHART_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    borderRadius: '12px',
                    backgroundColor: '#0f172a',
                    color: '#fff',
                    fontSize: '12px'
                  }}
                />
                <Legend wrapperStyle={{ fontSize: '11px', fontWeight: 700 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            <div className="p-3 rounded-2xl bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200/70 dark:border-emerald-800/60">
              <span className="text-[10px] font-extrabold uppercase text-emerald-700 dark:text-emerald-300 block">
                TOTAL TAGIHAN COD
              </span>
              <span className="text-sm font-black text-emerald-800 dark:text-emerald-200 font-mono mt-0.5 block">
                Rp {outboundAndScanMetrics.totalCodValue.toLocaleString('id-ID')}
              </span>
            </div>
            <div className="p-3 rounded-2xl bg-rose-50/70 dark:bg-rose-950/30 border border-rose-200/70 dark:border-rose-800/60">
              <span className="text-[10px] font-extrabold uppercase text-rose-700 dark:text-rose-300 block">
                TOTAL FAKTUR TEMPO
              </span>
              <span className="text-sm font-black text-rose-800 dark:text-rose-200 font-mono mt-0.5 block">
                Rp {outboundAndScanMetrics.totalTempoValue.toLocaleString('id-ID')}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* SECTION 3: CHART DATA KPI PENJUALAN (KPI INDIVIDU, DENDA, PERSENTASE KIRIMAN & OMSET ADMIN) */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 sm:p-6 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-4">
          <div>
            <span className="text-[10px] font-black uppercase tracking-widest text-purple-600 dark:text-purple-400 block">
              SUB-MENU: DATA KPI PENJUALAN (KPI INDIVIDU, AKUMULASI DENDA, PERSENTASE KIRIMAN &amp; OMSET ADMIN)
            </span>
            <h2 className="text-base font-black text-slate-900 dark:text-white mt-0.5">
              Performa Skor KPI Individu (%) &amp; Omset Admin Penjualan (Juta Rp)
            </h2>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => onNavigateTab('sales_kpi_individual')}
              className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-indigo-600 hover:text-white text-slate-700 dark:text-slate-200 text-xs font-bold transition cursor-pointer"
            >
              KPI Individu
            </button>
            <button
              type="button"
              onClick={() => onNavigateTab('sales_kpi_fines')}
              className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-rose-600 hover:text-white text-slate-700 dark:text-slate-200 text-xs font-bold transition cursor-pointer"
            >
              Akumulasi Denda
            </button>
            <button
              type="button"
              onClick={() => onNavigateTab('sales_kpi_nusantara')}
              className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-cyan-600 hover:text-white text-slate-700 dark:text-slate-200 text-xs font-bold transition cursor-pointer"
            >
              Persentase Kiriman
            </button>
            <button
              type="button"
              onClick={() => onNavigateTab('sales_kpi_omset')}
              className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-emerald-600 hover:text-white text-slate-700 dark:text-slate-200 text-xs font-bold transition cursor-pointer"
            >
              Omset Admin
            </button>
          </div>
        </div>

        <div className="h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={kpiChartSummary.rows} margin={{ top: 10, right: 16, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.18} />
              <XAxis dataKey="admin" tick={{ fontSize: 11, fontWeight: 700 }} />
              <YAxis yAxisId="left" orientation="left" tick={{ fontSize: 11 }} />
              <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} unit="%" />
              <Tooltip
                contentStyle={{
                  borderRadius: '14px',
                  backgroundColor: '#0f172a',
                  color: '#fff',
                  fontSize: '12px'
                }}
              />
              <Legend wrapperStyle={{ fontSize: '11px', fontWeight: 700 }} />
              <Bar
                yAxisId="left"
                dataKey="omsetJuta"
                name="Omset Netto Admin (Juta Rp)"
                fill="#10b981"
                radius={[6, 6, 0, 0]}
              />
              <Bar
                yAxisId="right"
                dataKey="kpiScore"
                name="Skor KPI Individu Staff (%)"
                fill="#4f46e5"
                radius={[6, 6, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};
