import React, { useMemo, useRef, useState } from 'react';
import * as XLSX from 'xlsx';
import {
  AlertCircle,
  AlertTriangle,
  Building2,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock,
  CreditCard,
  DollarSign,
  Download,
  Edit3,
  FileSpreadsheet,
  Filter,
  Layers,
  MapPin,
  MessageSquare,
  Plus,
  Printer,
  Search,
  ShieldAlert,
  Trash2,
  Upload,
  Users,
  X
} from 'lucide-react';
import type { BranchRecord } from '../../services/branchStore';
import {
  computeInvoiceAgingDays,
  formatIndonesianShortDate,
  getInvoiceStatus,
  type CustomerMasterRecord,
  type CustomerUnpaidInvoice
} from '../DepartmentDashboard';

interface LedgerCustomerGroup {
  customerName: string;
  region: string;
  contactPhone: string;
  paymentCategory: 'TEMPO' | 'COD';
  tempoDays: number;
  limitPelanggan: number;
  invoices: CustomerUnpaidInvoice[];
  totalTagihan: number;
  totalBayar: number;
  totalTerutang: number;
  sisaLimit: number;
  maxOverdueDays: number;
}

interface LedgerRegionGroup {
  region: string;
  customers: LedgerCustomerGroup[];
  totalTerutangRegion: number;
  totalBayarRegion: number;
  invoiceCountRegion: number;
}

export interface FinanceMonitoringLedgerProps {
  invoices: CustomerUnpaidInvoice[];
  masterCustomers: CustomerMasterRecord[];
  branches: BranchRecord[];
  branchFilter: string;
  setBranchFilter: (v: string) => void;
  billingTeamFilter?: 'ALL' | 'FINANCE' | 'SALES';
  setBillingTeamFilter?: (v: 'ALL' | 'FINANCE' | 'SALES') => void;
  searchQuery: string;
  setSearchQuery: (v: string) => void;
  statusFilter: string;
  setStatusFilter: (v: string) => void;
  agingFilter: string;
  setAgingFilter: (v: string) => void;
  onOpenAddModal: (prefillCustomer?: {
    customerName: string;
    region: string;
    limitPelanggan: number;
    paymentCategory: 'TEMPO' | 'COD';
    billingTeam?: 'FINANCE' | 'SALES';
  }) => void;
  onOpenPaymentModal: (inv: CustomerUnpaidInvoice) => void;
  onDeleteInvoice: (id: string) => void;
  onOpenWaModal: (inv: CustomerUnpaidInvoice) => void;
  onOpenPrintModal: (inv: CustomerUnpaidInvoice) => void;
  onImportInvoices: (newInvoices: CustomerUnpaidInvoice[], updatedMasters?: CustomerMasterRecord[]) => void;
  onSwitchToMapping?: () => void;
  onOpenBillingApp?: (team?: 'ALL' | 'FINANCE' | 'SALES') => void;
}

