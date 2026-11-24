import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  KeyRound,
  CheckCircle2,
  AlertTriangle,
  Clock,
  ShieldCheck,
  MapPin,
  X,
  Check,
  Delete,
  Lock,
  RefreshCw,
  Truck,
  UserCheck,
  Users,
  Search,
  ChevronDown
} from 'lucide-react';
import { Crew, DriverShiftCheckin, Fleet } from '../types';
import { driverShiftService } from '../services/driverShiftService';
import { useToast } from '../context/ToastContext';
import { getOfficialAreasForBranch } from '../utils/areaNormalizer';
import { logisticsStore } from '../services/store';
import { branchStore } from '../services/branchStore';

interface ComboboxOption {
  value: string;
  label: string;
  sublabel?: string;
  badge?: string;
  badgeTone?: 'emerald' | 'rose' | 'amber' | 'cyan' | 'slate';
  disabled?: boolean;
  searchText: string;
}

interface SearchableComboboxProps {
  id: string;
  isOpen: boolean;
  onToggle: () => void;
  onClose: () => void;
  value: string;
  placeholder: string;
  searchPlaceholder: string;
  options: ComboboxOption[];
  onChange: (value: string) => void;
  emptyText?: string;
  accentColor?: 'amber' | 'emerald' | 'cyan';
}

