import React, { useState, useEffect, useMemo } from 'react';
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
  LogOut
} from 'lucide-react';
import { driverReportService, DriverHelperReport, getLocalDateStr } from '../services/driverReportService';
import { driverShiftService } from '../services/driverShiftService';
import { useToast } from '../context/ToastContext';
import { logisticsStore } from '../services/store';
import { FleetChecklistReportView } from './FleetChecklistReportView';
import { CrewAttendanceReportView } from './CrewAttendanceReportView';

export type DateFilterMode = 'single_date' | 'this_week' | 'this_month' | 'all';

export const DriverReportsManagement: React.FC = () => {
  const { addNotification } = useToast();
  const currentUser = logisticsStore.getCurrentUser();

  // Role authorization: Status & Solutions can only be accessed/managed by SPV Logistik and Super Admin
  const isAuthorizedSpvOrAdmin = useMemo(() => {
    const r = (currentUser?.role || '').toLowerCase();
    const name = (currentUser?.fullName || '').toLowerCase();
    return (
      r === 'super_admin' ||
      r === 'spv_logistik' ||
      r === 'admin' ||
      name.includes('spv') ||
      name.includes('supervisor') ||
      name.includes('bayu') ||
      name.includes('bahri')
    );
  }, [currentUser]);

  // Sub-menu switcher: Laporan Kendala Lapangan | Laporan Absen Tim Kiriman | Laporan Check-In & Check-Out | Laporan Pengisian BBM (Solar) | Laporan Checklist Armada | Laporan Peringatan Mode Offline
  const [activeSubMenu, setActiveSubMenu] = useState<'operasional' | 'absen_tim_kiriman' | 'checkin_checkout' | 'pengisian_bbm' | 'checklist_armada' | 'peringatan_offline'>('operasional');
  const [offlineStatusFilter, setOfflineStatusFilter] = useState<'all' | 'masih_offline' | 'sudah_online'>('all');
  const [offlineSearchQuery, setOfflineSearchQuery] = useState<string>('');
  const [checkinSearchQuery, setCheckinSearchQuery] = useState<string>('');
  const [fuelSearchQuery, setFuelSearchQuery] = useState<string>('');
  const [fuelLocationFilter, setFuelLocationFilter] = useState<'all' | 'Farly' | 'Gajah Mada'>('all');

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

  // Notifikasi Perubahan Jadwal (Hanya muncul di Laporan Kiriman Kru)
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
  >(() => {
    try {
      const raw = localStorage.getItem('akk_schedule_change_notifs_v1');
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });

  const loadReports = () => {
    setReports(driverReportService.getReports());
    try {
      const raw = localStorage.getItem('akk_schedule_change_notifs_v1');
      setScheduleChangeNotifs(raw ? JSON.parse(raw) : []);
    } catch {}
  };

  useEffect(() => {
    loadReports();

    const handleReportUpdate = () => {
      loadReports();
    };

    const handleScheduleRealtime = () => {
      try {
        const raw = localStorage.getItem('akk_schedule_change_notifs_v1');
        setScheduleChangeNotifs(raw ? JSON.parse(raw) : []);
      } catch {}
    };

    window.addEventListener('driver-report-updated', handleReportUpdate);
    window.addEventListener('akk-driver-schedule-realtime', handleScheduleRealtime);
    return () => {
      window.removeEventListener('driver-report-updated', handleReportUpdate);
      window.removeEventListener('akk-driver-schedule-realtime', handleScheduleRealtime);
    };
  }, []);

  // Hanya laporan Kendala (kendala_jalan) agar tidak tercampur dengan absen kiriman, check-in/out, pengisian BBM, dll.
  const kendalaOnlyReports = useMemo(() => {
    return reports.filter(r => r.category === 'kendala_jalan');
  }, [reports]);

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

  const filteredOfflineReports = useMemo(() => {
    return offlineModeReports.filter(rep => {
      if (offlineStatusFilter !== 'all' && rep.offlineStatus !== offlineStatusFilter) return false;
      if (offlineSearchQuery.trim()) {
        const q = offlineSearchQuery.toLowerCase();
        const matchDriver = rep.driverName.toLowerCase().includes(q);
        const matchPlate = rep.plateNumber.toLowerCase().includes(q);
        const matchArea = rep.areaName.toLowerCase().includes(q);
        const matchHelper = (rep.helperName || '').toLowerCase().includes(q);
        return matchDriver || matchPlate || matchArea || matchHelper;
      }
      return true;
    });
  }, [offlineModeReports, offlineStatusFilter, offlineSearchQuery]);

  // Data Laporan Check-In & Check-Out Terpadu
  const checkinCheckoutList = useMemo(() => {
    const shiftRecords = driverShiftService.getShifts();
    const reportShiftRecords = reports.filter(r => r.category === 'presensi_shift');
    const combinedMap = new Map<string, {
      id: string;
      date: string;
      driverName: string;
      userRole: string;
      plateNumber: string;
      areaName: string;
      checkinTime: string;
      checkoutTime: string;
      status: 'sedang_bertugas' | 'selesai_shift';
      notes: string;
    }>();

    reportShiftRecords.forEach(r => {
      const key = r.shiftId || `${r.driverName.toLowerCase()}-${r.date || getLocalDateStr(r.timestamp)}`;
      combinedMap.set(key, {
        id: r.id,
        date: r.date || getLocalDateStr(r.timestamp),
        driverName: r.driverName,
        userRole: r.userRole || 'Driver',
        plateNumber: r.plateNumber || '-',
        areaName: r.areaName || 'Operasional DC',
        checkinTime: r.checkinTimeFormatted || new Date(r.timestamp).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) + ' WIB',
        checkoutTime: r.checkoutTimeFormatted || '-',
        status: r.checkoutTimeFormatted ? 'selesai_shift' : 'sedang_bertugas',
        notes: r.notes
      });
    });

    shiftRecords.forEach(s => {
      const key = s.id || `${s.driverName.toLowerCase()}-${s.date}`;
      const existing = combinedMap.get(key);
      if (existing) {
        if (!existing.checkoutTime || existing.checkoutTime === '-') {
          if (s.checkoutTimeFormatted) {
            existing.checkoutTime = s.checkoutTimeFormatted;
            existing.status = 'selesai_shift';
          }
        }
      } else {
        combinedMap.set(key, {
          id: s.id,
          date: s.date,
          driverName: s.driverName,
          userRole: 'Driver',
          plateNumber: s.plateNumber || '-',
          areaName: s.locationName || 'DC Banyuwangi',
          checkinTime: s.checkinTimeFormatted || '-',
          checkoutTime: s.checkoutTimeFormatted || '-',
          status: s.status === 'checked_out' || Boolean(s.checkoutTimeFormatted) ? 'selesai_shift' : 'sedang_bertugas',
          notes: s.notes || 'Presensi Shift Operasional'
        });
      }
    });

    const list = Array.from(combinedMap.values()).sort((a, b) => b.date.localeCompare(a.date));
    if (!checkinSearchQuery.trim()) return list;
    const q = checkinSearchQuery.toLowerCase().trim();
    return list.filter(item =>
      item.driverName.toLowerCase().includes(q) ||
      item.plateNumber.toLowerCase().includes(q) ||
      item.areaName.toLowerCase().includes(q) ||
      item.date.includes(q)
    );
  }, [reports, checkinSearchQuery]);

  // Data Laporan Pengisian BBM (Solar)
  const fuelReportsList = useMemo(() => {
    const raw = reports.filter(r =>
      r.category === 'isi_bbm' ||
      r.notes.toLowerCase().includes('isi bbm') ||
      r.notes.toLowerCase().includes('pengisian bbm')
    );
    return raw.filter(r => {
      const resolvedLoc = r.fuelLocation || (r.notes.toLowerCase().includes('gajah mada') || r.areaName.toLowerCase().includes('gajah mada') ? 'Gajah Mada' : 'Farly');
      if (fuelLocationFilter !== 'all' && resolvedLoc !== fuelLocationFilter) return false;
      if (fuelSearchQuery.trim()) {
        const q = fuelSearchQuery.toLowerCase().trim();
        return (
          r.driverName.toLowerCase().includes(q) ||
          r.plateNumber.toLowerCase().includes(q) ||
          resolvedLoc.toLowerCase().includes(q) ||
          r.notes.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [reports, fuelLocationFilter, fuelSearchQuery]);

  const totalFuelReportsCount = useMemo(() => {
    return reports.filter(r =>
      r.category === 'isi_bbm' ||
      r.notes.toLowerCase().includes('isi bbm') ||
      r.notes.toLowerCase().includes('pengisian bbm')
    ).length;
  }, [reports]);

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6 animate-in fade-in duration-200">
      
      {/* 🌟 SUB-MENU SELECTOR: Laporan & Kendala Lapangan | Laporan Absen Tim Kiriman | Laporan Check-In & Check-Out | Laporan Pengisian BBM (Solar) | Laporan Checklist Armada | Laporan Peringatan Mode Offline */}
      <div className="flex flex-wrap items-center justify-between gap-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-2 rounded-2xl shadow-xs">
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setActiveSubMenu('operasional')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
              activeSubMenu === 'operasional'
                ? 'bg-blue-600 text-white font-black shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/60'
            }`}
          >
            <AlertTriangle className="w-4 h-4" />
            <span>Laporan Kendala Lapangan</span>
            <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${activeSubMenu === 'operasional' ? 'bg-white/20 text-white font-bold' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'}`}>
              {totalCount}
            </span>
          </button>

          <button
            onClick={() => setActiveSubMenu('absen_tim_kiriman')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
              activeSubMenu === 'absen_tim_kiriman'
                ? 'bg-blue-600 text-white font-black shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/60'
            }`}
          >
            <UserCheck className="w-4 h-4" />
            <span>Laporan Absen Tim Kiriman</span>
            <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${activeSubMenu === 'absen_tim_kiriman' ? 'bg-white/20 text-white font-bold' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'}`}>
              {absenTimKirimanCount}
            </span>
          </button>

          <button
            onClick={() => setActiveSubMenu('checkin_checkout')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
              activeSubMenu === 'checkin_checkout'
                ? 'bg-blue-600 text-white font-black shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/60'
            }`}
          >
            <Clock className="w-4 h-4" />
            <span>Laporan Check-In &amp; Check-Out</span>
            <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${activeSubMenu === 'checkin_checkout' ? 'bg-white/20 text-white font-bold' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'}`}>
              {checkinCheckoutList.length}
            </span>
          </button>

          <button
            onClick={() => setActiveSubMenu('pengisian_bbm')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
              activeSubMenu === 'pengisian_bbm'
                ? 'bg-blue-600 text-white font-black shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/60'
            }`}
          >
            <Fuel className="w-4 h-4" />
            <span>Laporan Pengisian BBM (Solar)</span>
            <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${activeSubMenu === 'pengisian_bbm' ? 'bg-white/20 text-white font-bold' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'}`}>
              {totalFuelReportsCount}
            </span>
          </button>

          <button
            onClick={() => setActiveSubMenu('checklist_armada')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
              activeSubMenu === 'checklist_armada'
                ? 'bg-blue-600 text-white font-black shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/60'
            }`}
          >
            <ShieldCheck className="w-4 h-4" />
            <span>Laporan Checklist Armada</span>
          </button>

          {/* Di sebelah Laporan Checklist Armada: Laporan Peringatan Mode Offline */}
          <button
            onClick={() => setActiveSubMenu('peringatan_offline')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
              activeSubMenu === 'peringatan_offline'
                ? 'bg-blue-600 text-white font-black shadow-sm'
                : activeOfflineCrewReports.length > 0
                ? 'bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-300 border border-rose-300 dark:border-rose-500/40 hover:bg-rose-100 dark:hover:bg-rose-950/70'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/60'
            }`}
          >
            {activeOfflineCrewReports.length > 0 ? (
              <WifiOff className="w-4 h-4" />
            ) : (
              <Wifi className="w-4 h-4" />
            )}
            <span>Laporan Peringatan Mode Offline</span>
            <span
              className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                activeSubMenu === 'peringatan_offline'
                  ? 'bg-white/20 text-white font-bold'
                  : activeOfflineCrewReports.length > 0
                  ? 'bg-rose-600 text-white font-black'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
              }`}
            >
              {activeOfflineCrewReports.length > 0 ? activeOfflineCrewReports.length : offlineModeReports.length}
            </span>
          </button>
        </div>

        {/* Security Role Access Badge */}
        <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-[11px]">
          {isAuthorizedSpvOrAdmin ? (
            <div className="flex items-center gap-1.5 text-blue-600 dark:text-blue-400 font-bold">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Otorisasi SPV Logistik / Super Admin Aktif</span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-400">
              <Lock className="w-3.5 h-3.5" />
              <span>Mode Lihat (Akses Status Khusus SPV/Admin)</span>
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
        /* 🕒 SUB-MENU BARU 1: LAPORAN CHECK-IN & CHECK-OUT KRU PENGIRIMAN */
        <div className="space-y-5 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-start sm:items-center gap-3.5">
              <div className="w-12 h-12 rounded-2xl bg-blue-50 dark:bg-blue-500/15 border border-blue-200 dark:border-blue-500/30 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
                <Clock className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-white tracking-tight">
                    Laporan Check-In &amp; Check-Out Kru Pengiriman
                  </h2>
                  <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-blue-100 dark:bg-blue-500/20 text-blue-800 dark:text-blue-300 border border-blue-300 dark:border-blue-500/30">
                    Presensi Shift Terpadu
                  </span>
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                  Rekapitulasi jam masuk (Check-In) dan jam selesai bertugas (Check-Out) tim Driver &amp; Helper dari Portal Driver.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={loadReports}
                className="px-3.5 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold flex items-center gap-1.5 border border-slate-200 dark:border-slate-700 cursor-pointer transition"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Segarkan</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  if (checkinCheckoutList.length === 0) return;
                  const headers = ['Tanggal', 'Nama Kru', 'Peran', 'Armada', 'Area / Lokasi', 'Waktu Check-In', 'Waktu Check-Out', 'Status Shift'];
                  const rows = checkinCheckoutList.map(item => [
                    item.date,
                    `"${item.driverName}"`,
                    item.userRole,
                    item.plateNumber,
                    `"${item.areaName}"`,
                    item.checkinTime,
                    item.checkoutTime,
                    item.status === 'selesai_shift' ? 'Sudah Check-Out' : 'Sedang Bertugas (Check-In)'
                  ]);
                  const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
                  const link = document.createElement('a');
                  link.setAttribute('href', encodeURI(csvContent));
                  link.setAttribute('download', `Laporan_CheckIn_CheckOut_Kru_${getLocalDateStr()}.csv`);
                  document.body.appendChild(link);
                  link.click();
                  document.body.removeChild(link);
                }}
                className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer transition shadow-xs"
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                <span>Ekspor Excel</span>
              </button>
            </div>
          </div>

          {/* 3 Summary KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-xs flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-slate-500 dark:text-slate-400 block">
                  Total Presensi Shift
                </span>
                <div className="text-2xl font-black text-slate-900 dark:text-white font-mono mt-1">
                  {checkinCheckoutList.length}
                </div>
                <span className="text-[11px] text-slate-500 dark:text-slate-400">
                  Total log Check-In &amp; Check-Out
                </span>
              </div>
              <div className="w-11 h-11 rounded-2xl bg-blue-50 dark:bg-blue-500/15 flex items-center justify-center text-blue-600 dark:text-blue-400">
                <Clock className="w-5 h-5" />
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-xs flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-amber-600 dark:text-amber-400 block">
                  Sedang Bertugas (Check-In Aktif)
                </span>
                <div className="text-2xl font-black text-amber-600 dark:text-amber-400 font-mono mt-1">
                  {checkinCheckoutList.filter(i => i.status === 'sedang_bertugas').length}
                </div>
                <span className="text-[11px] text-slate-500 dark:text-slate-400">
                  Sudah Check-In, belum Check-Out
                </span>
              </div>
              <div className="w-11 h-11 rounded-2xl bg-amber-50 dark:bg-amber-500/15 flex items-center justify-center text-amber-600 dark:text-amber-400">
                <LogIn className="w-5 h-5" />
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-xs flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-emerald-700 dark:text-emerald-400 block">
                  Selesai Shift (Sudah Check-Out)
                </span>
                <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400 font-mono mt-1">
                  {checkinCheckoutList.filter(i => i.status === 'selesai_shift').length}
                </div>
                <span className="text-[11px] text-slate-500 dark:text-slate-400">
                  Check-In &amp; Check-Out lengkap
                </span>
              </div>
              <div className="w-11 h-11 rounded-2xl bg-emerald-50 dark:bg-emerald-500/15 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                <LogOut className="w-5 h-5" />
              </div>
            </div>
          </div>

          {/* Search Bar */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-xs">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={checkinSearchQuery}
                onChange={(e) => setCheckinSearchQuery(e.target.value)}
                placeholder="Cari nama driver/helper, plat nomor armada, atau tanggal (YYYY-MM-DD)..."
                className="w-full pl-10 pr-4 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          {/* Table */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    <th className="py-3 px-4 w-12 text-center">#</th>
                    <th className="py-3 px-4">Tanggal</th>
                    <th className="py-3 px-4">Nama Kru &amp; Peran</th>
                    <th className="py-3 px-4">Nomor Kendaraan</th>
                    <th className="py-3 px-4">Area / Lokasi</th>
                    <th className="py-3 px-4 text-center">Waktu Check-In</th>
                    <th className="py-3 px-4 text-center">Waktu Check-Out</th>
                    <th className="py-3 px-4 text-center">Status Shift</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                  {checkinCheckoutList.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-10 text-center text-slate-500">
                        Belum ada data laporan Check-In &amp; Check-Out kru pengiriman.
                      </td>
                    </tr>
                  ) : (
                    checkinCheckoutList.map((item, idx) => (
                      <tr key={item.id || idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition">
                        <td className="py-3 px-4 text-center font-mono text-slate-500 font-bold">{idx + 1}</td>
                        <td className="py-3 px-4 font-mono font-bold text-slate-900 dark:text-white whitespace-nowrap">
                          {item.date}
                        </td>
                        <td className="py-3 px-4">
                          <div className="font-bold text-slate-900 dark:text-white">{item.driverName}</div>
                          <div className="text-[10px] text-slate-500">{item.userRole}</div>
                        </td>
                        <td className="py-3 px-4">
                          <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 font-mono font-bold text-slate-800 dark:text-slate-200">
                            {item.plateNumber}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-slate-700 dark:text-slate-300">{item.areaName}</td>
                        <td className="py-3 px-4 text-center">
                          <span className="px-2.5 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-500/30 font-mono font-bold text-[11px]">
                            {item.checkinTime}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-center">
                          {item.checkoutTime && item.checkoutTime !== '-' ? (
                            <span className="px-2.5 py-1 rounded-lg bg-blue-50 dark:bg-blue-500/15 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-500/30 font-mono font-bold text-[11px]">
                              {item.checkoutTime}
                            </span>
                          ) : (
                            <span className="text-slate-400 italic text-[11px]">Belum Check-Out</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-center">
                          {item.status === 'selesai_shift' ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-100 dark:bg-emerald-500/20 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-500/30">
                              <CheckCircle2 className="w-3 h-3" /> Selesai Shift
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-100 dark:bg-amber-500/20 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-500/30">
                              <Clock className="w-3 h-3" /> Sedang Bertugas
                            </span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : activeSubMenu === 'pengisian_bbm' ? (
        /* ⛽ SUB-MENU BARU 2: LAPORAN PENGISIAN BBM (SOLAR) DI FARLY / GAJAH MADA */
        <div className="space-y-5 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-start sm:items-center gap-3.5">
              <div className="w-12 h-12 rounded-2xl bg-amber-50 dark:bg-amber-500/15 border border-amber-200 dark:border-amber-500/30 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                <Fuel className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-white tracking-tight">
                    Laporan Pengisian BBM (Solar) Armada
                  </h2>
                  <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 dark:bg-amber-500/20 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-500/30">
                    Lokasi: Farly &amp; Gajah Mada
                  </span>
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                  Dokumentasi pengisian BBM (Solar) armada beserta foto bukti berstempel dan lokasi SPBU (Farly / Gajah Mada).
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={loadReports}
                className="px-3.5 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold flex items-center gap-1.5 border border-slate-200 dark:border-slate-700 cursor-pointer transition"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Segarkan</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  if (fuelReportsList.length === 0) return;
                  const headers = ['Tanggal', 'Waktu', 'Nama Driver', 'Nomor Kendaraan', 'Lokasi SPBU', 'Status'];
                  const rows = fuelReportsList.map(r => {
                    const loc = r.fuelLocation || (r.notes.toLowerCase().includes('gajah mada') ? 'Gajah Mada' : 'Farly');
                    return [
                      r.date || getLocalDateStr(r.timestamp),
                      new Date(r.timestamp).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
                      `"${r.driverName}"`,
                      r.plateNumber,
                      `"SPBU ${loc}"`,
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
                className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer transition shadow-xs"
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                <span>Ekspor Excel</span>
              </button>
            </div>
          </div>

          {/* 3 Summary KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-xs flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-slate-500 dark:text-slate-400 block">
                  Total Laporan Isi BBM (Solar)
                </span>
                <div className="text-2xl font-black text-slate-900 dark:text-white font-mono mt-1">
                  {totalFuelReportsCount}
                </div>
                <span className="text-[11px] text-slate-500 dark:text-slate-400">
                  Total dokumentasi masuk
                </span>
              </div>
              <div className="w-11 h-11 rounded-2xl bg-amber-50 dark:bg-amber-500/15 flex items-center justify-center text-amber-600 dark:text-amber-400">
                <Fuel className="w-5 h-5" />
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-xs flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-amber-600 dark:text-amber-400 block">
                  Lokasi: Farly
                </span>
                <div className="text-2xl font-black text-amber-600 dark:text-amber-400 font-mono mt-1">
                  {reports.filter(r => r.category === 'isi_bbm' && (r.fuelLocation === 'Farly' || (!r.fuelLocation && !r.notes.toLowerCase().includes('gajah mada')))).length}
                </div>
                <span className="text-[11px] text-slate-500 dark:text-slate-400">
                  Pengisian Solar di SPBU Farly
                </span>
              </div>
              <div className="w-11 h-11 rounded-2xl bg-amber-50 dark:bg-amber-500/15 flex items-center justify-center text-amber-600 dark:text-amber-400">
                <MapPin className="w-5 h-5" />
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-xs flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-blue-600 dark:text-blue-400 block">
                  Lokasi: Gajah Mada
                </span>
                <div className="text-2xl font-black text-blue-600 dark:text-blue-400 font-mono mt-1">
                  {reports.filter(r => r.category === 'isi_bbm' && (r.fuelLocation === 'Gajah Mada' || r.notes.toLowerCase().includes('gajah mada'))).length}
                </div>
                <span className="text-[11px] text-slate-500 dark:text-slate-400">
                  Pengisian Solar di SPBU Gajah Mada
                </span>
              </div>
              <div className="w-11 h-11 rounded-2xl bg-blue-50 dark:bg-blue-500/15 flex items-center justify-center text-blue-600 dark:text-blue-400">
                <MapPin className="w-5 h-5" />
              </div>
            </div>
          </div>

          {/* Filter & Search Bar */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-xs flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={fuelSearchQuery}
                onChange={(e) => setFuelSearchQuery(e.target.value)}
                placeholder="Cari nama supir, plat nomor armada, atau lokasi SPBU (Farly / Gajah Mada)..."
                className="w-full pl-10 pr-4 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-amber-500"
              />
            </div>
            <div className="flex items-center gap-1.5">
              {(['all', 'Farly', 'Gajah Mada'] as const).map(loc => (
                <button
                  key={loc}
                  type="button"
                  onClick={() => setFuelLocationFilter(loc)}
                  className={`px-3 py-2 rounded-xl text-xs font-bold border transition cursor-pointer ${
                    fuelLocationFilter === loc
                      ? 'bg-amber-600 text-white border-amber-500'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                  }`}
                >
                  {loc === 'all' ? 'Semua Lokasi' : `SPBU ${loc}`}
                </button>
              ))}
            </div>
          </div>

          {/* Table */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    <th className="py-3 px-4 w-12 text-center">#</th>
                    <th className="py-3 px-4">Tanggal &amp; Waktu</th>
                    <th className="py-3 px-4">Driver / Kru</th>
                    <th className="py-3 px-4">Nomor Kendaraan</th>
                    <th className="py-3 px-4">Lokasi BBM (Solar)</th>
                    <th className="py-3 px-4 text-center">Foto Bukti</th>
                    <th className="py-3 px-4 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                  {fuelReportsList.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-10 text-center text-slate-500">
                        Belum ada laporan pengisian BBM (Solar) di lokasi Farly maupun Gajah Mada.
                      </td>
                    </tr>
                  ) : (
                    fuelReportsList.map((rep, idx) => {
                      const loc = rep.fuelLocation || (rep.notes.toLowerCase().includes('gajah mada') ? 'Gajah Mada' : 'Farly');
                      return (
                        <tr key={rep.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition">
                          <td className="py-3 px-4 text-center font-mono text-slate-500 font-bold">{idx + 1}</td>
                          <td className="py-3 px-4 whitespace-nowrap">
                            <div className="font-mono font-bold text-slate-900 dark:text-white">
                              {rep.date || getLocalDateStr(rep.timestamp)}
                            </div>
                            <div className="text-[10px] text-slate-500 font-mono">
                              {new Date(rep.timestamp).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })} WIB
                            </div>
                          </td>
                          <td className="py-3 px-4 font-bold text-slate-900 dark:text-white">
                            {rep.driverName}
                          </td>
                          <td className="py-3 px-4">
                            <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 font-mono font-bold text-slate-800 dark:text-slate-200">
                              {rep.plateNumber}
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold border ${
                              loc === 'Gajah Mada'
                                ? 'bg-blue-50 dark:bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-500/30'
                                : 'bg-amber-50 dark:bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-500/30'
                            }`}>
                              <MapPin className="w-3 h-3" />
                              <span>SPBU {loc}</span>
                            </span>
                          </td>
                          <td className="py-3 px-4 text-center">
                            {rep.photoUrl ? (
                              <button
                                type="button"
                                onClick={() => setSelectedPhotoModal(rep)}
                                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-blue-50 dark:bg-blue-500/15 hover:bg-blue-100 dark:hover:bg-blue-500/25 text-blue-600 dark:text-blue-300 border border-blue-200 dark:border-blue-500/30 text-[11px] font-bold cursor-pointer transition"
                              >
                                <Camera className="w-3.5 h-3.5" />
                                <span>Lihat Foto</span>
                              </button>
                            ) : (
                              <span className="text-slate-400 text-[11px]">-</span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-center">
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-100 dark:bg-emerald-500/20 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-500/30">
                              <CheckCircle2 className="w-3 h-3" /> Tercatat
                            </span>
                          </td>
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
        /* 🚨 DESAIN BARU UI/UX: LAPORAN PERINGATAN AKTIVASI MODE OFFLINE TIM PENGIRIMAN */
        <div className="space-y-5 animate-in fade-in duration-200">
          {/* Top Hero Card */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-start sm:items-center gap-3.5">
              <div
                className={`w-12 h-12 rounded-2xl flex items-center justify-center border shrink-0 shadow-xs ${
                  activeOfflineCrewReports.length > 0
                    ? 'bg-rose-50 dark:bg-rose-500/15 border-rose-200 dark:border-rose-500/30 text-rose-600 dark:text-rose-400'
                    : 'bg-emerald-50 dark:bg-emerald-500/15 border-emerald-200 dark:border-emerald-500/30 text-emerald-600 dark:text-emerald-400'
                }`}
              >
                {activeOfflineCrewReports.length > 0 ? (
                  <WifiOff className="w-6 h-6 animate-pulse" />
                ) : (
                  <Wifi className="w-6 h-6" />
                )}
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-white tracking-tight">
                    Laporan Peringatan Aktivasi Mode Offline Tim Pengiriman
                  </h2>
                  {activeOfflineCrewReports.length > 0 ? (
                    <span className="px-2.5 py-0.5 rounded-full text-[11px] font-black bg-rose-600 text-white animate-pulse">
                      ⚠️ {activeOfflineCrewReports.length} Kru Masih Offline
                    </span>
                  ) : (
                    <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 dark:bg-emerald-500/20 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-500/30">
                      ✓ Semua Kru Online
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                  Memantau siapa saja driver/helper yang mengaktifkan Mode Offline agar menjadi peringatan bagi Tim Pengiriman untuk segera di-online-kan kembali.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={loadReports}
                className="px-3.5 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold flex items-center gap-1.5 border border-slate-200 dark:border-slate-700 cursor-pointer transition"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Segarkan Data</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveSubMenu('operasional')}
                className="px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer transition shadow-xs"
              >
                <MapPin className="w-3.5 h-3.5" />
                <span>Ke Kalender Kendala</span>
              </button>
            </div>
          </div>

          {/* 3 Summary KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-xs flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-slate-500 dark:text-slate-400 block">
                  Total Riwayat Aktivasi Offline
                </span>
                <div className="text-2xl font-black text-slate-900 dark:text-white font-mono mt-1">
                  {offlineModeReports.length}
                </div>
                <span className="text-[11px] text-slate-500 dark:text-slate-400">
                  Log tercatat di sistem pengiriman
                </span>
              </div>
              <div className="w-11 h-11 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-300">
                <Layers className="w-5 h-5" />
              </div>
            </div>

            <div
              className={`rounded-2xl p-4 shadow-xs flex items-center justify-between border ${
                activeOfflineCrewReports.length > 0
                  ? 'bg-rose-50 dark:bg-rose-950/30 border-rose-300 dark:border-rose-500/50'
                  : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800'
              }`}
            >
              <div>
                <span className="text-xs font-bold text-rose-700 dark:text-rose-300 block">
                  Kru Masih Mode Offline (Aktif)
                </span>
                <div className="text-2xl font-black text-rose-600 dark:text-rose-400 font-mono mt-1">
                  {activeOfflineCrewReports.length}
                </div>
                <span className="text-[11px] text-rose-600/80 dark:text-rose-300/80 font-semibold">
                  {activeOfflineCrewReports.length > 0
                    ? 'Wajib segera di-online-kan kembali!'
                    : 'Tidak ada kru yang sedang offline'}
                </span>
              </div>
              <div className="w-11 h-11 rounded-2xl bg-rose-100 dark:bg-rose-500/20 flex items-center justify-center text-rose-600 dark:text-rose-400">
                <WifiOff className="w-5 h-5" />
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-xs flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-emerald-700 dark:text-emerald-300 block">
                  Sudah Kembali Online
                </span>
                <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400 font-mono mt-1">
                  {offlineModeReports.filter(r => r.offlineStatus === 'sudah_online').length}
                </div>
                <span className="text-[11px] text-slate-500 dark:text-slate-400">
                  Sinkronisasi perangkat pulih normal
                </span>
              </div>
              <div className="w-11 h-11 rounded-2xl bg-emerald-50 dark:bg-emerald-500/15 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                <Wifi className="w-5 h-5" />
              </div>
            </div>
          </div>

          {/* Search & Status Filter Bar */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-xs flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={offlineSearchQuery}
                onChange={(e) => setOfflineSearchQuery(e.target.value)}
                placeholder="Cari nama supir, helper, plat armada, atau area kirim..."
                className="w-full pl-10 pr-4 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-rose-500"
              />
            </div>
            <div className="flex items-center gap-1.5 flex-wrap">
              {[
                { key: 'all', label: `Semua (${offlineModeReports.length})` },
                { key: 'masih_offline', label: `Masih Offline (${activeOfflineCrewReports.length})` },
                {
                  key: 'sudah_online',
                  label: `Sudah Online (${offlineModeReports.filter(r => r.offlineStatus === 'sudah_online').length})`
                }
              ].map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setOfflineStatusFilter(tab.key as any)}
                  className={`px-3 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
                    offlineStatusFilter === tab.key
                      ? 'bg-slate-900 dark:bg-blue-600 text-white shadow-xs'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* List of Offline Mode Reports */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-xs">
            {filteredOfflineReports.length === 0 ? (
              <div className="p-10 text-center space-y-3">
                <div className="w-12 h-12 rounded-2xl bg-emerald-50 dark:bg-emerald-500/15 border border-emerald-200 dark:border-emerald-500/30 flex items-center justify-center text-emerald-600 dark:text-emerald-400 mx-auto">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <div className="text-sm font-black text-slate-900 dark:text-white">
                  Semua Perangkat Kru Pengiriman Dalam Kondisi Online
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto leading-relaxed">
                  Saat ini belum ada kru pengiriman yang mengaktifkan Mode Offline. Jika ada kru yang menekan tombol <strong>Mode Offline</strong> di Portal Driver, datanya akan langsung muncul di halaman ini sebagai peringatan.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-slate-200 dark:divide-slate-800">
                {filteredOfflineReports.map((rep) => {
                  const isStillOffline = rep.offlineStatus === 'masih_offline';
                  return (
                    <div
                      key={rep.id}
                      className={`p-4 sm:p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4 transition ${
                        isStillOffline
                          ? 'bg-rose-50/60 dark:bg-rose-950/25'
                          : 'hover:bg-slate-50 dark:hover:bg-slate-800/40'
                      }`}
                    >
                      <div className="flex items-start gap-3.5 min-w-0">
                        <div
                          className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border mt-0.5 ${
                            isStillOffline
                              ? 'bg-rose-100 dark:bg-rose-500/20 border-rose-300 dark:border-rose-500/40 text-rose-600 dark:text-rose-400'
                              : 'bg-emerald-100 dark:bg-emerald-500/20 border-emerald-300 dark:border-emerald-500/40 text-emerald-600 dark:text-emerald-400'
                          }`}
                        >
                          {isStillOffline ? (
                            <WifiOff className="w-5 h-5 animate-pulse" />
                          ) : (
                            <Wifi className="w-5 h-5" />
                          )}
                        </div>

                        <div className="space-y-1.5 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-black text-slate-900 dark:text-white text-sm">
                              {rep.driverName}
                            </span>
                            <span className="px-2 py-0.5 rounded-md text-[10px] font-mono font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-amber-300 border border-slate-200 dark:border-slate-700">
                              {rep.userRole || 'Driver'} • {rep.plateNumber}
                            </span>
                            {rep.helperName && (
                              <span className="text-xs text-slate-600 dark:text-slate-300">
                                Helper: <strong>{rep.helperName}</strong>
                              </span>
                            )}
                            {isStillOffline ? (
                              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-rose-600 text-white animate-pulse">
                                ⚠️ MASIH OFFLINE
                              </span>
                            ) : (
                              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 dark:bg-emerald-500/20 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-500/40">
                                ✓ SUDAH ONLINE
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-3 flex-wrap text-xs text-slate-600 dark:text-slate-300">
                            <span>
                              Area Kirim: <strong className="text-slate-900 dark:text-white">{rep.areaName}</strong>
                            </span>
                            <span className="text-slate-300 dark:text-slate-700">•</span>
                            <span className="font-mono text-[11px]">
                              Waktu Offline:{' '}
                              <strong className="text-rose-600 dark:text-rose-400">
                                {rep.offlineActivatedAt ||
                                  new Date(rep.timestamp).toLocaleTimeString('id-ID', {
                                    hour: '2-digit',
                                    minute: '2-digit'
                                  }) + ' WIB'}
                              </strong>
                            </span>
                            {rep.onlineRestoredAt && (
                              <>
                                <span className="text-slate-300 dark:text-slate-700">•</span>
                                <span className="font-mono text-[11px]">
                                  Kembali Online:{' '}
                                  <strong className="text-emerald-600 dark:text-emerald-400">
                                    {rep.onlineRestoredAt}
                                  </strong>
                                </span>
                              </>
                            )}
                          </div>

                          <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                            {rep.notes}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0 self-end lg:self-center">
                        {isStillOffline ? (
                          <>
                            <button
                              type="button"
                              onClick={() => handleSendOfflineWarningToPortal(rep)}
                              className="px-3 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs flex items-center gap-1.5 cursor-pointer transition shadow-xs active:scale-95"
                            >
                              <Send className="w-3.5 h-3.5" />
                              <span>Kirim Peringatan</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleForceOnlineCrew(rep)}
                              className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs flex items-center gap-1.5 cursor-pointer transition shadow-xs active:scale-95"
                            >
                              <Wifi className="w-3.5 h-3.5" />
                              <span>Onlinekan Sekarang</span>
                            </button>
                          </>
                        ) : (
                          <div className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-xs font-semibold flex items-center gap-1.5">
                            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                            <span>Dipulihkan oleh {rep.verifiedBy || 'Tim Pengiriman'}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      ) : (
        <>
          {/* Header Section - Compact & Dense */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-2.5 bg-slate-900 border border-slate-800 px-4 py-3 rounded-xl shadow-xs">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-lg bg-gradient-to-tr from-rose-500/20 to-amber-500/20 border border-rose-500/30 flex items-center justify-center text-rose-400 shrink-0 shadow-inner">
                <MapPin className="w-4 h-4" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="text-sm sm:text-base font-black text-white tracking-tight">
                    Laporan &amp; Kendala Kiriman Kru
                  </h1>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/30 font-bold">
                    Tersambung ke Portal Driver
                  </span>
                </div>
                <p className="text-[11px] text-slate-400">
                  Rincian kalender pertanggal, pemantauan kendala jalan, dan penyampaian solusi langsung dari SPV Logistik ke ponsel kru pengiriman
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={loadReports}
                className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition cursor-pointer border border-slate-700 shadow-2xs"
                title="Muat Ulang Data"
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </button>

              <button
                onClick={handleExportCsv}
                className="px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-1.5 transition cursor-pointer shadow-sm active:scale-95"
                title="Unduh laporan dalam format CSV / Excel"
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                <span>Ekspor Excel</span>
              </button>
            </div>
          </div>

          {/* 🔔 NOTIFIKASI PERUBAHAN JADWAL PENGIRIMAN */}
          {scheduleChangeNotifs.length > 0 && (
            <div className="bg-emerald-950/50 border border-emerald-500/40 rounded-xl p-3 space-y-2 shadow-xs">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 text-xs font-black text-emerald-300">
                  <RefreshCw className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Notifikasi Perubahan Jadwal Pengiriman ({scheduleChangeNotifs.length})</span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setScheduleChangeNotifs([]);
                    try {
                      localStorage.removeItem('akk_schedule_change_notifs_v1');
                    } catch {}
                  }}
                  className="px-2 py-0.5 rounded-md bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white text-[10px] font-bold border border-slate-700 cursor-pointer"
                >
                  Bersihkan Notifikasi
                </button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-1.5 max-h-32 overflow-y-auto pr-1">
                {scheduleChangeNotifs.slice(0, 6).map(notif => (
                  <div
                    key={notif.id}
                    className="p-2 rounded-lg bg-slate-950/90 border border-emerald-500/30 text-xs flex items-start justify-between gap-2"
                  >
                    <div className="min-w-0">
                      <div className="font-bold text-emerald-300 text-[11px] truncate">{notif.title}</div>
                      <p className="text-[10px] text-slate-300 mt-0.5 leading-snug">{notif.message}</p>
                    </div>
                    <span className="text-[10px] text-slate-400 font-mono shrink-0">
                      {new Date(notif.timestamp).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 📊 KPI STATS CARDS (Fokus Khusus Kendala Lapangan) */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
            <div className="bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2.5 shadow-xs relative overflow-hidden">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-slate-400">Total Kendala Masuk</span>
                <div className="w-7 h-7 rounded-lg bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400">
                  <AlertTriangle className="w-3.5 h-3.5" />
                </div>
              </div>
              <div className="text-3xl sm:text-4xl font-black text-white mt-1 font-mono flex items-baseline gap-1.5 leading-none">
                <span>{inScopeTotal}</span>
                {dateFilterMode !== 'all' && (
                  <span className="text-xs text-slate-500 font-semibold font-sans">/ {totalCount} total</span>
                )}
              </div>
              <div className="text-[10px] text-slate-400 mt-1.5 font-medium">
                Khusus kendala tanggal {selectedCalendarDate}
              </div>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2.5 shadow-xs relative overflow-hidden">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-rose-300">Kendala di Jalan &amp; Rute</span>
                <div className="w-7 h-7 rounded-lg bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400">
                  <AlertTriangle className="w-3.5 h-3.5" />
                </div>
              </div>
              <div className="text-3xl sm:text-4xl font-black text-rose-400 mt-1 font-mono flex items-baseline gap-1.5 leading-none">
                <span>{inScopeKendala}</span>
                {dateFilterMode !== 'all' && (
                  <span className="text-xs text-slate-500 font-semibold font-sans">/ {kendalaCount} total</span>
                )}
              </div>
              <div className="text-[10px] text-slate-400 mt-1.5 font-medium">Macet, akses jalan &amp; gangguan rute</div>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2.5 shadow-xs relative overflow-hidden">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-cyan-300">Kendala Antri Customer</span>
                <div className="w-7 h-7 rounded-lg bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400">
                  <Clock className="w-3.5 h-3.5" />
                </div>
              </div>
              <div className="text-3xl sm:text-4xl font-black text-cyan-400 mt-1 font-mono flex items-baseline gap-1.5 leading-none">
                <span>{inScopeAkhir}</span>
                {dateFilterMode !== 'all' && (
                  <span className="text-xs text-slate-500 font-semibold font-sans">/ {akhirCount} total</span>
                )}
              </div>
              <div className="text-[10px] text-slate-300 mt-1.5 font-semibold">Antrean bongkar di gudang toko</div>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2.5 shadow-xs relative overflow-hidden">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-amber-300">Menunggu Solusi SPV</span>
                <div className="w-7 h-7 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
                  <Clock className="w-3.5 h-3.5" />
                </div>
              </div>
              <div className="text-3xl sm:text-4xl font-black text-amber-400 mt-1 font-mono flex items-baseline gap-1.5 leading-none">
                <span>{inScopePending}</span>
                {dateFilterMode !== 'all' && (
                  <span className="text-xs text-slate-500 font-semibold font-sans">/ {pendingCount} total</span>
                )}
              </div>
              <div className="text-[10px] text-slate-400 mt-1.5 font-medium">Khusus SPV Logistik DC</div>
            </div>
          </div>

          {/* 📅 KALENDER LAPORAN & KENDALA KIRIMAN (Rapat & Padat) */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3.5 shadow-xs space-y-2.5">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-2 border-b border-slate-200 dark:border-slate-800 pb-2.5">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-emerald-600 text-white flex items-center justify-center font-bold shadow-xs shrink-0">
                  <Calendar className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-xs sm:text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2 flex-wrap">
                    <span>KALENDER LAPORAN &amp; KENDALA - {monthlyCalendarGrid.monthName.toUpperCase()} {monthlyCalendarGrid.year}</span>
                  </h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Klik pada salah satu tanggal untuk melihat rincian kendala jalan dan laporan pada tanggal tersebut.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <div className="flex items-center gap-1 bg-slate-50 dark:bg-slate-950 p-1 rounded-lg border border-slate-200 dark:border-slate-800 text-xs font-semibold">
                  <select
                    value={calendarMonth}
                    onChange={(e) => {
                      const nextMonth = Number(e.target.value);
                      setCalendarMonth(nextMonth);
                      const nextIso = `${calendarYear}-${String(nextMonth + 1).padStart(2, '0')}-01`;
                      setSelectedCalendarDate(nextIso);
                      setDateFilterMode('single_date');
                    }}
                    className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-md px-2 py-1 text-xs font-bold focus:outline-none focus:border-emerald-500 cursor-pointer"
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
                    className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-md px-2 py-1 text-xs font-bold focus:outline-none focus:border-emerald-500 cursor-pointer"
                  >
                    {[2024, 2025, 2026, 2027, 2028].map(yr => (
                      <option key={yr} value={yr}>{yr}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Legend Badges */}
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <span className="text-[11px] font-bold text-slate-600 dark:text-slate-300">
                Tanggal Terpilih: <strong className="text-emerald-600 dark:text-emerald-400 font-mono">{selectedCalendarDate}</strong>
              </span>
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 dark:bg-rose-950/80 text-rose-800 dark:text-rose-300 border border-rose-300 dark:border-rose-800">
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
                  <span>⚠️ Kendala Masuk</span>
                </span>
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  <span>Solusi Terkirim ke Portal Driver</span>
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
              {monthlyCalendarGrid.cells.map((cell) => {
                if (cell.type === 'padding') {
                  return (
                    <div
                      key={cell.key}
                      className="min-h-[64px] sm:min-h-[72px] bg-slate-50/50 dark:bg-slate-950/20 rounded-lg border border-dashed border-slate-200 dark:border-slate-800/50"
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
                    className={`min-h-[64px] sm:min-h-[72px] p-1.5 rounded-lg border transition cursor-pointer flex flex-col justify-between select-none relative gap-1 ${
                      isSelected
                        ? hasUnhandled
                          ? 'bg-rose-100/90 dark:bg-rose-950/60 border-rose-500 ring-1 ring-rose-500 shadow-sm z-10'
                          : 'bg-emerald-100/90 dark:bg-emerald-950/60 border-emerald-500 ring-1 ring-emerald-500 shadow-sm z-10'
                        : hasUnhandled
                        ? 'bg-rose-50/90 dark:bg-rose-950/40 hover:bg-rose-100/80 dark:hover:bg-rose-950/60 border-rose-400 dark:border-rose-500/70'
                        : isAllResolvedGreen
                        ? 'bg-emerald-50/80 dark:bg-emerald-950/35 hover:bg-emerald-100/70 dark:hover:bg-emerald-950/55 border-emerald-400 dark:border-emerald-500/60'
                        : 'bg-slate-50/80 dark:bg-slate-950/40 hover:bg-slate-100 dark:hover:bg-slate-900 border-slate-200 dark:border-slate-800'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1">
                      <span
                        className={`text-[11px] font-black px-1.5 py-0.2 rounded ${
                          hasUnhandled
                            ? 'bg-rose-600 text-white font-extrabold'
                            : isAllResolvedGreen || isSelected
                            ? 'bg-emerald-600 text-white font-extrabold'
                            : 'text-slate-500 dark:text-slate-400'
                        }`}
                      >
                        {String(cell.dayNumber).padStart(2, '0')}
                      </span>

                      {hasUnhandled ? (
                        <span
                          className="w-2 h-2 rounded-full bg-rose-500 animate-pulse ring-2 ring-rose-500/20"
                          title="Ada kendala masuk — segera perbarui status & solusi!"
                        />
                      ) : isAllResolvedGreen ? (
                        <span
                          className="w-3.5 h-3.5 rounded-full bg-emerald-500 text-white flex items-center justify-center"
                          title="Solusi terkirim / Tiba di gudang tercatat"
                        >
                          <Check className="w-2 h-2 stroke-[3]" />
                        </span>
                      ) : null}
                    </div>

                    <div className="space-y-0.5 mt-auto">
                      {hasKendala && (
                        <div className="px-1 py-0.5 rounded bg-rose-600/15 dark:bg-rose-500/25 border border-rose-500/40 text-rose-800 dark:text-rose-200 text-[8px] leading-tight">
                          <div className="font-black flex items-center justify-between gap-0.5">
                            <span className="truncate">⚠️ Kendala</span>
                            <span className="px-1 rounded bg-rose-600 text-white font-mono text-[8px] shrink-0">
                              {cell.kendalaCount}
                            </span>
                          </div>
                        </div>
                      )}

                      {hasAkhirKiriman && (
                        <div className="px-1 py-0.5 rounded bg-blue-600/15 dark:bg-blue-500/25 border border-blue-500/40 text-blue-800 dark:text-blue-200 text-[8px] leading-tight">
                          <div className="font-black flex items-center justify-between gap-0.5">
                            <span className="truncate">✅ Tiba di Gudang</span>
                            <span className="px-1 rounded bg-blue-600 text-white font-mono text-[8px] shrink-0">
                              {cell.akhirKirimanCount}
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Filter and Search Bar - Compact */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-2.5 shadow-xs">
            <div className="flex flex-col sm:flex-row gap-2">
              <div className="flex-1 relative">
                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Cari supir, helper, plat mobil, area, atau solusi SPV..."
                  className="w-full pl-9 pr-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value as any)}
                className="bg-slate-950 border border-slate-800 text-slate-200 text-xs rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-amber-500 cursor-pointer"
              >
                <option value="all">Semua Jenis Kendala</option>
                <option value="kendala_umum">⚠️ Kendala di Jalan &amp; Rute</option>
                <option value="antri_customer">⏳ Kendala Antri di Customer</option>
              </select>

              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as any)}
                className="bg-slate-950 border border-slate-800 text-slate-200 text-xs rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-amber-500 cursor-pointer"
              >
                <option value="all">Semua Status</option>
                <option value="pending">⏳ Menunggu Solusi SPV</option>
                <option value="follow_up">⚠️ Diproses / Diberi Arahan</option>
                <option value="verified">✓ Terverifikasi Selesai</option>
              </select>
            </div>
          </div>

          {/* Reports Table - 10 Kolom: Waktu; Kru; Armada; Jenis Laporan; Nama Area Kirim; Foto Bukti; Keterangan Kendala; Solusi; Status; Tindakan */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-xs">
            {filteredReports.length === 0 ? (
              <div className="p-8 text-center space-y-2">
                <div className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center text-slate-500 mx-auto">
                  <Calendar className="w-5 h-5" />
                </div>
                <div className="text-xs font-bold text-white">
                  Tidak Ada Laporan Pada Tanggal {selectedCalendarDate}
                </div>
                <p className="text-[11px] text-slate-400 max-w-sm mx-auto">
                  Tidak ada laporan atau kendala yang tercatat pada tanggal {selectedCalendarDate}. Silakan klik tanggal lain pada kalender yang memiliki tanda indikator laporan.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-slate-950 text-slate-400 uppercase tracking-wider text-[10px] font-bold border-b border-slate-800">
                    <tr>
                      <th className="py-2.5 px-3 whitespace-nowrap">Waktu</th>
                      <th className="py-2.5 px-3 whitespace-nowrap">Kru</th>
                      <th className="py-2.5 px-3 whitespace-nowrap">Armada</th>
                      <th className="py-2.5 px-3 whitespace-nowrap">Jenis Laporan</th>
                      <th className="py-2.5 px-3 whitespace-nowrap">Nama Area Kirim</th>
                      <th className="py-2.5 px-3 text-center whitespace-nowrap">Foto Bukti</th>
                      <th className="py-2.5 px-3 whitespace-nowrap">Keterangan Kendala</th>
                      <th className="py-2.5 px-3 min-w-[200px] whitespace-nowrap">Solusi</th>
                      <th className="py-2.5 px-3 text-center whitespace-nowrap">Status</th>
                      <th className="py-2.5 px-3 text-center whitespace-nowrap">Tindakan</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/70 text-slate-300">
                    {filteredReports.map((item) => {
                      const isVerifiedOrResolved =
                        Boolean(item.solution && item.solution.trim()) ||
                        item.status === 'verified' ||
                        item.status === 'resolved' ||
                        item.offlineStatus === 'sudah_online';

                      return (
                        <tr key={item.id} className="hover:bg-slate-850/60 transition">
                          {/* 1. Waktu */}
                          <td className="py-2.5 px-3 align-middle whitespace-nowrap">
                            <div className="text-xs text-white font-bold font-mono">
                              {new Date(item.timestamp).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })} WIB
                            </div>
                            <div className="text-[10px] text-slate-400 mt-0.5">
                              {item.date || new Date(item.timestamp).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
                            </div>
                          </td>

                          {/* 2. Kru */}
                          <td className="py-2.5 px-3 align-middle whitespace-nowrap">
                            <div className="font-bold text-white flex items-center gap-1.5">
                              <User className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                              <span>{item.driverName}</span>
                              <span className={`text-[9px] px-1.5 py-0.2 rounded font-mono font-bold border ${
                                (item.userRole || '').toLowerCase().includes('helper')
                                  ? 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30'
                                  : 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                              }`}>
                                {item.userRole || 'Driver'}
                              </span>
                            </div>
                            {item.helperName && (
                              <div className="text-[10px] text-slate-400 mt-0.5 pl-5">
                                Helper: <strong className="text-slate-300">{item.helperName}</strong>
                              </div>
                            )}
                          </td>

                          {/* 3. Armada */}
                          <td className="py-2.5 px-3 align-middle whitespace-nowrap">
                            <span className="inline-flex items-center gap-1.5 font-mono font-bold text-amber-300 text-[11px] bg-slate-950 px-2 py-1 rounded-md border border-slate-800">
                              <Truck className="w-3 h-3 text-amber-400 shrink-0" />
                              {item.plateNumber}
                            </span>
                          </td>

                          {/* 4. Jenis Laporan */}
                          <td className="py-2.5 px-3 align-middle space-y-1 whitespace-nowrap">
                            {item.category === 'mode_offline' && (
                              <div className="space-y-1">
                                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-black border ${
                                  item.offlineStatus === 'masih_offline'
                                    ? 'bg-rose-500/20 text-rose-200 border-rose-500/50 animate-pulse'
                                    : 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                                }`}>
                                  {item.offlineStatus === 'masih_offline' ? (
                                    <WifiOff className="w-3 h-3 text-rose-400 shrink-0" />
                                  ) : (
                                    <Wifi className="w-3 h-3 text-emerald-400 shrink-0" />
                                  )}
                                  <span>Peringatan Mode Offline</span>
                                </span>
                                <div className="text-[9px] font-mono bg-slate-950 px-1.5 py-1 rounded border border-slate-800 space-y-0.5">
                                  <div className="text-rose-400 font-bold">
                                    Off: {item.offlineActivatedAt || new Date(item.timestamp).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) + ' WIB'}
                                  </div>
                                  <div className={item.onlineRestoredAt ? 'text-emerald-400 font-bold' : 'text-amber-400 font-bold'}>
                                    On: {item.onlineRestoredAt || 'Masih Offline!'}
                                  </div>
                                </div>
                              </div>
                            )}
                            {item.category === 'kendala_jalan' && (
                              <div className="space-y-1">
                                {item.customerQueueStatus ? (
                                  <>
                                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold border ${
                                      item.customerQueueStatus === 'sedang_mengantri'
                                        ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 animate-pulse'
                                        : 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30'
                                    }`}>
                                      <Clock className="w-3 h-3 shrink-0" />
                                      <span>
                                        {item.customerQueueStatus === 'sedang_mengantri'
                                          ? 'Mengantri di Customer'
                                          : `Selesai Antri (${item.customerQueueDurationMinutes || 15} Menit)`}
                                      </span>
                                    </span>
                                  </>
                                ) : (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-rose-500/15 text-rose-300 border border-rose-500/30">
                                    <AlertTriangle className="w-3 h-3 text-rose-400" />
                                    <span>Kendala Jalan</span>
                                  </span>
                                )}
                              </div>
                            )}
                            {item.category === 'akhir_kiriman' && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                                <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                                <span>Tiba di Gudang</span>
                              </span>
                            )}
                            {item.category === 'presensi_shift' && (
                              <div className="space-y-0.5">
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-cyan-500/15 text-cyan-300 border border-cyan-500/30">
                                  <Clock className="w-3 h-3 text-cyan-400" />
                                  <span>Check-In &amp; Check-Out</span>
                                </span>
                                <div className="text-[9px] font-mono bg-slate-950 px-1.5 py-0.5 rounded border border-slate-800">
                                  <span className="text-emerald-400 font-bold">In: {item.checkinTimeFormatted || '-'}</span>
                                  {' | '}
                                  <span className={item.checkoutTimeFormatted ? 'text-amber-400 font-bold' : 'text-slate-500'}>
                                    Out: {item.checkoutTimeFormatted || 'Dinas'}
                                  </span>
                                </div>
                              </div>
                            )}
                            {item.category === 'pin_keamanan' && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30">
                                <Lock className="w-3 h-3 text-amber-400" />
                                <span>PIN Keamanan (2x)</span>
                              </span>
                            )}
                            {item.category === 'istirahat' && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-blue-500/15 text-blue-300 border border-blue-500/30">
                                <CheckCircle2 className="w-3 h-3 text-blue-400" />
                                <span>Absen Kiriman Pelanggan</span>
                              </span>
                            )}
                            {item.category === 'update_lokasi' && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-blue-500/15 text-blue-300 border border-blue-500/30">
                                <Navigation className="w-3 h-3 text-blue-400" />
                                <span>Update Lokasi</span>
                              </span>
                            )}
                            {item.securityPin && (
                              <div className="flex items-center gap-1 pt-0.5">
                                <span className="text-[9px] font-mono bg-slate-950 px-1.5 py-0.5 rounded border border-amber-500/30 text-amber-300 font-bold">
                                  PIN: {revealedPinIds[item.id] ? item.securityPin : '••••'}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => setRevealedPinIds(prev => ({ ...prev, [item.id]: !prev[item.id] }))}
                                  className="text-[9px] text-cyan-400 hover:underline font-bold cursor-pointer"
                                >
                                  {revealedPinIds[item.id] ? 'Tutup' : 'Lihat'}
                                </button>
                              </div>
                            )}
                          </td>

                          {/* 5. Nama Area Kirim & Pelanggan */}
                          <td className="py-2.5 px-3 align-middle">
                            <div className="font-bold text-white text-xs max-w-[160px] truncate" title={item.areaName}>
                              {item.areaName}
                            </div>
                            {item.customerOutletName && (
                              <div className="text-[10px] text-blue-400 font-semibold mt-0.5 truncate max-w-[160px]" title={item.customerOutletName}>
                                Pelanggan: {item.customerOutletName}
                              </div>
                            )}
                          </td>

                          {/* 6. Foto Bukti */}
                          <td className="py-2.5 px-3 align-middle text-center">
                            {item.photoUrl ? (
                              <div className="relative group w-11 h-11 rounded-lg overflow-hidden border border-slate-700 bg-slate-950 mx-auto">
                                <img
                                  src={item.photoUrl}
                                  alt="Bukti Kiriman"
                                  className="w-full h-full object-cover cursor-pointer group-hover:scale-105 transition"
                                  onClick={() => setSelectedPhotoModal(item)}
                                />
                                <button
                                  onClick={() => setSelectedPhotoModal(item)}
                                  className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition flex items-center justify-center text-white"
                                  title="Perbesar foto"
                                >
                                  <Eye className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            ) : (
                              <span className="inline-block px-2 py-1 rounded border border-dashed border-slate-800 text-slate-500 text-[10px]">
                                Tanpa Foto
                              </span>
                            )}
                          </td>

                          {/* 7. Keterangan Kendala */}
                          <td className="py-2.5 px-3 align-middle max-w-[210px]">
                            <p className="text-slate-300 text-[11px] leading-snug line-clamp-3" title={item.notes}>
                              {item.notes || '-'}
                            </p>
                          </td>

                          {/* 8. Solusi */}
                          <td className="py-2.5 px-3 align-middle max-w-[230px]">
                            {item.solution && item.solution.trim() ? (
                              <div className="bg-slate-950 p-2 rounded-lg border border-emerald-500/40 space-y-1">
                                <div className="flex items-center justify-between text-[9px]">
                                  <span className="font-bold text-emerald-400 flex items-center gap-1">
                                    <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                                    <span>Solusi SPV:</span>
                                  </span>
                                  <span className="text-emerald-300 font-semibold">
                                    {item.driverAcknowledged ? 'Dijalankan' : 'Terkirim'}
                                  </span>
                                </div>
                                <p className="text-white text-[11px] leading-snug font-semibold">
                                  "{item.solution}"
                                </p>
                              </div>
                            ) : item.category === 'kendala_jalan' ? (
                              <span className="inline-flex items-center gap-1 text-[10px] text-rose-300 font-semibold bg-rose-950/40 px-2 py-1 rounded border border-rose-500/30">
                                <AlertTriangle className="w-3 h-3 text-rose-400 shrink-0" />
                                <span>Menunggu Solusi SPV</span>
                              </span>
                            ) : (
                              <span className="text-[11px] text-slate-500 italic">
                                Tidak memerlukan solusi khusus
                              </span>
                            )}
                          </td>

                          {/* 9. Status */}
                          <td className="py-2.5 px-3 align-middle text-center whitespace-nowrap">
                            {isVerifiedOrResolved ? (
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                                <CheckCircle2 className="w-3 h-3 text-emerald-400 shrink-0" />
                                <span>Terverifikasi</span>
                              </span>
                            ) : item.status === 'follow_up' ? (
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2.5 py-1 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40">
                                <AlertTriangle className="w-3 h-3" />
                                <span>Tindak Lanjut</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2.5 py-1 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/40">
                                <Clock className="w-3 h-3 text-rose-400 shrink-0" />
                                <span>Pending</span>
                              </span>
                            )}
                          </td>

                          {/* 10. Tindakan (Edit dan Centang) */}
                          <td className="py-2.5 px-3 align-middle text-center whitespace-nowrap">
                            {isAuthorizedSpvOrAdmin ? (
                              <div className="inline-flex items-center justify-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => handleOpenSolutionModal(item)}
                                  className="p-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500 text-amber-300 hover:text-slate-950 border border-amber-500/40 transition active:scale-95 cursor-pointer"
                                  title="Edit Solusi & Arahan SPV"
                                >
                                  <Edit className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleVerify(item.id)}
                                  disabled={item.status === 'verified'}
                                  className={`p-1.5 rounded-lg border transition active:scale-95 ${
                                    item.status === 'verified'
                                      ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40 cursor-default'
                                      : 'bg-slate-800 hover:bg-emerald-600 text-slate-300 hover:text-white border-slate-700 hover:border-emerald-500 cursor-pointer'
                                  }`}
                                  title={item.status === 'verified' ? 'Sudah Terverifikasi' : 'Centang Verifikasi Sah'}
                                >
                                  <Check className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            ) : (
                              <div className="inline-flex items-center justify-center gap-1 text-[10px] text-slate-500">
                                <Lock className="w-3 h-3" />
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

              {/* Preset Quick Solution Chips */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-slate-300 flex items-center gap-1">
                  <Sparkles className="w-3 h-3 text-amber-400" />
                  <span>Pilih Template Arahan Cepat SPV:</span>
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {[
                    'Gunakan jalur lingkar bypass barat untuk menghindari titik macet pasar.',
                    'Tepi jalan aman, bantuan mekanik & armada pengganti sedang meluncur.',
                    'PIC Toko sudah kami infokan kendala jalan, keterlambatan 20-30 menit telah dimaklumi.',
                    'Segera merapat ke bengkel rekanan AKK terdekat di area tersebut untuk pengecekan darurat.'
                  ].map((preset, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setSolutionText(preset)}
                      className="text-left p-2 rounded-lg bg-slate-950 border border-slate-800 hover:border-amber-500/40 text-[10px] text-slate-300 hover:text-amber-300 transition cursor-pointer leading-tight"
                    >
                      &bull; {preset}
                    </button>
                  ))}
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

              <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl text-[11px] text-amber-200">
                <strong>Catatan Integrasi:</strong> Setelah disimpan, supir <strong>{solutionModalReport.driverName}</strong> akan melihat banner arahan ini di Portal Driver HP miliknya dan dapat langsung menekan tombol konfirmasi kerja.
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

            <div className="p-4 flex-1 overflow-y-auto flex flex-col items-center justify-center bg-black/40">
              {selectedPhotoModal.photoUrl ? (
                <img
                  src={selectedPhotoModal.photoUrl}
                  alt="Bukti Laporan Penuh"
                  className="max-h-[60vh] w-auto max-w-full rounded-xl object-contain border border-slate-800 shadow-2xl"
                />
              ) : (
                <div className="p-12 text-slate-500 text-xs">Foto tidak tersedia</div>
              )}

              <div className="w-full mt-4 bg-slate-950 p-3.5 rounded-xl border border-slate-800 text-xs space-y-1.5 text-left">
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

    </div>
  );
};
