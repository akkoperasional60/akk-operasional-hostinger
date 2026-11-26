import React, { useMemo, useState } from 'react';
import * as XLSX from 'xlsx';
import {
  BadgePercent,
  Calendar,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  Pencil,
  Plus,
  Search,
  Trash2,
  Upload,
  UserCheck,
  X
} from 'lucide-react';
import { MONTH_OPTIONS } from './SalesHeaderFilter';
import type { DiscountErrorLogItem, ModernDropdownOption } from './SalesKpi';

interface ParsedDiscountDraftRow {
  tempId: string;
  rawAdmin: string;
  matchedAdmin: string;
  branchId: string;
  rawDate: string;
  isoDate: string;
  month: string;
  year: string;
  noFakturOrSo: string;
  keterangan: string;
}

type ImportSaveMode = 'append' | 'replace_period';

interface DropdownComponentProps {
  label?: string;
  value: string;
  onChange: (val: string) => void;
  options: ModernDropdownOption[];
  icon?: React.ReactNode;
  variant?: 'filter-card' | 'compact' | 'form-input';
  searchable?: boolean;
  searchPlaceholder?: string;
}

interface DiscountErrorMonitoringSectionProps {
  discountErrorLogs: DiscountErrorLogItem[];
  onSaveDiscountErrorLogs: (nextLogs: DiscountErrorLogItem[]) => void;
  selectedBranchId: string;
  selectedMonth: string;
  selectedYear: string;
  selectedAdminFilter: string;
  activeBranchAdminNames: string[];
  sidoarjoAdminNames: string[];
  showToast: (msg: string) => void;
  DropdownComponent: React.FC<DropdownComponentProps>;
  onSelectPeriod?: (month: string, year: string) => void;
}

const INDO_MONTH_MAP: Record<string, number> = {
  jan: 0,
  januari: 0,
  january: 0,
  feb: 1,
  februari: 1,
  february: 1,
  mar: 2,
  maret: 2,
  march: 2,
  apr: 3,
  april: 3,
  mei: 4,
  may: 4,
  jun: 5,
  juni: 5,
  june: 5,
  jul: 6,
  juli: 6,
  july: 6,
  agu: 7,
  agt: 7,
  agustus: 7,
  aug: 7,
  august: 7,
  sep: 8,
  sept: 8,
  september: 8,
  okt: 9,
  oktober: 9,
  oct: 9,
  october: 9,
  nov: 10,
  november: 10,
  des: 11,
  desember: 11,
  dec: 11,
  december: 11
};

const pad2 = (n: number) => String(n).padStart(2, '0');

export const parseIndonesianOrExcelDate = (
  raw: unknown,
  fallbackMonth: string,
  fallbackYear: string
): { isoDate: string; month: string; year: string; rawText: string } => {
  const fallbackMonthIdx = Math.max(0, MONTH_OPTIONS.indexOf(fallbackMonth));
  const fallbackIso = `${fallbackYear}-${pad2(fallbackMonthIdx + 1)}-01`;

  if (typeof raw === 'number' && Number.isFinite(raw) && raw > 20000 && raw < 80000) {
    const parsed = XLSX.SSF.parse_date_code(raw);
    if (parsed && parsed.y && parsed.m && parsed.d) {
      const mIdx = Math.min(11, Math.max(0, parsed.m - 1));
      return {
        isoDate: `${parsed.y}-${pad2(parsed.m)}-${pad2(parsed.d)}`,
        month: MONTH_OPTIONS[mIdx] || fallbackMonth,
        year: String(parsed.y),
        rawText: `${pad2(parsed.d)} ${(MONTH_OPTIONS[mIdx] || '').slice(0, 3)} ${parsed.y}`
      };
    }
  }

  const text = String(raw ?? '').trim();
  if (!text) {
    return { isoDate: fallbackIso, month: fallbackMonth, year: fallbackYear, rawText: fallbackIso };
  }

  const isoMatch = text.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);
  if (isoMatch) {
    const y = Number(isoMatch[1]);
    const m = Number(isoMatch[2]);
    const d = Number(isoMatch[3]);
    if (m >= 1 && m <= 12 && d >= 1 && d <= 31) {
      return {
        isoDate: `${y}-${pad2(m)}-${pad2(d)}`,
        month: MONTH_OPTIONS[m - 1] || fallbackMonth,
        year: String(y),
        rawText: text
      };
    }
  }

  const dmyNumMatch = text.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{2,4})$/);
  if (dmyNumMatch) {
    const d = Number(dmyNumMatch[1]);
    const m = Number(dmyNumMatch[2]);
    let y = Number(dmyNumMatch[3]);
    if (y < 100) y += 2000;
    if (m >= 1 && m <= 12 && d >= 1 && d <= 31) {
      return {
        isoDate: `${y}-${pad2(m)}-${pad2(d)}`,
        month: MONTH_OPTIONS[m - 1] || fallbackMonth,
        year: String(y),
        rawText: text
      };
    }
  }

  const textMatch = text.match(/^(\d{1,2})[\s\-./]+([A-Za-z]+)[\s\-./,]+(\d{2,4})$/);
  if (textMatch) {
    const d = Number(textMatch[1]);
    const monthKey = textMatch[2].toLowerCase().replace(/[^a-z]/g, '');
    let y = Number(textMatch[3]);
    if (y < 100) y += 2000;
    const mIdx = INDO_MONTH_MAP[monthKey];
    if (mIdx !== undefined && d >= 1 && d <= 31) {
      return {
        isoDate: `${y}-${pad2(mIdx + 1)}-${pad2(d)}`,
        month: MONTH_OPTIONS[mIdx] || fallbackMonth,
        year: String(y),
        rawText: text
      };
    }
  }

  const nativeDate = new Date(text);
  if (!Number.isNaN(nativeDate.getTime())) {
    const y = nativeDate.getFullYear();
    const mIdx = nativeDate.getMonth();
    const d = nativeDate.getDate();
    return {
      isoDate: `${y}-${pad2(mIdx + 1)}-${pad2(d)}`,
      month: MONTH_OPTIONS[mIdx] || fallbackMonth,
      year: String(y),
      rawText: text
    };
  }

  return { isoDate: fallbackIso, month: fallbackMonth, year: fallbackYear, rawText: text };
};

