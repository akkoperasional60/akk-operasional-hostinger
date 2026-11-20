import React, { useState, useEffect, useMemo, useRef } from 'react';
import * as XLSX from 'xlsx';
import {
  Plus,
  Search,
  CheckCircle2,
  MapPin,
  Trash2,
  Send,
  Check,
  CheckSquare,
  Square,
  ShieldCheck,
  Upload,
  Download,
  Save,
  ArrowUpDown,
  ArrowDownWideNarrow,
  ArrowUpNarrowWide,
  ArrowDownAZ,
  ArrowUpZA,
  Eye,
  Edit3,
  RotateCcw,
  FileSpreadsheet,
  CalendarDays,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  X,
  Banknote,
  Landmark,
  PenTool,
  RefreshCw,
  Truck
} from 'lucide-react';
import {
  formKirimStore,
  FormKirimRecord,
  FormKirimInvoiceItem,
  SAMPLE_NUSANTARA_ARGO_INVOICE_ITEMS
} from '../../services/formKirimStore';
import { branchStore, BranchRecord } from '../../services/branchStore';
import { logisticsStore } from '../../services/store';
import { OFFICIAL_DESTINATION_AREAS, standardizeAreaName } from '../../utils/areaNormalizer';

type SortField = 'default' | 'nilaiFaktur' | 'coly' | 'namaPelanggan' | 'noFaktur' | 'alamatPelanggan';
type SortDirection = 'asc' | 'desc';

const BULAN_PENDEK_ID = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
const BULAN_PANJANG_ID = [
  'Januari',
  'Februari',
  'Maret',
  'April',
  'Mei',
  'Juni',
  'Juli',
  'Agustus',
  'September',
  'Oktober',
  'November',
  'Desember'
];
const HARI_PENDEK_ID = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];

function getTodayWibIso(): string {
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Jakarta',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).format(new Date());
  } catch {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
}

function formatIsoToLongIndonesian(isoDate: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) return isoDate;
  const [y, m, d] = isoDate.split('-').map(Number);
  return `${d} ${BULAN_PANJANG_ID[(m || 1) - 1]} ${y}`;
}

function parseNumericValue(raw: any): number {
  if (typeof raw === 'number' && Number.isFinite(raw)) return raw;
  if (raw === null || raw === undefined) return 0;
  let s = String(raw).trim();
  if (!s) return 0;
  s = s.replace(/^[Rr][Pp]\.?\s*/g, '').replace(/\s+/g, '');
  if (/^\d{1,3}(\.\d{3})+(,\d+)?$/.test(s)) {
    s = s.replace(/\./g, '').replace(',', '.');
  } else if (/^\d+(,\d+)$/.test(s)) {
    s = s.replace(',', '.');
  } else {
    s = s.replace(/,/g, '');
  }
  const num = Number(s);
  return Number.isFinite(num) ? num : 0;
}

function formatNominalRibuan(val: number): string {
  const num = Number(val) || 0;
  if (num === 0) return '';
  return num.toLocaleString('id-ID', { maximumFractionDigits: 2 });
}

function isNonGudangFaktur(noFaktur: string): boolean {
  const clean = String(noFaktur || '').trim().toUpperCase();
  if (!clean) return false;
  // Faktur gudang resmi berawalan FJ02, FJ02B, atau FJ02BS; selain itu dianggap faktur SBU lain (bold)
  const isGudangPrefix = /^(?:FJ02BS|FJ02B|FJ02)(?:[-\s/\d]|$)/.test(clean);
  return !isGudangPrefix;
}

function formatExcelDateValue(raw: any): string {
  if (raw === null || raw === undefined || raw === '') {
    return formatExcelDateValue(getTodayWibIso());
  }
  if (typeof raw === 'number' && raw > 20000 && raw < 80000) {
    const utcDays = Math.floor(raw - 25569);
    const d = new Date(utcDays * 86400 * 1000);
    return `${String(d.getUTCDate()).padStart(2, '0')} ${BULAN_PENDEK_ID[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
  }
  const str = String(raw).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
    const [y, m, d] = str.split('-').map(Number);
    return `${String(d).padStart(2, '0')} ${BULAN_PENDEK_ID[(m || 1) - 1]} ${y}`;
  }
  return str;
}

function formatNetDaysDisplay(val: number): string {
  const num = Number(val) || 0;
  return num.toFixed(2).replace('.', ',');
}

interface ModernAreaDropdownProps {
  value: string;
  options: string[];
  onChange: (nextArea: string) => void;
  placeholder?: string;
  allOptionLabel?: string;
  countsByArea?: Record<string, number>;
}

const ModernAreaDropdown: React.FC<ModernAreaDropdownProps> = ({
  value,
  options,
  onChange,
  placeholder = 'Pilih Area',
  allOptionLabel = '-- Pilih Area --',
  countsByArea
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false);
    };
    document.addEventListener('mousedown', handleOutside);
    document.addEventListener('keydown', handleEsc);
    return () => {
      document.removeEventListener('mousedown', handleOutside);
      document.removeEventListener('keydown', handleEsc);
    };
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return options;
    return options.filter(opt => opt.toLowerCase().includes(q));
  }, [options, search]);

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => {
          setIsOpen(prev => !prev);
          setSearch('');
        }}
        className={`flex items-center justify-between gap-2.5 min-w-[220px] max-w-[290px] px-3.5 py-2 rounded-xl border text-xs font-bold transition shadow-xs cursor-pointer ${
          isOpen
            ? 'border-blue-500 ring-2 ring-blue-500/20 bg-white dark:bg-slate-900'
            : 'border-slate-200 dark:border-slate-700 bg-slate-50/80 dark:bg-slate-950 hover:border-blue-400 hover:bg-white dark:hover:bg-slate-900'
        }`}
        aria-label="Pilih Area Kirim"
      >
        <span className="flex items-center gap-2 truncate">
          <MapPin className={`w-3.5 h-3.5 shrink-0 ${value ? 'text-blue-600 dark:text-blue-400' : 'text-slate-400'}`} />
          <span className={`truncate ${value ? 'text-slate-900 dark:text-white' : 'text-slate-600 dark:text-slate-300 font-semibold'}`}>
            {value || placeholder}
          </span>
        </span>
        <ChevronDown
          className={`w-3.5 h-3.5 text-slate-400 shrink-0 transition-transform duration-150 ${
            isOpen ? 'rotate-180 text-blue-600' : ''
          }`}
        />
      </button>

      {isOpen && (
        <div className="absolute left-0 mt-2 w-72 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-2xl z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-100">
          <div className="p-2.5 border-b border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/60">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                autoFocus
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Cari area kirim..."
                className="w-full pl-8 pr-7 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-blue-500"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>

          <div className="max-h-60 overflow-y-auto py-1">
            {value && (
              <button
                type="button"
                onClick={() => {
                  onChange('');
                  setIsOpen(false);
                }}
                className="w-full px-3.5 py-2 text-left text-xs font-semibold text-blue-600 dark:text-blue-400 hover:bg-blue-50/60 dark:hover:bg-blue-950/40 flex items-center justify-between border-b border-slate-100 dark:border-slate-800 cursor-pointer"
              >
                <span>{allOptionLabel}</span>
                <span className="text-[10px] font-bold">Tampilkan Semua</span>
              </button>
            )}

            {filtered.length === 0 ? (
              <div className="px-4 py-6 text-center text-xs text-slate-400">Area tidak ditemukan.</div>
            ) : (
              filtered.map(area => {
                const isSelected = value.trim().toLowerCase() === area.trim().toLowerCase();
                const areaCount = countsByArea ? countsByArea[area.toUpperCase()] || 0 : 0;
                return (
                  <button
                    key={area}
                    type="button"
                    onClick={() => {
                      onChange(area);
                      setIsOpen(false);
                    }}
                    className={`w-full px-3.5 py-2 text-left text-xs flex items-center justify-between gap-2 transition cursor-pointer ${
                      isSelected
                        ? 'bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 font-bold'
                        : 'text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/60 font-medium'
                    }`}
                  >
                    <span className="truncate">{area}</span>
                    <span className="flex items-center gap-1.5 shrink-0">
                      {countsByArea && areaCount > 0 && (
                        <span className="px-1.5 py-0.5 rounded-md bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300 text-[10px] font-bold tabular-nums">
                          {areaCount}
                        </span>
                      )}
                      {isSelected && <Check className="w-3.5 h-3.5 text-blue-600 shrink-0" />}
                    </span>
                  </button>
                );
              })
            )}
          </div>

          <div className="px-3.5 py-2 border-t border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/60 text-[10px] font-semibold text-slate-400 flex items-center justify-between">
            <span>Daftar Area Kirim</span>
            <span>{filtered.length} area</span>
          </div>
        </div>
      )}
    </div>
  );
};

interface ModernCalendarPickerProps {
  value: string;
  onChange: (nextIso: string) => void;
  align?: 'left' | 'right';
  highlightedDates?: Set<string>;
}

const ModernCalendarPicker: React.FC<ModernCalendarPickerProps> = ({
  value,
  onChange,
  align = 'right',
  highlightedDates
}) => {
  const todayIso = getTodayWibIso();
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const parseIsoParts = (iso: string) => {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || todayIso);
    if (match) {
      return {
        year: Number(match[1]),
        month: Number(match[2]) - 1,
        day: Number(match[3])
      };
    }
    const [ty, tm, td] = todayIso.split('-').map(Number);
    return { year: ty, month: (tm || 1) - 1, day: td || 1 };
  };

  const selectedParts = parseIsoParts(value);
  const [viewYear, setViewYear] = useState(selectedParts.year);
  const [viewMonth, setViewMonth] = useState(selectedParts.month);

  useEffect(() => {
    if (isOpen) {
      const parts = parseIsoParts(value);
      setViewYear(parts.year);
      setViewMonth(parts.month);
    }
  }, [isOpen, value]);

  useEffect(() => {
    const handleOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false);
    };
    document.addEventListener('mousedown', handleOutside);
    document.addEventListener('keydown', handleEsc);
    return () => {
      document.removeEventListener('mousedown', handleOutside);
      document.removeEventListener('keydown', handleEsc);
    };
  }, []);

  const calendarCells = useMemo(() => {
    const firstDayOfMonth = new Date(Date.UTC(viewYear, viewMonth, 1)).getUTCDay();
    const daysInMonth = new Date(Date.UTC(viewYear, viewMonth + 1, 0)).getUTCDate();
    const daysInPrevMonth = new Date(Date.UTC(viewYear, viewMonth, 0)).getUTCDate();

    const cells: Array<{ iso: string; dayNum: number; isCurrentMonth: boolean }> = [];

    const toIso = (y: number, mZero: number, d: number) => {
      const dt = new Date(Date.UTC(y, mZero, d));
      return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, '0')}-${String(
        dt.getUTCDate()
      ).padStart(2, '0')}`;
    };

    for (let i = firstDayOfMonth - 1; i >= 0; i--) {
      const d = daysInPrevMonth - i;
      cells.push({ iso: toIso(viewYear, viewMonth - 1, d), dayNum: d, isCurrentMonth: false });
    }
    for (let d = 1; d <= daysInMonth; d++) {
      cells.push({ iso: toIso(viewYear, viewMonth, d), dayNum: d, isCurrentMonth: true });
    }
    const remaining = 42 - cells.length;
    for (let d = 1; d <= remaining; d++) {
      cells.push({ iso: toIso(viewYear, viewMonth + 1, d), dayNum: d, isCurrentMonth: false });
    }
    return cells;
  }, [viewYear, viewMonth]);

  const handlePrevMonth = () => {
    if (viewMonth === 0) {
      setViewYear(y => y - 1);
      setViewMonth(11);
    } else {
      setViewMonth(m => m - 1);
    }
  };

  const handleNextMonth = () => {
    if (viewMonth === 11) {
      setViewYear(y => y + 1);
      setViewMonth(0);
    } else {
      setViewMonth(m => m + 1);
    }
  };

  const isSelectedToday = value === todayIso;

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setIsOpen(prev => !prev)}
        className={`flex items-center justify-between gap-2.5 px-3.5 py-2 rounded-xl border text-xs font-bold transition shadow-xs cursor-pointer ${
          isOpen
            ? 'border-blue-500 ring-2 ring-blue-500/20 bg-white dark:bg-slate-900'
            : 'border-slate-200 dark:border-slate-700 bg-slate-50/80 dark:bg-slate-950 hover:border-blue-400 hover:bg-white dark:hover:bg-slate-900'
        }`}
        aria-label="Tanggal Pengiriman"
      >
        <span className="flex items-center gap-2">
          <CalendarDays className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 shrink-0" />
          <span className="text-slate-900 dark:text-white whitespace-nowrap">
            {formatIsoToLongIndonesian(value)}
          </span>
          {isSelectedToday && (
            <span className="px-1.5 py-0.5 rounded-md bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 text-[10px] font-bold">
              Hari Ini
            </span>
          )}
        </span>
        <ChevronDown
          className={`w-3.5 h-3.5 text-slate-400 shrink-0 transition-transform duration-150 ${
            isOpen ? 'rotate-180 text-blue-600' : ''
          }`}
        />
      </button>

      {isOpen && (
        <div
          className={`absolute ${
            align === 'left' ? 'left-0' : 'right-0'
          } mt-2 w-[304px] rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-2xl p-4 z-50 animate-in fade-in zoom-in-95 duration-100`}
        >
          {/* Header Bulan & Tahun */}
          <div className="flex items-center justify-between mb-3">
            <button
              type="button"
              onClick={handlePrevMonth}
              className="w-7 h-7 rounded-lg border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
              title="Bulan sebelumnya"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <div className="text-xs font-black text-slate-900 dark:text-white tracking-wide">
              {BULAN_PANJANG_ID[viewMonth]} {viewYear}
            </div>
            <button
              type="button"
              onClick={handleNextMonth}
              className="w-7 h-7 rounded-lg border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
              title="Bulan berikutnya"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Nama Hari */}
          <div className="grid grid-cols-7 gap-1 mb-1.5">
            {HARI_PENDEK_ID.map(day => (
              <div key={day} className="text-center text-[10px] font-bold text-slate-400 py-1">
                {day}
              </div>
            ))}
          </div>

          {/* Grid Tanggal */}
          <div className="grid grid-cols-7 gap-1">
            {calendarCells.map(cell => {
              const isSelected = cell.iso === value;
              const isToday = cell.iso === todayIso;
              const hasRecords = Boolean(highlightedDates && highlightedDates.has(cell.iso));
              return (
                <button
                  key={cell.iso}
                  type="button"
                  onClick={() => {
                    onChange(cell.iso);
                    setIsOpen(false);
                  }}
                  className={`h-8 rounded-lg text-xs flex flex-col items-center justify-center relative transition cursor-pointer ${
                    isSelected
                      ? 'bg-blue-600 text-white font-bold shadow-sm ring-2 ring-blue-600/20'
                      : isToday
                      ? 'bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 font-bold border border-blue-300 dark:border-blue-700'
                      : cell.isCurrentMonth
                      ? 'text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 font-medium'
                      : 'text-slate-300 dark:text-slate-600 hover:bg-slate-50 dark:hover:bg-slate-800/40'
                  }`}
                >
                  <span>{cell.dayNum}</span>
                  {(isToday || hasRecords) && !isSelected && (
                    <span
                      className={`w-1 h-1 rounded-full absolute bottom-1 ${
                        hasRecords ? 'bg-emerald-500' : 'bg-blue-600 dark:bg-blue-400'
                      }`}
                    />
                  )}
                </button>
              );
            })}
          </div>

          {/* Footer Quick Today */}
          <div className="mt-3 pt-2.5 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => {
                onChange(todayIso);
                setIsOpen(false);
              }}
              className="px-2.5 py-1 rounded-lg bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 text-[11px] font-bold hover:bg-blue-100 dark:hover:bg-blue-900/60 transition cursor-pointer"
            >
              Hari Ini ({formatExcelDateValue(todayIso)})
            </button>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="px-2.5 py-1 rounded-lg text-[11px] font-semibold text-slate-500 hover:text-slate-800 dark:hover:text-white cursor-pointer"
            >
              Tutup
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

interface AutoWrapCellTextareaProps {
  value: string;
  placeholder?: string;
  className?: string;
  onChange: (nextVal: string) => void;
}

const AutoWrapCellTextarea: React.FC<AutoWrapCellTextareaProps> = ({
  value,
  placeholder,
  className = '',
  onChange
}) => {
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const syncHeight = () => {
      el.style.height = 'auto';
      el.style.height = `${Math.max(el.scrollHeight, 20)}px`;
    };
    syncHeight();
    window.addEventListener('resize', syncHeight);
    return () => window.removeEventListener('resize', syncHeight);
  }, [value]);

  return (
    <textarea
      ref={ref}
      rows={1}
      value={value}
      placeholder={placeholder}
      onChange={e => onChange(e.target.value)}
      className={`w-full block bg-transparent resize-none overflow-hidden whitespace-normal break-words leading-snug py-0.5 px-1 focus:outline-none focus:bg-yellow-50 ${className}`}
    />
  );
};

interface RupiahCellInputProps {
  value: number;
  className?: string;
  onChange: (nextNum: number) => void;
}

const RupiahCellInput: React.FC<RupiahCellInputProps> = ({ value, className = '', onChange }) => {
  const [isFocused, setIsFocused] = useState(false);
  const [draft, setDraft] = useState('');

  const displayValue = isFocused ? draft : formatNominalRibuan(value);

  return (
    <input
      type="text"
      inputMode="decimal"
      value={displayValue}
      placeholder="0"
      onFocus={() => {
        setIsFocused(true);
        setDraft(value > 0 ? formatNominalRibuan(value) : '');
      }}
      onChange={e => {
        const raw = e.target.value;
        setDraft(raw);
        onChange(parseNumericValue(raw));
      }}
      onBlur={() => {
        const parsed = parseNumericValue(draft);
        onChange(parsed);
        setIsFocused(false);
      }}
      className={`w-28 text-right bg-transparent focus:outline-none focus:bg-yellow-50 px-1 tabular-nums ${className}`}
    />
  );
};

