import React, { useMemo, useState } from 'react';
import * as XLSX from 'xlsx';
import {
  BadgePercent,
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
  rawCustomerCol: string;
  rawNoFakturCol: string;
  expectedDiscount: number;
  inputDiscount: number;
  selisihNominal: number;
  keterangan: string;
}

type PelangganColumnMappingMode = 'auto_faktur' | 'always_faktur' | 'always_customer';
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

const formatRp = (n: number) => new Intl.NumberFormat('id-ID').format(Math.round(n || 0));

const parseNumericInput = (val: unknown): number => {
  if (typeof val === 'number') return Number.isFinite(val) ? val : 0;
  let str = String(val ?? '').trim();
  if (!str) return 0;
  str = str.replace(/[Rp%\s]/gi, '');
  if (str.includes(',') && str.includes('.')) {
    const lastComma = str.lastIndexOf(',');
    const lastDot = str.lastIndexOf('.');
    if (lastComma > lastDot) {
      str = str.replace(/\./g, '').replace(',', '.');
    } else {
      str = str.replace(/,/g, '');
    }
  } else if (str.includes(',')) {
    const parts = str.split(',');
    if (parts[1] && parts[1].length <= 2) {
      str = str.replace(',', '.');
    } else {
      str = str.replace(/,/g, '');
    }
  }
  const num = Number(str);
  return Number.isFinite(num) ? num : 0;
};

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

  // ISO YYYY-MM-DD or YYYY/MM/DD
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

  // DD/MM/YYYY or DD-MM-YYYY
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

  // Indonesian/English text date: "03 Okt 2026", "3 Oktober 2026", "03-Okt-2026"
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

  // Avoid accidentally restoring deleted duplicate Muhammad Shoim
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

  // Word-starts-with or substring match in branch admins (e.g. "ISTI" -> "PIPIT ISTIANI")
  const tokenMatch = activeBranchAdminNames.find(n => {
    const upper = n.toUpperCase();
    const words = upper.split(/\s+/);
    return words.some(w => w === cleaned || w.startsWith(cleaned)) || upper.includes(cleaned);
  });
  if (tokenMatch) return tokenMatch;

  return cleaned;
};

