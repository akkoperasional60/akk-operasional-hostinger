import React, { useState, useEffect } from 'react';
import { logisticsStore } from '../services/store';
import { 
  Users, Building2, Database, ShoppingBag, TrendingUp, AlertCircle, 
  CheckCircle2, UserCheck, ShieldAlert, Brush, Award, Video, Play,
  Check, Clock, Search, Plus, Calendar, ShieldCheck, FileText, ExternalLink,
  Truck, ArrowRight, X
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

const FinanceDashboard = () => (
  <div className="space-y-6">
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      <MetricCard title="Invoice Pending" value="Rp 450 Jt" subtext="Jatuh tempo minggu depan" icon={Database} color="text-rose-400" />
      <MetricCard title="Pajak Bulan Ini" value="Rp 85 Jt" subtext="Sudah dilaporkan" icon={CheckCircle2} color="text-emerald-400" />
      <MetricCard title="Realisasi Budget" value="78%" subtext="Dari alokasi tahunan" icon={TrendingUp} color="text-indigo-400" />
    </div>
    <TeamCalendar role="finance_tax_admin" />
  </div>
);

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
      {typeToRender !== 'warehouse' && (
        <h2 className="text-lg font-black text-slate-900 dark:text-white">
          Dashboard {typeToRender === 'hr' ? 'Human Resources (HR, GA & Training)' : typeToRender === 'finance' ? 'Finance' : 'Purchasing'}
        </h2>
      )}
      {renderDashboard()}
    </div>
  );
};
