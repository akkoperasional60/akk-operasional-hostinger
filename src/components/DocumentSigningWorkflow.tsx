import React, { useState } from 'react';
import { 
  FileText, 
  CheckCircle2, 
  ShieldCheck, 
  Truck, 
  User, 
  MapPin, 
  Calendar, 
  PenTool, 
  X, 
  ArrowRight,
  Building,
  Lock,
  QrCode
} from 'lucide-react';
import { Schedule, OutboundWaybill, UserRole } from '../types';
import { logisticsStore } from '../services/store';
import { driverWaybillService } from '../services/driverWaybillService';
import { SignaturePad } from './SignaturePad';
import { useToast } from '../context/ToastContext';

interface DocumentSigningWorkflowProps {
  scheduleId?: string;
  isOpen: boolean;
  onClose: () => void;
  onSignedComplete?: (waybill: OutboundWaybill) => void;
}

export const DocumentSigningWorkflow: React.FC<DocumentSigningWorkflowProps> = ({
  scheduleId,
  isOpen,
  onClose,
  onSignedComplete
}) => {
  const { addNotification } = useToast();

  // Fetch active schedules or specific schedule
  const schedules = logisticsStore.getSchedules();
  const selectedSch = scheduleId 
    ? schedules.find(s => s.id === scheduleId) 
    : schedules[0];

  const currentUser = logisticsStore.getCurrentUser();
  const [targetScheduleId, setTargetScheduleId] = useState<string>(selectedSch?.id || schedules[0]?.id || '');
  const activeSchedule = schedules.find(s => s.id === targetScheduleId) || selectedSch;

  // Generate or get waybill for this schedule
  const [waybill, setWaybill] = useState<OutboundWaybill | null>(() => {
    if (!activeSchedule) return null;
    return driverWaybillService.generateWaybillFromSchedule(activeSchedule);
  });

  // Active signing role selector (SPV, Operasional, Security, Driver)
  const [signingRoleKey, setSigningRoleKey] = useState<'preparedBy' | 'acknowledgedBy' | 'security' | 'driver'>(() => {
    if (currentUser.role === 'super_admin' || currentUser.role === 'operasional') return 'acknowledgedBy';
    if (currentUser.role === 'security') return 'security';
    if (currentUser.role === 'driver' || currentUser.role === 'crew_helper') return 'driver';
    return 'preparedBy'; // default SPV Logistik
  });

  const [isSigningModalOpen, setIsSigningModalOpen] = useState(false);

  // Update waybill when schedule changes
  const handleSelectSchedule = (sId: string) => {
    setTargetScheduleId(sId);
    const sch = schedules.find(s => s.id === sId);
    if (sch) {
      const wb = driverWaybillService.generateWaybillFromSchedule(sch);
      setWaybill(wb);
    }
  };

  if (!isOpen || !activeSchedule || !waybill) return null;

  const roleMeta: Record<string, { label: string; name: string; title: string }> = {
    preparedBy: {
      label: 'Disiapkan (SPV Logistik)',
      name: waybill.preparedByName || 'MUHAMMAD SYAIFUL BAHRI',
      title: 'SPV Logistik & Supply Chain'
    },
    acknowledgedBy: {
      label: 'Mengetahui (Operasional)',
      name: waybill.acknowledgedByName || 'Bayu Novianto Dimas Permana',
      title: 'Manajer Operasional / Leader'
    },
    security: {
      label: 'Security (Pos Gerbang DC)',
      name: waybill.securityOfficerName || 'Hairul Rozikin (Security)',
      title: 'Petugas Pos Satpam 24 Jam'
    },
    driver: {
      label: 'Dibawa (Driver / Helper)',
      name: `${waybill.crew.driverName}${waybill.crew.helperName ? ` / ${waybill.crew.helperName}` : ''}`,
      title: 'Kru Armada Pengiriman'
    }
  };

  const handleSaveSignature = (signatureDataUrl: string) => {
    const now = new Date();
    const timeFormatted = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')} WIB`;
    const dateFormatted = now.toLocaleDateString('id-ID');
    const timestampStr = `${dateFormatted} ${timeFormatted}`;

    const updatedWb: OutboundWaybill = { ...waybill };

    if (signingRoleKey === 'preparedBy') {
      updatedWb.preparedBySigned = true;
      updatedWb.preparedBySignedAt = timestampStr;
      updatedWb.preparedBySignatureSvg = signatureDataUrl;
    } else if (signingRoleKey === 'acknowledgedBy') {
      updatedWb.acknowledgedBySigned = true;
      updatedWb.acknowledgedBySignedAt = timestampStr;
      updatedWb.acknowledgedBySignatureSvg = signatureDataUrl;
    } else if (signingRoleKey === 'security') {
      updatedWb.securitySigned = true;
      updatedWb.securitySignedAt = timestampStr;
      updatedWb.securitySignatureSvg = signatureDataUrl;
    } else if (signingRoleKey === 'driver') {
      updatedWb.driverSigned = true;
      updatedWb.driverSignedAt = timestampStr;
      updatedWb.driverSignatureSvg = signatureDataUrl;
    }

    setWaybill(updatedWb);
    driverWaybillService.saveWaybill(updatedWb);
    if (onSignedComplete) onSignedComplete(updatedWb);

    addNotification(
      'delivery',
      'Tanda Tangan Digital Tersimpan',
      `Dokumen Surat Jalan ${updatedWb.waybillNumber} berhasil ditandatangani oleh ${roleMeta[signingRoleKey].label} dan disinkronkan ke database.`
    );
    setIsSigningModalOpen(false);
  };

  return (
    <div className="fixed inset-0 z-60 bg-black/80 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-3xl bg-slate-900 border border-slate-800 rounded-2xl flex flex-col max-h-[95vh] shadow-2xl overflow-hidden">
        
        {/* Header */}
        <div className="p-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-500 to-amber-400 text-slate-950 flex items-center justify-center shadow-lg font-bold">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-black text-white flex items-center gap-2">
                <span>Workflow Tanda Tangan Digital Dokumen</span>
                <span className="px-2 py-0.5 rounded text-[10px] font-extrabold bg-blue-500/20 text-blue-300 border border-blue-500/30 font-mono">
                  {waybill.waybillNumber}
                </span>
              </h3>
              <p className="text-[11px] text-slate-400">
                Otorisasi berlapis 4 peran (SPV, Operasional, Security, Driver) terintegrasi Hostinger MySQL
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5 text-xs">
          
          {/* Schedule Picker Bar */}
          <div className="bg-slate-950 border border-slate-800 rounded-xl p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                Pilih Jadwal Pengiriman / Surat Jalan:
              </label>
              <select
                value={targetScheduleId}
                onChange={(e) => handleSelectSchedule(e.target.value)}
                className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white font-semibold focus:outline-none focus:border-amber-500 cursor-pointer w-full sm:w-96"
              >
                {schedules.map(sch => (
                  <option key={sch.id} value={sch.id}>
                    {sch.trackingNumber} &bull; {sch.fleet?.plateNumber || 'Armada'} &bull; {sch.areaName || sch.store?.storeName} [{sch.status}]
                  </option>
                ))}
              </select>
            </div>

            <div className="text-right">
              <div className="text-[10px] text-slate-400">Status Resi Saat Ini:</div>
              <div className="font-bold text-amber-400 text-xs mt-0.5">{waybill.statusLabel}</div>
            </div>
          </div>

          {/* Delivery Summary Card */}
          <div className="bg-slate-950/70 border border-slate-800 rounded-2xl p-4 grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-1">
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <Truck className="w-3.5 h-3.5 text-amber-400" />
                <span>Armada &amp; Kru</span>
              </div>
              <div className="font-bold text-white text-sm">
                {waybill.fleet.plateNumber} <span className="text-amber-400">[{waybill.fleet.initialCode}]</span>
              </div>
              <div className="text-slate-400 text-[11px]">
                Driver: <strong className="text-slate-200">{waybill.crew.driverName}</strong>
              </div>
            </div>

            <div className="space-y-1">
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-rose-400" />
                <span>Tujuan Pengiriman</span>
              </div>
              <div className="font-bold text-white text-sm truncate">
                {waybill.destination.storeName}
              </div>
              <div className="text-slate-400 text-[11px] truncate">
                {waybill.destination.address} ({waybill.destination.city})
              </div>
            </div>

            <div className="space-y-1">
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-blue-400" />
                <span>Muatan &amp; Segel</span>
              </div>
              <div className="font-bold text-white text-sm">
                {waybill.totalKoli} Koli ({(waybill.totalWeightKg / 1000).toFixed(1)} Ton)
              </div>
              <div className="text-slate-400 text-[11px] font-mono">
                Segel: <span className="text-emerald-400">{waybill.securitySealNumber}</span>
              </div>
            </div>
          </div>

          {/* Signing Role Selector & Action Card */}
          <div className="bg-gradient-to-br from-slate-950 to-slate-900 border border-slate-800 rounded-2xl p-4 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h4 className="font-bold text-white text-xs uppercase tracking-wider flex items-center gap-2">
                  <PenTool className="w-4 h-4 text-amber-400" />
                  <span>Pilih Peran Tanda Tangan Dokumen</span>
                </h4>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Klik peran di bawah untuk membubuhkan tanda tangan digital pada kolom terkait.
                </p>
              </div>

              <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800 flex-wrap">
                <button
                  type="button"
                  onClick={() => setSigningRoleKey('preparedBy')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                    signingRoleKey === 'preparedBy' ? 'bg-blue-600 text-white shadow' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  1. SPV Logistik
                </button>
                <button
                  type="button"
                  onClick={() => setSigningRoleKey('acknowledgedBy')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                    signingRoleKey === 'acknowledgedBy' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  2. Operasional
                </button>
                <button
                  type="button"
                  onClick={() => setSigningRoleKey('security')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                    signingRoleKey === 'security' ? 'bg-emerald-600 text-white shadow' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  3. Security
                </button>
                <button
                  type="button"
                  onClick={() => setSigningRoleKey('driver')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                    signingRoleKey === 'driver' ? 'bg-amber-600 text-slate-950 shadow font-black' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  4. Driver/Helper
                </button>
              </div>
            </div>

            {/* Selected Role Status & Trigger */}
            <div className="bg-slate-950 border border-slate-800/80 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="text-[10px] font-bold uppercase tracking-wider text-amber-400">
                  Peran Aktif Terpilih: {roleMeta[signingRoleKey].label}
                </div>
                <div className="text-sm font-bold text-white">
                  {roleMeta[signingRoleKey].name} <span className="text-slate-400 font-normal text-xs">&bull; {roleMeta[signingRoleKey].title}</span>
                </div>
                <div className="text-[11px] text-slate-400">
                  Status: {
                    signingRoleKey === 'preparedBy' ? (waybill.preparedBySigned !== false ? `Tervalidasi pada ${waybill.preparedBySignedAt}` : 'Belum ditandatangani') :
                    signingRoleKey === 'acknowledgedBy' ? (waybill.acknowledgedBySigned !== false ? `Tervalidasi pada ${waybill.acknowledgedBySignedAt}` : 'Belum ditandatangani') :
                    signingRoleKey === 'security' ? (waybill.securitySigned !== false ? `Tervalidasi pada ${waybill.securitySignedAt}` : 'Belum ditandatangani') :
                    (waybill.driverSigned !== false ? `Tervalidasi pada ${waybill.driverSignedAt}` : 'Belum ditandatangani')
                  }
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsSigningModalOpen(true)}
                className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs flex items-center gap-2 shadow-lg shadow-amber-500/20 transition cursor-pointer active:scale-95 shrink-0"
              >
                <PenTool className="w-4 h-4" />
                <span>Buka Kanvas Tanda Tangan ({roleMeta[signingRoleKey].label})</span>
              </button>
            </div>

            {/* 4 Signatories Preview Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
              
              {/* 1. SPV */}
              <div className={`p-3 rounded-xl border flex flex-col justify-between ${waybill.preparedBySigned !== false ? 'bg-blue-950/20 border-blue-500/40 text-blue-200' : 'bg-slate-950 border-slate-800 text-slate-400'}`}>
                <div>
                  <div className="text-[10px] font-bold text-slate-300">1. SPV Logistik</div>
                  <div className="font-bold text-white text-xs mt-1 truncate">{waybill.preparedByName || 'MUHAMMAD SYAIFUL BAHRI'}</div>
                </div>
                <div className="mt-3 pt-2 border-t border-slate-800 flex items-center justify-between text-[10px]">
                  {waybill.preparedBySigned !== false ? (
                    <span className="text-emerald-400 font-bold flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" /> Signed
                    </span>
                  ) : (
                    <span className="text-amber-400 italic">Pending</span>
                  )}
                  <span className="font-mono text-[9px] text-slate-400">{waybill.preparedBySignedAt?.slice(0, 10) || '16/10/2026'}</span>
                </div>
              </div>

              {/* 2. Operasional */}
              <div className={`p-3 rounded-xl border flex flex-col justify-between ${waybill.acknowledgedBySigned !== false ? 'bg-indigo-950/20 border-indigo-500/40 text-indigo-200' : 'bg-slate-950 border-slate-800 text-slate-400'}`}>
                <div>
                  <div className="text-[10px] font-bold text-slate-300">2. Operasional</div>
                  <div className="font-bold text-white text-xs mt-1 truncate">{waybill.acknowledgedByName || 'Bayu Novianto Dimas Permana'}</div>
                </div>
                <div className="mt-3 pt-2 border-t border-slate-800 flex items-center justify-between text-[10px]">
                  {waybill.acknowledgedBySigned !== false ? (
                    <span className="text-emerald-400 font-bold flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" /> Signed
                    </span>
                  ) : (
                    <span className="text-amber-400 italic">Pending</span>
                  )}
                  <span className="font-mono text-[9px] text-slate-400">{waybill.acknowledgedBySignedAt?.slice(0, 10) || '16/10/2026'}</span>
                </div>
              </div>

              {/* 3. Security */}
              <div className={`p-3 rounded-xl border flex flex-col justify-between ${waybill.securitySigned !== false ? 'bg-emerald-950/20 border-emerald-500/40 text-emerald-200' : 'bg-slate-950 border-slate-800 text-slate-400'}`}>
                <div>
                  <div className="text-[10px] font-bold text-slate-300">3. Security</div>
                  <div className="font-bold text-white text-xs mt-1 truncate">{waybill.securityOfficerName || 'Hairul Rozikin'}</div>
                </div>
                <div className="mt-3 pt-2 border-t border-slate-800 flex items-center justify-between text-[10px]">
                  {waybill.securitySigned !== false ? (
                    <span className="text-emerald-400 font-bold flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" /> Signed
                    </span>
                  ) : (
                    <span className="text-amber-400 italic">Pending</span>
                  )}
                  <span className="font-mono text-[9px] text-slate-400">{waybill.securitySignedAt?.slice(0, 10) || '16/10/2026'}</span>
                </div>
              </div>

              {/* 4. Driver */}
              <div className={`p-3 rounded-xl border flex flex-col justify-between ${waybill.driverSigned !== false ? 'bg-amber-950/20 border-amber-500/40 text-amber-200' : 'bg-slate-950 border-slate-800 text-slate-400'}`}>
                <div>
                  <div className="text-[10px] font-bold text-slate-300">4. Driver / Helper</div>
                  <div className="font-bold text-white text-xs mt-1 truncate">{waybill.crew.driverName}</div>
                </div>
                <div className="mt-3 pt-2 border-t border-slate-800 flex items-center justify-between text-[10px]">
                  {waybill.driverSigned !== false ? (
                    <span className="text-emerald-400 font-bold flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" /> Signed
                    </span>
                  ) : (
                    <span className="text-amber-400 italic">Pending</span>
                  )}
                  <span className="font-mono text-[9px] text-slate-400">{waybill.driverSignedAt?.slice(0, 10) || '16/10/2026'}</span>
                </div>
              </div>

            </div>

          </div>

        </div>

        {/* Footer */}
        <div className="p-3.5 px-5 bg-slate-950 border-t border-slate-800 flex items-center justify-between">
          <div className="text-[11px] text-slate-400 flex items-center gap-1.5">
            <Lock className="w-3.5 h-3.5 text-emerald-400" />
            <span>Sinkronisasi Otomatis Hostinger MySQL &amp; LocalStorage</span>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs transition cursor-pointer"
          >
            Selesai &amp; Tutup
          </button>
        </div>

      </div>

      {/* Signature Pad Modal Component */}
      {isSigningModalOpen && (
        <SignaturePad
          title={`Tanda Tangan Digital • ${roleMeta[signingRoleKey].label}`}
          signerName={roleMeta[signingRoleKey].name}
          signerRole={roleMeta[signingRoleKey].title}
          onSave={handleSaveSignature}
          onClose={() => setIsSigningModalOpen(false)}
        />
      )}
    </div>
  );
};
