import React, { useState } from 'react';
import * as XLSX from 'xlsx';
import { logisticsStore } from '../services/store';

export const ScheduleUploadTool: React.FC = () => {
  const [isProcessing, setIsProcessing] = useState(false);

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsProcessing(true);
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet);

        console.log('Processed Excel Data:', jsonData);

        // Map and update store (Assuming structure based on requirements)
        // In a real app, you'd map these to Schedule types
        // jsonData.forEach(row => logisticsStore.addSchedule(mapRowToSchedule(row)));

        alert('Data berhasil diproses!');
      } catch (error) {
        console.error('Error processing file:', error);
        alert('Gagal memproses file.');
      } finally {
        setIsProcessing(false);
      }
    };

    reader.readAsArrayBuffer(file);
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg">
      <h3 className="text-sm font-bold text-white mb-4">Unggah Jadwal (Excel/CSV)</h3>
      <input
        type="file"
        accept=".xlsx, .xls, .csv"
        onChange={handleFileUpload}
        disabled={isProcessing}
        className="text-xs text-slate-400 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-blue-600 file:text-white hover:file:bg-blue-500 cursor-pointer"
      />
      {isProcessing && <p className="text-xs text-amber-400 mt-2">Memproses data...</p>}
    </div>
  );
};