const SearchableCombobox: React.FC<SearchableComboboxProps> = ({
  id,
  isOpen,
  onToggle,
  onClose,
  value,
  placeholder,
  searchPlaceholder,
  options,
  onChange,
  emptyText = 'Data tidak ditemukan.',
  accentColor = 'amber'
}) => {
  const [query, setQuery] = useState<string>('');
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setTimeout(() => inputRef.current?.focus(), 40);
    }
  }, [isOpen]);

  const selectedOption = useMemo(
    () => options.find(o => o.value === value) || null,
    [options, value]
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter(o => o.searchText.toLowerCase().includes(q));
  }, [options, query]);

  const ringClass =
    accentColor === 'emerald'
      ? 'border-emerald-500/80 ring-2 ring-emerald-500/20'
      : accentColor === 'cyan'
      ? 'border-cyan-500/80 ring-2 ring-cyan-500/20'
      : 'border-amber-500/80 ring-2 ring-amber-500/20';

  const badgeToneClass = (tone?: ComboboxOption['badgeTone']) => {
    switch (tone) {
      case 'emerald':
        return 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40';
      case 'rose':
        return 'bg-rose-500/20 text-rose-300 border-rose-500/40';
      case 'amber':
        return 'bg-amber-500/20 text-amber-300 border-amber-500/40';
      case 'cyan':
        return 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40';
      default:
        return 'bg-slate-800 text-slate-300 border-slate-700';
    }
  };

  return (
    <div className="relative">
      <button
        id={id}
        type="button"
        onClick={onToggle}
        aria-expanded={isOpen}
        className={`w-full min-h-[44px] px-3 py-2.5 rounded-xl bg-slate-900 border text-left flex items-center justify-between gap-2 transition cursor-pointer ${
          isOpen ? ringClass : 'border-slate-700 hover:border-slate-500'
        }`}
      >
        <div className="min-w-0 flex-1 flex items-center gap-2 flex-wrap">
          {selectedOption ? (
            <>
              <span className="text-xs font-bold text-white truncate">{selectedOption.label}</span>
              {selectedOption.sublabel && (
                <span className="text-[11px] text-slate-400 truncate">{selectedOption.sublabel}</span>
              )}
              {selectedOption.badge && (
                <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold border shrink-0 ${badgeToneClass(selectedOption.badgeTone)}`}>
                  {selectedOption.badge}
                </span>
              )}
            </>
          ) : (
            <span className="text-xs text-slate-400">{placeholder}</span>
          )}
        </div>
        <ChevronDown className={`w-4 h-4 text-slate-400 shrink-0 transition-transform ${isOpen ? 'rotate-180 text-amber-400' : ''}`} />
      </button>

      {isOpen && (
        <div className="mt-1.5 rounded-xl bg-slate-900 border border-slate-700 shadow-2xl overflow-hidden z-40">
          <div className="p-2 bg-slate-950 border-b border-slate-800">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    const firstEnabled = filtered.find(o => !o.disabled);
                    if (firstEnabled) {
                      onChange(firstEnabled.value);
                      onClose();
                    }
                  } else if (e.key === 'Escape') {
                    e.preventDefault();
                    onClose();
                  }
                }}
                placeholder={searchPlaceholder}
                className="w-full min-h-[38px] pl-8 pr-7 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
              />
              {query && (
                <button
                  type="button"
                  onClick={() => setQuery('')}
                  aria-label="Hapus pencarian"
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          <div className="max-h-52 overflow-y-auto divide-y divide-slate-800/80">
            {filtered.length === 0 ? (
              <div className="p-4 text-center text-[11px] text-slate-400">{emptyText}</div>
            ) : (
              filtered.map(opt => {
                const isSelected = opt.value === value;
                const activeRowCls =
                  accentColor === 'emerald'
                    ? 'bg-emerald-500/15 border-l-4 border-l-emerald-500 text-emerald-300 font-bold cursor-pointer'
                    : accentColor === 'cyan'
                    ? 'bg-cyan-500/15 border-l-4 border-l-cyan-500 text-cyan-300 font-bold cursor-pointer'
                    : 'bg-amber-500/15 border-l-4 border-l-amber-500 text-amber-300 font-bold cursor-pointer';
                const hoverRowCls =
                  accentColor === 'emerald'
                    ? 'hover:bg-emerald-500/10 text-slate-200 cursor-pointer'
                    : accentColor === 'cyan'
                    ? 'hover:bg-cyan-500/10 text-slate-200 cursor-pointer'
                    : 'hover:bg-amber-500/10 text-slate-200 cursor-pointer';
                const checkIconCls =
                  accentColor === 'emerald'
                    ? 'text-emerald-400'
                    : accentColor === 'cyan'
                    ? 'text-cyan-400'
                    : 'text-amber-400';
                return (
                  <button
                    key={opt.value || '__empty__'}
                    type="button"
                    disabled={opt.disabled}
                    onClick={() => {
                      if (opt.disabled) return;
                      onChange(opt.value);
                      onClose();
                    }}
                    className={`w-full min-h-[44px] px-3 py-2 text-left flex items-center justify-between gap-2 transition ${
                      opt.disabled
                        ? 'opacity-45 bg-rose-500/10 cursor-not-allowed text-slate-400'
                        : isSelected
                        ? activeRowCls
                        : hoverRowCls
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-xs font-bold truncate">{opt.label}</span>
                        {opt.badge && (
                          <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold border shrink-0 ${badgeToneClass(opt.badgeTone)}`}>
                            {opt.badge}
                          </span>
                        )}
                      </div>
                      {opt.sublabel && (
                        <div className="text-[10px] text-slate-400 truncate mt-0.5">{opt.sublabel}</div>
                      )}
                    </div>
                    {isSelected && <Check className={`w-4 h-4 ${checkIconCls} shrink-0`} />}
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

interface DriverCheckinModalProps {
  isOpen: boolean;
  onClose: () => void;
  driverId: string;
  driverName: string;
  userRole?: string;
  defaultCheckinRole?: 'driver' | 'helper';
  fleetId?: string;
  plateNumber?: string;
  vehicleType?: string;
  areaName?: string;
  availableAreas?: string[];
  availableFleets?: Fleet[];
  availableCrews?: Crew[];
  branchId?: string;
  initialMode?: 'checkin' | 'change_pin';
  onCheckinSuccess: (shift: DriverShiftCheckin) => void;
}

export const DriverCheckinModal: React.FC<DriverCheckinModalProps> = ({
  isOpen,
  onClose,
  driverId,
  driverName,
  userRole = 'Driver',
  defaultCheckinRole,
  fleetId,
  plateNumber = '-',
  vehicleType = '-',
  areaName = '',
  availableAreas,
  availableFleets = [],
  availableCrews,
  branchId,
  initialMode = 'checkin',
  onCheckinSuccess
}) => {
  const { addNotification } = useToast();

  // Mode: 'checkin' atau 'change_pin'
  const [mode, setMode] = useState<'checkin' | 'change_pin'>(initialMode);

  // Peran, Area, Armada, Helper 1, Helper 2 + Hanya 1 dropdown aktif pada satu waktu
  const resolvedDefaultRole: 'driver' | 'helper' = useMemo(() => {
    if (defaultCheckinRole === 'driver' || defaultCheckinRole === 'helper') return defaultCheckinRole;
    const roleLower = String(userRole || '').toLowerCase();
    return roleLower.includes('helper') || roleLower.includes('kernet') ? 'helper' : 'driver';
  }, [defaultCheckinRole, userRole]);

  const [selectedRole, setSelectedRole] = useState<'driver' | 'helper'>(resolvedDefaultRole);
  const [selectedArea, setSelectedArea] = useState<string>('');
  const [selectedFleetId, setSelectedFleetId] = useState<string>('');
  const [selectedHelper1Id, setSelectedHelper1Id] = useState<string>('');
  const [selectedHelper2Id, setSelectedHelper2Id] = useState<string>('');
  const [openDropdown, setOpenDropdown] = useState<'area' | 'fleet' | 'helper1' | 'helper2' | null>(null);

  const [storeTick, setStoreTick] = useState<number>(0);

  useEffect(() => {
    const unsubStore = logisticsStore.subscribe(() => setStoreTick(t => t + 1));
    const unsubBranch = branchStore.subscribe(() => setStoreTick(t => t + 1));
    return () => {
      unsubStore();
      unsubBranch();
    };
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    void logisticsStore.refreshUsersFromHostinger();
    void branchStore.syncFromServer();
  }, [isOpen]);

  const areaOptions = useMemo<ComboboxOption[]>(() => {
    const branchDefaultAreas = getOfficialAreasForBranch(branchId);
    const merged = Array.from(
      new Set([
        ...(availableAreas || []),
        ...branchDefaultAreas
      ])
    )
      .map(a => String(a || '').trim())
      .filter(a => {
        const lower = a.toLowerCase();
        return (
          lower !== '' &&
          lower !== '-' &&
          !lower.includes('terjadwal') &&
          lower !== 'area pengiriman' &&
          lower !== 'area kiriman' &&
          lower !== 'area kirim'
        );
      })
      .sort((a, b) => a.localeCompare(b, 'id'));

    return merged.map(area => ({
      value: area,
      label: area,
      searchText: area
    }));
  }, [availableAreas, branchId]);

  const fleetOptions = useMemo(() => {
    const isPhantom = (plate?: string) => {
      const p = String(plate || '').trim();
      return !p || /^FLT-\d+$/i.test(p) || p.toUpperCase().endsWith('AKK');
    };
    const sourceFleets = availableFleets && availableFleets.length > 0 ? availableFleets : logisticsStore.getFleets();
    const valid = sourceFleets.filter(f => f && f.id && !isPhantom(f.plateNumber));
    if (!branchId) return valid;
    return valid.filter(f => branchStore.getFleetBranchId(f.id, f.plateNumber, f.initialCode, f.branchId) === branchId);
  }, [availableFleets, branchId, storeTick]);

  const fleetComboboxOptions = useMemo<ComboboxOption[]>(() => {
    return fleetOptions.map(f => {
      const isServ = f.status === 'maintenance';
      return {
        value: f.id,
        label: f.initialCode || f.plateNumber,
        badge: isServ ? 'Servis' : undefined,
        badgeTone: isServ ? 'rose' : undefined,
        disabled: isServ,
        searchText: `${f.initialCode || ''} ${f.plateNumber} ${f.vehicleType || ''}`
      };
    });
  }, [fleetOptions]);

  const crewPool = useMemo(() => {
    const normalizeCompactKey = (val: string) => val.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
    const merged = new Map<string, { id: string; name: string; role: string; phone: string }>();
    const currentCompactKey = normalizeCompactKey(driverName || '');

    const pushMember = (id: string, name: string, role: string, phone = '') => {
      const cleanName = String(name || '').trim();
      if (!cleanName || cleanName === '-' || cleanName.toLowerCase() === 'tanpa helper') return;
      const compactKey = normalizeCompactKey(cleanName);
      if (!compactKey || compactKey === currentCompactKey || id === driverId) return;
      if (!merged.has(compactKey)) {
        merged.set(compactKey, { id, name: cleanName, role, phone });
      }
    };

    const allUsers = logisticsStore.getUsers();
    allUsers
      .filter(u => logisticsStore.isActiveDeliveryCrewUser(u, branchId))
      .forEach(u => {
        pushMember(
          u.id,
          u.fullName,
          u.role === 'driver' ? 'Driver' : 'Helper / Kernet',
          u.phone || ''
        );
      });

    (availableCrews && availableCrews.length > 0 ? availableCrews : logisticsStore.getCrews()).forEach(c => {
      if (!c || c.status === 'off') return;
      const matchedU = allUsers.find(
        u => `crw-${u.id}` === c.id || logisticsStore.isSameCrewPersonName(u.fullName || '', c.name || '')
      );
      if (allUsers.length > 0 && !matchedU) return;
      if (matchedU) {
        if (!logisticsStore.isActiveDeliveryCrewUser(matchedU, branchId)) return;
      } else if (branchId && branchStore.getCrewBranchId(c.id, c.name) !== branchId) {
        return;
      }
      pushMember(c.id, c.name, c.role || 'Helper', c.phone || '');
    });

    return Array.from(merged.values()).sort((a, b) => a.name.localeCompare(b.name, 'id'));
  }, [availableCrews, driverId, driverName, branchId, storeTick]);

  const helper1Options = useMemo<ComboboxOption[]>(() => {
    const emptyOpt: ComboboxOption = {
      value: '',
      label: 'Tanpa Helper 1',
      searchText: 'tanpa helper kosong sendiri'
    };
    const memberOpts: ComboboxOption[] = crewPool
      .filter(m => m.id !== selectedHelper2Id)
      .map(m => ({
        value: m.id,
        label: m.name,
        searchText: m.name
      }));
    return [emptyOpt, ...memberOpts];
  }, [crewPool, selectedHelper2Id]);

  const helper2Options = useMemo<ComboboxOption[]>(() => {
    const emptyOpt: ComboboxOption = {
      value: '',
      label: 'Tanpa Helper 2',
      searchText: 'tanpa helper 2 kosong opsional'
    };
    const memberOpts: ComboboxOption[] = crewPool
      .filter(m => m.id !== selectedHelper1Id)
      .map(m => ({
        value: m.id,
        label: m.name,
        searchText: m.name
      }));
    return [emptyOpt, ...memberOpts];
  }, [crewPool, selectedHelper1Id]);

  const chosenFleet = useMemo(() => {
    return (
      fleetOptions.find(f => f.id === selectedFleetId) ||
      (fleetId ? fleetOptions.find(f => f.id === fleetId) : undefined) ||
      null
    );
  }, [fleetOptions, selectedFleetId, fleetId]);

  // Step 1 & Step 2 untuk Verifikasi (Check-In 1x, Ubah PIN 2x)
  const [step, setStep] = useState<1 | 2>(1);
  const [firstPin, setFirstPin] = useState<string>('');
  const [secondPin, setSecondPin] = useState<string>('');
  const [pinError, setPinError] = useState<string | null>(null);
  const [pinSuccessMsg, setPinSuccessMsg] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Live clock & Location
  const [currentTime, setCurrentTime] = useState<string>('');
  const [currentDate, setCurrentDate] = useState<string>('');
  const [location, setLocation] = useState<string>('Memuat Lokasi GPS...');

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTime(now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) + ' WIB');
      setCurrentDate(now.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }));
    };
    updateTime();
    const timer = setInterval(updateTime, 1000);

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => setLocation(`Lat: ${pos.coords.latitude.toFixed(4)}, Long: ${pos.coords.longitude.toFixed(4)}`),
        () => setLocation('DC PT AKK Banyuwangi (-8.1906, 114.3708)')
      );
    } else {
      setLocation('DC PT AKK Banyuwangi (-8.1906, 114.3708)');
    }
    return () => clearInterval(timer);
  }, []);

  const [shiftSyncTick, setShiftSyncTick] = useState<number>(0);

  useEffect(() => {
    if (!isOpen) return;
    void driverShiftService.syncFromServer();
    const onShiftUpdate = () => setShiftSyncTick(t => t + 1);
    window.addEventListener('driver-shift-updated', onShiftUpdate);
    return () => window.removeEventListener('driver-shift-updated', onShiftUpdate);
  }, [isOpen]);

  const detectedTeamDriverShift = useMemo(() => {
    if (selectedRole !== 'helper') return null;
    return driverShiftService.findActivePartnerDriverShift({
      branchId,
      fleetId: selectedFleetId || chosenFleet?.id || fleetId,
      plateNumber: chosenFleet?.plateNumber || (plateNumber !== '-' ? plateNumber : ''),
      selectedArea,
      helperId: driverId,
      helperName: driverName
    });
  }, [branchId, selectedRole, selectedFleetId, chosenFleet?.id, chosenFleet?.plateNumber, fleetId, plateNumber, selectedArea, driverId, driverName, shiftSyncTick]);

  // Hanya inisialisasi field saat modal baru dibuka (transisi false -> true), sehingga salah PIN / refresh background tidak mereset isian di atas
  const wasOpenRef = useRef<boolean>(false);
  useEffect(() => {
    const justOpened = isOpen && !wasOpenRef.current;
    wasOpenRef.current = isOpen;
    if (!justOpened) return;

    setMode(initialMode);
    setStep(1);
    setFirstPin('');
    setSecondPin('');
    setPinError(null);
    setPinSuccessMsg(null);
    setSelectedRole(resolvedDefaultRole);
    setOpenDropdown(null);
    setSelectedHelper1Id('');
    setSelectedHelper2Id('');

    const partnerDriver =
      resolvedDefaultRole === 'helper'
        ? driverShiftService.findActivePartnerDriverShift({
            branchId,
            helperId: driverId,
            helperName: driverName
          })
        : null;

    const cleanInitArea = String(areaName || partnerDriver?.selectedArea || '').trim();
    const matchedArea = areaOptions.find(a => a.value.toLowerCase() === cleanInitArea.toLowerCase())?.value || '';
    setSelectedArea(matchedArea);

    const targetFleetId = fleetId || partnerDriver?.fleetId;
    const validFleet = targetFleetId
      ? fleetOptions.find(f => f.id === targetFleetId && f.status !== 'maintenance')
      : partnerDriver?.plateNumber
      ? fleetOptions.find(
          f =>
            f.status !== 'maintenance' &&
            f.plateNumber.replace(/\s+/g, '').toLowerCase() === partnerDriver.plateNumber!.replace(/\s+/g, '').toLowerCase()
        )
      : undefined;
    setSelectedFleetId(validFleet?.id || '');
  }, [isOpen, initialMode, resolvedDefaultRole, areaName, fleetId, areaOptions, fleetOptions, driverId, driverName]);

  // Jika Helper membuka modal sebelum data shift Driver selesai sync, isi otomatis area & armada begitu partner terdeteksi
  useEffect(() => {
    if (!isOpen || selectedRole !== 'helper' || !detectedTeamDriverShift) return;
    if (!selectedArea && detectedTeamDriverShift.selectedArea) {
      const matched = areaOptions.find(
        a => a.value.toLowerCase() === detectedTeamDriverShift.selectedArea!.trim().toLowerCase()
      )?.value;
      if (matched) setSelectedArea(matched);
    }
    if (!selectedFleetId && (detectedTeamDriverShift.fleetId || detectedTeamDriverShift.plateNumber)) {
      const matchedF = fleetOptions.find(
        f =>
          f.status !== 'maintenance' &&
          ((detectedTeamDriverShift.fleetId && f.id === detectedTeamDriverShift.fleetId) ||
            (detectedTeamDriverShift.plateNumber &&
              f.plateNumber.replace(/\s+/g, '').toLowerCase() ===
                detectedTeamDriverShift.plateNumber.replace(/\s+/g, '').toLowerCase()))
      );
      if (matchedF) setSelectedFleetId(matchedF.id);
    }
  }, [isOpen, selectedRole, detectedTeamDriverShift, selectedArea, selectedFleetId, areaOptions, fleetOptions]);

  if (!isOpen) return null;

  const activePinValue = step === 1 ? firstPin : secondPin;

  const resetPinInputs = () => {
    setStep(1);
    setFirstPin('');
    setSecondPin('');
    setPinError(null);
  };

  const handleKeypadPress = (digit: string) => {
    setPinError(null);
    setPinSuccessMsg(null);

    if (mode === 'checkin') {
      if (firstPin.length < 4) {
        const nextPin = firstPin + digit;
        setFirstPin(nextPin);
        if (nextPin.length === 4) {
          void handleVerifyCheckinSingleStep(nextPin);
        }
      }
      return;
    }

    if (step === 1) {
      if (firstPin.length < 4) {
        const nextPin = firstPin + digit;
        setFirstPin(nextPin);
        if (nextPin.length === 4) {
          setTimeout(() => {
            setStep(2);
          }, 180);
        }
      }
    } else {
      if (secondPin.length < 4) {
        const nextPin2 = secondPin + digit;
        setSecondPin(nextPin2);
        if (nextPin2.length === 4) {
          handleSaveNewPinTwoStep(firstPin, nextPin2);
        }
      }
    }
  };

  const handleKeypadDelete = () => {
    setPinError(null);
    if (mode === 'change_pin' && step === 2) {
      if (secondPin.length > 0) {
        setSecondPin(secondPin.slice(0, -1));
      } else {
        setStep(1);
      }
    } else {
      if (firstPin.length > 0) {
        setFirstPin(firstPin.slice(0, -1));
      }
    }
  };

  const handleKeypadClear = () => {
    resetPinInputs();
  };

  const handleVerifyCheckinSingleStep = async (pin: string) => {
    if (!selectedArea.trim()) {
      setPinError('Pilih Area Kiriman terlebih dahulu sebelum memasukkan PIN.');
      setFirstPin('');
      return;
    }
    if (fleetOptions.length > 0 && !chosenFleet) {
      setPinError('Pilih Armada kendaraan terlebih dahulu.');
      setFirstPin('');
      return;
    }
    if (chosenFleet && chosenFleet.status === 'maintenance') {
      setPinError('Armada sedang dalam status Servis / Perawatan. Pilih armada yang Ready.');
      setFirstPin('');
      return;
    }
    if (pin.length !== 4) {
      setPinError('Masukkan 4 digit PIN Keamanan Anda.');
      return;
    }

    const finalFleetId = chosenFleet?.id || fleetId;
    const finalInitialCode = chosenFleet?.initialCode || '';
    const finalPlate = chosenFleet?.plateNumber || plateNumber;
    const finalVehicleType = chosenFleet?.vehicleType || vehicleType;
    const roleLabel = selectedRole === 'helper' ? 'Helper' : 'Driver';

    const helper1Member = selectedRole === 'driver' && selectedHelper1Id
      ? crewPool.find(m => m.id === selectedHelper1Id)
      : undefined;
    const helper2Member = selectedRole === 'driver' && selectedHelper2Id
      ? crewPool.find(m => m.id === selectedHelper2Id)
      : undefined;

    const crewNoteSuffix = [
      helper1Member ? `Helper 1: ${helper1Member.name}` : '',
      helper2Member ? `Helper 2: ${helper2Member.name}` : ''
    ].filter(Boolean).join(' · ');

    setIsSubmitting(true);
    const res = await driverShiftService.checkInDriver({
      branchId,
      driverId,
      driverName,
      userRole: roleLabel,
      checkinRole: selectedRole,
      fleetId: finalFleetId,
      fleetInitialCode: finalInitialCode,
      plateNumber: finalPlate,
      vehicleType: finalVehicleType,
      areaName: selectedArea.trim(),
      helper1Id: helper1Member?.id,
      helper1Name: helper1Member?.name,
      helper2Id: helper2Member?.id,
      helper2Name: helper2Member?.name,
      verificationMethod: 'pin',
      pin,
      notes: `Check-In Portal (${roleLabel}) · Area: ${selectedArea.trim()} · Armada: ${finalInitialCode ? `${finalInitialCode} (${finalPlate})` : finalPlate}${crewNoteSuffix ? ` · ${crewNoteSuffix}` : ''}.`
    });
    setIsSubmitting(false);

    if (res.success && res.shift) {
      addNotification(
        'schedule',
        `Check-In ${roleLabel} Berhasil`,
        selectedRole === 'driver'
          ? `Masuk pukul ${res.shift.checkinTimeFormatted}. Silakan lanjut mengisi Checklist & Foto Armada.`
          : `Masuk pukul ${res.shift.checkinTimeFormatted}. Silakan lanjut ke Surat Jalan Keluar untuk validasi Security & Gate-Out.`
      );
      onCheckinSuccess(res.shift);
      onClose();
    } else {
      setPinError(res.message);
      setStep(1);
      setFirstPin('');
      setSecondPin('');
    }
  };

  const handleSaveNewPinTwoStep = (pin1: string, pin2: string) => {
    if (pin1.length !== 4 || pin2.length !== 4) {
      setPinError('Masukkan 4 digit PIN baru pada kedua tahap konfirmasi.');
      return;
    }

    if (pin1 !== pin2) {
      setPinError('Konfirmasi PIN baru ke-1 dan ke-2 tidak sama! Silakan ulangi.');
      setStep(1);
      setFirstPin('');
      setSecondPin('');
      return;
    }

    const saved = driverShiftService.setPin(driverId, pin2, {
      driverName,
      userRole: selectedRole === 'helper' ? 'Helper' : 'Driver',
      plateNumber: chosenFleet?.plateNumber || plateNumber,
      areaName: selectedArea || areaName
    });

    if (saved) {
      setPinSuccessMsg('PIN Keamanan baru (****) berhasil disimpan & tercatat di Sub-Menu Laporan Kiriman Kru!');
      addNotification(
        'schedule',
        'PIN Keamanan Diperbarui',
        `PIN baru untuk ${driverName} berhasil diverifikasi 2x dan masuk ke Laporan Kiriman Kru.`
      );
      setTimeout(() => {
        setMode('checkin');
        setStep(1);
        setFirstPin('');
        setSecondPin('');
      }, 1000);
    } else {
      setPinError('Gagal menyimpan PIN baru. Silakan coba kembali.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-700 rounded-3xl w-full max-w-md max-h-[94vh] flex flex-col shadow-2xl overflow-hidden my-auto text-slate-100">
        
        {/* Top Header */}
        <div className="bg-slate-950 p-4 border-b border-slate-800 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 shrink-0">
              <KeyRound className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="text-sm font-black text-white uppercase tracking-tight truncate">
                {mode === 'checkin' ? 'Check-In' : 'Ubah / Buat PIN Baru (2x)'}
              </div>
              <div className="text-[11px] text-slate-300 flex items-center gap-1.5 mt-0.5 flex-wrap">
                <span className="font-bold text-amber-300 truncate">{driverName}</span>
                <span>·</span>
                <span className="px-1.5 py-0.2 rounded bg-slate-800 text-cyan-300 font-semibold text-[10px] border border-slate-700">
                  {selectedRole === 'helper' ? 'Helper' : 'Driver'}
                </span>
                {(chosenFleet?.plateNumber || (plateNumber && plateNumber !== '-')) && (
                  <>
                    <span>·</span>
                    <span className="font-mono text-emerald-400 font-bold">
                      {chosenFleet?.plateNumber || plateNumber}
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup modal Check-In"
            className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3.5 text-xs">
          
          {/* Live Timestamp & Location Stamp Banner */}
          <div className="bg-slate-950 p-3 rounded-2xl border border-slate-800 space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 text-slate-200 min-w-0">
                <Clock className="w-4 h-4 text-amber-400 shrink-0" />
                <span className="font-bold text-xs truncate">{currentDate}</span>
              </div>
              <div className="font-mono font-black text-amber-400 text-xs tracking-wider shrink-0">
                {currentTime}
              </div>
            </div>

            <div className="flex items-center gap-1.5 text-[11px] text-slate-300 pt-1.5 border-t border-slate-800">
              <MapPin className="w-3.5 h-3.5 text-blue-400 shrink-0" />
              <span className="truncate font-mono">{location}</span>
            </div>
          </div>

          {/* Pilihan Mandiri Kru Saat Check-In: Peran, Area Kiriman, Armada, serta Helper 1 & Helper 2 */}
          {mode === 'checkin' && (
            <div className="bg-slate-950 p-3.5 rounded-2xl border border-slate-800 space-y-3">
              {/* 1. Pilih Peran (Driver / Helper) */}
              <div className="space-y-1.5">
                <span className="text-[11px] font-bold text-slate-300 flex items-center gap-1.5">
                  <UserCheck className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  <span>1. Pilih Peran Bertugas Hari Ini *</span>
                </span>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedRole('driver');
                      setPinError(null);
                    }}
                    className={`min-h-[44px] p-2.5 rounded-xl border flex items-center justify-center transition cursor-pointer ${
                      selectedRole === 'driver'
                        ? 'bg-amber-500/20 border-amber-400 text-white shadow-sm'
                        : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <div className="font-black text-xs text-amber-300">Driver</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setSelectedRole('helper');
                      setOpenDropdown(prev => (prev === 'helper1' || prev === 'helper2' ? null : prev));
                      setPinError(null);
                    }}
                    className={`min-h-[44px] p-2.5 rounded-xl border flex items-center justify-center transition cursor-pointer ${
                      selectedRole === 'helper'
                        ? 'bg-cyan-500/20 border-cyan-400 text-white shadow-sm'
                        : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <div className="font-black text-xs text-cyan-300">Helper</div>
                  </button>
                </div>
              </div>

              {/* 2. Pilih Area Kiriman (Modern Searchable Combobox) */}
              <div className="space-y-1.5">
                <label htmlFor="checkin-area-combo" className="text-[11px] font-bold text-slate-300 flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                  <span>2. Pilih Area Kiriman *</span>
                </label>
                <SearchableCombobox
                  id="checkin-area-combo"
                  isOpen={openDropdown === 'area'}
                  onToggle={() => setOpenDropdown(prev => (prev === 'area' ? null : 'area'))}
                  onClose={() => setOpenDropdown(null)}
                  value={selectedArea}
                  placeholder="-- Pilih Area Kiriman --"
                  searchPlaceholder="Ketik nama area kiriman..."
                  options={areaOptions}
                  onChange={(val) => {
                    setSelectedArea(val);
                    setPinError(null);
                  }}
                  emptyText="Area kiriman tidak ditemukan."
                  accentColor="amber"
                />
              </div>

              {/* 3. Pilih Armada (Modern Searchable Combobox) */}
              <div className="space-y-1.5">
                <label htmlFor="checkin-fleet-combo" className="text-[11px] font-bold text-slate-300 flex items-center gap-1.5">
                  <Truck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span>3. Pilih Armada Pengiriman *</span>
                </label>
                {fleetComboboxOptions.length > 0 ? (
                  <SearchableCombobox
                    id="checkin-fleet-combo"
                    isOpen={openDropdown === 'fleet'}
                    onToggle={() => setOpenDropdown(prev => (prev === 'fleet' ? null : 'fleet'))}
                    onClose={() => setOpenDropdown(null)}
                    value={selectedFleetId}
                    placeholder="-- Pilih Armada --"
                    searchPlaceholder="Cari inisial armada..."
                    options={fleetComboboxOptions}
                    onChange={(val) => {
                      setSelectedFleetId(val);
                      setPinError(null);
                    }}
                    emptyText="Armada tidak ditemukan."
                    accentColor="emerald"
                  />
                ) : (
                  <div className="px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 font-mono text-xs">
                    {fleetOptions.find(f => f.id === selectedFleetId)?.initialCode || plateNumber}
                  </div>
                )}
              </div>

              {/* 4. Pilih Helper 1 & Helper 2 (Khusus saat Check-In sebagai Driver) vs Info Driver Terhubung (Khusus Helper) */}
              {selectedRole === 'driver' ? (
                <div className="space-y-2.5 pt-2 border-t border-slate-800/80">
                  <div className="text-[11px] font-bold text-cyan-300 flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                    <span>4. Pilih Helper Partner</span>
                  </div>

                  <div className="space-y-1">
                    <label htmlFor="checkin-helper1-combo" className="text-[10px] font-semibold text-slate-400 block">
                      Helper 1
                    </label>
                    <SearchableCombobox
                      id="checkin-helper1-combo"
                      isOpen={openDropdown === 'helper1'}
                      onToggle={() => setOpenDropdown(prev => (prev === 'helper1' ? null : 'helper1'))}
                      onClose={() => setOpenDropdown(null)}
                      value={selectedHelper1Id}
                      placeholder="-- Pilih Helper 1 --"
                      searchPlaceholder="Cari nama kru helper 1..."
                      options={helper1Options}
                      onChange={(val) => setSelectedHelper1Id(val)}
                      emptyText="Nama kru tidak ditemukan."
                      accentColor="cyan"
                    />
                  </div>

                  <div className="space-y-1">
                    <label htmlFor="checkin-helper2-combo" className="text-[10px] font-semibold text-slate-400 block">
                      Helper 2 (Opsional)
                    </label>
                    <SearchableCombobox
                      id="checkin-helper2-combo"
                      isOpen={openDropdown === 'helper2'}
                      onToggle={() => setOpenDropdown(prev => (prev === 'helper2' ? null : 'helper2'))}
                      onClose={() => setOpenDropdown(null)}
                      value={selectedHelper2Id}
                      placeholder="-- Pilih Helper 2 (Opsional) --"
                      searchPlaceholder="Cari nama kru helper 2..."
                      options={helper2Options}
                      onChange={(val) => setSelectedHelper2Id(val)}
                      emptyText="Nama kru tidak ditemukan."
                      accentColor="cyan"
                    />
                  </div>
                </div>
              ) : detectedTeamDriverShift ? (
                <div className="p-3 rounded-xl bg-cyan-500/10 border border-cyan-500/35 text-[11px] text-cyan-200 flex items-start gap-2">
                  <Users className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
                  <div className="min-w-0">
                    <div className="font-bold text-cyan-300">
                      Terhubung Otomatis dengan Driver: {detectedTeamDriverShift.driverName}
                    </div>
                    <div className="text-[10px] text-slate-300 mt-0.5">
                      Area: {detectedTeamDriverShift.selectedArea || '-'} · Armada: {detectedTeamDriverShift.fleetInitialCode || detectedTeamDriverShift.plateNumber || '-'}
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
          )}

          {/* Mode Switcher */}
          <div className="grid grid-cols-2 gap-1.5 p-1 bg-slate-950 rounded-2xl border border-slate-800">
            <button
              type="button"
              onClick={() => {
                setMode('checkin');
                resetPinInputs();
                setPinSuccessMsg(null);
              }}
              className={`min-h-[40px] py-2 px-2.5 rounded-xl font-black text-xs flex items-center justify-center gap-1.5 transition cursor-pointer ${
                mode === 'checkin'
                  ? 'bg-amber-500 text-slate-950 shadow-md'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              <Lock className="w-3.5 h-3.5" />
              <span>PIN Keamanan Masuk</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setMode('change_pin');
                resetPinInputs();
                setPinSuccessMsg(null);
              }}
              className={`min-h-[40px] py-2 px-2.5 rounded-xl font-black text-xs flex items-center justify-center gap-1.5 transition cursor-pointer ${
                mode === 'change_pin'
                  ? 'bg-cyan-500 text-slate-950 shadow-md'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Ubah / Buat PIN Baru (2x)</span>
            </button>
          </div>

          {/* PIN KEYPAD VIEW */}
          <div className="p-4 bg-slate-950 rounded-2xl border border-slate-800 space-y-4">
            {mode === 'checkin' ? (
              <div className="flex items-center justify-center">
                <div className="px-3.5 py-1 rounded-lg text-[11px] font-bold flex items-center gap-1.5 border bg-amber-500/20 border-amber-500 text-amber-300">
                  <Lock className="w-3.5 h-3.5 text-amber-400" />
                  <span>Verifikasi PIN Masuk Shift (1x Input)</span>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center gap-2">
                <div className={`px-3 py-1 rounded-lg text-[11px] font-bold flex items-center gap-1.5 border ${
                  step === 1
                    ? 'bg-amber-500/20 border-amber-500 text-amber-300'
                    : 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300'
                }`}>
                  {step > 1 ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> : <span className="w-4 h-4 rounded-full bg-amber-500 text-slate-950 flex items-center justify-center text-[10px] font-black">1</span>}
                  <span>Input PIN Baru 1</span>
                </div>

                <div className="w-4 h-0.5 bg-slate-700" />

                <div className={`px-3 py-1 rounded-lg text-[11px] font-bold flex items-center gap-1.5 border ${
                  step === 2
                    ? 'bg-amber-500/20 border-amber-500 text-amber-300'
                    : 'bg-slate-900 border-slate-800 text-slate-400'
                }`}>
                  <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-black ${
                    step === 2 ? 'bg-amber-500 text-slate-950' : 'bg-slate-800 text-slate-400'
                  }`}>2</span>
                  <span>Ulangi PIN Baru 2</span>
                </div>
              </div>
            )}

            <div className="text-center space-y-2.5">
              <div className="text-xs font-bold text-white">
                {mode === 'checkin'
                  ? 'Masukkan 4-Digit PIN Keamanan Anda (1x Input)'
                  : step === 1
                  ? 'Tahap 1/2: Masukkan 4-Digit PIN Keamanan Baru'
                  : 'Tahap 2/2: Ketik Ulang 4-Digit PIN Baru untuk Konfirmasi (2x)'}
              </div>

              <div className="flex items-center justify-center gap-3.5 py-1">
                {[0, 1, 2, 3].map((idx) => {
                  const isFilled = activePinValue.length > idx;
                  return (
                    <div
                      key={idx}
                      className={`w-4 h-4 rounded-full border-2 transition-all ${
                        isFilled
                          ? 'bg-amber-400 border-amber-400 scale-110 shadow-sm shadow-amber-400/50'
                          : 'bg-transparent border-slate-600'
                      }`}
                    />
                  );
                })}
              </div>

              {pinError && (
                <div className="p-2.5 rounded-xl bg-rose-500/15 border border-rose-500/40 text-[11px] text-rose-300 font-bold flex items-center justify-center gap-1.5">
                  <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                  <span>{pinError}</span>
                </div>
              )}

              {pinSuccessMsg && (
                <div className="p-2.5 rounded-xl bg-emerald-500/15 border border-emerald-500/40 text-[11px] text-emerald-300 font-bold flex items-center justify-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>{pinSuccessMsg}</span>
                </div>
              )}
            </div>

            <div className="grid grid-cols-3 gap-2 max-w-[260px] mx-auto">
              {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
                <button
                  key={digit}
                  type="button"
                  onClick={() => handleKeypadPress(digit)}
                  className="h-12 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-mono font-black text-base transition active:scale-90 flex items-center justify-center border border-slate-700 shadow-sm cursor-pointer"
                >
                  {digit}
                </button>
              ))}

              <button
                type="button"
                onClick={handleKeypadClear}
                className="h-12 rounded-xl bg-slate-900 hover:bg-slate-800 text-amber-300 font-black text-xs transition active:scale-90 flex items-center justify-center border border-slate-700 cursor-pointer"
              >
                ULANG
              </button>

              <button
                type="button"
                onClick={() => handleKeypadPress('0')}
                className="h-12 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-mono font-black text-base transition active:scale-90 flex items-center justify-center border border-slate-700 shadow-sm cursor-pointer"
              >
                0
              </button>

              <button
                type="button"
                onClick={handleKeypadDelete}
                className="h-12 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-200 font-bold text-xs transition active:scale-90 flex items-center justify-center border border-slate-700 cursor-pointer"
              >
                <Delete className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="p-3.5 rounded-2xl bg-slate-950 border border-amber-500/40 space-y-1.5 shadow-inner">
            <div className="font-black text-amber-400 text-xs flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-amber-400 shrink-0" />
              <span>SOP &amp; Keselamatan:</span>
            </div>
            <p className="text-slate-200 text-[11px] leading-relaxed font-medium">
              Pastikan armada layak jalan dan patuhi aturan lalu lintas selama pengiriman.
            </p>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="bg-slate-950 p-3.5 px-4 border-t border-slate-800 flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={onClose}
            className="min-h-[42px] px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs transition cursor-pointer"
          >
            Batal
          </button>

          {mode === 'checkin' ? (
            <button
              type="button"
              onClick={() => void handleVerifyCheckinSingleStep(firstPin)}
              disabled={firstPin.length !== 4 || isSubmitting}
              className="min-h-[42px] px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:bg-slate-800 text-slate-950 disabled:text-slate-500 font-black text-xs flex items-center gap-1.5 transition active:scale-95 cursor-pointer disabled:cursor-not-allowed shadow-md"
            >
              <Check className="w-4 h-4" />
              <span>{isSubmitting ? 'Memverifikasi...' : 'Konfirmasi Masuk (PIN)'}</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => handleSaveNewPinTwoStep(firstPin, secondPin)}
              disabled={firstPin.length !== 4 || secondPin.length !== 4}
              className="min-h-[42px] px-5 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 disabled:bg-slate-800 text-slate-950 disabled:text-slate-500 font-black text-xs flex items-center gap-1.5 transition active:scale-95 cursor-pointer disabled:cursor-not-allowed shadow-md"
            >
              <Check className="w-4 h-4" />
              <span>Simpan PIN Baru (2x Input)</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
