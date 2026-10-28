import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { AlertTriangle, ShieldAlert, ArrowRight, UserCheck, Users, MapPin, X, Check, RefreshCw } from 'lucide-react';
import { AreaRepetitionConflict } from '../services/areaRotationValidator';
import { Crew } from '../types';

interface AreaRepetitionWarningModalProps {
  isOpen: boolean;
  conflict: AreaRepetitionConflict | null;
  onProceedUrgent: () => void;
  onSelectAlternative: (newCrewId: string) => void;
  onCancel: () => void;
}

export const AreaRepetitionWarningModal: React.FC<AreaRepetitionWarningModalProps> = ({
  isOpen,
  conflict,
  onProceedUrgent,
  onSelectAlternative,
  onCancel,
}) => {
  const [showAlternativeSelector, setShowAlternativeSelector] = useState(false);
  const [selectedAltCrewId, setSelectedAltCrewId] = useState<string>('');

  if (!isOpen || !conflict) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[100] bg-slate-950/85 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto"
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0, y: 10 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.95, opacity: 0, y: 10 }}
          className="bg-slate-900 border-2 border-amber-500/50 rounded-2xl max-w-xl w-full shadow-2xl overflow-hidden my-auto"
        >
          {/* Header Banner */}
          <div className="bg-gradient-to-r from-amber-950/80 via-slate-900 to-amber-950/60 p-5 border-b border-amber-500/30 flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 shrink-0">
                <AlertTriangle className="w-6 h-6 animate-pulse" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[10px] font-mono font-bold px-2 py-0.5 rounded-full uppercase">
                    Peringatan Rotasi Operasional
                  </span>
                  {conflict.isWeekMandatedRule && (
                    <span className="bg-purple-500/20 text-purple-300 border border-purple-500/30 text-[10px] font-bold px-2 py-0.5 rounded-full">
                      Pola Pekan Khusus
                    </span>
                  )}
                </div>
                <h3 className="text-base font-black text-white mt-1 tracking-tight">
                  Pengulangan Area Penugasan Kru ({conflict.areaName})
                </h3>
              </div>
            </div>

            <button
              onClick={onCancel}
              className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Body Content */}
          <div className="p-6 space-y-5 text-xs text-slate-300">
            {/* Context Card */}
            <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-3">
              <div className="flex items-center justify-between text-[11px] pb-2 border-b border-slate-800/80">
                <span className="text-slate-400">Kru yang Ditugaskan:</span>
                <span className="font-bold text-white flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5 text-indigo-400" />
                  <span>{conflict.crewName} ({conflict.roleType})</span>
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-1 text-[11px]">
                <div className="bg-slate-900/90 p-3 rounded-lg border border-slate-800">
                  <span className="text-slate-400 block text-[10px] uppercase font-bold text-amber-400">
                    Jadwal Sebelumnya
                  </span>
                  <div className="font-bold text-slate-200 mt-1 flex items-center gap-1">
                    <MapPin className="w-3 h-3 text-amber-400 shrink-0" />
                    <span>{conflict.previousRouteName}</span>
                  </div>
                  <div className="text-[10px] text-slate-400 mt-0.5">
                    Hari: <strong className="text-slate-200">{conflict.previousDay}</strong>
                  </div>
                </div>

                <div className="bg-slate-900/90 p-3 rounded-lg border border-slate-800">
                  <span className="text-slate-400 block text-[10px] uppercase font-bold text-indigo-400">
                    Rencana Penugasan Baru
                  </span>
                  <div className="font-bold text-slate-200 mt-1 flex items-center gap-1">
                    <MapPin className="w-3 h-3 text-indigo-400 shrink-0" />
                    <span>{conflict.targetRouteName}</span>
                  </div>
                  <div className="text-[10px] text-slate-400 mt-0.5">
                    Hari: <strong className="text-slate-200">{conflict.targetDay}</strong>
                  </div>
                </div>
              </div>
            </div>

            {/* SOP Rule Reminder */}
            <div className="bg-amber-950/30 border border-amber-500/30 rounded-xl p-3.5 flex items-start gap-3 text-amber-200">
              <ShieldAlert className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <div className="font-bold text-amber-300">
                  Kebijakan SOP: Tidak Dianjurkan Kirim ke Area yang Sama Berulang
                </div>
                <p className="text-[11px] leading-relaxed text-amber-200/90">
                  Kru tersebut sudah dijadwalkan mengirim ke area <strong>{conflict.areaName}</strong>. 
                  Untuk pemerataan pengalaman rute, keadilan jam kerja, serta mencegah kejenuhan rute, 
                  kru <em>tidak dianjurkan</em> untuk dikirim ke area yang sama lagi pada siklus jadwal ini.
                </p>
              </div>
            </div>

            {/* Alternative Selection Section */}
            {showAlternativeSelector && (
              <div className="bg-slate-950 p-4 rounded-xl border border-indigo-500/40 space-y-3 animate-fade-in">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-indigo-300 flex items-center gap-1.5">
                    <UserCheck className="w-4 h-4 text-indigo-400" />
                    <span>Rekomendasi Kru Pengganti (Belum ke {conflict.areaName}):</span>
                  </span>
                  <span className="text-[10px] bg-indigo-500/20 text-indigo-300 px-2 py-0.5 rounded font-bold">
                    {conflict.eligibleAlternatives.length} Tersedia
                  </span>
                </div>

                {conflict.eligibleAlternatives.length === 0 ? (
                  <p className="text-[11px] text-slate-400 italic">
                    Seluruh kru pada kategori ini telah memiliki penugasan. Disarankan memilih opsi keadaan mendesak.
                  </p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto pr-1">
                    {conflict.eligibleAlternatives.map((altCrew) => {
                      const isSelected = selectedAltCrewId === altCrew.id;
                      return (
                        <button
                          key={altCrew.id}
                          onClick={() => setSelectedAltCrewId(altCrew.id)}
                          className={`p-2.5 rounded-lg border text-left transition cursor-pointer flex items-center justify-between gap-2 ${
                            isSelected
                              ? 'bg-indigo-950/80 border-indigo-500 text-white ring-1 ring-indigo-500'
                              : 'bg-slate-900 border-slate-800 text-slate-300 hover:border-slate-700 hover:bg-slate-800/80'
                          }`}
                        >
                          <div>
                            <div className="font-bold text-xs">{altCrew.name}</div>
                            <div className="text-[10px] text-slate-400 mt-0.5">
                              {altCrew.licenseType} • {altCrew.tripsCompleted} Trip
                            </div>
                          </div>
                          {isSelected ? (
                            <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                          ) : (
                            <ArrowRight className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}

                {selectedAltCrewId && (
                  <button
                    onClick={() => onSelectAlternative(selectedAltCrewId)}
                    className="w-full mt-2 py-2.5 px-4 rounded-xl bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg transition cursor-pointer"
                  >
                    <Check className="w-4 h-4" />
                    <span>Terapkan Pergantian ke Kru Terpilih</span>
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Modal Footer with Primary Decision Actions */}
          <div className="bg-slate-950 p-4 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
            <button
              onClick={onCancel}
              className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold transition cursor-pointer order-3 sm:order-1"
            >
              Batalkan
            </button>

            <div className="flex items-center gap-2 w-full sm:w-auto order-1 sm:order-2">
              {!showAlternativeSelector ? (
                <button
                  onClick={() => setShowAlternativeSelector(true)}
                  className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold transition flex items-center justify-center gap-2 shadow cursor-pointer"
                >
                  <RefreshCw className="w-4 h-4 text-indigo-200" />
                  <span>Ganti dengan Kru Lainnya</span>
                </button>
              ) : (
                <button
                  onClick={() => setShowAlternativeSelector(false)}
                  className="w-full sm:w-auto px-3.5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium transition cursor-pointer"
                >
                  Tutup Pilihan Kru
                </button>
              )}

              <button
                onClick={onProceedUrgent}
                className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white font-bold transition flex items-center justify-center gap-2 shadow-lg shadow-amber-900/30 cursor-pointer"
                title="Lanjutkan penugasan dalam keadaan mendesak (Urgent Override)"
              >
                <ShieldAlert className="w-4 h-4 text-amber-200" />
                <span>Lanjutkan (Keadaan Mendesak)</span>
              </button>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};