const looksLikeInvoiceOrSo = (value: string): boolean => {
  const v = value.trim().toUpperCase();
  if (!v) return false;
  if (/^(FJ|SO|INV|FP|FK|DO|SJ)[A-Z0-9\-_/]*\d+/i.test(v)) return true;
  if (/^[A-Z]{1,5}\d{0,4}[A-Z]?-\d{3,5}-\d{2,6}$/.test(v)) return true;
  return false;
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
  // Manual Input & Edit State
  const [isAddDiscountErrOpen, setIsAddDiscountErrOpen] = useState(false);
  const [editingDiscountId, setEditingDiscountId] = useState<string | null>(null);
  const [dscDate, setDscDate] = useState('');
  const [dscAdmin, setDscAdmin] = useState('');
  const [dscNoFaktur, setDscNoFaktur] = useState('');
  const [dscCustomer, setDscCustomer] = useState('');
  const [dscExpected, setDscExpected] = useState('');
  const [dscInput, setDscInput] = useState('');
  const [dscSelisihRp, setDscSelisihRp] = useState('');
  const [dscKeterangan, setDscKeterangan] = useState('');

  // Upload / Import Excel & CSV State
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [uploadFileName, setUploadFileName] = useState('');
  const [parsedDraftRows, setParsedDraftRows] = useState<ParsedDiscountDraftRow[]>([]);
  const [pelangganMappingMode, setPelangganMappingMode] =
    useState<PelangganColumnMappingMode>('auto_faktur');
  const [importSaveMode, setImportSaveMode] = useState<ImportSaveMode>('append');
  const [uploadErrorMsg, setUploadErrorMsg] = useState('');

  // Search, Period Scope & Inline Delete Confirmation
  const [searchQuery, setSearchQuery] = useState('');
  const [periodScope, setPeriodScope] = useState<'selected' | 'all'>('selected');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const periodFilteredLogs = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return discountErrorLogs.filter(d => {
      if (selectedBranchId !== 'ALL' && d.branchId !== selectedBranchId) return false;
      if (
        selectedAdminFilter !== 'SEMUA ADMIN' &&
        d.adminName.toUpperCase() !== selectedAdminFilter.toUpperCase()
      ) {
        return false;
      }
      if (periodScope === 'selected') {
        if (d.month !== selectedMonth || d.year !== selectedYear) return false;
      }
      if (q) {
        const hay = `${d.adminName} ${d.noFakturOrSo} ${d.customerName} ${d.keterangan} ${d.date}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [
    discountErrorLogs,
    selectedBranchId,
    selectedAdminFilter,
    periodScope,
    selectedMonth,
    selectedYear,
    searchQuery
  ]);

  const allPeriodCountForBranch = useMemo(() => {
    return discountErrorLogs.filter(d => {
      if (selectedBranchId !== 'ALL' && d.branchId !== selectedBranchId) return false;
      if (
        selectedAdminFilter !== 'SEMUA ADMIN' &&
        d.adminName.toUpperCase() !== selectedAdminFilter.toUpperCase()
      ) {
        return false;
      }
      return true;
    }).length;
  }, [discountErrorLogs, selectedBranchId, selectedAdminFilter]);

  const summaryStats = useMemo(() => {
    const totalCount = periodFilteredLogs.length;
    const totalSelisihRp = periodFilteredLogs.reduce((s, r) => s + (r.selisihNominal || 0), 0);
    const uniqueAdmins = new Set(periodFilteredLogs.map(r => r.adminName.toUpperCase())).size;
    return { totalCount, totalSelisihRp, uniqueAdmins };
  }, [periodFilteredLogs]);

  // Download Excel Template matching the user's exact column schema
  const handleDownloadTemplate = (format: 'xlsx' | 'csv') => {
    const sampleRows = [
      {
        ADMIN: 'BINTANG',
        TANGGAL: '03 Okt 2026',
        'Nama Pelanggan': 'FJ02-1026-0315',
        'Keterangan Barang': 'DOS 1/5 KRAFT 310GR (3PAK/IKT)',
        'Diskon Seharusnya (%)': 0,
        'Diskon Terinput (%)': 2.5,
        'Selisih Nominal (Rp)': 0
      },
      {
        ADMIN: 'BINTANG',
        TANGGAL: '06 Okt 2026',
        'Nama Pelanggan': 'FJ02B-1026-0060',
        'Keterangan Barang': 'THINWALL CUP INJECT DM 400ML PP (25/500)',
        'Diskon Seharusnya (%)': 0,
        'Diskon Terinput (%)': 2,
        'Selisih Nominal (Rp)': 0
      },
      {
        ADMIN: 'FATA',
        TANGGAL: '06 Okt 2026',
        'Nama Pelanggan': 'FJ02-1026-0703',
        'Keterangan Barang': 'MIKA GLX PIRING HIP 9 (50/1.000) DB16-DA21-T2',
        'Diskon Seharusnya (%)': 0,
        'Diskon Terinput (%)': 3,
        'Selisih Nominal (Rp)': 0
      },
      {
        ADMIN: 'ISTI',
        TANGGAL: '07 Okt 2026',
        'Nama Pelanggan': 'FJ02-1026-0765',
        'Keterangan Barang': 'SENDIK KEPALA CUP THINWALL 12OZ',
        'Diskon Seharusnya (%)': 0,
        'Diskon Terinput (%)': 1.5,
        'Selisih Nominal (Rp)': 0
      }
    ];

    const worksheet = XLSX.utils.json_to_sheet(sampleRows);
    worksheet['!cols'] = [
      { wch: 16 },
      { wch: 14 },
      { wch: 22 },
      { wch: 46 },
      { wch: 22 },
      { wch: 20 },
      { wch: 22 }
    ];
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
          const rawCustVal = String(
            findColumnValue(row, ['Nama Pelanggan', 'PELANGGAN', 'CUSTOMER', 'NAMA TOKO']) || ''
          ).trim();
          const rawNoFakturVal = String(
            findColumnValue(row, ['No. Faktur / SO', 'NO FAKTUR', 'NO. FAKTUR', 'FAKTUR', 'NO SO']) || ''
          ).trim();
          const rawKetVal = String(
            findColumnValue(row, [
              'Keterangan Barang',
              'KETERANGAN KESALAHAN DISKON',
              'KETERANGAN',
              'NAMA BARANG',
              'ITEM',
              'BARANG',
              'CATATAN'
            ]) || ''
          ).trim();

          const expectedPct = parseNumericInput(
            findColumnValue(row, ['Diskon Seharusnya (%)', 'Diskon Seharusnya', 'EXPECTED', 'SEHARUSNYA'])
          );
          const inputPct = parseNumericInput(
            findColumnValue(row, ['Diskon Terinput (%)', 'Diskon Terinput', 'TERINPUT', 'INPUT'])
          );
          const selisihNominal = parseNumericInput(
            findColumnValue(row, ['Selisih Nominal (Rp)', 'Nominal Selisih Diskon', 'Selisih Diskon', 'Selisih'])
          );

          // Skip completely empty lines
          if (!rawAdminVal && !rawCustVal && !rawNoFakturVal && !rawKetVal) return;

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
            rawCustomerCol: rawCustVal,
            rawNoFakturCol: rawNoFakturVal,
            expectedDiscount: expectedPct,
            inputDiscount: inputPct,
            selisihNominal,
            keterangan: rawKetVal || 'Kesalahan penginputan diskon penjualan'
          });
        });

        if (drafts.length === 0) {
          setUploadErrorMsg(
            'Tidak ada baris valid yang terbaca. Pastikan header kolom mencakup ADMIN, TANGGAL, Nama Pelanggan, dan Keterangan Barang.'
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

  const mapDraftToLogItem = (
    draft: ParsedDiscountDraftRow,
    index: number
  ): DiscountErrorLogItem => {
    const colVal = draft.rawCustomerCol;
    const explicitFaktur = draft.rawNoFakturCol;
    let noFakturOrSo = explicitFaktur;
    let customerName = colVal;

    if (pelangganMappingMode === 'always_faktur') {
      noFakturOrSo = explicitFaktur || colVal || '-';
      customerName = explicitFaktur && colVal && explicitFaktur !== colVal ? colVal : '-';
    } else if (pelangganMappingMode === 'always_customer') {
      noFakturOrSo = explicitFaktur || '-';
      customerName = colVal || '-';
    } else {
      // Auto detect FJ / SO codes inside "Nama Pelanggan" column
      if (!explicitFaktur && looksLikeInvoiceOrSo(colVal)) {
        noFakturOrSo = colVal.toUpperCase();
        customerName = '-';
      } else {
        noFakturOrSo = explicitFaktur ? explicitFaktur.toUpperCase() : '-';
        customerName = colVal ? colVal.toUpperCase() : '-';
      }
    }

    return {
      id: `dsc-imp-${Date.now()}-${index}`,
      date: draft.isoDate,
      branchId: draft.branchId,
      month: draft.month,
      year: draft.year,
      adminName: draft.matchedAdmin,
      noFakturOrSo,
      customerName,
      expectedDiscount: draft.expectedDiscount,
      inputDiscount: draft.inputDiscount,
      selisihNominal: draft.selisihNominal,
      keterangan: draft.keterangan
    };
  };

  const previewMappedLogs = useMemo(
    () => parsedDraftRows.map((d, i) => mapDraftToLogItem(d, i)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [parsedDraftRows, pelangganMappingMode]
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

    // Check if imported rows mostly belong to a different month/year so user immediately sees them
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
    if (!targetAdmin || (!dscNoFaktur.trim() && !dscCustomer.trim())) {
      showToast('Mohon isi Nama Admin dan minimal No. Faktur / SO atau Nama Pelanggan.');
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
              noFakturOrSo: dscNoFaktur.trim().toUpperCase() || '-',
              customerName: dscCustomer.trim().toUpperCase() || '-',
              expectedDiscount: parseNumericInput(dscExpected),
              inputDiscount: parseNumericInput(dscInput),
              selisihNominal: parseNumericInput(dscSelisihRp),
              keterangan: dscKeterangan.trim() || 'Kesalahan penginputan diskon penjualan'
            }
          : item
      );
      onSaveDiscountErrorLogs(nextLogs);
      setEditingDiscountId(null);
      setDscNoFaktur('');
      setDscCustomer('');
      setDscExpected('');
      setDscInput('');
      setDscSelisihRp('');
      setDscKeterangan('');
      setIsAddDiscountErrOpen(false);
      showToast(`Data kesalahan diskon untuk ${targetAdmin} berhasil diperbarui.`);
      return;
    }

    const newLog: DiscountErrorLogItem = {
      id: `dsc-${Date.now()}`,
      date: parsedDate.isoDate,
      branchId: targetBr,
      month: parsedDate.month,
      year: parsedDate.year,
      adminName: targetAdmin,
      noFakturOrSo: dscNoFaktur.trim().toUpperCase() || '-',
      customerName: dscCustomer.trim().toUpperCase() || '-',
      expectedDiscount: parseNumericInput(dscExpected),
      inputDiscount: parseNumericInput(dscInput),
      selisihNominal: parseNumericInput(dscSelisihRp),
      keterangan: dscKeterangan.trim() || 'Kesalahan penginputan diskon penjualan'
    };

    const nextLogs = [newLog, ...discountErrorLogs];
    onSaveDiscountErrorLogs(nextLogs);
    setDscNoFaktur('');
    setDscCustomer('');
    setDscExpected('');
    setDscInput('');
    setDscSelisihRp('');
    setDscKeterangan('');
    setIsAddDiscountErrOpen(false);
    showToast(`Kesalahan input diskon untuk ${targetAdmin} berhasil disimpan.`);
  };

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 sm:p-6 space-y-5">
      {/* Header Row */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
        <div className="flex items-start sm:items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
            <BadgePercent className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white tracking-tight">
              Monitoring Kesalahan Penginputan Diskon
            </h3>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Audit kesalahan input diskon SO / Faktur Penjualan &amp; sinkronisasi otomatis ke KPI Individu Staff
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => handleDownloadTemplate('xlsx')}
            className="px-3.5 py-2 rounded-lg bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition"
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
            className="px-3.5 py-2 rounded-lg bg-white dark:bg-slate-800 hover:bg-blue-50 dark:hover:bg-slate-700 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition"
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
                  selectedAdminFilter !== 'SEMUA ADMIN'
                    ? selectedAdminFilter
                    : activeBranchAdminNames[0] || ''
                );
                setDscNoFaktur('');
                setDscCustomer('');
                setDscExpected('');
                setDscInput('');
                setDscSelisihRp('');
                setDscKeterangan('');
                setIsAddDiscountErrOpen(true);
              }
            }}
            className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition"
          >
            <Plus className="w-4 h-4" />
            <span>{isAddDiscountErrOpen ? 'Tutup Form' : 'Catat Kesalahan Diskon'}</span>
          </button>
        </div>
      </div>

      {/* Compact Summary Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="p-3.5 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
          <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
            Total Temuan ({periodScope === 'selected' ? `${selectedMonth} ${selectedYear}` : 'Semua Periode'})
          </div>
          <div className="text-xl font-bold text-slate-900 dark:text-white mt-1 tabular-nums">
            {summaryStats.totalCount} <span className="text-sm font-medium text-slate-500">Faktur</span>
          </div>
        </div>
        <div className="p-3.5 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
          <div className="text-xs font-medium text-slate-500 dark:text-slate-400">Admin Terdampak</div>
          <div className="text-xl font-bold text-slate-900 dark:text-white mt-1 tabular-nums">
            {summaryStats.uniqueAdmins} <span className="text-sm font-medium text-slate-500">Admin</span>
          </div>
        </div>
        <div className="p-3.5 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
          <div className="text-xs font-medium text-slate-500 dark:text-slate-400">Total Nominal Selisih</div>
          <div className="text-xl font-bold text-rose-600 dark:text-rose-400 mt-1 tabular-nums">
            Rp {formatRp(summaryStats.totalSelisihRp)}
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
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Mendukung kolom template: <strong>ADMIN</strong>, <strong>TANGGAL</strong>,{' '}
                  <strong>Nama Pelanggan</strong> (No. Faktur/SO), dan <strong>Keterangan Barang</strong>
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => handleDownloadTemplate('csv')}
                className="px-3 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 cursor-pointer"
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
            <div className="p-4 rounded-lg bg-white dark:bg-slate-900 border border-dashed border-slate-300 dark:border-slate-700 flex flex-col justify-between gap-3">
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
                    {uploadFileName} &bull; {parsedDraftRows.length} baris berhasil dibaca
                  </span>
                </div>
              )}
              {uploadErrorMsg && (
                <div className="text-xs font-semibold text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 px-3 py-2 rounded-lg">
                  {uploadErrorMsg}
                </div>
              )}
            </div>

            {/* Mapping & Import Mode Options */}
            <div className="p-4 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-3">
              <div>
                <div className="text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1.5">
                  Pemetaan Kolom &ldquo;Nama Pelanggan&rdquo;
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-1.5">
                  {(
                    [
                      { id: 'auto_faktur', label: 'Otomatis (FJ/SO → No. Faktur)' },
                      { id: 'always_faktur', label: 'Semua ke No. Faktur / SO' },
                      { id: 'always_customer', label: 'Semua ke Nama Pelanggan' }
                    ] as const
                  ).map(opt => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setPelangganMappingMode(opt.id)}
                      className={`px-2.5 py-2 rounded-lg text-[11px] font-semibold border text-left cursor-pointer transition ${
                        pelangganMappingMode === opt.id
                          ? 'bg-blue-50 dark:bg-blue-950/50 border-blue-600 text-blue-700 dark:text-blue-300'
                          : 'bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-slate-300'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

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
                    Timpa Periode Aktif ({selectedMonth})
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Preview Table */}
          {previewMappedLogs.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h5 className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">
                  Preview Baris Terbaca ({previewMappedLogs.length} Baris)
                </h5>
                <span className="text-xs text-slate-500">
                  Nama pendek admin (misal: BINTANG, FATA, ISTI) otomatis dicocokkan ke daftar admin cabang
                </span>
              </div>

              <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 max-h-72 overflow-y-auto">
                <table className="w-full text-left text-xs divide-y divide-slate-200 dark:divide-slate-800">
                  <thead className="sticky top-0 bg-slate-50 dark:bg-slate-800 text-[11px] font-semibold text-slate-600 dark:text-slate-300 uppercase">
                    <tr>
                      <th className="py-2.5 px-3">No</th>
                      <th className="py-2.5 px-3">Tanggal</th>
                      <th className="py-2.5 px-3">Periode KPI</th>
                      <th className="py-2.5 px-3">Admin</th>
                      <th className="py-2.5 px-3">No. Faktur / SO</th>
                      <th className="py-2.5 px-3">Nama Pelanggan</th>
                      <th className="py-2.5 px-3">Keterangan Barang / Kesalahan</th>
                      <th className="py-2.5 px-3 text-center">Hapus</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                    {previewMappedLogs.map((row, idx) => {
                      const rawAdmin = parsedDraftRows[idx]?.rawAdmin || row.adminName;
                      return (
                        <tr key={row.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                          <td className="py-2 px-3 tabular-nums text-slate-500">{idx + 1}</td>
                          <td className="py-2 px-3 whitespace-nowrap tabular-nums font-medium">
                            {formatDisplayDate(row.date)}
                          </td>
                          <td className="py-2 px-3 whitespace-nowrap text-slate-600 dark:text-slate-300">
                            {row.month} {row.year}
                          </td>
                          <td className="py-2 px-3">
                            <div className="font-semibold text-slate-900 dark:text-white">{row.adminName}</div>
                            {rawAdmin.toUpperCase() !== row.adminName.toUpperCase() && (
                              <div className="text-[11px] text-blue-600 dark:text-blue-400">
                                dari &ldquo;{rawAdmin}&rdquo;
                              </div>
                            )}
                          </td>
                          <td className="py-2 px-3 font-mono font-semibold text-blue-700 dark:text-blue-400">
                            {row.noFakturOrSo}
                          </td>
                          <td className="py-2 px-3 text-slate-700 dark:text-slate-200">{row.customerName}</td>
                          <td className="py-2 px-3 text-slate-700 dark:text-slate-300 max-w-xs">
                            {row.keterangan}
                          </td>
                          <td className="py-2 px-3 text-center">
                            <button
                              type="button"
                              onClick={() =>
                                setParsedDraftRows(prev =>
                                  prev.filter((_, itemIdx) => itemIdx !== idx)
                                )
                              }
                              className="p-1 rounded text-rose-600 hover:bg-rose-50 cursor-pointer"
                              title="Hapus baris dari preview"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
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

      {/* MANUAL INPUT / EDIT FORM */}
      {isAddDiscountErrOpen && (
        <form
          onSubmit={handleManualSubmit}
          className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-3"
        >
          <div className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider border-b border-slate-200 dark:border-slate-800 pb-2">
            {editingDiscountId
              ? 'Edit Catatan Kesalahan Penginputan Diskon'
              : 'Tambah Catatan Kesalahan Penginputan Diskon'}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                Tanggal
              </label>
              <input
                type="date"
                value={dscDate || new Date().toISOString().slice(0, 10)}
                onChange={e => setDscDate(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-medium"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                Nama Admin
              </label>
              <DropdownComponent
                variant="form-input"
                value={dscAdmin}
                onChange={val => setDscAdmin(val)}
                icon={<UserCheck className="w-3.5 h-3.5" />}
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
            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                No. Faktur / SO
              </label>
              <input
                type="text"
                value={dscNoFaktur}
                onChange={e => setDscNoFaktur(e.target.value)}
                placeholder="Contoh: FJ02-1026-0315"
                className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                Nama Pelanggan
              </label>
              <input
                type="text"
                value={dscCustomer}
                onChange={e => setDscCustomer(e.target.value)}
                placeholder="Contoh: TK SINAR BARU (opsional)"
                className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                Diskon Seharusnya (%)
              </label>
              <input
                type="number"
                step="0.1"
                value={dscExpected}
                onChange={e => setDscExpected(e.target.value)}
                placeholder="Contoh: 2.5"
                className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                Diskon Terinput (%)
              </label>
              <input
                type="number"
                step="0.1"
                value={dscInput}
                onChange={e => setDscInput(e.target.value)}
                placeholder="Contoh: 5"
                className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                Nominal Selisih Diskon (Rp)
              </label>
              <input
                type="number"
                value={dscSelisihRp}
                onChange={e => setDscSelisihRp(e.target.value)}
                placeholder="Contoh: 75000"
                className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                Keterangan Kesalahan Diskon
              </label>
              <input
                type="text"
                value={dscKeterangan}
                onChange={e => setDscKeterangan(e.target.value)}
                placeholder="Nama barang / rincian kesalahan input diskon..."
                className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs"
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
              className="px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-semibold cursor-pointer"
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

      {/* Search & Period Filter Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Cari admin, no. faktur/SO, pelanggan, atau keterangan barang..."
            className="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-xs sm:text-sm text-slate-900 dark:text-white focus:outline-none focus:border-blue-600"
          />
        </div>

        <div className="inline-flex rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 p-1 self-start sm:self-auto">
          <button
            type="button"
            onClick={() => setPeriodScope('selected')}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold cursor-pointer transition ${
              periodScope === 'selected'
                ? 'bg-blue-600 text-white'
                : 'text-slate-600 dark:text-slate-300 hover:text-slate-900'
            }`}
          >
            {selectedMonth} {selectedYear}
          </button>
          <button
            type="button"
            onClick={() => setPeriodScope('all')}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold cursor-pointer transition ${
              periodScope === 'all'
                ? 'bg-blue-600 text-white'
                : 'text-slate-600 dark:text-slate-300 hover:text-slate-900'
            }`}
          >
            Semua Periode ({allPeriodCountForBranch})
          </button>
        </div>
      </div>

      {/* Discount Error Table */}
      <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800">
        <table className="w-full text-left text-sm divide-y divide-slate-200 dark:divide-slate-800">
          <thead className="bg-slate-50 dark:bg-slate-950 text-slate-600 dark:text-slate-400 text-xs font-semibold uppercase">
            <tr>
              <th className="py-3 px-3 w-10">No</th>
              <th className="py-3 px-3">Tanggal</th>
              <th className="py-3 px-3">Nama Admin</th>
              <th className="py-3 px-3">No. Faktur / SO</th>
              <th className="py-3 px-3">Nama Pelanggan</th>
              <th className="py-3 px-3 text-center">Seharusnya</th>
              <th className="py-3 px-3 text-center">Terinput</th>
              <th className="py-3 px-3 text-right">Selisih Diskon</th>
              <th className="py-3 px-3">Keterangan / Barang</th>
              <th className="py-3 px-3 text-center">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 dark:divide-slate-800 text-xs sm:text-sm">
            {periodFilteredLogs.length === 0 ? (
              <tr>
                <td colSpan={10} className="py-10 text-center text-slate-500">
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
                <tr key={log.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40">
                  <td className="py-3 px-3 font-medium text-slate-500 tabular-nums">{i + 1}</td>
                  <td className="py-3 px-3 whitespace-nowrap tabular-nums text-slate-700 dark:text-slate-300">
                    {formatDisplayDate(log.date)}
                  </td>
                  <td className="py-3 px-3 font-semibold text-slate-900 dark:text-white">
                    {log.adminName}
                  </td>
                  <td className="py-3 px-3 font-mono font-semibold text-blue-700 dark:text-blue-400 whitespace-nowrap">
                    {log.noFakturOrSo}
                  </td>
                  <td className="py-3 px-3 font-medium text-slate-700 dark:text-slate-200">
                    {log.customerName}
                  </td>
                  <td className="py-3 px-3 text-center font-semibold text-emerald-700 dark:text-emerald-400 tabular-nums">
                    {log.expectedDiscount}%
                  </td>
                  <td className="py-3 px-3 text-center font-semibold text-rose-600 dark:text-rose-400 tabular-nums">
                    {log.inputDiscount}%
                  </td>
                  <td className="py-3 px-3 text-right font-semibold text-rose-600 dark:text-rose-400 whitespace-nowrap tabular-nums">
                    Rp {formatRp(log.selisihNominal)}
                  </td>
                  <td className="py-3 px-3 text-slate-700 dark:text-slate-300 max-w-xs">
                    {log.keterangan}
                  </td>
                  <td className="py-3 px-3 text-center">
                    {confirmDeleteId === log.id ? (
                      <div className="inline-flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => {
                            const nextLogs = discountErrorLogs.filter(x => x.id !== log.id);
                            onSaveDiscountErrorLogs(nextLogs);
                            setConfirmDeleteId(null);
                            showToast(`Catatan diskon ${log.adminName} dihapus.`);
                          }}
                          className="px-2 py-1 rounded bg-rose-600 text-white text-[11px] font-semibold cursor-pointer"
                        >
                          Hapus
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteId(null)}
                          className="px-2 py-1 rounded border border-slate-200 dark:border-slate-700 text-[11px] font-semibold text-slate-600 dark:text-slate-300 cursor-pointer"
                        >
                          Batal
                        </button>
                      </div>
                    ) : (
                      <div className="inline-flex items-center justify-center gap-1">
                        <button
                          type="button"
                          onClick={() => {
                            setEditingDiscountId(log.id);
                            setDscDate(log.date);
                            setDscAdmin(log.adminName);
                            setDscNoFaktur(log.noFakturOrSo === '-' ? '' : log.noFakturOrSo);
                            setDscCustomer(log.customerName === '-' ? '' : log.customerName);
                            setDscExpected(String(log.expectedDiscount));
                            setDscInput(String(log.inputDiscount));
                            setDscSelisihRp(String(log.selisihNominal));
                            setDscKeterangan(log.keterangan);
                            setIsUploadOpen(false);
                            setIsAddDiscountErrOpen(true);
                          }}
                          className="p-1.5 rounded-lg text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/60 cursor-pointer transition"
                          title="Edit catatan kesalahan diskon"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteId(log.id)}
                          className="p-1.5 rounded-lg text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/60 cursor-pointer transition"
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
  );
};
