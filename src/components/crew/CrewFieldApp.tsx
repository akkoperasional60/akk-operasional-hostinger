import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import {
  ArrowUpRight, Camera, Check, CheckCircle2, ChevronDown, ChevronRight, ClipboardCheck,
  CloudOff, FileClock, FileText, LoaderCircle, LogOut, RefreshCw, Search, ShieldCheck,
  Truck, Users, X
} from 'lucide-react';
import type { UserProfile } from '../../types';
import { logisticsStore } from '../../services/store';
import { WORK_FOR_SLOT, WORK_LABELS, isQaAccount, isCompleted, slotForUser,
  type CrewSlot, type FieldTrip, type WorkAction } from './crewModel';
import { canClaimLive, claimTrip, getTripsForUser, listenCrewChanged, markTask,
  moveTrip, recordKm, submitWorkReport } from './crewApi';
import { TABS, REPORT_ICONS, shortDate, initials, roleName, Button, IconTile, Heading,
  Panel, Empty, TripCard, ActiveTrip, TaskRow, Journey, Dialog, BackButton, type Screen } from './CrewFieldUI';
import { CrewLiveCamera, EvidencePreview } from './CrewLiveCamera';
import { validateCameraEvidence, type CameraEvidence } from './crewCaptureEvidence';
import './crewFieldV66.css';

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
  const [accountOpen, setAccountOpen] = useState(false);
  const [taskConfirm, setTaskConfirm] = useState<{tripId: string; kind: 'inspection' | 'waybill'} | null>(null);
  const [taskChecks, setTaskChecks] = useState<[boolean, boolean]>([false,false]);
  const [reportKind, setReportKind] = useState<WorkAction | null>(null);
  const [reportTripId, setReportTripId] = useState<string | null>(null);
  const [reportNote, setReportNote] = useState('');
  const [reportEvidence, setReportEvidence] = useState<CameraEvidence | null>(null);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [kmValue, setKmValue] = useState('');
  const [expandedHistory, setExpandedHistory] = useState<string | null>(null);
  const alive = useRef(true);
  const refreshInFlight = useRef<Promise<void> | null>(null);
  const mutationInFlight = useRef(false);
  const main = useRef<HTMLElement | null>(null);

  // A post-mutation refresh must not reuse a read started before the mutation.
  const refresh = useCallback(async (quiet = false, afterMutation = false) => {
    if (refreshInFlight.current) {
      if (!afterMutation) { await refreshInFlight.current; return; }
      await refreshInFlight.current;
    }
    if (!quiet) setRefreshing(true);
    const request = (async () => {
      try {
        const next = await getTripsForUser(user);
        if (alive.current) { loadedOnce.current = true; setTrips(next); if (!quiet && !afterMutation) setFault(''); }
      } catch (e) {
        if (alive.current) setFault((e as Error)?.message || 'Gagal memuat jadwal.');
        if (afterMutation) throw e;
      } finally {
        if (alive.current) { setLoading(false); setRefreshing(false); }
      }
    })();
    refreshInFlight.current = request;
    try { await request; }
    finally { if (refreshInFlight.current === request) refreshInFlight.current = null; }
  }, [user.id, user.email, user.fullName]);
  useEffect(() => {
    alive.current = true;
    void refresh();
    const poll = () => { if (!mutationInFlight.current) void refresh(true); };
    const detach = listenCrewChanged(poll);
    const onVisibility = () => { if (document.visibilityState === 'visible') poll(); };
    document.addEventListener('visibilitychange', onVisibility);
    const timer = window.setInterval(poll, qa ? 5000 : 12000);
    return () => { alive.current = false; detach(); document.removeEventListener('visibilitychange', onVisibility); clearInterval(timer); };
  }, [refresh, qa]);
  const mine = useMemo(() => trips.filter(t => Boolean(slotForUser(t, user))), [trips, user.id, user.fullName]);
  const ongoing = useMemo(() => mine.filter(t => !isCompleted(t)), [mine]);
  const completed = useMemo(() => mine.filter(isCompleted), [mine]);
  const openTrips = useMemo(() => trips.filter(t => t.phase !== 'returned'), [trips]);
  const visibleTrips = useMemo(() => openTrips.filter(t => {
    const query = search.trim().toLocaleLowerCase('id-ID');
    return !query || [t.area, t.fleetLabel, t.trackingNumber, t.driver?.name, t.helper?.name].some(v => String(v || '').toLocaleLowerCase('id-ID').includes(query));
  }), [openTrips, search]);
  const activeTrip = ongoing.find(t => t.id === selectedId) || ongoing[0] || null;
  const activeSlot = activeTrip ? slotForUser(activeTrip, user) : null;
  const reportTrip = reportTripId ? ongoing.find(t => t.id === reportTripId) || null : null;
  const claimTarget = trips.find(t => t.id === claimId);
  const claimAllowed = qa || canClaimLive();
  const branchText = useMemo(() => {
    const ids = Array.from(new Set(trips.map(t => t.branchId)));
    return ids.length === 1 ? (ids[0] === 'cab-sidoarjo' ? 'Sidoarjo' : ids[0] === 'cab-banyuwangi' ? 'Nusantara' : '') : '';
  }, [trips]);
  const modalOpen = Boolean(claimId || taskConfirm || accountOpen || cameraOpen);
  useEffect(() => { main.current?.scrollTo({top:0, behavior:'instant'}); }, [screen, selectedId, reportKind]);
  useEffect(() => { setKmValue(''); }, [activeTrip?.id]);
  useEffect(() => { if (!reportTrip || screen !== 'laporan') setCameraOpen(false); }, [reportTrip?.id, screen]);
  useEffect(() => {
    if (!message) return;
    const timer = window.setTimeout(() => setMessage(''), 3500);
    return () => clearTimeout(timer);
  }, [message]);
  const resetReport = () => { setCameraOpen(false); setReportKind(null); setReportTripId(null); setReportNote(''); setReportEvidence(null); };
  const clearNotice = () => { setMessage(''); setFault(''); };
  const nav = (next: Screen) => { if (mutationInFlight.current) return; setScreen(next); resetReport(); clearNotice(); main.current?.scrollTo({top:0}); };
  const choose = (id: string, next: Screen = 'tugas') => { setSelectedId(id); setScreen(next); resetReport(); clearNotice(); };
  const invoke = async (fn: () => Promise<void>, success: string, after?: () => void) => {
    if (mutationInFlight.current) return;
    mutationInFlight.current = true; setBusy(true); clearNotice();
    try {
      await fn();
      // The API has acknowledged the write. A subsequent read failure must not encourage a duplicate write.
      after?.();
      try { await refresh(true, true); setMessage(success); }
      catch { setFault('Tersimpan, tetapi jadwal belum dapat dimuat. Tekan muat ulang.'); }
    } catch (e) { setFault((e as Error)?.message || 'Gagal menyimpan. Coba lagi.'); }
    finally { mutationInFlight.current = false; setBusy(false); }
  };
  const submitClaim = (slot: CrewSlot) => {
    if (!claimId || !claimTarget || !claimAllowed || claimTarget.phase !== 'waiting' || claimTarget[slot] || slotForUser(claimTarget,user)) return;
    const id = claimId;
    void invoke(() => claimTrip(user,id,slot), 'Kiriman berhasil diambil.', () => {setClaimId(null); choose(id);});
  };
  const openTaskConfirm = (kind: 'inspection' | 'waybill') => {
    if (!activeTrip || busy || (kind === 'inspection' ? activeTrip.inspectionDone : activeTrip.waybillValidated)) return;
    clearNotice(); setTaskChecks([false,false]); setTaskConfirm({tripId:activeTrip.id,kind});
  };
  const openReport = (kind: WorkAction) => {
    if (!activeTrip || !activeSlot || busy || !WORK_FOR_SLOT[activeSlot].includes(kind)) return;
    if (kind === 'form_kirim' && !qa && onOpenClassic) { onOpenClassic(); return; }
    resetReport(); clearNotice(); setReportTripId(activeTrip.id); setReportKind(kind); setScreen('laporan');
  };
  const startCamera = () => { if (!reportTrip || !reportKind || busy) return; clearNotice(); setCameraOpen(true); };
  const sendReport = (e: React.FormEvent) => {
    e.preventDefault();
    if (!reportTrip || !reportKind || !slotForUser(reportTrip,user) || reportNote.trim().length < 3 || busy || cameraOpen) return;
    const invalid = validateCameraEvidence(reportEvidence);
    if (!reportEvidence || invalid) { setFault(invalid || 'Ambil foto terlebih dahulu.'); return; }
    const kind = reportKind, evidence = reportEvidence;
    void invoke(() => submitWorkReport(user, reportTrip.id, kind, reportNote, evidence), 'Laporan tersimpan.', resetReport);
  };
  const saveKm = (e: React.FormEvent) => {
    e.preventDefault(); if (!activeTrip || activeSlot !== 'driver' || activeTrip.odometerStart) return;
    void invoke(() => recordKm(user,activeTrip.id,kmValue), 'KM awal tersimpan.', () => setKmValue(''));
  };
  const handleMove = (phase: 'going' | 'returned') => {
    if (!activeTrip || !activeSlot) return;
    void invoke(() => moveTrip(user,activeTrip.id,phase), phase === 'going' ? 'Keberangkatan tercatat.' : 'Kiriman selesai.', phase === 'returned' ? () => {setScreen('riwayat'); setExpandedHistory(activeTrip.id); resetReport();} : undefined);
  };
  const saveCheck = () => {
    if (!taskConfirm || !taskChecks.every(Boolean)) return;
    const target = ongoing.find(t=>t.id===taskConfirm.tripId);
    const slot = target ? slotForUser(target,user) : null;
    if (!target || slot !== (taskConfirm.kind === 'inspection' ? 'driver' : 'helper')) {setFault('Tugas tidak tersedia. Muat ulang jadwal.');return;}
    void invoke(() => markTask(user,taskConfirm.tripId,taskConfirm.kind), 'Pemeriksaan tersimpan.', () => setTaskConfirm(null));
  };
  const notice = fault ? <div className="cv66-notice cv66-notice--error" role="alert"><CloudOff size={18}/><span>{fault}</span><button type="button" aria-label="Tutup pesan" onClick={()=>setFault('')}><X size={17}/></button></div>
    : message ? <div className="cv66-notice cv66-notice--success" role="status"><CheckCircle2 size={18}/><span>{message}</span><button type="button" aria-label="Tutup pesan" onClick={()=>setMessage('')}><X size={17}/></button></div> : null;
  const tripPicker = ongoing.length > 1 && activeTrip ? <label className="cv66-picker"><span>Kiriman</span><select aria-label="Pilih kiriman" value={activeTrip.id} disabled={busy} onChange={e=>{setSelectedId(e.target.value);setKmValue('');resetReport();clearNotice();}}>{ongoing.map(t=><option key={t.id} value={t.id}>{t.area} - {shortDate(t.date)}</option>)}</select><ChevronDown size={17}/></label> : null;

  if (typeof document === 'undefined') return null;
  return createPortal(
    <div id="akk-crew-v66" className="cv66-root" data-testid="akk-crew-field-v65" data-version="68">
      <div className="cv66-shell">
        <header className="cv66-header"><div className="cv66-brand"><span className="cv66-brand-icon"><Truck size={23}/></span><div className="cv66-brand-text"><span className="cv66-brand-title">AKK Pengiriman</span>{(qa || branchText) && <span className="cv66-brand-sub">{qa ? 'Simulasi' : branchText}</span>}</div></div>
          <div className="cv66-header-actions"><button type="button" aria-label="Muat ulang jadwal" disabled={refreshing || busy} onClick={()=>void refresh()} className="cv66-icon-button"><RefreshCw size={20} className={refreshing ? 'cv66-spin' : ''}/></button><button type="button" aria-label="Akun" disabled={busy} onClick={()=>{clearNotice();setAccountOpen(true);}} className="cv66-avatar">{initials(user.fullName)}</button></div>
        </header>
        {!modalOpen && notice}
        <main ref={main} className="cv66-main" id="akk-crew-main-content" aria-busy={loading}>
          {loading ? <div className="cv66-loading" role="status"><LoaderCircle size={24} className="cv66-spin"/>Memuat kiriman...</div> : !loadedOnce.current ? <Empty icon={CloudOff} title="Jadwal gagal dimuat" action={{label:'Muat Ulang',run:()=>void refresh()}}/> :
          <AnimatePresence mode="wait" initial={false}>
            <motion.div className="cv66-screen" key={screen} initial={reduced ? false : {opacity:0,y:4}} animate={{opacity:1,y:0}} exit={reduced ? {opacity:1} : {opacity:0}} transition={{duration:reduced ? 0 : .14}}>
              {screen === 'kiriman' && <>
                <Heading title="Kiriman"/>
                {ongoing.length > 0 && <button type="button" className="cv66-resume" disabled={busy} onClick={()=>choose(activeTrip?.id || ongoing[0].id)}><IconTile icon={ClipboardCheck}/><span className="cv66-row-text"><span className="cv66-row-title">Lanjutkan Kiriman</span><span className="cv66-meta">{activeTrip?.area || ongoing[0].area}</span></span><ChevronRight size={20}/></button>}
                {(openTrips.length > 0 || search) && <label className="cv66-search"><Search size={20}/><input aria-label="Cari kiriman" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Cari area atau armada"/>{search && <button type="button" aria-label="Hapus pencarian" onClick={()=>setSearch('')}><X size={18}/></button>}</label>}
                {!claimAllowed && visibleTrips.some(t=>t.phase==='waiting' && (!t.driver || !t.helper) && !slotForUser(t,user)) && <div className="cv66-required">Pengambilan kiriman belum aktif di server.</div>}
                {visibleTrips.length ? visibleTrips.map(t=><TripCard key={t.id} trip={t} mine={slotForUser(t,user)} claimAllowed={claimAllowed} busy={busy} onOpen={()=>choose(t.id)} onClaim={()=>{clearNotice();setClaimId(t.id);}}/>) : <Empty icon={Truck} title={search ? 'Kiriman tidak ditemukan' : 'Belum ada kiriman'} detail={search ? undefined : 'Jadwal dari Admin akan muncul di sini.'}/>}
              </>}
              {screen === 'tugas' && <>
                <Heading title="Tugas"/>
                {!activeTrip || !activeSlot ? <Empty icon={ClipboardCheck} title="Belum ada tugas" action={{label:'Lihat Kiriman',run:()=>nav('kiriman')}}/> : <>
                  {tripPicker}<ActiveTrip trip={activeTrip} slot={activeSlot}/>
                  <Panel title="Persiapan">
                    {activeSlot === 'driver' ? <>
                      <div className="cv66-km"><div className="cv66-km-label"><IconTile icon={activeTrip.odometerStart ? CheckCircle2 : Truck} tone={activeTrip.odometerStart ? 'green' : 'blue'}/><span className="cv66-row-title">KM Awal</span>{activeTrip.odometerStart && <span className="cv66-km-value">{activeTrip.odometerStart} km</span>}</div>
                        {!activeTrip.odometerStart && <form className="cv66-km-form" onSubmit={saveKm}><input type="number" inputMode="numeric" min="1" max="99999999" step="1" value={kmValue} placeholder="Isi KM" aria-label="KM awal kendaraan" onChange={e=>setKmValue(e.target.value)} required/><Button type="submit" disabled={busy || !Number.isFinite(Number(kmValue)) || Number(kmValue)<=0 || Number(kmValue)>99999999}>Simpan</Button></form>}
                      </div>
                      <TaskRow icon={ShieldCheck} label="Cek Armada" done={Boolean(activeTrip.inspectionDone)} disabled={busy} onClick={()=>openTaskConfirm('inspection')}/>
                    </> : <TaskRow icon={ClipboardCheck} label="Validasi Surat Jalan" done={Boolean(activeTrip.waybillValidated)} disabled={busy} onClick={()=>openTaskConfirm('waybill')}/>}
                  </Panel>
                  <Journey trip={activeTrip} busy={busy} onMove={handleMove}/>
                  <Panel title="Aktivitas">{WORK_FOR_SLOT[activeSlot].map(kind=><TaskRow key={kind} icon={REPORT_ICONS[kind]} label={WORK_LABELS[kind]} disabled={busy} onClick={()=>openReport(kind)}/>)}</Panel>
                </>}
              </>}
              {screen === 'laporan' && <>
                {!reportKind && <Heading title="Laporan"/>}
                {!activeTrip || !activeSlot ? <Empty icon={FileText} title="Belum ada kiriman aktif" action={{label:'Lihat Kiriman',run:()=>nav('kiriman')}}/>
                  : reportKind ? !reportTrip ? <Empty icon={FileText} title="Kiriman tidak lagi aktif" action={{label:'Kembali',run:resetReport}}/> : <Panel><BackButton onClick={()=>{if(!busy){resetReport();clearNotice();}}}/><h2 className="cv66-section-title cv66-report-title">{WORK_LABELS[reportKind]}</h2><p className="cv66-meta">{reportTrip.area} · {reportTrip.fleetLabel}</p>
                    <form className="cv66-form" onSubmit={sendReport}><label className="cv66-field"><span>Keterangan</span><textarea value={reportNote} onChange={e=>setReportNote(e.target.value)} minLength={3} maxLength={1200} required rows={4} placeholder="Tulis keterangan" disabled={busy}/></label>
                      {reportEvidence ? <EvidencePreview evidence={reportEvidence} disabled={busy} onRetake={startCamera}/> : <Button variant="secondary" disabled={busy} onClick={startCamera}><Camera size={20}/>Buka Kamera</Button>}
                      <Button type="submit" disabled={busy || cameraOpen || !reportEvidence || reportNote.trim().length<3} loading={busy}><Check size={18}/>Simpan Laporan</Button>
                    </form></Panel> : <>{tripPicker}<Panel title={activeTrip.area} className="cv66-report-list">{WORK_FOR_SLOT[activeSlot].map(kind=><TaskRow key={kind} icon={REPORT_ICONS[kind]} label={WORK_LABELS[kind]} disabled={busy} onClick={()=>openReport(kind)}/>)}</Panel></>}
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
        <nav className="cv66-tabs" aria-label="Navigasi pekerjaan">{TABS.map(({id,label,icon:Icon})=><button type="button" key={id} disabled={busy} aria-current={screen===id?'page':undefined} className={`cv66-tab ${screen===id?'cv66-tab--active':''}`} onClick={()=>nav(id)}><Icon size={22} strokeWidth={screen===id?2.2:1.8}/><span>{label}</span></button>)}</nav>
      </div>
      {cameraOpen && reportTrip && reportKind && <CrewLiveCamera key={`${reportTrip.id}:${reportKind}`} onClose={()=>setCameraOpen(false)} onCapture={evidence=>{setReportEvidence(evidence);setCameraOpen(false);clearNotice();}}/>}
      <AnimatePresence>
        {claimId && <Dialog key="claim" title="Ambil Kiriman" busy={busy} onClose={()=>{setClaimId(null);clearNotice();}}>{notice}{claimTarget && <div className="cv66-dialog-trip"><span className="cv66-dialog-area">{claimTarget.area}</span><span className="cv66-meta">{claimTarget.fleetLabel} · {claimTarget.departureTime} WIB</span></div>}
          <div className="cv66-choice-grid">{(['driver','helper'] as const).map(slot=>{const occupied=Boolean(claimTarget?.[slot]);return <button type="button" className="cv66-choice" key={slot} disabled={busy || occupied || !claimTarget || claimTarget.phase!=='waiting' || !claimAllowed || Boolean(claimTarget && slotForUser(claimTarget,user))} onClick={()=>submitClaim(slot)}><IconTile icon={slot==='driver'?Truck:Users}/><span className="cv66-choice-title">{roleName(slot)}</span>{occupied && <span className="cv66-meta">Sudah terisi</span>}</button>})}</div>
          {!claimAllowed && <p className="cv66-required">Pengambilan kiriman belum aktif.</p>}</Dialog>}
        {taskConfirm && <Dialog key="check" title={taskConfirm.kind==='inspection'?'Cek Armada':'Cek Surat Jalan'} busy={busy} onClose={()=>{setTaskConfirm(null);clearNotice();}}>{notice}<div className="cv66-checklist">{(taskConfirm.kind==='inspection'?['Ban, rem, dan lampu aman','Kendaraan dan perlengkapan siap']:['Tujuan dan jumlah surat jalan sesuai','Dokumen lengkap dan siap dibawa']).map((label,i)=><label key={label}><input type="checkbox" checked={taskChecks[i]} disabled={busy} onChange={e=>{const checked=e.target.checked;setTaskChecks(v=>i===0?[checked,v[1]]:[v[0],checked]);}}/><span>{label}</span></label>)}</div><Button disabled={busy || !taskChecks.every(Boolean)} loading={busy} onClick={saveCheck}><Check size={18}/>Simpan</Button>{!qa && <p className="cv66-meta cv66-gps">Waktu dan GPS dicatat.</p>}</Dialog>}
        {accountOpen && <Dialog key="account" title="Akun" onClose={()=>{setAccountOpen(false);clearNotice();}}><div className="cv66-profile"><span className="cv66-profile-avatar">{initials(user.fullName)}</span><div><span className="cv66-profile-name">{user.fullName||'Kru AKK'}</span><span className="cv66-meta">{user.email}</span></div></div>{!qa && onOpenClassic && <Button variant="secondary" onClick={()=>{setAccountOpen(false);onOpenClassic();}}>Fitur Operasional Lengkap<ArrowUpRight size={18}/></Button>}<Button variant="danger" onClick={()=>logisticsStore.logoutUser()}><LogOut size={18}/>Keluar Akun</Button></Dialog>}
      </AnimatePresence>
    </div>, document.body
  );
};
export default CrewFieldApp;
