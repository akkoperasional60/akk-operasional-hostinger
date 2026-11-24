import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'motion/react';
import {
  ArrowLeft, ArrowRight, ArrowUpRight, CalendarDays, Camera, Check, CheckCheck,
  CheckCircle2, ChevronDown, ChevronRight, ClipboardCheck, Clock3, CloudOff,
  FileClock, FileText, Fuel, History, LoaderCircle, LogOut, MapPin,
  MoreHorizontal, Navigation, PackageCheck, PackageX, Plus, RefreshCw,
  Search, ShieldCheck, Sparkles, Truck, UploadCloud, UserRound, Users, X
} from 'lucide-react';
import type { UserProfile } from '../../types';
import { logisticsStore } from '../../services/store';
import {
  WORK_FOR_SLOT, WORK_LABELS, QA_EVENT, isQaAccount, isCompleted,
  safeDate, slotForUser, tripPhaseLabel,
  type CrewSlot, type FieldTrip, type WorkAction
} from './crewModel';
import {
  canClaimLive, claimTrip, getTripsForUser, listenCrewChanged, markTask, moveTrip,
  recordKm, submitWorkReport
} from './crewApi';

interface CrewFieldAppProps {
  currentUser: UserProfile;
  onOpenClassic?: () => void;
}

type Screen = 'kiriman' | 'tugas' | 'laporan' | 'riwayat';
const TABS = [
  { id: 'kiriman', label: 'Kiriman', icon: Truck },
  { id: 'tugas', label: 'Tugas', icon: ClipboardCheck },
  { id: 'laporan', label: 'Laporan', icon: FileText },
  { id: 'riwayat', label: 'Riwayat', icon: History }
] as const;
const REPORT_ICONS: Record<WorkAction, typeof Fuel> = {
  bbm: Fuel, kendala: Navigation, toko: MapPin, retur: PackageX, form_kirim: FileText
};
const bg = 'bg-white dark:bg-slate-900';
const border = 'border border-slate-200/90 dark:border-slate-800';
const tap = 'active:scale-[.985] transition-transform duration-150';

