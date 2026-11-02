import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Calendar, Plus, Truck, Store, User, Users, Ship, Clock, CheckCircle2, AlertTriangle, FileText, Search, ChevronRight, ChevronDown, ChevronUp, CalendarDays, X, XCircle, LayoutList, MapPin, Printer, ShieldAlert, Edit, Trash2, Sparkles, CalendarCheck, Repeat, Layers, Move, FileSpreadsheet, History, RefreshCw, Zap, Download, Loader2, Compass, Navigation, ArrowRightLeft, UserX, Check, Building2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Schedule, RetailStore, Fleet, Crew, ShipmentStatus, CrewDeliveryHistory } from '../types';
import { logisticsStore } from '../services/store';
import { ScheduleInitializerService } from '../services/scheduleInitializer';
import { CENTRAL_WAREHOUSE } from '../data/mockData';
import { AreaApprovalModal } from './AreaApprovalModal';
import { CrewSimulationModal } from './CrewSimulationModal';
import { CrewPoolManagementModal } from './CrewPoolManagementModal';
import { OptimalRoutePlanningModal } from './OptimalRoutePlanningModal';
import { OutboundGapMonitoringPanel } from './OutboundGapMonitoringPanel';
import { NextDayReadinessPanel } from './NextDayReadinessPanel';
import { SmartFillModal } from './SmartFillModal';
import { SmartFillResult } from '../services/scheduleInitializer';

import { AreaRepetitionWarningModal } from './AreaRepetitionWarningModal';
import { checkConsecutiveWeekConflict, AreaRepetitionConflict } from '../services/areaRotationValidator';
import { scheduleImportValidator } from '../services/scheduleImportValidator';
import { GoogleSheetsAdminScheduleView } from './GoogleSheetsAdminScheduleView';
import { downloadScheduleManifestPdf } from '../utils/suratJalanPdfGenerator';
import { useToast } from '../context/ToastContext';
import { getAreaScheduleTiming, calculateScheduleTimestamps } from '../utils/areaScheduleRules';
import { OFFICIAL_DESTINATION_AREAS } from '../utils/areaNormalizer';
import { branchStore, BranchRecord } from '../services/branchStore';

interface ScheduleManagementProps {
  preselectedStore?: RetailStore | null;
  onClearPreselectedStore?: () => void;
  onNavigateToCrewHistory?: () => void;
}

const AREA_MAP: Record<string, string> = {
  'GROSIR1': 'GROSIR 1',
  'SITUBONDO': 'SITUBONDO',
  'RITEL_ROGOJAMPI': 'RITEL ROGOJAMPI',
  'RITEL_SONGGON': 'RITEL SONGGON',
  'SUSULAN_ROGOJAMPI_MUNCAR': 'SUSULAN ROGOJAMPI-MUNCAR',
  'JAJAG_RETAIL': 'JAJAG RETAIL',
  'DENPASAR2': 'DENPASAR 2',
  'SUSULAN_SANGGAR_JAJAG': 'SUSULAN SANGGAR-JAJAG',
  'DENPASAR1': 'DENPASAR 1',
  'BWI_KOTA_SELATAN': 'BWI KOTA SELATAN',
  'KETAPANG_WONGSOREJO': 'KETAPANG - WONGSOREJO',
  'RITEL_SRONO': 'RITEL SRONO',
  'GALEKAN': 'GALEKAN',
  'JEMBER_BARAT': 'JEMBER BARAT',
  'RITEL_KALIBARU': 'RITEL KALIBARU',
  'PURWO_DAMBUNTUNG': 'PURWO DAMBUNTUNG',
  'PURWO_PASAR': 'PURWO PASAR',
  'SUMBERAYU_RETAIL': 'SUMBERAYU RETAIL',
  'SSLN_SINGARAJA': 'SSLN SINGARAJA',
  'SEMPU_KALISTAIL': 'SEMPU KALISTAIL',
  'JEMBER_KOTA': 'JEMBER KOTA',
  'BONDOWOSO': 'BONDOWOSO',
  'SSLN_STB_BDWS': 'SSLN STB BDWS',
  'RITEL_SANGGAR': 'RITEL SANGGAR',
  'NEGARA': 'NEGARA',
  'JEMBER_SELATAN': 'JEMBER SELATAN',
  'TOKO_DR_SOETOMO': 'TOKO DR. SOETOMO',
  'NUSANTARA_EXPAND': 'NUSANTARA EXPAND',
  'KANVAS_LKT': 'KANVAS LKT'
};

