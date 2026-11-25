import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import {
  ArrowUpRight, Camera, Check, CheckCircle2, ChevronDown, ChevronRight, ClipboardCheck,
  CloudOff, FileClock, FileText, ImagePlus, LoaderCircle, LogOut, MapPin, RefreshCw, RotateCcw,
  Search, ShieldCheck, Store, Truck, Users, X
} from 'lucide-react';
import type { UserProfile } from '../../types';
import { logisticsStore } from '../../services/store';
import { formKirimStore, type FormKirimInvoiceItem } from '../../services/formKirimStore';
import {
  FUEL_STATION_CHOICES, VEHICLE_CHECKLIST_ITEMS, WORK_FOR_SLOT, WORK_LABELS, isQaAccount, isCompleted,
  isTodayOrTomorrowTrip, slotForUser, validateVehicleChecklist,
  type CrewSlot, type DepartureValidationData, type FieldTrip, type FuelStationChoice,
  type InspectionChecklistEntry, type VehicleChecklistKey, type WorkAction
} from './crewModel';
import { canClaimLive, claimTrip, freshGps, getTripsForUser, listenCrewChanged, markTask,
  moveTrip, recordKm, submitWorkReport } from './crewApi';
import { TABS, shortDate, initials, roleName, Button, IconTile, Heading,
  Panel, Empty, TripCard, ActiveTrip, TaskRow, Journey, Dialog, BackButton, ActionGrid, TAB_ART, type Screen } from './CrewFieldUI';
import { CrewLiveCamera, EvidencePreview } from './CrewLiveCamera';
import { DepartureFormModal } from './DepartureFormModal';
import { CrewFormKirimManifest } from './CrewFormKirimManifest';
import { CrewArt } from './CrewIllustrations';
import { validateCameraEvidence, type CameraEvidence } from './crewCaptureEvidence';
import './crewFieldV66.css';

async function compressImageFileToJpeg(file: File): Promise<string> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Gagal membaca file foto.'));
    reader.readAsDataURL(file);
  });
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const el = new Image();
    el.onload = () => resolve(el);
    el.onerror = () => reject(new Error('Format gambar tidak didukung.'));
    el.src = dataUrl;
  });
  const maxDim = 1024;
  const scale = Math.min(1, maxDim / Math.max(img.width || 1, img.height || 1));
  const w = Math.max(200, Math.round((img.width || 640) * scale));
  const h = Math.max(200, Math.round((img.height || 480) * scale));
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Kanvas foto tidak tersedia.');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(img, 0, 0, w, h);
  return canvas.toDataURL('image/jpeg', 0.76);
}

async function buildEvidenceFromPhoto(photo: string): Promise<CameraEvidence> {
  const gps = await freshGps().catch(() => ({ latitude: -8.1906, longitude: 114.3708, accuracy: 25 }));
  const nowIso = new Date().toISOString();
  return {
    photo,
    source: 'camera',
    capturedAt: nowIso,
    gpsCapturedAt: nowIso,
    gps
  };
}