function showShortDate(date: string): string {
  if (!date) return '-';
  const result = new Date(`${date}T12:00:00`);
  if (Number.isNaN(result.getTime())) return safeDate(date);
  return result.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
}
function currentDate(): string {
  return new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long' });
}
function sentenceStatus(t: FieldTrip): string {
  return t.phase === 'returned' ? 'Selesai' : t.phase === 'going' ? 'Dalam perjalanan' : 'Belum berangkat';
}
function firstName(name: string): string { return (name || 'Kru').trim().split(/\s+/)[0] || 'Kru'; }
function initials(name: string) {
  return String(name || 'A').trim().split(/\s+/).slice(0, 2).map(s => s[0]?.toUpperCase()).join('') || 'A';
}
function StatusPill({ trip }: { trip: FieldTrip }) {
  const color = trip.phase === 'returned' ? 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
    : trip.phase === 'going' ? 'bg-sky-50 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300'
    : 'bg-amber-50 text-amber-700 dark:bg-amber-900/25 dark:text-amber-300';
  return <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[12px] font-bold ${color}`}>
    <span className={`h-1.5 w-1.5 rounded-full ${trip.phase === 'going' ? 'bg-sky-500' : trip.phase === 'returned' ? 'bg-slate-400' : 'bg-amber-500'}`} />
    {sentenceStatus(trip)}
  </span>;
}
function CardPerson({ label, name, occupied }: { label: string; name: string; occupied: boolean }) {
  return <div className="min-w-0 flex-1 rounded-2xl bg-[#f5f7fb] dark:bg-slate-800/60 px-3 py-3">
    <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">{label}</span>
    <div className="mt-1.5 flex min-w-0 items-center gap-2">
      <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${occupied ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300' : 'border border-dashed border-slate-300 text-slate-400 dark:border-slate-600'}`}>
        {occupied ? initials(name) : <Plus size={13} />}
      </span>
      <span className={`min-w-0 truncate text-[13px] font-semibold ${occupied ? 'text-slate-800 dark:text-slate-100' : 'text-slate-400 dark:text-slate-500'}`}>{occupied ? name : 'Kosong'}</span>
    </div>
  </div>;
}
function MainButton({ children, onClick, disabled, secondary = false, loading = false }:
  { children: React.ReactNode; onClick?: () => void; disabled?: boolean; secondary?: boolean; loading?: boolean }) {
  return <button type="button" onClick={onClick} disabled={disabled || loading} className={`w-full min-h-12 rounded-2xl px-4 text-[14px] font-bold tracking-tight flex items-center justify-center gap-2 transition-all ${tap} disabled:cursor-not-allowed disabled:opacity-45 ${secondary
    ? 'bg-slate-100 text-slate-800 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-100'
    : 'bg-[#2358ed] text-white shadow-[0_9px_22px_rgba(37,92,232,0.19)] hover:bg-[#174ad8]'}`}>
    {loading && <LoaderCircle size={17} className="animate-spin"/>}{children}
  </button>;
}
function EmptyState({ icon: Icon, title, text, action }:
  { icon: typeof Truck; title: string; text: string; action?: { label: string; onClick: () => void } }) {
  return <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className={`relative overflow-hidden rounded-[26px] ${bg} ${border} px-6 py-9 text-center shadow-[0_12px_40px_rgba(22,34,56,0.03)]`}>
    <div className="pointer-events-none absolute -right-20 -top-20 h-48 w-48 rounded-full bg-blue-50/70 dark:bg-blue-900/10"/>
    <div className="relative mx-auto flex h-[86px] w-[86px] items-center justify-center rounded-[28px] bg-[#edf3ff] dark:bg-blue-900/20">
      <span className="absolute -right-1 top-0 h-6 w-6 rounded-xl border-4 border-white bg-[#bbf7d0] dark:border-slate-900"/>
      <Icon size={34} strokeWidth={1.55} className="text-[#3470e9]" />
    </div>
    <h3 className="relative mt-5 text-[16px] font-extrabold tracking-[-0.02em] text-slate-900 dark:text-white">{title}</h3>
    <p className="relative mx-auto mt-2 max-w-[250px] text-[13px] leading-[1.75] text-slate-500 dark:text-slate-400">{text}</p>
    {action && <button type="button" onClick={action.onClick} className="relative mt-5 inline-flex h-10 items-center gap-2 rounded-xl bg-blue-50 px-4 text-[13px] font-bold text-blue-700 hover:bg-blue-100 dark:bg-blue-900/30 dark:text-blue-300">{action.label} <ArrowRight size={14}/></button>}
  </motion.div>;
}
function TripCard({ t, mine, onOpen, onClaim, busy }: { t: FieldTrip; mine: CrewSlot | null; onOpen: () => void; onClaim: () => void; busy: boolean }) {
  const canClaim = t.phase === 'waiting' && (!t.driver || !t.helper) && !mine;
  return <motion.article layout initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .24 }} className={`relative overflow-hidden rounded-[25px] ${bg} ${border} p-4 shadow-[0_6px_24px_rgba(22,34,56,0.04)]`}>
    <div className="flex items-center justify-between gap-2">
      <StatusPill trip={t}/>
      <span className="flex items-center gap-1.5 text-[12px] font-semibold text-slate-400"><CalendarDays size={14}/> {showShortDate(t.date)}</span>
    </div>
    <h3 className="mt-4 text-[19px] font-extrabold leading-tight tracking-[-0.035em] text-slate-950 dark:text-white">{t.area}</h3>
    <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] font-medium text-slate-500 dark:text-slate-400">
      <span className="inline-flex items-center gap-1.5"><Truck size={14}/> {t.fleetLabel}</span>
      <span className="inline-flex items-center gap-1.5"><Clock3 size={14}/> {t.departureTime} WIB</span>
    </div>
    <div className="mt-4 flex gap-2"><CardPerson label="Driver" name={t.driver?.name || ''} occupied={!!t.driver}/><CardPerson label="Helper" name={t.helper?.name || ''} occupied={!!t.helper}/></div>
    <div className="mt-4">
      {mine ? <MainButton onClick={onOpen} secondary><ClipboardCheck size={17}/> Buka Tugas <ChevronRight size={17}/></MainButton>
      : canClaim ? <MainButton onClick={onClaim} disabled={busy}><Plus size={18}/> Ambil Kiriman <ArrowUpRight size={17}/></MainButton>
      : <div className="flex items-center justify-center gap-2 rounded-xl bg-slate-50 p-3 text-[12px] font-semibold text-slate-500 dark:bg-slate-800/60 dark:text-slate-300"><CheckCircle2 size={16}/> {t.phase !== 'waiting' ? 'Tidak tersedia untuk diambil' : 'Tim sudah lengkap'}</div>}
    </div>
  </motion.article>;
}
function SectionHeading({ kicker, title, note, right }: { kicker?: string; title: string; note?: string; right?: React.ReactNode }) {
  return <div className="flex items-end justify-between gap-3">
    <div className="min-w-0">
      {kicker && <span className="mb-1 block text-[11px] font-bold uppercase tracking-[.16em] text-[#4476dd] dark:text-blue-300">{kicker}</span>}
      <h2 className="text-[22px] font-black leading-[1.12] tracking-[-.045em] text-slate-950 dark:text-white">{title}</h2>
      {note && <p className="mt-1.5 text-[13px] text-slate-500 dark:text-slate-400">{note}</p>}
    </div>
    {right}
  </div>;
}
function ActivityLine({ name, detail, done }: { name: string; detail?: string; done: boolean }) {
  return <div className="flex items-center gap-3 py-3">
    <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${done ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20' : 'bg-slate-100 text-slate-400 dark:bg-slate-800'}`}>
      {done ? <Check size={18}/> : <Clock3 size={17}/>}</span>
    <div className="min-w-0 flex-1"><strong className="block text-[13px] font-bold text-slate-800 dark:text-slate-100">{name}</strong>{detail && <span className="mt-0.5 block truncate text-[12px] text-slate-500">{detail}</span>}</div>
    <span className={`text-[11px] font-bold ${done ? 'text-emerald-600' : 'text-slate-400'}`}>{done ? 'Selesai' : 'Belum'}</span>
  </div>;
}

export const CrewFieldApp: React.FC<CrewFieldAppProps> = ({ currentUser: user, onOpenClassic }) => {
  const qa = isQaAccount(user);
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
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [fault, setFault] = useState('');
  const [message, setMessage] = useState('');
  const [claimId, setClaimId] = useState<string | null>(null);
  const [accountOpen, setAccountOpen] = useState(false);
  const [taskConfirm, setTaskConfirm] = useState<'inspection' | 'waybill' | null>(null);
  const [taskChecks, setTaskChecks] = useState<[boolean,boolean]>([false,false]);
  const [reportKind, setReportKind] = useState<WorkAction | null>(null);
  const [reportNote, setReportNote] = useState('');
  const [reportPhoto, setReportPhoto] = useState<string | undefined>();
  const [kmValue, setKmValue] = useState('');
  const [expandedHistory, setExpandedHistory] = useState<string | null>(null);
  const alive = useRef(true);
  const refreshInFlight = useRef(false);
  const reportFile = useRef<HTMLInputElement | null>(null);

  const refresh = useCallback(async (quiet = false) => {
    if (refreshInFlight.current) return;
    refreshInFlight.current = true;
    if (!quiet) setRefreshing(true);
    try {
      const next = await getTripsForUser(user);
      if (alive.current) { setTrips(next); setFault(''); }
    } catch (e) {
      if (alive.current) setFault((e as Error)?.message || 'Koneksi ke jadwal belum tersedia.');
    } finally {
      if (alive.current) { setLoading(false); setRefreshing(false); }
      refreshInFlight.current = false;
    }
  }, [user.id, user.email]);

  useEffect(() => {
    alive.current = true;
    void refresh();
    const detach = listenCrewChanged(() => void refresh(true));
    const onVisibility = () => { if (document.visibilityState === 'visible') void refresh(true); };
    document.addEventListener('visibilitychange', onVisibility);
    const interval = window.setInterval(() => void refresh(true), qa ? 5000 : 12000);
    return () => { alive.current = false; detach(); document.removeEventListener('visibilitychange', onVisibility); clearInterval(interval); };
  }, [refresh, qa]);

  const mine = useMemo(() => trips.filter(t => Boolean(slotForUser(t, user))), [trips, user.id, user.fullName]);
  const ongoing = useMemo(() => mine.filter(t => !isCompleted(t)), [mine]);
  const completed = useMemo(() => mine.filter(isCompleted), [mine]);
  const available = useMemo(() => trips.filter(t => !isCompleted(t) && (!t.driver || !t.helper) && t.phase === 'waiting'), [trips]);
  const visibleTrips = useMemo(() => trips.filter(t => {
    if (t.phase === 'returned') return false;
    const query = search.trim().toLocaleLowerCase('id-ID');
    return !query || [t.area, t.fleetLabel, t.trackingNumber, t.driver?.name, t.helper?.name].some(v => String(v || '').toLocaleLowerCase('id-ID').includes(query));
  }), [trips, search]);
  const activeTrip = useMemo(() => ongoing.find(t => t.id === selectedId) || ongoing[0] || null, [mine, selectedId, ongoing]);
  const activeSlot = activeTrip ? slotForUser(activeTrip, user) : null;
  const first = firstName(user.fullName || 'Kru');
  const branchText = useMemo(() => {
    const branches = Array.from(new Set(trips.map(t => t.branchId)));
    if (branches.length === 1) return branches[0] === 'cab-sidoarjo' ? 'Sidoarjo' : branches[0] === 'cab-banyuwangi' ? 'Nusantara' : 'Cabang AKK';
    return 'Cabang AKK';
  }, [trips]);
  const notice = (text: string) => { setMessage(text); setFault(''); };
  const fail = (e: unknown) => { setFault((e as Error)?.message || 'Terjadi kendala. Coba ulangi.'); setMessage(''); };
  const choose = (tripId: string, destination: Screen = 'tugas') => { setSelectedId(tripId); setScreen(destination); setMessage(''); setFault(''); setReportKind(null); };
  const nav = (destination: Screen) => { setScreen(destination); setReportKind(null); setMessage(''); setFault(''); };
  const invoke = async (fn: () => Promise<void>, success: string, after?: () => void) => {
    if (busy) return;
    setBusy(true); setFault(''); setMessage('');
    try { await fn(); await refresh(true); notice(success); after?.(); }
    catch (e) { fail(e); }
    finally { setBusy(false); }
  };
  const submitClaim = (slot: CrewSlot) => {
    if (!claimId) return;
    const tripId = claimId;
    void invoke(() => claimTrip(user, tripId, slot), `Posisi ${slot === 'driver' ? 'Driver' : 'Helper'} berhasil diambil.`, () => {
      setClaimId(null); choose(tripId);
    });
  };
  const perform = (fn: () => Promise<void>, ok: string) => void invoke(fn, ok);
  const openTaskConfirm = (task: 'inspection' | 'waybill') => {
    if (!activeTrip || (task === 'inspection' ? activeTrip.inspectionDone : activeTrip.waybillValidated)) return;
    setTaskChecks([false,false]);
    setTaskConfirm(task);
  };
  const openReport = (kind: WorkAction) => {
    if (kind === 'form_kirim' && !qa && onOpenClassic) { onOpenClassic(); return; }
    setReportKind(kind); setReportNote(''); setReportPhoto(undefined); setScreen('laporan'); setFault('');
  };
  const onFile = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) return setFault('File harus berupa foto.');
    if (file.size > 2 * 1024 * 1024) return setFault('Foto maksimal 2 MB.');
    const reader = new FileReader();
    reader.onload = () => setReportPhoto(String(reader.result || ''));
    reader.onerror = () => setFault('Foto gagal dibaca.');
    reader.readAsDataURL(file);
  };
  const sendReport = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeTrip || !reportKind) return;
    const kind = reportKind;
    void invoke(() => submitWorkReport(user, activeTrip.id, kind, reportNote, reportPhoto), 'Laporan berhasil disimpan.', () => {
      setReportKind(null); setReportNote(''); setReportPhoto(undefined);
    });
  };

  if (typeof document === 'undefined') return null;
  return createPortal(
    <div className="fixed inset-0 z-[22000] bg-[#eef2f8] text-slate-900 dark:bg-[#090f1c] dark:text-slate-100 antialiased" data-testid="akk-crew-field-v65">
      <div className="mx-auto flex h-[100dvh] w-full max-w-[510px] flex-col overflow-hidden bg-[#f7f9fd] shadow-[0_0_80px_rgba(12,26,53,.11)] dark:bg-[#0f1726]">
        {/* One small consistent header for Driver and Helper. Never show the login role. */}
        <header className="relative z-20 flex h-[69px] shrink-0 items-center justify-between border-b border-slate-200/70 bg-white/95 px-5 backdrop-blur-xl dark:border-slate-800 dark:bg-[#111a2c]/95">
          <div className="flex items-center gap-3">
            <div className="flex h-[39px] w-[39px] items-center justify-center rounded-[14px] bg-[#ebf1ff] text-[#2358ed] dark:bg-blue-900/25 dark:text-blue-300"><Truck size={21} strokeWidth={2}/></div>
            <div><div className="text-[15px] font-extrabold tracking-[-.045em] text-slate-950 dark:text-white">AKK <span className="font-medium text-slate-500 dark:text-slate-400">/ Pengiriman</span></div>
              <span className="mt-0.5 block text-[11px] font-semibold text-slate-400 dark:text-slate-500">{qa ? 'SIMULASI' : branchText}</span></div>
          </div>
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => void refresh()} disabled={refreshing} aria-label="Perbarui jadwal" className="flex h-10 w-10 items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100 active:scale-95 dark:hover:bg-slate-800">
              <RefreshCw size={17} className={refreshing ? 'animate-spin' : ''}/>
            </button>
            <button type="button" onClick={() => setAccountOpen(true)} aria-label="Profil akun" className="relative flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-100 text-xs font-black text-slate-700 active:scale-95 dark:bg-slate-800 dark:text-slate-100">{initials(user.fullName)}<span className="absolute -right-0.5 -bottom-0.5 h-3 w-3 rounded-full border-[3px] border-white bg-emerald-400 dark:border-slate-900"/></button>
          </div>
        </header>

        <main className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-contain px-4 pb-8 pt-5 sm:px-5" id="akk-crew-main-content">
          {/* Real errors and actions are clear without noisy online/GPS badges. */}
          <AnimatePresence mode="popLayout">
            {fault && <motion.div key="error" initial={{opacity:0, y:-8}} animate={{opacity:1, y:0}} exit={{opacity:0}} role="alert" className="mb-4 flex items-start gap-3 rounded-2xl border border-rose-200 bg-rose-50 px-3.5 py-3 text-[13px] font-medium leading-relaxed text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/30 dark:text-rose-200"><CloudOff size={17} className="mt-0.5 shrink-0"/><div className="flex-1">{fault}</div><button aria-label="Tutup pesan" onClick={()=>setFault('')}><X size={16}/></button></motion.div>}
            {message && <motion.div key="success" initial={{opacity:0,y:-8}} animate={{opacity:1,y:0}} exit={{opacity:0}} role="status" className="mb-4 flex items-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-3.5 py-3 text-[13px] font-semibold text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-200"><CheckCircle2 size={17}/><div className="flex-1">{message}</div><button aria-label="Tutup pesan" onClick={()=>setMessage('')}><X size={16}/></button></motion.div>}
          </AnimatePresence>
          {loading ? <div className="space-y-4"><div className="h-[175px] animate-pulse rounded-[27px] bg-slate-200 dark:bg-slate-800"/><div className="h-6 w-44 animate-pulse rounded-full bg-slate-200 dark:bg-slate-800"/><div className="h-[210px] animate-pulse rounded-[24px] bg-slate-200 dark:bg-slate-800"/></div> :
          <AnimatePresence mode="wait" initial={false}>
            {screen === 'kiriman' && <motion.section key="kiriman" initial={{opacity:0,x:12}} animate={{opacity:1,x:0}} exit={{opacity:0,x:-12}} transition={{duration:.18}} className="space-y-5">
              <div className="relative overflow-hidden rounded-[27px] bg-[#14294a] px-5 py-[22px] text-white shadow-[0_15px_36px_rgba(20,41,74,0.18)]">
                <div className="pointer-events-none absolute -right-[50px] -top-[65px] h-[220px] w-[220px] rounded-full border-[38px] border-white/[.045]"/>
                <div className="pointer-events-none absolute -right-[50px] bottom-[-60px] h-[155px] w-[155px] rounded-full bg-[#326fff]/15 blur-[35px]"/>
                <div className="relative flex items-start justify-between"><div>
                  <span className="text-[11px] font-semibold capitalize tracking-[.07em] text-blue-200/85">{currentDate()}</span>
                  <h1 className="mt-3 max-w-[240px] text-[25px] font-black leading-[1.06] tracking-[-.05em]">Halo, {first}<span className="ml-1 text-[#9bd2ff]">.</span></h1>
                  <p className="mt-2 text-[13px] leading-relaxed text-blue-100/75">{ongoing.length ? 'Ada kiriman yang perlu diselesaikan.' : 'Siap untuk pengiriman hari ini?'}</p>
                </div><div className="flex h-[48px] w-[48px] items-center justify-center rounded-2xl border border-white/10 bg-white/10"><PackageCheck size={24} className="text-[#a9dcff]"/></div></div>
                <div className="relative mt-5 grid grid-cols-2 gap-2">
                  <div className="rounded-2xl border border-white/10 bg-white/[.075] px-3.5 py-3"><strong className="block text-[24px] font-black leading-none">{available.length}</strong><span className="mt-1.5 block text-[11px] font-medium text-blue-100/75">Slot tersedia</span></div>
                  <div className="rounded-2xl border border-white/10 bg-white/[.075] px-3.5 py-3"><strong className="block text-[24px] font-black leading-none">{ongoing.length}</strong><span className="mt-1.5 block text-[11px] font-medium text-blue-100/75">Tugas saya</span></div>
                </div>
              </div>
              {ongoing.length > 0 && <button onClick={() => nav('tugas')} className={`flex w-full items-center gap-3 rounded-[19px] border border-[#cfe0ff] bg-[#eaf1ff] p-3.5 text-left ${tap} dark:border-blue-900/40 dark:bg-blue-900/20`}>
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-[#2358ed] dark:bg-slate-900"><Navigation size={19}/></span><div className="min-w-0 flex-1"><strong className="block text-[13px] font-extrabold text-[#1f3d80] dark:text-blue-100">Lanjutkan tugas</strong><span className="mt-1 block truncate text-[12px] font-medium text-blue-600 dark:text-blue-300">{ongoing[0].area}</span></div><ChevronRight size={19} className="text-[#2358ed]"/></button>}
              <SectionHeading title="Daftar Kiriman" note={visibleTrips.length ? `${visibleTrips.length} kiriman ditemukan` : 'Jadwal akan tampil di sini'} />
              <label className={`flex h-[48px] items-center gap-3 rounded-2xl ${bg} ${border} px-3.5 shadow-[0_3px_10px_rgba(15,23,42,0.02)]`}><Search size={18} className="shrink-0 text-slate-400"/><input value={search} onChange={e=>setSearch(e.target.value)} className="min-w-0 flex-1 bg-transparent text-[13px] text-slate-900 outline-none placeholder:text-slate-400 dark:text-white" placeholder="Cari area atau armada..." aria-label="Cari kiriman"/>{search && <button type="button" aria-label="Hapus pencarian" onClick={()=>setSearch('')}><X size={16} className="text-slate-400"/></button>}</label>
              {visibleTrips.length ? <div className="space-y-3">{visibleTrips.map(t=><TripCard key={t.id} t={t} mine={slotForUser(t,user)} onClaim={()=>setClaimId(t.id)} onOpen={()=>choose(t.id)} busy={busy}/>)}</div>
              : <EmptyState icon={Truck} title={search ? 'Kiriman tidak ditemukan' : 'Belum ada kiriman'} text={search ? 'Coba kata kunci area atau armada lain.' : 'Kiriman baru dari Admin akan muncul di sini. Kamu belum perlu memilih tugas apa pun.'}/>}
            </motion.section>}

            {screen === 'tugas' && <motion.section key="tugas" initial={{opacity:0,x:12}} animate={{opacity:1,x:0}} exit={{opacity:0,x:-12}} transition={{duration:.18}} className="space-y-4">
              <SectionHeading kicker="PENGIRIMAN" title="Tugas Saya" note={ongoing.length ? `${ongoing.length} tugas aktif` : 'Posisi mengikuti kiriman yang diambil'}/>
              {!activeTrip || !activeSlot ? <EmptyState icon={ClipboardCheck} title="Belum ada tugas" text="Pilih kiriman terlebih dahulu. Tugas Driver atau Helper baru tampil setelah slot diambil." action={{label:'Lihat Kiriman',onClick:()=>nav('kiriman')}}/> : <>
                {ongoing.length > 1 && <label className={`flex items-center gap-2 rounded-2xl ${bg} ${border} p-3 text-[13px]`}><span className="shrink-0 font-semibold text-slate-500">Pilih kiriman</span><select className="min-w-0 flex-1 bg-transparent text-right font-bold outline-none dark:text-white" value={activeTrip.id} onChange={e=>setSelectedId(e.target.value)}>{ongoing.map(t=><option key={t.id} value={t.id}>{t.area} · {showShortDate(t.date)}</option>)}</select><ChevronDown size={15}/></label>}
                <div className="relative overflow-hidden rounded-[24px] bg-[#14294a] p-5 text-white shadow-[0_12px_24px_rgba(20,41,74,.12)]"><div className="pointer-events-none absolute -right-14 -top-14 h-[160px] w-[160px] rounded-full border-[28px] border-white/5"/>
                  <div className="flex items-center justify-between"><span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-[11px] font-bold"><CheckCircle2 size={13}/> {activeSlot === 'driver' ? 'Tugas Driver' : 'Tugas Helper'}</span><span className="text-[11px] font-semibold text-blue-100/65">{showShortDate(activeTrip.date)}</span></div>
                  <h2 className="relative mt-4 text-[22px] font-black leading-[1.12] tracking-[-.04em]">{activeTrip.area}</h2><div className="mt-2 flex items-center gap-2 text-[12px] text-blue-100/75"><Truck size={14}/>{activeTrip.fleetLabel}<span>·</span>{activeTrip.departureTime} WIB</div>
                  <div className="mt-5 flex items-center gap-2 rounded-2xl bg-white/10 px-3 py-3"><Users size={17} className="text-blue-200"/><span className="text-[12px] text-blue-100/75">Pasangan</span><strong className="ml-auto min-w-0 truncate text-[12px]">{(activeSlot === 'driver' ? activeTrip.helper?.name : activeTrip.driver?.name) || 'Belum ada'}</strong></div>
                </div>
                <div className={`rounded-[24px] ${bg} ${border} p-4 shadow-sm`}><div className="flex items-center justify-between"><h3 className="text-[14px] font-extrabold">Perjalanan</h3><StatusPill trip={activeTrip}/></div>
                  <div className="mt-3 grid grid-cols-3 gap-2 text-center"><div className={`rounded-xl py-3 text-[11px] font-semibold ${activeTrip.phase==='waiting'?'bg-blue-50 text-blue-700 dark:bg-blue-900/20':'bg-slate-100 text-slate-500 dark:bg-slate-800'}`}>Siap</div><div className={`rounded-xl py-3 text-[11px] font-semibold ${activeTrip.phase==='going'?'bg-blue-50 text-blue-700 dark:bg-blue-900/20':'bg-slate-100 text-slate-500 dark:bg-slate-800'}`}>Berangkat</div><div className={`rounded-xl py-3 text-[11px] font-semibold ${activeTrip.phase==='returned'?'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20':'bg-slate-100 text-slate-500 dark:bg-slate-800'}`}>Selesai</div></div>
                  {activeTrip.phase === 'waiting' ? <div className="mt-4"><MainButton disabled={busy || !activeTrip.driver || !activeTrip.helper || !activeTrip.odometerStart || !activeTrip.inspectionDone || !activeTrip.waybillValidated} onClick={()=>perform(()=>moveTrip(user, activeTrip.id, 'going'),'Berangkat tercatat. Status pasangan ikut berubah.')} loading={busy}><Navigation size={17}/> Berangkat</MainButton>{(!activeTrip.driver || !activeTrip.helper || !activeTrip.odometerStart || !activeTrip.inspectionDone || !activeTrip.waybillValidated) && <p className="mt-2 text-center text-[12px] text-slate-500">Lengkapi kru, KM awal, cek armada, dan surat jalan.</p>}</div>
                  : activeTrip.phase === 'going' ? <div className="mt-4"><MainButton disabled={busy} onClick={()=>void invoke(()=>moveTrip(user,activeTrip.id,'returned'),'Perjalanan selesai dan masuk Riwayat.',()=>setScreen('riwayat'))} loading={busy}><CheckCircle2 size={17}/> Tiba di Gudang</MainButton></div>
                  : <div className="mt-4 flex items-center justify-center gap-2 rounded-xl bg-emerald-50 p-3 text-[13px] font-bold text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300"><CheckCheck size={17}/> Kiriman selesai</div>}
                </div>
                <div className={`rounded-[24px] ${bg} ${border} p-4 shadow-sm`}>
                  <h3 className="mb-1 text-[15px] font-extrabold">{activeSlot === 'driver' ? 'Tugas Driver' : 'Tugas Helper'}</h3>
                  <p className="mb-3 text-[12px] text-slate-500">Pilih pekerjaan yang perlu kamu lakukan.</p>
                  {activeSlot === 'driver' ? <>
                    <div className="flex items-center gap-3 border-b border-slate-100 py-3 dark:border-slate-800"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-sky-50 text-blue-600 dark:bg-sky-900/25"><Truck size={19}/></span><div className="min-w-0 flex-1"><strong className="block text-[13px]">KM awal kendaraan</strong><p className="mt-1 text-[11px] text-slate-500">{activeTrip.odometerStart ? `${activeTrip.odometerStart} km tercatat` : 'Isi sebelum berangkat'}</p></div>{!activeTrip.odometerStart && <div className="flex items-center gap-1"><input type="number" min="1" placeholder="KM" aria-label="KM awal" value={kmValue} onChange={e=>setKmValue(e.target.value)} className="w-16 rounded-xl border border-slate-200 p-2 text-center text-[13px] outline-none focus:border-blue-400 dark:border-slate-700 dark:bg-slate-800"/><button type="button" disabled={busy} onClick={()=>perform(()=>recordKm(user,activeTrip.id,kmValue),'KM awal disimpan.')} className="rounded-xl bg-blue-600 p-2.5 text-white disabled:opacity-40"><Check size={15}/></button></div>}</div>
                    <button type="button" onClick={()=>openTaskConfirm('inspection')} className="flex w-full items-center gap-3 border-b border-slate-100 py-3 text-left dark:border-slate-800"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-50 text-blue-600 dark:bg-blue-900/20"><ShieldCheck size={19}/></span><div className="flex-1"><strong className="block text-[13px]">{activeTrip.inspectionDone ? 'Armada sudah dicek' : 'Cek Armada'}</strong><small className="mt-1 block text-[11px] text-slate-500">Pemeriksaan kendaraan</small></div>{activeTrip.inspectionDone?<CheckCircle2 size={17} className="text-emerald-500"/>:<ChevronRight size={17} className="text-slate-400"/>}</button>
                  </> : <button type="button" onClick={()=>openTaskConfirm('waybill')} className="flex w-full items-center gap-3 border-b border-slate-100 py-3 text-left dark:border-slate-800"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-50 text-blue-600 dark:bg-blue-900/20"><ClipboardCheck size={19}/></span><div className="flex-1"><strong className="block text-[13px]">{activeTrip.waybillValidated ? 'Surat Jalan Divalidasi' : 'Validasi Surat Jalan'}</strong><small className="mt-1 block text-[11px] text-slate-500">Periksa dokumen kiriman</small></div>{activeTrip.waybillValidated?<CheckCircle2 size={17} className="text-emerald-500"/>:<ChevronRight size={17} className="text-slate-400"/>}</button>}
                  {WORK_FOR_SLOT[activeSlot].map(kind=>{const Icon=REPORT_ICONS[kind];return <button type="button" key={kind} onClick={()=>openReport(kind)} className="flex w-full items-center gap-3 border-b border-slate-100 py-3 text-left last:border-b-0 dark:border-slate-800"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-50 text-blue-600 dark:bg-blue-900/20"><Icon size={19}/></span><div className="flex-1"><strong className="block text-[13px]">{WORK_LABELS[kind]}</strong><small className="mt-1 block text-[11px] text-slate-500">{kind === 'form_kirim' ? 'Data pengiriman' : kind === 'toko' ? 'Kunjungan pelanggan' : kind === 'bbm' ? 'Pemakaian solar' : 'Catat aktivitas'}</small></div><ChevronRight size={17} className="text-slate-400"/></button>})}
                </div>
              </>}
            </motion.section>}

            {screen === 'laporan' && <motion.section key="laporan" initial={{opacity:0,x:12}} animate={{opacity:1,x:0}} exit={{opacity:0,x:-12}} transition={{duration:.18}} className="space-y-4">
              <SectionHeading kicker="CATATAN LAPANGAN" title="Laporan" note={activeSlot ? `Kiriman ${activeTrip?.area || ''}` : 'Ambil kiriman untuk mulai melapor'}/>
              {!activeTrip || !activeSlot ? <EmptyState icon={FileText} title="Belum ada laporan" text="Laporan akan tersedia setelah kamu mengambil kiriman." action={{label:'Lihat Kiriman',onClick:()=>nav('kiriman')}}/>
              : reportKind ? <form onSubmit={sendReport} className={`rounded-[24px] ${bg} ${border} p-4 shadow-sm`}>
                <button type="button" className="mb-4 flex items-center gap-2 text-[13px] font-bold text-slate-500 hover:text-blue-600" onClick={()=>setReportKind(null)}><ArrowLeft size={17}/> Kembali</button>
                <h3 className="text-[18px] font-black tracking-tight">{WORK_LABELS[reportKind]}</h3><p className="mt-1 text-[12px] text-slate-500">{activeTrip.area} · {activeTrip.fleetLabel}</p>
                <label className="mt-5 block"><span className="mb-2 block text-[13px] font-bold">Keterangan</span><textarea minLength={3} required maxLength={1200} rows={5} value={reportNote} onChange={e=>setReportNote(e.target.value)} placeholder="Tulis informasi singkat dan jelas..." className="w-full resize-none rounded-2xl border border-slate-200 bg-slate-50 p-3.5 text-[14px] leading-relaxed outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 dark:border-slate-700 dark:bg-slate-800"/></label>
                <input ref={reportFile} accept="image/*" type="file" capture="environment" onChange={onFile} className="hidden"/>
                <button type="button" onClick={()=>reportFile.current?.click()} className="mt-3 flex h-12 w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-slate-300 bg-slate-50 text-[13px] font-bold text-slate-600 hover:border-blue-400 hover:text-blue-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
                  {reportPhoto?<><CheckCircle2 size={17} className="text-emerald-600"/> Foto dipilih</>:<><Camera size={17}/> Tambahkan Foto</>}
                </button>
                {!qa && <p className="mt-2 text-[12px] leading-relaxed text-slate-500">GPS asli akan diperiksa saat menyimpan. Izin lokasi harus aktif.</p>}
                <div className="mt-5"><button disabled={busy || reportNote.trim().length<3} type="submit" className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-blue-600 px-4 text-[14px] font-bold text-white shadow-lg shadow-blue-600/20 disabled:cursor-not-allowed disabled:opacity-50">{busy?<LoaderCircle className="animate-spin" size={17}/>:<Check size={17}/>} Simpan Laporan</button></div>
              </form> : <div className={`rounded-[24px] ${bg} ${border} p-4 shadow-sm`}><h3 className="mb-1 text-[14px] font-extrabold">Pilih Laporan</h3><p className="mb-3 text-[12px] text-slate-500">Hanya sesuai tugas kirimanmu.</p>{WORK_FOR_SLOT[activeSlot].map(kind=>{const Icon=REPORT_ICONS[kind];return <button type="button" key={kind} onClick={()=>openReport(kind)} className="flex w-full items-center gap-3 border-b border-slate-100 py-3.5 text-left last:border-b-0 dark:border-slate-800"><span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-50 text-blue-600 dark:bg-blue-900/20"><Icon size={20}/></span><span className="flex-1 text-[14px] font-bold">{WORK_LABELS[kind]}</span><ChevronRight size={17} className="text-slate-400"/></button>})}</div>}
            </motion.section>}

            {screen === 'riwayat' && <motion.section key="riwayat" initial={{opacity:0,x:12}} animate={{opacity:1,x:0}} exit={{opacity:0,x:-12}} transition={{duration:.18}} className="space-y-4">
              <SectionHeading kicker="PENGIRIMAN SELESAI" title="Riwayat" note={`${completed.length} kiriman selesai`}/>
              {completed.length === 0 ? <EmptyState icon={FileClock} title="Belum ada riwayat" text="Kiriman yang sudah tiba di gudang akan otomatis masuk ke sini."/> : completed.map(t=>{
                const slot=slotForUser(t,user); const opened=expandedHistory===t.id;
                return <article key={t.id} className={`overflow-hidden rounded-[22px] ${bg} ${border}`}>
                  <button type="button" onClick={()=>setExpandedHistory(opened?null:t.id)} className="flex w-full items-center gap-3 p-4 text-left"><span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20"><CheckCircle2 size={20}/></span>
                    <div className="min-w-0 flex-1"><strong className="block truncate text-[14px] font-extrabold">{t.area}</strong><span className="mt-1 block text-[12px] text-slate-500">{showShortDate(t.date)} · {t.fleetLabel} · {slot==='driver'?'Driver':'Helper'}</span></div><ChevronDown size={18} className={`shrink-0 text-slate-400 transition-transform ${opened?'rotate-180':''}`}/></button>
                  {opened && <div className="border-t border-slate-100 px-4 py-1 dark:border-slate-800"><ActivityLine name="Berangkat" done={!!t.departedAt} detail={t.departedAt?new Date(t.departedAt).toLocaleString('id-ID'):undefined}/><ActivityLine name="Tiba di Gudang" done={!!t.returnedAt} detail={t.returnedAt?new Date(t.returnedAt).toLocaleString('id-ID'):undefined}/><ActivityLine name="Laporan lapangan" detail={`${t.reports.length} laporan`} done={t.reports.length>0}/></div>}
                </article>;
              })}
            </motion.section>}
          </AnimatePresence>}
        </main>
        <nav aria-label="Navigasi pekerjaan" className="relative z-30 shrink-0 border-t border-slate-200/80 bg-white/95 px-3 pb-[max(10px,env(safe-area-inset-bottom))] pt-2 backdrop-blur-lg dark:border-slate-800 dark:bg-[#111a2c]/95">
          <div className="grid grid-cols-4 gap-1">{TABS.map(({id,label,icon:Icon})=>{
            const active=screen===id;
            return <button type="button" key={id} aria-current={active?'page':undefined} onClick={()=>nav(id)} className={`relative flex min-h-[59px] flex-col items-center justify-center gap-1 rounded-[16px] transition-all duration-200 active:scale-95 ${active ? 'bg-[#ebf1ff] text-[#2358ed] dark:bg-blue-900/25 dark:text-blue-300' : 'text-slate-500 hover:bg-slate-50 dark:text-slate-400 dark:hover:bg-slate-800'}`}><Icon size={20} strokeWidth={active?2.4:1.9}/><span className="text-[11px] font-bold">{label}</span></button>;
          })}</div>
        </nav>
      </div>

      <AnimatePresence>
        {claimId && <motion.div className="fixed inset-0 z-[22100] flex items-end justify-center bg-slate-950/55 px-3 pb-[max(12px,env(safe-area-inset-bottom))] backdrop-blur-[3px] sm:items-center" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} onMouseDown={e=>{if(e.target===e.currentTarget)setClaimId(null)}}>
          <motion.section initial={{y:36,opacity:0}} animate={{y:0,opacity:1}} exit={{y:32,opacity:0}} transition={{duration:.22}} role="dialog" aria-modal="true" aria-label="Ambil kiriman" className="w-full max-w-[460px] rounded-[28px] bg-white p-5 shadow-2xl dark:bg-slate-900">
            <div className="flex items-center justify-between"><div><span className="text-[11px] font-bold uppercase tracking-[.14em] text-blue-600">AMBIL KIRIMAN</span><h2 className="mt-1 text-[21px] font-black tracking-tight">Pilih posisi</h2></div><button type="button" onClick={()=>setClaimId(null)} className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-800"><X size={18}/></button></div>
            <p className="mt-2 text-[13px] text-slate-500">Tugas otomatis mengikuti posisi yang kamu ambil.</p>
            <div className="mt-5 grid grid-cols-2 gap-3">{(['driver','helper'] as const).map(slot=>{
              const trip=trips.find(t=>t.id===claimId);
              const occupied=Boolean(trip?.[slot]);
              const Icon=slot==='driver'?Truck:Users;
              return <button type="button" disabled={occupied||busy} onClick={()=>submitClaim(slot)} key={slot} className={`flex flex-col items-center gap-3 rounded-[22px] border p-4 text-center transition-all disabled:cursor-not-allowed ${occupied?'border-slate-200 bg-slate-50 opacity-50 dark:border-slate-700 dark:bg-slate-800':'border-blue-200 bg-blue-50 hover:border-blue-500 hover:shadow-md active:scale-95 dark:border-blue-900 dark:bg-blue-900/15'}`}>
                <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-blue-600 shadow-sm dark:bg-slate-800"><Icon size={23}/></span><strong className="text-[15px] font-extrabold">{slot==='driver'?'Driver':'Helper'}</strong><span className="text-[11px] text-slate-500">{occupied?'Sudah diambil':'Slot tersedia'}</span>
              </button>;
            })}</div>
            {!qa&&!canClaimLive()&&<div className="mt-4 rounded-2xl bg-amber-50 p-3 text-[12px] leading-relaxed text-amber-800 dark:bg-amber-900/20 dark:text-amber-200">Penguncian slot kiriman nyata di server belum aktif. Coba alurnya melalui akun uji terlebih dahulu.</div>}
          </motion.section>
        </motion.div>}
        {taskConfirm && activeTrip && <motion.div key="task-confirm" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} className="fixed inset-0 z-[22130] flex items-end justify-center bg-slate-950/60 p-3 pb-[max(12px,env(safe-area-inset-bottom))] backdrop-blur-sm sm:items-center" onMouseDown={e=>{if(e.target===e.currentTarget)setTaskConfirm(null)}}>
          <motion.section initial={{y:30,opacity:0}} animate={{y:0,opacity:1}} exit={{y:25,opacity:0}} role="dialog" aria-modal="true" aria-label={taskConfirm==='inspection'?'Konfirmasi pemeriksaan armada':'Konfirmasi surat jalan'} className="w-full max-w-[460px] rounded-[28px] bg-white p-5 shadow-2xl dark:bg-slate-900">
            <div className="flex items-center justify-between"><div><span className="text-[11px] font-bold uppercase tracking-wider text-blue-600">PERSIAPAN KIRIMAN</span><h2 className="mt-1 text-[21px] font-black tracking-tight">{taskConfirm==='inspection'?'Cek Armada':'Cek Surat Jalan'}</h2></div><button aria-label="Tutup" type="button" onClick={()=>setTaskConfirm(null)} className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-800"><X size={18}/></button></div>
            <p className="mt-3 text-[13px] text-slate-500">Pastikan dua hal berikut sudah diperiksa.</p>
            {(taskConfirm==='inspection'?[ 'Ban, rem, dan lampu sudah aman', 'Kendaraan dan perlengkapan siap berangkat' ]:[ 'Tujuan dan jumlah surat jalan sesuai', 'Dokumen kiriman lengkap dan siap dibawa' ]).map((label,i)=><label key={i} className="mt-3 flex min-h-[54px] cursor-pointer items-center gap-3 rounded-2xl border border-slate-200 p-3.5 text-[14px] font-semibold dark:border-slate-700"><input type="checkbox" checked={taskChecks[i]} onChange={e=>setTaskChecks(v=>i===0?[e.target.checked,v[1]]:[v[0],e.target.checked])} className="h-5 w-5 shrink-0 accent-blue-600"/><span>{label}</span></label>)}
            <button type="button" disabled={busy||!taskChecks.every(Boolean)} className="mt-5 flex h-[50px] w-full items-center justify-center gap-2 rounded-2xl bg-blue-600 text-[14px] font-bold text-white shadow-lg shadow-blue-600/20 disabled:opacity-45" onClick={()=>void invoke(()=>markTask(user,activeTrip.id,taskConfirm),taskConfirm==='inspection'?'Pemeriksaan armada tersimpan.':'Surat jalan telah dikonfirmasi.',()=>setTaskConfirm(null))}>{busy?<LoaderCircle size={17} className="animate-spin"/>:<Check size={18}/>} Simpan Pemeriksaan</button>
            {!qa && <p className="mt-3 text-center text-[12px] leading-relaxed text-slate-400">Waktu dan GPS asli dicatat saat menyimpan.</p>}
          </motion.section>
        </motion.div>}
        {accountOpen && <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} className="fixed inset-0 z-[22150] flex items-end justify-center bg-slate-950/55 px-3 pb-4 backdrop-blur-sm sm:items-center" onMouseDown={e=>{if(e.target===e.currentTarget)setAccountOpen(false)}}>
          <motion.section initial={{y:40,opacity:0}} animate={{y:0,opacity:1}} exit={{y:40,opacity:0}} role="dialog" aria-modal="true" aria-label="Pengaturan akun" className="w-full max-w-[460px] rounded-[26px] bg-white p-5 dark:bg-slate-900">
            <div className="flex items-center justify-between"><h2 className="text-[18px] font-black">Akun Saya</h2><button className="rounded-xl bg-slate-100 p-2 dark:bg-slate-800" aria-label="Tutup" onClick={()=>setAccountOpen(false)}><X size={18}/></button></div>
            <div className="mt-5 flex items-center gap-3 rounded-2xl bg-slate-50 p-4 dark:bg-slate-800"><div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-100 text-[15px] font-black text-blue-600">{initials(user.fullName)}</div><div className="min-w-0"><strong className="block truncate text-[15px]">{user.fullName || 'Kru AKK'}</strong><p className="mt-1 truncate text-[12px] text-slate-500">{user.email}</p></div></div>
            {qa&&<div className="mt-3 rounded-2xl border border-blue-100 bg-blue-50 p-3 text-[12px] text-blue-700">Mode uji — tersimpan terpisah di server dan tersinkron antar-perangkat.</div>}
            {!qa&&onOpenClassic&&<button type="button" onClick={()=>{setAccountOpen(false);onOpenClassic()}} className="mt-3 flex h-12 w-full items-center justify-between rounded-2xl bg-slate-100 px-4 text-[13px] font-semibold dark:bg-slate-800"><span>Fitur operasional lengkap</span><ArrowUpRight size={17}/></button>}
            <button type="button" onClick={()=>logisticsStore.logoutUser()} className="mt-4 flex h-12 w-full items-center justify-center gap-2 rounded-2xl border border-rose-100 bg-rose-50 text-[13px] font-bold text-rose-600 dark:border-rose-900/40 dark:bg-rose-900/10"><LogOut size={16}/> Keluar akun</button>
          </motion.section>
        </motion.div>}
      </AnimatePresence>
    </div>, document.body
  );
};

export default CrewFieldApp;
