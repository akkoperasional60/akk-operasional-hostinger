import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Bell, X, Truck, AlertTriangle, ShieldAlert, Clock, 
  Volume2, VolumeX, Sparkles, HelpCircle, RefreshCw, 
  Play, Settings, FileText, CheckCircle2, ChevronRight, Eye
} from 'lucide-react';
import { logisticsStore } from '../services/store';

export interface ToastNotification {
  id: string;
  type: 'delivery' | 'checker' | 'schedule' | 'sla_warning' | 'geofence' | 'tax_kir_reminder';
  title: string;
  message: string;
  urgent?: boolean;
  timestamp: string;
  read: boolean;
}

interface ToastContextType {
  notifications: ToastNotification[];
  visibleToasts: ToastNotification[];
  addNotification: (type: 'delivery' | 'checker' | 'schedule' | 'sla_warning' | 'geofence' | 'tax_kir_reminder', title: string, message: string, urgent?: boolean) => void;
  removeToast: (id: string) => void;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  clearAll: () => void;
  soundEnabled: boolean;
  setSoundEnabled: (enabled: boolean) => void;
  simulationEnabled: boolean;
  setSimulationEnabled: (enabled: boolean) => void;
  triggerManualSimulation: (type: 'delivery' | 'checker' | 'schedule' | 'sla_warning') => void;
  onNavigateCallback?: (tab: string) => void;
  setOnNavigateCallback: (callback: (tab: string) => void) => void;
  isDrawerOpen: boolean;
  setIsDrawerOpen: (open: boolean) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
}

