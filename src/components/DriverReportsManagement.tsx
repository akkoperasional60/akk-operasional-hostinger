import React, { useState, useEffect, useMemo, useRef } from 'react';
import { AkkLogo } from './AkkLogo';
import {
  MapPin,
  AlertTriangle,
  CheckCircle2,
  Navigation,
  Search,
  Filter,
  Download,
  ExternalLink,
  Eye,
  Check,
  Clock,
  Truck,
  User,
  ShieldCheck,
  RefreshCw,
  Camera,
  MessageSquare,
  X,
  FileSpreadsheet,
  Layers,
  ChevronRight,
  Printer,
  Calendar,
  Lock,
  Send,
  Sparkles,
  HelpCircle,
  FileText,
  AlertOctagon,
  ArrowRight,
  WifiOff,
  Wifi,
  Edit,
  UserCheck,
  Fuel,
  LogIn,
  LogOut,
  Trash2,
  ChevronDown,
  FileCheck2
} from 'lucide-react';
import { driverReportService, DriverHelperReport, getLocalDateStr } from '../services/driverReportService';
import { SchedulePortalValidationReport } from './SchedulePortalValidationReport';
import { IntegratedRouteValidation } from './IntegratedRouteValidation';
import { MuatReturValidationTab } from './sales/MuatReturValidationTab';
import { driverShiftService } from '../services/driverShiftService';
import { useToast } from '../context/ToastContext';
import { logisticsStore } from '../services/store';
import { FleetChecklistReportView } from './FleetChecklistReportView';
import { CrewAttendanceReportView } from './CrewAttendanceReportView';
import { ExifMetadataBadge, createExifMetadataFromDate } from '../utils/exifMetadata';
import {
  formKirimStore,
  FormKirimRecord,
  FormKirimInvoiceItem,
  FormKirimGpsLockEntry
} from '../services/formKirimStore';
import { getAreaScheduleTiming } from '../utils/areaScheduleRules';
import { listenCrewChanged } from './crew/crewApi';

export type DateFilterMode = 'single_date' | 'this_week' | 'this_month' | 'all';

interface FormKirimGpsReportRow {
  rowId: string;
  formKirimId: string;
  noFormKirim: string;
  tanggalKirim: string;
  areaKirim: string;
  plateNumber: string;
  armadaInitial: string;
  driverName: string;
  helperName: string;
  customerName: string;
  customerAddress: string;
  paymentCategory: 'COD' | 'TEMPO';
  invoiceNumbers: string[];
  itemIds: string[];
  totalNilaiFaktur: number;
  savedMethod: string;
  nominalDiterima: number;
  customerNote: string;
  editCount: number;
  lastUpdatedBy: string;
  lastUpdatedAt: string;
  gpsAwal: FormKirimGpsLockEntry | null;
  gpsKedua: FormKirimGpsLockEntry | null;
  gpsKetiga: FormKirimGpsLockEntry | null;
  allGpsEntries: FormKirimGpsLockEntry[];
}

function computeDistanceMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c);
}

