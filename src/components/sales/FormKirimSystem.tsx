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

  // State Pengaturan Pengiriman (otomatis tanggal hari ini WIB; area default 'Pilih Area')
  const [selectedBranchName] = useState<string>(() => branches[0]?.name || 'Banyuwangi');
  const [selectedAreaKirim, setSelectedAreaKirim] = useState<string>('');
  const [tanggalKirim, setTanggalKirim] = useState<string>(() => getTodayWibIso());
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

  // Items di dalam tabel Form Kirim aktif (COLY dikosongi / 0 secara default agar diinput Admin)
  const [invoiceItems, setInvoiceItems] = useState<FormKirimInvoiceItem[]>(() =>
    SAMPLE_NUSANTARA_ARGO_INVOICE_ITEMS.map(item => ({ ...item, coly: 0 }))
  );

  // Mode tampilan: 'edit' (Net Days tampil & bisa input COLY/tambah baris) vs 'saved_preview' (tampilan simpan tanpa Net Days & tanpa Aksi)
  const [viewMode, setViewMode] = useState<'edit' | 'saved_preview'>('edit');
  const [activeSavedRecordId, setActiveSavedRecordId] = useState<string | null>(null);

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
    const unsubForm = formKirimStore.subscribe(() => {
      setRecords(formKirimStore.getAll());
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

  // Pembagian otomatis pelanggan COD (Net Days = 0) dan TEMPO (Net Days > 0)
  const codItems = useMemo(() => {
    const rawCod = invoiceItems.filter(it => Number(it.netDays) <= 0);
    return sortItemsList(rawCod);
  }, [invoiceItems, sortField, sortDirection, tableSearch]);

  const tempoItems = useMemo(() => {
    const rawTempo = invoiceItems.filter(it => Number(it.netDays) > 0);
    return sortItemsList(rawTempo);
  }, [invoiceItems, sortField, sortDirection, tableSearch]);

  // Perhitungan SUM / Jumlah COLY dari seluruh faktur di area tersebut
  const summaryTotals = useMemo(() => {
    const codColy = codItems.reduce((acc, it) => acc + (Number(it.coly) || 0), 0);
    const tempoColy = tempoItems.reduce((acc, it) => acc + (Number(it.coly) || 0), 0);
    const codNilai = codItems.reduce((acc, it) => acc + (Number(it.nilaiFaktur) || 0), 0);
    const tempoNilai = tempoItems.reduce((acc, it) => acc + (Number(it.nilaiFaktur) || 0), 0);
    return {
      codCount: codItems.length,
      tempoCount: tempoItems.length,
      totalInvoices: codItems.length + tempoItems.length,
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
      // Default sesuai Gambar ke-2: No. Faktur | Tgl Faktur | Nama Pelanggan | Nilai Faktur | COLY | BAYAR | Alamat 1 | Keterangan | Net Days Syarat Pelanggan
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
            // 1. Cek kecocokan persis (exact match) sesuai urutan prioritas pattern
            for (const p of patterns) {
              const idx = lowerCells.findIndex((c: string, i: number) => !usedIndices.has(i) && c === p);
              if (idx !== -1) {
                usedIndices.add(idx);
                return idx;
              }
            }
            // 2. Cek kecocokan sebagian (substring) sesuai urutan prioritas pattern
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

        // Pelanggan COD: Net Days Syarat Pelanggan bernilai 0
        // Pelanggan TEMPO: memiliki nilai pada Net Days Syarat Pelanggan (> 0)
        const paymentCategory: 'COD' | 'TEMPO' = netDaysVal > 0 ? 'TEMPO' : 'COD';
        const isOtherSbu = isNonGudangFaktur(rawNoFaktur);

        // Kolom COLY dikosongi (0) terlebih dahulu agar diisi oleh Admin per faktur
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

      setExcelFileName(file.name);
      setExcelPreviewRows(parsedItems);
      setShowUploadPreview(true);
    } catch (err: any) {
      console.error('[Form Kirim Upload Error]', err);
      showToast(`Gagal membaca file: ${err?.message || 'Format tidak didukung'}`);
    }
  };

  // Simpan Form Kirim dari halaman Upload & Preview (tanpa keterangan area kirim pada label tombol)
  const handleSaveFromUploadPage = () => {
    if (!uploadDraftAreaKirim.trim()) {
      showToast('Silakan pilih Area Kirim terlebih dahulu sebelum menyimpan.');
      return;
    }

    const targetItems =
      excelPreviewRows.length > 0
        ? importMode === 'replace_all'
          ? excelPreviewRows
          : [...invoiceItems, ...excelPreviewRows]
        : invoiceItems;

    const saved = persistFormKirimToStore(targetItems, uploadDraftAreaKirim, uploadDraftTanggalKirim);
    if (!saved) return;

    setSelectedAreaKirim(uploadDraftAreaKirim);
    setTanggalKirim(uploadDraftTanggalKirim);
    if (excelPreviewRows.length > 0) {
      setInvoiceItems(targetItems);
    }

    setIsUploadExcelOpen(false);
    setExcelFileName('');
    setExcelPreviewRows([]);
    setShowUploadPreview(false);
  };

  // Download Template Excel persis sesuai Gambar ke-2 (9 kolom: No. Faktur .. Net Days Syarat Pelanggan)
  const handleDownloadUploadTemplate = () => {
    const sampleDate = formatExcelDateValue(uploadDraftTanggalKirim || tanggalKirim);
    const sourceRows =
      invoiceItems.length > 0
        ? invoiceItems
        : [
            {
              noFaktur: 'FJ02-1126-0799',
              tglFaktur: sampleDate,
              namaPelanggan: 'BP FREDDY KTPNG',
              nilaiFaktur: 2746062,
              bayar: '',
              alamatPelanggan: 'JL RAYA',
              keterangan: '',
              netDays: 30
            },
            {
              noFaktur: 'FJ02-1126-1080',
              tglFaktur: sampleDate,
              namaPelanggan: 'TK BELLIA',
              nilaiFaktur: 2725370,
              bayar: '',
              alamatPelanggan: 'SUMBER AYU',
              keterangan: '',
              netDays: 0
            },
            {
              noFaktur: 'FJ02-1126-1092',
              tglFaktur: sampleDate,
              namaPelanggan: 'TK ANEKA BARU',
              nilaiFaktur: 4741801,
              bayar: '',
              alamatPelanggan: 'JLN',
              keterangan: '',
              netDays: 7
            }
          ];

    const wsData: any[][] = [
      [
        'No. Faktur',
        'Tgl Faktur',
        'Nama Pelanggan',
        'Nilai Faktur',
        'COLY',
        'BAYAR',
        'Alamat 1',
        'Keterangan',
        'Net Days Syarat Pelanggan'
      ],
      ...sourceRows.map(it => [
        it.noFaktur,
        it.tglFaktur,
        it.namaPelanggan,
        it.nilaiFaktur,
        '',
        it.bayar,
        it.alamatPelanggan,
        it.keterangan,
        formatNetDaysDisplay(it.netDays)
      ])
    ];

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(wsData);
    ws['!cols'] = [
      { wch: 18 },
      { wch: 14 },
      { wch: 30 },
      { wch: 16 },
      { wch: 8 },
      { wch: 14 },
      { wch: 24 },
      { wch: 24 },
      { wch: 24 }
    ];
    XLSX.utils.book_append_sheet(wb, ws, 'Template Form Kirim');
    XLSX.writeFile(wb, 'Template_Form_Kirim.xlsx');
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

    setInvoiceItems(prev => {
      const idx = prev.findIndex(item => item.id === targetId);
      if (idx === -1) return [...prev, newRow];
      const next = [...prev];
      next.splice(idx + 1, 0, newRow);
      return next;
    });
  };

  // Tambah baris manual di dalam kelompok COD atau TEMPO dari sel NO pada baris header grup
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
    setInvoiceItems(prev => [...prev, newRow]);
  };

  const handleUpdateInvoiceCell = (id: string, field: keyof FormKirimInvoiceItem, value: any) => {
    setInvoiceItems(prev =>
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
    setInvoiceItems(prev => prev.filter(item => item.id !== id));
  };

  const persistFormKirimToStore = (
    itemsToSave: FormKirimInvoiceItem[],
    areaName: string,
    deliveryDate: string
  ): boolean => {
    const cleanArea = (areaName || '').trim().toUpperCase();
    if (!cleanArea) {
      showToast('Silakan pilih Area Kirim terlebih dahulu sebelum menyimpan.');
      return false;
    }

    if (itemsToSave.length === 0) {
      showToast('Tabel Form Kirim masih kosong. Silakan upload file atau tambah faktur manual terlebih dahulu.');
      return false;
    }

    const codRows = itemsToSave.filter(i => Number(i.netDays) <= 0);
    const tempoRows = itemsToSave.filter(i => Number(i.netDays) > 0);
    const totalColy = itemsToSave.reduce((acc, i) => acc + (Number(i.coly) || 0), 0);
    const codNilai = codRows.reduce((acc, i) => acc + (Number(i.nilaiFaktur) || 0), 0);
    const tempoNilai = tempoRows.reduce((acc, i) => acc + (Number(i.nilaiFaktur) || 0), 0);
    const totalNilai = codNilai + tempoNilai;

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
      storeName: `AREA ${cleanArea} (${codRows.length} COD • ${tempoRows.length} TEMPO)`,
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
      itemsSummary: `${itemsToSave.length} Faktur Sales (${codRows.length} Faktur COD • ${tempoRows.length} Faktur TEMPO)`,
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
      salesNotes: `Form Pengiriman/Sales Area ${cleanArea} (${codRows.length} COD, ${tempoRows.length} TEMPO, Total ${totalColy} COLY)`,
      invoiceItems: itemsToSave.map(it => ({ ...it })),
      codCount: codRows.length,
      tempoCount: tempoRows.length,
      codTotalNominal: codNilai,
      tempoTotalNominal: tempoNilai,
      financeStatus: 'approved_finance' as const,
      driverStatus: 'ready_for_driver' as const
    };

    if (activeSavedRecordId) {
      formKirimStore.updateFormKirim(activeSavedRecordId, payload);
      setViewMode('saved_preview');
      showToast(`Form Kirim Area ${cleanArea} berhasil disimpan (${itemsToSave.length} Faktur • Total COLY: ${totalColy}).`);
    } else {
      const created = formKirimStore.addFormKirim(payload);
      setActiveSavedRecordId(created.id);
      setViewMode('saved_preview');
      showToast(`Form Kirim Area ${cleanArea} berhasil disimpan (Total COLY: ${totalColy}).`);
    }
    return true;
  };

  // Simpan Form Kirim dari halaman tabel utama
  const handleSaveFormKirim = () => {
    persistFormKirimToStore(invoiceItems, selectedAreaKirim, tanggalKirim);
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
                  Pilih area kirim & tanggal pengiriman, lalu unggah file Excel faktur
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

          {/* Input File Excel */}
          <div className="space-y-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <label className="block text-[11px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
                FILE EXCEL FORM KIRIM (.XLSX / .XLS / .CSV)
              </label>
              <button
                type="button"
                onClick={handleDownloadUploadTemplate}
                className="px-3 py-1.5 rounded-xl bg-blue-50 dark:bg-blue-950/40 text-xs font-bold text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/50 flex items-center gap-1.5 transition cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Unduh Template Form Kirim</span>
              </button>
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
                    {excelFileName} ({excelPreviewRows.length} baris terbaca)
                  </span>
                </div>
              )}
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
                  <span className="px-2.5 py-0.5 rounded-full text-xs bg-yellow-300 text-[#000080] font-bold">
                    COD: {previewCodRows.length} (Net Days = 0)
                  </span>
                  <span className="px-2.5 py-0.5 rounded-full text-xs bg-amber-100 dark:bg-amber-900/40 text-amber-900 dark:text-amber-300 font-bold border border-amber-300 dark:border-amber-700">
                    TEMPO: {previewTempoRows.length} (Net Days &gt; 0)
                  </span>
                </h4>
              </div>

              <div className="overflow-x-auto rounded-2xl border border-slate-300 dark:border-slate-700 max-h-[420px]">
                <table className="w-full text-xs text-left border-collapse bg-white text-slate-900">
                  <thead className="bg-slate-50 text-[#000080] font-bold text-[11px] sticky top-0 z-10 border-b-2 border-slate-400">
                    <tr>
                      <th className="py-2 px-2 text-center border border-slate-300 w-10">NO</th>
                      <th className="py-2 px-2.5 border border-slate-300 min-w-[125px]">No. Faktur</th>
                      <th className="py-2 px-2.5 border border-slate-300 min-w-[96px]">Tgl Faktur</th>
                      <th className="py-2 px-2.5 border border-slate-300 min-w-[170px]">Nama Pelanggan</th>
                      <th className="py-2 px-2.5 text-right border border-slate-300 min-w-[125px]">Nilai Faktur</th>
                      <th className="py-2 px-2 text-center border border-slate-300 w-16">COLY</th>
                      <th className="py-2 px-2.5 border border-slate-300 min-w-[90px]">BAYAR</th>
                      <th className="py-2 px-2.5 border border-slate-300 min-w-[150px]">Alamat 1</th>
                      <th className="py-2 px-2.5 border border-slate-300 min-w-[140px]">Keterangan</th>
                      <th className="py-2 px-2 text-center border border-slate-300 w-24">Net Days Syarat Pelanggan</th>
                      <th className="py-2 px-2 text-center border border-slate-300 w-20">Kategori</th>
                    </tr>
                  </thead>
                  <tbody>
                    {previewCodRows.length > 0 && (
                      <tr>
                        <td colSpan={11} className="py-1 px-3 font-bold text-[#000080] bg-[#FFFF00] border border-slate-300">
                          COD (Net Days Syarat Pelanggan = 0)
                        </td>
                      </tr>
                    )}
                    {previewCodRows.map((row, idx) => {
                      const isRowBold = isNonGudangFaktur(row.noFaktur);
                      const hasKet = String(row.keterangan || '').trim().length > 0;
                      return (
                        <tr
                          key={row.id || `cod-${idx}`}
                          className={`hover:bg-blue-50/40 ${isRowBold ? 'font-bold' : 'font-normal'}`}
                        >
                          <td className="py-1.5 px-2 text-center border border-slate-300 align-middle">{idx + 1}</td>
                          <td className="py-1.5 px-2.5 border border-slate-300 whitespace-normal break-words align-middle">
                            {row.noFaktur}
                          </td>
                          <td className="py-1.5 px-2.5 border border-slate-300 whitespace-normal break-words align-middle">
                            {row.tglFaktur}
                          </td>
                          <td className="py-1.5 px-2.5 border border-slate-300 whitespace-normal break-words align-middle">
                            {row.namaPelanggan}
                          </td>
                          <td className="py-1.5 px-2.5 text-right border border-slate-300 whitespace-nowrap tabular-nums align-middle">
                            Rp {formatNominalRibuan(row.nilaiFaktur) || '0'}
                          </td>
                          <td className="py-1.5 px-2 text-center border border-slate-300 align-middle">
                            {row.coly > 0 ? row.coly : ''}
                          </td>
                          <td className="py-1.5 px-2.5 border border-slate-300 whitespace-normal break-words align-middle">
                            {row.bayar}
                          </td>
                          <td className="py-1.5 px-2.5 border border-slate-300 whitespace-normal break-words align-middle">
                            {row.alamatPelanggan}
                          </td>
                          <td
                            className={`py-1.5 px-2.5 border border-slate-300 whitespace-normal break-words align-middle ${
                              hasKet ? 'bg-[#FFFF00] font-semibold text-slate-950' : ''
                            }`}
                          >
                            {row.keterangan}
                          </td>
                          <td className="py-1.5 px-2 text-center font-mono border border-slate-300 align-middle">
                            {formatNetDaysDisplay(row.netDays)}
                          </td>
                          <td className="py-1.5 px-2 text-center border border-slate-300 align-middle">
                            <span className="px-2 py-0.5 rounded bg-[#FFFF00] text-[#000080] font-bold text-[10px]">
                              COD
                            </span>
                          </td>
                        </tr>
                      );
                    })}

                    {previewTempoRows.length > 0 && (
                      <tr>
                        <td colSpan={11} className="py-1 px-3 font-bold text-[#000080] bg-[#FFFF00] border border-slate-300">
                          TEMPO (Net Days Syarat Pelanggan &gt; 0)
                        </td>
                      </tr>
                    )}
                    {previewTempoRows.map((row, idx) => {
                      const isRowBold = isNonGudangFaktur(row.noFaktur);
                      const hasKet = String(row.keterangan || '').trim().length > 0;
                      return (
                        <tr
                          key={row.id || `tempo-${idx}`}
                          className={`hover:bg-blue-50/40 ${isRowBold ? 'font-bold' : 'font-normal'}`}
                        >
                          <td className="py-1.5 px-2 text-center border border-slate-300 align-middle">
                            {previewCodRows.length + idx + 1}
                          </td>
                          <td className="py-1.5 px-2.5 border border-slate-300 whitespace-normal break-words align-middle">
                            {row.noFaktur}
                          </td>
                          <td className="py-1.5 px-2.5 border border-slate-300 whitespace-normal break-words align-middle">
                            {row.tglFaktur}
                          </td>
                          <td className="py-1.5 px-2.5 border border-slate-300 whitespace-normal break-words align-middle">
                            {row.namaPelanggan}
                          </td>
                          <td className="py-1.5 px-2.5 text-right border border-slate-300 whitespace-nowrap tabular-nums align-middle">
                            Rp {formatNominalRibuan(row.nilaiFaktur) || '0'}
                          </td>
                          <td className="py-1.5 px-2 text-center border border-slate-300 align-middle">
                            {row.coly > 0 ? row.coly : ''}
                          </td>
                          <td className="py-1.5 px-2.5 border border-slate-300 whitespace-normal break-words align-middle">
                            {row.bayar}
                          </td>
                          <td className="py-1.5 px-2.5 border border-slate-300 whitespace-normal break-words align-middle">
                            {row.alamatPelanggan}
                          </td>
                          <td
                            className={`py-1.5 px-2.5 border border-slate-300 whitespace-normal break-words align-middle ${
                              hasKet ? 'bg-[#FFFF00] font-semibold text-slate-950' : ''
                            }`}
                          >
                            {row.keterangan}
                          </td>
                          <td className="py-1.5 px-2 text-center font-mono border border-slate-300 align-middle">
                            {formatNetDaysDisplay(row.netDays)}
                          </td>
                          <td className="py-1.5 px-2 text-center border border-slate-300 align-middle">
                            <span className="px-2 py-0.5 rounded bg-amber-200 text-amber-950 font-bold text-[10px]">
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

      {/* Header Bar */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 sm:p-5 space-y-4 shadow-xs">
        <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 text-white flex items-center justify-center shadow-sm shrink-0">
              <Send className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-base sm:text-lg font-black text-slate-900 dark:text-white tracking-tight">
                Form Kirim Barang
              </h1>
              <div className="flex flex-wrap items-center gap-2 mt-1 text-xs text-slate-500 dark:text-slate-400">
                <span>
                  {summaryTotals.codCount} COD &bull; {summaryTotals.tempoCount} TEMPO &bull; Total COLY:{' '}
                  <strong className="text-slate-900 dark:text-white">{summaryTotals.totalColy}</strong>
                </span>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <ModernAreaDropdown
              value={selectedAreaKirim}
              options={deliveryAreaOptions}
              onChange={setSelectedAreaKirim}
              placeholder="Pilih Area"
            />
            <ModernCalendarPicker value={tanggalKirim} onChange={setTanggalKirim} />

            <button
              type="button"
              onClick={() => {
                setUploadDraftAreaKirim(selectedAreaKirim);
                setUploadDraftTanggalKirim(tanggalKirim);
                setShowUploadPreview(false);
                setIsUploadExcelOpen(true);
              }}
              className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1.5 transition cursor-pointer shadow-xs"
            >
              <Upload className="w-4 h-4" />
              <span>Upload File Excel</span>
            </button>

            <button
              type="button"
              onClick={handleDownloadUploadTemplate}
              className="px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
              title="Unduh template Excel"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Template Excel</span>
            </button>

            <button
              type="button"
              onClick={handleSaveFormKirim}
              className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold flex items-center gap-1.5 transition cursor-pointer shadow-sm"
            >
              <Save className="w-4 h-4" />
              <span>Simpan Form Kirim</span>
            </button>
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
      {/* TABEL TEMPLATE FORM KIRIM (ANUGRAH KEMASAN KREATIF)                    */}
      {/* ===================================================================== */}
      <div className="bg-white text-slate-950 border-2 border-slate-400 rounded-xl shadow-sm overflow-hidden">
        {/* Kop Judul Spreadsheet: ANUGRAH KEMASAN KREATIF & Tanggal Pengiriman */}
        <div className="py-3 px-4 text-center border-b border-slate-300 bg-white space-y-0.5">
          <div className="text-sm sm:text-base font-normal tracking-wide text-slate-900 uppercase">
            ANUGRAH KEMASAN KREATIF
          </div>
          <div className="text-xs text-slate-800 font-medium">{formattedPeriodLabel}</div>
        </div>

        {/* Tabel Spreadsheet: Mode Edit menampilkan Net Days Syarat Pelanggan; Mode Simpan menyembunyikan Net Days */}
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-xs font-sans">
            <thead>
              <tr className="bg-white border-b-2 border-slate-800 text-[#000080] font-bold">
                <th className="border border-slate-700 py-2 px-1.5 text-center w-11">NO</th>
                <th
                  onClick={() => handleColumnSortToggle('noFaktur')}
                  className="border border-slate-700 py-2 px-2 text-center min-w-[132px] cursor-pointer hover:bg-blue-50/60 select-none"
                  title="Klik untuk sortir No. Faktur"
                >
                  <div className="flex items-center justify-center gap-1">
                    <span>No. Faktur</span>
                    {sortField === 'noFaktur' && (
                      <span className="text-[10px] text-blue-600">{sortDirection === 'asc' ? '▲' : '▼'}</span>
                    )}
                  </div>
                </th>
                <th className="border border-slate-700 py-2 px-2 text-center min-w-[96px]">Tgl Faktur</th>
                <th
                  onClick={() => handleColumnSortToggle('namaPelanggan')}
                  className="border border-slate-700 py-2 px-2.5 text-center min-w-[180px] cursor-pointer hover:bg-blue-50/60 select-none"
                  title="Klik untuk sortir Nama Pelanggan (A-Z / Z-A)"
                >
                  <div className="flex items-center justify-center gap-1">
                    <span>Nama Pelanggan</span>
                    {sortField === 'namaPelanggan' && (
                      <span className="text-[10px] text-blue-600">{sortDirection === 'asc' ? '▲' : '▼'}</span>
                    )}
                  </div>
                </th>
                <th
                  onClick={() => handleColumnSortToggle('nilaiFaktur')}
                  className="border border-slate-700 py-2 px-2.5 text-center min-w-[135px] cursor-pointer hover:bg-blue-50/60 select-none"
                  title="Klik untuk sortir Nilai Faktur (Besar ke Kecil / Kecil ke Besar)"
                >
                  <div className="flex items-center justify-center gap-1">
                    <span>Nilai Faktur</span>
                    {sortField === 'nilaiFaktur' && (
                      <span className="text-[10px] text-blue-600">{sortDirection === 'asc' ? '▲' : '▼'}</span>
                    )}
                  </div>
                </th>
                <th
                  onClick={() => handleColumnSortToggle('coly')}
                  className="border border-slate-700 py-2 px-2 text-center w-16 cursor-pointer hover:bg-blue-50/60 select-none"
                  title="Klik untuk sortir COLY (Besar ke Kecil / Kecil ke Besar)"
                >
                  <div className="flex items-center justify-center gap-1">
                    <span>COLY</span>
                    {sortField === 'coly' && (
                      <span className="text-[10px] text-blue-600">{sortDirection === 'asc' ? '▲' : '▼'}</span>
                    )}
                  </div>
                </th>
                <th className="border border-slate-700 py-2 px-2.5 text-center min-w-[96px]">BAYAR</th>
                <th
                  onClick={() => handleColumnSortToggle('alamatPelanggan')}
                  className="border border-slate-700 py-2 px-2.5 text-center min-w-[160px] cursor-pointer hover:bg-blue-50/60 select-none"
                  title="Klik untuk sortir Alamat Pelanggan"
                >
                  <div className="flex items-center justify-center gap-1">
                    <span>Alamat 1</span>
                    {sortField === 'alamatPelanggan' && (
                      <span className="text-[10px] text-blue-600">{sortDirection === 'asc' ? '▲' : '▼'}</span>
                    )}
                  </div>
                </th>
                <th className="border border-slate-700 py-2 px-2.5 text-center min-w-[155px]">Keterangan</th>
                {viewMode === 'edit' && (
                  <>
                    <th className="border border-slate-700 py-2 px-2 text-center w-24 whitespace-normal leading-tight">
                      Net Days Syarat Pelanggan
                    </th>
                    <th className="border border-slate-700 py-2 px-2 text-center w-14 bg-slate-50 text-slate-700">
                      Hapus
                    </th>
                  </>
                )}
              </tr>
            </thead>

            <tbody className="text-slate-950">
              {/* ========================================================= */}
              {/* BAGIAN 1: KELOMPOK PELANGGAN COD (Net Days = 0,00)        */}
              {/* ========================================================= */}
              <tr className="bg-white">
                <td className="border border-slate-600 py-1 px-1 text-center align-middle">
                  {viewMode === 'edit' ? (
                    <div className="group/secplus w-full h-5 flex items-center justify-center">
                      <button
                        type="button"
                        onClick={() => handleInsertManualRowInSection('COD')}
                        className="w-5 h-5 rounded-full bg-blue-600 text-white shadow-xs inline-flex items-center justify-center opacity-0 group-hover/secplus:opacity-100 focus:opacity-100 hover:scale-110 transition-all duration-150 cursor-pointer"
                        title="Tambah baris manual di kelompok COD"
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>
                  ) : (
                    <span>&nbsp;</span>
                  )}
                </td>
                <td className="border border-slate-600 py-1 px-2">&nbsp;</td>
                <td className="border border-slate-700 py-1 px-2 text-center font-bold text-[#000080] bg-[#FFFF00] tracking-wider uppercase">
                  COD
                </td>
                <td className="border border-slate-600 py-1 px-2">&nbsp;</td>
                <td className="border border-slate-600 py-1 px-2">&nbsp;</td>
                <td className="border border-slate-600 py-1 px-2">&nbsp;</td>
                <td className="border border-slate-600 py-1 px-2">&nbsp;</td>
                <td className="border border-slate-600 py-1 px-2">&nbsp;</td>
                <td className="border border-slate-600 py-1 px-2">&nbsp;</td>
                {viewMode === 'edit' && (
                  <>
                    <td className="border border-slate-600 py-1 px-2">&nbsp;</td>
                    <td className="border border-slate-600 py-1 px-2">&nbsp;</td>
                  </>
                )}
              </tr>

              {codItems.length === 0 ? (
                <tr>
                  <td
                    colSpan={viewMode === 'edit' ? 11 : 9}
                    className="border border-slate-600 py-3 px-3 text-center text-slate-400 italic"
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
                    <tr key={item.id} className={`hover:bg-blue-50/40 ${boldClass}`}>
                      {/* Kolom NO dengan tombol + tersamarkan: hanya muncul saat kursor diarahkan ke batas baris tersebut */}
                      <td className="border border-slate-600 py-1.5 px-1.5 text-center relative align-middle">
                        <span>{rowNum}</span>
                        {viewMode === 'edit' && (
                          <div className="group/rowplus absolute -bottom-2.5 inset-x-0 h-5 flex items-center justify-center z-20">
                            <button
                              type="button"
                              onClick={() => handleInsertManualRowAfter(item.id, 'COD')}
                              className="w-4 h-4 rounded-full bg-blue-600 text-white shadow-sm flex items-center justify-center opacity-0 group-hover/rowplus:opacity-100 focus:opacity-100 hover:scale-110 transition-all duration-150 cursor-pointer"
                              title={`Tambah baris manual setelah nomor ${rowNum}`}
                            >
                              <Plus className="w-2.5 h-2.5" />
                            </button>
                          </div>
                        )}
                      </td>
                      <td className="border border-slate-600 py-1 px-1.5 text-left whitespace-normal break-words align-middle">
                        {viewMode === 'edit' ? (
                          <AutoWrapCellTextarea
                            value={item.noFaktur}
                            placeholder="No. Faktur..."
                            onChange={val => handleUpdateInvoiceCell(item.id, 'noFaktur', val.toUpperCase())}
                            className={`uppercase ${boldClass}`}
                          />
                        ) : (
                          <div className="whitespace-normal break-words leading-snug">{item.noFaktur}</div>
                        )}
                      </td>
                      <td className="border border-slate-600 py-1 px-1.5 text-left whitespace-normal break-words align-middle">
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
                      <td className="border border-slate-600 py-1 px-2 text-left uppercase whitespace-normal break-words align-middle">
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
                      <td className="border border-slate-600 py-1 px-2 whitespace-nowrap align-middle">
                        <div className="flex items-center justify-between gap-2">
                          <span>Rp</span>
                          {viewMode === 'edit' ? (
                            <RupiahCellInput
                              value={item.nilaiFaktur}
                              onChange={num => handleUpdateInvoiceCell(item.id, 'nilaiFaktur', num)}
                              className={boldClass}
                            />
                          ) : (
                            <span className="tabular-nums">{formatNominalRibuan(item.nilaiFaktur) || '0'}</span>
                          )}
                        </div>
                      </td>
                      <td className="border border-slate-600 py-1 px-1.5 text-center align-middle">
                        {viewMode === 'edit' ? (
                          <input
                            type="number"
                            min={0}
                            value={item.coly > 0 ? item.coly : ''}
                            placeholder=""
                            onChange={e => {
                              const raw = e.target.value;
                              const num = raw === '' ? 0 : Math.max(0, Math.round(Number(raw) || 0));
                              handleUpdateInvoiceCell(item.id, 'coly', num);
                            }}
                            className={`w-14 text-center bg-transparent focus:outline-none focus:bg-yellow-50 ${boldClass}`}
                          />
                        ) : item.coly > 0 ? (
                          item.coly
                        ) : (
                          ''
                        )}
                      </td>
                      <td className="border border-slate-600 py-1 px-1.5 text-left whitespace-normal break-words align-middle">
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
                      <td className="border border-slate-600 py-1 px-2 text-left uppercase whitespace-normal break-words align-middle">
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
                        className={`border border-slate-600 py-1 px-2 text-left whitespace-normal break-words align-middle ${
                          hasKeterangan ? 'bg-[#FFFF00] font-semibold text-slate-950' : ''
                        }`}
                      >
                        {viewMode === 'edit' ? (
                          <AutoWrapCellTextarea
                            value={item.keterangan}
                            onChange={val => handleUpdateInvoiceCell(item.id, 'keterangan', val)}
                            className={`${boldClass} ${hasKeterangan ? 'focus:bg-yellow-200 font-semibold' : ''}`}
                          />
                        ) : (
                          <div className="whitespace-normal break-words leading-snug">{item.keterangan}</div>
                        )}
                      </td>
                      {viewMode === 'edit' && (
                        <>
                          <td className="border border-slate-600 py-1 px-2 text-center font-mono align-middle">
                            <input
                              type="number"
                              min={0}
                              step="1"
                              value={item.netDays}
                              onChange={e => handleUpdateInvoiceCell(item.id, 'netDays', e.target.value)}
                              className="w-16 text-center bg-transparent focus:outline-none focus:bg-yellow-50 font-mono"
                              title="0 = COD, > 0 = TEMPO"
                            />
                          </td>
                          <td className="border border-slate-600 py-1 px-1.5 text-center align-middle">
                            <button
                              type="button"
                              onClick={() => handleDeleteInvoiceRow(item.id)}
                              className="p-1 rounded text-rose-600 hover:bg-rose-50 cursor-pointer"
                              title="Hapus baris faktur"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </>
                      )}
                    </tr>
                  );
                })
              )}

              {/* ========================================================= */}
              {/* BAGIAN 2: KELOMPOK PELANGGAN TEMPO (Net Days > 0)         */}
              {/* ========================================================= */}
              <tr className="bg-white">
                <td className="border border-slate-600 py-1 px-1 text-center align-middle">
                  {viewMode === 'edit' ? (
                    <div className="group/secplus w-full h-5 flex items-center justify-center">
                      <button
                        type="button"
                        onClick={() => handleInsertManualRowInSection('TEMPO')}
                        className="w-5 h-5 rounded-full bg-blue-600 text-white shadow-xs inline-flex items-center justify-center opacity-0 group-hover/secplus:opacity-100 focus:opacity-100 hover:scale-110 transition-all duration-150 cursor-pointer"
                        title="Tambah baris manual di kelompok TEMPO"
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>
                  ) : (
                    <span>&nbsp;</span>
                  )}
                </td>
                <td className="border border-slate-600 py-1 px-2">&nbsp;</td>
                <td className="border border-slate-700 py-1 px-2 text-center font-bold text-[#000080] bg-[#FFFF00] tracking-wider uppercase">
                  TEMPO
                </td>
                <td className="border border-slate-600 py-1 px-2">&nbsp;</td>
                <td className="border border-slate-600 py-1 px-2">&nbsp;</td>
                <td className="border border-slate-600 py-1 px-2">&nbsp;</td>
                <td className="border border-slate-600 py-1 px-2">&nbsp;</td>
                <td className="border border-slate-600 py-1 px-2">&nbsp;</td>
                <td className="border border-slate-600 py-1 px-2">&nbsp;</td>
                {viewMode === 'edit' && (
                  <>
                    <td className="border border-slate-600 py-1 px-2">&nbsp;</td>
                    <td className="border border-slate-600 py-1 px-2">&nbsp;</td>
                  </>
                )}
              </tr>

              {tempoItems.length === 0 ? (
                <tr>
                  <td
                    colSpan={viewMode === 'edit' ? 11 : 9}
                    className="border border-slate-600 py-3 px-3 text-center text-slate-400 italic"
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
                    <tr key={item.id} className={`hover:bg-blue-50/40 ${boldClass}`}>
                      {/* Kolom NO dengan tombol + tersamarkan: hanya muncul saat kursor diarahkan ke batas baris tersebut */}
                      <td className="border border-slate-600 py-1.5 px-1.5 text-center relative align-middle">
                        <span>{rowNum}</span>
                        {viewMode === 'edit' && (
                          <div className="group/rowplus absolute -bottom-2.5 inset-x-0 h-5 flex items-center justify-center z-20">
                            <button
                              type="button"
                              onClick={() => handleInsertManualRowAfter(item.id, 'TEMPO')}
                              className="w-4 h-4 rounded-full bg-blue-600 text-white shadow-sm flex items-center justify-center opacity-0 group-hover/rowplus:opacity-100 focus:opacity-100 hover:scale-110 transition-all duration-150 cursor-pointer"
                              title={`Tambah baris manual setelah nomor ${rowNum}`}
                            >
                              <Plus className="w-2.5 h-2.5" />
                            </button>
                          </div>
                        )}
                      </td>
                      <td className="border border-slate-600 py-1 px-1.5 text-left whitespace-normal break-words align-middle">
                        {viewMode === 'edit' ? (
                          <AutoWrapCellTextarea
                            value={item.noFaktur}
                            placeholder="No. Faktur..."
                            onChange={val => handleUpdateInvoiceCell(item.id, 'noFaktur', val.toUpperCase())}
                            className={`uppercase ${boldClass}`}
                          />
                        ) : (
                          <div className="whitespace-normal break-words leading-snug">{item.noFaktur}</div>
                        )}
                      </td>
                      <td className="border border-slate-600 py-1 px-1.5 text-left whitespace-normal break-words align-middle">
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
                      <td className="border border-slate-600 py-1 px-2 text-left uppercase whitespace-normal break-words align-middle">
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
                      <td className="border border-slate-600 py-1 px-2 whitespace-nowrap align-middle">
                        <div className="flex items-center justify-between gap-2">
                          <span>Rp</span>
                          {viewMode === 'edit' ? (
                            <RupiahCellInput
                              value={item.nilaiFaktur}
                              onChange={num => handleUpdateInvoiceCell(item.id, 'nilaiFaktur', num)}
                              className={boldClass}
                            />
                          ) : (
                            <span className="tabular-nums">{formatNominalRibuan(item.nilaiFaktur) || '0'}</span>
                          )}
                        </div>
                      </td>
                      <td className="border border-slate-600 py-1 px-1.5 text-center align-middle">
                        {viewMode === 'edit' ? (
                          <input
                            type="number"
                            min={0}
                            value={item.coly > 0 ? item.coly : ''}
                            placeholder=""
                            onChange={e => {
                              const raw = e.target.value;
                              const num = raw === '' ? 0 : Math.max(0, Math.round(Number(raw) || 0));
                              handleUpdateInvoiceCell(item.id, 'coly', num);
                            }}
                            className={`w-14 text-center bg-transparent focus:outline-none focus:bg-yellow-50 ${boldClass}`}
                          />
                        ) : item.coly > 0 ? (
                          item.coly
                        ) : (
                          ''
                        )}
                      </td>
                      <td className="border border-slate-600 py-1 px-1.5 text-left whitespace-normal break-words align-middle">
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
                      <td className="border border-slate-600 py-1 px-2 text-left uppercase whitespace-normal break-words align-middle">
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
                        className={`border border-slate-600 py-1 px-2 text-left whitespace-normal break-words align-middle ${
                          hasKeterangan ? 'bg-[#FFFF00] font-semibold text-slate-950' : ''
                        }`}
                      >
                        {viewMode === 'edit' ? (
                          <AutoWrapCellTextarea
                            value={item.keterangan}
                            onChange={val => handleUpdateInvoiceCell(item.id, 'keterangan', val)}
                            className={`${boldClass} ${hasKeterangan ? 'focus:bg-yellow-200 font-semibold' : ''}`}
                          />
                        ) : (
                          <div className="whitespace-normal break-words leading-snug">{item.keterangan}</div>
                        )}
                      </td>
                      {viewMode === 'edit' && (
                        <>
                          <td className="border border-slate-600 py-1 px-2 text-center font-mono align-middle">
                            <input
                              type="number"
                              min={0}
                              step="1"
                              value={item.netDays}
                              onChange={e => handleUpdateInvoiceCell(item.id, 'netDays', e.target.value)}
                              className="w-16 text-center bg-transparent focus:outline-none focus:bg-yellow-50 font-mono"
                              title="0 = COD, > 0 = TEMPO"
                            />
                          </td>
                          <td className="border border-slate-600 py-1 px-1.5 text-center align-middle">
                            <button
                              type="button"
                              onClick={() => handleDeleteInvoiceRow(item.id)}
                              className="p-1 rounded text-rose-600 hover:bg-rose-50 cursor-pointer"
                              title="Hapus baris faktur"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
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
              <tr className="bg-white font-bold">
                <td className="border border-slate-600 py-1.5 px-2">&nbsp;</td>
                <td className="border border-slate-600 py-1.5 px-2">&nbsp;</td>
                <td className="border border-slate-600 py-1.5 px-2">&nbsp;</td>
                <td className="border border-slate-600 py-1.5 px-2.5">&nbsp;</td>
                <td className="border border-slate-600 py-1.5 px-2.5">&nbsp;</td>
                <td className="border border-slate-700 py-1.5 px-2 text-center text-sm font-black text-slate-950">
                  {summaryTotals.totalColy}
                </td>
                <td className="border border-slate-600 py-1.5 px-2">&nbsp;</td>
                <td className="border border-slate-600 py-1.5 px-2">&nbsp;</td>
                <td className="border border-slate-600 py-1.5 px-2">&nbsp;</td>
                {viewMode === 'edit' && (
                  <>
                    <td className="border border-slate-600 py-1.5 px-2">&nbsp;</td>
                    <td className="border border-slate-600 py-1.5 px-2">&nbsp;</td>
                  </>
                )}
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

  const currentUser = logisticsStore.getCurrentUser();
  const validatorName = currentUser?.fullName || 'Finance & Tax AKK';
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
      if (!trimmed || trimmed === '-') return;
      const canonical = standardizeAreaName(trimmed);
      if (!canonical || canonical === '-') return;
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
