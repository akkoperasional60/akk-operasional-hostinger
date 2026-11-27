import React, { useState, useEffect } from 'react';
import { AkkLogo } from './AkkLogo';
import {
  LogIn,
  UserPlus,
  KeyRound,
  Mail,
  User,
  Phone,
  Clock,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Eye,
  EyeOff,
  Lock,
  ArrowLeft,
  Send,
  RefreshCw,
  ShieldCheck,
  Database,
  ChevronDown
} from 'lucide-react';
import { UserProfile } from '../types';
import { logisticsStore } from '../services/store';
import { fetchWithTimeout } from '../utils/fetchWithTimeout';

const EMAIL_REGEX = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;

const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_DURATION_SECONDS = 60;
const STORAGE_FAILED_KEY = 'akk_auth_v4_failed_attempts';
const STORAGE_LOCKOUT_KEY = 'akk_auth_v4_lockout_until';

interface DbHealthState {
  checked: boolean;
  success: boolean;
  configured: boolean;
  dbHost: string;
  dbPort: number;
  dbName: string;
  hasUserConfigured: boolean;
  hasPasswordConfigured: boolean;
  missingEnvVars: string[];
  circuitBreaker: {
    isOpen: boolean;
    remainingSeconds: number;
    consecutiveFailures: number;
  };
  message: string;
}

