import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  ArrowLeft, Check, CheckCircle2, ChevronRight, ClipboardCheck, Clock3,
  FileText, Fuel, LogOut, MapPin, PackageX, Plus, RotateCcw,
  Send, ShieldCheck, Truck, UserRound, Users, X
} from 'lucide-react';
import type { UserProfile } from '../types';
import { logisticsStore } from '../services/store';
import { branchStore } from '../services/branchStore';

/*
 * Existing Driver/Helper login, existing driver_portal route. The QA workspace
 * replaces its presentation only for explicit QA accounts; no production
 * schedules, GPS records or payroll data are written by this component.
 * The assigned TASK ROLE comes from the selected slot, never user.role.
 */
const QA_EVENT = 'akk-qa-kiriman-updated';
const QA_EMAIL = /^akk-qa-(driver|helper)-[a-z0-9-]+@example\.com$/i;
let inMemoryTestTrips: any[] = [];

type CrewSlot = 'driver' | 'helper';
type TripPhase = 'waiting' | 'going' | 'returned';
type ReportKind = 'bbm' | 'toko' | 'kendala' | 'retur' | 'form_kirim';
type Member = { id: string; name: string };
type QaReport = { id: string; type: ReportKind; note: string; by: string; at: string };
type QaTrip = {
  id: string;
  branchId: string;
  area: string;
  fleetLabel: string;
  date: string;
  departureTime: string;
  driver: Member | null;
  helper: Member | null;
  createdAt: string;
  phase?: TripPhase;
  departedAt?: string;
  returnedAt?: string;
  odometerStart?: string;
  inspectionDone?: boolean;
  waybillValidated?: boolean;
  reports?: QaReport[];
};

export function isQaCrewUser(user: UserProfile | null | undefined): boolean {
  return Boolean(user?.status === 'approved' &&
    (user.role === 'driver' || user.role === 'crew_helper') &&
    QA_EMAIL.test(String(user.email || '')) &&
    String(user.notes || '').includes('AKK_QA_TEST_ACCOUNT'));
}

function getTrips(): QaTrip[] {
  return inMemoryTestTrips.filter((t): t is QaTrip =>
    Boolean(t && typeof t === 'object' && typeof t.id === 'string' &&
      typeof t.area === 'string' && typeof t.branchId === 'string')
  ).slice(0, 60);
}
function publishTrips(trips: QaTrip[]) {
  inMemoryTestTrips = trips.slice(0, 60);
  window.dispatchEvent(new Event(QA_EVENT));
}
function dateDisplay(date: string) {
  const [year, month, day] = date.split('-');
  return day && month && year ? `${day}/${month}/${year}` : date;
}
function tripRole(t: QaTrip, userId: string): CrewSlot | null {
  return t.driver?.id === userId ? 'driver' : t.helper?.id === userId ? 'helper' : null;
}
const REPORT_LABELS: Record<ReportKind, string> = {
  bbm: 'Isi BBM', toko: 'Absen Toko', kendala: 'Kendala', retur: 'Retur Barang', form_kirim: 'Form Kirim'
};
const DRIVER_REPORTS: ReportKind[] = ['bbm', 'kendala'];
const HELPER_REPORTS: ReportKind[] = ['toko', 'kendala', 'retur', 'form_kirim'];

type View = 'kiriman' | 'tugas' | 'laporan';

