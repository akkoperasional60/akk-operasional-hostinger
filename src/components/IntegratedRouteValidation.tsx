import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  Clock,
  ExternalLink,
  FileSpreadsheet,
  Filter,
  MapPin,
  Navigation,
  RefreshCw,
  Search,
  ShieldCheck,
  Smartphone,
  Store,
  Truck,
  X,
} from 'lucide-react';
import {
  formKirimStore,
  FormKirimInvoiceItem,
  FormKirimRecord,
} from '../services/formKirimStore';
import { logisticsStore } from '../services/store';
import { useToast } from '../context/ToastContext';
import type { Fleet, RetailStore, Schedule, TrackingEvaluation } from '../types';

type GpsMatchStatus = 'valid' | 'anomaly' | 'pending';
type HelperFormStatus = 'confirmed' | 'pending' | 'discrepancy';
type FilterMode = 'all' | 'valid' | 'anomaly' | 'pending_helper';

interface ThreeWayMatchRow {
  rowId: string;
  sourceType: 'form_kirim' | 'tracksolid_anomaly';
  formKirimId?: string;
  itemIds?: string[];
  plateNumber: string;
  armadaInitial: string;
  driverName: string;
  helperName: string;
  areaKirim: string;
  tanggalKirim: string;
  storeName: string;
  storeAddress: string;
  invoiceNumber: string;
  paymentCategory: 'COD' | 'TEMPO' | 'NON-FAKTUR';
  nominalFaktur: number;
  gpsStatus: GpsMatchStatus;
  gpsBadgeLabel: string;
  distanceKm: number | null;
  actualLat: number | null;
  actualLng: number | null;
  actualLocationLabel: string;
  storeLat: number | null;
  storeLng: number | null;
  helperStatus: HelperFormStatus;
  helperBadgeLabel: string;
  helperMethodLabel: string;
  helperConfirmedBy: string;
  helperConfirmedAt: string;
  helperNote: string;
  manualOverrideStatus?: 'valid' | 'anomaly' | null;
  manualNote?: string;
}

function haversineDistanceKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function normalizeText(value: string): string {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function findMatchingStore(customerName: string, customerAddress: string, stores: RetailStore[]): RetailStore | null {
  const target = normalizeText(customerName);
  if (!target) return null;

  // 1. Exact or strong substring match on storeName
  const tokens = target
    .split(' ')
    .filter(t => t.length >= 3 && !['toko', 'tk', 'ud', 'cv', 'pt', 'bp', 'bpk', 'ibu', 'bu', 'mart'].includes(t));

  let bestStore: RetailStore | null = null;
  let bestScore = 0;

  for (const s of stores) {
    const sName = normalizeText(s.storeName);
    if (!sName) continue;
    if (sName === target) return s;

    let score = 0;
    if (sName.includes(target) || target.includes(sName)) {
      score += 5;
    }
    for (const tk of tokens) {
      if (sName.includes(tk)) score += 2;
    }
    const addr = normalizeText(customerAddress);
    if (addr && s.kecamatan && addr.includes(normalizeText(s.kecamatan))) {
      score += 1;
    }
    if (score > bestScore && score >= 2) {
      bestScore = score;
      bestStore = s;
    }
  }

  return bestStore;
}

function formatRupiah(amount: number): string {
  return `Rp ${(Number(amount) || 0).toLocaleString('id-ID')}`;
}

function formatDistanceLabel(km: number | null): string {
  if (km === null || !Number.isFinite(km)) return '-';
  if (km < 1) return `${Math.round(km * 1000)} m`;
  return `${km.toFixed(1)} km`;
}

function loadSavedTrackingEvaluations(): TrackingEvaluation[] {
  try {
    const raw = localStorage.getItem('akk_tracking_evaluations_v1');
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {}
  return [];
}

export const IntegratedRouteValidation: React.FC = () => {
  const { addNotification } = useToast();
  const [formKirimList, setFormKirimList] = useState<FormKirimRecord[]>(() => formKirimStore.getAll());
  const [stores, setStores] = useState<RetailStore[]>(() => logisticsStore.getStores());
  const [evaluations, setEvaluations] = useState<TrackingEvaluation[]>(() => loadSavedTrackingEvaluations());
  const [fleets, setFleets] = useState<Fleet[]>(() => logisticsStore.getFleets());
  const [schedules, setSchedules] = useState<Schedule[]>(() => logisticsStore.getSchedules());
  const [currentUser] = useState(() => logisticsStore.getCurrentUser());

  const [searchQuery, setSearchQuery] = useState('');
  const [filterMode, setFilterMode] = useState<FilterMode>('all');
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncedAt, setLastSyncedAt] = useState<string>(() =>
    new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) + ' WIB'
  );

  // Local manual validation overrides & discrepancy tracking (for Tracksolid stops / instant UI responsiveness)
  const [manualOverrides, setManualOverrides] = useState<
    Record<string, { status: 'valid' | 'anomaly'; note: string }>
  >({});
  const [helperSimulationOverrides, setHelperSimulationOverrides] = useState<
    Record<string, { status: HelperFormStatus; method: string; note: string; by: string; at: string }>
  >({});

  // Selected row for Split-View Mobile Helper Preview
  const [selectedRowId, setSelectedRowId] = useState<string | null>(null);
  const [showPhoneDiscrepancyInput, setShowPhoneDiscrepancyInput] = useState(false);
  const [phoneDiscrepancyNote, setPhoneDiscrepancyNote] = useState('');

  // Modals
  const [mapModalRow, setMapModalRow] = useState<ThreeWayMatchRow | null>(null);
  const [detailModalRow, setDetailModalRow] = useState<ThreeWayMatchRow | null>(null);
  const [detailManualNote, setDetailManualNote] = useState('');

  useEffect(() => {
    void formKirimStore.hydrateFromServer();
    const unsubFk = formKirimStore.subscribe(() => {
      setFormKirimList([...formKirimStore.getAll()]);
    });
    const unsubStore = logisticsStore.subscribe(() => {
      setStores([...logisticsStore.getStores()]);
      setEvaluations([...loadSavedTrackingEvaluations()]);
      setFleets([...logisticsStore.getFleets()]);
      setSchedules([...logisticsStore.getSchedules()]);
    });
    return () => {
      unsubFk();
      unsubStore();
    };
  }, []);

  // Build Three-Way Matching rows combining:
  // 1) Admin Penjualan Form Kirim Invoices
  // 2) Master Peta Pelanggan (lat/lng)
  // 3) GPS Tracksolid / WanWay Evaluations & Locked Helper GPS
  const rows = useMemo<ThreeWayMatchRow[]>(() => {
    const result: ThreeWayMatchRow[] = [];

    const evalByPlate = new Map<string, TrackingEvaluation>();
    for (const ev of evaluations) {
      const cleanPlate = String(ev.plateNumber || '').replace(/\s+/g, '').toUpperCase();
      if (cleanPlate) evalByPlate.set(cleanPlate, ev);
    }

    const matchedStopKeys = new Set<string>();

    for (const fk of formKirimList) {
      const items = Array.isArray(fk.invoiceItems) ? fk.invoiceItems : [];
      const cleanPlate = String(fk.plateNumber || '').replace(/\s+/g, '').toUpperCase();
      const matchedEval = evalByPlate.get(cleanPlate);

      // Group invoices by customer on this Form Kirim
      const customerGroups = new Map<string, FormKirimInvoiceItem[]>();
      for (const item of items) {
        const key = normalizeText(item.namaPelanggan) || item.id;
        const arr = customerGroups.get(key) || [];
        arr.push(item);
        customerGroups.set(key, arr);
      }

      if (customerGroups.size === 0) {
        const matchedStore = findMatchingStore(fk.storeName, fk.storeAddress, stores);
        const rowId = `fk-${fk.id}`;
        const manual = manualOverrides[rowId];
        const helperSim = helperSimulationOverrides[rowId];

        const helperConfirmed =
          helperSim?.status === 'confirmed' || fk.driverStatus === 'delivered';
        const helperDiscrepancy = helperSim?.status === 'discrepancy';

        result.push({
          rowId,
          sourceType: 'form_kirim',
          formKirimId: fk.id,
          plateNumber: fk.plateNumber || '-',
          armadaInitial: fk.armadaInitial || fk.vehicleType || 'Unit',
          driverName: fk.driverName || '-',
          helperName: fk.helperName || '-',
          areaKirim: fk.areaKirim || '-',
          tanggalKirim: fk.tanggalKirim || '-',
          storeName: fk.storeName || '-',
          storeAddress: fk.storeAddress || '-',
          invoiceNumber: fk.noFaktur || fk.noFormKirim,
          paymentCategory: fk.metodePembayaran.includes('COD') ? 'COD' : 'TEMPO',
          nominalFaktur: Number(fk.totalNominalFaktur) || 0,
          gpsStatus: manual?.status || (matchedStore ? 'pending' : 'pending'),
          gpsBadgeLabel:
            manual?.status === 'valid'
              ? 'Sesuai Titik Outlet (Manual)'
              : manual?.status === 'anomaly'
              ? 'Anomali Rute (Manual)'
              : 'Menunggu Titik GPS',
          distanceKm: null,
          actualLat: null,
          actualLng: null,
          actualLocationLabel: 'Belum ada log berhenti GPS',
          storeLat: matchedStore ? matchedStore.latitude : null,
          storeLng: matchedStore ? matchedStore.longitude : null,
          helperStatus: helperDiscrepancy
            ? 'discrepancy'
            : helperConfirmed
            ? 'confirmed'
            : 'pending',
          helperBadgeLabel: helperDiscrepancy
            ? 'Selisih / Retur Dilaporkan'
            : helperConfirmed
            ? 'Faktur Dikonfirmasi Helper'
            : 'Menunggu Input',
          helperMethodLabel: helperSim?.method || fk.metodePembayaran,
          helperConfirmedBy: helperSim?.by || fk.helperName || fk.driverName || '-',
          helperConfirmedAt: helperSim?.at || fk.driverUpdatedAt || '',
          helperNote: helperSim?.note || fk.driverNotes || '',
          manualOverrideStatus: manual?.status || null,
          manualNote: manual?.note,
        });
        continue;
      }

      for (const [, groupItems] of customerGroups.entries()) {
        const first = groupItems[0];
        const rowId = `fk-${fk.id}-${first.id}`;
        const itemIds = groupItems.map(i => i.id);
        const totalNominal = groupItems.reduce((sum, i) => sum + (Number(i.nilaiFaktur) || 0), 0);
        const invoiceNumbers = groupItems.map(i => i.noFaktur).filter(Boolean).join(', ');
        const matchedStore = findMatchingStore(first.namaPelanggan, first.alamatPelanggan, stores);

        // Find GPS point from either Form Kirim locked GPS or Tracksolid RouteStop
        const latestLock =
          Array.isArray(first.gpsLockHistory) && first.gpsLockHistory.length > 0
            ? first.gpsLockHistory[first.gpsLockHistory.length - 1]
            : null;

        let actualLat: number | null =
          typeof latestLock?.lat === 'number'
            ? latestLock.lat
            : typeof first.lockedGpsLat === 'number'
            ? first.lockedGpsLat
            : null;
        let actualLng: number | null =
          typeof latestLock?.lng === 'number'
            ? latestLock.lng
            : typeof first.lockedGpsLng === 'number'
            ? first.lockedGpsLng
            : null;
        let actualLocationLabel = latestLock?.locationName || first.lockedGpsLocation || '';

        if (actualLat === null && matchedEval?.stops) {
          const matchedStop = matchedEval.stops.find(st => {
            const stName = normalizeText(st.matchedStoreName || st.locationName || '');
            const custNorm = normalizeText(first.namaPelanggan);
            return stName && custNorm && (stName.includes(custNorm) || custNorm.includes(stName));
          });
          if (matchedStop) {
            actualLat = matchedStop.latitude;
            actualLng = matchedStop.longitude;
            actualLocationLabel = matchedStop.locationName || matchedStop.matchedStoreName || 'Titik Tracksolid';
            matchedStopKeys.add(`${matchedEval.plateNumber}-${matchedStop.stopNumber}`);
          }
        }

        let distanceKm: number | null = null;
        let computedGpsStatus: GpsMatchStatus = 'pending';
        let gpsBadgeLabel = 'Menunggu Titik GPS';

        if (actualLat !== null && actualLng !== null && matchedStore) {
          distanceKm = haversineDistanceKm(
            actualLat,
            actualLng,
            matchedStore.latitude,
            matchedStore.longitude
          );
          if (distanceKm <= 0.6) {
            computedGpsStatus = 'valid';
            gpsBadgeLabel = 'Sesuai Titik Outlet';
          } else {
            computedGpsStatus = 'anomaly';
            gpsBadgeLabel = `Stop Ilegal - Jarak ${formatDistanceLabel(distanceKm)} dari Toko`;
          }
        } else if (actualLat !== null && actualLng !== null) {
          computedGpsStatus = 'valid';
          gpsBadgeLabel = 'Titik GPS Terkunci';
        }

        const manual = manualOverrides[rowId];
        if (manual?.status === 'valid') {
          computedGpsStatus = 'valid';
          gpsBadgeLabel = 'Sesuai Titik Outlet (Validasi SPV)';
        } else if (manual?.status === 'anomaly') {
          computedGpsStatus = 'anomaly';
          gpsBadgeLabel =
            distanceKm !== null
              ? `Anomali Rute - Jarak ${formatDistanceLabel(distanceKm)}`
              : 'Anomali Rute (Ditandai SPV)';
        }

        const helperSim = helperSimulationOverrides[rowId];
        const hasNoteDiscrepancy = Boolean(
          first.customerNote && /selisih|retur|batal|kurang|tutup/i.test(first.customerNote)
        );
        const isConfirmedOnStore = Boolean(
          first.metodeBayarAktual || first.driverUpdatedAt || first.ttdDataUrl
        );

        let helperStatus: HelperFormStatus = 'pending';
        let helperBadgeLabel = 'Menunggu Input';
        let helperMethodLabel: string = first.paymentCategory;

        if (helperSim) {
          helperStatus = helperSim.status;
          helperBadgeLabel =
            helperSim.status === 'confirmed'
              ? 'Faktur Dikonfirmasi Helper'
              : helperSim.status === 'discrepancy'
              ? 'Lapor Selisih / Retur'
              : 'Menunggu Input';
          helperMethodLabel = helperSim.method;
        } else if (hasNoteDiscrepancy) {
          helperStatus = 'discrepancy';
          helperBadgeLabel = 'Lapor Selisih / Retur';
          helperMethodLabel = first.metodeBayarAktual || 'Selisih / Retur';
        } else if (isConfirmedOnStore) {
          helperStatus = 'confirmed';
          helperBadgeLabel = 'Faktur Dikonfirmasi Helper';
          helperMethodLabel = first.metodeBayarAktual || 'Sesuai Tagihan';
        }

        result.push({
          rowId,
          sourceType: 'form_kirim',
          formKirimId: fk.id,
          itemIds,
          plateNumber: fk.plateNumber || '-',
          armadaInitial: fk.armadaInitial || fk.vehicleType || 'Armada',
          driverName: fk.driverName || '-',
          helperName: fk.helperName || '-',
          areaKirim: fk.areaKirim || '-',
          tanggalKirim: fk.tanggalKirim || '-',
          storeName: first.namaPelanggan,
          storeAddress: first.alamatPelanggan || '-',
          invoiceNumber: invoiceNumbers || first.noFaktur,
          paymentCategory: first.paymentCategory,
          nominalFaktur: totalNominal,
          gpsStatus: computedGpsStatus,
          gpsBadgeLabel,
          distanceKm,
          actualLat,
          actualLng,
          actualLocationLabel:
            actualLocationLabel ||
            (actualLat !== null ? `${actualLat.toFixed(5)}, ${actualLng?.toFixed(5)}` : 'Belum ada data titik berhenti'),
          storeLat: matchedStore ? matchedStore.latitude : null,
          storeLng: matchedStore ? matchedStore.longitude : null,
          helperStatus,
          helperBadgeLabel,
          helperMethodLabel,
          helperConfirmedBy: helperSim?.by || first.driverUpdatedBy || fk.helperName || '-',
          helperConfirmedAt: helperSim?.at || first.driverUpdatedAt || '',
          helperNote: helperSim?.note || first.customerNote || '',
          manualOverrideStatus: manual?.status || (first.financeMatchedChecked ? 'valid' : null),
          manualNote: manual?.note || first.financeItemNote,
        });
      }
    }

    // Also include unmatched Tracksolid / WanWay non-customer stops as route warnings
    for (const ev of evaluations) {
      const stops = Array.isArray(ev.stops) ? ev.stops : [];
      for (const st of stops) {
        const stopKey = `${ev.plateNumber}-${st.stopNumber}`;
        if (matchedStopKeys.has(stopKey)) continue;
        if (!st.isLongNonCustomerStop && st.isCustomerStore) continue;

        const rowId = `gps-${ev.plateNumber || 'unit'}-${st.stopNumber}`;
        const nearestStore = stores.reduce<{ store: RetailStore | null; distKm: number }>(
          (best, s) => {
            const d = haversineDistanceKm(st.latitude, st.longitude, s.latitude, s.longitude);
            return d < best.distKm ? { store: s, distKm: d } : best;
          },
          { store: null, distKm: Infinity }
        );
        const distKm = Number.isFinite(nearestStore.distKm) ? nearestStore.distKm : null;
        const manual = manualOverrides[rowId];
        const helperSim = helperSimulationOverrides[rowId];

        const status: GpsMatchStatus =
          manual?.status || (st.isLongNonCustomerStop || (distKm !== null && distKm > 0.8) ? 'anomaly' : 'valid');

        result.push({
          rowId,
          sourceType: 'tracksolid_anomaly',
          plateNumber: ev.plateNumber || '-',
          armadaInitial: ev.initialCode || 'GPS',
          driverName: ev.driverName || '-',
          helperName: ev.helperName || '-',
          areaKirim: st.locationName || 'Rute Tracksolid',
          tanggalKirim: ev.uploadedMonth || '-',
          storeName: st.matchedStoreName || nearestStore.store?.storeName || 'Area Non-Mitra',
          storeAddress: st.locationName || '-',
          invoiceNumber: `STOP-${st.stopNumber} (${st.startTime})`,
          paymentCategory: 'NON-FAKTUR',
          nominalFaktur: 0,
          gpsStatus: status,
          gpsBadgeLabel:
            status === 'valid'
              ? 'Sesuai Titik Outlet'
              : `Stop Ilegal - Jarak ${formatDistanceLabel(distKm)} dari Toko`,
          distanceKm: distKm,
          actualLat: st.latitude,
          actualLng: st.longitude,
          actualLocationLabel: `${st.locationName} (${st.durationMinutes} mnt)`,
          storeLat: nearestStore.store ? nearestStore.store.latitude : null,
          storeLng: nearestStore.store ? nearestStore.store.longitude : null,
          helperStatus: helperSim?.status || 'pending',
          helperBadgeLabel:
            helperSim?.status === 'confirmed'
              ? 'Faktur Dikonfirmasi Helper'
              : helperSim?.status === 'discrepancy'
              ? 'Lapor Selisih / Retur'
              : 'Menunggu Input',
          helperMethodLabel: helperSim?.method || 'Stop Tracksolid',
          helperConfirmedBy: helperSim?.by || ev.helperName || '-',
          helperConfirmedAt: helperSim?.at || '',
          helperNote: helperSim?.note || '',
          manualOverrideStatus: manual?.status || null,
          manualNote: manual?.note,
        });
      }
    }

    return result;
  }, [formKirimList, stores, evaluations, manualOverrides, helperSimulationOverrides]);

  // Filtered rows
  const filteredRows = useMemo(() => {
    const q = normalizeText(searchQuery);
    return rows.filter(r => {
      if (filterMode === 'valid' && r.gpsStatus !== 'valid') return false;
      if (filterMode === 'anomaly' && r.gpsStatus !== 'anomaly') return false;
      if (filterMode === 'pending_helper' && r.helperStatus !== 'pending') return false;
      if (!q) return true;
      const haystack = normalizeText(
        `${r.plateNumber} ${r.driverName} ${r.helperName} ${r.storeName} ${r.invoiceNumber} ${r.areaKirim}`
      );
      return haystack.includes(q);
    });
  }, [rows, filterMode, searchQuery]);

  // Keep selectedRow synchronized with available rows
  const selectedRow = useMemo(() => {
    if (selectedRowId) {
      const found = rows.find(r => r.rowId === selectedRowId);
      if (found) return found;
    }
    return filteredRows[0] || rows[0] || null;
  }, [rows, filteredRows, selectedRowId]);

  // Top 4 Metrics
  const metrics = useMemo(() => {
    const uniqueFleets = new Set<string>();
    for (const r of rows) {
      if (r.plateNumber && r.plateNumber !== '-') uniqueFleets.add(r.plateNumber);
    }
    for (const s of schedules) {
      if (s.status === 'in_transit' && s.fleet?.plateNumber) uniqueFleets.add(s.fleet.plateNumber);
    }
    const activeArmadaCount = uniqueFleets.size || fleets.filter(f => f.status === 'on-duty').length;
    const validGpsCount = rows.filter(r => r.gpsStatus === 'valid').length;
    const anomalyCount = rows.filter(r => r.gpsStatus === 'anomaly').length;
    const pendingHelperCount = rows.filter(r => r.helperStatus === 'pending').length;

    return {
      activeArmadaCount,
      validGpsCount,
      anomalyCount,
      pendingHelperCount,
    };
  }, [rows, schedules, fleets]);

  const handleSyncGps = async () => {
    setIsSyncing(true);
    try {
      await formKirimStore.hydrateFromServer(true, true);
      setFormKirimList([...formKirimStore.getAll()]);
      setStores([...logisticsStore.getStores()]);
      setEvaluations([...loadSavedTrackingEvaluations()]);
      setFleets([...logisticsStore.getFleets()]);
      setSchedules([...logisticsStore.getSchedules()]);
      const nowWib =
        new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) + ' WIB';
      setLastSyncedAt(nowWib);
      addNotification(
        'geofence',
        'Sync GPS Tracksolid Selesai',
        `Data rute Tracksolid, ${stores.length} titik toko pelanggan, dan Form Kirim Helper berhasil disinkronkan.`,
        false
      );
    } finally {
      setIsSyncing(false);
    }
  };

  const handleExportReport = () => {
    if (filteredRows.length === 0) {
      addNotification('schedule', 'Tidak Ada Data', 'Tidak ada baris validasi untuk diekspor.', false);
      return;
    }
    const headers = [
      'Plat Armada',
      'Kode Unit',
      'Supir',
      'Helper',
      'Area Kirim',
      'Nama Toko (Admin)',
      'No Faktur',
      'Kategori',
      'Nominal Faktur',
      'Status GPS',
      'Jarak ke Outlet',
      'Koordinat Aktual',
      'Status Form Helper',
      'Catatan Validasi',
    ];
    const csvRows = filteredRows.map(r => [
      `"${r.plateNumber}"`,
      `"${r.armadaInitial}"`,
      `"${r.driverName}"`,
      `"${r.helperName}"`,
      `"${r.areaKirim}"`,
      `"${r.storeName}"`,
      `"${r.invoiceNumber}"`,
      r.paymentCategory,
      r.nominalFaktur,
      `"${r.gpsBadgeLabel}"`,
      `"${formatDistanceLabel(r.distanceKm)}"`,
      `"${r.actualLat !== null && r.actualLng !== null ? `${r.actualLat}, ${r.actualLng}` : '-'}"`,
      `"${r.helperBadgeLabel}"`,
      `"${(r.manualNote || r.helperNote || '-').replace(/"/g, '""')}"`,
    ]);
    const csvContent =
      'data:text/csv;charset=utf-8,\uFEFF' +
      [headers.join(','), ...csvRows.map(row => row.join(','))].join('\n');
    const link = document.createElement('a');
    link.setAttribute('href', encodeURI(csvContent));
    link.setAttribute('download', `Validasi_Three_Way_Matching_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    addNotification('schedule', 'Export Laporan Berhasil', 'File CSV Validasi Three-Way Matching berhasil diunduh.', false);
  };

  const handleHelperPhoneAction = (action: 'confirm' | 'discrepancy') => {
    if (!selectedRow) return;
    const nowTime =
      new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) + ' WIB';
    const actorName = selectedRow.helperName && selectedRow.helperName !== '-'
      ? selectedRow.helperName
      : currentUser?.fullName || 'Helper Lapangan';

    if (action === 'discrepancy' && !showPhoneDiscrepancyInput) {
      setShowPhoneDiscrepancyInput(true);
      setPhoneDiscrepancyNote(selectedRow.helperNote || '');
      return;
    }

    const noteText =
      action === 'discrepancy'
        ? phoneDiscrepancyNote.trim() || 'Selisih / retur barang dilaporkan dari Form Manifest Helper'
        : 'Manifest kiriman dikonfirmasi sesuai tagihan tanpa foto';

    if (selectedRow.sourceType === 'form_kirim' && selectedRow.formKirimId && selectedRow.itemIds?.length) {
      const targetFk = formKirimList.find(fk => fk.id === selectedRow.formKirimId);
      if (targetFk?.invoiceItems) {
        const idSet = new Set(selectedRow.itemIds);
        const nowIso = new Date().toISOString();
        const updatedItems = targetFk.invoiceItems.map(item => {
          if (!idSet.has(item.id)) return item;
          if (action === 'confirm') {
            return {
              ...item,
              metodeBayarAktual: (item.paymentCategory === 'COD' ? 'Tunai' : 'TTD') as 'Tunai' | 'TTD',
              nominalDiterima: item.paymentCategory === 'COD' ? item.nilaiFaktur : 0,
              driverUpdatedBy: actorName,
              driverUpdatedAt: nowIso,
              customerNote: noteText,
              lockedGpsLat: item.lockedGpsLat ?? selectedRow.storeLat ?? -8.2192,
              lockedGpsLng: item.lockedGpsLng ?? selectedRow.storeLng ?? 114.3691,
              lockedGpsLocation: item.lockedGpsLocation || selectedRow.storeName,
              lockedGpsAt: item.lockedGpsAt || nowIso,
            };
          }
          return {
            ...item,
            driverUpdatedBy: actorName,
            driverUpdatedAt: nowIso,
            customerNote: `[SELISIH/RETUR] ${noteText}`,
          };
        });
        formKirimStore.updateInvoiceItems(targetFk.id, updatedItems, noteText);
      }
    }

    setHelperSimulationOverrides(prev => ({
      ...prev,
      [selectedRow.rowId]: {
        status: action === 'confirm' ? 'confirmed' : 'discrepancy',
        method: action === 'confirm' ? 'Sesuai Tagihan (Tanpa Foto)' : 'Lapor Selisih / Retur',
        note: noteText,
        by: actorName,
        at: nowTime,
      },
    }));
    setShowPhoneDiscrepancyInput(false);
    setPhoneDiscrepancyNote('');

    addNotification(
      action === 'confirm' ? 'delivery' : 'sla_warning',
      action === 'confirm' ? 'Manifest Dikonfirmasi Helper' : 'Selisih / Retur Dicatat',
      `${selectedRow.storeName} (${selectedRow.invoiceNumber}) telah diperbarui melalui Form Manifest Helper.`,
      action !== 'confirm'
    );
  };

  const handleSaveManualValidation = (status: 'valid' | 'anomaly') => {
    if (!detailModalRow) return;
    const note = detailManualNote.trim() || (status === 'valid' ? 'Divalidasi manual sesuai oleh SPV Logistik' : 'Ditandai anomali stop luar rute oleh SPV Logistik');

    if (detailModalRow.sourceType === 'form_kirim' && detailModalRow.formKirimId && detailModalRow.itemIds?.length) {
      const targetFk = formKirimList.find(fk => fk.id === detailModalRow.formKirimId);
      if (targetFk?.invoiceItems) {
        const idSet = new Set(detailModalRow.itemIds);
        const nowIso = new Date().toISOString();
        const updatedItems = targetFk.invoiceItems.map(item =>
          idSet.has(item.id)
            ? {
                ...item,
                financeMatchedChecked: status === 'valid',
                financeMatchedCheckedAt: nowIso,
                financeMatchedCheckedBy: currentUser?.fullName || 'SPV Logistik',
                financeItemNote: note,
              }
            : item
        );
        formKirimStore.updateInvoiceItems(targetFk.id, updatedItems);
      }
    }

    setManualOverrides(prev => ({
      ...prev,
      [detailModalRow.rowId]: { status, note },
    }));
    addNotification(
      status === 'valid' ? 'checker' : 'geofence',
      status === 'valid' ? 'Validasi Manual: Sesuai' : 'Validasi Manual: Anomali',
      `${detailModalRow.storeName} (${detailModalRow.plateNumber}) diperbarui.`,
      status !== 'valid'
    );
    setDetailModalRow(null);
  };

  return (
    <div className="akk-flat-threeway w-full max-w-full bg-slate-50 dark:bg-[#0F172A] px-3 sm:px-6 py-5 space-y-5 animate-in fade-in duration-200">
      {/* 1. Header & Ringkasan Metrik Terpadu */}
      <div className="bg-white dark:bg-[#162234] border border-slate-200 dark:border-[#24344D] rounded-xl p-5 sm:p-6 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex items-start sm:items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-blue-50 dark:bg-blue-500/15 border border-blue-100 dark:border-blue-500/30 flex items-center justify-center text-blue-600 dark:text-blue-400 shrink-0">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white tracking-tight">
              Validasi Rute &amp; Form Kiriman
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
              Three-Way Matching terpadu: Data Faktur Admin Penjualan, Titik Stop GPS Tracksolid/WanWay, dan Konfirmasi Form Helper · Sinkron terakhir {lastSyncedAt}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap shrink-0">
          <button
            type="button"
            onClick={handleSyncGps}
            disabled={isSyncing}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white border border-blue-700 text-xs sm:text-sm font-semibold transition-colors cursor-pointer whitespace-nowrap shrink-0"
          >
            <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
            <span>{isSyncing ? 'Menyinkronkan...' : 'Sync GPS Tracksolid'}</span>
          </button>

          <button
            type="button"
            onClick={handleExportReport}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white dark:bg-[#162234] hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-[#24344D] text-xs sm:text-sm font-semibold transition-colors cursor-pointer whitespace-nowrap shrink-0"
          >
            <FileSpreadsheet className="w-4 h-4 text-green-600" />
            <span>Export Laporan</span>
          </button>
        </div>
      </div>

      {/* 4 Kartu Metrik Flat Sejajar */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-[#162234] border border-slate-200 dark:border-[#24344D] rounded-xl p-5 flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
              Total Armada Berjalan
            </p>
            <div className="text-2xl font-bold text-slate-900 dark:text-white font-mono tabular-nums mt-1.5">
              {metrics.activeArmadaCount} <span className="text-sm font-semibold text-slate-500">Unit</span>
            </div>
            <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1.5">
              Terpantau di GPS &amp; Form Kirim
            </p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-600 dark:text-slate-300 shrink-0">
            <Truck className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white dark:bg-[#162234] border border-slate-200 dark:border-[#24344D] rounded-xl p-5 flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
              Toko Tervalidasi Sesuai GPS
            </p>
            <div className="text-2xl font-bold text-slate-900 dark:text-white font-mono tabular-nums mt-1.5">
              {metrics.validGpsCount} <span className="text-sm font-semibold text-slate-500">Toko</span>
            </div>
            <span className="inline-flex items-center gap-1 mt-2 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-green-100 text-green-700">
              <CheckCircle2 className="w-3 h-3" />
              Sesuai Titik Outlet
            </span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-green-50 dark:bg-green-500/15 border border-green-200 dark:border-green-500/30 flex items-center justify-center text-green-600 shrink-0">
            <MapPin className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white dark:bg-[#162234] border border-slate-200 dark:border-[#24344D] rounded-xl p-5 flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
              Peringatan Stop Luar Rute
            </p>
            <div className="text-2xl font-bold text-slate-900 dark:text-white font-mono tabular-nums mt-1.5">
              {metrics.anomalyCount} <span className="text-sm font-semibold text-slate-500">Titik</span>
            </div>
            <span className="inline-flex items-center gap-1 mt-2 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-red-100 text-red-700">
              <AlertTriangle className="w-3 h-3" />
              Anomali / Non-Mitra
            </span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-red-50 dark:bg-red-500/15 border border-red-200 dark:border-red-500/30 flex items-center justify-center text-red-600 shrink-0">
            <AlertTriangle className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white dark:bg-[#162234] border border-slate-200 dark:border-[#24344D] rounded-xl p-5 flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
              Form Helper Pending
            </p>
            <div className="text-2xl font-bold text-slate-900 dark:text-white font-mono tabular-nums mt-1.5">
              {metrics.pendingHelperCount} <span className="text-sm font-semibold text-slate-500">Faktur</span>
            </div>
            <span className="inline-flex items-center gap-1 mt-2 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-amber-100 text-amber-800">
              <Clock className="w-3 h-3" />
              Menunggu Konfirmasi
            </span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-500/15 border border-amber-200 dark:border-amber-500/30 flex items-center justify-center text-amber-600 shrink-0">
            <Smartphone className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Main Split View: 8-col Three-Way Matching Table + 4-col Helper Phone Preview */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 items-start">
        {/* 2. Tabel Validasi Silang (8 Kolom) */}
        <div className="xl:col-span-8 space-y-4">
          {/* Search & Filter Toolbar */}
          <div className="bg-white dark:bg-[#162234] border border-slate-200 dark:border-[#24344D] rounded-xl p-4 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Cari plat nomor, supir/helper, nama toko, atau no faktur..."
                className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-[#0F172A] border border-slate-200 dark:border-[#24344D] rounded-xl text-xs sm:text-sm text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:border-blue-500"
              />
            </div>

            <div className="flex items-center gap-1.5 flex-wrap">
              <Filter className="w-3.5 h-3.5 text-slate-400 hidden sm:block mr-1" />
              {(
                [
                  { id: 'all', label: `Semua (${rows.length})` },
                  { id: 'valid', label: 'Sesuai GPS' },
                  { id: 'anomaly', label: 'Luar Rute' },
                  { id: 'pending_helper', label: 'Pending Helper' },
                ] as const
              ).map(tab => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setFilterMode(tab.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors cursor-pointer whitespace-nowrap ${
                    filterMode === tab.id
                      ? 'bg-blue-600 text-white border-blue-700'
                      : 'bg-white dark:bg-[#0F172A] text-slate-600 dark:text-slate-300 border-slate-200 dark:border-[#24344D] hover:bg-slate-50'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* Tabel Three-Way Matching */}
          <div className="bg-white dark:bg-[#162234] border border-slate-200 dark:border-[#24344D] rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200 dark:border-[#24344D] flex items-center justify-between gap-2">
              <div>
                <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                  Matriks Validasi Silang (Admin · GPS Tracksolid · Form Helper)
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Klik salah satu baris untuk mensimulasikan atau memperbarui konfirmasi pada Preview HP Helper di sebelah kanan.
                </p>
              </div>
              <span className="text-xs font-mono tabular-nums text-slate-500 dark:text-slate-400 shrink-0">
                {filteredRows.length} baris
              </span>
            </div>

            {filteredRows.length === 0 ? (
              <div className="p-10 text-center space-y-2.5">
                <div className="w-11 h-11 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-400 mx-auto">
                  <Store className="w-5 h-5" />
                </div>
                <p className="text-sm font-semibold text-slate-800 dark:text-white">
                  Belum Ada Data Validasi Rute yang Cocok
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto">
                  Ubah kata kunci pencarian atau tekan Sync GPS Tracksolid untuk memuat ulang data faktur Admin Penjualan dan rute armada.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-[#24344D] text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                      <th className="py-3 px-4">Info Armada</th>
                      <th className="py-3 px-4">Data Admin (Target)</th>
                      <th className="py-3 px-4">Validasi GPS (Aktual)</th>
                      <th className="py-3 px-4">Status Form Helper</th>
                      <th className="py-3 px-4 text-right">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-[#24344D]">
                    {filteredRows.map(row => {
                      const isSelected = selectedRow?.rowId === row.rowId;
                      return (
                        <tr
                          key={row.rowId}
                          onClick={() => {
                            setSelectedRowId(row.rowId);
                            setShowPhoneDiscrepancyInput(false);
                          }}
                          className={`cursor-pointer transition-colors align-top ${
                            isSelected
                              ? 'bg-blue-50/70 dark:bg-blue-500/10'
                              : 'hover:bg-slate-50/80 dark:hover:bg-slate-800/40'
                          }`}
                        >
                          {/* 1. Info Armada */}
                          <td className="py-3.5 px-4">
                            <div className="flex items-center gap-2">
                              <span className="font-mono font-bold text-slate-900 dark:text-white bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-2 py-0.5 rounded-md">
                                {row.plateNumber}
                              </span>
                              <span className="text-[11px] text-slate-500 dark:text-slate-400">
                                {row.armadaInitial}
                              </span>
                            </div>
                            <div className="text-xs font-medium text-slate-800 dark:text-slate-200 mt-1.5">
                              Supir: {row.driverName}
                            </div>
                            <div className="text-[11px] text-slate-500 dark:text-slate-400">
                              Helper: {row.helperName} · {row.areaKirim}
                            </div>
                          </td>

                          {/* 2. Data Admin (Target) */}
                          <td className="py-3.5 px-4">
                            <div className="font-semibold text-slate-900 dark:text-white">
                              {row.storeName}
                            </div>
                            <div className="text-[11px] font-mono text-slate-500 dark:text-slate-400 mt-0.5">
                              {row.invoiceNumber}
                            </div>
                            <div className="text-xs font-bold font-mono tabular-nums text-slate-800 dark:text-slate-100 mt-1">
                              {row.nominalFaktur > 0 ? formatRupiah(row.nominalFaktur) : 'Non-Faktur (Stop GPS)'}
                            </div>
                          </td>

                          {/* 3. Validasi GPS (Aktual) */}
                          <td className="py-3.5 px-4">
                            <span
                              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-semibold ${
                                row.gpsStatus === 'valid'
                                  ? 'bg-green-100 text-green-700'
                                  : row.gpsStatus === 'anomaly'
                                  ? 'bg-red-100 text-red-700'
                                  : 'bg-amber-100 text-amber-800'
                              }`}
                            >
                              {row.gpsStatus === 'valid' ? (
                                <CheckCircle2 className="w-3 h-3 shrink-0" />
                              ) : row.gpsStatus === 'anomaly' ? (
                                <AlertTriangle className="w-3 h-3 shrink-0" />
                              ) : (
                                <Clock className="w-3 h-3 shrink-0" />
                              )}
                              <span>{row.gpsBadgeLabel}</span>
                            </span>
                            <div className="mt-1.5 flex items-center gap-2">
                              <button
                                type="button"
                                onClick={e => {
                                  e.stopPropagation();
                                  setMapModalRow(row);
                                }}
                                className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
                              >
                                <MapPin className="w-3 h-3" />
                                <span>Lihat Peta</span>
                              </button>
                            </div>
                          </td>

                          {/* 4. Status Form Helper */}
                          <td className="py-3.5 px-4">
                            <span
                              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-semibold ${
                                row.helperStatus === 'confirmed'
                                  ? 'bg-blue-100 text-blue-700'
                                  : row.helperStatus === 'discrepancy'
                                  ? 'bg-red-100 text-red-700'
                                  : 'bg-amber-100 text-amber-800'
                              }`}
                            >
                              {row.helperStatus === 'confirmed' ? (
                                <Check className="w-3 h-3 shrink-0" />
                              ) : row.helperStatus === 'discrepancy' ? (
                                <AlertTriangle className="w-3 h-3 shrink-0" />
                              ) : (
                                <Clock className="w-3 h-3 shrink-0" />
                              )}
                              <span>{row.helperBadgeLabel}</span>
                            </span>
                            <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                              {row.helperMethodLabel} · Tanpa Foto
                            </div>
                          </td>

                          {/* 5. Aksi */}
                          <td className="py-3.5 px-4 text-right whitespace-nowrap">
                            <button
                              type="button"
                              onClick={e => {
                                e.stopPropagation();
                                setDetailManualNote(row.manualNote || '');
                                setDetailModalRow(row);
                              }}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white dark:bg-[#0F172A] hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-[#24344D] text-xs font-semibold transition-colors cursor-pointer"
                            >
                              <span>Detail / Validasi Manual</span>
                            </button>
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

        {/* 3. Sidebar Kanan: Preview HP Helper (4 Kolom) */}
        <div className="xl:col-span-4 xl:sticky xl:top-5">
          <div className="bg-white dark:bg-[#162234] border border-slate-200 dark:border-[#24344D] rounded-xl p-5 space-y-4">
            <div className="flex items-center justify-between gap-2">
              <div>
                <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                  Preview HP Helper (Mobile View)
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Simulasi Form Manifest tanpa unggah kamera
                </p>
              </div>
              <span className="text-[11px] font-semibold px-2 py-0.5 rounded-md bg-blue-50 dark:bg-blue-500/15 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-500/30">
                Live Sync
              </span>
            </div>

            {/* Container Berbentuk HP */}
            <div className="max-w-sm mx-auto rounded-[2.25rem] border-[7px] border-slate-900 dark:border-slate-700 bg-slate-50 dark:bg-[#0F172A] overflow-hidden">
              {/* Notch & Status Bar */}
              <div className="bg-slate-900 dark:bg-slate-800 text-white px-5 pt-2 pb-2.5 flex items-center justify-between text-[10px] font-mono">
                <span>09:41 WIB</span>
                <div className="w-16 h-3.5 rounded-full bg-slate-800 dark:bg-slate-950 border border-slate-700" />
                <span>GPS Aktif</span>
              </div>

              {/* Mobile App Header */}
              <div className="bg-white dark:bg-[#162234] border-b border-slate-200 dark:border-[#24344D] px-4 py-3.5 flex items-center justify-between">
                <div>
                  <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                    AKK Pengiriman · Helper
                  </div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                    Form Manifest Kiriman
                  </h3>
                </div>
                <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-500/15 border border-blue-100 dark:border-blue-500/30 flex items-center justify-center text-blue-600 dark:text-blue-400">
                  <Truck className="w-4 h-4" />
                </div>
              </div>

              {/* Mobile Body */}
              <div className="p-4 space-y-3.5">
                {selectedRow ? (
                  <>
                    <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 px-1">
                      <span>Armada: <strong className="text-slate-800 dark:text-slate-200">{selectedRow.plateNumber}</strong></span>
                      <span className="font-mono">{selectedRow.paymentCategory}</span>
                    </div>

                    {/* Kartu Detail (Bukan Kamera) */}
                    <div className="bg-white dark:bg-[#162234] border border-slate-200 dark:border-[#24344D] rounded-xl p-4 space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="text-[11px] text-slate-500 dark:text-slate-400">
                            Outlet Tujuan
                          </div>
                          <div className="text-base font-bold text-slate-900 dark:text-white mt-0.5">
                            {selectedRow.storeName}
                          </div>
                          <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                            {selectedRow.storeAddress}
                          </div>
                        </div>
                        <span
                          className={`px-2 py-0.5 rounded-md text-[10px] font-semibold shrink-0 ${
                            selectedRow.gpsStatus === 'valid'
                              ? 'bg-green-100 text-green-700'
                              : selectedRow.gpsStatus === 'anomaly'
                              ? 'bg-red-100 text-red-700'
                              : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {selectedRow.gpsStatus === 'valid'
                            ? 'GPS Cocok'
                            : selectedRow.gpsStatus === 'anomaly'
                            ? 'Luar Rute'
                            : 'GPS Standby'}
                        </span>
                      </div>

                      <div className="border-t border-slate-100 dark:border-slate-800 pt-3 grid grid-cols-2 gap-3">
                        <div>
                          <div className="text-[11px] text-slate-500 dark:text-slate-400">
                            No. Faktur
                          </div>
                          <div className="text-xs font-bold font-mono text-slate-800 dark:text-slate-100 mt-0.5 break-all">
                            {selectedRow.invoiceNumber}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-[11px] text-slate-500 dark:text-slate-400">
                            Total Tagihan
                          </div>
                          <div className="text-sm font-bold font-mono tabular-nums text-blue-600 dark:text-blue-400 mt-0.5">
                            {selectedRow.nominalFaktur > 0 ? formatRupiah(selectedRow.nominalFaktur) : 'Rp 0'}
                          </div>
                        </div>
                      </div>

                      <div className="border-t border-slate-100 dark:border-slate-800 pt-2.5 flex items-center justify-between text-[11px]">
                        <span className="text-slate-500 dark:text-slate-400">Status Manifest:</span>
                        <span
                          className={`font-semibold ${
                            selectedRow.helperStatus === 'confirmed'
                              ? 'text-blue-600 dark:text-blue-400'
                              : selectedRow.helperStatus === 'discrepancy'
                              ? 'text-red-600 dark:text-red-400'
                              : 'text-amber-600 dark:text-amber-400'
                          }`}
                        >
                          {selectedRow.helperBadgeLabel}
                        </span>
                      </div>
                    </div>

                    {showPhoneDiscrepancyInput && (
                      <div className="bg-white dark:bg-[#162234] border border-slate-200 dark:border-[#24344D] rounded-xl p-3 space-y-2">
                        <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                          Keterangan Selisih / Retur
                        </label>
                        <textarea
                          rows={2}
                          value={phoneDiscrepancyNote}
                          onChange={e => setPhoneDiscrepancyNote(e.target.value)}
                          placeholder="Contoh: Kurang 1 dus kemasan atau toko tutup..."
                          className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-[#0F172A] border border-slate-200 dark:border-[#24344D] rounded-lg text-slate-800 dark:text-slate-100 focus:outline-none focus:border-blue-500"
                        />
                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => setShowPhoneDiscrepancyInput(false)}
                            className="px-2.5 py-1 rounded-lg text-[11px] font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                          >
                            Batal
                          </button>
                          <button
                            type="button"
                            onClick={() => handleHelperPhoneAction('discrepancy')}
                            className="px-3 py-1 rounded-lg text-[11px] font-semibold bg-slate-800 text-white hover:bg-slate-900 cursor-pointer"
                          >
                            Kirim Laporan
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Tombol Aksi di HP (Menggantikan Unggah Kamera Lama) */}
                    <div className="space-y-2 pt-1">
                      <button
                        type="button"
                        onClick={() => handleHelperPhoneAction('confirm')}
                        className="w-full py-3 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs sm:text-sm font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        <span>Konfirmasi Sesuai Tagihan</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleHelperPhoneAction('discrepancy')}
                        className="w-full py-2 px-3 rounded-xl bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-medium flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                      >
                        <AlertTriangle className="w-3.5 h-3.5" />
                        <span>Lapor Selisih / Retur</span>
                      </button>
                    </div>
                  </>
                ) : (
                  <div className="bg-white dark:bg-[#162234] border border-slate-200 dark:border-[#24344D] rounded-xl p-6 text-center text-xs text-slate-500 dark:text-slate-400">
                    Pilih baris kiriman di sebelah kiri untuk menampilkan Form Manifest Kiriman Helper.
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Modal: Lihat Peta (Pin Outlet vs GPS Aktual) */}
      {mapModalRow && (
        <div
          className="akk-flat-threeway fixed inset-0 z-[1300] bg-slate-900/50 flex items-center justify-center p-4"
          onClick={() => setMapModalRow(null)}
        >
          <div
            className="w-full max-w-lg bg-white dark:bg-[#162234] border border-slate-200 dark:border-[#24344D] rounded-xl overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            <div className="px-5 py-4 border-b border-slate-200 dark:border-[#24344D] flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-lg bg-blue-50 dark:bg-blue-500/15 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                  <MapPin className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                    Perbandingan Titik Peta &amp; GPS
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {mapModalRow.plateNumber} · {mapModalRow.storeName}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setMapModalRow(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-[#0F172A] border border-slate-200 dark:border-[#24344D] space-y-1">
                  <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                    Pin Peta Pelanggan (Master)
                  </div>
                  <div className="font-bold text-slate-900 dark:text-white">{mapModalRow.storeName}</div>
                  <div className="font-mono text-[11px] text-slate-600 dark:text-slate-300">
                    {mapModalRow.storeLat !== null && mapModalRow.storeLng !== null
                      ? `${mapModalRow.storeLat.toFixed(6)}, ${mapModalRow.storeLng.toFixed(6)}`
                      : 'Outlet belum dipetakan di Peta Pelanggan'}
                  </div>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-[#0F172A] border border-slate-200 dark:border-[#24344D] space-y-1">
                  <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                    Titik Stop GPS Aktual
                  </div>
                  <div className="font-bold text-slate-900 dark:text-white">
                    {mapModalRow.actualLocationLabel}
                  </div>
                  <div className="font-mono text-[11px] text-slate-600 dark:text-slate-300">
                    {mapModalRow.actualLat !== null && mapModalRow.actualLng !== null
                      ? `${mapModalRow.actualLat.toFixed(6)}, ${mapModalRow.actualLng.toFixed(6)}`
                      : 'Koordinat belum terkunci'}
                  </div>
                </div>
              </div>

              <div className="p-3.5 rounded-xl border border-slate-200 dark:border-[#24344D] flex items-center justify-between gap-3">
                <div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400">Status Kesesuaian Radius</div>
                  <div className="font-bold text-slate-900 dark:text-white mt-0.5">
                    {mapModalRow.gpsBadgeLabel}
                  </div>
                </div>
                {(mapModalRow.actualLat !== null && mapModalRow.actualLng !== null) ||
                (mapModalRow.storeLat !== null && mapModalRow.storeLng !== null) ? (
                  <a
                    href={`https://www.google.com/maps?q=${mapModalRow.actualLat ?? mapModalRow.storeLat},${mapModalRow.actualLng ?? mapModalRow.storeLng}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shrink-0"
                  >
                    <Navigation className="w-3.5 h-3.5" />
                    <span>Buka Google Maps</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Detail / Validasi Manual (Three-Way Matching) */}
      {detailModalRow && (
        <div
          className="akk-flat-threeway fixed inset-0 z-[1300] bg-slate-900/50 flex items-center justify-center p-4"
          onClick={() => setDetailModalRow(null)}
        >
          <div
            className="w-full max-w-xl bg-white dark:bg-[#162234] border border-slate-200 dark:border-[#24344D] rounded-xl overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            <div className="px-5 py-4 border-b border-slate-200 dark:border-[#24344D] flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  Detail &amp; Validasi Manual Three-Way Matching
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {detailModalRow.plateNumber} · {detailModalRow.driverName} / {detailModalRow.helperName}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setDetailModalRow(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-[#0F172A] border border-slate-200 dark:border-[#24344D]">
                  <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                    1. Data Admin Penjualan
                  </div>
                  <div className="font-bold text-slate-900 dark:text-white mt-1">
                    {detailModalRow.storeName}
                  </div>
                  <div className="font-mono text-[11px] text-slate-600 dark:text-slate-300 mt-0.5">
                    {detailModalRow.invoiceNumber}
                  </div>
                  <div className="font-bold font-mono text-blue-600 dark:text-blue-400 mt-1">
                    {formatRupiah(detailModalRow.nominalFaktur)}
                  </div>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-[#0F172A] border border-slate-200 dark:border-[#24344D]">
                  <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                    2. GPS Tracksolid / Peta
                  </div>
                  <div className="font-bold text-slate-900 dark:text-white mt-1">
                    {detailModalRow.gpsBadgeLabel}
                  </div>
                  <div className="text-[11px] text-slate-600 dark:text-slate-300 mt-0.5">
                    Jarak: {formatDistanceLabel(detailModalRow.distanceKm)}
                  </div>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-[#0F172A] border border-slate-200 dark:border-[#24344D]">
                  <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                    3. Form Manifest Helper
                  </div>
                  <div className="font-bold text-slate-900 dark:text-white mt-1">
                    {detailModalRow.helperBadgeLabel}
                  </div>
                  <div className="text-[11px] text-slate-600 dark:text-slate-300 mt-0.5">
                    Oleh: {detailModalRow.helperConfirmedBy}
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1.5">
                  Catatan Audit / Validasi SPV Logistik
                </label>
                <textarea
                  rows={3}
                  value={detailManualNote}
                  onChange={e => setDetailManualNote(e.target.value)}
                  placeholder="Tuliskan catatan hasil pengecekan tiga arah (mis. titik parkir di seberang jalan outlet)..."
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-[#0F172A] border border-slate-200 dark:border-[#24344D] text-xs text-slate-800 dark:text-slate-100 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="flex flex-wrap items-center justify-end gap-2.5 pt-2 border-t border-slate-200 dark:border-[#24344D]">
                <button
                  type="button"
                  onClick={() => handleSaveManualValidation('anomaly')}
                  className="px-4 py-2 rounded-xl bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 text-xs font-semibold cursor-pointer"
                >
                  Tandai Anomali Rute
                </button>
                <button
                  type="button"
                  onClick={() => handleSaveManualValidation('valid')}
                  className="px-4 py-2 rounded-xl bg-green-600 hover:bg-green-700 text-white border border-green-700 text-xs font-semibold cursor-pointer"
                >
                  Validasi Sesuai (Approved)
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default IntegratedRouteValidation;
