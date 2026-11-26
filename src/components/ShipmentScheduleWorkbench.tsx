import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, Clock3, Plus, ShieldCheck, Trash2, Users, X } from 'lucide-react';
import { logisticsStore } from '../services/store';
import { branchStore } from '../services/branchStore';
import { canEdit } from '../utils/rbac';
import type { Crew, Schedule, UserProfile } from '../types';
import { getAuthHeaders } from './crew/crewModel';
import { notifyCrewChanged } from './crew/crewApi';

const QA_EVENT = 'akk-qa-kiriman-updated';
const CUSTOM_AREA_VALUE = '__manual__';
const SCHEDULE_AREA_LIST = [
  'Denpasar 1',
  'Denpasar 2',
  'Singaraja',
  'Negara',
  'Galekan Retail',
  'Sumberayu Retail',
  'Susulan Sanggar Jajag',
  'Jember Selatan',
  'Grosir Banyuwangi Rogojampi',
  'Muncar Pasar',
  'Muncar Pinggir',
  'Rogojampi Retail',
  'Genteng Retail',
  'Jember Barat',
  'Bwi Kota Selatan',
  'Grosir Songgon Genteng',
  'Songgon Retail',
  'Susulan Situbondo Bondowoso',
  'Kalibaru Retail',
  'Ketapang Wongsorejo',
  'Grosir Srono Sumberayu Muncar',
  'Susulan Rogojampi Muncar',
  'Sanggar Retail',
  'Sempu Kalistail',
  'Purwo Pasar',
  'Purwo Dambuntung',
  'Srono Retail',
  'Grosir Jajag Sanggar Purwo',
  'Jember Kota',
  'Jajag Retail',
  'Susulan Genteng Rogojampi',
  'Situbondo',
  'Bondowoso',
  'Toko Dr. Sutomo',
  'NX',
  'Titipan Kota-kota'
] as const;

type QaTrip = {id:string;branchId:string;area:string;fleetLabel:string;date:string;departureTime:string;
  driver:{id:string;name:string}|null;helper:{id:string;name:string}|null;createdAt:string};
const todayJakarta = (): string => new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Jakarta' });

const fieldClass = 'w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-[15px] font-medium text-slate-900 outline-none transition focus:border-blue-600 focus:ring-2 focus:ring-blue-600/15 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100';
const labelClass = 'mb-1.5 block text-[13px] font-semibold text-slate-700 dark:text-slate-300';
const buttonClass = 'inline-flex min-h-11 items-center justify-center gap-2 rounded-[10px] bg-blue-600 px-5 text-sm font-bold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer';
const HOURS_24 = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'));
const MINUTES_60 = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, '0'));

