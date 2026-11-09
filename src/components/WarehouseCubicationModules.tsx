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
import { databaseBarangService, isLegacySeededBarang } from '../services/databaseBarangService';

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
    typeof existingAny.lebarCm === 'number' &&
    typeof existingAny.tinggiCm === 'number'
  ) {
    const pVal = Number(existingAny.panjangCm) || 0;
    const lVal = Number(existingAny.lebarCm) || 0;
    const tVal = Number(existingAny.tinggiCm) || 0;
    const calcM3 =
      typeof existingAny.kubikasiM3 === 'number' && existingAny.kubikasiM3 > 0
        ? existingAny.kubikasiM3
        : (pVal > 0 && lVal > 0 && tVal > 0 ? Number(((pVal * lVal * tVal) / 1_000_000).toFixed(4)) : 0);
    return {
      ...sku,
      panjangCm: pVal,
      lebarCm: lVal,
      tinggiCm: tVal,
      kubikasiM3: calcM3,
      beratKg: Number(existingAny.beratKg) || 0
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
  const enrichedList = useMemo(
    () => skuItems.filter(s => !isLegacySeededBarang(s.noBarang)).map(enrichSkuWithCubication),
    [skuItems]
  );

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
                  const targetCode = deletingItem.noBarang.trim().toUpperCase();
                  const updated = skuItems.filter(
                    s => s.id !== deletingItem.id && s.noBarang.trim().toUpperCase() !== targetCode
                  );
                  onUpdateSkuItems(updated);
                  const dbList = databaseBarangService
                    .getAll()
                    .filter(i => i.id !== deletingItem.id && i.noBarang.trim().toUpperCase() !== targetCode);
                  databaseBarangService.saveAll(dbList);
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
  kubikasiBoxGrossM3: number;
  innerMultiplierPct: number;
  kubikasiBoxNettoM3: number;
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

const CARGO_HEX_COLORS = [
  { fill: '#10b981', stroke: '#047857', text: '#ecfdf5' },
  { fill: '#6366f1', stroke: '#4338ca', text: '#eef2ff' },
  { fill: '#f59e0b', stroke: '#b45309', text: '#fffbeb' },
  { fill: '#06b6d4', stroke: '#0e7490', text: '#ecfeff' },
  { fill: '#a855f7', stroke: '#7e22ce', text: '#faf5ff' },
  { fill: '#f43f5e', stroke: '#be123c', text: '#fff1f2' }
];

export const WarehouseFleetCubicationSimulator: React.FC<{
  skuItems: MasterSkuRecord[];
}> = ({ skuItems }) => {
  // 1. Integrasi Langsung dengan Database Barang pada Sub-Menu Gudang (Dimensi P x L x T, Vol m³, Berat Kg)
  const [dbBarangRecords, setDbBarangRecords] = useState(() => databaseBarangService.getAll());
  const [storeFleets, setStoreFleets] = useState(() => logisticsStore.getFleets());
  const [sim2dViewMode, setSim2dViewMode] = useState<'both' | 'side' | 'top'>('both');
  const [skuSearchFilter, setSkuSearchFilter] = useState<string>('');

  useEffect(() => {
    void databaseBarangService.ensureHydrated().then(items => {
      setDbBarangRecords(items);
    });
    const syncDb = () => {
      setDbBarangRecords(databaseBarangService.getAll());
    };
    const syncFleets = () => {
      setStoreFleets(logisticsStore.getFleets());
    };
    const unsubStore = logisticsStore.subscribe(syncFleets);
    window.addEventListener('akk-database-barang-updated', syncDb);
    window.addEventListener('storage', syncDb);
    return () => {
      unsubStore();
      window.removeEventListener('akk-database-barang-updated', syncDb);
      window.removeEventListener('storage', syncDb);
    };
  }, []);

  const enrichedSkus = useMemo<SkuCubicationRecord[]>(() => {
    const map = new Map<string, SkuCubicationRecord>();

    // Muat seluruh barang dari Database Barang Gudang (Sub-Menu Gudang)
    dbBarangRecords.forEach(rec => {
      const code = (rec.noBarang || '').trim().toUpperCase();
      if (!code || isLegacySeededBarang(code)) return;
      const baseSku: MasterSkuRecord = {
        id: rec.id || `db-${code}`,
        kategoriBarang: inferKategoriBarang(code, rec.keteranganBarang || ''),
        noBarang: code,
        namaBarang: rec.keteranganBarang || code,
        stokTersedia: 1000,
        satuan: rec.unit3 || rec.satuan || 'CRT',
        panjangCm: rec.panjangCm && rec.panjangCm > 0 ? rec.panjangCm : undefined,
        lebarCm: rec.lebarCm && rec.lebarCm > 0 ? rec.lebarCm : undefined,
        tinggiCm: rec.tinggiCm && rec.tinggiCm > 0 ? rec.tinggiCm : undefined,
        kubikasiM3: rec.volM3 && rec.volM3 > 0 ? rec.volM3 : undefined,
        beratKg: rec.beratKg && rec.beratKg > 0 ? rec.beratKg : undefined
      };
      map.set(code, enrichSkuWithCubication(baseSku));
    });

    // Gabungkan juga dari prop skuItems jika ada tambahan/override
    skuItems.forEach(s => {
      const code = (s.noBarang || '').trim().toUpperCase();
      if (!code || isLegacySeededBarang(code)) return;
      const enriched = enrichSkuWithCubication(s);
      const existing = map.get(code);
      if (!existing) {
        map.set(code, enriched);
      } else {
        map.set(code, {
          ...existing,
          ...enriched,
          panjangCm: enriched.panjangCm || existing.panjangCm,
          lebarCm: enriched.lebarCm || existing.lebarCm,
          tinggiCm: enriched.tinggiCm || existing.tinggiCm,
          kubikasiM3: enriched.kubikasiM3 || existing.kubikasiM3,
          beratKg: enriched.beratKg || existing.beratKg
        });
      }
    });

    return Array.from(map.values());
  }, [dbBarangRecords, skuItems]);

  const filteredSelectableSkus = useMemo(() => {
    const q = skuSearchFilter.trim().toLowerCase();
    if (!q) return enrichedSkus;
    return enrichedSkus.filter(
      s =>
        s.noBarang.toLowerCase().includes(q) ||
        s.namaBarang.toLowerCase().includes(q) ||
        s.kategoriBarang.toLowerCase().includes(q)
    );
  }, [enrichedSkus, skuSearchFilter]);

  // 2. Integrasi Data Armada & Faktor Pengali Dimensi Dalam (boxInnerMultiplierPercent)
  const fleetPresets = useMemo<FleetBoxPreset[]>(() => {
    const mappedFromStore: FleetBoxPreset[] = storeFleets.map(f => {
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

      const multiplierPct =
        typeof f.boxInnerMultiplierPercent === 'number' && f.boxInnerMultiplierPercent > 0
          ? f.boxInnerMultiplierPercent
          : 90;
      const calcGrossFromDim = Number(((p * l * t) / 1_000_000).toFixed(2));
      const grossM3 =
        typeof f.boxCapacityM3 === 'number' && f.boxCapacityM3 > 0
          ? Number(f.boxCapacityM3.toFixed(2))
          : calcGrossFromDim;
      const nettoM3 =
        typeof f.boxInnerCapacityM3 === 'number' && f.boxInnerCapacityM3 > 0
          ? Number(f.boxInnerCapacityM3.toFixed(2))
          : Number(((grossM3 * multiplierPct) / 100).toFixed(2));

      // Jika armada punya kubikasi spesifik (misal 5.5 m³) tanpa string dimensi, sesuaikan P x L x T proporsional
      if (!dimMatch && grossM3 > 0 && Math.abs(grossM3 - calcGrossFromDim) > 0.3) {
        const scale = Math.cbrt((grossM3 * 1_000_000) / (p * l * t));
        p = Math.round(p * scale);
        l = Math.round(l * scale);
        t = Math.round(t * scale);
      }

      const fleetName = f.brand ? `${f.brand} ${f.vehicleType}` : f.vehicleType;
      return {
        id: f.id,
        label: `[${f.initialCode || 'ARMADA'}] ${f.plateNumber} — ${fleetName} (Luar: ${grossM3} m³ • Pengali ${multiplierPct}% = Netto ${nettoM3} m³)`,
        plateNumber: f.plateNumber,
        panjangBoxCm: p,
        lebarBoxCm: l,
        tinggiBoxCm: t,
        kubikasiBoxGrossM3: grossM3,
        innerMultiplierPct: multiplierPct,
        kubikasiBoxNettoM3: nettoM3,
        maxPayloadKg: maxKg
      };
    });

    const standardPresets: FleetBoxPreset[] = [
      {
        id: 'preset-cde-box',
        label: '[STANDAR] Truk Engkel CDE Box (Luar: 9,50 m³ • Pengali 90% = Netto 8,55 m³)',
        plateNumber: 'CDE BOX',
        panjangBoxCm: 310,
        lebarBoxCm: 175,
        tinggiBoxCm: 175,
        kubikasiBoxGrossM3: 9.5,
        innerMultiplierPct: 90,
        kubikasiBoxNettoM3: 8.55,
        maxPayloadKg: 2800
      },
      {
        id: 'preset-cdd-box',
        label: '[STANDAR] Truk Double CDD Box (Luar: 15,50 m³ • Pengali 90% = Netto 13,95 m³)',
        plateNumber: 'CDD BOX',
        panjangBoxCm: 425,
        lebarBoxCm: 195,
        tinggiBoxCm: 187,
        kubikasiBoxGrossM3: 15.5,
        innerMultiplierPct: 90,
        kubikasiBoxNettoM3: 13.95,
        maxPayloadKg: 4800
      },
      {
        id: 'preset-cdd-long',
        label: '[STANDAR] Truk CDD Long Box (Luar: 22,00 m³ • Pengali 90% = Netto 19,80 m³)',
        plateNumber: 'CDD LONG',
        panjangBoxCm: 530,
        lebarBoxCm: 205,
        tinggiBoxCm: 202,
        kubikasiBoxGrossM3: 22.0,
        innerMultiplierPct: 90,
        kubikasiBoxNettoM3: 19.8,
        maxPayloadKg: 6500
      }
    ];

    return [...mappedFromStore, ...standardPresets];
  }, [storeFleets]);

  const [selectedFleetId, setSelectedFleetId] = useState<string>(() => fleetPresets[0]?.id || 'preset-cdd-box');
  const [boxPanjangCm, setBoxPanjangCm] = useState<number>(() => fleetPresets[0]?.panjangBoxCm || 420);
  const [boxLebarCm, setBoxLebarCm] = useState<number>(() => fleetPresets[0]?.lebarBoxCm || 190);
  const [boxTinggiCm, setBoxTinggiCm] = useState<number>(() => fleetPresets[0]?.tinggiBoxCm || 185);
  const [boxKubikasiM3, setBoxKubikasiM3] = useState<number>(() => fleetPresets[0]?.kubikasiBoxGrossM3 || 14.76);
  const [maxPayloadKg, setMaxPayloadKg] = useState<number>(() => fleetPresets[0]?.maxPayloadKg || 4500);
  // Faktor Pengali Dimensi Dalam (%) dari Data Armada (default 90%)
  const [innerMultiplierPct, setInnerMultiplierPct] = useState<number>(
    () => fleetPresets[0]?.innerMultiplierPct ?? 90
  );

  // Select item form state
  const [selectedSkuId, setSelectedSkuId] = useState<string>(() => enrichedSkus[0]?.id || '');
  const [inputQty, setInputQty] = useState<number>(25);

  useEffect(() => {
    if ((!selectedSkuId || !enrichedSkus.some(s => s.id === selectedSkuId)) && enrichedSkus.length > 0) {
      setSelectedSkuId(enrichedSkus[0].id);
    }
  }, [enrichedSkus, selectedSkuId]);

  // Simulated Cargo Manifest (initialized from enrichedSkus)
  const [cargoList, setCargoList] = useState<SimulatedCargoItem[]>([]);
  const hasSeededCargoRef = React.useRef(false);

  useEffect(() => {
    if (hasSeededCargoRef.current || enrichedSkus.length === 0) return;
    hasSeededCargoRef.current = true;
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
        qtyMuat: 24
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
        qtyMuat: 18
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
        qtyMuat: 16
      });
    }
    setCargoList(initial);
  }, [enrichedSkus]);

  const handleSelectFleetPreset = (presetId: string) => {
    setSelectedFleetId(presetId);
    const found = fleetPresets.find(f => f.id === presetId);
    if (found) {
      setBoxPanjangCm(found.panjangBoxCm);
      setBoxLebarCm(found.lebarBoxCm);
      setBoxTinggiCm(found.tinggiBoxCm);
      setBoxKubikasiM3(found.kubikasiBoxGrossM3);
      setInnerMultiplierPct(found.innerMultiplierPct);
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
      const existingIdx = prev.findIndex(c => c.skuId === targetSku.id || c.noBarang === targetSku.noBarang);
      if (existingIdx >= 0) {
        const clone = [...prev];
        clone[existingIdx] = {
          ...clone[existingIdx],
          panjangCm: targetSku.panjangCm,
          lebarCm: targetSku.lebarCm,
          tinggiCm: targetSku.tinggiCm,
          kubikasiUnitM3: targetSku.kubikasiM3,
          beratUnitKg: targetSku.beratKg,
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

  // Calculations: Hasil Kubikasi Dalam (Netto) = Kubikasi Luar * (Faktor Pengali Dimensi Dalam / 100)
  const effectiveBoxCapacityM3 = useMemo(
    () => Number(((boxKubikasiM3 * innerMultiplierPct) / 100).toFixed(2)),
    [boxKubikasiM3, innerMultiplierPct]
  );

  // Dimensi Dalam Efektif (cm) setelah dikalikan Faktor Pengali Dimensi Dalam (cbrt dari rasio volume dalam)
  const linearInnerRatio = useMemo(
    () => Math.cbrt(Math.max(0.1, Math.min(1, innerMultiplierPct / 100))),
    [innerMultiplierPct]
  );
  const innerPanjangCm = useMemo(() => Math.max(40, Math.round(boxPanjangCm * linearInnerRatio)), [boxPanjangCm, linearInnerRatio]);
  const innerLebarCm = useMemo(() => Math.max(40, Math.round(boxLebarCm * linearInnerRatio)), [boxLebarCm, linearInnerRatio]);
  const innerTinggiCm = useMemo(() => Math.max(40, Math.round(boxTinggiCm * linearInnerRatio)), [boxTinggiCm, linearInnerRatio]);

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

  // ============================================================================
  // KALKULASI TATA LETAK 2D SIMULASI BOX ARMADA (TAMPAK SAMPING & TAMPAK ATAS)
  // ============================================================================
  const layout2D = useMemo(() => {
    interface PlacedColSide {
      id: string;
      skuIdx: number;
      noBarang: string;
      namaBarang: string;
      xCm: number;
      wCm: number;
      itemHeightCm: number;
      tiersCount: number;
      unitsInCol: number;
      isOverflow: boolean;
    }

    interface PlacedBlockTop {
      id: string;
      skuIdx: number;
      noBarang: string;
      namaBarang: string;
      xCm: number;
      yCm: number;
      wCm: number;
      dCm: number;
      stackCount: number;
      isOverflow: boolean;
    }

    const sideCols: PlacedColSide[] = [];
    const topBlocks: PlacedBlockTop[] = [];
    const skuZones: Array<{
      id: string;
      skuIdx: number;
      noBarang: string;
      namaBarang: string;
      startXCm: number;
      usedLengthCm: number;
      maxTiersZ: number;
      maxRowsY: number;
      colsNeeded: number;
      qtyMuat: number;
    }> = [];

    let cursorXCm = 0;

    cargoList.forEach((item, idx) => {
      const pCm = Math.max(10, Number(item.panjangCm) || 45);
      const lCm = Math.max(10, Number(item.lebarCm) || 35);
      const tCm = Math.max(10, Number(item.tinggiCm) || 30);

      // Berapa tumpuk ke atas (Tinggi Dalam / Tinggi Barang) dan berapa baris ke samping (Lebar Dalam / Lebar Barang)
      const maxTiersZ = Math.max(1, Math.floor(innerTinggiCm / tCm));
      const maxRowsY = Math.max(1, Math.floor(innerLebarCm / lCm));
      const unitsPerCrossSection = Math.max(1, maxTiersZ * maxRowsY);
      const colsNeeded = Math.ceil(item.qtyMuat / unitsPerCrossSection);
      const startXCm = cursorXCm;

      let remainingUnits = item.qtyMuat;

      for (let c = 0; c < colsNeeded; c++) {
        const colX = cursorXCm;
        const unitsInThisSlice = Math.min(remainingUnits, unitsPerCrossSection);
        const tiersInCol = Math.max(1, Math.min(maxTiersZ, Math.ceil(unitsInThisSlice / maxRowsY)));
        const rowsInCol = Math.max(1, Math.min(maxRowsY, unitsInThisSlice));
        const isOverflow = colX + pCm > innerPanjangCm;

        // Batasi jumlah visual kolom maksimal 60 agar SVG tetap ringan
        if (sideCols.length < 80) {
          sideCols.push({
            id: `${item.id}-col-${c}`,
            skuIdx: idx,
            noBarang: item.noBarang,
            namaBarang: item.namaBarang,
            xCm: colX,
            wCm: pCm,
            itemHeightCm: Math.min(innerTinggiCm, tCm),
            tiersCount: tiersInCol,
            unitsInCol: unitsInThisSlice,
            isOverflow
          });

          for (let r = 0; r < rowsInCol; r++) {
            topBlocks.push({
              id: `${item.id}-top-${c}-${r}`,
              skuIdx: idx,
              noBarang: item.noBarang,
              namaBarang: item.namaBarang,
              xCm: colX,
              yCm: r * Math.min(innerLebarCm, lCm),
              wCm: pCm,
              dCm: Math.min(innerLebarCm, lCm),
              stackCount: Math.min(maxTiersZ, Math.ceil(unitsInThisSlice / rowsInCol)),
              isOverflow
            });
          }
        }

        cursorXCm += pCm;
        remainingUnits -= unitsInThisSlice;
      }

      skuZones.push({
        id: item.id,
        skuIdx: idx,
        noBarang: item.noBarang,
        namaBarang: item.namaBarang,
        startXCm,
        usedLengthCm: colsNeeded * pCm,
        maxTiersZ,
        maxRowsY,
        colsNeeded,
        qtyMuat: item.qtyMuat
      });
    });

    const totalUsedLengthCm = cursorXCm;
    const freeLengthCm = Math.max(0, innerPanjangCm - totalUsedLengthCm);
    const lengthUsagePct = innerPanjangCm > 0 ? (totalUsedLengthCm / innerPanjangCm) * 100 : 0;

    return {
      sideCols,
      topBlocks,
      skuZones,
      totalUsedLengthCm,
      freeLengthCm,
      lengthUsagePct,
      isLengthOverflow: totalUsedLengthCm > innerPanjangCm
    };
  }, [cargoList, innerPanjangCm, innerLebarCm, innerTinggiCm]);

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
      '% dari Kubikasi Dalam Netto': `${
        effectiveBoxCapacityM3 > 0
          ? (((c.kubikasiUnitM3 * c.qtyMuat) / effectiveBoxCapacityM3) * 100).toFixed(1)
          : '0'
      }%`
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Simulasi_Kubikasi_Armada');
    XLSX.writeFile(wb, `Simulasi_2D_Kubikasi_Box_Armada_AKK_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  return (
    <div className="space-y-5">
      {/* Header Banner */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-lg bg-amber-50 dark:bg-amber-500/15 border border-amber-200 dark:border-amber-500/30 text-amber-700 dark:text-amber-300 text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5">
              <Truck className="w-3.5 h-3.5" />
              <span>Simulasi 2D Box Armada &bull; Terintegrasi Database Barang Gudang &amp; Data Armada</span>
            </span>
          </div>
          <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-white tracking-tight">
            Simulasi 2D Susunan Box Armada vs. Dimensi Barang Gudang ({enrichedSkus.length} SKU Terhubung)
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Visualisasi 2D (Tampak Samping &amp; Tampak Atas) tata letak kardus/kemasan dari <strong>Database Barang (Sub-Menu Gudang)</strong> terhadap ukuran dalam box armada setelah dikalikan <strong>Faktor Pengali Dimensi Dalam (%)</strong> dari <strong>Data Armada</strong>.
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

      {/* Main Grid: Left = Konfigurasi Box Armada & Database Barang, Right = 2D Visualisasi & Manifest */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* LEFT COLUMN (5 COLS): SPESIFIKASI BOX ARMADA & FORM TAMBAH BARANG GUDANG */}
        <div className="lg:col-span-5 space-y-4">
          {/* Card 1: Pilih Armada & Faktor Pengali Dimensi Dalam (Integrasi Data Armada) */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Truck className="w-4 h-4 text-amber-500" />
                <h3 className="text-xs font-black uppercase tracking-wider text-slate-900 dark:text-white">
                  1. Pilih Armada &amp; Faktor Pengali Dimensi Dalam
                </h3>
              </div>
              <span className="text-[10px] font-mono font-bold text-amber-600 dark:text-amber-400">
                Sinkron Data Armada
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

              {/* Dimensi Luar Box (cm) */}
              <div className="grid grid-cols-3 gap-2.5">
                <div>
                  <label className="block font-bold text-slate-500 dark:text-slate-400 text-[10px] uppercase mb-1">
                    Panjang Luar (cm)
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
                    Lebar Luar (cm)
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
                    Tinggi Luar (cm)
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

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block font-bold text-slate-500 dark:text-slate-400 text-[10px] uppercase mb-1">
                    Kubikasi Luar / Gross (m&sup3;)
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
                    Batas Beban Armada (Kg)
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

              {/* Faktor Pengali Dimensi Dalam & Hasil Kubikasi Dalam (Netto) — Persis Seperti Data Armada */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-slate-200 dark:border-slate-800 items-center">
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-black text-sky-700 dark:text-sky-400">
                      Faktor Pengali Dimensi Dalam
                    </span>
                    <span className="text-xs font-mono font-black text-amber-600 dark:text-amber-400">
                      {innerMultiplierPct}%
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min={50}
                      max={100}
                      value={innerMultiplierPct}
                      onChange={e =>
                        setInnerMultiplierPct(Math.min(100, Math.max(50, Number(e.target.value) || 90)))
                      }
                      className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-amber-700 dark:text-amber-300 font-mono font-black text-sm"
                    />
                    <span className="font-bold text-slate-500">%</span>
                  </div>
                  <p className="text-[10px] text-slate-500 leading-snug">
                    Dimensi box dikali {innerMultiplierPct}% karena tebal dinding luar &amp; dalam berbeda (Data Armada).
                  </p>
                </div>

                <div className="p-3.5 rounded-2xl bg-sky-900/15 dark:bg-sky-950/50 border border-sky-500/30 space-y-1">
                  <div className="text-[11px] font-bold text-sky-700 dark:text-sky-300">
                    Hasil Kubikasi Dalam (Netto):
                  </div>
                  <div className="text-2xl font-black font-mono text-slate-900 dark:text-white">
                    {effectiveBoxCapacityM3.toFixed(2)}{' '}
                    <span className="text-xs font-bold text-sky-600 dark:text-sky-400">m&sup3;</span>
                  </div>
                  <div className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                    <span>✓ Kapasitas bersih efektif muat</span>
                  </div>
                  <div className="text-[10px] font-mono text-slate-500">
                    Dimensi Dalam: {innerPanjangCm}&times;{innerLebarCm}&times;{innerTinggiCm} cm
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Card 2: Tambah Item Barang dari Database Barang (Sub-Menu Gudang) */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Package className="w-4 h-4 text-emerald-500" />
                <h3 className="text-xs font-black uppercase tracking-wider text-slate-900 dark:text-white">
                  2. Pilih Barang dari Database Barang Gudang
                </h3>
              </div>
              <span className="text-[10px] font-mono font-bold text-emerald-600 dark:text-emerald-400">
                {enrichedSkus.length} SKU Gudang
              </span>
            </div>

            <form onSubmit={handleAddCargoItem} className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-600 dark:text-slate-400 mb-1">
                  Cari Cepat Nomor / Nama Barang Gudang
                </label>
                <div className="relative mb-2">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={skuSearchFilter}
                    onChange={e => setSkuSearchFilter(e.target.value)}
                    placeholder="Ketik kode barang (mis. 7GPJA001) atau nama barang..."
                    className="w-full pl-8 pr-3 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-white"
                  />
                </div>

                <label className="block font-bold text-slate-600 dark:text-slate-400 mb-1">
                  Pilih Barang dari Database Barang (Sub-Menu Gudang)
                </label>
                <select
                  value={selectedSkuId}
                  onChange={e => setSelectedSkuId(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white font-bold cursor-pointer"
                >
                  {filteredSelectableSkus.map(s => (
                    <option key={s.id} value={s.id}>
                      [{s.noBarang}] {s.namaBarang} ({s.panjangCm}×{s.lebarCm}×{s.tinggiCm} cm = {s.kubikasiM3} m³)
                    </option>
                  ))}
                </select>
              </div>

              {activeSelectedSku && (
                <div className="p-3 rounded-xl bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/60 space-y-1 text-[11px]">
                  <div className="flex justify-between">
                    <span className="text-slate-600 dark:text-slate-400">Dimensi Database Barang Gudang:</span>
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
                    Jumlah Muat ({activeSelectedSku?.satuan || 'CRT'})
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
                  <span>Tambah ke Simulasi 2D</span>
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* RIGHT COLUMN (7 COLS): 2D SIMULASI BOX ARMADA & TABEL MANIFEST */}
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
                Kubikasi Barang vs Kubikasi Dalam
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
                  : `Sisa Ruang Netto: ${remainingVolumeM3.toFixed(2)} m³ (${volumeUsagePct.toFixed(1)}% Terisi)`}
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
                {isOverVolume || isOverWeight || layout2D.isLengthOverflow ? (
                  <AlertTriangle className="w-5 h-5 text-rose-500 shrink-0" />
                ) : (
                  <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
                )}
                <span className="text-base font-black text-slate-900 dark:text-white">
                  {requiredFleetsCount} Unit Armada
                </span>
              </div>
              <div className="text-[11px] text-slate-500 mt-1">
                Panjang Terpakai: <strong>{layout2D.totalUsedLengthCm} cm</strong> / {innerPanjangCm} cm
              </div>
            </div>
          </div>

          {/* ========================================================================== */}
          {/* VISUALISASI 2D SIMULASI BOX ARMADA (TAMPAK SAMPING & TAMPAK ATAS)         */}
          {/* ========================================================================== */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-3">
              <div>
                <h3 className="text-xs font-black uppercase tracking-wider text-slate-900 dark:text-white flex items-center gap-2">
                  <Box className="w-4 h-4 text-indigo-500" />
                  <span>
                    Visualisasi 2D Simulasi Box Armada (Dimensi Dalam Efektif {innerPanjangCm}&times;{innerLebarCm}&times;{innerTinggiCm} cm &bull; Pengali {innerMultiplierPct}%)
                  </span>
                </h3>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                  Susunan 2D balok karton berdasarkan ukuran <strong>P &times; L &times; T (cm) Database Barang Gudang</strong> di dalam ruang bersih box armada.
                </p>
              </div>

              <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
                <button
                  type="button"
                  onClick={() => setSim2dViewMode('both')}
                  className={`px-2.5 py-1 rounded-lg text-[10px] font-black cursor-pointer transition ${
                    sim2dViewMode === 'both'
                      ? 'bg-indigo-600 text-white'
                      : 'text-slate-600 dark:text-slate-300'
                  }`}
                >
                  Samping + Atas
                </button>
                <button
                  type="button"
                  onClick={() => setSim2dViewMode('side')}
                  className={`px-2.5 py-1 rounded-lg text-[10px] font-black cursor-pointer transition ${
                    sim2dViewMode === 'side'
                      ? 'bg-indigo-600 text-white'
                      : 'text-slate-600 dark:text-slate-300'
                  }`}
                >
                  Tampak Samping 2D
                </button>
                <button
                  type="button"
                  onClick={() => setSim2dViewMode('top')}
                  className={`px-2.5 py-1 rounded-lg text-[10px] font-black cursor-pointer transition ${
                    sim2dViewMode === 'top'
                      ? 'bg-indigo-600 text-white'
                      : 'text-slate-600 dark:text-slate-300'
                  }`}
                >
                  Tampak Atas 2D
                </button>
              </div>
            </div>

            {/* 1. TAMPAK SAMPING 2D (PANJANG DALAM X TINGGI DALAM) */}
            {(sim2dViewMode === 'both' || sim2dViewMode === 'side') && (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="font-black text-slate-700 dark:text-slate-200 uppercase">
                    A. Tampak Samping 2D (Panjang Dalam {innerPanjangCm} cm &times; Tinggi Dalam {innerTinggiCm} cm)
                  </span>
                  <span className="font-mono text-slate-500">
                    Terisi Panjang: <strong className={layout2D.isLengthOverflow ? 'text-rose-500' : 'text-emerald-500'}>{layout2D.totalUsedLengthCm} cm</strong> / {innerPanjangCm} cm (Sisa {layout2D.freeLengthCm} cm)
                  </span>
                </div>

                <div className="rounded-2xl bg-slate-950 border border-slate-800 p-3 overflow-x-auto">
                  <svg
                    viewBox="0 0 760 250"
                    className="w-full h-auto min-w-[560px]"
                    role="img"
                    aria-label="Simulasi 2D Tampak Samping Box Armada"
                  >
                    {/* Grid Background */}
                    <defs>
                      <pattern id="grid2dSide" width="25" height="25" patternUnits="userSpaceOnUse">
                        <path d="M 25 0 L 0 0 0 25" fill="none" stroke="#1e293b" strokeWidth="1" />
                      </pattern>
                    </defs>
                    <rect x="0" y="0" width="760" height="250" rx="12" fill="#090d16" />
                    <rect x="110" y="22" width="560" height="170" fill="url(#grid2dSide)" />

                    {/* Truck Cabin Silhouette on Left */}
                    <path
                      d="M 25 192 L 25 105 L 58 68 L 104 68 L 104 192 Z"
                      fill="#1e293b"
                      stroke="#475569"
                      strokeWidth="2"
                    />
                    <polygon points="34,105 60,76 96,76 96,105" fill="#0ea5e9" fillOpacity="0.25" stroke="#38bdf8" strokeWidth="1.5" />
                    <text x="64" y="145" textAnchor="middle" fill="#94a3b8" fontSize="10" fontFamily="monospace" fontWeight="bold">
                      KABIN
                    </text>

                    {/* Outer Box Wall (Ukuran Luar Gross: boxPanjangCm x boxTinggiCm) */}
                    <rect
                      x="108"
                      y="18"
                      width="568"
                      height="176"
                      rx="4"
                      fill="#0f172a"
                      fillOpacity="0.6"
                      stroke="#64748b"
                      strokeWidth="2"
                      strokeDasharray="6 3"
                    />
                    <text x="114" y="13" fill="#94a3b8" fontSize="9" fontFamily="monospace">
                      Dinding Luar ({boxPanjangCm}×{boxTinggiCm} cm = {boxKubikasiM3} m³) • Dinding Dalam Efektif ({innerMultiplierPct}% = {effectiveBoxCapacityM3.toFixed(2)} m³)
                    </text>

                    {/* Inner Effective Box Area (Setelah Faktor Pengali Dimensi Dalam) */}
                    <rect
                      x="116"
                      y="26"
                      width="552"
                      height="160"
                      rx="2"
                      fill="#020617"
                      stroke="#10b981"
                      strokeWidth="2"
                    />

                    {/* Overflow Zone on the Right (Rear Door) */}
                    <rect
                      x="668"
                      y="26"
                      width="76"
                      height="160"
                      fill="#4c0519"
                      fillOpacity="0.3"
                      stroke="#f43f5e"
                      strokeWidth="1"
                      strokeDasharray="4 4"
                    />
                    <text x="706" y="42" textAnchor="middle" fill="#fb7185" fontSize="8" fontFamily="monospace" fontWeight="bold">
                      OVERLOAD
                    </text>

                    {/* 2D Stacked Carton Boxes Inside Inner Box */}
                    {layout2D.sideCols.map(col => {
                      const scaleX = 552 / Math.max(1, innerPanjangCm);
                      const scaleY = 160 / Math.max(1, innerTinggiCm);
                      const pxX = 116 + col.xCm * scaleX;
                      const pxW = Math.max(6, col.wCm * scaleX - 1.5);
                      const boxPxH = Math.max(8, col.itemHeightCm * scaleY - 1.5);
                      const palette = CARGO_HEX_COLORS[col.skuIdx % CARGO_HEX_COLORS.length];

                      if (pxX > 740) return null;

                      return (
                        <g key={col.id}>
                          {Array.from({ length: col.tiersCount }).map((_, tierIdx) => {
                            const pyY = 26 + 160 - (tierIdx + 1) * (col.itemHeightCm * scaleY);
                            return (
                              <rect
                                key={`${col.id}-t-${tierIdx}`}
                                x={pxX}
                                y={Math.max(26, pyY)}
                                width={pxW}
                                height={boxPxH}
                                rx="2"
                                fill={col.isOverflow ? '#e11d48' : palette.fill}
                                fillOpacity={0.88}
                                stroke={col.isOverflow ? '#fda4af' : palette.stroke}
                                strokeWidth="1"
                              >
                                <title>
                                  {`[${col.noBarang}] ${col.namaBarang} • Tumpukan ${tierIdx + 1}/${col.tiersCount} (${col.unitsInCol} unit di kolom ini)`}
                                </title>
                              </rect>
                            );
                          })}
                        </g>
                      );
                    })}

                    {/* Zone Labels per SKU at Top of Stack */}
                    {layout2D.skuZones.map(zone => {
                      const scaleX = 552 / Math.max(1, innerPanjangCm);
                      const centerPx = 116 + (zone.startXCm + zone.usedLengthCm / 2) * scaleX;
                      if (centerPx > 735 || zone.usedLengthCm * scaleX < 28) return null;
                      return (
                        <g key={`lbl-side-${zone.id}`}>
                          <rect
                            x={centerPx - 34}
                            y={32}
                            width="68"
                            height="16"
                            rx="4"
                            fill="#0f172a"
                            fillOpacity="0.85"
                            stroke="#334155"
                          />
                          <text
                            x={centerPx}
                            y={43}
                            textAnchor="middle"
                            fill="#f8fafc"
                            fontSize="8.5"
                            fontFamily="monospace"
                            fontWeight="bold"
                          >
                            {zone.noBarang} ({zone.qtyMuat})
                          </text>
                        </g>
                      );
                    })}

                    {/* Chassis & Wheels */}
                    <rect x="20" y="192" width="656" height="8" rx="3" fill="#334155" />
                    <circle cx="66" cy="212" r="16" fill="#1e293b" stroke="#64748b" strokeWidth="4" />
                    <circle cx="66" cy="212" r="6" fill="#94a3b8" />
                    <circle cx="545" cy="212" r="16" fill="#1e293b" stroke="#64748b" strokeWidth="4" />
                    <circle cx="545" cy="212" r="6" fill="#94a3b8" />
                    <circle cx="588" cy="212" r="16" fill="#1e293b" stroke="#64748b" strokeWidth="4" />
                    <circle cx="588" cy="212" r="6" fill="#94a3b8" />

                    {/* Horizontal Centimeter Ruler */}
                    <text x="116" y="242" fill="#34d399" fontSize="9.5" fontFamily="monospace" fontWeight="bold">
                      0 cm (Depan Box)
                    </text>
                    <text x="392" y="242" textAnchor="middle" fill="#94a3b8" fontSize="9.5" fontFamily="monospace">
                      {Math.round(innerPanjangCm / 2)} cm
                    </text>
                    <text x="668" y="242" textAnchor="end" fill="#34d399" fontSize="9.5" fontFamily="monospace" fontWeight="bold">
                      {innerPanjangCm} cm (Pintu Belakang)
                    </text>
                  </svg>
                </div>
              </div>
            )}

            {/* 2. TAMPAK ATAS / DENAH LANTAI 2D (PANJANG DALAM X LEBAR DALAM) */}
            {(sim2dViewMode === 'both' || sim2dViewMode === 'top') && (
              <div className="space-y-1.5 pt-1">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="font-black text-slate-700 dark:text-slate-200 uppercase">
                    B. Tampak Atas / Denah Lantai 2D (Panjang Dalam {innerPanjangCm} cm &times; Lebar Dalam {innerLebarCm} cm)
                  </span>
                  <span className="font-mono text-slate-500">
                    Baris Lebar &amp; Kolom Panjang Karton
                  </span>
                </div>

                <div className="rounded-2xl bg-slate-950 border border-slate-800 p-3 overflow-x-auto">
                  <svg
                    viewBox="0 0 760 185"
                    className="w-full h-auto min-w-[560px]"
                    role="img"
                    aria-label="Simulasi 2D Tampak Atas Denah Lantai Box Armada"
                  >
                    <rect x="0" y="0" width="760" height="185" rx="12" fill="#090d16" />

                    {/* Top-Down Cabin */}
                    <rect x="28" y="26" width="76" height="128" rx="10" fill="#1e293b" stroke="#475569" strokeWidth="2" />
                    <text x="66" y="94" textAnchor="middle" fill="#94a3b8" fontSize="9.5" fontFamily="monospace" fontWeight="bold">
                      KABIN
                    </text>

                    {/* Outer Wall Top View */}
                    <rect
                      x="108"
                      y="18"
                      width="568"
                      height="144"
                      rx="4"
                      fill="#0f172a"
                      stroke="#64748b"
                      strokeWidth="1.5"
                      strokeDasharray="5 3"
                    />

                    {/* Inner Effective Floor Area (Setelah Faktor Pengali Dimensi Dalam) */}
                    <rect
                      x="116"
                      y="26"
                      width="552"
                      height="128"
                      rx="2"
                      fill="#020617"
                      stroke="#38bdf8"
                      strokeWidth="2"
                    />

                    {/* Top-Down Placed Blocks */}
                    {layout2D.topBlocks.map(blk => {
                      const scaleX = 552 / Math.max(1, innerPanjangCm);
                      const scaleY = 128 / Math.max(1, innerLebarCm);
                      const pxX = 116 + blk.xCm * scaleX;
                      const pxY = 26 + blk.yCm * scaleY;
                      const pxW = Math.max(6, blk.wCm * scaleX - 1.5);
                      const pxD = Math.max(8, blk.dCm * scaleY - 1.5);
                      const palette = CARGO_HEX_COLORS[blk.skuIdx % CARGO_HEX_COLORS.length];

                      if (pxX > 740) return null;

                      return (
                        <g key={blk.id}>
                          <rect
                            x={pxX}
                            y={pxY}
                            width={pxW}
                            height={pxD}
                            rx="2"
                            fill={blk.isOverflow ? '#e11d48' : palette.fill}
                            fillOpacity={0.85}
                            stroke={blk.isOverflow ? '#fda4af' : palette.stroke}
                            strokeWidth="1"
                          >
                            <title>
                              {`[${blk.noBarang}] ${blk.namaBarang} • Tumpuk Vertikal: ${blk.stackCount} Lapis`}
                            </title>
                          </rect>
                          {pxW >= 18 && pxD >= 14 && (
                            <text
                              x={pxX + pxW / 2}
                              y={pxY + pxD / 2 + 3}
                              textAnchor="middle"
                              fill="#ffffff"
                              fontSize="8"
                              fontFamily="monospace"
                              fontWeight="bold"
                            >
                              {blk.stackCount}x
                            </text>
                          )}
                        </g>
                      );
                    })}

                    <text x="116" y="174" fill="#38bdf8" fontSize="9.5" fontFamily="monospace" fontWeight="bold">
                      Lebar Dalam: {innerLebarCm} cm (Luar: {boxLebarCm} cm)
                    </text>
                    <text x="668" y="174" textAnchor="end" fill="#94a3b8" fontSize="9.5" fontFamily="monospace">
                      Angka &ldquo;Nx&rdquo; = Jumlah Tumpukan ke Atas per Titik Lantai
                    </text>
                  </svg>
                </div>
              </div>
            )}

            {/* Stacked Progress Bar & SKU Legend */}
            <div className="pt-2 space-y-2">
              <div className="relative h-8 w-full rounded-xl bg-slate-100 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 overflow-hidden flex items-stretch">
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
                    Sisa Netto {remainingVolumeM3.toFixed(2)} m&sup3;
                  </div>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-3 pt-1">
                {cargoList.map((item, idx) => {
                  const subM3 = item.kubikasiUnitM3 * item.qtyMuat;
                  const colorClass = CARGO_COLORS[idx % CARGO_COLORS.length];
                  const zoneInfo = layout2D.skuZones.find(z => z.id === item.id);
                  return (
                    <div key={item.id} className="flex items-center gap-1.5 text-[11px]">
                      <span className={`w-2.5 h-2.5 rounded-xs ${colorClass}`} />
                      <span className="font-bold text-slate-700 dark:text-slate-300">{item.noBarang}</span>
                      <span className="font-mono text-slate-500">
                        ({item.panjangCm}&times;{item.lebarCm}&times;{item.tinggiCm} cm &bull; {subM3.toFixed(2)} m&sup3;
                        {zoneInfo ? ` • Panjang ${zoneInfo.usedLengthCm} cm` : ''})
                      </span>
                    </div>
                  );
                })}
              </div>
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
                  Ubah angka <strong>Qty Muat</strong> secara langsung untuk memperbarui simulasi 2D, kubikasi dalam netto, dan tonase secara real-time.
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
                    <th className="py-3 px-4">Item Barang (Database Gudang)</th>
                    <th className="py-3 px-4 text-center">Kubikasi &amp; Berat / Unit</th>
                    <th className="py-3 px-4 text-center">Qty Muat</th>
                    <th className="py-3 px-4 text-right">Subtotal Kubikasi</th>
                    <th className="py-3 px-4 text-right">Subtotal Berat</th>
                    <th className="py-3 px-4 text-right">% Kubikasi Dalam</th>
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
                        Belum ada item barang dalam simulasi muatan. Pilih barang dari Database Barang Gudang di panel kiri lalu klik <strong>Tambah ke Simulasi 2D</strong>.
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

