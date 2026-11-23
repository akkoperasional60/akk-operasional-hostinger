import React, { useState, useEffect, useMemo } from 'react';
import * as XLSX from 'xlsx';
import { logisticsStore } from '../services/store';
import { 
  Users, Building2, Database, ShoppingBag, TrendingUp, AlertCircle, 
  CheckCircle2, UserCheck, ShieldAlert, Brush, Award, Video, Play,
  Check, Clock, Search, Plus, Calendar, ShieldCheck, FileText, ExternalLink,
  Truck, ArrowRight, X, Download, DollarSign, MapPin, CreditCard,
  ChevronLeft, ChevronRight, ChevronDown, ChevronUp, Trash2, MessageSquare, Printer, Phone, Send,
  Camera, Smartphone, Upload, AlertTriangle, History, Layers, Filter, Edit3
} from 'lucide-react';
import { SecurityGateLog } from '../types';
import { TeamCalendar } from './TeamCalendar';
import { HrEmployeeRollingView } from './hr/HrEmployeeRollingView';
import { WarehouseManagementSystem } from './WarehouseManagementSystem';
import { AkkLogo } from './AkkLogo';
import { branchStore, BranchRecord } from '../services/branchStore';
import {
  FinanceMonitoringLedgerView,
  CustomerMasterMappingView
} from './finance/FinanceLedgerAndMapping';
import { FinanceOverviewDashboard } from './finance/FinanceOverviewDashboard';
import {
  SalesNameMappingRecord,
  DEFAULT_SALES_MAPPINGS,
  SALES_MAPPINGS_UPDATED_EVENT,
  fetchSalesNameMappingsFromMysql,
  getCachedSalesNameMappings,
  resolveSalesFromMappings
} from './marketing/MarketingInvoiceValidationView';

const MetricCard = ({ title, value, subtext, icon: Icon, color }: { title: string, value: string, subtext: string, icon: any, color: string }) => (
  <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 rounded-2xl shadow-xs">
    <div className="flex items-center justify-between mb-3">
      <h3 className="text-slate-500 dark:text-slate-400 text-xs font-semibold uppercase">{title}</h3>
      <Icon className={`w-5 h-5 ${color}`} />
    </div>
    <div className="text-2xl font-black text-slate-900 dark:text-white">{value}</div>
    <p className="text-slate-500 text-xs mt-1">{subtext}</p>
  </div>
);

export type HrSubTab = 'hr_core' | 'ga_security' | 'ga_hk' | 'ga_aset' | 'training_videos' | 'training_karyawan';

