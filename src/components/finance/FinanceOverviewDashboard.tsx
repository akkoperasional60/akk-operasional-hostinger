import React, { useEffect, useMemo, useState } from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  PieChart,
  Pie,
  Cell,
  Legend
} from 'recharts';
import {
  DollarSign,
  CheckCircle2,
  AlertTriangle,
  ShieldCheck,
  Users,
  FileText,
  ArrowUpRight,
  Clock,
  Building2,
  CreditCard,
  Smartphone,
  Camera
} from 'lucide-react';
import type {
  CustomerUnpaidInvoice,
  CustomerMasterRecord,
  CollectorProofLog
} from '../DepartmentDashboard';
import type { BranchRecord } from '../../services/branchStore';
import type { FormKirimRecord } from '../../services/formKirimStore';

interface FinanceOverviewDashboardProps {
  invoices: CustomerUnpaidInvoice[];
  masterCustomers: CustomerMasterRecord[];
  collectionLogs: CollectorProofLog[];
  branches: BranchRecord[];
  branchFilter: string;
  setBranchFilter: (branch: string) => void;
  onNavigateTab: (tab: string) => void;
}

function calcAgingDays(dueDateStr: string): number {
  const today = new Date('2026-11-14T00:00:00');
  const due = new Date(`${dueDateStr}T00:00:00`);
  if (isNaN(due.getTime())) return 0;
  return Math.floor((today.getTime() - due.getTime()) / (1000 * 60 * 60 * 24));
}

function formatCompactRp(value: number): string {
  if (value >= 1_000_000_000) return `Rp ${(value / 1_000_000_000).toFixed(2)} M`;
  if (value >= 1_000_000) return `Rp ${(value / 1_000_000).toFixed(1)} Jt`;
  if (value >= 1_000) return `Rp ${Math.round(value / 1_000)} Rb`;
  return `Rp ${value.toLocaleString('id-ID')}`;
}

