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
  ShieldCheck
} from 'lucide-react';
import { driverReportService, DriverHelperReport, getLocalDateStr } from '../services/driverReportService';
import { logisticsStore } from '../services/store';
import { useToast } from '../context/ToastContext';

interface CrewAttendanceReportViewProps {
  onBackToOperationalReports?: () => void;
}

export const CrewAttendanceReportView: React.FC<CrewAttendanceReportViewProps> = ({
  onBackToOperationalReports
}) => {
  const { addNotification } = useToast();
  const currentUser = logisticsStore.getCurrentUser();

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

  const [reports, setReports] = useState<DriverHelperReport[]>([]);
  const [statusFilter, setStatusFilter] = useState<'all' | 'verified' | 'pending'>('all');
  const [dateFilterMode, setDateFilterMode] = useState<'single_date' | 'all'>('all');
  const [selectedDate, setSelectedDate] = useState<string>(() => getLocalDateStr());
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedPhotoModal, setSelectedPhotoModal] = useState<DriverHelperReport | null>(null);

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

  const crews = useMemo(() => logisticsStore.getCrews(), []);
  const fleets = useMemo(() => logisticsStore.getFleets(), []);

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
    const handleUpdate = () => loadAttendanceReports();
    window.addEventListener('driver-report-updated', handleUpdate);
    return () => window.removeEventListener('driver-report-updated', handleUpdate);
  }, []);

  // Fokus 100% pada Absen Tim Kiriman di Pelanggan (category === 'istirahat'), BUKAN Check-In / Check-Out Shift
  const allCustomerAttendanceReports = useMemo(() => {
    return reports.filter(r => r.category === 'istirahat');
  }, [reports]);

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
  const schedules = useMemo(() => logisticsStore.getSchedules(), [reports]);

  // Helper untuk mencocokkan laporan absen ke jadwal pengiriman & Nama Area Kirim resmi
  const resolveScheduleAndArea = (rep: DriverHelperReport) => {
    const rDate = rep.date || (rep.timestamp ? getLocalDateStr(new Date(rep.timestamp)) : '');
    const repPlateClean = (rep.plateNumber || '').replace(/\s+/g, '').toUpperCase();
    const repDriverClean = (rep.driverName || '').trim().toLowerCase();

    let matchedSchedule = schedules.find(s => rep.deliveryId && s.id === rep.deliveryId);
    if (!matchedSchedule) {
      matchedSchedule = schedules.find(s => {
        const sPlate = (s.fleet?.plateNumber || '').replace(/\s+/g, '').toUpperCase();
        const sDriver = (s.crew?.name || '').trim().toLowerCase();
        return s.departureDate === rDate && ((repPlateClean && sPlate === repPlateClean) || (repDriverClean && sDriver === repDriverClean));
      });
    }
    if (!matchedSchedule && rep.areaName) {
      const cleanRepArea = rep.areaName.replace(/\s*\([^)]*\)\s*$/, '').trim().toLowerCase();
      matchedSchedule = schedules.find(
        s => (s.areaName || s.store?.storeName || '').trim().toLowerCase() === cleanRepArea
      );
    }

    const scheduledAreaName = (
      matchedSchedule?.areaName ||
      matchedSchedule?.store?.storeName ||
      rep.areaName ||
      'Area Kirim Umum'
    ).trim();

    return {
      scheduledAreaName,
      matchedSchedule,
      rDate
    };
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

  // Pengelompokan terstruktur per Nama Area Kirim & Jadwal (agar tidak tercampur semua dalam 1 tabel tanggal)
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
      const scheduleDate = matchedSchedule?.departureDate || rDate || '-';
      const groupKey = `${scheduledAreaName.toUpperCase()}__${scheduleDate}`;

      const matchedFleetObj = fleets.find(
        f => f.plateNumber.replace(/\s+/g, '').toUpperCase() === (matchedSchedule?.fleet?.plateNumber || rep.plateNumber || '').replace(/\s+/g, '').toUpperCase()
      );

      if (!groupsMap.has(groupKey)) {
        groupsMap.set(groupKey, {
          groupKey,
          areaName: scheduledAreaName,
          scheduleDate,
          driverName: matchedSchedule?.crew?.name || rep.driverName || '-',
          helperName: matchedSchedule?.crewHelper?.name || rep.helperName || '-',
          plateNumber: matchedSchedule?.fleet?.plateNumber || rep.plateNumber || '-',
          fleetInitial: matchedFleetObj?.initialCode || matchedSchedule?.fleet?.initialCode,
          trackingNumber: matchedSchedule?.trackingNumber,
          items: []
        });
      }
      groupsMap.get(groupKey)!.items.push(rep);
    });

    return Array.from(groupsMap.values()).sort((a, b) => {
      if (a.scheduleDate !== b.scheduleDate) return b.scheduleDate.localeCompare(a.scheduleDate);
      return a.areaName.localeCompare(b.areaName);
    });
  }, [filteredAttendance, schedules, fleets]);

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
      areaName: formAreaName.trim() || '-',
      customerOutletName: cleanCustomer,
      notes: noteText,
      photoUrl: formPhotoDataUrl,
      status: 'verified',
      verifiedBy: currentUser?.fullName || 'Sistem Absen Kiriman'
    });

    resetAddForm();
    setIsAddModalOpen(false);
    loadAttendanceReports();
    addNotification(
      'delivery',
      'Absen Kiriman Pelanggan Tersimpan',
      `Data absen kiriman ke pelanggan "${cleanCustomer}" berhasil dicatat.`
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
      'Keterangan Absen di Pelanggan',
      'Status Verifikasi'
    ];

    const rows = filteredAttendance.map(r => {
      const { scheduledAreaName } = resolveScheduleAndArea(r);
      return [
        r.id,
        r.date || new Date(r.timestamp).toISOString().slice(0, 10),
        new Date(r.timestamp).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) + ' WIB',
        `"${scheduledAreaName}"`,
        `"${r.customerOutletName || '-'}"`,
        `"${r.driverName}"`,
        `"${r.helperName || '-'}"`,
        `"${r.plateNumber}"`,
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
      {/* Top Header Banner */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 sm:p-5 shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex items-start sm:items-center gap-3.5">
          <div className="w-11 h-11 rounded-2xl bg-blue-600/15 border border-blue-500/30 flex items-center justify-center text-blue-600 dark:text-blue-400 shrink-0">
            <Store className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-white tracking-tight">
                Laporan Absen Tim Kiriman per Area Jadwal
              </h2>
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-blue-600/15 text-blue-600 dark:text-blue-300 border border-blue-500/30">
                Terstruktur per Nama Area Kirim
              </span>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
              Rekapitulasi absen tim pengiriman (Driver &amp; Helper) yang dikelompokkan secara terstruktur per <strong>Nama Area Kirim sesuai Jadwal Pengiriman</strong> beserta daftar toko pelanggan dan bukti foto.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap shrink-0">
          <button
            type="button"
            onClick={loadAttendanceReports}
            className="px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold flex items-center gap-1.5 border border-slate-200 dark:border-slate-700 cursor-pointer transition"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Segarkan</span>
          </button>

          <button
            type="button"
            onClick={handleExportCsv}
            className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-100 text-xs font-bold flex items-center gap-1.5 border border-slate-700 cursor-pointer transition"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-blue-400" />
            <span>Ekspor Excel</span>
          </button>
        </div>
      </div>

      {/* 4 KPI Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-3.5 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400 block">
              Area Kirim Terjadwal Aktif
            </span>
            <div className="text-2xl font-black text-blue-600 dark:text-blue-400 font-mono mt-0.5">
              {groupedByAreaSchedule.length}
              <span className="text-xs text-slate-400 font-sans font-semibold ml-1.5">
                Area Kirim
              </span>
            </div>
            <span className="text-[11px] text-slate-500 dark:text-slate-400">
              Dikelompokkan sesuai jadwal rute
            </span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-blue-600/15 border border-blue-500/30 flex items-center justify-center text-blue-600 dark:text-blue-400">
            <MapPin className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-3.5 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400 block">
              Total Absen di Pelanggan
            </span>
            <div className="text-2xl font-black text-slate-900 dark:text-white font-mono mt-0.5">
              {filteredAttendance.length}
              <span className="text-xs text-slate-400 font-sans font-semibold ml-1.5">
                ({uniqueCustomerCount} toko)
              </span>
            </div>
            <span className="text-[11px] text-slate-500 dark:text-slate-400">
              Titik pelanggan tujuan kiriman
            </span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-blue-600/15 border border-blue-500/30 flex items-center justify-center text-blue-600 dark:text-blue-400">
            <Store className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-3.5 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400 block">
              Foto Bukti Pelanggan
            </span>
            <div className="text-2xl font-black text-slate-900 dark:text-white font-mono mt-0.5">
              {withPhotoCount}
            </div>
            <span className="text-[11px] text-slate-500 dark:text-slate-400">
              Lengkap dengan dokumentasi foto
            </span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-700 dark:text-slate-300">
            <Camera className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-3.5 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400 block">
              Absen Pelanggan Terverifikasi
            </span>
            <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400 font-mono mt-0.5">
              {verifiedAttendanceCount}
            </div>
            <span className="text-[11px] text-slate-500 dark:text-slate-400">
              Diverifikasi SPV Logistik / Sistem
            </span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
            <ShieldCheck className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Filter & Search Bar (Termasuk Filter Nama Area Kirim Sesuai Jadwal) */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-xs space-y-3">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          {/* Status Filter Pills */}
          <div className="flex items-center gap-1.5 flex-wrap">
            {[
              { key: 'all', label: `Semua Absen (${allCustomerAttendanceReports.length})` },
              { key: 'verified', label: `Terverifikasi (${verifiedAttendanceCount})` },
              { key: 'pending', label: `Menunggu Verifikasi (${pendingAttendanceCount})` }
            ].map(tab => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setStatusFilter(tab.key as any)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                  statusFilter === tab.key
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Area Kirim Dropdown & Date Filter Controls */}
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-2.5 py-1.5">
              <MapPin className="w-3.5 h-3.5 text-blue-500 shrink-0" />
              <select
                value={selectedAreaFilter}
                onChange={(e) => setSelectedAreaFilter(e.target.value)}
                className="bg-transparent text-xs font-bold text-slate-900 dark:text-white focus:outline-none cursor-pointer"
              >
                <option value="all" className="bg-white dark:bg-slate-900">Semua Area Kirim ({availableScheduledAreas.length})</option>
                {availableScheduledAreas.map(area => (
                  <option key={area} value={area} className="bg-white dark:bg-slate-900">
                    Area: {area}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-2.5 py-1">
              <Calendar className="w-3.5 h-3.5 text-blue-500" />
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => {
                  setSelectedDate(e.target.value);
                  setDateFilterMode('single_date');
                }}
                className="bg-transparent text-xs font-bold text-slate-900 dark:text-white focus:outline-none cursor-pointer"
              />
            </div>

            <button
              type="button"
              onClick={() => {
                setSelectedDate(getLocalDateStr());
                setDateFilterMode('single_date');
              }}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer border ${
                dateFilterMode === 'single_date' && selectedDate === getLocalDateStr()
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700'
              }`}
            >
              Hari Ini
            </button>

            <button
              type="button"
              onClick={() => setDateFilterMode('all')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer border ${
                dateFilterMode === 'all'
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700'
              }`}
            >
              Semua Tanggal
            </button>
          </div>
        </div>

        {/* Quick Area Filter Pills */}
        {availableScheduledAreas.length > 0 && (
          <div className="flex items-center gap-1.5 flex-wrap pt-1 border-t border-slate-100 dark:border-slate-800/80">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mr-1">
              Pilih Area Jadwal:
            </span>
            <button
              type="button"
              onClick={() => setSelectedAreaFilter('all')}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition cursor-pointer border ${
                selectedAreaFilter === 'all'
                  ? 'bg-blue-600 text-white border-blue-500'
                  : 'bg-slate-50 dark:bg-slate-950 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-800 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Semua Area
            </button>
            {availableScheduledAreas.map(area => (
              <button
                key={area}
                type="button"
                onClick={() => setSelectedAreaFilter(area)}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition cursor-pointer border flex items-center gap-1 ${
                  selectedAreaFilter.toLowerCase() === area.toLowerCase()
                    ? 'bg-blue-600 text-white border-blue-500'
                    : 'bg-slate-50 dark:bg-slate-950 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-800 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <MapPin className="w-3 h-3 shrink-0" />
                <span>{area}</span>
              </button>
            ))}
          </div>
        )}

        {/* Search Input */}
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Cari nama area kirim, nama pelanggan / toko tujuan, nama supir, helper, atau plat nomor armada..."
            className="w-full pl-10 pr-8 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-blue-600"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-white cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
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
        <div className="space-y-4">
          {groupedByAreaSchedule.map((group, groupIdx) => {
            const verifiedInGroup = group.items.filter(
              i => i.status === 'verified' || i.status === 'resolved'
            ).length;
            const formattedScheduleDate = group.scheduleDate && group.scheduleDate !== '-'
              ? new Date(group.scheduleDate + 'T00:00:00').toLocaleDateString('id-ID', {
                  weekday: 'short',
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric'
                })
              : '-';

            return (
              <div
                key={group.groupKey}
                className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-xs"
              >
                {/* Header Nama Area Kirim & Rincian Jadwal Rute */}
                <div className="p-3.5 sm:p-4 bg-slate-50/90 dark:bg-slate-950/90 border-b border-slate-200 dark:border-slate-800 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                  <div className="flex items-start sm:items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-blue-600 text-white font-black text-xs flex items-center justify-center shrink-0 shadow-2xs">
                      #{groupIdx + 1}
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="px-2 py-0.5 rounded-md bg-blue-600/15 text-blue-600 dark:text-blue-400 border border-blue-500/30 text-[10px] font-black uppercase tracking-wider">
                          Area Jadwal Kirim
                        </span>
                        <h3 className="text-sm sm:text-base font-black text-slate-900 dark:text-white tracking-tight">
                          {group.areaName}
                        </h3>
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-slate-200/80 dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-[11px] font-bold font-mono">
                          <Calendar className="w-3 h-3 text-blue-500" />
                          {formattedScheduleDate}
                        </span>
                      </div>

                      <div className="flex items-center gap-3 flex-wrap text-[11px] text-slate-600 dark:text-slate-400 mt-1">
                        <span className="inline-flex items-center gap-1 font-semibold">
                          <User className="w-3.5 h-3.5 text-blue-500" />
                          Driver: <strong className="text-slate-900 dark:text-white">{group.driverName}</strong>
                        </span>
                        <span>•</span>
                        <span>
                          Helper: <strong className="text-slate-900 dark:text-white">{group.helperName || '-'}</strong>
                        </span>
                        <span>•</span>
                        <span className="inline-flex items-center gap-1 font-mono font-bold text-slate-800 dark:text-slate-200">
                          <Truck className="w-3.5 h-3.5 text-blue-500" />
                          {group.plateNumber}
                          {group.fleetInitial ? ` (${group.fleetInitial})` : ''}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap shrink-0">
                    <span className="px-2.5 py-1 rounded-xl bg-blue-600/10 text-blue-600 dark:text-blue-300 border border-blue-500/25 text-xs font-black">
                      {group.items.length} Titik Pelanggan Dikunjungi
                    </span>
                    <span className="px-2.5 py-1 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-300 border border-emerald-500/25 text-xs font-bold">
                      {verifiedInGroup}/{group.items.length} Terverifikasi
                    </span>
                  </div>
                </div>

                {/* Tabel Pelanggan dalam Area Kirim Ini */}
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-slate-100/70 dark:bg-slate-900 text-slate-500 dark:text-slate-400 uppercase tracking-wider text-[10px] font-bold border-b border-slate-200 dark:border-slate-800">
                      <tr>
                        <th className="py-2.5 px-3 whitespace-nowrap w-10 text-center">No</th>
                        <th className="py-2.5 px-3 whitespace-nowrap">Jam Absen</th>
                        <th className="py-2.5 px-3 whitespace-nowrap">Nama Pelanggan / Toko Tujuan</th>
                        <th className="py-2.5 px-3 whitespace-nowrap">Kru &amp; Armada</th>
                        <th className="py-2.5 px-3 whitespace-nowrap">Titik Lokasi GPS</th>
                        <th className="py-2.5 px-3 text-center whitespace-nowrap">Foto Bukti</th>
                        <th className="py-2.5 px-3 whitespace-nowrap">Keterangan Kiriman</th>
                        <th className="py-2.5 px-3 text-center whitespace-nowrap">Status &amp; Verifikasi</th>
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

                        return (
                          <tr key={item.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition">
                            <td className="py-2.5 px-3 align-middle text-center font-mono font-bold text-slate-400">
                              {idx + 1}
                            </td>

                            {/* Jam Absen */}
                            <td className="py-2.5 px-3 align-middle whitespace-nowrap">
                              <div className="text-xs font-bold font-mono text-slate-900 dark:text-white">
                                {new Date(item.timestamp).toLocaleTimeString('id-ID', {
                                  hour: '2-digit',
                                  minute: '2-digit'
                                })}{' '}
                                WIB
                              </div>
                            </td>

                            {/* Nama Pelanggan / Toko Tujuan */}
                            <td className="py-2.5 px-3 align-middle">
                              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold bg-blue-600/10 text-blue-700 dark:text-blue-300 border border-blue-500/25">
                                <Store className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                                <span>{customerName}</span>
                              </div>
                            </td>

                            {/* Kru & Armada */}
                            <td className="py-2.5 px-3 align-middle whitespace-nowrap">
                              <div className="font-bold text-slate-900 dark:text-white text-xs">
                                {item.driverName}
                                {item.helperName && item.helperName !== '-' ? ` & ${item.helperName}` : ''}
                              </div>
                              <div className="text-[10px] font-mono text-slate-500 dark:text-slate-400">
                                {item.plateNumber}
                              </div>
                            </td>

                            {/* Titik Lokasi GPS */}
                            <td className="py-2.5 px-3 align-middle whitespace-nowrap">
                              <div className="text-[11px] font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1">
                                <MapPin className="w-3 h-3 text-blue-500 shrink-0" />
                                <span>{group.areaName}</span>
                              </div>
                              {item.gmapsUrl && (
                                <a
                                  href={item.gmapsUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="inline-flex items-center gap-1 text-[10px] font-bold text-blue-500 hover:underline mt-0.5"
                                >
                                  <Navigation className="w-2.5 h-2.5" />
                                  <span>Buka GPS Maps</span>
                                  <ExternalLink className="w-2.5 h-2.5" />
                                </a>
                              )}
                            </td>

                            {/* Foto Bukti Absen */}
                            <td className="py-2.5 px-3 align-middle text-center">
                              {item.photoUrl ? (
                                <div className="relative group w-11 h-11 rounded-xl overflow-hidden border border-slate-300 dark:border-slate-700 bg-slate-950 mx-auto shadow-2xs">
                                  <img
                                    src={item.photoUrl}
                                    alt={customerName}
                                    className="w-full h-full object-cover cursor-pointer group-hover:scale-105 transition"
                                    onClick={() => setSelectedPhotoModal(item)}
                                  />
                                  <button
                                    type="button"
                                    onClick={() => setSelectedPhotoModal(item)}
                                    className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition flex items-center justify-center text-white cursor-pointer"
                                    title="Perbesar Foto Absen Pelanggan"
                                  >
                                    <Eye className="w-4 h-4" />
                                  </button>
                                </div>
                              ) : (
                                <span className="inline-block px-2 py-0.5 rounded border border-dashed border-slate-300 dark:border-slate-800 text-slate-400 text-[10px]">
                                  Tanpa Foto
                                </span>
                              )}
                            </td>

                            {/* Keterangan Kiriman */}
                            <td className="py-2.5 px-3 align-middle max-w-[240px]">
                              <p className="text-slate-700 dark:text-slate-300 text-[11px] leading-snug line-clamp-2">
                                {cleanNotes || 'Kiriman telah tiba dan diserahkan ke pelanggan.'}
                              </p>
                            </td>

                            {/* Status & Verifikasi */}
                            <td className="py-2.5 px-3 align-middle text-center whitespace-nowrap">
                              <div className="flex items-center justify-center gap-1.5">
                                {isVerified ? (
                                  <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2.5 py-1 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-300 border border-emerald-500/30">
                                    <CheckCircle2 className="w-3 h-3 shrink-0" />
                                    <span>Terverifikasi</span>
                                  </span>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => handleVerifyAttendance(item.id)}
                                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-[10px] font-bold transition cursor-pointer"
                                  >
                                    <Check className="w-3 h-3" />
                                    <span>Verifikasi</span>
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
                {selectedPhotoModal.customerOutletName && (
                  <div className="font-bold text-blue-400">
                    Nama Pelanggan: {selectedPhotoModal.customerOutletName}
                  </div>
                )}
                <p className="text-slate-200 leading-relaxed">{selectedPhotoModal.notes}</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
