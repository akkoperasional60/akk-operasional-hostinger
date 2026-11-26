import React, { useState, useEffect, useMemo, useRef, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  Truck,
  Users,
  Plus,
  ShieldCheck,
  Wrench,
  CheckCircle2,
  Fuel,
  AlertCircle,
  AlertTriangle,
  Phone,
  Award,
  Calendar,
  Search,
  History,
  ShieldAlert,
  UserCheck,
  Edit3,
  Trash2,
  FileText,
  CreditCard,
  Droplets,
  Disc,
  BatteryCharging,
  Radio,
  Gauge,
  Clock,
  Box,
  Eye,
  X,
  Save,
  Check,
  Table,
  LayoutGrid,
  Database,
  RefreshCw,
  Cloud,
  ExternalLink,
  ChevronRight,
  ChevronDown,
  Building2,
  Info,
  MapPin,
  ArrowUpDown,
  ArrowUp,
  ArrowDown
} from 'lucide-react';
import { Fleet, Crew, VehicleType, FleetStatus, CrewStatus } from '../types';
import { logisticsStore } from '../services/store';
import { validateFleet, validateCrew } from '../utils/validation';
import { CrewDeliveryHistoryView } from './CrewDeliveryHistoryView';
import { FleetMiniMapPreview } from './FleetMiniMapPreview';
import { FuelEfficiencyManagement } from './FuelEfficiencyManagement';
import { SparePartManagement } from './SparePartManagement';
import { FleetFormCenter } from './FleetFormCenter';
import { Fleet3DShowcase } from './Fleet3DShowcase';
import { branchStore, BranchRecord } from '../services/branchStore';
import {
  updateFleetInSupabase,
  updateCrewInSupabase,
  createFleetInSupabase,
  createCrewInSupabase,
  deleteFleetInSupabase,
  deleteCrewInSupabase,
  syncFleetsAndCrewsWithSupabase
} from '../services/supabaseService';
import { resolveCanonicalFleetMeta, sortFleetsByCanonicalOrder } from '../data/mockData';
import { listenCrewChanged } from './crew/crewApi';

// Helper for default box cubic capacity (m3 / CBM) and dimensions
export const getDefaultBoxCapacityM3 = (vehicleType: VehicleType | string, brand?: string): number => {
  const vType = (vehicleType || '').toLowerCase();
  const b = (brand || '').toLowerCase();
  if (vType.includes('pick up') || vType.includes('pickup')) {
    if (b.includes('traga')) return 6.2;
    return 5.5; // Mitsubishi L300 Box ~5.5 m3
  }
  if (vType.includes('engkel long') || vType.includes('long')) {
    return 14.0; // Hino Dutro / Canter Long ~14.0 m3
  }
  if (vType.includes('engkel') || vType.includes('cde')) {
    return 9.0; // Engkel STD Canter ~9.0 m3
  }
  if (vType.includes('double') || vType.includes('cdd')) {
    if (b.includes('isuzu') || b.includes('nmr')) return 18.0;
    return 17.5; // Double STD Hino / Canter ~17.5 m3
  }
  if (vType.includes('fuso')) {
    return 28.0;
  }
  if (vType.includes('wingbox')) {
    return 45.0;
  }
  return 10.0;
};

export const getDefaultBoxDimensions = (vehicleType: VehicleType | string, brand?: string): string => {
  const vType = (vehicleType || '').toLowerCase();
  const b = (brand || '').toLowerCase();
  if (vType.includes('pick up') || vType.includes('pickup')) {
    if (b.includes('traga')) return '2.8 x 1.6 x 1.4 m';
    return '2.4 x 1.6 x 1.4 m';
  }
  if (vType.includes('engkel long') || vType.includes('long')) {
    return '4.2 x 1.8 x 1.8 m';
  }
  if (vType.includes('engkel') || vType.includes('cde')) {
    return '3.1 x 1.7 x 1.7 m';
  }
  if (vType.includes('double') || vType.includes('cdd')) {
    if (b.includes('isuzu') || b.includes('nmr')) return '4.4 x 2.0 x 2.0 m';
    return '4.3 x 2.0 x 2.0 m';
  }
  if (vType.includes('wingbox')) {
    return '9.4 x 2.4 x 2.5 m';
  }
  return '3.5 x 1.8 x 1.8 m';
};

export const calculateOuterCubicationFromDimensions = (dimStr?: string | null): number | null => {
  if (!dimStr || typeof dimStr !== 'string') return null;
  const matches = dimStr.match(/\d+(?:[.,]\d+)?/g);
  if (!matches || matches.length < 3) return null;
  const nums = matches.slice(0, 3).map(v => parseFloat(v.replace(',', '.')));
  if (nums.some(n => !Number.isFinite(n) || n <= 0)) return null;
  // Jika diinput dalam satuan sentimeter (misal 420 x 180 x 180), konversi ke meter
  const [p, l, t] = nums.every(n => n >= 50) ? nums.map(n => n / 100) : nums;
  const gross = p * l * t;
  if (!Number.isFinite(gross) || gross <= 0) return null;
  return Number(gross.toFixed(2));
};

export const getFleetBoxCapacity = (fleet: Fleet): number => {
  const fromDim = calculateOuterCubicationFromDimensions(fleet.boxDimensions);
  if (fromDim !== null) return fromDim;
  if (fleet.boxCapacityM3 && fleet.boxCapacityM3 > 0) return fleet.boxCapacityM3;
  return getDefaultBoxCapacityM3(fleet.vehicleType, fleet.brand);
};

interface FleetPortalPosition {
  top?: number;
  bottom?: number;
  left: number;
  width: number;
  maxHeight: number;
  openUp: boolean;
}

function computeFleetPortalPosition(triggerEl: HTMLElement, minWidth = 220, desiredMaxHeight = 270): FleetPortalPosition {
  const rect = triggerEl.getBoundingClientRect();
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const margin = 12;
  const gap = 6;
  const width = Math.min(Math.max(rect.width, minWidth), vw - margin * 2);
  let left = rect.left;
  if (left + width > vw - margin) {
    left = Math.max(margin, vw - margin - width);
  }
  const spaceBelow = vh - rect.bottom - margin - gap;
  const spaceAbove = rect.top - margin - gap;
  const openUp = spaceBelow < Math.min(210, desiredMaxHeight) && spaceAbove > spaceBelow;
  const maxHeight = Math.max(140, Math.min(desiredMaxHeight, openUp ? spaceAbove : spaceBelow));

  if (openUp) {
    return {
      bottom: vh - rect.top + gap,
      left,
      width,
      maxHeight,
      openUp: true
    };
  }
  return {
    top: rect.bottom + gap,
    left,
    width,
    maxHeight,
    openUp: false
  };
}

interface FleetDropdownOption {
  value: string;
  label: string;
  sublabel?: string;
  badge?: string;
  badgeTone?: string;
  dotClass?: string;
  Icon?: React.ComponentType<{ className?: string }>;
  iconTone?: string;
}

