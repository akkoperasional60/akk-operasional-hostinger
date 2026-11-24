import React, { useEffect, useState } from 'react';
import {
  AlertCircle, ArrowRight, Check, CheckCircle2, ClipboardCheck, Copy,
  ExternalLink, Loader2, LockKeyhole, Play, RotateCcw, ShieldCheck,
  Trash2, Truck, Users, XCircle
} from 'lucide-react';
import { E2ETestRunner, type E2ESummary } from '../services/e2eTestRunner';
import { getDefaultPermissionsForRole } from '../utils/rbac';
import { logisticsStore } from '../services/store';
import type { NavTab } from './Sidebar';

interface E2ETesterModuleProps {
  onNavigate?: (tab: NavTab) => void;
}

type TestAccount = {
  id: string;
  email: string;
  password: string;
  name: string;
  role: 'driver' | 'crew_helper';
};
type TestSlot = 'driver' | 'helper';

const BRANCHES = [
  { value: 'cab-sidoarjo', label: 'Sidoarjo' },
  { value: 'cab-banyuwangi', label: 'Nusantara' }
] as const;

function makePassword(): string {
  const raw = new Uint8Array(20);
  window.crypto.getRandomValues(raw);
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%';
  return 'AkK!7' + Array.from(raw, byte => alphabet[byte % alphabet.length]).join('');
}

function makeRolePermissions(role: 'driver' | 'crew_helper', branchId: string) {
  const modules = getDefaultPermissionsForRole(role);
  const disabledBranch = branchId === 'cab-sidoarjo' ? 'cab-banyuwangi' : 'cab-sidoarjo';
  return {
    modules,
    branchPermissions: {
      [branchId]: {
        branchId, enabled: true, allAccess: false,
        modules: { logistics: modules.logistics }
      },
      [disabledBranch]: {
        branchId: disabledBranch, enabled: false, allAccess: false, modules: {}
      }
    }
  };
}

const credentialsText = (account: TestAccount): string =>
  `AKK ${account.role === 'driver' ? 'Driver' : 'Helper'} Uji\nEmail: ${account.email}\nPassword: ${account.password}\nLogin: ${window.location.origin}/portal-driver`;