export const FinanceMonitoringLedgerView: React.FC<FinanceMonitoringLedgerProps> = ({
  invoices,
  masterCustomers,
  branches,
  branchFilter,
  setBranchFilter,
  billingTeamFilter = 'ALL',
  setBillingTeamFilter,
  searchQuery,
  setSearchQuery,
  statusFilter,
  setStatusFilter,
  agingFilter,
  setAgingFilter,
  onOpenAddModal,
  onOpenPaymentModal,
  onDeleteInvoice,
  onOpenWaModal,
  onOpenPrintModal,
  onImportInvoices,
  onSwitchToMapping,
  onOpenBillingApp
}) => {
  const [viewMode, setViewMode] = useState<'excel_ledger' | 'flat_table'>('excel_ledger');
  const [localTeamFilter, setLocalTeamFilter] = useState<'ALL' | 'FINANCE' | 'SALES'>(billingTeamFilter);
  const activeTeamFilter = setBillingTeamFilter ? billingTeamFilter : localTeamFilter;
  const handleSelectTeamFilter = (team: 'ALL' | 'FINANCE' | 'SALES') => {
    if (setBillingTeamFilter) {
      setBillingTeamFilter(team);
    } else {
      setLocalTeamFilter(team);
    }
  };
  const [regionFilter, setRegionFilter] = useState<string>('ALL');
  const [collapsedRegions, setCollapsedRegions] = useState<Record<string, boolean>>({});
  const [collapsedCustomers, setCollapsedCustomers] = useState<Record<string, boolean>>({});
  const excelInputRef = useRef<HTMLInputElement | null>(null);

  // Distinct Wilayah list from invoices & master customers
  const regionOptions = useMemo(() => {
    const set = new Set<string>();
    invoices.forEach(inv => {
      if (inv.region?.trim()) set.add(inv.region.trim().toUpperCase());
    });
    masterCustomers.forEach(c => {
      if (c.region?.trim()) set.add(c.region.trim().toUpperCase());
    });
    return Array.from(set).sort();
  }, [invoices, masterCustomers]);

  // Customer lookup map
  const masterLookup = useMemo(() => {
    const map = new Map<string, CustomerMasterRecord>();
    masterCustomers.forEach(c => {
      map.set(c.customerName.trim().toUpperCase(), c);
    });
    return map;
  }, [masterCustomers]);

  // Filtered invoices
  const filteredInvoices = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const selectedMasterBranch = branches.find(
      b => b.name.toLowerCase() === branchFilter.toLowerCase() || b.slug.toLowerCase() === branchFilter.toLowerCase()
    );

    return invoices.filter(inv => {
      const sisa = Math.max(0, inv.totalTagihan - inv.jumlahTerbayar);
      const st = getInvoiceStatus(inv);
      const agingDays = computeInvoiceAgingDays(inv.dueDate);

      const matchSearch =
        !q ||
        inv.noInvoice.toLowerCase().includes(q) ||
        inv.noSuratJalan.toLowerCase().includes(q) ||
        inv.customerName.toLowerCase().includes(q) ||
        inv.region.toLowerCase().includes(q) ||
        (inv.notes || '').toLowerCase().includes(q);

      let matchStatus = true;
      if (statusFilter === 'UNPAID_ONLY') {
        matchStatus = sisa > 0;
      } else if (statusFilter !== 'ALL') {
        matchStatus = st === statusFilter;
      }

      let matchAging = true;
      if (agingFilter === 'NOT_DUE') {
        matchAging = agingDays <= 0 && sisa > 0;
      } else if (agingFilter === 'OVERDUE_1_7') {
        matchAging = agingDays >= 1 && agingDays <= 7 && sisa > 0;
      } else if (agingFilter === 'OVERDUE_8_14') {
        matchAging = agingDays >= 8 && agingDays <= 14 && sisa > 0;
      } else if (agingFilter === 'OVERDUE_1_14') {
        matchAging = agingDays >= 1 && agingDays <= 14 && sisa > 0;
      } else if (agingFilter === 'OVERDUE_15_30') {
        matchAging = agingDays >= 15 && agingDays <= 30 && sisa > 0;
      } else if (agingFilter === 'OVERDUE_30_PLUS') {
        matchAging = agingDays > 30 && sisa > 0;
      }

      let matchRegion = true;
      if (regionFilter !== 'ALL') {
        matchRegion = inv.region.trim().toUpperCase() === regionFilter;
      }

      let matchBranch = true;
      if (branchFilter !== 'ALL') {
        const regLower = inv.region.toLowerCase();
        const bfLower = branchFilter.toLowerCase();
        matchBranch =
          regLower.includes(bfLower) ||
          Boolean(
            selectedMasterBranch &&
              (regLower.includes(selectedMasterBranch.name.toLowerCase()) ||
                regLower.includes(selectedMasterBranch.slug.toLowerCase()) ||
                regLower.includes((selectedMasterBranch.city || '').toLowerCase()))
          );
      }

      let matchTeam = true;
      if (activeTeamFilter !== 'ALL') {
        const invTeam = inv.billingTeam || 'FINANCE';
        matchTeam = invTeam === activeTeamFilter;
      }

      return matchSearch && matchStatus && matchAging && matchRegion && matchBranch && matchTeam;
    });
  }, [invoices, searchQuery, statusFilter, agingFilter, regionFilter, branchFilter, branches, activeTeamFilter]);

  // Team breakdown metrics (Tim Penagihan Finance vs Tagihan Khusus Sales)
  const teamBreakdown = useMemo(() => {
    let financeCount = 0;
    let financeTerutang = 0;
    let salesCount = 0;
    let salesTerutang = 0;
    invoices.forEach(inv => {
      const sisa = Math.max(0, inv.totalTagihan - inv.jumlahTerbayar);
      const team = inv.billingTeam || 'FINANCE';
      if (team === 'SALES') {
        salesCount += 1;
        salesTerutang += sisa;
      } else {
        financeCount += 1;
        financeTerutang += sisa;
      }
    });
    return { financeCount, financeTerutang, salesCount, salesTerutang };
  }, [invoices]);

  // Group invoices into Wilayah -> Pelanggan -> Faktur hierarchy matching Excel screenshot
  const ledgerGroups = useMemo<LedgerRegionGroup[]>(() => {
    const regionMap = new Map<string, Map<string, CustomerUnpaidInvoice[]>>();

    filteredInvoices.forEach(inv => {
      const regKey = (inv.region || 'LAINNYA').trim().toUpperCase();
      const custKey = (inv.customerName || 'TANPA NAMA').trim().toUpperCase();
      if (!regionMap.has(regKey)) {
        regionMap.set(regKey, new Map());
      }
      const custMap = regionMap.get(regKey)!;
      if (!custMap.has(custKey)) {
        custMap.set(custKey, []);
      }
      custMap.get(custKey)!.push(inv);
    });

    const groups: LedgerRegionGroup[] = [];
    regionMap.forEach((custMap, regionName) => {
      const customers: LedgerCustomerGroup[] = [];
      let totalTerutangRegion = 0;
      let totalBayarRegion = 0;
      let invoiceCountRegion = 0;

      custMap.forEach((custInvoices, customerName) => {
        const master = masterLookup.get(customerName);
        const firstInv = custInvoices[0];
        const limitPelanggan =
          master?.creditLimit ??
          firstInv?.limitPelanggan ??
          0;
        const paymentCategory: 'TEMPO' | 'COD' =
          master?.paymentCategory ??
          firstInv?.paymentCategory ??
          (limitPelanggan > 0 ? 'TEMPO' : 'COD');
        const tempoDays = master?.tempoDays ?? firstInv?.tempoDays ?? (paymentCategory === 'TEMPO' ? 7 : 0);

        let totalTagihan = 0;
        let totalBayar = 0;
        let totalTerutang = 0;
        let maxOverdueDays = -999;

        custInvoices.forEach(inv => {
          const sisa = Math.max(0, inv.totalTagihan - inv.jumlahTerbayar);
          totalTagihan += inv.totalTagihan;
          totalBayar += inv.jumlahTerbayar;
          totalTerutang += sisa;
          if (sisa > 0) {
            const aging = computeInvoiceAgingDays(inv.dueDate);
            if (aging > maxOverdueDays) maxOverdueDays = aging;
          }
        });

        if (maxOverdueDays === -999) maxOverdueDays = 0;
        const sisaLimit = limitPelanggan - totalTerutang;

        customers.push({
          customerName,
          region: regionName,
          contactPhone: master?.contactPhone || firstInv?.contactPhone || '-',
          paymentCategory,
          tempoDays,
          limitPelanggan,
          invoices: custInvoices,
          totalTagihan,
          totalBayar,
          totalTerutang,
          sisaLimit,
          maxOverdueDays
        });

        totalTerutangRegion += totalTerutang;
        totalBayarRegion += totalBayar;
        invoiceCountRegion += custInvoices.length;
      });

      groups.push({
        region: regionName,
        customers,
        totalTerutangRegion,
        totalBayarRegion,
        invoiceCountRegion
      });
    });

    return groups;
  }, [filteredInvoices, masterLookup]);

  // Top-level KPI summary
  const summaryStats = useMemo(() => {
    let totalTerutang = 0;
    let totalBayar = 0;
    let totalOverdue = 0;
    let overdueCount = 0;
    const customerSet = new Set<string>();
    let overlimitCustomerCount = 0;

    ledgerGroups.forEach(rg => {
      rg.customers.forEach(cg => {
        customerSet.add(cg.customerName);
        if (cg.paymentCategory === 'TEMPO' && cg.limitPelanggan > 0 && cg.totalTerutang > cg.limitPelanggan) {
          overlimitCustomerCount += 1;
        }
        cg.invoices.forEach(inv => {
          const sisa = Math.max(0, inv.totalTagihan - inv.jumlahTerbayar);
          totalTerutang += sisa;
          totalBayar += inv.jumlahTerbayar;
          if (sisa > 0 && computeInvoiceAgingDays(inv.dueDate) > 0) {
            totalOverdue += sisa;
            overdueCount += 1;
          }
        });
      });
    });

    return {
      totalTerutang,
      totalBayar,
      totalOverdue,
      overdueCount,
      totalCustomers: customerSet.size,
      overlimitCustomerCount
    };
  }, [ledgerGroups]);

  // Export Hierarchical Excel matching screenshot layout
  const handleExportHierarchicalExcel = () => {
    const aoa: (string | number)[][] = [
      ['WILAYAH / PELANGGAN', 'No. Faktur', 'Tgl Faktur', 'Jatuh Tempo', 'Terutang', 'Bayar', 'Keterangan', 'Limit Pelanggan']
    ];

    ledgerGroups.forEach(rg => {
      // Region header row
      aoa.push([rg.region, '', '', '', '', '', '', '']);
      rg.customers.forEach(cg => {
        // Customer header row
        aoa.push([`  ${cg.customerName}`, '', '', '', '', '', '', '']);
        // Invoice rows
        cg.invoices.forEach(inv => {
          const sisa = Math.max(0, inv.totalTagihan - inv.jumlahTerbayar);
          aoa.push([
            '',
            inv.noInvoice,
            formatIndonesianShortDate(inv.invoiceDate),
            formatIndonesianShortDate(inv.dueDate),
            sisa,
            inv.jumlahTerbayar > 0 ? inv.jumlahTerbayar : '',
            inv.notes || '',
            inv.limitPelanggan ?? cg.limitPelanggan
          ]);
        });
        // Customer subtotal row
        aoa.push(['', '', '', '', cg.totalTerutang, cg.totalBayar > 0 ? cg.totalBayar : '', '', '']);
      });
    });

    const ws = XLSX.utils.aoa_to_sheet(aoa);
    ws['!cols'] = [
      { wch: 24 },
      { wch: 18 },
      { wch: 14 },
      { wch: 14 },
      { wch: 16 },
      { wch: 14 },
      { wch: 24 },
      { wch: 16 }
    ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Daftar_Tagihan_Piutang');
    XLSX.writeFile(wb, `Daftar_Tagihan_Piutang_Pelanggan_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  // State Halaman Upload File Excel Daftar Tagihan (Pilihan Ditujukan ke Aplikasi Finance atau Sales)
  const [isUploadExcelPageOpen, setIsUploadExcelPageOpen] = useState(false);
  const [uploadTargetTeam, setUploadTargetTeam] = useState<'FINANCE' | 'SALES'>(
    activeTeamFilter === 'SALES' ? 'SALES' : 'FINANCE'
  );
  const [uploadSalesPersonName, setUploadSalesPersonName] = useState<string>('Tim Sales AKK');
  const [uploadExcelFileName, setUploadExcelFileName] = useState<string>('');
  const [uploadPreviewInvoices, setUploadPreviewInvoices] = useState<CustomerUnpaidInvoice[]>([]);
  const [showUploadPreviewTable, setShowUploadPreviewTable] = useState<boolean>(false);

  // Parse Uploaded Excel (supports both Hierarchical Excel like image_558b93f8.png and flat columns)
  const handleExcelFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = evt => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsName = wb.SheetNames[0];
        const ws = wb.Sheets[wsName];
        const rows = XLSX.utils.sheet_to_json<(string | number)[]>(ws, { header: 1, defval: '' });

        let currentRegion = 'ROGOJAMPI';
        let currentCustomer = '';
        const parsedInvoices: CustomerUnpaidInvoice[] = [];

        const parseExcelDateToIso = (val: string | number): string => {
          if (!val) return '2026-11-10';
          if (typeof val === 'number') {
            const d = XLSX.SSF.parse_date_code(val);
            if (d) {
              return `${d.y}-${String(d.m).padStart(2, '0')}-${String(d.d).padStart(2, '0')}`;
            }
          }
          const str = String(val).trim();
          if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;
          const monthMap: Record<string, string> = {
            jan: '01', feb: '02', mar: '03', apr: '04', mei: '05', may: '05',
            jun: '06', jul: '07', ags: '08', aug: '08', sep: '09', okt: '10',
            oct: '10', nop: '11', nov: '11', des: '12', dec: '12'
          };
          const parts = str.split(/[\s/-]+/);
          if (parts.length === 3) {
            const d = parts[0].padStart(2, '0');
            const mKey = parts[1].toLowerCase().slice(0, 3);
            const m = monthMap[mKey] || parts[1].padStart(2, '0');
            const y = parts[2].length === 2 ? `20${parts[2]}` : parts[2];
            return `${y}-${m}-${d}`;
          }
          return '2026-11-10';
        };

        const parseNum = (v: string | number): number => {
          if (typeof v === 'number') return v;
          const cleaned = String(v).replace(/[^\d,-]/g, '').replace(/\./g, '').replace(',', '.');
          const n = parseFloat(cleaned);
          return isNaN(n) ? 0 : n;
        };

        rows.forEach((row, idx) => {
          if (!Array.isArray(row) || row.length === 0) return;
          const c0 = String(row[0] ?? '').trim();
          const c1 = String(row[1] ?? '').trim();
          const c2 = String(row[2] ?? '').trim();
          const c3 = String(row[3] ?? '').trim();
          const c4 = row[4] ?? '';

          // Skip header row
          if (
            c0.toLowerCase().includes('no. faktur') ||
            c1.toLowerCase().includes('no. faktur') ||
            c2.toLowerCase().includes('no. faktur')
          ) {
            return;
          }

          // Detect if row has an invoice code (e.g., FJ02-..., INV/...)
          const invoiceColIdx = [0, 1, 2].find(i =>
            /^(FJ|INV|SO|FAK)/i.test(String(row[i] ?? '').trim())
          );

          if (invoiceColIdx !== undefined) {
            const noFaktur = String(row[invoiceColIdx]).trim().toUpperCase();
            const tglFaktur = parseExcelDateToIso(row[invoiceColIdx + 1] ?? '');
            const jatuhTempo = parseExcelDateToIso(row[invoiceColIdx + 2] ?? '');
            const terutang = parseNum(row[invoiceColIdx + 3] ?? 0);
            const bayar = parseNum(row[invoiceColIdx + 4] ?? 0);
            const keterangan = String(row[invoiceColIdx + 5] ?? '').trim();
            const limitPelanggan = parseNum(row[invoiceColIdx + 6] ?? 0);

            if (noFaktur && terutang >= 0) {
              parsedInvoices.push({
                id: `INV-XLS-${Date.now()}-${idx}`,
                noInvoice: noFaktur,
                noSuratJalan: `SJ-${noFaktur}`,
                customerName: currentCustomer || 'PELANGGAN UMUM',
                contactPhone: '-',
                region: currentRegion || 'ROGOJAMPI',
                invoiceDate: tglFaktur,
                dueDate: jatuhTempo,
                itemSummary: 'Faktur Tagihan Pelanggan',
                totalTagihan: terutang + bayar,
                jumlahTerbayar: bayar,
                limitPelanggan: limitPelanggan || 2000000,
                paymentCategory: 'TEMPO',
                tempoDays: 7,
                billingTeam: uploadTargetTeam,
                salesPersonName: uploadTargetTeam === 'SALES' ? uploadSalesPersonName.trim() || 'Tim Sales AKK' : undefined,
                notes: keterangan
              });
            }
            return;
          }

          // Otherwise check if it's a Region header or Customer header
          const nonEmptyText = c0 || c1;
          if (nonEmptyText && !c2 && !c3 && parseNum(c4) === 0) {
            if (c0 && !c1) {
              if (/^(ROGOJAMPI|SUMBER AYU|BANYUWANGI|GENTENG|JAJAG|MUNCAR|SRONO|GLENMORE|KALIBARU|SINGOJURUH|KABAT|CLURING)/i.test(c0) && !/^(BP |BU |TK |TOKO |UD |CV |PT |H )/i.test(c0)) {
                currentRegion = c0.toUpperCase();
              } else {
                currentCustomer = c0.toUpperCase();
              }
            } else if (!c0 && c1) {
              currentCustomer = c1.toUpperCase();
            }
          }
        });

        setUploadExcelFileName(file.name);
        setUploadPreviewInvoices(parsedInvoices);
        setShowUploadPreviewTable(true);
      } catch {}
    };
    reader.readAsBinaryString(file);
    e.target.value = '';
  };

  const handleConfirmUploadExcelInvoices = () => {
    const finalInvoices = (uploadPreviewInvoices.length > 0 ? uploadPreviewInvoices : []).map(inv => ({
      ...inv,
      billingTeam: uploadTargetTeam,
      salesPersonName:
        uploadTargetTeam === 'SALES' ? uploadSalesPersonName.trim() || 'Tim Sales AKK' : undefined
    }));
    if (finalInvoices.length === 0) return;
    onImportInvoices(finalInvoices);
    handleSelectTeamFilter(uploadTargetTeam);
    setIsUploadExcelPageOpen(false);
    setUploadExcelFileName('');
    setUploadPreviewInvoices([]);
    setShowUploadPreviewTable(false);
  };

  const toggleRegion = (reg: string) => {
    setCollapsedRegions(prev => ({ ...prev, [reg]: !prev[reg] }));
  };

  const toggleCustomer = (custKey: string) => {
    setCollapsedCustomers(prev => ({ ...prev, [custKey]: !prev[custKey] }));
  };

  // ===========================================================================
  // DEDICATED SUB-PAGE: UPLOAD EXCEL DAFTAR TAGIHAN (PILIHAN FINANCE ATAU SALES)
  // ===========================================================================
  if (isUploadExcelPageOpen) {
    const previewCustomerCount = new Set(
      uploadPreviewInvoices.map(i => i.customerName.trim().toUpperCase())
    ).size;
    const previewTotalTerutang = uploadPreviewInvoices.reduce(
      (sum, i) => sum + Math.max(0, i.totalTagihan - i.jumlahTerbayar),
      0
    );

    return (
      <div className="space-y-5 animate-fade-in">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 sm:p-7 shadow-sm space-y-6">
          {/* Header Halaman Upload Excel Tagihan */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-5 border-b border-slate-100 dark:border-slate-800">
            <div>
              <div className="flex flex-wrap items-center gap-2 mb-1">
                <span className="px-2.5 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-500/30 text-[10px] font-mono font-black uppercase tracking-wider">
                  IMPORT BUKU BESAR TAGIHAN
                </span>
                <span
                  className={`px-2.5 py-0.5 rounded-md text-[10px] font-extrabold border ${
                    uploadTargetTeam === 'FINANCE'
                      ? 'bg-indigo-50 dark:bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-500/30'
                      : 'bg-amber-50 dark:bg-amber-500/15 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-500/30'
                  }`}
                >
                  Tujuan: {uploadTargetTeam === 'FINANCE' ? 'Aplikasi Penagihan Finance' : 'Aplikasi Penagihan Sales'}
                </span>
              </div>
              <h2 className="text-lg sm:text-xl font-black text-slate-900 dark:text-white tracking-tight">
                Upload File Excel Daftar Tagihan &amp; Piutang Pelanggan
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Pilih tujuan aplikasi penagihan (Finance atau Sales), lalu unggah file Excel daftar tagihan untuk diintegrasikan secara otomatis.
              </p>
            </div>

            <button
              type="button"
              onClick={() => {
                setIsUploadExcelPageOpen(false);
                setUploadExcelFileName('');
                setUploadPreviewInvoices([]);
                setShowUploadPreviewTable(false);
              }}
              className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold flex items-center gap-1.5 transition cursor-pointer self-start lg:self-auto"
            >
              <X className="w-3.5 h-3.5" />
              <span>Kembali ke Monitoring Tagihan</span>
            </button>
          </div>

          {/* Pilihan Tujuan Aplikasi: Finance vs Sales */}
          <div className="space-y-2.5">
            <label className="block text-[11px] font-black uppercase tracking-wider text-slate-600 dark:text-slate-300">
              1. PILIH TUJUAN APLIKASI PENAGIHAN *
            </label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              <button
                type="button"
                onClick={() => {
                  setUploadTargetTeam('FINANCE');
                  setUploadPreviewInvoices(prev =>
                    prev.map(inv => ({ ...inv, billingTeam: 'FINANCE', salesPersonName: undefined }))
                  );
                }}
                className={`p-4 rounded-2xl border text-left transition-all cursor-pointer ${
                  uploadTargetTeam === 'FINANCE'
                    ? 'border-indigo-600 bg-indigo-50/70 dark:bg-indigo-950/40 ring-2 ring-indigo-500/20 shadow-xs'
                    : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-indigo-400'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[10px] font-black uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                    TIM PENAGIHAN FINANCE
                  </span>
                  <span
                    className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                      uploadTargetTeam === 'FINANCE'
                        ? 'border-indigo-600 bg-indigo-600 text-white'
                        : 'border-slate-300 dark:border-slate-600'
                    }`}
                  >
                    {uploadTargetTeam === 'FINANCE' && <CheckCircle2 className="w-3 h-3" />}
                  </span>
                </div>
                <div className="text-sm sm:text-base font-black text-slate-900 dark:text-white mt-1">
                  Ditujukan ke Aplikasi Penagihan Finance
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Data tagihan masuk ke Buku Besar Finance &amp; langsung terintegrasi pada menu <strong>Finance &amp; Tax &rarr; Aplikasi Penagihan Pelanggan</strong>.
                </p>
              </button>

              <button
                type="button"
                onClick={() => {
                  setUploadTargetTeam('SALES');
                  setUploadPreviewInvoices(prev =>
                    prev.map(inv => ({
                      ...inv,
                      billingTeam: 'SALES',
                      salesPersonName: uploadSalesPersonName.trim() || 'Tim Sales AKK'
                    }))
                  );
                }}
                className={`p-4 rounded-2xl border text-left transition-all cursor-pointer ${
                  uploadTargetTeam === 'SALES'
                    ? 'border-amber-500 bg-amber-50/70 dark:bg-amber-950/40 ring-2 ring-amber-500/20 shadow-xs'
                    : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-amber-400'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[10px] font-black uppercase tracking-wider text-amber-700 dark:text-amber-400">
                    TAGIHAN KHUSUS SALES
                  </span>
                  <span
                    className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                      uploadTargetTeam === 'SALES'
                        ? 'border-amber-500 bg-amber-500 text-white'
                        : 'border-slate-300 dark:border-slate-600'
                    }`}
                  >
                    {uploadTargetTeam === 'SALES' && <CheckCircle2 className="w-3 h-3" />}
                  </span>
                </div>
                <div className="text-sm sm:text-base font-black text-slate-900 dark:text-white mt-1">
                  Ditujukan ke Aplikasi Penagihan Sales
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Data tagihan masuk ke daftar Tagihan Khusus Sales &amp; langsung terintegrasi pada menu <strong>Marketing &rarr; Aplikasi Penagihan Pelanggan</strong>.
                </p>
              </button>
            </div>

            {uploadTargetTeam === 'SALES' && (
              <div className="pt-2 max-w-md">
                <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Nama PIC Sales Penagihan (Opsional)
                </label>
                <input
                  type="text"
                  value={uploadSalesPersonName}
                  onChange={e => {
                    const val = e.target.value;
                    setUploadSalesPersonName(val);
                    setUploadPreviewInvoices(prev =>
                      prev.map(inv => ({ ...inv, salesPersonName: val.trim() || 'Tim Sales AKK' }))
                    );
                  }}
                  placeholder="Contoh: Rendra Saputra / Dina Mariana"
                  className="w-full px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs font-bold text-slate-900 dark:text-white"
                />
              </div>
            )}
          </div>

          {/* Input File Excel */}
          <div className="space-y-2.5">
            <label className="block text-[11px] font-black uppercase tracking-wider text-slate-600 dark:text-slate-300">
              2. PILIH FILE EXCEL DAFTAR TAGIHAN (.XLSX / .XLS / .CSV)
            </label>
            <div className="p-4 rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-700 hover:border-indigo-400 bg-slate-50/60 dark:bg-slate-950/50 transition flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <input
                ref={excelInputRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={handleExcelFileUpload}
                className="w-full sm:w-auto text-xs text-slate-700 dark:text-slate-300 file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:bg-emerald-600 file:text-xs file:font-bold file:text-white hover:file:bg-emerald-500 file:shadow-xs file:cursor-pointer cursor-pointer"
              />
              {uploadExcelFileName && (
                <div className="px-3 py-1.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-xs font-bold text-emerald-700 dark:text-emerald-300 flex items-center gap-2 shrink-0">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>
                    {uploadExcelFileName} ({uploadPreviewInvoices.length} Faktur • {previewCustomerCount} Pelanggan)
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Ringkasan Hasil Baca File Excel */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800">
              <div className="text-[10px] font-black uppercase text-slate-500">Total Faktur Terbaca</div>
              <div className="text-lg font-black text-slate-900 dark:text-white mt-0.5 font-mono tabular-nums">
                {uploadPreviewInvoices.length} Faktur
              </div>
            </div>
            <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800">
              <div className="text-[10px] font-black uppercase text-slate-500">Total Pelanggan</div>
              <div className="text-lg font-black text-slate-900 dark:text-white mt-0.5 font-mono tabular-nums">
                {previewCustomerCount} Toko
              </div>
            </div>
            <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800">
              <div className="text-[10px] font-black uppercase text-slate-500">Total Nilai Terutang</div>
              <div className="text-lg font-black text-indigo-600 dark:text-indigo-400 mt-0.5 font-mono tabular-nums">
                Rp {previewTotalTerutang.toLocaleString('id-ID')}
              </div>
            </div>
            <div
              className={`p-3.5 rounded-2xl border ${
                uploadTargetTeam === 'FINANCE'
                  ? 'bg-indigo-50/70 dark:bg-indigo-950/30 border-indigo-200 dark:border-indigo-800'
                  : 'bg-amber-50/70 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800'
              }`}
            >
              <div className="text-[10px] font-black uppercase text-slate-500">Ditujukan Ke Aplikasi</div>
              <div
                className={`text-sm font-black mt-1 ${
                  uploadTargetTeam === 'FINANCE'
                    ? 'text-indigo-700 dark:text-indigo-300'
                    : 'text-amber-800 dark:text-amber-300'
                }`}
              >
                {uploadTargetTeam === 'FINANCE' ? 'Aplikasi Penagihan Finance' : 'Aplikasi Penagihan Sales'}
              </div>
            </div>
          </div>

          {/* Tabel Preview Sebelum Simpan */}
          {showUploadPreviewTable && uploadPreviewInvoices.length > 0 && (
            <div className="pt-4 border-t border-slate-200 dark:border-slate-800 space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs sm:text-sm font-black text-slate-900 dark:text-white">
                  Preview Daftar Tagihan Sebelum Disimpan ({uploadPreviewInvoices.length} Faktur)
                </h4>
              </div>
              <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800 max-h-[360px]">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-50 dark:bg-slate-950 text-slate-600 dark:text-slate-400 uppercase font-bold text-[10px] sticky top-0 border-b border-slate-200 dark:border-slate-800">
                    <tr>
                      <th className="py-2.5 px-3">Wilayah</th>
                      <th className="py-2.5 px-3">Nama Pelanggan</th>
                      <th className="py-2.5 px-3">No. Faktur</th>
                      <th className="py-2.5 px-3">Tgl Faktur</th>
                      <th className="py-2.5 px-3">Jatuh Tempo</th>
                      <th className="py-2.5 px-3 text-right">Terutang</th>
                      <th className="py-2.5 px-3 text-right">Limit Pelanggan</th>
                      <th className="py-2.5 px-3 text-center">Tujuan Aplikasi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                    {uploadPreviewInvoices.map(inv => {
                      const sisa = Math.max(0, inv.totalTagihan - inv.jumlahTerbayar);
                      return (
                        <tr key={inv.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40">
                          <td className="py-2 px-3 font-bold text-slate-700 dark:text-slate-300">{inv.region}</td>
                          <td className="py-2 px-3 font-black text-slate-900 dark:text-white">{inv.customerName}</td>
                          <td className="py-2 px-3 font-mono font-bold text-indigo-600 dark:text-indigo-400">
                            {inv.noInvoice}
                          </td>
                          <td className="py-2 px-3 font-mono">{formatIndonesianShortDate(inv.invoiceDate)}</td>
                          <td className="py-2 px-3 font-mono">{formatIndonesianShortDate(inv.dueDate)}</td>
                          <td className="py-2 px-3 text-right font-mono font-bold tabular-nums">
                            Rp {sisa.toLocaleString('id-ID')}
                          </td>
                          <td className="py-2 px-3 text-right font-mono tabular-nums">
                            Rp {(inv.limitPelanggan || 0).toLocaleString('id-ID')}
                          </td>
                          <td className="py-2 px-3 text-center">
                            <span
                              className={`px-2 py-0.5 rounded-md text-[10px] font-black ${
                                uploadTargetTeam === 'FINANCE'
                                  ? 'bg-indigo-500/15 text-indigo-700 dark:text-indigo-300'
                                  : 'bg-amber-500/15 text-amber-800 dark:text-amber-300'
                              }`}
                            >
                              {uploadTargetTeam === 'FINANCE' ? 'FINANCE' : 'SALES'}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Action Footer */}
          <div className="flex flex-wrap items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => {
                setIsUploadExcelPageOpen(false);
                setUploadExcelFileName('');
                setUploadPreviewInvoices([]);
                setShowUploadPreviewTable(false);
              }}
              className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 text-xs font-bold hover:bg-slate-50 dark:hover:bg-slate-800 transition cursor-pointer"
            >
              Batal
            </button>
            <button
              type="button"
              disabled={uploadPreviewInvoices.length === 0}
              onClick={handleConfirmUploadExcelInvoices}
              className={`px-5 py-2.5 rounded-xl text-white text-xs font-black flex items-center gap-2 shadow-sm transition cursor-pointer disabled:opacity-40 ${
                uploadTargetTeam === 'FINANCE'
                  ? 'bg-indigo-600 hover:bg-indigo-500'
                  : 'bg-amber-600 hover:bg-amber-500'
              }`}
            >
              <Upload className="w-4 h-4" />
              <span>
                Simpan ke {uploadTargetTeam === 'FINANCE' ? 'Aplikasi Penagihan Finance' : 'Aplikasi Penagihan Sales'} (
                {uploadPreviewInvoices.length} Faktur)
              </span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Redesigned High-Contrast Executive Header + Fitur Tagihan Tim Penagihan (Finance) & Tagihan Khusus Sales */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs space-y-4">
        <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-4">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-md bg-indigo-50 dark:bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-500/30 text-[10px] font-mono font-black uppercase tracking-wider">
                FINANCE &amp; SALES AR CONTROL
              </span>
              <span className="px-2.5 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-500/30 text-[10px] font-extrabold">
                Terintegrasi Aplikasi Penagihan Pelanggan
              </span>
            </div>
            <h2 className="text-lg sm:text-xl font-black text-slate-900 dark:text-white tracking-tight">
              Monitoring Tagihan &amp; Piutang Pelanggan
            </h2>
            <p className="text-xs text-slate-600 dark:text-slate-300">
              Rekapitulasi faktur tagihan toko/mitra terintegrasi untuk <strong className="text-indigo-700 dark:text-indigo-300 font-black">Tim Penagihan (Finance)</strong> &amp; <strong className="text-amber-700 dark:text-amber-300 font-black">Tagihan Khusus Sales</strong> per cabang
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Pilih Cabang */}
            <div className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-800 dark:text-slate-200">
              <MapPin className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
              <select
                value={branchFilter}
                onChange={e => setBranchFilter(e.target.value)}
                className="bg-transparent text-xs font-bold text-slate-900 dark:text-white focus:outline-none cursor-pointer"
              >
                <option value="ALL" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white">
                  Semua Cabang ({branches.length})
                </option>
                {branches.map(b => (
                  <option key={b.id} value={b.name} className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white">
                    Cabang {b.name}
                  </option>
                ))}
              </select>
            </div>

            {/* View Switcher */}
            <div className="inline-flex rounded-xl bg-slate-100 dark:bg-slate-950 p-1 border border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setViewMode('excel_ledger')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 cursor-pointer transition ${
                  viewMode === 'excel_ledger'
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                <span>Buku Besar</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode('flat_table')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 cursor-pointer transition ${
                  viewMode === 'flat_table'
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                <span>Rincian Faktur</span>
              </button>
            </div>

            <button
              type="button"
              onClick={() => {
                setUploadTargetTeam(activeTeamFilter === 'SALES' ? 'SALES' : 'FINANCE');
                setUploadExcelFileName('');
                setUploadPreviewInvoices([]);
                setShowUploadPreviewTable(false);
                setIsUploadExcelPageOpen(true);
              }}
              className="px-3 py-2 rounded-xl border border-emerald-200 dark:border-emerald-500/30 bg-emerald-50 dark:bg-emerald-500/15 hover:bg-emerald-100 dark:hover:bg-emerald-500/25 text-emerald-700 dark:text-emerald-200 text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>Upload Excel</span>
            </button>

            <button
              type="button"
              onClick={handleExportHierarchicalExcel}
              className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Ekspor Excel</span>
            </button>

            <button
              type="button"
              onClick={() => onOpenAddModal()}
              className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-black flex items-center gap-1.5 transition cursor-pointer shadow-xs"
            >
              <Plus className="w-4 h-4" />
              <span>Tambah Tagihan</span>
            </button>
          </div>
        </div>

        {/* Kategori Penagihan: Semua Tagihan vs Tim Penagihan (Finance) vs Tagihan Khusus Sales */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-3 border-t border-slate-200 dark:border-slate-800">
          <div
            onClick={() => handleSelectTeamFilter('ALL')}
            className={`p-3.5 rounded-xl border transition cursor-pointer flex items-center justify-between ${
              activeTeamFilter === 'ALL'
                ? 'bg-blue-50/90 dark:bg-blue-950/40 border-blue-400 dark:border-blue-500/60 ring-2 ring-blue-500/15 shadow-xs'
                : 'bg-slate-50/80 dark:bg-slate-950/60 border-slate-200 dark:border-slate-800 hover:border-blue-300 dark:hover:border-slate-700'
            }`}
          >
            <div>
              <div className="text-[10px] font-black uppercase tracking-wider text-slate-600 dark:text-slate-400">
                Semua Daftar Tagihan (Gabungan)
              </div>
              <div className="text-base font-black font-mono text-slate-900 dark:text-white mt-0.5 tabular-nums">
                Rp {(teamBreakdown.financeTerutang + teamBreakdown.salesTerutang).toLocaleString('id-ID')}
              </div>
              <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 mt-0.5">
                {invoices.length} Faktur Aktif (Finance &amp; Sales)
              </div>
            </div>
            <span className="px-2.5 py-1 rounded-lg bg-blue-600 text-white text-[10px] font-black shadow-2xs">
              Semua
            </span>
          </div>

          <div
            onClick={() => handleSelectTeamFilter('FINANCE')}
            className={`p-3.5 rounded-xl border transition cursor-pointer flex items-center justify-between ${
              activeTeamFilter === 'FINANCE'
                ? 'bg-indigo-50/95 dark:bg-indigo-950/45 border-indigo-400 dark:border-indigo-500/60 ring-2 ring-indigo-500/15 shadow-xs'
                : 'bg-slate-50/80 dark:bg-slate-950/60 border-slate-200 dark:border-slate-800 hover:border-indigo-300 dark:hover:border-indigo-500/40'
            }`}
          >
            <div>
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-indigo-600 dark:bg-indigo-400" />
                <span className="text-[10px] font-black uppercase tracking-wider text-indigo-700 dark:text-indigo-300">
                  Tagihan Tim Penagihan (Finance)
                </span>
              </div>
              <div className="text-base font-black font-mono text-indigo-900 dark:text-indigo-200 mt-0.5 tabular-nums">
                Rp {teamBreakdown.financeTerutang.toLocaleString('id-ID')}
              </div>
              <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 mt-0.5">
                {teamBreakdown.financeCount} Faktur Kolektor Finance
              </div>
            </div>
            <div className="flex flex-col items-end gap-1">
              <span className="px-2 py-0.5 rounded bg-indigo-100 dark:bg-indigo-500/30 text-indigo-800 dark:text-indigo-200 border border-indigo-200 dark:border-indigo-500/40 text-[10px] font-black">
                Tim Finance
              </span>
              {onOpenBillingApp && (
                <button
                  type="button"
                  onClick={e => {
                    e.stopPropagation();
                    onOpenBillingApp('FINANCE');
                  }}
                  className="text-[10px] font-bold text-indigo-700 dark:text-indigo-300 hover:text-indigo-900 dark:hover:text-white underline cursor-pointer"
                >
                  Buka Aplikasi &rarr;
                </button>
              )}
            </div>
          </div>

          <div
            onClick={() => handleSelectTeamFilter('SALES')}
            className={`p-3.5 rounded-xl border transition cursor-pointer flex items-center justify-between ${
              activeTeamFilter === 'SALES'
                ? 'bg-amber-50/95 dark:bg-amber-950/45 border-amber-400 dark:border-amber-500/60 ring-2 ring-amber-500/15 shadow-xs'
                : 'bg-slate-50/80 dark:bg-slate-950/60 border-slate-200 dark:border-slate-800 hover:border-amber-300 dark:hover:border-amber-500/40'
            }`}
          >
            <div>
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-amber-600 dark:bg-amber-400" />
                <span className="text-[10px] font-black uppercase tracking-wider text-amber-800 dark:text-amber-300">
                  Tagihan Khusus Sales (Marketing)
                </span>
              </div>
              <div className="text-base font-black font-mono text-amber-900 dark:text-amber-200 mt-0.5 tabular-nums">
                Rp {teamBreakdown.salesTerutang.toLocaleString('id-ID')}
              </div>
              <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 mt-0.5">
                {teamBreakdown.salesCount} Faktur Tagihan Khusus Sales
              </div>
            </div>
            <div className="flex flex-col items-end gap-1">
              <span className="px-2 py-0.5 rounded bg-amber-100 dark:bg-amber-500/30 text-amber-900 dark:text-amber-200 border border-amber-200 dark:border-amber-500/40 text-[10px] font-black">
                Khusus Sales
              </span>
              {onOpenBillingApp && (
                <button
                  type="button"
                  onClick={e => {
                    e.stopPropagation();
                    onOpenBillingApp('SALES');
                  }}
                  className="text-[10px] font-bold text-amber-800 dark:text-amber-300 hover:text-amber-950 dark:hover:text-white underline cursor-pointer"
                >
                  Buka Aplikasi &rarr;
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* KPI Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-2xl shadow-xs">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Total Piutang Terutang
            </span>
            <DollarSign className="w-4 h-4 text-blue-600 dark:text-blue-400" />
          </div>
          <div className="text-xl font-black text-blue-700 dark:text-blue-400 font-mono tabular-nums">
            Rp {summaryStats.totalTerutang.toLocaleString('id-ID')}
          </div>
          <p className="text-[11px] text-slate-500 mt-1">
            {filteredInvoices.length} faktur aktif pada {summaryStats.totalCustomers} pelanggan
          </p>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-2xl shadow-xs">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Faktur Lewat Jatuh Tempo
            </span>
            <AlertCircle className="w-4 h-4 text-rose-500" />
          </div>
          <div className="text-xl font-black text-rose-600 dark:text-rose-400 font-mono tabular-nums">
            Rp {summaryStats.totalOverdue.toLocaleString('id-ID')}
          </div>
          <p className="text-[11px] text-slate-500 mt-1">
            {summaryStats.overdueCount} faktur melewati tanggal jatuh tempo
          </p>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-2xl shadow-xs">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Melebihi Limit Pelanggan
            </span>
            <ShieldAlert className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-xl font-black text-amber-600 dark:text-amber-400 font-mono tabular-nums">
            {summaryStats.overlimitCustomerCount} Pelanggan
          </div>
          <p className="text-[11px] text-slate-500 mt-1">
            Total terutang melampaui plafon limit kredit
          </p>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-2xl shadow-xs">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Pembayaran Terkumpul (Bayar)
            </span>
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-xl font-black text-emerald-600 dark:text-emerald-400 font-mono tabular-nums">
            Rp {summaryStats.totalBayar.toLocaleString('id-ID')}
          </div>
          <p className="text-[11px] text-slate-500 mt-1">
            Akumulasi pembayaran masuk &amp; pelunasan faktur
          </p>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-3.5 shadow-xs flex flex-col xl:flex-row xl:items-center justify-between gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Cari Nama Pelanggan (mis. BP H KHOLIK, BU ARISTA, TK WIGEN), No. Faktur (FJ02-1126-...), atau Wilayah..."
            className="w-full pl-10 pr-4 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-indigo-500"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Filter Wilayah */}
          <div className="flex items-center gap-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-1.5">
            <MapPin className="w-3.5 h-3.5 text-indigo-500" />
            <span className="text-[10px] font-bold uppercase text-slate-400">Wilayah:</span>
            <select
              value={regionFilter}
              onChange={e => setRegionFilter(e.target.value)}
              className="bg-transparent text-xs font-bold text-slate-800 dark:text-slate-200 focus:outline-none cursor-pointer"
            >
              <option value="ALL">Semua Wilayah ({regionOptions.length})</option>
              {regionOptions.map(reg => (
                <option key={reg} value={reg}>
                  {reg}
                </option>
              ))}
            </select>
          </div>

          {/* Filter Cabang */}
          <select
            value={branchFilter}
            onChange={e => setBranchFilter(e.target.value)}
            className="px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs font-bold text-slate-800 dark:text-slate-200 cursor-pointer"
          >
            <option value="ALL">Semua Cabang ({branches.length})</option>
            {branches.map(b => (
              <option key={b.id} value={b.name}>
                Cabang {b.name}
              </option>
            ))}
          </select>

          {/* Filter Status */}
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            className="px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs font-bold text-slate-800 dark:text-slate-200 cursor-pointer"
          >
            <option value="UNPAID_ONLY">Belum Terlunasi</option>
            <option value="Jatuh Tempo (Overdue)">Lewat Jatuh Tempo (Overdue)</option>
            <option value="Belum Jatuh Tempo">Belum Jatuh Tempo</option>
            <option value="Cicilan / Sebagian">Cicilan / Bayar Sebagian</option>
            <option value="Lunas">Sudah Lunas</option>
            <option value="ALL">Semua Faktur ({invoices.length})</option>
          </select>

          {/* Filter Umur Jatuh Tempo */}
          <select
            value={agingFilter}
            onChange={e => setAgingFilter(e.target.value)}
            className="px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs font-bold text-slate-800 dark:text-slate-200 cursor-pointer"
          >
            <option value="ALL">Semua Umur Jatuh Tempo</option>
            <option value="NOT_DUE">Belum Jatuh Tempo (&le; 0 Hari)</option>
            <option value="OVERDUE_1_7">Lewat 1 &ndash; 7 Hari</option>
            <option value="OVERDUE_8_14">Lewat 8 &ndash; 14 Hari</option>
            <option value="OVERDUE_15_30">Lewat 15 &ndash; 30 Hari</option>
            <option value="OVERDUE_30_PLUS">Macet &gt; 30 Hari</option>
          </select>
        </div>
      </div>

      {/* ======================================================================= */}
      {/* MODE 1: BUKU BESAR DAFTAR TAGIHAN (PERSIS STRUKTUR EXCEL SCREENSHOT)     */}
      {/* ======================================================================= */}
      {viewMode === 'excel_ledger' ? (
        <div className="bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-2xl overflow-hidden shadow-xs">
          <div className="px-4 py-3 bg-slate-50 dark:bg-slate-950 border-b border-slate-300 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <FileSpreadsheet className="w-4 h-4 text-blue-700 dark:text-blue-400" />
              <span className="text-xs font-black uppercase tracking-wide text-slate-900 dark:text-white">
                Buku Besar Daftar Tagihan &amp; Piutang Pelanggan (Per Wilayah &amp; Toko)
              </span>
            </div>
            <div className="flex items-center gap-4 text-xs">
              <span className="text-slate-500">
                Wilayah Aktif: <strong className="text-slate-900 dark:text-white">{ledgerGroups.length}</strong>
              </span>
              <span className="text-slate-500">
                Total Terutang:{' '}
                <strong className="font-mono font-black text-blue-700 dark:text-blue-400">
                  {summaryStats.totalTerutang.toLocaleString('id-ID')}
                </strong>
              </span>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="bg-slate-100 dark:bg-slate-950 border-b-2 border-slate-300 dark:border-slate-700 text-blue-800 dark:text-blue-300 font-black text-[11px]">
                  <th className="py-2.5 px-2.5 border-r border-slate-300 dark:border-slate-800 w-8 text-center">#</th>
                  <th className="py-2.5 px-3 border-r border-slate-300 dark:border-slate-800 text-left min-w-[210px]">
                    Wilayah / Nama Pelanggan &amp; No. Faktur
                  </th>
                  <th className="py-2.5 px-3 border-r border-slate-300 dark:border-slate-800 text-center min-w-[115px]">
                    Tgl Faktur
                  </th>
                  <th className="py-2.5 px-3 border-r border-slate-300 dark:border-slate-800 text-center min-w-[135px]">
                    Jatuh Tempo
                  </th>
                  <th className="py-2.5 px-3 border-r border-slate-300 dark:border-slate-800 text-right min-w-[130px]">
                    Terutang
                  </th>
                  <th className="py-2.5 px-3 border-r border-slate-300 dark:border-slate-800 text-right min-w-[115px]">
                    Bayar
                  </th>
                  <th className="py-2.5 px-3 border-r border-slate-300 dark:border-slate-800 text-left min-w-[170px]">
                    Keterangan
                  </th>
                  <th className="py-2.5 px-3 border-r border-slate-300 dark:border-slate-800 text-right min-w-[140px]">
                    Limit Pelanggan
                  </th>
                  <th className="py-2.5 px-3 text-center min-w-[125px]">
                    Aksi Penagihan
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-200 dark:divide-slate-800/90">
                {ledgerGroups.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-10 text-center text-slate-400">
                      Tidak ada data daftar tagihan yang sesuai dengan filter pencarian.
                    </td>
                  </tr>
                ) : (
                  ledgerGroups.map(regionGroup => {
                    const isRegionCollapsed = Boolean(collapsedRegions[regionGroup.region]);
                    return (
                      <React.Fragment key={regionGroup.region}>
                        {/* LEVEL 1: WILAYAH HEADER ROW (e.g., ROGOJAMPI, SUMBER AYU) */}
                        <tr
                          onClick={() => toggleRegion(regionGroup.region)}
                          className="bg-slate-200/75 dark:bg-slate-800/90 hover:bg-slate-200 dark:hover:bg-slate-800 cursor-pointer select-none border-y border-slate-300 dark:border-slate-700"
                        >
                          <td className="py-2 px-2.5 border-r border-slate-300 dark:border-slate-700 text-center">
                            {isRegionCollapsed ? (
                              <ChevronRight className="w-4 h-4 text-slate-700 dark:text-slate-300 mx-auto" />
                            ) : (
                              <ChevronDown className="w-4 h-4 text-slate-700 dark:text-slate-300 mx-auto" />
                            )}
                          </td>
                          <td
                            colSpan={3}
                            className="py-2 px-3 border-r border-slate-300 dark:border-slate-700 font-black text-xs uppercase tracking-wider text-slate-900 dark:text-white"
                          >
                            <div className="flex items-center justify-between">
                              <span className="flex items-center gap-2">
                                <span>{regionGroup.region}</span>
                                <span className="px-2 py-0.5 rounded bg-slate-900/10 dark:bg-white/10 text-[10px] font-mono font-bold text-slate-700 dark:text-slate-300">
                                  {regionGroup.customers.length} Pelanggan &bull; {regionGroup.invoiceCountRegion} Faktur
                                </span>
                              </span>
                            </div>
                          </td>
                          <td className="py-2 px-3 border-r border-slate-300 dark:border-slate-700 text-right font-mono font-black text-slate-900 dark:text-white tabular-nums">
                            {regionGroup.totalTerutangRegion.toLocaleString('id-ID')}
                          </td>
                          <td className="py-2 px-3 border-r border-slate-300 dark:border-slate-700 text-right font-mono font-bold text-emerald-700 dark:text-emerald-400 tabular-nums">
                            {regionGroup.totalBayarRegion > 0
                              ? regionGroup.totalBayarRegion.toLocaleString('id-ID')
                              : ''}
                          </td>
                          <td colSpan={3} className="py-2 px-3 text-[10px] font-bold text-slate-500 dark:text-slate-400">
                            Rekap Wilayah {regionGroup.region}
                          </td>
                        </tr>

                        {/* LEVEL 2: PELANGGAN GROUPS UNDER WILAYAH */}
                        {!isRegionCollapsed &&
                          regionGroup.customers.map(custGroup => {
                            const custKey = `${regionGroup.region}__${custGroup.customerName}`;
                            const isCustCollapsed = Boolean(collapsedCustomers[custKey]);
                            const isOverlimit =
                              custGroup.paymentCategory === 'TEMPO' &&
                              custGroup.limitPelanggan > 0 &&
                              custGroup.totalTerutang > custGroup.limitPelanggan;

                            return (
                              <React.Fragment key={custKey}>
                                {/* CUSTOMER HEADER ROW (e.g. BP H KHOLIK, BP HERU ROGOJAMPI, BP SUKRI, BU ARISTA, etc.) */}
                                <tr className="bg-slate-50/90 dark:bg-slate-900/95 border-b border-slate-300 dark:border-slate-800">
                                  <td
                                    onClick={() => toggleCustomer(custKey)}
                                    className="py-2 px-2.5 border-r border-slate-300 dark:border-slate-800 text-center cursor-pointer"
                                  >
                                    {isCustCollapsed ? (
                                      <ChevronRight className="w-3.5 h-3.5 text-slate-400 mx-auto" />
                                    ) : (
                                      <ChevronDown className="w-3.5 h-3.5 text-slate-400 mx-auto" />
                                    )}
                                  </td>
                                  <td
                                    onClick={() => toggleCustomer(custKey)}
                                    className="py-2 pl-4 pr-3 border-r border-slate-300 dark:border-slate-800 font-black text-slate-900 dark:text-white cursor-pointer"
                                  >
                                    <div className="flex items-center justify-between gap-2">
                                      <span className="tracking-tight">{custGroup.customerName}</span>
                                      <span
                                        className={`px-1.5 py-0.5 rounded text-[9px] font-mono font-bold uppercase border ${
                                          custGroup.paymentCategory === 'TEMPO'
                                            ? 'bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border-indigo-500/25'
                                            : 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/25'
                                        }`}
                                      >
                                        {custGroup.paymentCategory === 'TEMPO'
                                          ? `TEMPO ${custGroup.tempoDays}H`
                                          : 'COD'}
                                      </span>
                                    </div>
                                  </td>
                                  <td className="py-2 px-3 border-r border-slate-300 dark:border-slate-800" />
                                  <td className="py-2 px-3 border-r border-slate-300 dark:border-slate-800 text-center">
                                    {custGroup.maxOverdueDays > 0 ? (
                                      <span className="px-1.5 py-0.5 rounded bg-rose-500/10 text-rose-600 dark:text-rose-400 font-mono font-bold text-[10px]">
                                        Umur +{custGroup.maxOverdueDays} Hr
                                      </span>
                                    ) : (
                                      <span className="text-[10px] font-mono text-emerald-600 dark:text-emerald-400 font-semibold">
                                        Lancar
                                      </span>
                                    )}
                                  </td>
                                  <td className="py-2 px-3 border-r border-slate-300 dark:border-slate-800" />
                                  <td className="py-2 px-3 border-r border-slate-300 dark:border-slate-800" />
                                  <td className="py-2 px-3 border-r border-slate-300 dark:border-slate-800 text-[10px] text-slate-500">
                                    {isOverlimit ? (
                                      <span className="text-rose-600 dark:text-rose-400 font-bold">
                                        Melebihi Limit Rp {Math.abs(custGroup.sisaLimit).toLocaleString('id-ID')}
                                      </span>
                                    ) : custGroup.limitPelanggan > 0 ? (
                                      <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                                        Sisa Limit: Rp {custGroup.sisaLimit.toLocaleString('id-ID')}
                                      </span>
                                    ) : null}
                                  </td>
                                  <td className="py-2 px-3 border-r border-slate-300 dark:border-slate-800" />
                                  <td className="py-2 px-3 text-center">
                                    <button
                                      type="button"
                                      onClick={() =>
                                        onOpenAddModal({
                                          customerName: custGroup.customerName,
                                          region: custGroup.region,
                                          limitPelanggan: custGroup.limitPelanggan,
                                          paymentCategory: custGroup.paymentCategory
                                        })
                                      }
                                      className="px-2 py-0.5 rounded bg-slate-200/80 dark:bg-slate-800 hover:bg-indigo-600 hover:text-white text-slate-700 dark:text-slate-300 text-[10px] font-bold transition cursor-pointer"
                                    >
                                      + Faktur
                                    </button>
                                  </td>
                                </tr>

                                {/* LEVEL 3: INVOICE ROWS UNDER CUSTOMER */}
                                {!isCustCollapsed &&
                                  custGroup.invoices.map(inv => {
                                    const sisa = Math.max(0, inv.totalTagihan - inv.jumlahTerbayar);
                                    const agingDays = computeInvoiceAgingDays(inv.dueDate);
                                    const limitVal = inv.limitPelanggan ?? custGroup.limitPelanggan;
                                    const boldClass = inv.isBoldHighlight
                                      ? 'font-black text-slate-950 dark:text-white'
                                      : 'font-medium text-slate-800 dark:text-slate-200';

                                    return (
                                      <tr
                                        key={inv.id}
                                        className="bg-white dark:bg-slate-900 hover:bg-blue-50/40 dark:hover:bg-slate-800/50 transition"
                                      >
                                        <td className="py-2 px-2.5 border-r border-slate-300 dark:border-slate-800" />
                                        <td
                                          className={`py-2 pl-8 pr-3 border-r border-slate-300 dark:border-slate-800 font-mono ${boldClass}`}
                                        >
                                          <div className="flex items-center justify-between gap-1.5">
                                            <span>{inv.noInvoice}</span>
                                            <span
                                              className={`px-1.5 py-0.5 rounded text-[9px] font-sans font-black uppercase shrink-0 ${
                                                inv.billingTeam === 'SALES'
                                                  ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30'
                                                  : 'bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border border-indigo-500/20'
                                              }`}
                                            >
                                              {inv.billingTeam === 'SALES' ? 'Khusus Sales' : 'Tim Finance'}
                                            </span>
                                          </div>
                                        </td>
                                        <td
                                          className={`py-2 px-3 border-r border-slate-300 dark:border-slate-800 text-center font-mono whitespace-nowrap ${boldClass}`}
                                        >
                                          {formatIndonesianShortDate(inv.invoiceDate)}
                                        </td>
                                        <td
                                          className={`py-2 px-3 border-r border-slate-300 dark:border-slate-800 text-center font-mono whitespace-nowrap ${boldClass}`}
                                        >
                                          <div className="flex items-center justify-center gap-1.5">
                                            <span>{formatIndonesianShortDate(inv.dueDate)}</span>
                                            {sisa > 0 && agingDays > 0 && (
                                              <span
                                                className="px-1 py-0.2 rounded bg-rose-500/15 text-rose-600 dark:text-rose-400 text-[9px] font-bold"
                                                title={`Melewati jatuh tempo ${agingDays} hari`}
                                              >
                                                +{agingDays}h
                                              </span>
                                            )}
                                          </div>
                                        </td>
                                        <td
                                          className={`py-2 px-3 border-r border-slate-300 dark:border-slate-800 text-right font-mono tabular-nums ${boldClass}`}
                                        >
                                          {sisa.toLocaleString('id-ID')}
                                        </td>
                                        <td className="py-2 px-3 border-r border-slate-300 dark:border-slate-800 text-right font-mono tabular-nums font-bold text-emerald-600 dark:text-emerald-400">
                                          {inv.jumlahTerbayar > 0 ? inv.jumlahTerbayar.toLocaleString('id-ID') : ''}
                                        </td>
                                        <td className="py-2 px-3 border-r border-slate-300 dark:border-slate-800 text-slate-600 dark:text-slate-400 truncate max-w-[200px]">
                                          {inv.notes || inv.kendalaTagihan || ''}
                                        </td>
                                        <td
                                          className={`py-2 px-3 border-r border-slate-300 dark:border-slate-800 text-right font-mono tabular-nums ${boldClass}`}
                                        >
                                          {limitVal > 0 ? limitVal.toLocaleString('id-ID') : '-'}
                                        </td>
                                        <td className="py-2 px-2.5 text-center">
                                          <div className="flex items-center justify-center gap-1">
                                            {sisa > 0 && (
                                              <button
                                                type="button"
                                                onClick={() => onOpenPaymentModal(inv)}
                                                className="px-2 py-1 rounded bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] font-bold cursor-pointer transition"
                                                title="Catat Bayar / Pelunasan"
                                              >
                                                Bayar
                                              </button>
                                            )}
                                            <button
                                              type="button"
                                              onClick={() => onOpenWaModal(inv)}
                                              className="p-1 rounded text-emerald-600 hover:bg-emerald-500/10 cursor-pointer"
                                              title="Kirim WA Tagihan"
                                            >
                                              <MessageSquare className="w-3.5 h-3.5" />
                                            </button>
                                            <button
                                              type="button"
                                              onClick={() => onOpenPrintModal(inv)}
                                              className="p-1 rounded text-indigo-600 hover:bg-indigo-500/10 cursor-pointer"
                                              title="Cetak Surat Tagihan"
                                            >
                                              <Printer className="w-3.5 h-3.5" />
                                            </button>
                                            <button
                                              type="button"
                                              onClick={() => onDeleteInvoice(inv.id)}
                                              className="p-1 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-500/10 cursor-pointer"
                                              title="Hapus Faktur"
                                            >
                                              <Trash2 className="w-3.5 h-3.5" />
                                            </button>
                                          </div>
                                        </td>
                                      </tr>
                                    );
                                  })}

                                {/* LEVEL 2 FOOTER: SUBTOTAL TERUTANG PELANGGAN IN BOLD BLUE (MATCHING EXCEL) */}
                                {!isCustCollapsed && (
                                  <tr className="bg-blue-50/35 dark:bg-blue-950/20 border-b border-slate-300 dark:border-slate-800">
                                    <td className="py-2 px-2.5 border-r border-slate-300 dark:border-slate-800" />
                                    <td className="py-2 px-3 border-r border-slate-300 dark:border-slate-800" />
                                    <td className="py-2 px-3 border-r border-slate-300 dark:border-slate-800" />
                                    <td className="py-2 px-3 border-r border-slate-300 dark:border-slate-800" />
                                    <td className="py-2 px-3 border-r border-slate-300 dark:border-slate-800 text-right font-mono font-black text-blue-700 dark:text-blue-400 text-xs tabular-nums">
                                      {custGroup.totalTerutang.toLocaleString('id-ID')}
                                    </td>
                                    <td className="py-2 px-3 border-r border-slate-300 dark:border-slate-800 text-right font-mono font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">
                                      {custGroup.totalBayar > 0 ? custGroup.totalBayar.toLocaleString('id-ID') : ''}
                                    </td>
                                    <td className="py-2 px-3 border-r border-slate-300 dark:border-slate-800" />
                                    <td className="py-2 px-3 border-r border-slate-300 dark:border-slate-800 text-right font-mono text-[10px]">
                                      {custGroup.limitPelanggan > 0 && (
                                        <span
                                          className={
                                            isOverlimit
                                              ? 'font-black text-rose-600 dark:text-rose-400'
                                              : 'font-bold text-slate-500 dark:text-slate-400'
                                          }
                                        >
                                          {isOverlimit
                                            ? `Over: -${Math.abs(custGroup.sisaLimit).toLocaleString('id-ID')}`
                                            : `Sisa: ${custGroup.sisaLimit.toLocaleString('id-ID')}`}
                                        </span>
                                      )}
                                    </td>
                                    <td className="py-2 px-3" />
                                  </tr>
                                )}
                              </React.Fragment>
                            );
                          })}
                      </React.Fragment>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* ======================================================================= */
        /* MODE 2: FLAT TABLE RINCIAN FAKTUR                                       */
        /* ======================================================================= */
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 dark:bg-slate-950 text-slate-600 dark:text-slate-400 uppercase font-bold text-[10px] border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="py-3 px-4">Wilayah</th>
                  <th className="py-3 px-4">Nama Pelanggan</th>
                  <th className="py-3 px-4">No. Faktur</th>
                  <th className="py-3 px-4">Tgl Faktur</th>
                  <th className="py-3 px-4">Jatuh Tempo</th>
                  <th className="py-3 px-4 text-right">Terutang</th>
                  <th className="py-3 px-4 text-right">Bayar</th>
                  <th className="py-3 px-4">Keterangan</th>
                  <th className="py-3 px-4 text-right">Limit Pelanggan</th>
                  <th className="py-3 px-4 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {filteredInvoices.map(inv => {
                  const sisa = Math.max(0, inv.totalTagihan - inv.jumlahTerbayar);
                  const aging = computeInvoiceAgingDays(inv.dueDate);
                  return (
                    <tr key={inv.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                      <td className="py-2.5 px-4 font-bold text-slate-700 dark:text-slate-300">{inv.region}</td>
                      <td className="py-2.5 px-4 font-black text-slate-900 dark:text-white">{inv.customerName}</td>
                      <td className="py-2.5 px-4 font-mono font-bold text-indigo-600 dark:text-indigo-400">
                        {inv.noInvoice}
                      </td>
                      <td className="py-2.5 px-4 font-mono">{formatIndonesianShortDate(inv.invoiceDate)}</td>
                      <td className="py-2.5 px-4 font-mono">
                        <span>{formatIndonesianShortDate(inv.dueDate)}</span>
                        {sisa > 0 && aging > 0 && (
                          <span className="ml-1.5 px-1.5 py-0.5 rounded bg-rose-500/15 text-rose-600 dark:text-rose-400 text-[10px] font-bold">
                            +{aging} Hr
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-4 text-right font-mono font-black text-blue-700 dark:text-blue-400 tabular-nums">
                        {sisa.toLocaleString('id-ID')}
                      </td>
                      <td className="py-2.5 px-4 text-right font-mono font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">
                        {inv.jumlahTerbayar > 0 ? inv.jumlahTerbayar.toLocaleString('id-ID') : '-'}
                      </td>
                      <td className="py-2.5 px-4 text-slate-500">{inv.notes || '-'}</td>
                      <td className="py-2.5 px-4 text-right font-mono tabular-nums">
                        {(inv.limitPelanggan || 0).toLocaleString('id-ID')}
                      </td>
                      <td className="py-2.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {sisa > 0 && (
                            <button
                              type="button"
                              onClick={() => onOpenPaymentModal(inv)}
                              className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-bold cursor-pointer"
                            >
                              Bayar
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => onDeleteInvoice(inv.id)}
                            className="p-1 text-slate-400 hover:text-rose-600 cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

// ============================================================================
// SUB-MENU BARU: MAPPING MASTER PELANGGAN (TEMPO & COD, SISA LIMIT & UMUR JT)
// ============================================================================

export type LimitHealthBucket = 'ALL' | 'OVERLIMIT' | 'CRITICAL_20' | 'WARNING_50' | 'SAFE_50';
export type AgingTempoBucket = 'ALL' | 'ON_TIME_0' | 'OVERDUE_1_3' | 'OVERDUE_4_7' | 'OVERDUE_8_14';

interface MappedCustomerRow {
  id: string;
  customerName: string;
  region: string;
  contactPhone: string;
  paymentCategory: 'TEMPO' | 'COD';
  tempoDays: number;
  limitPelanggan: number;
  activeInvoiceCount: number;
  totalTagihan: number;
  totalTerutang: number;
  sisaLimit: number;
  usageRatioPct: number;
  limitStatus: {
    bucket: LimitHealthBucket;
    label: string;
    badgeClass: string;
  };
  oldestDueDate: string | null;
  maxAgingDays: number;
  agingStatus: {
    bucket: AgingTempoBucket;
    label: string;
    badgeClass: string;
  };
  notes: string;
}

export interface CustomerMasterMappingProps {
  invoices: CustomerUnpaidInvoice[];
  masterCustomers: CustomerMasterRecord[];
  onSaveMasterCustomers: (next: CustomerMasterRecord[]) => void;
  onUpdateCustomerInvoicesMeta: (
    customerName: string,
    updates: { limitPelanggan: number; paymentCategory: 'TEMPO' | 'COD'; tempoDays: number; region: string }
  ) => void;
  onSwitchToLedger?: () => void;
}

export const CustomerMasterMappingView: React.FC<CustomerMasterMappingProps> = ({
  invoices,
  masterCustomers,
  onSaveMasterCustomers,
  onUpdateCustomerInvoicesMeta
}) => {
  const [categoryTab, setCategoryTab] = useState<'ALL' | 'TEMPO' | 'COD'>('TEMPO');
  const [limitFilter, setLimitFilter] = useState<LimitHealthBucket>('ALL');
  const [agingFilter, setAgingFilter] = useState<AgingTempoBucket>('ALL');
  const [regionFilter, setRegionFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Modal state for adding / editing Master Pelanggan
  const [editingCustomer, setEditingCustomer] = useState<CustomerMasterRecord | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formState, setFormState] = useState<{
    customerName: string;
    region: string;
    contactPhone: string;
    paymentCategory: 'TEMPO' | 'COD';
    tempoDays: number;
    limitPelanggan: number;
    notes: string;
  }>({
    customerName: '',
    region: 'ROGOJAMPI',
    contactPhone: '',
    paymentCategory: 'TEMPO',
    tempoDays: 14,
    limitPelanggan: 5000000,
    notes: ''
  });

  // Merge Master Customers + any Customers appearing in Invoices
  const mappedCustomers = useMemo<MappedCustomerRow[]>(() => {
    const mergedMap = new Map<string, CustomerMasterRecord>();
    masterCustomers.forEach(mc => {
      mergedMap.set(mc.customerName.trim().toUpperCase(), mc);
    });

    invoices.forEach(inv => {
      const key = inv.customerName.trim().toUpperCase();
      if (!mergedMap.has(key)) {
        mergedMap.set(key, {
          id: `CUST-AUTO-${key}`,
          customerCode: `PLG-AUTO`,
          customerName: key,
          region: inv.region.trim().toUpperCase() || 'ROGOJAMPI',
          contactPhone: inv.contactPhone || '-',
          paymentCategory: inv.paymentCategory || 'TEMPO',
          tempoDays: inv.tempoDays ?? 7,
          creditLimit: inv.limitPelanggan ?? 2000000,
          notes: inv.notes || 'Terdaftar dari faktur tagihan'
        });
      }
    });

    const rows: MappedCustomerRow[] = [];

    mergedMap.forEach(mc => {
      const custKey = mc.customerName.trim().toUpperCase();
      const custInvoices = invoices.filter(i => i.customerName.trim().toUpperCase() === custKey);

      let activeInvoiceCount = 0;
      let totalTagihan = 0;
      let totalTerutang = 0;
      let oldestDueDate: string | null = null;
      let maxAgingDays = -999;

      custInvoices.forEach(inv => {
        const sisa = Math.max(0, inv.totalTagihan - inv.jumlahTerbayar);
        totalTagihan += inv.totalTagihan;
        totalTerutang += sisa;
        if (sisa > 0) {
          activeInvoiceCount += 1;
          const aging = computeInvoiceAgingDays(inv.dueDate);
          if (aging > maxAgingDays) {
            maxAgingDays = aging;
            oldestDueDate = inv.dueDate;
          }
        }
      });

      if (maxAgingDays === -999) maxAgingDays = 0;

      const limitPelanggan = mc.paymentCategory === 'COD' ? 0 : mc.creditLimit;
      const sisaLimit = limitPelanggan - totalTerutang;
      const usageRatioPct =
        limitPelanggan > 0 ? Math.round((totalTerutang / limitPelanggan) * 1000) / 10 : totalTerutang > 0 ? 100 : 0;

      // Classify Sisa Limit Piutang
      let limitStatus: MappedCustomerRow['limitStatus'];
      if (mc.paymentCategory === 'COD') {
        limitStatus = {
          bucket: 'SAFE_50',
          label: 'Tunai / COD (Tanpa Plafon Tempo)',
          badgeClass: 'bg-slate-500/10 text-slate-700 dark:text-slate-300 border-slate-500/25'
        };
      } else if (sisaLimit < 0) {
        limitStatus = {
          bucket: 'OVERLIMIT',
          label: 'Overlimit (Melebihi Limit)',
          badgeClass: 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30'
        };
      } else if (limitPelanggan > 0 && sisaLimit / limitPelanggan <= 0.2) {
        limitStatus = {
          bucket: 'CRITICAL_20',
          label: 'Limit Kritis (Sisa ≤ 20%)',
          badgeClass: 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30'
        };
      } else if (limitPelanggan > 0 && sisaLimit / limitPelanggan <= 0.5) {
        limitStatus = {
          bucket: 'WARNING_50',
          label: 'Limit Waspada (Sisa 20–50%)',
          badgeClass: 'bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/30'
        };
      } else {
        limitStatus = {
          bucket: 'SAFE_50',
          label: 'Limit Aman (Sisa > 50%)',
          badgeClass: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30'
        };
      }

      // Classify Umur Pembayaran Berdasarkan Jatuh Tempo (Khusus Pelanggan Tempo):
      // - Sebelum / Tepat pada Jatuh Tempo (<= 0 hari): Hijau
      // - Pembayaran 1–3 hari: Kuning
      // - Pembayaran 4–7 hari: Oranye
      // - Pembayaran 8–14 hari (>= 8 hari): Merah
      let agingStatus: MappedCustomerRow['agingStatus'];
      if (totalTerutang === 0 || maxAgingDays <= 0) {
        agingStatus = {
          bucket: 'ON_TIME_0',
          label:
            totalTerutang === 0
              ? 'Tepat Jatuh Tempo (Lunas)'
              : maxAgingDays === 0
              ? 'Tepat pada Jatuh Tempo (0 Hari)'
              : `Sebelum Jatuh Tempo (${Math.abs(maxAgingDays)} Hr Lagi)`,
          badgeClass: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/35'
        };
      } else if (maxAgingDays >= 1 && maxAgingDays <= 3) {
        agingStatus = {
          bucket: 'OVERDUE_1_3',
          label: `Pembayaran ${maxAgingDays} Hari (1–3 Hari)`,
          badgeClass: 'bg-yellow-400/25 text-yellow-800 dark:text-yellow-300 border-yellow-500/45'
        };
      } else if (maxAgingDays >= 4 && maxAgingDays <= 7) {
        agingStatus = {
          bucket: 'OVERDUE_4_7',
          label: `Pembayaran ${maxAgingDays} Hari (4–7 Hari)`,
          badgeClass: 'bg-orange-500/15 text-orange-700 dark:text-orange-300 border-orange-500/35'
        };
      } else {
        agingStatus = {
          bucket: 'OVERDUE_8_14',
          label:
            maxAgingDays <= 14
              ? `Pembayaran ${maxAgingDays} Hari (8–14 Hari)`
              : `Pembayaran ${maxAgingDays} Hari (8–14+ Hari)`,
          badgeClass: 'bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/35'
        };
      }

      rows.push({
        id: mc.id,
        customerName: custKey,
        region: mc.region.toUpperCase(),
        contactPhone: mc.contactPhone,
        paymentCategory: mc.paymentCategory,
        tempoDays: mc.tempoDays,
        limitPelanggan,
        activeInvoiceCount,
        totalTagihan,
        totalTerutang,
        sisaLimit,
        usageRatioPct,
        limitStatus,
        oldestDueDate,
        maxAgingDays,
        agingStatus,
        notes: mc.notes || ''
      });
    });

    return rows.sort((a, b) => b.totalTerutang - a.totalTerutang);
  }, [masterCustomers, invoices]);

  const tempoCustomers = useMemo(
    () => mappedCustomers.filter(c => c.paymentCategory === 'TEMPO'),
    [mappedCustomers]
  );
  const codCustomers = useMemo(
    () => mappedCustomers.filter(c => c.paymentCategory === 'COD'),
    [mappedCustomers]
  );

  // Mapping counts for Pelanggan TEMPO
  const tempoMappingCounts = useMemo(() => {
    return {
      overlimit: tempoCustomers.filter(c => c.limitStatus.bucket === 'OVERLIMIT').length,
      critical20: tempoCustomers.filter(c => c.limitStatus.bucket === 'CRITICAL_20').length,
      warning50: tempoCustomers.filter(c => c.limitStatus.bucket === 'WARNING_50').length,
      safe50: tempoCustomers.filter(c => c.limitStatus.bucket === 'SAFE_50').length,
      onTime0: tempoCustomers.filter(c => c.agingStatus.bucket === 'ON_TIME_0').length,
      overdue1_3: tempoCustomers.filter(c => c.agingStatus.bucket === 'OVERDUE_1_3').length,
      overdue4_7: tempoCustomers.filter(c => c.agingStatus.bucket === 'OVERDUE_4_7').length,
      overdue8_14: tempoCustomers.filter(c => c.agingStatus.bucket === 'OVERDUE_8_14').length
    };
  }, [tempoCustomers]);

  const regionsList = useMemo(() => {
    const s = new Set<string>();
    mappedCustomers.forEach(c => s.add(c.region));
    return Array.from(s).sort();
  }, [mappedCustomers]);

  const filteredRows = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return mappedCustomers.filter(r => {
      if (categoryTab !== 'ALL' && r.paymentCategory !== categoryTab) return false;
      if (limitFilter !== 'ALL' && r.limitStatus.bucket !== limitFilter) return false;
      if (agingFilter !== 'ALL' && r.agingStatus.bucket !== agingFilter) return false;
      if (regionFilter !== 'ALL' && r.region !== regionFilter) return false;
      if (
        q &&
        !r.customerName.toLowerCase().includes(q) &&
        !r.region.toLowerCase().includes(q) &&
        !r.contactPhone.toLowerCase().includes(q)
      ) {
        return false;
      }
      return true;
    });
  }, [mappedCustomers, categoryTab, limitFilter, agingFilter, regionFilter, searchQuery]);

  const handleOpenAddCustomer = () => {
    setEditingCustomer(null);
    setFormState({
      customerName: '',
      region: 'ROGOJAMPI',
      contactPhone: '',
      paymentCategory: 'TEMPO',
      tempoDays: 14,
      limitPelanggan: 5000000,
      notes: ''
    });
    setIsModalOpen(true);
  };

  const handleOpenEditCustomer = (row: MappedCustomerRow) => {
    const existing: CustomerMasterRecord = masterCustomers.find(
      m => m.customerName.toUpperCase() === row.customerName
    ) || {
      id: row.id,
      customerCode: `PLG-${row.customerName.slice(0, 3)}`,
      customerName: row.customerName,
      region: row.region,
      contactPhone: row.contactPhone,
      paymentCategory: row.paymentCategory,
      tempoDays: row.tempoDays,
      creditLimit: row.limitPelanggan,
      notes: row.notes
    };
    setEditingCustomer(existing);
    setFormState({
      customerName: existing.customerName,
      region: existing.region,
      contactPhone: existing.contactPhone,
      paymentCategory: existing.paymentCategory,
      tempoDays: existing.tempoDays,
      limitPelanggan: existing.creditLimit,
      notes: existing.notes || ''
    });
    setIsModalOpen(true);
  };

  const handleSaveCustomerForm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formState.customerName.trim()) return;

    const normalizedName = formState.customerName.trim().toUpperCase();
    const normalizedRegion = formState.region.trim().toUpperCase() || 'ROGOJAMPI';
    const finalLimit = formState.paymentCategory === 'COD' ? 0 : Math.max(0, Number(formState.limitPelanggan) || 0);
    const finalTempo = formState.paymentCategory === 'COD' ? 0 : Math.max(1, Number(formState.tempoDays) || 7);

    const record: CustomerMasterRecord = {
      id: editingCustomer?.id || `CUST-${Date.now()}`,
      customerCode: editingCustomer?.customerCode || `PLG-${String(masterCustomers.length + 1).padStart(3, '0')}`,
      customerName: normalizedName,
      region: normalizedRegion,
      contactPhone: formState.contactPhone.trim() || '-',
      paymentCategory: formState.paymentCategory,
      tempoDays: finalTempo,
      creditLimit: finalLimit,
      notes: formState.notes.trim()
    };

    const existsIdx = masterCustomers.findIndex(
      c => c.id === record.id || c.customerName.trim().toUpperCase() === normalizedName
    );
    let nextMasters: CustomerMasterRecord[];
    if (existsIdx >= 0) {
      nextMasters = masterCustomers.map((c, idx) => (idx === existsIdx ? record : c));
    } else {
      nextMasters = [record, ...masterCustomers];
    }

    onSaveMasterCustomers(nextMasters);
    onUpdateCustomerInvoicesMeta(normalizedName, {
      limitPelanggan: finalLimit,
      paymentCategory: formState.paymentCategory,
      tempoDays: finalTempo,
      region: normalizedRegion
    });
    setIsModalOpen(false);
  };

  const handleExportMappingExcel = () => {
    const data = filteredRows.map((r, i) => ({
      No: i + 1,
      'Nama Pelanggan': r.customerName,
      Wilayah: r.region,
      'Kategori Pembayaran': r.paymentCategory,
      'Tenor (Hari)': r.paymentCategory === 'TEMPO' ? `${r.tempoDays} Hari` : 'COD / Tunai',
      'Limit Pelanggan (Rp)': r.limitPelanggan,
      'Total Piutang Terutang (Rp)': r.totalTerutang,
      'Sisa Limit Piutang (Rp)': r.sisaLimit,
      'Status Sisa Limit': r.limitStatus.label,
      'Umur Pembayaran Jatuh Tempo': r.agingStatus.label,
      'Jatuh Tempo Terlama': r.oldestDueDate ? formatIndonesianShortDate(r.oldestDueDate) : '-',
      Keterangan: r.notes
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Mapping_Master_Pelanggan');
    XLSX.writeFile(wb, `Mapping_Master_Pelanggan_Tempo_COD_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  return (
    <div className="space-y-4">
      {/* Header Mapping Master Pelanggan */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-xs flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 text-[10px] font-mono font-bold uppercase">
              MASTER PELANGGAN &amp; CREDIT CONTROL
            </span>
            <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-white tracking-tight">
              Mapping Master Pelanggan (Kategori TEMPO &amp; COD)
            </h2>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Pengkategorian pelanggan Tempo &amp; COD — dimapping khusus dari segi <strong>Sisa Limit Piutang</strong> dan <strong>Umur Pembayaran Berdasarkan Jatuh Tempo</strong>
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleExportMappingExcel}
            className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Ekspor Mapping Excel</span>
          </button>
          <button
            type="button"
            onClick={handleOpenAddCustomer}
            className="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold flex items-center gap-1.5 transition cursor-pointer shadow-xs"
          >
            <Plus className="w-4 h-4" />
            <span>Tambah Master Pelanggan</span>
          </button>
        </div>
      </div>

      {/* Selector Kategori Utama: Pelanggan TEMPO vs Pelanggan COD */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
        <button
          type="button"
          onClick={() => {
            setCategoryTab('TEMPO');
          }}
          className={`text-left p-4 rounded-2xl border transition cursor-pointer ${
            categoryTab === 'TEMPO'
              ? 'bg-indigo-600/10 border-indigo-500 dark:border-indigo-400 shadow-xs'
              : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-indigo-400'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
              KATEGORI UTAMA 1
            </span>
            <CreditCard className="w-4 h-4 text-indigo-500" />
          </div>
          <div className="text-lg font-black text-slate-900 dark:text-white mt-1 flex items-baseline gap-2">
            <span>Pelanggan TEMPO</span>
            <span className="font-mono text-sm text-indigo-600 dark:text-indigo-400">
              ({tempoCustomers.length} Toko)
            </span>
          </div>
          <p className="text-[11px] text-slate-500 mt-1">
            Dimapping berdasarkan Sisa Limit Piutang &amp; Umur Pembayaran Jatuh Tempo
          </p>
        </button>

        <button
          type="button"
          onClick={() => {
            setCategoryTab('COD');
            setLimitFilter('ALL');
            setAgingFilter('ALL');
          }}
          className={`text-left p-4 rounded-2xl border transition cursor-pointer ${
            categoryTab === 'COD'
              ? 'bg-emerald-600/10 border-emerald-500 dark:border-emerald-400 shadow-xs'
              : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-emerald-400'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
              KATEGORI UTAMA 2
            </span>
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-lg font-black text-slate-900 dark:text-white mt-1 flex items-baseline gap-2">
            <span>Pelanggan COD (Tunai)</span>
            <span className="font-mono text-sm text-emerald-600 dark:text-emerald-400">
              ({codCustomers.length} Toko)
            </span>
          </div>
          <p className="text-[11px] text-slate-500 mt-1">
            Pembayaran Cash on Delivery saat barang tiba / tanpa plafon kredit tempo
          </p>
        </button>

        <button
          type="button"
          onClick={() => {
            setCategoryTab('ALL');
          }}
          className={`text-left p-4 rounded-2xl border transition cursor-pointer ${
            categoryTab === 'ALL'
              ? 'bg-amber-500/10 border-amber-500 dark:border-amber-400 shadow-xs'
              : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-amber-400'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-wider text-amber-600 dark:text-amber-400">
              SEMUA KATEGORI
            </span>
            <Users className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-lg font-black text-slate-900 dark:text-white mt-1 flex items-baseline gap-2">
            <span>Total Master Pelanggan</span>
            <span className="font-mono text-sm text-amber-600 dark:text-amber-400">
              ({mappedCustomers.length} Toko)
            </span>
          </div>
          <p className="text-[11px] text-slate-500 mt-1">
            Gabungan seluruh pelanggan Tempo ({tempoCustomers.length}) &amp; COD ({codCustomers.length})
          </p>
        </button>
      </div>

      {/* DUA PANEL MAPPING KHUSUS PELANGGAN TEMPO: (1) SEGI SISA LIMIT PIUTANG & (2) SEGI UMUR JATUH TEMPO */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* PANEL 1: MAPPING DARI SEGI SISA LIMIT PIUTANG */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-[10px] font-mono font-bold uppercase text-indigo-600 dark:text-indigo-400">
                DIMENSI MAPPING TEMPO 1
              </span>
              <h3 className="text-sm font-black text-slate-900 dark:text-white">
                Mapping Pelanggan Tempo: Segi Sisa Limit Piutang
              </h3>
            </div>
            {limitFilter !== 'ALL' && (
              <button
                type="button"
                onClick={() => setLimitFilter('ALL')}
                className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
              >
                Reset Filter Limit
              </button>
            )}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            <button
              type="button"
              onClick={() => {
                setCategoryTab('TEMPO');
                setLimitFilter(limitFilter === 'OVERLIMIT' ? 'ALL' : 'OVERLIMIT');
              }}
              className={`p-3 rounded-xl border text-left transition cursor-pointer ${
                limitFilter === 'OVERLIMIT'
                  ? 'bg-rose-500/15 border-rose-500 ring-1 ring-rose-500'
                  : 'bg-rose-500/5 border-rose-500/20 hover:border-rose-500/50'
              }`}
            >
              <div className="text-[10px] font-black uppercase text-rose-600 dark:text-rose-400">
                Overlimit (&lt; 0%)
              </div>
              <div className="text-xl font-black font-mono text-rose-600 dark:text-rose-400 mt-1">
                {tempoMappingCounts.overlimit}
              </div>
              <div className="text-[10px] text-slate-500 mt-0.5">Melebihi plafon limit</div>
            </button>

            <button
              type="button"
              onClick={() => {
                setCategoryTab('TEMPO');
                setLimitFilter(limitFilter === 'CRITICAL_20' ? 'ALL' : 'CRITICAL_20');
              }}
              className={`p-3 rounded-xl border text-left transition cursor-pointer ${
                limitFilter === 'CRITICAL_20'
                  ? 'bg-amber-500/15 border-amber-500 ring-1 ring-amber-500'
                  : 'bg-amber-500/5 border-amber-500/20 hover:border-amber-500/50'
              }`}
            >
              <div className="text-[10px] font-black uppercase text-amber-600 dark:text-amber-400">
                Kritis (&le; 20%)
              </div>
              <div className="text-xl font-black font-mono text-amber-600 dark:text-amber-400 mt-1">
                {tempoMappingCounts.critical20}
              </div>
              <div className="text-[10px] text-slate-500 mt-0.5">Sisa limit &le; 20%</div>
            </button>

            <button
              type="button"
              onClick={() => {
                setCategoryTab('TEMPO');
                setLimitFilter(limitFilter === 'WARNING_50' ? 'ALL' : 'WARNING_50');
              }}
              className={`p-3 rounded-xl border text-left transition cursor-pointer ${
                limitFilter === 'WARNING_50'
                  ? 'bg-blue-500/15 border-blue-500 ring-1 ring-blue-500'
                  : 'bg-blue-500/5 border-blue-500/20 hover:border-blue-500/50'
              }`}
            >
              <div className="text-[10px] font-black uppercase text-blue-600 dark:text-blue-400">
                Waspada (20–50%)
              </div>
              <div className="text-xl font-black font-mono text-blue-600 dark:text-blue-400 mt-1">
                {tempoMappingCounts.warning50}
              </div>
              <div className="text-[10px] text-slate-500 mt-0.5">Sisa limit 20% – 50%</div>
            </button>

            <button
              type="button"
              onClick={() => {
                setCategoryTab('TEMPO');
                setLimitFilter(limitFilter === 'SAFE_50' ? 'ALL' : 'SAFE_50');
              }}
              className={`p-3 rounded-xl border text-left transition cursor-pointer ${
                limitFilter === 'SAFE_50'
                  ? 'bg-emerald-500/15 border-emerald-500 ring-1 ring-emerald-500'
                  : 'bg-emerald-500/5 border-emerald-500/20 hover:border-emerald-500/50'
              }`}
            >
              <div className="text-[10px] font-black uppercase text-emerald-600 dark:text-emerald-400">
                Aman (&gt; 50%)
              </div>
              <div className="text-xl font-black font-mono text-emerald-600 dark:text-emerald-400 mt-1">
                {tempoMappingCounts.safe50}
              </div>
              <div className="text-[10px] text-slate-500 mt-0.5">Sisa limit &gt; 50%</div>
            </button>
          </div>
        </div>

        {/* PANEL 2: MAPPING DARI SEGI UMUR PEMBAYARAN BERDASARKAN JATUH TEMPO (HIJAU, KUNING, ORANYE, MERAH) */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-[10px] font-mono font-bold uppercase text-amber-600 dark:text-amber-400">
                DIMENSI MAPPING TEMPO 2
              </span>
              <h3 className="text-sm font-black text-slate-900 dark:text-white">
                Mapping Pelanggan Tempo: Segi Umur Pembayaran Jatuh Tempo
              </h3>
            </div>
            {agingFilter !== 'ALL' && (
              <button
                type="button"
                onClick={() => setAgingFilter('ALL')}
                className="text-[11px] font-bold text-amber-600 dark:text-amber-400 hover:underline cursor-pointer"
              >
                Reset Filter Umur
              </button>
            )}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            {/* HIJAU: Sebelum atau Tepat pada Jatuh Tempo */}
            <button
              type="button"
              onClick={() => {
                setCategoryTab('TEMPO');
                setAgingFilter(agingFilter === 'ON_TIME_0' ? 'ALL' : 'ON_TIME_0');
              }}
              className={`p-3 rounded-xl border text-left transition cursor-pointer ${
                agingFilter === 'ON_TIME_0'
                  ? 'bg-emerald-500/20 border-emerald-500 ring-1 ring-emerald-500'
                  : 'bg-emerald-500/10 border-emerald-500/25 hover:border-emerald-500/60'
              }`}
            >
              <div className="text-[10px] font-black uppercase text-emerald-700 dark:text-emerald-300">
                Sebelum / Tepat JT
              </div>
              <div className="text-xl font-black font-mono text-emerald-600 dark:text-emerald-400 mt-1">
                {tempoMappingCounts.onTime0}
              </div>
              <div className="text-[10px] text-emerald-700/80 dark:text-emerald-300/80 font-semibold mt-0.5">
                &le; 0 Hari (Hijau)
              </div>
            </button>

            {/* KUNING: Pembayaran 1–3 Hari */}
            <button
              type="button"
              onClick={() => {
                setCategoryTab('TEMPO');
                setAgingFilter(agingFilter === 'OVERDUE_1_3' ? 'ALL' : 'OVERDUE_1_3');
              }}
              className={`p-3 rounded-xl border text-left transition cursor-pointer ${
                agingFilter === 'OVERDUE_1_3'
                  ? 'bg-yellow-400/30 border-yellow-500 ring-1 ring-yellow-500'
                  : 'bg-yellow-400/15 border-yellow-500/35 hover:border-yellow-500/70'
              }`}
            >
              <div className="text-[10px] font-black uppercase text-yellow-800 dark:text-yellow-300">
                Pembayaran 1–3 Hr
              </div>
              <div className="text-xl font-black font-mono text-yellow-700 dark:text-yellow-300 mt-1">
                {tempoMappingCounts.overdue1_3}
              </div>
              <div className="text-[10px] text-yellow-800/80 dark:text-yellow-300/80 font-semibold mt-0.5">
                1–3 Hari (Kuning)
              </div>
            </button>

            {/* ORANYE: Pembayaran 4–7 Hari */}
            <button
              type="button"
              onClick={() => {
                setCategoryTab('TEMPO');
                setAgingFilter(agingFilter === 'OVERDUE_4_7' ? 'ALL' : 'OVERDUE_4_7');
              }}
              className={`p-3 rounded-xl border text-left transition cursor-pointer ${
                agingFilter === 'OVERDUE_4_7'
                  ? 'bg-orange-500/20 border-orange-500 ring-1 ring-orange-500'
                  : 'bg-orange-500/10 border-orange-500/30 hover:border-orange-500/60'
              }`}
            >
              <div className="text-[10px] font-black uppercase text-orange-700 dark:text-orange-300">
                Pembayaran 4–7 Hr
              </div>
              <div className="text-xl font-black font-mono text-orange-600 dark:text-orange-400 mt-1">
                {tempoMappingCounts.overdue4_7}
              </div>
              <div className="text-[10px] text-orange-700/80 dark:text-orange-300/80 font-semibold mt-0.5">
                4–7 Hari (Oranye)
              </div>
            </button>

            {/* MERAH: Pembayaran 8–14 Hari */}
            <button
              type="button"
              onClick={() => {
                setCategoryTab('TEMPO');
                setAgingFilter(agingFilter === 'OVERDUE_8_14' ? 'ALL' : 'OVERDUE_8_14');
              }}
              className={`p-3 rounded-xl border text-left transition cursor-pointer ${
                agingFilter === 'OVERDUE_8_14'
                  ? 'bg-rose-500/20 border-rose-500 ring-1 ring-rose-500'
                  : 'bg-rose-500/10 border-rose-500/30 hover:border-rose-500/60'
              }`}
            >
              <div className="text-[10px] font-black uppercase text-rose-700 dark:text-rose-300">
                Pembayaran 8–14 Hr
              </div>
              <div className="text-xl font-black font-mono text-rose-600 dark:text-rose-400 mt-1">
                {tempoMappingCounts.overdue8_14}
              </div>
              <div className="text-[10px] text-rose-700/80 dark:text-rose-300/80 font-semibold mt-0.5">
                8–14 Hari (Merah)
              </div>
            </button>
          </div>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-3.5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Cari Nama Pelanggan / Toko, Wilayah (ROGOJAMPI, SUMBER AYU, dll.)..."
            className="w-full pl-10 pr-4 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-indigo-500"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            value={regionFilter}
            onChange={e => setRegionFilter(e.target.value)}
            className="px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs font-bold text-slate-800 dark:text-slate-200 cursor-pointer"
          >
            <option value="ALL">Semua Wilayah ({regionsList.length})</option>
            {regionsList.map(r => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>

          <select
            value={limitFilter}
            onChange={e => setLimitFilter(e.target.value as LimitHealthBucket)}
            className="px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs font-bold text-slate-800 dark:text-slate-200 cursor-pointer"
          >
            <option value="ALL">Semua Status Sisa Limit</option>
            <option value="OVERLIMIT">Overlimit (Melebihi Limit)</option>
            <option value="CRITICAL_20">Limit Kritis (Sisa &le; 20%)</option>
            <option value="WARNING_50">Limit Waspada (Sisa 20–50%)</option>
            <option value="SAFE_50">Limit Aman (Sisa &gt; 50%)</option>
          </select>

          <select
            value={agingFilter}
            onChange={e => setAgingFilter(e.target.value as AgingTempoBucket)}
            className="px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs font-bold text-slate-800 dark:text-slate-200 cursor-pointer"
          >
            <option value="ALL">Semua Umur Jatuh Tempo</option>
            <option value="ON_TIME_0">Sebelum / Tepat Jatuh Tempo (Hijau)</option>
            <option value="OVERDUE_1_3">Pembayaran 1–3 Hari (Kuning)</option>
            <option value="OVERDUE_4_7">Pembayaran 4–7 Hari (Oranye)</option>
            <option value="OVERDUE_8_14">Pembayaran 8–14 Hari (Merah)</option>
          </select>
        </div>
      </div>

      {/* Tabel Mapping Master Pelanggan */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-xs">
        <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-black text-slate-900 dark:text-white">
              Tabel Mapping Master Pelanggan ({filteredRows.length} Pelanggan)
            </h3>
            <p className="text-[11px] text-slate-500">
              Klik <strong>Atur Kategori &amp; Limit</strong> untuk mengubah status Pelanggan TEMPO / COD, Plafon Limit Piutang, dan Tenor Hari.
            </p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-50 dark:bg-slate-950 text-slate-600 dark:text-slate-400 uppercase font-bold text-[10px] border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th className="py-3 px-4">Nama Pelanggan &amp; Wilayah</th>
                <th className="py-3 px-4 text-center">Kategori (Tempo / COD)</th>
                <th className="py-3 px-4 text-right">Limit Pelanggan</th>
                <th className="py-3 px-4 text-right">Piutang Terutang</th>
                <th className="py-3 px-4 text-right">Sisa Limit Piutang</th>
                <th className="py-3 px-4">Mapping Segi Sisa Limit</th>
                <th className="py-3 px-4">Mapping Umur Pembayaran (Jatuh Tempo)</th>
                <th className="py-3 px-4 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
              {filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-400">
                    Tidak ada pelanggan yang sesuai dengan filter mapping di atas.
                  </td>
                </tr>
              ) : (
                filteredRows.map(row => {
                  const isOverlimit = row.paymentCategory === 'TEMPO' && row.sisaLimit < 0;
                  const barWidth = Math.min(100, Math.max(0, row.usageRatioPct));
                  return (
                    <tr key={row.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition">
                      <td className="py-3 px-4">
                        <div className="font-black text-slate-900 dark:text-white">{row.customerName}</div>
                        <div className="text-[10px] text-slate-500 flex items-center gap-1.5 mt-0.5">
                          <MapPin className="w-3 h-3 text-indigo-500 shrink-0" />
                          <span className="font-bold text-slate-700 dark:text-slate-300">{row.region}</span>
                          <span>&bull;</span>
                          <span className="font-mono">{row.contactPhone}</span>
                          <span>&bull;</span>
                          <span>{row.activeInvoiceCount} Faktur Aktif</span>
                        </div>
                      </td>

                      <td className="py-3 px-4 text-center">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg font-mono font-black text-[10px] border ${
                            row.paymentCategory === 'TEMPO'
                              ? 'bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 border-indigo-500/30'
                              : 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30'
                          }`}
                        >
                          {row.paymentCategory === 'TEMPO' ? `TEMPO (${row.tempoDays} Hari)` : 'COD (TUNAI)'}
                        </span>
                      </td>

                      <td className="py-3 px-4 text-right font-mono font-bold text-slate-800 dark:text-slate-200 tabular-nums">
                        {row.paymentCategory === 'COD' ? (
                          <span className="text-slate-400">Tanpa Limit (COD)</span>
                        ) : (
                          `Rp ${row.limitPelanggan.toLocaleString('id-ID')}`
                        )}
                      </td>

                      <td className="py-3 px-4 text-right font-mono font-black text-blue-700 dark:text-blue-400 tabular-nums">
                        Rp {row.totalTerutang.toLocaleString('id-ID')}
                      </td>

                      <td className="py-3 px-4 text-right font-mono font-black tabular-nums">
                        {row.paymentCategory === 'COD' ? (
                          <span className="text-slate-400">-</span>
                        ) : isOverlimit ? (
                          <div className="text-rose-600 dark:text-rose-400">
                            <div>-Rp {Math.abs(row.sisaLimit).toLocaleString('id-ID')}</div>
                            <div className="text-[9px] font-bold uppercase">Overlimit ({row.usageRatioPct}%)</div>
                          </div>
                        ) : (
                          <div className="text-emerald-600 dark:text-emerald-400">
                            <div>Rp {row.sisaLimit.toLocaleString('id-ID')}</div>
                            <div className="text-[9px] text-slate-400 font-normal">Terpakai {row.usageRatioPct}%</div>
                          </div>
                        )}
                      </td>

                      <td className="py-3 px-4 min-w-[200px]">
                        <span
                          className={`px-2 py-0.5 rounded-md font-bold text-[10px] inline-block border ${row.limitStatus.badgeClass}`}
                        >
                          {row.limitStatus.label}
                        </span>
                        {row.paymentCategory === 'TEMPO' && row.limitPelanggan > 0 && (
                          <div className="w-full h-1.5 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden mt-1.5">
                            <div
                              className={`h-full rounded-full ${
                                isOverlimit
                                  ? 'bg-rose-600'
                                  : row.usageRatioPct >= 80
                                  ? 'bg-amber-500'
                                  : row.usageRatioPct >= 50
                                  ? 'bg-blue-500'
                                  : 'bg-emerald-500'
                              }`}
                              style={{ width: `${barWidth}%` }}
                            />
                          </div>
                        )}
                      </td>

                      <td className="py-3 px-4 min-w-[210px]">
                        <span
                          className={`px-2 py-0.5 rounded-md font-bold text-[10px] inline-block border ${row.agingStatus.badgeClass}`}
                        >
                          {row.agingStatus.label}
                        </span>
                        {row.oldestDueDate && (
                          <div className="text-[10px] text-slate-500 font-mono mt-1">
                            JT Terlama: {formatIndonesianShortDate(row.oldestDueDate)}
                          </div>
                        )}
                      </td>

                      <td className="py-3 px-4 text-right">
                        <button
                          type="button"
                          onClick={() => handleOpenEditCustomer(row)}
                          className="px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 hover:bg-indigo-600 hover:text-white hover:border-indigo-600 text-slate-700 dark:text-slate-200 font-bold text-[11px] inline-flex items-center gap-1 transition cursor-pointer"
                        >
                          <Edit3 className="w-3 h-3" />
                          <span>Atur Kategori &amp; Limit</span>
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Tambah / Edit Master Pelanggan */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <div>
                <h3 className="text-sm font-black text-slate-900 dark:text-white">
                  {editingCustomer ? 'Edit Mapping Master Pelanggan' : 'Tambah Master Pelanggan Baru'}
                </h3>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Pengaturan Kategori Pembayaran (TEMPO / COD), Limit Piutang &amp; Tenor Jatuh Tempo
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-900 dark:hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveCustomerForm} className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Nama Pelanggan / Toko *
                </label>
                <input
                  type="text"
                  required
                  value={formState.customerName}
                  onChange={e => setFormState({ ...formState, customerName: e.target.value })}
                  placeholder="Contoh: BP H KHOLIK / TK WIGEN"
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 font-bold text-slate-900 dark:text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Wilayah *
                  </label>
                  <input
                    type="text"
                    required
                    value={formState.region}
                    onChange={e => setFormState({ ...formState, region: e.target.value })}
                    placeholder="ROGOJAMPI / SUMBER AYU"
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 font-bold text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Kontak / WhatsApp
                  </label>
                  <input
                    type="text"
                    value={formState.contactPhone}
                    onChange={e => setFormState({ ...formState, contactPhone: e.target.value })}
                    placeholder="0812-..."
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Kategori Pelanggan (TEMPO / COD) *
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setFormState({ ...formState, paymentCategory: 'TEMPO', tempoDays: formState.tempoDays || 14 })}
                    className={`py-2.5 px-3 rounded-xl font-black text-xs border cursor-pointer transition ${
                      formState.paymentCategory === 'TEMPO'
                        ? 'bg-indigo-600 text-white border-indigo-600'
                        : 'bg-slate-50 dark:bg-slate-950 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-800'
                    }`}
                  >
                    PELANGGAN TEMPO
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormState({ ...formState, paymentCategory: 'COD', limitPelanggan: 0, tempoDays: 0 })}
                    className={`py-2.5 px-3 rounded-xl font-black text-xs border cursor-pointer transition ${
                      formState.paymentCategory === 'COD'
                        ? 'bg-emerald-600 text-white border-emerald-600'
                        : 'bg-slate-50 dark:bg-slate-950 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-800'
                    }`}
                  >
                    PELANGGAN COD (TUNAI)
                  </button>
                </div>
              </div>

              {formState.paymentCategory === 'TEMPO' && (
                <div className="grid grid-cols-2 gap-3 p-3 rounded-xl bg-indigo-500/5 border border-indigo-500/20">
                  <div>
                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Limit Piutang Pelanggan (Rp) *
                    </label>
                    <input
                      type="number"
                      min={0}
                      step={100000}
                      required
                      value={formState.limitPelanggan}
                      onChange={e => setFormState({ ...formState, limitPelanggan: Number(e.target.value) })}
                      className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 font-mono font-black text-slate-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Tenor Jatuh Tempo (Hari) *
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={120}
                      required
                      value={formState.tempoDays}
                      onChange={e => setFormState({ ...formState, tempoDays: Number(e.target.value) })}
                      className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 font-mono font-black text-slate-900 dark:text-white"
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Catatan Kredit / Mapping Pelanggan
                </label>
                <input
                  type="text"
                  value={formState.notes}
                  onChange={e => setFormState({ ...formState, notes: e.target.value })}
                  placeholder="Contoh: Pelanggan rutin mingguan area Rogojampi..."
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-black cursor-pointer"
                >
                  Simpan Mapping Pelanggan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