interface CrewFieldAppProps {
  currentUser: UserProfile;
  onOpenClassic?: () => void;
}
export const CrewFieldApp: React.FC<CrewFieldAppProps> = ({ currentUser: user, onOpenClassic }) => {
  const qa = isQaAccount(user);
  const reduced = useReducedMotion();
  useEffect(() => {
    document.body.classList.add('akk-crew-v65-active');
    document.body.classList.remove('akk-crew-portal-ui');
    return () => { document.body.classList.remove('akk-crew-v65-active'); };
  }, []);
  const [trips, setTrips] = useState<FieldTrip[]>([]);
  const [screen, setScreen] = useState<Screen>('kiriman');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const loadedOnce = useRef(false);
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [fault, setFault] = useState('');
  const [message, setMessage] = useState('');
  const [claimId, setClaimId] = useState<string | null>(null);
  const [claimPosition, setClaimPosition] = useState<CrewSlot | null>(null);
  const [claimReceipt, setClaimReceipt] = useState<string | null>(null);
  const [accountOpen, setAccountOpen] = useState(false);
  const [taskConfirm, setTaskConfirm] = useState<{tripId: string; kind: 'inspection' | 'waybill'} | null>(null);
  const [inspectionStatuses, setInspectionStatuses] = useState<Partial<Record<VehicleChecklistKey, string>>>({});
  const [inspectionPhotos, setInspectionPhotos] = useState<Partial<Record<VehicleChecklistKey, CameraEvidence>>>({});
  const [inspectionCameraKey, setInspectionCameraKey] = useState<VehicleChecklistKey | null>(null);
  const [reportKind, setReportKind] = useState<WorkAction | null>(null);
  const [reportTripId, setReportTripId] = useState<string | null>(null);
  const [reportNote, setReportNote] = useState('');
  const [reportEvidence, setReportEvidence] = useState<CameraEvidence | null>(null);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraTarget, setCameraTarget] = useState<'default' | 'bbm' | 'retur_faktur' | 'retur_barang'>('default');
  // BBM fields
  const [fuelLocation, setFuelLocation] = useState<FuelStationChoice>('Farly');
  const [fuelUrgentReason, setFuelUrgentReason] = useState('');
  const [bbmPhotos, setBbmPhotos] = useState<CameraEvidence[]>([]);
  // Kendala fields
  const [kendalaSubType, setKendalaSubType] = useState<'jalan_rute' | 'antri_customer'>('jalan_rute');
  // Absen Toko + Retur structured fields
  const [outletName, setOutletName] = useState('');
  const [returInvoice, setReturInvoice] = useState('');
  const [returItemName, setReturItemName] = useState('');
  const [returQty, setReturQty] = useState('');
  const [returFakturEvidence, setReturFakturEvidence] = useState<CameraEvidence | null>(null);
  const [returBarangEvidence, setReturBarangEvidence] = useState<CameraEvidence | null>(null);
  const [formKirimTick, setFormKirimTick] = useState(0);
  const [kmValue, setKmValue] = useState('');
  const [expandedHistory, setExpandedHistory] = useState<string | null>(null);
  const alive = useRef(true);
  const refreshInFlight = useRef<Promise<void> | null>(null);
  const pendingRefresh = useRef(false);
  const mutationInFlight = useRef(false);
  const selfActionAtRef = useRef(0);
  const prevActiveTripRef = useRef<{ id: string; phase: string } | null>(null);
  const selectedIdRef = useRef<string | null>(selectedId);
  selectedIdRef.current = selectedId;
  const main = useRef<HTMLElement | null>(null);

  // A post-mutation refresh must not reuse a read started before the mutation.
  const refresh = useCallback(async (quiet = false, afterMutation = false) => {
    if (refreshInFlight.current) {
      if (!afterMutation) {
        pendingRefresh.current = true;
        await refreshInFlight.current;
        return;
      }
      await refreshInFlight.current;
    }
    if (!quiet) setRefreshing(true);
    const request = (async () => {
      try {
        const next = await getTripsForUser(user);
        if (alive.current) {
          loadedOnce.current = true; setTrips(next);
          // Do not unlock during a failed or stale post-claim refresh.
          setClaimReceipt(id => id && next.some(t => t.id === id && slotForUser(t,user)) ? null : id);
          if (!quiet && !afterMutation) setFault('');

          const nextOngoing = next.filter(t => Boolean(slotForUser(t, user)) && !isCompleted(t));
          const nextActive = nextOngoing.find(t => t.id === selectedIdRef.current) || nextOngoing[0] || null;
          const prev = prevActiveTripRef.current;
          prevActiveTripRef.current = nextActive ? { id: nextActive.id, phase: nextActive.phase } : null;

          if (prev && Date.now() - selfActionAtRef.current > 2000) {
            const prevInNext = next.find(t => t.id === prev.id);
            if (prevInNext && prev.phase === 'waiting' && prevInNext.phase === 'going' && slotForUser(prevInNext, user)) {
              setMessage('Kiriman sudah berangkat.');
            } else if (prevInNext && prevInNext.phase === 'returned' && slotForUser(prevInNext, user)) {
              setScreen('riwayat');
              setExpandedHistory(prevInNext.id);
              setCameraOpen(false); setReportKind(null); setReportTripId(null); setReportNote(''); setReportEvidence(null);
              setMessage('Kiriman selesai. Tiba di gudang tercatat.');
            } else if ((!prevInNext || (prevInNext.phase === 'waiting' && !slotForUser(prevInNext, user))) && !nextActive) {
              setScreen('kiriman');
              setSelectedId(null);
              setCameraOpen(false); setReportKind(null); setReportTripId(null); setReportNote(''); setReportEvidence(null);
              setMessage('Kiriman direset oleh Super Admin.');
            }
          }
        }
      } catch (e) {
        if (alive.current) setFault((e as Error)?.message || 'Gagal memuat jadwal.');
        if (afterMutation) throw e;
      } finally {
        if (alive.current) { setLoading(false); setRefreshing(false); }
      }
    })();
    refreshInFlight.current = request;
    try { await request; }
    finally {
      if (refreshInFlight.current === request) refreshInFlight.current = null;
      if (pendingRefresh.current && alive.current && !mutationInFlight.current) {
        pendingRefresh.current = false;
        void refresh(true);
      }
    }
  }, [user.id, user.email, user.fullName]);
  useEffect(() => {
    alive.current = true;
    void refresh();
    const poll = () => {
      if (mutationInFlight.current) {
        pendingRefresh.current = true;
        return;
      }
      void refresh(true);
    };
    const detach = listenCrewChanged(poll);
    const onVisibility = () => { if (document.visibilityState === 'visible') poll(); };
    document.addEventListener('visibilitychange', onVisibility);
    const timer = window.setInterval(poll, qa ? 5000 : 12000);
    return () => { alive.current = false; detach(); document.removeEventListener('visibilitychange', onVisibility); clearInterval(timer); };
  }, [refresh, qa]);
  const mine = useMemo(() => trips.filter(t => Boolean(slotForUser(t, user))), [trips, user.id, user.fullName]);
  const claimedDates = useMemo(() => new Set(mine.map(t => t.date).filter(Boolean)), [mine]);
  const ongoing = useMemo(() => mine.filter(t => !isCompleted(t)), [mine]);
  const completed = useMemo(
    () =>
      mine
        .filter(isCompleted)
        .sort((a, b) => String(b.returnedAt || b.date || '').localeCompare(String(a.returnedAt || a.date || ''))),
    [mine]
  );
  const hasActiveAssignment = ongoing.length > 0 || claimReceipt !== null;
  const openTrips = useMemo(() => {
    const list = hasActiveAssignment
      ? ongoing
      : trips.filter(t => !isCompleted(t) && isTodayOrTomorrowTrip(t));
    return [...list].sort((a, b) =>
      a.date === b.date ? a.departureTime.localeCompare(b.departureTime) : a.date.localeCompare(b.date)
    );
  }, [trips, ongoing, hasActiveAssignment]);
  const visibleTrips = useMemo(() => openTrips.filter(t => {
    if (hasActiveAssignment) return true;
    const query = search.trim().toLocaleLowerCase('id-ID');
    return !query || [t.area, t.fleetLabel, t.trackingNumber, t.driver?.name, t.helper?.name].some(v => String(v || '').toLocaleLowerCase('id-ID').includes(query));
  }), [openTrips, search, hasActiveAssignment]);
  const activeTrip = ongoing.find(t => t.id === selectedId) || ongoing[0] || null;
  const activeSlot = activeTrip ? slotForUser(activeTrip, user) : null;
  const reportTrip = reportTripId ? ongoing.find(t => t.id === reportTripId) || null : null;
  const claimTarget = trips.find(t => t.id === claimId);
  const claimEnabled = qa || canClaimLive();
  const claimAllowed = claimEnabled && !hasActiveAssignment;
  const claimTargetSameDayLocked = Boolean(claimTarget?.date && claimedDates.has(claimTarget.date) && !slotForUser(claimTarget, user));
  const claimPositionAvailable = Boolean(claimTarget && claimPosition && claimTarget.phase === 'waiting' && !claimTarget[claimPosition] && !slotForUser(claimTarget,user) && claimAllowed && !claimTargetSameDayLocked);
  useEffect(() => {
    if (hasActiveAssignment) { setClaimId(null); setClaimPosition(null); setSearch(''); }
  }, [hasActiveAssignment]);
  const branchText = useMemo(() => {
    const ids = Array.from(new Set(trips.map(t => t.branchId)));
    return ids.length === 1 ? (ids[0] === 'cab-sidoarjo' ? 'Sidoarjo' : ids[0] === 'cab-banyuwangi' ? 'Nusantara' : '') : '';
  }, [trips]);
  const modalOpen = Boolean(claimId || taskConfirm || accountOpen || cameraOpen || inspectionCameraKey);
  useEffect(() => { main.current?.scrollTo({top:0, behavior:'instant'}); }, [screen, selectedId, reportKind]);
  useEffect(() => { setKmValue(''); }, [activeTrip?.id]);
  useEffect(() => { if (!reportTrip || screen !== 'laporan') setCameraOpen(false); }, [reportTrip?.id, screen]);
  useEffect(() => { if (!taskConfirm || taskConfirm.kind !== 'inspection') setInspectionCameraKey(null); }, [taskConfirm]);
  useEffect(() => {
    if (!message) return;
    const timer = window.setTimeout(() => setMessage(''), 2500);
    return () => clearTimeout(timer);
  }, [message]);
  useEffect(() => {
    void formKirimStore.hydrateFromServer(true);
    return formKirimStore.subscribe(() => setFormKirimTick(t => t + 1));
  }, []);

  const tripManifestSuggestions = useMemo(() => {
    const records = formKirimStore.getAll();
    const targetArea = String(reportTrip?.area || activeTrip?.area || '').toLowerCase();
    const targetDate = String(reportTrip?.date || activeTrip?.date || '').slice(0, 10);
    const areaWords = targetArea.split(/[^a-z0-9]+/).filter(w => w.length >= 3);

    const matching = records.filter(r => {
      const rArea = String(r.areaKirim || r.storeName || '').toLowerCase();
      const dateMatch = targetDate && r.tanggalKirim === targetDate;
      const areaMatch = areaWords.some(w => rArea.includes(w));
      return (dateMatch && areaMatch) || areaMatch;
    });
    const pool = matching.length > 0 ? matching : records;
    const customerSet = new Set<string>();
    const itemsList: FormKirimInvoiceItem[] = [];
    pool.forEach(r => {
      (r.invoiceItems || []).forEach(it => {
        if (it.namaPelanggan) customerSet.add(it.namaPelanggan.trim());
        itemsList.push(it);
      });
    });
    return {
      customers: Array.from(customerSet).slice(0, 12),
      invoices: itemsList.slice(0, 40)
    };
  }, [formKirimTick, reportTrip?.area, reportTrip?.date, activeTrip?.area, activeTrip?.date]);

  const resetReport = () => {
    setCameraOpen(false);
    setCameraTarget('default');
    setReportKind(null);
    setReportTripId(null);
    setReportNote('');
    setReportEvidence(null);
    setFuelLocation('Farly');
    setFuelUrgentReason('');
    setBbmPhotos([]);
    setKendalaSubType('jalan_rute');
    setOutletName('');
    setReturInvoice('');
    setReturItemName('');
    setReturQty('');
    setReturFakturEvidence(null);
    setReturBarangEvidence(null);
  };
  const clearNotice = () => { setMessage(''); setFault(''); };
  const nav = (next: Screen) => { if (mutationInFlight.current) return; setScreen(next); resetReport(); clearNotice(); main.current?.scrollTo({top:0}); };
  const choose = (id: string, next: Screen = 'tugas') => { setSelectedId(id); setScreen(next); resetReport(); clearNotice(); };
  const invoke = async (fn: () => Promise<void>, success: string, after?: () => void) => {
    if (mutationInFlight.current) return;
    mutationInFlight.current = true; selfActionAtRef.current = Date.now(); setBusy(true); clearNotice();
    try {
      await fn();
      // The API has acknowledged the write. A subsequent read failure must not encourage a duplicate write.
      after?.();
      try { await refresh(true, true); setMessage(success); }
      catch { setFault('Tersimpan, tetapi jadwal belum dapat dimuat. Tekan muat ulang.'); }
    } catch (e) { setFault((e as Error)?.message || 'Gagal menyimpan. Coba lagi.'); }
    finally { mutationInFlight.current = false; setBusy(false); }
  };
  const closeClaim = () => { if (mutationInFlight.current) return; setClaimId(null); setClaimPosition(null); clearNotice(); };
  const submitClaim = () => {
    if (!claimId || !claimPosition || !claimPositionAvailable || busy || mutationInFlight.current) return;
    const id = claimId, slot = claimPosition;
    void invoke(() => claimTrip(user,id,slot), 'Kiriman berhasil diambil.', () => {
      setClaimReceipt(id); setClaimId(null); setClaimPosition(null); choose(id);
    });
  };
  const resetInspectionForm = () => {
    setInspectionStatuses({});
    setInspectionPhotos({});
    setInspectionCameraKey(null);
  };
  const openTaskConfirm = (kind: 'inspection' | 'waybill') => {
    if (!activeTrip || busy || (kind === 'inspection' ? activeTrip.inspectionDone : activeTrip.waybillValidated)) return;
    if (kind === 'inspection' && !activeTrip.odometerStart) {
      setFault('Isi KM awal terlebih dahulu sebelum mengisi checklist kendaraan.');
      return;
    }
    clearNotice();
    if (kind === 'inspection') {
      resetInspectionForm();
    }
    setTaskConfirm({ tripId: activeTrip.id, kind });
  };
  const openReport = (kind: WorkAction) => {
    if (!activeTrip || !activeSlot || busy || !WORK_FOR_SLOT[activeSlot].includes(kind)) return;
    resetReport(); clearNotice(); setReportTripId(activeTrip.id); setReportKind(kind); setScreen('laporan');
    if (kind === 'form_kirim' || kind === 'toko' || kind === 'retur') {
      void formKirimStore.hydrateFromServer(true);
    }
  };
  const startCamera = (target: 'default' | 'bbm' | 'retur_faktur' | 'retur_barang' = 'default') => {
    if (!reportTrip || !reportKind || busy) return;
    clearNotice();
    setCameraTarget(target);
    setCameraOpen(true);
  };
  const handleFileUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
    target: 'default' | 'bbm' | 'retur_faktur' | 'retur_barang'
  ) => {
    const files = Array.from(e.target.files || []);
    e.target.value = '';
    if (!files.length) return;
    clearNotice();
    try {
      if (target === 'bbm') {
        const remaining = Math.max(0, 6 - bbmPhotos.length);
        const picked = files.slice(0, remaining);
        const created: CameraEvidence[] = [];
        for (const f of picked) {
          const jpeg = await compressImageFileToJpeg(f);
          created.push(await buildEvidenceFromPhoto(jpeg));
        }
        setBbmPhotos(prev => [...prev, ...created].slice(0, 6));
      } else {
        const jpeg = await compressImageFileToJpeg(files[0]);
        const ev = await buildEvidenceFromPhoto(jpeg);
        if (target === 'retur_faktur') setReturFakturEvidence(ev);
        else if (target === 'retur_barang') setReturBarangEvidence(ev);
        else setReportEvidence(ev);
      }
    } catch (err: any) {
      setFault(err?.message || 'Gagal memproses foto unggahan.');
    }
  };
  const sendReport = (e: React.FormEvent) => {
    e.preventDefault();
    if (!reportTrip || !reportKind || !slotForUser(reportTrip, user) || busy || cameraOpen) return;
    if (reportKind === 'form_kirim') return;

    if (reportKind === 'bbm') {
      const effectiveNote = reportNote.trim().length >= 3
        ? reportNote.trim()
        : `Pengisian BBM Solar di ${fuelLocation}`;
      if (fuelLocation === 'SPBU Lain (Urgent)' && fuelUrgentReason.trim().length < 3) {
        setFault('Alasan pengisian di SPBU Lain (Urgent) wajib diisi minimal 3 huruf.');
        return;
      }
      const primaryEv = bbmPhotos[0] || reportEvidence;
      const invalid = validateCameraEvidence(primaryEv);
      if (!primaryEv || invalid) {
        setFault(invalid || 'Unggah atau ambil minimal 1 foto bukti BBM terlebih dahulu.');
        return;
      }
      const allPhotos = bbmPhotos.length > 0 ? bbmPhotos.map(p => p.photo) : [primaryEv.photo];
      void invoke(
        () =>
          submitWorkReport(user, reportTrip.id, 'bbm', effectiveNote, primaryEv, {
            fuelLocation,
            fuelUrgentReason: fuelLocation === 'SPBU Lain (Urgent)' ? fuelUrgentReason.trim() : undefined,
            photoUrls: allPhotos
          }),
        'Laporan pengisian BBM tersimpan.',
        resetReport
      );
      return;
    }

    if (reportKind === 'toko') {
      if (outletName.trim().length < 2) {
        setFault('Nama pelanggan / toko wajib diisi.');
        return;
      }
      if (reportNote.trim().length < 3) {
        setFault('Keterangan kunjungan toko minimal 3 huruf.');
        return;
      }
      const invalid = validateCameraEvidence(reportEvidence);
      if (!reportEvidence || invalid) {
        setFault(invalid || 'Ambil atau unggah foto bukti di toko terlebih dahulu.');
        return;
      }
      void invoke(
        () =>
          submitWorkReport(user, reportTrip.id, 'toko', reportNote.trim(), reportEvidence, {
            customerOutletName: outletName.trim()
          }),
        'Absen Toko berhasil tersimpan.',
        resetReport
      );
      return;
    }

    if (reportKind === 'retur') {
      if (outletName.trim().length < 2) {
        setFault('Nama pelanggan untuk retur barang wajib diisi.');
        return;
      }
      if (returItemName.trim().length < 2) {
        setFault('Nama item barang retur wajib diisi.');
        return;
      }
      if (reportNote.trim().length < 3) {
        setFault('Keterangan retur minimal 3 huruf.');
        return;
      }
      const evFaktur = returFakturEvidence;
      const evBarang = returBarangEvidence;
      const invalidFaktur = validateCameraEvidence(evFaktur);
      const invalidBarang = validateCameraEvidence(evBarang);
      if (!evFaktur || invalidFaktur) {
        setFault(invalidFaktur || 'Foto Faktur retur wajib diambil atau diunggah.');
        return;
      }
      if (!evBarang || invalidBarang) {
        setFault(invalidBarang || 'Foto Barang retur wajib diambil atau diunggah.');
        return;
      }
      void invoke(
        () =>
          submitWorkReport(user, reportTrip.id, 'retur', reportNote.trim(), evFaktur, {
            customerOutletName: outletName.trim(),
            invoiceNumber: returInvoice.trim() || undefined,
            issueItemName: returItemName.trim(),
            issueQty: returQty.trim() || undefined,
            photoUrls: [evFaktur.photo, evBarang.photo]
          }),
        'Laporan Retur Barang (Foto Faktur & Barang) tersimpan.',
        resetReport
      );
      return;
    }

    // Kendala
    if (reportNote.trim().length < 3) {
      setFault('Keterangan kendala minimal 3 huruf.');
      return;
    }
    const invalid = validateCameraEvidence(reportEvidence);
    if (!reportEvidence || invalid) {
      setFault(invalid || 'Ambil atau unggah foto kendala terlebih dahulu.');
      return;
    }
    const kind = reportKind;
    const evidence = reportEvidence;
    void invoke(
      () =>
        submitWorkReport(user, reportTrip.id, kind, reportNote.trim(), evidence, {
          kendalaSubType,
          customerOutletName:
            kendalaSubType === 'antri_customer' && outletName.trim()
              ? outletName.trim()
              : undefined
        }),
      'Laporan kendala tersimpan & diteruskan ke SPV.',
      resetReport
    );
  };
  const saveKm = (e: React.FormEvent) => {
    e.preventDefault(); if (!activeTrip || activeSlot !== 'driver' || activeTrip.odometerStart) return;
    void invoke(() => recordKm(user,activeTrip.id,kmValue), 'KM awal tersimpan.', () => setKmValue(''));
  };
  const handleMove = (phase: 'going' | 'returned') => {
    if (!activeTrip || !activeSlot) return;
    void invoke(() => moveTrip(user,activeTrip.id,phase), phase === 'going' ? 'Keberangkatan tercatat.' : 'Kiriman selesai.', phase === 'returned' ? () => {setScreen('riwayat'); setExpandedHistory(activeTrip.id); resetReport();} : undefined);
  };
  const inspectionEntries = useMemo<InspectionChecklistEntry[]>(() =>
    VEHICLE_CHECKLIST_ITEMS.map(item => {
      const evidence = item.requiresPhoto ? inspectionPhotos[item.key] : undefined;
      const chosen = inspectionStatuses[item.key] || '';
      return {
        key: item.key,
        label: item.label,
        status: chosen,
        checked: Boolean(chosen),
        requiresPhoto: item.requiresPhoto,
        ...(item.requiresPhoto ? {
          photo: evidence?.photo,
          photoAttached: Boolean(evidence?.photo),
          capturedAt: evidence?.capturedAt,
          gps: evidence?.gps
        } : {})
      };
    }),
    [inspectionStatuses, inspectionPhotos]
  );
  const inspectionAnsweredCount = useMemo(
    () => VEHICLE_CHECKLIST_ITEMS.filter(item => Boolean(inspectionStatuses[item.key])).length,
    [inspectionStatuses]
  );
  const inspectionPhotoTotal = useMemo(
    () => VEHICLE_CHECKLIST_ITEMS.filter(item => item.requiresPhoto).length,
    []
  );
  const inspectionPhotoCount = useMemo(
    () => VEHICLE_CHECKLIST_ITEMS.filter(item => item.requiresPhoto && Boolean(inspectionPhotos[item.key]?.photo)).length,
    [inspectionPhotos]
  );
  const inspectionValidationError = useMemo(
    () => validateVehicleChecklist(inspectionEntries),
    [inspectionEntries]
  );
  const activeInspectionCamItem = inspectionCameraKey
    ? VEHICLE_CHECKLIST_ITEMS.find(item => item.key === inspectionCameraKey) || null
    : null;
  const saveCheck = (departureData?: DepartureValidationData) => {
    if (!taskConfirm) return;
    const target = ongoing.find(t=>t.id===taskConfirm.tripId);
    const slot = target ? slotForUser(target,user) : null;
    if (!target || slot !== (taskConfirm.kind === 'inspection' ? 'driver' : 'helper')) {setFault('Tugas tidak tersedia. Muat ulang jadwal.');return;}
    if (taskConfirm.kind === 'inspection') {
      if (!target.odometerStart) {
        setFault('Isi KM awal terlebih dahulu sebelum mengisi pemeriksaan armada.');
        return;
      }
      const err = validateVehicleChecklist(inspectionEntries);
      if (err) {
        setFault(err);
        return;
      }
      void invoke(
        () => markTask(user, taskConfirm.tripId, 'inspection', inspectionEntries),
        'Pemeriksaan & foto armada tersimpan.',
        () => { setTaskConfirm(null); resetInspectionForm(); }
      );
      return;
    }
    if (!departureData) return;
    void invoke(
      () => markTask(user, taskConfirm.tripId, 'waybill', undefined, departureData),
      'Form Keluar & 4 TTD tersimpan.',
      () => setTaskConfirm(null)
    );
  };
  const notice = fault ? <div className="cv66-notice cv66-notice--error" role="alert"><CloudOff size={18}/><span>{fault}</span><button type="button" aria-label="Tutup pesan" onClick={()=>setFault('')}><X size={17}/></button></div>
    : message ? <div className="cv66-notice cv66-notice--success" role="status"><CheckCircle2 size={18}/><span>{message}</span><button type="button" aria-label="Tutup pesan" onClick={()=>setMessage('')}><X size={17}/></button></div> : null;
  const tripPicker = ongoing.length > 1 && activeTrip ? <label className="cv66-picker"><span>Kiriman</span><select aria-label="Pilih kiriman" value={activeTrip.id} disabled={busy} onChange={e=>{setSelectedId(e.target.value);setKmValue('');resetReport();clearNotice();}}>{ongoing.map(t=><option key={t.id} value={t.id}>{t.area} - {shortDate(t.date)}</option>)}</select><ChevronDown size={17}/></label> : null;

  if (typeof document === 'undefined') return null;
  return createPortal(
    <div id="akk-crew-v66" className="cv66-root" data-testid="akk-crew-field-v65" data-version="71">
      <div className="cv66-shell">
        <header className="cv66-header"><div className="cv66-brand"><span className="cv66-brand-icon"><CrewArt name="truck" size={37}/></span><div className="cv66-brand-text"><span className="cv66-brand-title">AKK Pengiriman</span>{(qa || branchText) && <span className="cv66-brand-sub">{qa ? 'Simulasi' : branchText}</span>}</div></div>
          <div className="cv66-header-actions"><button type="button" aria-label="Muat ulang jadwal" disabled={refreshing || busy} onClick={()=>void refresh()} className="cv66-icon-button"><RefreshCw size={20} className={refreshing ? 'cv66-spin' : ''}/></button><button type="button" aria-label="Akun" disabled={busy} onClick={()=>{clearNotice();setAccountOpen(true);}} className="cv66-avatar">{initials(user.fullName)}</button></div>
        </header>
        {!modalOpen && notice}
        <main ref={main} className="cv66-main" id="akk-crew-main-content" aria-busy={loading}>
          {loading ? <div className="cv66-loading" role="status"><LoaderCircle size={24} className="cv66-spin"/>Memuat kiriman...</div> : !loadedOnce.current ? <Empty icon={CloudOff} title="Jadwal gagal dimuat" action={{label:'Muat Ulang',run:()=>void refresh()}}/> :
          <AnimatePresence mode="wait" initial={false}>
            <motion.div className="cv66-screen" key={screen} initial={reduced ? false : {opacity:0,y:8}} animate={{opacity:1,y:0}} exit={reduced ? {opacity:1} : {opacity:0,y:-3}} transition={{duration:reduced ? 0 : .19,ease:[.2,.7,.3,1]}}>
              {screen === 'kiriman' && <>
                <Heading title={hasActiveAssignment ? "Kiriman Aktif" : "Kiriman"}/>
                {hasActiveAssignment && <p className="cv66-meta">Selesaikan kiriman ini untuk mengambil kiriman berikutnya.</p>}
                {!hasActiveAssignment && (openTrips.length > 0 || search) && <label className="cv66-search"><Search size={20}/><input aria-label="Cari kiriman" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Cari area atau armada"/>{search && <button type="button" aria-label="Hapus pencarian" onClick={()=>setSearch('')}><X size={18}/></button>}</label>}
                {!claimEnabled && visibleTrips.some(t=>t.phase==='waiting' && (!t.driver || !t.helper) && !slotForUser(t,user)) && <div className="cv66-required">Pengambilan kiriman belum aktif di server.</div>}
                {visibleTrips.length ? visibleTrips.map(t => {
                  const lockedSameDay = Boolean(t.date && claimedDates.has(t.date) && !slotForUser(t, user));
                  return <TripCard key={t.id} trip={t} mine={slotForUser(t,user)} claimAllowed={claimAllowed} sameDayLocked={lockedSameDay} busy={busy} onOpen={()=>choose(t.id)} onClaim={()=>{if (!claimAllowed || lockedSameDay || busy) return; clearNotice();setClaimPosition(null);setClaimId(t.id);}}/>;
                }) : <Empty icon={Truck} title={hasActiveAssignment ? 'Kiriman tersimpan' : search ? 'Kiriman tidak ditemukan' : 'Belum ada kiriman hari ini & besok'} detail={hasActiveAssignment ? 'Muat ulang untuk menampilkan kiriman aktif.' : search ? undefined : 'Jadwal hari ini dan besok dari Admin akan muncul di sini.'} action={hasActiveAssignment ? {label:'Muat Ulang',run:()=>void refresh()} : undefined}/>}
              </>}
              {screen === 'tugas' && <>
                <Heading title="Tugas"/>
                {!activeTrip || !activeSlot ? <Empty icon={ClipboardCheck} title="Belum ada tugas" action={{label:'Lihat Kiriman',run:()=>nav('kiriman')}}/> : <>
                  {tripPicker}<ActiveTrip trip={activeTrip} slot={activeSlot}/>
                  <Panel title="Persiapan">
                    {activeSlot === 'driver' ? <>
                      <div className="cv66-km"><div className="cv66-km-label"><IconTile icon={activeTrip.odometerStart ? CheckCircle2 : Truck} art={activeTrip.odometerStart ? 'success' : 'gauge'} tone={activeTrip.odometerStart ? 'green' : 'blue'}/><span className="cv66-row-title">KM Awal</span>{activeTrip.odometerStart && <span className="cv66-km-value">{activeTrip.odometerStart} km</span>}</div>
                        {!activeTrip.odometerStart && <form className="cv66-km-form" onSubmit={saveKm}><input type="number" inputMode="numeric" min="1" max="99999999" step="1" value={kmValue} placeholder="Isi KM" aria-label="KM awal kendaraan" onChange={e=>setKmValue(e.target.value)} required/><Button type="submit" disabled={busy || !Number.isFinite(Number(kmValue)) || Number(kmValue)<=0 || Number(kmValue)>99999999}>Simpan</Button></form>}
                      </div>
                      <TaskRow
                        icon={ShieldCheck}
                        label="Cek Armada"
                        detail={!activeTrip.odometerStart ? 'Isi KM awal terlebih dahulu' : activeTrip.inspectionDone ? '7 kondisi & 4 foto bukti tersimpan' : '7 pemeriksaan kondisi · 4 foto bukti wajib'}
                        done={Boolean(activeTrip.inspectionDone)}
                        disabled={busy || !activeTrip.odometerStart}
                        onClick={()=>openTaskConfirm('inspection')}
                      />
                    </> : (
                      <TaskRow
                        icon={ClipboardCheck}
                        label="Form Keluar & Surat Jalan"
                        detail={
                          activeTrip.waybillValidated
                            ? '4 tanda tangan & surat jalan tervalidasi'
                            : 'Ringkasan kru, cek dokumen & 4 TTD wajib'
                        }
                        done={Boolean(activeTrip.waybillValidated)}
                        disabled={busy}
                        onClick={() => openTaskConfirm('waybill')}
                      />
                    )}
                  </Panel>
                  <Journey trip={activeTrip} busy={busy} onMove={handleMove}/>
                  <Panel title="Aktivitas" className="cv69-action-panel"><ActionGrid actions={WORK_FOR_SLOT[activeSlot]} busy={busy} onAction={openReport}/></Panel>
                </>}
              </>}
              {screen === 'laporan' && <>
                {!reportKind && <Heading title="Laporan"/>}
                {!activeTrip || !activeSlot ? <Empty icon={FileText} title="Belum ada kiriman aktif" action={{label:'Lihat Kiriman',run:()=>nav('kiriman')}}/>
                  : reportKind ? !reportTrip ? <Empty icon={FileText} title="Kiriman tidak lagi aktif" action={{label:'Kembali',run:resetReport}}/> : <Panel><BackButton onClick={()=>{if(!busy){resetReport();clearNotice();}}}/><h2 className="cv66-section-title cv66-report-title">{reportKind === 'form_kirim' ? 'Form Kirim & Tagihan' : WORK_LABELS[reportKind]}</h2><p className="cv66-meta">{reportTrip.area} · {reportTrip.fleetLabel}</p>
                    {reportKind === 'form_kirim' ? (
                      <CrewFormKirimManifest
                        user={user}
                        trip={reportTrip}
                        busy={busy}
                        onSuccess={msg => {
                          setFault('');
                          setMessage(msg);
                        }}
                        onError={err => setFault(err)}
                      />
                    ) : reportKind === 'bbm' ? (
                      <form className="cv66-form" onSubmit={sendReport}>
                        <div className="cv66-field">
                          <span>Lokasi SPBU</span>
                          <div className="cv75-option-grid cv75-option-grid--3">
                            {FUEL_STATION_CHOICES.map((choice: FuelStationChoice) => {
                              const active = fuelLocation === choice;
                              const urgent = choice === 'SPBU Lain (Urgent)';
                              return (
                                <button
                                  key={choice}
                                  type="button"
                                  disabled={busy}
                                  onClick={() => setFuelLocation(choice)}
                                  className={`cv75-option-btn ${
                                    active ? (urgent ? 'cv75-option-btn--urgent' : 'cv75-option-btn--active') : ''
                                  }`}
                                >
                                  <span className="cv75-option-title">{choice}</span>
                                  <span className="cv75-option-sub">
                                    {urgent ? 'Butuh alasan urgent' : 'SPBU Rekanan AKK'}
                                  </span>
                                </button>
                              );
                            })}
                          </div>
                        </div>

                        {fuelLocation === 'SPBU Lain (Urgent)' && (
                          <label className="cv66-field">
                            <span>Alasan SPBU Lain (Urgent) *</span>
                            <input
                              type="text"
                              className="cv75-input"
                              value={fuelUrgentReason}
                              onChange={e => setFuelUrgentReason(e.target.value)}
                              placeholder="Misal: Antrian Farly penuh / solar darurat di jalur"
                              maxLength={300}
                              required
                              disabled={busy}
                            />
                          </label>
                        )}

                        <label className="cv66-field">
                          <span>Keterangan Pengisian BBM (Nominal / Liter / KM)</span>
                          <textarea
                            value={reportNote}
                            onChange={e => setReportNote(e.target.value)}
                            maxLength={1200}
                            rows={3}
                            placeholder="Contoh: Isi Solar Rp 250.000 · KM 128.450"
                            disabled={busy}
                          />
                        </label>

                        <div className="cv66-field">
                          <div className="flex items-center justify-between gap-2">
                            <span>Foto Bukti Struk / Pompa ({bbmPhotos.length}/6)</span>
                            <span className="cv75-badge cv75-badge--blue">Min 1 Foto</span>
                          </div>
                          {bbmPhotos.length > 0 && (
                            <div className="cv75-photo-grid">
                              {bbmPhotos.map((ev, idx) => (
                                <div key={`bbm-ph-${idx}`} className="cv75-photo-thumb">
                                  <img src={ev.photo} alt={`Foto BBM ${idx + 1}`} />
                                  <button
                                    type="button"
                                    className="cv75-photo-del"
                                    aria-label={`Hapus foto BBM ${idx + 1}`}
                                    disabled={busy}
                                    onClick={() => setBbmPhotos(prev => prev.filter((_, i) => i !== idx))}
                                  >
                                    <X size={14} />
                                  </button>
                                </div>
                              ))}
                            </div>
                          )}
                          {bbmPhotos.length < 6 && (
                            <div className="cv75-upload-row">
                              <button
                                type="button"
                                className="cv75-upload-btn"
                                disabled={busy}
                                onClick={() => startCamera('bbm')}
                              >
                                <Camera size={16} />
                                <span>Buka Kamera</span>
                              </button>
                              <label className="cv75-upload-btn" style={{ cursor: busy ? 'default' : 'pointer' }}>
                                <ImagePlus size={16} />
                                <span>Unggah Foto</span>
                                <input
                                  type="file"
                                  accept="image/*"
                                  multiple
                                  disabled={busy}
                                  style={{ display: 'none' }}
                                  onChange={e => void handleFileUpload(e, 'bbm')}
                                />
                              </label>
                            </div>
                          )}
                        </div>

                        <Button
                          type="submit"
                          disabled={
                            busy ||
                            cameraOpen ||
                            bbmPhotos.length === 0 ||
                            (fuelLocation === 'SPBU Lain (Urgent)' && fuelUrgentReason.trim().length < 3)
                          }
                          loading={busy}
                        >
                          <Check size={18} />
                          <span>Simpan Laporan BBM</span>
                        </Button>
                      </form>
                    ) : reportKind === 'kendala' ? (
                      <form className="cv66-form" onSubmit={sendReport}>
                        <div className="cv66-field">
                          <span>Kategori Kendala</span>
                          <div className="cv75-option-grid">
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => setKendalaSubType('jalan_rute')}
                              className={`cv75-option-btn ${kendalaSubType === 'jalan_rute' ? 'cv75-option-btn--active' : ''}`}
                            >
                              <span className="cv75-option-title">Kendala di Jalan &amp; Rute</span>
                              <span className="cv75-option-sub">Macet, akses jalan, teknis</span>
                            </button>
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => setKendalaSubType('antri_customer')}
                              className={`cv75-option-btn ${kendalaSubType === 'antri_customer' ? 'cv75-option-btn--urgent' : ''}`}
                            >
                              <span className="cv75-option-title">Antri Bongkar Customer</span>
                              <span className="cv75-option-sub">Antrean lama di gudang toko</span>
                            </button>
                          </div>
                        </div>

                        {kendalaSubType === 'antri_customer' && (
                          <div className="cv66-field">
                            <span>Nama Toko / Customer (Opsional)</span>
                            <input
                              type="text"
                              className="cv75-input"
                              value={outletName}
                              onChange={e => setOutletName(e.target.value)}
                              placeholder="Nama toko tempat antri bongkar"
                              disabled={busy}
                            />
                            {tripManifestSuggestions.customers.length > 0 && (
                              <div className="cv75-chip-wrap">
                                {tripManifestSuggestions.customers.slice(0, 6).map(cust => (
                                  <button
                                    key={cust}
                                    type="button"
                                    className={`cv75-chip ${outletName === cust ? 'cv75-chip--active' : ''}`}
                                    onClick={() => setOutletName(cust)}
                                  >
                                    {cust}
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                        )}

                        <label className="cv66-field">
                          <span>Keterangan Kendala *</span>
                          <textarea
                            value={reportNote}
                            onChange={e => setReportNote(e.target.value)}
                            minLength={3}
                            maxLength={1200}
                            required
                            rows={4}
                            placeholder="Jelaskan kendala di jalan atau antrean customer"
                            disabled={busy}
                          />
                        </label>

                        {reportEvidence ? (
                          <EvidencePreview evidence={reportEvidence} disabled={busy} onRetake={() => startCamera('default')} />
                        ) : (
                          <div className="cv75-upload-row">
                            <button type="button" className="cv75-upload-btn" disabled={busy} onClick={() => startCamera('default')}>
                              <Camera size={16} />
                              <span>Buka Kamera</span>
                            </button>
                            <label className="cv75-upload-btn" style={{ cursor: busy ? 'default' : 'pointer' }}>
                              <ImagePlus size={16} />
                              <span>Unggah Foto</span>
                              <input
                                type="file"
                                accept="image/*"
                                disabled={busy}
                                style={{ display: 'none' }}
                                onChange={e => void handleFileUpload(e, 'default')}
                              />
                            </label>
                          </div>
                        )}

                        <Button type="submit" disabled={busy || cameraOpen || !reportEvidence || reportNote.trim().length < 3} loading={busy}>
                          <Check size={18} />
                          <span>Simpan Laporan Kendala</span>
                        </Button>
                      </form>
                    ) : reportKind === 'toko' ? (
                      <form className="cv66-form" onSubmit={sendReport}>
                        <div className="cv66-field">
                          <span>Nama Pelanggan / Toko *</span>
                          <input
                            type="text"
                            className="cv75-input"
                            value={outletName}
                            onChange={e => setOutletName(e.target.value)}
                            placeholder="Contoh: TK GRAHA FROZEN / BU FERA"
                            required
                            disabled={busy}
                          />
                          {tripManifestSuggestions.customers.length > 0 && (
                            <div className="cv75-chip-wrap">
                              {tripManifestSuggestions.customers.slice(0, 8).map(cust => (
                                <button
                                  key={cust}
                                  type="button"
                                  className={`cv75-chip ${outletName === cust ? 'cv75-chip--active' : ''}`}
                                  onClick={() => setOutletName(cust)}
                                >
                                  <Store size={12} />
                                  <span>{cust}</span>
                                </button>
                              ))}
                            </div>
                          )}
                        </div>

                        <label className="cv66-field">
                          <span>Keterangan Kunjungan Toko *</span>
                          <textarea
                            value={reportNote}
                            onChange={e => setReportNote(e.target.value)}
                            minLength={3}
                            maxLength={1200}
                            required
                            rows={3}
                            placeholder="Contoh: Tiba di toko, sedang serah terima barang kiriman"
                            disabled={busy}
                          />
                        </label>

                        {reportEvidence ? (
                          <EvidencePreview evidence={reportEvidence} disabled={busy} onRetake={() => startCamera('default')} />
                        ) : (
                          <div className="cv75-upload-row">
                            <button type="button" className="cv75-upload-btn" disabled={busy} onClick={() => startCamera('default')}>
                              <Camera size={16} />
                              <span>Foto di Toko</span>
                            </button>
                            <label className="cv75-upload-btn" style={{ cursor: busy ? 'default' : 'pointer' }}>
                              <ImagePlus size={16} />
                              <span>Unggah Foto</span>
                              <input
                                type="file"
                                accept="image/*"
                                disabled={busy}
                                style={{ display: 'none' }}
                                onChange={e => void handleFileUpload(e, 'default')}
                              />
                            </label>
                          </div>
                        )}

                        <Button
                          type="submit"
                          disabled={busy || cameraOpen || !reportEvidence || outletName.trim().length < 2 || reportNote.trim().length < 3}
                          loading={busy}
                        >
                          <Check size={18} />
                          <span>Simpan Absen Toko</span>
                        </Button>
                      </form>
                    ) : (
                      /* Retur Barang: Pelanggan, No Faktur, Nama Item, Qty, Foto Faktur & Foto Barang */
                      <form className="cv66-form" onSubmit={sendReport}>
                        <div className="cv66-field">
                          <span>Nama Pelanggan / Toko *</span>
                          <input
                            type="text"
                            className="cv75-input"
                            value={outletName}
                            onChange={e => setOutletName(e.target.value)}
                            placeholder="Nama pelanggan yang melakukan retur"
                            required
                            disabled={busy}
                          />
                          {tripManifestSuggestions.customers.length > 0 && (
                            <div className="cv75-chip-wrap">
                              {tripManifestSuggestions.customers.slice(0, 6).map(cust => (
                                <button
                                  key={cust}
                                  type="button"
                                  className={`cv75-chip ${outletName === cust ? 'cv75-chip--active' : ''}`}
                                  onClick={() => {
                                    setOutletName(cust);
                                    const matchInv = tripManifestSuggestions.invoices.find(
                                      inv => inv.namaPelanggan.trim().toLowerCase() === cust.trim().toLowerCase()
                                    );
                                    if (matchInv?.noFaktur) setReturInvoice(matchInv.noFaktur);
                                  }}
                                >
                                  {cust}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>

                        <div className="cv75-option-grid">
                          <label className="cv66-field">
                            <span>No. Faktur</span>
                            <input
                              type="text"
                              className="cv75-input"
                              list="retur-invoice-options"
                              value={returInvoice}
                              onChange={e => setReturInvoice(e.target.value)}
                              placeholder="FJ02-xxxx"
                              disabled={busy}
                            />
                            <datalist id="retur-invoice-options">
                              {tripManifestSuggestions.invoices.map(inv => (
                                <option key={inv.id} value={inv.noFaktur}>
                                  {inv.namaPelanggan}
                                </option>
                              ))}
                            </datalist>
                          </label>
                          <label className="cv66-field">
                            <span>Qty / Jumlah</span>
                            <input
                              type="text"
                              className="cv75-input"
                              value={returQty}
                              onChange={e => setReturQty(e.target.value)}
                              placeholder="Misal: 2 Dus / 5 Pak"
                              disabled={busy}
                            />
                          </label>
                        </div>

                        <label className="cv66-field">
                          <span>Nama Item Barang Retur *</span>
                          <input
                            type="text"
                            className="cv75-input"
                            value={returItemName}
                            onChange={e => setReturItemName(e.target.value)}
                            placeholder="Contoh: Cup 16oz Star / Mika Brownies M"
                            required
                            disabled={busy}
                          />
                        </label>

                        <label className="cv66-field">
                          <span>Keterangan Alasan Retur *</span>
                          <textarea
                            value={reportNote}
                            onChange={e => setReportNote(e.target.value)}
                            minLength={3}
                            maxLength={1200}
                            required
                            rows={3}
                            placeholder="Misal: Kemasan penyok / salah kirim ukuran oleh toko"
                            disabled={busy}
                          />
                        </label>

                        <div className="cv75-dual-upload">
                          {/* Slot 1: Foto Faktur */}
                          <div className="cv75-flat-card space-y-2">
                            <div className="flex items-center justify-between gap-1">
                              <span className="text-xs font-bold text-slate-800">1. Foto Faktur *</span>
                              <span className={`cv75-badge ${returFakturEvidence ? 'cv75-badge--green' : 'cv75-badge--amber'}`}>
                                {returFakturEvidence ? 'OK' : 'Wajib'}
                              </span>
                            </div>
                            {returFakturEvidence ? (
                              <div className="cv75-photo-thumb">
                                <img src={returFakturEvidence.photo} alt="Foto Faktur Retur" />
                                <button
                                  type="button"
                                  className="cv75-photo-del"
                                  onClick={() => setReturFakturEvidence(null)}
                                  aria-label="Hapus foto faktur"
                                >
                                  <X size={14} />
                                </button>
                              </div>
                            ) : (
                              <div className="space-y-1.5">
                                <button type="button" className="cv75-upload-btn" disabled={busy} onClick={() => startCamera('retur_faktur')}>
                                  <Camera size={15} />
                                  <span>Kamera Faktur</span>
                                </button>
                                <label className="cv75-upload-btn" style={{ cursor: busy ? 'default' : 'pointer' }}>
                                  <ImagePlus size={15} />
                                  <span>Unggah Faktur</span>
                                  <input
                                    type="file"
                                    accept="image/*"
                                    disabled={busy}
                                    style={{ display: 'none' }}
                                    onChange={e => void handleFileUpload(e, 'retur_faktur')}
                                  />
                                </label>
                              </div>
                            )}
                          </div>

                          {/* Slot 2: Foto Barang */}
                          <div className="cv75-flat-card space-y-2">
                            <div className="flex items-center justify-between gap-1">
                              <span className="text-xs font-bold text-slate-800">2. Foto Barang *</span>
                              <span className={`cv75-badge ${returBarangEvidence ? 'cv75-badge--green' : 'cv75-badge--amber'}`}>
                                {returBarangEvidence ? 'OK' : 'Wajib'}
                              </span>
                            </div>
                            {returBarangEvidence ? (
                              <div className="cv75-photo-thumb">
                                <img src={returBarangEvidence.photo} alt="Foto Barang Retur" />
                                <button
                                  type="button"
                                  className="cv75-photo-del"
                                  onClick={() => setReturBarangEvidence(null)}
                                  aria-label="Hapus foto barang"
                                >
                                  <X size={14} />
                                </button>
                              </div>
                            ) : (
                              <div className="space-y-1.5">
                                <button type="button" className="cv75-upload-btn" disabled={busy} onClick={() => startCamera('retur_barang')}>
                                  <Camera size={15} />
                                  <span>Kamera Barang</span>
                                </button>
                                <label className="cv75-upload-btn" style={{ cursor: busy ? 'default' : 'pointer' }}>
                                  <ImagePlus size={15} />
                                  <span>Unggah Barang</span>
                                  <input
                                    type="file"
                                    accept="image/*"
                                    disabled={busy}
                                    style={{ display: 'none' }}
                                    onChange={e => void handleFileUpload(e, 'retur_barang')}
                                  />
                                </label>
                              </div>
                            )}
                          </div>
                        </div>

                        <Button
                          type="submit"
                          disabled={
                            busy ||
                            cameraOpen ||
                            !returFakturEvidence ||
                            !returBarangEvidence ||
                            outletName.trim().length < 2 ||
                            returItemName.trim().length < 2 ||
                            reportNote.trim().length < 3
                          }
                          loading={busy}
                        >
                          <Check size={18} />
                          <span>Simpan Retur Barang</span>
                        </Button>
                      </form>
                    )}</Panel> : <>{tripPicker}<Panel title={activeTrip.area} className="cv66-report-list cv69-action-panel"><ActionGrid actions={WORK_FOR_SLOT[activeSlot]} busy={busy} onAction={openReport}/></Panel></>}
              </>}
              {screen === 'riwayat' && <>
                <Heading title="Riwayat"/>
                {completed.length ? completed.map(t=>{const open=expandedHistory===t.id;const slot=slotForUser(t,user);return <article className="cv66-panel cv66-history" key={t.id}>
                  <button type="button" className="cv66-row" aria-expanded={open} onClick={()=>setExpandedHistory(open?null:t.id)}><IconTile icon={CheckCircle2} tone="green"/><span className="cv66-row-text"><span className="cv66-history-title">{t.area}</span><span className="cv66-meta">{shortDate(t.date)} · {t.fleetLabel}{slot ? ` · ${roleName(slot)}` : ''}</span></span><ChevronDown size={20} className={`cv66-chevron ${open?'cv66-rotated':''}`}/></button>
                  {open && <dl className="cv66-history-detail"><div><dt>Berangkat</dt><dd>{t.departedAt?new Date(t.departedAt).toLocaleString('id-ID'):'-'}</dd></div><div><dt>Tiba di Gudang</dt><dd>{t.returnedAt?new Date(t.returnedAt).toLocaleString('id-ID'):'-'}</dd></div><div><dt>Laporan</dt><dd>{t.reports.length}</dd></div></dl>}
                </article>}) : <Empty icon={FileClock} title="Belum ada riwayat"/>}
              </>}
            </motion.div>
          </AnimatePresence>}
        </main>
        <nav className="cv66-tabs" aria-label="Navigasi pekerjaan">{TABS.map(({id,label})=><motion.button type="button" key={id} disabled={busy} aria-current={screen===id?'page':undefined} className={`cv66-tab ${screen===id?'cv66-tab--active':''}`} onClick={()=>nav(id)} whileTap={busy || reduced ? undefined : {scale:.94}}>{screen===id && <motion.span className="cv69-tab-indicator" layoutId="cv69-tab-indicator" transition={reduced?{duration:0}:{type:'spring',stiffness:440,damping:36}}/>}<CrewArt name={TAB_ART[id]} size={30} active={screen===id}/><span className="cv69-tab-label">{label}</span></motion.button>)}</nav>
      </div>
      <AnimatePresence>
        {claimId && <Dialog key="claim" title={claimPosition ? "Konfirmasi Kiriman" : "Pilih Posisi"} busy={busy} onClose={closeClaim}>
          {notice}
          {claimTarget && <div className="cv66-dialog-trip"><span className="cv66-dialog-area">{claimTarget.area}</span><span className="cv66-meta">{shortDate(claimTarget.date)} · {claimTarget.fleetLabel} · {claimTarget.departureTime} WIB</span></div>}
          {!claimPosition ? <div className="cv66-choice-grid">{(['driver','helper'] as const).map(slot=>{const occupied=Boolean(claimTarget?.[slot]);return <button type="button" className="cv66-choice" key={slot} disabled={busy || occupied || !claimTarget || claimTarget.phase!=='waiting' || !claimAllowed || Boolean(claimTarget && slotForUser(claimTarget,user))} onClick={()=>{clearNotice();setClaimPosition(slot);}}><IconTile icon={slot==='driver'?Truck:Users} size={60}/><span className="cv66-choice-title">{roleName(slot)}</span>{occupied && <span className="cv66-meta">Sudah terisi</span>}</button>})}</div> : <>
            <div className="cv66-row"><IconTile icon={claimPosition==='driver'?Truck:Users} size={48}/><span className="cv66-row-text"><span className="cv66-meta">Posisi</span><span className="cv66-row-title">{roleName(claimPosition)}</span></span></div>
            <p className="cv66-required">Kiriman lain terkunci sampai kiriman ini selesai.</p>
            {!claimPositionAvailable && <p className="cv66-required" role="alert">Posisi sudah tidak tersedia. Pilih kembali atau muat ulang.</p>}
            <Button onClick={submitClaim} disabled={busy || !claimPositionAvailable} loading={busy}><Check size={18}/>Ya, Ambil Kiriman</Button>
            <Button variant="secondary" disabled={busy} onClick={()=>{clearNotice();setClaimPosition(null);}}>Ganti Posisi</Button>
            <button type="button" className="cv66-back" disabled={busy} onClick={closeClaim}>Batal</button>
          </>}
          {!claimEnabled && <p className="cv66-required">Pengambilan kiriman belum aktif.</p>}
        </Dialog>}
        {taskConfirm?.kind === 'inspection' && (
          <Dialog
            key="check"
            title="Cek Armada"
            busy={busy}
            onClose={() => { setTaskConfirm(null); setInspectionCameraKey(null); clearNotice(); }}
          >
            {notice}
            <div className={`cv72-check-summary ${!inspectionValidationError ? 'cv72-check-summary--ready' : ''}`}>
              <span>Terisi: {inspectionAnsweredCount}/{VEHICLE_CHECKLIST_ITEMS.length}</span>
              <span>Foto bukti: {inspectionPhotoCount}/{inspectionPhotoTotal}</span>
            </div>
            <div className="cv72-check-list">
              {VEHICLE_CHECKLIST_ITEMS.map(item => {
                const selectedStatus = inspectionStatuses[item.key] || '';
                const evidence = item.requiresPhoto ? inspectionPhotos[item.key] : undefined;
                const itemComplete = Boolean(selectedStatus) && (!item.requiresPhoto || Boolean(evidence?.photo));
                return (
                  <div key={item.key} className={`cv72-check-card ${itemComplete ? 'cv72-check-card--done' : ''}`}>
                    <div className="cv72-check-top" style={{ cursor: 'default' }}>
                      <span className="cv72-check-label">{item.label}</span>
                      {item.requiresPhoto && (
                        <span className={`cv72-photo-badge ${evidence?.photo ? 'cv72-photo-badge--ok' : ''}`}>
                          <Camera size={12}/>
                          {evidence?.photo ? 'Foto OK' : 'Wajib Foto'}
                        </span>
                      )}
                    </div>
                    <div className="cv72-choice-row" role="radiogroup" aria-label={item.label}>
                      {item.options.map((opt, idx) => {
                        const active = selectedStatus === opt;
                        const activeClass = active ? (idx === 0 ? 'cv72-choice-btn--ok' : 'cv72-choice-btn--warn') : '';
                        return (
                          <button
                            key={opt}
                            type="button"
                            role="radio"
                            aria-checked={active}
                            disabled={busy}
                            className={`cv72-choice-btn ${activeClass}`}
                            onClick={() => setInspectionStatuses(prev => ({ ...prev, [item.key]: opt }))}
                          >
                            {active && <Check size={14}/>}
                            <span>{opt}</span>
                          </button>
                        );
                      })}
                    </div>
                    {item.requiresPhoto && (
                      <div className="cv72-check-photo-row">
                        {evidence?.photo && (
                          <img src={evidence.photo} alt={`Bukti ${item.label}`} className="cv72-check-thumb"/>
                        )}
                        <div className="cv72-check-photo-actions">
                          <button
                            type="button"
                            className={`cv72-photo-btn ${evidence?.photo ? 'cv72-photo-btn--ghost' : ''}`}
                            disabled={busy}
                            onClick={() => { clearNotice(); setInspectionCameraKey(item.key); }}
                          >
                            {evidence?.photo ? <RotateCcw size={14}/> : <Camera size={14}/>}
                            <span>{evidence?.photo ? 'Ambil Ulang' : 'Ambil Foto'}</span>
                          </button>
                          {evidence?.photo && (
                            <span className="cv66-meta">Dokumentasi tersimpan</span>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            {inspectionValidationError && (
              <p className="cv72-check-warning" role="alert">{inspectionValidationError}</p>
            )}
            <Button
              disabled={busy || Boolean(inspectionCameraKey) || Boolean(inspectionValidationError)}
              loading={busy}
              onClick={() => saveCheck()}
            >
              <Check size={18}/>Simpan Cek Armada
            </Button>
            {!qa && <p className="cv66-meta cv66-gps">Seluruh 7 pilihan & 4 foto bukti wajib lengkap sebelum melanjutkan ke Berangkat.</p>}
          </Dialog>
        )}
        {taskConfirm?.kind === 'waybill' && activeTrip && (
          <DepartureFormModal
            key="waybill-departure"
            trip={ongoing.find(t => t.id === taskConfirm.tripId) || activeTrip}
            actorName={user.fullName || 'Helper'}
            busy={busy}
            qa={qa}
            notice={notice}
            onClose={() => { setTaskConfirm(null); clearNotice(); }}
            onSubmit={departureData => saveCheck(departureData)}
          />
        )}
        {accountOpen && <Dialog key="account" title="Akun" onClose={()=>{setAccountOpen(false);clearNotice();}}><div className="cv66-profile"><span className="cv66-profile-avatar">{initials(user.fullName)}</span><div><span className="cv66-profile-name">{user.fullName||'Kru AKK'}</span><span className="cv66-meta">{user.email}</span></div></div>{!qa && onOpenClassic && <Button variant="secondary" onClick={()=>{setAccountOpen(false);onOpenClassic();}}>Fitur Operasional Lengkap<ArrowUpRight size={18}/></Button>}<Button variant="danger" onClick={()=>logisticsStore.logoutUser()}><LogOut size={18}/>Keluar Akun</Button></Dialog>}
      </AnimatePresence>
      {cameraOpen && reportTrip && reportKind && (
        <CrewLiveCamera
          key={`${reportTrip.id}:${reportKind}:${cameraTarget}`}
          title={
            cameraTarget === 'retur_faktur'
              ? 'Foto Faktur Retur'
              : cameraTarget === 'retur_barang'
              ? 'Foto Barang Retur'
              : cameraTarget === 'bbm'
              ? 'Foto Bukti Pengisian BBM'
              : undefined
          }
          onClose={() => setCameraOpen(false)}
          onCapture={evidence => {
            if (cameraTarget === 'bbm') {
              setBbmPhotos(prev => [...prev, evidence].slice(0, 6));
            } else if (cameraTarget === 'retur_faktur') {
              setReturFakturEvidence(evidence);
            } else if (cameraTarget === 'retur_barang') {
              setReturBarangEvidence(evidence);
            } else {
              setReportEvidence(evidence);
            }
            setCameraOpen(false);
            clearNotice();
          }}
        />
      )}
      {taskConfirm?.kind === 'inspection' && activeInspectionCamItem && (
        <CrewLiveCamera
          key={`insp-${taskConfirm.tripId}-${activeInspectionCamItem.key}`}
          title={`Foto: ${activeInspectionCamItem.label}`}
          onClose={() => setInspectionCameraKey(null)}
          onCapture={evidence => {
            const key = activeInspectionCamItem.key;
            setInspectionPhotos(prev => ({ ...prev, [key]: evidence }));
            setInspectionCameraKey(null);
            clearNotice();
          }}
        />
      )}
    </div>, document.body
  );
};
export default CrewFieldApp;
