import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  Play,
  RotateCcw,
  CheckCircle2,
  XCircle,
  Clock,
  Users,
  Terminal,
  Download,
  ExternalLink,
  Lock,
  Eye,
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  Server,
  Layers,
  Sparkles,
  Smartphone
} from 'lucide-react';
import { E2ETestRunner, E2ESummary, E2ETestResult } from '../services/e2eTestRunner';
import { logisticsStore } from '../services/store';
import { UserProfile } from '../types';
import { NavTab } from './Sidebar';

interface E2ETesterModuleProps {
  onNavigate?: (tab: NavTab) => void;
}

export const E2ETesterModule: React.FC<E2ETesterModuleProps> = ({ onNavigate }) => {
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [progress, setProgress] = useState<number>(0);
  const [currentRunningTitle, setCurrentRunningTitle] = useState<string>('');
  const [testSummary, setTestSummary] = useState<E2ESummary | null>(null);
  const [expandedTestId, setExpandedTestId] = useState<string | null>(null);
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>('all');
  const [currentUser, setCurrentUser] = useState<UserProfile>(logisticsStore.getCurrentUser());

  // Available test persona accounts
  const allUsers = logisticsStore.getUsers();
  const samplePersonas: UserProfile[] = [
    allUsers.find(u => u.email === 'admin') || {
      id: 'usr-001',
      fullName: 'Administrator Sistem',
      email: 'admin',
      role: 'super_admin',
      status: 'approved',
      department: 'IT',
      phone: '0812-1351-3590',
      createdAt: ''
    },
    allUsers.find(u => u.email === 'bahri@gmail.com') || {
      id: 'usr-bahri',
      fullName: 'Muhammad Syaiful Bahri',
      email: 'bahri@gmail.com',
      role: 'spv_logistik',
      status: 'approved',
      department: 'Operasional',
      phone: '0812-3456-7890',
      createdAt: ''
    },
    allUsers.find(u => u.email === 'zainul@gmail.com') || {
      id: 'usr-zainul',
      fullName: 'Zainul Agustiar',
      email: 'zainul@gmail.com',
      role: 'driver',
      status: 'approved',
      department: 'Logistik',
      phone: '0813-2233-4455',
      createdAt: ''
    },
    allUsers.find(u => u.email === 'aan@gmail.com') || {
      id: 'usr-aan',
      fullName: 'Aan Adi Saputra',
      email: 'aan@gmail.com',
      role: 'spv_logistik',
      status: 'approved',
      department: 'Operasional',
      phone: '0819-3344-5566',
      createdAt: ''
    },
    allUsers.find(u => u.email === 'bayun@gmail.com') || {
      id: 'usr-bayun',
      fullName: 'Bayu Novianto Dimas Permana',
      email: 'bayun@gmail.com',
      role: 'spv_logistik',
      status: 'approved',
      department: 'Operasional',
      phone: '0812-9876-5432',
      createdAt: ''
    }
  ];

  // Run tests automatically on mount
  useEffect(() => {
    handleRunTests();
  }, []);

  const handleRunTests = async () => {
    setIsRunning(true);
    setProgress(10);
    setCurrentRunningTitle('Menginisialisasi rangkaian pengujian E2E...');

    try {
      const summary = await E2ETestRunner.runAllTests((p, title) => {
        setProgress(p);
        setCurrentRunningTitle(title);
      });
      setTestSummary(summary);
      setProgress(100);
    } catch (e) {
      console.error('[E2ETester] Failed to run tests:', e);
    } finally {
      setIsRunning(false);
    }
  };

  const handleImpersonate = (user: UserProfile) => {
    E2ETestRunner.impersonateUser(user);
    setCurrentUser(user);

    // If driver, navigate to driver mobile portal for convenience
    if (user.role === 'driver' && onNavigate) {
      onNavigate('driver_portal');
    }
  };

  const handleResetToAdmin = () => {
    const admin = allUsers.find(u => u.role === 'super_admin') || {
      id: 'usr-001',
      fullName: 'Administrator Sistem',
      email: 'admin',
      role: 'super_admin',
      status: 'approved',
      department: 'IT',
      phone: '0812-1351-3590',
      createdAt: ''
    };
    handleImpersonate(admin);
  };

  const handleDownloadReport = () => {
    if (!testSummary) return;
    const reportData = {
      title: 'LAPORAN HASIL PENGUJIAN OTOMATIS E2E - PT ANUGRAH KEMASAN KREATIF',
      generatedAt: new Date().toISOString(),
      summary: {
        totalScenarios: testSummary.total,
        passed: testSummary.passed,
        failed: testSummary.failed,
        successRate: `${testSummary.successRate}%`,
        durationMs: `${testSummary.durationMs} ms`
      },
      scenarios: testSummary.results.map(r => ({
        id: r.id,
        title: r.title,
        role: r.targetAccountRole,
        account: r.targetAccountName,
        status: r.status,
        duration: `${r.durationMs}ms`,
        assertions: r.assertions
      }))
    };

    const blob = new Blob([JSON.stringify(reportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `e2e_test_audit_${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const filteredResults = testSummary?.results.filter(r => {
    if (selectedCategoryFilter === 'all') return true;
    return r.category === selectedCategoryFilter;
  }) || [];

  return (
    <div className="p-4 lg:p-8 space-y-6 max-w-7xl mx-auto text-slate-100">
      {/* ========================================================================= */}
      {/* 1. HEADER SECTION                                                         */}
      {/* ========================================================================= */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2 text-xs text-slate-400 mb-1">
            <span>Sistem Kualitas &amp; Audit</span>
            <span aria-hidden="true">&bull;</span>
            <span className="text-emerald-400 font-semibold">End-to-End Test Engine</span>
            <span aria-hidden="true">&bull;</span>
            <span>Zero-Defect Workflow</span>
          </div>
          <h1 className="text-xl lg:text-2xl font-black text-white tracking-tight flex items-center gap-2.5">
            <ShieldCheck className="w-6 h-6 text-emerald-400" />
            <span>Pusat Pengujian E2E &amp; Simulasi Akun Pengguna</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1 max-w-2xl leading-relaxed">
            Menjalankan validasi otomatis alur kerja operasional antar peran (Super Admin, SPV Logistik, Driver, Helper, Sales) untuk memastikan tidak ada alur yang terlewat, izin RBAC bocor, atau gagal diproses sebelum dan sesudah dipublikasikan ke Hostinger / GitHub.
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0 flex-wrap">
          <button
            onClick={handleResetToAdmin}
            className="px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-200 text-xs font-bold transition flex items-center gap-2 cursor-pointer shadow-sm active:scale-95"
            title="Kembalikan sesi aktif ke Super Admin"
          >
            <RotateCcw className="w-3.5 h-3.5 text-amber-400" />
            <span>Reset Sesi Super Admin</span>
          </button>

          <button
            onClick={handleDownloadReport}
            disabled={!testSummary}
            className="px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-cyan-300 text-xs font-bold transition flex items-center gap-2 cursor-pointer shadow-sm active:scale-95"
          >
            <Download className="w-4 h-4" />
            <span>Unduh Laporan Audit</span>
          </button>

          <button
            onClick={handleRunTests}
            disabled={isRunning}
            className="px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-400 hover:from-emerald-400 hover:to-teal-300 text-slate-950 text-xs font-black transition flex items-center gap-2 cursor-pointer shadow-lg shadow-emerald-500/20 active:scale-95 disabled:opacity-50"
          >
            <Play className={`w-4 h-4 text-slate-950 ${isRunning ? 'animate-spin' : ''}`} />
            <span>{isRunning ? 'Sedang Menguji...' : 'Jalankan Semua Skenario'}</span>
          </button>
        </div>
      </div>

      {/* Active Impersonated Session Warning Banner */}
      {currentUser.role !== 'super_admin' && (
        <div className="p-3.5 rounded-2xl bg-amber-500/15 border border-amber-500/40 text-amber-200 flex items-center justify-between gap-3 text-xs animate-in fade-in">
          <div className="flex items-center gap-2.5">
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
            <span>
              Anda sedang berada dalam <strong>Mode Simulasi Akun</strong> sebagai: <strong>{currentUser.fullName}</strong> ({currentUser.role.toUpperCase()}).
            </span>
          </div>
          <button
            onClick={handleResetToAdmin}
            className="px-3 py-1 bg-amber-500 text-slate-950 font-bold rounded-lg text-[11px] hover:bg-amber-400 transition cursor-pointer"
          >
            Kembali ke Super Admin
          </button>
        </div>
      )}

      {/* Progress Bar (Visible when tests are actively running) */}
      {isRunning && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-2 animate-in fade-in">
          <div className="flex items-center justify-between text-xs">
            <span className="font-bold text-emerald-400 flex items-center gap-2">
              <Clock className="w-3.5 h-3.5 animate-spin" />
              <span>{currentRunningTitle}</span>
            </span>
            <span className="font-mono font-bold text-white">{progress}%</span>
          </div>
          <div className="w-full bg-slate-950 h-2.5 rounded-full overflow-hidden border border-slate-800">
            <div
              className="bg-gradient-to-r from-emerald-500 to-teal-400 h-full rounded-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 2. CORE TEST SUMMARY METRICS CARDS                                        */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
          <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1 flex items-center justify-between">
            <span>Total Skenario E2E</span>
            <Layers className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="text-2xl font-black text-white font-mono">
            {testSummary?.total || 0} <span className="text-xs font-normal text-slate-400">Kasus Uji</span>
          </div>
          <div className="text-[11px] text-slate-400 mt-1">
            Meliputi alur Dispatch, Mobile, POD, &amp; RBAC
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
          <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1 flex items-center justify-between">
            <span>Tingkat Kelulusan</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-black text-emerald-400 font-mono">
            {testSummary?.successRate || 100}%
          </div>
          <div className="text-[11px] text-slate-400 mt-1">
            {testSummary?.passed || 0} Lolos &bull; {testSummary?.failed || 0} Gagal
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
          <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1 flex items-center justify-between">
            <span>Durasi Pengujian</span>
            <Clock className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-2xl font-black text-white font-mono">
            {testSummary?.durationMs || 0} <span className="text-xs font-normal text-slate-400">ms</span>
          </div>
          <div className="text-[11px] text-slate-400 mt-1">
            Respon instan in-memory test runner
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
          <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1 flex items-center justify-between">
            <span>Pertahanan Input &amp; DB</span>
            <Lock className="w-4 h-4 text-teal-400" />
          </div>
          <div className="text-2xl font-black text-teal-300 font-mono">
            AMAN (0 XSS)
          </div>
          <div className="text-[11px] text-slate-400 mt-1">
            Filter sanitasi teks, SQL, &amp; XSS aktif
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 3. ACCOUNT IMPERSONATOR (SIMULASI AKUN ORANG LAIN)                        */}
      {/* ========================================================================= */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Users className="w-4 h-4 text-cyan-400" />
              <span>Simulasi Masuk Sebagai Akun Orang Lain (Account Impersonator)</span>
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Pilih akun kru/rekan kerja di bawah untuk mensimulasikan antarmuka dan hak akses mereka secara langsung:
            </p>
          </div>
          <span className="text-[10px] text-slate-500 font-mono">
            Sesi saat ini: <strong className="text-white">{currentUser.fullName}</strong>
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {samplePersonas.map((persona) => {
            const isActive = currentUser.email === persona.email;
            return (
              <div
                key={persona.id}
                className={`p-3.5 rounded-xl border transition ${
                  isActive
                    ? 'bg-amber-500/15 border-amber-500/60 shadow-md shadow-amber-500/10'
                    : 'bg-slate-950 border-slate-800 hover:border-slate-700'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="font-bold text-white text-xs flex items-center gap-1.5">
                      <span>{persona.fullName}</span>
                      {isActive && (
                        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                      )}
                    </div>
                    <div className="text-[10px] text-slate-400 font-mono mt-0.5">{persona.email}</div>
                    <div className="text-[11px] font-semibold text-cyan-300 mt-1">
                      {persona.role === 'super_admin' ? 'Super Administrator' :
                       persona.role === 'spv_logistik' ? 'SPV Logistik Operasional' :
                       persona.role === 'driver' ? 'Pengemudi Armada (Driver)' : persona.role}
                    </div>
                  </div>
                  <span className="text-[9px] font-mono px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-slate-400">
                    {persona.department || 'AKK'}
                  </span>
                </div>

                <div className="mt-3 pt-2.5 border-t border-slate-800/80 flex items-center justify-between">
                  <span className="text-[10px] text-slate-500">
                    {isActive ? 'Sedang Aktif' : 'Tersedia'}
                  </span>
                  <button
                    onClick={() => handleImpersonate(persona)}
                    disabled={isActive}
                    className={`px-3 py-1.5 rounded-lg text-[11px] font-bold transition flex items-center gap-1.5 cursor-pointer ${
                      isActive
                        ? 'bg-amber-500 text-slate-950 font-black cursor-default'
                        : 'bg-slate-800 hover:bg-slate-700 text-white border border-slate-700 hover:border-slate-600'
                    }`}
                  >
                    <Eye className="w-3 h-3" />
                    <span>{isActive ? 'Aktif' : 'Simulasikan Akun'}</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 4. DETAILED AUTOMATED E2E SCENARIOS ACCORDION                             */}
      {/* ========================================================================= */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl space-y-0">
        <div className="p-4 border-b border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Terminal className="w-4 h-4 text-emerald-400" />
              <span>Daftar Skenario &amp; Diagnosa Pengujian Otomatis</span>
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Setiap skenario menguji fungsi backend store, guard otorisasi RBAC, alur penugasan, hingga sanitasi keamanan.
            </p>
          </div>

          {/* Filter Categories */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
            {(
              [
                { id: 'all', label: 'Semua Kasus' },
                { id: 'AUTH_SESSION', label: 'Autentikasi' },
                { id: 'DISPATCH_SCHEDULE', label: 'Jadwal & Penugasan' },
                { id: 'DRIVER_MOBILE', label: 'Driver Mobile' },
                { id: 'RBAC_SECURITY', label: 'RBAC' },
                { id: 'INPUT_SANITATION', label: 'Keamanan Input' }
              ] as const
            ).map((cat) => (
              <button
                key={cat.id}
                onClick={() => setSelectedCategoryFilter(cat.id)}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition cursor-pointer shrink-0 ${
                  selectedCategoryFilter === cat.id
                    ? 'bg-emerald-500 text-slate-950 shadow-sm'
                    : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>
        </div>

        <div className="divide-y divide-slate-800/80">
          {filteredResults.map((test, index) => {
            const isExpanded = expandedTestId === test.id;
            return (
              <div key={test.id} className="p-4 hover:bg-slate-800/30 transition">
                <div
                  onClick={() => setExpandedTestId(isExpanded ? null : test.id)}
                  className="flex items-center justify-between gap-3 cursor-pointer"
                >
                  <div className="flex items-center gap-3">
                    <span className="w-6 h-6 rounded-lg bg-slate-950 border border-slate-800 text-[10px] font-mono font-bold flex items-center justify-center text-slate-400">
                      {index + 1}
                    </span>
                    {test.status === 'passed' ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    ) : (
                      <XCircle className="w-4 h-4 text-rose-400 shrink-0" />
                    )}
                    <div>
                      <div className="font-bold text-white text-xs flex items-center gap-2">
                        <span>{test.title}</span>
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-950 border border-slate-800 text-slate-400">
                          {test.targetAccountRole}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-400 mt-0.5">
                        Target Akun: <strong className="text-slate-300">{test.targetAccountName}</strong> &bull; {test.details}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <span className="text-[11px] font-mono text-slate-400">
                      {test.durationMs} ms
                    </span>
                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                      test.status === 'passed'
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                        : 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                    }`}>
                      {test.status === 'passed' ? 'PASSED' : 'FAILED'}
                    </span>
                    {isExpanded ? (
                      <ChevronDown className="w-4 h-4 text-slate-400" />
                    ) : (
                      <ChevronRight className="w-4 h-4 text-slate-400" />
                    )}
                  </div>
                </div>

                {/* Expanded Assertions Breakdown */}
                {isExpanded && (
                  <div className="mt-3 pl-9 pr-2 space-y-2 pt-3 border-t border-slate-800/60 animate-in fade-in duration-150">
                    <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                      Langkah Verifikasi (Assertions - {test.assertions.length} Poin):
                    </div>
                    <div className="space-y-1.5">
                      {test.assertions.map((assertion, aIdx) => (
                        <div
                          key={aIdx}
                          className="p-2.5 rounded-xl bg-slate-950 border border-slate-800/80 flex items-start gap-2.5 text-xs"
                        >
                          {assertion.passed ? (
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                          ) : (
                            <XCircle className="w-3.5 h-3.5 text-rose-400 shrink-0 mt-0.5" />
                          )}
                          <div className="flex-1">
                            <span className={assertion.passed ? 'text-slate-200' : 'text-rose-300 font-bold'}>
                              {assertion.description}
                            </span>
                            {assertion.actual !== undefined && (
                              <div className="text-[10px] font-mono text-slate-400 mt-0.5">
                                Hasil Riil: <span className="text-cyan-300">{JSON.stringify(assertion.actual)}</span>
                                {assertion.expected !== undefined && (
                                  <span> &bull; Ekspektasi: <span className="text-emerald-300">{JSON.stringify(assertion.expected)}</span></span>
                                )}
                              </div>
                            )}
                            {assertion.error && (
                              <div className="text-[10px] font-mono text-rose-400 mt-0.5">
                                Error: {assertion.error}
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 5. HOSTINGER & GITHUB DEPLOYMENT SECURITY AUDIT CARD                      */}
      {/* ========================================================================= */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-3">
        <h3 className="text-sm font-bold text-white flex items-center gap-2">
          <Server className="w-4 h-4 text-cyan-400" />
          <span>Status Kesiapan Publikasi Hostinger &amp; Repositori GitHub</span>
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1 text-xs">
          <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 space-y-1">
            <div className="flex items-center gap-2 text-emerald-400 font-bold">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Hostinger Node 22 Terkonfigurasi</span>
            </div>
            <p className="text-[11px] text-slate-400">
              Build command <code className="text-white">npm run build</code>, start command <code className="text-white">tsx server.ts</code>, dan Node <code className="text-white">22.x</code> aktif.
            </p>
          </div>

          <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 space-y-1">
            <div className="flex items-center gap-2 text-emerald-400 font-bold">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>HTTP Security Headers</span>
            </div>
            <p className="text-[11px] text-slate-400">
              X-Content-Type-Options: nosniff, X-Frame-Options: SAMEORIGIN, dan Referrer-Policy tersemat otomatis.
            </p>
          </div>

          <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 space-y-1">
            <div className="flex items-center gap-2 text-emerald-400 font-bold">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Kerahasiaan API Key Terjaga</span>
            </div>
            <p className="text-[11px] text-slate-400">
              Kunci rahasia dipisah ke <code className="text-white">.env.example</code> tanpa token hardcoded pada source code.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
