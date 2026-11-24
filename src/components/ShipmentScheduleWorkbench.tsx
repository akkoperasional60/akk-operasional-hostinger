import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, Plus, ShieldCheck, Trash2, Users, X } from 'lucide-react';
import { logisticsStore } from '../services/store';
import { branchStore } from '../services/branchStore';
import { canEdit } from '../utils/rbac';
import type { Crew, Schedule, UserProfile } from '../types';
import { getAuthHeaders } from './crew/crewModel';

const QA_EVENT = 'akk-qa-kiriman-updated';
type QaTrip = {id:string;branchId:string;area:string;fleetLabel:string;date:string;departureTime:string;
  driver:{id:string;name:string}|null;helper:{id:string;name:string}|null;createdAt:string};
const todayJakarta = (): string => new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Jakarta' });

const fieldClass = 'w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm font-medium text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100 dark:border-slate-700 dark:bg-slate-900 dark:text-white dark:focus:ring-blue-900';
const labelClass = 'mb-1.5 block text-xs font-semibold text-slate-600 dark:text-slate-300';
const buttonClass = 'inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 text-sm font-bold text-white transition hover:bg-blue-700 active:scale-[.98] disabled:cursor-not-allowed disabled:opacity-50';

interface Props {
  activeTab: string;
  user: UserProfile;
}

/**
 * Add-on inside the EXISTING AKK navigation, not a new portal. Real schedules
 * follow normal logisticsStore persistence; QA schedules are browser-only.
 */
