import React, { useState, useMemo, useEffect } from 'react';
import * as XLSX from 'xlsx';
import {
  Layers,
  Truck,
  Search,
  Plus,
  Download,
  Upload,
  CheckCircle2,
  AlertTriangle,
  Edit3,
  Trash2,
  X,
  Package,
  ChevronLeft,
  ChevronRight,
  Scale,
  Box,
  RefreshCw,
  Eye
} from 'lucide-react';
import { logisticsStore } from '../services/store';
import { inferKategoriBarang, type MasterSkuRecord } from './WarehouseManagementSystem';

export interface SkuCubicationRecord extends MasterSkuRecord {
  panjangCm: number;
  lebarCm: number;
  tinggiCm: number;
  kubikasiM3: number; // Volume per 1 satuan (m³)
  beratKg: number;    // Berat per 1 satuan (kg)
}

/**
 * Infer realistic dimensions (P x L x T in cm), cubication (m³), and weight (kg)
 * from the SKU name or category if not yet explicitly set.
 */
export function enrichSkuWithCubication(sku: MasterSkuRecord): SkuCubicationRecord {
  const existingAny = sku as Partial<SkuCubicationRecord>;
  if (
    typeof existingAny.panjangCm === 'number' &&
    existingAny.panjangCm > 0 &&
    typeof existingAny.lebarCm === 'number' &&
    existingAny.lebarCm > 0 &&
    typeof existingAny.tinggiCm === 'number' &&
    existingAny.tinggiCm > 0 &&
    typeof existingAny.beratKg === 'number' &&
    existingAny.beratKg > 0
  ) {
    const calcM3 =
      typeof existingAny.kubikasiM3 === 'number' && existingAny.kubikasiM3 > 0
        ? existingAny.kubikasiM3
        : Number(((existingAny.panjangCm * existingAny.lebarCm * existingAny.tinggiCm) / 1_000_000).toFixed(4));
    return {
      ...sku,
      panjangCm: existingAny.panjangCm,
      lebarCm: existingAny.lebarCm,
      tinggiCm: existingAny.tinggiCm,
      kubikasiM3: calcM3,
      beratKg: existingAny.beratKg
    };
  }

  // Try to parse "60x40x40" or "22x22x8" from namaBarang
  const dimMatch = sku.namaBarang.match(/(\d+)\s*[x×X]\s*(\d+)\s*[x×X]\s*(\d+)/);
  let p = 50;
  let l = 35;
  let t = 30;
  let berat = 0.65;

  if (dimMatch) {
    p = Number(dimMatch[1]) || 50;
    l = Number(dimMatch[2]) || 35;
    t = Number(dimMatch[3]) || 30;
    // Estimate weight per pcs/box from volume & wall type
    const volM3 = (p * l * t) / 1_000_000;
    const isDoubleWall = sku.namaBarang.toUpperCase().includes('DOUBLE WALL') || sku.namaBarang.toUpperCase().includes('EXPORT');
    berat = Number(Math.max(0.12, volM3 * (isDoubleWall ? 11.5 : 7.5)).toFixed(2));
  } else {
    const satuanUpper = (sku.satuan || '').toUpperCase();
    const katUpper = (sku.kategoriBarang || '').toUpperCase();
    if (satuanUpper === 'KARTON') {
      p = 52;
      l = 42;
      t = 38;
      berat = 8.5;
    } else if (satuanUpper === 'BALL') {
      p = 60;
      l = 45;
      t = 35;
      berat = 15.0;
    } else if (satuanUpper === 'ROLL') {
      p = 55;
      l = 25;
      t = 25;
      berat = katUpper.includes('STRAPPING') ? 10.0 : 4.2;
    } else if (katUpper.includes('DOUBLE WALL')) {
      p = 70;
      l = 50;
      t = 45;
      berat = 1.45;
    } else {
      p = 45;
      l = 35;
      t = 30;
      berat = 0.55;
    }
  }

  const kubikasiM3 = Number(((p * l * t) / 1_000_000).toFixed(4));
  return {
    ...sku,
    panjangCm: p,
    lebarCm: l,
    tinggiCm: t,
    kubikasiM3,
    beratKg: berat
  };
}

