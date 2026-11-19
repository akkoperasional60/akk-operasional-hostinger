import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import * as XLSX from 'xlsx';
import {
  AlertTriangle,
  ArrowLeft,
  Building2,
  Calendar,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  FileCheck2,
  FileSpreadsheet,
  MapPin,
  RefreshCw,
  Search,
  XCircle
} from 'lucide-react';
import { DriverShiftCheckin, Schedule } from '../types';
import { logisticsStore } from '../services/store';
import { branchStore } from '../services/branchStore';
import { standardizeAreaName } from '../utils/areaNormalizer';
import { getLocalDateStr } from '../services/driverReportService';
import { AdminScheduleWeek, getScheduleCalendarDateObj } from '../data/adminSchedule';

export type PortalScheduleValidationStatus = 'cocok' | 'tidak_cocok';

export interface PortalScheduleValidationRow {
  rowKey: string;
  date: string;
  branchId: string;
  branchName: string;
  crewName: string;
  status: PortalScheduleValidationStatus;
  mismatchReasonLabel?: string;
  mismatchFields: ('Peran' | 'Area' | 'Armada')[];
  mismatchDetails: string[];
  // Data dari Jadwal Resmi
  scheduleId?: string;
  scheduledRole?: 'driver' | 'helper';
  scheduledRoleLabel?: string;
  scheduledArea?: string;
  scheduledArmada?: string;
  // Data dari Portal Driver/Helper (untuk pencocokan & ekspor)
  shiftId?: string;
  portalTime?: string;
  portalRole?: 'driver' | 'helper';
  portalRoleLabel?: string;
  portalArea?: string;
  portalArmada?: string;
}

interface SchedulePortalValidationReportProps {
  initialDate?: string;
  initialBranchId?: string;
  onBack?: () => void;
  backLabel?: string;
}

const INDONESIAN_MONTHS = [
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

const INDONESIAN_MONTHS_SHORT = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'Mei',
  'Jun',
  'Jul',
  'Agu',
  'Sep',
  'Okt',
  'Nov',
  'Des'
];

const INDONESIAN_DAYS_SHORT = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];

function getAuthHeaders(): Record<string, string> {
  const headers: Record<string, string> = {};
  try {
    const token =
      localStorage.getItem('akk_session_token') ||
      localStorage.getItem('session_token') ||
      sessionStorage.getItem('akk_session_token') ||
      '';
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
      headers['x-akk-session-token'] = token;
    }
  } catch {}
  return headers;
}