interface LoginPageProps {
  onLoginSuccess: (user: UserProfile) => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({ onLoginSuccess }) => {
  const [tab, setTab] = useState<'login' | 'register' | 'forgot'>('login');
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Database Health & Circuit Breaker State
  const [dbHealth, setDbHealth] = useState<DbHealthState | null>(null);
  const [isReconnectingDb, setIsReconnectingDb] = useState(false);
  const [showAdminDbDetails, setShowAdminDbDetails] = useState(false);
  const [dbRestoredNotice, setDbRestoredNotice] = useState(false);

  // Register Form State
  const [registerData, setRegisterData] = useState({
    fullName: '',
    email: '',
    phone: '',
    department: 'Logistik',
    password: '',
    confirmPassword: ''
  });

  // Forgot Password / Recovery State (WhatsApp OTP)
  const [recoveryInput, setRecoveryInput] = useState('');
  const [recoveryStep, setRecoveryStep] = useState<'request' | 'verify'>('request');
  const [recoveryCode, setRecoveryCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [recoveryMaskedPhone, setRecoveryMaskedPhone] = useState('');
  const [recoveryAccountName, setRecoveryAccountName] = useState('');
  const [recoveryExpiresIn, setRecoveryExpiresIn] = useState<number>(0);
  const [recoveryResendCooldown, setRecoveryResendCooldown] = useState<number>(0);
  const [isSendingRecovery, setIsSendingRecovery] = useState(false);
  const [isVerifyingRecovery, setIsVerifyingRecovery] = useState(false);

  // Rate Limiting
  const [failedAttempts, setFailedAttempts] = useState<number>(() => {
    try {
      localStorage.removeItem('akk_auth_failed_attempts');
      localStorage.removeItem('akk_auth_lockout_until');
      localStorage.removeItem('akk_auth_v2_failed_attempts');
      localStorage.removeItem('akk_auth_v2_lockout_until');
      localStorage.removeItem('akk_auth_v3_failed_attempts');
      localStorage.removeItem('akk_auth_v3_lockout_until');
      const saved = localStorage.getItem(STORAGE_FAILED_KEY);
      return saved ? parseInt(saved, 10) || 0 : 0;
    } catch {
      return 0;
    }
  });

  const [lockoutUntil, setLockoutUntil] = useState<number>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_LOCKOUT_KEY);
      return saved ? parseInt(saved, 10) || 0 : 0;
    } catch {
      return 0;
    }
  });

  const [countdown, setCountdown] = useState<number>(0);

  const checkDbStatus = async () => {
    try {
      const res = await fetchWithTimeout('/api/db-status', {
        credentials: 'same-origin',
        timeoutMs: 4500
      });
      const data = await res.json().catch(() => null);
      if (data && typeof data === 'object') {
        setDbHealth({
          checked: true,
          success: Boolean(data.success),
          configured: Boolean(data.configured),
          dbHost: String(data.dbHost || 'localhost'),
          dbPort: Number(data.dbPort || 3306),
          dbName: String(data.dbName || '-'),
          hasUserConfigured: Boolean(data.hasUserConfigured),
          hasPasswordConfigured: Boolean(data.hasPasswordConfigured),
          missingEnvVars: Array.isArray(data.missingEnvVars) ? data.missingEnvVars : [],
          circuitBreaker: {
            isOpen: Boolean(data.circuitBreaker?.isOpen),
            remainingSeconds: Number(data.circuitBreaker?.remainingSeconds || 0),
            consecutiveFailures: Number(data.circuitBreaker?.consecutiveFailures || 0)
          },
          message: String(data.message || '')
        });
      }
    } catch {
      // Keep login usable if status probe times out
    }
  };

  useEffect(() => {
    void checkDbStatus();
  }, []);

  const handleReconnectDatabase = async () => {
    setIsReconnectingDb(true);
    setDbRestoredNotice(false);
    try {
      const res = await fetchWithTimeout('/api/db-reconnect', {
        method: 'POST',
        credentials: 'same-origin',
        timeoutMs: 7000
      });
      const data = await res.json().catch(() => null);
      if (data && typeof data === 'object') {
        const connected = Boolean(data.success);
        setDbHealth({
          checked: true,
          success: connected,
          configured: Boolean(data.configured),
          dbHost: String(data.dbHost || 'localhost'),
          dbPort: Number(data.dbPort || 3306),
          dbName: String(data.dbName || '-'),
          hasUserConfigured: Boolean(data.hasUserConfigured),
          hasPasswordConfigured: Boolean(data.hasPasswordConfigured),
          missingEnvVars: Array.isArray(data.missingEnvVars) ? data.missingEnvVars : [],
          circuitBreaker: {
            isOpen: Boolean(data.circuitBreaker?.isOpen),
            remainingSeconds: Number(data.circuitBreaker?.remainingSeconds || 0),
            consecutiveFailures: Number(data.circuitBreaker?.consecutiveFailures || 0)
          },
          message: String(data.message || '')
        });
        if (connected) {
          setDbRestoredNotice(true);
          if (errorMsg.toLowerCase().includes('database') || errorMsg.toLowerCase().includes('koneksi')) {
            setErrorMsg('');
          }
        }
      }
    } catch {
      setErrorMsg('Gagal menghubungi server untuk menyambungkan ulang database.');
    } finally {
      setIsReconnectingDb(false);
    }
  };

  useEffect(() => {
    const updateCountdown = () => {
      const now = Date.now();
      if (lockoutUntil > now) {
        const remaining = Math.ceil((lockoutUntil - now) / 1000);
        setCountdown(remaining);
      } else {
        setCountdown(0);
        if (lockoutUntil > 0) {
          setLockoutUntil(0);
          setFailedAttempts(0);
          try {
            localStorage.removeItem(STORAGE_LOCKOUT_KEY);
            localStorage.removeItem(STORAGE_FAILED_KEY);
          } catch {}
        }
      }
    };

    updateCountdown();
    const timer = setInterval(updateCountdown, 1000);
    return () => clearInterval(timer);
  }, [lockoutUntil]);

  // Countdown masa berlaku OTP & cooldown kirim ulang WhatsApp
  useEffect(() => {
    if (recoveryExpiresIn <= 0 && recoveryResendCooldown <= 0) return;
    const timer = setInterval(() => {
      setRecoveryExpiresIn(prev => (prev > 0 ? prev - 1 : 0));
      setRecoveryResendCooldown(prev => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [recoveryExpiresIn > 0, recoveryResendCooldown > 0]);

  const trimmedInput = loginEmail.trim();
  const isLocked = countdown > 0;

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    if (isLocked) {
      setErrorMsg(`Akses login dikunci sementara selama ${countdown} detik karena ${MAX_FAILED_ATTEMPTS} kali percobaan gagal.`);
      return;
    }
    if (!trimmedInput) {
      setErrorMsg('Silakan masukkan email atau username akun Anda.');
      return;
    }
    if (!loginPassword.trim()) {
      setErrorMsg('Silakan masukkan password akun Anda.');
      return;
    }

    setIsLoading(true);
    const user = await logisticsStore.loginUserRemote(trimmedInput, loginPassword.trim());

    if (!user) {
      setIsLoading(false);
      const authError = logisticsStore.getLastAuthError();
      if (authError && (authError.status === 503 || authError.status === 504 || authError.status === 403 || authError.status === 429)) {
        setErrorMsg(authError.message);
        if (authError.status === 503 || authError.circuitBreakerOpen) {
          void checkDbStatus();
        }
        return;
      }
      const nextFailed = failedAttempts + 1;
      setFailedAttempts(nextFailed);
      try { localStorage.setItem(STORAGE_FAILED_KEY, String(nextFailed)); } catch {}
      if (nextFailed >= MAX_FAILED_ATTEMPTS) {
        const lockoutTime = Date.now() + LOCKOUT_DURATION_SECONDS * 1000;
        setLockoutUntil(lockoutTime);
        setCountdown(LOCKOUT_DURATION_SECONDS);
        try { localStorage.setItem(STORAGE_LOCKOUT_KEY, String(lockoutTime)); } catch {}
        setErrorMsg(`Terlalu banyak percobaan gagal (${MAX_FAILED_ATTEMPTS}x). Login dikunci sementara selama ${LOCKOUT_DURATION_SECONDS} detik.`);
      } else {
        setErrorMsg(`${authError?.message || 'Email / Username atau Password salah.'} (Sisa kesempatan: ${MAX_FAILED_ATTEMPTS - nextFailed}x).`);
      }
      return;
    }

    setFailedAttempts(0);
    setLockoutUntil(0);
    setCountdown(0);
    try {
      localStorage.removeItem(STORAGE_FAILED_KEY);
      localStorage.removeItem(STORAGE_LOCKOUT_KEY);
    } catch {}
    setSuccessMsg(`Berhasil masuk sebagai ${user.fullName}`);
    setTimeout(() => {
      setIsLoading(false);
      onLoginSuccess(user);
    }, 250);
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    if (!registerData.fullName.trim()) {
      setErrorMsg('Silakan masukkan nama lengkap Anda.');
      return;
    }
    if (!registerData.email.trim() || !EMAIL_REGEX.test(registerData.email.trim())) {
      setErrorMsg('Format email tidak valid.');
      return;
    }
    if (!registerData.password || registerData.password.length < 8) {
      setErrorMsg('Password minimal 8 karakter.');
      return;
    }
    if (registerData.password !== registerData.confirmPassword) {
      setErrorMsg('Konfirmasi password tidak cocok.');
      return;
    }

    setIsLoading(true);
    const newUser = await logisticsStore.registerUserRemote({
      fullName: registerData.fullName.trim(),
      email: registerData.email.trim(),
      phone: registerData.phone.trim(),
      department: registerData.department || 'Logistik',
      password: registerData.password
    });
    setIsLoading(false);

    if (!newUser) {
      const authError = logisticsStore.getLastAuthError();
      setErrorMsg(
        authError?.message ||
        'Pendaftaran gagal. Email mungkin sudah terdaftar atau database belum dapat diakses.'
      );
      if (authError?.status === 503) {
        void checkDbStatus();
      }
      return;
    }

    setSuccessMsg(`Pendaftaran berhasil! Akun "${newUser.fullName}" menunggu persetujuan Super Admin sebelum dapat masuk.`);
    setTimeout(() => setTab('login'), 1800);
  };

  const formatMmSs = (totalSec: number) => {
    const mins = Math.floor(Math.max(0, totalSec) / 60);
    const secs = Math.max(0, totalSec) % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  const requestWhatsAppOtp = async (identifierValue: string) => {
    setErrorMsg('');
    setSuccessMsg('');
    const cleanId = identifierValue.trim();
    if (!cleanId) {
      setErrorMsg('Silakan masukkan Email, Username, atau Nomor WhatsApp akun Anda.');
      return;
    }

    setIsSendingRecovery(true);
    try {
      const response = await fetchWithTimeout('/api/auth/forgot-password/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        timeoutMs: 9000,
        body: JSON.stringify({ identifier: cleanId })
      });
      const data = await response.json().catch(() => null);

      if (!response.ok || !data?.success) {
        if (data?.retryAfterSec) {
          setRecoveryResendCooldown(Number(data.retryAfterSec) || 60);
        }
        if (data?.maskedPhone) {
          setRecoveryMaskedPhone(String(data.maskedPhone));
        }
        setErrorMsg(data?.error || 'Gagal mengirim kode verifikasi ke WhatsApp pengguna.');
        return;
      }

      setRecoveryMaskedPhone(String(data.maskedPhone || ''));
      setRecoveryAccountName(String(data.accountName || ''));
      setRecoveryExpiresIn(Number(data.expiresInSeconds) || 600);
      setRecoveryResendCooldown(Number(data.cooldownSeconds) || 60);
      setRecoveryCode('');
      setRecoveryStep('verify');
      setSuccessMsg(
        data.message || `Kode verifikasi 6-digit telah dikirim langsung ke WhatsApp ${data.maskedPhone || 'terdaftar Anda'}.`
      );
    } catch {
      setErrorMsg('Tidak dapat menghubungi server untuk mengirim kode verifikasi WhatsApp.');
    } finally {
      setIsSendingRecovery(false);
    }
  };

  const handleRequestRecovery = async (e: React.FormEvent) => {
    e.preventDefault();
    await requestWhatsAppOtp(recoveryInput);
  };

  const handleVerifyRecovery = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    const cleanCode = recoveryCode.replace(/\D/g, '').trim();
    if (cleanCode.length !== 6) {
      setErrorMsg('Masukkan 6 digit kode verifikasi yang diterima di WhatsApp Anda.');
      return;
    }
    if (!newPassword || newPassword.length < 8) {
      setErrorMsg('Password baru minimal 8 karakter.');
      return;
    }
    if (newPassword !== confirmNewPassword) {
      setErrorMsg('Konfirmasi password baru tidak cocok.');
      return;
    }

    setIsVerifyingRecovery(true);
    try {
      const response = await fetchWithTimeout('/api/auth/forgot-password/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        timeoutMs: 9000,
        body: JSON.stringify({
          identifier: recoveryInput.trim(),
          code: cleanCode,
          newPassword
        })
      });
      const data = await response.json().catch(() => null);

      if (!response.ok || !data?.success) {
        setErrorMsg(data?.error || 'Kode verifikasi tidak valid atau gagal memperbarui kata sandi.');
        return;
      }

      const savedIdentifier = recoveryInput.trim();
      setRecoveryStep('request');
      setRecoveryCode('');
      setNewPassword('');
      setConfirmNewPassword('');
      setRecoveryMaskedPhone('');
      setRecoveryAccountName('');
      setRecoveryExpiresIn(0);
      setRecoveryResendCooldown(0);
      setLoginEmail(savedIdentifier);
      setLoginPassword('');
      setTab('login');
      setSuccessMsg(
        data.message || 'Kata sandi baru berhasil disimpan. Silakan masuk dengan password baru Anda.'
      );
    } catch {
      setErrorMsg('Gagal menghubungi server untuk memverifikasi kode WhatsApp.');
    } finally {
      setIsVerifyingRecovery(false);
    }
  };

  const showDbWarningBanner = Boolean(dbHealth && dbHealth.checked && !dbHealth.success);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center p-4 selection:bg-blue-600 selection:text-white font-sans antialiased">
      {/* Centered Flat Portal Card */}
      <div className="w-full max-w-[460px] rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
        {/* Clean Flat Header */}
        <div className="px-6 pt-6 pb-5 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-center">
          <div className="flex justify-center mb-2.5">
            <AkkLogo size="md" showText={true} showSubtitle={false} />
          </div>

          <p className="text-slate-500 dark:text-slate-400 text-xs leading-relaxed max-w-xs mx-auto">
            Portal Akses Logistik Terintegrasi &amp; Pengiriman PT Anugrah Kemasan Kreatif.
          </p>

          {/* Segmented Tab Switcher */}
          {tab === 'forgot' ? (
            <div className="flex items-center justify-between mt-5 pt-3.5 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => {
                  setTab('login');
                  setRecoveryStep('request');
                  setErrorMsg('');
                  setSuccessMsg('');
                }}
                className="inline-flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-300 hover:text-blue-600 font-semibold transition-colors cursor-pointer group"
              >
                <ArrowLeft className="w-3.5 h-3.5 group-hover:-translate-x-0.5 transition-transform" />
                <span>Kembali ke Masuk</span>
              </button>
              <span className="text-xs font-semibold px-2.5 py-1 rounded-md bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                Reset Password
              </span>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-1 mt-5 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl border border-slate-200 dark:border-slate-700">
              <button
                type="button"
                onClick={() => { setTab('login'); setErrorMsg(''); setSuccessMsg(''); }}
                className={`flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                  tab === 'login'
                    ? 'bg-blue-600 text-white'
                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <LogIn className="w-3.5 h-3.5" />
                <span>Masuk (Login)</span>
              </button>

              <button
                type="button"
                onClick={() => { setTab('register'); setErrorMsg(''); setSuccessMsg(''); }}
                className={`flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                  tab === 'register'
                    ? 'bg-blue-600 text-white'
                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>Daftar Akun</span>
              </button>
            </div>
          )}
        </div>

        {/* Database Status & Circuit Breaker Banner */}
        {showDbWarningBanner && dbHealth && (
          <div className="mx-6 mt-5 p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/80 text-xs space-y-2.5">
            <div className="flex items-start gap-2.5">
              <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-amber-950 dark:text-amber-200">
                  {dbHealth.circuitBreaker.isOpen
                    ? 'Koneksi database sedang dipulihkan sementara'
                    : 'Server database belum terhubung'}
                </div>
                <p className="text-amber-800 dark:text-amber-300/90 mt-0.5 leading-relaxed">
                  {!dbHealth.configured && dbHealth.missingEnvVars.length > 0
                    ? `Variabel konfigurasi (${dbHealth.missingEnvVars.join(', ')}) belum aktif. Sistem memakai mode cache lokal.`
                    : 'Autentikasi database utama sedang terganggu. Anda dapat mencoba menghubungkan ulang atau hubungi admin.'}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-amber-200/70 dark:border-amber-800/60">
              <button
                type="button"
                onClick={() => setShowAdminDbDetails(prev => !prev)}
                className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-800 dark:text-amber-300 hover:text-amber-950 cursor-pointer"
              >
                <Database className="w-3.5 h-3.5" />
                <span>Info Teknis Admin</span>
                <ChevronDown className={`w-3 h-3 transition-transform ${showAdminDbDetails ? 'rotate-180' : ''}`} />
              </button>

              <button
                type="button"
                disabled={isReconnectingDb}
                onClick={handleReconnectDatabase}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white dark:bg-slate-900 hover:bg-amber-100/60 border border-amber-300 dark:border-amber-700 text-amber-900 dark:text-amber-200 text-[11px] font-semibold transition-colors cursor-pointer disabled:opacity-60"
              >
                <RefreshCw className={`w-3 h-3 ${isReconnectingDb ? 'animate-spin' : ''}`} />
                <span>{isReconnectingDb ? 'Menghubungkan...' : 'Coba Hubungkan Ulang'}</span>
              </button>
            </div>

            {showAdminDbDetails && (
              <div className="p-2.5 rounded-lg bg-white dark:bg-slate-900 border border-amber-200/80 dark:border-slate-800 text-[11px] text-slate-600 dark:text-slate-300 space-y-1 font-mono">
                <div className="flex justify-between gap-2">
                  <span>Host / Port:</span>
                  <span className="font-semibold text-slate-900 dark:text-white">{dbHealth.dbHost}:{dbHealth.dbPort}</span>
                </div>
                <div className="flex justify-between gap-2">
                  <span>DB_NAME:</span>
                  <span className="font-semibold text-slate-900 dark:text-white">{dbHealth.dbName || '(kosong)'}</span>
                </div>
                <div className="flex justify-between gap-2">
                  <span>DB_USER / DB_PASSWORD:</span>
                  <span className="font-semibold text-slate-900 dark:text-white">
                    {dbHealth.hasUserConfigured ? 'Terisi' : 'Kosong'} / {dbHealth.hasPasswordConfigured ? 'Terisi' : 'Kosong'}
                  </span>
                </div>
                <div className="flex justify-between gap-2">
                  <span>Circuit Breaker:</span>
                  <span className="font-semibold text-amber-700 dark:text-amber-400">
                    {dbHealth.circuitBreaker.isOpen
                      ? `Aktif (${dbHealth.circuitBreaker.remainingSeconds}s)`
                      : 'Siap'}
                  </span>
                </div>
              </div>
            )}
          </div>
        )}

        {dbRestoredNotice && dbHealth?.success && (
          <div className="mx-6 mt-5 p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span className="font-semibold">Koneksi database berhasil dipulihkan. Silakan masuk ke akun Anda.</span>
          </div>
        )}

        {/* Alert Banners */}
        {isLocked && (
          <div className="mx-6 mt-4 p-3 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs flex items-start gap-2.5">
            <Lock className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
            <div>
              <strong>Akses Dibekukan:</strong> Terlalu banyak percobaan gagal. Silakan tunggu{' '}
              <span className="font-mono font-bold text-rose-900 dark:text-rose-200 tabular-nums">{countdown} detik</span>.
            </div>
          </div>
        )}

        {!isLocked && errorMsg && (
          <div className="mx-6 mt-4 p-3 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
            <span className="leading-relaxed">{errorMsg}</span>
          </div>
        )}

        {successMsg && (
          <div className="mx-6 mt-4 p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span className="font-semibold">{successMsg}</span>
          </div>
        )}

        {/* Card Body */}
        <div className="p-6 sm:p-7 bg-white dark:bg-slate-900">
          {tab === 'login' ? (
            /* ======================================================== */
            /* TAB 1: MASUK (LOGIN)                                      */
            /* ======================================================== */
            <form onSubmit={handleLogin} className="space-y-4">
              {/* Field Email / Username */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Email / Username
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    required
                    autoComplete="username"
                    disabled={isLocked || isLoading}
                    placeholder="nama@domain.com atau username"
                    value={loginEmail}
                    onChange={(e) => {
                      setLoginEmail(e.target.value);
                      if (errorMsg) setErrorMsg('');
                    }}
                    className="w-full pl-10 pr-3.5 py-2.5 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white placeholder-slate-400 text-sm focus:outline-none focus:bg-white dark:focus:bg-slate-950 focus:border-blue-600 focus:ring-2 focus:ring-blue-600/15 transition-colors disabled:opacity-50"
                  />
                </div>
              </div>

              {/* Field Password */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Password</label>
                  <button
                    type="button"
                    onClick={() => {
                      setTab('forgot');
                      setRecoveryStep('request');
                      if (trimmedInput) setRecoveryInput(trimmedInput);
                      setErrorMsg('');
                      setSuccessMsg('');
                    }}
                    className="text-xs text-blue-600 hover:text-blue-700 dark:text-blue-400 font-semibold transition-colors cursor-pointer"
                  >
                    Lupa Password?
                  </button>
                </div>
                <div className="relative">
                  <KeyRound className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    autoComplete="current-password"
                    disabled={isLocked || isLoading}
                    placeholder="Masukkan password"
                    value={loginPassword}
                    onChange={(e) => {
                      setLoginPassword(e.target.value);
                      if (errorMsg) setErrorMsg('');
                    }}
                    className="w-full pl-10 pr-10 py-2.5 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white placeholder-slate-400 text-sm focus:outline-none focus:bg-white dark:focus:bg-slate-950 focus:border-blue-600 focus:ring-2 focus:ring-blue-600/15 transition-colors disabled:opacity-50"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer p-1"
                    title={showPassword ? 'Sembunyikan password' : 'Lihat password'}
                    aria-label={showPassword ? 'Sembunyikan password' : 'Lihat password'}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Tombol Submit Masuk ke Portal AKK */}
              <button
                type="submit"
                disabled={isLocked || isLoading}
                className="w-full mt-1 py-2.5 px-4 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm flex items-center justify-center gap-2 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Masuk...</span>
                  </>
                ) : (
                  <>
                    <LogIn className="w-4 h-4" />
                    <span>Masuk ke Portal AKK</span>
                  </>
                )}
              </button>
            </form>
          ) : tab === 'register' ? (
            /* ======================================================== */
            /* TAB 2: DAFTAR AKUN                                        */
            /* ======================================================== */
            <form onSubmit={handleRegister} className="space-y-3.5">
              {/* Nama Lengkap */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Nama Lengkap
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    required
                    placeholder="Contoh: Bayu Dimas Permana"
                    value={registerData.fullName}
                    onChange={(e) => setRegisterData({ ...registerData, fullName: e.target.value })}
                    className="w-full pl-10 pr-3.5 py-2.5 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white placeholder-slate-400 text-sm focus:outline-none focus:bg-white dark:focus:bg-slate-950 focus:border-blue-600 focus:ring-2 focus:ring-blue-600/15 transition-colors"
                  />
                </div>
              </div>

              {/* Email & No. WhatsApp (2 Kolom) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Email</label>
                  <input
                    type="email"
                    required
                    placeholder="nama@gmail.com"
                    value={registerData.email}
                    onChange={(e) => setRegisterData({ ...registerData, email: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white placeholder-slate-400 text-sm focus:outline-none focus:bg-white dark:focus:bg-slate-950 focus:border-blue-600 focus:ring-2 focus:ring-blue-600/15 transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">No. WhatsApp</label>
                  <input
                    type="text"
                    placeholder="+62 812-..."
                    value={registerData.phone}
                    onChange={(e) => setRegisterData({ ...registerData, phone: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white placeholder-slate-400 text-sm focus:outline-none focus:bg-white dark:focus:bg-slate-950 focus:border-blue-600 focus:ring-2 focus:ring-blue-600/15 transition-colors"
                  />
                </div>
              </div>

              {/* Password & Konfirmasi Password (2 Kolom) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Password</label>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    minLength={8}
                    placeholder="Min. 8 karakter"
                    value={registerData.password}
                    onChange={(e) => setRegisterData({ ...registerData, password: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white placeholder-slate-400 text-sm focus:outline-none focus:bg-white dark:focus:bg-slate-950 focus:border-blue-600 focus:ring-2 focus:ring-blue-600/15 transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Konfirmasi Password</label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      minLength={8}
                      placeholder="Ulangi password"
                      value={registerData.confirmPassword}
                      onChange={(e) => setRegisterData({ ...registerData, confirmPassword: e.target.value })}
                      className="w-full pl-3.5 pr-9 py-2.5 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white placeholder-slate-400 text-sm focus:outline-none focus:bg-white dark:focus:bg-slate-950 focus:border-blue-600 focus:ring-2 focus:ring-blue-600/15 transition-colors"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer p-1"
                      aria-label={showPassword ? 'Sembunyikan password' : 'Lihat password'}
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              </div>

              {/* Prosedur Verifikasi Akun AKK Box */}
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 text-xs leading-relaxed flex items-start gap-2.5">
                <Clock className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
                <div>
                  <strong className="block text-slate-900 dark:text-white font-semibold">Prosedur Verifikasi Akun AKK:</strong>
                  Akun baru wajib disetujui oleh Super Admin PT Anugrah Kemasan Kreatif sebelum mendapatkan otorisasi akses menu.
                </div>
              </div>

              {/* Tombol Kirim Pendaftaran Akun */}
              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-2.5 px-4 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm flex items-center justify-center gap-2 transition-colors cursor-pointer disabled:opacity-50"
              >
                {isLoading ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Mengirim Pendaftaran...</span>
                  </>
                ) : (
                  <span>Kirim Pendaftaran Akun</span>
                )}
              </button>
            </form>
          ) : (
            /* ======================================================== */
            /* TAB 3: LUPA PASSWORD (OTP LANGSUNG KE WHATSAPP USER)      */
            /* ======================================================== */
            <div className="space-y-4">
              {recoveryStep === 'request' ? (
                <form onSubmit={handleRequestRecovery} className="space-y-4">
                  <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 text-xs leading-relaxed flex items-start gap-2.5">
                    <Phone className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
                    <div>
                      <strong className="block text-slate-900 dark:text-white font-semibold mb-0.5">
                        Verifikasi via WhatsApp Terdaftar
                      </strong>
                      Masukkan <strong>Email</strong>, <strong>Username</strong>, atau <strong>No. WhatsApp</strong> akun terdaftar. Kode OTP 6-digit akan dikirim ke WhatsApp Anda.
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                      Email / Username / No. WhatsApp Akun
                    </label>
                    <input
                      type="text"
                      required
                      disabled={isSendingRecovery}
                      placeholder="Contoh: Pipit Istiani atau 0812..."
                      value={recoveryInput}
                      onChange={(e) => {
                        setRecoveryInput(e.target.value);
                        if (errorMsg) setErrorMsg('');
                        if (successMsg) setSuccessMsg('');
                      }}
                      className="w-full px-3.5 py-2.5 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white text-sm focus:outline-none focus:bg-white dark:focus:bg-slate-950 focus:border-blue-600 focus:ring-2 focus:ring-blue-600/15 disabled:opacity-50"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={isSendingRecovery}
                    className="w-full py-2.5 px-4 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm flex items-center justify-center gap-2 transition-colors cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {isSendingRecovery ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span>Mengirim Kode ke WhatsApp...</span>
                      </>
                    ) : (
                      <>
                        <Send className="w-4 h-4" />
                        <span>Kirim Kode Verifikasi ke WhatsApp</span>
                      </>
                    )}
                  </button>
                </form>
              ) : (
                <form onSubmit={handleVerifyRecovery} className="space-y-3.5">
                  <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-1.5 text-xs">
                    <div className="flex items-center justify-between gap-2">
                      <span className="inline-flex items-center gap-1.5 font-semibold text-slate-900 dark:text-white">
                        <ShieldCheck className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                        <span>Terkirim ke WhatsApp User</span>
                      </span>
                      <span className="font-mono text-[11px] font-semibold px-2 py-0.5 rounded bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 tabular-nums">
                        {recoveryExpiresIn > 0 ? `Berlaku ${formatMmSs(recoveryExpiresIn)}` : 'Kedaluwarsa'}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-600 dark:text-slate-300 flex items-center justify-between">
                      <span>Akun: <strong>{recoveryAccountName || recoveryInput}</strong></span>
                      <span className="font-mono font-semibold text-slate-900 dark:text-white">{recoveryMaskedPhone || '-'}</span>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                      Kode Verifikasi WhatsApp (6 Digit)
                    </label>
                    <input
                      type="text"
                      inputMode="numeric"
                      required
                      maxLength={6}
                      disabled={isVerifyingRecovery}
                      placeholder="Masukkan 6 digit OTP"
                      value={recoveryCode}
                      onChange={(e) => {
                        setRecoveryCode(e.target.value.replace(/\D/g, '').slice(0, 6));
                        if (errorMsg) setErrorMsg('');
                      }}
                      className="w-full px-3.5 py-2.5 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white text-sm font-mono font-bold tracking-[0.35em] text-center focus:outline-none focus:bg-white dark:focus:bg-slate-950 focus:border-blue-600 focus:ring-2 focus:ring-blue-600/15"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                        Password Baru
                      </label>
                      <div className="relative">
                        <input
                          type={showNewPassword ? 'text' : 'password'}
                          required
                          minLength={8}
                          disabled={isVerifyingRecovery}
                          placeholder="Min. 8 karakter"
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          className="w-full pl-3.5 pr-9 py-2.5 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white text-sm focus:outline-none focus:bg-white dark:focus:bg-slate-950 focus:border-blue-600 focus:ring-2 focus:ring-blue-600/15"
                        />
                        <button
                          type="button"
                          onClick={() => setShowNewPassword(!showNewPassword)}
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer p-1"
                          aria-label={showNewPassword ? 'Sembunyikan password baru' : 'Lihat password baru'}
                        >
                          {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                        Ulangi Password
                      </label>
                      <input
                        type={showNewPassword ? 'text' : 'password'}
                        required
                        minLength={8}
                        disabled={isVerifyingRecovery}
                        placeholder="Konfirmasi password"
                        value={confirmNewPassword}
                        onChange={(e) => setConfirmNewPassword(e.target.value)}
                        className="w-full px-3.5 py-2.5 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white text-sm focus:outline-none focus:bg-white dark:focus:bg-slate-950 focus:border-blue-600 focus:ring-2 focus:ring-blue-600/15"
                      />
                    </div>
                  </div>

                  <div className="flex items-center gap-2 pt-1">
                    <button
                      type="button"
                      disabled={isSendingRecovery || recoveryResendCooldown > 0}
                      onClick={() => requestWhatsAppOtp(recoveryInput)}
                      className="px-3.5 py-2.5 rounded-lg bg-white dark:bg-slate-800 hover:bg-slate-50 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 font-semibold text-xs transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                    >
                      {recoveryResendCooldown > 0
                        ? `Kirim Ulang (${recoveryResendCooldown}s)`
                        : 'Kirim Ulang WA'}
                    </button>
                    <button
                      type="submit"
                      disabled={isVerifyingRecovery}
                      className="flex-1 py-2.5 px-4 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm flex items-center justify-center gap-2 transition-colors cursor-pointer disabled:opacity-60"
                    >
                      {isVerifyingRecovery ? (
                        <>
                          <RefreshCw className="w-4 h-4 animate-spin" />
                          <span>Memverifikasi...</span>
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="w-4 h-4" />
                          <span>Simpan Password Baru</span>
                        </>
                      )}
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
