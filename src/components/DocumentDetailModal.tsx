import React, { useState } from 'react';
import {
  X,
  FileText,
  Calendar,
  Truck,
  User,
  MapPin,
  CheckCircle2,
  AlertCircle,
  Download,
  Printer,
  Trash2,
  Eye,
  FileCheck2,
  Sparkles,
  ExternalLink,
  Tag,
  Loader2
} from 'lucide-react';
import { ScannedDocumentLog } from '../types';
import { downloadScannedDocumentPdf } from '../utils/suratJalanPdfGenerator';

interface DocumentDetailModalProps {
  document: ScannedDocumentLog | null;
  isOpen: boolean;
  onClose: () => void;
  onDelete?: (id: string) => void;
}

export const DocumentDetailModal: React.FC<DocumentDetailModalProps> = ({
  document: doc,
  isOpen,
  onClose,
  onDelete
}) => {
  const [isExportingPdf, setIsExportingPdf] = useState(false);

  if (!isOpen || !doc) return null;

  const handleDownloadPdf = async () => {
    setIsExportingPdf(true);
    try {
      await downloadScannedDocumentPdf(doc);
    } catch (err) {
      console.error('Failed to download scanned doc PDF:', err);
    } finally {
      setIsExportingPdf(false);
    }
  };

  const handlePrint = () => {
    try {
      if (window.self !== window.top) {
        handleDownloadPdf();
      } else {
        window.print();
      }
    } catch {
      handleDownloadPdf();
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-4xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[95vh]">
        {/* Header */}
        <div className="px-5 py-3.5 bg-slate-950 border-b border-slate-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 shrink-0">
              <FileCheck2 className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-white truncate">{doc.documentNumber}</h3>
                <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full font-bold border ${
                  doc.documentType === 'delivery_slip'
                    ? 'bg-cyan-500/15 text-cyan-400 border-cyan-500/30'
                    : doc.documentType === 'inspection_form'
                    ? 'bg-amber-500/15 text-amber-400 border-amber-500/30'
                    : 'bg-indigo-500/15 text-indigo-400 border-indigo-500/30'
                }`}>
                  {doc.documentTypeLabel}
                </span>
              </div>
              <p className="text-[11px] text-slate-400 truncate">
                ID Log: {doc.id} &bull; Dipindai: {new Date(doc.timestamp).toLocaleString('id-ID')} WIB oleh {doc.capturedBy}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 flex flex-col md:flex-row gap-6">
          {/* Left: Document Photo Preview */}
          <div className="w-full md:w-5/12 flex flex-col gap-3">
            <div className="rounded-xl overflow-hidden border border-slate-800 bg-slate-950 aspect-3/4 max-h-[460px] flex items-center justify-center relative group">
              <img
                src={doc.photoDataUrl}
                alt={doc.documentNumber}
                className="w-full h-full object-contain"
              />
              <div className="absolute top-2 right-2 flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                <a
                  href={doc.photoDataUrl}
                  download={`${doc.documentNumber}.jpg`}
                  className="p-2 rounded-lg bg-black/70 hover:bg-black text-white backdrop-blur-md text-xs font-bold transition flex items-center gap-1"
                  title="Unduh Foto Dokumen"
                >
                  <Download className="w-3.5 h-3.5" />
                </a>
              </div>
            </div>

            <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 text-xs space-y-1.5">
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-slate-400">Sumber Pemindaian:</span>
                <span className="font-bold text-slate-200 capitalize">{doc.source === 'camera' ? 'Kamera HP / Perangkat' : 'Unggahan Berkas'}</span>
              </div>
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-slate-400">Akurasi AI OCR:</span>
                <span className="font-bold font-mono text-emerald-400">{Math.round(doc.confidenceScore * 100)}%</span>
              </div>
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-slate-400">Tanda Tangan Terdeteksi:</span>
                <span className="font-bold text-cyan-300">{doc.signaturesDetected ? 'Ya (Terverifikasi)' : 'Tidak Terbaca'}</span>
              </div>
            </div>
          </div>

          {/* Right: Document Details & Metadata */}
          <div className="w-full md:w-7/12 space-y-4">
            {/* Status Header */}
            <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between">
              <div>
                <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">Status Arsip</span>
                <span className="text-sm font-bold text-white flex items-center gap-1.5 mt-0.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span>{doc.status === 'verified' ? 'Tervalidasi di Sistem Logistik' : 'Menunggu Konfirmasi'}</span>
                </span>
              </div>
              <div className="text-right">
                <span className="text-[10px] text-slate-400 block">Tanggal Fisik:</span>
                <span className="font-mono text-xs font-bold text-amber-400">{doc.date}</span>
              </div>
            </div>

            {/* Entity Badges Grid */}
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="p-3 bg-slate-950/70 rounded-xl border border-slate-800 space-y-1">
                <div className="flex items-center gap-1.5 text-slate-400 text-[11px]">
                  <Truck className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Plat Armada:</span>
                </div>
                <div className="font-mono font-bold text-emerald-400 text-sm">
                  {doc.vehiclePlate || 'Semua Unit'}
                </div>
              </div>

              <div className="p-3 bg-slate-950/70 rounded-xl border border-slate-800 space-y-1">
                <div className="flex items-center gap-1.5 text-slate-400 text-[11px]">
                  <User className="w-3.5 h-3.5 text-blue-400" />
                  <span>Pengemudi / Petugas:</span>
                </div>
                <div className="font-bold text-slate-100 text-sm truncate">
                  {doc.driverName || 'Staf Operasional'}
                </div>
              </div>
            </div>

            {/* Destination / Store */}
            {doc.destinationOrStore && (
              <div className="p-3 bg-slate-950/70 rounded-xl border border-slate-800 text-xs space-y-1">
                <div className="flex items-center gap-1.5 text-slate-400 text-[11px]">
                  <MapPin className="w-3.5 h-3.5 text-rose-400" />
                  <span>Lokasi Tujuan / Toko Penerima:</span>
                </div>
                <div className="font-bold text-slate-100 text-xs">
                  {doc.destinationOrStore}
                </div>
              </div>
            )}

            {/* Cargo / Items summary */}
            {doc.cargoOrItemsSummary && (
              <div className="p-3 bg-slate-950/70 rounded-xl border border-slate-800 text-xs space-y-1">
                <div className="flex items-center gap-1.5 text-slate-400 text-[11px]">
                  <FileText className="w-3.5 h-3.5 text-amber-400" />
                  <span>Deskripsi Muatan / Checklist:</span>
                </div>
                <div className="text-slate-200 text-xs leading-relaxed">
                  {doc.cargoOrItemsSummary}
                </div>
                {doc.quantityOrWeight && (
                  <div className="pt-1.5 border-t border-slate-800/80 flex items-center justify-between text-[11px]">
                    <span className="text-slate-400">Total Koli / Tonase:</span>
                    <span className="font-mono font-bold text-amber-400">{doc.quantityOrWeight}</span>
                  </div>
                )}
              </div>
            )}

            {/* Notes */}
            {doc.notes && (
              <div className="p-3 bg-slate-950/70 rounded-xl border border-slate-800 text-xs space-y-1">
                <span className="text-slate-400 text-[11px] font-semibold block">Catatan Khusus:</span>
                <p className="text-slate-300 text-xs leading-relaxed italic">{doc.notes}</p>
              </div>
            )}

            {/* Extracted Search Keywords / Raw OCR Box */}
            <div className="p-3 bg-slate-950/90 rounded-xl border border-slate-800 text-xs space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-slate-400 text-[11px] font-bold flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                  <span>Teks Terindeks OCR (Searchable Content):</span>
                </span>
              </div>
              <div className="bg-slate-900 p-2.5 rounded-lg border border-slate-800/80 font-mono text-[11px] text-slate-300 leading-relaxed max-h-24 overflow-y-auto">
                {doc.rawExtractedText}
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3.5 bg-slate-950 border-t border-slate-800 flex items-center justify-between shrink-0">
          {onDelete && (
            <button
              type="button"
              onClick={() => {
                if (window.confirm(`Hapus arsip dokumen ${doc.documentNumber}?`)) {
                  onDelete(doc.id);
                  onClose();
                }
              }}
              className="px-3 py-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Hapus Arsip</span>
            </button>
          )}

          <div className="flex items-center gap-2 ml-auto">
            <button
              type="button"
              onClick={handleDownloadPdf}
              disabled={isExportingPdf}
              className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-xs active:scale-95"
              title="Unduh Berkas PDF Resmi Arsip Dokumen"
            >
              {isExportingPdf ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Memproses PDF...</span>
                </>
              ) : (
                <>
                  <Download className="w-3.5 h-3.5" />
                  <span>Unduh Berkas PDF</span>
                </>
              )}
            </button>
            <button
              type="button"
              onClick={handlePrint}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Cetak Berkas</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black transition cursor-pointer"
            >
              Tutup
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
