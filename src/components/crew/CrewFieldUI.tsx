import React from 'react';
import { motion } from 'motion/react';
import {
  ArrowLeft, Check, CheckCircle2, ChevronRight, Clock3, CalendarDays,
  ClipboardCheck, Fuel, History, LoaderCircle, MapPin, Navigation,
  PackageX, Plus, FileText, Truck, Users, X
} from 'lucide-react';
import { safeDate, type CrewSlot, type FieldTrip, type WorkAction } from './crewModel';

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
export function IconTile({ icon: Icon, tone = 'blue' }: {icon: typeof Truck; tone?: 'blue' | 'green' | 'neutral'}) {
  return <span className={`cv66-icon cv66-icon--${tone}`} aria-hidden="true"><Icon size={20} strokeWidth={1.9}/></span>;
}
export function Button({ children, onClick, disabled, loading, variant = 'primary', type = 'button' }: {
  children: React.ReactNode; onClick?: () => void; disabled?: boolean; loading?: boolean;
  variant?: 'primary' | 'secondary' | 'danger'; type?: 'button' | 'submit';
}) {
  return <button type={type} onClick={onClick} disabled={disabled || loading} className={`cv66-button cv66-button--${variant}`}>
    {loading && <LoaderCircle size={18} className="cv66-spin"/>}{children}
  </button>;
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
  return <div className="cv66-empty"><IconTile icon={icon}/><h2 className="cv66-section-title">{title}</h2>
    {detail && <p className="cv66-meta">{detail}</p>}
    {action && <Button variant="secondary" onClick={action.run}>{action.label}<ChevronRight size={17}/></Button>}
  </div>;
}
function Person({label, member}: {label: string; member: FieldTrip['driver']}) {
  return <div className="cv66-person"><span className="cv66-meta">{label}</span><div className="cv66-person-name"><span className={`cv66-person-avatar ${member ? 'cv66-person-avatar--filled' : ''}`}>{member ? initials(member.name) : <Plus size={14}/>}</span><span>{member?.name || 'Belum terisi'}</span></div></div>;
}
export function TripCard({trip, mine, busy, claimAllowed, onOpen, onClaim}: {trip: FieldTrip; mine: CrewSlot | null; busy: boolean; claimAllowed: boolean; onOpen: () => void; onClaim: () => void}) {
  const claimable = trip.phase === 'waiting' && (!trip.driver || !trip.helper) && !mine;
  return <article className="cv66-panel cv66-trip">
    <div className="cv66-trip-top"><Status trip={trip}/><span className="cv66-meta cv66-inline"><CalendarDays size={15}/>{shortDate(trip.date)}</span></div>
    <h2 className="cv66-trip-title">{trip.area}</h2>
    <TripMeta trip={trip}/>
    <div className="cv66-person-grid"><Person label="Driver" member={trip.driver}/><Person label="Helper" member={trip.helper}/></div>
    {mine ? <Button onClick={onOpen}>Buka Tugas<ChevronRight size={18}/></Button>
      : claimable ? <Button onClick={onClaim} disabled={busy || !claimAllowed}><Plus size={19}/>Ambil Kiriman</Button>
      : <div className="cv66-unavailable"><CheckCircle2 size={16}/>{trip.phase === 'waiting' ? 'Tim lengkap' : 'Tidak bisa diambil'}</div>}
  </article>;
}
export function TripMeta({trip}: {trip: FieldTrip}) {
  return <div className="cv66-trip-meta"><span className="cv66-inline"><Truck size={16}/>{trip.fleetLabel}</span><span className="cv66-inline"><Clock3 size={16}/>{trip.departureTime} WIB</span></div>;
}
export function ActiveTrip({trip, slot}: {trip: FieldTrip; slot: CrewSlot}) {
  return <section className="cv66-active-trip"><div className="cv66-active-top"><span className="cv66-role">{roleName(slot)}</span><span className="cv66-active-date">{shortDate(trip.date)}</span></div>
    <h2 className="cv66-active-title">{trip.area}</h2><TripMeta trip={trip}/>
    <div className="cv66-partner"><Users size={17}/><span>{slot === 'driver' ? 'Helper' : 'Driver'}</span><span className="cv66-partner-name">{(slot === 'driver' ? trip.helper?.name : trip.driver?.name) || 'Belum terisi'}</span></div>
  </section>;
}
export function TaskRow({icon, label, detail, done = false, disabled = false, onClick}: {icon: typeof Truck; label: string; detail?: string; done?: boolean; disabled?: boolean; onClick: () => void}) {
  return <button type="button" className="cv66-row" disabled={disabled || done} onClick={onClick}>
    <IconTile icon={done ? CheckCircle2 : icon} tone={done ? 'green' : 'blue'}/><span className="cv66-row-text"><span className="cv66-row-title">{label}</span>{detail && <span className="cv66-meta">{detail}</span>}</span>
    {done ? <span className="cv66-done-label">Selesai</span> : <ChevronRight className="cv66-chevron" size={19}/>}
  </button>;
}
export function Journey({trip, busy, onMove}: {trip: FieldTrip; busy: boolean; onMove: (phase: 'going' | 'returned') => void}) {
  const missing = [!trip.driver || !trip.helper ? 'Kru' : '', !trip.odometerStart ? 'KM awal' : '', !trip.inspectionDone ? 'Cek armada' : '', !trip.waybillValidated ? 'Surat jalan' : ''].filter(Boolean);
  const stage = trip.phase === 'returned' ? 2 : trip.phase === 'going' ? 1 : 0;
  return <Panel title="Perjalanan" right={<Status trip={trip}/>}>
    <div className="cv66-steps" aria-label="Tahapan perjalanan">{['Persiapan', 'Berangkat', 'Selesai'].map((label, i) => <div key={label} className={`cv66-step ${i < stage ? 'cv66-step--done' : i === stage ? 'cv66-step--active' : ''}`} aria-current={i === stage ? 'step' : undefined}><span className="cv66-step-dot">{i < stage ? <Check size={13}/> : i+1}</span><span>{label}</span></div>)}</div>
    {trip.phase === 'waiting' ? <><Button disabled={missing.length > 0 || busy} loading={busy} onClick={() => onMove('going')}><Navigation size={18}/>Berangkat</Button>{missing.length > 0 && <p className="cv66-required">Belum lengkap: {missing.join(', ')}</p>}</>
      : trip.phase === 'going' ? <Button disabled={busy} loading={busy} onClick={() => onMove('returned')}><CheckCircle2 size={18}/>Tiba di Gudang</Button>
      : <div className="cv66-unavailable"><CheckCircle2 size={17}/>Kiriman selesai</div>}
  </Panel>;
}
export function Dialog({title, children, busy, onClose}: {title: string; children: React.ReactNode; busy?: boolean; onClose: () => void}) {
  return <motion.div className="cv66-overlay" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} onMouseDown={e=>{if(e.target===e.currentTarget && !busy)onClose()}}>
    <motion.section role="dialog" aria-modal="true" aria-label={title} className="cv66-dialog" initial={{y:18,opacity:0}} animate={{y:0,opacity:1}} exit={{y:18,opacity:0}} transition={{duration:.16}}>
      <div className="cv66-dialog-heading"><h2 className="cv66-section-title">{title}</h2><button type="button" className="cv66-icon-button cv66-icon-button--neutral" onClick={onClose} disabled={busy} aria-label="Tutup"><X size={21}/></button></div>{children}
    </motion.section>
  </motion.div>;
}
export function BackButton({onClick}: {onClick: () => void}) {return <button type="button" className="cv66-back" onClick={onClick}><ArrowLeft size={18}/>Kembali</button>}