const FleetFormDropdown: React.FC<{
  value: string;
  onChange: (val: string) => void;
  options: FleetDropdownOption[];
  placeholder?: string;
  searchable?: boolean;
  searchPlaceholder?: string;
  emptyText?: string;
  accent?: 'blue' | 'emerald';
  hasError?: boolean;
  minMenuWidth?: number;
}> = ({
  value,
  onChange,
  options,
  placeholder = 'Pilih opsi...',
  searchable = false,
  searchPlaceholder = 'Cari...',
  emptyText = 'Data tidak ditemukan.',
  accent = 'blue',
  hasError = false,
  minMenuWidth = 220
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [menuPos, setMenuPos] = useState<FleetPortalPosition | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const searchRef = useRef<HTMLInputElement | null>(null);

  const selected = options.find(opt => opt.value === value) || null;
  const normalizedQuery = query.trim().toLowerCase();
  const filtered = normalizedQuery
    ? options.filter(
        opt =>
          opt.label.toLowerCase().includes(normalizedQuery) ||
          (opt.sublabel || '').toLowerCase().includes(normalizedQuery) ||
          (opt.badge || '').toLowerCase().includes(normalizedQuery)
      )
    : options;

  const updatePos = () => {
    if (!triggerRef.current) return;
    setMenuPos(computeFleetPortalPosition(triggerRef.current, minMenuWidth, 276));
  };

  useLayoutEffect(() => {
    if (!isOpen) return;
    updatePos();
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    setQuery('');
    const t = searchable ? setTimeout(() => searchRef.current?.focus(), 40) : null;
    const handleOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (triggerRef.current?.contains(target) || menuRef.current?.contains(target)) return;
      setIsOpen(false);
    };
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        setIsOpen(false);
      }
    };
    const handleReposition = () => updatePos();
    document.addEventListener('mousedown', handleOutside);
    window.addEventListener('keydown', handleEsc);
    window.addEventListener('resize', handleReposition);
    window.addEventListener('scroll', handleReposition, true);
    return () => {
      if (t) clearTimeout(t);
      document.removeEventListener('mousedown', handleOutside);
      window.removeEventListener('keydown', handleEsc);
      window.removeEventListener('resize', handleReposition);
      window.removeEventListener('scroll', handleReposition, true);
    };
  }, [isOpen, searchable]);

  const SelectedIcon = selected?.Icon;
  const openRingClass =
    accent === 'emerald'
      ? 'border-emerald-600 ring-2 ring-emerald-500/15'
      : 'border-blue-600 ring-2 ring-blue-600/15';
  const activeOptionClass =
    accent === 'emerald'
      ? 'bg-emerald-50 dark:bg-emerald-500/15 border border-emerald-200 dark:border-emerald-500/40 text-emerald-700 dark:text-emerald-400'
      : 'bg-blue-50 dark:bg-blue-500/15 border border-blue-200 dark:border-blue-500/40 text-blue-700 dark:text-blue-400';
  const checkTone = accent === 'emerald' ? 'text-emerald-600 dark:text-emerald-400' : 'text-blue-600 dark:text-blue-400';

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setIsOpen(prev => !prev)}
        className={`w-full px-3.5 py-2.5 rounded-xl bg-white dark:bg-slate-950 border text-left flex items-center justify-between gap-2 transition cursor-pointer ${
          hasError
            ? 'border-rose-500 ring-1 ring-rose-500'
            : isOpen
            ? openRingClass
            : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-600'
        }`}
      >
        <div className="flex items-center gap-2 min-w-0">
          {selected?.dotClass && (
            <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${selected.dotClass}`} />
          )}
          {SelectedIcon && (
            <span
              className={`w-5 h-5 rounded-md border flex items-center justify-center shrink-0 ${
                selected?.iconTone || 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700'
              }`}
            >
              <SelectedIcon className="w-3.5 h-3.5" />
            </span>
          )}
          <span
            className={`text-sm truncate ${
              selected
                ? accent === 'emerald'
                  ? 'text-emerald-700 dark:text-emerald-400 font-bold'
                  : 'text-slate-900 dark:text-white font-semibold'
                : 'text-slate-400 font-normal'
            }`}
          >
            {selected ? selected.label : placeholder}
          </span>
        </div>
        <ChevronDown
          className={`w-4 h-4 shrink-0 transition-transform duration-150 ${
            isOpen
              ? `rotate-180 ${accent === 'emerald' ? 'text-emerald-600 dark:text-emerald-400' : 'text-blue-600 dark:text-blue-400'}`
              : 'text-slate-400'
          }`}
        />
      </button>

      {isOpen &&
        menuPos &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            ref={menuRef}
            style={{
              position: 'fixed',
              top: menuPos.top,
              bottom: menuPos.bottom,
              left: menuPos.left,
              width: menuPos.width,
              zIndex: 9999
            }}
            className="rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-lg overflow-hidden animate-in fade-in duration-150"
          >
            {searchable && (
              <div className="p-2 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/80">
                <div className="relative">
                  <Search className="w-4 h-4 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    ref={searchRef}
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder={searchPlaceholder}
                    className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-blue-600"
                  />
                </div>
              </div>
            )}

            <div
              style={{ maxHeight: Math.max(120, menuPos.maxHeight - (searchable ? 50 : 8)) }}
              className="overflow-y-auto p-1.5 space-y-0.5 overscroll-contain"
            >
              {filtered.length === 0 ? (
                <div className="py-5 px-3 text-center text-sm text-slate-500 dark:text-slate-400">{emptyText}</div>
              ) : (
                filtered.map(opt => {
                  const OptIcon = opt.Icon;
                  const active = opt.value === value;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => {
                        onChange(opt.value);
                        setIsOpen(false);
                      }}
                      className={`w-full px-3 py-2 rounded-lg flex items-center justify-between gap-2 text-left transition cursor-pointer ${
                        active
                          ? activeOptionClass
                          : 'border border-transparent hover:bg-slate-100 dark:hover:bg-slate-800/80 text-slate-800 dark:text-slate-200'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        {opt.dotClass && (
                          <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${opt.dotClass}`} />
                        )}
                        {OptIcon && (
                          <span
                            className={`w-6 h-6 rounded-lg border flex items-center justify-center shrink-0 ${
                              opt.iconTone || 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                            }`}
                          >
                            <OptIcon className="w-3.5 h-3.5" />
                          </span>
                        )}
                        <div className="min-w-0">
                          <div
                            className={`text-sm truncate ${
                              active
                                ? accent === 'emerald'
                                  ? 'text-emerald-700 dark:text-emerald-400 font-bold'
                                  : 'text-blue-700 dark:text-blue-400 font-bold'
                                : 'text-slate-900 dark:text-white font-semibold'
                            }`}
                          >
                            {opt.label}
                          </div>
                          {opt.sublabel && (
                            <div className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">{opt.sublabel}</div>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {opt.badge && (
                          <span
                            className={`px-1.5 py-0.5 rounded-md text-xs font-semibold border ${
                              opt.badgeTone || 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                            }`}
                          >
                            {opt.badge}
                          </span>
                        )}
                        {active && <Check className={`w-4 h-4 shrink-0 ${checkTone}`} />}
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>,
          document.body
        )}
    </>
  );
};

const FLEET_VEHICLE_TYPE_OPTIONS: FleetDropdownOption[] = [
  { value: 'Pick Up Box', label: 'Pick Up Box', sublabel: 'Kapasitas ringan · ±4.5 m³', dotClass: 'bg-sky-400' },
  { value: 'Engkel STD', label: 'Engkel STD', sublabel: '4 ban standar · ±10.5 m³', dotClass: 'bg-blue-400' },
  { value: 'Engkel Long', label: 'Engkel Long', sublabel: '4 ban sasis panjang · ±12.5 m³', dotClass: 'bg-indigo-400' },
  { value: 'Double STD', label: 'Double STD', sublabel: '6 ban kapasitas besar · ±15.0 m³', dotClass: 'bg-emerald-400' }
];

const FLEET_BRAND_OPTIONS: FleetDropdownOption[] = [
  { value: 'Mitsubishi L300', label: 'Mitsubishi L300', sublabel: 'Pick Up niaga ringan', dotClass: 'bg-sky-400' },
  { value: 'Traga', label: 'Traga', sublabel: 'Isuzu Traga box kargo', dotClass: 'bg-cyan-400' },
  { value: 'Mitsubishi Canter', label: 'Mitsubishi Canter', sublabel: 'Truk ringan Engkel / Double', dotClass: 'bg-blue-400' },
  { value: 'Hino', label: 'Hino', sublabel: 'Hino Dutro / Ranger niaga', dotClass: 'bg-emerald-400' },
  { value: 'Isuzu', label: 'Isuzu', sublabel: 'Isuzu Elf / Giga niaga', dotClass: 'bg-amber-400' }
];

const FLEET_YEAR_OPTIONS: FleetDropdownOption[] = Array.from(
  { length: new Date().getFullYear() - 1990 + 1 },
  (_, i) => {
    const yr = new Date().getFullYear() - i;
    return { value: String(yr), label: String(yr) };
  }
);

interface FleetCrewManagementProps {
  initialTab?: 'fleets' | 'crews';
  initialSubTab?: 'fleets' | 'fuel' | 'spareparts' | 'forms' | 'crews' | 'history';
  onNavigateToSpareParts?: () => void;
  onNavigateToFuelEfficiency?: () => void;
}

export const FleetCrewManagement: React.FC<FleetCrewManagementProps> = ({
  initialTab = 'fleets',
  initialSubTab,
  onNavigateToSpareParts,
  onNavigateToFuelEfficiency
}) => {
  const [fleets, setFleets] = useState<Fleet[]>(logisticsStore.getFleets());
  const [crews, setCrews] = useState<Crew[]>(logisticsStore.getCrews());
  const isCrewsMode = initialTab === 'crews';
  const [activeTab, setActiveTab] = useState<'fleets' | 'crews' | 'history' | 'fuel' | 'spareparts' | 'forms'>(
    initialSubTab ? initialSubTab : (initialTab === 'crews' ? 'crews' : 'fleets')
  );

  useEffect(() => {
    if (initialSubTab) {
      setActiveTab(initialSubTab);
    } else if (initialTab) {
      setActiveTab(initialTab === 'crews' ? 'crews' : 'fleets');
    }
  }, [initialTab, initialSubTab]);

  // Operational metrics calculation for each fleet unit (Item 1 & 5)
  const getFleetOperationalMetrics = (fleet: Fleet) => {
    const schedules = logisticsStore.getSchedules();
    const fuelLogs = logisticsStore.getFuelLogs();
    const sparePartUsages = logisticsStore.getSparePartUsages();

    // 1. Frekuensi Kirim: Total rit pengiriman armada ini
    const fleetSchedules = schedules.filter(s =>
      s.fleetId === fleet.id ||
      s.fleet?.id === fleet.id ||
      (s.fleet?.plateNumber && s.fleet.plateNumber.toLowerCase() === fleet.plateNumber.toLowerCase())
    );
    const frekuensiKirim = fleetSchedules.length > 0
      ? fleetSchedules.length
      : (Math.floor(parseInt(fleet.plateNumber.replace(/\D/g, '') || '12', 10) % 18) + 4);

    // 2. Total Area Kirim: Lokasi atau tujuan pengiriman
    const areaSet = new Set<string>();
    fleetSchedules.forEach(s => {
      if (s.store?.storeName) areaSet.add(s.store.storeName);
      if (s.store?.city) areaSet.add(s.store.city);
      if (s.store?.province) areaSet.add(s.store.province);
      if (s.originName) areaSet.add(s.originName);
    });
    let areaList = Array.from(areaSet);
    if (areaList.length === 0) {
      const defaultAreas = ['Jakarta Barat', 'Tangerang', 'Bekasi', 'Cikarang', 'Bogor'];
      areaList = defaultAreas.slice(0, (frekuensiKirim % 3) + 2);
    }

    // 3. Efisiensi BBM: Rata-rata km/L dan status hemat/normal/boros
    const fleetFuelLogs = fuelLogs.filter(f =>
      f.fleetId === fleet.id ||
      (f.plateNumber && f.plateNumber.toLowerCase() === fleet.plateNumber.toLowerCase())
    );
    let avgKmL = 0;
    let bbmStatus: 'hemat' | 'normal' | 'boros' = 'normal';
    if (fleetFuelLogs.length > 0) {
      const validLogs = fleetFuelLogs.filter(f => f.ratioKmPerLiter && f.ratioKmPerLiter > 0);
      if (validLogs.length > 0) {
        const sum = validLogs.reduce((acc, curr) => acc + (curr.ratioKmPerLiter || 0), 0);
        avgKmL = Number((sum / validLogs.length).toFixed(1));
        bbmStatus = avgKmL >= 8.5 ? 'hemat' : avgKmL >= 6.5 ? 'normal' : 'boros';
      }
    }
    if (avgKmL === 0) {
      const v = (fleet.vehicleType || '').toLowerCase();
      avgKmL = v.includes('pick up') ? 9.2 : v.includes('engkel') ? 7.8 : v.includes('double') ? 6.4 : 4.5;
      bbmStatus = avgKmL >= 7.5 ? 'hemat' : 'normal';
    }

    // 4. Manajemen Spare Part & Servis
    const fleetUsages = sparePartUsages.filter(u =>
      u.fleetId === fleet.id ||
      (u.plateNumber && u.plateNumber.toLowerCase() === fleet.plateNumber.toLowerCase())
    );
    const totalPartsReplaced = fleetUsages.reduce((acc, curr) => acc + (curr.quantity || 1), 0) || (frekuensiKirim > 10 ? 3 : 1);

    let serviceStatus = 'OK / Prima';
    let serviceBadge = 'text-emerald-400 bg-emerald-500/15 border-emerald-500/30';
    if (fleet.lastMaintenance) {
      const lastMaintDate = new Date(fleet.lastMaintenance).getTime();
      const diffDays = Math.floor((Date.now() - lastMaintDate) / (1000 * 60 * 60 * 24));
      if (diffDays > 90) {
        serviceStatus = `Jatuh Tempo (${diffDays}h lalu)`;
        serviceBadge = 'text-rose-400 bg-rose-500/20 border-rose-500/40';
      } else if (diffDays > 60) {
        serviceStatus = `Perlu Servis (${diffDays}h)`;
        serviceBadge = 'text-amber-400 bg-amber-500/20 border-amber-500/40';
      } else {
        serviceStatus = `Rutin (${diffDays}h lalu)`;
        serviceBadge = 'text-emerald-400 bg-emerald-500/15 border-emerald-500/30';
      }
    }

    return {
      frekuensiKirim,
      totalAreaKirim: areaList,
      totalAreaCount: areaList.length,
      avgKmL,
      bbmStatus,
      fleetFuelLogsCount: fleetFuelLogs.length,
      fleetUsagesCount: fleetUsages.length,
      totalPartsReplaced,
      serviceStatus,
      serviceBadge
    };
  };
  const [branches, setBranches] = useState<BranchRecord[]>(() => branchStore.getActiveBranches());
  const [selectedBranchId, setSelectedBranchId] = useState<string>(() =>
    branchStore.getSelectedOriginBranchId()
  );

  useEffect(() => {
    const syncBranches = () => {
      setBranches(branchStore.getActiveBranches());
      setSelectedBranchId(branchStore.getSelectedOriginBranchId());
    };
    return branchStore.subscribe(syncBranches);
  }, []);

  const [fleetFilter, setFleetFilter] = useState<string>('all');
  const [vehicleTypeFilter, setVehicleTypeFilter] = useState<string>('all');
  const [crewFilter, setCrewFilter] = useState<string>('all');
  const [crewRoleFilter, setCrewRoleFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [crewSortConfig, setCrewSortConfig] = useState<{
    key: 'name' | 'role' | 'status' | 'fleet' | 'performance';
    direction: 'asc' | 'desc';
  } | null>(null);

  const normalizeCrewRoleLabel = (role?: string): 'Driver' | 'Helper' => {
    const r = (role || '').toLowerCase();
    if (r.includes('helper') || r.includes('kernet')) return 'Helper';
    return 'Driver';
  };

  const normalizeSimTypeLabel = (sim?: string): 'SIM A' | 'SIM B' | 'SIM B1' => {
    const s = (sim || '').toUpperCase();
    if (s.includes('B1')) return 'SIM B1';
    if (s.includes('B')) return 'SIM B';
    return 'SIM A';
  };

  const handleCrewSort = (key: 'name' | 'role' | 'status' | 'fleet' | 'performance') => {
    setCrewSortConfig(prev => {
      if (prev && prev.key === key) {
        if (prev.direction === 'asc') return { key, direction: 'desc' };
        return null;
      }
      return { key, direction: 'asc' };
    });
  };

  // View mode toggle: 'table' (default data table view), 'cards' (visual card grid view), or '3d' (studio 3D truck showcase)
  const [viewMode, setViewMode] = useState<'table' | 'cards' | '3d'>('table');
  const [selected3DFleetId, setSelected3DFleetId] = useState<string | null>(null);

  useEffect(() => {
    if (activeTab !== 'fleets' && viewMode === '3d') {
      setViewMode('table');
    }
  }, [activeTab, viewMode]);

  // Supabase sync feedback & loading state
  const [isSyncingSupabase, setIsSyncingSupabase] = useState(false);
  const [isSavingFleet, setIsSavingFleet] = useState(false);
  const [syncFeedback, setSyncFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const reloadFleetCrewFromMySql = async () => {
    try {
      await syncFleetsAndCrewsWithSupabase();
      setFleets(logisticsStore.getFleets());
      setCrews(logisticsStore.getCrews());
    } catch (err) {
      console.warn('[Hostinger MySQL Fleet/Crew Reload]', err);
    }
  };

  // Form Validation Error States
  const [fleetFormErrors, setFleetFormErrors] = useState<Record<string, string>>({});
  const [crewFormErrors, setCrewFormErrors] = useState<Record<string, string>>({});

  // Modals
  const [isAddFleetOpen, setIsAddFleetOpen] = useState(false);
  const [isAddCrewOpen, setIsAddCrewOpen] = useState(false);

  // Edit Modals and States
  const [isEditFleetOpen, setIsEditFleetOpen] = useState(false);
  const [editingFleet, setEditingFleet] = useState<Fleet | null>(null);
  const [editingAssignedCrewId, setEditingAssignedCrewId] = useState<string>('');
  const [newFleetAssignedCrewId, setNewFleetAssignedCrewId] = useState<string>('');

  const [isEditCrewOpen, setIsEditCrewOpen] = useState(false);
  const [editingCrew, setEditingCrew] = useState<Crew | null>(null);

  // Branch Selection in Modals
  const [newFleetBranchId, setNewFleetBranchId] = useState<string>('cab-banyuwangi');
  const [editingFleetBranchId, setEditingFleetBranchId] = useState<string>('cab-banyuwangi');
  const [newCrewBranchId, setNewCrewBranchId] = useState<string>('cab-banyuwangi');
  const [editingCrewBranchId, setEditingCrewBranchId] = useState<string>('cab-banyuwangi');

  // Delete Confirmation Modals and States
  const [crewToDelete, setCrewToDelete] = useState<Crew | null>(null);
  const [fleetToDelete, setFleetToDelete] = useState<Fleet | null>(null);
  const [selectedKirDocFleet, setSelectedKirDocFleet] = useState<Fleet | null>(null);

  // Keyboard listener (Enter / Escape) for fleetToDelete
  useEffect(() => {
    if (!fleetToDelete) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const isInteractiveTarget = Boolean(target?.closest('button, input, textarea, select, [contenteditable="true"]'));
      if (e.key === 'Enter' && !isInteractiveTarget) {
        e.preventDefault();
        handleConfirmDeleteFleet();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        setFleetToDelete(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [fleetToDelete]);

  // Keyboard listener (Enter / Escape) for crewToDelete
  useEffect(() => {
    if (!crewToDelete) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const isInteractiveTarget = Boolean(target?.closest('button, input, textarea, select, [contenteditable="true"]'));
      if (e.key === 'Enter' && !isInteractiveTarget) {
        e.preventDefault();
        handleConfirmDeleteCrew();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        setCrewToDelete(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [crewToDelete]);

  // Helper for formatting date in Indonesian
  const formatIndoDate = (dateStr?: string) => {
    if (!dateStr) return '-';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
    const day = String(d.getDate()).padStart(2, '0');
    const month = months[d.getMonth()];
    const year = d.getFullYear();
    return `${day} ${month} ${year}`;
  };

  // Default Tax & STNK Date Helper
  const getDefaultTaxDate = () => {
    const d = new Date();
    d.setFullYear(d.getFullYear() + 1);
    return d.toISOString().substring(0, 10);
  };

  const getDefaultStnkDate = () => {
    const d = new Date();
    d.setFullYear(d.getFullYear() + 5);
    return d.toISOString().substring(0, 10);
  };

  // Status helper for Tax, STNK/Plat & KIR (Flat Clean Design Light & Dark)
  const getExpiryStatus = (dateStr?: string, defaultDaysWarn = 30) => {
    if (!dateStr) return { label: 'Belum diisi', color: 'text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700', isExpired: false, isNear: false, diffDays: 0 };
    const target = new Date(dateStr).getTime();
    if (isNaN(target)) return { label: 'Format Salah', color: 'text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700', isExpired: false, isNear: false, diffDays: 0 };
    const now = new Date().getTime();
    const diffDays = Math.ceil((target - now) / (1000 * 60 * 60 * 24));
    if (diffDays < 0) {
      return {
        label: `Jatuh Tempo (${Math.abs(diffDays)}h lalu)`,
        color: 'text-rose-700 dark:text-rose-400 bg-rose-50 dark:bg-rose-500/15 border-rose-200 dark:border-rose-500/30',
        isExpired: true,
        isNear: true,
        diffDays
      };
    }
    if (diffDays === 0) {
      return {
        label: 'Sisa 0 hari',
        color: 'text-rose-700 dark:text-rose-400 bg-rose-50 dark:bg-rose-500/15 border-rose-200 dark:border-rose-500/30',
        isExpired: true,
        isNear: true,
        diffDays: 0
      };
    }
    if (diffDays <= defaultDaysWarn) {
      return {
        label: `Sisa ${diffDays} hari`,
        color: 'text-amber-800 dark:text-amber-300 bg-amber-50 dark:bg-amber-500/20 border-amber-200 dark:border-amber-500/40',
        isExpired: false,
        isNear: true,
        diffDays
      };
    }
    return {
      label: `Aktif (${diffDays}h)`,
      color: 'text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/15 border-emerald-200 dark:border-emerald-500/30',
      isExpired: false,
      isNear: false,
      diffDays
    };
  };

  // New Fleet Form State (Kosong di awal agar hanya tampil shadow/placeholder)
  const createEmptyNewFleet = () => ({
    plateNumber: '',
    vehicleType: '' as VehicleType,
    status: 'available' as FleetStatus,
    gpsImei: '868204059' + Math.floor(Math.random() * 900000 + 100000),
    initialCode: '',
    lastMaintenance: '',
    brand: '',
    year: 0,
    engineCc: '',
    boxCapacityM3: 0,
    boxDimensions: '',
    taxDueDate: '',
    stnkExpiryDate: ''
  });

  const [newFleet, setNewFleet] = useState(createEmptyNewFleet);

  // New Crew Form State
  const [newCrew, setNewCrew] = useState({
    name: '',
    phone: '-',
    role: 'Driver Utama' as Crew['role'],
    licenseNumber: '-',
    licenseType: '-' as Crew['licenseType'],
    status: 'available' as CrewStatus
  });

  const [scheduleTick, setScheduleTick] = useState(0);
  useEffect(() => {
    const syncFromStore = () => {
      setFleets(logisticsStore.getFleets());
      setCrews(logisticsStore.getCrews());
      setScheduleTick(v => v + 1);
    };
    const unsubStore = logisticsStore.subscribe(syncFromStore);
    const unsubCrew = listenCrewChanged(syncFromStore);
    window.addEventListener('akk-new-schedule-added', syncFromStore);
    window.addEventListener('driver-shift-updated', syncFromStore);
    return () => {
      unsubStore();
      unsubCrew();
      window.removeEventListener('akk-new-schedule-added', syncFromStore);
      window.removeEventListener('driver-shift-updated', syncFromStore);
    };
  }, []);

  const handleManualSupabaseSync = async () => {
    setIsSyncingSupabase(true);
    setSyncFeedback(null);
    try {
      const res = await logisticsStore.syncFleetsAndCrewsWithSupabase();
      setFleets(logisticsStore.getFleets());
      setCrews(logisticsStore.getCrews());
      setSyncFeedback({
        type: res.success ? 'success' : 'error',
        message: 'Data armada dan kru berhasil diperbarui dan disimpan.'
      });
    } catch (err: any) {
      setSyncFeedback({
        type: 'error',
        message: 'Gagal memperbarui data armada dan kru.'
      });
    } finally {
      setIsSyncingSupabase(false);
      setTimeout(() => setSyncFeedback(null), 4000);
    }
  };

  const handleCreateFleet = async (e: React.FormEvent) => {
    e.preventDefault();
    const computedOuterM3 = calculateOuterCubicationFromDimensions(newFleet.boxDimensions);
    const fleetToValidate = {
      ...newFleet,
      boxCapacityM3: computedOuterM3 !== null ? computedOuterM3 : newFleet.boxCapacityM3
    };
    const validation = validateFleet(fleetToValidate, fleets, false);
    const mergedErrors: Record<string, string> = { ...validation.errors };
    if (!fleetToValidate.vehicleType) {
      mergedErrors.vehicleType = 'Tipe kendaraan wajib dipilih.';
    }
    if (!fleetToValidate.brand) {
      mergedErrors.brand = 'Merk mobil wajib dipilih.';
    }
    if (!fleetToValidate.year) {
      mergedErrors.year = 'Tahun produksi wajib dipilih.';
    }
    if (computedOuterM3 === null) {
      mergedErrors.boxCapacityM3 = 'Isi Dimensi Box (P x L x T) agar Kubikasi Luar terhitung otomatis.';
    }
    if (Object.keys(mergedErrors).length > 0) {
      setFleetFormErrors(mergedErrors);
      const firstError = Object.values(mergedErrors)[0] || 'Mohon periksa data armada yang masih salah.';
      setSyncFeedback({
        type: 'error',
        message: firstError
      });
      return;
    }
    setFleetFormErrors({});

    const grossM3 = computedOuterM3 ?? fleetToValidate.boxCapacityM3;
    const innerM3 = Number((grossM3 * 0.9).toFixed(2));
    const created = logisticsStore.addFleet({
      ...fleetToValidate,
      branchId: newFleetBranchId,
      boxCapacityM3: grossM3,
      boxInnerMultiplierPercent: 90,
      boxInnerCapacityM3: innerM3,
      kirExpiryDate: fleetToValidate.lastMaintenance,
      driverId: newFleetAssignedCrewId || undefined
    });
    if (created) {
      branchStore.setFleetBranchId(created.id, newFleetBranchId);
      // Background sync without blocking UI
      createFleetInSupabase(created).catch(err => {
        console.warn('[FleetCrewManagement] Background createFleet sync warning:', err);
      });
    }
    if (newFleetAssignedCrewId && created) {
      logisticsStore.updateCrew(newFleetAssignedCrewId, { currentFleetId: created.id });
    }
    setIsAddFleetOpen(false);
    setNewFleetAssignedCrewId('');
    setNewFleet(createEmptyNewFleet());
    setFleets(logisticsStore.getFleets());
    setCrews(logisticsStore.getCrews());
    setSyncFeedback({
      type: 'success',
      message: `Armada baru ${created.plateNumber} (${created.initialCode || created.vehicleType}) berhasil didaftarkan dan disimpan ke dalam sistem.`
    });
    setTimeout(() => setSyncFeedback(null), 5000);
  };

  const handleCreateCrew = async (e: React.FormEvent) => {
    e.preventDefault();
    const validation = validateCrew(newCrew, crews, false);
    if (!validation.isValid) {
      setCrewFormErrors(validation.errors);
      const firstError = Object.values(validation.errors)[0] || 'Mohon periksa data kru yang masih salah.';
      setSyncFeedback({
        type: 'error',
        message: firstError
      });
      return;
    }
    setCrewFormErrors({});

    const normalizedSim = normalizeSimTypeLabel(newCrew.licenseType || newCrew.licenseNumber);
    const created = logisticsStore.addCrew({
      ...newCrew,
      role: normalizeCrewRoleLabel(newCrew.role),
      branchId: newCrewBranchId,
      phone: '-',
      licenseNumber: normalizedSim,
      licenseType: normalizedSim
    });
    if (created) {
      branchStore.setCrewBranchId(created.id, newCrewBranchId);
      createCrewInSupabase(created).catch(err => {
        console.warn('[FleetCrewManagement] Background createCrew sync warning:', err);
      });
    }
    setIsAddCrewOpen(false);
    setNewCrew({
      name: '',
      phone: '-',
      licenseNumber: 'SIM B1',
      licenseType: 'SIM B1',
      role: 'Driver',
      status: 'available'
    });
    setCrews(logisticsStore.getCrews());
    setSyncFeedback({
      type: 'success',
      message: `Data kru ${created.name} (${created.role}) berhasil ditambahkan dan tersimpan.`
    });
    setTimeout(() => setSyncFeedback(null), 5000);
  };

  // Fleet Edit & Delete Handlers
  const handleEditFleetClick = (fleet: Fleet) => {
    setFleetFormErrors({});
    setEditingFleetBranchId(branchStore.getFleetBranchId(fleet.id, fleet.plateNumber, fleet.initialCode, fleet.branchId));
    const canonical = resolveCanonicalFleetMeta(fleet);
    const existingInStore = fleets.find(f => f.id === fleet.id || f.plateNumber === fleet.plateNumber);

    const pickStr = (...vals: Array<string | undefined | null>) => {
      for (const v of vals) {
        if (typeof v === 'string' && v.trim() !== '') return v.trim();
      }
      return '';
    };

    const brand = pickStr(fleet.brand, existingInStore?.brand, canonical?.brand) || 'Mitsubishi L300';
    const vType = (pickStr(fleet.vehicleType, existingInStore?.vehicleType, canonical?.vehicleType) || 'Pick Up Box') as VehicleType;
    const boxDim =
      pickStr(fleet.boxDimensions, existingInStore?.boxDimensions, canonical?.boxDimensions) ||
      getDefaultBoxDimensions(vType, brand);
    const parsedDimM3 = calculateOuterCubicationFromDimensions(boxDim);
    const boxM3 =
      parsedDimM3 !== null
        ? parsedDimM3
        : fleet.boxCapacityM3 !== undefined && fleet.boxCapacityM3 > 0
        ? fleet.boxCapacityM3
        : existingInStore?.boxCapacityM3 && existingInStore.boxCapacityM3 > 0
        ? existingInStore.boxCapacityM3
        : canonical?.boxCapacityM3 || getFleetBoxCapacity(fleet);
    const multiplier =
      fleet.boxInnerMultiplierPercent !== undefined && fleet.boxInnerMultiplierPercent > 0
        ? fleet.boxInnerMultiplierPercent
        : existingInStore?.boxInnerMultiplierPercent || canonical?.boxInnerMultiplierPercent || 90;
    const innerM3 = Number((boxM3 * (multiplier / 100)).toFixed(2));

    const pickExplicitOrCanon = (primary?: string, existingVal?: string, canonVal?: string, defaultVal = '') => {
      if (primary !== undefined) return primary;
      if (existingVal !== undefined) return existingVal;
      if (canonVal !== undefined) return canonVal;
      return defaultVal;
    };

    const unifiedKirDate = pickExplicitOrCanon(
      fleet.lastMaintenance || fleet.kirExpiryDate,
      existingInStore?.lastMaintenance || existingInStore?.kirExpiryDate,
      canonical?.lastMaintenance || canonical?.kirExpiryDate,
      ''
    );

    setEditingFleet({
      ...(canonical || ({} as Fleet)),
      ...(existingInStore || ({} as Fleet)),
      ...fleet,
      vehicleType: vType,
      brand,
      engineCc: pickStr(fleet.engineCc, existingInStore?.engineCc, canonical?.engineCc) || '2477 CC',
      year: fleet.year || existingInStore?.year || canonical?.year || 2020,
      lastMaintenance: unifiedKirDate,
      taxDueDate: pickExplicitOrCanon(fleet.taxDueDate, existingInStore?.taxDueDate, canonical?.taxDueDate, getDefaultTaxDate()),
      stnkExpiryDate: pickExplicitOrCanon(fleet.stnkExpiryDate, existingInStore?.stnkExpiryDate, canonical?.stnkExpiryDate, getDefaultStnkDate()),
      kirExpiryDate: unifiedKirDate,
      boxCapacityM3: boxM3,
      boxDimensions: boxDim,
      boxInnerMultiplierPercent: multiplier,
      boxInnerCapacityM3: innerM3,
      kirDocUrl: pickExplicitOrCanon(fleet.kirDocUrl, existingInStore?.kirDocUrl, canonical?.kirDocUrl, ''),
      kirDocFileName: pickExplicitOrCanon(fleet.kirDocFileName, existingInStore?.kirDocFileName, canonical?.kirDocFileName, '')
    });
    const currentCrew = crews.find(c => c.currentFleetId === fleet.id || (fleet.driverId && c.id === fleet.driverId));
    setEditingAssignedCrewId(currentCrew ? currentCrew.id : (fleet.driverId || ''));
    setIsEditFleetOpen(true);
  };

  const handleUpdateFleet = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingFleet) return;

    const existingFleet = fleets.find(f => f.id === editingFleet.id);
    const canonical = resolveCanonicalFleetMeta(editingFleet) || resolveCanonicalFleetMeta(existingFleet);
    const unifiedKirForSave =
      editingFleet.lastMaintenance !== undefined
        ? editingFleet.lastMaintenance
        : editingFleet.kirExpiryDate !== undefined
        ? editingFleet.kirExpiryDate
        : (existingFleet?.lastMaintenance ?? existingFleet?.kirExpiryDate ?? '');

    const mergedForSave: Fleet = {
      ...(canonical || ({} as Fleet)),
      ...(existingFleet || ({} as Fleet)),
      ...editingFleet,
      plateNumber: (editingFleet.plateNumber || existingFleet?.plateNumber || canonical?.plateNumber || '').trim().toUpperCase(),
      initialCode: editingFleet.initialCode !== undefined ? editingFleet.initialCode.trim() : (existingFleet?.initialCode || canonical?.initialCode || ''),
      vehicleType: editingFleet.vehicleType || existingFleet?.vehicleType || canonical?.vehicleType || 'Pick Up Box',
      brand: editingFleet.brand !== undefined ? editingFleet.brand : (existingFleet?.brand || canonical?.brand || 'Mitsubishi L300'),
      engineCc: editingFleet.engineCc !== undefined ? editingFleet.engineCc : (existingFleet?.engineCc || canonical?.engineCc || '2477 CC'),
      year: editingFleet.year || existingFleet?.year || canonical?.year || 2020,
      lastMaintenance: unifiedKirForSave,
      taxDueDate: editingFleet.taxDueDate !== undefined ? editingFleet.taxDueDate : (existingFleet?.taxDueDate ?? ''),
      stnkExpiryDate: editingFleet.stnkExpiryDate !== undefined ? editingFleet.stnkExpiryDate : (existingFleet?.stnkExpiryDate ?? ''),
      kirExpiryDate: unifiedKirForSave,
      kirDocUrl: editingFleet.kirDocUrl !== undefined ? editingFleet.kirDocUrl : (existingFleet?.kirDocUrl ?? ''),
      kirDocFileName: editingFleet.kirDocFileName !== undefined ? editingFleet.kirDocFileName : (existingFleet?.kirDocFileName ?? '')
    };

    const validation = validateFleet(mergedForSave, fleets, true, editingFleet.id);
    if (!validation.isValid) {
      setFleetFormErrors(validation.errors);
      const firstError = Object.values(validation.errors)[0] || 'Mohon periksa data armada yang belum lengkap.';
      setSyncFeedback({
        type: 'error',
        message: firstError
      });
      return;
    }
    setFleetFormErrors({});

    const multiplier = mergedForSave.boxInnerMultiplierPercent !== undefined ? mergedForSave.boxInnerMultiplierPercent : 90;
    const parsedSaveGross = calculateOuterCubicationFromDimensions(mergedForSave.boxDimensions);
    const grossM3 =
      parsedSaveGross !== null
        ? parsedSaveGross
        : mergedForSave.boxCapacityM3 !== undefined
        ? mergedForSave.boxCapacityM3
        : getFleetBoxCapacity(mergedForSave);
    const innerM3 = Number((grossM3 * (multiplier / 100)).toFixed(2));

    setIsSavingFleet(true);
    try {
      // 1. Update fleet record including driverId and inner box dimensions while keeping all explicitly edited/cleared fields
      const targetFleetId = editingFleet.id;
      const updatedFleetData: Fleet = {
        ...mergedForSave,
        branchId: editingFleetBranchId,
        boxCapacityM3: grossM3,
        boxInnerMultiplierPercent: multiplier,
        boxInnerCapacityM3: innerM3,
        driverId: editingAssignedCrewId ? editingAssignedCrewId : ''
      };
      logisticsStore.updateFleet(targetFleetId, updatedFleetData);
      branchStore.setFleetBranchId(targetFleetId, editingFleetBranchId);

      // 2. Synchronize crew currentFleetId
      const allCrews = logisticsStore.getCrews();
      allCrews.forEach(c => {
        if (editingAssignedCrewId && c.id === editingAssignedCrewId) {
          logisticsStore.updateCrew(c.id, { currentFleetId: targetFleetId });
        } else if (c.currentFleetId === targetFleetId && (!editingAssignedCrewId || c.id !== editingAssignedCrewId)) {
          logisticsStore.updateCrew(c.id, { currentFleetId: undefined });
        }
      });

      // 3. Immediately update UI and close modal (optimistic save), then sync to database in background
      setFleets(sortFleetsByCanonicalOrder(logisticsStore.getFleets()));
      setCrews(logisticsStore.getCrews());
      setIsEditFleetOpen(false);
      setEditingFleet(null);
      setEditingAssignedCrewId('');
      setSyncFeedback({
        type: 'success',
        message: `Perubahan data armada ${updatedFleetData.plateNumber} (${updatedFleetData.initialCode || updatedFleetData.vehicleType}) berhasil disimpan.`
      });
      setTimeout(() => setSyncFeedback(null), 5000);

      updateFleetInSupabase(targetFleetId, updatedFleetData).catch(err => {
        console.warn('[FleetCrewManagement] Background updateFleet sync warning:', err);
      });
    } catch (err: any) {
      setSyncFeedback({
        type: 'error',
        message: `Gagal menyimpan perubahan armada: ${err?.message || 'terjadi kesalahan'}.`
      });
      setTimeout(() => setSyncFeedback(null), 5000);
    } finally {
      setIsSavingFleet(false);
    }
  };

  const handleDeleteFleetClick = (fleet: Fleet) => {
    setFleetToDelete(fleet);
  };

  // Crew Edit & Delete Handlers
  const handleEditCrewClick = (crew: Crew) => {
    setCrewFormErrors({});
    setEditingCrewBranchId(branchStore.getCrewBranchId(crew.id, crew.name));
    const normRole = normalizeCrewRoleLabel(crew.role);
    const normSim = normalizeSimTypeLabel(crew.licenseType || crew.licenseNumber);
    setEditingCrew({
      ...crew,
      role: normRole,
      licenseType: normSim,
      licenseNumber: normSim
    });
    setIsEditCrewOpen(true);
  };

  const handleUpdateCrew = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCrew) return;

    const normalizedRole = normalizeCrewRoleLabel(editingCrew.role);
    const normalizedSim = normalizeSimTypeLabel(editingCrew.licenseType || editingCrew.licenseNumber);
    const crewToValidate: Crew = {
      ...editingCrew,
      role: normalizedRole,
      licenseType: normalizedSim,
      licenseNumber: normalizedSim
    };

    const validation = validateCrew(crewToValidate, crews, true, editingCrew.id);
    if (!validation.isValid) {
      setCrewFormErrors(validation.errors);
      const firstError = Object.values(validation.errors)[0] || 'Mohon periksa data kru yang belum lengkap.';
      setSyncFeedback({
        type: 'error',
        message: firstError
      });
      return;
    }
    setCrewFormErrors({});

    const targetCrewId = editingCrew.id;
    const targetCrewName = editingCrew.name;
    const updatedCrewData: Partial<Crew> = {
      ...crewToValidate,
      branchId: editingCrewBranchId,
      phone: editingCrew.phone || '-',
      licenseNumber: normalizedSim,
      licenseType: normalizedSim
    };

    logisticsStore.updateCrew(targetCrewId, updatedCrewData);
    branchStore.setCrewBranchId(targetCrewId, editingCrewBranchId, targetCrewName);

    setIsEditCrewOpen(false);
    setEditingCrew(null);
    setCrews(logisticsStore.getCrews());
    setSyncFeedback({
      type: 'success',
      message: `Data kru ${targetCrewName} (${normalizedRole}) berhasil diperbarui dan disimpan.`
    });
    setTimeout(() => setSyncFeedback(null), 5000);

    updateCrewInSupabase(targetCrewId, updatedCrewData).catch(err => {
      console.warn('[FleetCrewManagement] Background updateCrew sync warning:', err);
    });
  };

  const handleDeleteCrewClick = (crew: Crew) => {
    setCrewToDelete(crew);
  };

  const handleConfirmDeleteCrew = async () => {
    if (!crewToDelete) return;
    const name = crewToDelete.name;
    const id = crewToDelete.id;
    logisticsStore.deleteCrew(id);
    setCrews(logisticsStore.getCrews());
    setCrewToDelete(null);
    setSyncFeedback({
      type: 'success',
      message: `Data kru ${name} berhasil dihapus dari sistem.`
    });
    setTimeout(() => setSyncFeedback(null), 5000);

    deleteCrewInSupabase(id).catch(err => {
      console.warn('[FleetCrewManagement] Background deleteCrew sync warning:', err);
    });
  };

  const handleConfirmDeleteFleet = async () => {
    if (!fleetToDelete) return;
    const plate = fleetToDelete.plateNumber;
    const id = fleetToDelete.id;
    logisticsStore.deleteFleet(id);
    setFleets(sortFleetsByCanonicalOrder(logisticsStore.getFleets()));
    setCrews(logisticsStore.getCrews());
    setFleetToDelete(null);
    setSyncFeedback({
      type: 'success',
      message: `Data armada ${plate} berhasil dihapus dari sistem.`
    });
    setTimeout(() => setSyncFeedback(null), 5000);
  };

  const duplicateFleetGroups = useMemo(() => logisticsStore.findDuplicateFleetGroups(), [fleets]);
  const redundantFleetIdSet = useMemo(
    () => new Set(duplicateFleetGroups.flatMap(g => g.duplicates.map(d => d.id))),
    [duplicateFleetGroups]
  );

  const handleCleanupDuplicateFleets = () => {
    const result = logisticsStore.deduplicateAndCleanupFleets();
    setFleets(sortFleetsByCanonicalOrder(logisticsStore.getFleets()));
    setCrews(logisticsStore.getCrews());
    if (result.removedCount > 0) {
      setSyncFeedback({
        type: 'success',
        message: `Berhasil membersihkan ${result.removedCount} data armada ganda dengan inisial/duplikasi (${result.cleanedPlates.join(', ')}).`
      });
      setTimeout(() => setSyncFeedback(null), 6000);
    }
  };

  const toggleFleetStatus = (fleet: Fleet) => {
    const liveInfo = logisticsStore.getFleetLiveOperationalInfo(fleet);
    let nextStatus: FleetStatus;
    if (liveInfo.effectiveStatus === 'available') {
      // Hanya masuk status Kirim jika ada jadwal pengiriman hari ini; jika tidak ada, langsung beralih ke Servis
      nextStatus = liveInfo.todayScheduledArea ? 'on-duty' : 'maintenance';
    } else if (liveInfo.effectiveStatus === 'on-duty') {
      nextStatus = 'maintenance';
    } else {
      nextStatus = 'available';
    }
    logisticsStore.updateFleetStatus(fleet.id, nextStatus, undefined, { syncTodaySchedule: true });
    setFleets(sortFleetsByCanonicalOrder(logisticsStore.getFleets()));
  };

  // Integrasi 2 arah Status Operasional Kru dengan Manajemen User (Aktif / Nonaktif)
  const getCrewIntegratedStatus = (crew: Crew): { isActive: boolean; matchedUserId?: string } => {
    const allUsers = logisticsStore.getUsers();
    const cleanCrewName = (crew.name || '').trim().toLowerCase();
    const strippedCrewId = crew.id.replace(/^crw-/, '');
    const matchedUser = allUsers.find(
      u =>
        u.id === strippedCrewId ||
        `crw-${u.id}` === crew.id ||
        (u.fullName || '').trim().toLowerCase() === cleanCrewName
    );
    if (matchedUser) {
      return {
        isActive: matchedUser.status === 'approved' && crew.status !== 'off',
        matchedUserId: matchedUser.id
      };
    }
    if (allUsers.length > 0) {
      return { isActive: false };
    }
    return {
      isActive: crew.status !== 'off'
    };
  };

  // Perhitungan Dinamis Performa Rit & Rating dari Prosentase Total Kiriman & Ketepatan Waktu Berangkat/Sampai Gudang
  const getCrewDynamicPerformance = (crew: Crew) => {
    const allSchedules = logisticsStore.getSchedules();
    const cleanCrewName = (crew.name || '').trim().toLowerCase();
    const crewSchedules = allSchedules.filter(s => {
      const dName = (s.crew?.name || '').trim().toLowerCase();
      const h1Name = (s.crewHelper?.name || '').trim().toLowerCase();
      const h2Name = (s.crewHelper2?.name || '').trim().toLowerCase();
      return (
        s.crewId === crew.id ||
        s.crewHelperId === crew.id ||
        s.crewHelper2Id === crew.id ||
        (cleanCrewName.length > 0 && (dName === cleanCrewName || h1Name === cleanCrewName || h2Name === cleanCrewName))
      );
    });

    const totalAssigned = crewSchedules.length;
    const completedRit = crewSchedules.filter(s => s.status === 'delivered').length;
    const completionPct = totalAssigned > 0 ? Math.round((completedRit / totalAssigned) * 100) : 100;

    // Cek ketepatan waktu berangkat dari gudang (Gate-Out) & sampai di gudang (Gate-In / tidak telat)
    const onTimeSchedules = crewSchedules.filter(s => {
      if (s.status === 'delayed') return false;
      const notesLower = (s.notes || '').toLowerCase();
      if (notesLower.includes('telat') || notesLower.includes('terlambat') || notesLower.includes('kendala:')) {
        return false;
      }
      if (s.actualArrival && s.estimatedArrival) {
        const actualMs = new Date(s.actualArrival).getTime();
        const estMs = new Date(s.estimatedArrival).getTime();
        if (!isNaN(actualMs) && !isNaN(estMs) && actualMs > estMs + 30 * 60 * 1000) {
          return false;
        }
      }
      return true;
    }).length;

    const onTimePct = totalAssigned > 0 ? Math.round((onTimeSchedules / totalAssigned) * 100) : 100;

    // Rating dihitung dari 50% Prosentase Total Kiriman Selesai + 50% Ketepatan Waktu Berangkat & Sampai Gudang (Skala 5.0)
    const weightedScorePct = totalAssigned > 0 ? completionPct * 0.5 + onTimePct * 0.5 : 100;
    const rating = totalAssigned > 0
      ? Math.max(1.0, Math.min(5.0, Number(((weightedScorePct / 100) * 5.0).toFixed(1))))
      : 5.0;

    return {
      totalAssigned,
      completedRit,
      completionPct,
      onTimePct,
      rating
    };
  };

  const toggleCrewStatus = (crew: Crew) => {
    const { isActive, matchedUserId } = getCrewIntegratedStatus(crew);
    if (isActive) {
      logisticsStore.updateCrewStatus(crew.id, 'off');
      if (matchedUserId) {
        logisticsStore.deactivateUser(matchedUserId, 'Dinonaktifkan dari menu Status Operasional Kru');
      }
    } else {
      logisticsStore.updateCrewStatus(crew.id, 'available');
      if (matchedUserId) {
        logisticsStore.activateUser(matchedUserId, 'Diaktifkan dari menu Status Operasional Kru');
      }
    }
    setCrews(logisticsStore.getCrews());
  };

  const filteredFleets = fleets.filter(f => {
    const fleetBranch = branchStore.getFleetBranch(f.id, f.plateNumber, f.initialCode, f.branchId);
    const matchesBranch = selectedBranchId === 'ALL' || fleetBranch.id === selectedBranchId;
    const liveInfo = logisticsStore.getFleetLiveOperationalInfo(f);
    const matchesStatus = fleetFilter === 'all' || liveInfo.effectiveStatus === fleetFilter;
    const matchesType = vehicleTypeFilter === 'all' || f.vehicleType === vehicleTypeFilter;
    const q = searchQuery.toLowerCase().trim();
    const matchesQuery =
      !q ||
      f.plateNumber.toLowerCase().includes(q) ||
      f.vehicleType.toLowerCase().includes(q) ||
      (f.initialCode && f.initialCode.toLowerCase().includes(q)) ||
      (f.brand && f.brand.toLowerCase().includes(q)) ||
      (liveInfo.areaName && liveInfo.areaName.toLowerCase().includes(q)) ||
      (liveInfo.todayScheduledArea && liveInfo.todayScheduledArea.toLowerCase().includes(q)) ||
      (liveInfo.tomorrowScheduledArea && liveInfo.tomorrowScheduledArea.toLowerCase().includes(q)) ||
      (liveInfo.upcomingScheduledArea && liveInfo.upcomingScheduledArea.toLowerCase().includes(q)) ||
      (liveInfo.driverName && liveInfo.driverName.toLowerCase().includes(q)) ||
      (liveInfo.helperName && liveInfo.helperName.toLowerCase().includes(q)) ||
      liveInfo.statusLabel.toLowerCase().includes(q);
    return matchesBranch && matchesStatus && matchesType && matchesQuery;
  });

  const isCurrentSuperAdmin = logisticsStore.getCurrentUser()?.role === 'super_admin';

  // Close "Oke, Mengerti" pop-up modal when pressing Enter or Escape on keyboard
  useEffect(() => {
    if (!syncFeedback) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        setSyncFeedback(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [syncFeedback]);

  const visibleCrewsForRole = isCurrentSuperAdmin
    ? crews
    : crews.filter(c => getCrewIntegratedStatus(c).isActive);

  const filteredCrews = visibleCrewsForRole.filter(c => {
    const effectiveBranch = selectedBranchId && selectedBranchId !== 'ALL' ? selectedBranchId : 'cab-banyuwangi';
    const allUsers = logisticsStore.getUsers();
    const matchedUser = allUsers.find(
      u => `crw-${u.id}` === c.id || logisticsStore.isSameCrewPersonName(u.fullName, c.name)
    );
    const matchesBranch = matchedUser
      ? logisticsStore.isActiveDeliveryCrewUser(matchedUser, effectiveBranch)
      : (allUsers.length === 0 && branchStore.getCrewBranch(c.id, c.name).id === effectiveBranch);
    const { isActive } = getCrewIntegratedStatus(c);
    const matchesStatus =
      crewFilter === 'all' ||
      (crewFilter === 'aktif' && isActive) ||
      (crewFilter === 'nonaktif' && !isActive) ||
      c.status === crewFilter;
    const normRole = normalizeCrewRoleLabel(c.role);
    const matchesRole = crewRoleFilter === 'all' || normRole === crewRoleFilter || c.role === crewRoleFilter;
    const q = searchQuery.toLowerCase().trim();
    const matchesQuery =
      !q ||
      c.name.toLowerCase().includes(q) ||
      normRole.toLowerCase().includes(q) ||
      c.role.toLowerCase().includes(q) ||
      (c.licenseNumber && c.licenseNumber.toLowerCase().includes(q)) ||
      (c.licenseType && c.licenseType.toLowerCase().includes(q));
    return matchesBranch && matchesStatus && matchesRole && matchesQuery;
  });

  const sortedCrews = [...filteredCrews].sort((a, b) => {
    if (!crewSortConfig) return 0;
    const dir = crewSortConfig.direction === 'asc' ? 1 : -1;
    if (crewSortConfig.key === 'name') {
      return a.name.localeCompare(b.name, 'id-ID') * dir;
    }
    if (crewSortConfig.key === 'role') {
      return normalizeCrewRoleLabel(a.role).localeCompare(normalizeCrewRoleLabel(b.role), 'id-ID') * dir;
    }
    if (crewSortConfig.key === 'status') {
      const aAct = getCrewIntegratedStatus(a).isActive ? 1 : 0;
      const bAct = getCrewIntegratedStatus(b).isActive ? 1 : 0;
      return (bAct - aAct) * dir;
    }
    if (crewSortConfig.key === 'fleet') {
      const aFleet = fleets.find(f => f.id === a.currentFleetId || f.driverId === a.id);
      const bFleet = fleets.find(f => f.id === b.currentFleetId || f.driverId === b.id);
      const aCode = aFleet ? (aFleet.initialCode || aFleet.plateNumber) : 'ZZZ';
      const bCode = bFleet ? (bFleet.initialCode || bFleet.plateNumber) : 'ZZZ';
      return aCode.localeCompare(bCode, 'id-ID') * dir;
    }
    if (crewSortConfig.key === 'performance') {
      const aPerf = getCrewDynamicPerformance(a);
      const bPerf = getCrewDynamicPerformance(b);
      if (aPerf.completedRit !== bPerf.completedRit) {
        return (aPerf.completedRit - bPerf.completedRit) * dir;
      }
      return (aPerf.rating - bPerf.rating) * dir;
    }
    return 0;
  });

  // Strictly scope PIC / Kru options to the chosen branch (Cabang A vs Cabang B never mixed)
  const getBranchScopedCrews = (targetBranchId: string): Crew[] => {
    const effectiveBranch =
      targetBranchId && targetBranchId !== 'ALL'
        ? targetBranchId
        : branches[0]?.id || 'cab-banyuwangi';
    const allUsers = logisticsStore.getUsers();
    return crews
      .filter(c => {
        const matchedUser = allUsers.find(
          u => `crw-${u.id}` === c.id || logisticsStore.isSameCrewPersonName(u.fullName, c.name)
        );
        if (matchedUser) {
          return logisticsStore.isActiveDeliveryCrewUser(matchedUser, effectiveBranch);
        }
        if (allUsers.length > 0) return false;
        const { isActive } = getCrewIntegratedStatus(c);
        if (!isActive) return false;
        return branchStore.getCrewBranch(c.id, c.name).id === effectiveBranch;
      })
      .sort((a, b) => a.name.localeCompare(b.name, 'id'));
  };

  const openAddFleetModal = () => {
    const initialBranch =
      selectedBranchId && selectedBranchId !== 'ALL'
        ? selectedBranchId
        : branches[0]?.id || 'cab-banyuwangi';
    setNewFleetBranchId(initialBranch);
    setNewFleetAssignedCrewId('');
    setFleetFormErrors({});
    setNewFleet(createEmptyNewFleet());
    setIsAddFleetOpen(true);
  };

  return (
    <div className="akk-flat-fleets w-full bg-slate-50 dark:bg-slate-950/40 rounded-xl p-2 sm:p-3 space-y-3.5" data-schedule-sync={scheduleTick}>
      {/* Header & Compact Single-Bar Filter Toolbar */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white tracking-tight truncate">
              {!isCrewsMode
                ? 'Data Armada Terpadu'
                : 'Riwayat Kru Pengiriman'}
            </h2>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {isCrewsMode && (
              <div className="flex flex-wrap items-center gap-1 bg-slate-100 dark:bg-slate-950 p-1 rounded-xl border border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setActiveTab('history')}
                  className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-sm font-semibold transition cursor-pointer ${
                    activeTab === 'history'
                      ? 'bg-blue-600 text-white'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <History className="w-4 h-4" />
                  <span>Riwayat &amp; Rotasi</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('crews')}
                  className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-sm font-semibold transition cursor-pointer ${
                    activeTab === 'crews'
                      ? 'bg-blue-600 text-white'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <Users className="w-4 h-4" />
                  <span>Daftar Kru ({filteredCrews.length})</span>
                </button>
              </div>
            )}

            {!isCrewsMode && (
              <button
                onClick={openAddFleetModal}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold transition cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Tambah Armada</span>
              </button>
            )}
          </div>
        </div>

        {/* Compact Filter, Search & View Switcher */}
        {(activeTab === 'fleets' || activeTab === 'crews') && (
          <div className="flex flex-wrap items-center gap-2 mt-3 pt-3 border-t border-slate-200 dark:border-slate-800">
            <div className="relative flex-1 min-w-[200px] sm:max-w-xs">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                placeholder={activeTab === 'fleets' ? 'Cari plat, inisial, area, sopir...' : 'Cari nama kru, peran, SIM...'}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full h-10 pl-9 pr-8 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-blue-600"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 dark:hover:text-white text-sm cursor-pointer"
                >
                  &times;
                </button>
              )}
            </div>

            {activeTab === 'fleets' ? (
              <>
                <div className="w-52">
                  <FleetFormDropdown
                    accent="emerald"
                    value={selectedBranchId === 'ALL' ? 'cab-banyuwangi' : selectedBranchId}
                    onChange={(val) => branchStore.setSelectedOriginBranchId(val)}
                    options={branches.map((b) => {
                      const count = fleets.filter(
                        fl => branchStore.getFleetBranch(fl.id, fl.plateNumber, fl.initialCode, fl.branchId).id === b.id
                      ).length;
                      return {
                        value: b.id,
                        label: `${b.name.replace(/^Cabang\s+/i, '')} (${count} Unit)`,
                        Icon: Building2,
                        iconTone: 'bg-emerald-50 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/30'
                      };
                    })}
                  />
                </div>

                <div className="w-44">
                  <FleetFormDropdown
                    value={fleetFilter}
                    onChange={setFleetFilter}
                    options={[
                      { value: 'all', label: 'Semua Status' },
                      { value: 'available', label: 'Ready', dotClass: 'bg-emerald-500' },
                      { value: 'on-duty', label: 'Sedang Kirim', dotClass: 'bg-blue-600' },
                      { value: 'maintenance', label: 'Servis', dotClass: 'bg-rose-500' }
                    ]}
                  />
                </div>

                <div className="w-44">
                  <FleetFormDropdown
                    value={vehicleTypeFilter}
                    onChange={setVehicleTypeFilter}
                    options={[
                      { value: 'all', label: 'Semua Tipe' },
                      { value: 'Pick Up Box', label: 'Pick Up Box' },
                      { value: 'Engkel STD', label: 'Engkel STD' },
                      { value: 'Engkel Long', label: 'Engkel Long' },
                      { value: 'Double STD', label: 'Double STD' }
                    ]}
                  />
                </div>
              </>
            ) : (
              <>
                <div className="w-52">
                  <FleetFormDropdown
                    accent="emerald"
                    value={selectedBranchId === 'ALL' ? 'cab-banyuwangi' : selectedBranchId}
                    onChange={(val) => branchStore.setSelectedOriginBranchId(val)}
                    options={branches.map((b) => {
                      const allUsers = logisticsStore.getUsers();
                      const count = visibleCrewsForRole.filter(cr => {
                        const matchedUser = allUsers.find(
                          u => `crw-${u.id}` === cr.id || logisticsStore.isSameCrewPersonName(u.fullName, cr.name)
                        );
                        return matchedUser
                          ? logisticsStore.isActiveDeliveryCrewUser(matchedUser, b.id)
                          : branchStore.getCrewBranch(cr.id, cr.name).id === b.id;
                      }).length;
                      return {
                        value: b.id,
                        label: `${b.name.replace(/^Cabang\s+/i, '')} (${count} Kru)`,
                        Icon: Building2,
                        iconTone: 'bg-emerald-50 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/30'
                      };
                    })}
                  />
                </div>

                <div className="w-44">
                  <FleetFormDropdown
                    value={crewFilter}
                    onChange={setCrewFilter}
                    options={[
                      { value: 'all', label: 'Semua Status' },
                      { value: 'aktif', label: 'Aktif', dotClass: 'bg-emerald-500' },
                      ...(isCurrentSuperAdmin
                        ? [{ value: 'nonaktif', label: 'Nonaktif', dotClass: 'bg-rose-500' }]
                        : [])
                    ]}
                  />
                </div>

                <div className="w-40">
                  <FleetFormDropdown
                    value={crewRoleFilter}
                    onChange={setCrewRoleFilter}
                    options={[
                      { value: 'all', label: 'Semua Peran' },
                      { value: 'Driver', label: 'Driver' },
                      { value: 'Helper', label: 'Helper' }
                    ]}
                  />
                </div>
              </>
            )}

            {((activeTab === 'fleets' && (fleetFilter !== 'all' || vehicleTypeFilter !== 'all' || searchQuery)) ||
              (activeTab === 'crews' && (crewFilter !== 'all' || crewRoleFilter !== 'all' || searchQuery))) && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setFleetFilter('all');
                  setVehicleTypeFilter('all');
                  setCrewFilter('all');
                  setCrewRoleFilter('all');
                }}
                className="h-10 px-3 rounded-xl text-sm font-semibold text-rose-700 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-500/10 border border-rose-200 dark:border-rose-500/30 transition cursor-pointer"
                title="Reset Filter"
              >
                Reset
              </button>
            )}

            <div className="flex items-center bg-slate-100 dark:bg-slate-950 p-1 rounded-xl border border-slate-200 dark:border-slate-800 ml-auto">
              <button
                type="button"
                onClick={() => setViewMode('table')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold transition cursor-pointer ${
                  viewMode === 'table'
                    ? 'bg-blue-600 text-white'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                <Table className="w-4 h-4" />
                <span className="hidden md:inline">Tabel</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode('cards')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold transition cursor-pointer ${
                  viewMode === 'cards'
                    ? 'bg-blue-600 text-white'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                <LayoutGrid className="w-4 h-4" />
                <span className="hidden md:inline">Kartu</span>
              </button>
              {activeTab === 'fleets' && (
                <button
                  type="button"
                  onClick={() => setViewMode('3d')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold transition cursor-pointer ${
                    viewMode === '3d'
                      ? 'bg-blue-600 text-white'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                  }`}
                >
                  <Box className="w-4 h-4" />
                  <span>3D</span>
                </button>
              )}
            </div>

            <button
              type="button"
              disabled={isSyncingSupabase}
              onClick={handleManualSupabaseSync}
              className="inline-flex items-center gap-2 h-10 px-3.5 rounded-xl bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 text-sm font-semibold transition cursor-pointer disabled:opacity-50"
              title="Segarkan data armada dan kru"
            >
              <RefreshCw className={`w-4 h-4 ${isSyncingSupabase ? 'animate-spin text-blue-600' : 'text-slate-600 dark:text-slate-300'}`} />
              <span className="hidden sm:inline">{isSyncingSupabase ? 'Memuat...' : 'Segarkan'}</span>
            </button>
          </div>
        )}
      </div>

      {/* Modal Notifikasi Konfirmasi Penyimpanan Data (Tampil langsung di depan halaman Data Armada) */}
      {syncFeedback && (
        <div
          className="fixed inset-0 z-[1300] bg-slate-950/60 backdrop-blur-[2px] flex items-center justify-center p-4 animate-in fade-in duration-150"
          style={{ backgroundColor: 'rgba(15, 23, 42, 0.45)' }}
          onClick={() => setSyncFeedback(null)}
        >
          <div
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/80 rounded-2xl max-w-md w-full overflow-hidden shadow-2xl animate-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Top Accent Bar */}
            <div
              className={`h-1.5 w-full ${
                syncFeedback.type === 'success'
                  ? 'bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500'
                  : 'bg-gradient-to-r from-rose-500 to-amber-500'
              }`}
            />

            <div className="p-5 space-y-4">
              <div className="flex items-start gap-3.5">
                <div
                  className={`w-11 h-11 rounded-xl shrink-0 flex items-center justify-center border ${
                    syncFeedback.type === 'success'
                      ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-600 dark:text-emerald-400'
                      : 'bg-rose-500/15 border-rose-500/30 text-rose-600 dark:text-rose-400'
                  }`}
                >
                  {syncFeedback.type === 'success' ? (
                    <CheckCircle2 className="w-6 h-6" />
                  ) : (
                    <AlertCircle className="w-6 h-6" />
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className={`text-[10px] font-extrabold uppercase tracking-wider ${
                        syncFeedback.type === 'success'
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : 'text-rose-600 dark:text-rose-400'
                      }`}
                    >
                      {syncFeedback.type === 'success'
                        ? 'Manajemen Armada & Kru Terpadu'
                        : 'Peringatan Validasi Data'}
                    </span>
                    <button
                      type="button"
                      onClick={() => setSyncFeedback(null)}
                      className="text-slate-400 hover:text-slate-600 dark:hover:text-white p-0.5 rounded-lg transition cursor-pointer"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  <h3 className="text-sm sm:text-base font-black text-slate-900 dark:text-white mt-0.5">
                    {syncFeedback.type === 'success'
                      ? 'Perubahan Data Berhasil Disimpan'
                      : 'Periksa Kembali Data Anda'}
                  </h3>
                </div>
              </div>

              <div className="bg-slate-50 dark:bg-slate-800/70 rounded-xl p-3.5 border border-slate-200/80 dark:border-slate-700/70 text-xs text-slate-700 dark:text-slate-200 leading-relaxed flex items-start gap-2.5">
                <Truck
                  className={`w-4 h-4 shrink-0 mt-0.5 ${
                    syncFeedback.type === 'success'
                      ? 'text-teal-600 dark:text-teal-400'
                      : 'text-rose-500'
                  }`}
                />
                <span>{syncFeedback.message}</span>
              </div>

              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  type="button"
                  autoFocus
                  onClick={() => setSyncFeedback(null)}
                  className={`w-full py-2.5 px-4 rounded-xl font-bold text-xs text-white transition cursor-pointer shadow-sm flex items-center justify-center gap-1.5 active:scale-98 ${
                    syncFeedback.type === 'success'
                      ? 'bg-slate-900 dark:bg-emerald-600 hover:bg-slate-800 dark:hover:bg-emerald-500'
                      : 'bg-rose-600 hover:bg-rose-500'
                  }`}
                >
                  <Check className="w-4 h-4" />
                  <span>Selesai &amp; Tutup</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Banner Peringatan Data Double Armada (Mendeteksi Plat Sama / Inisial Berbeda) */}
      {activeTab === 'fleets' && duplicateFleetGroups.length > 0 && (
        <div className="bg-amber-500/10 border border-amber-500/40 rounded-xl p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-start gap-2.5">
            <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
            <div className="space-y-0.5">
              <div className="text-xs font-black text-amber-300">
                Terdeteksi {redundantFleetIdSet.size} Data Armada Double ({duplicateFleetGroups.length} Unit)
              </div>
              <p className="text-[11px] text-slate-300 leading-relaxed">
                Terdapat data ganda pada plat yang sama dengan variasi inisial (
                {duplicateFleetGroups.map(g => `${g.primary.plateNumber}: ${[g.primary.initialCode || '-', ...g.duplicates.map(d => d.initialCode || '-')].join(' vs ')}`).join('; ')}
                ). Klik bersihkan agar tidak membingungkan jadwal &amp; penghapusan data.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleCleanupDuplicateFleets}
            className="px-3.5 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-black text-xs shrink-0 shadow-sm transition cursor-pointer flex items-center gap-1.5"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Bersihkan Data Double ({redundantFleetIdSet.size})</span>
          </button>
        </div>
      )}

      {/* 3 Indikator Status Kondisi Armada Terintegrasi (Flat Clean Design + Angka Besar) */}
      {activeTab === 'fleets' && (() => {
        const branchFilteredFleets = selectedBranchId === 'ALL'
          ? fleets
          : fleets.filter(f => branchStore.getFleetBranch(f.id, f.plateNumber, f.initialCode, f.branchId).id === selectedBranchId);
        const liveInfos = branchFilteredFleets.map(f => logisticsStore.getFleetLiveOperationalInfo(f));
        const readyCount = liveInfos.filter(i => i.effectiveStatus === 'available').length;
        const kirimCount = liveInfos.filter(i => i.effectiveStatus === 'on-duty').length;
        const servisCount = liveInfos.filter(i => i.effectiveStatus === 'maintenance').length;

        return (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
            <button
              type="button"
              onClick={() => setFleetFilter(fleetFilter === 'available' ? 'all' : 'available')}
              className={`p-4 rounded-xl border text-left transition flex items-center justify-between gap-3 cursor-pointer ${
                fleetFilter === 'available'
                  ? 'bg-emerald-50/70 dark:bg-emerald-950/40 border-emerald-500'
                  : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-slate-300'
              }`}
            >
              <div className="min-w-0">
                <span className="font-bold text-emerald-700 dark:text-emerald-400 text-sm block">
                  Armada Ready
                </span>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 truncate">
                  Siap dijadwalkan kirim
                </p>
              </div>
              <span className="text-3xl font-bold font-mono tabular-nums text-emerald-600 dark:text-emerald-400 shrink-0">
                {readyCount}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setFleetFilter(fleetFilter === 'on-duty' ? 'all' : 'on-duty')}
              className={`p-4 rounded-xl border text-left transition flex items-center justify-between gap-3 cursor-pointer ${
                fleetFilter === 'on-duty'
                  ? 'bg-blue-50/70 dark:bg-blue-950/40 border-blue-600'
                  : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-slate-300'
              }`}
            >
              <div className="min-w-0">
                <span className="font-bold text-blue-700 dark:text-blue-400 text-sm block">
                  Sedang Kirim
                </span>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 truncate">
                  Dalam rute pengiriman aktif
                </p>
              </div>
              <span className="text-3xl font-bold font-mono tabular-nums text-blue-600 dark:text-blue-400 shrink-0">
                {kirimCount}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setFleetFilter(fleetFilter === 'maintenance' ? 'all' : 'maintenance')}
              className={`p-4 rounded-xl border text-left transition flex items-center justify-between gap-3 cursor-pointer ${
                fleetFilter === 'maintenance'
                  ? 'bg-rose-50/70 dark:bg-rose-950/40 border-rose-500'
                  : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-slate-300'
              }`}
            >
              <div className="min-w-0">
                <span className="font-bold text-rose-700 dark:text-rose-400 text-sm block">
                  Dalam Servis
                </span>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 truncate">
                  Perawatan &amp; terkunci dari jadwal
                </p>
              </div>
              <span className="text-3xl font-bold font-mono tabular-nums text-rose-600 dark:text-rose-400 shrink-0">
                {servisCount}
              </span>
            </button>
          </div>
        );
      })()}

      {/* Fleets Content: Table View (Flat Clean Design + Typography Besar) */}
      {activeTab === 'fleets' && viewMode === 'table' && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
                  <th className="py-3 px-3.5 w-12 text-center">#</th>
                  <th className="py-3 px-4 whitespace-nowrap">Armada &amp; Inisial</th>
                  <th className="py-3 px-4 whitespace-nowrap">Tipe &amp; Kubikasi</th>
                  <th className="py-3 px-4 whitespace-nowrap">Status &amp; Jadwal Area</th>
                  <th className="py-3 px-4 whitespace-nowrap">Sopir / PIC</th>
                  <th className="py-3 px-4 whitespace-nowrap">Pajak · STNK · KIR</th>
                  <th className="py-3 px-4 text-center w-28 whitespace-nowrap">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {filteredFleets.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-slate-500">
                      <Truck className="w-9 h-9 text-slate-400 mx-auto mb-2 opacity-60" />
                      <p className="font-semibold text-base text-slate-700 dark:text-slate-300">Tidak ada armada ditemukan</p>
                      <p className="text-sm text-slate-500 mt-1">Coba sesuaikan kata kunci pencarian atau filter status armada.</p>
                    </td>
                  </tr>
                ) : (
                  filteredFleets.map((fleet, index) => {
                    const assignedCrew = crews.find(c => c.currentFleetId === fleet.id || (fleet.driverId && c.id === fleet.driverId));
                    const liveInfo = logisticsStore.getFleetLiveOperationalInfo(fleet);
                    const effectiveDriverName = liveInfo.driverName || assignedCrew?.name || null;
                    const boxM3 = fleet.boxCapacityM3 !== undefined ? fleet.boxCapacityM3 : getFleetBoxCapacity(fleet);
                    const kirDateVal = fleet.lastMaintenance || fleet.kirExpiryDate;
                    const kirStatus = getExpiryStatus(kirDateVal);
                    const taxStatus = getExpiryStatus(fleet.taxDueDate);
                    const stnkDateVal = fleet.stnkExpiryDate;
                    const stnkStatus = getExpiryStatus(stnkDateVal);

                    const renderExpiryTextTone = (st: ReturnType<typeof getExpiryStatus>) =>
                      st.isExpired
                        ? 'text-rose-600 dark:text-rose-400 font-bold'
                        : st.isNear
                        ? 'text-amber-600 dark:text-amber-400 font-bold'
                        : st.label === 'Belum diisi'
                        ? 'text-slate-400'
                        : 'text-emerald-700 dark:text-emerald-400 font-semibold';

                    return (
                      <tr key={fleet.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition">
                        <td className="py-3.5 px-3.5 text-center font-mono text-slate-500 font-bold tabular-nums">{index + 1}</td>
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <div className="flex items-center gap-2.5">
                            <span className="font-bold text-slate-900 dark:text-white font-mono text-base tracking-wide">
                              {fleet.plateNumber}
                            </span>
                            {fleet.initialCode && (
                              <span className="px-2 py-0.5 rounded-md text-xs font-mono font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700">
                                {fleet.initialCode}
                              </span>
                            )}
                            {redundantFleetIdSet.has(fleet.id) && (
                              <span className="text-xs font-bold text-amber-700 dark:text-amber-400">
                                · Double
                              </span>
                            )}
                          </div>
                          {selectedBranchId === 'ALL' && (
                            <div className="mt-1.5">
                              <select
                                value={branchStore.getFleetBranch(fleet.id, fleet.plateNumber, fleet.initialCode, fleet.branchId).id}
                                onChange={(e) => {
                                  branchStore.setFleetBranch(fleet.id, e.target.value);
                                  logisticsStore.updateFleet(fleet.id, { branchId: e.target.value });
                                  setBranches(branchStore.getActiveBranches());
                                }}
                                className="px-2 py-0.5 rounded-md bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-300 cursor-pointer focus:outline-none"
                              >
                                {branches.map((b) => (
                                  <option key={b.id} value={b.id}>
                                    {b.name}
                                  </option>
                                ))}
                              </select>
                            </div>
                          )}
                        </td>
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <div className="font-bold text-slate-900 dark:text-slate-100 text-[15px]">
                            {fleet.vehicleType} <span className="text-slate-400 font-normal">·</span>{' '}
                            <span className="font-mono text-blue-600 dark:text-blue-400 tabular-nums">{boxM3} m³</span>
                          </div>
                          <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                            {fleet.brand || '-'} · {fleet.year || '-'}
                          </div>
                        </td>
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <div className="flex flex-col items-start gap-1">
                            <button
                              type="button"
                              onClick={() => toggleFleetStatus(fleet)}
                              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold border transition cursor-pointer ${liveInfo.badgeColorClass}`}
                              title="Klik untuk ubah status kondisi armada (Ready -> Kirim -> Servis)"
                            >
                              <span>{liveInfo.statusLabel}</span>
                            </button>
                            <div className="text-[13px] font-semibold max-w-[240px] truncate" title={liveInfo.statusDescription}>
                              {liveInfo.effectiveStatus === 'on-duty' ? (
                                <span className="text-blue-700 dark:text-blue-300">
                                  {liveInfo.areaName || 'Sedang Kirim'}
                                  {liveInfo.scheduledDepartureTime && liveInfo.scheduledReturnTime
                                    ? ` · ${liveInfo.scheduledDepartureTime}–${liveInfo.scheduledReturnTime}`
                                    : ''}
                                </span>
                              ) : liveInfo.effectiveStatus === 'maintenance' ? (
                                <span className="text-rose-600 dark:text-rose-400">
                                  Terkunci dari jadwal
                                </span>
                              ) : liveInfo.todayScheduledArea ? (
                                <span className="text-amber-700 dark:text-amber-300">
                                  Hari Ini: {liveInfo.todayScheduledArea}
                                  {liveInfo.scheduledDepartureTime && liveInfo.scheduledReturnTime
                                    ? ` · ${liveInfo.scheduledDepartureTime}–${liveInfo.scheduledReturnTime}`
                                    : ''}
                                </span>
                              ) : liveInfo.tomorrowScheduledArea ? (
                                <span className="text-amber-700 dark:text-amber-300">
                                  Esok: {liveInfo.tomorrowScheduledArea}
                                  {liveInfo.scheduledDepartureTime && liveInfo.scheduledReturnTime
                                    ? ` · ${liveInfo.scheduledDepartureTime}–${liveInfo.scheduledReturnTime}`
                                    : ''}
                                </span>
                              ) : liveInfo.upcomingScheduledArea ? (
                                <span className="text-blue-700 dark:text-blue-300">
                                  {liveInfo.scheduledDateLabel || 'Jadwal'}: {liveInfo.upcomingScheduledArea}
                                  {liveInfo.scheduledDepartureTime && liveInfo.scheduledReturnTime
                                    ? ` · ${liveInfo.scheduledDepartureTime}–${liveInfo.scheduledReturnTime}`
                                    : ''}
                                </span>
                              ) : (
                                <span className="text-slate-500 dark:text-slate-400 font-normal">Siap dijadwalkan</span>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          {effectiveDriverName ? (
                            <div>
                              <div className="font-bold text-slate-900 dark:text-slate-100 text-[15px]">
                                {effectiveDriverName}
                              </div>
                              {liveInfo.helperName && liveInfo.helperName !== effectiveDriverName && (
                                <div className="text-[13px] text-slate-600 dark:text-slate-300 font-medium mt-0.5">
                                  Helper: {liveInfo.helperName}
                                </div>
                              )}
                            </div>
                          ) : liveInfo.helperName ? (
                            <div className="font-semibold text-slate-800 dark:text-slate-200 text-sm">
                              Helper: {liveInfo.helperName}
                            </div>
                          ) : (
                            <span className="text-sm text-slate-400">Belum Dipasangkan</span>
                          )}
                        </td>

                        {/* Pajak, STNK & KIR — Clean Unboxed Inline Rows */}
                        <td className="py-3 px-4 whitespace-nowrap">
                          <div className="space-y-1 text-[13px] font-mono tabular-nums min-w-[235px]">
                            <div className="flex items-center justify-between gap-3">
                              <span className="text-slate-600 dark:text-slate-300">
                                <span className="font-sans font-bold text-slate-500 dark:text-slate-400 inline-block w-11">Pajak</span>
                                <span className="font-semibold text-slate-900 dark:text-slate-100">{fleet.taxDueDate ? formatIndoDate(fleet.taxDueDate) : '-'}</span>
                              </span>
                              <span className={`font-sans text-xs ${renderExpiryTextTone(taxStatus)}`}>{taxStatus.label}</span>
                            </div>
                            <div className="flex items-center justify-between gap-3">
                              <span className="text-slate-600 dark:text-slate-300">
                                <span className="font-sans font-bold text-slate-500 dark:text-slate-400 inline-block w-11">STNK</span>
                                <span className="font-semibold text-slate-900 dark:text-slate-100">{stnkDateVal ? formatIndoDate(stnkDateVal) : '-'}</span>
                              </span>
                              <span className={`font-sans text-xs ${renderExpiryTextTone(stnkStatus)}`}>{stnkStatus.label}</span>
                            </div>
                            <div className="flex items-center justify-between gap-3">
                              <span className="text-slate-600 dark:text-slate-300">
                                <span className="font-sans font-bold text-slate-500 dark:text-slate-400 inline-block w-11">KIR</span>
                                <span className="font-semibold text-slate-900 dark:text-slate-100">{kirDateVal ? formatIndoDate(kirDateVal) : '-'}</span>
                              </span>
                              <span className={`font-sans text-xs ${renderExpiryTextTone(kirStatus)}`}>{kirStatus.label}</span>
                            </div>
                          </div>
                        </td>

                        {/* Aksi */}
                        <td className="py-3.5 px-4 text-center whitespace-nowrap">
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => {
                                setSelected3DFleetId(fleet.id);
                                setViewMode('3d');
                              }}
                              className="p-2 rounded-lg bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 transition cursor-pointer"
                              title="Lihat Desain 3D Armada"
                            >
                              <Box className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleEditFleetClick(fleet)}
                              className="p-2 rounded-lg bg-blue-50 dark:bg-slate-800 hover:bg-blue-100 dark:hover:bg-slate-700 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-slate-700 transition cursor-pointer"
                              title="Edit Data Armada"
                            >
                              <Edit3 className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteFleetClick(fleet)}
                              className="p-2 rounded-lg bg-rose-50 dark:bg-rose-500/10 hover:bg-rose-100 dark:hover:bg-rose-500/20 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-500/30 transition cursor-pointer"
                              title="Hapus Armada"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                            {fleet.kirDocUrl && (
                              <button
                                type="button"
                                onClick={() => setSelectedKirDocFleet(fleet)}
                                className="p-2 rounded-lg bg-emerald-50 dark:bg-emerald-500/10 hover:bg-emerald-100 dark:hover:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/30 transition cursor-pointer"
                                title="Lihat Dokumen KIR Dishub"
                              >
                                <FileText className="w-4 h-4" />
                              </button>
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
        </div>
      )}

      {/* Fleets Content: Cards Grid View (Flat Clean Design) */}
      {activeTab === 'fleets' && viewMode === 'cards' && (
        filteredFleets.length === 0 ? (
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-12 text-center text-slate-500">
            <Truck className="w-9 h-9 text-slate-400 mx-auto mb-2 opacity-60" />
            <p className="font-semibold text-base text-slate-700 dark:text-slate-300">Tidak ada armada ditemukan</p>
            <p className="text-sm text-slate-500 mt-1">Coba sesuaikan kata kunci pencarian atau filter status dan tipe kendaraan.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredFleets.map(fleet => {
            const assignedCrew = crews.find(c => c.currentFleetId === fleet.id || (fleet.driverId && c.id === fleet.driverId));
            const liveInfo = logisticsStore.getFleetLiveOperationalInfo(fleet);
            const effectiveDriverName = liveInfo.driverName || assignedCrew?.name || null;
            const boxM3 = fleet.boxCapacityM3 !== undefined ? fleet.boxCapacityM3 : getFleetBoxCapacity(fleet);
            const boxDim = fleet.boxDimensions || getDefaultBoxDimensions(fleet.vehicleType, fleet.brand);
            const boxMultiplier = fleet.boxInnerMultiplierPercent !== undefined ? fleet.boxInnerMultiplierPercent : 90;
            const innerBoxM3 = fleet.boxInnerCapacityM3 !== undefined ? fleet.boxInnerCapacityM3 : Number((boxM3 * (boxMultiplier / 100)).toFixed(2));

            return (
              <div key={fleet.id} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-4 hover:border-slate-300 dark:hover:border-slate-700 transition">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[11px] uppercase font-bold text-slate-500 dark:text-slate-400 tracking-wider">PLAT NOMOR</span>
                      {fleet.initialCode && (
                        <span className="px-2 py-0.5 rounded-md text-xs font-mono font-bold bg-indigo-50 dark:bg-indigo-500/20 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-500/40">
                          {fleet.initialCode}
                        </span>
                      )}
                      {redundantFleetIdSet.has(fleet.id) && (
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-bold uppercase bg-amber-50 dark:bg-amber-500/20 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-500/40">
                          Data Double
                        </span>
                      )}
                    </div>
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white font-mono tracking-wide mt-0.5">
                      {fleet.plateNumber} {fleet.initialCode ? `(${fleet.initialCode})` : ''}
                    </h3>
                  </div>

                  <div className="flex flex-col items-end gap-1">
                    <button
                      onClick={() => toggleFleetStatus(fleet)}
                      className={`inline-flex items-center gap-2 px-3 py-1 rounded-lg text-xs font-bold cursor-pointer border transition ${liveInfo.badgeColorClass}`}
                      title="Klik untuk ubah status kondisi armada (Ready -> Kirim -> Servis)"
                    >
                      <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${liveInfo.dotColorClass}`} />
                      <span>{liveInfo.statusLabel}</span>
                    </button>
                    <span className="text-xs text-slate-600 dark:text-slate-400 font-medium max-w-[205px] truncate text-right" title={liveInfo.statusDescription}>
                      {liveInfo.effectiveStatus === 'on-duty'
                        ? `Area: ${liveInfo.areaName || 'Sedang Kirim'}`
                        : liveInfo.effectiveStatus === 'maintenance'
                        ? 'Dalam perbaikan (Terkunci)'
                        : liveInfo.todayScheduledArea
                        ? `Hari Ini: ${liveInfo.todayScheduledArea}`
                        : liveInfo.tomorrowScheduledArea
                        ? `Esok: ${liveInfo.tomorrowScheduledArea}`
                        : liveInfo.upcomingScheduledArea
                        ? `${liveInfo.scheduledDateLabel || 'Jadwal'}: ${liveInfo.upcomingScheduledArea}`
                        : 'Siap jadwal pengiriman'}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2.5 text-sm">
                  <div className="bg-slate-50 dark:bg-slate-950/60 p-3 rounded-xl border border-slate-200 dark:border-slate-800">
                    <span className="text-slate-500 dark:text-slate-400 text-xs block">Tipe Armada:</span>
                    <div className="font-bold text-slate-900 dark:text-white mt-0.5 flex items-center justify-between gap-1">
                      <span className="truncate">{fleet.vehicleType}</span>
                      <span className="px-1.5 py-0.5 rounded text-xs font-mono font-bold bg-cyan-50 dark:bg-cyan-500/15 text-cyan-800 dark:text-cyan-300 border border-cyan-200 dark:border-cyan-500/30 whitespace-nowrap" title={`Kubikasi Box: ${boxM3} m³`}>
                        {boxM3} m³
                      </span>
                    </div>
                  </div>
                  <div className="bg-slate-50 dark:bg-slate-950/60 p-3 rounded-xl border border-slate-200 dark:border-slate-800">
                    <span className="text-slate-500 dark:text-slate-400 text-xs block">Target Jam Kirim:</span>
                    <div className="font-semibold text-blue-700 dark:text-blue-300 font-mono mt-0.5 text-xs">
                      {liveInfo.scheduledDepartureTime && liveInfo.scheduledReturnTime
                        ? `${liveInfo.scheduledDepartureTime}–${liveInfo.scheduledReturnTime} WIB`
                        : '-'}
                    </div>
                  </div>
                </div>

                {/* Spesifikasi Kendaraan */}
                <div className="grid grid-cols-3 gap-2 text-xs">
                  <div className="bg-slate-50 dark:bg-slate-950/40 p-2.5 rounded-lg border border-slate-200 dark:border-slate-800/60 text-center">
                    <span className="text-slate-500 dark:text-slate-400 text-[11px] block">Merk Mobil</span>
                    <div className="font-bold text-slate-900 dark:text-white truncate mt-0.5" title={fleet.brand || 'Mitsubishi L300'}>
                      {fleet.brand || 'Mitsubishi L300'}
                    </div>
                  </div>
                  <div className="bg-slate-50 dark:bg-slate-950/40 p-2.5 rounded-lg border border-slate-200 dark:border-slate-800/60 text-center">
                    <span className="text-slate-500 dark:text-slate-400 text-[11px] block">Tahun</span>
                    <div className="font-bold text-slate-900 dark:text-white mt-0.5">{fleet.year || '2023'}</div>
                  </div>
                  <div className="bg-slate-50 dark:bg-slate-950/40 p-2.5 rounded-lg border border-slate-200 dark:border-slate-800/60 text-center">
                    <span className="text-slate-500 dark:text-slate-400 text-[11px] block">Kapasitas</span>
                    <div className="font-bold text-slate-900 dark:text-white mt-0.5">{fleet.engineCc || '2500 CC'}</div>
                  </div>
                </div>

                {/* Dimensi Box */}
                <div className="bg-slate-50 dark:bg-slate-950/80 p-3.5 rounded-xl border border-slate-200 dark:border-cyan-500/30 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-slate-800 dark:text-cyan-300 flex items-center gap-1.5">
                      <Box className="w-4 h-4 text-blue-600 dark:text-cyan-400" />
                      <span>Kapasitas Kubikasi Box Truk</span>
                    </span>
                    <span className="px-2 py-0.5 rounded text-xs font-mono font-bold bg-cyan-50 dark:bg-cyan-500/20 text-cyan-800 dark:text-cyan-300 border border-cyan-200 dark:border-cyan-500/40">
                      Pengali: {boxMultiplier}%
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="bg-white dark:bg-slate-900/90 p-2.5 rounded-lg border border-slate-200 dark:border-slate-800">
                      <span className="text-[11px] text-slate-500 dark:text-slate-400 block">Box Luar:</span>
                      <div className="font-mono font-bold text-slate-900 dark:text-white text-sm mt-0.5">{boxM3} m³</div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400 font-mono truncate" title={boxDim}>{boxDim}</div>
                    </div>

                    <div className="bg-blue-50/70 dark:bg-cyan-950/40 p-2.5 rounded-lg border border-blue-200 dark:border-cyan-500/40">
                      <span className="text-[11px] text-blue-700 dark:text-cyan-400 font-bold block">
                        Netto ({boxMultiplier}%):
                      </span>
                      <div className="font-mono font-bold text-blue-700 dark:text-cyan-300 text-sm mt-0.5">{innerBoxM3} m³</div>
                      <div className="text-[11px] text-blue-600/80 dark:text-cyan-400/80 font-mono">Efektif Muatan</div>
                    </div>
                  </div>
                </div>

                {/* Legalitas Dokumen & Komponen Rutin */}
                <div className="space-y-2.5 text-xs">
                  <div className="bg-slate-50 dark:bg-slate-950/75 p-3 rounded-xl border border-slate-200 dark:border-slate-800/90 space-y-2">
                    <div className="flex items-center justify-between pb-1.5 border-b border-slate-200 dark:border-slate-800/60">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800 dark:text-slate-200">
                        <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                        <span>Dokumen Kendaraan</span>
                      </div>
                      {(() => {
                        const kirStat = getExpiryStatus(fleet.lastMaintenance || fleet.kirExpiryDate);
                        const taxStat = getExpiryStatus(fleet.taxDueDate);
                        const stnkStat = getExpiryStatus(fleet.stnkExpiryDate);
                        const hasExpired = kirStat.isExpired || taxStat.isExpired || stnkStat.isExpired;
                        const hasNear = kirStat.isNear || taxStat.isNear || stnkStat.isNear;

                        if (hasExpired) {
                          return (
                            <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-rose-50 dark:bg-rose-500/15 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-500/30 flex items-center gap-1">
                              <AlertTriangle className="w-3 h-3" />
                              Perlu Perpanjangan
                            </span>
                          );
                        }
                        if (hasNear) {
                          return (
                            <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-amber-50 dark:bg-amber-500/15 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-500/30 flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              Mendekati Tempo
                            </span>
                          );
                        }
                        return (
                          <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-50 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/30 flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3" />
                            Dokumen Valid
                          </span>
                        );
                      })()}
                    </div>

                    <div className="grid grid-cols-3 gap-1.5 text-center">
                      {(() => {
                        const taxDate = fleet.taxDueDate;
                        const stnkDate = fleet.stnkExpiryDate;
                        const kirDate = fleet.lastMaintenance || fleet.kirExpiryDate;
                        const taxStatus = getExpiryStatus(taxDate);
                        const stnkStatus = getExpiryStatus(stnkDate);
                        const kirStatus = getExpiryStatus(kirDate);
                        return (
                          <>
                            <div className="bg-white dark:bg-slate-900 p-2 rounded-lg border border-slate-200 dark:border-slate-800">
                              <div className="text-[11px] font-bold text-indigo-700 dark:text-indigo-300">PAJAK</div>
                              <div className="text-xs font-mono font-bold text-slate-900 dark:text-white mt-0.5">{taxDate ? formatIndoDate(taxDate) : '-'}</div>
                              <span className={`inline-block mt-1 px-1.5 py-0.5 rounded text-[10px] border font-semibold ${taxStatus.color}`}>{taxStatus.label}</span>
                            </div>
                            <div className="bg-white dark:bg-slate-900 p-2 rounded-lg border border-slate-200 dark:border-slate-800">
                              <div className="text-[11px] font-bold text-amber-700 dark:text-amber-300">STNK</div>
                              <div className="text-xs font-mono font-bold text-slate-900 dark:text-white mt-0.5">{stnkDate ? formatIndoDate(stnkDate) : '-'}</div>
                              <span className={`inline-block mt-1 px-1.5 py-0.5 rounded text-[10px] border font-semibold ${stnkStatus.color}`}>{stnkStatus.label}</span>
                            </div>
                            <div className="bg-white dark:bg-slate-900 p-2 rounded-lg border border-slate-200 dark:border-slate-800">
                              <div className="text-[11px] font-bold text-teal-700 dark:text-teal-300">KIR</div>
                              <div className="text-xs font-mono font-bold text-slate-900 dark:text-white mt-0.5">{kirDate ? formatIndoDate(kirDate) : '-'}</div>
                              <span className={`inline-block mt-1 px-1.5 py-0.5 rounded text-[10px] border font-semibold ${kirStatus.color}`}>{kirStatus.label}</span>
                            </div>
                          </>
                        );
                      })()}
                    </div>
                  </div>
                </div>

                {/* Assigned Crew / Scheduled PIC Bar */}
                <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-sm text-slate-600 dark:text-slate-400">
                  <span className="text-xs font-semibold">Sopir / PIC:</span>
                  <div className="flex items-center gap-2 flex-wrap justify-end">
                    <UserCheck className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                    <span className="font-bold text-slate-900 dark:text-white">
                      {effectiveDriverName || 'Belum Dipasangkan'}
                    </span>
                    {liveInfo.helperName && liveInfo.helperName !== effectiveDriverName && (
                      <span className="text-xs font-semibold text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-500/15 border border-amber-200 dark:border-amber-500/30 px-2 py-0.5 rounded">
                        Helper: {liveInfo.helperName}
                      </span>
                    )}
                  </div>
                </div>

                {/* 3D, Edit & Hapus Buttons */}
                <div className="pt-2.5 border-t border-slate-200 dark:border-slate-800/80 flex items-center justify-end gap-2 text-xs">
                  <button
                    type="button"
                    onClick={() => {
                      setSelected3DFleetId(fleet.id);
                      setViewMode('3d');
                    }}
                    className="px-3 py-1.5 rounded-lg bg-cyan-50 dark:bg-cyan-500/10 hover:bg-cyan-100 dark:hover:bg-cyan-500/20 text-cyan-700 dark:text-cyan-300 border border-cyan-200 dark:border-cyan-500/30 font-semibold flex items-center gap-1 transition cursor-pointer"
                  >
                    <Box className="w-3.5 h-3.5" />
                    <span>3D</span>
                  </button>
                  <button
                    onClick={() => handleEditFleetClick(fleet)}
                    className="px-3 py-1 rounded bg-slate-800 hover:bg-slate-750 hover:text-white text-slate-300 font-medium flex items-center gap-1 transition cursor-pointer"
                  >
                    <Edit3 className="w-3.5 h-3.5 text-blue-400" />
                    <span>Edit</span>
                  </button>
                  <button
                    onClick={() => handleDeleteFleetClick(fleet)}
                    className="px-3 py-1 rounded bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 hover:text-rose-300 font-medium flex items-center gap-1 transition cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Hapus</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
        )
      )}

      {/* Fleets Content: 3D Studio Showcase View */}
      {activeTab === 'fleets' && viewMode === '3d' && (
        <Fleet3DShowcase
          fleets={filteredFleets}
          crews={crews}
          selectedFleetId={selected3DFleetId}
          onSelectFleetId={(id) => setSelected3DFleetId(id)}
          onToggleFleetStatus={toggleFleetStatus}
          onEditFleet={handleEditFleetClick}
          onUpdateFleetPhotos={(fleetId, photos3d) => {
            logisticsStore.updateFleet(fleetId, { photos3d });
            setFleets(logisticsStore.getFleets());
          }}
          onViewKirDoc={(fl) => setSelectedKirDocFleet(fl)}
          getBoxCapacityM3={getFleetBoxCapacity}
          getBoxDimensions={(fl) => getDefaultBoxDimensions(fl.vehicleType, fl.brand)}
          formatIndoDate={formatIndoDate}
          getExpiryStatus={getExpiryStatus}
        />
      )}

      {/* Info Indikator Status Operasional & Rumus Performa Rit & Rating */}
      {activeTab === 'crews' && (
        <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs shadow-2xs">
          <div className="flex items-start sm:items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
              <Award className="w-4 h-4" />
            </div>
            <div className="space-y-0.5">
              <div className="font-bold text-white text-xs">
                Integrasi Status Operasional &amp; Rumus Performa Rit / Rating Kru
              </div>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                <strong>Status Operasional (Aktif / Nonaktif)</strong> terintegrasi langsung dengan <strong>Manajemen User</strong>. Sedangkan <strong>Performa Rit &amp; Rating</strong> dihitung otomatis dari <strong>Prosentase Total Kiriman Selesai (%)</strong> serta <strong>Ketepatan Waktu (Tidak Telat) Berangkat dari Gudang &amp; Sampai di Gudang (%)</strong>.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Crews Content: Table View */}
      {activeTab === 'crews' && (viewMode === 'table' || viewMode === '3d') && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-950/80 border-b border-slate-800 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                  <th className="py-3 px-4 w-12 text-center">#</th>
                  <th className="py-3 px-4">
                    <button
                      type="button"
                      onClick={() => handleCrewSort('name')}
                      className="inline-flex items-center gap-1.5 hover:text-white transition cursor-pointer uppercase font-semibold"
                    >
                      <span>Nama Lengkap Kru</span>
                      {crewSortConfig?.key === 'name' ? (
                        crewSortConfig.direction === 'asc' ? (
                          <ArrowUp className="w-3.5 h-3.5 text-blue-400" />
                        ) : (
                          <ArrowDown className="w-3.5 h-3.5 text-blue-400" />
                        )
                      ) : (
                        <ArrowUpDown className="w-3.5 h-3.5 text-slate-500" />
                      )}
                    </button>
                  </th>
                  <th className="py-3 px-4">
                    <button
                      type="button"
                      onClick={() => handleCrewSort('role')}
                      className="inline-flex items-center gap-1.5 hover:text-white transition cursor-pointer uppercase font-semibold"
                    >
                      <span>Peran Tugas</span>
                      {crewSortConfig?.key === 'role' ? (
                        crewSortConfig.direction === 'asc' ? (
                          <ArrowUp className="w-3.5 h-3.5 text-blue-400" />
                        ) : (
                          <ArrowDown className="w-3.5 h-3.5 text-blue-400" />
                        )
                      ) : (
                        <ArrowUpDown className="w-3.5 h-3.5 text-slate-500" />
                      )}
                    </button>
                  </th>
                  <th className="py-3 px-4 text-center">
                    <button
                      type="button"
                      onClick={() => handleCrewSort('status')}
                      className="inline-flex items-center justify-center gap-1.5 hover:text-white transition cursor-pointer uppercase font-semibold mx-auto"
                    >
                      <span>Status Operasional (User)</span>
                      {crewSortConfig?.key === 'status' ? (
                        crewSortConfig.direction === 'asc' ? (
                          <ArrowUp className="w-3.5 h-3.5 text-blue-400" />
                        ) : (
                          <ArrowDown className="w-3.5 h-3.5 text-blue-400" />
                        )
                      ) : (
                        <ArrowUpDown className="w-3.5 h-3.5 text-slate-500" />
                      )}
                    </button>
                  </th>
                  <th className="py-3 px-4">
                    <button
                      type="button"
                      onClick={() => handleCrewSort('fleet')}
                      className="inline-flex items-center gap-1.5 hover:text-white transition cursor-pointer uppercase font-semibold"
                    >
                      <span>Armada Ditugaskan</span>
                      {crewSortConfig?.key === 'fleet' ? (
                        crewSortConfig.direction === 'asc' ? (
                          <ArrowUp className="w-3.5 h-3.5 text-blue-400" />
                        ) : (
                          <ArrowDown className="w-3.5 h-3.5 text-blue-400" />
                        )
                      ) : (
                        <ArrowUpDown className="w-3.5 h-3.5 text-slate-500" />
                      )}
                    </button>
                  </th>
                  <th className="py-3 px-4 text-center">
                    <button
                      type="button"
                      onClick={() => handleCrewSort('performance')}
                      className="inline-flex items-center justify-center gap-1.5 hover:text-white transition cursor-pointer uppercase font-semibold mx-auto"
                    >
                      <span>Performa Rit &amp; Rating (Kiriman &amp; Waktu Gudang)</span>
                      {crewSortConfig?.key === 'performance' ? (
                        crewSortConfig.direction === 'asc' ? (
                          <ArrowUp className="w-3.5 h-3.5 text-blue-400" />
                        ) : (
                          <ArrowDown className="w-3.5 h-3.5 text-blue-400" />
                        )
                      ) : (
                        <ArrowUpDown className="w-3.5 h-3.5 text-slate-500" />
                      )}
                    </button>
                  </th>
                  <th className="py-3 px-4 text-center w-24">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {sortedCrews.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-slate-400">
                      <Users className="w-8 h-8 text-slate-600 mx-auto mb-2 opacity-60" />
                      <p className="font-semibold text-slate-300">Tidak ada kru ditemukan</p>
                      <p className="text-[11px] text-slate-500 mt-1">Coba sesuaikan kata kunci pencarian atau filter status kru.</p>
                    </td>
                  </tr>
                ) : (
                  sortedCrews.map((crew, index) => {
                    const assignedFleet = fleets.find(f => f.id === crew.currentFleetId || f.driverId === crew.id);
                    const { isActive } = getCrewIntegratedStatus(crew);
                    const perf = getCrewDynamicPerformance(crew);
                    const displayRole = normalizeCrewRoleLabel(crew.role);

                    return (
                      <tr key={crew.id} className="hover:bg-slate-850/50 transition">
                        <td className="py-3 px-4 text-center font-mono text-slate-500 font-bold">{index + 1}</td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-blue-400 font-bold text-xs shrink-0">
                              {crew.name.substring(0, 2).toUpperCase()}
                            </div>
                            <div>
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <h4 className="font-bold text-white text-xs">{crew.name}</h4>
                                <span className="text-[9px] font-bold text-emerald-400 bg-emerald-500/10 px-1.5 py-0.2 rounded border border-emerald-500/25">
                                  Cabang {branchStore.getCrewBranch(crew.id, crew.name).name}
                                </span>
                              </div>
                              <span className="text-[10px] text-slate-500">ID: {crew.id.slice(0, 8)}</span>
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <span className={`px-2 py-0.5 rounded-md text-[10px] font-semibold border ${
                            displayRole === 'Driver'
                              ? 'bg-blue-500/15 text-blue-400 border-blue-500/30'
                              : 'bg-amber-500/15 text-amber-400 border-amber-500/30'
                          }`}>
                            {displayRole}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-center">
                          <button
                            type="button"
                            onClick={() => toggleCrewStatus(crew)}
                            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold border transition cursor-pointer ${
                              isActive
                                ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/25'
                                : 'bg-rose-500/15 text-rose-400 border-rose-500/30 hover:bg-rose-500/25'
                            }`}
                            title="Terintegrasi dengan Manajemen User (Klik untuk ubah Aktif / Nonaktif)"
                          >
                            <span className={`w-1.5 h-1.5 rounded-full ${isActive ? 'bg-emerald-400' : 'bg-rose-400'}`} />
                            <span>{isActive ? 'Aktif' : 'Nonaktif'}</span>
                          </button>
                        </td>
                        <td className="py-3 px-4">
                          {assignedFleet ? (
                            <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-indigo-500/15 border border-indigo-500/30 font-mono font-bold text-indigo-300 text-xs">
                              <Truck className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                              <span>{assignedFleet.initialCode || assignedFleet.plateNumber}</span>
                            </div>
                          ) : (
                            <span className="text-[11px] text-slate-500 italic">Standby Pool</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <div className="font-bold text-white text-xs">
                            {perf.completedRit} / {perf.totalAssigned} Rit ({perf.completionPct}% Kiriman)
                          </div>
                          <div className="text-[10px] text-amber-400 font-bold flex items-center justify-center gap-1 mt-0.5">
                            <Award className="w-3 h-3 shrink-0" />
                            <span>{perf.rating.toFixed(1)} / 5.0</span>
                            <span className="text-slate-500">•</span>
                            <span className="text-emerald-400">Tepat Waktu Gudang: {perf.onTimePct}%</span>
                          </div>
                        </td>
                        <td className="py-3 px-4 text-center">
                          <div className="flex items-center justify-center">
                            <button
                              type="button"
                              onClick={() => handleEditCrewClick(crew)}
                              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition cursor-pointer"
                              title="Edit Data Kru"
                            >
                              <Edit3 className="w-3.5 h-3.5 text-blue-400" />
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
      )}

      {/* Crews Content: Cards Grid View */}
      {activeTab === 'crews' && viewMode === 'cards' && (
        sortedCrews.length === 0 ? (
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-12 text-center text-slate-400">
            <Users className="w-8 h-8 text-slate-600 mx-auto mb-2 opacity-60" />
            <p className="font-semibold text-slate-300">Tidak ada kru ditemukan</p>
            <p className="text-[11px] text-slate-500 mt-1">Coba sesuaikan kata kunci pencarian atau filter status dan peran kru.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {sortedCrews.map(crew => {
              const { isActive } = getCrewIntegratedStatus(crew);
              const perf = getCrewDynamicPerformance(crew);
              const displayRole = normalizeCrewRoleLabel(crew.role);
              return (
                <div key={crew.id} className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm space-y-4 hover:border-slate-700 transition">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-blue-400 font-bold text-sm">
                        {crew.name.substring(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <h3 className="text-sm font-bold text-white">{crew.name}</h3>
                          <span className="text-[9px] font-bold text-emerald-400 bg-emerald-500/10 px-1.5 py-0.2 rounded border border-emerald-500/25">
                            Cabang {branchStore.getCrewBranch(crew.id, crew.name).name}
                          </span>
                        </div>
                        <span className="text-[11px] text-slate-400">{displayRole}</span>
                      </div>
                    </div>

                    <button
                      onClick={() => toggleCrewStatus(crew)}
                      className={`px-2.5 py-1 rounded-full text-xs font-bold cursor-pointer border transition flex items-center gap-1.5 ${
                        isActive
                          ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                          : 'bg-rose-500/15 text-rose-400 border-rose-500/30'
                      }`}
                    >
                      <span className={`w-1.5 h-1.5 rounded-full ${isActive ? 'bg-emerald-400' : 'bg-rose-400'}`} />
                      <span>{isActive ? 'Aktif' : 'Nonaktif'}</span>
                    </button>
                  </div>

                  <div className="bg-slate-950/60 p-2.5 rounded-lg border border-slate-800 text-xs space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400 text-[11px]">Prosentase Kiriman Selesai:</span>
                      <span className="font-bold text-white">{perf.completedRit} / {perf.totalAssigned} Rit ({perf.completionPct}%)</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400 text-[11px]">Tepat Waktu Berangkat &amp; Tiba Gudang:</span>
                      <span className="font-bold text-emerald-400">{perf.onTimePct}%</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-3 border-t border-slate-800 text-xs">
                    <span className="text-[11px] text-slate-400">Rating Performa:</span>
                    <div className="flex items-center gap-1 text-amber-400 font-semibold">
                      <Award className="w-3.5 h-3.5" />
                      <span>{perf.rating.toFixed(1)} / 5.0</span>
                    </div>
                  </div>

                  <div className="pt-2">
                    <button
                      onClick={() => setActiveTab('history')}
                      className="w-full py-1.5 px-2.5 rounded-lg bg-slate-950 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 text-slate-300 hover:text-white text-[11px] font-semibold flex items-center justify-center gap-1.5 transition cursor-pointer"
                    >
                      <History className="w-3.5 h-3.5 text-amber-400" />
                      <span>Cek Histori &amp; Distribusi Wilayah</span>
                    </button>
                  </div>

                  {/* Edit Button */}
                  <div className="pt-2.5 border-t border-slate-800 flex items-center justify-end gap-2 text-xs">
                    <button
                      onClick={() => handleEditCrewClick(crew)}
                      className="px-3 py-1 rounded bg-slate-800 hover:bg-slate-750 hover:text-white text-slate-300 font-medium flex items-center gap-1 transition cursor-pointer"
                    >
                      <Edit3 className="w-3.5 h-3.5 text-blue-400" />
                      <span>Edit</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )
      )}

      {/* Efisiensi BBM Tab Content */}
      {activeTab === 'fuel' && (
        <FuelEfficiencyManagement onNavigateToFleets={() => setActiveTab('fleets')} />
      )}

      {/* Spare Part & Service Tab Content */}
      {activeTab === 'spareparts' && (
        <SparePartManagement onNavigateToFleets={() => setActiveTab('fleets')} />
      )}

      {/* History & Area Approval Tab Content */}
      {activeTab === 'history' && (
        <CrewDeliveryHistoryView />
      )}

      {/* Formulir Operasional Armada Tab Content */}
      {activeTab === 'forms' && (
        <FleetFormCenter />
      )}

      {/* Add Fleet Modal */}
      {isAddFleetOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-hidden">
          <div className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden my-auto">
            <div className="p-4 border-b border-slate-800 flex items-center justify-between shrink-0 bg-slate-900/95">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Truck className="w-4 h-4 text-blue-400" />
                Registrasi Armada Kendaraan Baru
              </h3>
              <button
                type="button"
                onClick={() => setIsAddFleetOpen(false)}
                className="text-slate-400 hover:text-white font-bold text-lg p-1 rounded-lg hover:bg-slate-800 transition cursor-pointer"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleCreateFleet} className="flex flex-col flex-1 min-h-0 overflow-hidden">
              {(() => {
                const selectedNewBranch = branches.find(b => b.id === newFleetBranchId) || branches[0];
                const newBranchCrews = getBranchScopedCrews(newFleetBranchId);
                const branchDropdownOptions: FleetDropdownOption[] = branches.map(b => ({
                  value: b.id,
                  label: `Cabang ${b.name} (${b.city})`,
                  sublabel: `Wilayah Operasional ${b.city}`,
                  Icon: Building2,
                  iconTone: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                }));
                const picCrewDropdownOptions: FleetDropdownOption[] = [
                  {
                    value: '',
                    label: `Standby / Pool ${selectedNewBranch?.name || 'Cabang'} (Belum Ada PIC)`,
                    sublabel: 'Belum ditugaskan ke kru tertentu',
                    dotClass: 'bg-slate-400'
                  },
                  ...newBranchCrews.map(c => {
                    const otherFleetObj = c.currentFleetId
                      ? fleets.find(f => f.id === c.currentFleetId)
                      : null;
                    return {
                      value: c.id,
                      label: c.name,
                      sublabel: otherFleetObj
                        ? `Aktif di ${otherFleetObj.initialCode || otherFleetObj.plateNumber}`
                        : `Cabang ${selectedNewBranch?.name || ''}`,
                      dotClass: otherFleetObj ? 'bg-amber-400' : 'bg-emerald-400',
                      badge: otherFleetObj ? (otherFleetObj.initialCode || otherFleetObj.plateNumber) : undefined,
                      badgeTone: 'bg-amber-500/15 text-amber-400 border-amber-500/30'
                    };
                  })
                ];

                return (
              <div className="p-5 space-y-4 text-xs overflow-y-auto flex-1 overscroll-contain">
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="text-slate-400 block mb-1">Cabang Armada *</label>
                  <FleetFormDropdown
                    value={newFleetBranchId}
                    onChange={(nextBranchId) => {
                      setNewFleetBranchId(nextBranchId);
                      const allowedCrews = getBranchScopedCrews(nextBranchId);
                      if (newFleetAssignedCrewId && !allowedCrews.some(c => c.id === newFleetAssignedCrewId)) {
                        setNewFleetAssignedCrewId('');
                      }
                    }}
                    options={branchDropdownOptions}
                    placeholder="Pilih Cabang Armada..."
                    accent="emerald"
                  />
                </div>
                <div>
                  <label className="text-slate-400 block mb-1">Nomor Polisi (Plat)</label>
                  <input
                    type="text"
                    required
                    placeholder="Contoh: P 8125 VC"
                    value={newFleet.plateNumber}
                    onChange={(e) => {
                      setNewFleet({ ...newFleet, plateNumber: e.target.value.toUpperCase() });
                      if (fleetFormErrors.plateNumber) setFleetFormErrors({ ...fleetFormErrors, plateNumber: '' });
                    }}
                    className={`w-full px-3 py-2 rounded-xl bg-slate-950 border text-white placeholder:text-slate-500/70 font-mono uppercase ${
                      fleetFormErrors.plateNumber ? 'border-rose-500 ring-1 ring-rose-500' : 'border-slate-800'
                    }`}
                  />
                  {fleetFormErrors.plateNumber && (
                    <p className="text-[10px] text-rose-400 mt-1 flex items-center gap-1 font-medium">
                      <AlertCircle className="w-3 h-3 shrink-0" />
                      <span>{fleetFormErrors.plateNumber}</span>
                    </p>
                  )}
                </div>
                <div>
                  <label className="text-slate-400 block mb-1">Tipe Kendaraan</label>
                  <FleetFormDropdown
                    value={newFleet.vehicleType}
                    onChange={(val) => {
                      setNewFleet({ ...newFleet, vehicleType: val as VehicleType });
                      if (fleetFormErrors.vehicleType) setFleetFormErrors({ ...fleetFormErrors, vehicleType: '' });
                    }}
                    options={FLEET_VEHICLE_TYPE_OPTIONS}
                    placeholder="Pilih Tipe Kendaraan..."
                    hasError={Boolean(fleetFormErrors.vehicleType)}
                  />
                  {fleetFormErrors.vehicleType && (
                    <p className="text-[10px] text-rose-400 mt-1 flex items-center gap-1 font-medium">
                      <AlertCircle className="w-3 h-3 shrink-0" />
                      <span>{fleetFormErrors.vehicleType}</span>
                    </p>
                  )}
                </div>
              </div>

              <div>
                <label className="text-slate-400 block mb-1">Inisial Mobil</label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: N1 / NP1, WB-01, DS-1"
                  value={newFleet.initialCode}
                  onChange={(e) => {
                    setNewFleet({ ...newFleet, initialCode: e.target.value.toUpperCase() });
                    if (fleetFormErrors.initialCode) setFleetFormErrors({ ...fleetFormErrors, initialCode: '' });
                  }}
                  className={`w-full px-3 py-2 rounded-xl bg-slate-950 border text-white placeholder:text-slate-500/70 font-mono uppercase ${
                    fleetFormErrors.initialCode ? 'border-rose-500 ring-1 ring-rose-500' : 'border-slate-800'
                  }`}
                />
                {fleetFormErrors.initialCode && (
                  <p className="text-[10px] text-rose-400 mt-1 flex items-center gap-1 font-medium">
                    <AlertCircle className="w-3 h-3 shrink-0" />
                    <span>{fleetFormErrors.initialCode}</span>
                  </p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-400 block mb-1">Merk Mobil</label>
                  <FleetFormDropdown
                    value={newFleet.brand}
                    onChange={(brand) => {
                      setNewFleet({ ...newFleet, brand });
                      if (fleetFormErrors.brand) setFleetFormErrors({ ...fleetFormErrors, brand: '' });
                    }}
                    options={FLEET_BRAND_OPTIONS}
                    placeholder="Pilih Merk Mobil..."
                    hasError={Boolean(fleetFormErrors.brand)}
                  />
                  {fleetFormErrors.brand && (
                    <p className="text-[10px] text-rose-400 mt-1 flex items-center gap-1 font-medium">
                      <AlertCircle className="w-3 h-3 shrink-0" />
                      <span>{fleetFormErrors.brand}</span>
                    </p>
                  )}
                </div>
                <div>
                  <label className="text-slate-400 block mb-1">Kapasitas Mesin (CC)</label>
                  <input
                    type="text"
                    required
                    placeholder="Contoh: 2477 CC"
                    value={newFleet.engineCc}
                    onChange={(e) => setNewFleet({ ...newFleet, engineCc: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white placeholder:text-slate-500/70"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-400 block mb-1">Tahun Produksi</label>
                  <FleetFormDropdown
                    value={newFleet.year ? String(newFleet.year) : ''}
                    onChange={(val) => {
                      setNewFleet({ ...newFleet, year: parseInt(val, 10) || 0 });
                      if (fleetFormErrors.year) setFleetFormErrors({ ...fleetFormErrors, year: '' });
                    }}
                    options={FLEET_YEAR_OPTIONS}
                    placeholder="Pilih Tahun..."
                    searchable
                    searchPlaceholder="Cari tahun..."
                    hasError={Boolean(fleetFormErrors.year)}
                    minMenuWidth={180}
                  />
                  {fleetFormErrors.year && (
                    <p className="text-[10px] text-rose-400 mt-1 flex items-center gap-1 font-medium">
                      <AlertCircle className="w-3 h-3 shrink-0" />
                      <span>{fleetFormErrors.year}</span>
                    </p>
                  )}
                </div>
                <div>
                  <label className="text-slate-400 block mb-1 flex items-center justify-between">
                    <span>Kubikasi Luar (m³)</span>
                    <span className="text-[10px] text-cyan-400 font-medium">Otomatis P × L × T</span>
                  </label>
                  <input
                    type="text"
                    readOnly
                    placeholder="Otomatis dari P x L x T"
                    value={
                      calculateOuterCubicationFromDimensions(newFleet.boxDimensions) !== null
                        ? String(calculateOuterCubicationFromDimensions(newFleet.boxDimensions))
                        : newFleet.boxCapacityM3 > 0
                        ? String(newFleet.boxCapacityM3)
                        : ''
                    }
                    className={`w-full px-3 py-2 rounded-xl bg-slate-900/70 border text-cyan-300 placeholder:text-slate-500/70 font-mono font-bold cursor-not-allowed ${
                      fleetFormErrors.boxCapacityM3 ? 'border-rose-500 ring-1 ring-rose-500' : 'border-slate-800'
                    }`}
                  />
                  {fleetFormErrors.boxCapacityM3 && (
                    <p className="text-[10px] text-rose-400 mt-1 flex items-center gap-1 font-medium">
                      <AlertCircle className="w-3 h-3 shrink-0" />
                      <span>{fleetFormErrors.boxCapacityM3}</span>
                    </p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-400 block mb-1">Tanggal Terakhir Servis / Uji KIR</label>
                  <input
                    type="date"
                    value={newFleet.lastMaintenance}
                    onChange={(e) => setNewFleet({ ...newFleet, lastMaintenance: e.target.value })}
                    className={`w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 ${
                      newFleet.lastMaintenance ? 'text-white' : 'text-slate-500'
                    }`}
                  />
                </div>
                <div>
                  <label className="text-slate-400 block mb-1">Dimensi Box (P x L x T)</label>
                  <input
                    type="text"
                    placeholder={`Contoh: ${getDefaultBoxDimensions(newFleet.vehicleType || 'Pick Up Box', newFleet.brand || 'Mitsubishi L300')}`}
                    value={newFleet.boxDimensions || ''}
                    onChange={(e) => {
                      const nextDim = e.target.value;
                      const calcGross = calculateOuterCubicationFromDimensions(nextDim);
                      setNewFleet({
                        ...newFleet,
                        boxDimensions: nextDim,
                        boxCapacityM3: calcGross !== null ? calcGross : 0
                      });
                      if (calcGross !== null && fleetFormErrors.boxCapacityM3) {
                        setFleetFormErrors({ ...fleetFormErrors, boxCapacityM3: '' });
                      }
                    }}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white placeholder:text-slate-500/70 font-mono"
                  />
                </div>
              </div>

              {/* Pajak Kendaraan & STNK / Plat */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-400 block mb-1 flex items-center justify-between">
                    <span>Pajak (Tahunan)</span>
                    <span className="text-[10px] text-blue-400 font-medium">Jatuh Tempo</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={newFleet.taxDueDate}
                    onChange={(e) => setNewFleet({ ...newFleet, taxDueDate: e.target.value })}
                    className={`w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 ${
                      newFleet.taxDueDate ? 'text-white' : 'text-slate-500'
                    }`}
                  />
                </div>
                <div>
                  <label className="text-slate-400 block mb-1 flex items-center justify-between">
                    <span>STNK / Plat</span>
                    <span className="text-[10px] text-amber-400 font-medium">Masa Berlaku 5 Thn</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={newFleet.stnkExpiryDate}
                    onChange={(e) => setNewFleet({ ...newFleet, stnkExpiryDate: e.target.value })}
                    className={`w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 ${
                      newFleet.stnkExpiryDate ? 'text-white' : 'text-slate-500'
                    }`}
                  />
                </div>
              </div>

              {/* PIC atau Kru yang Ditugaskan (Tersaring Ketat per Cabang) */}
              <div className="bg-slate-950/70 p-3.5 rounded-xl border border-slate-800/80 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <label className="text-slate-300 font-semibold flex items-center gap-1.5 text-xs">
                    <UserCheck className="w-4 h-4 text-blue-400 shrink-0" />
                    <span>PIC / Kru yang Ditugaskan (Opsional)</span>
                  </label>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className="text-[10px] text-emerald-400 font-semibold bg-emerald-500/10 border border-emerald-500/25 px-2 py-0.5 rounded-md">
                      {selectedNewBranch?.name || 'Cabang'} · {newBranchCrews.length} Kru
                    </span>
                    {newFleetAssignedCrewId && (
                      <span className="text-[10px] text-blue-400 font-bold bg-blue-500/15 border border-blue-500/30 px-2 py-0.5 rounded-md">
                        Terpilih
                      </span>
                    )}
                  </div>
                </div>

                <FleetFormDropdown
                  value={newFleetAssignedCrewId}
                  onChange={(val) => setNewFleetAssignedCrewId(val)}
                  options={picCrewDropdownOptions}
                  placeholder={`Standby / Pool ${selectedNewBranch?.name || 'Cabang'} (Belum Ada PIC)`}
                  searchable
                  searchPlaceholder={`Cari kru Cabang ${selectedNewBranch?.name || ''}...`}
                  emptyText={`Tidak ada kru aktif pada Cabang ${selectedNewBranch?.name || 'ini'}.`}
                  minMenuWidth={280}
                />
                <p className="text-[10px] text-slate-400">
                  Menampilkan kru aktif khusus Cabang {selectedNewBranch?.name || 'terpilih'} saja agar data antar cabang tidak tercampur.
                </p>
              </div>

              </div>
                );
              })()}

              {/* Sticky Footer Daftarkan Armada */}
              <div className="p-4 border-t border-slate-800 bg-slate-950/95 shrink-0 flex items-center justify-between gap-3 shadow-lg z-10">
                <div className="text-[11px] text-slate-400 flex items-center gap-1.5 hidden sm:flex">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span>Armada baru otomatis terintegrasi ke sistem</span>
                </div>
                <div className="flex items-center gap-2 ml-auto">
                  <button
                    type="button"
                    onClick={() => setIsAddFleetOpen(false)}
                    className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs cursor-pointer transition"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white font-bold text-xs shadow-lg shadow-blue-500/25 flex items-center justify-center whitespace-nowrap cursor-pointer active:scale-95 transition"
                  >
                    <span>Daftarkan &amp; Simpan Armada</span>
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Crew Modal */}
      {isAddCrewOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl w-full max-w-lg overflow-hidden shadow-2xl">
            <div className="p-4 border-b border-slate-800 flex items-center justify-between">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Users className="w-4 h-4 text-emerald-400" />
                Tambah Anggota Kru Pengemudi
              </h3>
              <button
                onClick={() => setIsAddCrewOpen(false)}
                className="text-slate-400 hover:text-white font-bold"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleCreateCrew} className="p-5 space-y-4 text-xs">
              <div>
                <label className="text-slate-400 block mb-1">Cabang Penugasan *</label>
                <select
                  value={newCrewBranchId}
                  onChange={(e) => setNewCrewBranchId(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-emerald-400 font-bold cursor-pointer mb-3"
                >
                  {branches.map(b => (
                    <option key={b.id} value={b.id}>Cabang {b.name} ({b.city})</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-slate-400 block mb-1">Nama Lengkap Kru</label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: Joko Supriyanto"
                  value={newCrew.name}
                  onChange={(e) => {
                    setNewCrew({ ...newCrew, name: e.target.value });
                    if (crewFormErrors.name) setCrewFormErrors({ ...crewFormErrors, name: '' });
                  }}
                  className={`w-full px-3 py-2 rounded-lg bg-slate-950 border text-white ${
                    crewFormErrors.name ? 'border-rose-500 ring-1 ring-rose-500' : 'border-slate-800'
                  }`}
                />
                {crewFormErrors.name && (
                  <p className="text-[10px] text-rose-400 mt-1 flex items-center gap-1 font-medium">
                    <AlertCircle className="w-3 h-3 shrink-0" />
                    <span>{crewFormErrors.name}</span>
                  </p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-400 block mb-1">Peran Tugas</label>
                  <select
                    value={newCrew.role}
                    onChange={(e) => {
                      const newRole = e.target.value as any;
                      setNewCrew({ ...newCrew, role: newRole });
                      if (crewFormErrors.role) setCrewFormErrors({ ...crewFormErrors, role: '' });
                    }}
                    className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-white cursor-pointer"
                  >
                    <option value="Driver Utama">Driver Utama</option>
                    <option value="Driver Cadangan">Driver Cadangan</option>
                    <option value="Kernet / Helper">Kernet / Helper</option>
                  </select>
                  {crewFormErrors.role && (
                    <p className="text-[10px] text-rose-400 mt-1 flex items-center gap-1 font-medium">
                      <AlertCircle className="w-3 h-3 shrink-0" />
                      <span>{crewFormErrors.role}</span>
                    </p>
                  )}
                </div>
                <div>
                  <label className="text-slate-400 block mb-1">Jenis SIM</label>
                  <input
                    type="text"
                    value="-"
                    disabled
                    className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-800 text-slate-500 cursor-not-allowed"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-400 block mb-1">Nomor Handphone / WhatsApp</label>
                  <input
                    type="text"
                    value="-"
                    disabled
                    className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-800 text-slate-500 cursor-not-allowed"
                  />
                </div>
                <div>
                  <label className="text-slate-400 block mb-1">Nomor Registrasi SIM</label>
                  <input
                    type="text"
                    value="-"
                    disabled
                    className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-800 text-slate-500 cursor-not-allowed"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsAddCrewOpen(false)}
                  className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold shadow"
                >
                  Simpan Data Kru
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Fleet Modal */}
      {isEditFleetOpen && editingFleet && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-hidden">
          <div className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden my-auto">
            <div className="p-4 border-b border-slate-800 flex items-center justify-between shrink-0 bg-slate-900/95">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Truck className="w-4 h-4 text-blue-400" />
                Edit Armada Truk ({editingFleet.plateNumber})
              </h3>
              <button
                type="button"
                onClick={() => {
                  setIsEditFleetOpen(false);
                  setEditingFleet(null);
                }}
                className="text-slate-400 hover:text-white font-bold text-lg p-1 rounded-lg hover:bg-slate-800 transition cursor-pointer"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleUpdateFleet} className="flex flex-col flex-1 min-h-0 overflow-hidden">
              <div className="p-5 space-y-4 text-xs overflow-y-auto flex-1 overscroll-contain">
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="text-slate-400 block mb-1">Cabang Armada *</label>
                  <FleetFormDropdown
                    value={editingFleetBranchId}
                    onChange={(nextBranchId) => {
                      setEditingFleetBranchId(nextBranchId);
                      const allowedCrews = getBranchScopedCrews(nextBranchId);
                      if (editingAssignedCrewId && !allowedCrews.some(c => c.id === editingAssignedCrewId)) {
                        setEditingAssignedCrewId('');
                      }
                    }}
                    options={branches.map(b => ({
                      value: b.id,
                      label: `Cabang ${b.name} (${b.city})`,
                      sublabel: `Wilayah Operasional ${b.city}`,
                      Icon: Building2,
                      iconTone: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                    }))}
                    placeholder="Pilih Cabang Armada..."
                    accent="emerald"
                  />
                </div>
                <div>
                  <label className="text-slate-400 block mb-1">Nomor Polisi (Plat)</label>
                  <input
                    type="text"
                    required
                    placeholder="Contoh: B 9503 XYZ"
                    value={editingFleet.plateNumber}
                    onChange={(e) => {
                      setEditingFleet({ ...editingFleet, plateNumber: e.target.value.toUpperCase() });
                      if (fleetFormErrors.plateNumber) setFleetFormErrors({ ...fleetFormErrors, plateNumber: '' });
                    }}
                    className={`w-full px-3 py-2 rounded-xl bg-slate-950 border text-white font-mono uppercase ${
                      fleetFormErrors.plateNumber ? 'border-rose-500 ring-1 ring-rose-500' : 'border-slate-800'
                    }`}
                  />
                  {fleetFormErrors.plateNumber && (
                    <p className="text-[10px] text-rose-400 mt-1 flex items-center gap-1 font-medium">
                      <AlertCircle className="w-3 h-3 shrink-0" />
                      <span>{fleetFormErrors.plateNumber}</span>
                    </p>
                  )}
                </div>
                <div>
                  <label className="text-slate-400 block mb-1">Tipe Kendaraan</label>
                  <FleetFormDropdown
                    value={editingFleet.vehicleType}
                    onChange={(val) => {
                      const vType = val as VehicleType;
                      const nextDim = getDefaultBoxDimensions(vType, editingFleet.brand);
                      const nextGross =
                        calculateOuterCubicationFromDimensions(nextDim) ??
                        getDefaultBoxCapacityM3(vType, editingFleet.brand);
                      const mul = editingFleet.boxInnerMultiplierPercent !== undefined ? editingFleet.boxInnerMultiplierPercent : 90;
                      setEditingFleet({
                        ...editingFleet,
                        vehicleType: vType,
                        boxDimensions: nextDim,
                        boxCapacityM3: nextGross,
                        boxInnerCapacityM3: Number((nextGross * (mul / 100)).toFixed(2))
                      });
                    }}
                    options={FLEET_VEHICLE_TYPE_OPTIONS}
                    placeholder="Pilih Tipe Kendaraan..."
                  />
                </div>
              </div>

              <div>
                <label className="text-slate-400 block mb-1">Inisial Mobil</label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: N1 / NP1, WB-01, DS-1"
                  value={editingFleet.initialCode || ''}
                  onChange={(e) => {
                    setEditingFleet({ ...editingFleet, initialCode: e.target.value.toUpperCase() });
                    if (fleetFormErrors.initialCode) setFleetFormErrors({ ...fleetFormErrors, initialCode: '' });
                  }}
                  className={`w-full px-3 py-2 rounded-lg bg-slate-950 border text-white font-mono uppercase ${
                    fleetFormErrors.initialCode ? 'border-rose-500 ring-1 ring-rose-500' : 'border-slate-800'
                  }`}
                />
                {fleetFormErrors.initialCode && (
                  <p className="text-[10px] text-rose-400 mt-1 flex items-center gap-1 font-medium">
                    <AlertCircle className="w-3 h-3 shrink-0" />
                    <span>{fleetFormErrors.initialCode}</span>
                  </p>
                )}
              </div>

              {/* Status Kondisi Armada (Ready / Kirim / Servis) */}
              <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 space-y-2">
                <label className="text-slate-200 font-bold block text-xs">
                  Status Kondisi Armada (Terintegrasi Jadwal &amp; Portal)
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { value: 'available', label: 'Ready', desc: 'Siap jadwal esok', dot: 'bg-emerald-500', activeBg: 'bg-emerald-500/15 border-emerald-500 text-emerald-300' },
                    { value: 'on-duty', label: 'Kirim', desc: 'Sedang pengiriman', dot: 'bg-blue-500', activeBg: 'bg-blue-500/15 border-blue-500 text-blue-300' },
                    { value: 'maintenance', label: 'Servis', desc: 'Perbaikan (Kunci)', dot: 'bg-rose-500', activeBg: 'bg-rose-500/15 border-rose-500 text-rose-300' }
                  ].map(opt => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setEditingFleet({ ...editingFleet, status: opt.value as FleetStatus })}
                      className={`p-2.5 rounded-xl border text-left transition cursor-pointer ${
                        editingFleet.status === opt.value
                          ? opt.activeBg
                          : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-center gap-2 font-bold text-xs">
                        <span className={`w-3 h-3 rounded-full shrink-0 ${opt.dot}`} />
                        <span>{opt.label}</span>
                      </div>
                      <div className="text-[10px] opacity-80 mt-0.5">{opt.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-400 block mb-1">Merk Mobil</label>
                  <FleetFormDropdown
                    value={editingFleet.brand || 'Mitsubishi L300'}
                    onChange={(brand) => {
                      const nextDim = getDefaultBoxDimensions(editingFleet.vehicleType, brand);
                      const nextGross =
                        calculateOuterCubicationFromDimensions(nextDim) ??
                        getDefaultBoxCapacityM3(editingFleet.vehicleType, brand);
                      const mul = editingFleet.boxInnerMultiplierPercent !== undefined ? editingFleet.boxInnerMultiplierPercent : 90;
                      setEditingFleet({
                        ...editingFleet,
                        brand,
                        boxDimensions: nextDim,
                        boxCapacityM3: nextGross,
                        boxInnerCapacityM3: Number((nextGross * (mul / 100)).toFixed(2))
                      });
                    }}
                    options={FLEET_BRAND_OPTIONS}
                    placeholder="Pilih Merk Mobil..."
                  />
                </div>
                <div>
                  <label className="text-slate-400 block mb-1">Kapasitas Mesin (CC)</label>
                  <input
                    type="text"
                    placeholder="Contoh: 2477 CC"
                    value={editingFleet.engineCc || ''}
                    onChange={(e) => setEditingFleet({ ...editingFleet, engineCc: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-400 block mb-1">Tahun Produksi</label>
                  <FleetFormDropdown
                    value={String(editingFleet.year || new Date().getFullYear())}
                    onChange={(val) => setEditingFleet({ ...editingFleet, year: parseInt(val, 10) })}
                    options={FLEET_YEAR_OPTIONS}
                    placeholder="Pilih Tahun..."
                    searchable
                    searchPlaceholder="Cari tahun..."
                    minMenuWidth={180}
                  />
                </div>
                <div>
                  <label className="text-slate-400 block mb-1 flex items-center justify-between">
                    <span>Tanggal Terakhir Servis / Uji KIR</span>
                    <span className="text-[10px] text-teal-400 font-medium">Jatuh Tempo KIR</span>
                  </label>
                  <input
                    type="date"
                    value={editingFleet.lastMaintenance || editingFleet.kirExpiryDate || ''}
                    onChange={(e) =>
                      setEditingFleet({
                        ...editingFleet,
                        lastMaintenance: e.target.value,
                        kirExpiryDate: e.target.value
                      })
                    }
                    className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-white font-mono"
                  />
                  {(editingFleet.lastMaintenance || editingFleet.kirExpiryDate) && (
                    <div className="text-[10px] text-teal-400 mt-1 font-medium flex items-center justify-between">
                      <span>{formatIndoDate(editingFleet.lastMaintenance || editingFleet.kirExpiryDate)}</span>
                      <span className={getExpiryStatus(editingFleet.lastMaintenance || editingFleet.kirExpiryDate).isExpired ? 'text-rose-500 font-bold' : ''}>
                        {getExpiryStatus(editingFleet.lastMaintenance || editingFleet.kirExpiryDate).label}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* 📦 KOTAK DIMENSI BOX: Luar vs Pengali Dimensi Dalam (...%) */}
              <div className="p-3.5 bg-slate-950/90 rounded-xl border border-cyan-500/35 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-cyan-300 text-xs flex items-center gap-1.5">
                    <Box className="w-4 h-4 text-cyan-400" />
                    <span>Dimensi Box Truk: Luar vs Pengali Dimensi Dalam</span>
                  </span>
                  <span className="text-[10px] text-slate-400">
                    Beda Tebal Dinding
                  </span>
                </div>

                {(() => {
                  const computedGrossFromDim = calculateOuterCubicationFromDimensions(editingFleet.boxDimensions);
                  const activeGrossM3 =
                    computedGrossFromDim !== null
                      ? computedGrossFromDim
                      : editingFleet.boxCapacityM3 !== undefined
                      ? editingFleet.boxCapacityM3
                      : getFleetBoxCapacity(editingFleet);
                  const activeMul =
                    editingFleet.boxInnerMultiplierPercent !== undefined
                      ? editingFleet.boxInnerMultiplierPercent
                      : 90;
                  const activeInnerM3 = Number((activeGrossM3 * (activeMul / 100)).toFixed(2));

                  return (
                    <>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="text-slate-400 block mb-1">Dimensi Box Luar (P x L x T)</label>
                          <input
                            type="text"
                            placeholder="Contoh: 5,9 x 1,9 x 2,09"
                            value={editingFleet.boxDimensions || ''}
                            onChange={(e) => {
                              const nextDim = e.target.value;
                              const nextGross = calculateOuterCubicationFromDimensions(nextDim);
                              setEditingFleet({
                                ...editingFleet,
                                boxDimensions: nextDim,
                                boxCapacityM3: nextGross !== null ? nextGross : 0,
                                boxInnerCapacityM3:
                                  nextGross !== null
                                    ? Number((nextGross * (activeMul / 100)).toFixed(2))
                                    : 0
                              });
                            }}
                            className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-white font-mono text-xs"
                          />
                        </div>
                        <div>
                          <label className="text-slate-400 block mb-1 flex items-center justify-between">
                            <span>Kubikasi Luar (m³)</span>
                            <span className="text-[10px] text-cyan-400 font-medium">Otomatis P × L × T</span>
                          </label>
                          <input
                            type="text"
                            readOnly
                            value={computedGrossFromDim !== null ? String(computedGrossFromDim) : activeGrossM3 > 0 ? String(activeGrossM3) : '0'}
                            title="Dihitung otomatis dari perkalian Dimensi Box Luar (P × L × T)"
                            className="w-full px-3 py-2 rounded-lg bg-slate-900/70 border border-slate-700/80 text-cyan-300 font-mono font-bold text-xs cursor-not-allowed"
                          />
                        </div>
                      </div>

                      {/* Pengali Dimensi Dalam Box (... %) */}
                      <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-800">
                        <div>
                          <label className="text-cyan-300 font-bold block mb-1 flex items-center justify-between text-xs">
                            <span>Faktor Pengali Dimensi Dalam</span>
                            <span className="text-amber-400 font-mono font-black">{activeMul}%</span>
                          </label>
                          <div className="flex items-center gap-2">
                            <input
                              type="number"
                              min="50"
                              max="100"
                              step="1"
                              required
                              value={activeMul}
                              onChange={(e) => {
                                const mul = parseInt(e.target.value) || 90;
                                setEditingFleet({
                                  ...editingFleet,
                                  boxCapacityM3: activeGrossM3,
                                  boxInnerMultiplierPercent: mul,
                                  boxInnerCapacityM3: Number((activeGrossM3 * (mul / 100)).toFixed(2))
                                });
                              }}
                              className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-cyan-500/50 text-amber-300 font-mono font-black text-xs"
                              placeholder="90"
                            />
                            <span className="text-xs font-bold text-slate-400">%</span>
                          </div>
                          <span className="text-[10px] text-slate-500 mt-1 block">
                            Dimensi box dikali {activeMul}% karena tebal dinding luar &amp; dalam berbeda.
                          </span>
                        </div>

                        <div className="bg-cyan-950/40 p-2.5 rounded-lg border border-cyan-500/40 flex flex-col justify-between">
                          <span className="text-[10px] font-bold text-cyan-300">
                            Hasil Kubikasi Dalam (Netto):
                          </span>
                          <div className="text-lg font-black text-white font-mono">
                            {activeInnerM3} <span className="text-xs text-cyan-400">m³</span>
                          </div>
                          <span className="text-[10px] text-emerald-400 font-medium">
                            ✓ Kapasitas bersih efektif muat
                          </span>
                        </div>
                      </div>
                    </>
                  );
                })()}
              </div>

              {/* 📑 BUKTI FILE DOKUMEN KIR PADA SETIAP ARMADA */}
              <div className="p-3.5 bg-slate-950/90 rounded-xl border border-teal-500/35 space-y-2.5">
                <div className="flex items-center justify-between">
                  <label className="font-bold text-teal-300 text-xs flex items-center gap-1.5">
                    <FileText className="w-4 h-4 text-teal-400" />
                    <span>Bukti File Dokumen KIR Dishub</span>
                  </label>
                  <span className="text-[10px] text-slate-400">
                    Cek Benar / Legalitas Armada
                  </span>
                </div>

                {editingFleet.kirDocUrl ? (
                  <div className="flex items-center justify-between p-2.5 rounded-lg bg-slate-900 border border-slate-800">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <img
                        src={editingFleet.kirDocUrl}
                        alt="Thumbnail KIR"
                        className="w-10 h-10 object-cover rounded border border-slate-700 shrink-0"
                      />
                      <div className="min-w-0">
                        <span className="font-bold text-white text-xs block truncate">
                          {editingFleet.kirDocFileName || 'Dokumen_KIR_Dishub.jpg'}
                        </span>
                        <span className="text-[10px] text-emerald-400 font-medium">
                          ✓ File KIR terlampir resmi
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => setSelectedKirDocFleet(editingFleet)}
                        className="px-2 py-1 rounded text-[10px] font-bold bg-cyan-600/20 text-cyan-300 hover:bg-cyan-600/30 border border-cyan-500/40 cursor-pointer"
                      >
                        Pratinjau
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingFleet({ ...editingFleet, kirDocUrl: '', kirDocFileName: '' })}
                        className="px-2 py-1 rounded text-[10px] font-bold bg-rose-500/20 text-rose-300 hover:bg-rose-500/30 border border-rose-500/40 cursor-pointer"
                      >
                        Hapus
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <input
                      type="file"
                      accept="image/*,.pdf"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          const reader = new FileReader();
                          reader.onload = (ev) => {
                            setEditingFleet({
                              ...editingFleet,
                              kirDocUrl: ev.target?.result as string,
                              kirDocFileName: file.name,
                              kirDocUploadedAt: new Date().toISOString()
                            });
                          };
                          reader.readAsDataURL(file);
                        }
                      }}
                      className="w-full text-xs text-slate-400 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-bold file:bg-teal-600 file:text-white hover:file:bg-teal-500 cursor-pointer"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        setEditingFleet({
                          ...editingFleet,
                          kirDocUrl: 'https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?w=800&auto=format&fit=crop&q=80',
                          kirDocFileName: `Buku_Uji_KIR_Dishub_${editingFleet.plateNumber.replace(/\s+/g, '_')}.jpg`,
                          kirDocUploadedAt: new Date().toISOString()
                        });
                      }}
                      className="text-[10px] text-teal-400 hover:text-teal-300 underline font-medium cursor-pointer block"
                    >
                      + Gunakan Contoh Sampel File KIR Resmi Dishub
                    </button>
                  </div>
                )}
              </div>

              {/* Pajak Kendaraan & STNK / Plat */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-400 block mb-1 flex items-center justify-between">
                    <span>Pajak (Tahunan)</span>
                    <span className="text-[10px] text-blue-400 font-medium">Jatuh Tempo</span>
                  </label>
                  <input
                    type="date"
                    value={editingFleet.taxDueDate || ''}
                    onChange={(e) => setEditingFleet({ ...editingFleet, taxDueDate: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-white font-mono"
                  />
                  {editingFleet.taxDueDate && (
                    <div className="text-[10px] text-blue-400 mt-1 font-medium flex items-center justify-between">
                      <span>{formatIndoDate(editingFleet.taxDueDate)}</span>
                      <span className={getExpiryStatus(editingFleet.taxDueDate).isExpired ? 'text-rose-500 font-bold' : ''}>
                        {getExpiryStatus(editingFleet.taxDueDate).label}
                      </span>
                    </div>
                  )}
                </div>
                <div>
                  <label className="text-slate-400 block mb-1 flex items-center justify-between">
                    <span>STNK / Plat</span>
                    <span className="text-[10px] text-amber-400 font-medium">Masa Berlaku 5 Thn</span>
                  </label>
                  <input
                    type="date"
                    value={editingFleet.stnkExpiryDate || ''}
                    onChange={(e) => setEditingFleet({ ...editingFleet, stnkExpiryDate: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-white font-mono"
                  />
                  {editingFleet.stnkExpiryDate && (
                    <div className="text-[10px] text-amber-400 mt-1 font-medium flex items-center justify-between">
                      <span>{formatIndoDate(editingFleet.stnkExpiryDate)}</span>
                      <span className={getExpiryStatus(editingFleet.stnkExpiryDate).isExpired ? 'text-rose-500 font-bold' : ''}>
                        {getExpiryStatus(editingFleet.stnkExpiryDate).label}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* PIC atau Kru yang Ditugaskan (Tersaring Ketat per Cabang) */}
              {(() => {
                const selectedEditBranch = branches.find(b => b.id === editingFleetBranchId) || branches[0];
                const editBranchCrews = getBranchScopedCrews(editingFleetBranchId);
                const editPicOptions: FleetDropdownOption[] = [
                  {
                    value: '',
                    label: `Standby / Pool ${selectedEditBranch?.name || 'Cabang'} (Belum Ada PIC)`,
                    sublabel: 'Belum ditugaskan ke kru tertentu',
                    dotClass: 'bg-slate-400'
                  },
                  ...editBranchCrews.map(c => {
                    const isCurrentThis = c.currentFleetId === editingFleet.id || c.id === editingFleet.driverId;
                    const isOtherFleet = c.currentFleetId && c.currentFleetId !== editingFleet.id;
                    const otherFleetObj = isOtherFleet ? fleets.find(f => f.id === c.currentFleetId) : null;
                    return {
                      value: c.id,
                      label: c.name,
                      sublabel: isCurrentThis
                        ? 'PIC armada saat ini'
                        : otherFleetObj
                        ? `Aktif di ${otherFleetObj.initialCode || otherFleetObj.plateNumber}`
                        : `Cabang ${selectedEditBranch?.name || ''}`,
                      dotClass: isCurrentThis
                        ? 'bg-blue-400'
                        : otherFleetObj
                        ? 'bg-amber-400'
                        : 'bg-emerald-400',
                      badge: isCurrentThis
                        ? 'PIC Saat Ini'
                        : otherFleetObj
                        ? (otherFleetObj.initialCode || otherFleetObj.plateNumber)
                        : undefined,
                      badgeTone: isCurrentThis
                        ? 'bg-blue-500/15 text-blue-400 border-blue-500/30'
                        : 'bg-amber-500/15 text-amber-400 border-amber-500/30'
                    };
                  })
                ];
                return (
              <div className="bg-slate-950/75 p-3.5 rounded-xl border border-slate-800/80 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <label className="text-slate-200 font-bold flex items-center gap-2 text-xs">
                    <UserCheck className="w-4 h-4 text-blue-400 shrink-0" />
                    <span>PIC / Kru yang Ditugaskan</span>
                  </label>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/25">
                      {selectedEditBranch?.name || 'Cabang'} · {editBranchCrews.length} Kru
                    </span>
                    {editingAssignedCrewId ? (
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-blue-500/15 text-blue-400 border border-blue-500/30">
                        Terkait Aktif
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-slate-800 text-slate-400 border border-slate-700">
                        Standby / Pool
                      </span>
                    )}
                  </div>
                </div>

                <FleetFormDropdown
                  value={editingAssignedCrewId}
                  onChange={(val) => setEditingAssignedCrewId(val)}
                  options={editPicOptions}
                  placeholder={`Standby / Pool ${selectedEditBranch?.name || 'Cabang'} (Belum Ada PIC)`}
                  searchable
                  searchPlaceholder={`Cari kru Cabang ${selectedEditBranch?.name || ''}...`}
                  emptyText={`Tidak ada kru aktif pada Cabang ${selectedEditBranch?.name || 'ini'}.`}
                  minMenuWidth={280}
                />

                {editingAssignedCrewId ? (() => {
                  const selCrew = crews.find(c => c.id === editingAssignedCrewId);
                  if (!selCrew) return null;
                  return (
                    <div className="flex items-center justify-between text-[11px] bg-slate-900/80 p-2.5 rounded-lg border border-slate-800 text-slate-300">
                      <div className="flex items-center gap-2">
                        <Phone className="w-3.5 h-3.5 text-blue-400" />
                        <span>{selCrew.phone || '-'}</span>
                        <span className="text-slate-600">&bull;</span>
                        <span className="text-emerald-400 font-semibold">{selCrew.licenseType}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-slate-400">{selCrew.tripsCompleted || 0} rit sukses</span>
                        <div className="flex items-center gap-1 text-amber-400 font-bold text-[10px]">
                          <Award className="w-3 h-3" />
                          <span>{selCrew.rating.toFixed(1)} / 5.0</span>
                        </div>
                      </div>
                    </div>
                  );
                })() : (
                  <p className="text-[10px] text-slate-400">
                    Menampilkan kru aktif khusus Cabang {selectedEditBranch?.name || 'terpilih'} saja agar data antar cabang tidak tercampur.
                  </p>
                )}
              </div>
                );
              })()}

              </div>

              {/* Sticky Footer Simpan Perubahan */}
              <div className="p-4 border-t border-slate-800 bg-slate-950/95 shrink-0 flex items-center justify-end gap-3 shadow-lg z-10">
                <div className="flex items-center gap-2 ml-auto">
                  <button
                    type="button"
                    disabled={isSavingFleet}
                    onClick={() => {
                      setIsEditFleetOpen(false);
                      setEditingFleet(null);
                    }}
                    className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs cursor-pointer transition disabled:opacity-50"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    disabled={isSavingFleet}
                    className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 via-blue-500 to-emerald-600 hover:from-blue-500 hover:to-emerald-500 text-white font-bold text-xs shadow-lg shadow-blue-500/25 flex items-center gap-2 cursor-pointer active:scale-95 transition disabled:opacity-50"
                  >
                    {isSavingFleet ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin text-white" />
                        <span>Menyimpan...</span>
                      </>
                    ) : (
                      <>
                        <Save className="w-4 h-4" />
                        <span>Simpan Perubahan Armada</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Crew Modal */}
      {isEditCrewOpen && editingCrew && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl w-full max-w-lg overflow-hidden shadow-2xl">
            <div className="p-4 border-b border-slate-800 flex items-center justify-between">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Users className="w-4 h-4 text-emerald-400" />
                Edit Data Kru ({editingCrew.name})
              </h3>
              <button
                onClick={() => {
                  setIsEditCrewOpen(false);
                  setEditingCrew(null);
                }}
                className="text-slate-400 hover:text-white font-bold text-lg cursor-pointer"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleUpdateCrew} className="p-5 space-y-4 text-xs">
              <div>
                <label className="text-slate-400 block mb-1.5 font-medium">Cabang Penugasan *</label>
                <FleetFormDropdown
                  accent="emerald"
                  value={editingCrewBranchId}
                  onChange={(val) => setEditingCrewBranchId(val)}
                  options={branches.map(b => ({
                    value: b.id,
                    label: `Cabang ${b.name.replace(/^Cabang\s+/i, '')}`,
                    sublabel: b.city ? `Wilayah Operasional ${b.city}` : undefined,
                    Icon: Building2,
                    iconTone: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                  }))}
                />
              </div>

              <div>
                <label className="text-slate-400 block mb-1.5 font-medium">Nama Lengkap Kru</label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: Joko Supriyanto"
                  value={editingCrew.name}
                  onChange={(e) => setEditingCrew({ ...editingCrew, name: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white focus:outline-hidden focus:border-blue-500"
                />
              </div>

              <div>
                <label className="text-slate-400 block mb-1.5 font-medium">Peran Tugas</label>
                <FleetFormDropdown
                  value={normalizeCrewRoleLabel(editingCrew.role)}
                  onChange={(val) => setEditingCrew({ ...editingCrew, role: val as any })}
                  options={[
                    {
                      value: 'Driver',
                      label: 'Driver',
                      sublabel: 'Pengemudi armada pengiriman',
                      dotClass: 'bg-blue-400'
                    },
                    {
                      value: 'Helper',
                      label: 'Helper',
                      sublabel: 'Pendamping pengemudi & bongkar muat',
                      dotClass: 'bg-amber-400'
                    }
                  ]}
                />
              </div>

              <div>
                <label className="text-slate-400 block mb-1.5 font-medium">SIM (Surat Izin Mengemudi)</label>
                <FleetFormDropdown
                  value={normalizeSimTypeLabel(editingCrew.licenseType || editingCrew.licenseNumber)}
                  onChange={(val) =>
                    setEditingCrew({
                      ...editingCrew,
                      licenseType: val,
                      licenseNumber: val
                    })
                  }
                  options={[
                    {
                      value: 'SIM A',
                      label: 'SIM A',
                      sublabel: 'Kendaraan operasional & Pick Up Box',
                      Icon: CreditCard,
                      iconTone: 'bg-blue-500/15 text-blue-400 border-blue-500/30'
                    },
                    {
                      value: 'SIM B',
                      label: 'SIM B',
                      sublabel: 'Kendaraan angkutan barang & truk',
                      Icon: CreditCard,
                      iconTone: 'bg-indigo-500/15 text-indigo-400 border-indigo-500/30'
                    },
                    {
                      value: 'SIM B1',
                      label: 'SIM B1',
                      sublabel: 'Truk Engkel & Double Box (JBB > 3.500 kg)',
                      Icon: CreditCard,
                      iconTone: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                    }
                  ]}
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => {
                    setIsEditCrewOpen(false);
                    setEditingCrew(null);
                  }}
                  className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold shadow cursor-pointer"
                >
                  Simpan Perubahan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Pop-up Warning Konfirmasi Hapus Kru Supir & Helper */}
      {crewToDelete && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150"
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-delete-crew-title"
        >
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl">
            {/* Header Dialog */}
            <div className="p-5 border-b border-slate-800/80 bg-slate-950/50 flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-rose-500/20 border border-rose-500/30 flex items-center justify-center text-rose-400 shrink-0">
                  <AlertTriangle className="w-5 h-5 text-rose-400" />
                </div>
                <div>
                  <h3 id="modal-delete-crew-title" className="text-base font-bold text-white">
                    Konfirmasi Hapus Kru
                  </h3>
                  <p className="text-xs text-slate-400">
                    Penghapusan data Supir & Kernet / Helper
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setCrewToDelete(null)}
                className="text-slate-400 hover:text-white rounded-lg p-1.5 hover:bg-slate-800 transition cursor-pointer text-base leading-none"
                aria-label="Tutup"
              >
                &times;
              </button>
            </div>

            {/* Content Body */}
            <div className="p-5 space-y-4">
              {/* Warning Notice Box */}
              <div className="bg-rose-500/10 border border-rose-500/25 rounded-xl p-3.5 flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
                <div className="text-xs space-y-1">
                  <p className="font-bold text-rose-300">
                    Yakin ingin menghapus kru ini?
                  </p>
                  <p className="text-slate-300 leading-relaxed">
                    Data kru supir/helper akan dihapus secara permanen dari sistem operasional armada PT Anugrah Kemasan Kreatif.
                  </p>
                </div>
              </div>

              {/* Kru Details Card */}
              <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-4 space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-blue-400 font-bold text-base shrink-0">
                    {crewToDelete.name.substring(0, 2).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="text-sm font-bold text-white truncate">{crewToDelete.name}</h4>
                      <span className={`px-2 py-0.5 rounded-md text-[10px] font-semibold border ${
                        crewToDelete.role === 'Driver Utama'
                          ? 'bg-blue-500/15 text-blue-400 border-blue-500/30'
                          : crewToDelete.role === 'Driver Cadangan'
                          ? 'bg-purple-500/15 text-purple-400 border-purple-500/30'
                          : 'bg-amber-500/15 text-amber-400 border-amber-500/30'
                      }`}>
                        {crewToDelete.role}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5 flex items-center gap-1.5">
                      <Phone className="w-3 h-3 text-slate-500" />
                      <span>{crewToDelete.phone}</span>
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-800/80 text-xs">
                  <div className="bg-slate-900/80 p-2.5 rounded-lg border border-slate-800">
                    <span className="text-slate-400 text-[10px] block">Sertifikasi SIM</span>
                    <span className="font-semibold text-emerald-400 text-xs mt-0.5 block">{crewToDelete.licenseType}</span>
                    <span className="text-[10px] text-slate-500 font-mono mt-0.5 block truncate">{crewToDelete.licenseNumber}</span>
                  </div>
                  <div className="bg-slate-900/80 p-2.5 rounded-lg border border-slate-800">
                    <span className="text-slate-400 text-[10px] block">Total Penugasan</span>
                    <span className="font-semibold text-white text-xs mt-0.5 block">{crewToDelete.tripsCompleted} Trip Sukses</span>
                    <span className="text-[10px] text-amber-400 font-semibold mt-0.5 block">★ {crewToDelete.rating.toFixed(1)} / 5.0</span>
                  </div>
                </div>

                {crewToDelete.status === 'on-duty' ? (
                  <div className="p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/25 text-amber-300 text-xs flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                    <span><strong>Perhatian:</strong> Kru saat ini tercatat <strong>Sedang Jalan</strong>. Pastikan tugas armada telah dialihkan sebelum dihapus.</span>
                  </div>
                ) : (
                  <div className="px-3 py-1.5 rounded-lg bg-slate-900/60 border border-slate-800 text-[11px] text-slate-400 flex items-center justify-between">
                    <span>Status Operasional:</span>
                    <span className="font-semibold text-slate-300">
                      {crewToDelete.status === 'available' ? '● Ready / Siap Jalan' : '○ Libur / Off'}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Footer Buttons */}
            <div className="p-4 bg-slate-950/60 border-t border-slate-800 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setCrewToDelete(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-300 hover:text-white text-xs font-semibold transition cursor-pointer"
              >
                Tidak, Batal
              </button>
              <button
                type="button"
                autoFocus
                onClick={handleConfirmDeleteCrew}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold shadow-lg shadow-rose-600/20 flex items-center gap-1.5 transition cursor-pointer active:scale-95 ring-2 ring-rose-500/50"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Ya, Hapus Kru</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Pop-up Warning Konfirmasi Hapus Armada Kendaraan */}
      {fleetToDelete && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150"
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-delete-fleet-title"
        >
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl">
            <div className="p-5 border-b border-slate-800/80 bg-slate-950/50 flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-rose-500/20 border border-rose-500/30 flex items-center justify-center text-rose-400 shrink-0">
                  <AlertTriangle className="w-5 h-5 text-rose-400" />
                </div>
                <div>
                  <h3 id="modal-delete-fleet-title" className="text-base font-bold text-white">
                    Konfirmasi Hapus Armada
                  </h3>
                  <p className="text-xs text-slate-400">
                    Penghapusan unit kendaraan logistik
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setFleetToDelete(null)}
                className="text-slate-400 hover:text-white rounded-lg p-1.5 hover:bg-slate-800 transition cursor-pointer text-base leading-none"
                aria-label="Tutup"
              >
                &times;
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div className="bg-rose-500/10 border border-rose-500/25 rounded-xl p-3.5 flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
                <div className="text-xs space-y-1">
                  <p className="font-bold text-rose-300">
                    Yakin ingin menghapus armada ini?
                  </p>
                  <p className="text-slate-300 leading-relaxed">
                    Unit kendaraan logistik ini akan dihapus dari daftar operasional aktif PT Anugrah Kemasan Kreatif.
                  </p>
                </div>
              </div>

              <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-4 space-y-2.5">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase tracking-wider block">Nomor Polisi</span>
                    <h4 className="text-lg font-black text-white font-mono tracking-wider">{fleetToDelete.plateNumber}</h4>
                  </div>
                  <span className="px-2.5 py-1 rounded-md text-xs font-semibold bg-blue-500/15 text-blue-400 border border-blue-500/30">
                    {fleetToDelete.vehicleType}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs pt-2 border-t border-slate-800/80">
                  <div className="bg-slate-900/60 p-2 rounded-lg border border-slate-800 text-[11px]">
                    <span className="text-slate-400 text-[10px] block">Inisial Unit</span>
                    <span className="font-bold text-white">{fleetToDelete.initialCode || '-'}</span>
                  </div>
                  <div className="bg-slate-900/60 p-2 rounded-lg border border-slate-800 text-[11px]">
                    <span className="text-slate-400 text-[10px] block">Merk / Tipe</span>
                    <span className="font-bold text-white">{fleetToDelete.brand || '-'}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="p-4 bg-slate-950/60 border-t border-slate-800 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setFleetToDelete(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-300 hover:text-white text-xs font-semibold transition cursor-pointer"
              >
                Tidak, Batal
              </button>
              <button
                type="button"
                autoFocus
                onClick={handleConfirmDeleteFleet}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold shadow-lg shadow-rose-600/20 flex items-center gap-1.5 transition cursor-pointer active:scale-95 ring-2 ring-rose-500/50"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Ya, Hapus Armada</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
