import React, { useState, useEffect, useMemo } from 'react';
import { logisticsStore } from '../services/store';
import { SystemActivity, CrewDeliveryHistory } from '../types';
import { History, Search, Calendar, Filter, X, BarChart3, Download, FileText, Printer, Truck, AlertTriangle, Bell, Zap, CheckCircle2 } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { useToast } from '../context/ToastContext';

// Custom modern tooltip for the mini chart
const CustomTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-slate-950 border border-slate-800 px-2.5 py-1.5 rounded-lg text-[10px] shadow-lg">
        <p className="font-bold text-slate-200">{payload[0].payload.name}</p>
        <p className="text-indigo-400 font-bold mt-0.5">{payload[0].value} Aksi</p>
      </div>
    );
  }
  return null;
};

export const SystemActivityLog: React.FC = () => {
  const [activities, setActivities] = useState<SystemActivity[]>(logisticsStore.getSystemActivities());
  const [deliveryHistory, setDeliveryHistory] = useState<CrewDeliveryHistory[]>(logisticsStore.getCrewDeliveryHistory());
  const [activeTab, setActiveTab] = useState<'activities' | 'delivery_history'>('activities');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDept, setSelectedDept] = useState('');
  const [selectedAction, setSelectedAction] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [slaThresholdMinutes, setSlaThresholdMinutes] = useState<number>(120); // 2 hours default threshold
  const [lastAlertSent, setLastAlertSent] = useState<string | null>(null);
  const [attentionMode, setAttentionMode] = useState<boolean>(false);

  const { addNotification } = useToast();

  useEffect(() => {
    return logisticsStore.subscribe(() => {
      setActivities(logisticsStore.getSystemActivities());
      setDeliveryHistory(logisticsStore.getCrewDeliveryHistory());
    });
  }, []);

  // Identify shipments exceeding SLA threshold (partial, returned, or simulated duration > SLA)
  const overSlaShipments = useMemo(() => {
    return deliveryHistory.filter(h => {
      const isOverStatus = h.status === 'partial' || h.status === 'returned';
      const estimatedMinutes = h.cargoWeightTon > 15 ? 150 : h.cargoWeightTon > 10 ? 135 : 90;
      const isOverDuration = estimatedMinutes > slaThresholdMinutes;
      return isOverStatus || isOverDuration;
    });
  }, [deliveryHistory, slaThresholdMinutes]);

  const handleTriggerSupervisorAlerts = () => {
    if (overSlaShipments.length === 0) {
      addNotification('schedule', 'Pemeriksaan SLA Selesai', 'Tidak ada pengiriman yang melampaui batas ambang SLA saat ini.', false);
      return;
    }

    overSlaShipments.slice(0, 3).forEach(item => {
      const title = `🚨 SLA Overdue: ${item.storeName} (${item.vehiclePlate})`;
      const message = `Driver ${item.crewName} (${item.area}) melampaui batas durasi muat SLA ${slaThresholdMinutes} mnt. Muatan: ${item.cargoWeightTon} Ton. Status: ${item.status.toUpperCase()}`;
      addNotification('checker', title, message, true);
    });

    logisticsStore.logActivity(
      'Broadcast Alert SLA',
      'Dashboard Logistik',
      `Supervisor menerima peringatan real-time untuk ${overSlaShipments.length} pengiriman over-SLA`
    );

    setLastAlertSent(new Date().toLocaleTimeString('id-ID'));
  };

  // Dynamically extract unique departments for filter dropdown
  const uniqueDepartments = useMemo(() => {
    const depts = new Set<string>();
    activities.forEach(a => {
      if (a.department) depts.add(a.department);
    });
    return Array.from(depts).sort();
  }, [activities]);

  // Dynamically extract unique action types for filter dropdown
  const uniqueActions = useMemo(() => {
    const acts = new Set<string>();
    activities.forEach(a => {
      if (a.action) acts.add(a.action);
    });
    return Array.from(acts).sort();
  }, [activities]);

  // Apply all filter rules
  const filteredActivities = useMemo(() => {
    return activities.filter(a => {
      const matchesSearch = 
        a.action.toLowerCase().includes(searchTerm.toLowerCase()) ||
        a.target.toLowerCase().includes(searchTerm.toLowerCase()) ||
        a.userFullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        a.details.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesDept = !selectedDept || a.department === selectedDept;
      const matchesAction = !selectedAction || a.action === selectedAction;

      let matchesDate = true;
      if (startDate || endDate) {
        const logDate = new Date(a.timestamp);
        if (startDate) {
          const start = new Date(startDate);
          start.setHours(0, 0, 0, 0);
          if (logDate < start) matchesDate = false;
        }
        if (endDate) {
          const end = new Date(endDate);
          end.setHours(23, 59, 59, 999);
          if (logDate > end) matchesDate = false;
        }
      }

      return matchesSearch && matchesDept && matchesAction && matchesDate;
    });
  }, [activities, searchTerm, selectedDept, selectedAction, startDate, endDate]);

  const filteredDeliveryHistory = useMemo(() => {
    return deliveryHistory.filter(h => {
      const matchesSearch = 
        h.crewName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        h.vehiclePlate.toLowerCase().includes(searchTerm.toLowerCase()) ||
        h.storeName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        h.status.toLowerCase().includes(searchTerm.toLowerCase()) ||
        h.cargoDescription.toLowerCase().includes(searchTerm.toLowerCase()) ||
        h.area.toLowerCase().includes(searchTerm.toLowerCase());

      let matchesDate = true;
      if (startDate || endDate) {
        const tripDate = new Date(h.completionDate);
        if (startDate) {
          const start = new Date(startDate);
          start.setHours(0, 0, 0, 0);
          if (tripDate < start) matchesDate = false;
        }
        if (endDate) {
          const end = new Date(endDate);
          end.setHours(23, 59, 59, 999);
          if (tripDate > end) matchesDate = false;
        }
      }

      return matchesSearch && matchesDate;
    });
  }, [deliveryHistory, searchTerm, startDate, endDate]);

  // Compute action frequency per department for mini chart visualization
  const departmentChartData = useMemo(() => {
    const counts: { [dept: string]: number } = {};
    filteredActivities.forEach(a => {
      const dept = a.department || 'Umum';
      counts[dept] = (counts[dept] || 0) + 1;
    });

    return Object.entries(counts)
      .map(([name, count]) => ({
        name: name.length > 15 ? `${name.substring(0, 15)}...` : name,
        fullName: name,
        count
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  }, [filteredActivities]);

  const handleResetFilters = () => {
    setSearchTerm('');
    setSelectedDept('');
    setSelectedAction('');
    setStartDate('');
    setEndDate('');
  };

  const hasActiveFilters = searchTerm || selectedDept || selectedAction || startDate || endDate;
  const colors = ['#6366f1', '#818cf8', '#a5b4fc', '#c7d2fe', '#e0e7ff'];

  // Export handlers
  const exportActivitiesCsv = () => {
    const headers = ['Waktu', 'Pengguna', 'Departemen', 'Aksi', 'Target', 'Detail'];
    const rows = filteredActivities.map(a => [
      `"${new Date(a.timestamp).toLocaleString('id-ID')}"`,
      `"${a.userFullName}"`,
      `"${a.department || '-'}"`,
      `"${a.action}"`,
      `"${a.target}"`,
      `"${a.details.replace(/"/g, '""')}"`
    ]);
    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `laporan_aktivitas_sistem_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const exportActivitiesPdf = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    const html = `
      <html>
        <head>
          <title>Laporan Aktivitas Sistem - PT Anugerah Kemasan Kreatif</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 20px; color: #1e293b; }
            h2 { color: #0f172a; margin-bottom: 4px; }
            .subtitle { font-size: 12px; color: #64748b; margin-bottom: 20px; }
            table { width: 100%; border-collapse: collapse; margin-top: 15px; font-size: 11px; }
            th, td { border: 1px solid #cbd5e1; padding: 8px; text-align: left; }
            th { background-color: #f1f5f9; color: #334155; }
            tr:nth-child(even) { background-color: #f8fafc; }
            .footer { margin-top: 30px; font-size: 10px; color: #94a3b8; text-align: right; }
          </style>
        </head>
        <body>
          <h2>PT ANUGERAH KEMASAN KREATIF - BANYUWANGI HUB</h2>
          <div class="subtitle">Laporan Aktivitas Sistem & Audit Log • Dicetak pada: ${new Date().toLocaleString('id-ID')}</div>
          <table>
            <thead>
              <tr>
                <th>Waktu</th>
                <th>Pengguna</th>
                <th>Departemen</th>
                <th>Aksi</th>
                <th>Target</th>
                <th>Detail</th>
              </tr>
            </thead>
            <tbody>
              ${filteredActivities.map(a => `
                <tr>
                  <td>${new Date(a.timestamp).toLocaleString('id-ID')}</td>
                  <td>${a.userFullName}</td>
                  <td>${a.department || '-'}</td>
                  <td>${a.action}</td>
                  <td>${a.target}</td>
                  <td>${a.details}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
          <div class="footer">Sistem Operasional Logistik AKK v2.5</div>
          <script>window.onload = function() { window.print(); window.close(); }</script>
        </body>
      </html>
    `;
    printWindow.document.write(html);
    printWindow.document.close();
  };

  const exportDeliveryHistoryCsv = () => {
    const headers = ['ID Trip', 'Tanggal Selesai', 'Driver / Kru', 'No. Polisi', 'Destinasi Toko', 'Wilayah', 'Status', 'Muatan (Ton)'];
    const rows = filteredDeliveryHistory.map(h => [
      `"${h.id}"`,
      `"${h.completionDate}"`,
      `"${h.crewName}"`,
      `"${h.vehiclePlate}"`,
      `"${h.storeName}"`,
      `"${h.area}"`,
      `"${h.status}"`,
      `"${h.cargoWeightTon}"`
    ]);
    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `riwayat_pengiriman_kru_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const exportDeliveryHistoryPdf = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    const html = `
      <html>
        <head>
          <title>Riwayat Pengiriman & Audit SLA - PT Anugerah Kemasan Kreatif</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 20px; color: #1e293b; }
            h2 { color: #0f172a; margin-bottom: 4px; }
            .subtitle { font-size: 12px; color: #64748b; margin-bottom: 20px; }
            table { width: 100%; border-collapse: collapse; margin-top: 15px; font-size: 11px; }
            th, td { border: 1px solid #cbd5e1; padding: 8px; text-align: left; }
            th { background-color: #f1f5f9; color: #334155; }
            tr:nth-child(even) { background-color: #f8fafc; }
            .footer { margin-top: 30px; font-size: 10px; color: #94a3b8; text-align: right; }
          </style>
        </head>
        <body>
          <h2>PT ANUGERAH KEMASAN KREATIF - BANYUWANGI HUB</h2>
          <div class="subtitle">Laporan Riwayat Pengiriman & Kinerja Kru • Dicetak pada: ${new Date().toLocaleString('id-ID')}</div>
          <table>
            <thead>
              <tr>
                <th>ID Trip</th>
                <th>Tanggal Selesai</th>
                <th>Driver / Kru</th>
                <th>No. Polisi</th>
                <th>Destinasi Toko</th>
                <th>Wilayah</th>
                <th>Status</th>
                <th>Muatan (Ton)</th>
              </tr>
            </thead>
            <tbody>
              ${filteredDeliveryHistory.map(h => `
                <tr>
                  <td>${h.id}</td>
                  <td>${h.completionDate}</td>
                  <td>${h.crewName}</td>
                  <td>${h.vehiclePlate}</td>
                  <td>${h.storeName}</td>
                  <td>${h.area}</td>
                  <td>${h.status}</td>
                  <td>${h.cargoWeightTon} Ton</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
          <div class="footer">Sistem Operasional Logistik AKK v2.5</div>
          <script>window.onload = function() { window.print(); window.close(); }</script>
        </body>
      </html>
    `;
    printWindow.document.write(html);
    printWindow.document.close();
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-sm space-y-5">
      {/* REAL-TIME SLA MONITOR BANNER FOR SUPERVISORS */}
      <div className="bg-gradient-to-r from-amber-500/15 via-rose-500/10 to-slate-950 border border-amber-500/30 rounded-2xl p-4 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 shrink-0 mt-0.5 animate-pulse">
            <Zap className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h4 className="text-xs font-black text-amber-400 uppercase tracking-wider">Real-Time SLA Loading Monitor</h4>
              <span className="px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/30 text-[10px] font-bold">
                {overSlaShipments.length} Over SLA Terdeteksi
              </span>
            </div>
            <p className="text-xs text-slate-300 mt-1">
              Sistem memantau durasi muat secara real-time terhadap ambang batas SLA <strong className="text-white font-mono">{slaThresholdMinutes} menit</strong>. Peringatan otomatis akan dikirim ke supervisor saat terdeteksi keterlambatan.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <div className="flex items-center gap-2 bg-slate-950/80 px-3 py-1.5 rounded-xl border border-slate-800">
            <span className="text-[10px] text-slate-400 font-bold uppercase">Batas SLA:</span>
            <select
              value={slaThresholdMinutes}
              onChange={(e) => setSlaThresholdMinutes(Number(e.target.value))}
              className="bg-slate-900 text-xs font-bold text-amber-400 border border-slate-700 rounded-lg px-2 py-1 focus:outline-none cursor-pointer"
            >
              <option value={90}>90 Menit</option>
              <option value={120}>120 Menit (Default)</option>
              <option value={150}>150 Menit</option>
              <option value={180}>180 Menit</option>
            </select>
          </div>

          <button
            onClick={handleTriggerSupervisorAlerts}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-rose-500 hover:from-amber-400 hover:to-rose-400 text-slate-950 text-xs font-black transition shadow-md cursor-pointer active:scale-95"
          >
            <Bell className="w-4 h-4 fill-slate-950" />
            <span>Kirim Alert Supervisor Sekarang</span>
          </button>
        </div>
      </div>

      {lastAlertSent && (
        <div className="text-[11px] text-emerald-400 font-medium flex items-center gap-1.5 bg-emerald-500/10 border border-emerald-500/20 px-3 py-2 rounded-xl">
          <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
          <span>Broadcast peringatan SLA real-time berhasil dikirim ke supervisor pada pukul {lastAlertSent}.</span>
        </div>
      )}

      {/* Header and Report Tab Switcher & Export Actions */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 border-b border-slate-800 pb-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
            {activeTab === 'activities' ? <History className="w-5 h-5" /> : <Truck className="w-5 h-5" />}
          </div>
          <div>
            <h3 className="text-sm font-bold text-white">
              {activeTab === 'activities' ? 'Pusat Log Aktivitas Sistem' : 'Riwayat Pengiriman & Audit SLA'}
            </h3>
            <p className="text-[11px] text-slate-400">
              {activeTab === 'activities' ? 'Pemantauan rekam jejak aksi pengguna lintas departemen' : 'Arsip perjalanan armada dan kepatuhan SLA pengiriman'}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Tab Switcher */}
          <div className="flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800">
            <button
              onClick={() => setActiveTab('activities')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                activeTab === 'activities'
                  ? 'bg-indigo-600 text-white shadow'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Aktivitas Sistem
            </button>
            <button
              onClick={() => setActiveTab('delivery_history')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                activeTab === 'delivery_history'
                  ? 'bg-indigo-600 text-white shadow'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Riwayat Pengiriman
            </button>
          </div>

          {/* Attention Mode Toggle */}
          <button
            onClick={() => setAttentionMode(!attentionMode)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition cursor-pointer shadow-xs border ${
              attentionMode
                ? 'bg-amber-500 text-slate-950 border-amber-400 font-black animate-pulse'
                : 'bg-slate-950 hover:bg-slate-800 text-amber-400 border-amber-500/30'
            }`}
            title="Sorot baris dengan peringatan kritis atau pelanggaran SLA"
          >
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>Mode Perhatian {attentionMode ? '(Aktif)' : ''}</span>
          </button>

          {/* Export Dropdown / Action Buttons */}
          <div className="flex items-center gap-2">
            <button
              onClick={activeTab === 'activities' ? exportActivitiesCsv : exportDeliveryHistoryCsv}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/40 text-emerald-300 text-xs font-bold transition cursor-pointer shadow-xs"
              title="Unduh format Excel / CSV"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Unduh Excel</span>
            </button>

            <button
              onClick={activeTab === 'activities' ? exportActivitiesPdf : exportDeliveryHistoryPdf}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-indigo-600/20 hover:bg-indigo-600/30 border border-indigo-500/40 text-indigo-300 text-xs font-bold transition cursor-pointer shadow-xs"
              title="Cetak atau Unduh Format PDF"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Cetak / PDF</span>
            </button>
          </div>
        </div>
      </div>

      {/* Search and Filters Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input 
            type="text" 
            placeholder={activeTab === 'activities' ? "Cari log, aksi, atau detail..." : "Cari kru, nopol, toko, atau wilayah..."}
            className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500/50"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        {hasActiveFilters && (
          <button
            onClick={handleResetFilters}
            className="flex items-center gap-1 text-xs font-bold text-rose-400 hover:text-rose-300 transition cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
            <span>Atur Ulang Filter</span>
          </button>
        )}
      </div>

      {activeTab === 'activities' ? (
        <>
          {/* Grid: Left - Advanced Filter Panel, Right - Mini Visualisation Chart */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            {/* Advanced Filter Panel */}
            <div className="lg:col-span-7 bg-slate-950/40 border border-slate-800/80 rounded-xl p-4 space-y-4">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-300">
                <Filter className="w-3.5 h-3.5 text-indigo-400" />
                <span>Filter Lanjutan Log Aktivitas</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Department Filter */}
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Departemen</label>
                  <select
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-indigo-500/50 cursor-pointer"
                    value={selectedDept}
                    onChange={(e) => setSelectedDept(e.target.value)}
                  >
                    <option value="">Semua Departemen</option>
                    {uniqueDepartments.map(dept => (
                      <option key={dept} value={dept}>{dept}</option>
                    ))}
                  </select>
                </div>

                {/* Action Type Filter */}
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Tipe Aksi</label>
                  <select
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-indigo-500/50 cursor-pointer"
                    value={selectedAction}
                    onChange={(e) => setSelectedAction(e.target.value)}
                  >
                    <option value="">Semua Aksi</option>
                    {uniqueActions.map(act => (
                      <option key={act} value={act}>{act}</option>
                    ))}
                  </select>
                </div>

                {/* Start Date */}
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Mulai Tanggal</label>
                  <input
                    type="date"
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-indigo-500/50 cursor-pointer scheme-dark"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                  />
                </div>

                {/* End Date */}
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Sampai Tanggal</label>
                  <input
                    type="date"
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-indigo-500/50 cursor-pointer scheme-dark"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                  />
                </div>
              </div>
            </div>

            {/* Mini Chart Panel */}
            <div className="lg:col-span-5 bg-slate-950/40 border border-slate-800/80 rounded-xl p-4 flex flex-col min-h-[180px] justify-between">
              <div className="flex items-center gap-2 mb-2">
                <BarChart3 className="w-3.5 h-3.5 text-indigo-400" />
                <span className="text-xs font-bold text-slate-300">Frekuensi Aksi per Departemen</span>
              </div>

              <div className="h-[120px] w-full">
                {departmentChartData.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-[10px] text-slate-500">
                    Tidak ada data aktivitas untuk divisualisasikan
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={departmentChartData}
                      layout="vertical"
                      margin={{ top: 5, right: 10, left: -25, bottom: 5 }}
                    >
                      <XAxis type="number" hide />
                      <YAxis 
                        dataKey="name" 
                        type="category" 
                        axisLine={false} 
                        tickLine={false} 
                        tick={{ fill: '#94a3b8', fontSize: 9, fontWeight: 500 }}
                      />
                      <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(99, 102, 241, 0.05)' }} />
                      <Bar dataKey="count" radius={[0, 4, 4, 0]} barSize={10}>
                        {departmentChartData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>
          </div>

          {/* Activities Table */}
          <div className="overflow-x-auto">
            {filteredActivities.length === 0 ? (
              <div className="text-center py-8 text-slate-500 text-xs">
                Tidak ada aktivitas sistem yang cocok dengan kriteria filter Anda.
              </div>
            ) : (
              <table className="w-full text-xs text-left">
                <thead className="text-slate-400 border-b border-slate-800">
                  <tr>
                    <th className="py-2 pr-2">Waktu</th>
                    <th className="py-2 pr-2">Pengguna</th>
                    <th className="py-2 pr-2">Departemen</th>
                    <th className="py-2 pr-2">Aksi</th>
                    <th className="py-2 pr-2">Target</th>
                    <th className="py-2">Detail</th>
                  </tr>
                </thead>
                <tbody className="text-white divide-y divide-slate-800/60">
                  {filteredActivities.map(a => {
                    const isCritical = attentionMode && (a.action.toLowerCase().includes('alert') || a.action.toLowerCase().includes('error') || a.action.toLowerCase().includes('retur'));
                    const rowClassName = attentionMode 
                      ? isCritical 
                        ? 'bg-amber-500/20 border-l-4 border-l-amber-400 text-amber-200 font-bold transition-all shadow-sm' 
                        : 'opacity-30 grayscale transition-all'
                      : 'hover:bg-slate-800/25 transition-colors';

                    return (
                      <tr key={a.id} className={rowClassName}>
                        <td className="py-2.5 pr-2 text-slate-400 whitespace-nowrap">
                          {new Date(a.timestamp).toLocaleString('id-ID', {
                            year: 'numeric',
                            month: '2-digit',
                            day: '2-digit',
                            hour: '2-digit',
                            minute: '2-digit',
                            second: '2-digit'
                          })}
                        </td>
                        <td className="py-2.5 pr-2 font-medium">{a.userFullName}</td>
                        <td className="py-2.5 pr-2 text-slate-400">{a.department || '-'}</td>
                        <td className="py-2.5 pr-2">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                            isCritical
                              ? 'bg-amber-500/30 text-amber-200 border-amber-400 animate-pulse'
                              : 'bg-indigo-500/10 text-indigo-300 border-indigo-500/20'
                          }`}>
                            {a.action}
                          </span>
                        </td>
                        <td className="py-2.5 pr-2 font-medium text-slate-300">{a.target}</td>
                        <td className="py-2.5 text-slate-400 max-w-xs truncate" title={a.details}>
                          {a.details}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </>
      ) : (
        <>
          {/* Delivery History Table */}
          <div className="overflow-x-auto">
            {filteredDeliveryHistory.length === 0 ? (
              <div className="text-center py-8 text-slate-500 text-xs">
                Tidak ada riwayat pengiriman yang cocok dengan kriteria pencarian Anda.
              </div>
            ) : (
              <table className="w-full text-xs text-left">
                <thead className="text-slate-400 border-b border-slate-800">
                  <tr>
                    <th className="py-2 pr-2">ID Trip</th>
                    <th className="py-2 pr-2">Tanggal Selesai</th>
                    <th className="py-2 pr-2">Driver / Kru</th>
                    <th className="py-2 pr-2">No. Polisi</th>
                    <th className="py-2 pr-2">Destinasi Toko</th>
                    <th className="py-2 pr-2">Wilayah</th>
                    <th className="py-2 pr-2">Status</th>
                    <th className="py-2">Muatan</th>
                  </tr>
                </thead>
                <tbody className="text-white divide-y divide-slate-800/60">
                  {filteredDeliveryHistory.map(h => {
                    const isOverSla = h.status === 'partial' || h.status === 'returned' || h.cargoWeightTon > 10;
                    const rowClassName = attentionMode
                      ? isOverSla
                        ? 'bg-rose-500/20 border-l-4 border-l-rose-500 text-rose-200 font-bold transition-all shadow-sm'
                        : 'opacity-30 grayscale transition-all'
                      : 'hover:bg-slate-800/25 transition-colors';

                    return (
                      <tr key={h.id} className={rowClassName}>
                        <td className="py-2.5 pr-2 font-mono text-indigo-400">{h.id}</td>
                        <td className="py-2.5 pr-2 text-slate-300">{h.completionDate}</td>
                        <td className="py-2.5 pr-2 font-semibold text-white">{h.crewName}</td>
                        <td className="py-2.5 pr-2 font-mono text-slate-300">{h.vehiclePlate}</td>
                        <td className="py-2.5 pr-2 text-slate-300">{h.storeName}</td>
                        <td className="py-2.5 pr-2 text-slate-400">{h.area}</td>
                        <td className="py-2.5 pr-2">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                            h.status === 'delivered'
                              ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                              : h.status === 'partial'
                              ? 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                              : 'bg-rose-500/15 text-rose-300 border-rose-500/30'
                          }`}>
                            {h.status === 'delivered' ? 'Terkirim Sempurna' : h.status === 'partial' ? 'Sebagian' : 'Retur'}
                          </span>
                        </td>
                        <td className="py-2.5 font-mono text-slate-300">{h.cargoWeightTon} Ton</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}
    </div>
  );
};