function parseIndonesianDateStringToIso(dateStr?: string): string {
  const raw = String(dateStr || '').trim();
  if (!raw) return '';
  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) return raw.slice(0, 10);
  const parts = raw.split(/\s+/);
  if (parts.length >= 3) {
    const dayNum = parseInt(parts[0], 10);
    const monthIdx = INDONESIAN_MONTHS.findIndex(
      m => m.toLowerCase() === parts[1].toLowerCase()
    );
    const yearNum = parseInt(parts[2], 10);
    if (!isNaN(dayNum) && monthIdx >= 0 && !isNaN(yearNum)) {
      return `${yearNum}-${String(monthIdx + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
    }
  }
  return '';
}

function formatIsoToIndonesianDisplay(isoDate: string): string {
  const parts = String(isoDate || '').slice(0, 10).split('-').map(Number);
  if (parts.length !== 3 || parts.some(isNaN)) return isoDate;
  const [y, m, d] = parts;
  const dt = new Date(y, m - 1, d);
  if (isNaN(dt.getTime())) return isoDate;
  const dayName = INDONESIAN_DAYS_SHORT[dt.getDay()];
  const monthShort = INDONESIAN_MONTHS_SHORT[dt.getMonth()];
  return `${dayName}, ${String(d).padStart(2, '0')} ${monthShort} ${y}`;
}

function getScheduleIsoDate(s: Schedule): string {
  const calObj = getScheduleCalendarDateObj(s);
  if (calObj && !isNaN(calObj.getTime())) {
    return `${calObj.getFullYear()}-${String(calObj.getMonth() + 1).padStart(2, '0')}-${String(calObj.getDate()).padStart(2, '0')}`;
  }
  const raw = s.departureDate || s.returnDate || s.deliveryDate || s.createdAt || '';
  return String(raw).slice(0, 10);
}

function normalizeCrewMatch(nameA?: string, nameB?: string): boolean {
  const a = String(nameA || '').trim().toLowerCase();
  const b = String(nameB || '').trim().toLowerCase();
  if (!a || !b || a === '-' || b === '-' || a === 'tanpa helper' || b === 'tanpa helper') return false;
  if (a === b || a.includes(b) || b.includes(a)) return true;
  if (
    (a.includes('saiful') || a.includes('saifur')) &&
    (b.includes('saiful') || b.includes('saifur')) &&
    a.includes('rizal') &&
    b.includes('rizal')
  ) {
    return true;
  }
  const tokA = a.split(/\s+/).filter(t => t.length >= 4);
  const tokB = b.split(/\s+/).filter(t => t.length >= 4);
  return tokA.length > 0 && tokB.length > 0 && tokA[0] === tokB[0];
}

function normalizePlateClean(raw?: string): string {
  return String(raw || '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');
}

function formatFleetDisplay(initial?: string, plate?: string, armadaStr?: string): string {
  const cleanPlate = String(plate || '').trim();
  const cleanInitial = String(initial || '').trim();
  if (cleanInitial && cleanPlate && cleanPlate !== '-') {
    return `${cleanInitial} · ${cleanPlate}`;
  }
  if (cleanPlate && cleanPlate !== '-') return cleanPlate;
  if (armadaStr && armadaStr.trim() !== '-') return armadaStr.trim();
  return '-';
}

function doesFleetMatch(sch: Schedule, shift: DriverShiftCheckin): boolean {
  const fleets = logisticsStore.getFleets();
  const schFleetObj = sch.fleet || fleets.find(f => f.id === sch.fleetId);

  const schPlate = normalizePlateClean(schFleetObj?.plateNumber || sch.armada);
  const shiftPlate = normalizePlateClean(shift.plateNumber);
  if (
    schPlate &&
    shiftPlate &&
    (schPlate === shiftPlate || schPlate.includes(shiftPlate) || shiftPlate.includes(schPlate))
  ) {
    return true;
  }

  const schInit = normalizePlateClean(schFleetObj?.initialCode || sch.armada?.split('/')[0]);
  const shiftInit = normalizePlateClean(shift.fleetInitialCode);
  if (schInit && shiftInit && schInit === shiftInit) {
    return true;
  }

  if (sch.fleetId && shift.fleetId && sch.fleetId === shift.fleetId) {
    return true;
  }

  return false;
}

function convertManualWeeksToSchedules(weeks: AdminScheduleWeek[]): Schedule[] {
  const fleets = logisticsStore.getFleets();
  const converted: Schedule[] = [];

  weeks.forEach((week, wIdx) => {
    const days = Array.isArray(week?.days) ? week.days : [];
    days.forEach((day, dIdx) => {
      const dayIso = parseIndonesianDateStringToIso(day?.dateString);
      const deliveries = Array.isArray(day?.pengiriman) ? day.pengiriman : [];
      deliveries.forEach((item, pIdx) => {
        const depIso = String(item?.departureDateIso || dayIso || '').slice(0, 10);
        if (!depIso) return;
        const driverName = String(item?.driver || '').trim();
        const helper1Name = String(item?.helper || '').trim();
        const helper2Name = String(item?.helper2 || '').trim();
        const areaName = String(item?.area || '').trim();
        const armadaRaw = String(item?.armada || '').trim();
        if (!driverName && !helper1Name && !areaName && !armadaRaw) return;

        const armadaClean = normalizePlateClean(armadaRaw);
        const matchedFleet = fleets.find(f => {
          const p = normalizePlateClean(f.plateNumber);
          const init = normalizePlateClean(f.initialCode);
          return (
            (p && armadaClean && (armadaClean.includes(p) || p.includes(armadaClean))) ||
            (init && armadaClean && armadaClean === init)
          );
        });

        const schId = item?.id || `wk-${wIdx}-${dIdx}-${pIdx}-${depIso}`;
        converted.push({
          id: schId,
          trackingNumber: schId,
          fleetId: matchedFleet?.id || '',
          fleet: matchedFleet,
          armada: armadaRaw || matchedFleet?.initialCode || '',
          crewId: '',
          crew: driverName ? ({ id: '', name: driverName, role: 'driver', phone: '', status: 'active' } as any) : undefined,
          crewHelperId: '',
          crewHelper:
            helper1Name && helper1Name !== '-' && helper1Name.toLowerCase() !== 'tanpa helper'
              ? ({ id: '', name: helper1Name, role: 'helper', phone: '', status: 'active' } as any)
              : undefined,
          crewHelper2Id: '',
          crewHelper2:
            helper2Name && helper2Name !== '-' && helper2Name.toLowerCase() !== 'tanpa helper'
              ? ({ id: '', name: helper2Name, role: 'helper', phone: '', status: 'active' } as any)
              : undefined,
          backupCrewName: item?.backupCrewName || item?.backup || undefined,
          backupPosition: item?.backupPosition,
          storeId: '',
          areaName,
          originName: item?.branchId || undefined,
          departureDate: `${depIso}T${item?.departureTime || '07:30'}:00`,
          returnDate: item?.returnDateIso ? `${item.returnDateIso}T17:00:00` : `${depIso}T17:00:00`,
          status: 'scheduled',
          createdAt: `${depIso}T00:00:00.000Z`
        } as Schedule);
      });
    });
  });

  return converted;
}

// =========================================================================
// CUSTOM PORTAL CALENDAR PICKER (Redesign Item 2)
// =========================================================================
interface ValidationDatePickerProps {
  value: string;
  onChange: (nextIso: string) => void;
}

const ValidationDatePicker: React.FC<ValidationDatePickerProps> = ({ value, onChange }) => {
  const [isOpen, setIsOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const popoverRef = useRef<HTMLDivElement | null>(null);
  const [coords, setCoords] = useState<{ top: number; left: number }>({ top: 0, left: 0 });

  const parsedSelected = useMemo(() => {
    const parts = String(value || getLocalDateStr()).slice(0, 10).split('-').map(Number);
    if (parts.length === 3 && !parts.some(isNaN)) {
      return { year: parts[0], month: parts[1] - 1, day: parts[2] };
    }
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth(), day: now.getDate() };
  }, [value]);

  const [viewYear, setViewYear] = useState(parsedSelected.year);
  const [viewMonth, setViewMonth] = useState(parsedSelected.month);

  useEffect(() => {
    setViewYear(parsedSelected.year);
    setViewMonth(parsedSelected.month);
  }, [parsedSelected.year, parsedSelected.month]);

  const updatePosition = useCallback(() => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const popWidth = 288;
    const popHeight = 336;
    const spaceBelow = window.innerHeight - rect.bottom;
    const top =
      spaceBelow < popHeight && rect.top > popHeight
        ? Math.max(8, rect.top - popHeight - 6)
        : rect.bottom + 6;
    const left = Math.min(Math.max(8, rect.left), window.innerWidth - popWidth - 8);
    setCoords({ top, left });
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    updatePosition();
    const onScrollOrResize = () => updatePosition();
    const onClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        triggerRef.current &&
        !triggerRef.current.contains(target) &&
        popoverRef.current &&
        !popoverRef.current.contains(target)
      ) {
        setIsOpen(false);
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false);
    };
    window.addEventListener('resize', onScrollOrResize);
    window.addEventListener('scroll', onScrollOrResize, true);
    document.addEventListener('mousedown', onClickOutside);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('resize', onScrollOrResize);
      window.removeEventListener('scroll', onScrollOrResize, true);
      document.removeEventListener('mousedown', onClickOutside);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [isOpen, updatePosition]);

  const calendarCells = useMemo(() => {
    const firstDay = new Date(viewYear, viewMonth, 1).getDay();
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
    const daysInPrevMonth = new Date(viewYear, viewMonth, 0).getDate();
    const cells: Array<{
      iso: string;
      day: number;
      inCurrentMonth: boolean;
      isSunday: boolean;
    }> = [];

    for (let i = firstDay - 1; i >= 0; i--) {
      const d = daysInPrevMonth - i;
      const dt = new Date(viewYear, viewMonth - 1, d);
      const iso = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
      cells.push({ iso, day: d, inCurrentMonth: false, isSunday: dt.getDay() === 0 });
    }
    for (let d = 1; d <= daysInMonth; d++) {
      const dt = new Date(viewYear, viewMonth, d);
      const iso = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
      cells.push({ iso, day: d, inCurrentMonth: true, isSunday: dt.getDay() === 0 });
    }
    const remaining = 42 - cells.length;
    for (let d = 1; d <= remaining; d++) {
      const dt = new Date(viewYear, viewMonth + 1, d);
      const iso = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
      cells.push({ iso, day: d, inCurrentMonth: false, isSunday: dt.getDay() === 0 });
    }
    return cells;
  }, [viewYear, viewMonth]);

  const todayIso = getLocalDateStr();

  const shiftMonth = (delta: number) => {
    const dt = new Date(viewYear, viewMonth + delta, 1);
    setViewYear(dt.getFullYear());
    setViewMonth(dt.getMonth());
  };

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setIsOpen(prev => !prev)}
        aria-label="Pilih tanggal validasi"
        className={`inline-flex items-center gap-2 px-3 py-2 rounded-xl border text-xs font-semibold transition cursor-pointer whitespace-nowrap shrink-0 ${
          isOpen
            ? 'bg-blue-50 dark:bg-blue-500/15 border-blue-500 text-blue-700 dark:text-blue-300 ring-2 ring-blue-500/20'
            : 'bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 hover:border-slate-300 dark:hover:border-slate-700'
        }`}
      >
        <Calendar className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 shrink-0" />
        <span className="tabular-nums">{formatIsoToIndonesianDisplay(value)}</span>
        <ChevronDown
          className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-150 ${isOpen ? 'rotate-180 text-blue-500' : ''}`}
        />
      </button>

      {isOpen &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            ref={popoverRef}
            style={{ top: coords.top, left: coords.left }}
            className="fixed z-[9999] w-72 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-2xl p-3 animate-in fade-in zoom-in-95 duration-150"
          >
            {/* Header Nav */}
            <div className="flex items-center justify-between mb-2.5">
              <button
                type="button"
                onClick={() => shiftMonth(-1)}
                className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
                aria-label="Bulan sebelumnya"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <div className="text-xs font-bold text-slate-900 dark:text-white tracking-tight">
                {INDONESIAN_MONTHS[viewMonth]} {viewYear}
              </div>
              <button
                type="button"
                onClick={() => shiftMonth(1)}
                className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
                aria-label="Bulan berikutnya"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            {/* Day Headers */}
            <div className="grid grid-cols-7 gap-0.5 mb-1">
              {INDONESIAN_DAYS_SHORT.map((d, idx) => (
                <div
                  key={d}
                  className={`text-center text-[10px] font-bold py-1 ${
                    idx === 0 ? 'text-rose-500' : 'text-slate-400 dark:text-slate-500'
                  }`}
                >
                  {d}
                </div>
              ))}
            </div>

            {/* Day Grid */}
            <div className="grid grid-cols-7 gap-0.5">
              {calendarCells.map(cell => {
                const isSelected = cell.iso === value;
                const isToday = cell.iso === todayIso;
                return (
                  <button
                    key={cell.iso}
                    type="button"
                    onClick={() => {
                      onChange(cell.iso);
                      setIsOpen(false);
                    }}
                    className={`h-8 rounded-lg text-[11px] font-semibold tabular-nums flex items-center justify-center transition cursor-pointer ${
                      isSelected
                        ? 'bg-blue-600 text-white font-bold shadow-xs'
                        : isToday
                        ? 'bg-blue-50 dark:bg-blue-500/20 text-blue-700 dark:text-blue-300 ring-1 ring-inset ring-blue-400/60 font-bold'
                        : cell.inCurrentMonth
                        ? cell.isSunday
                          ? 'text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-500/15'
                          : 'text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
                        : 'text-slate-300 dark:text-slate-600 hover:bg-slate-50 dark:hover:bg-slate-800/50'
                    }`}
                  >
                    {cell.day}
                  </button>
                );
              })}
            </div>

            {/* Footer Actions */}
            <div className="mt-2.5 pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <button
                type="button"
                onClick={() => {
                  onChange(todayIso);
                  setIsOpen(false);
                }}
                className="px-2.5 py-1 rounded-lg text-[11px] font-bold text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-500/15 transition cursor-pointer"
              >
                Hari Ini
              </button>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="px-2.5 py-1 rounded-lg text-[11px] font-semibold text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
              >
                Tutup
              </button>
            </div>
          </div>,
          document.body
        )}
    </>
  );
};

