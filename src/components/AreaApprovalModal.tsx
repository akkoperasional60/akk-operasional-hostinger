import React from 'react';
import { AlertTriangle, ShieldAlert, History, MapPin, Truck, Calendar, User, Clock, ArrowLeft } from 'lucide-react';
import { CrewDeliveryHistory } from '../types';

interface AreaApprovalModalProps {
  isOpen: boolean;
  onClose: () => void;
  crewName: string;
  crewId: string;
  areaName: string;
  storeName: string;
  plateNumber: string;
  tripCount: number;
  threshold: number;
  recentTrips: CrewDeliveryHistory[];
  onApprove?: (notes: string) => void;
  onRejectAndPickOtherDriver?: () => void;
}

export const AreaApprovalModal: React.FC<AreaApprovalModalProps> = ({
  isOpen,
  onClose,
  crewName,
  areaName,
  storeName,
  plateNumber,
  tripCount,
  threshold,
  recentTrips
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 animate-fadeIn">
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
        {/* Header Alert — High contrast & clean without top-right X button */}
        <div className="bg-slate-950 border-b border-slate-800 p-5 flex items-start justify-between">
          <div className="flex items-start gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0 border border-amber-500/40">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider bg-amber-500/20 text-amber-300 border border-amber-500/30 mb-1.5">
                <AlertTriangle className="w-3 h-3" />
                <span>Rincian Riwayat &amp; Batas Rotasi Wilayah</span>
              </div>
              <h3 className="text-base font-extrabold text-white tracking-tight">
                Rincian Pengiriman &amp; Otorisasi Area
              </h3>
              <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                Kru <strong className="text-white font-bold">{crewName}</strong> telah melakukan{' '}
                <span className="text-amber-400 font-bold underline">{tripCount} kali pengiriman</span> ke{' '}
                <strong className="text-white font-bold">{areaName}</strong> (Batas SOP: {threshold} kali).
              </p>
            </div>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-5 space-y-4 overflow-y-auto text-xs text-slate-300">
          {/* Policy Context Box */}
          <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 leading-relaxed space-y-1">
            <div className="font-bold flex items-center gap-1.5 text-amber-300">
              <Clock className="w-3.5 h-3.5 shrink-0" />
              <span>Kebijakan Rotasi Pengemudi &amp; Pencegahan Kelelahan (Fatigue Management)</span>
            </div>
            <p className="text-[11px] text-slate-200">
              Sesuai standar operasional Kemenhub dan tata kelola keselamatan logistik B2B, pengemudi yang telah mencapai akumulasi <strong className="text-white font-bold">{threshold} kali pengiriman</strong> berturut-turut pada area atau rute lintas pulau yang sama memerlukan <strong className="text-white font-bold">persetujuan resmi Dispatcher / Manajer Logistik</strong> sebelum penugasan berikutnya disahkan.
            </p>
          </div>

          {/* Current Assignment Summary — Only Pengemudi & Tujuan Pengiriman */}
          <div className="bg-slate-950 rounded-xl p-3.5 border border-slate-800 grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-400 block">Pengemudi</span>
              <div className="font-bold text-white text-xs mt-1 flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                <span>{crewName}</span>
              </div>
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-400 block">Tujuan Pengiriman</span>
              <div className="font-bold text-white text-xs mt-1 truncate flex items-center gap-1.5" title={storeName || areaName}>
                <MapPin className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span>{storeName || areaName}</span>
              </div>
            </div>
          </div>

          {/* History of Past Trips in this Area — Only Nomor SJ, Tanggal, & Armada */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-bold text-white flex items-center gap-1.5">
                <History className="w-3.5 h-3.5 text-blue-400" />
                <span>Histori {tripCount} Pengiriman Terakhir Kru Ini di {areaName}:</span>
              </span>
              <span className="text-[10px] text-slate-400 font-mono">Log Terverifikasi</span>
            </div>

            <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1 custom-scrollbar">
              {recentTrips.length > 0 ? (
                recentTrips.map((trip, idx) => {
                  const armadaLabel =
                    (trip as any).initialCode ||
                    trip.plateNumber ||
                    (trip as any).vehiclePlate ||
                    plateNumber ||
                    '-';
                  const formattedDate = new Date(trip.completionDate).toLocaleDateString('id-ID', {
                    day: '2-digit',
                    month: 'short',
                    year: 'numeric'
                  });

                  return (
                    <div
                      key={trip.id || idx}
                      className="p-2.5 rounded-lg bg-slate-950 border border-slate-800 flex items-center justify-between gap-3 text-xs"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className="w-5 h-5 rounded-full bg-slate-800 text-slate-200 font-mono font-bold text-[10px] flex items-center justify-center shrink-0">
                          #{idx + 1}
                        </span>
                        <span className="font-mono font-bold text-white truncate">
                          {trip.trackingNumber || `SJ-${idx + 1}`}
                        </span>
                      </div>

                      <div className="flex items-center gap-2.5 shrink-0">
                        <span className="inline-flex items-center gap-1 text-[11px] text-slate-300 font-medium">
                          <Calendar className="w-3 h-3 text-blue-400" />
                          {formattedDate}
                        </span>
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-amber-500/15 border border-amber-500/30 text-amber-300 font-mono font-bold text-[10px]">
                          <Truck className="w-3 h-3" />
                          {armadaLabel}
                        </span>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="p-3 text-center text-slate-400 italic bg-slate-950 rounded-lg border border-slate-800">
                  Belum ada riwayat tercatat pada periode ini.
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Modal Footer Actions — Only Kembali button */}
        <div className="bg-slate-950 px-5 py-3.5 border-t border-slate-800 flex items-center justify-end">
          <button
            type="button"
            onClick={onClose}
            className="w-full sm:w-auto px-5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 border border-slate-700 transition cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Kembali</span>
          </button>
        </div>
      </div>
    </div>
  );
};
