import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
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
  const [notifications, setNotifications] = useState<ToastNotification[]>([]);
  const [visibleToasts, setVisibleToasts] = useState<ToastNotification[]>([]);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);
  const [simulationEnabled, setSimulationEnabled] = useState<boolean>(false);

  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const onNavigateRef = useRef<((tab: string) => void) | undefined>(undefined);

  const setOnNavigateCallback = useCallback((cb: (tab: string) => void) => {
    onNavigateRef.current = cb;
  }, []);

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
        {visibleToasts.map((toast) => {
          const isUrgent = toast.urgent;
          
          return (
            <div
              key={toast.id}
              className={`pointer-events-auto w-full p-4 rounded-[19px] border shadow-xl flex gap-3.5 backdrop-blur-md relative overflow-hidden group transition-all duration-200 animate-in fade-in slide-in-from-bottom-4 bg-white/95 dark:bg-[#192a40]/95 text-[#18283d] dark:text-[#edf4ff] ${
                  toast.type === 'sla_warning'
                    ? 'border-[#f5c26b] dark:border-[#925500] ring-2 ring-[#fff2db] dark:ring-[#483923]/60'
                    : toast.type === 'tax_kir_reminder' || isUrgent
                    ? 'border-[#f4a5b2] dark:border-[#b42338] ring-2 ring-[#ffedf0] dark:ring-[#472c3a]/60'
                    : toast.type === 'checker'
                    ? 'border-[#f5c26b] dark:border-[#925500]'
                    : toast.type === 'schedule'
                    ? 'border-[#c5dcff] dark:border-[#3079ea]/50'
                    : 'border-[#9de2be] dark:border-[#08774e]/60'
                }`}
              >
                {/* Visual Accent Pulse Bar on Left Side */}
                <div className={`absolute top-0 left-0 w-1.5 h-full ${
                  toast.type === 'sla_warning'
                    ? 'bg-gradient-to-b from-[#d97706] to-[#b42338] animate-pulse'
                    : toast.type === 'tax_kir_reminder' || isUrgent
                    ? 'bg-[#b42338] animate-pulse'
                    : toast.type === 'checker'
                    ? 'bg-[#d97706]'
                    : toast.type === 'schedule'
                    ? 'bg-[#1764db]'
                    : 'bg-[#08774e]'
                }`} />

                {/* Left Side Status Icon */}
                <div className={`w-10 h-10 rounded-[13px] shrink-0 flex items-center justify-center ${
                  toast.type === 'sla_warning'
                    ? 'bg-[#fff2db] dark:bg-[#483923] text-[#925500] dark:text-[#ffd18a]'
                    : toast.type === 'tax_kir_reminder' || isUrgent
                    ? 'bg-[#ffedf0] dark:bg-[#472c3a] text-[#b42338] dark:text-[#ffb4bf]'
                    : toast.type === 'checker'
                    ? 'bg-[#fff2db] dark:bg-[#483923] text-[#925500] dark:text-[#ffd18a]'
                    : toast.type === 'schedule'
                    ? 'bg-[#e9f2ff] dark:bg-[#253e64] text-[#1764db] dark:text-[#c5dbff]'
                    : 'bg-[#e4f7ed] dark:bg-[#203e37] text-[#08774e] dark:text-[#85dfb5]'
                }`}>
                  {toast.type === 'sla_warning' ? (
                    <Clock className="w-5 h-5 animate-pulse" />
                  ) : toast.type === 'tax_kir_reminder' ? (
                    <FileText className="w-5 h-5 animate-pulse" />
                  ) : isUrgent ? (
                    <ShieldAlert className="w-5 h-5" />
                  ) : toast.type === 'checker' ? (
                    <AlertTriangle className="w-5 h-5" />
                  ) : toast.type === 'schedule' ? (
                    <Clock className="w-5 h-5" />
                  ) : (
                    <Truck className="w-5 h-5" />
                  )}
                </div>

                {/* Notification Copy & Direct Navigate Action */}
                <div className="flex-1 min-w-0 pr-5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-extrabold tracking-tight leading-none text-[#18283d] dark:text-[#edf4ff]">
                      {toast.title}
                    </span>
                    {toast.type === 'sla_warning' ? (
                      <span className="px-2 py-0.5 rounded-full bg-[#fff2db] dark:bg-[#483923] text-[#925500] dark:text-[#ffd18a] text-[9px] font-bold tracking-wider uppercase">
                        Batas SLA
                      </span>
                    ) : toast.type === 'tax_kir_reminder' ? (
                      <span className="px-2 py-0.5 rounded-full bg-[#ffedf0] dark:bg-[#472c3a] text-[#b42338] dark:text-[#ffb4bf] text-[9px] font-bold tracking-wider uppercase">
                        Pajak / KIR
                      </span>
                    ) : isUrgent ? (
                      <span className="px-2 py-0.5 rounded-full bg-[#b42338] text-white text-[9px] font-bold tracking-wider uppercase">
                        Urgent
                      </span>
                    ) : null}
                  </div>
                  <p className="text-[11px] text-[#5a6b80] dark:text-[#b2c1d3] font-medium mt-1.5 leading-relaxed break-words">
                    {toast.message}
                  </p>
                  
                  {/* Action Link to Route/SubTab */}
                  <div className="mt-2 flex items-center gap-1.5">
                    <button
                      onClick={() => {
                        markAsRead(toast.id);
                        if (onNavigateRef.current) {
                          if (toast.type === 'sla_warning') onNavigateRef.current('schedules');
                          else if (toast.type === 'tax_kir_reminder') onNavigateRef.current('fleets');
                          else if (toast.type === 'checker') onNavigateRef.current('sales_kpi_fines');
                          else if (toast.type === 'schedule') onNavigateRef.current('schedules');
                          else onNavigateRef.current('operational_dashboard');
                        }
                        removeToast(toast.id);
                      }}
                      className="text-[10.5px] font-bold text-[#1764db] dark:text-[#6ea8ff] flex items-center gap-0.5 hover:underline cursor-pointer"
                    >
                      <span>{toast.type === 'tax_kir_reminder' ? 'Buka Armada & Pajak / KIR' : 'Buka Pantauan Pengiriman'}</span>
                      <ChevronRight className="w-3 h-3" />
                    </button>
                    <span className="text-[#cbd5e1] dark:text-[#34465d] text-[10px]">&bull;</span>
                    <span className="text-[#5a6b80] dark:text-[#b2c1d3] text-[10px] font-mono tabular-nums">
                      {new Date(toast.timestamp).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                </div>

                {/* Close Button */}
                <button
                  onClick={() => removeToast(toast.id)}
                  className="absolute top-2.5 right-2.5 p-1.5 rounded-full text-[#5a6b80] hover:text-[#18283d] dark:hover:text-white hover:bg-[#f3f6fb] dark:hover:bg-[#253e64] transition cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            );
          })}
      </div>

      {/* ========================================================================= */}
      {/* 2. REUSABLE DRAWER PANEL: NOTIFICATION HISTORY & SIMULATION FEED         */}
      {/* ========================================================================= */}
      {isDrawerOpen && (
        <>
          {/* Backdrop Overlay */}
          <div
            onClick={() => setIsDrawerOpen(false)}
            className="fixed inset-0 bg-[#07172a]/50 backdrop-blur-xs z-[1350] cursor-pointer transition-opacity duration-200"
          />
          
          {/* Right Drawer */}
          <div
            className="fixed right-0 top-0 bottom-0 max-w-md w-full bg-white dark:bg-[#192a40] border-l border-[#e4eaf2] dark:border-[#2b3b50] z-[1360] shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-right duration-200"
          >
              {/* Header */}
              <div className="p-4 bg-white dark:bg-[#192a40] border-b border-[#e4eaf2] dark:border-[#2b3b50] flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-[12px] bg-[#e9f2ff] dark:bg-[#253e64] text-[#1764db] dark:text-[#c5dbff] flex items-center justify-center">
                    <Bell className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-extrabold text-[#18283d] dark:text-[#edf4ff]">Pusat Notifikasi Admin</h3>
                    <p className="text-[11px] text-[#5a6b80] dark:text-[#b2c1d3]">Log operasional & simulasi real-time</p>
                  </div>
                </div>
                
                <button
                  onClick={() => setIsDrawerOpen(false)}
                  className="p-2 rounded-full bg-[#f3f6fb] dark:bg-[#111d2c] hover:bg-[#e9f2ff] dark:hover:bg-[#253e64] border border-[#e4eaf2] dark:border-[#2b3b50] text-[#5a6b80] dark:text-[#b2c1d3] hover:text-[#1764db] cursor-pointer transition"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* SIMULATION & CONTROLS BOX */}
              <div className="p-4 bg-[#f3f6fb] dark:bg-[#111d2c] border-b border-[#e4eaf2] dark:border-[#2b3b50] space-y-3.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-[#18283d] dark:text-[#edf4ff] flex items-center gap-1.5">
                    <Settings className="w-3.5 h-3.5 text-[#1764db] dark:text-[#6ea8ff]" />
                    Konfigurasi Notifikasi
                  </span>
                  
                  {/* Sound Toggle */}
                  <button
                    onClick={() => setSoundEnabled(!soundEnabled)}
                    className={`flex items-center gap-1.5 px-3 py-1 rounded-full border text-[11px] font-bold transition cursor-pointer ${
                      soundEnabled 
                        ? 'bg-[#e9f2ff] dark:bg-[#253e64] text-[#1764db] dark:text-[#c5dbff] border-[#c5dcff] dark:border-[#3079ea]/40' 
                        : 'bg-white dark:bg-[#192a40] text-[#5a6b80] dark:text-[#b2c1d3] border-[#e4eaf2] dark:border-[#2b3b50]'
                    }`}
                    title={soundEnabled ? 'Matikan Suara Chime' : 'Aktifkan Suara Chime'}
                  >
                    {soundEnabled ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
                    <span>{soundEnabled ? 'Chime Aktif' : 'Mute'}</span>
                  </button>
                </div>

                {/* Simulation Feed Toggle */}
                <div className="bg-white dark:bg-[#192a40] p-3.5 rounded-[16px] border border-[#e4eaf2] dark:border-[#2b3b50] flex items-center justify-between text-xs gap-3">
                  <div>
                    <div className="font-bold text-[#18283d] dark:text-[#edf4ff]">Simulasi Real-Time Otomatis</div>
                    <p className="text-[10.5px] text-[#5a6b80] dark:text-[#b2c1d3] mt-0.5 leading-relaxed">
                      Secara acak memicu info status truk, denda, atau jadwal mendesak tiap 40 detik.
                    </p>
                  </div>
                  
                  <button
                    onClick={() => setSimulationEnabled(!simulationEnabled)}
                    className={`px-3.5 py-1.5 rounded-full text-xs font-bold tracking-tight shrink-0 transition cursor-pointer ${
                      simulationEnabled 
                        ? 'bg-[#08774e] text-white' 
                        : 'bg-[#f3f6fb] dark:bg-[#111d2c] text-[#5a6b80] dark:text-[#b2c1d3] border border-[#e4eaf2] dark:border-[#2b3b50]'
                    }`}
                  >
                    {simulationEnabled ? 'AKTIF' : 'OFF'}
                  </button>
                </div>

                {/* Manual Triggers Panel */}
                <div className="space-y-1.5">
                  <div className="text-[10px] uppercase font-bold text-[#5a6b80] dark:text-[#b2c1d3] tracking-wider">
                    Uji Coba Kirim Notifikasi Manual:
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 text-[10.5px] font-bold">
                    <button
                      onClick={() => triggerManualSimulation('delivery')}
                      className="px-2 py-1.5 rounded-full bg-white dark:bg-[#192a40] hover:bg-[#e4f7ed] dark:hover:bg-[#203e37] text-[#18283d] dark:text-[#edf4ff] border border-[#e4eaf2] dark:border-[#2b3b50] flex items-center justify-center gap-1 cursor-pointer transition"
                    >
                      <Truck className="w-3 h-3 text-[#08774e] dark:text-[#85dfb5]" />
                      <span>BBM/Kirim</span>
                    </button>
                    <button
                      onClick={() => triggerManualSimulation('checker')}
                      className="px-2 py-1.5 rounded-full bg-white dark:bg-[#192a40] hover:bg-[#fff2db] dark:hover:bg-[#483923] text-[#18283d] dark:text-[#edf4ff] border border-[#e4eaf2] dark:border-[#2b3b50] flex items-center justify-center gap-1 cursor-pointer transition"
                    >
                      <AlertTriangle className="w-3 h-3 text-[#925500] dark:text-[#ffd18a]" />
                      <span>Denda</span>
                    </button>
                    <button
                      onClick={() => triggerManualSimulation('schedule')}
                      className="px-2 py-1.5 rounded-full bg-white dark:bg-[#192a40] hover:bg-[#e9f2ff] dark:hover:bg-[#253e64] text-[#18283d] dark:text-[#edf4ff] border border-[#e4eaf2] dark:border-[#2b3b50] flex items-center justify-center gap-1 cursor-pointer transition"
                    >
                      <Clock className="w-3 h-3 text-[#1764db] dark:text-[#c5dbff]" />
                      <span>Jadwal</span>
                    </button>
                    <button
                      onClick={() => triggerManualSimulation('sla_warning')}
                      className="px-2 py-1.5 rounded-full bg-[#fff2db] dark:bg-[#483923] hover:brightness-95 text-[#925500] dark:text-[#ffd18a] border border-[#f5c26b]/60 dark:border-[#925500]/60 flex items-center justify-center gap-1 cursor-pointer transition"
                      title="Uji coba peringatan armada mendekati batas toleransi SLA"
                    >
                      <Clock className="w-3 h-3" />
                      <span>Batas SLA</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* LIST OF LOGGED NOTIFICATIONS */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-white dark:bg-[#192a40]">
                <div className="flex items-center justify-between text-[11px] text-[#5a6b80] dark:text-[#b2c1d3] font-bold border-b border-[#e4eaf2] dark:border-[#2b3b50] pb-2">
                  <span>HISTORI NOTIFIKASI ({notifications.length})</span>
                  {notifications.length > 0 && (
                    <div className="flex gap-3">
                      <button 
                        onClick={markAllAsRead}
                        className="text-[#1764db] dark:text-[#6ea8ff] hover:underline cursor-pointer"
                      >
                        Tandai Semua Dibaca
                      </button>
                      <span className="text-[#cbd5e1] dark:text-[#34465d]">&bull;</span>
                      <button 
                        onClick={clearAll}
                        className="text-[#b42338] dark:text-[#ffb4bf] hover:underline cursor-pointer"
                      >
                        Bersihkan
                      </button>
                    </div>
                  )}
                </div>

                {notifications.length === 0 ? (
                  <div className="py-12 flex flex-col items-center justify-center text-center space-y-2.5">
                    <div className="w-14 h-14 bg-[#e9f2ff] dark:bg-[#253e64] rounded-[16px] text-[#1764db] dark:text-[#c5dbff] flex items-center justify-center">
                      <Bell className="w-6 h-6" />
                    </div>
                    <div className="text-sm font-bold text-[#18283d] dark:text-[#edf4ff]">Belum ada notifikasi</div>
                    <p className="text-xs text-[#5a6b80] dark:text-[#b2c1d3] max-w-xs leading-relaxed">
                      Notifikasi akan muncul di sini saat ada pembaruan status truk, surat sanksi denda checker, atau perubahan jadwal muatan yang mendesak.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {notifications.map((n) => (
                      <div
                        key={n.id}
                        onClick={() => markAsRead(n.id)}
                        className={`p-3.5 rounded-[16px] border text-xs flex gap-3 transition relative overflow-hidden group cursor-pointer ${
                          !n.read 
                            ? 'bg-[#f3f6fb] dark:bg-[#111d2c] border-[#c5dcff] dark:border-[#3079ea]/50 text-[#18283d] dark:text-[#edf4ff]' 
                            : 'bg-white dark:bg-[#192a40] border-[#e4eaf2] dark:border-[#2b3b50] text-[#5a6b80] dark:text-[#b2c1d3] hover:bg-[#f3f6fb] dark:hover:bg-[#111d2c]'
                        }`}
                      >
                        {/* Unread Dot */}
                        {!n.read && (
                          <span className="absolute top-3.5 right-3.5 w-2 h-2 rounded-full bg-[#1764db] dark:bg-[#6ea8ff]" />
                        )}

                        {/* Left Icon type */}
                        <div className={`w-9 h-9 rounded-[11px] shrink-0 flex items-center justify-center ${
                          n.urgent 
                            ? 'bg-[#ffedf0] dark:bg-[#472c3a] text-[#b42338] dark:text-[#ffb4bf]' 
                            : n.type === 'checker'
                            ? 'bg-[#fff2db] dark:bg-[#483923] text-[#925500] dark:text-[#ffd18a]'
                            : n.type === 'schedule'
                            ? 'bg-[#e9f2ff] dark:bg-[#253e64] text-[#1764db] dark:text-[#c5dbff]'
                            : 'bg-[#e4f7ed] dark:bg-[#203e37] text-[#08774e] dark:text-[#85dfb5]'
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
                          <div className="font-bold text-[#18283d] dark:text-[#edf4ff] text-xs leading-tight flex items-center gap-1.5 flex-wrap">
                            <span>{n.title}</span>
                            {n.urgent && (
                              <span className="px-2 py-0.5 bg-[#ffedf0] dark:bg-[#472c3a] text-[#b42338] dark:text-[#ffb4bf] text-[9px] font-bold uppercase rounded-full">
                                Urgent
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-[#5a6b80] dark:text-[#b2c1d3] leading-relaxed mt-1">
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
                              className="text-[10.5px] text-[#1764db] dark:text-[#6ea8ff] hover:underline flex items-center gap-0.5 cursor-pointer font-bold"
                            >
                              <span>Buka Layar</span>
                              <ChevronRight className="w-3 h-3" />
                            </button>
                            <span className="text-[10px] text-[#5a6b80] dark:text-[#b2c1d3] font-mono tabular-nums">
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
            </div>
          </>
        )}
    </ToastContext.Provider>
  );
};