// Subtle synthetic log chimes via Web Audio API
const playChime = (soundType: 'normal' | 'urgent' | 'success') => {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    
    if (soundType === 'urgent') {
      // Alarm style double beep
      const playBeep = (delay: number) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        
        osc.type = 'sine';
        osc.frequency.setValueAtTime(880, ctx.currentTime + delay); // A5 note
        gain.gain.setValueAtTime(0, ctx.currentTime + delay);
        gain.gain.linearRampToValueAtTime(0.15, ctx.currentTime + delay + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + delay + 0.25);
        
        osc.start(ctx.currentTime + delay);
        osc.stop(ctx.currentTime + delay + 0.3);
      };
      playBeep(0);
      playBeep(0.15);
    } else if (soundType === 'success') {
      // High-pitched sweet chime
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const gain = ctx.createGain();
      
      osc1.connect(gain);
      osc2.connect(gain);
      gain.connect(ctx.destination);
      
      osc1.type = 'triangle';
      osc2.type = 'sine';
      
      osc1.frequency.setValueAtTime(523.25, ctx.currentTime); // C5
      osc1.frequency.exponentialRampToValueAtTime(1046.50, ctx.currentTime + 0.2); // C6
      
      osc2.frequency.setValueAtTime(659.25, ctx.currentTime); // E5
      osc2.frequency.exponentialRampToValueAtTime(1318.51, ctx.currentTime + 0.25); // E6
      
      gain.gain.setValueAtTime(0.1, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
      
      osc1.start();
      osc2.start();
      osc1.stop(ctx.currentTime + 0.45);
      osc2.stop(ctx.currentTime + 0.45);
    } else {
      // Simple log bubble click
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      
      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
      osc.frequency.exponentialRampToValueAtTime(880.00, ctx.currentTime + 0.15); // A5
      
      gain.gain.setValueAtTime(0.08, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
      
      osc.start();
      osc.stop(ctx.currentTime + 0.35);
    }
  } catch (e) {
    console.warn('Synthesized chime player error:', e);
  }
};

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [notifications, setNotifications] = useState<ToastNotification[]>(() => {
    try {
      const saved = localStorage.getItem('akk_notifications_v1');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [visibleToasts, setVisibleToasts] = useState<ToastNotification[]>([]);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(() => {
    try {
      return localStorage.getItem('akk_notif_sound_v1') !== 'false';
    } catch {
      return true;
    }
  });
  
  const [simulationEnabled, setSimulationEnabled] = useState<boolean>(() => {
    try {
      return localStorage.getItem('akk_notif_sim_v1') === 'true';
    } catch {
      return false; // Disabled by default, easily toggleable
    }
  });

  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const onNavigateRef = useRef<((tab: string) => void) | undefined>(undefined);

  const setOnNavigateCallback = useCallback((cb: (tab: string) => void) => {
    onNavigateRef.current = cb;
  }, []);

  // Keep state synced to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('akk_notifications_v1', JSON.stringify(notifications));
    } catch {}
  }, [notifications]);

  useEffect(() => {
    try {
      localStorage.setItem('akk_notif_sound_v1', String(soundEnabled));
    } catch {}
  }, [soundEnabled]);

  useEffect(() => {
    try {
      localStorage.setItem('akk_notif_sim_v1', String(simulationEnabled));
    } catch {}
  }, [simulationEnabled]);

  const addNotification = useCallback((
    type: 'delivery' | 'checker' | 'schedule' | 'sla_warning' | 'geofence' | 'tax_kir_reminder', 
    title: string, 
    message: string, 
    urgent?: boolean
  ) => {
    const newNotif: ToastNotification = {
      id: `notif-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
      type,
      title,
      message,
      urgent: urgent ?? (type === 'sla_warning'),
      timestamp: new Date().toISOString(),
      read: false
    };

    setNotifications(prev => [newNotif, ...prev].slice(0, 50)); // Cap at 50 history logs
    setVisibleToasts(prev => [...prev.slice(-1), newNotif]);

    if (soundEnabled) {
      playChime(urgent || type === 'sla_warning' ? 'urgent' : type === 'checker' ? 'success' : 'normal');
    }

    // Auto dismiss toasts after 5 seconds (or 8 seconds for urgent alerts)
    setTimeout(() => {
      setVisibleToasts(prev => prev.filter(t => t.id !== newNotif.id));
    }, (urgent || type === 'sla_warning') ? 8000 : 5000);
  }, [soundEnabled]);

  const removeToast = useCallback((id: string) => {
    setVisibleToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const markAsRead = useCallback((id: string) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
  }, []);

  const markAllAsRead = useCallback(() => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  }, []);

  const clearAll = useCallback(() => {
    setNotifications([]);
    setVisibleToasts([]);
  }, []);

  // Listen to store triggers (updates made by manual actions)
  useEffect(() => {
    if ((logisticsStore as any).onNotification) {
      const unsubscribe = (logisticsStore as any).onNotification((evt: any) => {
        addNotification(evt.type, evt.title, evt.message, evt.urgent);
      });
      return unsubscribe;
    }
  }, [addNotification]);

  // Real-world Logistical Scenarios for PT AKK Simulation
  const triggerManualSimulation = useCallback((type: 'delivery' | 'checker' | 'schedule' | 'sla_warning') => {
    const randomDrivers = ['Achmad Baihaqi', 'Sutrisno', 'Bambang Hermawan', 'M. Thoyib', 'Didik Prasetyo'];
    const randomFleets = ['EL-01 (P 8381 VE)', 'DS-02 (P 8801 UV)', 'ES-03 (P 8848 U)', 'DS-04 (P 9677 VB)', 'PB-05 (P 8125 VC)', 'DS-06 (P 8509 VQ)'];
    const randomStores = ['DC Retail Surabaya Rungkut', 'Transmart Buah Batu Bandung', 'Super Indo Majapahit Semarang', 'Mall Boemi Kedaton Lampung', 'Grand Lucky Supermarket Sanur Bali'];
    
    if (type === 'delivery') {
      const driver = randomDrivers[Math.floor(Math.random() * randomDrivers.length)];
      const fleet = randomFleets[Math.floor(Math.random() * randomFleets.length)];
      const store = randomStores[Math.floor(Math.random() * randomStores.length)];
      const statuses = [
        { status: 'transit', text: 'sedang transit (dalam perjalanan) membawa 2.4 Ton karton box' },
        { status: 'loading', text: 'telah diparkir di dock muat & mulai memproses pemuatan' },
        { status: 'delivered', text: 'telah berhasil dibongkar di lokasi. Pengiriman selesai!' }
      ];
      const stage = statuses[Math.floor(Math.random() * statuses.length)];
      
      addNotification(
        'delivery',
        'Pembaruan Status Pengiriman',
        `Armada ${fleet} (${driver}) ke ${store} ${stage.text}.`,
        false
      );
    } else if (type === 'checker') {
      const admins = ['Sindi Rahmawati', 'Rina Wijaya', 'Budi Santoso', 'Devi Lestari'];
      const admin = admins[Math.floor(Math.random() * admins.length)];
      const reasons = [
        { reason: 'Kesalahan entri nomor PO pada surat jalan (SLA tertunda)', amt: 100000, sev: 'Sedang' as const },
        { reason: 'Keterlambatan upload e-invoice ke sistem logistik pelanggan (>2 jam)', amt: 50000, sev: 'Rendah' as const },
        { reason: 'Ketidakcocokan berat muat tonase fisik vs Manifest Sistem', amt: 150000, sev: 'Tinggi' as const },
        { reason: 'Kelalaian dokumen serah terima toko (tanpa ttd basah / stempel)', amt: 50000, sev: 'Rendah' as const }
      ];
      const item = reasons[Math.floor(Math.random() * reasons.length)];
      
      addNotification(
        'checker',
        `Sanksi Denda Checker Baru: ${admin}`,
        `Denda Rp ${item.amt.toLocaleString('id-ID')} dikeluarkan atas kelalaian: "${item.reason}". Tingkat keparahan: ${item.sev}.`,
        item.sev === 'Tinggi'
      );
    } else if (type === 'schedule') {
      const fleet = randomFleets[Math.floor(Math.random() * randomFleets.length)];
      const store = randomStores[Math.floor(Math.random() * randomStores.length)];
      const isUrgent = Math.random() > 0.4;
      const hours = [1, 2, 3];
      const selectedHour = hours[Math.floor(Math.random() * hours.length)];
      
      const title = isUrgent ? '⚠️ JADWAL MUAT MENDESAK BERUBAH' : 'Perubahan Jadwal Muat';
      const message = isUrgent
        ? `DARURAT: Jadwal muat unit ${fleet} rute ${store} DIMAJUKAN ${selectedHour} jam lebih cepat karena permintaan darurat dari pabrik!`
        : `Info Logistik: Jadwal bongkar muat ${fleet} untuk ${store} dijadwal ulang karena penumpukan antrean di gate 3.`;
        
      addNotification('schedule', title, message, isUrgent);
    } else if (type === 'sla_warning') {
      const driver = randomDrivers[Math.floor(Math.random() * randomDrivers.length)];
      const fleet = randomFleets[Math.floor(Math.random() * randomFleets.length)];
      const store = randomStores[Math.floor(Math.random() * randomStores.length)];
      const remainingMinutes = Math.floor(Math.random() * 30) + 15; // 15-45 minutes
      const elapsedHours = (Math.random() * 3 + 6).toFixed(1);
      
      addNotification(
        'sla_warning',
        `⚠️ Peringatan Toleransi SLA: ${fleet}`,
        `Waktu tempuh armada ${fleet} (${driver}) rute ke ${store} telah berjalan ${elapsedHours} jam dan mendekati batas toleransi SLA! Sisa toleransi waktu pengiriman tinggal ${remainingMinutes} menit sebelum melewati batas perjanjian layanan.`,
        true
      );
    }
  }, [addNotification]);

  // Periodic automatic simulation generator (runs if simulationEnabled is true)
  useEffect(() => {
    if (!simulationEnabled) return;

    // Generate first simulation after 10s
    const firstTimer = setTimeout(() => {
      const types: Array<'delivery' | 'checker' | 'schedule' | 'sla_warning'> = ['delivery', 'checker', 'schedule', 'sla_warning'];
      const rType = types[Math.floor(Math.random() * types.length)];
      triggerManualSimulation(rType);
    }, 10000);

    // Then interval every 40 seconds
    const interval = setInterval(() => {
      const types: Array<'delivery' | 'checker' | 'schedule' | 'sla_warning'> = ['delivery', 'checker', 'schedule', 'sla_warning'];
      const rType = types[Math.floor(Math.random() * types.length)];
      triggerManualSimulation(rType);
    }, 40000);

    return () => {
      clearTimeout(firstTimer);
      clearInterval(interval);
    };
  }, [simulationEnabled, triggerManualSimulation]);

  return (
    <ToastContext.Provider value={{
      notifications,
      visibleToasts,
      addNotification,
      removeToast,
      markAsRead,
      markAllAsRead,
      clearAll,
      soundEnabled,
      setSoundEnabled,
      simulationEnabled,
      setSimulationEnabled,
      triggerManualSimulation,
      onNavigateCallback: onNavigateRef.current,
      setOnNavigateCallback,
      isDrawerOpen,
      setIsDrawerOpen
    }}>
      {children}
      
      {/* ========================================================================= */}
      {/* 1. VISIBLE FLOATING TOASTS ON-SCREEN OVERLAYS                             */}
      {/* ========================================================================= */}
      <div className="fixed bottom-5 right-5 z-[999] flex flex-col gap-3 max-w-sm w-full pointer-events-none">
        <AnimatePresence>
          {visibleToasts.map((toast) => {
            const isUrgent = toast.urgent;
            
            return (
              <motion.div
                key={toast.id}
                layout
                initial={{ opacity: 0, y: 50, scale: 0.9 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -20, scale: 0.95, transition: { duration: 0.2 } }}
                className={`pointer-events-auto w-full p-4 rounded-xl border shadow-2xl flex gap-3.5 backdrop-blur-md relative overflow-hidden group ${
                  toast.type === 'sla_warning'
                    ? 'bg-slate-900/95 border-amber-500/80 ring-2 ring-amber-500/30 text-amber-50 shadow-amber-500/10'
                    : toast.type === 'tax_kir_reminder'
                    ? 'bg-slate-900/95 border-rose-500/80 ring-2 ring-rose-500/30 text-rose-50 shadow-rose-500/10'
                    : isUrgent 
                    ? 'bg-rose-950/95 border-rose-600 ring-1 ring-rose-500/30 text-rose-50' 
                    : toast.type === 'checker'
                    ? 'bg-slate-900/95 border-amber-500/40 text-slate-100 ring-1 ring-amber-500/10'
                    : toast.type === 'schedule'
                    ? 'bg-slate-900/95 border-blue-500/40 text-slate-100'
                    : 'bg-slate-900/95 border-emerald-500/40 text-slate-100'
                }`}
              >
                {/* Visual Accent Pulse Bar on Left Side */}
                <div className={`absolute top-0 left-0 w-1.5 h-full ${
                  toast.type === 'sla_warning'
                    ? 'bg-gradient-to-b from-amber-400 to-rose-500 animate-pulse'
                    : toast.type === 'tax_kir_reminder'
                    ? 'bg-gradient-to-b from-rose-500 to-amber-500 animate-pulse'
                    : isUrgent 
                    ? 'bg-rose-500 animate-pulse' 
                    : toast.type === 'checker'
                    ? 'bg-amber-500'
                    : toast.type === 'schedule'
                    ? 'bg-blue-500'
                    : 'bg-emerald-500'
                }`} />

                {/* Left Side Status Icon */}
                <div className={`p-2 rounded-lg shrink-0 flex items-center justify-center ${
                  toast.type === 'sla_warning'
                    ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                    : toast.type === 'tax_kir_reminder'
                    ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                    : isUrgent 
                    ? 'bg-rose-500/20 text-rose-400' 
                    : toast.type === 'checker'
                    ? 'bg-amber-500/15 text-amber-400'
                    : toast.type === 'schedule'
                    ? 'bg-blue-500/15 text-blue-400'
                    : 'bg-emerald-500/15 text-emerald-400'
                }`}>
                  {toast.type === 'sla_warning' ? (
                    <Clock className="w-5 h-5 animate-pulse text-amber-400" />
                  ) : toast.type === 'tax_kir_reminder' ? (
                    <FileText className="w-5 h-5 animate-pulse text-rose-400" />
                  ) : isUrgent ? (
                    <ShieldAlert className="w-5 h-5 animate-bounce" />
                  ) : toast.type === 'checker' ? (
                    <AlertTriangle className="w-5 h-5" />
                  ) : toast.type === 'schedule' ? (
                    <Clock className="w-5 h-5" />
                  ) : (
                    <Truck className="w-5 h-5" />
                  )}
                </div>

                {/* Notification Copy & Direct Navigate Action */}
                <div className="flex-1 min-w-0 pr-4">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-black tracking-tight leading-none">
                      {toast.title}
                    </span>
                    {toast.type === 'sla_warning' ? (
                      <span className="px-1.5 py-0.2 rounded bg-amber-500/20 border border-amber-500/40 text-amber-300 text-[9px] font-black tracking-wider uppercase animate-pulse">
                        Batas SLA
                      </span>
                    ) : toast.type === 'tax_kir_reminder' ? (
                      <span className="px-1.5 py-0.2 rounded bg-rose-500/25 border border-rose-500/40 text-rose-300 text-[9px] font-black tracking-wider uppercase animate-pulse">
                        Pajak / KIR
                      </span>
                    ) : isUrgent ? (
                      <span className="px-1.5 py-0.2 rounded bg-rose-600 text-white text-[9px] font-black tracking-wider uppercase animate-pulse">
                        Urgent
                      </span>
                    ) : null}
                  </div>
                  <p className="text-[11px] text-slate-300 font-semibold mt-1.5 leading-relaxed break-words">
                    {toast.message}
                  </p>
                  
                  {/* Action Link to Route/SubTab */}
                  <div className="mt-2 flex items-center gap-1.5">
                    <button
                      onClick={() => {
                        // Mark as read
                        markAsRead(toast.id);
                        // Trigger route tab navigation via app's callback
                        if (onNavigateRef.current) {
                          if (toast.type === 'sla_warning') onNavigateRef.current('schedules');
                          else if (toast.type === 'tax_kir_reminder') onNavigateRef.current('fleets');
                          else if (toast.type === 'checker') onNavigateRef.current('sales_kpi_fines');
                          else if (toast.type === 'schedule') onNavigateRef.current('schedules');
                          else onNavigateRef.current('operational_dashboard');
                        }
                        // Close this toast
                        removeToast(toast.id);
                      }}
                      className={`text-[10px] font-black flex items-center gap-0.5 hover:underline cursor-pointer ${
                        toast.type === 'sla_warning' ? 'text-amber-400 hover:text-amber-200' : toast.type === 'tax_kir_reminder' ? 'text-amber-400 hover:text-amber-200' : isUrgent ? 'text-rose-300 hover:text-rose-100' : 'text-amber-400 hover:text-amber-200'
                      }`}
                    >
                      <span>{toast.type === 'tax_kir_reminder' ? 'Buka Armada & Pajak / KIR' : 'Buka Pantauan Pengiriman'}</span>
                      <ChevronRight className="w-3 h-3" />
                    </button>
                    <span className="text-slate-600 text-[10px]">&bull;</span>
                    <span className="text-slate-500 text-[9px] font-mono">
                      {new Date(toast.timestamp).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                </div>

                {/* Close Button */}
                <button
                  onClick={() => removeToast(toast.id)}
                  className="absolute top-2.5 right-2.5 p-1 rounded-md text-slate-400 hover:text-white hover:bg-slate-800/80 transition cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      {/* ========================================================================= */}
      {/* 2. REUSABLE DRAWER PANEL: NOTIFICATION HISTORY & SIMULATION FEED         */}
      {/* ========================================================================= */}
      <AnimatePresence>
        {isDrawerOpen && (
          <>
            {/* Backdrop Overlay */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.5 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsDrawerOpen(false)}
              className="fixed inset-0 bg-black z-[100] cursor-pointer"
            />
            
            {/* Right Drawer */}
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed right-0 top-0 bottom-0 max-w-md w-full bg-slate-900 border-l border-slate-800 z-[101] shadow-2xl flex flex-col overflow-hidden"
            >
              {/* Header */}
              <div className="p-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20">
                    <Bell className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-white">Pusat Notifikasi Admin</h3>
                    <p className="text-[10px] text-slate-400">Log operasional & simulasi real-time</p>
                  </div>
                </div>
                
                <button
                  onClick={() => setIsDrawerOpen(false)}
                  className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-400 hover:text-white cursor-pointer transition"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* SIMULATION & CONTROLS BOX */}
              <div className="p-4 bg-slate-950/40 border-b border-slate-800/60 space-y-3.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-white flex items-center gap-1.5">
                    <Settings className="w-3.5 h-3.5 text-amber-400" />
                    Konfigurasi Notifikasi
                  </span>
                  
                  {/* Sound Toggle */}
                  <button
                    onClick={() => setSoundEnabled(!soundEnabled)}
                    className={`flex items-center gap-1 px-2.5 py-1 rounded-lg border text-[11px] font-bold transition cursor-pointer ${
                      soundEnabled 
                        ? 'bg-amber-500/10 text-amber-400 border-amber-500/25' 
                        : 'bg-slate-900 text-slate-500 border-slate-800'
                    }`}
                    title={soundEnabled ? 'Matikan Suara Chime' : 'Aktifkan Suara Chime'}
                  >
                    {soundEnabled ? <Volume2 className="w-3.5 h-3.5 animate-pulse" /> : <VolumeX className="w-3.5 h-3.5" />}
                    <span>{soundEnabled ? 'Chime Aktif' : 'Mute'}</span>
                  </button>
                </div>

                {/* Simulation Feed Toggle */}
                <div className="bg-slate-950 p-3 rounded-xl border border-slate-800/80 flex items-center justify-between text-xs">
                  <div>
                    <div className="font-bold text-slate-200">Simulasi Real-Time Otomatis</div>
                    <p className="text-[10px] text-slate-400 mt-0.5 leading-relaxed pr-2">
                      Secara acak memicu info status truk, denda, atau jadwal mendesak tiap 40 detik.
                    </p>
                  </div>
                  
                  <button
                    onClick={() => setSimulationEnabled(!simulationEnabled)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-black tracking-tight shrink-0 transition cursor-pointer ${
                      simulationEnabled 
                        ? 'bg-emerald-500 text-slate-950 font-black' 
                        : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                    }`}
                  >
                    {simulationEnabled ? 'AKTIF' : 'OFF'}
                  </button>
                </div>

                {/* Manual Triggers Panel */}
                <div className="space-y-1.5">
                  <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                    Uji Coba Kirim Notifikasi Manual:
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 text-[10px] font-bold">
                    <button
                      onClick={() => triggerManualSimulation('delivery')}
                      className="px-2 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-800 hover:border-slate-700 flex items-center justify-center gap-1 cursor-pointer"
                    >
                      <Truck className="w-3 h-3 text-emerald-400" />
                      <span>BBM/Kirim</span>
                    </button>
                    <button
                      onClick={() => triggerManualSimulation('checker')}
                      className="px-2 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-800 hover:border-slate-700 flex items-center justify-center gap-1 cursor-pointer"
                    >
                      <AlertTriangle className="w-3 h-3 text-amber-400" />
                      <span>Denda</span>
                    </button>
                    <button
                      onClick={() => triggerManualSimulation('schedule')}
                      className="px-2 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-800 hover:border-slate-700 flex items-center justify-center gap-1 cursor-pointer"
                    >
                      <Clock className="w-3 h-3 text-blue-400" />
                      <span>Jadwal</span>
                    </button>
                    <button
                      onClick={() => triggerManualSimulation('sla_warning')}
                      className="px-2 py-1.5 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 hover:border-amber-500/50 flex items-center justify-center gap-1 cursor-pointer"
                      title="Uji coba peringatan armada mendekati batas toleransi SLA"
                    >
                      <Clock className="w-3 h-3 text-amber-400 animate-pulse" />
                      <span>Batas SLA</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* LIST OF LOGGED NOTIFICATIONS */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                <div className="flex items-center justify-between text-[11px] text-slate-400 font-bold border-b border-slate-800 pb-2">
                  <span>HISTORI NOTIFIKASI ({notifications.length})</span>
                  {notifications.length > 0 && (
                    <div className="flex gap-3">
                      <button 
                        onClick={markAllAsRead}
                        className="hover:text-white cursor-pointer"
                      >
                        Tandai Semua Dibaca
                      </button>
                      <span className="text-slate-700">&bull;</span>
                      <button 
                        onClick={clearAll}
                        className="text-rose-400 hover:text-rose-300 cursor-pointer"
                      >
                        Bersihkan
                      </button>
                    </div>
                  )}
                </div>

                {notifications.length === 0 ? (
                  <div className="py-12 flex flex-col items-center justify-center text-center space-y-2.5">
                    <div className="p-3 bg-slate-950 rounded-full text-slate-600 border border-slate-800/50">
                      <Bell className="w-6 h-6" />
                    </div>
                    <div className="text-xs font-bold text-slate-400">Belum ada notifikasi</div>
                    <p className="text-[10px] text-slate-500 max-w-xs leading-relaxed">
                      Notifikasi akan muncul di sini saat ada pembaruan status truk, surat sanksi denda checker, atau perubahan jadwal muatan yang mendesak.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {notifications.map((n) => (
                      <div
                        key={n.id}
                        onClick={() => markAsRead(n.id)}
                        className={`p-3 rounded-xl border text-xs flex gap-2.5 transition relative overflow-hidden group ${
                          !n.read 
                            ? 'bg-slate-950/90 border-slate-700 text-white ring-1 ring-amber-500/5' 
                            : 'bg-slate-950/40 border-slate-800/80 text-slate-300 hover:bg-slate-950/60'
                        }`}
                      >
                        {/* Red Dot for unread */}
                        {!n.read && (
                          <span className="absolute top-3.5 right-3.5 w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                        )}

                        {/* Left Icon type */}
                        <div className={`p-1.5 rounded-lg shrink-0 w-8 h-8 flex items-center justify-center ${
                          n.urgent 
                            ? 'bg-rose-500/20 text-rose-400' 
                            : n.type === 'checker'
                            ? 'bg-amber-500/15 text-amber-400'
                            : n.type === 'schedule'
                            ? 'bg-blue-500/15 text-blue-400'
                            : 'bg-emerald-500/15 text-emerald-400'
                        }`}>
                          {n.urgent ? (
                            <ShieldAlert className="w-4 h-4" />
                          ) : n.type === 'checker' ? (
                            <AlertTriangle className="w-4 h-4" />
                          ) : n.type === 'schedule' ? (
                            <Clock className="w-4 h-4" />
                          ) : (
                            <Truck className="w-4 h-4" />
                          )}
                        </div>

                        {/* Main Copy */}
                        <div className="flex-1 min-w-0 pr-4">
                          <div className="font-bold text-slate-200 text-[11px] leading-tight flex items-center gap-1.5">
                            <span>{n.title}</span>
                            {n.urgent && (
                              <span className="px-1 bg-rose-500/15 border border-rose-500/30 text-rose-400 text-[8px] uppercase rounded">
                                Urgent
                              </span>
                            )}
                          </div>
                          <p className="text-[10.5px] text-slate-400 leading-relaxed mt-1">
                            {n.message}
                          </p>
                          <div className="mt-2 flex items-center justify-between">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                markAsRead(n.id);
                                if (onNavigateRef.current) {
                                  if (n.type === 'checker') onNavigateRef.current('sales_kpi_fines');
                                  else if (n.type === 'schedule') onNavigateRef.current('schedules');
                                  else onNavigateRef.current('operational_dashboard');
                                }
                                setIsDrawerOpen(false);
                              }}
                              className="text-[10px] text-amber-400 hover:text-amber-300 hover:underline flex items-center gap-0.5 cursor-pointer font-bold"
                            >
                              <span>Buka Layar</span>
                              <ChevronRight className="w-3 h-3" />
                            </button>
                            <span className="text-[9px] text-slate-500 font-mono">
                              {new Date(n.timestamp).toLocaleString('id-ID', {
                                month: 'short',
                                day: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit'
                              })}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </ToastContext.Provider>
  );
};
