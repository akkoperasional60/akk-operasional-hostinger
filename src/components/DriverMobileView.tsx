import React, { useState, useEffect, useMemo, useRef } from 'react';
import { AkkLogo } from './AkkLogo';
import {
  Truck,
  MapPin,
  Navigation,
  Phone,
  MessageSquare,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Package,
  Box,
  ChevronRight,
  ExternalLink,
  ShieldCheck,
  RefreshCw,
  Search,
  Filter,
  User,
  Users,
  Check,
  X,
  FileText,
  Camera,
  CameraOff,
  Calendar,
  Compass,
  ArrowRight,
  Radio,
  Sliders,
  Send,
  Building2,
  AlertCircle,
  Eye,
  Download,
  Sparkles,
  Wifi,
  WifiOff,
  UploadCloud,
  Database,
  Gauge,
  Fuel,
  Printer,
  QrCode,
  Lock,
  Share2,
  ClipboardCheck,
  PlusCircle,
  Plus,
  Fingerprint,
  KeyRound,
  Smartphone,
  Trash2,
  ArrowRightLeft,
  UserX,
  LogIn,
  UserPlus,
  Mail,
  EyeOff,
  Moon,
  Bell
} from 'lucide-react';
import {
  Schedule,
  ShipmentStatus,
  Crew,
  Fleet,
  RetailStore,
  DriverVehicleChecklist,
  OutboundWaybill,
  ChecklistItemCategory,
  DriverShiftCheckin,
  UserRole,
  UserProfile
} from '../types';
import { logisticsStore } from '../services/store';
import { driverReportService, DriverHelperReport, getLocalDateStr } from '../services/driverReportService';
import { driverOfflineSyncService, OfflineTaskAction, DriverSyncState } from '../services/driverOfflineSyncService';
import { driverChecklistService } from '../services/driverChecklistService';
import { driverWaybillService } from '../services/driverWaybillService';
import { driverShiftService } from '../services/driverShiftService';
import { supabaseRealtimeSync } from '../services/supabaseRealtimeSync';
import { useToast } from '../context/ToastContext';
import { getDriverPortalDepartureLabel, getAreaScheduleTiming } from '../utils/areaScheduleRules';
import { attendanceService } from '../services/attendanceService';
import { DriverPodCameraModal } from './DriverPodCameraModal';
import { DriverSuratJalanModal } from './DriverSuratJalanModal';
import { DriverVehicleChecklistModal } from './DriverVehicleChecklistModal';
import { DriverCheckinModal } from './DriverCheckinModal';
import { AndroidApkDownloadModal } from './AndroidApkDownloadModal';
import { DriverGmapsShareModal } from './DriverGmapsShareModal';

interface DriverMobileViewProps {
  onBackToPortal?: () => void;
  initialDriverId?: string;
  currentUser?: UserProfile;
}

export type DriverPortalTab = 'deliveries' | 'checklist' | 'surat_jalan' | 'history' | 'profile';