// ============================================================================
// 1. SUB-MENU ADMIN PENJUALAN: FORM KIRIM
// ============================================================================
export const SalesFormKirimTab: React.FC = () => {
  const [records, setRecords] = useState<FormKirimRecord[]>(() => formKirimStore.getAll());
  const [branches, setBranches] = useState<BranchRecord[]>(() => branchStore.getBranches());
  const hasLocalEditsRef = useRef<boolean>(false);

  // State Pengaturan Pengiriman (tersinkronisasi langsung dengan MySQL)
  const [selectedBranchName] = useState<string>(() => branches[0]?.name || 'Banyuwangi');
  const [selectedAreaKirim, setSelectedAreaKirim] = useState<string>(
    () => formKirimStore.getWorkspace()?.selectedAreaKirim || ''
  );
  const [tanggalKirim, setTanggalKirim] = useState<string>(
    () => formKirimStore.getWorkspace()?.tanggalKirim || getTodayWibIso()
  );
  const [selectedFleetId, setSelectedFleetId] = useState<string>('');
  const [selectedDriverName, setSelectedDriverName] = useState<string>('');
  const [selectedHelperName, setSelectedHelperName] = useState<string>('');

  // Sub-Halaman Upload File Excel
  const [isUploadExcelOpen, setIsUploadExcelOpen] = useState<boolean>(false);
  const [importMode, setImportMode] = useState<'replace_all' | 'append'>('replace_all');
  const [uploadDraftAreaKirim, setUploadDraftAreaKirim] = useState<string>('');
  const [uploadDraftTanggalKirim, setUploadDraftTanggalKirim] = useState<string>(() => getTodayWibIso());
  const [excelFileName, setExcelFileName] = useState<string>('');
  const [excelPreviewRows, setExcelPreviewRows] = useState<FormKirimInvoiceItem[]>([]);
  const [showUploadPreview, setShowUploadPreview] = useState<boolean>(false);

  // Items di dalam tabel Form Kirim aktif (dimuat dari MySQL workspace / records)
  const [invoiceItems, setInvoiceItems] = useState<FormKirimInvoiceItem[]>(() => {
    const ws = formKirimStore.getWorkspace();
    if (ws && Array.isArray(ws.invoiceItems) && ws.invoiceItems.length > 0) {
      return ws.invoiceItems;
    }
    const today = getTodayWibIso();
    const allRecs = formKirimStore.getAll();
    const todayRec = allRecs.find(r => r.tanggalKirim === today && Array.isArray(r.invoiceItems) && r.invoiceItems.length > 0);
    if (todayRec?.invoiceItems) {
      return todayRec.invoiceItems;
    }
    return SAMPLE_NUSANTARA_ARGO_INVOICE_ITEMS.map(item => ({ ...item, coly: 0 }));
  });

  // Mode tampilan: 'edit' (Net Days tampil & bisa input COLY/tambah baris) vs 'saved_preview' (tampilan simpan tanpa Net Days & tanpa Aksi)
  const [viewMode, setViewMode] = useState<'edit' | 'saved_preview'>('edit');
  const [activeSavedRecordId, setActiveSavedRecordId] = useState<string | null>(
    () => formKirimStore.getWorkspace()?.activeSavedRecordId || null
  );

  // Sorting & Filter state
  const [sortField, setSortField] = useState<SortField>('default');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [tableSearch, setTableSearch] = useState<string>('');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const currentUser = logisticsStore.getCurrentUser();
  const fleets = logisticsStore.getFleets();
  const crews = logisticsStore.getCrews();

  // Label tanggal pengiriman sesuai input Tanggal Pengiriman
  const formattedPeriodLabel = useMemo(() => {
    const formattedDate = formatExcelDateValue(tanggalKirim);
    return `Dari ${formattedDate} ke ${formattedDate}`;
  }, [tanggalKirim]);

  // Sinkronisasi daftar Area Kirim tanpa duplikasi (deduplikasi case-insensitive & terstandarisasi)
  const deliveryAreaOptions = useMemo(() => {
    const areaMap = new Map<string, string>();
    const registerArea = (rawVal: string | undefined | null) => {
      const trimmed = String(rawVal || '').trim();
      if (!trimmed || trimmed === '-') return;
      const canonical = standardizeAreaName(trimmed);
      if (!canonical || canonical === '-') return;
      const key = canonical.toUpperCase().replace(/\s+/g, ' ').trim();
      if (!areaMap.has(key)) {
        areaMap.set(key, canonical);
      }
    };

    OFFICIAL_DESTINATION_AREAS.forEach(a => registerArea(a));
    logisticsStore.getSchedules().forEach(s => registerArea(s.areaName || s.store?.city));
    records.forEach(r => registerArea(r.areaKirim));

    return Array.from(areaMap.values()).sort((a, b) => a.localeCompare(b, 'id-ID'));
  }, [records]);

  useEffect(() => {
    void formKirimStore.hydrateFromServer(true, true);
    const unsubForm = formKirimStore.subscribe(() => {
      const latest = formKirimStore.getAll();
      setRecords(latest);
      if (!hasLocalEditsRef.current) {
        const ws = formKirimStore.getWorkspace();
        if (ws && Array.isArray(ws.invoiceItems) && ws.invoiceItems.length > 0) {
          setInvoiceItems(ws.invoiceItems);
          if (ws.selectedAreaKirim !== undefined) setSelectedAreaKirim(ws.selectedAreaKirim);
          if (ws.tanggalKirim) setTanggalKirim(ws.tanggalKirim);
          setActiveSavedRecordId(ws.activeSavedRecordId || null);
        } else if (latest.length > 0) {
          const today = getTodayWibIso();
          const matched =
            latest.find(r => r.tanggalKirim === today && Array.isArray(r.invoiceItems) && r.invoiceItems.length > 0) ||
            latest.find(r => Array.isArray(r.invoiceItems) && r.invoiceItems.length > 0);
          if (matched && matched.invoiceItems) {
            setInvoiceItems(matched.invoiceItems);
            if (matched.areaKirim) setSelectedAreaKirim(matched.areaKirim);
            if (matched.tanggalKirim) setTanggalKirim(matched.tanggalKirim);
            setActiveSavedRecordId(matched.id);
          }
        }
      }
    });
    const unsubBranch = branchStore.subscribe(() => {
      setBranches(branchStore.getBranches());
    });
    return () => {
      unsubForm();
      unsubBranch();
    };
  }, []);

  // Otomatis sinkronkan Driver, Helper, dan Armada di belakang layar berdasarkan Area Kirim untuk integrasi Portal Driver
  useEffect(() => {
    const targetAreaUpper = standardizeAreaName(selectedAreaKirim || '').trim().toUpperCase();
    if (!targetAreaUpper || targetAreaUpper === '-') return;
    const liveSchedules = logisticsStore.getSchedules();
    const sameDateSchedules = liveSchedules.filter(s => s.deliveryDate === tanggalKirim);
    const pool = sameDateSchedules.length > 0 ? sameDateSchedules : liveSchedules;

    const matchScheduleArea = (s: (typeof liveSchedules)[number]) => {
      const sArea = standardizeAreaName(s.areaName || s.store?.storeName || '').trim().toUpperCase();
      return (
        sArea === targetAreaUpper ||
        (sArea.length > 0 && (sArea.includes(targetAreaUpper) || targetAreaUpper.includes(sArea)))
      );
    };

    const matchedSchedule =
      sameDateSchedules.find(matchScheduleArea) ||
      pool.find(matchScheduleArea);

    if (matchedSchedule) {
      if (matchedSchedule.fleetId) setSelectedFleetId(matchedSchedule.fleetId);
      const drv = String(matchedSchedule.crew?.name || '').trim();
      if (drv) setSelectedDriverName(drv);
      const candidates = [matchedSchedule.crewHelper?.name, matchedSchedule.crewHelper2?.name]
        .map(v => String(v || '').trim())
        .filter(Boolean);
      const distinctHelper = candidates.find(h => h.toLowerCase() !== drv.toLowerCase()) || '';
      setSelectedHelperName(distinctHelper);
    } else {
      if (!selectedFleetId && fleets[0]?.id) setSelectedFleetId(fleets[0].id);
      if (!selectedDriverName && crews[0]?.name) setSelectedDriverName(crews[0].name);
      if (!selectedHelperName) {
        const refDriver = (selectedDriverName || crews[0]?.name || '').trim().toLowerCase();
        const distinctCrew = crews.find(c => c.name && c.name.trim().toLowerCase() !== refDriver);
        if (distinctCrew?.name) setSelectedHelperName(distinctCrew.name);
      }
    }
  }, [selectedAreaKirim, tanggalKirim, fleets, crews]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4500);
  };

  // Fungsi Sortir untuk masing-masing grup (COD & TEMPO)
  const sortItemsList = (list: FormKirimInvoiceItem[]): FormKirimInvoiceItem[] => {
    const filtered = list.filter(it => {
      if (!tableSearch.trim()) return true;
      const q = tableSearch.toLowerCase();
      return (
        it.noFaktur.toLowerCase().includes(q) ||
        it.namaPelanggan.toLowerCase().includes(q) ||
        it.alamatPelanggan.toLowerCase().includes(q) ||
        it.keterangan.toLowerCase().includes(q)
      );
    });

    if (sortField === 'default') return filtered;

    return [...filtered].sort((a, b) => {
      let cmp = 0;
      if (sortField === 'nilaiFaktur') {
        cmp = a.nilaiFaktur - b.nilaiFaktur;
      } else if (sortField === 'coly') {
        cmp = (Number(a.coly) || 0) - (Number(b.coly) || 0);
      } else if (sortField === 'namaPelanggan') {
        cmp = a.namaPelanggan.localeCompare(b.namaPelanggan, 'id-ID', { sensitivity: 'base' });
      } else if (sortField === 'noFaktur') {
        cmp = a.noFaktur.localeCompare(b.noFaktur, 'id-ID', { numeric: true, sensitivity: 'base' });
      } else if (sortField === 'alamatPelanggan') {
        cmp = a.alamatPelanggan.localeCompare(b.alamatPelanggan, 'id-ID', { sensitivity: 'base' });
      }
      return sortDirection === 'asc' ? cmp : -cmp;
    });
  };

  // Pembagian otomatis pelanggan COD (Net Days = 0) dan TEMPO (Net Days > 0) dengan dukungan kategori manual & override
  const codItems = useMemo(() => {
    const rawCod = invoiceItems.filter(it => {
      const cat = it.paymentCategory || (Number(it.netDays) > 0 ? 'TEMPO' : 'COD');
      return cat === 'COD';
    });
    return sortItemsList(rawCod);
  }, [invoiceItems, sortField, sortDirection, tableSearch]);

  const tempoItems = useMemo(() => {
    const rawTempo = invoiceItems.filter(it => {
      const cat = it.paymentCategory || (Number(it.netDays) > 0 ? 'TEMPO' : 'COD');
      return cat === 'TEMPO';
    });
    return sortItemsList(rawTempo);
  }, [invoiceItems, sortField, sortDirection, tableSearch]);

  const countUniqueCustomers = (list: FormKirimInvoiceItem[]): number => {
    const uniqueSet = new Set<string>();
    list.forEach(it => {
      const normalized = String(it.namaPelanggan || '')
        .trim()
        .replace(/\s+/g, ' ')
        .toUpperCase();
      if (normalized) uniqueSet.add(normalized);
    });
    return uniqueSet.size;
  };

  // Perhitungan SUM / Jumlah COLY & Jumlah Pelanggan Unik (Remove Duplicate)
  const summaryTotals = useMemo(() => {
    const codColy = codItems.reduce((acc, it) => acc + (Number(it.coly) || 0), 0);
    const tempoColy = tempoItems.reduce((acc, it) => acc + (Number(it.coly) || 0), 0);
    const codNilai = codItems.reduce((acc, it) => acc + (Number(it.nilaiFaktur) || 0), 0);
    const tempoNilai = tempoItems.reduce((acc, it) => acc + (Number(it.nilaiFaktur) || 0), 0);
    const uniqueCodCustomers = countUniqueCustomers(codItems);
    const uniqueTempoCustomers = countUniqueCustomers(tempoItems);
    const uniqueTotalCustomers = countUniqueCustomers([...codItems, ...tempoItems]);
    return {
      codCount: codItems.length,
      tempoCount: tempoItems.length,
      totalInvoices: codItems.length + tempoItems.length,
      uniqueCodCustomers,
      uniqueTempoCustomers,
      uniqueTotalCustomers,
      codColy,
      tempoColy,
      totalColy: codColy + tempoColy,
      codNilai,
      tempoNilai,
      totalNilai: codNilai + tempoNilai
    };
  }, [codItems, tempoItems]);

  // Data preview untuk halaman upload (otomatis terklasifikasi COD vs TEMPO berdasarkan Net Days Syarat Pelanggan)
  const previewSourceRows = useMemo(() => {
    return excelPreviewRows.length > 0 ? excelPreviewRows : invoiceItems;
  }, [excelPreviewRows, invoiceItems]);

  const previewCodRows = useMemo(
    () => previewSourceRows.filter(it => Number(it.netDays) <= 0),
    [previewSourceRows]
  );

  const previewTempoRows = useMemo(
    () => previewSourceRows.filter(it => Number(it.netDays) > 0),
    [previewSourceRows]
  );

  const previewUniqueStats = useMemo(() => {
    const totalUniqueCustomers = countUniqueCustomers(previewSourceRows);
    return {
      totalUniqueCustomers,
      codUniqueCustomers: countUniqueCustomers(previewCodRows),
      tempoUniqueCustomers: countUniqueCustomers(previewTempoRows),
      duplicateInvoicesMerged: Math.max(0, previewSourceRows.length - totalUniqueCustomers)
    };
  }, [previewSourceRows, previewCodRows, previewTempoRows]);

  // Handler baca file Excel / CSV sesuai Format Gambar ke-2
  const handleExcelFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: 'array' });
      const firstSheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[firstSheetName];
      const rawRows = XLSX.utils.sheet_to_json<any[]>(worksheet, { header: 1, defval: '' });

      if (!Array.isArray(rawRows) || rawRows.length === 0) {
        showToast('File kosong atau format tidak terbaca.');
        return;
      }

      let headerRowIndex = -1;
      let colMap = {
        noFaktur: 0,
        tglFaktur: 1,
        namaPelanggan: 2,
        nilaiFaktur: 3,
        coly: 4,
        bayar: 5,
        alamat: 6,
        keterangan: 7,
        netDays: 8
      };

      for (let r = 0; r < Math.min(rawRows.length, 15); r++) {
        const row = rawRows[r] || [];
        const lowerCells = row.map((c: any) => String(c ?? '').trim().toLowerCase().replace(/\s+/g, ' '));
        const idxNoFaktur = lowerCells.findIndex(
          (c: string) => c === 'no. faktur' || c === 'no faktur' || c.includes('no. faktur') || c.includes('no faktur') || c === 'faktur'
        );
        const idxPelanggan = lowerCells.findIndex(
          (c: string) => c === 'nama pelanggan' || c.includes('nama pelanggan') || c === 'pelanggan' || c === 'toko'
        );

        if (idxNoFaktur !== -1 || idxPelanggan !== -1) {
          headerRowIndex = r;
          const usedIndices = new Set<number>();
          if (idxNoFaktur !== -1) usedIndices.add(idxNoFaktur);
          if (idxPelanggan !== -1) usedIndices.add(idxPelanggan);

          const findIdx = (patterns: string[], fallback: number): number => {
            for (const p of patterns) {
              const idx = lowerCells.findIndex((c: string, i: number) => !usedIndices.has(i) && c === p);
              if (idx !== -1) {
                usedIndices.add(idx);
                return idx;
              }
            }
            for (const p of patterns) {
              const idx = lowerCells.findIndex((c: string, i: number) => !usedIndices.has(i) && c.includes(p));
              if (idx !== -1) {
                usedIndices.add(idx);
                return idx;
              }
            }
            return fallback;
          };

          colMap = {
            noFaktur: idxNoFaktur !== -1 ? idxNoFaktur : 0,
            tglFaktur: findIdx(['tgl faktur', 'tanggal faktur', 'tgl', 'tanggal'], 1),
            namaPelanggan: idxPelanggan !== -1 ? idxPelanggan : 2,
            nilaiFaktur: findIdx(['nilai faktur', 'nominal', 'total faktur', 'nilai'], 3),
            coly: findIdx(['coly', 'koli', 'colli', 'qty'], 4),
            bayar: findIdx(['bayar', 'pembayaran'], 5),
            alamat: findIdx(['alamat 1', 'alamat 1 pelanggan', 'alamat pelanggan', 'alamat1', 'alamat', 'address'], 6),
            keterangan: findIdx(['keterangan', 'catatan', 'ket'], 7),
            netDays: findIdx(['net days syarat pelanggan', 'net days', 'syarat pelanggan', 'net day', 'top', 'tempo'], 8)
          };
          break;
        }
      }

      const startRow = headerRowIndex !== -1 ? headerRowIndex + 1 : 0;
      const parsedItems: FormKirimInvoiceItem[] = [];

      for (let r = startRow; r < rawRows.length; r++) {
        const row = rawRows[r] || [];
        const rowJoinedUpper = row
          .map((c: any) => String(c ?? '').trim().toUpperCase())
          .filter(Boolean)
          .join(' ');
        if (!rowJoinedUpper) continue;

        if (rowJoinedUpper === 'COD' || rowJoinedUpper === 'TEMPO') continue;

        const rawNoFaktur = String(row[colMap.noFaktur] ?? '').trim();
        const rawNamaPelanggan = String(row[colMap.namaPelanggan] ?? '').trim();

        if (!rawNoFaktur && !rawNamaPelanggan) continue;
        if (/^no\.?\s*faktur$/i.test(rawNoFaktur) || /^nama\s*pelanggan$/i.test(rawNamaPelanggan)) continue;
        if (
          /^(total|jumlah|grand\s*total)$/i.test(rawNoFaktur) ||
          /^(total|jumlah|grand\s*total)$/i.test(rawNamaPelanggan)
        ) {
          continue;
        }

        const tglFaktur = formatExcelDateValue(row[colMap.tglFaktur] || uploadDraftTanggalKirim);
        const nilaiFaktur = parseNumericValue(row[colMap.nilaiFaktur]);
        const bayar = String(row[colMap.bayar] ?? '').trim();
        const alamatPelanggan = String(row[colMap.alamat] ?? '').trim().toUpperCase();
        const keterangan = String(row[colMap.keterangan] ?? '').trim();

        const rawNetDaysStr = String(row[colMap.netDays] ?? '').trim();
        const netDaysVal = parseNumericValue(rawNetDaysStr);

        const paymentCategory: 'COD' | 'TEMPO' = netDaysVal > 0 ? 'TEMPO' : 'COD';
        const isOtherSbu = isNonGudangFaktur(rawNoFaktur);

        parsedItems.push({
          id: `fki-${Date.now()}-${r}`,
          noFaktur: rawNoFaktur.toUpperCase() || `FK-${r}`,
          tglFaktur,
          namaPelanggan: rawNamaPelanggan.toUpperCase() || 'PELANGGAN UMUM',
          nilaiFaktur,
          coly: 0,
          bayar,
          alamatPelanggan,
          keterangan,
          netDays: netDaysVal > 0 ? netDaysVal : 0,
          paymentCategory,
          isManualSbu: isOtherSbu
        });
      }

      if (parsedItems.length === 0) {
        showToast('Tidak ditemukan baris faktur valid di dalam file yang dipilih.');
        return;
      }

      const uniqueCount = countUniqueCustomers(parsedItems);
      setExcelFileName(file.name);
      setExcelPreviewRows(parsedItems);
      setShowUploadPreview(true);
      showToast(
        `Berhasil membaca ${parsedItems.length} faktur (${uniqueCount} pelanggan).`
      );
    } catch (err: any) {
      console.error('[Form Kirim Upload Error]', err);
      showToast(`Gagal membaca file: ${err?.message || 'Format tidak didukung'}`);
    }
  };

  // Helper untuk sinkronisasi setiap perubahan baris tabel langsung ke MySQL
  const updateInvoiceItemsAndSync = (
    updater: FormKirimInvoiceItem[] | ((prev: FormKirimInvoiceItem[]) => FormKirimInvoiceItem[]),
    immediate = false,
    areaOverride?: string,
    dateOverride?: string
  ) => {
    hasLocalEditsRef.current = true;
    setInvoiceItems(prev => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      const areaToPersist = areaOverride !== undefined ? areaOverride : selectedAreaKirim;
      const dateToPersist = dateOverride !== undefined ? dateOverride : tanggalKirim;
      formKirimStore.saveWorkspace(
        {
          selectedAreaKirim: areaToPersist,
          tanggalKirim: dateToPersist,
          activeSavedRecordId,
          viewMode,
          invoiceItems: next
        },
        immediate
      );
      return next;
    });
  };

  const handleSelectAreaKirim = (nextArea: string) => {
    hasLocalEditsRef.current = true;
    setSelectedAreaKirim(nextArea);
    const cleanArea = standardizeAreaName(nextArea || '').trim().toUpperCase();
    const matched = records.find(
      r =>
        standardizeAreaName(r.areaKirim || '').trim().toUpperCase() === cleanArea &&
        r.tanggalKirim === tanggalKirim &&
        Array.isArray(r.invoiceItems) &&
        r.invoiceItems.length > 0
    );
    const nextItems = matched?.invoiceItems ? matched.invoiceItems.map(it => ({ ...it })) : invoiceItems;
    const nextActiveId = matched ? matched.id : activeSavedRecordId;
    if (matched?.invoiceItems) {
      setInvoiceItems(nextItems);
      setActiveSavedRecordId(matched.id);
    }
    formKirimStore.saveWorkspace(
      {
        selectedAreaKirim: nextArea,
        tanggalKirim,
        activeSavedRecordId: nextActiveId,
        viewMode,
        invoiceItems: nextItems
      },
      true
    );
  };

  const handleSelectTanggalKirim = (nextDate: string) => {
    hasLocalEditsRef.current = true;
    setTanggalKirim(nextDate);
    const cleanArea = standardizeAreaName(selectedAreaKirim || '').trim().toUpperCase();
    const matched = records.find(
      r =>
        r.tanggalKirim === nextDate &&
        (!cleanArea || standardizeAreaName(r.areaKirim || '').trim().toUpperCase() === cleanArea) &&
        Array.isArray(r.invoiceItems) &&
        r.invoiceItems.length > 0
    );
    const nextItems = matched?.invoiceItems ? matched.invoiceItems.map(it => ({ ...it })) : invoiceItems;
    const nextActiveId = matched ? matched.id : activeSavedRecordId;
    if (matched?.invoiceItems) {
      setInvoiceItems(nextItems);
      if (matched.areaKirim && !selectedAreaKirim) setSelectedAreaKirim(matched.areaKirim);
      setActiveSavedRecordId(matched.id);
    }
    formKirimStore.saveWorkspace(
      {
        selectedAreaKirim: matched?.areaKirim && !selectedAreaKirim ? matched.areaKirim : selectedAreaKirim,
        tanggalKirim: nextDate,
        activeSavedRecordId: nextActiveId,
        viewMode,
        invoiceItems: nextItems
      },
      true
    );
  };

  // Simpan Form Kirim dari halaman Upload & Preview lalu langsung buka Aplikasi Portal Driver
  const handleSaveFromUploadPage = () => {
    const resolvedArea = (
      uploadDraftAreaKirim ||
      selectedAreaKirim ||
      deliveryAreaOptions[0] ||
      'ROGOJAMPI'
    )
      .trim()
      .toUpperCase();

    const targetItems =
      excelPreviewRows.length > 0
        ? importMode === 'replace_all'
          ? excelPreviewRows
          : [...invoiceItems, ...excelPreviewRows]
        : invoiceItems;

    const saved = persistFormKirimToStore(targetItems, resolvedArea, uploadDraftTanggalKirim);
    if (!saved) return;

    setSelectedAreaKirim(resolvedArea);
    setTanggalKirim(uploadDraftTanggalKirim);
    if (excelPreviewRows.length > 0) {
      updateInvoiceItemsAndSync(targetItems, true, resolvedArea, uploadDraftTanggalKirim);
    }

    setIsUploadExcelOpen(false);
    setExcelFileName('');
    setExcelPreviewRows([]);
    setShowUploadPreview(false);
  };

  // Tambah baris manual tepat di bawah baris yang diklik tombol "+" pada kolom NO
  const handleInsertManualRowAfter = (targetId: string, category: 'COD' | 'TEMPO') => {
    const newRow: FormKirimInvoiceItem = {
      id: `fki-manual-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      noFaktur: '',
      tglFaktur: formatExcelDateValue(tanggalKirim),
      namaPelanggan: '',
      nilaiFaktur: 0,
      coly: 0,
      bayar: '',
      alamatPelanggan: '',
      keterangan: '',
      netDays: category === 'TEMPO' ? 7 : 0,
      paymentCategory: category,
      isManualSbu: false
    };

    updateInvoiceItemsAndSync(prev => {
      const idx = prev.findIndex(item => item.id === targetId);
      if (idx === -1) return [...prev, newRow];
      const next = [...prev];
      next.splice(idx + 1, 0, newRow);
      return next;
    }, true);
  };

  const handleInsertManualRowInSection = (category: 'COD' | 'TEMPO') => {
    const newRow: FormKirimInvoiceItem = {
      id: `fki-manual-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      noFaktur: '',
      tglFaktur: formatExcelDateValue(tanggalKirim),
      namaPelanggan: '',
      nilaiFaktur: 0,
      coly: 0,
      bayar: '',
      alamatPelanggan: '',
      keterangan: '',
      netDays: category === 'TEMPO' ? 7 : 0,
      paymentCategory: category,
      isManualSbu: false
    };
    updateInvoiceItemsAndSync(prev => [...prev, newRow], true);
  };

  const handleUpdateInvoiceCell = (id: string, field: keyof FormKirimInvoiceItem, value: any) => {
    updateInvoiceItemsAndSync(prev =>
      prev.map(item => {
        if (item.id !== id) return item;
        if (field === 'netDays') {
          const numNet = Math.max(0, Number(value) || 0);
          return {
            ...item,
            netDays: numNet,
            paymentCategory: numNet > 0 ? 'TEMPO' : 'COD'
          };
        }
        if (field === 'noFaktur') {
          return {
            ...item,
            noFaktur: value,
            isManualSbu: isNonGudangFaktur(String(value ?? ''))
          };
        }
        return { ...item, [field]: value };
      })
    );
  };

  const handleDeleteInvoiceRow = (id: string) => {
    const deletedRow = invoiceItems.find(item => item.id === id);
    updateInvoiceItemsAndSync(prev => prev.filter(item => item.id !== id), true);
    if (deletedRow) {
      logisticsStore.logActivity(
        'Hapus Baris Faktur Form Kirim',
        deletedRow.noFaktur || deletedRow.namaPelanggan || 'Form Kirim Barang',
        `Menghapus baris faktur ${deletedRow.noFaktur || '-'} (${deletedRow.namaPelanggan || '-'}) pada Form Kirim Barang`,
        'kurangi'
      );
    }
  };

  // Pindah baris ke atas: mendukung perpindahan lintas grup (dari TEMPO naik ke COD)
  const handleMoveItemUp = (id: string) => {
    if (sortField !== 'default') {
      setSortField('default');
    }
    updateInvoiceItemsAndSync(prev => {
      const currentCod = prev.filter(it => {
        const cat = it.paymentCategory || (Number(it.netDays) > 0 ? 'TEMPO' : 'COD');
        return cat === 'COD';
      });
      const currentTempo = prev.filter(it => {
        const cat = it.paymentCategory || (Number(it.netDays) > 0 ? 'TEMPO' : 'COD');
        return cat === 'TEMPO';
      });

      const codIdx = currentCod.findIndex(item => item.id === id);
      if (codIdx !== -1) {
        if (codIdx === 0) return prev;
        const nextCod = [...currentCod];
        const temp = nextCod[codIdx];
        nextCod[codIdx] = nextCod[codIdx - 1];
        nextCod[codIdx - 1] = temp;
        return [...nextCod, ...currentTempo];
      }

      const tempoIdx = currentTempo.findIndex(item => item.id === id);
      if (tempoIdx !== -1) {
        if (tempoIdx === 0) {
          // Baris teratas TEMPO naik menjadi baris terakhir di kelompok COD
          const targetItem = currentTempo[0];
          const promotedToCod: FormKirimInvoiceItem = {
            ...targetItem,
            paymentCategory: 'COD',
            netDays: 0
          };
          const remainingTempo = currentTempo.slice(1);
          showToast(
            `${targetItem.namaPelanggan || 'Pelanggan'} dinaikkan dari TEMPO ke kategori COD.`
          );
          return [...currentCod, promotedToCod, ...remainingTempo];
        }
        const nextTempo = [...currentTempo];
        const temp = nextTempo[tempoIdx];
        nextTempo[tempoIdx] = nextTempo[tempoIdx - 1];
        nextTempo[tempoIdx - 1] = temp;
        return [...currentCod, ...nextTempo];
      }

      return prev;
    }, true);
  };

  // Pindah baris ke bawah: mendukung perpindahan lintas grup (dari COD turun ke TEMPO)
  const handleMoveItemDown = (id: string) => {
    if (sortField !== 'default') {
      setSortField('default');
    }
    updateInvoiceItemsAndSync(prev => {
      const currentCod = prev.filter(it => {
        const cat = it.paymentCategory || (Number(it.netDays) > 0 ? 'TEMPO' : 'COD');
        return cat === 'COD';
      });
      const currentTempo = prev.filter(it => {
        const cat = it.paymentCategory || (Number(it.netDays) > 0 ? 'TEMPO' : 'COD');
        return cat === 'TEMPO';
      });

      const codIdx = currentCod.findIndex(item => item.id === id);
      if (codIdx !== -1) {
        if (codIdx === currentCod.length - 1) {
          // Baris terbawah COD turun menjadi baris pertama di kelompok TEMPO
          const targetItem = currentCod[codIdx];
          const movedToTempo: FormKirimInvoiceItem = {
            ...targetItem,
            paymentCategory: 'TEMPO',
            netDays: targetItem.netDays > 0 ? targetItem.netDays : 7
          };
          const remainingCod = currentCod.slice(0, codIdx);
          showToast(
            `${targetItem.namaPelanggan || 'Pelanggan'} dipindahkan dari COD ke kategori TEMPO.`
          );
          return [...remainingCod, movedToTempo, ...currentTempo];
        }
        const nextCod = [...currentCod];
        const temp = nextCod[codIdx];
        nextCod[codIdx] = nextCod[codIdx + 1];
        nextCod[codIdx + 1] = temp;
        return [...nextCod, ...currentTempo];
      }

      const tempoIdx = currentTempo.findIndex(item => item.id === id);
      if (tempoIdx !== -1) {
        if (tempoIdx >= currentTempo.length - 1) return prev;
        const nextTempo = [...currentTempo];
        const temp = nextTempo[tempoIdx];
        nextTempo[tempoIdx] = nextTempo[tempoIdx + 1];
        nextTempo[tempoIdx + 1] = temp;
        return [...currentCod, ...nextTempo];
      }

      return prev;
    }, true);
  };

  const handleToggleCategory = (id: string) => {
    if (sortField !== 'default') {
      setSortField('default');
    }
    updateInvoiceItemsAndSync(prev => {
      const target = prev.find(item => item.id === id);
      if (!target) return prev;
      const currentCat = target.paymentCategory || (Number(target.netDays) > 0 ? 'TEMPO' : 'COD');
      const nextCat: 'COD' | 'TEMPO' = currentCat === 'COD' ? 'TEMPO' : 'COD';
      const updatedItem: FormKirimInvoiceItem = {
        ...target,
        paymentCategory: nextCat,
        netDays: nextCat === 'TEMPO' && target.netDays <= 0 ? 7 : nextCat === 'COD' ? 0 : target.netDays
      };

      const others = prev.filter(item => item.id !== id);
      const otherCod = others.filter(it => (it.paymentCategory || (Number(it.netDays) > 0 ? 'TEMPO' : 'COD')) === 'COD');
      const otherTempo = others.filter(it => (it.paymentCategory || (Number(it.netDays) > 0 ? 'TEMPO' : 'COD')) === 'TEMPO');

      if (nextCat === 'COD') {
        showToast(`${target.namaPelanggan || 'Pelanggan'} dipindahkan ke kelompok COD.`);
        return [...otherCod, updatedItem, ...otherTempo];
      } else {
        showToast(`${target.namaPelanggan || 'Pelanggan'} dipindahkan ke kelompok TEMPO.`);
        return [...otherCod, updatedItem, ...otherTempo];
      }
    }, true);
  };

  const persistFormKirimToStore = (
    itemsToSave: FormKirimInvoiceItem[],
    areaName: string,
    deliveryDate: string
  ): boolean => {
    const cleanArea = (areaName || selectedAreaKirim || deliveryAreaOptions[0] || 'ROGOJAMPI')
      .trim()
      .toUpperCase();

    if (itemsToSave.length === 0) {
      showToast('Tabel Form Kirim masih kosong. Silakan upload file atau tambah faktur manual terlebih dahulu.');
      return false;
    }

    const codRows = itemsToSave.filter(i => {
      const cat = i.paymentCategory || (Number(i.netDays) > 0 ? 'TEMPO' : 'COD');
      return cat === 'COD';
    });
    const tempoRows = itemsToSave.filter(i => {
      const cat = i.paymentCategory || (Number(i.netDays) > 0 ? 'TEMPO' : 'COD');
      return cat === 'TEMPO';
    });
    const totalColy = itemsToSave.reduce((acc, i) => acc + (Number(i.coly) || 0), 0);
    const codNilai = codRows.reduce((acc, i) => acc + (Number(i.nilaiFaktur) || 0), 0);
    const tempoNilai = tempoRows.reduce((acc, i) => acc + (Number(i.nilaiFaktur) || 0), 0);
    const totalNilai = codNilai + tempoNilai;
    const uniqueCustomers = countUniqueCustomers(itemsToSave);

    const liveSchedules = logisticsStore.getSchedules();
    const matchedScheduleForPayload = liveSchedules.find(s => {
      const sameDate = !s.deliveryDate || s.deliveryDate === deliveryDate;
      const sArea = standardizeAreaName(s.areaName || s.store?.storeName || '').trim().toUpperCase();
      return (
        sameDate &&
        (sArea === cleanArea || (sArea.length > 0 && (sArea.includes(cleanArea) || cleanArea.includes(sArea))))
      );
    });
    const selectedFleet =
      fleets.find(f => f.id === (selectedFleetId || matchedScheduleForPayload?.fleetId)) || fleets[0];
    const resolvedArmadaInitial = String(
      matchedScheduleForPayload?.armada ||
      matchedScheduleForPayload?.fleet?.initialCode ||
      selectedFleet?.initialCode ||
      ''
    ).trim();
    const resolvedDriver = String(
      selectedDriverName || matchedScheduleForPayload?.crew?.name || crews[0]?.name || 'Ach Taufiq'
    ).trim();
    const rawHelper = String(
      selectedHelperName ||
      matchedScheduleForPayload?.crewHelper?.name ||
      matchedScheduleForPayload?.crewHelper2?.name ||
      ''
    ).trim();
    const resolvedHelper =
      rawHelper && rawHelper.toLowerCase() !== resolvedDriver.toLowerCase() ? rawHelper : '';

    const firstFaktur = itemsToSave[0]?.noFaktur || 'FJ02-0226';
    const lastFaktur = itemsToSave[itemsToSave.length - 1]?.noFaktur || '';
    const fakturRangeLabel =
      itemsToSave.length === 1
        ? firstFaktur
        : `${firstFaktur} s/d ${lastFaktur} (${itemsToSave.length} Faktur)`;

    const uniqueAddresses = Array.from(
      new Set(itemsToSave.map(i => i.alamatPelanggan).filter(Boolean))
    ).slice(0, 4);

    const formattedDate = formatExcelDateValue(deliveryDate);
    const periodText = `Dari ${formattedDate} ke ${formattedDate}`;

    const payload = {
      noFaktur: fakturRangeLabel,
      noSuratJalan: `SJ-AKK-${deliveryDate.replace(/-/g, '').slice(2)}-${cleanArea.slice(0, 3)}`,
      branchName: selectedBranchName,
      sbuTitle: 'ANUGRAH KEMASAN KREATIF',
      periodLabel: periodText,
      areaKirim: cleanArea,
      tanggalKirim: deliveryDate,
      storeName: `AREA ${cleanArea} (${uniqueCustomers} Pelanggan • ${codRows.length} COD • ${tempoRows.length} TEMPO)`,
      storeAddress:
        uniqueAddresses.length > 0
          ? `Rute ${cleanArea}: ${uniqueAddresses.join(', ')}`
          : `Area Pengiriman ${cleanArea}`,
      storePhone: '-',
      fleetId: selectedFleet?.id || 'fl-01',
      armadaInitial: resolvedArmadaInitial,
      plateNumber: selectedFleet?.plateNumber || 'P 8848 U',
      vehicleType: selectedFleet?.vehicleType || 'CDD Long Box',
      driverName: resolvedDriver,
      helperName: resolvedHelper,
      itemsSummary: `${uniqueCustomers} Pelanggan (${itemsToSave.length} Faktur: ${codRows.length} COD • ${tempoRows.length} TEMPO)`,
      totalColli: totalColy,
      totalNominalFaktur: totalNilai,
      sisaPiutangToko: tempoNilai,
      metodePembayaran:
        codRows.length > 0 && tempoRows.length > 0
          ? ('COD & Tempo (Gabungan)' as const)
          : codRows.length > 0
          ? ('COD (Bayar di Tempat)' as const)
          : ('Kredit / Tempo' as const),
      createdByAdmin: currentUser?.fullName || 'Admin Penjualan',
      salesNotes: `Form Pengiriman/Sales Area ${cleanArea} (${uniqueCustomers} Pelanggan, ${codRows.length} COD, ${tempoRows.length} TEMPO, Total ${totalColy} COLY)`,
      invoiceItems: itemsToSave.map(it => ({ ...it })),
      codCount: codRows.length,
      tempoCount: tempoRows.length,
      codTotalNominal: codNilai,
      tempoTotalNominal: tempoNilai,
      financeStatus: 'approved_finance' as const,
      driverStatus: 'ready_for_driver' as const
    };

    const existingForAreaDate = formKirimStore
      .getAll()
      .find(
        r =>
          standardizeAreaName(r.areaKirim || '').trim().toUpperCase() === cleanArea &&
          r.tanggalKirim === deliveryDate
      );
    const targetRecordId = activeSavedRecordId || existingForAreaDate?.id || null;

    let savedRecordId = targetRecordId;
    if (targetRecordId) {
      formKirimStore.updateFormKirim(targetRecordId, payload);
      setActiveSavedRecordId(targetRecordId);
      setViewMode('saved_preview');
      logisticsStore.logActivity(
        'Ubah Data Form Kirim Barang',
        `Area ${cleanArea} (${deliveryDate})`,
        `Merubah data Form Kirim Area ${cleanArea} (${uniqueCustomers} Pelanggan • ${itemsToSave.length} Faktur • Total ${totalColy} COLY)`,
        'ubah'
      );
      showToast(`Form Kirim Area ${cleanArea} berhasil disimpan ke MySQL (${uniqueCustomers} Pelanggan • ${itemsToSave.length} Faktur). Membuka Portal Driver...`);
    } else {
      const created = formKirimStore.addFormKirim(payload);
      savedRecordId = created.id;
      setActiveSavedRecordId(created.id);
      setViewMode('saved_preview');
      logisticsStore.logActivity(
        'Tambah Data Form Kirim Barang',
        `Area ${cleanArea} (${deliveryDate})`,
        `Menambahkan Form Kirim Area ${cleanArea} (${uniqueCustomers} Pelanggan • ${itemsToSave.length} Faktur • Total ${totalColy} COLY)`,
        'tambah'
      );
      showToast(`Form Kirim Area ${cleanArea} berhasil disimpan ke MySQL (${uniqueCustomers} Pelanggan). Membuka Portal Driver...`);
    }

    hasLocalEditsRef.current = true;
    formKirimStore.saveWorkspace(
      {
        selectedAreaKirim: cleanArea,
        tanggalKirim: deliveryDate,
        activeSavedRecordId: savedRecordId,
        viewMode: 'saved_preview',
        invoiceItems: itemsToSave.map(it => ({ ...it }))
      },
      true
    );

    try {
      window.dispatchEvent(
        new CustomEvent('akk-navigate-tab', {
          detail: {
            tab: 'driver_portal',
            subTab: 'form_kirim',
            formKirimId: savedRecordId
          }
        })
      );
    } catch {
      // ignore navigation dispatch errors
    }

    return true;
  };

  // Simpan Form Kirim dari halaman tabel utama -> langsung masuk ke Aplikasi Portal Driver
  const handleSaveFormKirim = () => {
    const resolvedArea = selectedAreaKirim || uploadDraftAreaKirim || deliveryAreaOptions[0] || 'ROGOJAMPI';
    if (!selectedAreaKirim) {
      setSelectedAreaKirim(resolvedArea);
    }
    persistFormKirimToStore(invoiceItems, resolvedArea, tanggalKirim);
  };

  // Toggle header column sort
  const handleColumnSortToggle = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(prev => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDirection(field === 'nilaiFaktur' || field === 'coly' ? 'desc' : 'asc');
    }
  };

  // ============================================================================
  // SUB-VIEW: HALAMAN UPLOAD FILE EXCEL & PREVIEW SEBELUM SIMPAN
  // ============================================================================
  if (isUploadExcelOpen) {
    return (
      <div className="space-y-5 animate-fade-in">
        {toastMessage && (
          <div className="fixed bottom-5 right-5 z-50 max-w-md bg-slate-900 dark:bg-emerald-600 text-white px-4 py-3 rounded-2xl shadow-2xl border border-slate-700/50 flex items-center gap-2.5 text-xs font-bold">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 dark:text-white shrink-0" />
            <span>{toastMessage}</span>
          </div>
        )}

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 sm:p-7 shadow-sm space-y-6">
          {/* Header & Area / Tanggal Controls */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-5 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-3.5">
              <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 text-white flex items-center justify-center shadow-sm shrink-0">
                <FileSpreadsheet className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-lg sm:text-xl font-black text-slate-900 dark:text-white tracking-tight">
                  Upload File Excel Form Kirim
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Pilih area kirim &amp; tanggal pengiriman, lalu unggah file Excel faktur
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              <ModernAreaDropdown
                value={uploadDraftAreaKirim}
                options={deliveryAreaOptions}
                onChange={setUploadDraftAreaKirim}
                placeholder="Pilih Area"
              />
              <ModernCalendarPicker
                value={uploadDraftTanggalKirim}
                onChange={setUploadDraftTanggalKirim}
              />
            </div>
          </div>

          {/* Mode Upload Data */}
          <div className="space-y-2.5">
            <label className="block text-[11px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
              MODE UPLOAD DATA
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setImportMode('replace_all')}
                className={`p-4 rounded-2xl border text-left transition-all cursor-pointer ${
                  importMode === 'replace_all'
                    ? 'border-blue-500 bg-blue-50/70 dark:bg-blue-950/30 text-slate-900 dark:text-white ring-2 ring-blue-500/20 shadow-xs'
                    : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:border-slate-300'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs sm:text-sm font-bold flex items-center gap-2.5">
                    <span
                      className={`w-3 h-3 rounded-full border-2 flex items-center justify-center ${
                        importMode === 'replace_all'
                          ? 'border-blue-600 bg-blue-600'
                          : 'border-slate-300 dark:border-slate-600'
                      }`}
                    />
                    Timpa Data Lama (Replace All)
                  </span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300">
                    Default
                  </span>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setImportMode('append')}
                className={`p-4 rounded-2xl border text-left transition-all cursor-pointer ${
                  importMode === 'append'
                    ? 'border-blue-500 bg-blue-50/70 dark:bg-blue-950/30 text-slate-900 dark:text-white ring-2 ring-blue-500/20 shadow-xs'
                    : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:border-slate-300'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs sm:text-sm font-bold flex items-center gap-2.5">
                    <span
                      className={`w-3 h-3 rounded-full border-2 flex items-center justify-center ${
                        importMode === 'append'
                          ? 'border-blue-600 bg-blue-600'
                          : 'border-slate-300 dark:border-slate-600'
                      }`}
                    />
                    Gabungkan / Tambah (Append)
                  </span>
                </div>
              </button>
            </div>
          </div>

          {/* Input File Excel (Tanpa Tombol Template Excel) */}
          <div className="space-y-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <label className="block text-[11px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
                FILE EXCEL FORM KIRIM (.XLSX / .XLS / .CSV)
              </label>
            </div>

            <div className="p-4 rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-700 hover:border-blue-400 bg-slate-50/60 dark:bg-slate-950/50 transition flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <input
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={handleExcelFileSelect}
                className="w-full sm:w-auto text-xs text-slate-700 dark:text-slate-300 file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:bg-blue-600 file:text-xs file:font-bold file:text-white hover:file:bg-blue-500 file:shadow-xs file:cursor-pointer cursor-pointer"
              />

              {excelFileName && (
                <div className="px-3 py-1.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-xs font-bold text-emerald-700 dark:text-emerald-300 flex items-center gap-2 shrink-0">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>
                    {excelFileName} ({excelPreviewRows.length} Faktur • {previewUniqueStats.totalUniqueCustomers} Pelanggan)
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Ringkasan Otomatis Total Customer */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="p-3.5 rounded-2xl bg-indigo-50/70 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-800/60">
              <div className="text-[10px] font-black uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                Total Customer
              </div>
              <div className="text-lg font-black text-slate-900 dark:text-white mt-0.5 tabular-nums">
                {previewUniqueStats.totalUniqueCustomers} <span className="text-xs font-bold text-slate-500">Pelanggan</span>
              </div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400">
                Total {previewSourceRows.length} nomor faktur
              </div>
            </div>

            <div className="p-3.5 rounded-2xl bg-amber-50/80 dark:bg-amber-950/30 border border-amber-300 dark:border-amber-800/60">
              <div className="text-[10px] font-black uppercase tracking-wider text-amber-800 dark:text-amber-300">
                Pelanggan COD
              </div>
              <div className="text-lg font-black text-slate-900 dark:text-white mt-0.5 tabular-nums">
                {previewUniqueStats.codUniqueCustomers} <span className="text-xs font-bold text-slate-500">Pelanggan</span>
              </div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400">
                {previewCodRows.length} Faktur COD (Net Days = 0)
              </div>
            </div>

            <div className="p-3.5 rounded-2xl bg-rose-50/80 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800/60">
              <div className="text-[10px] font-black uppercase tracking-wider text-red-600 dark:text-red-400">
                Pelanggan TEMPO
              </div>
              <div className="text-lg font-black text-slate-900 dark:text-white mt-0.5 tabular-nums">
                {previewUniqueStats.tempoUniqueCustomers} <span className="text-xs font-bold text-slate-500">Pelanggan</span>
              </div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400">
                {previewTempoRows.length} Faktur TEMPO (Net Days &gt; 0)
              </div>
            </div>
          </div>

          {/* Keterangan Kolom Terbaca Ringkas */}
          <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200/80 dark:border-slate-800 text-slate-700 dark:text-slate-300 text-xs sm:text-sm font-medium">
            Kolom yang terbaca:{' '}
            <strong className="text-slate-900 dark:text-white">
              No. Faktur, Tgl Faktur, Nama Pelanggan, Nilai Faktur, COLY, BAYAR, Alamat 1, Keterangan, Net Days Syarat Pelanggan
            </strong>
            .
          </div>

          {/* Tampilan Preview Otomatis COD (Net Days = 0) & TEMPO (Net Days > 0) Sebelum Simpan */}
          {showUploadPreview && previewSourceRows.length > 0 && (
            <div className="pt-4 border-t border-slate-200 dark:border-slate-800 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h4 className="text-sm font-black text-slate-900 dark:text-white flex flex-wrap items-center gap-2">
                  <span>Preview Sebelum Simpan</span>
                  <span className="px-2.5 py-0.5 rounded-md text-xs bg-indigo-600 text-white font-bold">
                    {previewUniqueStats.totalUniqueCustomers} Pelanggan
                  </span>
                  <span className="px-2.5 py-0.5 rounded-md text-xs bg-amber-300 text-slate-900 font-bold">
                    COD: {previewUniqueStats.codUniqueCustomers} Pelanggan ({previewCodRows.length} Faktur)
                  </span>
                  <span className="px-2.5 py-0.5 rounded-md text-xs bg-red-600 text-white font-bold">
                    TEMPO: {previewUniqueStats.tempoUniqueCustomers} Pelanggan ({previewTempoRows.length} Faktur)
                  </span>
                </h4>
              </div>

              <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800 max-h-[420px]">
                <table className="w-full text-xs text-left border-collapse bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100">
                  <thead className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-bold text-[11px] sticky top-0 z-10 border-b border-slate-200 dark:border-slate-700">
                    <tr>
                      <th className="py-2.5 px-2.5 text-center border-r border-slate-200 dark:border-slate-700 w-10">NO</th>
                      <th className="py-2.5 px-3 border-r border-slate-200 dark:border-slate-700 min-w-[125px]">No. Faktur</th>
                      <th className="py-2.5 px-3 border-r border-slate-200 dark:border-slate-700 min-w-[96px]">Tgl Faktur</th>
                      <th className="py-2.5 px-3 border-r border-slate-200 dark:border-slate-700 min-w-[170px]">Nama Pelanggan</th>
                      <th className="py-2.5 px-3 text-right border-r border-slate-200 dark:border-slate-700 min-w-[125px]">Nilai Faktur</th>
                      <th className="py-2.5 px-2.5 text-center border-r border-slate-200 dark:border-slate-700 w-16">COLY</th>
                      <th className="py-2.5 px-3 border-r border-slate-200 dark:border-slate-700 min-w-[90px]">BAYAR</th>
                      <th className="py-2.5 px-3 border-r border-slate-200 dark:border-slate-700 min-w-[150px]">Alamat 1</th>
                      <th className="py-2.5 px-3 border-r border-slate-200 dark:border-slate-700 min-w-[140px]">Keterangan</th>
                      <th className="py-2.5 px-2.5 text-center border-r border-slate-200 dark:border-slate-700 w-24">Net Days</th>
                      <th className="py-2.5 px-2.5 text-center w-20">Kategori</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                    {previewCodRows.length > 0 && (
                      <tr>
                        <td colSpan={11} className="py-2 px-3 font-black text-amber-950 bg-amber-300/90 dark:bg-amber-500/30 dark:text-amber-200">
                          COD — {previewUniqueStats.codUniqueCustomers} PELANGGAN ({previewCodRows.length} FAKTUR)
                        </td>
                      </tr>
                    )}
                    {previewCodRows.map((row, idx) => {
                      const isRowBold = isNonGudangFaktur(row.noFaktur);
                      const hasKet = String(row.keterangan || '').trim().length > 0;
                      return (
                        <tr
                          key={row.id || `cod-${idx}`}
                          className={`hover:bg-blue-50/40 dark:hover:bg-slate-800/50 ${isRowBold ? 'font-bold' : 'font-normal'}`}
                        >
                          <td className="py-2 px-2.5 text-center border-r border-slate-200 dark:border-slate-800 align-middle">{idx + 1}</td>
                          <td className="py-2 px-3 border-r border-slate-200 dark:border-slate-800 whitespace-normal break-words align-middle">
                            {row.noFaktur}
                          </td>
                          <td className="py-2 px-3 border-r border-slate-200 dark:border-slate-800 whitespace-normal break-words align-middle">
                            {row.tglFaktur}
                          </td>
                          <td className="py-2 px-3 border-r border-slate-200 dark:border-slate-800 whitespace-normal break-words align-middle">
                            {row.namaPelanggan}
                          </td>
                          <td className="py-2 px-3 text-right border-r border-slate-200 dark:border-slate-800 whitespace-nowrap tabular-nums align-middle">
                            Rp {formatNominalRibuan(row.nilaiFaktur) || '0'}
                          </td>
                          <td className="py-2 px-2.5 text-center border-r border-slate-200 dark:border-slate-800 align-middle">
                            {row.coly > 0 ? row.coly : ''}
                          </td>
                          <td className="py-2 px-3 border-r border-slate-200 dark:border-slate-800 whitespace-normal break-words align-middle">
                            {row.bayar}
                          </td>
                          <td className="py-2 px-3 border-r border-slate-200 dark:border-slate-800 whitespace-normal break-words align-middle">
                            {row.alamatPelanggan}
                          </td>
                          <td
                            className={`py-2 px-3 border-r border-slate-200 dark:border-slate-800 whitespace-normal break-words align-middle ${
                              hasKet ? 'bg-amber-100 dark:bg-amber-950/60 font-semibold text-amber-950 dark:text-amber-200' : ''
                            }`}
                          >
                            {row.keterangan}
                          </td>
                          <td className="py-2 px-2.5 text-center font-mono border-r border-slate-200 dark:border-slate-800 align-middle">
                            {formatNetDaysDisplay(row.netDays)}
                          </td>
                          <td className="py-2 px-2.5 text-center align-middle">
                            <span className="px-2 py-0.5 rounded-md bg-amber-300 text-slate-900 font-black text-[10px]">
                              COD
                            </span>
                          </td>
                        </tr>
                      );
                    })}

                    {previewTempoRows.length > 0 && (
                      <tr>
                        <td colSpan={11} className="py-2 px-3 font-black text-white bg-red-600">
                          TEMPO — {previewUniqueStats.tempoUniqueCustomers} PELANGGAN ({previewTempoRows.length} FAKTUR)
                        </td>
                      </tr>
                    )}
                    {previewTempoRows.map((row, idx) => {
                      const isRowBold = isNonGudangFaktur(row.noFaktur);
                      const hasKet = String(row.keterangan || '').trim().length > 0;
                      return (
                        <tr
                          key={row.id || `tempo-${idx}`}
                          className={`hover:bg-rose-50/40 dark:hover:bg-slate-800/50 ${isRowBold ? 'font-bold' : 'font-normal'}`}
                        >
                          <td className="py-2 px-2.5 text-center border-r border-slate-200 dark:border-slate-800 align-middle">
                            {previewCodRows.length + idx + 1}
                          </td>
                          <td className="py-2 px-3 border-r border-slate-200 dark:border-slate-800 whitespace-normal break-words align-middle">
                            {row.noFaktur}
                          </td>
                          <td className="py-2 px-3 border-r border-slate-200 dark:border-slate-800 whitespace-normal break-words align-middle">
                            {row.tglFaktur}
                          </td>
                          <td className="py-2 px-3 border-r border-slate-200 dark:border-slate-800 whitespace-normal break-words align-middle">
                            {row.namaPelanggan}
                          </td>
                          <td className="py-2 px-3 text-right border-r border-slate-200 dark:border-slate-800 whitespace-nowrap tabular-nums align-middle">
                            Rp {formatNominalRibuan(row.nilaiFaktur) || '0'}
                          </td>
                          <td className="py-2 px-2.5 text-center border-r border-slate-200 dark:border-slate-800 align-middle">
                            {row.coly > 0 ? row.coly : ''}
                          </td>
                          <td className="py-2 px-3 border-r border-slate-200 dark:border-slate-800 whitespace-normal break-words align-middle">
                            {row.bayar}
                          </td>
                          <td className="py-2 px-3 border-r border-slate-200 dark:border-slate-800 whitespace-normal break-words align-middle">
                            {row.alamatPelanggan}
                          </td>
                          <td
                            className={`py-2 px-3 border-r border-slate-200 dark:border-slate-800 whitespace-normal break-words align-middle ${
                              hasKet ? 'bg-amber-100 dark:bg-amber-950/60 font-semibold text-amber-950 dark:text-amber-200' : ''
                            }`}
                          >
                            {row.keterangan}
                          </td>
                          <td className="py-2 px-2.5 text-center font-mono border-r border-slate-200 dark:border-slate-800 align-middle">
                            {formatNetDaysDisplay(row.netDays)}
                          </td>
                          <td className="py-2 px-2.5 text-center align-middle">
                            <span className="px-2 py-0.5 rounded-md bg-red-600 text-white font-black text-[10px]">
                              TEMPO
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
                setIsUploadExcelOpen(false);
                setExcelPreviewRows([]);
                setExcelFileName('');
                setShowUploadPreview(false);
              }}
              className="px-5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 font-bold text-xs sm:text-sm hover:bg-slate-50 dark:hover:bg-slate-800 transition cursor-pointer"
            >
              Kembali ke Form Kirim
            </button>

            <button
              type="button"
              onClick={() => setShowUploadPreview(prev => !prev)}
              className="px-5 py-2.5 rounded-xl border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 font-bold text-xs sm:text-sm flex items-center gap-2 hover:bg-blue-100 dark:hover:bg-blue-900/50 transition cursor-pointer"
            >
              <Eye className="w-4 h-4" />
              <span>{showUploadPreview ? 'Tutup Preview' : 'Preview Sebelum Simpan'}</span>
            </button>

            <button
              type="button"
              onClick={handleSaveFromUploadPage}
              className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs sm:text-sm flex items-center gap-2 shadow-sm transition cursor-pointer"
            >
              <Save className="w-4 h-4" />
              <span>Simpan Form Kirim</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-5 right-5 z-50 max-w-md bg-emerald-600 text-white px-4 py-3 rounded-2xl shadow-xl flex items-center gap-2.5 text-xs font-bold animate-in fade-in slide-in-from-bottom-4">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Executive Header Tanpa Logo + Ringkasan Total Customer */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 sm:p-6 space-y-5 shadow-sm">
        <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="text-lg sm:text-xl font-black text-slate-900 dark:text-white tracking-tight">
                Form Kirim Barang
              </h1>
              {selectedAreaKirim && (
                <span className="px-2.5 py-0.5 rounded-lg bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300 text-[11px] font-black uppercase">
                  AREA {selectedAreaKirim}
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Daftar faktur pengiriman COD &amp; Tempo per area kirim.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <ModernAreaDropdown
              value={selectedAreaKirim}
              options={deliveryAreaOptions}
              onChange={handleSelectAreaKirim}
              placeholder="Pilih Area"
            />
            <ModernCalendarPicker value={tanggalKirim} onChange={handleSelectTanggalKirim} />

            <button
              type="button"
              onClick={() => {
                setUploadDraftAreaKirim(selectedAreaKirim);
                setUploadDraftTanggalKirim(tanggalKirim);
                setShowUploadPreview(false);
                setIsUploadExcelOpen(true);
              }}
              className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-2 transition cursor-pointer shadow-sm"
            >
              <Upload className="w-4 h-4" />
              <span>Upload File Excel</span>
            </button>

            <button
              type="button"
              onClick={handleSaveFormKirim}
              className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-xs font-black flex items-center gap-2 transition cursor-pointer shadow-md shadow-blue-600/20"
            >
              <Save className="w-4 h-4" />
              <span>Simpan Form Kirim</span>
            </button>
          </div>
        </div>

        {/* KPI Cards: Total Customer, Pelanggan COD, Pelanggan TEMPO, Total COLY, Total Tagihan COD */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 pt-1">
          <div className="p-3.5 rounded-2xl bg-indigo-50/60 dark:bg-indigo-950/25 border border-indigo-200/80 dark:border-indigo-800/60">
            <div className="text-[10px] font-black uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
              Total Customer
            </div>
            <div className="text-lg sm:text-xl font-black text-slate-900 dark:text-white mt-0.5 tabular-nums">
              {summaryTotals.uniqueTotalCustomers}{' '}
              <span className="text-xs font-bold text-slate-500">Pelanggan</span>
            </div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400">
              {summaryTotals.totalInvoices} Faktur Pengiriman
            </div>
          </div>

          <div className="p-3.5 rounded-2xl bg-amber-50/70 dark:bg-amber-950/25 border border-amber-300/80 dark:border-amber-800/60">
            <div className="text-[10px] font-black uppercase tracking-wider text-amber-800 dark:text-amber-300">
              Pelanggan COD
            </div>
            <div className="text-lg sm:text-xl font-black text-slate-900 dark:text-white mt-0.5 tabular-nums">
              {summaryTotals.uniqueCodCustomers}{' '}
              <span className="text-xs font-bold text-slate-500">Pelanggan</span>
            </div>
            <div className="text-[11px] text-amber-900/80 dark:text-amber-300/80 font-semibold tabular-nums">
              {summaryTotals.codCount} Faktur • Rp {formatNominalRibuan(summaryTotals.codNilai) || '0'}
            </div>
          </div>

          <div className="p-3.5 rounded-2xl bg-rose-50/70 dark:bg-rose-950/25 border border-rose-200 dark:border-rose-800/60">
            <div className="text-[10px] font-black uppercase tracking-wider text-red-600 dark:text-red-400">
              Pelanggan TEMPO
            </div>
            <div className="text-lg sm:text-xl font-black text-slate-900 dark:text-white mt-0.5 tabular-nums">
              {summaryTotals.uniqueTempoCustomers}{' '}
              <span className="text-xs font-bold text-slate-500">Pelanggan</span>
            </div>
            <div className="text-[11px] text-rose-700 dark:text-rose-300 font-semibold tabular-nums">
              {summaryTotals.tempoCount} Faktur • Rp {formatNominalRibuan(summaryTotals.tempoNilai) || '0'}
            </div>
          </div>

          <div className="p-3.5 rounded-2xl bg-blue-50/70 dark:bg-blue-950/25 border border-blue-200 dark:border-blue-800/60">
            <div className="text-[10px] font-black uppercase tracking-wider text-blue-700 dark:text-blue-400">
              Total Muatan COLY
            </div>
            <div className="text-lg sm:text-xl font-black text-blue-700 dark:text-blue-300 mt-0.5 tabular-nums">
              {summaryTotals.totalColy} <span className="text-xs font-bold">COLY</span>
            </div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">
              COD: {summaryTotals.codColy} • TEMPO: {summaryTotals.tempoColy}
            </div>
          </div>

          <div className="col-span-2 lg:col-span-1 p-3.5 rounded-2xl bg-emerald-50/70 dark:bg-emerald-950/25 border border-emerald-200 dark:border-emerald-800/60">
            <div className="text-[10px] font-black uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
              Total Tagihan COD
            </div>
            <div className="text-base sm:text-lg font-black text-emerald-700 dark:text-emerald-300 mt-0.5 tabular-nums truncate">
              Rp {formatNominalRibuan(summaryTotals.codNilai) || '0'}
            </div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400 tabular-nums truncate">
              Total Semua: Rp {formatNominalRibuan(summaryTotals.totalNilai) || '0'}
            </div>
          </div>
        </div>
      </div>

      {/* Toolbar Sortir & Mode Tampilan */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-3.5 flex flex-col xl:flex-row xl:items-center justify-between gap-3 shadow-xs">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 flex items-center gap-1">
            <ArrowUpDown className="w-3.5 h-3.5 text-blue-500" />
            <span>Sortir:</span>
          </span>

          <select
            value={sortField}
            onChange={e => {
              const nextField = e.target.value as SortField;
              setSortField(nextField);
              if (nextField === 'nilaiFaktur' || nextField === 'coly') {
                setSortDirection('desc');
              } else if (nextField !== 'default') {
                setSortDirection('asc');
              }
            }}
            className="px-2.5 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-800 dark:text-slate-200 cursor-pointer focus:outline-none focus:border-blue-500"
          >
            <option value="default">Urutan Default</option>
            <option value="nilaiFaktur">Nilai Faktur (Rp)</option>
            <option value="coly">Jumlah COLY</option>
            <option value="namaPelanggan">Nama Pelanggan</option>
            <option value="noFaktur">No. Faktur</option>
            <option value="alamatPelanggan">Alamat 1</option>
          </select>

          <button
            type="button"
            onClick={() => {
              if (
                sortField === 'default' ||
                sortField === 'namaPelanggan' ||
                sortField === 'noFaktur' ||
                sortField === 'alamatPelanggan'
              ) {
                setSortField('nilaiFaktur');
              }
              setSortDirection('desc');
            }}
            className={`px-2.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1 transition cursor-pointer ${
              (sortField === 'nilaiFaktur' || sortField === 'coly') && sortDirection === 'desc'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
            }`}
          >
            <ArrowDownWideNarrow className="w-3.5 h-3.5" />
            <span>Besar &rarr; Kecil</span>
          </button>

          <button
            type="button"
            onClick={() => {
              if (
                sortField === 'default' ||
                sortField === 'namaPelanggan' ||
                sortField === 'noFaktur' ||
                sortField === 'alamatPelanggan'
              ) {
                setSortField('nilaiFaktur');
              }
              setSortDirection('asc');
            }}
            className={`px-2.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1 transition cursor-pointer ${
              (sortField === 'nilaiFaktur' || sortField === 'coly') && sortDirection === 'asc'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
            }`}
          >
            <ArrowUpNarrowWide className="w-3.5 h-3.5" />
            <span>Kecil &rarr; Besar</span>
          </button>

          <button
            type="button"
            onClick={() => {
              if (sortField === 'default' || sortField === 'nilaiFaktur' || sortField === 'coly') {
                setSortField('namaPelanggan');
              }
              setSortDirection('asc');
            }}
            className={`px-2.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1 transition cursor-pointer ${
              (sortField === 'namaPelanggan' || sortField === 'noFaktur' || sortField === 'alamatPelanggan') &&
              sortDirection === 'asc'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
            }`}
          >
            <ArrowDownAZ className="w-3.5 h-3.5" />
            <span>A &rarr; Z</span>
          </button>

          <button
            type="button"
            onClick={() => {
              if (sortField === 'default' || sortField === 'nilaiFaktur' || sortField === 'coly') {
                setSortField('namaPelanggan');
              }
              setSortDirection('desc');
            }}
            className={`px-2.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1 transition cursor-pointer ${
              (sortField === 'namaPelanggan' || sortField === 'noFaktur' || sortField === 'alamatPelanggan') &&
              sortDirection === 'desc'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
            }`}
          >
            <ArrowUpZA className="w-3.5 h-3.5" />
            <span>Z &rarr; A</span>
          </button>

          {sortField !== 'default' && (
            <button
              type="button"
              onClick={() => setSortField('default')}
              className="px-2 py-1.5 rounded-xl text-[11px] font-semibold text-slate-500 hover:text-slate-800 dark:hover:text-white flex items-center gap-1 cursor-pointer"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Reset</span>
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative w-full sm:w-52">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={tableSearch}
              onChange={e => setTableSearch(e.target.value)}
              placeholder="Filter pelanggan / faktur..."
              className="w-full pl-8 pr-3 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:border-blue-500"
            />
          </div>

          <div className="inline-flex rounded-xl p-1 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
            <button
              type="button"
              onClick={() => setViewMode('edit')}
              className={`px-3 py-1 rounded-lg text-xs font-bold flex items-center gap-1 transition cursor-pointer ${
                viewMode === 'edit'
                  ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              <Edit3 className="w-3 h-3" />
              <span>Mode Edit &amp; Input COLY</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('saved_preview')}
              className={`px-3 py-1 rounded-lg text-xs font-bold flex items-center gap-1 transition cursor-pointer ${
                viewMode === 'saved_preview'
                  ? 'bg-white dark:bg-slate-900 text-emerald-600 dark:text-emerald-400 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              <Eye className="w-3 h-3" />
              <span>Tampilan Simpan</span>
            </button>
          </div>
        </div>
      </div>

      {/* ===================================================================== */}
      {/* TABEL FORM KIRIM MODERN (ANUGRAH KEMASAN KREATIF)                     */}
      {/* ===================================================================== */}
      <div className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-sm overflow-hidden">
        {/* Kop Judul Form Kirim dengan Kontras Tinggi di Mode Terang & Gelap */}
        <div className="py-4 px-5 sm:px-6 border-b border-slate-200 dark:border-slate-800 bg-gradient-to-r from-indigo-50/90 via-blue-50/60 to-slate-50 dark:from-slate-900 dark:via-indigo-950/40 dark:to-slate-900 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="text-sm sm:text-base font-black tracking-wide text-slate-900 dark:text-white uppercase">
              ANUGRAH KEMASAN KREATIF
            </div>
            <div className="text-xs text-slate-600 dark:text-slate-300 font-semibold mt-0.5">
              {formattedPeriodLabel}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs font-bold">
            <span className="px-3 py-1 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 shadow-2xs">
              {summaryTotals.uniqueTotalCustomers} Pelanggan
            </span>
            <span className="px-3 py-1 rounded-xl bg-amber-300 text-slate-950 font-black shadow-2xs">
              COD: {summaryTotals.uniqueCodCustomers} Pelanggan ({summaryTotals.codCount} Faktur)
            </span>
            <span className="px-3 py-1 rounded-xl bg-red-600 text-white font-black shadow-2xs">
              TEMPO: {summaryTotals.uniqueTempoCustomers} Pelanggan ({summaryTotals.tempoCount} Faktur)
            </span>
          </div>
        </div>

        {/* Tabel Form Kirim Modern & Rapi Full-Width */}
        <div className="w-full overflow-x-auto">
          <table className="w-full table-fixed border-collapse text-xs font-sans">
            <thead>
              <tr className="bg-slate-100/90 dark:bg-slate-800/90 border-b border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-[10px] font-extrabold uppercase tracking-wider">
                <th className="border-r border-slate-200/80 dark:border-slate-700/70 py-3 px-1.5 text-center w-[36px]">
                  NO
                </th>
                <th
                  onClick={() => handleColumnSortToggle('noFaktur')}
                  className="border-r border-slate-200/80 dark:border-slate-700/70 py-3 px-2 text-left w-[11%] cursor-pointer hover:bg-blue-50/70 dark:hover:bg-slate-700/50 transition select-none"
                  title="Klik untuk sortir No. Faktur"
                >
                  <div className="flex items-center justify-between gap-1">
                    <span>No. Faktur</span>
                    {sortField === 'noFaktur' && (
                      <span className="text-[10px] text-blue-600 dark:text-blue-400">
                        {sortDirection === 'asc' ? '▲' : '▼'}
                      </span>
                    )}
                  </div>
                </th>
                <th className="border-r border-slate-200/80 dark:border-slate-700/70 py-3 px-2 text-left w-[7%]">
                  Tgl Faktur
                </th>
                <th
                  onClick={() => handleColumnSortToggle('namaPelanggan')}
                  className="border-r border-slate-200/80 dark:border-slate-700/70 py-3 px-2.5 text-left w-[15%] cursor-pointer hover:bg-blue-50/70 dark:hover:bg-slate-700/50 transition select-none"
                  title="Klik untuk sortir Nama Pelanggan (A-Z / Z-A)"
                >
                  <div className="flex items-center justify-between gap-1">
                    <span>Nama Pelanggan</span>
                    {sortField === 'namaPelanggan' && (
                      <span className="text-[10px] text-blue-600 dark:text-blue-400">
                        {sortDirection === 'asc' ? '▲' : '▼'}
                      </span>
                    )}
                  </div>
                </th>
                <th
                  onClick={() => handleColumnSortToggle('nilaiFaktur')}
                  className="border-r border-slate-200/80 dark:border-slate-700/70 py-3 px-2.5 text-right w-[11%] cursor-pointer hover:bg-blue-50/70 dark:hover:bg-slate-700/50 transition select-none"
                  title="Klik untuk sortir Nilai Faktur (Besar ke Kecil / Kecil ke Besar)"
                >
                  <div className="flex items-center justify-end gap-1">
                    <span>Nilai Faktur</span>
                    {sortField === 'nilaiFaktur' && (
                      <span className="text-[10px] text-blue-600 dark:text-blue-400">
                        {sortDirection === 'asc' ? '▲' : '▼'}
                      </span>
                    )}
                  </div>
                </th>
                <th
                  onClick={() => handleColumnSortToggle('coly')}
                  className="border-r border-slate-200/80 dark:border-slate-700/70 py-3 px-1.5 text-center w-[6%] cursor-pointer hover:bg-blue-50/70 dark:hover:bg-slate-700/50 transition select-none"
                  title="Klik untuk sortir COLY"
                >
                  <div className="flex items-center justify-center gap-1">
                    <span>COLY</span>
                    {sortField === 'coly' && (
                      <span className="text-[10px] text-blue-600 dark:text-blue-400">
                        {sortDirection === 'asc' ? '▲' : '▼'}
                      </span>
                    )}
                  </div>
                </th>
                <th className="border-r border-slate-200/80 dark:border-slate-700/70 py-3 px-2 text-left w-[7%]">
                  BAYAR
                </th>
                <th
                  onClick={() => handleColumnSortToggle('alamatPelanggan')}
                  className="border-r border-slate-200/80 dark:border-slate-700/70 py-3 px-2 text-left w-[12%] cursor-pointer hover:bg-blue-50/70 dark:hover:bg-slate-700/50 transition select-none"
                  title="Klik untuk sortir Alamat Pelanggan"
                >
                  <div className="flex items-center justify-between gap-1">
                    <span>Alamat 1</span>
                    {sortField === 'alamatPelanggan' && (
                      <span className="text-[10px] text-blue-600 dark:text-blue-400">
                        {sortDirection === 'asc' ? '▲' : '▼'}
                      </span>
                    )}
                  </div>
                </th>
                <th className="border-r border-slate-200/80 dark:border-slate-700/70 py-3 px-2 text-left w-[11%]">
                  Keterangan
                </th>
                {viewMode === 'edit' && (
                  <>
                    <th className="border-r border-slate-200/80 dark:border-slate-700/70 py-3 px-1.5 text-center w-[9%] leading-tight">
                      Syarat (Hari) &amp; Kategori
                    </th>
                    <th className="py-3 px-1.5 text-center w-[92px] whitespace-nowrap">
                      Urutan &amp; Aksi
                    </th>
                  </>
                )}
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-200/80 dark:divide-slate-800">
              {/* ========================================================= */}
              {/* BAGIAN 1: KELOMPOK PELANGGAN COD                          */}
              {/* ========================================================= */}
              <tr className="bg-amber-50/90 dark:bg-amber-950/30 border-y border-amber-200 dark:border-amber-800/60">
                <td colSpan={viewMode === 'edit' ? 11 : 9} className="py-2 px-3.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2.5">
                      <span className="px-2.5 py-1 rounded-lg font-black text-slate-950 bg-amber-300 tracking-wider uppercase text-[11px] shadow-2xs">
                        COD
                      </span>
                      <span className="text-xs font-extrabold text-amber-950 dark:text-amber-200">
                        {summaryTotals.uniqueCodCustomers} Pelanggan ({summaryTotals.codCount} Faktur)
                      </span>
                      <span className="text-[11px] font-semibold text-amber-800/80 dark:text-amber-300/80">
                        • Total COD: Rp {formatNominalRibuan(summaryTotals.codNilai) || '0'}
                      </span>
                    </div>
                    {viewMode === 'edit' && (
                      <button
                        type="button"
                        onClick={() => handleInsertManualRowInSection('COD')}
                        className="px-2.5 py-1 rounded-lg bg-amber-400/90 hover:bg-amber-400 text-slate-950 font-bold text-[11px] inline-flex items-center gap-1 transition cursor-pointer shadow-2xs"
                        title="Tambah baris manual di kelompok COD"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Tambah Baris COD</span>
                      </button>
                    )}
                  </div>
                </td>
              </tr>

              {codItems.length === 0 ? (
                <tr>
                  <td
                    colSpan={viewMode === 'edit' ? 11 : 9}
                    className="py-4 px-3 text-center text-slate-400 italic"
                  >
                    Tidak ada faktur pelanggan COD (Net Days = 0).
                  </td>
                </tr>
              ) : (
                codItems.map((item, idx) => {
                  const rowNum = idx + 1;
                  const boldClass = isNonGudangFaktur(item.noFaktur) ? 'font-bold' : 'font-normal';
                  const hasKeterangan = String(item.keterangan || '').trim().length > 0;
                  return (
                    <tr
                      key={item.id}
                      className={`hover:bg-blue-50/50 dark:hover:bg-slate-800/50 transition-colors ${boldClass}`}
                    >
                      <td className="border-r border-slate-200/70 dark:border-slate-800 py-2 px-2 text-center relative align-middle text-slate-500 dark:text-slate-400 font-semibold">
                        <span>{rowNum}</span>
                        {viewMode === 'edit' && (
                          <div className="group/rowplus absolute -bottom-2.5 inset-x-0 h-5 flex items-center justify-center z-20">
                            <button
                              type="button"
                              onClick={() => handleInsertManualRowAfter(item.id, 'COD')}
                              className="w-4 h-4 rounded-full bg-blue-600 text-white shadow-sm flex items-center justify-center opacity-0 group-hover/rowplus:opacity-100 focus:opacity-100 hover:scale-110 transition-all duration-150 cursor-pointer"
                              title={`Sisipkan baris COD setelah nomor ${rowNum}`}
                            >
                              <Plus className="w-2.5 h-2.5" />
                            </button>
                          </div>
                        )}
                      </td>
                      <td className="border-r border-slate-200/70 dark:border-slate-800 py-1.5 px-2.5 text-left whitespace-normal break-words align-middle font-mono text-[11px]">
                        {viewMode === 'edit' ? (
                          <AutoWrapCellTextarea
                            value={item.noFaktur}
                            placeholder="No. Faktur..."
                            onChange={val => handleUpdateInvoiceCell(item.id, 'noFaktur', val.toUpperCase())}
                            className={`uppercase font-mono ${boldClass}`}
                          />
                        ) : (
                          <div className="whitespace-normal break-words leading-snug">{item.noFaktur}</div>
                        )}
                      </td>
                      <td className="border-r border-slate-200/70 dark:border-slate-800 py-1.5 px-2.5 text-left whitespace-normal break-words align-middle text-slate-600 dark:text-slate-300">
                        {viewMode === 'edit' ? (
                          <AutoWrapCellTextarea
                            value={item.tglFaktur}
                            onChange={val => handleUpdateInvoiceCell(item.id, 'tglFaktur', val)}
                            className={boldClass}
                          />
                        ) : (
                          <div className="whitespace-normal break-words leading-snug">{item.tglFaktur}</div>
                        )}
                      </td>
                      <td className="border-r border-slate-200/70 dark:border-slate-800 py-1.5 px-2.5 text-left uppercase whitespace-normal break-words align-middle text-slate-900 dark:text-white">
                        {viewMode === 'edit' ? (
                          <AutoWrapCellTextarea
                            value={item.namaPelanggan}
                            placeholder="Nama Pelanggan..."
                            onChange={val => handleUpdateInvoiceCell(item.id, 'namaPelanggan', val.toUpperCase())}
                            className={`uppercase ${boldClass}`}
                          />
                        ) : (
                          <div className="whitespace-normal break-words leading-snug">{item.namaPelanggan}</div>
                        )}
                      </td>
                      <td className="border-r border-slate-200/70 dark:border-slate-800 py-1.5 px-3 whitespace-nowrap align-middle">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-slate-400 dark:text-slate-500 text-[11px]">Rp</span>
                          {viewMode === 'edit' ? (
                            <RupiahCellInput
                              value={item.nilaiFaktur}
                              onChange={num => handleUpdateInvoiceCell(item.id, 'nilaiFaktur', num)}
                              className={boldClass}
                            />
                          ) : (
                            <span className="tabular-nums font-semibold">
                              {formatNominalRibuan(item.nilaiFaktur) || '0'}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="border-r border-slate-200/70 dark:border-slate-800 py-1.5 px-2 text-center align-middle">
                        {viewMode === 'edit' ? (
                          <input
                            type="number"
                            min={0}
                            value={item.coly > 0 ? item.coly : ''}
                            placeholder="0"
                            onChange={e => {
                              const raw = e.target.value;
                              const num = raw === '' ? 0 : Math.max(0, Math.round(Number(raw) || 0));
                              handleUpdateInvoiceCell(item.id, 'coly', num);
                            }}
                            className={`w-14 py-1 px-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-center bg-slate-50/70 dark:bg-slate-800/70 focus:outline-none focus:border-blue-500 focus:bg-white dark:focus:bg-slate-900 tabular-nums ${boldClass}`}
                          />
                        ) : item.coly > 0 ? (
                          <span className="px-2 py-0.5 rounded-md bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 font-bold tabular-nums">
                            {item.coly}
                          </span>
                        ) : (
                          ''
                        )}
                      </td>
                      <td className="border-r border-slate-200/70 dark:border-slate-800 py-1.5 px-2.5 text-left whitespace-normal break-words align-middle">
                        {viewMode === 'edit' ? (
                          <AutoWrapCellTextarea
                            value={item.bayar}
                            onChange={val => handleUpdateInvoiceCell(item.id, 'bayar', val)}
                            className={boldClass}
                          />
                        ) : (
                          <div className="whitespace-normal break-words leading-snug">{item.bayar}</div>
                        )}
                      </td>
                      <td className="border-r border-slate-200/70 dark:border-slate-800 py-1.5 px-2.5 text-left uppercase whitespace-normal break-words align-middle text-slate-700 dark:text-slate-300">
                        {viewMode === 'edit' ? (
                          <AutoWrapCellTextarea
                            value={item.alamatPelanggan}
                            placeholder="Alamat..."
                            onChange={val => handleUpdateInvoiceCell(item.id, 'alamatPelanggan', val.toUpperCase())}
                            className={`uppercase ${boldClass}`}
                          />
                        ) : (
                          <div className="whitespace-normal break-words leading-snug">{item.alamatPelanggan}</div>
                        )}
                      </td>
                      <td
                        className={`border-r border-slate-200/70 dark:border-slate-800 py-1.5 px-2.5 text-left whitespace-normal break-words align-middle ${
                          hasKeterangan
                            ? 'bg-amber-100/90 dark:bg-amber-950/50 font-semibold text-amber-950 dark:text-amber-200'
                            : ''
                        }`}
                      >
                        {viewMode === 'edit' ? (
                          <AutoWrapCellTextarea
                            value={item.keterangan}
                            placeholder="Catatan..."
                            onChange={val => handleUpdateInvoiceCell(item.id, 'keterangan', val)}
                            className={`${boldClass} ${hasKeterangan ? 'font-semibold' : ''}`}
                          />
                        ) : (
                          <div className="whitespace-normal break-words leading-snug">{item.keterangan}</div>
                        )}
                      </td>
                      {viewMode === 'edit' && (
                        <>
                          <td className="border-r border-slate-200/70 dark:border-slate-800 py-1.5 px-2 text-center font-mono align-middle">
                            <div className="flex items-center justify-center gap-1.5">
                              <input
                                type="number"
                                min={0}
                                step="1"
                                value={item.netDays}
                                onChange={e => handleUpdateInvoiceCell(item.id, 'netDays', e.target.value)}
                                className="w-11 py-0.5 px-1 rounded-md border border-slate-200 dark:border-slate-700 text-center bg-slate-50 dark:bg-slate-800 focus:outline-none focus:border-blue-500 font-mono text-xs"
                                title="0 = COD, > 0 = TEMPO"
                              />
                              <button
                                type="button"
                                onClick={() => handleToggleCategory(item.id)}
                                className="px-2 py-0.5 rounded-md text-[10px] font-black uppercase transition cursor-pointer bg-amber-300 text-slate-950 hover:bg-amber-400 shadow-2xs"
                                title="Klik untuk ubah kategori ke TEMPO"
                              >
                                COD
                              </button>
                            </div>
                          </td>
                          <td className="py-1.5 px-2 text-center align-middle min-w-[105px]">
                            <div className="flex items-center justify-center gap-1">
                              <button
                                type="button"
                                onClick={() => handleMoveItemUp(item.id)}
                                className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
                                title="Pindah baris ke atas"
                              >
                                <ChevronUp className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleMoveItemDown(item.id)}
                                className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
                                title={
                                  idx === codItems.length - 1
                                    ? 'Pindah baris turun ke kelompok TEMPO'
                                    : 'Pindah baris ke bawah'
                                }
                              >
                                <ChevronDown className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteInvoiceRow(item.id)}
                                className="p-1.5 rounded-lg border border-rose-200 dark:border-rose-900/60 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/50 transition cursor-pointer"
                                title="Hapus baris faktur"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </>
                      )}
                    </tr>
                  );
                })
              )}

              {/* ========================================================= */}
              {/* BAGIAN 2: KELOMPOK PELANGGAN TEMPO (WARNA MERAH)          */}
              {/* ========================================================= */}
              <tr className="bg-rose-50/90 dark:bg-rose-950/35 border-y border-rose-200 dark:border-rose-800/60">
                <td colSpan={viewMode === 'edit' ? 11 : 9} className="py-2 px-3.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2.5">
                      <span className="px-2.5 py-1 rounded-lg font-black text-white bg-red-600 tracking-wider uppercase text-[11px] shadow-2xs">
                        TEMPO
                      </span>
                      <span className="text-xs font-extrabold text-red-700 dark:text-red-300">
                        {summaryTotals.uniqueTempoCustomers} Pelanggan ({summaryTotals.tempoCount} Faktur)
                      </span>
                      <span className="text-[11px] font-semibold text-rose-700/80 dark:text-rose-300/80">
                        • Total TEMPO: Rp {formatNominalRibuan(summaryTotals.tempoNilai) || '0'}
                      </span>
                    </div>
                    {viewMode === 'edit' && (
                      <button
                        type="button"
                        onClick={() => handleInsertManualRowInSection('TEMPO')}
                        className="px-2.5 py-1 rounded-lg bg-red-600 hover:bg-red-500 text-white font-bold text-[11px] inline-flex items-center gap-1 transition cursor-pointer shadow-2xs"
                        title="Tambah baris manual di kelompok TEMPO"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Tambah Baris TEMPO</span>
                      </button>
                    )}
                  </div>
                </td>
              </tr>

              {tempoItems.length === 0 ? (
                <tr>
                  <td
                    colSpan={viewMode === 'edit' ? 11 : 9}
                    className="py-4 px-3 text-center text-slate-400 italic"
                  >
                    Tidak ada faktur pelanggan TEMPO (Net Days &gt; 0).
                  </td>
                </tr>
              ) : (
                tempoItems.map((item, idx) => {
                  const rowNum = codItems.length + idx + 1;
                  const boldClass = isNonGudangFaktur(item.noFaktur) ? 'font-bold' : 'font-normal';
                  const hasKeterangan = String(item.keterangan || '').trim().length > 0;
                  return (
                    <tr
                      key={item.id}
                      className={`hover:bg-rose-50/40 dark:hover:bg-slate-800/50 transition-colors ${boldClass}`}
                    >
                      <td className="border-r border-slate-200/70 dark:border-slate-800 py-2 px-2 text-center relative align-middle text-slate-500 dark:text-slate-400 font-semibold">
                        <span>{rowNum}</span>
                        {viewMode === 'edit' && (
                          <div className="group/rowplus absolute -bottom-2.5 inset-x-0 h-5 flex items-center justify-center z-20">
                            <button
                              type="button"
                              onClick={() => handleInsertManualRowAfter(item.id, 'TEMPO')}
                              className="w-4 h-4 rounded-full bg-red-600 text-white shadow-sm flex items-center justify-center opacity-0 group-hover/rowplus:opacity-100 focus:opacity-100 hover:scale-110 transition-all duration-150 cursor-pointer"
                              title={`Sisipkan baris TEMPO setelah nomor ${rowNum}`}
                            >
                              <Plus className="w-2.5 h-2.5" />
                            </button>
                          </div>
                        )}
                      </td>
                      <td className="border-r border-slate-200/70 dark:border-slate-800 py-1.5 px-2.5 text-left whitespace-normal break-words align-middle font-mono text-[11px]">
                        {viewMode === 'edit' ? (
                          <AutoWrapCellTextarea
                            value={item.noFaktur}
                            placeholder="No. Faktur..."
                            onChange={val => handleUpdateInvoiceCell(item.id, 'noFaktur', val.toUpperCase())}
                            className={`uppercase font-mono ${boldClass}`}
                          />
                        ) : (
                          <div className="whitespace-normal break-words leading-snug">{item.noFaktur}</div>
                        )}
                      </td>
                      <td className="border-r border-slate-200/70 dark:border-slate-800 py-1.5 px-2.5 text-left whitespace-normal break-words align-middle text-slate-600 dark:text-slate-300">
                        {viewMode === 'edit' ? (
                          <AutoWrapCellTextarea
                            value={item.tglFaktur}
                            onChange={val => handleUpdateInvoiceCell(item.id, 'tglFaktur', val)}
                            className={boldClass}
                          />
                        ) : (
                          <div className="whitespace-normal break-words leading-snug">{item.tglFaktur}</div>
                        )}
                      </td>
                      <td className="border-r border-slate-200/70 dark:border-slate-800 py-1.5 px-2.5 text-left uppercase whitespace-normal break-words align-middle text-slate-900 dark:text-white">
                        {viewMode === 'edit' ? (
                          <AutoWrapCellTextarea
                            value={item.namaPelanggan}
                            placeholder="Nama Pelanggan..."
                            onChange={val => handleUpdateInvoiceCell(item.id, 'namaPelanggan', val.toUpperCase())}
                            className={`uppercase ${boldClass}`}
                          />
                        ) : (
                          <div className="whitespace-normal break-words leading-snug">{item.namaPelanggan}</div>
                        )}
                      </td>
                      <td className="border-r border-slate-200/70 dark:border-slate-800 py-1.5 px-3 whitespace-nowrap align-middle">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-slate-400 dark:text-slate-500 text-[11px]">Rp</span>
                          {viewMode === 'edit' ? (
                            <RupiahCellInput
                              value={item.nilaiFaktur}
                              onChange={num => handleUpdateInvoiceCell(item.id, 'nilaiFaktur', num)}
                              className={boldClass}
                            />
                          ) : (
                            <span className="tabular-nums font-semibold">
                              {formatNominalRibuan(item.nilaiFaktur) || '0'}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="border-r border-slate-200/70 dark:border-slate-800 py-1.5 px-2 text-center align-middle">
                        {viewMode === 'edit' ? (
                          <input
                            type="number"
                            min={0}
                            value={item.coly > 0 ? item.coly : ''}
                            placeholder="0"
                            onChange={e => {
                              const raw = e.target.value;
                              const num = raw === '' ? 0 : Math.max(0, Math.round(Number(raw) || 0));
                              handleUpdateInvoiceCell(item.id, 'coly', num);
                            }}
                            className={`w-14 py-1 px-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-center bg-slate-50/70 dark:bg-slate-800/70 focus:outline-none focus:border-blue-500 focus:bg-white dark:focus:bg-slate-900 tabular-nums ${boldClass}`}
                          />
                        ) : item.coly > 0 ? (
                          <span className="px-2 py-0.5 rounded-md bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 font-bold tabular-nums">
                            {item.coly}
                          </span>
                        ) : (
                          ''
                        )}
                      </td>
                      <td className="border-r border-slate-200/70 dark:border-slate-800 py-1.5 px-2.5 text-left whitespace-normal break-words align-middle">
                        {viewMode === 'edit' ? (
                          <AutoWrapCellTextarea
                            value={item.bayar}
                            onChange={val => handleUpdateInvoiceCell(item.id, 'bayar', val)}
                            className={boldClass}
                          />
                        ) : (
                          <div className="whitespace-normal break-words leading-snug">{item.bayar}</div>
                        )}
                      </td>
                      <td className="border-r border-slate-200/70 dark:border-slate-800 py-1.5 px-2.5 text-left uppercase whitespace-normal break-words align-middle text-slate-700 dark:text-slate-300">
                        {viewMode === 'edit' ? (
                          <AutoWrapCellTextarea
                            value={item.alamatPelanggan}
                            placeholder="Alamat..."
                            onChange={val => handleUpdateInvoiceCell(item.id, 'alamatPelanggan', val.toUpperCase())}
                            className={`uppercase ${boldClass}`}
                          />
                        ) : (
                          <div className="whitespace-normal break-words leading-snug">{item.alamatPelanggan}</div>
                        )}
                      </td>
                      <td
                        className={`border-r border-slate-200/70 dark:border-slate-800 py-1.5 px-2.5 text-left whitespace-normal break-words align-middle ${
                          hasKeterangan
                            ? 'bg-amber-100/90 dark:bg-amber-950/50 font-semibold text-amber-950 dark:text-amber-200'
                            : ''
                        }`}
                      >
                        {viewMode === 'edit' ? (
                          <AutoWrapCellTextarea
                            value={item.keterangan}
                            placeholder="Catatan..."
                            onChange={val => handleUpdateInvoiceCell(item.id, 'keterangan', val)}
                            className={`${boldClass} ${hasKeterangan ? 'font-semibold' : ''}`}
                          />
                        ) : (
                          <div className="whitespace-normal break-words leading-snug">{item.keterangan}</div>
                        )}
                      </td>
                      {viewMode === 'edit' && (
                        <>
                          <td className="border-r border-slate-200/70 dark:border-slate-800 py-1.5 px-2 text-center font-mono align-middle">
                            <div className="flex items-center justify-center gap-1.5">
                              <input
                                type="number"
                                min={0}
                                step="1"
                                value={item.netDays}
                                onChange={e => handleUpdateInvoiceCell(item.id, 'netDays', e.target.value)}
                                className="w-11 py-0.5 px-1 rounded-md border border-slate-200 dark:border-slate-700 text-center bg-slate-50 dark:bg-slate-800 focus:outline-none focus:border-blue-500 font-mono text-xs"
                                title="0 = COD, > 0 = TEMPO"
                              />
                              <button
                                type="button"
                                onClick={() => handleToggleCategory(item.id)}
                                className="px-2 py-0.5 rounded-md text-[10px] font-black uppercase transition cursor-pointer bg-red-600 text-white hover:bg-red-500 shadow-2xs"
                                title="Klik untuk naikkan pelanggan TEMPO ke COD"
                              >
                                TEMPO
                              </button>
                            </div>
                          </td>
                          <td className="py-1.5 px-2 text-center align-middle min-w-[105px]">
                            <div className="flex items-center justify-center gap-1">
                              <button
                                type="button"
                                onClick={() => handleMoveItemUp(item.id)}
                                className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
                                title={
                                  idx === 0
                                    ? 'Naikkan pelanggan dari TEMPO ke kategori COD'
                                    : 'Pindah baris ke atas'
                                }
                              >
                                <ChevronUp className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleMoveItemDown(item.id)}
                                className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
                                title="Pindah baris ke bawah"
                              >
                                <ChevronDown className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteInvoiceRow(item.id)}
                                className="p-1.5 rounded-lg border border-rose-200 dark:border-rose-900/60 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/50 transition cursor-pointer"
                                title="Hapus baris faktur"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </>
                      )}
                    </tr>
                  );
                })
              )}

              {/* ========================================================= */}
              {/* BARIS JUMLAH / SUM COLY DI BAGIAN BAWAH TABEL             */}
              {/* ========================================================= */}
              <tr className="bg-slate-100/90 dark:bg-slate-800/90 font-bold border-t-2 border-slate-300 dark:border-slate-700">
                <td colSpan={4} className="border-r border-slate-200 dark:border-slate-700 py-3 px-4 text-right text-xs font-black text-slate-800 dark:text-slate-100 uppercase">
                  Total ({summaryTotals.uniqueTotalCustomers} Pelanggan • {summaryTotals.totalInvoices} Faktur)
                </td>
                <td className="border-r border-slate-200 dark:border-slate-700 py-3 px-3 text-right text-xs font-black text-slate-900 dark:text-white tabular-nums">
                  Rp {formatNominalRibuan(summaryTotals.totalNilai) || '0'}
                </td>
                <td className="border-r border-slate-200 dark:border-slate-700 py-3 px-2.5 text-center text-sm font-black text-blue-700 dark:text-blue-300 bg-blue-50/80 dark:bg-blue-950/40 tabular-nums">
                  {summaryTotals.totalColy}
                </td>
                <td colSpan={viewMode === 'edit' ? 5 : 3} className="py-3 px-3">
                  &nbsp;
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// 2. SUB-MENU FINANCE & TAX: VALIDASI FORM KIRIM (DIAMBIL DARI PORTAL DRIVER)
// ============================================================================
interface DriverSignaturePreview {
  formKirimId: string;
  itemId: string;
  noFormKirim: string;
  noFaktur: string;
  namaPelanggan: string;
  nilaiFaktur: number;
  paymentCategory: 'COD' | 'TEMPO';
  ttdDataUrl: string;
  ttdSignerName: string;
  ttdSignedAt?: string;
  isValidated: boolean;
}

const AccountingRupiah: React.FC<{
  value: number;
  className?: string;
  rpClassName?: string;
  amountClassName?: string;
}> = ({
  value,
  className = '',
  rpClassName = 'text-slate-400 dark:text-slate-500 font-semibold',
  amountClassName = 'font-bold text-slate-900 dark:text-white'
}) => {
  const formatted = (Number(value) || 0).toLocaleString('id-ID', { maximumFractionDigits: 2 });
  return (
    <div className={`flex items-baseline justify-between gap-2.5 w-full min-w-[138px] max-w-[162px] ml-auto tabular-nums ${className}`}>
      <span className={`text-left shrink-0 select-none ${rpClassName}`}>Rp</span>
      <span className={`text-right ${amountClassName}`}>{formatted}</span>
    </div>
  );
};

export const FinanceValidasiFormKirimTab: React.FC = () => {
  const [records, setRecords] = useState<FormKirimRecord[]>(() => formKirimStore.getAll());
  const [selectedDate, setSelectedDate] = useState<string>(() => getTodayWibIso());
  const [selectedArea, setSelectedArea] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedIds, setExpandedIds] = useState<Record<string, boolean>>({});
  const [isSyncing, setIsSyncing] = useState(false);
  const [signaturePreview, setSignaturePreview] = useState<DriverSignaturePreview | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const currentUser = logisticsStore.getCurrentUser();
  const isSuperAdmin = currentUser?.role === 'super_admin';
  const validatorName = currentUser?.fullName || 'Finance & Tax AKK';

  const showFinanceToast = (msg: string) => {
    setToastMessage(msg);
    window.setTimeout(() => setToastMessage(null), 4000);
  };
  const fleets = logisticsStore.getFleets();
  const schedules = logisticsStore.getSchedules();

  const resolveRecordArmadaMeta = (rec: FormKirimRecord) => {
    const normPlate = (p?: string) => String(p || '').replace(/\s+/g, '').toUpperCase();
    const recArea = standardizeAreaName(rec.areaKirim || '').trim().toUpperCase();
    const matchedSchedule = schedules.find(s => {
      const sDateMatch = !rec.tanggalKirim || s.deliveryDate === rec.tanggalKirim;
      const sArea = standardizeAreaName(s.areaName || s.store?.storeName || '').trim().toUpperCase();
      return (
        sDateMatch &&
        Boolean(recArea) &&
        (sArea === recArea || (sArea.length > 0 && (sArea.includes(recArea) || recArea.includes(sArea))))
      );
    });
    const matchedFleet =
      fleets.find(f => f.id === rec.fleetId) ||
      (matchedSchedule?.fleetId ? fleets.find(f => f.id === matchedSchedule.fleetId) : undefined) ||
      fleets.find(f => normPlate(f.plateNumber) === normPlate(rec.plateNumber));
    const armadaInitial = String(
      rec.armadaInitial ||
      matchedSchedule?.armada ||
      matchedSchedule?.fleet?.initialCode ||
      matchedFleet?.initialCode ||
      ''
    ).trim();
    const driver = String(rec.driverName || matchedSchedule?.crew?.name || '').trim();
    const rawHelper = String(rec.helperName || matchedSchedule?.crewHelper?.name || '').trim();
    const helper = rawHelper && rawHelper.toLowerCase() !== driver.toLowerCase() ? rawHelper : '';
    return { armadaInitial, driver, helper };
  };

  useEffect(() => {
    void formKirimStore.hydrateFromServer(true);
    const unsubForm = formKirimStore.subscribe(() => {
      setRecords(formKirimStore.getAll());
    });
    const refreshFromServer = () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
      void formKirimStore.hydrateFromServer(true);
    };
    const intervalId = window.setInterval(refreshFromServer, 25000);
    window.addEventListener('focus', refreshFromServer);
    return () => {
      unsubForm();
      window.clearInterval(intervalId);
      window.removeEventListener('focus', refreshFromServer);
    };
  }, []);

  const handleManualSync = async () => {
    setIsSyncing(true);
    try {
      await formKirimStore.hydrateFromServer(true, true);
      setRecords(formKirimStore.getAll());
    } finally {
      setIsSyncing(false);
    }
  };

  // Tanggal yang memiliki data Form Kirim (ditandai titik hijau di kalender)
  const datesWithRecords = useMemo(() => {
    const s = new Set<string>();
    records.forEach(r => {
      if (r.tanggalKirim) s.add(r.tanggalKirim);
    });
    return s;
  }, [records]);

  // Daftar Form Kirim pada tanggal yang dipilih
  const recordsOnSelectedDate = useMemo(() => {
    return records.filter(item => item.tanggalKirim === selectedDate);
  }, [records, selectedDate]);

  // Daftar area kirim unik (dari master area + data form kirim) + jumlah form kirim pada tanggal terpilih
  const { areaOptions, countsByArea } = useMemo(() => {
    const areaMap = new Map<string, string>();
    const counts: Record<string, number> = {};

    const registerArea = (rawVal?: string | null) => {
      const trimmed = String(rawVal || '').trim();
      const lower = trimmed.toLowerCase();
      if (!trimmed || trimmed === '-' || lower === 'area pengiriman' || lower === 'area kiriman' || lower === 'area kirim') return;
      const canonical = standardizeAreaName(trimmed);
      const canonicalLower = canonical.toLowerCase();
      if (!canonical || canonical === '-' || canonicalLower === 'area pengiriman' || canonicalLower === 'area kiriman' || canonicalLower === 'area kirim') return;
      const key = canonical.toUpperCase().replace(/\s+/g, ' ').trim();
      if (!areaMap.has(key)) {
        areaMap.set(key, canonical);
      }
    };

    OFFICIAL_DESTINATION_AREAS.forEach(a => registerArea(a));
    records.forEach(r => registerArea(r.areaKirim));

    recordsOnSelectedDate.forEach(r => {
      const raw = String(r.areaKirim || '').trim();
      if (!raw) return;
      const key = standardizeAreaName(raw).toUpperCase().replace(/\s+/g, ' ').trim();
      if (key) {
        counts[key] = (counts[key] || 0) + 1;
      }
    });

    const sortedOptions = Array.from(areaMap.values()).sort((a, b) => {
      const countA = counts[a.toUpperCase()] || 0;
      const countB = counts[b.toUpperCase()] || 0;
      if (countA !== countB) return countB - countA;
      return a.localeCompare(b, 'id-ID');
    });

    return { areaOptions: sortedOptions, countsByArea: counts };
  }, [records, recordsOnSelectedDate]);

  // Filter utama: Tanggal (hari itu) + Area Kirim (Area A -> Form Kirim A, Area B -> Form Kirim B) + Pencarian
  const filteredRecords = useMemo(() => {
    const targetAreaKey = selectedArea
      ? standardizeAreaName(selectedArea).toUpperCase().replace(/\s+/g, ' ').trim()
      : '';

    return recordsOnSelectedDate.filter(item => {
      if (targetAreaKey) {
        const itemAreaRaw = String(item.areaKirim || '').trim();
        const itemAreaKey = itemAreaRaw
          ? standardizeAreaName(itemAreaRaw).toUpperCase().replace(/\s+/g, ' ').trim()
          : '';
        if (itemAreaKey !== targetAreaKey && itemAreaRaw.toUpperCase() !== selectedArea.trim().toUpperCase()) {
          return false;
        }
      }

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchInvoice = (item.invoiceItems || []).some(
          inv =>
            inv.noFaktur.toLowerCase().includes(q) ||
            inv.namaPelanggan.toLowerCase().includes(q)
        );
        const match =
          matchInvoice ||
          item.noFormKirim.toLowerCase().includes(q) ||
          item.noFaktur.toLowerCase().includes(q) ||
          (item.areaKirim || '').toLowerCase().includes(q) ||
          item.storeName.toLowerCase().includes(q) ||
          item.driverName.toLowerCase().includes(q);
        if (!match) return false;
      }
      return true;
    });
  }, [recordsOnSelectedDate, selectedArea, searchQuery]);

  // Hitung ringkasan keseluruhan HARI TERPILIH (& AREA TERPILIH) sesuai Form Kirim
  const globalTotals = useMemo(() => {
    return filteredRecords.reduce(
      (acc, rec) => {
        const items = rec.invoiceItems || [];
        if (items.length === 0) {
          acc.totalFaktur += 1;
          acc.totalTagihan += Number(rec.totalNominalFaktur) || 0;
          acc.totalTunaiDiterima += Number(rec.totalNominalDiterima) || 0;
          if (rec.financeMatchedChecked) acc.matchedCheckedCount += 1;
          if (rec.financeSettlementChecked) acc.settlementCheckedCount += 1;
          return acc;
        }
        items.forEach(it => {
          acc.totalFaktur += 1;
          acc.totalTagihan += Number(it.nilaiFaktur) || 0;
          const isTf =
            it.metodeBayarAktual === 'Transfer' ||
            String(it.bayar || '').trim().toUpperCase() === 'TRANSFER';
          const isTunai =
            it.metodeBayarAktual === 'Tunai' &&
            (Number(it.nominalDiterima) > 0 || Boolean(it.isCombinedPayment));
          if (isTunai) {
            acc.totalTunaiDiterima += Number(it.nominalDiterima) || 0;
          }
          if (isTf) {
            acc.totalTfCount += 1;
            acc.totalTfTagihan += Number(it.nilaiFaktur) || 0;
            if (it.financeTfValidated) acc.validatedTfCount += 1;
          }
          if (it.ttdDataUrl) {
            acc.totalTtdCount += 1;
            if (it.financeTtdValidated) acc.validatedTtdCount += 1;
          }
          if (it.financeMatchedChecked) {
            acc.matchedCheckedCount += 1;
          }
          if (it.financeSettlementChecked) {
            acc.settlementCheckedCount += 1;
          }
        });
        return acc;
      },
      {
        totalFaktur: 0,
        totalTagihan: 0,
        totalTunaiDiterima: 0,
        totalTfCount: 0,
        validatedTfCount: 0,
        totalTfTagihan: 0,
        totalTtdCount: 0,
        validatedTtdCount: 0,
        matchedCheckedCount: 0,
        settlementCheckedCount: 0
      }
    );
  }, [filteredRecords]);

  const computeRecordMetrics = (rec: FormKirimRecord) => {
    const items = rec.invoiceItems || [];
    let totalTagihan = 0;
    let totalTunaiDiterima = 0;
    let tunaiCount = 0;
    let tunaiValidatedCount = 0;
    let tfCount = 0;
    let tfValidatedCount = 0;
    let tfNominalTagihan = 0;
    let ttdCount = 0;
    let ttdValidatedCount = 0;
    let matchedCheckedCount = 0;
    let settlementCheckedCount = 0;
    let completedByDriverCount = 0;

    items.forEach(it => {
      const nilai = Number(it.nilaiFaktur) || 0;
      totalTagihan += nilai;
      const isTf =
        it.metodeBayarAktual === 'Transfer' ||
        String(it.bayar || '').trim().toUpperCase() === 'TRANSFER';
      const isTunai =
        it.metodeBayarAktual === 'Tunai' &&
        (Number(it.nominalDiterima) > 0 || Boolean(it.isCombinedPayment));
      const hasTtd = Boolean(it.ttdDataUrl);

      if (isTunai) {
        tunaiCount += 1;
        totalTunaiDiterima += Number(it.nominalDiterima) || 0;
        if (it.financeTunaiValidated) tunaiValidatedCount += 1;
      }
      if (isTf) {
        tfCount += 1;
        tfNominalTagihan += nilai;
        if (it.financeTfValidated) tfValidatedCount += 1;
      }
      if (hasTtd) {
        ttdCount += 1;
        if (it.financeTtdValidated) ttdValidatedCount += 1;
      }
      if (it.financeMatchedChecked) {
        matchedCheckedCount += 1;
      }
      if (it.financeSettlementChecked) {
        settlementCheckedCount += 1;
      }
      if (isTunai || isTf || hasTtd || it.metodeBayarAktual === 'TTD') {
        completedByDriverCount += 1;
      }
    });

    if (items.length === 0) {
      totalTagihan = Number(rec.totalNominalFaktur) || 0;
      totalTunaiDiterima = Number(rec.totalNominalDiterima) || 0;
      matchedCheckedCount = rec.financeMatchedChecked ? 1 : 0;
      settlementCheckedCount = rec.financeSettlementChecked ? 1 : 0;
    }

    const totalInvoiceCount = items.length > 0 ? items.length : 1;

    return {
      items,
      totalInvoiceCount,
      totalTagihan,
      totalTunaiDiterima,
      tunaiCount,
      tunaiValidatedCount,
      tfCount,
      tfValidatedCount,
      tfNominalTagihan,
      ttdCount,
      ttdValidatedCount,
      matchedCheckedCount,
      settlementCheckedCount,
      completedByDriverCount
    };
  };

  const toggleExpand = (id: string) => {
    setExpandedIds(prev => ({ ...prev, [id]: !(prev[id] ?? true) }));
  };

  const formatSignedTime = (iso?: string) => {
    if (!iso) return '';
    try {
      return new Date(iso).toLocaleString('id-ID', {
        day: '2-digit',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return iso;
    }
  };

  const settlementPercent =
    globalTotals.totalFaktur > 0
      ? Math.round((globalTotals.settlementCheckedCount / globalTotals.totalFaktur) * 100)
      : 0;

  return (
    <div className="space-y-4">
      {toastMessage && (
        <div className="fixed bottom-5 right-5 z-50 max-w-md bg-emerald-600 text-white px-4 py-3 rounded-2xl shadow-xl flex items-center gap-2.5 text-xs font-bold animate-in fade-in slide-in-from-bottom-4">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header Utama + Kalender & Dropdown Area Kirim Sejajar di Bawah Judul */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 sm:p-5 space-y-4 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-emerald-600 to-teal-600 text-white flex items-center justify-center shadow-sm shrink-0">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-base sm:text-lg font-black text-slate-900 dark:text-white tracking-tight">
                Validasi Form Kirim (Finance)
              </h1>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Rekonsiliasi setoran Portal Driver, validasi sesuai faktur, serta checklist lunas harian.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleManualSync}
            disabled={isSyncing}
            className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl bg-blue-50 dark:bg-blue-950/50 border border-blue-200 dark:border-blue-800 text-xs font-bold text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/60 transition cursor-pointer disabled:opacity-60 self-start sm:self-auto"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
            <span>{isSyncing ? 'Menyinkronkan...' : 'Sync Portal Driver'}</span>
          </button>
        </div>

        {/* Bar Kontrol Sejajar di Bawah Tulisan Validasi Form Kirim: Kalender + Dropdown Area Kirim + Pencarian */}
        <div className="pt-3.5 border-t border-slate-100 dark:border-slate-800 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2.5">
            <ModernCalendarPicker
              value={selectedDate}
              onChange={setSelectedDate}
              align="left"
              highlightedDates={datesWithRecords}
            />
            <ModernAreaDropdown
              value={selectedArea}
              options={areaOptions}
              onChange={setSelectedArea}
              placeholder="Semua Area Kirim"
              allOptionLabel="Semua Area Kirim"
              countsByArea={countsByArea}
            />
          </div>

          <div className="relative w-full lg:w-72">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Cari form kirim, faktur, pelanggan, supir..."
              className="w-full pl-8 pr-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:border-blue-500"
            />
          </div>
        </div>
      </div>

      {/* Ringkasan Total Faktur Hari Itu Sesuai Form Kirim */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Total Tagihan Faktur
            </span>
            <span className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-[10px] font-bold text-slate-600 dark:text-slate-300">
              {formatIsoToLongIndonesian(selectedDate)}
            </span>
          </div>
          <div className="mt-2">
            <AccountingRupiah
              value={globalTotals.totalTagihan}
              className="!max-w-none !ml-0 text-base sm:text-lg"
              rpClassName="text-slate-400 font-bold text-xs sm:text-sm"
              amountClassName="font-black text-slate-900 dark:text-white"
            />
          </div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1.5">
            {filteredRecords.length} Form Kirim &middot; {globalTotals.totalFaktur} Faktur{selectedArea ? ` (${selectedArea})` : ''}
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-emerald-200/80 dark:border-emerald-900/50 rounded-2xl p-4 shadow-xs flex flex-col justify-between">
          <div className="text-[11px] font-bold uppercase tracking-wide text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
            <Banknote className="w-3.5 h-3.5" />
            <span>Total Tunai Diterima Driver</span>
          </div>
          <div className="mt-2">
            <AccountingRupiah
              value={globalTotals.totalTunaiDiterima}
              className="!max-w-none !ml-0 text-base sm:text-lg"
              rpClassName="text-emerald-500 font-bold text-xs sm:text-sm"
              amountClassName="font-black text-emerald-600 dark:text-emerald-400"
            />
          </div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1.5">
            Rekap uang tunai setoran kru hari terpilih
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-blue-200/80 dark:border-blue-900/50 rounded-2xl p-4 shadow-xs flex flex-col justify-between">
          <div className="text-[11px] font-bold uppercase tracking-wide text-blue-600 dark:text-blue-400 flex items-center gap-1.5">
            <Landmark className="w-3.5 h-3.5" />
            <span>Validasi Transfer (TF) &amp; TTD</span>
          </div>
          <div className="text-base sm:text-lg font-black text-blue-600 dark:text-blue-400 mt-2 tabular-nums">
            {globalTotals.validatedTfCount}/{globalTotals.totalTfCount} TF &middot; {globalTotals.validatedTtdCount}/{globalTotals.totalTtdCount} TTD
          </div>
          <div className="mt-1">
            <AccountingRupiah
              value={globalTotals.totalTfTagihan}
              className="!max-w-none !ml-0 text-[11px]"
              rpClassName="text-slate-400 font-semibold"
              amountClassName="font-bold text-slate-600 dark:text-slate-300"
            />
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-indigo-200/80 dark:border-indigo-900/50 rounded-2xl p-4 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-bold uppercase tracking-wide text-indigo-600 dark:text-indigo-400 flex items-center gap-1.5">
              <CheckSquare className="w-3.5 h-3.5" />
              <span>Validasi Sesuai &amp; Lunas Accurate</span>
            </span>
            <span className="text-[11px] font-black text-emerald-600 dark:text-emerald-400 tabular-nums">
              {settlementPercent}%
            </span>
          </div>
          <div className="text-sm sm:text-base font-black text-slate-900 dark:text-white mt-2 tabular-nums flex flex-wrap items-center gap-x-2 gap-y-0.5">
            <span className="text-sky-600 dark:text-sky-400">
              Sesuai: {globalTotals.matchedCheckedCount}/{globalTotals.totalFaktur}
            </span>
            <span className="text-slate-300 dark:text-slate-700">&bull;</span>
            <span className="text-emerald-600 dark:text-emerald-400">
              Lunas Accurate: {globalTotals.settlementCheckedCount}/{globalTotals.totalFaktur}
            </span>
          </div>
          <div className="mt-2 space-y-1">
            <div className="h-1.5 w-full rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-500 transition-all duration-300"
                style={{ width: `${settlementPercent}%` }}
              />
            </div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400">
              Checklist Validasi Sesuai &amp; Pelunasan di Accurate
            </div>
          </div>
        </div>
      </div>

      {/* Daftar Form Kirim Hari Terpilih & Area Terpilih */}
      <div className="space-y-4">
        {filteredRecords.length === 0 ? (
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-10 text-center space-y-2 shadow-xs">
            <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-400 flex items-center justify-center mx-auto">
              <CalendarDays className="w-6 h-6" />
            </div>
            <div className="text-sm font-bold text-slate-800 dark:text-white">
              Belum ada Form Kirim pada {formatIsoToLongIndonesian(selectedDate)}
              {selectedArea ? ` untuk Area ${selectedArea}` : ''}
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto">
              Pilih tanggal lain yang bertitik hijau pada kalender atau ubah pilihan Area Kirim untuk melihat manifest faktur lainnya.
            </p>
            {selectedArea && (
              <button
                type="button"
                onClick={() => setSelectedArea('')}
                className="mt-2 px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition cursor-pointer"
              >
                Tampilkan Semua Area di Tanggal Ini
              </button>
            )}
          </div>
        ) : (
          filteredRecords.map(item => {
            const metrics = computeRecordMetrics(item);
            const armadaMeta = resolveRecordArmadaMeta(item);
            const isExpanded = expandedIds[item.id] ?? true;
            const allMatched =
              metrics.totalInvoiceCount > 0 &&
              metrics.matchedCheckedCount === metrics.totalInvoiceCount;
            const allSettled =
              metrics.totalInvoiceCount > 0 &&
              metrics.settlementCheckedCount === metrics.totalInvoiceCount;

            return (
              <div
                key={item.id}
                className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden shadow-xs"
              >
                {/* Header Card Ringkas */}
                <div className="p-4 sm:p-5 bg-slate-50/70 dark:bg-slate-950/40 space-y-3.5">
                  <div className="flex flex-col md:flex-row md:items-start justify-between gap-3">
                    <div className="space-y-1.5 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                          {formatIsoToLongIndonesian(item.tanggalKirim)}
                        </span>
                        {item.areaKirim && (
                          <span className="px-2.5 py-0.5 rounded-lg bg-blue-500/15 text-blue-700 dark:text-blue-300 text-[11px] font-extrabold uppercase">
                            Area: {item.areaKirim}
                          </span>
                        )}
                        <span
                          className={`px-2.5 py-0.5 rounded-lg text-[11px] font-bold inline-flex items-center gap-1 ${
                            allMatched
                              ? 'bg-sky-100 dark:bg-sky-950/60 text-sky-700 dark:text-sky-300'
                              : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                          }`}
                        >
                          <CheckSquare className="w-3 h-3" />
                          <span>
                            Sesuai: {metrics.matchedCheckedCount}/{metrics.totalInvoiceCount}
                          </span>
                        </span>
                        <span
                          className={`px-2.5 py-0.5 rounded-lg text-[11px] font-bold inline-flex items-center gap-1 ${
                            allSettled
                              ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300'
                              : 'bg-amber-100 dark:bg-amber-950/50 text-amber-800 dark:text-amber-300'
                          }`}
                        >
                          <CheckSquare className="w-3 h-3" />
                          <span>
                            Lunas Accurate: {metrics.settlementCheckedCount}/{metrics.totalInvoiceCount}
                          </span>
                        </span>
                      </div>

                      <div className="text-sm sm:text-base font-black text-slate-900 dark:text-white">
                        {item.storeName}
                      </div>

                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-600 dark:text-slate-300">
                        <span className="inline-flex items-center gap-1.5 flex-wrap">
                          <Truck className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                          <strong className="text-slate-900 dark:text-white">{item.plateNumber}</strong>
                          {armadaMeta.armadaInitial && (
                            <span className="px-1.5 py-0.5 rounded bg-slate-200/80 dark:bg-slate-800 text-[10.5px] font-extrabold text-slate-700 dark:text-slate-200 uppercase">
                              {armadaMeta.armadaInitial}
                            </span>
                          )}
                          <span>
                            ({armadaMeta.driver || item.driverName}
                            {armadaMeta.helper ? ` / ${armadaMeta.helper}` : ''})
                          </span>
                        </span>
                        <span>
                          Progres Input Driver:{' '}
                          <strong className="text-slate-900 dark:text-white">
                            {metrics.completedByDriverCount} / {metrics.totalInvoiceCount} Faktur
                          </strong>
                        </span>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => toggleExpand(item.id)}
                        className="px-3.5 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 hover:border-blue-400 text-xs font-bold text-slate-700 dark:text-slate-200 inline-flex items-center justify-between gap-2 transition cursor-pointer shrink-0 shadow-2xs"
                      >
                        <span>
                          {isExpanded
                            ? `Tutup Rincian Faktur (${metrics.totalInvoiceCount})`
                            : `Lihat Rincian Faktur (${metrics.totalInvoiceCount})`}
                        </span>
                        {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </button>

                      {isSuperAdmin && (
                        <button
                          type="button"
                          onClick={() => {
                            formKirimStore.deleteFormKirim(item.id);
                            showFinanceToast(`Form Kirim "${item.storeName || item.noFormKirim}" berhasil dihapus.`);
                          }}
                          className="px-3 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/50 dark:hover:bg-rose-900/60 border border-rose-200 dark:border-rose-800/70 text-xs font-bold text-rose-600 dark:text-rose-400 inline-flex items-center gap-1.5 transition cursor-pointer shrink-0 shadow-2xs"
                          title="Hapus Form Kirim (Khusus Super Admin)"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Hapus</span>
                        </button>
                      )}
                    </div>
                  </div>

                  {/* 4 Kotak Ringkasan Per Form Kirim */}
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
                    <div className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                      <div className="text-[10px] font-bold text-slate-400 uppercase mb-1">Total Tagihan</div>
                      <AccountingRupiah
                        value={metrics.totalTagihan}
                        className="!max-w-none !ml-0 text-xs sm:text-sm"
                        rpClassName="text-slate-400 font-semibold text-[11px]"
                        amountClassName="font-black text-slate-900 dark:text-white"
                      />
                    </div>
                    <div className="p-3 rounded-xl bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/60">
                      <div className="text-[10px] font-bold text-emerald-700 dark:text-emerald-400 uppercase mb-1">
                        Tunai Diterima ({metrics.tunaiCount})
                      </div>
                      <AccountingRupiah
                        value={metrics.totalTunaiDiterima}
                        className="!max-w-none !ml-0 text-xs sm:text-sm"
                        rpClassName="text-emerald-600/80 dark:text-emerald-400/80 font-semibold text-[11px]"
                        amountClassName="font-black text-emerald-700 dark:text-emerald-300"
                      />
                    </div>
                    <div className="p-3 rounded-xl bg-blue-50/70 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900/60">
                      <div className="text-[10px] font-bold text-blue-700 dark:text-blue-400 uppercase mb-1">
                        Validasi TF &amp; TTD
                      </div>
                      <div className="text-xs sm:text-sm font-black text-blue-700 dark:text-blue-300 tabular-nums">
                        {metrics.tfValidatedCount}/{metrics.tfCount} TF &middot; {metrics.ttdValidatedCount}/{metrics.ttdCount} TTD
                      </div>
                      {metrics.tfNominalTagihan > 0 && (
                        <AccountingRupiah
                          value={metrics.tfNominalTagihan}
                          className="!max-w-none !ml-0 text-[10px] mt-0.5"
                          rpClassName="text-blue-600/70 font-semibold"
                          amountClassName="font-bold text-blue-700 dark:text-blue-300"
                        />
                      )}
                    </div>
                    <div className="p-3 rounded-xl bg-indigo-50/70 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-900/60">
                      <div className="text-[10px] font-bold text-indigo-700 dark:text-indigo-400 uppercase mb-1">
                        Sesuai &amp; Lunas Accurate
                      </div>
                      <div className="text-xs sm:text-sm font-black text-indigo-700 dark:text-indigo-300 tabular-nums">
                        {metrics.matchedCheckedCount}/{metrics.totalInvoiceCount} Sesuai &middot; {metrics.settlementCheckedCount}/{metrics.totalInvoiceCount} Lunas Accurate
                      </div>
                    </div>
                  </div>

                  {item.driverNotes && (
                    <div className="text-[11px] px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300">
                      <strong className="text-slate-800 dark:text-slate-200">Catatan Driver:</strong> {item.driverNotes}
                    </div>
                  )}
                </div>

                {/* Tabel Rincian Setiap Faktur: Validasi Sesuai & Checklist Lunas Accurate Terpisah */}
                {isExpanded && (
                  <div className="border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3 space-y-2.5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="text-xs font-bold text-slate-800 dark:text-slate-100">
                        Rincian Setoran, Validasi Sesuai &amp; Checklist Lunas Accurate ({metrics.totalInvoiceCount} Faktur)
                      </div>
                      <div className="flex flex-wrap items-center gap-1.5">
                        {metrics.tunaiCount > 0 && (
                          <button
                            type="button"
                            onClick={() =>
                              formKirimStore.validateAllByTypeFinance(item.id, 'tunai', true, validatorName)
                            }
                            className="px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-bold inline-flex items-center gap-1 cursor-pointer transition"
                          >
                            <Check className="w-3 h-3" />
                            <span>Validasi Semua Tunai ({metrics.tunaiCount})</span>
                          </button>
                        )}
                        {metrics.tfCount > 0 && (
                          <button
                            type="button"
                            onClick={() =>
                              formKirimStore.validateAllByTypeFinance(item.id, 'tf', true, validatorName)
                            }
                            className="px-2.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-[11px] font-bold inline-flex items-center gap-1 cursor-pointer transition"
                          >
                            <Landmark className="w-3 h-3" />
                            <span>Validasi Semua TF ({metrics.tfCount})</span>
                          </button>
                        )}
                        {metrics.ttdCount > 0 && (
                          <button
                            type="button"
                            onClick={() =>
                              formKirimStore.validateAllByTypeFinance(item.id, 'ttd', true, validatorName)
                            }
                            className="px-2.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-[11px] font-bold inline-flex items-center gap-1 cursor-pointer transition"
                          >
                            <PenTool className="w-3 h-3" />
                            <span>Validasi Semua TTD ({metrics.ttdCount})</span>
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() =>
                            formKirimStore.checkAllInvoicesMatchedByFinance(
                              item.id,
                              !allMatched,
                              validatorName
                            )
                          }
                          className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold inline-flex items-center gap-1.5 cursor-pointer transition ${
                            allMatched
                              ? 'bg-sky-600 text-white hover:bg-sky-500'
                              : 'bg-sky-50 dark:bg-sky-950/60 text-sky-700 dark:text-sky-300 border border-sky-300 dark:border-sky-800 hover:bg-sky-100'
                          }`}
                        >
                          <CheckSquare className="w-3.5 h-3.5" />
                          <span>
                            Validasi Semua Sesuai ({metrics.matchedCheckedCount}/{metrics.totalInvoiceCount})
                          </span>
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            formKirimStore.checkAllInvoicesSettlementByFinance(
                              item.id,
                              !allSettled,
                              validatorName
                            )
                          }
                          className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold inline-flex items-center gap-1.5 cursor-pointer transition ${
                            allSettled
                              ? 'bg-emerald-600 text-white hover:bg-emerald-500'
                              : 'bg-teal-600 text-white hover:bg-teal-500'
                          }`}
                        >
                          <CheckSquare className="w-3.5 h-3.5" />
                          <span>
                            Checklist Semua Lunas Accurate ({metrics.settlementCheckedCount}/{metrics.totalInvoiceCount})
                          </span>
                        </button>
                      </div>
                    </div>

                    <div className="w-full overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
                      <table className="w-full text-left border-collapse text-[11px]">
                        <thead>
                          <tr className="bg-slate-100 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 text-[10.5px] font-bold">
                            <th className="py-2 px-2 border-b border-slate-200 dark:border-slate-700 w-px whitespace-nowrap text-center">No</th>
                            <th className="py-2 px-2 border-b border-slate-200 dark:border-slate-700 w-px whitespace-nowrap">Faktur &amp; Jenis</th>
                            <th className="py-2 px-2 border-b border-slate-200 dark:border-slate-700 min-w-[180px]">Pelanggan</th>
                            <th className="py-2 px-2 border-b border-slate-200 dark:border-slate-700 text-right w-px whitespace-nowrap">
                              Nilai Faktur
                            </th>
                            <th className="py-2 px-2 border-b border-slate-200 dark:border-slate-700 text-right w-px whitespace-nowrap">
                              Nominal Diterima
                            </th>
                            <th className="py-2 px-1.5 border-b border-slate-200 dark:border-slate-700 text-center w-px whitespace-nowrap">
                              Validasi TF
                            </th>
                            <th className="py-2 px-1.5 border-b border-slate-200 dark:border-slate-700 text-center w-px whitespace-nowrap">
                              Validasi TTD
                            </th>
                            <th className="py-2 px-1.5 border-b border-slate-200 dark:border-slate-700 text-center w-px whitespace-nowrap">
                              Validasi Sesuai
                            </th>
                            <th className="py-2 px-1.5 border-b border-slate-200 dark:border-slate-700 text-center w-px whitespace-nowrap">
                              Checklist Lunas Accurate
                            </th>
                            {isSuperAdmin && (
                              <th className="py-2 px-1.5 border-b border-slate-200 dark:border-slate-700 text-center w-px whitespace-nowrap">
                                Aksi
                              </th>
                            )}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                          {metrics.items.length === 0 ? (
                            <tr
                              className={`align-middle transition-colors ${
                                item.financeSettlementChecked
                                  ? 'bg-emerald-50/60 dark:bg-emerald-950/20'
                                  : item.financeMatchedChecked
                                  ? 'bg-sky-50/50 dark:bg-sky-950/20'
                                  : 'hover:bg-slate-50 dark:hover:bg-slate-800/40'
                              }`}
                            >
                              <td className="py-2 px-2 text-slate-500 font-semibold tabular-nums text-center w-px">1</td>
                              <td className="py-2 px-2 whitespace-nowrap w-px">
                                <div className="font-bold text-slate-900 dark:text-white leading-tight">{item.noFaktur}</div>
                                <span className="mt-0.5 inline-block px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-[9.5px] font-bold text-slate-600 dark:text-slate-300">
                                  {item.metodePembayaran}
                                </span>
                              </td>
                              <td className="py-2 px-2 min-w-[180px] whitespace-normal break-words">
                                <div className="font-bold text-slate-900 dark:text-white leading-tight">{item.storeName}</div>
                                <div className="text-[10.5px] text-slate-500 dark:text-slate-400 leading-tight mt-0.5">
                                  {item.storeAddress || '-'}
                                </div>
                              </td>
                              <td className="py-2 px-2 whitespace-nowrap w-px">
                                <AccountingRupiah
                                  value={item.totalNominalFaktur}
                                  className="!min-w-[104px] !max-w-[118px] !gap-1.5"
                                />
                              </td>
                              <td className="py-2 px-2 whitespace-nowrap text-right w-px">
                                {Number(item.totalNominalDiterima) > 0 ? (
                                  <AccountingRupiah
                                    value={Number(item.totalNominalDiterima) || 0}
                                    className="!min-w-[104px] !max-w-[118px] !gap-1.5"
                                    rpClassName="text-emerald-500 font-semibold"
                                    amountClassName="font-black text-emerald-600 dark:text-emerald-400"
                                  />
                                ) : (
                                  <span className="text-[10.5px] text-slate-400 italic">Belum diinput</span>
                                )}
                              </td>
                              <td className="py-2 px-1.5 text-center text-slate-300 dark:text-slate-700 w-px">-</td>
                              <td className="py-2 px-1.5 text-center text-slate-300 dark:text-slate-700 w-px">-</td>
                              <td className="py-2 px-1.5 text-center whitespace-nowrap w-px">
                                <div className="flex flex-col items-center gap-0.5">
                                  <button
                                    type="button"
                                    onClick={() =>
                                      formKirimStore.toggleInvoiceMatchedCheck(
                                        item.id,
                                        '__single__',
                                        !item.financeMatchedChecked,
                                        validatorName
                                      )
                                    }
                                    className={`px-2 py-1 rounded-lg text-[10.5px] font-bold inline-flex items-center gap-1 border transition cursor-pointer ${
                                      item.financeMatchedChecked
                                        ? 'bg-sky-600 border-sky-600 text-white shadow-xs hover:bg-sky-500'
                                        : 'bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:border-sky-500 hover:text-sky-600'
                                    }`}
                                  >
                                    {item.financeMatchedChecked ? (
                                      <CheckSquare className="w-3.5 h-3.5 shrink-0" />
                                    ) : (
                                      <Square className="w-3.5 h-3.5 shrink-0 text-slate-400" />
                                    )}
                                    <span>Sesuai</span>
                                  </button>
                                  {item.financeMatchedChecked && item.financeMatchedCheckedBy && (
                                    <span className="text-[9.5px] text-sky-600 dark:text-sky-400 leading-tight">
                                      {item.financeMatchedCheckedBy}
                                      {item.financeMatchedCheckedAt
                                        ? ` · ${formatSignedTime(item.financeMatchedCheckedAt)}`
                                        : ''}
                                    </span>
                                  )}
                                </div>
                              </td>
                              <td className="py-2 px-1.5 text-center whitespace-nowrap w-px">
                                <div className="flex flex-col items-center gap-0.5">
                                  <button
                                    type="button"
                                    onClick={() =>
                                      formKirimStore.toggleInvoiceSettlementCheck(
                                        item.id,
                                        '__single__',
                                        !item.financeSettlementChecked,
                                        validatorName
                                      )
                                    }
                                    className={`px-2 py-1 rounded-lg text-[10.5px] font-bold inline-flex items-center gap-1 border transition cursor-pointer ${
                                      item.financeSettlementChecked
                                        ? 'bg-emerald-600 border-emerald-600 text-white shadow-xs hover:bg-emerald-500'
                                        : 'bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:border-emerald-500 hover:text-emerald-600'
                                    }`}
                                  >
                                    {item.financeSettlementChecked ? (
                                      <CheckSquare className="w-3.5 h-3.5 shrink-0" />
                                    ) : (
                                      <Square className="w-3.5 h-3.5 shrink-0 text-slate-400" />
                                    )}
                                    <span>Lunas Accurate</span>
                                  </button>
                                  {item.financeSettlementChecked && item.financeSettlementCheckedBy && (
                                    <span className="text-[9.5px] text-emerald-600 dark:text-emerald-400 leading-tight">
                                      {item.financeSettlementCheckedBy}
                                      {item.financeSettlementCheckedAt
                                        ? ` · ${formatSignedTime(item.financeSettlementCheckedAt)}`
                                        : ''}
                                    </span>
                                  )}
                                </div>
                              </td>
                              {isSuperAdmin && (
                                <td className="py-2 px-1.5 text-center whitespace-nowrap w-px">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      formKirimStore.deleteFormKirim(item.id);
                                      showFinanceToast(`Form Kirim "${item.noFaktur}" berhasil dihapus.`);
                                    }}
                                    className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/50 transition cursor-pointer"
                                    title="Hapus Faktur / Form Kirim (Super Admin)"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </td>
                              )}
                            </tr>
                          ) : (
                            metrics.items.map((inv, invIdx) => {
                              const isTempo = inv.paymentCategory === 'TEMPO' || Number(inv.netDays) > 0;
                              const isTf =
                                inv.metodeBayarAktual === 'Transfer' ||
                                String(inv.bayar || '').trim().toUpperCase() === 'TRANSFER';
                              const isTunai =
                                inv.metodeBayarAktual === 'Tunai' &&
                                (Number(inv.nominalDiterima) > 0 || Boolean(inv.isCombinedPayment));
                              const nominalRec = Number(inv.nominalDiterima) || 0;
                              const nilaiFaktur = Number(inv.nilaiFaktur) || 0;
                              const isBoldSbu = isNonGudangFaktur(inv.noFaktur);
                              const hasKet = Boolean((inv.keterangan || '').trim());
                              const isMatched = Boolean(inv.financeMatchedChecked);
                              const isSettled = Boolean(inv.financeSettlementChecked);

                              return (
                                <tr
                                  key={inv.id}
                                  className={`align-middle transition-colors ${
                                    isSettled
                                      ? 'bg-emerald-50/55 dark:bg-emerald-950/20'
                                      : isMatched
                                      ? 'bg-sky-50/45 dark:bg-sky-950/20'
                                      : 'hover:bg-slate-50 dark:hover:bg-slate-800/40'
                                  }`}
                                >
                                  <td className="py-1.5 px-2 text-slate-500 font-semibold tabular-nums text-center w-px">
                                    {invIdx + 1}
                                  </td>
                                  <td className="py-1.5 px-2 whitespace-nowrap w-px">
                                    <div
                                      className={`text-slate-900 dark:text-white leading-tight ${
                                        isBoldSbu ? 'font-black' : 'font-semibold'
                                      }`}
                                    >
                                      {inv.noFaktur}
                                    </div>
                                    <div className="flex items-center gap-1 mt-0.5">
                                      <span
                                        className={`px-1.5 py-0.5 rounded text-[9.5px] font-bold leading-none ${
                                          isTempo
                                            ? 'bg-indigo-100 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300'
                                            : 'bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300'
                                        }`}
                                      >
                                        {isTempo ? 'TEMPO' : 'COD'}
                                      </span>
                                      {inv.coly > 0 && (
                                        <span className="text-[9.5px] text-slate-500 whitespace-nowrap">{inv.coly} COLY</span>
                                      )}
                                      {inv.isCombinedPayment && (
                                        <span className="px-1 py-0.5 rounded bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 text-[9.5px] font-semibold leading-none">
                                          Gabungan
                                        </span>
                                      )}
                                    </div>
                                  </td>

                                  <td className="py-1.5 px-2 min-w-[180px] whitespace-normal break-words">
                                    <div className="font-bold text-slate-900 dark:text-white leading-tight">
                                      {inv.namaPelanggan}
                                    </div>
                                    <div className="text-[10.5px] text-slate-500 dark:text-slate-400 leading-tight mt-0.5">
                                      {inv.alamatPelanggan || '-'}
                                    </div>
                                    {hasKet && (
                                      <div className="mt-0.5 px-1.5 py-0.5 rounded bg-[#FFFF00] text-slate-950 text-[9.5px] font-bold inline-block leading-tight">
                                        Ket: {inv.keterangan}
                                      </div>
                                    )}
                                  </td>

                                  {/* Nilai Faktur: Rp rata kiri, nominal rata kanan, jarak rapat */}
                                  <td className="py-1.5 px-2 whitespace-nowrap w-px">
                                    <AccountingRupiah
                                      value={nilaiFaktur}
                                      className="!min-w-[104px] !max-w-[118px] !gap-1.5"
                                    />
                                  </td>

                                  <td className="py-1.5 px-2 text-right whitespace-nowrap w-px">
                                    {isTunai ? (
                                      <div className="space-y-0.5">
                                        {nominalRec === 0 && inv.isCombinedPayment ? (
                                          <div className="space-y-0.5 flex flex-col items-end">
                                            <span className="px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 text-[9.5px] font-bold">
                                              Tunai (Gabungan)
                                            </span>
                                            <div className="text-[9.5px] text-slate-500 leading-tight">
                                              Digabung ke faktur utama
                                            </div>
                                          </div>
                                        ) : (
                                          <>
                                            <AccountingRupiah
                                              value={nominalRec}
                                              className="!min-w-[104px] !max-w-[118px] !gap-1.5"
                                              rpClassName="text-emerald-500 font-semibold"
                                              amountClassName="font-black text-emerald-600 dark:text-emerald-400"
                                            />
                                            <div className="text-[9.5px] font-semibold text-slate-500 leading-tight">
                                              {Math.abs(nominalRec - nilaiFaktur) < 1
                                                ? 'Tunai Sesuai'
                                                : nominalRec < nilaiFaktur
                                                ? `Kurang Rp ${(nilaiFaktur - nominalRec).toLocaleString('id-ID', { maximumFractionDigits: 2 })}`
                                                : `Lebih Rp ${(nominalRec - nilaiFaktur).toLocaleString('id-ID', { maximumFractionDigits: 2 })}`}
                                            </div>
                                          </>
                                        )}
                                        <button
                                          type="button"
                                          onClick={() =>
                                            formKirimStore.validateInvoiceItemByFinance(
                                              item.id,
                                              inv.id,
                                              'tunai',
                                              !inv.financeTunaiValidated,
                                              validatorName
                                            )
                                          }
                                          className={`px-1.5 py-0.5 rounded text-[9.5px] font-bold transition cursor-pointer ${
                                            inv.financeTunaiValidated
                                              ? 'bg-emerald-600 text-white'
                                              : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-emerald-100'
                                          }`}
                                        >
                                          {inv.financeTunaiValidated ? '✓ Tunai Valid' : 'Validasi Tunai'}
                                        </button>
                                      </div>
                                    ) : isTf ? (
                                      <div className="space-y-0.5">
                                        <span className="px-1.5 py-0.5 rounded bg-blue-500/15 text-blue-700 dark:text-blue-300 text-[9.5px] font-bold">
                                          Transfer
                                        </span>
                                        <div className="text-[9.5px] text-slate-400 tabular-nums">
                                          Rp {nilaiFaktur.toLocaleString('id-ID', { maximumFractionDigits: 2 })}
                                        </div>
                                      </div>
                                    ) : inv.ttdDataUrl || inv.metodeBayarAktual === 'TTD' ? (
                                      <span className="px-1.5 py-0.5 rounded bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 text-[9.5px] font-bold">
                                        {isTempo ? 'Tempo (TTD)' : 'TTD'}
                                      </span>
                                    ) : (
                                      <span className="text-[10.5px] text-slate-400 italic">
                                        Belum diinput
                                      </span>
                                    )}
                                  </td>

                                  {/* Kolom Validasi TF */}
                                  <td className="py-1.5 px-1.5 text-center whitespace-nowrap w-px">
                                    {isTf ? (
                                      <div className="space-y-0.5 flex flex-col items-center">
                                        <button
                                          type="button"
                                          onClick={() =>
                                            formKirimStore.validateInvoiceItemByFinance(
                                              item.id,
                                              inv.id,
                                              'tf',
                                              !inv.financeTfValidated,
                                              validatorName
                                            )
                                          }
                                          className={`px-2 py-1 rounded-lg text-[10.5px] font-bold inline-flex items-center gap-1 transition cursor-pointer ${
                                            inv.financeTfValidated
                                              ? 'bg-emerald-600 text-white hover:bg-emerald-500'
                                              : 'bg-blue-600 text-white hover:bg-blue-500'
                                          }`}
                                        >
                                          <Check className="w-3 h-3" />
                                          <span>{inv.financeTfValidated ? 'TF Valid' : 'Validasi TF'}</span>
                                        </button>
                                        {inv.financeTfValidated && inv.financeTfValidatedBy && (
                                          <span className="text-[9.5px] text-emerald-600 dark:text-emerald-400">
                                            {inv.financeTfValidatedBy}
                                          </span>
                                        )}
                                      </div>
                                    ) : (
                                      <span className="text-slate-300 dark:text-slate-700">-</span>
                                    )}
                                  </td>

                                  {/* Kolom Validasi TTD */}
                                  <td className="py-1.5 px-1.5 text-center whitespace-nowrap w-px">
                                    {inv.ttdDataUrl ? (
                                      <div className="flex flex-col items-center gap-1">
                                        <button
                                          type="button"
                                          onClick={() =>
                                            setSignaturePreview({
                                              formKirimId: item.id,
                                              itemId: inv.id,
                                              noFormKirim: item.noFormKirim,
                                              noFaktur: inv.noFaktur,
                                              namaPelanggan: inv.namaPelanggan,
                                              nilaiFaktur,
                                              paymentCategory: isTempo ? 'TEMPO' : 'COD',
                                              ttdDataUrl: inv.ttdDataUrl!,
                                              ttdSignerName: inv.ttdSignerName || inv.namaPelanggan,
                                              ttdSignedAt: inv.ttdSignedAt,
                                              isValidated: Boolean(inv.financeTtdValidated)
                                            })
                                          }
                                          className="group relative rounded border border-slate-300 bg-white p-0.5 hover:border-blue-500 transition cursor-pointer"
                                          title="Klik untuk perbesar tanda tangan"
                                        >
                                          <img
                                            src={inv.ttdDataUrl}
                                            alt={`TTD ${inv.namaPelanggan}`}
                                            className="h-7 w-16 object-contain"
                                          />
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() =>
                                            formKirimStore.validateInvoiceItemByFinance(
                                              item.id,
                                              inv.id,
                                              'ttd',
                                              !inv.financeTtdValidated,
                                              validatorName
                                            )
                                          }
                                          className={`px-2 py-0.5 rounded text-[10px] font-bold inline-flex items-center gap-1 transition cursor-pointer ${
                                            inv.financeTtdValidated
                                              ? 'bg-emerald-600 text-white hover:bg-emerald-500'
                                              : 'bg-indigo-600 text-white hover:bg-indigo-500'
                                          }`}
                                        >
                                          <Check className="w-3 h-3" />
                                          <span>{inv.financeTtdValidated ? 'TTD Valid' : 'Validasi TTD'}</span>
                                        </button>
                                      </div>
                                    ) : (
                                      <span className="text-[10.5px] text-slate-400">
                                        {isTempo ? 'Tunggu TTD' : '-'}
                                      </span>
                                    )}
                                  </td>

                                  {/* Kolom 1: Checklist Validasi Sesuai */}
                                  <td className="py-1.5 px-1.5 text-center whitespace-nowrap w-px">
                                    <div className="flex flex-col items-center gap-0.5">
                                      <button
                                        type="button"
                                        onClick={() =>
                                          formKirimStore.toggleInvoiceMatchedCheck(
                                            item.id,
                                            inv.id,
                                            !isMatched,
                                            validatorName
                                          )
                                        }
                                        className={`px-2 py-1 rounded-lg text-[10.5px] font-bold inline-flex items-center gap-1 border transition cursor-pointer ${
                                          isMatched
                                            ? 'bg-sky-600 border-sky-600 text-white shadow-xs hover:bg-sky-500'
                                            : 'bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:border-sky-500 hover:text-sky-600'
                                        }`}
                                      >
                                        {isMatched ? (
                                          <CheckSquare className="w-3.5 h-3.5 shrink-0" />
                                        ) : (
                                          <Square className="w-3.5 h-3.5 shrink-0 text-slate-400" />
                                        )}
                                        <span>Sesuai</span>
                                      </button>
                                      {isMatched && inv.financeMatchedCheckedBy && (
                                        <span className="text-[9.5px] text-sky-600 dark:text-sky-400 leading-tight">
                                          {inv.financeMatchedCheckedBy}
                                          {inv.financeMatchedCheckedAt
                                            ? ` · ${formatSignedTime(inv.financeMatchedCheckedAt)}`
                                            : ''}
                                        </span>
                                      )}
                                    </div>
                                  </td>

                                  {/* Kolom 2: Checklist Lunas Accurate */}
                                  <td className="py-1.5 px-1.5 text-center whitespace-nowrap w-px">
                                    <div className="flex flex-col items-center gap-0.5">
                                      <button
                                        type="button"
                                        onClick={() =>
                                          formKirimStore.toggleInvoiceSettlementCheck(
                                            item.id,
                                            inv.id,
                                            !isSettled,
                                            validatorName
                                          )
                                        }
                                        className={`px-2 py-1 rounded-lg text-[10.5px] font-bold inline-flex items-center gap-1 border transition cursor-pointer ${
                                          isSettled
                                            ? 'bg-emerald-600 border-emerald-600 text-white shadow-xs hover:bg-emerald-500'
                                            : 'bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:border-emerald-500 hover:text-emerald-600'
                                        }`}
                                      >
                                        {isSettled ? (
                                          <CheckSquare className="w-3.5 h-3.5 shrink-0" />
                                        ) : (
                                          <Square className="w-3.5 h-3.5 shrink-0 text-slate-400" />
                                        )}
                                        <span>Lunas Accurate</span>
                                      </button>
                                      {isSettled && inv.financeSettlementCheckedBy && (
                                        <span className="text-[9.5px] text-emerald-600 dark:text-emerald-400 leading-tight">
                                          {inv.financeSettlementCheckedBy}
                                          {inv.financeSettlementCheckedAt
                                            ? ` · ${formatSignedTime(inv.financeSettlementCheckedAt)}`
                                            : ''}
                                        </span>
                                      )}
                                    </div>
                                  </td>
                                  {isSuperAdmin && (
                                    <td className="py-1.5 px-1.5 text-center whitespace-nowrap w-px">
                                      <button
                                        type="button"
                                        onClick={() => {
                                          formKirimStore.deleteInvoiceFromFormKirim(item.id, inv.id);
                                          showFinanceToast(`Faktur "${inv.noFaktur}" (${inv.namaPelanggan}) berhasil dihapus.`);
                                        }}
                                        className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/50 transition cursor-pointer"
                                        title="Hapus Baris Faktur (Super Admin)"
                                      >
                                        <Trash2 className="w-3.5 h-3.5" />
                                      </button>
                                    </td>
                                  )}
                                </tr>
                              );
                            })
                          )}
                        </tbody>
                        <tfoot>
                          <tr className="bg-slate-100 dark:bg-slate-800 font-bold text-slate-900 dark:text-white border-t-2 border-slate-300 dark:border-slate-700 text-[11px]">
                            <td colSpan={3} className="py-2 px-2">
                              TOTAL SEMUANYA ({metrics.totalInvoiceCount} Faktur)
                            </td>
                            <td className="py-2 px-2 whitespace-nowrap w-px">
                              <AccountingRupiah
                                value={metrics.totalTagihan}
                                className="!min-w-[104px] !max-w-[118px] !gap-1.5"
                              />
                            </td>
                            <td className="py-2 px-2 whitespace-nowrap w-px">
                              <AccountingRupiah
                                value={metrics.totalTunaiDiterima}
                                className="!min-w-[104px] !max-w-[118px] !gap-1.5"
                                rpClassName="text-emerald-600/80 font-semibold"
                                amountClassName="font-black text-emerald-600 dark:text-emerald-400"
                              />
                            </td>
                            <td className="py-2 px-1.5 text-center text-blue-600 dark:text-blue-400 whitespace-nowrap w-px">
                              {metrics.tfValidatedCount}/{metrics.tfCount} TF
                            </td>
                            <td className="py-2 px-1.5 text-center text-indigo-600 dark:text-indigo-400 whitespace-nowrap w-px">
                              {metrics.ttdValidatedCount}/{metrics.ttdCount} TTD
                            </td>
                            <td className="py-2 px-1.5 text-center text-sky-600 dark:text-sky-400 whitespace-nowrap w-px">
                              {metrics.matchedCheckedCount}/{metrics.totalInvoiceCount} Sesuai
                            </td>
                            <td className="py-2 px-1.5 text-center text-emerald-600 dark:text-emerald-400 whitespace-nowrap w-px">
                              {metrics.settlementCheckedCount}/{metrics.totalInvoiceCount} Lunas Accurate
                            </td>
                            {isSuperAdmin && <td className="py-2 px-1.5 w-px" />}
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Modal Preview & Validasi TTD Pelanggan */}
      {signaturePreview && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 space-y-3 shadow-2xl">
            <div className="flex items-start justify-between gap-2 pb-2 border-b border-slate-200 dark:border-slate-800">
              <div>
                <div className="text-sm font-black text-slate-900 dark:text-white">
                  Bukti Tanda Tangan Pelanggan
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  {signaturePreview.noFaktur} &middot; {signaturePreview.paymentCategory}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSignaturePreview(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="bg-slate-50 dark:bg-slate-950 rounded-xl p-3 border border-slate-200 dark:border-slate-800 space-y-1 text-xs">
              <div className="font-bold text-slate-900 dark:text-white">{signaturePreview.namaPelanggan}</div>
              <div className="flex items-center justify-between text-slate-600 dark:text-slate-300">
                <span>Penerima: <strong>{signaturePreview.ttdSignerName}</strong></span>
                <span className="font-bold tabular-nums">
                  Rp {signaturePreview.nilaiFaktur.toLocaleString('id-ID', { maximumFractionDigits: 2 })}
                </span>
              </div>
              {signaturePreview.ttdSignedAt && (
                <div className="text-[11px] text-slate-400">
                  Waktu TTD: {formatSignedTime(signaturePreview.ttdSignedAt)}
                </div>
              )}
            </div>

            <div className="bg-white border-2 border-dashed border-slate-300 rounded-xl p-3 flex items-center justify-center">
              <img
                src={signaturePreview.ttdDataUrl}
                alt="Preview Tanda Tangan"
                className="max-h-52 w-full object-contain"
              />
            </div>

            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                onClick={() => setSignaturePreview(null)}
                className="flex-1 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-bold cursor-pointer"
              >
                Tutup
              </button>
              <button
                type="button"
                onClick={() => {
                  const nextVal = !signaturePreview.isValidated;
                  formKirimStore.validateInvoiceItemByFinance(
                    signaturePreview.formKirimId,
                    signaturePreview.itemId,
                    'ttd',
                    nextVal,
                    validatorName
                  );
                  setSignaturePreview(prev => (prev ? { ...prev, isValidated: nextVal } : null));
                }}
                className={`flex-1 py-2.5 rounded-xl text-white text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer transition ${
                  signaturePreview.isValidated
                    ? 'bg-emerald-600 hover:bg-emerald-500'
                    : 'bg-indigo-600 hover:bg-indigo-500'
                }`}
              >
                <Check className="w-4 h-4" />
                <span>{signaturePreview.isValidated ? 'TTD Sudah Valid' : 'Tandai TTD Valid'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