export const FinanceOverviewDashboard: React.FC<FinanceOverviewDashboardProps> = ({
  invoices,
  masterCustomers,
  collectionLogs,
  branches,
  branchFilter,
  setBranchFilter,
  onNavigateTab
}) => {
  const [formKirimRecords, setFormKirimRecords] = useState<FormKirimRecord[]>([]);
  const [isLoadingFk, setIsLoadingFk] = useState(true);
  const [teamScope, setTeamScope] = useState<'ALL' | 'FINANCE' | 'SALES'>('ALL');

  useEffect(() => {
    let active = true;
    setIsLoadingFk(true);
    fetch('/api/form-kirim', { cache: 'no-store' })
      .then(r => (r.ok ? r.json() : null))
      .then(data => {
        if (!active) return;
        if (Array.isArray(data?.records)) {
          setFormKirimRecords(data.records);
        }
      })
      .catch(() => {})
      .finally(() => {
        if (active) setIsLoadingFk(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const branchScopedInvoices = useMemo(() => {
    const selectedMasterBranch = branches.find(
      b =>
        b.name.toLowerCase() === branchFilter.toLowerCase() ||
        b.slug.toLowerCase() === branchFilter.toLowerCase()
    );

    return invoices.filter(inv => {
      if (teamScope !== 'ALL' && (inv.billingTeam || 'FINANCE') !== teamScope) {
        return false;
      }
      if (branchFilter === 'ALL') return true;
      const regLower = (inv.region || '').toLowerCase();
      const bfLower = branchFilter.toLowerCase();
      return (
        regLower.includes(bfLower) ||
        Boolean(
          selectedMasterBranch &&
            (regLower.includes(selectedMasterBranch.name.toLowerCase()) ||
              regLower.includes(selectedMasterBranch.slug.toLowerCase()) ||
              regLower.includes((selectedMasterBranch.city || '').toLowerCase()))
        )
      );
    });
  }, [invoices, branches, branchFilter, teamScope]);

  const branchScopedFormKirim = useMemo(() => {
    if (branchFilter === 'ALL') return formKirimRecords;
    const bfLower = branchFilter.toLowerCase();
    return formKirimRecords.filter(fk => {
      const bn = (fk.branchName || '').toLowerCase();
      if (!bn) return true;
      return bn.includes(bfLower) || (bfLower.includes('nusantara') && bn.includes('banyuwangi'));
    });
  }, [formKirimRecords, branchFilter]);

  const branchScopedLogs = useMemo(() => {
    if (branchFilter === 'ALL') return collectionLogs;
    const bfLower = branchFilter.toLowerCase();
    return collectionLogs.filter(log => (log.region || '').toLowerCase().includes(bfLower));
  }, [collectionLogs, branchFilter]);

  const metrics = useMemo(() => {
    let totalTagihan = 0;
    let totalTerbayar = 0;
    let totalTerutang = 0;
    let overdueNominal = 0;
    let overdueCount = 0;
    let activeUnpaidCount = 0;
    let settledCount = 0;

    let financeNominal = 0;
    let financeCount = 0;
    let salesNominal = 0;
    let salesCount = 0;

    let tempoNominal = 0;
    let codNominal = 0;

    const agingBuckets = {
      lancar: { label: 'Lancar / Belum Jt', nominal: 0, count: 0 },
      d1_14: { label: 'Telat 1-14 Hr', nominal: 0, count: 0 },
      d15_30: { label: 'Telat 15-30 Hr', nominal: 0, count: 0 },
      d30_plus: { label: 'Telat >30 Hr', nominal: 0, count: 0 }
    };

    const customerAgg = new Map<
      string,
      {
        customerName: string;
        region: string;
        terutang: number;
        totalTagihan: number;
        terbayar: number;
        limit: number;
        paymentCategory: 'TEMPO' | 'COD';
        maxOverdueDays: number;
        invoiceCount: number;
        primaryTeam: 'FINANCE' | 'SALES';
      }
    >();

    const regionMap = new Map<string, { region: string; terutang: number; terbayar: number; count: number }>();

    const masterMap = new Map<string, CustomerMasterRecord>();
    masterCustomers.forEach(c => {
      masterMap.set(c.customerName.trim().toUpperCase(), c);
    });

    branchScopedInvoices.forEach(inv => {
      const sisa = Math.max(0, (inv.totalTagihan || 0) - (inv.jumlahTerbayar || 0));
      const aging = calcAgingDays(inv.dueDate);
      const team = inv.billingTeam === 'SALES' ? 'SALES' : 'FINANCE';
      const custKey = inv.customerName.trim().toUpperCase();
      const masterRec = masterMap.get(custKey);
      const effectiveLimit = inv.limitPelanggan ?? masterRec?.creditLimit ?? 2000000;
      const effectiveCat = inv.paymentCategory || masterRec?.paymentCategory || 'TEMPO';

      totalTagihan += inv.totalTagihan || 0;
      totalTerbayar += inv.jumlahTerbayar || 0;
      totalTerutang += sisa;

      if (sisa > 0) {
        activeUnpaidCount += 1;
        if (aging > 0) {
          overdueCount += 1;
          overdueNominal += sisa;
          if (aging <= 14) {
            agingBuckets.d1_14.nominal += sisa;
            agingBuckets.d1_14.count += 1;
          } else if (aging <= 30) {
            agingBuckets.d15_30.nominal += sisa;
            agingBuckets.d15_30.count += 1;
          } else {
            agingBuckets.d30_plus.nominal += sisa;
            agingBuckets.d30_plus.count += 1;
          }
        } else {
          agingBuckets.lancar.nominal += sisa;
          agingBuckets.lancar.count += 1;
        }

        if (team === 'SALES') {
          salesNominal += sisa;
          salesCount += 1;
        } else {
          financeNominal += sisa;
          financeCount += 1;
        }

        if (effectiveCat === 'COD') {
          codNominal += sisa;
        } else {
          tempoNominal += sisa;
        }
      } else {
        settledCount += 1;
      }

      const prevCust = customerAgg.get(custKey) || {
        customerName: inv.customerName,
        region: inv.region || '-',
        terutang: 0,
        totalTagihan: 0,
        terbayar: 0,
        limit: effectiveLimit,
        paymentCategory: effectiveCat,
        maxOverdueDays: 0,
        invoiceCount: 0,
        primaryTeam: team
      };
      prevCust.terutang += sisa;
      prevCust.totalTagihan += inv.totalTagihan || 0;
      prevCust.terbayar += inv.jumlahTerbayar || 0;
      if (sisa > 0 && aging > prevCust.maxOverdueDays) {
        prevCust.maxOverdueDays = aging;
      }
      prevCust.invoiceCount += 1;
      customerAgg.set(custKey, prevCust);

      const regKey = (inv.region || 'LAINNYA').trim().toUpperCase();
      const prevReg = regionMap.get(regKey) || {
        region: regKey,
        terutang: 0,
        terbayar: 0,
        count: 0
      };
      prevReg.terutang += sisa;
      prevReg.terbayar += inv.jumlahTerbayar || 0;
      if (sisa > 0) prevReg.count += 1;
      regionMap.set(regKey, prevReg);
    });

    const priorityCustomers = Array.from(customerAgg.values())
      .filter(c => c.terutang > 0)
      .map(c => ({
        ...c,
        isOverLimit: c.paymentCategory === 'TEMPO' && c.limit > 0 && c.terutang > c.limit,
        overLimitAmount: c.paymentCategory === 'TEMPO' && c.limit > 0 ? Math.max(0, c.terutang - c.limit) : 0
      }))
      .sort((a, b) => {
        if (b.overLimitAmount !== a.overLimitAmount) return b.overLimitAmount - a.overLimitAmount;
        if (b.maxOverdueDays !== a.maxOverdueDays) return b.maxOverdueDays - a.maxOverdueDays;
        return b.terutang - a.terutang;
      });

    const overLimitCount = priorityCustomers.filter(c => c.isOverLimit).length;
    const collectionRatePct = totalTagihan > 0 ? Math.round((totalTerbayar / totalTagihan) * 1000) / 10 : 0;

    const pendingFkCount = branchScopedFormKirim.filter(f => f.financeStatus === 'pending_finance').length;
    const approvedFkCount = branchScopedFormKirim.filter(f => f.financeStatus === 'approved_finance').length;
    const revisionFkCount = branchScopedFormKirim.filter(f => f.financeStatus === 'revision_needed').length;

    const agingChartData = [
      { name: agingBuckets.lancar.label, nominalJuta: Math.round((agingBuckets.lancar.nominal / 1_000_000) * 10) / 10, faktur: agingBuckets.lancar.count },
      { name: agingBuckets.d1_14.label, nominalJuta: Math.round((agingBuckets.d1_14.nominal / 1_000_000) * 10) / 10, faktur: agingBuckets.d1_14.count },
      { name: agingBuckets.d15_30.label, nominalJuta: Math.round((agingBuckets.d15_30.nominal / 1_000_000) * 10) / 10, faktur: agingBuckets.d15_30.count },
      { name: agingBuckets.d30_plus.label, nominalJuta: Math.round((agingBuckets.d30_plus.nominal / 1_000_000) * 10) / 10, faktur: agingBuckets.d30_plus.count }
    ];

    const regionChartData = Array.from(regionMap.values())
      .sort((a, b) => b.terutang - a.terutang)
      .slice(0, 7)
      .map(r => ({
        region: r.region,
        terutangJuta: Math.round((r.terutang / 1_000_000) * 10) / 10,
        terbayarJuta: Math.round((r.terbayar / 1_000_000) * 10) / 10,
        fakturAktif: r.count
      }));

    const teamPieData = [
      { name: 'Tim Penagihan Finance', value: financeNominal, count: financeCount, color: '#4f46e5' },
      { name: 'Tagihan Khusus Sales', value: salesNominal, count: salesCount, color: '#d97706' }
    ].filter(x => x.value > 0);

    return {
      totalTagihan,
      totalTerbayar,
      totalTerutang,
      overdueNominal,
      overdueCount,
      activeUnpaidCount,
      settledCount,
      overLimitCount,
      collectionRatePct,
      financeNominal,
      financeCount,
      salesNominal,
      salesCount,
      tempoNominal,
      codNominal,
      pendingFkCount,
      approvedFkCount,
      revisionFkCount,
      agingChartData,
      regionChartData,
      teamPieData,
      priorityCustomers
    };
  }, [branchScopedInvoices, masterCustomers, branchScopedFormKirim]);

  return (
    <div className="space-y-6">
      {/* Header & Filter Bar */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 sm:p-6 shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="w-11 h-11 rounded-xl bg-indigo-600 text-white flex items-center justify-center shrink-0">
              <DollarSign className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
                Dashboard Finance &amp; Tax
              </h1>
              <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
                Ringkasan posisi piutang pelanggan, umur jatuh tempo, kepatuhan limit kredit, penagihan lapangan &amp; validasi Form Kirim.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <div className="inline-flex items-center gap-1 p-1 rounded-xl bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
              {[
                { id: 'ALL', label: 'Semua Tim' },
                { id: 'FINANCE', label: 'Tim Finance' },
                { id: 'SALES', label: 'Khusus Sales' }
              ].map(t => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTeamScope(t.id as 'ALL' | 'FINANCE' | 'SALES')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer whitespace-nowrap ${
                    teamScope === t.id
                      ? 'bg-white dark:bg-slate-800 text-indigo-700 dark:text-indigo-300 shadow-2xs border border-slate-200 dark:border-slate-700'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            <div className="inline-flex items-center gap-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2">
              <Building2 className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
              <select
                value={branchFilter}
                onChange={e => setBranchFilter(e.target.value)}
                aria-label="Filter Cabang Finance"
                className="bg-transparent text-xs font-bold text-slate-900 dark:text-white focus:outline-none cursor-pointer"
              >
                <option value="ALL">Semua Cabang ({branches.length})</option>
                {branches.map(b => (
                  <option key={b.id} value={b.name}>
                    Cabang {b.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Top 6 KPI Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3 mt-5 pt-5 border-t border-slate-200 dark:border-slate-800">
          <button
            type="button"
            onClick={() => onNavigateTab('finance_dashboard')}
            className="text-left p-4 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 hover:border-indigo-500 transition cursor-pointer group"
          >
            <div className="flex items-center justify-between text-indigo-600 dark:text-indigo-400">
              <DollarSign className="w-4 h-4" />
              <ArrowUpRight className="w-3.5 h-3.5 opacity-60 group-hover:opacity-100" />
            </div>
            <div className="text-lg font-black text-slate-900 dark:text-white mt-2 font-mono tabular-nums">
              {formatCompactRp(metrics.totalTerutang)}
            </div>
            <div className="text-[11px] font-bold text-slate-600 dark:text-slate-400 mt-0.5">
              Piutang Terutang ({metrics.activeUnpaidCount} Faktur)
            </div>
          </button>

          <button
            type="button"
            onClick={() => onNavigateTab('finance_dashboard')}
            className="text-left p-4 rounded-xl bg-emerald-50/70 dark:bg-emerald-950/25 border border-emerald-200 dark:border-emerald-800 hover:border-emerald-500 transition cursor-pointer group"
          >
            <div className="flex items-center justify-between text-emerald-700 dark:text-emerald-400">
              <CheckCircle2 className="w-4 h-4" />
              <span className="text-[11px] font-mono font-bold tabular-nums">{metrics.collectionRatePct}%</span>
            </div>
            <div className="text-lg font-black text-emerald-900 dark:text-emerald-200 mt-2 font-mono tabular-nums">
              {formatCompactRp(metrics.totalTerbayar)}
            </div>
            <div className="text-[11px] font-bold text-emerald-700 dark:text-emerald-400 mt-0.5">
              Pembayaran Terkumpul ({metrics.settledCount} Lunas)
            </div>
          </button>

          <button
            type="button"
            onClick={() => onNavigateTab('finance_dashboard')}
            className="text-left p-4 rounded-xl bg-rose-50/80 dark:bg-rose-950/25 border border-rose-200 dark:border-rose-800 hover:border-rose-500 transition cursor-pointer group"
          >
            <div className="flex items-center justify-between text-rose-700 dark:text-rose-400">
              <Clock className="w-4 h-4" />
              <ArrowUpRight className="w-3.5 h-3.5 opacity-60 group-hover:opacity-100" />
            </div>
            <div className="text-lg font-black text-rose-900 dark:text-rose-200 mt-2 font-mono tabular-nums">
              {formatCompactRp(metrics.overdueNominal)}
            </div>
            <div className="text-[11px] font-bold text-rose-700 dark:text-rose-400 mt-0.5">
              Lewat Jatuh Tempo ({metrics.overdueCount} Faktur)
            </div>
          </button>

          <button
            type="button"
            onClick={() => onNavigateTab('finance_customer_mapping')}
            className="text-left p-4 rounded-xl bg-amber-50/80 dark:bg-amber-950/25 border border-amber-200 dark:border-amber-800 hover:border-amber-500 transition cursor-pointer group"
          >
            <div className="flex items-center justify-between text-amber-700 dark:text-amber-400">
              <AlertTriangle className="w-4 h-4" />
              <ArrowUpRight className="w-3.5 h-3.5 opacity-60 group-hover:opacity-100" />
            </div>
            <div className="text-lg font-black text-amber-900 dark:text-amber-200 mt-2 font-mono tabular-nums">
              {metrics.overLimitCount} Toko
            </div>
            <div className="text-[11px] font-bold text-amber-700 dark:text-amber-400 mt-0.5">
              Melebihi Plafon Limit ({masterCustomers.length} Master)
            </div>
          </button>

          <button
            type="button"
            onClick={() => onNavigateTab('finance_validasi_form_kirim')}
            className="text-left p-4 rounded-xl bg-sky-50/80 dark:bg-sky-950/25 border border-sky-200 dark:border-sky-800 hover:border-sky-500 transition cursor-pointer group"
          >
            <div className="flex items-center justify-between text-sky-700 dark:text-sky-400">
              <ShieldCheck className="w-4 h-4" />
              <ArrowUpRight className="w-3.5 h-3.5 opacity-60 group-hover:opacity-100" />
            </div>
            <div className="text-lg font-black text-sky-900 dark:text-sky-200 mt-2 font-mono tabular-nums">
              {isLoadingFk ? '...' : `${metrics.pendingFkCount} Pending`}
            </div>
            <div className="text-[11px] font-bold text-sky-700 dark:text-sky-400 mt-0.5">
              Validasi Form Kirim ({metrics.approvedFkCount} Lolos)
            </div>
          </button>

          <button
            type="button"
            onClick={() => onNavigateTab('finance_billing_app')}
            className="text-left p-4 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 hover:border-indigo-500 transition cursor-pointer group"
          >
            <div className="flex items-center justify-between text-slate-700 dark:text-slate-300">
              <Camera className="w-4 h-4" />
              <ArrowUpRight className="w-3.5 h-3.5 opacity-60 group-hover:opacity-100" />
            </div>
            <div className="text-lg font-black text-slate-900 dark:text-white mt-2 font-mono tabular-nums">
              {branchScopedLogs.length} Bukti
            </div>
            <div className="text-[11px] font-bold text-slate-600 dark:text-slate-400 mt-0.5">
              Log Penagihan Lapangan
            </div>
          </button>
        </div>
      </div>

      {/* Charts Row: Aging Analysis + Tim Finance vs Sales */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        <div className="lg:col-span-7 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
            <div>
              <h2 className="text-sm font-black text-slate-900 dark:text-white">
                Analisa Umur Jatuh Tempo Piutang (Aging Buckets)
              </h2>
              <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
                Sebaran sisa piutang dalam jutaan rupiah berdasarkan keterlambatan hari
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigateTab('finance_dashboard')}
              className="px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-indigo-600 hover:text-white text-slate-700 dark:text-slate-200 text-xs font-bold transition cursor-pointer whitespace-nowrap"
            >
              Buku Besar &rarr;
            </button>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={metrics.agingChartData} margin={{ top: 10, right: 16, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#64748b" opacity={0.18} />
                <XAxis dataKey="name" tick={{ fontSize: 11, fontWeight: 700 }} />
                <YAxis tick={{ fontSize: 11 }} unit=" Jt" />
                <Tooltip
                  contentStyle={{
                    borderRadius: '12px',
                    backgroundColor: '#0f172a',
                    color: '#ffffff',
                    border: '1px solid #334155',
                    fontSize: '12px'
                  }}
                />
                <Legend wrapperStyle={{ fontSize: '11px', fontWeight: 700 }} />
                <Bar dataKey="nominalJuta" name="Nominal Piutang (Juta Rp)" fill="#4f46e5" radius={[6, 6, 0, 0]} />
                <Bar dataKey="faktur" name="Jumlah Faktur" fill="#e11d48" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="lg:col-span-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
            <div>
              <h2 className="text-sm font-black text-slate-900 dark:text-white">
                Porsi Penagihan: Tim Finance vs Khusus Sales
              </h2>
              <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
                Perbandingan tanggung jawab penagihan &amp; kategori Tempo/COD
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigateTab('finance_billing_app')}
              className="px-3 py-1.5 rounded-lg bg-amber-50 dark:bg-amber-950/50 text-amber-800 dark:text-amber-200 border border-amber-200 dark:border-amber-800 text-xs font-bold hover:bg-amber-100 transition cursor-pointer whitespace-nowrap"
            >
              Buka Aplikasi &rarr;
            </button>
          </div>

          <div className="h-48 w-full">
            {metrics.teamPieData.length === 0 ? (
              <div className="h-full flex items-center justify-center text-xs text-slate-500">
                Tidak ada piutang aktif pada filter ini.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={metrics.teamPieData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={44}
                    outerRadius={72}
                    paddingAngle={4}
                  >
                    {metrics.teamPieData.map(entry => (
                      <Cell key={entry.name} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(val: any) => `Rp ${Number(val || 0).toLocaleString('id-ID')}`}
                    contentStyle={{
                      borderRadius: '12px',
                      backgroundColor: '#0f172a',
                      color: '#ffffff',
                      fontSize: '12px'
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: '11px', fontWeight: 700 }} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>

          <div className="grid grid-cols-2 gap-2.5 pt-1">
            <div className="p-3 rounded-xl bg-indigo-50/70 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-800">
              <div className="text-[11px] font-bold text-indigo-700 dark:text-indigo-300">Tim Finance ({metrics.financeCount})</div>
              <div className="text-sm font-black text-indigo-950 dark:text-white font-mono tabular-nums mt-0.5">
                Rp {metrics.financeNominal.toLocaleString('id-ID')}
              </div>
            </div>
            <div className="p-3 rounded-xl bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
              <div className="text-[11px] font-bold text-amber-800 dark:text-amber-300">Khusus Sales ({metrics.salesCount})</div>
              <div className="text-sm font-black text-amber-950 dark:text-white font-mono tabular-nums mt-0.5">
                Rp {metrics.salesNominal.toLocaleString('id-ID')}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Regional Receivable Chart + Quick Menu Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        <div className="lg:col-span-8 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
            <div>
              <h2 className="text-sm font-black text-slate-900 dark:text-white">
                Rekapitulasi Piutang &amp; Pelunasan Per Wilayah
              </h2>
              <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
                Perbandingan saldo piutang terutang vs nilai yang sudah dibayarkan per wilayah pelanggan
              </p>
            </div>
            <span className="text-xs font-mono tabular-nums text-slate-600 dark:text-slate-400">
              Tempo: <strong className="text-slate-900 dark:text-white">{formatCompactRp(metrics.tempoNominal)}</strong> · COD:{' '}
              <strong className="text-slate-900 dark:text-white">{formatCompactRp(metrics.codNominal)}</strong>
            </span>
          </div>

          <div className="h-60 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={metrics.regionChartData} margin={{ top: 10, right: 16, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#64748b" opacity={0.18} />
                <XAxis dataKey="region" tick={{ fontSize: 10, fontWeight: 700 }} />
                <YAxis tick={{ fontSize: 11 }} unit=" Jt" />
                <Tooltip
                  contentStyle={{
                    borderRadius: '12px',
                    backgroundColor: '#0f172a',
                    color: '#ffffff',
                    fontSize: '12px'
                  }}
                />
                <Legend wrapperStyle={{ fontSize: '11px', fontWeight: 700 }} />
                <Bar dataKey="terutangJuta" name="Sisa Terutang (Juta Rp)" fill="#f59e0b" radius={[6, 6, 0, 0]} />
                <Bar dataKey="terbayarJuta" name="Sudah Terbayar (Juta Rp)" fill="#10b981" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Sub-Menu Navigation Panel */}
        <div className="lg:col-span-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs flex flex-col justify-between space-y-3">
          <div>
            <h2 className="text-sm font-black text-slate-900 dark:text-white">
              Navigasi Sub-Menu Finance &amp; Tax
            </h2>
            <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
              Akses cepat modul operasional keuangan &amp; validasi pengiriman
            </p>
          </div>

          <div className="space-y-2.5 flex-1 flex flex-col justify-center">
            <button
              type="button"
              onClick={() => onNavigateTab('finance_dashboard')}
              className="w-full p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 hover:border-indigo-500 flex items-center justify-between text-left transition cursor-pointer group"
            >
              <div className="flex items-center gap-3">
                <FileText className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <div>
                  <div className="text-xs font-bold text-slate-900 dark:text-white">Finance &amp; Tagihan Pelanggan</div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400">Buku besar &amp; pencatatan pembayaran</div>
                </div>
              </div>
              <ArrowUpRight className="w-4 h-4 text-slate-400 group-hover:text-indigo-500" />
            </button>

            <button
              type="button"
              onClick={() => onNavigateTab('finance_customer_mapping')}
              className="w-full p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 hover:border-indigo-500 flex items-center justify-between text-left transition cursor-pointer group"
            >
              <div className="flex items-center gap-3">
                <Users className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
                <div>
                  <div className="text-xs font-bold text-slate-900 dark:text-white">Mapping Master Pelanggan</div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400">Kategori Tempo/COD &amp; limit piutang</div>
                </div>
              </div>
              <ArrowUpRight className="w-4 h-4 text-slate-400 group-hover:text-indigo-500" />
            </button>

            <button
              type="button"
              onClick={() => onNavigateTab('finance_validasi_form_kirim')}
              className="w-full p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 hover:border-indigo-500 flex items-center justify-between text-left transition cursor-pointer group"
            >
              <div className="flex items-center gap-3">
                <ShieldCheck className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
                <div>
                  <div className="text-xs font-bold text-slate-900 dark:text-white">Validasi Form Kirim</div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400">
                    {metrics.pendingFkCount} Form Kirim menunggu persetujuan
                  </div>
                </div>
              </div>
              <ArrowUpRight className="w-4 h-4 text-slate-400 group-hover:text-indigo-500" />
            </button>

            <button
              type="button"
              onClick={() => onNavigateTab('finance_billing_app')}
              className="w-full p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 hover:border-indigo-500 flex items-center justify-between text-left transition cursor-pointer group"
            >
              <div className="flex items-center gap-3">
                <Smartphone className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                <div>
                  <div className="text-xs font-bold text-slate-900 dark:text-white">Aplikasi Penagihan Pelanggan</div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400">Mode lapangan kolektor &amp; foto bukti</div>
                </div>
              </div>
              <ArrowUpRight className="w-4 h-4 text-slate-400 group-hover:text-indigo-500" />
            </button>
          </div>
        </div>
      </div>

      {/* Priority Over-Limit & Overdue Customer Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
          <div>
            <h2 className="text-sm font-black text-slate-900 dark:text-white">
              Prioritas Tindak Lanjut Piutang &amp; Pelanggan Over-Limit
            </h2>
            <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
              Diurutkan berdasarkan pelanggaran plafon limit dan keterlambatan hari tertinggi
            </p>
          </div>
          <span className="text-xs font-mono tabular-nums text-slate-600 dark:text-slate-400">
            Menampilkan {Math.min(10, metrics.priorityCustomers.length)} dari {metrics.priorityCustomers.length} pelanggan aktif
          </span>
        </div>

        {metrics.priorityCustomers.length === 0 ? (
          <div className="p-8 text-center rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs text-slate-500">
            Seluruh tagihan pelanggan pada filter ini telah lunas atau belum ada faktur terdaftar.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-950 text-[11px] uppercase font-bold text-slate-600 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="py-3 px-4">Pelanggan / Toko</th>
                  <th className="py-3 px-3">Wilayah</th>
                  <th className="py-3 px-3">Kategori</th>
                  <th className="py-3 px-3">Tim</th>
                  <th className="py-3 px-3 text-right">Faktur</th>
                  <th className="py-3 px-3 text-right">Plafon Limit</th>
                  <th className="py-3 px-3 text-right">Sisa Terutang</th>
                  <th className="py-3 px-3">Status Limit &amp; Tempo</th>
                  <th className="py-3 px-4 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {metrics.priorityCustomers.slice(0, 10).map(cust => (
                  <tr key={cust.customerName} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition">
                    <td className="py-3 px-4 font-bold text-slate-900 dark:text-white">{cust.customerName}</td>
                    <td className="py-3 px-3 text-slate-600 dark:text-slate-300 font-medium">{cust.region}</td>
                    <td className="py-3 px-3 font-mono font-bold text-slate-700 dark:text-slate-300">
                      <span className="inline-flex items-center gap-1">
                        <CreditCard className="w-3 h-3 text-slate-400" />
                        {cust.paymentCategory}
                      </span>
                    </td>
                    <td className="py-3 px-3">
                      <span
                        className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                          cust.primaryTeam === 'SALES'
                            ? 'bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-200'
                            : 'bg-indigo-100 dark:bg-indigo-900/40 text-indigo-800 dark:text-indigo-200'
                        }`}
                      >
                        {cust.primaryTeam === 'SALES' ? 'Khusus Sales' : 'Tim Finance'}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-right font-mono tabular-nums text-slate-700 dark:text-slate-300">
                      {cust.invoiceCount}
                    </td>
                    <td className="py-3 px-3 text-right font-mono tabular-nums text-slate-600 dark:text-slate-400">
                      {cust.limit > 0 ? `Rp ${cust.limit.toLocaleString('id-ID')}` : 'COD (0)'}
                    </td>
                    <td className="py-3 px-3 text-right font-mono tabular-nums font-black text-slate-900 dark:text-white">
                      Rp {cust.terutang.toLocaleString('id-ID')}
                    </td>
                    <td className="py-3 px-3">
                      {cust.isOverLimit ? (
                        <span className="text-rose-700 dark:text-rose-300 font-bold text-[11px]">
                          Over Limit (+Rp {cust.overLimitAmount.toLocaleString('id-ID')})
                        </span>
                      ) : cust.maxOverdueDays > 0 ? (
                        <span className="text-amber-700 dark:text-amber-300 font-bold text-[11px]">
                          Lewat Tempo {cust.maxOverdueDays} Hari
                        </span>
                      ) : (
                        <span className="text-emerald-700 dark:text-emerald-400 font-semibold text-[11px]">Lancar</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        type="button"
                        onClick={() => onNavigateTab('finance_dashboard')}
                        className="px-2.5 py-1 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-600 hover:text-white text-indigo-700 dark:text-indigo-300 font-bold text-[11px] transition cursor-pointer whitespace-nowrap"
                      >
                        Detail Tagihan
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