const CrewIdCustomDropdown: React.FC<{
  label: string;
  value: string;
  options: Crew[];
  onChange: (crewId: string) => void;
  emptyLabel: string;
  roleBadgeText: string;
  accentColor?: 'blue' | 'emerald';
}> = ({
  label,
  value,
  options,
  onChange,
  emptyLabel,
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

  const activeOptions = useMemo(() => {
    const q = search.trim().toLowerCase();
    return options.filter(c => c.status !== 'off' && (!q || c.name.toLowerCase().includes(q)));
  }, [options, search]);

  const selectedCrew = options.find(c => c.id === value && c.status !== 'off');
  const getInitials = (name: string) => {
    const parts = (name || '').trim().split(/\s+/);
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return (name || 'KR').substring(0, 2).toUpperCase();
  };

  return (
    <div ref={containerRef} className="relative">
      <label className="text-slate-300 flex items-center justify-between mb-1.5 font-bold text-[11px]">
        <span>{label}</span>
        <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
          {options.filter(c => c.status !== 'off').length} Aktif
        </span>
      </label>

      <button
        type="button"
        onClick={() => {
          setIsOpen(prev => !prev);
          setSearch('');
        }}
        className={`w-full flex items-center justify-between gap-2.5 px-3 py-2 rounded-xl bg-slate-900 border text-left transition cursor-pointer ${
          isOpen ? 'border-blue-500 ring-2 ring-blue-500/20' : 'border-slate-800 hover:border-slate-700'
        }`}
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <div className={`w-7 h-7 rounded-lg flex items-center justify-center font-extrabold text-[10px] shrink-0 border ${
            !selectedCrew
              ? 'bg-slate-800 text-slate-500 border-slate-700'
              : accentColor === 'blue'
              ? 'bg-blue-600 text-white border-blue-500'
              : 'bg-emerald-600 text-white border-emerald-500'
          }`}>
            {!selectedCrew ? '—' : getInitials(selectedCrew.name)}
          </div>
          <div className="min-w-0">
            <div className={`text-xs font-bold leading-tight truncate ${
              !selectedCrew ? 'text-slate-500 italic' : 'text-white'
            }`}>
              {selectedCrew ? selectedCrew.name : emptyLabel}
            </div>
            <div className="text-[10px] text-slate-400 leading-tight mt-0.5">
              {selectedCrew ? `${roleBadgeText} • Status Aktif` : 'Tidak ditugaskan'}
            </div>
          </div>
        </div>
        <ChevronDown className={`w-4 h-4 text-slate-400 shrink-0 transition-transform ${isOpen ? 'rotate-180 text-blue-400' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute left-0 right-0 z-50 mt-1.5 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
          <div className="p-2 bg-slate-950 border-b border-slate-800">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={`Cari nama ${roleBadgeText.toLowerCase()}...`}
                autoFocus
                className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          <div className="max-h-56 overflow-y-auto p-1.5 space-y-1">
            <button
              type="button"
              onClick={() => {
                onChange('');
                setIsOpen(false);
              }}
              className={`w-full flex items-center justify-between gap-2 px-2.5 py-2 rounded-lg text-left text-xs transition cursor-pointer ${
                !selectedCrew ? 'bg-slate-800 text-white font-bold' : 'text-slate-400 hover:bg-slate-800/60'
              }`}
            >
              <span className="italic">{emptyLabel}</span>
              {!selectedCrew && <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />}
            </button>

            {activeOptions.length === 0 ? (
              <div className="py-4 text-center text-[11px] text-slate-500">
                Tidak ada kru aktif yang ditemukan.
              </div>
            ) : (
              activeOptions.map(cr => {
                const isSelected = selectedCrew?.id === cr.id;
                return (
                  <button
                    key={cr.id}
                    type="button"
                    onClick={() => {
                      onChange(cr.id);
                      setIsOpen(false);
                    }}
                    className={`w-full flex items-center justify-between gap-2.5 px-2.5 py-2 rounded-lg text-left transition cursor-pointer ${
                      isSelected
                        ? accentColor === 'blue'
                          ? 'bg-blue-600 text-white'
                          : 'bg-emerald-600 text-white'
                        : 'hover:bg-slate-800/80 text-slate-200'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className={`w-7 h-7 rounded-lg flex items-center justify-center font-extrabold text-[10px] shrink-0 border ${
                        isSelected
                          ? 'bg-white/20 text-white border-white/30'
                          : 'bg-slate-800 text-slate-300 border-slate-700'
                      }`}>
                        {getInitials(cr.name)}
                      </div>
                      <div className="min-w-0">
                        <div className="text-xs font-bold leading-snug">{cr.name}</div>
                        <div className={`text-[10px] ${isSelected ? 'text-white/85' : 'text-emerald-400'}`}>
                          {roleBadgeText} • ● Aktif
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

export const ScheduleManagement: React.FC<ScheduleManagementProps> = ({
  preselectedStore,
  onClearPreselectedStore,
  onNavigateToCrewHistory
}) => {
  const [schedules, setSchedules] = useState<Schedule[]>(logisticsStore.getSchedules());
  const [stores, setStores] = useState<RetailStore[]>(logisticsStore.getStores());
  const [fleets, setFleets] = useState<Fleet[]>(logisticsStore.getFleets());
  const [crews, setCrews] = useState<Crew[]>(logisticsStore.getCrews());

  const [branches, setBranches] = useState<BranchRecord[]>(() => branchStore.getActiveBranches());
  const [selectedOriginBranchId, setSelectedOriginBranchId] = useState<string>(() =>
    branchStore.getSelectedOriginBranchId()
  );
  const [newScheduleOriginBranchId, setNewScheduleOriginBranchId] = useState<string>(() => {
    const active = branchStore.getSelectedOriginBranchId();
    return active === 'ALL' ? 'branch-banyuwangi' : active;
  });

  const [isBranchDropdownOpen, setIsBranchDropdownOpen] = useState(false);
  const branchDropdownRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (branchDropdownRef.current && !branchDropdownRef.current.contains(e.target as Node)) {
        setIsBranchDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    const syncBranches = () => {
      setBranches(branchStore.getActiveBranches());
      const sel = branchStore.getSelectedOriginBranchId();
      setSelectedOriginBranchId(sel);
      if (sel !== 'ALL') setNewScheduleOriginBranchId(sel);
    };
    return branchStore.subscribe(syncBranches);
  }, []);

  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedDayFilter, setSelectedDayFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedStoreFilter, setSelectedStoreFilter] = useState<string>('all');
  const [departureDateFilter, setDepartureDateFilter] = useState<string>('');
  const [selectedMonth, setSelectedMonth] = useState<string>('Semua Bulan');
  const [selectedYear, setSelectedYear] = useState<string>('2026');
  const [selectedFleetId, setSelectedFleetId] = useState<string>('all');
  const [isAddScheduleOpen, setIsAddScheduleOpen] = useState(false);
  const [selectedManifest, setSelectedManifest] = useState<Schedule | null>(null);
  const [isCrewSimulationOpen, setIsCrewSimulationOpen] = useState(false);
  const [isCrewPoolOpen, setIsCrewPoolOpen] = useState(false);
  const [isRouteOptimizerOpen, setIsRouteOptimizerOpen] = useState(false);
  const [isSmartFillOpen, setIsSmartFillOpen] = useState(false);
  const [autoInitMessage, setAutoInitMessage] = useState<string | null>(null);
  const [activeMainTab, setActiveMainTab] = useState<'schedules_list' | 'google_sheets_all'>('schedules_list');
  const [selectedRouteScheduleId, setSelectedRouteScheduleId] = useState<string | null>(null);

  const handleViewRouteOnMap = (sch: Schedule) => {
    setSelectedRouteScheduleId(sch.id);
  };
  const [consecutiveConflict, setConsecutiveConflict] = useState<AreaRepetitionConflict | null>(null);
  const { addNotification } = useToast();
  const [isExportingManifestPdf, setIsExportingManifestPdf] = useState(false);

  const handleDownloadManifestPdf = async () => {
    if (!selectedManifest) return;
    setIsExportingManifestPdf(true);
    try {
      const success = await downloadScheduleManifestPdf(selectedManifest);
      if (success) {
        addNotification(
          'delivery',
          'PDF Surat Jalan Berhasil Diunduh',
          `Berkas Surat Jalan Keluar untuk area ${selectedManifest.areaName || selectedManifest.store?.storeName || 'Tujuan'} berhasil diunduh.`
        );
      } else {
        throw new Error('Gagal menghasilkan file PDF');
      }
    } catch (err) {
      console.error('PDF export error:', err);
      addNotification(
        'sla_warning',
        'Gagal Cetak PDF',
        'Terjadi kendala saat memproses berkas PDF. Silakan coba kembali.'
      );
    } finally {
      setIsExportingManifestPdf(false);
    }
  };

  // States for Date Navigation & Grouping (Mencegah scroll ngelos ke bawah)
  const [selectedSpecificDate, setSelectedSpecificDate] = useState<string>('all');
  const [viewGroupingMode, setViewGroupingMode] = useState<'grouped_by_date' | 'flat_table'>('grouped_by_date');
  const [expandedDates, setExpandedDates] = useState<Record<string, boolean>>({});

  const toggleDateExpansion = (dateKey: string) => {
    setExpandedDates(prev => ({
      ...prev,
      [dateKey]: prev[dateKey] !== undefined ? !prev[dateKey] : false
    }));
  };

  const isDateExpanded = (dateKey: string) => {
    return expandedDates[dateKey] !== false; // default open
  };

  const handleExpandAllDates = (keys: string[]) => {
    const newState: Record<string, boolean> = {};
    keys.forEach(k => { newState[k] = true; });
    setExpandedDates(newState);
  };

  const handleCollapseAllDates = (keys: string[]) => {
    const newState: Record<string, boolean> = {};
    keys.forEach(k => { newState[k] = false; });
    setExpandedDates(newState);
  };

  // Helper to extract day of week from schedule
  const getScheduleDayName = (sch: Schedule): string => {
    if (sch.trackingNumber.includes('-SEN-') || sch.notes?.includes('Senin')) return 'Senin';
    if (sch.trackingNumber.includes('-SEL-') || sch.notes?.includes('Selasa')) return 'Selasa';
    if (sch.trackingNumber.includes('-RAB-') || sch.notes?.includes('Rabu')) return 'Rabu';
    if (sch.trackingNumber.includes('-KAM-') || sch.notes?.includes('Kamis')) return 'Kamis';
    if (sch.trackingNumber.includes('-JUM-') || sch.notes?.includes('Jumat')) return 'Jumat';
    if (sch.trackingNumber.includes('-SAB-') || sch.notes?.includes('Sabtu')) return 'Sabtu';

    if (sch.departureDate) {
      const d = new Date(sch.departureDate);
      if (!isNaN(d.getTime())) {
        const dayIdx = d.getDay();
        const days = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
        return days[dayIdx] || 'Lainnya';
      }
    }
    return 'Lainnya';
  };

  // Jadwal dimulai dalam kondisi kosong sesuai permintaan operasional (tidak auto-seed otomatis saat mount)

  const handleRunWeeklyAutoInit = (weekOffset: number = 0) => {
    const result = ScheduleInitializerService.initializeWeeklySchedules({ weekOffset });
    setSchedules(logisticsStore.getSchedules());
    setStores(logisticsStore.getStores());
    setCrews(logisticsStore.getCrews());
    setFleets(logisticsStore.getFleets());
    setAutoInitMessage(`Berhasil menginisialisasi ${result.addedCount} rute cerdas (${result.outboundCount} Luar Kota prioritas utama + ${result.localCount} Lokal diseimbangkan). Jeda istirahat supir minimum 24 jam terverifikasi aman!`);
    setTimeout(() => setAutoInitMessage(null), 6000);
  };

  const handleRebalanceGaps = () => {
    const result = ScheduleInitializerService.rebalanceExistingSchedulesWithGapRule();
    setSchedules(logisticsStore.getSchedules());
    if (result.violationsResolved > 0) {
      setAutoInitMessage(`⚡ Berhasil menyeimbangkan jadwal! ${result.violationsResolved} supir yang berpotensi melanggar jeda 24 jam telah dialihkan ke kru cadangan.`);
    } else {
      setAutoInitMessage(`✅ Semua supir yang bertugas di rute luar kota sudah memenuhi standar jeda istirahat 24 jam.`);
    }
    setTimeout(() => setAutoInitMessage(null), 5000);
  };

  const handleSmartFillSuccess = (result: SmartFillResult) => {
    setSchedules(logisticsStore.getSchedules());
    setStores(logisticsStore.getStores());
    setCrews(logisticsStore.getCrews());
    setFleets(logisticsStore.getFleets());

    if (result.isFullyCompliant) {
      setAutoInitMessage(`⚡ Smart Fill Berhasil: ${result.addedCount} rute baru (${result.outboundCount} Luar Kota + ${result.localCount} Lokal) telah diisi secara otomatis dengan 100% kepatuhan jeda 24 jam.`);
    } else {
      setAutoInitMessage(`⚡ Smart Fill selesai (${result.addedCount} rute). Terdapat ${result.conflicts.length} jadwal yang memerlukan penyesuaian jeda.`);
    }
    setTimeout(() => setAutoInitMessage(null), 7000);
  };

  const handleManualSyncAll = () => {
    // 1. Sync from admin schedule weeks cache if available
    let cachedWeeks: any[] | null = null;
    try {
      const saved2026 = localStorage.getItem('akk_admin_schedule_cache_2026_0');
      if (saved2026) cachedWeeks = JSON.parse(saved2026);
      if (!cachedWeeks) {
        const savedAll = localStorage.getItem('akk_admin_schedule_weeks_cache');
        if (savedAll) cachedWeeks = JSON.parse(savedAll);
      }
    } catch {}

    let syncedCount = 0;
    if (Array.isArray(cachedWeeks) && cachedWeeks.length > 0 && cachedWeeks[0]?.days?.length > 0) {
      const curFleets = logisticsStore.getFleets();
      const curCrews = logisticsStore.getCrews();

      cachedWeeks.forEach((week: any, weekIdx: number) => {
        (week.days || []).forEach((day: any) => {
          let dayNum = day.dayNumber || 5;
          let dayPadded = String(dayNum).padStart(2, '0');
          let depIso = `2026-01-${dayPadded}T07:30:00.000Z`;
          let arrIso = `2026-01-${dayPadded}T18:00:00.000Z`;

          if (day.dateString) {
            const parsed = scheduleImportValidator.parseDate(day.dateString, new Date(2026, 0, dayNum));
            if (parsed.date) {
              const dStr = parsed.date.toISOString().substring(0, 10);
              depIso = `${dStr}T07:30:00.000Z`;
              arrIso = `${dStr}T18:00:00.000Z`;
            }
          }

          (day.pengiriman || []).forEach((p: any, idx: number) => {
            const stdArea = p.area || 'Area Kirim';
            const isBali = stdArea.toUpperCase().includes('DENPASAR') || stdArea.toUpperCase().includes('SINGARAJA') || stdArea.toUpperCase().includes('NEGARA') || stdArea.toUpperCase().includes('BALI');
            const cleanArmada = (p.armada || 'FLT').replace(/[^a-zA-Z0-9]/g, '').toUpperCase() || 'FLT';
            const datePart = depIso.substring(0, 10).replace(/-/g, '');
            const targetTracking = `PO-AKK-${datePart}-${cleanArmada}-${idx + 1}`;
            const targetId = p.id || `sch-${datePart}-${cleanArmada}-${idx + 1}`;

            const matchedFleet = curFleets.find(f => 
              f.initialCode?.toUpperCase() === p.armada?.toUpperCase() ||
              f.plateNumber.replace(/\s+/g, '').toUpperCase().includes((p.armada || '').replace(/\s+/g, '').toUpperCase())
            ) || curFleets[idx % curFleets.length] || curFleets[0];

            const matchedDriver = curCrews.find(c => 
              c.name.toLowerCase().includes((p.driver || '').toLowerCase()) || 
              (p.driver || '').toLowerCase().includes(c.name.toLowerCase())
            ) || curCrews[0];

            const matchedHelper = p.helper && p.helper !== '-' ? curCrews.find(c =>
              c.name.toLowerCase().includes((p.helper || '').toLowerCase()) ||
              (p.helper || '').toLowerCase().includes(c.name.toLowerCase())
            ) : undefined;

            const matchedHelper2 = p.helper2 && p.helper2 !== '-' ? curCrews.find(c =>
              c.name.toLowerCase().includes((p.helper2 || '').toLowerCase()) ||
              (p.helper2 || '').toLowerCase().includes(c.name.toLowerCase())
            ) : undefined;

            const existingList = logisticsStore.getSchedules();
            const existingIdx = existingList.findIndex(s => s.id === targetId || s.trackingNumber === targetTracking || (p.id && s.id === p.id));

            const newSch: Schedule = {
              id: targetId,
              trackingNumber: targetTracking,
              originName: 'Gudang Pusat Banyuwangi DC',
              originCoords: [-8.1906, 114.3708],
              storeId: `area-${stdArea.toLowerCase().replace(/[^a-z0-9]/g, '-')}`,
              store: {
                id: `area-${stdArea.toLowerCase().replace(/[^a-z0-9]/g, '-')}`,
                storeCode: `AREA-${stdArea.substring(0, 4).toUpperCase().replace(/[^A-Z0-9]/g, '')}`,
                storeName: stdArea,
                island: isBali ? 'Bali & Nusa Tenggara' : 'Jawa',
                province: isBali ? 'Bali' : 'Jawa Timur',
                city: isBali ? 'Denpasar' : 'Banyuwangi',
                address: `Area Distribusi ${stdArea}`,
                latitude: isBali ? -8.6705 : -8.219,
                longitude: isBali ? 115.2126 : 114.369,
                contactPerson: 'PIC Distribusi Area',
                phone: '-',
                deliveryWindow: '08:00 - 17:00',
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
              departureDate: depIso,
              estimatedArrival: arrIso,
              cargoDescription: `Karton Box & Sheet Kemasan - ${stdArea}`,
              cargoWeightTon: isBali ? 4.5 : 2.5,
              isInterIsland: isBali,
              ferryBookingCode: isBali ? `ASDP-KTP-GLM-${idx + 100}` : undefined,
              transitPort: isBali ? 'Pelabuhan Ketapang Banyuwangi -> Gilimanuk Bali' : undefined,
              notes: p.target || `Rute Distribusi ${stdArea}`,
              createdAt: new Date().toISOString(),
              isManuallyEdited: !!p.isManuallyEdited
            };

            if (existingIdx !== -1) {
              logisticsStore.updateSchedule(existingList[existingIdx].id, newSch);
            } else {
              logisticsStore.addSchedule(newSch);
            }
            syncedCount++;
          });
        });
      });
    }

    logisticsStore.syncSchedulesToCrewHistory();
    setSchedules(logisticsStore.getSchedules());
    setAutoInitMessage(`⚡ Sinkronisasi manual selesai! Semua jadwal operasional (${logisticsStore.getSchedules().length} ritase), kalender mingguan, dan histori kru tersinkronkan penuh tanpa ada data yang terlewat.`);
    setTimeout(() => setAutoInitMessage(null), 7000);
  };

  // Area Approval Pop-up State
  const [areaApprovalModalData, setAreaApprovalModalData] = useState<{
    isOpen: boolean;
    crewName: string;
    crewId: string;
    areaName: string;
    storeName: string;
    plateNumber: string;
    tripCount: number;
    threshold: number;
    recentTrips: CrewDeliveryHistory[];
  }>({
    isOpen: false,
    crewName: '',
    crewId: '',
    areaName: '',
    storeName: '',
    plateNumber: '',
    tripCount: 0,
    threshold: 3,
    recentTrips: []
  });

  // Form state
  const [newSchedule, setNewSchedule] = useState({
    trackingNumber: 'TRK-' + new Date().toISOString().substring(0, 10).replace(/-/g, '') + '-' + Math.floor(Math.random() * 900 + 100),
    storeId: '',
    fleetId: '',
    crewId: '',
    crewHelperId: '',
    crewHelper2Id: '',
    status: 'scheduled' as ShipmentStatus,
    departureDate: new Date().toISOString().substring(0, 16),
    estimatedArrival: new Date(Date.now() + 24 * 3600000).toISOString().substring(0, 16),
    cargoDescription: 'FMCG & Consumer Goods Assorted Pallets',
    cargoWeightTon: 15.0,
    isInterIsland: false,
    ferryBookingCode: '',
    transitPort: '',
    notes: ''
  });

  const [areaSearchFilter, setAreaSearchFilter] = useState<string>('');
  const [areaCategoryFilter, setAreaCategoryFilter] = useState<'all' | 'bali' | 'banyuwangi' | 'jember' | 'pantura'>('all');
  const [isAreaPickerExpanded, setIsAreaPickerExpanded] = useState<boolean>(false);

  const getAreaRegionCategory = (areaName: string): { category: 'bali' | 'jember' | 'pantura' | 'banyuwangi'; label: string; badgeColor: string } => {
    const upper = areaName.toUpperCase();
    if (upper.includes('DENPASAR') || upper.includes('SINGARAJA') || upper.includes('NEGARA')) {
      return { category: 'bali', label: 'Pulau Bali', badgeColor: 'bg-amber-500/15 text-amber-300 border-amber-500/30' };
    }
    if (upper.includes('JEMBER')) {
      return { category: 'jember', label: 'Jember', badgeColor: 'bg-blue-500/15 text-blue-300 border-blue-500/30' };
    }
    if (upper.includes('SITUBONDO') || upper.includes('BONDOWOSO')) {
      return { category: 'pantura', label: 'Situbondo & Bw', badgeColor: 'bg-purple-500/15 text-purple-300 border-purple-500/30' };
    }
    return { category: 'banyuwangi', label: 'Banyuwangi & Sekitar', badgeColor: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30' };
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

  const handleSelectArea = (selectedVal: string) => {
    const baseDate = newSchedule.departureDate ? new Date(newSchedule.departureDate) : new Date();
    const timestamps = calculateScheduleTimestamps(baseDate, selectedVal);
    const upper = selectedVal.toUpperCase();
    const isBaliIsland = upper.includes('DENPASAR') || upper.includes('SINGARAJA') || upper.includes('NEGARA');
    setNewSchedule(prev => ({
      ...prev,
      storeId: selectedVal,
      departureDate: timestamps.departureDate,
      estimatedArrival: timestamps.estimatedArrival,
      isInterIsland: isBaliIsland
    }));
  };

  useEffect(() => {
    return logisticsStore.subscribe(() => {
      setSchedules(logisticsStore.getSchedules());
      setStores(logisticsStore.getStores());
      setFleets(logisticsStore.getFleets());
      setCrews(logisticsStore.getCrews());
    });
  }, []);

  // Handle preselected store from CustomerMapping tab
  useEffect(() => {
    if (preselectedStore) {
      handleOpenCreateWithStore(preselectedStore);
      if (onClearPreselectedStore) onClearPreselectedStore();
    }
  }, [preselectedStore]);

  const handleOpenCreateWithStore = (store: RetailStore) => {
    const isOuter = store.island !== 'Jawa';
    let defaultTransit = '';
    let defaultBooking = '';

    if (store.island === 'Sumatera') {
      defaultTransit = 'Pelabuhan Merak (Dermaga Eksekutif) -> Pelabuhan Bakauheni';
      defaultBooking = 'ASDP-MRK-BKU-' + Math.floor(Math.random() * 90000 + 10000);
    } else if (store.island === 'Bali & Nusa Tenggara') {
      defaultTransit = 'Pelabuhan Ketapang Banyuwangi -> Pelabuhan Gilimanuk Bali';
      defaultBooking = 'ASDP-KTP-GLM-' + Math.floor(Math.random() * 90000 + 10000);
    } else if (store.island === 'Kalimantan' || store.island === 'Sulawesi') {
      defaultTransit = 'Pelabuhan Tanjung Perak Surabaya -> Pelabuhan Tujuan (Kapal Ro-Ro)';
      defaultBooking = 'KM-DHARMA-RORO-' + Math.floor(Math.random() * 90000 + 10000);
    }

    // Auto-suggest suitable available fleet & integrated Driver/Helper from Manajemen User
    const suitableFleet = fleets.find(f => f.status === 'available') || fleets[0];
    const driverList = logisticsStore.getDriverCrews();
    const helperList = logisticsStore.getHelperCrews();
    const suitableCrew = driverList.find(c => c.status === 'available') || driverList[0] || crews[0];
    const suitableHelper = helperList.find(c => c.status === 'available' && c.id !== suitableCrew?.id) || helperList[0];

    setNewSchedule({
      trackingNumber: 'TRK-' + new Date().toISOString().substring(0, 10).replace(/-/g, '') + '-' + Math.floor(Math.random() * 900 + 100),
      storeId: store.id,
      fleetId: suitableFleet ? suitableFleet.id : '',
      crewId: suitableCrew ? suitableCrew.id : '',
      crewHelperId: suitableHelper ? suitableHelper.id : '',
      crewHelper2Id: '',
      status: 'scheduled',
      departureDate: new Date().toISOString().substring(0, 16),
      estimatedArrival: new Date(Date.now() + (isOuter ? 48 : 16) * 3600000).toISOString().substring(0, 16),
      cargoDescription: 'FMCG & Consumer Goods Assorted Pallets',
      cargoWeightTon: 15.0,
      isInterIsland: isOuter,
      ferryBookingCode: defaultBooking,
      transitPort: defaultTransit,
      notes: isOuter ? 'Prioritas konfirmasi slot kapal penyeberangan logistik.' : 'Jalur tol Trans-Jawa reguler.'
    });
    setIsAddScheduleOpen(true);
  };

  const handleApplyOptimalRoute = (recommended: {
    storeId: string;
    driverId: string;
    helperId?: string;
    fleetId: string;
    cargoWeightTon: number;
    notes: string;
  }) => {
    const targetStore = stores.find(s => s.id === recommended.storeId) || stores[0];
    const isOuter = targetStore ? targetStore.island !== 'Jawa' : false;
    let defaultTransit = '';
    let defaultBooking = '';

    if (targetStore?.island === 'Sumatera') {
      defaultTransit = 'Pelabuhan Merak (Dermaga Eksekutif) -> Pelabuhan Bakauheni';
      defaultBooking = 'ASDP-MRK-BKU-' + Math.floor(Math.random() * 90000 + 10000);
    } else if (targetStore?.island === 'Bali & Nusa Tenggara') {
      defaultTransit = 'Pelabuhan Ketapang Banyuwangi -> Pelabuhan Gilimanuk Bali';
      defaultBooking = 'ASDP-KTP-GLM-' + Math.floor(Math.random() * 90000 + 10000);
    } else if (targetStore?.island === 'Kalimantan' || targetStore?.island === 'Sulawesi') {
      defaultTransit = 'Pelabuhan Tanjung Perak Surabaya -> Pelabuhan Tujuan (Kapal Ro-Ro)';
      defaultBooking = 'KM-DHARMA-RORO-' + Math.floor(Math.random() * 90000 + 10000);
    }

    setNewSchedule({
      trackingNumber: 'TRK-' + new Date().toISOString().substring(0, 10).replace(/-/g, '') + '-' + Math.floor(Math.random() * 900 + 100),
      storeId: recommended.storeId,
      fleetId: recommended.fleetId,
      crewId: recommended.driverId,
      crewHelperId: recommended.helperId || '',
      crewHelper2Id: '',
      status: 'scheduled' as ShipmentStatus,
      departureDate: new Date().toISOString().substring(0, 16),
      estimatedArrival: new Date(Date.now() + (isOuter ? 48 : 16) * 3600000).toISOString().substring(0, 16),
      cargoDescription: 'FMCG & Consumer Goods Assorted Pallets',
      cargoWeightTon: recommended.cargoWeightTon,
      isInterIsland: isOuter,
      ferryBookingCode: defaultBooking,
      transitPort: defaultTransit,
      notes: recommended.notes
    });

    setIsAddScheduleOpen(true);
  };

  const handleStoreChange = (storeId: string) => {
    const selectedStore = stores.find(s => s.id === storeId);
    if (!selectedStore) return;

    const isOuter = selectedStore.island !== 'Jawa';
    let defaultTransit = '';
    let defaultBooking = '';

    if (selectedStore.island === 'Sumatera') {
      defaultTransit = 'Pelabuhan Merak (Dermaga Eksekutif) -> Pelabuhan Bakauheni';
      defaultBooking = 'ASDP-MRK-BKU-' + Math.floor(Math.random() * 90000 + 10000);
    } else if (selectedStore.island === 'Bali & Nusa Tenggara') {
      defaultTransit = 'Pelabuhan Ketapang Banyuwangi -> Pelabuhan Gilimanuk Bali';
      defaultBooking = 'ASDP-KTP-GLM-' + Math.floor(Math.random() * 90000 + 10000);
    } else if (selectedStore.island === 'Kalimantan' || selectedStore.island === 'Sulawesi') {
      defaultTransit = 'Pelabuhan Tanjung Perak Surabaya -> Pelabuhan Tujuan (Kapal Ro-Ro)';
      defaultBooking = 'KM-DHARMA-RORO-' + Math.floor(Math.random() * 90000 + 10000);
    }

    setNewSchedule(prev => ({
      ...prev,
      storeId,
      isInterIsland: isOuter,
      transitPort: defaultTransit,
      ferryBookingCode: defaultBooking
    }));
  };

  const selectedStoreObj = stores.find(s => s.id === newSchedule.storeId);
  const selectedCrewObj = crews.find(c => c.id === newSchedule.crewId);
  const selectedFleetObj = fleets.find(f => f.id === newSchedule.fleetId);
  const resolvedSelectedAreaName = AREA_MAP[newSchedule.storeId] || selectedStoreObj?.storeName || newSchedule.storeId || '';
  const currentAreaName = selectedStoreObj ? `${selectedStoreObj.island} (${selectedStoreObj.city})` : resolvedSelectedAreaName;
  const areaCheck = (selectedCrewObj && currentAreaName)
    ? logisticsStore.checkCrewAreaThreshold(selectedCrewObj.id, currentAreaName)
    : null;

  const sendWhatsAppNotification = async (crew: Crew, message: string) => {
    try {
      await fetch('/api/notify-whatsapp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phoneNumber: crew.phone, message }),
      });
    } catch (error) {
      console.error('Error sending WhatsApp:', error);
    }
  };

  const handleCreateSchedule = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSchedule.storeId || !newSchedule.fleetId || !newSchedule.crewId) {
      addNotification('sla_warning', 'Data Belum Lengkap', 'Harap pilih Area Kirim, Armada Truk, dan Kru Supir Utama.');
      return;
    }

    const targetAreaLabel = AREA_MAP[newSchedule.storeId] || selectedStoreObj?.storeName || newSchedule.storeId;

    // New validation check
    const conflict = checkConsecutiveWeekConflict(
      newSchedule.departureDate,
      targetAreaLabel,
      newSchedule.crewId,
      'driverId',
      schedules,
      crews
    );

    if (conflict) {
      setConsecutiveConflict(conflict);
      return;
    }

    // Intercept with area threshold approval if required and not yet approved
    if (areaCheck && areaCheck.requiresApproval && !areaCheck.isApproved) {
      setAreaApprovalModalData({
        isOpen: true,
        crewName: selectedCrewObj!.name,
        crewId: selectedCrewObj!.id,
        areaName: currentAreaName,
        storeName: targetAreaLabel,
        plateNumber: selectedFleetObj?.plateNumber || '-',
        tripCount: areaCheck.tripCount,
        threshold: areaCheck.threshold,
        recentTrips: areaCheck.recentTrips
      });
      return;
    }

    const originBranch = branchStore.getBranchById(newScheduleOriginBranchId);
    const originWarehouseLabel = originBranch
      ? `Gudang Pusat ${originBranch.name} (${originBranch.slug})`
      : CENTRAL_WAREHOUSE.name;

    const originTuple: [number, number] =
      originBranch?.slug === 'sidoarjo'
        ? [-7.4478, 112.7183]
        : originBranch?.slug === 'nx-jember'
        ? [-8.1724, 113.6995]
        : CENTRAL_WAREHOUSE.coordinates;

    const scheduleData = {
      ...newSchedule,
      areaName: targetAreaLabel,
      cargoDescription: `Karton Box & Sheet Kemasan - Area ${targetAreaLabel}`,
      originName: originWarehouseLabel,
      originCoords: originTuple,
      departureDate: new Date(newSchedule.departureDate).toISOString(),
      estimatedArrival: new Date(newSchedule.estimatedArrival).toISOString(),
      areaApprovalStatus: (areaCheck?.requiresApproval ? 'approved' : 'not_required') as 'approved' | 'not_required',
      areaTripCount: (areaCheck?.tripCount || 0) + 1,
      isManuallyEdited: true
    };

    const crew = crews.find(c => c.id === scheduleData.crewId);
    const helper1 = crews.find(c => c.id === scheduleData.crewHelperId);
    const helper2 = crews.find(c => c.id === scheduleData.crewHelper2Id);
    const fleetLabel = selectedFleetObj
      ? `${selectedFleetObj.initialCode ? `[${selectedFleetObj.initialCode}] ` : ''}${selectedFleetObj.plateNumber}`
      : scheduleData.fleetId;
    const depFormatted = new Date(scheduleData.departureDate).toLocaleString('id-ID', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });

    if ((newSchedule as any).id) {
      logisticsStore.updateSchedule((newSchedule as any).id, scheduleData);
      branchStore.setScheduleBranch((newSchedule as any).id, newScheduleOriginBranchId);
      logisticsStore.addScheduleChangeLog({
        fileName: `Edit Jadwal Manual (${targetAreaLabel})`,
        actionType: 'edit_jadwal',
        summary: `Memperbarui jadwal pengiriman area ${targetAreaLabel}`,
        changes: [
          `Gudang Asal: ${originWarehouseLabel}`,
          `Area Kirim: ${targetAreaLabel}`,
          `Armada Truk: ${fleetLabel}`,
          `Kru Supir Utama: ${crew?.name || '-'}`,
          `Kru Helper: ${[helper1?.name, helper2?.name].filter(Boolean).join(', ') || '-'}`,
          `Estimasi Berangkat: ${depFormatted} WIB`
        ],
        status: 'Sukses'
      });
    } else {
      const created = logisticsStore.addSchedule(scheduleData);
      branchStore.setScheduleBranch(created.id, newScheduleOriginBranchId);

      logisticsStore.addScheduleChangeLog({
        fileName: `Input Jadwal Baru (+ Jadwal Baru)`,
        actionType: 'tambah_jadwal',
        summary: `Menambahkan jadwal pengiriman baru ke ${targetAreaLabel} dari ${originWarehouseLabel}`,
        changes: [
          `Gudang Asal: ${originWarehouseLabel}`,
          `Area Kirim: ${targetAreaLabel}`,
          `Armada Truk: ${fleetLabel}`,
          `Kru Supir Utama: ${crew?.name || '-'}`,
          `Kru Helper: ${[helper1?.name, helper2?.name].filter(Boolean).join(', ') || '-'}`,
          `Estimasi Berangkat: ${depFormatted} WIB`,
          `Nomor Tracking / SJ: ${created.trackingNumber}`
        ],
        status: 'Sukses'
      });

      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('akk-new-schedule-added', { detail: created }));
      }

      const msg = `Halo, Anda ditugaskan untuk pengiriman baru ke ${targetAreaLabel}. Armada: ${selectedFleetObj?.plateNumber || '-'}. Berangkat: ${depFormatted}`;
      if (crew) sendWhatsAppNotification(crew, msg);
      if (helper1) sendWhatsAppNotification(helper1, msg);
      if (helper2) sendWhatsAppNotification(helper2, msg);

      addNotification(
        'schedule',
        'Jadwal Baru Berhasil Dirilis',
        `Penugasan ke ${targetAreaLabel} (${crew?.name || 'Driver'} • ${fleetLabel}) otomatis masuk ke Jadwal & Penugasan serta Portal Driver Mobile.`
      );
      setAutoInitMessage(`✅ Jadwal pengiriman baru ke ${targetAreaLabel} (${crew?.name || 'Driver'} • ${fleetLabel}) dari ${originWarehouseLabel} berhasil ditambahkan!`);
      setTimeout(() => setAutoInitMessage(null), 6000);
    }

    setSchedules(logisticsStore.getSchedules());
    const freshTimestamps = calculateScheduleTimestamps(new Date(), 'JAJAG_RETAIL');
    setNewSchedule({
      trackingNumber: 'TRK-' + new Date().toISOString().substring(0, 10).replace(/-/g, '') + '-' + Math.floor(Math.random() * 900 + 100),
      storeId: 'JAJAG_RETAIL',
      fleetId: fleets[0]?.id || 'flt-01',
      crewId: crews.find(c => c.role.includes('Driver'))?.id || crews[0]?.id || 'crw-01',
      crewHelperId: crews.find(c => c.role.includes('Helper'))?.id || '',
      crewHelper2Id: '',
      status: 'scheduled' as ShipmentStatus,
      departureDate: freshTimestamps.departureDate,
      estimatedArrival: freshTimestamps.estimatedArrival,
      cargoDescription: '',
      cargoWeightTon: 2.5,
      isInterIsland: false,
      ferryBookingCode: '',
      transitPort: '',
      notes: ''
    });
    setIsAddScheduleOpen(false);
  };

  const handleApproveAreaAndSaveSchedule = (notes: string) => {
    if (!selectedCrewObj) return;
    const targetAreaLabel = AREA_MAP[newSchedule.storeId] || selectedStoreObj?.storeName || newSchedule.storeId;

    logisticsStore.createAreaApprovalRequest({
      crewId: selectedCrewObj.id,
      crewName: selectedCrewObj.name,
      targetArea: currentAreaName || targetAreaLabel,
      currentTripsInArea: areaCheck?.tripCount || 0,
      thresholdLimit: areaCheck?.threshold || 3,
      storeName: targetAreaLabel,
      plateNumber: selectedFleetObj?.plateNumber || '-',
      departureDate: new Date(newSchedule.departureDate).toISOString(),
      status: 'approved',
      reasonPolicy: `Otorisasi khusus penugasan pengiriman ke-${(areaCheck?.tripCount || 0) + 1} di area ${targetAreaLabel}.`,
      notes
    });

    const created = logisticsStore.addSchedule({
      ...newSchedule,
      areaName: targetAreaLabel,
      cargoDescription: `Karton Box & Sheet Kemasan - Area ${targetAreaLabel}`,
      originName: CENTRAL_WAREHOUSE.name,
      originCoords: CENTRAL_WAREHOUSE.coordinates,
      departureDate: new Date(newSchedule.departureDate).toISOString(),
      estimatedArrival: new Date(newSchedule.estimatedArrival).toISOString(),
      areaApprovalStatus: 'approved',
      areaTripCount: (areaCheck?.tripCount || 0) + 1,
      isManuallyEdited: true
    });

    const crew = crews.find(c => c.id === newSchedule.crewId);
    const helper1 = crews.find(c => c.id === newSchedule.crewHelperId);
    const helper2 = crews.find(c => c.id === newSchedule.crewHelper2Id);
    const fleetLabel = selectedFleetObj
      ? `${selectedFleetObj.initialCode ? `[${selectedFleetObj.initialCode}] ` : ''}${selectedFleetObj.plateNumber}`
      : newSchedule.fleetId;

    logisticsStore.addScheduleChangeLog({
      fileName: `Input Jadwal Baru (+ Otorisasi Area)`,
      actionType: 'tambah_jadwal',
      summary: `Menambahkan jadwal pengiriman baru ke ${targetAreaLabel} (Dispensasi Rotasi)`,
      changes: [
        `Area Kirim: ${targetAreaLabel}`,
        `Armada Truk: ${fleetLabel}`,
        `Kru Supir Utama: ${crew?.name || '-'}`,
        `Kru Helper: ${[helper1?.name, helper2?.name].filter(Boolean).join(', ') || '-'}`,
        `Catatan Otorisasi: ${notes || 'Disetujui'}`
      ],
      status: 'Sukses'
    });

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('akk-new-schedule-added', { detail: created }));
    }

    const msg = `Halo, Anda ditugaskan untuk pengiriman baru ke ${targetAreaLabel}. Armada: ${selectedFleetObj?.plateNumber}. Berangkat: ${new Date(newSchedule.departureDate).toLocaleString()}`;
    if (crew) sendWhatsAppNotification(crew, msg);
    if (helper1) sendWhatsAppNotification(helper1, msg);
    if (helper2) sendWhatsAppNotification(helper2, msg);

    setSchedules(logisticsStore.getSchedules());
    setAreaApprovalModalData(prev => ({ ...prev, isOpen: false }));
    setIsAddScheduleOpen(false);
  };

  const handleRejectAndPickOtherDriver = () => {
    const alternativeDriver = crews.find(c => c.id !== newSchedule.crewId && c.status === 'available');
    if (alternativeDriver) {
      setNewSchedule(prev => ({ ...prev, crewId: alternativeDriver.id }));
    }
    setAreaApprovalModalData(prev => ({ ...prev, isOpen: false }));
  };

