import React, { useState, useEffect, useMemo } from 'react';
import * as XLSX from 'xlsx';
import { logisticsStore } from '../services/store';
import { 
  Users, Building2, Database, ShoppingBag, TrendingUp, AlertCircle, 
  CheckCircle2, UserCheck, ShieldAlert, Brush, Award, Video, Play,
  Check, Clock, Search, Plus, Calendar, ShieldCheck, FileText, ExternalLink,
  Truck, ArrowRight, X, Download, DollarSign, MapPin, CreditCard,
  ChevronLeft, ChevronRight, Trash2
} from 'lucide-react';
import { SecurityGateLog } from '../types';
import { TeamCalendar } from './TeamCalendar';
import { attendanceService } from '../services/attendanceService';
import { PresenceSummary } from './PresenceSummary';
import { AbsenceManagementModal } from './AbsenceManagementModal';
import { WarehouseManagementSystem } from './WarehouseManagementSystem';

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

  const crews = logisticsStore.getCrews();
  const allRecords = attendanceService.getAllAttendanceRecords();

  const consecutiveAbsences = crews.filter(crew => {
    const records = allRecords
      .filter(r => r.crewId === crew.id && r.status === 'absent')
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    
    let consecutive = 0;
    for (let i = 0; i < records.length; i++) {
      if (i === 0) {
        consecutive++;
      } else {
        const d1 = new Date(records[i-1].date);
        const d2 = new Date(records[i].date);
        if ((d1.getTime() - d2.getTime()) === 86400000) {
          consecutive++;
        } else {
          break;
        }
      }
    }
    return consecutive > 3;
  });

  const [showAbsenceModal, setShowAbsenceModal] = useState(false);
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
      {/* Top HR & Submenu Navigation Tabs */}
      <div className="flex flex-wrap items-center gap-2 p-1.5 rounded-2xl bg-slate-900 border border-slate-800 text-xs">
        <button
          onClick={() => handleTabChange('hr_core')}
          className={`px-3.5 py-2 rounded-xl font-bold flex items-center gap-2 transition cursor-pointer ${
            currentSubTab === 'hr_core'
              ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
              : 'text-slate-400 hover:text-white hover:bg-slate-800'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>1. HR & Presensi</span>
        </button>

        <div className="h-4 w-px bg-slate-800 hidden sm:block" />

        <button
          onClick={() => handleTabChange('ga_security')}
          className={`px-3.5 py-2 rounded-xl font-bold flex items-center gap-2 transition cursor-pointer ${
            currentSubTab === 'ga_security'
              ? 'bg-amber-600 text-slate-950 shadow-lg shadow-amber-600/30'
              : 'text-slate-400 hover:text-white hover:bg-slate-800'
          }`}
        >
          <ShieldAlert className="w-4 h-4 text-amber-400" />
          <span>2. GA: Security</span>
        </button>

        <button
          onClick={() => handleTabChange('ga_hk')}
          className={`px-3.5 py-2 rounded-xl font-bold flex items-center gap-2 transition cursor-pointer ${
            currentSubTab === 'ga_hk'
              ? 'bg-amber-600 text-slate-950 shadow-lg shadow-amber-600/30'
              : 'text-slate-400 hover:text-white hover:bg-slate-800'
          }`}
        >
          <Brush className="w-4 h-4 text-emerald-400" />
          <span>GA: Housekeeping (HK)</span>
        </button>

        <button
          onClick={() => handleTabChange('ga_aset')}
          className={`px-3.5 py-2 rounded-xl font-bold flex items-center gap-2 transition cursor-pointer ${
            currentSubTab === 'ga_aset'
              ? 'bg-amber-600 text-slate-950 shadow-lg shadow-amber-600/30'
              : 'text-slate-400 hover:text-white hover:bg-slate-800'
          }`}
        >
          <Building2 className="w-4 h-4 text-cyan-400" />
          <span>GA: Aset & Fasilitas</span>
        </button>

        <div className="h-4 w-px bg-slate-800 hidden sm:block" />

        <button
          onClick={() => handleTabChange('training_videos')}
          className={`px-3.5 py-2 rounded-xl font-bold flex items-center gap-2 transition cursor-pointer ${
            currentSubTab === 'training_videos'
              ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
              : 'text-slate-400 hover:text-white hover:bg-slate-800'
          }`}
        >
          <Video className="w-4 h-4 text-indigo-400" />
          <span>3. Training: Video SOP</span>
        </button>

        <button
          onClick={() => handleTabChange('training_karyawan')}
          className={`px-3.5 py-2 rounded-xl font-bold flex items-center gap-2 transition cursor-pointer ${
            currentSubTab === 'training_karyawan'
              ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
              : 'text-slate-400 hover:text-white hover:bg-slate-800'
          }`}
        >
          <Award className="w-4 h-4 text-amber-400" />
          <span>Training: Karyawan</span>
        </button>
      </div>

      {/* SUBTAB 1: HR UTAMA (PRESENSI & DATA KARYAWAN) */}
      {currentSubTab === 'hr_core' && (
        <div className="space-y-6 animate-in fade-in duration-200">
          {showAbsenceModal && <AbsenceManagementModal onClose={() => setShowAbsenceModal(false)} />}
          
          {consecutiveAbsences.length > 0 && (
            <div className="bg-rose-900/20 border border-rose-800 p-4 rounded-xl flex items-center gap-4">
              <AlertCircle className="w-6 h-6 text-rose-500 shrink-0" />
              <div>
                <h4 className="text-white font-semibold">Peringatan Ketidakhadiran</h4>
                <p className="text-rose-300 text-sm">
                  Kru berikut tidak hadir lebih dari 3 hari berturut-turut: {consecutiveAbsences.map(c => c.name).join(', ')}
                </p>
              </div>
            </div>
          )}

          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-sm font-black text-white uppercase tracking-wider">Rekapitulasi Kehadiran &amp; Absensi</h3>
              <p className="text-xs text-slate-400">Pantau kehadiran kru supir, helper, dan staf operasional pabrik AKK.</p>
            </div>
            <button 
              onClick={() => setShowAbsenceModal(true)}
              className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-xl font-bold text-xs flex items-center gap-2 cursor-pointer shadow-lg shadow-indigo-600/20 active:scale-95 transition"
            >
              <UserCheck className="w-4 h-4" /> Kelola Absensi &amp; Penugasan
            </button>
          </div>

          <PresenceSummary />

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <MetricCard title="Staff Aktif" value="142" subtext="Tersebar di semua cabang" icon={Users} color="text-indigo-400" />
            <MetricCard title="Hadir Hari Ini" value="19 Kru" subtext="Driver & Helper Operasional" icon={CheckCircle2} color="text-emerald-400" />
            <MetricCard title="Ijin / Sakit" value="1" subtext="Dalam pemantauan HR" icon={AlertCircle} color="text-rose-400" />
            <MetricCard title="Target Rekrutmen" value="85%" subtext="Pencapaian kuota bulan ini" icon={TrendingUp} color="text-emerald-400" />
          </div>

          <TeamCalendar role="hr_admin" />
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

interface CustomerUnpaidInvoice {
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
}

const INITIAL_UNPAID_INVOICES: CustomerUnpaidInvoice[] = [
  {
    id: 'INV-001',
    noInvoice: 'INV/AKK/2026/10/0142',
    noSuratJalan: 'SJ-AKK-2610-088',
    customerName: 'TK ANUGRAH SEKAR WANGI',
    contactPhone: '0812-3456-7811',
    region: 'Banyuwangi Kota',
    invoiceDate: '2026-10-05',
    dueDate: '2026-10-19',
    itemSummary: 'Karton Box Corrugated B-Flute 60x40x40 cm (3.000 Pcs)',
    totalTagihan: 20400000,
    jumlahTerbayar: 5400000,
    lastPaymentDate: '2026-10-15',
    notes: 'Baru masuk pembayaran cicilan pertama Rp 5,4 Jt, sisa janji transfer minggu ini'
  },
  {
    id: 'INV-002',
    noInvoice: 'INV/AKK/2026/09/0319',
    noSuratJalan: 'SJ-AKK-2609-214',
    customerName: 'UD SUMBER REJEKI JEMBER',
    contactPhone: '0811-3490-221',
    region: 'Jember',
    invoiceDate: '2026-09-18',
    dueDate: '2026-10-02',
    itemSummary: 'Karton Box Double Wall CB-Flute Export (2.500 Pcs) & Lakban OPP (25 Karton)',
    totalTagihan: 48500000,
    jumlahTerbayar: 0,
    notes: 'Sudah lewat jatuh tempo >25 hari, perlu penagihan prioritas tim Finance'
  },
  {
    id: 'INV-003',
    noInvoice: 'INV/AKK/2026/10/0165',
    noSuratJalan: 'SJ-AKK-2610-104',
    customerName: 'TK LIMA SEPULUH',
    contactPhone: '0813-5521-9088',
    region: 'Genteng - Banyuwangi',
    invoiceDate: '2026-10-12',
    dueDate: '2026-10-26',
    itemSummary: 'Box Kemasan Makanan Food Grade Ivory 22x22x8 cm (8.000 Pcs)',
    totalTagihan: 17600000,
    jumlahTerbayar: 10000000,
    lastPaymentDate: '2026-10-22',
    notes: 'Cicilan ke-1 Rp 10 Jt via BCA, sisa Rp 7,6 Jt menunggu giro cair'
  },
  {
    id: 'INV-004',
    noInvoice: 'INV/AKK/2026/10/0188',
    noSuratJalan: 'SJ-AKK-2610-129',
    customerName: 'TK PRATAMA SRONO',
    contactPhone: '0852-3310-4412',
    region: 'Srono - Banyuwangi',
    invoiceDate: '2026-10-20',
    dueDate: '2026-11-03',
    itemSummary: 'Box Die-Cut Pizza Kraft Coklat 25x25x5 cm (4.500 Pcs)',
    totalTagihan: 14850000,
    jumlahTerbayar: 0,
    notes: 'Tempo 14 hari berjalan, jatuh tempo awal November'
  },
  {
    id: 'INV-005',
    noInvoice: 'INV/AKK/2026/10/0194',
    noSuratJalan: 'SJ-AKK-2610-137',
    customerName: 'MITRA COLD STORAGE MUNCAR',
    contactPhone: '0812-8890-3341',
    region: 'Muncar - Banyuwangi',
    invoiceDate: '2026-10-08',
    dueDate: '2026-10-22',
    itemSummary: 'Karton Box Ekspor Waxed Tahan Lembab Cold Storage (3.200 Pcs)',
    totalTagihan: 46400000,
    jumlahTerbayar: 23200000,
    lastPaymentDate: '2026-10-10',
    notes: 'DP 50% lunas saat PO, sisa 50% jatuh tempo minggu lalu'
  },
  {
    id: 'INV-006',
    noInvoice: 'INV/AKK/2026/10/0205',
    noSuratJalan: 'SJ-AKK-2610-149',
    customerName: 'TOKO BERKAH JAYA ROGOJAMPI',
    contactPhone: '0821-4409-1182',
    region: 'Rogojampi - Banyuwangi',
    invoiceDate: '2026-10-24',
    dueDate: '2026-11-07',
    itemSummary: 'Plastik Kemasan HD/PE Grosir (120 Ball) & Stretch Film (40 Roll)',
    totalTagihan: 26800000,
    jumlahTerbayar: 0,
    notes: 'Faktur sudah diterima admin toko, belum jatuh tempo'
  },
  {
    id: 'INV-007',
    noInvoice: 'INV/AKK/2026/09/0290',
    noSuratJalan: 'SJ-AKK-2609-192',
    customerName: 'GROSIR KEMASAN DENPASAR',
    contactPhone: '0819-9901-7721',
    region: 'Denpasar - Bali',
    invoiceDate: '2026-09-10',
    dueDate: '2026-09-25',
    itemSummary: 'Paper Cup Hot 8 Oz Custom Print + Lid (150 Karton)',
    totalTagihan: 67500000,
    jumlahTerbayar: 30000000,
    lastPaymentDate: '2026-10-05',
    notes: 'Menunggak >30 hari untuk sisa pelunasan Rp 37,5 Jt'
  }
];

const LS_KEY_FINANCE_UNPAID = 'akk_finance_unpaid_invoices_v2';

function computeInvoiceAgingDays(dueDateStr: string): number {
  // Reference current operational date (or today)
  const today = new Date('2026-10-29T00:00:00');
  const due = new Date(`${dueDateStr}T00:00:00`);
  if (isNaN(due.getTime())) return 0;
  return Math.floor((today.getTime() - due.getTime()) / (1000 * 60 * 60 * 24));
}

function getInvoiceStatus(inv: CustomerUnpaidInvoice): 'Lunas' | 'Jatuh Tempo (Overdue)' | 'Cicilan / Sebagian' | 'Belum Jatuh Tempo' {
  const sisa = Math.max(0, inv.totalTagihan - inv.jumlahTerbayar);
  if (sisa <= 0) return 'Lunas';
  const overdueDays = computeInvoiceAgingDays(inv.dueDate);
  if (overdueDays > 0) return 'Jatuh Tempo (Overdue)';
  if (inv.jumlahTerbayar > 0) return 'Cicilan / Sebagian';
  return 'Belum Jatuh Tempo';
}

const FinanceDashboard: React.FC = () => {
  const [invoices, setInvoices] = useState<CustomerUnpaidInvoice[]>(() => {
    try {
      const saved = localStorage.getItem(LS_KEY_FINANCE_UNPAID);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {}
    return INITIAL_UNPAID_INVOICES;
  });

  useEffect(() => {
    try {
      localStorage.setItem(LS_KEY_FINANCE_UNPAID, JSON.stringify(invoices));
    } catch {}
  }, [invoices]);

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('UNPAID_ONLY');
  const [agingFilter, setAgingFilter] = useState<string>('ALL');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Modals
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [paymentModalInvoice, setPaymentModalInvoice] = useState<CustomerUnpaidInvoice | null>(null);
  const [paymentNominal, setPaymentNominal] = useState<number>(0);
  const [paymentNotes, setPaymentNotes] = useState<string>('');
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
    noInvoice: `INV/AKK/2026/10/${String(invoices.length + 210).padStart(4, '0')}`,
    noSuratJalan: `SJ-AKK-2610-${String(invoices.length + 155)}`,
    customerName: '',
    contactPhone: '',
    region: 'Banyuwangi Kota',
    invoiceDate: '2026-10-29',
    dueDate: '2026-11-12',
    itemSummary: '',
    totalTagihan: 15000000,
    jumlahTerbayar: 0,
    notes: ''
  });

  // Filtered Invoices
  const filteredInvoices = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
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

      return matchSearch && matchStatus && matchAging;
    });
  }, [invoices, searchQuery, statusFilter, agingFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredInvoices.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const paginatedInvoices = filteredInvoices.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  // KPI Metrics
  const unpaidInvoices = invoices.filter(inv => inv.totalTagihan - inv.jumlahTerbayar > 0);
  const totalUnpaidAmount = unpaidInvoices.reduce(
    (sum, inv) => sum + Math.max(0, inv.totalTagihan - inv.jumlahTerbayar),
    0
  );
  const overdueInvoices = unpaidInvoices.filter(inv => computeInvoiceAgingDays(inv.dueDate) > 0);
  const totalOverdueAmount = overdueInvoices.reduce(
    (sum, inv) => sum + Math.max(0, inv.totalTagihan - inv.jumlahTerbayar),
    0
  );
  const partialInvoices = unpaidInvoices.filter(inv => inv.jumlahTerbayar > 0);
  const totalCollectedFromUnpaid = invoices.reduce((sum, inv) => sum + inv.jumlahTerbayar, 0);

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

    const newItem: CustomerUnpaidInvoice = {
      id: `INV-${Date.now()}`,
      noInvoice: newInvForm.noInvoice.trim().toUpperCase(),
      noSuratJalan: newInvForm.noSuratJalan.trim().toUpperCase() || '-',
      customerName: newInvForm.customerName.trim().toUpperCase(),
      contactPhone: newInvForm.contactPhone.trim() || '-',
      region: newInvForm.region.trim() || 'Banyuwangi',
      invoiceDate: newInvForm.invoiceDate,
      dueDate: newInvForm.dueDate,
      itemSummary: newInvForm.itemSummary.trim() || 'Pesanan Kemasan Karton Box AKK',
      totalTagihan: Math.max(0, Number(newInvForm.totalTagihan) || 0),
      jumlahTerbayar: Math.max(0, Number(newInvForm.jumlahTerbayar) || 0),
      notes: newInvForm.notes.trim() || 'Tagihan pelanggan terdaftar'
    };

    setInvoices([newItem, ...invoices]);
    setIsAddModalOpen(false);
    setNewInvForm({
      ...newInvForm,
      noInvoice: `INV/AKK/2026/10/${String(invoices.length + 215).padStart(4, '0')}`,
      noSuratJalan: `SJ-AKK-2610-${String(invoices.length + 160)}`,
      customerName: '',
      contactPhone: '',
      itemSummary: '',
      notes: ''
    });
    setPopupModal({
      title: 'Data Tagihan Pelanggan Disimpan',
      message: `Tagihan ${newItem.noInvoice} atas nama "${newItem.customerName}" berhasil ditambahkan.`
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

  return (
    <div className="space-y-5">
      {/* Header Banner Finance & Tax */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-lg bg-rose-50 dark:bg-rose-500/15 border border-rose-200 dark:border-rose-500/30 text-rose-700 dark:text-rose-300 text-[10px] font-black uppercase tracking-wider">
              Departemen Finance &amp; Tax &bull; Kontrol Piutang
            </span>
          </div>
          <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-white tracking-tight">
            Monitoring Tagihan Pelanggan yang Belum Terlunasi (Accounts Receivable)
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Rekapitulasi faktur tagihan toko/mitra yang belum lunas, pemantauan umur piutang jatuh tempo (overdue), dan pencatatan cicilan/pelunasan.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={handleExportUnpaidExcel}
            className="px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Ekspor Excel Tagihan</span>
          </button>
          <button
            type="button"
            onClick={() => setIsAddModalOpen(true)}
            className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold flex items-center gap-1.5 transition cursor-pointer shadow-xs"
          >
            <Plus className="w-4 h-4" />
            <span>Tambah Tagihan Pelanggan</span>
          </button>
        </div>
      </div>

      {/* KPI Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-2xl shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Total Tagihan Belum Lunas
            </span>
            <DollarSign className="w-4 h-4 text-rose-500" />
          </div>
          <div className="text-xl font-black text-rose-600 dark:text-rose-400 font-mono">
            Rp {totalUnpaidAmount.toLocaleString('id-ID')}
          </div>
          <p className="text-[11px] text-slate-500 mt-1">
            Dari {unpaidInvoices.length} faktur pelanggan yang belum lunas
          </p>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-2xl shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Lewat Jatuh Tempo (Overdue)
            </span>
            <AlertCircle className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-xl font-black text-amber-600 dark:text-amber-400 font-mono">
            Rp {totalOverdueAmount.toLocaleString('id-ID')}
          </div>
          <p className="text-[11px] text-slate-500 mt-1">
            {overdueInvoices.length} faktur melewati tanggal jatuh tempo
          </p>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-2xl shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Tagihan Dicicil / Sebagian
            </span>
            <CreditCard className="w-4 h-4 text-blue-500" />
          </div>
          <div className="text-xl font-black text-slate-900 dark:text-white font-mono">
            {partialInvoices.length} Faktur
          </div>
          <p className="text-[11px] text-slate-500 mt-1">
            Sudah masuk pembayaran sebagian / DP
          </p>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-2xl shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Pembayaran Masuk Terkumpul
            </span>
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-xl font-black text-emerald-600 dark:text-emerald-400 font-mono">
            Rp {totalCollectedFromUnpaid.toLocaleString('id-ID')}
          </div>
          <p className="text-[11px] text-slate-500 mt-1">
            Total cicilan &amp; pelunasan yang telah diterima
          </p>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => {
              setSearchQuery(e.target.value);
              setPage(1);
            }}
            placeholder="Cari No. Invoice, Nama Pelanggan / Toko, Wilayah, atau Item Pesanan..."
            className="w-full pl-10 pr-4 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-amber-500"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            value={statusFilter}
            onChange={e => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
            className="px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs font-bold text-slate-800 dark:text-slate-200 cursor-pointer"
          >
            <option value="UNPAID_ONLY">Semua Belum Terlunasi ({unpaidInvoices.length})</option>
            <option value="Jatuh Tempo (Overdue)">Jatuh Tempo / Menunggak ({overdueInvoices.length})</option>
            <option value="Cicilan / Sebagian">Cicilan / Bayar Sebagian</option>
            <option value="Belum Jatuh Tempo">Belum Jatuh Tempo</option>
            <option value="Lunas">Sudah Lunas (Arsip)</option>
            <option value="ALL">Tampilkan Semua Faktur ({invoices.length})</option>
          </select>

          <select
            value={agingFilter}
            onChange={e => {
              setAgingFilter(e.target.value);
              setPage(1);
            }}
            className="px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs font-bold text-slate-800 dark:text-slate-200 cursor-pointer"
          >
            <option value="ALL">Semua Umur Piutang</option>
            <option value="NOT_DUE">Belum Jatuh Tempo</option>
            <option value="OVERDUE_1_14">Terlambat 1 &ndash; 14 Hari</option>
            <option value="OVERDUE_15_30">Terlambat 15 &ndash; 30 Hari</option>
            <option value="OVERDUE_30_PLUS">Menunggak &gt; 30 Hari</option>
          </select>

          <select
            value={pageSize}
            onChange={e => {
              setPageSize(Number(e.target.value));
              setPage(1);
            }}
            className="px-2.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs font-bold text-slate-800 dark:text-slate-200 cursor-pointer"
          >
            <option value={5}>5 / Hal</option>
            <option value={10}>10 / Hal</option>
            <option value={20}>20 / Hal</option>
          </select>
        </div>
      </div>

      {/* Table of Unpaid Customer Invoices */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-xs">
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-black text-slate-900 dark:text-white">
              Daftar Tagihan Pelanggan yang Belum Terlunasi
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Klik tombol <strong>Catat Bayar / Cicil</strong> pada baris pelanggan untuk menginput pembayaran masuk atau pelunasan faktur.
            </p>
          </div>
          <div className="text-xs font-bold text-slate-600 dark:text-slate-300">
            Sisa Piutang Terfilter:{' '}
            <span className="font-mono font-black text-rose-600 dark:text-rose-400">
              Rp{' '}
              {filteredInvoices
                .reduce((acc, inv) => acc + Math.max(0, inv.totalTagihan - inv.jumlahTerbayar), 0)
                .toLocaleString('id-ID')}
            </span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-50 dark:bg-slate-950 text-slate-600 dark:text-slate-400 uppercase font-bold text-[10px] border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th className="py-3 px-4">No. Invoice &amp; SJ</th>
                <th className="py-3 px-4">Nama Pelanggan / Toko</th>
                <th className="py-3 px-4">Rincian Pesanan</th>
                <th className="py-3 px-4">Jatuh Tempo &amp; Umur</th>
                <th className="py-3 px-4 text-right">Total Tagihan</th>
                <th className="py-3 px-4 text-right">Sudah Dibayar</th>
                <th className="py-3 px-4 text-right">Sisa Belum Lunas</th>
                <th className="py-3 px-4">Status Tagihan</th>
                <th className="py-3 px-4 text-right">Aksi Penagihan</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800 text-slate-800 dark:text-slate-200">
              {paginatedInvoices.length > 0 ? (
                paginatedInvoices.map(inv => {
                  const sisa = Math.max(0, inv.totalTagihan - inv.jumlahTerbayar);
                  const st = getInvoiceStatus(inv);
                  const agingDays = computeInvoiceAgingDays(inv.dueDate);

                  return (
                    <tr key={inv.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition">
                      <td className="py-3 px-4">
                        <div className="font-mono font-bold text-indigo-600 dark:text-indigo-400">
                          {inv.noInvoice}
                        </div>
                        <div className="text-[10px] text-slate-500 font-mono mt-0.5">
                          SJ: {inv.noSuratJalan} &bull; Tgl: {inv.invoiceDate}
                        </div>
                      </td>

                      <td className="py-3 px-4">
                        <div className="font-bold text-slate-900 dark:text-white">{inv.customerName}</div>
                        <div className="text-[10px] text-slate-500 flex items-center gap-1 mt-0.5">
                          <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                          <span>{inv.region} &bull; {inv.contactPhone}</span>
                        </div>
                      </td>

                      <td className="py-3 px-4 max-w-[230px]">
                        <div className="font-medium text-slate-800 dark:text-slate-200 leading-snug">
                          {inv.itemSummary}
                        </div>
                        {inv.notes && (
                          <div className="text-[10px] text-slate-500 italic mt-0.5 line-clamp-2" title={inv.notes}>
                            {inv.notes}
                          </div>
                        )}
                      </td>

                      <td className="py-3 px-4">
                        <div className="font-mono font-bold text-slate-900 dark:text-white">
                          {inv.dueDate}
                        </div>
                        {sisa > 0 ? (
                          agingDays > 0 ? (
                            <span className="inline-block mt-0.5 px-2 py-0.5 rounded bg-rose-500/15 text-rose-600 dark:text-rose-400 font-mono font-black text-[10px]">
                              Lewat {agingDays} Hari
                            </span>
                          ) : (
                            <span className="inline-block mt-0.5 px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-mono font-bold text-[10px]">
                              {Math.abs(agingDays)} Hari Lagi
                            </span>
                          )
                        ) : (
                          <span className="text-[10px] text-emerald-500 font-bold">Selesai</span>
                        )}
                      </td>

                      <td className="py-3 px-4 text-right font-mono font-bold text-slate-700 dark:text-slate-300">
                        Rp {inv.totalTagihan.toLocaleString('id-ID')}
                      </td>

                      <td className="py-3 px-4 text-right font-mono font-bold text-emerald-600 dark:text-emerald-400">
                        Rp {inv.jumlahTerbayar.toLocaleString('id-ID')}
                        {inv.lastPaymentDate && (
                          <div className="text-[9px] text-slate-500 font-normal">
                            Tgl: {inv.lastPaymentDate}
                          </div>
                        )}
                      </td>

                      <td className="py-3 px-4 text-right font-mono font-black">
                        {sisa > 0 ? (
                          <span className="text-rose-600 dark:text-rose-400 text-xs">
                            Rp {sisa.toLocaleString('id-ID')}
                          </span>
                        ) : (
                          <span className="text-emerald-600 dark:text-emerald-400">Rp 0</span>
                        )}
                      </td>

                      <td className="py-3 px-4">
                        <span
                          className={`px-2.5 py-1 rounded-lg font-bold text-[10px] inline-block border ${
                            st === 'Lunas'
                              ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30'
                              : st === 'Jatuh Tempo (Overdue)'
                              ? 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30'
                              : st === 'Cicilan / Sebagian'
                              ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30'
                              : 'bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/30'
                          }`}
                        >
                          {st}
                        </span>
                      </td>

                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {sisa > 0 && (
                            <button
                              type="button"
                              onClick={() => handleOpenPaymentModal(inv)}
                              className="px-2.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[11px] transition cursor-pointer shadow-xs whitespace-nowrap"
                            >
                              Catat Bayar / Cicil
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => handleDeleteInvoice(inv.id)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-500/10 transition cursor-pointer"
                            title="Hapus Data Tagihan"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-slate-400 text-xs">
                    Tidak ada data tagihan pelanggan yang sesuai dengan filter pencarian.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="p-4 border-t border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <div className="text-slate-500 dark:text-slate-400">
            Menampilkan{' '}
            <strong className="text-slate-900 dark:text-white">
              {filteredInvoices.length === 0 ? 0 : (currentPage - 1) * pageSize + 1}
            </strong>{' '}
            &ndash;{' '}
            <strong className="text-slate-900 dark:text-white">
              {Math.min(currentPage * pageSize, filteredInvoices.length)}
            </strong>{' '}
            dari <strong className="text-slate-900 dark:text-white">{filteredInvoices.length}</strong> faktur tagihan
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              disabled={currentPage <= 1}
              onClick={() => setPage(p => Math.max(1, p - 1))}
              className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-700 dark:text-slate-300 font-bold disabled:opacity-40 cursor-pointer flex items-center gap-1"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              <span>Sebelumnya</span>
            </button>
            <button
              type="button"
              disabled={currentPage >= totalPages}
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-700 dark:text-slate-300 font-bold disabled:opacity-40 cursor-pointer flex items-center gap-1"
            >
              <span>Selanjutnya</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

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
                    Total Nilai Tagihan (Rp) *
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
                    DP / Sudah Dibayar Awal (Rp)
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

              <div>
                <label className="block font-bold text-slate-600 dark:text-slate-400 mb-1">
                  Catatan Penagihan
                </label>
                <input
                  type="text"
                  placeholder="Contoh: Jatuh tempo 14 hari setelah barang diterima..."
                  value={newInvForm.notes}
                  onChange={e => setNewInvForm({ ...newInvForm, notes: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white"
                />
              </div>

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
}> = ({ dashboardType, initialHrTab }) => {
  const user = logisticsStore.getCurrentUser();
  
  // Use dashboardType prop if provided, otherwise fallback to user's department role
  const typeToRender = dashboardType || (user.role === 'hr_admin' ? 'hr' : user.role === 'warehouse_admin' ? 'warehouse' : user.role === 'finance_tax_admin' ? 'finance' : user.role === 'purchasing_admin' ? 'purchasing' : 'hr');

  const renderDashboard = () => {
    switch (typeToRender) {
      case 'hr': return <HRDashboard activeHrTab={initialHrTab} />;
      case 'warehouse': return <WarehouseDashboard />;
      case 'finance': return <FinanceDashboard />;
      case 'purchasing': return <PurchasingDashboard />;
      default: return <div className="text-slate-400">Dashboard tidak tersedia untuk role ini.</div>;
    }
  };

  return (
    <div className="space-y-6">
      {typeToRender !== 'warehouse' && typeToRender !== 'finance' && (
        <h2 className="text-lg font-black text-slate-900 dark:text-white">
          Dashboard {typeToRender === 'hr' ? 'Human Resources (HR, GA & Training)' : 'Purchasing'}
        </h2>
      )}
      {renderDashboard()}
    </div>
  );
};