const HRDashboard: React.FC<{ activeHrTab?: HrSubTab; onSelectHrTab?: (tab: HrSubTab) => void }> = ({ 
  activeHrTab = 'hr_core',
  onSelectHrTab
}) => {
  const [currentSubTab, setCurrentSubTab] = useState<HrSubTab>(activeHrTab);

  useEffect(() => {
    if (activeHrTab) {
      setCurrentSubTab(activeHrTab);
    }
  }, [activeHrTab]);

  const handleTabChange = (tab: HrSubTab) => {
    setCurrentSubTab(tab);
    if (onSelectHrTab) {
      onSelectHrTab(tab);
    }
  };

  const [selectedVideoModal, setSelectedVideoModal] = useState<string | null>(null);

  // GA: Dynamic Security Logs from Store
  const [securityLogs, setSecurityLogs] = useState<SecurityGateLog[]>(() => logisticsStore.getSecurityLogs());
  const [isGateInModalOpen, setIsGateInModalOpen] = useState(false);
  const [gateInForm, setGateInForm] = useState({
    scheduleId: '',
    plateNumber: '',
    driverName: '',
    notes: 'Armada tiba kembali di gudang DC Banyuwangi setelah menyelesaikan rute pengiriman.'
  });

  const [isGateOutModalOpen, setIsGateOutModalOpen] = useState(false);
  const [gateOutForm, setGateOutForm] = useState({
    scheduleId: '',
    plateNumber: '',
    driverName: '',
    destination: ''
  });

  useEffect(() => {
    return logisticsStore.subscribe(() => {
      setSecurityLogs(logisticsStore.getSecurityLogs());
    });
  }, []);

  const handleSelectScheduleForGateIn = (schId: string) => {
    const sch = logisticsStore.getSchedules().find(s => s.id === schId);
    if (sch) {
      setGateInForm({
        scheduleId: sch.id,
        plateNumber: sch.fleet?.plateNumber || '',
        driverName: sch.crew?.name || '',
        notes: `Armada tiba di gudang DC Banyuwangi dari rute ${sch.areaName || sch.store?.storeName || 'pengiriman'}. Pengecekan muatan & segel lengkap.`
      });
    } else {
      setGateInForm(prev => ({ ...prev, scheduleId: '' }));
    }
  };

  const handleSelectScheduleForGateOut = (schId: string) => {
    const sch = logisticsStore.getSchedules().find(s => s.id === schId);
    if (sch) {
      setGateOutForm({
        scheduleId: sch.id,
        plateNumber: sch.fleet?.plateNumber || '',
        driverName: sch.crew?.name || '',
        destination: sch.areaName || sch.store?.storeName || 'Area Distribusi'
      });
    } else {
      setGateOutForm(prev => ({ ...prev, scheduleId: '' }));
    }
  };

  const handleSaveGateOut = (e: React.FormEvent) => {
    e.preventDefault();
    if (!gateOutForm.plateNumber.trim()) {
      return;
    }
    const matchedFleet = logisticsStore.getFleets().find(f => 
      f.plateNumber.replace(/\s+/g, '').toUpperCase() === gateOutForm.plateNumber.replace(/\s+/g, '').toUpperCase()
    );
    logisticsStore.recordGateOut(
      gateOutForm.scheduleId || undefined,
      gateOutForm.plateNumber.trim(),
      gateOutForm.driverName.trim() || 'Driver AKK',
      gateOutForm.destination.trim() || 'Area Distribusi',
      matchedFleet?.initialCode
    );
    setIsGateOutModalOpen(false);
    setGateOutForm({
      scheduleId: '',
      plateNumber: '',
      driverName: '',
      destination: ''
    });
  };

  const handleSaveGateIn = (e: React.FormEvent) => {
    e.preventDefault();
    if (!gateInForm.plateNumber.trim()) {
      return;
    }
    const matchedFleet = logisticsStore.getFleets().find(f => 
      f.plateNumber.replace(/\s+/g, '').toUpperCase() === gateInForm.plateNumber.replace(/\s+/g, '').toUpperCase()
    );
    logisticsStore.recordGateIn(
      gateInForm.scheduleId || undefined,
      gateInForm.plateNumber.trim(),
      gateInForm.driverName.trim() || 'Driver AKK',
      gateInForm.notes.trim(),
      matchedFleet?.initialCode
    );
    setIsGateInModalOpen(false);
    setGateInForm({
      scheduleId: '',
      plateNumber: '',
      driverName: '',
      notes: 'Armada tiba kembali di gudang DC Banyuwangi setelah menyelesaikan rute pengiriman.'
    });
  };

  // GA: Housekeeping 5R Mock Items
  const housekeepingItems = [
    { id: 'HK-01', area: 'Zona Produksi & Cetak Karton', pic: 'Siti Aminah', status: 'Bersih & Rapi', score: '98%', checkDate: 'Hari ini, 07:00 WIB', fiveR: 'Ringkas, Rapi, Resik' },
    { id: 'HK-02', area: 'Loading Dock & Parkir Armada Truk', pic: 'Bambang HK', status: 'Pembersihan Rutin', score: '95%', checkDate: 'Hari ini, 08:30 WIB', fiveR: 'Rawat & Resik' },
    { id: 'HK-03', area: 'Kantor Staf Operasional & Sales', pic: 'Nurul Hidayati', status: 'Higienis & Rapi', score: '99%', checkDate: 'Hari ini, 06:45 WIB', fiveR: 'Rajin & Rapi' },
    { id: 'HK-04', area: 'Fasilitas Sanitasi, Toilet & Musholla', pic: 'Deni Kurniawan', status: 'Inspeksi Selesai', score: '97%', checkDate: 'Hari ini, 09:15 WIB', fiveR: 'Resik & Higienis' }
  ];

  // GA: Aset Pabrik Mock
  const assetItems = [
    { id: 'AST-001', name: 'Genset Silent Perkins 150 kVA', category: 'Power & Utility', condition: 'Prima', location: 'Ruang Mesin Timur', lastService: '12 Sep 2026', nextService: '12 Des 2026' },
    { id: 'AST-002', name: 'Forklift Diesel Toyota 3.0 Ton', category: 'Alat Berat DC', condition: 'Operasional', location: 'Loading Dock 1', lastService: '01 Okt 2026', nextService: '01 Jan 2027' },
    { id: 'AST-003', name: 'Hand Pallet Hydraulic 2.5 Ton (x4)', category: 'Material Handling', condition: 'Baik (1 Unit Perlu Pelumasan)', location: 'Gudang Packaging', lastService: '15 Agu 2026', nextService: '15 Nov 2026' },
    { id: 'AST-004', name: 'Mesin Automatic Strapping Box', category: 'Packaging Machinery', condition: 'Sangat Baik', location: 'Lini Packing 2', lastService: '20 Sep 2026', nextService: '20 Nov 2026' },
    { id: 'AST-005', name: 'Sistem Kamera CCTV 32 Channel IP', category: 'Keamanan Pabrik', condition: 'Online 100%', location: 'Pos Satpam & Perimeter', lastService: '05 Okt 2026', nextService: '05 Jan 2027' }
  ];

  // Training & Development: Video Training Modules
  const videoModules = [
    {
      id: 'VID-01',
      title: 'SOP Tata Cara Bongkar Muat Aman & Penataan Box Karton',
      duration: '12 Menit',
      category: 'Operasional Gudang & Ekspedisi',
      views: '148x ditonton',
      status: 'Wajib Semua Kru',
      thumbnail: '📦'
    },
    {
      id: 'VID-02',
      title: 'Panduan Keselamatan Kerja & K3 Logistik Pengiriman Lintas Pulau',
      duration: '18 Menit',
      category: 'K3 & Keselamatan',
      views: '112x ditonton',
      status: 'Wajib Driver & Helper',
      thumbnail: '🦺'
    },
    {
      id: 'VID-03',
      title: 'Tutorial Lengkap Aplikasi Driver Mobile AKK: Ceklis KIR & Foto Bukti POD',
      duration: '8 Menit',
      category: 'Sistem Digital AKK',
      views: '189x ditonton',
      status: 'Sertifikasi Terverifikasi',
      thumbnail: '📱'
    },
    {
      id: 'VID-04',
      title: 'Teknik Defensive Driving & Efisiensi Bahan Bakar BioSolar Truk Engkel/Double',
      duration: '15 Menit',
      category: 'Pelatihan Pengemudi',
      views: '94x ditonton',
      status: 'Rekomendasi Driver',
      thumbnail: '🚛'
    }
  ];

  // Training & Development: Employee Training Schedule & Matrix
  const trainingSchedules = [
    { id: 'TRN-201', program: 'Sertifikasi K3 Logistik & Penanganan Beban Ergonomis', target: 'Kru Supir & Helper', date: '22 Oktober 2026', trainer: 'Disnaker & Instruktur K3 AKK', peserta: '19 Orang', status: 'Terjadwal' },
    { id: 'TRN-202', program: 'Pelatihan Standar Pelayanan & Komunikasi Ramah Mitra Retail', target: 'Driver & Petugas Ekspedisi', date: '28 Oktober 2026', trainer: 'HR & Marketing Lead', peserta: '15 Orang', status: 'Pendaftaran Dibuka' },
    { id: 'TRN-203', program: 'Penyegaran Defensive Driving & Penanganan Darurat Rem Truk', target: 'Driver Utama SIM B2 Umum', date: '05 November 2026', trainer: 'Master Driver Instruktur', peserta: '12 Orang', status: 'Persiapan Modul' }
  ];

  return (
    <div className="space-y-6">
      {(currentSubTab.startsWith('ga_') || currentSubTab.startsWith('training_')) && (
      <div className="space-y-3">

        {/* Sub-navigasi internal untuk GA */}
        {currentSubTab.startsWith('ga_') && (
          <div className="flex flex-wrap items-center gap-2 px-3 py-2 rounded-xl bg-slate-900/70 border border-slate-800 text-xs">
            <span className="text-[10px] font-black uppercase tracking-wider text-amber-400 mr-1">
              Sub-Bagian GA:
            </span>
            <button
              type="button"
              onClick={() => handleTabChange('ga_security')}
              className={`px-3 py-1.5 rounded-lg font-bold flex items-center gap-1.5 transition cursor-pointer ${
                currentSubTab === 'ga_security'
                  ? 'bg-amber-500 text-slate-950'
                  : 'text-slate-300 hover:bg-slate-800'
              }`}
            >
              <ShieldAlert className="w-3.5 h-3.5" />
              <span>Pos Security &amp; Gate Log</span>
            </button>
            <button
              type="button"
              onClick={() => handleTabChange('ga_hk')}
              className={`px-3 py-1.5 rounded-lg font-bold flex items-center gap-1.5 transition cursor-pointer ${
                currentSubTab === 'ga_hk'
                  ? 'bg-amber-500 text-slate-950'
                  : 'text-slate-300 hover:bg-slate-800'
              }`}
            >
              <Brush className="w-3.5 h-3.5" />
              <span>Housekeeping (HK) 5R</span>
            </button>
            <button
              type="button"
              onClick={() => handleTabChange('ga_aset')}
              className={`px-3 py-1.5 rounded-lg font-bold flex items-center gap-1.5 transition cursor-pointer ${
                currentSubTab === 'ga_aset'
                  ? 'bg-amber-500 text-slate-950'
                  : 'text-slate-300 hover:bg-slate-800'
              }`}
            >
              <Building2 className="w-3.5 h-3.5" />
              <span>Manajemen Aset &amp; Fasilitas</span>
            </button>
          </div>
        )}

        {/* Sub-navigasi internal untuk Training & Development */}
        {currentSubTab.startsWith('training_') && (
          <div className="flex flex-wrap items-center gap-2 px-3 py-2 rounded-xl bg-slate-900/70 border border-slate-800 text-xs">
            <span className="text-[10px] font-black uppercase tracking-wider text-emerald-400 mr-1">
              Sub-Bagian Training:
            </span>
            <button
              type="button"
              onClick={() => handleTabChange('training_videos')}
              className={`px-3 py-1.5 rounded-lg font-bold flex items-center gap-1.5 transition cursor-pointer ${
                currentSubTab === 'training_videos'
                  ? 'bg-emerald-600 text-white'
                  : 'text-slate-300 hover:bg-slate-800'
              }`}
            >
              <Video className="w-3.5 h-3.5" />
              <span>Video Training SOP</span>
            </button>
            <button
              type="button"
              onClick={() => handleTabChange('training_karyawan')}
              className={`px-3 py-1.5 rounded-lg font-bold flex items-center gap-1.5 transition cursor-pointer ${
                currentSubTab === 'training_karyawan'
                  ? 'bg-emerald-600 text-white'
                  : 'text-slate-300 hover:bg-slate-800'
              }`}
            >
              <Award className="w-3.5 h-3.5" />
              <span>Pelatihan &amp; Sertifikasi Karyawan</span>
            </button>
          </div>
        )}
      </div>
      )}

      {/* SUBTAB 1: HR UTAMA (DATA KARYAWAN, ROLLING & HISTORY DEPARTEMEN) */}
      {currentSubTab === 'hr_core' && (
        <div className="animate-in fade-in duration-200">
          <HrEmployeeRollingView />
        </div>
      )}

      {/* SUBTAB 2: GA - SECURITY (KEAMANAN PABRIK) */}
      {currentSubTab === 'ga_security' && (
        <div className="space-y-6 animate-in fade-in duration-200">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-black text-white uppercase tracking-wider flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-amber-400" />
                <span>General Affair &bull; Manajemen Keamanan (Security)</span>
              </h3>
              <p className="text-xs text-slate-400">
                Buku log pos satpam, integrasi jadwal gate-out armada, dan registrasi kedatangan truk di DC Banyuwangi.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="px-3 py-1.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs font-bold flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                <span>Terhubung Portal Driver &amp; Jadwal</span>
              </span>
              <button
                type="button"
                onClick={() => setIsGateOutModalOpen(true)}
                className="px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-black text-xs flex items-center gap-1.5 shadow-lg shadow-blue-600/20 active:scale-95 transition cursor-pointer"
              >
                <Truck className="w-4 h-4" />
                <span>+ Catat Keluar (Gate-Out)</span>
              </button>
              <button
                type="button"
                onClick={() => setIsGateInModalOpen(true)}
                className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-400 hover:from-emerald-400 hover:to-emerald-300 text-slate-950 font-black text-xs flex items-center gap-1.5 shadow-lg shadow-emerald-500/20 active:scale-95 transition cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>+ Catat Tiba (Gate-In)</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <MetricCard 
              title="Armada Gate-Out Hari Ini" 
              value={`${securityLogs.filter(l => l.status === 'Gate-Out' || l.type === 'Kendaraan Keluar').length} Armada`} 
              subtext="Truk dalam perjalanan pengiriman" 
              icon={Truck} 
              color="text-blue-400" 
            />
            <MetricCard 
              title="Armada Tiba di Gudang" 
              value={`${securityLogs.filter(l => l.status === 'Tiba di Gudang' || l.type === 'Kendaraan Masuk').length} Armada`} 
              subtext="Selesai bongkar & kembali ke DC" 
              icon={CheckCircle2} 
              color="text-emerald-400" 
            />
            <MetricCard 
              title="Petugas Pos Satpam" 
              value="Regu Alfa (4 Petugas)" 
              subtext="Shift Pagi &bull; Pos Gerbang 24 Jam" 
              icon={ShieldCheck} 
              color="text-amber-400" 
            />
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
            <div className="p-4 border-b border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                  <Clock className="w-4 h-4 text-amber-400" />
                  <span>Buku Catatan Log Pos Keamanan (Gate Log Terintegrasi)</span>
                </h4>
                <p className="text-[10px] text-slate-400 mt-0.5">
                  Terupdate otomatis saat driver/spv logistik konfirmasi Gate-Out atau security input kedatangan armada.
                </p>
              </div>
              <span className="text-[11px] text-slate-400 font-mono">Tanggal: {new Date().toLocaleDateString('id-ID', { dateStyle: 'long' })}</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-950 text-slate-400 uppercase font-semibold text-[10px] border-b border-slate-800">
                  <tr>
                    <th className="py-3 px-4">No. Ref</th>
                    <th className="py-3 px-4">Waktu</th>
                    <th className="py-3 px-4">Jenis Aktivitas</th>
                    <th className="py-3 px-4">Kendaraan / Pihak</th>
                    <th className="py-3 px-4">Pengemudi / Petugas</th>
                    <th className="py-3 px-4">Keperluan / Catatan</th>
                    <th className="py-3 px-4 text-right">Status Gerbang</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800 text-slate-200">
                  {securityLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-slate-800/50 transition">
                      <td className="py-3 px-4 font-mono font-bold text-amber-400">{log.id}</td>
                      <td className="py-3 px-4 text-slate-400 font-mono text-[11px]">{log.time}</td>
                      <td className="py-3 px-4 font-semibold">{log.type}</td>
                      <td className="py-3 px-4 font-medium text-white">
                        <span>{log.entity}</span>
                        {log.initialCode && !log.entity.includes(log.initialCode) && (
                          <span className="ml-1.5 px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 font-mono text-[9px] font-bold">
                            [{log.initialCode}]
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-slate-300 font-semibold">{log.driver}</td>
                      <td className="py-3 px-4 text-slate-400 max-w-xs">{log.purpose}</td>
                      <td className="py-3 px-4 text-right">
                        <span className={`px-2.5 py-1 rounded-full font-bold text-[10px] inline-flex items-center gap-1 ${
                          log.status === 'Gate-Out'
                            ? 'bg-blue-500/20 text-blue-300 border border-blue-500/40 animate-pulse'
                            : log.status === 'Tiba di Gudang'
                            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                            : log.status === 'Diizinkan'
                            ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                            : 'bg-slate-800 text-slate-300 border border-slate-700'
                        }`}>
                          {log.status === 'Gate-Out' && <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />}
                          {log.status === 'Tiba di Gudang' && <CheckCircle2 className="w-3 h-3 text-emerald-400" />}
                          <span>{log.status}</span>
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* ================= MODAL: INPUT ARMADA TIBA DI GUDANG ================= */}
          {isGateInModalOpen && (
            <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-[2px] flex items-center justify-center p-4 animate-in fade-in duration-150">
              <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl">
                <div className="p-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                      <Truck className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="font-bold text-white text-sm">
                        Catat Kedatangan Armada (Gate-In)
                      </h4>
                      <p className="text-[10px] text-slate-400">
                        Input langsung ke database sistem logistik &amp; pos keamanan
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => setIsGateInModalOpen(false)}
                    className="p-1 rounded-lg text-slate-400 hover:text-white"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <form onSubmit={handleSaveGateIn} className="p-5 space-y-3.5 text-xs">
                  {/* Select from active schedules */}
                  <div>
                    <label className="text-slate-300 font-bold block mb-1">
                      Pilih dari Jadwal Berjalan / On-Duty (Opsional):
                    </label>
                    <select
                      value={gateInForm.scheduleId}
                      onChange={(e) => handleSelectScheduleForGateIn(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white focus:outline-none focus:border-emerald-500 cursor-pointer"
                    >
                      <option value="">-- Input Manual / Non-Jadwal --</option>
                      {logisticsStore.getSchedules().map((sch) => (
                        <option key={sch.id} value={sch.id}>
                          {sch.fleet?.plateNumber || 'Armada'} ({sch.fleet?.initialCode || 'Mobil'}) &bull; Driver: {sch.crew?.name} &bull; Rute: {sch.areaName || sch.store?.storeName} [{sch.status}]
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-slate-300 font-bold block mb-1">
                      Nomor Plat Armada <span className="text-rose-400">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="Contoh: P 8848 U atau P 8125 VC"
                      value={gateInForm.plateNumber}
                      onChange={(e) => setGateInForm({ ...gateInForm, plateNumber: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 uppercase font-mono"
                    />
                  </div>

                  <div>
                    <label className="text-slate-300 font-bold block mb-1">
                      Nama Pengemudi / Supir
                    </label>
                    <input
                      type="text"
                      placeholder="Nama Supir"
                      value={gateInForm.driverName}
                      onChange={(e) => setGateInForm({ ...gateInForm, driverName: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="text-slate-300 font-bold block mb-1">
                      Catatan Kedatangan / Kondisi Muatan
                    </label>
                    <textarea
                      rows={3}
                      value={gateInForm.notes}
                      onChange={(e) => setGateInForm({ ...gateInForm, notes: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                    />
                  </div>

                  <div className="pt-2 border-t border-slate-800 flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setIsGateInModalOpen(false)}
                      className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 font-semibold"
                    >
                      Batal
                    </button>
                    <button
                      type="submit"
                      className="px-5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold shadow-lg shadow-emerald-500/20 active:scale-95 transition"
                    >
                      Simpan Kedatangan ke Database
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
          {/* ================= MODAL: INPUT ARMADA KELUAR (GATE-OUT) ================= */}
          {isGateOutModalOpen && (
            <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-[2px] flex items-center justify-center p-4 animate-in fade-in duration-150">
              <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl">
                <div className="p-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-blue-500/20 border border-blue-500/30 flex items-center justify-center text-blue-400">
                      <Truck className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="font-bold text-white text-sm">
                        Catat Armada Keluar (Gate-Out)
                      </h4>
                      <p className="text-[10px] text-slate-400">
                        Otorisasi gerbang keluar DC &amp; terhubung ke jadwal pengiriman
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => setIsGateOutModalOpen(false)}
                    className="p-1 rounded-lg text-slate-400 hover:text-white"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <form onSubmit={handleSaveGateOut} className="p-5 space-y-3.5 text-xs">
                  <div>
                    <label className="text-slate-300 font-bold block mb-1">
                      Pilih dari Jadwal Berangkat (Opsional):
                    </label>
                    <select
                      value={gateOutForm.scheduleId}
                      onChange={(e) => handleSelectScheduleForGateOut(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white focus:outline-none focus:border-blue-500 cursor-pointer"
                    >
                      <option value="">-- Input Manual / Non-Jadwal --</option>
                      {logisticsStore.getSchedules().filter(s => s.status === 'scheduled' || s.status === 'picked_up').map((sch) => (
                        <option key={sch.id} value={sch.id}>
                          {sch.fleet?.plateNumber || 'Armada'} ({sch.fleet?.initialCode || 'Mobil'}) &bull; {sch.crew?.name} &bull; Rute: {sch.areaName || sch.store?.storeName}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-slate-300 font-bold block mb-1">
                      Nomor Plat Armada <span className="text-rose-400">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="Contoh: P 8848 U atau P 8801 UV"
                      value={gateOutForm.plateNumber}
                      onChange={(e) => setGateOutForm({ ...gateOutForm, plateNumber: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 uppercase font-mono"
                    />
                  </div>

                  <div>
                    <label className="text-slate-300 font-bold block mb-1">
                      Nama Pengemudi / Supir
                    </label>
                    <input
                      type="text"
                      placeholder="Nama Supir"
                      value={gateOutForm.driverName}
                      onChange={(e) => setGateOutForm({ ...gateOutForm, driverName: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label className="text-slate-300 font-bold block mb-1">
                      Tujuan Pengiriman / Rute
                    </label>
                    <input
                      type="text"
                      placeholder="Contoh: Area Banyuwangi Kota / Jember"
                      value={gateOutForm.destination}
                      onChange={(e) => setGateOutForm({ ...gateOutForm, destination: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                    />
                  </div>

                  <div className="pt-2 border-t border-slate-800 flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setIsGateOutModalOpen(false)}
                      className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 font-semibold cursor-pointer"
                    >
                      Batal
                    </button>
                    <button
                      type="submit"
                      className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold shadow-lg shadow-blue-600/20 active:scale-95 transition cursor-pointer"
                    >
                      Konfirmasi Gate-Out
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      )}

      {/* SUBTAB 3: GA - HK (HOUSEKEEPING & KEBERSIHAN) */}
      {currentSubTab === 'ga_hk' && (
        <div className="space-y-6 animate-in fade-in duration-200">
          <div>
            <h3 className="text-sm font-black text-white uppercase tracking-wider flex items-center gap-2">
              <Brush className="w-4 h-4 text-emerald-400" />
              <span>General Affair &bull; Housekeeping (HK) &amp; Kebersihan 5R</span>
            </h3>
            <p className="text-xs text-slate-400">Penerapan budaya kerja 5R (Ringkas, Rapi, Resik, Rawat, Rajin) pada seluruh zona pabrik kemasan PT AKK.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <MetricCard title="Skor 5R Rata-rata" value="97.2%" subtext="Kategori: Sangat Baik" icon={CheckCircle2} color="text-emerald-400" />
            <MetricCard title="Jadwal Pembersihan" value="4 Zona" subtext="Pagi, Siang & Sore" icon={Clock} color="text-amber-400" />
            <MetricCard title="Staf Housekeeping" value="8 Petugas" subtext="Siap standby" icon={Users} color="text-indigo-400" />
            <MetricCard title="Inspeksi Limbah Box" value="Nol Penumpukan" subtext="Daur ulang terjadwal" icon={Check} color="text-cyan-400" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {housekeepingItems.map((hk) => (
              <div key={hk.id} className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono font-bold text-amber-400">{hk.id}</span>
                  <span className="px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 font-bold text-[10px]">
                    Skor: {hk.score}
                  </span>
                </div>
                <h4 className="text-sm font-bold text-white">{hk.area}</h4>
                <div className="text-xs text-slate-400 space-y-1">
                  <div>PIC Petugas: <strong className="text-slate-200">{hk.pic}</strong></div>
                  <div>Pilar 5R: <span className="text-indigo-400 font-medium">{hk.fiveR}</span></div>
                  <div>Waktu Pengecekan: <span className="text-slate-300">{hk.checkDate}</span></div>
                </div>
                <div className="pt-2 border-t border-slate-800 flex items-center justify-between text-[11px]">
                  <span className="text-emerald-400 font-semibold flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" /> {hk.status}
                  </span>
                  <span className="text-slate-500 font-mono">Area Terverifikasi</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* SUBTAB 4: GA - ASET & FASILITAS PABRIK */}
      {currentSubTab === 'ga_aset' && (
        <div className="space-y-6 animate-in fade-in duration-200">
          <div>
            <h3 className="text-sm font-black text-white uppercase tracking-wider flex items-center gap-2">
              <Building2 className="w-4 h-4 text-cyan-400" />
              <span>General Affair &bull; Manajemen Aset &amp; Fasilitas Pabrik</span>
            </h3>
            <p className="text-xs text-slate-400">Inventarisasi peralatan berat, utilitas kelistrikan, genset, serta perlengkapan produksi kemasan.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <MetricCard title="Total Aset Terdaftar" value="48 Unit" subtext="Mesin, Genset, Forklift, CCTV" icon={Database} color="text-cyan-400" />
            <MetricCard title="Status Operasional" value="98%" subtext="Dalam kondisi siap pakai" icon={CheckCircle2} color="text-emerald-400" />
            <MetricCard title="Jadwal Servis Berkala" value="2 Unit" subtext="Minggu ini (Hand Pallet & AC)" icon={Clock} color="text-amber-400" />
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
            <div className="p-4 border-b border-slate-800 flex items-center justify-between">
              <h4 className="text-xs font-bold text-white uppercase tracking-wider">Daftar Aset Kritis PT Anugrah Kemasan Kreatif</h4>
              <span className="text-xs text-cyan-400 font-semibold font-mono">DC Klatak Banyuwangi</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-950 text-slate-400 uppercase font-semibold text-[10px] border-b border-slate-800">
                  <tr>
                    <th className="py-3 px-4">Kode Aset</th>
                    <th className="py-3 px-4">Nama Aset / Peralatan</th>
                    <th className="py-3 px-4">Kategori</th>
                    <th className="py-3 px-4">Lokasi Pabrik</th>
                    <th className="py-3 px-4">Servis Terakhir</th>
                    <th className="py-3 px-4">Jadwal Servis Berikutnya</th>
                    <th className="py-3 px-4 text-right">Kondisi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800 text-slate-200">
                  {assetItems.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-800/50 transition">
                      <td className="py-3 px-4 font-mono font-bold text-cyan-400">{item.id}</td>
                      <td className="py-3 px-4 font-bold text-white">{item.name}</td>
                      <td className="py-3 px-4 text-slate-400">{item.category}</td>
                      <td className="py-3 px-4 text-slate-300">{item.location}</td>
                      <td className="py-3 px-4 text-slate-400">{item.lastService}</td>
                      <td className="py-3 px-4 font-mono text-amber-400 font-semibold">{item.nextService}</td>
                      <td className="py-3 px-4 text-right">
                        <span className="px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 font-bold text-[10px]">
                          {item.condition}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* SUBTAB 5: TRAINING & DEV - VIDEO TRAINING */}
      {currentSubTab === 'training_videos' && (
        <div className="space-y-6 animate-in fade-in duration-200">
          <div>
            <h3 className="text-sm font-black text-white uppercase tracking-wider flex items-center gap-2">
              <Video className="w-4 h-4 text-indigo-400" />
              <span>Training &amp; Development &bull; Video Training SOP &amp; Pembelajaran</span>
            </h3>
            <p className="text-xs text-slate-400">Pustaka materi video panduan teknis keselamatan, SOP distribusi pengiriman, dan panduan aplikasi operasional.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {videoModules.map((vid) => (
              <div key={vid.id} className="p-5 rounded-2xl bg-slate-900 border border-slate-800 hover:border-indigo-500/40 transition space-y-3 group">
                <div className="flex items-center justify-between">
                  <span className="text-2xl">{vid.thumbnail}</span>
                  <span className="px-2.5 py-1 rounded-full bg-indigo-500/15 border border-indigo-500/30 text-indigo-300 font-bold text-[10px] flex items-center gap-1">
                    <Clock className="w-3 h-3" /> {vid.duration}
                  </span>
                </div>
                <h4 className="text-sm font-bold text-white group-hover:text-indigo-400 transition leading-snug">
                  {vid.title}
                </h4>
                <div className="text-xs text-slate-400 flex items-center justify-between">
                  <span>Kategori: <strong className="text-slate-300">{vid.category}</strong></span>
                  <span className="font-mono text-slate-500">{vid.views}</span>
                </div>
                <div className="pt-3 border-t border-slate-800 flex items-center justify-between">
                  <span className="text-[11px] text-amber-400 font-semibold font-mono">
                    {vid.status}
                  </span>
                  <button
                    onClick={() => setSelectedVideoModal(vid.title)}
                    className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs flex items-center gap-1.5 transition cursor-pointer shadow-md"
                  >
                    <Play className="w-3.5 h-3.5" /> Putar Video
                  </button>
                </div>
              </div>
            ))}
          </div>

          {selectedVideoModal && (
            <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-sm flex items-center justify-center p-4">
              <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg p-6 space-y-4 shadow-2xl">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <h4 className="text-sm font-bold text-white flex items-center gap-2">
                    <Video className="w-4 h-4 text-indigo-400" />
                    <span>Pemutar Video SOP PT AKK</span>
                  </h4>
                  <button 
                    onClick={() => setSelectedVideoModal(null)}
                    className="p-1 rounded-lg text-slate-400 hover:text-white"
                  >
                    &times;
                  </button>
                </div>
                <div className="bg-slate-950 border border-slate-800 rounded-xl h-52 flex flex-col items-center justify-center text-center p-4">
                  <div className="w-12 h-12 rounded-full bg-indigo-600/30 border border-indigo-500/50 flex items-center justify-center text-indigo-400 mb-2">
                    <Play className="w-6 h-6 fill-current" />
                  </div>
                  <h5 className="text-white text-xs font-bold max-w-md">{selectedVideoModal}</h5>
                  <p className="text-[11px] text-slate-400 mt-1">Video resolusi 1080p HD &bull; Subtitle Bahasa Indonesia</p>
                </div>
                <div className="text-xs text-slate-400 flex justify-between items-center">
                  <span>Status Belajar: <strong className="text-emerald-400">100% Selesai</strong></span>
                  <button 
                    onClick={() => setSelectedVideoModal(null)}
                    className="px-4 py-1.5 rounded-lg bg-slate-800 text-white text-xs font-semibold"
                  >
                    Tutup
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* SUBTAB 6: TRAINING & DEV - TRAINING KARYAWAN & SERTIFIKASI */}
      {currentSubTab === 'training_karyawan' && (
        <div className="space-y-6 animate-in fade-in duration-200">
          <div>
            <h3 className="text-sm font-black text-white uppercase tracking-wider flex items-center gap-2">
              <Award className="w-4 h-4 text-amber-400" />
              <span>Training &amp; Development &bull; Pelatihan &amp; Sertifikasi Kru Karyawan</span>
            </h3>
            <p className="text-xs text-slate-400">Jadwal pelatihan berkala, evaluasi kompetensi supir ekspedisi, helper, dan sertifikasi K3 logistik.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <MetricCard title="Kru Bersertifikasi" value="100% Supir" subtext="SIM B2 Umum & Defensive Driving" icon={ShieldCheck} color="text-amber-400" />
            <MetricCard title="Program Pelatihan Aktif" value="3 Program" subtext="Periode Q4 2026" icon={Calendar} color="text-indigo-400" />
            <MetricCard title="Tingkat Kelulusan Evaluasi" value="96.5%" subtext="Ujian SOP Bongkar Muat" icon={CheckCircle2} color="text-emerald-400" />
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
            <div className="p-4 border-b border-slate-800 flex items-center justify-between">
              <h4 className="text-xs font-bold text-white uppercase tracking-wider">Jadwal &amp; Agenda Pelatihan Kru Pabrik AKK</h4>
              <span className="text-xs text-slate-400">Kapasitas Maksimal: 25 Peserta/Sesi</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-950 text-slate-400 uppercase font-semibold text-[10px] border-b border-slate-800">
                  <tr>
                    <th className="py-3 px-4">No. Program</th>
                    <th className="py-3 px-4">Nama Pelatihan</th>
                    <th className="py-3 px-4">Target Peserta</th>
                    <th className="py-3 px-4">Tanggal Pelaksanaan</th>
                    <th className="py-3 px-4">Instruktur / Trainer</th>
                    <th className="py-3 px-4">Jumlah Peserta</th>
                    <th className="py-3 px-4 text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800 text-slate-200">
                  {trainingSchedules.map((tr) => (
                    <tr key={tr.id} className="hover:bg-slate-800/50 transition">
                      <td className="py-3 px-4 font-mono font-bold text-indigo-400">{tr.id}</td>
                      <td className="py-3 px-4 font-bold text-white">{tr.program}</td>
                      <td className="py-3 px-4 text-slate-300">{tr.target}</td>
                      <td className="py-3 px-4 font-medium text-amber-400">{tr.date}</td>
                      <td className="py-3 px-4 text-slate-400">{tr.trainer}</td>
                      <td className="py-3 px-4 font-semibold text-slate-200">{tr.peserta}</td>
                      <td className="py-3 px-4 text-right">
                        <span className="px-2 py-0.5 rounded-full bg-indigo-500/15 border border-indigo-500/30 text-indigo-300 font-bold text-[10px]">
                          {tr.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const WarehouseDashboard = () => (
  <WarehouseManagementSystem />
);

export interface CollectorProofLog {
  id: string;
  invoiceId: string;
  noInvoice: string;
  customerName: string;
  region: string;
  timestamp: string;
  collectorName: string;
  totalTagihanFaktur: number;
  nominalDibayarkan: number;
  sisaSetelahBayar: number;
  statusLunas: boolean;
  kendala: string;
  notes: string;
  photoDataUrl: string;
}

export interface CustomerUnpaidInvoice {
  id: string;
  noInvoice: string;
  noSuratJalan: string;
  customerName: string;
  contactPhone: string;
  region: string;
  invoiceDate: string;
  dueDate: string;
  itemSummary: string;
  totalTagihan: number;
  jumlahTerbayar: number;
  lastPaymentDate?: string;
  notes: string;
  limitPelanggan?: number;
  paymentCategory?: 'TEMPO' | 'COD';
  tempoDays?: number;
  isBoldHighlight?: boolean;
  collectionPhotoUrl?: string;
  kendalaTagihan?: string;
  lastCollectedAmount?: number;
  collectionName?: string;
  collectorName?: string;
  collectionTimestamp?: string;
  collectionLogs?: CollectorProofLog[];
  billingTeam?: 'FINANCE' | 'SALES';
  salesPersonName?: string;
}

export interface CustomerMasterRecord {
  id: string;
  customerCode: string;
  customerName: string;
  region: string;
  contactPhone: string;
  paymentCategory: 'TEMPO' | 'COD';
  tempoDays: number;
  creditLimit: number;
  notes: string;
}

export const INITIAL_MASTER_CUSTOMERS: CustomerMasterRecord[] = [
  {
    id: 'CUST-RGJ-001',
    customerCode: 'PLG-RGJ-001',
    customerName: 'BP H KHOLIK',
    region: 'ROGOJAMPI',
    contactPhone: '0812-3456-7801',
    paymentCategory: 'TEMPO',
    tempoDays: 7,
    creditLimit: 2000000,
    notes: 'Pelanggan Tempo Rutin Area Rogojampi'
  },
  {
    id: 'CUST-RGJ-002',
    customerCode: 'PLG-RGJ-002',
    customerName: 'BP HERU ROGOJAMPI',
    region: 'ROGOJAMPI',
    contactPhone: '0813-3390-1120',
    paymentCategory: 'TEMPO',
    tempoDays: 7,
    creditLimit: 5000000,
    notes: 'Pelanggan Tempo Area Rogojampi'
  },
  {
    id: 'CUST-RGJ-003',
    customerCode: 'PLG-RGJ-003',
    customerName: 'BP SUKRI',
    region: 'ROGOJAMPI',
    contactPhone: '0812-5900-4411',
    paymentCategory: 'TEMPO',
    tempoDays: 7,
    creditLimit: 4500000,
    notes: 'Pelanggan Tempo Lancar Rogojampi'
  },
  {
    id: 'CUST-RGJ-004',
    customerCode: 'PLG-RGJ-004',
    customerName: 'BU ARISTA',
    region: 'ROGOJAMPI',
    contactPhone: '0852-3109-8821',
    paymentCategory: 'TEMPO',
    tempoDays: 7,
    creditLimit: 2000000,
    notes: 'Pelanggan Tempo Rogojampi - pantau batas limit'
  },
  {
    id: 'CUST-RGJ-005',
    customerCode: 'PLG-RGJ-005',
    customerName: 'BU TUTIK ROGOJAMPI',
    region: 'ROGOJAMPI',
    contactPhone: '0821-4099-3312',
    paymentCategory: 'TEMPO',
    tempoDays: 14,
    creditLimit: 1500000,
    notes: 'Pelanggan Tempo 14 Hari Area Rogojampi'
  },
  {
    id: 'CUST-RGJ-006',
    customerCode: 'PLG-RGJ-006',
    customerName: 'TK WIGEN',
    region: 'ROGOJAMPI',
    contactPhone: '0811-3509-7741',
    paymentCategory: 'TEMPO',
    tempoDays: 14,
    creditLimit: 3500000,
    notes: 'Toko Grosir Kemasan Rogojampi'
  },
  {
    id: 'CUST-SBA-001',
    customerCode: 'PLG-SBA-001',
    customerName: 'BU IIS',
    region: 'SUMBER AYU',
    contactPhone: '0813-5801-9920',
    paymentCategory: 'TEMPO',
    tempoDays: 7,
    creditLimit: 15000000,
    notes: 'Pelanggan Prioritas Area Sumber Ayu - Plafon 15 Jt'
  },
  {
    id: 'CUST-BWI-001',
    customerCode: 'PLG-BWI-001',
    customerName: 'TK ANUGRAH SEKAR WANGI',
    region: 'BANYUWANGI KOTA',
    contactPhone: '0812-3456-7811',
    paymentCategory: 'TEMPO',
    tempoDays: 14,
    creditLimit: 20000000,
    notes: 'Mitra Toko Kemasan Banyuwangi Kota'
  },
  {
    id: 'CUST-JBR-001',
    customerCode: 'PLG-JBR-001',
    customerName: 'UD SUMBER REJEKI JEMBER',
    region: 'JEMBER',
    contactPhone: '0811-3490-221',
    paymentCategory: 'TEMPO',
    tempoDays: 14,
    creditLimit: 50000000,
    notes: 'Distributor Karton Box Area Jember'
  },
  {
    id: 'CUST-COD-001',
    customerCode: 'PLG-COD-001',
    customerName: 'TK SINAR BARU ROGOJAMPI',
    region: 'ROGOJAMPI',
    contactPhone: '0812-4410-8890',
    paymentCategory: 'COD',
    tempoDays: 0,
    creditLimit: 0,
    notes: 'Pelanggan COD - Wajib bayar tunai/transfer saat barang turun'
  },
  {
    id: 'CUST-COD-002',
    customerCode: 'PLG-COD-002',
    customerName: 'UD MAKMUR PLASTIK GENTENG',
    region: 'GENTENG',
    contactPhone: '0853-3011-7762',
    paymentCategory: 'COD',
    tempoDays: 0,
    creditLimit: 0,
    notes: 'Pelanggan COD Genteng - Tunai via Supir / Kolektor'
  },
  {
    id: 'CUST-COD-003',
    customerCode: 'PLG-COD-003',
    customerName: 'TOKO BERKAH KEMASAN MUNCAR',
    region: 'MUNCAR',
    contactPhone: '0822-3190-5501',
    paymentCategory: 'COD',
    tempoDays: 0,
    creditLimit: 0,
    notes: 'Pelanggan COD Area Muncar'
  }
];

export const INITIAL_UNPAID_INVOICES: CustomerUnpaidInvoice[] = [
  // === WILAYAH: ROGOJAMPI ===
  // 1. BP H KHOLIK (5 Faktur -> Total Terutang: 13.920.738 | Limit: 2.000.000)
  {
    id: 'INV-RGJ-001',
    noInvoice: 'FJ02-1126-0615',
    noSuratJalan: 'SJ-RGJ-1126-0615',
    customerName: 'BP H KHOLIK',
    contactPhone: '0812-3456-7801',
    region: 'ROGOJAMPI',
    invoiceDate: '2026-11-07',
    dueDate: '2026-11-14',
    itemSummary: 'Karton Box & Kemasan Plastik Grosir',
    totalTagihan: 1295050,
    jumlahTerbayar: 0,
    limitPelanggan: 2000000,
    paymentCategory: 'TEMPO',
    tempoDays: 7,
    notes: ''
  },
  {
    id: 'INV-RGJ-002',
    noInvoice: 'FJ02-1126-0635',
    noSuratJalan: 'SJ-RGJ-1126-0635',
    customerName: 'BP H KHOLIK',
    contactPhone: '0812-3456-7801',
    region: 'ROGOJAMPI',
    invoiceDate: '2026-11-07',
    dueDate: '2026-11-14',
    itemSummary: 'Kemasan Box Makanan & Lakban',
    totalTagihan: 485826,
    jumlahTerbayar: 0,
    limitPelanggan: 2000000,
    paymentCategory: 'TEMPO',
    tempoDays: 7,
    notes: ''
  },
  {
    id: 'INV-RGJ-003',
    noInvoice: 'FJ02BS-1126-007',
    noSuratJalan: 'SJ-RGJ-1126-007',
    customerName: 'BP H KHOLIK',
    contactPhone: '0812-3456-7801',
    region: 'ROGOJAMPI',
    invoiceDate: '2026-11-07',
    dueDate: '2026-11-14',
    itemSummary: 'Karton Box Tambahan BS',
    totalTagihan: 140844,
    jumlahTerbayar: 0,
    limitPelanggan: 2000000,
    paymentCategory: 'TEMPO',
    tempoDays: 7,
    notes: ''
  },
  {
    id: 'INV-RGJ-004',
    noInvoice: 'FJ02-1126-0782',
    noSuratJalan: 'SJ-RGJ-1126-0782',
    customerName: 'BP H KHOLIK',
    contactPhone: '0812-3456-7801',
    region: 'ROGOJAMPI',
    invoiceDate: '2026-11-10',
    dueDate: '2026-11-17',
    itemSummary: 'Karton Box Corrugated Partai Besar',
    totalTagihan: 8735018,
    jumlahTerbayar: 0,
    limitPelanggan: 2000000,
    paymentCategory: 'TEMPO',
    tempoDays: 7,
    notes: ''
  },
  {
    id: 'INV-RGJ-005',
    noInvoice: 'FJ02-1126-0883',
    noSuratJalan: 'SJ-RGJ-1126-0883',
    customerName: 'BP H KHOLIK',
    contactPhone: '0812-3456-7801',
    region: 'ROGOJAMPI',
    invoiceDate: '2026-11-11',
    dueDate: '2026-11-18',
    itemSummary: 'Kemasan Karton Box & Plastik HD',
    totalTagihan: 3264000,
    jumlahTerbayar: 0,
    limitPelanggan: 2000000,
    paymentCategory: 'TEMPO',
    tempoDays: 7,
    notes: ''
  },

  // 2. BP HERU ROGOJAMPI (1 Faktur -> Total Terutang: 2.406.355 | Limit: 5.000.000)
  {
    id: 'INV-RGJ-006',
    noInvoice: 'FJ02-1026-1508',
    noSuratJalan: 'SJ-RGJ-1026-1508',
    customerName: 'BP HERU ROGOJAMPI',
    contactPhone: '0813-3390-1120',
    region: 'ROGOJAMPI',
    invoiceDate: '2026-10-20',
    dueDate: '2026-10-27',
    itemSummary: 'Karton Box & Plastik Kemasan',
    totalTagihan: 2406355,
    jumlahTerbayar: 0,
    limitPelanggan: 5000000,
    paymentCategory: 'TEMPO',
    tempoDays: 7,
    notes: ''
  },

  // 3. BP SUKRI (2 Faktur -> Total Terutang: 1.999.217 | Limit: 4.500.000)
  {
    id: 'INV-RGJ-007',
    noInvoice: 'FJ03-1126-1894',
    noSuratJalan: 'SJ-RGJ-1126-1894',
    customerName: 'BP SUKRI',
    contactPhone: '0812-5900-4411',
    region: 'ROGOJAMPI',
    invoiceDate: '2026-11-09',
    dueDate: '2026-11-16',
    itemSummary: 'Kemasan Box & Paper Cup',
    totalTagihan: 511050,
    jumlahTerbayar: 0,
    limitPelanggan: 4500000,
    paymentCategory: 'TEMPO',
    tempoDays: 7,
    isBoldHighlight: true,
    notes: ''
  },
  {
    id: 'INV-RGJ-008',
    noInvoice: 'FJ02-1126-0787',
    noSuratJalan: 'SJ-RGJ-1126-0787',
    customerName: 'BP SUKRI',
    contactPhone: '0812-5900-4411',
    region: 'ROGOJAMPI',
    invoiceDate: '2026-11-10',
    dueDate: '2026-11-17',
    itemSummary: 'Karton Box Reguler & Tali Rafia',
    totalTagihan: 1488167,
    jumlahTerbayar: 0,
    limitPelanggan: 4500000,
    paymentCategory: 'TEMPO',
    tempoDays: 7,
    notes: ''
  },

  // 4. BU ARISTA (4 Faktur -> Total Terutang: 2.518.825 | Limit: 2.000.000)
  {
    id: 'INV-RGJ-009',
    noInvoice: 'FJ02-1126-0183',
    noSuratJalan: 'SJ-RGJ-1126-0183',
    customerName: 'BU ARISTA',
    contactPhone: '0852-3109-8821',
    region: 'ROGOJAMPI',
    invoiceDate: '2026-11-04',
    dueDate: '2026-11-11',
    itemSummary: 'Karton Box Makanan & Mika',
    totalTagihan: 1095750,
    jumlahTerbayar: 0,
    limitPelanggan: 2000000,
    paymentCategory: 'TEMPO',
    tempoDays: 7,
    notes: ''
  },
  {
    id: 'INV-RGJ-010',
    noInvoice: 'FJ03-1126-0511',
    noSuratJalan: 'SJ-RGJ-1126-0511',
    customerName: 'BU ARISTA',
    contactPhone: '0852-3109-8821',
    region: 'ROGOJAMPI',
    invoiceDate: '2026-11-03',
    dueDate: '2026-11-10',
    itemSummary: 'Kemasan Plastik PE/HD',
    totalTagihan: 149975,
    jumlahTerbayar: 0,
    limitPelanggan: 2000000,
    paymentCategory: 'TEMPO',
    tempoDays: 7,
    isBoldHighlight: true,
    notes: ''
  },
  {
    id: 'INV-RGJ-011',
    noInvoice: 'FJ03-1126-2103',
    noSuratJalan: 'SJ-RGJ-1126-2103',
    customerName: 'BU ARISTA',
    contactPhone: '0852-3109-8821',
    region: 'ROGOJAMPI',
    invoiceDate: '2026-11-10',
    dueDate: '2026-11-17',
    itemSummary: 'Lakban & Sendok Plastik',
    totalTagihan: 146750,
    jumlahTerbayar: 0,
    limitPelanggan: 2000000,
    paymentCategory: 'TEMPO',
    tempoDays: 7,
    isBoldHighlight: true,
    notes: ''
  },
  {
    id: 'INV-RGJ-012',
    noInvoice: 'FJ02-1126-0855',
    noSuratJalan: 'SJ-RGJ-1126-0855',
    customerName: 'BU ARISTA',
    contactPhone: '0852-3109-8821',
    region: 'ROGOJAMPI',
    invoiceDate: '2026-11-11',
    dueDate: '2026-11-18',
    itemSummary: 'Karton Box Duplex & Ivory',
    totalTagihan: 1126350,
    jumlahTerbayar: 0,
    limitPelanggan: 2000000,
    paymentCategory: 'TEMPO',
    tempoDays: 7,
    notes: ''
  },

  // 5. BU TUTIK ROGOJAMPI (1 Faktur -> Total Terutang: 405.750 | Limit: 1.500.000)
  {
    id: 'INV-RGJ-013',
    noInvoice: 'FJ02-1026-1586',
    noSuratJalan: 'SJ-RGJ-1026-1586',
    customerName: 'BU TUTIK ROGOJAMPI',
    contactPhone: '0821-4099-3312',
    region: 'ROGOJAMPI',
    invoiceDate: '2026-10-21',
    dueDate: '2026-11-04',
    itemSummary: 'Kemasan Box Kue & Plastik Opp',
    totalTagihan: 405750,
    jumlahTerbayar: 0,
    limitPelanggan: 1500000,
    paymentCategory: 'TEMPO',
    tempoDays: 14,
    notes: ''
  },

  // 6. TK WIGEN (1 Faktur -> Total Terutang: 3.938.375 | Limit: 3.500.000)
  {
    id: 'INV-RGJ-014',
    noInvoice: 'FJ02-1126-0671',
    noSuratJalan: 'SJ-RGJ-1126-0671',
    customerName: 'TK WIGEN',
    contactPhone: '0811-3509-7741',
    region: 'ROGOJAMPI',
    invoiceDate: '2026-11-09',
    dueDate: '2026-11-23',
    itemSummary: 'Karton Box Corrugated & Kemasan Grosir',
    totalTagihan: 3938375,
    jumlahTerbayar: 0,
    limitPelanggan: 3500000,
    paymentCategory: 'TEMPO',
    tempoDays: 14,
    notes: ''
  },

  // === WILAYAH: SUMBER AYU ===
  // 7. BU IIS (2 Faktur -> Total Terutang: 2.696.568 | Limit: 15.000.000)
  {
    id: 'INV-SBA-001',
    noInvoice: 'FJ03-1126-0950',
    noSuratJalan: 'SJ-SBA-1126-0950',
    customerName: 'BU IIS',
    contactPhone: '0813-5801-9920',
    region: 'SUMBER AYU',
    invoiceDate: '2026-11-05',
    dueDate: '2026-11-12',
    itemSummary: 'Kemasan Box & Plastik Grosir',
    totalTagihan: 452505,
    jumlahTerbayar: 0,
    limitPelanggan: 15000000,
    paymentCategory: 'TEMPO',
    tempoDays: 7,
    isBoldHighlight: true,
    notes: ''
  },
  {
    id: 'INV-SBA-002',
    noInvoice: 'FJ02B-1126-0111',
    noSuratJalan: 'SJ-SBA-1126-0111',
    customerName: 'BU IIS',
    contactPhone: '0813-5801-9920',
    region: 'SUMBER AYU',
    invoiceDate: '2026-11-06',
    dueDate: '2026-11-13',
    itemSummary: 'Karton Box B-Flute & Paper Bowl',
    totalTagihan: 2244063,
    jumlahTerbayar: 0,
    limitPelanggan: 15000000,
    paymentCategory: 'TEMPO',
    tempoDays: 7,
    billingTeam: 'SALES',
    salesPersonName: 'Rendra Saputra',
    notes: 'Tagihan Khusus Sales Area Sumber Ayu'
  },
  // === TAGIHAN KHUSUS SALES (TERINTEGRASI APLIKASI PENAGIHAN PELANGGAN) ===
  {
    id: 'INV-SLS-001',
    noInvoice: 'FJ02-1126-0912',
    noSuratJalan: 'SJ-BWI-1126-0912',
    customerName: 'TK ANUGRAH SEKAR WANGI',
    contactPhone: '0812-3456-7811',
    region: 'BANYUWANGI KOTA',
    invoiceDate: '2026-11-08',
    dueDate: '2026-11-22',
    itemSummary: 'Karton Box Corrugated B-Flute 60x40x40 cm (1.500 Pcs)',
    totalTagihan: 9900000,
    jumlahTerbayar: 2500000,
    limitPelanggan: 20000000,
    paymentCategory: 'TEMPO',
    tempoDays: 14,
    billingTeam: 'SALES',
    salesPersonName: 'Rendra Saputra',
    notes: 'Tagihan Khusus Sales — Kunjungan rutin Rendra Saputra'
  },
  {
    id: 'INV-SLS-002',
    noInvoice: 'FJ02-1126-0945',
    noSuratJalan: 'SJ-GTG-1126-0945',
    customerName: 'UD MAKMUR PLASTIK GENTENG',
    contactPhone: '0853-3011-7762',
    region: 'GENTENG',
    invoiceDate: '2026-11-09',
    dueDate: '2026-11-16',
    itemSummary: 'Lunch Box Paper Eco Kraft Size L & Paper Bowl',
    totalTagihan: 6450000,
    jumlahTerbayar: 0,
    limitPelanggan: 10000000,
    paymentCategory: 'TEMPO',
    tempoDays: 7,
    billingTeam: 'SALES',
    salesPersonName: 'Dina Mariana',
    notes: 'Tagihan Khusus Sales — Penagihan saat repeat order Genteng'
  },
  {
    id: 'INV-SLS-003',
    noInvoice: 'FJ02-1126-0988',
    noSuratJalan: 'SJ-JBR-1126-0988',
    customerName: 'UD SUMBER REJEKI JEMBER',
    contactPhone: '0811-3490-221',
    region: 'JEMBER',
    invoiceDate: '2026-11-05',
    dueDate: '2026-11-19',
    itemSummary: 'Lakban OPP Coklat Heavy Duty & Stretch Film Pallet',
    totalTagihan: 12400000,
    jumlahTerbayar: 4000000,
    limitPelanggan: 50000000,
    paymentCategory: 'TEMPO',
    tempoDays: 14,
    billingTeam: 'SALES',
    salesPersonName: 'Bagus Setiawan',
    notes: 'Tagihan Khusus Sales — Follow up pelunasan area Jember'
  }
];

export const LS_KEY_FINANCE_UNPAID = 'akk_finance_unpaid_invoices_v4';
export const FINANCE_INVOICES_EVENT = 'akk-finance-invoices-updated';

export const LS_KEY_FINANCE_CUSTOMERS = 'akk_finance_master_customers_v1';
export const FINANCE_CUSTOMERS_EVENT = 'akk-finance-customers-updated';

let memorySharedCustomers: CustomerMasterRecord[] | null = null;
let memorySharedInvoices: CustomerUnpaidInvoice[] | null = null;

function getFinanceAuthHeaders(): Record<string, string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  try {
    const token =
      (typeof localStorage !== 'undefined'
        ? localStorage.getItem('akk_session_token') || localStorage.getItem('session_token')
        : null) ||
      (typeof sessionStorage !== 'undefined' ? sessionStorage.getItem('akk_session_token') : null) ||
      '';
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
      headers['x-akk-session-token'] = token;
    }
  } catch {}
  return headers;
}

export function loadSharedCustomerMasters(): CustomerMasterRecord[] {
  try {
    if (typeof localStorage !== 'undefined') localStorage.removeItem(LS_KEY_FINANCE_CUSTOMERS);
  } catch {}
  return memorySharedCustomers && memorySharedCustomers.length > 0
    ? memorySharedCustomers
    : INITIAL_MASTER_CUSTOMERS;
}

export function saveSharedCustomerMasters(list: CustomerMasterRecord[]): void {
  memorySharedCustomers = list;
  try {
    if (typeof localStorage !== 'undefined') localStorage.removeItem(LS_KEY_FINANCE_CUSTOMERS);
  } catch {}
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(FINANCE_CUSTOMERS_EVENT));
    fetch('/api/app-state', {
      method: 'POST',
      credentials: 'same-origin',
      headers: getFinanceAuthHeaders(),
      body: JSON.stringify({
        entries: {
          [LS_KEY_FINANCE_CUSTOMERS]: list
        }
      })
    }).catch(() => {});
  }
}

export function normalizeInvoiceBillingTeam(inv: CustomerUnpaidInvoice, idx = 0): CustomerUnpaidInvoice {
  if (inv.billingTeam === 'FINANCE' || inv.billingTeam === 'SALES') {
    return inv;
  }
  const noteLower = (inv.notes || '').toLowerCase();
  const isSales =
    noteLower.includes('sales') ||
    noteLower.includes('marketing') ||
    inv.customerName.includes('BU ARISTA') ||
    inv.customerName.includes('TK WIGEN') ||
    inv.customerName.includes('BU IIS') ||
    idx % 3 === 2;
  return {
    ...inv,
    billingTeam: isSales ? 'SALES' : 'FINANCE',
    salesPersonName:
      inv.salesPersonName ||
      (isSales ? (idx % 2 === 0 ? 'Rendra Saputra' : 'Dina Mariana') : undefined)
  };
}

export function loadSharedCustomerInvoices(): CustomerUnpaidInvoice[] {
  try {
    if (typeof localStorage !== 'undefined') localStorage.removeItem(LS_KEY_FINANCE_UNPAID);
  } catch {}
  if (memorySharedInvoices && memorySharedInvoices.length > 0) {
    return memorySharedInvoices.map((item, idx) => normalizeInvoiceBillingTeam(item, idx));
  }
  return INITIAL_UNPAID_INVOICES.map((item, idx) => normalizeInvoiceBillingTeam(item, idx));
}

export function saveSharedCustomerInvoices(list: CustomerUnpaidInvoice[]): void {
  memorySharedInvoices = list;
  try {
    if (typeof localStorage !== 'undefined') localStorage.removeItem(LS_KEY_FINANCE_UNPAID);
  } catch {}
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(FINANCE_INVOICES_EVENT));
    fetch('/api/app-state', {
      method: 'POST',
      credentials: 'same-origin',
      headers: getFinanceAuthHeaders(),
      body: JSON.stringify({
        entries: {
          [LS_KEY_FINANCE_UNPAID]: list
        }
      })
    }).catch(() => {});
  }
}

export async function hydrateSharedCustomerInvoicesFromServer(): Promise<CustomerUnpaidInvoice[] | null> {
  if (typeof window === 'undefined') return null;
  try {
    const res = await fetch(
      `/api/app-state?keys=${encodeURIComponent(LS_KEY_FINANCE_UNPAID)},${encodeURIComponent(LS_KEY_FINANCE_CUSTOMERS)}`,
      {
        credentials: 'same-origin',
        headers: getFinanceAuthHeaders()
      }
    );
    if (!res.ok) return null;
    const data = await res.json();
    const remoteCustomers = data?.entries?.[LS_KEY_FINANCE_CUSTOMERS];
    if (Array.isArray(remoteCustomers) && remoteCustomers.length > 0) {
      memorySharedCustomers = remoteCustomers;
      window.dispatchEvent(new CustomEvent(FINANCE_CUSTOMERS_EVENT));
    }
    const remoteList = data?.entries?.[LS_KEY_FINANCE_UNPAID];
    if (Array.isArray(remoteList) && remoteList.length > 0) {
      memorySharedInvoices = remoteList.map((item: any, idx: number) => normalizeInvoiceBillingTeam(item, idx));
      window.dispatchEvent(new CustomEvent(FINANCE_INVOICES_EVENT));
      return memorySharedInvoices;
    }
  } catch {}
  return null;
}

export function computeInvoiceAgingDays(dueDateStr: string): number {
  // Reference operational date matching November 2026 ledger context
  const today = new Date('2026-11-14T00:00:00');
  const due = new Date(`${dueDateStr}T00:00:00`);
  if (isNaN(due.getTime())) return 0;
  return Math.floor((today.getTime() - due.getTime()) / (1000 * 60 * 60 * 24));
}

export function formatIndonesianShortDate(isoDateStr: string): string {
  if (!isoDateStr) return '-';
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Ags', 'Sep', 'Okt', 'Nop', 'Des'];
  const parts = isoDateStr.split('-');
  if (parts.length !== 3) return isoDateStr;
  const year = parts[0];
  const monthIdx = parseInt(parts[1], 10) - 1;
  const day = parts[2];
  return `${day} ${months[monthIdx] || parts[1]} ${year}`;
}

export function getInvoiceStatus(inv: CustomerUnpaidInvoice): 'Lunas' | 'Jatuh Tempo (Overdue)' | 'Cicilan / Sebagian' | 'Belum Jatuh Tempo' {
  const sisa = Math.max(0, inv.totalTagihan - inv.jumlahTerbayar);
  if (sisa <= 0) return 'Lunas';
  const overdueDays = computeInvoiceAgingDays(inv.dueDate);
  if (overdueDays > 0) return 'Jatuh Tempo (Overdue)';
  if (inv.jumlahTerbayar > 0) return 'Cicilan / Sebagian';
  return 'Belum Jatuh Tempo';
}

const KENDALA_PENAGIHAN_OPTIONS = [
  'Tidak Ada Kendala (Pembayaran Lancar)',
  'Toko Tutup Sementara',
  'Pemilik / Bagian Keuangan Tidak di Tempat',
  'Minta Tempo / Janji Bayar Ulang',
  'Menunggu Giro / Cek Cair',
  'Komplain Barang / Selisih Faktur',
  'Kendala Lainnya'
];

function createSampleBillingPhotoDataUrl(
  customerName: string,
  noInvoice: string,
  nominalDibayar: number,
  totalTagihan: number,
  collectorName: string,
  kendala: string
): string {
  const nowStr = new Date().toLocaleString('id-ID', {
    dateStyle: 'medium',
    timeStyle: 'short'
  });
  const isLunas = nominalDibayar >= totalTagihan && totalTagihan > 0;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="420" viewBox="0 0 640 420">
    <defs>
      <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="#0f172a"/>
        <stop offset="100%" stop-color="#1e293b"/>
      </linearGradient>
    </defs>
    <rect width="640" height="420" rx="20" fill="url(#bg)"/>
    <rect x="24" y="24" width="592" height="372" rx="14" fill="#090d16" fill-opacity="0.55" stroke="#334155" stroke-width="2"/>
    <rect x="44" y="42" width="240" height="30" rx="8" fill="#10b981" fill-opacity="0.2" stroke="#10b981"/>
    <text x="58" y="62" fill="#34d399" font-family="monospace" font-size="13" font-weight="bold">BUKTI PENAGIHAN LANGSUNG</text>
    <text x="590" y="62" text-anchor="end" fill="#94a3b8" font-family="monospace" font-size="12">${nowStr} WIB</text>
    <text x="44" y="106" fill="#f8fafc" font-family="sans-serif" font-size="22" font-weight="bold">${customerName.slice(0, 32)}</text>
    <text x="44" y="132" fill="#38bdf8" font-family="monospace" font-size="15" font-weight="bold">No. Faktur: ${noInvoice}</text>
    <line x1="44" y1="150" x2="596" y2="150" stroke="#334155" stroke-dasharray="4 4"/>
    <text x="44" y="182" fill="#94a3b8" font-family="sans-serif" font-size="13">Total Nominal Tagihan:</text>
    <text x="596" y="182" text-anchor="end" fill="#e2e8f0" font-family="monospace" font-size="16" font-weight="bold">Rp ${totalTagihan.toLocaleString('id-ID')}</text>
    <text x="44" y="216" fill="#94a3b8" font-family="sans-serif" font-size="13">Nominal Dibayarkan Pelanggan:</text>
    <text x="596" y="216" text-anchor="end" fill="#34d399" font-family="monospace" font-size="20" font-weight="bold">Rp ${nominalDibayar.toLocaleString('id-ID')}</text>
    <text x="44" y="250" fill="#94a3b8" font-family="sans-serif" font-size="13">Status / Kendala:</text>
    <text x="596" y="250" text-anchor="end" fill="#fbbf24" font-family="sans-serif" font-size="13" font-weight="bold">${kendala.slice(0, 38)}</text>
    <rect x="44" y="280" width="552" height="54" rx="10" fill="${isLunas ? '#064e3b' : '#1e1b4b'}" stroke="${isLunas ? '#10b981' : '#6366f1'}"/>
    <text x="320" y="313" text-anchor="middle" fill="#ffffff" font-family="monospace" font-size="16" font-weight="bold">${isLunas ? '✓ STATUS TAGIHAN: LUNAS 100%' : 'BUKTI KUNJUNGAN & PEMBAYARAN TERVERIFIKASI'}</text>
    <text x="44" y="372" fill="#cbd5e1" font-family="monospace" font-size="12">Petugas Kolektor: ${collectorName}</text>
    <text x="596" y="372" text-anchor="end" fill="#64748b" font-family="monospace" font-size="11">PT. Anugrah Kemasan Kreatif</text>
  </svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

const FinanceDashboard: React.FC<{
  initialMode?: 'overview' | 'monitoring' | 'customer_mapping' | 'billing_app';
  initialBillingTeamFilter?: 'ALL' | 'FINANCE' | 'SALES';
  onNavigateTab?: (tab: string) => void;
}> = ({ initialMode = 'monitoring', initialBillingTeamFilter = 'ALL', onNavigateTab }) => {
  const [financeMode, setFinanceMode] = useState<'overview' | 'monitoring' | 'customer_mapping' | 'billing_app'>(initialMode);
  const [billingTeamFilter, setBillingTeamFilter] = useState<'ALL' | 'FINANCE' | 'SALES'>(initialBillingTeamFilter);
  const currentUser = logisticsStore.getCurrentUser();
  const [branches, setBranches] = useState<BranchRecord[]>(() => branchStore.getBranches());

  useEffect(() => {
    const syncBranches = () => setBranches(branchStore.getBranches());
    const unsub = branchStore.subscribe(syncBranches);
    window.addEventListener('akk-branch-updated', syncBranches);
    return () => {
      unsub();
      window.removeEventListener('akk-branch-updated', syncBranches);
    };
  }, []);

  useEffect(() => {
    setFinanceMode(initialMode);
  }, [initialMode]);

  useEffect(() => {
    setBillingTeamFilter(initialBillingTeamFilter);
  }, [initialBillingTeamFilter]);

  const [invoices, setInvoicesState] = useState<CustomerUnpaidInvoice[]>(() => loadSharedCustomerInvoices());
  const [masterCustomers, setMasterCustomersState] = useState<CustomerMasterRecord[]>(() => loadSharedCustomerMasters());

  const setInvoices = (updater: CustomerUnpaidInvoice[] | ((prev: CustomerUnpaidInvoice[]) => CustomerUnpaidInvoice[])) => {
    setInvoicesState(prev => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      saveSharedCustomerInvoices(next);
      return next;
    });
  };

  const setMasterCustomers = (
    updater: CustomerMasterRecord[] | ((prev: CustomerMasterRecord[]) => CustomerMasterRecord[])
  ) => {
    setMasterCustomersState(prev => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      saveSharedCustomerMasters(next);
      return next;
    });
  };

  useEffect(() => {
    const syncInvoices = () => {
      setInvoicesState(loadSharedCustomerInvoices());
    };
    const syncCustomers = () => {
      setMasterCustomersState(loadSharedCustomerMasters());
    };
    window.addEventListener(FINANCE_INVOICES_EVENT, syncInvoices);
    window.addEventListener(FINANCE_CUSTOMERS_EVENT, syncCustomers);
    void hydrateSharedCustomerInvoicesFromServer();
    return () => {
      window.removeEventListener(FINANCE_INVOICES_EVENT, syncInvoices);
      window.removeEventListener(FINANCE_CUSTOMERS_EVENT, syncCustomers);
    };
  }, []);

  const [searchQuery, setSearchQuery] = useState('');
  const [branchFilter, setBranchFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('UNPAID_ONLY');
  const [agingFilter, setAgingFilter] = useState<string>('ALL');
  const [salesMappings, setSalesMappings] = useState<SalesNameMappingRecord[]>(() =>
    getCachedSalesNameMappings()
  );
  const [mobileSalesFilter, setMobileSalesFilter] = useState<string>('ALL');

  useEffect(() => {
    let mounted = true;
    void fetchSalesNameMappingsFromMysql().then(list => {
      if (mounted && Array.isArray(list) && list.length > 0) {
        setSalesMappings(list);
      }
    });
    const handleMappingsUpdate = () => {
      setSalesMappings(getCachedSalesNameMappings());
    };
    window.addEventListener(SALES_MAPPINGS_UPDATED_EVENT, handleMappingsUpdate);
    return () => {
      mounted = false;
      window.removeEventListener(SALES_MAPPINGS_UPDATED_EVENT, handleMappingsUpdate);
    };
  }, []);

  // Mobile Billing App State (Tampilan HP seperti Admin Penjualan & Portal Driver)
  const [mobileNavTab, setMobileNavTab] = useState<'form_tagih' | 'daftar_toko' | 'riwayat_bukti'>('form_tagih');
  const [selectedMobileInvoiceId, setSelectedMobileInvoiceId] = useState<string>(() => INITIAL_UNPAID_INVOICES[0]?.id || 'INV-001');
  const [mobilePhotoDataUrl, setMobilePhotoDataUrl] = useState<string>('');
  const [mobileKendala, setMobileKendala] = useState<string>(KENDALA_PENAGIHAN_OPTIONS[0]);
  const [mobileNominalBayar, setMobileNominalBayar] = useState<number>(0);
  const [mobileIsLunasChecked, setMobileIsLunasChecked] = useState<boolean>(false);
  const [mobileCollectorNotes, setMobileCollectorNotes] = useState<string>('');
  const [mobilePromiseDate, setMobilePromiseDate] = useState<string>('2026-11-12');
  const mobilePhotoInputRef = React.useRef<HTMLInputElement | null>(null);

  // Modals
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [paymentModalInvoice, setPaymentModalInvoice] = useState<CustomerUnpaidInvoice | null>(null);
  const [paymentNominal, setPaymentNominal] = useState<number>(0);
  const [paymentNotes, setPaymentNotes] = useState<string>('');
  const [waBillingInvoice, setWaBillingInvoice] = useState<CustomerUnpaidInvoice | null>(null);
  const [printSuratTagihanInvoice, setPrintSuratTagihanInvoice] = useState<CustomerUnpaidInvoice | null>(null);
  const [collectorVisitInvoice, setCollectorVisitInvoice] = useState<CustomerUnpaidInvoice | null>(null);
  const [collectorNoteInput, setCollectorNoteInput] = useState<string>('');
  const [promiseDateInput, setPromiseDateInput] = useState<string>('2026-11-10');
  const [popupModal, setPopupModal] = useState<{ title: string; message: string } | null>(null);

  useEffect(() => {
    if (!popupModal) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === 'Escape') {
        e.preventDefault();
        setPopupModal(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [popupModal]);

  const [newInvForm, setNewInvForm] = useState({
    noInvoice: `FJ02-1126-${String(invoices.length + 890).padStart(4, '0')}`,
    noSuratJalan: `SJ-RGJ-1126-${String(invoices.length + 890).padStart(4, '0')}`,
    customerName: '',
    contactPhone: '',
    region: 'ROGOJAMPI',
    invoiceDate: '2026-11-11',
    dueDate: '2026-11-18',
    itemSummary: '',
    totalTagihan: 1500000,
    jumlahTerbayar: 0,
    limitPelanggan: 2000000,
    paymentCategory: 'TEMPO' as 'TEMPO' | 'COD',
    billingTeam: (initialBillingTeamFilter === 'SALES' ? 'SALES' : 'FINANCE') as 'FINANCE' | 'SALES',
    salesPersonName: 'Rendra Saputra',
    notes: ''
  });

  // Filtered Invoices (Integrated with Master Cabang branchStore)
  const filteredInvoices = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const selectedMasterBranch = branches.find(
      b => b.name.toLowerCase() === branchFilter.toLowerCase() || b.slug.toLowerCase() === branchFilter.toLowerCase()
    );

    return invoices.filter(inv => {
      const sisa = Math.max(0, inv.totalTagihan - inv.jumlahTerbayar);
      const st = getInvoiceStatus(inv);
      const agingDays = computeInvoiceAgingDays(inv.dueDate);

      const matchSearch =
        !q ||
        inv.noInvoice.toLowerCase().includes(q) ||
        inv.noSuratJalan.toLowerCase().includes(q) ||
        inv.customerName.toLowerCase().includes(q) ||
        inv.region.toLowerCase().includes(q) ||
        inv.itemSummary.toLowerCase().includes(q);

      let matchStatus = true;
      if (statusFilter === 'UNPAID_ONLY') {
        matchStatus = sisa > 0;
      } else if (statusFilter !== 'ALL') {
        matchStatus = st === statusFilter;
      }

      let matchAging = true;
      if (agingFilter === 'NOT_DUE') {
        matchAging = agingDays <= 0 && sisa > 0;
      } else if (agingFilter === 'OVERDUE_1_14') {
        matchAging = agingDays >= 1 && agingDays <= 14 && sisa > 0;
      } else if (agingFilter === 'OVERDUE_15_30') {
        matchAging = agingDays >= 15 && agingDays <= 30 && sisa > 0;
      } else if (agingFilter === 'OVERDUE_30_PLUS') {
        matchAging = agingDays > 30 && sisa > 0;
      }

      let matchBranch = true;
      if (branchFilter !== 'ALL') {
        const regLower = inv.region.toLowerCase();
        const bfLower = branchFilter.toLowerCase();
        matchBranch =
          regLower.includes(bfLower) ||
          Boolean(
            selectedMasterBranch &&
              (regLower.includes(selectedMasterBranch.name.toLowerCase()) ||
                regLower.includes(selectedMasterBranch.slug.toLowerCase()) ||
                regLower.includes((selectedMasterBranch.city || '').toLowerCase()))
          );
      }

      return matchSearch && matchStatus && matchAging && matchBranch;
    });
  }, [invoices, searchQuery, statusFilter, agingFilter, branchFilter, branches]);

  // Invoices filtered by Master Cabang, Tim Penagihan & Mapping Nama Sales for Mobile App
  const mobileBranchInvoices = useMemo(() => {
    const selectedMasterBranch = branches.find(
      b => b.name.toLowerCase() === branchFilter.toLowerCase() || b.slug.toLowerCase() === branchFilter.toLowerCase()
    );
    return invoices.filter(inv => {
      const team = inv.billingTeam || 'FINANCE';
      if (billingTeamFilter !== 'ALL' && team !== billingTeamFilter) {
        return false;
      }
      if (mobileSalesFilter !== 'ALL') {
        const resolved = resolveSalesFromMappings(inv.salesPersonName || '', salesMappings);
        const targetLower = mobileSalesFilter.toLowerCase();
        const rawLower = (inv.salesPersonName || '').toLowerCase();
        const matchMapped =
          (resolved && resolved.userFullName.toLowerCase() === targetLower) ||
          rawLower.includes(targetLower);
        if (!matchMapped) return false;
      }
      if (branchFilter === 'ALL') return true;
      const regLower = inv.region.toLowerCase();
      const bfLower = branchFilter.toLowerCase();
      return (
        regLower.includes(bfLower) ||
        Boolean(
          selectedMasterBranch &&
            (regLower.includes(selectedMasterBranch.name.toLowerCase()) ||
              regLower.includes(selectedMasterBranch.slug.toLowerCase()) ||
              regLower.includes((selectedMasterBranch.city || '').toLowerCase()))
        )
      );
    });
  }, [invoices, branchFilter, branches, billingTeamFilter, mobileSalesFilter, salesMappings]);

  const activeMobileInvoice = useMemo(() => {
    return (
      mobileBranchInvoices.find(i => i.id === selectedMobileInvoiceId) ||
      mobileBranchInvoices[0] ||
      invoices[0] ||
      null
    );
  }, [mobileBranchInvoices, selectedMobileInvoiceId, invoices]);

  // Sync mobile form defaults when switching active invoice
  useEffect(() => {
    if (!activeMobileInvoice) return;
    const sisa = Math.max(0, activeMobileInvoice.totalTagihan - activeMobileInvoice.jumlahTerbayar);
    setMobileNominalBayar(sisa);
    setMobileIsLunasChecked(sisa === 0);
    setMobilePhotoDataUrl(activeMobileInvoice.collectionPhotoUrl || '');
    setMobileKendala(activeMobileInvoice.kendalaTagihan || KENDALA_PENAGIHAN_OPTIONS[0]);
    setMobileCollectorNotes(activeMobileInvoice.notes || '');
  }, [activeMobileInvoice?.id]);

  const allCollectionLogs = useMemo(() => {
    const list: CollectorProofLog[] = [];
    invoices.forEach(inv => {
      if (Array.isArray(inv.collectionLogs)) {
        list.push(...inv.collectionLogs);
      }
    });
    return list.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  }, [invoices]);

  const handleMobilePhotoFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setMobilePhotoDataUrl(reader.result);
      }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleToggleFiturLunas = (checked: boolean) => {
    if (!activeMobileInvoice) return;
    const sisa = Math.max(0, activeMobileInvoice.totalTagihan - activeMobileInvoice.jumlahTerbayar);
    setMobileIsLunasChecked(checked);
    if (checked) {
      setMobileNominalBayar(sisa);
      setMobileKendala('Tidak Ada Kendala (Pembayaran Lancar)');
    }
  };

  const handleSaveMobileCollection = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeMobileInvoice) return;

    const sisaSaatIni = Math.max(0, activeMobileInvoice.totalTagihan - activeMobileInvoice.jumlahTerbayar);
    const bayarInput = mobileIsLunasChecked
      ? sisaSaatIni
      : Math.max(0, Math.min(sisaSaatIni, Number(mobileNominalBayar) || 0));
    const totalTerbayarBaru = Math.min(
      activeMobileInvoice.totalTagihan,
      activeMobileInvoice.jumlahTerbayar + bayarInput
    );
    const sisaSetelahBayar = Math.max(0, activeMobileInvoice.totalTagihan - totalTerbayarBaru);
    const isNowLunas = sisaSetelahBayar === 0;
    const collectorName = currentUser?.fullName || 'Petugas Kolektor Finance';

    const finalPhoto =
      mobilePhotoDataUrl ||
      createSampleBillingPhotoDataUrl(
        activeMobileInvoice.customerName,
        activeMobileInvoice.noInvoice,
        bayarInput,
        activeMobileInvoice.totalTagihan,
        collectorName,
        mobileKendala
      );

    const newLog: CollectorProofLog = {
      id: `CLG-${Date.now()}`,
      invoiceId: activeMobileInvoice.id,
      noInvoice: activeMobileInvoice.noInvoice,
      customerName: activeMobileInvoice.customerName,
      region: activeMobileInvoice.region,
      timestamp: new Date().toISOString(),
      collectorName,
      totalTagihanFaktur: activeMobileInvoice.totalTagihan,
      nominalDibayarkan: bayarInput,
      sisaSetelahBayar,
      statusLunas: isNowLunas,
      kendala: mobileKendala,
      notes:
        mobileCollectorNotes.trim() ||
        (isNowLunas
          ? `LUNAS 100% ditagih langsung oleh ${collectorName}`
          : `Dibayar Rp ${bayarInput.toLocaleString('id-ID')} dari tagihan Rp ${activeMobileInvoice.totalTagihan.toLocaleString('id-ID')} (${mobileKendala})`),
      photoDataUrl: finalPhoto
    };

    setInvoices(prev =>
      prev.map(inv => {
        if (inv.id !== activeMobileInvoice.id) return inv;
        return {
          ...inv,
          jumlahTerbayar: totalTerbayarBaru,
          lastPaymentDate: new Date().toISOString().slice(0, 10),
          collectionPhotoUrl: finalPhoto,
          kendalaTagihan: mobileKendala,
          lastCollectedAmount: bayarInput,
          collectorName,
          collectionTimestamp: newLog.timestamp,
          notes: `[${mobileKendala}] Dibayar Rp ${bayarInput.toLocaleString('id-ID')} / Total Rp ${inv.totalTagihan.toLocaleString('id-ID')}. ${
            mobileCollectorNotes.trim() ? mobileCollectorNotes.trim() : isNowLunas ? 'Status: LUNAS.' : `Janji bayar sisa: ${mobilePromiseDate}`
          }`,
          collectionLogs: [newLog, ...(inv.collectionLogs || [])]
        };
      })
    );

    setMobilePhotoDataUrl(finalPhoto);
    setPopupModal({
      title: isNowLunas ? '✓ Tagihan Pelanggan LUNAS!' : 'Bukti Penagihan & Pembayaran Tersimpan',
      message: `${activeMobileInvoice.customerName} (${activeMobileInvoice.noInvoice}) — Dibayarkan Rp ${bayarInput.toLocaleString(
        'id-ID'
      )} dari total tagihan Rp ${activeMobileInvoice.totalTagihan.toLocaleString('id-ID')}. ${
        isNowLunas
          ? 'Status faktur otomatis diperbarui menjadi LUNAS.'
          : `Sisa tagihan: Rp ${sisaSetelahBayar.toLocaleString('id-ID')} (Kendala: ${mobileKendala}).`
      }`
    });
  };

  const handleOpenPaymentModal = (inv: CustomerUnpaidInvoice) => {
    const sisa = Math.max(0, inv.totalTagihan - inv.jumlahTerbayar);
    setPaymentModalInvoice(inv);
    setPaymentNominal(sisa);
    setPaymentNotes(inv.notes || '');
  };

  const handleSavePayment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!paymentModalInvoice) return;
    const bayar = Math.max(0, Number(paymentNominal) || 0);
    const updatedTerbayar = Math.min(
      paymentModalInvoice.totalTagihan,
      paymentModalInvoice.jumlahTerbayar + bayar
    );
    const sisaBaru = Math.max(0, paymentModalInvoice.totalTagihan - updatedTerbayar);

    setInvoices(prev =>
      prev.map(item =>
        item.id === paymentModalInvoice.id
          ? {
              ...item,
              jumlahTerbayar: updatedTerbayar,
              lastPaymentDate: new Date().toISOString().slice(0, 10),
              notes:
                paymentNotes.trim() ||
                (sisaBaru === 0
                  ? 'Telah dilunasi penuh'
                  : `Pembayaran cicilan masuk Rp ${bayar.toLocaleString('id-ID')}`)
            }
          : item
      )
    );

    const custName = paymentModalInvoice.customerName;
    const invNo = paymentModalInvoice.noInvoice;
    setPaymentModalInvoice(null);
    setPopupModal({
      title: sisaBaru === 0 ? 'Tagihan Pelanggan Lunas' : 'Pembayaran Cicilan Dicatat',
      message:
        sisaBaru === 0
          ? `Tagihan ${invNo} untuk "${custName}" telah dinyatakan LUNAS.`
          : `Pembayaran Rp ${bayar.toLocaleString('id-ID')} untuk ${invNo} (${custName}) berhasil disimpan. Sisa tagihan: Rp ${sisaBaru.toLocaleString('id-ID')}.`
    });
  };

  const handleAddNewInvoice = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newInvForm.customerName.trim() || !newInvForm.noInvoice.trim()) return;

    const custUpper = newInvForm.customerName.trim().toUpperCase();
    const regUpper = newInvForm.region.trim().toUpperCase() || 'ROGOJAMPI';
    const limitVal =
      newInvForm.paymentCategory === 'COD' ? 0 : Math.max(0, Number(newInvForm.limitPelanggan) || 2000000);

    const newItem: CustomerUnpaidInvoice = {
      id: `INV-${Date.now()}`,
      noInvoice: newInvForm.noInvoice.trim().toUpperCase(),
      noSuratJalan: newInvForm.noSuratJalan.trim().toUpperCase() || '-',
      customerName: custUpper,
      contactPhone: newInvForm.contactPhone.trim() || '-',
      region: regUpper,
      invoiceDate: newInvForm.invoiceDate,
      dueDate: newInvForm.dueDate,
      itemSummary: newInvForm.itemSummary.trim() || 'Pesanan Kemasan Karton Box AKK',
      totalTagihan: Math.max(0, Number(newInvForm.totalTagihan) || 0),
      jumlahTerbayar: Math.max(0, Number(newInvForm.jumlahTerbayar) || 0),
      limitPelanggan: limitVal,
      paymentCategory: newInvForm.paymentCategory,
      tempoDays: newInvForm.paymentCategory === 'COD' ? 0 : 7,
      billingTeam: newInvForm.billingTeam,
      salesPersonName: newInvForm.billingTeam === 'SALES' ? newInvForm.salesPersonName.trim() || 'Sales AKK' : undefined,
      notes: newInvForm.notes.trim()
    };

    setInvoices([newItem, ...invoices]);
    // Also ensure customer exists in masterCustomers
    setMasterCustomers(prev => {
      const exists = prev.some(c => c.customerName.trim().toUpperCase() === custUpper);
      if (exists) return prev;
      return [
        ...prev,
        {
          id: `CUST-${Date.now()}`,
          customerCode: `PLG-${String(prev.length + 1).padStart(3, '0')}`,
          customerName: custUpper,
          region: regUpper,
          contactPhone: newItem.contactPhone,
          paymentCategory: newInvForm.paymentCategory,
          tempoDays: newInvForm.paymentCategory === 'COD' ? 0 : 7,
          creditLimit: limitVal,
          notes: 'Terdaftar dari input tagihan'
        }
      ];
    });
    setSelectedMobileInvoiceId(newItem.id);
    setIsAddModalOpen(false);
    setNewInvForm({
      ...newInvForm,
      noInvoice: `FJ02-1126-${String(invoices.length + 895).padStart(4, '0')}`,
      noSuratJalan: `SJ-RGJ-1126-${String(invoices.length + 895).padStart(4, '0')}`,
      customerName: '',
      contactPhone: '',
      itemSummary: '',
      notes: ''
    });
    setPopupModal({
      title: 'Data Tagihan Pelanggan Disimpan',
      message: `Tagihan ${newItem.noInvoice} atas nama "${newItem.customerName}" berhasil ditambahkan ke Buku Besar Daftar Tagihan.`
    });
  };

  const handleDeleteInvoice = (id: string) => {
    setInvoices(prev => prev.filter(item => item.id !== id));
  };

  const handleExportUnpaidExcel = () => {
    const rows = filteredInvoices.map((inv, idx) => {
      const sisa = Math.max(0, inv.totalTagihan - inv.jumlahTerbayar);
      const aging = computeInvoiceAgingDays(inv.dueDate);
      return {
        No: idx + 1,
        'No. Invoice': inv.noInvoice,
        'No. Surat Jalan': inv.noSuratJalan,
        'Nama Pelanggan / Toko': inv.customerName,
        'Kontak Pelanggan': inv.contactPhone,
        Wilayah: inv.region,
        'Tanggal Invoice': inv.invoiceDate,
        'Tanggal Jatuh Tempo': inv.dueDate,
        'Keterlambatan (Hari)': aging > 0 ? `${aging} Hari` : 'Belum Jatuh Tempo',
        'Rincian Barang': inv.itemSummary,
        'Total Tagihan (Rp)': inv.totalTagihan,
        'Sudah Dibayar (Rp)': inv.jumlahTerbayar,
        'Sisa Belum Lunas (Rp)': sisa,
        'Status Tagihan': getInvoiceStatus(inv),
        Catatan: inv.notes
      };
    });
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Tagihan_Belum_Lunas');
    XLSX.writeFile(wb, `Tagihan_Pelanggan_Belum_Lunas_AKK_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  const formatWhatsappMessage = (inv: CustomerUnpaidInvoice) => {
    const sisa = Math.max(0, inv.totalTagihan - inv.jumlahTerbayar);
    const aging = computeInvoiceAgingDays(inv.dueDate);
    return `Yth. Bapak/Ibu Pimpinan *${inv.customerName}* (${inv.region}),\n\nKami dari bagian Finance & Penagihan *PT. Anugrah Kemasan Kreatif (AKK)* menginformasikan rincian tagihan faktur berjalan sebagai berikut:\n\n• *No. Faktur*: ${inv.noInvoice}\n• *No. Surat Jalan*: ${inv.noSuratJalan}\n• *Tgl. Faktur*: ${inv.invoiceDate}\n• *Tgl. Jatuh Tempo*: ${inv.dueDate} (${aging > 0 ? `Lewat ${aging} Hari` : 'Belum Jatuh Tempo'})\n• *Rincian Pesanan*: ${inv.itemSummary}\n• *Total Tagihan*: Rp ${inv.totalTagihan.toLocaleString('id-ID')}\n• *Sudah Terbayar*: Rp ${inv.jumlahTerbayar.toLocaleString('id-ID')}\n• *Sisa Tagihan Belum Lunas*: *Rp ${sisa.toLocaleString('id-ID')}*\n\nMohon konfirmasi jadwal pembayaran/transfer melalui rekening resmi PT. Anugrah Kemasan Kreatif (BCA 8291-0092-11 a.n PT Anugrah Kemasan Kreatif). Terima kasih atas kerja sama yang baik.`;
  };

  const handleSaveCollectorVisit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!collectorVisitInvoice) return;
    const noteText = `[Kolektor Tgl ${new Date().toISOString().slice(0, 10)} | Janji Bayar: ${promiseDateInput}] ${collectorNoteInput.trim() || 'Tanda terima faktur telah diserahkan ke pelanggan'}`;
    setInvoices(prev =>
      prev.map(item =>
        item.id === collectorVisitInvoice.id
          ? { ...item, notes: noteText }
          : item
      )
    );
    const cust = collectorVisitInvoice.customerName;
    setCollectorVisitInvoice(null);
    setCollectorNoteInput('');
    setPopupModal({
      title: 'Status Kunjungan Penagihan Tersimpan',
      message: `Catatan penagihan kolektor & janji bayar (${promiseDateInput}) untuk "${cust}" berhasil diperbarui.`
    });
  };

  return (
    <div className="space-y-4">
      {/* ========================================================================== */}
      {/* TAMPILAN APLIKASI HP PENAGIHAN PELANGGAN (SEPERTI ADMIN PENJUALAN & DRIVER) */}
      {/* ========================================================================== */}
      {financeMode === 'billing_app' ? (
        <div className="py-1">
          <div className="max-w-md mx-auto rounded-[2.25rem] border-[5px] border-slate-800 dark:border-slate-700 bg-white dark:bg-slate-950 shadow-2xl overflow-hidden flex flex-col min-h-[760px]">
            {/* Top Phone Status & Collector Profile Header */}
            <div className="bg-slate-900 text-white px-4 pt-3 pb-3.5 border-b border-slate-800 space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-indigo-600/20 border border-indigo-500/40 flex items-center justify-center shrink-0">
                    <AkkLogo size="sm" showText={false} />
                  </div>
                  <div>
                    <div className="text-[10px] font-black uppercase tracking-wider text-indigo-400">
                      APLIKASI PENAGIHAN AKK
                    </div>
                    <div className="text-xs font-black text-white leading-tight">
                      {currentUser?.fullName || 'Kolektor Finance'}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-[10px] font-bold flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    Online
                  </span>
                </div>
              </div>

              {/* Pilih Cabang (Terintegrasi Master Cabang) & Pilih Toko di Header HP */}
              <div className="grid grid-cols-1 gap-2 pt-1">
                <div className="flex items-center gap-2 bg-slate-950/90 border border-slate-800 rounded-xl px-3 py-1.5">
                  <MapPin className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  <span className="text-[10px] font-bold uppercase text-slate-400 shrink-0">Cabang:</span>
                  <select
                    value={branchFilter}
                    onChange={e => setBranchFilter(e.target.value)}
                    className="w-full bg-transparent text-xs font-black text-amber-300 focus:outline-none cursor-pointer"
                  >
                    <option value="ALL" className="bg-slate-900 text-white">
                      Semua Cabang ({branches.length} Cabang Master)
                    </option>
                    {branches.map(b => (
                      <option key={b.id} value={b.name} className="bg-slate-900 text-white">
                        Cabang {b.name} ({b.city || b.slug})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Filter Sales Terintegrasi Mapping Nama Sales (Marketing Offline) */}
                <div className="flex items-center gap-2 bg-slate-950/90 border border-slate-800 rounded-xl px-3 py-1.5">
                  <Users className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span className="text-[10px] font-bold uppercase text-slate-400 shrink-0">Sales:</span>
                  <select
                    value={mobileSalesFilter}
                    onChange={e => setMobileSalesFilter(e.target.value)}
                    className="w-full bg-transparent text-xs font-black text-emerald-300 focus:outline-none cursor-pointer truncate"
                  >
                    <option value="ALL" className="bg-slate-900 text-white">
                      Semua Sales ({salesMappings.length || DEFAULT_SALES_MAPPINGS.length} Mapping Sales)
                    </option>
                    {(salesMappings.length > 0 ? salesMappings : DEFAULT_SALES_MAPPINGS).map(m => (
                      <option key={m.id} value={m.userFullName} className="bg-slate-900 text-white">
                        {m.userFullName} ({m.masterSalesName1}{m.masterSalesName2 ? ` / ${m.masterSalesName2}` : ''})
                      </option>
                    ))}
                  </select>
                  {onNavigateTab && (
                    <button
                      type="button"
                      onClick={() => onNavigateTab('marketing_sales_mapping')}
                      title="Buka Sub-Menu Mapping Nama Sales"
                      className="px-2 py-0.5 rounded-md bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/40 text-emerald-300 text-[9px] font-black uppercase shrink-0 cursor-pointer"
                    >
                      Mapping
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-2 bg-slate-950/90 border border-indigo-500/40 rounded-xl px-3 py-2">
                  <span className="px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-300 text-[10px] font-black uppercase shrink-0">
                    TOKO
                  </span>
                  <select
                    value={activeMobileInvoice?.id || ''}
                    onChange={e => setSelectedMobileInvoiceId(e.target.value)}
                    className="w-full bg-transparent text-xs font-black text-white focus:outline-none cursor-pointer truncate"
                  >
                    {mobileBranchInvoices.map(inv => {
                      const sisa = Math.max(0, inv.totalTagihan - inv.jumlahTerbayar);
                      const teamTag = inv.billingTeam === 'SALES' ? '[SALES]' : '[FINANCE]';
                      return (
                        <option key={inv.id} value={inv.id} className="bg-slate-900 text-white">
                          {teamTag} {inv.customerName} — {sisa > 0 ? `Sisa Rp ${sisa.toLocaleString('id-ID')}` : '✓ LUNAS'}
                        </option>
                      );
                    })}
                  </select>
                </div>
              </div>
            </div>

            {/* Mobile App Body Content (Scrollable) */}
            <div className="flex-1 overflow-y-auto p-3.5 space-y-3.5 bg-slate-50 dark:bg-slate-950">
              {mobileNavTab === 'form_tagih' && activeMobileInvoice && (() => {
                const sisaSaatIni = Math.max(0, activeMobileInvoice.totalTagihan - activeMobileInvoice.jumlahTerbayar);
                const agingDays = computeInvoiceAgingDays(activeMobileInvoice.dueDate);
                const effectivePaidNow = mobileIsLunasChecked
                  ? sisaSaatIni
                  : Math.max(0, Math.min(sisaSaatIni, Number(mobileNominalBayar) || 0));
                const sisaSetelahBayar = Math.max(0, sisaSaatIni - effectivePaidNow);
                const isFakturAlreadyLunas = sisaSaatIni === 0;

                return (
                  <form onSubmit={handleSaveMobileCollection} className="space-y-3.5">
                    {/* Kartu Detail Tagihan Pelanggan */}
                    <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-3.5 shadow-xs space-y-2.5">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="flex flex-wrap items-center gap-1.5 mb-0.5">
                            <span className="text-[10px] font-mono font-black text-indigo-600 dark:text-indigo-400">
                              {activeMobileInvoice.noInvoice} &bull; SJ: {activeMobileInvoice.noSuratJalan}
                            </span>
                            <span
                              className={`px-2 py-0.5 rounded-md text-[9px] font-black uppercase border ${
                                activeMobileInvoice.billingTeam === 'SALES'
                                  ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30'
                                  : 'bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 border-indigo-500/30'
                              }`}
                            >
                              {(() => {
                                if (activeMobileInvoice.billingTeam !== 'SALES') return 'Tim Penagihan Finance';
                                const mapped = resolveSalesFromMappings(
                                  activeMobileInvoice.salesPersonName || '',
                                  salesMappings
                                );
                                if (mapped) {
                                  return `Sales: ${mapped.userFullName} (${mapped.userPhone})`;
                                }
                                return `Tagihan Khusus Sales${activeMobileInvoice.salesPersonName ? ` • ${activeMobileInvoice.salesPersonName}` : ''}`;
                              })()}
                            </span>
                          </div>
                          <h3 className="text-sm font-black text-slate-900 dark:text-white leading-snug">
                            {activeMobileInvoice.customerName}
                          </h3>
                          <div className="text-[11px] text-slate-500 flex items-center gap-2 mt-0.5">
                            <span>{activeMobileInvoice.region}</span>
                            <span>&bull;</span>
                            <span className="font-mono">{activeMobileInvoice.contactPhone}</span>
                          </div>
                        </div>
                        <span
                          className={`px-2.5 py-1 rounded-full text-[10px] font-black shrink-0 border ${
                            isFakturAlreadyLunas
                              ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30'
                              : agingDays > 0
                              ? 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30'
                              : 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30'
                          }`}
                        >
                          {isFakturAlreadyLunas
                            ? '✓ LUNAS'
                            : agingDays > 0
                            ? `Overdue ${agingDays} Hr`
                            : `Jatuh Tempo ${activeMobileInvoice.dueDate}`}
                        </span>
                      </div>

                      {/* Ringkasan Nominal Tagihan Faktur vs Terbayar vs Sisa */}
                      <div className="grid grid-cols-3 gap-1.5 pt-1">
                        <div className="p-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                          <div className="text-[9px] font-bold uppercase text-slate-400">Nominal Tagihan</div>
                          <div className="text-[11px] font-black font-mono text-slate-900 dark:text-white mt-0.5">
                            Rp {activeMobileInvoice.totalTagihan.toLocaleString('id-ID')}
                          </div>
                        </div>
                        <div className="p-2 rounded-xl bg-emerald-500/5 border border-emerald-500/20">
                          <div className="text-[9px] font-bold uppercase text-emerald-600 dark:text-emerald-400">Sudah Dibayar</div>
                          <div className="text-[11px] font-black font-mono text-emerald-600 dark:text-emerald-400 mt-0.5">
                            Rp {activeMobileInvoice.jumlahTerbayar.toLocaleString('id-ID')}
                          </div>
                        </div>
                        <div className="p-2 rounded-xl bg-rose-500/5 border border-rose-500/20">
                          <div className="text-[9px] font-bold uppercase text-rose-600 dark:text-rose-400">Sisa Tagihan</div>
                          <div className="text-[11px] font-black font-mono text-rose-600 dark:text-rose-400 mt-0.5">
                            Rp {sisaSaatIni.toLocaleString('id-ID')}
                          </div>
                        </div>
                      </div>

                      {/* Tombol Cepat WA & Cetak Surat Tagihan */}
                      <div className="grid grid-cols-2 gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() => setWaBillingInvoice(activeMobileInvoice)}
                          className="py-1.5 px-2.5 rounded-xl bg-emerald-600/15 hover:bg-emerald-600/25 border border-emerald-500/30 text-emerald-700 dark:text-emerald-300 text-[11px] font-black flex items-center justify-center gap-1.5 cursor-pointer"
                        >
                          <MessageSquare className="w-3.5 h-3.5" />
                          <span>Kirim WA Tagihan</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setPrintSuratTagihanInvoice(activeMobileInvoice)}
                          className="py-1.5 px-2.5 rounded-xl bg-indigo-600/15 hover:bg-indigo-600/25 border border-indigo-500/30 text-indigo-700 dark:text-indigo-300 text-[11px] font-black flex items-center justify-center gap-1.5 cursor-pointer"
                        >
                          <Printer className="w-3.5 h-3.5" />
                          <span>Surat Tagihan</span>
                        </button>
                      </div>
                    </div>

                    {/* 1. UPLOAD FOTO BUKTI PENAGIHAN KE PELANGGAN LANGSUNG */}
                    <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-3.5 shadow-xs space-y-2.5">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-black text-slate-900 dark:text-white flex items-center gap-1.5">
                          <Camera className="w-4 h-4 text-indigo-500" />
                          <span>1. Foto Bukti Penagihan ke Pelanggan</span>
                        </label>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
                          Wajib / Kamera HP
                        </span>
                      </div>

                      <input
                        ref={mobilePhotoInputRef}
                        type="file"
                        accept="image/*"
                        capture="environment"
                        onChange={handleMobilePhotoFileChange}
                        className="hidden"
                      />

                      {mobilePhotoDataUrl ? (
                        <div className="space-y-2">
                          <div className="relative rounded-xl overflow-hidden border border-emerald-500/40 bg-slate-950 aspect-16/10">
                            <img
                              src={mobilePhotoDataUrl}
                              alt="Bukti Penagihan Pelanggan"
                              className="w-full h-full object-cover"
                            />
                            <div className="absolute top-2 left-2 px-2 py-0.5 rounded-md bg-emerald-600/90 text-white text-[10px] font-black">
                              ✓ Bukti Foto Terlampir
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() => mobilePhotoInputRef.current?.click()}
                              className="flex-1 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-[11px] font-bold flex items-center justify-center gap-1.5 cursor-pointer"
                            >
                              <Camera className="w-3.5 h-3.5" />
                              <span>Foto Ulang Kamera</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => setMobilePhotoDataUrl('')}
                              className="px-3 py-1.5 rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-400 text-[11px] font-bold cursor-pointer"
                            >
                              Hapus
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="grid grid-cols-2 gap-2">
                          <button
                            type="button"
                            onClick={() => mobilePhotoInputRef.current?.click()}
                            className="py-4 px-3 rounded-xl border-2 border-dashed border-indigo-400/60 bg-indigo-50/40 dark:bg-indigo-950/30 hover:bg-indigo-50 dark:hover:bg-indigo-950/50 flex flex-col items-center justify-center gap-1.5 text-indigo-600 dark:text-indigo-300 cursor-pointer transition"
                          >
                            <Camera className="w-5 h-5" />
                            <span className="text-[11px] font-black">Ambil Foto / Upload</span>
                            <span className="text-[9px] text-slate-500">Kamera HP / Galeri</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              const sampleUrl = createSampleBillingPhotoDataUrl(
                                activeMobileInvoice.customerName,
                                activeMobileInvoice.noInvoice,
                                effectivePaidNow,
                                activeMobileInvoice.totalTagihan,
                                currentUser?.fullName || 'Kolektor Finance',
                                mobileKendala
                              );
                              setMobilePhotoDataUrl(sampleUrl);
                            }}
                            className="py-4 px-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 hover:bg-slate-100 dark:hover:bg-slate-800 flex flex-col items-center justify-center gap-1.5 text-slate-700 dark:text-slate-300 cursor-pointer transition"
                          >
                            <Upload className="w-5 h-5 text-emerald-500" />
                            <span className="text-[11px] font-black">Buat Bukti Digital</span>
                            <span className="text-[9px] text-slate-500">Stempel Waktu &amp; Faktur</span>
                          </button>
                        </div>
                      )}
                    </div>

                    {/* 2. INPUT KENDALA PENAGIHAN DI LAPANGAN */}
                    <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-3.5 shadow-xs space-y-2.5">
                      <label className="text-xs font-black text-slate-900 dark:text-white flex items-center gap-1.5">
                        <AlertTriangle className="w-4 h-4 text-amber-500" />
                        <span>2. Kendala Penagihan ke Pelanggan</span>
                      </label>

                      <select
                        value={mobileKendala}
                        onChange={e => setMobileKendala(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs font-bold text-slate-900 dark:text-white cursor-pointer"
                      >
                        {KENDALA_PENAGIHAN_OPTIONS.map(opt => (
                          <option key={opt} value={opt}>
                            {opt}
                          </option>
                        ))}
                      </select>

                      <div className="grid grid-cols-1 gap-2">
                        <div>
                          <label className="block text-[10px] font-bold text-slate-500 mb-1">
                            Catatan Kunjungan / Detail Kendala Pelanggan
                          </label>
                          <textarea
                            rows={2}
                            value={mobileCollectorNotes}
                            onChange={e => setMobileCollectorNotes(e.target.value)}
                            placeholder="Contoh: Faktur diterima bagian keuangan, pembayaran via transfer BCA / tunai..."
                            className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-white"
                          />
                        </div>
                        {mobileKendala !== 'Tidak Ada Kendala (Pembayaran Lancar)' && (
                          <div className="flex items-center justify-between gap-2 bg-amber-500/10 border border-amber-500/30 rounded-xl px-3 py-1.5">
                            <span className="text-[11px] font-bold text-amber-700 dark:text-amber-300">
                              Tgl Janji Bayar Ulang:
                            </span>
                            <input
                              type="date"
                              value={mobilePromiseDate}
                              onChange={e => setMobilePromiseDate(e.target.value)}
                              className="bg-transparent text-xs font-black text-amber-800 dark:text-amber-200 outline-none"
                            />
                          </div>
                        )}
                      </div>
                    </div>

                    {/* 3 & 4. TOTAL NOMINAL YANG DIBAYARKAN DARI NOMINAL TAGIHAN + FITUR LUNAS */}
                    <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-3.5 shadow-xs space-y-3">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-black text-slate-900 dark:text-white flex items-center gap-1.5">
                          <DollarSign className="w-4 h-4 text-emerald-500" />
                          <span>3. Nominal Dibayarkan &amp; Fitur Lunas</span>
                        </label>
                        <button
                          type="button"
                          onClick={() => handleToggleFiturLunas(!mobileIsLunasChecked)}
                          className={`px-3 py-1 rounded-xl text-[11px] font-black flex items-center gap-1 cursor-pointer transition border ${
                            mobileIsLunasChecked || sisaSetelahBayar === 0
                              ? 'bg-emerald-600 text-white border-emerald-500 shadow-xs'
                              : 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30 hover:bg-emerald-500/25'
                          }`}
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>✓ FITUR LUNAS (100%)</span>
                        </button>
                      </div>

                      {/* Input Nominal yang Dibayarkan Sekarang */}
                      <div>
                        <div className="flex items-center justify-between text-[11px] mb-1">
                          <span className="text-slate-500 font-semibold">Total Nominal Dibayarkan Sekarang:</span>
                          <span className="font-mono font-bold text-slate-700 dark:text-slate-300">
                            dari Sisa Rp {sisaSaatIni.toLocaleString('id-ID')}
                          </span>
                        </div>
                        <div className="relative">
                          <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-black text-slate-400">
                            Rp
                          </span>
                          <input
                            type="number"
                            min={0}
                            max={sisaSaatIni}
                            value={effectivePaidNow}
                            onChange={e => {
                              const val = Math.max(0, Math.min(sisaSaatIni, Number(e.target.value) || 0));
                              setMobileNominalBayar(val);
                              setMobileIsLunasChecked(val >= sisaSaatIni && sisaSaatIni > 0);
                            }}
                            className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-sm font-mono font-black text-slate-900 dark:text-white"
                          />
                        </div>

                        {/* Quick Nominal Preset Pills */}
                        <div className="grid grid-cols-3 gap-1.5 mt-2">
                          <button
                            type="button"
                            onClick={() => {
                              setMobileNominalBayar(0);
                              setMobileIsLunasChecked(false);
                            }}
                            className="py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-[10px] font-bold cursor-pointer"
                          >
                            Rp 0 (Janji Bayar)
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              const half = Math.round(sisaSaatIni / 2);
                              setMobileNominalBayar(half);
                              setMobileIsLunasChecked(false);
                            }}
                            className="py-1.5 rounded-lg bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 text-[10px] font-bold cursor-pointer"
                          >
                            Cicil 50%
                          </button>
                          <button
                            type="button"
                            onClick={() => handleToggleFiturLunas(true)}
                            className="py-1.5 rounded-lg bg-emerald-600 text-white text-[10px] font-black cursor-pointer"
                          >
                            ✓ Lunas Penuh
                          </button>
                        </div>
                      </div>

                      {/* Ringkasan Kalkulasi Total Nominal yang Dibayarkan dari Nominal Tagihan */}
                      <div
                        className={`p-3 rounded-xl border space-y-1.5 text-xs ${
                          sisaSetelahBayar === 0
                            ? 'bg-emerald-500/10 border-emerald-500/30'
                            : 'bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800'
                        }`}
                      >
                        <div className="flex justify-between">
                          <span className="text-slate-500">Total Nominal Tagihan Faktur:</span>
                          <span className="font-mono font-bold text-slate-900 dark:text-white">
                            Rp {activeMobileInvoice.totalTagihan.toLocaleString('id-ID')}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-500">Total Dibayarkan (Akumulasi):</span>
                          <span className="font-mono font-black text-emerald-600 dark:text-emerald-400">
                            Rp {(activeMobileInvoice.jumlahTerbayar + effectivePaidNow).toLocaleString('id-ID')} / Rp{' '}
                            {activeMobileInvoice.totalTagihan.toLocaleString('id-ID')}
                          </span>
                        </div>
                        <div className="flex justify-between pt-1.5 border-t border-slate-200/80 dark:border-slate-800 items-center">
                          <span className="font-bold text-slate-700 dark:text-slate-200">Sisa Tagihan Akhir:</span>
                          <div className="flex items-center gap-2">
                            <span
                              className={`font-mono font-black text-sm ${
                                sisaSetelahBayar === 0
                                  ? 'text-emerald-600 dark:text-emerald-400'
                                  : 'text-rose-600 dark:text-rose-400'
                              }`}
                            >
                              Rp {sisaSetelahBayar.toLocaleString('id-ID')}
                            </span>
                            {sisaSetelahBayar === 0 && (
                              <span className="px-2 py-0.5 rounded-md bg-emerald-600 text-white text-[10px] font-black">
                                LUNAS
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <button
                        type="submit"
                        className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs flex items-center justify-center gap-2 shadow-md cursor-pointer transition"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        <span>
                          {sisaSetelahBayar === 0
                            ? 'SIMPAN BUKTI & NYATAKAN LUNAS'
                            : 'SIMPAN BUKTI PENAGIHAN & PEMBAYARAN'}
                        </span>
                      </button>
                    </div>
                  </form>
                );
              })()}

              {/* TAB 2 HP: DAFTAR TOKO TAGIHAN */}
              {mobileNavTab === 'daftar_toko' && (
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between px-1">
                    <h4 className="text-xs font-black uppercase text-slate-700 dark:text-slate-300">
                      Daftar Pelanggan ({mobileBranchInvoices.length} Toko)
                    </h4>
                    <button
                      type="button"
                      onClick={() => setIsAddModalOpen(true)}
                      className="px-2.5 py-1 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-[10px] font-black cursor-pointer flex items-center gap-1"
                    >
                      <Plus className="w-3 h-3" />
                      <span>Input Tagihan</span>
                    </button>
                  </div>
                  {mobileBranchInvoices.map(inv => {
                    const sisa = Math.max(0, inv.totalTagihan - inv.jumlahTerbayar);
                    const isLunas = sisa <= 0;
                    return (
                      <div
                        key={inv.id}
                        onClick={() => {
                          setSelectedMobileInvoiceId(inv.id);
                          setMobileNavTab('form_tagih');
                        }}
                        className={`p-3 rounded-2xl border transition cursor-pointer ${
                          activeMobileInvoice?.id === inv.id
                            ? 'bg-indigo-50/70 dark:bg-indigo-950/40 border-indigo-500'
                            : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-indigo-400'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <div className="flex items-center gap-1.5">
                              <span className="text-[10px] font-mono font-bold text-indigo-600 dark:text-indigo-400">
                                {inv.noInvoice}
                              </span>
                              <span
                                className={`px-1.5 py-0.5 rounded text-[9px] font-black uppercase ${
                                  inv.billingTeam === 'SALES'
                                    ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300'
                                    : 'bg-indigo-500/15 text-indigo-700 dark:text-indigo-300'
                                }`}
                              >
                                {inv.billingTeam === 'SALES' ? 'Khusus Sales' : 'Tim Finance'}
                              </span>
                            </div>
                            <div className="text-xs font-black text-slate-900 dark:text-white">
                              {inv.customerName}
                            </div>
                            <div className="text-[10px] text-slate-500">
                              {inv.region}
                              {inv.billingTeam === 'SALES' && inv.salesPersonName ? ` • Sales: ${inv.salesPersonName}` : ''}
                            </div>
                          </div>
                          <span
                            className={`px-2 py-0.5 rounded-lg text-[10px] font-black ${
                              isLunas
                                ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                                : 'bg-rose-500/15 text-rose-600 dark:text-rose-400'
                            }`}
                          >
                            {isLunas ? '✓ LUNAS' : `Sisa Rp ${sisa.toLocaleString('id-ID')}`}
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-[10px] text-slate-500 mt-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                          <span>
                            Terbayar: <strong>Rp {inv.jumlahTerbayar.toLocaleString('id-ID')}</strong> / Rp{' '}
                            {inv.totalTagihan.toLocaleString('id-ID')}
                          </span>
                          {inv.kendalaTagihan && (
                            <span className="text-amber-600 dark:text-amber-400 font-bold truncate max-w-[140px]">
                              {inv.kendalaTagihan}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* TAB 3 HP: RIWAYAT BUKTI PENAGIHAN */}
              {mobileNavTab === 'riwayat_bukti' && (
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between px-1">
                    <h4 className="text-xs font-black uppercase text-slate-700 dark:text-slate-300">
                      Riwayat Foto Bukti Penagihan ({allCollectionLogs.length})
                    </h4>
                  </div>
                  {allCollectionLogs.length === 0 ? (
                    <div className="p-8 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-center space-y-1.5">
                      <Camera className="w-8 h-8 text-slate-400 mx-auto" />
                      <div className="text-xs font-bold text-slate-700 dark:text-slate-300">
                        Belum Ada Riwayat Bukti Penagihan
                      </div>
                      <p className="text-[11px] text-slate-500">
                        Silakan ambil foto bukti penagihan &amp; simpan pembayaran pada tab Tagih &amp; Bayar.
                      </p>
                    </div>
                  ) : (
                    allCollectionLogs.map(log => (
                      <div
                        key={log.id}
                        className="p-3 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-2"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <div className="text-xs font-black text-slate-900 dark:text-white">
                              {log.customerName}
                            </div>
                            <div className="text-[10px] font-mono text-indigo-500">
                              {log.noInvoice} &bull; Oleh: {log.collectorName}
                            </div>
                          </div>
                          <span
                            className={`px-2 py-0.5 rounded-md text-[10px] font-black ${
                              log.statusLunas
                                ? 'bg-emerald-600 text-white'
                                : 'bg-amber-500/15 text-amber-600 dark:text-amber-400'
                            }`}
                          >
                            {log.statusLunas ? '✓ LUNAS' : 'CICILAN / KUNJUNGAN'}
                          </span>
                        </div>
                        {log.photoDataUrl && (
                          <img
                            src={log.photoDataUrl}
                            alt={log.customerName}
                            className="w-full h-32 object-cover rounded-xl border border-slate-200 dark:border-slate-800"
                          />
                        )}
                        <div className="text-[11px] space-y-0.5">
                          <div className="flex justify-between">
                            <span className="text-slate-500">Dibayarkan dari Tagihan:</span>
                            <span className="font-mono font-black text-emerald-600 dark:text-emerald-400">
                              Rp {log.nominalDibayarkan.toLocaleString('id-ID')} / Rp{' '}
                              {log.totalTagihanFaktur.toLocaleString('id-ID')}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-500">Kendala:</span>
                            <span className="font-bold text-amber-600 dark:text-amber-400">{log.kendala}</span>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>

            {/* Bottom Navigation Bar HP (Seperti Aplikasi Admin Penjualan & Portal Driver) */}
            <div className="bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 px-3 py-2 grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setMobileNavTab('form_tagih')}
                className={`py-2 rounded-xl flex flex-col items-center justify-center gap-0.5 text-[10px] font-black cursor-pointer transition ${
                  mobileNavTab === 'form_tagih'
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                <Camera className="w-4 h-4" />
                <span>Tagih &amp; Lunas</span>
              </button>
              <button
                type="button"
                onClick={() => setMobileNavTab('daftar_toko')}
                className={`py-2 rounded-xl flex flex-col items-center justify-center gap-0.5 text-[10px] font-black cursor-pointer transition ${
                  mobileNavTab === 'daftar_toko'
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                <Building2 className="w-4 h-4" />
                <span>Daftar Toko ({mobileBranchInvoices.length})</span>
              </button>
              <button
                type="button"
                onClick={() => setMobileNavTab('riwayat_bukti')}
                className={`py-2 rounded-xl flex flex-col items-center justify-center gap-0.5 text-[10px] font-black cursor-pointer transition ${
                  mobileNavTab === 'riwayat_bukti'
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                <History className="w-4 h-4" />
                <span>Bukti ({allCollectionLogs.length})</span>
              </button>
            </div>
          </div>
        </div>
      ) : financeMode === 'customer_mapping' ? (
        <CustomerMasterMappingView
          invoices={invoices}
          masterCustomers={masterCustomers}
          onSaveMasterCustomers={next => {
            setMasterCustomers(next);
            setPopupModal({
              title: 'Mapping Master Pelanggan Diperbarui',
              message: 'Kategori Pelanggan (TEMPO / COD), Plafon Limit Piutang, dan Tenor Jatuh Tempo berhasil disimpan.'
            });
          }}
          onUpdateCustomerInvoicesMeta={(customerName, updates) => {
            setInvoices(prev =>
              prev.map(inv =>
                inv.customerName.trim().toUpperCase() === customerName.trim().toUpperCase()
                  ? {
                      ...inv,
                      limitPelanggan: updates.limitPelanggan,
                      paymentCategory: updates.paymentCategory,
                      tempoDays: updates.tempoDays,
                      region: updates.region
                    }
                  : inv
              )
            );
          }}
          onSwitchToLedger={() => {
            if (onNavigateTab) {
              onNavigateTab('finance_dashboard');
            } else {
              setFinanceMode('monitoring');
            }
          }}
        />
      ) : financeMode === 'overview' ? (
        <FinanceOverviewDashboard
          invoices={invoices}
          masterCustomers={masterCustomers}
          collectionLogs={allCollectionLogs}
          branches={branches}
          branchFilter={branchFilter}
          setBranchFilter={setBranchFilter}
          onNavigateTab={tab => {
            if (onNavigateTab) {
              onNavigateTab(tab);
            } else if (tab === 'finance_customer_mapping') {
              setFinanceMode('customer_mapping');
            } else if (tab === 'finance_billing_app') {
              setFinanceMode('billing_app');
            } else if (tab === 'finance_dashboard') {
              setFinanceMode('monitoring');
            }
          }}
        />
      ) : (
        <FinanceMonitoringLedgerView
          invoices={invoices}
          masterCustomers={masterCustomers}
          branches={branches}
          branchFilter={branchFilter}
          setBranchFilter={setBranchFilter}
          billingTeamFilter={billingTeamFilter}
          setBillingTeamFilter={setBillingTeamFilter}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          statusFilter={statusFilter}
          setStatusFilter={setStatusFilter}
          agingFilter={agingFilter}
          setAgingFilter={setAgingFilter}
          onOpenAddModal={prefill => {
            if (prefill) {
              setNewInvForm(prev => ({
                ...prev,
                customerName: prefill.customerName,
                region: prefill.region,
                limitPelanggan: prefill.limitPelanggan,
                paymentCategory: prefill.paymentCategory,
                billingTeam: prefill.billingTeam || (billingTeamFilter === 'SALES' ? 'SALES' : 'FINANCE')
              }));
            } else if (billingTeamFilter === 'SALES' || billingTeamFilter === 'FINANCE') {
              setNewInvForm(prev => ({
                ...prev,
                billingTeam: billingTeamFilter
              }));
            }
            setIsAddModalOpen(true);
          }}
          onOpenPaymentModal={handleOpenPaymentModal}
          onDeleteInvoice={handleDeleteInvoice}
          onOpenWaModal={inv => setWaBillingInvoice(inv)}
          onOpenPrintModal={inv => setPrintSuratTagihanInvoice(inv)}
          onImportInvoices={imported => {
            setInvoices(prev => [...imported, ...prev]);
            setPopupModal({
              title: 'Import Excel Daftar Tagihan Berhasil',
              message: `${imported.length} baris faktur tagihan pelanggan berhasil diunggah ke Buku Besar Piutang.`
            });
          }}
          onSwitchToMapping={() => {
            if (onNavigateTab) {
              onNavigateTab('finance_customer_mapping');
            } else {
              setFinanceMode('customer_mapping');
            }
          }}
          onOpenBillingApp={team => {
            if (team) setBillingTeamFilter(team);
            if (onNavigateTab) {
              onNavigateTab(team === 'SALES' ? 'marketing_billing_app' : 'finance_billing_app');
            } else {
              setFinanceMode('billing_app');
            }
          }}
        />
      )}

      {/* ============================================================ */}
      {/* MODAL: CATAT PEMBAYARAN / CICILAN TAGIHAN                    */}
      {/* ============================================================ */}
      {paymentModalInvoice && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <div>
                <h3 className="text-sm font-black text-slate-900 dark:text-white">
                  Catat Pembayaran / Pelunasan Tagihan
                </h3>
                <p className="text-[11px] text-slate-500 font-mono mt-0.5">
                  {paymentModalInvoice.noInvoice} &bull; {paymentModalInvoice.customerName}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setPaymentModalInvoice(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-900 dark:hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSavePayment} className="space-y-3.5 text-xs">
              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-slate-500">Total Tagihan Faktur:</span>
                  <span className="font-mono font-bold text-slate-900 dark:text-white">
                    Rp {paymentModalInvoice.totalTagihan.toLocaleString('id-ID')}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Sudah Terbayar Sebelumnya:</span>
                  <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                    Rp {paymentModalInvoice.jumlahTerbayar.toLocaleString('id-ID')}
                  </span>
                </div>
                <div className="flex justify-between pt-1.5 border-t border-slate-200 dark:border-slate-800">
                  <span className="font-bold text-slate-700 dark:text-slate-300">Sisa Tagihan Saat Ini:</span>
                  <span className="font-mono font-black text-rose-600 dark:text-rose-400">
                    Rp {Math.max(0, paymentModalInvoice.totalTagihan - paymentModalInvoice.jumlahTerbayar).toLocaleString('id-ID')}
                  </span>
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Nominal Pembayaran Masuk (Rp) *
                </label>
                <input
                  type="number"
                  min={1}
                  max={Math.max(0, paymentModalInvoice.totalTagihan - paymentModalInvoice.jumlahTerbayar)}
                  required
                  value={paymentNominal}
                  onChange={e => setPaymentNominal(Number(e.target.value))}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white font-mono text-sm font-black"
                />
                <div className="flex gap-2 mt-2">
                  <button
                    type="button"
                    onClick={() =>
                      setPaymentNominal(
                        Math.round(Math.max(0, paymentModalInvoice.totalTagihan - paymentModalInvoice.jumlahTerbayar) / 2)
                      )
                    }
                    className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-[10px] font-bold cursor-pointer"
                  >
                    Cicil 50%
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setPaymentNominal(Math.max(0, paymentModalInvoice.totalTagihan - paymentModalInvoice.jumlahTerbayar))
                    }
                    className="px-2.5 py-1 rounded-lg bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 text-[10px] font-bold cursor-pointer"
                  >
                    Lunasi 100%
                  </button>
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Catatan Pembayaran / Referensi Bank
                </label>
                <textarea
                  rows={2}
                  placeholder="Contoh: Transfer BCA an. Toko Sekar Wangi..."
                  value={paymentNotes}
                  onChange={e => setPaymentNotes(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setPaymentModalInvoice(null)}
                  className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold cursor-pointer"
                >
                  Simpan Pembayaran
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* MODAL: TAMBAH TAGIHAN PELANGGAN BARU                         */}
      {/* ============================================================ */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <h3 className="text-sm font-black text-slate-900 dark:text-white">
                Tambah Tagihan Pelanggan Belum Terlunasi
              </h3>
              <button
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-900 dark:hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAddNewInvoice} className="space-y-3 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-600 dark:text-slate-400 mb-1">
                    No. Invoice / Faktur *
                  </label>
                  <input
                    type="text"
                    required
                    value={newInvForm.noInvoice}
                    onChange={e => setNewInvForm({ ...newInvForm, noInvoice: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white font-mono font-bold"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-600 dark:text-slate-400 mb-1">
                    No. Surat Jalan
                  </label>
                  <input
                    type="text"
                    value={newInvForm.noSuratJalan}
                    onChange={e => setNewInvForm({ ...newInvForm, noSuratJalan: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-600 dark:text-slate-400 mb-1">
                    Nama Pelanggan / Toko *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Contoh: TK ANUGRAH SEKAR WANGI"
                    value={newInvForm.customerName}
                    onChange={e => setNewInvForm({ ...newInvForm, customerName: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white font-bold"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-600 dark:text-slate-400 mb-1">
                    Wilayah / Kota
                  </label>
                  <input
                    type="text"
                    value={newInvForm.region}
                    onChange={e => setNewInvForm({ ...newInvForm, region: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block font-bold text-slate-600 dark:text-slate-400 mb-1">
                    Kontak / WhatsApp
                  </label>
                  <input
                    type="text"
                    placeholder="0812-..."
                    value={newInvForm.contactPhone}
                    onChange={e => setNewInvForm({ ...newInvForm, contactPhone: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-600 dark:text-slate-400 mb-1">
                    Tanggal Invoice *
                  </label>
                  <input
                    type="date"
                    required
                    value={newInvForm.invoiceDate}
                    onChange={e => setNewInvForm({ ...newInvForm, invoiceDate: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-600 dark:text-slate-400 mb-1">
                    Tanggal Jatuh Tempo *
                  </label>
                  <input
                    type="date"
                    required
                    value={newInvForm.dueDate}
                    onChange={e => setNewInvForm({ ...newInvForm, dueDate: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-600 dark:text-slate-400 mb-1">
                  Rincian Barang / Pesanan *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: Karton Box Corrugated B-Flute 60x40x40 cm (2.000 Pcs)"
                  value={newInvForm.itemSummary}
                  onChange={e => setNewInvForm({ ...newInvForm, itemSummary: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white font-bold"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-600 dark:text-slate-400 mb-1">
                    Total Nilai Tagihan / Terutang (Rp) *
                  </label>
                  <input
                    type="number"
                    min={0}
                    required
                    value={newInvForm.totalTagihan}
                    onChange={e => setNewInvForm({ ...newInvForm, totalTagihan: Number(e.target.value) })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white font-mono font-bold"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-600 dark:text-slate-400 mb-1">
                    Sudah Dibayar / Bayar (Rp)
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={newInvForm.jumlahTerbayar}
                    onChange={e => setNewInvForm({ ...newInvForm, jumlahTerbayar: Number(e.target.value) })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white font-mono font-bold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-600 dark:text-slate-400 mb-1">
                    Kategori Pelanggan (TEMPO / COD)
                  </label>
                  <select
                    value={newInvForm.paymentCategory}
                    onChange={e =>
                      setNewInvForm({
                        ...newInvForm,
                        paymentCategory: e.target.value as 'TEMPO' | 'COD',
                        limitPelanggan: e.target.value === 'COD' ? 0 : newInvForm.limitPelanggan || 2000000
                      })
                    }
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white font-bold"
                  >
                    <option value="TEMPO">Pelanggan TEMPO</option>
                    <option value="COD">Pelanggan COD (Tunai)</option>
                  </select>
                </div>
                <div>
                  <label className="block font-bold text-slate-600 dark:text-slate-400 mb-1">
                    Limit Pelanggan (Rp)
                  </label>
                  <input
                    type="number"
                    min={0}
                    disabled={newInvForm.paymentCategory === 'COD'}
                    value={newInvForm.paymentCategory === 'COD' ? 0 : newInvForm.limitPelanggan}
                    onChange={e => setNewInvForm({ ...newInvForm, limitPelanggan: Number(e.target.value) })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white font-mono font-bold disabled:opacity-50"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-600 dark:text-slate-400 mb-1">
                    Tim Penagihan (Finance / Khusus Sales) *
                  </label>
                  <select
                    value={newInvForm.billingTeam}
                    onChange={e =>
                      setNewInvForm({
                        ...newInvForm,
                        billingTeam: e.target.value as 'FINANCE' | 'SALES'
                      })
                    }
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white font-bold"
                  >
                    <option value="FINANCE">Tagihan Tim Penagihan (Finance)</option>
                    <option value="SALES">Tagihan Khusus Sales (Marketing)</option>
                  </select>
                </div>
                <div>
                  <label className="block font-bold text-slate-600 dark:text-slate-400 mb-1">
                    {newInvForm.billingTeam === 'SALES'
                      ? 'Nama Sales Penagih (Terintegrasi Mapping Nama Sales)'
                      : 'Catatan Penagihan'}
                  </label>
                  {newInvForm.billingTeam === 'SALES' ? (
                    <div className="space-y-1.5">
                      <select
                        value={newInvForm.salesPersonName}
                        onChange={e => setNewInvForm({ ...newInvForm, salesPersonName: e.target.value })}
                        className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white font-bold text-xs cursor-pointer"
                      >
                        {(salesMappings.length > 0 ? salesMappings : DEFAULT_SALES_MAPPINGS).map(m => (
                          <React.Fragment key={m.id}>
                            <option value={m.userFullName}>
                              {m.userFullName} — WA {m.userPhone} ({m.masterSalesName1}{m.masterSalesName2 ? ` / ${m.masterSalesName2}` : ''})
                            </option>
                            <option value={m.masterSalesName1}>
                              Master 1: {m.masterSalesName1} ({m.userFullName})
                            </option>
                            {m.masterSalesName2 && (
                              <option value={m.masterSalesName2}>
                                Master 2: {m.masterSalesName2} ({m.userFullName})
                              </option>
                            )}
                          </React.Fragment>
                        ))}
                      </select>
                      <input
                        type="text"
                        placeholder="Atau ketik manual nama Sales..."
                        value={newInvForm.salesPersonName}
                        onChange={e => setNewInvForm({ ...newInvForm, salesPersonName: e.target.value })}
                        className="w-full px-3 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white font-semibold text-xs"
                      />
                    </div>
                  ) : (
                    <input
                      type="text"
                      placeholder="Contoh: Jatuh tempo 14 hari setelah barang diterima..."
                      value={newInvForm.notes}
                      onChange={e => setNewInvForm({ ...newInvForm, notes: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white"
                    />
                  )}
                </div>
              </div>

              {newInvForm.billingTeam === 'SALES' && (
                <div>
                  <label className="block font-bold text-slate-600 dark:text-slate-400 mb-1">
                    Catatan Penagihan Sales
                  </label>
                  <input
                    type="text"
                    placeholder="Contoh: Ditagih langsung oleh Sales saat kunjungan..."
                    value={newInvForm.notes}
                    onChange={e => setNewInvForm({ ...newInvForm, notes: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white"
                  />
                </div>
              )}

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold cursor-pointer"
                >
                  Simpan Tagihan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: KIRIM REMINDER TAGIHAN WHATSAPP */}
      {waBillingInvoice && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <div>
                <h3 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-2">
                  <MessageSquare className="w-4 h-4 text-emerald-500" />
                  <span>Kirim Tagihan Pelanggan via WhatsApp</span>
                </h3>
                <p className="text-[11px] text-slate-500 font-mono mt-0.5">
                  {waBillingInvoice.customerName} &bull; {waBillingInvoice.contactPhone}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setWaBillingInvoice(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-900 dark:hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <label className="block font-bold text-slate-700 dark:text-slate-300">
                Draft Pesan Penagihan Resmi PT. Anugrah Kemasan Kreatif:
              </label>
              <textarea
                readOnly
                rows={11}
                value={formatWhatsappMessage(waBillingInvoice)}
                className="w-full p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 font-mono text-[11px] leading-relaxed"
              />
              <div className="flex flex-wrap justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard?.writeText(formatWhatsappMessage(waBillingInvoice));
                    const cust = waBillingInvoice.customerName;
                    setWaBillingInvoice(null);
                    setPopupModal({
                      title: 'Pesan Tagihan WhatsApp Disalin',
                      message: `Format pesan penagihan untuk "${cust}" telah disalin dan siap dikirimkan ke nomor ${waBillingInvoice.contactPhone}.`
                    });
                  }}
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black flex items-center gap-1.5 cursor-pointer"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Salin &amp; Tandai Dikirim ke WA</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: SURAT PENAGIHAN / TANDA TERIMA FAKTUR */}
      {printSuratTagihanInvoice && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-xl w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <div>
                <h3 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-2">
                  <Printer className="w-4 h-4 text-indigo-500" />
                  <span>Surat Penagihan &amp; Tanda Terima Faktur</span>
                </h3>
                <p className="text-[11px] text-slate-500 font-mono mt-0.5">
                  Dokumen Resmi Finance &amp; Tax PT. Anugrah Kemasan Kreatif
                </p>
              </div>
              <button
                type="button"
                onClick={() => setPrintSuratTagihanInvoice(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-900 dark:hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-3 text-xs">
              <div className="flex justify-between items-start border-b border-slate-200 dark:border-slate-800 pb-2">
                <div>
                  <div className="font-black text-slate-900 dark:text-white">PT. ANUGRAH KEMASAN KREATIF</div>
                  <div className="text-[11px] text-slate-500">Divisi Finance, Accounting &amp; Penagihan Piutang</div>
                </div>
                <div className="text-right font-mono text-[11px] text-slate-600 dark:text-slate-400">
                  <div>No. Surat: SPG/{printSuratTagihanInvoice.id}/XI/2026</div>
                  <div>Tanggal: {new Date().toISOString().slice(0, 10)}</div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">Kepada Pelanggan:</span>
                  <span className="font-black text-slate-900 dark:text-white">{printSuratTagihanInvoice.customerName}</span>
                  <span className="block text-[11px] text-slate-500">{printSuratTagihanInvoice.region} ({printSuratTagihanInvoice.contactPhone})</span>
                </div>
                <div className="text-right">
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">No. Faktur &amp; SJ:</span>
                  <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400">{printSuratTagihanInvoice.noInvoice}</span>
                  <span className="block font-mono text-[11px] text-slate-500">SJ: {printSuratTagihanInvoice.noSuratJalan}</span>
                </div>
              </div>

              <div className="border-t border-b border-slate-200 dark:border-slate-800 py-2.5 space-y-1">
                <div className="flex justify-between">
                  <span className="text-slate-500">Deskripsi Barang:</span>
                  <span className="font-bold text-slate-900 dark:text-white">{printSuratTagihanInvoice.itemSummary}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Tanggal Jatuh Tempo:</span>
                  <span className="font-mono font-bold text-slate-900 dark:text-white">{printSuratTagihanInvoice.dueDate}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Total Tagihan Faktur:</span>
                  <span className="font-mono font-bold text-slate-900 dark:text-white">Rp {printSuratTagihanInvoice.totalTagihan.toLocaleString('id-ID')}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Sudah Terbayar:</span>
                  <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">Rp {printSuratTagihanInvoice.jumlahTerbayar.toLocaleString('id-ID')}</span>
                </div>
                <div className="flex justify-between pt-1 border-t border-slate-200 dark:border-slate-800">
                  <span className="font-black text-slate-800 dark:text-slate-200">Sisa Tagihan Ditagihkan:</span>
                  <span className="font-mono font-black text-rose-600 dark:text-rose-400 text-sm">
                    Rp {Math.max(0, printSuratTagihanInvoice.totalTagihan - printSuratTagihanInvoice.jumlahTerbayar).toLocaleString('id-ID')}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setPrintSuratTagihanInvoice(null)}
                className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-xs cursor-pointer"
              >
                Tutup
              </button>
              <button
                type="button"
                onClick={() => {
                  const invNo = printSuratTagihanInvoice.noInvoice;
                  setPrintSuratTagihanInvoice(null);
                  window.print();
                  setPopupModal({
                    title: 'Surat Penagihan Siap Dicetak',
                    message: `Surat Penagihan & Tanda Terima Faktur ${invNo} telah diproses untuk pencetakan.`
                  });
                }}
                className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-black text-xs flex items-center gap-1.5 cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Cetak Surat Tagihan</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: CATAT JANJI BAYAR / KUNJUNGAN KOLEKTOR */}
      {collectorVisitInvoice && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <div>
                <h3 className="text-sm font-black text-slate-900 dark:text-white">
                  Catat Kunjungan Kolektor &amp; Janji Bayar
                </h3>
                <p className="text-[11px] text-slate-500 font-mono mt-0.5">
                  {collectorVisitInvoice.noInvoice} &bull; {collectorVisitInvoice.customerName}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setCollectorVisitInvoice(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-900 dark:hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveCollectorVisit} className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Tanggal Janji Bayar / Giro Cair *
                </label>
                <input
                  type="date"
                  required
                  value={promiseDateInput}
                  onChange={e => setPromiseDateInput(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white"
                />
              </div>
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Hasil Kunjungan Kolektor / Konfirmasi Toko *
                </label>
                <textarea
                  rows={3}
                  required
                  placeholder="Contoh: Faktur asli sudah ditukar tanda terima, dijanjikan transfer hari Kamis..."
                  value={collectorNoteInput}
                  onChange={e => setCollectorNoteInput(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setCollectorVisitInvoice(null)}
                  className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-black cursor-pointer"
                >
                  Simpan Status Tagihan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* POPUP NOTIFICATION */}
      {popupModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-md w-full p-6 text-center space-y-4 shadow-2xl">
            <div className="w-12 h-12 rounded-2xl bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <div className="space-y-1.5">
              <h4 className="text-base font-black text-slate-900 dark:text-white">{popupModal.title}</h4>
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">{popupModal.message}</p>
            </div>
            <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                autoFocus
                onClick={() => setPopupModal(null)}
                className="w-full py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-black text-xs cursor-pointer transition"
              >
                Oke, Mengerti
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const PurchasingDashboard = () => (
  <div className="space-y-6">
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      <MetricCard title="PO Aktif" value="12" subtext="Dalam proses pengiriman" icon={ShoppingBag} color="text-indigo-400" />
      <MetricCard title="Supplier Terlambat" value="2" subtext="Perlu follow-up" icon={AlertCircle} color="text-rose-400" />
      <MetricCard title="Efisiensi Biaya" value="12%" subtext="Penghematan vs budget" icon={TrendingUp} color="text-emerald-400" />
    </div>
    <div className="flex justify-end">
      <button className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-lg font-bold flex items-center gap-2">
        <Database className="w-5 h-5" /> Analisa Stok
      </button>
    </div>
    <TeamCalendar role="purchasing_admin" />
  </div>
);

export const DepartmentDashboard: React.FC<{ 
  dashboardType?: 'hr' | 'finance' | 'warehouse' | 'purchasing';
  initialHrTab?: HrSubTab;
  initialFinanceMode?: 'overview' | 'monitoring' | 'customer_mapping' | 'billing_app';
  initialBillingTeamFilter?: 'ALL' | 'FINANCE' | 'SALES';
  onNavigateTab?: (tab: string) => void;
}> = ({ dashboardType, initialHrTab, initialFinanceMode = 'monitoring', initialBillingTeamFilter = 'ALL', onNavigateTab }) => {
  const user = logisticsStore.getCurrentUser();
  
  // Use dashboardType prop if provided, otherwise fallback to user's department role
  const typeToRender = dashboardType || (user.role === 'hr_admin' ? 'hr' : user.role === 'warehouse_admin' ? 'warehouse' : user.role === 'finance_tax_admin' ? 'finance' : user.role === 'purchasing_admin' ? 'purchasing' : 'hr');

  const renderDashboard = () => {
    switch (typeToRender) {
      case 'hr': return <HRDashboard activeHrTab={initialHrTab} />;
      case 'warehouse': return <WarehouseDashboard />;
      case 'finance': return <FinanceDashboard initialMode={initialFinanceMode} initialBillingTeamFilter={initialBillingTeamFilter} onNavigateTab={onNavigateTab} />;
      case 'purchasing': return <PurchasingDashboard />;
      default: return <div className="text-slate-400">Dashboard tidak tersedia untuk role ini.</div>;
    }
  };

  return (
    <div className="space-y-6">
      {typeToRender !== 'warehouse' && typeToRender !== 'finance' && !(typeToRender === 'hr' && (!initialHrTab || initialHrTab === 'hr_core')) && (
        <h2 className="text-lg font-black text-slate-900 dark:text-white">
          {typeToRender === 'hr'
            ? initialHrTab?.startsWith('ga_')
              ? 'General Affairs (GA)'
              : 'Training & Development'
            : 'Dashboard Purchasing'}
        </h2>
      )}
      {renderDashboard()}
    </div>
  );
};

