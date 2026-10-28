import React, { useState, useEffect, useMemo } from 'react';
import {
  Truck,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Radio,
  Bell,
  Search,
  Filter,
  ArrowRight,
  ShieldCheck,
  Send,
  Zap,
  RotateCcw,
  MapPin,
  Users,
  ExternalLink,
  ChevronRight,
  Sparkles
} from 'lucide-react';
import { NavTab } from './Sidebar';
import { logisticsStore } from '../services/store';
import {
  AdminStatusNotification,
  getAdminStatusNotifications,
  markAdminStatusNotificationRead,
  markAllAdminStatusNotificationsRead,
  clearAdminStatusNotifications,
  publishScheduleStatusChange,
  supabaseRealtimeSync,
  STATUS_LABELS
} from '../services/supabaseRealtimeSync';
import { Schedule } from '../types';

export interface NotificationThresholds {
  idleMinutesThreshold: number;
  slaWarningPercentage: number;
  maxSpeedKmh: number;
  maintenanceKmThreshold: number;
  taxExpirationDaysThreshold: number;
  enableIdleAlerts: boolean;
  enableSlaAlerts: boolean;
  enableSpeedAlerts: boolean;
  enableMaintenanceAlerts: boolean;
}

export const DEFAULT_NOTIFICATION_THRESHOLDS: NotificationThresholds = {
  idleMinutesThreshold: 60,
  slaWarningPercentage: 85,
  maxSpeedKmh: 80,
  maintenanceKmThreshold: 500,
  taxExpirationDaysThreshold: 30,
  enableIdleAlerts: true,
  enableSlaAlerts: true,
  enableSpeedAlerts: true,
  enableMaintenanceAlerts: true,
};

interface DashboardOverviewProps {
  onNavigate?: (tab: NavTab) => void;
}

