import React from 'react';
import { ShieldAlert, History, MapPin, Truck, Calendar, User, Clock, ArrowLeft } from 'lucide-react';
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

  const effectiveTripCount = Math.max(tripCount, recentTrips.length);

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-[2px] flex items-center justify-center p-4 animate-in fade-in duration-150">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl w-full max-w-xl overflow-hidden shadow-xl flex flex-col max-h-[90vh]">
        {/* Header Alert — Flat & Clean */}
        <div className="bg-slate-50 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 p-5 flex items-start justify-between">
          <div className="flex items-start gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-500/15 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0 border border-amber-200 dark:border-amber-500/30">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-[11px] font-bold uppercase tracking-wider bg-amber-50 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-500/30 mb-1.5">
                <span>Rincian Riwayat &amp; Batas Rotasi Wilayah</span>
              </div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white tracking-tight">
                Rincian Pengiriman &amp; Otorisasi Area
              </h3>
              <p className="text-xs text-slate-600 dark:text-slate-300 mt-1 leading-relaxed">
                Kru <strong className="text-slate-900 dark:text-white font-bold">{crewName}</strong> telah melakukan{' '}
                <span className="text-amber-600 dark:text-amber-400 font-bold">{effectiveTripCount} kali pengiriman</span> ke{' '}
                <strong className="text-slate-900 dark:text-white font-bold">{areaName}</strong> (Batas SOP: {threshold} kali).
              </p>
            </div>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-5 space-y-4 overflow-y-auto text-xs text-slate-600 dark:text-slate-300">
          {/* Policy Context Box */}
          <div className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 leading-relaxed space-y-1">
            <div className="font-bold flex items-center gap-1.5 text-amber-800 dark:text-amber-300">
              <Clock className="w-3.5 h-3.5 shrink-0" />
              <span>Kebijakan Rotasi Pengemudi &amp; Pencegahan Kelelahan (Fatigue Management)</span>
            </div>
            <p className="text-[11px] text-slate-700 dark:text-slate-200">
              Sesuai standar operasional Kemenhub dan tata kelola keselamatan logistik B2B, pengemudi yang telah mencapai akumulasi <strong className="text-slate-900 dark:text-white font-bold">{threshold} kali pengiriman</strong> berturut-turut pada area atau rute lintas pulau yang sama memerlukan <strong className="text-slate-900 dark:text-white font-bold">persetujuan resmi Dispatcher / Manajer Logistik</strong> sebelum penugasan berikutnya disahkan.
            </p>
          </div>

          {/* Current Assignment Summary */}
          <div className="bg-slate-50 dark:bg-slate-950 rounded-xl p-3.5 border border-slate-200 dark:border-slate-800 grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-400 block">Pengemudi</span>
              <div className="font-bold text-slate-900 dark:text-white text-xs mt-1 flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 shrink-0" />
                <span>{crewName}</span>
              </div>
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-400 block">Tujuan Pengiriman</span>
              <div className="font-bold text-slate-900 dark:text-white text-xs mt-1 truncate flex items-center gap-1.5" title={storeName || areaName}>
                <MapPin className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <span>{storeName || areaName}</span>
              </div>
            </div>
          </div>

          {/* History of Past Trips in this Area */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                <History className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                <span>Histori {effectiveTripCount} Pengiriman Terakhir Kru Ini di {areaName}:</span>
              </span>
              <span className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">Log Terverifikasi</span>
            </div>

            <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
              {recentTrips.length > 0 ? (
                recentTrips.map((trip, idx) => {
                  const armadaLabel =
                    (trip as any).initialCode ||
                    trip.plateNumber ||
                    (trip as any).vehiclePlate ||
                    plateNumber ||
                    '-';
                  const formattedDate = new Date(trip.completionDate || trip.deliveryDate || Date.now()).toLocaleDateString('id-ID', {
                    day: '2-digit',
                    month: 'short',
                    year: 'numeric'
                  });

                  // Tambahan Target Berangkat & Pulang jika tersedia pada trip
                  const depTime = (trip as any).departureTime || '';
                  const retTime = (trip as any).targetReturnTime || '';

                  return (
                    <div
                      key={trip.id || idx}
                      className="p-3 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3 text-xs"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className="w-5 h-5 rounded-full bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-mono font-bold text-[10px] flex items-center justify-center shrink-0">
                          #{idx + 1}
                        </span>
                        <div>
                          <span className="font-mono font-bold text-slate-900 dark:text-white truncate">
                            {trip.trackingNumber || `SJ-${idx + 1}`}
                          </span>
                          {(depTime || retTime) && (
                            <div className="text-[10px] font-mono text-slate-500 dark:text-slate-400 mt-0.5">
                              Target: {depTime || '07:30'} - {retTime || '17:00'} WIB
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2.5 shrink-0">
                        <span className="inline-flex items-center gap-1 text-[11px] text-slate-600 dark:text-slate-300 font-medium font-mono">
                          <Calendar className="w-3 h-3 text-blue-600 dark:text-blue-400" />
                          {formattedDate}
                        </span>
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-amber-50 dark:bg-amber-500/15 border border-amber-200 dark:border-amber-500/30 text-amber-700 dark:text-amber-300 font-mono font-bold text-[10px]">
                          <Truck className="w-3 h-3" />
                          {armadaLabel}
                        </span>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="p-3 text-center text-slate-500 dark:text-slate-400 italic bg-slate-50 dark:bg-slate-950 rounded-lg border border-slate-200 dark:border-slate-800">
                  Belum ada riwayat tercatat pada periode ini.
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Modal Footer Actions */}
        <div className="bg-slate-50 dark:bg-slate-950 px-5 py-3.5 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end">
          <button
            type="button"
            onClick={onClose}
            className="w-full sm:w-auto px-5 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Kembali</span>
          </button>
        </div>
      </div>
    </div>
  );
};