// =========================================================================
// CUSTOM PORTAL BRANCH DROPDOWN (Redesign Item 3)
// =========================================================================
interface ValidationBranchOption {
  id: string;
  name: string;
  city?: string;
}

interface ValidationBranchDropdownProps {
  value: string;
  options: ValidationBranchOption[];
  onChange: (nextBranchId: string) => void;
}

const ValidationBranchDropdown: React.FC<ValidationBranchDropdownProps> = ({
  value,
  options,
  onChange
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const [coords, setCoords] = useState<{ top: number; left: number; width: number }>({
    top: 0,
    left: 0,
    width: 210
  });

  const activeOption = useMemo(
    () => options.find(o => o.id === value) || { id: 'all', name: 'Semua Cabang' },
    [options, value]
  );

  const updatePosition = useCallback(() => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const width = Math.max(rect.width, 210);
    const estHeight = Math.min(280, (options.length + 1) * 44 + 42);
    const spaceBelow = window.innerHeight - rect.bottom;
    const top =
      spaceBelow < estHeight && rect.top > estHeight
        ? Math.max(8, rect.top - estHeight - 6)
        : rect.bottom + 6;
    const left = Math.min(Math.max(8, rect.right - width), window.innerWidth - width - 8);
    setCoords({ top, left, width });
  }, [options.length]);

  useEffect(() => {
    if (!isOpen) return;
    updatePosition();
    const onScrollOrResize = () => updatePosition();
    const onClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        triggerRef.current &&
        !triggerRef.current.contains(target) &&
        menuRef.current &&
        !menuRef.current.contains(target)
      ) {
        setIsOpen(false);
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false);
    };
    window.addEventListener('resize', onScrollOrResize);
    window.addEventListener('scroll', onScrollOrResize, true);
    document.addEventListener('mousedown', onClickOutside);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('resize', onScrollOrResize);
      window.removeEventListener('scroll', onScrollOrResize, true);
      document.removeEventListener('mousedown', onClickOutside);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [isOpen, updatePosition]);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setIsOpen(prev => !prev)}
        aria-label="Filter cabang operasional"
        className={`inline-flex items-center justify-between gap-2 min-w-[165px] px-3 py-2 rounded-xl border text-xs font-semibold transition cursor-pointer whitespace-nowrap shrink-0 ${
          isOpen
            ? 'bg-blue-50 dark:bg-blue-500/15 border-blue-500 text-blue-700 dark:text-blue-300 ring-2 ring-blue-500/20'
            : 'bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 hover:border-slate-300 dark:hover:border-slate-700'
        }`}
      >
        <span className="inline-flex items-center gap-1.5 truncate">
          <Building2 className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400 shrink-0" />
          <span className="truncate">{activeOption.name}</span>
        </span>
        <ChevronDown
          className={`w-3.5 h-3.5 text-slate-400 shrink-0 transition-transform duration-150 ${isOpen ? 'rotate-180 text-blue-500' : ''}`}
        />
      </button>

      {isOpen &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            ref={menuRef}
            style={{ top: coords.top, left: coords.left, width: coords.width }}
            className="fixed z-[9999] rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-2xl p-1.5 animate-in fade-in zoom-in-95 duration-150"
          >
            <div className="px-2.5 py-1.5 text-[10px] font-bold text-slate-400 dark:text-slate-500 border-b border-slate-100 dark:border-slate-800 mb-1">
              Pilih Cabang Operasional
            </div>
            <div className="max-h-60 overflow-y-auto space-y-0.5">
              {[{ id: 'all', name: 'Semua Cabang', city: 'Seluruh wilayah operasional' }, ...options].map(
                opt => {
                  const isActive = opt.id === value;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => {
                        onChange(opt.id);
                        setIsOpen(false);
                      }}
                      className={`w-full flex items-center justify-between gap-2 px-2.5 py-2 rounded-xl text-left transition cursor-pointer ${
                        isActive
                          ? 'bg-blue-50 dark:bg-blue-500/20 text-blue-700 dark:text-blue-300'
                          : 'text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
                      }`}
                    >
                      <div className="min-w-0">
                        <div className="text-xs font-semibold truncate">{opt.name}</div>
                        {opt.city && (
                          <div className="text-[10px] text-slate-400 dark:text-slate-500 truncate">
                            {opt.city}
                          </div>
                        )}
                      </div>
                      {isActive && <Check className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 shrink-0" />}
                    </button>
                  );
                }
              )}
            </div>
          </div>,
          document.body
        )}
    </>
  );
};