export const E2ETesterModule: React.FC<E2ETesterModuleProps> = ({ onNavigate }) => {
  const [role, setRole] = useState<'driver' | 'helper'>('driver');
  const [slots, setSlots] = useState<{ driver: string; helper: string }>({ driver: '', helper: '' });
  const [claimOpen, setClaimOpen] = useState(false);
  const [branchId, setBranchId] = useState('cab-sidoarjo');
  const [accounts, setAccounts] = useState<TestAccount[]>([]);
  const [createBusy, setCreateBusy] = useState(false);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [showPasswords, setShowPasswords] = useState(true);
  const [notice, setNotice] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null);
  const [summary, setSummary] = useState<E2ESummary | null>(null);
  const [testBusy, setTestBusy] = useState(false);
  const [testProgress, setTestProgress] = useState('');
  const [currentUser, setCurrentUser] = useState(logisticsStore.getCurrentUser());

  useEffect(() => logisticsStore.subscribe(() => setCurrentUser(logisticsStore.getCurrentUser())), []);
  const isAdmin = currentUser?.role === 'super_admin' && currentUser.status === 'approved';
  const filled = Boolean(slots.driver && slots.helper);
  const mine = role === 'driver' ? 'Akun Driver Uji' : 'Akun Helper Uji';
  const assignedSlot: TestSlot | null = slots.driver === mine ? 'driver' : slots.helper === mine ? 'helper' : null;
  const taskSlot: TestSlot = assignedSlot || (role === 'driver' ? 'driver' : 'helper');
  const roleLabel = (slot: TestSlot) => slot === 'driver' ? 'Driver' : 'Helper';

  const copy = async (value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setNotice({ tone: 'ok', text: 'Berhasil disalin.' });
    } catch {
      setNotice({ tone: 'error', text: 'Salin manual melalui teks yang tampil di layar.' });
    }
  };

  const createTestAccounts = async () => {
    if (!isAdmin || createBusy) return;
    setCreateBusy(true);
    setNotice(null);
    const random = new Uint8Array(3);
    window.crypto.getRandomValues(random);
    const suffix = Date.now().toString(36) + Array.from(random, n => n.toString(16).padStart(2, '0')).join('');
    const created: TestAccount[] = [];
    try {
      for (const roleName of ['driver', 'crew_helper'] as const) {
        const isDriver = roleName === 'driver';
        const email = `akk-qa-${isDriver ? 'driver' : 'helper'}-${suffix}@example.com`;
        const password = makePassword();
        const name = `AKK UJI ${isDriver ? 'DRIVER' : 'HELPER'} ${suffix.slice(-6).toUpperCase()}`;
        const response = await fetch('/api/users', {
          method: 'POST',
          credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            fullName: name,
            email,
            password,
            role: roleName,
            department: 'Logistik',
            status: 'approved',
            permissions: makeRolePermissions(roleName, branchId),
            notes: 'AKK_QA_TEST_ACCOUNT - akun sementara untuk pengujian, bukan kru operasional'
          })
        });
        const json = await response.json().catch(() => ({}));
        if (!response.ok || !json.success || !json.user?.id) {
          throw new Error(json.error || `Gagal membuat akun ${isDriver ? 'Driver' : 'Helper'} (${response.status}).`);
        }
        const account: TestAccount = { id: String(json.user.id), email, password, name, role: roleName };
        created.push(account);
        setAccounts(prev => [...prev, account]);
      }
      setNotice({ tone: 'ok', text: 'Dua akun login asli berhasil dibuat. Salin data login sekarang; password tidak disimpan di halaman.' });
    } catch (error) {
      setNotice({ tone: 'error', text: `${(error as Error).message} ${created.length ? `${created.length} akun telah terbuat; jangan klik lagi sebelum diperiksa.` : ''}` });
    } finally {
      setCreateBusy(false);
    }
  };

  const deleteTestAccounts = async () => {
    if (!isAdmin || deleteBusy || accounts.length === 0) return;
    if (!window.confirm(`Hapus ${accounts.length} akun uji yang baru dibuat? Tindakan ini tidak bisa dibatalkan.`)) return;
    setDeleteBusy(true);
    let removed = 0;
    try {
      for (const account of accounts) {
        const response = await fetch(`/api/users/${encodeURIComponent(account.id)}`, { method: 'DELETE', credentials: 'same-origin' });
        if (!response.ok) throw new Error(`Gagal menghapus ${account.email}.`);
        removed += 1;
        setAccounts(prev => prev.filter(a => a.id !== account.id));
      }
      setNotice({ tone: 'ok', text: `${removed} akun uji berhasil dihapus.` });
    } catch (error) {
      setNotice({ tone: 'error', text: (error as Error).message });
    } finally {
      setDeleteBusy(false);
    }
  };

  const runDiagnostics = async () => {
    if (testBusy) return;
    setTestBusy(true);
    setTestProgress('Memeriksa sistem...');
    setSummary(null);
    try {
      setSummary(await E2ETestRunner.runAllTests((_percent, message) => setTestProgress(message)));
    } catch (error) {
      setNotice({ tone: 'error', text: `Pengujian gagal: ${(error as Error).message}` });
    } finally {
      setTestBusy(false);
      setTestProgress('');
    }
  };

  return (
    <div className="akk-crew-qa mx-auto w-full max-w-5xl p-4 sm:p-6 lg:p-8 space-y-5">
      <div className="space-y-1">
        <p className="akk-crew-eyebrow">PENGATURAN / UJI SISTEM</p>
        <h1 className="text-2xl font-extrabold tracking-tight">Coba Driver &amp; Helper</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">Tes tampilan dan login tanpa membuat portal baru.</p>
      </div>

      {/* This preview is intentionally in-memory. No schedule, GPS, or MySQL writes. */}
      <section className="akk-crew-panel space-y-4" aria-label="Simulasi tampilan Driver dan Helper">
        <div className="flex items-center justify-between gap-3">
          <h2 className="akk-crew-panel-title">Contoh tampilan</h2>
          <span className="akk-crew-label">SIMULASI • TANPA SIMPAN</span>
        </div>
        <div className="akk-crew-switch" role="group" aria-label="Pilih akun simulasi">
          <button type="button" className={role === 'driver' ? 'is-active' : ''} onClick={() => setRole('driver')}><Truck size={17} /> Akun Driver</button>
          <button type="button" className={role === 'helper' ? 'is-active' : ''} onClick={() => setRole('helper')}><Users size={17} /> Akun Helper</button>
        </div>
        <div className="akk-crew-demo-trip">
          <div className="flex items-center justify-between gap-2">
            <strong>Kiriman Contoh</strong>
            <span className={filled ? 'akk-crew-status good' : 'akk-crew-status'}>{filled ? 'Tim lengkap' : 'Menunggu kru'}</span>
          </div>
          <div className="text-sm text-slate-500 dark:text-slate-400">Gudang → Toko Contoh · Truk N-08</div>
          <div className="akk-crew-slots">
            <div><Truck size={17} /><strong>Driver</strong><span>{slots.driver || 'Belum diambil'}</span></div>
            <div><Users size={17} /><strong>Helper</strong><span>{slots.helper || 'Belum diambil'}</span></div>
          </div>
        </div>
        {!filled && !claimOpen && !assignedSlot && (
          <button type="button" className="akk-crew-primary" onClick={() => setClaimOpen(true)}>Ambil Kiriman <ArrowRight size={18} /></button>
        )}
        {!filled && claimOpen && !assignedSlot && (
          <div className="akk-crew-claim space-y-2">
            <strong className="text-sm">Pilih tugas untuk kiriman ini</strong>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {(['driver', 'helper'] as const).filter(slot => !slots[slot]).map(slot => (
                <button type="button" key={slot} className="akk-crew-outline" onClick={() => {setSlots(prev => ({ ...prev, [slot]: mine })); setClaimOpen(false);}}>
                  {slot === 'driver' ? <Truck size={17} /> : <Users size={17} />} Jadi {roleLabel(slot)}
                </button>
              ))}
            </div>
            <button type="button" className="akk-crew-quiet" onClick={() => setClaimOpen(false)}>Batal</button>
          </div>
        )}
        {assignedSlot && <p className="text-sm text-emerald-700 dark:text-emerald-400 font-semibold">Anda mengambil slot {assignedSlot === 'driver' ? 'Driver' : 'Helper'}.</p>}
        <div className="akk-crew-task-list">
          <strong>Tugas {taskSlot === 'driver' ? 'Driver' : 'Helper'}</strong>
          {(taskSlot === 'driver'
            ? ['Cek kendaraan', 'Catat KM & BBM', 'Berangkat / Pulang']
            : ['Validasi Surat Jalan', 'Absen toko & retur', 'Isi Form Kirim']
          ).map(item => <div key={item}><Check size={16} /> {item}</div>)}
        </div>
        <button type="button" className="akk-crew-quiet inline-flex items-center gap-1.5" onClick={() => {setSlots({ driver: '', helper: '' }); setRole('driver'); setClaimOpen(false);}}>
          <RotateCcw size={15} /> Ulangi simulasi
        </button>
      </section>

      <section className="akk-crew-panel space-y-4" aria-label="Buat akun uji untuk login AKK">
        <div className="space-y-1">
          <h2 className="akk-crew-panel-title">Akun login uji</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">Dua akun yang bisa login melalui halaman AKK biasa.</p>
        </div>
        {!isAdmin ? (
          <div className="akk-crew-alert"><LockKeyhole size={17} /><span>Masuk sebagai Super Admin untuk membuat akun uji.</span></div>
        ) : (
          <>
            <label className="akk-crew-field">
              <span>Cabang akun uji</span>
              <select value={branchId} onChange={event => setBranchId(event.target.value)} disabled={createBusy}>
                {BRANCHES.map(branch => <option value={branch.value} key={branch.value}>{branch.label}</option>)}
              </select>
            </label>
            <button type="button" className="akk-crew-primary" onClick={createTestAccounts} disabled={createBusy}>
              {createBusy ? <Loader2 className="animate-spin" size={18} /> : <Users size={18} />}
              {createBusy ? 'Membuat akun...' : 'Buat 2 Akun Uji'}
            </button>
          </>
        )}
        {notice && <div role="status" className={`akk-crew-notice ${notice.tone}`}>
          {notice.tone === 'ok' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
          <span>{notice.text}</span>
        </div>}
        {accounts.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <strong className="text-sm">Data login (salin sekarang)</strong>
              <button type="button" className="akk-crew-quiet" onClick={() => setShowPasswords(v => !v)}>{showPasswords ? 'Sembunyikan' : 'Tampilkan'} password</button>
            </div>
            {accounts.map(account => (
              <div className="akk-crew-account" key={account.id}>
                <div className="flex items-center justify-between">
                  <strong>{account.role === 'driver' ? 'Akun Driver' : 'Akun Helper'}</strong>
                  <span className="akk-crew-status good">Aktif</span>
                </div>
                <div className="akk-crew-value">{account.email}</div>
                <div className="akk-crew-value">{showPasswords ? account.password : '••••••••••••••••'}</div>
                <button type="button" className="akk-crew-outline" onClick={() => copy(credentialsText(account))}><Copy size={16} /> Salin Login</button>
              </div>
            ))}
            <p className="text-xs text-slate-500 dark:text-slate-400">Login masing-masing akun di jendela privat yang berbeda. Password hanya muncul selama halaman ini terbuka.</p>
            <button type="button" className="akk-crew-danger" disabled={deleteBusy} onClick={deleteTestAccounts}>
              {deleteBusy ? <Loader2 className="animate-spin" size={15} /> : <Trash2 size={15} />}
              Hapus akun uji setelah selesai
            </button>
          </div>
        )}
        <p className="text-xs text-amber-700 dark:text-amber-400">Akun uji dibuat di database AKK sungguhan. Jangan gunakan untuk kiriman nyata. Hapus setelah tes.</p>
        <button type="button" className="akk-crew-outline" onClick={() => onNavigate ? onNavigate('driver_portal') : window.location.assign('/portal-driver')}>
          Buka menu Driver / Helper <ExternalLink size={16} />
        </button>
      </section>

      <section className="akk-crew-panel space-y-3" aria-label="Tes kesehatan sistem">
        <div className="flex flex-wrap gap-3 items-center justify-between">
          <div>
            <h2 className="akk-crew-panel-title">Periksa sistem</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">Tes otomatis yang sudah ada, hasil dibuat lebih ringkas.</p>
          </div>
          <button type="button" className="akk-crew-outline" disabled={testBusy} onClick={runDiagnostics}>
            {testBusy ? <Loader2 className="animate-spin" size={16} /> : <Play size={16} />}
            {testBusy ? 'Menguji...' : 'Jalankan Tes'}
          </button>
        </div>
        {testProgress && <p className="text-sm text-slate-500">{testProgress}</p>}
        {summary && (
          <div className="space-y-3">
            <div className="flex items-center gap-3 text-sm">
              <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400"><CheckCircle2 size={17} /> {summary.passed} lolos</span>
              <span className="inline-flex items-center gap-1 text-rose-600 dark:text-rose-400"><XCircle size={17} /> {summary.failed} gagal</span>
            </div>
            {summary.results.filter(result => result.status !== 'passed').map(result => (
              <details className="akk-crew-error" key={result.id}>
                <summary><AlertCircle size={16} /> {result.title}</summary>
                <div className="text-xs space-y-1 pt-2">{result.assertions.filter(assertion => !assertion.passed).map((assertion, index) => <p key={index}>{assertion.description}</p>)}</div>
              </details>
            ))}
            {summary.failed === 0 && <p className="text-sm text-emerald-600 dark:text-emerald-400"><ShieldCheck size={16} className="inline" /> Pemeriksaan otomatis lolos.</p>}
          </div>
        )}
      </section>
    </div>
  );
};

export default E2ETesterModule;
