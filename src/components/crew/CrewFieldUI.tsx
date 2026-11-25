import React, { useEffect } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { CrewArt, type CrewArtName } from './CrewIllustrations';
import {
  ArrowLeft, Check, CheckCircle2, ChevronRight, Clock3, CalendarDays,
  ClipboardCheck, Fuel, History, LoaderCircle, MapPin, Navigation,
  PackageX, Plus, FileText, Truck, Users, X, ShieldCheck, Camera, CloudOff, FileClock
} from 'lucide-react';
import { safeDate, WORK_LABELS, type CrewSlot, type FieldTrip, type WorkAction } from './crewModel';

export type Screen = 'kiriman' | 'tugas' | 'laporan' | 'riwayat';
export const TABS = [
  { id: 'kiriman', label: 'Kiriman', icon: Truck },
  { id: 'tugas', label: 'Tugas', icon: ClipboardCheck },
  { id: 'laporan', label: 'Laporan', icon: FileText },
  { id: 'riwayat', label: 'Riwayat', icon: History }
] as const;
export const REPORT_ICONS: Record<WorkAction, typeof Fuel> = {
  bbm: Fuel, kendala: Navigation, toko: MapPin, retur: PackageX, form_kirim: FileText
};
export function shortDate(date: string) {
  if (!date) return '-';
  const value = new Date(`${date}T12:00:00`);
  return Number.isNaN(value.getTime()) ? safeDate(date) : value.toLocaleDateString('id-ID', {day: 'numeric', month: 'short'});
}
export function initials(name: string) {
  return String(name || 'A').trim().split(/\s+/).slice(0, 2).map(s => s[0]?.toUpperCase()).join('') || 'A';
}
export const roleName = (slot: CrewSlot) => slot === 'driver' ? 'Driver' : 'Helper';
const ICON_ART = new Map<typeof Truck, CrewArtName>([[Truck,'truck'],[ClipboardCheck,'tasks'],[FileText,'report'],[History,'history'],[Clock3,'history'],[FileClock,'history'],[ShieldCheck,'shield'],[Fuel,'fuel'],[Navigation,'alert'],[MapPin,'shop'],[PackageX,'parcel'],[Camera,'camera'],[Users,'crew'],[CheckCircle2,'success'],[CloudOff,'offline']]);
export const TAB_ART: Record<Screen,CrewArtName> = {kiriman:'truck',tugas:'tasks',laporan:'report',riwayat:'history'};
const ACTION_ART: Record<WorkAction,CrewArtName> = {bbm:'fuel',kendala:'alert',toko:'shop',retur:'parcel',form_kirim:'report'};
export function IconTile({ icon: Icon, tone = 'blue', art, size = 43 }: {icon: typeof Truck; tone?: 'blue' | 'green' | 'neutral'; art?: CrewArtName; size?: number}) {
  const name = art || (tone === 'green' ? 'success' : ICON_ART.get(Icon));
  return <span className={`cv66-icon cv66-icon--${tone}${name ? ' cv69-icon-tile cv69-icon-tile--'+name : ''}`} aria-hidden="true">{name ? <CrewArt name={name} size={size}/> : <Icon size={20} strokeWidth={1.9}/>}</span>;
}
export function ActionGrid({ actions, busy, onAction }: {actions: WorkAction[]; busy: boolean; onAction: (kind:WorkAction)=>void}) {
  const reduced = useReducedMotion();
  return <div className={`cv69-actions ${actions.length > 2 ? 'cv69-actions--four' : ''}`}>{actions.map((kind,i)=><motion.button key={kind} type="button" className="cv69-action" disabled={busy} onClick={()=>onAction(kind)} initial={reduced ? false : {opacity:0,y:7}} animate={{opacity:1,y:0}} transition={{duration:reduced ? 0 : .2,delay:reduced ? 0 : i*.035}} whileTap={busy || reduced ? undefined : {scale:.95}}><span className={`cv69-action-tile cv69-icon-tile--${ACTION_ART[kind]}`}><CrewArt name={ACTION_ART[kind]} size={55}/></span><span className="cv69-action-label">{WORK_LABELS[kind]}</span></motion.button>)}</div>;
}
export function Button({ children, onClick, disabled, loading, variant = 'primary', type = 'button' }: {
  children: React.ReactNode; onClick?: () => void; disabled?: boolean; loading?: boolean;
  variant?: 'primary' | 'secondary' | 'danger'; type?: 'button' | 'submit';
}) {
  const reduced = useReducedMotion();
  return <motion.button type={type} onClick={onClick} disabled={disabled || loading} className={`cv66-button cv66-button--${variant}`} whileTap={disabled || loading || reduced ? undefined : {scale:.97}} transition={{type:'spring',stiffness:420,damping:28}}>
    {loading && <LoaderCircle size={18} className="cv66-spin"/>}{children}
  </motion.button>;
}
export function Status({trip}: {trip: FieldTrip}) {
  const label = trip.phase === 'returned' ? 'Selesai' : trip.phase === 'going' ? 'Dalam perjalanan' : 'Belum berangkat';
  return <span className={`cv66-status cv66-status--${trip.phase}`}><span/>{label}</span>;
}
export function Heading({title, right}: {title: string; right?: React.ReactNode}) {
  return <div className="cv66-heading"><h1 className="cv66-page-title">{title}</h1>{right}</div>;
}
export function Panel({title, right, children, className = ''}: {title?: string; right?: React.ReactNode; children: React.ReactNode; className?: string}) {
  return <section className={`cv66-panel ${className}`}>
    {title && <div className="cv66-panel-heading"><h2 className="cv66-section-title">{title}</h2>{right}</div>}
    {children}
  </section>;
}
export function Empty({icon, title, detail, action}: {icon: typeof Truck; title: string; detail?: string; action?: {label: string; run: () => void}}) {
  return <div className="cv66-empty"><div className="cv69-empty-visual"><span/><CrewArt name={ICON_ART.get(icon) || 'truck'} size={94}/></div><h2 className="cv66-section-title">{title}</h2>
    {detail && <p className="cv66-meta">{detail}</p>}
    {action && <Button variant="secondary" onClick={action.run}>{action.label}<ChevronRight size={17}/></Button>}
  </div>;
}
function Person({label, member}: {label: string; member: FieldTrip['driver']}) {
  return <div className="cv66-person"><span className="cv66-person-label">{label}</span><div className={`cv66-person-name ${member ? 'cv66-person-name--assigned' : ''}`}><span className={`cv66-person-avatar ${member ? 'cv66-person-avatar--filled' : ''}`}>{member ? initials(member.name) : <Plus size={14}/>}</span><span>{member?.name || 'Belum terisi'}</span></div></div>;
}
export function TripCard({trip, mine, busy, claimAllowed, sameDayLocked = false, onOpen, onClaim, readOnly = false}: {trip: FieldTrip; mine: CrewSlot | null; busy: boolean; claimAllowed: boolean; sameDayLocked?: boolean; onOpen: () => void; onClaim: () => void; readOnly?: boolean}) {
  const claimable = trip.phase === 'waiting' && (!trip.driver || !trip.helper) && !mine;
  return <article className="cv66-panel cv69-trip-card cv66-trip">
    <div className="cv69-trip-heading"><div className="cv69-trip-image"><CrewArt name="truck" size={60}/></div><div className="cv69-trip-heading-text"><div className="cv69-trip-kicker"><span className="cv66-trip-date cv66-inline"><CalendarDays size={12}/>{shortDate(trip.date)}</span><Status trip={trip}/></div><h2 className="cv66-trip-title">{trip.area}</h2><TripMeta trip={trip}/></div></div>
    <div className="cv66-person-grid"><Person label="Driver" member={trip.driver}/><Person label="Helper" member={trip.helper}/></div>
    {readOnly ? <Button variant="secondary" onClick={onOpen}>Lihat Detail<ChevronRight size={18}/></Button>
      : mine ? <Button onClick={onOpen}>Buka Tugas<ChevronRight size={18}/></Button>
      : claimable && sameDayLocked ? <div className="cv66-unavailable"><CheckCircle2 size={16}/>Sudah memilih kiriman pada hari ini</div>
      : claimable ? <Button onClick={onClaim} disabled={busy || !claimAllowed}><Plus size={19}/>Ambil Kiriman</Button>
      : <div className="cv66-unavailable"><CheckCircle2 size={16}/>{trip.phase === 'waiting' ? 'Tim lengkap' : 'Tidak bisa diambil'}</div>}
  </article>;
}
export function TripMeta({trip}: {trip: FieldTrip}) {
  return <div className="cv66-trip-meta"><span className="cv66-inline cv66-fleet"><Truck size={15}/>{trip.fleetLabel}</span><span className="cv66-inline cv66-time"><Clock3 size={14}/><span className="cv66-time-value">{trip.departureTime}</span><span className="cv66-time-zone">WIB</span></span></div>;
}
export function ActiveTrip({trip, slot}: {trip: FieldTrip; slot: CrewSlot}) {
  return <section className="cv66-active-trip cv69-active-trip"><div className="cv66-active-top"><span className="cv66-role">{roleName(slot)}</span><span className="cv66-active-date">{shortDate(trip.date)}</span></div>
    <div className="cv69-active-main"><div className="cv69-active-text"><h2 className="cv66-active-title">{trip.area}</h2><TripMeta trip={trip}/></div><div className="cv69-active-art"><CrewArt name="truck" size={92} active={trip.phase==='going'}/></div></div>
    <div className="cv66-partner"><Users size={17}/><span>{slot === 'driver' ? 'Helper' : 'Driver'}</span><span className="cv66-partner-name">{(slot === 'driver' ? trip.helper?.name : trip.driver?.name) || 'Belum terisi'}</span></div>
  </section>;
}
export function TaskRow({icon, label, detail, done = false, disabled = false, onClick}: {icon: typeof Truck; label: string; detail?: string; done?: boolean; disabled?: boolean; onClick: () => void}) {
  const reduced = useReducedMotion();
  return <motion.button type="button" className="cv66-row" disabled={disabled || done} onClick={onClick} whileTap={disabled || done || reduced ? undefined : {scale:.98}}>
    <IconTile icon={done ? CheckCircle2 : icon} tone={done ? 'green' : 'blue'}/><span className="cv66-row-text"><span className="cv66-row-title">{label}</span>{detail && <span className="cv66-meta">{detail}</span>}</span>
    {done ? <span className="cv66-done-label">Selesai</span> : <ChevronRight className="cv66-chevron" size={19}/>}
  </motion.button>;
}
export function Journey({trip, busy, onMove, readOnly = false}: {trip: FieldTrip; busy: boolean; onMove: (phase: 'going' | 'returned') => void; readOnly?: boolean}) {
  const missing = [!trip.driver || !trip.helper ? 'Kru' : '', !trip.odometerStart ? 'KM awal' : '', !trip.inspectionDone ? 'Cek armada' : '', !trip.waybillValidated ? 'Surat jalan' : ''].filter(Boolean);
  const stage = trip.phase === 'returned' ? 2 : trip.phase === 'going' ? 1 : 0;
  return <Panel title="Perjalanan" right={<Status trip={trip}/>} className="cv69-journey">
    <div className="cv66-steps" aria-label="Tahapan perjalanan">{['Persiapan', 'Berangkat', 'Selesai'].map((label, i) => <div key={label} className={`cv66-step ${i < stage ? 'cv66-step--done' : i === stage ? 'cv66-step--active' : ''}`} aria-current={i === stage ? 'step' : undefined}><span className="cv66-step-dot">{i < stage ? <Check size={13}/> : i+1}</span><span>{label}</span></div>)}</div>
    {readOnly ? (trip.phase === 'waiting' && missing.length > 0 ? <p className="cv66-required"><span className="cv66-required-label">Belum lengkap:</span> {missing.join(', ')}</p> : null)
      : trip.phase === 'waiting' ? <><Button disabled={missing.length > 0 || busy} loading={busy} onClick={() => onMove('going')}><Navigation size={18}/>Berangkat</Button>{missing.length > 0 && <p className="cv66-required"><span className="cv66-required-label">Lengkapi:</span> {missing.join(', ')}</p>}</>
      : trip.phase === 'going' ? <Button disabled={busy} loading={busy} onClick={() => onMove('returned')}><CheckCircle2 size={18}/>Tiba di Gudang</Button>
      : <div className="cv66-unavailable"><CheckCircle2 size={17}/>Kiriman selesai</div>}
  </Panel>;
}
export function Dialog({title, children, busy, onClose, overlayClassName = ''}: {title: string; children: React.ReactNode; busy?: boolean; onClose: () => void; overlayClassName?: string}) {
  const reduced = useReducedMotion();
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !busy) {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [busy, onClose]);

  const handleClose = (e: React.MouseEvent | React.TouchEvent) => {
    e.stopPropagation();
    if (!busy) {
      onClose();
    }
  };

  return <motion.div
    className={`cv66-overlay ${overlayClassName}`.trim()}
    initial={reduced ? false : {opacity:0}}
    animate={{opacity:1}}
    exit={{opacity:0}}
    onClick={e => { if (e.target === e.currentTarget && !busy) onClose(); }}
  >
    <motion.section
      role="dialog"
      aria-modal="true"
      aria-label={title}
      className="cv66-dialog"
      onClick={e => e.stopPropagation()}
      initial={reduced ? false : {y:30,opacity:0}}
      animate={{y:0,opacity:1}}
      exit={reduced ? {opacity:0} : {y:18,opacity:0}}
      transition={reduced ? {duration:0} : {type:'spring',stiffness:330,damping:31}}
    >
      <div className="cv66-dialog-heading">
        <h2 className="cv66-section-title">{title}</h2>
        <button
          type="button"
          className="cv66-icon-button cv66-icon-button--neutral cv66-dialog-close"
          onClick={handleClose}
          onTouchEnd={e => {
            if (!busy) {
              e.preventDefault();
              e.stopPropagation();
              onClose();
            }
          }}
          disabled={busy}
          aria-label="Tutup"
        >
          <X size={21}/>
        </button>
      </div>
      {children}
    </motion.section>
  </motion.div>;
}
export function BackButton({onClick}: {onClick: () => void}) {return <button type="button" className="cv66-back" onClick={onClick}><ArrowLeft size={18}/>Kembali</button>}