export const DashboardOverview: React.FC<DashboardOverviewProps> = ({ onNavigate }) => {
  const [currentUser, setCurrentUser] = useState(() => logisticsStore.getCurrentUser());
  const [notifications, setNotifications] = useState<AdminStatusNotification[]>(() => getAdminStatusNotifications());
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isSimulating, setIsSimulating] = useState<boolean>(false);
  const [simulatedFeedback, setSimulatedFeedback] = useState<string | null>(null);

  // Synchronize notifications reactively
  useEffect(() => {
    const handleUpdate = () => {
      setNotifications(getAdminStatusNotifications());
    };

    window.addEventListener('akk-admin-status-updated', handleUpdate);
    window.addEventListener('akk-admin-status-notification', handleUpdate);
    window.addEventListener('akk-realtime-synced', handleUpdate);

    const sub = logisticsStore.subscribe(() => {
      setCurrentUser(logisticsStore.getCurrentUser());
    });

    // Ensure Hostinger MySQL Live Sync channel is actively subscribed
    supabaseRealtimeSync.subscribe();

    return () => {
      window.removeEventListener('akk-admin-status-updated', handleUpdate);
      window.removeEventListener('akk-admin-status-notification', handleUpdate);
      window.removeEventListener('akk-realtime-synced', handleUpdate);
      sub();
    };
  }, []);

  // Operational schedule stats
  const schedules = logisticsStore.getSchedules();
  const fleets = logisticsStore.getFleets();
  const crews = logisticsStore.getCrews();

  const totalInTransit = schedules.filter(s => s.status === 'in_transit').length;
  const totalDelivered = schedules.filter(s => s.status === 'delivered').length;
  const totalDelayed = schedules.filter(s => s.status === 'delayed').length;
  const totalScheduled = schedules.filter(s => s.status === 'scheduled').length;
  const unreadNotifsCount = notifications.filter(n => !n.isRead).length;

  // Filtered notifications list
  const filteredNotifications = useMemo(() => {
    return notifications.filter(notif => {
      const matchStatus = statusFilter === 'all' || notif.newStatus === statusFilter;
      const q = searchQuery.toLowerCase().trim();
      const matchQuery =
        !q ||
        notif.trackingNumber.toLowerCase().includes(q) ||
        notif.storeName.toLowerCase().includes(q) ||
        notif.areaName.toLowerCase().includes(q) ||
        notif.driverName.toLowerCase().includes(q) ||
        notif.fleetPlate.toLowerCase().includes(q) ||
        (notif.fleetInitialCode && notif.fleetInitialCode.toLowerCase().includes(q));

      return matchStatus && matchQuery;
    });
  }, [notifications, statusFilter, searchQuery]);

  // Relative time helper
  const formatTimeAgo = (isoString?: string) => {
    if (!isoString) return 'Baru saja';
    const now = Date.now();
    const past = new Date(isoString).getTime();
    const diffSec = Math.floor((now - past) / 1000);
    if (diffSec < 60) return 'Baru saja';
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin} menit yang lalu`;
    const diffHours = Math.floor(diffMin / 60);
    if (diffHours < 24) return `${diffHours} jam yang lalu`;
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays} hari yang lalu`;
  };

  // Test simulation trigger for Hostinger MySQL Live Sync status changes
  const handleSimulateStatusChange = async () => {
    setIsSimulating(true);
    setSimulatedFeedback(null);

    try {
      // Find a schedule to simulate
      const target = schedules.find(s => s.status === 'scheduled') || schedules[0];
      const targetId = target?.id || 'sch-sim-' + Date.now();
      const tracking = target?.trackingNumber || 'PO-AKK-SIM-01';
      const storeName = target?.store?.storeName || 'KARTIKA PLAZA';
      const area = target?.areaName || 'DENPASAR 1';
      const driver = target?.crew?.name || 'Supriyanto';
      const plate = target?.fleet?.plateNumber || 'P 8125 VC';

      // Alternate status for simulation
      const nextStatus = target?.status === 'in_transit' ? 'delivered' : 'in_transit';
      const oldStatus = target?.status || 'scheduled';

      const simulatedPayload: Partial<Schedule> = {
        id: targetId,
        trackingNumber: tracking,
        status: nextStatus,
        areaName: area,
        notes: `Update status otomatis simulasi via Hostinger MySQL Live Sync (Waktu: ${new Date().toLocaleTimeString('id-ID')})`,
        store: target?.store || {
          id: 'store-sim',
          storeCode: 'SIM',
          storeName,
          island: 'Bali & Nusa Tenggara',
          province: 'Bali',
          city: 'Denpasar',
          address: 'Jl. Kartika Plaza',
          latitude: -8.67,
          longitude: 115.21,
          contactPerson: 'PIC Toko',
          phone: '-',
          deliveryWindow: '08:00 - 17:00',
          storeCategory: 'Toko Kelontong / Minimarket'
        },
        fleet: target?.fleet || {
          id: 'flt-sim',
          plateNumber: plate,
          initialCode: 'DS3',
          vehicleType: 'Engkel Long',
          status: 'on-duty'
        },
        crew: target?.crew || {
          id: 'crw-sim',
          name: driver,
          phone: '0812-3456-7890',
          role: 'Driver Utama',
          licenseNumber: 'SIM-B2-001',
          licenseType: 'SIM B2 Umum',
          status: 'on-duty',
          tripsCompleted: 10,
          rating: 4.9
        }
      };

      // Broadcast and record through Hostinger MySQL Live Sync
      await publishScheduleStatusChange(simulatedPayload, oldStatus, simulatedPayload.notes);

      // If existing in store, update in memory
      if (target && target.id) {
        logisticsStore.updateScheduleStatus(target.id, nextStatus, simulatedPayload.notes);
      }

      setSimulatedFeedback(`⚡ Berhasil menyiarkan pembaruan status realtime: ${tracking} (${storeName}) menjadi "${STATUS_LABELS[nextStatus]}". Notifikasi terkirim ke SPV Logistik & Super Admin!`);
      setTimeout(() => setSimulatedFeedback(null), 6000);
    } catch (e: any) {
      setSimulatedFeedback(`Simulasi gagal: ${e?.message || 'Periksa koneksi'}`);
    } finally {
      setIsSimulating(false);
    }
  };

  const isSpvOrAdmin = currentUser?.role === 'super_admin' || currentUser?.role === 'spv_logistik';

  return (
    <div className="space-y-6">
      {/* 1. Header Card with Live Status Indicator & Admin Badges */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-sm relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-blue-500/5 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 relative z-10">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 flex-wrap">
              <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-blue-500/10 text-blue-400 text-xs font-semibold border border-blue-500/20">
                <Truck className="w-3.5 h-3.5" />
                <span>Divisi Logistik &amp; Operasional DC Banyuwangi</span>
              </div>
              
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 text-xs font-semibold border border-emerald-500/30">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <Radio className="w-3 h-3 text-emerald-400" />
                <span>Hostinger Live Sync: Aktif (MySQL schedules)</span>
              </div>

              {isSpvOrAdmin && (
                <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-300 text-xs font-semibold border border-amber-500/30">
                  <ShieldCheck className="w-3 h-3 text-amber-400" />
                  <span>Notifikasi Penerima: SPV Logistik &amp; Super Admin</span>
                </div>
              )}
            </div>

            <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight mt-1">
              Dashboard Operasional &amp; Notifikasi Real-time
            </h2>
            <p className="text-slate-400 text-xs sm:text-sm max-w-2xl leading-relaxed">
              Monitoring langsung perubahan status pengiriman armada secara real-time via Hostinger MySQL Live Sync. SPV Logistik &amp; Super Admin otomatis diberitahu saat armada berangkat, tiba di tujuan, atau mengalami kendala.
            </p>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            <button
              onClick={handleSimulateStatusChange}
              disabled={isSimulating}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 active:scale-95 text-white text-xs font-bold shadow-md shadow-blue-600/20 transition cursor-pointer disabled:opacity-50"
              title="Kirim uji pembaruan status untuk memicu notifikasi Hostinger MySQL Live Sync"
            >
              <Zap className={`w-4 h-4 text-amber-300 ${isSimulating ? 'animate-spin' : ''}`} />
              <span>{isSimulating ? 'Mengirim Realtime...' : '⚡ Simulasi Update Status'}</span>
            </button>

            {onNavigate && (
              <button
                onClick={() => onNavigate('schedules')}
                className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold border border-slate-700 transition cursor-pointer"
              >
                <span>Buka Jadwal</span>
                <ChevronRight className="w-4 h-4 text-slate-400" />
              </button>
            )}
          </div>
        </div>

        {/* Simulation Feedback Alert */}
        {simulatedFeedback && (
          <div className="mt-4 p-3.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs flex items-center justify-between gap-3 animate-in fade-in duration-300">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span className="font-medium">{simulatedFeedback}</span>
            </div>
            <button
              onClick={() => setSimulatedFeedback(null)}
              className="text-slate-400 hover:text-white text-sm font-bold cursor-pointer"
            >
              &times;
            </button>
          </div>
        )}
      </div>

      {/* 2. KPI Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* In Transit */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-xs">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-bold uppercase tracking-wider">Dalam Perjalanan</span>
            <div className="w-8 h-8 rounded-xl bg-blue-500/10 text-blue-400 flex items-center justify-center">
              <Truck className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-white">{totalInTransit}</span>
            <span className="text-xs text-blue-400 font-semibold">Armada In-Transit</span>
          </div>
          <div className="mt-2 text-[11px] text-slate-400 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />
            <span>Sedang menuju toko / customer</span>
          </div>
        </div>

        {/* Delivered */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-xs">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-bold uppercase tracking-wider">Selesai Terkirim</span>
            <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-white">{totalDelivered}</span>
            <span className="text-xs text-emerald-400 font-semibold">Terkonfirmasi</span>
          </div>
          <div className="mt-2 text-[11px] text-slate-400 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            <span>POD &amp; Tanda Tangan Lengkap</span>
          </div>
        </div>

        {/* Delayed / Kendala */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-xs">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-bold uppercase tracking-wider">Kendala / Tertunda</span>
            <div className="w-8 h-8 rounded-xl bg-rose-500/10 text-rose-400 flex items-center justify-center">
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-rose-400">{totalDelayed}</span>
            <span className="text-xs text-slate-400 font-semibold">Perlu Tindakan</span>
          </div>
          <div className="mt-2 text-[11px] text-slate-400 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-400" />
            <span>Pemberitahuan darurat SPV</span>
          </div>
        </div>

        {/* Realtime Notifs Inbound */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-xs">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-bold uppercase tracking-wider">Notifikasi Masuk</span>
            <div className="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center relative">
              <Bell className="w-4 h-4" />
              {unreadNotifsCount > 0 && (
                <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-rose-500 animate-pulse" />
              )}
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-white">{notifications.length}</span>
            <span className="text-xs text-amber-300 font-semibold">
              ({unreadNotifsCount} Belum Dibaca)
            </span>
          </div>
          <div className="mt-2 text-[11px] text-slate-400 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
            <span>Tersinkron Hostinger MySQL Live Sync</span>
          </div>
        </div>
      </div>

      {/* 3. Realtime Status Notification Feed Section */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 sm:p-6 shadow-sm space-y-4">
        {/* Section Header & Filters */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/15 border border-blue-500/30 text-blue-400 flex items-center justify-center">
              <Bell className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <span>Pusat Notifikasi Real-time Status Pengiriman</span>
                <span className="px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 text-xs font-mono font-bold border border-blue-500/30">
                  {filteredNotifications.length}
                </span>
              </h3>
              <p className="text-xs text-slate-400">
                Pembaruan status dari supir di lapangan, sistem checklist, serta perubahan tabel schedules Hostinger MySQL
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            {/* Search Input Field */}
            <div className="relative w-full sm:w-56">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Cari PO, toko, area, driver..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 text-slate-200 text-xs rounded-xl pl-9 pr-3 py-2 focus:outline-none focus:border-blue-500 placeholder:text-slate-500"
              />
            </div>

            {/* Dropdown Status Filter */}
            <div className="relative">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="bg-slate-950 border border-slate-800 text-slate-200 text-xs rounded-xl px-3 py-2 font-bold focus:outline-none focus:border-blue-500 cursor-pointer"
              >
                <option value="all">Semua Status</option>
                <option value="in_transit">Dalam Perjalanan (In Transit)</option>
                <option value="delivered">Terkirim (Delivered)</option>
                <option value="picked_up">Telah Dimuat (Picked Up)</option>
                <option value="delayed">Tertunda / Kendala (Delayed)</option>
                <option value="scheduled">Terjadwal (Scheduled)</option>
              </select>
            </div>

            {/* Mark All Read */}
            {unreadNotifsCount > 0 && (
              <button
                onClick={markAllAdminStatusNotificationsRead}
                className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-300 hover:text-white text-xs font-semibold border border-slate-700 transition cursor-pointer"
                title="Tandai semua notifikasi sebagai telah dibaca"
              >
                Tandai Dibaca
              </button>
            )}

            {notifications.length > 0 && (
              <button
                onClick={clearAdminStatusNotifications}
                className="p-2 rounded-xl bg-slate-800/80 hover:bg-rose-500/20 text-slate-400 hover:text-rose-300 border border-slate-700 hover:border-rose-500/30 transition cursor-pointer"
                title="Bersihkan riwayat notifikasi"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Notification Cards List */}
        {filteredNotifications.length === 0 ? (
          <div className="py-12 text-center rounded-xl bg-slate-950/50 border border-dashed border-slate-800 space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-slate-900 border border-slate-800 text-slate-500 flex items-center justify-center mx-auto">
              <Bell className="w-6 h-6 opacity-60" />
            </div>
            <div className="max-w-md mx-auto space-y-1">
              <h4 className="text-sm font-bold text-slate-300">
                Tidak ada notifikasi perubahan status yang cocok
              </h4>
              <p className="text-xs text-slate-500">
                {searchQuery || statusFilter !== 'all'
                  ? 'Coba sesuaikan kata kunci pencarian atau ganti filter status.'
                  : 'Hostinger MySQL Live Sync sedang aktif mendengarkan perubahan status pada tabel schedules.'}
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredNotifications.map((notif) => {
              const isDelivered = notif.newStatus === 'delivered';
              const isInTransit = notif.newStatus === 'in_transit';
              const isDelayed = notif.newStatus === 'delayed';
              const isPickedUp = notif.newStatus === 'picked_up';

              const statusColor = isDelivered
                ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                : isInTransit
                ? 'bg-blue-500/15 text-blue-400 border-blue-500/30'
                : isDelayed
                ? 'bg-rose-500/15 text-rose-400 border-rose-500/30'
                : isPickedUp
                ? 'bg-amber-500/15 text-amber-400 border-amber-500/30'
                : 'bg-slate-800 text-slate-300 border-slate-700';

              return (
                <div
                  key={notif.id}
                  onClick={() => markAdminStatusNotificationRead(notif.id)}
                  className={`p-4 rounded-xl border transition cursor-pointer flex flex-col md:flex-row md:items-center justify-between gap-4 ${
                    !notif.isRead
                      ? 'bg-slate-850/90 border-blue-500/40 shadow-sm'
                      : 'bg-slate-950/60 border-slate-800/80 hover:border-slate-700'
                  }`}
                >
                  <div className="space-y-2 min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      {/* Status Transition Chip */}
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold border ${statusColor}`}>
                        <span className="w-1.5 h-1.5 rounded-full bg-current" />
                        <span>{notif.statusLabel}</span>
                      </span>

                      {notif.oldStatus && notif.oldStatus !== notif.newStatus && (
                        <span className="text-[11px] text-slate-400 font-mono">
                          (dari: {STATUS_LABELS[notif.oldStatus] || notif.oldStatus})
                        </span>
                      )}

                      {/* PO Number */}
                      <span className="px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-slate-300 font-mono text-[11px] font-bold">
                        {notif.trackingNumber}
                      </span>

                      {/* Source badge */}
                      <span className="text-[10px] text-emerald-400 font-medium bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                        ⚡ Realtime
                      </span>

                      {/* Relative time */}
                      <span className="text-[11px] text-slate-500 flex items-center gap-1 ml-auto">
                        <Clock className="w-3 h-3" />
                        <span>{formatTimeAgo(notif.timestamp)}</span>
                      </span>
                    </div>

                    {/* Title & Detail */}
                    <div>
                      <h4 className="text-sm font-bold text-white flex items-center gap-2">
                        <span>{notif.title}</span>
                        {!notif.isRead && (
                          <span className="w-2 h-2 rounded-full bg-blue-500" title="Belum dibaca" />
                        )}
                      </h4>
                      <p className="text-xs text-slate-300 mt-0.5 leading-relaxed">
                        {notif.message}
                      </p>
                    </div>

                    {/* Driver, Fleet & Location Info */}
                    <div className="flex items-center gap-4 text-xs text-slate-400 flex-wrap pt-1">
                      <div className="flex items-center gap-1.5 font-medium text-slate-300">
                        <MapPin className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                        <span>{notif.storeName} ({notif.areaName})</span>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <Truck className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                        <span>{notif.fleetPlate} {notif.fleetInitialCode ? `(${notif.fleetInitialCode})` : ''}</span>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <Users className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                        <span>{notif.driverName} {notif.helperName ? `& ${notif.helperName}` : ''}</span>
                      </div>
                    </div>

                    {notif.notes && (
                      <div className="text-[11px] text-slate-400 bg-slate-900/60 p-2 rounded-lg border border-slate-800 italic">
                        &quot;{notif.notes}&quot;
                      </div>
                    )}
                  </div>

                  {/* Action Link to Schedule View */}
                  {onNavigate && (
                    <div className="shrink-0 self-end md:self-center">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          markAdminStatusNotificationRead(notif.id);
                          onNavigate('schedules');
                        }}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-blue-600 hover:text-white text-slate-300 text-xs font-semibold border border-slate-700 transition cursor-pointer"
                      >
                        <span>Cek Roster</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
