import React, { useState, useEffect, useMemo } from 'react';
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
  Eye,
  EyeOff,
  Lock,
  ArrowLeft,
  Send,
  X
} from 'lucide-react';
import { UserRole, UserProfile } from '../types';
import { logisticsStore } from '../services/store';

const EMAIL_REGEX = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;
const USERNAME_REGEX = /^[a-zA-Z0-9._\-\s]{3,40}$/;

const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_DURATION_SECONDS = 60;
const STORAGE_FAILED_KEY = 'akk_auth_v3_failed_attempts';
const STORAGE_LOCKOUT_KEY = 'akk_auth_v3_lockout_until';

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

  // Register Form State
  const [registerData, setRegisterData] = useState({
    fullName: '',
    email: '',
    phone: '',
    role: 'unassigned' as UserRole,
    department: 'Logistik',
    password: '',
    confirmPassword: ''
  });

  // Forgot Password / Recovery State
  const [recoveryInput, setRecoveryInput] = useState('');
  const [recoveryStep, setRecoveryStep] = useState<'request' | 'verify'>('request');
  const [recoveryCode, setRecoveryCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [targetRecoveryUser, setTargetRecoveryUser] = useState<UserProfile | null>(null);

  // Rate Limiting
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

  const trimmedInput = loginEmail.trim();
  const isLocked = countdown > 0;

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    if (isLocked) {
      setErrorMsg(`Akses login sedang dikunci sementara karena ${MAX_FAILED_ATTEMPTS} kali percobaan gagal. Silakan tunggu ${countdown} detik.`);
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
      if (authError && (authError.status === 503 || authError.status === 403)) {
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
        setErrorMsg(`Terlalu banyak percobaan gagal (${MAX_FAILED_ATTEMPTS}x). Demi keamanan, login dikunci sementara selama ${LOCKOUT_DURATION_SECONDS} detik.`);
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
    }, 350);
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
      setErrorMsg('Pendaftaran gagal. Email mungkin sudah terdaftar atau database Hostinger belum dapat diakses.');
      return;
    }

    setSuccessMsg(`Pendaftaran berhasil! Akun "${newUser.fullName}" menunggu persetujuan Super Admin sebelum dapat masuk.`);
    setTimeout(() => setTab('login'), 1800);
  };

  const handleRequestRecovery = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');
    if (!recoveryInput.trim()) {
      setErrorMsg('Silakan masukkan Email atau Username akun Anda.');
      return;
    }
    setRecoveryStep('request');
    setTargetRecoveryUser(null);
    setRecoveryCode('');
    setSuccessMsg('Reset password mandiri dinonaktifkan demi keamanan. Hubungi Super Admin untuk verifikasi identitas dan reset password dari User Management.');
  };

  const handleVerifyRecovery = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('Reset password dengan kode simulasi sudah dinonaktifkan. Hubungi Super Admin.');
  };


  return (
    <div className="min-h-screen bg-[#edf2f7] flex items-center justify-center p-4 selection:bg-amber-500 selection:text-slate-950 font-sans antialiased">
      {/* Centered Modal Card matching Gambar 1 & Gambar 2 */}
      <div className="w-full max-w-[460px] rounded-2xl overflow-hidden shadow-2xl border border-slate-200/80 bg-white transition-all">
        {/* Top Dark Header (Identik Gambar 1 & Gambar 2) */}
        <div className="bg-[#0b1325] px-6 pt-7 pb-6 text-center border-b border-slate-800 relative">
          {/* Top-right X icon (Identik Gambar 1 & Gambar 2) */}
          <div className="absolute top-4 right-4 text-slate-500 hover:text-slate-300 transition-colors p-1 cursor-default">
            <X className="w-4 h-4" />
          </div>

          {/* Logo & Brand Monogram */}
          <div className="flex items-center justify-center gap-2 mb-2">
            <AkkLogo size="md" showText={true} showSubtitle={false} />
          </div>

          <p className="text-slate-400 text-[11px] leading-relaxed max-w-sm mx-auto mt-2">
            Portal Akses Logistik Terintegrasi &amp; Pengiriman Luar Pulau PT Anugrah Kemasan Kreatif.
          </p>

          {/* Segmented Tab Switcher (Identik Gambar 1 & Gambar 2) */}
          {tab === 'forgot' ? (
            <div className="flex items-center justify-between mt-5 max-w-xs mx-auto px-1">
              <button
                type="button"
                onClick={() => { setTab('login'); setErrorMsg(''); setSuccessMsg(''); }}
                className="inline-flex items-center gap-1.5 text-xs text-slate-300 hover:text-white transition-colors cursor-pointer group"
              >
                <ArrowLeft className="w-3.5 h-3.5 group-hover:-translate-x-0.5 transition-transform" />
                <span>Kembali ke Masuk</span>
              </button>
              <span className="text-xs font-semibold text-amber-400">
                Lupa Password
              </span>
            </div>
          ) : (
            <div className="flex items-center justify-center gap-1 mt-5 bg-white p-1 rounded-2xl shadow-md border border-slate-200/40 max-w-[320px] mx-auto">
              <button
                type="button"
                onClick={() => { setTab('login'); setErrorMsg(''); setSuccessMsg(''); }}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  tab === 'login'
                    ? 'bg-[#e67e00] text-white shadow-sm'
                    : 'text-slate-600 hover:text-slate-950'
                }`}
              >
                <LogIn className="w-3.5 h-3.5" />
                <span>Masuk (Login)</span>
              </button>

              <button
                type="button"
                onClick={() => { setTab('register'); setErrorMsg(''); setSuccessMsg(''); }}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  tab === 'register'
                    ? 'bg-[#e67e00] text-white shadow-sm'
                    : 'text-slate-600 hover:text-slate-950'
                }`}
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>Daftar Akun</span>
              </button>
            </div>
          )}
        </div>

        {/* Alert Banners */}
        {isLocked && (
          <div className="mx-6 mt-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-start gap-2.5">
            <Lock className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
            <div>
              <strong>Akses Dibekukan:</strong> Terlalu banyak percobaan gagal. Silakan tunggu{' '}
              <span className="font-mono font-bold text-rose-900">{countdown} detik</span>.
            </div>
          </div>
        )}

        {!isLocked && errorMsg && (
          <div className="mx-6 mt-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {successMsg && (
          <div className="mx-6 mt-4 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span className="font-semibold">{successMsg}</span>
          </div>
        )}

        {/* White Card Body */}
        <div className="p-6 sm:p-7 bg-white">
          {tab === 'login' ? (
            /* ======================================================== */
            /* TAB 1: MASUK (LOGIN) - PERSIS GAMBAR 1                    */
            /* ======================================================== */
            <form onSubmit={handleLogin} className="space-y-4">
              {/* Field Email / Username */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Email / Username
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                  <input
                    type="text"
                    required
                    disabled={isLocked || isLoading}
                    placeholder="Masukkan email (nama@domain.com) atau username (Budiono, admin, dll)"
                    value={loginEmail}
                    onChange={(e) => {
                      setLoginEmail(e.target.value);
                      if (errorMsg) setErrorMsg('');
                    }}
                    className="w-full pl-10 pr-3.5 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-800 placeholder-slate-400 text-xs focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition disabled:opacity-50"
                  />
                </div>
              </div>

              {/* Field Password */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-semibold text-slate-700">Password</label>
                  <button
                    type="button"
                    onClick={() => { setTab('forgot'); setErrorMsg(''); setSuccessMsg(''); }}
                    className="text-xs text-[#e67e00] hover:text-[#c46a00] font-semibold transition cursor-pointer"
                  >
                    Lupa Password?
                  </button>
                </div>
                <div className="relative">
                  <KeyRound className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    disabled={isLocked || isLoading}
                    placeholder="••••••••"
                    value={loginPassword}
                    onChange={(e) => {
                      setLoginPassword(e.target.value);
                      if (errorMsg) setErrorMsg('');
                    }}
                    className="w-full pl-10 pr-10 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-800 placeholder-slate-400 text-xs focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition disabled:opacity-50"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-2.5 text-slate-400 hover:text-slate-600 cursor-pointer p-0.5"
                    title={showPassword ? 'Sembunyikan password' : 'Lihat password'}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Tombol Submit Masuk ke Portal AKK (Persis Gambar 1) */}
              <button
                type="submit"
                disabled={isLocked || isLoading}
                className="w-full mt-2 py-3 rounded-xl bg-[#e67e00] hover:bg-[#cf7000] text-slate-950 font-extrabold text-xs shadow-md shadow-amber-500/20 flex items-center justify-center gap-2 transition active:scale-[0.99] cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                    <span>Memproses Masuk...</span>
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
            /* TAB 2: DAFTAR AKUN - PERSIS GAMBAR 2                      */
            /* ======================================================== */
            <form onSubmit={handleRegister} className="space-y-3.5">
              {/* Nama Lengkap */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Nama Lengkap
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                  <input
                    type="text"
                    required
                    placeholder="Contoh: Bayu Dimas Permana"
                    value={registerData.fullName}
                    onChange={(e) => setRegisterData({ ...registerData, fullName: e.target.value })}
                    className="w-full pl-10 pr-3.5 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-800 placeholder-slate-400 text-xs focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition"
                  />
                </div>
              </div>

              {/* Email & No. WhatsApp (2 Kolom) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">Email</label>
                  <input
                    type="email"
                    required
                    placeholder="nama@gmail.com"
                    value={registerData.email}
                    onChange={(e) => setRegisterData({ ...registerData, email: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-800 placeholder-slate-400 text-xs focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">No. WhatsApp</label>
                  <input
                    type="text"
                    placeholder="+62 812-..."
                    value={registerData.phone}
                    onChange={(e) => setRegisterData({ ...registerData, phone: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-800 placeholder-slate-400 text-xs focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition"
                  />
                </div>
              </div>

              {/* Password & Konfirmasi Password (2 Kolom) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">Password</label>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    placeholder="Minimal 6 karakter"
                    value={registerData.password}
                    onChange={(e) => setRegisterData({ ...registerData, password: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-800 placeholder-slate-400 text-xs focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">Konfirmasi Password</label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      placeholder="Ulangi password"
                      value={registerData.confirmPassword}
                      onChange={(e) => setRegisterData({ ...registerData, confirmPassword: e.target.value })}
                      className="w-full pl-3.5 pr-9 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-800 placeholder-slate-400 text-xs focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600 cursor-pointer p-0.5"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              </div>

              {/* Prosedur Verifikasi Akun AKK Box (Persis Gambar 2) */}
              <div className="p-3 rounded-xl bg-[#fff8eb] border border-[#fde4ba] text-[#92540c] text-[11px] leading-relaxed flex items-start gap-2.5">
                <Clock className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <strong className="block text-[#7a4205] font-bold">Prosedur Verifikasi Akun AKK:</strong>
                  Pendaftaran akun baru wajib disetujui (di-approve) oleh Super Admin PT Anugrah Kemasan Kreatif sebelum mendapatkan otorisasi akses menu.
                </div>
              </div>

              {/* Tombol Kirim Pendaftaran Akun (Persis Gambar 2) */}
              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-3 rounded-xl bg-[#e67e00] hover:bg-[#cf7000] text-slate-950 font-extrabold text-xs shadow-md shadow-amber-500/20 flex items-center justify-center gap-2 transition active:scale-[0.99] cursor-pointer disabled:opacity-50"
              >
                {isLoading ? (
                  <span>Mengirimkan Pendaftaran...</span>
                ) : (
                  <span>Kirim Pendaftaran Akun</span>
                )}
              </button>
            </form>
          ) : (
            /* ======================================================== */
            /* TAB 3: LUPA PASSWORD                                      */
            /* ======================================================== */
            <div className="space-y-4">
              {recoveryStep === 'request' ? (
                <form onSubmit={handleRequestRecovery} className="space-y-4">
                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-slate-600 text-xs leading-relaxed">
                    Masukkan <strong>Email</strong> atau <strong>Username</strong> akun terdaftar. Sistem akan mengirimkan kode verifikasi pemulihan kata sandi.
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                      Email / Username Akun
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="Masukkan email atau nama akun Anda"
                      value={recoveryInput}
                      onChange={(e) => setRecoveryInput(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-800 text-xs focus:outline-none focus:border-blue-500"
                    />
                  </div>

                  <button
                    type="submit"
                    className="w-full py-3 rounded-xl bg-[#e67e00] hover:bg-[#cf7000] text-slate-950 font-extrabold text-xs shadow-md shadow-amber-500/20 flex items-center justify-center gap-2 transition cursor-pointer"
                  >
                    <Send className="w-4 h-4" />
                    <span>Kirim Kode Verifikasi</span>
                  </button>
                </form>
              ) : (
                <form onSubmit={handleVerifyRecovery} className="space-y-3.5">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                      Kode Verifikasi 6-Digit
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="123456"
                      value={recoveryCode}
                      onChange={(e) => setRecoveryCode(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-800 text-xs font-mono font-bold tracking-widest text-center focus:outline-none focus:border-blue-500"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                        Password Baru
                      </label>
                      <input
                        type="password"
                        required
                        placeholder="Minimal 4 karakter"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-800 text-xs focus:outline-none focus:border-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                        Ulangi Password
                      </label>
                      <input
                        type="password"
                        required
                        placeholder="Konfirmasi password"
                        value={confirmNewPassword}
                        onChange={(e) => setConfirmNewPassword(e.target.value)}
                        className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-800 text-xs focus:outline-none focus:border-blue-500"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    className="w-full py-3 rounded-xl bg-[#e67e00] hover:bg-[#cf7000] text-slate-950 font-extrabold text-xs shadow-md shadow-amber-500/20 flex items-center justify-center gap-2 transition cursor-pointer"
                  >
                    <span>Simpan Kata Sandi Baru</span>
                  </button>
                </form>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