// =========================================================================
// MAIN REPORT COMPONENT
// =========================================================================
export const SchedulePortalValidationReport: React.FC<SchedulePortalValidationReportProps> = ({
  initialDate,
  initialBranchId,
  onBack,
  backLabel = 'Kembali'
}) => {
  const [selectedDate, setSelectedDate] = useState<string>(initialDate || getLocalDateStr());
  const [selectedBranchId, setSelectedBranchId] = useState<string>(initialBranchId || 'all');
  const [statusFilter, setStatusFilter] = useState<'all' | PortalScheduleValidationStatus>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isSyncing, setIsSyncing] = useState<boolean>(true);

  // MySQL-authoritative state (no localStorage source)
  const [mysqlSchedules, setMysqlSchedules] = useState<Schedule[]>([]);
  const [mysqlShifts, setMysqlShifts] = useState<DriverShiftCheckin[]>([]);
  const [persistedMySqlRows, setPersistedMySqlRows] = useState<PortalScheduleValidationRow[]>([]);
  const [branches, setBranches] = useState(() => branchStore.getActiveBranches());

  const loadPersistedValidationFromMySql = useCallback(
    async (targetDate: string, targetBranchId: string) => {
      try {
        const qs = new URLSearchParams({ date: targetDate, branchId: targetBranchId || 'all' });
        const res = await fetch(`/api/portal-validations?${qs.toString()}`, {
          credentials: 'include',
          cache: 'no-store',
          headers: getAuthHeaders()
        });
        if (!res.ok) return;
        const data = await res.json();
        const latest = Array.isArray(data?.validations) ? data.validations[0] : null;
        if (latest && Array.isArray(latest.rows)) {
          setPersistedMySqlRows(latest.rows);
        } else {
          setPersistedMySqlRows([]);
        }
      } catch {
        setPersistedMySqlRows([]);
      }
    },
    []
  );

  const refreshAllFromMySql = useCallback(async () => {
    setIsSyncing(true);
    try {
      const headers = getAuthHeaders();
      const [schedulesRes, shiftsRes, validationsRes] = await Promise.all([
        fetch('/api/schedules/persisted', {
          credentials: 'include',
          cache: 'no-store',
          headers
        }),
        fetch('/api/driver-shifts', {
          credentials: 'include',
          cache: 'no-store',
          headers
        }),
        fetch(
          `/api/portal-validations?${new URLSearchParams({
            date: selectedDate,
            branchId: selectedBranchId || 'all'
          }).toString()}`,
          {
            credentials: 'include',
            cache: 'no-store',
            headers
          }
        )
      ]);

      // 1. Parse Schedules + Manual Weeks directly from MySQL (/api/schedules/persisted)
      if (schedulesRes.ok) {
        const payload = await schedulesRes.json();
        const deletedIds = new Set<string>(
          Array.isArray(payload?.deletedIds) ? payload.deletedIds.map((x: any) => String(x)) : []
        );
        const directSchedules: Schedule[] = (Array.isArray(payload?.schedules) ? payload.schedules : []).filter(
          (s: any) =>
            s &&
            typeof s === 'object' &&
            s.id &&
            !String(s.id).startsWith('batch-') &&
            !deletedIds.has(String(s.id))
        );

        const weekSchedules: Schedule[] = Array.isArray(payload?.weeks)
          ? convertManualWeeksToSchedules(payload.weeks).filter(s => !deletedIds.has(String(s.id)))
          : [];

        // Merge & deduplicate manual week entries with persisted schedule records
        const merged: Schedule[] = [...directSchedules];
        const sigSet = new Set<string>(
          directSchedules.map(s => {
            const dt = getScheduleIsoDate(s);
            const drv = String(s.crew?.name || '').trim().toLowerCase();
            const area = standardizeAreaName(s.areaName || s.store?.storeName || '').toLowerCase();
            const arm = normalizePlateClean(s.fleet?.plateNumber || s.armada);
            return `${dt}|${drv}|${area}|${arm}`;
          })
        );

        weekSchedules.forEach(ws => {
          const dt = getScheduleIsoDate(ws);
          const drv = String(ws.crew?.name || '').trim().toLowerCase();
          const area = standardizeAreaName(ws.areaName || '').toLowerCase();
          const arm = normalizePlateClean(ws.fleet?.plateNumber || ws.armada);
          const sig = `${dt}|${drv}|${area}|${arm}`;
          if (!sigSet.has(sig)) {
            sigSet.add(sig);
            merged.push(ws);
          }
        });

        setMysqlSchedules(merged);
      }

      // 2. Parse Driver/Helper Shifts directly from MySQL (/api/driver-shifts)
      if (shiftsRes.ok) {
        const shiftPayload = await shiftsRes.json();
        if (Array.isArray(shiftPayload?.shifts)) {
          setMysqlShifts(shiftPayload.shifts);
        }
      }

      // 3. Parse Saved Validation Snapshot directly from MySQL (/api/portal-validations)
      if (validationsRes.ok) {
        const valPayload = await validationsRes.json();
        const latest = Array.isArray(valPayload?.validations) ? valPayload.validations[0] : null;
        if (latest && Array.isArray(latest.rows)) {
          setPersistedMySqlRows(latest.rows);
        } else {
          setPersistedMySqlRows([]);
        }
      }

      setBranches([...branchStore.getActiveBranches()]);
    } catch {
      // Keep current MySQL state if transient network error
    } finally {
      setIsSyncing(false);
    }
  }, [selectedDate, selectedBranchId]);

  useEffect(() => {
    void loadPersistedValidationFromMySql(selectedDate, selectedBranchId);
  }, [selectedDate, selectedBranchId, loadPersistedValidationFromMySql]);

  useEffect(() => {
    void refreshAllFromMySql();

    // Auto-refresh from MySQL whenever manual schedule or driver shift is saved/updated
    let debounceTimer: ReturnType<typeof setTimeout> | null = null;
    const scheduleRefresh = () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        void refreshAllFromMySql();
      }, 450);
    };

    const unsubStore = logisticsStore.subscribe(scheduleRefresh);
    window.addEventListener('driver-shift-updated', scheduleRefresh);

    return () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      unsubStore();
      window.removeEventListener('driver-shift-updated', scheduleRefresh);
    };
  }, [refreshAllFromMySql]);

  const branchNameLookup = useMemo(() => {
    const map: Record<string, string> = {};
    branches.forEach(b => {
      map[b.id] = b.name;
    });
    return map;
  }, [branches]);

  const allValidationRows = useMemo<PortalScheduleValidationRow[]>(() => {
    const targetDate = selectedDate;
    const fleets = logisticsStore.getFleets();

    // 1. Shifts pada tanggal terpilih (dari MySQL)
    const shiftsOnDate = mysqlShifts.filter(s => {
      const sDate = (s.date || s.createdAt || '').slice(0, 10);
      return sDate === targetDate;
    });

    // 2. Jadwal Resmi & Jadwal Manual pada tanggal terpilih (dari MySQL)
    const schedulesOnDate = mysqlSchedules.filter(sch => getScheduleIsoDate(sch) === targetDate);

    // Jika tidak ada data live pada tanggal arsip, tampilkan snapshot validasi dari MySQL jika tersedia
    if (schedulesOnDate.length === 0 && shiftsOnDate.length === 0 && persistedMySqlRows.length > 0) {
      return persistedMySqlRows;
    }

    const matchedShiftIds = new Set<string>();
    const rows: PortalScheduleValidationRow[] = [];

    schedulesOnDate.forEach(sch => {
      const schBranchId = branchStore.getScheduleBranchId(sch.id, sch.originName, sch.fleetId);
      const schBranchName = branchNameLookup[schBranchId] || schBranchId;
      const schFleetObj = sch.fleet || fleets.find(f => f.id === sch.fleetId);
      const schArmadaLabel = formatFleetDisplay(schFleetObj?.initialCode, schFleetObj?.plateNumber, sch.armada);
      const schAreaRaw = (sch.areaName || sch.store?.city || sch.store?.storeName || '-').trim();
      const schAreaStd = standardizeAreaName(schAreaRaw);

      const slots: Array<{
        slotKey: string;
        crewName: string;
        role: 'driver' | 'helper';
        roleLabel: string;
      }> = [];

      const mainDriver = (sch.crew?.name || '').trim();
      if (mainDriver && mainDriver !== '-' && !mainDriver.toLowerCase().includes('driver armada terkait')) {
        slots.push({ slotKey: 'drv', crewName: mainDriver, role: 'driver', roleLabel: 'Driver' });
      }
      const helper1 = (sch.crewHelper?.name || '').trim();
      if (helper1 && helper1 !== '-' && helper1.toLowerCase() !== 'tanpa helper') {
        slots.push({ slotKey: 'hlp1', crewName: helper1, role: 'helper', roleLabel: 'Helper 1' });
      }
      const helper2 = (sch.crewHelper2?.name || '').trim();
      if (helper2 && helper2 !== '-' && helper2.toLowerCase() !== 'tanpa helper') {
        slots.push({ slotKey: 'hlp2', crewName: helper2, role: 'helper', roleLabel: 'Helper 2' });
      }
      if (sch.backupCrewName && sch.backupCrewName.trim() && sch.backupCrewName !== '-') {
        const bPos = sch.backupPosition === 'helper' || sch.backupPosition === 'helper2' ? 'helper' : 'driver';
        slots.push({
          slotKey: 'bkp',
          crewName: sch.backupCrewName.trim(),
          role: bPos,
          roleLabel: bPos === 'helper' ? 'Helper Pengganti' : 'Driver Pengganti'
        });
      }

      slots.forEach(slot => {
        const matchedShift = shiftsOnDate.find(s => normalizeCrewMatch(s.driverName, slot.crewName));
        if (matchedShift) {
          matchedShiftIds.add(matchedShift.id);
        }

        if (!matchedShift) {
          rows.push({
            rowKey: `${sch.id}-${slot.slotKey}`,
            date: targetDate,
            branchId: schBranchId,
            branchName: schBranchName,
            crewName: slot.crewName,
            status: 'tidak_cocok',
            mismatchReasonLabel: 'Belum Check-In Portal',
            mismatchFields: [],
            mismatchDetails: ['Kru belum melakukan Check-In Mandiri di Portal Driver/Helper hari ini.'],
            scheduleId: sch.id,
            scheduledRole: slot.role,
            scheduledRoleLabel: slot.roleLabel,
            scheduledArea: schAreaRaw,
            scheduledArmada: schArmadaLabel
          });
          return;
        }

        const portalRole: 'driver' | 'helper' =
          matchedShift.checkinRole ||
          (String(matchedShift.shiftName || matchedShift.notes || '').toLowerCase().includes('helper')
            ? 'helper'
            : 'driver');
        const portalAreaRaw = (matchedShift.selectedArea || '-').trim();
        const portalAreaStd = standardizeAreaName(portalAreaRaw);
        const portalArmadaLabel = formatFleetDisplay(matchedShift.fleetInitialCode, matchedShift.plateNumber);

        const mismatchFields: ('Peran' | 'Area' | 'Armada')[] = [];
        const mismatchDetails: string[] = [];

        if (portalRole !== slot.role) {
          mismatchFields.push('Peran');
          mismatchDetails.push(
            `Peran jadwal: ${slot.role === 'driver' ? 'Driver' : 'Helper'} vs Portal: ${
              portalRole === 'driver' ? 'Driver' : 'Helper'
            }`
          );
        }

        const areaMatched =
          Boolean(schAreaStd && portalAreaStd) &&
          (schAreaStd === portalAreaStd ||
            schAreaStd.toLowerCase().includes(portalAreaStd.toLowerCase()) ||
            portalAreaStd.toLowerCase().includes(schAreaStd.toLowerCase()));
        if (!areaMatched) {
          mismatchFields.push('Area');
          mismatchDetails.push(`Area jadwal: ${schAreaRaw} vs Portal: ${portalAreaRaw}`);
        }

        if (!doesFleetMatch(sch, matchedShift)) {
          mismatchFields.push('Armada');
          mismatchDetails.push(`Armada jadwal: ${schArmadaLabel} vs Portal: ${portalArmadaLabel}`);
        }

        rows.push({
          rowKey: `${sch.id}-${slot.slotKey}-${matchedShift.id}`,
          date: targetDate,
          branchId: schBranchId,
          branchName: schBranchName,
          crewName: slot.crewName,
          status: mismatchFields.length === 0 ? 'cocok' : 'tidak_cocok',
          mismatchReasonLabel: mismatchFields.length === 0 ? 'Cocok' : `Selisih: ${mismatchFields.join(', ')}`,
          mismatchFields,
          mismatchDetails,
          scheduleId: sch.id,
          scheduledRole: slot.role,
          scheduledRoleLabel: slot.roleLabel,
          scheduledArea: schAreaRaw,
          scheduledArmada: schArmadaLabel,
          shiftId: matchedShift.id,
          portalTime: matchedShift.checkinTimeFormatted,
          portalRole,
          portalRoleLabel: portalRole === 'driver' ? 'Driver' : 'Helper',
          portalArea: portalAreaRaw,
          portalArmada: portalArmadaLabel
        });
      });
    });

    // 3. Input Portal Driver/Helper yang belum ada di Jadwal Resmi hari terpilih
    shiftsOnDate.forEach(s => {
      if (matchedShiftIds.has(s.id)) return;
      const portalBranchId =
        branchStore.getFleetBranchId(s.fleetId || '', s.plateNumber, s.fleetInitialCode) ||
        branchStore.getCrewBranchId(s.driverId, s.driverName);
      const portalBranchName = branchNameLookup[portalBranchId] || portalBranchId;
      const portalRole: 'driver' | 'helper' =
        s.checkinRole ||
        (String(s.shiftName || s.notes || '').toLowerCase().includes('helper') ? 'helper' : 'driver');
      const portalAreaRaw = (s.selectedArea || '-').trim();
      const portalArmadaLabel = formatFleetDisplay(s.fleetInitialCode, s.plateNumber);

      rows.push({
        rowKey: `portal-only-${s.id}`,
        date: targetDate,
        branchId: portalBranchId,
        branchName: portalBranchName,
        crewName: s.driverName,
        status: 'tidak_cocok',
        mismatchReasonLabel: 'Belum Terjadwal Admin',
        mismatchFields: [],
        mismatchDetails: [
          `Sudah Check-In Portal (${portalRole === 'driver' ? 'Driver' : 'Helper'} · ${portalArmadaLabel} · ${portalAreaRaw}), belum ada di Jadwal Admin.`
        ],
        shiftId: s.id,
        portalTime: s.checkinTimeFormatted,
        portalRole,
        portalRoleLabel: portalRole === 'driver' ? 'Driver' : 'Helper',
        portalArea: portalAreaRaw,
        portalArmada: portalArmadaLabel
      });
    });

    const rank: Record<PortalScheduleValidationStatus, number> = {
      tidak_cocok: 0,
      cocok: 1
    };
    return rows.sort((a, b) => rank[a.status] - rank[b.status] || a.crewName.localeCompare(b.crewName, 'id'));
  }, [selectedDate, mysqlSchedules, mysqlShifts, persistedMySqlRows, branchNameLookup]);

  const branchFilteredRows = useMemo(() => {
    if (selectedBranchId === 'all') return allValidationRows;
    return allValidationRows.filter(r => r.branchId === selectedBranchId);
  }, [allValidationRows, selectedBranchId]);

  const kpiStats = useMemo(() => {
    return {
      total: branchFilteredRows.length,
      cocok: branchFilteredRows.filter(r => r.status === 'cocok').length,
      tidakCocok: branchFilteredRows.filter(r => r.status === 'tidak_cocok').length
    };
  }, [branchFilteredRows]);

  const saveValidationSnapshotToMySql = useCallback(async () => {
    if (branchFilteredRows.length === 0) return;
    try {
      const currentUser = logisticsStore.getCurrentUser();
      await fetch('/api/portal-validations', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({
          id: `VAL-${selectedDate}-${selectedBranchId || 'all'}`,
          validationDate: selectedDate,
          branchId: selectedBranchId || 'all',
          cocokCount: kpiStats.cocok,
          tidakCocokCount: kpiStats.tidakCocok,
          totalCount: kpiStats.total,
          rows: branchFilteredRows,
          validatedBy: currentUser?.fullName || 'Admin Operasional'
        })
      });
    } catch {}
  }, [branchFilteredRows, selectedDate, selectedBranchId, kpiStats.cocok, kpiStats.tidakCocok, kpiStats.total]);

  useEffect(() => {
    if (branchFilteredRows.length === 0 || isSyncing) return;
    const timer = setTimeout(() => {
      void saveValidationSnapshotToMySql();
    }, 600);
    return () => clearTimeout(timer);
  }, [saveValidationSnapshotToMySql, branchFilteredRows.length, isSyncing]);

  const filteredRows = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return branchFilteredRows.filter(r => {
      if (statusFilter !== 'all' && r.status !== statusFilter) return false;
      if (!q) return true;
      return (
        r.crewName.toLowerCase().includes(q) ||
        (r.scheduledArea || '').toLowerCase().includes(q) ||
        (r.portalArea || '').toLowerCase().includes(q) ||
        (r.scheduledArmada || '').toLowerCase().includes(q) ||
        (r.portalArmada || '').toLowerCase().includes(q)
      );
    });
  }, [branchFilteredRows, statusFilter, searchQuery]);

  const handleExportExcel = () => {
    if (filteredRows.length === 0) return;
    const sheetData = filteredRows.map((r, idx) => ({
      No: idx + 1,
      Tanggal: r.date,
      Cabang: r.branchName,
      'Nama Kru': r.crewName,
      'Peran Jadwal': r.scheduledRoleLabel || '-',
      'Area Jadwal': r.scheduledArea || '-',
      'Armada Jadwal': r.scheduledArmada || '-',
      'Jam Check-In': r.portalTime || '-',
      'Status Validasi':
        r.status === 'cocok'
          ? 'Cocok'
          : `Tidak Cocok (${r.mismatchReasonLabel || 'Selisih'})`,
      'Keterangan / Selisih': r.mismatchDetails.join(' | ') || 'Sesuai Jadwal'
    }));

    const ws = XLSX.utils.json_to_sheet(sheetData);
    ws['!cols'] = [
      { wch: 5 },
      { wch: 13 },
      { wch: 16 },
      { wch: 26 },
      { wch: 15 },
      { wch: 24 },
      { wch: 24 },
      { wch: 14 },
      { wch: 30 },
      { wch: 48 }
    ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Validasi Portal');
    XLSX.writeFile(wb, `validasi-portal-driver-helper-${selectedDate}.xlsx`);
  };

  return (
    <div className="space-y-3 animate-in fade-in duration-200">
      {/* Header Card */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div className="flex items-start sm:items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-500/15 border border-indigo-200 dark:border-indigo-500/30 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
            <FileCheck2 className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white tracking-tight">
              Validasi Portal Driver &amp; Helper
            </h2>
            <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
              Perbandingan kesesuaian Jadwal Pengiriman dengan Check-In Portal Driver &amp; Helper.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap shrink-0">
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold border border-slate-200 dark:border-slate-700 transition cursor-pointer whitespace-nowrap shrink-0"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>{backLabel}</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => void refreshAllFromMySql()}
            disabled={isSyncing}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold border border-slate-200 dark:border-slate-700 transition cursor-pointer disabled:opacity-50 whitespace-nowrap shrink-0"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin text-blue-500' : ''}`} />
            <span>{isSyncing ? 'Menyegarkan...' : 'Segarkan'}</span>
          </button>

          <button
            type="button"
            onClick={handleExportExcel}
            disabled={filteredRows.length === 0}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-200 dark:disabled:bg-slate-800 text-white disabled:text-slate-400 text-xs font-bold shadow-xs transition cursor-pointer disabled:cursor-not-allowed whitespace-nowrap shrink-0"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span>Export Excel</span>
          </button>
        </div>
      </div>

      {/* KPI Cards (Ringkas: Total Diperiksa, Cocok, Tidak Cocok) */}
      <div className="grid grid-cols-3 gap-2.5">
        <button
          type="button"
          onClick={() => setStatusFilter('all')}
          className={`p-3 rounded-xl border text-left transition cursor-pointer ${
            statusFilter === 'all'
              ? 'bg-blue-50 dark:bg-blue-500/15 border-blue-400 dark:border-blue-500/50'
              : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-slate-300'
          }`}
        >
          <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">Total Diperiksa</div>
          <div className="text-xl font-bold text-slate-900 dark:text-white mt-0.5 tabular-nums">{kpiStats.total}</div>
        </button>

        <button
          type="button"
          onClick={() => setStatusFilter('cocok')}
          className={`p-3 rounded-xl border text-left transition cursor-pointer ${
            statusFilter === 'cocok'
              ? 'bg-emerald-50 dark:bg-emerald-500/15 border-emerald-400 dark:border-emerald-500/50'
              : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-emerald-300'
          }`}
        >
          <div className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-400 flex items-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Cocok</span>
          </div>
          <div className="text-xl font-bold text-emerald-600 dark:text-emerald-400 mt-0.5 tabular-nums">{kpiStats.cocok}</div>
        </button>

        <button
          type="button"
          onClick={() => setStatusFilter('tidak_cocok')}
          className={`p-3 rounded-xl border text-left transition cursor-pointer ${
            statusFilter === 'tidak_cocok'
              ? 'bg-rose-50 dark:bg-rose-500/15 border-rose-400 dark:border-rose-500/50'
              : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-rose-300'
          }`}
        >
          <div className="text-[11px] font-semibold text-rose-700 dark:text-rose-400 flex items-center gap-1">
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>Tidak Cocok</span>
          </div>
          <div className="text-xl font-bold text-rose-600 dark:text-rose-400 mt-0.5 tabular-nums">{kpiStats.tidakCocok}</div>
        </button>
      </div>

      {/* Filter Bar */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-3 shadow-xs flex flex-col md:flex-row md:items-center gap-2.5">
        <div className="relative flex-1 min-w-0">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            id="validation-portal-search"
            name="validationPortalSearch"
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Cari nama kru, area kiriman, atau plat armada..."
            aria-label="Cari nama kru, area kiriman, atau plat armada"
            className="w-full pl-10 pr-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-blue-500"
          />
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">Tanggal:</span>
            <ValidationDatePicker value={selectedDate} onChange={setSelectedDate} />
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">Cabang:</span>
            <ValidationBranchDropdown
              value={selectedBranchId}
              options={branches.map(b => ({ id: b.id, name: b.name, city: b.city }))}
              onChange={setSelectedBranchId}
            />
          </div>
        </div>
      </div>

      {/* Compact Comparison Table (Tanpa Input Check-In Portal & Tanpa Progres Lapangan) */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xs overflow-hidden">
        {isSyncing && filteredRows.length === 0 ? (
          <div className="p-4 space-y-2">
            {[1, 2, 3, 4].map(n => (
              <div
                key={n}
                className="h-10 rounded-lg bg-slate-100 dark:bg-slate-800/70 animate-pulse"
              />
            ))}
          </div>
        ) : filteredRows.length === 0 ? (
          <div className="py-10 px-4 text-center space-y-1.5">
            <FileCheck2 className="w-8 h-8 text-slate-400 mx-auto" />
            <div className="text-sm font-bold text-slate-700 dark:text-slate-200">
              Belum Ada Data Jadwal maupun Check-In Portal pada {formatIsoToIndonesianDisplay(selectedDate)}
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto">
              Pilih tanggal lain atau pastikan jadwal pengiriman sudah diinput dan Driver/Helper sudah melakukan Check-In Mandiri di Portal.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-950/90 border-b border-slate-200 dark:border-slate-800 text-[11px] font-bold text-slate-500 dark:text-slate-400">
                  <th className="py-2 px-3">Kru &amp; Cabang</th>
                  <th className="py-2 px-3">Jadwal Resmi (Admin)</th>
                  <th className="py-2 px-3">Status Validasi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
                {filteredRows.map(row => (
                  <tr
                    key={row.rowKey}
                    className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors align-middle"
                  >
                    <td className="py-1.5 px-3">
                      <div className="font-bold text-slate-900 dark:text-white leading-tight">
                        {row.crewName}
                      </div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400 leading-tight mt-0.5 flex items-center gap-1.5 flex-wrap">
                        <span>{row.branchName}</span>
                        {row.portalTime && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span className="font-mono tabular-nums text-emerald-600 dark:text-emerald-400">
                              Check-In {row.portalTime}
                            </span>
                          </>
                        )}
                      </div>
                    </td>

                    <td className="py-1.5 px-3">
                      {row.scheduleId ? (
                        <div className="space-y-0.5 leading-tight">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                              {row.scheduledRoleLabel}
                            </span>
                            <span aria-hidden="true" className="text-slate-300 dark:text-slate-600">·</span>
                            <span className="font-mono tabular-nums font-bold text-blue-600 dark:text-blue-400">
                              {row.scheduledArmada}
                            </span>
                          </div>
                          <div className="text-[11px] text-slate-600 dark:text-slate-300 flex items-center gap-1">
                            <MapPin className="w-3 h-3 text-rose-500 shrink-0" />
                            <span>{row.scheduledArea}</span>
                          </div>
                        </div>
                      ) : (
                        <span className="text-[11px] text-slate-400 italic">Belum ada di Jadwal Admin</span>
                      )}
                    </td>

                    <td className="py-1.5 px-3">
                      {row.status === 'cocok' ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-500/30 font-bold text-[11px]">
                          <CheckCircle2 className="w-3 h-3" />
                          <span>Cocok</span>
                        </span>
                      ) : (
                        <div className="space-y-0.5 leading-tight">
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-rose-50 dark:bg-rose-500/15 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-500/30 font-bold text-[11px]">
                            <XCircle className="w-3 h-3" />
                            <span>
                              Tidak Cocok{row.mismatchReasonLabel ? ` · ${row.mismatchReasonLabel}` : ''}
                            </span>
                          </span>
                          {row.mismatchDetails.length > 0 && (
                            <div className="text-[11px] text-slate-500 dark:text-slate-400 leading-tight">
                              {row.mismatchDetails.join(' · ')}
                            </div>
                          )}
                        </div>
                      )}
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
