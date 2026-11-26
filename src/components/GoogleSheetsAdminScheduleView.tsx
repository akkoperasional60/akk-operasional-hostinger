import React, { useState, useMemo, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { 
  FileSpreadsheet, 
  Download, 
  Upload, 
  RefreshCw, 
  CheckCircle2, 
  AlertTriangle, 
  Search, 
  Truck, 
  Warehouse, 
  UserX, 
  Layers, 
  Check, 
  Calendar, 
  Users, 
  Sparkles, 
  ArrowRight, 
  FileText,
  Clock,
  Filter,
  Eye,
  SlidersHorizontal,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Info,
  MapPin,
  Ship,
  User,
  Send,
  X,
  XCircle,
  Plus,
  History as HistoryIcon,
  Edit,
  Trash2,
  Save,
  Zap,
  Building2,
  Wrench
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { branchStore, BranchRecord } from '../services/branchStore';
import { canEdit } from '../utils/rbac';
import { 
  ADMIN_SCHEDULE_WEEKS, 
  AdminScheduleWeek, 
  AdminScheduleDay, 
  DeliveryAssignment, 
  WarehouseCrewAssignment, 
  OffDeliveryArmada, 
  EmployeeAbsence, 
  RAW_ADMIN_SCHEDULE_CSV, 
  convertParsedTripsToWeeks, 
  buildMonthSpecificSchedule,
  convertSchedulesToAdminWeeks,
  getScheduleCalendarDateObj
} from '../data/adminSchedule';
import { logisticsStore, ScheduleChangeLogEntry } from '../services/store';
import { Schedule, ShipmentStatus, RetailStore, Fleet, Crew } from '../types';
import { GoogleSheetsApiSyncModal } from './GoogleSheetsApiSyncModal';
import { driverWaybillService } from '../services/driverWaybillService';
import { 
  scheduleImportValidator, 
  ValidationSummaryReport, 
  ValidatedImportItem 
} from '../services/scheduleImportValidator';
import { 
  googleSheetsApiService, 
  ParsedSheetTrip 
} from '../services/googleSheetsApiService';
import { googleSheetsSyncService } from '../services/googleSheetsSyncService';
import {
  standardizeAreaName,
  getAreaSubDetail,
  OFFICIAL_DESTINATION_AREAS,
  SIDOARJO_DESTINATION_AREAS,
  getOfficialAreasForBranch
} from '../utils/areaNormalizer';
import { areaAutoMapper, AreaMappingEntry, OfficialAreaItem } from '../services/areaAutoMapper';
import { crewAutoMapper, CrewMappingEntry, OfficialCrewItem } from '../services/crewAutoMapper';
import { persistSchedulesToDatabase, fetchPersistedSchedulesFromServer } from '../services/supabaseService';
import { QuickCreateAreaModal } from './QuickCreateAreaModal';
import { QuickCreateCrewModal } from './QuickCreateCrewModal';
import { AreaAutoMappingSection } from './AreaAutoMappingSection';
import { CrewAutoMappingSection } from './CrewAutoMappingSection';

const FLEET_SPEC_MAP: Record<string, { model: string; category: string }> = {
  'DS1': { model: 'Isuzu Giga CDD Long', category: 'Luar Kota (Bali Spec)' },
  'DS2': { model: 'Mitsubishi Canter HDX', category: 'Heavy Duty Box 6R' },
  'DS3': { model: 'Hino Dutro 130 HD', category: 'Luar Kota (Bali Spec)' },
  'DS4': { model: 'Isuzu Elf NMR 71', category: 'Box 6-Roda Reguler' },
  'NS1': { model: 'Mitsubishi Canter FE71', category: 'Engkel Box 4-Roda' },
  'NS2': { model: 'Isuzu Elf NLR 55', category: 'Engkel Box 4-Roda' },
  'NS3': { model: 'Hino Dutro 110 SDB', category: 'Engkel Box 4-Roda' },
  'N20': { model: 'Mitsubishi L300 Box', category: 'Blind Van / Pick-up Box' }
};

const DRIVER_AVATAR_COLORS: Record<string, { bg: string; text: string; ring: string }> = {
  'Supri': { bg: 'bg-blue-500/10 dark:bg-blue-500/20', text: 'text-blue-600 dark:text-blue-400', ring: 'border-blue-500/30' },
  'Wahyu': { bg: 'bg-indigo-500/10 dark:bg-indigo-500/20', text: 'text-indigo-600 dark:text-indigo-400', ring: 'border-indigo-500/30' },
  'Tiar': { bg: 'bg-emerald-500/10 dark:bg-emerald-500/20', text: 'text-emerald-600 dark:text-emerald-400', ring: 'border-emerald-500/30' },
  'Aris': { bg: 'bg-amber-500/10 dark:bg-amber-500/20', text: 'text-amber-600 dark:text-amber-400', ring: 'border-amber-500/30' },
  'Andre': { bg: 'bg-purple-500/10 dark:bg-purple-500/20', text: 'text-purple-600 dark:text-purple-400', ring: 'border-purple-500/30' },
  'Wibi': { bg: 'bg-teal-500/10 dark:bg-teal-500/20', text: 'text-teal-600 dark:text-teal-400', ring: 'border-teal-500/30' },
  'Budi': { bg: 'bg-rose-500/10 dark:bg-rose-500/20', text: 'text-rose-600 dark:text-rose-400', ring: 'border-rose-500/30' },
  'Hadi': { bg: 'bg-cyan-500/10 dark:bg-cyan-500/20', text: 'text-cyan-600 dark:text-cyan-400', ring: 'border-cyan-500/30' }
};

function getDriverInitials(name: string): string {
  if (!name) return 'DR';
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return name.substring(0, 2).toUpperCase();
}

function getAreaCorridor(standardArea: string): string {
  if (standardArea.includes('DENPASAR') || standardArea.includes('SINGARAJA') || standardArea.includes('NEGARA')) {
    return 'Lintas Pulau (Ferry ASDP Ketapang - Gilimanuk)';
  }
  if (standardArea.includes('BONDOWOSO') || standardArea.includes('STB') || standardArea.includes('SITUBONDO')) {
    return 'Jalur Pantura / Pegunungan Utara';
  }
  if (standardArea.includes('ROGOJAMPI') || standardArea.includes('SONGGON') || standardArea.includes('SRONO')) {
    return 'Koridor Banyuwangi Tengah (Ritel)';
  }
  if (standardArea.includes('PURWO') || standardArea.includes('JAJAG') || standardArea.includes('GALEKAN')) {
    return 'Koridor Banyuwangi Selatan (Supermarket & Grosir)';
  }
  return 'Rute Distribusi Reguler Gudang Pusat AKK';
}

const MONTH_NAMES = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
];

function getScheduledCrewForDate(targetDateIso: string, excludeScheduleId?: string): Map<string, { role: string; area: string }> {
  const map = new Map<string, { role: string; area: string }>();
  if (!targetDateIso) return map;

  const schedules = logisticsStore.getSchedules() as any[];
  schedules.forEach(s => {
    if (excludeScheduleId && (s.id === excludeScheduleId || s.tempId === excludeScheduleId)) return;
    const sDate = s.dateIso || s.departureDateIso || s.departureDate || s.dateStr;
    const isSameDate = (sDate && sDate === targetDateIso) ||
                       (s.departureDateIso && s.departureDateIso === targetDateIso) ||
                       (s.returnDateIso && s.returnDateIso === targetDateIso);
    if (!isSameDate) return;

    const areaName = s.area || s.areaName || 'Jadwal';
    const driverName = s.driver || (s.crew?.name);
    const helperName = s.helper || (s.crewHelper?.name);
    const helper2Name = s.helper2 || (s.crewHelper2?.name);

    if (driverName && driverName !== '-' && String(driverName).trim() !== '') {
      map.set(String(driverName).trim().toLowerCase(), { role: 'Driver', area: areaName });
    }
    if (helperName && helperName !== '-' && String(helperName).trim() !== '') {
      map.set(String(helperName).trim().toLowerCase(), { role: 'Helper', area: areaName });
    }
    if (helper2Name && helper2Name !== '-' && String(helper2Name).trim() !== '') {
      map.set(String(helper2Name).trim().toLowerCase(), { role: 'Helper 2', area: areaName });
    }
  });

  return map;
}

interface CrewOptionItem {
  id: string;
  name: string;
  hasAccount?: boolean;
}

const CrewCustomSelectDropdown: React.FC<{
  label: string;
  value: string;
  options: CrewOptionItem[];
  onChange: (newValue: string, selectedOption?: CrewOptionItem) => void;
  emptyLabel?: string;
  emptyValue?: string;
  roleBadgeText: string;
  accentColor?: 'blue' | 'emerald';
  scheduledCrewMap?: Map<string, { role: string; area: string }>;
}> = ({
  label,
  value,
  options,
  onChange,
  emptyLabel,
  emptyValue = '',
  roleBadgeText,
  accentColor = 'emerald',
  scheduledCrewMap
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const filteredOptions = useMemo(() => {
    const normalize = (value: string) => value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    const editDistance = (a: string, b: string): number => {
      if (a === b) return 0;
      if (!a) return b.length;
      if (!b) return a.length;
      let previous = Array.from({ length: b.length + 1 }, (_, i) => i);
      for (let i = 1; i <= a.length; i += 1) {
        const current = [i];
        for (let j = 1; j <= b.length; j += 1) {
          current[j] = Math.min(
            current[j - 1] + 1,
            previous[j] + 1,
            previous[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)
          );
        }
        previous = current;
      }
      return previous[b.length];
    };

    const q = normalize(search);
    if (!q) return options;
    const queryParts = q.split(' ').filter(Boolean);
    return options
      .map(option => {
        const name = normalize(option.name);
        const nameParts = name.split(' ').filter(Boolean);
        const exactScore = name === q ? 100 : name.includes(q) ? 90 : 0;
        const tokenScore = queryParts.every(part =>
          nameParts.some(token => token === part || token.startsWith(part) || token.includes(part))
        ) ? 80 : 0;
        const fuzzyScore = queryParts.every(part =>
          nameParts.some(token => token.length >= 3 && part.length >= 4 && editDistance(token, part) <= (part.length >= 7 ? 2 : 1))
        ) ? 60 : 0;
        return { option, score: Math.max(exactScore, tokenScore, fuzzyScore) };
      })
      .filter(item => item.score > 0)
      .sort((a, b) => b.score - a.score || a.option.name.localeCompare(b.option.name))
      .map(item => item.option);
  }, [options, search]);

  const isNoneSelected = !value || value === '-' || value === emptyValue;
  const displayValue = isNoneSelected ? (emptyLabel || 'Pilih Kru...') : value;

  const unscheduledCount = useMemo(() => {
    if (!scheduledCrewMap || scheduledCrewMap.size === 0) return options.length;
    return options.filter(o => {
      const key = o.name.trim().toLowerCase();
      if (!isNoneSelected && key === value.trim().toLowerCase()) return true;
      return !scheduledCrewMap.has(key);
    }).length;
  }, [options, scheduledCrewMap, value, isNoneSelected]);

  const handleSelectFirstValid = () => {
    if (filteredOptions.length === 0) return;
    const firstValid = filteredOptions.find(o => {
      const key = o.name.trim().toLowerCase();
      if (!isNoneSelected && key === value.trim().toLowerCase()) return true;
      return !scheduledCrewMap?.has(key);
    }) || filteredOptions[0];

    if (firstValid) {
      const key = firstValid.name.trim().toLowerCase();
      const isAlreadyScheduled = scheduledCrewMap?.has(key) && (isNoneSelected || key !== value.trim().toLowerCase());
      if (!isAlreadyScheduled) {
        onChange(firstValid.name, firstValid);
        setIsOpen(false);
      }
    }
  };

  return (
    <div ref={containerRef} className="relative">
      <label className="text-xs font-bold text-[#334155] dark:text-[#CBD5E1] flex items-center justify-between mb-1.5">
        <span>{label}</span>
        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-[#EFF6FF] dark:bg-[#1E3A8A]/40 text-[#2563EB] dark:text-[#60A5FA] border border-[#BFDBFE] dark:border-[#1E40AF]">
          {options.length} Aktif
        </span>
      </label>

      <button
        type="button"
        onClick={() => {
          setIsOpen(prev => !prev);
          setSearch('');
        }}
        className={`w-full flex items-center justify-between gap-2.5 bg-[#F8FAFC] dark:bg-[#0F172A] border rounded-xl px-3 py-2 text-left transition cursor-pointer ${
          isOpen
            ? 'border-[#2563EB] ring-2 ring-[#2563EB]/15'
            : 'border-[#CBD5E1] dark:border-[#334155] hover:border-[#2563EB]/60'
        }`}
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <div className={`w-7 h-7 rounded-lg flex items-center justify-center font-bold text-[11px] shrink-0 border ${
            isNoneSelected
              ? 'bg-[#E2E8F0] dark:bg-[#1E293B] text-[#64748B] border-[#CBD5E1] dark:border-[#334155]'
              : 'bg-[#2563EB] text-white border-[#2563EB]'
          }`}>
            {isNoneSelected ? '—' : getDriverInitials(displayValue)}
          </div>
          <div className="min-w-0">
            <div className={`text-xs font-bold leading-tight truncate ${
              isNoneSelected ? 'text-[#94A3B8] dark:text-[#64748B] italic' : 'text-[#0F172A] dark:text-[#F1F5F9]'
            }`}>
              {displayValue}
            </div>
            <div className="text-[10px] text-[#64748B] dark:text-[#94A3B8] font-medium leading-tight mt-0.5">
              {isNoneSelected ? 'Tidak ditugaskan' : `${roleBadgeText} • Status Aktif`}
            </div>
          </div>
        </div>
        <ChevronDown className={`w-4 h-4 text-[#64748B] shrink-0 transition-transform duration-150 ${isOpen ? 'rotate-180 text-[#2563EB]' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute left-0 right-0 z-50 mt-1.5 bg-white dark:bg-[#162234] border border-[#CBD5E1] dark:border-[#334155] rounded-xl shadow-sm overflow-hidden animate-in fade-in duration-150">
          <div className="p-2 bg-[#F8FAFC] dark:bg-[#0F172A] border-b border-[#E2E8F0] dark:border-[#24344D]">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-[#64748B] absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleSelectFirstValid();
                  }
                }}
                placeholder={`Cari nama ${roleBadgeText.toLowerCase()}... (Tekan Enter untuk memilih)`}
                autoFocus
                className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-white dark:bg-[#162234] border border-[#CBD5E1] dark:border-[#334155] text-xs text-[#0F172A] dark:text-[#F1F5F9] placeholder-[#94A3B8] focus:outline-none focus:border-[#2563EB]"
              />
            </div>
          </div>

          <div className="max-h-56 overflow-y-auto p-1.5 space-y-1">
            {emptyLabel && (
              <button
                type="button"
                onClick={() => {
                  onChange(emptyValue);
                  setIsOpen(false);
                }}
                className={`w-full flex items-center justify-between gap-2 px-2.5 py-2 rounded-lg text-left text-xs transition cursor-pointer ${
                  isNoneSelected
                    ? 'bg-[#EFF6FF] dark:bg-[#1E3A8A]/40 text-[#2563EB] dark:text-[#60A5FA] font-bold'
                    : 'text-[#64748B] dark:text-[#94A3B8] hover:bg-[#F8FAFC] dark:hover:bg-[#1E293B]'
                }`}
              >
                <span className="italic">{emptyLabel}</span>
                {isNoneSelected && <Check className="w-3.5 h-3.5 text-[#2563EB] shrink-0" />}
              </button>
            )}

            {filteredOptions.length === 0 ? (
              <div className="py-5 text-center text-[11px] text-[#64748B]">
                Tidak ada kru aktif yang cocok dengan pencarian.
              </div>
            ) : (
              filteredOptions.map((item) => {
                const itemKey = item.name.trim().toLowerCase();
                const isSelected = !isNoneSelected && value.trim().toLowerCase() === itemKey;
                const scheduledInfo = scheduledCrewMap?.get(itemKey);
                const isAlreadyScheduled = Boolean(scheduledInfo) && !isSelected;

                return (
                  <button
                    key={item.id}
                    type="button"
                    disabled={isAlreadyScheduled}
                    onClick={() => {
                      if (isAlreadyScheduled) return;
                      onChange(item.name, item);
                      setIsOpen(false);
                    }}
                    className={`w-full flex items-center justify-between gap-2.5 px-2.5 py-2 rounded-lg text-left transition cursor-pointer ${
                      isAlreadyScheduled
                        ? 'opacity-50 cursor-not-allowed bg-[#F8FAFC] dark:bg-[#0F172A] text-[#94A3B8]'
                        : isSelected
                        ? 'bg-[#2563EB] text-white'
                        : 'hover:bg-[#F8FAFC] dark:hover:bg-[#1E293B] text-[#0F172A] dark:text-[#F1F5F9]'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className={`w-7 h-7 rounded-lg flex items-center justify-center font-bold text-[10px] shrink-0 border ${
                        isSelected
                          ? 'bg-white/20 text-white border-white/30'
                          : isAlreadyScheduled
                          ? 'bg-amber-50 dark:bg-amber-950/30 text-amber-600 border-amber-200 dark:border-amber-800'
                          : 'bg-[#EFF6FF] dark:bg-[#1E3A8A]/40 text-[#2563EB] dark:text-[#60A5FA] border-[#BFDBFE] dark:border-[#1E40AF]'
                      }`}>
                        {getDriverInitials(item.name)}
                      </div>
                      <div className="min-w-0">
                        <div className={`text-xs font-bold leading-snug ${isSelected ? 'text-white' : isAlreadyScheduled ? 'text-[#94A3B8]' : 'text-[#0F172A] dark:text-[#F1F5F9]'}`}>
                          {item.name}
                        </div>
                        <div className={`text-[10px] flex items-center gap-1.5 ${isSelected ? 'text-white/85' : 'text-[#64748B] dark:text-[#94A3B8]'}`}>
                          <span>{roleBadgeText}</span>
                          <span>•</span>
                          {isAlreadyScheduled ? (
                            <span className="text-amber-600 dark:text-amber-400 font-bold">
                              Sudah Terjadwal ({scheduledInfo?.area})
                            </span>
                          ) : (
                            <span className={isSelected ? 'text-white font-semibold' : 'text-[#2563EB] dark:text-[#60A5FA] font-semibold'}>
                              Siap Tugas
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    {isSelected && <Check className="w-4 h-4 text-white shrink-0" />}
                    {isAlreadyScheduled && (
                      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800 shrink-0">
                        Terjadwal
                      </span>
                    )}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
};

interface NotReadyFleetWarningPayload {
  fleet: Fleet;
  fleetCode: string;
  reasonType: 'maintenance' | 'same_date_conflict' | 'currently_on_duty';
  statusTitle: string;
  description: string;
  areaName: string | null;
  driverName: string | null;
  targetDateIso?: string;
  canForceProceed: boolean;
}

const FleetCustomSelectDropdown: React.FC<{
  label: string;
  value: string;
  fleets: Fleet[];
  dateIso?: string;
  excludeScheduleId?: string;
  onChange: (newValue: string) => void;
  accentColor?: 'blue' | 'emerald';
}> = ({ label, value, fleets, dateIso, excludeScheduleId, onChange, accentColor = 'blue' }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const [warningModal, setWarningModal] = useState<NotReadyFleetWarningPayload | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !warningModal) setIsOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, warningModal]);

  useEffect(() => {
    if (!warningModal) return;
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        setWarningModal(null);
      }
    };
    window.addEventListener('keydown', handleEsc, true);
    return () => window.removeEventListener('keydown', handleEsc, true);
  }, [warningModal]);

  const selectedFleet = useMemo(() => {
    if (!value) return null;
    return (
      fleets.find(f => (f.initialCode || f.plateNumber) === value || f.plateNumber === value) ||
      logisticsStore.findFleetByCodeOrPlate(value) ||
      null
    );
  }, [fleets, value]);

  const evaluateFleetReadiness = (fleet: Fleet) => {
    const live = logisticsStore.getFleetLiveOperationalInfo(fleet, dateIso, excludeScheduleId);
    const liveNow = logisticsStore.getFleetLiveOperationalInfo(fleet, undefined, excludeScheduleId);
    const isMaintenance = live.effectiveStatus === 'maintenance' || fleet.status === 'maintenance';
    const isSameDateConflict = !isMaintenance && !live.canBeScheduled;
    const isCurrentlyOnDuty =
      !isMaintenance &&
      live.canBeScheduled &&
      (liveNow.effectiveStatus === 'on-duty' || fleet.status === 'on-duty');
    const isNotReady = isMaintenance || isSameDateConflict || isCurrentlyOnDuty;

    return {
      live,
      liveNow,
      isMaintenance,
      isSameDateConflict,
      isCurrentlyOnDuty,
      isNotReady
    };
  };

  const filteredFleets = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = !q
      ? fleets
      : fleets.filter(f =>
          f.plateNumber.toLowerCase().includes(q) ||
          (f.initialCode && f.initialCode.toLowerCase().includes(q)) ||
          (f.vehicleType && f.vehicleType.toLowerCase().includes(q))
        );

    return list
      .map((fleet) => {
        const fleetCode = fleet.initialCode || fleet.plateNumber;
        const isSelected = selectedFleet?.id === fleet.id || value === fleetCode || value === fleet.plateNumber;
        const readiness = evaluateFleetReadiness(fleet);
        const sortRank = !readiness.isNotReady
          ? 0
          : readiness.isCurrentlyOnDuty
          ? 1
          : readiness.isSameDateConflict
          ? 2
          : 3;
        return { fleet, fleetCode, isSelected, ...readiness, sortRank };
      })
      .sort((a, b) => a.sortRank - b.sortRank);
  }, [fleets, search, selectedFleet, value, dateIso, excludeScheduleId]);

  useEffect(() => {
    setHighlightedIndex(0);
  }, [search, isOpen]);

  const attemptSelectFleet = (entry: (typeof filteredFleets)[number]) => {
    // Izinkan langsung memilih armada meskipun sedang dipakai / di perjalanan / terjadwal di tanggal yang sama
    if (!entry.isMaintenance || entry.isSelected) {
      onChange(entry.fleetCode);
      setIsOpen(false);
      return;
    }

    // Armada sedang servis / perbaikan -> tampilkan konfirmasi singkat
    setIsOpen(false);
    setWarningModal({
      fleet: entry.fleet,
      fleetCode: entry.fleetCode,
      reasonType: 'maintenance',
      statusTitle: 'Sedang Servis / Perbaikan',
      description:
        'Status armada ini masih dalam proses servis atau perbaikan bengkel. Pastikan kendaraan sudah siap sebelum dijadwalkan untuk pengiriman.',
      areaName: entry.live.areaName || entry.liveNow.areaName,
      driverName: entry.live.driverName || entry.liveNow.driverName,
      targetDateIso: dateIso,
      canForceProceed: true
    });
  };

  const handleSelectHighlightedOrFirstValid = () => {
    if (filteredFleets.length === 0) return;
    const target = filteredFleets[highlightedIndex] || filteredFleets[0];
    if (target) {
      attemptSelectFleet(target);
    }
  };

  const selectedReadiness = selectedFleet ? evaluateFleetReadiness(selectedFleet) : null;
  const liveInfo = selectedReadiness?.live || null;

  const formattedFleetTitle = selectedFleet
    ? `[${selectedFleet.initialCode || selectedFleet.plateNumber}] ${selectedFleet.plateNumber} — ${
        selectedReadiness?.isMaintenance
          ? 'Sedang Servis (Belum Ready)'
          : selectedReadiness?.isCurrentlyOnDuty
          ? 'Sedang Kirim (Belum Ready)'
          : liveInfo?.statusLabel || 'Ready'
      }`
    : 'Pilih Armada Truk...';

  const readyFleetsCount = useMemo(
    () => filteredFleets.filter(item => !item.isNotReady).length,
    [filteredFleets]
  );

  return (
    <div ref={containerRef} className="relative">
      <div className="h-[24px] flex items-center justify-between mb-1.5">
        <label className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
          <span>{label}</span>
        </label>
        {selectedReadiness?.isNotReady && (
          <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-md border ${
            selectedReadiness.isMaintenance
              ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/30'
              : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30'
          }`}>
            <AlertTriangle className="w-3 h-3 shrink-0" />
            <span>Belum Ready</span>
          </span>
        )}
      </div>

      <button
        type="button"
        onClick={() => {
          setIsOpen(prev => !prev);
          setSearch('');
        }}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
            e.preventDefault();
            if (!isOpen) {
              setIsOpen(true);
            } else if (filteredFleets.length > 0) {
              const dir = e.key === 'ArrowDown' || e.key === 'ArrowRight' ? 1 : -1;
              setHighlightedIndex(prev => (prev + dir + filteredFleets.length) % filteredFleets.length);
            }
          } else if (e.key === 'Enter' && isOpen) {
            e.preventDefault();
            handleSelectHighlightedOrFirstValid();
          }
        }}
        className={`h-[44px] w-full flex items-center justify-between gap-2.5 bg-white dark:bg-slate-950 border rounded-2xl px-4 py-2.5 text-left transition cursor-pointer ${
          selectedReadiness?.isNotReady
            ? selectedReadiness.isMaintenance
              ? 'border-rose-400 dark:border-rose-500/70 ring-2 ring-rose-500/15'
              : 'border-amber-400 dark:border-amber-500/70 ring-2 ring-amber-500/15'
            : isOpen
            ? 'border-blue-500 ring-2 ring-blue-500/20'
            : 'border-slate-300 dark:border-slate-700 hover:border-blue-400 dark:hover:border-slate-600'
        }`}
      >
        <span className={`text-xs font-extrabold truncate ${
          selectedFleet
            ? selectedReadiness?.isNotReady
              ? selectedReadiness.isMaintenance
                ? 'text-rose-700 dark:text-rose-300'
                : 'text-amber-700 dark:text-amber-300'
              : 'text-slate-900 dark:text-white'
            : 'text-slate-400 dark:text-slate-500 italic'
        }`}>
          {formattedFleetTitle}
        </span>

        <ChevronDown className={`w-4 h-4 text-slate-700 dark:text-slate-300 shrink-0 transition-transform duration-150 ${isOpen ? 'rotate-180 text-blue-500' : ''}`} />
      </button>

      {/* Separate Status Box Below Dropdown */}
      <div className={`mt-2 min-h-[32px] w-full px-3.5 py-1.5 rounded-xl border flex items-center justify-between gap-2 text-[11px] transition ${
        selectedReadiness?.isNotReady
          ? selectedReadiness.isMaintenance
            ? 'border-rose-300 dark:border-rose-500/40 bg-rose-50 dark:bg-rose-950/30'
            : 'border-amber-300 dark:border-amber-500/40 bg-amber-50 dark:bg-amber-950/30'
          : 'border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950'
      }`}>
        <div className="flex items-center gap-2 min-w-0">
          {selectedReadiness?.isNotReady ? (
            <AlertTriangle className={`w-3.5 h-3.5 shrink-0 ${
              selectedReadiness.isMaintenance ? 'text-rose-500' : 'text-amber-500'
            }`} />
          ) : (
            <span className={`w-4 h-4 rounded-full flex items-center justify-center shrink-0 ${
              !selectedFleet || !liveInfo
                ? 'bg-slate-200 dark:bg-slate-800'
                : 'bg-emerald-500/20'
            }`}>
              <span className={`w-2.5 h-2.5 rounded-full ${
                selectedFleet && liveInfo ? liveInfo.dotColorClass : 'bg-slate-400'
              }`} />
            </span>
          )}
          <span className={`font-extrabold truncate ${
            selectedReadiness?.isNotReady
              ? selectedReadiness.isMaintenance
                ? 'text-rose-700 dark:text-rose-300'
                : 'text-amber-700 dark:text-amber-300'
              : 'text-slate-900 dark:text-white'
          }`}>
            {!selectedFleet || !liveInfo
              ? 'Belum Dipilih'
              : selectedReadiness?.isMaintenance
              ? 'Belum Ready (Servis)'
              : selectedReadiness?.isCurrentlyOnDuty
              ? 'Belum Ready (Di Jalan)'
              : selectedReadiness?.isSameDateConflict
              ? `Belum Ready (${liveInfo.statusLabel})`
              : liveInfo.statusLabel}
          </span>
        </div>
        <span className={`font-medium truncate ml-2 ${
          selectedReadiness?.isNotReady
            ? selectedReadiness.isMaintenance
              ? 'text-rose-600 dark:text-rose-300'
              : 'text-amber-700 dark:text-amber-300'
            : 'text-slate-500 dark:text-slate-400'
        }`}>
          {!selectedFleet
            ? 'Pilih armada pengiriman'
            : selectedReadiness?.isMaintenance
            ? 'Peringatan: Sedang Proses Servis'
            : selectedReadiness?.isCurrentlyOnDuty
            ? `Masih Kirim: ${selectedReadiness.liveNow.areaName || 'Belum Kembali'}`
            : liveInfo?.effectiveStatus === 'on-duty'
            ? `${liveInfo.statusLabel === 'Terjadwal' ? 'Terjadwal' : 'Kirim'}: ${liveInfo.areaName || 'Kirim'}`
            : liveInfo?.todayScheduledArea
            ? `Terjadwal: ${liveInfo.todayScheduledArea}`
            : 'Siap Digunakan Kirim'}
        </span>
      </div>

      {isOpen && (
        <div className="absolute left-0 right-0 z-50 mt-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
          <div className="p-2 bg-slate-50 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 space-y-1.5">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
                    e.preventDefault();
                    if (filteredFleets.length > 0) {
                      setHighlightedIndex(prev => (prev + 1) % filteredFleets.length);
                    }
                  } else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
                    e.preventDefault();
                    if (filteredFleets.length > 0) {
                      setHighlightedIndex(prev => (prev - 1 + filteredFleets.length) % filteredFleets.length);
                    }
                  } else if (e.key === 'Enter') {
                    e.preventDefault();
                    handleSelectHighlightedOrFirstValid();
                  }
                }}
                placeholder="Cari plat nomor, inisial (misal: N5), atau tipe... (Enter / Panah)"
                autoFocus
                className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-blue-500"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-white text-xs cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
            <div className="flex items-center justify-between px-1 text-[10px] text-slate-500 dark:text-slate-400">
              <span>
                <strong className="text-emerald-600 dark:text-emerald-400">{readyFleetsCount}</strong> Armada Ready
              </span>
              {filteredFleets.length - readyFleetsCount > 0 && (
                <span className="inline-flex items-center gap-1 text-amber-600 dark:text-amber-400 font-semibold">
                  <AlertTriangle className="w-3 h-3" />
                  <span>{filteredFleets.length - readyFleetsCount} Belum Ready</span>
                </span>
              )}
            </div>
          </div>

          <div className="max-h-60 overflow-y-auto p-1.5 space-y-0.5">
            {filteredFleets.length === 0 ? (
              <div className="py-5 text-center text-[11px] text-slate-400">
                Tidak ada armada truk yang cocok dengan pencarian "{search}".
              </div>
            ) : (
              filteredFleets.map((entry, idx) => {
                const { fleet, isSelected, live, liveNow, isMaintenance, isSameDateConflict, isCurrentlyOnDuty, isNotReady } = entry;
                const isHighlighted = idx === highlightedIndex;
                const optionLabel = `[${fleet.initialCode || fleet.plateNumber}] ${fleet.plateNumber} — ${
                  isMaintenance
                    ? 'Sedang Servis'
                    : isSameDateConflict
                    ? `${live.statusLabel} (${live.areaName || live.todayScheduledArea || 'Jadwal'})`
                    : isCurrentlyOnDuty
                    ? `Sedang Kirim (${liveNow.areaName || 'Di Jalan'})`
                    : live.statusLabel
                }`;

                return (
                  <button
                    key={fleet.id}
                    type="button"
                    onMouseEnter={() => setHighlightedIndex(idx)}
                    onClick={() => attemptSelectFleet(entry)}
                    className={`w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg text-left text-xs transition cursor-pointer ${
                      isSelected
                        ? isNotReady
                          ? isMaintenance
                            ? 'bg-rose-600 text-white font-bold shadow-2xs'
                            : 'bg-amber-600 text-white font-bold shadow-2xs'
                          : 'bg-blue-600 text-white font-bold shadow-2xs'
                        : isNotReady
                        ? isHighlighted
                          ? isMaintenance
                            ? 'bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300 font-semibold border border-rose-200 dark:border-rose-500/30'
                            : 'bg-amber-50 dark:bg-amber-950/50 text-amber-800 dark:text-amber-300 font-semibold border border-amber-200 dark:border-amber-500/30'
                          : 'bg-slate-50/80 dark:bg-slate-950/40 text-slate-600 dark:text-slate-300 hover:bg-amber-50/70 dark:hover:bg-amber-950/30 font-medium'
                        : isHighlighted
                        ? 'bg-blue-600 text-white font-bold shadow-2xs'
                        : 'hover:bg-slate-100 dark:hover:bg-slate-800/70 text-slate-800 dark:text-slate-200 font-medium'
                    }`}
                  >
                    <span className="flex items-center gap-2 min-w-0">
                      {isNotReady && !isSelected && (
                        <AlertTriangle className={`w-3.5 h-3.5 shrink-0 ${
                          isMaintenance ? 'text-rose-500' : 'text-amber-500'
                        }`} />
                      )}
                      <span className="truncate">{optionLabel}</span>
                    </span>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {isNotReady && (
                        <span className={`text-[9px] font-extrabold px-1.5 py-0.5 rounded border shrink-0 ${
                          isSelected
                            ? 'bg-white/20 text-white border-white/30'
                            : isMaintenance
                            ? 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/25'
                            : isCurrentlyOnDuty || live.statusLabel === 'Kirim'
                            ? 'bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/25'
                            : 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/25'
                        }`}>
                          {isMaintenance
                            ? 'Servis'
                            : isCurrentlyOnDuty
                            ? 'Belum Kembali'
                            : live.statusLabel}
                        </span>
                      )}
                      {isSelected && <Check className="w-3.5 h-3.5 text-white shrink-0" />}
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* Pop-up Peringatan Armada Belum Ready */}
      {warningModal &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            onClick={() => setWarningModal(null)}
            className="fixed inset-0 z-[10000] bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150"
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-md rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150"
            >
              {/* Header Peringatan */}
              <div className={`px-5 py-4 border-b flex items-start justify-between gap-3 ${
                warningModal.reasonType === 'maintenance'
                  ? 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-500/30'
                  : 'bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-500/30'
              }`}>
                <div className="flex items-start gap-3 min-w-0">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border ${
                    warningModal.reasonType === 'maintenance'
                      ? 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30'
                      : 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30'
                  }`}>
                    {warningModal.reasonType === 'maintenance' ? (
                      <Wrench className="w-5 h-5" />
                    ) : (
                      <AlertTriangle className="w-5 h-5" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <h4 className={`text-sm font-extrabold tracking-tight ${
                      warningModal.reasonType === 'maintenance'
                        ? 'text-rose-900 dark:text-rose-200'
                        : 'text-amber-900 dark:text-amber-200'
                    }`}>
                      Peringatan: Armada Belum Ready
                    </h4>
                    <p className={`text-[11px] font-semibold mt-0.5 ${
                      warningModal.reasonType === 'maintenance'
                        ? 'text-rose-700 dark:text-rose-300'
                        : 'text-amber-700 dark:text-amber-300'
                    }`}>
                      Status saat ini: {warningModal.statusTitle}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setWarningModal(null)}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/10 transition cursor-pointer"
                  aria-label="Tutup peringatan"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Body Detail Armada */}
              <div className="p-5 space-y-4">
                <div className="rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 p-3.5 space-y-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <Truck className="w-4 h-4 text-blue-500 shrink-0" />
                      <span className="text-xs font-extrabold text-slate-900 dark:text-white truncate">
                        [{warningModal.fleetCode}] {warningModal.fleet.plateNumber}
                      </span>
                    </div>
                    <span className={`px-2 py-0.5 rounded-md text-[10px] font-extrabold border shrink-0 ${
                      warningModal.reasonType === 'maintenance'
                        ? 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30'
                        : 'bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30'
                    }`}>
                      {warningModal.statusTitle}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-200 dark:border-slate-800 text-[11px]">
                    {warningModal.targetDateIso && (
                      <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-400">
                        <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span className="truncate">Tgl: <strong className="text-slate-800 dark:text-slate-200">{warningModal.targetDateIso}</strong></span>
                      </div>
                    )}
                    {warningModal.fleet.vehicleType && (
                      <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-400">
                        <Truck className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span className="truncate">{warningModal.fleet.vehicleType}</span>
                      </div>
                    )}
                    {warningModal.areaName && (
                      <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-400 col-span-2">
                        <MapPin className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                        <span className="truncate">Area Aktif: <strong className="text-slate-800 dark:text-slate-200">{warningModal.areaName}</strong></span>
                      </div>
                    )}
                    {warningModal.driverName && (
                      <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-400 col-span-2">
                        <User className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                        <span className="truncate">Driver: <strong className="text-slate-800 dark:text-slate-200">{warningModal.driverName}</strong></span>
                      </div>
                    )}
                  </div>
                </div>

                <p className="text-xs leading-relaxed text-slate-600 dark:text-slate-300">
                  {warningModal.description}
                </p>

                <div className={`rounded-xl border px-3.5 py-2.5 text-xs font-bold flex items-start gap-2 ${
                  warningModal.reasonType === 'maintenance'
                    ? 'bg-rose-50 dark:bg-rose-950/30 border-rose-200 dark:border-rose-500/30 text-rose-800 dark:text-rose-200'
                    : 'bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-500/30 text-amber-900 dark:text-amber-200'
                }`}>
                  <Info className={`w-4 h-4 shrink-0 mt-0.5 ${
                    warningModal.reasonType === 'maintenance' ? 'text-rose-500' : 'text-amber-500'
                  }`} />
                  <span>Yakin untuk memilih armada ini?</span>
                </div>
              </div>

              {/* Footer Actions */}
              <div className="px-5 py-3.5 bg-slate-50 dark:bg-slate-950 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setWarningModal(null);
                  }}
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 transition cursor-pointer"
                >
                  Batal
                </button>

                <button
                  type="button"
                  onClick={() => {
                    const chosenCode = warningModal.fleetCode;
                    setWarningModal(null);
                    onChange(chosenCode);
                  }}
                  className={`px-4 py-2 rounded-xl text-xs font-bold text-white shadow-sm transition cursor-pointer ${
                    warningModal.reasonType === 'maintenance'
                      ? 'bg-rose-600 hover:bg-rose-500'
                      : 'bg-amber-600 hover:bg-amber-500'
                  }`}
                >
                  Tetap Pilih Armada Ini
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
};

const ModernDatePicker: React.FC<{
  label?: string;
  value: string; // ISO YYYY-MM-DD
  onChange: (newIsoDate: string) => void;
  accentColor?: 'blue' | 'emerald';
  badgeText?: string;
  placeholder?: string;
  showQuickPills?: boolean;
}> = ({ label, value, onChange, accentColor = 'emerald', badgeText, placeholder = 'Pilih Tanggal...', showQuickPills = true }) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const parsedDate = useMemo(() => {
    if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      return new Date();
    }
    const [y, m, d] = value.split('-').map(Number);
    return new Date(y, m - 1, d);
  }, [value]);

  const [viewYear, setViewYear] = useState<number>(() => parsedDate.getFullYear());
  const [viewMonth, setViewMonth] = useState<number>(() => parsedDate.getMonth());

  useEffect(() => {
    if (isOpen) {
      setViewYear(parsedDate.getFullYear());
      setViewMonth(parsedDate.getMonth());
    }
  }, [isOpen, parsedDate]);

  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const monthNames = [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
  ];

  const dayNames = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];

  const formattedDisplay = useMemo(() => {
    if (!value) return placeholder;
    try {
      const d = parsedDate;
      const dd = String(d.getDate()).padStart(2, '0');
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const yyyy = d.getFullYear();
      return `${dd}/${mm}/${yyyy}`;
    } catch {
      return value;
    }
  }, [value, parsedDate, placeholder]);

  const calendarDays = useMemo(() => {
    const firstDayOfMonth = new Date(viewYear, viewMonth, 1);
    const lastDayOfMonth = new Date(viewYear, viewMonth + 1, 0);

    const startingDayOfWeek = firstDayOfMonth.getDay();
    const totalDaysInMonth = lastDayOfMonth.getDate();

    const days: Array<{ day: number; monthOffset: -1 | 0 | 1; iso: string }> = [];

    const prevMonthLastDay = new Date(viewYear, viewMonth, 0).getDate();
    for (let i = startingDayOfWeek - 1; i >= 0; i--) {
      const pDay = prevMonthLastDay - i;
      const prevDate = new Date(viewYear, viewMonth - 1, pDay);
      const iso = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}-${String(pDay).padStart(2, '0')}`;
      days.push({ day: pDay, monthOffset: -1, iso });
    }

    for (let d = 1; d <= totalDaysInMonth; d++) {
      const iso = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      days.push({ day: d, monthOffset: 0, iso });
    }

    const remainingSlots = 35 - days.length > 0 ? 35 - days.length : 42 - days.length;
    for (let n = 1; n <= remainingSlots; n++) {
      const nextDate = new Date(viewYear, viewMonth + 1, n);
      const iso = `${nextDate.getFullYear()}-${String(nextDate.getMonth() + 1).padStart(2, '0')}-${String(n).padStart(2, '0')}`;
      days.push({ day: n, monthOffset: 1, iso });
    }

    return days;
  }, [viewYear, viewMonth]);

  const todayIso = useMemo(() => {
    const today = new Date();
    return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  }, []);

  const tomorrowIso = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }, []);

  const lusaIso = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + 2);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }, []);

  const shiftSelectedDateByDays = (offset: number) => {
    const d = new Date(parsedDate);
    d.setDate(d.getDate() + offset);
    const nextIso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    onChange(nextIso);
  };

  const handlePrevMonth = () => {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear(y => y - 1);
    } else {
      setViewMonth(m => m - 1);
    }
  };

  const handleNextMonth = () => {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear(y => y + 1);
    } else {
      setViewMonth(m => m + 1);
    }
  };

  return (
    <div ref={containerRef} className="relative">
      {label && (
        <div className="h-[24px] flex items-center justify-between mb-1.5">
          <label className="text-xs font-bold text-[#334155] dark:text-[#CBD5E1] flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5 text-[#2563EB] dark:text-[#60A5FA]" />
            <span>{label}</span>
          </label>
          {badgeText && (
            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-[#EFF6FF] dark:bg-[#1E3A8A]/40 text-[#2563EB] dark:text-[#60A5FA] border border-[#BFDBFE] dark:border-[#1E40AF]">
              {badgeText}
            </span>
          )}
        </div>
      )}

      <button
        type="button"
        onClick={() => setIsOpen(prev => !prev)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowRight') {
            e.preventDefault();
            shiftSelectedDateByDays(1);
          } else if (e.key === 'ArrowLeft') {
            e.preventDefault();
            shiftSelectedDateByDays(-1);
          } else if (e.key === 'ArrowDown') {
            e.preventDefault();
            shiftSelectedDateByDays(7);
          } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            shiftSelectedDateByDays(-7);
          } else if (e.key === 'Enter' && isOpen) {
            e.preventDefault();
            setIsOpen(false);
          }
        }}
        className={`h-[44px] w-full flex items-center justify-between gap-2 bg-white dark:bg-[#0F172A] border rounded-xl px-4 py-2.5 text-left transition cursor-pointer ${
          isOpen
            ? 'border-[#2563EB] ring-2 ring-[#2563EB]/15'
            : 'border-[#CBD5E1] dark:border-[#334155] hover:border-[#2563EB]/60'
        }`}
      >
        <span className="text-xs font-bold text-[#0F172A] dark:text-[#F1F5F9] truncate">
          {formattedDisplay}
        </span>
        <Calendar className="w-4 h-4 text-[#2563EB] dark:text-[#60A5FA] shrink-0" />
      </button>

      {showQuickPills && (
        <div className="mt-2 flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => onChange(todayIso)}
            className={`h-[32px] px-3 rounded-lg border text-[11px] font-bold transition cursor-pointer ${
              value === todayIso
                ? 'bg-[#EFF6FF] dark:bg-[#1E3A8A]/40 text-[#2563EB] dark:text-[#60A5FA] border-[#BFDBFE] dark:border-[#1E40AF]'
                : 'bg-[#F8FAFC] dark:bg-[#0F172A] text-[#475569] dark:text-[#CBD5E1] border-[#E2E8F0] dark:border-[#24344D] hover:bg-[#F1F5F9] dark:hover:bg-[#1E293B]'
            }`}
          >
            Hari Ini
          </button>
          <button
            type="button"
            onClick={() => onChange(tomorrowIso)}
            className={`h-[32px] px-3 rounded-lg border text-[11px] font-bold transition cursor-pointer ${
              value === tomorrowIso
                ? 'bg-[#EFF6FF] dark:bg-[#1E3A8A]/40 text-[#2563EB] dark:text-[#60A5FA] border-[#BFDBFE] dark:border-[#1E40AF]'
                : 'bg-[#F8FAFC] dark:bg-[#0F172A] text-[#475569] dark:text-[#CBD5E1] border-[#E2E8F0] dark:border-[#24344D] hover:bg-[#F1F5F9] dark:hover:bg-[#1E293B]'
            }`}
          >
            Besok (+1)
          </button>
          <button
            type="button"
            onClick={() => onChange(lusaIso)}
            className={`h-[32px] px-3 rounded-lg border text-[11px] font-bold transition cursor-pointer ${
              value === lusaIso
                ? 'bg-[#EFF6FF] dark:bg-[#1E3A8A]/40 text-[#2563EB] dark:text-[#60A5FA] border-[#BFDBFE] dark:border-[#1E40AF]'
                : 'bg-[#F8FAFC] dark:bg-[#0F172A] text-[#475569] dark:text-[#CBD5E1] border-[#E2E8F0] dark:border-[#24344D] hover:bg-[#F1F5F9] dark:hover:bg-[#1E293B]'
            }`}
          >
            Lusa (+2)
          </button>
        </div>
      )}

      {isOpen && (
        <div className="absolute left-0 z-50 mt-1.5 w-72 sm:w-80 bg-white dark:bg-[#162234] border border-[#CBD5E1] dark:border-[#334155] rounded-xl shadow-sm p-3.5 space-y-3 animate-in fade-in duration-150">
          <div className="flex items-center justify-between gap-2 pb-2 border-b border-[#E2E8F0] dark:border-[#24344D]">
            <button
              type="button"
              onClick={handlePrevMonth}
              className="p-1.5 rounded-lg bg-[#F1F5F9] dark:bg-[#1E293B] hover:bg-[#E2E8F0] dark:hover:bg-[#24344D] text-[#334155] dark:text-[#CBD5E1] transition cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <div className="text-xs font-bold text-[#0F172A] dark:text-[#F1F5F9] flex items-center gap-1">
              <span>{monthNames[viewMonth]}</span>
              <span className="text-[#64748B] font-mono">{viewYear}</span>
            </div>

            <button
              type="button"
              onClick={handleNextMonth}
              className="p-1.5 rounded-lg bg-[#F1F5F9] dark:bg-[#1E293B] hover:bg-[#E2E8F0] dark:hover:bg-[#24344D] text-[#334155] dark:text-[#CBD5E1] transition cursor-pointer"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-7 gap-1 text-center">
            {dayNames.map((day, idx) => (
              <span
                key={day}
                className={`text-[10px] font-bold uppercase ${
                  idx === 0 ? 'text-rose-500' : 'text-[#64748B] dark:text-[#94A3B8]'
                }`}
              >
                {day}
              </span>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1">
            {calendarDays.map((item, idx) => {
              const isSelected = item.iso === value;
              const isToday = item.iso === todayIso;
              const isCurrentMonth = item.monthOffset === 0;

              return (
                <button
                  key={`${item.iso}-${idx}`}
                  type="button"
                  onClick={() => {
                    onChange(item.iso);
                    setIsOpen(false);
                  }}
                  className={`h-8 rounded-lg font-mono text-xs font-bold transition flex items-center justify-center relative cursor-pointer ${
                    isSelected
                      ? 'bg-[#2563EB] text-white'
                      : !isCurrentMonth
                      ? 'text-[#CBD5E1] dark:text-[#334155] hover:bg-[#F8FAFC] dark:hover:bg-[#1E293B]'
                      : isToday
                      ? 'bg-[#EFF6FF] dark:bg-[#1E3A8A]/40 text-[#2563EB] dark:text-[#60A5FA] font-bold border border-[#BFDBFE] dark:border-[#1E40AF]'
                      : 'text-[#0F172A] dark:text-[#F1F5F9] hover:bg-[#F1F5F9] dark:hover:bg-[#1E293B]'
                  }`}
                >
                  {item.day}
                  {isToday && !isSelected && (
                    <span className="w-1 h-1 rounded-full bg-[#2563EB] absolute bottom-1" />
                  )}
                </button>
              );
            })}
          </div>

          <div className="pt-2 border-t border-[#E2E8F0] dark:border-[#24344D] flex items-center justify-between text-[10px]">
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => {
                  onChange(todayIso);
                  setIsOpen(false);
                }}
                className="px-2 py-1 rounded-lg bg-[#EFF6FF] hover:bg-[#DBEAFE] text-[#2563EB] dark:bg-[#1E3A8A]/40 dark:text-[#60A5FA] font-bold transition cursor-pointer"
              >
                Hari Ini
              </button>
              <button
                type="button"
                onClick={() => {
                  onChange(tomorrowIso);
                  setIsOpen(false);
                }}
                className="px-2 py-1 rounded-lg bg-[#F1F5F9] dark:bg-[#1E293B] hover:bg-[#E2E8F0] text-[#334155] dark:text-[#CBD5E1] font-bold transition cursor-pointer"
              >
                Besok (+1)
              </button>
            </div>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="text-[#64748B] hover:text-[#0F172A] dark:hover:text-white font-bold cursor-pointer"
            >
              Tutup
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

const ModernTimePicker: React.FC<{
  label?: string;
  value: string; // 'HH:MM' e.g. '07:30'
  onChange: (newTime: string) => void;
  accentColor?: 'blue' | 'emerald';
}> = ({ label, value, onChange, accentColor = 'blue' }) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const [selectedHour, setSelectedHour] = useState<string>(() => {
    if (value && value.includes(':')) return value.split(':')[0].padStart(2, '0');
    return '07';
  });

  const [selectedMinute, setSelectedMinute] = useState<string>(() => {
    if (value && value.includes(':')) return value.split(':')[1].padStart(2, '0');
    return '00';
  });

  useEffect(() => {
    if (value && value.includes(':')) {
      const [h, m] = value.split(':');
      setSelectedHour(h.padStart(2, '0'));
      setSelectedMinute(m.padStart(2, '0'));
    }
  }, [value]);

  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const presetTimes = [
    '06:00', '07:00', '07:30', '08:00', '09:00',
    '12:00', '13:00', '15:00', '16:00', '17:00', '18:00', '20:00'
  ];

  const hours = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'));
  const minutes = ['00', '05', '10', '15', '20', '25', '30', '35', '40', '45', '50', '55'];

  const handleSelectHour = (h: string) => {
    setSelectedHour(h);
    onChange(`${h}:${selectedMinute}`);
  };

  const handleSelectMinute = (m: string) => {
    setSelectedMinute(m);
    onChange(`${selectedHour}:${m}`);
  };

  const displayTime = value || `${selectedHour}:${selectedMinute}`;

  return (
    <div ref={containerRef} className="relative">
      {label && (
        <label className="text-xs font-bold text-[#334155] dark:text-[#CBD5E1] flex items-center gap-1.5 mb-1.5">
          <Clock className="w-3.5 h-3.5 text-[#2563EB] dark:text-[#60A5FA]" />
          <span>{label}</span>
        </label>
      )}

      <button
        type="button"
        onClick={() => setIsOpen(prev => !prev)}
        className={`w-full flex items-center justify-between gap-2 bg-white dark:bg-[#0F172A] border rounded-xl px-3.5 py-2.5 text-left transition cursor-pointer ${
          isOpen
            ? 'border-[#2563EB] ring-2 ring-[#2563EB]/15'
            : 'border-[#CBD5E1] dark:border-[#334155] hover:border-[#2563EB]/60'
        }`}
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 bg-[#EFF6FF] dark:bg-[#1E3A8A]/40 text-[#2563EB] dark:text-[#60A5FA]">
            <Clock className="w-4 h-4" />
          </div>
          <span className="text-xs font-mono font-bold text-[#0F172A] dark:text-[#F1F5F9] tracking-wider">
            {displayTime} WIB
          </span>
        </div>
        <ChevronDown className={`w-4 h-4 text-[#64748B] shrink-0 transition-transform duration-150 ${isOpen ? 'rotate-180 text-[#2563EB]' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute left-0 z-50 mt-1.5 w-72 bg-white dark:bg-[#162234] border border-[#CBD5E1] dark:border-[#334155] rounded-xl shadow-sm p-3 space-y-3 animate-in fade-in duration-150">
          <div>
            <span className="text-[10px] font-bold uppercase text-[#64748B] tracking-wider block mb-1.5">
              Pilihan Jam Cepat:
            </span>
            <div className="flex flex-wrap gap-1">
              {presetTimes.map(t => (
                <button
                  key={t}
                  type="button"
                  onClick={() => {
                    onChange(t);
                    setIsOpen(false);
                  }}
                  className={`px-2 py-1 rounded-lg text-[10px] font-mono font-bold transition cursor-pointer border ${
                    value === t
                      ? 'bg-[#2563EB] text-white border-[#2563EB]'
                      : 'bg-[#F8FAFC] dark:bg-[#0F172A] text-[#334155] dark:text-[#CBD5E1] border-[#E2E8F0] dark:border-[#24344D] hover:bg-[#EFF6FF] hover:text-[#2563EB]'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 pt-2 border-t border-[#E2E8F0] dark:border-[#24344D]">
            <div>
              <span className="text-[10px] font-bold text-[#64748B] block mb-1">Jam</span>
              <div className="h-36 overflow-y-auto pr-1 space-y-1">
                {hours.map(h => (
                  <button
                    key={h}
                    type="button"
                    onClick={() => handleSelectHour(h)}
                    className={`w-full py-1 text-center font-mono text-xs font-bold rounded-lg transition cursor-pointer ${
                      selectedHour === h
                        ? 'bg-[#2563EB] text-white'
                        : 'text-[#334155] dark:text-[#CBD5E1] hover:bg-[#F1F5F9] dark:hover:bg-[#1E293B]'
                    }`}
                  >
                    {h}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <span className="text-[10px] font-bold text-[#64748B] block mb-1">Menit</span>
              <div className="h-36 overflow-y-auto pr-1 space-y-1">
                {minutes.map(m => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => handleSelectMinute(m)}
                    className={`w-full py-1 text-center font-mono text-xs font-bold rounded-lg transition cursor-pointer ${
                      selectedMinute === m
                        ? 'bg-[#2563EB] text-white'
                        : 'text-[#334155] dark:text-[#CBD5E1] hover:bg-[#F1F5F9] dark:hover:bg-[#1E293B]'
                    }`}
                  >
                    {m}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="pt-2 border-t border-[#E2E8F0] dark:border-[#24344D] flex items-center justify-between">
            <span className="text-[10px] font-mono text-[#64748B] font-semibold">
              Terpilih: <strong className="font-bold text-[#2563EB] dark:text-[#60A5FA]">{displayTime} WIB</strong>
            </span>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="px-3 py-1 rounded-lg bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-[10px] font-bold cursor-pointer transition"
            >
              Simpan
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

interface GoogleSheetsAdminScheduleViewProps {
  onSyncComplete?: (count: number) => void;
  onNavigateToSchedules?: () => void;
  onNavigateToCrewHistory?: () => void;
  onOpenCreateSchedule?: () => void;
}

export const GoogleSheetsAdminScheduleView: React.FC<GoogleSheetsAdminScheduleViewProps> = ({
  onSyncComplete,
  onNavigateToSchedules,
  onNavigateToCrewHistory,
  onOpenCreateSchedule
}) => {
  const [selectedWeekNum, setSelectedWeekNum] = useState<number | 'all'>('all');
  const [selectedDayFilter, setSelectedDayFilter] = useState<string>('all');
  const [selectedMonth, setSelectedMonth] = useState<number>(() => new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState<number>(() => new Date().getFullYear());
  const [categoryFilter, setCategoryFilter] = useState<'all' | 'luar_kota' | 'bali' | 'lokal' | 'kanvas_lkt'>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [scheduleStatusFilter, setScheduleStatusFilter] = useState<'all' | 'scheduled' | 'picked_up' | 'in_transit' | 'delivered' | 'delayed'>('all');
  const [armadaFilter, setArmadaFilter] = useState<string>('all');
  const [crewDriverFilter, setCrewDriverFilter] = useState<string>('all');
  const [branches, setBranches] = useState<BranchRecord[]>(() => branchStore.getActiveBranches());
  const [selectedBranchId, setSelectedBranchId] = useState<string>(() => {
    const id = branchStore.getSelectedOriginBranchId();
    return id && id !== 'ALL' ? id : 'cab-banyuwangi';
  });

  useEffect(() => {
    const unsub = branchStore.subscribe(() => {
      setBranches(branchStore.getActiveBranches());
      const id = branchStore.getSelectedOriginBranchId();
      setSelectedBranchId(id && id !== 'ALL' ? id : 'cab-banyuwangi');
    });
    return unsub;
  }, []);
  const [selectedCalendarDate, setSelectedCalendarDate] = useState<string>(() => {
    const now = new Date();
    const day = String(now.getDate()).padStart(2, '0');
    const monthName = MONTH_NAMES[now.getMonth()] || 'Oktober';
    return `${day} ${monthName} ${now.getFullYear()}`;
  });
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [syncSuccessMessage, setSyncSuccessMessage] = useState<string | null>(null);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState<boolean>(false);
  const [isApiSyncModalOpen, setIsApiSyncModalOpen] = useState<boolean>(false);
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);
  const [uploadedRowsCount, setUploadedRowsCount] = useState<number>(0);
  const [uploadedValidationReport, setUploadedValidationReport] = useState<ValidationSummaryReport | null>(null);
  const [skipDuplicatesUpload, setSkipDuplicatesUpload] = useState<boolean>(false);
  const [skipInvalidUpload, setSkipInvalidUpload] = useState<boolean>(true);
  const [isUploadConfigModalOpen, setIsUploadConfigModalOpen] = useState<boolean>(false);
  const [activeSubPage, setActiveSubPage] = useState<'schedule' | 'upload_excel' | 'upload_process'>('schedule');
  const [deleteConfirmModal, setDeleteConfirmModal] = useState<{ p: DeliveryAssignment; dayNumber: number; tripIndex: number; dateString: string } | null>(null);
  const [bypassConfirmModal, setBypassConfirmModal] = useState<{ schId: string; p: DeliveryAssignment; matchedSch?: Schedule } | null>(null);

  useEffect(() => {
    if (!deleteConfirmModal) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const isInteractiveTarget = Boolean(target?.closest('button, input, textarea, select, [contenteditable="true"]'));
      if (e.key === 'Enter' && !isInteractiveTarget) {
        e.preventDefault();
        handleDeleteTrip(
          deleteConfirmModal.p,
          deleteConfirmModal.dayNumber,
          deleteConfirmModal.tripIndex
        );
        setDeleteConfirmModal(null);
      } else if (e.key === 'Escape') {
        e.preventDefault();
        setDeleteConfirmModal(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [deleteConfirmModal]);
  const [importMonth, setImportMonth] = useState<string>('Januari');
  const [importYear, setImportYear] = useState<string>('2026');
  const [importMode, setImportMode] = useState<'tambahkan' | 'ganti'>('tambahkan');
  const [selectedUploadFile, setSelectedUploadFile] = useState<File | null>(null);
  const [, setStoreRevision] = useState<number>(0);

  useEffect(() => {
    void logisticsStore.refreshUsersFromHostinger();
    void logisticsStore.hydrateOperationalDataFromHostinger();
    const unsub = logisticsStore.subscribe(() => {
      setStoreRevision(prev => prev + 1);
      setOfficialCrewsList(crewAutoMapper.getOfficialCrewList());
    });
    return unsub;
  }, []);

  const currentUserProfile = logisticsStore.getCurrentUser();
  const accessibleBranches = useMemo(() => {
    const list = branchStore.getAccessibleBranchesForUser(currentUserProfile);
    return list.length > 0 ? list : branches;
  }, [currentUserProfile, branches]);

  // Enforce RBAC branch isolation: lock user to an accessible branch
  useEffect(() => {
    if (accessibleBranches.length === 0) return;
    const isAllowed = accessibleBranches.some(b => b.id === selectedBranchId);
    if (!isAllowed) {
      const fallbackId = accessibleBranches[0].id;
      setSelectedBranchId(fallbackId);
      branchStore.setActiveBranchId(fallbackId);
    }
  }, [accessibleBranches, selectedBranchId]);

  const effectiveActiveBranchId = useMemo(() => {
    if (selectedBranchId && selectedBranchId !== 'ALL' && accessibleBranches.some(b => b.id === selectedBranchId)) {
      return selectedBranchId;
    }
    return accessibleBranches[0]?.id || 'cab-banyuwangi';
  }, [selectedBranchId, accessibleBranches]);

  const isSidoarjoBranch = effectiveActiveBranchId === 'cab-sidoarjo';
  const activeBranchRecord = useMemo(
    () => branches.find(b => b.id === effectiveActiveBranchId) || branchStore.getBranchById(effectiveActiveBranchId),
    [branches, effectiveActiveBranchId]
  );

  const canEditSchedules =
    canEdit(currentUserProfile, 'schedules') &&
    branchStore.canUserAccessBranch(currentUserProfile, effectiveActiveBranchId);

  const branchOfficialAreas = useMemo(
    () => getOfficialAreasForBranch(effectiveActiveBranchId),
    [effectiveActiveBranchId]
  );

  const getFleetsForBranch = (targetBranchId?: string): Fleet[] => {
    const branchFilter = targetBranchId && targetBranchId !== 'ALL' ? targetBranchId : effectiveActiveBranchId;
    const duplicateIds = new Set(
      logisticsStore
        .findDuplicateFleetGroups()
        .flatMap(group => group.duplicates.map(dup => dup.id))
    );
    const allFleets = logisticsStore
      .getFleets()
      .filter(f => f && f.id && f.plateNumber && !duplicateIds.has(f.id));
    const branchMatched = allFleets.filter(
      f => branchStore.getFleetBranchId(f.id, f.plateNumber, f.initialCode, f.branchId) === branchFilter
    );
    return branchMatched.length > 0 ? branchMatched : allFleets;
  };

  useEffect(() => {
    setCategoryFilter('all');
    setAreaCategoryFilter('all');
    setAreaSearchFilter('');
  }, [effectiveActiveBranchId]);

  const [openPeriodDropdown, setOpenPeriodDropdown] = useState<'month' | 'year' | 'branch' | null>(null);
  const periodDropdownRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const handleClickOutside = (ev: MouseEvent) => {
      if (periodDropdownRef.current && !periodDropdownRef.current.contains(ev.target as Node)) {
        setOpenPeriodDropdown(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const getIntegratedDrivers = (targetBranchId?: string) => {
    const branchFilter = targetBranchId && targetBranchId !== 'ALL' ? targetBranchId : effectiveActiveBranchId;
    const allUsers = logisticsStore.getUsers();
    const allCrews = logisticsStore.getCrews();
    const activeDriverAndHelperUsers = allUsers
      .filter(u => logisticsStore.isActiveDeliveryCrewUser(u, branchFilter))
      .sort((a, b) => {
        if (a.role === 'driver' && b.role !== 'driver') return -1;
        if (a.role !== 'driver' && b.role === 'driver') return 1;
        return (a.fullName || '').localeCompare(b.fullName || '');
      });
    const names = new Set<string>();
    const result: { id: string; name: string; hasAccount?: boolean }[] = [];
    activeDriverAndHelperUsers.forEach(u => {
      const clean = (u.fullName || '').trim();
      if (clean && !names.has(clean.toLowerCase())) {
        names.add(clean.toLowerCase());
        result.push({ id: u.id, name: clean, hasAccount: true });
      }
    });
    const sortedCrews = [...allCrews].sort((a, b) => {
      const aHelper = String(a.role || '').toLowerCase().includes('helper') || String(a.role || '').toLowerCase().includes('kernet');
      const bHelper = String(b.role || '').toLowerCase().includes('helper') || String(b.role || '').toLowerCase().includes('kernet');
      if (!aHelper && bHelper) return -1;
      if (aHelper && !bHelper) return 1;
      return (a.name || '').localeCompare(b.name || '');
    });
    sortedCrews.forEach(c => {
      if (!c || c.status === 'off') return;
      const clean = (c.name || '').trim();
      const lower = clean.toLowerCase();
      if (!clean || names.has(lower)) return;
      if (result.some(r => logisticsStore.isSameCrewPersonName(r.name, clean))) return;
      const matchedUser = allUsers.find(
        u => `crw-${u.id}` === c.id || logisticsStore.isSameCrewPersonName(u.fullName, clean)
      );
      if (matchedUser) {
        if (!logisticsStore.isActiveDeliveryCrewUser(matchedUser, branchFilter)) return;
      } else {
        if (allUsers.length > 0) return;
        if (branchStore.getCrewBranchId(c.id, c.name) !== branchFilter) return;
      }
      names.add(lower);
      result.push({ id: c.id, name: clean, hasAccount: Boolean(matchedUser) });
    });
    return result;
  };

  const getIntegratedHelpers = (targetBranchId?: string) => {
    const branchFilter = targetBranchId && targetBranchId !== 'ALL' ? targetBranchId : effectiveActiveBranchId;
    const allUsers = logisticsStore.getUsers();
    const allCrews = logisticsStore.getCrews();
    const activeHelperAndDriverUsers = allUsers.filter(u =>
      logisticsStore.isActiveDeliveryCrewUser(u, branchFilter)
    );
    const names = new Set<string>();
    const result: { id: string; name: string; hasAccount?: boolean }[] = [];
    // Utamakan role crew_helper / non-driver yang punya akses Portal Driver Mobile terlebih dahulu kemudian role driver
    const sorted = [...activeHelperAndDriverUsers].sort((a, b) => {
      const aIsHelper = a.role !== 'driver';
      const bIsHelper = b.role !== 'driver';
      if (aIsHelper && !bIsHelper) return -1;
      if (!aIsHelper && bIsHelper) return 1;
      return (a.fullName || '').localeCompare(b.fullName || '');
    });
    sorted.forEach(u => {
      const clean = (u.fullName || '').trim();
      if (clean && !names.has(clean.toLowerCase())) {
        names.add(clean.toLowerCase());
        result.push({ id: u.id, name: clean, hasAccount: true });
      }
    });
    // Tambahkan kru dari tabel crews jika belum ada di daftar dan sesuai cabang aktif
    const sortedCrews = [...allCrews].sort((a, b) => {
      const aHelper = String(a.role || '').toLowerCase().includes('helper') || String(a.role || '').toLowerCase().includes('kernet');
      const bHelper = String(b.role || '').toLowerCase().includes('helper') || String(b.role || '').toLowerCase().includes('kernet');
      if (aHelper && !bHelper) return -1;
      if (!aHelper && bHelper) return 1;
      return (a.name || '').localeCompare(b.name || '');
    });
    sortedCrews.forEach(c => {
      if (!c || c.status === 'off') return;
      const clean = (c.name || '').trim();
      const lower = clean.toLowerCase();
      if (!clean || names.has(lower)) return;
      if (result.some(r => logisticsStore.isSameCrewPersonName(r.name, clean))) return;
      const matchedUser = allUsers.find(
        u => `crw-${u.id}` === c.id || logisticsStore.isSameCrewPersonName(u.fullName, clean)
      );
      if (matchedUser) {
        if (!logisticsStore.isActiveDeliveryCrewUser(matchedUser, branchFilter)) return;
      } else {
        if (allUsers.length > 0) return;
        if (branchStore.getCrewBranchId(c.id, c.name) !== branchFilter) return;
      }
      names.add(lower);
      result.push({ id: c.id, name: clean, hasAccount: Boolean(matchedUser) });
    });
    return result;
  };

  const getTodayIso = () => logisticsStore.getWibTodayIso();

  const addDaysToIso = (isoDate: string, days: number): string => {
    const parts = (isoDate || '').split('-').map(Number);
    if (parts.length !== 3 || parts.some(isNaN)) return getTodayIso();
    const d = new Date(parts[0], parts[1] - 1, parts[2] + days);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };

  const isAreaBaliSchedule = (areaName: string): boolean => {
    const std = standardizeAreaName(areaName).toUpperCase().trim();
    const raw = (areaName || '').toUpperCase().trim();
    return (
      std.includes('NEGARA') ||
      std.includes('SINGARAJA') ||
      std.includes('DENPASAR 1') ||
      std.includes('DENPASAR 2') ||
      std.includes('DENPASAR') ||
      std.includes('KANVAS LKT') ||
      raw.includes('KANVAS LKT')
    );
  };

  const isAreaLuarKotaSchedule = (areaName: string): boolean => {
    const std = standardizeAreaName(areaName).toUpperCase().trim();
    const raw = (areaName || '').toUpperCase().trim();
    return (
      std.includes('JEMBER SELATAN') ||
      std.includes('JEMBER BARAT') ||
      std.includes('JEMBER KOTA') ||
      std.includes('JEMBER') ||
      std.includes('KANVAS LKT') ||
      raw.includes('KANVAS LKT') ||
      std.includes('SITUBONDO') ||
      std.includes('BONDOWOSO') ||
      std.includes('SUSULAN SITUBONDO BONDOWOSO')
    );
  };

  const isAreaBanyuwangiSchedule = (areaName: string): boolean => {
    return !isAreaLuarKotaSchedule(areaName) && !isAreaBaliSchedule(areaName);
  };

  const isLuarKotaArea = (areaName: string): boolean => {
    return isAreaLuarKotaSchedule(areaName) || isAreaBaliSchedule(areaName);
  };

  const [manualScheduleForm, setManualScheduleForm] = useState<{
    dateIso: string;
    departureDateIso: string;
    returnDateIso: string;
    driver: string;
    driverId?: string;
    helper: string;
    helper2: string;
    area: string;
    armada: string;
    target: string;
    departureTime: string;
    targetReturnTime: string;
    branchId: string;
    bypassChecklistDirectComplete: boolean;
  }>(() => {
    const today = getTodayIso();
    const initBranch = branchStore.getSelectedOriginBranchId() !== 'ALL'
      ? branchStore.getSelectedOriginBranchId()
      : 'cab-banyuwangi';
    return {
      dateIso: today,
      departureDateIso: today,
      returnDateIso: today,
      driver: '',
      helper: '',
      helper2: '',
      area: '',
      armada: '',
      target: '',
      departureTime: '07:30',
      targetReturnTime: '16:00',
      branchId: initBranch,
      bypassChecklistDirectComplete: false
    };
  });

  const manualScheduledCrewMap = useMemo(() => {
    return getScheduledCrewForDate(manualScheduleForm.dateIso);
  }, [manualScheduleForm.dateIso]);
  const [areaSearchFilter, setAreaSearchFilter] = useState<string>('');
  const [areaCategoryFilter, setAreaCategoryFilter] = useState<'all' | 'bali' | 'banyuwangi' | 'jember' | 'pantura'>('all');
  const [isAreaPickerExpanded, setIsAreaPickerExpanded] = useState<boolean>(false);

  const getAreaRegionCategory = (areaName: string): { category: 'bali' | 'jember' | 'pantura' | 'banyuwangi' | 'sidoarjo'; label: string; badgeColor: string } => {
    if (isSidoarjoBranch || SIDOARJO_DESTINATION_AREAS.some(a => a.toUpperCase() === areaName.trim().toUpperCase())) {
      return {
        category: 'sidoarjo',
        label: 'Area Kirim Cabang Sidoarjo',
        badgeColor: 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700'
      };
    }
    const upper = areaName.toUpperCase();
    if (upper.includes('DENPASAR') || upper.includes('SINGARAJA') || upper.includes('NEGARA')) {
      return { category: 'bali', label: 'Pulau Bali', badgeColor: 'bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30' };
    }
    if (upper.includes('JEMBER')) {
      return { category: 'jember', label: 'Jember', badgeColor: 'bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/30' };
    }
    if (upper.includes('SITUBONDO') || upper.includes('BONDOWOSO')) {
      return { category: 'pantura', label: 'Situbondo & Bw', badgeColor: 'bg-purple-500/15 text-purple-700 dark:text-purple-400 border-purple-500/30' };
    }
    return { category: 'banyuwangi', label: 'Banyuwangi & Sekitar', badgeColor: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30' };
  };

  const filteredOfficialAreas = useMemo(() => {
    return branchOfficialAreas.filter(areaName => {
      const matchSearch = areaName.toLowerCase().includes(areaSearchFilter.toLowerCase().trim());
      if (!matchSearch) return false;
      if (isSidoarjoBranch || areaCategoryFilter === 'all') return true;
      const cat = getAreaRegionCategory(areaName).category;
      return cat === areaCategoryFilter;
    });
  }, [branchOfficialAreas, isSidoarjoBranch, areaSearchFilter, areaCategoryFilter]);

  const [stagedCombinedTrips, setStagedCombinedTrips] = useState<Array<ParsedSheetTrip & { source: 'excel' | 'manual'; tempId: string }>>([]);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState<boolean>(false);
  const [scheduleChangeLogs, setScheduleChangeLogs] = useState<ScheduleChangeLogEntry[]>(() => logisticsStore.getScheduleChangeLogs());
  const [schemaValidationError, setSchemaValidationError] = useState<any | null>(null);
  const [uploadToast, setUploadToast] = useState<{
    message: string;
    type: 'error' | 'success';
    templateDownloadUrl?: string;
  } | null>(null);

  // Auto-dismiss upload toast notification (menghilang otomatis setelah 4 detik untuk notifikasi sukses)
  useEffect(() => {
    if (!uploadToast) return;
    const duration = uploadToast.type === 'success' ? 4000 : 7000;
    const timer = setTimeout(() => {
      setUploadToast(null);
    }, duration);
    return () => clearTimeout(timer);
  }, [uploadToast]);
  const [isExcelPreviewModalOpen, setIsExcelPreviewModalOpen] = useState<boolean>(false);
  const [previewFile, setPreviewFile] = useState<File | null>(null);
  const [previewHeaders, setPreviewHeaders] = useState<string[]>([]);
  const [previewTopRows, setPreviewTopRows] = useState<any[][]>([]);
  const [previewTotalRows, setPreviewTotalRows] = useState<number>(0);
  const [previewSheetName, setPreviewSheetName] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const modalFileInputRef = useRef<HTMLInputElement | null>(null);

  // Intelligent Area & Crew Auto-Mapping State
  const [detectedAreaMappings, setDetectedAreaMappings] = useState<Record<string, AreaMappingEntry>>({});
  const [officialAreasList, setOfficialAreasList] = useState<OfficialAreaItem[]>(() => areaAutoMapper.getOfficialAreaList());
  const [quickCreateAreaTarget, setQuickCreateAreaTarget] = useState<string | null>(null);

  const [detectedCrewMappings, setDetectedCrewMappings] = useState<Record<string, CrewMappingEntry>>({});
  const [officialCrewsList, setOfficialCrewsList] = useState<OfficialCrewItem[]>(() => crewAutoMapper.getOfficialCrewList());
  const [quickCreateCrewTarget, setQuickCreateCrewTarget] = useState<{ name: string; roleHint?: 'Driver' | 'Helper' } | null>(null);

  const [isAreaMappingModalOpen, setIsAreaMappingModalOpen] = useState<boolean>(false);
  const [activeMappingCategory, setActiveMappingCategory] = useState<'area' | 'crew'>('area');
  const [activeUploadTab, setActiveUploadTab] = useState<'audit' | 'area_mapping' | 'crew_mapping'>('audit');
  const [parsedUploadedTrips, setParsedUploadedTrips] = useState<ParsedSheetTrip[]>([]);
  const [isLiveFetching, setIsLiveFetching] = useState<boolean>(false);

  // Manual In-Place Trip Edit & Creation Modal State
  const [editingTripModal, setEditingTripModal] = useState<{
    isOpen: boolean;
    dayNumber: number;
    dateString: string;
    tripIndex: number;
    scheduleId?: string;
    driver: string;
    driverId?: string;
    helper: string;
    helper2: string;
    area: string;
    armada: string;
    target: string;
    departureDateIso: string;
    returnDateIso: string;
    departureTime: string;
    targetReturnTime: string;
    branchId: string;
    isNew?: boolean;
  } | null>(null);
  const [editTripModalError, setEditTripModalError] = useState<string | null>(null);
  const [manualScheduleFormError, setManualScheduleFormError] = useState<string | null>(null);

  useEffect(() => {
    if ((!editingTripModal?.isOpen && !isUploadConfigModalOpen) || typeof document === 'undefined') return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [editingTripModal?.isOpen, isUploadConfigModalOpen]);

  const editingScheduledCrewMap = useMemo(() => {
    if (!editingTripModal) return new Map<string, { role: string; area: string }>();
    const targetIso = editingTripModal.departureDateIso || editingTripModal.dateString;
    return getScheduledCrewForDate(targetIso, editingTripModal.scheduleId);
  }, [editingTripModal]);

  // Modal state for assigning a Free / Stand By Gudang crew member to replace an absent crew on Hari H
  const [replaceAbsentModal, setReplaceAbsentModal] = useState<{
    isOpen: boolean;
    standbyCrewName: string;
    standbyCrewRole: 'Driver' | 'Helper';
    dayNumber: number;
    dateString: string;
    selectedTripIndex: number;
    replacePosition: 'driver' | 'helper' | 'helper2';
    absentReason: string;
    isRouteDropdownOpen?: boolean;
    isCrewDropdownOpen?: boolean;
    routeSearchQuery?: string;
  } | null>(null);

  // Helper to check if two crew names refer to the same person (handles e.g. "Saiful Rizal" vs "Saifur Rizal" or "Rifaldi Aminulloh" vs "Rifaldi Aminullah")
  const isSameCrewPerson = (nameA: string, nameB: string): boolean => {
    const cleanA = (nameA || '').trim().toLowerCase();
    const cleanB = (nameB || '').trim().toLowerCase();
    if (!cleanA || !cleanB || cleanA === '-' || cleanB === '-') return false;
    if (cleanA === cleanB) return true;
    if (logisticsStore.isSameCrewPersonName(cleanA, cleanB)) return true;
    if (cleanA.includes(cleanB) || cleanB.includes(cleanA)) return true;
    // Handle Saiful Rizal / Saifur Rizal
    if ((cleanA.includes('saiful') || cleanA.includes('saifur')) && (cleanB.includes('saiful') || cleanB.includes('saifur')) && cleanA.includes('rizal') && cleanB.includes('rizal')) {
      return true;
    }
    const tokensA = cleanA.split(/\s+/).filter(t => t.length >= 4);
    const tokensB = cleanB.split(/\s+/).filter(t => t.length >= 4);
    if (tokensA.length > 0 && tokensB.length > 0 && tokensA[0] === tokensB[0]) {
      return true;
    }
    return false;
  };

  // Build unified crew pool & compute Scheduled vs Free/Standby di Gudang for a given day
  const computeDayCrewStandbyBreakdown = (dayObj: AdminScheduleDay | undefined) => {
    const pool: Array<{
      id: string;
      name: string;
      role: 'Driver' | 'Helper';
      phone: string;
      licenseType: string;
      hasPortalAccount: boolean;
    }> = [];

    const addCandidateToPool = (
      id: string,
      rawName: string,
      role: 'Driver' | 'Helper',
      phone: string = '-',
      licenseType: string = 'SIM A / B1',
      hasPortalAccount: boolean = false
    ) => {
      const clean = (rawName || '').trim();
      if (!clean || clean === '-' || clean === '0' || clean.toLowerCase() === 'tanpa helper') return;
      const existing = pool.find(item => isSameCrewPerson(item.name, clean));
      if (existing) {
        if (hasPortalAccount) existing.hasPortalAccount = true;
        if (existing.phone === '-' && phone && phone !== '-') existing.phone = phone;
        return;
      }
      pool.push({
        id,
        name: clean,
        role,
        phone: phone || '-',
        licenseType: licenseType || (role === 'Driver' ? 'SIM B1/B2 Umum' : 'SIM A'),
        hasPortalAccount
      });
    };

    // 1. Approved Driver & Helper accounts in Portal (strictly separated by effectiveActiveBranchId: Sidoarjo vs Nusantara)
    const allUsers = logisticsStore.getUsers();
    allUsers
      .filter(u => logisticsStore.isActiveDeliveryCrewUser(u, effectiveActiveBranchId))
      .forEach(u => {
        addCandidateToPool(
          u.id,
          u.fullName,
          u.role !== 'crew_helper' ? 'Driver' : 'Helper',
          u.phone || '-',
          u.role !== 'crew_helper' ? 'SIM B2 Umum' : 'SIM A',
          true
        );
      });

    // 2. Active Crews from Master Crew Database (strictly separated by effectiveActiveBranchId)
    const allCrews = logisticsStore.getCrews();
    allCrews
      .filter(c => {
        if (c.status === 'off') return false;
        const matchedUser = allUsers.find(
          u => `crw-${u.id}` === c.id || isSameCrewPerson(u.fullName, c.name)
        );
        if (matchedUser) {
          return logisticsStore.isActiveDeliveryCrewUser(matchedUser, effectiveActiveBranchId);
        }
        if (allUsers.length > 0) return false;
        return branchStore.getCrewBranchId(c.id, c.name) === effectiveActiveBranchId;
      })
      .forEach(c => {
        const isHelper = (c.role || '').toLowerCase().includes('helper') || (c.role || '').toLowerCase().includes('kernet');
        addCandidateToPool(
          c.id,
          c.name,
          isHelper ? 'Helper' : 'Driver',
          c.phone || '-',
          c.licenseType || (isHelper ? 'SIM A' : 'SIM B2 Umum'),
          true
        );
      });

    // 3. Also ensure any crew name present in dayObj.pengiriman for this branch is part of the total pool
    const rawPengirimanList = dayObj?.pengiriman || [];
    const storeSchedulesForDay = logisticsStore.getSchedules();
    const dayMonthIdx = MONTH_NAMES.findIndex(m => (dayObj?.dateString || '').toLowerCase().includes(m.toLowerCase()));
    const dayYearMatch = (dayObj?.dateString || '').match(/\b(20\d{2})\b/);
    const targetDayYr = dayYearMatch ? Number(dayYearMatch[1]) : selectedYear;
    const targetDayMo = dayMonthIdx >= 0 ? dayMonthIdx : (selectedMonth === -1 ? new Date().getMonth() : selectedMonth);
    const targetDayNum = dayObj?.dayNumber;

    const isSameDaySchedule = (s: Schedule) => {
      const d = getScheduleCalendarDateObj(s);
      if (!d || isNaN(d.getTime())) return false;
      return d.getFullYear() === targetDayYr && d.getMonth() === targetDayMo && d.getDate() === targetDayNum;
    };

    // Normalize trips so legacy overwritten drivers (e.g. Zainal replacing Budiono) restore original driver to driver column and keep Zainal in backupCrewName
    const pengirimanList = rawPengirimanList.map(p => {
      const matchedSch = storeSchedulesForDay.find(s => {
        if (p.id && s.id === p.id) return true;
        if (!isSameDaySchedule(s)) return false;
        return s.fleet?.initialCode === p.armada && s.areaName === standardizeAreaName(p.area);
      });
      let effectiveDriver = p.driver;
      let effectiveHelper = p.helper;
      let effectiveHelper2 = p.helper2;
      let backupCrewName = p.backupCrewName || matchedSch?.backupCrewName;
      let backupPosition = p.backupPosition || matchedSch?.backupPosition;
      let backupTargetName = p.backupTargetName || matchedSch?.backupTargetName;

      if (!backupCrewName && p.backup) {
        const m = p.backup.match(/Digantikan Kru Stand By Gudang \(([^)]+)\) karena ([^\s(]+(?:\s+[^\s(]+)*?) berhalangan hadir/i);
        if (m) {
          backupCrewName = m[1].trim();
          const orig = m[2].trim();
          if (isSameCrewPerson(effectiveDriver, backupCrewName)) {
            effectiveDriver = orig;
            backupPosition = 'driver';
            backupTargetName = orig;
          }
        }
      }

      const isStaleDriverBackup = Boolean(
        backupCrewName &&
          (!backupPosition || backupPosition === 'driver') &&
          effectiveDriver &&
          effectiveDriver !== '-' &&
          !isSameCrewPerson(effectiveDriver, backupCrewName) &&
          (Boolean(matchedSch && ['picked_up', 'in_transit', 'delivered'].includes(matchedSch.status)) ||
            Boolean(backupTargetName && !isSameCrewPerson(effectiveDriver, backupTargetName)))
      );
      if (isStaleDriverBackup) {
        backupCrewName = undefined;
        backupPosition = undefined;
        backupTargetName = undefined;
      }

      if (backupCrewName && backupTargetName) {
        const pos = backupPosition || 'driver';
        if (pos === 'driver' && isSameCrewPerson(effectiveDriver, backupCrewName)) {
          effectiveDriver = backupTargetName;
        } else if (pos === 'helper' && isSameCrewPerson(effectiveHelper || '', backupCrewName)) {
          effectiveHelper = backupTargetName;
        } else if (pos === 'helper2' && isSameCrewPerson(effectiveHelper2 || '', backupCrewName)) {
          effectiveHelper2 = backupTargetName;
        }
      }

      return {
        ...p,
        driver: effectiveDriver,
        helper: effectiveHelper,
        helper2: effectiveHelper2,
        backupCrewName,
        backupPosition,
        backupTargetName
      };
    });

    const isCrewNameAllowedInBranch = (crewName: string): boolean => {
      const clean = (crewName || '').trim();
      if (!clean || clean === '-') return false;
      const matchedUser = allUsers.find(u => isSameCrewPerson(u.fullName, clean));
      if (matchedUser) {
        return logisticsStore.isActiveDeliveryCrewUser(matchedUser, effectiveActiveBranchId);
      }
      if (allUsers.length > 0) return false;
      return branchStore.getCrewBranchId(clean, clean) === effectiveActiveBranchId;
    };

    pengirimanList.forEach((p, idx) => {
      if (p.driver && p.driver !== '-' && isCrewNameAllowedInBranch(p.driver)) {
        addCandidateToPool(`sched-drv-${idx}`, p.driver, 'Driver', '-', 'SIM B1/B2 Umum', true);
      }
      if (p.helper && p.helper !== '-') {
        p.helper.split(/[,&/]+/).forEach((h, hIdx) => {
          if (isCrewNameAllowedInBranch(h.trim())) {
            addCandidateToPool(`sched-hlp1-${idx}-${hIdx}`, h.trim(), 'Helper', '-', 'SIM A', true);
          }
        });
      }
      if (p.helper2 && p.helper2 !== '-') {
        p.helper2.split(/[,&/]+/).forEach((h, hIdx) => {
          if (isCrewNameAllowedInBranch(h.trim())) {
            addCandidateToPool(`sched-hlp2-${idx}-${hIdx}`, h.trim(), 'Helper', '-', 'SIM A', true);
          }
        });
      }
    });

    // Track scheduled crews on this day (based on original scheduled driver/helper, NOT backupCrewName)
    const scheduledCrews: Array<{
      id: string;
      name: string;
      role: 'Driver' | 'Helper';
      assignedRoleLabel: string;
      assignedAreas: string[];
      assignedArmadas: string[];
    }> = [];

    const freeStandbyCrews: Array<{
      id: string;
      name: string;
      role: 'Driver' | 'Helper';
      phone: string;
      licenseType: string;
      hasPortalAccount: boolean;
      warehouseDutyNote: string;
      isReplacing?: boolean;
      replacedCrewName?: string;
      replacedPositionLabel?: string;
      replacedAreaName?: string;
    }> = [];

    pool.forEach(member => {
      const memberTripsAsDriver = pengirimanList.filter(p => isSameCrewPerson(p.driver, member.name));
      const memberTripsAsHelper1 = pengirimanList.filter(p =>
        (p.helper || '').split(/[,&/]+/).some(h => isSameCrewPerson(h.trim(), member.name))
      );
      const memberTripsAsHelper2 = pengirimanList.filter(p =>
        (p.helper2 || '').split(/[,&/]+/).some(h => isSameCrewPerson(h.trim(), member.name))
      );

      const allMemberTrips = [...memberTripsAsDriver, ...memberTripsAsHelper1, ...memberTripsAsHelper2];

      if (allMemberTrips.length > 0) {
        const areas = Array.from(new Set(allMemberTrips.map(t => standardizeAreaName(t.area))));
        const armadas = Array.from(new Set(allMemberTrips.map(t => t.armada)));
        const roleLabels: string[] = [];
        if (memberTripsAsDriver.length > 0) roleLabels.push('Driver');
        if (memberTripsAsHelper1.length > 0) roleLabels.push('Helper 1');
        if (memberTripsAsHelper2.length > 0) roleLabels.push('Helper 2');

        scheduledCrews.push({
          id: member.id,
          name: member.name,
          role: member.role,
          assignedRoleLabel: roleLabels.join(' & ') || member.role,
          assignedAreas: areas,
          assignedArmadas: armadas
        });
      } else {
        // Check if this Free crew member is currently assigned as Back Up / Menggantikan on any trip today
        const backupTrip = pengirimanList.find(p => p.backupCrewName && isSameCrewPerson(p.backupCrewName, member.name));
        if (backupTrip) {
          const pos = backupTrip.backupPosition || 'driver';
          const posLabel = pos === 'helper' ? 'Helper 1' : pos === 'helper2' ? 'Helper 2' : 'Driver';
          const targetOriginalName =
            backupTrip.backupTargetName ||
            (pos === 'helper' ? backupTrip.helper : pos === 'helper2' ? backupTrip.helper2 : backupTrip.driver) ||
            '-';
          const areaClean = standardizeAreaName(backupTrip.area);
          freeStandbyCrews.push({
            ...member,
            isReplacing: true,
            replacedCrewName: targetOriginalName,
            replacedPositionLabel: posLabel,
            replacedAreaName: areaClean,
            warehouseDutyNote: `Menggantikan ${posLabel} ${targetOriginalName} untuk mengirim ke area ${areaClean}`
          });
        } else {
          freeStandbyCrews.push({
            ...member,
            isReplacing: false,
            warehouseDutyNote: 'Stand By Gudang DC • Siap Gantikan Kru Kiriman Berhalangan'
          });
        }
      }
    });

    const resultBreakdown = {
      totalCrewCount: scheduledCrews.length + freeStandbyCrews.length,
      scheduledCrewCount: scheduledCrews.length,
      freeStandbyCount: freeStandbyCrews.length,
      scheduledCrews,
      freeStandbyCrews
    };

    return resultBreakdown;
  };

  const handleConfirmReplaceAbsentCrew = () => {
    if (!canEditSchedules) return;
    if (!replaceAbsentModal) return;
    const { standbyCrewName, dayNumber, dateString, selectedTripIndex, replacePosition } = replaceAbsentModal;

    const allDaysFlat = weeks.flatMap(w => w.days);
    const targetDay = allDaysFlat.find(d => d.dateString === dateString || d.dayNumber === dayNumber);
    if (!targetDay || !targetDay.pengiriman[selectedTripIndex]) {
      setReplaceAbsentModal(null);
      return;
    }

    const targetTrip = targetDay.pengiriman[selectedTripIndex];
    const previousCrewName =
      replacePosition === 'driver'
        ? targetTrip.driver
        : replacePosition === 'helper'
        ? (targetTrip.helper || '-')
        : (targetTrip.helper2 || '-');

    const posLabel = replacePosition === 'helper' ? 'Helper 1' : replacePosition === 'helper2' ? 'Helper 2' : 'Driver';

    // Update Schedule in logisticsStore so Driver Portal immediately updates (keep original crew intact, store replacement in backup fields)
    const effectiveMonth = selectedMonth === -1 ? 0 : selectedMonth;
    const storeSchedules = logisticsStore.getSchedules();
    const allCrews = logisticsStore.getCrews();
    const matchedStandbyCrewObj = allCrews.find(c => isSameCrewPerson(c.name, standbyCrewName)) || {
      id: `crw-standby-${Date.now()}`,
      name: standbyCrewName,
      phone: '-',
      role: replacePosition === 'driver' ? 'Driver Utama' : 'Kernet / Helper',
      licenseNumber: '-',
      licenseType: replacePosition === 'driver' ? 'SIM B1/B2 Umum' : 'SIM A',
      status: 'on-duty' as const,
      tripsCompleted: 50,
      rating: 4.8
    };

    const updatedTrip: DeliveryAssignment = {
      ...targetTrip,
      backupCrewId: matchedStandbyCrewObj.id,
      backupCrewName: standbyCrewName,
      backupPosition: replacePosition,
      backupTargetName: previousCrewName,
      backup: `${standbyCrewName} (Menggantikan ${posLabel} ${previousCrewName})`,
      isManuallyEdited: true
    };

    const matchedStoreSch = storeSchedules.find(s => {
      if (targetTrip.id && s.id === targetTrip.id) return true;
      if (!s.departureDate) return false;
      const d = new Date(s.departureDate);
      const isSameDay = d.getFullYear() === selectedYear && d.getMonth() === effectiveMonth && d.getDate() === targetDay.dayNumber;
      if (!isSameDay) return false;
      return s.fleet?.initialCode === targetTrip.armada || s.areaName === standardizeAreaName(targetTrip.area);
    });

    if (matchedStoreSch) {
      const properFleet =
        logisticsStore.findFleetByCodeOrPlate(targetTrip.armada, targetTrip.area) ||
        (/muncar/i.test(targetTrip.area) ? logisticsStore.findFleetByCodeOrPlate('N4 / NS2') : undefined) ||
        matchedStoreSch.fleet;
      const patch: Partial<Schedule> = {
        fleetId: properFleet?.id || matchedStoreSch.fleetId,
        fleet: properFleet || matchedStoreSch.fleet,
        backupCrewId: matchedStandbyCrewObj.id,
        backupCrewName: standbyCrewName,
        backupPosition: replacePosition,
        backupTargetName: previousCrewName,
        isManuallyEdited: true
      };
      logisticsStore.updateSchedule(matchedStoreSch.id, patch);
    } else {
      const dateIsoStr = `${selectedYear}-${String(effectiveMonth + 1).padStart(2, '0')}-${String(targetDay.dayNumber).padStart(2, '0')}`;
      const matchedFleet =
        logisticsStore.findFleetByCodeOrPlate(targetTrip.armada, targetTrip.area) ||
        (/muncar/i.test(targetTrip.area) ? logisticsStore.findFleetByCodeOrPlate('N4 / NS2') : undefined) ||
        logisticsStore.getFleets().find(f => (f.initialCode || '').includes('NS2') || (f.initialCode || '').includes('N4')) ||
        logisticsStore.getFleets()[0];
      const matchedDriverObj = allCrews.find(c => isSameCrewPerson(c.name, targetTrip.driver)) || matchedStandbyCrewObj;
      const matchedHelperObj = targetTrip.helper
        ? allCrews.find(c => isSameCrewPerson(c.name, targetTrip.helper))
        : undefined;
      const matchedHelper2Obj = targetTrip.helper2
        ? allCrews.find(c => isSameCrewPerson(c.name, targetTrip.helper2 ?? ''))
        : undefined;
      const stores = logisticsStore.getStores();
      const matchedStore =
        stores.find(st => st.storeName.toLowerCase() === standardizeAreaName(targetTrip.area).toLowerCase()) ||
        stores[0];

      logisticsStore.addSchedule({
        trackingNumber: `SJ-${Date.now().toString().slice(-6)}`,
        areaName: standardizeAreaName(targetTrip.area),
        originName: 'Gudang Utama AKK Banyuwangi (Rogojampi)',
        originCoords: [-8.3168, 114.2908],
        isInterIsland: /denpasar|singaraja|tabanan|gianyar|badung|klungkung|karangasem|bangli|jembrana|negara|lombok|mataram|bali/i.test(targetTrip.area),
        storeId: matchedStore?.id || 'str-1',
        store: matchedStore,
        fleetId: matchedFleet?.id || 'flt-1',
        fleet: matchedFleet,
        crewId: matchedDriverObj.id,
        crew: matchedDriverObj,
        crewHelperId: matchedHelperObj?.id,
        crewHelper: matchedHelperObj,
        crewHelper2Id: matchedHelper2Obj?.id,
        crewHelper2: matchedHelper2Obj,
        backupCrewId: matchedStandbyCrewObj.id,
        backupCrewName: standbyCrewName,
        backupPosition: replacePosition,
        backupTargetName: previousCrewName,
        cargoDescription: 'Karton Box Pengiriman AKK',
        cargoWeightTon: 1.2,
        departureDate: `${dateIsoStr}T07:30:00`,
        returnDate: `${dateIsoStr}T16:00:00`,
        estimatedArrival: '16:00 WIB',
        status: 'scheduled',
        isManuallyEdited: true
      });
    }

    // Update weeks state while keeping original crew in driver/helper columns
    const newWeeks = weeks.map(w => ({
      ...w,
      days: w.days.map(d => {
        if (d.dayNumber === targetDay.dayNumber && d.dateString === targetDay.dateString) {
          const nextPengiriman = [...d.pengiriman];
          nextPengiriman[selectedTripIndex] = updatedTrip;
          return {
            ...d,
            pengiriman: nextPengiriman
          };
        }
        return d;
      })
    }));

    updateWeeks(newWeeks);
    logisticsStore.syncSchedulesToCrewHistory();
    void persistSchedulesToDatabase(logisticsStore.getSchedules());
    logisticsStore.addScheduleChangeLog({
      fileName: `Penggantian Kru Hari H (${dateString})`,
      actionType: 'manual_edit',
      summary: `Kru Free/Stand By Gudang (${standbyCrewName}) menggantikan ${posLabel} ${previousCrewName} untuk mengirim ke area ${standardizeAreaName(targetTrip.area)} (${targetTrip.armada})`,
      rowCount: 1,
      changes: [
        `Tanggal Hari H: ${dateString} | Rute Area: ${standardizeAreaName(targetTrip.area)} (${targetTrip.armada})`,
        `Posisi Digantikan: ${posLabel} (${previousCrewName})`,
        `Back Up / Yang Menggantikan: ${standbyCrewName} → Tersinkron ke Portal Driver`
      ]
    });
    setScheduleChangeLogs(logisticsStore.getScheduleChangeLogs());
    setReplaceAbsentModal(null);
    setSyncSuccessMessage(
      `✅ Kru Free (${standbyCrewName}) berhasil ditugaskan menggantikan ${posLabel} ${previousCrewName} untuk mengirim ke area ${standardizeAreaName(targetTrip.area)}!`
    );
    setTimeout(() => setSyncSuccessMessage(null), 6500);
  };

  // Fitur "Tidak Jadi Ganti" untuk membatalkan penggantikan kru Hari H agar tidak muncul lagi pada rincian jadwal
  const handleCancelReplaceAbsentCrew = (targetCrewName?: string) => {
    if (!canEditSchedules) return;
    const crewNameToCancel = targetCrewName || replaceAbsentModal?.standbyCrewName;
    if (!crewNameToCancel) {
      setReplaceAbsentModal(null);
      return;
    }

    // 1. Bersihkan data backup dari semua pengiriman di weeks untuk kru ini
    const newWeeks = weeks.map(w => ({
      ...w,
      days: w.days.map(d => ({
        ...d,
        pengiriman: d.pengiriman.map(p => {
          if (p.backupCrewName && isSameCrewPerson(p.backupCrewName, crewNameToCancel)) {
            const { backupCrewId, backupCrewName, backupPosition, backupTargetName, backup, ...rest } = p;
            return {
              ...rest,
              backupCrewId: undefined,
              backupCrewName: undefined,
              backupPosition: undefined,
              backupTargetName: undefined,
              backup: undefined,
              isManuallyEdited: true
            };
          }
          return p;
        })
      }))
    }));

    // 2. Bersihkan data backup dari jadwal di logisticsStore
    const allSchedules = logisticsStore.getSchedules();
    allSchedules.forEach(s => {
      if (s.backupCrewName && isSameCrewPerson(s.backupCrewName, crewNameToCancel)) {
        const cleanedNotes = (s.notes || '')
          .replace(/\s*•?\s*\[(?:PORTAL DRIVER|STAND BY)?\s*HARI H:[^\]]*]/gi, '')
          .trim();
        logisticsStore.updateSchedule(s.id, {
          backupCrewId: undefined,
          backupCrewName: undefined,
          backupPosition: undefined,
          backupTargetName: undefined,
          notes: cleanedNotes,
          isManuallyEdited: true
        });
      }
    });

    // 3. Perbarui week cache di logisticsStore & bersihkan legacy localStorage
    const effectiveMonth = selectedMonth === -1 ? 0 : selectedMonth;
    const cachedWeeks = logisticsStore.getAdminScheduleWeeks(selectedYear, effectiveMonth);
    if (Array.isArray(cachedWeeks) && cachedWeeks.length > 0) {
      const cleanedWeeks = cachedWeeks.map((w: any) => ({
        ...w,
        days: Array.isArray(w.days)
          ? w.days.map((d: any) => ({
              ...d,
              pengiriman: Array.isArray(d.pengiriman)
                ? d.pengiriman.map((p: any) => {
                    if (p.backupCrewName && isSameCrewPerson(p.backupCrewName, crewNameToCancel)) {
                      return {
                        ...p,
                        backupCrewId: undefined,
                        backupCrewName: undefined,
                        backupPosition: undefined,
                        backupTargetName: undefined,
                        backup: undefined
                      };
                    }
                    return p;
                  })
                : d.pengiriman
            }))
          : w.days
      }));
      logisticsStore.saveAdminScheduleWeeks(selectedYear, effectiveMonth, cleanedWeeks);
    }

    updateWeeks(newWeeks);
    logisticsStore.syncSchedulesToCrewHistory();
    void persistSchedulesToDatabase(logisticsStore.getSchedules());

    logisticsStore.addScheduleChangeLog({
      fileName: `Tidak Jadi Ganti (${selectedCalendarDate})`,
      actionType: 'manual_edit',
      summary: `Penggantian dibatalkan: ${crewNameToCancel} tidak jadi menggantikan kru kiriman dan tetap Stand By di Gudang DC`,
      rowCount: 1,
      changes: [
        `Tanggal: ${selectedCalendarDate}`,
        `Kru: ${crewNameToCancel}`,
        `Status: Tidak Jadi Ganti (Kembali Stand By di Gudang DC)`
      ]
    });
    setScheduleChangeLogs(logisticsStore.getScheduleChangeLogs());

    setReplaceAbsentModal(null);
    setSyncSuccessMessage(
      `✅ Berhasil: ${crewNameToCancel} tidak jadi menggantikan dan kembali ke status Stand By Gudang.`
    );
    setTimeout(() => setSyncSuccessMessage(null), 6500);
  };

  // Batalkan penggantian langsung dari baris rincian jadwal kirim
  const handleCancelTripReplacement = (trip: DeliveryAssignment) => {
    const backupName = trip.backupCrewName;
    if (!backupName && !trip.backup) return;
    const nameToCancel = backupName || (trip.backup ? trip.backup.split(' ')[0] : undefined);
    handleCancelReplaceAbsentCrew(nameToCancel);
  };

  // Track expanded state for day dropdown accordions
  const [expandedDays, setExpandedDays] = useState<Record<string, boolean>>({});

  const toggleDayExpand = (dayDateString: string) => {
    setExpandedDays(prev => ({
      ...prev,
      [dayDateString]: prev[dayDateString] === undefined ? false : !prev[dayDateString]
    }));
  };

  const handleOpenEditTripModal = (
    p: DeliveryAssignment,
    dayNumber: number,
    dateString: string,
    tripIndex: number
  ) => {
    setEditTripModalError(null);
    const effectiveMo = selectedMonth === -1 ? 0 : selectedMonth;
    const defaultDayIso = `${selectedYear}-${String(effectiveMo + 1).padStart(2, '0')}-${String(dayNumber).padStart(2, '0')}`;
    const tripBranch = p.branchId || (p.id ? branchStore.getScheduleBranchId(p.id, p.target, p.armada) : (branchStore.getSelectedOriginBranchId() !== 'ALL' ? branchStore.getSelectedOriginBranchId() : 'cab-banyuwangi'));
    const sourceSchedule = p.id ? logisticsStore.getSchedules().find(s => s.id === p.id) : undefined;
    setEditingTripModal({
      isOpen: true,
      dayNumber,
      dateString,
      tripIndex,
      scheduleId: p.id,
      driver: p.driver,
      driverId: sourceSchedule?.crewId || sourceSchedule?.crew?.id || '',
      helper: p.helper && p.helper !== '-' ? p.helper : '',
      helper2: p.helper2 && p.helper2 !== '-' ? p.helper2 : '',
      area: p.area,
      armada: p.armada,
      target: p.target || '',
      departureDateIso: p.departureDateIso || defaultDayIso,
      returnDateIso: p.returnDateIso || defaultDayIso,
      departureTime: p.departureTime || '07:30',
      targetReturnTime: p.targetReturnTime || '16:00',
      branchId: tripBranch,
      isNew: false
    });
  };

  const handleOpenAddTripModal = (dayNumber: number, dateString: string) => {
    setEditTripModalError(null);
    const defaultDriverOption = getIntegratedDrivers()[0];
    const defaultDriver = defaultDriverOption?.name || 'Budiono';
    const defaultHelper = getIntegratedHelpers()[0]?.name || 'Saifur Rizal';
    const effectiveMo = selectedMonth === -1 ? 0 : selectedMonth;
    const defaultDayIso = `${selectedYear}-${String(effectiveMo + 1).padStart(2, '0')}-${String(dayNumber).padStart(2, '0')}`;
    const currentBranch = branchStore.getSelectedOriginBranchId() !== 'ALL' ? branchStore.getSelectedOriginBranchId() : 'cab-banyuwangi';
    setEditingTripModal({
      isOpen: true,
      dayNumber,
      dateString,
      tripIndex: -1,
      scheduleId: undefined,
      driver: defaultDriver,
      driverId: defaultDriverOption?.id || '',
      helper: defaultHelper,
      helper2: '',
      area: '',
      armada: '',
      target: '',
      departureDateIso: defaultDayIso,
      returnDateIso: defaultDayIso,
      departureTime: '07:30',
      targetReturnTime: '17:00',
      branchId: currentBranch,
      isNew: true
    });
  };

  // Real-Time Auto-Sync State (in-memory session toggle, default: false)
  const [isAutoSyncEnabled, setIsAutoSyncEnabled] = useState<boolean>(false);

  const toggleAutoSync = () => {
    setIsAutoSyncEnabled(prev => !prev);
  };

  // Seed initial template weeks into logisticsStore if no operational schedules exist for this month yet
  const seedWeeksIntoStore = (weeksToSeed: AdminScheduleWeek[], year: number, month: number) => {
    const existing = logisticsStore.getSchedules();
    const hasMonthSchedules = existing.some(s => {
      if (!s.departureDate) return false;
      const d = new Date(s.departureDate);
      return !isNaN(d.getTime()) && d.getFullYear() === year && d.getMonth() === month;
    });

    if (hasMonthSchedules) return;

    const monthPadded = String(month + 1).padStart(2, '0');
    const fleets = logisticsStore.getFleets();
    const crews = logisticsStore.getCrews();
    const driverCrews = logisticsStore.getDriverCrews();
    const helperCrews = logisticsStore.getHelperCrews();
    const seededSchedules: Schedule[] = [];

    weeksToSeed.forEach(w => {
      w.days.forEach(d => {
        const dayPadded = String(d.dayNumber).padStart(2, '0');
        const departureIso = `${year}-${monthPadded}-${dayPadded}T07:30:00.000Z`;
        const estArrivalIso = `${year}-${monthPadded}-${dayPadded}T18:00:00.000Z`;

        d.pengiriman.forEach((p, pIdx) => {
          const matchedFleet =
            logisticsStore.findFleetByCodeOrPlate(p.armada) ||
            fleets.find(f =>
              f.initialCode?.toUpperCase() === p.armada.toUpperCase() ||
              f.plateNumber.replace(/\s+/g, '').toUpperCase().includes(p.armada.replace(/\s+/g, '').toUpperCase())
            ) ||
            fleets[pIdx % fleets.length] ||
            fleets[0];

          const matchedDriver = driverCrews.find(c => 
            c.name.toLowerCase().includes(p.driver.toLowerCase()) || 
            p.driver.toLowerCase().includes(c.name.toLowerCase())
          ) || driverCrews[0] || crews[0];

          const matchedHelper = p.helper && p.helper !== '-' ? (helperCrews.find(c =>
            c.name.toLowerCase().includes(p.helper.toLowerCase()) ||
            p.helper.toLowerCase().includes(c.name.toLowerCase())
          ) || helperCrews[0]) : undefined;

          const areaStd = standardizeAreaName(p.area);
          const isBali = areaStd.includes('DENPASAR') || areaStd.includes('SINGARAJA') || areaStd.includes('NEGARA') || areaStd.includes('BALI');

          const newSch: Schedule = {
            id: p.id || `sch-${year}${monthPadded}${dayPadded}-${p.armada}-${pIdx + 1}`,
            trackingNumber: `PO-AKK-${year}${monthPadded}${dayPadded}-${p.armada}-${pIdx + 1}`,
            originName: 'Gudang Pusat AKK Banyuwangi DC',
            originCoords: [-8.1906, 114.3708],
            storeId: `area-${areaStd.toLowerCase().replace(/[^a-z0-9]/g, '-')}`,
            store: {
              id: `area-${areaStd.toLowerCase().replace(/[^a-z0-9]/g, '-')}`,
              storeCode: `AREA-${areaStd.substring(0, 4).toUpperCase().replace(/[^A-Z0-9]/g, '')}`,
              storeName: areaStd,
              island: isBali ? 'Bali & Nusa Tenggara' : 'Jawa',
              province: isBali ? 'Bali' : 'Jawa Timur',
              city: isBali ? 'Denpasar' : 'Banyuwangi',
              address: `Area Pengiriman ${areaStd}`,
              latitude: isBali ? -8.6705 : -8.219,
              longitude: isBali ? -115.2126 : 114.369,
              contactPerson: 'PIC Distribusi Area',
              phone: '-',
              deliveryWindow: '08:00 - 17:00',
              storeCategory: 'Distribution Hub'
            },
            areaName: areaStd,
            fleetId: matchedFleet ? matchedFleet.id : 'flt-01',
            fleet: matchedFleet,
            armada: matchedFleet?.initialCode || p.armada,
            crewId: matchedDriver ? matchedDriver.id : 'crw-10',
            crew: matchedDriver,
            crewHelperId: matchedHelper ? matchedHelper.id : undefined,
            crewHelper: matchedHelper,
            status: 'scheduled',
            departureDate: departureIso,
            estimatedArrival: estArrivalIso,
            cargoDescription: `Karton Box & Sheet Kemasan - Area ${areaStd}`,
            cargoWeightTon: isBali ? 4.5 : 2.5,
            isInterIsland: isBali,
            ferryBookingCode: isBali ? `ASDP-KTP-GLM-${pIdx + 100}` : undefined,
            transitPort: isBali ? 'Pelabuhan Ketapang Banyuwangi -> Gilimanuk Bali' : undefined,
            notes: p.target || `Rute ${areaStd}`,
            createdAt: new Date().toISOString(),
            isManuallyEdited: false
          };

          seededSchedules.push(newSch);
        });
      });
    });

    if (seededSchedules.length > 0) {
      try {
        logisticsStore.batchSyncSchedules(seededSchedules, [], { isImport: false });
      } catch {}
    }
  };

  // Month-specific active schedule dataset: strictly derived from real schedules in logisticsStore
  const [weeks, setWeeks] = useState<AdminScheduleWeek[]>(() => {
    const effectiveMonth = selectedMonth === -1 ? new Date().getMonth() : selectedMonth;
    const storeSchedules = logisticsStore.getSchedules();
    return convertSchedulesToAdminWeeks(storeSchedules, selectedYear, effectiveMonth);
  });

  const weeksRef = React.useRef(weeks);
  weeksRef.current = weeks;

  const selectedYearMonthRef = React.useRef({ year: selectedYear, month: selectedMonth });
  selectedYearMonthRef.current = { year: selectedYear, month: selectedMonth };

  // On initial mount, clear legacy browser caches & load authoritative persisted schedules from MySQL
  useEffect(() => {
    try {
      if (typeof localStorage !== 'undefined') {
        Object.keys(localStorage).forEach(k => {
          if (
            k.startsWith('akk_admin_schedule_cache_') ||
            k === 'akk_admin_schedule_weeks_cache' ||
            k === 'akk_standby_crew_snapshot' ||
            k === 'akk_auto_sync_enabled'
          ) {
            localStorage.removeItem(k);
          }
        });
      }
    } catch {}

    logisticsStore
      .hydrateOperationalDataFromHostinger(true)
      .then(() => {
        const { year: curYr, month: curMo } = selectedYearMonthRef.current;
        const effectiveMo = curMo === -1 ? new Date().getMonth() : curMo;
        const syncedWeeks = convertSchedulesToAdminWeeks(logisticsStore.getSchedules(), curYr, effectiveMo);
        setWeeks(syncedWeeks);
      })
      .catch(err => console.warn('[Database Persistence Load Error]', err));
  }, []);

  // Keep weeks and store in sync whenever selectedYear, selectedMonth changes or store updates
  useEffect(() => {
    const effectiveMonth = selectedMonth === -1 ? new Date().getMonth() : selectedMonth;
    const storeSchedules = logisticsStore.getSchedules();
    const weeksFromStore = convertSchedulesToAdminWeeks(storeSchedules, selectedYear, effectiveMonth);
    setWeeks(weeksFromStore);

    const monthName = MONTH_NAMES[effectiveMonth] || 'Januari';
    const expectedSuffix = `${monthName} ${selectedYear}`;
    if (!selectedCalendarDate.endsWith(expectedSuffix)) {
      const firstScheduledDate = weeksFromStore[0]?.days?.[0]?.dateString;
      const now = new Date();
      const defaultDayNum = (now.getFullYear() === selectedYear && now.getMonth() === effectiveMonth)
        ? String(now.getDate()).padStart(2, '0')
        : '01';
      const nextCalDate = firstScheduledDate || `${defaultDayNum} ${expectedSuffix}`;
      setSelectedCalendarDate(nextCalDate);
      setSelectedDayFilter(nextCalDate);
    }

    // Subscribe to store updates (from manual edits in ScheduleManagement, Portal Driver, or modals)
    const refreshWeeksFromStore = () => {
      setOfficialCrewsList(crewAutoMapper.getOfficialCrewList());
      setOfficialAreasList(areaAutoMapper.getOfficialAreaList());
      setScheduleChangeLogs(logisticsStore.getScheduleChangeLogs());

      const curSchedules = logisticsStore.getSchedules();
      const updatedWeeks = convertSchedulesToAdminWeeks(curSchedules, selectedYear, effectiveMonth);
      setWeeks(updatedWeeks);
    };

    const unsubscribe = logisticsStore.subscribe(refreshWeeksFromStore);
    window.addEventListener('akk-portal-schedule-updated', refreshWeeksFromStore);
    window.addEventListener('storage', refreshWeeksFromStore);

    return () => {
      unsubscribe();
      window.removeEventListener('akk-portal-schedule-updated', refreshWeeksFromStore);
      window.removeEventListener('storage', refreshWeeksFromStore);
    };
  }, [selectedYear, selectedMonth]);

  // Listen for "+ Jadwal Baru" created in ScheduleManagement so it immediately reflects in Jadwal & Penugasan
  useEffect(() => {
    const handleNewScheduleAdded = (evt: Event) => {
      const customEvt = evt as CustomEvent<Schedule>;
      const created = customEvt.detail;
      if (!created || !created.departureDate) return;

      const d = getScheduleCalendarDateObj(created) || new Date(created.departureDate);
      if (isNaN(d.getTime())) return;

      const yr = d.getFullYear();
      const mo = d.getMonth();
      const dayNum = d.getDate();
      const dateStr = `${String(dayNum).padStart(2, '0')} ${MONTH_NAMES[mo]} ${yr}`;

      const stdArea = standardizeAreaName(created.areaName || created.store?.storeName || '');
      const armadaCode = created.fleet?.initialCode || created.fleet?.plateNumber || 'DS1';
      const driverLabel = created.crew?.name || '-';

      const updatedWeeks = convertSchedulesToAdminWeeks(logisticsStore.getSchedules(), yr, mo);

      if (selectedYear !== yr) setSelectedYear(yr);
      if (selectedMonth !== -1 && selectedMonth !== mo) setSelectedMonth(mo);
      setWeeks(updatedWeeks);
      setSelectedCalendarDate(dateStr);
      setSelectedDayFilter(dateStr);
      setScheduleChangeLogs(logisticsStore.getScheduleChangeLogs());
      setSyncSuccessMessage(`✅ Jadwal baru (${driverLabel} • ${stdArea} • ${armadaCode}) otomatis masuk ke Jadwal & Penugasan dan Portal Driver!`);
      setTimeout(() => setSyncSuccessMessage(null), 6000);
    };

    window.addEventListener('akk-new-schedule-added', handleNewScheduleAdded);
    return () => window.removeEventListener('akk-new-schedule-added', handleNewScheduleAdded);
  }, [selectedYear, selectedMonth]);

  // Background store persistence timer
  useEffect(() => {
    if (!isAutoSyncEnabled) return;

    const intervalId = setInterval(() => {
      const effectiveMonth = selectedMonth === -1 ? 0 : selectedMonth;
      logisticsStore.saveAdminScheduleWeeks(selectedYear, effectiveMonth, weeksRef.current);
    }, 60000);

    return () => clearInterval(intervalId);
  }, [isAutoSyncEnabled, selectedYear, selectedMonth]);

  const updateWeeks = (newWeeks: AdminScheduleWeek[]) => {
    setWeeks(newWeeks);
    const effectiveMonth = selectedMonth === -1 ? 0 : selectedMonth;
    logisticsStore.saveAdminScheduleWeeks(selectedYear, effectiveMonth, newWeeks);
  };

  // Merge new parsed trips (from Excel upload and/or manual schedule creation) into existing weeks & store
  const mergeAndSaveCombinedTrips = (
    incomingTrips: Array<ParsedSheetTrip & { source?: 'excel' | 'manual'; bypassChecklistDirectComplete?: boolean }>,
    mode: 'tambahkan' | 'ganti' = 'tambahkan',
    sourceLabel: string = 'Kombinasi Tambah & Unggah Jadwal'
  ): boolean => {
    if (!canEditSchedules) return false;
    if (!incomingTrips || incomingTrips.length === 0) return false;

    const effectiveMonth = selectedMonth === -1 ? 0 : selectedMonth;
    const defaultDateObj = new Date(selectedYear, effectiveMonth, 5);
    const DAY_NAMES_ID = ['MINGGU', 'SENIN', 'SELASA', 'RABU', 'KAMIS', 'JUMAT', 'SABTU'];

    // Build dayMap from existing weeks if mode === 'tambahkan'
    const dayMap = new Map<number, AdminScheduleDay>();
    if (mode === 'tambahkan') {
      weeksRef.current.forEach(w => {
        w.days.forEach(d => {
          dayMap.set(d.dayNumber, {
            ...d,
            pengiriman: [...d.pengiriman]
          });
        });
      });
    }

    let lastFocusedDateString = selectedCalendarDate;
    let targetYear = selectedYear;
    let targetMonth = effectiveMonth;

    const fleets = logisticsStore.getFleets();
    const crews = logisticsStore.getCrews();
    const driverCrews = logisticsStore.getDriverCrews();
    const helperCrews = logisticsStore.getHelperCrews();

    const changeDetails: string[] = [];
    const newSchedulesToBatch: Schedule[] = [];
    const batchFleetDateKeys = new Set<string>();
    const skippedDuplicateArmadaList: string[] = [];
    let addedExcelCount = 0;
    let addedManualCount = 0;

    incomingTrips.forEach((t, idx) => {
      const tripBranchId = (t as any).branchId || effectiveActiveBranchId;
      const tripBranchInfo = branchStore.getBranchById(tripBranchId);
      const branchFleets = fleets.filter(
        f => branchStore.getFleetBranchId(f.id, f.plateNumber, f.initialCode) === tripBranchId
      );
      const stdArea = standardizeAreaName(t.area || '-', tripBranchId);
      const isLuarKota = tripBranchId === 'cab-sidoarjo' ? false : isLuarKotaArea(stdArea);
      const depTime = (t.departureTime || '07:30').trim();
      const retTime = (t.targetReturnTime || '17:00').trim();

      const rawBaseDate = t.dateStr || `${selectedYear}-${String(effectiveMonth + 1).padStart(2, '0')}-05`;
      const parsedBaseRes = scheduleImportValidator.parseDate(rawBaseDate, defaultDateObj);
      const baseDObj = parsedBaseRes.date || defaultDateObj;
      const baseIso = `${baseDObj.getFullYear()}-${String(baseDObj.getMonth() + 1).padStart(2, '0')}-${String(baseDObj.getDate()).padStart(2, '0')}`;

      const depDateIso = t.departureDateIso || baseIso;
      const defaultRetIso = isLuarKota && depTime > retTime ? addDaysToIso(depDateIso, 1) : depDateIso;
      const retDateIso = t.returnDateIso || defaultRetIso;

      // Jika rute luar kota atau kepulangan jatuh di hari berikutnya (misal berangkat malam tgl 26, pulang besok tgl 27),
      // maka penempatan di kalender mengikuti Tanggal Kepulangan (retDateIso).
      const effectiveCalendarIso = (isLuarKota || retDateIso > depDateIso) ? retDateIso : depDateIso;
      const parsedCalRes = scheduleImportValidator.parseDate(effectiveCalendarIso, baseDObj);
      const dObj = parsedCalRes.date || baseDObj;

      const yr = dObj.getFullYear();
      const mo = dObj.getMonth();
      const dayNum = dObj.getDate();
      targetYear = yr;
      targetMonth = mo;

      const dayName = DAY_NAMES_ID[dObj.getDay()] || t.dayName || 'SENIN';
      const monthNameDisplay = MONTH_NAMES[mo] || 'Januari';
      const dateString = `${String(dayNum).padStart(2, '0')} ${monthNameDisplay} ${yr}`;
      lastFocusedDateString = dateString;

      const armadaCode = (t.armada || '-').trim().toUpperCase();
      const driverName = (t.driver || '-').trim();
      const helperName = t.helper && t.helper.trim() && t.helper.trim() !== '-' ? t.helper.trim() : '-';
      const helper2Name = t.helper2 && t.helper2.trim() && t.helper2.trim() !== '-' ? t.helper2.trim() : '-';

      const monthPadded = String(mo + 1).padStart(2, '0');
      const dayPadded = String(dayNum).padStart(2, '0');
      const departureIso = `${depDateIso}T${depTime}:00+07:00`;
      const estArrivalIso = `${retDateIso}T${retTime}:00+07:00`;

      const matchedFleet =
        branchFleets.find(f =>
          f.initialCode?.toUpperCase() === armadaCode ||
          f.plateNumber.replace(/\s+/g, '').toUpperCase().includes(armadaCode.replace(/\s+/g, ''))
        ) ||
        logisticsStore.findFleetByCodeOrPlate(armadaCode) ||
        branchFleets[0] ||
        fleets[0];

      const resolvedArmadaDisplay = matchedFleet?.initialCode || (armadaCode !== '-' ? armadaCode : (matchedFleet?.plateNumber || 'DS1'));
      const canonicalFleetKey = (matchedFleet?.id || resolvedArmadaDisplay).trim().toUpperCase();
      const datesToCheck = depDateIso && depDateIso !== effectiveCalendarIso
        ? [effectiveCalendarIso, depDateIso]
        : [effectiveCalendarIso];
      datesToCheck.forEach(dk => batchFleetDateKeys.add(`${canonicalFleetKey}__${dk}`));

      const matchedDriver = driverCrews.find(c =>
        c.name.toLowerCase().includes(driverName.toLowerCase()) ||
        driverName.toLowerCase().includes(c.name.toLowerCase())
      ) || crews.find(c => c.name.toLowerCase().includes(driverName.toLowerCase())) || driverCrews[0] || crews[0];

      const matchedHelper = helperName !== '-' ? (helperCrews.find(c =>
        c.name.toLowerCase().includes(helperName.toLowerCase()) ||
        helperName.toLowerCase().includes(c.name.toLowerCase())
      ) || crews.find(c => c.name.toLowerCase().includes(helperName.toLowerCase()))) : undefined;

      const matchedHelper2 = helper2Name !== '-' ? (helperCrews.find(c =>
        c.name.toLowerCase().includes(helper2Name.toLowerCase()) ||
        helper2Name.toLowerCase().includes(c.name.toLowerCase())
      ) || crews.find(c => c.name.toLowerCase().includes(helper2Name.toLowerCase()))) : undefined;

      const isBali = tripBranchId !== 'cab-sidoarjo' && (stdArea.includes('DENPASAR') || stdArea.includes('SINGARAJA') || stdArea.includes('NEGARA') || stdArea.includes('BALI'));
      const uniqSuffix = `${Date.now().toString(36).slice(-4).toUpperCase()}${idx + 1}`;
      const newSchId = `sch-comb-${yr}${monthPadded}${dayPadded}-${armadaCode}-${uniqSuffix}`;
      const nowIso = new Date().toISOString();
      const originWarehouseName =
        tripBranchInfo?.warehouseName ||
        (tripBranchId === 'cab-sidoarjo' ? 'Gudang Sidoarjo' : 'Gudang Pusat AKK Banyuwangi DC');
      const originCityName = tripBranchInfo?.city || (tripBranchId === 'cab-sidoarjo' ? 'Sidoarjo' : 'Banyuwangi');
      const originCoordinates: [number, number] =
        tripBranchId === 'cab-sidoarjo' ? [-7.4478, 112.7183] : [-8.1906, 114.3708];

      branchStore.setScheduleBranchId(newSchId, tripBranchId);

      const newSch: Schedule = {
        id: newSchId,
        trackingNumber: `PO-AKK-${yr}${monthPadded}${dayPadded}-${armadaCode}-${uniqSuffix}`,
        originName: originWarehouseName,
        originCoords: originCoordinates,
        storeId: `area-${stdArea.toLowerCase().replace(/[^a-z0-9]/g, '-')}`,
        store: {
          id: `area-${stdArea.toLowerCase().replace(/[^a-z0-9]/g, '-')}`,
          storeCode: `AREA-${stdArea.substring(0, 4).toUpperCase().replace(/[^A-Z0-9]/g, '')}`,
          storeName: stdArea,
          island: isBali ? 'Bali & Nusa Tenggara' : 'Jawa',
          province: isBali ? 'Bali' : 'Jawa Timur',
          city: isBali ? 'Denpasar' : originCityName,
          address: `Area Pengiriman ${stdArea}`,
          latitude: isBali ? -8.6705 : originCoordinates[0],
          longitude: isBali ? 115.2126 : originCoordinates[1],
          contactPerson: 'PIC Distribusi Area',
          phone: '-',
          deliveryWindow: `${depTime} - ${retTime}`,
          storeCategory: 'Distribution Hub'
        },
        areaName: stdArea,
        fleetId: matchedFleet ? matchedFleet.id : 'flt-01',
        fleet: matchedFleet,
        armada: resolvedArmadaDisplay,
        crewId: matchedDriver ? matchedDriver.id : 'crw-01',
        crew: matchedDriver,
        crewHelperId: matchedHelper ? matchedHelper.id : undefined,
        crewHelper: matchedHelper,
        crewHelper2Id: matchedHelper2 ? matchedHelper2.id : undefined,
        crewHelper2: matchedHelper2,
        status: t.bypassChecklistDirectComplete ? 'delivered' : 'scheduled',
        departureDate: departureIso,
        estimatedArrival: estArrivalIso,
        departureTime: depTime,
        targetReturnTime: retTime,
        deliveryDate: depDateIso,
        returnDate: retDateIso,
        actualDeparture: t.bypassChecklistDirectComplete ? departureIso : undefined,
        actualArrival: t.bypassChecklistDirectComplete ? estArrivalIso : undefined,
        isChecklistBypassed: t.bypassChecklistDirectComplete || undefined,
        checklistBypassedBy: t.bypassChecklistDirectComplete ? (logisticsStore.getCurrentUser()?.fullName || 'Super Admin') : undefined,
        checklistBypassedAt: t.bypassChecklistDirectComplete ? nowIso : undefined,
        cargoDescription: `Karton Box & Sheet Kemasan - Area ${stdArea}`,
        cargoWeightTon: isBali ? 4.5 : 2.5,
        isInterIsland: isBali,
        ferryBookingCode: isBali ? `ASDP-KTP-GLM-${Math.floor(Math.random() * 9000 + 1000)}` : undefined,
        transitPort: isBali ? 'Pelabuhan Ketapang Banyuwangi -> Gilimanuk Bali' : undefined,
        notes: t.bypassChecklistDirectComplete
          ? `${t.target || `Rute ${stdArea}`} • [Bypass Checklist Super Admin]`
          : (t.target || `Rute ${stdArea} (Berangkat ${depDateIso} ${depTime} • Pulang ${retDateIso} ${retTime})`),
        createdAt: nowIso,
        updatedAt: nowIso,
        isManuallyEdited: t.source === 'manual'
      };

      newSchedulesToBatch.push(newSch);

      if (t.bypassChecklistDirectComplete) {
        driverWaybillService.getWaybillForSchedule(newSch);
        driverWaybillService.updateWaybillStatus(`WB-${newSchId}`, 'delivered', 'Bypass Checklist Super Admin (Arsip Riwayat)');
        if (matchedDriver?.id) {
          logisticsStore.updateCrew(matchedDriver.id, {
            tripsCompleted: (matchedDriver.tripsCompleted || 0) + 1,
            status: 'available'
          });
        }
        if (matchedHelper?.id) {
          logisticsStore.updateCrew(matchedHelper.id, {
            tripsCompleted: (matchedHelper.tripsCompleted || 0) + 1,
            status: 'available'
          });
        }
      }

      if (!dayMap.has(dayNum)) {
        dayMap.set(dayNum, {
          dayNumber: dayNum,
          dayName: dayName.toUpperCase(),
          dateString,
          pengiriman: [],
          gudang: [],
          pengirimanOff: [],
          karyawanIzin: []
        });
      }

      const dayEntry = dayMap.get(dayNum)!;
      dayEntry.pengiriman.push({
        id: newSchId,
        branchId: tripBranchId,
        driver: driverName,
        helper: helperName,
        helper2: helper2Name,
        area: stdArea,
        armada: resolvedArmadaDisplay,
        target: t.target || originWarehouseName,
        departureTime: depTime,
        targetReturnTime: retTime,
        departureDateIso: depDateIso,
        returnDateIso: retDateIso,
        isManuallyEdited: t.source === 'manual'
      });

      if (t.source === 'excel') addedExcelCount += 1;
      else addedManualCount += 1;

      if (changeDetails.length < 6) {
        changeDetails.push(
          `[${t.source === 'excel' ? 'Excel' : 'Input Baru'}] ${dateString}: Driver ${driverName} | Area ${stdArea} | Armada ${resolvedArmadaDisplay} | Berangkat ${depDateIso} ${depTime} - Pulang ${retDateIso} ${retTime}`
        );
      }
    });

    if (newSchedulesToBatch.length === 0) {
      if (skippedDuplicateArmadaList.length > 0) {
        const dupMsg = `Gagal menyimpan karena bentrok armada pada tanggal yang sama: ${skippedDuplicateArmadaList[0]}`;
        setUploadToast({ type: 'error', message: dupMsg });
        setManualScheduleFormError(dupMsg);
      }
      return false;
    }

    logisticsStore.batchSyncSchedules(newSchedulesToBatch, [], {
      isImport: mode === 'ganti',
      replaceMonth: mode === 'ganti',
      skipBackendPersist: true
    });

    const mergedWeeks = convertSchedulesToAdminWeeks(logisticsStore.getSchedules(), targetYear, targetMonth);

    if (selectedYear !== targetYear) setSelectedYear(targetYear);
    if (selectedMonth !== -1 && selectedMonth !== targetMonth) setSelectedMonth(targetMonth);

    updateWeeks(mergedWeeks);
    setSelectedCalendarDate(lastFocusedDateString);
    setSelectedDayFilter(lastFocusedDateString);

    logisticsStore.syncSchedulesToCrewHistory();

    const excelCount = addedExcelCount;
    const manualCount = addedManualCount;

    if (skippedDuplicateArmadaList.length > 0 && changeDetails.length < 8) {
      changeDetails.push(`⚠️ ${skippedDuplicateArmadaList.length} baris dilewati (armada ganda di hari sama): ${skippedDuplicateArmadaList.slice(0, 2).join('; ')}`);
    }

    logisticsStore.addScheduleChangeLog({
      fileName: sourceLabel,
      actionType: excelCount > 0 ? 'upload_excel' : 'manual_create',
      summary: `Kombinasi Jadwal Disimpan: ${newSchedulesToBatch.length} jadwal (${excelCount} Excel, ${manualCount} Input Baru)${skippedDuplicateArmadaList.length > 0 ? ` • ${skippedDuplicateArmadaList.length} duplikat armada dilewati` : ''}`,
      rowCount: newSchedulesToBatch.length,
      changes: changeDetails
    });
    setScheduleChangeLogs(logisticsStore.getScheduleChangeLogs());

    persistSchedulesToDatabase(logisticsStore.getSchedules(), mergedWeeks, {
      month: String(targetMonth + 1),
      year: Number(targetYear),
      source: 'combined_excel_and_manual_schedule'
    }).catch(() => {});

    const msg = skippedDuplicateArmadaList.length > 0
      ? `✅ ${newSchedulesToBatch.length} jadwal tersimpan, dan ${skippedDuplicateArmadaList.length} baris armada ganda di tanggal sama otomatis dilewati.`
      : `✅ ${newSchedulesToBatch.length} jadwal berhasil disimpan permanen!`;
    setSyncSuccessMessage(msg);
    if (skippedDuplicateArmadaList.length > 0) {
      setUploadToast({ type: 'error', message: `⚠️ ${skippedDuplicateArmadaList.length} baris armada ganda dilewati: ${skippedDuplicateArmadaList[0]}` });
    }
    if (onSyncComplete) onSyncComplete(newSchedulesToBatch.length);
    setTimeout(() => setSyncSuccessMessage(null), 7000);
    return true;
  };

  const handleSaveTripModal = () => {
    if (!canEditSchedules) return;
    if (!editingTripModal) return;
    setEditTripModalError(null);
    const { dayNumber, dateString, tripIndex, scheduleId, driver, driverId, helper, helper2, area, armada, target, departureDateIso, returnDateIso, departureTime, targetReturnTime, isNew } = editingTripModal;

    const effectiveMonth = selectedMonth === -1 ? 0 : selectedMonth;
    const defaultMonthPadded = String(effectiveMonth + 1).padStart(2, '0');
    const defaultDayPadded = String(dayNumber).padStart(2, '0');
    const fallbackIso = `${selectedYear}-${defaultMonthPadded}-${defaultDayPadded}`;

    const modalBranchId = editingTripModal.branchId || effectiveActiveBranchId;
    if (!branchStore.canUserAccessBranch(currentUserProfile, modalBranchId)) {
      const permErr = 'Anda tidak memiliki hak akses untuk mengubah jadwal pada cabang ini.';
      setEditTripModalError(permErr);
      setUploadToast({ type: 'error', message: permErr });
      return;
    }

    const stdArea = standardizeAreaName(area, modalBranchId);
    const isLuarKota = modalBranchId === 'cab-sidoarjo' ? false : isLuarKotaArea(stdArea);
    const depTime = (departureTime || '07:30').trim();
    const retTime = (targetReturnTime || '17:00').trim();

    const retIsoDate = returnDateIso || fallbackIso;
    const depIsoDate = departureDateIso || retIsoDate;

    if (depIsoDate > retIsoDate || (depIsoDate === retIsoDate && depTime > retTime)) {
      const timeErr = 'Tanggal/jam kepulangan tidak boleh lebih awal dari keberangkatan. Silakan sesuaikan Tanggal Kepulangan sesuai Tanggal Kirim.';
      setEditTripModalError(timeErr);
      setUploadToast({ type: 'error', message: timeErr });
      return;
    }

    // Penempatan jadwal di kalender selalu mengikuti Tanggal Kepulangan (sesuai Tanggal Kirim)
    const effectiveCalendarIso = retIsoDate;
    const calParts = effectiveCalendarIso.split('-').map(Number);
    const targetYr = calParts[0] || selectedYear;
    const targetMo = (calParts[1] ? calParts[1] - 1 : effectiveMonth);
    const targetDayNum = calParts[2] || dayNumber;
    const monthPadded = String(targetMo + 1).padStart(2, '0');
    const dayPadded = String(targetDayNum).padStart(2, '0');
    const DAY_NAMES_ID = ['MINGGU', 'SENIN', 'SELASA', 'RABU', 'KAMIS', 'JUMAT', 'SABTU'];
    const targetDObj = new Date(targetYr, targetMo, targetDayNum);
    const targetDayName = DAY_NAMES_ID[targetDObj.getDay()] || 'SENIN';
    const targetDateString = `${dayPadded} ${MONTH_NAMES[targetMo] || 'Oktober'} ${targetYr}`;

    const departureIso = `${depIsoDate}T${depTime}:00+07:00`;
    const estArrivalIso = `${retIsoDate}T${retTime}:00+07:00`;

    const fleets = getFleetsForBranch(modalBranchId);
    const crews = logisticsStore.getCrews();

    const matchedFleet =
      fleets.find(f =>
        f.initialCode?.toUpperCase() === armada.toUpperCase() ||
        f.plateNumber.replace(/\s+/g, '').toUpperCase().includes(armada.replace(/\s+/g, '').toUpperCase())
      ) ||
      logisticsStore.findFleetByCodeOrPlate(armada);

    if (
      matchedFleet &&
      !fleets.some(f => f.id === matchedFleet.id) &&
      branchStore.getFleetBranchId(matchedFleet.id, matchedFleet.plateNumber, matchedFleet.initialCode, matchedFleet.branchId) !== modalBranchId
    ) {
      const brName = branchStore.getBranchById(modalBranchId)?.name || modalBranchId;
      const fleetBranchErr = `Armada ${matchedFleet.initialCode || matchedFleet.plateNumber} tidak terdaftar di Cabang ${brName}. Pilih armada sesuai cabang aktif.`;
      setEditTripModalError(fleetBranchErr);
      setUploadToast({ type: 'error', message: fleetBranchErr });
      return;
    }
    const resolvedArmadaCode = matchedFleet?.initialCode || armada;

    // Validasi ketat: 1 Armada hanya boleh memiliki 1 penugasan pada tanggal yang sama
    const excludeSchId = isNew ? undefined : scheduleId;
    void excludeSchId;

    const normalizeCrewName = (value: string) => value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '');
    const allUsers = logisticsStore.getUsers();
    const resolveSelectedCrew = (
      selectedName: string,
      roleHint: 'Driver' | 'Helper',
      selectedOptionId?: string
    ): Crew | undefined => {
      const cleanName = (selectedName || '').trim();
      if (!cleanName || cleanName === '-') return undefined;
      const normalizedName = normalizeCrewName(cleanName);
      const optionId = String(selectedOptionId || '').trim();
      const optionUserId = optionId.replace(/^crw-/, '');
      const matchedUser = allUsers.find(u =>
        (optionId && (u.id === optionId || u.id === optionUserId)) ||
        normalizeCrewName(u.fullName || '') === normalizedName
      );
      if (matchedUser) {
        if (!logisticsStore.isActiveDeliveryCrewUser(matchedUser, modalBranchId)) return undefined;
        // Rebuild account-linked crew records using exact account identity. Do not reuse
        // a similarly named legacy crew merely because its name contains the short name.
        const syncedCrews = logisticsStore.syncUsersWithCrews();
        const exactNameCrew = syncedCrews.find(c => normalizeCrewName(c.name) === normalizeCrewName(matchedUser.fullName || cleanName));
        const accountCrew = syncedCrews.find(c => c.id === `crw-${matchedUser.id}`);
        const fromStore = accountCrew || exactNameCrew;
        branchStore.syncCrewBranchIdSilent(`crw-${matchedUser.id}`, modalBranchId, matchedUser.fullName || cleanName);
        if (fromStore) {
          return {
            ...fromStore,
            // The option is selected from User Management, so its account ID is the
            // authoritative identity. Never persist an old legacy crew ID just because
            // a crew cache entry has the same display name.
            id: `crw-${matchedUser.id}`,
            name: (matchedUser.fullName || cleanName).trim(),
            phone: matchedUser.phone || fromStore.phone || '',
            role: matchedUser.role === 'crew_helper' ? 'Kernet / Helper' : (fromStore.role || 'Driver Utama')
          };
        }
        // User Management is the source of truth for eligible portal users; create a schedule snapshot
        // when the legacy crew cache has not caught up with the user record yet.
        return {
          id: `crw-${matchedUser.id}`,
          name: (matchedUser.fullName || cleanName).trim(),
          phone: matchedUser.phone || '',
          role: roleHint === 'Driver' ? 'Driver Utama' : 'Kernet / Helper',
          licenseNumber: '',
          licenseType: roleHint === 'Driver' ? 'SIM B1/B2 Umum' : 'SIM A',
          status: 'available',
          tripsCompleted: 0,
          rating: 0
        };
      }
      // Akun dengan nama yang sama tetapi tanpa akses cabang yang sesuai tidak boleh
      // diubah menjadi kru legacy untuk melewati validasi hak akses.
      if (allUsers.length > 0) return undefined;
      return crews.find(c =>
        normalizeCrewName(c.name) === normalizedName &&
        c.status !== 'off' &&
        branchStore.getCrewBranchId(c.id, c.name) === modalBranchId
      );
    };

    const selectedDriverIsAvailable = getIntegratedDrivers(modalBranchId)
      .some(option => (driverId && option.id === driverId) || normalizeCrewName(option.name) === normalizeCrewName(driver));
    const matchedDriver = selectedDriverIsAvailable ? resolveSelectedCrew(driver, 'Driver', driverId) : undefined;
    if (!matchedDriver) {
      const branchName = branchStore.getBranchById(modalBranchId)?.name || modalBranchId;
      const driverErr = `Driver "${driver || '-'}" tidak ditemukan sebagai kru aktif dengan akses Portal Driver cabang ${branchName}. Periksa Hak Akses Cabang dan akses Portal Driver di Manajemen User.`;
      setEditTripModalError(driverErr);
      setUploadToast({ type: 'error', message: driverErr });
      return;
    }

    const isHelperSelected = (name: string) => Boolean(name && name.trim() && name.trim() !== '-');
    const selectedHelperIsAvailable = !isHelperSelected(helper) || getIntegratedHelpers(modalBranchId)
      .some(option => normalizeCrewName(option.name) === normalizeCrewName(helper));
    const selectedHelper2IsAvailable = !isHelperSelected(helper2) || getIntegratedHelpers(modalBranchId)
      .some(option => normalizeCrewName(option.name) === normalizeCrewName(helper2));
    const matchedHelper = isHelperSelected(helper) && selectedHelperIsAvailable
      ? resolveSelectedCrew(helper, 'Helper')
      : undefined;
    const matchedHelper2 = isHelperSelected(helper2) && selectedHelper2IsAvailable
      ? resolveSelectedCrew(helper2, 'Helper')
      : undefined;
    if ((isHelperSelected(helper) && !matchedHelper) || (isHelperSelected(helper2) && !matchedHelper2)) {
      const helperErr = `Helper tidak ditemukan sebagai kru aktif dengan akses Portal Driver cabang ${branchStore.getBranchById(modalBranchId)?.name || modalBranchId}. Periksa Hak Akses Cabang di Manajemen User.`;
      setEditTripModalError(helperErr);
      setUploadToast({ type: 'error', message: helperErr });
      return;
    }

    const isBali = modalBranchId !== 'cab-sidoarjo' && (stdArea.includes('DENPASAR') || stdArea.includes('SINGARAJA') || stdArea.includes('NEGARA') || stdArea.includes('BALI'));
    const modalBranchInfo = branchStore.getBranchById(modalBranchId);
    const modalOriginWarehouse =
      modalBranchInfo?.warehouseName ||
      (modalBranchId === 'cab-sidoarjo' ? 'Gudang Sidoarjo' : 'Gudang Pusat AKK Banyuwangi DC');
    const modalOriginCoords: [number, number] =
      modalBranchId === 'cab-sidoarjo' ? [-7.4478, 112.7183] : [-8.1906, 114.3708];

    if (isNew) {
      const newSchId = `sch-man-${Date.now()}-${Math.floor(Math.random() * 9000 + 1000)}`;
      branchStore.setScheduleBranchId(newSchId, modalBranchId);
      const newSch: Schedule = {
        id: newSchId,
        trackingNumber: `PO-AKK-${targetYr}${monthPadded}${dayPadded}-${resolvedArmadaCode}-${Date.now().toString().slice(-4)}`,
        originName: modalOriginWarehouse,
        originCoords: modalOriginCoords,
        storeId: `area-${stdArea.toLowerCase().replace(/[^a-z0-9]/g, '-')}`,
        store: {
          id: `area-${stdArea.toLowerCase().replace(/[^a-z0-9]/g, '-')}`,
          storeCode: `AREA-${stdArea.substring(0, 4).toUpperCase().replace(/[^A-Z0-9]/g, '')}`,
          storeName: stdArea,
          island: isBali ? 'Bali & Nusa Tenggara' : 'Jawa',
          province: isBali ? 'Bali' : 'Jawa Timur',
          city: isBali ? 'Denpasar' : (modalBranchInfo?.city || 'Banyuwangi'),
          address: `Area Pengiriman ${stdArea}`,
          latitude: isBali ? -8.6705 : modalOriginCoords[0],
          longitude: isBali ? 115.2126 : modalOriginCoords[1],
          contactPerson: 'PIC Distribusi Area',
          phone: '-',
          deliveryWindow: `${depTime} - ${retTime}`,
          storeCategory: 'Distribution Hub'
        },
        areaName: stdArea,
        fleetId: matchedFleet ? matchedFleet.id : 'flt-01',
        fleet: matchedFleet,
        armada: resolvedArmadaCode,
        crewId: matchedDriver ? matchedDriver.id : 'crw-01',
        crew: matchedDriver,
        crewHelperId: matchedHelper ? matchedHelper.id : undefined,
        crewHelper: matchedHelper,
        crewHelper2Id: matchedHelper2 ? matchedHelper2.id : undefined,
        crewHelper2: matchedHelper2,
        status: 'scheduled',
        departureDate: departureIso,
        estimatedArrival: estArrivalIso,
        departureTime: depTime,
        targetReturnTime: retTime,
        deliveryDate: depIsoDate,
        returnDate: retIsoDate,
        cargoDescription: `Karton Box & Sheet Kemasan - Area ${stdArea}`,
        cargoWeightTon: isBali ? 4.5 : 2.5,
        isInterIsland: isBali,
        ferryBookingCode: isBali ? `ASDP-KTP-GLM-${Math.floor(Math.random() * 9000 + 1000)}` : undefined,
        transitPort: isBali ? 'Pelabuhan Ketapang Banyuwangi -> Gilimanuk Bali' : undefined,
        notes: target || `Rute ${stdArea} (Berangkat ${depIsoDate} ${depTime} • Target Pulang ${retIsoDate} ${retTime})`,
        createdAt: new Date().toISOString(),
        isManuallyEdited: true
      };

      logisticsStore.addSchedule(newSch);
      logisticsStore.syncSchedulesToCrewHistory();
      logisticsStore.addScheduleChangeLog({
        fileName: `Tambah Ritase (${targetDateString})`,
        actionType: 'manual_create',
        summary: `Penambahan ritase baru pada ${targetDateString}: ${driver} menuju ${stdArea} (${depTime} - ${retTime})`,
        rowCount: 1,
        changes: [
          `Tanggal Jadwal: ${targetDateString} | Berangkat: ${depIsoDate} ${depTime} - Pulang: ${retIsoDate} ${retTime}`,
          `Driver: ${driver} | Helper 1: ${helper || '-'} | Helper 2: ${helper2 || '-'}`,
          `Area Kirim: ${stdArea} | Armada: ${resolvedArmadaCode}`
        ]
      });

      const newTripObj: DeliveryAssignment = {
        id: newSchId,
        branchId: modalBranchId,
        driver,
        helper: helper || '-',
        helper2: helper2 || '-',
        area: stdArea,
        armada: resolvedArmadaCode,
        target,
        departureTime: depTime,
        targetReturnTime: retTime,
        departureDateIso: depIsoDate,
        returnDateIso: retIsoDate,
        isManuallyEdited: true
      };

      let dayFound = false;
      const newWeeks = weeks.map((w, wIdx) => {
        const existsInWeek = w.days.some(d => d.dayNumber === targetDayNum);
        if (existsInWeek) {
          dayFound = true;
          return {
            ...w,
            days: w.days.map(d => {
              if (d.dayNumber === targetDayNum) {
                return {
                  ...d,
                  pengiriman: [...d.pengiriman, newTripObj]
                };
              }
              return d;
            })
          };
        }
        if (wIdx === weeks.length - 1 && !dayFound) {
          dayFound = true;
          const updatedDays = [
            ...w.days,
            {
              dayNumber: targetDayNum,
              dayName: targetDayName,
              dateString: targetDateString,
              pengiriman: [newTripObj],
              gudang: [],
              pengirimanOff: [],
              karyawanIzin: []
            }
          ].sort((a, b) => a.dayNumber - b.dayNumber);
          return {
            ...w,
            days: updatedDays
          };
        }
        return w;
      });
      updateWeeks(newWeeks);
      setSelectedCalendarDate(targetDateString);
      setSelectedDayFilter(targetDateString);
      setSyncSuccessMessage(`✅ Berhasil menambahkan ritase pengiriman baru pada ${targetDateString}! Data disimpan permanen.`);
    } else {
      // Editing existing
      let targetId = scheduleId;
      const storeSchedules = logisticsStore.getSchedules();
      const prevTrip = weeks
        .flatMap(w => w.days)
        .find(d => d.dayNumber === dayNumber)?.pengiriman[tripIndex];

      // Never fall back to an arbitrary schedule from the same date. Use the selected
      // schedule ID, or a unique legacy identity (date + fleet + old driver/area).
      if (!targetId || !storeSchedules.some(s => s.id === targetId)) {
        const normalizeKey = (value?: string) => (value || '').toLowerCase().replace(/[^a-z0-9]/g, '');
        const oldDriverKey = normalizeKey(prevTrip?.driver || driver);
        const oldAreaKey = normalizeKey(prevTrip?.area || area);
        const oldFleetKey = normalizeKey(prevTrip?.armada || armada);
        const candidates = storeSchedules.filter(s => {
          if (!s.departureDate && !s.deliveryDate) return false;
          const d = new Date(s.departureDate || s.deliveryDate || '');
          const sameDay = !Number.isNaN(d.getTime()) &&
            d.getFullYear() === selectedYear && d.getMonth() === effectiveMonth && d.getDate() === dayNumber;
          if (!sameDay) return false;
          const scheduleFleetKeys = [s.armada, s.fleet?.initialCode, s.fleet?.plateNumber]
            .map(normalizeKey)
            .filter(Boolean);
          const fleetMatches = Boolean(oldFleetKey) && scheduleFleetKeys.includes(oldFleetKey);
          if (!fleetMatches) return false;
          const driverMatches = Boolean(oldDriverKey) && normalizeKey(s.crew?.name) === oldDriverKey;
          const areaMatches = Boolean(oldAreaKey) && normalizeKey(s.areaName || s.store?.storeName) === oldAreaKey;
          return driverMatches || areaMatches;
        });
        if (candidates.length === 1) {
          targetId = candidates[0].id;
        } else {
          const identityError = candidates.length > 1
            ? 'Ada lebih dari satu jadwal yang cocok dengan tanggal dan armada ini.'
            : 'ID jadwal tidak ditemukan dan identitas jadwal lama tidak cocok.';
          const message = `${identityError} Data tidak diubah untuk mencegah laporan atau ritase area lain ikut berubah. Muat ulang jadwal, lalu buka kembali rincian ritase yang benar.`;
          setEditTripModalError(message);
          setUploadToast({ type: 'error', message });
          return;
        }
      }

      if (targetId && storeSchedules.some(s => s.id === targetId)) {
        const existingSch = storeSchedules.find(s => s.id === targetId);
        logisticsStore.updateSchedule(targetId, {
          fleetId: matchedFleet ? matchedFleet.id : undefined,
          fleet: matchedFleet,
          armada: resolvedArmadaCode,
          crewId: matchedDriver ? matchedDriver.id : undefined,
          crew: matchedDriver,
          crewHelperId: matchedHelper ? matchedHelper.id : undefined,
          crewHelper: matchedHelper,
          crewHelper2Id: matchedHelper2 ? matchedHelper2.id : undefined,
          crewHelper2: matchedHelper2,
          areaName: stdArea,
          departureDate: departureIso,
          estimatedArrival: estArrivalIso,
          departureTime: depTime,
          targetReturnTime: retTime,
          deliveryDate: depIsoDate,
          returnDate: retIsoDate,
          store: existingSch?.store
            ? {
                ...existingSch.store,
                storeName: stdArea,
                deliveryWindow: `${depTime} - ${retTime}`
              }
            : undefined,
          notes: target || `Rute ${stdArea} (Berangkat ${depIsoDate} ${depTime} • Target Pulang ${retIsoDate} ${retTime})`,
          isManuallyEdited: true
        });
      } else {
        const generatedId = targetId || `sch-man-${Date.now()}-${Math.floor(Math.random() * 9000 + 1000)}`;
        const newSch: Schedule = {
          id: generatedId,
          trackingNumber: `PO-AKK-${targetYr}${monthPadded}${dayPadded}-${resolvedArmadaCode}-${Date.now().toString().slice(-4)}`,
          originName: 'Gudang Pusat AKK Banyuwangi DC',
          originCoords: [-8.1906, 114.3708],
          storeId: `area-${stdArea.toLowerCase().replace(/[^a-z0-9]/g, '-')}`,
          store: {
            id: `area-${stdArea.toLowerCase().replace(/[^a-z0-9]/g, '-')}`,
            storeCode: `AREA-${stdArea.substring(0, 4).toUpperCase().replace(/[^A-Z0-9]/g, '')}`,
            storeName: stdArea,
            island: isBali ? 'Bali & Nusa Tenggara' : 'Jawa',
            province: isBali ? 'Bali' : 'Jawa Timur',
            city: isBali ? 'Denpasar' : 'Banyuwangi',
            address: `Area Pengiriman ${stdArea}`,
            latitude: isBali ? -8.6705 : -8.219,
            longitude: isBali ? 115.2126 : 114.369,
            contactPerson: 'PIC Distribusi Area',
            phone: '-',
            deliveryWindow: `${depTime} - ${retTime}`,
            storeCategory: 'Distribution Hub'
          },
          areaName: stdArea,
          fleetId: matchedFleet ? matchedFleet.id : 'flt-01',
          fleet: matchedFleet,
          armada: resolvedArmadaCode,
          crewId: matchedDriver ? matchedDriver.id : 'crw-01',
          crew: matchedDriver,
          crewHelperId: matchedHelper ? matchedHelper.id : undefined,
          crewHelper: matchedHelper,
          crewHelper2Id: matchedHelper2 ? matchedHelper2.id : undefined,
          crewHelper2: matchedHelper2,
          status: 'scheduled',
          departureDate: departureIso,
          estimatedArrival: estArrivalIso,
          departureTime: depTime,
          targetReturnTime: retTime,
          deliveryDate: depIsoDate,
          returnDate: retIsoDate,
          cargoDescription: `Karton Box & Sheet Kemasan - Area ${stdArea}`,
          cargoWeightTon: isBali ? 4.5 : 2.5,
          isInterIsland: isBali,
          ferryBookingCode: isBali ? `ASDP-KTP-GLM-${Math.floor(Math.random() * 9000 + 1000)}` : undefined,
          transitPort: isBali ? 'Pelabuhan Ketapang Banyuwangi -> Gilimanuk Bali' : undefined,
          notes: target || `Rute ${stdArea} (Berangkat ${depIsoDate} ${depTime} • Target Pulang ${retIsoDate} ${retTime})`,
          createdAt: new Date().toISOString(),
          isManuallyEdited: true
        };
        logisticsStore.addSchedule(newSch);
        targetId = generatedId;
      }
      logisticsStore.syncSchedulesToCrewHistory();

      const editDiffs: string[] = [];
      if (prevTrip) {
        if (prevTrip.driver !== driver) editDiffs.push(`Driver: ${prevTrip.driver} → ${driver}`);
        if ((prevTrip.helper || '-') !== (helper || '-')) editDiffs.push(`Helper 1: ${prevTrip.helper || '-'} → ${helper || '-'}`);
        if ((prevTrip.helper2 || '-') !== (helper2 || '-')) editDiffs.push(`Helper 2: ${prevTrip.helper2 || '-'} → ${helper2 || '-'}`);
        if (standardizeAreaName(prevTrip.area) !== stdArea) editDiffs.push(`Area Kirim: ${prevTrip.area} → ${stdArea}`);
        if (prevTrip.armada !== resolvedArmadaCode) editDiffs.push(`Armada: ${prevTrip.armada} → ${resolvedArmadaCode}`);
      }
      if (editDiffs.length === 0) {
        editDiffs.push(`Pembaruan ritase ${targetDateString}: Driver ${driver}, Area ${stdArea}, Armada ${resolvedArmadaCode} (${depTime}-${retTime})`);
      }

      logisticsStore.addScheduleChangeLog({
        fileName: `Edit Ritase (${targetDateString})`,
        actionType: 'manual_edit',
        summary: `Perubahan jadwal pengiriman pada ${targetDateString} (${stdArea})`,
        rowCount: 1,
        changes: editDiffs
      });

      if (editingTripModal.branchId && (targetId || prevTrip?.id)) {
        branchStore.setScheduleBranchId(targetId || prevTrip!.id!, editingTripModal.branchId);
      }

      const updatedTripItem: DeliveryAssignment = {
        ...(prevTrip || {}),
        id: targetId || prevTrip?.id,
        branchId: editingTripModal.branchId || branchStore.getScheduleBranchId(targetId || prevTrip?.id || '', stdArea, resolvedArmadaCode),
        driver,
        helper: helper || '-',
        helper2: helper2 || '-',
        area: stdArea,
        armada: resolvedArmadaCode,
        target,
        departureTime: depTime,
        targetReturnTime: retTime,
        departureDateIso: depIsoDate,
        returnDateIso: retIsoDate,
        isManuallyEdited: true
      };

      // Update weeks state directly (and move trip if targetDayNum changed due to returnDateIso change)
      let placedInTargetDay = false;
      const newWeeks = weeks.map((w, wIdx) => {
        let nextDays = w.days.map(d => {
          if (d.dayNumber === dayNumber && targetDayNum === dayNumber) {
            placedInTargetDay = true;
            const newPengiriman = [...d.pengiriman];
            if (tripIndex >= 0 && tripIndex < newPengiriman.length) {
              newPengiriman[tripIndex] = updatedTripItem;
            }
            return { ...d, pengiriman: newPengiriman };
          }
          if (d.dayNumber === dayNumber && targetDayNum !== dayNumber) {
            return {
              ...d,
              pengiriman: d.pengiriman.filter((_, idx) => idx !== tripIndex)
            };
          }
          if (d.dayNumber === targetDayNum && targetDayNum !== dayNumber) {
            placedInTargetDay = true;
            return {
              ...d,
              pengiriman: [...d.pengiriman.filter(x => x.id !== updatedTripItem.id), updatedTripItem]
            };
          }
          return d;
        });

        if (wIdx === weeks.length - 1 && !placedInTargetDay) {
          placedInTargetDay = true;
          nextDays = [
            ...nextDays,
            {
              dayNumber: targetDayNum,
              dayName: targetDayName,
              dateString: targetDateString,
              pengiriman: [updatedTripItem],
              gudang: [],
              pengirimanOff: [],
              karyawanIzin: []
            }
          ].sort((a, b) => a.dayNumber - b.dayNumber);
        }

        return {
          ...w,
          days: nextDays
        };
      });
      updateWeeks(newWeeks);
      setSelectedCalendarDate(targetDateString);
      setSelectedDayFilter(targetDateString);
      setSyncSuccessMessage(`✅ Perubahan jadwal pengiriman ${targetDateString} berhasil disimpan permanen!`);
    }

    setScheduleChangeLogs(logisticsStore.getScheduleChangeLogs());
    setEditingTripModal(null);
    setTimeout(() => setSyncSuccessMessage(null), 6000);
  };

  const handleDeleteTrip = (p: DeliveryAssignment, dayNumber: number, tripIndex: number) => {
    if (!canEditSchedules) return;
    if (p.id) {
      logisticsStore.deleteSchedule(p.id);
    } else {
      const storeSchedules = logisticsStore.getSchedules();
      const effectiveMonth = selectedMonth === -1 ? 0 : selectedMonth;
      const found = storeSchedules.find(s => {
        if (!s.departureDate) return false;
        const d = new Date(s.departureDate);
        return d.getFullYear() === selectedYear && d.getMonth() === effectiveMonth && d.getDate() === dayNumber &&
          (s.fleet?.initialCode === p.armada || s.crew?.name === p.driver || s.areaName === p.area);
      });
      if (found) {
        logisticsStore.deleteSchedule(found.id);
      }
    }
    logisticsStore.syncSchedulesToCrewHistory();
    logisticsStore.addScheduleChangeLog({
      fileName: `Hapus Ritase (Tgl ${dayNumber})`,
      actionType: 'delete_schedule',
      summary: `Penghapusan ritase pengiriman ${p.driver} (${p.area} - ${p.armada})`,
      rowCount: 1,
      changes: [
        `Dihapus: Driver ${p.driver}, Helper ${p.helper || '-'}, Area ${p.area}, Armada ${p.armada}`
      ]
    });
    setScheduleChangeLogs(logisticsStore.getScheduleChangeLogs());

    const newWeeks = weeks.map(w => ({
      ...w,
      days: w.days.map(d => {
        if (d.dayNumber === dayNumber) {
          const newPengiriman = d.pengiriman.filter((_, idx) => idx !== tripIndex);
          return {
            ...d,
            pengiriman: newPengiriman
          };
        }
        return d;
      })
    }));
    updateWeeks(newWeeks);
    setSyncSuccessMessage('✅ Ritase berhasil dihapus dari jadwal operasional aktif.');
    setTimeout(() => setSyncSuccessMessage(null), 5000);
  };

  // Extract all unique drivers present across weeks for dropdown filter
  const allDriversInWeeks = useMemo(() => {
    const dSet = new Set<string>();
    weeks.forEach(w => w.days.forEach(d => d.pengiriman.forEach(p => {
      if (p.driver && p.driver !== '-') dSet.add(p.driver.trim());
    })));
    return Array.from(dSet).sort();
  }, [weeks]);

  // Filtered weeks & days dynamically adapted to selected month, year, and Cabang
  const filteredWeeks = useMemo(() => {
    const effectiveMonth = selectedMonth === -1 ? new Date().getMonth() : selectedMonth;
    const expectedMonthYearSuffix = `${MONTH_NAMES[effectiveMonth]} ${selectedYear}`.toLowerCase();

    let result = weeks.map(w => ({
      ...w,
      days: w.days.filter(d =>
        String(d.dateString || '').trim().toLowerCase().endsWith(expectedMonthYearSuffix)
      )
    })).filter(w => w.days.length > 0);

    if (selectedWeekNum !== 'all') {
      result = result.filter(w => w.weekNumber === selectedWeekNum);
    }
    if (effectiveActiveBranchId) {
      const allUsers = logisticsStore.getUsers();
      result = result.map(w => ({
        ...w,
        days: w.days.map(d => ({
          ...d,
          pengiriman: d.pengiriman.filter(p => {
            if (p.branchId && p.branchId !== 'ALL') {
              return p.branchId === effectiveActiveBranchId;
            }
            const drvUser = allUsers.find(u => logisticsStore.isSameCrewPersonName(u.fullName, p.driver || ''));
            if (drvUser && logisticsStore.isActiveDeliveryCrewUser(drvUser)) {
              return logisticsStore.isActiveDeliveryCrewUser(drvUser, effectiveActiveBranchId);
            }
            const bId = branchStore.getScheduleBranchId(p.id || '', p.area, p.armada);
            return bId === effectiveActiveBranchId;
          })
        }))
      }));
    }
    return result;
  }, [weeks, selectedWeekNum, effectiveActiveBranchId, selectedMonth, selectedYear]);

  // Persist snapshot of Kru Free / Stand By Gudang for the selected calendar date directly to MySQL (/api/portal-flow-state)
  useEffect(() => {
    const allDaysFlat = filteredWeeks.flatMap((w: AdminScheduleWeek) => w.days);
    const activeDayObj = allDaysFlat.find((d: AdminScheduleDay) => d.dateString === selectedCalendarDate) || allDaysFlat[0];
    if (!activeDayObj) return;
    const standbyData = computeDayCrewStandbyBreakdown(activeDayObj);
    const effMo = selectedMonth === -1 ? 0 : selectedMonth;
    const dateIso = `${selectedYear}-${String(effMo + 1).padStart(2, '0')}-${String(activeDayObj.dayNumber).padStart(2, '0')}`;
    const snapshotPayload = {
      dateIso,
      dateString: activeDayObj.dateString,
      dayName: activeDayObj.dayName,
      dayNumber: activeDayObj.dayNumber,
      year: selectedYear,
      month: effMo,
      totalCrewCount: standbyData.totalCrewCount,
      scheduledCrewCount: standbyData.scheduledCrewCount,
      freeStandbyCount: standbyData.freeStandbyCount,
      freeStandbyCrews: standbyData.freeStandbyCrews,
      scheduledCrews: standbyData.scheduledCrews,
      pengiriman: activeDayObj.pengiriman,
      updatedAt: new Date().toISOString()
    };
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    try {
      const token =
        (typeof localStorage !== 'undefined'
          ? localStorage.getItem('akk_session_token') || localStorage.getItem('session_token')
          : null) ||
        (typeof sessionStorage !== 'undefined' ? sessionStorage.getItem('akk_session_token') : null) ||
        '';
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
        headers['x-akk-session-token'] = token;
      }
    } catch {}
    void fetch('/api/portal-flow-state', {
      method: 'POST',
      credentials: 'same-origin',
      headers,
      body: JSON.stringify({ standbyCrewSnapshot: snapshotPayload })
    }).catch(() => {});
  }, [filteredWeeks, selectedCalendarDate, selectedYear, selectedMonth]);

  // List of unique active days across filtered weeks
  const availableDaysList = useMemo(() => {
    const list: Array<{ key: string; dayName: string; dayNumber: number; dateString: string; count: number }> = [];
    filteredWeeks.forEach((w: AdminScheduleWeek) => {
      w.days.forEach((d: AdminScheduleDay) => {
        list.push({
          key: d.dateString || `${d.dayNumber}`,
          dayName: d.dayName,
          dayNumber: d.dayNumber,
          dateString: d.dateString,
          count: d.pengiriman.length
        });
      });
    });
    return list;
  }, [filteredWeeks]);

  // Build 7-day grid cells for selected month and year
  const calendarGridData = useMemo(() => {
    const year = selectedYear;
    const monthIdx = selectedMonth === -1 ? new Date().getMonth() : selectedMonth;
    const monthName = MONTH_NAMES[monthIdx];

    const firstDate = new Date(year, monthIdx, 1);
    const startDayOfWeek = firstDate.getDay(); // 0 = MINGGU, 1 = SENIN, ...
    const daysInMonth = new Date(year, monthIdx + 1, 0).getDate();

    const monthDaysMap = new Map<string, AdminScheduleDay>();
    filteredWeeks.forEach((w: AdminScheduleWeek) => {
      w.days.forEach((d: AdminScheduleDay) => {
        if (d.dateString) {
          monthDaysMap.set(d.dateString.trim(), d);
        }
      });
    });

    const cells: Array<{
      type: 'padding' | 'day';
      dayNumber?: number;
      dateString?: string;
      dayName?: string;
      scheduleDay?: AdminScheduleDay;
      totalTrips: number;
      lokalCount: number;
      luarKotaCount: number;
      baliCount: number;
      kanvasCount: number;
      uniqueAreaCount: number;
      areaPreviewList: string[];
    }> = [];

    for (let i = 0; i < startDayOfWeek; i++) {
      cells.push({
        type: 'padding',
        totalTrips: 0,
        lokalCount: 0,
        luarKotaCount: 0,
        baliCount: 0,
        kanvasCount: 0,
        uniqueAreaCount: 0,
        areaPreviewList: []
      });
    }

    const DAY_NAMES_ARR = ['MINGGU', 'SENIN', 'SELASA', 'RABU', 'KAMIS', 'JUMAT', 'SABTU'];
    for (let dayNum = 1; dayNum <= daysInMonth; dayNum++) {
      const dateObj = new Date(year, monthIdx, dayNum);
      const dayName = DAY_NAMES_ARR[dateObj.getDay()];
      const dayFormatted = String(dayNum).padStart(2, '0');
      const dateString = `${dayFormatted} ${monthName} ${year}`;
      const scheduleDay = monthDaysMap.get(dateString);

      let lokalCount = 0;
      let luarKotaCount = 0;
      let baliCount = 0;
      let kanvasCount = 0;
      let totalTrips = 0;
      const uniqueAreaSet = new Set<string>();
      const areaShortLabels: string[] = [];

      if (scheduleDay) {
        totalTrips = scheduleDay.pengiriman.length;
        scheduleDay.pengiriman.forEach((p: DeliveryAssignment) => {
          const stdName = standardizeAreaName(p.area, effectiveActiveBranchId);
          const std = stdName.toUpperCase();
          if (std && !uniqueAreaSet.has(std)) {
            uniqueAreaSet.add(std);
            const shortCode = stdName.split('(')[0].trim();
            if (shortCode) areaShortLabels.push(shortCode);
          }
          const isKanvas = std.includes('KANVAS LKT') || (p.area || '').toUpperCase().includes('KANVAS LKT');
          if (isKanvas) {
            kanvasCount++;
          }
          if (isAreaBaliSchedule(p.area) && !isKanvas) {
            baliCount++;
          } else if (isAreaLuarKotaSchedule(p.area)) {
            luarKotaCount++;
          } else {
            lokalCount++;
          }
        });
      }

      cells.push({
        type: 'day',
        dayNumber: dayNum,
        dateString,
        dayName,
        scheduleDay,
        totalTrips,
        lokalCount,
        luarKotaCount,
        baliCount,
        kanvasCount,
        uniqueAreaCount: uniqueAreaSet.size,
        areaPreviewList: areaShortLabels
      });
    }

    return { monthName, year, startDayOfWeek, daysInMonth, cells };
  }, [selectedYear, selectedMonth, filteredWeeks, effectiveActiveBranchId]);

  // Extract raw areas from currently active week/sheet
  const currentSheetAreas = useMemo(() => {
    const areas: string[] = [];
    filteredWeeks.forEach((w: AdminScheduleWeek) => {
      w.days.forEach((d: AdminScheduleDay) => {
        d.pengiriman.forEach((p: DeliveryAssignment) => {
          if (p.area) areas.push(p.area);
        });
      });
    });
    return areas;
  }, [filteredWeeks]);

  const totalTripsCount = useMemo(() => {
    let count = 0;
    filteredWeeks.forEach((w: AdminScheduleWeek) => w.days.forEach((d: AdminScheduleDay) => { count += d.pengiriman.length; }));
    return count;
  }, [filteredWeeks]);

  const activeDaysSummary = useMemo(() => {
    const dayLabels: string[] = [];
    filteredWeeks.forEach((w: AdminScheduleWeek) => w.days.forEach((d: AdminScheduleDay) => { dayLabels.push(`${d.dayName} (${d.dateString})`); }));
    return dayLabels.join(' & ');
  }, [filteredWeeks]);

  // Auto-run intelligent mapping for current sheet
  useEffect(() => {
    if (currentSheetAreas.length > 0) {
      const mappings = areaAutoMapper.processRawAreaBatch(currentSheetAreas);
      setDetectedAreaMappings(prev => {
        const updated = { ...mappings };
        Object.keys(prev).forEach(k => {
          if (prev[k].isUserOverridden && updated[k]) {
            updated[k] = prev[k];
          }
        });
        return updated;
      });
    }
  }, [currentSheetAreas]);

  // Handle mapping modification
  const handleMappingChange = (rawArea: string, targetOfficialArea: string) => {
    const foundOfficial = officialAreasList.find(a => a.name.toUpperCase() === targetOfficialArea.toUpperCase());
    setDetectedAreaMappings(prev => {
      const current = prev[rawArea];
      const updated: AreaMappingEntry = {
        rawArea,
        occurrenceCount: current?.occurrenceCount || 1,
        matchedOfficialArea: targetOfficialArea,
        matchedStoreId: foundOfficial?.id || null,
        confidence: 'exact',
        confidenceScore: 100,
        similarityReason: `Dipetakan manual oleh pengguna ke '${targetOfficialArea}'`,
        isUserOverridden: true
      };
      areaAutoMapper.saveUserMappingPreference(rawArea, targetOfficialArea);
      return { ...prev, [rawArea]: updated };
    });

    if (parsedUploadedTrips.length > 0) {
      const mappingDict: Record<string, string> = {};
      Object.entries({ ...detectedAreaMappings, [rawArea]: { matchedOfficialArea: targetOfficialArea } as any }).forEach(([k, v]) => {
        if (v.matchedOfficialArea) mappingDict[k] = v.matchedOfficialArea;
      });
      const currentTargetDate = new Date(selectedYear, selectedMonth === -1 ? 0 : selectedMonth, 5);
      const revalidated = scheduleImportValidator.validateImportBatch(parsedUploadedTrips, currentTargetDate, mappingDict);
      setUploadedValidationReport(revalidated);
    }
  };

  // Handle new area created via quick dialog
  const handleAreaCreated = (newArea: OfficialAreaItem, rawAreaKey: string) => {
    const updatedList = areaAutoMapper.getOfficialAreaList();
    setOfficialAreasList(updatedList);

    setDetectedAreaMappings(prev => {
      const current = prev[rawAreaKey];
      return {
        ...prev,
        [rawAreaKey]: {
          rawArea: rawAreaKey,
          occurrenceCount: current?.occurrenceCount || 1,
          matchedOfficialArea: newArea.name,
          matchedStoreId: newArea.id,
          confidence: 'exact',
          confidenceScore: 100,
          similarityReason: `Area baru '${newArea.name}' berhasil dibuat dan didaftarkan ke Jadwal Pengiriman & Muat`,
          isUserOverridden: true,
          isNewlyCreated: true
        }
      };
    });

    if (parsedUploadedTrips.length > 0) {
      const mappingDict: Record<string, string> = {};
      Object.entries({ ...detectedAreaMappings, [rawAreaKey]: { matchedOfficialArea: newArea.name } as any }).forEach(([k, v]) => {
        if (v.matchedOfficialArea) mappingDict[k] = v.matchedOfficialArea;
      });
      const currentTargetDate = new Date(selectedYear, selectedMonth === -1 ? 0 : selectedMonth, 5);
      const revalidated = scheduleImportValidator.validateImportBatch(parsedUploadedTrips, currentTargetDate, mappingDict);
      setUploadedValidationReport(revalidated);
    }

    setSyncSuccessMessage(`✨ Area baru '${newArea.name}' berhasil didaftarkan ke 'Jadwal Pengiriman & Muat' dan dipetakan otomatis!`);
    setTimeout(() => setSyncSuccessMessage(null), 6000);
  };

  // Extract raw crews from currently active week/sheet
  const currentSheetCrews = useMemo(() => {
    const crews: Array<{ name: string; roleHint?: 'Driver' | 'Helper' }> = [];
    filteredWeeks.forEach((w: AdminScheduleWeek) => {
      w.days.forEach((d: AdminScheduleDay) => {
        d.pengiriman.forEach((p: DeliveryAssignment) => {
          if (p.driver) crews.push({ name: p.driver, roleHint: 'Driver' });
          if (p.helper) {
            p.helper.split(/[,&/]+/).forEach((h: string) => {
              const cleanH = h.trim();
              if (cleanH && cleanH !== '-' && cleanH !== '0') {
                crews.push({ name: cleanH, roleHint: 'Helper' });
              }
            });
          }
          if (p.helper2) {
            p.helper2.split(/[,&/]+/).forEach((h: string) => {
              const cleanH = h.trim();
              if (cleanH && cleanH !== '-' && cleanH !== '0') {
                crews.push({ name: cleanH, roleHint: 'Helper' });
              }
            });
          }
        });
      });
    });
    return crews;
  }, [filteredWeeks]);

  // Auto-run intelligent crew mapping for current sheet
  useEffect(() => {
    if (currentSheetCrews.length > 0) {
      const mappings = crewAutoMapper.processRawCrewBatch(currentSheetCrews);
      setDetectedCrewMappings(prev => {
        const updated = { ...mappings };
        Object.keys(prev).forEach(k => {
          if (prev[k].isUserOverridden && updated[k]) {
            updated[k] = prev[k];
          }
        });
        return updated;
      });
    }
  }, [currentSheetCrews]);

  // Handle crew mapping modification
  const handleCrewMappingChange = (rawName: string, targetCrewName: string) => {
    const foundCrew = officialCrewsList.find(c => c.name.toUpperCase() === targetCrewName.toUpperCase());
    setDetectedCrewMappings(prev => {
      const current = prev[rawName];
      const updated: CrewMappingEntry = {
        rawName,
        roleHint: current?.roleHint || 'Driver',
        occurrenceCount: current?.occurrenceCount || 1,
        matchedCrewId: foundCrew?.id || null,
        matchedCrewName: targetCrewName,
        matchedCrewRole: foundCrew?.role || 'Driver',
        confidence: 'exact',
        confidenceScore: 100,
        similarityReason: `Dipetakan manual oleh pengguna ke '${targetCrewName}'`,
        isUserOverridden: true
      };
      crewAutoMapper.saveMappingPreference(rawName, targetCrewName);
      return { ...prev, [rawName]: updated };
    });
  };

  // Handle new crew created via quick modal
  const handleCrewCreated = (newCrew: OfficialCrewItem) => {
    const updatedList = crewAutoMapper.getOfficialCrewList();
    setOfficialCrewsList(updatedList);

    setDetectedCrewMappings(prev => {
      const current = prev[newCrew.name];
      return {
        ...prev,
        [newCrew.name]: {
          rawName: newCrew.name,
          roleHint: newCrew.role as any,
          occurrenceCount: current?.occurrenceCount || 1,
          matchedCrewId: newCrew.id,
          matchedCrewName: newCrew.name,
          matchedCrewRole: newCrew.role,
          confidence: 'exact',
          confidenceScore: 100,
          similarityReason: `Kru baru '${newCrew.name}' berhasil didaftarkan ke database resmi AKK`,
          isUserOverridden: true,
          isNewlyCreated: true
        }
      };
    });

    setSyncSuccessMessage(`✨ Kru baru '${newCrew.name}' (${newCrew.role}) berhasil didaftarkan dan dipetakan otomatis!`);
    setTimeout(() => setSyncSuccessMessage(null), 6000);
  };

  // Aggregate statistics synchronized with Area Banyuwangi, Area Luar Kota, Area Bali, and Cabang Crew Count
  const stats = useMemo(() => {
    let totalTrips = 0;
    let totalWarehouseRoles = 0;
    let totalLeaves = 0;
    let totalOff = 0;
    let totalLuarKota = 0;
    let totalBaliOnly = 0;
    let totalLuarKotaOnly = 0;
    let totalLokal = 0;
    const uniqueAreasSet = new Set<string>();

    filteredWeeks.forEach((w: AdminScheduleWeek) => {
      w.days.forEach((d: AdminScheduleDay) => {
        totalTrips += d.pengiriman.length;
        totalWarehouseRoles += d.gudang.length;
        totalLeaves += d.karyawanIzin.length;
        totalOff += d.pengirimanOff.length;
        d.pengiriman.forEach((p: DeliveryAssignment) => {
          if (p.area) {
            const std = standardizeAreaName(p.area);
            uniqueAreasSet.add(std);
            const isBali = isAreaBaliSchedule(p.area);
            const isLK = isAreaLuarKotaSchedule(p.area);
            if (isBali || isLK) {
              totalLuarKota++;
              if (isBali && !std.toUpperCase().includes('KANVAS LKT')) {
                totalBaliOnly++;
              } else {
                totalLuarKotaOnly++;
              }
            } else {
              totalLokal++;
            }
          }
        });
      });
    });

    const allUsers = logisticsStore.getUsers();
    const branchCrewCount = officialCrewsList.filter(c => {
      const matchedUser = allUsers.find(
        u => `crw-${u.id}` === c.id || logisticsStore.isSameCrewPersonName(u.fullName, c.name)
      );
      if (matchedUser) {
        return logisticsStore.isActiveDeliveryCrewUser(matchedUser, effectiveActiveBranchId);
      }
      return branchStore.getCrewBranchId(c.id, c.name) === effectiveActiveBranchId;
    }).length;

    return { 
      totalTrips, 
      totalWarehouseRoles, 
      totalLeaves, 
      totalOff, 
      totalLuarKota, 
      totalBaliOnly,
      totalLuarKotaOnly,
      totalLokal,
      totalUniqueAreas: uniqueAreasSet.size,
      branchCrewCount
    };
  }, [filteredWeeks, officialCrewsList, effectiveActiveBranchId]);

  // Handle Export to Excel .xlsx
  const handleExportXLSX = () => {
    try {
      const rows: any[][] = [];
      
      const periodLabel = selectedMonth === -1 ? `Semua Bulan ${selectedYear}` : `${MONTH_NAMES[selectedMonth]} ${selectedYear}`;
      // Header metadata
      rows.push(['PT ANUGRAH KEMASAN KREATIF - BANYUWANGI CENTRAL HUB']);
      rows.push(['JADWAL PENGIRIMAN & PENUGASAN ARMADA']);
      rows.push([`Periode: ${periodLabel}`, 'Total Pengiriman: ' + stats.totalTrips]);
      rows.push([]);

      filteredWeeks.forEach(week => {
        rows.push([`=== ${week.weekLabel} (${week.dateRangeLabel}) ===`]);
        rows.push([
          'TANGGAL', 
          'HARI', 
          'KATEGORI', 
          'DRIVER / PETUGAS', 
          'HELPER / PIC', 
          'AREA / ROLE', 
          'ARMADA / MOBIL', 
          'BACKUP / TARGET / KET'
        ]);

        week.days.forEach((day: AdminScheduleDay) => {
          // Deliveries
          day.pengiriman.forEach((p: DeliveryAssignment) => {
            rows.push([
              day.dateString,
              day.dayName,
              'FORMASI PENGIRIMAN',
              p.driver,
              p.helper,
              p.area,
              p.armada,
              p.target ? `Target: ${p.target}` : (p.backup || '-')
            ]);
          });

          // Warehouse
          day.gudang.forEach((g: WarehouseCrewAssignment) => {
            rows.push([
              day.dateString,
              day.dayName,
              'FORMASI GUDANG',
              g.nama,
              '-',
              g.role,
              '-',
              g.keterangan || '-'
            ]);
          });

          // Off / Maintenance
          day.pengirimanOff.forEach((o: OffDeliveryArmada) => {
            rows.push([
              day.dateString,
              day.dayName,
              'PENGIRIMAN OFF / ARMADA FREE',
              o.nama,
              '-',
              o.keterangan,
              '-',
              o.backup || '-'
            ]);
          });

          // Leave / Absence
          day.karyawanIzin.forEach((iz: EmployeeAbsence) => {
            rows.push([
              day.dateString,
              day.dayName,
              'KARYAWAN IZIN / SAKIT',
              iz.nama,
              '-',
              iz.keterangan,
              '-',
              iz.backup || '-'
            ]);
          });
        });
        rows.push([]);
      });

      const worksheet = XLSX.utils.aoa_to_sheet(rows);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'ALL');
      XLSX.writeFile(workbook, `Jadwal_Operasional_AKK_Sheet_ALL_${new Date().toISOString().substring(0, 10)}.xlsx`);
    } catch (err) {
      console.error('Export error:', err);
      alert('Gagal mengekspor file spreadsheet.');
    }
  };

  const downloadScheduleTemplate = () => {
    try {
      const wb = XLSX.utils.book_new();
      const wsData = [
        ['PT ANUGRAH KEMASAN KREATIF - TEMPLATE JADWAL OPERASIONAL LOGISTIK'],
        ['Tanggal', 'No', 'Driver', 'Helper', '', 'Area Kirim', 'Armada'],
        ['', '', '', '1', '2', '', ''],
        // Day 1: 05/01/2026
        ['05/01/2026', 1, 'Supri', 'Rifal', 'Aldi', 'DENPASAR 1', 'DS3'],
        ['', 2, 'Wahyu', 'Yusuf', '', 'DENPASAR 2', 'DS1'],
        ['', 3, 'Tiar', 'Faris', '', 'BONDOWOSO', 'NS3'],
        ['', 4, 'Aris', 'Rohman', '', 'SITUBONDO', 'DS2'],
        ['', 5, 'Andre', 'Aan', '', 'SUSULAN GENTENG - ROGOJAMPI', 'DS4'],
        ['', 6, 'Wibi', 'Teguh', '', 'PURWO DAMBUNTUNG', 'NS2'],
        ['', 7, 'Budi', 'Rizal', '', 'PURWO PASAR', 'NS1'],
        ['', 8, 'Hadi', 'Yudi', '', 'JAJAG RETAIL', 'N20'],
        ['------------------------------------------------------------', '----------------', '----------------', '----------------', '----------------', '----------------', '----------------'],
        // Day 2: 06/01/2026
        ['06/01/2026', 1, 'Andre', 'Aan', 'Hardi', 'SINGARAJA', 'DS5'],
        ['', 2, 'Hadi', 'Yusuf', '', 'SUMBERAYU RETAIL', 'NL2'],
        ['', 3, 'Aris', 'Rifal', '', 'GALEKAN', 'NL1'],
        ['', 4, 'Tiar', 'Faris', '', 'GROSIR BWI - ROGOJAMPI', 'DS4'],
        ['', 5, 'Budi', 'Rohman', '', 'SUSULAN SANGGAR JAJAG', 'NS1'],
        ['------------------------------------------------------------', '----------------', '----------------', '----------------', '----------------', '----------------', '----------------'],
        // Day 3: 07/01/2026
        ['07/01/2026', 1, 'Supri', 'Rifal', '', 'DENPASAR 1', 'DS5'],
        ['', 2, 'Hadi', 'Faris', '', 'DENPASAR 2', 'DS3'],
        ['', 3, 'Aris', 'Rohman', '', 'GENTENG RETAIL', 'NL2'],
        ['', 4, 'Tiar', 'Yusuf', '', 'ROGOJAMPI RETAIL', 'DS4'],
        ['', 5, 'Budi', 'Aan', '', 'MUNCAR RETAIL', 'NS2'],
        ['', 6, 'Aldi', 'Wahyu', '', 'KETAPANG WONGSOREJO', 'NS3']
      ];
      const ws = XLSX.utils.aoa_to_sheet(wsData);
      XLSX.utils.book_append_sheet(wb, ws, 'ALL');
      XLSX.writeFile(wb, 'Template_Jadwal_Operasional_AKK.xlsx');
    } catch (err) {
      console.error('Error generating template:', err);
      alert('Gagal mengunduh template spreadsheet.');
    }
  };

  // Core file processing with server-side schema validation & preview modal
  // Instant local spreadsheet schema validation (reliable, offline-safe, zero HTML error)
  const validateSpreadsheetLocally = (rows: any[][]) => {
    if (!rows || rows.length === 0) {
      return {
        valid: false,
        error: 'Spreadsheet Kosong',
        message: 'File Excel tidak memiliki baris data atau lembar kerja kosong.',
        missingColumns: ['Semua Kolom Data'],
        correctFormat: 'NO | TANGGAL | DRIVER | HELPER | AREA | ARMADA',
        templateDownloadUrl: '/api/download-schedule-template'
      };
    }

    let hasDriver = false;
    let hasArea = false;
    let hasArmada = false;
    const detectedHeaders: string[] = [];

    for (let r = 0; r < Math.min(rows.length, 10); r++) {
      const row = rows[r];
      if (!row || !Array.isArray(row)) continue;
      for (let c = 0; c < row.length; c++) {
        const val = String(row[c] || '').toUpperCase().trim();
        if (val) detectedHeaders.push(val);
        if (val === 'DRIVER' || val === 'SUPIR') hasDriver = true;
        if (val.includes('AREA') || val.includes('TUJUAN') || val.includes('RUTE')) hasArea = true;
        if (val === 'ARMADA' || val === 'MOBIL' || val === 'PLAT') hasArmada = true;
      }
    }

    const missingColumns: string[] = [];
    if (!hasDriver) missingColumns.push('DRIVER (atau SUPIR)');
    if (!hasArea) missingColumns.push('AREA / TUJUAN');
    if (!hasArmada) missingColumns.push('ARMADA');

    if (missingColumns.length > 0) {
      return {
        valid: false,
        error: 'Format Kolom Spreadsheet Tidak Sesuai Schema',
        message: `Header kolom wajib PT AKK Logistics tidak lengkap. Kolom yang tidak ditemukan: ${missingColumns.join(', ')}.`,
        missingColumns,
        detectedHeaders: Array.from(new Set(detectedHeaders)).slice(0, 15),
        correctFormat: 'Format Standar: NO | TANGGAL | DRIVER | HELPER | AREA / TUJUAN | ARMADA',
        templateDownloadUrl: '/api/download-schedule-template'
      };
    }

    return { valid: true };
  };

  // Core file processing with instant client-side validation & preview modal
  const processFile = async (file: File) => {
    if (!file) return;
    setUploadedFileName(file.name);

    try {
      // 1. Read workbook directly in browser via ArrayBuffer
      const arrayBuffer = await file.arrayBuffer();
      const data = new Uint8Array(arrayBuffer);
      const workbook = XLSX.read(data, { type: 'array' });
      
      const sheetName = workbook.SheetNames.find(n => n.toUpperCase() === 'ALL') || workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const jsonRows = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];

      // 2. Perform client-side schema validation
      const valResult = validateSpreadsheetLocally(jsonRows);

      if (!valResult.valid) {
        setSchemaValidationError(valResult);
        setUploadToast({
          message: valResult.error || 'Format file Excel tidak sesuai dengan schema sistem.',
          type: 'error',
          templateDownloadUrl: valResult.templateDownloadUrl || '/api/download-schedule-template'
        });
        return;
      }

      setSchemaValidationError(null);
      setUploadToast({
        message: 'File spreadsheet berhasil divalidasi dan siap dipratinjau.',
        type: 'success'
      });

      // 3. Smart Header & Data Row Extraction:
      // (a) Scan first 10 rows for column headers
      let headerRowIdx = -1;
      let maxKeywordMatches = 0;

      for (let r = 0; r < Math.min(jsonRows.length, 10); r++) {
        const row = jsonRows[r];
        if (!row || !Array.isArray(row) || row.length === 0) continue;
        let matches = 0;
        for (const cell of row) {
          const cellUpper = String(cell || '').toUpperCase().trim();
          if (cellUpper === 'DRIVER' || cellUpper === 'SUPIR') matches += 3;
          if (cellUpper.includes('AREA') || cellUpper.includes('TUJUAN') || cellUpper.includes('RUTE')) matches += 3;
          if (cellUpper === 'ARMADA' || cellUpper === 'MOBIL' || cellUpper === 'PLAT') matches += 3;
          if (cellUpper.includes('TANGGAL') || cellUpper.includes('DATE') || cellUpper.includes('HARI')) matches += 2;
          if (cellUpper === 'HELPER' || cellUpper === 'KERNET') matches += 2;
          if (cellUpper === 'NO' || cellUpper === 'NO.' || cellUpper === 'NOMOR' || cellUpper === 'NO URUT') matches += 1;
        }
        if (matches > maxKeywordMatches) {
          maxKeywordMatches = matches;
          headerRowIdx = r;
        }
      }

      // Fallback: pick the row with the most non-empty columns if no strong header detected
      if (headerRowIdx === -1 || maxKeywordMatches < 2) {
        let maxNonEmpty = 0;
        for (let r = 0; r < Math.min(jsonRows.length, 5); r++) {
          const row = jsonRows[r];
          if (!row || !Array.isArray(row)) continue;
          const count = row.filter(c => c !== undefined && c !== null && String(c).trim() !== '').length;
          if (count > maxNonEmpty) {
            maxNonEmpty = count;
            headerRowIdx = r;
          }
        }
        if (headerRowIdx === -1) headerRowIdx = 0;
      }

      const rawHeaderRow = jsonRows[headerRowIdx] || [];
      const nextRow = jsonRows[headerRowIdx + 1];

      // (b) Check if row directly below headers is a sub-header (e.g. '1', '2' under Helper)
      let isNextRowSubheader = false;
      if (nextRow && Array.isArray(nextRow) && nextRow.length > 0) {
        const hasDriverOrArea = nextRow.some(c => {
          const str = String(c || '').trim();
          return str.length > 3 && !/^\d+$/.test(str) && !['SENIN', 'SELASA', 'RABU', 'KAMIS', 'JUMAT', 'SABTU', 'MINGGU'].includes(str.toUpperCase());
        });
        const hasSubIndices = nextRow.some(c => String(c || '').trim() === '1' || String(c || '').trim() === '2');
        if (!hasDriverOrArea && hasSubIndices) {
          isNextRowSubheader = true;
        }
      }

      const dataStartIdx = isNextRowSubheader ? headerRowIdx + 2 : headerRowIdx + 1;
      const allDataRows = jsonRows.slice(dataStartIdx);

      // (c) Find max columns across rawHeaderRow, nextRow, and all data rows to avoid any column truncation
      let maxCols = Math.max(rawHeaderRow.length, isNextRowSubheader && nextRow ? nextRow.length : 0);
      for (const dr of allDataRows) {
        if (dr && Array.isArray(dr) && dr.length > maxCols) {
          maxCols = dr.length;
        }
      }

      // (d) Build clean headers
      const finalHeaders: string[] = [];
      let lastParentHeader = '';

      for (let c = 0; c < maxCols; c++) {
        let h = String(rawHeaderRow[c] || '').trim();
        if (h) {
          lastParentHeader = h;
        }

        if (isNextRowSubheader && nextRow && nextRow[c] !== undefined && String(nextRow[c]).trim() !== '') {
          const sub = String(nextRow[c]).trim();
          if (h) {
            h = `${h} ${sub}`;
          } else if (lastParentHeader) {
            h = `${lastParentHeader} ${sub}`;
          } else {
            h = sub;
          }
        }

        if (!h) {
          if (c === 0) h = 'Tanggal';
          else if (c === 1 && rawHeaderRow.some(x => String(x).toUpperCase().includes('DRIVER'))) h = 'No';
          else if (c === 4 && String(finalHeaders[3] || '').includes('Helper')) h = 'Helper 2';
          else h = `Kolom ${c + 1}`;
        }
        finalHeaders.push(h);
      }

      setPreviewFile(file);
      setPreviewHeaders(finalHeaders);
      setPreviewTopRows(allDataRows);
      setPreviewTotalRows(allDataRows.length);
      setPreviewSheetName(sheetName);
      setIsExcelPreviewModalOpen(true);
    } catch (err) {
      console.error('File parsing error:', err);
      alert('Gagal membaca struktur file Excel / CSV.');
    }
  };

  const executeFinalUpload = async (file: File) => {
    setIsExcelPreviewModalOpen(false);
    setUploadToast(null);
    if (!file) return;
    try {
      const arrayBuffer = await file.arrayBuffer();
      const data = new Uint8Array(arrayBuffer);
      const workbook = XLSX.read(data, { type: 'array' });
      
      const sheetName = workbook.SheetNames.find(n => n.toUpperCase() === 'ALL') || workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const jsonRows = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];

      setUploadedRowsCount(jsonRows.length);
      const parsedTrips = googleSheetsApiService.parseScheduleRows(jsonRows);
      setParsedUploadedTrips(parsedTrips);

      if (parsedTrips.length > 0) {
        mergeAndSaveCombinedTrips(
          parsedTrips.map(t => ({ ...t, source: 'excel' as const })),
          importMode,
          file.name
        );
      }

      const rawAreas = parsedTrips.map(t => t.area).filter(Boolean);
      const mappings = areaAutoMapper.processRawAreaBatch(rawAreas);
      setDetectedAreaMappings(mappings);

      const rawCrews: Array<{ name: string; roleHint?: 'Driver' | 'Helper' }> = [];
      parsedTrips.forEach(t => {
        if (t.driver) rawCrews.push({ name: t.driver, roleHint: 'Driver' });
        if (t.helper) {
          t.helper.split(/[,&/]+/).forEach(h => {
            const cleanH = h.trim();
            if (cleanH && cleanH !== '-' && cleanH !== '0') {
              rawCrews.push({ name: cleanH, roleHint: 'Helper' });
            }
          });
        }
        if (t.helper2) {
          t.helper2.split(/[,&/]+/).forEach(h => {
            const cleanH = h.trim();
            if (cleanH && cleanH !== '-' && cleanH !== '0') {
              rawCrews.push({ name: cleanH, roleHint: 'Helper' });
            }
          });
        }
      });
      const crewMappings = crewAutoMapper.processRawCrewBatch(rawCrews);
      setDetectedCrewMappings(crewMappings);

      const mappingDict: Record<string, string> = {};
      Object.entries(mappings).forEach(([k, v]) => {
        if (v.matchedOfficialArea) mappingDict[k] = v.matchedOfficialArea;
      });

      const targetContextDate = new Date(selectedYear, selectedMonth === -1 ? 0 : selectedMonth, 5);
      const validation = scheduleImportValidator.validateImportBatch(parsedTrips, targetContextDate, mappingDict);
      setUploadedValidationReport(validation);

      const hasUnmappedArea = Object.values(mappings).some(m => m.confidence === 'unmapped');
      const hasUnmappedCrew = Object.values(crewMappings).some(m => m.confidence === 'unmapped');
      setActiveUploadTab(hasUnmappedArea ? 'area_mapping' : (hasUnmappedCrew ? 'crew_mapping' : 'audit'));
      setIsUploadModalOpen(true);
    } catch (err) {
      console.error('Final upload execution error:', err);
      alert('Gagal memproses file Excel secara penuh.');
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
  };

  // Handle direct manual live fetch from connected Google Sheets
  const handleLiveFetchFromSheets = async () => {
    setIsLiveFetching(true);
    try {
      const conf = googleSheetsApiService.getConfig();
      let sheetId = conf.spreadsheetId;
      if (!sheetId && conf.spreadsheetUrl) {
        sheetId = googleSheetsApiService.extractSpreadsheetId(conf.spreadsheetUrl);
      }
      if (!sheetId) {
        const storeConf = googleSheetsSyncService.getConfig();
        if (storeConf?.spreadsheetUrl) {
          sheetId = googleSheetsApiService.extractSpreadsheetId(storeConf.spreadsheetUrl);
        }
      }

      if (!sheetId) {
        setIsApiSyncModalOpen(true);
        setIsLiveFetching(false);
        return;
      }

      const selectedSheet = conf.selectedSheetTitle || 'ALL';
      const rows = await googleSheetsApiService.getSheetValues(sheetId, `${selectedSheet}!A:Z`);
      if (!rows || rows.length === 0) {
        throw new Error('Tidak ada baris data yang ditemukan di spreadsheet.');
      }

      const parsed = googleSheetsApiService.parseScheduleRows(rows);
      if (parsed.length === 0) {
        throw new Error('Gagal mengenali kolom jadwal pengiriman pada spreadsheet.');
      }

      const groupedWeeks = convertParsedTripsToWeeks(parsed);
      updateWeeks(groupedWeeks);

      const rawAreas = parsed.map(t => t.area).filter(Boolean);
      const mappings = areaAutoMapper.processRawAreaBatch(rawAreas);
      setDetectedAreaMappings(mappings);

      const mappingDict: Record<string, string> = {};
      Object.entries(mappings).forEach(([k, v]) => {
        if (v.matchedOfficialArea) mappingDict[k] = v.matchedOfficialArea;
      });

      const crewMappingDict: Record<string, string> = {};
      Object.entries(detectedCrewMappings).forEach(([k, v]) => {
        if (v.matchedCrewName) crewMappingDict[k] = v.matchedCrewName;
      });

      // Synchronize directly to operational schedules so changes & additions immediately reflect in system
      const liveTargetDate = new Date(selectedYear, selectedMonth === -1 ? 0 : selectedMonth, 5);
      const report = scheduleImportValidator.validateImportBatch(parsed, liveTargetDate, mappingDict);
      const syncRes = scheduleImportValidator.syncValidatedItems(report.items, {
        skipDuplicates: false,
        overwriteDuplicates: true,
        skipInvalid: true,
        customAreaMapping: mappingDict,
        customCrewMapping: crewMappingDict
      });

      // Directly sync to submenu Histori & Otorisasi Kru
      logisticsStore.syncSchedulesToCrewHistory();

      const totalActive = syncRes.syncedCount + syncRes.overwrittenCount;
      const daysCount = groupedWeeks[0]?.days.length || 0;
      const msg = `⚡ Berhasil memperbarui data live Google Sheets! ${syncRes.overwrittenCount} jadwal diperbarui, ${syncRes.syncedCount} ritase baru ditambahkan (${daysCount} hari). Data kru otomatis masuk ke 'Histori & Otorisasi Kru'.`;
      setSyncSuccessMessage(msg);
      if (onSyncComplete) onSyncComplete(totalActive);
      setTimeout(() => setSyncSuccessMessage(null), 8000);
    } catch (err: any) {
      console.warn('Live fetch notice:', err?.message || err);
      setIsApiSyncModalOpen(true);
    } finally {
      setIsLiveFetching(false);
    }
  };

  // Handle Sync to Active Operational Schedule with Validation & Area Mappings
  const handleSyncToOperationalSchedules = () => {
    setIsSyncing(true);

    const mappingDict: Record<string, string> = {};
    Object.entries(detectedAreaMappings).forEach(([k, v]) => {
      if (v.matchedOfficialArea) mappingDict[k] = v.matchedOfficialArea;
    });

    const crewMappingDict: Record<string, string> = {};
    Object.entries(detectedCrewMappings).forEach(([k, v]) => {
      if (v.matchedCrewName) crewMappingDict[k] = v.matchedCrewName;
    });

    const effectiveMonth = selectedMonth === -1 ? 0 : selectedMonth;
    const monthNumPad = String(effectiveMonth + 1).padStart(2, '0');

    const tripsToSync: ParsedSheetTrip[] = [];
    filteredWeeks.forEach((week: AdminScheduleWeek) => {
      week.days.forEach((day: AdminScheduleDay) => {
        day.pengiriman.forEach((p: DeliveryAssignment, idx: number) => {
          const dayNumPad = String(day.dayNumber).padStart(2, '0');
          const resolvedArea = mappingDict[p.area] || standardizeAreaName(p.area);
          const resolvedDriver = crewMappingDict[p.driver] || p.driver;
          const resolvedHelper = p.helper ? (crewMappingDict[p.helper] || p.helper) : undefined;
          const resolvedHelper2 = p.helper2 ? (crewMappingDict[p.helper2] || p.helper2) : undefined;
          tripsToSync.push({
            driver: resolvedDriver,
            helper: resolvedHelper,
            helper2: resolvedHelper2,
            area: resolvedArea,
            armada: p.armada,
            target: p.target,
            dateStr: `${selectedYear}-${monthNumPad}-${dayNumPad}`,
            dayName: day.dayName,
            notes: `PO-AKK-${selectedYear}${monthNumPad}${dayNumPad}-${p.armada.replace(/[^A-Za-z0-9]/g, '')}-${idx + 1}`
          });
        });
      });
    });

    // Run duplicate and format validation with custom mappings
    const targetDate = new Date(selectedYear, effectiveMonth, 5);
    const report = scheduleImportValidator.validateImportBatch(tripsToSync, targetDate, mappingDict);
    const syncRes = scheduleImportValidator.syncValidatedItems(report.items, {
      skipDuplicates: false,
      overwriteDuplicates: true,
      skipInvalid: true,
      customAreaMapping: mappingDict,
      customCrewMapping: crewMappingDict
    });

    // Directly push to submenu Histori & Otorisasi Kru
    logisticsStore.syncSchedulesToCrewHistory();

    // Robust Upsert to Server & Supabase Cloud for 147+ shipments batch
    persistSchedulesToDatabase(logisticsStore.getSchedules(), weeks, {
      month: String(effectiveMonth + 1),
      year: Number(selectedYear),
      source: 'schedule_management_upsert_147'
    }).catch(err => console.warn('[Persistent Upsert Note]', err));

    // Sinkronkan state minggu ke store (MySQL-backed)
    logisticsStore.saveAdminScheduleWeeks(selectedYear, effectiveMonth, weeks);

    setTimeout(() => {
      setIsSyncing(false);
      const msg = `⚡ Berhasil menyinkronkan data! ${syncRes.overwrittenCount} jadwal diperbarui, ${syncRes.syncedCount} jadwal baru ditambahkan. Data tersimpan permanen & aman dari refresh/off.`;
      setSyncSuccessMessage(msg);
      if (onSyncComplete) onSyncComplete(syncRes.syncedCount + syncRes.overwrittenCount);
      setTimeout(() => setSyncSuccessMessage(null), 8000);
    }, 600);
  };

  return (
    <div className="akk-flat-schedule bg-slate-50 dark:bg-slate-950 p-3 sm:p-5 rounded-2xl space-y-5">
      {activeSubPage === 'schedule' ? (
        <>
      {/* 1. Header Halaman (Bagian Atas): Flat Modern Clean Blue & White */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 sm:p-6">
        <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4">
          <div className="space-y-1">
            <h2 className="text-xl font-bold text-slate-900 dark:text-slate-50 tracking-tight">
              Jadwal Pengiriman &amp; Penugasan Armada
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 max-w-2xl leading-relaxed">
              Tabel jadwal pengiriman armada, penugasan kru supir &amp; helper, jadwal Kanvas LKT, serta alokasi area distribusi terintegrasi.
            </p>
          </div>

          {/* Simplified Flat Action Bar */}
          <div className="flex items-center gap-2.5 flex-wrap">
            {canEditSchedules && (
              <input
                type="file"
                ref={fileInputRef}
                accept=".xlsx,.xls,.csv"
                className="hidden"
                onChange={handleFileUpload}
              />
            )}

            {canEditSchedules ? (
              <>
                <button
                  onClick={() => {
                    const today = getTodayIso();
                    const branchDrivers = getIntegratedDrivers(effectiveActiveBranchId);
                    const branchHelpers = getIntegratedHelpers(effectiveActiveBranchId);
                    setManualScheduleFormError(null);
                    setAreaSearchFilter('');
                    setAreaCategoryFilter('all');
                    setIsAreaPickerExpanded(false);
                    setManualScheduleForm({
                      dateIso: today,
                      departureDateIso: today,
                      returnDateIso: today,
                      driver: branchDrivers[0]?.name || '',
                      helper: branchHelpers[0]?.name || '',
                      helper2: '',
                      area: '',
                      armada: '',
                      target: '',
                      departureTime: '07:30',
                      targetReturnTime: '17:00',
                      branchId: effectiveActiveBranchId,
                      bypassChecklistDirectComplete: false
                    });
                    setIsUploadConfigModalOpen(true);
                  }}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap shrink-0"
                  title="Pop-up Form Tambah Jadwal Baru (Manual)"
                >
                  <Plus className="w-4 h-4" />
                  <span>Tambah Jadwal Manual</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    window.dispatchEvent(
                      new CustomEvent('akk-open-create-shipment', {
                        detail: { branchId: effectiveActiveBranchId }
                      })
                    );
                  }}
                  className="inline-flex items-center justify-center gap-2 min-h-[42px] px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 border border-blue-700 text-white text-[13.5px] font-bold transition-colors cursor-pointer whitespace-nowrap shrink-0"
                  title="Buat Kiriman Baru"
                >
                  <Plus className="w-[18px] h-[18px]" strokeWidth={2.5} />
                  <span>Buat Kiriman</span>
                </button>

                <button
                  onClick={() => {
                    const effectiveMo = selectedMonth === -1 ? 0 : selectedMonth;
                    setImportMonth(MONTH_NAMES[effectiveMo] || 'Januari');
                    setImportYear(String(selectedYear));
                    setActiveSubPage('upload_excel');
                  }}
                  className="inline-flex items-center justify-center gap-2 min-h-[42px] px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 border border-blue-700 text-white text-[13.5px] font-bold transition-colors cursor-pointer whitespace-nowrap shrink-0"
                  title="Halaman Unggah File Jadwal Excel (.xls, .xlsx, .csv)"
                >
                  <Upload className="w-[18px] h-[18px]" strokeWidth={2.25} />
                  <span>Unggah File Excel</span>
                </button>

                <button
                  onClick={() => {
                    setActiveMappingCategory('area');
                    setIsAreaMappingModalOpen(true);
                  }}
                  className="inline-flex items-center justify-center gap-2 min-h-[42px] px-4 py-2 rounded-xl bg-white dark:bg-[#1E293B] hover:bg-blue-50 dark:hover:bg-[#1E3A5F] text-slate-700 dark:text-slate-200 text-[13.5px] font-semibold border border-slate-200 dark:border-[#334155] hover:border-blue-300 transition-colors cursor-pointer whitespace-nowrap shrink-0"
                  title="Pemetaan Area Kirim"
                >
                  <MapPin className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                  <span>Area ({Object.keys(detectedAreaMappings).length})</span>
                </button>

                <button
                  onClick={() => {
                    setActiveMappingCategory('crew');
                    setIsAreaMappingModalOpen(true);
                  }}
                  className="inline-flex items-center justify-center gap-2 min-h-[42px] px-4 py-2 rounded-xl bg-white dark:bg-[#1E293B] hover:bg-blue-50 dark:hover:bg-[#1E3A5F] text-slate-700 dark:text-slate-200 text-[13.5px] font-semibold border border-slate-200 dark:border-[#334155] hover:border-blue-300 transition-colors cursor-pointer whitespace-nowrap shrink-0"
                  title="Pemetaan Kru (Driver & Helper)"
                >
                  <Users className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                  <span>Kru ({Object.keys(detectedCrewMappings).length})</span>
                </button>
              </>
            ) : (
              <span
                className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-blue-50 dark:bg-[#1E3A5F] text-blue-700 dark:text-blue-300 text-xs font-semibold"
                title="Akun Anda diatur Hanya Lihat (Read Only) pada menu Jadwal & Penugasan Armada"
              >
                <Eye className="w-4 h-4" />
                <span>Mode Hanya Lihat</span>
              </span>
            )}

            <button
              onClick={handleExportXLSX}
              className="inline-flex items-center justify-center gap-2 min-h-[42px] px-4 py-2 rounded-xl bg-white dark:bg-[#1E293B] hover:bg-blue-50 dark:hover:bg-[#1E3A5F] text-slate-700 dark:text-slate-200 text-[13.5px] font-semibold border border-slate-200 dark:border-[#334155] hover:border-blue-300 transition-colors cursor-pointer whitespace-nowrap shrink-0"
              title="Ekspor ke Excel (.xlsx)"
            >
              <Download className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              <span>Ekspor</span>
            </button>
          </div>
        </div>

        {/* Sync Success Banner */}
        {syncSuccessMessage && (
          <div className="mt-4 p-3 rounded-xl bg-blue-50 dark:bg-[#1E3A5F] border border-blue-200 dark:border-blue-500/40 text-blue-800 dark:text-blue-100 text-xs flex items-center gap-2.5">
            <CheckCircle2 className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
            <span className="font-semibold">{syncSuccessMessage}</span>
          </div>
        )}
      </div>

      {/* 2. Baris Filter & Periode (Satu Kartu Putih Panjang) */}
      <div className="bg-white dark:bg-[#162234] border border-slate-200 dark:border-[#24344D] rounded-2xl p-4 sm:px-6 sm:py-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-[#1E3A5F] text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
            <Calendar className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[11px] font-semibold text-blue-600 dark:text-blue-400 block">
              Periode Jadwal Pengiriman
            </span>
            <h4 className="text-base font-bold text-slate-900 dark:text-white mt-0.5">
              {selectedMonth === -1 ? `Semua Bulan ${selectedYear}` : `${MONTH_NAMES[selectedMonth]} ${selectedYear}`}
            </h4>
          </div>
        </div>

        {/* Minimalist Light-Gray Filter Selectors */}
        <div
          ref={periodDropdownRef}
          className="flex items-center gap-2.5 flex-wrap relative z-30"
        >
          <span className="text-slate-500 dark:text-slate-400 font-semibold text-xs mr-1">
            Filter Periode:
          </span>

          {/* Month Dropdown */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setOpenPeriodDropdown(prev => (prev === 'month' ? null : 'month'))}
              className={`inline-flex items-center justify-between gap-2.5 min-w-[140px] px-3.5 py-2 rounded-xl border text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                openPeriodDropdown === 'month'
                  ? 'bg-blue-50 dark:bg-[#1E3A5F] border-blue-600 text-blue-700 dark:text-blue-300'
                  : 'bg-slate-50 dark:bg-[#1E293B] hover:bg-slate-100 dark:hover:bg-[#273549] border-slate-200 dark:border-[#334155] text-slate-900 dark:text-white'
              }`}
            >
                <span className="flex items-center gap-2">
                  <Calendar className="w-3.5 h-3.5 text-[#2563EB] dark:text-[#60A5FA] shrink-0" />
                  <span>{selectedMonth === -1 ? 'Semua Bulan' : MONTH_NAMES[selectedMonth]}</span>
                </span>
                <ChevronDown
                  className={`w-3.5 h-3.5 text-[#64748B] transition-transform duration-150 ${
                    openPeriodDropdown === 'month' ? 'rotate-180 text-[#2563EB]' : ''
                  }`}
                />
              </button>

              {openPeriodDropdown === 'month' && (
                <div className="absolute left-0 mt-1.5 w-48 max-h-72 overflow-y-auto rounded-[10px] bg-white dark:bg-[#1E293B] border border-[#E2E8F0] dark:border-[#334155] shadow-md p-1.5 z-50 space-y-0.5">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedMonth(-1);
                      setOpenPeriodDropdown(null);
                    }}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                      selectedMonth === -1
                        ? 'bg-[#2563EB] text-white'
                        : 'text-[#334155] dark:text-[#E2E8F0] hover:bg-[#EFF6FF] dark:hover:bg-[#1E3A5F]'
                    }`}
                  >
                    <span>Semua Bulan</span>
                    {selectedMonth === -1 && <Check className="w-3.5 h-3.5 shrink-0" />}
                  </button>
                  <div className="my-1 border-t border-[#E2E8F0] dark:border-[#334155]" />
                  {MONTH_NAMES.map((m, idx) => {
                    const isAct = selectedMonth === idx;
                    return (
                      <button
                        key={m}
                        type="button"
                        onClick={() => {
                          setSelectedMonth(idx);
                          setOpenPeriodDropdown(null);
                        }}
                        className={`w-full flex items-center justify-between px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                          isAct
                            ? 'bg-[#2563EB] text-white font-semibold'
                            : 'text-[#334155] dark:text-[#E2E8F0] hover:bg-[#EFF6FF] dark:hover:bg-[#1E3A5F]'
                        }`}
                      >
                        <span>{m}</span>
                        {isAct && <Check className="w-3.5 h-3.5 shrink-0" />}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Year Dropdown */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setOpenPeriodDropdown(prev => (prev === 'year' ? null : 'year'))}
                className={`inline-flex items-center justify-between gap-2 min-w-[92px] px-3.5 py-2 rounded-xl border text-xs font-semibold tabular-nums transition-colors cursor-pointer whitespace-nowrap ${
                  openPeriodDropdown === 'year'
                    ? 'bg-blue-50 dark:bg-[#1E3A5F] border-blue-600 text-blue-700 dark:text-blue-300'
                    : 'bg-slate-50 dark:bg-[#1E293B] hover:bg-slate-100 dark:hover:bg-[#273549] border-slate-200 dark:border-[#334155] text-slate-900 dark:text-white'
                }`}
              >
                <span>{selectedYear}</span>
                <ChevronDown
                  className={`w-3.5 h-3.5 text-[#64748B] transition-transform duration-150 ${
                    openPeriodDropdown === 'year' ? 'rotate-180 text-[#2563EB]' : ''
                  }`}
                />
              </button>

              {openPeriodDropdown === 'year' && (
                <div className="absolute left-0 mt-1.5 w-32 rounded-xl bg-white dark:bg-[#1E293B] border border-slate-200 dark:border-[#334155] shadow-sm p-1.5 z-50 space-y-0.5">
                  {[2024, 2025, 2026, 2027, 2028].map(yr => {
                    const isAct = selectedYear === yr;
                    return (
                      <button
                        key={yr}
                        type="button"
                        onClick={() => {
                          setSelectedYear(yr);
                          setOpenPeriodDropdown(null);
                        }}
                        className={`w-full flex items-center justify-between px-3 py-1.5 rounded-lg text-xs font-semibold tabular-nums transition-colors cursor-pointer ${
                          isAct
                            ? 'bg-blue-600 text-white'
                            : 'text-slate-700 dark:text-slate-200 hover:bg-blue-50 dark:hover:bg-[#1E3A5F]'
                        }`}
                      >
                        <span>{yr}</span>
                        {isAct && <Check className="w-3.5 h-3.5 shrink-0" />}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Cabang Dropdown */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setOpenPeriodDropdown(prev => (prev === 'branch' ? null : 'branch'))}
                className={`inline-flex items-center justify-between gap-2.5 min-w-[168px] px-3.5 py-2 rounded-xl border text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                  openPeriodDropdown === 'branch'
                    ? 'bg-blue-50 dark:bg-[#1E3A5F] border-blue-600 text-blue-700 dark:text-blue-300'
                    : 'bg-slate-50 dark:bg-[#1E293B] hover:bg-slate-100 dark:hover:bg-[#273549] border-slate-200 dark:border-[#334155] text-slate-900 dark:text-white'
                }`}
              >
                <span className="flex items-center gap-2">
                  <Building2 className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 shrink-0" />
                  <span>
                    Cabang {activeBranchRecord?.name || 'Nusantara'}
                  </span>
                </span>
                {accessibleBranches.length > 1 && (
                  <ChevronDown
                    className={`w-3.5 h-3.5 text-slate-500 transition-transform duration-150 ${
                      openPeriodDropdown === 'branch' ? 'rotate-180 text-blue-600' : ''
                    }`}
                  />
                )}
              </button>

              {openPeriodDropdown === 'branch' && accessibleBranches.length > 1 && (
                <div className="absolute right-0 mt-1.5 w-56 rounded-xl bg-white dark:bg-[#1E293B] border border-slate-200 dark:border-[#334155] shadow-sm p-1.5 z-50 space-y-0.5">
                  <div className="px-2.5 py-1.5 text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                    Pilih Cabang Operasional
                  </div>
                  {accessibleBranches.map(b => {
                    const isAct = effectiveActiveBranchId === b.id;
                    return (
                      <button
                        key={b.id}
                        type="button"
                        onClick={() => {
                          setSelectedBranchId(b.id);
                          branchStore.setActiveBranchId(b.id);
                          setOpenPeriodDropdown(null);
                        }}
                        className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                          isAct
                            ? 'bg-blue-600 text-white'
                            : 'text-slate-700 dark:text-slate-200 hover:bg-blue-50 dark:hover:bg-[#1E3A5F]'
                        }`}
                      >
                        <span className="flex items-center gap-2">
                          <Building2 className={`w-3.5 h-3.5 ${isAct ? 'text-white' : 'text-blue-600'}`} />
                          <span>Cabang {b.name}</span>
                        </span>
                        {isAct && <Check className="w-3.5 h-3.5 shrink-0" />}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
      </div>

      {/* 3. Baris Ringkasan Metrik (Grid 4 Kolom) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-[#162234] p-5 rounded-2xl border border-slate-200 dark:border-[#24344D] flex items-start justify-between gap-4">
          <div>
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 block">Total Kiriman</span>
            <div className="text-2xl font-bold text-slate-900 dark:text-white mt-2 leading-none tabular-nums">
              {stats.totalTrips} <span className="text-xs font-medium text-slate-500 dark:text-slate-400 ml-0.5">Rute</span>
            </div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-[#1E3A5F] text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
            <Truck className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white dark:bg-[#162234] p-5 rounded-2xl border border-slate-200 dark:border-[#24344D] flex items-start justify-between gap-4">
          <div>
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 block">Validasi Area</span>
            <div className="text-2xl font-bold text-slate-900 dark:text-white mt-2 leading-none tabular-nums">
              {stats.totalUniqueAreas} <span className="text-xs font-medium text-slate-500 dark:text-slate-400 ml-0.5">Area</span>
            </div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-[#1E3A5F] text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
            <MapPin className="w-5 h-5" />
          </div>
        </div>

        {isSidoarjoBranch ? (
          <div className="bg-white dark:bg-[#162234] p-5 rounded-2xl border border-slate-200 dark:border-[#24344D] flex items-start justify-between gap-4">
            <div>
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 block">Total Area Kirim</span>
              <div className="text-2xl font-bold text-slate-900 dark:text-white mt-2 leading-none tabular-nums">
                {stats.totalUniqueAreas}{' '}
                <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                  / {branchOfficialAreas.length} Area Resmi
                </span>
              </div>
            </div>
            <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-[#1E3A5F] text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
              <MapPin className="w-5 h-5" />
            </div>
          </div>
        ) : (
          <div className="bg-white dark:bg-[#162234] p-5 rounded-2xl border border-slate-200 dark:border-[#24344D] flex items-start justify-between gap-4">
            <div>
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 block">Luar Kota / Bali</span>
              <div className="text-2xl font-bold text-blue-600 dark:text-blue-400 mt-2 leading-none tabular-nums">
                {stats.totalLuarKota}{' '}
                <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                  ({stats.totalLuarKotaOnly} LK · {stats.totalBaliOnly} Bali)
                </span>
              </div>
            </div>
            <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-[#1E3A5F] text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
              <Ship className="w-5 h-5" />
            </div>
          </div>
        )}

        <div className="bg-white dark:bg-[#162234] p-5 rounded-2xl border border-slate-200 dark:border-[#24344D] flex items-start justify-between gap-4">
          <div>
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 block">Total Personel Kru</span>
            <div className="text-2xl font-bold text-slate-900 dark:text-white mt-2 leading-none tabular-nums">
              {stats.branchCrewCount} <span className="text-xs font-medium text-slate-500 dark:text-slate-400 ml-0.5">Terdaftar</span>
            </div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-[#1E3A5F] text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
            <Users className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Main Content: Split View (Calendar on Left 5 cols, Details & Standby Crew on Right 7 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Kolom Kiri: Kalender Pengiriman (5 Kolom) */}
        <div className="lg:col-span-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 sm:p-5 space-y-4">
          <div className="flex flex-col gap-3 border-b border-slate-200 dark:border-slate-800 pb-3.5">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-blue-600 text-white flex items-center justify-center shrink-0">
                <Calendar className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white truncate">
                  Kalender Pengiriman — {selectedMonth === -1 ? `Semua Bulan (${calendarGridData.monthName})` : calendarGridData.monthName} {calendarGridData.year}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Klik tanggal untuk melihat rincian pengiriman &amp; kru.
                </p>
              </div>
            </div>

            {!isSidoarjoBranch && (
              <div className="flex items-center gap-4 flex-wrap text-xs font-medium text-slate-600 dark:text-slate-300">
                <span className="inline-flex items-center gap-1.5" title="Area Banyuwangi">
                  <span className="w-2.5 h-2.5 rounded-sm bg-sky-500" />
                  <span>Banyuwangi</span>
                </span>
                <span className="inline-flex items-center gap-1.5" title="Area Luar Kota">
                  <span className="w-2.5 h-2.5 rounded-sm bg-blue-600" />
                  <span>Luar Kota</span>
                </span>
                <span className="inline-flex items-center gap-1.5" title="Area Bali">
                  <span className="w-2.5 h-2.5 rounded-sm bg-indigo-500" />
                  <span>Bali</span>
                </span>
              </div>
            )}
          </div>

          {/* 7-Column Calendar Grid Header */}
          <div className="grid grid-cols-7 gap-1.5 text-center text-[10px] font-bold tracking-wider text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800 py-2 rounded-lg border border-slate-200 dark:border-slate-700">
            <div className="text-rose-600 dark:text-rose-400">MINGGU</div>
            <div>SENIN</div>
            <div>SELASA</div>
            <div>RABU</div>
            <div>KAMIS</div>
            <div>JUMAT</div>
            <div className="text-blue-600 dark:text-blue-400">SABTU</div>
          </div>

          {/* Calendar Cells Grid */}
          <div className="grid grid-cols-7 gap-1.5">
            {calendarGridData.cells.map((cell, cIdx) => {
              if (cell.type === 'padding') {
                return (
                  <div key={`pad-${cIdx}`} className="min-h-[80px] sm:min-h-[86px] bg-slate-50/70 dark:bg-slate-800/30 rounded-lg border border-dashed border-slate-200 dark:border-slate-800" />
                );
              }

              const isSelected = selectedCalendarDate === cell.dateString;
              const hasDeliveries = cell.totalTrips > 0;
              const isSunday = cIdx % 7 === 0 || cell.dayName === 'MINGGU';

              return (
                <div
                  key={`cal-cell-${cell.dayNumber}-${cell.dateString}`}
                  onClick={() => {
                    if (cell.dateString) {
                      setSelectedCalendarDate(cell.dateString);
                      setSelectedDayFilter(cell.dateString);
                    }
                  }}
                  className={`min-h-[80px] sm:min-h-[86px] p-1.5 sm:p-2 rounded-lg border transition-colors cursor-pointer flex flex-col justify-between select-none ${
                    isSunday
                      ? isSelected
                        ? 'bg-rose-50 dark:bg-rose-950/40 border-2 border-rose-600'
                        : 'bg-rose-50/50 dark:bg-rose-950/20 hover:bg-rose-50 dark:hover:bg-rose-950/35 border-rose-200 dark:border-rose-900/50'
                      : isSelected
                      ? 'bg-blue-50 dark:bg-blue-950/40 border-2 border-blue-600'
                      : hasDeliveries
                      ? 'bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 border-slate-200 dark:border-slate-700 hover:border-blue-300'
                      : 'bg-slate-50/60 dark:bg-slate-900/50 hover:bg-slate-100 dark:hover:bg-slate-800 border-slate-200 dark:border-slate-800'
                  }`}
                >
                  <div className="flex items-center justify-between gap-0.5">
                    <span className={`text-[11px] font-bold px-1.5 py-0.5 rounded tabular-nums ${
                      isSunday
                        ? isSelected
                          ? 'bg-rose-600 text-white'
                          : 'text-rose-600 dark:text-rose-400'
                        : isSelected
                        ? 'bg-blue-600 text-white'
                        : hasDeliveries
                        ? 'bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300'
                        : 'text-slate-500 dark:text-slate-400'
                    }`}>
                      {String(cell.dayNumber).padStart(2, '0')}
                    </span>
                    {hasDeliveries && (
                      <span className={`text-[10px] font-semibold px-1 py-0.5 rounded tabular-nums ${
                        isSunday
                          ? 'text-rose-700 dark:text-rose-300 bg-rose-100 dark:bg-rose-900/50'
                          : 'text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/60'
                      }`}>
                        {cell.totalTrips} Rit
                      </span>
                    )}
                  </div>

                  {hasDeliveries ? (
                    isSidoarjoBranch ? (
                      <div className="space-y-1 mt-1">
                        <div className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 flex items-center justify-between">
                          <span className="truncate">Area</span>
                          <span className="font-mono font-bold tabular-nums">{cell.uniqueAreaCount}</span>
                        </div>
                        {cell.areaPreviewList.length > 0 && (
                          <div className="text-[10px] text-slate-500 dark:text-slate-400 truncate px-0.5">
                            {cell.areaPreviewList.slice(0, 2).join(', ')}
                            {cell.areaPreviewList.length > 2 ? ` +${cell.areaPreviewList.length - 2}` : ''}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="space-y-0.5 mt-1">
                        {cell.lokalCount > 0 && (
                          <div className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-sky-50 dark:bg-sky-950/40 text-sky-700 dark:text-sky-300 flex items-center justify-between gap-1">
                            <span className="truncate">Bwi</span>
                            <span className="font-mono font-bold tabular-nums">{cell.lokalCount}</span>
                          </div>
                        )}
                        {cell.luarKotaCount > 0 && (
                          <div className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 flex items-center justify-between gap-1">
                            <span className="truncate">Luar Kota</span>
                            <span className="font-mono font-bold tabular-nums">{cell.luarKotaCount}</span>
                          </div>
                        )}
                        {cell.baliCount > 0 && (
                          <div className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 flex items-center justify-between gap-1">
                            <span className="truncate">Bali</span>
                            <span className="font-mono font-bold tabular-nums">{cell.baliCount}</span>
                          </div>
                        )}
                      </div>
                    )
                  ) : (
                    <div className={`text-[11px] text-center py-1 ${
                      isSunday
                        ? 'font-semibold text-rose-600 dark:text-rose-400'
                        : 'text-slate-400 dark:text-slate-500'
                    }`}>
                      {isSunday ? 'Libur' : 'Off'}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Kolom Kanan: Rincian Pengiriman Terfaktur & Kru Free / Stand By Gudang DC (7 Kolom) */}
        <div className="lg:col-span-7 min-w-0 space-y-5">
          {(() => {
            const allDaysFlat = filteredWeeks.flatMap((w: AdminScheduleWeek) => w.days);
            const activeDayObj = allDaysFlat.find((d: AdminScheduleDay) => d.dateString === selectedCalendarDate);
            const standbyDataTop = computeDayCrewStandbyBreakdown(activeDayObj);
            const hasTripsOnActiveDay = Boolean(activeDayObj && activeDayObj.pengiriman.length > 0);
            const displayDateHeading = activeDayObj
              ? `${activeDayObj.dayName}, ${activeDayObj.dateString}`
              : (selectedCalendarDate || 'Tanggal Terpilih');

            let lokalInSelected = 0;
            let luarKotaInSelected = 0;
            let baliInSelected = 0;
            let kanvasLktInSelected = 0;
            if (activeDayObj) {
              activeDayObj.pengiriman.forEach((p: DeliveryAssignment) => {
                const std = standardizeAreaName(p.area).toUpperCase();
                if (std.includes('KANVAS LKT') || (p.area || '').toUpperCase().includes('KANVAS')) {
                  kanvasLktInSelected++;
                }
                if (isAreaBaliSchedule(p.area)) {
                  baliInSelected++;
                }
                if (isAreaLuarKotaSchedule(p.area)) {
                  luarKotaInSelected++;
                }
                if (isAreaBanyuwangiSchedule(p.area)) {
                  lokalInSelected++;
                }
              });
            }

            const storeSchedules = logisticsStore.getSchedules();

            const filteredPengiriman = activeDayObj
              ? activeDayObj.pengiriman.filter((p: DeliveryAssignment) => {
                  const standardArea = standardizeAreaName(p.area).toUpperCase();
                  const isKanvasLkt = standardArea.includes('KANVAS LKT') || (p.area || '').toUpperCase().includes('KANVAS');
                  const isBali = isAreaBaliSchedule(p.area);
                  const isLuarKota = isAreaLuarKotaSchedule(p.area);
                  const isBanyuwangi = isAreaBanyuwangiSchedule(p.area);

                  if (categoryFilter === 'kanvas_lkt' && !isKanvasLkt) return false;
                  if (categoryFilter === 'lokal' && !isBanyuwangi) return false;
                  if (categoryFilter === 'luar_kota' && !isLuarKota) return false;
                  if (categoryFilter === 'bali' && !isBali) return false;

                  if (searchQuery.trim()) {
                    const q = searchQuery.toLowerCase().trim();
                    const matchDriver = (p.driver || '').toLowerCase().includes(q);
                    const matchHelper = (p.helper || '').toLowerCase().includes(q);
                    const matchHelper2 = (p.helper2 || '').toLowerCase().includes(q);
                    const matchArea = (p.area || '').toLowerCase().includes(q);
                    const matchArmada = (p.armada || '').toLowerCase().includes(q);
                    if (!matchDriver && !matchHelper && !matchHelper2 && !matchArea && !matchArmada) {
                      return false;
                    }
                  }

                  if (armadaFilter !== 'all' && p.armada !== armadaFilter) {
                    return false;
                  }

                  if (crewDriverFilter !== 'all' && p.driver !== crewDriverFilter) {
                    return false;
                  }

                  if (scheduleStatusFilter !== 'all') {
                    const activeDayMoIdx = MONTH_NAMES.findIndex(m =>
                      (activeDayObj.dateString || '').toLowerCase().includes(m.toLowerCase())
                    );
                    const dayMo = activeDayMoIdx >= 0
                      ? activeDayMoIdx
                      : (selectedMonth === -1 ? new Date().getMonth() : selectedMonth);
                    const rowDateIso = `${selectedYear}-${String(dayMo + 1).padStart(2, '0')}-${String(activeDayObj.dayNumber).padStart(2, '0')}`;
                    const pFleet = logisticsStore.findFleetByCodeOrPlate(p.armada);
                    const sameFleetOnDay = activeDayObj.pengiriman.filter(item => {
                      const fItem = logisticsStore.findFleetByCodeOrPlate(item.armada);
                      if (pFleet && fItem) return pFleet.id === fItem.id;
                      return (item.armada || '').trim().toUpperCase() === (p.armada || '').trim().toUpperCase();
                    }).length;
                    const matched = storeSchedules.find(s => {
                      if (p.id && s.id === p.id) return true;
                      const sDate = getScheduleCalendarDateObj(s);
                      const sameDay = Boolean(
                        logisticsStore.doesScheduleCoverDate(s, rowDateIso) ||
                        (sDate &&
                          !isNaN(sDate.getTime()) &&
                          sDate.getDate() === activeDayObj.dayNumber &&
                          sDate.getMonth() === dayMo &&
                          sDate.getFullYear() === selectedYear)
                      );
                      if (!sameDay) return false;
                      const armadaMatches = pFleet
                        ? logisticsStore.matchesFleetSchedule(pFleet, s)
                        : (s.armada || s.fleet?.initialCode || '').trim().toUpperCase() === (p.armada || '').trim().toUpperCase();
                      const areaMatches = (s.areaName || '').trim().toUpperCase() === standardizeAreaName(p.area).trim().toUpperCase();
                      const driverMatches = Boolean(s.crew?.name && p.driver && isSameCrewPerson(s.crew.name, p.driver));
                      if (armadaMatches && (areaMatches || driverMatches || sameFleetOnDay === 1)) return true;
                      if (areaMatches && driverMatches) return true;
                      return false;
                    });
                    const effStatus: ShipmentStatus = matched?.status || 'scheduled';
                    if (effStatus !== scheduleStatusFilter) {
                      return false;
                    }
                  }

                  return true;
                })
              : [];

            const dayArmadaCounts = new Map<string, number>();
            if (activeDayObj) {
              activeDayObj.pengiriman.forEach(item => {
                const fItem = logisticsStore.findFleetByCodeOrPlate(item.armada);
                const key = (fItem?.id || item.armada || '').trim().toUpperCase();
                if (key) dayArmadaCounts.set(key, (dayArmadaCounts.get(key) || 0) + 1);
              });
            }

            return (
              <>
                {/* Kartu A: Rincian Pengiriman Terfaktur (Tanggal Terpilih) */}
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 sm:p-5 space-y-4">
                  <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-800 pb-3.5">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-9 h-9 rounded-lg bg-blue-600 text-white flex items-center justify-center shrink-0">
                        <Calendar className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <span className="text-[11px] font-semibold text-blue-600 dark:text-blue-400 block">
                          Rincian Pengiriman Terfaktur
                        </span>
                        <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white truncate">
                          {displayDateHeading}
                        </h3>
                      </div>
                    </div>

                    {hasTripsOnActiveDay && activeDayObj && (
                      <div className="flex items-center gap-2 flex-wrap">
                        {isSidoarjoBranch ? (
                          <div className="flex items-center gap-3 text-xs font-semibold text-slate-600 dark:text-slate-300">
                            <span className="tabular-nums">
                              Total Kirim: <strong className="text-slate-900 dark:text-white">{activeDayObj.pengiriman.length} Rit</strong>
                            </span>
                            <span aria-hidden="true" className="text-slate-300 dark:text-slate-600">·</span>
                            <span className="tabular-nums">
                              Total Area: <strong className="text-blue-600 dark:text-blue-400">{new Set(activeDayObj.pengiriman.map(item => standardizeAreaName(item.area, effectiveActiveBranchId).toUpperCase())).size} Area</strong>
                            </span>
                          </div>
                        ) : (
                          <div className="inline-flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg flex-wrap">
                            <button
                              type="button"
                              onClick={() => setCategoryFilter('all')}
                              className={`px-2.5 py-1.5 rounded-md text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                                categoryFilter === 'all'
                                  ? 'bg-blue-600 text-white'
                                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-white dark:hover:bg-slate-700'
                              }`}
                            >
                              Semua ({activeDayObj.pengiriman.length})
                            </button>
                            <button
                              type="button"
                              onClick={() => setCategoryFilter(categoryFilter === 'lokal' ? 'all' : 'lokal')}
                              title="Selain jadwal Luar Kota & Bali termasuk Area Banyuwangi"
                              className={`px-2.5 py-1.5 rounded-md text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                                categoryFilter === 'lokal'
                                  ? 'bg-blue-600 text-white'
                                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-white dark:hover:bg-slate-700'
                              }`}
                            >
                              Banyuwangi ({lokalInSelected})
                            </button>
                            <button
                              type="button"
                              onClick={() => setCategoryFilter(categoryFilter === 'luar_kota' ? 'all' : 'luar_kota')}
                              title="Jember Selatan, Jember Barat, Jember Kota, Kanvas LKT, Situbondo, Bondowoso, Susulan Situbondo Bondowoso"
                              className={`px-2.5 py-1.5 rounded-md text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                                categoryFilter === 'luar_kota'
                                  ? 'bg-blue-600 text-white'
                                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-white dark:hover:bg-slate-700'
                              }`}
                            >
                              Luar Kota ({luarKotaInSelected})
                            </button>
                            <button
                              type="button"
                              onClick={() => setCategoryFilter(categoryFilter === 'bali' ? 'all' : 'bali')}
                              title="Negara, Singaraja, Denpasar 1, Denpasar 2, Kanvas LKT"
                              className={`px-2.5 py-1.5 rounded-md text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                                categoryFilter === 'bali'
                                  ? 'bg-blue-600 text-white'
                                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-white dark:hover:bg-slate-700'
                              }`}
                            >
                              Bali ({baliInSelected})
                            </button>
                            <button
                              type="button"
                              onClick={() => setCategoryFilter(categoryFilter === 'kanvas_lkt' ? 'all' : 'kanvas_lkt')}
                              className={`px-2.5 py-1.5 rounded-md text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                                categoryFilter === 'kanvas_lkt'
                                  ? 'bg-blue-600 text-white'
                                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-white dark:hover:bg-slate-700'
                              }`}
                            >
                              Kanvas LKT ({kanvasLktInSelected})
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {!hasTripsOnActiveDay || !activeDayObj ? (
                    <div className="py-10 px-6 text-center space-y-2.5 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200 dark:border-slate-800">
                      <div className="w-11 h-11 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center mx-auto">
                        <Calendar className="w-5 h-5" />
                      </div>
                      <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                        Tidak Ada Jadwal Pengiriman pada {selectedCalendarDate || 'Tanggal Ini'}
                      </h4>
                      <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto">
                        Silakan klik tanggal lain pada kalender di sebelah kiri untuk melihat rincian penugasan driver, helper, area kirim, dan armada.
                      </p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
                      <table className="w-full text-left border-collapse min-w-[660px]">
                        <thead>
                          <tr className="bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold border-b border-slate-200 dark:border-slate-700 uppercase tracking-wider text-[11px]">
                            <th className="py-3 px-2.5 text-center w-9">#</th>
                            <th className="py-3 px-3 w-44">Driver</th>
                            <th className="py-3 px-3 w-44">Helper / Back Up</th>
                            <th className="py-3 px-3">Area Tujuan</th>
                            <th className="py-3 px-3 w-28">Armada</th>
                            <th className="py-3 px-3 w-28">Status</th>
                            <th className="py-3 px-2.5 text-center w-24">Aksi</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200 dark:divide-slate-800 bg-white dark:bg-slate-900">
                          {filteredPengiriman.length === 0 ? (
                            <tr>
                              <td colSpan={7} className="p-8 text-center bg-slate-50 dark:bg-slate-800/40">
                                <div className="max-w-md mx-auto space-y-2.5">
                                  <Search className="w-5 h-5 text-blue-600 mx-auto" />
                                  <div className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                                    Tidak ada jadwal ritase yang cocok dengan filter
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setSearchQuery('');
                                      setScheduleStatusFilter('all');
                                      setArmadaFilter('all');
                                      setCrewDriverFilter('all');
                                      setCategoryFilter('all');
                                    }}
                                    className="px-4 py-2 rounded-lg text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white cursor-pointer transition-colors"
                                  >
                                    Reset Filter
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ) : (
                            filteredPengiriman.map((p: DeliveryAssignment, pIdx: number) => {
                              const standardArea = standardizeAreaName(p.area, effectiveActiveBranchId);
                              const upperArea = standardArea.toUpperCase();
                              const isKanvasLkt = !isSidoarjoBranch && (upperArea.includes('KANVAS LKT') || p.area.toUpperCase().includes('KANVAS'));
                              const isBali = !isSidoarjoBranch && isAreaBaliSchedule(p.area);
                              const isLuarKota = !isSidoarjoBranch && isAreaLuarKotaSchedule(p.area);

                              const activeDayMonthIdx = MONTH_NAMES.findIndex(m =>
                                (activeDayObj.dateString || '').toLowerCase().includes(m.toLowerCase())
                              );
                              const targetDayMo = activeDayMonthIdx >= 0
                                ? activeDayMonthIdx
                                : (selectedMonth === -1 ? new Date().getMonth() : selectedMonth);
                              const rowDateIso = `${selectedYear}-${String(targetDayMo + 1).padStart(2, '0')}-${String(activeDayObj.dayNumber).padStart(2, '0')}`;
                              const pFleet = logisticsStore.findFleetByCodeOrPlate(p.armada);
                              const rowFleetKey = (pFleet?.id || p.armada || '').trim().toUpperCase();
                              const sameFleetDayCount = rowFleetKey ? (dayArmadaCounts.get(rowFleetKey) || 0) : 0;

                              const matchedSch = storeSchedules.find(s => {
                                if (p.id && s.id === p.id) return true;
                                const sDate = getScheduleCalendarDateObj(s);
                                const sameDay = Boolean(
                                  logisticsStore.doesScheduleCoverDate(s, rowDateIso) ||
                                  (sDate &&
                                    !isNaN(sDate.getTime()) &&
                                    sDate.getDate() === activeDayObj.dayNumber &&
                                    sDate.getMonth() === targetDayMo &&
                                    sDate.getFullYear() === selectedYear)
                                );
                                if (!sameDay) return false;
                                const sArmada = (s.armada || s.fleet?.initialCode || '').trim().toUpperCase();
                                const pArmada = (p.armada || '').trim().toUpperCase();
                                const armadaMatches = pFleet
                                  ? logisticsStore.matchesFleetSchedule(pFleet, s)
                                  : Boolean(
                                      sArmada === pArmada ||
                                      s.fleet?.initialCode?.toUpperCase() === pArmada ||
                                      (s.fleet?.initialCode && pArmada.includes(s.fleet.initialCode.toUpperCase()))
                                    );
                                const areaMatches = (s.areaName || '').trim().toUpperCase() === (standardArea || '').trim().toUpperCase();
                                const driverMatches = Boolean(s.crew?.name && p.driver && isSameCrewPerson(s.crew.name, p.driver));
                                if (armadaMatches && (areaMatches || driverMatches || sameFleetDayCount === 1)) return true;
                                if (areaMatches && driverMatches) return true;
                                return false;
                              });

                              const rawBackupCrewName = p.backupCrewName || matchedSch?.backupCrewName;
                              const backupPosition = p.backupPosition || matchedSch?.backupPosition || 'driver';
                              const backupTargetName =
                                p.backupTargetName ||
                                matchedSch?.backupTargetName ||
                                (backupPosition === 'helper' ? p.helper : backupPosition === 'helper2' ? p.helper2 : p.driver);

                              const displayDriver =
                                rawBackupCrewName && backupTargetName && backupPosition === 'driver' && isSameCrewPerson(p.driver, rawBackupCrewName)
                                  ? backupTargetName
                                  : p.driver;

                              const isStaleDriverBackupRow = Boolean(
                                rawBackupCrewName &&
                                  backupPosition === 'driver' &&
                                  displayDriver &&
                                  displayDriver !== '-' &&
                                  !isSameCrewPerson(displayDriver, rawBackupCrewName) &&
                                  (Boolean(matchedSch && ['picked_up', 'in_transit', 'delivered'].includes(matchedSch.status)) ||
                                    Boolean(backupTargetName && !isSameCrewPerson(displayDriver, backupTargetName)))
                              );
                              const backupCrewName = isStaleDriverBackupRow ? undefined : rawBackupCrewName;

                              const driverInitials = getDriverInitials(displayDriver);

                              const isFutureOrTodayUnverified =
                                selectedYear >= 2026 &&
                                (selectedYear > 2026 || targetDayMo > 10 || (targetDayMo === 10 && activeDayObj.dayNumber >= 12)) &&
                                matchedSch?.status === 'delivered' &&
                                !matchedSch?.podPhotoUrl &&
                                !matchedSch?.isChecklistBypassed;

                              const currentStatus: ShipmentStatus = isFutureOrTodayUnverified
                                ? 'scheduled'
                                : (matchedSch?.status || 'scheduled');

                              const statusBadgeConfig: Record<ShipmentStatus, { label: string; bg: string; text: string }> = {
                                scheduled: { label: 'Terjadwal', bg: 'bg-blue-50 dark:bg-blue-950/60', text: 'text-blue-700 dark:text-blue-300' },
                                picked_up: { label: 'Telah Dimuat', bg: 'bg-amber-50 dark:bg-amber-950/50', text: 'text-amber-700 dark:text-amber-300' },
                                in_transit: { label: 'Sedang Kirim', bg: 'bg-indigo-50 dark:bg-indigo-950/50', text: 'text-indigo-700 dark:text-indigo-300' },
                                delivered: { label: 'Terkirim', bg: 'bg-emerald-50 dark:bg-emerald-950/50', text: 'text-emerald-700 dark:text-emerald-300' },
                                delayed: { label: 'Tertunda', bg: 'bg-rose-50 dark:bg-rose-950/50', text: 'text-rose-700 dark:text-rose-300' }
                              };

                              const cfg = statusBadgeConfig[currentStatus] || statusBadgeConfig.scheduled;
                              const hasHelper1 = Boolean(p.helper && p.helper !== '-');
                              const hasHelper2 = Boolean(p.helper2 && p.helper2 !== '-');

                              return (
                                <tr
                                  key={`cal-detail-${pIdx}-${displayDriver}-${p.armada}`}
                                  className="hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors"
                                >
                                  <td className="py-3 px-2.5 text-center font-semibold text-slate-500 dark:text-slate-400 text-xs tabular-nums">
                                    {pIdx + 1}
                                  </td>

                                  {/* Driver */}
                                  <td className="py-3 px-3">
                                    <div className="flex items-center gap-2.5">
                                      <div className="w-7 h-7 rounded-lg bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-300 flex items-center justify-center font-bold text-[11px] shrink-0">
                                        {driverInitials}
                                      </div>
                                      <span className="font-semibold text-slate-900 dark:text-white text-[13.5px] leading-snug">
                                        {displayDriver}
                                      </span>
                                    </div>
                                  </td>

                                  {/* Helper / Back Up */}
                                  <td className="py-3 px-3">
                                    <div className="flex flex-col gap-1 items-start">
                                      <div className="text-[13px] font-medium text-slate-700 dark:text-slate-200 leading-snug">
                                        {hasHelper1 ? p.helper : <span className="text-slate-400 text-xs">Tanpa Helper</span>}
                                      </div>
                                      {hasHelper2 && (
                                        <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
                                          H2: {p.helper2}
                                        </div>
                                      )}
                                      {backupCrewName && (
                                        <div className="mt-0.5 flex flex-col gap-1 items-start pt-1 border-t border-slate-100 dark:border-slate-800 w-full">
                                          <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-700 dark:text-amber-300">
                                            <span>Back Up: {backupCrewName}</span>
                                          </div>
                                          <span className="text-[11px] text-slate-500 dark:text-slate-400">
                                            Ganti {backupPosition === 'helper' ? 'Helper 1' : backupPosition === 'helper2' ? 'Helper 2' : 'Driver'} ({backupTargetName})
                                          </span>
                                          {canEditSchedules && (
                                            <button
                                              type="button"
                                              onClick={() => handleCancelTripReplacement(p)}
                                              className="inline-flex items-center gap-1 text-[11px] font-semibold text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/50 hover:bg-rose-100 px-2 py-0.5 rounded cursor-pointer transition-colors"
                                              title="Batalkan kru pengganti untuk rute ini"
                                            >
                                              <XCircle className="w-3 h-3" />
                                              <span>Batalkan Ganti</span>
                                            </button>
                                          )}
                                        </div>
                                      )}
                                    </div>
                                  </td>

                                  {/* Area Tujuan */}
                                  <td className="py-3 px-3">
                                    <div className="flex items-center gap-1.5 flex-wrap">
                                      <span className={`text-xs font-semibold px-2.5 py-1 rounded-md ${
                                        isSidoarjoBranch
                                          ? 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-200'
                                          : isKanvasLkt || isBali
                                          ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300'
                                          : isLuarKota
                                          ? 'bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300'
                                          : 'bg-sky-50 text-sky-700 dark:bg-sky-950/50 dark:text-sky-300'
                                      }`}>
                                        {standardArea}
                                      </span>
                                      {isKanvasLkt && (
                                        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-blue-600 text-white">
                                          KANVAS
                                        </span>
                                      )}
                                    </div>
                                  </td>

                                  {/* Armada */}
                                  <td className="py-3 px-3">
                                    <div className="flex flex-col gap-1 items-start">
                                      <span className={`px-2.5 py-1 rounded-md font-mono font-bold text-xs ${
                                        sameFleetDayCount > 1
                                          ? 'bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300'
                                          : 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-slate-100'
                                      }`}>
                                        {p.armada}
                                      </span>
                                      {sameFleetDayCount > 1 && (
                                        <span className="text-[10px] font-semibold text-amber-700 dark:text-amber-300">
                                          Ganda ({sameFleetDayCount}x)
                                        </span>
                                      )}
                                      {selectedBranchId === 'ALL' && (() => {
                                        const br = branchStore.getScheduleBranch(p.id, p.area, p.armada);
                                        return (
                                          <span className="text-[10px] font-medium text-slate-500 dark:text-slate-400">
                                            {br.name}
                                          </span>
                                        );
                                      })()}
                                    </div>
                                  </td>

                                  {/* Status */}
                                  <td className="py-3 px-3">
                                    <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-xs font-semibold whitespace-nowrap ${cfg.bg} ${cfg.text}`}>
                                      {cfg.label}
                                    </span>
                                  </td>

                                  {/* Aksi */}
                                  <td className="py-3 px-2.5 text-center">
                                    <div className="flex items-center justify-center gap-1">
                                      {logisticsStore.getCurrentUser()?.role === 'super_admin' && currentStatus !== 'delivered' && (
                                        <button
                                          type="button"
                                          onClick={() => {
                                            const schId = matchedSch?.id || p.id;
                                            if (!schId) return;
                                            setBypassConfirmModal({ schId, p, matchedSch });
                                          }}
                                          className="p-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-600 dark:bg-blue-950/60 dark:text-blue-400 transition-colors cursor-pointer"
                                          title="Tembus & Simpan Selesai Tanpa Checklist (Super Admin)"
                                        >
                                          <Zap className="w-3.5 h-3.5" />
                                        </button>
                                      )}
                                      {canEditSchedules ? (
                                        <>
                                          <button
                                            type="button"
                                            onClick={() => handleOpenEditTripModal(p, activeDayObj.dayNumber, activeDayObj.dateString, pIdx)}
                                            className="p-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-600 dark:bg-blue-950/60 dark:text-blue-400 transition-colors cursor-pointer"
                                            title="Edit Rincian Pengiriman Ini"
                                          >
                                            <Edit className="w-3.5 h-3.5" />
                                          </button>
                                          <button
                                            type="button"
                                            onClick={() => setDeleteConfirmModal({ p, dayNumber: activeDayObj.dayNumber, tripIndex: pIdx, dateString: activeDayObj.dateString })}
                                            className="p-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600 dark:bg-rose-950/50 dark:text-rose-300 transition-colors cursor-pointer"
                                            title="Hapus Rincian Pengiriman Ini"
                                          >
                                            <Trash2 className="w-3.5 h-3.5" />
                                          </button>
                                        </>
                                      ) : (
                                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 text-[11px] font-semibold">
                                          <Eye className="w-3 h-3" />
                                          <span>Lihat</span>
                                        </span>
                                      )}
                                    </div>
                                  </td>
                                </tr>
                              );
                            })
                          )}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                {/* Kartu B: Kru Free / Stand By Gudang DC */}
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 sm:p-5 space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-800 pb-3.5">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-9 h-9 rounded-lg bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
                        <Warehouse className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-[11px] font-semibold text-blue-600 dark:text-blue-400">
                            Kru Free / Stand By Gudang DC
                          </span>
                          <span className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                            · {standbyDataTop.freeStandbyCrews.length} Kru Stand By
                          </span>
                        </div>
                        <h4 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white truncate">
                          {displayDateHeading}
                        </h4>
                      </div>
                    </div>
                    {canEditSchedules && hasTripsOnActiveDay && activeDayObj && standbyDataTop.freeStandbyCrews.length > 0 && (
                      <button
                        type="button"
                        onClick={() => {
                          const firstCrew = standbyDataTop.freeStandbyCrews[0];
                          setReplaceAbsentModal({
                            isOpen: true,
                            standbyCrewName: firstCrew.name,
                            standbyCrewRole: firstCrew.role,
                            dayNumber: activeDayObj.dayNumber,
                            dateString: activeDayObj.dateString,
                            selectedTripIndex: 0,
                            replacePosition: firstCrew.role === 'Driver' ? 'driver' : 'helper',
                            absentReason: '',
                            isRouteDropdownOpen: false,
                            isCrewDropdownOpen: false,
                            routeSearchQuery: ''
                          });
                        }}
                        className="px-3.5 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs transition-colors cursor-pointer inline-flex items-center gap-2 whitespace-nowrap shrink-0"
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                        <span>Pilih &amp; Gantikan Kru Kiriman</span>
                      </button>
                    )}
                  </div>

                  <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
                    <table className="w-full text-left border-collapse min-w-[580px]">
                      <thead>
                        <tr className="bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold border-b border-slate-200 dark:border-slate-700 uppercase tracking-wider text-[11px]">
                          <th className="py-3 px-2.5 text-center w-9">#</th>
                          <th className="py-3 px-3 w-44">Kru Free / Stand By</th>
                          <th className="py-3 px-3 w-24">Posisi</th>
                          <th className="py-3 px-3">Penugasan Stand By / Area Pengganti</th>
                          <th className="py-3 px-3 w-32">Status</th>
                          <th className="py-3 px-2.5 text-center w-28">Aksi Hari H</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200 dark:divide-slate-800 bg-white dark:bg-slate-900">
                        {standbyDataTop.freeStandbyCrews.length === 0 ? (
                          <tr>
                            <td colSpan={6} className="py-6 px-4 text-center bg-slate-50 dark:bg-slate-800/40 text-slate-500 dark:text-slate-400 text-xs font-medium">
                              {selectedBranchId !== 'ALL' && stats.branchCrewCount === 0
                                ? 'Belum ada personel kru driver/helper yang terdaftar pada cabang ini.'
                                : 'Seluruh kru aktif telah terjadwal kirim pada tanggal ini.'}
                            </td>
                          </tr>
                        ) : (
                          standbyDataTop.freeStandbyCrews.map((crew, idx) => {
                            const initials = getDriverInitials(crew.name);
                            return (
                              <tr
                                key={`free-crew-top-${crew.id}-${idx}`}
                                className="hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors"
                              >
                                <td className="py-3 px-2.5 text-center font-semibold text-slate-500 dark:text-slate-400 text-xs tabular-nums">
                                  {idx + 1}
                                </td>
                                <td className="py-3 px-3">
                                  <div className="flex items-center gap-2.5">
                                    <div className="w-7 h-7 rounded-lg bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-300 flex items-center justify-center font-bold text-[11px] shrink-0">
                                      {initials}
                                    </div>
                                    <span className="font-semibold text-slate-900 dark:text-white text-[13.5px] truncate">
                                      {crew.name}
                                    </span>
                                  </div>
                                </td>
                                <td className="py-3 px-3">
                                  <span className={`px-2.5 py-1 rounded-md text-xs font-semibold ${
                                    crew.role === 'Driver'
                                      ? 'bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300'
                                      : 'bg-sky-50 text-sky-700 dark:bg-sky-950/50 dark:text-sky-300'
                                  }`}>
                                    {crew.role}
                                  </span>
                                </td>
                                <td className="py-3 px-3">
                                  <span className={`text-xs ${
                                    crew.isReplacing
                                      ? 'text-emerald-700 dark:text-emerald-300 font-semibold'
                                      : 'text-slate-600 dark:text-slate-300'
                                  }`}>
                                    {crew.warehouseDutyNote}
                                  </span>
                                </td>
                                <td className="py-3 px-3">
                                  {crew.isReplacing ? (
                                    <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-semibold bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 whitespace-nowrap">
                                      Menggantikan
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-semibold bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 whitespace-nowrap">
                                      Stand By
                                    </span>
                                  )}
                                </td>
                                <td className="py-3 px-2.5 text-center">
                                  {canEditSchedules && hasTripsOnActiveDay && activeDayObj ? (
                                    <div className="flex items-center justify-center gap-1.5 flex-wrap">
                                      <button
                                        type="button"
                                        onClick={() =>
                                          setReplaceAbsentModal({
                                            isOpen: true,
                                            standbyCrewName: crew.name,
                                            standbyCrewRole: crew.role,
                                            dayNumber: activeDayObj.dayNumber,
                                            dateString: activeDayObj.dateString,
                                            selectedTripIndex: 0,
                                            replacePosition: crew.role === 'Driver' ? 'driver' : 'helper',
                                            absentReason: '',
                                            isRouteDropdownOpen: false,
                                            isCrewDropdownOpen: false,
                                            routeSearchQuery: ''
                                          })
                                        }
                                        className="px-2.5 py-1.5 rounded-lg bg-blue-50 hover:bg-blue-600 text-blue-700 hover:text-white dark:bg-blue-950/60 dark:text-blue-300 font-semibold text-xs transition-colors cursor-pointer inline-flex items-center gap-1 whitespace-nowrap"
                                        title="Gantikan Driver atau Helper kiriman area lain yang berhalangan hadir pada Hari H"
                                      >
                                        <RefreshCw className="w-3 h-3" />
                                        <span>{crew.isReplacing ? 'Ubah' : 'Gantikan'}</span>
                                      </button>
                                      {crew.isReplacing && (
                                        <button
                                          type="button"
                                          onClick={() => handleCancelReplaceAbsentCrew(crew.name)}
                                          className="px-2.5 py-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300 font-semibold text-xs transition-colors cursor-pointer inline-flex items-center gap-1 whitespace-nowrap"
                                          title="Batalkan penggantian dan kembalikan ke status Stand By di Gudang"
                                        >
                                          <XCircle className="w-3 h-3" />
                                          <span>Batal</span>
                                        </button>
                                      )}
                                    </div>
                                  ) : (
                                    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 text-[11px] font-semibold">
                                      <Eye className="w-3 h-3" />
                                      <span>{canEditSchedules ? 'Stand By' : 'Lihat'}</span>
                                    </span>
                                  )}
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* MODAL PENGGANTIAN KRU (UI/UX DROPDOWN MODERN: TAMPILKAN SEMUA KRU PENGGANTI & SEMUA POSISI DRIVER / HELPER 1 / HELPER 2) */}
                {activeDayObj && replaceAbsentModal && replaceAbsentModal.isOpen && (() => {
                    const selectedTrip = activeDayObj.pengiriman[replaceAbsentModal.selectedTripIndex] || activeDayObj.pengiriman[0];
                    const selectedAreaName = selectedTrip ? standardizeAreaName(selectedTrip.area) : '-';
                    const selectedTargetCrewName = selectedTrip
                      ? replaceAbsentModal.replacePosition === 'helper'
                        ? (selectedTrip.helper && selectedTrip.helper !== '-' ? selectedTrip.helper : 'Belum Ada Helper 1')
                        : replaceAbsentModal.replacePosition === 'helper2'
                        ? (selectedTrip.helper2 && selectedTrip.helper2 !== '-' ? selectedTrip.helper2 : 'Belum Ada Helper 2')
                        : (selectedTrip.driver || '-')
                      : '-';
                    const posLabelActive =
                      replaceAbsentModal.replacePosition === 'helper'
                        ? 'Helper 1'
                        : replaceAbsentModal.replacePosition === 'helper2'
                        ? 'Helper 2'
                        : 'Driver Utama';

                    const routeQuery = (replaceAbsentModal.routeSearchQuery || '').trim().toLowerCase();
                    const filteredRoutesForModal = activeDayObj.pengiriman
                      .map((trip, idx) => ({ trip, idx }))
                      .filter(({ trip }) => {
                        if (!routeQuery) return true;
                        const areaStr = standardizeAreaName(trip.area).toLowerCase();
                        const armStr = (trip.armada || '').toLowerCase();
                        const drvStr = (trip.driver || '').toLowerCase();
                        const hlp1Str = (trip.helper || '').toLowerCase();
                        const hlp2Str = (trip.helper2 || '').toLowerCase();
                        return (
                          areaStr.includes(routeQuery) ||
                          armStr.includes(routeQuery) ||
                          drvStr.includes(routeQuery) ||
                          hlp1Str.includes(routeQuery) ||
                          hlp2Str.includes(routeQuery)
                        );
                      });

                    return (
                      <div className="fixed inset-0 z-50 akk-flat-schedule bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
                        <div className="bg-white dark:bg-[#162234] border border-[#E2E8F0] dark:border-[#24344D] rounded-2xl max-w-lg w-full p-5 sm:p-6 space-y-5">
                          {/* Header Modal */}
                          <div className="flex items-center justify-between gap-3 border-b border-[#E2E8F0] dark:border-[#24344D] pb-4">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-xl bg-[#2563EB] text-white flex items-center justify-center shrink-0">
                                <Warehouse className="w-5 h-5" />
                              </div>
                              <div>
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="text-[11px] font-bold uppercase tracking-wider text-[#2563EB] dark:text-[#60A5FA]">
                                    PENGGANTIAN KRU STAND BY • HARI H
                                  </span>
                                  <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-[#EFF6FF] dark:bg-[#1E3A8A]/40 text-[#2563EB] dark:text-[#60A5FA] border border-[#BFDBFE] dark:border-[#1E40AF]">
                                    Role Asli: {replaceAbsentModal.standbyCrewRole}
                                  </span>
                                </div>
                                <h3 className="text-sm font-bold text-[#0F172A] dark:text-[#F1F5F9] mt-0.5">
                                  Kru Pengganti: {replaceAbsentModal.standbyCrewName}
                                </h3>
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => setReplaceAbsentModal(null)}
                              className="p-2 rounded-lg text-[#64748B] hover:text-[#0F172A] dark:hover:text-white hover:bg-[#F1F5F9] dark:hover:bg-[#1E293B] transition cursor-pointer"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>

                          <div className="space-y-4 text-xs">
                            {/* 1. Pilih Kru Stand By Pengganti */}
                            {standbyDataTop.freeStandbyCrews.length > 1 && (
                              <div className="relative">
                                <label className="font-bold text-[#334155] dark:text-[#CBD5E1] flex items-center justify-between mb-1.5">
                                  <span>Kru Stand By yang Ditugaskan Menggantikan</span>
                                  <span className="text-[11px] font-semibold text-[#2563EB] dark:text-[#60A5FA]">
                                    {standbyDataTop.freeStandbyCrews.length} Kru Stand By
                                  </span>
                                </label>
                                <button
                                  type="button"
                                  onClick={() =>
                                    setReplaceAbsentModal(prev =>
                                      prev ? { ...prev, isCrewDropdownOpen: !prev.isCrewDropdownOpen, isRouteDropdownOpen: false } : null
                                    )
                                  }
                                  className="w-full flex items-center justify-between gap-2.5 rounded-xl border border-[#CBD5E1] dark:border-[#334155] bg-[#F8FAFC] dark:bg-[#0F172A] px-3 py-2.5 text-left hover:border-[#2563EB] transition cursor-pointer"
                                >
                                  <div className="flex items-center gap-2.5 min-w-0">
                                    <div className="w-7 h-7 rounded-lg bg-[#2563EB] text-white font-bold text-[10px] flex items-center justify-center shrink-0">
                                      {getDriverInitials(replaceAbsentModal.standbyCrewName)}
                                    </div>
                                    <span className="font-bold text-[#0F172A] dark:text-[#F1F5F9] truncate">
                                      {replaceAbsentModal.standbyCrewName}
                                    </span>
                                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#EFF6FF] dark:bg-[#1E3A8A]/40 text-[#2563EB] dark:text-[#60A5FA] border border-[#BFDBFE] dark:border-[#1E40AF]">
                                      {replaceAbsentModal.standbyCrewRole}
                                    </span>
                                  </div>
                                  <ChevronDown className={`w-4 h-4 text-[#64748B] transition-transform ${replaceAbsentModal.isCrewDropdownOpen ? 'rotate-180 text-[#2563EB]' : ''}`} />
                                </button>

                                {replaceAbsentModal.isCrewDropdownOpen && (
                                  <div className="absolute left-0 right-0 z-50 mt-1.5 bg-white dark:bg-[#162234] border border-[#CBD5E1] dark:border-[#334155] rounded-xl shadow-sm max-h-48 overflow-y-auto p-1.5 space-y-1">
                                    {standbyDataTop.freeStandbyCrews.map(stb => {
                                      const isSelectedCrew = isSameCrewPerson(stb.name, replaceAbsentModal.standbyCrewName);
                                      return (
                                        <button
                                          key={`modal-stb-${stb.id}`}
                                          type="button"
                                          onClick={() =>
                                            setReplaceAbsentModal(prev =>
                                              prev
                                                ? {
                                                    ...prev,
                                                    standbyCrewName: stb.name,
                                                    standbyCrewRole: stb.role,
                                                    isCrewDropdownOpen: false
                                                  }
                                                : null
                                            )
                                          }
                                          className={`w-full flex items-center justify-between gap-2 px-2.5 py-2 rounded-lg text-left transition cursor-pointer ${
                                            isSelectedCrew
                                              ? 'bg-[#2563EB] text-white font-bold'
                                              : 'hover:bg-[#F8FAFC] dark:hover:bg-[#1E293B] text-[#0F172A] dark:text-[#F1F5F9]'
                                          }`}
                                        >
                                          <div className="flex items-center gap-2 min-w-0">
                                            <span className={`w-6 h-6 rounded-lg flex items-center justify-center font-bold text-[10px] shrink-0 ${
                                              isSelectedCrew ? 'bg-white/20 text-white' : 'bg-[#EFF6FF] dark:bg-[#1E3A8A]/40 text-[#2563EB] dark:text-[#60A5FA]'
                                            }`}>
                                              {getDriverInitials(stb.name)}
                                            </span>
                                            <span className="truncate font-bold">{stb.name}</span>
                                          </div>
                                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold border shrink-0 ${
                                            isSelectedCrew
                                              ? 'bg-white/20 text-white border-white/30'
                                              : 'bg-[#EFF6FF] dark:bg-[#1E3A8A]/40 text-[#2563EB] dark:text-[#60A5FA] border-[#BFDBFE] dark:border-[#1E40AF]'
                                          }`}>
                                            Role: {stb.role}
                                          </span>
                                        </button>
                                      );
                                    })}
                                  </div>
                                )}
                              </div>
                            )}

                            {/* 2. Posisi Kru yang Digantikan */}
                            <div>
                              <label className="font-bold text-[#334155] dark:text-[#CBD5E1] flex items-center justify-between mb-1.5">
                                <span>Posisi Kru yang Digantikan</span>
                                <span className="text-[11px] font-medium text-[#64748B] dark:text-[#94A3B8]">
                                  Lintas Role (Driver &harr; Helper)
                                </span>
                              </label>
                              <div className="grid grid-cols-3 gap-2.5">
                                {([
                                  { id: 'driver' as const, label: 'Driver Utama', roleTag: 'Supir' },
                                  { id: 'helper' as const, label: 'Helper 1', roleTag: 'Kernet 1' },
                                  { id: 'helper2' as const, label: 'Helper 2', roleTag: 'Kernet 2' }
                                ]).map(posOpt => {
                                  const isActivePos = replaceAbsentModal.replacePosition === posOpt.id;
                                  const previewName = selectedTrip
                                    ? posOpt.id === 'helper'
                                      ? (selectedTrip.helper && selectedTrip.helper !== '-' ? selectedTrip.helper : 'Kosong')
                                      : posOpt.id === 'helper2'
                                      ? (selectedTrip.helper2 && selectedTrip.helper2 !== '-' ? selectedTrip.helper2 : 'Kosong')
                                      : (selectedTrip.driver || '-')
                                    : '-';
                                  return (
                                    <button
                                      key={posOpt.id}
                                      type="button"
                                      onClick={() =>
                                        setReplaceAbsentModal(prev =>
                                          prev ? { ...prev, replacePosition: posOpt.id } : null
                                        )
                                      }
                                      className={`p-3 rounded-xl border text-left transition cursor-pointer flex flex-col justify-between ${
                                        isActivePos
                                          ? 'bg-[#EFF6FF] dark:bg-[#1E3A8A]/40 border-[#2563EB] ring-1 ring-[#2563EB] text-[#0F172A] dark:text-white'
                                          : 'bg-[#F8FAFC] dark:bg-[#0F172A] border-[#E2E8F0] dark:border-[#24344D] text-[#475569] dark:text-[#94A3B8] hover:border-[#2563EB]/50'
                                      }`}
                                    >
                                      <div className="flex items-center justify-between gap-1">
                                        <span className={`text-[11px] font-bold ${isActivePos ? 'text-[#2563EB] dark:text-[#60A5FA]' : 'text-[#0F172A] dark:text-[#F1F5F9]'}`}>
                                          {posOpt.label}
                                        </span>
                                        {isActivePos && <CheckCircle2 className="w-3.5 h-3.5 text-[#2563EB] shrink-0" />}
                                      </div>
                                      <div className="text-[11px] font-semibold truncate mt-1 text-[#475569] dark:text-[#CBD5E1]">
                                        {previewName}
                                      </div>
                                    </button>
                                  );
                                })}
                              </div>
                            </div>

                            {/* 3. Pilih Rute Area Kirim & Kru yang Digantikan */}
                            <div className="relative">
                              <label className="font-bold text-[#334155] dark:text-[#CBD5E1] flex items-center justify-between mb-1.5">
                                <span>Pilih Rute Area Kirim &amp; Kru yang Digantikan</span>
                                <span className="text-[11px] font-semibold text-[#2563EB] dark:text-[#60A5FA]">
                                  {activeDayObj.pengiriman.length} Rute Terjadwal
                                </span>
                              </label>

                              <button
                                type="button"
                                onClick={() =>
                                  setReplaceAbsentModal(prev =>
                                    prev
                                      ? {
                                          ...prev,
                                          isRouteDropdownOpen: !prev.isRouteDropdownOpen,
                                          isCrewDropdownOpen: false
                                        }
                                      : null
                                  )
                                }
                                className={`w-full rounded-xl border bg-[#F8FAFC] dark:bg-[#0F172A] p-3 text-left transition cursor-pointer ${
                                  replaceAbsentModal.isRouteDropdownOpen
                                    ? 'border-[#2563EB] ring-1 ring-[#2563EB]'
                                    : 'border-[#CBD5E1] dark:border-[#334155] hover:border-[#2563EB]/60'
                                }`}
                              >
                                {selectedTrip ? (
                                  <div className="space-y-2">
                                    <div className="flex items-center justify-between gap-2">
                                      <div className="flex items-center gap-2 min-w-0">
                                        <span className="px-2 py-0.5 rounded-md bg-[#2563EB] text-white font-bold text-[10px] shrink-0">
                                          #{replaceAbsentModal.selectedTripIndex + 1}
                                        </span>
                                        <span className="font-bold text-[#0F172A] dark:text-[#F1F5F9] text-xs sm:text-sm truncate">
                                          {selectedAreaName}
                                        </span>
                                        <span className="px-2 py-0.5 rounded-md bg-[#EFF6FF] dark:bg-[#1E3A8A]/40 text-[#2563EB] dark:text-[#60A5FA] border border-[#BFDBFE] dark:border-[#1E40AF] font-mono font-bold text-[10px] shrink-0">
                                          {selectedTrip.armada}
                                        </span>
                                      </div>
                                      <ChevronDown className={`w-4 h-4 text-[#64748B] shrink-0 transition-transform ${replaceAbsentModal.isRouteDropdownOpen ? 'rotate-180 text-[#2563EB]' : ''}`} />
                                    </div>

                                    <div className="flex items-center gap-1.5 flex-wrap pt-1.5 border-t border-[#E2E8F0] dark:border-[#24344D]">
                                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold border ${
                                        replaceAbsentModal.replacePosition === 'driver'
                                          ? 'bg-[#2563EB] text-white border-[#2563EB]'
                                          : 'bg-white dark:bg-[#162234] text-[#334155] dark:text-[#CBD5E1] border-[#E2E8F0] dark:border-[#24344D]'
                                      }`}>
                                        <span>Driver: {selectedTrip.driver || '-'}</span>
                                      </span>
                                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold border ${
                                        replaceAbsentModal.replacePosition === 'helper'
                                          ? 'bg-[#2563EB] text-white border-[#2563EB]'
                                          : 'bg-white dark:bg-[#162234] text-[#334155] dark:text-[#CBD5E1] border-[#E2E8F0] dark:border-[#24344D]'
                                      }`}>
                                        <span>Helper 1: {selectedTrip.helper && selectedTrip.helper !== '-' ? selectedTrip.helper : 'Kosong'}</span>
                                      </span>
                                      {(selectedTrip.helper2 && selectedTrip.helper2 !== '-' || replaceAbsentModal.replacePosition === 'helper2') && (
                                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold border ${
                                          replaceAbsentModal.replacePosition === 'helper2'
                                            ? 'bg-[#2563EB] text-white border-[#2563EB]'
                                            : 'bg-white dark:bg-[#162234] text-[#334155] dark:text-[#CBD5E1] border-[#E2E8F0] dark:border-[#24344D]'
                                        }`}>
                                          <span>Helper 2: {selectedTrip.helper2 && selectedTrip.helper2 !== '-' ? selectedTrip.helper2 : 'Kosong'}</span>
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                ) : (
                                  <div className="flex items-center justify-between text-[#64748B]">
                                    <span>Tidak ada pengiriman terjadwal pada tanggal ini</span>
                                    <ChevronDown className="w-4 h-4" />
                                  </div>
                                )}
                              </button>

                              {replaceAbsentModal.isRouteDropdownOpen && (
                                <div className="mt-1.5 bg-white dark:bg-[#162234] border border-[#CBD5E1] dark:border-[#334155] rounded-xl shadow-sm overflow-hidden animate-in fade-in duration-150">
                                  <div className="p-2 bg-[#F8FAFC] dark:bg-[#0F172A] border-b border-[#E2E8F0] dark:border-[#24344D]">
                                    <div className="relative">
                                      <Search className="w-3.5 h-3.5 text-[#64748B] absolute left-2.5 top-1/2 -translate-y-1/2" />
                                      <input
                                        type="text"
                                        value={replaceAbsentModal.routeSearchQuery || ''}
                                        onChange={(e) =>
                                          setReplaceAbsentModal(prev =>
                                            prev ? { ...prev, routeSearchQuery: e.target.value } : null
                                          )
                                        }
                                        placeholder="Cari area kirim, nama driver, atau nama helper..."
                                        autoFocus
                                        className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-white dark:bg-[#162234] border border-[#CBD5E1] dark:border-[#334155] text-xs text-[#0F172A] dark:text-[#F1F5F9] placeholder-[#94A3B8] focus:outline-none focus:border-[#2563EB]"
                                      />
                                    </div>
                                  </div>

                                  <div className="max-h-60 overflow-y-auto p-1.5 space-y-1.5">
                                    {filteredRoutesForModal.length === 0 ? (
                                      <div className="py-5 text-center text-[11px] text-[#64748B]">
                                        Tidak ada rute atau kru yang cocok dengan pencarian.
                                      </div>
                                    ) : (
                                      filteredRoutesForModal.map(({ trip, idx }) => {
                                        const isSelectedRoute = replaceAbsentModal.selectedTripIndex === idx;
                                        const stdArea = standardizeAreaName(trip.area);
                                        return (
                                          <div
                                            key={`rep-card-${idx}`}
                                            onClick={() =>
                                              setReplaceAbsentModal(prev =>
                                                prev
                                                  ? {
                                                      ...prev,
                                                      selectedTripIndex: idx,
                                                      isRouteDropdownOpen: false
                                                    }
                                                  : null
                                              )
                                            }
                                            className={`p-2.5 rounded-xl border transition cursor-pointer ${
                                              isSelectedRoute
                                                ? 'bg-[#EFF6FF] dark:bg-[#1E3A8A]/30 border-[#2563EB]'
                                                : 'bg-[#F8FAFC] dark:bg-[#0F172A] border-[#E2E8F0] dark:border-[#24344D] hover:border-[#2563EB]/50'
                                            }`}
                                          >
                                            <div className="flex items-center justify-between gap-2 mb-1.5">
                                              <div className="flex items-center gap-1.5 min-w-0">
                                                <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold shrink-0 ${
                                                  isSelectedRoute ? 'bg-[#2563EB] text-white' : 'bg-[#E2E8F0] dark:bg-[#1E293B] text-[#334155] dark:text-[#CBD5E1]'
                                                }`}>
                                                  #{idx + 1}
                                                </span>
                                                <span className="font-bold text-[#0F172A] dark:text-[#F1F5F9] text-xs truncate">
                                                  {stdArea}
                                                </span>
                                              </div>
                                              <span className="px-2 py-0.5 rounded bg-[#EFF6FF] dark:bg-[#1E3A8A]/40 text-[#2563EB] dark:text-[#60A5FA] border border-[#BFDBFE] dark:border-[#1E40AF] font-mono font-bold text-[10px] shrink-0">
                                                {trip.armada}
                                              </span>
                                            </div>

                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                                              <button
                                                type="button"
                                                onClick={(e) => {
                                                  e.stopPropagation();
                                                  setReplaceAbsentModal(prev =>
                                                    prev
                                                      ? {
                                                          ...prev,
                                                          selectedTripIndex: idx,
                                                          replacePosition: 'driver',
                                                          isRouteDropdownOpen: false
                                                        }
                                                      : null
                                                  );
                                                }}
                                                className={`px-2 py-1.5 rounded-lg border text-left text-[11px] flex items-center justify-between gap-1 transition cursor-pointer ${
                                                  isSelectedRoute && replaceAbsentModal.replacePosition === 'driver'
                                                    ? 'bg-[#2563EB] text-white border-[#2563EB] font-bold'
                                                    : 'bg-white dark:bg-[#162234] text-[#334155] dark:text-[#CBD5E1] border-[#E2E8F0] dark:border-[#24344D] hover:border-[#2563EB]'
                                                }`}
                                              >
                                                <span className="truncate">
                                                  <strong className="opacity-75">Driver:</strong> {trip.driver || '-'}
                                                </span>
                                                {isSelectedRoute && replaceAbsentModal.replacePosition === 'driver' && (
                                                  <Check className="w-3 h-3 shrink-0" />
                                                )}
                                              </button>

                                              <button
                                                type="button"
                                                onClick={(e) => {
                                                  e.stopPropagation();
                                                  setReplaceAbsentModal(prev =>
                                                    prev
                                                      ? {
                                                          ...prev,
                                                          selectedTripIndex: idx,
                                                          replacePosition: 'helper',
                                                          isRouteDropdownOpen: false
                                                        }
                                                      : null
                                                  );
                                                }}
                                                className={`px-2 py-1.5 rounded-lg border text-left text-[11px] flex items-center justify-between gap-1 transition cursor-pointer ${
                                                  isSelectedRoute && replaceAbsentModal.replacePosition === 'helper'
                                                    ? 'bg-[#2563EB] text-white border-[#2563EB] font-bold'
                                                    : 'bg-white dark:bg-[#162234] text-[#334155] dark:text-[#CBD5E1] border-[#E2E8F0] dark:border-[#24344D] hover:border-[#2563EB]'
                                                }`}
                                              >
                                                <span className="truncate">
                                                  <strong className="opacity-75">Helper 1:</strong> {trip.helper && trip.helper !== '-' ? trip.helper : 'Kosong'}
                                                </span>
                                                {isSelectedRoute && replaceAbsentModal.replacePosition === 'helper' && (
                                                  <Check className="w-3 h-3 shrink-0" />
                                                )}
                                              </button>
                                            </div>
                                          </div>
                                        );
                                      })
                                    )}
                                  </div>
                                </div>
                              )}
                            </div>

                            {selectedTrip && (
                              <div className="p-3.5 rounded-xl bg-[#EFF6FF] dark:bg-[#1E3A8A]/25 border border-[#BFDBFE] dark:border-[#1E40AF] flex items-center justify-between gap-2">
                                <div className="min-w-0">
                                  <span className="text-[10px] font-bold uppercase tracking-wider text-[#2563EB] dark:text-[#60A5FA] block">
                                    RINGKASAN PENUGASAN PENGGANTI
                                  </span>
                                  <p className="text-xs font-medium text-[#0F172A] dark:text-[#F1F5F9] mt-0.5">
                                    <strong>{replaceAbsentModal.standbyCrewName}</strong> menggantikan{' '}
                                    <strong className="text-[#2563EB] dark:text-[#60A5FA]">
                                      {posLabelActive} ({selectedTargetCrewName})
                                    </strong>{' '}
                                    di rute <strong>{selectedAreaName}</strong> ({selectedTrip.armada})
                                  </p>
                                </div>
                              </div>
                            )}
                          </div>

                          <div className="flex items-center justify-between gap-2 pt-3 border-t border-[#E2E8F0] dark:border-[#24344D]">
                            {activeDayObj.pengiriman.some(p => p.backupCrewName && isSameCrewPerson(p.backupCrewName, replaceAbsentModal.standbyCrewName)) ? (
                              <button
                                type="button"
                                onClick={() => handleCancelReplaceAbsentCrew(replaceAbsentModal.standbyCrewName)}
                                className="px-3 py-2 rounded-lg bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs font-bold transition cursor-pointer flex items-center gap-1.5"
                                title="Batalkan penggantian dan kembalikan ke status Stand By di Gudang"
                              >
                                <XCircle className="w-3.5 h-3.5 text-rose-500" />
                                <span>Tidak Jadi Ganti</span>
                              </button>
                            ) : (
                              <div />
                            )}
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => setReplaceAbsentModal(null)}
                                className="px-4 py-2 rounded-lg border border-[#CBD5E1] dark:border-[#334155] text-[#475569] dark:text-[#CBD5E1] text-xs font-bold hover:bg-[#F8FAFC] dark:hover:bg-[#1E293B] transition cursor-pointer"
                              >
                                Batal
                              </button>
                              <button
                                type="button"
                                onClick={handleConfirmReplaceAbsentCrew}
                                className="px-4 py-2 rounded-lg bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-xs font-bold transition cursor-pointer flex items-center gap-1.5"
                              >
                                <Check className="w-3.5 h-3.5" />
                                <span>Konfirmasi Gantikan</span>
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })()}
              </>
            );
          })()}
        </div>
      </div>
        </>
      ) : activeSubPage === 'upload_excel' ? (
        /* HALAMAN BARU 1: FORM UNGGAH FILE JADWAL PENGIRIMAN (Tanpa Cabang Data) */
        <div className="bg-white dark:bg-[#162234] border border-[#E2E8F0] dark:border-[#24344D] rounded-xl p-6 sm:p-8 space-y-6 animate-in fade-in duration-200">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#E2E8F0] dark:border-[#24344D] pb-5">
            <div className="flex items-start gap-3.5">
              <div className="w-11 h-11 rounded-xl bg-[#2563EB] text-white flex items-center justify-center shrink-0">
                <FileSpreadsheet className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-lg sm:text-xl font-bold text-[#0F172A] dark:text-[#F1F5F9]">
                  Unggah File Jadwal Pengiriman
                </h2>
                <p className="text-xs sm:text-sm text-[#64748B] dark:text-[#94A3B8] mt-1">
                  Pilih periode bulan, mode import, dan unggah file Excel (.xls, .xlsx, .csv) untuk diproses pada halaman pemrosesan jadwal.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setActiveSubPage('schedule')}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-white dark:bg-[#1E293B] hover:bg-[#F8FAFC] dark:hover:bg-[#24344D] text-[#334155] dark:text-[#E2E8F0] text-xs font-semibold border border-[#CBD5E1] dark:border-[#334155] transition cursor-pointer w-fit"
            >
              <ChevronLeft className="w-4 h-4" />
              <span>Kembali ke Jadwal Pengiriman</span>
            </button>
          </div>

          <div className="max-w-3xl space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-[#334155] dark:text-[#CBD5E1] mb-2">
                  BULAN DATA
                </label>
                <select
                  value={importMonth}
                  onChange={(e) => setImportMonth(e.target.value)}
                  className="w-full bg-[#F8FAFC] dark:bg-[#0F172A] border border-[#CBD5E1] dark:border-[#334155] rounded-lg px-4 py-3 text-sm font-medium text-[#0F172A] dark:text-[#F1F5F9] focus:outline-none focus:border-[#2563EB] cursor-pointer"
                >
                  {MONTH_NAMES.map(m => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-[#334155] dark:text-[#CBD5E1] mb-2">
                  TAHUN DATA
                </label>
                <select
                  value={importYear}
                  onChange={(e) => setImportYear(e.target.value)}
                  className="w-full bg-[#F8FAFC] dark:bg-[#0F172A] border border-[#CBD5E1] dark:border-[#334155] rounded-lg px-4 py-3 text-sm font-medium text-[#0F172A] dark:text-[#F1F5F9] focus:outline-none focus:border-[#2563EB] cursor-pointer"
                >
                  {['2024', '2025', '2026', '2027', '2028', '2029', '2030'].map(yr => (
                    <option key={yr} value={yr}>{yr}</option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-[#334155] dark:text-[#CBD5E1] mb-2">
                MODE IMPORT
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <label
                  onClick={() => setImportMode('tambahkan')}
                  className={`flex items-start gap-3 p-4 rounded-xl border cursor-pointer transition ${
                    importMode === 'tambahkan'
                      ? 'bg-[#EFF6FF] dark:bg-[#1E3A8A]/30 border-[#2563EB] ring-1 ring-[#2563EB]'
                      : 'bg-white dark:bg-[#0F172A] border-[#CBD5E1] dark:border-[#334155] hover:border-[#2563EB]/60'
                  }`}
                >
                  <input
                    type="radio"
                    name="importModeRadio"
                    checked={importMode === 'tambahkan'}
                    onChange={() => setImportMode('tambahkan')}
                    className="mt-1 w-4 h-4 text-[#2563EB] focus:ring-[#2563EB] cursor-pointer"
                  />
                  <div>
                    <div className="text-sm font-bold text-[#0F172A] dark:text-[#F1F5F9]">Tambahkan data</div>
                    <div className="text-xs text-[#64748B] dark:text-[#94A3B8] mt-0.5">
                      Data bulan yang sama tidak dihapus.
                    </div>
                  </div>
                </label>

                <label
                  onClick={() => setImportMode('ganti')}
                  className={`flex items-start gap-3 p-4 rounded-xl border cursor-pointer transition ${
                    importMode === 'ganti'
                      ? 'bg-[#EFF6FF] dark:bg-[#1E3A8A]/30 border-[#2563EB] ring-1 ring-[#2563EB]'
                      : 'bg-white dark:bg-[#0F172A] border-[#CBD5E1] dark:border-[#334155] hover:border-[#2563EB]/60'
                  }`}
                >
                  <input
                    type="radio"
                    name="importModeRadio"
                    checked={importMode === 'ganti'}
                    onChange={() => setImportMode('ganti')}
                    className="mt-1 w-4 h-4 text-[#2563EB] focus:ring-[#2563EB] cursor-pointer"
                  />
                  <div>
                    <div className="text-sm font-bold text-[#0F172A] dark:text-[#F1F5F9]">Ganti data bulan ini</div>
                    <div className="text-xs text-[#64748B] dark:text-[#94A3B8] mt-0.5">
                      Data lama periode sama dihapus lalu diimport ulang.
                    </div>
                  </div>
                </label>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-xs font-bold uppercase tracking-wider text-[#334155] dark:text-[#CBD5E1]">
                  FILE JADWAL PENGIRIMAN
                </label>
                <button
                  type="button"
                  onClick={downloadScheduleTemplate}
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-[#2563EB] dark:text-[#60A5FA] hover:underline cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Unduh Template Excel</span>
                </button>
              </div>

              <input
                type="file"
                ref={modalFileInputRef}
                accept=".xlsx,.xls,.csv"
                className="hidden"
                onChange={async (e) => {
                  const f = e.target.files?.[0];
                  if (!f) return;
                  setSelectedUploadFile(f);
                  setUploadedFileName(f.name);
                  try {
                    const arrayBuffer = await f.arrayBuffer();
                    const data = new Uint8Array(arrayBuffer);
                    const workbook = XLSX.read(data, { type: 'array' });
                    const sheetName = workbook.SheetNames.find(n => n.toUpperCase() === 'ALL') || workbook.SheetNames[0];
                    const worksheet = workbook.Sheets[sheetName];
                    const jsonRows = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];
                    const parsed = googleSheetsApiService.parseScheduleRows(jsonRows);
                    if (parsed.length > 0) {
                      const excelEntries = parsed.map((item, idx) => ({
                        ...item,
                        source: 'excel' as const,
                        tempId: `xls-${Date.now()}-${idx}`
                      }));
                      setStagedCombinedTrips(excelEntries);
                    } else {
                      setStagedCombinedTrips([]);
                    }
                  } catch (err) {
                    console.error('Failed reading excel on upload page:', err);
                  }
                }}
              />

              <div className="bg-[#EFF6FF]/60 dark:bg-[#0F172A] border-2 border-dashed border-[#BFDBFE] dark:border-[#334155] rounded-xl p-4 space-y-2.5">
                <div className="bg-white dark:bg-[#162234] border border-[#E2E8F0] dark:border-[#24344D] rounded-lg p-2 flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => modalFileInputRef.current?.click()}
                    className="px-4 py-2 rounded-lg bg-[#2563EB] hover:bg-[#1D4ED8] text-white font-bold text-xs cursor-pointer transition shrink-0"
                  >
                    Pilih File Excel
                  </button>
                  <span className="text-sm text-[#334155] dark:text-[#CBD5E1] truncate flex-1">
                    {selectedUploadFile ? selectedUploadFile.name : 'Belum ada file dipilih'}
                  </span>
                  {selectedUploadFile && (
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedUploadFile(null);
                        setStagedCombinedTrips([]);
                        if (modalFileInputRef.current) modalFileInputRef.current.value = '';
                      }}
                      className="text-xs font-bold text-rose-600 hover:text-rose-500 px-2 cursor-pointer"
                    >
                      Hapus
                    </button>
                  )}
                </div>
                <p className="text-xs text-[#64748B] dark:text-[#94A3B8]">
                  Format didukung: .xls, .xlsx, .csv. Maksimal 10MB. Sistem akan menampilkan halaman pemrosesan &amp; preview jadwal sebelum import.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 pt-2 flex-wrap">
              <button
                type="button"
                onClick={() => {
                  if (!selectedUploadFile) {
                    modalFileInputRef.current?.click();
                    return;
                  }
                  setActiveSubPage('upload_process');
                }}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-sm font-bold transition cursor-pointer"
              >
                <Search className="w-4 h-4" />
                <span>Preview Dulu</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setScheduleChangeLogs(logisticsStore.getScheduleChangeLogs());
                  setIsHistoryModalOpen(true);
                }}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-white dark:bg-[#1E293B] hover:bg-[#F8FAFC] dark:hover:bg-[#24344D] text-[#334155] dark:text-[#E2E8F0] text-sm font-bold border border-[#CBD5E1] dark:border-[#334155] transition cursor-pointer"
              >
                <HistoryIcon className="w-4 h-4 text-[#2563EB] dark:text-[#60A5FA]" />
                <span>Lihat Riwayat Upload</span>
              </button>
            </div>
          </div>
        </div>
      ) : activeSubPage === 'upload_process' ? (
        /* HALAMAN BARU 2: HALAMAN PEMROSESAN & PREVIEW FILE JADWAL EXCEL */
        <div className="bg-white dark:bg-[#162234] border border-[#E2E8F0] dark:border-[#24344D] rounded-xl p-6 sm:p-8 space-y-6 animate-in fade-in duration-200">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#E2E8F0] dark:border-[#24344D] pb-5">
            <div>
              <span className="inline-block px-2.5 py-0.5 rounded-md bg-[#EFF6FF] dark:bg-[#1E3A8A]/40 text-[#2563EB] dark:text-[#60A5FA] text-[11px] font-bold uppercase tracking-wider border border-[#BFDBFE] dark:border-[#1E40AF]">
                Halaman Pemrosesan File
              </span>
              <h2 className="text-lg sm:text-xl font-bold text-[#0F172A] dark:text-[#F1F5F9] flex items-center gap-2 mt-2">
                <CheckCircle2 className="w-5 h-5 text-[#2563EB]" />
                <span>Pemrosesan &amp; Preview Jadwal Excel</span>
              </h2>
              <p className="text-xs sm:text-sm text-[#64748B] dark:text-[#94A3B8] mt-0.5">
                Periksa hasil pembacaan file <strong>{selectedUploadFile?.name || '-'}</strong> sebelum disimpan ke jadwal utama.
              </p>
            </div>

            <div className="flex items-center gap-2.5 flex-wrap">
              <button
                type="button"
                onClick={() => setActiveSubPage('upload_excel')}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-white dark:bg-[#1E293B] hover:bg-[#F8FAFC] dark:hover:bg-[#24344D] text-[#334155] dark:text-[#E2E8F0] text-xs font-semibold border border-[#CBD5E1] dark:border-[#334155] transition cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
                <span>Kembali ke Form Unggah</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  const excelQueue = stagedCombinedTrips.filter(x => x.source === 'excel');
                  if (excelQueue.length === 0 || !selectedUploadFile) return;
                  const monthIndex = MONTH_NAMES.findIndex(m => m.toLowerCase() === importMonth.toLowerCase());
                  if (monthIndex !== -1) {
                    setSelectedMonth(monthIndex);
                  }
                  if (!isNaN(Number(importYear))) {
                    setSelectedYear(Number(importYear));
                  }
                  mergeAndSaveCombinedTrips(
                    excelQueue,
                    importMode,
                    selectedUploadFile.name
                  );
                  setStagedCombinedTrips([]);
                  setSelectedUploadFile(null);
                  setActiveSubPage('schedule');
                }}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-xs font-bold transition cursor-pointer"
              >
                <Save className="w-4 h-4" />
                <span>Simpan &amp; Import Jadwal ({stagedCombinedTrips.filter(x => x.source === 'excel').length} Baris)</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-[#F8FAFC] dark:bg-[#0F172A] p-4 rounded-xl border border-[#E2E8F0] dark:border-[#24344D]">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#64748B] block">NAMA FILE EXCEL</span>
              <span className="text-sm font-bold text-[#0F172A] dark:text-[#F1F5F9] mt-1 block truncate">
                {selectedUploadFile?.name || '-'}
              </span>
            </div>
            <div className="bg-[#F8FAFC] dark:bg-[#0F172A] p-4 rounded-xl border border-[#E2E8F0] dark:border-[#24344D]">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#64748B] block">PERIODE BULAN &amp; TAHUN</span>
              <span className="text-sm font-bold text-[#0F172A] dark:text-[#F1F5F9] mt-1 block">
                {importMonth} {importYear}
              </span>
            </div>
            <div className="bg-[#F8FAFC] dark:bg-[#0F172A] p-4 rounded-xl border border-[#E2E8F0] dark:border-[#24344D]">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#64748B] block">MODE IMPORT &amp; BARIS TERBACA</span>
              <span className="text-sm font-bold text-[#2563EB] dark:text-[#60A5FA] mt-1 block">
                {importMode === 'tambahkan' ? 'Tambahkan data' : 'Ganti data bulan ini'} ({stagedCombinedTrips.filter(x => x.source === 'excel').length} Jadwal)
              </span>
            </div>
          </div>

          <div className="bg-white dark:bg-[#0F172A] border border-[#E2E8F0] dark:border-[#24344D] rounded-xl overflow-hidden">
            <div className="max-h-[60vh] overflow-y-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-[#F8FAFC] dark:bg-[#1E293B] text-[#475569] dark:text-[#94A3B8] border-b border-[#E2E8F0] dark:border-[#24344D] sticky top-0">
                    <th className="p-3.5 font-bold">NO</th>
                    <th className="p-3.5 font-bold">TANGGAL KIRIM</th>
                    <th className="p-3.5 font-bold">DRIVER / SUPIR</th>
                    <th className="p-3.5 font-bold">HELPER</th>
                    <th className="p-3.5 font-bold">AREA KIRIM TUJUAN</th>
                    <th className="p-3.5 font-bold">ARMADA</th>
                    <th className="p-3.5 font-bold text-center">HAPUS BARIS</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E2E8F0] dark:divide-[#24344D] text-[#0F172A] dark:text-[#E2E8F0]">
                  {stagedCombinedTrips.filter(x => x.source === 'excel').length === 0 ? (
                    <tr>
                      <td colSpan={7} className="p-8 text-center text-[#64748B]">
                        Tidak ada baris jadwal yang terbaca dari file ini. Silakan kembali dan pilih file sesuai template.
                      </td>
                    </tr>
                  ) : (
                    stagedCombinedTrips
                      .filter(x => x.source === 'excel')
                      .map((item, idx) => (
                        <tr key={item.tempId} className="hover:bg-[#F8FAFC] dark:hover:bg-[#1E293B]/60">
                          <td className="p-3.5 font-mono text-[#64748B]">{idx + 1}</td>
                          <td className="p-3.5 font-mono font-semibold">{item.dateStr || '-'}</td>
                          <td className="p-3.5 font-bold text-[#0F172A] dark:text-[#F1F5F9]">{item.driver}</td>
                          <td className="p-3.5 text-[#475569] dark:text-[#94A3B8]">
                            {item.helper || '-'}{item.helper2 && item.helper2 !== '-' ? `, ${item.helper2}` : ''}
                          </td>
                          <td className="p-3.5 font-bold text-[#2563EB] dark:text-[#60A5FA]">{item.area}</td>
                          <td className="p-3.5 font-mono font-bold text-[#334155] dark:text-[#CBD5E1]">{item.armada}</td>
                          <td className="p-3.5 text-center">
                            <button
                              type="button"
                              onClick={() => setStagedCombinedTrips(prev => prev.filter(x => x.tempId !== item.tempId))}
                              className="text-rose-500 hover:text-rose-600 cursor-pointer p-1.5 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/40 transition"
                              title="Hapus baris ini"
                            >
                              <Trash2 className="w-4 h-4 mx-auto" />
                            </button>
                          </td>
                        </tr>
                      ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : null}

      {/* Modal Edit / Tambah Ritase Pengiriman */}
      {editingTripModal?.isOpen && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-[10000] akk-flat-schedule grid place-items-center p-2 sm:p-4 bg-slate-950/60 backdrop-blur-xs overflow-hidden animate-in fade-in duration-200">
          <div className="bg-white dark:bg-[#162234] border border-[#E2E8F0] dark:border-[#24344D] rounded-2xl p-5 sm:p-6 max-w-5xl w-full flex flex-col max-h-[calc(100dvh-1rem)] overflow-hidden">
            <div className="flex items-center justify-between border-b border-[#E2E8F0] dark:border-[#24344D] pb-3.5 mb-4 shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#2563EB] text-white flex items-center justify-center shrink-0">
                  <Edit className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-bold text-[#0F172A] dark:text-[#F1F5F9]">
                    {editingTripModal.isNew ? 'Tambah Ritase Pengiriman' : 'Edit Rincian Pengiriman'}
                  </h3>
                  <p className="text-xs text-[#64748B] dark:text-[#94A3B8]">
                    Tanggal: {editingTripModal.dateString}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setEditingTripModal(null)}
                className="w-8 h-8 rounded-lg bg-[#F1F5F9] dark:bg-[#1E293B] hover:bg-[#E2E8F0] dark:hover:bg-[#24344D] text-[#64748B] hover:text-[#0F172A] dark:hover:text-white flex items-center justify-center transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="text-xs flex-1 min-h-0 overflow-y-auto overscroll-contain pr-1">
              {editTripModalError && (
                <div className="mb-3 p-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-200 text-xs font-bold flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
                    <span>{editTripModalError}</span>
                  </div>
                </div>
              )}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
                <div className="space-y-3.5 min-w-0 lg:sticky lg:top-0 self-start">
                  <CrewCustomSelectDropdown
                label="Driver / Pengemudi *"
                value={editingTripModal.driver}
                options={getIntegratedDrivers(editingTripModal.branchId || effectiveActiveBranchId)}
                onChange={(val, option) => setEditingTripModal({ ...editingTripModal, driver: val, driverId: option?.id || '' })}
                roleBadgeText="Kru Supir"
                accentColor="blue"
                scheduledCrewMap={editingScheduledCrewMap}
              />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <CrewCustomSelectDropdown
                  label="Helper / Kernet 1"
                  value={editingTripModal.helper}
                  options={getIntegratedHelpers(editingTripModal.branchId || effectiveActiveBranchId)}
                  onChange={(val) => setEditingTripModal({ ...editingTripModal, helper: val })}
                  emptyLabel="- Tanpa Helper 1 -"
                  emptyValue=""
                  roleBadgeText="Kru Helper"
                  accentColor="blue"
                  scheduledCrewMap={editingScheduledCrewMap}
                />

                <CrewCustomSelectDropdown
                  label="Helper / Kernet 2 (Opsional)"
                  value={editingTripModal.helper2}
                  options={getIntegratedHelpers(editingTripModal.branchId || effectiveActiveBranchId)}
                  onChange={(val) => setEditingTripModal({ ...editingTripModal, helper2: val })}
                  emptyLabel="- Tanpa Helper 2 -"
                  emptyValue=""
                  roleBadgeText="Kru Helper"
                  accentColor="blue"
                  scheduledCrewMap={editingScheduledCrewMap}
                />
              </div>

              <div>
                <label className="block text-[#334155] dark:text-[#CBD5E1] font-bold mb-1.5">
                  Kirim Area / Tujuan ({getOfficialAreasForBranch(editingTripModal.branchId || effectiveActiveBranchId).length} Area Resmi Cabang {branchStore.getBranchById(editingTripModal.branchId || effectiveActiveBranchId)?.name || 'Aktif'}) *
                </label>
                <select
                  value={editingTripModal.area}
                  onChange={(e) => setEditingTripModal({ ...editingTripModal, area: e.target.value })}
                  className="w-full bg-[#F8FAFC] dark:bg-[#0F172A] border border-[#CBD5E1] dark:border-[#334155] text-[#0F172A] dark:text-[#F1F5F9] text-xs font-bold rounded-lg px-3.5 py-2.5 focus:outline-none focus:border-[#2563EB] cursor-pointer"
                >
                  <option value="">-- Pilih Area Tujuan --</option>
                  {getOfficialAreasForBranch(editingTripModal.branchId || effectiveActiveBranchId).map(areaOpt => (
                    <option key={areaOpt} value={areaOpt}>
                      {areaOpt}
                    </option>
                  ))}
                </select>
              </div>

              <FleetCustomSelectDropdown
                label={`Armada Truk Cabang ${branchStore.getBranchById(editingTripModal.branchId || effectiveActiveBranchId)?.name || 'Aktif'} *`}
                value={editingTripModal.armada}
                fleets={getFleetsForBranch(editingTripModal.branchId || effectiveActiveBranchId)}
                dateIso={editingTripModal.returnDateIso || editingTripModal.departureDateIso}
                excludeScheduleId={editingTripModal.scheduleId}
                onChange={(val) => {
                  setEditTripModalError(null);
                  setEditingTripModal({ ...editingTripModal, armada: val });
                }}
                accentColor="blue"
              />

                </div>
                <div className="space-y-3.5 min-w-0">
              {/* Tanggal & Jam Keberangkatan serta Tanggal & Jam Kepulangan */}
              <div className="p-4 rounded-xl bg-[#F8FAFC] dark:bg-[#0F172A] border border-[#E2E8F0] dark:border-[#24344D] space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-[#2563EB] dark:text-[#60A5FA] uppercase tracking-wider flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5" />
                    <span>Jadwal Waktu: Keberangkatan &amp; Kepulangan</span>
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div className="space-y-2.5">
                    <ModernDatePicker
                      label="Tanggal Keberangkatan *"
                      value={editingTripModal.departureDateIso || editingTripModal.returnDateIso}
                      onChange={(nextDep) => {
                        setEditingTripModal({
                          ...editingTripModal,
                          departureDateIso: nextDep
                        });
                      }}
                      accentColor="blue"
                    />
                    <ModernTimePicker
                      label="Jam Keberangkatan *"
                      value={editingTripModal.departureTime}
                      onChange={(nextTime) => {
                        setEditingTripModal({
                          ...editingTripModal,
                          departureTime: nextTime
                        });
                      }}
                      accentColor="blue"
                    />
                  </div>

                  <div className="space-y-2.5">
                    <ModernDatePicker
                      label="Tanggal Kepulangan *"
                      badgeText="Sesuai Tanggal Kirim"
                      value={editingTripModal.returnDateIso}
                      onChange={(nextRet) => {
                        setEditingTripModal({
                          ...editingTripModal,
                          returnDateIso: nextRet
                        });
                      }}
                      accentColor="blue"
                    />
                    <ModernTimePicker
                      label="Target Jam Kepulangan *"
                      value={editingTripModal.targetReturnTime}
                      onChange={(nextRetTime) => {
                        setEditingTripModal({
                          ...editingTripModal,
                          targetReturnTime: nextRetTime
                        });
                      }}
                      accentColor="blue"
                    />
                  </div>
                </div>

                {editingTripModal.departureDateIso && editingTripModal.returnDateIso && editingTripModal.departureDateIso !== editingTripModal.returnDateIso && (
                  <div className="text-[11px] font-semibold text-[#2563EB] dark:text-[#60A5FA] bg-[#EFF6FF] dark:bg-[#1E3A8A]/40 px-3 py-2 rounded-lg border border-[#BFDBFE] dark:border-[#1E40AF]">
                    Berangkat: {editingTripModal.departureDateIso} ({editingTripModal.departureTime} WIB) • Pulang: {editingTripModal.returnDateIso} ({editingTripModal.targetReturnTime} WIB). Jadwal kalender mengikuti Tanggal Kirim / Kepulangan.
                  </div>
                )}
              </div>
                </div>
              </div>
            </div>

            <div className="pt-3.5 mt-4 border-t border-[#E2E8F0] dark:border-[#24344D] flex items-center justify-end gap-2.5 shrink-0">
              <button
                type="button"
                onClick={() => setEditingTripModal(null)}
                className="px-4 py-2 rounded-lg border border-[#CBD5E1] dark:border-[#334155] text-xs font-semibold text-[#475569] dark:text-[#CBD5E1] hover:bg-[#F8FAFC] dark:hover:bg-[#1E293B] transition cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleSaveTripModal}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold bg-[#2563EB] hover:bg-[#1D4ED8] text-white transition cursor-pointer"
              >
                <Save className="w-3.5 h-3.5" />
                <span>Simpan Perubahan Permanen</span>
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Pop-up Modal: Form Tambah Jadwal Baru (Manual) */}
      {isUploadConfigModalOpen && typeof document !== 'undefined' && createPortal(
        <div
          className="fixed inset-0 z-[10000] akk-flat-schedule grid place-items-center p-3 sm:p-4 bg-slate-950/60 backdrop-blur-xs overflow-hidden animate-in fade-in duration-200"
          onClick={() => setIsUploadConfigModalOpen(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white dark:bg-[#162234] border border-[#E2E8F0] dark:border-[#24344D] rounded-2xl p-5 sm:p-6 max-w-xl w-full flex flex-col max-h-[calc(100dvh-1.5rem)] overflow-hidden"
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-[#E2E8F0] dark:border-[#24344D] pb-3.5 mb-4 shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#2563EB] text-white flex items-center justify-center shrink-0">
                  <Plus className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-[#0F172A] dark:text-[#F1F5F9]">
                    Form Tambah Jadwal Baru (Manual)
                  </h3>
                  <p className="text-[11px] font-medium text-[#64748B] dark:text-[#94A3B8]">
                    Cabang Aktif: <span className="text-[#2563EB] dark:text-[#60A5FA] font-bold">Cabang {activeBranchRecord?.name || 'Nusantara'}</span> · Data armada, kru, dan area otomatis terkunci per cabang
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsUploadConfigModalOpen(false)}
                className="w-8 h-8 rounded-lg bg-[#F1F5F9] dark:bg-[#1E293B] hover:bg-[#E2E8F0] dark:hover:bg-[#24344D] text-[#64748B] hover:text-[#0F172A] dark:hover:text-white flex items-center justify-center transition cursor-pointer shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Form Body */}
            <div className="space-y-3.5 text-xs flex-1 min-h-0 overflow-y-auto overscroll-contain pr-1">
              {manualScheduleFormError && (
                <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-200 text-xs font-bold flex flex-col gap-2">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
                    <span>{manualScheduleFormError}</span>
                  </div>
                </div>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div className="w-full">
                  <ModernDatePicker
                    label="Tanggal Kirim *"
                    badgeText="Otomatis Hari Ini"
                    value={manualScheduleForm.dateIso}
                    onChange={(nextIso) => {
                      setManualScheduleFormError(null);
                      setManualScheduleForm({
                        ...manualScheduleForm,
                        dateIso: nextIso,
                        returnDateIso: nextIso,
                        departureDateIso: (!manualScheduleForm.departureDateIso || manualScheduleForm.departureDateIso === manualScheduleForm.dateIso)
                          ? nextIso
                          : manualScheduleForm.departureDateIso
                      });
                    }}
                    accentColor="blue"
                  />
                </div>
                <div className="w-full">
                  <FleetCustomSelectDropdown
                    label={`Armada Truk (Cabang ${activeBranchRecord?.name || 'Nusantara'}) *`}
                    value={manualScheduleForm.armada}
                    fleets={getFleetsForBranch(effectiveActiveBranchId)}
                    dateIso={manualScheduleForm.returnDateIso || manualScheduleForm.dateIso}
                    onChange={(val) => {
                      setManualScheduleFormError(null);
                      setManualScheduleForm({ ...manualScheduleForm, armada: val });
                    }}
                    accentColor="blue"
                  />
                </div>
              </div>

              <div className="p-4 rounded-xl bg-[#F8FAFC] dark:bg-[#0F172A] border border-[#E2E8F0] dark:border-[#24344D] space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-[#2563EB] dark:text-[#60A5FA] uppercase tracking-wider flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5" />
                    <span>Jadwal Waktu: Keberangkatan &amp; Kepulangan</span>
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div className="space-y-2.5">
                    <ModernDatePicker
                      label="Tanggal Keberangkatan *"
                      value={manualScheduleForm.departureDateIso || manualScheduleForm.dateIso}
                      onChange={(nextDep) => {
                        setManualScheduleForm({
                          ...manualScheduleForm,
                          departureDateIso: nextDep
                        });
                      }}
                      accentColor="blue"
                    />
                    <ModernTimePicker
                      label="Jam Keberangkatan *"
                      value={manualScheduleForm.departureTime}
                      onChange={(nextTime) => {
                        setManualScheduleForm({
                          ...manualScheduleForm,
                          departureTime: nextTime
                        });
                      }}
                      accentColor="blue"
                    />
                  </div>

                  <div className="space-y-2.5">
                    <ModernDatePicker
                      label="Tanggal Kepulangan *"
                      badgeText="Sesuai Tanggal Kirim"
                      value={manualScheduleForm.returnDateIso || manualScheduleForm.dateIso}
                      onChange={(nextRet) => {
                        setManualScheduleFormError(null);
                        setManualScheduleForm({
                          ...manualScheduleForm,
                          returnDateIso: nextRet,
                          dateIso: nextRet
                        });
                      }}
                      accentColor="blue"
                    />
                    <ModernTimePicker
                      label="Target Jam Kepulangan *"
                      value={manualScheduleForm.targetReturnTime}
                      onChange={(nextRetTime) => {
                        setManualScheduleForm({
                          ...manualScheduleForm,
                          targetReturnTime: nextRetTime
                        });
                      }}
                      accentColor="blue"
                    />
                  </div>
                </div>

                {manualScheduleForm.departureDateIso && manualScheduleForm.returnDateIso && manualScheduleForm.departureDateIso !== manualScheduleForm.returnDateIso && (
                  <div className="text-[11px] font-semibold text-[#2563EB] dark:text-[#60A5FA] bg-[#EFF6FF] dark:bg-[#1E3A8A]/40 px-3 py-2 rounded-lg border border-[#BFDBFE] dark:border-[#1E40AF]">
                    Berangkat: {manualScheduleForm.departureDateIso} ({manualScheduleForm.departureTime} WIB) • Pulang: {manualScheduleForm.returnDateIso} ({manualScheduleForm.targetReturnTime} WIB). Jadwal penugasan kalender mengikuti Tanggal Kirim / Kepulangan.
                  </div>
                )}
              </div>

              <div className="space-y-3">
                <CrewCustomSelectDropdown
                  label="Pilih Driver / Supir *"
                  value={manualScheduleForm.driver}
                  options={getIntegratedDrivers()}
                  onChange={(val) => setManualScheduleForm({ ...manualScheduleForm, driver: val })}
                  emptyLabel="Pilih Driver..."
                  roleBadgeText="Kru Supir"
                  accentColor="blue"
                  scheduledCrewMap={manualScheduledCrewMap}
                />

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 items-start">
                  <div className="w-full">
                    <CrewCustomSelectDropdown
                      label="Pilih Helper 1 *"
                      value={manualScheduleForm.helper}
                      options={getIntegratedHelpers()}
                      onChange={(val) => setManualScheduleForm({ ...manualScheduleForm, helper: val })}
                      emptyLabel="Pilih Helper 1..."
                      emptyValue="-"
                      roleBadgeText="Kru Helper"
                      accentColor="blue"
                      scheduledCrewMap={manualScheduledCrewMap}
                    />
                  </div>

                  <div className="w-full">
                    <CrewCustomSelectDropdown
                      label="Pilih Helper 2 (Opsional)"
                      value={manualScheduleForm.helper2}
                      options={getIntegratedHelpers()}
                      onChange={(val) => setManualScheduleForm({ ...manualScheduleForm, helper2: val })}
                      emptyLabel="- Tanpa Helper 2 -"
                      emptyValue=""
                      roleBadgeText="Kru Helper"
                      accentColor="blue"
                      scheduledCrewMap={manualScheduledCrewMap}
                    />
                  </div>
                </div>
              </div>

              {/* Area Kirim Tujuan */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-bold text-[#334155] dark:text-[#CBD5E1] flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-[#2563EB]" />
                    <span>Area Kirim Tujuan *</span>
                  </label>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setQuickCreateAreaTarget('AREA BARU')}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-[10px] font-bold transition cursor-pointer"
                    >
                      <Plus className="w-3 h-3" />
                      <span>Tambah Area</span>
                    </button>
                    <span className="text-[10px] font-bold text-[#2563EB] dark:text-[#60A5FA] bg-[#EFF6FF] dark:bg-[#1E3A8A]/40 px-2 py-0.5 rounded border border-[#BFDBFE] dark:border-[#1E40AF]">
                      {branchOfficialAreas.length} Area Resmi Cabang {activeBranchRecord?.name || 'Nusantara'}
                    </span>
                  </div>
                </div>

                <div className="rounded-xl border border-[#CBD5E1] dark:border-[#334155] bg-[#F8FAFC] dark:bg-[#0F172A] p-3 transition">
                  <div
                    onClick={() => setIsAreaPickerExpanded(!isAreaPickerExpanded)}
                    className="flex items-center justify-between gap-2 cursor-pointer select-none"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-9 h-9 rounded-lg bg-[#EFF6FF] dark:bg-[#1E3A8A]/40 border border-[#BFDBFE] dark:border-[#1E40AF] text-[#2563EB] dark:text-[#60A5FA] flex items-center justify-center shrink-0">
                        <MapPin className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-[#0F172A] dark:text-[#F1F5F9] truncate">
                          {manualScheduleForm.area || 'Klik untuk Pilih Area Tujuan'}
                        </div>
                        {manualScheduleForm.area ? (
                          !isSidoarjoBranch && (
                            <span className={`inline-block text-[9px] font-bold px-1.5 py-0.5 rounded border mt-0.5 ${getAreaRegionCategory(manualScheduleForm.area).badgeColor}`}>
                              {getAreaRegionCategory(manualScheduleForm.area).label}
                            </span>
                          )
                        ) : (
                          <span className="text-[10px] text-[#64748B] dark:text-[#94A3B8] italic">
                            Pilih dari {branchOfficialAreas.length} area pengiriman resmi Cabang {activeBranchRecord?.name || 'Nusantara'}
                          </span>
                        )}
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setIsAreaPickerExpanded(!isAreaPickerExpanded);
                      }}
                      className="px-3 py-1.5 rounded-lg bg-[#2563EB] hover:bg-[#1D4ED8] text-white font-bold text-[11px] flex items-center gap-1.5 transition cursor-pointer shrink-0"
                    >
                      <span>{isAreaPickerExpanded ? 'Tutup Pilihan' : 'Pilih / Ganti Area'}</span>
                      <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${isAreaPickerExpanded ? 'rotate-180' : ''}`} />
                    </button>
                  </div>

                  {isAreaPickerExpanded && (
                    <div className="mt-3 pt-3 border-t border-[#E2E8F0] dark:border-[#24344D] space-y-2.5 animate-in fade-in duration-150">
                      <div className="relative">
                        <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[#64748B]" />
                        <input
                          type="text"
                          value={areaSearchFilter}
                          onChange={(e) => setAreaSearchFilter(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              if (filteredOfficialAreas.length > 0) {
                                const topArea = filteredOfficialAreas[0];
                                const isLuar = isLuarKotaArea(topArea);
                                const depIso = manualScheduleForm.departureDateIso || manualScheduleForm.dateIso;
                                const retIso = isLuar
                                  ? (manualScheduleForm.departureTime > manualScheduleForm.targetReturnTime ? addDaysToIso(depIso, 1) : (manualScheduleForm.returnDateIso || depIso))
                                  : depIso;
                                setManualScheduleForm({
                                  ...manualScheduleForm,
                                  area: topArea,
                                  dateIso: retIso,
                                  departureDateIso: depIso,
                                  returnDateIso: retIso
                                });
                                setIsAreaPickerExpanded(false);
                              }
                            }
                          }}
                          placeholder={
                            isSidoarjoBranch
                              ? 'Cari area Sidoarjo (misal: BLIKETUT, PONOMADI, SURABAYA, MALANG)...'
                              : 'Cari area (misal: Denpasar, Toko DR. Soetomo)... (Tekan Enter untuk memilih)'
                          }
                          className="w-full bg-white dark:bg-[#162234] border border-[#CBD5E1] dark:border-[#334155] text-[#0F172A] dark:text-[#F1F5F9] text-xs rounded-lg pl-8 pr-8 py-2 focus:outline-none focus:border-[#2563EB]"
                          autoFocus
                        />
                        {areaSearchFilter && (
                          <button
                            type="button"
                            onClick={() => setAreaSearchFilter('')}
                            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#64748B] hover:text-[#0F172A] dark:hover:text-white text-xs cursor-pointer"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>

                      {!isSidoarjoBranch && (
                        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-[10px]">
                          {[
                            { id: 'all', label: `Semua (${OFFICIAL_DESTINATION_AREAS.length})` },
                            { id: 'bali', label: 'Bali (4)' },
                            { id: 'banyuwangi', label: 'Banyuwangi & Khusus (26)' },
                            { id: 'jember', label: 'Jember (3)' },
                            { id: 'pantura', label: 'Situbondo/Bw (3)' },
                          ].map(cat => (
                            <button
                              key={cat.id}
                              type="button"
                              onClick={() => setAreaCategoryFilter(cat.id as any)}
                              className={`px-2.5 py-1 rounded-lg font-bold whitespace-nowrap transition cursor-pointer ${
                                areaCategoryFilter === cat.id
                                  ? 'bg-[#2563EB] text-white'
                                  : 'bg-white dark:bg-[#162234] text-[#475569] dark:text-[#94A3B8] border border-[#E2E8F0] dark:border-[#24344D] hover:bg-[#F1F5F9]'
                              }`}
                            >
                              {cat.label}
                            </button>
                          ))}
                        </div>
                      )}

                      <div className="max-h-56 overflow-y-auto pr-1 grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                        {filteredOfficialAreas.map(areaName => {
                          const isSelected = manualScheduleForm.area === areaName;
                          const meta = getAreaRegionCategory(areaName);
                          return (
                            <button
                              key={areaName}
                              type="button"
                              onClick={() => {
                                const isLuar = isLuarKotaArea(areaName);
                                const depIso = manualScheduleForm.departureDateIso || manualScheduleForm.dateIso;
                                const retIso = isLuar
                                  ? (manualScheduleForm.departureTime > manualScheduleForm.targetReturnTime ? addDaysToIso(depIso, 1) : (manualScheduleForm.returnDateIso || depIso))
                                  : depIso;
                                setManualScheduleForm({
                                  ...manualScheduleForm,
                                  area: areaName,
                                  dateIso: retIso,
                                  departureDateIso: depIso,
                                  returnDateIso: retIso
                                });
                                setIsAreaPickerExpanded(false);
                              }}
                              className={`flex items-center justify-between p-2 rounded-lg text-left transition cursor-pointer border ${
                                isSelected
                                  ? 'bg-[#EFF6FF] dark:bg-[#1E3A8A]/40 border-[#2563EB] text-[#2563EB] dark:text-[#60A5FA] font-bold'
                                  : 'bg-white dark:bg-[#162234] border-[#E2E8F0] dark:border-[#24344D] hover:border-[#2563EB]/60 text-[#0F172A] dark:text-[#F1F5F9]'
                              }`}
                            >
                              <div className="min-w-0 pr-2">
                                <div className="text-xs font-semibold truncate">{areaName}</div>
                                {!isSidoarjoBranch && (
                                  <span className={`inline-block text-[9px] font-bold px-1.5 py-0.5 rounded border mt-0.5 ${meta.badgeColor}`}>
                                    {meta.label}
                                  </span>
                                )}
                              </div>
                              {isSelected ? (
                                <div className="w-5 h-5 rounded-full bg-[#2563EB] text-white flex items-center justify-center shrink-0">
                                  <Check className="w-3 h-3" />
                                </div>
                              ) : (
                                <span className="text-[10px] text-[#64748B] font-semibold">Pilih</span>
                              )}
                            </button>
                          );
                        })}
                        {filteredOfficialAreas.length === 0 && (
                          <div className="col-span-2 py-4 text-center text-xs text-[#64748B]">
                            Tidak ada area yang cocok dengan pencarian "{areaSearchFilter}"
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Opsi Tembus Jadwal Langsung Selesai (Khusus Akun Super Admin) */}
              {logisticsStore.getCurrentUser()?.role === 'super_admin' && (
                <div className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 flex items-start gap-3">
                  <Zap className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <label className="flex items-center gap-2.5 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={manualScheduleForm.bypassChecklistDirectComplete}
                        onChange={(e) => setManualScheduleForm({ ...manualScheduleForm, bypassChecklistDirectComplete: e.target.checked })}
                        className="rounded border-amber-400 text-[#2563EB] focus:ring-[#2563EB] w-4 h-4 cursor-pointer"
                      />
                      <span className="text-xs font-bold text-amber-800 dark:text-amber-300">
                        Tembus &amp; Simpan Langsung ke Riwayat Selesai (Bypass Checklist)
                      </span>
                    </label>
                    <p className="text-[11px] text-[#64748B] dark:text-amber-200/80 mt-1 leading-relaxed">
                      Khusus Super Admin: Centang opsi ini jika Anda menginput jadwal pengiriman masa lalu/lampau agar langsung berstatus Selesai (Terkirim) dan tercatat di histori tanpa harus mengisi checklist di portal supir.
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-end gap-2.5 pt-3.5 mt-4 border-t border-[#E2E8F0] dark:border-[#24344D] shrink-0">
              <button
                type="button"
                onClick={() => setIsUploadConfigModalOpen(false)}
                className="px-4 py-2.5 rounded-lg border border-[#CBD5E1] dark:border-[#334155] bg-white dark:bg-[#1E293B] hover:bg-[#F8FAFC] dark:hover:bg-[#24344D] text-[#475569] dark:text-[#CBD5E1] text-xs font-bold transition cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={() => {
                  setManualScheduleFormError(null);
                  const targetBranchId = effectiveActiveBranchId;
                  if (!canEditSchedules || !branchStore.canUserAccessBranch(currentUserProfile, targetBranchId)) {
                    setManualScheduleFormError('Anda tidak memiliki hak akses untuk membuat jadwal pada cabang ini.');
                    return;
                  }
                  if (!manualScheduleForm.driver.trim()) {
                    setManualScheduleFormError('Mohon pilih Driver / Supir terlebih dahulu.');
                    return;
                  }
                  if (!manualScheduleForm.armada.trim()) {
                    setManualScheduleFormError('Mohon pilih Armada Truk terlebih dahulu.');
                    return;
                  }
                  if (!manualScheduleForm.area.trim()) {
                    setManualScheduleFormError('Mohon pilih Area Kirim Tujuan terlebih dahulu.');
                    return;
                  }
                  const stdArea = standardizeAreaName(manualScheduleForm.area.trim(), targetBranchId);
                  const retIso = manualScheduleForm.returnDateIso || manualScheduleForm.dateIso;
                  const depIso = manualScheduleForm.departureDateIso || retIso;
                  const effectiveDateStr = retIso;
                  const armadaVal = manualScheduleForm.armada.trim();
                  const branchFleetsNow = getFleetsForBranch(targetBranchId);
                  const matchedFleetObj =
                    branchFleetsNow.find(
                      f =>
                        f.initialCode?.toUpperCase() === armadaVal.toUpperCase() ||
                        f.plateNumber.replace(/\s+/g, '').toUpperCase().includes(armadaVal.replace(/\s+/g, '').toUpperCase())
                    ) || logisticsStore.findFleetByCodeOrPlate(armadaVal);

                  if (
                    matchedFleetObj &&
                    !branchFleetsNow.some(f => f.id === matchedFleetObj.id) &&
                    branchStore.getFleetBranchId(matchedFleetObj.id, matchedFleetObj.plateNumber, matchedFleetObj.initialCode, matchedFleetObj.branchId) !== targetBranchId
                  ) {
                    const brErr = `Armada ${matchedFleetObj.initialCode || matchedFleetObj.plateNumber} bukan milik Cabang ${activeBranchRecord?.name || targetBranchId}.`;
                    setManualScheduleFormError(brErr);
                    setUploadToast({ type: 'error', message: brErr });
                    return;
                  }

                  const defaultWarehouse =
                    activeBranchRecord?.warehouseName ||
                    (targetBranchId === 'cab-sidoarjo' ? 'Gudang Sidoarjo' : 'Gudang Pusat AKK Banyuwangi DC');

                  const manualEntry: ParsedSheetTrip & { source: 'manual'; tempId: string; branchId: string; bypassChecklistDirectComplete?: boolean } = {
                    tempId: `man-direct-${Date.now()}`,
                    source: 'manual',
                    branchId: targetBranchId,
                    dateStr: effectiveDateStr,
                    departureDateIso: depIso,
                    returnDateIso: retIso,
                    driver: manualScheduleForm.driver.trim(),
                    helper: manualScheduleForm.helper.trim() || '-',
                    helper2: manualScheduleForm.helper2.trim() || '-',
                    area: stdArea,
                    armada: armadaVal,
                    target: manualScheduleForm.target.trim() || defaultWarehouse,
                    departureTime: manualScheduleForm.departureTime || '07:30',
                    targetReturnTime: manualScheduleForm.targetReturnTime || '17:00',
                    bypassChecklistDirectComplete: manualScheduleForm.bypassChecklistDirectComplete
                  };
                  const savedOk = mergeAndSaveCombinedTrips(
                    [manualEntry],
                    'tambahkan',
                    `Form Tambah Jadwal Baru (Cabang ${activeBranchRecord?.name || 'Nusantara'})`
                  );
                  if (!savedOk) return;
                  const initDrivers = getIntegratedDrivers(targetBranchId);
                  const initHelpers = getIntegratedHelpers(targetBranchId);
                  const today = getTodayIso();
                  setManualScheduleForm({
                    dateIso: today,
                    departureDateIso: today,
                    returnDateIso: today,
                    driver: initDrivers[0]?.name || '',
                    helper: initHelpers[0]?.name || '',
                    helper2: '',
                    area: '',
                    armada: '',
                    target: '',
                    departureTime: '07:30',
                    targetReturnTime: '17:00',
                    branchId: targetBranchId,
                    bypassChecklistDirectComplete: false
                  });
                  setAreaSearchFilter('');
                  setIsAreaPickerExpanded(false);
                  setIsUploadConfigModalOpen(false);
                }}
                className="px-5 py-2.5 rounded-lg bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-xs font-bold transition flex items-center gap-2 cursor-pointer"
              >
                <Save className="w-4 h-4" />
                <span>Simpan Jadwal Baru</span>
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Riwayat / Log Unggah & Perubahan Jadwal Modal */}
      {isHistoryModalOpen && (
        <div className="fixed inset-0 z-50 akk-flat-schedule flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs overflow-y-auto animate-in fade-in duration-200">
          <div className="bg-white dark:bg-[#162234] border border-[#E2E8F0] dark:border-[#24344D] rounded-2xl p-6 max-w-2xl w-full space-y-4 my-6">
            <div className="flex items-center justify-between border-b border-[#E2E8F0] dark:border-[#24344D] pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#EFF6FF] dark:bg-[#1E3A8A]/40 text-[#2563EB] dark:text-[#60A5FA] flex items-center justify-center border border-[#BFDBFE] dark:border-[#1E40AF]">
                  <HistoryIcon className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-[#0F172A] dark:text-[#F1F5F9]">Riwayat / Log Unggah &amp; Perubahan Jadwal</h3>
                  <p className="text-[11px] text-[#64748B] dark:text-[#94A3B8]">Catatan lengkap aktivitas unggah Excel, penambahan jadwal, dan rincian perubahan beserta nama pengguna</p>
                </div>
              </div>
              <button
                onClick={() => setIsHistoryModalOpen(false)}
                className="w-8 h-8 rounded-lg bg-[#F1F5F9] dark:bg-[#1E293B] hover:bg-[#E2E8F0] dark:hover:bg-[#24344D] text-[#64748B] hover:text-[#0F172A] dark:hover:text-white flex items-center justify-center transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs text-[#334155] dark:text-[#CBD5E1] max-h-[60vh] overflow-y-auto pr-1">
              {scheduleChangeLogs.length === 0 ? (
                <div className="p-8 text-center text-[#64748B] bg-[#F8FAFC] dark:bg-[#0F172A] rounded-xl border border-[#E2E8F0] dark:border-[#24344D]">
                  Belum ada riwayat unggah atau perubahan jadwal.
                </div>
              ) : (
                scheduleChangeLogs.map((log) => {
                  const dateFormatted = new Date(log.timestamp).toLocaleString('id-ID', {
                    day: '2-digit',
                    month: 'short',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                  });
                  const badgeStyle =
                    log.actionType === 'upload_excel'
                      ? 'bg-[#EFF6FF] dark:bg-[#1E3A8A]/40 text-[#2563EB] dark:text-[#60A5FA] border-[#BFDBFE] dark:border-[#1E40AF]'
                      : log.actionType === 'manual_create'
                      ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
                      : log.actionType === 'manual_edit'
                      ? 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800'
                      : 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800';

                  const badgeLabel =
                    log.actionType === 'upload_excel'
                      ? 'Unggah Excel'
                      : log.actionType === 'manual_create'
                      ? 'Tambah Jadwal'
                      : log.actionType === 'manual_edit'
                      ? 'Edit Jadwal'
                      : 'Hapus Jadwal';

                  return (
                    <div key={log.id} className="bg-[#F8FAFC] dark:bg-[#0F172A] p-4 rounded-xl border border-[#E2E8F0] dark:border-[#24344D] space-y-2.5">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-[#0F172A] dark:text-[#F1F5F9] text-xs">{log.fileName}</span>
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${badgeStyle}`}>
                              {badgeLabel}
                            </span>
                          </div>
                          <div className="text-[11px] text-[#64748B] dark:text-[#94A3B8] mt-1 flex items-center gap-2 flex-wrap">
                            <span>{dateFormatted} WIB</span>
                            <span>&bull;</span>
                            <span className="text-[#2563EB] dark:text-[#60A5FA] font-bold">
                              Oleh: {log.userName} ({log.userRole})
                            </span>
                            {typeof log.rowCount === 'number' && (
                              <>
                                <span>&bull;</span>
                                <span className="font-mono text-[#334155] dark:text-[#CBD5E1]">{log.rowCount} Baris Tervalidasi</span>
                              </>
                            )}
                          </div>
                        </div>
                        <span className="px-2.5 py-0.5 rounded-md text-[10px] font-bold bg-[#EFF6FF] dark:bg-[#1E3A8A]/40 text-[#2563EB] dark:text-[#60A5FA] border border-[#BFDBFE] dark:border-[#1E40AF] w-fit">
                          Tersimpan
                        </span>
                      </div>

                      <div className="text-xs text-[#0F172A] dark:text-[#E2E8F0] font-semibold border-t border-[#E2E8F0] dark:border-[#24344D] pt-2">
                        {log.summary}
                      </div>

                      {log.changes && log.changes.length > 0 && (
                        <div className="bg-white dark:bg-[#162234] rounded-lg p-2.5 border border-[#E2E8F0] dark:border-[#24344D] space-y-1">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-[#2563EB] dark:text-[#60A5FA] block">
                            Rincian Perubahan:
                          </span>
                          <ul className="space-y-1 text-[11px] text-[#475569] dark:text-[#CBD5E1] list-disc list-inside">
                            {log.changes.map((chg, idx) => (
                              <li key={idx} className="leading-relaxed">{chg}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>

            <div className="pt-3 flex justify-end border-t border-[#E2E8F0] dark:border-[#24344D]">
              <button
                onClick={() => setIsHistoryModalOpen(false)}
                className="px-4 py-2 rounded-lg border border-[#CBD5E1] dark:border-[#334155] bg-white dark:bg-[#1E293B] hover:bg-[#F8FAFC] dark:hover:bg-[#24344D] text-[#334155] dark:text-[#CBD5E1] text-xs font-bold transition cursor-pointer"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 5. Upload Preview Modal with Validation & Intelligent Area Auto-Mapping */}
      {isUploadModalOpen && (
        <div className="fixed inset-0 z-50 akk-flat-schedule flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs overflow-y-auto animate-in fade-in duration-200">
          <div className="bg-white dark:bg-[#162234] border border-[#E2E8F0] dark:border-[#24344D] rounded-2xl p-6 max-w-4xl w-full space-y-4 my-6">
            <div className="flex items-center justify-between border-b border-[#E2E8F0] dark:border-[#24344D] pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#2563EB] text-white flex items-center justify-center">
                  <FileSpreadsheet className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-[#0F172A] dark:text-[#F1F5F9]">Pratinjau, Validasi &amp; Pemetaan Spreadsheet</h3>
                  <p className="text-xs text-[#64748B] dark:text-[#94A3B8]">{uploadedFileName}</p>
                </div>
              </div>

              <button
                onClick={() => setIsUploadModalOpen(false)}
                className="w-8 h-8 rounded-lg bg-[#F1F5F9] dark:bg-[#1E293B] hover:bg-[#E2E8F0] dark:hover:bg-[#24344D] text-[#64748B] hover:text-[#0F172A] dark:hover:text-white flex items-center justify-center transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Tab switchers */}
            <div className="flex items-center gap-2 border-b border-[#E2E8F0] dark:border-[#24344D] pb-3 flex-wrap">
              <button
                type="button"
                onClick={() => setActiveUploadTab('audit')}
                className={`px-3.5 py-2 rounded-lg text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
                  activeUploadTab === 'audit'
                    ? 'bg-[#2563EB] text-white'
                    : 'bg-[#F1F5F9] dark:bg-[#1E293B] text-[#475569] dark:text-[#CBD5E1] hover:bg-[#E2E8F0]'
                }`}
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Audit &amp; Validasi Format</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveUploadTab('area_mapping')}
                className={`px-3.5 py-2 rounded-lg text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
                  activeUploadTab === 'area_mapping'
                    ? 'bg-[#2563EB] text-white'
                    : 'bg-[#F1F5F9] dark:bg-[#1E293B] text-[#475569] dark:text-[#CBD5E1] hover:bg-[#E2E8F0]'
                }`}
              >
                <MapPin className="w-3.5 h-3.5" />
                <span>Pemetaan Area Cerdas</span>
                {Object.values(detectedAreaMappings).some(m => m.confidence === 'unmapped') ? (
                  <span className="px-2 py-0.5 rounded-md text-[10px] bg-rose-500 text-white font-bold">
                    {Object.values(detectedAreaMappings).filter(m => m.confidence === 'unmapped').length} Belum Dikenali
                  </span>
                ) : (
                  <span className={`px-2 py-0.5 rounded-md text-[10px] font-mono ${
                    activeUploadTab === 'area_mapping' ? 'bg-white/20 text-white' : 'bg-[#EFF6FF] dark:bg-[#1E3A8A]/40 text-[#2563EB] dark:text-[#60A5FA]'
                  }`}>
                    {Object.keys(detectedAreaMappings).length} Area Terpetakan
                  </span>
                )}
              </button>

              <button
                type="button"
                onClick={() => setActiveUploadTab('crew_mapping')}
                className={`px-3.5 py-2 rounded-lg text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
                  activeUploadTab === 'crew_mapping'
                    ? 'bg-[#2563EB] text-white'
                    : 'bg-[#F1F5F9] dark:bg-[#1E293B] text-[#475569] dark:text-[#CBD5E1] hover:bg-[#E2E8F0]'
                }`}
              >
                <Users className="w-3.5 h-3.5" />
                <span>Pemetaan Kru Pengirim</span>
                {Object.values(detectedCrewMappings).some(m => m.confidence === 'unmapped') ? (
                  <span className="px-2 py-0.5 rounded-md text-[10px] bg-rose-500 text-white font-bold">
                    {Object.values(detectedCrewMappings).filter(m => m.confidence === 'unmapped').length} Belum Dikenali
                  </span>
                ) : (
                  <span className={`px-2 py-0.5 rounded-md text-[10px] font-mono ${
                    activeUploadTab === 'crew_mapping' ? 'bg-white/20 text-white' : 'bg-[#EFF6FF] dark:bg-[#1E3A8A]/40 text-[#2563EB] dark:text-[#60A5FA]'
                  }`}>
                    {Object.keys(detectedCrewMappings).length} Kru Terpetakan
                  </span>
                )}
              </button>
            </div>

            {/* Tab Content 1: Audit */}
            {activeUploadTab === 'audit' && (
              <div className="space-y-4">
                {uploadedValidationReport ? (
                  <div className="bg-[#F8FAFC] dark:bg-[#0F172A] p-4 rounded-xl border border-[#E2E8F0] dark:border-[#24344D] space-y-3 text-xs text-[#334155] dark:text-[#CBD5E1]">
                    <div className="flex items-center justify-between">
                      <span className="text-[#64748B] dark:text-[#94A3B8]">Total Baris Terdeteksi:</span>
                      <span className="font-bold text-[#0F172A] dark:text-[#F1F5F9]">{uploadedValidationReport.totalRows} baris</span>
                    </div>

                    <div className="grid grid-cols-3 gap-2.5 pt-2 border-t border-[#E2E8F0] dark:border-[#24344D]">
                      <div className="bg-emerald-50 dark:bg-emerald-950/30 p-2.5 rounded-lg border border-emerald-200 dark:border-emerald-800 text-center">
                        <span className="text-[10px] text-emerald-700 dark:text-emerald-400 font-bold block">Lolos</span>
                        <span className="text-base font-bold text-emerald-700 dark:text-emerald-300 tabular-nums">{uploadedValidationReport.validCount}</span>
                      </div>

                      <div className="bg-amber-50 dark:bg-amber-950/30 p-2.5 rounded-lg border border-amber-200 dark:border-amber-800 text-center">
                        <span className="text-[10px] text-amber-700 dark:text-amber-400 font-bold block">Duplikat</span>
                        <span className="text-base font-bold text-amber-700 dark:text-amber-300 tabular-nums">{uploadedValidationReport.duplicateCount}</span>
                      </div>

                      <div className="bg-rose-50 dark:bg-rose-950/30 p-2.5 rounded-lg border border-rose-200 dark:border-rose-800 text-center">
                        <span className="text-[10px] text-rose-700 dark:text-rose-400 font-bold block">Format Salah</span>
                        <span className="text-base font-bold text-rose-700 dark:text-rose-300 tabular-nums">
                          {uploadedValidationReport.invalidDateCount + uploadedValidationReport.invalidPoCount + uploadedValidationReport.missingFieldCount}
                        </span>
                      </div>
                    </div>

                    <div className="pt-2 border-t border-[#E2E8F0] dark:border-[#24344D] space-y-2 text-[11px]">
                      <div className="flex items-start gap-2 text-[#2563EB] dark:text-[#60A5FA] bg-[#EFF6FF] dark:bg-[#1E3A8A]/30 p-3 rounded-xl border border-[#BFDBFE] dark:border-[#1E40AF]">
                        <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                        <div>
                          <span className="font-bold block">Mode Sistem Rotasi Area Berputar Aktif</span>
                          <span className="text-[#475569] dark:text-[#CBD5E1] text-[10px]">
                            Semua {uploadedValidationReport.validCount} jadwal pengiriman tervalidasi sebagai rotasi area berputar yang sah dan siap disinkronkan (overwrite otomatis).
                          </span>
                        </div>
                      </div>

                      <label className="flex items-center gap-2 text-[#334155] dark:text-[#CBD5E1] cursor-pointer pt-1">
                        <input
                          type="checkbox"
                          checked={skipInvalidUpload}
                          onChange={(e) => setSkipInvalidUpload(e.target.checked)}
                          className="rounded text-[#2563EB] focus:ring-[#2563EB]"
                        />
                        <span>Tolak baris jika ada format tanggal atau PO yang rusak / tidak valid</span>
                      </label>
                    </div>
                  </div>
                ) : (
                  <div className="bg-[#F8FAFC] dark:bg-[#0F172A] p-4 rounded-xl border border-[#E2E8F0] dark:border-[#24344D] space-y-2 text-xs text-[#334155] dark:text-[#CBD5E1]">
                    <div className="flex justify-between">
                      <span className="text-[#64748B]">Total Baris:</span>
                      <span className="font-bold text-[#0F172A] dark:text-[#F1F5F9]">{uploadedRowsCount} baris</span>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Tab Content 2: Area Auto-Mapping Section */}
            {activeUploadTab === 'area_mapping' && (
              <div className="max-h-[60vh] overflow-y-auto pr-1">
                <AreaAutoMappingSection
                  areaMappings={detectedAreaMappings}
                  officialAreas={officialAreasList}
                  onMappingChange={handleMappingChange}
                  onRequestCreateArea={(rawArea) => setQuickCreateAreaTarget(rawArea)}
                />
              </div>
            )}

            {/* Tab Content 3: Crew Auto-Mapping Section */}
            {activeUploadTab === 'crew_mapping' && (
              <div className="max-h-[60vh] overflow-y-auto pr-1">
                <CrewAutoMappingSection
                  crewMappings={detectedCrewMappings}
                  officialCrews={officialCrewsList}
                  onMappingChange={handleCrewMappingChange}
                  onRequestCreateCrew={(rawCrew, roleHint) => setQuickCreateCrewTarget({ name: rawCrew, roleHint })}
                />
              </div>
            )}

            <div className="flex items-center justify-between gap-2.5 pt-3 border-t border-[#E2E8F0] dark:border-[#24344D]">
              <div className="text-xs text-[#64748B] dark:text-[#94A3B8]">
                {Object.values(detectedAreaMappings).some(m => m.confidence === 'unmapped') || Object.values(detectedCrewMappings).some(m => m.confidence === 'unmapped') ? (
                  <span className="text-amber-600 dark:text-amber-400 font-semibold flex items-center gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    <span>Tip: Lengkapi pemetaan area &amp; kru sebelum konfirmasi sinkronisasi.</span>
                  </span>
                ) : (
                  <span className="text-[#2563EB] dark:text-[#60A5FA] font-semibold flex items-center gap-1.5">
                    <Check className="w-3.5 h-3.5" />
                    <span>Area &amp; Kru telah terharmonisasi dengan Jadwal serta Histori &amp; Otorisasi.</span>
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsUploadModalOpen(false)}
                  className="px-4 py-2 rounded-lg border border-[#CBD5E1] dark:border-[#334155] bg-white dark:bg-[#1E293B] hover:bg-[#F8FAFC] dark:hover:bg-[#24344D] text-[#334155] dark:text-[#CBD5E1] text-xs font-bold transition cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const mappingDict: Record<string, string> = {};
                    Object.entries(detectedAreaMappings).forEach(([k, v]) => {
                      if (v.matchedOfficialArea) mappingDict[k] = v.matchedOfficialArea;
                    });

                    const crewMappingDict: Record<string, string> = {};
                    Object.entries(detectedCrewMappings).forEach(([k, v]) => {
                      if (v.matchedCrewName) crewMappingDict[k] = v.matchedCrewName;
                    });

                    if (uploadedValidationReport) {
                      const syncRes = scheduleImportValidator.syncValidatedItems(uploadedValidationReport.items, {
                        skipDuplicates: skipDuplicatesUpload,
                        skipInvalid: skipInvalidUpload,
                        customAreaMapping: mappingDict,
                        customCrewMapping: crewMappingDict
                      });
                      logisticsStore.syncSchedulesToCrewHistory();

                      const sampleChanges = parsedUploadedTrips.slice(0, 4).map(t =>
                        `Rute ${t.dateStr || ''}: Driver ${crewMappingDict[t.driver] || t.driver} | Helper ${t.helper || '-'} | Area ${mappingDict[t.area] || t.area} | Armada ${t.armada}`
                      );
                      logisticsStore.addScheduleChangeLog({
                        fileName: uploadedFileName || 'Spreadsheet_Jadwal_AKK.xlsx',
                        actionType: 'upload_excel',
                        summary: `Unggah & sinkronisasi ${syncRes.syncedCount + syncRes.overwrittenCount} jadwal pengiriman (${importMode === 'ganti' ? 'Mode Ganti Data' : 'Mode Tambah Data'})`,
                        rowCount: uploadedValidationReport.validCount,
                        changes: [
                          `${syncRes.syncedCount} jadwal baru ditambahkan, ${syncRes.overwrittenCount} jadwal diperbarui`,
                          `Pemetaan: ${Object.keys(detectedAreaMappings).length} area kirim & ${Object.keys(detectedCrewMappings).length} kru terhubung`,
                          ...sampleChanges
                        ]
                      });
                      setScheduleChangeLogs(logisticsStore.getScheduleChangeLogs());

                      setIsUploadModalOpen(false);
                      const msg = `Berhasil menyinkronkan ${syncRes.syncedCount + syncRes.overwrittenCount} jadwal pengiriman valid! Riwayat perubahan tercatat.`;
                      setSyncSuccessMessage(msg);
                      if (onSyncComplete) onSyncComplete(syncRes.syncedCount + syncRes.overwrittenCount);
                      setTimeout(() => setSyncSuccessMessage(null), 8000);
                    } else {
                      setIsUploadModalOpen(false);
                      handleSyncToOperationalSchedules();
                    }
                  }}
                  className="px-4 py-2 rounded-lg bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-xs font-bold transition flex items-center gap-2 cursor-pointer"
                >
                  <Sparkles className="w-4 h-4" />
                  <span>Sinkronkan {uploadedValidationReport ? uploadedValidationReport.validCount : uploadedRowsCount} Jadwal</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 6. Simplified Area & Crew Mapping Modal */}
      {isAreaMappingModalOpen && (
        <div className="fixed inset-0 z-50 akk-flat-schedule flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs overflow-y-auto animate-in fade-in duration-200">
          <div className="bg-white dark:bg-[#162234] border border-[#E2E8F0] dark:border-[#24344D] rounded-2xl p-6 max-w-3xl w-full space-y-4 my-6">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-[#E2E8F0] dark:border-[#24344D] pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-[#EFF6FF] dark:bg-[#1E3A8A]/40 text-[#2563EB] dark:text-[#60A5FA] border border-[#BFDBFE] dark:border-[#1E40AF]">
                  {activeMappingCategory === 'area' ? <MapPin className="w-5 h-5" /> : <Users className="w-5 h-5" />}
                </div>
                <div>
                  <h3 className="text-sm font-bold text-[#0F172A] dark:text-[#F1F5F9]">
                    {activeMappingCategory === 'area' ? 'Pemetaan Area Kirim' : 'Pemetaan Kru (Driver & Helper)'}
                  </h3>
                  <p className="text-[11px] text-[#64748B] dark:text-[#94A3B8]">
                    {activeMappingCategory === 'area'
                      ? 'Selaraskan nama area di Excel dengan daftar area kirim resmi'
                      : 'Terintegrasi dengan Data Kru & Supir serta User Manajemen'}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {activeMappingCategory === 'area' ? (
                  <button
                    type="button"
                    onClick={() => setQuickCreateAreaTarget('AREA BARU')}
                    className="px-3 py-1.5 rounded-lg bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-xs font-bold transition flex items-center gap-1 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Area Baru</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setQuickCreateCrewTarget({ name: '', roleHint: 'Driver' })}
                    className="px-3 py-1.5 rounded-lg bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-xs font-bold transition flex items-center gap-1 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Kru Baru</span>
                  </button>
                )}
                <button
                  onClick={() => setIsAreaMappingModalOpen(false)}
                  className="w-8 h-8 rounded-lg bg-[#F1F5F9] dark:bg-[#1E293B] hover:bg-[#E2E8F0] dark:hover:bg-[#24344D] text-[#64748B] hover:text-[#0F172A] dark:hover:text-white flex items-center justify-center transition cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Category Selector Tabs */}
            <div className="flex items-center gap-2 p-1 bg-[#F1F5F9] dark:bg-[#0F172A] rounded-xl border border-[#E2E8F0] dark:border-[#24344D]">
              <button
                type="button"
                onClick={() => setActiveMappingCategory('area')}
                className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                  activeMappingCategory === 'area'
                    ? 'bg-[#2563EB] text-white'
                    : 'text-[#64748B] dark:text-[#94A3B8] hover:text-[#0F172A] dark:hover:text-white'
                }`}
              >
                <MapPin className="w-3.5 h-3.5" />
                <span>Pemetaan Area ({Object.keys(detectedAreaMappings).length})</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveMappingCategory('crew')}
                className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                  activeMappingCategory === 'crew'
                    ? 'bg-[#2563EB] text-white'
                    : 'text-[#64748B] dark:text-[#94A3B8] hover:text-[#0F172A] dark:hover:text-white'
                }`}
              >
                <Users className="w-3.5 h-3.5" />
                <span>Pemetaan Kru ({Object.keys(detectedCrewMappings).length})</span>
              </button>
            </div>

            {/* Content Section */}
            <div className="max-h-[60vh] overflow-y-auto pr-1">
              {activeMappingCategory === 'area' ? (
                <AreaAutoMappingSection
                  areaMappings={detectedAreaMappings}
                  officialAreas={officialAreasList}
                  onMappingChange={handleMappingChange}
                  onRequestCreateArea={(rawArea) => setQuickCreateAreaTarget(rawArea)}
                />
              ) : (
                <CrewAutoMappingSection
                  crewMappings={detectedCrewMappings}
                  officialCrews={officialCrewsList}
                  onMappingChange={handleCrewMappingChange}
                  onRequestCreateCrew={(rawCrew, roleHint) => setQuickCreateCrewTarget({ name: rawCrew, roleHint })}
                />
              )}
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-[#E2E8F0] dark:border-[#24344D] text-xs">
              <span className="text-[#64748B] dark:text-[#94A3B8]">
                {activeMappingCategory === 'area' ? (
                  <>Area Resmi Terdaftar: <strong className="text-[#0F172A] dark:text-[#F1F5F9]">{officialAreasList.length}</strong> area</>
                ) : (
                  <>Kru Terdaftar (Aktif &amp; Nonaktif): <strong className="text-[#0F172A] dark:text-[#F1F5F9]">{officialCrewsList.length}</strong> kru</>
                )}
              </span>
              <button
                type="button"
                onClick={() => setIsAreaMappingModalOpen(false)}
                className="px-4 py-2 rounded-lg border border-[#CBD5E1] dark:border-[#334155] bg-white dark:bg-[#1E293B] hover:bg-[#F8FAFC] dark:hover:bg-[#24344D] text-[#334155] dark:text-[#CBD5E1] text-xs font-bold transition cursor-pointer"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 7. Quick Create Area Modal Dialog */}
      <QuickCreateAreaModal
        isOpen={quickCreateAreaTarget !== null}
        onClose={() => setQuickCreateAreaTarget(null)}
        rawAreaName={quickCreateAreaTarget || ''}
        onAreaCreated={handleAreaCreated}
      />

      {/* 8. Quick Create Crew Modal Dialog */}
      <QuickCreateCrewModal
        isOpen={quickCreateCrewTarget !== null}
        onClose={() => setQuickCreateCrewTarget(null)}
        rawCrewName={quickCreateCrewTarget?.name || ''}
        roleHint={quickCreateCrewTarget?.roleHint || 'Driver'}
        onCrewCreated={handleCrewCreated}
      />

      {/* 9. Google Sheets API v4 Live Sync Modal */}
      <GoogleSheetsApiSyncModal
        isOpen={isApiSyncModalOpen}
        onClose={() => setIsApiSyncModalOpen(false)}
        onSyncComplete={(count) => {
          setSyncSuccessMessage(`Berhasil menyinkronkan ${count} rute pengiriman langsung dari Google Sheets API v4!`);
          if (onSyncComplete) onSyncComplete(count);
          setTimeout(() => setSyncSuccessMessage(null), 8000);
        }}
      />

      {/* Excel Top 5 Rows Preview Modal */}
      {isExcelPreviewModalOpen && (
        <div className="fixed inset-0 z-50 akk-flat-schedule bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200 overflow-y-auto">
          <div className="w-full max-w-4xl bg-white dark:bg-[#162234] border border-[#E2E8F0] dark:border-[#24344D] rounded-2xl p-6 space-y-5 my-6">
            <div className="flex items-center justify-between pb-4 border-b border-[#E2E8F0] dark:border-[#24344D]">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#2563EB] text-white flex items-center justify-center">
                  <FileSpreadsheet className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-[#0F172A] dark:text-[#F1F5F9]">Pratinjau Spreadsheet (Semua Data sampai Bawah)</h3>
                  <p className="text-xs text-[#64748B] dark:text-[#94A3B8]">Verifikasi isi file sebelum diproses permanen ke sistem • {previewFile?.name} ({previewTotalRows} baris total, Sheet: {previewSheetName})</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsExcelPreviewModalOpen(false)}
                className="w-8 h-8 rounded-lg bg-[#F1F5F9] dark:bg-[#1E293B] hover:bg-[#E2E8F0] dark:hover:bg-[#24344D] text-[#64748B] hover:text-[#0F172A] dark:hover:text-white flex items-center justify-center transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="p-3 rounded-xl bg-[#EFF6FF] dark:bg-[#1E3A8A]/30 border border-[#BFDBFE] dark:border-[#1E40AF] text-[#1E40AF] dark:text-[#93C5FD]">
                <p className="font-semibold">Pastikan data di bawah ini sesuai dengan format roster operasional sebelum melanjutkan pemrosesan jadwal.</p>
              </div>

              <div className="overflow-x-auto border border-[#E2E8F0] dark:border-[#24344D] rounded-xl bg-white dark:bg-[#0F172A] max-h-[72vh]">
                <table className="w-full text-left border-collapse text-[11px]">
                  <thead>
                    <tr className="bg-[#F8FAFC] dark:bg-[#1E293B] border-b border-[#E2E8F0] dark:border-[#24344D] text-[#475569] dark:text-[#94A3B8]">
                      <th className="p-3 font-bold border-r border-[#E2E8F0] dark:border-[#24344D] w-12 text-center">#</th>
                      {previewHeaders.map((h, i) => (
                        <th key={i} className="p-3 font-bold border-r border-[#E2E8F0] dark:border-[#24344D] whitespace-nowrap">{h || `Kolom ${i+1}`}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E2E8F0] dark:divide-[#24344D] text-[#0F172A] dark:text-[#E2E8F0]">
                    {previewTopRows.length === 0 ? (
                      <tr>
                        <td colSpan={previewHeaders.length + 1} className="p-6 text-center text-[#64748B] italic">Tidak ada data baris ditemukan.</td>
                      </tr>
                    ) : (() => {
                      let activeDate = '';
                      return previewTopRows.map((row, rIdx) => {
                        const isSeparator = row.some(cell => String(cell).includes('---'));
                        if (isSeparator) {
                          return (
                            <tr key={rIdx} className="bg-[#F8FAFC] dark:bg-[#1E293B] border-y border-[#CBD5E1] dark:border-[#334155] text-[#64748B]">
                              <td colSpan={previewHeaders.length + 1} className="py-2.5 px-3 text-center font-mono text-[11px] font-bold tracking-wider">
                                PEMBATAS TANGGAL &amp; PENGELOMPOKAN PENGIRIMAN
                              </td>
                            </tr>
                          );
                        }
                        const firstCell = row[0] !== undefined && row[0] !== null ? String(row[0]).trim() : '';
                        if (firstCell && !firstCell.startsWith('-')) {
                          activeDate = firstCell;
                        }
                        const hasExplicitDate = Boolean(firstCell && !firstCell.startsWith('-'));

                        return (
                          <tr key={rIdx} className={`hover:bg-[#F8FAFC] dark:hover:bg-[#1E293B]/60 transition border-b border-[#E2E8F0] dark:border-[#24344D] ${hasExplicitDate ? 'border-t border-[#CBD5E1] dark:border-[#334155] bg-[#F8FAFC]/60 dark:bg-[#1E293B]/30' : ''}`}>
                            <td className="p-3 font-mono text-[#64748B] text-center border-r border-[#E2E8F0] dark:border-[#24344D]">{rIdx + 1}</td>
                            {previewHeaders.map((h, cIdx) => {
                              const cellVal = row[cIdx];
                              const hasVal = cellVal !== undefined && cellVal !== null && String(cellVal).trim() !== '';
                              const hUpper = (h || '').toUpperCase();

                              return (
                                <td key={cIdx} className="p-3 border-r border-[#E2E8F0] dark:border-[#24344D] whitespace-nowrap">
                                  {hasVal ? (
                                    <span className={
                                      hUpper.includes('TANGGAL')
                                        ? "font-semibold text-[#2563EB] dark:text-[#60A5FA] bg-[#EFF6FF] dark:bg-[#1E3A8A]/40 px-2 py-0.5 rounded border border-[#BFDBFE] dark:border-[#1E40AF]"
                                        : hUpper.includes('DRIVER') || hUpper.includes('SUPIR')
                                        ? "font-bold text-[#0F172A] dark:text-[#F1F5F9]"
                                        : hUpper.includes('AREA')
                                        ? "font-semibold text-[#1D4ED8] dark:text-[#93C5FD]"
                                        : hUpper.includes('ARMADA')
                                        ? "font-mono font-bold text-[#334155] dark:text-[#CBD5E1]"
                                        : ""
                                    }>
                                      {String(cellVal)}
                                    </span>
                                  ) : (
                                    hUpper.includes('TANGGAL') ? (
                                      <span className="text-[#64748B] text-[10px] italic">
                                        {activeDate || 'sesi hari'}
                                      </span>
                                    ) : (
                                      <span className="text-[#94A3B8]">-</span>
                                    )
                                  )}
                                </td>
                              );
                            })}
                          </tr>
                        );
                      });
                    })()}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-[#E2E8F0] dark:border-[#24344D]">
              <button
                type="button"
                onClick={() => setIsExcelPreviewModalOpen(false)}
                className="px-4 py-2.5 rounded-lg border border-[#CBD5E1] dark:border-[#334155] bg-white dark:bg-[#1E293B] hover:bg-[#F8FAFC] dark:hover:bg-[#24344D] text-[#334155] dark:text-[#CBD5E1] font-bold text-xs cursor-pointer transition"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={() => {
                  if (previewFile) executeFinalUpload(previewFile);
                }}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-[#2563EB] hover:bg-[#1D4ED8] text-white font-bold text-xs cursor-pointer transition"
              >
                <Sparkles className="w-4 h-4" />
                <span>Lanjutkan Proses &amp; Validasi ({previewTotalRows} Baris)</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 10. Spreadsheet Schema Validation Error / Warning Modal */}
      {schemaValidationError && (
        <div className="fixed inset-0 z-50 akk-flat-schedule bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-lg bg-white dark:bg-[#162234] border border-rose-200 dark:border-rose-900/60 rounded-2xl p-6 space-y-5">
            <div className="flex items-center justify-between pb-3.5 border-b border-[#E2E8F0] dark:border-[#24344D]">
              <div className="flex items-center gap-2.5 text-rose-600 dark:text-rose-400">
                <AlertTriangle className="w-5 h-5 shrink-0" />
                <h3 className="text-base font-bold text-[#0F172A] dark:text-[#F1F5F9]">{schemaValidationError.error || 'Format Kolom Tidak Sesuai'}</h3>
              </div>
              <button
                type="button"
                onClick={() => setSchemaValidationError(null)}
                className="p-1.5 rounded-lg text-[#64748B] hover:text-[#0F172A] dark:hover:text-white bg-[#F1F5F9] dark:bg-[#1E293B] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-200 space-y-1.5">
                <p className="font-bold">{schemaValidationError.message}</p>
                {schemaValidationError.missingColumns?.length > 0 && (
                  <p className="text-[11px] text-rose-600 dark:text-rose-300">
                    <span className="font-semibold">Kolom Wajib yang Belum Ada:</span> {schemaValidationError.missingColumns.join(', ')}
                  </p>
                )}
              </div>

              <div className="p-3.5 rounded-xl bg-[#F8FAFC] dark:bg-[#0F172A] border border-[#E2E8F0] dark:border-[#24344D] space-y-1.5">
                <span className="font-bold text-[#2563EB] dark:text-[#60A5FA] block">Panduan Format Kolom Standar:</span>
                <p className="font-mono text-[11px] text-[#334155] dark:text-[#CBD5E1] bg-white dark:bg-[#162234] p-2.5 rounded-lg border border-[#E2E8F0] dark:border-[#24344D]">
                  {schemaValidationError.correctFormat}
                </p>
              </div>

              {schemaValidationError.detectedHeaders?.length > 0 && (
                <div className="p-3.5 rounded-xl bg-[#F8FAFC] dark:bg-[#0F172A] border border-[#E2E8F0] dark:border-[#24344D] space-y-1">
                  <span className="font-semibold text-[#64748B] dark:text-[#94A3B8] block">Header yang Terdeteksi di File Anda:</span>
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {schemaValidationError.detectedHeaders.map((h: string, idx: number) => (
                      <span key={idx} className="px-2 py-0.5 rounded-md bg-white dark:bg-[#162234] border border-[#E2E8F0] dark:border-[#24344D] text-[#334155] dark:text-[#CBD5E1] font-mono text-[10px]">
                        {h}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center gap-3 pt-3 border-t border-[#E2E8F0] dark:border-[#24344D]">
              <button
                type="button"
                onClick={() => setSchemaValidationError(null)}
                className="flex-1 py-2.5 rounded-lg border border-[#CBD5E1] dark:border-[#334155] bg-white dark:bg-[#1E293B] hover:bg-[#F8FAFC] dark:hover:bg-[#24344D] text-[#334155] dark:text-[#CBD5E1] font-bold text-xs cursor-pointer transition"
              >
                Tutup &amp; Pilih File Lain
              </button>
              <button
                type="button"
                onClick={downloadScheduleTemplate}
                className="flex-1 py-2.5 rounded-lg bg-[#2563EB] hover:bg-[#1D4ED8] text-white font-bold text-xs flex items-center justify-center gap-2 cursor-pointer transition"
              >
                <Download className="w-4 h-4" />
                <span>Unduh Template .XLSX Standar</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Pop-Up Modal Konfirmasi Tembus Status Selesai (Bypass Checklist Super Admin) */}
      {bypassConfirmModal && (
        <div className="fixed inset-0 z-60 akk-flat-schedule flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white dark:bg-[#162234] border border-[#E2E8F0] dark:border-[#24344D] rounded-2xl p-6 max-w-md w-full space-y-5">
            <div className="flex items-start gap-3.5">
              <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-800 shrink-0">
                <Zap className="w-5 h-5 fill-current" />
              </div>
              <div className="space-y-1 min-w-0">
                <div className="text-[10px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">
                  Akses Khusus Super Admin
                </div>
                <h3 className="text-base font-bold text-[#0F172A] dark:text-[#F1F5F9]">
                  Tembus Status Selesai Tanpa Checklist?
                </h3>
                <p className="text-xs text-[#64748B] dark:text-[#94A3B8] leading-relaxed">
                  Jadwal pengiriman armada ini akan langsung diubah ke status <strong>Selesai (Delivered)</strong> dan disimpan ke riwayat tanpa melalui checklist supir.
                </p>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-[#F8FAFC] dark:bg-[#0F172A] border border-[#E2E8F0] dark:border-[#24344D] space-y-2 text-xs">
              <div className="flex justify-between items-center text-[#64748B] dark:text-[#94A3B8]">
                <span className="font-semibold">Area Tujuan:</span>
                <span className="font-bold text-[#2563EB] dark:text-[#60A5FA]">{bypassConfirmModal.p.area}</span>
              </div>
              <div className="flex justify-between items-center text-[#64748B] dark:text-[#94A3B8]">
                <span className="font-semibold">Driver / Supir:</span>
                <span className="font-bold text-[#0F172A] dark:text-[#F1F5F9]">{bypassConfirmModal.p.driver}</span>
              </div>
              <div className="flex justify-between items-center text-[#64748B] dark:text-[#94A3B8]">
                <span className="font-semibold">Armada:</span>
                <span className="font-bold text-[#0F172A] dark:text-[#F1F5F9]">{bypassConfirmModal.p.armada}</span>
              </div>
            </div>

            <div className="flex items-center gap-3 pt-1">
              <button
                type="button"
                onClick={() => setBypassConfirmModal(null)}
                className="flex-1 py-2.5 px-4 rounded-lg border border-[#CBD5E1] dark:border-[#334155] bg-white hover:bg-[#F8FAFC] dark:bg-[#1E293B] dark:hover:bg-[#24344D] text-[#475569] dark:text-[#CBD5E1] font-bold text-xs transition cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                autoFocus
                onClick={async () => {
                  const { schId, p, matchedSch } = bypassConfirmModal;
                  setBypassConfirmModal(null);
                  
                  const adminName = logisticsStore.getCurrentUser()?.fullName || "Super Admin";
                  const nowIso = new Date().toISOString();

                  const resolvedSch =
                    matchedSch ||
                    logisticsStore.getSchedules().find(s =>
                      s.id === schId ||
                      (p.id && s.id === p.id) ||
                      (s.trackingNumber && s.trackingNumber === schId)
                    );

                  let payloadSchedule: Schedule | undefined;
                  if (resolvedSch) {
                    const deliveredSchedule: Schedule = {
                      ...resolvedSch,
                      status: "delivered",
                      actualDeparture: resolvedSch.actualDeparture || resolvedSch.departureDate || nowIso,
                      actualArrival: resolvedSch.actualArrival || resolvedSch.estimatedArrival || nowIso,
                      isChecklistBypassed: true,
                      checklistBypassedBy: adminName,
                      checklistBypassedAt: nowIso,
                      updatedAt: nowIso
                    };
                    payloadSchedule = deliveredSchedule;
                    logisticsStore.updateSchedule(resolvedSch.id, deliveredSchedule);
                    try {
                      const wb = driverWaybillService.getWaybillForSchedule(deliveredSchedule);
                      driverWaybillService.updateWaybillStatus(wb.id, "delivered", "Bypass Checklist Super Admin");
                    } catch (e) {}
                  }

                  const effectiveMo = selectedMonth === -1 ? new Date().getMonth() : selectedMonth;
                  setWeeks(convertSchedulesToAdminWeeks(logisticsStore.getSchedules(), selectedYear, effectiveMo));

                  logisticsStore.addScheduleChangeLog({
                    actionType: "manual_edit",
                    fileName: `Bypass Checklist Admin (${p.area})`,
                    userName: adminName,
                    userRole: "Super Admin",
                    summary: `Tembus jadwal ${p.area} tanpa checklist`,
                    changes: [
                      `Jadwal ${p.area} berhasil ditembus dan disimpan ke status Selesai tanpa checklist oleh Super Admin.`
                    ]
                  });

                  setSyncSuccessMessage(`Jadwal ${p.area} (${p.driver}) berhasil ditembus & disimpan ke status Terkirim (Selesai).`);
                  setTimeout(() => setSyncSuccessMessage(null), 5000);

                  try {
                    const targetEndpointId = resolvedSch?.id || schId;
                    await fetch(`/api/schedules/${encodeURIComponent(targetEndpointId)}/bypass-checklist`, {
                      method: "POST",
                      credentials: "same-origin",
                      headers: logisticsStore.buildSessionAuthHeaders({ "Content-Type": "application/json" }),
                      body: JSON.stringify({
                        note: `Input histori jadwal ${p.area}`,
                        postTripFleetStatus: "available",
                        schedule: payloadSchedule
                      })
                    });
                    void persistSchedulesToDatabase(logisticsStore.getSchedules(), undefined, { source: "bypass_checklist" });
                  } catch (netErr) {
                    console.warn("[Bypass Checklist Admin Sync Warning]", netErr);
                  }
                }}
                className="flex-1 py-2.5 px-4 rounded-lg bg-[#2563EB] hover:bg-[#1D4ED8] text-white font-bold text-xs transition cursor-pointer flex items-center justify-center gap-1.5"
              >
                <Zap className="w-3.5 h-3.5 fill-current" />
                <span>Ya, Tembus Selesai</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Pop-Up Modal Konfirmasi Hapus Jadwal */}
      {deleteConfirmModal && (
        <div className="fixed inset-0 z-50 akk-flat-schedule flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white dark:bg-[#162234] border border-[#E2E8F0] dark:border-[#24344D] rounded-2xl p-6 max-w-md w-full space-y-5">
            <div className="flex items-start gap-3.5">
              <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-800 shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-bold text-[#0F172A] dark:text-[#F1F5F9]">
                  Konfirmasi Hapus Jadwal
                </h3>
                <p className="text-xs text-[#64748B] dark:text-[#94A3B8] leading-relaxed">
                  Apakah Anda yakin ingin menghapus ritase pengiriman ini dari jadwal operasional? Data yang dihapus akan tersinkronisasi ke riwayat kru dan dashboard.
                </p>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-[#F8FAFC] dark:bg-[#0F172A] border border-[#E2E8F0] dark:border-[#24344D] space-y-2 text-xs">
              <div className="flex justify-between items-center text-[#64748B] dark:text-[#94A3B8]">
                <span className="font-semibold">Tanggal Kirim:</span>
                <span className="font-bold text-[#0F172A] dark:text-[#F1F5F9]">{deleteConfirmModal.dateString}</span>
              </div>
              <div className="flex justify-between items-center text-[#64748B] dark:text-[#94A3B8]">
                <span className="font-semibold">Driver:</span>
                <span className="font-bold text-[#0F172A] dark:text-[#F1F5F9]">{deleteConfirmModal.p.driver}</span>
              </div>
              <div className="flex justify-between items-center text-[#64748B] dark:text-[#94A3B8]">
                <span className="font-semibold">Area Tujuan:</span>
                <span className="font-bold text-[#2563EB] dark:text-[#60A5FA]">{deleteConfirmModal.p.area}</span>
              </div>
              <div className="flex justify-between items-center text-[#64748B] dark:text-[#94A3B8]">
                <span className="font-semibold">Armada:</span>
                <span className="font-bold text-[#0F172A] dark:text-[#F1F5F9]">{deleteConfirmModal.p.armada}</span>
              </div>
            </div>

            <div className="flex items-center gap-3 pt-1">
              <button
                type="button"
                onClick={() => setDeleteConfirmModal(null)}
                className="flex-1 py-2.5 px-4 rounded-lg border border-[#CBD5E1] dark:border-[#334155] bg-white hover:bg-[#F8FAFC] dark:bg-[#1E293B] dark:hover:bg-[#24344D] text-[#475569] dark:text-[#CBD5E1] font-bold text-xs transition cursor-pointer"
              >
                Tidak, Batal
              </button>
              <button
                type="button"
                autoFocus
                onClick={() => {
                  handleDeleteTrip(
                    deleteConfirmModal.p,
                    deleteConfirmModal.dayNumber,
                    deleteConfirmModal.tripIndex
                  );
                  setDeleteConfirmModal(null);
                }}
                className="flex-1 py-2.5 px-4 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs transition cursor-pointer"
              >
                Ya, Hapus Jadwal
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Floating Toast Notification for Upload Validation */}
      {uploadToast && (
        <div className="fixed bottom-6 right-6 z-50 max-w-md w-full bg-white dark:bg-[#162234] border border-[#E2E8F0] dark:border-[#24344D] text-[#0F172A] dark:text-[#F1F5F9] rounded-xl p-4 shadow-sm flex items-start gap-3 animate-in fade-in slide-in-from-bottom-5 duration-200">
          <div className={`p-2 rounded-lg shrink-0 ${uploadToast.type === 'error' ? 'bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400' : 'bg-[#EFF6FF] dark:bg-[#1E3A8A]/40 text-[#2563EB] dark:text-[#60A5FA]'}`}>
            {uploadToast.type === 'error' ? <AlertTriangle className="w-5 h-5" /> : <CheckCircle2 className="w-5 h-5" />}
          </div>
          <div className="flex-1 space-y-1">
            <div className="flex items-center justify-between">
              <span className={`text-xs font-bold uppercase tracking-wider ${uploadToast.type === 'error' ? 'text-rose-600 dark:text-rose-400' : 'text-[#2563EB] dark:text-[#60A5FA]'}`}>
                {uploadToast.type === 'error' ? 'Gagal Unggah Spreadsheet' : 'Berhasil'}
              </span>
              <button
                type="button"
                onClick={() => setUploadToast(null)}
                className="text-[#64748B] hover:text-[#0F172A] dark:hover:text-white p-1 rounded-lg hover:bg-[#F1F5F9] dark:hover:bg-[#1E293B] transition cursor-pointer"
                title="Tutup Notifikasi"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-[#475569] dark:text-[#CBD5E1] font-medium">{uploadToast.message}</p>
            {uploadToast.type === 'error' && (
              <div className="pt-2 flex items-center gap-2">
                <button
                  type="button"
                  onClick={downloadScheduleTemplate}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#2563EB] hover:bg-[#1D4ED8] text-white font-bold text-[11px] transition cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Unduh Template Excel Benar</span>
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};