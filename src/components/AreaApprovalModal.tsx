import React, { useState } from 'react';
import { AlertTriangle, CheckCircle2, XCircle, ShieldAlert, History, MapPin, Truck, Calendar, User, Clock } from 'lucide-react';
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
  onApprove: (notes: string) => void;
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
  recentTrips,
  onApprove,
  onRejectAndPickOtherDriver
}) => {
  const [approvalNotes, setApprovalNotes] = useState(
    'Telah diverifikasi kondisi fisik supir prima & kelaikan armada. Diberikan dispensasi penugasan wilayah dengan pengawalan SOP istirahat berkala.'
  );

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4 animate-fadeIn">
      <div className="bg-slate-900 border border-amber-500/40 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
        {/* Header Alert */}
        <div className="bg-gradient-to-r from-amber-500/20 via-slate-900 to-slate-900 border-b border-amber-500/30 p-5 flex items-start justify-between">
          <div className="flex items-start gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0 border border-amber-500/40">
              <ShieldAlert className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-amber-500/20 text-amber-300 border border-amber-500/30 mb-1">
                <AlertTriangle className="w-3 h-3" />
                <span>Persetujuan Khusus: Batas Rotasi Wilayah Tercapai</span>
              </div>
              <h3 className="text-base font-bold text-white tracking-tight">
                Konfirmasi Otorisasi Pengiriman Berulang di 1 Area
              </h3>
              <p className="text-xs text-slate-300 mt-1">
                Kru <strong className="text-white">{crewName}</strong> telah melakukan{' '}
                <span className="text-amber-400 font-bold underline">{tripCount} kali pengiriman</span> ke{' '}
                <strong className="text-white">{areaName}</strong> (Batas SOP: {threshold} kali).
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white font-bold text-lg p-1"
          >
            &times;
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-5 overflow-y-auto text-xs text-slate-300">
          {/* Policy Context Box */}
          <div className="p-3.5 rounded-xl bg-amber-950/30 border border-amber-500/20 text-amber-200/90 leading-relaxed space-y-1">
            <div className="font-bold flex items-center gap-1.5 text-amber-300">
              <Clock className="w-3.5 h-3.5" />
              <span>Kebijakan Rotasi Pengemudi & Pencegahan Kelelahan (Fatigue Management)</span>
            </div>
            <p className="text-[11px] text-slate-300">
              Sesuai standar operasional Kemenhub dan tata kelola keselamatan logistik B2B, pengemudi yang telah mencapai akumulasi <strong>{threshold} kali pengiriman</strong> berturut-turut pada area atau rute lintas pulau yang sama memerlukan <strong>persetujuan resmi Dispatcer / Manajer Logistik</strong> sebelum penugasan berikutnya disahkan.
            </p>
          </div>

          {/* Current Assignment Summary */}
          <div className="bg-slate-950/70 rounded-xl p-4 border border-slate-800 grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-500 block">Pengemudi</span>
              <div className="font-bold text-white text-xs mt-0.5 flex items-center gap-1">
                <User className="w-3 h-3 text-blue-400" />
                <span>{crewName}</span>
              </div>
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-500 block">Tujuan Pengiriman</span>
              <div className="font-bold text-white text-xs mt-0.5 truncate flex items-center gap-1" title={storeName}>
                <MapPin className="w-3 h-3 text-emerald-400" />
                <span>{storeName}</span>
              </div>
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-500 block">Wilayah / Rute</span>
              <div className="font-bold text-amber-400 text-xs mt-0.5">
                {areaName}
              </div>
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-500 block">Status Pengiriman</span>
              <div className="font-bold text-white text-xs mt-0.5">
                Trip ke-{tripCount + 1} di Area Ini
              </div>
            </div>
          </div>

          {/* History of Past Trips in this Area */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-bold text-white flex items-center gap-1.5">
                <History className="w-3.5 h-3.5 text-blue-400" />
                <span>Histori {tripCount} Pengiriman Terakhir Kru Ini di {areaName}:</span>
              </span>
              <span className="text-[10px] text-slate-400 font-mono">Log Terverifikasi</span>
            </div>

            <div className="space-y-1.5 max-h-36 overflow-y-auto">
              {recentTrips.length > 0 ? (
                recentTrips.map((trip, idx) => (
                  <div
                    key={trip.id}
                    className="p-2.5 rounded-lg bg-slate-950/60 border border-slate-800/80 flex items-center justify-between text-[11px]"
                  >
                    <div className="flex items-center gap-2">
                      <span className="w-5 h-5 rounded-full bg-slate-800 text-slate-300 font-mono font-bold text-[10px] flex items-center justify-center">
                        #{idx + 1}
                      </span>
                      <div>
                        <div className="font-mono font-bold text-white">{trip.trackingNumber}</div>
                        <div className="text-slate-400 text-[10px]">{trip.storeName} ({trip.city})</div>
                      </div>
                    </div>

                    <div className="text-right">
                      <div className="text-slate-300">
                        {new Date(trip.completionDate).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })}
                      </div>
                      <div className="text-[10px] text-emerald-400 font-semibold">
                        Selesai ({trip.cargoWeightTon} Ton)
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="p-3 text-center text-slate-500 italic bg-slate-950/40 rounded-lg">
                  Riwayat tercatat dalam sistem telemetri armada.
                </div>
              )}
            </div>
          </div>

          {/* Approver Notes Input */}
          <div className="space-y-1.5 pt-2">
            <label className="text-slate-300 font-bold block">
              Catatan Dispensasi / Alasan Persetujuan Manajer:
            </label>
            <textarea
              rows={2}
              value={approvalNotes}
              onChange={(e) => setApprovalNotes(e.target.value)}
              className="w-full p-2.5 rounded-lg bg-slate-950 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 text-xs"
              placeholder="Tuliskan catatan verifikasi kesiapan fisik supir atau kondisi operasional..."
            />
          </div>
        </div>

        {/* Modal Footer Actions */}
        <div className="bg-slate-950 p-4 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3">
          <button
            type="button"
            onClick={onClose}
            className="w-full sm:w-auto px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs transition cursor-pointer"
          >
            Batal
          </button>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            {onRejectAndPickOtherDriver && (
              <button
                type="button"
                onClick={() => {
                  onRejectAndPickOtherDriver();
                  onClose();
                }}
                className="px-4 py-2 rounded-lg bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 border border-rose-500/40 font-semibold text-xs flex items-center gap-1.5 transition cursor-pointer"
              >
                <XCircle className="w-3.5 h-3.5" />
                <span>Tolak & Rotasi Driver Lain</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => onApprove(approvalNotes)}
              className="px-5 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-lg shadow-amber-600/20 transition cursor-pointer"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>Setujui Penugasan ({tripCount + 1}x di Area)</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
