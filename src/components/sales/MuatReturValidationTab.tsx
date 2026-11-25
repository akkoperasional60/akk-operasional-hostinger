import React, { useState, useEffect, useMemo } from 'react';
import {
  RotateCcw,
  PackageMinus,
  PackagePlus,
  PackageX,
  CheckCircle2,
  Clock,
  AlertTriangle,
  XCircle,
  Search,
  RefreshCw,
  FileSpreadsheet,
  Camera,
  MapPin,
  ExternalLink,
  ShieldCheck,
  Trash2,
  X,
  Truck,
  Store,
  FileText,
  Package,
  Calendar,
  Navigation
} from 'lucide-react';
import {
  driverReportService,
  DriverHelperReport,
  getLocalDateStr
} from '../../services/driverReportService';
import { logisticsStore } from '../../services/store';
import { branchStore } from '../../services/branchStore';
import { useToast } from '../../context/ToastContext';
import { ExifMetadataBadge } from '../../utils/exifMetadata';
import { resolvePreciseCustomerGps } from '../../utils/preciseCustomerGps';
import { listenCrewChanged } from '../crew/crewApi';

type IssueCategoryFilter = 'all' | 'salah_muat' | 'lebih_muat' | 'kurang_muat' | 'retur';
type ValidationStatusFilter = 'all' | 'pending' | 'verified' | 'follow_up' | 'resolved';

interface MuatReturValidationTabProps {
  embeddedInLogistics?: boolean;
  warehouseOnlyMode?: boolean;
}

const getCategoryMeta = (cat: DriverHelperReport['category']) => {
  if (cat === 'salah_muat') {
    return {
      label: 'Salah Muat',
      badgeCls:
        'bg-red-100 dark:bg-red-500/20 text-red-700 dark:text-red-300 border-red-300 dark:border-red-500/40',
      icon: <PackageX className="w-3.5 h-3.5" />
    };
  }
  if (cat === 'lebih_muat') {
    return {
      label: 'Lebih Muat',
      badgeCls:
        'bg-teal-100 dark:bg-teal-500/20 text-teal-700 dark:text-teal-300 border-teal-300 dark:border-teal-500/40',
      icon: <PackagePlus className="w-3.5 h-3.5" />
    };
  }
  if (cat === 'kurang_muat') {
    return {
      label: 'Kurang Muat',
      badgeCls:
        'bg-orange-100 dark:bg-orange-500/20 text-orange-700 dark:text-orange-300 border-orange-300 dark:border-orange-500/40',
      icon: <PackageMinus className="w-3.5 h-3.5" />
    };
  }
  return {
    label: 'Barang Retur',
    badgeCls:
      'bg-purple-100 dark:bg-purple-500/20 text-purple-700 dark:text-purple-300 border-purple-300 dark:border-purple-500/40',
    icon: <RotateCcw className="w-3.5 h-3.5" />
  };
};

const getValidationStatusMeta = (rep: DriverHelperReport) => {
  if (rep.status === 'pending' || rep.validationDecision === 'pending') {
    return {
      label: 'Menunggu Validasi',
      badgeCls:
        'bg-amber-100 dark:bg-amber-500/20 text-amber-800 dark:text-amber-300 border-amber-300 dark:border-amber-500/40',
      icon: <Clock className="w-3.5 h-3.5" />
    };
  }
  if (rep.validationDecision === 'rejected' || rep.status === 'resolved') {
    if (rep.validationDecision === 'approved') {
      return {
        label: 'Disetujui / Valid',
        badgeCls:
          'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-500/40',
        icon: <CheckCircle2 className="w-3.5 h-3.5" />
      };
    }
    return {
      label: 'Ditolak / Tidak Sesuai',
      badgeCls:
        'bg-rose-100 dark:bg-rose-500/20 text-rose-700 dark:text-rose-300 border-rose-300 dark:border-rose-500/40',
      icon: <XCircle className="w-3.5 h-3.5" />
    };
  }
  if (rep.status === 'follow_up' || rep.validationDecision === 'follow_up') {
    return {
      label: 'Perlu Tindak Lanjut',
      badgeCls:
        'bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-300 border-blue-300 dark:border-blue-500/40',
      icon: <AlertTriangle className="w-3.5 h-3.5" />
    };
  }
  return {
    label: 'Disetujui / Valid',
    badgeCls:
      'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-500/40',
    icon: <CheckCircle2 className="w-3.5 h-3.5" />
  };
};

