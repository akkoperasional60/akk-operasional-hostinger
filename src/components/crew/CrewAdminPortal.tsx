import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { CheckCircle2, ChevronDown, ClipboardCheck, CloudOff, FileClock, FileText, LoaderCircle, MapPin, RefreshCw, RotateCcw, Search, ShieldCheck, Truck, X } from 'lucide-react';
import type { UserProfile } from '../../types';
import { WORK_FOR_SLOT, WORK_LABELS, type CrewSlot, type FieldTrip } from './crewModel';
import { getTripsForUser, listenCrewChanged, resetTripAssignment } from './crewApi';
import { ActiveTrip, ActionGrid, Button, Empty, Heading, IconTile, Journey, Panel, shortDate, Status, TABS, TAB_ART, TaskRow, TripCard, type Screen } from './CrewFieldUI';
import { CrewArt } from './CrewIllustrations';
import './crewFieldV66.css';

type Snapshot = { userId: string; trips: FieldTrip[] };
const NO_WRITE = () => {};
const branchName = (id: string) => id === 'cab-sidoarjo' ? 'Sidoarjo' : id === 'cab-banyuwangi' ? 'Nusantara' : id;
const stamp = (value?: string) => {
  const date = value ? new Date(value) : null;
  return date && !Number.isNaN(date.getTime()) ? date.toLocaleString('id-ID', {dateStyle:'short', timeStyle:'short'}) : '-';
};

