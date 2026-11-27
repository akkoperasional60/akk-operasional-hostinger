import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import {
  Camera, Check, CheckCircle2, ChevronDown, ClipboardCheck, CloudOff, FileClock,
  FileText, FlaskConical, Plus, RotateCcw, ShieldCheck, Sparkles, Truck, Users, X
} from 'lucide-react';
import type { UserProfile } from '../../types';
import {
  VEHICLE_CHECKLIST_ITEMS, WORK_FOR_SLOT, WORK_LABELS, getTodayTomorrowJakarta,
  isCompleted, isTodayOrTomorrowTrip, validateVehicleChecklist,
  type CrewSlot, type FieldTrip, type InspectionChecklistEntry, type VehicleChecklistKey, type WorkAction
} from './crewModel';
import {
  ActiveTrip, ActionGrid, BackButton, Button, Dialog, Empty, Heading, IconTile,
  Journey, Panel, Status, TABS, TAB_ART, TaskRow, TripCard, roleName, shortDate, type Screen
} from './CrewFieldUI';
import { CrewArt } from './CrewIllustrations';
import { CrewLiveCamera } from './CrewLiveCamera';
import { OFFICIAL_DESTINATION_AREAS } from '../../utils/areaNormalizer';
import type { CameraEvidence } from './crewCaptureEvidence';
import './crewFieldV66.css';

interface CrewSystemTestSandboxProps {
  currentUser: UserProfile;
  onExit: () => void;
}

function makeSimPhotoDataUrl(label: string): string {
  if (typeof document === 'undefined') return '';
  const canvas = document.createElement('canvas');
  canvas.width = 480;
  canvas.height = 320;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';
  const grad = ctx.createLinearGradient(0, 0, 480, 320);
  grad.addColorStop(0, '#0f2747');
  grad.addColorStop(1, '#1d5bbf');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 480, 320);
  ctx.strokeStyle = 'rgba(255,255,255,0.22)';
  ctx.lineWidth = 3;
  ctx.strokeRect(18, 18, 444, 284);
  ctx.fillStyle = '#93c5fd';
  ctx.font = 'bold 16px sans-serif';
  ctx.fillText('AKK UJI SISTEM · FOTO DOKUMENTASI', 36, 68);
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 26px sans-serif';
  ctx.fillText(label, 36, 130);
  ctx.fillStyle = '#dbeafe';
  ctx.font = '15px monospace';
  const nowStr = new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta', hour12: false });
  ctx.fillText(`Waktu WIB: ${nowStr}`, 36, 184);
  ctx.fillText('GPS Simulasi: -8.2192, 114.3691 (±12 m)', 36, 214);
  ctx.fillStyle = '#86efac';
  ctx.font = 'bold 14px sans-serif';
  ctx.fillText('TERVERIFIKASI (MODE SANDBOX SUPER ADMIN)', 36, 268);
  return canvas.toDataURL('image/jpeg', 0.82);
}

function createInitialSandboxTrips(): FieldTrip[] {
  const { today, tomorrow } = getTodayTomorrowJakarta();
  const now = new Date().toISOString();
  return [
    {
      id: 'sandbox-trip-1',
      branchId: 'cab-banyuwangi',
      area: 'Denpasar 1',
      fleetLabel: 'NMR / DS5 · W 8603 PG',
      date: today,
      departureTime: '07:30',
      trackingNumber: 'UJI-AKK-001',
      driver: null,
      helper: null,
      phase: 'waiting',
      createdAt: now,
      reports: [],
      source: 'qa'
    },
    {
      id: 'sandbox-trip-2',
      branchId: 'cab-banyuwangi',
      area: 'Rogojampi Retail',
      fleetLabel: 'N3 / NS1 · P 8848 U',
      date: tomorrow,
      departureTime: '08:00',
      trackingNumber: 'UJI-AKK-002',
      driver: null,
      helper: null,
      phase: 'waiting',
      createdAt: now,
      reports: [],
      source: 'qa'
    }
  ];
}

