import React, { useState, useMemo } from 'react';
import {
  FileText,
  Calendar,
  Download,
  Users,
  MapPin,
  CheckCircle2,
  X,
  Sliders,
  Sparkles,
  AlertCircle,
  Truck
} from 'lucide-react';
import { Crew, CrewDeliveryHistory, Fleet } from '../types';
import {
  generateCrewDeliveryPerformancePdf,
  filterHistoryByDateRange,
  formatIndoDate,
  CrewReportOptions
} from '../utils/crewDeliveryReportGenerator';

interface CrewReportDownloadModalProps {
  isOpen: boolean;
  onClose: () => void;
  allHistory: CrewDeliveryHistory[];
  crews: Crew[];
  fleets: Fleet[];
  currentThreshold: number;
}

export const CrewReportDownloadModal: React.FC<CrewReportDownloadModalProps> = ({
  isOpen,
  onClose,
  allHistory,
  crews,
  fleets,
  currentThreshold
}) => {
  // Default date range: Current month (e.g. January 2026) or last 30 days
  const [startDate, setStartDate] = useState<string>('2026-01-01');
  const [endDate, setEndDate] = useState<string>('2026-01-31');
  const [selectedCrewId, setSelectedCrewId] = useState<string>('all');
  const [selectedArea, setSelectedArea] = useState<string>('all');
  const [reportThreshold, setReportThreshold] = useState<number>(currentThreshold || 3);
  const [printedBy, setPrintedBy] = useState<string>('Koordinator Distribusi Logistik PT AKK');
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [downloadSuccessMessage, setDownloadSuccessMessage] = useState<string | null>(null);

  // Quick preset helper
  const applyPreset = (preset: 'today' | 'last7' | 'jan2026' | 'all') => {
    const today = new Date().toISOString().substring(0, 10);
    if (preset === 'today') {
      setStartDate(today);
      setEndDate(today);
    } else if (preset === 'last7') {
      const d = new Date();
      d.setDate(d.getDate() - 7);
      setStartDate(d.toISOString().substring(0, 10));
      setEndDate(today);
    } else if (preset === 'jan2026') {
      setStartDate('2026-01-01');
      setEndDate('2026-01-31');
    } else if (preset === 'all') {
      if (allHistory.length > 0) {
        const sorted = [...allHistory].sort((a, b) => a.completionDate.localeCompare(b.completionDate));
        setStartDate(sorted[0].completionDate.substring(0, 10));
        setEndDate(sorted[sorted.length - 1].completionDate.substring(0, 10));
      } else {
        setStartDate('2026-01-01');
        setEndDate('2026-12-31');
      }
    }
  };

  // Extract distinct areas from history for selector
  const availableAreas = useMemo(() => {
    const set = new Set<string>();
    allHistory.forEach(h => {
      if (h.area) set.add(h.area);
    });
    return Array.from(set).sort();
  }, [allHistory]);

  // Preview filtered dataset
  const options: CrewReportOptions = useMemo(() => ({
    startDate,
    endDate,
    selectedCrewId,
    selectedArea,
    printedBy,
    threshold: reportThreshold
  }), [startDate, endDate, selectedCrewId, selectedArea, printedBy, reportThreshold]);

  const filteredPreview = useMemo(() => {
    return filterHistoryByDateRange(allHistory, options);
  }, [allHistory, options]);

  const uniqueCrewsInPreview = useMemo(() => {
    return new Set(filteredPreview.map(h => h.crewId || h.crewName)).size;
  }, [filteredPreview]);

  const uniqueAreasInPreview = useMemo(() => {
    return new Set(filteredPreview.map(h => h.area)).size;
  }, [filteredPreview]);

  if (!isOpen) return null;

  const handleDownloadPdf = () => {
    setIsGenerating(true);
    setDownloadSuccessMessage(null);

    setTimeout(() => {
      try {
        const res = generateCrewDeliveryPerformancePdf(allHistory, crews, fleets, options);
        if (res.success) {
          setDownloadSuccessMessage(`Laporan PDF "${res.fileName}" (${res.totalRecords} data ritase) berhasil dibuat dan diunduh otomatis!`);
          setTimeout(() => {
            setIsGenerating(false);
          }, 600);
        }
      } catch (err: any) {
        console.error('PDF generation error:', err);
        setIsGenerating(false);
      }
    }, 350);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl animate-in fade-in duration-200">
        {/* Header */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/15 border border-blue-500/30 flex items-center justify-center text-blue-400">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-black text-white">
                Cetak Laporan PDF Kinerja &amp; Rotasi Kru
              </h3>
              <p className="text-xs text-slate-400">
                Pilih rentang tanggal untuk menghasilkan dokumen PDF resmi PT AKK secara otomatis
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 space-y-5 text-xs max-h-[80vh] overflow-y-auto">
          {downloadSuccessMessage && (
            <div className="p-3.5 rounded-xl bg-emerald-950/90 border border-emerald-500/40 text-emerald-200 flex items-center gap-2.5 shadow-sm animate-in fade-in">
              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
              <div className="flex-1 font-semibold">
                {downloadSuccessMessage}
              </div>
            </div>
          )}

          {/* Quick Date Presets */}
          <div className="space-y-1.5">
            <label className="text-slate-300 font-bold block flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-amber-400" />
              <span>Preset Cepat Rentang Tanggal:</span>
            </label>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => applyPreset('jan2026')}
                className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs transition cursor-pointer border border-slate-700"
              >
                📅 Januari 2026 (Sebulan Penuh)
              </button>
              <button
                type="button"
                onClick={() => applyPreset('last7')}
                className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs transition cursor-pointer border border-slate-700"
              >
                7 Hari Terakhir
              </button>
              <button
                type="button"
                onClick={() => applyPreset('today')}
                className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs transition cursor-pointer border border-slate-700"
              >
                Hari Ini
              </button>
              <button
                type="button"
                onClick={() => applyPreset('all')}
                className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs transition cursor-pointer border border-slate-700"
              >
                Semua Riwayat Terdata
              </button>
            </div>
          </div>

          {/* Date Range Inputs */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-slate-950/70 p-4 rounded-xl border border-slate-800">
            <div>
              <label className="text-slate-400 font-semibold block mb-1">
                Tanggal Mulai (Start Date):
              </label>
              <input
                type="date"
                required
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-white font-mono text-xs focus:ring-1 focus:ring-blue-500 focus:outline-none"
              />
              <span className="text-[10px] text-slate-500 mt-1 block">
                {formatIndoDate(startDate)}
              </span>
            </div>

            <div>
              <label className="text-slate-400 font-semibold block mb-1">
                Tanggal Selesai (End Date):
              </label>
              <input
                type="date"
                required
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-white font-mono text-xs focus:ring-1 focus:ring-blue-500 focus:outline-none"
              />
              <span className="text-[10px] text-slate-500 mt-1 block">
                {formatIndoDate(endDate)}
              </span>
            </div>
          </div>

          {/* Optional Filter Parameters */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-slate-300 font-semibold block mb-1 flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-blue-400" />
                <span>Filter Pengemudi (Kru):</span>
              </label>
              <select
                value={selectedCrewId}
                onChange={(e) => setSelectedCrewId(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-white text-xs focus:ring-1 focus:ring-blue-500"
              >
                <option value="all">Semua Pengemudi ({crews.length} Orang)</option>
                {crews.map(c => (
                  <option key={c.id} value={c.id}>{c.name} ({c.role})</option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-slate-300 font-semibold block mb-1 flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-indigo-400" />
                <span>Filter Wilayah / Area:</span>
              </label>
              <select
                value={selectedArea}
                onChange={(e) => setSelectedArea(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-white text-xs focus:ring-1 focus:ring-blue-500"
              >
                <option value="all">Semua Wilayah ({availableAreas.length} Area)</option>
                {availableAreas.map(a => (
                  <option key={a} value={a}>{a}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Threshold and Signer Settings */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-slate-300 font-semibold block mb-1 flex items-center gap-1.5">
                <Sliders className="w-3.5 h-3.5 text-amber-400" />
                <span>Batas Maksimal Rotasi Area (SOP):</span>
              </label>
              <select
                value={reportThreshold}
                onChange={(e) => setReportThreshold(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-white text-xs"
              >
                <option value={2}>Maksimal 2x Pengiriman berturut-turut</option>
                <option value={3}>Maksimal 3x Pengiriman (Standar SOP PT AKK)</option>
                <option value={5}>Maksimal 5x Pengiriman (Toleransi Khusus)</option>
              </select>
            </div>

            <div>
              <label className="text-slate-300 font-semibold block mb-1">
                Penyusun / Penandatangan Dokumen:
              </label>
              <input
                type="text"
                value={printedBy}
                onChange={(e) => setPrintedBy(e.target.value)}
                placeholder="Nama penyusun dokumen..."
                className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-white text-xs"
              />
            </div>
          </div>

          {/* Live Data Preview Box */}
          <div className="bg-slate-950/80 p-4 rounded-xl border border-slate-800 space-y-2">
            <div className="flex items-center justify-between text-slate-300 font-bold">
              <span className="flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                <span>Pratinjau Data yang Akan Dicetak:</span>
              </span>
              <span className="text-blue-400 font-mono">
                {filteredPreview.length} Ritase Ditemukan
              </span>
            </div>

            <div className="grid grid-cols-3 gap-2 text-center pt-1">
              <div className="bg-slate-900/90 p-2 rounded-lg border border-slate-800">
                <span className="text-[10px] text-slate-400 block">Total Ritase</span>
                <span className="text-sm font-black text-white">{filteredPreview.length}</span>
              </div>
              <div className="bg-slate-900/90 p-2 rounded-lg border border-slate-800">
                <span className="text-[10px] text-slate-400 block">Kru Terlibat</span>
                <span className="text-sm font-black text-blue-400">{uniqueCrewsInPreview} Supir</span>
              </div>
              <div className="bg-slate-900/90 p-2 rounded-lg border border-slate-800">
                <span className="text-[10px] text-slate-400 block">Wilayah Tercover</span>
                <span className="text-sm font-black text-indigo-400">{uniqueAreasInPreview} Area</span>
              </div>
            </div>

            {filteredPreview.length === 0 ? (
              <div className="flex items-center gap-2 p-2 rounded bg-rose-500/10 border border-rose-500/20 text-rose-300 text-[11px] mt-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                <span>Tidak ada riwayat pengiriman yang cocok dengan rentang tanggal ini. Silakan perlebar rentang tanggal.</span>
              </div>
            ) : (
              <p className="text-[11px] text-slate-400 leading-relaxed pt-1">
                Laporan PDF akan memuat 3 halaman terstruktur: <strong>Bagian I</strong> Ringkasan Eksekutif &amp; KPI Kinerja Pengemudi, <strong>Bagian II</strong> Distribusi Ritase Wilayah, dan <strong>Bagian III</strong> Log Aktivitas Pengiriman lengkap beserta Lembar Pengesahan Resmi.
              </p>
            )}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/60 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold transition cursor-pointer"
          >
            Tutup
          </button>

          <button
            type="button"
            onClick={handleDownloadPdf}
            disabled={isGenerating || filteredPreview.length === 0}
            className={`px-5 py-2.5 rounded-xl font-bold transition flex items-center gap-2 shadow-lg cursor-pointer ${
              filteredPreview.length === 0
                ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white shadow-blue-500/20'
            }`}
          >
            <Download className="w-4 h-4" />
            <span>
              {isGenerating ? 'Membuat Laporan PDF...' : 'Unduh Laporan PDF Kinerja'}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};