/** Read-only workspace portal with Super Admin-only reset control. */
export default function CrewAdminPortal({currentUser: user}: {currentUser: UserProfile}) {
  const reduced = useReducedMotion();
  const isSuperAdmin = user.role === 'super_admin' && user.status === 'approved';
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [screen, setScreen] = useState<Screen>('kiriman');
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState('');
  const [slot, setSlot] = useState<CrewSlot>('driver');
  const [branch, setBranch] = useState('');
  const [confirmResetId, setConfirmResetId] = useState<string | null>(null);
  const [resetBusy, setResetBusy] = useState(false);
  const refreshRef = useRef<() => void>(NO_WRITE);
  const mainRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    let stopped = false;
    let inFlight = false;
    const load = async () => {
      if (stopped || inFlight) return;
      inFlight = true; setLoading(true);
      try {
        const trips = await getTripsForUser(user);
        if (!stopped) { setSnapshot({userId:user.id,trips}); setError(''); }
      } catch (e) {
        if (!stopped) setError((e as Error)?.message || 'Jadwal tidak dapat dimuat.');
      } finally {
        inFlight = false;
        if (!stopped) setLoading(false);
      }
    };
    setSnapshot(null); setError('');
    refreshRef.current = () => void load();
    const detach = listenCrewChanged(refreshRef.current);
    const timer = window.setInterval(() => void load(), 15000);
    const onVisible = () => { if (document.visibilityState === 'visible') void load(); };
    document.addEventListener('visibilitychange', onVisible);
    void load();
    return () => { stopped = true; detach(); clearInterval(timer); document.removeEventListener('visibilitychange',onVisible); refreshRef.current = NO_WRITE; };
  }, [user.id, user.role, user.email]);

  useEffect(() => {
    if (!notice) return;
    const t = window.setTimeout(() => setNotice(''), 2500);
    return () => clearTimeout(t);
  }, [notice]);

  const current = snapshot?.userId === user.id ? snapshot : null;
  const trips = useMemo(() => current?.trips || [], [current]);
  const branches = useMemo(() => Array.from(new Set(trips.map(t => t.branchId))).sort(), [trips]);
  const filtered = useMemo(() => trips.filter(t => !branch || t.branchId === branch), [trips,branch]);
  const ongoing = filtered.filter(t => t.phase !== 'returned');
  const completed = filtered.filter(t => t.phase === 'returned');
  const selected = filtered.find(t => t.id === selectedId) || ongoing[0] || completed[0] || null;
  const visible = ongoing.filter(t => {
    const q = search.trim().toLocaleLowerCase('id-ID');
    return !q || [t.area,t.fleetLabel,t.trackingNumber,t.driver?.name,t.helper?.name].some(v=>String(v||'').toLocaleLowerCase('id-ID').includes(q));
  });
  const reports = filtered.flatMap(t => t.reports.map(report => ({trip:t,report}))).sort((a,b) => String(b.report.at).localeCompare(String(a.report.at)));
  const visibleReports = selectedId ? reports.filter(r => r.trip.id === selectedId) : reports;
  const pick = (id: string) => { setSelectedId(id); setConfirmResetId(null); setScreen('tugas'); };
  const nav = (next: Screen) => { setScreen(next); setConfirmResetId(null); if(next==='laporan') setSelectedId(''); };
  useEffect(() => { mainRef.current?.scrollTo({top:0,behavior:'instant'}); setConfirmResetId(null); }, [screen,selectedId]);

  const handleResetTrip = async (tripId: string) => {
    if (!isSuperAdmin || resetBusy) return;
    setResetBusy(true); setError(''); setNotice('');
    try {
      await resetTripAssignment(user, tripId);
      setConfirmResetId(null);
      setNotice('Kiriman berhasil direset seperti semula.');
      refreshRef.current();
    } catch (e) {
      setError((e as Error)?.message || 'Gagal mereset kiriman.');
    } finally {
      setResetBusy(false);
    }
  };

  const canResetSelected = Boolean(
    isSuperAdmin && selected && (selected.driver || selected.helper || selected.phase !== 'waiting' || selected.odometerStart || selected.inspectionDone || selected.waybillValidated)
  );
  const tripPicker = (all = false) => <label className="cv66-picker cv70-wide"><span>Kiriman</span><select aria-label="Pilih kiriman" value={all ? selectedId : selected?.id || ''} onChange={e=>setSelectedId(e.target.value)}>{all && <option value="">Semua kiriman</option>}{filtered.map(t=><option key={t.id} value={t.id}>{t.area} · {shortDate(t.date)} · {t.fleetLabel}</option>)}</select><ChevronDown size={17}/></label>;

  return <section id="akk-crew-v66" className="cv66-root cv70-monitor" data-testid="akk-crew-admin-monitor" data-version="70">
    <div className="cv66-shell">
      <header className="cv66-header">
        <div className="cv66-brand"><span className="cv66-brand-icon"><CrewArt name="truck" size={37}/></span><div className="cv66-brand-text"><span className="cv66-brand-title">Portal Driver</span><span className="cv66-brand-sub">Pemantauan Admin</span></div></div>
        <div className="cv66-header-actions"><button type="button" aria-label="Muat ulang jadwal" className="cv66-icon-button" disabled={loading} onClick={()=>refreshRef.current()}><RefreshCw size={20} className={loading?'cv66-spin':''}/></button></div>
      </header>
      <main ref={mainRef} className="cv66-main" aria-busy={loading}>
        {branches.length>1 && <div className="cv70-filters">
          <label className="cv66-picker cv70-branch"><span>Cabang</span><select aria-label="Pilih cabang" value={branch} onChange={e=>{setBranch(e.target.value);setSelectedId('');}}><option value="">Semua cabang</option>{branches.map(id=><option key={id} value={id}>{branchName(id)}</option>)}</select><ChevronDown size={17}/></label>
        </div>}
        {error && <div className="cv66-notice cv66-notice--error" role="alert"><CloudOff size={18}/><span>{error}</span><button aria-label="Tutup pesan" type="button" onClick={()=>setError('')}><X size={17}/></button></div>}
        {notice && <div className="cv66-notice cv66-notice--success" role="status"><CheckCircle2 size={18}/><span>{notice}</span><button aria-label="Tutup pesan" type="button" onClick={()=>setNotice('')}><X size={17}/></button></div>}
        {!current ? loading ? <div className="cv66-loading" role="status"><LoaderCircle size={24} className="cv66-spin"/>Memuat kiriman...</div> : <Empty icon={CloudOff} title="Jadwal gagal dimuat" action={{label:'Muat Ulang',run:()=>refreshRef.current()}}/> :
        <AnimatePresence mode="wait" initial={false}>
          <motion.div className={`cv66-screen cv70-screen cv70-screen--${screen}`} key={screen} initial={reduced?false:{opacity:0,y:6}} animate={{opacity:1,y:0}} exit={reduced?{opacity:1}:{opacity:0,y:-3}} transition={{duration:reduced?0:.18}}>
            {screen==='kiriman' && <>
              <Heading title="Kiriman"/>
              {(ongoing.length>0||search) && <label className="cv66-search cv70-wide"><Search size={20}/><input aria-label="Cari kiriman" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Cari area, armada atau kru"/>{search && <button type="button" aria-label="Hapus pencarian" onClick={()=>setSearch('')}><X size={18}/></button>}</label>}
              {visible.length?visible.map(t=><TripCard key={t.id} trip={t} mine={null} claimAllowed={false} busy={false} readOnly onOpen={()=>pick(t.id)} onClaim={NO_WRITE}/>):<Empty icon={Truck} title={search?'Kiriman tidak ditemukan':'Belum ada kiriman'}/>}
            </>}
            {screen==='tugas' && <>
              <Heading title="Tugas"/>
              {!selected ? <Empty icon={ClipboardCheck} title="Belum ada kiriman" action={{label:'Lihat Kiriman',run:()=>nav('kiriman')}}/> : <>
                {filtered.length>1 && tripPicker()}
                <div className="cv70-toggle cv70-wide" aria-label="Lihat posisi kru">{(['driver','helper'] as const).map(role=><button type="button" key={role} aria-pressed={slot===role} className={slot===role?'cv70-selected':''} onClick={()=>setSlot(role)}>{role==='driver'?'Driver':'Helper'}</button>)}</div>
                <ActiveTrip trip={selected} slot={slot}/>
                <Panel title="Persiapan">
                  {slot==='driver'?<><div className="cv66-km"><div className="cv66-km-label"><IconTile icon={Truck} art={selected.odometerStart?'success':'gauge'} tone={selected.odometerStart?'green':'blue'}/><span className="cv66-row-title">KM Awal</span><span className={selected.odometerStart?'cv66-km-value':'cv66-meta'}>{selected.odometerStart?`${selected.odometerStart} km`:'Belum diisi'}</span></div></div><TaskRow icon={ShieldCheck} label="Cek Armada" detail={selected.inspectionDone?undefined:'Belum diperiksa'} done={Boolean(selected.inspectionDone)} disabled onClick={NO_WRITE}/></>:<TaskRow icon={ClipboardCheck} label="Validasi Surat Jalan" detail={selected.waybillValidated?undefined:'Belum divalidasi'} done={Boolean(selected.waybillValidated)} disabled onClick={NO_WRITE}/>}
                </Panel>
                <Journey trip={selected} busy={false} readOnly onMove={NO_WRITE}/>
                <Panel title="Aktivitas" className="cv69-action-panel cv70-wide"><ActionGrid actions={WORK_FOR_SLOT[slot]} busy onAction={NO_WRITE}/></Panel>
                <div className="cv70-wide"><Button variant="secondary" onClick={()=>{setSelectedId(selected.id);setScreen('laporan');}}>Lihat Laporan Kiriman</Button></div>
                {canResetSelected && (
                  <Panel title="Reset Kiriman (Super Admin)" className="cv70-wide">
                    <p className="cv66-meta">Mengembalikan kiriman ke kondisi awal: slot Driver/Helper dikosongkan dan status kembali ke Belum berangkat.</p>
                    {confirmResetId === selected.id ? (
                      <div className="flex flex-wrap gap-2">
                        <Button variant="danger" loading={resetBusy} disabled={resetBusy} onClick={() => void handleResetTrip(selected.id)}>
                          <RotateCcw size={16}/>Ya, Reset Kiriman
                        </Button>
                        <Button variant="secondary" disabled={resetBusy} onClick={() => setConfirmResetId(null)}>Batal</Button>
                      </div>
                    ) : (
                      <Button variant="danger" disabled={resetBusy} onClick={() => setConfirmResetId(selected.id)}>
                        <RotateCcw size={16}/>Reset Kiriman Seperti Semula
                      </Button>
                    )}
                  </Panel>
                )}
              </>}
            </>}
            {screen==='laporan' && <>
              <Heading title="Laporan"/>
              {filtered.length>0 && tripPicker(true)}
              {visibleReports.length?visibleReports.map(({trip,report})=><article key={`${trip.id}:${report.id}`} className="cv66-panel cv70-report"><div className="cv70-report-top"><IconTile icon={FileText}/><div className="cv66-row-text"><h2 className="cv66-section-title">{WORK_LABELS[report.type]||report.type}</h2><span className="cv66-meta">{trip.area} · {report.by||'-'}</span></div><span className="cv66-meta">{stamp(report.at)}</span></div><p className="cv70-report-note">{report.note}</p>{report.gps && <span className="cv66-meta cv66-inline"><MapPin size={14}/>GPS tercatat · ±{Math.round(report.gps.accuracy)} m</span>}</article>):<Empty icon={FileText} title="Belum ada laporan"/>}
            </>}
            {screen==='riwayat' && <>
              <Heading title="Riwayat"/>
              {completed.length?completed.map(t=><article className="cv66-panel cv66-history" key={t.id}><div className="cv66-row"><IconTile icon={CheckCircle2} tone="green"/><span className="cv66-row-text"><span className="cv66-history-title">{t.area}</span><span className="cv66-meta">{shortDate(t.date)} · {t.fleetLabel}</span></span><Status trip={t}/></div><dl className="cv66-history-detail"><div><dt>Berangkat</dt><dd>{stamp(t.departedAt)}</dd></div><div><dt>Tiba di Gudang</dt><dd>{stamp(t.returnedAt)}</dd></div><div><dt>Laporan</dt><dd>{t.reports.length}</dd></div></dl><Button variant="secondary" onClick={()=>pick(t.id)}>Lihat Detail</Button></article>):<Empty icon={FileClock} title="Belum ada riwayat"/>}
            </>}
          </motion.div>
        </AnimatePresence>}
      </main>
      <nav className="cv66-tabs" aria-label="Navigasi Portal Driver">{TABS.map(({id,label})=><motion.button type="button" key={id} aria-current={screen===id?'page':undefined} className={`cv66-tab ${screen===id?'cv66-tab--active':''}`} onClick={()=>nav(id)} whileTap={reduced?undefined:{scale:.95}}>{screen===id && <motion.span className="cv69-tab-indicator" layoutId="cv70-monitor-tab" transition={reduced?{duration:0}:{type:'spring',stiffness:440,damping:36}}/>}<CrewArt name={TAB_ART[id]} size={30} active={screen===id}/><span className="cv69-tab-label">{label}</span></motion.button>)}</nav>
    </div>
  </section>;
}
