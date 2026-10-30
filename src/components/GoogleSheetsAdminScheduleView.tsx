import React, { useState, useMemo, useRef, useEffect } from 'react';
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
  Info,
  MapPin,
  Ship,
  User,
  Send,
  X,
  Plus,
  History as HistoryIcon,
  Edit,
  Trash2,
  Save,
  Zap,
  Building2
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { branchStore, BranchRecord } from '../services/branchStore';
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
import { standardizeAreaName, getAreaSubDetail, OFFICIAL_DESTINATION_AREAS } from '../utils/areaNormalizer';
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

interface CrewOptionItem {
  id: string;
  name: string;
  hasAccount?: boolean;
}

const CrewCustomSelectDropdown: React.FC<{
  label: string;
  value: string;
  options: CrewOptionItem[];
  onChange: (newValue: string) => void;
  emptyLabel?: string;
  emptyValue?: string;
  roleBadgeText: string;
  accentColor?: 'blue' | 'emerald';
}> = ({
  label,
  value,
  options,
  onChange,
  emptyLabel,
  emptyValue = '',
  roleBadgeText,
  accentColor = 'emerald'
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
    const q = search.trim().toLowerCase();
    if (!q) return options;
    return options.filter(o => o.name.toLowerCase().includes(q));
  }, [options, search]);

  const isNoneSelected = !value || value === '-' || value === emptyValue;
  const displayValue = isNoneSelected ? (emptyLabel || 'Pilih Kru...') : value;

  return (
    <div ref={containerRef} className="relative">
      <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center justify-between mb-1.5">
        <span>{label}</span>
        <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded ${
          accentColor === 'blue'
            ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20'
            : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
        }`}>
          {options.length} Aktif
        </span>
      </label>

      <button
        type="button"
        onClick={() => {
          setIsOpen(prev => !prev);
          setSearch('');
        }}
        className={`w-full flex items-center justify-between gap-2.5 bg-slate-50 dark:bg-slate-950 border rounded-xl px-3 py-2 text-left transition cursor-pointer ${
          isOpen
            ? 'border-emerald-500 ring-2 ring-emerald-500/20'
            : 'border-slate-300 dark:border-slate-700 hover:border-slate-400 dark:hover:border-slate-600'
        }`}
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <div className={`w-7 h-7 rounded-lg flex items-center justify-center font-extrabold text-[11px] shrink-0 border ${
            isNoneSelected
              ? 'bg-slate-200 dark:bg-slate-800 text-slate-500 border-slate-300 dark:border-slate-700'
              : accentColor === 'blue'
              ? 'bg-blue-600 text-white border-blue-500 shadow-2xs'
              : 'bg-emerald-600 text-white border-emerald-500 shadow-2xs'
          }`}>
            {isNoneSelected ? '—' : getDriverInitials(displayValue)}
          </div>
          <div className="min-w-0">
            <div className={`text-xs font-bold leading-tight truncate ${
              isNoneSelected ? 'text-slate-400 dark:text-slate-500 italic' : 'text-slate-900 dark:text-white'
            }`}>
              {displayValue}
            </div>
            <div className="text-[10px] text-slate-500 dark:text-slate-400 font-medium leading-tight mt-0.5">
              {isNoneSelected ? 'Tidak ditugaskan' : `${roleBadgeText} • Status Aktif`}
            </div>
          </div>
        </div>
        <ChevronDown className={`w-4 h-4 text-slate-400 shrink-0 transition-transform duration-150 ${isOpen ? 'rotate-180 text-emerald-500' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute left-0 right-0 z-50 mt-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
          <div className="p-2 bg-slate-50 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={`Cari nama ${roleBadgeText.toLowerCase()}...`}
                autoFocus
                className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-emerald-500"
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
                    ? 'bg-slate-200/70 dark:bg-slate-800 text-slate-900 dark:text-white font-bold'
                    : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/60'
                }`}
              >
                <span className="italic">{emptyLabel}</span>
                {isNoneSelected && <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0" />}
              </button>
            )}

            {filteredOptions.length === 0 ? (
              <div className="py-5 text-center text-[11px] text-slate-400">
                Tidak ada kru aktif yang cocok dengan pencarian.
              </div>
            ) : (
              filteredOptions.map((item) => {
                const isSelected = !isNoneSelected && value.trim().toLowerCase() === item.name.trim().toLowerCase();
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      onChange(item.name);
                      setIsOpen(false);
                    }}
                    className={`w-full flex items-center justify-between gap-2.5 px-2.5 py-2 rounded-lg text-left transition cursor-pointer ${
                      isSelected
                        ? accentColor === 'blue'
                          ? 'bg-blue-600 text-white shadow-2xs'
                          : 'bg-emerald-600 text-white shadow-2xs'
                        : 'hover:bg-slate-100 dark:hover:bg-slate-800/70 text-slate-800 dark:text-slate-200'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className={`w-7 h-7 rounded-lg flex items-center justify-center font-extrabold text-[10px] shrink-0 border ${
                        isSelected
                          ? 'bg-white/20 text-white border-white/30'
                          : accentColor === 'blue'
                          ? 'bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/30'
                          : 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30'
                      }`}>
                        {getDriverInitials(item.name)}
                      </div>
                      <div className="min-w-0">
                        <div className={`text-xs font-bold leading-snug ${isSelected ? 'text-white' : 'text-slate-900 dark:text-white'}`}>
                          {item.name}
                        </div>
                        <div className={`text-[10px] flex items-center gap-1.5 ${isSelected ? 'text-white/85' : 'text-slate-500 dark:text-slate-400'}`}>
                          <span>{roleBadgeText}</span>
                          <span>•</span>
                          <span className={isSelected ? 'text-white font-semibold' : 'text-emerald-600 dark:text-emerald-400 font-semibold'}>
                            ● Aktif
                          </span>
                        </div>
                      </div>
                    </div>
                    {isSelected && <Check className="w-4 h-4 text-white shrink-0" />}
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
  const [categoryFilter, setCategoryFilter] = useState<'all' | 'luar_kota' | 'lokal' | 'kanvas_lkt'>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [scheduleStatusFilter, setScheduleStatusFilter] = useState<'all' | 'scheduled' | 'picked_up' | 'in_transit' | 'delivered' | 'delayed'>('all');
  const [armadaFilter, setArmadaFilter] = useState<string>('all');
  const [crewDriverFilter, setCrewDriverFilter] = useState<string>('all');
  const [branches, setBranches] = useState<BranchRecord[]>(() => branchStore.getActiveBranches());
  const [selectedBranchId, setSelectedBranchId] = useState<string>(() => branchStore.getSelectedOriginBranchId());

  useEffect(() => {
    const unsub = branchStore.subscribe(() => {
      setBranches(branchStore.getActiveBranches());
      setSelectedBranchId(branchStore.getSelectedOriginBranchId());
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
  const [importMonth, setImportMonth] = useState<string>('Januari');
  const [importYear, setImportYear] = useState<string>('2026');
  const [importMode, setImportMode] = useState<'tambahkan' | 'ganti'>('tambahkan');
  const [selectedUploadFile, setSelectedUploadFile] = useState<File | null>(null);

  const getIntegratedDrivers = () => {
    const allUsers = logisticsStore.getUsers();
    const activeDriverUsers = allUsers.filter(
      u => u.role === 'driver' && u.status === 'approved'
    );
    const names = new Set<string>();
    const result: { id: string; name: string; hasAccount?: boolean }[] = [];
    activeDriverUsers.forEach(u => {
      const clean = (u.fullName || '').trim();
      if (clean && !names.has(clean.toLowerCase())) {
        names.add(clean.toLowerCase());
        result.push({ id: u.id, name: clean, hasAccount: true });
      }
    });
    return result;
  };

  const getIntegratedHelpers = () => {
    const allUsers = logisticsStore.getUsers();
    const activeHelperAndDriverUsers = allUsers.filter(
      u => (u.role === 'crew_helper' || u.role === 'driver') && u.status === 'approved'
    );
    const names = new Set<string>();
    const result: { id: string; name: string; hasAccount?: boolean }[] = [];
    // Utamakan role crew_helper terlebih dahulu kemudian role driver (kondisional)
    const sorted = [...activeHelperAndDriverUsers].sort((a, b) => {
      if (a.role === 'crew_helper' && b.role !== 'crew_helper') return -1;
      if (a.role !== 'crew_helper' && b.role === 'crew_helper') return 1;
      return (a.fullName || '').localeCompare(b.fullName || '');
    });
    sorted.forEach(u => {
      const clean = (u.fullName || '').trim();
      if (clean && !names.has(clean.toLowerCase())) {
        names.add(clean.toLowerCase());
        result.push({ id: u.id, name: clean, hasAccount: true });
      }
    });
    return result;
  };

  const getTodayIso = () => {
    const now = new Date();
    const yr = now.getFullYear();
    const mo = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    return `${yr}-${mo}-${d}`;
  };

  const addDaysToIso = (isoDate: string, days: number): string => {
    const parts = (isoDate || '').split('-').map(Number);
    if (parts.length !== 3 || parts.some(isNaN)) return getTodayIso();
    const d = new Date(parts[0], parts[1] - 1, parts[2] + days);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };

  const isLuarKotaArea = (areaName: string): boolean => {
    const upper = (areaName || '').toUpperCase();
    return (
      upper.includes('DENPASAR') ||
      upper.includes('SINGARAJA') ||
      upper.includes('NEGARA') ||
      upper.includes('GIANYAR') ||
      upper.includes('TABANAN') ||
      upper.includes('KUTA') ||
      upper.includes('BALI') ||
      upper.includes('JEMBER') ||
      upper.includes('SITUBONDO') ||
      upper.includes('BONDOWOSO') ||
      upper.includes('STB') ||
      upper.includes('KANVAS LKT') ||
      upper.includes('TITIPAN KOTA KOTA') ||
      upper.includes('LUAR KOTA')
    );
  };

  const [manualScheduleForm, setManualScheduleForm] = useState<{
    dateIso: string;
    departureDateIso: string;
    returnDateIso: string;
    driver: string;
    helper: string;
    helper2: string;
    area: string;
    armada: string;
    target: string;
    departureTime: string;
    targetReturnTime: string;
    branchId: string;
  }>(() => {
    const initDrivers = logisticsStore.getUsers().filter(u => u.role === 'driver' && u.status === 'approved');
    const initHelpers = logisticsStore.getUsers().filter(u => (u.role === 'crew_helper' || u.role === 'driver') && u.status === 'approved');
    const today = getTodayIso();
    const initBranch = branchStore.getSelectedOriginBranchId() !== 'ALL'
      ? branchStore.getSelectedOriginBranchId()
      : 'cab-banyuwangi';
    return {
      dateIso: today,
      departureDateIso: today,
      returnDateIso: today,
      driver: initDrivers[0]?.fullName || 'Budiono',
      helper: initHelpers[0]?.fullName || 'Saifur Rizal',
      helper2: '',
      area: 'Denpasar 1',
      armada: 'DS3',
      target: '',
      departureTime: '07:30',
      targetReturnTime: '17:00',
      branchId: initBranch
    };
  });
  const [areaSearchFilter, setAreaSearchFilter] = useState<string>('');
  const [areaCategoryFilter, setAreaCategoryFilter] = useState<'all' | 'bali' | 'banyuwangi' | 'jember' | 'pantura'>('all');
  const [isAreaPickerExpanded, setIsAreaPickerExpanded] = useState<boolean>(false);

  const getAreaRegionCategory = (areaName: string): { category: 'bali' | 'jember' | 'pantura' | 'banyuwangi'; label: string; badgeColor: string } => {
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
    return OFFICIAL_DESTINATION_AREAS.filter(areaName => {
      const matchSearch = areaName.toLowerCase().includes(areaSearchFilter.toLowerCase().trim());
      if (!matchSearch) return false;
      if (areaCategoryFilter === 'all') return true;
      const cat = getAreaRegionCategory(areaName).category;
      return cat === areaCategoryFilter;
    });
  }, [areaSearchFilter, areaCategoryFilter]);

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
    const effectiveMo = selectedMonth === -1 ? 0 : selectedMonth;
    const defaultDayIso = `${selectedYear}-${String(effectiveMo + 1).padStart(2, '0')}-${String(dayNumber).padStart(2, '0')}`;
    const tripBranch = p.branchId || (p.id ? branchStore.getScheduleBranchId(p.id, p.target, p.armada) : (branchStore.getSelectedOriginBranchId() !== 'ALL' ? branchStore.getSelectedOriginBranchId() : 'cab-banyuwangi'));
    setEditingTripModal({
      isOpen: true,
      dayNumber,
      dateString,
      tripIndex,
      scheduleId: p.id,
      driver: p.driver,
      helper: p.helper && p.helper !== '-' ? p.helper : '',
      helper2: p.helper2 && p.helper2 !== '-' ? p.helper2 : '',
      area: p.area,
      armada: p.armada,
      target: p.target || '',
      departureDateIso: p.departureDateIso || defaultDayIso,
      returnDateIso: p.returnDateIso || defaultDayIso,
      departureTime: p.departureTime || '07:30',
      targetReturnTime: p.targetReturnTime || '17:00',
      branchId: tripBranch,
      isNew: false
    });
  };

  const handleOpenAddTripModal = (dayNumber: number, dateString: string) => {
    const defaultDriver = getIntegratedDrivers()[0]?.name || 'Budiono';
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

  // Real-Time Auto-Sync State (Persisted in localStorage, default: false)
  const [isAutoSyncEnabled, setIsAutoSyncEnabled] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('akk_auto_sync_enabled');
      return saved === 'true';
    } catch {
      return false;
    }
  });

  const toggleAutoSync = () => {
    setIsAutoSyncEnabled(prev => {
      const nextVal = !prev;
      try {
        localStorage.setItem('akk_auto_sync_enabled', String(nextVal));
      } catch {}
      return nextVal;
    });
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
          const matchedFleet = fleets.find(f => 
            f.initialCode?.toUpperCase() === p.armada.toUpperCase() ||
            f.plateNumber.replace(/\s+/g, '').toUpperCase().includes(p.armada.replace(/\s+/g, '').toUpperCase())
          ) || fleets[pIdx % fleets.length] || fleets[0];

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
              longitude: isBali ? 115.2126 : 114.369,
              contactPerson: 'PIC Distribusi Area',
              phone: '-',
              deliveryWindow: '08:00 - 17:00',
              storeCategory: 'Distribution Hub'
            },
            areaName: areaStd,
            fleetId: matchedFleet ? matchedFleet.id : 'flt-01',
            fleet: matchedFleet,
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

  // Month-specific active schedule dataset: reactive state linked with logisticsStore
  const [weeks, setWeeks] = useState<AdminScheduleWeek[]>(() => {
    const effectiveMonth = selectedMonth === -1 ? 0 : selectedMonth;
    // 1. First priority: Real schedules in logisticsStore
    const storeSchedules = logisticsStore.getSchedules();
    const weeksFromStore = convertSchedulesToAdminWeeks(storeSchedules, selectedYear, effectiveMonth);
    if (weeksFromStore.length > 0 && weeksFromStore[0]?.days?.length > 0) {
      return weeksFromStore;
    }

    // 2. Second priority: Local cache
    const cacheKey = `akk_admin_schedule_cache_${selectedYear}_${effectiveMonth}`;
    try {
      const saved = localStorage.getItem(cacheKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0 && parsed[0]?.days?.length > 0) {
          return parsed;
        }
      }
    } catch {}

    // 3. Fallback: Distinct month template
    return buildMonthSpecificSchedule(selectedYear, effectiveMonth);
  });

  const weeksRef = React.useRef(weeks);
  weeksRef.current = weeks;

  // On initial mount, load persisted schedules from server database if available
  useEffect(() => {
    fetchPersistedSchedulesFromServer().then(res => {
      if (res.exists && res.schedules.length > 0) {
        console.info(`[Database Persistence] Loaded ${res.count} persisted schedules from server.`);
        logisticsStore.batchSyncSchedules(res.schedules, [], { isImport: false });
        if (res.weeks && res.weeks.length > 0) {
          setWeeks(res.weeks);
        }
      }
    }).catch(err => console.warn('[Database Persistence Load Error]', err));
  }, []);

  // Keep weeks and store in sync whenever selectedYear, selectedMonth changes or store updates
  useEffect(() => {
    const effectiveMonth = selectedMonth === -1 ? 0 : selectedMonth;
    const storeSchedules = logisticsStore.getSchedules();
    const weeksFromStore = convertSchedulesToAdminWeeks(storeSchedules, selectedYear, effectiveMonth);

    if (weeksFromStore.length > 0 && weeksFromStore[0]?.days?.length > 0) {
      setWeeks(weeksFromStore);
      const cacheKey = `akk_admin_schedule_cache_${selectedYear}_${effectiveMonth}`;
      try {
        localStorage.setItem(cacheKey, JSON.stringify(weeksFromStore));
        localStorage.setItem('akk_admin_schedule_weeks_cache', JSON.stringify(weeksFromStore));
      } catch {}
    } else {
      // Seed from cache or template into logisticsStore so data becomes persistent
      const cacheKey = `akk_admin_schedule_cache_${selectedYear}_${effectiveMonth}`;
      let initialWeeks: AdminScheduleWeek[] = [];
      try {
        const saved = localStorage.getItem(cacheKey);
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed) && parsed.length > 0 && parsed[0]?.days?.length > 0) {
            initialWeeks = parsed;
          }
        }
      } catch {}

      if (initialWeeks.length === 0) {
        initialWeeks = buildMonthSpecificSchedule(selectedYear, effectiveMonth);
      }

      setWeeks(initialWeeks);
      try {
        localStorage.setItem(cacheKey, JSON.stringify(initialWeeks));
        localStorage.setItem('akk_admin_schedule_weeks_cache', JSON.stringify(initialWeeks));
      } catch {}
    }

    // Subscribe to store updates (from manual edits in ScheduleManagement or modals)
    const unsubscribe = logisticsStore.subscribe(() => {
      setOfficialCrewsList(crewAutoMapper.getOfficialCrewList());
      setOfficialAreasList(areaAutoMapper.getOfficialAreaList());
      setScheduleChangeLogs(logisticsStore.getScheduleChangeLogs());

      const curSchedules = logisticsStore.getSchedules();
      const updatedWeeks = convertSchedulesToAdminWeeks(curSchedules, selectedYear, effectiveMonth);
      if (updatedWeeks.length > 0 && updatedWeeks[0]?.days?.length > 0) {
        const curTrips = weeksRef.current.flatMap(w => w.days).reduce((acc, d) => acc + (d.pengiriman?.length || 0), 0);
        const newTrips = updatedWeeks.flatMap(w => w.days).reduce((acc, d) => acc + (d.pengiriman?.length || 0), 0);
        if (newTrips >= curTrips || curTrips === 0) {
          setWeeks(updatedWeeks);
        }
      }
    });

    return unsubscribe;
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
      const DAY_NAMES_ID = ['MINGGU', 'SENIN', 'SELASA', 'RABU', 'KAMIS', 'JUMAT', 'SABTU'];
      const dayName = DAY_NAMES_ID[d.getDay()];
      const dateStr = `${String(dayNum).padStart(2, '0')} ${MONTH_NAMES[mo]} ${yr}`;

      const stdArea = standardizeAreaName(created.areaName || created.store?.storeName || '');
      const armadaCode = created.fleet?.initialCode || created.fleet?.plateNumber || 'DS1';
      const newTrip: DeliveryAssignment = {
        id: created.id,
        driver: created.crew?.name || '-',
        helper: created.crewHelper?.name || '-',
        helper2: created.crewHelper2?.name || '-',
        area: stdArea,
        armada: armadaCode,
        target: created.notes || `Rute ${stdArea}`,
        isManuallyEdited: true
      };

      const cacheKey = `akk_admin_schedule_cache_${yr}_${mo}`;
      let targetWeeks: AdminScheduleWeek[] = [];
      const curEffectiveMonth = selectedMonth === -1 ? 0 : selectedMonth;

      if (yr === selectedYear && mo === curEffectiveMonth) {
        targetWeeks = [...weeksRef.current];
      } else {
        try {
          const cached = localStorage.getItem(cacheKey);
          if (cached) targetWeeks = JSON.parse(cached);
        } catch {}
        if (!targetWeeks || targetWeeks.length === 0) {
          targetWeeks = buildMonthSpecificSchedule(yr, mo);
        }
      }

      let foundDay = false;
      const updatedWeeks = targetWeeks.map((w, wIdx) => {
        const hasDay = w.days.some(dayObj => dayObj.dayNumber === dayNum);
        if (hasDay) {
          foundDay = true;
          return {
            ...w,
            days: w.days.map(dayObj => {
              if (dayObj.dayNumber === dayNum) {
                const exists = dayObj.pengiriman.some(p => p.id === created.id);
                return {
                  ...dayObj,
                  pengiriman: exists
                    ? dayObj.pengiriman.map(p => (p.id === created.id ? newTrip : p))
                    : [...dayObj.pengiriman, newTrip]
                };
              }
              return dayObj;
            })
          };
        }
        if (wIdx === targetWeeks.length - 1 && !foundDay) {
          foundDay = true;
          const newDays = [
            ...w.days,
            {
              dayName,
              dayNumber: dayNum,
              dateString: dateStr,
              pengiriman: [newTrip],
              gudang: [],
              pengirimanOff: [],
              karyawanIzin: []
            }
          ].sort((a, b) => a.dayNumber - b.dayNumber);
          return { ...w, days: newDays };
        }
        return w;
      });

      try {
        localStorage.setItem(cacheKey, JSON.stringify(updatedWeeks));
        localStorage.setItem('akk_admin_schedule_weeks_cache', JSON.stringify(updatedWeeks));
      } catch {}

      if (selectedYear !== yr) setSelectedYear(yr);
      if (selectedMonth !== -1 && selectedMonth !== mo) setSelectedMonth(mo);
      setWeeks(updatedWeeks);
      setSelectedCalendarDate(dateStr);
      setSelectedDayFilter(dateStr);
      setScheduleChangeLogs(logisticsStore.getScheduleChangeLogs());
      setSyncSuccessMessage(`✅ Jadwal baru (${newTrip.driver} • ${stdArea} • ${armadaCode}) otomatis masuk ke Jadwal & Penugasan dan Portal Driver!`);
      setTimeout(() => setSyncSuccessMessage(null), 6000);
    };

    window.addEventListener('akk-new-schedule-added', handleNewScheduleAdded);
    return () => window.removeEventListener('akk-new-schedule-added', handleNewScheduleAdded);
  }, [selectedYear, selectedMonth]);

  // Background cache persistence timer (Google Sheets auto-sync removed)
  useEffect(() => {
    if (!isAutoSyncEnabled) return;

    const intervalId = setInterval(() => {
      const effectiveMonth = selectedMonth === -1 ? 0 : selectedMonth;
      const cacheKey = `akk_admin_schedule_cache_${selectedYear}_${effectiveMonth}`;
      try {
        localStorage.setItem(cacheKey, JSON.stringify(weeksRef.current));
        localStorage.setItem('akk_admin_schedule_weeks_cache', JSON.stringify(weeksRef.current));
      } catch {}
    }, 60000);

    return () => clearInterval(intervalId);
  }, [isAutoSyncEnabled, selectedYear, selectedMonth]);

  const updateWeeks = (newWeeks: AdminScheduleWeek[]) => {
    setWeeks(newWeeks);
    const effectiveMonth = selectedMonth === -1 ? 0 : selectedMonth;
    const cacheKey = `akk_admin_schedule_cache_${selectedYear}_${effectiveMonth}`;
    try {
      localStorage.setItem(cacheKey, JSON.stringify(newWeeks));
      localStorage.setItem('akk_admin_schedule_weeks_cache', JSON.stringify(newWeeks));
    } catch (e) {
      console.warn('Failed to cache admin schedule weeks:', e);
    }
  };

  // Merge new parsed trips (from Excel upload and/or manual schedule creation) into existing weeks & store
  const mergeAndSaveCombinedTrips = (
    incomingTrips: Array<ParsedSheetTrip & { source?: 'excel' | 'manual' }>,
    mode: 'tambahkan' | 'ganti' = 'tambahkan',
    sourceLabel: string = 'Kombinasi Tambah & Unggah Jadwal'
  ) => {
    if (!incomingTrips || incomingTrips.length === 0) return;

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

    incomingTrips.forEach((t, idx) => {
      const stdArea = standardizeAreaName(t.area || '-');
      const isLuarKota = isLuarKotaArea(stdArea);
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

      const matchedFleet = fleets.find(f =>
        f.initialCode?.toUpperCase() === armadaCode ||
        f.plateNumber.replace(/\s+/g, '').toUpperCase().includes(armadaCode.replace(/\s+/g, ''))
      ) || fleets[0];

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

      const isBali = stdArea.includes('DENPASAR') || stdArea.includes('SINGARAJA') || stdArea.includes('NEGARA') || stdArea.includes('BALI');
      const newSchId = `sch-comb-${yr}${monthPadded}${dayPadded}-${armadaCode}-${Date.now().toString().slice(-4)}-${idx}`;

      const newSch: Schedule = {
        id: newSchId,
        trackingNumber: `PO-AKK-${yr}${monthPadded}${dayPadded}-${armadaCode}-${idx + 1}`,
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
        crewId: matchedDriver ? matchedDriver.id : 'crw-01',
        crew: matchedDriver,
        crewHelperId: matchedHelper ? matchedHelper.id : undefined,
        crewHelper: matchedHelper,
        crewHelper2Id: matchedHelper2 ? matchedHelper2.id : undefined,
        crewHelper2: matchedHelper2,
        status: 'scheduled',
        departureDate: departureIso,
        estimatedArrival: estArrivalIso,
        cargoDescription: `Karton Box & Sheet Kemasan - Area ${stdArea}`,
        cargoWeightTon: isBali ? 4.5 : 2.5,
        isInterIsland: isBali,
        ferryBookingCode: isBali ? `ASDP-KTP-GLM-${Math.floor(Math.random() * 9000 + 1000)}` : undefined,
        transitPort: isBali ? 'Pelabuhan Ketapang Banyuwangi -> Gilimanuk Bali' : undefined,
        notes: t.target || `Rute ${stdArea} (Berangkat ${depDateIso} ${depTime} • Pulang ${retDateIso} ${retTime})`,
        createdAt: new Date().toISOString(),
        isManuallyEdited: t.source === 'manual'
      };

      logisticsStore.addSchedule(newSch);

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
        driver: driverName,
        helper: helperName,
        helper2: helper2Name,
        area: stdArea,
        armada: armadaCode,
        target: t.target || 'Gudang Pusat AKK Banyuwangi DC',
        departureTime: depTime,
        targetReturnTime: retTime,
        departureDateIso: depDateIso,
        returnDateIso: retDateIso,
        isManuallyEdited: t.source === 'manual'
      });

      if (changeDetails.length < 6) {
        changeDetails.push(
          `[${t.source === 'excel' ? 'Excel' : 'Input Baru'}] ${dateString}: Driver ${driverName} | Area ${stdArea} | Armada ${armadaCode} | Berangkat ${depDateIso} ${depTime} - Pulang ${retDateIso} ${retTime}`
        );
      }
    });

    const sortedDays = Array.from(dayMap.values()).sort((a, b) => a.dayNumber - b.dayNumber);
    const mergedWeeks: AdminScheduleWeek[] = [
      {
        weekNumber: 1,
        weekLabel: `JADWAL PENGIRIMAN AKTIF (${(MONTH_NAMES[targetMonth] || 'JANUARI').toUpperCase()} ${targetYear} • ${sortedDays.length} HARI)`,
        dateRangeLabel: `${MONTH_NAMES[targetMonth] || 'Januari'} ${targetYear}`,
        days: sortedDays
      }
    ];

    if (selectedYear !== targetYear) setSelectedYear(targetYear);
    if (selectedMonth !== -1 && selectedMonth !== targetMonth) setSelectedMonth(targetMonth);

    updateWeeks(mergedWeeks);
    setSelectedCalendarDate(lastFocusedDateString);
    setSelectedDayFilter(lastFocusedDateString);

    logisticsStore.syncSchedulesToCrewHistory();

    const excelCount = incomingTrips.filter(x => x.source === 'excel').length;
    const manualCount = incomingTrips.filter(x => x.source !== 'excel').length;

    logisticsStore.addScheduleChangeLog({
      fileName: sourceLabel,
      actionType: excelCount > 0 ? 'upload_excel' : 'manual_create',
      summary: `Kombinasi Jadwal Disimpan: ${incomingTrips.length} total jadwal (${excelCount} dari Excel, ${manualCount} dari Input Jadwal Baru)`,
      rowCount: incomingTrips.length,
      changes: changeDetails
    });
    setScheduleChangeLogs(logisticsStore.getScheduleChangeLogs());

    persistSchedulesToDatabase(logisticsStore.getSchedules(), mergedWeeks, {
      month: String(targetMonth + 1),
      year: Number(targetYear),
      source: 'combined_excel_and_manual_schedule'
    }).catch(() => {});

    const msg = `✅ ${incomingTrips.length} jadwal (${excelCount > 0 ? `${excelCount} Excel + ` : ''}${manualCount > 0 ? `${manualCount} Jadwal Baru` : ''}) berhasil disimpan permanen!`;
    setSyncSuccessMessage(msg);
    if (onSyncComplete) onSyncComplete(incomingTrips.length);
    setTimeout(() => setSyncSuccessMessage(null), 7000);
  };

  const handleSaveTripModal = () => {
    if (!editingTripModal) return;
    const { dayNumber, dateString, tripIndex, scheduleId, driver, helper, helper2, area, armada, target, departureDateIso, returnDateIso, departureTime, targetReturnTime, isNew } = editingTripModal;

    const effectiveMonth = selectedMonth === -1 ? 0 : selectedMonth;
    const defaultMonthPadded = String(effectiveMonth + 1).padStart(2, '0');
    const defaultDayPadded = String(dayNumber).padStart(2, '0');
    const fallbackIso = `${selectedYear}-${defaultMonthPadded}-${defaultDayPadded}`;

    const stdArea = standardizeAreaName(area);
    const isLuarKota = isLuarKotaArea(stdArea);
    const depTime = (departureTime || '07:30').trim();
    const retTime = (targetReturnTime || '17:00').trim();

    const depIsoDate = departureDateIso || fallbackIso;
    const retIsoDate = isLuarKota
      ? (returnDateIso || (depTime > retTime ? addDaysToIso(depIsoDate, 1) : depIsoDate))
      : depIsoDate;

    // Jika rute luar kota / kepulangan besok, tanggal di kalender mengikuti Tanggal Kepulangan (retIsoDate)
    const effectiveCalendarIso = (isLuarKota || retIsoDate > depIsoDate) ? retIsoDate : depIsoDate;
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

    const fleets = logisticsStore.getFleets();
    const crews = logisticsStore.getCrews();

    const matchedFleet = fleets.find(f => 
      f.initialCode?.toUpperCase() === armada.toUpperCase() ||
      f.plateNumber.replace(/\s+/g, '').toUpperCase().includes(armada.replace(/\s+/g, '').toUpperCase())
    ) || fleets[0];

    const matchedDriver = crews.find(c => 
      c.name.toLowerCase().includes(driver.toLowerCase()) || 
      driver.toLowerCase().includes(c.name.toLowerCase())
    ) || crews[0];

    const matchedHelper = helper && helper.trim() && helper !== '-' ? crews.find(c => 
      c.name.toLowerCase().includes(helper.toLowerCase()) || 
      helper.toLowerCase().includes(c.name.toLowerCase())
    ) : undefined;

    const matchedHelper2 = helper2 && helper2.trim() && helper2 !== '-' ? crews.find(c => 
      c.name.toLowerCase().includes(helper2.toLowerCase()) || 
      helper2.toLowerCase().includes(c.name.toLowerCase())
    ) : undefined;

    const isBali = stdArea.includes('DENPASAR') || stdArea.includes('SINGARAJA') || stdArea.includes('NEGARA') || stdArea.includes('BALI');

    if (isNew) {
      const newSchId = `sch-man-${Date.now()}-${Math.floor(Math.random() * 9000 + 1000)}`;
      const newSch: Schedule = {
        id: newSchId,
        trackingNumber: `PO-AKK-${targetYr}${monthPadded}${dayPadded}-${armada}-${Date.now().toString().slice(-4)}`,
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
        crewId: matchedDriver ? matchedDriver.id : 'crw-01',
        crew: matchedDriver,
        crewHelperId: matchedHelper ? matchedHelper.id : undefined,
        crewHelper: matchedHelper,
        crewHelper2Id: matchedHelper2 ? matchedHelper2.id : undefined,
        crewHelper2: matchedHelper2,
        status: 'scheduled',
        departureDate: departureIso,
        estimatedArrival: estArrivalIso,
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
          `Area Kirim: ${stdArea} | Armada: ${armada}`
        ]
      });

      const newTripObj: DeliveryAssignment = {
        id: newSchId,
        driver,
        helper: helper || '-',
        helper2: helper2 || '-',
        area: stdArea,
        armada,
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

      if (!targetId) {
        const found = storeSchedules.find(s => {
          if (!s.departureDate) return false;
          const d = new Date(s.departureDate);
          const isSameDay = d.getFullYear() === selectedYear && d.getMonth() === effectiveMonth && d.getDate() === dayNumber;
          if (!isSameDay) return false;
          return s.fleet?.initialCode === armada || (s.trackingNumber && s.trackingNumber.includes(armada)) || s.crew?.name?.toLowerCase().includes(driver.toLowerCase());
        }) || storeSchedules.find(s => {
          if (!s.departureDate) return false;
          const d = new Date(s.departureDate);
          return d.getFullYear() === selectedYear && d.getMonth() === effectiveMonth && d.getDate() === dayNumber;
        });
        if (found) targetId = found.id;
      }

      if (targetId && storeSchedules.some(s => s.id === targetId)) {
        logisticsStore.updateSchedule(targetId, {
          fleetId: matchedFleet ? matchedFleet.id : undefined,
          fleet: matchedFleet,
          crewId: matchedDriver ? matchedDriver.id : undefined,
          crew: matchedDriver,
          crewHelperId: matchedHelper ? matchedHelper.id : undefined,
          crewHelper: matchedHelper,
          crewHelper2Id: matchedHelper2 ? matchedHelper2.id : undefined,
          crewHelper2: matchedHelper2,
          areaName: stdArea,
          departureDate: departureIso,
          estimatedArrival: estArrivalIso,
          notes: target,
          isManuallyEdited: true
        });
      } else {
        const generatedId = targetId || `sch-man-${Date.now()}-${Math.floor(Math.random() * 9000 + 1000)}`;
        const newSch: Schedule = {
          id: generatedId,
          trackingNumber: `PO-AKK-${targetYr}${monthPadded}${dayPadded}-${armada}-${Date.now().toString().slice(-4)}`,
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
          crewId: matchedDriver ? matchedDriver.id : 'crw-01',
          crew: matchedDriver,
          crewHelperId: matchedHelper ? matchedHelper.id : undefined,
          crewHelper: matchedHelper,
          crewHelper2Id: matchedHelper2 ? matchedHelper2.id : undefined,
          crewHelper2: matchedHelper2,
          status: 'scheduled',
          departureDate: departureIso,
          estimatedArrival: estArrivalIso,
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
        if (prevTrip.armada !== armada) editDiffs.push(`Armada: ${prevTrip.armada} → ${armada}`);
      }
      if (editDiffs.length === 0) {
        editDiffs.push(`Pembaruan ritase ${targetDateString}: Driver ${driver}, Area ${stdArea}, Armada ${armada} (${depTime}-${retTime})`);
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
        branchId: editingTripModal.branchId || branchStore.getScheduleBranchId(targetId || prevTrip?.id || '', stdArea, armada),
        driver,
        helper: helper || '-',
        helper2: helper2 || '-',
        area: stdArea,
        armada,
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
    let result = weeks;
    if (selectedWeekNum !== 'all') {
      result = result.filter(w => w.weekNumber === selectedWeekNum);
    }
    if (selectedBranchId !== 'ALL') {
      result = result.map(w => ({
        ...w,
        days: w.days.map(d => ({
          ...d,
          pengiriman: d.pengiriman.filter(p => {
            const bId = p.branchId || branchStore.getScheduleBranchId(p.id || '', p.area, p.armada);
            return bId === selectedBranchId;
          })
        })).filter(d => d.pengiriman.length > 0)
      })).filter(w => w.days.length > 0);
    }
    return result;
  }, [weeks, selectedWeekNum, selectedBranchId]);

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
    const monthIdx = selectedMonth === -1 ? 0 : selectedMonth;
    const monthName = MONTH_NAMES[monthIdx];

    const firstDate = new Date(year, monthIdx, 1);
    const startDayOfWeek = firstDate.getDay(); // 0 = MINGGU, 1 = SENIN, ...
    const daysInMonth = new Date(year, monthIdx + 1, 0).getDate();

    const monthDaysMap = new Map<number, AdminScheduleDay>();
    filteredWeeks.forEach((w: AdminScheduleWeek) => {
      w.days.forEach((d: AdminScheduleDay) => {
        monthDaysMap.set(d.dayNumber, d);
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
      kanvasCount: number;
    }> = [];

    for (let i = 0; i < startDayOfWeek; i++) {
      cells.push({
        type: 'padding',
        totalTrips: 0,
        lokalCount: 0,
        luarKotaCount: 0,
        kanvasCount: 0
      });
    }

    const DAY_NAMES_ARR = ['MINGGU', 'SENIN', 'SELASA', 'RABU', 'KAMIS', 'JUMAT', 'SABTU'];
    for (let dayNum = 1; dayNum <= daysInMonth; dayNum++) {
      const dateObj = new Date(year, monthIdx, dayNum);
      const dayName = DAY_NAMES_ARR[dateObj.getDay()];
      const dayFormatted = String(dayNum).padStart(2, '0');
      const dateString = `${dayFormatted} ${monthName} ${year}`;
      const scheduleDay = monthDaysMap.get(dayNum);

      let lokalCount = 0;
      let luarKotaCount = 0;
      let kanvasCount = 0;
      let totalTrips = 0;

      if (scheduleDay) {
        totalTrips = scheduleDay.pengiriman.length;
        scheduleDay.pengiriman.forEach((p: DeliveryAssignment) => {
          const std = standardizeAreaName(p.area).toUpperCase();
          if (std.includes('KANVAS') || (p.area || '').toUpperCase().includes('KANVAS')) {
            kanvasCount++;
          } else if (std.includes('DENPASAR') || std.includes('SINGARAJA') || std.includes('NEGARA') || std.includes('GIANYAR') || std.includes('TABANAN') || std.includes('KUTA') || std.includes('BALI')) {
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
        kanvasCount
      });
    }

    return { monthName, year, startDayOfWeek, daysInMonth, cells };
  }, [selectedYear, selectedMonth, filteredWeeks]);

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

  // Aggregate statistics
  const stats = useMemo(() => {
    let totalTrips = 0;
    let totalWarehouseRoles = 0;
    let totalLeaves = 0;
    let totalOff = 0;
    let totalLuarKota = 0;
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
            if (std.includes('DENPASAR') || std.includes('SINGARAJA') || std.includes('NEGARA') || std.includes('GIANYAR') || std.includes('TABANAN') || std.includes('KUTA')) {
              totalLuarKota++;
            } else {
              totalLokal++;
            }
          }
        });
      });
    });

    return { 
      totalTrips, 
      totalWarehouseRoles, 
      totalLeaves, 
      totalOff, 
      totalLuarKota, 
      totalLokal,
      totalUniqueAreas: uniqueAreasSet.size
    };
  }, [filteredWeeks]);

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
        if (importMode === 'tambahkan') {
          mergeAndSaveCombinedTrips(
            parsedTrips.map(t => ({ ...t, source: 'excel' as const })),
            'tambahkan',
            file.name
          );
        } else {
          const groupedWeeks = convertParsedTripsToWeeks(parsedTrips);
          updateWeeks(groupedWeeks);
        }
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

    // Cache current weeks state so it permanently survives offline / reloads
    const cacheKey = `akk_admin_schedule_cache_${selectedYear}_${effectiveMonth}`;
    try {
      localStorage.setItem(cacheKey, JSON.stringify(weeks));
      localStorage.setItem('akk_admin_schedule_weeks_cache', JSON.stringify(weeks));
    } catch {}

    setTimeout(() => {
      setIsSyncing(false);
      const msg = `⚡ Berhasil menyinkronkan data! ${syncRes.overwrittenCount} jadwal diperbarui, ${syncRes.syncedCount} jadwal baru ditambahkan. Data tersimpan permanen & aman dari refresh/off.`;
      setSyncSuccessMessage(msg);
      if (onSyncComplete) onSyncComplete(syncRes.syncedCount + syncRes.overwrittenCount);
      setTimeout(() => setSyncSuccessMessage(null), 8000);
    }, 600);
  };

  return (
    <div className="space-y-3.5">
      {activeSubPage === 'schedule' ? (
        <>
      {/* 1. Header Card: Compact & Dense */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 shadow-md relative overflow-hidden">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 relative z-10">
          <div>
            <h2 className="text-base sm:text-lg font-black text-white tracking-tight flex items-center gap-2">
              Jadwal Pengiriman &amp; Penugasan Armada
            </h2>
            <p className="text-[11px] text-slate-400 mt-0.5 max-w-2xl">
              Tabel jadwal pengiriman armada, penugasan kru supir &amp; helper, jadwal Kanvas LKT, serta alokasi area distribusi terintegrasi.
            </p>
          </div>

          {/* Simplified Header Actions */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <input 
              type="file" 
              ref={fileInputRef}
              accept=".xlsx,.xls,.csv" 
              className="hidden" 
              onChange={handleFileUpload}
            />

            <button
              onClick={() => {
                const today = getTodayIso();
                setManualScheduleForm(prev => ({
                  ...prev,
                  dateIso: today,
                  departureDateIso: today,
                  returnDateIso: today
                }));
                setIsUploadConfigModalOpen(true);
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black border border-emerald-400/40 shadow-xs transition cursor-pointer"
              title="Pop-up Form Tambah Jadwal Baru (Manual)"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Tambah Jadwal Manual</span>
            </button>

            <button
              onClick={() => {
                const effectiveMo = selectedMonth === -1 ? 0 : selectedMonth;
                setImportMonth(MONTH_NAMES[effectiveMo] || 'Januari');
                setImportYear(String(selectedYear));
                setActiveSubPage('upload_excel');
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-black border border-blue-400/40 shadow-xs transition cursor-pointer"
              title="Halaman Unggah File Jadwal Excel (.xls, .xlsx, .csv)"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>Unggah File Excel</span>
            </button>

            <button
              onClick={() => {
                setActiveMappingCategory('area');
                setIsAreaMappingModalOpen(true);
              }}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold border border-slate-700 transition cursor-pointer relative"
              title="Pemetaan Area Kirim"
            >
              <MapPin className="w-3.5 h-3.5 text-rose-400" />
              <span>Area ({Object.keys(detectedAreaMappings).length})</span>
            </button>

            <button
              onClick={() => {
                setActiveMappingCategory('crew');
                setIsAreaMappingModalOpen(true);
              }}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold border border-slate-700 transition cursor-pointer relative"
              title="Pemetaan Kru (Driver & Helper)"
            >
              <Users className="w-3.5 h-3.5 text-blue-400" />
              <span>Kru ({Object.keys(detectedCrewMappings).length})</span>
            </button>

            <button
              onClick={handleExportXLSX}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold border border-slate-700 transition cursor-pointer"
              title="Ekspor ke Excel (.xlsx)"
            >
              <Download className="w-3.5 h-3.5 text-blue-400" />
              <span>Ekspor</span>
            </button>

            <button
              onClick={() => {
                setScheduleChangeLogs(logisticsStore.getScheduleChangeLogs());
                setIsHistoryModalOpen(true);
              }}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-amber-300 text-xs font-bold border border-slate-700 transition cursor-pointer"
              title="Riwayat / Log Unggah & Perubahan Jadwal"
            >
              <HistoryIcon className="w-3.5 h-3.5 text-amber-400" />
              <span>Riwayat ({scheduleChangeLogs.length})</span>
            </button>
          </div>
        </div>

        {/* Sync Success Banner */}
        {syncSuccessMessage && (
          <div className="mt-3 p-2.5 rounded-lg bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 text-xs flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span className="font-semibold">{syncSuccessMessage}</span>
            </div>
          </div>
        )}

        {/* 1. Keterangan Periode Selection Bar */}
        <div className="mt-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold text-sm">
              <Calendar className="w-4 h-4" />
            </div>
            <div>
              <span className="text-[10px] uppercase font-black text-emerald-600 dark:text-emerald-400 tracking-wider block">
                Keterangan Periode Jadwal Pengiriman
              </span>
              <h4 className="text-xs sm:text-sm font-black text-slate-900 dark:text-white flex items-center gap-1.5 mt-0.5 flex-wrap">
                <span>{selectedMonth === -1 ? `Semua Bulan ${selectedYear}` : `${MONTH_NAMES[selectedMonth]} ${selectedYear}`}</span>
                <span className="text-[11px] font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-950/80 px-2 py-0.5 rounded-full border border-emerald-300 dark:border-emerald-800">
                  {stats.totalTrips} Ritase Total
                </span>
                <span className="text-[11px] font-bold text-rose-700 dark:text-rose-300 bg-rose-100 dark:bg-rose-950/80 px-2 py-0.5 rounded-full border border-rose-300 dark:border-rose-800">
                  📍 {stats.totalUniqueAreas} Total Area Kirim
                </span>
              </h4>
            </div>
          </div>

          {/* Month, Year & Cabang Selectors */}
          <div className="flex items-center gap-1.5 bg-white dark:bg-slate-900 p-1 rounded-lg border border-slate-200 dark:border-slate-800 text-xs font-semibold flex-wrap">
            <span className="text-slate-600 dark:text-slate-300 font-extrabold px-1 text-[11px]">Periode:</span>
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(Number(e.target.value))}
              className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white rounded-md px-2.5 py-1 text-xs font-bold focus:outline-none focus:border-emerald-500 cursor-pointer"
            >
              <option value={-1}>Semua Bulan</option>
              {MONTH_NAMES.map((m, idx) => (
                <option key={m} value={idx}>{m}</option>
              ))}
            </select>
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(Number(e.target.value))}
              className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white rounded-md px-2.5 py-1 text-xs font-bold focus:outline-none focus:border-emerald-500 cursor-pointer"
            >
              {[2024, 2025, 2026, 2027, 2028].map(yr => (
                <option key={yr} value={yr}>{yr}</option>
              ))}
            </select>

            {/* Cabang Filter */}
            <div className="flex items-center gap-1 pl-1 border-l border-slate-200 dark:border-slate-800">
              <Building2 className="w-3.5 h-3.5 text-blue-500 shrink-0" />
              <select
                value={selectedBranchId}
                onChange={(e) => {
                  const bId = e.target.value;
                  setSelectedBranchId(bId);
                  branchStore.setActiveBranchId(bId);
                }}
                className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white rounded-md px-2.5 py-1 text-xs font-bold focus:outline-none focus:border-blue-500 cursor-pointer"
              >
                <option value="ALL">Semua Cabang</option>
                {branches.map(b => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Aggregate KPI Chips - Compact */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 mt-3">
          <div className="bg-slate-50 dark:bg-slate-950/60 px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800">
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400">Total Ritase Kirim</span>
              <Truck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white mt-0.5 leading-none">
              {stats.totalTrips} <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">Rute</span>
            </div>
          </div>

          <div className="bg-slate-50 dark:bg-slate-950/60 px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800">
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase font-bold text-rose-600 dark:text-rose-400">Total Area Kirim</span>
              <MapPin className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />
            </div>
            <div className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white mt-0.5 leading-none">
              {stats.totalUniqueAreas} <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">Area</span>
            </div>
          </div>

          <div className="bg-slate-50 dark:bg-slate-950/60 px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800">
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase font-bold text-blue-600 dark:text-blue-400">Luar Kota / Bali</span>
              <Ship className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
            </div>
            <div className="text-xl sm:text-2xl font-black text-blue-700 dark:text-blue-300 mt-0.5 leading-none">
              {stats.totalLuarKota} <span className="text-[11px] font-semibold text-blue-600/80 dark:text-blue-400">Ferry ASDP</span>
            </div>
          </div>

          <div className="bg-slate-50 dark:bg-slate-950/60 px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800">
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase font-bold text-emerald-600 dark:text-emerald-400">Distribusi Lokal</span>
              <Truck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div className="text-xl sm:text-2xl font-black text-emerald-700 dark:text-emerald-300 mt-0.5 leading-none">
              {stats.totalLokal} <span className="text-[11px] font-semibold text-emerald-600/80 dark:text-emerald-400">Jawa Timur</span>
            </div>
          </div>

          <div className="bg-slate-50 dark:bg-slate-950/60 px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 col-span-2 sm:col-span-1">
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase font-bold text-amber-600 dark:text-amber-400">Total Personel Kru</span>
              <Users className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
            </div>
            <div className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white mt-0.5 leading-none">
              {officialCrewsList.length} <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">Terdaftar</span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content: Interactive Calendar & Selected Day Grid Details */}
      <div className="space-y-4">
        {/* Calendar Container - Compact */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3.5 shadow-xs space-y-2.5">
            {/* Calendar Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200 dark:border-slate-800 pb-2.5">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-emerald-600 text-white flex items-center justify-center font-bold shadow-xs">
                  <Calendar className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-xs sm:text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
                    <span>KALENDER PENGIRIMAN - {selectedMonth === -1 ? `SEMUA BULAN (${calendarGridData.monthName.toUpperCase()})` : calendarGridData.monthName.toUpperCase()} {calendarGridData.year}</span>
                  </h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Klik pada salah satu tanggal untuk melihat rincian supir, helper, area kirim, dan armada.
                  </p>
                </div>
              </div>

              {/* Legend Badges */}
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  <span>Area Lokal (Jatim)</span>
                </span>
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 dark:bg-blue-950/80 text-blue-800 dark:text-blue-300 border border-blue-300 dark:border-blue-800">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                  <span>Area Luar Kota / Bali</span>
                </span>
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-purple-100 dark:bg-purple-950/80 text-purple-800 dark:text-purple-300 border border-purple-300 dark:border-purple-800">
                  <span className="w-1.5 h-1.5 rounded-full bg-purple-500" />
                  <span>Kanvas LKT</span>
                </span>
              </div>
            </div>

            {/* 7-Column Calendar Grid Header */}
            <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-black uppercase text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800/90 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700">
              <div className="text-rose-600 dark:text-rose-400">MINGGU</div>
              <div>SENIN</div>
              <div>SELASA</div>
              <div>RABU</div>
              <div>KAMIS</div>
              <div>JUMAT</div>
              <div className="text-blue-600 dark:text-blue-400">SABTU</div>
            </div>

            {/* Calendar Cells Grid (Compact) */}
            <div className="grid grid-cols-7 gap-1">
              {calendarGridData.cells.map((cell, cIdx) => {
                if (cell.type === 'padding') {
                  return (
                    <div key={`pad-${cIdx}`} className="min-h-[68px] sm:min-h-[78px] bg-slate-50/50 dark:bg-slate-950/20 rounded-lg border border-dashed border-slate-200 dark:border-slate-800/50" />
                  );
                }

                const isSelected = selectedCalendarDate === cell.dateString;
                const hasDeliveries = cell.totalTrips > 0;

                return (
                  <div
                    key={`cal-cell-${cell.dayNumber}-${cell.dateString}`}
                    onClick={() => {
                      if (cell.dateString) {
                        setSelectedCalendarDate(cell.dateString);
                        setSelectedDayFilter(cell.dateString);
                      }
                    }}
                    className={`min-h-[68px] sm:min-h-[78px] p-1.5 rounded-lg border transition cursor-pointer flex flex-col justify-between select-none relative ${
                      isSelected
                        ? 'bg-emerald-100/90 dark:bg-emerald-950/60 border-emerald-500 ring-1 ring-emerald-500 shadow-sm z-10'
                        : hasDeliveries
                        ? 'bg-white dark:bg-slate-800 hover:bg-emerald-50 dark:hover:bg-slate-700/80 border-slate-200 dark:border-slate-700'
                        : 'bg-slate-50/80 dark:bg-slate-950/40 hover:bg-slate-100 dark:hover:bg-slate-900 border-slate-200 dark:border-slate-800 opacity-80'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className={`text-[11px] font-black px-1.5 py-0.2 rounded ${
                        isSelected
                          ? 'bg-emerald-600 text-white'
                          : hasDeliveries
                          ? 'bg-slate-200 dark:bg-slate-700 text-slate-900 dark:text-white font-extrabold'
                          : 'text-slate-400'
                      }`}>
                        {String(cell.dayNumber).padStart(2, '0')}
                      </span>
                      {hasDeliveries && (
                        <span className="text-[9px] font-extrabold text-emerald-700 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-950/80 px-1.5 py-0.2 rounded-full border border-emerald-300 dark:border-emerald-800">
                          {cell.totalTrips} Rit
                        </span>
                      )}
                    </div>

                    {hasDeliveries ? (
                      <div className="space-y-0.5 mt-1">
                        {cell.lokalCount > 0 && (
                          <div className="text-[9px] font-bold px-1 py-0.2 rounded bg-emerald-100 dark:bg-emerald-950/90 text-emerald-800 dark:text-emerald-300 border border-emerald-300/80 dark:border-emerald-800 flex items-center justify-between">
                            <span className="truncate">🚛 Lokal</span>
                            <span className="font-mono font-black">{cell.lokalCount}</span>
                          </div>
                        )}
                        {cell.luarKotaCount > 0 && (
                          <div className="text-[9px] font-bold px-1 py-0.2 rounded bg-blue-100 dark:bg-blue-950/90 text-blue-800 dark:text-blue-300 border border-blue-300/80 dark:border-blue-800 flex items-center justify-between">
                            <span className="truncate">🚢 Luar Kota</span>
                            <span className="font-mono font-black">{cell.luarKotaCount}</span>
                          </div>
                        )}
                        {cell.kanvasCount > 0 && (
                          <div className="text-[9px] font-bold px-1 py-0.2 rounded bg-purple-100 dark:bg-purple-950/90 text-purple-800 dark:text-purple-300 border border-purple-300/80 dark:border-purple-800 flex items-center justify-between">
                            <span className="truncate">📦 Kanvas</span>
                            <span className="font-mono font-black">{cell.kanvasCount}</span>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="text-[9px] font-medium text-slate-400 text-center py-1 italic">
                        Off
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Selected Date Details Panel (Rincian Driver, Helper, Kirim Area, Armada & Jadwal Kanvas LKT) */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3.5 shadow-xs space-y-3">
            {(() => {
              const allDaysFlat = filteredWeeks.flatMap((w: AdminScheduleWeek) => w.days);
              const activeDayObj = allDaysFlat.find((d: AdminScheduleDay) => d.dateString === selectedCalendarDate);

              // Collect all Kanvas LKT trips across the active month for the History Kanvas LKT summary
              const kanvasLktMonthHistory = allDaysFlat.flatMap((d: AdminScheduleDay) =>
                d.pengiriman
                  .filter((p: DeliveryAssignment) => standardizeAreaName(p.area).toUpperCase().includes('KANVAS LKT') || p.area.toUpperCase().includes('KANVAS'))
                  .map((p: DeliveryAssignment) => ({
                    dayName: d.dayName,
                    dateString: d.dateString,
                    dayNumber: d.dayNumber,
                    ...p
                  }))
              );

              if (!activeDayObj || activeDayObj.pengiriman.length === 0) {
                return (
                  <div className="p-6 text-center bg-slate-50 dark:bg-slate-950/60 rounded-xl border border-slate-200 dark:border-slate-800 space-y-1.5">
                    <Calendar className="w-6 h-6 text-slate-400 mx-auto" />
                    <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200">
                      Tidak Ada Jadwal Pengiriman pada {selectedCalendarDate}
                    </h4>
                    <p className="text-[11px] text-slate-500">
                      Silakan klik tanggal lain pada kalender di atas untuk melihat rincian pengiriman.
                    </p>
                  </div>
                );
              }

              let lokalInSelected = 0;
              let luarKotaInSelected = 0;
              let kanvasLktInSelected = 0;
              activeDayObj.pengiriman.forEach((p: DeliveryAssignment) => {
                const std = standardizeAreaName(p.area).toUpperCase();
                if (std.includes('KANVAS LKT') || p.area.toUpperCase().includes('KANVAS')) {
                  kanvasLktInSelected++;
                }
                if (std.includes('DENPASAR') || std.includes('SINGARAJA') || std.includes('NEGARA') || std.includes('GIANYAR') || std.includes('TABANAN') || std.includes('KUTA') || std.includes('BALI')) {
                  luarKotaInSelected++;
                } else {
                  lokalInSelected++;
                }
              });

              const storeSchedules = logisticsStore.getSchedules();

              const filteredPengiriman = activeDayObj.pengiriman.filter((p: DeliveryAssignment) => {
                const standardArea = standardizeAreaName(p.area).toUpperCase();
                const isKanvasLkt = standardArea.includes('KANVAS LKT') || p.area.toUpperCase().includes('KANVAS');
                const isLuarPulau = standardArea.includes('DENPASAR') || standardArea.includes('SINGARAJA') || standardArea.includes('NEGARA') || standardArea.includes('GIANYAR') || standardArea.includes('TABANAN') || standardArea.includes('KUTA') || standardArea.includes('BALI');

                if (categoryFilter === 'kanvas_lkt' && !isKanvasLkt) return false;
                if (categoryFilter === 'lokal' && isLuarPulau) return false;
                if (categoryFilter === 'luar_kota' && !isLuarPulau) return false;

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
                  const matched = storeSchedules.find(s => {
                    if (p.id && s.id === p.id) return true;
                    if (s.fleet?.initialCode === p.armada && s.crew?.name === p.driver) return true;
                    return false;
                  });
                  const effStatus: ShipmentStatus = matched?.status || 'scheduled';
                  if (effStatus !== scheduleStatusFilter) {
                    return false;
                  }
                }

                return true;
              });

              return (
                <div className="space-y-2">
                  {/* Selected Date Title Bar - Compact */}
                  <div className="bg-slate-100 dark:bg-slate-800/90 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg bg-emerald-600 text-white flex items-center justify-center font-bold shadow-2xs">
                        <Calendar className="w-3.5 h-3.5" />
                      </div>
                      <div>
                        <span className="text-[9px] font-black uppercase text-emerald-700 dark:text-emerald-400 tracking-wider block leading-tight">
                          RINCIAN PENGIRIMAN TERFAKTUR
                        </span>
                        <h3 className="text-xs sm:text-sm font-black text-slate-900 dark:text-white leading-tight">
                          {activeDayObj.dayName}, {activeDayObj.dateString}
                        </h3>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 flex-wrap">
                      <button
                        type="button"
                        onClick={() => setCategoryFilter('all')}
                        className={`px-2 py-0.5 rounded-lg text-[11px] font-black transition cursor-pointer ${
                          categoryFilter === 'all'
                            ? 'bg-emerald-600 text-white shadow-2xs'
                            : 'bg-slate-200 dark:bg-slate-900 text-slate-700 dark:text-slate-300'
                        }`}
                      >
                        Semua ({activeDayObj.pengiriman.length})
                      </button>
                      <button
                        type="button"
                        onClick={() => setCategoryFilter(categoryFilter === 'lokal' ? 'all' : 'lokal')}
                        className={`px-2 py-0.5 rounded-lg text-[11px] font-bold border transition cursor-pointer ${
                          categoryFilter === 'lokal'
                            ? 'bg-emerald-600 text-white border-emerald-500'
                            : 'bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800'
                        }`}
                      >
                        🚛 {lokalInSelected} Area Lokal
                      </button>
                      <button
                        type="button"
                        onClick={() => setCategoryFilter(categoryFilter === 'luar_kota' ? 'all' : 'luar_kota')}
                        className={`px-2 py-0.5 rounded-lg text-[11px] font-bold border transition cursor-pointer ${
                          categoryFilter === 'luar_kota'
                            ? 'bg-blue-600 text-white border-blue-500'
                            : 'bg-blue-100 dark:bg-blue-950 text-blue-800 dark:text-blue-300 border-blue-300 dark:border-blue-800'
                        }`}
                      >
                        🚢 {luarKotaInSelected} Area Luar Kota
                      </button>
                      <button
                        type="button"
                        onClick={() => setCategoryFilter(categoryFilter === 'kanvas_lkt' ? 'all' : 'kanvas_lkt')}
                        className={`px-2 py-0.5 rounded-lg text-[11px] font-bold border transition cursor-pointer ${
                          categoryFilter === 'kanvas_lkt'
                            ? 'bg-purple-600 text-white border-purple-500'
                            : 'bg-purple-100 dark:bg-purple-950 text-purple-800 dark:text-purple-300 border-purple-300 dark:border-purple-800'
                        }`}
                      >
                        📦 {kanvasLktInSelected} Kanvas LKT
                      </button>
                    </div>
                  </div>

                  {/* Shipment Details Table - Compact & Rapat */}
                  <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
                    <table className="w-full text-xs text-left border-collapse min-w-[780px]">
                      <thead>
                        <tr className="bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-100 font-extrabold border-b border-slate-200 dark:border-slate-700 uppercase tracking-wider text-[10px]">
                          <th className="py-1.5 px-2 text-center w-9 border-r border-slate-200 dark:border-slate-700">#</th>
                          <th className="py-1.5 px-2.5 border-r border-slate-200 dark:border-slate-700 w-36">DRIVER</th>
                          <th className="py-1.5 px-2.5 border-r border-slate-200 dark:border-slate-700 w-32">HELPER 1</th>
                          <th className="py-1.5 px-2.5 border-r border-slate-200 dark:border-slate-700 w-32">HELPER 2</th>
                          <th className="py-1.5 px-2.5 border-r border-slate-200 dark:border-slate-700">KIRIM AREA (TUJUAN)</th>
                          <th className="py-1.5 px-2.5 border-r border-slate-200 dark:border-slate-700 w-28">ARMADA</th>
                          <th className="py-1.5 px-2.5 border-r border-slate-200 dark:border-slate-700 w-32">STATUS</th>
                          <th className="py-1.5 px-2 text-center w-16">AKSI</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200 dark:divide-slate-800 font-medium">
                        {filteredPengiriman.length === 0 ? (
                          <tr>
                            <td colSpan={8} className="p-6 text-center bg-slate-50 dark:bg-slate-900/50">
                              <div className="max-w-md mx-auto space-y-1.5">
                                <Search className="w-5 h-5 text-slate-400 mx-auto" />
                                <div className="text-xs font-bold text-slate-700 dark:text-slate-300">
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
                                  className="mt-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white cursor-pointer"
                                >
                                  Reset Filter
                                </button>
                              </div>
                            </td>
                          </tr>
                        ) : (
                          filteredPengiriman.map((p: DeliveryAssignment, pIdx: number) => {
                            const standardArea = standardizeAreaName(p.area);
                            const upperArea = standardArea.toUpperCase();
                            const isKanvasLkt = upperArea.includes('KANVAS LKT') || p.area.toUpperCase().includes('KANVAS');
                            const isLuarPulau = upperArea.includes('DENPASAR') || upperArea.includes('SINGARAJA') || upperArea.includes('NEGARA') || upperArea.includes('GIANYAR') || upperArea.includes('TABANAN') || upperArea.includes('KUTA') || upperArea.includes('BALI');
                            const driverInitials = getDriverInitials(p.driver);
                            const avatarStyle = DRIVER_AVATAR_COLORS[p.driver] || { 
                              bg: 'bg-slate-100 dark:bg-slate-800', 
                              text: 'text-slate-700 dark:text-slate-300', 
                              ring: 'border-slate-300 dark:border-slate-700' 
                            };

                            const matchedSch = storeSchedules.find(s => {
                              if (p.id && s.id === p.id) return true;
                              if (s.fleet?.initialCode === p.armada && s.crew?.name === p.driver) return true;
                              return false;
                            });

                            const currentStatus: ShipmentStatus = matchedSch?.status || 'scheduled';

                            const statusBadgeConfig: Record<ShipmentStatus, { label: string; bg: string; text: string; border: string }> = {
                              scheduled: { label: 'Terjadwal', bg: 'bg-blue-50 dark:bg-blue-950/80', text: 'text-blue-700 dark:text-blue-300', border: 'border-blue-300 dark:border-blue-800' },
                              picked_up: { label: 'Telah Dimuat', bg: 'bg-amber-50 dark:bg-amber-950/80', text: 'text-amber-800 dark:text-amber-300', border: 'border-amber-300 dark:border-amber-800' },
                              in_transit: { label: 'Dalam Perjalanan', bg: 'bg-purple-50 dark:bg-purple-950/80', text: 'text-purple-700 dark:text-purple-300', border: 'border-purple-300 dark:border-purple-800' },
                              delivered: { label: 'Terkirim', bg: 'bg-emerald-50 dark:bg-emerald-950/80', text: 'text-emerald-700 dark:text-emerald-300', border: 'border-emerald-300 dark:border-emerald-800' },
                              delayed: { label: 'Tertunda', bg: 'bg-rose-50 dark:bg-rose-950/80', text: 'text-rose-700 dark:text-rose-300', border: 'border-rose-300 dark:border-rose-800' }
                            };

                            const cfg = statusBadgeConfig[currentStatus] || statusBadgeConfig.scheduled;

                            return (
                              <tr
                                key={`cal-detail-${pIdx}-${p.driver}-${p.armada}`}
                                className={`hover:bg-slate-50 dark:hover:bg-slate-800/60 transition ${
                                  isKanvasLkt
                                    ? 'bg-purple-50/30 dark:bg-purple-950/15'
                                    : isLuarPulau
                                    ? 'bg-blue-50/30 dark:bg-blue-950/15'
                                    : ''
                                }`}
                              >
                                <td className="py-1.5 px-2 text-center font-bold text-slate-500 border-r border-slate-200 dark:border-slate-800 text-[11px]">
                                  {pIdx + 1}
                                </td>

                                {/* Driver */}
                                <td className="py-1.5 px-2.5 border-r border-slate-200 dark:border-slate-800">
                                  <div className="flex items-center gap-1.5">
                                    <div className={`w-5 h-5 rounded-full border ${avatarStyle.bg} ${avatarStyle.ring} ${avatarStyle.text} flex items-center justify-center font-black text-[9px] shrink-0`}>
                                      {driverInitials}
                                    </div>
                                    <span className="font-extrabold text-slate-900 dark:text-white text-xs">
                                      {p.driver}
                                    </span>
                                  </div>
                                </td>

                                {/* Helper 1 */}
                                <td className="py-1.5 px-2.5 border-r border-slate-200 dark:border-slate-800">
                                  <span className={`font-semibold text-xs ${p.helper && p.helper !== '-' ? 'text-slate-800 dark:text-slate-200' : 'text-slate-400'}`}>
                                    {p.helper || '-'}
                                  </span>
                                </td>
                                {/* Helper 2 */}
                                <td className="py-1.5 px-2.5 border-r border-slate-200 dark:border-slate-800">
                                  <span className={`font-semibold text-xs ${p.helper2 && p.helper2 !== '-' ? 'text-slate-800 dark:text-slate-200' : 'text-slate-400'}`}>
                                    {p.helper2 || '-'}
                                  </span>
                                </td>

                                {/* Kirim Area */}
                                <td className="py-1.5 px-2.5 border-r border-slate-200 dark:border-slate-800">
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    <span className={`text-[11px] font-bold uppercase px-2 py-0.5 rounded-md border ${
                                      isKanvasLkt
                                        ? 'bg-purple-50 text-purple-800 dark:bg-purple-950/70 dark:text-purple-200 border-purple-300 dark:border-purple-700'
                                        : 'bg-blue-50 text-blue-800 dark:bg-blue-950/60 dark:text-blue-200 border-blue-200 dark:border-blue-800'
                                    }`}>
                                      {standardArea}
                                    </span>
                                    {isKanvasLkt && (
                                      <span className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded bg-purple-600 text-white">
                                        KANVAS
                                      </span>
                                    )}
                                  </div>
                                </td>

                                {/* Armada & Cabang */}
                                <td className="py-1.5 px-2.5 border-r border-slate-200 dark:border-slate-800">
                                  <div className="flex flex-col gap-1 items-start">
                                    <span className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-300 dark:border-slate-700 font-mono font-bold text-[11px]">
                                      {p.armada}
                                    </span>
                                    {(() => {
                                      const br = branchStore.getScheduleBranch(p.id, p.area, p.armada);
                                      return (
                                        <span className="text-[9px] font-bold text-slate-600 dark:text-slate-400 bg-slate-200/70 dark:bg-slate-800 px-1.5 py-0.2 rounded border border-slate-300 dark:border-slate-700">
                                          {br.name}
                                        </span>
                                      );
                                    })()}
                                  </div>
                                </td>

                                {/* Status */}
                                <td className="py-1.5 px-2.5 border-r border-slate-200 dark:border-slate-800">
                                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold border ${cfg.bg} ${cfg.text} ${cfg.border}`}>
                                    <span className={`w-1.5 h-1.5 rounded-full ${
                                      currentStatus === 'delivered' ? 'bg-emerald-500' :
                                      currentStatus === 'in_transit' ? 'bg-purple-500 animate-pulse' :
                                      currentStatus === 'picked_up' ? 'bg-amber-500' :
                                      currentStatus === 'delayed' ? 'bg-rose-500 animate-ping' : 'bg-blue-500'
                                    }`} />
                                    <span>{cfg.label}</span>
                                  </span>
                                </td>

                                 {/* Aksi */}
                                <td className="py-1.5 px-2 text-center">
                                  <div className="flex items-center justify-center gap-1">
                                    <button
                                      type="button"
                                      onClick={() => handleOpenEditTripModal(p, activeDayObj.dayNumber, activeDayObj.dateString, pIdx)}
                                      className="p-1 rounded-md bg-amber-500/10 hover:bg-amber-500/25 text-amber-600 dark:text-amber-400 border border-amber-500/30 transition cursor-pointer"
                                      title="Edit Rincian Pengiriman Ini"
                                    >
                                      <Edit className="w-3 h-3" />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => setDeleteConfirmModal({ p, dayNumber: activeDayObj.dayNumber, tripIndex: pIdx, dateString: activeDayObj.dateString })}
                                      className="p-1 rounded-md bg-rose-500/10 hover:bg-rose-500/25 text-rose-600 dark:text-rose-400 border border-rose-500/30 transition cursor-pointer"
                                      title="Hapus Rincian Pengiriman Ini"
                                    >
                                      <Trash2 className="w-3 h-3" />
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
        </>
      ) : activeSubPage === 'upload_excel' ? (
        /* HALAMAN BARU 1: FORM UNGGAH FILE JADWAL PENGIRIMAN (Tanpa Cabang Data) */
        <div className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 sm:p-8 shadow-sm space-y-6 animate-in fade-in duration-200">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-800 pb-4">
            <div>
              <h2 className="text-lg sm:text-xl font-black text-slate-900 dark:text-white flex items-center gap-2.5">
                <FileSpreadsheet className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                <span>Unggah File Jadwal Pengiriman</span>
              </h2>
              <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
                Pilih periode bulan, mode import, dan unggah file Excel (.xls, .xlsx, .csv) untuk diproses pada halaman pemrosesan jadwal.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setActiveSubPage('schedule')}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold border border-slate-300 dark:border-slate-700 transition cursor-pointer w-fit shadow-2xs"
            >
              <ChevronLeft className="w-4 h-4" />
              <span>Kembali ke Jadwal Pengiriman</span>
            </button>
          </div>

          <div className="max-w-3xl space-y-5">
            {/* BULAN DATA & TAHUN DATA (Cabang Data Dihapus) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-200 mb-2">
                  BULAN DATA
                </label>
                <select
                  value={importMonth}
                  onChange={(e) => setImportMonth(e.target.value)}
                  className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl px-4 py-3 text-sm font-medium text-slate-900 dark:text-white focus:outline-none focus:border-blue-600 cursor-pointer shadow-2xs"
                >
                  {MONTH_NAMES.map(m => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-200 mb-2">
                  TAHUN DATA
                </label>
                <select
                  value={importYear}
                  onChange={(e) => setImportYear(e.target.value)}
                  className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl px-4 py-3 text-sm font-medium text-slate-900 dark:text-white focus:outline-none focus:border-blue-600 cursor-pointer shadow-2xs"
                >
                  {['2024', '2025', '2026', '2027', '2028', '2029', '2030'].map(yr => (
                    <option key={yr} value={yr}>{yr}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* MODE IMPORT */}
            <div>
              <label className="block text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-200 mb-2">
                MODE IMPORT
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <label
                  onClick={() => setImportMode('tambahkan')}
                  className={`flex items-start gap-3 p-4 rounded-xl border cursor-pointer transition bg-white dark:bg-slate-950 ${
                    importMode === 'tambahkan'
                      ? 'border-blue-600 ring-2 ring-blue-500/20'
                      : 'border-slate-300 dark:border-slate-700 hover:border-slate-400'
                  }`}
                >
                  <input
                    type="radio"
                    name="importModeRadio"
                    checked={importMode === 'tambahkan'}
                    onChange={() => setImportMode('tambahkan')}
                    className="mt-1 w-4 h-4 text-blue-600 focus:ring-blue-500 cursor-pointer"
                  />
                  <div>
                    <div className="text-sm font-black text-slate-900 dark:text-white">Tambahkan data</div>
                    <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      Data bulan yang sama tidak dihapus.
                    </div>
                  </div>
                </label>

                <label
                  onClick={() => setImportMode('ganti')}
                  className={`flex items-start gap-3 p-4 rounded-xl border cursor-pointer transition bg-white dark:bg-slate-950 ${
                    importMode === 'ganti'
                      ? 'border-blue-600 ring-2 ring-blue-500/20'
                      : 'border-slate-300 dark:border-slate-700 hover:border-slate-400'
                  }`}
                >
                  <input
                    type="radio"
                    name="importModeRadio"
                    checked={importMode === 'ganti'}
                    onChange={() => setImportMode('ganti')}
                    className="mt-1 w-4 h-4 text-blue-600 focus:ring-blue-500 cursor-pointer"
                  />
                  <div>
                    <div className="text-sm font-black text-slate-900 dark:text-white">Ganti data bulan ini</div>
                    <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      Data lama periode sama dihapus lalu diimport ulang.
                    </div>
                  </div>
                </label>
              </div>
            </div>

            {/* FILE JADWAL PENGIRIMAN */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-200">
                  FILE JADWAL PENGIRIMAN
                </label>
                <button
                  type="button"
                  onClick={downloadScheduleTemplate}
                  className="inline-flex items-center gap-1 text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
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

              <div className="bg-blue-50/40 dark:bg-slate-950 border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-2xl p-4 space-y-2.5">
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-2 flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => modalFileInputRef.current?.click()}
                    className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs cursor-pointer transition shrink-0 shadow-xs"
                  >
                    Choose File
                  </button>
                  <span className="text-sm text-slate-700 dark:text-slate-300 truncate flex-1">
                    {selectedUploadFile ? selectedUploadFile.name : 'No file chosen'}
                  </span>
                  {selectedUploadFile && (
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedUploadFile(null);
                        setStagedCombinedTrips([]);
                        if (modalFileInputRef.current) modalFileInputRef.current.value = '';
                      }}
                      className="text-xs font-bold text-rose-500 hover:text-rose-400 px-2 cursor-pointer"
                    >
                      Hapus
                    </button>
                  )}
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Format didukung: .xls, .xlsx, .csv. Maksimal 10MB. Sistem akan menampilkan halaman pemrosesan &amp; preview jadwal sebelum import.
                </p>
              </div>
            </div>

            {/* TOMBOL AKSI: Preview & Proses File (Membuka Halaman Baru Pemrosesan) & Lihat Riwayat Upload */}
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
                className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-black shadow-md transition cursor-pointer"
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
                className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-white dark:bg-slate-950 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200 text-sm font-black border border-slate-300 dark:border-slate-700 transition cursor-pointer"
              >
                <span>Lihat Riwayat Upload</span>
              </button>
            </div>
          </div>
        </div>
      ) : (
        /* HALAMAN BARU 2: HALAMAN PEMROSESAN & PREVIEW FILE JADWAL EXCEL */
        <div className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 sm:p-8 shadow-sm space-y-6 animate-in fade-in duration-200">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-800 pb-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-full bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 text-[11px] font-black uppercase tracking-wider border border-blue-300 dark:border-blue-800">
                  Halaman Pemrosesan File
                </span>
              </div>
              <h2 className="text-lg sm:text-xl font-black text-slate-900 dark:text-white flex items-center gap-2 mt-1.5">
                <CheckCircle2 className="w-6 h-6 text-emerald-500" />
                <span>Pemrosesan &amp; Preview Jadwal Excel</span>
              </h2>
              <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                Periksa hasil pembacaan file <strong>{selectedUploadFile?.name || '-'}</strong> sebelum disimpan ke jadwal utama.
              </p>
            </div>

            <div className="flex items-center gap-2.5 flex-wrap">
              <button
                type="button"
                onClick={() => setActiveSubPage('upload_excel')}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold border border-slate-300 dark:border-slate-700 transition cursor-pointer"
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
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black shadow-md transition cursor-pointer"
              >
                <Save className="w-4 h-4" />
                <span>Simpan &amp; Import Jadwal ({stagedCombinedTrips.filter(x => x.source === 'excel').length} Baris)</span>
              </button>
            </div>
          </div>

          {/* Ringkasan Parameter Pemrosesan */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white dark:bg-slate-950 p-4 rounded-xl border border-slate-200 dark:border-slate-800">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">NAMA FILE EXCEL</span>
              <span className="text-sm font-black text-slate-900 dark:text-white mt-1 block truncate">
                {selectedUploadFile?.name || '-'}
              </span>
            </div>
            <div className="bg-white dark:bg-slate-950 p-4 rounded-xl border border-slate-200 dark:border-slate-800">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">PERIODE BULAN &amp; TAHUN</span>
              <span className="text-sm font-black text-slate-900 dark:text-white mt-1 block">
                {importMonth} {importYear}
              </span>
            </div>
            <div className="bg-white dark:bg-slate-950 p-4 rounded-xl border border-slate-200 dark:border-slate-800">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">MODE IMPORT &amp; BARIS TERBACA</span>
              <span className="text-sm font-black text-blue-600 dark:text-blue-400 mt-1 block">
                {importMode === 'tambahkan' ? 'Tambahkan data' : 'Ganti data bulan ini'} ({stagedCombinedTrips.filter(x => x.source === 'excel').length} Jadwal)
              </span>
            </div>
          </div>

          {/* Tabel Pratinjau Pemrosesan File */}
          <div className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-xs">
            <div className="max-h-[60vh] overflow-y-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-100 dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-b border-slate-200 dark:border-slate-800 sticky top-0">
                    <th className="p-3 font-bold">NO</th>
                    <th className="p-3 font-bold">TANGGAL KIRIM</th>
                    <th className="p-3 font-bold">DRIVER / SUPIR</th>
                    <th className="p-3 font-bold">HELPER</th>
                    <th className="p-3 font-bold">AREA KIRIM TUJUAN</th>
                    <th className="p-3 font-bold">ARMADA</th>
                    <th className="p-3 font-bold text-center">HAPUS BARIS</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800 text-slate-800 dark:text-slate-200">
                  {stagedCombinedTrips.filter(x => x.source === 'excel').length === 0 ? (
                    <tr>
                      <td colSpan={7} className="p-8 text-center text-slate-500">
                        Tidak ada baris jadwal yang terbaca dari file ini. Silakan kembali dan pilih file sesuai template.
                      </td>
                    </tr>
                  ) : (
                    stagedCombinedTrips
                      .filter(x => x.source === 'excel')
                      .map((item, idx) => (
                        <tr key={item.tempId} className="hover:bg-slate-50 dark:hover:bg-slate-900/50">
                          <td className="p-3 font-mono text-slate-500">{idx + 1}</td>
                          <td className="p-3 font-mono font-semibold">{item.dateStr || '-'}</td>
                          <td className="p-3 font-bold text-slate-900 dark:text-white">{item.driver}</td>
                          <td className="p-3">
                            {item.helper || '-'}{item.helper2 && item.helper2 !== '-' ? `, ${item.helper2}` : ''}
                          </td>
                          <td className="p-3 font-bold text-emerald-700 dark:text-emerald-400">{item.area}</td>
                          <td className="p-3 font-mono font-bold text-blue-700 dark:text-blue-400">{item.armada}</td>
                          <td className="p-3 text-center">
                            <button
                              type="button"
                              onClick={() => setStagedCombinedTrips(prev => prev.filter(x => x.tempId !== item.tempId))}
                              className="text-rose-500 hover:text-rose-400 cursor-pointer p-1.5 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/40 transition"
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
      )}

      {/* Modal Edit / Tambah Ritase Pengiriman */}
      {editingTripModal && editingTripModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xs overflow-y-auto animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 max-w-lg w-full shadow-2xl space-y-4 my-6">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-500/15 text-amber-500 flex items-center justify-center border border-amber-500/30">
                  <Edit className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                    {editingTripModal.isNew ? 'Tambah Ritase Pengiriman' : 'Edit Rincian Pengiriman'}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Tanggal: {editingTripModal.dateString}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setEditingTripModal(null)}
                className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-400 hover:text-slate-900 dark:hover:text-white flex items-center justify-center transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3.5 text-xs">
              <CrewCustomSelectDropdown
                label="Driver / Pengemudi *"
                value={editingTripModal.driver}
                options={getIntegratedDrivers()}
                onChange={(val) => setEditingTripModal({ ...editingTripModal, driver: val })}
                roleBadgeText="Kru Supir"
                accentColor="blue"
              />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <CrewCustomSelectDropdown
                  label="Helper / Kernet 1"
                  value={editingTripModal.helper}
                  options={getIntegratedHelpers()}
                  onChange={(val) => setEditingTripModal({ ...editingTripModal, helper: val })}
                  emptyLabel="- Tanpa Helper 1 -"
                  emptyValue=""
                  roleBadgeText="Kru Helper"
                  accentColor="emerald"
                />

                <CrewCustomSelectDropdown
                  label="Helper / Kernet 2 (Opsional)"
                  value={editingTripModal.helper2}
                  options={getIntegratedHelpers()}
                  onChange={(val) => setEditingTripModal({ ...editingTripModal, helper2: val })}
                  emptyLabel="- Tanpa Helper 2 -"
                  emptyValue=""
                  roleBadgeText="Kru Helper"
                  accentColor="emerald"
                />
              </div>

              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1">
                  Kirim Area / Tujuan ({OFFICIAL_DESTINATION_AREAS.length} Area Resmi)
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 max-h-44 overflow-y-auto p-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950">
                  {OFFICIAL_DESTINATION_AREAS.map(areaOpt => {
                    const isSel = editingTripModal.area.toUpperCase() === areaOpt.toUpperCase();
                    return (
                      <button
                        key={areaOpt}
                        type="button"
                        onClick={() => setEditingTripModal({ ...editingTripModal, area: areaOpt })}
                        className={`px-2.5 py-1.5 rounded-lg text-left text-xs font-bold transition cursor-pointer flex items-center justify-between border ${
                          isSel
                            ? 'bg-emerald-600 text-white border-emerald-500 shadow-2xs'
                            : 'bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 border-slate-200 dark:border-slate-800 hover:border-emerald-500/50'
                        }`}
                      >
                        <span className="truncate">{areaOpt}</span>
                        {isSel && <Check className="w-3.5 h-3.5 shrink-0" />}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5 mb-1.5">
                  <Building2 className="w-3.5 h-3.5 text-emerald-500" />
                  <span>Cabang Operasional *</span>
                </label>
                <select
                  value={editingTripModal.branchId || 'cab-banyuwangi'}
                  onChange={(e) => setEditingTripModal({ ...editingTripModal, branchId: e.target.value })}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white text-xs font-bold rounded-xl px-3.5 py-2.5 focus:outline-none focus:border-emerald-500 cursor-pointer mb-3"
                >
                  {branches.map(b => (
                    <option key={b.id} value={b.id}>Cabang {b.name} ({b.city})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1">
                  Armada Truk (Inisial &amp; Plat Nomor)
                </label>
                <select
                  value={editingTripModal.armada}
                  onChange={(e) => setEditingTripModal({ ...editingTripModal, armada: e.target.value })}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-900 dark:text-white font-bold focus:outline-none focus:border-emerald-500"
                >
                  {logisticsStore.getFleets().map(f => {
                    const liveInfo = logisticsStore.getFleetLiveOperationalInfo(f);
                    const isServis = !liveInfo.canBeScheduled;
                    return (
                      <option
                        key={f.id}
                        value={f.initialCode || f.plateNumber}
                        disabled={isServis}
                      >
                        {f.initialCode ? `[${f.initialCode}] ` : ''}{f.plateNumber} — {liveInfo.statusLabel}
                        {liveInfo.effectiveStatus === 'on-duty' && liveInfo.areaName ? ` (Kirim: ${liveInfo.areaName})` : ''}
                        {isServis ? ' [Servis - Tidak Bisa Dijadwalkan]' : ''}
                      </option>
                    );
                  })}
                </select>
                {(() => {
                  const selFleet = logisticsStore.getFleets().find(
                    f => (f.initialCode || f.plateNumber) === editingTripModal.armada || f.plateNumber === editingTripModal.armada
                  );
                  if (!selFleet) return null;
                  const liveInfo = logisticsStore.getFleetLiveOperationalInfo(selFleet);
                  return (
                    <div className="mt-1.5 flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-[11px]">
                      <div className="flex items-center gap-2">
                        <span className={`w-3 h-3 rounded-full shrink-0 ${liveInfo.dotColorClass}`} />
                        <span className="font-black text-slate-800 dark:text-slate-200">
                          Status Armada: {liveInfo.statusLabel}
                        </span>
                      </div>
                      <span className="text-[10px] font-semibold text-slate-600 dark:text-slate-400 truncate">
                        {liveInfo.effectiveStatus === 'on-duty' && liveInfo.areaName
                          ? `Sedang Kirim: ${liveInfo.areaName}`
                          : liveInfo.effectiveStatus === 'maintenance'
                          ? 'Sedang Perbaikan (Tidak Bisa Kirim)'
                          : 'Siap Digunakan Jadwal Kirim'}
                      </span>
                    </div>
                  );
                })()}
              </div>

              {isLuarKotaArea(editingTripModal.area) ? (
                <div className="p-3 rounded-xl bg-blue-500/5 border border-blue-500/25 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-black text-blue-600 dark:text-blue-400 uppercase tracking-wider flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5" />
                      <span>Jadwal Luar Kota (Tanggal &amp; Jam Keberangkatan / Kepulangan)</span>
                    </span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <div>
                        <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1">
                          Tanggal Keberangkatan *
                        </label>
                        <input
                          type="date"
                          value={editingTripModal.departureDateIso}
                          onChange={(e) => {
                            const nextDep = e.target.value;
                            const nextRet = editingTripModal.returnDateIso < nextDep ? nextDep : editingTripModal.returnDateIso;
                            setEditingTripModal({ ...editingTripModal, departureDateIso: nextDep, returnDateIso: nextRet });
                          }}
                          className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-900 dark:text-white font-bold focus:outline-none focus:border-blue-600"
                        />
                      </div>
                      <div>
                        <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1">
                          Jam Keberangkatan *
                        </label>
                        <input
                          type="time"
                          value={editingTripModal.departureTime}
                          onChange={(e) => {
                            const nextTime = e.target.value;
                            const autoNextDay = nextTime > editingTripModal.targetReturnTime && editingTripModal.returnDateIso === editingTripModal.departureDateIso
                              ? addDaysToIso(editingTripModal.departureDateIso, 1)
                              : editingTripModal.returnDateIso;
                            setEditingTripModal({ ...editingTripModal, departureTime: nextTime, returnDateIso: autoNextDay });
                          }}
                          className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-900 dark:text-white font-bold focus:outline-none focus:border-blue-600"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <div>
                        <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1">
                          Tanggal Kepulangan *
                        </label>
                        <input
                          type="date"
                          value={editingTripModal.returnDateIso}
                          onChange={(e) => setEditingTripModal({ ...editingTripModal, returnDateIso: e.target.value })}
                          className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-900 dark:text-white font-bold focus:outline-none focus:border-blue-600"
                        />
                      </div>
                      <div>
                        <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1">
                          Target Jam Kepulangan *
                        </label>
                        <input
                          type="time"
                          value={editingTripModal.targetReturnTime}
                          onChange={(e) => setEditingTripModal({ ...editingTripModal, targetReturnTime: e.target.value })}
                          className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-900 dark:text-white font-bold focus:outline-none focus:border-blue-600"
                        />
                      </div>
                    </div>
                  </div>
                  {editingTripModal.returnDateIso !== editingTripModal.departureDateIso && (
                    <div className="text-[11px] font-semibold text-blue-600 dark:text-blue-300 bg-blue-500/10 px-2.5 py-1.5 rounded-lg border border-blue-500/20">
                      📌 Keberangkatan malam / lintas hari: jadwal kalender mengikuti Tanggal Kepulangan ({editingTripModal.returnDateIso}).
                    </div>
                  )}
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1">
                      Jam Keberangkatan *
                    </label>
                    <input
                      type="time"
                      value={editingTripModal.departureTime}
                      onChange={(e) => setEditingTripModal({ ...editingTripModal, departureTime: e.target.value })}
                      className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-900 dark:text-white font-bold focus:outline-none focus:border-blue-600"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1">
                      Target Jam Kepulangan *
                    </label>
                    <input
                      type="time"
                      value={editingTripModal.targetReturnTime}
                      onChange={(e) => setEditingTripModal({ ...editingTripModal, targetReturnTime: e.target.value })}
                      className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-900 dark:text-white font-bold focus:outline-none focus:border-blue-600"
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1">
                  Target / Catatan PO (Opsional)
                </label>
                <input
                  type="text"
                  value={editingTripModal.target}
                  onChange={(e) => setEditingTripModal({ ...editingTripModal, target: e.target.value })}
                  placeholder="Gudang Pusat AKK Banyuwangi DC"
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-900 dark:text-white font-medium focus:outline-none focus:border-blue-600"
                />
              </div>
            </div>

            <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setEditingTripModal(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleSaveTripModal}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white shadow-md transition cursor-pointer"
              >
                <Save className="w-3.5 h-3.5" />
                <span>Simpan Perubahan Permanen</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Pop-up Modal: Form Tambah Jadwal Baru (Manual) */}
      {isUploadConfigModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xs overflow-y-auto animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 max-w-xl w-full shadow-2xl space-y-5 my-4">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-sm">
                  <Plus className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900 dark:text-white">
                    Form Tambah Jadwal Baru (Manual)
                  </h3>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsUploadConfigModalOpen(false)}
                className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white flex items-center justify-center transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Form Body */}
            <div className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div className="sm:col-span-2">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5 mb-1.5">
                    <Building2 className="w-3.5 h-3.5 text-emerald-500" />
                    <span>Cabang Asal Pengiriman *</span>
                  </label>
                  <select
                    value={manualScheduleForm.branchId}
                    onChange={(e) => setManualScheduleForm({ ...manualScheduleForm, branchId: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white text-xs font-bold rounded-xl px-3.5 py-2.5 focus:outline-none focus:border-emerald-500 cursor-pointer"
                  >
                    {branches.map(b => (
                      <option key={b.id} value={b.id}>Cabang {b.name} ({b.city})</option>
                    ))}
                  </select>
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-emerald-500" />
                      <span>Tanggal Kirim *</span>
                    </label>
                    <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                      Otomatis Hari Ini
                    </span>
                  </div>
                  <input
                    type="date"
                    value={isLuarKotaArea(manualScheduleForm.area) ? (manualScheduleForm.returnDateIso || manualScheduleForm.dateIso) : manualScheduleForm.dateIso}
                    onChange={(e) => {
                      const nextIso = e.target.value;
                      const isNightOrCrossDay = isLuarKotaArea(manualScheduleForm.area) && (
                        manualScheduleForm.departureTime > manualScheduleForm.targetReturnTime ||
                        manualScheduleForm.returnDateIso > manualScheduleForm.departureDateIso
                      );
                      const nextDep = isNightOrCrossDay ? addDaysToIso(nextIso, -1) : nextIso;
                      setManualScheduleForm({
                        ...manualScheduleForm,
                        dateIso: nextIso,
                        returnDateIso: nextIso,
                        departureDateIso: nextDep
                      });
                    }}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white text-xs font-bold rounded-xl px-3.5 py-2.5 focus:outline-none focus:border-emerald-500 cursor-pointer"
                  />
                  <div className="flex items-center gap-1.5 mt-2">
                    <button
                      type="button"
                      onClick={() => {
                        const iso = getTodayIso();
                        const isNightOrCrossDay = isLuarKotaArea(manualScheduleForm.area) && (
                          manualScheduleForm.departureTime > manualScheduleForm.targetReturnTime ||
                          manualScheduleForm.returnDateIso > manualScheduleForm.departureDateIso
                        );
                        setManualScheduleForm({
                          ...manualScheduleForm,
                          dateIso: iso,
                          returnDateIso: iso,
                          departureDateIso: isNightOrCrossDay ? addDaysToIso(iso, -1) : iso
                        });
                      }}
                      className="px-2.5 py-1 text-[10px] font-bold rounded-lg bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/25 border border-emerald-500/30 transition cursor-pointer"
                    >
                      Hari Ini
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const d = new Date();
                        d.setDate(d.getDate() + 1);
                        const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
                        const isNightOrCrossDay = isLuarKotaArea(manualScheduleForm.area) && (
                          manualScheduleForm.departureTime > manualScheduleForm.targetReturnTime ||
                          manualScheduleForm.returnDateIso > manualScheduleForm.departureDateIso
                        );
                        setManualScheduleForm({
                          ...manualScheduleForm,
                          dateIso: iso,
                          returnDateIso: iso,
                          departureDateIso: isNightOrCrossDay ? addDaysToIso(iso, -1) : iso
                        });
                      }}
                      className="px-2.5 py-1 text-[10px] font-bold rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 transition cursor-pointer"
                    >
                      Besok (+1)
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const d = new Date();
                        d.setDate(d.getDate() + 2);
                        const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
                        const isNightOrCrossDay = isLuarKotaArea(manualScheduleForm.area) && (
                          manualScheduleForm.departureTime > manualScheduleForm.targetReturnTime ||
                          manualScheduleForm.returnDateIso > manualScheduleForm.departureDateIso
                        );
                        setManualScheduleForm({
                          ...manualScheduleForm,
                          dateIso: iso,
                          returnDateIso: iso,
                          departureDateIso: isNightOrCrossDay ? addDaysToIso(iso, -1) : iso
                        });
                      }}
                      className="px-2.5 py-1 text-[10px] font-bold rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 transition cursor-pointer"
                    >
                      Lusa (+2)
                    </button>
                  </div>
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1.5">
                    Armada Truk *
                  </label>
                  <select
                    value={manualScheduleForm.armada}
                    onChange={(e) => setManualScheduleForm({ ...manualScheduleForm, armada: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white text-xs font-bold rounded-xl px-3.5 py-2.5 focus:outline-none focus:border-blue-600 cursor-pointer"
                  >
                    {logisticsStore.getFleets().map(f => {
                      const liveInfo = logisticsStore.getFleetLiveOperationalInfo(f, manualScheduleForm.dateIso);
                      const isServis = !liveInfo.canBeScheduled;
                      return (
                        <option
                          key={f.id}
                          value={f.initialCode || f.plateNumber}
                          disabled={isServis}
                        >
                          {f.initialCode ? `[${f.initialCode}] ` : ''}{f.plateNumber} — {liveInfo.statusLabel}
                          {liveInfo.effectiveStatus === 'on-duty' && liveInfo.areaName ? ` (Kirim: ${liveInfo.areaName})` : ''}
                          {isServis ? ' [Servis - Tidak Bisa Dijadwalkan]' : ''}
                        </option>
                      );
                    })}
                  </select>
                  {(() => {
                    const selFleet = logisticsStore.getFleets().find(
                      f => (f.initialCode || f.plateNumber) === manualScheduleForm.armada || f.plateNumber === manualScheduleForm.armada
                    );
                    if (!selFleet) return null;
                    const liveInfo = logisticsStore.getFleetLiveOperationalInfo(selFleet, manualScheduleForm.dateIso);
                    return (
                      <div className="mt-2 flex items-center justify-between gap-2 px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-[11px]">
                        <div className="flex items-center gap-2">
                          <span className={`w-3 h-3 rounded-full shrink-0 ${liveInfo.dotColorClass}`} />
                          <span className="font-black text-slate-800 dark:text-slate-200">
                            {liveInfo.statusLabel}
                          </span>
                        </div>
                        <span className="text-[10px] font-semibold text-slate-600 dark:text-slate-400 truncate">
                          {liveInfo.effectiveStatus === 'on-duty' && liveInfo.areaName
                            ? `Area Hari Ini: ${liveInfo.areaName}`
                            : liveInfo.effectiveStatus === 'maintenance'
                            ? 'Dalam Perbaikan (Servis)'
                            : 'Siap Digunakan Kirim'}
                        </span>
                      </div>
                    );
                  })()}
                </div>
              </div>

              {/* Jam Keberangkatan & Target Jam Kepulangan (Khusus Luar Kota ditambah Tanggal Keberangkatan & Tanggal Kepulangan) */}
              {isLuarKotaArea(manualScheduleForm.area) ? (
                <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    <div className="space-y-2.5">
                      <div>
                        <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5 mb-1.5">
                          <Calendar className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                          <span>Tanggal Keberangkatan *</span>
                        </label>
                        <input
                          type="date"
                          value={manualScheduleForm.departureDateIso}
                          onChange={(e) => {
                            const nextDep = e.target.value;
                            const isNight = manualScheduleForm.departureTime > manualScheduleForm.targetReturnTime;
                            const nextRet = isNight
                              ? addDaysToIso(nextDep, 1)
                              : (manualScheduleForm.returnDateIso < nextDep ? nextDep : manualScheduleForm.returnDateIso);
                            setManualScheduleForm({
                              ...manualScheduleForm,
                              dateIso: nextRet,
                              departureDateIso: nextDep,
                              returnDateIso: nextRet
                            });
                          }}
                          className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white text-xs font-bold rounded-xl px-3.5 py-2 focus:outline-none focus:border-blue-600 cursor-pointer"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5 mb-1.5">
                          <Clock className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                          <span>Jam Keberangkatan *</span>
                        </label>
                        <input
                          type="time"
                          value={manualScheduleForm.departureTime}
                          onChange={(e) => {
                            const nextTime = e.target.value;
                            const nextRet = nextTime > manualScheduleForm.targetReturnTime && manualScheduleForm.returnDateIso === manualScheduleForm.departureDateIso
                              ? addDaysToIso(manualScheduleForm.departureDateIso, 1)
                              : manualScheduleForm.returnDateIso;
                            setManualScheduleForm({
                              ...manualScheduleForm,
                              departureTime: nextTime,
                              returnDateIso: nextRet,
                              dateIso: nextRet
                            });
                          }}
                          className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white text-xs font-bold rounded-xl px-3.5 py-2 focus:outline-none focus:border-blue-600 cursor-pointer"
                        />
                      </div>
                    </div>

                    <div className="space-y-2.5">
                      <div>
                        <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5 mb-1.5">
                          <Calendar className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                          <span>Tanggal Kepulangan *</span>
                        </label>
                        <input
                          type="date"
                          value={manualScheduleForm.returnDateIso}
                          onChange={(e) => {
                            const nextRet = e.target.value;
                            const nextDep = manualScheduleForm.departureDateIso > nextRet ? nextRet : manualScheduleForm.departureDateIso;
                            setManualScheduleForm({
                              ...manualScheduleForm,
                              returnDateIso: nextRet,
                              dateIso: nextRet,
                              departureDateIso: nextDep
                            });
                          }}
                          className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white text-xs font-bold rounded-xl px-3.5 py-2 focus:outline-none focus:border-blue-600 cursor-pointer"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5 mb-1.5">
                          <Clock className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                          <span>Target Jam Kepulangan *</span>
                        </label>
                        <input
                          type="time"
                          value={manualScheduleForm.targetReturnTime}
                          onChange={(e) => {
                            const nextRetTime = e.target.value;
                            const nextRet = manualScheduleForm.departureTime > nextRetTime && manualScheduleForm.returnDateIso === manualScheduleForm.departureDateIso
                              ? addDaysToIso(manualScheduleForm.departureDateIso, 1)
                              : manualScheduleForm.returnDateIso;
                            setManualScheduleForm({
                              ...manualScheduleForm,
                              targetReturnTime: nextRetTime,
                              returnDateIso: nextRet,
                              dateIso: nextRet
                            });
                          }}
                          className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white text-xs font-bold rounded-xl px-3.5 py-2 focus:outline-none focus:border-blue-600 cursor-pointer"
                        />
                      </div>
                    </div>
                  </div>
                  {manualScheduleForm.returnDateIso !== manualScheduleForm.departureDateIso && (
                    <div className="text-[11px] font-semibold text-blue-600 dark:text-blue-400 bg-blue-500/10 px-3 py-1.5 rounded-lg border border-blue-500/20">
                      📌 Keberangkatan malam ({manualScheduleForm.departureDateIso}) &amp; kepulangan besok ({manualScheduleForm.returnDateIso}): Tanggal Kirim otomatis mengikuti Tanggal Kepulangan ({manualScheduleForm.returnDateIso}).
                    </div>
                  )}
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                  <div>
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5 mb-1.5">
                      <Clock className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                      <span>Jam Keberangkatan *</span>
                    </label>
                    <input
                      type="time"
                      value={manualScheduleForm.departureTime}
                      onChange={(e) => setManualScheduleForm({ ...manualScheduleForm, departureTime: e.target.value })}
                      className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white text-xs font-bold rounded-xl px-3.5 py-2 focus:outline-none focus:border-blue-600 cursor-pointer"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5 mb-1.5">
                      <Clock className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                      <span>Target Jam Kepulangan *</span>
                    </label>
                    <input
                      type="time"
                      value={manualScheduleForm.targetReturnTime}
                      onChange={(e) => setManualScheduleForm({ ...manualScheduleForm, targetReturnTime: e.target.value })}
                      className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white text-xs font-bold rounded-xl px-3.5 py-2 focus:outline-none focus:border-blue-600 cursor-pointer"
                    />
                  </div>
                </div>
              )}

              <div className="space-y-3">
                <CrewCustomSelectDropdown
                  label="Driver / Supir *"
                  value={manualScheduleForm.driver}
                  options={getIntegratedDrivers()}
                  onChange={(val) => setManualScheduleForm({ ...manualScheduleForm, driver: val })}
                  roleBadgeText="Kru Supir"
                  accentColor="blue"
                />

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <CrewCustomSelectDropdown
                    label="Helper 1 *"
                    value={manualScheduleForm.helper}
                    options={getIntegratedHelpers()}
                    onChange={(val) => setManualScheduleForm({ ...manualScheduleForm, helper: val })}
                    emptyLabel="- Tanpa Helper 1 -"
                    emptyValue="-"
                    roleBadgeText="Kru Helper"
                    accentColor="emerald"
                  />

                  <CrewCustomSelectDropdown
                    label="Helper 2 (Opsional)"
                    value={manualScheduleForm.helper2}
                    options={getIntegratedHelpers()}
                    onChange={(val) => setManualScheduleForm({ ...manualScheduleForm, helper2: val })}
                    emptyLabel="- Tanpa Helper 2 -"
                    emptyValue=""
                    roleBadgeText="Kru Helper"
                    accentColor="emerald"
                  />
                </div>
              </div>

              {/* Area Kirim Tujuan (UI/UX Modern Tanpa Select OS Bawaan & Tanpa Angka Nomor) */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-emerald-500" />
                    <span>Area Kirim Tujuan *</span>
                  </label>
                  <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                    {OFFICIAL_DESTINATION_AREAS.length} Area Terdaftar
                  </span>
                </div>

                {/* Selected Area Card with Expandable Searchable Picker */}
                <div className="rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 p-2.5 transition">
                  <div
                    onClick={() => setIsAreaPickerExpanded(!isAreaPickerExpanded)}
                    className="flex items-center justify-between gap-2 cursor-pointer select-none"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-9 h-9 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                        <MapPin className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <div className="text-xs font-black text-slate-900 dark:text-white truncate">
                          {manualScheduleForm.area || 'Klik untuk Pilih Area Tujuan'}
                        </div>
                        {manualScheduleForm.area ? (
                          <span className={`inline-block text-[9px] font-bold px-1.5 py-0.2 rounded border mt-0.5 ${getAreaRegionCategory(manualScheduleForm.area).badgeColor}`}>
                            {getAreaRegionCategory(manualScheduleForm.area).label}
                          </span>
                        ) : (
                          <span className="text-[10px] text-slate-500 dark:text-slate-400">
                            Pilih dari {OFFICIAL_DESTINATION_AREAS.length} area pengiriman resmi
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
                      className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[11px] flex items-center gap-1.5 transition cursor-pointer shadow-xs shrink-0"
                    >
                      <span>{isAreaPickerExpanded ? 'Tutup Pilihan' : 'Pilih / Ganti Area'}</span>
                      <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${isAreaPickerExpanded ? 'rotate-180' : ''}`} />
                    </button>
                  </div>

                  {/* Expanded Custom Interactive Area Selector */}
                  {isAreaPickerExpanded && (
                    <div className="mt-3 pt-3 border-t border-slate-200 dark:border-slate-800 space-y-2.5 animate-in fade-in duration-150">
                      {/* Search Bar with clear button */}
                      <div className="relative">
                        <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                          type="text"
                          value={areaSearchFilter}
                          onChange={(e) => setAreaSearchFilter(e.target.value)}
                          placeholder="Cari area (misal: Denpasar, Toko DR. Soetomo, Nusantara Expand, Titipan Kota Kota)..."
                          className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white text-xs rounded-lg pl-8 pr-8 py-2 focus:outline-none focus:border-emerald-500"
                          autoFocus
                        />
                        {areaSearchFilter && (
                          <button
                            type="button"
                            onClick={() => setAreaSearchFilter('')}
                            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-white text-xs cursor-pointer"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>

                      {/* Region Category Chips */}
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
                            className={`px-2.5 py-1 rounded-md font-bold whitespace-nowrap transition cursor-pointer ${
                              areaCategoryFilter === cat.id
                                ? 'bg-emerald-600 text-white shadow-xs'
                                : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800'
                            }`}
                          >
                            {cat.label}
                          </button>
                        ))}
                      </div>

                      {/* Interactive Area Options Grid */}
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
                                  ? 'bg-emerald-500/15 border-emerald-500 text-emerald-950 dark:text-emerald-200 shadow-2xs font-extrabold'
                                  : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-emerald-500/50 hover:bg-slate-50 dark:hover:bg-slate-800/60 text-slate-800 dark:text-slate-200'
                              }`}
                            >
                              <div className="min-w-0 pr-2">
                                <div className="text-xs truncate">{areaName}</div>
                                <span className={`inline-block text-[9px] font-bold px-1.5 py-0.2 rounded border mt-0.5 ${meta.badgeColor}`}>
                                  {meta.label}
                                </span>
                              </div>
                              {isSelected ? (
                                <div className="w-5 h-5 rounded-full bg-emerald-600 text-white flex items-center justify-center shrink-0">
                                  <Check className="w-3 h-3" />
                                </div>
                              ) : (
                                <span className="text-[10px] text-slate-400 font-semibold">Pilih</span>
                              )}
                            </button>
                          );
                        })}
                        {filteredOfficialAreas.length === 0 && (
                          <div className="col-span-2 py-4 text-center text-xs text-slate-400">
                            Tidak ada area yang cocok dengan pencarian "{areaSearchFilter}"
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setIsUploadConfigModalOpen(false)}
                className="px-4 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold transition cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={() => {
                  if (!manualScheduleForm.driver.trim() || !manualScheduleForm.area.trim()) {
                    return;
                  }
                  const stdArea = standardizeAreaName(manualScheduleForm.area.trim());
                  const isLuar = isLuarKotaArea(stdArea);
                  const depIso = isLuar ? (manualScheduleForm.departureDateIso || manualScheduleForm.dateIso) : manualScheduleForm.dateIso;
                  const retIso = isLuar
                    ? (manualScheduleForm.returnDateIso || (manualScheduleForm.departureTime > manualScheduleForm.targetReturnTime ? addDaysToIso(depIso, 1) : depIso))
                    : depIso;
                  const effectiveDateStr = isLuar ? retIso : depIso;

                  const manualEntry: ParsedSheetTrip & { source: 'manual'; tempId: string } = {
                    tempId: `man-direct-${Date.now()}`,
                    source: 'manual',
                    dateStr: effectiveDateStr,
                    departureDateIso: depIso,
                    returnDateIso: retIso,
                    driver: manualScheduleForm.driver.trim(),
                    helper: manualScheduleForm.helper.trim() || '-',
                    helper2: manualScheduleForm.helper2.trim() || '-',
                    area: stdArea,
                    armada: manualScheduleForm.armada.trim() || 'DS3',
                    target: manualScheduleForm.target.trim() || 'Gudang Pusat AKK Banyuwangi DC',
                    departureTime: manualScheduleForm.departureTime || '07:30',
                    targetReturnTime: manualScheduleForm.targetReturnTime || '17:00'
                  };
                  branchStore.setScheduleBranchId(manualEntry.tempId, manualScheduleForm.branchId);
                  mergeAndSaveCombinedTrips(
                    [manualEntry],
                    'tambahkan',
                    'Form Tambah Jadwal Baru'
                  );
                  // Reset form after submitting so old data never sticks
                  const initDrivers = getIntegratedDrivers();
                  const initHelpers = getIntegratedHelpers();
                  const today = getTodayIso();
                  setManualScheduleForm({
                    dateIso: today,
                    departureDateIso: today,
                    returnDateIso: today,
                    driver: initDrivers[0]?.name || 'Budiono',
                    helper: initHelpers[0]?.name || 'Saifur Rizal',
                    helper2: '',
                    area: 'Denpasar 1',
                    armada: 'DS3',
                    target: '',
                    departureTime: '07:30',
                    targetReturnTime: '17:00',
                    branchId: manualScheduleForm.branchId
                  });
                  setAreaSearchFilter('');
                  setIsAreaPickerExpanded(false);
                  setIsUploadConfigModalOpen(false);
                }}
                className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-black transition flex items-center gap-2 cursor-pointer shadow-sm"
              >
                <Save className="w-4 h-4" />
                <span>Simpan Jadwal Baru</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Riwayat / Log Unggah & Perubahan Jadwal Modal (with User Name & Detailed Changes) */}
      {isHistoryModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xs overflow-y-auto animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 max-w-2xl w-full shadow-2xl space-y-4 my-6">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-amber-500/15 text-amber-400 flex items-center justify-center border border-amber-500/30">
                  <HistoryIcon className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Riwayat / Log Unggah &amp; Perubahan Jadwal</h3>
                  <p className="text-[11px] text-slate-400">Catatan lengkap aktivitas unggah Excel, penambahan jadwal, dan rincian perubahan beserta nama pengguna</p>
                </div>
              </div>
              <button
                onClick={() => setIsHistoryModalOpen(false)}
                className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs text-slate-300 max-h-[60vh] overflow-y-auto pr-1">
              {scheduleChangeLogs.length === 0 ? (
                <div className="p-6 text-center text-slate-500 bg-slate-950 rounded-xl border border-slate-800">
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
                      ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                      : log.actionType === 'manual_create'
                      ? 'bg-blue-500/20 text-blue-300 border-blue-500/30'
                      : log.actionType === 'manual_edit'
                      ? 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                      : 'bg-rose-500/20 text-rose-300 border-rose-500/30';

                  const badgeLabel =
                    log.actionType === 'upload_excel'
                      ? 'Unggah Excel'
                      : log.actionType === 'manual_create'
                      ? 'Tambah Jadwal'
                      : log.actionType === 'manual_edit'
                      ? 'Edit Jadwal'
                      : 'Hapus Jadwal';

                  return (
                    <div key={log.id} className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2.5">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-white text-xs">{log.fileName}</span>
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${badgeStyle}`}>
                              {badgeLabel}
                            </span>
                          </div>
                          <div className="text-[11px] text-slate-400 mt-1 flex items-center gap-2 flex-wrap">
                            <span>🕒 {dateFormatted} WIB</span>
                            <span>&bull;</span>
                            <span className="text-emerald-400 font-bold">
                              👤 Oleh: {log.userName} ({log.userRole})
                            </span>
                            {typeof log.rowCount === 'number' && (
                              <>
                                <span>&bull;</span>
                                <span className="font-mono text-slate-300">{log.rowCount} Baris Tervalidasi</span>
                              </>
                            )}
                          </div>
                        </div>
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 w-fit">
                          Tersimpan
                        </span>
                      </div>

                      <div className="text-xs text-slate-200 font-semibold border-t border-slate-800/80 pt-2">
                        {log.summary}
                      </div>

                      {log.changes && log.changes.length > 0 && (
                        <div className="bg-slate-900/90 rounded-lg p-2.5 border border-slate-800 space-y-1">
                          <span className="text-[10px] font-black uppercase tracking-wider text-amber-400 block">
                            Rincian Perubahan:
                          </span>
                          <ul className="space-y-1 text-[11px] text-slate-300 list-disc list-inside">
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

            <div className="pt-2 flex justify-end border-t border-slate-800">
              <button
                onClick={() => setIsHistoryModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition cursor-pointer"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 5. Upload Preview Modal with Validation & Intelligent Area Auto-Mapping */}
      {isUploadModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xs overflow-y-auto animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 max-w-4xl w-full shadow-2xl space-y-4 my-6">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/15 text-emerald-400 flex items-center justify-center border border-emerald-500/30">
                  <FileSpreadsheet className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Pratinjau, Validasi &amp; Pemetaan Spreadsheet</h3>
                  <p className="text-xs text-slate-400">{uploadedFileName}</p>
                </div>
              </div>

              <button
                onClick={() => setIsUploadModalOpen(false)}
                className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Tab switchers */}
            <div className="flex items-center gap-2 border-b border-slate-800 pb-2 flex-wrap">
              <button
                type="button"
                onClick={() => setActiveUploadTab('audit')}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
                  activeUploadTab === 'audit'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'bg-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Audit &amp; Validasi Format</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveUploadTab('area_mapping')}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
                  activeUploadTab === 'area_mapping'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'bg-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                <MapPin className="w-3.5 h-3.5 text-rose-400" />
                <span>Pemetaan Area Cerdas</span>
                {Object.values(detectedAreaMappings).some(m => m.confidence === 'unmapped') ? (
                  <span className="px-2 py-0.5 rounded-full text-[10px] bg-rose-500 text-white font-black animate-pulse">
                    {Object.values(detectedAreaMappings).filter(m => m.confidence === 'unmapped').length} Belum Dikenali
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded-full text-[10px] bg-emerald-500/20 text-emerald-300 font-mono">
                    {Object.keys(detectedAreaMappings).length} Area Terpetakan
                  </span>
                )}
              </button>

              <button
                type="button"
                onClick={() => setActiveUploadTab('crew_mapping')}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
                  activeUploadTab === 'crew_mapping'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'bg-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                <Users className="w-3.5 h-3.5 text-blue-300" />
                <span>Pemetaan Kru Pengirim</span>
                {Object.values(detectedCrewMappings).some(m => m.confidence === 'unmapped') ? (
                  <span className="px-2 py-0.5 rounded-full text-[10px] bg-rose-500 text-white font-black animate-pulse">
                    {Object.values(detectedCrewMappings).filter(m => m.confidence === 'unmapped').length} Belum Dikenali
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded-full text-[10px] bg-blue-500/20 text-blue-300 font-mono">
                    {Object.keys(detectedCrewMappings).length} Kru Terpetakan
                  </span>
                )}
              </button>
            </div>

            {/* Tab Content 1: Audit */}
            {activeUploadTab === 'audit' && (
              <div className="space-y-4">
                {uploadedValidationReport ? (
                  <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-3 text-xs text-slate-300">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">Total Baris Terdeteksi:</span>
                      <span className="font-bold text-white">{uploadedValidationReport.totalRows} baris</span>
                    </div>

                    {/* Audit Grid */}
                    <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-850">
                      <div className="bg-emerald-950/20 p-2 rounded-lg border border-emerald-500/30 text-center">
                        <span className="text-[10px] text-emerald-400 font-bold block">🟢 Lolos</span>
                        <span className="text-base font-bold text-emerald-300">{uploadedValidationReport.validCount}</span>
                      </div>

                      <div className="bg-amber-950/20 p-2 rounded-lg border border-amber-500/30 text-center">
                        <span className="text-[10px] text-amber-400 font-bold block">🟡 Duplikat</span>
                        <span className="text-base font-bold text-amber-300">{uploadedValidationReport.duplicateCount}</span>
                      </div>

                      <div className="bg-rose-950/20 p-2 rounded-lg border border-rose-500/30 text-center">
                        <span className="text-[10px] text-rose-400 font-bold block">🔴 Format Salah</span>
                        <span className="text-base font-bold text-rose-300">
                          {uploadedValidationReport.invalidDateCount + uploadedValidationReport.invalidPoCount + uploadedValidationReport.missingFieldCount}
                        </span>
                      </div>
                    </div>

                    {/* Protections */}
                    <div className="pt-2 border-t border-slate-850 space-y-2 text-[11px]">
                      <div className="flex items-start gap-2 text-emerald-400 bg-emerald-950/40 p-2.5 rounded-xl border border-emerald-500/30">
                        <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                        <div>
                          <span className="font-bold block">Mode Sistem Rotasi Area Berputar Aktif</span>
                          <span className="text-slate-300 text-[10px]">
                            Semua {uploadedValidationReport.validCount} jadwal pengiriman tervalidasi sebagai rotasi area berputar yang sah dan siap disinkronkan (*overwrite* otomatis).
                          </span>
                        </div>
                      </div>

                      <label className="flex items-center gap-2 text-slate-300 cursor-pointer pt-1">
                        <input
                          type="checkbox"
                          checked={skipInvalidUpload}
                          onChange={(e) => setSkipInvalidUpload(e.target.checked)}
                          className="rounded text-emerald-500 focus:ring-emerald-500"
                        />
                        <span>Tolak baris jika ada format tanggal atau PO yang rusak / tidak valid</span>
                      </label>
                    </div>
                  </div>
                ) : (
                  <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2 text-xs text-slate-300">
                    <div className="flex justify-between">
                      <span className="text-slate-400">Total Baris:</span>
                      <span className="font-bold text-white">{uploadedRowsCount} baris</span>
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

            <div className="flex items-center justify-between gap-2.5 pt-2 border-t border-slate-800">
              <div className="text-xs text-slate-400">
                {Object.values(detectedAreaMappings).some(m => m.confidence === 'unmapped') || Object.values(detectedCrewMappings).some(m => m.confidence === 'unmapped') ? (
                  <span className="text-amber-400 font-semibold flex items-center gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    <span>Tip: Lengkapi pemetaan area &amp; kru sebelum konfirmasi sinkronisasi.</span>
                  </span>
                ) : (
                  <span className="text-emerald-400 font-semibold flex items-center gap-1.5">
                    <Check className="w-3.5 h-3.5" />
                    <span>Area &amp; Kru telah terharmonisasi dengan Jadwal serta Histori &amp; Otorisasi.</span>
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsUploadModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition cursor-pointer"
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
                      const msg = `⚡ Berhasil menyinkronkan ${syncRes.syncedCount + syncRes.overwrittenCount} jadwal pengiriman valid! Riwayat perubahan tercatat.`;
                      setSyncSuccessMessage(msg);
                      if (onSyncComplete) onSyncComplete(syncRes.syncedCount + syncRes.overwrittenCount);
                      setTimeout(() => setSyncSuccessMessage(null), 8000);
                    } else {
                      setIsUploadModalOpen(false);
                      handleSyncToOperationalSchedules();
                    }
                  }}
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition flex items-center gap-2 cursor-pointer shadow-md"
                >
                  <Sparkles className="w-4 h-4" />
                  <span>⚡ Sinkronkan {uploadedValidationReport ? uploadedValidationReport.validCount : uploadedRowsCount} Jadwal</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 6. Simplified Area & Crew Mapping Modal */}
      {isAreaMappingModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xs overflow-y-auto animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 max-w-3xl w-full shadow-2xl space-y-4 my-6">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2.5">
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center border ${
                  activeMappingCategory === 'area'
                    ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                    : 'bg-blue-500/15 text-blue-400 border-blue-500/30'
                }`}>
                  {activeMappingCategory === 'area' ? <MapPin className="w-4 h-4 text-rose-400" /> : <Users className="w-4 h-4 text-blue-400" />}
                </div>
                <div>
                  <h3 className="text-sm font-black text-white">
                    {activeMappingCategory === 'area' ? 'Pemetaan Area Kirim' : 'Pemetaan Kru (Driver & Helper)'}
                  </h3>
                  <p className="text-[11px] text-slate-400">
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
                    className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition flex items-center gap-1 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Area Baru</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setQuickCreateCrewTarget({ name: '', roleHint: 'Driver' })}
                    className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition flex items-center gap-1 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Kru Baru</span>
                  </button>
                )}
                <button
                  onClick={() => setIsAreaMappingModalOpen(false)}
                  className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Category Selector Tabs */}
            <div className="flex items-center gap-2 p-1 bg-slate-950 rounded-xl border border-slate-800">
              <button
                type="button"
                onClick={() => setActiveMappingCategory('area')}
                className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                  activeMappingCategory === 'area'
                    ? 'bg-emerald-600 text-white'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <MapPin className="w-3.5 h-3.5" />
                <span>Pemetaan Area ({Object.keys(detectedAreaMappings).length})</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveMappingCategory('crew')}
                className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                  activeMappingCategory === 'crew'
                    ? 'bg-blue-600 text-white'
                    : 'text-slate-400 hover:text-white'
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

            <div className="flex items-center justify-between pt-3 border-t border-slate-800 text-xs">
              <span className="text-slate-400">
                {activeMappingCategory === 'area' ? (
                  <>Area Resmi Terdaftar: <strong className="text-white">{officialAreasList.length}</strong> area</>
                ) : (
                  <>Kru Terdaftar (Aktif &amp; Nonaktif): <strong className="text-white">{officialCrewsList.length}</strong> kru</>
                )}
              </span>
              <button
                type="button"
                onClick={() => setIsAreaMappingModalOpen(false)}
                className="px-4 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold transition cursor-pointer"
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
          setSyncSuccessMessage(`⚡ Berhasil menyinkronkan ${count} rute pengiriman langsung dari Google Sheets API v4!`);
          if (onSyncComplete) onSyncComplete(count);
          setTimeout(() => setSyncSuccessMessage(null), 8000);
        }}
      />

      {/* Excel Top 5 Rows Preview Modal */}
      {isExcelPreviewModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200 overflow-y-auto">
          <div className="w-full max-w-4xl bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-5 shadow-2xl my-6">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-500/15 text-blue-400 flex items-center justify-center border border-blue-500/30">
                  <FileSpreadsheet className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Pratinjau Spreadsheet (Semua Data sampai Bawah)</h3>
                  <p className="text-xs text-slate-400">Verifikasi isi file sebelum diproses permanen ke sistem • {previewFile?.name} ({previewTotalRows} baris total, Sheet: {previewSheetName})</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsExcelPreviewModalOpen(false)}
                className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="p-3 rounded-2xl bg-blue-500/10 border border-blue-500/25 text-blue-200">
                <p className="font-semibold">💡 Pastikan data di bawah ini sesuai dengan format roster operasional sebelum melanjutkan pemrosesan jadwal.</p>
              </div>

              <div className="overflow-x-auto border border-slate-800 rounded-2xl bg-slate-950 max-h-[72vh]">
                <table className="w-full text-left border-collapse text-[11px]">
                  <thead>
                    <tr className="bg-slate-900 border-b border-slate-800 text-slate-400">
                      <th className="p-3 font-bold border-r border-slate-800 w-12 text-center">#</th>
                      {previewHeaders.map((h, i) => (
                        <th key={i} className="p-3 font-bold border-r border-slate-800 whitespace-nowrap">{h || `Kolom ${i+1}`}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800 text-slate-200">
                    {previewTopRows.length === 0 ? (
                      <tr>
                        <td colSpan={previewHeaders.length + 1} className="p-6 text-center text-slate-500 italic">Tidak ada data baris ditemukan.</td>
                      </tr>
                    ) : (() => {
                      let activeDate = '';
                      return previewTopRows.map((row, rIdx) => {
                        const isSeparator = row.some(cell => String(cell).includes('---'));
                        if (isSeparator) {
                          return (
                            <tr key={rIdx} className="bg-slate-900 border-y-2 border-slate-700 text-slate-400">
                              <td colSpan={previewHeaders.length + 1} className="py-2.5 px-3 text-center font-mono text-[11px] font-black tracking-widest bg-slate-950/90 text-slate-400 border-y-2 border-slate-700">
                                ─────── PEMBATAS TANGGAL &amp; PENGELOMPOKAN PENGIRIMAN ───────
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
                          <tr key={rIdx} className={`hover:bg-slate-900/80 transition border-b border-slate-800 ${hasExplicitDate ? 'border-t-2 border-slate-700 bg-slate-900/40' : ''}`}>
                            <td className="p-3 font-mono text-slate-500 text-center border-r border-slate-800">{rIdx + 1}</td>
                            {previewHeaders.map((h, cIdx) => {
                              const cellVal = row[cIdx];
                              const hasVal = cellVal !== undefined && cellVal !== null && String(cellVal).trim() !== '';
                              const hUpper = (h || '').toUpperCase();

                              return (
                                <td key={cIdx} className="p-3 border-r border-slate-800 whitespace-nowrap">
                                  {hasVal ? (
                                    <span className={
                                      hUpper.includes('TANGGAL')
                                        ? "font-semibold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20"
                                        : hUpper.includes('DRIVER') || hUpper.includes('SUPIR')
                                        ? "font-bold text-white"
                                        : hUpper.includes('AREA')
                                        ? "font-semibold text-amber-300"
                                        : hUpper.includes('ARMADA')
                                        ? "font-mono font-bold text-blue-300"
                                        : ""
                                    }>
                                      {String(cellVal)}
                                    </span>
                                  ) : (
                                    hUpper.includes('TANGGAL') ? (
                                      <span className="text-slate-500 text-[10px] italic">
                                        ↳ {activeDate || 'sesi hari'}
                                      </span>
                                    ) : (
                                      <span className="text-slate-600">-</span>
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

            <div className="flex items-center justify-between pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setIsExcelPreviewModalOpen(false)}
                className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs cursor-pointer transition"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={() => {
                  if (previewFile) executeFinalUpload(previewFile);
                }}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white font-bold text-xs shadow-md shadow-emerald-600/30 cursor-pointer active:scale-95 transition"
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
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-lg bg-slate-900 border border-rose-500/40 rounded-3xl p-6 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2 text-rose-400">
                <AlertTriangle className="w-6 h-6 shrink-0 animate-bounce" />
                <h3 className="text-base font-black text-white">{schemaValidationError.error || 'Format Kolom Tidak Sesuai'}</h3>
              </div>
              <button
                type="button"
                onClick={() => setSchemaValidationError(null)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-white bg-slate-800/80 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/25 text-rose-200 space-y-1.5">
                <p className="font-bold">{schemaValidationError.message}</p>
                {schemaValidationError.missingColumns?.length > 0 && (
                  <p className="text-[11px] text-rose-300">
                    <span className="font-semibold">Kolom Wajib yang Belum Ada:</span> {schemaValidationError.missingColumns.join(', ')}
                  </p>
                )}
              </div>

              <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 space-y-1.5">
                <span className="font-bold text-amber-400 block">📌 Panduan Format Kolom Standar:</span>
                <p className="font-mono text-[11px] text-slate-300 bg-slate-900 p-2.5 rounded-xl border border-slate-800">
                  {schemaValidationError.correctFormat}
                </p>
              </div>

              {schemaValidationError.detectedHeaders?.length > 0 && (
                <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 space-y-1">
                  <span className="font-semibold text-slate-400 block">Header yang Terdeteksi di File Anda:</span>
                  <div className="flex flex-wrap gap-1 pt-1">
                    {schemaValidationError.detectedHeaders.map((h: string, idx: number) => (
                      <span key={idx} className="px-2 py-0.5 rounded-md bg-slate-800 text-slate-300 font-mono text-[10px]">
                        {h}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center gap-3 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setSchemaValidationError(null)}
                className="flex-1 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs cursor-pointer transition"
              >
                Tutup &amp; Pilih File Lain
              </button>
              <button
                type="button"
                onClick={downloadScheduleTemplate}
                className="flex-1 py-3 rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-md shadow-emerald-600/30 cursor-pointer active:scale-95 transition"
              >
                <Download className="w-4 h-4" />
                <span>Unduh Template .XLSX Standar</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Pop-Up Modal Konfirmasi Hapus Jadwal */}
      {deleteConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 sm:p-7 max-w-md w-full shadow-2xl space-y-5 animate-in zoom-in-95 duration-200">
            <div className="flex items-start gap-4">
              <div className="p-3 rounded-2xl bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20 shrink-0">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h3 className="text-lg font-black text-slate-900 dark:text-white">
                  Konfirmasi Hapus Jadwal
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                  Apakah Anda yakin ingin menghapus ritase pengiriman ini dari jadwal operasional? Data yang dihapus akan tersinkronisasi ke riwayat kru dan dashboard.
                </p>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-2 text-xs">
              <div className="flex justify-between items-center text-slate-600 dark:text-slate-400">
                <span className="font-semibold">Tanggal Kirim:</span>
                <span className="font-bold text-slate-900 dark:text-white">{deleteConfirmModal.dateString}</span>
              </div>
              <div className="flex justify-between items-center text-slate-600 dark:text-slate-400">
                <span className="font-semibold">Driver:</span>
                <span className="font-bold text-slate-900 dark:text-white">{deleteConfirmModal.p.driver}</span>
              </div>
              <div className="flex justify-between items-center text-slate-600 dark:text-slate-400">
                <span className="font-semibold">Area Tujuan:</span>
                <span className="font-bold text-emerald-600 dark:text-emerald-400">{deleteConfirmModal.p.area}</span>
              </div>
              <div className="flex justify-between items-center text-slate-600 dark:text-slate-400">
                <span className="font-semibold">Armada:</span>
                <span className="font-bold text-slate-900 dark:text-white">{deleteConfirmModal.p.armada}</span>
              </div>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setDeleteConfirmModal(null)}
                className="flex-1 py-3 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold text-xs transition cursor-pointer"
              >
                Tidak, Batal
              </button>
              <button
                type="button"
                onClick={() => {
                  handleDeleteTrip(
                    deleteConfirmModal.p,
                    deleteConfirmModal.dayNumber,
                    deleteConfirmModal.tripIndex
                  );
                  setDeleteConfirmModal(null);
                }}
                className="flex-1 py-3 px-4 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs transition shadow-lg shadow-rose-600/30 cursor-pointer"
              >
                Ya, Hapus Jadwal
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Floating Toast Notification for Upload Validation */}
      {uploadToast && (
        <div className="fixed bottom-6 right-6 z-50 max-w-md w-full bg-slate-900 dark:bg-slate-900 border border-slate-700 dark:border-slate-700 text-white rounded-2xl p-4 shadow-2xl flex items-start gap-3 animate-in fade-in slide-in-from-bottom-5 duration-300">
          <div className={`p-2.5 rounded-xl shrink-0 ${uploadToast.type === 'error' ? 'bg-rose-500/20 text-rose-400' : 'bg-emerald-500/20 text-emerald-400'}`}>
            {uploadToast.type === 'error' ? <AlertTriangle className="w-5 h-5" /> : <CheckCircle2 className="w-5 h-5" />}
          </div>
          <div className="flex-1 space-y-1">
            <div className="flex items-center justify-between">
              <span className={`text-xs font-black uppercase tracking-wider ${uploadToast.type === 'error' ? 'text-rose-400' : 'text-emerald-400'}`}>
                {uploadToast.type === 'error' ? 'Gagal Unggah Spreadsheet' : 'Berhasil'}
              </span>
              <button
                type="button"
                onClick={() => setUploadToast(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition cursor-pointer"
                title="Tutup Notifikasi"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-slate-300 font-medium">{uploadToast.message}</p>
            {uploadToast.type === 'error' && (
              <div className="pt-2 flex items-center gap-2">
                <button
                  type="button"
                  onClick={downloadScheduleTemplate}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[11px] shadow-sm transition cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Unduh Template Excel Benar</span>
                </button>
              </div>
            )}
            {/* Auto-dismiss timer indicator */}
            <div className="w-full bg-slate-800 h-1 rounded-full overflow-hidden mt-2">
              <div
                className={`h-full ${uploadToast.type === 'error' ? 'bg-rose-500' : 'bg-emerald-500'} animate-pulse`}
                style={{ width: '100%' }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
