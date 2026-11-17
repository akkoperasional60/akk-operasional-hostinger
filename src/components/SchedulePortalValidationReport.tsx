import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  Calendar,
  CheckCircle2,
  ClipboardCheck,
  Download,
  FileCheck2,
  MapPin,
  RefreshCw,
  Search,
  ShieldCheck,
  Truck,
  XCircle
} from 'lucide-react';
import { DriverShiftCheckin, DriverVehicleChecklist, OutboundWaybill, Schedule } from '../types';
import { logisticsStore } from '../services/store';
import { driverShiftService } from '../services/driverShiftService';
import { driverChecklistService } from '../services/driverChecklistService';
import { driverWaybillService } from '../services/driverWaybillService';
import { branchStore } from '../services/branchStore';
import { standardizeAreaName } from '../utils/areaNormalizer';
import { getLocalDateStr } from '../services/driverReportService';
import { getScheduleCalendarDateObj } from '../data/adminSchedule';

export type PortalScheduleValidationStatus = 'cocok' | 'tidak_cocok';

export interface PortalScheduleValidationRow {
  rowKey: string;
  date: string;
  branchId: string;
  branchName: string;
  crewName: string;
  status: PortalScheduleValidationStatus;
  mismatchReasonLabel?: string;
  mismatchFields: ('Peran' | 'Area' | 'Armada')[];
  mismatchDetails: string[];
  // Data dari Jadwal Resmi
  scheduleId?: string;
  scheduledRole?: 'driver' | 'helper';
  scheduledRoleLabel?: string;
  scheduledArea?: string;
  scheduledArmada?: string;
  // Data dari Portal Driver/Helper
  shiftId?: string;
  portalTime?: string;
  portalRole?: 'driver' | 'helper';
  portalRoleLabel?: string;
  portalArea?: string;
  portalArmada?: string;
  // Tahapan operasional lanjutan
  hasChecklist: boolean;
  checklistTime?: string;
  hasSecurityValidation: boolean;
  securityTime?: string;
  hasGateOut: boolean;
  gateOutTime?: string;
}

interface SchedulePortalValidationReportProps {
  initialDate?: string;
  initialBranchId?: string;
  onBack?: () => void;
  backLabel?: string;
}

function getScheduleIsoDate(s: Schedule): string {
  const calObj = getScheduleCalendarDateObj(s);
  if (calObj && !isNaN(calObj.getTime())) {
    return `${calObj.getFullYear()}-${String(calObj.getMonth() + 1).padStart(2, '0')}-${String(calObj.getDate()).padStart(2, '0')}`;
  }
  const raw = s.departureDate || s.returnDate || s.deliveryDate || s.createdAt || '';
  return String(raw).slice(0, 10);
}

function normalizeCrewMatch(nameA?: string, nameB?: string): boolean {
  const a = String(nameA || '').trim().toLowerCase();
  const b = String(nameB || '').trim().toLowerCase();
  if (!a || !b || a === '-' || b === '-' || a === 'tanpa helper' || b === 'tanpa helper') return false;
  if (a === b || a.includes(b) || b.includes(a)) return true;
  if (
    (a.includes('saiful') || a.includes('saifur')) &&
    (b.includes('saiful') || b.includes('saifur')) &&
    a.includes('rizal') &&
    b.includes('rizal')
  ) {
    return true;
  }
  const tokA = a.split(/\s+/).filter(t => t.length >= 4);
  const tokB = b.split(/\s+/).filter(t => t.length >= 4);
  return tokA.length > 0 && tokB.length > 0 && tokA[0] === tokB[0];
}

function normalizePlateClean(raw?: string): string {
  return String(raw || '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');
}

function formatFleetDisplay(initial?: string, plate?: string, armadaStr?: string): string {
  const cleanPlate = String(plate || '').trim();
  const cleanInitial = String(initial || '').trim();
  if (cleanInitial && cleanPlate && cleanPlate !== '-') {
    return `${cleanInitial} · ${cleanPlate}`;
  }
  if (cleanPlate && cleanPlate !== '-') return cleanPlate;
  if (armadaStr && armadaStr.trim() !== '-') return armadaStr.trim();
  return '-';
}

