import React, { useState, useEffect } from 'react';
import {
  KeyRound,
  CheckCircle2,
  AlertTriangle,
  Clock,
  ShieldCheck,
  MapPin,
  X,
  Check,
  Delete,
  Lock,
  RefreshCw
} from 'lucide-react';
import { DriverShiftCheckin } from '../types';
import { driverShiftService } from '../services/driverShiftService';
import { useToast } from '../context/ToastContext';

interface DriverCheckinModalProps {
  isOpen: boolean;
  onClose: () => void;
  driverId: string;
  driverName: string;
  userRole?: string;
  fleetId?: string;
  plateNumber?: string;
  vehicleType?: string;
  areaName?: string;
  initialMode?: 'checkin' | 'change_pin';
  onCheckinSuccess: (shift: DriverShiftCheckin) => void;
}

export const DriverCheckinModal: React.FC<DriverCheckinModalProps> = ({
  isOpen,
  onClose,
  driverId,
  driverName,
  userRole = 'Driver',
  fleetId,
  plateNumber = '-',
  vehicleType = '-',
  areaName = 'Area Pengiriman Terjadwal',
  initialMode = 'checkin',
  onCheckinSuccess
}) => {
  const { addNotification } = useToast();

  // Mode: 'checkin' (Verifikasi Masuk 2x) atau 'change_pin' (Buat / Ubah PIN Baru 2x)
  const [mode, setMode] = useState<'checkin' | 'change_pin'>(initialMode);

  // Step 1 & Step 2 untuk Verifikasi 2 Kali (baik Check-In maupun Ubah PIN)
  const [step, setStep] = useState<1 | 2>(1);
  const [firstPin, setFirstPin] = useState<string>('');
  const [secondPin, setSecondPin] = useState<string>('');
  const [pinError, setPinError] = useState<string | null>(null);
  const [pinSuccessMsg, setPinSuccessMsg] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Live clock & Location
  const [currentTime, setCurrentTime] = useState<string>('');
  const [currentDate, setCurrentDate] = useState<string>('');
  const [location, setLocation] = useState<string>('Memuat Lokasi GPS...');

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTime(now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) + ' WIB');
      setCurrentDate(now.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }));
    };
    updateTime();
    const timer = setInterval(updateTime, 1000);

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => setLocation(`Lat: ${pos.coords.latitude.toFixed(4)}, Long: ${pos.coords.longitude.toFixed(4)}`),
        () => setLocation('DC PT AKK Banyuwangi (-8.1906, 114.3708)')
      );
    } else {
      setLocation('DC PT AKK Banyuwangi (-8.1906, 114.3708)');
    }
    return () => clearInterval(timer);
  }, []);

  // Reset state on open
  useEffect(() => {
    if (isOpen) {
      setMode(initialMode);
      setStep(1);
      setFirstPin('');
      setSecondPin('');
      setPinError(null);
      setPinSuccessMsg(null);
    }
  }, [isOpen, initialMode]);

  if (!isOpen) return null;

  const activePinValue = step === 1 ? firstPin : secondPin;

  const resetPinInputs = () => {
    setStep(1);
    setFirstPin('');
    setSecondPin('');
    setPinError(null);
  };

  // Handle keypad digit press
  const handleKeypadPress = (digit: string) => {
    setPinError(null);
    setPinSuccessMsg(null);

    if (mode === 'checkin') {
      // Check-In Shift cukup 1 kali input PIN (4 digit)
      if (firstPin.length < 4) {
        const nextPin = firstPin + digit;
        setFirstPin(nextPin);
        if (nextPin.length === 4) {
          handleVerifyCheckinSingleStep(nextPin);
        }
      }
      return;
    }

    // Mode 'change_pin' (Ubah / Buat PIN Baru) menggunakan 2 kali input (Step 1 & Step 2)
    if (step === 1) {
      if (firstPin.length < 4) {
        const nextPin = firstPin + digit;
        setFirstPin(nextPin);
        if (nextPin.length === 4) {
          setTimeout(() => {
            setStep(2);
          }, 180);
        }
      }
    } else {
      if (secondPin.length < 4) {
        const nextPin2 = secondPin + digit;
        setSecondPin(nextPin2);
        if (nextPin2.length === 4) {
          handleSaveNewPinTwoStep(firstPin, nextPin2);
        }
      }
    }
  };

  const handleKeypadDelete = () => {
    setPinError(null);
    if (mode === 'change_pin' && step === 2) {
      if (secondPin.length > 0) {
        setSecondPin(secondPin.slice(0, -1));
      } else {
        setStep(1);
      }
    } else {
      if (firstPin.length > 0) {
        setFirstPin(firstPin.slice(0, -1));
      }
    }
  };

  const handleKeypadClear = () => {
    resetPinInputs();
  };

  // Proses Verifikasi 1 Kali untuk Check-In Shift
  const handleVerifyCheckinSingleStep = async (pin: string) => {
    if (pin.length !== 4) {
      setPinError('Masukkan 4 digit PIN Keamanan Anda.');
      return;
    }

    setIsSubmitting(true);
    const res = await driverShiftService.checkInDriver({
      driverId,
      driverName,
      userRole,
      fleetId,
      plateNumber,
      vehicleType,
      areaName,
      verificationMethod: 'pin',
      pin,
      notes: `Presensi masuk terverifikasi PIN Keamanan (${userRole}).`
    });
    setIsSubmitting(false);

    if (res.success && res.shift) {
      addNotification(
        'schedule',
        'Check-In Shift Berhasil',
        `Shift resmi dimulai pukul ${res.shift.checkinTimeFormatted} dan tercatat di Laporan Kiriman Kru.`
      );
      onCheckinSuccess(res.shift);
      onClose();
    } else {
      setPinError(res.message);
      setStep(1);
      setFirstPin('');
      setSecondPin('');
    }
  };

  // Proses Ubah / Buat PIN Baru dengan Input 2 Kali (Masuk ke Laporan Kiriman Kru)
  const handleSaveNewPinTwoStep = (pin1: string, pin2: string) => {
    if (pin1.length !== 4 || pin2.length !== 4) {
      setPinError('Masukkan 4 digit PIN baru pada kedua tahap konfirmasi.');
      return;
    }

    if (pin1 !== pin2) {
      setPinError('Konfirmasi PIN baru ke-1 dan ke-2 tidak sama! Silakan ulangi.');
      setStep(1);
      setFirstPin('');
      setSecondPin('');
      return;
    }

    const saved = driverShiftService.setPin(driverId, pin2, {
      driverName,
      userRole,
      plateNumber,
      areaName
    });

    if (saved) {
      setPinSuccessMsg('PIN Keamanan baru (****) berhasil disimpan & tercatat di Sub-Menu Laporan Kiriman Kru!');
      addNotification(
        'schedule',
        'PIN Keamanan Diperbarui',
        `PIN baru untuk ${driverName} berhasil diverifikasi 2x dan masuk ke Laporan Kiriman Kru.`
      );
      setTimeout(() => {
        setMode('checkin');
        setStep(1);
        setFirstPin('');
        setSecondPin('');
      }, 1000);
    } else {
      setPinError('Gagal menyimpan PIN baru. Silakan coba kembali.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-700 rounded-3xl w-full max-w-md max-h-[94vh] flex flex-col shadow-2xl overflow-hidden my-auto text-slate-100">
        
        {/* Top Header */}
        <div className="bg-slate-950 p-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 shrink-0">
              <KeyRound className="w-5 h-5" />
            </div>
            <div>
              <div className="text-sm font-black text-white uppercase tracking-tight">
                {mode === 'checkin' ? 'Check-In Shift Kru (PIN)' : 'Ubah / Buat PIN Baru (2x)'}
              </div>
              <div className="text-[11px] text-slate-300 flex items-center gap-1.5 mt-0.5">
                <span className="font-bold text-amber-300">{driverName}</span>
                <span>·</span>
                <span className="px-1.5 py-0.2 rounded bg-slate-800 text-cyan-300 font-semibold text-[10px] border border-slate-700">
                  {userRole}
                </span>
                <span>·</span>
                <span className="font-mono text-emerald-400 font-bold">{plateNumber}</span>
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs">
          
          {/* Live Timestamp & Location Stamp Banner */}
          <div className="bg-slate-950 p-3.5 rounded-2xl border border-slate-800 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-slate-200">
                <Clock className="w-4 h-4 text-amber-400" />
                <span className="font-bold text-xs">Presensi Hari Ini:</span>
              </div>
              <div className="font-mono font-black text-amber-400 text-xs tracking-wider">
                {currentTime}
              </div>
            </div>
            <div className="text-[11px] text-slate-300 font-medium">
              {currentDate}
            </div>

            <div className="flex items-center gap-1.5 text-[11px] text-slate-300 pt-1.5 border-t border-slate-800">
              <MapPin className="w-3.5 h-3.5 text-blue-400 shrink-0" />
              <span className="truncate font-mono">{location}</span>
            </div>
          </div>

          {/* Mode Switcher: Verifikasi PIN Masuk vs Ubah / Buat PIN Baru (Pengguna Baru) */}
          <div className="grid grid-cols-2 gap-1.5 p-1 bg-slate-950 rounded-2xl border border-slate-800">
            <button
              type="button"
              onClick={() => {
                setMode('checkin');
                resetPinInputs();
                setPinSuccessMsg(null);
              }}
              className={`py-2 px-2.5 rounded-xl font-black text-xs flex items-center justify-center gap-1.5 transition cursor-pointer ${
                mode === 'checkin'
                  ? 'bg-amber-500 text-slate-950 shadow-md'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              <Lock className="w-3.5 h-3.5" />
              <span>PIN Keamanan Masuk</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setMode('change_pin');
                resetPinInputs();
                setPinSuccessMsg(null);
              }}
              className={`py-2 px-2.5 rounded-xl font-black text-xs flex items-center justify-center gap-1.5 transition cursor-pointer ${
                mode === 'change_pin'
                  ? 'bg-cyan-500 text-slate-950 shadow-md'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Ubah / Buat PIN Baru (2x)</span>
            </button>
          </div>

          {/* PIN KEYPAD VIEW (1X UNTUK CHECK-IN, 2X UNTUK UBAH / BUAT PIN BARU) */}
          <div className="p-4 bg-slate-950 rounded-2xl border border-slate-800 space-y-4">
            {/* Step Progress Indicator */}
            {mode === 'checkin' ? (
              <div className="flex items-center justify-center">
                <div className="px-3.5 py-1 rounded-lg text-[11px] font-bold flex items-center gap-1.5 border bg-amber-500/20 border-amber-500 text-amber-300">
                  <Lock className="w-3.5 h-3.5 text-amber-400" />
                  <span>Verifikasi PIN Masuk Shift (1x Input)</span>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center gap-2">
                <div className={`px-3 py-1 rounded-lg text-[11px] font-bold flex items-center gap-1.5 border ${
                  step === 1
                    ? 'bg-amber-500/20 border-amber-500 text-amber-300'
                    : 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300'
                }`}>
                  {step > 1 ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> : <span className="w-4 h-4 rounded-full bg-amber-500 text-slate-950 flex items-center justify-center text-[10px] font-black">1</span>}
                  <span>Input PIN Baru 1</span>
                </div>

                <div className="w-4 h-0.5 bg-slate-700" />

                <div className={`px-3 py-1 rounded-lg text-[11px] font-bold flex items-center gap-1.5 border ${
                  step === 2
                    ? 'bg-amber-500/20 border-amber-500 text-amber-300'
                    : 'bg-slate-900 border-slate-800 text-slate-400'
                }`}>
                  <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-black ${
                    step === 2 ? 'bg-amber-500 text-slate-950' : 'bg-slate-800 text-slate-400'
                  }`}>2</span>
                  <span>Ulangi PIN Baru 2</span>
                </div>
              </div>
            )}

            {/* Masked PIN Dots Indicator */}
            <div className="text-center space-y-2.5">
              <div className="text-xs font-bold text-white">
                {mode === 'checkin'
                  ? 'Masukkan 4-Digit PIN Keamanan Anda (1x Input)'
                  : step === 1
                  ? 'Tahap 1/2: Masukkan 4-Digit PIN Keamanan Baru'
                  : 'Tahap 2/2: Ketik Ulang 4-Digit PIN Baru untuk Konfirmasi (2x)'}
              </div>

              <div className="flex items-center justify-center gap-3.5 py-1">
                {[0, 1, 2, 3].map((idx) => {
                  const isFilled = activePinValue.length > idx;
                  return (
                    <div
                      key={idx}
                      className={`w-4 h-4 rounded-full border-2 transition-all ${
                        isFilled
                          ? 'bg-amber-400 border-amber-400 scale-110 shadow-sm shadow-amber-400/50'
                          : 'bg-transparent border-slate-600'
                      }`}
                    />
                  );
                })}
              </div>

              {pinError && (
                <div className="p-2.5 rounded-xl bg-rose-500/15 border border-rose-500/40 text-[11px] text-rose-300 font-bold flex items-center justify-center gap-1.5">
                  <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                  <span>{pinError}</span>
                </div>
              )}

              {pinSuccessMsg && (
                <div className="p-2.5 rounded-xl bg-emerald-500/15 border border-emerald-500/40 text-[11px] text-emerald-300 font-bold flex items-center justify-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>{pinSuccessMsg}</span>
                </div>
              )}
            </div>

            {/* Virtual Number Keypad (3x4) */}
            <div className="grid grid-cols-3 gap-2 max-w-[260px] mx-auto">
              {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
                <button
                  key={digit}
                  type="button"
                  onClick={() => handleKeypadPress(digit)}
                  className="h-12 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-mono font-black text-base transition active:scale-90 flex items-center justify-center border border-slate-700 shadow-sm cursor-pointer"
                >
                  {digit}
                </button>
              ))}

              <button
                type="button"
                onClick={handleKeypadClear}
                className="h-12 rounded-xl bg-slate-900 hover:bg-slate-800 text-amber-300 font-black text-xs transition active:scale-90 flex items-center justify-center border border-slate-700 cursor-pointer"
              >
                ULANG
              </button>

              <button
                type="button"
                onClick={() => handleKeypadPress('0')}
                className="h-12 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-mono font-black text-base transition active:scale-90 flex items-center justify-center border border-slate-700 shadow-sm cursor-pointer"
              >
                0
              </button>

              <button
                type="button"
                onClick={handleKeypadDelete}
                className="h-12 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-200 font-bold text-xs transition active:scale-90 flex items-center justify-center border border-slate-700 cursor-pointer"
              >
                <Delete className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* High-Contrast Legible SOP Keselamatan Notice */}
          <div className="p-3.5 rounded-2xl bg-slate-950 border border-amber-500/40 space-y-1.5 shadow-inner">
            <div className="font-black text-amber-400 text-xs flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-amber-400 shrink-0" />
              <span>SOP Keselamatan &amp; Keamanan Distribusi PT AKK:</span>
            </div>
            <p className="text-slate-200 text-[11px] leading-relaxed font-medium">
              Check-In Shift dilakukan cukup <strong className="text-white">1 kali</strong> input PIN Keamanan. Sedangkan untuk <strong className="text-cyan-300">Ubah / Buat PIN Baru</strong> dilakukan dengan <strong className="text-white">2 kali</strong> input konfirmasi. Seluruh data PIN, Check-In, dan Check-Out otomatis tercatat ke dalam <strong className="text-amber-300">Sub-Menu Laporan Kiriman Kru</strong>.
            </p>
          </div>

        </div>

        {/* Modal Footer */}
        <div className="bg-slate-950 p-3.5 px-4 border-t border-slate-800 flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs transition cursor-pointer"
          >
            Batal
          </button>

          {mode === 'checkin' ? (
            <button
              type="button"
              onClick={() => handleVerifyCheckinSingleStep(firstPin)}
              disabled={firstPin.length !== 4 || isSubmitting}
              className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:bg-slate-800 text-slate-950 disabled:text-slate-500 font-black text-xs flex items-center gap-1.5 transition active:scale-95 cursor-pointer disabled:cursor-not-allowed shadow-md"
            >
              <Check className="w-4 h-4" />
              <span>{isSubmitting ? 'Memverifikasi...' : 'Konfirmasi Masuk (PIN)'}</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => handleSaveNewPinTwoStep(firstPin, secondPin)}
              disabled={firstPin.length !== 4 || secondPin.length !== 4}
              className="px-5 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 disabled:bg-slate-800 text-slate-950 disabled:text-slate-500 font-black text-xs flex items-center gap-1.5 transition active:scale-95 cursor-pointer disabled:cursor-not-allowed shadow-md"
            >
              <Check className="w-4 h-4" />
              <span>Simpan PIN Baru (2x Input)</span>
            </button>
          )}
        </div>

      </div>
    </div>
  );
};