export const MuatReturValidationTab: React.FC<MuatReturValidationTabProps> = ({
  embeddedInLogistics = false,
  warehouseOnlyMode = false
}) => {
  const { addNotification } = useToast();
  const [branches, setBranches] = useState(() => branchStore.getActiveBranches());
  const [selectedBranchId, setSelectedBranchId] = useState<string>('all');
  const [currentUser, setCurrentUser] = useState(() => logisticsStore.getCurrentUser());
  const [reports, setReports] = useState<DriverHelperReport[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const activeBranchLabel = useMemo(() => {
    if (selectedBranchId === 'all') return 'Semua Cabang';
    return branches.find(b => b.id === selectedBranchId)?.name || 'Semua Cabang';
  }, [selectedBranchId, branches]);

  // Filters
  const [categoryFilter, setCategoryFilter] = useState<IssueCategoryFilter>('all');
  const [statusFilter, setStatusFilter] = useState<ValidationStatusFilter>('all');
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Photo Modal
  const [photoModalReport, setPhotoModalReport] = useState<DriverHelperReport | null>(null);
  const [photoModalIndex, setPhotoModalIndex] = useState<number>(0);

  // Validation Modal
  const [validateModalReport, setValidateModalReport] = useState<DriverHelperReport | null>(null);
  const [decisionInput, setDecisionInput] = useState<'approved' | 'follow_up' | 'rejected'>('approved');
  const [validationNoteInput, setValidationNoteInput] = useState<string>('');
  const [gpsStatusInput, setGpsStatusInput] = useState<'valid' | 'mismatch'>('valid');

  // GPS Validation & Map Modal (Khusus Super Admin, SPV Operasional & SPV Logistik)
  const [gpsModalReport, setGpsModalReport] = useState<DriverHelperReport | null>(null);
  const [gpsModalDecision, setGpsModalDecision] = useState<'valid' | 'mismatch'>('valid');
  const [gpsModalNote, setGpsModalNote] = useState<string>('');

  // Delete Modal (Super Admin Only)
  const [deleteTargetReport, setDeleteTargetReport] = useState<DriverHelperReport | null>(null);

  const normalizedRole = useMemo(() => {
    return String(currentUser?.role || '').toLowerCase().trim().replace(/[\s_-]+/g, '');
  }, [currentUser]);

  const isSuperAdmin = normalizedRole === 'superadmin';
  const isSpvLogistik = normalizedRole === 'spvlogistik' || normalizedRole === 'dispatcher';
  const isSpvOperasional = normalizedRole === 'operasional' || normalizedRole === 'spvoperasional';
  const isWarehouseRole =
    Boolean(warehouseOnlyMode) ||
    normalizedRole === 'warehouseadmin' ||
    normalizedRole === 'koordinatorgudang' ||
    normalizedRole === 'gudang';
  // Validasi titik GPS disembunyikan bagi Admin Penjualan & Gudang; hanya terlihat untuk Super Admin, SPV Operasional & SPV Logistik
  const canViewGpsValidation = !isWarehouseRole && (isSuperAdmin || isSpvLogistik || isSpvOperasional);
  const roleGpsBadgeLabel = isSuperAdmin
    ? 'Super Admin'
    : isSpvOperasional
    ? 'SPV Operasional'
    : 'SPV Logistik';

  const fleets = useMemo(() => logisticsStore.getFleets(), []);

  const resolveFleetInitial = (rep: DriverHelperReport): string => {
    const rawPlate = String(rep.plateNumber || '').trim();
    if (!rawPlate || rawPlate === '-') return '-';
    const norm = rawPlate.replace(/\s+/g, '').toUpperCase();
    const matchedFleet = fleets.find(
      f => f.plateNumber.replace(/\s+/g, '').toUpperCase() === norm
    );
    if (matchedFleet?.initialCode) return matchedFleet.initialCode;
    return rawPlate;
  };

  const formatCleanAreaName = (rawArea?: string): string => {
    const clean = String(rawArea || '').trim();
    if (!clean) return '-';
    const parenMatch = clean.match(/^(.+?)\s*\(([^)]+)\)\s*$/);
    if (parenMatch) {
      const mainPart = parenMatch[1].trim();
      const subPart = parenMatch[2].trim();
      if (
        mainPart.toLowerCase() === subPart.toLowerCase() ||
        mainPart.toLowerCase().includes(subPart.toLowerCase()) ||
        subPart.toLowerCase().includes(mainPart.toLowerCase())
      ) {
        return mainPart;
      }
    }
    return clean;
  };

  const extractCleanIssueNote = (rep: DriverHelperReport): string => {
    const raw = String(rep.notes || '').trim();
    if (!raw) return '-';
    // Legacy format: "[SALAH MUAT: ...] Barang: ... | GPS: ... — Keterangan aktual"
    if (/^\[(?:RETUR BARANG|KURANG MUAT|LEBIH MUAT|SALAH MUAT)/i.test(raw)) {
      const dashIdx = raw.lastIndexOf(' — ');
      if (dashIdx >= 0) {
        const tail = raw.slice(dashIdx + 3).trim();
        return tail || '-';
      }
      const gpsStripped = raw
        .replace(/^\[[^\]]+\]\s*/i, '')
        .replace(/\bBarang:\s*[^|]+/i, '')
        .replace(/\|\s*No\.?\s*Faktur\/SO:\s*[^|]+/gi, '')
        .replace(/\|\s*GPS:\s*[^—|]+/gi, '')
        .replace(/^[|\s—-]+/, '')
        .trim();
      return gpsStripped || '-';
    }
    return raw.replace(/\|\s*GPS:\s*-?\d+\.\d+,\s*-?\d+\.\d+/gi, '').trim() || '-';
  };

  useEffect(() => {
    const syncUser = () => setCurrentUser({ ...logisticsStore.getCurrentUser() });
    const unsub = logisticsStore.subscribe(syncUser);
    return () => unsub();
  }, []);

  const loadReports = () => {
    const all = driverReportService.getReports();
    const issueOnly = all.filter(
      r =>
        r.category === 'retur' ||
        r.category === 'kurang_muat' ||
        r.category === 'lebih_muat' ||
        r.category === 'salah_muat'
    );
    setReports(issueOnly);
  };

  useEffect(() => {
    loadReports();
    void driverReportService.syncWithServer(true).then(() => {
      loadReports();
    });

    const handleUpdate = () => loadReports();
    window.addEventListener('driver-report-updated', handleUpdate);
    const unsubCrew = listenCrewChanged(() => {
      void driverReportService.syncWithServer(true).then(() => loadReports());
    });
    const poll = setInterval(() => {
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
      void driverReportService.syncWithServer(false).then(() => loadReports());
    }, 10000);

    return () => {
      window.removeEventListener('driver-report-updated', handleUpdate);
      unsubCrew();
      clearInterval(poll);
    };
  }, []);

  const handleManualRefresh = async () => {
    setIsRefreshing(true);
    await driverReportService.syncWithServer(true);
    loadReports();
    setTimeout(() => setIsRefreshing(false), 350);
  };

  useEffect(() => {
    const syncBranch = () => setBranches(branchStore.getActiveBranches());
    return branchStore.subscribe(syncBranch);
  }, []);

  const resolveReportBranchId = (rep: DriverHelperReport): string | null => {
    const matchedFleet = fleets.find(
      f =>
        rep.plateNumber &&
        rep.plateNumber !== '-' &&
        f.plateNumber.replace(/\s+/g, '').toUpperCase() ===
          rep.plateNumber.replace(/\s+/g, '').toUpperCase()
    );
    const fleetBranch = matchedFleet
      ? branchStore.getFleetBranchId(
          matchedFleet.id,
          matchedFleet.plateNumber,
          matchedFleet.initialCode
        )
      : null;
    if (fleetBranch) return fleetBranch;
    const areaLower = `${rep.areaName || ''} ${rep.customerOutletName || ''}`.toLowerCase();
    if (areaLower.includes('sidoarjo') || areaLower.includes('surabaya')) return 'cab-sidoarjo';
    return null;
  };

  const branchScopedReports = useMemo(() => {
    if (selectedBranchId === 'all') return reports;
    return reports.filter(r => {
      const bId = resolveReportBranchId(r);
      if (!bId) return true;
      return bId === selectedBranchId;
    });
  }, [reports, selectedBranchId, fleets]);

  const summary = useMemo(() => {
    return {
      total: branchScopedReports.length,
      pending: branchScopedReports.filter(r => r.status === 'pending').length,
      salahMuat: branchScopedReports.filter(r => r.category === 'salah_muat').length,
      lebihMuat: branchScopedReports.filter(r => r.category === 'lebih_muat').length,
      kurangMuat: branchScopedReports.filter(r => r.category === 'kurang_muat').length,
      retur: branchScopedReports.filter(r => r.category === 'retur').length
    };
  }, [branchScopedReports]);

  const filteredReports = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return branchScopedReports.filter(rep => {
      if (categoryFilter !== 'all' && rep.category !== categoryFilter) return false;
      if (statusFilter !== 'all' && rep.status !== statusFilter) return false;
      if (selectedDate) {
        const repDate = rep.date || getLocalDateStr(rep.timestamp);
        if (repDate !== selectedDate) return false;
      }
      if (q) {
        const hayFields = isWarehouseRole
          ? [rep.issueItemName, rep.issueQty, getCategoryMeta(rep.category).label]
          : [
              rep.driverName,
              rep.helperName,
              resolveFleetInitial(rep),
              rep.plateNumber,
              formatCleanAreaName(rep.areaName),
              rep.customerOutletName,
              rep.issueItemName,
              rep.issueItemCode,
              rep.issueQty,
              rep.invoiceNumber,
              extractCleanIssueNote(rep),
              rep.validationNote,
              rep.validatedBy
            ];
        const hay = hayFields
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [branchScopedReports, categoryFilter, statusFilter, selectedDate, searchQuery, fleets, isWarehouseRole]);

  const getResolvedReportGps = (rep: DriverHelperReport) => {
    return resolvePreciseCustomerGps({
      customerName: rep.customerOutletName || rep.issueItemName || '',
      areaName: rep.areaName,
      rawLat: rep.latitude,
      rawLng: rep.longitude,
      rawGmapsUrl: rep.gmapsUrl
    });
  };

  const openValidationModal = (rep: DriverHelperReport) => {
    setValidateModalReport(rep);
    setDecisionInput(
      rep.validationDecision === 'rejected'
        ? 'rejected'
        : rep.validationDecision === 'follow_up' || rep.status === 'follow_up'
        ? 'follow_up'
        : 'approved'
    );
    setValidationNoteInput(rep.validationNote || '');
    setGpsStatusInput(rep.gpsValidationStatus === 'mismatch' ? 'mismatch' : 'valid');
  };

  const openGpsValidationModal = (rep: DriverHelperReport) => {
    setGpsModalReport(rep);
    setGpsModalDecision(rep.gpsValidationStatus === 'mismatch' ? 'mismatch' : 'valid');
    setGpsModalNote(rep.gpsValidationNote || '');
  };

  const handleConfirmGpsValidation = (
    targetReport: DriverHelperReport,
    status: 'valid' | 'mismatch',
    noteText?: string
  ) => {
    if (!canViewGpsValidation) return;
    const validatorName =
      currentUser?.fullName || roleGpsBadgeLabel;
    const updated = driverReportService.validateReportGpsLocation({
      id: targetReport.id,
      gpsStatus: status,
      note: noteText,
      validatedBy: validatorName
    });
    if (updated) {
      loadReports();
      const catLabel = getCategoryMeta(targetReport.category).label;
      addNotification(
        'delivery',
        `Validasi Titik GPS ${catLabel}`,
        `Titik koordinat GPS laporan ${targetReport.driverName} ditandai ${
          status === 'valid' ? 'VALID (Sesuai Lokasi)' : 'TIDAK SESUAI LOKASI'
        } oleh ${validatorName}.`
      );
    }
    setGpsModalReport(null);
    setGpsModalNote('');
  };

  const handleConfirmValidation = () => {
    if (!validateModalReport || isWarehouseRole) return;
    const validatorName =
      currentUser?.fullName ||
      (isSuperAdmin
        ? 'Super Admin'
        : isSpvOperasional
        ? 'SPV Operasional'
        : isSpvLogistik
        ? 'SPV Logistik'
        : 'Admin Penjualan');
    const updated = driverReportService.validateItemIssueReport({
      id: validateModalReport.id,
      decision: decisionInput,
      note: validationNoteInput,
      validatedBy: validatorName,
      gpsValidationStatus: canViewGpsValidation ? gpsStatusInput : undefined
    });
    if (updated) {
      loadReports();
      const catLabel = getCategoryMeta(validateModalReport.category).label;
      addNotification(
        'delivery',
        `Validasi ${catLabel} Tersimpan`,
        `Laporan ${validateModalReport.driverName} (${validateModalReport.issueItemName || catLabel}) telah divalidasi oleh ${validatorName}.`
      );
    }
    setValidateModalReport(null);
    setValidationNoteInput('');
  };

  const handleConfirmDelete = () => {
    if (!deleteTargetReport || !isSuperAdmin) return;
    const targetName = deleteTargetReport.driverName;
    const ok = driverReportService.deleteReport(deleteTargetReport.id);
    if (ok) {
      loadReports();
      addNotification('delivery', 'Laporan Dihapus', `Laporan barang dari ${targetName} telah dihapus.`);
    }
    setDeleteTargetReport(null);
  };

  const handleExportExcel = () => {
    if (filteredReports.length === 0) return;
    const esc = (v?: string) => `"${String(v || '-').replace(/"/g, '""')}"`;

    if (isWarehouseRole) {
      const headers = ['Tanggal', 'Kategori', 'Nama Item Barang', 'Kuantiti / Qty'];
      const rows = filteredReports.map(r => {
        const catMeta = getCategoryMeta(r.category);
        const dStr = r.date || getLocalDateStr(r.timestamp);
        const unitSuffix =
          r.issueItemUnit && !String(r.issueQty || '').toLowerCase().includes(r.issueItemUnit.toLowerCase())
            ? ` ${r.issueItemUnit}`
            : '';
        return [
          esc(dStr),
          esc(catMeta.label),
          esc(r.issueItemName || '-'),
          esc(`${r.issueQty || '-'}${unitSuffix}`)
        ].join(',');
      });
      const csvContent =
        'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(','), ...rows].join('\n');
      const link = document.createElement('a');
      link.setAttribute('href', encodeURI(csvContent));
      link.setAttribute('download', `Laporan_Item_Retur_Muat_Gudang_${getLocalDateStr()}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      return;
    }

    const headers = [
      'ID Laporan',
      'Tanggal',
      'Waktu',
      'Kategori',
      'Nama Driver/Helper',
      'Peran',
      'Armada',
      'Area Kirim',
      'Toko / Pelanggan',
      'No. Faktur / SO',
      'Kode Barang',
      'Nama Barang',
      'Jumlah / Qty',
      ...(canViewGpsValidation ? ['Koordinat GPS', 'Status Validasi GPS', 'Validator GPS'] : []),
      'Keterangan',
      'Status Validasi',
      'Divalidasi Oleh',
      'Catatan Validasi'
    ];
    const rows = filteredReports.map(r => {
      const catMeta = getCategoryMeta(r.category);
      const stMeta = getValidationStatusMeta(r);
      const gpsInfo = getResolvedReportGps(r);
      const dStr = r.date || getLocalDateStr(r.timestamp);
      const tStr = new Date(r.timestamp).toLocaleTimeString('id-ID', {
        hour: '2-digit',
        minute: '2-digit'
      });
      return [
        esc(r.id),
        esc(dStr),
        esc(tStr),
        esc(catMeta.label),
        esc(r.driverName),
        esc(r.userRole || 'Driver'),
        esc(resolveFleetInitial(r)),
        esc(formatCleanAreaName(r.areaName)),
        esc(r.customerOutletName),
        esc(r.invoiceNumber),
        esc(r.issueItemCode),
        esc(r.issueItemName),
        esc(r.issueQty),
        ...(canViewGpsValidation
          ? [
              esc(gpsInfo.coordsFormatted),
              esc(
                r.gpsValidationStatus === 'valid'
                  ? 'GPS Valid'
                  : r.gpsValidationStatus === 'mismatch'
                  ? 'GPS Tidak Sesuai'
                  : 'Belum Divalidasi'
              ),
              esc(r.gpsValidatedBy)
            ]
          : []),
        esc(extractCleanIssueNote(r)),
        esc(stMeta.label),
        esc(r.validatedBy),
        esc(r.validationNote)
      ].join(',');
    });
    const csvContent =
      'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(','), ...rows].join('\n');
    const link = document.createElement('a');
    link.setAttribute('href', encodeURI(csvContent));
    link.setAttribute('download', `Validasi_Muat_Retur_Driver_Helper_${getLocalDateStr()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const getReportPhotos = (rep: DriverHelperReport): string[] => {
    if (Array.isArray(rep.photoUrls) && rep.photoUrls.length > 0) return rep.photoUrls;
    return rep.photoUrl ? [rep.photoUrl] : [];
  };

  const activeModalPhotos = photoModalReport ? getReportPhotos(photoModalReport) : [];
  const activeModalPhotoUrl =
    activeModalPhotos[photoModalIndex] || activeModalPhotos[0] || null;

  return (
    <div className="space-y-5 animate-in fade-in duration-200">
      {/* Header Banner */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-start sm:items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-500/15 border border-indigo-200 dark:border-indigo-500/30 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-white tracking-tight">
                  Validasi Barang Salah Muat, Lebih Muat, Kurang Muat &amp; Retur
                </h2>
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-indigo-100 dark:bg-indigo-500/20 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-500/30">
                  Integrasi Portal Driver &amp; Helper
                </span>
                {canViewGpsValidation && (
                  <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-500/30 inline-flex items-center gap-1">
                    <Navigation className="w-3 h-3" />
                    <span>Validasi Titik GPS Aktif ({roleGpsBadgeLabel})</span>
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                {isWarehouseRole
                  ? `Ringkasan nama item barang & kuantiti retur, salah muat, lebih muat, dan kurang muat untuk tim Gudang (${activeBranchLabel}).`
                  : `Periksa foto bukti barang retur, salah muat, lebih muat, dan kurang muat${canViewGpsValidation ? ' beserta validasi titik koordinat GPS lapangan' : ''} yang diunggah Driver & Helper (${activeBranchLabel}).`}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {!embeddedInLogistics && (
              <select
                value={selectedBranchId}
                onChange={(e) => setSelectedBranchId(e.target.value)}
                aria-label="Filter Cabang"
                className="px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-200 focus:outline-none focus:border-indigo-500 cursor-pointer"
              >
                <option value="all">Semua Cabang</option>
                {branches.map(b => (
                  <option key={b.id} value={b.id}>
                    Cabang {b.name}
                  </option>
                ))}
              </select>
            )}
            <button
              type="button"
              onClick={handleManualRefresh}
              className="px-3.5 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold flex items-center gap-1.5 border border-slate-200 dark:border-slate-700 cursor-pointer transition"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
              <span>Segarkan</span>
            </button>
            <button
              type="button"
              onClick={handleExportExcel}
              disabled={filteredReports.length === 0}
              className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer transition shadow-xs"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span>Ekspor Excel</span>
            </button>
          </div>
        </div>
      </div>

      {/* KPI Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3.5">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 block">
              Total Laporan Masuk
            </span>
            <div className="text-2xl font-black text-slate-900 dark:text-white font-mono tabular-nums mt-1">
              {summary.total}
            </div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 flex items-center justify-center shrink-0">
            <Package className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-amber-200 dark:border-amber-500/30 rounded-2xl p-4 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-amber-700 dark:text-amber-400 block">
              Menunggu Validasi
            </span>
            <div className="text-2xl font-black text-amber-600 dark:text-amber-400 font-mono tabular-nums mt-1">
              {summary.pending}
            </div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-500/15 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
            <Clock className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-red-200 dark:border-red-500/30 rounded-2xl p-4 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-red-700 dark:text-red-400 block">
              Salah Muat
            </span>
            <div className="text-2xl font-black text-red-600 dark:text-red-400 font-mono tabular-nums mt-1">
              {summary.salahMuat}
            </div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-red-50 dark:bg-red-500/15 text-red-600 dark:text-red-400 flex items-center justify-center shrink-0">
            <PackageX className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-teal-200 dark:border-teal-500/30 rounded-2xl p-4 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-teal-700 dark:text-teal-400 block">
              Lebih Muat
            </span>
            <div className="text-2xl font-black text-teal-600 dark:text-teal-400 font-mono tabular-nums mt-1">
              {summary.lebihMuat}
            </div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-teal-50 dark:bg-teal-500/15 text-teal-600 dark:text-teal-400 flex items-center justify-center shrink-0">
            <PackagePlus className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-orange-200 dark:border-orange-500/30 rounded-2xl p-4 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-orange-700 dark:text-orange-400 block">
              Kurang Muat
            </span>
            <div className="text-2xl font-black text-orange-600 dark:text-orange-400 font-mono tabular-nums mt-1">
              {summary.kurangMuat}
            </div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-orange-50 dark:bg-orange-500/15 text-orange-600 dark:text-orange-400 flex items-center justify-center shrink-0">
            <PackageMinus className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-purple-200 dark:border-purple-500/30 rounded-2xl p-4 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-purple-700 dark:text-purple-400 block">
              Barang Retur
            </span>
            <div className="text-2xl font-black text-purple-600 dark:text-purple-400 font-mono tabular-nums mt-1">
              {summary.retur}
            </div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-purple-50 dark:bg-purple-500/15 text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0">
            <RotateCcw className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Filters Toolbar (Dropdown Filter Ringkas) */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-xs">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3 items-end">
          {/* Search Input */}
          <div className="sm:col-span-2 lg:col-span-5">
            <label className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 dark:text-slate-500 block mb-1">
              Pencarian Laporan
            </label>
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={
                  isWarehouseRole
                    ? 'Cari nama item barang atau kuantiti...'
                    : 'Cari driver/helper, kode/nama barang, toko, no. faktur/SO, inisial armada...'
                }
                className="w-full pl-10 pr-4 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs font-medium text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          {/* Dropdown Filter Kategori */}
          <div className="lg:col-span-2">
            <label className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 dark:text-slate-500 block mb-1">
              Filter Kategori
            </label>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value as IssueCategoryFilter)}
              className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs font-bold text-slate-800 dark:text-slate-100 focus:outline-none focus:border-indigo-500 cursor-pointer"
            >
              <option value="all">Semua Kategori</option>
              <option value="salah_muat">Salah Muat</option>
              <option value="lebih_muat">Lebih Muat</option>
              <option value="kurang_muat">Kurang Muat</option>
              <option value="retur">Barang Retur</option>
            </select>
          </div>

          {/* Dropdown Filter Status */}
          <div className="lg:col-span-2">
            <label className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 dark:text-slate-500 block mb-1">
              Filter Status Validasi
            </label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as ValidationStatusFilter)}
              className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs font-bold text-slate-800 dark:text-slate-100 focus:outline-none focus:border-indigo-500 cursor-pointer"
            >
              <option value="all">Semua Status</option>
              <option value="pending">Menunggu Validasi</option>
              <option value="verified">Disetujui / Valid</option>
              <option value="follow_up">Tindak Lanjut</option>
              <option value="resolved">Ditolak</option>
            </select>
          </div>

          {/* Filter Tanggal */}
          <div className="lg:col-span-3">
            <label className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 dark:text-slate-500 block mb-1">
              Filter Tanggal
            </label>
            <div className="flex items-center gap-2">
              <div className="relative flex-1 flex items-center">
                <Calendar className="w-3.5 h-3.5 absolute left-3 text-slate-400 pointer-events-none" />
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="w-full pl-8 pr-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500"
                />
              </div>
              {(selectedDate || categoryFilter !== 'all' || statusFilter !== 'all' || searchQuery) && (
                <button
                  type="button"
                  onClick={() => {
                    setSelectedDate('');
                    setCategoryFilter('all');
                    setStatusFilter('all');
                    setSearchQuery('');
                  }}
                  className="px-2.5 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 cursor-pointer shrink-0"
                >
                  Reset
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Report List */}
      {filteredReports.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-10 text-center space-y-2 shadow-xs">
          <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-400 flex items-center justify-center mx-auto">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <h3 className="text-sm font-black text-slate-900 dark:text-white">
            Belum Ada Laporan Retur, Salah Muat, Lebih Muat, atau Kurang Muat
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto">
            Laporan beserta foto bukti dan titik koordinat GPS yang dikirim oleh Driver &amp; Helper melalui Portal Driver akan langsung muncul di sini untuk divalidasi.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredReports.map(rep => {
            const catMeta = getCategoryMeta(rep.category);
            const stMeta = getValidationStatusMeta(rep);
            const photos = getReportPhotos(rep);
            const resolvedGps = getResolvedReportGps(rep);
            const armadaInitial = resolveFleetInitial(rep);
            const cleanAreaName = formatCleanAreaName(rep.areaName);
            const cleanSubAreaLabel = formatCleanAreaName(resolvedGps.subAreaLabel);
            const cleanNotes = extractCleanIssueNote(rep);
            const unitSuffix =
              rep.issueItemUnit &&
              !String(rep.issueQty || '').toLowerCase().includes(rep.issueItemUnit.toLowerCase())
                ? ` ${rep.issueItemUnit}`
                : '';
            const timeFormatted = new Date(rep.timestamp).toLocaleTimeString('id-ID', {
              hour: '2-digit',
              minute: '2-digit'
            });
            const dateFormatted = rep.date || getLocalDateStr(rep.timestamp);

            if (isWarehouseRole) {
              return (
                <div
                  key={rep.id}
                  className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div className="min-w-0 space-y-1.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                        className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-black border ${catMeta.badgeCls}`}
                      >
                        {catMeta.icon}
                        <span>{catMeta.label}</span>
                      </span>
                      <span className="text-[11px] font-mono tabular-nums text-slate-500 dark:text-slate-400">
                        {dateFormatted}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-sm font-black text-slate-900 dark:text-white">
                      <Package className="w-4 h-4 text-indigo-500 shrink-0" />
                      <span className="truncate">{rep.issueItemName || '-'}</span>
                    </div>
                  </div>

                  <div className="px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 shrink-0 text-right">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                      Kuantiti / Qty
                    </span>
                    <span className="text-sm font-black font-mono tabular-nums text-indigo-600 dark:text-indigo-400">
                      {rep.issueQty || '-'}{unitSuffix}
                    </span>
                  </div>
                </div>
              );
            }

            return (
              <div
                key={rep.id}
                className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-xs hover:border-indigo-300 dark:hover:border-indigo-500/40 transition"
              >
                <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
                  {/* Left Info */}
                  <div className="flex-1 space-y-2.5 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-black border ${catMeta.badgeCls}`}
                      >
                        {catMeta.icon}
                        <span>{catMeta.label}</span>
                      </span>

                      <span
                        className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${stMeta.badgeCls}`}
                      >
                        {stMeta.icon}
                        <span>{stMeta.label}</span>
                      </span>

                      {canViewGpsValidation && (
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${
                            rep.gpsValidationStatus === 'valid'
                              ? 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-500/40'
                              : rep.gpsValidationStatus === 'mismatch'
                              ? 'bg-rose-100 dark:bg-rose-500/20 text-rose-700 dark:text-rose-300 border-rose-300 dark:border-rose-500/40'
                              : 'bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-300 border-blue-300 dark:border-blue-500/40'
                          }`}
                        >
                          <MapPin className="w-3 h-3" />
                          <span>
                            {rep.gpsValidationStatus === 'valid'
                              ? 'GPS Valid (Sesuai Lokasi)'
                              : rep.gpsValidationStatus === 'mismatch'
                              ? 'GPS Tidak Sesuai'
                              : 'GPS Tercatat'}
                          </span>
                        </span>
                      )}

                      <span className="text-[11px] font-mono tabular-nums text-slate-500 dark:text-slate-400">
                        {dateFormatted} • {timeFormatted} WIB
                      </span>

                      {rep.invoiceNumber && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 text-[11px] font-mono font-bold">
                          <FileText className="w-3 h-3" />
                          <span>{rep.invoiceNumber}</span>
                        </span>
                      )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
                      <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                          Pelapor (Kru &amp; Armada)
                        </span>
                        <div className="text-xs font-black text-slate-900 dark:text-white mt-0.5 flex items-center gap-1.5">
                          <Truck className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                          <span className="truncate">
                            {rep.driverName} ({rep.userRole || 'Driver'})
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400 font-semibold mt-0.5">
                          Armada: <span className="font-mono font-bold text-slate-700 dark:text-slate-200">{armadaInitial}</span> • {cleanAreaName}
                        </div>
                      </div>

                      <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                          Barang &amp; Jumlah (Database Barang)
                        </span>
                        <div className="text-xs font-black text-slate-900 dark:text-white mt-0.5 flex items-center gap-1.5 flex-wrap">
                          <Package className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                          {rep.issueItemCode && (
                            <span className="px-1.5 py-0.2 rounded bg-indigo-100 dark:bg-indigo-500/20 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-500/30 font-mono text-[10px] font-bold">
                              {rep.issueItemCode}
                            </span>
                          )}
                          <span className="truncate">
                            {rep.issueItemName || 'Lihat Keterangan Laporan'}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-600 dark:text-slate-300 font-semibold mt-0.5">
                          Qty: {rep.issueQty || '-'}{unitSuffix}
                        </div>
                      </div>

                      <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                          Pelanggan / Toko &amp; Lokasi
                        </span>
                        <div className="text-xs font-black text-slate-900 dark:text-white mt-0.5 flex items-center gap-1.5">
                          <Store className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                          <span className="truncate">
                            {rep.customerOutletName || cleanAreaName || '-'}
                          </span>
                        </div>
                        {canViewGpsValidation ? (
                          <div className="text-[11px] font-mono tabular-nums text-blue-600 dark:text-blue-400 font-bold mt-0.5">
                            GPS: {resolvedGps.coordsFormatted}
                          </div>
                        ) : (
                          <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 truncate">
                            Area: {cleanAreaName}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* 📍 PANEL VALIDASI TITIK GPS KHUSUS AKSES SUPER ADMIN, SPV OPERASIONAL & SPV LOGISTIK (SATU FITUR TERPADU) */}
                    {canViewGpsValidation && (
                      <div className="p-3 rounded-xl bg-blue-50/70 dark:bg-blue-950/35 border border-blue-200 dark:border-blue-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                        <div className="flex items-start gap-2.5 min-w-0">
                          <div className="w-8 h-8 rounded-lg bg-blue-600/15 border border-blue-500/30 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0 mt-0.5">
                            <MapPin className="w-4 h-4" />
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-xs font-black text-slate-900 dark:text-white">
                                Validasi Titik GPS ({catMeta.label}):
                              </span>
                              <span className="text-xs font-mono tabular-nums font-bold text-blue-700 dark:text-blue-300">
                                {resolvedGps.coordsFormatted}
                              </span>
                              <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                                • {cleanSubAreaLabel}
                              </span>
                            </div>
                            <div className="text-[11px] text-slate-600 dark:text-slate-400 mt-0.5 flex items-center gap-2 flex-wrap">
                              {rep.gpsValidatedBy ? (
                                <span>
                                  Divalidasi GPS oleh <strong className="text-slate-900 dark:text-white">{rep.gpsValidatedBy}</strong>
                                  {rep.gpsValidationNote ? ` — "${rep.gpsValidationNote}"` : ''}
                                </span>
                              ) : (
                                <span>
                                  Akses {roleGpsBadgeLabel}: Klik Peta &amp; Validasi GPS untuk cek Google Maps dan konfirmasi lokasi.
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 flex-wrap shrink-0">
                          <button
                            type="button"
                            onClick={() => openGpsValidationModal(rep)}
                            className="px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-[11px] font-black flex items-center gap-1.5 shadow-2xs cursor-pointer transition"
                          >
                            <Navigation className="w-3.5 h-3.5" />
                            <span>Peta &amp; Validasi GPS</span>
                          </button>
                        </div>
                      </div>
                    )}

                    <div className="text-xs text-slate-700 dark:text-slate-300 bg-slate-50/70 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2">
                      <span className="font-bold text-slate-500 dark:text-slate-400 mr-1.5">
                        Keterangan:
                      </span>
                      <span>{cleanNotes}</span>
                    </div>

                    {(rep.validationNote || rep.validatedBy) && (
                      <div className="text-xs bg-indigo-50/70 dark:bg-indigo-500/10 border border-indigo-200 dark:border-indigo-500/30 rounded-xl px-3 py-2 flex flex-col sm:flex-row sm:items-center justify-between gap-1.5">
                        <div>
                          <span className="font-black text-indigo-700 dark:text-indigo-300 mr-1.5">
                            Hasil Validasi ({rep.validatedBy || 'Admin Penjualan'}):
                          </span>
                          <span className="text-slate-800 dark:text-slate-200 font-semibold">
                            {rep.validationNote || rep.solution}
                          </span>
                        </div>
                        {rep.validatedAt && (
                          <span className="text-[10px] font-mono text-indigo-600 dark:text-indigo-400 shrink-0">
                            {new Date(rep.validatedAt).toLocaleString('id-ID', {
                              day: '2-digit',
                              month: 'short',
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Right Photo Preview + Actions */}
                  <div className="flex flex-row lg:flex-col items-center lg:items-end justify-between gap-2.5 shrink-0">
                    {photos.length >= 2 ? (
                      <div className="flex items-center gap-2">
                        {photos.slice(0, 2).map((pUrl, pIdx) => {
                          const slotLabel =
                            rep.category === 'retur'
                              ? pIdx === 0
                                ? 'Foto Faktur'
                                : 'Foto Barang'
                              : `Foto #${pIdx + 1}`;
                          return (
                            <button
                              key={`${rep.id}-thumb-${pIdx}`}
                              type="button"
                              onClick={() => {
                                setPhotoModalReport(rep);
                                setPhotoModalIndex(pIdx);
                              }}
                              title={`Klik untuk memperbesar ${slotLabel}`}
                              className="relative w-20 h-20 rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 bg-slate-950 group cursor-pointer"
                            >
                              <img
                                src={pUrl}
                                alt={slotLabel}
                                className="w-full h-full object-cover group-hover:scale-105 transition"
                              />
                              <div className="absolute inset-x-0 bottom-0 bg-slate-950/80 text-white text-[9px] font-bold py-0.5 px-1 flex items-center justify-center gap-1 truncate">
                                <Camera className="w-2.5 h-2.5 shrink-0" />
                                <span className="truncate">{slotLabel}</span>
                              </div>
                            </button>
                          );
                        })}
                        {photos.length > 2 && (
                          <button
                            type="button"
                            onClick={() => {
                              setPhotoModalReport(rep);
                              setPhotoModalIndex(2);
                            }}
                            className="h-20 px-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 text-[10px] font-bold text-slate-700 dark:text-slate-200 cursor-pointer"
                          >
                            +{photos.length - 2}
                          </button>
                        )}
                      </div>
                    ) : photos.length > 0 ? (
                      <button
                        type="button"
                        onClick={() => {
                          setPhotoModalReport(rep);
                          setPhotoModalIndex(0);
                        }}
                        title="Klik untuk memperbesar foto bukti"
                        className="relative w-24 h-20 rounded-xl overflow-hidden border border-slate-300 dark:border-slate-700 bg-slate-950 group cursor-pointer shadow-xs"
                      >
                        <img
                          src={photos[0]}
                          alt="Bukti Foto"
                          className="w-full h-full object-cover group-hover:scale-105 transition"
                        />
                        <div className="absolute inset-x-0 bottom-0 bg-slate-950/80 text-white text-[9px] font-bold py-0.5 px-1.5 flex items-center justify-center gap-1">
                          <Camera className="w-2.5 h-2.5" />
                          <span>{photos.length} Foto</span>
                        </div>
                      </button>
                    ) : (
                      <div className="w-24 h-20 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 flex flex-col items-center justify-center text-[10px] text-slate-400">
                        <Camera className="w-4 h-4 mb-1" />
                        <span>Tanpa Foto</span>
                      </div>
                    )}

                    <div className="flex items-center gap-1.5 flex-wrap justify-end">
                      <button
                        type="button"
                        onClick={() => openValidationModal(rep)}
                        className="px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-black flex items-center gap-1.5 shadow-xs cursor-pointer transition"
                      >
                        <ShieldCheck className="w-3.5 h-3.5" />
                        <span>{rep.status === 'pending' ? 'Validasi' : 'Ubah Validasi'}</span>
                      </button>

                      {isSuperAdmin && (
                        <button
                          type="button"
                          onClick={() => setDeleteTargetReport(rep)}
                          className="p-1.5 rounded-xl bg-rose-50 dark:bg-rose-500/15 hover:bg-rose-100 dark:hover:bg-rose-500/25 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-500/30 cursor-pointer"
                          title="Hapus Laporan (Super Admin)"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Photo Viewer Modal */}
      {photoModalReport && activeModalPhotoUrl && (
        <div
          className="fixed inset-0 z-50 bg-black/85 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setPhotoModalReport(null)}
        >
          <div
            className="w-full max-w-2xl bg-slate-900 border border-slate-700 rounded-2xl overflow-hidden shadow-2xl space-y-3 p-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-black text-white">
                  Bukti Foto • {getCategoryMeta(photoModalReport.category).label}
                  {photoModalReport.category === 'retur' && activeModalPhotos.length > 1
                    ? ` (${photoModalIndex === 0 ? 'Foto Faktur' : photoModalIndex === 1 ? 'Foto Barang' : `Foto #${photoModalIndex + 1}`})`
                    : ''}
                </h3>
                <p className="text-[11px] text-slate-400">
                  {photoModalReport.driverName} (Armada: {resolveFleetInitial(photoModalReport)}) • {photoModalReport.issueItemName || '-'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setPhotoModalReport(null)}
                className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="bg-black rounded-xl overflow-hidden border border-slate-800 flex items-center justify-center max-h-[60vh]">
              <img
                src={activeModalPhotoUrl}
                alt="Bukti Foto Laporan"
                className="max-h-[58vh] w-auto object-contain"
              />
            </div>

            {photoModalReport.exifMetadata && (
              <ExifMetadataBadge exif={photoModalReport.exifMetadata} />
            )}

            {activeModalPhotos.length > 1 && (
              <div className="flex items-center gap-2 overflow-x-auto pb-1">
                {activeModalPhotos.map((u, idx) => {
                  const thumbLabel =
                    photoModalReport.category === 'retur'
                      ? idx === 0
                        ? 'Foto Faktur'
                        : idx === 1
                        ? 'Foto Barang'
                        : `Foto #${idx + 1}`
                      : `Foto ${idx + 1}`;
                  return (
                    <button
                      key={`val-photo-${idx}`}
                      type="button"
                      onClick={() => setPhotoModalIndex(idx)}
                      className={`relative w-20 h-16 rounded-xl overflow-hidden border-2 shrink-0 cursor-pointer ${
                        idx === photoModalIndex ? 'border-blue-500' : 'border-slate-700 opacity-70'
                      }`}
                    >
                      <img src={u} alt={thumbLabel} className="w-full h-full object-cover" />
                      <span className="absolute inset-x-0 bottom-0 bg-slate-950/80 text-white text-[9px] font-bold py-0.5 text-center truncate px-1">
                        {thumbLabel}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* 📍 GPS MAP & VALIDATION MODAL (Khusus Super Admin & SPV Logistik) */}
      {gpsModalReport && canViewGpsValidation && (() => {
        const gpsData = getResolvedReportGps(gpsModalReport);
        const lat = gpsData.latitude;
        const lng = gpsData.longitude;
        const bbox = `${(lng - 0.008).toFixed(6)},${(lat - 0.006).toFixed(6)},${(lng + 0.008).toFixed(6)},${(lat + 0.006).toFixed(6)}`;
        const osmEmbedUrl = `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${lat.toFixed(6)},${lng.toFixed(6)}`;
        const catMeta = getCategoryMeta(gpsModalReport.category);

        return (
          <div
            className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4"
            onClick={() => setGpsModalReport(null)}
          >
            <div
              className="w-full max-w-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0">
                    <Navigation className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-sm font-black text-slate-900 dark:text-white">
                        Validasi Titik GPS Lapangan • {catMeta.label}
                      </h3>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-500/30">
                        Akses {roleGpsBadgeLabel}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      {gpsModalReport.driverName} (Armada: {resolveFleetInitial(gpsModalReport)}) • {gpsModalReport.issueItemName || catMeta.label}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setGpsModalReport(null)}
                  className="p-1.5 rounded-xl text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="p-4 space-y-4 max-h-[80vh] overflow-y-auto">
                {/* Embedded Map Preview */}
                <div className="rounded-xl overflow-hidden border border-slate-200 dark:border-slate-800 bg-slate-950 relative h-56">
                  <iframe
                    title={`Peta GPS ${gpsModalReport.id}`}
                    src={osmEmbedUrl}
                    className="w-full h-full border-0"
                    loading="lazy"
                  />
                  <div className="absolute bottom-2.5 left-2.5 right-2.5 bg-slate-950/90 backdrop-blur-xs border border-slate-800 rounded-xl px-3 py-2 flex items-center justify-between gap-2 flex-wrap">
                    <div className="text-xs">
                      <div className="font-black text-white flex items-center gap-1.5">
                        <MapPin className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                        <span>{formatCleanAreaName(gpsData.subAreaLabel)}</span>
                      </div>
                      <div className="text-[11px] font-mono tabular-nums text-blue-300">
                        Lat: {lat.toFixed(6)} • Lng: {lng.toFixed(6)}
                      </div>
                    </div>
                    <a
                      href={gpsData.gmapsUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-[11px] font-bold inline-flex items-center gap-1.5 shadow-xs"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      <span>Buka di Google Maps</span>
                    </a>
                  </div>
                </div>

                {/* Detail Barang & Lokasi */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
                  <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                      Detail Barang ({catMeta.label})
                    </span>
                    <div className="font-black text-slate-900 dark:text-white">
                      {gpsModalReport.issueItemCode ? `[${gpsModalReport.issueItemCode}] ` : ''}
                      {gpsModalReport.issueItemName || '-'}
                    </div>
                    <div className="text-slate-600 dark:text-slate-400">
                      Qty: {gpsModalReport.issueQty || '-'} • Faktur/SO: {gpsModalReport.invoiceNumber || '-'}
                    </div>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                      Titik Pelanggan &amp; Rute Kirim
                    </span>
                    <div className="font-black text-slate-900 dark:text-white">
                      {gpsModalReport.customerOutletName || formatCleanAreaName(gpsModalReport.areaName) || '-'}
                    </div>
                    <div className="text-slate-600 dark:text-slate-400">
                      Area Surat Jalan: {formatCleanAreaName(gpsModalReport.areaName)}
                    </div>
                  </div>
                </div>

                {/* Pilihan Status Validasi GPS */}
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block">
                    Keputusan Validasi Titik Koordinat GPS *
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <button
                      type="button"
                      onClick={() => setGpsModalDecision('valid')}
                      className={`p-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-2 cursor-pointer transition ${
                        gpsModalDecision === 'valid'
                          ? 'bg-emerald-600 border-emerald-600 text-white shadow-xs'
                          : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'
                      }`}
                    >
                      <CheckCircle2 className="w-4 h-4 shrink-0" />
                      <span>Titik GPS Valid (Sesuai Lokasi)</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setGpsModalDecision('mismatch')}
                      className={`p-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-2 cursor-pointer transition ${
                        gpsModalDecision === 'mismatch'
                          ? 'bg-rose-600 border-rose-600 text-white shadow-xs'
                          : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'
                      }`}
                    >
                      <AlertTriangle className="w-4 h-4 shrink-0" />
                      <span>Titik GPS Tidak Sesuai Lokasi</span>
                    </button>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block">
                    Catatan Validasi GPS (Opsional)
                  </label>
                  <input
                    type="text"
                    value={gpsModalNote}
                    onChange={(e) => setGpsModalNote(e.target.value)}
                    placeholder="Contoh: Titik koordinat GPS akurat berada di lokasi gudang toko penerima..."
                    className="w-full rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 px-3 py-2.5 text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div className="p-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setGpsModalReport(null)}
                  className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-bold cursor-pointer"
                >
                  Tutup
                </button>
                <button
                  type="button"
                  onClick={() => handleConfirmGpsValidation(gpsModalReport, gpsModalDecision, gpsModalNote)}
                  className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-black cursor-pointer shadow-xs"
                >
                  Simpan Validasi GPS
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Validation Decision Modal */}
      {validateModalReport && (
        <div
          className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setValidateModalReport(null)}
        >
          <div
            className="w-full max-w-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-indigo-600 text-white flex items-center justify-center">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-900 dark:text-white">
                    Validasi Laporan {getCategoryMeta(validateModalReport.category).label}
                  </h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    {validateModalReport.driverName} • {validateModalReport.issueItemName || 'Item Laporan'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setValidateModalReport(null)}
                className="p-1.5 rounded-xl text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 space-y-4">
              <div className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-3 text-xs space-y-1">
                <div className="font-bold text-slate-900 dark:text-white">
                  {validateModalReport.issueItemCode ? `[${validateModalReport.issueItemCode}] ` : ''}
                  {validateModalReport.issueItemName || '-'}{' '}
                  {validateModalReport.issueQty ? `(${validateModalReport.issueQty})` : ''}
                </div>
                <div className="text-slate-600 dark:text-slate-400">
                  Pelanggan: {validateModalReport.customerOutletName || '-'} • No. Faktur/SO: {validateModalReport.invoiceNumber || '-'}
                </div>
                <div className="text-slate-600 dark:text-slate-300 italic">
                  &quot;{extractCleanIssueNote(validateModalReport)}&quot;
                </div>
              </div>

              {canViewGpsValidation && (() => {
                const modalGps = getResolvedReportGps(validateModalReport);
                return (
                  <div className="p-3 rounded-xl bg-blue-50/70 dark:bg-blue-950/35 border border-blue-200 dark:border-blue-500/30 space-y-2">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <div className="flex items-center gap-1.5 text-xs font-black text-blue-700 dark:text-blue-300">
                        <MapPin className="w-3.5 h-3.5" />
                        <span>Validasi Titik GPS ({roleGpsBadgeLabel})</span>
                      </div>
                      <a
                        href={modalGps.gmapsUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[11px] font-bold text-blue-600 dark:text-blue-400 hover:underline inline-flex items-center gap-1"
                      >
                        <span>{modalGps.coordsFormatted}</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setGpsStatusInput('valid')}
                        className={`py-2 px-2.5 rounded-lg border text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer transition ${
                          gpsStatusInput === 'valid'
                            ? 'bg-emerald-600 border-emerald-600 text-white'
                            : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'
                        }`}
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>GPS Sesuai Lokasi</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setGpsStatusInput('mismatch')}
                        className={`py-2 px-2.5 rounded-lg border text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer transition ${
                          gpsStatusInput === 'mismatch'
                            ? 'bg-rose-600 border-rose-600 text-white'
                            : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'
                        }`}
                      >
                        <AlertTriangle className="w-3.5 h-3.5" />
                        <span>GPS Tidak Sesuai</span>
                      </button>
                    </div>
                  </div>
                );
              })()}

              <div className="space-y-1.5">
                <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block">
                  Keputusan Validasi *
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setDecisionInput('approved')}
                    className={`p-2.5 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer transition ${
                      decisionInput === 'approved'
                        ? 'bg-emerald-600 border-emerald-600 text-white shadow-xs'
                        : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                    <span>Setujui / Valid</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setDecisionInput('follow_up')}
                    className={`p-2.5 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer transition ${
                      decisionInput === 'follow_up'
                        ? 'bg-blue-600 border-blue-600 text-white shadow-xs'
                        : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    <span>Tindak Lanjut</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setDecisionInput('rejected')}
                    className={`p-2.5 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer transition ${
                      decisionInput === 'rejected'
                        ? 'bg-rose-600 border-rose-600 text-white shadow-xs'
                        : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    <XCircle className="w-4 h-4 shrink-0" />
                    <span>Tolak</span>
                  </button>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block">
                  Catatan / Instruksi Validasi ke Driver &amp; Helper
                </label>
                <textarea
                  value={validationNoteInput}
                  onChange={(e) => setValidationNoteInput(e.target.value)}
                  rows={3}
                  placeholder="Contoh: Barang retur sesuai foto telah divalidasi, serahkan ke gudang retur saat kembali ke pabrik..."
                  className="w-full rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 p-3 text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>

            <div className="p-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setValidateModalReport(null)}
                className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-bold cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleConfirmValidation}
                className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-black cursor-pointer shadow-xs"
              >
                Simpan Hasil Validasi
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal (Super Admin) */}
      {deleteTargetReport && isSuperAdmin && (
        <div
          className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setDeleteTargetReport(null)}
        >
          <div
            className="w-full max-w-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-2xl space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-100 dark:bg-rose-500/20 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-black text-slate-900 dark:text-white">
                  Hapus Laporan Barang?
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Laporan {deleteTargetReport.issueItemName || getCategoryMeta(deleteTargetReport.category).label} dari {deleteTargetReport.driverName} akan dihapus permanen.
                </p>
              </div>
            </div>
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setDeleteTargetReport(null)}
                className="px-3.5 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs font-bold text-slate-700 dark:text-slate-300 cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                className="px-3.5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-xs font-black text-white cursor-pointer"
              >
                Hapus Laporan
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