export const CrewSystemTestSandbox: React.FC<CrewSystemTestSandboxProps> = ({ currentUser, onExit }) => {
  const isSuperAdmin = currentUser.role === 'super_admin' && currentUser.status === 'approved';
  const reduced = useReducedMotion();
  const mainRef = useRef<HTMLElement | null>(null);

  const [trips, setTrips] = useState<FieldTrip[]>(() => createInitialSandboxTrips());
  const [activeRole, setActiveRole] = useState<CrewSlot>('driver');
  const [screen, setScreen] = useState<Screen>('kiriman');
  const [selectedId, setSelectedId] = useState<string>('sandbox-trip-1');
  const [notice, setNotice] = useState('');
  const [fault, setFault] = useState('');

  const [kmValue, setKmValue] = useState('');
  const [taskConfirm, setTaskConfirm] = useState<{ tripId: string; kind: 'inspection' | 'waybill' } | null>(null);
  const [inspectionStatuses, setInspectionStatuses] = useState<Partial<Record<VehicleChecklistKey, string>>>({});
  const [inspectionPhotos, setInspectionPhotos] = useState<Partial<Record<VehicleChecklistKey, CameraEvidence>>>({});
  const [inspectionCameraKey, setInspectionCameraKey] = useState<VehicleChecklistKey | null>(null);

  const [reportKind, setReportKind] = useState<WorkAction | null>(null);
  const [reportNote, setReportNote] = useState('');
  const [reportPhoto, setReportPhoto] = useState<string>('');
  const [reportCamOpen, setReportCamOpen] = useState(false);

  const [createOpen, setCreateOpen] = useState(false);
  const [newArea, setNewArea] = useState<string>(OFFICIAL_DESTINATION_AREAS[0] || 'Denpasar 1');
  const [newFleet, setNewFleet] = useState('NMR / DS5 · W 8603 PG');
  const [newDay, setNewDay] = useState<'today' | 'tomorrow'>('today');
  const [newHour, setNewHour] = useState('07');
  const [newMinute, setNewMinute] = useState('30');

  useEffect(() => {
    if (!notice) return;
    const t = window.setTimeout(() => setNotice(''), 2800);
    return () => clearTimeout(t);
  }, [notice]);

  useEffect(() => {
    mainRef.current?.scrollTo({ top: 0, behavior: 'instant' });
  }, [screen, selectedId, activeRole]);

  const roleActor = useMemo(() => ({
    id: activeRole === 'driver' ? 'sandbox-driver' : 'sandbox-helper',
    name: activeRole === 'driver'
      ? `Uji Driver (${currentUser.fullName || 'Super Admin'})`
      : `Uji Helper (${currentUser.fullName || 'Super Admin'})`
  }), [activeRole, currentUser.fullName]);

  const slotOfTrip = (trip: FieldTrip): CrewSlot | null => {
    if (trip.driver?.id === roleActor.id) return 'driver';
    if (trip.helper?.id === roleActor.id) return 'helper';
    return null;
  };

  const openTrips = useMemo(() =>
    trips
      .filter(t => !isCompleted(t) && isTodayOrTomorrowTrip(t))
      .sort((a, b) => (a.date === b.date ? a.departureTime.localeCompare(b.departureTime) : a.date.localeCompare(b.date))),
    [trips]
  );

  const completedTrips = useMemo(() =>
    trips
      .filter(isCompleted)
      .sort((a, b) => String(b.returnedAt || b.date || '').localeCompare(String(a.returnedAt || a.date || ''))),
    [trips]
  );

  const myOngoing = useMemo(() => openTrips.filter(t => Boolean(slotOfTrip(t))), [openTrips, roleActor.id]);
  const myClaimedDates = useMemo(
    () => new Set(trips.filter(t => Boolean(slotOfTrip(t))).map(t => t.date).filter(Boolean)),
    [trips, roleActor.id]
  );
  const selectedTrip = trips.find(t => t.id === selectedId) || myOngoing[0] || openTrips[0] || completedTrips[0] || null;
  const activeTrip = myOngoing.find(t => t.id === selectedId) || myOngoing[0] || null;

  const inspectionEntries = useMemo<InspectionChecklistEntry[]>(() =>
    VEHICLE_CHECKLIST_ITEMS.map(item => {
      const ev = item.requiresPhoto ? inspectionPhotos[item.key] : undefined;
      const chosen = inspectionStatuses[item.key] || '';
      return {
        key: item.key,
        label: item.label,
        status: chosen,
        checked: Boolean(chosen),
        requiresPhoto: item.requiresPhoto,
        ...(item.requiresPhoto ? {
          photo: ev?.photo,
          photoAttached: Boolean(ev?.photo),
          capturedAt: ev?.capturedAt,
          gps: ev?.gps
        } : {})
      };
    }),
    [inspectionStatuses, inspectionPhotos]
  );

  const inspectionAnsweredCount = VEHICLE_CHECKLIST_ITEMS.filter(item => Boolean(inspectionStatuses[item.key])).length;
  const inspectionPhotoTotal = VEHICLE_CHECKLIST_ITEMS.filter(item => item.requiresPhoto).length;
  const inspectionPhotoCount = VEHICLE_CHECKLIST_ITEMS.filter(item => item.requiresPhoto && Boolean(inspectionPhotos[item.key]?.photo)).length;
  const inspectionValidationError = useMemo(() => validateVehicleChecklist(inspectionEntries), [inspectionEntries]);
  const activeInspectionCamItem = inspectionCameraKey
    ? VEHICLE_CHECKLIST_ITEMS.find(item => item.key === inspectionCameraKey) || null
    : null;

  if (!isSuperAdmin) return null;

  const clearAlerts = () => { setNotice(''); setFault(''); };

  const handleClaim = (trip: FieldTrip) => {
    clearAlerts();
    if (myOngoing.length > 0) {
      setFault(`Mode ${roleName(activeRole)} sudah memiliki kiriman aktif. Selesaikan atau reset dahulu.`);
      return;
    }
    if (myClaimedDates.has(trip.date)) {
      setFault(`Mode ${roleName(activeRole)} sudah mengambil kiriman pada tanggal ini. Reset untuk mengulang.`);
      return;
    }
    if (trip[activeRole]) {
      setFault(`Slot ${roleName(activeRole)} sudah terisi.`);
      return;
    }
    setTrips(prev => prev.map(t => (t.id === trip.id ? { ...t, [activeRole]: roleActor } : t)));
    setSelectedId(trip.id);
    setScreen('tugas');
    setNotice(`Slot ${roleName(activeRole)} berhasil diambil (Mode Uji).`);
  };

  const handleSaveKm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeTrip || activeRole !== 'driver') return;
    const km = Number(kmValue);
    if (!Number.isFinite(km) || km <= 0 || km > 99999999) {
      setFault('KM awal harus angka lebih dari 0.');
      return;
    }
    clearAlerts();
    setTrips(prev => prev.map(t => (t.id === activeTrip.id ? { ...t, odometerStart: String(km) } : t)));
    setKmValue('');
    setNotice('KM awal tersimpan. Checklist kendaraan kini terbuka.');
  };

  const openTaskModal = (kind: 'inspection' | 'waybill') => {
    if (!activeTrip) return;
    clearAlerts();
    if (kind === 'inspection') {
      if (!activeTrip.odometerStart) {
        setFault('Isi KM awal terlebih dahulu sebelum mengisi pemeriksaan armada.');
        return;
      }
      setInspectionStatuses({});
      setInspectionPhotos({});
      setInspectionCameraKey(null);
    }
    setTaskConfirm({ tripId: activeTrip.id, kind });
  };

  const handleSimulatePhoto = (key: VehicleChecklistKey, label: string) => {
    const dataUrl = makeSimPhotoDataUrl(label);
    const now = new Date().toISOString();
    const simEvidence: CameraEvidence = {
      photo: dataUrl,
      source: 'camera',
      capturedAt: now,
      gpsCapturedAt: now,
      gps: { latitude: -8.2192, longitude: 114.3691, accuracy: 12 }
    };
    setInspectionPhotos(prev => ({ ...prev, [key]: simEvidence }));
    clearAlerts();
  };

  const handleSaveTask = () => {
    if (!taskConfirm) return;
    if (taskConfirm.kind === 'inspection') {
      const err = validateVehicleChecklist(inspectionEntries);
      if (err) {
        setFault(err);
        return;
      }
      setTrips(prev =>
        prev.map(t =>
          t.id === taskConfirm.tripId
            ? { ...t, inspectionDone: true, inspectionChecklist: inspectionEntries }
            : t
        )
      );
      setTaskConfirm(null);
      setNotice('Checklist 7 item & 4 foto bukti tersimpan.');
      return;
    }
    setTrips(prev =>
      prev.map(t => (t.id === taskConfirm.tripId ? { ...t, waybillValidated: true } : t))
    );
    setTaskConfirm(null);
    setNotice('Form Keluar & Validasi Keberangkatan tersimpan.');
  };

  const handleMove = (next: 'going' | 'returned') => {
    if (!activeTrip) return;
    clearAlerts();
    const now = new Date().toISOString();
    if (next === 'going') {
      if (!activeTrip.driver || !activeTrip.helper || !activeTrip.odometerStart || !activeTrip.inspectionDone || !activeTrip.waybillValidated) {
        setFault('Lengkapi Kru, KM awal, Cek Armada (7 item + 4 foto), dan Validasi Surat Jalan.');
        return;
      }
      setTrips(prev => prev.map(t => (t.id === activeTrip.id ? { ...t, phase: 'going', departedAt: now } : t)));
      setNotice('Berangkat tercatat untuk Driver & Helper.');
      return;
    }
    setTrips(prev => prev.map(t => (t.id === activeTrip.id ? { ...t, phase: 'returned', returnedAt: now } : t)));
    setScreen('riwayat');
    setNotice('Tiba di gudang tercatat. Kiriman otomatis hilang dari halaman Kiriman & masuk Riwayat.');
  };

  const handleSubmitSandboxReport = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeTrip || !reportKind) return;
    if (reportNote.trim().length < 3) {
      setFault('Keterangan minimal 3 huruf.');
      return;
    }
    if (!reportPhoto) {
      setFault('Ambil foto bukti laporan terlebih dahulu.');
      return;
    }
    const newRep = {
      id: `sandbox-rep-${Date.now()}`,
      type: reportKind,
      note: reportNote.trim(),
      by: roleActor.name,
      at: new Date().toISOString(),
      photo: reportPhoto,
      gps: { latitude: -8.2192, longitude: 114.3691, accuracy: 12 }
    };
    setTrips(prev => prev.map(t => (t.id === activeTrip.id ? { ...t, reports: [newRep, ...t.reports] } : t)));
    setReportKind(null);
    setReportNote('');
    setReportPhoto('');
    setNotice('Laporan uji tersimpan.');
  };

  const handleResetTrip = (tripId: string) => {
    clearAlerts();
    setTrips(prev =>
      prev.map(t =>
        t.id === tripId
          ? {
              ...t,
              driver: null,
              helper: null,
              phase: 'waiting',
              departedAt: undefined,
              returnedAt: undefined,
              odometerStart: undefined,
              inspectionDone: false,
              inspectionChecklist: undefined,
              waybillValidated: false,
              reports: []
            }
          : t
      )
    );
    setKmValue('');
    setReportKind(null);
    setScreen('kiriman');
    setNotice('Kiriman uji berhasil direset ke kondisi awal.');
  };

  const handleCreateSandboxTrip = (e: React.FormEvent) => {
    e.preventDefault();
    const { today, tomorrow } = getTodayTomorrowJakarta();
    const id = `sandbox-trip-${Date.now()}`;
    const created: FieldTrip = {
      id,
      branchId: 'cab-banyuwangi',
      area: newArea,
      fleetLabel: newFleet.trim() || 'NMR / DS5 · W 8603 PG',
      date: newDay === 'today' ? today : tomorrow,
      departureTime: `${newHour}:${newMinute}`,
      trackingNumber: `UJI-AKK-${String(trips.length + 1).padStart(3, '0')}`,
      driver: null,
      helper: null,
      phase: 'waiting',
      createdAt: new Date().toISOString(),
      reports: [],
      source: 'qa'
    };
    setTrips(prev => [created, ...prev]);
    setSelectedId(id);
    setCreateOpen(false);
    setScreen('kiriman');
    setNotice(`Kiriman uji "${created.area}" (${created.departureTime} WIB) ditambahkan.`);
  };

  const allReports = trips
    .flatMap(t => t.reports.map(report => ({ trip: t, report })))
    .sort((a, b) => String(b.report.at).localeCompare(String(a.report.at)));

  return (
    <section id="akk-crew-v66" className="cv66-root cv70-monitor" data-testid="akk-crew-system-test-sandbox">
      <div className="cv66-shell">
        <header className="cv66-header">
          <div className="cv66-brand">
            <span className="cv66-brand-icon"><CrewArt name="truck" size={37}/></span>
            <div className="cv66-brand-text">
              <span className="cv66-brand-title">Uji Sistem Portal Driver</span>
              <span className="cv66-brand-sub">Sandbox Super Admin · Tidak mengubah data live</span>
            </div>
          </div>
          <div className="cv66-header-actions">
            <button
              type="button"
              className="cv72-header-test-btn"
              onClick={() => { clearAlerts(); setCreateOpen(true); }}
            >
              <Plus size={15}/>
              <span>Kiriman Uji</span>
            </button>
            <button
              type="button"
              className="cv72-header-test-btn cv72-header-test-btn--exit"
              onClick={onExit}
            >
              <X size={15}/>
              <span>Keluar Uji</span>
            </button>
          </div>
        </header>

        <main ref={mainRef} className="cv66-main">
          <div className="cv72-sandbox-bar">
            <span className="cv66-inline">
              <FlaskConical size={15}/>
              <span>Simulasi terisolasi (Super Admin) — ganti peran Driver/Helper untuk uji alur penuh</span>
            </span>
            <button
              type="button"
              className="cv72-photo-btn cv72-photo-btn--ghost"
              onClick={() => {
                setTrips(createInitialSandboxTrips());
                setSelectedId('sandbox-trip-1');
                setScreen('kiriman');
                setNotice('Seluruh data uji direset ke awal.');
              }}
            >
              <RotateCcw size={13}/>
              <span>Reset Semua Uji</span>
            </button>
          </div>

          <div className="cv70-toggle" style={{ marginTop: 10, marginBottom: 10 }} aria-label="Pilih peran simulasi">
            {(['driver', 'helper'] as const).map(role => (
              <button
                key={role}
                type="button"
                aria-pressed={activeRole === role}
                className={activeRole === role ? 'cv70-selected' : ''}
                onClick={() => { setActiveRole(role); setReportKind(null); clearAlerts(); }}
              >
                Peran: {role === 'driver' ? 'Driver' : 'Helper'}
              </button>
            ))}
          </div>

          {fault && (
            <div className="cv66-notice cv66-notice--error" style={{ margin: '0 0 10px' }} role="alert">
              <CloudOff size={18}/>
              <span>{fault}</span>
              <button type="button" aria-label="Tutup pesan" onClick={() => setFault('')}><X size={17}/></button>
            </div>
          )}
          {notice && (
            <div className="cv66-notice cv66-notice--success" style={{ margin: '0 0 10px' }} role="status">
              <CheckCircle2 size={18}/>
              <span>{notice}</span>
              <button type="button" aria-label="Tutup pesan" onClick={() => setNotice('')}><X size={17}/></button>
            </div>
          )}

          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              className={`cv66-screen cv70-screen cv70-screen--${screen}`}
              key={`${screen}-${activeRole}`}
              initial={reduced ? false : { opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={reduced ? { opacity: 1 } : { opacity: 0, y: -3 }}
              transition={{ duration: reduced ? 0 : 0.16 }}
            >
              {screen === 'kiriman' && (
                <>
                  <Heading title={`Kiriman (${roleName(activeRole)})`}/>
                  {openTrips.length ? (
                    openTrips.map(t => {
                      const mine = slotOfTrip(t);
                      const lockedSameDay = Boolean(t.date && myClaimedDates.has(t.date) && !mine);
                      return (
                        <TripCard
                          key={t.id}
                          trip={t}
                          mine={mine}
                          claimAllowed={myOngoing.length === 0 && !t[activeRole]}
                          sameDayLocked={lockedSameDay}
                          busy={false}
                          onOpen={() => { setSelectedId(t.id); setScreen('tugas'); }}
                          onClaim={() => handleClaim(t)}
                        />
                      );
                    })
                  ) : (
                    <Empty
                      icon={Truck}
                      title="Semua kiriman uji sudah selesai"
                      detail="Kiriman yang sudah Tiba di Gudang otomatis pindah ke tab Riwayat."
                      action={{ label: 'Tambah Kiriman Uji', run: () => setCreateOpen(true) }}
                    />
                  )}
                </>
              )}

              {screen === 'tugas' && (
                <>
                  <Heading title={`Tugas (${roleName(activeRole)})`}/>
                  {!activeTrip ? (
                    <Empty
                      icon={ClipboardCheck}
                      title={`Belum ada kiriman diambil sebagai ${roleName(activeRole)}`}
                      detail="Buka tab Kiriman lalu klik Ambil Kiriman untuk menguji alur posisi ini."
                      action={{ label: 'Lihat Kiriman Uji', run: () => setScreen('kiriman') }}
                    />
                  ) : (
                    <>
                      <ActiveTrip trip={activeTrip} slot={activeRole}/>
                      <Panel title="Persiapan">
                        {activeRole === 'driver' ? (
                          <>
                            <div className="cv66-km">
                              <div className="cv66-km-label">
                                <IconTile
                                  icon={activeTrip.odometerStart ? CheckCircle2 : Truck}
                                  art={activeTrip.odometerStart ? 'success' : 'gauge'}
                                  tone={activeTrip.odometerStart ? 'green' : 'blue'}
                                />
                                <span className="cv66-row-title">KM Awal</span>
                                {activeTrip.odometerStart && (
                                  <span className="cv66-km-value">{activeTrip.odometerStart} km</span>
                                )}
                              </div>
                              {!activeTrip.odometerStart && (
                                <form className="cv66-km-form" onSubmit={handleSaveKm}>
                                  <input
                                    type="number"
                                    inputMode="numeric"
                                    min="1"
                                    max="99999999"
                                    step="1"
                                    value={kmValue}
                                    placeholder="Isi KM (contoh: 45120)"
                                    aria-label="KM awal kendaraan uji"
                                    onChange={e => setKmValue(e.target.value)}
                                    required
                                  />
                                  <Button type="submit" disabled={!Number.isFinite(Number(kmValue)) || Number(kmValue) <= 0}>
                                    Simpan
                                  </Button>
                                </form>
                              )}
                            </div>
                            <TaskRow
                              icon={ShieldCheck}
                              label="Cek Armada"
                              detail={
                                !activeTrip.odometerStart
                                  ? 'Isi KM awal terlebih dahulu'
                                  : activeTrip.inspectionDone
                                    ? '7 kondisi & 4 foto bukti tersimpan'
                                    : '7 pemeriksaan kondisi · 4 foto bukti wajib'
                              }
                              done={Boolean(activeTrip.inspectionDone)}
                              disabled={!activeTrip.odometerStart}
                              onClick={() => openTaskModal('inspection')}
                            />
                          </>
                        ) : (
                          <TaskRow
                            icon={ClipboardCheck}
                            label="Validasi Surat Jalan"
                            detail={activeTrip.waybillValidated ? 'Tervalidasi' : 'Centang 2 item validasi dokumen'}
                            done={Boolean(activeTrip.waybillValidated)}
                            onClick={() => openTaskModal('waybill')}
                          />
                        )}
                      </Panel>

                      <Journey trip={activeTrip} busy={false} onMove={handleMove}/>

                      <Panel title="Aktivitas" className="cv69-action-panel cv70-wide">
                        <ActionGrid
                          actions={WORK_FOR_SLOT[activeRole]}
                          busy={false}
                          onAction={kind => {
                            setReportKind(kind);
                            setReportNote('');
                            setReportPhoto('');
                            setScreen('laporan');
                          }}
                        />
                      </Panel>

                      <Panel title="Kontrol Reset Uji" className="cv70-wide">
                        <Button variant="danger" onClick={() => handleResetTrip(activeTrip.id)}>
                          <RotateCcw size={16}/>Reset Kiriman Uji Seperti Semula
                        </Button>
                      </Panel>
                    </>
                  )}
                </>
              )}

              {screen === 'laporan' && (
                <>
                  <Heading title="Laporan Uji"/>
                  {reportKind && activeTrip ? (
                    <Panel className="cv70-wide">
                      <BackButton onClick={() => setReportKind(null)}/>
                      <h2 className="cv66-section-title cv66-report-title">{WORK_LABELS[reportKind]}</h2>
                      <p className="cv66-meta">{activeTrip.area} · {activeTrip.fleetLabel}</p>
                      <form className="cv66-form" onSubmit={handleSubmitSandboxReport}>
                        <label className="cv66-field">
                          <span>Keterangan</span>
                          <textarea
                            value={reportNote}
                            onChange={e => setReportNote(e.target.value)}
                            minLength={3}
                            maxLength={1200}
                            required
                            rows={3}
                            placeholder="Tulis keterangan laporan uji"
                          />
                        </label>
                        {reportPhoto ? (
                          <div className="cv66-photo">
                            <img src={reportPhoto} alt="Bukti laporan uji"/>
                            <button type="button" aria-label="Hapus foto" onClick={() => setReportPhoto('')}><X size={16}/></button>
                          </div>
                        ) : (
                          <div className="cv72-check-photo-actions">
                            <button type="button" className="cv72-photo-btn" onClick={() => setReportCamOpen(true)}>
                              <Camera size={14}/><span>Buka Kamera</span>
                            </button>
                            <button
                              type="button"
                              className="cv72-photo-btn cv72-photo-btn--ghost"
                              onClick={() => setReportPhoto(makeSimPhotoDataUrl(WORK_LABELS[reportKind]))}
                            >
                              <Sparkles size={14}/><span>Foto Simulasi</span>
                            </button>
                          </div>
                        )}
                        <Button type="submit" disabled={!reportPhoto || reportNote.trim().length < 3}>
                          <Check size={18}/>Simpan Laporan Uji
                        </Button>
                      </form>
                    </Panel>
                  ) : allReports.length ? (
                    allReports.map(({ trip, report }) => (
                      <article key={report.id} className="cv66-panel cv70-report">
                        <div className="cv70-report-top">
                          <IconTile icon={FileText}/>
                          <div className="cv66-row-text">
                            <h2 className="cv66-section-title">{WORK_LABELS[report.type] || report.type}</h2>
                            <span className="cv66-meta">{trip.area} · {report.by}</span>
                          </div>
                        </div>
                        <p className="cv70-report-note">{report.note}</p>
                        {report.photo && <img src={report.photo} alt="Bukti" className="cv72-admin-check-photo"/>}
                      </article>
                    ))
                  ) : (
                    <Empty icon={FileText} title="Belum ada laporan uji"/>
                  )}
                </>
              )}

              {screen === 'riwayat' && (
                <>
                  <Heading title="Riwayat Uji"/>
                  {completedTrips.length ? (
                    completedTrips.map(t => (
                      <article className="cv66-panel cv66-history" key={t.id}>
                        <div className="cv66-row">
                          <IconTile icon={CheckCircle2} tone="green"/>
                          <span className="cv66-row-text">
                            <span className="cv66-history-title">{t.area}</span>
                            <span className="cv66-meta">{shortDate(t.date)} · {t.fleetLabel}</span>
                          </span>
                          <Status trip={t}/>
                        </div>
                        <dl className="cv66-history-detail">
                          <div><dt>Berangkat</dt><dd>{t.departedAt ? new Date(t.departedAt).toLocaleString('id-ID', { hour12: false }) : '-'}</dd></div>
                          <div><dt>Tiba di Gudang</dt><dd>{t.returnedAt ? new Date(t.returnedAt).toLocaleString('id-ID', { hour12: false }) : '-'}</dd></div>
                          <div><dt>Checklist Armada</dt><dd>{t.inspectionChecklist?.length || 0}/7 item</dd></div>
                        </dl>
                        <Button variant="secondary" onClick={() => handleResetTrip(t.id)}>
                          <RotateCcw size={15}/>Reset & Uji Ulang
                        </Button>
                      </article>
                    ))
                  ) : (
                    <Empty
                      icon={FileClock}
                      title="Belum ada riwayat uji"
                      detail="Setelah klik Tiba di Gudang, kiriman uji otomatis masuk ke sini dan hilang dari tab Kiriman."
                    />
                  )}
                </>
              )}
            </motion.div>
          </AnimatePresence>
        </main>

        <nav className="cv66-tabs" aria-label="Navigasi Uji Sistem">
          {TABS.map(({ id, label }) => (
            <motion.button
              type="button"
              key={id}
              aria-current={screen === id ? 'page' : undefined}
              className={`cv66-tab ${screen === id ? 'cv66-tab--active' : ''}`}
              onClick={() => { setScreen(id); setReportKind(null); clearAlerts(); }}
              whileTap={reduced ? undefined : { scale: 0.95 }}
            >
              {screen === id && (
                <motion.span
                  className="cv69-tab-indicator"
                  layoutId="cv72-sandbox-tab"
                  transition={reduced ? { duration: 0 } : { type: 'spring', stiffness: 440, damping: 36 }}
                />
              )}
              <CrewArt name={TAB_ART[id]} size={30} active={screen === id}/>
              <span className="cv69-tab-label">{label}</span>
            </motion.button>
          ))}
        </nav>
      </div>

      <AnimatePresence>
        {taskConfirm && (
          <Dialog
            key="sandbox-check"
            title={taskConfirm.kind === 'inspection' ? 'Cek Armada (Uji Sistem)' : 'Cek Surat Jalan (Uji Sistem)'}
            busy={false}
            onClose={() => { setTaskConfirm(null); setInspectionCameraKey(null); clearAlerts(); }}
          >
            {taskConfirm.kind === 'inspection' ? (
              <>
                <div className={`cv72-check-summary ${!inspectionValidationError ? 'cv72-check-summary--ready' : ''}`}>
                  <span>Terisi: {inspectionAnsweredCount}/{VEHICLE_CHECKLIST_ITEMS.length}</span>
                  <span>Foto bukti: {inspectionPhotoCount}/{inspectionPhotoTotal}</span>
                </div>
                <div className="cv72-check-list">
                  {VEHICLE_CHECKLIST_ITEMS.map(item => {
                    const selectedStatus = inspectionStatuses[item.key] || '';
                    const evidence = item.requiresPhoto ? inspectionPhotos[item.key] : undefined;
                    const itemDone = Boolean(selectedStatus) && (!item.requiresPhoto || Boolean(evidence?.photo));
                    return (
                      <div key={item.key} className={`cv72-check-card ${itemDone ? 'cv72-check-card--done' : ''}`}>
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
                                onClick={() => setInspectionCameraKey(item.key)}
                              >
                                <Camera size={14}/>
                                <span>{evidence?.photo ? 'Kamera Ulang' : 'Kamera Live'}</span>
                              </button>
                              <button
                                type="button"
                                className="cv72-photo-btn cv72-photo-btn--ghost"
                                onClick={() => handleSimulatePhoto(item.key, item.label)}
                              >
                                <Sparkles size={14}/>
                                <span>Foto Simulasi</span>
                              </button>
                              {evidence?.photo && (
                                <button
                                  type="button"
                                  className="cv72-photo-btn cv72-photo-btn--ghost"
                                  onClick={() => {
                                    setInspectionPhotos(prev => {
                                      const next = { ...prev };
                                      delete next[item.key];
                                      return next;
                                    });
                                  }}
                                >
                                  <X size={13}/><span>Hapus</span>
                                </button>
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
                  disabled={Boolean(inspectionCameraKey) || Boolean(inspectionValidationError)}
                  onClick={handleSaveTask}
                >
                  <Check size={18}/>Simpan Cek Armada
                </Button>
              </>
            ) : (
              <>
                {activeTrip && (
                  <div className="cv75-flat-card space-y-2 text-xs text-slate-700">
                    <div>Cabang: <strong>{activeTrip.branchId === 'cab-sidoarjo' ? 'Sidoarjo' : 'Nusantara'}</strong></div>
                    <div>Driver: <strong>{activeTrip.driver?.name || '-'}</strong></div>
                    <div>Helper: <strong>{activeTrip.helper?.name || '-'}</strong></div>
                    <div>Mobil Kiriman: <strong>{activeTrip.fleetLabel || '-'}</strong></div>
                    <div>Jam Berangkat: <strong>{activeTrip.departureTime || '07:30'} WIB</strong></div>
                    <div>Area Kirim: <strong>{activeTrip.area || '-'}</strong></div>
                  </div>
                )}
                <Button onClick={handleSaveTask}>
                  <Check size={18}/>Simpan Form Keluar
                </Button>
              </>
            )}
          </Dialog>
        )}

        {createOpen && (
          <Dialog key="sandbox-create" title="Buat Kiriman Uji" onClose={() => setCreateOpen(false)}>
            <form className="cv66-form" onSubmit={handleCreateSandboxTrip}>
              <label className="cv66-picker">
                <span>Area</span>
                <select value={newArea} onChange={e => setNewArea(e.target.value)}>
                  {OFFICIAL_DESTINATION_AREAS.map(area => (
                    <option key={area} value={area}>{area}</option>
                  ))}
                </select>
                <ChevronDown size={17}/>
              </label>
              <label className="cv66-field">
                <span>Armada</span>
                <input
                  type="text"
                  value={newFleet}
                  onChange={e => setNewFleet(e.target.value)}
                  style={{ padding: '10px 11px', borderRadius: 11, border: '1px solid var(--cv-line)', fontSize: 14 }}
                />
              </label>
              <div className="cv70-toggle">
                <button type="button" className={newDay === 'today' ? 'cv70-selected' : ''} onClick={() => setNewDay('today')}>Hari Ini</button>
                <button type="button" className={newDay === 'tomorrow' ? 'cv70-selected' : ''} onClick={() => setNewDay('tomorrow')}>Besok</button>
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <label className="cv66-picker" style={{ flex: 1 }}>
                  <span>Jam</span>
                  <select value={newHour} onChange={e => setNewHour(e.target.value)}>
                    {Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0')).map(h => (
                      <option key={h} value={h}>{h}</option>
                    ))}
                  </select>
                  <ChevronDown size={15}/>
                </label>
                <label className="cv66-picker" style={{ flex: 1 }}>
                  <span>Menit</span>
                  <select value={newMinute} onChange={e => setNewMinute(e.target.value)}>
                    {['00', '15', '30', '45'].map(m => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                  <ChevronDown size={15}/>
                </label>
                <span className="cv66-meta">WIB</span>
              </div>
              <Button type="submit"><Plus size={17}/>Tambahkan Kiriman Uji</Button>
            </form>
          </Dialog>
        )}
      </AnimatePresence>

      {reportCamOpen && reportKind && (
        <CrewLiveCamera
          title={`Foto: ${WORK_LABELS[reportKind]}`}
          onClose={() => setReportCamOpen(false)}
          onCapture={ev => { setReportPhoto(ev.photo); setReportCamOpen(false); }}
        />
      )}

      {taskConfirm?.kind === 'inspection' && activeInspectionCamItem && (
        <CrewLiveCamera
          key={`sandbox-insp-${activeInspectionCamItem.key}`}
          title={`Foto: ${activeInspectionCamItem.label}`}
          onClose={() => setInspectionCameraKey(null)}
          onCapture={ev => {
            const key = activeInspectionCamItem.key;
            setInspectionPhotos(prev => ({ ...prev, [key]: ev }));
            setInspectionCameraKey(null);
            clearAlerts();
          }}
        />
      )}
    </section>
  );
};

export default CrewSystemTestSandbox;
