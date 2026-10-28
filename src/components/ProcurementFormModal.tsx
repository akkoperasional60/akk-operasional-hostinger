import React, { useState, useRef, useEffect } from 'react';
import { X, Save, Printer, Download, AlertCircle } from 'lucide-react';
import { useReactToPrint } from 'react-to-print';
import { jsPDF } from 'jspdf';

interface ProcurementFormModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ProcurementFormModal: React.FC<ProcurementFormModalProps> = ({ isOpen, onClose }) => {
  const componentRef = useRef<HTMLDivElement>(null);
  const handlePrintLegacy = useReactToPrint({
    contentRef: componentRef,
  });

  const [formData, setFormData] = useState(() => {
    const saved = localStorage.getItem('procurement_form_draft');
    return saved ? JSON.parse(saved) : {
      category: '',
      quantity: '',
      urgency: 'medium',
      reason: '',
    };
  });

  const [validationError, setValidationError] = useState<string | null>(null);

  const validate = () => !!(formData.category && formData.quantity && formData.reason);

  useEffect(() => {
    localStorage.setItem('procurement_form_draft', JSON.stringify(formData));
  }, [formData]);

  const handleDownloadPdf = () => {
    if (!validate()) {
      setValidationError('Mohon lengkapi Kategori Barang, Jumlah, dan Alasan Pengadaan!');
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
      doc.text('Divisi Pengadaan, Logistik & Suku Cadang Distribusi', 14, y + 5);

      y += 16;
      doc.setFillColor(241, 245, 249);
      doc.rect(14, y, 182, 8, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(15, 23, 42);
      doc.text('FORMULIR PERMINTAAN PENGADAAN BARANG / SPAREPART', 18, y + 5.5);

      y += 16;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.text(`Tanggal: ${new Date().toLocaleDateString('id-ID')}`, 14, y);
      doc.text(`Tingkat Urgensi: ${formData.urgency.toUpperCase()}`, 110, y);

      y += 8;
      doc.text(`Kategori Barang: ${formData.category.toUpperCase()}`, 14, y);
      doc.text(`Jumlah Permintaan: ${formData.quantity} Unit`, 110, y);

      y += 12;
      doc.setFont('helvetica', 'bold');
      doc.text('ALASAN / TUJUAN PENGADAAN:', 14, y);
      y += 4;
      doc.setFillColor(248, 250, 252);
      doc.rect(14, y, 182, 24, 'FD');
      doc.setFont('helvetica', 'normal');
      const lines = doc.splitTextToSize(formData.reason || '-', 174);
      doc.text(lines, 18, y + 6);

      y += 34;
      doc.setFont('helvetica', 'bold');
      doc.text('TABEL SPESIFIKASI BARANG:', 14, y);
      y += 4;

      // Table Header
      doc.setFillColor(241, 245, 249);
      doc.rect(14, y, 182, 7, 'F');
      doc.setFontSize(7.5);
      doc.text('NO', 18, y + 5);
      doc.text('NAMA / DESKRIPSI BARANG', 32, y + 5);
      doc.text('QTY', 110, y + 5);
      doc.text('KEPERLUAN', 130, y + 5);

      y += 7;
      doc.setFont('helvetica', 'normal');
      doc.rect(14, y, 182, 8);
      doc.text('01', 18, y + 5);
      doc.text(`${formData.category.toUpperCase()} (${formData.quantity} unit)`, 32, y + 5);
      doc.text(`${formData.quantity}`, 110, y + 5);
      doc.text('Operasional Armada', 130, y + 5);

      y += 20;
      doc.setFont('helvetica', 'bold');
      doc.text('LEMBAR PENGESAHAN:', 14, y);
      y += 5;

      const roles = ['Pemohon (Staff Logistik)', 'Verifikator (Purchasing)', 'Persetujuan (Direksi / Manager)'];
      roles.forEach((r, idx) => {
        const sx = 14 + idx * 62;
        doc.rect(sx, y, 58, 28);
        doc.setFontSize(7.5);
        doc.setFont('helvetica', 'bold');
        doc.text(r, sx + 2, y + 5);
        doc.setFont('helvetica', 'normal');
        doc.text('(____________________)', sx + 6, y + 24);
      });

      doc.save(`Form_Pengadaan_${formData.category || 'Barang'}.pdf`);
    } catch (err) {
      console.error('Failed to generate Procurement PDF:', err);
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
            <h2 className="text-lg font-bold text-gray-800">Form Permintaan Pengadaan Barang Distribusi</h2>
            <p className="text-xs text-gray-500">PT Anugrah Kemasan Kreatif - Logistik & Purchasing</p>
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

        <div className="p-6 space-y-6" ref={componentRef}>
          {/* Input Fields (Visible for editing) */}
          <div className="grid grid-cols-2 gap-4 bg-gray-50 p-4 rounded-xl border border-gray-200 print:hidden text-xs">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Kategori Barang</label>
              <select className="w-full border p-2 rounded-lg bg-white" value={formData.category} onChange={e => { setFormData({...formData, category: e.target.value}); setValidationError(null); }}>
                <option value="">Pilih Kategori</option>
                <option value="oli">Oli & Pelumas</option>
                <option value="ban">Ban & Velg</option>
                <option value="aki">Aki & Kelistrikan</option>
                <option value="lainnya">Suku Cadang Lainnya</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Jumlah</label>
              <input type="number" className="w-full border p-2 rounded-lg bg-white" value={formData.quantity} onChange={e => { setFormData({...formData, quantity: e.target.value}); setValidationError(null); }} placeholder="Contoh: 2" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Urgensi</label>
              <select className="w-full border p-2 rounded-lg bg-white" value={formData.urgency} onChange={e => setFormData({...formData, urgency: e.target.value})}>
                <option value="low">Rendah (Rutin)</option>
                <option value="medium">Sedang (Dalam 3 Hari)</option>
                <option value="high">Tinggi (Mendesak / Urgent)</option>
              </select>
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-semibold text-gray-700 mb-1">Alasan Pengadaan</label>
              <textarea className="w-full border p-2 rounded-lg bg-white" value={formData.reason} onChange={e => { setFormData({...formData, reason: e.target.value}); setValidationError(null); }} rows={2} placeholder="Sebutkan alasan atau kebutuhan armada..."></textarea>
            </div>
          </div>

          <table className="w-full border-collapse border rounded-xl overflow-hidden text-xs">
            <thead>
              <tr className="bg-gray-100 text-gray-700">
                <th className="border p-2">NO</th>
                <th className="border p-2">NAMA BARANG</th>
                <th className="border p-2">DI TANGAN</th>
                <th className="border p-2">REQ ORDER</th>
                <th className="border p-2">TANGGAL DIPERLUKAN</th>
                <th className="border p-2">UNTUK KEPERLUAN</th>
              </tr>
            </thead>
            <tbody>
              {[...Array(5)].map((_, i) => (
                <tr key={i} className="text-gray-800">
                  <td className="border p-2 text-center">{i + 1}</td>
                  <td className="border p-2 h-8 font-medium">{i === 0 && formData.category ? `${formData.category.toUpperCase()}` : ''}</td>
                  <td className="border p-2 h-8 text-center">{i === 0 ? '0' : ''}</td>
                  <td className="border p-2 h-8 text-center font-bold">{i === 0 ? formData.quantity || '' : ''}</td>
                  <td className="border p-2 h-8 text-center">{i === 0 ? new Date().toLocaleDateString('id-ID') : ''}</td>
                  <td className="border p-2 h-8">{i === 0 ? 'Operasional Armada' : ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="p-5 border-t flex flex-wrap justify-end gap-2 bg-slate-50">
          <button onClick={onClose} className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-xl text-xs font-semibold transition cursor-pointer">Tutup</button>
          <button 
            type="button"
            onClick={handleDownloadPdf}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition cursor-pointer shadow-xs active:scale-95"
            title="Unduh Berkas PDF Resmi Permintaan Pengadaan"
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
            <Save size={15} /> Simpan ke Inventaris
          </button>
        </div>
      </div>
    </div>
  );
};
