import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  CheckCircle2,
  UserCheck,
  Store,
  Truck,
  User,
  Search,
  Calendar,
  FileSpreadsheet,
  RefreshCw,
  Eye,
  Navigation,
  ExternalLink,
  Plus,
  Camera,
  X,
  Check,
  MapPin,
  ShieldCheck,
  Trash2,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { driverReportService, DriverHelperReport, getLocalDateStr } from '../services/driverReportService';
import { logisticsStore } from '../services/store';
import { Schedule } from '../types';
import { useToast } from '../context/ToastContext';
import { resolvePreciseCustomerGps } from '../utils/preciseCustomerGps';
import { listenCrewChanged } from './crew/crewApi';

interface CrewAttendanceReportViewProps {
  onBackToOperationalReports?: () => void;
}

export const CrewAttendanceReportView: React.FC<CrewAttendanceReportViewProps> = ({
  onBackToOperationalReports
}) => {
  const { addNotification } = useToast();
  const [currentUser, setCurrentUser] = useState(() => logisticsStore.getCurrentUser());

  useEffect(() => {
    const syncUser = () => setCurrentUser({ ...logisticsStore.getCurrentUser() });
    const unsub = logisticsStore.subscribe(syncUser);
    return () => unsub();
  }, []);

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

  const isSuperAdmin = useMemo(() => {
    const r = String(currentUser?.role || '').toLowerCase().trim().replace(/[\s_-]+/g, '');
    return r === 'superadmin';
  }, [currentUser]);

  const [reports, setReports] = useState<DriverHelperReport[]>([]);
  const [storeTick, setStoreTick] = useState(0);

  useEffect(() => {
    const unsubscribe = logisticsStore.subscribe(() => setStoreTick(tick => tick + 1));
    return unsubscribe;
  }, []);
  const [statusFilter, setStatusFilter] = useState<'all' | 'verified' | 'pending'>('all');
  const [dateFilterMode, setDateFilterMode] = useState<'single_date' | 'all'>('all');
  const [selectedDate, setSelectedDate] = useState<string>(() => getLocalDateStr());
  const [selectedMonth, setSelectedMonth] = useState<string>(() => getLocalDateStr().slice(0, 7));
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedPhotoModal, setSelectedPhotoModal] = useState<DriverHelperReport | null>(null);
  const [deleteConfirmReport, setDeleteConfirmReport] = useState<DriverHelperReport | null>(null);
  const [deleteConfirmGroup, setDeleteConfirmGroup] = useState<{
    groupKey: string;
    areaName: string;
    scheduleDate: string;
    driverName: string;
    plateNumber: string;
    items: DriverHelperReport[];
  } | null>(null);

  // Modal Input Absen Kiriman di Pelanggan Baru
  const [isAddModalOpen, setIsAddModalOpen] = useState<boolean>(false);
  const [formDriverName, setFormDriverName] = useState<string>('');
  const [formHelperName, setFormHelperName] = useState<string>('');
  const [formPlateNumber, setFormPlateNumber] = useState<string>('');
  const [formAreaName, setFormAreaName] = useState<string>('');
  const [formCustomerName, setFormCustomerName] = useState<string>('');
  const [formNotes, setFormNotes] = useState<string>('');
  const [formPhotoDataUrl, setFormPhotoDataUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const crews = useMemo(() => logisticsStore.getCrews(), [storeTick]);
  const fleets = useMemo(() => logisticsStore.getFleets(), [storeTick]);

  const resetAddForm = () => {
    const defaultDriver = crews.find(c => c.role.includes('Driver'))?.name || crews[0]?.name || '';
    const defaultHelper = crews.find(c => c.role.includes('Helper'))?.name || '';
    const defaultFleet = fleets[0]?.plateNumber || '';
    setFormDriverName(defaultDriver);
    setFormHelperName(defaultHelper);
    setFormPlateNumber(defaultFleet);
    setFormAreaName('');
    setFormCustomerName('');
    setFormNotes('');
    setFormPhotoDataUrl(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const loadAttendanceReports = () => {
    setReports(driverReportService.getReports());
  };

  useEffect(() => {
    loadAttendanceReports();
    void driverReportService.syncWithServer(true);
    const handleUpdate = () => loadAttendanceReports();
    window.addEventListener('driver-report-updated', handleUpdate);
    const unsubCrew = listenCrewChanged(() => {
      void driverReportService.syncWithServer(true).then(() => loadAttendanceReports());
    });
    return () => {
      window.removeEventListener('driver-report-updated', handleUpdate);
      unsubCrew();
    };
  }, []);

  // Fokus 100% pada Absen Tim Kiriman di Pelanggan (category === 'istirahat'), BUKAN Check-In / Check-Out Shift
  const allCustomerAttendanceReports = useMemo(() => {
    return reports.filter(r => r.category === 'istirahat');
  }, [reports]);

  // Statistik Toko Kiriman dalam 1 Bulan (sesuai bulan terpilih)
  const monthlyStoreStats = useMemo(() => {
    const monthPrefix = selectedMonth || getLocalDateStr().slice(0, 7);
    const inMonthReports = allCustomerAttendanceReports.filter(r => {
      const d = getLocalDateStr(r.date || r.timestamp);
      return d.startsWith(monthPrefix);
    });
    const uniqueStores = new Set<string>();
    const uniqueAreas = new Set<string>();
    inMonthReports.forEach(r => {
      const storeName = (
        r.customerOutletName ||
        (r.notes?.match(/\[ABSEN KIRIMAN PELANGGAN:\s*([^\]]+)\]/i)?.[1] ?? '') ||
        r.areaName ||
        ''
      )
        .trim()
        .toLowerCase();
      if (storeName) uniqueStores.add(storeName);
      const area = (r.areaName || '').trim().toLowerCase();
      if (area) uniqueAreas.add(area);
    });

    const [y, m] = monthPrefix.split('-').map(Number);
    const monthLabel =
      y && m
        ? new Date(y, m - 1, 1).toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })
        : monthPrefix;

    return {
      uniqueStoreCount: uniqueStores.size,
      totalVisitsCount: inMonthReports.length,
      uniqueAreaCount: uniqueAreas.size,
      monthLabel
    };
  }, [allCustomerAttendanceReports, selectedMonth]);

  const uniqueCustomerCount = useMemo(() => {
    const names = new Set(
      allCustomerAttendanceReports
        .map(r => (r.customerOutletName || r.areaName || '').trim().toLowerCase())
        .filter(Boolean)
    );
    return names.size;
  }, [allCustomerAttendanceReports]);

  const withPhotoCount = useMemo(
    () => allCustomerAttendanceReports.filter(r => Boolean(r.photoUrl)).length,
    [allCustomerAttendanceReports]
  );

  const verifiedAttendanceCount = useMemo(
    () =>
      allCustomerAttendanceReports.filter(
        r => r.status === 'verified' || r.status === 'resolved'
      ).length,
    [allCustomerAttendanceReports]
  );

  const pendingAttendanceCount = useMemo(
    () =>
      allCustomerAttendanceReports.filter(
        r => r.status !== 'verified' && r.status !== 'resolved'
      ).length,
    [allCustomerAttendanceReports]
  );

  const [selectedAreaFilter, setSelectedAreaFilter] = useState<string>('all');
  const schedules = useMemo(() => logisticsStore.getSchedules(), [storeTick]);

  const normalizePersonCompact = (v?: string) => (v || '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');

  const resolveCrewDisplayForReport = (rep: DriverHelperReport, matchedSchedule?: Schedule) => {
    const isHelperReporter = String(rep.userRole || '').toLowerCase().includes('helper');
    const schDriver = (matchedSchedule?.crew?.name || '').trim();
    const schHelpers = [matchedSchedule?.crewHelper?.name, matchedSchedule?.crewHelper2?.name]
      .map(s => (s || '').trim())
      .filter(s => s && s !== '-');

    const repHelper = (rep.helperName || '').trim();
    const repReporter = (rep.reportedByName || '').trim();
    const repDriverRaw = (rep.driverName || '').trim();

    let resolvedHelper = '';
    if (schHelpers.length > 0) {
      resolvedHelper = schHelpers.join(', ');
    } else if (repHelper && repHelper !== '-') {
      resolvedHelper = repHelper;
    } else if (isHelperReporter) {
      resolvedHelper = repReporter || repDriverRaw;
    }

    const helperCompact = normalizePersonCompact(resolvedHelper);
    let resolvedDriver = '';
    if (schDriver && schDriver !== '-') {
      resolvedDriver = schDriver;
    } else if (repDriverRaw && repDriverRaw !== '-' && (!isHelperReporter || normalizePersonCompact(repDriverRaw) !== helperCompact)) {
      resolvedDriver = repDriverRaw;
    }

    if (resolvedDriver && helperCompact && normalizePersonCompact(resolvedDriver) === helperCompact) {
      resolvedDriver = schDriver && normalizePersonCompact(schDriver) !== helperCompact ? schDriver : '-';
    }

    if (isHelperReporter && resolvedHelper && schDriver && normalizePersonCompact(resolvedHelper) === normalizePersonCompact(schDriver)) {
      resolvedHelper = schHelpers[0] || repHelper || repReporter || '-';
    }

    return {
      driverName: resolvedDriver || '-',
      helperName: resolvedHelper || '-',
      reportedByName: repReporter || (isHelperReporter ? (resolvedHelper !== '-' ? resolvedHelper : repDriverRaw) : resolvedDriver)
    };
  };

  // Area pada laporan adalah snapshot saat bukti dikirim. Jadwal hanya dipakai untuk
  // melengkapi metadata kru/armada, bukan untuk menimpa area historis ketika jadwal diedit.
  const resolveScheduleAndArea = (rep: DriverHelperReport) => {
    const rDate = getLocalDateStr(rep.date || rep.timestamp);
    const repPlateClean = (rep.plateNumber || '').replace(/\s+/g, '').toUpperCase();
    const repDriverClean = normalizePersonCompact(rep.driverName);
    const repHelperClean = normalizePersonCompact(rep.helperName);
    const repReporterClean = normalizePersonCompact(rep.reportedByName);
    const normalizeArea = (value?: string) => (value || '').replace(/\s*\([^)]*\)\s*$/, '').trim().toLowerCase();
    const reportArea = (rep.areaName || '').trim();
    const hasReportAreaSnapshot = Boolean(
      reportArea &&
      reportArea !== '-' &&
      !/^(area kirim umum|area pengiriman|rute pengiriman aktif|rute pengiriman dc)$/i.test(reportArea)
    );

    // A schedule ID is the only unambiguous link. Legacy fallback checks operational window
    // and matching vehicle + any assigned crew member (Driver, Helper 1/2, or Backup).
    let matchedSchedule = rep.deliveryId
      ? schedules.find(s => s.id === rep.deliveryId)
      : undefined;

    if (!matchedSchedule) {
      const sameDayCandidates = schedules.filter(s => {
        const depDate = getLocalDateStr(s.deliveryDate || s.departureDate);
        const returnDate = getLocalDateStr(s.returnDate || s.estimatedArrival);
        const minDate = depDate <= returnDate ? depDate : returnDate;
        const maxDate = returnDate >= depDate ? returnDate : depDate;
        if (rDate < minDate || rDate > maxDate) return false;

        const sPlate = (s.fleet?.plateNumber || '').replace(/\s+/g, '').toUpperCase();
        const plateMatches = !repPlateClean || !sPlate || sPlate === repPlateClean;
        if (!plateMatches) return false;

        const scheduleCrewNames = [
          s.crew?.name,
          s.crewHelper?.name,
          s.crewHelper2?.name,
          s.backupCrewName
        ]
          .map(normalizePersonCompact)
          .filter(Boolean);

        const reportPersons = [repDriverClean, repHelperClean, repReporterClean].filter(Boolean);
        const crewMatches =
          scheduleCrewNames.length === 0 ||
          reportPersons.length === 0 ||
          reportPersons.some(p => scheduleCrewNames.some(sc => sc === p || sc.includes(p) || p.includes(sc)));

        return Boolean(repPlateClean || reportPersons.length > 0) && crewMatches;
      });
      const exactAreaCandidates = hasReportAreaSnapshot
        ? sameDayCandidates.filter(s => normalizeArea(s.areaName || s.store?.storeName) === normalizeArea(reportArea))
        : sameDayCandidates;
      if (exactAreaCandidates.length === 1) matchedSchedule = exactAreaCandidates[0];
      else if (exactAreaCandidates.length > 1) matchedSchedule = exactAreaCandidates[0];
      else if (!hasReportAreaSnapshot && sameDayCandidates.length === 1) matchedSchedule = sameDayCandidates[0];
    }

    const scheduledAreaName = (
      hasReportAreaSnapshot
        ? reportArea
        : matchedSchedule?.areaName || matchedSchedule?.store?.storeName || reportArea || 'Area Kirim Umum'
    ).trim();

    return { scheduledAreaName, matchedSchedule, rDate };
  };

  // Daftar Nama Area Kirim unik (disesuaikan dengan jadwal)
  const availableScheduledAreas = useMemo(() => {
    const areaSet = new Set<string>();
    allCustomerAttendanceReports.forEach(rep => {
      const { scheduledAreaName } = resolveScheduleAndArea(rep);
      if (scheduledAreaName) areaSet.add(scheduledAreaName);
    });
    schedules.forEach(s => {
      const aName = (s.areaName || s.store?.storeName || '').trim();
      if (aName) areaSet.add(aName);
    });
    return Array.from(areaSet);
  }, [allCustomerAttendanceReports, schedules]);

  const filteredAttendance = useMemo(() => {
    return allCustomerAttendanceReports.filter(rep => {
      const { scheduledAreaName, rDate } = resolveScheduleAndArea(rep);
      if (dateFilterMode === 'single_date' && selectedDate && rDate !== selectedDate) {
        return false;
      }
      if (selectedAreaFilter !== 'all' && scheduledAreaName.toLowerCase() !== selectedAreaFilter.toLowerCase()) {
        return false;
      }
      const isVer = rep.status === 'verified' || rep.status === 'resolved';
      if (statusFilter === 'verified' && !isVer) {
        return false;
      }
      if (statusFilter === 'pending' && isVer) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchDriver = (rep.driverName || '').toLowerCase().includes(q);
        const matchHelper = (rep.helperName || '').toLowerCase().includes(q);
        const matchPlate = (rep.plateNumber || '').toLowerCase().includes(q);
        const matchArea = scheduledAreaName.toLowerCase().includes(q) || (rep.areaName || '').toLowerCase().includes(q);
        const matchCustomer = (rep.customerOutletName || '').toLowerCase().includes(q);
        const matchNotes = (rep.notes || '').toLowerCase().includes(q);
        return matchDriver || matchHelper || matchPlate || matchArea || matchCustomer || matchNotes;
      }
      return true;
    });
  }, [allCustomerAttendanceReports, dateFilterMode, selectedDate, selectedAreaFilter, statusFilter, searchQuery, schedules]);

  // Pengelompokan terstruktur per Nama Area Kirim & Jadwal
  const groupedByAreaSchedule = useMemo(() => {
    const groupsMap = new Map<
      string,
      {
        groupKey: string;
        areaName: string;
        scheduleDate: string;
        driverName: string;
        helperName: string;
        plateNumber: string;
        fleetInitial?: string;
        trackingNumber?: string;
        items: DriverHelperReport[];
      }
    >();

    filteredAttendance.forEach(rep => {
      const { scheduledAreaName, matchedSchedule, rDate } = resolveScheduleAndArea(rep);
      const rawDateCandidate = rDate || rep.timestamp || matchedSchedule?.departureDate;
      const scheduleDate = getLocalDateStr(rawDateCandidate);
      const groupKey = `${scheduledAreaName.toUpperCase()}__${scheduleDate}`;

      const reportPlate = (rep.plateNumber || '').replace(/\s+/g, '').toUpperCase();
      const schedulePlate = (matchedSchedule?.fleet?.plateNumber || '').replace(/\s+/g, '').toUpperCase();
      const matchedFleetObj = fleets.find(
        f => f.plateNumber.replace(/\s+/g, '').toUpperCase() === (reportPlate || schedulePlate)
      );

      const resolvedCrew = resolveCrewDisplayForReport(rep, matchedSchedule);

      if (!groupsMap.has(groupKey)) {
        groupsMap.set(groupKey, {
          groupKey,
          areaName: scheduledAreaName,
          scheduleDate,
          driverName: resolvedCrew.driverName,
          helperName: resolvedCrew.helperName,
          plateNumber: rep.plateNumber || matchedSchedule?.fleet?.plateNumber || '-',
          fleetInitial: matchedFleetObj?.initialCode || (reportPlate ? undefined : matchedSchedule?.fleet?.initialCode),
          trackingNumber: matchedSchedule?.trackingNumber,
          items: []
        });
      } else {
        const existingGroup = groupsMap.get(groupKey)!;
        if ((existingGroup.driverName === '-' || !existingGroup.driverName) && resolvedCrew.driverName !== '-') {
          existingGroup.driverName = resolvedCrew.driverName;
        }
        if ((existingGroup.helperName === '-' || !existingGroup.helperName) && resolvedCrew.helperName !== '-') {
          existingGroup.helperName = resolvedCrew.helperName;
        }
        if ((existingGroup.plateNumber === '-' || !existingGroup.plateNumber) && (rep.plateNumber || matchedSchedule?.fleet?.plateNumber)) {
          existingGroup.plateNumber = rep.plateNumber || matchedSchedule?.fleet?.plateNumber || '-';
        }
      }
      groupsMap.get(groupKey)!.items.push(rep);
    });

    return Array.from(groupsMap.values()).sort((a, b) => {
      if (a.scheduleDate !== b.scheduleDate) return b.scheduleDate.localeCompare(a.scheduleDate);
      return a.areaName.localeCompare(b.areaName);
    });
  }, [filteredAttendance, schedules, fleets]);

  // Pagination (Paging) State untuk Daftar Area Jadwal Kirim agar tidak memanjang ke bawah terus
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [groupsPerPage, setGroupsPerPage] = useState<number>(2);

  useEffect(() => {
    setCurrentPage(1);
  }, [statusFilter, dateFilterMode, selectedDate, selectedAreaFilter, searchQuery, groupsPerPage]);

  const totalPages = useMemo(
    () => Math.max(1, Math.ceil(groupedByAreaSchedule.length / groupsPerPage)),
    [groupedByAreaSchedule.length, groupsPerPage]
  );

  const safeCurrentPage = Math.min(currentPage, totalPages);

  const paginatedAreaGroups = useMemo(() => {
    const startIdx = (safeCurrentPage - 1) * groupsPerPage;
    return groupedByAreaSchedule.slice(startIdx, startIdx + groupsPerPage);
  }, [groupedByAreaSchedule, safeCurrentPage, groupsPerPage]);

  const pageStartNumber = groupedByAreaSchedule.length === 0 ? 0 : (safeCurrentPage - 1) * groupsPerPage + 1;
  const pageEndNumber = Math.min(safeCurrentPage * groupsPerPage, groupedByAreaSchedule.length);

  const handleVerifyAttendance = (id: string) => {
    if (!isAuthorizedSpvOrAdmin) {
      addNotification(
        'sla_warning',
        'Akses Dibatasi',
        'Hanya SPV Logistik dan Super Admin yang dapat memverifikasi laporan absen pelanggan.'
      );
      return;
    }
    const verifier = currentUser?.fullName
      ? `${currentUser.fullName} (SPV Logistik DC)`
      : 'SPV Logistik DC';
    driverReportService.updateReportStatus(id, 'verified', verifier);
    loadAttendanceReports();
    addNotification(
      'schedule',
      'Absen Pelanggan Diverifikasi',
      'Data absen tim kiriman di pelanggan telah berhasil diverifikasi.'
    );
  };

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setFormPhotoDataUrl(reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleCreateAttendance = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formCustomerName.trim()) {
      addNotification(
        'sla_warning',
        'Nama Pelanggan Wajib Diisi',
        'Harap isi nama pelanggan atau toko tujuan kiriman.'
      );
      return;
    }
    if (!formPhotoDataUrl) {
      addNotification(
        'sla_warning',
        'Foto Bukti Absen Wajib Diunggah',
        'Harap ambil atau unggah foto bukti kiriman di lokasi pelanggan.'
      );
      return;
    }

    const cleanCustomer = formCustomerName.trim();
    const cleanArea = formAreaName.trim() || '-';
    const preciseGps = resolvePreciseCustomerGps({
      customerName: cleanCustomer,
      areaName: cleanArea
    });
    const noteText = `[ABSEN KIRIMAN PELANGGAN: ${cleanCustomer}] ${
      formNotes.trim() || `Sudah tiba dan absen kiriman di pelanggan ${cleanCustomer}`
    }`;

    driverReportService.addReport({
      driverId: `drv-${Date.now()}`,
      driverName: formDriverName.trim() || '-',
      userRole: 'Driver',
      helperName: formHelperName.trim() && formHelperName !== '-' ? formHelperName.trim() : undefined,
      plateNumber: formPlateNumber.trim() || '-',
      category: 'istirahat',
      areaName: cleanArea,
      customerOutletName: cleanCustomer,
      notes: noteText,
      photoUrl: formPhotoDataUrl,
      latitude: preciseGps.latitude,
      longitude: preciseGps.longitude,
      gmapsUrl: preciseGps.gmapsUrl,
      status: 'verified',
      verifiedBy: currentUser?.fullName || 'Sistem Absen Kiriman'
    });

    resetAddForm();
    setIsAddModalOpen(false);
    loadAttendanceReports();
    addNotification(
      'delivery',
      'Absen Kiriman Pelanggan Tersimpan',
      `Data absen kiriman ke pelanggan "${cleanCustomer}" (${preciseGps.coordsFormatted}) berhasil dicatat.`
    );
  };

  const handleExportCsv = () => {
    if (filteredAttendance.length === 0) return;

    const headers = [
      'ID Absen',
      'Tanggal Jadwal',
      'Waktu Absen',
      'Nama Area Kirim (Sesuai Jadwal)',
      'Nama Pelanggan / Toko Tujuan',
      'Nama Driver',
      'Nama Helper',
      'Plat Armada',
      'Titik Lokasi Spesifik',
      'Koordinat GPS Presisi',
      'Link Google Maps',
      'Keterangan Absen di Pelanggan',
      'Status Verifikasi'
    ];

    const rows = filteredAttendance.map(r => {
      const { scheduledAreaName } = resolveScheduleAndArea(r);
      const customerName =
        r.customerOutletName ||
        (r.notes?.match(/\[ABSEN KIRIMAN PELANGGAN:\s*([^\]]+)\]/i)?.[1] ?? '') ||
        r.areaName;
      const preciseGps = resolvePreciseCustomerGps({
        customerName,
        areaName: scheduledAreaName,
        rawLat: r.latitude,
        rawLng: r.longitude,
        rawGmapsUrl: r.gmapsUrl
      });
      return [
        r.id,
        getLocalDateStr(r.date || r.timestamp),
        new Date(r.timestamp).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) + ' WIB',
        `"${scheduledAreaName}"`,
        `"${customerName || '-'}"`,
        `"${r.driverName}"`,
        `"${r.helperName || '-'}"`,
        `"${r.plateNumber}"`,
        `"${preciseGps.subAreaLabel}"`,
        `"${preciseGps.coordsFormatted}"`,
        `"${preciseGps.gmapsUrl}"`,
        `"${(r.notes || '').replace(/"/g, '""')}"`,
        r.status === 'verified' || r.status === 'resolved' ? 'Terverifikasi' : 'Menunggu Verifikasi'
      ];
    });

    const csvContent =
      'data:text/csv;charset=utf-8,\uFEFF' +
      [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute(
      'download',
      `Laporan_Absen_Pelanggan_Per_Area_${dateFilterMode === 'single_date' ? selectedDate : 'Semua'}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    addNotification(
      'schedule',
      'Ekspor Excel Selesai',
      'Data Laporan Absen Tim Kiriman per Area berhasil diunduh.'
    );
  };

  return (
    <div className="space-y-4 animate-in fade-in duration-200">
      {/* Compact Header */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
            Laporan Absen Tim Kiriman per Area Jadwal
          </h2>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-0.5">
            Rekap absen toko pelanggan &amp; foto bukti kru dikelompokkan per area kirim.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={loadAttendanceReports}
            className="px-3.5 py-2 rounded-xl bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-sm font-semibold flex items-center gap-1.5 border border-slate-200 dark:border-slate-700 cursor-pointer transition"
          >
            <RefreshCw className="w-4 h-4" />
            <span>Segarkan</span>
          </button>

          <button
            type="button"
            onClick={handleExportCsv}
            className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold flex items-center gap-1.5 cursor-pointer transition"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>Ekspor Excel</span>
          </button>
        </div>
      </div>

      {/* 4 Flat KPI Cards (Tanpa Kartu Bersarang & Angka Besar Jelas) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 flex flex-col justify-between gap-2">
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm font-semibold text-slate-600 dark:text-slate-400">
              Toko Kiriman (Bulan)
            </span>
            <input
              type="month"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="px-2 py-1 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-800 dark:text-slate-200 focus:outline-none focus:border-blue-600 cursor-pointer"
              title="Pilih Bulan Rekap Toko Kiriman"
            />
          </div>
          <div className="text-3xl font-bold text-blue-600 dark:text-blue-400 font-mono tabular-nums">
            {monthlyStoreStats.uniqueStoreCount}{' '}
            <span className="text-sm font-sans font-semibold text-slate-500">Toko</span>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 flex flex-col justify-between gap-2">
          <span className="text-sm font-semibold text-slate-600 dark:text-slate-400">
            Area Kirim Terjadwal
          </span>
          <div className="text-3xl font-bold text-slate-900 dark:text-white font-mono tabular-nums">
            {groupedByAreaSchedule.length}{' '}
            <span className="text-sm font-sans font-semibold text-slate-500">Area</span>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 flex flex-col justify-between gap-2">
          <span className="text-sm font-semibold text-slate-600 dark:text-slate-400">
            Absen &amp; Foto Bukti
          </span>
          <div className="text-3xl font-bold text-slate-900 dark:text-white font-mono tabular-nums">
            {filteredAttendance.length}{' '}
            <span className="text-sm font-sans font-semibold text-slate-500">
              · {withPhotoCount} Foto
            </span>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 flex flex-col justify-between gap-2">
          <span className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">
            Absen Terverifikasi
          </span>
          <div className="text-3xl font-bold text-emerald-600 dark:text-emerald-400 font-mono tabular-nums">
            {verifiedAttendanceCount}{' '}
            <span className="text-sm font-sans font-semibold text-emerald-600/80">Sah</span>
          </div>
        </div>
      </div>

      {/* Compact Single-Row Filter & Search Bar */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-950 p-1 rounded-xl border border-slate-200 dark:border-slate-800 shrink-0">
            {[
              { key: 'all', label: `Semua (${allCustomerAttendanceReports.length})` },
              { key: 'verified', label: `Terverifikasi (${verifiedAttendanceCount})` },
              { key: 'pending', label: `Menunggu (${pendingAttendanceCount})` }
            ].map(tab => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setStatusFilter(tab.key as any)}
                className={`px-3 py-1.5 rounded-lg text-xs sm:text-sm font-semibold transition cursor-pointer ${
                  statusFilter === tab.key
                    ? 'bg-blue-600 text-white'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="relative flex-1 min-w-[200px]">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari toko, area, supir, helper, atau plat..."
              className="w-full h-10 pl-9 pr-7 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-blue-600"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          <select
            value={selectedAreaFilter}
            onChange={(e) => setSelectedAreaFilter(e.target.value)}
            className="h-10 px-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-sm font-semibold text-slate-900 dark:text-white focus:outline-none focus:border-blue-600 cursor-pointer max-w-[180px] truncate"
          >
            <option value="all">Semua Area ({availableScheduledAreas.length})</option>
            {availableScheduledAreas.map(area => (
              <option key={area} value={area}>
                {area}
              </option>
            ))}
          </select>

          <input
            type="date"
            value={selectedDate}
            onChange={(e) => {
              setSelectedDate(e.target.value);
              setDateFilterMode('single_date');
            }}
            className="h-10 px-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-sm font-semibold text-slate-900 dark:text-white focus:outline-none focus:border-blue-600 cursor-pointer"
          />

          <button
            type="button"
            onClick={() => {
              setSelectedDate(getLocalDateStr());
              setDateFilterMode('single_date');
            }}
            className={`h-10 px-3 rounded-xl text-xs sm:text-sm font-semibold transition cursor-pointer border ${
              dateFilterMode === 'single_date' && selectedDate === getLocalDateStr()
                ? 'bg-blue-600 text-white border-blue-600'
                : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'
            }`}
          >
            Hari Ini
          </button>

          <button
            type="button"
            onClick={() => setDateFilterMode('all')}
            className={`h-10 px-3 rounded-xl text-xs sm:text-sm font-semibold transition cursor-pointer border ${
              dateFilterMode === 'all'
                ? 'bg-blue-600 text-white border-blue-600'
                : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'
            }`}
          >
            Semua Tanggal
          </button>
        </div>
      </div>

      {/* Daftar Terstruktur Per Nama Area Kirim (Sesuai Jadwal Pengiriman) */}
      {groupedByAreaSchedule.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-10 text-center space-y-3 shadow-xs">
          <div className="w-12 h-12 rounded-2xl bg-blue-600/10 border border-blue-500/20 flex items-center justify-center text-blue-500 mx-auto">
            <Store className="w-6 h-6" />
          </div>
          <div className="text-sm font-black text-slate-900 dark:text-white">
            Belum Ada Data Absen Tim Kiriman pada Area / Filter Ini
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto leading-relaxed">
            Setiap kali tim pengiriman (Driver / Helper) mengirim <strong>Absen Kiriman Pelanggan</strong> dari Portal Driver Mobile, datanya otomatis dikelompokkan per <strong>Nama Area Kirim sesuai Jadwal</strong> di sini.
          </p>
        </div>
      ) : (
        <div className="space-y-3.5">
          {/* Top Paging & Navigation Bar */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl px-4 py-2.5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
            <div className="flex items-center gap-2 flex-wrap text-xs text-slate-600 dark:text-slate-300">
              <span className="px-2.5 py-1 rounded-lg bg-blue-600/10 text-blue-600 dark:text-blue-400 border border-blue-500/25 font-black text-[11px]">
                Halaman {safeCurrentPage} dari {totalPages}
              </span>
              <span>
                Menampilkan Area Jadwal <strong>#{pageStartNumber}–#{pageEndNumber}</strong> dari total{' '}
                <strong>{groupedByAreaSchedule.length} Area Jadwal</strong>
              </span>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              {/* Page Size Selector */}
              <div className="flex items-center gap-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-2.5 py-1 text-[11px]">
                <span className="text-slate-500 dark:text-slate-400 font-semibold">Tampilkan:</span>
                <select
                  value={groupsPerPage}
                  onChange={(e) => setGroupsPerPage(Number(e.target.value))}
                  className="bg-transparent font-black text-slate-900 dark:text-white focus:outline-none cursor-pointer"
                >
                  <option value={2} className="bg-white dark:bg-slate-900">2 Area / Hal</option>
                  <option value={3} className="bg-white dark:bg-slate-900">3 Area / Hal</option>
                  <option value={5} className="bg-white dark:bg-slate-900">5 Area / Hal</option>
                  <option value={10} className="bg-white dark:bg-slate-900">10 Area / Hal</option>
                </select>
              </div>

              {/* Page Numbers */}
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  disabled={safeCurrentPage <= 1}
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  className="px-2.5 py-1 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 disabled:pointer-events-none text-xs font-bold flex items-center gap-1 cursor-pointer transition"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                  <span>Prev</span>
                </button>

                {Array.from({ length: totalPages }, (_, idx) => idx + 1)
                  .filter(page => {
                    if (totalPages <= 7) return true;
                    return (
                      page === 1 ||
                      page === totalPages ||
                      Math.abs(page - safeCurrentPage) <= 1
                    );
                  })
                  .map((page, idx, arr) => {
                    const prevPage = arr[idx - 1];
                    const showEllipsis = prevPage && page - prevPage > 1;
                    return (
                      <React.Fragment key={page}>
                        {showEllipsis && (
                          <span className="px-1.5 text-xs text-slate-400 font-bold">...</span>
                        )}
                        <button
                          type="button"
                          onClick={() => setCurrentPage(page)}
                          className={`w-7 h-7 rounded-xl text-xs font-black transition cursor-pointer flex items-center justify-center border ${
                            safeCurrentPage === page
                              ? 'bg-blue-600 text-white border-blue-600 shadow-2xs'
                              : 'bg-slate-50 dark:bg-slate-950 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800'
                          }`}
                        >
                          {page}
                        </button>
                      </React.Fragment>
                    );
                  })}

                <button
                  type="button"
                  disabled={safeCurrentPage >= totalPages}
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  className="px-2.5 py-1 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 disabled:pointer-events-none text-xs font-bold flex items-center gap-1 cursor-pointer transition"
                >
                  <span>Next</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>

          {paginatedAreaGroups.map((group, localIdx) => {
            const globalGroupIdx = (safeCurrentPage - 1) * groupsPerPage + localIdx;
            const verifiedInGroup = group.items.filter(
              i => i.status === 'verified' || i.status === 'resolved'
            ).length;
            const safeIsoDate = getLocalDateStr(group.items[0]?.date || group.items[0]?.timestamp || group.scheduleDate);
            const parsedScheduleDate = new Date(`${safeIsoDate}T00:00:00`);
            const formattedScheduleDate = !isNaN(parsedScheduleDate.getTime())
              ? parsedScheduleDate.toLocaleDateString('id-ID', {
                  weekday: 'short',
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric'
                })
              : safeIsoDate;

            // Deteksi apakah ada koordinat mentah yang duplikat antar toko berbeda dalam grup yang sama
            const coordCounts = new Map<string, number>();
            group.items.forEach(it => {
              if (typeof it.latitude === 'number' && typeof it.longitude === 'number') {
                const key = `${it.latitude.toFixed(4)},${it.longitude.toFixed(4)}`;
                coordCounts.set(key, (coordCounts.get(key) || 0) + 1);
              }
            });

            return (
              <div
                key={group.groupKey}
                className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden"
              >
                {/* Header Nama Area Kirim & Rincian Jadwal Rute */}
                <div className="p-4 bg-slate-50 dark:bg-slate-950/90 border-b border-slate-200 dark:border-slate-800 flex flex-col lg:flex-row lg:items-center justify-between gap-2.5">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-blue-600 text-white font-bold text-sm flex items-center justify-center shrink-0 tabular-nums">
                      #{globalGroupIdx + 1}
                    </div>
                    <div>
                      <div className="flex items-center gap-2.5 flex-wrap">
                        <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white tracking-tight">
                          {group.areaName}
                        </h3>
                        <span className="text-sm font-mono font-semibold text-slate-600 dark:text-slate-300">
                          · {formattedScheduleDate}
                        </span>
                      </div>

                      <div className="flex items-center gap-2 flex-wrap text-sm text-slate-600 dark:text-slate-400 mt-0.5">
                        <span>
                          Driver: <strong className="text-slate-900 dark:text-white">{group.driverName}</strong>
                        </span>
                        <span aria-hidden="true">·</span>
                        <span>
                          Helper: <strong className="text-slate-900 dark:text-white">{group.helperName || '-'}</strong>
                        </span>
                        <span aria-hidden="true">·</span>
                        <span className="font-mono font-bold text-slate-900 dark:text-slate-100">
                          {group.plateNumber}{group.fleetInitial ? ` (${group.fleetInitial})` : ''}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap shrink-0">
                    <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                      {group.items.length} Toko ·{' '}
                      <strong className="text-emerald-700 dark:text-emerald-400">{verifiedInGroup}/{group.items.length} Terverifikasi</strong>
                    </span>
                    {isSuperAdmin && (
                      <button
                        type="button"
                        onClick={() =>
                          setDeleteConfirmGroup({
                            groupKey: group.groupKey,
                            areaName: group.areaName,
                            scheduleDate: formattedScheduleDate,
                            driverName: group.driverName,
                            plateNumber: group.plateNumber,
                            items: group.items
                          })
                        }
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-50 hover:bg-rose-600 text-rose-700 dark:text-rose-400 hover:text-white border border-rose-200 dark:border-rose-500/35 text-xs font-semibold transition cursor-pointer"
                        title="Hapus Seluruh Verifikasi Jadwal Kirim Area Ini (Khusus Super Admin)"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Hapus Jadwal</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Tabel Pelanggan dalam Area Kirim Ini (Typography Besar & Ringkas) */}
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm border-collapse">
                    <thead className="bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 uppercase tracking-wider text-xs font-bold border-b border-slate-200 dark:border-slate-800">
                      <tr>
                        <th className="py-3 px-3 w-10 text-center">#</th>
                        <th className="py-3 px-3 whitespace-nowrap">Jam Absen</th>
                        <th className="py-3 px-3">Toko Tujuan</th>
                        <th className="py-3 px-3">Kru &amp; Armada</th>
                        <th className="py-3 px-3">Titik Lokasi GPS</th>
                        <th className="py-3 px-3 text-center whitespace-nowrap">Foto</th>
                        <th className="py-3 px-3">Keterangan</th>
                        <th className="py-3 px-3 text-center whitespace-nowrap">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 dark:divide-slate-800/70 text-slate-700 dark:text-slate-300">
                      {group.items.map((item, idx) => {
                        const isVerified = item.status === 'verified' || item.status === 'resolved';
                        const customerName =
                          item.customerOutletName ||
                          (item.notes?.match(/\[ABSEN KIRIMAN PELANGGAN:\s*([^\]]+)\]/i)?.[1] ?? '') ||
                          item.areaName;
                        const cleanNotes = (item.notes || '')
                          .replace(/\[ABSEN KIRIMAN PELANGGAN:[^\]]*\]\s*/i, '')
                          .trim();

                        const coordKey =
                          typeof item.latitude === 'number' && typeof item.longitude === 'number'
                            ? `${item.latitude.toFixed(4)},${item.longitude.toFixed(4)}`
                            : '';
                        const isDuplicateCoordInGroup = coordKey ? (coordCounts.get(coordKey) || 0) > 1 : false;

                        const preciseGps = resolvePreciseCustomerGps({
                          customerName,
                          areaName: group.areaName,
                          rawLat: item.latitude,
                          rawLng: item.longitude,
                          rawGmapsUrl: item.gmapsUrl,
                          isDuplicateCoordInGroup
                        });

                        const itemFleetObj = fleets.find(
                          f => f.plateNumber.replace(/\s+/g, '').toUpperCase() === (item.plateNumber || '').replace(/\s+/g, '').toUpperCase()
                        );

                        return (
                          <tr key={item.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition">
                            <td className="py-3 px-3 align-middle text-center font-mono font-bold text-slate-500 tabular-nums">
                              {idx + 1}
                            </td>

                            {/* Jam Absen */}
                            <td className="py-3 px-3 align-middle whitespace-nowrap">
                              <span className="text-sm font-bold font-mono tabular-nums text-slate-900 dark:text-white">
                                {new Date(item.timestamp).toLocaleTimeString('id-ID', {
                                  hour: '2-digit',
                                  minute: '2-digit'
                                })}{' '}
                                WIB
                              </span>
                            </td>

                            {/* Nama Pelanggan / Toko Tujuan */}
                            <td className="py-3 px-3 align-middle max-w-[210px]">
                              <div className="text-[15px] font-bold text-slate-900 dark:text-white leading-snug">
                                {customerName}
                              </div>
                            </td>

                            {/* Kru & Armada */}
                            {(() => {
                              const itemMatchedSch = resolveScheduleAndArea(item).matchedSchedule;
                              const itemCrew = resolveCrewDisplayForReport(item, itemMatchedSch);
                              const isHelperSub = String(item.userRole || '').toLowerCase().includes('helper');
                              const distinctHelper =
                                itemCrew.helperName &&
                                itemCrew.helperName !== '-' &&
                                normalizePersonCompact(itemCrew.helperName) !== normalizePersonCompact(itemCrew.driverName)
                                  ? itemCrew.helperName
                                  : '';
                              return (
                                <td className="py-3 px-3 align-middle">
                                  <div className="font-bold text-slate-900 dark:text-white text-sm leading-snug">
                                    {itemCrew.driverName !== '-'
                                      ? `${itemCrew.driverName}${distinctHelper ? ` · Helper: ${distinctHelper}` : ''}`
                                      : distinctHelper
                                      ? `Helper: ${distinctHelper}`
                                      : item.driverName}
                                    {isHelperSub && (
                                      <span className="ml-1.5 text-xs font-semibold text-blue-600 dark:text-blue-400">
                                        (Helper)
                                      </span>
                                    )}
                                  </div>
                                  <div className="text-xs font-mono font-semibold text-slate-600 dark:text-slate-400 mt-0.5">
                                    {item.plateNumber}
                                    {itemFleetObj?.initialCode ? ` (${itemFleetObj.initialCode})` : ''}
                                  </div>
                                </td>
                              );
                            })()}

                            {/* Titik Lokasi GPS */}
                            <td className="py-3 px-3 align-middle">
                              <div className="text-sm font-semibold text-slate-900 dark:text-white truncate max-w-[190px]" title={preciseGps.subAreaLabel}>
                                {preciseGps.subAreaLabel}
                              </div>
                              <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                                <span className="text-xs font-mono text-slate-500 dark:text-slate-400 tabular-nums">
                                  {preciseGps.coordsFormatted}
                                </span>
                                <a
                                  href={preciseGps.gmapsUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline whitespace-nowrap"
                                >
                                  <span>Maps</span>
                                  <ExternalLink className="w-3 h-3" />
                                </a>
                              </div>
                            </td>

                            {/* Foto Bukti Absen */}
                            <td className="py-3 px-3 align-middle text-center">
                              {item.photoUrl ? (
                                <div className="relative group w-11 h-11 rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700 bg-slate-100 mx-auto">
                                  <img
                                    src={item.photoUrl}
                                    alt={customerName}
                                    className="w-full h-full object-cover cursor-pointer group-hover:scale-105 transition"
                                    onClick={() => setSelectedPhotoModal(item)}
                                  />
                                  <button
                                    type="button"
                                    onClick={() => setSelectedPhotoModal(item)}
                                    className="absolute inset-0 bg-black/45 opacity-0 group-hover:opacity-100 transition flex items-center justify-center text-white cursor-pointer"
                                    title="Perbesar Foto Absen Pelanggan"
                                  >
                                    <Eye className="w-4 h-4" />
                                  </button>
                                </div>
                              ) : (
                                <span className="text-slate-400 text-xs">-</span>
                              )}
                            </td>

                            {/* Keterangan Kiriman */}
                            <td className="py-3 px-3 align-middle max-w-[200px]">
                              <p className="text-slate-700 dark:text-slate-300 text-sm leading-snug line-clamp-2">
                                {cleanNotes || 'Kiriman telah tiba di pelanggan.'}
                              </p>
                            </td>

                            {/* Status & Verifikasi */}
                            <td className="py-3 px-3 align-middle text-center whitespace-nowrap">
                              <div className="flex items-center justify-center gap-1.5">
                                {isVerified ? (
                                  <span className="inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-500/30">
                                    <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                                    <span>Terverifikasi</span>
                                  </span>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => handleVerifyAttendance(item.id)}
                                    className="inline-flex items-center gap-1 px-3 py-1 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold transition cursor-pointer"
                                  >
                                    <Check className="w-3.5 h-3.5" />
                                    <span>Verifikasi</span>
                                  </button>
                                )}
                                {isSuperAdmin && (
                                  <button
                                    type="button"
                                    onClick={() => setDeleteConfirmReport(item)}
                                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-rose-50 hover:bg-rose-600 text-rose-700 dark:text-rose-400 hover:text-white border border-rose-200 dark:border-rose-500/35 text-xs font-semibold transition cursor-pointer"
                                    title="Hapus Absen Pelanggan (Khusus Super Admin)"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                    <span>Hapus</span>
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })}

          {/* Bottom Paging Bar */}
          {totalPages > 1 && (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl px-4 py-3 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
              <div className="text-xs text-slate-600 dark:text-slate-300">
                Halaman <strong>{safeCurrentPage}</strong> dari <strong>{totalPages}</strong> • Menampilkan Area Jadwal{' '}
                <strong>#{pageStartNumber}–#{pageEndNumber}</strong> dari <strong>{groupedByAreaSchedule.length}</strong> Area
              </div>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  disabled={safeCurrentPage <= 1}
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 disabled:pointer-events-none text-xs font-bold flex items-center gap-1 cursor-pointer transition"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                  <span>Halaman Sebelumnya</span>
                </button>
                <button
                  type="button"
                  disabled={safeCurrentPage >= totalPages}
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 disabled:pointer-events-none text-xs font-bold flex items-center gap-1 cursor-pointer transition"
                >
                  <span>Halaman Berikutnya</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Modal Input Absen Kiriman Pelanggan Baru */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-lg w-full overflow-hidden shadow-2xl">
            <div className="p-4 bg-slate-50 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center">
                  <Store className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-900 dark:text-white">
                    Catat Absen Kiriman di Pelanggan
                  </h3>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400">
                    Input data foto bukti kiriman &amp; nama pelanggan untuk tim pengiriman
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  resetAddForm();
                  setIsAddModalOpen(false);
                }}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-800 transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateAttendance} className="p-5 space-y-3.5 text-xs">
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Nama Pelanggan / Toko Tujuan Kiriman *
                </label>
                <input
                  type="text"
                  required
                  value={formCustomerName}
                  onChange={(e) => setFormCustomerName(e.target.value)}
                  placeholder="Ketik nama pelanggan atau toko tujuan kiriman..."
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white font-bold focus:outline-none focus:border-blue-600"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Nama Driver *
                  </label>
                  <select
                    value={formDriverName}
                    onChange={(e) => setFormDriverName(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white font-semibold focus:outline-none focus:border-blue-600"
                  >
                    {crews
                      .filter(c => c.role.includes('Driver'))
                      .map(c => (
                        <option key={c.id} value={c.name}>
                          {c.name}
                        </option>
                      ))}
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Nama Helper
                  </label>
                  <select
                    value={formHelperName}
                    onChange={(e) => setFormHelperName(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white font-semibold focus:outline-none focus:border-blue-600"
                  >
                    <option value="-">- Tanpa Helper -</option>
                    {crews
                      .filter(c => c.role.includes('Helper'))
                      .map(c => (
                        <option key={c.id} value={c.name}>
                          {c.name}
                        </option>
                      ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Armada (Plat Nomor) *
                  </label>
                  <select
                    value={formPlateNumber}
                    onChange={(e) => setFormPlateNumber(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white font-semibold focus:outline-none focus:border-blue-600"
                  >
                    {fleets.map(f => (
                      <option key={f.id} value={f.plateNumber}>
                        {f.initialCode ? `[${f.initialCode}] ` : ''}{f.plateNumber}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Area Kirim *
                  </label>
                  <input
                    type="text"
                    required
                    value={formAreaName}
                    onChange={(e) => setFormAreaName(e.target.value)}
                    placeholder="Contoh: SUSULAN ROGOJAMPI"
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white font-semibold focus:outline-none focus:border-blue-600"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="font-bold text-slate-700 dark:text-slate-300">
                    Foto Bukti Kiriman ke Pelanggan *
                  </label>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="text-[11px] font-bold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <Camera className="w-3.5 h-3.5" />
                    <span>Pilih / Ambil Foto</span>
                  </button>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={handlePhotoUpload}
                  className="hidden"
                />
                {formPhotoDataUrl ? (
                  <div className="relative rounded-xl overflow-hidden border border-slate-300 dark:border-slate-700 bg-slate-950 h-40 flex items-center justify-center">
                    <img
                      src={formPhotoDataUrl}
                      alt="Preview Bukti Absen"
                      className="max-h-full w-auto object-contain"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        setFormPhotoDataUrl(null);
                        if (fileInputRef.current) fileInputRef.current.value = '';
                      }}
                      className="absolute top-2 right-2 px-2.5 py-1 rounded-lg bg-slate-900/80 text-white text-[10px] font-bold hover:bg-slate-900 cursor-pointer"
                    >
                      Ganti Foto
                    </button>
                  </div>
                ) : (
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className="border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-blue-500 rounded-xl p-5 text-center cursor-pointer transition bg-slate-50 dark:bg-slate-950"
                  >
                    <Camera className="w-6 h-6 text-blue-500 mx-auto mb-1.5" />
                    <div className="font-bold text-slate-700 dark:text-slate-200">
                      Klik untuk Ambil Foto Bukti Kiriman Pelanggan
                    </div>
                    <p className="text-[10px] text-slate-500 mt-0.5">
                      Wajib melampirkan foto kiriman di lokasi pelanggan
                    </p>
                  </div>
                )}
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Catatan Kiriman (Opsional)
                </label>
                <textarea
                  rows={2}
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  placeholder="Catatan tambahan penerimaan barang di pelanggan..."
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:border-blue-600"
                />
              </div>

              <div className="pt-2 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    resetAddForm();
                    setIsAddModalOpen(false);
                  }}
                  className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-xs cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs flex items-center gap-1.5 cursor-pointer shadow-xs"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Simpan Absen Pelanggan</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Preview Foto Bukti Absen */}
      {selectedPhotoModal && (
        <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-2xl w-full overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
            <div className="p-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-white">
                  Foto Bukti Absen Pelanggan: {selectedPhotoModal.customerOutletName || selectedPhotoModal.areaName}
                </h3>
                <p className="text-[10px] text-slate-400">
                  Driver: {selectedPhotoModal.driverName} ({selectedPhotoModal.plateNumber}) •{' '}
                  {new Date(selectedPhotoModal.timestamp).toLocaleString('id-ID')}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedPhotoModal(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 flex-1 overflow-y-auto flex flex-col items-center justify-center bg-black/40">
              {selectedPhotoModal.photoUrl && (
                <img
                  src={selectedPhotoModal.photoUrl}
                  alt="Bukti Absen Kiriman"
                  className="max-h-[60vh] w-auto max-w-full rounded-xl object-contain border border-slate-800"
                />
              )}
              <div className="w-full mt-4 bg-slate-950 p-3.5 rounded-xl border border-slate-800 text-xs space-y-1.5">
                {(() => {
                  const modalCustomer =
                    selectedPhotoModal.customerOutletName ||
                    (selectedPhotoModal.notes?.match(/\[ABSEN KIRIMAN PELANGGAN:\s*([^\]]+)\]/i)?.[1] ?? '') ||
                    selectedPhotoModal.areaName;
                  const modalGps = resolvePreciseCustomerGps({
                    customerName: modalCustomer,
                    areaName: selectedPhotoModal.areaName,
                    rawLat: selectedPhotoModal.latitude,
                    rawLng: selectedPhotoModal.longitude,
                    rawGmapsUrl: selectedPhotoModal.gmapsUrl
                  });
                  return (
                    <div className="flex flex-wrap items-center justify-between gap-2 pb-1.5 border-b border-slate-800">
                      <div>
                        <div className="font-bold text-blue-400">
                          Nama Pelanggan: {modalCustomer}
                        </div>
                        <div className="text-[11px] text-slate-400 flex items-center gap-1 mt-0.5">
                          <MapPin className="w-3 h-3 text-blue-400 shrink-0" />
                          <span>{modalGps.subAreaLabel} ({modalGps.coordsFormatted})</span>
                        </div>
                      </div>
                      <a
                        href={modalGps.gmapsUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 border border-blue-500/30 text-[10px] font-bold"
                      >
                        <Navigation className="w-3 h-3" />
                        <span>Buka GPS Maps Presisi</span>
                        <ExternalLink className="w-2.5 h-2.5" />
                      </a>
                    </div>
                  );
                })()}
                <p className="text-slate-200 leading-relaxed">{selectedPhotoModal.notes}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Konfirmasi Hapus Absen Pelanggan (Khusus Super Admin) */}
      {deleteConfirmReport && isSuperAdmin && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-slate-900 border border-rose-500/40 rounded-2xl max-w-md w-full overflow-hidden shadow-2xl">
            <div className="p-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-rose-500/20 border border-rose-500/30 flex items-center justify-center text-rose-400 shrink-0">
                  <Trash2 className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-white">
                    Hapus Absen Kiriman Pelanggan
                  </h3>
                  <p className="text-[10px] font-bold text-rose-400 uppercase tracking-wider">
                    Otorisasi Khusus Super Admin
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setDeleteConfirmReport(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 space-y-3 text-xs">
              <p className="text-slate-300 leading-relaxed">
                Apakah Anda yakin ingin menghapus data absen kiriman pelanggan ini secara permanen?
              </p>
              <div className="bg-slate-950 border border-slate-800 rounded-xl p-3 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Kru Pengiriman:</span>
                  <span className="font-bold text-white">{deleteConfirmReport.driverName}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Armada:</span>
                  <span className="font-mono font-bold text-amber-300">{deleteConfirmReport.plateNumber}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Pelanggan / Area:</span>
                  <span className="font-semibold text-slate-200 truncate max-w-[200px]">
                    {deleteConfirmReport.customerOutletName || deleteConfirmReport.areaName}
                  </span>
                </div>
              </div>
            </div>

            <div className="p-3.5 bg-slate-950 border-t border-slate-800 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setDeleteConfirmReport(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs transition cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={() => {
                  driverReportService.deleteReport(deleteConfirmReport.id);
                  loadAttendanceReports();
                  addNotification(
                    'schedule',
                    'Data Absen Berhasil Dihapus',
                    `Data absen kiriman pelanggan (${deleteConfirmReport.driverName} • ${deleteConfirmReport.plateNumber}) telah dihapus oleh Super Admin.`
                  );
                  setDeleteConfirmReport(null);
                }}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-black text-xs flex items-center gap-1.5 shadow-md shadow-rose-600/20 transition cursor-pointer active:scale-95"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Ya, Hapus Data</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Konfirmasi Hapus Seluruh Jadwal Area Kirim (Khusus Super Admin) */}
      {deleteConfirmGroup && isSuperAdmin && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-slate-900 border border-rose-500/40 rounded-2xl max-w-md w-full overflow-hidden shadow-2xl">
            <div className="p-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-rose-500/20 border border-rose-500/30 flex items-center justify-center text-rose-400 shrink-0">
                  <Trash2 className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-white">
                    Hapus Verifikasi Jadwal Kirim
                  </h3>
                  <p className="text-[10px] font-bold text-rose-400 uppercase tracking-wider">
                    Otorisasi Khusus Super Admin
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setDeleteConfirmGroup(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 space-y-3 text-xs">
              <p className="text-slate-300 leading-relaxed">
                Apakah Anda yakin ingin menghapus seluruh verifikasi jadwal kirim pada area ini ({deleteConfirmGroup.items.length} titik pelanggan) secara permanen?
              </p>
              <div className="bg-slate-950 border border-slate-800 rounded-xl p-3 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Area Jadwal Kirim:</span>
                  <span className="font-bold text-white">{deleteConfirmGroup.areaName}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Tanggal Jadwal:</span>
                  <span className="font-mono font-semibold text-slate-200">{deleteConfirmGroup.scheduleDate}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Kru &amp; Armada:</span>
                  <span className="font-mono font-bold text-amber-300">
                    {deleteConfirmGroup.driverName} • {deleteConfirmGroup.plateNumber}
                  </span>
                </div>
              </div>
            </div>

            <div className="p-3.5 bg-slate-950 border-t border-slate-800 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setDeleteConfirmGroup(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs transition cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={() => {
                  deleteConfirmGroup.items.forEach(item => {
                    driverReportService.deleteReport(item.id);
                  });
                  loadAttendanceReports();
                  addNotification(
                    'schedule',
                    'Verifikasi Jadwal Kirim Dihapus',
                    `Seluruh data absen pada Area Jadwal Kirim "${deleteConfirmGroup.areaName}" (${deleteConfirmGroup.items.length} titik) telah dihapus oleh Super Admin.`
                  );
                  setDeleteConfirmGroup(null);
                }}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-black text-xs flex items-center gap-1.5 shadow-md shadow-rose-600/20 transition cursor-pointer active:scale-95"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Ya, Hapus Jadwal</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};