export const ShipmentScheduleWorkbench: React.FC<Props> = ({ activeTab, user }) => {
  const realCreator = activeTab === 'schedules' && user.status === 'approved' && canEdit(user, 'schedules');
  const testCreator = activeTab === 'e2e_testing' && user.status === 'approved' && user.role === 'super_admin';
  const active = realCreator || testCreator;
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState(todayJakarta);
  const [departureTime, setDepartureTime] = useState('07:30');
  const [returnTime, setReturnTime] = useState('17:00');
  const [area, setArea] = useState('');
  const [branchId, setBranchId] = useState('');
  const [fleetId, setFleetId] = useState('');
  const [driverId, setDriverId] = useState('');
  const [helperId, setHelperId] = useState('');
  const [qaTrips, setQaTrips] = useState<QaTrip[]>([]);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');

  const branches = useMemo(() => branchStore.getActiveBranches().filter(b => branchStore.canUserAccessBranch(user, b.id)), [user]);
  const effectiveBranchId = branches.some(b => b.id === branchId) ? branchId : branches[0]?.id || '';
  const fleets = useMemo(() => logisticsStore.getFleets().filter(f =>
    effectiveBranchId && branchStore.getFleetBranchId(f.id, f.plateNumber, f.initialCode, f.branchId) === effectiveBranchId
  ), [effectiveBranchId]);
  const crews = useMemo(() => {
    const byId = new Map<string, Crew>();
    const allUsers = logisticsStore.getUsers();
    [...logisticsStore.getDriverCrews(), ...logisticsStore.getHelperCrews(), ...logisticsStore.getCrews()].forEach(c => {
      // Do not use getCrewBranchId's default-Banyuwangi fallback to classify unknown crews.
      const account = allUsers.find(u => u.id === c.id || `crw-${u.id}` === c.id || u.fullName.trim().toLowerCase() === c.name.trim().toLowerCase());
      let strictBranchId = c.branchId || '';
      if (!strictBranchId && account) {
        const permissions = branchStore.getUserBranchPermissions(
          account.id, account.role, account.permissions?.modules, account.permissions?.branchPermissions
        );
        const enabled = Object.values(permissions).filter(entry => entry.enabled);
        if (enabled.length === 1) strictBranchId = enabled[0].branchId;
      }
      if (strictBranchId && strictBranchId === effectiveBranchId) byId.set(c.id, c);
    });
    return Array.from(byId.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [effectiveBranchId]);

  useEffect(() => {
    if (!active) setOpen(false);
  }, [active]);
  const loadQaTrips = async () => {
    if (!testCreator) return;
    try {
      const response = await fetch('/api/crew-qa/trips', {
        headers: getAuthHeaders(), credentials: 'same-origin', cache: 'no-store'
      });
      if (!response.ok) return;
      const result = await response.json();
      if (result?.success && Array.isArray(result.trips)) setQaTrips(result.trips);
    } catch { /* keep last server-confirmed list */ }
  };
  useEffect(() => {
    if (!testCreator) return;
    void loadQaTrips();
    const refresh = () => void loadQaTrips();
    window.addEventListener(QA_EVENT, refresh);
    const timer = window.setInterval(refresh, 5000);
    return () => { window.removeEventListener(QA_EVENT, refresh); clearInterval(timer); };
  }, [testCreator]);
  useEffect(() => { setFleetId(''); setDriverId(''); setHelperId(''); }, [effectiveBranchId]);

  const start = () => {
    setError('');
    setNotice('');
    setOpen(true);
  };

  const addQaTrip = async () => {
    const label = fleets.find(f => f.id === fleetId);
    const branch = branches.find(b => b.id === effectiveBranchId);
    setBusy(true);
    try {
      const response = await fetch('/api/crew-qa/trips', {
        method: 'POST', credentials: 'same-origin',
        headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ branchId: branch?.id || effectiveBranchId, date, area: area.trim(),
          fleetLabel: label?.initialCode || label?.plateNumber || 'Armada Uji', departureTime })
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || !result?.success) throw new Error(result?.error || 'Gagal membuat jadwal uji.');
      setNotice('Kiriman uji berhasil dibuat. Dapat diuji dari dua HP atau browser berbeda.');
      setArea('');
      await loadQaTrips();
      window.dispatchEvent(new Event(QA_EVENT));
    } catch (e) { setError(e instanceof Error ? e.message : 'Gagal menyimpan jadwal uji.'); }
    finally { setBusy(false); }
  };

  const create = async (event: React.FormEvent) => {
    event.preventDefault();
    if (busy) return;
    setError(''); setNotice('');
    if (!effectiveBranchId || !branchStore.canUserAccessBranch(user, effectiveBranchId)) return setError('Cabang tidak tersedia untuk akun ini.');
    if (!area.trim() || area.trim().length < 3) return setError('Isi area tujuan minimal 3 huruf.');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return setError('Pilih tanggal kirim yang benar.');
    if (!/^\d{2}:\d{2}$/.test(departureTime) || !/^\d{2}:\d{2}$/.test(returnTime)) return setError('Isi jam keberangkatan dan perkiraan pulang.');
    if (testCreator) { await addQaTrip(); return; }
    const fleet = fleets.find(f => f.id === fleetId);
    if (!fleet) return setError('Pilih armada dari cabang yang benar.');
    if (driverId && helperId && driverId === helperId) return setError('Satu orang tidak boleh mengisi dua slot di kiriman yang sama.');
    if (!canEdit(user, 'schedules', undefined, effectiveBranchId)) return setError('Akun tidak punya izin membuat jadwal pada cabang ini.');

    // Do not silently assign a driver or helper. Blank ID means genuinely unfilled.
    const driver = driverId ? crews.find(c => c.id === driverId) : undefined;
    const helper = helperId ? crews.find(c => c.id === helperId) : undefined;
    if (driverId && !driver) return setError('Driver bukan kru cabang aktif.');
    if (helperId && !helper) return setError('Helper bukan kru cabang aktif.');

    const starts = new Date(`${date}T${departureTime}:00+07:00`);
    const ends = new Date(`${date}T${returnTime}:00+07:00`);
    if (Number.isNaN(starts.getTime()) || Number.isNaN(ends.getTime())) return setError('Tanggal atau jam tidak valid.');
    if (ends.getTime() <= starts.getTime()) ends.setTime(ends.getTime() + 24 * 60 * 60 * 1000);

    // Prevent assigning the same fleet twice in overlapping time windows.
    const fleetConflict = logisticsStore.getSchedules().some(s => {
      if (s.fleetId !== fleet.id || s.status === 'delivered') return false;
      const existingStart = Date.parse(s.departureDate);
      const existingEnd = Date.parse(s.estimatedArrival);
      return Number.isFinite(existingStart) && Number.isFinite(existingEnd) && starts.getTime() < existingEnd && ends.getTime() > existingStart;
    });
    if (fleetConflict) return setError('Armada sudah punya jadwal pada waktu tersebut. Pilih armada atau jam lain.');
    // An explicitly selected crew member cannot be booked on an overlapping trip.
    const crewConflict = logisticsStore.getSchedules().some(s => {
      if (s.status === 'delivered' || (!driver?.id && !helper?.id)) return false;
      const occupied = [s.crewId, s.crewHelperId, s.crewHelper2Id].filter(Boolean);
      if (!(driver?.id && occupied.includes(driver.id)) && !(helper?.id && occupied.includes(helper.id))) return false;
      const a = Date.parse(s.departureDate); const b = Date.parse(s.estimatedArrival);
      return Number.isFinite(a) && Number.isFinite(b) && starts.getTime() < b && ends.getTime() > a;
    });
    if (crewConflict) return setError('Kru yang dipilih sudah bertugas pada jam tersebut. Kosongkan slot atau pilih kru lain.');

    const branch = branches.find(b => b.id === effectiveBranchId)!;
    const isSda = effectiveBranchId === 'cab-sidoarjo';
    const originCoords: [number, number] = isSda ? [-7.4478, 112.7183] : [-8.1906, 114.3708];
    const now = new Date().toISOString();
    const scheduleInput: Omit<Schedule, 'id' | 'createdAt'> & { branchId: string } = {
      trackingNumber: `PO-AKK-${date.replace(/-/g, '')}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
      originName: branch.warehouseName || `Gudang ${branch.name}`,
      originCoords,
      storeId: `area-${area.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
      fleetId: fleet.id,
      fleet,
      armada: fleet.initialCode || fleet.plateNumber,
      crewId: driver?.id || '',
      crew: driver,
      crewHelperId: helper?.id || undefined,
      crewHelper: helper,
      status: 'scheduled',
      departureDate: starts.toISOString(),
      estimatedArrival: ends.toISOString(),
      deliveryDate: date,
      returnDate: ends.toLocaleDateString('sv-SE', { timeZone: 'Asia/Jakarta' }),
      departureTime,
      targetReturnTime: returnTime,
      areaName: area.trim(),
      cargoDescription: `Pengiriman area ${area.trim()}`,
      cargoWeightTon: 0,
      isInterIsland: false,
      notes: driver || helper ? 'Jadwal terbit, slot kru lain menunggu.' : 'Jadwal terbit, menunggu Driver dan Helper.',
      updatedAt: now,
      isManuallyEdited: true,
      branchId: effectiveBranchId
    };
    setBusy(true);
    try {
      const created = logisticsStore.addSchedule(scheduleInput);
      if (!created?.id || created.id === 'sch-readonly-blocked') throw new Error('Tidak punya izin menyimpan jadwal.');
      branchStore.setScheduleBranchId(created.id, effectiveBranchId);
      window.dispatchEvent(new CustomEvent('akk-new-schedule-added', { detail: created }));
      setNotice(`Kiriman ${created.trackingNumber} dibuat. ${driver ? 'Driver terisi' : 'Driver kosong'}, ${helper ? 'Helper terisi' : 'Helper kosong'}. Cek kembali setelah refresh.`);
      setOpen(false);
      setArea(''); setDriverId(''); setHelperId('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal menerbitkan kiriman.');
    } finally { setBusy(false); }
  };

  const removeQa = async (id: string) => {
    if (!window.confirm('Hapus jadwal uji ini dari database percobaan?')) return;
    try {
      const response = await fetch(`/api/crew-qa/trips/${encodeURIComponent(id)}`, {
        method: 'DELETE', credentials: 'same-origin', headers: getAuthHeaders()
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || !result?.success) throw new Error(result?.error || 'Gagal menghapus jadwal.');
      await loadQaTrips();
      window.dispatchEvent(new Event(QA_EVENT));
    } catch (e) { setError(e instanceof Error ? e.message : 'Gagal menghapus jadwal.'); }
  };

  if (!active || typeof document === 'undefined') return null;
  const scopedQa = qaTrips.filter(t => branches.some(b => b.id === t.branchId));
  const picker = (name: string, value: string, onChange: (s: string) => void, options: Array<{ value: string; label: string }>, required = false) => (
    <label className="block" key={name}>
      <span className={labelClass}>{name}</span>
      <select className={fieldClass} value={value} onChange={e => onChange(e.target.value)} required={required}>
        <option value="">{required ? 'Pilih salah satu' : 'Belum ditentukan'}</option>
        {options.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
      </select>
    </label>
  );

  return createPortal(
    <>
      <button type="button" onClick={start} className={`akk-ship-create-trigger ${testCreator ? 'akk-ship-qa-trigger' : ''}`}>
        <Plus size={19} strokeWidth={2.5} /> {testCreator ? 'Buat Jadwal Uji' : 'Buat Kiriman'}
      </button>
      {notice && !open && <div className="akk-ship-notice" role="status"><Check size={15} /> {notice} <button type="button" onClick={() => setNotice('')} aria-label="Tutup pemberitahuan"><X size={15}/></button></div>}
      {open && (
        <div className="akk-ship-backdrop" role="presentation" onMouseDown={e => { if (e.target === e.currentTarget) setOpen(false); }}>
          <section className="akk-ship-dialog" role="dialog" aria-modal="true" aria-label={testCreator ? 'Buat jadwal uji' : 'Buat kiriman'}>
            <div className="akk-ship-dialog-head">
              <div><p className="akk-ship-kicker">{testCreator ? 'SIMULASI • BUKAN JADWAL NYATA' : 'PENGIRIMAN'}</p><h2>{testCreator ? 'Jadwal Uji' : 'Buat Kiriman'}</h2></div>
              <button type="button" className="akk-ship-close" onClick={() => setOpen(false)} aria-label="Tutup"><X size={20} /></button>
            </div>
            <div className="akk-ship-dialog-body">
              {testCreator && <div className="akk-ship-qa-warning"><ShieldCheck size={18}/> Data percobaan disimpan terpisah dan tersinkron antar-akun uji.</div>}
              <form id="akk-ship-create-form" onSubmit={create} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {picker('Cabang', effectiveBranchId, setBranchId, branches.map(b => ({ value: b.id, label: b.name })), true)}
                <label><span className={labelClass}>Tanggal kirim</span><input className={fieldClass} type="date" required value={date} onChange={e => setDate(e.target.value)}/></label>
                <label className="sm:col-span-2"><span className={labelClass}>Area tujuan</span><input className={fieldClass} required minLength={3} maxLength={100} value={area} onChange={e => setArea(e.target.value)} placeholder="Contoh: Rogojampi"/></label>
                {picker('Armada', fleetId, setFleetId, fleets.map(f => ({ value: f.id, label: `${f.initialCode ? `[${f.initialCode}] ` : ''}${f.plateNumber}` })), !testCreator)}
                <div className="grid grid-cols-2 gap-2">
                  <label><span className={labelClass}>Berangkat</span><input className={fieldClass} type="time" required value={departureTime} onChange={e => setDepartureTime(e.target.value)}/></label>
                  <label><span className={labelClass}>Pulang</span><input className={fieldClass} type="time" required value={returnTime} onChange={e => setReturnTime(e.target.value)}/></label>
                </div>
                {!testCreator && <div className="sm:col-span-2 akk-ship-crew-picker">
                  <strong className="flex items-center gap-2 text-sm"><Users size={18}/> Slot kru <span className="text-xs font-normal text-slate-500">(boleh kosong)</span></strong>
                  <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                    {picker('Driver', driverId, setDriverId, crews.filter(c => c.id !== helperId).map(c => ({ value: c.id, label: c.name })))}
                    {picker('Helper', helperId, setHelperId, crews.filter(c => c.id !== driverId).map(c => ({ value: c.id, label: c.name })))}
                  </div>
                  <p className="mt-2 text-xs text-slate-500">Kru bisa ditentukan kemudian. Tidak akan terisi otomatis.</p>
                </div>}
              </form>
              {error && <p role="alert" className="akk-ship-error">{error}</p>}
              {testCreator && <div className="akk-ship-test-list">
                <h3>Jadwal Percobaan</h3>
                {scopedQa.length === 0 && <p className="text-xs text-slate-500">Belum ada kiriman percobaan.</p>}
                {scopedQa.map(t => (
                  <article key={t.id} className="akk-ship-test-card">
                    <div className="flex items-center justify-between gap-2"><strong className="text-sm">{t.area}</strong><button type="button" onClick={() => removeQa(t.id)} aria-label="Hapus jadwal uji" className="text-slate-400 hover:text-red-600"><Trash2 size={15}/></button></div>
                    <p className="text-xs text-slate-500">{t.date} · {t.fleetLabel} · {t.departureTime}</p>
                    <div className="mt-2 grid grid-cols-2 gap-2">
                      {(['driver','helper'] as const).map(slot => <div key={slot} className="akk-ship-test-slot">
                        <span className="text-xs font-semibold">{slot === 'driver' ? 'Driver' : 'Helper'}</span>
                        <span className="text-xs">{t[slot]?.name || 'Belum diambil'}</span>
                      </div>)}
                    </div>
                  </article>
                ))}
              </div>}
            </div>
            <div className="akk-ship-dialog-footer"><button type="button" className="akk-ship-cancel" onClick={() => setOpen(false)}>Tutup</button><button type="submit" form="akk-ship-create-form" disabled={busy || branches.length === 0} className={buttonClass}>{busy ? 'Menyimpan...' : testCreator ? 'Buat Jadwal Uji' : 'Terbitkan Kiriman'}</button></div>
          </section>
        </div>
      )}
    </>,
    document.body
  );
};

export default ShipmentScheduleWorkbench;