export const DriverMobileView: React.FC<DriverMobileViewProps> = ({
  onBackToPortal,
  initialDriverId,
  currentUser: propUser
}) => {
  const { addNotification } = useToast();

  // Active User Profile synchronization - Single Source of Truth
  const [currentUser, setCurrentUser] = useState<UserProfile>(() => propUser || logisticsStore.getCurrentUser());

  // Real-time Display Name & Avatar matching the account name
  const portalDisplayName = useMemo(() => {
    return currentUser?.fullName || logisticsStore.getPortalDisplayName();
  }, [currentUser]);

  const portalInitials = useMemo(() => {
    const name = portalDisplayName.trim();
    if (!name) return 'DR';
    const parts = name.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) {
      return `${parts[0].charAt(0)}${parts[1].charAt(0)}`.toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  }, [portalDisplayName]);

  // State
  const [crews, setCrews] = useState<Crew[]>(logisticsStore.getCrews());
  const [fleets, setFleets] = useState<Fleet[]>(logisticsStore.getFleets());

  const syncedCrew = useMemo(() => {
    return logisticsStore.getActiveDriverCrew();
  }, [currentUser, crews]);

  const [loggedInDriver, setLoggedInDriver] = useState<Crew | null>(() => {
    return syncedCrew || null;
  });

  // Sinkronisasi Role dengan User Manajemen (Driver / Helper / Role lainnya)
  const syncedUserRoleInfo = useMemo(() => {
    const allUsers = logisticsStore.getUsers();
    const matchedUser = allUsers.find(
      u =>
        (currentUser?.id && u.id === currentUser.id) ||
        (currentUser?.email && u.email.toLowerCase() === currentUser.email.toLowerCase()) ||
        (portalDisplayName && u.fullName.toLowerCase() === portalDisplayName.toLowerCase())
    );
    const rawRole = matchedUser?.role || currentUser?.role || loggedInDriver?.role || 'driver';
    const roleLower = String(rawRole).toLowerCase();
    let roleLabel = 'Driver';
    if (roleLower === 'helper' || roleLower.includes('helper') || roleLower === 'crew_helper') {
      roleLabel = 'Helper';
    } else if (roleLower === 'driver') {
      roleLabel = 'Driver';
    } else if (roleLower === 'spv_logistik') {
      roleLabel = 'SPV Logistik';
    } else if (roleLower === 'super_admin') {
      roleLabel = 'Super Admin';
    } else if (roleLower === 'security') {
      roleLabel = 'Security';
    } else if (roleLower === 'operasional') {
      roleLabel = 'Operasional';
    } else if (roleLower === 'unassigned') {
      roleLabel = 'Perlu Diisi (User Baru)';
    }
    return {
      rawRole,
      roleLabel,
      department: matchedUser?.department || currentUser?.department || 'Logistik'
    };
  }, [currentUser, portalDisplayName, loggedInDriver]);

  const [isDriverLoggedIn, setIsDriverLoggedIn] = useState<boolean>(() => {
    const user = propUser || logisticsStore.getCurrentUser();
    return !!user && user.id !== 'guest';
  });

  const [selectedDriverId, setSelectedDriverId] = useState<string>(() => {
    if (initialDriverId) return initialDriverId;
    if (syncedCrew) return syncedCrew.id;
    return crews[0]?.id || '';
  });

  // Sinkronisasi otomatis saat user prop berganti atau login/switch akun terjadi
  useEffect(() => {
    const active = propUser || logisticsStore.getCurrentUser();
    setCurrentUser(active);
    const matched = logisticsStore.getActiveDriverCrew();
    if (matched) {
      setLoggedInDriver(matched);
      setSelectedDriverId(matched.id);
      setIsDriverLoggedIn(true);
    }
  }, [propUser]);

  const [authTab, setAuthTab] = useState<'login' | 'register'>('login');
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Register Form
  const [registerData, setRegisterData] = useState({
    fullName: '',
    email: '',
    phone: '',
    role: 'driver' as UserRole,
    department: 'Gudang Distribusi Packaging Banyuwangi',
    password: '',
    confirmPassword: ''
  });

  const handleDriverLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    if (!loginEmail.trim() || !loginPassword) {
      setErrorMsg('Email/username dan password wajib diisi.');
      return;
    }

    const user = await logisticsStore.loginUserRemote(loginEmail.trim(), loginPassword);
    if (!user) {
      setErrorMsg('Email/username atau password salah, akun belum disetujui, atau server database belum tersedia.');
      return;
    }

    const allowedDriverRoles: UserRole[] = ['driver', 'crew_helper', 'spv_logistik', 'operasional', 'super_admin'];
    if (!allowedDriverRoles.includes(user.role)) {
      logisticsStore.logoutUser();
      setErrorMsg('Akun ini tidak memiliki akses ke Portal Driver.');
      return;
    }

    const crewMatch = crews.find(c => c.name.toLowerCase() === user.fullName.toLowerCase())
      || logisticsStore.getActiveDriverCrew()
      || null;
    setLoggedInDriver(crewMatch);
    setSelectedDriverId(crewMatch?.id || '');
    setIsDriverLoggedIn(true);
    setSuccessMsg(`Berhasil masuk sebagai ${user.fullName}`);
    setTimeout(() => {
      addNotification('delivery', 'Login Berhasil', `Selamat datang di Portal AKK, ${user.fullName}!`);
    }, 300);
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');
    if (!registerData.fullName.trim() || !registerData.email.trim()) {
      setErrorMsg('Nama lengkap dan email wajib diisi.');
      return;
    }
    if (registerData.password.length < 8) {
      setErrorMsg('Password minimal 8 karakter.');
      return;
    }
    if (registerData.password !== registerData.confirmPassword) {
      setErrorMsg('Konfirmasi password tidak cocok.');
      return;
    }

    const newUser = await logisticsStore.registerUserRemote({
      fullName: registerData.fullName.trim(),
      email: registerData.email.trim(),
      phone: registerData.phone.trim(),
      department: registerData.department,
      password: registerData.password
    });
    if (!newUser) {
      setErrorMsg('Pendaftaran gagal. Email mungkin sudah terdaftar atau database belum tersedia.');
      return;
    }

    setSuccessMsg(`Pendaftaran berhasil! Akun "${newUser.fullName}" menunggu persetujuan Super Admin.`);
    setTimeout(() => {
      setAuthTab('login');
      setSuccessMsg('Pendaftaran berhasil! Silakan masuk setelah akun disetujui.');
    }, 1200);
  };

  const handleDriverLogout = () => {
    logisticsStore.logoutUser();
    setIsDriverLoggedIn(false);
    setLoggedInDriver(null);
    setSelectedDriverId('');
    addNotification('delivery', 'Keluar Akun', 'Anda telah keluar dari Portal Driver.');
  };

  const [deliveries, setDeliveries] = useState<Schedule[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [isSupabaseLive, setIsSupabaseLive] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<'all' | 'active' | 'scheduled' | 'delivered'>('active');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [bottomNav, setBottomNav] = useState<DriverPortalTab>('deliveries');
  const checkinSectionRef = useRef<HTMLDivElement>(null);
  const [highlightCheckin, setHighlightCheckin] = useState<boolean>(false);

  // Camera hardware & permission detection state using enumerateDevices
  const [cameraSupportStatus, setCameraSupportStatus] = useState<'checking' | 'supported' | 'unsupported' | 'blocked'>('checking');

  useEffect(() => {
    const checkCameraSupport = async () => {
      if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) {
        setCameraSupportStatus('unsupported');
        return;
      }
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoInputs = devices.filter(d => d.kind === 'videoinput');
        if (videoInputs.length === 0) {
          setCameraSupportStatus('blocked');
        } else {
          setCameraSupportStatus('supported');
        }
      } catch (err) {
        console.warn('[DriverMobileView] enumerateDevices error:', err);
        setCameraSupportStatus('blocked');
      }
    };
    checkCameraSupport();
  }, []);

  // 📍 Native Device GPS Geolocation Integration (navigator.geolocation)
  const [deviceGps, setDeviceGps] = useState<{
    lat: number;
    lng: number;
    accuracy: number;
    speedKmh: number;
    lastUpdated: string;
    isSyncing: boolean;
    source: 'native' | 'dc_fallback';
  }>({
    lat: -8.1906,
    lng: 114.3708,
    accuracy: 12,
    speedKmh: 0,
    lastUpdated: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) + ' WIB',
    isSyncing: false,
    source: 'dc_fallback'
  });

  const [expandedRouteDeliveryId, setExpandedRouteDeliveryId] = useState<string | null>(null);

  const syncDeviceGps = (showToast = false) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      if (showToast) {
        addNotification('delivery', 'GPS Fallback DC Aktif', 'Perangkat menggunakan titik referensi Gudang Pusat Banyuwangi DC.');
      }
      return;
    }

    setDeviceGps(prev => ({ ...prev, isSyncing: true }));
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const nowTime = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) + ' WIB';
        const speedMs = pos.coords.speed || 0;
        setDeviceGps({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: Math.round(pos.coords.accuracy || 10),
          speedKmh: Math.max(0, Math.round(speedMs * 3.6)),
          lastUpdated: nowTime,
          isSyncing: false,
          source: 'native'
        });
        if (showToast) {
          addNotification(
            'delivery',
            'GPS Perangkat Tersinkronisasi',
            `Koordinat terkunci: ${pos.coords.latitude.toFixed(5)}, ${pos.coords.longitude.toFixed(5)} (±${Math.round(pos.coords.accuracy || 10)}m)`
          );
        }
      },
      () => {
        const nowTime = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) + ' WIB';
        setDeviceGps(prev => ({
          ...prev,
          lastUpdated: nowTime,
          isSyncing: false,
          source: 'dc_fallback'
        }));
        if (showToast) {
          addNotification(
            'delivery',
            'Titik GPS Referensi DC',
            'Menggunakan koordinat Gudang Pusat Sukowidi DC (-8.1906, 114.3708).'
          );
        }
      },
      { enableHighAccuracy: true, timeout: 6000, maximumAge: 15000 }
    );
  };

  useEffect(() => {
    syncDeviceGps(false);
    if (typeof navigator !== 'undefined' && navigator.geolocation) {
      const watchId = navigator.geolocation.watchPosition(
        (pos) => {
          const nowTime = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) + ' WIB';
          const speedMs = pos.coords.speed || 0;
          setDeviceGps({
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
            accuracy: Math.round(pos.coords.accuracy || 10),
            speedKmh: Math.max(0, Math.round(speedMs * 3.6)),
            lastUpdated: nowTime,
            isSyncing: false,
            source: 'native'
          });
        },
        () => {},
        { enableHighAccuracy: true, maximumAge: 20000 }
      );
      return () => navigator.geolocation.clearWatch(watchId);
    }
  }, []);

  const calculateRouteMetrics = (destLat: number, destLng: number) => {
    const R = 6371; // Earth radius in km
    const dLat = ((destLat - deviceGps.lat) * Math.PI) / 180;
    const dLng = ((destLng - deviceGps.lng) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((deviceGps.lat * Math.PI) / 180) *
        Math.cos((destLat * Math.PI) / 180) *
        Math.sin(dLng / 2) *
        Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const straightKm = R * c;
    const roadDistanceKm = Math.max(1.2, Number((straightKm * 1.28).toFixed(1)));
    const estMinutes = Math.max(5, Math.round((roadDistanceKm / 38) * 60));
    return { roadDistanceKm, estMinutes };
  };

  // 🚗 Checklist Kendaraan & 📑 Surat Jalan Keluar Integration States
  const [checklists, setChecklists] = useState<DriverVehicleChecklist[]>(() =>
    driverChecklistService.getChecklists()
  );
  const [isChecklistModalOpen, setIsChecklistModalOpen] = useState<boolean>(false);
  const [activeChecklistToEdit, setActiveChecklistToEdit] = useState<DriverVehicleChecklist | null>(null);

  const [isWaybillModalOpen, setIsWaybillModalOpen] = useState<boolean>(false);
  const [activeWaybillToView, setActiveWaybillToView] = useState<OutboundWaybill | null>(null);

  const [waybillStatusFilter, setWaybillStatusFilter] = useState<'all' | 'gate_out' | 'in_transit' | 'delivered'>('all');
  const [checklistTabCategory, setChecklistTabCategory] = useState<ChecklistItemCategory | 'all'>('all');

  // 🕒 Realtime Hari, Tanggal & Waktu Portal
  const [realtimeNow, setRealtimeNow] = useState<Date>(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => {
      setRealtimeNow(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const realtimeDayDateStr = useMemo(() => {
    return realtimeNow.toLocaleDateString('id-ID', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
  }, [realtimeNow]);

  const realtimeTimeStr = useMemo(() => {
    return (
      realtimeNow.toLocaleTimeString('id-ID', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      }) + ' WIB'
    );
  }, [realtimeNow]);

  // 🕒 Driver Check-in Shift Management (PIN 2x Verification) & Alur Pasca Check-In
  const [activeShift, setActiveShift] = useState<DriverShiftCheckin | null>(() =>
    driverShiftService.getActiveShift(selectedDriverId)
  );
  const [isCheckinModalOpen, setIsCheckinModalOpen] = useState<boolean>(false);
  const [checkinModalMode, setCheckinModalMode] = useState<'checkin' | 'change_pin'>('checkin');
  const [isCheckoutModalOpen, setIsCheckoutModalOpen] = useState<boolean>(false);
  const [isApkModalOpen, setIsApkModalOpen] = useState<boolean>(false);
  const [isGmapsShareModalOpen, setIsGmapsShareModalOpen] = useState<boolean>(false);

  // Alur Baru: Setelah Check-In -> Pilih/Kunci Armada -> Isi Checklist Armada -> Simpan -> Persiapan Keluar -> SJ Keluar & Gate-Out -> Konfirmasi Tiba di Gudang
  const [selectedFleetId, setSelectedFleetId] = useState<string>(() => {
    try {
      return localStorage.getItem(`akk_locked_fleet_${selectedDriverId}`) || '';
    } catch {
      return '';
    }
  });
  const [isFleetLockedAfterCheckin, setIsFleetLockedAfterCheckin] = useState<boolean>(() => {
    try {
      return localStorage.getItem(`akk_fleet_locked_flag_${selectedDriverId}`) === 'true';
    } catch {
      return false;
    }
  });
  const [isChecklistCompletedAfterCheckin, setIsChecklistCompletedAfterCheckin] = useState<boolean>(() => {
    try {
      const todayStr = new Date().toISOString().slice(0, 10);
      return localStorage.getItem(`akk_checklist_done_${selectedDriverId}`) === todayStr;
    } catch {
      return false;
    }
  });
  const [isHelperPositionSkipped, setIsHelperPositionSkipped] = useState<boolean>(() => {
    try {
      return localStorage.getItem(`akk_helper_skipped_${selectedDriverId}`) === 'true';
    } catch {
      return false;
    }
  });
  const [isPostCheckinFleetModalOpen, setIsPostCheckinFleetModalOpen] = useState<boolean>(false);
  const [waybillRefreshTick, setWaybillRefreshTick] = useState<number>(0);

  // Sinkronisasi Status Bersama (Driver & Helper dalam 1 Armada / Jadwal yang sama)
  const [sharedScheduleFlowMap, setSharedScheduleFlowMap] = useState<Record<string, {
    scheduleId: string;
    date: string;
    fleetId?: string;
    plateNumber?: string;
    vehicleType?: string;
    checklistCompleted?: boolean;
    checklistCompletedBy?: string;
    preparedForGateOut?: boolean;
    preparedBy?: string;
    gateOutConfirmed?: boolean;
    gateOutBy?: string;
    gateOutTimestamp?: string;
    argoArrivalTimestamp?: string;
    argoArrivalBy?: string;
  }>>(() => {
    try {
      const raw = localStorage.getItem('akk_shared_schedule_flow_v1');
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  });

  const updateSharedScheduleFlow = (
    scheduleIds: string[],
    patch: Partial<{
      date: string;
      fleetId: string;
      plateNumber: string;
      vehicleType: string;
      checklistCompleted: boolean;
      checklistCompletedBy: string;
      preparedForGateOut: boolean;
      preparedBy: string;
      gateOutConfirmed: boolean;
      gateOutBy: string;
      gateOutTimestamp: string;
      argoArrivalTimestamp: string;
      argoArrivalBy: string;
    }>
  ) => {
    const todayStr = new Date().toISOString().slice(0, 10);
    setSharedScheduleFlowMap(prev => {
      const next = { ...prev };
      scheduleIds.filter(Boolean).forEach(id => {
        next[id] = {
          ...(next[id] || { scheduleId: id, date: todayStr }),
          ...patch,
          scheduleId: id,
          date: patch.date || next[id]?.date || todayStr
        };
      });
      try {
        localStorage.setItem('akk_shared_schedule_flow_v1', JSON.stringify(next));
      } catch {}
      return next;
    });
  };

  // Sync active shift on driver change or shift event
  useEffect(() => {
    if (selectedDriverId) {
      setActiveShift(driverShiftService.getActiveShift(selectedDriverId));
      try {
        const todayStr = new Date().toISOString().slice(0, 10);
        const savedFleet = localStorage.getItem(`akk_locked_fleet_${selectedDriverId}`) || '';
        const savedLocked = localStorage.getItem(`akk_fleet_locked_flag_${selectedDriverId}`) === 'true';
        const savedChecklistDone = localStorage.getItem(`akk_checklist_done_${selectedDriverId}`) === todayStr;
        const savedHelperSkip = localStorage.getItem(`akk_helper_skipped_${selectedDriverId}`) === 'true';
        setSelectedFleetId(savedFleet);
        setIsFleetLockedAfterCheckin(savedLocked);
        setIsChecklistCompletedAfterCheckin(savedChecklistDone);
        setIsHelperPositionSkipped(savedHelperSkip);
      } catch {}
    }

    const onShiftUpdated = (e: any) => {
      const updated = e.detail as DriverShiftCheckin;
      if (updated && updated.driverId === selectedDriverId) {
        setActiveShift(updated.status !== 'checked_out' ? updated : null);
      }
    };

    const onWaybillUpdated = () => {
      setWaybillRefreshTick(t => t + 1);
    };

    window.addEventListener('driver-shift-updated', onShiftUpdated);
    window.addEventListener('driver-waybill-updated', onWaybillUpdated);
    return () => {
      window.removeEventListener('driver-shift-updated', onShiftUpdated);
      window.removeEventListener('driver-waybill-updated', onWaybillUpdated);
    };
  }, [selectedDriverId]);

  // Load checklists when selected driver or deliveries change
  useEffect(() => {
    const list = driverChecklistService.getChecklists();
    setChecklists(list);
  }, [selectedDriverId, deliveries.length]);

  // 📢 Arahan & Solusi Kendala dari SPV Logistik / Super Admin (Hanya tampil pada hari tersebut, otomatis hilang keesokan harinya)
  const [driverKendalaReports, setDriverKendalaReports] = useState<DriverHelperReport[]>([]);
  const [todayOfflineReports, setTodayOfflineReports] = useState<DriverHelperReport[]>([]);
  const todayLocalStr = useMemo(() => getLocalDateStr(realtimeNow), [realtimeNow]);

  const loadDriverKendalaReports = () => {
    try {
      const all = driverReportService.getReports();
      const current = crews.find(c => c.id === selectedDriverId);
      const displayLower = (portalDisplayName || '').toLowerCase();
      const userFullLower = (currentUser?.fullName || '').toLowerCase();
      const isSpvOrAdminRole =
        currentUser?.role === 'super_admin' || currentUser?.role === 'spv_logistik';

      const filtered = all.filter(r => {
        const rDriverLower = (r.driverName || '').toLowerCase();
        const rHelperLower = (r.helperName || '').toLowerCase();
        const currentCrewLower = (current?.name || '').toLowerCase();

        if (r.driverId === selectedDriverId) return true;
        if (currentCrewLower && (rDriverLower.includes(currentCrewLower) || rHelperLower.includes(currentCrewLower))) return true;
        if (displayLower && (rDriverLower.includes(displayLower) || rHelperLower.includes(displayLower))) return true;
        if (userFullLower && (rDriverLower.includes(userFullLower) || rHelperLower.includes(userFullLower))) return true;
        if (isSpvOrAdminRole && r.solution && r.solution.trim().length > 0) return true;
        return false;
      });
      setDriverKendalaReports(filtered);

      // Daftar laporan siapa saja yang mengaktifkan Mode Offline hari ini
      const offlineToday = all.filter(
        r => r.category === 'mode_offline' && (r.date || getLocalDateStr(r.timestamp)) === todayLocalStr
      );
      setTodayOfflineReports(offlineToday);
    } catch {}
  };

  useEffect(() => {
    loadDriverKendalaReports();
    const handleUpdate = () => loadDriverKendalaReports();
    window.addEventListener('driver-report-updated', handleUpdate);
    return () => window.removeEventListener('driver-report-updated', handleUpdate);
  }, [selectedDriverId, crews, portalDisplayName, currentUser, todayLocalStr]);

  const activeDriverSolutions = useMemo(() => {
    return driverKendalaReports
      .filter(r => {
        if (!r.solution || r.solution.trim().length === 0) return false;
        const solutionLocalDate = r.solutionAt
          ? getLocalDateStr(new Date(r.solutionAt))
          : getLocalDateStr(r.date || r.timestamp);
        // Hanya tampilkan arahan pada hari tersebut (otomatis hilang keesokan harinya)
        return solutionLocalDate === todayLocalStr;
      })
      .sort((a, b) => {
        const timeA = new Date(a.solutionAt || a.timestamp || 0).getTime();
        const timeB = new Date(b.solutionAt || b.timestamp || 0).getTime();
        return timeB - timeA;
      });
  }, [driverKendalaReports, todayLocalStr]);

  // 📶 Offline State Synchronization Management (IndexedDB & LocalStorage)
  const [syncState, setSyncState] = useState<DriverSyncState>(driverOfflineSyncService.getSyncState());
  const [isQueueModalOpen, setIsQueueModalOpen] = useState<boolean>(false);

  // Handler terpusat saat Kru mengaktifkan atau mematikan Mode Offline (otomatis tercatat di Laporan Kiriman Kru)
  const handleToggleOfflineMode = (enableOffline: boolean) => {
    driverOfflineSyncService.setSimulatedOffline(enableOffline);
    const activeDel = activeDeliveries[0] || scheduledDeliveries[0] || deliveries[0];
    const plateStr = assignedFleet?.plateNumber || activeDel?.fleet?.plateNumber || '-';
    const areaStr = activeDel?.areaName || activeDel?.store?.storeName || 'Rute Pengiriman Aktif';
    const helperStr = activeDel?.crewHelper?.name || undefined;

    if (enableOffline) {
      driverReportService.recordOfflineModeActivation({
        driverId: selectedDriverId,
        driverName: portalDisplayName || currentDriver?.name || 'Driver Kru',
        userRole: syncedUserRoleInfo.roleLabel,
        helperName: helperStr,
        plateNumber: plateStr,
        areaName: areaStr,
        modeType: 'simulasi'
      });
      loadDriverKendalaReports();
      addNotification(
        'sla_warning',
        '⚠️ Peringatan Mode Offline Tercatat',
        `${portalDisplayName} mengaktifkan Mode Offline. Laporan peringatan telah dikirim ke Tim Pengiriman & SPV Logistik agar segera di-online-kan kembali!`
      );
    } else {
      driverReportService.markOfflineModeRestored({
        driverId: selectedDriverId,
        driverName: portalDisplayName || currentDriver?.name || 'Driver Kru',
        restoredBy: `${portalDisplayName || 'Kru'} (Portal Driver)`
      });
      loadDriverKendalaReports();
      addNotification(
        'delivery',
        '✓ Kembali Online (Tersambung)',
        `Mode Offline dimatikan oleh ${portalDisplayName}. Status peringatan di Laporan Kiriman Kru telah berubah hijau (Sudah Online).`
      );
    }
  };

  // Jika saat dibuka perangkat sudah dalam Mode Simulasi Offline, pastikan tercatat di laporan hari ini
  useEffect(() => {
    if (syncState.isSimulatedOffline && isDriverLoggedIn && portalDisplayName) {
      const activeDel = activeDeliveries[0] || scheduledDeliveries[0] || deliveries[0];
      driverReportService.recordOfflineModeActivation({
        driverId: selectedDriverId,
        driverName: portalDisplayName,
        userRole: syncedUserRoleInfo.roleLabel,
        helperName: activeDel?.crewHelper?.name,
        plateNumber: assignedFleet?.plateNumber || activeDel?.fleet?.plateNumber || '-',
        areaName: activeDel?.areaName || activeDel?.store?.storeName || 'Rute Pengiriman Aktif',
        modeType: 'simulasi'
      });
      loadDriverKendalaReports();
    }
  }, [syncState.isSimulatedOffline, isDriverLoggedIn, selectedDriverId, portalDisplayName]);

  // Subscribe to driver offline sync changes and online reconnection events
  useEffect(() => {
    const unsub = driverOfflineSyncService.subscribe(setSyncState);

    const onSynced = (e: any) => {
      const detail = e.detail;
      if (detail && detail.syncedCount > 0) {
        addNotification(
          'delivery',
          'Sinkronisasi Offline Selesai',
          `${detail.syncedCount} pembaruan tugas berhasil disinkronkan ke server pusat!`
        );
        loadDeliveriesRef.current(true);
      }
    };

    window.addEventListener('driver-offline-synced', onSynced);

    return () => {
      unsub();
      window.removeEventListener('driver-offline-synced', onSynced);
    };
  }, [addNotification]);

  // Delay reporting modal state
  const [delayModal, setDelayModal] = useState<{
    isOpen: boolean;
    delivery: Schedule | null;
    reason: string;
    customNote: string;
  }>({
    isOpen: false,
    delivery: null,
    reason: 'Driver / Helper Tidak Masuk (Harus Segera Diganti)',
    customNote: ''
  });

  // 🔄 Minta Oper Jadwal Modal State (Permintaan oper penugasan)
  const [transferModal, setTransferModal] = useState<{
    isOpen: boolean;
    delivery: Schedule | null;
    reason: string;
    transferType: string;
    gpsPhotoUrl: string;
    constraintNote: string;
  }>({
    isOpen: false,
    delivery: null,
    reason: 'Darurat / Halangan pribadi',
    transferType: 'Oper ke driver lain (Driver cari pengganti)',
    gpsPhotoUrl: 'https://images.unsplash.com/photo-1526778548025-fa2f459cd5c1?w=600&auto=format&fit=crop&q=80',
    constraintNote: ''
  });

  // 🗑️ Konfirmasi Hapus Riwayat Pengiriman Selesai (Khusus Super Admin)
  const [deleteConfirmModal, setDeleteConfirmModal] = useState<{
    isOpen: boolean;
    delivery: Schedule | null;
  }>({
    isOpen: false,
    delivery: null
  });

  const [checklistInspectionType, setChecklistInspectionType] = useState<'pre_trip' | 'post_trip'>('pre_trip');
  const [dateFilterStart, setDateFilterStart] = useState<string>('');
  const [dateFilterEnd, setDateFilterEnd] = useState<string>('');
  const [currentPage, setCurrentPage] = useState<number>(1);
  const ITEMS_PER_PAGE = 4;

  // Proof of Delivery (Konfirmasi Tiba di Gudang Argo) completion modal state
  const [podModal, setPodModal] = useState<{
    isOpen: boolean;
    delivery: Schedule | null;
    conditionNote: string;
    serviceNote: string;
    hasSignature: boolean;
    photoUrl: string | null;
    photoTimestamp: string | null;
    postTripFleetStatus: 'available' | 'maintenance';
  }>({
    isOpen: false,
    delivery: null,
    conditionNote: '',
    serviceNote: '',
    hasSignature: true,
    photoUrl: null,
    photoTimestamp: null,
    postTripFleetStatus: 'available'
  });

  // Dedicated device camera capture modal state
  const [cameraModal, setCameraModal] = useState<{
    isOpen: boolean;
    delivery: Schedule | null;
  }>({
    isOpen: false,
    delivery: null
  });

  // Full-screen photo inspector modal state
  const [viewPhotoModal, setViewPhotoModal] = useState<{
    isOpen: boolean;
    photoUrl: string;
    title: string;
    subtitle: string;
  }>({
    isOpen: false,
    photoUrl: '',
    title: '',
    subtitle: ''
  });

  // Active Driver profile
  const currentDriver = useMemo(() => {
    const matched = crews.find(c => c.id === selectedDriverId);
    if (matched) {
      return {
        ...matched,
        name: portalDisplayName
      };
    }
    if (syncedCrew) {
      return {
        ...syncedCrew,
        name: portalDisplayName
      };
    }
    return crews[0] ? { ...crews[0], name: portalDisplayName } : null;
  }, [crews, selectedDriverId, syncedCrew, portalDisplayName]);

  // Jadwal non-selesai utama untuk sinkronisasi Driver & Helper dalam satu armada
  const primarySharedSchedule = useMemo(() => {
    return (
      deliveries.find(d => ['in_transit', 'picked_up', 'delayed'].includes(d.status)) ||
      deliveries.find(d => d.status === 'scheduled') ||
      deliveries[0] ||
      null
    );
  }, [deliveries]);

  // Assigned Fleet for current driver/helper (Prioritizes shared schedule fleet or locked fleet selected after Check-In)
  const assignedFleet = useMemo(() => {
    if (primarySharedSchedule) {
      const sharedFlow = sharedScheduleFlowMap[primarySharedSchedule.id];
      if (sharedFlow?.fleetId) {
        const sharedFleetMatch = fleets.find(f => f.id === sharedFlow.fleetId);
        if (sharedFleetMatch) return sharedFleetMatch;
      }
      if (primarySharedSchedule.fleetId) {
        const schFleetMatch = fleets.find(f => f.id === primarySharedSchedule.fleetId);
        if (schFleetMatch) return schFleetMatch;
      }
      if (primarySharedSchedule.fleet) return primarySharedSchedule.fleet;
    }
    if (selectedFleetId) {
      const lockedMatch = fleets.find(f => f.id === selectedFleetId);
      if (lockedMatch) return lockedMatch;
    }
    if (currentDriver?.currentFleetId) {
      const currentFleetMatch = fleets.find(f => f.id === currentDriver.currentFleetId);
      if (currentFleetMatch) return currentFleetMatch;
    }
    if (currentDriver) {
      const driverMatch = fleets.find(f => f.driverId === currentDriver.id);
      if (driverMatch) return driverMatch;
    }
    return fleets[0] || null;
  }, [fleets, currentDriver, selectedFleetId, primarySharedSchedule, sharedScheduleFlowMap]);

  // Status Persiapan Keluar & SJ Keluar
  const [keluarArgoMap, setKeluarArgoMap] = useState<Record<string, string>>(() => {
    try {
      const saved = localStorage.getItem('akk_driver_keluar_argo_v1');
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  const [sjKeluarSistemMap, setSjKeluarSistemMap] = useState<Record<string, string>>(() => {
    try {
      const saved = localStorage.getItem('akk_driver_sj_sistem_v1');
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  // Latest vehicle checklist for current driver/helper or their shared fleet/schedule partner
  const latestChecklist = useMemo(() => {
    const driverNameLower = (currentDriver?.name || portalDisplayName || '').trim().toLowerCase();
    const partnerDriverLower = (primarySharedSchedule?.crew?.name || '').trim().toLowerCase();
    const partnerHelperLower = (primarySharedSchedule?.crewHelper?.name || '').trim().toLowerCase();

    const matchesCrewOrPartner = (c: DriverVehicleChecklist) => {
      const cName = (c.driverName || '').trim().toLowerCase();
      return (
        c.driverId === selectedDriverId ||
        (primarySharedSchedule?.crewId && c.driverId === primarySharedSchedule.crewId) ||
        (primarySharedSchedule?.crewHelperId && c.driverId === primarySharedSchedule.crewHelperId) ||
        (driverNameLower.length > 0 && cName === driverNameLower) ||
        (partnerDriverLower.length > 0 && cName === partnerDriverLower) ||
        (partnerHelperLower.length > 0 && cName === partnerHelperLower)
      );
    };

    if (assignedFleet) {
      const byFleet = checklists.find(
        c =>
          (matchesCrewOrPartner(c) || c.date === new Date().toISOString().slice(0, 10)) &&
          (c.fleetId === assignedFleet.id || c.plateNumber === assignedFleet.plateNumber)
      );
      if (byFleet) return byFleet;
    }
    return checklists.find(c => matchesCrewOrPartner(c)) || null;
  }, [checklists, selectedDriverId, assignedFleet, currentDriver?.name, portalDisplayName, primarySharedSchedule]);

  // Status apakah driver sudah klik Konfirmasi Tiba di Gudang hari ini (membuka kunci Pasca-Jalan)
  const [hasConfirmedArrivalFlag, setHasConfirmedArrivalFlag] = useState<boolean>(() => {
    try {
      const todayStr = new Date().toISOString().slice(0, 10);
      return localStorage.getItem(`akk_confirmed_arrival_${selectedDriverId}`) === todayStr;
    } catch {
      return false;
    }
  });

  useEffect(() => {
    try {
      const todayStr = new Date().toISOString().slice(0, 10);
      setHasConfirmedArrivalFlag(
        localStorage.getItem(`akk_confirmed_arrival_${selectedDriverId}`) === todayStr
      );
    } catch {}
  }, [selectedDriverId]);

  const hasConfirmedArrivalToday = useMemo(() => {
    const todayStr = new Date().toISOString().slice(0, 10);
    const hasDeliveredToday = deliveries.some(
      d => d.status === 'delivered' && ((d.actualArrival || d.departureDate || '').slice(0, 10) === todayStr)
    );
    return Boolean(hasConfirmedArrivalFlag || hasDeliveredToday);
  }, [hasConfirmedArrivalFlag, deliveries]);

  // Cek apakah jadwal/armada bersama (Driver A & Helper B) sudah selesai Checklist Pra-Jalan hari ini
  const sharedCrewPreTripState = useMemo(() => {
    const todayStr = new Date().toISOString().slice(0, 10);
    const driverNameLower = (currentDriver?.name || portalDisplayName || '').trim().toLowerCase();
    const partnerDriverLower = (primarySharedSchedule?.crew?.name || '').trim().toLowerCase();
    const partnerHelperLower = (primarySharedSchedule?.crewHelper?.name || '').trim().toLowerCase();

    const matchingPreTrip = checklists.find(c => {
      if (c.date !== todayStr || c.inspectionType !== 'pre_trip') return false;
      const cName = (c.driverName || '').trim().toLowerCase();
      if (c.driverId === selectedDriverId || (driverNameLower && cName === driverNameLower)) return true;
      if (primarySharedSchedule) {
        if (primarySharedSchedule.crewId && c.driverId === primarySharedSchedule.crewId) return true;
        if (primarySharedSchedule.crewHelperId && c.driverId === primarySharedSchedule.crewHelperId) return true;
        if (partnerDriverLower && cName === partnerDriverLower) return true;
        if (partnerHelperLower && cName === partnerHelperLower) return true;
        if (assignedFleet && (c.fleetId === assignedFleet.id || c.plateNumber === assignedFleet.plateNumber)) return true;
      }
      return false;
    });

    const sharedFlow = primarySharedSchedule ? sharedScheduleFlowMap[primarySharedSchedule.id] : undefined;
    const isSameDayFlow = Boolean(sharedFlow?.date === todayStr);
    const isPreparedOrInTransit = Boolean(
      primarySharedSchedule &&
        ((sharedFlow?.checklistCompleted && isSameDayFlow) ||
          (sharedFlow?.preparedForGateOut && isSameDayFlow) ||
          (sharedFlow?.gateOutConfirmed && isSameDayFlow) ||
          ['in_transit', 'picked_up'].includes(primarySharedSchedule.status))
    );

    const isDone = Boolean(matchingPreTrip || (isChecklistCompletedAfterCheckin && isSameDayFlow) || isPreparedOrInTransit);
    const completedBy =
      matchingPreTrip?.driverName ||
      sharedFlow?.checklistCompletedBy ||
      primarySharedSchedule?.crew?.name ||
      portalDisplayName;

    return {
      isDone,
      completedBy,
      isPreparedOrInTransit
    };
  }, [
    checklists,
    selectedDriverId,
    currentDriver?.name,
    portalDisplayName,
    primarySharedSchedule,
    assignedFleet,
    isChecklistCompletedAfterCheckin,
    sharedScheduleFlowMap,
    keluarArgoMap
  ]);

  const hasChecklistToday = useMemo(() => {
    return sharedCrewPreTripState.isDone;
  }, [sharedCrewPreTripState.isDone]);

  const isUserHelperRole = useMemo(() => {
    return (
      syncedUserRoleInfo.roleLabel === 'Helper' ||
      String(currentUser?.role || '').toLowerCase() === 'crew_helper' ||
      isHelperPositionSkipped
    );
  }, [syncedUserRoleInfo.roleLabel, currentUser?.role, isHelperPositionSkipped]);

  // Syarat Persiapan Keluar: 1. Check-In Shift -> 2. Pemilihan Armada -> 3. Pengisian Checklist Pra-Jalan (atau sudah diselesaikan partner Driver/Helper)
  const canClickPersiapanKeluar = useMemo(() => {
    const hasShift = Boolean(activeShift);
    const hasFleet = Boolean(isFleetLockedAfterCheckin || sharedCrewPreTripState.isDone || isUserHelperRole);
    const hasChecklist = Boolean(hasChecklistToday || isChecklistCompletedAfterCheckin || isUserHelperRole);
    return hasShift && hasFleet && hasChecklist;
  }, [activeShift, isFleetLockedAfterCheckin, sharedCrewPreTripState.isDone, isUserHelperRole, hasChecklistToday, isChecklistCompletedAfterCheckin]);

  // Helper to lock selected fleet after check-in and propagate to active schedules (Driver & Helper)
  const lockSelectedFleetForDriver = (fleetIdToLock: string) => {
    const targetF = fleets.find(f => f.id === fleetIdToLock) || assignedFleet || fleets[0];
    if (!targetF) return null;
    setSelectedFleetId(targetF.id);
    setIsFleetLockedAfterCheckin(true);
    setIsHelperPositionSkipped(false);
    try {
      localStorage.setItem(`akk_locked_fleet_${selectedDriverId}`, targetF.id);
      localStorage.setItem(`akk_fleet_locked_flag_${selectedDriverId}`, 'true');
      localStorage.setItem(`akk_helper_skipped_${selectedDriverId}`, 'false');
    } catch {}
    if (selectedDriverId) {
      logisticsStore.updateCrew(selectedDriverId, { currentFleetId: targetF.id });
    }
    const accountName = (currentUser?.fullName || portalDisplayName || currentDriver?.name || '').trim();
    const currentSchedules = logisticsStore.getSchedules();
    const updates: { id: string; data: Partial<Schedule> }[] = [];
    const matchedScheduleIds: string[] = [];
    currentSchedules.forEach(s => {
      if (
        s.status !== 'delivered' &&
        (s.crewId === selectedDriverId ||
          s.crewHelperId === selectedDriverId ||
          isScheduleAssignedToPerson(s, accountName, selectedDriverId))
      ) {
        matchedScheduleIds.push(s.id);
        updates.push({
          id: s.id,
          data: {
            fleetId: targetF.id,
            fleet: targetF
          }
        });
      }
    });
    if (matchedScheduleIds.length > 0) {
      updateSharedScheduleFlow(matchedScheduleIds, {
        fleetId: targetF.id,
        plateNumber: targetF.plateNumber,
        vehicleType: targetF.vehicleType
      });
    }
    if (updates.length > 0) {
      logisticsStore.batchSyncSchedules([], updates);
    }
    loadDeliveries(true);
    return targetF;
  };

  // Filter kru khusus untuk SPV Logistik & Super Admin di Portal Driver ('all' = tampilkan semua jadwal kru)
  const [spvCrewFilter, setSpvCrewFilter] = useState<string>('all');
  const spvCrewFilterRef = useRef<string>('all');
  useEffect(() => {
    spvCrewFilterRef.current = spvCrewFilter;
  }, [spvCrewFilter]);

  // Cek apakah role akun saat ini adalah SPV Logistik atau Super Admin (bisa melihat semua jadwal & menghapus jadwal)
  const canManageAllPortalSchedules = useMemo(() => {
    const r1 = String(currentUser?.role || '').toLowerCase();
    const r2 = String(syncedUserRoleInfo.rawRole || '').toLowerCase();
    return (
      ['super_admin', 'spv_logistik', 'admin'].includes(r1) ||
      ['super_admin', 'spv_logistik', 'admin'].includes(r2)
    );
  }, [currentUser?.role, syncedUserRoleInfo.rawRole]);

  // Helper pencocokan nama kru secara akurat berdasarkan token kata (mencegah 'Budi' tercampur dengan 'Budiono', namun 'Rizal' cocok dengan 'Saifur Rizal')
  const doesCrewNameMatch = (schedulePersonName: string | undefined, targetAccountName: string | undefined): boolean => {
    const a = (schedulePersonName || '').trim().toLowerCase();
    const b = (targetAccountName || '').trim().toLowerCase();
    if (!a || !b || a === '-' || a === 'tanpa helper') return false;
    if (a === b) return true;
    const tokensA = a.split(/[\s,/&.-]+/).filter(w => w.length >= 3);
    const tokensB = b.split(/[\s,/&.-]+/).filter(w => w.length >= 3);
    if (tokensA.length === 0 || tokensB.length === 0) return false;
    return tokensB.every(t => tokensA.includes(t)) || tokensA.every(t => tokensB.includes(t));
  };

  // Cek apakah sebuah jadwal ditugaskan kepada kru (Driver atau Helper) tertentu
  const isScheduleAssignedToPerson = (
    s: Schedule,
    personName: string,
    personId?: string,
    crewPool?: Crew[]
  ): boolean => {
    const activeCrewPool = crewPool || crews;
    const cleanName = (personName || '').trim();
    const cleanId = (personId || '').trim().toLowerCase();

    const driverNameOnSch = s.crew?.name || activeCrewPool.find(c => c.id === s.crewId)?.name || '';
    const helper1OnSch = s.crewHelper?.name || (s.crewHelperId ? activeCrewPool.find(c => c.id === s.crewHelperId)?.name : '') || '';
    const helper2OnSch = s.crewHelper2?.name || (s.crewHelper2Id ? activeCrewPool.find(c => c.id === s.crewHelper2Id)?.name : '') || '';

    if (cleanName) {
      if (doesCrewNameMatch(driverNameOnSch, cleanName)) return true;
      if (doesCrewNameMatch(helper1OnSch, cleanName)) return true;
      if (doesCrewNameMatch(helper2OnSch, cleanName)) return true;
    }

    if (cleanId && cleanId.length > 2) {
      const strippedTargetId = cleanId.replace(/^(usr-|crw-)/, '');
      const scheduleIds = [s.crewId, s.crewHelperId, s.crewHelper2Id, s.crew?.id, s.crewHelper?.id, s.crewHelper2?.id]
        .filter(Boolean)
        .map(x => String(x).trim().toLowerCase());

      if (scheduleIds.includes(cleanId)) {
        if (!cleanName || (!driverNameOnSch && !helper1OnSch && !helper2OnSch)) return true;
        if (
          doesCrewNameMatch(driverNameOnSch, cleanName) ||
          doesCrewNameMatch(helper1OnSch, cleanName) ||
          doesCrewNameMatch(helper2OnSch, cleanName)
        ) {
          return true;
        }
      }
      if (
        strippedTargetId.length >= 4 &&
        scheduleIds.some(sid => sid.replace(/^(usr-|crw-)/, '') === strippedTargetId)
      ) {
        return true;
      }
    }

    return false;
  };

  // Load deliveries with offline local caching + Role-based Schedule Filtering (Driver/Helper vs SPV Logistik/Super Admin)
  const loadDeliveries = async (silent = false) => {
    if (!silent) setIsLoading(true);
    try {
      const localSchedules = logisticsStore.getSchedules();
      if (localSchedules.length === 0) {
        setDeliveries([]);
        driverOfflineSyncService.cacheDeliveries([]);
        return;
      }

      // Always read fresh user & crew state from store to prevent stale closure bugs after status updates
      const latestUser = propUser || logisticsStore.getCurrentUser();
      const latestCrews = logisticsStore.getCrews();
      const latestActiveCrew = logisticsStore.getActiveDriverCrew();
      const latestUsersList = logisticsStore.getUsers();
      const matchedUserInStore = latestUsersList.find(
        u =>
          (latestUser?.id && u.id === latestUser.id) ||
          (latestUser?.email && u.email.toLowerCase() === latestUser.email.toLowerCase()) ||
          (latestUser?.fullName && u.fullName.toLowerCase() === latestUser.fullName.toLowerCase())
      );
      const effectiveRole = String(matchedUserInStore?.role || latestUser?.role || '').toLowerCase();
      const isManagerPortal = ['super_admin', 'spv_logistik', 'admin'].includes(effectiveRole);
      const activeSpvFilter = spvCrewFilterRef.current;

      let targetList: Schedule[] = [];

      if (isManagerPortal) {
        // Role SPV Logistik & Super Admin: Semua jadwal terbaca di portal (atau difilter sesuai pilihan kru)
        if (activeSpvFilter === 'all') {
          targetList = localSchedules;
        } else {
          targetList = localSchedules.filter(s =>
            isScheduleAssignedToPerson(s, activeSpvFilter, undefined, latestCrews)
          );
        }
      } else {
        // Role Driver / Helper: HANYA jadwal milik akun yang sedang login (baik sebagai Driver maupun Helper)
        const accountName = (
          latestUser?.fullName ||
          portalDisplayName ||
          latestActiveCrew?.name ||
          ''
        ).trim();
        const accountId = latestActiveCrew?.id || latestUser?.id || selectedDriverId;
        targetList = localSchedules.filter(s =>
          isScheduleAssignedToPerson(s, accountName, accountId, latestCrews)
        );
      }

      // Prioritas status agar jadwal aktif dan jadwal selesai (delivered) keduanya terjaga dengan baik
      const getStatusRank = (s: Schedule): number => {
        if (s.status === 'in_transit' || s.status === 'picked_up' || s.status === 'delayed') return 4;
        if (s.status === 'delivered') return 3;
        if (s.isManuallyEdited) return 2;
        return 1;
      };

      const sortedRaw = [...targetList].sort((a, b) => {
        const rankDiff = getStatusRank(b) - getStatusRank(a);
        if (rankDiff !== 0) return rankDiff;
        const dateA = new Date(a.departureDate || a.createdAt || 0).getTime();
        const dateB = new Date(b.departureDate || b.createdAt || 0).getTime();
        return dateB - dateA;
      });

      const seenIds = new Set<string>();
      const seenComposite = new Set<string>();
      const deduplicated: Schedule[] = [];

      for (const item of sortedRaw) {
        if (seenIds.has(item.id)) continue;
        const dateKey = (item.departureDate || item.createdAt || '').slice(0, 10);
        const crewKey = (item.crew?.name || item.crewId || '').toLowerCase();
        const areaKey = (item.areaName || item.store?.storeName || '').toLowerCase();
        // Sertakan status & areaKey agar jadwal yang sudah selesai ('delivered') tidak pernah tertimpa/hilang
        const compositeKey = `${dateKey}_${crewKey}_${areaKey}_${item.status}`;

        if (dateKey && seenComposite.has(compositeKey)) continue;
        seenIds.add(item.id);
        if (dateKey) seenComposite.add(compositeKey);
        deduplicated.push(item);
      }

      const sorted = deduplicated.sort((a, b) => {
        const dateA = new Date(a.departureDate || a.createdAt || 0).getTime();
        const dateB = new Date(b.departureDate || b.createdAt || 0).getTime();
        return dateB - dateA;
      });

      setDeliveries(sorted);
      setIsSupabaseLive(false);
      driverOfflineSyncService.cacheDeliveries(sorted);
    } catch (err) {
      console.warn('[DriverMobileView] Error fetching deliveries:', err);
      setDeliveries([]);
    } finally {
      if (!silent) setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  const loadDeliveriesRef = useRef(loadDeliveries);
  loadDeliveriesRef.current = loadDeliveries;

  useEffect(() => {
    loadDeliveries();
  }, [selectedDriverId, currentUser?.id, currentUser?.fullName, currentUser?.role, portalDisplayName, spvCrewFilter, canManageAllPortalSchedules]);

  // React to store updates without stale closure
  useEffect(() => {
    const unsub = logisticsStore.subscribe(() => {
      const active = logisticsStore.getCurrentUser();
      setCurrentUser(active);
      const matched = logisticsStore.getActiveDriverCrew();
      if (matched) {
        setLoggedInDriver(matched);
        setSelectedDriverId(matched.id);
        setIsDriverLoggedIn(true);
      }
      setCrews(logisticsStore.getCrews());
      setFleets(logisticsStore.getFleets());
      setChecklists(driverChecklistService.getChecklists());
      try {
        const rawArgo = localStorage.getItem('akk_driver_keluar_argo_v1');
        if (rawArgo) setKeluarArgoMap(JSON.parse(rawArgo));
        const rawShared = localStorage.getItem('akk_shared_schedule_flow_v1');
        if (rawShared) setSharedScheduleFlowMap(JSON.parse(rawShared));
      } catch {}
      setWaybillRefreshTick(t => t + 1);
      loadDeliveriesRef.current(true);
    });
    return unsub;
  }, []);

  // 🔔 Notifikasi Portal Driver: Hanya menampilkan notifikasi Solusi Kendala dari SPV Logistik / Super Admin
  // (Notifikasi perubahan jadwal hanya dimunculkan di menu Laporan Kiriman Kru, tidak di portal)
  const [isDriverNotifDrawerOpen, setIsDriverNotifDrawerOpen] = useState<boolean>(false);
  const [latestSolutionBanner, setLatestSolutionBanner] = useState<{
    id: string;
    title: string;
    message: string;
    solutionBy: string;
  } | null>(null);

  // Listen to solution updates from SPV Logistik / Super Admin for this driver/helper (same day only)
  useEffect(() => {
    const handleReportSolutionUpdate = (e: any) => {
      const updated = e?.detail as DriverHelperReport | undefined;
      if (!updated || !updated.solution || updated.driverAcknowledged) return;

      const todayStr = getLocalDateStr();
      const solDateStr = updated.solutionAt
        ? getLocalDateStr(new Date(updated.solutionAt))
        : getLocalDateStr(updated.date || updated.timestamp);
      if (solDateStr !== todayStr) return;

      const current = crews.find(c => c.id === selectedDriverId);
      const displayLower = (portalDisplayName || '').toLowerCase();
      const userFullLower = (currentUser?.fullName || '').toLowerCase();
      const isSpvOrAdminRole =
        currentUser?.role === 'super_admin' || currentUser?.role === 'spv_logistik';
      const uDriverLower = (updated.driverName || '').toLowerCase();
      const uHelperLower = (updated.helperName || '').toLowerCase();
      const currentCrewLower = (current?.name || '').toLowerCase();

      const isForCurrentCrew =
        updated.driverId === selectedDriverId ||
        (currentCrewLower && (uDriverLower.includes(currentCrewLower) || uHelperLower.includes(currentCrewLower))) ||
        (displayLower && (uDriverLower.includes(displayLower) || uHelperLower.includes(displayLower))) ||
        (userFullLower && (uDriverLower.includes(userFullLower) || uHelperLower.includes(userFullLower))) ||
        isSpvOrAdminRole;

      if (isForCurrentCrew) {
        setLatestSolutionBanner({
          id: updated.id,
          title: `Solusi Kendala: ${updated.areaName}`,
          message: updated.solution,
          solutionBy: updated.solutionBy || 'SPV Logistik / Super Admin'
        });
      }
    };

    window.addEventListener('driver-report-updated', handleReportSolutionUpdate);
    return () => {
      window.removeEventListener('driver-report-updated', handleReportSolutionUpdate);
    };
  }, [selectedDriverId, crews, portalDisplayName, currentUser]);

  // Otomatis bersihkan banner arahan jika sudah berganti hari (keesokan harinya)
  useEffect(() => {
    if (latestSolutionBanner) {
      const stillActiveToday = activeDriverSolutions.some(r => r.id === latestSolutionBanner.id);
      if (!stillActiveToday) {
        setLatestSolutionBanner(null);
      }
    }
  }, [todayLocalStr, activeDriverSolutions, latestSolutionBanner]);

  // ⚡ Supabase Realtime Live Synchronization Layer (Sinkronisasi data jadwal tanpa menampilkan banner perubahan jadwal di portal)
  useEffect(() => {
    let unsubscribeDriverRealtime: (() => void) | null = null;
    const activeDriverName = currentDriver?.name || portalDisplayName;

    try {
      unsubscribeDriverRealtime = supabaseRealtimeSync.subscribeForDriver({
        driverId: selectedDriverId,
        driverName: activeDriverName,
        onNotification: () => {
          // Notifikasi perubahan jadwal hanya muncul di menu Laporan Kiriman Kru, bukan di Portal Driver
        },
        onScheduleSync: () => {
          setCrews(logisticsStore.getCrews());
          setFleets(logisticsStore.getFleets());
          loadDeliveriesRef.current(true);
        }
      });
    } catch {}

    const handleRealtimeSynced = () => {
      setCrews(logisticsStore.getCrews());
      setFleets(logisticsStore.getFleets());
      loadDeliveriesRef.current(true);
    };

    window.addEventListener('akk-realtime-synced', handleRealtimeSynced);

    return () => {
      window.removeEventListener('akk-realtime-synced', handleRealtimeSynced);
      if (unsubscribeDriverRealtime) {
        unsubscribeDriverRealtime();
      }
    };
  }, [selectedDriverId, currentDriver?.name, portalDisplayName]);

  // Cek peran user saat ini untuk hak akses khusus Super Admin & SPV Logistik
  const isSuperAdmin =
    currentUser?.role === 'super_admin' &&
    String(syncedUserRoleInfo.rawRole).toLowerCase() === 'super_admin';

  // 📦 Pemisahan tugas pengiriman:
  // - Untuk SPV Logistik & Super Admin (saat filter 'all'): tampilkan semua jadwal aktif/terjadwal agar semua jadwal kru terbaca.
  // - Untuk Driver / Helper: Jadwal Aktif menampilkan 1 jadwal utama hari ini / terdekat, sisanya di Daftar Jadwal.
  const { activeDeliveries, scheduledDeliveries, deliveredDeliveries } = useMemo(() => {
    const todayIso = new Date().toISOString().slice(0, 10);
    const delivered = deliveries.filter(d => d.status === 'delivered');
    const nonDelivered = deliveries.filter(d => d.status !== 'delivered');

    if (canManageAllPortalSchedules && spvCrewFilter === 'all') {
      const inProgressOrToday = nonDelivered.filter(
        d =>
          ['picked_up', 'in_transit', 'delayed'].includes(d.status) ||
          Boolean(keluarArgoMap[d.id]) ||
          (d.departureDate || '').slice(0, 10) === todayIso
      );
      const activeList = inProgressOrToday.length > 0 ? inProgressOrToday : nonDelivered;
      const activeIds = new Set(activeList.map(d => d.id));
      const remainingScheduled = nonDelivered.filter(d => !activeIds.has(d.id));
      return {
        activeDeliveries: activeList,
        scheduledDeliveries: remainingScheduled,
        deliveredDeliveries: delivered
      };
    }

    let primaryActive: Schedule | null = null;

    // 1. Prioritas utama: jadwal yang sedang dalam perjalanan (Di Jalan) atau sudah klik Persiapan Keluar
    const inProgress = nonDelivered.find(
      d => ['picked_up', 'in_transit', 'delayed'].includes(d.status) || Boolean(keluarArgoMap[d.id])
    );
    if (inProgress) {
      primaryActive = inProgress;
    } else {
      // 2. Prioritas kedua: jadwal tepat tanggal hari ini
      const exactToday = nonDelivered.find(d => (d.departureDate || '').slice(0, 10) === todayIso);
      if (exactToday) {
        primaryActive = exactToday;
      } else if (nonDelivered.length > 0) {
        // 3. Prioritas ketiga: 1 jadwal terdekat berikutnya (>= hari ini) atau 1 jadwal terbaru
        const upcoming = nonDelivered
          .filter(d => (d.departureDate || '').slice(0, 10) >= todayIso)
          .sort((a, b) => (a.departureDate || '').localeCompare(b.departureDate || ''));
        if (upcoming.length > 0) {
          primaryActive = upcoming[0];
        } else {
          const sortedDesc = [...nonDelivered].sort((a, b) =>
            (b.departureDate || '').localeCompare(a.departureDate || '')
          );
          primaryActive = sortedDesc[0];
        }
      }
    }

    const activeList = primaryActive ? [primaryActive] : [];
    const remainingScheduled = nonDelivered
      .filter(d => !primaryActive || d.id !== primaryActive.id)
      .sort((a, b) => {
        const timeA = new Date(a.departureDate || a.createdAt || 0).getTime();
        const timeB = new Date(b.departureDate || b.createdAt || 0).getTime();
        return timeA - timeB;
      });

    return {
      activeDeliveries: activeList,
      scheduledDeliveries: remainingScheduled,
      deliveredDeliveries: delivered
    };
  }, [deliveries, keluarArgoMap, canManageAllPortalSchedules, spvCrewFilter]);

  // 📄 Surat Jalan Keluar (SJ Keluar):
  // Tersinkronisasi penuh antara Driver & Helper dalam satu armada/jadwal:
  // - Menampilkan seluruh SJ untuk jadwal aktif/terjadwal (Siap Out), Di Jalan (setelah salah satu klik Gate-Out -> otomatis siap SJ Print), dan Selesai (setelah tiba di gudang).
  const driverWaybills = useMemo(() => {
    if (deliveries.length === 0) return [];
    const hydratedDeliveries = deliveries.map(d => {
      const shared = sharedScheduleFlowMap[d.id];
      const effectiveStatus: ShipmentStatus =
        d.status === 'delivered'
          ? 'delivered'
          : shared?.gateOutConfirmed || ['in_transit', 'picked_up', 'delayed'].includes(d.status)
          ? 'in_transit'
          : d.status;
      return {
        ...d,
        status: effectiveStatus,
        fleet: assignedFleet || d.fleet,
        fleetId: assignedFleet?.id || d.fleetId
      };
    });
    return driverWaybillService.getWaybillsForDriver(selectedDriverId, hydratedDeliveries);
  }, [selectedDriverId, deliveries, assignedFleet, keluarArgoMap, sharedScheduleFlowMap, waybillRefreshTick]);

  // Jika filter SJ Keluar sedang di 'gate_out' (Siap Out) namun partner sudah klik Gate-Out sehingga berpindah ke 'in_transit', otomatis tampilkan 'in_transit' / 'all' agar langsung muncul SJ Print
  useEffect(() => {
    if (waybillStatusFilter === 'gate_out' && driverWaybills.length > 0) {
      const readyOutCount = driverWaybills.filter(w => w.status === 'checker_verified').length;
      const inTransitCount = driverWaybills.filter(w => w.status === 'in_transit' || w.status === 'gate_out').length;
      if (readyOutCount === 0 && inTransitCount > 0) {
        setWaybillStatusFilter('in_transit');
      } else if (readyOutCount === 0) {
        setWaybillStatusFilter('all');
      }
    }
  }, [waybillStatusFilter, driverWaybills]);

  // Helper resolusi komposisi kru (Driver Utama, Helper 1, dan Helper 2 untuk kondisi tertentu)
  const getDeliveryCrewComposition = (d: Schedule) => {
    const resolvedDriver =
      d.crew?.name ||
      crews.find(c => c.id === d.crewId)?.name ||
      currentDriver?.name ||
      portalDisplayName ||
      'Driver Utama';

    const rawHelper1 =
      d.crewHelper?.name ||
      (d.crewHelperId ? crews.find(c => c.id === d.crewHelperId)?.name : '') ||
      '';
    const rawHelper2 =
      d.crewHelper2?.name ||
      (d.crewHelper2Id ? crews.find(c => c.id === d.crewHelper2Id)?.name : '') ||
      '';

    let helper1Name = rawHelper1.trim() || 'Tanpa Helper';
    let helper2Name = rawHelper2.trim();

    // Jika Helper 1 memuat 2 nama dipisahkan "/" atau "&" atau "," dan Helper 2 belum terisi terpisah
    if (!helper2Name && rawHelper1 && /[,&/]/.test(rawHelper1)) {
      const parts = rawHelper1.split(/[,&/]/).map(s => s.trim()).filter(Boolean);
      if (parts.length >= 2) {
        helper1Name = parts[0];
        helper2Name = parts.slice(1).join(', ');
      }
    }

    const hasHelper2 = Boolean(helper2Name && helper2Name !== '-' && helper2Name.toLowerCase() !== 'tanpa helper');

    return {
      driverName: resolvedDriver,
      helper1Name,
      helper2Name: hasHelper2 ? helper2Name : '',
      hasHelper2
    };
  };

  // Filtered deliveries berdasarkan activeTab, rentang tanggal (dateFilterStart - dateFilterEnd), batasan sebulan pada 'all', dan searchQuery
  const filteredDeliveries = useMemo(() => {
    let sourceList: Schedule[] = [];
    if (activeTab === 'active') sourceList = activeDeliveries;
    else if (activeTab === 'scheduled') sourceList = scheduledDeliveries;
    else if (activeTab === 'delivered') sourceList = deliveredDeliveries;
    else sourceList = [...activeDeliveries, ...scheduledDeliveries, ...deliveredDeliveries];

    const hasCustomDateRange = Boolean(dateFilterStart || dateFilterEnd);

    if (hasCustomDateRange) {
      sourceList = sourceList.filter(d => {
        const itemDate = (d.departureDate || d.createdAt || '').substring(0, 10);
        if (!itemDate) return false;
        if (dateFilterStart && itemDate < dateFilterStart) return false;
        if (dateFilterEnd && itemDate > dateFilterEnd) return false;
        return true;
      });
    }

    if (!searchQuery.trim()) return sourceList;

    const q = searchQuery.toLowerCase();
    return sourceList.filter(d => {
      const storeName = d.store?.storeName?.toLowerCase() || '';
      const city = d.store?.city?.toLowerCase() || '';
      const area = d.areaName?.toLowerCase() || '';
      const tracking = d.trackingNumber?.toLowerCase() || '';
      const cargo = d.cargoDescription?.toLowerCase() || '';
      const plate = d.fleet?.plateNumber?.toLowerCase() || '';
      const { driverName, helper1Name, helper2Name } = getDeliveryCrewComposition(d);
      return (
        area.includes(q) ||
        storeName.includes(q) ||
        city.includes(q) ||
        driverName.toLowerCase().includes(q) ||
        helper1Name.toLowerCase().includes(q) ||
        helper2Name.toLowerCase().includes(q) ||
        tracking.includes(q) ||
        cargo.includes(q) ||
        plate.includes(q)
      );
    });
  }, [activeDeliveries, scheduledDeliveries, deliveredDeliveries, activeTab, searchQuery, dateFilterStart, dateFilterEnd, crews, currentDriver, portalDisplayName]);

  // Reset halaman paging ke 1 setiap kali tab, pencarian, atau filter tanggal berubah
  useEffect(() => {
    setCurrentPage(1);
  }, [activeTab, searchQuery, dateFilterStart, dateFilterEnd]);

  const totalPages = useMemo(() => {
    return Math.max(1, Math.ceil(filteredDeliveries.length / ITEMS_PER_PAGE));
  }, [filteredDeliveries.length]);

  const paginatedDeliveries = useMemo(() => {
    const startIdx = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredDeliveries.slice(startIdx, startIdx + ITEMS_PER_PAGE);
  }, [filteredDeliveries, currentPage]);

  // Completed deliveries for History sub-tab
  const completedDeliveries = useMemo(() => {
    return deliveries.filter(d => d.status === 'delivered');
  }, [deliveries]);

  // Status handler with Local State Synchronization (Offline Queue & Immediate Optimistic UI)
  const handleUpdateStatus = async (
    delivery: Schedule,
    newStatus: ShipmentStatus,
    extraNotes?: string,
    podData?: {
      podPhotoUrl?: string;
      podReceiverName?: string;
      podConditionNote?: string;
      podPhotoTimestamp?: string;
    },
    fleetStatusOverride?: 'available' | 'on-duty' | 'maintenance'
  ) => {
    setIsRefreshing(true);

    // Rekam pembaruan status ke antrean lokal (IndexedDB / localStorage) + Optimistic Store Update
    const res = await driverOfflineSyncService.recordTaskUpdate({
      scheduleId: delivery.id,
      trackingNumber: delivery.trackingNumber,
      driverId: selectedDriverId,
      newStatus,
      previousStatus: delivery.status,
      notes: extraNotes,
      podData
    });

    // Pastikan status armada terintegrasi penuh setelah perubahan status jadwal:
    // - Klik Gate-Out ('in_transit' / 'picked_up') -> Status armada otomatis berubah menjadi Kirim ('on-duty')
    // - Klik Sudah Berada di Gudang ('delivered') -> Status armada otomatis berubah menjadi Ready ('available') atau Servis ('maintenance')
    const targetFleetKeys = [
      delivery.fleetId,
      assignedFleet?.id,
      delivery.fleet?.plateNumber,
      assignedFleet?.plateNumber
    ].filter(Boolean) as string[];

    if (newStatus === 'in_transit' || newStatus === 'picked_up') {
      targetFleetKeys.forEach(fk => logisticsStore.updateFleetStatus(fk, 'on-duty'));
    } else if (newStatus === 'delivered') {
      const targetFleetStatus = fleetStatusOverride || podModal.postTripFleetStatus || 'available';
      targetFleetKeys.forEach(fk => logisticsStore.updateFleetStatus(fk, targetFleetStatus, 0));
    }
    setFleets(logisticsStore.getFleets());

    addNotification(
      newStatus === 'delayed' ? 'sla_warning' : 'delivery',
      res.syncedImmediately ? 'Status Pengiriman Diperbarui' : 'Tersimpan Offline di HP',
      res.message
    );

    // Optimistically update local deliveries view immediately
    setDeliveries(prev => prev.map(d => {
      if (d.id === delivery.id) {
        return {
          ...d,
          status: newStatus,
          notes: extraNotes !== undefined ? extraNotes : d.notes,
          actualArrival: newStatus === 'delivered' ? new Date().toISOString() : d.actualArrival,
          podPhotoUrl: podData?.podPhotoUrl || d.podPhotoUrl,
          podPhotoTimestamp: podData?.podPhotoTimestamp || d.podPhotoTimestamp
        };
      }
      return d;
    }));

    await loadDeliveries(true);
    setIsRefreshing(false);
  };

  // Persiapan Keluar: Hanya aktif setelah Check-In -> Pemilihan Armada -> Pengisian Checklist, lalu otomatis mengarah ke SJ Keluar & Gate-Out
  const handlePersiapanKeluar = (delivery: Schedule) => {
    if (!activeShift) {
      addNotification(
        'sla_warning',
        'Check-In Shift Terlebih Dahulu',
        'Silakan lakukan Check-In terlebih dahulu untuk mengaktifkan pengisian checklist & keluar gerbang.'
      );
      setCheckinModalMode('checkin');
      setIsCheckinModalOpen(true);
      return;
    }

    if (!hasChecklistToday && !isChecklistCompletedAfterCheckin && !isUserHelperRole) {
      addNotification(
        'delivery',
        'Lengkapi Checklist Armada',
        'Silakan lengkapi dan simpan Checklist Armada (Inspeksi Pra-Jalan) terlebih dahulu.'
      );
      const targetFleet = assignedFleet || delivery.fleet || fleets[0];
      if (targetFleet?.id) {
        setSelectedFleetId(targetFleet.id);
        setIsFleetLockedAfterCheckin(true);
        try {
          localStorage.setItem(`akk_locked_fleet_${selectedDriverId}`, targetFleet.id);
          localStorage.setItem(`akk_fleet_locked_flag_${selectedDriverId}`, 'true');
        } catch {}
      }
      const fresh = driverChecklistService.createNewChecklistTemplate(
        selectedDriverId,
        currentDriver?.name || portalDisplayName || 'Driver',
        targetFleet?.id || 'fl-01',
        targetFleet?.plateNumber || 'P 8848 U',
        targetFleet?.vehicleType || 'Engkel Long Box'
      );
      setActiveChecklistToEdit(fresh);
      setChecklistInspectionType('pre_trip');
      setIsChecklistModalOpen(true);
      return;
    }

    const nowTime =
      new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) + ' WIB';
    const nextMap = { ...keluarArgoMap, [delivery.id]: nowTime };
    setKeluarArgoMap(nextMap);
    setSjKeluarSistemMap(nextMap);
    try {
      localStorage.setItem('akk_driver_keluar_argo_v1', JSON.stringify(nextMap));
      localStorage.setItem('akk_driver_sj_sistem_v1', JSON.stringify(nextMap));
    } catch {}

    updateSharedScheduleFlow([delivery.id], {
      fleetId: assignedFleet?.id || delivery.fleetId,
      plateNumber: assignedFleet?.plateNumber || delivery.fleet?.plateNumber || '-',
      vehicleType: assignedFleet?.vehicleType || delivery.fleet?.vehicleType || '-',
      checklistCompleted: true,
      checklistCompletedBy: sharedCrewPreTripState.completedBy || portalDisplayName,
      preparedForGateOut: true,
      preparedBy: portalDisplayName
    });

    const preparedSchedule: Schedule = {
      ...delivery,
      fleet: assignedFleet || delivery.fleet,
      fleetId: assignedFleet?.id || delivery.fleetId
    };
    const wb = driverWaybillService.getWaybillForSchedule(preparedSchedule);
    if (delivery.status === 'scheduled' && wb.status !== 'in_transit') {
      driverWaybillService.updateWaybillStatus(wb.id, 'checker_verified');
    }
    setWaybillRefreshTick(t => t + 1);

    // Langsung arahkan ke tab SJ Keluar pada bagian Siap Out (untuk cetak SJ & klik Gate-Out)
    setBottomNav('surat_jalan');
    setWaybillStatusFilter(wb.status === 'in_transit' ? 'in_transit' : 'gate_out');
    try {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch {}

    addNotification(
      'delivery',
      'Persiapan Keluar • Siap Gate-Out',
      `Jadwal ${delivery.areaName || delivery.store?.storeName || 'Pengiriman'} siap keluar (${wb.waybillNumber}). Silakan cetak SJ atau klik Gate-Out saat keluar gudang.`
    );
  };

  // Konfirmasi Gate-Out Terintegrasi (Driver & Helper): Saat salah satu klik Gate-Out, status jadwal & SJ langsung menjadi Di Jalan / Siap Print SJ untuk keduanya
  const handleConfirmSharedGateOut = async (delivery: Schedule) => {
    const preparedSchedule: Schedule = {
      ...delivery,
      status: 'in_transit',
      fleet: assignedFleet || delivery.fleet,
      fleetId: assignedFleet?.id || delivery.fleetId
    };
    const wb = driverWaybillService.getWaybillForSchedule(preparedSchedule);
    driverWaybillService.updateWaybillStatus(wb.id, 'in_transit');

    const gateOutIso = new Date().toISOString();
    updateSharedScheduleFlow([delivery.id], {
      fleetId: preparedSchedule.fleetId,
      plateNumber: preparedSchedule.fleet?.plateNumber || '-',
      vehicleType: preparedSchedule.fleet?.vehicleType || '-',
      checklistCompleted: true,
      preparedForGateOut: true,
      gateOutConfirmed: true,
      gateOutBy: portalDisplayName,
      gateOutTimestamp: gateOutIso
    });

    await handleUpdateStatus(
      delivery,
      'in_transit',
      `Tim pengiriman keluar dari gerbang gudang DC (Gate-Out oleh ${portalDisplayName})`
    );
    setWaybillRefreshTick(t => t + 1);
    setBottomNav('surat_jalan');
    setWaybillStatusFilter('in_transit');
    addNotification(
      'schedule',
      'Gate-Out Dikonfirmasi • Siap Cetak SJ (SJ Print)',
      `Armada ${preparedSchedule.fleet?.plateNumber || ''} resmi keluar gerbang DC. Surat Jalan (${wb.waybillNumber}) kini siap dicetak oleh Driver & Helper.`
    );
  };

  // Submit delay report (Lapor Kendala Pengiriman)
  const submitDelayReport = async () => {
    if (!delayModal.delivery) return;
    const notes = `KENDALA: ${delayModal.reason}${delayModal.customNote ? ` - ${delayModal.customNote}` : ''}`;
    await handleUpdateStatus(delayModal.delivery, 'delayed', notes);

    // Otomatis terdata ke modul Laporan Kiriman Kru untuk SPV Logistik
    driverReportService.addReport({
      driverId: selectedDriverId,
      driverName: currentDriver?.name || 'Driver',
      helperName: delayModal.delivery?.crewHelper?.name,
      plateNumber: assignedFleet?.plateNumber || delayModal.delivery?.fleet?.plateNumber || '-',
      category: 'kendala_jalan',
      areaName: delayModal.delivery.areaName || delayModal.delivery.store?.storeName || 'Area Distribusi',
      deliveryId: delayModal.delivery.id,
      notes,
      photoUrl: null
    });

    addNotification('sla_warning', 'Laporan Kendala Terkirim', `Kendala "${delayModal.reason}" telah diteruskan ke SPV Logistik.`);
    setDelayModal({ isOpen: false, delivery: null, reason: 'Driver / Helper Tidak Masuk (Harus Segera Diganti)', customNote: '' });
  };

  // Submit transfer request (Minta Oper Jadwal) - Terintegrasi dengan Jadwal, Penugasan & Laporan Kiriman Kru
  const submitTransferRequest = async () => {
    if (!transferModal.delivery) return;
    const targetArea = transferModal.delivery.areaName || transferModal.delivery.store?.storeName || 'Area Distribusi';
    const driverName = currentDriver?.name || 'Driver';
    const notes = `[OPER JADWAL: ${transferModal.reason} (${transferModal.transferType})${transferModal.constraintNote ? ` - Kendala: ${transferModal.constraintNote}` : ''}]`;
    
    const transferData = {
      status: 'pending' as const,
      requestedAt: new Date().toISOString(),
      requestedByDriverId: selectedDriverId,
      requestedByDriverName: driverName,
      reason: transferModal.reason,
      transferType: transferModal.transferType,
      gpsPhotoUrl: transferModal.gpsPhotoUrl,
      constraintNote: transferModal.constraintNote,
      notes: transferModal.constraintNote
    };

    // 1. Integrasikan langsung ke data jadwal di logisticsStore & penugasan
    logisticsStore.updateSchedule(transferModal.delivery.id, {
      transferRequest: transferData,
      notes
    });

    // 2. Kirim permintaan pertukaran shift ke pool antrean (Plot ulang kru pengganti)
    logisticsStore.submitSwapShiftRequest({
      requesterCrewId: selectedDriverId,
      requesterCrewName: driverName,
      targetCrewId: 'unassigned',
      targetCrewName: 'SPV Logistik (Plot Ulang Kru Pengganti)',
      shiftDate: transferModal.delivery.departureDate || new Date().toISOString().split('T')[0],
      reason: `${transferModal.reason} (${transferModal.transferType}) - ${targetArea}`
    });

    // 3. Rekam ke menu Laporan Kiriman Kru & Kendala Oper Jadwal
    driverReportService.addReport({
      driverId: selectedDriverId,
      driverName,
      helperName: transferModal.delivery?.crewHelper?.name,
      plateNumber: assignedFleet?.plateNumber || transferModal.delivery?.fleet?.plateNumber || '-',
      category: 'kendala_jalan',
      areaName: targetArea,
      deliveryId: transferModal.delivery.id,
      notes: `[KENDALA OPER JADWAL] Alasan: ${transferModal.reason} (${transferModal.transferType}). Catatan: ${transferModal.constraintNote || 'Tanpa catatan'}`,
      photoUrl: transferModal.gpsPhotoUrl
    });

    // 4. Catat ke System Activity Log
    logisticsStore.logActivity(
      'Permintaan Oper Jadwal & Kendala',
      transferModal.delivery.trackingNumber,
      `[OPER JADWAL] Driver ${driverName} meminta oper rute ${targetArea}. Alasan: ${transferModal.reason} (${transferModal.transferType}). Kendala: ${transferModal.constraintNote}. SPV Logistik segera plot kru pengganti agar tidak terjadi double kiriman.`
    );

    // 5. Notifikasi prioritas tinggi ke SPV Logistik & Super Admin
    addNotification(
      'schedule',
      '🚨 PERMINTAAN OPER JADWAL & KENDALA (SPV Logistik & Super Admin)',
      `Driver ${driverName} mengajukan oper rute ${targetArea} (${transferModal.reason}). Segera input kru pengganti di menu jadwal & penugasan untuk mencegah double kiriman.`,
      true
    );

    setTransferModal({
      isOpen: false,
      delivery: null,
      reason: 'Darurat / Halangan pribadi',
      transferType: 'Oper ke driver lain (Driver cari pengganti)',
      gpsPhotoUrl: 'https://images.unsplash.com/photo-1526778548025-fa2f459cd5c1?w=600&auto=format&fit=crop&q=80',
      constraintNote: ''
    });
    await loadDeliveries(true);
  };

  // Hapus jadwal pengiriman (Khusus SPV Logistik & Super Admin)
  const handleDeleteCompletedSchedule = async () => {
    if (!deleteConfirmModal.delivery) return;
    if (!canManageAllPortalSchedules) {
      addNotification('delivery', 'Akses Ditolak', 'Hanya SPV Logistik dan Super Admin yang berhak menghapus jadwal pengiriman.');
      return;
    }

    logisticsStore.deleteSchedule(deleteConfirmModal.delivery.id);
    addNotification(
      'delivery',
      'Jadwal Dihapus',
      `Jadwal pengiriman (${deleteConfirmModal.delivery.areaName || deleteConfirmModal.delivery.store?.storeName || 'Rute'}) berhasil dihapus oleh ${syncedUserRoleInfo.roleLabel}.`
    );
    setDeleteConfirmModal({ isOpen: false, delivery: null });
    await loadDeliveries(true);
  };

  // Photo captured callback from DriverPodCameraModal
  const handlePhotoCaptured = (photoDataUrl: string, timestamp: string) => {
    if (!cameraModal.delivery) return;
    const target = cameraModal.delivery;

    // Attach to schedule in local store
    logisticsStore.attachImageToSchedule(
      target.id,
      photoDataUrl,
      'proof_of_delivery',
      `Foto barang diterima di ${target.store?.storeName || 'toko'}`
    );

    // Update local state deliveries optimistically
    setDeliveries(prev => prev.map(d => d.id === target.id ? {
      ...d,
      podPhotoUrl: photoDataUrl,
      podPhotoTimestamp: timestamp
    } : d));

    // If POD modal is open or corresponds to this delivery, update its photo state
    setPodModal(prev => {
      if (prev.delivery?.id === target.id || !prev.delivery) {
        return {
          ...prev,
          isOpen: true,
          delivery: target,
          photoUrl: photoDataUrl,
          photoTimestamp: timestamp
        };
      }
      return prev;
    });

    addNotification(
      'delivery',
      'Foto GPS Gudang Disimpan',
      `Foto GPS tiba di gudang untuk ${target.trackingNumber} berhasil dilampirkan.`
    );

    setCameraModal({ isOpen: false, delivery: null });
  };

  // Submit Konfirmasi Tiba di Gudang Argo (POD)
  const submitPod = async () => {
    if (!podModal.delivery) return;
    const choice = podModal.postTripFleetStatus || 'available';
    if (choice === 'maintenance' && !podModal.serviceNote.trim()) {
      addNotification(
        'sla_warning',
        'Keterangan Servis Wajib Diisi',
        'Mohon isi bagian apa yang perlu diservis/diperbaiki pada armada.'
      );
      return;
    }

    const statusText = choice === 'available'
      ? 'Aman Tidak Perlu Servis'
      : `Perlu Perawatan (Servis: ${podModal.serviceNote.trim()})`;
    const podNote = `Tiba di Gudang Argo${podModal.conditionNote.trim() ? `: ${podModal.conditionNote.trim()}` : ''} • Status Armada Sampai di Argo: ${statusText}`;

    const podData = {
      podPhotoUrl: podModal.photoUrl || undefined,
      podPhotoTimestamp: podModal.photoTimestamp || new Date().toISOString(),
      podReceiverName: 'Gudang Argo DC',
      podConditionNote: `${podModal.conditionNote.trim() || 'Tiba di Gudang Argo'} [${statusText}]`
    };

    const targetDelivery = podModal.delivery;
    const argoArrivalIso = podData.podPhotoTimestamp || new Date().toISOString();
    updateSharedScheduleFlow([targetDelivery.id], {
      argoArrivalTimestamp: argoArrivalIso,
      argoArrivalBy: portalDisplayName
    });
    await handleUpdateStatus(targetDelivery, 'delivered', podNote, podData, choice);
    // Pastikan waybill ter-generate dan berstatus 'delivered' agar muncul di SJ Keluar & Selesai
    driverWaybillService.getWaybillForSchedule({
      ...targetDelivery,
      status: 'delivered',
      fleet: assignedFleet || targetDelivery.fleet,
      fleetId: assignedFleet?.id || targetDelivery.fleetId
    });
    driverWaybillService.updateWaybillStatus(`WB-${targetDelivery.id}`, 'delivered', podNote);
    setWaybillRefreshTick(t => t + 1);

    // Rekam ke Laporan Kiriman Kru agar SPV Logistik tahu status armada sampai di Argo & servis jika ada
    driverReportService.addReport({
      driverId: selectedDriverId,
      driverName: currentDriver?.name || portalDisplayName,
      userRole: syncedUserRoleInfo.roleLabel,
      helperName: targetDelivery?.crewHelper?.name,
      plateNumber: assignedFleet?.plateNumber || targetDelivery?.fleet?.plateNumber || '-',
      category: 'akhir_kiriman',
      areaName: targetDelivery.areaName || targetDelivery.store?.storeName || 'Gudang Argo',
      deliveryId: targetDelivery.id,
      notes: podNote,
      photoUrl: podModal.photoUrl
    });

    // Jika dalam kondisi Check-In (activeShift), otomatis terhitung Check-Out saat klik Konfirmasi Tiba di Gudang (termasuk sinkronisasi shift partner di armada yang sama)
    let autoCheckedOut = false;
    const currentActiveShift = activeShift || driverShiftService.getActiveShift(selectedDriverId);
    if (currentActiveShift) {
      const targetDriverId = currentActiveShift.driverId || selectedDriverId;
      await driverShiftService.checkOutDriver(
        targetDriverId,
        undefined,
        {
          driverName: currentDriver?.name || currentActiveShift.driverName || portalDisplayName,
          userRole: syncedUserRoleInfo.roleLabel,
          plateNumber: assignedFleet?.plateNumber || currentActiveShift.plateNumber || targetDelivery?.fleet?.plateNumber || '-',
          areaName: targetDelivery.areaName || targetDelivery.store?.storeName || 'Gudang Argo'
        }
      );
      setActiveShift(null);
      autoCheckedOut = true;
    }

    const todayStr = new Date().toISOString().slice(0, 10);
    setHasConfirmedArrivalFlag(true);
    try {
      localStorage.setItem(`akk_confirmed_arrival_${selectedDriverId}`, todayStr);
    } catch {}

    setPodModal({
      isOpen: false,
      delivery: null,
      conditionNote: '',
      serviceNote: '',
      hasSignature: true,
      photoUrl: null,
      photoTimestamp: null,
      postTripFleetStatus: 'available'
    });

    // Arahkan tab langsung ke 'delivered' (Selesai) agar jadwal yang baru selesai langsung terlihat di Selesai & Semua
    setActiveTab('delivered');
    await loadDeliveriesRef.current(true);

    // Otomatis munculkan form Checklist Pasca-Jalan (Pulang) setelah klik Konfirmasi Tiba di Gudang
    const postTripTemplate = driverChecklistService.createNewChecklistTemplate(
      selectedDriverId,
      currentDriver?.name || portalDisplayName || 'Driver',
      assignedFleet?.id || targetDelivery.fleet?.id || '',
      assignedFleet?.plateNumber || targetDelivery.fleet?.plateNumber || '-',
      assignedFleet?.vehicleType || targetDelivery.fleet?.vehicleType || '-',
      0
    );
    postTripTemplate.inspectionType = 'post_trip';
    setActiveChecklistToEdit(postTripTemplate);
    setChecklistInspectionType('post_trip');
    setIsChecklistModalOpen(true);

    addNotification(
      'delivery',
      autoCheckedOut
        ? 'Tiba di Gudang • Masuk Tab Selesai & Isi Checklist Pulang'
        : 'Konfirmasi Tiba di Gudang • Masuk Tab Selesai',
      `Armada ${targetDelivery.fleet?.plateNumber || assignedFleet?.plateNumber || ''} tiba di Gudang Argo (${statusText}). Jadwal telah masuk ke tab Selesai & Semua serta Surat Jalan Keluar.`
    );
  };

  // Status badge helper
  const getStatusBadge = (status: ShipmentStatus) => {
    switch (status) {
      case 'scheduled':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/30">
            <Clock className="w-3 h-3" />
            <span>Terjadwal</span>
          </span>
        );
      case 'picked_up':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-cyan-400 bg-cyan-500/10 px-2 py-0.5 rounded-full border border-cyan-500/30">
            <Package className="w-3 h-3" />
            <span>Siap Kirim</span>
          </span>
        );
      case 'in_transit':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded-full border border-blue-500/30 animate-pulse">
            <Truck className="w-3 h-3" />
            <span>In Transit (Jalan)</span>
          </span>
        );
      case 'delivered':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/30">
            <CheckCircle2 className="w-3 h-3" />
            <span>Terkirim (Delivered)</span>
          </span>
        );
      case 'delayed':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded-full border border-rose-500/30">
            <AlertTriangle className="w-3 h-3" />
            <span>Tertunda (Delayed)</span>
          </span>
        );
      default:
        return null;
    }
  };

  if (!isDriverLoggedIn) {
    return (
      <div className="w-full max-w-md mx-auto bg-slate-950 min-h-screen text-slate-100 flex flex-col justify-center p-6 shadow-2xl relative border-x border-slate-900">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full overflow-hidden shadow-2xl relative">
          {/* Modal Brand Header */}
          <div className="p-6 bg-gradient-to-b from-slate-950 via-slate-900 to-slate-900 border-b border-slate-800 text-center">
            <div className="flex justify-center mb-3">
              <AkkLogo size="lg" />
            </div>
            <p className="text-slate-400 text-xs mt-2 max-w-md mx-auto">
              Portal Akses Logistik Terintegrasi & Pengiriman Luar Pulau PT Anugrah Kemasan Kreatif.
            </p>

            {/* Tab Switcher */}
            <div className="flex items-center justify-center gap-2 mt-5 bg-slate-950 p-1 rounded-xl border border-slate-800 max-w-xs mx-auto">
              <button
                onClick={() => { setAuthTab('login'); setErrorMsg(''); }}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-bold transition ${
                  authTab === 'login'
                    ? 'bg-amber-500 text-slate-950 shadow'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <LogIn className="w-3.5 h-3.5" />
                <span>Masuk (Login)</span>
              </button>
              <button
                onClick={() => { setAuthTab('register'); setErrorMsg(''); }}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-bold transition ${
                  authTab === 'register'
                    ? 'bg-amber-500 text-slate-950 shadow'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>Daftar Akun</span>
              </button>
            </div>
          </div>

          {/* Notifications */}
          {errorMsg && (
            <div className="mx-6 mt-4 p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="mx-6 mt-4 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
              <span>{successMsg}</span>
            </div>
          )}

          {authTab === 'login' ? (
            <form onSubmit={handleDriverLoginSubmit} className="p-6 space-y-4 text-xs">
              <div>
                <label className="text-slate-300 font-semibold block mb-1">Email / Username</label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
                  <input
                    type="text"
                    required
                    placeholder="admin atau nama@gmail.com"
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                    className="w-full pl-10 pr-3 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              <div>
                <label className="text-slate-300 font-semibold block mb-1">Password</label>
                <div className="relative">
                  <KeyRound className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    placeholder="••••••••"
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    className="w-full pl-10 pr-10 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-3 text-slate-400 hover:text-white"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                className="w-full py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs shadow-lg shadow-amber-500/20 transition cursor-pointer flex items-center justify-center gap-2 mt-2"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Masuk ke Portal AKK</span>
              </button>
            </form>
          ) : (
            <form onSubmit={handleRegister} className="p-6 space-y-3 text-xs">
              <div>
                <label className="text-slate-300 font-semibold block mb-1">Nama Lengkap</label>
                <input
                  type="text"
                  required
                  placeholder="Nama Lengkap Anda"
                  value={registerData.fullName}
                  onChange={(e) => setRegisterData({ ...registerData, fullName: e.target.value })}
                  className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="text-slate-300 font-semibold block mb-1">Email / Username</label>
                <input
                  type="text"
                  required
                  placeholder="email@domain.com"
                  value={registerData.email}
                  onChange={(e) => setRegisterData({ ...registerData, email: e.target.value })}
                  className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="text-slate-300 font-semibold block mb-1">Nomor WhatsApp</label>
                <input
                  type="text"
                  required
                  placeholder="08123456789"
                  value={registerData.phone}
                  onChange={(e) => setRegisterData({ ...registerData, phone: e.target.value })}
                  className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="text-slate-300 font-semibold block mb-1">Password</label>
                <input
                  type="password"
                  required
                  placeholder="••••••••"
                  value={registerData.password}
                  onChange={(e) => setRegisterData({ ...registerData, password: e.target.value })}
                  className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 font-mono"
                />
              </div>

              <div>
                <label className="text-slate-300 font-semibold block mb-1">Konfirmasi Password</label>
                <input
                  type="password"
                  required
                  placeholder="••••••••"
                  value={registerData.confirmPassword}
                  onChange={(e) => setRegisterData({ ...registerData, confirmPassword: e.target.value })}
                  className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 font-mono"
                />
              </div>

              <button
                type="submit"
                className="w-full py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs shadow-lg shadow-amber-500/20 transition cursor-pointer flex items-center justify-center gap-2 mt-2"
              >
                <UserPlus className="w-4 h-4" />
                <span>Kirim Pendaftaran Akun</span>
              </button>
            </form>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-md mx-auto bg-slate-950 min-h-screen text-slate-100 pb-24 shadow-2xl relative border-x border-slate-900 flex flex-col">
      {/* Top Mobile App Bar */}
      <header className="sticky top-0 z-30 bg-slate-900/95 backdrop-blur-md border-b border-slate-800 px-4 py-3 shadow-sm">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-blue-600/15 border border-blue-500/30 flex items-center justify-center text-blue-400 shrink-0 font-bold">
              <Truck className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                <span>Driver AKK Mobile</span>
                <span>•</span>
                <span className="inline-flex items-center gap-1 text-blue-400">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />
                  {isSupabaseLive ? 'Live DB' : 'Local DB'}
                </span>
              </div>
              <h1 className="text-sm font-bold text-white truncate">
                Portal Operasional Kru
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            {/* Network & Offline Queue Pill */}
            <button
              onClick={() => setIsQueueModalOpen(true)}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border text-[11px] font-bold transition active:scale-95 cursor-pointer ${
                !syncState.isOnline || syncState.isSimulatedOffline
                  ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                  : syncState.pendingQueue.length > 0
                  ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40 animate-pulse'
                  : 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
              }`}
              title="Status koneksi internet & antrean sinkronisasi offline (IndexedDB)"
            >
              {!syncState.isOnline || syncState.isSimulatedOffline ? (
                <>
                  <WifiOff className="w-3.5 h-3.5 text-amber-400" />
                  <span>Offline {syncState.pendingQueue.length > 0 ? `(${syncState.pendingQueue.length})` : ''}</span>
                </>
              ) : syncState.pendingQueue.length > 0 ? (
                <>
                  <UploadCloud className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Sync ({syncState.pendingQueue.length})</span>
                </>
              ) : (
                <>
                  <Wifi className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Online</span>
                </>
              )}
            </button>

            {/* Notifikasi Solusi Kendala dari SPV Logistik / Super Admin */}
            <button
              onClick={() => setIsDriverNotifDrawerOpen(prev => !prev)}
              className="relative p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-amber-400 transition active:scale-95 cursor-pointer border border-slate-700/80"
              title="Notifikasi Solusi Kendala dari SPV Logistik / Super Admin"
            >
              <Bell className="w-4 h-4" />
              {activeDriverSolutions.filter(s => !s.driverAcknowledged).length > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full bg-rose-500 text-white text-[9px] font-black flex items-center justify-center animate-pulse">
                  {activeDriverSolutions.filter(s => !s.driverAcknowledged).length}
                </span>
              )}
            </button>

            <button
              onClick={() => {
                setIsRefreshing(true);
                loadDeliveries();
              }}
              disabled={isRefreshing}
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition active:scale-95 cursor-pointer disabled:opacity-50"
              title="Perbarui Data Pengiriman"
            >
              <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-amber-400' : ''}`} />
            </button>
          </div>
        </div>

        {/* Fitur Hari, Tanggal, dan Waktu Realtime di Tampilan Portal */}
        <div className="mt-2.5 px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between gap-2 text-[11px]">
          <div className="flex items-center gap-1.5 text-slate-200 font-semibold truncate">
            <Calendar className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            <span className="truncate">{realtimeDayDateStr}</span>
          </div>
          <div className="flex items-center gap-1.5 font-mono font-black text-amber-400 shrink-0 bg-amber-500/10 px-2 py-0.5 rounded-lg border border-amber-500/30">
            <Clock className="w-3 h-3 text-amber-400 animate-pulse" />
            <span>{realtimeTimeStr}</span>
          </div>
        </div>
      </header>

      {/* 🔔 BANNER NOTIFIKASI KHUSUS SOLUSI KENDALA DARI SPV LOGISTIK / SUPER ADMIN */}
      {latestSolutionBanner && (
        <div className="px-4 py-3 border-b bg-amber-950/90 border-amber-500/50 text-amber-100 text-xs flex items-start justify-between gap-3 animate-fadeIn shrink-0">
          <div className="flex items-start gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-amber-500/20 text-amber-300 border border-amber-500/40 flex items-center justify-center shrink-0 mt-0.5">
              <Sparkles className="w-4 h-4 animate-pulse" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 font-black text-xs text-amber-300">
                <span>{latestSolutionBanner.title}</span>
                <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-500/20 border border-amber-500/30 font-mono uppercase">
                  {latestSolutionBanner.solutionBy}
                </span>
              </div>
              <p className="text-[11px] text-slate-100 mt-0.5 leading-relaxed">
                {latestSolutionBanner.message}
              </p>
            </div>
          </div>
          <button
            onClick={() => setLatestSolutionBanner(null)}
            className="p-1 rounded-lg hover:bg-white/10 text-slate-300 hover:text-white shrink-0 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* 🔔 DRAWER NOTIFIKASI KHUSUS SOLUSI KENDALA (SPV LOGISTIK / SUPER ADMIN) */}
      {isDriverNotifDrawerOpen && (
        <div className="bg-slate-900 border-b border-slate-800 px-4 py-3.5 space-y-3 text-xs shadow-xl animate-fadeIn shrink-0">
          <div className="flex items-center justify-between gap-2 pb-2 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <Bell className="w-4 h-4 text-amber-400" />
              <div>
                <div className="font-black text-white text-xs">
                  Notifikasi Solusi Kendala ({portalDisplayName})
                </div>
                <div className="text-[10px] text-slate-400">
                  Hanya menampilkan arahan &amp; solusi kendala dari SPV Logistik / Super Admin
                </div>
              </div>
            </div>
            <button
              onClick={() => setIsDriverNotifDrawerOpen(false)}
              className="p-1 rounded-lg bg-slate-800 text-slate-400 hover:text-white cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          {activeDriverSolutions.length === 0 ? (
            <div className="py-5 text-center text-slate-400 text-[11px] bg-slate-950/60 rounded-xl border border-slate-800/80">
              Belum ada notifikasi solusi kendala dari SPV Logistik atau Super Admin.
            </div>
          ) : (
            <div className="max-h-60 overflow-y-auto space-y-2 pr-1">
              {activeDriverSolutions.map(sol => (
                <div
                  key={sol.id}
                  className={`p-2.5 rounded-xl border transition ${
                    !sol.driverAcknowledged
                      ? 'bg-slate-950 border-amber-500/40 text-white'
                      : 'bg-slate-950/50 border-slate-800 text-slate-300'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-bold text-[11px] text-amber-300">
                      Solusi Kendala: {sol.areaName}
                    </span>
                    <span className="text-[9px] text-slate-400 font-mono">
                      {sol.solutionBy || 'SPV Logistik'}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-200 mt-1 leading-relaxed">{sol.solution}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 📶 PERSISTENT OFFLINE MODE WARNING BANNER (PERINGATAN TIM PENGIRIMAN UNTUK SEGERA ONLINE KEMBALI) */}
      {(!syncState.isOnline || syncState.isSimulatedOffline) && (
        <div className="bg-gradient-to-r from-rose-950/95 via-amber-950/90 to-rose-950/95 border-b border-rose-500/50 px-4 py-3 text-xs shadow-lg space-y-2 animate-fadeIn shrink-0">
          <div className="flex items-start justify-between gap-2.5">
            <div className="flex items-start gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-lg bg-rose-500/20 border border-rose-500/40 flex items-center justify-center text-rose-400 shrink-0 mt-0.5">
                <WifiOff className="w-4 h-4 animate-pulse" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 font-black text-rose-300 text-xs flex-wrap">
                  <span>⚠️ PERINGATAN MODE OFFLINE AKTIF ({portalDisplayName})</span>
                  <span className="text-[9px] px-1.5 py-0.5 rounded bg-rose-500/25 text-rose-200 border border-rose-500/40 font-mono">
                    Tercatat di Laporan Tim Pengiriman
                  </span>
                </div>
                <p className="text-[11px] text-amber-100/90 leading-snug mt-0.5">
                  Harap <strong>segera di-online-kan kembali</strong> agar posisi GPS dan status pengiriman langsung terkirim ke server pusat!
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-1 border-t border-rose-500/20">
            <button
              type="button"
              onClick={() => setIsQueueModalOpen(true)}
              className="px-2.5 py-1.5 rounded-lg bg-slate-900/90 hover:bg-slate-800 text-amber-300 border border-amber-500/30 font-bold text-[11px] transition cursor-pointer"
            >
              Cek Laporan &amp; Antrean ({syncState.pendingQueue.length})
            </button>
            {syncState.isSimulatedOffline && (
              <button
                type="button"
                onClick={() => handleToggleOfflineMode(false)}
                className="px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-[11px] flex items-center gap-1.5 shadow-md transition cursor-pointer active:scale-95"
              >
                <Wifi className="w-3.5 h-3.5" />
                <span>Onlinekan Kembali Sekarang</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* 🌐 ONLINE PENDING SYNC BANNER */}
      {syncState.isOnline && !syncState.isSimulatedOffline && syncState.pendingQueue.length > 0 && (
        <div className="bg-gradient-to-r from-blue-950/90 via-slate-900 to-emerald-950/90 border-b border-cyan-500/40 px-4 py-2.5 text-xs shadow-md flex items-center justify-between gap-3 animate-fadeIn shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center text-cyan-400 shrink-0">
              <UploadCloud className="w-4 h-4 animate-bounce" />
            </div>
            <div className="min-w-0">
              <div className="font-bold text-cyan-300 text-xs">
                Koneksi Pulih • {syncState.pendingQueue.length} Tugas Menunggu Sync
              </div>
              <p className="text-[11px] text-slate-300 leading-tight truncate">
                Tersimpan di memori lokal HP saat offline, siap dikirim ke server kantor pusat.
              </p>
            </div>
          </div>
          <button
            onClick={async () => {
              const res = await driverOfflineSyncService.syncQueue();
              if (res.synced > 0) {
                addNotification(
                  'delivery',
                  'Sinkronisasi Sukses',
                  `${res.synced} pembaruan tugas berhasil dikirim ke server pusat.`
                );
                loadDeliveries(true);
              }
            }}
            disabled={syncState.isSyncingQueue}
            className="px-3 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-black text-[11px] shrink-0 flex items-center gap-1 shadow transition cursor-pointer active:scale-95 disabled:opacity-50"
          >
            <RefreshCw className={`w-3 h-3 ${syncState.isSyncingQueue ? 'animate-spin' : ''}`} />
            <span>{syncState.isSyncingQueue ? 'Mengirim...' : 'Sync Sekarang'}</span>
          </button>
        </div>
      )}

      {/* Main Content Area */}
      <main className="flex-1 px-4 py-3 space-y-4">
        {/* TAB 1: TUGAS PENGIRIMAN (MAIN VIEW) */}
        {bottomNav === 'deliveries' && (
          <>
            {/* 🕒 DRIVER SHIFT CHECK-IN & NEU-FLAT PERFORMANCE SUMMARY DASHBOARD */}
            <div ref={checkinSectionRef} className="neu-flat rounded-2xl p-4 space-y-3.5 shadow-xl border border-slate-800">
              {/* Header Profile & Shift Status Bar (Satu Nama Akun + Keterangan Role) */}
              <div className="flex items-center justify-between pb-3 border-b border-slate-800/80">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-10 h-10 rounded-xl neu-flat-sm flex items-center justify-center text-amber-400 shrink-0 font-black">
                    {portalInitials}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-black text-xs text-white truncate">
                        {portalDisplayName}
                      </span>
                      <span className={`text-[9px] px-1.5 py-0.5 rounded border shrink-0 font-mono font-bold ${
                        syncedUserRoleInfo.roleLabel === 'Helper'
                          ? 'text-cyan-400 bg-cyan-500/10 border-cyan-500/30'
                          : 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30'
                      }`}>
                        Role: {syncedUserRoleInfo.roleLabel}
                      </span>
                    </div>
                    {(() => {
                      const fleetLive = assignedFleet
                        ? logisticsStore.getFleetLiveOperationalInfo(assignedFleet)
                        : null;
                      return (
                        <div className="text-[10px] text-slate-400 flex items-center gap-1.5 flex-wrap mt-1">
                          <span>Armada:</span>
                          <span className="text-amber-400 font-bold">{assignedFleet?.plateNumber || 'P 8509 VQ'}</span>
                          {fleetLive && (
                            <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold border ${fleetLive.badgeColorClass}`}>
                              <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${fleetLive.dotColorClass}`} />
                              <span>{fleetLive.statusLabel}</span>
                              {fleetLive.areaName && (
                                <span className="opacity-90">• {fleetLive.areaName}</span>
                              )}
                            </span>
                          )}
                        </div>
                      );
                    })()}
                  </div>
                </div>

                {!activeShift ? (
                  <button
                    type="button"
                    onClick={() => {
                      setCheckinModalMode('checkin');
                      setIsCheckinModalOpen(true);
                    }}
                    className={`px-3.5 py-2 rounded-xl text-slate-950 font-black text-xs shrink-0 flex items-center gap-1.5 shadow-md transition active:scale-95 cursor-pointer ${
                      highlightCheckin
                        ? 'bg-amber-400 ring-4 ring-amber-400/50 scale-105 animate-pulse'
                        : 'bg-amber-500 hover:bg-amber-400 shadow-amber-500/25'
                    }`}
                  >
                    <KeyRound className="w-3.5 h-3.5" />
                    <span>Check-In</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setIsCheckoutModalOpen(true);
                    }}
                    className="px-2.5 py-1.5 rounded-xl neu-button text-emerald-400 text-[10px] font-bold flex items-center gap-1 transition cursor-pointer active:scale-95"
                  >
                    <ShieldCheck className="w-3.5 h-3.5" />
                    <span>Aktif ({activeShift.checkinTimeFormatted})</span>
                  </button>
                )}
              </div>

              {/* Current Shift's Performance Metrics Summary (Neu-Pressed Grid) */}
              <div className="grid grid-cols-3 gap-2 text-center">
                <div 
                  onClick={() => setActiveTab('active')}
                  className="neu-pressed p-2.5 rounded-xl cursor-pointer hover:border-blue-500/40 transition"
                >
                  <div className="text-lg font-black text-blue-400 tabular-nums">{activeDeliveries.length}</div>
                  <div className="text-[10px] font-bold uppercase tracking-wide text-slate-400 mt-0.5">Tugas Aktif</div>
                </div>
                <div 
                  onClick={() => setActiveTab('delivered')}
                  className="neu-pressed p-2.5 rounded-xl cursor-pointer hover:border-emerald-500/40 transition"
                >
                  <div className="text-lg font-black text-emerald-400 tabular-nums">{deliveredDeliveries.length} / {activeDeliveries.length + scheduledDeliveries.length + deliveredDeliveries.length}</div>
                  <div className="text-[10px] font-bold uppercase tracking-wide text-slate-400 mt-0.5">Terkirim</div>
                </div>
                <div 
                  onClick={() => setActiveTab('scheduled')}
                  className="neu-pressed p-2.5 rounded-xl cursor-pointer hover:border-amber-500/40 transition"
                >
                  <div className="text-lg font-black text-amber-400 tabular-nums">98.5%</div>
                  <div className="text-[10px] font-bold uppercase tracking-wide text-slate-400 mt-0.5">Ketepatan</div>
                </div>
              </div>

              {/* Native Device GPS Geolocation Status & Sync Bar */}
              <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between gap-2 text-[11px]">
                <div className="flex items-center gap-2 min-w-0">
                  <Compass className={`w-3.5 h-3.5 shrink-0 ${deviceGps.source === 'native' ? 'text-emerald-400' : 'text-amber-400'}`} />
                  <div className="truncate text-slate-300">
                    <span className="font-semibold text-white">GPS Perangkat:</span>{' '}
                    <span className="font-mono text-emerald-400">
                      {deviceGps.lat.toFixed(4)}, {deviceGps.lng.toFixed(4)}
                    </span>
                    <span className="text-slate-500"> · ±{deviceGps.accuracy}m</span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => syncDeviceGps(true)}
                  disabled={deviceGps.isSyncing}
                  className="px-2.5 py-1 rounded-lg bg-slate-950 hover:bg-slate-800 border border-slate-800 text-amber-400 font-bold text-[10px] flex items-center gap-1 shrink-0 transition cursor-pointer"
                >
                  <RefreshCw className={`w-3 h-3 ${deviceGps.isSyncing ? 'animate-spin' : ''}`} />
                  <span>{deviceGps.isSyncing ? 'Sync...' : 'Sync GPS'}</span>
                </button>
              </div>
            </div>

            {/* Camera Support Status Feedback Banner */}
            {cameraSupportStatus === 'blocked' && (
              <div className="bg-amber-500/15 border border-amber-500/40 rounded-2xl p-3 text-xs text-amber-200 flex items-start gap-2.5">
                <CameraOff className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <div className="space-y-1 flex-1">
                  <span className="font-bold text-white block">Akses Kamera Perangkat Dibatasi / Diblokir</span>
                  <p className="text-[11px] text-amber-300 leading-relaxed">
                    Peramban atau sistem perangkat membatasi akses kamera langsung. Anda tetap dapat mengambil foto bukti kirim dengan lancar menggunakan tombol <strong>Buka Kamera Bawaan HP</strong> saat mengambil foto.
                  </p>
                </div>
              </div>
            )}

            {/* 📢 ARAHAN & SOLUSI RESMI DARI SPV LOGISTIK / SUPER ADMIN (TERHUBUNG LANGSUNG) */}
            {activeDriverSolutions.length > 0 && (
              <div className="space-y-2.5">
                {activeDriverSolutions.map(sol => (
                  <div
                    key={sol.id}
                    className="bg-white dark:bg-slate-900 border-2 border-amber-400 dark:border-amber-500/60 rounded-2xl p-4 shadow-md space-y-3 relative overflow-hidden animate-in fade-in duration-300"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-xl bg-amber-100 dark:bg-amber-500/20 border border-amber-300 dark:border-amber-500/40 flex items-center justify-center text-amber-600 dark:text-amber-400 shrink-0">
                          <Sparkles className="w-4 h-4 animate-pulse" />
                        </div>
                        <div>
                          <span className="text-[10px] font-black uppercase tracking-wider text-amber-700 dark:text-amber-400 block">
                            Arahan Resmi SPV Logistik / Super Admin
                          </span>
                          <h4 className="text-xs font-black text-slate-900 dark:text-white">
                            Solusi Kendala: {sol.areaName} ({sol.driverName})
                          </h4>
                        </div>
                      </div>

                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                        sol.driverAcknowledged
                          ? 'bg-emerald-50 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-500/40'
                          : 'bg-amber-100 dark:bg-amber-500/20 text-amber-800 dark:text-amber-300 border-amber-300 dark:border-amber-500/40 animate-pulse'
                      }`}>
                        {sol.driverAcknowledged ? '✓ Dijalankan Kru' : 'Perlu Konfirmasi'}
                      </span>
                    </div>

                    <div className="bg-slate-50 dark:bg-slate-950/80 p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 text-xs text-slate-700 dark:text-slate-300">
                      <span className="text-[10px] text-slate-500 dark:text-slate-400 block font-semibold">Laporan / Kendala Kru:</span>
                      <p className="italic text-slate-800 dark:text-slate-200 mt-0.5 text-[11px]">&quot;{sol.notes}&quot;</p>
                    </div>

                    <div className="bg-amber-50/80 dark:bg-amber-500/10 border border-amber-300 dark:border-amber-500/30 p-3 rounded-xl space-y-1">
                      <span className="text-[11px] font-black text-amber-800 dark:text-amber-300 flex items-center gap-1.5">
                        <Send className="w-3.5 h-3.5" />
                        <span>Instruksi &amp; Arahan Tindakan SPV:</span>
                      </span>
                      <p className="text-slate-900 dark:text-white font-bold text-xs leading-relaxed">
                        {sol.solution}
                      </p>
                      <div className="text-[10px] text-amber-700 dark:text-amber-400/80 pt-1 flex items-center justify-between">
                        <span>Disampaikan oleh: <strong>{sol.solutionBy}</strong></span>
                        {sol.solutionAt && (
                          <span>{new Date(sol.solutionAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })} WIB</span>
                        )}
                      </div>
                    </div>

                    {!sol.driverAcknowledged ? (
                      <button
                        type="button"
                        onClick={() => {
                          driverReportService.acknowledgeReportSolution(sol.id);
                          loadDriverKendalaReports();
                          addNotification(
                            'delivery',
                            'Arahan Dikonfirmasi',
                            'Status arahan SPV telah diperbarui menjadi sedang dijalankan. Tetap utamakan keselamatan kerja!'
                          );
                        }}
                        className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs flex items-center justify-center gap-2 shadow-sm transition active:scale-95 cursor-pointer"
                      >
                        <Check className="w-4 h-4" />
                        <span>Konfirmasi Mengerti &amp; Mulai Jalankan Arahan</span>
                      </button>
                    ) : (
                      <div className="flex items-center justify-between text-[11px] text-emerald-700 dark:text-emerald-400 font-bold bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-500/30 p-2 rounded-xl">
                        <span className="flex items-center gap-1.5">
                          <CheckCircle2 className="w-4 h-4" />
                          <span>Anda telah mengonfirmasi arahan ini &amp; sedang bekerja sesuai solusi.</span>
                        </span>
                        <span className="text-[10px] text-slate-500 dark:text-slate-400 font-normal">
                          {sol.driverAcknowledgedAt ? new Date(sol.driverAcknowledgedAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : ''}
                        </span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Search Input Bar (Area Kirim, Helper, Driver) */}
            <div className="relative">
              <Search className="w-4 h-4 text-amber-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Cari area kirim, helper, driver..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-slate-900 border border-slate-800 text-slate-100 placeholder-slate-400 text-xs rounded-xl pl-10 pr-8 py-2.5 focus:outline-none focus:border-amber-500 shadow-inner"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Fitur Kalender / Filter Rentang Tanggal Kirim (Hanya Dari Tanggal s/d Sampai Tanggal) */}
            <div className="p-3.5 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-3 text-xs">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-600 dark:text-amber-400 shrink-0">
                    <Calendar className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="font-black text-slate-900 dark:text-white block leading-tight text-xs">
                      Filter Rentang Tanggal Kirim
                    </span>
                    <span className="text-[10px] text-slate-500 dark:text-slate-400 block mt-0.5">
                      {dateFilterStart || dateFilterEnd
                        ? `Rentang Aktif: ${dateFilterStart || 'Awal'} s/d ${dateFilterEnd || 'Akhir'}`
                        : 'Pilih Dari Tanggal dan Sampai Tanggal'}
                    </span>
                  </div>
                </div>

                {(dateFilterStart || dateFilterEnd) && (
                  <button
                    type="button"
                    onClick={() => {
                      setDateFilterStart('');
                      setDateFilterEnd('');
                    }}
                    className="px-2.5 py-1 rounded-lg bg-rose-500/15 hover:bg-rose-500/25 text-rose-600 dark:text-rose-300 border border-rose-500/30 text-[10px] font-bold transition cursor-pointer flex items-center gap-1 shrink-0"
                  >
                    <X className="w-3 h-3" />
                    <span>Reset</span>
                  </button>
                )}
              </div>

              {/* Input Dari Tanggal & Sampai Tanggal */}
              <div className="grid grid-cols-2 gap-2.5">
                <div className="bg-slate-50 dark:bg-slate-950/90 border border-slate-200 dark:border-slate-800 focus-within:border-amber-500 rounded-xl p-2.5 transition">
                  <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block mb-1">
                    Dari Tanggal
                  </label>
                  <input
                    type="date"
                    value={dateFilterStart}
                    onChange={(e) => setDateFilterStart(e.target.value)}
                    className="w-full bg-transparent text-slate-900 dark:text-white text-[11px] font-mono font-bold focus:outline-none cursor-pointer"
                  />
                </div>
                <div className="bg-slate-50 dark:bg-slate-950/90 border border-slate-200 dark:border-slate-800 focus-within:border-amber-500 rounded-xl p-2.5 transition">
                  <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block mb-1">
                    Sampai Tanggal
                  </label>
                  <input
                    type="date"
                    value={dateFilterEnd}
                    min={dateFilterStart || undefined}
                    onChange={(e) => setDateFilterEnd(e.target.value)}
                    className="w-full bg-transparent text-slate-900 dark:text-white text-[11px] font-mono font-bold focus:outline-none cursor-pointer"
                  />
                </div>
              </div>

              {/* Filter Jadwal Berdasarkan Kru & Aksi Kosongkan Jadwal (Khusus SPV Logistik & Super Admin) */}
              {canManageAllPortalSchedules && (
                <div className="pt-2 border-t border-slate-200 dark:border-slate-800 space-y-2">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <span className="text-[11px] font-bold text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
                      <Users className="w-3.5 h-3.5" />
                      <span>Mode {syncedUserRoleInfo.roleLabel}: Semua Jadwal Kru Terbaca</span>
                    </span>
                    {deliveries.length > 0 && (
                      <button
                        type="button"
                        onClick={() => {
                          logisticsStore.clearAllSchedules();
                          setDeliveries([]);
                          addNotification(
                            'schedule',
                            'Semua Jadwal Dikosongkan',
                            `Seluruh daftar jadwal pengiriman telah dikosongkan oleh ${syncedUserRoleInfo.roleLabel}.`
                          );
                        }}
                        className="px-2.5 py-1 rounded-lg bg-rose-500/15 hover:bg-rose-600 text-rose-600 dark:text-rose-300 hover:text-white border border-rose-500/30 text-[10px] font-bold flex items-center gap-1 transition cursor-pointer"
                      >
                        <Trash2 className="w-3 h-3" />
                        <span>Kosongkan Semua Jadwal</span>
                      </button>
                    )}
                  </div>
                  <select
                    value={spvCrewFilter}
                    onChange={(e) => setSpvCrewFilter(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:border-amber-500 cursor-pointer"
                  >
                    <option value="all">📋 Tampilkan Semua Jadwal Kru (Driver &amp; Helper)</option>
                    {logisticsStore.getUsers()
                      .filter(u => (u.role === 'driver' || u.role === 'crew_helper') && u.status === 'approved')
                      .map(u => (
                        <option key={u.id} value={u.fullName}>
                          👤 Jadwal {u.fullName}
                        </option>
                      ))}
                  </select>
                </div>
              )}
            </div>

            {/* Filter Tabs (Segmented Buttons) */}
            <div className="flex items-center gap-1 p-1 bg-slate-900 rounded-xl border border-slate-800 text-xs">
              <button
                onClick={() => setActiveTab('active')}
                className={`flex-1 py-1.5 rounded-lg font-bold transition text-center cursor-pointer ${activeTab === 'active' ? 'bg-amber-500 text-slate-950 shadow-sm' : 'text-slate-400 hover:text-slate-200'}`}
              >
                Aktif ({activeDeliveries.length})
              </button>
              <button
                onClick={() => setActiveTab('scheduled')}
                className={`flex-1 py-1.5 rounded-lg font-bold transition text-center cursor-pointer ${activeTab === 'scheduled' ? 'bg-amber-500 text-slate-950 shadow-sm' : 'text-slate-400 hover:text-slate-200'}`}
              >
                Jadwal ({scheduledDeliveries.length})
              </button>
              <button
                onClick={() => setActiveTab('delivered')}
                className={`flex-1 py-1.5 rounded-lg font-bold transition text-center cursor-pointer ${activeTab === 'delivered' ? 'bg-amber-500 text-slate-950 shadow-sm' : 'text-slate-400 hover:text-slate-200'}`}
              >
                Selesai ({deliveredDeliveries.length})
              </button>
              <button
                onClick={() => setActiveTab('all')}
                className={`flex-1 py-1.5 rounded-lg font-bold transition text-center cursor-pointer ${activeTab === 'all' ? 'bg-amber-500 text-slate-950 shadow-sm' : 'text-slate-400 hover:text-slate-200'}`}
              >
                Semua
              </button>
            </div>

            {/* Deliveries List */}
            {isLoading ? (
              <div className="py-12 flex flex-col items-center justify-center gap-3 text-slate-400">
                <RefreshCw className="w-6 h-6 animate-spin text-amber-500" />
                <span className="text-xs">Memuat tugas pengiriman driver...</span>
              </div>
            ) : filteredDeliveries.length === 0 ? (
              <div className="py-10 text-center bg-slate-900/60 rounded-2xl border border-slate-800/80 p-6 space-y-2.5">
                <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-400 flex items-center justify-center mx-auto">
                  <Calendar className="w-6 h-6" />
                </div>
                <h3 className="text-sm font-black text-white">Belum Ada Jadwal Penugasan</h3>
                <p className="text-xs text-slate-400 max-w-sm mx-auto leading-relaxed">
                  {searchQuery 
                    ? `Tidak ada pengiriman yang cocok dengan "${searchQuery}".`
                    : (dateFilterStart || dateFilterEnd)
                    ? 'Tidak ada jadwal pengiriman pada rentang tanggal yang dipilih.'
                    : 'Masih belum ada jadwal penugasan pengiriman untuk Anda hari ini atau besok. Silakan periksa kembali nanti atau hubungi SPV Logistik.'}
                </p>
                <button
                  onClick={() => {
                    setActiveTab('all');
                    setSearchQuery('');
                    setDateFilterStart('');
                    setDateFilterEnd('');
                  }}
                  className="mt-2 text-xs text-amber-400 hover:underline font-semibold cursor-pointer"
                >
                  Reset Filter &amp; Tampilkan Bulan Ini
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {paginatedDeliveries.map(delivery => {
                  const store = delivery.store;
                  const pendingAction = driverOfflineSyncService.getPendingActionForSchedule(delivery.id);
                  const {
                    driverName: driverCrewName,
                    helper1Name,
                    helper2Name,
                    hasHelper2
                  } = getDeliveryCrewComposition(delivery);

                  return (
                    <div
                      key={delivery.id}
                      className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-sm hover:border-slate-700 transition space-y-3"
                    >
                      {/* Delivery Header: Store Name & Status Badge (Tanpa Nomor PO & Tanpa Keterangan di Bawahnya) */}
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <h2 className="text-base font-black text-white leading-tight truncate">
                            {(store?.storeName || delivery.areaName || 'Toko Retail Mitra').replace(/DENPASAR\s*1\s*&\s*2/gi, 'DENPASAR 1')}
                          </h2>
                        </div>

                        <div className="shrink-0">
                          {getStatusBadge(delivery.status)}
                        </div>
                      </div>

                      {/* Offline Pending Sync Badge on Card */}
                      {pendingAction && (
                        <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl px-2.5 py-1.5 flex items-center justify-between text-xs text-amber-300">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <Clock className="w-3.5 h-3.5 text-amber-400 shrink-0 animate-pulse" />
                            <span className="font-bold text-[11px] truncate">
                              Tersimpan di HP ({pendingAction.newStatus.toUpperCase()})
                            </span>
                          </div>
                          <span className="text-[10px] font-mono text-amber-400/90 shrink-0">
                            Offline ({new Date(pendingAction.clientTimestamp).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })})
                          </span>
                        </div>
                      )}

                      {/* Route Path (Asal & Tujuan saja - Tanpa KM/Waktu, Tanpa Lihat Rincian Rute & Muatan, Tanpa Rute Maps & PIC) */}
                      <div className="bg-slate-950/70 p-2.5 rounded-xl border border-slate-800/80 text-xs space-y-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <div className="w-2 h-2 rounded-full bg-blue-500 shrink-0" />
                          <span className="text-slate-400 text-[11px] truncate">
                            Asal: <strong className="text-slate-200">{delivery.originName || 'Gudang Pusat Banyuwangi DC'}</strong>
                          </span>
                        </div>

                        <div className="flex items-start gap-2">
                          <MapPin className="w-3.5 h-3.5 text-rose-400 shrink-0 mt-0.5" />
                          <span className="text-slate-300 text-[11px] leading-snug">
                            {(store?.address || `Area Pengiriman Distribusi ${delivery.areaName || ''}`).replace(/DENPASAR\s*1\s*&\s*2/gi, 'DENPASAR 1')}
                          </span>
                        </div>
                      </div>

                      {/* Komposisi Kru Otomatis Menyesuaikan: Driver Utama, Helper 1 & Helper 2 (Situasi/Kondisi Tertentu) */}
                      <div className={`bg-slate-950/70 p-2.5 rounded-xl border border-slate-800/80 grid ${hasHelper2 ? 'grid-cols-3' : 'grid-cols-2'} gap-2 text-xs`}>
                        <div className="flex items-center gap-2 min-w-0">
                          <div className="w-7 h-7 rounded-lg bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
                            <User className="w-3.5 h-3.5" />
                          </div>
                          <div className="min-w-0">
                            <span className="text-[10px] text-slate-400 block truncate">Driver Utama</span>
                            <strong className="text-white text-[11px] block truncate">{driverCrewName}</strong>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 min-w-0 border-l border-slate-800 pl-2">
                          <div className="w-7 h-7 rounded-lg bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center text-cyan-400 shrink-0">
                            <User className="w-3.5 h-3.5" />
                          </div>
                          <div className="min-w-0">
                            <span className="text-[10px] text-slate-400 block truncate">
                              {hasHelper2 ? 'Helper 1' : 'Helper 1 / Kernet'}
                            </span>
                            <strong className="text-cyan-300 text-[11px] block truncate">{helper1Name}</strong>
                          </div>
                        </div>

                        {hasHelper2 && (
                          <div className="flex items-center gap-2 min-w-0 border-l border-slate-800 pl-2">
                            <div className="w-7 h-7 rounded-lg bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
                              <User className="w-3.5 h-3.5" />
                            </div>
                            <div className="min-w-0">
                              <span className="text-[10px] text-emerald-400/90 font-semibold block truncate">Helper 2</span>
                              <strong className="text-emerald-300 text-[11px] block truncate">{helper2Name}</strong>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Tanggal Kirim, Jam Keberangkatan & Target Jam Kepulangan */}
                      {(() => {
                        const portalTiming = getDriverPortalDepartureLabel(
                          delivery.departureDate,
                          delivery.areaName,
                          store?.storeName || delivery.store?.storeName,
                          delivery.estimatedArrival,
                          store?.deliveryWindow || delivery.store?.deliveryWindow
                        );
                        const deliveryFleetObj =
                          fleets.find(f => f.id === delivery.fleetId) ||
                          delivery.fleet ||
                          assignedFleet;
                        const fleetLiveInfo = deliveryFleetObj
                          ? logisticsStore.getFleetLiveOperationalInfo(
                              deliveryFleetObj,
                              (delivery.departureDate || '').slice(0, 10) || undefined
                            )
                          : null;

                        return (
                          <div className="space-y-2">
                            {/* Status Kondisi Armada Terintegrasi (Titik Besar Warna + Status Ready/Kirim/Servis + Area Kirim) */}
                            {deliveryFleetObj && fleetLiveInfo && (
                              <div className="px-3 py-2 rounded-xl bg-slate-950/80 border border-slate-800 flex items-center justify-between gap-2 text-[11px]">
                                <div className="flex items-center gap-2 min-w-0">
                                  <span className={`w-3.5 h-3.5 rounded-full shrink-0 ${fleetLiveInfo.dotColorClass}`} />
                                  <div className="min-w-0">
                                    <div className="font-bold text-white flex items-center gap-1.5 flex-wrap">
                                      <span className="font-mono">{deliveryFleetObj.plateNumber}</span>
                                      {deliveryFleetObj.initialCode && (
                                        <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-800 text-slate-300 font-mono">
                                          {deliveryFleetObj.initialCode}
                                        </span>
                                      )}
                                      <span className={`px-2 py-0.2 rounded-full text-[10px] font-black border ${fleetLiveInfo.badgeColorClass}`}>
                                        Status: {fleetLiveInfo.statusLabel}
                                      </span>
                                    </div>
                                    <div className="text-[10px] text-slate-400 truncate mt-0.5">
                                      {fleetLiveInfo.effectiveStatus === 'on-duty'
                                        ? `Sedang Kirim di Area: ${delivery.areaName || store?.storeName || fleetLiveInfo.areaName || '-'}`
                                        : fleetLiveInfo.effectiveStatus === 'maintenance'
                                        ? 'Dalam perbaikan (Tidak bisa diaturkan kirim)'
                                        : `Ready (Siap jadwal esok) • Area Kirim: ${delivery.areaName || store?.storeName || '-'}`}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            )}

                            {/* Banner Jam Keberangkatan & Target Jam Kepulangan */}
                            <div className="px-3 py-2 rounded-xl bg-blue-950/30 border border-blue-500/30 flex items-center justify-between gap-2 text-[11px]">
                              <div className="flex items-center gap-2 text-slate-200 min-w-0">
                                <Clock className="w-4 h-4 text-blue-400 shrink-0" />
                                <div className="truncate">
                                  <span>Jam Keberangkatan: </span>
                                  <strong className="text-white font-mono">{portalTiming.timing.departureLabel}</strong>
                                  <span className="mx-1.5 text-slate-500">•</span>
                                  <span>Target Kepulangan: </span>
                                  <strong className="text-emerald-300 font-mono">{portalTiming.timing.returnLabel}</strong>
                                </div>
                              </div>
                              <span className="px-2 py-0.5 rounded text-[9px] font-bold bg-blue-500/20 text-blue-300 border border-blue-500/30 shrink-0">
                                {portalTiming.isNightRun ? 'Malam' : 'Reguler'}
                              </span>
                            </div>

                            {delivery.status === 'delivered' ? (
                              <div className="grid grid-cols-2 gap-2 text-xs">
                                <div className="bg-slate-950/40 p-2 rounded-xl border border-slate-800/60">
                                  <span className="text-[10px] text-slate-400 block flex items-center gap-1">
                                    <Truck className="w-3.5 h-3.5 text-blue-400" />
                                    <span>Jam Keberangkatan</span>
                                  </span>
                                  <div className="font-bold text-white text-xs mt-0.5 font-mono">
                                    {portalTiming.timing.departureLabel}
                                  </div>
                                  <div className="text-[10px] text-blue-400 font-semibold mt-0.5">
                                    Target Pulang: {portalTiming.timing.returnLabel}
                                  </div>
                                </div>

                                <div className="bg-slate-950/40 p-2 rounded-xl border border-slate-800/60">
                                  <span className="text-[10px] text-slate-400 block flex items-center gap-1">
                                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                                    <span>Waktu Tiba di Gudang</span>
                                  </span>
                                  <div className="font-bold text-white text-xs mt-0.5 font-mono">
                                    {new Date(delivery.actualArrival || Date.now()).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })} WIB
                                  </div>
                                  <div className="text-[10px] text-emerald-400 font-semibold mt-0.5">
                                    Armada Kembali Ready
                                  </div>
                                </div>
                              </div>
                            ) : (
                              <div className="grid grid-cols-2 gap-2 text-xs">
                                <div className="bg-slate-950/40 p-2.5 rounded-xl border border-slate-800/60">
                                  <span className="text-[10px] text-slate-400 block flex items-center gap-1">
                                    <Calendar className="w-3.5 h-3.5 text-emerald-400" />
                                    <span>Tanggal Kirim</span>
                                  </span>
                                  <div className="font-bold text-white text-xs mt-1">
                                    {delivery.departureDate 
                                      ? new Date(delivery.departureDate).toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })
                                      : 'Hari ini'}
                                  </div>
                                </div>

                                <div className="bg-slate-950/40 p-2.5 rounded-xl border border-slate-800/60">
                                  <span className="text-[10px] text-slate-400 block flex items-center gap-1">
                                    <Clock className="w-3.5 h-3.5 text-blue-400" />
                                    <span>Jam Keberangkatan &amp; Pulang</span>
                                  </span>
                                  <div className="font-bold text-white text-xs mt-0.5 font-mono">
                                    Berangkat: {portalTiming.timing.departureLabel}
                                  </div>
                                  <div className="text-[10px] text-emerald-400 font-semibold mt-0.5 font-mono">
                                    Target Pulang: {portalTiming.timing.returnLabel}
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })()}

                      {/* Status Terintegrasi: Permintaan Oper Jadwal (Hanya tampil di tab Jadwal, bukan di Aktif) */}
                      {activeTab !== 'active' && delivery.transferRequest?.status === 'pending' && (
                        <div className="bg-amber-500/15 dark:bg-amber-950/40 border border-amber-400 dark:border-amber-600/70 rounded-xl p-3 space-y-1 shadow-xs">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-1.5 text-xs font-black text-amber-950 dark:text-amber-300">
                              <ArrowRightLeft className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                              <span>Permintaan Oper Jadwal Diajukan</span>
                            </div>
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-200 dark:bg-amber-900/70 text-amber-950 dark:text-amber-200 border border-amber-300 dark:border-amber-700">
                              Menunggu SPV Logistik
                            </span>
                          </div>
                          <div className="text-[11px] text-slate-800 dark:text-slate-200 space-y-0.5">
                            <div>Alasan: <strong className="text-slate-950 dark:text-white font-bold">{delivery.transferRequest.reason}</strong></div>
                            {delivery.transferRequest.transferType && (
                              <div className="text-slate-600 dark:text-slate-400 text-[10px]">Jenis Pengalihan: {delivery.transferRequest.transferType}</div>
                            )}
                            {delivery.transferRequest.notes && (
                              <div className="text-slate-600 dark:text-slate-400 text-[10px] italic">"{delivery.transferRequest.notes}"</div>
                            )}
                          </div>
                          <div className="text-[10px] text-amber-800 dark:text-amber-400 font-semibold flex items-center gap-1 pt-0.5">
                            <CheckCircle2 className="w-3 h-3 text-amber-600 dark:text-amber-400 shrink-0" />
                            <span>Notifikasi telah terkirim ke SPV Logistik &amp; Super Admin</span>
                          </div>
                        </div>
                      )}

                      {/* Driver Status Action Workflow Buttons:
                          1. Check-In -> 2. Pemilihan Armada -> 3. Pengisian Checklist -> 4. Persiapan Keluar (Otomatis ke SJ Keluar & Gate-Out) -> Di Jalan -> Konfirmasi Tiba di Gudang */}
                      <div className="pt-2 border-t border-slate-200 dark:border-slate-800/80">
                        {delivery.status === 'scheduled' && (() => {
                          const todayStr = new Date().toISOString().slice(0, 10);
                          const sharedFlow = sharedScheduleFlowMap[delivery.id];
                          const isSameDayFlow = Boolean(sharedFlow?.date === todayStr);

                          // Tombol Gate-Out & Buka SJ Keluar HANYA aktif jika Driver SUDAH CHECK-IN SHIFT (activeShift) & Checklist Armada Hari Ini Sudah Diisi/Selesai
                          const isChecklistDoneToday = Boolean(
                            isChecklistCompletedAfterCheckin ||
                            (sharedFlow?.checklistCompleted && isSameDayFlow) ||
                            (sharedCrewPreTripState.isDone && latestChecklist?.date === todayStr)
                          );

                          const isReadyForGateOut = Boolean(
                            activeShift &&
                            isChecklistDoneToday &&
                            (keluarArgoMap[delivery.id] || (sharedFlow?.preparedForGateOut && isSameDayFlow) || (sharedFlow?.gateOutConfirmed && isSameDayFlow))
                          );

                          return (
                            <div className="space-y-2">
                              {isReadyForGateOut ? (
                                <>
                                  <div className="px-3 py-1.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-[11px] font-bold flex items-center justify-between gap-2">
                                    <span className="flex items-center gap-1.5 truncate">
                                      <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                                      <span className="truncate">
                                        Checklist Armada Selesai ({sharedCrewPreTripState.completedBy}) • Tinggal Keluar Gerbang
                                      </span>
                                    </span>
                                  </div>

                                  <div className="grid grid-cols-2 gap-2">
                                    <button
                                      type="button"
                                      onClick={() => handleConfirmSharedGateOut(delivery)}
                                      className="py-2.5 px-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs flex items-center justify-center gap-1.5 transition active:scale-95 shadow-md cursor-pointer"
                                    >
                                      <ArrowRight className="w-4 h-4" />
                                      <span>Keluar Gerbang (Gate-Out)</span>
                                    </button>

                                    <button
                                      type="button"
                                      onClick={() => handlePersiapanKeluar(delivery)}
                                      className="py-2.5 px-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition active:scale-95 shadow-md cursor-pointer"
                                    >
                                      <FileText className="w-4 h-4" />
                                      <span>Buka SJ Keluar</span>
                                    </button>
                                  </div>
                                </>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => handlePersiapanKeluar(delivery)}
                                  className="w-full py-2.5 px-4 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs flex items-center justify-center gap-2 transition active:scale-95 shadow-md cursor-pointer"
                                >
                                  <ClipboardCheck className="w-4 h-4" />
                                  <span>
                                    {!activeShift
                                      ? 'Check-In Dulu Untuk Isi Checklist'
                                      : 'Isi Checklist Armada (Pra-Jalan)'}
                                  </span>
                                </button>
                              )}

                              {activeTab !== 'active' && (
                                <button
                                  type="button"
                                  onClick={() => setTransferModal({
                                    isOpen: true,
                                    delivery,
                                    reason: 'Darurat / Halangan pribadi',
                                    transferType: 'Oper ke driver lain (Driver cari pengganti)',
                                    gpsPhotoUrl: 'https://images.unsplash.com/photo-1526778548025-fa2f459cd5c1?w=600&auto=format&fit=crop&q=80',
                                    constraintNote: ''
                                  })}
                                  className="w-full py-2.5 px-3 rounded-xl border border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs flex items-center justify-center gap-1.5 transition active:scale-95 cursor-pointer"
                                >
                                  <ArrowRightLeft className="w-4 h-4 text-blue-400" />
                                  <span>{delivery.transferRequest?.status === 'pending' ? 'Edit Oper Jadwal' : 'Minta Oper Jadwal'}</span>
                                </button>
                              )}
                            </div>
                          );
                        })()}

                        {(delivery.status === 'picked_up' || delivery.status === 'in_transit') && (
                          <div className="space-y-2">
                            <div className="px-3 py-1.5 rounded-xl bg-blue-500/15 border border-blue-500/30 text-blue-300 text-[11px] font-bold flex items-center justify-between">
                              <span className="flex items-center gap-1.5">
                                <Truck className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                                <span>Status: Di Jalan (Sudah Gate-Out dari Gudang)</span>
                              </span>
                            </div>

                            {activeTab === 'active' && (
                              <button
                                type="button"
                                onClick={() => setPodModal({
                                  isOpen: true,
                                  delivery,
                                  conditionNote: '',
                                  serviceNote: '',
                                  hasSignature: true,
                                  photoUrl: null,
                                  photoTimestamp: null,
                                  postTripFleetStatus: 'available'
                                })}
                                className="w-full py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs flex items-center justify-center gap-2 transition active:scale-95 shadow-sm cursor-pointer"
                              >
                                <CheckCircle2 className="w-4 h-4" />
                                <span>Konfirmasi Tiba di Gudang</span>
                              </button>
                            )}

                            <button
                              type="button"
                              onClick={() => {
                                setBottomNav('surat_jalan');
                                setWaybillStatusFilter('in_transit');
                              }}
                              className="w-full py-2 px-3 rounded-xl bg-slate-950 hover:bg-slate-800 border border-slate-800 text-blue-300 font-bold text-[11px] flex items-center justify-center gap-1.5 transition cursor-pointer"
                            >
                              <FileText className="w-3.5 h-3.5 text-blue-400" />
                              <span>Lihat SJ Keluar (Di Jalan)</span>
                            </button>
                          </div>
                        )}

                        {delivery.status === 'delayed' && (
                          <div className="space-y-2">
                            {activeTab === 'active' && (
                              <button
                                type="button"
                                onClick={() => setPodModal({
                                  isOpen: true,
                                  delivery,
                                  conditionNote: '',
                                  serviceNote: '',
                                  hasSignature: true,
                                  photoUrl: null,
                                  photoTimestamp: null,
                                  postTripFleetStatus: 'available'
                                })}
                                className="w-full py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs flex items-center justify-center gap-2 transition active:scale-95 shadow-sm cursor-pointer"
                              >
                                <CheckCircle2 className="w-4 h-4" />
                                <span>Konfirmasi Tiba di Gudang</span>
                              </button>
                            )}
                            <span className="text-[10px] text-slate-400 block text-center">
                              Status saat ini: Terlaporkan Kendala ke SPV Logistik.
                            </span>
                          </div>
                        )}

                        {delivery.status === 'delivered' && (
                          <div className="space-y-2">
                            <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-2.5 flex items-center justify-between text-xs text-emerald-300">
                              <div className="flex items-center gap-2 min-w-0">
                                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                                <div className="min-w-0">
                                  <span className="font-bold block truncate">Pengiriman Berhasil Selesai</span>
                                  <div className="text-[10px] text-emerald-400/80">
                                    Tiba: {delivery.actualArrival ? new Date(delivery.actualArrival).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) + ' WIB' : 'Hari ini'}
                                  </div>
                                </div>
                              </div>
                              <div className="flex items-center gap-1.5 shrink-0">
                                {delivery.podPhotoUrl && (
                                  <button
                                    type="button"
                                    onClick={() => setViewPhotoModal({
                                      isOpen: true,
                                      photoUrl: delivery.podPhotoUrl!,
                                      title: `Bukti Foto POD - ${delivery.store?.storeName}`,
                                      subtitle: `Area: ${delivery.store?.storeName || delivery.areaName || 'Tujuan'} | Status: Selesai`
                                    })}
                                    className="px-2 py-0.5 rounded text-[10px] font-bold bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-500/30 flex items-center gap-1 cursor-pointer"
                                  >
                                    <Eye className="w-2.5 h-2.5" />
                                    <span>Foto</span>
                                  </button>
                                )}
                                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 border border-emerald-500/30">
                                  POD OK
                                </span>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Fitur Hapus Jadwal (Tampil untuk Role SPV Logistik & Super Admin pada Semua Status Jadwal) */}
                        {canManageAllPortalSchedules && (
                          <div className="flex items-center justify-between pt-2 mt-1 border-t border-slate-800/80 px-1">
                            <span className="text-[10px] text-slate-400 font-semibold">
                              Otorisasi {syncedUserRoleInfo.roleLabel}:
                            </span>
                            <button
                              type="button"
                              onClick={() => setDeleteConfirmModal({ isOpen: true, delivery })}
                              className="text-[11px] font-bold text-rose-400 hover:text-white bg-rose-500/15 hover:bg-rose-600 border border-rose-500/30 px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition cursor-pointer shadow-2xs"
                              title="Hapus jadwal pengiriman ini (SPV Logistik & Super Admin)"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              <span>Hapus Jadwal</span>
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}

                {/* Fitur Paging / Pagination Jadwal (Ringkas & Tidak Melebihi Layar) */}
                {filteredDeliveries.length > 0 && (
                  <div className="p-3 bg-slate-900 border border-slate-800 rounded-2xl flex flex-col gap-2.5 text-xs shadow-sm overflow-hidden">
                    <div className="flex items-center justify-between text-[11px] text-slate-400">
                      <span>
                        Menampilkan <strong className="text-white">{(currentPage - 1) * ITEMS_PER_PAGE + 1}–{Math.min(currentPage * ITEMS_PER_PAGE, filteredDeliveries.length)}</strong> dari <strong className="text-amber-400">{filteredDeliveries.length}</strong> jadwal
                      </span>
                      <span className="text-[10px] font-mono text-slate-400">
                        Hal {currentPage}/{totalPages}
                      </span>
                    </div>

                    {totalPages > 1 && (() => {
                      const getVisiblePages = (curr: number, total: number): Array<number | 'ellipsis-start' | 'ellipsis-end'> => {
                        if (total <= 5) {
                          return Array.from({ length: total }, (_, idx) => idx + 1);
                        }
                        if (curr <= 3) {
                          return [1, 2, 3, 4, 'ellipsis-end', total];
                        }
                        if (curr >= total - 2) {
                          return [1, 'ellipsis-start', total - 3, total - 2, total - 1, total];
                        }
                        return [1, 'ellipsis-start', curr - 1, curr, curr + 1, 'ellipsis-end', total];
                      };

                      const visiblePages = getVisiblePages(currentPage, totalPages);

                      return (
                        <div className="flex flex-wrap items-center justify-between gap-1.5 pt-2 border-t border-slate-800/80 w-full">
                          <button
                            type="button"
                            disabled={currentPage <= 1}
                            onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                            className="px-2.5 py-1.5 rounded-xl bg-slate-950 hover:bg-slate-800 disabled:opacity-40 border border-slate-800 text-slate-200 font-bold text-[11px] transition cursor-pointer disabled:cursor-not-allowed shrink-0"
                          >
                            Sebelumnya
                          </button>

                          <div className="flex flex-wrap items-center justify-center gap-1 max-w-full">
                            {visiblePages.map(item =>
                              typeof item === 'number' ? (
                                <button
                                  key={item}
                                  type="button"
                                  onClick={() => setCurrentPage(item)}
                                  className={`min-w-[26px] h-7 px-1.5 rounded-lg font-mono text-[11px] font-black transition cursor-pointer ${
                                    currentPage === item
                                      ? 'bg-amber-500 text-slate-950 shadow-sm'
                                      : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
                                  }`}
                                >
                                  {item}
                                </button>
                              ) : (
                                <span key={item} className="px-1 text-slate-500 font-mono text-[11px] select-none">
                                  ...
                                </span>
                              )
                            )}
                          </div>

                          <button
                            type="button"
                            disabled={currentPage >= totalPages}
                            onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                            className="px-2.5 py-1.5 rounded-xl bg-slate-950 hover:bg-slate-800 disabled:opacity-40 border border-slate-800 text-slate-200 font-bold text-[11px] transition cursor-pointer disabled:cursor-not-allowed shrink-0"
                          >
                            Berikutnya
                          </button>
                        </div>
                      );
                    })()}
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {/* TAB 2: CHECKLIST KENDARAAN (INSPEKSI ARMADA PRA/PASCA JALAN) */}
        {bottomNav === 'checklist' && (
          <div className="space-y-4">
            {/* Header Status Armada & Driver */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3 shadow-lg">
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-base font-black text-white font-mono tracking-tight">
                      {assignedFleet?.plateNumber || 'P 8848 U'}
                    </span>
                    <span className="text-[10px] px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-300 border border-amber-500/30 font-bold">
                      {assignedFleet?.vehicleType || 'Engkel Long Box'}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-400 mt-1 flex items-center gap-2">
                    <span>Driver: <strong>{currentDriver?.name || 'Ach Taufiq'}</strong></span>
                    <span>·</span>
                    <span>Inisial: {assignedFleet?.initialCode || 'WB-01'}</span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    const nextType: 'pre_trip' | 'post_trip' = hasConfirmedArrivalToday ? 'post_trip' : 'pre_trip';
                    const fresh = driverChecklistService.createNewChecklistTemplate(
                      selectedDriverId,
                      currentDriver?.name || 'Driver',
                      assignedFleet?.id || 'fl-01',
                      assignedFleet?.plateNumber || 'P 8848 U',
                      assignedFleet?.vehicleType || 'Engkel Long Box',
                      0
                    );
                    fresh.inspectionType = nextType;
                    setChecklistInspectionType(nextType);
                    setActiveChecklistToEdit(fresh);
                    setIsChecklistModalOpen(true);
                  }}
                  className="px-3 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs flex items-center gap-1.5 shadow-md shadow-emerald-500/20 transition cursor-pointer active:scale-95 shrink-0"
                >
                  <PlusCircle className="w-4 h-4" />
                  <span>Inspeksi Baru</span>
                </button>
              </div>

              {/* Status Kelayakan Hari Ini */}
              {latestChecklist ? (
                <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <ShieldCheck className={`w-4 h-4 ${
                        latestChecklist.overallStatus === 'passed' ? 'text-emerald-400' :
                        latestChecklist.overallStatus === 'warning' ? 'text-amber-400' : 'text-rose-400'
                      }`} />
                      <span className="font-bold text-xs text-slate-200">
                        Status Inspeksi Terakhir:
                      </span>
                    </div>

                    <span className={`px-2 py-0.5 rounded-lg text-[10px] font-black ${
                      latestChecklist.overallStatus === 'passed' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40' :
                      latestChecklist.overallStatus === 'warning' ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40' :
                      'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                    }`}>
                      {latestChecklist.overallStatus === 'passed' ? 'LOLOS (SIAP JALAN)' :
                       latestChecklist.overallStatus === 'warning' ? 'PERHATIAN KHUSUS' : 'TIDAK LAYAK JALAN'}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-center pt-1 text-[11px] border-t border-slate-800/80">
                    <div className="bg-slate-900/60 p-2 rounded-lg border border-slate-800/80">
                      <div className="text-slate-400 text-[10px]">Poin Lolos</div>
                      <div className="font-black text-emerald-400 font-mono mt-0.5">
                        {latestChecklist.passedCount} / {latestChecklist.items.length}
                      </div>
                    </div>
                    <div className="bg-slate-900/60 p-2 rounded-lg border border-slate-800/80">
                      <div className="text-slate-400 text-[10px]">Odometer</div>
                      <div className="font-black text-blue-400 font-mono mt-0.5">
                        {latestChecklist.odometerKm.toLocaleString()} KM
                      </div>
                    </div>
                  </div>

                  <div className="text-[10px] text-slate-400 flex items-center justify-between pt-1">
                    <span>Diperiksa: {latestChecklist.date} · {latestChecklist.time} WIB ({latestChecklist.inspectionType === 'pre_trip' ? 'Pra-Jalan' : 'Pasca-Jalan'})</span>
                    <button
                      type="button"
                      onClick={() => {
                        setActiveChecklistToEdit(latestChecklist);
                        setIsChecklistModalOpen(true);
                      }}
                      className="text-amber-400 hover:text-amber-300 font-bold underline cursor-pointer"
                    >
                      Buka Form Detail
                    </button>
                  </div>
                </div>
              ) : (
                <div className="p-4 bg-slate-950 rounded-xl border border-slate-800 text-center space-y-2">
                  <AlertCircle className="w-6 h-6 text-amber-400 mx-auto" />
                  <div className="text-xs font-bold text-slate-200">Belum Ada Pemeriksaan Hari Ini</div>
                  <p className="text-[10px] text-slate-400 max-w-xs mx-auto">
                    SOP Pengemudi PT AKK mewajibkan pemeriksaan fisik armada sebelum keluar gerbang pool DC.
                  </p>
                </div>
              )}
            </div>

            {/* Quick Inspection Items Checklist in Tab */}
            {latestChecklist && (
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                      Item Pemeriksaan Standar (23 Poin)
                    </h3>
                    <p className="text-[10px] text-slate-400 mt-0.5">
                      Klik tombol status untuk memperbarui catatan inspeksi armada langsung di peramban.
                    </p>
                  </div>
                </div>

                {/* Filter Kategori */}
                <div className="flex items-center gap-1 overflow-x-auto pb-1 scrollbar-none text-[10px]">
                  {[
                    { key: 'all', label: 'Semua' },
                    { key: 'mesin_fluida', label: 'Mesin' },
                    { key: 'rem_roda', label: 'Rem & Ban' },
                    { key: 'lampu_listrik', label: 'Lampu' },
                    { key: 'fisik_dokumen', label: 'Dokumen' },
                    { key: 'darurat_k3', label: 'Darurat K3' }
                  ].map(cat => (
                    <button
                      key={cat.key}
                      type="button"
                      onClick={() => setChecklistTabCategory(cat.key as any)}
                      className={`px-2.5 py-1 rounded-lg font-semibold transition cursor-pointer whitespace-nowrap ${
                        checklistTabCategory === cat.key
                          ? 'bg-amber-500 text-slate-950 font-bold'
                          : 'bg-slate-800 text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      {cat.label}
                    </button>
                  ))}
                </div>

                {/* List of Checklist Items */}
                <div className="space-y-2">
                  {latestChecklist.items
                    .filter(item => checklistTabCategory === 'all' || item.category === checklistTabCategory)
                    .map(item => (
                      <div
                        key={item.id}
                        className={`p-2.5 rounded-xl border flex items-center justify-between gap-2 text-xs transition ${
                          item.status === 'issue'
                            ? 'bg-rose-950/20 border-rose-500/40 text-rose-200'
                            : 'bg-slate-950 border-slate-800/80 text-slate-300'
                        }`}
                      >
                        <div className="min-w-0 flex-1 space-y-0.5">
                          <div className="font-bold truncate text-slate-200">{item.name}</div>
                          <div className="text-[10px] text-slate-400 line-clamp-1">{item.description}</div>
                          {item.note && (
                            <div className="text-[9px] text-rose-300 italic mt-0.5">Catatan: {item.note}</div>
                          )}
                        </div>

                        {/* Interactive toggle */}
                        <div className="flex items-center p-0.5 bg-slate-900 rounded-lg border border-slate-800 shrink-0">
                          <button
                            type="button"
                            onClick={() => {
                              const updatedItems = latestChecklist.items.map(i =>
                                i.id === item.id ? { ...i, status: 'ok' as const } : i
                              );
                              const { overallStatus, passedCount, issueCount } = driverChecklistService.calculateStatus(updatedItems);
                              const updated: DriverVehicleChecklist = {
                                ...latestChecklist,
                                items: updatedItems,
                                overallStatus,
                                passedCount,
                                issueCount
                              };
                              driverChecklistService.saveChecklist(updated);
                              setChecklists(prev => prev.map(c => c.id === updated.id ? updated : c));
                            }}
                            className={`px-2 py-0.5 rounded text-[10px] font-bold transition ${
                              item.status === 'ok' ? 'bg-emerald-600 text-white shadow-xs' : 'text-slate-400 hover:text-slate-200'
                            }`}
                          >
                            OK
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              const updatedItems = latestChecklist.items.map(i =>
                                i.id === item.id ? { ...i, status: 'issue' as const } : i
                              );
                              const { overallStatus, passedCount, issueCount } = driverChecklistService.calculateStatus(updatedItems);
                              const updated: DriverVehicleChecklist = {
                                ...latestChecklist,
                                items: updatedItems,
                                overallStatus,
                                passedCount,
                                issueCount
                              };
                              driverChecklistService.saveChecklist(updated);
                              setChecklists(prev => prev.map(c => c.id === updated.id ? updated : c));
                            }}
                            className={`px-2 py-0.5 rounded text-[10px] font-bold transition ${
                              item.status === 'issue' ? 'bg-rose-600 text-white shadow-xs' : 'text-slate-400 hover:text-rose-400'
                            }`}
                          >
                            Kendala
                          </button>
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            )}

            {/* Riwayat Inspeksi Sebelumnya */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3">
              <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                Riwayat Checklist Armada ({checklists.length})
              </h3>

              <div className="space-y-2">
                {checklists.map(chk => (
                  <div
                    key={chk.id}
                    onClick={() => {
                      setActiveChecklistToEdit(chk);
                      setIsChecklistModalOpen(true);
                    }}
                    className="p-3 bg-slate-950 border border-slate-800 hover:border-slate-700 rounded-xl flex items-center justify-between text-xs cursor-pointer transition"
                  >
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-white font-mono">{chk.plateNumber}</span>
                        <span className="text-[10px] text-slate-400">({chk.inspectionType === 'pre_trip' ? 'Pra-Jalan' : 'Pasca-Jalan'})</span>
                      </div>
                      <div className="text-[10px] text-slate-400">
                        {chk.date} · {chk.time} WIB · Odo: {chk.odometerKm.toLocaleString()} KM
                      </div>
                    </div>

                    <div className="text-right space-y-1">
                      <span className={`px-2 py-0.5 rounded text-[9px] font-bold ${
                        chk.overallStatus === 'passed' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' :
                        chk.overallStatus === 'warning' ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' :
                        'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                      }`}>
                        {chk.overallStatus.toUpperCase()}
                      </span>
                      <div className="text-[9px] text-slate-500 font-mono">
                        {chk.passedCount}/{chk.items.length} Poin
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: SURAT JALAN KELUAR (OUTBOUND DELIVERY WAYBILL) */}
        {bottomNav === 'surat_jalan' && (
          <div className="space-y-4">
            {/* Header Surat Jalan Summary */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3 shadow-lg">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-black text-white">Surat Jalan Keluar (SJ Keluar)</h2>
                  <p className="text-[10px] text-slate-400 mt-0.5">
                    Dokumen resmi manifest muatan gerbang Distribution Center PT AKK.
                  </p>
                </div>
                <div className="w-8 h-8 rounded-xl bg-blue-500/20 text-blue-400 flex items-center justify-center">
                  <FileText className="w-4 h-4" />
                </div>
              </div>

              {/* Status Counters */}
              <div className="grid grid-cols-4 gap-2 text-center text-xs">
                <div
                  onClick={() => setWaybillStatusFilter('all')}
                  className={`p-2 rounded-xl border transition cursor-pointer ${
                    waybillStatusFilter === 'all'
                      ? 'bg-blue-500/20 border-blue-500/40 text-blue-300'
                      : 'bg-slate-950 border-slate-800 text-slate-400'
                  }`}
                >
                  <div className="text-sm font-black text-white">{driverWaybills.length}</div>
                  <div className="text-[9px] font-semibold uppercase mt-0.5">Total SJ</div>
                </div>

                <div
                  onClick={() => setWaybillStatusFilter('gate_out')}
                  className={`p-2 rounded-xl border transition cursor-pointer ${
                    waybillStatusFilter === 'gate_out'
                      ? 'bg-amber-500/20 border-amber-500/40 text-amber-300'
                      : 'bg-slate-950 border-slate-800 text-slate-400'
                  }`}
                >
                  <div className="text-sm font-black text-amber-400">
                    {driverWaybills.filter(w => w.status === 'checker_verified').length}
                  </div>
                  <div className="text-[9px] font-semibold uppercase mt-0.5">Siap Out</div>
                </div>

                <div
                  onClick={() => setWaybillStatusFilter('in_transit')}
                  className={`p-2 rounded-xl border transition cursor-pointer ${
                    waybillStatusFilter === 'in_transit'
                      ? 'bg-cyan-500/20 border-cyan-500/40 text-cyan-300'
                      : 'bg-slate-950 border-slate-800 text-slate-400'
                  }`}
                >
                  <div className="text-sm font-black text-cyan-400">
                    {driverWaybills.filter(w => w.status === 'in_transit' || w.status === 'gate_out').length}
                  </div>
                  <div className="text-[9px] font-semibold uppercase mt-0.5">Di Jalan</div>
                </div>

                <div
                  onClick={() => setWaybillStatusFilter('delivered')}
                  className={`p-2 rounded-xl border transition cursor-pointer ${
                    waybillStatusFilter === 'delivered'
                      ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300'
                      : 'bg-slate-950 border-slate-800 text-slate-400'
                  }`}
                >
                  <div className="text-sm font-black text-emerald-400">
                    {driverWaybills.filter(w => w.status === 'delivered').length}
                  </div>
                  <div className="text-[9px] font-semibold uppercase mt-0.5">Selesai</div>
                </div>
              </div>
            </div>

            {/* List of Outbound Waybills */}
            <div className="space-y-3">
              {driverWaybills
                .filter(w => {
                  if (waybillStatusFilter === 'all') return true;
                  if (waybillStatusFilter === 'gate_out') return w.status === 'checker_verified';
                  if (waybillStatusFilter === 'in_transit') return w.status === 'in_transit' || w.status === 'gate_out';
                  if (waybillStatusFilter === 'delivered') return w.status === 'delivered';
                  return true;
                })
                .map(wb => (
                  <div
                    key={wb.id}
                    className="bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-2xl p-4 space-y-3 shadow-md transition"
                  >
                    {/* Top Row: Waybill Number & Status Pill */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <FileText className="w-4 h-4 text-amber-400 shrink-0" />
                        <span className="font-mono font-black text-xs text-blue-400">
                          {wb.waybillNumber}
                        </span>
                      </div>
                      <span className={`px-2 py-0.5 rounded-lg text-[10px] font-bold ${
                        wb.status === 'delivered' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40' :
                        wb.status === 'in_transit' || wb.status === 'gate_out' ? 'bg-blue-500/20 text-blue-300 border border-blue-500/40' :
                        'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                      }`}>
                        {wb.statusLabel}
                      </span>
                    </div>

                    {/* Destination & Manifest Details */}
                    <div className="p-3 bg-slate-950 rounded-xl border border-slate-800/80 space-y-1.5 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-white text-sm">{wb.destination.storeName}</span>
                        <span className="text-[10px] text-slate-400 font-mono">{wb.date}</span>
                      </div>
                      <div className="text-[11px] text-slate-400 flex items-center gap-1">
                        <MapPin className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                        <span className="truncate">{wb.destination.address}</span>
                      </div>
                      <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-800/60 text-[10px] text-slate-300">
                        <div>
                          Muatan: <strong>{wb.totalKoli} Koli</strong> ({(wb.totalWeightKg / 1000).toFixed(1)} Ton)
                        </div>
                        <div className="text-right">
                          Segel Box: <strong className="font-mono text-amber-300">{wb.securitySealNumber}</strong>
                        </div>
                      </div>
                    </div>

                    {/* Action Bar per Waybill Card (Tersinkronisasi: Jika salah satu sudah klik Gate-Out, tampilan langsung SJ Print) */}
                    <div className="space-y-2 pt-1">
                      {(wb.status === 'in_transit' || wb.status === 'gate_out') && (
                        <div className="px-2.5 py-1.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-[10px] font-bold flex items-center justify-between">
                          <span>✓ Gate-Out Selesai • Tersinkronisasi Driver &amp; Helper</span>
                          <span className="font-mono uppercase text-emerald-400">Siap SJ Print</span>
                        </div>
                      )}
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setActiveWaybillToView(wb);
                            setIsWaybillModalOpen(true);
                          }}
                          className={`flex-1 py-2.5 px-3 rounded-xl font-black text-xs flex items-center justify-center gap-1.5 transition active:scale-95 cursor-pointer shadow-md ${
                            wb.status === 'in_transit' || wb.status === 'gate_out' || wb.status === 'delivered'
                              ? 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-emerald-500/20'
                              : 'bg-blue-600 hover:bg-blue-500 text-white shadow-blue-600/20'
                          }`}
                        >
                          <Printer className="w-3.5 h-3.5" />
                          <span>
                            {wb.status === 'in_transit' || wb.status === 'gate_out' || wb.status === 'delivered'
                              ? 'SJ Print / Cetak Surat Jalan'
                              : 'Buka Surat Jalan (Cetak)'}
                          </span>
                        </button>

                        {wb.status === 'checker_verified' && (
                          <button
                            type="button"
                            onClick={async () => {
                              const matchedSchedule = deliveries.find(
                                d => d.id === wb.scheduleId || d.trackingNumber === wb.trackingNumber
                              );
                              if (matchedSchedule) {
                                await handleConfirmSharedGateOut(matchedSchedule);
                              } else {
                                const success = driverWaybillService.updateWaybillStatus(wb.id, 'in_transit');
                                if (success) {
                                  setWaybillRefreshTick(t => t + 1);
                                  setWaybillStatusFilter('in_transit');
                                  loadDeliveriesRef.current(true);
                                }
                              }
                            }}
                            className="py-2.5 px-3.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs flex items-center justify-center gap-1 transition active:scale-95 cursor-pointer shrink-0"
                            title="Konfirmasi Keluar Gerbang DC (Gate-Out)"
                          >
                            <ArrowRight className="w-3.5 h-3.5" />
                            <span>Gate-Out</span>
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}

              {driverWaybills.length === 0 && (
                <div className="py-12 text-center text-slate-500 text-xs bg-slate-900/40 rounded-2xl border border-slate-800">
                  Tidak ada Surat Jalan Keluar untuk pengemudi yang dipilih saat ini.
                </div>
              )}
            </div>
          </div>
        )}


        {/* TAB 3: RIWAYAT PENGIRIMAN SELESAI */}
        {bottomNav === 'history' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-white">Riwayat Terkirim ({completedDeliveries.length})</h2>
              <span className="text-[10px] text-slate-400">Bulan Ini</span>
            </div>

            {completedDeliveries.length === 0 ? (
              <div className="py-12 text-center text-slate-500 text-xs bg-slate-900/40 rounded-2xl border border-slate-800">
                Belum ada pengiriman yang diselesaikan oleh supir ini.
              </div>
            ) : (
              completedDeliveries.map(d => (
                <div key={d.id} className="bg-slate-900 border border-slate-800/90 rounded-xl p-3.5 space-y-2.5 text-xs shadow-md">
                  <div className="flex items-center justify-between">
                    <span className="font-mono font-bold text-emerald-400">{d.trackingNumber}</span>
                    <span className="text-[10px] text-slate-400">
                      {new Date(d.departureDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}
                    </span>
                  </div>
                  <div className="font-bold text-white">{d.store?.storeName}</div>
                  <div className="text-slate-400 text-[11px] truncate">{d.store?.address}</div>

                  {/* Proof of Delivery Photo Thumbnail if captured */}
                  {d.podPhotoUrl && (
                    <div className="bg-slate-950/80 p-2 rounded-xl border border-emerald-500/30 flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <img
                          src={d.podPhotoUrl}
                          alt="POD Selesai"
                          className="w-11 h-11 object-cover rounded-lg border border-slate-700 cursor-pointer shrink-0 shadow-xs"
                          onClick={() => setViewPhotoModal({
                            isOpen: true,
                            photoUrl: d.podPhotoUrl!,
                            title: `Bukti Foto POD Selesai - ${d.store?.storeName}`,
                            subtitle: `Area: ${d.store?.storeName || d.areaName || 'Tujuan'} | Penerima: ${d.podReceiverName || 'PIC Toko'}`
                          })}
                        />
                        <div className="min-w-0">
                          <div className="text-[11px] font-bold text-emerald-400 flex items-center gap-1 truncate">
                            <CheckCircle2 className="w-3 h-3 shrink-0" />
                            <span>Bukti Foto Terlampir</span>
                          </div>
                          <div className="text-[10px] text-slate-400 truncate mt-0.5">
                            {d.podReceiverName ? `Penerima: ${d.podReceiverName}` : 'Telah diverifikasi toko'}
                          </div>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setViewPhotoModal({
                          isOpen: true,
                          photoUrl: d.podPhotoUrl!,
                          title: `Bukti Foto POD Selesai - ${d.store?.storeName}`,
                          subtitle: `Area: ${d.store?.storeName || d.areaName || 'Tujuan'} | Penerima: ${d.podReceiverName || 'PIC Toko'}`
                        })}
                        className="px-2.5 py-1.5 rounded-lg bg-cyan-600/20 hover:bg-cyan-600/30 text-cyan-300 font-bold text-[10px] flex items-center gap-1 shrink-0 border border-cyan-500/30 cursor-pointer"
                      >
                        <Eye className="w-3 h-3" />
                        <span>Lihat</span>
                      </button>
                    </div>
                  )}

                  <div className="flex items-center justify-between text-[11px] pt-1.5 border-t border-slate-800/60 text-slate-400">
                    <span>Muatan: {d.cargoWeightTon} Ton</span>
                    <span className="text-emerald-400 font-semibold flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" />
                      <span>Status: Selesai</span>
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* TAB 4: PROFIL DRIVER & ARMADA */}
        {bottomNav === 'profile' && (
          <div className="space-y-4">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-14 h-14 rounded-2xl bg-blue-600/15 border border-blue-500/30 flex items-center justify-center text-blue-400 font-bold text-xl">
                  {portalInitials}
                </div>
                <div>
                  <h2 className="text-base font-black text-white">{portalDisplayName}</h2>
                  <div className="text-xs text-slate-400 mt-0.5">
                    Role User Manajemen: <strong className="text-blue-400">{syncedUserRoleInfo.roleLabel}</strong> · Dept: {syncedUserRoleInfo.department}
                  </div>
                  <div className="inline-flex items-center gap-1 mt-1 px-2 py-0.5 rounded text-[10px] font-bold bg-slate-800 text-slate-200 border border-slate-700">
                    <CheckCircle2 className="w-3 h-3 text-blue-400" />
                    <span>Status: {currentDriver?.status === 'on-duty' ? 'On-Duty' : 'Available'}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Presensi Shift & Keamanan PIN Card */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3 text-xs">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <KeyRound className="w-4 h-4 text-blue-400" />
                  <span className="font-bold text-slate-200">Presensi Shift &amp; PIN Keamanan</span>
                </div>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-600/15 text-blue-300 border border-blue-500/30">
                  {activeShift ? 'Shift Aktif' : 'Belum Check-In'}
                </span>
              </div>

              <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 space-y-2">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-slate-400">Status Dinas Hari Ini:</span>
                  <span className="font-bold text-slate-200">
                    {activeShift ? `Masuk: ${activeShift.checkinTimeFormatted}` : 'Belum Check-In'}
                  </span>
                </div>
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-slate-400">Metode Verifikasi:</span>
                  <span className="text-slate-300 font-semibold">
                    Check-In (1x PIN) · Ubah/Buat PIN (2x PIN)
                  </span>
                </div>
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-slate-400">Integrasi Data PIN &amp; Shift:</span>
                  <span className="text-blue-400 font-bold">Tersinkron ke Laporan Kiriman Kru</span>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setCheckinModalMode('checkin');
                    setIsCheckinModalOpen(true);
                  }}
                  className="py-2.5 px-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition cursor-pointer flex items-center justify-center gap-1.5 active:scale-95"
                >
                  <KeyRound className="w-3.5 h-3.5" />
                  <span>{activeShift ? 'Lihat / Perbarui Shift' : 'Check-In Shift'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setCheckinModalMode('change_pin');
                    setIsCheckinModalOpen(true);
                  }}
                  className="py-2.5 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold border border-slate-700 transition cursor-pointer flex items-center justify-center gap-1.5 active:scale-95"
                >
                  <Lock className="w-3.5 h-3.5" />
                  <span>Ubah / Buat PIN Baru (2x)</span>
                </button>
              </div>

              {activeShift && (
                <button
                  type="button"
                  onClick={() => setIsCheckoutModalOpen(true)}
                  className="w-full py-2.5 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold border border-slate-700 transition cursor-pointer flex items-center justify-center gap-1.5 active:scale-95"
                >
                  <Clock className="w-3.5 h-3.5" />
                  <span>Check-Out Shift (Gabung ke Laporan Kiriman Kru)</span>
                </button>
              )}
            </div>

            {/* Tombol Keluar */}
            <div className="pt-2">
              <button
                type="button"
                onClick={handleDriverLogout}
                className="w-full py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 font-bold text-xs flex items-center justify-center gap-2 transition cursor-pointer active:scale-95"
              >
                <X className="w-4 h-4 text-slate-400" />
                <span>Keluar</span>
              </button>
            </div>
          </div>
        )}
      </main>

      {/* Floating Action Button (+) di Pojok Kanan Bawah for Lapor Kendala & Absen Kiriman Pelanggan */}
      <div className="fixed bottom-20 right-4 sm:right-6 z-40">
        <button
          type="button"
          onClick={() => setIsGmapsShareModalOpen(true)}
          className="w-14 h-14 rounded-full bg-blue-600 hover:bg-blue-500 text-white font-black shadow-lg flex items-center justify-center transition-all duration-200 active:scale-95 hover:scale-105 border-2 border-slate-950 cursor-pointer group"
          title="Lapor Kendala & Absen Kiriman Pelanggan (+)"
          aria-label="Lapor Kendala & Absen Kiriman Pelanggan"
        >
          <Plus className="w-7 h-7 stroke-[2.5] transition-transform duration-200 group-hover:rotate-90 text-white" />
        </button>
      </div>

      {/* Sticky Bottom Navigation Bar for Driver Mobile View */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 bg-slate-900/95 backdrop-blur-md border-t border-slate-800 px-2 py-2 max-w-md mx-auto">
        <div className="grid grid-cols-4 gap-1">
          <button
            onClick={() => setBottomNav('deliveries')}
            className={`flex flex-col items-center justify-center py-1.5 rounded-xl transition cursor-pointer ${bottomNav === 'deliveries' ? 'text-blue-400 font-bold' : 'text-slate-400 hover:text-slate-200'}`}
          >
            <Calendar className="w-4 h-4 mb-0.5" />
            <span className="text-[10px]">Jadwal</span>
          </button>
          <button
            onClick={() => setBottomNav('checklist')}
            className={`flex flex-col items-center justify-center py-1.5 rounded-xl transition cursor-pointer ${bottomNav === 'checklist' ? 'text-blue-400 font-bold' : 'text-slate-400 hover:text-slate-200'}`}
          >
            <ShieldCheck className="w-4 h-4 mb-0.5" />
            <span className="text-[10px]">Checklist</span>
          </button>
          <button
            onClick={() => setBottomNav('surat_jalan')}
            className={`flex flex-col items-center justify-center py-1.5 rounded-xl transition cursor-pointer ${bottomNav === 'surat_jalan' ? 'text-blue-400 font-bold' : 'text-slate-400 hover:text-slate-200'}`}
          >
            <FileText className="w-4 h-4 mb-0.5" />
            <span className="text-[10px]">SJ Keluar</span>
          </button>
          <button
            onClick={() => setBottomNav('profile')}
            className={`flex flex-col items-center justify-center py-1.5 rounded-xl transition cursor-pointer ${bottomNav === 'profile' ? 'text-blue-400 font-bold' : 'text-slate-400 hover:text-slate-200'}`}
          >
            <User className="w-4 h-4 mb-0.5" />
            <span className="text-[10px]">Profil</span>
          </button>
        </div>
      </nav>

      {/* MODAL 1: Lapor Kendala / Delayed Delivery */}
      {delayModal.isOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-t-2xl sm:rounded-2xl p-5 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <div className="flex items-center gap-2 text-rose-400">
                <AlertTriangle className="w-5 h-5 shrink-0" />
                <h3 className="text-sm font-black text-white">Lapor Kendala Pengiriman</h3>
              </div>
              <button
                onClick={() => setDelayModal({ isOpen: false, delivery: null, reason: 'Driver / Helper Tidak Masuk (Harus Segera Diganti)', customNote: '' })}
                className="p-1 rounded-lg text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="text-xs text-slate-300">
              Tujuan: <strong className="text-white">{delayModal.delivery?.store?.storeName || delayModal.delivery?.areaName}</strong> - Area {delayModal.delivery?.areaName || delayModal.delivery?.store?.city || 'Distribusi'}
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-300 block">Pilih Jenis Kendala:</label>
              {[
                'Driver / Helper Tidak Masuk (Harus Segera Diganti)',
                'Kendala Kerusakan Armada / Ban',
                'Macet Parah / Penutupan Jalur',
                'Antrean Bongkar Panjang di Toko',
                'Cuaca Buruk / Hujan Deras',
                'Jadwal Kapal ASDP Terlambat (Bali)',
                'Toko Belum Buka / Tutup Sementara'
              ].map((r, index) => (
                <label
                  key={`delay-${index}`}
                  onClick={() => setDelayModal(prev => ({ ...prev, reason: r }))}
                  className={`flex items-center gap-2.5 p-2.5 rounded-xl border text-xs cursor-pointer transition ${delayModal.reason === r ? 'bg-rose-500/15 border-rose-500/50 text-rose-200 font-bold' : 'bg-slate-950 border-slate-800 text-slate-400'}`}
                >
                  <input
                    type="radio"
                    name="delayReason"
                    checked={delayModal.reason === r}
                    onChange={() => {}}
                    className="text-rose-500 focus:ring-0"
                  />
                  <span>{r}</span>
                </label>
              ))}
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-300 block">Catatan Tambahan Driver (Opsional):</label>
              <textarea
                value={delayModal.customNote}
                onChange={(e) => setDelayModal(prev => ({ ...prev, customNote: e.target.value }))}
                placeholder="Contoh: Estimasi keterlambatan 45 menit, butuh bantuan atau penyesuaian..."
                rows={2}
                className="w-full bg-slate-950 border border-slate-800 text-slate-200 text-xs rounded-xl p-2.5 focus:outline-none focus:border-rose-500"
              />
            </div>

            <div className="flex items-center gap-2 pt-2">
              <button
                onClick={() => setDelayModal({ isOpen: false, delivery: null, reason: 'Driver / Helper Tidak Masuk (Harus Segera Diganti)', customNote: '' })}
                className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs cursor-pointer"
              >
                Batal
              </button>
              <button
                onClick={submitDelayReport}
                className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-md cursor-pointer active:scale-95"
              >
                <Send className="w-4 h-4" />
                <span>Kirim Laporan Kendala</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 1B: Minta Oper Jadwal (Pengalihan / Handoff Penugasan) */}
      {transferModal.isOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-t-2xl sm:rounded-2xl p-5 space-y-4 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400">
                  <ArrowRightLeft className="w-5 h-5 shrink-0" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-900 dark:text-white">Minta Oper Jadwal Pengiriman</h3>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400">Pengalihan jadwal penugasan ke SPV Logistik &amp; Super Admin</p>
                </div>
              </div>
              <button
                onClick={() => setTransferModal({ isOpen: false, delivery: null, reason: 'Darurat / Halangan pribadi', transferType: 'Oper ke driver lain (Driver cari pengganti)', gpsPhotoUrl: 'https://images.unsplash.com/photo-1526778548025-fa2f459cd5c1?w=600&auto=format&fit=crop&q=80', constraintNote: '' })}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-300 dark:border-amber-700/60 rounded-xl p-3 text-xs text-amber-950 dark:text-amber-200 flex items-start gap-2.5 shadow-xs">
              <Clock className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
              <p className="text-[11px] leading-relaxed font-medium">
                Permintaan ini otomatis masuk ke antrean SPV Logistik &amp; Super Admin serta terintegrasi ke menu laporan kiriman agar kru pengganti segera terinput tanpa double kiriman.
              </p>
            </div>

            <div className="bg-slate-50 dark:bg-slate-950 p-3 rounded-xl border border-slate-200 dark:border-slate-800 text-xs space-y-1">
              <div className="text-slate-600 dark:text-slate-400 font-medium">
                Tujuan: <strong className="text-slate-900 dark:text-white font-bold">{transferModal.delivery?.store?.storeName || transferModal.delivery?.areaName}</strong>
              </div>
              <div className="text-slate-600 dark:text-slate-400 font-medium">
                Area Distribusi: <span className="text-amber-700 dark:text-amber-400 font-bold">{transferModal.delivery?.areaName || 'Banyuwangi'}</span>
              </div>
            </div>

            {/* Alasan Pengajuan Oper Jadwal */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-800 dark:text-slate-200 block">Alasan Pengajuan Oper Jadwal:</label>
              {[
                'Darurat / Halangan pribadi',
                'Sakit (surat dokter menyusul)',
                'Keperluan keluarga mendesak'
              ].map((reason) => {
                const isSelected = transferModal.reason === reason;
                return (
                  <label
                    key={reason}
                    onClick={() => setTransferModal(prev => ({ ...prev, reason }))}
                    className={`flex items-center gap-2.5 p-2.5 rounded-xl border text-xs cursor-pointer transition select-none ${
                      isSelected
                        ? 'bg-amber-50 dark:bg-amber-950/60 border-2 border-amber-500 text-slate-950 dark:text-white font-black shadow-xs'
                        : 'bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-900'
                    }`}
                  >
                    <input
                      type="radio"
                      name="transferReason"
                      checked={isSelected}
                      onChange={() => {}}
                      className="text-amber-600 focus:ring-amber-500 shrink-0 w-4 h-4 cursor-pointer"
                    />
                    <span className="flex-1">{reason}</span>
                  </label>
                );
              })}
            </div>

            {/* Jenis Pengalihan */}
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-800 dark:text-slate-200 block">Jenis Pengalihan:</label>
              <select
                value={transferModal.transferType}
                onChange={(e) => setTransferModal(prev => ({ ...prev, transferType: e.target.value }))}
                className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 font-semibold text-xs rounded-xl p-2.5 focus:outline-none focus:ring-2 focus:ring-amber-500 cursor-pointer"
              >
                <option value="Oper ke driver lain (Driver cari pengganti)">Oper ke driver lain (Driver cari pengganti)</option>
                <option value="Tunda / Geser ke hari berikutnya">Tunda / Geser ke hari berikutnya</option>
              </select>
            </div>

            {/* Foto GPS & Lokasi */}
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center justify-between">
                <span>Foto GPS &amp; Lokasi Terkini:</span>
                <span className="text-[10px] text-amber-600 dark:text-amber-400 font-semibold">Valid GPS Terkunci</span>
              </label>
              <div className="flex items-center gap-3 bg-slate-50 dark:bg-slate-950 p-2.5 rounded-xl border border-slate-200 dark:border-slate-800">
                <div className="w-16 h-12 rounded-lg overflow-hidden bg-slate-200 dark:bg-slate-800 shrink-0 relative border border-slate-300 dark:border-slate-700">
                  <img
                    src={transferModal.gpsPhotoUrl || 'https://images.unsplash.com/photo-1526778548025-fa2f459cd5c1?w=600&auto=format&fit=crop&q=80'}
                    alt="GPS Location"
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="flex-1 text-[11px] space-y-0.5">
                  <div className="font-bold text-slate-900 dark:text-white flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                    <span>Lat: -8.2192, Lng: 114.3691</span>
                  </div>
                  <div className="text-slate-500 dark:text-slate-400 text-[10px]">Terintegrasi ke modul Laporan Kiriman Kru</div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    const samplePhotos = [
                      'https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?w=600&auto=format&fit=crop&q=80',
                      'https://images.unsplash.com/photo-1506015391300-4802dc74de2e?w=600&auto=format&fit=crop&q=80',
                      'https://images.unsplash.com/photo-1526778548025-fa2f459cd5c1?w=600&auto=format&fit=crop&q=80'
                    ];
                    const next = samplePhotos[Math.floor(Math.random() * samplePhotos.length)];
                    setTransferModal(prev => ({ ...prev, gpsPhotoUrl: next }));
                  }}
                  className="px-2.5 py-1.5 rounded-lg bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 font-bold text-[10px] hover:bg-amber-200 transition cursor-pointer"
                >
                  Ambil Ulang
                </button>
              </div>
            </div>

            {/* Kendala Oper Jadwal & Catatan Penugasan */}
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-800 dark:text-slate-200 block">Kendala Oper Jadwal &amp; Catatan Penugasan:</label>
              <textarea
                value={transferModal.constraintNote}
                onChange={(e) => setTransferModal(prev => ({ ...prev, constraintNote: e.target.value }))}
                placeholder="Tuliskan kendala oper jadwal agar SPV Logistik segera input kru pengganti & hindari double kiriman..."
                rows={2}
                className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 text-xs rounded-xl p-2.5 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>

            <div className="flex items-center gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setTransferModal({ isOpen: false, delivery: null, reason: 'Darurat / Halangan pribadi', transferType: 'Oper ke driver lain (Driver cari pengganti)', gpsPhotoUrl: 'https://images.unsplash.com/photo-1526778548025-fa2f459cd5c1?w=600&auto=format&fit=crop&q=80', constraintNote: '' })}
                className="flex-1 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold text-xs border border-slate-300 dark:border-slate-700 cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={submitTransferRequest}
                className="flex-1 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-xs flex items-center justify-center gap-1.5 shadow-md cursor-pointer active:scale-95"
              >
                <ArrowRightLeft className="w-4 h-4" />
                <span>Kirim Permintaan Oper</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 1D: Konfirmasi Hapus Riwayat Selesai (Khusus Super Admin) */}
      {deleteConfirmModal.isOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-sm bg-slate-900 border border-rose-500/40 rounded-2xl p-5 space-y-4 shadow-2xl">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-500/20 border border-rose-500/30 flex items-center justify-center text-rose-400 shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-black text-white">Hapus Jadwal Pengiriman</h3>
                <span className="text-[10px] text-rose-400 font-bold uppercase tracking-wider">
                  Akses SPV Logistik &amp; Super Admin
                </span>
              </div>
            </div>

            <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 text-xs space-y-1.5">
              <div className="text-slate-400">
                Toko / Tujuan: <strong className="text-white">{deleteConfirmModal.delivery?.store?.storeName || deleteConfirmModal.delivery?.areaName}</strong>
              </div>
              <div className="text-slate-400">
                Kru Bertugas: <span className="text-amber-300 font-semibold">{deleteConfirmModal.delivery?.crew?.name || '-'}</span>
              </div>
              <div className="text-slate-400">
                Area: <span className="text-emerald-400 font-semibold">{deleteConfirmModal.delivery?.areaName || 'Banyuwangi'}</span>
              </div>
            </div>

            <p className="text-xs text-slate-400 leading-relaxed">
              Apakah Anda yakin ingin menghapus jadwal pengiriman ini? Data jadwal akan dihapus secara permanen dari portal dan daftar penugasan.
            </p>

            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                onClick={() => setDeleteConfirmModal({ isOpen: false, delivery: null })}
                className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleDeleteCompletedSchedule}
                className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-md cursor-pointer active:scale-95"
              >
                <Trash2 className="w-4 h-4" />
                <span>Ya, Hapus Permanen</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: Konfirmasi Tiba di Gudang Argo */}
      {podModal.isOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-t-2xl sm:rounded-2xl p-5 space-y-4 shadow-2xl max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <div className="flex items-center gap-2 text-emerald-400">
                <CheckCircle2 className="w-5 h-5 shrink-0" />
                <h3 className="text-sm font-black text-white">Konfirmasi Tiba di Gudang Argo</h3>
              </div>
              <button
                onClick={() => setPodModal({ isOpen: false, delivery: null, conditionNote: '', serviceNote: '', hasSignature: true, photoUrl: null, photoTimestamp: null, postTripFleetStatus: 'available' })}
                className="p-1 rounded-lg text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Nomor Kendaraan Armada Otomatis Terkunci Sesuai Pilihan Armada Setelah Check-In */}
            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center justify-between">
                <span>Nomor Kendaraan Armada:</span>
                <span className="text-[10px] text-emerald-400 font-bold">✓ Terkunci Otomatis Sesuai Check-In</span>
              </label>
              <div className="w-full bg-slate-950 border border-emerald-500/40 rounded-xl px-3 py-2 text-xs flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Truck className="w-4 h-4 text-amber-400" />
                  <span className="font-mono font-bold text-amber-400 text-sm">
                    {assignedFleet?.plateNumber || podModal.delivery?.fleet?.plateNumber || 'P 8848 U'}
                  </span>
                  {assignedFleet?.initialCode && (
                    <span className="px-2 py-0.5 rounded-lg bg-amber-500/20 text-amber-400 border border-amber-500/40 text-[10px] font-black">
                      Inisial: {assignedFleet.initialCode}
                    </span>
                  )}
                </div>
                <span className="px-2 py-0.5 rounded-md bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 text-[10px] font-bold">
                  Terkunci Otomatis
                </span>
              </div>
            </div>

            <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 text-xs space-y-1">
              <div className="font-bold text-white">{podModal.delivery?.store?.storeName || podModal.delivery?.areaName}</div>
              <div className="text-slate-400 text-[11px]">{podModal.delivery?.store?.address}</div>
              <div className="text-amber-400 font-semibold text-[11px] pt-1">Area Kirim: {podModal.delivery?.areaName || podModal.delivery?.store?.storeName || 'Tujuan'}</div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-300 block">Keterangan Konfirmasi Tiba di Gudang:</label>
              <input
                type="text"
                value={podModal.conditionNote}
                onChange={(e) => setPodModal(prev => ({ ...prev, conditionNote: e.target.value }))}
                placeholder="Isi keterangan tiba di gudang..."
                className="w-full bg-slate-950 border border-slate-800 text-slate-200 text-xs rounded-xl px-3 py-2.5 focus:outline-none focus:border-emerald-500"
              />
            </div>

            {/* Pilihan Status Armada Sampai di Argo (Aman Tidak Perlu Servis vs Perlu Perawatan) */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-300 block">Status Armada Sampai di Argo:</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setPodModal(prev => ({ ...prev, postTripFleetStatus: 'available', serviceNote: '' }))}
                  className={`p-2.5 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer ${
                    podModal.postTripFleetStatus === 'available'
                      ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300 shadow-sm'
                      : 'bg-slate-950 border-slate-800 text-slate-400'
                  }`}
                >
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>Aman Tidak Perlu Servis</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPodModal(prev => ({ ...prev, postTripFleetStatus: 'maintenance' }))}
                  className={`p-2.5 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer ${
                    podModal.postTripFleetStatus === 'maintenance'
                      ? 'bg-amber-500/20 border-amber-500 text-amber-300 shadow-sm'
                      : 'bg-slate-950 border-slate-800 text-slate-400'
                  }`}
                >
                  <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                  <span>Perlu Perawatan</span>
                </button>
              </div>

              {/* Input Apa yang Perlu Diservis jika memilih Perlu Perawatan */}
              {podModal.postTripFleetStatus === 'maintenance' && (
                <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/40 space-y-1.5 animate-in fade-in duration-150">
                  <label className="text-xs font-bold text-amber-300 block">
                    Apa yang Perlu Diservis / Diperbaiki pada Armada: <span className="text-rose-400">*</span>
                  </label>
                  <textarea
                    rows={2}
                    value={podModal.serviceNote}
                    onChange={(e) => setPodModal(prev => ({ ...prev, serviceNote: e.target.value }))}
                    placeholder="Contoh: Kampas rem belakang tipis, ganti oli mesin, atau pengecekan ban..."
                    className="w-full bg-slate-950 border border-amber-500/50 text-white text-xs rounded-xl p-2.5 focus:outline-none focus:border-amber-400"
                  />
                </div>
              )}
            </div>

            {/* Foto GPS Sudah di Gudang / Depan Gerbang (Full Screen & Utuh Tidak Terpotong) */}
            <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-1.5 font-bold text-slate-300">
                  <Camera className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Foto GPS Sudah di Gudang / Depan Gerbang</span>
                </div>
                {podModal.photoUrl ? (
                  <span className="text-[10px] text-emerald-400 font-bold flex items-center gap-1">
                    <Check className="w-3 h-3" /> Foto GPS Full Screen
                  </span>
                ) : (
                  <span className="text-[10px] text-amber-400 font-bold">Wajib / GPS Terverifikasi</span>
                )}
              </div>

              {podModal.photoUrl ? (
                <div className="space-y-2">
                  <div className="relative rounded-xl overflow-hidden border border-slate-700 bg-black group flex items-center justify-center">
                    <img
                      src={podModal.photoUrl}
                      alt="GPS Gudang Preview Utuh"
                      className="w-full max-h-60 object-contain bg-black cursor-pointer"
                      onClick={() => setViewPhotoModal({
                        isOpen: true,
                        photoUrl: podModal.photoUrl!,
                        title: `Bukti Foto GPS Gudang - ${podModal.delivery?.store?.storeName || podModal.delivery?.areaName}`,
                        subtitle: `Area: ${podModal.delivery?.areaName || 'Gudang Argo'} | Foto Utuh Full Screen`
                      })}
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setViewPhotoModal({
                        isOpen: true,
                        photoUrl: podModal.photoUrl!,
                        title: `Bukti Foto GPS Gudang - ${podModal.delivery?.store?.storeName || podModal.delivery?.areaName}`,
                        subtitle: `Area: ${podModal.delivery?.areaName || 'Gudang Argo'} | Foto Utuh Full Screen`
                      })}
                      className="flex-1 py-2 px-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-[11px] font-bold text-white flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <Eye className="w-3.5 h-3.5 text-cyan-400" />
                      <span>Lihat Full Screen</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setCameraModal({ isOpen: true, delivery: podModal.delivery })}
                      className="flex-1 py-2 px-2 rounded-lg bg-cyan-600/20 hover:bg-cyan-600/30 border border-cyan-500/40 text-[11px] font-bold text-cyan-300 flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      <span>Foto Ulang Full Screen</span>
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setCameraModal({ isOpen: true, delivery: podModal.delivery })}
                  className="w-full py-3.5 px-3 rounded-xl bg-gradient-to-r from-cyan-600/25 to-blue-600/25 hover:from-cyan-600/35 hover:to-blue-600/35 border border-cyan-500/40 text-cyan-200 text-xs font-bold flex items-center justify-center gap-2 transition active:scale-95 cursor-pointer shadow-inner"
                >
                  <div className="w-7 h-7 rounded-full bg-cyan-500/30 flex items-center justify-center text-cyan-300">
                    <Camera className="w-4 h-4" />
                  </div>
                  <span>Buka Kamera Full Screen &amp; Ambil Foto GPS</span>
                </button>
              )}
            </div>

            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setPodModal({ isOpen: false, delivery: null, conditionNote: '', serviceNote: '', hasSignature: true, photoUrl: null, photoTimestamp: null, postTripFleetStatus: 'available' })}
                className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={submitPod}
                className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-md cursor-pointer active:scale-95"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Konfirmasi Tiba di Gudang Argo</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CAMERA MODAL: Direct device camera for Proof of Delivery */}
      <DriverPodCameraModal
        isOpen={cameraModal.isOpen}
        onClose={() => setCameraModal({ isOpen: false, delivery: null })}
        onPhotoCaptured={handlePhotoCaptured}
        delivery={cameraModal.delivery}
        driverName={currentDriver?.name}
        vehiclePlate={assignedFleet?.plateNumber}
      />

      {/* FULL-SCREEN PHOTO INSPECTOR MODAL (UTUH TANPA TERPOTONG) */}
      {viewPhotoModal.isOpen && (
        <div className="fixed inset-0 z-[80] w-screen h-screen bg-black flex flex-col justify-between p-4 animate-in fade-in duration-200">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div className="min-w-0 pr-2">
              <h3 className="text-xs font-bold text-white truncate">{viewPhotoModal.title}</h3>
              <p className="text-[10px] text-slate-300 truncate">{viewPhotoModal.subtitle}</p>
            </div>
            <button
              onClick={() => setViewPhotoModal({ isOpen: false, photoUrl: '', title: '', subtitle: '' })}
              className="p-2 rounded-full bg-rose-600 text-white hover:bg-rose-500 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="flex-1 w-full h-full flex items-center justify-center py-2 overflow-hidden bg-black">
            <img
              src={viewPhotoModal.photoUrl}
              alt="Foto GPS Full Screen"
              className="w-full h-full object-contain"
            />
          </div>

          <div className="flex items-center gap-2 pt-3 border-t border-slate-800 max-w-md mx-auto w-full">
            <a
              href={viewPhotoModal.photoUrl}
              download={`FOTO_GPS_${Date.now()}.jpg`}
              className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Download className="w-4 h-4" />
              <span>Unduh Foto</span>
            </a>
            <button
              onClick={() => setViewPhotoModal({ isOpen: false, photoUrl: '', title: '', subtitle: '' })}
              className="flex-1 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs cursor-pointer"
            >
              Tutup Full Screen
            </button>
          </div>
        </div>
      )}

      {/* MODAL 5: Pusat Antrean Sinkronisasi Offline (IndexedDB & LocalStorage) */}
      {isQueueModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-t-2xl sm:rounded-2xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden">
            {/* Modal Header */}
            <div className="p-4 border-b border-slate-800 flex items-center justify-between shrink-0 bg-slate-950/80">
              <div className="flex items-center gap-2.5">
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center border shrink-0 ${
                  !syncState.isOnline || syncState.isSimulatedOffline
                    ? 'bg-amber-500/20 border-amber-500/40 text-amber-400'
                    : syncState.pendingQueue.length > 0
                    ? 'bg-cyan-500/20 border-cyan-500/40 text-cyan-400'
                    : 'bg-emerald-500/20 border-emerald-500/40 text-emerald-400'
                }`}>
                  <Database className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-white flex items-center gap-2">
                    Antrean Sinkronisasi Offline
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 font-bold border border-slate-700">
                      IndexedDB &amp; LocalStorage
                    </span>
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Penyimpanan lokal di perangkat ponsel sopir tanpa koneksi internet
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsQueueModalOpen(false)}
                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Connection Status & Simulation Switch Bar */}
            <div className="px-4 py-2.5 bg-slate-950/50 border-b border-slate-800/80 flex items-center justify-between gap-2 shrink-0">
              <div className="flex items-center gap-2 text-xs">
                <span className={`w-2.5 h-2.5 rounded-full ${
                  !syncState.isOnline || syncState.isSimulatedOffline
                    ? 'bg-rose-500 animate-ping'
                    : 'bg-emerald-400'
                }`} />
                <span className="font-bold text-slate-200">
                  {!syncState.isOnline || syncState.isSimulatedOffline
                    ? syncState.isSimulatedOffline ? `Mode Offline Aktif (${portalDisplayName})` : 'Perangkat Terputus (Offline)'
                    : 'Perangkat Online (Tersambung ke Server)'}
                </span>
              </div>
              <button
                type="button"
                onClick={() => handleToggleOfflineMode(!syncState.isSimulatedOffline)}
                className={`text-[11px] font-black px-3 py-1.5 rounded-lg border transition cursor-pointer flex items-center gap-1.5 ${
                  syncState.isSimulatedOffline
                    ? 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 border-emerald-400 shadow-sm'
                    : 'bg-slate-800 hover:bg-slate-700 text-amber-300 border-amber-500/30'
                }`}
              >
                {syncState.isSimulatedOffline ? (
                  <>
                    <Wifi className="w-3.5 h-3.5" />
                    <span>Onlinekan Kembali</span>
                  </>
                ) : (
                  <span>Uji Mode Offline</span>
                )}
              </button>
            </div>

            {/* 🚨 LAPORAN PERINGATAN SIAPA SAJA YANG MENGAKTIFKAN MODE OFFLINE HARI INI */}
            <div className="px-4 py-3 bg-slate-950/90 border-b border-slate-800 shrink-0 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 text-[11px] font-black text-rose-300 uppercase tracking-wider">
                  <AlertTriangle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                  <span>Laporan Aktivasi Mode Offline Tim Pengiriman ({todayOfflineReports.length})</span>
                </div>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-500/15 text-rose-300 border border-rose-500/30">
                  Wajib Segera Di-Online-kan
                </span>
              </div>

              {todayOfflineReports.length === 0 ? (
                <div className="p-2.5 rounded-xl bg-emerald-950/25 border border-emerald-500/30 text-[11px] text-emerald-300 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>Seluruh kru pengiriman saat ini berstatus <strong>Online</strong>. Tidak ada kru yang mengaktifkan Mode Offline.</span>
                </div>
              ) : (
                <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                  {todayOfflineReports.map(rep => {
                    const isStillOffline = rep.offlineStatus === 'masih_offline';
                    return (
                      <div
                        key={rep.id}
                        className={`p-2.5 rounded-xl border text-xs flex items-center justify-between gap-2 ${
                          isStillOffline
                            ? 'bg-rose-950/35 border-rose-500/50 text-rose-100'
                            : 'bg-emerald-950/25 border-emerald-500/40 text-emerald-100'
                        }`}
                      >
                        <div className="min-w-0 space-y-0.5">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-black text-white text-xs">{rep.driverName}</span>
                            <span className="text-[9px] px-1.5 py-0.2 rounded bg-slate-900 text-amber-300 border border-slate-700 font-mono font-bold">
                              {rep.userRole || 'Driver'} • {rep.plateNumber}
                            </span>
                            {isStillOffline ? (
                              <span className="text-[9px] px-1.5 py-0.2 rounded-full bg-rose-500/30 text-rose-200 border border-rose-400/50 font-black animate-pulse">
                                ⚠️ MASIH OFFLINE (Segera Onlinekan!)
                              </span>
                            ) : (
                              <span className="text-[9px] px-1.5 py-0.2 rounded-full bg-emerald-500/25 text-emerald-300 border border-emerald-500/40 font-bold">
                                ✓ Sudah Online ({rep.onlineRestoredAt || 'Selesai'})
                              </span>
                            )}
                          </div>
                          <div className="text-[10px] text-slate-300 truncate">
                            Area: <strong>{rep.areaName}</strong> • Aktif Offline: <strong>{rep.offlineActivatedAt || new Date(rep.timestamp).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) + ' WIB'}</strong>
                          </div>
                        </div>

                        {isStillOffline && (
                          <button
                            type="button"
                            onClick={() => handleToggleOfflineMode(false)}
                            className="px-2.5 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-[10px] shrink-0 shadow cursor-pointer active:scale-95"
                          >
                            Onlinekan
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Stat Counter Strip */}
            <div className="grid grid-cols-3 gap-2 px-4 py-3 bg-slate-900 shrink-0 border-b border-slate-800/60 text-center">
              <div className="bg-slate-950/70 p-2 rounded-xl border border-slate-800">
                <div className="text-base font-black font-mono text-amber-400">{syncState.pendingQueue.length}</div>
                <div className="text-[10px] text-slate-400 font-semibold uppercase">Tertahan di HP</div>
              </div>
              <div className="bg-slate-950/70 p-2 rounded-xl border border-slate-800">
                <div className="text-base font-black font-mono text-emerald-400">{syncState.totalSyncedCount}</div>
                <div className="text-[10px] text-slate-400 font-semibold uppercase">Tersinkronkan</div>
              </div>
              <div className="bg-slate-950/70 p-2 rounded-xl border border-slate-800">
                <div className="text-[12px] font-bold font-mono text-cyan-300 truncate mt-0.5">
                  {syncState.lastSyncTime ? `${syncState.lastSyncTime}` : '-'}
                </div>
                <div className="text-[10px] text-slate-400 font-semibold uppercase">Sync Terakhir</div>
              </div>
            </div>

            {/* Queue List Content (Scrollable) */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {syncState.pendingQueue.length === 0 ? (
                <div className="py-8 text-center space-y-3">
                  <div className="w-14 h-14 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-center justify-center mx-auto">
                    <CheckCircle2 className="w-7 h-7" />
                  </div>
                  <div>
                    <h4 className="text-sm font-black text-white">Semua Data Telah Tersinkronkan</h4>
                    <p className="text-xs text-slate-400 max-w-xs mx-auto mt-1 leading-relaxed">
                      Tidak ada pembaruan status tugas atau foto bukti POD yang tertahan di memori lokal HP. Seluruh data telah masuk ke sistem operasional pusat.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center justify-between">
                    <span>Daftar Aksi Menunggu Jaringan ({syncState.pendingQueue.length})</span>
                    <span className="text-[10px] text-amber-400 lowercase font-normal font-mono">urutan fifo otomatis</span>
                  </div>

                  {syncState.pendingQueue.map((item, idx) => {
                    const matchedDelivery = deliveries.find(d => d.id === item.scheduleId);
                    const storeName = matchedDelivery?.store?.storeName || matchedDelivery?.areaName || 'Toko Retail';
                    const city = matchedDelivery?.store?.city || 'Banyuwangi';

                    return (
                      <div
                        key={item.id}
                        className="bg-slate-950/90 border border-slate-800 rounded-xl p-3.5 space-y-2.5 shadow-sm"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="text-[10px] font-bold font-mono text-amber-400">
                                #{idx + 1} · {item.trackingNumber}
                              </span>
                              <span className="text-slate-500">|</span>
                              <span className="text-xs font-bold text-white truncate">{storeName}</span>
                            </div>
                            <div className="text-[11px] text-slate-400 mt-0.5">
                              Tujuan: {city} · Driver ID: {item.driverId}
                            </div>
                          </div>

                          <div className="shrink-0">
                            {item.status === 'syncing' ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/20 text-blue-300 border border-blue-500/40 animate-pulse">
                                <RefreshCw className="w-2.5 h-2.5 animate-spin" />
                                <span>Mengirim...</span>
                              </span>
                            ) : item.status === 'failed' ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/40">
                                <AlertCircle className="w-2.5 h-2.5" />
                                <span>Gagal ({item.retryCount}x)</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40">
                                <Clock className="w-2.5 h-2.5" />
                                <span>Tertunda di HP</span>
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Status Transition flow */}
                        <div className="flex items-center gap-2 bg-slate-900/80 px-2.5 py-1.5 rounded-lg border border-slate-800/80 text-xs">
                          <span className="text-[11px] text-slate-400">Pembaruan:</span>
                          <span className="text-[10px] font-mono text-slate-300 font-semibold uppercase">
                            {item.previousStatus || 'scheduled'}
                          </span>
                          <ArrowRight className="w-3 h-3 text-amber-400 shrink-0" />
                          <span className="text-[10px] font-mono font-black text-amber-400 uppercase bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/30">
                            {item.newStatus}
                          </span>
                        </div>

                        {/* Notes if any */}
                        {item.notes && (
                          <div className="text-[11px] text-slate-300 bg-slate-900/50 p-2 rounded-lg border border-slate-800/60 leading-snug">
                            <span className="text-slate-400 font-semibold">Catatan: </span>
                            {item.notes}
                          </div>
                        )}

                        {/* POD Preview if available */}
                        {item.podData?.podPhotoUrl && (
                          <div className="flex items-center justify-between gap-2 p-2 rounded-lg bg-emerald-950/20 border border-emerald-500/30">
                            <div className="flex items-center gap-2 min-w-0">
                              <img
                                src={item.podData.podPhotoUrl}
                                alt="POD Offline"
                                className="w-10 h-10 object-cover rounded-md border border-slate-700 shrink-0"
                              />
                              <div className="min-w-0 text-[11px]">
                                <div className="font-bold text-emerald-300">Foto Bukti POD Tersimpan</div>
                                <div className="text-slate-400 text-[10px] truncate">
                                  Penerima: {item.podData.podReceiverName || 'PIC Toko'}
                                </div>
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => setViewPhotoModal({
                                isOpen: true,
                                photoUrl: item.podData!.podPhotoUrl!,
                                title: `Foto POD Offline - ${storeName}`,
                                subtitle: `PO ${item.trackingNumber} | Diterima: ${item.podData?.podReceiverName || 'PIC'}`
                              })}
                              className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-[10px] font-bold text-cyan-300 shrink-0 cursor-pointer"
                            >
                              Lihat
                            </button>
                          </div>
                        )}

                        {/* Timestamp & Actions */}
                        <div className="flex items-center justify-between pt-1 border-t border-slate-800/80 text-[10px]">
                          <span className="text-slate-400 font-mono">
                            Dicatat HP: {new Date(item.clientTimestamp).toLocaleTimeString('id-ID')} WIB
                          </span>

                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={async () => {
                                const res = await driverOfflineSyncService.syncAction(item.id);
                                if (res.success) {
                                  addNotification('delivery', 'Sinkronisasi Berhasil', res.message);
                                  loadDeliveries(true);
                                } else {
                                  addNotification('sla_warning', 'Sinkronisasi Gagal', res.message);
                                }
                              }}
                              disabled={!driverOfflineSyncService.isEffectivelyOnline() || syncState.isSyncingQueue}
                              className="px-2 py-1 rounded-md bg-cyan-600/20 hover:bg-cyan-600/30 text-cyan-300 border border-cyan-500/30 font-bold transition cursor-pointer disabled:opacity-40"
                              title="Kirim item ini ke server sekarang"
                            >
                              Kirim
                            </button>
                            <button
                              type="button"
                              onClick={() => driverOfflineSyncService.removeAction(item.id)}
                              className="px-2 py-1 rounded-md bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 border border-rose-500/30 font-bold transition cursor-pointer"
                              title="Hapus aksi dari antrean"
                            >
                              Hapus
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Modal Footer Controls */}
            <div className="p-4 border-t border-slate-800 bg-slate-950/90 flex flex-wrap items-center justify-between gap-2 shrink-0">
              {syncState.pendingQueue.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    if (window.confirm('Apakah Anda yakin ingin mengosongkan seluruh antrean offline? Data yang belum disinkronkan akan dihapus dari memori HP.')) {
                      driverOfflineSyncService.clearQueue();
                      addNotification('delivery', 'Antrean Dikosongkan', 'Seluruh aksi offline telah dihapus dari memori HP.');
                    }
                  }}
                  className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-rose-300 text-xs font-bold transition cursor-pointer"
                >
                  Bersihkan Antrean
                </button>
              )}

              <div className="flex items-center gap-2 ml-auto">
                <button
                  type="button"
                  onClick={() => setIsQueueModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition cursor-pointer"
                >
                  Tutup
                </button>

                <button
                  type="button"
                  onClick={async () => {
                    const res = await driverOfflineSyncService.syncQueue();
                    if (res.synced > 0) {
                      addNotification(
                        'delivery',
                        'Sinkronisasi Sukses',
                        `${res.synced} pembaruan tugas berhasil disinkronkan ke server pusat.`
                      );
                      loadDeliveries(true);
                    } else if (res.failed > 0) {
                      addNotification(
                        'sla_warning',
                        'Sebagian Gagal',
                        `${res.failed} tugas gagal dikirim. Periksa koneksi internet Anda.`
                      );
                    }
                  }}
                  disabled={
                    syncState.pendingQueue.length === 0 ||
                    !driverOfflineSyncService.isEffectivelyOnline() ||
                    syncState.isSyncingQueue
                  }
                  className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:bg-slate-800 text-slate-950 disabled:text-slate-500 text-xs font-black shadow-md transition active:scale-95 cursor-pointer disabled:cursor-not-allowed flex items-center gap-1.5"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${syncState.isSyncingQueue ? 'animate-spin' : ''}`} />
                  <span>
                    {syncState.isSyncingQueue
                      ? 'Menyinkronkan...'
                      : !driverOfflineSyncService.isEffectivelyOnline()
                      ? 'Offline (Tunggu Sinyal)'
                      : `Sinkronkan Semua (${syncState.pendingQueue.length})`}
                  </span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 6: Surat Jalan Keluar (Outbound Delivery Waybill Resmi) */}
      <DriverSuratJalanModal
        isOpen={isWaybillModalOpen}
        waybill={activeWaybillToView}
        onClose={() => {
          setIsWaybillModalOpen(false);
          setActiveWaybillToView(null);
        }}
        onStatusUpdated={(updated) => {
          setActiveWaybillToView(updated);
          loadDeliveries(true);
        }}
      />

      {/* MODAL 7: Checklist Kendaraan (Inspeksi Fisik Armada) */}
      <DriverVehicleChecklistModal
        isOpen={isChecklistModalOpen}
        onClose={() => {
          setIsChecklistModalOpen(false);
          setActiveChecklistToEdit(null);
        }}
        driverId={selectedDriverId}
        driverName={currentDriver?.name || 'Driver'}
        fleetId={assignedFleet?.id || 'fl-01'}
        plateNumber={assignedFleet?.plateNumber || 'P 8848 U'}
        vehicleType={assignedFleet?.vehicleType || 'Engkel Long Box'}
        initialChecklist={activeChecklistToEdit}
        defaultInspectionType={checklistInspectionType}
        canSelectPostTrip={hasConfirmedArrivalToday}
        onSaved={(saved) => {
          const todayStr = new Date().toISOString().slice(0, 10);
          setIsFleetLockedAfterCheckin(true);
          if (saved.inspectionType === 'pre_trip') {
            setIsChecklistCompletedAfterCheckin(true);
            try {
              localStorage.setItem(`akk_fleet_locked_flag_${selectedDriverId}`, 'true');
              localStorage.setItem(`akk_checklist_done_${selectedDriverId}`, todayStr);
            } catch {}

            // Sinkronkan status Checklist & Persiapan Keluar ke jadwal aktif bersama agar Partner (Driver/Helper) tidak perlu isi ulang
            const activeScheduleIds = deliveries
              .filter(d => d.status !== 'delivered')
              .map(d => d.id);
            if (activeScheduleIds.length > 0) {
              const nowTime =
                new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) + ' WIB';
              const nextArgo = { ...keluarArgoMap };
              activeScheduleIds.forEach(id => {
                nextArgo[id] = nowTime;
              });
              setKeluarArgoMap(nextArgo);
              setSjKeluarSistemMap(nextArgo);
              try {
                localStorage.setItem('akk_driver_keluar_argo_v1', JSON.stringify(nextArgo));
                localStorage.setItem('akk_driver_sj_sistem_v1', JSON.stringify(nextArgo));
              } catch {}

              updateSharedScheduleFlow(activeScheduleIds, {
                fleetId: saved.fleetId,
                plateNumber: saved.plateNumber,
                vehicleType: saved.vehicleType,
                checklistCompleted: true,
                checklistCompletedBy: portalDisplayName,
                preparedForGateOut: true,
                preparedBy: portalDisplayName
              });
            }
          }
          setChecklists(prev => {
            const idx = prev.findIndex(c => c.id === saved.id);
            if (idx >= 0) {
              const copy = [...prev];
              copy[idx] = saved;
              return copy;
            }
            return [saved, ...prev];
          });
          setWaybillRefreshTick(t => t + 1);
          setBottomNav('deliveries');
          setActiveTab(saved.inspectionType === 'post_trip' ? 'delivered' : 'active');
          addNotification(
            'delivery',
            saved.inspectionType === 'post_trip'
              ? 'Checklist Pasca-Jalan Tersimpan'
              : 'Checklist Pra-Jalan Disimpan • Siap Keluar Gerbang',
            saved.inspectionType === 'post_trip'
              ? `Checklist Pasca-Jalan (Pulang) armada ${saved.plateNumber} telah tersimpan.`
              : `Checklist Pra-Jalan armada ${saved.plateNumber} telah tersimpan & tersinkronisasi untuk kru satu armada. Jadwal aktif kini siap Keluar Gerbang (Gate-Out).`
          );
        }}
      />

      {/* MODAL 8: Presensi Masuk Shift Driver (PIN Keamanan 2x Verifikasi & Ubah PIN) */}
      <DriverCheckinModal
        isOpen={isCheckinModalOpen}
        onClose={() => setIsCheckinModalOpen(false)}
        driverId={selectedDriverId}
        driverName={currentDriver?.name || portalDisplayName || 'Driver'}
        userRole={syncedUserRoleInfo.roleLabel}
        areaName={activeDeliveries[0]?.areaName || deliveries[0]?.areaName || 'Area Distribusi AKK'}
        fleetId={assignedFleet?.id || 'fl-01'}
        plateNumber={assignedFleet?.plateNumber || 'P 8848 U'}
        vehicleType={assignedFleet?.vehicleType || 'Engkel Long Box'}
        initialMode={checkinModalMode}
        onCheckinSuccess={(shift) => {
          setActiveShift(shift);
          const todayStr = new Date().toISOString().slice(0, 10);
          // Jika partner (Driver/Helper dalam 1 jadwal/armada yang sama) SUDAH isi armada & checklist,
          // langsung sinkronkan ke Jadwal Aktif (Keluar Gerbang / Check-Out) tanpa mengulang pengisian!
          if (sharedCrewPreTripState.isDone) {
            setIsFleetLockedAfterCheckin(true);
            setIsChecklistCompletedAfterCheckin(true);
            if (assignedFleet?.id) {
              setSelectedFleetId(assignedFleet.id);
            }
            try {
              if (assignedFleet?.id) {
                localStorage.setItem(`akk_locked_fleet_${selectedDriverId}`, assignedFleet.id);
              }
              localStorage.setItem(`akk_fleet_locked_flag_${selectedDriverId}`, 'true');
              localStorage.setItem(`akk_checklist_done_${selectedDriverId}`, todayStr);
            } catch {}
            setIsPostCheckinFleetModalOpen(false);
            setBottomNav('deliveries');
            setActiveTab('active');
            addNotification(
              'delivery',
              'Check-In Tersinkronisasi • Siap Keluar Gerbang',
              `Armada (${assignedFleet?.plateNumber || ''}) & Checklist telah diselesaikan oleh ${sharedCrewPreTripState.completedBy}. Tampilan langsung menuju Jadwal Aktif untuk Keluar Gerbang / Check-Out tanpa aktivitas ganda.`
            );
            return;
          }

          // Alur Langsung: Setelah Check-In, SISTEM LANGSUNG MEMBUKA FORM CHECKLIST ARMADA!
          const targetFleet = assignedFleet || activeDeliveries[0]?.fleet || deliveries[0]?.fleet || fleets[0];
          if (targetFleet?.id) {
            setSelectedFleetId(targetFleet.id);
            setIsFleetLockedAfterCheckin(true);
            try {
              localStorage.setItem(`akk_locked_fleet_${selectedDriverId}`, targetFleet.id);
              localStorage.setItem(`akk_fleet_locked_flag_${selectedDriverId}`, 'true');
            } catch {}
          }

          const fresh = driverChecklistService.createNewChecklistTemplate(
            selectedDriverId,
            currentDriver?.name || portalDisplayName || 'Driver',
            targetFleet?.id || 'fl-01',
            targetFleet?.plateNumber || 'P 8848 U',
            targetFleet?.vehicleType || 'Engkel Long Box'
          );
          setActiveChecklistToEdit(fresh);
          setChecklistInspectionType('pre_trip');
          setIsChecklistModalOpen(true);
          setIsPostCheckinFleetModalOpen(false);
          setBottomNav('deliveries');
          setActiveTab('active');

          addNotification(
            'delivery',
            'Check-In Berhasil • Silakan Isi Checklist Armada',
            `Presensi Check-In tersimpan. Silakan isi & simpan Form Checklist Armada (${targetFleet?.plateNumber || ''}) untuk mengaktifkan Tombol Buka SJ Keluar & Keluar Gerbang.`
          );
        }}
      />

      {/* MODAL 8B: Pilih & Kunci Armada Setelah Check-In (Langsung Lanjut Isi Checklist Armada / Skip untuk Helper) */}
      {isPostCheckinFleetModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-md bg-slate-900 border border-slate-700 rounded-3xl p-5 space-y-4 shadow-2xl text-xs">
            <div className="flex items-center pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 shrink-0">
                  <Truck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-white uppercase tracking-tight">
                    Pilih Armada &amp; Lanjut Checklist
                  </h3>
                  <p className="text-[11px] text-slate-300">
                    Tahap wajib Driver setelah Check-In sebelum Mulai Berangkat
                  </p>
                </div>
              </div>
            </div>

            {/* Info Kru & Opsi Skip Khusus Helper */}
            <div className="p-3 rounded-2xl bg-slate-950 border border-slate-800 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Nama Kru Check-In:</span>
                <strong className="text-white">{portalDisplayName}</strong>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Role / Posisi:</span>
                <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 font-bold text-[10px]">
                  {syncedUserRoleInfo.roleLabel}
                </span>
              </div>
            </div>

            {/* Pilihan Armada */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-white block">
                Pilih Nomor Kendaraan Armada yang Digunakan:
              </label>
              <div className="max-h-52 overflow-y-auto space-y-1.5 pr-1">
                {fleets.map(f => {
                  const isSelected = (selectedFleetId || assignedFleet?.id) === f.id;
                  const liveInfo = logisticsStore.getFleetLiveOperationalInfo(f);
                  const isMaintenance = liveInfo.effectiveStatus === 'maintenance';
                  return (
                    <button
                      key={f.id}
                      type="button"
                      disabled={isMaintenance}
                      onClick={() => {
                        if (!isMaintenance) {
                          setSelectedFleetId(f.id);
                        }
                      }}
                      className={`w-full p-3 rounded-xl border text-left flex items-center justify-between transition ${
                        isMaintenance
                          ? 'bg-rose-950/20 border-rose-500/30 text-slate-500 opacity-60 cursor-not-allowed'
                          : isSelected
                          ? 'bg-emerald-500/20 border-emerald-500 text-white shadow-sm cursor-pointer'
                          : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700 cursor-pointer'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className={`w-3.5 h-3.5 rounded-full shrink-0 ${liveInfo.dotColorClass}`} />
                        <div className="min-w-0">
                          <div className="font-mono font-black text-xs text-white flex items-center gap-1.5 flex-wrap">
                            <span>{f.plateNumber}</span>
                            {f.initialCode && (
                              <span className="text-amber-400 font-bold">({f.initialCode})</span>
                            )}
                            <span className={`px-1.5 py-0.2 rounded text-[9px] font-bold border ${liveInfo.badgeColorClass}`}>
                              {liveInfo.statusLabel}
                            </span>
                          </div>
                          <div className="text-[10px] text-slate-400 truncate mt-0.5">
                            {f.vehicleType} • {liveInfo.statusDescription}
                          </div>
                        </div>
                      </div>
                      {isSelected && !isMaintenance && (
                        <span className="px-2 py-0.5 rounded-md bg-emerald-500 text-slate-950 font-black text-[10px] shrink-0">
                          Dipilih
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
              <p className="text-[10px] text-emerald-400 font-medium">
                ✓ Nomor kendaraan armada yang dipilih akan otomatis terkunci pada fitur Lapor Kendala &amp; Akhir Kirim.
              </p>
            </div>

            {/* Action Buttons: Driver Lanjut Isi Checklist vs Skip Khusus Helper */}
            <div className="space-y-2 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => {
                  const targetId = selectedFleetId || assignedFleet?.id || fleets[0]?.id || '';
                  const lockedFleet = lockSelectedFleetForDriver(targetId);
                  setIsPostCheckinFleetModalOpen(false);
                  const fresh = driverChecklistService.createNewChecklistTemplate(
                    selectedDriverId,
                    currentDriver?.name || portalDisplayName || 'Driver',
                    lockedFleet?.id || 'fl-01',
                    lockedFleet?.plateNumber || 'P 8848 U',
                    lockedFleet?.vehicleType || 'Engkel Long Box'
                  );
                  setActiveChecklistToEdit(fresh);
                  setChecklistInspectionType('pre_trip');
                  setIsChecklistModalOpen(true);
                }}
                className="w-full py-3 px-4 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20 cursor-pointer active:scale-95 transition"
              >
                <ClipboardCheck className="w-4 h-4" />
                <span>Simpan Armada &amp; Lanjut Isi Checklist Armada</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setIsHelperPositionSkipped(true);
                  try {
                    localStorage.setItem(`akk_helper_skipped_${selectedDriverId}`, 'true');
                  } catch {}
                  setIsPostCheckinFleetModalOpen(false);
                  setBottomNav('deliveries');
                  setActiveTab('active');
                  addNotification(
                    'delivery',
                    'Posisi Helper (Isi Armada & Checklist Diskip)',
                    'Anda melewati pengisian armada & checklist karena berposisi sebagai Helper (bukan Driver).'
                  );
                }}
                className="w-full py-2.5 px-4 rounded-xl bg-slate-950 hover:bg-slate-800 border border-cyan-500/40 text-cyan-300 font-bold text-xs flex items-center justify-center gap-2 cursor-pointer active:scale-95 transition"
              >
                <span>Skip / Lewati (Khusus Posisi Helper - Bukan Driver)</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 9: Unduh APK Android Driver Mobile */}
      <AndroidApkDownloadModal
        isOpen={isApkModalOpen}
        onClose={() => setIsApkModalOpen(false)}
      />

      {/* MODAL 10: Konfirmasi Check-Out Shift Driver (Tanpa Odo Awal, Odo Akhir, dan Catatan Akhir Shift) */}
      {isCheckoutModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-sm bg-slate-900 border border-slate-800 rounded-t-3xl sm:rounded-2xl p-5 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <div className="flex items-center gap-2 text-rose-400">
                <Clock className="w-5 h-5 shrink-0" />
                <h3 className="text-sm font-black text-white">Konfirmasi Check-Out Shift</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsCheckoutModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 space-y-2.5 text-xs">
              <div className="flex justify-between items-center">
                <span className="text-slate-400">Nama ({syncedUserRoleInfo.roleLabel}):</span>
                <span className="font-bold text-white">{currentDriver?.name || activeShift?.driverName || portalDisplayName}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-400">Armada / Plat:</span>
                <span className="font-mono text-cyan-400 font-bold">{assignedFleet?.plateNumber || activeShift?.plateNumber || 'P 8125 VC'}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-400">Waktu Check-In:</span>
                <span className="font-mono text-emerald-400 font-bold">{activeShift?.checkinTimeFormatted || '-'}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-400">Waktu Check-Out:</span>
                <span className="font-mono text-amber-400 font-bold">
                  {new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })} WIB (Otomatis)
                </span>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-[11px] text-emerald-300 leading-relaxed flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <span>
                Data <strong>Check-Out</strong> ini otomatis digabungkan menjadi satu baris dengan data <strong>Check-In</strong> Anda di dalam sub menu <strong>Laporan Kiriman Kru</strong>.
              </span>
            </div>

            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsCheckoutModalOpen(false)}
                className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs cursor-pointer transition"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={async () => {
                  const targetDriverId = activeShift?.driverId || selectedDriverId;
                  const res = await driverShiftService.checkOutDriver(
                    targetDriverId,
                    undefined,
                    {
                      driverName: currentDriver?.name || activeShift?.driverName || portalDisplayName,
                      userRole: syncedUserRoleInfo.roleLabel,
                      plateNumber: assignedFleet?.plateNumber || activeShift?.plateNumber || 'P 8125 VC',
                      areaName: activeDeliveries[0]?.areaName || deliveries[0]?.areaName || 'Area Distribusi AKK'
                    }
                  );
                  // Saat Check-Out shift selesai dan kru sudah di gudang, bila armada tidak sedang Servis maka kembalikan ke Ready
                  if (assignedFleet && assignedFleet.status !== 'maintenance') {
                    logisticsStore.updateFleetStatus(assignedFleet.id, 'available', 0);
                    setFleets(logisticsStore.getFleets());
                  }
                  addNotification(
                    'schedule',
                    'Check-Out Berhasil • Armada Ready',
                    res.message || 'Shift dinas resmi diakhiri dan armada kembali berstatus Ready.'
                  );
                  setActiveShift(null);
                  setIsCheckoutModalOpen(false);
                }}
                className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-rose-600 to-rose-500 hover:from-rose-500 hover:to-rose-400 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-md shadow-rose-600/30 cursor-pointer active:scale-95 transition"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Selesai &amp; Check-Out</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 11: Lapor Kendala & Absen Kiriman Pelanggan */}
      <DriverGmapsShareModal
        isOpen={isGmapsShareModalOpen}
        onClose={() => setIsGmapsShareModalOpen(false)}
        deliveries={deliveries}
        driverId={selectedDriverId}
        driverName={currentDriver?.name || activeShift?.driverName}
        plateNumber={assignedFleet?.plateNumber || activeShift?.plateNumber || 'P 8125 VC'}
        onReportSubmitted={async (report) => {
          if (report.delivery) {
            if (report.category === 'kendala_jalan') {
              const delayNote = `KENDALA GMAPS: ${report.notes || 'Kendala rute perjalanan'} (GPS: ${report.driverLat.toFixed(4)}, ${report.driverLng.toFixed(4)})`;
              await handleUpdateStatus(report.delivery, 'delayed', delayNote);
            }
            if (report.photoUrl) {
              logisticsStore.attachImageToSchedule(
                report.delivery.id,
                report.photoUrl,
                'other',
                `Foto Gmaps [${report.category}]: ${report.notes || 'Dokumentasi'}`
              );
            }
          }
          addNotification(
            'delivery',
            'Laporan Kru Terkirim',
            `Laporan kru (${assignedFleet?.plateNumber || report.plateNumber}) berhasil dikirim ke sistem operasional DC.`
          );
        }}
      />
    </div>
  );
};
