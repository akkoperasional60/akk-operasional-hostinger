import React, { useState, useEffect, useMemo } from 'react';
import { AkkLogo } from './AkkLogo';
import { LogIn, UserPlus, KeyRound, Mail, User, Building, Phone, ShieldCheck, Clock, CheckCircle2, AlertCircle, X, Sparkles, Eye, EyeOff, Lock, ShieldAlert, ArrowLeft, Copy, Check, Send, RefreshCw } from 'lucide-react';
import { UserRole, UserProfile } from '../types';
import { logisticsStore } from '../services/store';

// Skema Validasi Format Ketat
const EMAIL_REGEX = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;
const USERNAME_REGEX = /^[a-zA-Z0-9._\-\s]{3,35}$/;

const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_DURATION_SECONDS = 60;
const STORAGE_FAILED_KEY = 'akk_auth_v3_failed_attempts';
const STORAGE_LOCKOUT_KEY = 'akk_auth_v3_lockout_until';

export interface RecoverySession {
  user: UserProfile;
  token: string;
  code: string;
  expiresAt: number;
  emailSentTo: string;
  timestamp: string;
}

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultTab?: 'login' | 'register' | 'forgot';
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  defaultTab = 'login'
}) => {
  const [tab, setTab] = useState<'login' | 'register' | 'forgot'>(defaultTab);
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // 🛡️ Proteksi Brute-Force: Melacak percobaan gagal & waktu penguncian
  const [failedAttempts, setFailedAttempts] = useState<number>(() => {
    try {
      localStorage.removeItem('akk_auth_failed_attempts');
      localStorage.removeItem('akk_auth_lockout_until');
      localStorage.removeItem('akk_auth_v2_failed_attempts');
      localStorage.removeItem('akk_auth_v2_lockout_until');
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

  // Interval hitung mundur pembekuan akses (cooldown)
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

  // Reset alert messages whenever modal opens or tab changes
  useEffect(() => {
    if (isOpen) {
      setErrorMsg('');
      setSuccessMsg('');
    }
  }, [isOpen, tab]);

  // Deteksi Dinamis Jenis Input (Email vs Username)
  const trimmedInput = loginEmail.trim();
  const inputType = useMemo<'empty' | 'email' | 'username'>(() => {
    if (!trimmedInput) return 'empty';
    return trimmedInput.includes('@') ? 'email' : 'username';
  }, [trimmedInput]);

  const isEmailValid = useMemo(() => {
    return inputType === 'email' && EMAIL_REGEX.test(trimmedInput);
  }, [inputType, trimmedInput]);

  const isUsernameValid = useMemo(() => {
    return inputType === 'username' && USERNAME_REGEX.test(trimmedInput);
  }, [inputType, trimmedInput]);

  const isLocked = countdown > 0;

  // Register Form
  const [registerData, setRegisterData] = useState({
    fullName: '',
    email: '',
    phone: '',
    role: 'unassigned' as UserRole,
    department: 'Logistik',
    password: '',
    confirmPassword: ''
  });

  // 🔑 State Pemulihan Kata Sandi (Lupa Password)
  const [recoveryInput, setRecoveryInput] = useState('');
  const [recoveryStep, setRecoveryStep] = useState<'request' | 'verify'>('request');
  const [recoverySession, setRecoverySession] = useState<RecoverySession | null>(null);
  const [verificationCodeInput, setVerificationCodeInput] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [isSendingCode, setIsSendingCode] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);

  const trimmedRecoveryInput = recoveryInput.trim();
  const recoveryInputType = useMemo<'empty' | 'email' | 'username'>(() => {
    if (!trimmedRecoveryInput) return 'empty';
    return trimmedRecoveryInput.includes('@') ? 'email' : 'username';
  }, [trimmedRecoveryInput]);

  const handleOpenForgotPassword = () => {
    setTab('forgot');
    setErrorMsg('');
    setSuccessMsg('');
    if (trimmedInput) {
      setRecoveryInput(trimmedInput);
    }
  };

  const handleRequestRecovery = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');
    if (!recoveryInput.trim()) {
      setErrorMsg('Silakan masukkan email atau username akun Anda.');
      return;
    }
    setRecoveryStep('request');
    setRecoverySession(null);
    setSuccessMsg('Reset password mandiri dinonaktifkan demi keamanan. Hubungi Super Admin untuk verifikasi identitas dan reset password dari User Management.');
  };

  const handleVerifyAndResetPassword = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('Kode pemulihan simulasi sudah dinonaktifkan. Hubungi Super Admin.');
  };

  if (!isOpen) return null;

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');
    if (isLocked) {
      setErrorMsg(`Akses login sedang dikunci sementara karena ${MAX_FAILED_ATTEMPTS} kali percobaan gagal. Silakan tunggu ${countdown} detik.`);
      return;
    }
    if (!trimmedInput) {
      setErrorMsg('Silakan masukkan Email atau Username akun Anda.');
      return;
    }
    if (inputType === 'email' && !EMAIL_REGEX.test(trimmedInput)) {
      setErrorMsg('Format email tidak valid.');
      return;
    }
    if (inputType === 'username' && (trimmedInput.length < 3 || !USERNAME_REGEX.test(trimmedInput))) {
      setErrorMsg('Format username tidak valid.');
      return;
    }
    if (!loginPassword.trim()) {
      setErrorMsg('Silakan masukkan password akun Anda.');
      return;
    }

    const user = await logisticsStore.loginUserRemote(trimmedInput, loginPassword.trim());
    if (!user) {
      const authError = logisticsStore.getLastAuthError();
      if (authError && authError.status === 503) {
        setErrorMsg(authError.message);
        return;
      }
      if (authError && authError.status === 403) {
        setErrorMsg(authError.message);
        return;
      }
      const nextFailed = failedAttempts + 1;
      setFailedAttempts(nextFailed);
      try { localStorage.setItem(STORAGE_FAILED_KEY, String(nextFailed)); } catch {}
      if (nextFailed >= MAX_FAILED_ATTEMPTS) {
        const lockoutTime = Date.now() + (LOCKOUT_DURATION_SECONDS * 1000);
        setLockoutUntil(lockoutTime);
        setCountdown(LOCKOUT_DURATION_SECONDS);
        try { localStorage.setItem(STORAGE_LOCKOUT_KEY, String(lockoutTime)); } catch {}
        setErrorMsg(`Terlalu banyak percobaan gagal (${MAX_FAILED_ATTEMPTS}x). Login dikunci sementara selama ${LOCKOUT_DURATION_SECONDS} detik.`);
      } else {
        const remaining = MAX_FAILED_ATTEMPTS - nextFailed;
        setErrorMsg(`${authError?.message || `${inputType === 'email' ? 'Email' : 'Username'} atau Password salah.`} (Sisa kesempatan: ${remaining}x)`);
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
    setSuccessMsg(user.role === 'super_admin' ? 'Berhasil masuk sebagai Super Admin' : `Berhasil masuk sebagai ${user.fullName}`);
    setTimeout(() => onClose(), 500);
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    if (!registerData.fullName.trim() || !registerData.email.trim()) {
      setErrorMsg('Nama lengkap dan email wajib diisi.');
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

    const newUser = await logisticsStore.registerUserRemote({
      fullName: registerData.fullName.trim(),
      email: registerData.email.trim(),
      phone: registerData.phone.trim(),
      department: registerData.department || 'Logistik',
      password: registerData.password
    });
    if (!newUser) {
      setErrorMsg('Pendaftaran gagal. Email mungkin sudah terdaftar atau database Hostinger belum dapat diakses.');
      return;
    }
    setSuccessMsg(`Pendaftaran berhasil! Akun "${newUser.fullName}" menunggu persetujuan Super Admin.`);
    setTimeout(() => {
      setTab('login');
      setSuccessMsg('Pendaftaran berhasil. Akun belum dapat masuk sebelum disetujui Super Admin.');
    }, 1500);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl relative">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Brand Header */}
        <div className="p-6 bg-gradient-to-b from-slate-950 via-slate-900 to-slate-900 border-b border-slate-800 text-center">
          <div className="flex justify-center mb-3">
            <AkkLogo size="lg" />
          </div>
          <p className="text-slate-400 text-xs mt-2 max-w-md mx-auto">
            Portal Akses Logistik Terintegrasi & Pengiriman Luar Pulau PT Anugrah Kemasan Kreatif.
          </p>

          {/* Tab Switcher */}
          {tab === 'forgot' ? (
            <div className="flex items-center justify-between mt-5 max-w-sm mx-auto px-1">
              <button
                type="button"
                onClick={() => { setTab('login'); setErrorMsg(''); setSuccessMsg(''); }}
                className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition-colors cursor-pointer group"
              >
                <ArrowLeft className="w-3.5 h-3.5 group-hover:-translate-x-0.5 transition-transform" />
                <span>Kembali ke Masuk (Login)</span>
              </button>
              <div className="text-xs font-semibold text-amber-400 flex items-center gap-1.5">
                <KeyRound className="w-3.5 h-3.5" />
                <span>Pemulihan Kata Sandi</span>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center gap-2 mt-5 bg-slate-950 p-1 rounded-xl border border-slate-800 max-w-xs mx-auto">
              <button
                onClick={() => { setTab('login'); setErrorMsg(''); }}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-bold transition cursor-pointer ${
                  tab === 'login'
                    ? 'bg-amber-600 text-slate-950 shadow'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <LogIn className="w-3.5 h-3.5" />
                <span>Masuk (Login)</span>
              </button>
              <button
                onClick={() => { setTab('register'); setErrorMsg(''); }}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-bold transition cursor-pointer ${
                  tab === 'register'
                    ? 'bg-amber-600 text-slate-950 shadow'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>Daftar Akun</span>
              </button>
            </div>
          )}
        </div>

        {/* Banner Proteksi Brute-Force saat Akun Terkunci */}
        {isLocked && (
          <div className="mx-6 mt-4 p-3.5 rounded-xl bg-rose-950/80 border border-rose-500/50 text-rose-200 text-xs shadow-lg flex items-start gap-3 animate-pulse">
            <div className="w-8 h-8 rounded-lg bg-rose-500/20 border border-rose-500/40 flex items-center justify-center text-rose-400 shrink-0">
              <Lock className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="font-black text-rose-300 text-xs flex items-center gap-2">
                <span>Proteksi Keamanan: Akun Dibekukan</span>
                <span className="font-mono bg-rose-500/30 text-rose-200 px-2 py-0.5 rounded text-[10px]">
                  {countdown} Detik
                </span>
              </div>
              <p className="text-[11px] text-rose-300/90 mt-1 leading-relaxed">
                Telah terdeteksi {MAX_FAILED_ATTEMPTS} kali percobaan login gagal berturut-turut. Demi mencegah serangan brute-force, sistem mengunci akses masuk sementara.
              </p>
            </div>
          </div>
        )}

        {/* Notifications */}
        {!isLocked && errorMsg && (
          <div className="mx-6 mt-4 p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
            <span>{errorMsg}</span>
          </div>
        )}

        {successMsg && (
          <div className="mx-6 mt-4 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Form Body */}
        <div className="p-6">
          {tab === 'login' ? (
            <div className="space-y-4">
              <form onSubmit={handleLogin} className="space-y-4 text-xs">
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-slate-300 font-semibold">Email / Username</label>
                    {inputType !== 'empty' && (
                      <span
                        className={`text-[10px] px-2 py-0.5 rounded-full font-mono font-bold flex items-center gap-1 border transition-all ${
                          inputType === 'email'
                            ? isEmailValid
                              ? 'bg-cyan-950/80 text-cyan-300 border-cyan-500/40'
                              : 'bg-amber-950/80 text-amber-300 border-amber-500/40'
                            : isUsernameValid
                              ? 'bg-emerald-950/80 text-emerald-300 border-emerald-500/40'
                              : 'bg-amber-950/80 text-amber-300 border-amber-500/40'
                        }`}
                      >
                        {inputType === 'email' ? '📧 Mode Email' : '👤 Mode Username'}
                        {((inputType === 'email' && isEmailValid) || (inputType === 'username' && isUsernameValid)) && (
                          <span className="text-[9px] text-emerald-400">✓ Valid</span>
                        )}
                      </span>
                    )}
                  </div>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
                    <input
                      type="text"
                      required
                      disabled={isLocked}
                      placeholder="Masukkan email (nama@domain.com) atau username (Budiono, admin, dll)"
                      value={loginEmail}
                      onChange={(e) => {
                        setLoginEmail(e.target.value);
                        if (errorMsg) setErrorMsg('');
                        if (successMsg) setSuccessMsg('');
                      }}
                      className={`w-full pl-9 pr-3 py-2.5 rounded-lg bg-slate-950 border text-white placeholder-slate-500 focus:outline-none transition ${
                        isLocked
                          ? 'border-rose-900/50 opacity-50 cursor-not-allowed bg-slate-900'
                          : inputType !== 'empty' && !isEmailValid && !isUsernameValid
                            ? 'border-amber-500/60 focus:border-amber-500'
                            : 'border-slate-800 focus:border-amber-500'
                      }`}
                    />
                  </div>
                  {/* Petunjuk Format Validasi Realtime */}
                  {inputType === 'email' && !isEmailValid && (
                    <p className="text-[10px] text-amber-400 mt-1">
                      • Format email harus lengkap dengan tanda @ dan domain (contoh: user@akk-packaging.co.id)
                    </p>
                  )}
                  {inputType === 'username' && !isUsernameValid && trimmedInput.length > 0 && (
                    <p className="text-[10px] text-amber-400 mt-1">
                      • Username minimal 3 karakter (hanya huruf, angka, titik, strip, garis bawah, spasi)
                    </p>
                  )}
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-slate-300 font-semibold">Password</label>
                    <button
                      type="button"
                      onClick={handleOpenForgotPassword}
                      className="text-[11px] text-amber-400 hover:text-amber-300 transition-colors hover:underline cursor-pointer font-medium"
                    >
                      Lupa Password?
                    </button>
                  </div>
                  <div className="relative">
                    <KeyRound className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      disabled={isLocked}
                      placeholder="••••••••"
                      value={loginPassword}
                      onChange={(e) => {
                        setLoginPassword(e.target.value);
                        if (errorMsg) setErrorMsg('');
                        if (successMsg) setSuccessMsg('');
                      }}
                      className={`w-full pl-9 pr-10 py-2.5 rounded-lg bg-slate-950 border text-white placeholder-slate-500 focus:outline-none transition ${
                        isLocked ? 'border-rose-900/50 opacity-50 cursor-not-allowed bg-slate-900' : 'border-slate-800 focus:border-amber-500'
                      }`}
                    />
                    <button
                      type="button"
                      disabled={isLocked}
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-3 text-slate-400 hover:text-white cursor-pointer disabled:opacity-40"
                      title={showPassword ? 'Sembunyikan password' : 'Lihat password'}
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Indikator Percobaan Gagal & Proteksi Brute-Force */}
                {failedAttempts > 0 && !isLocked && (
                  <div className="p-2 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-between text-[11px] text-amber-300">
                    <span className="flex items-center gap-1.5 font-medium">
                      <ShieldAlert className="w-3.5 h-3.5 text-amber-400" />
                      Percobaan Gagal: {failedAttempts} dari {MAX_FAILED_ATTEMPTS}
                    </span>
                    <span className="font-mono text-[10px] bg-amber-500/20 px-1.5 py-0.5 rounded text-amber-200">
                      Sisa {MAX_FAILED_ATTEMPTS - failedAttempts}x
                    </span>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isLocked}
                  className={`w-full py-3 rounded-lg font-bold text-xs shadow-lg transition flex items-center justify-center gap-2 ${
                    isLocked
                      ? 'bg-rose-950 text-rose-300 border border-rose-500/40 cursor-not-allowed opacity-80'
                      : 'bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-amber-500/20 cursor-pointer active:scale-95'
                  }`}
                >
                  {isLocked ? (
                    <>
                      <Lock className="w-4 h-4 animate-bounce" />
                      <span>Akses Dibekukan — Coba Lagi ({countdown}s)</span>
                    </>
                  ) : (
                    <>
                      <LogIn className="w-4 h-4" />
                      <span>Masuk ke Portal AKK</span>
                    </>
                  )}
                </button>
              </form>
            </div>
          ) : tab === 'register' ? (
            <form onSubmit={handleRegister} className="space-y-3.5 text-xs">
              <div>
                <label className="text-slate-300 font-semibold block mb-1">Nama Lengkap</label>
                <div className="relative">
                  <User className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    required
                    placeholder="Contoh: Bayu Dimas Permana"
                    value={registerData.fullName}
                    onChange={(e) => setRegisterData({ ...registerData, fullName: e.target.value })}
                    className="w-full pl-9 pr-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-300 font-semibold block mb-1">Email</label>
                  <input
                    type="email"
                    required
                    placeholder="nama@gmail.com"
                    value={registerData.email}
                    onChange={(e) => setRegisterData({ ...registerData, email: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
                  />
                </div>
                <div>
                  <label className="text-slate-300 font-semibold block mb-1">No. WhatsApp</label>
                  <input
                    type="text"
                    placeholder="+62 812-..."
                    value={registerData.phone}
                    onChange={(e) => setRegisterData({ ...registerData, phone: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="relative">
                  <label className="text-slate-300 font-semibold block mb-1">Password</label>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Minimal 6 karakter"
                    value={registerData.password}
                    onChange={(e) => setRegisterData({ ...registerData, password: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-white"
                  />
                </div>
                <div className="relative">
                  <label className="text-slate-300 font-semibold block mb-1">Konfirmasi Password</label>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Ulangi password"
                    value={registerData.confirmPassword}
                    onChange={(e) => setRegisterData({ ...registerData, confirmPassword: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-white"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-8 text-slate-400 hover:text-white cursor-pointer"
                  >
                    {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              {/* Approval Notice */}
              <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-300 text-[11px] flex items-start gap-2">
                <Clock className="w-4 h-4 shrink-0 text-amber-400 mt-0.5" />
                <div>
                  <strong className="block text-amber-300 font-bold">Prosedur Verifikasi Akun AKK:</strong>
                  Pendaftaran akun baru wajib disetujui (di-approve) oleh Super Admin PT Anugrah Kemasan Kreatif sebelum mendapatkan otorisasi akses menu.
                </div>
              </div>

              <button
                type="submit"
                className="w-full py-2.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs shadow-lg shadow-amber-500/20 transition cursor-pointer"
              >
                Kirim Pendaftaran Akun
              </button>
            </form>
          ) : (
            /* Tab Lupa Password / Pemulihan Kata Sandi */
            <div className="space-y-4 text-xs">
              {recoveryStep === 'request' ? (
                <form onSubmit={handleRequestRecovery} className="space-y-4">
                  <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-slate-300 text-xs">
                    <p className="leading-relaxed">
                      Lupa kata sandi akun Anda? Masukkan <strong>Email</strong> atau <strong>Username</strong> terdaftar. Sistem akan membuat token pemulihan aman dan mengirimkan kode verifikasi 6-digit ke email terdaftar via simulasi layanan AKK Mail.
                    </p>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="text-slate-300 font-semibold">Email / Username Akun</label>
                      {recoveryInputType !== 'empty' && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full font-mono font-bold bg-slate-800 text-slate-300 border border-slate-700">
                          {recoveryInputType === 'email' ? '📧 Mode Email' : '👤 Mode Username'}
                        </span>
                      )}
                    </div>
                    <div className="relative">
                      <Mail className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
                      <input
                        type="text"
                        required
                        disabled={isSendingCode}
                        placeholder="Contoh: budiono@gmail.com atau Budiono"
                        value={recoveryInput}
                        onChange={(e) => {
                          setRecoveryInput(e.target.value);
                          if (errorMsg) setErrorMsg('');
                          if (successMsg) setSuccessMsg('');
                        }}
                        className="w-full pl-9 pr-3 py-2.5 rounded-lg bg-slate-950 border border-slate-800 text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
                      />
                    </div>
                  </div>

                  <div className="flex items-center gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => { setTab('login'); setErrorMsg(''); setSuccessMsg(''); }}
                      className="flex-1 py-2.5 rounded-lg border border-slate-800 text-slate-400 hover:text-white hover:bg-slate-800/60 font-semibold transition cursor-pointer"
                    >
                      Batal
                    </button>
                    <button
                      type="submit"
                      disabled={isSendingCode}
                      className="flex-1 py-2.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                    >
                      {isSendingCode ? (
                        <>
                          <RefreshCw className="w-4 h-4 animate-spin" />
                          <span>Mengirim...</span>
                        </>
                      ) : (
                        <>
                          <Send className="w-4 h-4" />
                          <span>Generate & Kirim Kode</span>
                        </>
                      )}
                    </button>
                  </div>
                </form>
              ) : (
                <form onSubmit={handleVerifyAndResetPassword} className="space-y-4">
                  {/* Simulated Service Card */}
                  {recoverySession && (
                    <div className="p-3.5 rounded-xl bg-slate-950 border border-emerald-500/40 shadow-xl space-y-2.5">
                      <div className="flex items-center justify-between pb-2 border-b border-slate-800/80">
                        <div className="flex items-center gap-2 text-emerald-400 text-xs font-bold">
                          <Mail className="w-4 h-4" />
                          <span>Simulasi Layanan Email AKK</span>
                        </div>
                        <span className="text-[10px] font-mono text-emerald-300 bg-emerald-950/80 px-2 py-0.5 rounded border border-emerald-500/30">
                          SMTP 250 OK
                        </span>
                      </div>

                      <div className="space-y-1 text-[11px] text-slate-300">
                        <div className="flex items-center justify-between">
                          <span className="text-slate-500">Penerima Email:</span>
                          <span className="font-mono text-white font-semibold">{recoverySession.emailSentTo}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-slate-500">Token Pemulihan Aman:</span>
                          <span className="font-mono text-amber-300 bg-amber-950/60 px-1.5 py-0.5 rounded border border-amber-500/30 text-[10px]">
                            {recoverySession.token}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-slate-500">Masa Berlaku:</span>
                          <span className="text-slate-400">15 Menit ({recoverySession.timestamp})</span>
                        </div>
                      </div>

                      {/* Verification Code Box with 1-click copy */}
                      <div className="p-2.5 rounded-lg bg-emerald-950/40 border border-emerald-500/30 flex items-center justify-between">
                        <div>
                          <span className="text-[10px] text-emerald-400 font-bold uppercase tracking-wider block">
                            Kode Verifikasi 6-Digit
                          </span>
                          <span className="text-xl font-black font-mono tracking-widest text-emerald-300">
                            {recoverySession.code}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setVerificationCodeInput(recoverySession.code);
                            setCopiedCode(true);
                            setTimeout(() => setCopiedCode(false), 2000);
                          }}
                          className="px-2.5 py-1.5 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 text-[11px] font-bold transition flex items-center gap-1.5 cursor-pointer active:scale-95"
                          title="Salin dan tempel ke kolom kode verifikasi"
                        >
                          {copiedCode ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                          <span>{copiedCode ? 'Tersalin' : 'Salin & Isi'}</span>
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Verification Input */}
                  <div>
                    <label className="text-slate-300 font-semibold block mb-1">
                      Masukkan Kode Verifikasi 6-Digit
                    </label>
                    <input
                      type="text"
                      required
                      maxLength={6}
                      placeholder="Contoh: 123456"
                      value={verificationCodeInput}
                      onChange={(e) => {
                        setVerificationCodeInput(e.target.value.replace(/\D/g, ''));
                        if (errorMsg) setErrorMsg('');
                      }}
                      className="w-full text-center tracking-widest text-lg font-mono font-bold py-2 rounded-lg bg-slate-950 border border-slate-800 text-emerald-400 focus:outline-none focus:border-emerald-500 placeholder-slate-700"
                    />
                  </div>

                  {/* New Password & Confirm */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="relative">
                      <label className="text-slate-300 font-semibold block mb-1">Password Baru</label>
                      <input
                        type={showNewPassword ? 'text' : 'password'}
                        required
                        placeholder="Minimal 4 karakter"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-white focus:outline-none focus:border-amber-500"
                      />
                    </div>
                    <div className="relative">
                      <label className="text-slate-300 font-semibold block mb-1">Konfirmasi Password</label>
                      <input
                        type={showNewPassword ? 'text' : 'password'}
                        required
                        placeholder="Ulangi password baru"
                        value={confirmNewPassword}
                        onChange={(e) => setConfirmNewPassword(e.target.value)}
                        className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-white focus:outline-none focus:border-amber-500"
                      />
                      <button
                        type="button"
                        onClick={() => setShowNewPassword(!showNewPassword)}
                        className="absolute right-3 top-8 text-slate-400 hover:text-white cursor-pointer"
                      >
                        {showNewPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => {
                        setRecoveryStep('request');
                        setErrorMsg('');
                        setSuccessMsg('');
                      }}
                      className="py-2.5 px-3 rounded-lg border border-slate-800 text-slate-400 hover:text-white hover:bg-slate-800/60 font-semibold transition cursor-pointer text-center"
                    >
                      Kirim Ulang
                    </button>
                    <button
                      type="submit"
                      className="flex-1 py-2.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold transition flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-emerald-500/20"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Simpan Password Baru</span>
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
