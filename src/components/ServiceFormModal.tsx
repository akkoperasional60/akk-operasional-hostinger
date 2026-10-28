import React, { useState, useRef, useEffect } from 'react';
import { X, Save, Printer, Download, AlertCircle } from 'lucide-react';
import { useReactToPrint } from 'react-to-print';
import { jsPDF } from 'jspdf';

interface ServiceFormModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ServiceFormModal: React.FC<ServiceFormModalProps> = ({ isOpen, onClose }) => {
  const componentRef = useRef<HTMLDivElement>(null);
  const handlePrintLegacy = useReactToPrint({
    contentRef: componentRef,
  });

  const [formData, setFormData] = useState(() => {
    const saved = localStorage.getItem('service_form_draft');
    return saved ? JSON.parse(saved) : {
      date: new Date().toISOString().split('T')[0],
      lastKm: '',
      damageDetails: '',
    };
  });

  const [validationError, setValidationError] = useState<string | null>(null);

  const validate = () => !!(formData.date && formData.lastKm && formData.damageDetails);

  useEffect(() => {
    localStorage.setItem('service_form_draft', JSON.stringify(formData));
  }, [formData]);

  const handleDownloadPdf = () => {
    if (!validate()) {
      setValidationError('Mohon lengkapi semua field wajib (Tanggal, KM Terakhir, dan Detail Kerusakan)');
      return;
    }
    setValidationError(null);

    try {
      const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      });

      let y = 16;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(14);
      doc.setTextColor(30, 58, 138);
      doc.text('PT. ANUGRAH KEMASAN KREATIF', 14, y);

      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(71, 85, 105);
      doc.text('Divisi Bengkel & Pemeliharaan Armada Logistik', 14, y + 5);

      y += 16;
      doc.setFillColor(241, 245, 249);
      doc.rect(14, y, 182, 8, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(15, 23, 42);
      doc.text('FORMULIR PERMOHONAN SERVICE & PEMELIHARAAN ARMADA', 18, y + 5.5);

      y += 16;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.text(`Tanggal Pengajuan : ${formData.date}`, 14, y);
      doc.text(`KM Odometer Terakhir : ${formData.lastKm} KM`, 14, y + 6);

      y += 16;
      doc.setFont('helvetica', 'bold');
      doc.text('RINCIAN KENDALA & KERUSAKAN ARMADA:', 14, y);
      y += 4;
      doc.setFillColor(248, 250, 252);
      doc.rect(14, y, 182, 30, 'FD');
      doc.setFont('helvetica', 'normal');
      const lines = doc.splitTextToSize(formData.damageDetails || 'Tidak ada catatan tambahan', 174);
      doc.text(lines, 18, y + 6);

      y += 42;
      doc.text('LEMBAR PENGESAHAN & PERSETUJUAN:', 14, y);
      y += 6;
      const roles = ['Yang Mengajukan (Driver/Mekanik)', 'Menyetujui (Koordinator Logistik)', 'Yang Menerima (Kepala Bengkel)'];
      roles.forEach((r, idx) => {
        const sx = 14 + idx * 62;
        doc.rect(sx, y, 58, 28);
        doc.setFontSize(7.5);
        doc.setFont('helvetica', 'bold');
        doc.text(r, sx + 2, y + 5);
        doc.setFont('helvetica', 'normal');
        doc.text('(____________________)', sx + 6, y + 24);
      });

      doc.save(`Form_Permohonan_Service_${formData.date}.pdf`);
    } catch (err) {
      console.error('Failed to generate Service PDF:', err);
    }
  };

  const handlePrint = () => {
    if (!validate()) {
      setValidationError('Mohon lengkapi semua field wajib sebelum mencetak!');
      return;
    }
    setValidationError(null);
    try {
      if (window.self !== window.top) {
        handleDownloadPdf();
      } else {
        handlePrintLegacy();
      }
    } catch {
      handleDownloadPdf();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center p-5 border-b">
          <div>
            <h2 className="text-lg font-bold text-gray-800">Permohonan Service dan Pemeliharaan</h2>
            <p className="text-xs text-gray-500">PT Anugrah Kemasan Kreatif - Bengkel Armada</p>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition cursor-pointer">
            <X size={20} />
          </button>
        </div>

        {validationError && (
          <div className="mx-6 mt-4 p-3 rounded-xl bg-amber-50 border border-amber-300 text-amber-800 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
            <span>{validationError}</span>
          </div>
        )}

        <div className="p-6" ref={componentRef}>
          {/* Input Area (Visible for editing) */}
          <div className="grid grid-cols-2 gap-4 border p-4 mb-4 bg-gray-50 rounded-xl print:hidden text-xs">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Tanggal</label>
              <input type="date" className="w-full border p-2 rounded-lg bg-white" value={formData.date} onChange={e => { setFormData({...formData, date: e.target.value}); setValidationError(null); }} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">KM Terakhir</label>
              <input type="number" className="w-full border p-2 rounded-lg bg-white" value={formData.lastKm} onChange={e => { setFormData({...formData, lastKm: e.target.value}); setValidationError(null); }} placeholder="Contoh: 15000" />
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-semibold text-gray-700 mb-1">Detail Kerusakan & Keluhan</label>
              <textarea className="w-full border p-2 rounded-lg bg-white" value={formData.damageDetails} onChange={e => { setFormData({...formData, damageDetails: e.target.value}); setValidationError(null); }} rows={3} placeholder="Jelaskan kendala armada secara spesifik..."></textarea>
            </div>
          </div>

          {/* Printable Display Area */}
          <div className="border p-4 mb-4 rounded-xl text-xs">
            <h3 className="font-bold border-b pb-1 mb-2 text-slate-800">KERUSAKAN (Data Cetak Resmi)</h3>
            <p className="text-slate-600">Tanggal Service: <strong className="text-slate-900">{formData.date}</strong></p>
            <p className="text-slate-600">KM Terakhir: <strong className="text-slate-900">{formData.lastKm || '-'} KM</strong></p>
            <p className="mt-2 text-slate-600">Kendala: <span className="font-mono text-slate-900">{formData.damageDetails || '_________________________________________________'}</span></p>
          </div>
          
          {/* Signature Area */}
          <div className="grid grid-cols-3 gap-4 border rounded-xl mt-4 text-xs">
            {['Yang Menerima', 'Menyetujui', 'Yang Mengajukan'].map((role, index) => (
              <div key={`role-${index}`} className="p-4 text-center">
                <p className="font-medium text-slate-700">{role},</p>
                <div className="h-16 border-b mt-8 mb-2 border-slate-300"></div>
                <p className="text-slate-500">(___________)</p>
              </div>
            ))}
          </div>
        </div>

        <div className="p-5 border-t flex flex-wrap justify-end gap-2 bg-slate-50">
          <button onClick={onClose} className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-xl text-xs font-semibold transition cursor-pointer">Tutup</button>
          <button 
            type="button"
            onClick={handleDownloadPdf}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition cursor-pointer shadow-xs active:scale-95"
            title="Unduh Berkas PDF Resmi Formulir Service"
          >
            <Download size={15} /> Unduh PDF
          </button>
          <button 
            type="button"
            onClick={handlePrint}
            className="px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-white transition cursor-pointer active:scale-95"
          >
            <Printer size={15} /> Cetak
          </button>
          <button 
            type="button"
            onClick={() => {
              if (validate()) {
                onClose();
              } else {
                setValidationError('Mohon lengkapi data sebelum menyimpan.');
              }
            }}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
          >
            <Save size={15} /> Simpan
          </button>
        </div>
      </div>
    </div>
  );
};