export const DriverReportsManagement: React.FC = () => {
  const { addNotification } = useToast();
  const [currentUser, setCurrentUser] = useState(() => logisticsStore.getCurrentUser());

  useEffect(() => {
    const syncUser = () => setCurrentUser({ ...logisticsStore.getCurrentUser() });
    const unsub = logisticsStore.subscribe(syncUser);
    return () => unsub();
  }, []);

  // Role authorization: Status & Solutions can only be accessed/managed by SPV Logistik and Super Admin
  const isAuthorizedSpvOrAdmin = useMemo(() => {
    const r = (currentUser?.role || '').toLowerCase().trim().replace(/[\s_-]+/g, '');
    const name = (currentUser?.fullName || '').toLowerCase();
    return (
      r === 'superadmin' ||
      r === 'spvlogistik' ||
      r === 'admin' ||
      r === 'manager' ||
      r === 'operasional' ||
      r === 'pengiriman' ||
      name.includes('super') ||
      name.includes('spv') ||
      name.includes('supervisor') ||
      name.includes('bayu') ||
      name.includes('bahri')
    );
  }, [currentUser]);

  // Role authorization: Hapus laporan HANYA berlaku untuk role Super Admin
  const isSuperAdmin = useMemo(() => {
    const r = String(currentUser?.role || '').toLowerCase().trim().replace(/[\s_-]+/g, '');
    return r === 'superadmin';
  }, [currentUser]);

  const [storeTick, setStoreTick] = useState(0);
  useEffect(() => {
    const bump = () => setStoreTick(t => t + 1);
    return logisticsStore.subscribe(bump);
  }, []);

  const fleets = useMemo(() => logisticsStore.getFleets(), [storeTick]);
  const schedules = useMemo(() => logisticsStore.getSchedules(), [storeTick]);

  // Helper untuk menampilkan Plat Nomor beserta Nama Inisial Armada (contoh: P 8711 UW (N21 / NL2))
  const formatPlateWithInitial = (plateRaw?: string): string => {
    const raw = (plateRaw || '-').trim();
    if (!raw || raw === '-' || /^FLT-\d+$/i.test(raw) || raw.toUpperCase().endsWith('AKK')) return '-';
    if (raw.includes('(') && raw.includes(')')) return raw;
    const cleanPlate = raw.replace(/\s+/g, '').toUpperCase();
    const matchedFleet = fleets.find(
      f => (f.plateNumber || '').replace(/\s+/g, '').toUpperCase() === cleanPlate
    );
    if (matchedFleet?.initialCode) {
      return `${matchedFleet.plateNumber} (${matchedFleet.initialCode})`;
    }
    return raw;
  };

  // Helper untuk menentukan Nama Area Kirim pada Laporan Pengisian BBM
  const resolveFuelAreaKirim = (rep: DriverHelperReport): string => {
    const rawArea = (rep.areaName || '').trim();
    const cleanedArea = rawArea
      .replace(/\s*\(?SPBU\s*(Farly|Gajah\s*Mada|Lain\s*\(Urgent\))\)?/gi, '')
      .replace(/^Pengisian\s*BBM\s*(Solar)?\s*[-:•]?\s*/i, '')
      .trim();

    const isGenericSpbuOnly =
      !cleanedArea ||
      cleanedArea === '-' ||
      /^(spbu|farly|gajah\s*mada|spbu\s*lain.*|pengisian\s*bbm|isi\s*bbm|operasional\s*dc|rute\s*pengiriman)$/i.test(cleanedArea);

    if (!isGenericSpbuOnly) {
      return cleanedArea;
    }

    const rDate = rep.date || getLocalDateStr(rep.timestamp);
    const repPlateClean = (rep.plateNumber || '').replace(/\s+/g, '').toUpperCase();
    const repDriverClean = (rep.driverName || '').trim().toLowerCase();

    // 1. Cek dari jadwal pengiriman pada tanggal yang sama
    const sameDaySchedule = schedules.find(s => {
      const sDate = getLocalDateStr(s.departureDate);
      const sPlate = (s.fleet?.plateNumber || '').replace(/\s+/g, '').toUpperCase();
      const sDriver = (s.crew?.name || '').trim().toLowerCase();
      return sDate === rDate && ((repPlateClean && sPlate === repPlateClean) || (repDriverClean && sDriver === repDriverClean));
    });
    if (sameDaySchedule) {
      return (sameDaySchedule.areaName || sameDaySchedule.store?.storeName || 'Area Kirim Terjadwal').trim();
    }

    // 2. Cek dari laporan kiriman/absen kru pada hari yang sama
    const sameDayOtherReport = reports.find(other => {
      if (other.id === rep.id || other.category === 'isi_bbm') return false;
      const oDate = other.date || getLocalDateStr(other.timestamp);
      const oPlate = (other.plateNumber || '').replace(/\s+/g, '').toUpperCase();
      const oDriver = (other.driverName || '').trim().toLowerCase();
      const oArea = (other.areaName || '').trim();
      return (
        oDate === rDate &&
        oArea &&
        oArea !== '-' &&
        !/^(presensi|keamanan|operasional)/i.test(oArea) &&
        ((repPlateClean && oPlate === repPlateClean) || (repDriverClean && oDriver === repDriverClean))
      );
    });
    if (sameDayOtherReport?.areaName) {
      return sameDayOtherReport.areaName;
    }

    // 3. Cek dari jadwal pengiriman terbaru untuk armada/driver tersebut
    const anySchedule = schedules.find(s => {
      const sPlate = (s.fleet?.plateNumber || '').replace(/\s+/g, '').toUpperCase();
      const sDriver = (s.crew?.name || '').trim().toLowerCase();
      return (repPlateClean && sPlate === repPlateClean) || (repDriverClean && sDriver === repDriverClean);
    });
    if (anySchedule) {
      return (anySchedule.areaName || anySchedule.store?.storeName || 'Rute Pengiriman Aktif').trim();
    }

    return cleanedArea || 'Rute Pengiriman DC';
  };

  const resolveFuelLocation = (rep: DriverHelperReport): 'Farly' | 'Gajah Mada' | 'SPBU Lain (Urgent)' => {
    if (
      rep.fuelLocation === 'Farly' ||
      rep.fuelLocation === 'Gajah Mada' ||
      rep.fuelLocation === 'SPBU Lain (Urgent)'
    ) {
      return rep.fuelLocation;
    }
    const combined = `${rep.notes || ''} ${rep.areaName || ''}`.toLowerCase();
    if (combined.includes('urgent') || combined.includes('spbu lain') || Boolean(rep.fuelUrgentReason)) {
      return 'SPBU Lain (Urgent)';
    }
    if (combined.includes('gajah mada')) {
      return 'Gajah Mada';
    }
    return 'Farly';
  };

  // Sub-menu switcher: Laporan Kendala Lapangan | Laporan Absen Tim Kiriman | Laporan Check-In & Check-Out | Laporan Pengisian BBM (Solar) | Laporan Checklist Armada | Laporan GPS Form Kirim
  const [activeSubMenu, setActiveSubMenu] = useState<'operasional' | 'absen_tim_kiriman' | 'checkin_checkout' | 'pengisian_bbm' | 'checklist_armada' | 'peringatan_offline' | 'validasi_jadwal_portal' | 'validasi_rute_form' | 'retur_muat_salah'>('operasional');
  const [isLogisticsMenuOpen, setIsLogisticsMenuOpen] = useState(false);
  const logisticsMenuRef = useRef<HTMLDivElement | null>(null);
  const [gpsHistoryFilter, setGPSHistoryFilter] = useState<'all' | 'edited_multi' | 'initial_only'>('all');
  const [offlineSearchQuery, setOfflineSearchQuery] = useState<string>('');
  const [formKirimRecords, setFormKirimRecords] = useState<FormKirimRecord[]>(() => formKirimStore.getAll());
  const [checkinSearchQuery, setCheckinSearchQuery] = useState<string>('');
  const [checkinStatusFilter, setCheckinStatusFilter] = useState<'all' | 'belum_checkin' | 'sedang_bertugas' | 'selesai_shift'>('all');
  const [fuelSearchQuery, setFuelSearchQuery] = useState<string>('');
  const [fuelLocationFilter, setFuelLocationFilter] = useState<'all' | 'Farly' | 'Gajah Mada' | 'SPBU Lain (Urgent)'>('all');

  const [reports, setReports] = useState<DriverHelperReport[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<'all' | 'kendala_umum' | 'antri_customer'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'verified' | 'follow_up' | 'resolved'>('all');
  const [selectedPhotoModal, setSelectedPhotoModal] = useState<DriverHelperReport | null>(null);
  const [revealedPinIds, setRevealedPinIds] = useState<Record<string, boolean>>({});

  // Calendar Date Filter State: Fokus Pertanggal saat diklik
  const [dateFilterMode, setDateFilterMode] = useState<DateFilterMode>('single_date');
  const [selectedCalendarDate, setSelectedCalendarDate] = useState<string>(() => {
    return getLocalDateStr();
  });
  const [calendarMonth, setCalendarMonth] = useState<number>(() => new Date().getMonth());
  const [calendarYear, setCalendarYear] = useState<number>(() => new Date().getFullYear());

  const CALENDAR_MONTH_NAMES = [
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

  // Rentang Minggu Ini (Senin s/d Minggu kalender berjalan)
  const currentWeekRange = useMemo(() => {
    const today = new Date();
    const dayOfWeek = (today.getDay() + 6) % 7; // 0 = Senin, 6 = Minggu
    const monday = new Date(today);
    monday.setDate(today.getDate() - dayOfWeek);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);

    const startIso = getLocalDateStr(monday);
    const endIso = getLocalDateStr(sunday);
    const startStr = monday.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
    const endStr = sunday.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });

    return {
      startIso,
      endIso,
      label: `${startStr} - ${endStr}`
    };
  }, []);

  // Rentang Bulan Terpilih pada Kalender (Awal s/d Akhir bulan terpilih)
  const currentMonthRange = useMemo(() => {
    const firstDay = new Date(calendarYear, calendarMonth, 1);
    const lastDay = new Date(calendarYear, calendarMonth + 1, 0);

    const startIso = getLocalDateStr(firstDay);
    const endIso = getLocalDateStr(lastDay);
    const monthName = `${CALENDAR_MONTH_NAMES[calendarMonth]} ${calendarYear}`;

    return {
      startIso,
      endIso,
      monthName
    };
  }, [calendarMonth, calendarYear]);

  // SPV Solution Modal State
  const [solutionModalReport, setSolutionModalReport] = useState<DriverHelperReport | null>(null);
  const [solutionText, setSolutionText] = useState<string>('');
  const [solutionStatus, setSolutionStatus] = useState<'follow_up' | 'verified' | 'resolved'>('resolved');

  // Super Admin Delete Confirmation Modal State
  const [deleteConfirmTarget, setDeleteConfirmTarget] = useState<{
    id: string;
    shiftId?: string;
    driverName: string;
    plateNumber: string;
    areaName: string;
    date?: string;
    label: string;
    isShiftRecord?: boolean;
    formKirimGpsTarget?: {
      formKirimId: string;
      itemIds: string[];
    };
  } | null>(null);

  // Notifikasi Perubahan Jadwal (Hanya muncul di Laporan Kiriman Kru - diminimize secara default)
  const [isScheduleNotifExpanded, setIsScheduleNotifExpanded] = useState<boolean>(false);
  const [scheduleChangeNotifs, setScheduleChangeNotifs] = useState<
    Array<{
      id: string;
      title: string;
      message: string;
      trackingNumber: string;
      storeName: string;
      plateNumber?: string;
      timestamp: string;
    }>
  >([]);

  const loadReports = (incomingOrEvent?: any) => {
    const all = driverReportService.getReports();
    setReports(all);
    const incomingReport: DriverHelperReport | undefined =
      incomingOrEvent && typeof incomingOrEvent === 'object' && 'category' in incomingOrEvent
        ? (incomingOrEvent as DriverHelperReport)
        : undefined;
    if (incomingReport && incomingReport.category === 'kendala_jalan') {
      const repDate = incomingReport.date || (incomingReport.timestamp ? getLocalDateStr(new Date(incomingReport.timestamp)) : getLocalDateStr());
      if (repDate) {
        setSelectedCalendarDate(repDate);
        const dObj = new Date(repDate);
        if (!isNaN(dObj.getTime())) {
          setCalendarMonth(dObj.getMonth());
          setCalendarYear(dObj.getFullYear());
        }
      }
    }
  };

  useEffect(() => {
    loadReports();
    setFormKirimRecords([...formKirimStore.getAll()]);
    void formKirimStore.hydrateFromServer(true, true);
    void driverShiftService.syncFromServer().then(() => loadReports());
    driverReportService.syncWithServer(true).then(() => loadReports()).catch(() => {});

    const unsubFormKirim = formKirimStore.subscribe(() => {
      setFormKirimRecords([...formKirimStore.getAll()]);
    });

    const handleReportUpdate = (evt: Event) => {
      const customEvt = evt as CustomEvent<DriverHelperReport | undefined>;
      loadReports(customEvt?.detail);
    };

    const handleScheduleRealtime = (evt: Event) => {
      const customEvt = evt as CustomEvent<any>;
      if (customEvt?.detail && customEvt.detail.title) {
        setScheduleChangeNotifs(prev => [customEvt.detail, ...prev].slice(0, 15));
      }
    };

    const pollInterval = setInterval(() => {
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
      driverReportService.syncWithServer().catch(() => {});
      void driverShiftService.syncFromServer();
      void formKirimStore.hydrateFromServer(true);
    }, 20000);

    const handleScheduleAddedOrUpdated = () => {
      setStoreTick(t => t + 1);
      loadReports();
    };

    window.addEventListener('driver-report-updated', handleReportUpdate);
    window.addEventListener('driver-shift-updated', handleReportUpdate);
    window.addEventListener('akk-driver-schedule-realtime', handleScheduleRealtime);
    window.addEventListener('akk-new-schedule-added', handleScheduleAddedOrUpdated);
    let crewSyncTimer: number | null = null;
    const unsubCrew = listenCrewChanged(() => {
      if (crewSyncTimer) window.clearTimeout(crewSyncTimer);
      crewSyncTimer = window.setTimeout(() => {
        setStoreTick(t => t + 1);
        driverReportService.syncWithServer(true).then(() => loadReports()).catch(() => {});
        void driverShiftService.syncFromServer().then(() => loadReports());
        void formKirimStore.hydrateFromServer(true);
      }, 280);
    });
    return () => {
      clearInterval(pollInterval);
      if (crewSyncTimer) window.clearTimeout(crewSyncTimer);
      unsubFormKirim();
      unsubCrew();
      window.removeEventListener('driver-report-updated', handleReportUpdate);
      window.removeEventListener('driver-shift-updated', handleReportUpdate);
      window.removeEventListener('akk-driver-schedule-realtime', handleScheduleRealtime);
      window.removeEventListener('akk-new-schedule-added', handleScheduleAddedOrUpdated);
    };
  }, []);

  // Hanya laporan Kendala (kendala_jalan) agar tidak tercampur dengan absen kiriman, check-in/out, pengisian BBM, dll.
  const kendalaOnlyReports = useMemo(() => {
    return reports.filter(r => r.category === 'kendala_jalan');
  }, [reports]);

  // Jika tanggal terpilih tidak memiliki laporan kendala padahal ada laporan kendala terbaru, arahkan ke tanggal laporan kendala terbaru
  useEffect(() => {
    if (dateFilterMode === 'single_date' && kendalaOnlyReports.length > 0) {
      const hasOnSelected = kendalaOnlyReports.some(r => {
        const d = r.date || (r.timestamp ? getLocalDateStr(new Date(r.timestamp)) : '');
        return d === selectedCalendarDate;
      });
      if (!hasOnSelected) {
        const latestDate = kendalaOnlyReports[0].date || (kendalaOnlyReports[0].timestamp ? getLocalDateStr(new Date(kendalaOnlyReports[0].timestamp)) : '');
        if (latestDate) {
          setSelectedCalendarDate(latestDate);
        }
      }
    }
  }, [kendalaOnlyReports.length, dateFilterMode, selectedCalendarDate]);

  // Map of reports count & solution status per calendar date (Khusus Kendala)
  const reportsByDateMap = useMemo(() => {
    const map = new Map<
      string,
      {
        total: number;
        kendala: number;
        akhirKirimanCount: number;
        needsActionCount: number;
        sentToPortalCount: number;
        otherReportsCount: number;
        kendalaItems: string[];
        akhirItems: string[];
      }
    >();
    kendalaOnlyReports.forEach(r => {
      const d = r.date || (r.timestamp ? getLocalDateStr(new Date(r.timestamp)) : '');
      if (d) {
        const curr = map.get(d) || {
          total: 0,
          kendala: 0,
          akhirKirimanCount: 0,
          needsActionCount: 0,
          sentToPortalCount: 0,
          otherReportsCount: 0,
          kendalaItems: [],
          akhirItems: []
        };
        curr.total += 1;
        curr.kendala += 1;
        const hasSolution = Boolean(r.solution && r.solution.trim()) || r.status === 'verified' || r.status === 'resolved';
        const shortDriver = (r.driverName || 'Kru').split(' ')[0];
        const shortArea = r.areaName || 'Rute';
        const labelSummary = `${shortDriver} • ${shortArea}`;

        if (curr.kendalaItems.length < 2) {
          curr.kendalaItems.push(labelSummary);
        }
        if (hasSolution) {
          curr.sentToPortalCount += 1;
        } else {
          curr.needsActionCount += 1;
        }
        map.set(d, curr);
      }
    });
    return map;
  }, [kendalaOnlyReports]);

  // Daftar laporan siapa saja yang mengaktifkan Mode Offline
  const offlineModeReports = useMemo(() => {
    return reports.filter(r => r.category === 'mode_offline');
  }, [reports]);

  const activeOfflineCrewReports = useMemo(() => {
    return offlineModeReports.filter(r => r.offlineStatus === 'masih_offline');
  }, [offlineModeReports]);

  const handleForceOnlineCrew = (rep: DriverHelperReport) => {
    const spvName = currentUser.fullName
      ? `${currentUser.fullName} (${currentUser.role === 'super_admin' ? 'Super Admin' : 'SPV Logistik'})`
      : 'SPV Logistik DC PT AKK';
    driverReportService.markOfflineModeRestored({
      reportId: rep.id,
      driverId: rep.driverId,
      driverName: rep.driverName,
      restoredBy: spvName
    });
    loadReports();
    addNotification(
      'schedule',
      '✓ Kru Berhasil Di-Online-kan Kembali',
      `Perangkat ${rep.driverName} (${rep.plateNumber}) telah di-online-kan kembali dan status peringatan berubah hijau.`
    );
  };

  const handleSendOfflineWarningToPortal = (rep: DriverHelperReport) => {
    const spvName = currentUser.fullName
      ? `${currentUser.fullName} (${currentUser.role === 'super_admin' ? 'Super Admin' : 'SPV Logistik'})`
      : 'SPV Logistik DC PT AKK';
    const warningMsg = `PERINGATAN TIM PENGIRIMAN: Harap segera matikan Mode Offline dan onlinekan kembali perangkat Anda (${rep.plateNumber}) sekarang agar posisi GPS serta status kiriman area ${rep.areaName} terpantau real-time!`;
    driverReportService.updateReportSolution(rep.id, warningMsg, spvName, 'follow_up');
    loadReports();
    addNotification(
      'sla_warning',
      'Peringatan Segera Online Terkirim',
      `Peringatan wajib online telah dikirim langsung ke Portal Driver (${rep.driverName}).`
    );
  };

  // Statistik Cepat Berdasarkan Rentang Waktu
  const timeRangeStats = useMemo(() => {
    let weekTotal = 0;
    let weekKendala = 0;
    let monthTotal = 0;
    let monthKendala = 0;

    reports.forEach(r => {
      const d = r.date || (r.timestamp ? getLocalDateStr(new Date(r.timestamp)) : '');
      if (d) {
        if (d >= currentWeekRange.startIso && d <= currentWeekRange.endIso) {
          weekTotal++;
          if (r.category === 'kendala_jalan') weekKendala++;
        }
        if (d >= currentMonthRange.startIso && d <= currentMonthRange.endIso) {
          monthTotal++;
          if (r.category === 'kendala_jalan') monthKendala++;
        }
      }
    });

    return {
      weekTotal,
      weekKendala,
      monthTotal,
      monthKendala
    };
  }, [reports, currentWeekRange, currentMonthRange]);

  // 7-Column Monthly Calendar Grid (MINGGU s/d SABTU) seperti pada Jadwal & Penugasan
  const monthlyCalendarGrid = useMemo(() => {
    const todayIso = getLocalDateStr();
    const firstDayOfMonth = new Date(calendarYear, calendarMonth, 1);
    const startDayOfWeek = firstDayOfMonth.getDay(); // 0 = Minggu, 6 = Sabtu
    const daysInMonth = new Date(calendarYear, calendarMonth + 1, 0).getDate();

    type CalendarCell =
      | { type: 'padding'; key: string }
      | {
          type: 'day';
          key: string;
          dayNumber: number;
          iso: string;
          isToday: boolean;
          totalReports: number;
          kendalaCount: number;
          akhirKirimanCount: number;
          needsActionCount: number;
          sentToPortalCount: number;
          otherReportsCount: number;
          kendalaItems: string[];
          akhirItems: string[];
        };

    const cells: CalendarCell[] = [];

    for (let i = 0; i < startDayOfWeek; i++) {
      cells.push({ type: 'padding', key: `pad-start-${i}` });
    }

    for (let day = 1; day <= daysInMonth; day++) {
      const iso = `${calendarYear}-${String(calendarMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const stats = reportsByDateMap.get(iso) || {
        total: 0,
        kendala: 0,
        akhirKirimanCount: 0,
        needsActionCount: 0,
        sentToPortalCount: 0,
        otherReportsCount: 0,
        kendalaItems: [],
        akhirItems: []
      };
      cells.push({
        type: 'day',
        key: `day-${iso}`,
        dayNumber: day,
        iso,
        isToday: iso === todayIso,
        totalReports: stats.total,
        kendalaCount: stats.kendala,
        akhirKirimanCount: stats.akhirKirimanCount,
        needsActionCount: stats.needsActionCount,
        sentToPortalCount: stats.sentToPortalCount,
        otherReportsCount: stats.otherReportsCount,
        kendalaItems: stats.kendalaItems,
        akhirItems: stats.akhirItems
      });
    }

    const remainder = cells.length % 7;
    if (remainder !== 0) {
      const endPad = 7 - remainder;
      for (let i = 0; i < endPad; i++) {
        cells.push({ type: 'padding', key: `pad-end-${i}` });
      }
    }

    return {
      monthName: CALENDAR_MONTH_NAMES[calendarMonth] || 'Oktober',
      year: calendarYear,
      cells
    };
  }, [calendarMonth, calendarYear, reportsByDateMap]);

  // Filtered reports berdasarkan DateFilterMode (Khusus Kendala)
  const filteredReports = kendalaOnlyReports.filter((rep) => {
    const rDate = rep.date || (rep.timestamp ? getLocalDateStr(new Date(rep.timestamp)) : '');

    if (dateFilterMode === 'single_date') {
      if (selectedCalendarDate && rDate !== selectedCalendarDate) return false;
    } else if (dateFilterMode === 'this_week') {
      if (!rDate || rDate < currentWeekRange.startIso || rDate > currentWeekRange.endIso) return false;
    } else if (dateFilterMode === 'this_month') {
      if (!rDate || rDate < currentMonthRange.startIso || rDate > currentMonthRange.endIso) return false;
    }
    // if 'all', tidak menyaring berdasarkan tanggal

    if (categoryFilter === 'kendala_umum' && Boolean(rep.customerQueueStatus)) return false;
    if (categoryFilter === 'antri_customer' && !rep.customerQueueStatus) return false;
    if (statusFilter !== 'all' && rep.status !== statusFilter) return false;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchDriver = rep.driverName.toLowerCase().includes(q);
      const matchPlate = rep.plateNumber.toLowerCase().includes(q);
      const matchArea = rep.areaName.toLowerCase().includes(q);
      const matchNotes = rep.notes.toLowerCase().includes(q);
      const matchSolution = rep.solution ? rep.solution.toLowerCase().includes(q) : false;
      const matchHelper = rep.helperName ? rep.helperName.toLowerCase().includes(q) : false;
      return matchDriver || matchPlate || matchArea || matchNotes || matchSolution || matchHelper;
    }
    return true;
  });

  // KPI Statistics (Khusus Kendala)
  const totalCount = kendalaOnlyReports.length;
  const kendalaCount = kendalaOnlyReports.filter((r) => !r.customerQueueStatus).length;
  const akhirCount = kendalaOnlyReports.filter((r) => Boolean(r.customerQueueStatus)).length;
  const pendingCount = kendalaOnlyReports.filter((r) => r.status === 'pending').length;
  const absenTimKirimanCount = reports.filter(
    (r) => r.category === 'istirahat'
  ).length;

  const inScopeTotal = filteredReports.length;
  const inScopeKendala = filteredReports.filter((r) => !r.customerQueueStatus).length;
  const inScopeAkhir = filteredReports.filter((r) => Boolean(r.customerQueueStatus)).length;
  const inScopePending = filteredReports.filter((r) => r.status === 'pending').length;

  const handleVerify = (id: string) => {
    if (!isAuthorizedSpvOrAdmin) {
      addNotification('sla_warning', 'Akses Dibatasi', 'Hanya SPV Logistik dan Super Admin yang memiliki hak verifikasi status laporan.');
      return;
    }
    const verifierRole = currentUser.fullName ? `${currentUser.fullName} (SPV Logistik DC)` : 'SPV Logistik DC';
    driverReportService.updateReportStatus(id, 'verified', verifierRole);
    loadReports();
    addNotification('schedule', 'Laporan Diverifikasi', 'Laporan kiriman supir berhasil diverifikasi dan disetujui.');
  };

  const handleOpenSolutionModal = (report: DriverHelperReport) => {
    if (!isAuthorizedSpvOrAdmin) {
      addNotification('sla_warning', 'Akses Terbatas', 'Hanya SPV Logistik dan Super Admin yang berwenang memberikan arahan dan solusi resmi.');
      return;
    }
    setSolutionModalReport(report);
    setSolutionText(report.solution || '');
    setSolutionStatus(report.status === 'verified' ? 'verified' : 'resolved');
  };

  const handleSaveSolution = () => {
    if (!solutionModalReport) return;
    if (!solutionText.trim()) {
      addNotification('sla_warning', 'Keterangan Kosong', 'Harap isi keterangan solusi atau arahan penanganan untuk kru supir.');
      return;
    }

    const spvName = currentUser.fullName ? `${currentUser.fullName} (${currentUser.role === 'super_admin' ? 'Super Admin' : 'SPV Logistik'})` : 'SPV Logistik DC PT AKK';
    driverReportService.updateReportSolution(
      solutionModalReport.id,
      solutionText.trim(),
      spvName,
      solutionStatus
    );

    loadReports();
    addNotification(
      'schedule',
      'Solusi SPV Berhasil Dikirim',
      `Arahan telah tersambung langsung ke Portal Driver (${solutionModalReport.driverName}) dan siap dijalankan.`
    );
    setSolutionModalReport(null);
  };

  const handleConfirmDeleteReport = () => {
    if (!deleteConfirmTarget) return;
    if (!isSuperAdmin) {
      addNotification('sla_warning', 'Akses Dibatasi', 'Fitur hapus laporan hanya diizinkan untuk Super Admin.');
      setDeleteConfirmTarget(null);
      return;
    }

    if (deleteConfirmTarget.formKirimGpsTarget) {
      formKirimStore.clearCustomerGpsHistory(
        deleteConfirmTarget.formKirimGpsTarget.formKirimId,
        deleteConfirmTarget.formKirimGpsTarget.itemIds
      );
      setFormKirimRecords([...formKirimStore.getAll()]);
      addNotification(
        'schedule',
        'Riwayat GPS Form Kirim Dihapus',
        `Riwayat GPS ${deleteConfirmTarget.label} (${deleteConfirmTarget.driverName} • ${deleteConfirmTarget.plateNumber}) telah dihapus oleh Super Admin.`
      );
      setDeleteConfirmTarget(null);
      return;
    }

    driverReportService.deleteReport(deleteConfirmTarget.id);
    if (deleteConfirmTarget.shiftId) {
      driverReportService.deleteReport(deleteConfirmTarget.shiftId);
    }
    if (deleteConfirmTarget.isShiftRecord) {
      // Hapus juga semua laporan presensi_shift yang cocok dengan kru & tanggal yang sama agar tidak muncul kembali
      reports
        .filter(
          r =>
            r.category === 'presensi_shift' &&
            (r.id === deleteConfirmTarget.id ||
              (deleteConfirmTarget.shiftId && r.shiftId === deleteConfirmTarget.shiftId) ||
              (deleteConfirmTarget.driverName &&
                deleteConfirmTarget.date &&
                r.driverName.toLowerCase() === deleteConfirmTarget.driverName.toLowerCase() &&
                (r.date || getLocalDateStr(r.timestamp)) === deleteConfirmTarget.date))
        )
        .forEach(r => driverReportService.deleteReport(r.id));

      driverShiftService.deleteShift(
        deleteConfirmTarget.shiftId || deleteConfirmTarget.id,
        deleteConfirmTarget.driverName,
        deleteConfirmTarget.date
      );
    }

    loadReports();
    addNotification(
      'schedule',
      'Laporan Berhasil Dihapus',
      `Laporan ${deleteConfirmTarget.label} (${deleteConfirmTarget.driverName} • ${deleteConfirmTarget.plateNumber}) telah dihapus oleh Super Admin.`
    );
    setDeleteConfirmTarget(null);
  };

  const handleExportCsv = () => {
    if (filteredReports.length === 0) return;

    const headers = ['ID Laporan', 'Tanggal', 'Waktu', 'Kategori', 'Nama Supir', 'Helper', 'Plat Nomor', 'Area Kirim', 'Keterangan Kendala', 'Solusi SPV Logistik', 'Diberikan Oleh', 'Status', 'Verifikasi Oleh'];
    const rows = filteredReports.map((r) => [
      r.id,
      r.date || new Date(r.timestamp).toISOString().slice(0, 10),
      new Date(r.timestamp).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
      r.category === 'kendala_jalan'
        ? 'Kendala Jalan'
        : r.category === 'mode_offline'
        ? `Peringatan Mode Offline (${r.offlineStatus === 'sudah_online' ? 'Sudah Online' : 'Masih Offline'})`
        : r.category === 'akhir_kiriman'
        ? 'Akhir Kiriman'
        : r.category === 'presensi_shift'
        ? 'Presensi Shift (Check-In & Check-Out)'
        : r.category === 'pin_keamanan'
        ? 'PIN Keamanan (2x Verifikasi)'
        : r.category === 'istirahat'
        ? 'Absen Kiriman Pelanggan'
        : 'Update Lokasi',
      `"${r.driverName} (${r.userRole || 'Driver'})"`,
      `"${r.helperName || '-'}"`,
      r.plateNumber,
      `"${r.customerOutletName ? `${r.areaName} (Pelanggan: ${r.customerOutletName})` : r.areaName}"`,
      `"${r.notes.replace(/"/g, '""')}"`,
      `"${(r.solution || '-').replace(/"/g, '""')}"`,
      `"${r.solutionBy || '-'}"`,
      r.status === 'verified' ? 'Terverifikasi' : r.status === 'resolved' ? 'Selesai (Diberi Solusi)' : r.status === 'follow_up' ? 'Proses Tindak Lanjut' : 'Pending',
      `"${r.verifiedBy || '-'}"`
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Laporan_Kendala_Kiriman_Kru_${selectedCalendarDate || 'Semua'}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    addNotification('schedule', 'Export Selesai', 'Data laporan kiriman berhasil diekspor ke file CSV.');
  };

  // Daftar Laporan GPS Pengisian Form Kirim (GPS Awal, GPS Kedua, GPS Ketiga)
  const formKirimGpsReportsList = useMemo<FormKirimGpsReportRow[]>(() => {
    const rows: FormKirimGpsReportRow[] = [];

    formKirimRecords.forEach(fk => {
      const items = fk.invoiceItems || [];
      if (items.length === 0) return;

      // Kelompokkan per Kategori + Nama Pelanggan (sesuai pengisian Form Kirim di Portal Driver)
      const groupedMap = new Map<string, FormKirimInvoiceItem[]>();
      items.forEach(it => {
        const custKey = `${it.paymentCategory}::${String(it.namaPelanggan || '')
          .trim()
          .replace(/\s+/g, ' ')
          .toUpperCase()}`;
        const list = groupedMap.get(custKey);
        if (list) list.push(it);
        else groupedMap.set(custKey, [it]);
      });

      groupedMap.forEach((grpItems, custKey) => {
        const hasGpsHistory = grpItems.some(
          it => Array.isArray(it.gpsLockHistory) && it.gpsLockHistory.length > 0
        );
        const hasDriverSave = grpItems.some(
          it =>
            Boolean(it.metodeBayarAktual) ||
            Boolean(it.ttdDataUrl) ||
            Number(it.nominalDiterima) > 0 ||
            Number(it.driverEditCount) > 0 ||
            Boolean(String(it.customerNote || '').trim())
        );

        if (!hasGpsHistory && !hasDriverSave) return;

        const first = grpItems[0];
        const totalNilai = grpItems.reduce((s, it) => s + (Number(it.nilaiFaktur) || 0), 0);
        const totalTunai = grpItems
          .filter(it => it.metodeBayarAktual === 'Tunai' && Number(it.nominalDiterima) > 0)
          .reduce((s, it) => s + (Number(it.nominalDiterima) || 0), 0);
        const maxEdits = grpItems.reduce((mx, it) => Math.max(mx, Number(it.driverEditCount) || 0), 0);
        const savedMethod =
          totalTunai > 0 || grpItems.some(it => it.metodeBayarAktual === 'Tunai')
            ? 'Tunai'
            : grpItems.some(it => it.metodeBayarAktual === 'Transfer')
            ? 'Transfer'
            : grpItems.some(it => Boolean(it.ttdDataUrl) || it.metodeBayarAktual === 'TTD')
            ? 'TTD'
            : 'Keterangan';
        const customerNote = grpItems.find(it => String(it.customerNote || '').trim())?.customerNote || '';
        const lastUpdatedBy =
          grpItems.find(it => it.driverUpdatedBy)?.driverUpdatedBy || fk.driverName || 'Driver';
        const lastUpdatedAt =
          grpItems.find(it => it.driverUpdatedAt)?.driverUpdatedAt ||
          fk.driverUpdatedAt ||
          fk.createdAt;

        let entries: FormKirimGpsLockEntry[] =
          grpItems.find(it => Array.isArray(it.gpsLockHistory) && it.gpsLockHistory.length > 0)
            ?.gpsLockHistory || [];

        // Fallback jika item sudah disimpan sebelum riwayat GPS diaktifkan
        if (entries.length === 0 && hasDriverSave) {
          const baseLat = first.lockedGpsLat ?? -8.1906;
          const baseLng = first.lockedGpsLng ?? 114.3708;
          const count = Math.min(3, Math.max(1, maxEdits || 1));
          const synthesized: FormKirimGpsLockEntry[] = [];
          for (let step = 1; step <= count; step++) {
            const label = step === 1 ? 'GPS Awal' : step === 2 ? 'GPS Kedua' : 'GPS Ketiga';
            synthesized.push({
              attemptNumber: step,
              label,
              lat: Number((baseLat + (step - 1) * 0.00012).toFixed(6)),
              lng: Number((baseLng + (step - 1) * 0.00012).toFixed(6)),
              accuracy: first.lockedGpsAccuracy || 10,
              locationName: `${first.namaPelanggan} (${first.alamatPelanggan || fk.areaKirim || '-'})`,
              savedAt: lastUpdatedAt,
              savedTimeWib:
                new Date(lastUpdatedAt).toLocaleTimeString('id-ID', {
                  hour: '2-digit',
                  minute: '2-digit',
                  second: '2-digit'
                }) + ' WIB',
              savedBy: lastUpdatedBy,
              savedRole: 'Driver',
              paymentMethod: savedMethod,
              nominalDiterima: totalTunai,
              summary:
                savedMethod === 'Tunai'
                  ? `Simpan Tunai Rp ${totalTunai.toLocaleString('id-ID')}`
                  : `Simpan ${savedMethod}`
            });
          }
          entries = synthesized;
        }

        const sortedEntries = [...entries].sort((a, b) => a.attemptNumber - b.attemptNumber);
        const gpsAwal = sortedEntries.find(e => e.attemptNumber === 1) || sortedEntries[0] || null;
        const gpsKedua = sortedEntries.find(e => e.attemptNumber === 2) || null;
        const gpsKetiga = sortedEntries.find(e => e.attemptNumber === 3) || null;

        rows.push({
          rowId: `${fk.id}::${custKey}`,
          formKirimId: fk.id,
          noFormKirim: fk.noFormKirim,
          tanggalKirim: fk.tanggalKirim,
          areaKirim: fk.areaKirim || fk.storeName || '-',
          plateNumber: fk.plateNumber || '-',
          armadaInitial: fk.armadaInitial || '',
          driverName: fk.driverName || '-',
          helperName: fk.helperName || '',
          customerName: first.namaPelanggan,
          customerAddress: first.alamatPelanggan || '-',
          paymentCategory: first.paymentCategory,
          invoiceNumbers: grpItems.map(i => i.noFaktur),
          itemIds: grpItems.map(i => i.id),
          totalNilaiFaktur: totalNilai,
          savedMethod,
          nominalDiterima: totalTunai,
          customerNote,
          editCount: Math.max(maxEdits, sortedEntries.length),
          lastUpdatedBy,
          lastUpdatedAt,
          gpsAwal,
          gpsKedua,
          gpsKetiga,
          allGpsEntries: sortedEntries
        });
      });
    });

    return rows.sort((a, b) => String(b.lastUpdatedAt || '').localeCompare(String(a.lastUpdatedAt || '')));
  }, [formKirimRecords]);

  const filteredGpsFormKirimReports = useMemo(() => {
    return formKirimGpsReportsList.filter(row => {
      if (gpsHistoryFilter === 'edited_multi' && !row.gpsKedua && !row.gpsKetiga && row.editCount < 2) {
        return false;
      }
      if (gpsHistoryFilter === 'initial_only' && (row.gpsKedua || row.gpsKetiga || row.editCount >= 2)) {
        return false;
      }
      if (offlineSearchQuery.trim()) {
        const q = offlineSearchQuery.toLowerCase().trim();
        const matchDriver = row.driverName.toLowerCase().includes(q);
        const matchHelper = row.helperName.toLowerCase().includes(q);
        const matchPlate = row.plateNumber.toLowerCase().includes(q);
        const matchArea = row.areaKirim.toLowerCase().includes(q);
        const matchCustomer = row.customerName.toLowerCase().includes(q);
        const matchInvoice = row.invoiceNumbers.some(no => no.toLowerCase().includes(q));
        return matchDriver || matchHelper || matchPlate || matchArea || matchCustomer || matchInvoice;
      }
      return true;
    });
  }, [formKirimGpsReportsList, gpsHistoryFilter, offlineSearchQuery]);

  const editedMultiGpsCount = useMemo(
    () => formKirimGpsReportsList.filter(r => Boolean(r.gpsKedua || r.gpsKetiga || r.editCount >= 2)).length,
    [formKirimGpsReportsList]
  );

  const initialOnlyGpsCount = useMemo(
    () => formKirimGpsReportsList.filter(r => !r.gpsKedua && !r.gpsKetiga && r.editCount <= 1).length,
    [formKirimGpsReportsList]
  );

  // Data Laporan Check-In & Check-Out Terpadu + Ketepatan Waktu vs Target Jadwal (Terintegrasi dengan Modal Buat Kiriman)
  const checkinCheckoutSummary = useMemo(() => {
    const parseClockMinutes = (raw?: string): number | null => {
      if (!raw || raw === '-' || raw === 'Belum Check-Out' || raw === 'Belum Check-In') return null;
      const trimmed = String(raw).trim();
      // 1. Format HH:MM atau HH.MM langsung (tanpa T / timestamp ISO)
      if (!trimmed.includes('T')) {
        const clockMatch = trimmed.match(/^(\d{1,2})[:.](\d{2})(?:\s*WIB)?$/i) || trimmed.match(/(\d{1,2})[:.](\d{2})/);
        if (clockMatch) {
          const hh = parseInt(clockMatch[1], 10);
          const mm = parseInt(clockMatch[2], 10);
          if (hh >= 0 && hh <= 23 && mm >= 0 && mm <= 59) return hh * 60 + mm;
        }
      }
      // 2. Timestamp ISO (UTC Z atau offset +07:00) -> konversi akurat ke jam WIB (Asia/Jakarta)
      if (trimmed.includes('T') || /(?:Z|[+-]\d{2}:?\d{2})$/i.test(trimmed)) {
        const parsedDate = new Date(trimmed);
        if (!Number.isNaN(parsedDate.getTime())) {
          try {
            const wibStr = new Intl.DateTimeFormat('en-GB', {
              timeZone: 'Asia/Jakarta',
              hour: '2-digit',
              minute: '2-digit',
              hour12: false
            }).format(parsedDate);
            const [hhStr, mmStr] = wibStr.split(':');
            const hh = parseInt(hhStr, 10);
            const mm = parseInt(mmStr, 10);
            if (hh >= 0 && hh <= 23 && mm >= 0 && mm <= 59) return hh * 60 + mm;
          } catch {}
        }
        const isoMatch = trimmed.match(/T(\d{1,2}):(\d{2})/);
        if (isoMatch) {
          const hh = parseInt(isoMatch[1], 10);
          const mm = parseInt(isoMatch[2], 10);
          if (hh >= 0 && hh <= 23 && mm >= 0 && mm <= 59) return hh * 60 + mm;
        }
      }
      return null;
    };

    const formatMinutesHHMM = (mins: number): string => {
      const normalized = ((mins % 1440) + 1440) % 1440;
      const hh = Math.floor(normalized / 60);
      const mm = normalized % 60;
      return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
    };

    const formatDiffMinutes = (diffMins: number): string => {
      const sign = diffMins > 0 ? '+' : diffMins < 0 ? '-' : '';
      const abs = Math.abs(diffMins);
      if (abs >= 60) {
        const h = Math.floor(abs / 60);
        const m = abs % 60;
        return `${sign}${h}j ${m}m`;
      }
      return `${sign}${abs} mnt`;
    };

    const evalPunctuality = (
      actualStr: string | undefined,
      targetMinutes: number,
      isNightMode: boolean
    ): {
      status: 'tepat' | 'awal' | 'terlambat' | 'belum';
      label: string;
      diffMinutes: number | null;
    } => {
      const actualMin = parseClockMinutes(actualStr);
      if (actualMin === null) {
        return { status: 'belum', label: 'Belum Ada', diffMinutes: null };
      }
      let diff = actualMin - targetMinutes;
      if (isNightMode && targetMinutes >= 18 * 60 && actualMin < 6 * 60) {
        diff = actualMin + 1440 - targetMinutes;
      }
      if (diff === 0) {
        return { status: 'tepat', label: 'Tepat Waktu (0 mnt)', diffMinutes: 0 };
      }
      if (diff < 0) {
        return { status: 'awal', label: `Lebih Awal (${formatDiffMinutes(diff)})`, diffMinutes: diff };
      }
      return { status: 'terlambat', label: `Terlambat (${formatDiffMinutes(diff)})`, diffMinutes: diff };
    };

    const extractHelperFromNotes = (notes?: string): string => {
      if (!notes) return '';
      const match = notes.match(/Helper(?:\s*1)?:\s*([^|•\n]+?)(?:\s*\||$|\n)/i);
      if (match && match[1]) {
        const cleaned = match[1].trim();
        if (cleaned && cleaned !== '-') return cleaned;
      }
      return '';
    };

    const isPlaceholderPlate = (p?: string): boolean => {
      const t = (p || '').trim();
      return !t || t === '-' || /^FLT-\d+$/i.test(t) || t.toUpperCase().endsWith('AKK');
    };

    const isGenericArea = (a?: string): boolean => {
      const lower = (a || '').trim().toLowerCase();
      return !lower || lower === '-' || lower === 'operasional dc' || lower === 'dc banyuwangi' || lower === 'pool banyuwangi';
    };

    const resolveSchedulePlateClean = (s: typeof schedules[number]): string =>
      (s.fleet?.plateNumber || '').replace(/\s+/g, '').toUpperCase();

    const resolveScheduleDateIso = (s: typeof schedules[number]): string =>
      (s.deliveryDate || '').slice(0, 10) || getLocalDateStr(s.departureDate);

    const resolveCrewName = (c: any): string => (typeof c === 'string' ? c : c?.name || '');

    const shiftRecords = driverShiftService.getShifts();
    const reportShiftRecords = reports.filter(r => r.category === 'presensi_shift');
    const matchedScheduleIds = new Set<string>();

    type CheckinRow = {
      id: string;
      shiftId?: string;
      scheduleId?: string;
      trackingNumber?: string;
      isScheduledOnly?: boolean;
      date: string;
      driverName: string;
      helperName: string;
      userRole: string;
      plateNumber: string;
      areaName: string;
      checkinTime: string;
      checkoutTime: string;
      status: 'belum_checkin' | 'sedang_bertugas' | 'selesai_shift';
      notes: string;
      targetDepartureLabel: string;
      targetReturnLabel: string;
      checkinPunctuality: { status: 'tepat' | 'awal' | 'terlambat' | 'belum'; label: string; diffMinutes: number | null };
      checkoutPunctuality: { status: 'tepat' | 'awal' | 'terlambat' | 'belum'; label: string; diffMinutes: number | null };
    };

    const combinedMap = new Map<string, CheckinRow>();

    const buildRecord = (base: {
      id: string;
      shiftId?: string;
      scheduleId?: string;
      trackingNumber?: string;
      isScheduledOnly?: boolean;
      date: string;
      driverName: string;
      helperName?: string;
      userRole: string;
      plateNumber: string;
      areaName: string;
      checkinTime: string;
      checkoutTime: string;
      status: 'belum_checkin' | 'sedang_bertugas' | 'selesai_shift';
      notes: string;
    }): CheckinRow => {
      const cleanPlate = isPlaceholderPlate(base.plateNumber) ? '' : (base.plateNumber || '').replace(/\s+/g, '').toUpperCase();
      const lowerArea = isGenericArea(base.areaName) ? '' : (base.areaName || '').toLowerCase().trim();
      const lowerDriver = (base.driverName || '').toLowerCase().trim();

      // Match schedule dengan sistem skor agar akurat menghubungkan Jadwal Admin -> Check-In/Out
      let matchedSchedule: typeof schedules[number] | undefined;
      let bestScore = 0;
      for (const s of schedules) {
        if (String(s.status) === 'cancelled') continue;
        if (base.scheduleId && s.id === base.scheduleId) {
          matchedSchedule = s;
          bestScore = 999;
          break;
        }
        const sDate = resolveScheduleDateIso(s);
        if (sDate !== base.date) continue;
        const sPlate = resolveSchedulePlateClean(s);
        const sArea = (s.areaName || s.store?.storeName || '').toLowerCase().trim();
        const sDriver = (s.crew?.name || '').toLowerCase().trim();
        const sHelper = resolveCrewName(s.crewHelper).toLowerCase().trim();

        let score = 0;
        if (cleanPlate && sPlate && cleanPlate === sPlate) score += 50;
        if (lowerDriver && lowerDriver !== 'belum ditentukan' && (sDriver === lowerDriver || sHelper === lowerDriver)) score += 40;
        if (lowerArea && sArea && (sArea === lowerArea || lowerArea.includes(sArea) || sArea.includes(lowerArea))) score += 30;
        if (score > bestScore && score >= 40) {
          bestScore = score;
          matchedSchedule = s;
        } else if (score > bestScore && score >= 30 && !cleanPlate) {
          bestScore = score;
          matchedSchedule = s;
        }
      }

      if (matchedSchedule?.id && (!base.userRole?.toLowerCase().includes('helper') || !matchedSchedule.crew?.name)) {
        matchedScheduleIds.add(matchedSchedule.id);
      }

      const matchedShift = shiftRecords.find(s =>
        (base.shiftId && s.id === base.shiftId) ||
        (s.id === base.id) ||
        (s.date === base.date &&
          s.driverName.toLowerCase().trim() === lowerDriver &&
          (!cleanPlate || (s.plateNumber || '').replace(/\s+/g, '').toUpperCase() === cleanPlate))
      );

      // Tarik plat nomor dan area otomatis dari jadwal Admin bila di shift belum lengkap
      const resolvedPlate = !isPlaceholderPlate(base.plateNumber)
        ? base.plateNumber.trim()
        : matchedSchedule?.fleet?.plateNumber
        ? matchedSchedule.fleet.plateNumber.trim()
        : matchedSchedule?.armada && !isPlaceholderPlate(matchedSchedule.armada)
        ? matchedSchedule.armada.trim()
        : '-';

      const resolvedArea = !isGenericArea(base.areaName)
        ? base.areaName.trim()
        : (matchedSchedule?.areaName || matchedSchedule?.store?.storeName || base.areaName || 'Operasional DC').trim();

      const isHelperRow = String(base.userRole || '').toLowerCase().includes('helper');
      let helperName = isHelperRow ? '' : (base.helperName || '').trim();
      if (!isHelperRow && helperName && helperName.toLowerCase() === lowerDriver) {
        helperName = '';
      }
      if (!isHelperRow && !helperName && matchedShift) {
        const hParts = [matchedShift.helper1Name, matchedShift.helper2Name]
          .map(v => (v || '').trim())
          .filter(v => v && v !== '-' && v.toLowerCase() !== lowerDriver);
        if (hParts.length > 0) helperName = hParts.join(', ');
      }
      if (!isHelperRow && !helperName && matchedSchedule) {
        const schHelpers = [resolveCrewName(matchedSchedule.crewHelper), resolveCrewName(matchedSchedule.crewHelper2)]
          .map(v => v.trim())
          .filter(v => v && v !== '-' && v.toLowerCase() !== lowerDriver);
        if (schHelpers.length > 0) helperName = schHelpers.join(', ');
      }
      if (!isHelperRow && !helperName) {
        const extracted = extractHelperFromNotes(base.notes);
        if (extracted && extracted.trim().toLowerCase() !== lowerDriver) {
          helperName = extracted;
        }
      }

      // Target berangkat & pulang: prioritaskan departureTime & targetReturnTime eksplisit (24h WIB) dari Modal Buat Kiriman
      const sopTiming = getAreaScheduleTiming(
        resolvedArea,
        matchedSchedule?.store?.storeName,
        matchedSchedule?.store?.city
      );
      const explicitDepMin = matchedSchedule ? parseClockMinutes(matchedSchedule.departureTime) : null;
      const isoDepMin = matchedSchedule ? parseClockMinutes(matchedSchedule.departureDate) : null;
      const schedDepMin = explicitDepMin !== null ? explicitDepMin : isoDepMin;

      const explicitRetMin = matchedSchedule ? parseClockMinutes(matchedSchedule.targetReturnTime) : null;
      const isoRetMin = matchedSchedule ? parseClockMinutes(matchedSchedule.estimatedArrival) : null;
      const schedArrMin = explicitRetMin !== null ? explicitRetMin : isoRetMin;

      const targetDepMinutes =
        schedDepMin !== null
          ? schedDepMin
          : sopTiming.departureHour * 60 + sopTiming.departureMinute;
      const targetArrMinutes =
        schedArrMin !== null
          ? schedArrMin
          : sopTiming.returnHour * 60 + sopTiming.returnMinute;

      const targetDepartureLabel = `${formatMinutesHHMM(targetDepMinutes)} WIB`;
      const targetReturnLabel = `${formatMinutesHHMM(targetArrMinutes)} WIB`;

      return {
        ...base,
        scheduleId: base.scheduleId || matchedSchedule?.id,
        trackingNumber: base.trackingNumber || matchedSchedule?.trackingNumber,
        plateNumber: resolvedPlate,
        areaName: resolvedArea,
        helperName: helperName || '-',
        targetDepartureLabel,
        targetReturnLabel,
        checkinPunctuality: evalPunctuality(base.checkinTime, targetDepMinutes, sopTiming.isNightDeparture || targetDepMinutes >= 18 * 60),
        checkoutPunctuality: evalPunctuality(base.checkoutTime, targetArrMinutes, false)
      };
    };

    reportShiftRecords.forEach(r => {
      const key = r.shiftId || `${r.driverName.toLowerCase()}-${r.date || getLocalDateStr(r.timestamp)}`;
      combinedMap.set(
        key,
        buildRecord({
          id: r.id,
          shiftId: r.shiftId,
          date: r.date || getLocalDateStr(r.timestamp),
          driverName: r.driverName,
          helperName: r.helperName,
          userRole: r.userRole || 'Driver',
          plateNumber: r.plateNumber || '-',
          areaName: r.areaName || 'Operasional DC',
          checkinTime:
            r.checkinTimeFormatted ||
            new Date(r.timestamp).toLocaleTimeString('id-ID', {
              timeZone: 'Asia/Jakarta',
              hour: '2-digit',
              minute: '2-digit'
            }) + ' WIB',
          checkoutTime: r.checkoutTimeFormatted || '-',
          status: r.checkoutTimeFormatted ? 'selesai_shift' : 'sedang_bertugas',
          notes: r.notes
        })
      );
    });

    shiftRecords.forEach(s => {
      const key = s.id || `${s.driverName.toLowerCase()}-${s.date}`;
      const existing = combinedMap.get(key);
      const isExistingHelperRow = String(existing?.userRole || '').toLowerCase().includes('helper');
      const filteredHelperCombined = isExistingHelperRow
        ? ''
        : [s.helper1Name, s.helper2Name]
            .map(v => (v || '').trim())
            .filter(v => {
              if (!v || v === '-') return false;
              const ownerName = (existing?.driverName || s.driverName || '').trim().toLowerCase();
              return !ownerName || v.toLowerCase() !== ownerName;
            })
            .join(', ');
      if (existing) {
        let needsRebuild = false;
        if ((!existing.checkoutTime || existing.checkoutTime === '-') && s.checkoutTimeFormatted) {
          existing.checkoutTime = s.checkoutTimeFormatted;
          existing.status = 'selesai_shift';
          needsRebuild = true;
        }
        if (isExistingHelperRow) {
          if (existing.helperName && existing.helperName !== '-') {
            existing.helperName = '-';
            needsRebuild = true;
          }
        } else if ((!existing.helperName || existing.helperName === '-') && filteredHelperCombined) {
          existing.helperName = filteredHelperCombined;
          needsRebuild = true;
        }
        if (needsRebuild) {
          combinedMap.set(key, buildRecord(existing));
        }
      } else {
        const isHelperShift = s.checkinRole === 'helper';
        combinedMap.set(
          key,
          buildRecord({
            id: s.id,
            shiftId: s.id,
            date: s.date,
            driverName: s.driverName,
            helperName: isHelperShift ? '-' : filteredHelperCombined || '-',
            userRole: isHelperShift ? 'Helper' : 'Driver',
            plateNumber: s.plateNumber || '-',
            areaName: s.selectedArea || s.locationName || 'DC Banyuwangi',
            checkinTime: s.checkinTimeFormatted || '-',
            checkoutTime: s.checkoutTimeFormatted || '-',
            status: s.status === 'checked_out' || Boolean(s.checkoutTimeFormatted) ? 'selesai_shift' : 'sedang_bertugas',
            notes: s.notes || 'Presensi Shift Operasional'
          })
        );
      }
    });

    // Integrasi langsung Modal "Buat Kiriman" -> Laporan Check-In & Check-Out:
    // Jadwal aktif yang baru diterbitkan Admin otomatis tampil sebagai "Terjadwal / Belum Check-In"
    // sebelum kru melakukan Check-In, sehingga target jam & plat nomor langsung terbaca.
    schedules.forEach(sch => {
      if (String(sch.status) === 'cancelled' || matchedScheduleIds.has(sch.id)) return;
      const schDate = resolveScheduleDateIso(sch);
      if (!schDate) return;
      const schDriver = (sch.crew?.name || '').trim() || 'Belum Ditentukan';
      const schHelper = resolveCrewName(sch.crewHelper).trim();
      const schPlate = sch.fleet?.plateNumber || sch.armada || '-';
      const schArea = sch.areaName || sch.store?.storeName || 'Operasional DC';
      const key = `sched-${sch.id}`;
      if (combinedMap.has(key)) return;
      combinedMap.set(
        key,
        buildRecord({
          id: key,
          scheduleId: sch.id,
          trackingNumber: sch.trackingNumber,
          isScheduledOnly: true,
          date: schDate,
          driverName: schDriver,
          helperName: schHelper || '-',
          userRole: schDriver !== 'Belum Ditentukan' ? 'Driver' : 'Menunggu Kru',
          plateNumber: schPlate,
          areaName: schArea,
          checkinTime: '-',
          checkoutTime: '-',
          status: sch.status === 'delivered' ? 'selesai_shift' : 'belum_checkin',
          notes: sch.notes || `Jadwal terbit (${sch.trackingNumber})`
        })
      );
    });

    const allRows = Array.from(combinedMap.values()).sort((a, b) => {
      const dateCmp = b.date.localeCompare(a.date);
      if (dateCmp !== 0) return dateCmp;
      const order: Record<CheckinRow['status'], number> = {
        sedang_bertugas: 0,
        belum_checkin: 1,
        selesai_shift: 2
      };
      return order[a.status] - order[b.status];
    });

    const q = checkinSearchQuery.toLowerCase().trim();
    const filteredRows = allRows.filter(item => {
      if (checkinStatusFilter !== 'all' && item.status !== checkinStatusFilter) return false;
      if (!q) return true;
      return (
        item.driverName.toLowerCase().includes(q) ||
        item.helperName.toLowerCase().includes(q) ||
        formatPlateWithInitial(item.plateNumber).toLowerCase().includes(q) ||
        item.plateNumber.toLowerCase().includes(q) ||
        item.areaName.toLowerCase().includes(q) ||
        (item.trackingNumber || '').toLowerCase().includes(q) ||
        item.date.includes(q)
      );
    });

    return {
      allRows,
      filteredRows,
      counts: {
        total: allRows.length,
        belumCheckin: allRows.filter(i => i.status === 'belum_checkin').length,
        sedangBertugas: allRows.filter(i => i.status === 'sedang_bertugas').length,
        selesaiShift: allRows.filter(i => i.status === 'selesai_shift').length
      }
    };
  }, [reports, checkinSearchQuery, checkinStatusFilter, schedules, fleets]);

  const checkinCheckoutList = checkinCheckoutSummary.filteredRows;

  // Data Laporan Pengisian BBM (Solar)
  const fuelReportsList = useMemo(() => {
    const raw = reports.filter(r =>
      r.category === 'isi_bbm' ||
      r.notes.toLowerCase().includes('isi bbm') ||
      r.notes.toLowerCase().includes('pengisian bbm')
    );
    return raw.filter(r => {
      const resolvedLoc = resolveFuelLocation(r);
      if (fuelLocationFilter !== 'all' && resolvedLoc !== fuelLocationFilter) return false;
      if (fuelSearchQuery.trim()) {
        const q = fuelSearchQuery.toLowerCase().trim();
        const areaKirim = resolveFuelAreaKirim(r).toLowerCase();
        const plateWithInit = formatPlateWithInitial(r.plateNumber).toLowerCase();
        return (
          r.driverName.toLowerCase().includes(q) ||
          plateWithInit.includes(q) ||
          areaKirim.includes(q) ||
          resolvedLoc.toLowerCase().includes(q) ||
          (r.fuelUrgentReason || '').toLowerCase().includes(q) ||
          r.notes.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [reports, fuelLocationFilter, fuelSearchQuery, schedules, fleets]);

  const totalFuelReportsCount = useMemo(() => {
    return reports.filter(r =>
      r.category === 'isi_bbm' ||
      r.notes.toLowerCase().includes('isi bbm') ||
      r.notes.toLowerCase().includes('pengisian bbm')
    ).length;
  }, [reports]);

  useEffect(() => {
    if (!isLogisticsMenuOpen) return;
    const handleOutside = (e: MouseEvent) => {
      if (logisticsMenuRef.current && !logisticsMenuRef.current.contains(e.target as Node)) {
        setIsLogisticsMenuOpen(false);
      }
    };
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsLogisticsMenuOpen(false);
    };
    document.addEventListener('mousedown', handleOutside);
    document.addEventListener('keydown', handleEsc);
    return () => {
      document.removeEventListener('mousedown', handleOutside);
      document.removeEventListener('keydown', handleEsc);
    };
  }, [isLogisticsMenuOpen]);

  const returMuatCount = useMemo(
    () =>
      reports.filter(
        r =>
          r.category === 'retur' ||
          r.category === 'kurang_muat' ||
          r.category === 'lebih_muat' ||
          r.category === 'salah_muat'
      ).length,
    [reports]
  );

  const logisticsMenuItems: Array<{
    id: typeof activeSubMenu;
    label: string;
    count?: number;
    icon: React.ReactNode;
  }> = [
    { id: 'operasional', label: 'Kendala Lapangan', count: totalCount, icon: <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0" /> },
    { id: 'absen_tim_kiriman', label: 'Absen Tim', count: absenTimKirimanCount, icon: <UserCheck className="w-4 h-4 text-blue-600 shrink-0" /> },
    { id: 'checkin_checkout', label: 'Check-In & Out', count: checkinCheckoutList.length, icon: <Clock className="w-4 h-4 text-sky-600 shrink-0" /> },
    { id: 'pengisian_bbm', label: 'Pengisian BBM', count: totalFuelReportsCount, icon: <Fuel className="w-4 h-4 text-amber-600 shrink-0" /> },
    { id: 'checklist_armada', label: 'Checklist Armada', icon: <ShieldCheck className="w-4 h-4 text-green-600 shrink-0" /> },
    { id: 'peringatan_offline', label: 'GPS Form Kirim', count: formKirimGpsReportsList.length, icon: <Navigation className="w-4 h-4 text-indigo-600 shrink-0" /> },
    { id: 'validasi_jadwal_portal', label: 'Validasi Jadwal', icon: <FileCheck2 className="w-4 h-4 text-indigo-600 shrink-0" /> },
    { id: 'validasi_rute_form', label: 'Validasi Rute & Form', icon: <ShieldCheck className="w-4 h-4 text-blue-600 shrink-0" /> },
    { id: 'retur_muat_salah', label: 'Retur & Muat', count: returMuatCount, icon: <ShieldCheck className="w-4 h-4 text-rose-500 shrink-0" /> }
  ];

  const activeLogisticsMenu = logisticsMenuItems.find(m => m.id === activeSubMenu) || logisticsMenuItems[0];

  return (
    <div className="akk-flat-reports w-full max-w-full bg-slate-50 dark:bg-[#0F172A] px-3 sm:px-6 py-5 space-y-5 animate-in fade-in duration-200">
      {/* 1. Header Utama & Logo Minimalis */}
      <div className="bg-white dark:bg-[#162234] border border-slate-200 dark:border-[#24344D] rounded-xl px-5 py-3.5 shadow-sm flex items-center justify-between gap-4 relative z-30">
        <div className="flex items-center gap-3 min-w-0">
          <AkkLogo size="md" showSubtitle subtitle="AKK Pengiriman · Logistik DC" />
        </div>

        <div className="relative shrink-0" ref={logisticsMenuRef}>
          <button
            type="button"
            onClick={() => setIsLogisticsMenuOpen(prev => !prev)}
            aria-expanded={isLogisticsMenuOpen}
            className="inline-flex items-center gap-2.5 px-4 py-2.5 rounded-xl bg-white dark:bg-[#162234] hover:bg-slate-50 dark:hover:bg-slate-800 border border-slate-200 dark:border-[#24344D] text-xs sm:text-sm font-semibold text-slate-800 dark:text-slate-100 transition-colors cursor-pointer whitespace-nowrap"
          >
            {activeLogisticsMenu.icon}
            <span>Menu Logistik</span>
            <span className="hidden sm:inline text-xs font-medium text-slate-400">·</span>
            <span className="hidden sm:inline text-xs font-medium text-blue-600 dark:text-blue-400">
              {activeLogisticsMenu.label}
            </span>
            <ChevronDown
              className={`w-4 h-4 text-slate-400 transition-transform duration-150 ${isLogisticsMenuOpen ? 'rotate-180 text-blue-600' : ''}`}
            />
          </button>

          {isLogisticsMenuOpen && (
            <div className="absolute right-0 mt-2 w-72 rounded-xl bg-white dark:bg-[#162234] border border-slate-200 dark:border-[#24344D] shadow-lg p-1.5 z-50">
              <div className="px-3 py-2 text-[11px] font-semibold text-slate-400 dark:text-slate-500 border-b border-slate-100 dark:border-slate-800 mb-1">
                Pilih Modul Laporan Logistik
              </div>
              <div className="space-y-0.5">
                {logisticsMenuItems.map(item => {
                  const isActive = item.id === activeSubMenu;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => {
                        setActiveSubMenu(item.id);
                        setIsLogisticsMenuOpen(false);
                      }}
                      className={`w-full flex items-center justify-between gap-2.5 px-3 py-2 rounded-lg text-left text-xs font-semibold transition-colors cursor-pointer ${
                        isActive
                          ? 'bg-blue-50 dark:bg-blue-500/15 text-blue-700 dark:text-blue-300'
                          : 'text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/70'
                      }`}
                    >
                      <span className="flex items-center gap-2.5 min-w-0">
                        {item.icon}
                        <span className="truncate">{item.label}</span>
                      </span>
                      {typeof item.count === 'number' && (
                        <span
                          className={`text-[11px] px-2 py-0.5 rounded-md font-mono tabular-nums ${
                            isActive
                              ? 'bg-blue-100 dark:bg-blue-500/30 text-blue-700 dark:text-blue-200'
                              : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                          }`}
                        >
                          {item.count}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* RENDER VIEW BERDASARKAN SUB-MENU AKTIF */}
      {activeSubMenu === 'absen_tim_kiriman' ? (
        <CrewAttendanceReportView onBackToOperationalReports={() => setActiveSubMenu('operasional')} />
      ) : activeSubMenu === 'checklist_armada' ? (
        <FleetChecklistReportView onBackToOperationalReports={() => setActiveSubMenu('operasional')} />
      ) : activeSubMenu === 'checkin_checkout' ? (
        /* SUB-MENU: LAPORAN CHECK-IN & CHECK-OUT KRU PENGIRIMAN (FLAT CLEAN DESIGN + TYPOGRAPHY BESAR) */
        <div className="space-y-5 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 sm:p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-start sm:items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-blue-50 dark:bg-blue-500/15 border border-blue-200 dark:border-blue-500/30 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
                <Clock className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center gap-2.5 flex-wrap">
                  <h2 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
                    Laporan Check-In &amp; Check-Out Kru Pengiriman
                  </h2>
                  <span className="px-2.5 py-0.5 rounded-md text-xs font-semibold bg-blue-50 dark:bg-blue-500/20 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-500/30">
                    Terintegrasi Jadwal Admin
                  </span>
                </div>
                <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                  Target jam berangkat, target pulang, nomor kendaraan, dan area otomatis mengikuti jadwal terbit dari Admin &amp; presensi kru (WIB).
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2.5 shrink-0">
              <button
                type="button"
                onClick={() => {
                  void driverShiftService.syncFromServer().then(() => loadReports());
                  setStoreTick(t => t + 1);
                }}
                className="px-4 py-2.5 rounded-xl bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-sm font-semibold flex items-center gap-2 border border-slate-200 dark:border-slate-700 cursor-pointer transition"
              >
                <RefreshCw className="w-4 h-4" />
                <span>Segarkan</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  if (checkinCheckoutList.length === 0) return;
                  const headers = [
                    'Tanggal',
                    'Nama Driver / Kru',
                    'Peran',
                    'Nama Helper',
                    'Nomor Kendaraan',
                    'Area / Lokasi',
                    'Target Berangkat (WIB)',
                    'Target Pulang (WIB)',
                    'Waktu Check-In',
                    'Ketepatan & Selisih Check-In',
                    'Waktu Check-Out',
                    'Ketepatan & Selisih Check-Out',
                    'Status Shift'
                  ];
                  const rows = checkinCheckoutList.map(item => [
                    item.date,
                    `"${item.driverName}"`,
                    item.userRole,
                    `"${item.helperName}"`,
                    formatPlateWithInitial(item.plateNumber),
                    `"${item.areaName}"`,
                    item.targetDepartureLabel,
                    item.targetReturnLabel,
                    item.checkinTime,
                    `"${item.checkinPunctuality.label}"`,
                    item.checkoutTime,
                    `"${item.checkoutPunctuality.label}"`,
                    item.status === 'selesai_shift'
                      ? 'Selesai Shift'
                      : item.status === 'sedang_bertugas'
                      ? 'Sedang Bertugas'
                      : 'Terjadwal / Belum Check-In'
                  ]);
                  const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
                  const link = document.createElement('a');
                  link.setAttribute('href', encodeURI(csvContent));
                  link.setAttribute('download', `Laporan_CheckIn_CheckOut_Kru_${getLocalDateStr()}.csv`);
                  document.body.appendChild(link);
                  link.click();
                  document.body.removeChild(link);
                }}
                className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold flex items-center gap-2 cursor-pointer transition"
              >
                <FileSpreadsheet className="w-4 h-4" />
                <span>Ekspor Excel</span>
              </button>
            </div>
          </div>

          {/* 4 Summary KPI Cards (Flat Clean Design + Clickable Filter) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <button
              type="button"
              onClick={() => setCheckinStatusFilter('all')}
              className={`bg-white dark:bg-slate-900 rounded-xl p-5 border text-left flex items-center justify-between transition cursor-pointer ${
                checkinStatusFilter === 'all'
                  ? 'border-blue-600 ring-1 ring-blue-600/20'
                  : 'border-slate-200 dark:border-slate-800 hover:border-slate-300'
              }`}
            >
              <div>
                <span className="text-sm font-semibold text-slate-600 dark:text-slate-400 block">
                  Total Jadwal &amp; Shift
                </span>
                <div className="text-3xl font-bold text-slate-900 dark:text-white font-mono tabular-nums mt-1.5">
                  {checkinCheckoutSummary.counts.total}
                </div>
                <span className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 block">
                  Seluruh presensi &amp; jadwal terbit
                </span>
              </div>
              <div className="w-11 h-11 rounded-xl bg-blue-50 dark:bg-blue-500/15 border border-blue-200 dark:border-blue-500/30 flex items-center justify-center text-blue-600 dark:text-blue-400 shrink-0">
                <Clock className="w-5 h-5" />
              </div>
            </button>

            <button
              type="button"
              onClick={() => setCheckinStatusFilter(checkinStatusFilter === 'belum_checkin' ? 'all' : 'belum_checkin')}
              className={`bg-white dark:bg-slate-900 rounded-xl p-5 border text-left flex items-center justify-between transition cursor-pointer ${
                checkinStatusFilter === 'belum_checkin'
                  ? 'border-blue-600 ring-1 ring-blue-600/20'
                  : 'border-slate-200 dark:border-slate-800 hover:border-slate-300'
              }`}
            >
              <div>
                <span className="text-sm font-semibold text-slate-600 dark:text-slate-400 block">
                  Terjadwal / Belum Check-In
                </span>
                <div className="text-3xl font-bold text-blue-600 dark:text-blue-400 font-mono tabular-nums mt-1.5">
                  {checkinCheckoutSummary.counts.belumCheckin}
                </div>
                <span className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 block">
                  Jadwal terbit menunggu absen kru
                </span>
              </div>
              <div className="w-11 h-11 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-blue-600 dark:text-blue-400 shrink-0">
                <Calendar className="w-5 h-5" />
              </div>
            </button>

            <button
              type="button"
              onClick={() => setCheckinStatusFilter(checkinStatusFilter === 'sedang_bertugas' ? 'all' : 'sedang_bertugas')}
              className={`bg-white dark:bg-slate-900 rounded-xl p-5 border text-left flex items-center justify-between transition cursor-pointer ${
                checkinStatusFilter === 'sedang_bertugas'
                  ? 'border-amber-500 ring-1 ring-amber-500/20'
                  : 'border-slate-200 dark:border-slate-800 hover:border-slate-300'
              }`}
            >
              <div>
                <span className="text-sm font-semibold text-amber-700 dark:text-amber-400 block">
                  Sedang Bertugas
                </span>
                <div className="text-3xl font-bold text-amber-600 dark:text-amber-400 font-mono tabular-nums mt-1.5">
                  {checkinCheckoutSummary.counts.sedangBertugas}
                </div>
                <span className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 block">
                  Sudah Check-In, belum Check-Out
                </span>
              </div>
              <div className="w-11 h-11 rounded-xl bg-amber-50 dark:bg-amber-500/15 border border-amber-200 dark:border-amber-500/30 flex items-center justify-center text-amber-600 dark:text-amber-400 shrink-0">
                <LogIn className="w-5 h-5" />
              </div>
            </button>

            <button
              type="button"
              onClick={() => setCheckinStatusFilter(checkinStatusFilter === 'selesai_shift' ? 'all' : 'selesai_shift')}
              className={`bg-white dark:bg-slate-900 rounded-xl p-5 border text-left flex items-center justify-between transition cursor-pointer ${
                checkinStatusFilter === 'selesai_shift'
                  ? 'border-emerald-600 ring-1 ring-emerald-600/20'
                  : 'border-slate-200 dark:border-slate-800 hover:border-slate-300'
              }`}
            >
              <div>
                <span className="text-sm font-semibold text-emerald-700 dark:text-emerald-400 block">
                  Selesai Shift
                </span>
                <div className="text-3xl font-bold text-emerald-600 dark:text-emerald-400 font-mono tabular-nums mt-1.5">
                  {checkinCheckoutSummary.counts.selesaiShift}
                </div>
                <span className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 block">
                  Check-In &amp; Check-Out lengkap
                </span>
              </div>
              <div className="w-11 h-11 rounded-xl bg-emerald-50 dark:bg-emerald-500/15 border border-emerald-200 dark:border-emerald-500/30 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shrink-0">
                <LogOut className="w-5 h-5" />
              </div>
            </button>
          </div>

          {/* Search & Status Filter Bar */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={checkinSearchQuery}
                onChange={(e) => setCheckinSearchQuery(e.target.value)}
                placeholder="Cari nama driver/helper, nomor kendaraan, area tujuan, atau tanggal (YYYY-MM-DD)..."
                className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-blue-600"
              />
            </div>
            <select
              value={checkinStatusFilter}
              onChange={(e) => setCheckinStatusFilter(e.target.value as typeof checkinStatusFilter)}
              aria-label="Filter status shift"
              className="px-3.5 py-2.5 rounded-xl bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-sm font-semibold text-slate-800 dark:text-slate-200 focus:outline-none focus:border-blue-600 cursor-pointer"
            >
              <option value="all">Semua Status ({checkinCheckoutSummary.counts.total})</option>
              <option value="belum_checkin">Terjadwal / Belum Check-In ({checkinCheckoutSummary.counts.belumCheckin})</option>
              <option value="sedang_bertugas">Sedang Bertugas ({checkinCheckoutSummary.counts.sedangBertugas})</option>
              <option value="selesai_shift">Selesai Shift ({checkinCheckoutSummary.counts.selesaiShift})</option>
            </select>
          </div>

          {/* Table */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400">
                    <th className="py-3.5 px-4 w-12 text-center">#</th>
                    <th className="py-3.5 px-4">Tanggal</th>
                    <th className="py-3.5 px-4">Nama Kru (Driver &amp; Helper)</th>
                    <th className="py-3.5 px-4">Nomor Kendaraan</th>
                    <th className="py-3.5 px-4">Area / Lokasi</th>
                    <th className="py-3.5 px-4 text-center">Target Berangkat &amp; Pulang</th>
                    <th className="py-3.5 px-4 text-center">Waktu Check-In</th>
                    <th className="py-3.5 px-4 text-center">Waktu Check-Out</th>
                    <th className="py-3.5 px-4 text-center">Ketepatan Waktu &amp; Selisih</th>
                    <th className="py-3.5 px-4 text-center">Status Shift</th>
                    {isSuperAdmin && <th className="py-3.5 px-4 text-center">Tindakan</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                  {checkinCheckoutList.length === 0 ? (
                    <tr>
                      <td colSpan={isSuperAdmin ? 11 : 10} className="py-12 text-center text-sm text-slate-500">
                        Belum ada data laporan Check-In &amp; Check-Out kru pengiriman.
                      </td>
                    </tr>
                  ) : (
                    checkinCheckoutList.map((item, idx) => (
                      <tr key={item.id || idx} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition">
                        <td className="py-3.5 px-4 text-center font-mono text-slate-500 font-bold tabular-nums">{idx + 1}</td>
                        <td className="py-3.5 px-4 font-mono font-bold text-slate-900 dark:text-white whitespace-nowrap tabular-nums">
                          <div>{item.date}</div>
                          {item.trackingNumber && (
                            <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400 mt-0.5">
                              {item.trackingNumber}
                            </div>
                          )}
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-[15px] font-bold text-slate-900 dark:text-white">
                              {item.driverName}
                            </span>
                            <span className="px-2 py-0.5 rounded-md bg-blue-50 dark:bg-blue-500/15 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-500/30 text-xs font-semibold">
                              {item.userRole}
                            </span>
                          </div>
                          {item.helperName &&
                            item.helperName !== '-' &&
                            !String(item.userRole || '').toLowerCase().includes('helper') &&
                            item.helperName.trim().toLowerCase() !== (item.driverName || '').trim().toLowerCase() && (
                              <div className="text-[13px] text-amber-700 dark:text-amber-300 mt-1 font-semibold">
                                Helper: {item.helperName}
                              </div>
                            )}
                        </td>
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <span className="inline-flex items-center px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-mono text-sm font-bold text-slate-900 dark:text-slate-100">
                            {formatPlateWithInitial(item.plateNumber)}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-sm font-semibold text-slate-800 dark:text-slate-200">
                          {item.areaName}
                        </td>
                        <td className="py-3.5 px-4 text-center whitespace-nowrap">
                          <div className="text-[13px] font-mono text-slate-700 dark:text-slate-200 tabular-nums">
                            <span className="text-slate-500 font-sans font-medium">Berangkat:</span>{' '}
                            <strong className="text-emerald-700 dark:text-emerald-400">{item.targetDepartureLabel}</strong>
                          </div>
                          <div className="text-[13px] font-mono text-slate-700 dark:text-slate-200 mt-1 tabular-nums">
                            <span className="text-slate-500 font-sans font-medium">Pulang:</span>{' '}
                            <strong className="text-blue-700 dark:text-blue-400">{item.targetReturnLabel}</strong>
                          </div>
                        </td>
                        <td className="py-3.5 px-4 text-center whitespace-nowrap">
                          {item.checkinTime && item.checkinTime !== '-' ? (
                            <span className="inline-flex items-center px-3 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-500/30 font-mono font-bold text-sm tabular-nums">
                              {item.checkinTime}
                            </span>
                          ) : (
                            <span className="text-slate-400 italic text-xs">Belum Check-In</span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-center whitespace-nowrap">
                          {item.checkoutTime && item.checkoutTime !== '-' ? (
                            <span className="inline-flex items-center px-3 py-1 rounded-lg bg-blue-50 dark:bg-blue-500/15 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-500/30 font-mono font-bold text-sm tabular-nums">
                              {item.checkoutTime}
                            </span>
                          ) : (
                            <span className="text-slate-400 italic text-xs">Belum Check-Out</span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-center whitespace-nowrap">
                          <div className="flex flex-col items-center gap-1.5">
                            <span
                              className={`inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-bold border ${
                                item.checkinPunctuality.status === 'terlambat'
                                  ? 'bg-rose-50 dark:bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-500/30'
                                  : item.checkinPunctuality.status === 'tepat' || item.checkinPunctuality.status === 'awal'
                                  ? 'bg-emerald-50 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-500/30'
                                  : 'bg-slate-100 dark:bg-slate-800 text-slate-500 border-slate-200 dark:border-slate-700'
                              }`}
                            >
                              In: {item.checkinPunctuality.label}
                            </span>
                            <span
                              className={`inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-bold border ${
                                item.checkoutPunctuality.status === 'terlambat'
                                  ? 'bg-amber-50 dark:bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-500/30'
                                  : item.checkoutPunctuality.status === 'tepat' || item.checkoutPunctuality.status === 'awal'
                                  ? 'bg-blue-50 dark:bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-500/30'
                                  : 'bg-slate-100 dark:bg-slate-800 text-slate-500 border-slate-200 dark:border-slate-700'
                              }`}
                            >
                              Out: {item.checkoutPunctuality.label}
                            </span>
                          </div>
                        </td>
                        <td className="py-3.5 px-4 text-center whitespace-nowrap">
                          {item.status === 'selesai_shift' ? (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-[13px] font-bold bg-emerald-50 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-500/30">
                              <CheckCircle2 className="w-3.5 h-3.5" /> Selesai Shift
                            </span>
                          ) : item.status === 'sedang_bertugas' ? (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-[13px] font-bold bg-amber-50 dark:bg-amber-500/20 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-500/30">
                              <Clock className="w-3.5 h-3.5" /> Sedang Bertugas
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-[13px] font-bold bg-blue-50 dark:bg-blue-500/20 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-500/30">
                              <Calendar className="w-3.5 h-3.5" /> Terjadwal / Belum Check-In
                            </span>
                          )}
                        </td>
                        {isSuperAdmin && (
                          <td className="py-3.5 px-4 text-center whitespace-nowrap">
                            {item.isScheduledOnly ? (
                              <span className="inline-flex items-center px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700 text-xs font-semibold">
                                Dari Jadwal
                              </span>
                            ) : (
                              <button
                                type="button"
                                onClick={() =>
                                  setDeleteConfirmTarget({
                                    id: item.id,
                                    shiftId: item.shiftId,
                                    driverName: item.driverName,
                                    plateNumber: formatPlateWithInitial(item.plateNumber),
                                    areaName: item.areaName,
                                    date: item.date,
                                    label: 'Presensi Check-In / Check-Out',
                                    isShiftRecord: true
                                  })
                                }
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-50 hover:bg-rose-600 text-rose-700 dark:text-rose-400 hover:text-white border border-rose-200 dark:border-rose-500/35 hover:border-rose-600 text-xs font-bold transition cursor-pointer"
                                title="Hapus Data Check-In/Out (Khusus Super Admin)"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                                <span>Hapus</span>
                              </button>
                            )}
                          </td>
                        )}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : activeSubMenu === 'pengisian_bbm' ? (
        /* ⛽ SUB-MENU: LAPORAN PENGISIAN BBM (SOLAR) */
        <div className="space-y-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-5 py-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div>
              <h2 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
                Laporan Pengisian BBM (Solar) Armada
              </h2>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                Dokumentasi pengisian Solar armada di SPBU Farly, Gajah Mada, dan SPBU lainnya.
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={loadReports}
                className="h-9 px-3.5 rounded-lg bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs sm:text-sm font-semibold flex items-center gap-1.5 border border-slate-200 dark:border-slate-700 cursor-pointer transition"
              >
                <RefreshCw className="w-4 h-4 text-slate-500" />
                <span>Segarkan</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  if (fuelReportsList.length === 0) return;
                  const headers = ['Tanggal', 'Waktu', 'Nama Driver', 'Nomor Kendaraan', 'Area Kirim', 'Lokasi SPBU', 'Alasan Urgent', 'Jumlah Foto', 'Status'];
                  const rows = fuelReportsList.map(r => {
                    const loc = resolveFuelLocation(r);
                    const areaKirim = resolveFuelAreaKirim(r);
                    const photoCnt = r.photoUrls?.length || (r.photoUrl ? 1 : 0);
                    return [
                      r.date || getLocalDateStr(r.timestamp),
                      new Date(r.timestamp).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
                      `"${r.driverName}"`,
                      `"${formatPlateWithInitial(r.plateNumber)}"`,
                      `"${areaKirim}"`,
                      `"${loc === 'SPBU Lain (Urgent)' ? loc : `SPBU ${loc}`}"`,
                      `"${(r.fuelUrgentReason || '').replace(/"/g, '""')}"`,
                      photoCnt,
                      r.status === 'verified' ? 'Terverifikasi' : 'Tercatat'
                    ];
                  });
                  const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
                  const link = document.createElement('a');
                  link.setAttribute('href', encodeURI(csvContent));
                  link.setAttribute('download', `Laporan_Pengisian_BBM_Solar_${getLocalDateStr()}.csv`);
                  document.body.appendChild(link);
                  link.click();
                  document.body.removeChild(link);
                }}
                className="h-9 px-3.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs sm:text-sm font-semibold flex items-center gap-1.5 cursor-pointer transition"
              >
                <FileSpreadsheet className="w-4 h-4" />
                <span>Ekspor Excel</span>
              </button>
            </div>
          </div>

          {/* 4 Summary KPI Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
              <span className="text-sm font-semibold text-slate-600 dark:text-slate-300 block">
                Total Isi BBM (Solar)
              </span>
              <div className="text-3xl font-bold text-slate-900 dark:text-white font-mono tabular-nums mt-1.5 leading-none">
                {totalFuelReportsCount}
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
              <span className="text-sm font-semibold text-amber-700 dark:text-amber-400 block">
                SPBU Farly
              </span>
              <div className="text-3xl font-bold text-amber-600 dark:text-amber-400 font-mono tabular-nums mt-1.5 leading-none">
                {reports.filter(r => r.category === 'isi_bbm' && resolveFuelLocation(r) === 'Farly').length}
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
              <span className="text-sm font-semibold text-blue-600 dark:text-blue-400 block">
                SPBU Gajah Mada
              </span>
              <div className="text-3xl font-bold text-blue-600 dark:text-blue-400 font-mono tabular-nums mt-1.5 leading-none">
                {reports.filter(r => r.category === 'isi_bbm' && resolveFuelLocation(r) === 'Gajah Mada').length}
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
              <span className="text-sm font-semibold text-rose-600 dark:text-rose-400 block">
                SPBU Lain (Urgent)
              </span>
              <div className="text-3xl font-bold text-rose-600 dark:text-rose-400 font-mono tabular-nums mt-1.5 leading-none">
                {reports.filter(r => r.category === 'isi_bbm' && resolveFuelLocation(r) === 'SPBU Lain (Urgent)').length}
              </div>
            </div>
          </div>

          {/* Filter & Search Bar */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={fuelSearchQuery}
                onChange={(e) => setFuelSearchQuery(e.target.value)}
                placeholder="Cari nama supir, plat nomor armada, atau lokasi SPBU..."
                className="w-full h-10 pl-10 pr-4 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-blue-500"
              />
            </div>
            <select
              value={fuelLocationFilter}
              onChange={(e) => setFuelLocationFilter(e.target.value as 'all' | 'Farly' | 'Gajah Mada' | 'SPBU Lain (Urgent)')}
              className="h-10 px-3.5 rounded-lg text-sm font-semibold bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-700 focus:outline-none focus:border-blue-500 cursor-pointer shrink-0"
            >
              <option value="all">Semua Lokasi SPBU</option>
              <option value="Farly">SPBU Farly</option>
              <option value="Gajah Mada">SPBU Gajah Mada</option>
              <option value="SPBU Lain (Urgent)">SPBU Lain (Urgent)</option>
            </select>
          </div>

          {/* Table */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    <th className="py-3 px-4 w-12 text-center">#</th>
                    <th className="py-3 px-4">Tanggal &amp; Waktu</th>
                    <th className="py-3 px-4">Driver / Kru</th>
                    <th className="py-3 px-4">Nomor Kendaraan</th>
                    <th className="py-3 px-4">Area Kirim</th>
                    <th className="py-3 px-4">Lokasi BBM (Solar)</th>
                    <th className="py-3 px-4 text-center">Foto Bukti</th>
                    <th className="py-3 px-4 text-center">Status</th>
                    {isSuperAdmin && <th className="py-3 px-4 text-center">Tindakan</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                  {fuelReportsList.length === 0 ? (
                    <tr>
                      <td colSpan={isSuperAdmin ? 9 : 8} className="py-12 text-center text-sm text-slate-500">
                        Belum ada laporan pengisian BBM (Solar) di lokasi Farly maupun Gajah Mada.
                      </td>
                    </tr>
                  ) : (
                    fuelReportsList.map((rep, idx) => {
                      const loc = resolveFuelLocation(rep);
                      const areaKirim = resolveFuelAreaKirim(rep);
                      const fuelPhotoCount = rep.photoUrls?.length || (rep.photoUrl ? 1 : 0);
                      return (
                        <tr key={rep.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition">
                          <td className="py-3.5 px-4 text-center font-mono text-slate-500 font-semibold">{idx + 1}</td>
                          <td className="py-3.5 px-4 whitespace-nowrap">
                            <div className="text-sm font-mono font-bold text-slate-900 dark:text-white tabular-nums">
                              {rep.date || getLocalDateStr(rep.timestamp)}
                            </div>
                            <div className="text-xs text-slate-500 font-mono tabular-nums mt-0.5">
                              {new Date(rep.timestamp).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })} WIB
                            </div>
                          </td>
                          <td className="py-3.5 px-4 text-[15px] font-bold text-slate-900 dark:text-white">
                            {rep.driverName}
                          </td>
                          <td className="py-3.5 px-4 whitespace-nowrap">
                            <span className="text-sm font-mono font-bold text-slate-900 dark:text-slate-100 tabular-nums">
                              {formatPlateWithInitial(rep.plateNumber)}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 text-sm font-semibold text-slate-800 dark:text-slate-200">
                            {areaKirim}
                          </td>
                          <td className="py-3.5 px-4">
                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold border whitespace-nowrap ${
                              loc === 'SPBU Lain (Urgent)'
                                ? 'bg-rose-50 dark:bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-500/30'
                                : loc === 'Gajah Mada'
                                ? 'bg-blue-50 dark:bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-500/30'
                                : 'bg-amber-50 dark:bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-500/30'
                            }`}>
                              <MapPin className="w-3.5 h-3.5" />
                              <span>{loc === 'SPBU Lain (Urgent)' ? loc : `SPBU ${loc}`}</span>
                            </span>
                            {loc === 'SPBU Lain (Urgent)' && rep.fuelUrgentReason && (
                              <div className="mt-1 text-xs text-rose-700 dark:text-rose-300 font-medium max-w-xs">
                                Alasan: {rep.fuelUrgentReason}
                              </div>
                            )}
                          </td>
                          <td className="py-3.5 px-4 text-center whitespace-nowrap">
                            {fuelPhotoCount > 0 ? (
                              <button
                                type="button"
                                onClick={() => setSelectedPhotoModal(rep)}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-50 dark:bg-blue-500/15 hover:bg-blue-100 dark:hover:bg-blue-500/25 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-500/30 text-xs font-bold cursor-pointer transition"
                              >
                                <Camera className="w-3.5 h-3.5" />
                                <span>{fuelPhotoCount > 1 ? `Lihat ${fuelPhotoCount} Foto` : 'Lihat Foto'}</span>
                              </button>
                            ) : (
                              <span className="text-slate-400 text-xs">-</span>
                            )}
                          </td>
                          <td className="py-3.5 px-4 text-center whitespace-nowrap">
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-emerald-50 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-500/30">
                              <CheckCircle2 className="w-3.5 h-3.5" /> Tercatat
                            </span>
                          </td>
                          {isSuperAdmin && (
                            <td className="py-3.5 px-4 text-center whitespace-nowrap">
                              <button
                                type="button"
                                onClick={() =>
                                  setDeleteConfirmTarget({
                                    id: rep.id,
                                    driverName: rep.driverName,
                                    plateNumber: formatPlateWithInitial(rep.plateNumber),
                                    areaName: `${areaKirim} • SPBU ${loc}`,
                                    date: rep.date || getLocalDateStr(rep.timestamp),
                                    label: 'Pengisian BBM (Solar)'
                                  })
                                }
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-rose-50 dark:bg-rose-500/15 hover:bg-rose-600 text-rose-600 dark:text-rose-400 hover:text-white border border-rose-200 dark:border-rose-500/35 text-xs font-semibold transition cursor-pointer"
                                title="Hapus Laporan BBM (Khusus Super Admin)"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                                <span>Hapus</span>
                              </button>
                            </td>
                          )}
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : activeSubMenu === 'peringatan_offline' ? (
        /* 📍 DESAIN UI/UX: LAPORAN GPS PENGISIAN FORM KIRIM (HISTORY GPS AWAL, GPS KEDUA, GPS KETIGA) */
        <div className="space-y-5 animate-in fade-in duration-200">
          {/* Top Hero Card */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-start sm:items-center gap-3.5">
              <div className="w-12 h-12 rounded-2xl flex items-center justify-center border shrink-0 shadow-xs bg-emerald-50 dark:bg-emerald-500/15 border-emerald-200 dark:border-emerald-500/30 text-emerald-600 dark:text-emerald-400">
                <Navigation className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-white tracking-tight">
                    Laporan GPS Pengisian Form Kirim (Driver &amp; Helper)
                  </h2>
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                  Memantau titik koordinat GPS otomatis saat Driver / Helper menekan tombol Simpan pada Form Kirim beserta riwayat perubahan simpan: <strong>GPS Awal</strong>, <strong>GPS Kedua</strong>, dan <strong>GPS Ketiga</strong>.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => {
                  loadReports();
                  void formKirimStore.hydrateFromServer(true);
                  setFormKirimRecords([...formKirimStore.getAll()]);
                }}
                className="px-3.5 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold flex items-center gap-1.5 border border-slate-200 dark:border-slate-700 cursor-pointer transition"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Segarkan Data</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  if (filteredGpsFormKirimReports.length === 0) return;
                  const headers = [
                    'Tanggal Kirim',
                    'Area Kirim',
                    'Armada',
                    'Driver',
                    'Helper',
                    'Nama Pelanggan',
                    'Kategori',
                    'No Faktur',
                    'Metode Simpan',
                    'Jumlah Edit',
                    'GPS Awal (Koordinat & Jam)',
                    'GPS Kedua (Koordinat & Jam)',
                    'GPS Ketiga (Koordinat & Jam)'
                  ];
                  const csvRows = filteredGpsFormKirimReports.map(r => [
                    r.tanggalKirim,
                    `"${r.areaKirim}"`,
                    `"${formatPlateWithInitial(r.plateNumber)}"`,
                    `"${r.driverName}"`,
                    `"${r.helperName || '-'}"`,
                    `"${r.customerName}"`,
                    r.paymentCategory,
                    `"${r.invoiceNumbers.join(', ')}"`,
                    `"${r.savedMethod}${r.nominalDiterima > 0 ? ` (Rp ${r.nominalDiterima.toLocaleString('id-ID')})` : ''}"`,
                    `${r.editCount}/3`,
                    `"${r.gpsAwal ? `${r.gpsAwal.lat}, ${r.gpsAwal.lng} (${r.gpsAwal.savedTimeWib} - ${r.gpsAwal.savedBy})` : '-'}"`,
                    `"${r.gpsKedua ? `${r.gpsKedua.lat}, ${r.gpsKedua.lng} (${r.gpsKedua.savedTimeWib} - ${r.gpsKedua.savedBy})` : 'Belum Ada Perubahan Ke-2'}"`,
                    `"${r.gpsKetiga ? `${r.gpsKetiga.lat}, ${r.gpsKetiga.lng} (${r.gpsKetiga.savedTimeWib} - ${r.gpsKetiga.savedBy})` : 'Belum Ada Perubahan Ke-3'}"`
                  ]);
                  const csvContent =
                    'data:text/csv;charset=utf-8,\uFEFF' +
                    [headers.join(','), ...csvRows.map(row => row.join(','))].join('\n');
                  const link = document.createElement('a');
                  link.setAttribute('href', encodeURI(csvContent));
                  link.setAttribute('download', `Laporan_GPS_Form_Kirim_${getLocalDateStr()}.csv`);
                  document.body.appendChild(link);
                  link.click();
                  document.body.removeChild(link);
                }}
                className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer transition shadow-xs"
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                <span>Ekspor Excel GPS</span>
              </button>
            </div>
          </div>

          {/* 3 Summary KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-xs flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-slate-500 dark:text-slate-400 block">
                  Total Titik GPS Simpan Form Kirim
                </span>
                <div className="text-2xl font-black text-slate-900 dark:text-white font-mono mt-1">
                  {formKirimGpsReportsList.length}
                </div>
                <span className="text-[11px] text-slate-500 dark:text-slate-400">
                  Pelanggan terkunci GPS saat klik Simpan
                </span>
              </div>
              <div className="w-11 h-11 rounded-2xl bg-blue-50 dark:bg-blue-500/15 flex items-center justify-center text-blue-600 dark:text-blue-400">
                <MapPin className="w-5 h-5" />
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 border border-amber-200 dark:border-amber-500/30 rounded-2xl p-4 shadow-xs flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-amber-700 dark:text-amber-300 block">
                  Riwayat Ubah Simpan (GPS Kedua / Ketiga)
                </span>
                <div className="text-2xl font-black text-amber-600 dark:text-amber-400 font-mono mt-1">
                  {editedMultiGpsCount}
                </div>
                <span className="text-[11px] text-slate-500 dark:text-slate-400">
                  Driver / Helper mengubah fitur Simpan (2x–3x)
                </span>
              </div>
              <div className="w-11 h-11 rounded-2xl bg-amber-50 dark:bg-amber-500/15 flex items-center justify-center text-amber-600 dark:text-amber-400">
                <Layers className="w-5 h-5" />
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 border border-emerald-200 dark:border-emerald-500/30 rounded-2xl p-4 shadow-xs flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-emerald-700 dark:text-emerald-300 block">
                  Simpan GPS Awal (1x Simpan Tanpa Ubah)
                </span>
                <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400 font-mono mt-1">
                  {initialOnlyGpsCount}
                </div>
                <span className="text-[11px] text-slate-500 dark:text-slate-400">
                  Terkunci pada titik GPS Awal
                </span>
              </div>
              <div className="w-11 h-11 rounded-2xl bg-emerald-50 dark:bg-emerald-500/15 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                <Lock className="w-5 h-5" />
              </div>
            </div>
          </div>

          {/* Search & History Filter Bar */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-xs flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={offlineSearchQuery}
                onChange={e => setOfflineSearchQuery(e.target.value)}
                placeholder="Cari nama supir, helper, plat armada, area kirim, nama pelanggan, atau no faktur..."
                className="w-full pl-10 pr-4 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-blue-500"
              />
            </div>
            <div className="flex items-center gap-1.5 flex-wrap">
              {[
                { key: 'all', label: `Semua Riwayat GPS (${formKirimGpsReportsList.length})` },
                { key: 'edited_multi', label: `Ada Perubahan Simpan (${editedMultiGpsCount})` },
                { key: 'initial_only', label: `Hanya GPS Awal (${initialOnlyGpsCount})` }
              ].map(tab => (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setGPSHistoryFilter(tab.key as any)}
                  className={`px-3 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
                    gpsHistoryFilter === tab.key
                      ? 'bg-slate-900 dark:bg-blue-600 text-white shadow-xs'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* Tabel & Rincian Riwayat GPS Awal, GPS Kedua, GPS Ketiga — Desain Full Halaman Tanpa Scroll Geser */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-xs w-full">
            {filteredGpsFormKirimReports.length === 0 ? (
              <div className="p-10 text-center space-y-3">
                <div className="w-12 h-12 rounded-2xl bg-blue-50 dark:bg-blue-500/15 border border-blue-200 dark:border-blue-500/30 flex items-center justify-center text-blue-600 dark:text-blue-400 mx-auto">
                  <Navigation className="w-6 h-6" />
                </div>
                <div className="text-sm font-black text-slate-900 dark:text-white">
                  Belum Ada Riwayat GPS Simpan Form Kirim
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 max-w-lg mx-auto leading-relaxed">
                  Saat Driver atau Helper mengklik tombol <strong>Simpan</strong> (Tunai / Transfer / TTD / Keterangan) pada menu <strong>Form Kirim</strong> di Portal Driver, titik koordinat <strong>GPS Awal</strong>, <strong>GPS Kedua</strong>, dan <strong>GPS Ketiga</strong> otomatis terkunci dan tercatat di halaman ini.
                </p>
              </div>
            ) : (
              <div className="w-full">
                <table className="w-full table-fixed text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      <th className="py-3 px-2 w-8 text-center">#</th>
                      <th className="py-3 px-2.5 w-[15%]">Kru, Armada &amp; Area</th>
                      <th className="py-3 px-2.5 w-[17%]">Pelanggan &amp; Faktur</th>
                      <th className="py-3 px-2.5">History 1: GPS Awal (Simpan Ke-1)</th>
                      <th className="py-3 px-2.5">History 2: GPS Kedua (Ubah Ke-2)</th>
                      <th className="py-3 px-2.5">History 3: GPS Ketiga (Ubah Ke-3)</th>
                      {isSuperAdmin && <th className="py-3 px-2 w-[78px] text-center">Aksi</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                    {filteredGpsFormKirimReports.map((row, idx) => {
                      const renderGpsCell = (
                        entry: FormKirimGpsLockEntry | null,
                        stepNumber: 1 | 2 | 3,
                        prevEntry: FormKirimGpsLockEntry | null
                      ) => {
                        const stepTitle =
                          stepNumber === 1 ? 'GPS Awal' : stepNumber === 2 ? 'GPS Kedua' : 'GPS Ketiga';
                        if (!entry) {
                          return (
                            <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-dashed border-slate-200 dark:border-slate-800 text-[11px] text-slate-400 italic h-full">
                              Belum ada perubahan simpan ke-{stepNumber} ({stepTitle})
                            </div>
                          );
                        }
                        const shiftedMeters =
                          prevEntry && stepNumber > 1
                            ? computeDistanceMeters(prevEntry.lat, prevEntry.lng, entry.lat, entry.lng)
                            : 0;
                        const badgeColors =
                          stepNumber === 1
                            ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30'
                            : stepNumber === 2
                            ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30'
                            : 'bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30';

                        return (
                          <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-1.5 w-full min-w-0">
                            <div className="flex items-center justify-between gap-1">
                              <span
                                className={`px-1.5 py-0.5 rounded-md text-[10px] font-black uppercase border shrink-0 ${badgeColors}`}
                              >
                                🔒 {stepTitle}
                              </span>
                              <span className="font-mono text-[10px] font-bold text-slate-500 dark:text-slate-400 shrink-0">
                                {entry.savedTimeWib}
                              </span>
                            </div>

                            <div className="flex items-center justify-between gap-1">
                              <span className="font-mono font-black text-[11px] text-slate-900 dark:text-white truncate">
                                {entry.lat.toFixed(5)}, {entry.lng.toFixed(5)}
                              </span>
                              <a
                                href={`https://www.google.com/maps?q=${entry.lat},${entry.lng}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-blue-500/10 hover:bg-blue-500/20 text-blue-600 dark:text-blue-400 text-[10px] font-bold transition shrink-0"
                              >
                                <MapPin className="w-2.5 h-2.5" />
                                <span>Maps</span>
                                <ExternalLink className="w-2.5 h-2.5" />
                              </a>
                            </div>

                            <div className="text-[10px] text-slate-600 dark:text-slate-300 font-semibold truncate" title={entry.summary}>
                              {entry.summary}
                            </div>

                            <div className="flex items-center justify-between gap-1 text-[10px] text-slate-500 pt-1 border-t border-slate-200/70 dark:border-slate-800">
                              <span className="truncate">Oleh: <strong>{entry.savedBy}</strong></span>
                              {stepNumber > 1 && prevEntry ? (
                                <span className="font-mono font-bold text-amber-600 dark:text-amber-400 shrink-0">
                                  {shiftedMeters > 0 ? `Δ ${shiftedMeters}m` : 'Titik Sama'}
                                </span>
                              ) : (
                                <span className="font-mono shrink-0">±{entry.accuracy}m</span>
                              )}
                            </div>
                          </div>
                        );
                      };

                      return (
                        <tr
                          key={row.rowId}
                          className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition align-top"
                        >
                          <td className="py-3 px-2 text-center font-mono font-bold text-slate-500">
                            {idx + 1}
                          </td>
                          <td className="py-3 px-2.5 min-w-0">
                            <div className="font-black text-slate-900 dark:text-white truncate">
                              {row.driverName}
                            </div>
                            {row.helperName &&
                              row.helperName !== '-' &&
                              row.helperName.trim().toLowerCase() !== (row.driverName || '').trim().toLowerCase() && (
                                <div className="text-[11px] text-slate-500 truncate">
                                  Helper: <strong className="text-slate-700 dark:text-slate-300">{row.helperName}</strong>
                                </div>
                              )}
                            <div className="mt-1 flex flex-wrap items-center gap-1">
                              <span className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 font-mono font-bold text-[10px] text-slate-800 dark:text-amber-300 truncate max-w-full">
                                {formatPlateWithInitial(row.plateNumber)}
                              </span>
                              <span className="px-1.5 py-0.5 rounded bg-blue-50 dark:bg-blue-500/15 text-blue-700 dark:text-blue-300 text-[10px] font-black uppercase truncate max-w-full">
                                {row.areaKirim}
                              </span>
                            </div>
                            <div className="text-[10px] font-mono text-slate-400 mt-1">
                              Tgl Kirim: {row.tanggalKirim}
                            </div>
                          </td>

                          <td className="py-3 px-2.5 min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span
                                className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${
                                  row.paymentCategory === 'COD'
                                    ? 'bg-[#FFFF00] text-slate-950 border border-amber-400'
                                    : 'bg-red-600 text-white'
                                }`}
                              >
                                {row.paymentCategory}
                              </span>
                              <span
                                className={`px-2 py-0.5 rounded text-[10px] font-black ${
                                  row.editCount >= 2
                                    ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30'
                                    : 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30'
                                }`}
                              >
                                Simpan {row.editCount}/3
                              </span>
                            </div>
                            <div className="font-black text-slate-900 dark:text-white mt-1 truncate" title={row.customerName}>
                              {row.customerName}
                            </div>
                            <div className="text-[11px] text-slate-500 truncate" title={row.customerAddress}>
                              {row.customerAddress}
                            </div>
                            <div className="text-[10px] font-mono text-slate-600 dark:text-slate-400 mt-1 truncate" title={row.invoiceNumbers.join(', ')}>
                              {row.invoiceNumbers.join(', ')}
                            </div>
                            <div className="mt-1 text-[11px] font-bold text-emerald-600 dark:text-emerald-400 truncate">
                              {row.savedMethod}
                              {row.nominalDiterima > 0
                                ? `: Rp ${row.nominalDiterima.toLocaleString('id-ID')}`
                                : ` (Tagihan Rp ${row.totalNilaiFaktur.toLocaleString('id-ID')})`}
                            </div>
                          </td>

                          <td className="py-3 px-2 min-w-0">
                            {renderGpsCell(row.gpsAwal, 1, null)}
                          </td>

                          <td className="py-3 px-2 min-w-0">
                            {renderGpsCell(row.gpsKedua, 2, row.gpsAwal)}
                          </td>

                          <td className="py-3 px-2 min-w-0">
                            {renderGpsCell(row.gpsKetiga, 3, row.gpsKedua || row.gpsAwal)}
                          </td>

                          {isSuperAdmin && (
                            <td className="py-3 px-2 text-center align-middle">
                              <button
                                type="button"
                                onClick={() =>
                                  setDeleteConfirmTarget({
                                    id: row.rowId,
                                    driverName: row.driverName,
                                    plateNumber: formatPlateWithInitial(row.plateNumber),
                                    areaName: `${row.customerName} (${row.areaKirim})`,
                                    date: row.tanggalKirim,
                                    label: 'Riwayat GPS Simpan Form Kirim',
                                    formKirimGpsTarget: {
                                      formKirimId: row.formKirimId,
                                      itemIds: row.itemIds
                                    }
                                  })
                                }
                                className="inline-flex items-center justify-center gap-1 px-2 py-1.5 rounded-xl bg-rose-500/15 hover:bg-rose-600 text-rose-600 dark:text-rose-400 hover:text-white border border-rose-500/35 hover:border-rose-500 text-[10px] font-bold transition active:scale-95 cursor-pointer"
                                title="Hapus Riwayat GPS Pelanggan Ini (Khusus Role Super Admin)"
                              >
                                <Trash2 className="w-3.5 h-3.5 shrink-0" />
                                <span>Hapus</span>
                              </button>
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      ) : activeSubMenu === 'validasi_jadwal_portal' ? (
        <SchedulePortalValidationReport
          onBack={() => setActiveSubMenu('operasional')}
          backLabel="Kembali ke Laporan Kru"
        />
      ) : activeSubMenu === 'validasi_rute_form' ? (
        <IntegratedRouteValidation />
      ) : activeSubMenu === 'retur_muat_salah' ? (
        <MuatReturValidationTab embeddedInLogistics />
      ) : (
        <>
          {/* 2. Header Judul Halaman */}
          <div className="bg-white dark:bg-[#162234] border border-slate-200 dark:border-[#24344D] rounded-xl px-5 py-4 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
                Laporan &amp; Kendala Kiriman Kru
              </h1>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                Kalender kendala harian &amp; solusi langsung SPV Logistik ke ponsel kru.
              </p>
            </div>

            <div className="flex items-center gap-2 flex-wrap shrink-0">
              <button
                type="button"
                onClick={loadReports}
                className="h-9 inline-flex items-center gap-1.5 px-3.5 rounded-lg bg-white dark:bg-[#162234] hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-[#24344D] text-xs sm:text-sm font-semibold transition-colors cursor-pointer whitespace-nowrap shrink-0"
                title="Muat Ulang Data"
              >
                <RefreshCw className="w-4 h-4 text-slate-500" />
                <span>Segarkan</span>
              </button>

              <button
                type="button"
                onClick={handleExportCsv}
                className="h-9 inline-flex items-center gap-1.5 px-3.5 rounded-lg bg-green-600 hover:bg-green-700 text-white border border-green-700 text-xs sm:text-sm font-semibold transition-colors cursor-pointer whitespace-nowrap shrink-0"
                title="Unduh laporan dalam format CSV / Excel"
              >
                <FileSpreadsheet className="w-4 h-4" />
                <span>Export Excel</span>
              </button>
            </div>
          </div>

          {/* 🔔 NOTIFIKASI PERUBAHAN JADWAL PENGIRIMAN (MINIMIZED COMPACT DESIGN) */}
          {scheduleChangeNotifs.length > 0 && (
            <div className="bg-emerald-950/35 border border-emerald-500/30 rounded-xl px-3 py-2 transition-all">
              <div className="flex items-center justify-between gap-2 flex-wrap sm:flex-nowrap">
                <button
                  type="button"
                  onClick={() => setIsScheduleNotifExpanded(prev => !prev)}
                  className="flex items-center gap-2 min-w-0 flex-1 text-left cursor-pointer group"
                  title={isScheduleNotifExpanded ? 'Klik untuk minimize notifikasi' : 'Klik untuk lihat rincian notifikasi'}
                >
                  <div className="w-6 h-6 rounded-lg bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center shrink-0 text-emerald-400">
                    <RefreshCw className="w-3 h-3" />
                  </div>
                  <span className="text-xs font-bold text-emerald-300 whitespace-nowrap">
                    Notifikasi Jadwal
                  </span>
                  <span className="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-xs font-mono font-bold shrink-0">
                    {scheduleChangeNotifs.length}
                  </span>
                  {scheduleChangeNotifs[0] && (
                    <span className="text-xs text-slate-300 truncate min-w-0 hidden md:inline">
                      <span className="text-emerald-400 font-semibold">{scheduleChangeNotifs[0].title}:</span>{' '}
                      {scheduleChangeNotifs[0].message}
                    </span>
                  )}
                </button>

                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => setIsScheduleNotifExpanded(prev => !prev)}
                    className="px-2.5 py-1 rounded-lg bg-slate-900/90 hover:bg-slate-800 text-emerald-300 text-xs font-semibold border border-emerald-500/30 flex items-center gap-1 cursor-pointer transition"
                  >
                    <span>{isScheduleNotifExpanded ? 'Minimize' : 'Lihat'}</span>
                    <ChevronDown
                      className={`w-3.5 h-3.5 transition-transform duration-200 ${
                        isScheduleNotifExpanded ? 'rotate-180' : ''
                      }`}
                    />
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setScheduleChangeNotifs([]);
                      setIsScheduleNotifExpanded(false);
                      try {
                        localStorage.removeItem('akk_schedule_change_notifs_v1');
                      } catch {}
                    }}
                    className="px-2.5 py-1 rounded-lg bg-slate-900/90 hover:bg-rose-950/60 text-slate-300 hover:text-rose-300 text-xs font-semibold border border-slate-700 hover:border-rose-500/40 cursor-pointer transition"
                    title="Bersihkan Semua Notifikasi"
                  >
                    Bersihkan
                  </button>
                </div>
              </div>

              {isScheduleNotifExpanded && (
                <div className="mt-2 pt-2 border-t border-emerald-500/20 grid grid-cols-1 md:grid-cols-2 gap-1.5 max-h-28 overflow-y-auto pr-1 animate-in fade-in duration-150">
                  {scheduleChangeNotifs.slice(0, 6).map(notif => (
                    <div
                      key={notif.id}
                      className="px-2.5 py-1.5 rounded-lg bg-slate-950/90 border border-emerald-500/25 text-xs flex items-center justify-between gap-2"
                    >
                      <div className="min-w-0 flex-1">
                        <span className="font-bold text-emerald-300 mr-1.5">{notif.title}:</span>
                        <span className="text-slate-300 line-clamp-1">{notif.message}</span>
                      </div>
                      <span className="text-xs text-slate-400 font-mono shrink-0">
                        {new Date(notif.timestamp).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* 3. Baris Metrik Kendala (Grid 4 Kolom Flat) */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
            <div className="bg-white dark:bg-[#162234] border border-slate-200 dark:border-[#24344D] rounded-xl p-4">
              <span className="text-sm font-semibold text-slate-600 dark:text-slate-300 block">
                Total Kendala Masuk
              </span>
              <div className="text-3xl font-bold text-slate-900 dark:text-white mt-1.5 font-mono tabular-nums flex items-baseline gap-1.5 leading-none">
                <span>{inScopeTotal}</span>
                {dateFilterMode !== 'all' && (
                  <span className="text-xs text-slate-400 font-sans font-medium">/ {totalCount} total</span>
                )}
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400 mt-1.5 font-mono tabular-nums">
                {selectedCalendarDate}
              </div>
            </div>

            <div className="bg-white dark:bg-[#162234] border border-slate-200 dark:border-[#24344D] rounded-xl p-4">
              <span className="text-sm font-semibold text-rose-600 dark:text-rose-400 block">
                Kendala Jalan &amp; Rute
              </span>
              <div className="text-3xl font-bold text-rose-600 dark:text-rose-400 mt-1.5 font-mono tabular-nums flex items-baseline gap-1.5 leading-none">
                <span>{inScopeKendala}</span>
                {dateFilterMode !== 'all' && (
                  <span className="text-xs text-slate-400 font-sans font-medium">/ {kendalaCount} total</span>
                )}
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400 mt-1.5">
                Macet &amp; gangguan rute
              </div>
            </div>

            <div className="bg-white dark:bg-[#162234] border border-slate-200 dark:border-[#24344D] rounded-xl p-4">
              <span className="text-sm font-semibold text-blue-600 dark:text-sky-400 block">
                Antri Customer
              </span>
              <div className="text-3xl font-bold text-blue-600 dark:text-sky-400 mt-1.5 font-mono tabular-nums flex items-baseline gap-1.5 leading-none">
                <span>{inScopeAkhir}</span>
                {dateFilterMode !== 'all' && (
                  <span className="text-xs text-slate-400 font-sans font-medium">/ {akhirCount} total</span>
                )}
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400 mt-1.5">
                Antrean bongkar toko
              </div>
            </div>

            <div className="bg-white dark:bg-[#162234] border border-slate-200 dark:border-[#24344D] rounded-xl p-4">
              <span className="text-sm font-semibold text-amber-700 dark:text-amber-400 block">
                Menunggu Solusi SPV
              </span>
              <div className="text-3xl font-bold text-amber-600 dark:text-amber-400 mt-1.5 font-mono tabular-nums flex items-baseline gap-1.5 leading-none">
                <span>{inScopePending}</span>
                {dateFilterMode !== 'all' && (
                  <span className="text-xs text-slate-400 font-sans font-medium">/ {pendingCount} total</span>
                )}
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400 mt-1.5">
                Tindak lanjut SPV DC
              </div>
            </div>
          </div>

          {/* Main Content: Split View (Calendar on Left ~5 cols, Table & Search on Right ~7 cols) */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Kolom Kiri: Kalender Laporan & Kendala (~5 Kolom) */}
            <div className="lg:col-span-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 sm:p-5 space-y-3.5">
              <div className="flex flex-col gap-3 border-b border-slate-200 dark:border-slate-800 pb-3">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-blue-600 text-white flex items-center justify-center shrink-0">
                    <Calendar className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white tracking-tight">
                      Kalender Laporan &amp; Kendala — {monthlyCalendarGrid.monthName} {monthlyCalendarGrid.year}
                    </h3>
                    <div className="flex items-center gap-3 text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 flex-wrap">
                      <span>
                        Tanggal: <strong className="text-blue-600 dark:text-blue-400 font-mono tabular-nums">{selectedCalendarDate}</strong>
                      </span>
                      <span className="inline-flex items-center gap-1 text-rose-600 dark:text-rose-400 font-semibold">
                        <AlertTriangle className="w-3 h-3" /> Kendala Masuk
                      </span>
                      <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-semibold">
                        <CheckCircle2 className="w-3 h-3" /> Solusi Terkirim
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs text-slate-500 font-medium">Bulan &amp; Tahun:</span>
                  <div className="flex items-center gap-2">
                    <select
                      value={calendarMonth}
                      onChange={(e) => {
                        const nextMonth = Number(e.target.value);
                        setCalendarMonth(nextMonth);
                        const nextIso = `${calendarYear}-${String(nextMonth + 1).padStart(2, '0')}-01`;
                        setSelectedCalendarDate(nextIso);
                        setDateFilterMode('single_date');
                      }}
                      className="h-8 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200 text-xs font-semibold rounded-lg px-2.5 focus:outline-none focus:border-blue-500 cursor-pointer"
                    >
                      {CALENDAR_MONTH_NAMES.map((m, idx) => (
                        <option key={m} value={idx}>{m}</option>
                      ))}
                    </select>
                    <select
                      value={calendarYear}
                      onChange={(e) => {
                        const nextYear = Number(e.target.value);
                        setCalendarYear(nextYear);
                        const nextIso = `${nextYear}-${String(calendarMonth + 1).padStart(2, '0')}-01`;
                        setSelectedCalendarDate(nextIso);
                        setDateFilterMode('single_date');
                      }}
                      className="h-8 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200 text-xs font-semibold rounded-lg px-2.5 focus:outline-none focus:border-blue-500 cursor-pointer tabular-nums"
                    >
                      {[2024, 2025, 2026, 2027, 2028].map(yr => (
                        <option key={yr} value={yr}>{yr}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* 7-Column Calendar Grid Header */}
              <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-bold uppercase tracking-wide text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-800/70 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800">
                <div className="text-rose-600 dark:text-rose-400">Min</div>
                <div>Sen</div>
                <div>Sel</div>
                <div>Rab</div>
                <div>Kam</div>
                <div>Jum</div>
                <div className="text-blue-600 dark:text-blue-400">Sab</div>
              </div>

              {/* Calendar Cells Grid */}
              <div className="grid grid-cols-7 gap-1.5">
                {monthlyCalendarGrid.cells.map((cell) => {
                  if (cell.type === 'padding') {
                    return (
                      <div
                        key={cell.key}
                        className="min-h-[58px] bg-slate-50/50 dark:bg-slate-900/20 rounded-xl border border-dashed border-slate-200 dark:border-slate-800/60"
                      />
                    );
                  }

                  const isSelected = selectedCalendarDate === cell.iso;
                  const hasUnhandled = cell.needsActionCount > 0;
                  const hasKendala = cell.kendalaCount > 0;
                  const hasAkhirKiriman = cell.akhirKirimanCount > 0;
                  const isAllResolvedGreen = !hasUnhandled && (cell.sentToPortalCount > 0 || hasAkhirKiriman);

                  return (
                    <div
                      key={cell.key}
                      onClick={() => {
                        setSelectedCalendarDate(cell.iso);
                        setDateFilterMode('single_date');
                      }}
                      className={`min-h-[58px] p-1.5 rounded-xl border transition-colors cursor-pointer flex flex-col justify-between select-none relative gap-1 ${
                        isSelected
                          ? hasUnhandled
                            ? 'bg-rose-50 dark:bg-rose-950/60 border-rose-500 ring-1 ring-rose-500/30 z-10'
                            : 'bg-green-50 dark:bg-green-950/40 border-green-500 ring-1 ring-green-500/25 z-10'
                          : hasUnhandled
                          ? 'bg-rose-50/80 dark:bg-rose-950/40 hover:bg-rose-100/70 dark:hover:bg-rose-950/60 border-rose-300 dark:border-rose-500/60'
                          : isAllResolvedGreen
                          ? 'bg-green-50/60 dark:bg-green-950/30 hover:bg-green-100/60 dark:hover:bg-green-950/50 border-green-300 dark:border-green-500/50'
                          : 'bg-white dark:bg-[#162234] hover:bg-slate-50 dark:hover:bg-slate-800/50 border-slate-200 dark:border-[#24344D]'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-1">
                        <span
                          className={`text-xs font-bold px-1 py-0.5 rounded-md tabular-nums ${
                            hasUnhandled
                              ? 'bg-rose-600 text-white'
                              : isAllResolvedGreen || isSelected
                              ? 'bg-green-600 text-white'
                              : 'text-slate-700 dark:text-slate-300'
                          }`}
                        >
                          {String(cell.dayNumber).padStart(2, '0')}
                        </span>

                        {isAllResolvedGreen && (
                          <span
                            className="w-3.5 h-3.5 rounded-full bg-green-600 text-white flex items-center justify-center"
                            title="Solusi terkirim / Tiba di gudang tercatat"
                          >
                            <Check className="w-2.5 h-2.5 stroke-[3]" />
                          </span>
                        )}
                      </div>

                      <div className="space-y-0.5 mt-auto">
                        {hasKendala && (
                          <div className="px-1 py-0.5 rounded bg-rose-100/80 dark:bg-rose-500/20 text-rose-700 dark:text-rose-200 text-[10px] leading-tight font-bold flex items-center justify-between gap-1">
                            <span className="truncate">Kendala</span>
                            <span className="font-mono tabular-nums shrink-0">{cell.kendalaCount}</span>
                          </div>
                        )}

                        {hasAkhirKiriman && (
                          <div className="px-1 py-0.5 rounded bg-blue-100/80 dark:bg-blue-500/20 text-blue-700 dark:text-blue-200 text-[10px] leading-tight font-bold flex items-center justify-between gap-1">
                            <span className="truncate">Gudang</span>
                            <span className="font-mono tabular-nums shrink-0">{cell.akhirKirimanCount}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Kolom Kanan: Daftar Kendala & Tindak Lanjut SPV (~7 Kolom) */}
            <div className="lg:col-span-7 space-y-4">

          {/* 5. Baris Pencarian (Bawah Kalender) */}
          <div className="bg-white dark:bg-[#162234] border border-slate-200 dark:border-[#24344D] rounded-xl p-3">
            <div className="flex flex-col lg:flex-row lg:items-center gap-2.5">
              <div className="flex-1 relative min-w-0">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Cari supir, helper, plat mobil, area, atau solusi SPV..."
                  className="w-full h-10 pl-10 pr-8 rounded-lg bg-slate-50 dark:bg-[#0F172A] border border-slate-200 dark:border-[#24344D] focus:bg-white dark:focus:bg-[#162234] focus:border-blue-500 text-sm text-slate-800 dark:text-white placeholder:text-slate-400 focus:outline-none transition-colors"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 dark:hover:text-white cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>

              <div className="flex items-center gap-2.5 flex-wrap shrink-0">
                <select
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value as any)}
                  className="h-10 bg-slate-50 dark:bg-[#162234] border border-slate-200 dark:border-[#24344D] text-slate-700 dark:text-slate-200 text-sm font-semibold rounded-lg px-3.5 focus:outline-none focus:border-blue-500 cursor-pointer"
                >
                  <option value="all">Semua Jenis Kendala</option>
                  <option value="kendala_umum">Kendala di Jalan &amp; Rute</option>
                  <option value="antri_customer">Kendala Antri di Customer</option>
                </select>

                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as any)}
                  className="h-10 bg-slate-50 dark:bg-[#162234] border border-slate-200 dark:border-[#24344D] text-slate-700 dark:text-slate-200 text-sm font-semibold rounded-lg px-3.5 focus:outline-none focus:border-blue-500 cursor-pointer"
                >
                  <option value="all">Semua Status</option>
                  <option value="pending">Menunggu Solusi SPV</option>
                  <option value="follow_up">Diproses / Diberi Arahan</option>
                  <option value="verified">Terverifikasi Selesai</option>
                </select>
              </div>
            </div>
          </div>

          {/* 6. Area Empty State & Tabel Laporan */}
          <div className="bg-white dark:bg-[#162234] border border-slate-200 dark:border-[#24344D] rounded-xl overflow-hidden">
            {filteredReports.length === 0 ? (
              <div className="py-12 px-6 text-center space-y-2">
                <div className="w-11 h-11 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-[#24344D] flex items-center justify-center text-slate-400 mx-auto">
                  <Calendar className="w-5 h-5" />
                </div>
                <div className="text-base font-bold text-slate-800 dark:text-white">
                  Tidak Ada Laporan Pada Tanggal {selectedCalendarDate}
                </div>
                <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 max-w-md mx-auto">
                  Pilih tanggal lain pada kalender yang memiliki catatan kendala.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead className="bg-slate-50 dark:bg-slate-900/80 text-slate-600 dark:text-slate-300 uppercase tracking-wider text-xs font-semibold border-b border-slate-200 dark:border-[#24344D]">
                    <tr>
                      <th className="py-3.5 px-4 whitespace-nowrap">Waktu</th>
                      <th className="py-3.5 px-4 whitespace-nowrap">Kru</th>
                      <th className="py-3.5 px-4 whitespace-nowrap">Armada</th>
                      <th className="py-3.5 px-4 whitespace-nowrap">Jenis Laporan</th>
                      <th className="py-3.5 px-4 whitespace-nowrap">Nama Area Kirim</th>
                      <th className="py-3.5 px-4 text-center whitespace-nowrap">Foto</th>
                      <th className="py-3.5 px-4 whitespace-nowrap">Keterangan Kendala</th>
                      <th className="py-3.5 px-4 min-w-[210px] whitespace-nowrap">Solusi SPV</th>
                      <th className="py-3.5 px-4 text-center whitespace-nowrap">Status</th>
                      <th className="py-3.5 px-4 text-center whitespace-nowrap">Tindakan</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/70 text-slate-700 dark:text-slate-200">
                    {filteredReports.map((item) => {
                      const isVerifiedOrResolved =
                        Boolean(item.solution && item.solution.trim()) ||
                        item.status === 'verified' ||
                        item.status === 'resolved' ||
                        item.offlineStatus === 'sudah_online';

                      return (
                        <tr key={item.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition">
                          {/* 1. Waktu */}
                          <td className="py-3.5 px-4 align-middle whitespace-nowrap">
                            <div className="text-sm text-slate-900 dark:text-white font-bold font-mono tabular-nums">
                              {new Date(item.timestamp).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })} WIB
                            </div>
                            <div className="text-xs font-mono tabular-nums text-slate-500 dark:text-slate-400 mt-0.5">
                              {item.date || new Date(item.timestamp).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
                            </div>
                          </td>

                          {/* 2. Kru */}
                          {(() => {
                            const isHelperSub = String(item.userRole || '').toLowerCase().includes('helper');
                            const helperVal = item.helperName && item.helperName !== '-' ? item.helperName.trim() : '';
                            const driverVal = item.driverName && item.driverName !== '-' ? item.driverName.trim() : '';
                            const primaryName =
                              (item.reportedByName && item.reportedByName.trim()) ||
                              (isHelperSub ? (helperVal || driverVal) : (driverVal || helperVal));
                            const primaryNorm = primaryName.toLowerCase().replace(/[^a-z0-9]/g, '');
                            const companionLine = isHelperSub
                              ? (driverVal && driverVal.toLowerCase().replace(/[^a-z0-9]/g, '') !== primaryNorm
                                  ? `Driver: ${driverVal}`
                                  : '')
                              : (helperVal && helperVal.toLowerCase().replace(/[^a-z0-9]/g, '') !== primaryNorm
                                  ? `Helper: ${helperVal}`
                                  : '');

                            return (
                              <td className="py-3.5 px-4 align-middle whitespace-nowrap">
                                <div className="flex items-center gap-2">
                                  <span className="text-[15px] font-bold text-slate-900 dark:text-white">
                                    {primaryName || '-'}
                                  </span>
                                  <span className={`text-xs px-2 py-0.5 rounded-md font-semibold ${
                                    isHelperSub
                                      ? 'bg-sky-50 dark:bg-cyan-500/15 text-sky-700 dark:text-cyan-300'
                                      : 'bg-emerald-50 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
                                  }`}>
                                    {item.userRole || 'Driver'}
                                  </span>
                                </div>
                                {companionLine && (
                                  <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 font-medium">
                                    {companionLine}
                                  </div>
                                )}
                              </td>
                            );
                          })()}

                          {/* 3. Armada (Beserta Nama Inisial Armada) */}
                          <td className="py-3.5 px-4 align-middle whitespace-nowrap">
                            <span className="inline-flex items-center gap-1.5 font-mono tabular-nums font-bold text-slate-900 dark:text-amber-300 text-sm bg-slate-100 dark:bg-slate-900 px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700">
                              {formatPlateWithInitial(item.plateNumber)}
                            </span>
                          </td>

                          {/* 4. Jenis Laporan */}
                          <td className="py-3.5 px-4 align-middle space-y-1.5 whitespace-nowrap">
                            {item.category === 'mode_offline' && (
                              <div className="space-y-1">
                                <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold border ${
                                  item.offlineStatus === 'masih_offline'
                                    ? 'bg-rose-50 dark:bg-rose-500/20 text-rose-700 dark:text-rose-200 border-rose-200 dark:border-rose-500/50'
                                    : 'bg-emerald-50 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-500/30'
                                }`}>
                                  {item.offlineStatus === 'masih_offline' ? (
                                    <WifiOff className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                                  ) : (
                                    <Wifi className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                                  )}
                                  <span>Mode Offline</span>
                                </span>
                                <div className="text-xs font-mono text-slate-600 dark:text-slate-300 space-y-0.5">
                                  <div className="text-rose-600 dark:text-rose-400 font-semibold">
                                    Off: {item.offlineActivatedAt || new Date(item.timestamp).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) + ' WIB'}
                                  </div>
                                  <div className={item.onlineRestoredAt ? 'text-emerald-600 dark:text-emerald-400 font-semibold' : 'text-amber-600 dark:text-amber-400 font-semibold'}>
                                    On: {item.onlineRestoredAt || 'Masih Offline'}
                                  </div>
                                </div>
                              </div>
                            )}
                            {item.category === 'kendala_jalan' && (
                              <div>
                                {item.customerQueueStatus ? (
                                  <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold border ${
                                    item.customerQueueStatus === 'sedang_mengantri'
                                      ? 'bg-amber-50 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-500/40'
                                      : 'bg-sky-50 dark:bg-cyan-500/15 text-sky-700 dark:text-cyan-300 border-sky-200 dark:border-cyan-500/30'
                                  }`}>
                                    <Clock className="w-3.5 h-3.5 shrink-0" />
                                    <span>
                                      {item.customerQueueStatus === 'sedang_mengantri'
                                        ? 'Antri Customer'
                                        : `Selesai Antri (${item.customerQueueDurationMinutes || 15}m)`}
                                    </span>
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold bg-rose-50 dark:bg-rose-500/15 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-500/30">
                                    <AlertTriangle className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                                    <span>Kendala Jalan</span>
                                  </span>
                                )}
                              </div>
                            )}
                            {item.category === 'akhir_kiriman' && (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold bg-emerald-50 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-500/30">
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                                <span>Tiba di Gudang</span>
                              </span>
                            )}
                            {item.category === 'presensi_shift' && (
                              <div className="space-y-1">
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold bg-sky-50 dark:bg-cyan-500/15 text-sky-700 dark:text-cyan-300 border border-sky-200 dark:border-cyan-500/30">
                                  <Clock className="w-3.5 h-3.5 text-sky-600 shrink-0" />
                                  <span>Check-In &amp; Out</span>
                                </span>
                                <div className="text-xs font-mono text-slate-600 dark:text-slate-300">
                                  <span className="text-emerald-600 dark:text-emerald-400 font-semibold">In: {item.checkinTimeFormatted || '-'}</span>
                                  {' · '}
                                  <span className={item.checkoutTimeFormatted ? 'text-amber-600 dark:text-amber-400 font-semibold' : 'text-slate-500'}>
                                    Out: {item.checkoutTimeFormatted || 'Dinas'}
                                  </span>
                                </div>
                              </div>
                            )}
                            {item.category === 'pin_keamanan' && (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold bg-amber-50 dark:bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-500/30">
                                <Lock className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                                <span>PIN Keamanan (2x)</span>
                              </span>
                            )}
                            {item.category === 'istirahat' && (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold bg-blue-50 dark:bg-blue-500/15 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-500/30">
                                <CheckCircle2 className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                                <span>Absen Pelanggan</span>
                              </span>
                            )}
                            {item.category === 'update_lokasi' && (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold bg-blue-50 dark:bg-blue-500/15 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-500/30">
                                <Navigation className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                                <span>Update Lokasi</span>
                              </span>
                            )}
                            {item.securityPin && (
                              <div className="flex items-center gap-2 pt-0.5">
                                <span className="text-xs font-mono bg-amber-50 dark:bg-slate-950 px-2 py-0.5 rounded border border-amber-200 dark:border-amber-500/30 text-amber-700 dark:text-amber-300 font-semibold">
                                  PIN: {revealedPinIds[item.id] ? item.securityPin : '••••'}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => setRevealedPinIds(prev => ({ ...prev, [item.id]: !prev[item.id] }))}
                                  className="text-xs text-blue-600 dark:text-cyan-400 hover:underline font-semibold cursor-pointer"
                                >
                                  {revealedPinIds[item.id] ? 'Tutup' : 'Lihat'}
                                </button>
                              </div>
                            )}
                          </td>

                          {/* 5. Nama Area Kirim & Pelanggan */}
                          <td className="py-3.5 px-4 align-middle">
                            <div className="font-bold text-slate-900 dark:text-white text-sm max-w-[180px] truncate" title={item.areaName}>
                              {item.areaName}
                            </div>
                            {item.customerOutletName && (
                              <div className="text-xs text-blue-600 dark:text-blue-400 font-semibold mt-0.5 truncate max-w-[180px]" title={item.customerOutletName}>
                                {item.customerOutletName}
                              </div>
                            )}
                          </td>

                          {/* 6. Foto Bukti */}
                          <td className="py-3.5 px-4 align-middle text-center">
                            {item.photoUrl ? (
                              <div className="relative group w-12 h-12 rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-950 mx-auto">
                                <img
                                  src={item.photoUrl}
                                  alt="Bukti Kiriman"
                                  className="w-full h-full object-cover cursor-pointer group-hover:scale-105 transition"
                                  onClick={() => setSelectedPhotoModal(item)}
                                />
                                <button
                                  type="button"
                                  onClick={() => setSelectedPhotoModal(item)}
                                  className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition flex items-center justify-center text-white"
                                  title="Perbesar foto"
                                >
                                  <Eye className="w-4 h-4" />
                                </button>
                              </div>
                            ) : (
                              <span className="text-xs text-slate-400">—</span>
                            )}
                          </td>

                          {/* 7. Keterangan Kendala */}
                          <td className="py-3.5 px-4 align-middle max-w-[230px]">
                            <p className="text-slate-700 dark:text-slate-200 text-sm leading-snug line-clamp-3 font-medium" title={item.notes}>
                              {item.notes || '-'}
                            </p>
                          </td>

                          {/* 8. Solusi */}
                          <td className="py-3.5 px-4 align-middle max-w-[250px]">
                            {item.solution && item.solution.trim() ? (
                              <div className="bg-emerald-50/70 dark:bg-slate-950 px-3 py-2 rounded-lg border border-emerald-200 dark:border-emerald-500/40 space-y-0.5">
                                <div className="flex items-center justify-between text-xs">
                                  <span className="font-bold text-emerald-700 dark:text-emerald-400">
                                    Arahan SPV
                                  </span>
                                  <span className="text-emerald-700 dark:text-emerald-300 font-semibold">
                                    {item.driverAcknowledged ? 'Dijalankan' : 'Terkirim'}
                                  </span>
                                </div>
                                <p className="text-slate-900 dark:text-white text-xs sm:text-sm leading-snug font-semibold">
                                  "{item.solution}"
                                </p>
                              </div>
                            ) : item.category === 'kendala_jalan' ? (
                              <span className="inline-flex items-center gap-1.5 text-xs text-rose-700 dark:text-rose-300 font-bold bg-rose-50 dark:bg-rose-950/40 px-2.5 py-1 rounded-lg border border-rose-200 dark:border-rose-500/30">
                                <AlertTriangle className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                                <span>Menunggu Solusi SPV</span>
                              </span>
                            ) : (
                              <span className="text-xs text-slate-400">—</span>
                            )}
                          </td>

                          {/* 9. Status */}
                          <td className="py-3.5 px-4 align-middle text-center whitespace-nowrap">
                            {isVerifiedOrResolved ? (
                              <span className="inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-500/40">
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                                <span>Terverifikasi</span>
                              </span>
                            ) : item.status === 'follow_up' ? (
                              <span className="inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-lg bg-amber-50 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-500/40">
                                <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                                <span>Tindak Lanjut</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-lg bg-rose-50 dark:bg-rose-500/20 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-500/40">
                                <Clock className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                                <span>Pending</span>
                              </span>
                            )}
                          </td>

                          {/* 10. Tindakan (Edit, Centang, dan Hapus Khusus Super Admin) */}
                          <td className="py-3.5 px-4 align-middle text-center whitespace-nowrap">
                            {isAuthorizedSpvOrAdmin ? (
                              <div className="inline-flex items-center justify-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => handleOpenSolutionModal(item)}
                                  className="p-2 rounded-lg bg-amber-50 dark:bg-amber-500/20 hover:bg-amber-500 text-amber-700 dark:text-amber-300 hover:text-white border border-amber-200 dark:border-amber-500/40 transition cursor-pointer"
                                  title="Edit Solusi & Arahan SPV"
                                >
                                  <Edit className="w-4 h-4" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleVerify(item.id)}
                                  disabled={item.status === 'verified'}
                                  className={`p-2 rounded-lg border transition ${
                                    item.status === 'verified'
                                      ? 'bg-emerald-50 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/40 cursor-default'
                                      : 'bg-white dark:bg-slate-800 hover:bg-emerald-600 text-slate-600 dark:text-slate-300 hover:text-white border-slate-200 dark:border-slate-700 hover:border-emerald-600 cursor-pointer'
                                  }`}
                                  title={item.status === 'verified' ? 'Sudah Terverifikasi' : 'Centang Verifikasi Sah'}
                                >
                                  <Check className="w-4 h-4" />
                                </button>
                                {isSuperAdmin && (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setDeleteConfirmTarget({
                                        id: item.id,
                                        driverName: item.driverName,
                                        plateNumber: formatPlateWithInitial(item.plateNumber),
                                        areaName: item.areaName,
                                        date: item.date,
                                        label: 'Kendala Lapangan'
                                      })
                                    }
                                    className="inline-flex items-center gap-1 px-2.5 py-2 rounded-lg bg-rose-50 dark:bg-rose-500/15 hover:bg-rose-600 text-rose-600 dark:text-rose-400 hover:text-white border border-rose-200 dark:border-rose-500/35 hover:border-rose-600 text-xs font-semibold transition cursor-pointer"
                                    title="Hapus Laporan (Khusus Super Admin)"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                    <span>Hapus</span>
                                  </button>
                                )}
                              </div>
                            ) : (
                              <div className="inline-flex items-center justify-center gap-1 text-xs text-slate-400">
                                <Lock className="w-3.5 h-3.5" />
                                <span>SPV</span>
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
          </div>
          </div>
        </>
      )}

      {/* 🛠️ MODAL SOLUSI & ARAHAN SPV LOGISTIK / SUPER ADMIN */}
      {solutionModalReport && (
        <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-xl w-full overflow-hidden shadow-2xl flex flex-col max-h-[92vh]">
            
            <div className="p-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400">
                  <Send className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">
                    Solusi &amp; Arahan Tindakan SPV Logistik
                  </h3>
                  <p className="text-[10px] text-slate-400">
                    Arahan ini langsung tersambung secara real-time ke aplikasi ponsel driver penginput kendala
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSolutionModalReport(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 flex-1 overflow-y-auto space-y-4 text-xs">
              
              {/* Target Driver Info */}
              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-white flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5 text-blue-400" />
                    <span>{solutionModalReport.driverName} ({solutionModalReport.plateNumber})</span>
                  </span>
                  <span className="text-[10px] font-mono text-amber-400">
                    Area: {solutionModalReport.areaName}
                  </span>
                </div>
                <div className="text-[11px] text-rose-300 bg-rose-500/10 p-2.5 rounded-lg border border-rose-500/20">
                  <strong>Kendala yang Dilaporkan:</strong> {solutionModalReport.notes}
                </div>
              </div>

              {/* Solution Textarea */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-white block">
                  Keterangan Solusi &amp; Arahan SPV untuk Supir (Wajib Diisi):
                </label>
                <textarea
                  rows={4}
                  value={solutionText}
                  onChange={(e) => setSolutionText(e.target.value)}
                  placeholder="Ketik instruksi langkah kerja yang harus dilakukan supir/helper di lapangan saat ini..."
                  className="w-full p-3 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 leading-relaxed"
                />
              </div>

              {/* Status Update Options */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-slate-300 block">
                  Pembaruan Status Laporan:
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <label className="flex items-center gap-2 p-2 rounded-lg bg-slate-950 border border-slate-800 cursor-pointer text-xs">
                    <input
                      type="radio"
                      name="solStatus"
                      checked={solutionStatus === 'follow_up'}
                      onChange={() => setSolutionStatus('follow_up')}
                      className="text-amber-500"
                    />
                    <span className="text-amber-300 font-bold">Diproses / Diberi Arahan</span>
                  </label>
                  <label className="flex items-center gap-2 p-2 rounded-lg bg-slate-950 border border-slate-800 cursor-pointer text-xs">
                    <input
                      type="radio"
                      name="solStatus"
                      checked={solutionStatus === 'verified'}
                      onChange={() => setSolutionStatus('verified')}
                      className="text-emerald-500"
                    />
                    <span className="text-emerald-300 font-bold">Terverifikasi / Selesai</span>
                  </label>
                </div>
              </div>

            </div>

            <div className="p-3.5 bg-slate-950 border-t border-slate-800 flex items-center justify-between">
              <button
                type="button"
                onClick={() => setSolutionModalReport(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs transition cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleSaveSolution}
                className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs flex items-center gap-1.5 shadow-md shadow-amber-500/20 transition cursor-pointer active:scale-95"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Kirim Solusi ke Portal Driver</span>
              </button>
            </div>

          </div>
        </div>
      )}

      {/* Modal Zoom Foto Bukti */}
      {selectedPhotoModal && (
        <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-2xl w-full overflow-hidden shadow-2xl flex flex-col max-h-[92vh]">
            
            <div className="p-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <span>Foto Bukti Laporan: {selectedPhotoModal.areaName}</span>
                </h3>
                <p className="text-[10px] text-slate-400">
                  Supir: {selectedPhotoModal.driverName} [{selectedPhotoModal.plateNumber}] · {new Date(selectedPhotoModal.timestamp).toLocaleString('id-ID')}
                </p>
              </div>
              <button
                onClick={() => setSelectedPhotoModal(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 flex-1 overflow-y-auto flex flex-col items-center justify-center bg-black/40 space-y-3">
              {selectedPhotoModal.photoUrls && selectedPhotoModal.photoUrls.length > 1 ? (
                <div className="w-full space-y-3">
                  <div className="flex items-center justify-between px-1">
                    <span className="text-xs font-black text-amber-400">
                      Total {selectedPhotoModal.photoUrls.length} Foto Bukti Dilampirkan Kru:
                    </span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {selectedPhotoModal.photoUrls.map((url, idx) => (
                      <div key={`modal-photo-${idx}`} className="relative rounded-xl overflow-hidden border border-slate-700 bg-black">
                        <img
                          src={url}
                          alt={`Bukti Laporan #${idx + 1}`}
                          className="max-h-72 w-full object-contain"
                        />
                        <span className="absolute top-2 left-2 px-2 py-0.5 rounded-md bg-blue-600 text-white text-[10px] font-black shadow">
                          Foto #{idx + 1}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : selectedPhotoModal.photoUrl ? (
                <img
                  src={selectedPhotoModal.photoUrl}
                  alt="Bukti Laporan Penuh"
                  className="max-h-[60vh] w-auto max-w-full rounded-xl object-contain border border-slate-800 shadow-2xl"
                />
              ) : (
                <div className="p-12 text-slate-500 text-xs">Foto tidak tersedia</div>
              )}

              {/* EXIF Tag Metadata Kunci untuk Tanggal & Waktu */}
              <div className="w-full mt-2">
                <ExifMetadataBadge
                  exif={
                    selectedPhotoModal.exifMetadata ||
                    createExifMetadataFromDate(new Date(selectedPhotoModal.timestamp), 'CAMERA_CAPTURE_SENSOR')
                  }
                />
              </div>

              <div className="w-full mt-2 bg-slate-950 p-3.5 rounded-xl border border-slate-800 text-xs space-y-1.5 text-left">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-amber-400">Keterangan Kru:</span>
                  {selectedPhotoModal.gmapsUrl && (
                    <a
                      href={selectedPhotoModal.gmapsUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-[10px] font-bold text-blue-400 hover:underline flex items-center gap-1"
                    >
                      <Navigation className="w-3 h-3" />
                      <span>Buka Google Maps</span>
                      <ExternalLink className="w-2.5 h-2.5" />
                    </a>
                  )}
                </div>
                <p className="text-slate-200 leading-relaxed text-xs">
                  {selectedPhotoModal.notes}
                </p>

                {selectedPhotoModal.solution && (
                  <div className="mt-2 pt-2 border-t border-slate-800 text-amber-300">
                    <span className="font-bold">Arahan SPV Logistik:</span>
                    <p className="italic">"{selectedPhotoModal.solution}"</p>
                  </div>
                )}
              </div>
            </div>

            <div className="p-3 bg-slate-950 border-t border-slate-800 flex items-center justify-between">
              <span className="text-[10px] text-slate-500">
                PT Anugrah Kemasan Kreatif · Logistik DC
              </span>
              <button
                onClick={() => setSelectedPhotoModal(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs transition cursor-pointer"
              >
                Tutup
              </button>
            </div>

          </div>
        </div>
      )}

      {/* 🗑️ MODAL KONFIRMASI HAPUS LAPORAN (KHUSUS SUPER ADMIN) */}
      {deleteConfirmTarget && isSuperAdmin && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-slate-900 border border-rose-500/40 rounded-2xl max-w-md w-full overflow-hidden shadow-2xl">
            <div className="p-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-rose-500/20 border border-rose-500/30 flex items-center justify-center text-rose-400 shrink-0">
                  <Trash2 className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-white">
                    Hapus Laporan {deleteConfirmTarget.label}
                  </h3>
                  <p className="text-[10px] font-bold text-rose-400 uppercase tracking-wider">
                    Otorisasi Khusus Super Admin
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setDeleteConfirmTarget(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 space-y-3 text-xs">
              <p className="text-slate-300 leading-relaxed">
                Apakah Anda yakin ingin menghapus data laporan ini secara permanen dari sistem?
              </p>
              <div className="bg-slate-950 border border-slate-800 rounded-xl p-3 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Kru Pengiriman:</span>
                  <span className="font-bold text-white">{deleteConfirmTarget.driverName}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Armada:</span>
                  <span className="font-mono font-bold text-amber-300">{deleteConfirmTarget.plateNumber}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Area / Lokasi:</span>
                  <span className="font-semibold text-slate-200 truncate max-w-[200px]">{deleteConfirmTarget.areaName}</span>
                </div>
              </div>
            </div>

            <div className="p-3.5 bg-slate-950 border-t border-slate-800 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setDeleteConfirmTarget(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs transition cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteReport}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-black text-xs flex items-center gap-1.5 shadow-md shadow-rose-600/20 transition cursor-pointer active:scale-95"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Ya, Hapus Laporan</span>
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