const KNOWN_ADMIN_NICKNAMES: Record<string, string> = {
  BINTANG: 'BINTANG MEDITA SARI',
  FATA: 'FATAUDIN RIFKY MAULANA',
  FATAUDIN: 'FATAUDIN RIFKY MAULANA',
  ISTI: 'PIPIT ISTIANI',
  PIPIT: 'PIPIT ISTIANI',
  IZZUL: 'IZZUL BAHRUL HISAM',
  MEINDA: 'MEINDA MAULINA',
  SHOIM: 'MOHAMMAD SHOIM',
  MOHAMMAD: 'MOHAMMAD SHOIM'
};

export const resolveBranchAdminName = (
  rawName: string,
  activeBranchAdminNames: string[]
): string => {
  const cleaned = rawName.trim().toUpperCase().replace(/\s+/g, ' ');
  if (!cleaned) return '';

  if (cleaned === 'MUHAMMAD SHOIM') {
    const official = activeBranchAdminNames.find(n => n.toUpperCase() === 'MOHAMMAD SHOIM');
    if (official) return official;
  }

  const exactMatch = activeBranchAdminNames.find(n => n.toUpperCase() === cleaned);
  if (exactMatch) return exactMatch;

  const nicknameTarget = KNOWN_ADMIN_NICKNAMES[cleaned];
  if (nicknameTarget) {
    const matchedTarget = activeBranchAdminNames.find(n => n.toUpperCase() === nicknameTarget);
    if (matchedTarget) return matchedTarget;
    return nicknameTarget;
  }

  const tokenMatch = activeBranchAdminNames.find(n => {
    const upper = n.toUpperCase();
    const words = upper.split(/\s+/);
    return words.some(w => w === cleaned || w.startsWith(cleaned)) || upper.includes(cleaned);
  });
  if (tokenMatch) return tokenMatch;

  return cleaned;
};

const findColumnValue = (row: Record<string, unknown>, candidates: string[]): unknown => {
  const entries = Object.entries(row);
  for (const cand of candidates) {
    const exact = entries.find(([k]) => k.trim().toLowerCase() === cand.toLowerCase());
    if (exact && String(exact[1] ?? '').trim() !== '') return exact[1];
  }
  for (const cand of candidates) {
    const partial = entries.find(([k]) => k.trim().toLowerCase().includes(cand.toLowerCase()));
    if (partial && String(partial[1] ?? '').trim() !== '') return partial[1];
  }
  return '';
};

const formatDisplayDate = (isoDate: string): string => {
  const m = isoDate.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return isoDate;
  const monthIdx = Number(m[2]) - 1;
  const shortMonth = (MONTH_OPTIONS[monthIdx] || '').slice(0, 3);
  return `${m[3]} ${shortMonth} ${m[1]}`;
};