// ============================================================================
// SUB-MENU 1: KUBIKASI BARANG DAN BERAT BARANG
// ============================================================================
export const WarehouseItemCubicationView: React.FC<{
  skuItems: MasterSkuRecord[];
  onUpdateSkuItems: (next: MasterSkuRecord[]) => void;
}> = ({ skuItems, onUpdateSkuItems }) => {
  const enrichedList = useMemo(() => skuItems.map(enrichSkuWithCubication), [skuItems]);

  const [search, setSearch] = useState('');
  const [kategoriFilter, setKategoriFilter] = useState('ALL');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Modal Edit / Tambah Kubikasi & Berat
  const [editingItem, setEditingItem] = useState<SkuCubicationRecord | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [deletingItem, setDeletingItem] = useState<SkuCubicationRecord | null>(null);
  const [popupModal, setPopupModal] = useState<{ title: string; message: string } | null>(null);

  // Dedicated Upload File Page State (matching Upload Master Barang UI)
  const [isUploadPageOpen, setIsUploadPageOpen] = useState(false);
  const [uploadTanggal, setUploadTanggal] = useState(() => new Date().toISOString().slice(0, 10));
  const [uploadFileName, setUploadFileName] = useState('');
  const [parsedUploadPreview, setParsedUploadPreview] = useState<SkuCubicationRecord[]>([]);
  const [showUploadPreviewTable, setShowUploadPreviewTable] = useState(false);

  useEffect(() => {
    if (!popupModal) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === 'Escape') {
        e.preventDefault();
        setPopupModal(null);
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [popupModal]);

  const [formState, setFormState] = useState({
    kategoriBarang: 'Karton Box Corrugated',
    noBarang: '',
    namaBarang: '',
    satuan: 'Pcs',
    stokTersedia: 1000,
    panjangCm: 60,
    lebarCm: 40,
    tinggiCm: 40,
    beratKg: 0.72
  });

  const availableCategories = useMemo(() => {
    const s = new Set<string>();
    enrichedList.forEach(item => {
      if (item.kategoriBarang) s.add(item.kategoriBarang);
    });
    return Array.from(s);
  }, [enrichedList]);

  const filteredItems = useMemo(() => {
    const q = search.trim().toLowerCase();
    return enrichedList.filter(item => {
      const matchSearch =
        !q ||
        item.noBarang.toLowerCase().includes(q) ||
        item.namaBarang.toLowerCase().includes(q) ||
        item.kategoriBarang.toLowerCase().includes(q);
      const matchKat = kategoriFilter === 'ALL' || item.kategoriBarang === kategoriFilter;
      return matchSearch && matchKat;
    });
  }, [enrichedList, search, kategoriFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredItems.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const paginatedItems = filteredItems.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  // Summary Metrics
  const totalKubikasiStokM3 = useMemo(
    () => enrichedList.reduce((acc, item) => acc + item.kubikasiM3 * item.stokTersedia, 0),
    [enrichedList]
  );
  const totalBeratStokKg = useMemo(
    () => enrichedList.reduce((acc, item) => acc + item.beratKg * item.stokTersedia, 0),
    [enrichedList]
  );
  const avgKubikasiUnit = useMemo(
    () =>
      enrichedList.length > 0
        ? enrichedList.reduce((acc, item) => acc + item.kubikasiM3, 0) / enrichedList.length
        : 0,
    [enrichedList]
  );

  const handleOpenEdit = (item: SkuCubicationRecord) => {
    setEditingItem(item);
    setFormState({
      kategoriBarang: item.kategoriBarang,
      noBarang: item.noBarang,
      namaBarang: item.namaBarang,
      satuan: item.satuan,
      stokTersedia: item.stokTersedia,
      panjangCm: item.panjangCm,
      lebarCm: item.lebarCm,
      tinggiCm: item.tinggiCm,
      beratKg: item.beratKg
    });
  };

  const handleOpenAdd = () => {
    setEditingItem(null);
    setFormState({
      kategoriBarang: 'Karton Box Corrugated',
      noBarang: `AKK-KBX-${String(skuItems.length + 1).padStart(3, '0')}`,
      namaBarang: '',
      satuan: 'Pcs',
      stokTersedia: 1000,
      panjangCm: 60,
      lebarCm: 40,
      tinggiCm: 40,
      beratKg: 0.75
    });
    setIsAddModalOpen(true);
  };

  const handleSaveForm = (e: React.FormEvent) => {
    e.preventDefault();
    const p = Math.max(1, Number(formState.panjangCm) || 1);
    const l = Math.max(1, Number(formState.lebarCm) || 1);
    const t = Math.max(1, Number(formState.tinggiCm) || 1);
    const berat = Math.max(0.01, Number(formState.beratKg) || 0.1);
    const kubikasiM3 = Number(((p * l * t) / 1_000_000).toFixed(4));

    if (editingItem) {
      const updated = skuItems.map(item =>
        item.id === editingItem.id
          ? {
              ...item,
              kategoriBarang: formState.kategoriBarang,
              noBarang: formState.noBarang.trim().toUpperCase(),
              namaBarang: formState.namaBarang.trim(),
              satuan: formState.satuan,
              stokTersedia: Number(formState.stokTersedia) || 0,
              panjangCm: p,
              lebarCm: l,
              tinggiCm: t,
              kubikasiM3,
              beratKg: berat
            }
          : item
      );
      onUpdateSkuItems(updated);
      setEditingItem(null);
      setPopupModal({
        title: 'Kubikasi & Berat Diperbarui',
        message: `Spesifikasi dimensi (${p}×${l}×${t} cm = ${kubikasiM3} m³) dan berat (${berat} Kg) untuk "${formState.namaBarang}" berhasil disimpan.`
      });
    } else {
      const newRecord: SkuCubicationRecord = {
        id: `sku-cub-${Date.now()}`,
        kategoriBarang: formState.kategoriBarang,
        noBarang: formState.noBarang.trim().toUpperCase(),
        namaBarang: formState.namaBarang.trim(),
        stokTersedia: Number(formState.stokTersedia) || 0,
        satuan: formState.satuan,
        panjangCm: p,
        lebarCm: l,
        tinggiCm: t,
        kubikasiM3,
        beratKg: berat
      };
      onUpdateSkuItems([newRecord, ...skuItems]);
      setIsAddModalOpen(false);
      setPopupModal({
        title: 'Data Kubikasi & Berat Ditambahkan',
        message: `Barang "${newRecord.namaBarang}" (${kubikasiM3} m³ / ${berat} Kg) berhasil ditambahkan ke Master Barang.`
      });
    }
  };

  const handleExportExcel = () => {
    const rows = filteredItems.map(item => ({
      'Kategori Barang': item.kategoriBarang,
      'No Barang/Kode Barang': item.noBarang,
      'Deskripsi/Nama Barang': item.namaBarang,
      Dimensi: `${item.panjangCm} x ${item.lebarCm} x ${item.tinggiCm} cm`,
      Kubikasi: `${item.kubikasiM3.toFixed(4)} m3`,
      Berat: `${item.beratKg} Kg`
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Kubikasi_Berat_Barang');
    XLSX.writeFile(wb, `Data_Kubikasi_dan_Berat_Barang_AKK_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  const handleDownloadTemplateKubikasi = () => {
    const sampleRows = [
      {
        'Kategori Barang': 'Karton Box Corrugated',
        'No Barang/Kode Barang': 'AKK-KBX-006',
        'Deskripsi/Nama Barang': 'Karton Box Corrugated Sablon Ritel 30x20x20 cm'
      },
      {
        'Kategori Barang': 'Karton Box Double Wall',
        'No Barang/Kode Barang': 'AKK-KBX-007',
        'Deskripsi/Nama Barang': 'Karton Box Ekspor Waxed Tahan Lembab Cold Storage 70x50x45 cm'
      },
      {
        'Kategori Barang': 'Box Kemasan Makanan',
        'No Barang/Kode Barang': 'AKK-KBX-009',
        'Deskripsi/Nama Barang': 'Box Die-Cut Pizza Kraft Coklat 25x25x5 cm'
      }
    ];
    const ws = XLSX.utils.json_to_sheet(sampleRows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Template_Kubikasi_Barang');
    XLSX.writeFile(wb, 'Template_Upload_Kubikasi_Barang_AKK.xlsx');
  };

  const handleUploadExcel = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadFileName(file.name);
    try {
      const buffer = await file.arrayBuffer();
      const wb = XLSX.read(buffer, { type: 'array' });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const jsonRows = XLSX.utils.sheet_to_json<Record<string, any>>(sheet, { defval: '' });

      if (jsonRows.length === 0) {
        setParsedUploadPreview([]);
        return;
      }

      const existingMap = new Map<string, SkuCubicationRecord>();
      skuItems.forEach(s => existingMap.set(s.noBarang.toUpperCase(), enrichSkuWithCubication(s)));

      const parsedItems: SkuCubicationRecord[] = [];
      jsonRows.forEach((row, idx) => {
        let rawKategori = '';
        let rawNoBarang = '';
        let rawNamaBarang = '';
        let rawPanjang = 0;
        let rawLebar = 0;
        let rawTinggi = 0;
        let rawBerat = 0;
        let rawStok = 0;
        let rawSatuan = '';

        Object.entries(row).forEach(([key, val]) => {
          const norm = String(key || '').toLowerCase().replace(/[^a-z0-9]/g, '');
          if (norm.includes('kategori')) {
            rawKategori = String(val || '').trim();
          } else if (
            norm === 'nobarang' ||
            norm === 'kodebarang' ||
            norm === 'nobarangkodebarang' ||
            norm === 'kodebarangnobarang' ||
            norm === 'sku' ||
            norm === 'kodesku' ||
            norm === 'kode'
          ) {
            rawNoBarang = String(val || '').trim().toUpperCase();
          } else if (
            norm === 'namabarang' ||
            norm === 'deskripsi' ||
            norm === 'deskripsinamabarang' ||
            norm === 'namabarangdeskripsi' ||
            norm === 'deskripsibarang' ||
            norm === 'nama'
          ) {
            rawNamaBarang = String(val || '').trim();
          } else if (norm.includes('panjang')) {
            rawPanjang = Number(val) || 0;
          } else if (norm.includes('lebar')) {
            rawLebar = Number(val) || 0;
          } else if (norm.includes('tinggi')) {
            rawTinggi = Number(val) || 0;
          } else if (norm.includes('berat')) {
            rawBerat = Number(val) || 0;
          } else if (norm.includes('stok')) {
            rawStok = Number(val) || 0;
          } else if (norm.includes('satuan') || norm.includes('unit')) {
            rawSatuan = String(val || '').trim();
          }
        });

        if (!rawNoBarang && !rawNamaBarang) return;

        const code = rawNoBarang || `AKK-IMP-${String(idx + 1).padStart(3, '0')}`;
        const existing = existingMap.get(code);
        const inferredKat = inferKategoriBarang(code, rawNamaBarang || existing?.namaBarang || '', rawKategori || existing?.kategoriBarang);

        const baseRecord: MasterSkuRecord = {
          id: existing?.id || `sku-imp-${Date.now()}-${idx}`,
          kategoriBarang: inferredKat,
          noBarang: code,
          namaBarang: rawNamaBarang || existing?.namaBarang || 'Item Kemasan AKK',
          stokTersedia: rawStok > 0 ? rawStok : (existing?.stokTersedia ?? 1000),
          satuan: rawSatuan || existing?.satuan || 'Pcs',
          tanggalStok: uploadTanggal,
          panjangCm: rawPanjang > 0 ? rawPanjang : existing?.panjangCm,
          lebarCm: rawLebar > 0 ? rawLebar : existing?.lebarCm,
          tinggiCm: rawTinggi > 0 ? rawTinggi : existing?.tinggiCm,
          beratKg: rawBerat > 0 ? rawBerat : existing?.beratKg
        };

        parsedItems.push(enrichSkuWithCubication(baseRecord));
      });

      setParsedUploadPreview(parsedItems);
      setShowUploadPreviewTable(true);
    } catch {
      setPopupModal({
        title: 'Gagal Membaca File Excel',
        message: 'Pastikan format file adalah .xlsx, .xls, atau .csv yang valid.'
      });
    }
  };

  const handleConfirmUploadImport = () => {
    if (parsedUploadPreview.length === 0) return;
    const updatedMap = new Map<string, MasterSkuRecord>();
    skuItems.forEach(s => updatedMap.set(s.noBarang.toUpperCase(), enrichSkuWithCubication(s)));
    parsedUploadPreview.forEach(item => {
      updatedMap.set(item.noBarang.toUpperCase(), item);
    });

    const count = parsedUploadPreview.length;
    onUpdateSkuItems(Array.from(updatedMap.values()));
    setIsUploadPageOpen(false);
    setParsedUploadPreview([]);
    setUploadFileName('');
    setShowUploadPreviewTable(false);
    setPopupModal({
      title: 'Import File Barang Berhasil',
      message: `${count} data barang (Kategori Barang, No Barang/Kode Barang, Deskripsi/Nama Barang) berhasil disimpan ke database kubikasi.`
    });
  };

  if (isUploadPageOpen) {
    return (
      <div className="space-y-6 animate-fade-in">
        {/* Top Gradient Banner matching Image 4 */}
        <div className="rounded-3xl bg-gradient-to-r from-emerald-600 via-teal-800 to-slate-950 p-7 sm:p-8 text-white shadow-md">
          <div className="text-[11px] font-black uppercase tracking-[0.2em] text-emerald-200 mb-1.5">
            WAREHOUSE MANAGEMENT SYSTEM
          </div>
          <h2 className="text-2xl sm:text-3xl font-black tracking-tight">
            Upload Master &amp; Kubikasi Barang
          </h2>
          <p className="text-xs sm:text-sm font-medium text-emerald-50/90 mt-1.5 max-w-2xl">
            Pilih tanggal stok dan unggah file Excel Master Barang. Data dari file akan dipreview terlebih dahulu sebelum disimpan ke database.
          </p>
        </div>

        {/* Form Container */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 sm:p-8 shadow-xs space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* TANGGAL STOK */}
            <div className="space-y-2">
              <label className="block text-[11px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
                TANGGAL STOK
              </label>
              <input
                type="date"
                value={uploadTanggal}
                onChange={(e) => setUploadTanggal(e.target.value)}
                className="w-full px-4 py-3.5 rounded-2xl bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-sm font-bold text-slate-900 dark:text-white focus:outline-none focus:border-emerald-600"
              />
            </div>

            {/* MODE IMPORT */}
            <div className="space-y-2">
              <label className="block text-[11px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
                MODE IMPORT
              </label>
              <div className="p-4 rounded-2xl bg-emerald-50/80 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/60 text-emerald-800 dark:text-emerald-300 text-xs sm:text-sm font-bold leading-relaxed">
                Upload tanggal yang sama akan ditimpa. Data H-1 tetap disimpan, dashboard otomatis memakai data terbaru.
              </div>
            </div>
          </div>

          {/* FILE MASTER BARANG */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-end">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="block text-[11px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  FILE MASTER BARANG
                </label>
                <button
                  type="button"
                  onClick={handleDownloadTemplateKubikasi}
                  className="text-xs font-bold text-emerald-700 dark:text-emerald-400 hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Unduh Template Excel</span>
                </button>
              </div>
              <div className="p-3.5 rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-950/50">
                <input
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  onChange={handleUploadExcel}
                  className="w-full text-xs text-slate-700 dark:text-slate-300 file:mr-3 file:py-1.5 file:px-3.5 file:rounded-lg file:border file:border-slate-300 dark:file:border-slate-700 file:bg-white dark:file:bg-slate-900 file:text-xs file:font-bold file:text-slate-900 dark:file:text-white hover:file:bg-slate-100 cursor-pointer"
                />
              </div>
            </div>
            {uploadFileName && (
              <div className="text-xs font-bold text-emerald-700 dark:text-emerald-400 flex items-center gap-2 pb-2">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>
                  File dipilih: <strong>{uploadFileName}</strong> ({parsedUploadPreview.length} baris barang terbaca otomatis)
                </span>
              </div>
            )}
          </div>

          {/* Automatic Columns Info Banner */}
          <div className="p-4 rounded-2xl bg-emerald-50/80 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/60 text-emerald-800 dark:text-emerald-300 text-xs sm:text-sm font-bold leading-relaxed">
            Kolom yang dibaca otomatis: Kategori Barang, No Barang/Kode Barang, Deskripsi/Nama Barang. Setelah import final, tabel Kubikasi Barang memakai data terbaru ini.
          </div>

          {/* Bottom Action Buttons */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => {
                setIsUploadPageOpen(false);
                setShowUploadPreviewTable(false);
                setParsedUploadPreview([]);
                setUploadFileName('');
              }}
              className="px-5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 font-bold text-xs sm:text-sm hover:bg-slate-50 dark:hover:bg-slate-800 transition cursor-pointer"
            >
              Kembali
            </button>

            <button
              type="button"
              onClick={() => {
                if (parsedUploadPreview.length === 0) {
                  setPopupModal({
                    title: 'Pilih File Terlebih Dahulu',
                    message: 'Silakan pilih file Excel (.xlsx/.xls/.csv) pada kolom File Master Barang untuk melihat preview data.'
                  });
                  return;
                }
                setShowUploadPreviewTable(true);
              }}
              className="px-5 py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-600 text-white font-bold text-xs sm:text-sm flex items-center gap-2 shadow-sm transition cursor-pointer"
            >
              <Eye className="w-4 h-4" />
              <span>Preview Data</span>
            </button>
          </div>

          {/* Preview Data Table before Final Import */}
          {showUploadPreviewTable && parsedUploadPreview.length > 0 && (
            <div className="pt-6 border-t border-slate-200 dark:border-slate-800 space-y-4 animate-fade-in">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h4 className="text-sm font-black text-slate-900 dark:text-white">
                    Preview Data Barang ({parsedUploadPreview.length} Barang Terbaca)
                  </h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Tanggal Stok: <strong>{uploadTanggal}</strong>
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleConfirmUploadImport}
                  className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-black text-xs sm:text-sm flex items-center gap-2 shadow-sm transition cursor-pointer"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Simpan &amp; Import ke Database Kubikasi ({parsedUploadPreview.length} Barang)</span>
                </button>
              </div>

              <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-50 dark:bg-slate-950 text-slate-600 dark:text-slate-400 uppercase font-bold text-[10px] border-b border-slate-200 dark:border-slate-800">
                    <tr>
                      <th className="py-3 px-4">Kategori Barang</th>
                      <th className="py-3 px-4">No Barang / Kode Barang</th>
                      <th className="py-3 px-4">Deskripsi / Nama Barang</th>
                      <th className="py-3 px-4 text-center">Dimensi</th>
                      <th className="py-3 px-4 text-right">Kubikasi</th>
                      <th className="py-3 px-4 text-right">Berat</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-800 text-slate-800 dark:text-slate-200">
                    {parsedUploadPreview.map((item) => (
                      <tr key={item.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40">
                        <td className="py-2.5 px-4">
                          <span className="px-2 py-0.5 rounded-lg bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/30 text-emerald-700 dark:text-emerald-300 font-bold text-[10px]">
                            {item.kategoriBarang}
                          </span>
                        </td>
                        <td className="py-2.5 px-4 font-mono font-bold text-indigo-600 dark:text-indigo-400">
                          {item.noBarang}
                        </td>
                        <td className="py-2.5 px-4 font-bold text-slate-900 dark:text-white">
                          {item.namaBarang}
                        </td>
                        <td className="py-2.5 px-4 text-center font-mono text-slate-700 dark:text-slate-300">
                          {item.panjangCm} &times; {item.lebarCm} &times; {item.tinggiCm} cm
                        </td>
                        <td className="py-2.5 px-4 text-right font-mono font-bold text-emerald-600 dark:text-emerald-400">
                          {item.kubikasiM3.toFixed(4)} m&sup3;
                        </td>
                        <td className="py-2.5 px-4 text-right font-mono font-bold text-blue-600 dark:text-blue-400">
                          {item.beratKg} Kg
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header Banner */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-lg bg-emerald-50 dark:bg-emerald-500/15 border border-emerald-200 dark:border-emerald-500/30 text-emerald-700 dark:text-emerald-300 text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5" />
              <span>WMS &bull; Spesifikasi Dimensi, Kubikasi &amp; Berat</span>
            </span>
          </div>
          <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-white tracking-tight">
            Database Kubikasi Barang (m&sup3;) &amp; Berat Barang (Kg)
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Pengelolaan ukuran dimensi Panjang &times; Lebar &times; Tinggi (cm), volume kubikasi per unit (m&sup3;), serta berat satuan (Kg) yang terintegrasi langsung dengan Master Barang dan Simulasi Box Armada.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={handleExportExcel}
            className="px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Ekspor Excel</span>
          </button>

          <button
            type="button"
            onClick={() => setIsUploadPageOpen(true)}
            className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1.5 transition cursor-pointer shadow-xs"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Unggah File</span>
          </button>

          <button
            type="button"
            onClick={handleOpenAdd}
            className="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold flex items-center gap-1.5 transition cursor-pointer shadow-xs"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Tambah Barang &amp; Kubikasi</span>
          </button>
        </div>
      </div>

      {/* KPI Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-2xl shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Total SKU Terdaftar
            </span>
            <Package className="w-4 h-4 text-indigo-500" />
          </div>
          <div className="text-xl font-black text-slate-900 dark:text-white font-mono">
            {enrichedList.length} Barang
          </div>
          <p className="text-[11px] text-slate-500 mt-1">
            Tersinkronisasi otomatis dengan Master SKU
          </p>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-2xl shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Rata-Rata Kubikasi / Unit
            </span>
            <Box className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-xl font-black text-emerald-600 dark:text-emerald-400 font-mono">
            {avgKubikasiUnit.toFixed(4)} m&sup3;
          </div>
          <p className="text-[11px] text-slate-500 mt-1">
            Volume rata-rata per satuan kemasan
          </p>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-2xl shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Total Kubikasi Stok Gudang
            </span>
            <Layers className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-xl font-black text-amber-600 dark:text-amber-400 font-mono">
            {totalKubikasiStokM3.toLocaleString('id-ID', { maximumFractionDigits: 1 })} m&sup3;
          </div>
          <p className="text-[11px] text-slate-500 mt-1">
            Akumulasi volume seluruh stok tersedia
          </p>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-2xl shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Total Berat Stok Gudang
            </span>
            <Scale className="w-4 h-4 text-blue-500" />
          </div>
          <div className="text-xl font-black text-blue-600 dark:text-blue-400 font-mono">
            {(totalBeratStokKg / 1000).toLocaleString('id-ID', { maximumFractionDigits: 2 })} Ton
          </div>
          <p className="text-[11px] text-slate-500 mt-1">
            Setara {Math.round(totalBeratStokKg).toLocaleString('id-ID')} Kg total muatan stok
          </p>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={e => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Cari No Barang, Nama Barang, atau Kategori..."
            className="w-full pl-10 pr-4 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-emerald-500"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            value={kategoriFilter}
            onChange={e => {
              setKategoriFilter(e.target.value);
              setPage(1);
            }}
            className="px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs font-bold text-slate-800 dark:text-slate-200 cursor-pointer"
          >
            <option value="ALL">Semua Kategori Barang ({availableCategories.length})</option>
            {availableCategories.map(kat => (
              <option key={kat} value={kat}>
                {kat}
              </option>
            ))}
          </select>

          <select
            value={pageSize}
            onChange={e => {
              setPageSize(Number(e.target.value));
              setPage(1);
            }}
            className="px-2.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs font-bold text-slate-800 dark:text-slate-200 cursor-pointer"
          >
            <option value={5}>5 Baris / Hal</option>
            <option value={10}>10 Baris / Hal</option>
            <option value={20}>20 Baris / Hal</option>
            <option value={50}>50 Baris / Hal</option>
          </select>
        </div>
      </div>

      {/* Table Kubikasi & Berat Barang */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-xs">
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-black text-slate-900 dark:text-white">
              Tabel Spesifikasi Kubikasi Barang &amp; Berat Barang
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Klik pada baris barang untuk mengubah spesifikasi dimensi, kubikasi, atau berat.
            </p>
          </div>
          <span className="text-xs font-bold text-slate-600 dark:text-slate-300">
            Total: <span className="font-mono text-emerald-600 dark:text-emerald-400">{filteredItems.length}</span> Barang
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-50 dark:bg-slate-950 text-slate-600 dark:text-slate-400 uppercase font-bold text-[10px] border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th className="py-3 px-4">Kategori Barang</th>
                <th className="py-3 px-4">No Barang</th>
                <th className="py-3 px-4">Nama Barang</th>
                <th className="py-3 px-4 text-center">Dimensi</th>
                <th className="py-3 px-4 text-right">Kubikasi</th>
                <th className="py-3 px-4 text-right">Berat</th>
                <th className="py-3 px-4 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800 text-slate-800 dark:text-slate-200">
              {paginatedItems.length > 0 ? (
                paginatedItems.map(item => (
                  <tr
                    key={item.id}
                    onClick={() => handleOpenEdit(item)}
                    title="Klik baris untuk mengubah spesifikasi barang ini"
                    className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition cursor-pointer"
                  >
                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 rounded-lg bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/30 text-emerald-700 dark:text-emerald-300 font-bold text-[10px] inline-block">
                        {item.kategoriBarang}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-mono font-bold text-indigo-600 dark:text-indigo-400">
                      {item.noBarang}
                    </td>
                    <td className="py-3 px-4 font-bold text-slate-900 dark:text-white">
                      {item.namaBarang}
                    </td>
                    <td className="py-3 px-4 text-center font-mono font-semibold text-slate-700 dark:text-slate-300">
                      {item.panjangCm} &times; {item.lebarCm} &times; {item.tinggiCm} cm
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-black text-emerald-600 dark:text-emerald-400">
                      {item.kubikasiM3.toFixed(4)} m&sup3;
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-black text-blue-600 dark:text-blue-400">
                      {item.beratKg.toLocaleString('id-ID')} Kg
                    </td>
                    <td className="py-3 px-4 text-center" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleOpenEdit(item)}
                          title="Ubah spesifikasi barang"
                          className="p-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-500/10 hover:bg-indigo-100 dark:hover:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 transition cursor-pointer"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeletingItem(item)}
                          title="Hapus barang"
                          className="p-1.5 rounded-lg bg-rose-50 dark:bg-rose-500/10 hover:bg-rose-100 dark:hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 transition cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-400 text-xs">
                    Tidak ada data barang yang sesuai pencarian.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="p-4 border-t border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <div className="text-slate-500 dark:text-slate-400">
            Menampilkan{' '}
            <strong className="text-slate-900 dark:text-white">
              {filteredItems.length === 0 ? 0 : (currentPage - 1) * pageSize + 1}
            </strong>{' '}
            &ndash;{' '}
            <strong className="text-slate-900 dark:text-white">
              {Math.min(currentPage * pageSize, filteredItems.length)}
            </strong>{' '}
            dari <strong className="text-slate-900 dark:text-white">{filteredItems.length}</strong> barang
          </div>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              disabled={currentPage <= 1}
              onClick={() => setPage(p => Math.max(1, p - 1))}
              className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-700 dark:text-slate-300 font-bold disabled:opacity-40 cursor-pointer flex items-center gap-1"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              <span>Sebelumnya</span>
            </button>
            <button
              type="button"
              disabled={currentPage >= totalPages}
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-700 dark:text-slate-300 font-bold disabled:opacity-40 cursor-pointer flex items-center gap-1"
            >
              <span>Selanjutnya</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Modal Tambah / Edit Kubikasi & Berat */}
      {(editingItem || isAddModalOpen) && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <h3 className="text-sm font-black text-slate-900 dark:text-white">
                {editingItem ? `Ubah Kubikasi & Berat: ${editingItem.noBarang}` : 'Tambah Spesifikasi Kubikasi & Berat Barang'}
              </h3>
              <button
                type="button"
                onClick={() => {
                  setEditingItem(null);
                  setIsAddModalOpen(false);
                }}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-900 dark:hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveForm} className="space-y-3 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-600 dark:text-slate-400 mb-1">
                    No Barang / Kode SKU *
                  </label>
                  <input
                    type="text"
                    required
                    value={formState.noBarang}
                    onChange={e => setFormState({ ...formState, noBarang: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white font-mono font-bold"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-600 dark:text-slate-400 mb-1">
                    Kategori Barang
                  </label>
                  <input
                    type="text"
                    required
                    value={formState.kategoriBarang}
                    onChange={e => setFormState({ ...formState, kategoriBarang: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white font-bold"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-600 dark:text-slate-400 mb-1">
                  Nama Barang *
                </label>
                <input
                  type="text"
                  required
                  value={formState.namaBarang}
                  onChange={e => setFormState({ ...formState, namaBarang: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white font-bold"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block font-bold text-slate-600 dark:text-slate-400 mb-1">
                    Panjang (cm) *
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    min={1}
                    required
                    value={formState.panjangCm}
                    onChange={e => setFormState({ ...formState, panjangCm: Number(e.target.value) })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white font-mono font-bold"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-600 dark:text-slate-400 mb-1">
                    Lebar (cm) *
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    min={1}
                    required
                    value={formState.lebarCm}
                    onChange={e => setFormState({ ...formState, lebarCm: Number(e.target.value) })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white font-mono font-bold"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-600 dark:text-slate-400 mb-1">
                    Tinggi (cm) *
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    min={1}
                    required
                    value={formState.tinggiCm}
                    onChange={e => setFormState({ ...formState, tinggiCm: Number(e.target.value) })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white font-mono font-bold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block font-bold text-slate-600 dark:text-slate-400 mb-1">
                    Berat / Unit (Kg) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min={0.01}
                    required
                    value={formState.beratKg}
                    onChange={e => setFormState({ ...formState, beratKg: Number(e.target.value) })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white font-mono font-bold"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-600 dark:text-slate-400 mb-1">
                    Stok Tersedia
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={formState.stokTersedia}
                    onChange={e => setFormState({ ...formState, stokTersedia: Number(e.target.value) })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white font-mono font-bold"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-600 dark:text-slate-400 mb-1">
                    Satuan
                  </label>
                  <select
                    value={formState.satuan}
                    onChange={e => setFormState({ ...formState, satuan: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white font-bold"
                  >
                    <option value="Pcs">Pcs</option>
                    <option value="Karton">Karton</option>
                    <option value="Ball">Ball</option>
                    <option value="Roll">Roll</option>
                    <option value="Ikat">Ikat</option>
                  </select>
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/60 flex items-center justify-between">
                <span className="font-bold text-emerald-800 dark:text-emerald-300">
                  Volume Kubikasi per Unit Otomatis:
                </span>
                <span className="font-mono text-sm font-black text-emerald-700 dark:text-emerald-400">
                  {(((Number(formState.panjangCm) || 0) * (Number(formState.lebarCm) || 0) * (Number(formState.tinggiCm) || 0)) / 1_000_000).toFixed(4)} m&sup3;
                </span>
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setEditingItem(null);
                    setIsAddModalOpen(false);
                  }}
                  className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold cursor-pointer"
                >
                  Simpan Kubikasi &amp; Berat
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Popup Modal */}
      {popupModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-md w-full p-6 text-center space-y-4 shadow-2xl">
            <div className="w-12 h-12 rounded-2xl bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <div className="space-y-1.5">
              <h4 className="text-base font-black text-slate-900 dark:text-white">{popupModal.title}</h4>
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">{popupModal.message}</p>
            </div>
            <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                autoFocus
                onClick={() => setPopupModal(null)}
                className="w-full py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-black text-xs cursor-pointer transition"
              >
                Oke, Mengerti
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deletingItem && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-md w-full p-6 text-center space-y-4 shadow-2xl">
            <div className="w-12 h-12 rounded-2xl bg-rose-100 dark:bg-rose-500/20 text-rose-600 dark:text-rose-400 flex items-center justify-center mx-auto">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div className="space-y-1.5">
              <h4 className="text-base font-black text-slate-900 dark:text-white">Konfirmasi Hapus Barang</h4>
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                Apakah Anda yakin ingin menghapus barang <strong className="text-slate-900 dark:text-white">{deletingItem.noBarang} - {deletingItem.namaBarang}</strong> dari database kubikasi?
              </p>
            </div>
            <div className="flex items-center justify-center gap-3 pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setDeletingItem(null)}
                className="flex-1 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold transition cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={() => {
                  const updated = skuItems.filter(s => s.id !== deletingItem.id);
                  onUpdateSkuItems(updated);
                  const name = deletingItem.namaBarang;
                  setDeletingItem(null);
                  setPopupModal({
                    title: 'Barang Berhasil Dihapus',
                    message: `Barang "${name}" berhasil dihapus dari database kubikasi.`
                  });
                }}
                className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition cursor-pointer shadow-xs"
              >
                Ya, Hapus Barang
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ============================================================================
// SUB-MENU 2: SIMULASI KUBIKASI BOX ARMADA DENGAN KUBIKASI ITEM BARANG
// ============================================================================
interface SimulatedCargoItem {
  id: string;
  skuId: string;
  noBarang: string;
  namaBarang: string;
  satuan: string;
  panjangCm: number;
  lebarCm: number;
  tinggiCm: number;
  kubikasiUnitM3: number;
  beratUnitKg: number;
  qtyMuat: number;
}

interface FleetBoxPreset {
  id: string;
  label: string;
  plateNumber: string;
  panjangBoxCm: number;
  lebarBoxCm: number;
  tinggiBoxCm: number;
  kubikasiBoxM3: number;
  maxPayloadKg: number;
}

const CARGO_COLORS = [
  'bg-emerald-500',
  'bg-indigo-500',
  'bg-amber-500',
  'bg-cyan-500',
  'bg-purple-500',
  'bg-rose-500'
];

export const WarehouseFleetCubicationSimulator: React.FC<{
  skuItems: MasterSkuRecord[];
}> = ({ skuItems }) => {
  const enrichedSkus = useMemo(() => skuItems.map(enrichSkuWithCubication), [skuItems]);

  // Build Fleet Box Options from real AKK fleets in logisticsStore + standard presets
  const fleetPresets = useMemo<FleetBoxPreset[]>(() => {
    const storeFleets = logisticsStore.getFleets();
    const mappedFromStore: FleetBoxPreset[] = storeFleets.map(f => {
      // Determine interior box dimensions (cm) from boxInnerDimensions or boxDimensions if available
      let p = 420;
      let l = 190;
      let t = 185;
      let maxKg = f.tonnageCapacity ? Math.round(f.tonnageCapacity * 1000) : 4500;

      const dimStr = f.boxInnerDimensions || f.boxDimensions || '';
      const dimMatch = dimStr.match(/(\d+(?:[.,]\d+)?)\s*[x×]\s*(\d+(?:[.,]\d+)?)\s*[x×]\s*(\d+(?:[.,]\d+)?)/i);
      if (dimMatch) {
        const rawP = parseFloat(dimMatch[1].replace(',', '.'));
        const rawL = parseFloat(dimMatch[2].replace(',', '.'));
        const rawT = parseFloat(dimMatch[3].replace(',', '.'));
        // If dimensions are in meters (< 20), convert to cm
        p = rawP < 20 ? Math.round(rawP * 100) : Math.round(rawP);
        l = rawL < 20 ? Math.round(rawL * 100) : Math.round(rawL);
        t = rawT < 20 ? Math.round(rawT * 100) : Math.round(rawT);
      } else {
        const nameUpper = `${f.brand || ''} ${f.vehicleType} ${f.initialCode || ''}`.toUpperCase();
        if (nameUpper.includes('BLINDVAN') || nameUpper.includes('GRANMAX')) {
          p = 210;
          l = 135;
          t = 125;
          maxKg = 1000;
        } else if (nameUpper.includes('PICK UP') || nameUpper.includes('PICKUP') || nameUpper.includes('L300') || nameUpper.includes('CARRY')) {
          p = 240;
          l = 155;
          t = 135;
          maxKg = 1500;
        } else if (nameUpper.includes('ENGKEL STD') || nameUpper.includes('CDE') || nameUpper.includes('NP')) {
          p = 310;
          l = 175;
          t = 175;
          maxKg = 2800;
        } else if (nameUpper.includes('LONG') || nameUpper.includes('FUSO') || nameUpper.includes('NL')) {
          p = 520;
          l = 200;
          t = 200;
          maxKg = 7000;
        }
      }

      const rawM3 = f.boxInnerCapacityM3 || f.boxCapacityM3 || 0;
      const calcM3 = rawM3 > 0 ? Number(rawM3.toFixed(2)) : Number(((p * l * t) / 1_000_000).toFixed(2));
      const fleetName = f.brand ? `${f.brand} ${f.vehicleType}` : f.vehicleType;
      return {
        id: f.id,
        label: `[${f.initialCode || 'ARMADA'}] ${f.plateNumber} — ${fleetName} (${calcM3} m³)`,
        plateNumber: f.plateNumber,
        panjangBoxCm: p,
        lebarBoxCm: l,
        tinggiBoxCm: t,
        kubikasiBoxM3: calcM3,
        maxPayloadKg: maxKg
      };
    });

    const standardPresets: FleetBoxPreset[] = [
      {
        id: 'preset-cde-box',
        label: '[STANDAR] Truk Engkel CDE Box (9,50 m³ / 2.800 Kg)',
        plateNumber: 'CDE BOX',
        panjangBoxCm: 310,
        lebarBoxCm: 175,
        tinggiBoxCm: 175,
        kubikasiBoxM3: 9.5,
        maxPayloadKg: 2800
      },
      {
        id: 'preset-cdd-box',
        label: '[STANDAR] Truk Double CDD Box (15,50 m³ / 4.800 Kg)',
        plateNumber: 'CDD BOX',
        panjangBoxCm: 425,
        lebarBoxCm: 195,
        tinggiBoxCm: 187,
        kubikasiBoxM3: 15.5,
        maxPayloadKg: 4800
      },
      {
        id: 'preset-cdd-long',
        label: '[STANDAR] Truk CDD Long Box (22,00 m³ / 6.500 Kg)',
        plateNumber: 'CDD LONG',
        panjangBoxCm: 530,
        lebarBoxCm: 205,
        tinggiBoxCm: 202,
        kubikasiBoxM3: 22.0,
        maxPayloadKg: 6500
      }
    ];

    return [...mappedFromStore, ...standardPresets];
  }, []);

  const [selectedFleetId, setSelectedFleetId] = useState<string>(() => fleetPresets[0]?.id || 'preset-cdd-box');
  const [boxPanjangCm, setBoxPanjangCm] = useState<number>(() => fleetPresets[0]?.panjangBoxCm || 420);
  const [boxLebarCm, setBoxLebarCm] = useState<number>(() => fleetPresets[0]?.lebarBoxCm || 190);
  const [boxTinggiCm, setBoxTinggiCm] = useState<number>(() => fleetPresets[0]?.tinggiBoxCm || 185);
  const [boxKubikasiM3, setBoxKubikasiM3] = useState<number>(() => fleetPresets[0]?.kubikasiBoxM3 || 14.76);
  const [maxPayloadKg, setMaxPayloadKg] = useState<number>(() => fleetPresets[0]?.maxPayloadKg || 4500);
  const [stackingEfficiencyPct, setStackingEfficiencyPct] = useState<number>(90);

  // Select item form state
  const [selectedSkuId, setSelectedSkuId] = useState<string>(() => enrichedSkus[0]?.id || '');
  const [inputQty, setInputQty] = useState<number>(80);

  // Simulated Cargo Manifest (initialized with 3 realistic items)
  const [cargoList, setCargoList] = useState<SimulatedCargoItem[]>(() => {
    const initial: SimulatedCargoItem[] = [];
    const s0 = enrichedSkus[0];
    const s1 = enrichedSkus[1];
    const s2 = enrichedSkus[2];
    if (s0) {
      initial.push({
        id: 'sim-1',
        skuId: s0.id,
        noBarang: s0.noBarang,
        namaBarang: s0.namaBarang,
        satuan: s0.satuan,
        panjangCm: s0.panjangCm,
        lebarCm: s0.lebarCm,
        tinggiCm: s0.tinggiCm,
        kubikasiUnitM3: s0.kubikasiM3,
        beratUnitKg: s0.beratKg,
        qtyMuat: 50
      });
    }
    if (s1) {
      initial.push({
        id: 'sim-2',
        skuId: s1.id,
        noBarang: s1.noBarang,
        namaBarang: s1.namaBarang,
        satuan: s1.satuan,
        panjangCm: s1.panjangCm,
        lebarCm: s1.lebarCm,
        tinggiCm: s1.tinggiCm,
        kubikasiUnitM3: s1.kubikasiM3,
        beratUnitKg: s1.beratKg,
        qtyMuat: 20
      });
    }
    if (s2) {
      initial.push({
        id: 'sim-3',
        skuId: s2.id,
        noBarang: s2.noBarang,
        namaBarang: s2.namaBarang,
        satuan: s2.satuan,
        panjangCm: s2.panjangCm,
        lebarCm: s2.lebarCm,
        tinggiCm: s2.tinggiCm,
        kubikasiUnitM3: s2.kubikasiM3,
        beratUnitKg: s2.beratKg,
        qtyMuat: 250
      });
    }
    return initial;
  });

  const handleSelectFleetPreset = (presetId: string) => {
    setSelectedFleetId(presetId);
    const found = fleetPresets.find(f => f.id === presetId);
    if (found) {
      setBoxPanjangCm(found.panjangBoxCm);
      setBoxLebarCm(found.lebarBoxCm);
      setBoxTinggiCm(found.tinggiBoxCm);
      setBoxKubikasiM3(found.kubikasiBoxM3);
      setMaxPayloadKg(found.maxPayloadKg);
    }
  };

  const handleRecalculateBoxM3FromDimensions = (p: number, l: number, t: number) => {
    setBoxPanjangCm(p);
    setBoxLebarCm(l);
    setBoxTinggiCm(t);
    setBoxKubikasiM3(Number(((p * l * t) / 1_000_000).toFixed(2)));
  };

  const handleAddCargoItem = (e: React.FormEvent) => {
    e.preventDefault();
    const targetSku = enrichedSkus.find(s => s.id === selectedSkuId) || enrichedSkus[0];
    if (!targetSku) return;
    const qty = Math.max(1, Number(inputQty) || 1);

    setCargoList(prev => {
      const existingIdx = prev.findIndex(c => c.skuId === targetSku.id);
      if (existingIdx >= 0) {
        const clone = [...prev];
        clone[existingIdx] = {
          ...clone[existingIdx],
          qtyMuat: clone[existingIdx].qtyMuat + qty
        };
        return clone;
      }
      return [
        ...prev,
        {
          id: `sim-${Date.now()}`,
          skuId: targetSku.id,
          noBarang: targetSku.noBarang,
          namaBarang: targetSku.namaBarang,
          satuan: targetSku.satuan,
          panjangCm: targetSku.panjangCm,
          lebarCm: targetSku.lebarCm,
          tinggiCm: targetSku.tinggiCm,
          kubikasiUnitM3: targetSku.kubikasiM3,
          beratUnitKg: targetSku.beratKg,
          qtyMuat: qty
        }
      ];
    });
  };

  const handleUpdateCargoQty = (id: string, nextQty: number) => {
    setCargoList(prev =>
      prev.map(item => (item.id === id ? { ...item, qtyMuat: Math.max(1, nextQty) } : item))
    );
  };

  const handleRemoveCargoItem = (id: string) => {
    setCargoList(prev => prev.filter(item => item.id !== id));
  };

  // Calculations
  const effectiveBoxCapacityM3 = useMemo(
    () => Number(((boxKubikasiM3 * stackingEfficiencyPct) / 100).toFixed(2)),
    [boxKubikasiM3, stackingEfficiencyPct]
  );

  const totalCargoKubikasiM3 = useMemo(
    () => cargoList.reduce((acc, item) => acc + item.kubikasiUnitM3 * item.qtyMuat, 0),
    [cargoList]
  );

  const totalCargoBeratKg = useMemo(
    () => cargoList.reduce((acc, item) => acc + item.beratUnitKg * item.qtyMuat, 0),
    [cargoList]
  );

  const volumeUsagePct = effectiveBoxCapacityM3 > 0 ? (totalCargoKubikasiM3 / effectiveBoxCapacityM3) * 100 : 0;
  const weightUsagePct = maxPayloadKg > 0 ? (totalCargoBeratKg / maxPayloadKg) * 100 : 0;
  const remainingVolumeM3 = effectiveBoxCapacityM3 - totalCargoKubikasiM3;
  const remainingWeightKg = maxPayloadKg - totalCargoBeratKg;

  const isOverVolume = totalCargoKubikasiM3 > effectiveBoxCapacityM3;
  const isOverWeight = totalCargoBeratKg > maxPayloadKg;
  const requiredFleetsCount = Math.max(
    1,
    Math.ceil(
      Math.max(
        effectiveBoxCapacityM3 > 0 ? totalCargoKubikasiM3 / effectiveBoxCapacityM3 : 1,
        maxPayloadKg > 0 ? totalCargoBeratKg / maxPayloadKg : 1
      )
    )
  );

  // Selected SKU preview for how many more units can still fit
  const activeSelectedSku = enrichedSkus.find(s => s.id === selectedSkuId) || enrichedSkus[0];
  const maxAdditionalUnitsByVolume =
    activeSelectedSku && activeSelectedSku.kubikasiM3 > 0 && remainingVolumeM3 > 0
      ? Math.floor(remainingVolumeM3 / activeSelectedSku.kubikasiM3)
      : 0;
  const maxAdditionalUnitsByWeight =
    activeSelectedSku && activeSelectedSku.beratKg > 0 && remainingWeightKg > 0
      ? Math.floor(remainingWeightKg / activeSelectedSku.beratKg)
      : 0;
  const maxAdditionalUnitsFit = Math.max(0, Math.min(maxAdditionalUnitsByVolume, maxAdditionalUnitsByWeight));

  const handleExportSimulationExcel = () => {
    const rows = cargoList.map((c, idx) => ({
      No: idx + 1,
      'No Barang': c.noBarang,
      'Nama Barang': c.namaBarang,
      'Dimensi Unit (cm)': `${c.panjangCm}x${c.lebarCm}x${c.tinggiCm}`,
      'Kubikasi / Unit (m3)': c.kubikasiUnitM3,
      'Berat / Unit (Kg)': c.beratUnitKg,
      'Qty Muat': c.qtyMuat,
      Satuan: c.satuan,
      'Subtotal Kubikasi (m3)': Number((c.kubikasiUnitM3 * c.qtyMuat).toFixed(3)),
      'Subtotal Berat (Kg)': Number((c.beratUnitKg * c.qtyMuat).toFixed(2)),
      '% dari Kapasitas Efektif Box': `${
        effectiveBoxCapacityM3 > 0
          ? (((c.kubikasiUnitM3 * c.qtyMuat) / effectiveBoxCapacityM3) * 100).toFixed(1)
          : '0'
      }%`
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Simulasi_Kubikasi_Armada');
    XLSX.writeFile(wb, `Simulasi_Kubikasi_Box_Armada_AKK_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  return (
    <div className="space-y-5">
      {/* Header Banner */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-lg bg-amber-50 dark:bg-amber-500/15 border border-amber-200 dark:border-amber-500/30 text-amber-700 dark:text-amber-300 text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5">
              <Truck className="w-3.5 h-3.5" />
              <span>WMS &bull; Kalkulator &amp; Simulasi Muatan Armada</span>
            </span>
          </div>
          <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-white tracking-tight">
            Simulasi Kubikasi Box Armada vs. Kubikasi Item Barang
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Simulasikan kecukupan ruang box armada (m&sup3;) dan daya angkut beban (Kg) terhadap daftar item barang yang akan dimuat sebelum penerbitan jadwal kirim.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setCargoList([])}
            className="px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 text-slate-700 dark:text-slate-200 text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Reset Muatan</span>
          </button>
          <button
            type="button"
            onClick={handleExportSimulationExcel}
            className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1.5 transition cursor-pointer shadow-xs"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Ekspor Simulasi Excel</span>
          </button>
        </div>
      </div>

      {/* Main Grid: Left = Konfigurasi Box Armada, Right = Hasil Simulasi & Visualisasi */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* LEFT COLUMN (5 COLS): SPESIFIKASI BOX ARMADA & FORM TAMBAH BARANG */}
        <div className="lg:col-span-5 space-y-4">
          {/* Card 1: Pilih Armada & Spesifikasi Box */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Truck className="w-4 h-4 text-amber-500" />
                <h3 className="text-xs font-black uppercase tracking-wider text-slate-900 dark:text-white">
                  1. Pilih Armada &amp; Ukuran Box Truk
                </h3>
              </div>
              <span className="text-[10px] font-mono font-bold text-amber-600 dark:text-amber-400">
                Terintegrasi Data Armada
              </span>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-600 dark:text-slate-400 mb-1">
                  Pilih Unit Armada AKK / Tipe Box Truk
                </label>
                <select
                  value={selectedFleetId}
                  onChange={e => handleSelectFleetPreset(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white font-bold cursor-pointer"
                >
                  {fleetPresets.map(fp => (
                    <option key={fp.id} value={fp.id}>
                      {fp.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-3 gap-2.5">
                <div>
                  <label className="block font-bold text-slate-500 dark:text-slate-400 text-[10px] uppercase mb-1">
                    Panjang Box (cm)
                  </label>
                  <input
                    type="number"
                    min={50}
                    value={boxPanjangCm}
                    onChange={e =>
                      handleRecalculateBoxM3FromDimensions(Number(e.target.value), boxLebarCm, boxTinggiCm)
                    }
                    className="w-full px-2.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white font-mono font-bold"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-500 dark:text-slate-400 text-[10px] uppercase mb-1">
                    Lebar Box (cm)
                  </label>
                  <input
                    type="number"
                    min={50}
                    value={boxLebarCm}
                    onChange={e =>
                      handleRecalculateBoxM3FromDimensions(boxPanjangCm, Number(e.target.value), boxTinggiCm)
                    }
                    className="w-full px-2.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white font-mono font-bold"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-500 dark:text-slate-400 text-[10px] uppercase mb-1">
                    Tinggi Box (cm)
                  </label>
                  <input
                    type="number"
                    min={50}
                    value={boxTinggiCm}
                    onChange={e =>
                      handleRecalculateBoxM3FromDimensions(boxPanjangCm, boxLebarCm, Number(e.target.value))
                    }
                    className="w-full px-2.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white font-mono font-bold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2.5">
                <div>
                  <label className="block font-bold text-slate-500 dark:text-slate-400 text-[10px] uppercase mb-1">
                    Kubikasi Box (m&sup3;)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    min={0.5}
                    value={boxKubikasiM3}
                    onChange={e => setBoxKubikasiM3(Number(e.target.value))}
                    className="w-full px-2.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-amber-600 dark:text-amber-400 font-mono font-black"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-500 dark:text-slate-400 text-[10px] uppercase mb-1">
                    Efisiensi Susun (%)
                  </label>
                  <input
                    type="number"
                    min={50}
                    max={100}
                    value={stackingEfficiencyPct}
                    onChange={e => setStackingEfficiencyPct(Math.min(100, Math.max(50, Number(e.target.value))))}
                    className="w-full px-2.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white font-mono font-bold"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-500 dark:text-slate-400 text-[10px] uppercase mb-1">
                    Batas Berat (Kg)
                  </label>
                  <input
                    type="number"
                    min={100}
                    value={maxPayloadKg}
                    onChange={e => setMaxPayloadKg(Number(e.target.value))}
                    className="w-full px-2.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-blue-600 dark:text-blue-400 font-mono font-black"
                  />
                </div>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 flex items-center justify-between text-[11px]">
                <span className="text-slate-500 font-semibold">
                  Kapasitas Ruang Efektif ({stackingEfficiencyPct}% dari {boxKubikasiM3} m&sup3;):
                </span>
                <span className="font-mono font-black text-slate-900 dark:text-white">
                  {effectiveBoxCapacityM3.toFixed(2)} m&sup3;
                </span>
              </div>
            </div>
          </div>

          {/* Card 2: Tambah Item Barang ke Simulasi */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Package className="w-4 h-4 text-emerald-500" />
                <h3 className="text-xs font-black uppercase tracking-wider text-slate-900 dark:text-white">
                  2. Tambah Item Barang ke Box Armada
                </h3>
              </div>
            </div>

            <form onSubmit={handleAddCargoItem} className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-600 dark:text-slate-400 mb-1">
                  Pilih Barang dari Master SKU &amp; Kubikasi
                </label>
                <select
                  value={selectedSkuId}
                  onChange={e => setSelectedSkuId(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white font-bold cursor-pointer"
                >
                  {enrichedSkus.map(s => (
                    <option key={s.id} value={s.id}>
                      [{s.noBarang}] {s.namaBarang} ({s.kubikasiM3} m³ | {s.beratKg} Kg/{s.satuan})
                    </option>
                  ))}
                </select>
              </div>

              {activeSelectedSku && (
                <div className="p-3 rounded-xl bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/60 space-y-1 text-[11px]">
                  <div className="flex justify-between">
                    <span className="text-slate-600 dark:text-slate-400">Dimensi &amp; Kubikasi Satuan:</span>
                    <span className="font-mono font-bold text-slate-900 dark:text-white">
                      {activeSelectedSku.panjangCm}&times;{activeSelectedSku.lebarCm}&times;{activeSelectedSku.tinggiCm} cm ={' '}
                      <strong className="text-emerald-600 dark:text-emerald-400">{activeSelectedSku.kubikasiM3} m&sup3;</strong>
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-600 dark:text-slate-400">Estimasi Sisa Muat Barang Ini di Box:</span>
                    <span className="font-mono font-black text-indigo-600 dark:text-indigo-400">
                      Maks. +{maxAdditionalUnitsFit.toLocaleString('id-ID')} {activeSelectedSku.satuan} lagi
                    </span>
                  </div>
                </div>
              )}

              <div className="flex items-end gap-3">
                <div className="flex-1">
                  <label className="block font-bold text-slate-600 dark:text-slate-400 mb-1">
                    Jumlah Muat ({activeSelectedSku?.satuan || 'Unit'})
                  </label>
                  <input
                    type="number"
                    min={1}
                    required
                    value={inputQty}
                    onChange={e => setInputQty(Number(e.target.value))}
                    className="w-full px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white font-mono font-black"
                  />
                </div>
                <button
                  type="submit"
                  className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold flex items-center gap-1.5 transition cursor-pointer shadow-xs shrink-0"
                >
                  <Plus className="w-4 h-4" />
                  <span>Tambah ke Simulasi</span>
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* RIGHT COLUMN (7 COLS): VISUALISASI KUBIKASI BOX & TABEL MANIFEST */}
        <div className="lg:col-span-7 space-y-4">
          {/* 3 Summary Comparison Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
            {/* Kubikasi Card */}
            <div
              className={`p-4 rounded-2xl border shadow-xs ${
                isOverVolume
                  ? 'bg-rose-50/70 dark:bg-rose-950/25 border-rose-300 dark:border-rose-800'
                  : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800'
              }`}
            >
              <div className="text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                Total Kubikasi Barang vs Box
              </div>
              <div className="text-lg font-black font-mono text-slate-900 dark:text-white">
                {totalCargoKubikasiM3.toFixed(2)}{' '}
                <span className="text-xs font-normal text-slate-400">/ {effectiveBoxCapacityM3.toFixed(2)} m&sup3;</span>
              </div>
              <div
                className={`text-[11px] font-bold mt-1 ${
                  isOverVolume ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'
                }`}
              >
                {isOverVolume
                  ? `Melebihi Box +${Math.abs(remainingVolumeM3).toFixed(2)} m³ (${volumeUsagePct.toFixed(1)}%)`
                  : `Sisa Ruang: ${remainingVolumeM3.toFixed(2)} m³ (${volumeUsagePct.toFixed(1)}% Terisi)`}
              </div>
            </div>

            {/* Berat Card */}
            <div
              className={`p-4 rounded-2xl border shadow-xs ${
                isOverWeight
                  ? 'bg-rose-50/70 dark:bg-rose-950/25 border-rose-300 dark:border-rose-800'
                  : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800'
              }`}
            >
              <div className="text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                Total Berat Muatan vs Armada
              </div>
              <div className="text-lg font-black font-mono text-slate-900 dark:text-white">
                {totalCargoBeratKg.toLocaleString('id-ID', { maximumFractionDigits: 1 })}{' '}
                <span className="text-xs font-normal text-slate-400">/ {maxPayloadKg.toLocaleString('id-ID')} Kg</span>
              </div>
              <div
                className={`text-[11px] font-bold mt-1 ${
                  isOverWeight ? 'text-rose-600 dark:text-rose-400' : 'text-blue-600 dark:text-blue-400'
                }`}
              >
                {isOverWeight
                  ? `Overload +${Math.abs(remainingWeightKg).toFixed(1)} Kg (${weightUsagePct.toFixed(1)}%)`
                  : `Sisa Beban: ${remainingWeightKg.toFixed(1)} Kg (${weightUsagePct.toFixed(1)}% Terpakai)`}
              </div>
            </div>

            {/* Status & Rekomendasi Armada Card */}
            <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
              <div className="text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                Rekomendasi Kebutuhan Armada
              </div>
              <div className="flex items-center gap-2">
                {isOverVolume || isOverWeight ? (
                  <AlertTriangle className="w-5 h-5 text-rose-500 shrink-0" />
                ) : (
                  <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
                )}
                <span className="text-base font-black text-slate-900 dark:text-white">
                  {requiredFleetsCount} Unit Armada
                </span>
              </div>
              <div className="text-[11px] text-slate-500 mt-1">
                {isOverVolume || isOverWeight
                  ? 'Muatan melebihi kapasitas 1 box truk'
                  : 'Muatan aman dalam 1 box armada'}
              </div>
            </div>
          </div>

          {/* Visual 3D-Styled Box Container Fill Indicator */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="text-xs font-black uppercase tracking-wider text-slate-900 dark:text-white">
                  Visualisasi Keterisian Ruang Box Armada ({boxPanjangCm}&times;{boxLebarCm}&times;{boxTinggiCm} cm)
                </h3>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Proporsi penggunaan kubikasi box oleh masing-masing item barang yang dimuat.
                </p>
              </div>
              <span
                className={`px-2.5 py-1 rounded-lg font-mono text-xs font-black ${
                  isOverVolume
                    ? 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30'
                    : volumeUsagePct > 85
                    ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30'
                    : 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30'
                }`}
              >
                {volumeUsagePct.toFixed(1)}% Kubikasi Box
              </span>
            </div>

            {/* Stacked Visual Truck Box Container */}
            <div className="relative h-14 w-full rounded-2xl bg-slate-100 dark:bg-slate-950 border-2 border-slate-300 dark:border-slate-700 overflow-hidden flex items-stretch shadow-inner">
              {cargoList.map((item, idx) => {
                const subM3 = item.kubikasiUnitM3 * item.qtyMuat;
                const pct = effectiveBoxCapacityM3 > 0 ? Math.min(100, (subM3 / effectiveBoxCapacityM3) * 100) : 0;
                if (pct <= 0) return null;
                const colorClass = CARGO_COLORS[idx % CARGO_COLORS.length];
                return (
                  <div
                    key={item.id}
                    style={{ width: `${pct}%` }}
                    title={`${item.namaBarang}: ${subM3.toFixed(2)} m³ (${pct.toFixed(1)}%)`}
                    className={`${colorClass} h-full border-r border-white/20 flex items-center justify-center text-[10px] font-mono font-black text-white overflow-hidden transition-all duration-300`}
                  >
                    {pct >= 9 ? `${pct.toFixed(0)}%` : ''}
                  </div>
                );
              })}

              {remainingVolumeM3 > 0 && (
                <div className="flex-1 flex items-center justify-center text-[10px] font-mono font-bold text-slate-400">
                  Kosong {remainingVolumeM3.toFixed(2)} m&sup3;
                </div>
              )}
            </div>

            {/* Legend */}
            <div className="flex flex-wrap items-center gap-3 pt-1">
              {cargoList.map((item, idx) => {
                const subM3 = item.kubikasiUnitM3 * item.qtyMuat;
                const colorClass = CARGO_COLORS[idx % CARGO_COLORS.length];
                return (
                  <div key={item.id} className="flex items-center gap-1.5 text-[11px]">
                    <span className={`w-2.5 h-2.5 rounded-xs ${colorClass}`} />
                    <span className="font-bold text-slate-700 dark:text-slate-300">{item.noBarang}</span>
                    <span className="font-mono text-slate-500">({subM3.toFixed(2)} m&sup3;)</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Table Daftar Simulasi Muatan Item Barang */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-xs">
            <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-black text-slate-900 dark:text-white">
                  Rincian Simulasi Item Barang di Dalam Box Armada
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Ubah angka <strong>Qty Muat</strong> secara langsung untuk melihat perubahan kubikasi dan tonase secara real-time.
                </p>
              </div>
              <span className="text-xs font-bold text-slate-500">
                {cargoList.length} Jenis Item
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-50 dark:bg-slate-950 text-slate-600 dark:text-slate-400 uppercase font-bold text-[10px] border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="py-3 px-4">Item Barang</th>
                    <th className="py-3 px-4 text-center">Kubikasi &amp; Berat / Unit</th>
                    <th className="py-3 px-4 text-center">Qty Muat</th>
                    <th className="py-3 px-4 text-right">Subtotal Kubikasi</th>
                    <th className="py-3 px-4 text-right">Subtotal Berat</th>
                    <th className="py-3 px-4 text-right">% Ruang Box</th>
                    <th className="py-3 px-4 text-right">Hapus</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800 text-slate-800 dark:text-slate-200">
                  {cargoList.length > 0 ? (
                    cargoList.map(item => {
                      const subM3 = item.kubikasiUnitM3 * item.qtyMuat;
                      const subKg = item.beratUnitKg * item.qtyMuat;
                      const pctBox = effectiveBoxCapacityM3 > 0 ? (subM3 / effectiveBoxCapacityM3) * 100 : 0;

                      return (
                        <tr key={item.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition">
                          <td className="py-3 px-4">
                            <div className="font-mono font-bold text-indigo-600 dark:text-indigo-400">{item.noBarang}</div>
                            <div className="font-bold text-slate-900 dark:text-white max-w-[200px] leading-snug">
                              {item.namaBarang}
                            </div>
                            <div className="text-[10px] text-slate-400 font-mono">
                              Dimensi: {item.panjangCm}&times;{item.lebarCm}&times;{item.tinggiCm} cm
                            </div>
                          </td>

                          <td className="py-3 px-4 text-center font-mono">
                            <div className="font-bold text-emerald-600 dark:text-emerald-400">
                              {item.kubikasiUnitM3.toFixed(4)} m&sup3;
                            </div>
                            <div className="text-[10px] text-blue-500">
                              {item.beratUnitKg} Kg / {item.satuan}
                            </div>
                          </td>

                          <td className="py-3 px-4 text-center">
                            <div className="inline-flex items-center gap-1">
                              <input
                                type="number"
                                min={1}
                                value={item.qtyMuat}
                                onChange={e => handleUpdateCargoQty(item.id, Number(e.target.value))}
                                className="w-20 px-2 py-1 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 text-center font-mono font-black text-slate-900 dark:text-white"
                              />
                              <span className="text-[10px] text-slate-500 font-semibold">{item.satuan}</span>
                            </div>
                          </td>

                          <td className="py-3 px-4 text-right font-mono font-black text-emerald-600 dark:text-emerald-400">
                            {subM3.toFixed(3)} m&sup3;
                          </td>

                          <td className="py-3 px-4 text-right font-mono font-bold text-slate-900 dark:text-white">
                            {subKg.toFixed(1)} Kg
                          </td>

                          <td className="py-3 px-4 text-right font-mono font-bold text-amber-600 dark:text-amber-400">
                            {pctBox.toFixed(1)}%
                          </td>

                          <td className="py-3 px-4 text-right">
                            <button
                              type="button"
                              onClick={() => handleRemoveCargoItem(item.id)}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-500/10 transition cursor-pointer"
                              title="Hapus dari Simulasi"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-slate-400 text-xs">
                        Belum ada item barang dalam simulasi muatan. Pilih barang di panel kiri lalu klik <strong>Tambah ke Simulasi</strong>.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