const MONTH_NAMES = [
  'Semua Bulan',
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

const YEAR_LIST = ['Semua Tahun', '2024', '2025', '2026', '2027'];

  const handleUpdateStatus = (scheduleId: string, newStatus: ShipmentStatus) => {
    logisticsStore.updateScheduleStatus(scheduleId, newStatus);
  };

  // Helper to extract detailed date information from schedule
  const getScheduleDateDetails = (sch: Schedule) => {
    const dateStr = sch.departureDate || sch.createdAt;
    let d = dateStr ? new Date(dateStr) : new Date(2026, 0, 5);
    if (isNaN(d.getTime())) d = new Date(2026, 0, 5);

    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    const dateKey = `${yyyy}-${mm}-${dd}`;

    const days = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
    const dayName = days[d.getDay()] || getScheduleDayName(sch);
    const months = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
    const formattedDate = `${dd} ${months[d.getMonth()]} ${yyyy}`;
    const shortDate = `${dd} ${months[d.getMonth()].substring(0, 3)}`;

    const timing = getAreaScheduleTiming(sch.areaName, sch.store?.storeName, sch.store?.city);
    const depTime = sch.departureDate 
      ? new Date(sch.departureDate).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
      : timing.departureLabel.replace(' WIB', '');
    const arrTime = sch.estimatedArrival
      ? new Date(sch.estimatedArrival).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
      : timing.returnLabel.replace(' WIB', '');

    return {
      dateKey,
      dayName,
      formattedDate,
      shortDate,
      depTime: `${depTime} WIB`,
      arrTime: `${arrTime} WIB`,
      timing,
      rawDate: d
    };
  };

  // Unique list of dates present across all schedules with counts
  const distinctDateList = useMemo(() => {
    const map = new Map<string, {
      dateKey: string;
      dayName: string;
      formattedDate: string;
      shortDate: string;
      totalTrips: number;
      lokalCount: number;
      luarKotaCount: number;
      rawDate: Date;
    }>();

    schedules.forEach(sch => {
      const details = getScheduleDateDetails(sch);
      const isLuar = sch.isInterIsland || 
        (sch.areaName || '').toUpperCase().includes('BALI') || 
        (sch.areaName || '').toUpperCase().includes('DENPASAR') || 
        (sch.areaName || '').toUpperCase().includes('SINGARAJA') || 
        (sch.areaName || '').toUpperCase().includes('NEGARA');

      const existing = map.get(details.dateKey);
      if (existing) {
        existing.totalTrips++;
        if (isLuar) existing.luarKotaCount++;
        else existing.lokalCount++;
      } else {
        map.set(details.dateKey, {
          dateKey: details.dateKey,
          dayName: details.dayName,
          formattedDate: details.formattedDate,
          shortDate: details.shortDate,
          totalTrips: 1,
          lokalCount: isLuar ? 0 : 1,
          luarKotaCount: isLuar ? 1 : 0,
          rawDate: details.rawDate
        });
      }
    });

    return Array.from(map.values()).sort((a, b) => a.rawDate.getTime() - b.rawDate.getTime());
  }, [schedules]);

  // Unique list of Store Names / Area Destinations for the Store Filter dropdown
  const availableStoreNames = useMemo(() => {
    const storeNameSet = new Set<string>();
    schedules.forEach(sch => {
      const sName = (sch.store?.storeName || sch.areaName || AREA_MAP[sch.storeId] || '').trim();
      if (sName) storeNameSet.add(sName);
      const linkedRetailStore = stores.find(st => st.id === sch.storeId);
      if (linkedRetailStore?.storeName) {
        storeNameSet.add(linkedRetailStore.storeName.trim());
      }
    });
    stores.forEach(st => {
      if (st.storeName) storeNameSet.add(st.storeName.trim());
    });
    return Array.from(storeNameSet).sort((a, b) => a.localeCompare(b));
  }, [schedules, stores]);

  const filteredSchedules = schedules.filter(sch => {
    // 1. Filter Status Pengiriman (scheduled, in_transit, delivered, delayed)
    const matchesStatus = statusFilter === 'all' || sch.status === statusFilter;

    // 2. Kolom Pencarian: Nomor Pelacakan (trackingNumber) & Nama Toko (storeName / areaName)
    const q = searchQuery.trim().toLowerCase();
    const linkedRetailStore = stores.find(st => st.id === sch.storeId);
    const resolvedStoreName = (
      sch.store?.storeName ||
      linkedRetailStore?.storeName ||
      sch.areaName ||
      AREA_MAP[sch.storeId] ||
      ''
    ).toLowerCase();
    const matchesQuery =
      !q ||
      sch.trackingNumber.toLowerCase().includes(q) ||
      resolvedStoreName.includes(q) ||
      (sch.areaName && sch.areaName.toLowerCase().includes(q)) ||
      (sch.store?.storeName && sch.store.storeName.toLowerCase().includes(q)) ||
      (linkedRetailStore?.storeName && linkedRetailStore.storeName.toLowerCase().includes(q)) ||
      (sch.fleet?.plateNumber && sch.fleet.plateNumber.toLowerCase().includes(q)) ||
      (sch.fleet?.initialCode && sch.fleet.initialCode.toLowerCase().includes(q)) ||
      (sch.crew?.name && sch.crew.name.toLowerCase().includes(q));

    // 3. Filter Nama Toko
    let matchesStore = true;
    if (selectedStoreFilter !== 'all') {
      const targetStoreLower = selectedStoreFilter.toLowerCase();
      matchesStore =
        resolvedStoreName === targetStoreLower ||
        resolvedStoreName.includes(targetStoreLower) ||
        (sch.areaName || '').toLowerCase() === targetStoreLower ||
        (sch.store?.storeName || '').toLowerCase() === targetStoreLower ||
        (linkedRetailStore?.storeName || '').toLowerCase() === targetStoreLower;
    }

    // 4. Filter Tanggal Keberangkatan (departureDateFilter & selectedSpecificDate)
    const details = getScheduleDateDetails(sch);
    if (departureDateFilter) {
      const rawDepSlice = (sch.departureDate || '').slice(0, 10);
      if (details.dateKey !== departureDateFilter && rawDepSlice !== departureDateFilter) {
        return false;
      }
    }

    if (selectedSpecificDate !== 'all') {
      if (details.dateKey !== selectedSpecificDate) {
        return false;
      }
    }

    // Fleet filter
    const matchesFleet = selectedFleetId === 'all' || sch.fleetId === selectedFleetId;

    // Day filter
    let matchesDay = true;
    if (selectedDayFilter !== 'all') {
      const schDay = getScheduleDayName(sch);
      matchesDay = schDay === selectedDayFilter;
    }

    // Month & Year Date filter
    let matchesDate = true;
    const dateStr = sch.departureDate || sch.createdAt;
    if (dateStr && !departureDateFilter) {
      const d = new Date(dateStr);
      if (!isNaN(d.getTime())) {
        if (selectedYear !== 'Semua Tahun' && d.getFullYear().toString() !== selectedYear) {
          matchesDate = false;
        }
        if (selectedMonth !== 'Semua Bulan') {
          const monthIdx = MONTH_NAMES.indexOf(selectedMonth) - 1;
          if (monthIdx >= 0 && d.getMonth() !== monthIdx) {
            matchesDate = false;
          }
        }
      }
    }

    return matchesStatus && matchesQuery && matchesStore && matchesFleet && matchesDay && matchesDate;
  });

  // Chronologically sorted filtered schedules
  const sortedFilteredSchedules = useMemo(() => {
    return [...filteredSchedules].sort((a, b) => {
      const ta = new Date(a.departureDate || a.createdAt || 0).getTime();
      const tb = new Date(b.departureDate || b.createdAt || 0).getTime();
      return ta - tb;
    });
  }, [filteredSchedules]);

  // Grouped schedules by date for clean accordion cards
  const groupedSchedulesByDate = useMemo(() => {
    const groups: {
      dateKey: string;
      dayName: string;
      formattedDate: string;
      shortDate: string;
      trips: Schedule[];
      lokalCount: number;
      luarKotaCount: number;
    }[] = [];

    const map = new Map<string, typeof groups[0]>();

    sortedFilteredSchedules.forEach(sch => {
      const details = getScheduleDateDetails(sch);
      const isLuar = sch.isInterIsland || 
        (sch.areaName || '').toUpperCase().includes('BALI') || 
        (sch.areaName || '').toUpperCase().includes('DENPASAR') || 
        (sch.areaName || '').toUpperCase().includes('SINGARAJA') || 
        (sch.areaName || '').toUpperCase().includes('NEGARA');

      let grp = map.get(details.dateKey);
      if (!grp) {
        grp = {
          dateKey: details.dateKey,
          dayName: details.dayName,
          formattedDate: details.formattedDate,
          shortDate: details.shortDate,
          trips: [],
          lokalCount: 0,
          luarKotaCount: 0
        };
        map.set(details.dateKey, grp);
        groups.push(grp);
      }
      grp.trips.push(sch);
      if (isLuar) grp.luarKotaCount++;
      else grp.lokalCount++;
    });

    return groups.sort((a, b) => a.dateKey.localeCompare(b.dateKey));
  }, [sortedFilteredSchedules]);

  return (
    <div className="space-y-6">
      <style>{`
        @media print {
          .no-print { display: none !important; }
        }
      `}</style>

      {/* Auto-Initialization Success Banner */}
      {autoInitMessage && (
        <div className="bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 p-4 rounded-xl flex items-center justify-between gap-3 font-medium text-xs no-print shadow-lg animate-fade-in">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-400" />
            <span>{autoInitMessage}</span>
          </div>
          <button
            onClick={() => setAutoInitMessage(null)}
            className="text-emerald-400 hover:text-white text-xs underline cursor-pointer"
          >
            Tutup
          </button>
        </div>
      )}

      {/* Cabang Selector Toolbar (Design matching image_bbbfdc09.png) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl px-5 py-3 shadow-xs no-print">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-500 shrink-0">
            <Building2 className="w-4.5 h-4.5" />
          </div>
          <div>
            <div className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider">
              Jadwal Distribusi &amp; Penugasan Armada
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Sistem jadwal terintegrasi cabang operasional.
            </p>
          </div>
        </div>

        {/* Dropdown UI/UX matching user reference image_bbbfdc09.png */}
        <div className="relative self-start sm:self-auto" ref={branchDropdownRef}>
          <div className="text-[10px] font-black uppercase text-slate-400 dark:text-slate-500 tracking-wider mb-0.5">
            CABANG
          </div>
          <button
            type="button"
            onClick={() => setIsBranchDropdownOpen((prev) => !prev)}
            className="flex items-center gap-2.5 px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white text-xs font-bold shadow-xs hover:border-blue-500 transition cursor-pointer min-w-[150px] justify-between"
          >
            <div className="flex items-center gap-2">
              <CalendarDays className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
              <span>
                {selectedOriginBranchId === 'ALL'
                  ? 'Semua Cabang'
                  : branches.find((b) => b.id === selectedOriginBranchId)?.name || 'Pilih Cabang'}
              </span>
            </div>
            <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform ${isBranchDropdownOpen ? 'rotate-180' : ''}`} />
          </button>

          {isBranchDropdownOpen && (
            <div className="absolute right-0 mt-1.5 w-48 bg-white dark:bg-slate-900 rounded-xl shadow-xl border border-slate-200 dark:border-slate-800 py-1 z-30 overflow-hidden">
              <button
                type="button"
                onClick={() => {
                  branchStore.setSelectedOriginBranchId('ALL');
                  setIsBranchDropdownOpen(false);
                }}
                className={`w-full text-left px-3.5 py-2 text-xs transition cursor-pointer flex items-center justify-between ${
                  selectedOriginBranchId === 'ALL'
                    ? 'bg-blue-600 text-white font-black'
                    : 'text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 font-bold'
                }`}
              >
                <span>Semua Cabang</span>
                <span className="text-[10px] opacity-80 font-mono">({schedules.length})</span>
              </button>
              {branches.map((b) => {
                const count = schedules.filter((s) => branchStore.getScheduleBranch(s.id).id === b.id).length;
                const isSelected = selectedOriginBranchId === b.id;
                return (
                  <button
                    key={b.id}
                    type="button"
                    onClick={() => {
                      branchStore.setSelectedOriginBranchId(b.id);
                      setIsBranchDropdownOpen(false);
                    }}
                    className={`w-full text-left px-3.5 py-2 text-xs transition cursor-pointer flex items-center justify-between ${
                      isSelected
                        ? 'bg-blue-600 text-white font-black'
                        : 'text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 font-bold'
                    }`}
                  >
                    <span>{b.name}</span>
                    <span className="text-[10px] opacity-80 font-mono">({count})</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <GoogleSheetsAdminScheduleView
        onSyncComplete={() => {
          setSchedules(logisticsStore.getSchedules());
        }}
        onNavigateToCrewHistory={onNavigateToCrewHistory}
        onOpenCreateSchedule={() => {
          if (stores.length > 0) handleOpenCreateWithStore(stores[0]);
          else setIsAddScheduleOpen(true);
        }}
      />


      {/* Create Schedule Modal */}
      <AnimatePresence>
        {isAddScheduleOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.96, opacity: 0, y: 8 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.96, opacity: 0, y: 8 }}
              className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl"
            >
              {/* Modal Header */}
              <div className="px-5 py-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-blue-500/15 border border-blue-500/30 flex items-center justify-center text-blue-400 shrink-0">
                    <Calendar className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-extrabold text-white flex items-center gap-2 flex-wrap">
                      <span>Buat Surat Perintah Jalan &amp; Jadwal Pengiriman Baru</span>
                    </h3>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Data Supir &amp; Helper terintegrasi otomatis dari akun Manajemen User
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setIsAddScheduleOpen(false)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
                >
                  <XCircle className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleCreateSchedule} className="p-5 space-y-4 text-xs max-h-[82vh] overflow-y-auto">
                {/* Cabang Asal Pengiriman */}
                <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                  <label className="text-slate-300 font-bold flex items-center gap-1.5 text-xs">
                    <Building2 className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Cabang Asal Pengiriman *</span>
                  </label>
                  <select
                    value={newScheduleOriginBranchId}
                    onChange={(e) => setNewScheduleOriginBranchId(e.target.value)}
                    className="px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-xs font-bold text-emerald-400 focus:outline-none focus:border-emerald-500 cursor-pointer"
                  >
                    {branches.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name} ({b.city || b.slug})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Section 1: Area & Armada */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="text-slate-300 font-bold flex items-center gap-1.5 text-xs">
                        <MapPin className="w-3.5 h-3.5 text-blue-400" />
                        <span>Area Kirim Tujuan *</span>
                      </label>
                      <span className="text-[10px] font-bold text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded-full border border-blue-500/20">
                        {OFFICIAL_DESTINATION_AREAS.length} Area Terdaftar
                      </span>
                    </div>

                    {/* Selected Area Card with Expandable Searchable Picker */}
                    <div className="rounded-xl border border-slate-800 bg-slate-950 p-2.5 transition">
                      <div
                        onClick={() => setIsAreaPickerExpanded(!isAreaPickerExpanded)}
                        className="flex items-center justify-between gap-2 cursor-pointer select-none"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="w-9 h-9 rounded-xl bg-blue-500/15 border border-blue-500/30 text-blue-400 flex items-center justify-center shrink-0">
                            <MapPin className="w-4 h-4" />
                          </div>
                          <div className="min-w-0">
                            <div className="text-xs font-black text-white truncate">
                              {newSchedule.storeId || 'Klik untuk Pilih Area Tujuan'}
                            </div>
                            {newSchedule.storeId ? (
                              <span className={`inline-block text-[9px] font-bold px-1.5 py-0.2 rounded border mt-0.5 ${getAreaRegionCategory(newSchedule.storeId).badgeColor}`}>
                                {getAreaRegionCategory(newSchedule.storeId).label}
                              </span>
                            ) : (
                              <span className="text-[10px] text-slate-400">
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
                          className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-bold text-[11px] flex items-center gap-1.5 transition cursor-pointer shadow-xs shrink-0"
                        >
                          <span>{isAreaPickerExpanded ? 'Tutup Pilihan' : 'Pilih / Ganti Area'}</span>
                          <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${isAreaPickerExpanded ? 'rotate-180' : ''}`} />
                        </button>
                      </div>

                      {/* Expanded Custom Interactive Area Selector */}
                      {isAreaPickerExpanded && (
                        <div className="mt-3 pt-3 border-t border-slate-800 space-y-2.5 animate-in fade-in duration-150">
                          {/* Search Bar with clear button */}
                          <div className="relative">
                            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                            <input
                              type="text"
                              value={areaSearchFilter}
                              onChange={(e) => setAreaSearchFilter(e.target.value)}
                              placeholder="Cari area (misal: Denpasar, Toko DR. Soetomo, Nusantara Expand, Titipan Kota Kota)..."
                              className="w-full bg-slate-900 border border-slate-700 text-white text-xs rounded-lg pl-8 pr-8 py-2 focus:outline-none focus:border-blue-500"
                              autoFocus
                            />
                            {areaSearchFilter && (
                              <button
                                type="button"
                                onClick={() => setAreaSearchFilter('')}
                                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white text-xs cursor-pointer"
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
                                    ? 'bg-blue-600 text-white shadow-xs'
                                    : 'bg-slate-900 text-slate-400 border border-slate-800 hover:bg-slate-800 hover:text-slate-200'
                                }`}
                              >
                                {cat.label}
                              </button>
                            ))}
                          </div>

                          {/* Interactive Area Options Grid */}
                          <div className="max-h-56 overflow-y-auto pr-1 grid grid-cols-1 gap-1.5">
                            {filteredOfficialAreas.map(areaName => {
                              const isSelected = newSchedule.storeId === areaName;
                              const meta = getAreaRegionCategory(areaName);
                              return (
                                <button
                                  key={areaName}
                                  type="button"
                                  onClick={() => {
                                    handleSelectArea(areaName);
                                    setIsAreaPickerExpanded(false);
                                  }}
                                  className={`flex items-center justify-between p-2 rounded-lg text-left transition cursor-pointer border ${
                                    isSelected
                                      ? 'bg-blue-500/20 border-blue-500 text-blue-200 shadow-2xs font-extrabold'
                                      : 'bg-slate-900 border-slate-800 hover:border-blue-500/50 hover:bg-slate-800/80 text-slate-200'
                                  }`}
                                >
                                  <div className="min-w-0 pr-2">
                                    <div className="text-xs truncate">{areaName}</div>
                                    <span className={`inline-block text-[9px] font-bold px-1.5 py-0.2 rounded border mt-0.5 ${meta.badgeColor}`}>
                                      {meta.label}
                                    </span>
                                  </div>
                                  {isSelected ? (
                                    <div className="w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center shrink-0">
                                      <Check className="w-3 h-3" />
                                    </div>
                                  ) : (
                                    <span className="text-[10px] text-slate-500 font-semibold">Pilih</span>
                                  )}
                                </button>
                              );
                            })}
                            {filteredOfficialAreas.length === 0 && (
                              <div className="py-4 text-center text-xs text-slate-400">
                                Tidak ada area yang cocok dengan pencarian "{areaSearchFilter}"
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  <div>
                    <label className="text-slate-300 font-bold block mb-1.5 flex items-center gap-1.5">
                      <Truck className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Alokasi Armada Truk *</span>
                    </label>
                    <select
                      required
                      value={newSchedule.fleetId}
                      onChange={(e) => setNewSchedule({ ...newSchedule, fleetId: e.target.value })}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white font-semibold focus:outline-none focus:border-blue-500 transition cursor-pointer"
                    >
                      <option value="">-- Pilih Truk Armada --</option>
                      {fleets.map(fl => {
                        const liveInfo = logisticsStore.getFleetLiveOperationalInfo(fl);
                        const isServis = !liveInfo.canBeScheduled;
                        return (
                          <option key={fl.id} value={fl.id} disabled={isServis}>
                            {fl.initialCode ? `[${fl.initialCode}] ` : ''}{fl.plateNumber} — {liveInfo.statusLabel}
                            {liveInfo.effectiveStatus === 'on-duty' && liveInfo.areaName ? ` (Kirim: ${liveInfo.areaName})` : ''}
                            {isServis ? ' [Servis - Tidak Bisa Dijadwalkan]' : ''}
                          </option>
                        );
                      })}
                    </select>
                    {newSchedule.fleetId && (() => {
                      const selFleet = fleets.find(f => f.id === newSchedule.fleetId);
                      if (!selFleet) return null;
                      const liveInfo = logisticsStore.getFleetLiveOperationalInfo(selFleet);
                      return (
                        <div className="mt-2 flex items-center justify-between gap-2 px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-[11px]">
                          <div className="flex items-center gap-2">
                            <span className={`w-3 h-3 rounded-full shrink-0 ${liveInfo.dotColorClass}`} />
                            <span className="font-bold text-white">
                              Status Armada: {liveInfo.statusLabel}
                            </span>
                          </div>
                          <span className="text-[10px] font-medium text-slate-400 truncate">
                            {liveInfo.effectiveStatus === 'on-duty' && liveInfo.areaName
                              ? `Area Hari Ini: ${liveInfo.areaName}`
                              : liveInfo.effectiveStatus === 'maintenance'
                              ? 'Sedang Perbaikan (Servis)'
                              : 'Siap Digunakan Kirim'}
                          </span>
                        </div>
                      );
                    })()}
                  </div>
                </div>

                {newSchedule.storeId && (
                  <div className="px-3.5 py-2.5 rounded-xl bg-slate-950/90 border border-slate-800 text-[11px] text-slate-300 flex items-center justify-between gap-2">
                    {(() => {
                      const timing = getAreaScheduleTiming(newSchedule.storeId);
                      return (
                        <>
                          <div className="flex items-center gap-2 min-w-0">
                            <Clock className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                            <span className="truncate">
                              SOP Rute: Berangkat DC <strong className="text-white">{timing.departureLabel}</strong> &bull; Estimasi Tiba di Gudang <strong className="text-amber-300">{timing.isNextDayReturn ? 'Besok ' : ''}{timing.returnLabel}</strong>
                            </span>
                          </div>
                          <span className={`px-2.5 py-0.5 rounded-md text-[10px] font-bold shrink-0 ${timing.isNightDeparture ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'}`}>
                            {timing.isNightDeparture ? '🌙 Berangkat Malam' : '☀️ Berangkat Pagi'}
                          </span>
                        </>
                      );
                    })()}
                  </div>
                )}

                {/* Section 2: Penugasan Kru (Terintegrasi Manajemen User) */}
                <div className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800/90 space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] font-bold text-slate-200 flex items-center gap-1.5">
                      <User className="w-3.5 h-3.5 text-amber-400" />
                      <span>Penugasan Kru Pengiriman (Sinkron Manajemen User)</span>
                    </span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                      Role: Driver &amp; Helper
                    </span>
                  </div>

                  <div className="space-y-3">
                    <CrewIdCustomDropdown
                      label="Kru Supir Utama (Role: Driver) *"
                      value={newSchedule.crewId}
                      options={logisticsStore.getDriverCrews()}
                      onChange={(id) => setNewSchedule({ ...newSchedule, crewId: id })}
                      emptyLabel="-- Pilih Supir Utama --"
                      roleBadgeText="Kru Supir"
                      accentColor="blue"
                    />
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <CrewIdCustomDropdown
                        label="Kru Helper 1 / Kernet (Opsional)"
                        value={newSchedule.crewHelperId || ''}
                        options={logisticsStore
                          .getHelperCrews()
                          .filter(c => c.id !== newSchedule.crewId && c.id !== newSchedule.crewHelper2Id)}
                        onChange={(id) => setNewSchedule({ ...newSchedule, crewHelperId: id })}
                        emptyLabel="-- Pilih Helper 1 --"
                        roleBadgeText="Kru Helper"
                        accentColor="emerald"
                      />
                      <CrewIdCustomDropdown
                        label="Kru Helper 2 / Kernet (Opsional)"
                        value={newSchedule.crewHelper2Id || ''}
                        options={logisticsStore
                          .getHelperCrews()
                          .filter(c => c.id !== newSchedule.crewId && c.id !== newSchedule.crewHelperId)}
                        onChange={(id) => setNewSchedule({ ...newSchedule, crewHelper2Id: id })}
                        emptyLabel="-- Pilih Helper 2 --"
                        roleBadgeText="Kru Helper"
                        accentColor="emerald"
                      />
                    </div>
                  </div>
                </div>

                {/* Area frequency & approval alert preview */}
                {areaCheck && areaCheck.requiresApproval && (
                  <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs flex items-start gap-2.5">
                    <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                    <div>
                      <div className="font-bold">Batas Pengiriman Wilayah Tercapai ({areaCheck.tripCount}x Kirim)</div>
                      <div className="text-[11px] text-slate-300 mt-0.5">
                        Supir <strong className="text-white">{selectedCrewObj?.name}</strong> telah mengirim {areaCheck.tripCount} kali ke wilayah <strong className="text-white">{currentAreaName}</strong>.
                        {areaCheck.isApproved ? (
                          <span className="text-emerald-400 font-semibold block mt-0.5">✓ Otorisasi dispensasi rotasi wilayah telah disetujui.</span>
                        ) : (
                          <span className="text-amber-400 font-semibold block mt-0.5">Pop-up persetujuan otorisasi khusus akan otomatis muncul saat Anda mengklik "Simpan &amp; Rilis Penugasan".</span>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* Section 3: Jam Keberangkatan & Target Jam Kepulangan */}
                <div className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800/90 space-y-3">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <span className="text-[11px] font-bold text-slate-200 flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-blue-400" />
                      <span>Jam Keberangkatan &amp; Target Jam Kepulangan</span>
                    </span>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => {
                          const now = new Date();
                          const timestamps = calculateScheduleTimestamps(now, newSchedule.storeId || 'JAJAG_RETAIL');
                          setNewSchedule({
                            ...newSchedule,
                            departureDate: timestamps.departureDate,
                            estimatedArrival: timestamps.estimatedArrival
                          });
                        }}
                        className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 cursor-pointer transition"
                      >
                        Hari Ini
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const tomorrow = new Date();
                          tomorrow.setDate(tomorrow.getDate() + 1);
                          const timestamps = calculateScheduleTimestamps(tomorrow, newSchedule.storeId || 'JAJAG_RETAIL');
                          setNewSchedule({
                            ...newSchedule,
                            departureDate: timestamps.departureDate,
                            estimatedArrival: timestamps.estimatedArrival
                          });
                        }}
                        className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 border border-blue-500/40 cursor-pointer flex items-center gap-1 transition"
                      >
                        <span>Jadwal H+1 (Besok)</span>
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    <div>
                      <label className="text-slate-300 font-bold block mb-1 text-[11px]">
                        Jam Keberangkatan (Berangkat dari DC) *
                      </label>
                      <input
                        type="datetime-local"
                        required
                        value={newSchedule.departureDate}
                        onChange={(e) => setNewSchedule({ ...newSchedule, departureDate: e.target.value })}
                        className="w-full px-3.5 py-2 rounded-xl bg-slate-900 border border-slate-800 text-white font-semibold text-xs focus:outline-none focus:border-blue-500"
                      />
                    </div>
                    <div>
                      <label className="text-slate-300 font-bold block mb-1 text-[11px]">
                        Target Jam Kepulangan (Tiba di Gudang) *
                      </label>
                      <input
                        type="datetime-local"
                        required
                        value={newSchedule.estimatedArrival}
                        onChange={(e) => setNewSchedule({ ...newSchedule, estimatedArrival: e.target.value })}
                        className="w-full px-3.5 py-2 rounded-xl bg-slate-900 border border-slate-800 text-white font-semibold text-xs focus:outline-none focus:border-blue-500"
                      />
                    </div>
                  </div>
                </div>

                {/* Modal Footer */}
                <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-800">
                  <button
                    type="button"
                    onClick={() => setIsAddScheduleOpen(false)}
                    className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold transition cursor-pointer"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold shadow-lg shadow-blue-600/25 transition cursor-pointer active:scale-95"
                  >
                    Simpan &amp; Rilis Penugasan
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Manifest / Surat Jalan Preview Modal */}
      <AnimatePresence>
        {selectedManifest && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-sm flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white text-slate-900 rounded-xl w-full max-w-2xl overflow-hidden shadow-2xl"
            >
              <div className="bg-slate-900 text-white p-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-amber-400" />
                  <span className="font-bold text-sm">SURAT JALAN & MANIFEST PENGIRIMAN B2B</span>
                </div>
                <button
                  onClick={() => setSelectedManifest(null)}
                  className="text-slate-400 hover:text-white font-bold"
                >
                  &times;
                </button>
              </div>

            <div className="p-6 space-y-5 text-xs">
              {/* Header Company */}
              <div className="border-b border-slate-300 pb-4 flex justify-between items-start">
                <div>
                  <h2 className="text-base font-black text-slate-900 uppercase">PT. ANUGRAH KEMASAN KREATIF</h2>
                  <p className="text-slate-600 text-[11px] mt-0.5">{CENTRAL_WAREHOUSE.name}</p>
                  <p className="text-slate-500 text-[10px]">{CENTRAL_WAREHOUSE.address}</p>
                </div>
                <div className="text-right">
                  <div className="text-xs font-mono font-bold text-blue-800">{selectedManifest.trackingNumber}</div>
                  <div className="text-[10px] text-slate-500 mt-1">Tanggal: {new Date(selectedManifest.createdAt).toLocaleDateString('id-ID')}</div>
                </div>
              </div>

              {/* Destination & Fleet Matrix */}
              <div className="grid grid-cols-2 gap-4">
                <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                  <span className="text-[10px] font-bold uppercase text-slate-500">AREA KIRIM:</span>
                  <div className="font-bold text-slate-900 text-sm mt-1">{selectedManifest.areaName || selectedManifest.store?.storeName || AREA_MAP[selectedManifest.storeId] || '-'}</div>
                  <div className="text-slate-600 mt-0.5">{selectedManifest.store?.address}</div>
                  <div className="text-blue-700 font-bold mt-1">Wilayah: Banyuwangi</div>
                </div>

                <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                  <span className="text-[10px] font-bold uppercase text-slate-500">ARMADA, DRIVER &amp; HELPER (KERNET):</span>
                  <div className="font-bold text-slate-900 text-sm mt-1 font-mono">{selectedManifest.fleet?.plateNumber}</div>
                  <div className="text-slate-600 mt-0.5">Tipe: {selectedManifest.fleet?.vehicleType}</div>
                  <div className="text-slate-600 mt-0.5">Driver: <strong>{crews.find(c => c.id === selectedManifest.crewId || c.id === selectedManifest.crew?.id)?.name || selectedManifest.crew?.name}</strong> ({selectedManifest.crew?.licenseType})</div>
                  <div className="text-slate-600 mt-0.5">Helper 1: <strong>{crews.find(c => c.id === selectedManifest.crewHelperId || c.id === selectedManifest.crewHelper?.id)?.name || selectedManifest.crewHelper?.name || '-'}</strong></div>
                  {selectedManifest.crewHelper2 && (
                    <div className="text-slate-600 mt-0.5">Helper 2: <strong>{crews.find(c => c.id === selectedManifest.crewHelper2Id || c.id === selectedManifest.crewHelper2?.id)?.name || selectedManifest.crewHelper2.name}</strong></div>
                  )}
                  <div className="text-slate-600 mt-0.5">Telp Driver: {crews.find(c => c.id === selectedManifest.crewId || c.id === selectedManifest.crew?.id)?.phone || selectedManifest.crew?.phone}</div>
                </div>
              </div>

              {/* Inter-island logistics info */}
              {selectedManifest.isInterIsland && (
                <div className="p-3 bg-emerald-50 border border-emerald-300 rounded-lg text-emerald-900">
                  <div className="font-bold flex items-center gap-1.5">
                    <Ship className="w-3.5 h-3.5" />
                    <span>LOGISTIK PENYEBERANGAN KAPAL FERRY / RO-RO</span>
                  </div>
                  <div className="mt-1 text-[11px]">
                    Pelabuhan: <strong>{selectedManifest.transitPort || '-'}</strong>
                  </div>
                </div>
              )}

              {/* Items Table */}
              <table className="w-full text-left border border-slate-300">
                <thead className="bg-slate-100 text-slate-700 border-b border-slate-300">
                  <tr>
                    <th className="p-2">No</th>
                    <th className="p-2">Keterangan</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  <tr>
                    <td className="p-2 font-mono">01</td>
                    <td className="p-2 font-medium">Pengiriman ke Area {selectedManifest.areaName || selectedManifest.store?.storeName || AREA_MAP[selectedManifest.storeId] || 'Tujuan'}</td>
                  </tr>
                </tbody>
              </table>

              {/* Signatures 4 Kolom: SPV Logistik, Super Admin, Security, Driver / Helper */}
              <div className="grid grid-cols-4 gap-2 pt-4 text-center text-[10px] text-slate-600 border-t border-slate-200">
                <div>
                  <div className="font-semibold text-slate-800">Disiapkan Oleh:</div>
                  <div className="h-10 border-b border-slate-300 mt-1 flex items-center justify-center">
                    <span className="text-[9px] text-blue-700 italic">✓ Disiapkan</span>
                  </div>
                  <div className="font-bold text-slate-900 mt-1">{logisticsStore.getLogisticsCoordinator()}</div>
                </div>
                <div>
                  <div className="font-semibold text-slate-800">Mengetahui:</div>
                  <div className="h-10 border-b border-slate-300 mt-1 flex items-center justify-center">
                    <span className="text-[9px] text-indigo-700 italic">✓ Diketahui</span>
                  </div>
                  <div className="font-bold text-slate-900 mt-1">{logisticsStore.getSuperAdminOrManager().name}</div>
                </div>
                <div>
                  <div className="font-semibold text-slate-800">Security:</div>
                  <div className="h-10 border-b border-slate-300 mt-1 flex items-center justify-center">
                    <span className="text-[9px] text-emerald-700 italic">✓ Gate Pass OK</span>
                  </div>
                  <div className="font-bold text-slate-900 mt-1">{logisticsStore.getUsers().find(u => u.fullName.toLowerCase().includes('security') || u.department?.toLowerCase().includes('security') || u.role === ('security' as any))?.fullName || 'Pos Gerbang DC (Hairul Rozikin)'}</div>
                </div>
                <div>
                  <div className="font-semibold text-slate-800">Dibawa Oleh:</div>
                  <div className="h-10 border-b border-slate-300 mt-1 flex items-center justify-center">
                    <span className="text-[9px] text-amber-700 italic">✓ Diserahkan</span>
                  </div>
                  <div className="font-bold text-slate-900 mt-1 leading-tight">
                    {crews.find(c => c.id === selectedManifest.crewId || c.id === selectedManifest.crew?.id)?.name || selectedManifest.crew?.name || 'Driver'} 
                    {selectedManifest.crewHelper ? ` / ${crews.find(c => c.id === selectedManifest.crewHelperId || c.id === selectedManifest.crewHelper?.id)?.name || selectedManifest.crewHelper.name}` : ''}
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-slate-100 p-4 border-t border-slate-300 flex flex-wrap justify-end items-center gap-2">
              <button
                onClick={() => setSelectedManifest(null)}
                className="px-4 py-2 rounded-lg bg-slate-200 hover:bg-slate-300 text-slate-700 font-semibold text-xs transition cursor-pointer"
              >
                Tutup
              </button>
              <button
                onClick={() => {
                  const target = selectedManifest;
                  setSelectedManifest(null);
                  if (target) handleViewRouteOnMap(target);
                }}
                className="px-4 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-semibold text-xs flex items-center gap-1.5 transition cursor-pointer shadow"
                title="Buka dan Sorot Rute Jadwal Ini di Peta Interaktif Leaflet"
              >
                <Compass className="w-3.5 h-3.5" />
                <span>Lihat Rute di Peta</span>
              </button>
              <button
                onClick={handleDownloadManifestPdf}
                disabled={isExportingManifestPdf}
                className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-400 text-white font-bold text-xs flex items-center gap-1.5 shadow transition cursor-pointer active:scale-95"
                title="Unduh berkas PDF resmi Surat Jalan Keluar & Manifest Siap Cetak"
              >
                {isExportingManifestPdf ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Memproses PDF...</span>
                  </>
                ) : (
                  <>
                    <Download className="w-3.5 h-3.5" />
                    <span>Unduh PDF Resmi</span>
                  </>
                )}
              </button>
              <button
                onClick={() => {
                  try {
                    if (window.self !== window.top) {
                      handleDownloadManifestPdf();
                    } else {
                      window.print();
                    }
                  } catch {
                    handleDownloadManifestPdf();
                  }
                }}
                className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs flex items-center gap-1.5 shadow transition cursor-pointer active:scale-95"
                title="Cetak langsung menggunakan printer atau cetak ke PDF"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Cetak Dokumen Surat Jalan</span>
              </button>
            </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Area Trip Limit Approval Modal */}
      <AreaApprovalModal
        isOpen={areaApprovalModalData.isOpen}
        onClose={() => setAreaApprovalModalData(prev => ({ ...prev, isOpen: false }))}
        crewName={areaApprovalModalData.crewName}
        crewId={areaApprovalModalData.crewId}
        areaName={areaApprovalModalData.areaName}
        storeName={areaApprovalModalData.storeName}
        plateNumber={areaApprovalModalData.plateNumber}
        tripCount={areaApprovalModalData.tripCount}
        threshold={areaApprovalModalData.threshold}
        recentTrips={areaApprovalModalData.recentTrips}
        onApprove={handleApproveAreaAndSaveSchedule}
        onRejectAndPickOtherDriver={handleRejectAndPickOtherDriver}
      />

      <AreaRepetitionWarningModal
        isOpen={!!consecutiveConflict}
        conflict={consecutiveConflict}
        onProceedUrgent={() => {
             setConsecutiveConflict(null);
             // Call logic to save schedule directly
        }}
        onSelectAlternative={(crewId) => {
             setNewSchedule(prev => ({ ...prev, crewId }));
             setConsecutiveConflict(null);
        }}
        onCancel={() => setConsecutiveConflict(null)}
      />

      {/* Crew & Driver Simulation Modal */}
      <CrewSimulationModal
        isOpen={isCrewSimulationOpen}
        onClose={() => setIsCrewSimulationOpen(false)}
        crews={crews}
        fleets={fleets}
        stores={stores}
      />

      {/* Crew Pool Management Modal */}
      <CrewPoolManagementModal
        isOpen={isCrewPoolOpen}
        onClose={() => setIsCrewPoolOpen(false)}
        crews={crews}
        onRefresh={() => setCrews(logisticsStore.getCrews())}
      />

      {/* Optimal Route Planning Modal */}
      <OptimalRoutePlanningModal
        isOpen={isRouteOptimizerOpen}
        onClose={() => setIsRouteOptimizerOpen(false)}
        crews={crews}
        fleets={fleets}
        stores={stores}
        onApplyRecommendation={handleApplyOptimalRoute}
      />

      {/* Smart Fill Mingguan Modal */}
      <SmartFillModal
        isOpen={isSmartFillOpen}
        onClose={() => setIsSmartFillOpen(false)}
        onSuccess={handleSmartFillSuccess}
      />
    </div>
  );
};