const Time24Field: React.FC<{ label: string; value: string; onChange: (next: string) => void }> = ({ label, value, onChange }) => {
  const [rawH = '07', rawM = '30'] = (value || '07:30').split(':');
  const hour = HOURS_24.includes(rawH) ? rawH : '07';
  const minute = MINUTES_60.includes(rawM) ? rawM : '00';
  return (
    <div className="block">
      <span className={labelClass}>{label} <span className="font-normal text-slate-500 dark:text-slate-400">(24 jam)</span></span>
      <div className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-[15px] font-semibold text-slate-900 transition focus-within:border-blue-600 focus-within:ring-2 focus-within:ring-blue-600/15 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100">
        <select
          aria-label={`Jam ${label}`}
          value={hour}
          onChange={e => onChange(`${e.target.value}:${minute}`)}
          className="flex-1 bg-transparent py-1 text-center text-[15px] font-bold tabular-nums text-slate-900 outline-none dark:bg-slate-900 dark:text-white"
        >
          {HOURS_24.map(h => <option key={h} value={h}>{h}</option>)}
        </select>
        <span className="text-base font-bold text-slate-400">:</span>
        <select
          aria-label={`Menit ${label}`}
          value={minute}
          onChange={e => onChange(`${hour}:${e.target.value}`)}
          className="flex-1 bg-transparent py-1 text-center text-[15px] font-bold tabular-nums text-slate-900 outline-none dark:bg-slate-900 dark:text-white"
        >
          {MINUTES_60.map(m => <option key={m} value={m}>{m}</option>)}
        </select>
        <span className="text-xs font-bold text-slate-500">WIB</span>
        <Clock3 size={16} className="shrink-0 text-slate-400" />
      </div>
    </div>
  );
};

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
  const [departureDate, setDepartureDate] = useState(todayJakarta);
  const [returnDate, setReturnDate] = useState(todayJakarta);
  const [departureDateEdited, setDepartureDateEdited] = useState(false);
  const [returnDateEdited, setReturnDateEdited] = useState(false);
  const [departureTime, setDepartureTime] = useState('07:30');
  const [returnTime, setReturnTime] = useState('17:00');
  const [areaSelect, setAreaSelect] = useState('');
  const [customArea, setCustomArea] = useState('');
  const [branchId, setBranchId] = useState('');
  const [fleetId, setFleetId] = useState('');
  const [driverId, setDriverId] = useState('');
  const [helperId, setHelperId] = useState('');
  const [qaTrips, setQaTrips] = useState<QaTrip[]>([]);
  const [confirmDeleteQaId, setConfirmDeleteQaId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [storeTick, setStoreTick] = useState(0);

  useEffect(() => {
    const bump = () => setStoreTick(v => v + 1);
    const unsubLogistics = logisticsStore.subscribe(bump);
    const unsubBranch = branchStore.subscribe(bump);
    return () => {
      unsubLogistics();
      unsubBranch();
    };
  }, []);

  const branches = useMemo(
    () => branchStore.getActiveBranches().filter(b => branchStore.canUserAccessBranch(user, b.id)),
    [user, storeTick]
  );
  const selectedOriginBranchId = branchStore.getSelectedOriginBranchId();
  const defaultBranchId =
    (selectedOriginBranchId && selectedOriginBranchId !== 'ALL' && branches.some(b => b.id === selectedOriginBranchId)
      ? selectedOriginBranchId
      : '') ||
    branches.find(b => b.id === 'cab-banyuwangi')?.id ||
    branches[0]?.id ||
    '';
  const effectiveBranchId = branches.some(b => b.id === branchId) ? branchId : defaultBranchId;

  const fleets = useMemo(() => {
    const duplicateIds = new Set(
      logisticsStore
        .findDuplicateFleetGroups()
        .flatMap(group => group.duplicates.map(dup => dup.id))
    );
    const allDataArmadaFleets = logisticsStore
      .getFleets()
      .filter(f => f && f.id && f.plateNumber && !duplicateIds.has(f.id));
    if (!effectiveBranchId) return allDataArmadaFleets;
    const branchMatched = allDataArmadaFleets.filter(
      f => branchStore.getFleetBranchId(f.id, f.plateNumber, f.initialCode, f.branchId) === effectiveBranchId
    );
    return branchMatched.length > 0 ? branchMatched : allDataArmadaFleets;
  }, [effectiveBranchId, storeTick]);

  const crews = useMemo(() => {
    const byId = new Map<string, Crew>();
    const allById = new Map<string, Crew>();
    const allUsers = logisticsStore.getUsers();
    [...logisticsStore.getDriverCrews(), ...logisticsStore.getHelperCrews(), ...logisticsStore.getCrews()].forEach(c => {
      allById.set(c.id, c);
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
    const source = byId.size > 0 ? Array.from(byId.values()) : Array.from(allById.values());
    return source.sort((a, b) => a.name.localeCompare(b.name));
  }, [effectiveBranchId, storeTick]);

  useEffect(() => {
    if (!active) setOpen(false);
  }, [active]);
  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(''), 2500);
    return () => clearTimeout(timer);
  }, [notice]);
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

  const start = (preferredBranchId?: string) => {
    setError('');
    setNotice('');
    setConfirmDeleteQaId(null);
    if (preferredBranchId && branches.some(b => b.id === preferredBranchId)) {
      setBranchId(preferredBranchId);
    }
    void logisticsStore.hydrateOperationalDataFromHostinger();
    void branchStore.syncFromServer();
    setOpen(true);
  };

  useEffect(() => {
    if (!active) return;
    const handleOpen = (event: Event) => {
      const detail = (event as CustomEvent<{ branchId?: string }>).detail;
      start(detail?.branchId);
    };
    window.addEventListener('akk-open-create-shipment', handleOpen);
    return () => window.removeEventListener('akk-open-create-shipment', handleOpen);
  }, [active, branches]);

  const handleDeliveryDateChange = (nextDate: string) => {
    setDate(nextDate);
    if (!departureDateEdited) setDepartureDate(nextDate);
    if (!returnDateEdited) setReturnDate(nextDate);
  };

  const effectiveArea = (areaSelect === CUSTOM_AREA_VALUE ? customArea : areaSelect).trim();

  const addQaTrip = async () => {
    const label = fleets.find(f => f.id === fleetId);
    const branch = branches.find(b => b.id === effectiveBranchId);
    setBusy(true);
    try {
      const response = await fetch('/api/crew-qa/trips', {
        method: 'POST', credentials: 'same-origin',
        headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ branchId: branch?.id || effectiveBranchId, date, area: effectiveArea,
          fleetLabel: label?.initialCode || label?.plateNumber || 'Armada Uji', departureTime })
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || !result?.success) throw new Error(result?.error || 'Gagal membuat jadwal uji.');
      setNotice('Kiriman uji berhasil dibuat. Dapat diuji dari dua HP atau browser berbeda.');
      setAreaSelect(''); setCustomArea('');
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
    if (!effectiveArea || effectiveArea.length < 2) return setError('Pilih atau isi area tujuan terlebih dahulu.');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return setError('Pilih tanggal kirim yang benar.');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(departureDate) || !/^\d{4}-\d{2}-\d{2}$/.test(returnDate)) {
      return setError('Pilih tanggal berangkat dan tanggal pulang yang benar.');
    }
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

    const starts = new Date(`${departureDate}T${departureTime}:00+07:00`);
    const ends = new Date(`${returnDate}T${returnTime}:00+07:00`);
    if (Number.isNaN(starts.getTime()) || Number.isNaN(ends.getTime())) return setError('Tanggal atau jam tidak valid.');
    if (ends.getTime() <= starts.getTime()) return setError('Tanggal & jam pulang harus lebih akhir dari berangkat.');

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
      storeId: `area-${effectiveArea.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
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
      returnDate,
      departureTime,
      targetReturnTime: returnTime,
      areaName: effectiveArea,
      cargoDescription: `Pengiriman area ${effectiveArea}`,
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
      notifyCrewChanged();
      setNotice(`Kiriman ${created.trackingNumber} (${fleet.plateNumber}${fleet.initialCode ? ` / ${fleet.initialCode}` : ''}) diterbitkan & tersinkron ke Laporan Check-In/Out, Riwayat Kru Pengiriman, dan Data Armada.`);
      setOpen(false);
      setAreaSelect(''); setCustomArea(''); setDriverId(''); setHelperId('');
      setDepartureDateEdited(false); setReturnDateEdited(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal menerbitkan kiriman.');
    } finally { setBusy(false); }
  };

  const removeQa = async (id: string) => {
    try {
      const response = await fetch(`/api/crew-qa/trips/${encodeURIComponent(id)}`, {
        method: 'DELETE', credentials: 'same-origin', headers: getAuthHeaders()
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || !result?.success) throw new Error(result?.error || 'Gagal menghapus jadwal.');
      setConfirmDeleteQaId(null);
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
      {testCreator && (
        <button type="button" onClick={() => start()} className="akk-ship-create-trigger akk-ship-qa-trigger">
          <Plus size={19} strokeWidth={2.5} /> Buat Jadwal Uji
        </button>
      )}
      {notice && !open && <div className={`akk-ship-notice ${!testCreator ? 'akk-ship-notice--inline' : ''}`} role="status"><Check size={15} /> {notice} <button type="button" onClick={() => setNotice('')} aria-label="Tutup pemberitahuan"><X size={15}/></button></div>}
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
                <label><span className={labelClass}>Tanggal kirim</span><input className={fieldClass} type="date" required value={date} onChange={e => handleDeliveryDateChange(e.target.value)}/></label>
                <div className="sm:col-span-2 space-y-2">
                  <label className="block">
                    <span className={labelClass}>Area tujuan</span>
                    <select className={fieldClass} value={areaSelect} onChange={e => setAreaSelect(e.target.value)} required={areaSelect !== CUSTOM_AREA_VALUE}>
                      <option value="">Pilih area tujuan</option>
                      {SCHEDULE_AREA_LIST.map(item => <option key={item} value={item}>{item}</option>)}
                      <option value={CUSTOM_AREA_VALUE}>Area lainnya (ketik manual)...</option>
                    </select>
                  </label>
                  {areaSelect === CUSTOM_AREA_VALUE && (
                    <input className={fieldClass} required minLength={2} maxLength={100} value={customArea} onChange={e => setCustomArea(e.target.value)} placeholder="Tulis nama area tujuan"/>
                  )}
                </div>
                <div className="sm:col-span-2">
                  {picker(
                    'Armada',
                    fleetId,
                    setFleetId,
                    fleets.map(f => {
                      const live = logisticsStore.getFleetLiveOperationalInfo(f, departureDate);
                      const statusTag =
                        live.effectiveStatus === 'maintenance'
                          ? 'Servis'
                          : live.statusLabel === 'Terjadwal' || live.statusLabel === 'Kirim'
                          ? `${live.statusLabel}${live.areaName ? ` • ${live.areaName}` : ''}`
                          : 'Ready';
                      return {
                        value: f.id,
                        label: `${f.plateNumber}${f.initialCode ? ` (${f.initialCode})` : ''}${f.vehicleType ? ` — ${f.vehicleType}` : ''} [${statusTag}]`
                      };
                    }),
                    !testCreator
                  )}
                </div>
                <label><span className={labelClass}>Tanggal berangkat</span><input className={fieldClass} type="date" required value={departureDate} onChange={e => { setDepartureDateEdited(true); setDepartureDate(e.target.value); }}/></label>
                <Time24Field label="Target Berangkat" value={departureTime} onChange={setDepartureTime} />
                <label><span className={labelClass}>Tanggal pulang</span><input className={fieldClass} type="date" required value={returnDate} onChange={e => { setReturnDateEdited(true); setReturnDate(e.target.value); }}/></label>
                <Time24Field label="Target Pulang" value={returnTime} onChange={setReturnTime} />
                {!testCreator && <div className="sm:col-span-2 akk-ship-crew-picker">
                  <strong className="flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-white"><Users size={18} className="text-blue-600"/> Slot kru <span className="text-xs font-normal text-slate-500 dark:text-slate-400">(boleh kosong)</span></strong>
                  <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                    {picker(
                      'Driver',
                      driverId,
                      setDriverId,
                      [...crews]
                        .filter(c => c.id !== helperId)
                        .sort((a, b) => {
                          const aDriver = !String(a.role || '').toLowerCase().includes('helper');
                          const bDriver = !String(b.role || '').toLowerCase().includes('helper');
                          if (aDriver !== bDriver) return aDriver ? -1 : 1;
                          return a.name.localeCompare(b.name, 'id');
                        })
                        .map(c => ({
                          value: c.id,
                          label: `${c.name} (${String(c.role || '').toLowerCase().includes('helper') ? 'Helper' : 'Driver'})`
                        }))
                    )}
                    {picker(
                      'Helper',
                      helperId,
                      setHelperId,
                      [...crews]
                        .filter(c => c.id !== driverId)
                        .sort((a, b) => {
                          const aHelper = String(a.role || '').toLowerCase().includes('helper');
                          const bHelper = String(b.role || '').toLowerCase().includes('helper');
                          if (aHelper !== bHelper) return aHelper ? -1 : 1;
                          return a.name.localeCompare(b.name, 'id');
                        })
                        .map(c => ({
                          value: c.id,
                          label: `${c.name} (${String(c.role || '').toLowerCase().includes('helper') ? 'Helper' : 'Driver'})`
                        }))
                    )}
                  </div>
                  <p className="mt-2.5 text-[13px] leading-relaxed text-slate-600 dark:text-slate-400">Boleh dikosongkan. Jadwal terbit otomatis menjadi sumber target jam berangkat/pulang &amp; nomor kendaraan di Laporan Check-In/Out serta Riwayat Kru Pengiriman.</p>
                </div>}
                {!testCreator && (effectiveArea || fleetId) && (() => {
                  const selFleet = fleets.find(f => f.id === fleetId);
                  const selDriver = crews.find(c => c.id === driverId);
                  const selHelper = crews.find(c => c.id === helperId);
                  return (
                    <div className="sm:col-span-2 rounded-xl border border-blue-200 bg-blue-50/70 px-4 py-3 text-sm text-slate-800 dark:border-blue-500/30 dark:bg-blue-500/10 dark:text-slate-200">
                      <div className="font-bold text-blue-700 dark:text-blue-300 text-xs uppercase tracking-wider mb-1">
                        Ringkasan Target Kiriman Terintegrasi
                      </div>
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[13.5px]">
                        <span><strong className="text-slate-900 dark:text-white">{effectiveArea || 'Area belum dipilih'}</strong></span>
                        <span className="text-slate-400">•</span>
                        <span className="font-mono font-bold text-slate-900 dark:text-white">
                          {selFleet ? `${selFleet.plateNumber}${selFleet.initialCode ? ` (${selFleet.initialCode})` : ''}` : 'Armada belum dipilih'}
                        </span>
                        <span className="text-slate-400">•</span>
                        <span className="font-mono font-semibold text-blue-700 dark:text-blue-300">
                          {departureDate} ({departureTime}–{returnTime} WIB)
                        </span>
                        {(selDriver || selHelper) && (
                          <>
                            <span className="text-slate-400">•</span>
                            <span className="font-semibold">
                              {[selDriver ? `Driver: ${selDriver.name}` : null, selHelper ? `Helper: ${selHelper.name}` : null].filter(Boolean).join(' · ')}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })()}
              </form>
              {error && <p role="alert" className="akk-ship-error">{error}</p>}
              {testCreator && <div className="akk-ship-test-list">
                <h3>Jadwal Percobaan</h3>
                {scopedQa.length === 0 && <p className="text-xs text-slate-500">Belum ada kiriman percobaan.</p>}
                {scopedQa.map(t => (
                  <article key={t.id} className="akk-ship-test-card">
                    <div className="flex items-center justify-between gap-2">
                      <strong className="text-sm">{t.area}</strong>
                      {confirmDeleteQaId === t.id ? (
                        <div className="flex items-center gap-1.5">
                          <button type="button" onClick={() => void removeQa(t.id)} className="rounded-md bg-rose-600 px-2 py-0.5 text-xs font-bold text-white">Hapus</button>
                          <button type="button" onClick={() => setConfirmDeleteQaId(null)} className="rounded-md bg-slate-200 px-2 py-0.5 text-xs font-semibold text-slate-700">Batal</button>
                        </div>
                      ) : (
                        <button type="button" onClick={() => setConfirmDeleteQaId(t.id)} aria-label="Hapus jadwal uji" className="text-slate-400 hover:text-red-600"><Trash2 size={15}/></button>
                      )}
                    </div>
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