export const CrewTestWorkspace: React.FC<{ user: UserProfile }> = ({ user }) => {
  const [trips, setTrips] = useState<QaTrip[]>(getTrips);
  const [view, setView] = useState<View>('kiriman');
  const [pickedId, setPickedId] = useState<string | null>(null);
  const [claimTarget, setClaimTarget] = useState<string | null>(null);
  const [reportKind, setReportKind] = useState<ReportKind | null>(null);
  const [reportNote, setReportNote] = useState('');
  const [kmValue, setKmValue] = useState('');
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [accountOpen, setAccountOpen] = useState(false);

  useEffect(() => {
    const update = () => setTrips(getTrips());
    window.addEventListener(QA_EVENT, update);
    return () => {
      window.removeEventListener(QA_EVENT, update);
    };
  }, []);
  useEffect(() => {
    document.body.classList.add('akk-qa-crew-active');
    return () => document.body.classList.remove('akk-qa-crew-active');
  }, []);

  const allowedBranches = useMemo(() => branchStore.getActiveBranches().filter(branch =>
    branchStore.canUserAccessBranch(user, branch.id)).map(b => b.id), [user]);
  const allowedTrips = useMemo(() => trips.filter(t => allowedBranches.includes(t.branchId)), [trips, allowedBranches]);
  const myTrips = useMemo(() => allowedTrips.filter(t => Boolean(tripRole(t, user.id))), [allowedTrips, user.id]);
  const selectedTrip = useMemo(() =>
    allowedTrips.find(t => t.id === pickedId) || myTrips.find(t => t.phase !== 'returned') || myTrips[0] || null,
    [allowedTrips, pickedId, myTrips]);
  const myRole = selectedTrip ? tripRole(selectedTrip, user.id) : null;
  const phase = selectedTrip?.phase || 'waiting';
  const isComplete = phase === 'returned';
  const currentLabel = myRole === 'driver' ? 'Driver' : myRole === 'helper' ? 'Helper' : '';
  const phaseLabel = (t: QaTrip) => t.phase === 'returned' ? 'Selesai' : t.phase === 'going' ? 'Di jalan' : 'Menunggu';
  const accountName = user.fullName || 'Akun Uji';

  const clearNotices = () => { setError(''); setNotice(''); };
  const chooseTrip = (id: string, nextView: View = 'tugas') => {
    setPickedId(id); setView(nextView); setClaimTarget(null); setReportKind(null); clearNotices();
  };
  const claim = (tripId: string, slot: CrewSlot) => {
    clearNotices();
    const latest = getTrips();
    const trip = latest.find(t => t.id === tripId);
    if (!trip || !allowedBranches.includes(trip.branchId)) return setError('Kiriman tidak tersedia pada cabang akun ini.');
    if (trip[slot]) return setError(`Slot ${slot === 'driver' ? 'Driver' : 'Helper'} sudah diambil.`);
    if (trip.driver?.id === user.id || trip.helper?.id === user.id) return setError('Kamu sudah mengambil slot pada kiriman ini.');
    if (trip.phase && trip.phase !== 'waiting') return setError('Kiriman sudah berjalan. Hubungi Admin untuk penggantian kru.');
    if (latest.some(t => t.id !== trip.id && t.date === trip.date && (t.driver?.id === user.id || t.helper?.id === user.id) && t.phase !== 'returned')) {
      return setError('Kamu sudah bertugas pada kiriman lain di tanggal tersebut.');
    }
    const next = latest.map(t => t.id === tripId
      ? { ...t, [slot]: { id: user.id, name: user.fullName } } : t);
    publishTrips(next);
    setPickedId(tripId); setClaimTarget(null); setView('tugas');
    setNotice(`Tugas ${slot === 'driver' ? 'Driver' : 'Helper'} berhasil diambil.`);
  };
  const updateTrip = (id: string, change: (trip: QaTrip) => QaTrip) => {
    const latest = getTrips();
    const source = latest.find(t => t.id === id);
    if (!source || !tripRole(source, user.id)) { setError('Kiriman tidak ditemukan untuk akunmu.'); return; }
    publishTrips(latest.map(t => t.id === id ? change(t) : t));
  };
  const advanceTrip = (type: 'going' | 'returned') => {
    if (!selectedTrip || !myRole) return;
    if (type === 'going' && phase !== 'waiting') return;
    if (type === 'returned' && phase !== 'going') return;
    const now = new Date().toISOString();
    updateTrip(selectedTrip.id, t => ({ ...t, phase: type,
      ...(type === 'going' ? { departedAt: now } : { returnedAt: now }) }));
    setNotice(type === 'going' ? 'Berangkat tercatat untuk kedua anggota tim.' : 'Kiriman selesai untuk kedua anggota tim.');
  };
  const saveKm = () => {
    if (!selectedTrip || myRole !== 'driver') return;
    const numeric = Number(kmValue);
    if (!kmValue.trim() || !Number.isFinite(numeric) || numeric <= 0) return setError('Isi KM awal dengan angka yang benar.');
    updateTrip(selectedTrip.id, t => ({ ...t, odometerStart: kmValue }));
    setKmValue(''); setError(''); setNotice('KM awal tercatat.');
  };
  const saveReport = (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedTrip || !myRole || !reportKind) return;
    const permitted = myRole === 'driver' ? DRIVER_REPORTS : HELPER_REPORTS;
    if (!permitted.includes(reportKind)) return setError('Jenis laporan tidak sesuai tugas kiriman.');
    if (reportNote.trim().length < 3) return setError('Isi keterangan minimal 3 huruf.');
    updateTrip(selectedTrip.id, t => ({ ...t, reports: [
      ...(t.reports || []),
      { id: `qareport-${Date.now()}-${Math.random().toString(36).slice(2)}`, type: reportKind,
        note: reportNote.trim(), by: user.fullName, at: new Date().toISOString() }
    ] }));
    setReportKind(null); setReportNote(''); setError(''); setNotice('Laporan uji tersimpan.'); setView('tugas');
  };
  const goToReport = (kind: ReportKind) => { clearNotices(); setReportKind(kind); setReportNote(''); setView('laporan'); };

  if (typeof document === 'undefined') return null;
  return createPortal(
    <div className="akk-crew-v64" data-testid="crew-test-workspace">
      <div className="akk-crew-v64-shell">
        <header className="akk-crew-v64-header">
          <div className="akk-crew-v64-brand"><span className="akk-crew-v64-symbol"><Truck size={20} /></span><div><strong>Pengiriman</strong><small>Mode uji</small></div></div>
          <button className="akk-crew-v64-profile" type="button" onClick={() => setAccountOpen(true)} aria-label="Akun dan keluar"><UserRound size={19} /></button>
        </header>
        <main className="akk-crew-v64-content">
          {notice && <div role="status" className="akk-crew-v64-feedback ok"><CheckCircle2 size={17} /> {notice}<button onClick={() => setNotice('')} aria-label="Tutup"><X size={16} /></button></div>}
          {error && <div role="alert" className="akk-crew-v64-feedback fail"><ShieldCheck size={17} /> {error}<button onClick={() => setError('')} aria-label="Tutup"><X size={16} /></button></div>}
          {view === 'kiriman' && <>
            <div className="akk-crew-v64-heading"><h1>Kiriman</h1><p>{allowedTrips.length} jadwal uji tersedia</p></div>
            {allowedTrips.length === 0 ? <div className="akk-crew-v64-empty"><span><Truck size={24}/></span><h2>Belum ada kiriman</h2><p>Minta Admin membuat jadwal di menu Uji Sistem.</p></div> :
              <div className="akk-crew-v64-stack">{allowedTrips.map(t => {
                const role = tripRole(t, user.id);
                const openSlots: CrewSlot[] = (['driver','helper'] as const).filter(s => !t[s]);
                return <article className="akk-crew-v64-card" key={t.id}>
                  <div className="akk-crew-v64-cardtop"><span className="akk-crew-v64-tag">{phaseLabel(t)}</span><span className="akk-crew-v64-date">{dateDisplay(t.date)}</span></div>
                  <h2>{t.area}</h2>
                  <p className="akk-crew-v64-meta"><Truck size={15}/> {t.fleetLabel} <span>·</span> <Clock3 size={15}/> {t.departureTime}</p>
                  <div className="akk-crew-v64-people">
                    <div><span>Driver</span><strong>{t.driver?.name || 'Belum diambil'}</strong></div>
                    <div><span>Helper</span><strong>{t.helper?.name || 'Belum diambil'}</strong></div>
                  </div>
                  {role ? <button type="button" className="akk-crew-v64-mainbtn" onClick={() => chooseTrip(t.id)}>
                    <Check size={17}/> Tugas Saya <ChevronRight size={17}/>
                  </button> : openSlots.length && t.phase !== 'going' && t.phase !== 'returned' ?
                    <button type="button" className="akk-crew-v64-mainbtn" onClick={() => { setClaimTarget(t.id); clearNotices(); }}><Plus size={19}/> Ambil Kiriman <ChevronRight size={17}/></button> :
                    <p className="akk-crew-v64-muted">{t.phase === 'waiting' ? 'Tim sudah lengkap' : 'Tidak dapat diambil'}</p>}
                </article>;
              })}</div>}
          </>}
          {view === 'tugas' && <>
            <div className="akk-crew-v64-heading"><h1>Tugas Saya</h1><p>{myTrips.length} kiriman diambil</p></div>
            {!selectedTrip || !myRole ? <div className="akk-crew-v64-empty"><span><ClipboardCheck size={24}/></span><h2>Belum ambil tugas</h2><p>Pilih kiriman dan ambil posisi Driver atau Helper.</p><button type="button" className="akk-crew-v64-mainbtn" onClick={() => setView('kiriman')}>Lihat Kiriman</button></div> : <>
              {myTrips.length > 1 && <label className="akk-crew-v64-field"><span>Pilih kiriman</span><select value={selectedTrip.id} onChange={e => setPickedId(e.target.value)}>{myTrips.map(t => <option key={t.id} value={t.id}>{t.area} · {dateDisplay(t.date)}</option>)}</select></label>}
              <div className="akk-crew-v64-taskhero"><span className="akk-crew-v64-tag">{currentLabel} · {phaseLabel(selectedTrip)}</span><h2>{selectedTrip.area}</h2><p>{selectedTrip.fleetLabel} · {dateDisplay(selectedTrip.date)}</p>
                <div className="akk-crew-v64-partner"><Users size={16}/> Pasangan: <b>{(myRole === 'driver' ? selectedTrip.helper?.name : selectedTrip.driver?.name) || 'Belum ada'}</b></div>
              </div>
              <section className="akk-crew-v64-section"><h2>Perjalanan</h2><div className="akk-crew-v64-progress"><div><span>Berangkat</span><strong>{selectedTrip.departedAt ? 'Sudah' : 'Belum'}</strong></div><div><span>Kembali</span><strong>{selectedTrip.returnedAt ? 'Sudah' : 'Belum'}</strong></div></div>
                {phase === 'waiting' && <button className="akk-crew-v64-mainbtn" type="button" onClick={() => advanceTrip('going')}><Truck size={18}/> Berangkat</button>}
                {phase === 'going' && <button className="akk-crew-v64-mainbtn" type="button" onClick={() => advanceTrip('returned')}><CheckCircle2 size={18}/> Tiba di Gudang</button>}
              </section>
              <section className="akk-crew-v64-section"><h2>{myRole === 'driver' ? 'Tugas Driver' : 'Tugas Helper'}</h2>
                {myRole === 'driver' ? <>
                  <div className="akk-crew-v64-km"><div><strong>KM Awal</strong><small>{selectedTrip.odometerStart ? `${selectedTrip.odometerStart} km` : 'Belum dicatat'}</small></div>{!selectedTrip.odometerStart && !isComplete && <><input aria-label="KM awal" type="number" min="1" inputMode="numeric" placeholder="Isi KM" value={kmValue} onChange={e => setKmValue(e.target.value)} /><button type="button" onClick={saveKm}>Simpan</button></>}</div>
                  <button type="button" className="akk-crew-v64-action" onClick={() => { updateTrip(selectedTrip.id, t => ({ ...t, inspectionDone: true })); setNotice('Checklist uji selesai.'); }}><ShieldCheck size={20}/> {selectedTrip.inspectionDone ? 'Armada Dicek' : 'Cek Armada'} <ChevronRight size={18}/></button>
                  <button type="button" className="akk-crew-v64-action" onClick={() => goToReport('bbm')}><Fuel size={20}/> Isi BBM <ChevronRight size={18}/></button>
                  <button type="button" className="akk-crew-v64-action" onClick={() => goToReport('kendala')}><MapPin size={20}/> Lapor Kendala <ChevronRight size={18}/></button>
                </> : <>
                  <button type="button" className="akk-crew-v64-action" onClick={() => { updateTrip(selectedTrip.id, t => ({ ...t, waybillValidated: true })); setNotice('Surat jalan tervalidasi untuk simulasi.'); }}><ClipboardCheck size={20}/> {selectedTrip.waybillValidated ? 'SJ Tervalidasi' : 'Validasi Surat Jalan'} <ChevronRight size={18}/></button>
                  <button type="button" className="akk-crew-v64-action" onClick={() => goToReport('toko')}><MapPin size={20}/> Absen Toko <ChevronRight size={18}/></button>
                  <button type="button" className="akk-crew-v64-action" onClick={() => goToReport('retur')}><PackageX size={20}/> Retur Barang <ChevronRight size={18}/></button>
                  <button type="button" className="akk-crew-v64-action" onClick={() => goToReport('form_kirim')}><FileText size={20}/> Form Kirim <ChevronRight size={18}/></button>
                  <button type="button" className="akk-crew-v64-action" onClick={() => goToReport('kendala')}><MapPin size={20}/> Lapor Kendala <ChevronRight size={18}/></button>
                </>}
              </section>
              {(selectedTrip.reports || []).length > 0 && <section className="akk-crew-v64-section"><h2>Aktivitas</h2>{[...(selectedTrip.reports || [])].reverse().slice(0,6).map(r => <div className="akk-crew-v64-reportrow" key={r.id}><CheckCircle2 size={17}/><div><strong>{REPORT_LABELS[r.type] || r.type}</strong><span>{r.by}</span></div></div>)}</section>}
            </>}
          </>}
          {view === 'laporan' && <>
            <div className="akk-crew-v64-heading"><h1>Laporan</h1><p>{myRole ? `Tugas ${currentLabel}` : 'Ambil kiriman dahulu'}</p></div>
            {!selectedTrip || !myRole ? <div className="akk-crew-v64-empty"><span><FileText size={24}/></span><h2>Belum ada tugas</h2><p>Ambil satu kiriman untuk mengisi laporan.</p><button className="akk-crew-v64-mainbtn" type="button" onClick={() => setView('kiriman')}>Lihat Kiriman</button></div> : reportKind ?
              <form className="akk-crew-v64-section akk-crew-v64-reportform" onSubmit={saveReport}><button type="button" className="akk-crew-v64-back" onClick={() => setReportKind(null)}><ArrowLeft size={17}/> Kembali</button><h2>{REPORT_LABELS[reportKind]}</h2><p>{selectedTrip.area}</p><label className="akk-crew-v64-field"><span>Keterangan</span><textarea required minLength={3} rows={4} value={reportNote} onChange={e => setReportNote(e.target.value)} placeholder="Tulis informasi singkat..." /></label><button type="submit" className="akk-crew-v64-mainbtn"><Send size={18}/> Simpan Laporan</button><small className="akk-crew-v64-mutedsmall">Mode uji · Tidak dikirim ke operasional atau GPS.</small></form> :
              <div className="akk-crew-v64-section"><h2>Pilih laporan</h2>{(myRole === 'driver' ? DRIVER_REPORTS : HELPER_REPORTS).map(kind => <button type="button" className="akk-crew-v64-action" key={kind} onClick={() => goToReport(kind)}><FileText size={19}/>{REPORT_LABELS[kind]}<ChevronRight size={18}/></button>)}</div>}
          </>}
        </main>
        <nav className="akk-crew-v64-nav" aria-label="Menu pengiriman">
          {([{ id: 'kiriman', label: 'Kiriman', Icon: Truck }, { id: 'tugas', label: 'Tugas', Icon: ClipboardCheck }, { id: 'laporan', label: 'Laporan', Icon: FileText }] as const).map(({id,label,Icon}) =>
            <button key={id} type="button" className={view === id ? 'active' : ''} onClick={() => { setView(id); setReportKind(null); clearNotices(); }} aria-current={view === id ? 'page' : undefined}><Icon size={21}/><span>{label}</span></button>
          )}
        </nav>
      </div>
      {claimTarget && <div className="akk-crew-v64-shade" onMouseDown={e => { if (e.target === e.currentTarget) setClaimTarget(null); }}><section className="akk-crew-v64-sheet" role="dialog" aria-modal="true" aria-label="Pilih tugas kiriman"><div className="akk-crew-v64-sheet-head"><h2>Pilih tugas</h2><button type="button" aria-label="Tutup" onClick={() => setClaimTarget(null)}><X size={21}/></button></div><p>Pilih posisi yang masih kosong.</p>
        {error && <p className="akk-crew-v64-feedback fail" role="alert">{error}</p>}
        {(() => { const trip = allowedTrips.find(t => t.id === claimTarget); return trip ? <div className="akk-crew-v64-slotgrid">{(['driver','helper'] as const).map(slot => <button key={slot} type="button" disabled={Boolean(trip[slot])} className="akk-crew-v64-slotbutton" onClick={() => claim(trip.id, slot)}><span>{slot === 'driver' ? <Truck size={21}/> : <Users size={21}/>}</span><strong>{slot === 'driver' ? 'Driver' : 'Helper'}</strong><small>{trip[slot] ? 'Sudah diambil' : 'Ambil posisi'}</small></button>)}</div> : null; })()}
        <button className="akk-crew-v64-cancel" type="button" onClick={() => setClaimTarget(null)}>Batal</button>
      </section></div>}
      {accountOpen && <div className="akk-crew-v64-shade" onMouseDown={e => { if (e.target === e.currentTarget) setAccountOpen(false); }}><section className="akk-crew-v64-sheet" role="dialog" aria-modal="true" aria-label="Akun"><div className="akk-crew-v64-sheet-head"><h2>Akun</h2><button type="button" aria-label="Tutup" onClick={() => setAccountOpen(false)}><X size={21}/></button></div><p className="akk-crew-v64-accountname">{accountName}</p><p>Ini akun uji. Tugas mengikuti slot yang diambil, bukan role saat login.</p><button type="button" className="akk-crew-v64-logout" onClick={() => logisticsStore.logoutUser()}><LogOut size={18}/> Keluar Akun</button></section></div>}
    </div>, document.body
  );
};

export default CrewTestWorkspace;