function doesFleetMatch(
  sch: Schedule,
  shift: DriverShiftCheckin
): boolean {
  const fleets = logisticsStore.getFleets();
  const schFleetObj =
    sch.fleet || fleets.find(f => f.id === sch.fleetId);

  const schPlate = normalizePlateClean(schFleetObj?.plateNumber || sch.armada);
  const shiftPlate = normalizePlateClean(shift.plateNumber);
  if (schPlate && shiftPlate && (schPlate === shiftPlate || schPlate.includes(shiftPlate) || shiftPlate.includes(schPlate))) {
    return true;
  }

  const schInit = normalizePlateClean(schFleetObj?.initialCode || sch.armada?.split('/')[0]);
  const shiftInit = normalizePlateClean(shift.fleetInitialCode);
  if (schInit && shiftInit && schInit === shiftInit) {
    return true;
  }

  if (sch.fleetId && shift.fleetId && sch.fleetId === shift.fleetId) {
    return true;
  }

  return false;
}

export const SchedulePortalValidationReport: React.FC<SchedulePortalValidationReportProps> = ({
  initialDate,
  initialBranchId,
  onBack,
  backLabel = 'Kembali'
}) => {
  const [selectedDate, setSelectedDate] = useState<string>(initialDate || getLocalDateStr());
  const [selectedBranchId, setSelectedBranchId] = useState<string>(initialBranchId || 'all');
  const [statusFilter, setStatusFilter] = useState<'all' | PortalScheduleValidationStatus>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isSyncing, setIsSyncing] = useState<boolean>(false);

  const [schedules, setSchedules] = useState<Schedule[]>(() => logisticsStore.getSchedules());
  const [shifts, setShifts] = useState<DriverShiftCheckin[]>(() => driverShiftService.getShifts());
  const [checklists, setChecklists] = useState<DriverVehicleChecklist[]>(() => driverChecklistService.getChecklists());
  const [waybillsMap, setWaybillsMap] = useState<Record<string, OutboundWaybill>>(() => driverWaybillService.getStoredWaybills());
  const [branches, setBranches] = useState(() => branchStore.getActiveBranches());

  const loadPersistedValidation = async (targetDate: string, targetBranchId: string) => {
    try {
      const qs = new URLSearchParams({ date: targetDate, branchId: targetBranchId || 'all' });
      await fetch(`/api/portal-validations?${qs.toString()}`, { credentials: 'same-origin' });
    } catch {}
  };

  const refreshAllFromServer = async () => {
    setIsSyncing(true);
    try {
      await Promise.all([
        logisticsStore.hydrateOperationalDataFromHostinger(true),
        driverShiftService.syncFromServer(),
        driverChecklistService.syncFromServer(),
        loadPersistedValidation(selectedDate, selectedBranchId)
      ]);
    } catch {
      // Fallback to cached memory state
    } finally {
      setSchedules([...logisticsStore.getSchedules()]);
      setShifts([...driverShiftService.getShifts()]);
      setChecklists([...driverChecklistService.getChecklists()]);
      setWaybillsMap({ ...driverWaybillService.getStoredWaybills() });
      setBranches([...branchStore.getActiveBranches()]);
      setIsSyncing(false);
    }
  };

  useEffect(() => {
    void loadPersistedValidation(selectedDate, selectedBranchId);
  }, [selectedDate, selectedBranchId]);

  useEffect(() => {
    void refreshAllFromServer();
    const unsubStore = logisticsStore.subscribe(() => {
      setSchedules([...logisticsStore.getSchedules()]);
    });
    const onShiftUpdate = () => setShifts([...driverShiftService.getShifts()]);
    const onChecklistUpdate = () => setChecklists([...driverChecklistService.getChecklists()]);
    const onWaybillUpdate = () => setWaybillsMap({ ...driverWaybillService.getStoredWaybills() });

    window.addEventListener('driver-shift-updated', onShiftUpdate);
    window.addEventListener('driver-checklist-updated', onChecklistUpdate);
    window.addEventListener('driver-waybill-updated', onWaybillUpdate);

    return () => {
      unsubStore();
      window.removeEventListener('driver-shift-updated', onShiftUpdate);
      window.removeEventListener('driver-checklist-updated', onChecklistUpdate);
      window.removeEventListener('driver-waybill-updated', onWaybillUpdate);
    };
  }, []);

  const branchNameLookup = useMemo(() => {
    const map: Record<string, string> = {};
    branches.forEach(b => {
      map[b.id] = b.name;
    });
    return map;
  }, [branches]);

  const allValidationRows = useMemo<PortalScheduleValidationRow[]>(() => {
    const targetDate = selectedDate;
    const fleets = logisticsStore.getFleets();
    const waybillsList = Object.values(waybillsMap);

    // 1. Shifts pada tanggal terpilih
    const shiftsOnDate = shifts.filter(s => {
      const sDate = (s.date || s.createdAt || '').slice(0, 10);
      return sDate === targetDate;
    });

    // 2. Jadwal Resmi pada tanggal terpilih
    const schedulesOnDate = schedules.filter(sch => getScheduleIsoDate(sch) === targetDate);

    // Track shifts yang berhasil dipasangkan dengan jadwal resmi
    const matchedShiftIds = new Set<string>();
    const rows: PortalScheduleValidationRow[] = [];

    // Helper cek status checklist, security, dan gate-out untuk kru / armada pada tanggal ini
    const resolveProgressFlags = (
      crewName: string,
      shift?: DriverShiftCheckin,
      sch?: Schedule
    ) => {
      const matchingChecklist = checklists.find(c => {
        if (c.date !== targetDate) return false;
        const nameMatch = normalizeCrewMatch(c.driverName, crewName);
        const plateMatch = shift?.plateNumber
          ? normalizePlateClean(c.plateNumber) === normalizePlateClean(shift.plateNumber)
          : sch?.fleet?.plateNumber
          ? normalizePlateClean(c.plateNumber) === normalizePlateClean(sch.fleet.plateNumber)
          : false;
        return (shift?.checkinRole !== 'helper' && nameMatch) || plateMatch;
      });

      const matchingWb = waybillsList.find(wb => {
        if (wb.date !== targetDate && !(sch && wb.scheduleId === sch.id)) return false;
        if (sch && wb.scheduleId === sch.id) return true;
        if (shift && (wb.scheduleId === `PORTAL-${shift.id}` || normalizePlateClean(wb.fleet?.plateNumber) === normalizePlateClean(shift.plateNumber))) {
          return true;
        }
        return false;
      });

      const hasChecklist = Boolean(shift?.checklistCompletedAt || matchingChecklist);
      const checklistTime = shift?.checklistCompletedAt
        ? new Date(shift.checklistCompletedAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) + ' WIB'
        : matchingChecklist?.time
        ? `${matchingChecklist.time} WIB`
        : undefined;

      const hasSecurityValidation = Boolean(shift?.securityValidatedAt || matchingWb?.securitySigned);
      const securityTime = shift?.securityValidatedAt
        ? new Date(shift.securityValidatedAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) + ' WIB'
        : matchingWb?.securitySignedAt || undefined;

      const hasGateOut = Boolean(
        shift?.gateOutAt ||
          sch?.actualDeparture ||
          sch?.status === 'in_transit' ||
          sch?.status === 'delivered' ||
          matchingWb?.status === 'in_transit' ||
          matchingWb?.status === 'gate_out' ||
          matchingWb?.status === 'delivered'
      );
      const gateOutTime = shift?.gateOutAt
        ? new Date(shift.gateOutAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) + ' WIB'
        : sch?.actualDeparture
        ? new Date(sch.actualDeparture).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) + ' WIB'
        : matchingWb?.gateOutTime || undefined;

      return {
        hasChecklist,
        checklistTime,
        hasSecurityValidation,
        securityTime,
        hasGateOut,
        gateOutTime
      };
    };

    // Extract slots (Driver Utama, Helper 1, Helper 2) dari setiap Jadwal Resmi
    schedulesOnDate.forEach(sch => {
      const schBranchId = branchStore.getScheduleBranchId(sch.id, sch.originName, sch.fleetId);
      const schBranchName = branchNameLookup[schBranchId] || schBranchId;
      const schFleetObj = sch.fleet || fleets.find(f => f.id === sch.fleetId);
      const schArmadaLabel = formatFleetDisplay(schFleetObj?.initialCode, schFleetObj?.plateNumber, sch.armada);
      const schAreaRaw = (sch.areaName || sch.store?.city || sch.store?.storeName || '-').trim();
      const schAreaStd = standardizeAreaName(schAreaRaw);

      const slots: Array<{
        slotKey: string;
        crewName: string;
        role: 'driver' | 'helper';
        roleLabel: string;
      }> = [];

      const mainDriver = (sch.crew?.name || '').trim();
      if (mainDriver && mainDriver !== '-' && !mainDriver.toLowerCase().includes('driver armada terkait')) {
        slots.push({ slotKey: 'drv', crewName: mainDriver, role: 'driver', roleLabel: 'Driver' });
      }
      const helper1 = (sch.crewHelper?.name || '').trim();
      if (helper1 && helper1 !== '-' && helper1.toLowerCase() !== 'tanpa helper') {
        slots.push({ slotKey: 'hlp1', crewName: helper1, role: 'helper', roleLabel: 'Helper 1' });
      }
      const helper2 = (sch.crewHelper2?.name || '').trim();
      if (helper2 && helper2 !== '-' && helper2.toLowerCase() !== 'tanpa helper') {
        slots.push({ slotKey: 'hlp2', crewName: helper2, role: 'helper', roleLabel: 'Helper 2' });
      }
      if (sch.backupCrewName && sch.backupCrewName.trim() && sch.backupCrewName !== '-') {
        const bPos = sch.backupPosition === 'helper' || sch.backupPosition === 'helper2' ? 'helper' : 'driver';
        slots.push({
          slotKey: 'bkp',
          crewName: sch.backupCrewName.trim(),
          role: bPos,
          roleLabel: bPos === 'helper' ? 'Helper Pengganti' : 'Driver Pengganti'
        });
      }

      slots.forEach(slot => {
        const matchedShift = shiftsOnDate.find(s => normalizeCrewMatch(s.driverName, slot.crewName));
        if (matchedShift) {
          matchedShiftIds.add(matchedShift.id);
        }

        const progress = resolveProgressFlags(slot.crewName, matchedShift, sch);

        if (!matchedShift) {
          rows.push({
            rowKey: `${sch.id}-${slot.slotKey}`,
            date: targetDate,
            branchId: schBranchId,
            branchName: schBranchName,
            crewName: slot.crewName,
            status: 'tidak_cocok',
            mismatchReasonLabel: 'Belum Check-In Portal',
            mismatchFields: [],
            mismatchDetails: ['Kru belum melakukan Check-In Mandiri di Portal Driver/Helper hari ini.'],
            scheduleId: sch.id,
            scheduledRole: slot.role,
            scheduledRoleLabel: slot.roleLabel,
            scheduledArea: schAreaRaw,
            scheduledArmada: schArmadaLabel,
            ...progress
          });
          return;
        }

        const portalRole: 'driver' | 'helper' =
          matchedShift.checkinRole ||
          (String(matchedShift.shiftName || matchedShift.notes || '').toLowerCase().includes('helper') ? 'helper' : 'driver');
        const portalAreaRaw = (matchedShift.selectedArea || '-').trim();
        const portalAreaStd = standardizeAreaName(portalAreaRaw);
        const portalArmadaLabel = formatFleetDisplay(matchedShift.fleetInitialCode, matchedShift.plateNumber);

        const mismatchFields: ('Peran' | 'Area' | 'Armada')[] = [];
        const mismatchDetails: string[] = [];

        if (portalRole !== slot.role) {
          mismatchFields.push('Peran');
          mismatchDetails.push(
            `Peran jadwal: ${slot.role === 'driver' ? 'Driver' : 'Helper'} vs Portal: ${portalRole === 'driver' ? 'Driver' : 'Helper'}`
          );
        }

        const areaMatched =
          Boolean(schAreaStd && portalAreaStd) &&
          (schAreaStd === portalAreaStd ||
            schAreaStd.toLowerCase().includes(portalAreaStd.toLowerCase()) ||
            portalAreaStd.toLowerCase().includes(schAreaStd.toLowerCase()));
        if (!areaMatched) {
          mismatchFields.push('Area');
          mismatchDetails.push(`Area jadwal: ${schAreaRaw} vs Portal: ${portalAreaRaw}`);
        }

        if (!doesFleetMatch(sch, matchedShift)) {
          mismatchFields.push('Armada');
          mismatchDetails.push(`Armada jadwal: ${schArmadaLabel} vs Portal: ${portalArmadaLabel}`);
        }

        rows.push({
          rowKey: `${sch.id}-${slot.slotKey}-${matchedShift.id}`,
          date: targetDate,
          branchId: schBranchId,
          branchName: schBranchName,
          crewName: slot.crewName,
          status: mismatchFields.length === 0 ? 'cocok' : 'tidak_cocok',
          mismatchReasonLabel: mismatchFields.length === 0 ? 'Cocok' : `Selisih: ${mismatchFields.join(', ')}`,
          mismatchFields,
          mismatchDetails,
          scheduleId: sch.id,
          scheduledRole: slot.role,
          scheduledRoleLabel: slot.roleLabel,
          scheduledArea: schAreaRaw,
          scheduledArmada: schArmadaLabel,
          shiftId: matchedShift.id,
          portalTime: matchedShift.checkinTimeFormatted,
          portalRole,
          portalRoleLabel: portalRole === 'driver' ? 'Driver' : 'Helper',
          portalArea: portalAreaRaw,
          portalArmada: portalArmadaLabel,
          ...progress
        });
      });
    });

    // 3. Input Portal Driver/Helper yang belum ada di Jadwal Resmi hari terpilih
    shiftsOnDate.forEach(s => {
      if (matchedShiftIds.has(s.id)) return;
      const portalBranchId =
        branchStore.getFleetBranchId(s.fleetId || '', s.plateNumber, s.fleetInitialCode) ||
        branchStore.getCrewBranchId(s.driverId, s.driverName);
      const portalBranchName = branchNameLookup[portalBranchId] || portalBranchId;
      const portalRole: 'driver' | 'helper' =
        s.checkinRole || (String(s.shiftName || s.notes || '').toLowerCase().includes('helper') ? 'helper' : 'driver');
      const portalAreaRaw = (s.selectedArea || '-').trim();
      const portalArmadaLabel = formatFleetDisplay(s.fleetInitialCode, s.plateNumber);
      const progress = resolveProgressFlags(s.driverName, s);

      rows.push({
        rowKey: `portal-only-${s.id}`,
        date: targetDate,
        branchId: portalBranchId,
        branchName: portalBranchName,
        crewName: s.driverName,
        status: 'tidak_cocok',
        mismatchReasonLabel: 'Belum Terjadwal Admin',
        mismatchFields: [],
        mismatchDetails: ['Kru sudah Check-In Portal, namun nama kru belum masuk di Jadwal Pengiriman Admin hari ini.'],
        shiftId: s.id,
        portalTime: s.checkinTimeFormatted,
        portalRole,
        portalRoleLabel: portalRole === 'driver' ? 'Driver' : 'Helper',
        portalArea: portalAreaRaw,
        portalArmada: portalArmadaLabel,
        ...progress
      });
    });

    const rank: Record<PortalScheduleValidationStatus, number> = {
      tidak_cocok: 0,
      cocok: 1
    };
    return rows.sort((a, b) => rank[a.status] - rank[b.status] || a.crewName.localeCompare(b.crewName, 'id'));
  }, [selectedDate, schedules, shifts, checklists, waybillsMap, branchNameLookup]);

  const branchFilteredRows = useMemo(() => {
    if (selectedBranchId === 'all') return allValidationRows;
    return allValidationRows.filter(r => r.branchId === selectedBranchId);
  }, [allValidationRows, selectedBranchId]);

  const kpiStats = useMemo(() => {
    return {
      total: branchFilteredRows.length,
      cocok: branchFilteredRows.filter(r => r.status === 'cocok').length,
      tidakCocok: branchFilteredRows.filter(r => r.status === 'tidak_cocok').length
    };
  }, [branchFilteredRows]);

  const saveValidationSnapshot = async () => {
    if (branchFilteredRows.length === 0) return;
    try {
      const currentUser = logisticsStore.getCurrentUser();
      await fetch('/api/portal-validations', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: `VAL-${selectedDate}-${selectedBranchId || 'all'}`,
          validationDate: selectedDate,
          branchId: selectedBranchId || 'all',
          cocokCount: kpiStats.cocok,
          tidakCocokCount: kpiStats.tidakCocok,
          totalCount: kpiStats.total,
          rows: branchFilteredRows,
          validatedBy: currentUser?.fullName || 'Admin Operasional'
        })
      });
    } catch {}
  };

  useEffect(() => {
    if (branchFilteredRows.length === 0) return;
    const timer = setTimeout(() => {
      void saveValidationSnapshot();
    }, 600);
    return () => clearTimeout(timer);
  }, [selectedDate, selectedBranchId, kpiStats.cocok, kpiStats.tidakCocok, kpiStats.total]);

  const filteredRows = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return branchFilteredRows.filter(r => {
      if (statusFilter !== 'all' && r.status !== statusFilter) return false;
      if (!q) return true;
      return (
        r.crewName.toLowerCase().includes(q) ||
        (r.scheduledArea || '').toLowerCase().includes(q) ||
        (r.portalArea || '').toLowerCase().includes(q) ||
        (r.scheduledArmada || '').toLowerCase().includes(q) ||
        (r.portalArmada || '').toLowerCase().includes(q)
      );
    });
  }, [branchFilteredRows, statusFilter, searchQuery]);

  const handleExportCsv = () => {
    const header = [
      'Tanggal',
      'Cabang',
      'Nama Kru',
      'Status Validasi',
      'Peran Jadwal',
      'Area Jadwal',
      'Armada Jadwal',
      'Jam Check-In Portal',
      'Peran Portal',
      'Area Portal',
      'Armada Portal',
      'Selisih / Catatan',
      'Checklist Armada',
      'Validasi Security',
      'Gate-Out'
    ];
    const esc = (v?: string) => `"${String(v || '-').replace(/"/g, '""')}"`;
    const statusTextMap: Record<PortalScheduleValidationStatus, string> = {
      cocok: 'Cocok',
      tidak_cocok: 'Tidak Cocok'
    };
    const lines = [
      header.join(','),
      ...filteredRows.map(r =>
        [
          esc(r.date),
          esc(r.branchName),
          esc(r.crewName),
          esc(r.status === 'cocok' ? statusTextMap.cocok : `${statusTextMap.tidak_cocok} (${r.mismatchReasonLabel || 'Selisih'})`),
          esc(r.scheduledRoleLabel || '-'),
          esc(r.scheduledArea || '-'),
          esc(r.scheduledArmada || '-'),
          esc(r.portalTime || '-'),
          esc(r.portalRoleLabel || '-'),
          esc(r.portalArea || '-'),
          esc(r.portalArmada || '-'),
          esc(r.mismatchDetails.join(' | ') || 'Sesuai'),
          esc(r.hasChecklist ? `Selesai (${r.checklistTime || 'OK'})` : 'Belum'),
          esc(r.hasSecurityValidation ? `Tervalidasi (${r.securityTime || 'OK'})` : 'Belum'),
          esc(r.hasGateOut ? `Gate-Out (${r.gateOutTime || 'OK'})` : 'Belum')
        ].join(',')
      )
    ];
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `validasi-jadwal-vs-portal-${selectedDate}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4 animate-in fade-in duration-200">
      {/* Header Card */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 sm:p-5 shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div className="flex items-start sm:items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-indigo-50 dark:bg-indigo-500/15 border border-indigo-200 dark:border-indigo-500/30 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
            <FileCheck2 className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-white tracking-tight">
              Validasi Portal Driver &amp; Helper
            </h2>
            <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
              Perbandingan kesesuaian Jadwal Pengiriman dengan Check-In Portal Driver &amp; Helper.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap shrink-0">
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold border border-slate-200 dark:border-slate-700 transition cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>{backLabel}</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => void refreshAllFromServer()}
            disabled={isSyncing}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold border border-slate-200 dark:border-slate-700 transition cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin text-blue-500' : ''}`} />
            <span>{isSyncing ? 'Menyegarkan...' : 'Segarkan'}</span>
          </button>

          <button
            type="button"
            onClick={handleExportCsv}
            disabled={filteredRows.length === 0}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-200 dark:disabled:bg-slate-800 text-white disabled:text-slate-400 text-xs font-black shadow-xs transition cursor-pointer disabled:cursor-not-allowed"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* KPI Cards (Ringkas: Total Diperiksa, Cocok, Tidak Cocok) */}
      <div className="grid grid-cols-3 gap-2.5">
        <button
          type="button"
          onClick={() => setStatusFilter('all')}
          className={`p-3.5 rounded-2xl border text-left transition cursor-pointer ${
            statusFilter === 'all'
              ? 'bg-blue-50 dark:bg-blue-500/15 border-blue-400 dark:border-blue-500/50'
              : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-slate-300'
          }`}
        >
          <div className="text-[11px] font-bold text-slate-500 dark:text-slate-400">Total Diperiksa</div>
          <div className="text-xl font-black text-slate-900 dark:text-white mt-0.5 tabular-nums">{kpiStats.total}</div>
        </button>

        <button
          type="button"
          onClick={() => setStatusFilter('cocok')}
          className={`p-3.5 rounded-2xl border text-left transition cursor-pointer ${
            statusFilter === 'cocok'
              ? 'bg-emerald-50 dark:bg-emerald-500/15 border-emerald-400 dark:border-emerald-500/50'
              : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-emerald-300'
          }`}
        >
          <div className="text-[11px] font-bold text-emerald-700 dark:text-emerald-400 flex items-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Cocok</span>
          </div>
          <div className="text-xl font-black text-emerald-600 dark:text-emerald-400 mt-0.5 tabular-nums">{kpiStats.cocok}</div>
        </button>

        <button
          type="button"
          onClick={() => setStatusFilter('tidak_cocok')}
          className={`p-3.5 rounded-2xl border text-left transition cursor-pointer ${
            statusFilter === 'tidak_cocok'
              ? 'bg-rose-50 dark:bg-rose-500/15 border-rose-400 dark:border-rose-500/50'
              : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-rose-300'
          }`}
        >
          <div className="text-[11px] font-bold text-rose-700 dark:text-rose-400 flex items-center gap-1">
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>Tidak Cocok</span>
          </div>
          <div className="text-xl font-black text-rose-600 dark:text-rose-400 mt-0.5 tabular-nums">{kpiStats.tidakCocok}</div>
        </button>
      </div>

      {/* Filter Bar */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-3.5 shadow-xs flex flex-col md:flex-row md:items-center gap-3">
        <div className="relative flex-1 min-w-0">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            id="validation-portal-search"
            name="validationPortalSearch"
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Cari nama kru, area kiriman, atau plat armada..."
            aria-label="Cari nama kru, area kiriman, atau plat armada"
            className="w-full pl-10 pr-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-blue-500"
          />
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1.5">
            <label htmlFor="validation-portal-date" className="text-[11px] font-bold text-slate-500 dark:text-slate-400 flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5 text-blue-500" />
              <span>Tanggal:</span>
            </label>
            <input
              id="validation-portal-date"
              name="validationPortalDate"
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="px-2.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-900 dark:text-white focus:outline-none focus:border-blue-500 cursor-pointer"
            />
          </div>

          <div className="flex items-center gap-1.5">
            <label htmlFor="validation-portal-branch" className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
              Cabang:
            </label>
            <select
              id="validation-portal-branch"
              name="validationPortalBranch"
              value={selectedBranchId}
              onChange={(e) => setSelectedBranchId(e.target.value)}
              className="px-2.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-900 dark:text-white focus:outline-none focus:border-blue-500 cursor-pointer"
            >
              <option value="all">Semua Cabang</option>
              {branches.map(b => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Comparison Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xs overflow-hidden">
        {filteredRows.length === 0 ? (
          <div className="py-12 px-4 text-center space-y-2">
            <FileCheck2 className="w-9 h-9 text-slate-400 mx-auto" />
            <div className="text-sm font-bold text-slate-700 dark:text-slate-200">
              Belum Ada Data Jadwal maupun Check-In Portal pada {selectedDate}
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto">
              Pilih tanggal lain atau pastikan Driver/Helper sudah melakukan Check-In Mandiri di Portal Driver Mobile maupun Admin sudah menyimpan jadwal pengiriman.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-950/90 border-b border-slate-200 dark:border-slate-800 text-[11px] font-black uppercase text-slate-500 dark:text-slate-400">
                  <th className="py-3 px-3.5">Kru &amp; Cabang</th>
                  <th className="py-3 px-3.5">Jadwal Resmi (Admin)</th>
                  <th className="py-3 px-3.5">Input Check-In Portal</th>
                  <th className="py-3 px-3.5">Status Validasi</th>
                  <th className="py-3 px-3.5">Progres Lapangan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {filteredRows.map(row => (
                  <tr key={row.rowKey} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition align-top">
                    <td className="py-3 px-3.5">
                      <div className="font-black text-slate-900 dark:text-white">{row.crewName}</div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">{row.branchName}</div>
                      {row.portalTime && (
                        <div className="text-[10px] font-mono text-emerald-600 dark:text-emerald-400 mt-0.5">
                          Check-In: {row.portalTime}
                        </div>
                      )}
                    </td>

                    <td className="py-3 px-3.5 space-y-1">
                      {row.scheduleId ? (
                        <>
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-bold text-[10px]">
                              {row.scheduledRoleLabel}
                            </span>
                            <span className="font-mono font-bold text-blue-600 dark:text-blue-400">
                              {row.scheduledArmada}
                            </span>
                          </div>
                          <div className="text-[11px] text-slate-600 dark:text-slate-300 flex items-center gap-1">
                            <MapPin className="w-3 h-3 text-rose-500 shrink-0" />
                            <span>{row.scheduledArea}</span>
                          </div>
                        </>
                      ) : (
                        <span className="text-[11px] text-slate-400 italic">Belum ada di Jadwal Admin</span>
                      )}
                    </td>

                    <td className="py-3 px-3.5 space-y-1">
                      {row.shiftId ? (
                        <>
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className={`px-2 py-0.5 rounded font-bold text-[10px] ${
                              row.portalRole === 'helper'
                                ? 'bg-cyan-100 dark:bg-cyan-500/20 text-cyan-800 dark:text-cyan-300'
                                : 'bg-amber-100 dark:bg-amber-500/20 text-amber-800 dark:text-amber-300'
                            }`}>
                              {row.portalRoleLabel}
                            </span>
                            <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                              {row.portalArmada}
                            </span>
                          </div>
                          <div className="text-[11px] text-slate-600 dark:text-slate-300 flex items-center gap-1">
                            <MapPin className="w-3 h-3 text-emerald-500 shrink-0" />
                            <span>{row.portalArea}</span>
                          </div>
                        </>
                      ) : (
                        <span className="text-[11px] text-slate-400 italic">Belum Check-In di Portal</span>
                      )}
                    </td>

                    <td className="py-3 px-3.5 space-y-1.5">
                      {row.status === 'cocok' ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-100 dark:bg-emerald-500/20 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-500/30 font-black text-[11px]">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Cocok</span>
                        </span>
                      ) : (
                        <div className="space-y-1">
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-rose-100 dark:bg-rose-500/20 text-rose-800 dark:text-rose-300 border border-rose-300 dark:border-rose-500/30 font-black text-[11px]">
                            <XCircle className="w-3.5 h-3.5" />
                            <span>Tidak Cocok{row.mismatchReasonLabel ? ` · ${row.mismatchReasonLabel}` : ''}</span>
                          </span>
                          {row.mismatchDetails.length > 0 && (
                            <div className="text-[11px] text-slate-600 dark:text-slate-300 leading-snug space-y-0.5">
                              {row.mismatchDetails.map((d, i) => (
                                <div key={i}>• {d}</div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </td>

                    <td className="py-3 px-3.5">
                      <div className="flex flex-col gap-1 text-[10px] font-bold">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded w-fit ${
                          row.hasChecklist
                            ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-500'
                        }`}>
                          <ClipboardCheck className="w-3 h-3" />
                          <span>Checklist {row.hasChecklist ? `✓ ${row.checklistTime || ''}` : '-'}</span>
                        </span>
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded w-fit ${
                          row.hasSecurityValidation
                            ? 'bg-cyan-500/15 text-cyan-700 dark:text-cyan-300'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-500'
                        }`}>
                          <ShieldCheck className="w-3 h-3" />
                          <span>Security {row.hasSecurityValidation ? `✓ ${row.securityTime || ''}` : '-'}</span>
                        </span>
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded w-fit ${
                          row.hasGateOut
                            ? 'bg-blue-500/15 text-blue-700 dark:text-blue-300'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-500'
                        }`}>
                          <Truck className="w-3 h-3" />
                          <span>Gate-Out {row.hasGateOut ? `✓ ${row.gateOutTime || ''}` : '-'}</span>
                        </span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