export const DiscountErrorMonitoringSection: React.FC<DiscountErrorMonitoringSectionProps> = ({
  discountErrorLogs,
  onSaveDiscountErrorLogs,
  selectedBranchId,
  selectedMonth,
  selectedYear,
  selectedAdminFilter,
  activeBranchAdminNames,
  sidoarjoAdminNames,
  showToast,
  DropdownComponent,
  onSelectPeriod
}) => {
  // Form Input & Edit State (Tanggal, Nama Admin, No. Faktur / SO, Keterangan / Barang)
  const [isAddDiscountErrOpen, setIsAddDiscountErrOpen] = useState(false);
  const [editingDiscountId, setEditingDiscountId] = useState<string | null>(null);
  const [dscDate, setDscDate] = useState('');
  const [dscAdmin, setDscAdmin] = useState('');
  const [dscNoFaktur, setDscNoFaktur] = useState('');
  const [dscKeterangan, setDscKeterangan] = useState('');

  // Upload / Import Excel & CSV State
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [uploadFileName, setUploadFileName] = useState('');
  const [parsedDraftRows, setParsedDraftRows] = useState<ParsedDiscountDraftRow[]>([]);
  const [importSaveMode, setImportSaveMode] = useState<ImportSaveMode>('append');
  const [uploadErrorMsg, setUploadErrorMsg] = useState('');

  // Search, Admin Subfilter, Period Scope & Inline Delete Confirmation
  const [searchQuery, setSearchQuery] = useState('');
  const [adminTableFilter, setAdminTableFilter] = useState('SEMUA ADMIN');
  const [periodScope, setPeriodScope] = useState<'selected' | 'all'>('selected');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const effectiveAdminFilter =
    selectedAdminFilter !== 'SEMUA ADMIN' ? selectedAdminFilter : adminTableFilter;

  const periodFilteredLogs = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return discountErrorLogs.filter(d => {
      if (selectedBranchId !== 'ALL' && d.branchId !== selectedBranchId) return false;
      if (
        effectiveAdminFilter !== 'SEMUA ADMIN' &&
        d.adminName.toUpperCase() !== effectiveAdminFilter.toUpperCase()
      ) {
        return false;
      }
      if (periodScope === 'selected') {
        if (d.month !== selectedMonth || d.year !== selectedYear) return false;
      }
      if (q) {
        const hay = `${d.adminName} ${d.noFakturOrSo} ${d.keterangan} ${d.date} ${formatDisplayDate(d.date)}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [
    discountErrorLogs,
    selectedBranchId,
    effectiveAdminFilter,
    periodScope,
    selectedMonth,
    selectedYear,
    searchQuery
  ]);

  const allPeriodCountForBranch = useMemo(() => {
    return discountErrorLogs.filter(d => {
      if (selectedBranchId !== 'ALL' && d.branchId !== selectedBranchId) return false;
      if (
        effectiveAdminFilter !== 'SEMUA ADMIN' &&
        d.adminName.toUpperCase() !== effectiveAdminFilter.toUpperCase()
      ) {
        return false;
      }
      return true;
    }).length;
  }, [discountErrorLogs, selectedBranchId, effectiveAdminFilter]);

  const summaryStats = useMemo(() => {
    const totalCount = periodFilteredLogs.length;
    const uniqueAdmins = new Set(periodFilteredLogs.map(r => r.adminName.toUpperCase())).size;
    return { totalCount, uniqueAdmins };
  }, [periodFilteredLogs]);

  // Download Excel / CSV Template focused strictly on ADMIN, TANGGAL, Nama Pelanggan (No. Faktur/SO), Keterangan Barang
  const handleDownloadTemplate = (format: 'xlsx' | 'csv') => {
    const sampleRows = [
      {
        ADMIN: 'BINTANG',
        TANGGAL: '03 Okt 2026',
        'Nama Pelanggan': 'FJ02-1026-0315',
        'Keterangan Barang': 'DOS 1/5 KRAFT 310GR (3PAK/IKT)'
      },
      {
        ADMIN: 'BINTANG',
        TANGGAL: '06 Okt 2026',
        'Nama Pelanggan': 'FJ02B-1026-0060',
        'Keterangan Barang': 'FOAM KCS TF 3 SEKAT (100/1.000)'
      },
      {
        ADMIN: 'FATA',
        TANGGAL: '06 Okt 2026',
        'Nama Pelanggan': 'FGN02B-1026-0001',
        'Keterangan Barang': 'MIKA GLX PIRING HIP 9 (50/1.000) DB16-DA21-T2'
      }
    ];

    const worksheet = XLSX.utils.json_to_sheet(sampleRows);
    worksheet['!cols'] = [{ wch: 24 }, { wch: 15 }, { wch: 22 }, { wch: 48 }];
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Kesalahan_Diskon');
    if (format === 'csv') {
      XLSX.writeFile(workbook, 'Template_Kesalahan_Input_Diskon.csv', { bookType: 'csv' });
    } else {
      XLSX.writeFile(workbook, 'Template_Kesalahan_Input_Diskon.xlsx');
    }
    showToast(`Template ${format.toUpperCase()} Kesalahan Input Diskon berhasil diunduh.`);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadErrorMsg('');
    setUploadFileName(file.name);

    const reader = new FileReader();
    reader.onload = ev => {
      try {
        const buffer = ev.target?.result;
        if (!buffer) return;
        const wb = XLSX.read(buffer, { type: 'array', cellDates: false });
        const firstSheetName = wb.SheetNames[0];
        if (!firstSheetName) {
          setUploadErrorMsg('Sheet Excel tidak ditemukan.');
          setParsedDraftRows([]);
          return;
        }
        const sheet = wb.Sheets[firstSheetName];
        const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' });

        const drafts: ParsedDiscountDraftRow[] = [];
        rawRows.forEach((row, idx) => {
          const rawAdminVal = String(
            findColumnValue(row, ['ADMIN', 'NAMA ADMIN', 'NAMA', 'STAFF']) || ''
          ).trim();
          const rawDateVal = findColumnValue(row, ['TANGGAL', 'TGL', 'DATE', 'TANGGAL KIRIM']);
          const rawFakturVal = String(
            findColumnValue(row, [
              'No. Faktur / SO',
              'NO. FAKTUR / SO',
              'NO FAKTUR',
              'NO. FAKTUR',
              'FAKTUR',
              'NO SO',
              'Nama Pelanggan',
              'PELANGGAN'
            ]) || ''
          ).trim();
          const rawKetVal = String(
            findColumnValue(row, [
              'Keterangan Barang',
              'KETERANGAN / BARANG',
              'KETERANGAN KESALAHAN DISKON',
              'KETERANGAN',
              'NAMA BARANG',
              'ITEM',
              'BARANG',
              'CATATAN'
            ]) || ''
          ).trim();

          if (!rawAdminVal && !rawFakturVal && !rawKetVal) return;

          const matchedAdmin = resolveBranchAdminName(
            rawAdminVal || activeBranchAdminNames[0] || 'ADMIN',
            activeBranchAdminNames
          );
          const targetBranch = sidoarjoAdminNames.includes(matchedAdmin)
            ? 'cab-sidoarjo'
            : selectedBranchId === 'ALL'
            ? 'cab-banyuwangi'
            : selectedBranchId;

          const parsedDate = parseIndonesianOrExcelDate(rawDateVal, selectedMonth, selectedYear);

          drafts.push({
            tempId: `draft-${Date.now()}-${idx}`,
            rawAdmin: rawAdminVal || matchedAdmin,
            matchedAdmin,
            branchId: targetBranch,
            rawDate: parsedDate.rawText,
            isoDate: parsedDate.isoDate,
            month: parsedDate.month,
            year: parsedDate.year,
            noFakturOrSo: (rawFakturVal || '-').toUpperCase(),
            keterangan: rawKetVal || '-'
          });
        });

        if (drafts.length === 0) {
          setUploadErrorMsg(
            'Tidak ada baris valid yang terbaca. Pastikan header kolom mencakup ADMIN, TANGGAL, Nama Pelanggan (No. Faktur / SO), dan Keterangan Barang.'
          );
        }
        setParsedDraftRows(drafts);
      } catch (err) {
        console.error('Failed to parse discount error spreadsheet:', err);
        setUploadErrorMsg('Gagal membaca file. Pastikan format file adalah .xlsx, .xls, atau .csv yang valid.');
        setParsedDraftRows([]);
      }
    };
    reader.readAsArrayBuffer(file);
    e.target.value = '';
  };

  const previewMappedLogs = useMemo<DiscountErrorLogItem[]>(
    () =>
      parsedDraftRows.map((draft, i) => ({
        id: `dsc-imp-${Date.now()}-${i}`,
        date: draft.isoDate,
        branchId: draft.branchId,
        month: draft.month,
        year: draft.year,
        adminName: draft.matchedAdmin,
        noFakturOrSo: draft.noFakturOrSo,
        keterangan: draft.keterangan
      })),
    [parsedDraftRows]
  );

  const handleConfirmImport = () => {
    if (previewMappedLogs.length === 0) return;

    let nextLogs: DiscountErrorLogItem[];
    if (importSaveMode === 'replace_period') {
      const remaining = discountErrorLogs.filter(existing => {
        const branchMatches = selectedBranchId === 'ALL' || existing.branchId === selectedBranchId;
        const periodMatches = existing.month === selectedMonth && existing.year === selectedYear;
        return !(branchMatches && periodMatches);
      });
      nextLogs = [...previewMappedLogs, ...remaining];
    } else {
      nextLogs = [...previewMappedLogs, ...discountErrorLogs];
    }

    onSaveDiscountErrorLogs(nextLogs);

    const periodCounts = new Map<string, { month: string; year: string; count: number }>();
    previewMappedLogs.forEach(item => {
      const key = `${item.month}__${item.year}`;
      const cur = periodCounts.get(key);
      if (cur) cur.count += 1;
      else periodCounts.set(key, { month: item.month, year: item.year, count: 1 });
    });
    const topPeriod = Array.from(periodCounts.values()).sort((a, b) => b.count - a.count)[0];
    if (topPeriod && (topPeriod.month !== selectedMonth || topPeriod.year !== selectedYear)) {
      if (onSelectPeriod) {
        onSelectPeriod(topPeriod.month, topPeriod.year);
      } else {
        setPeriodScope('all');
      }
    }

    showToast(
      `${previewMappedLogs.length} catatan kesalahan input diskon berhasil diimpor & disinkronkan ke KPI Individu.`
    );
    setIsUploadOpen(false);
    setParsedDraftRows([]);
    setUploadFileName('');
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const targetAdmin = (dscAdmin || activeBranchAdminNames[0] || '').trim().toUpperCase();
    if (!targetAdmin || !dscNoFaktur.trim()) {
      showToast('Mohon isi Nama Admin dan No. Faktur / SO.');
      return;
    }

    const parsedDate = parseIndonesianOrExcelDate(
      dscDate || new Date().toISOString().slice(0, 10),
      selectedMonth,
      selectedYear
    );

    const targetBr = sidoarjoAdminNames.includes(targetAdmin)
      ? 'cab-sidoarjo'
      : selectedBranchId === 'ALL'
      ? 'cab-banyuwangi'
      : selectedBranchId;

    if (editingDiscountId) {
      const nextLogs = discountErrorLogs.map(item =>
        item.id === editingDiscountId
          ? {
              ...item,
              date: parsedDate.isoDate,
              month: parsedDate.month,
              year: parsedDate.year,
              branchId: targetBr,
              adminName: targetAdmin,
              noFakturOrSo: dscNoFaktur.trim().toUpperCase(),
              keterangan: dscKeterangan.trim() || '-'
            }
          : item
      );
      onSaveDiscountErrorLogs(nextLogs);
      setEditingDiscountId(null);
      setDscNoFaktur('');
      setDscKeterangan('');
      setIsAddDiscountErrOpen(false);
      showToast(`Catatan kesalahan diskon untuk ${targetAdmin} berhasil diperbarui.`);
      return;
    }

    const newLog: DiscountErrorLogItem = {
      id: `dsc-${Date.now()}`,
      date: parsedDate.isoDate,
      branchId: targetBr,
      month: parsedDate.month,
      year: parsedDate.year,
      adminName: targetAdmin,
      noFakturOrSo: dscNoFaktur.trim().toUpperCase(),
      keterangan: dscKeterangan.trim() || '-'
    };

    const nextLogs = [newLog, ...discountErrorLogs];
    onSaveDiscountErrorLogs(nextLogs);
    setDscNoFaktur('');
    setDscKeterangan('');
    setIsAddDiscountErrOpen(false);
    showToast(`Kesalahan input diskon untuk ${targetAdmin} berhasil disimpan.`);
  };

  return (
    <div className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-4 sm:p-5 space-y-5">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 sm:p-6 space-y-5">
        {/* Header Row */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-start sm:items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
              <BadgePercent className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white tracking-tight">
                Monitoring Kesalahan Penginputan Diskon
              </h3>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Daftar temuan faktur &amp; keterangan barang kesalahan input diskon per admin
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => handleDownloadTemplate('xlsx')}
              className="px-3.5 py-2 rounded-lg bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition whitespace-nowrap shrink-0"
            >
              <Download className="w-4 h-4 text-slate-500" />
              <span>Unduh Template</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setIsUploadOpen(prev => !prev);
                setIsAddDiscountErrOpen(false);
              }}
              className={`px-3.5 py-2 rounded-lg border text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition whitespace-nowrap shrink-0 ${
                isUploadOpen
                  ? 'bg-blue-50 dark:bg-blue-950/50 border-blue-600 text-blue-700 dark:text-blue-300'
                  : 'bg-white dark:bg-slate-800 hover:bg-blue-50 dark:hover:bg-slate-700 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800'
              }`}
            >
              <Upload className="w-4 h-4" />
              <span>{isUploadOpen ? 'Tutup Upload' : 'Upload Excel / CSV'}</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setIsUploadOpen(false);
                if (isAddDiscountErrOpen) {
                  setIsAddDiscountErrOpen(false);
                  setEditingDiscountId(null);
                } else {
                  setEditingDiscountId(null);
                  setDscDate(new Date().toISOString().slice(0, 10));
                  setDscAdmin(
                    effectiveAdminFilter !== 'SEMUA ADMIN'
                      ? effectiveAdminFilter
                      : activeBranchAdminNames[0] || ''
                  );
                  setDscNoFaktur('');
                  setDscKeterangan('');
                  setIsAddDiscountErrOpen(true);
                }
              }}
              className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition whitespace-nowrap shrink-0"
            >
              <Plus className="w-4 h-4" />
              <span>{isAddDiscountErrOpen ? 'Tutup Form' : 'Catat Kesalahan Diskon'}</span>
            </button>
          </div>
        </div>

        {/* Compact Flat Summary Strip (Tanpa angka Rp 0 / 0%) */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
            <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
              Total Temuan ({periodScope === 'selected' ? `${selectedMonth} ${selectedYear}` : 'Semua Periode'})
            </div>
            <div className="text-2xl font-bold text-slate-900 dark:text-white mt-1 tabular-nums">
              {summaryStats.totalCount}{' '}
              <span className="text-sm font-medium text-slate-500">Faktur</span>
            </div>
          </div>
          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
            <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
              Admin Terdampak
            </div>
            <div className="text-2xl font-bold text-slate-900 dark:text-white mt-1 tabular-nums">
              {summaryStats.uniqueAdmins}{' '}
              <span className="text-sm font-medium text-slate-500">Admin</span>
            </div>
          </div>
          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
            <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
              Periode KPI Aktif
            </div>
            <div className="text-lg font-bold text-blue-600 dark:text-blue-400 mt-1.5 flex items-center gap-2">
              <Calendar className="w-4 h-4 shrink-0" />
              <span>{periodScope === 'selected' ? `${selectedMonth} ${selectedYear}` : 'Semua Periode'}</span>
            </div>
          </div>
        </div>

        {/* UPLOAD & PREVIEW PANEL */}
        {isUploadOpen && (
          <div className="p-4 sm:p-5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-blue-200 dark:border-blue-900 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-2.5">
                <FileSpreadsheet className="w-5 h-5 text-blue-600 shrink-0" />
                <div>
                  <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                    Import File Excel / CSV Kesalahan Input Diskon
                  </h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Kolom terbaca: <strong>ADMIN</strong>, <strong>TANGGAL</strong>,{' '}
                    <strong>Nama Pelanggan</strong> (sebagai <strong>No. Faktur / SO</strong>), dan{' '}
                    <strong>Keterangan Barang</strong>
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleDownloadTemplate('csv')}
                  className="px-3 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 cursor-pointer whitespace-nowrap"
                >
                  Unduh Contoh CSV
                </button>
                <button
                  type="button"
                  onClick={() => setIsUploadOpen(false)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white cursor-pointer"
                  title="Tutup panel upload"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* File Dropzone */}
              <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-dashed border-slate-300 dark:border-slate-700 flex flex-col justify-between gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-200 mb-2">
                    Pilih File (.xlsx, .xls, .csv)
                  </label>
                  <input
                    type="file"
                    accept=".xlsx,.xls,.csv"
                    onChange={handleFileChange}
                    className="w-full text-xs text-slate-700 dark:text-slate-300 file:mr-3 file:py-2 file:px-3.5 file:rounded-lg file:border-0 file:bg-blue-600 file:text-xs file:font-semibold file:text-white hover:file:bg-blue-700 cursor-pointer"
                  />
                </div>
                {uploadFileName && (
                  <div className="flex items-center gap-2 text-xs font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 px-3 py-2 rounded-lg">
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                    <span className="truncate">
                      {uploadFileName} &middot; {parsedDraftRows.length} baris berhasil dibaca
                    </span>
                  </div>
                )}
                {uploadErrorMsg && (
                  <div className="text-xs font-semibold text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 px-3 py-2 rounded-lg">
                    {uploadErrorMsg}
                  </div>
                )}
              </div>

              {/* Import Mode & Mapping Info */}
              <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-3">
                <div>
                  <div className="text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1.5">
                    Mode Simpan Data
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setImportSaveMode('append')}
                      className={`px-3 py-2 rounded-lg text-xs font-semibold border text-left cursor-pointer transition ${
                        importSaveMode === 'append'
                          ? 'bg-blue-50 dark:bg-blue-950/50 border-blue-600 text-blue-700 dark:text-blue-300'
                          : 'bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
                      }`}
                    >
                      Tambahkan (Append)
                    </button>
                    <button
                      type="button"
                      onClick={() => setImportSaveMode('replace_period')}
                      className={`px-3 py-2 rounded-lg text-xs font-semibold border text-left cursor-pointer transition ${
                        importSaveMode === 'replace_period'
                          ? 'bg-blue-50 dark:bg-blue-950/50 border-blue-600 text-blue-700 dark:text-blue-300'
                          : 'bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
                      }`}
                    >
                      Timpa Periode ({selectedMonth})
                    </button>
                  </div>
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed pt-1 border-t border-slate-100 dark:border-slate-800">
                  Kolom <strong className="text-slate-700 dark:text-slate-200">Nama Pelanggan</strong> pada file template otomatis disimpan sebagai{' '}
                  <strong className="text-blue-600 dark:text-blue-400">No. Faktur / SO</strong>, dan kolom persentase/selisih diabaikan agar tabel tetap ringkas.
                </div>
              </div>
            </div>

            {/* Preview Table */}
            {previewMappedLogs.length > 0 && (
              <div className="space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <h5 className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">
                    Preview Baris Terbaca ({previewMappedLogs.length} Baris)
                  </h5>
                  <span className="text-xs text-slate-500">
                    Nama pendek admin (BINTANG, FATA, ISTI) otomatis dicocokkan ke daftar admin cabang
                  </span>
                </div>

                <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 max-h-80 overflow-y-auto">
                  <table className="w-full text-left divide-y divide-slate-200 dark:divide-slate-800">
                    <thead className="sticky top-0 bg-slate-50 dark:bg-slate-800 text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider">
                      <tr>
                        <th className="py-3 px-4 w-12">No</th>
                        <th className="py-3 px-4">Tanggal</th>
                        <th className="py-3 px-4">Nama Admin</th>
                        <th className="py-3 px-4">No. Faktur / SO</th>
                        <th className="py-3 px-4">Keterangan / Barang</th>
                        <th className="py-3 px-4 text-center w-16">Hapus</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                      {previewMappedLogs.map((row, idx) => {
                        const rawAdmin = parsedDraftRows[idx]?.rawAdmin || row.adminName;
                        return (
                          <tr key={row.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                            <td className="py-3.5 px-4 text-sm tabular-nums text-slate-500">{idx + 1}</td>
                            <td className="py-3.5 px-4 text-sm whitespace-nowrap tabular-nums font-medium text-slate-700 dark:text-slate-300">
                              {formatDisplayDate(row.date)}
                            </td>
                            <td className="py-3.5 px-4">
                              <div className="text-sm font-bold text-slate-900 dark:text-white">
                                {row.adminName}
                              </div>
                              {rawAdmin.toUpperCase() !== row.adminName.toUpperCase() && (
                                <div className="text-xs text-blue-600 dark:text-blue-400">
                                  dari &ldquo;{rawAdmin}&rdquo;
                                </div>
                              )}
                            </td>
                            <td className="py-3.5 px-4 font-mono text-sm font-bold text-blue-700 dark:text-blue-400 whitespace-nowrap">
                              {row.noFakturOrSo}
                            </td>
                            <td className="py-3.5 px-4 text-sm font-medium text-slate-800 dark:text-slate-200">
                              {row.keterangan}
                            </td>
                            <td className="py-3.5 px-4 text-center">
                              <button
                                type="button"
                                onClick={() =>
                                  setParsedDraftRows(prev =>
                                    prev.filter((_, itemIdx) => itemIdx !== idx)
                                  )
                                }
                                className="p-1.5 rounded-lg text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/50 cursor-pointer transition"
                                title="Hapus baris dari preview"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                <div className="flex flex-wrap items-center justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      setParsedDraftRows([]);
                      setUploadFileName('');
                    }}
                    className="px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-semibold text-slate-700 dark:text-slate-200 cursor-pointer"
                  >
                    Reset Preview
                  </button>
                  <button
                    type="button"
                    onClick={handleConfirmImport}
                    className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold cursor-pointer"
                  >
                    Simpan {previewMappedLogs.length} Catatan ke Monitoring Diskon
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* MANUAL INPUT / EDIT FORM (Hanya Tanggal, Nama Admin, No. Faktur / SO, Keterangan / Barang) */}
        {isAddDiscountErrOpen && (
          <form
            onSubmit={handleManualSubmit}
            className="p-4 sm:p-5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-4"
          >
            <div className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider border-b border-slate-200 dark:border-slate-800 pb-2.5">
              {editingDiscountId
                ? 'Edit Catatan Kesalahan Penginputan Diskon'
                : 'Tambah Catatan Kesalahan Penginputan Diskon'}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3.5">
              <div className="lg:col-span-2">
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1.5">
                  Tanggal
                </label>
                <input
                  type="date"
                  value={dscDate || new Date().toISOString().slice(0, 10)}
                  onChange={e => setDscDate(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm font-medium text-slate-900 dark:text-white focus:outline-none focus:border-blue-600"
                />
              </div>
              <div className="lg:col-span-3">
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1.5">
                  Nama Admin
                </label>
                <DropdownComponent
                  variant="form-input"
                  value={dscAdmin}
                  onChange={val => setDscAdmin(val)}
                  icon={<UserCheck className="w-4 h-4" />}
                  searchable
                  searchPlaceholder="Cari nama admin..."
                  options={activeBranchAdminNames.map(a => ({
                    value: a,
                    label: a,
                    badge: sidoarjoAdminNames.includes(a) ? 'SDA' : 'BWI',
                    badgeTone: sidoarjoAdminNames.includes(a) ? 'emerald' : 'indigo'
                  }))}
                />
              </div>
              <div className="lg:col-span-3">
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1.5">
                  No. Faktur / SO
                </label>
                <input
                  type="text"
                  value={dscNoFaktur}
                  onChange={e => setDscNoFaktur(e.target.value)}
                  placeholder="Contoh: FJ02-1026-0315"
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm font-mono font-semibold text-slate-900 dark:text-white focus:outline-none focus:border-blue-600"
                />
              </div>
              <div className="lg:col-span-4">
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1.5">
                  Keterangan / Barang
                </label>
                <input
                  type="text"
                  value={dscKeterangan}
                  onChange={e => setDscKeterangan(e.target.value)}
                  placeholder="Contoh: DOS 1/5 KRAFT 310GR (3PAK/IKT)"
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm font-medium text-slate-900 dark:text-white focus:outline-none focus:border-blue-600"
                />
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => {
                  setIsAddDiscountErrOpen(false);
                  setEditingDiscountId(null);
                }}
                className="px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-semibold text-slate-700 dark:text-slate-200 cursor-pointer"
              >
                Batal
              </button>
              <button
                type="submit"
                className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold cursor-pointer"
              >
                {editingDiscountId ? 'Simpan Perubahan' : 'Simpan Catatan'}
              </button>
            </div>
          </form>
        )}

        {/* Search, Admin Filter & Period Toolbar */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div className="flex flex-col sm:flex-row sm:items-center gap-2.5 flex-1">
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Cari admin, no. faktur/SO, tanggal, atau keterangan barang..."
                className="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-blue-600"
              />
            </div>

            {selectedAdminFilter === 'SEMUA ADMIN' && (
              <div className="w-full sm:w-64">
                <DropdownComponent
                  variant="compact"
                  value={adminTableFilter}
                  onChange={val => setAdminTableFilter(val)}
                  icon={<UserCheck className="w-4 h-4" />}
                  searchable
                  searchPlaceholder="Filter nama admin..."
                  options={[
                    { value: 'SEMUA ADMIN', label: 'Semua Admin' },
                    ...activeBranchAdminNames.map(a => ({
                      value: a,
                      label: a,
                      badge: sidoarjoAdminNames.includes(a) ? 'SDA' : 'BWI',
                      badgeTone: sidoarjoAdminNames.includes(a) ? ('emerald' as const) : ('indigo' as const)
                    }))
                  ]}
                />
              </div>
            )}
          </div>

          <div className="inline-flex rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 p-1 self-start lg:self-auto shrink-0">
            <button
              type="button"
              onClick={() => setPeriodScope('selected')}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold cursor-pointer transition whitespace-nowrap ${
                periodScope === 'selected'
                  ? 'bg-blue-600 text-white'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              {selectedMonth} {selectedYear}
            </button>
            <button
              type="button"
              onClick={() => setPeriodScope('all')}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold cursor-pointer transition whitespace-nowrap ${
                periodScope === 'all'
                  ? 'bg-blue-600 text-white'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Semua Periode ({allPeriodCountForBranch})
            </button>
          </div>
        </div>

        {/* Clean 6-Column Discount Error Table */}
        <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
          <table className="w-full text-left divide-y divide-slate-200 dark:divide-slate-800 min-w-[780px]">
            <thead className="bg-slate-50 dark:bg-slate-950 text-slate-600 dark:text-slate-400 text-xs font-bold uppercase tracking-wider">
              <tr>
                <th className="py-3.5 px-4 w-14 text-center">No</th>
                <th className="py-3.5 px-4 w-36">Tanggal</th>
                <th className="py-3.5 px-4 w-60">Nama Admin</th>
                <th className="py-3.5 px-4 w-48">No. Faktur / SO</th>
                <th className="py-3.5 px-4">Keterangan / Barang</th>
                <th className="py-3.5 px-4 w-28 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800 bg-white dark:bg-slate-900">
              {periodFilteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 px-4 text-center text-sm text-slate-500">
                    Belum ada catatan kesalahan penginputan diskon untuk{' '}
                    {periodScope === 'selected' ? `${selectedMonth} ${selectedYear}` : 'filter ini'}.
                    {periodScope === 'selected' && allPeriodCountForBranch > 0 && (
                      <button
                        type="button"
                        onClick={() => setPeriodScope('all')}
                        className="ml-2 text-blue-600 font-semibold hover:underline cursor-pointer"
                      >
                        Lihat {allPeriodCountForBranch} catatan di semua periode
                      </button>
                    )}
                  </td>
                </tr>
              ) : (
                periodFilteredLogs.map((log, i) => (
                  <tr
                    key={log.id}
                    className="hover:bg-slate-50/90 dark:hover:bg-slate-800/40 transition-colors"
                  >
                    <td className="py-4 px-4 text-center text-sm font-semibold text-slate-500 tabular-nums">
                      {i + 1}
                    </td>
                    <td className="py-4 px-4 whitespace-nowrap text-sm font-semibold text-slate-700 dark:text-slate-300 tabular-nums">
                      {formatDisplayDate(log.date)}
                    </td>
                    <td className="py-4 px-4 text-[15px] font-bold text-slate-900 dark:text-white leading-snug">
                      {log.adminName}
                    </td>
                    <td className="py-4 px-4 font-mono text-[15px] font-bold text-blue-700 dark:text-blue-400 whitespace-nowrap tracking-tight">
                      {log.noFakturOrSo}
                    </td>
                    <td className="py-4 px-4 text-[15px] font-semibold text-slate-800 dark:text-slate-100 leading-relaxed">
                      {log.keterangan}
                    </td>
                    <td className="py-4 px-4 text-center">
                      {confirmDeleteId === log.id ? (
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => {
                              const nextLogs = discountErrorLogs.filter(x => x.id !== log.id);
                              onSaveDiscountErrorLogs(nextLogs);
                              setConfirmDeleteId(null);
                              showToast(`Catatan diskon ${log.adminName} dihapus.`);
                            }}
                            className="px-2.5 py-1.5 rounded-lg bg-rose-600 text-white text-xs font-semibold cursor-pointer"
                          >
                            Hapus
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteId(null)}
                            className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-600 dark:text-slate-300 cursor-pointer"
                          >
                            Batal
                          </button>
                        </div>
                      ) : (
                        <div className="inline-flex items-center justify-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => {
                              setEditingDiscountId(log.id);
                              setDscDate(log.date);
                              setDscAdmin(log.adminName);
                              setDscNoFaktur(log.noFakturOrSo === '-' ? '' : log.noFakturOrSo);
                              setDscKeterangan(log.keterangan === '-' ? '' : log.keterangan);
                              setIsUploadOpen(false);
                              setIsAddDiscountErrOpen(true);
                            }}
                            className="p-2 rounded-lg text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/60 cursor-pointer transition"
                            title="Edit catatan kesalahan diskon"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteId(log.id)}
                            className="p-2 rounded-lg text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/60 cursor-pointer transition"
                            title="Hapus catatan"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
