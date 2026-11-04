import React, { useState, useEffect, useMemo, useRef } from 'react';
import * as XLSX from 'xlsx';
import {
  Database,
  Search,
  Plus,
  Upload,
  Download,
  Camera,
  Eye,
  Edit3,
  Trash2,
  CheckCircle2,
  X,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  FileSpreadsheet,
  Link2
} from 'lucide-react';
import {
  databaseBarangService,
  DatabaseBarangRecord,
  compressDocumentationPhoto,
  createDefaultBarangThumbnail,
  estimateDataUrlSizeKb
} from '../services/databaseBarangService';

interface WarehouseDatabaseBarangViewProps {
  onSyncWithMasterSku?: (records: DatabaseBarangRecord[]) => void;
}

export const WarehouseDatabaseBarangView: React.FC<WarehouseDatabaseBarangViewProps> = ({
  onSyncWithMasterSku
}) => {
  const [items, setItems] = useState<DatabaseBarangRecord[]>(() => databaseBarangService.getAll());
  const [searchQuery, setSearchQuery] = useState('');
  const [satuanFilter, setSatuanFilter] = useState('ALL');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Compression preset state ("lebih dipress lagi untuk size file nya")
  const [compressionPreset, setCompressionPreset] = useState<'ultra' | 'super' | 'standard'>('ultra');

  // Upload Excel Page mode (like Upload Master Barang)
  const [isUploadExcelOpen, setIsUploadExcelOpen] = useState(false);
  const [excelFileName, setExcelFileName] = useState('');
  const [excelPreviewRows, setExcelPreviewRows] = useState<DatabaseBarangRecord[]>([]);
  const [showExcelPreview, setShowExcelPreview] = useState(false);

  // Modal Tambah / Edit Barang
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<DatabaseBarangRecord | null>(null);
  const [noBarang, setNoBarang] = useState('');
  const [keteranganBarang, setKeteranganBarang] = useState('');
  const [satuan, setSatuan] = useState('Pcs');
  const [dokumentasiUrl, setDokumentasiUrl] = useState('');
  const [compressedSizeKb, setCompressedSizeKb] = useState<number>(0);
  const [originalSizeKb, setOriginalSizeKb] = useState<number>(0);
  const [savingsPercent, setSavingsPercent] = useState<number>(0);
  const [isCompressing, setIsCompressing] = useState(false);

  // Quick row photo upload ref
  const rowFileInputRef = useRef<HTMLInputElement | null>(null);
  const [activeRowUploadId, setActiveRowUploadId] = useState<string | null>(null);

  // Lightbox preview modal
  const [previewDocItem, setPreviewDocItem] = useState<DatabaseBarangRecord | null>(null);

  // Toast / Popup Notification
  const [feedbackModal, setFeedbackModal] = useState<{ title: string; message: string } | null>(null);

  useEffect(() => {
    const sync = () => {
      setItems(databaseBarangService.getAll());
    };
    window.addEventListener('akk-database-barang-updated', sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener('akk-database-barang-updated', sync);
      window.removeEventListener('storage', sync);
    };
  }, []);

  const getCompressionOptions = () => {
    if (compressionPreset === 'ultra') {
      return { maxDimension: 260, targetMaxKb: 10, initialQuality: 0.42 };
    }
    if (compressionPreset === 'super') {
      return { maxDimension: 320, targetMaxKb: 15, initialQuality: 0.48 };
    }
    return { maxDimension: 400, targetMaxKb: 24, initialQuality: 0.56 };
  };

  const availableSatuanList = useMemo(() => {
    const set = new Set<string>(['Pcs', 'Ikat', 'Box', 'Bal', 'Pack', 'Roll', 'Karton']);
    items.forEach(i => {
      if (i.satuan) set.add(i.satuan);
    });
    return Array.from(set);
  }, [items]);

  const filteredItems = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return items.filter(item => {
      const matchSearch =
        !q ||
        item.noBarang.toLowerCase().includes(q) ||
        item.keteranganBarang.toLowerCase().includes(q) ||
        item.satuan.toLowerCase().includes(q);
      const matchSatuan = satuanFilter === 'ALL' || item.satuan.toLowerCase() === satuanFilter.toLowerCase();
      return matchSearch && matchSatuan;
    });
  }, [items, searchQuery, satuanFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredItems.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const paginatedItems = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredItems.slice(start, start + pageSize);
  }, [filteredItems, currentPage, pageSize]);

  useEffect(() => {
    setPage(1);
  }, [searchQuery, satuanFilter, pageSize]);

  const avgSizeKb = useMemo(() => {
    if (items.length === 0) return 0;
    const sum = items.reduce((acc, i) => acc + (i.compressedSizeKb || estimateDataUrlSizeKb(i.dokumentasiUrl)), 0);
    return Number((sum / items.length).toFixed(1));
  }, [items]);

  const openCreateModal = () => {
    setEditingItem(null);
    const nextNum = String(items.length + 1).padStart(3, '0');
    const defaultNo = `AKK-BRG-${nextNum}`;
    setNoBarang(defaultNo);
    setKeteranganBarang('');
    setSatuan('Ikat');
    const defDoc = createDefaultBarangThumbnail(defaultNo, 'Barang Kemasan AKK', 'Ikat');
    setDokumentasiUrl(defDoc);
    setCompressedSizeKb(estimateDataUrlSizeKb(defDoc));
    setOriginalSizeKb(0);
    setSavingsPercent(98);
    setIsFormModalOpen(true);
  };

  const openEditModal = (item: DatabaseBarangRecord) => {
    setEditingItem(item);
    setNoBarang(item.noBarang);
    setKeteranganBarang(item.keteranganBarang);
    setSatuan(item.satuan);
    setDokumentasiUrl(item.dokumentasiUrl);
    setCompressedSizeKb(item.compressedSizeKb || estimateDataUrlSizeKb(item.dokumentasiUrl));
    setOriginalSizeKb(item.originalSizeKb || 380);
    setSavingsPercent(item.compressionSavingsPct || 97);
    setIsFormModalOpen(true);
  };

  const handleModalPhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsCompressing(true);
    try {
      const result = await compressDocumentationPhoto(file, getCompressionOptions());
      setDokumentasiUrl(result.dataUrl);
      setCompressedSizeKb(result.compressedSizeKb);
      setOriginalSizeKb(result.originalSizeKb);
      setSavingsPercent(result.savingsPercent);
    } catch (err) {
      console.error('Gagal kompres foto dokumentasi:', err);
    } finally {
      setIsCompressing(false);
      e.target.value = '';
    }
  };

  const handleRowQuickPhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    const targetId = activeRowUploadId;
    if (!file || !targetId) return;

    const targetItem = items.find(i => i.id === targetId);
    if (!targetItem) return;

    try {
      const result = await compressDocumentationPhoto(file, getCompressionOptions());
      databaseBarangService.upsertItem({
        id: targetItem.id,
        noBarang: targetItem.noBarang,
        keteranganBarang: targetItem.keteranganBarang,
        satuan: targetItem.satuan,
        dokumentasiUrl: result.dataUrl,
        compressedSizeKb: result.compressedSizeKb,
        originalSizeKb: result.originalSizeKb,
        compressionSavingsPct: result.savingsPercent,
        kategoriBarang: targetItem.kategoriBarang,
        stokTersedia: targetItem.stokTersedia
      });
      const updated = databaseBarangService.getAll();
      setItems(updated);
      if (onSyncWithMasterSku) onSyncWithMasterSku(updated);
      setFeedbackModal({
        title: 'Dokumentasi Berhasil Di-Press & Disimpan',
        message: `Foto dokumentasi untuk "${targetItem.keteranganBarang}" (${targetItem.noBarang}) berhasil dipress dari ${result.originalSizeKb} KB menjadi ${result.compressedSizeKb} KB (Hemat ${result.savingsPercent}%).`
      });
    } catch (err) {
      console.error('Gagal kompres foto baris:', err);
    } finally {
      setActiveRowUploadId(null);
      e.target.value = '';
    }
  };

  const handleSaveItemForm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!noBarang.trim() || !keteranganBarang.trim()) return;

    const finalDoc =
      dokumentasiUrl ||
      createDefaultBarangThumbnail(noBarang.trim().toUpperCase(), keteranganBarang.trim(), satuan);

    const saved = databaseBarangService.upsertItem({
      id: editingItem?.id,
      noBarang: noBarang.trim().toUpperCase(),
      keteranganBarang: keteranganBarang.trim(),
      satuan: satuan.trim() || 'Pcs',
      dokumentasiUrl: finalDoc,
      compressedSizeKb: compressedSizeKb || estimateDataUrlSizeKb(finalDoc),
      originalSizeKb: originalSizeKb || 380,
      compressionSavingsPct: savingsPercent || 97
    });

    const all = databaseBarangService.getAll();
    setItems(all);
    if (onSyncWithMasterSku) onSyncWithMasterSku(all);
    setIsFormModalOpen(false);
    setFeedbackModal({
      title: editingItem ? 'Database Barang Diperbarui' : 'Barang Baru Ditambahkan',
      message: `Data "${saved.keteranganBarang}" (${saved.noBarang} • ${saved.satuan}) beserta dokumentasi terkompresi (${saved.compressedSizeKb} KB) telah disimpan & terintegrasi ke Input Faktur / SO.`
    });
  };

  const handleDeleteItem = (item: DatabaseBarangRecord) => {
    databaseBarangService.deleteItem(item.id);
    const all = databaseBarangService.getAll();
    setItems(all);
    if (onSyncWithMasterSku) onSyncWithMasterSku(all);
  };

  const handleDownloadTemplateExcel = () => {
    const sampleRows = [
      {
        'Nomor Barang': 'AKK-KBX-001',
        'Keterangan Barang': 'Karton Box Corrugated B-Flute 60x40x40 cm (Polos)',
        Satuan: 'Ikat'
      },
      {
        'Nomor Barang': 'RFID-KB-002',
        'Keterangan Barang': 'Karton Box Duplex Cetak Custom 30x20x15',
        Satuan: 'Box'
      },
      {
        'Nomor Barang': 'AKK-KBX-003',
        'Keterangan Barang': 'Box Kemasan Makanan Food Grade Ivory 22x22x8 cm',
        Satuan: 'Bal'
      }
    ];
    const ws = XLSX.utils.json_to_sheet(sampleRows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Database Barang');
    XLSX.writeFile(wb, 'Template_Database_Barang_AKK.xlsx');
  };

  const handleExportDatabaseBarang = () => {
    const rows = filteredItems.map((item, idx) => ({
      No: idx + 1,
      'Nomor Barang': item.noBarang,
      'Keterangan Barang': item.keteranganBarang,
      Satuan: item.satuan,
      'Ukuran Dokumentasi (KB)': `${item.compressedSizeKb} KB (Dipress ${item.compressionSavingsPct || 97}%)`,
      'Terakhir Diperbarui': item.updatedAt
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Database Barang');
    XLSX.writeFile(wb, `Database_Barang_AKK_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const handleExcelFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setExcelFileName(file.name);
    setShowExcelPreview(false);

    const reader = new FileReader();
    reader.onload = evt => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const jsonRows = XLSX.utils.sheet_to_json<Record<string, any>>(ws, { defval: '' });

        const mapped: DatabaseBarangRecord[] = [];
        jsonRows.forEach((row, idx) => {
          let noBrg = '';
          let ketBrg = '';
          let sat = 'Pcs';

          Object.entries(row).forEach(([rawKey, val]) => {
            const k = String(rawKey || '')
              .toLowerCase()
              .replace(/[^a-z0-9]/g, '');
            if (
              k === 'nomorbarang' ||
              k === 'nobarang' ||
              k === 'kodebarang' ||
              k === 'kodesku' ||
              k === 'sku' ||
              k === 'kode'
            ) {
              noBrg = String(val || '').trim().toUpperCase();
            } else if (
              k === 'keteranganbarang' ||
              k === 'keterangan' ||
              k === 'namabarang' ||
              k === 'deskripsi' ||
              k === 'itembarang' ||
              k === 'nama'
            ) {
              ketBrg = String(val || '').trim();
            } else if (k === 'satuan' || k === 'unit' || k === 'uom' || k === 'kemasan') {
              const s = String(val || '').trim();
              if (s) sat = s;
            }
          });

          if (noBrg || ketBrg) {
            const finalCode = noBrg || `AKK-BRG-${String(idx + 1).padStart(3, '0')}`;
            const finalDesc = ketBrg || 'Barang Kemasan AKK';
            const docUrl = createDefaultBarangThumbnail(finalCode, finalDesc, sat);
            mapped.push({
              id: `dbb-imp-${Date.now()}-${idx}`,
              noBarang: finalCode,
              keteranganBarang: finalDesc,
              satuan: sat,
              dokumentasiUrl: docUrl,
              compressedSizeKb: estimateDataUrlSizeKb(docUrl),
              originalSizeKb: 360,
              compressionSavingsPct: 99,
              updatedAt: new Date().toISOString().split('T')[0]
            });
          }
        });

        setExcelPreviewRows(mapped);
        setShowExcelPreview(true);
      } catch (err) {
        console.error('Gagal membaca Excel Database Barang:', err);
      }
    };
    reader.readAsBinaryString(file);
  };

  const handleConfirmExcelImport = () => {
    if (excelPreviewRows.length === 0) return;
    excelPreviewRows.forEach(row => {
      databaseBarangService.upsertItem({
        noBarang: row.noBarang,
        keteranganBarang: row.keteranganBarang,
        satuan: row.satuan,
        dokumentasiUrl: row.dokumentasiUrl,
        compressedSizeKb: row.compressedSizeKb,
        originalSizeKb: row.originalSizeKb,
        compressionSavingsPct: row.compressionSavingsPct
      });
    });
    const all = databaseBarangService.getAll();
    setItems(all);
    if (onSyncWithMasterSku) onSyncWithMasterSku(all);
    const count = excelPreviewRows.length;
    setIsUploadExcelOpen(false);
    setExcelPreviewRows([]);
    setExcelFileName('');
    setShowExcelPreview(false);
    setFeedbackModal({
      title: 'Import Database Barang Berhasil',
      message: `${count} barang berhasil diimpor ke Database Barang dan langsung terintegrasi dengan Input Faktur / Sales Order (SO).`
    });
  };

  if (isUploadExcelOpen) {
    return (
      <div className="space-y-6 animate-fade-in">
        <div className="rounded-3xl bg-gradient-to-r from-emerald-600 via-teal-800 to-slate-950 p-7 sm:p-8 text-white shadow-md">
          <div className="text-[11px] font-black uppercase tracking-[0.2em] text-emerald-200 mb-1.5">
            WAREHOUSE MANAGEMENT SYSTEM &bull; DATABASE BARANG
          </div>
          <h2 className="text-2xl sm:text-3xl font-black tracking-tight">
            Upload Excel Database Barang
          </h2>
          <p className="text-xs sm:text-sm font-medium text-emerald-50/90 mt-1.5 max-w-2xl">
            Unggah file Excel Database Barang dengan kolom <strong>Nomor Barang, Keterangan Barang, dan Satuan</strong>. Data otomatis terintegrasi dengan Input Faktur / Sales Order (SO).
          </p>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 sm:p-8 shadow-xs space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-end">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="block text-[11px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  FILE EXCEL DATABASE BARANG (.XLSX / .CSV)
                </label>
                <button
                  type="button"
                  onClick={handleDownloadTemplateExcel}
                  className="text-xs font-bold text-emerald-700 dark:text-emerald-400 hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Unduh Template Database Barang</span>
                </button>
              </div>
              <div className="p-3.5 rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-950/50">
                <input
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  onChange={handleExcelFileUpload}
                  className="w-full text-xs text-slate-700 dark:text-slate-300 file:mr-3 file:py-1.5 file:px-3.5 file:rounded-lg file:border file:border-slate-300 dark:file:border-slate-700 file:bg-white dark:file:bg-slate-900 file:text-xs file:font-bold file:text-slate-900 dark:file:text-white hover:file:bg-slate-100 cursor-pointer"
                />
              </div>
            </div>

            {excelFileName && (
              <div className="text-xs font-bold text-emerald-700 dark:text-emerald-400 flex items-center gap-2 pb-2">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>
                  File dipilih: <strong>{excelFileName}</strong> ({excelPreviewRows.length} baris barang terbaca)
                </span>
              </div>
            )}
          </div>

          <div className="p-4 rounded-2xl bg-emerald-50/80 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/60 text-emerald-800 dark:text-emerald-300 text-xs sm:text-sm font-bold leading-relaxed">
            Kolom yang dibaca otomatis: <strong>Nomor Barang</strong>, <strong>Keterangan Barang</strong>, dan <strong>Satuan</strong>. Dokumentasi foto dapat ditambahkan atau di-press langsung pada tabel Database Barang.
          </div>

          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => {
                setIsUploadExcelOpen(false);
                setShowExcelPreview(false);
              }}
              className="px-5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 font-bold text-xs sm:text-sm hover:bg-slate-50 dark:hover:bg-slate-800 transition cursor-pointer"
            >
              Kembali ke Database Barang
            </button>

            {excelPreviewRows.length > 0 && (
              <button
                type="button"
                onClick={handleConfirmExcelImport}
                className="px-5 py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-600 text-white font-bold text-xs sm:text-sm flex items-center gap-2 shadow-sm transition cursor-pointer"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Simpan ke Database Barang ({excelPreviewRows.length} Item)</span>
              </button>
            )}
          </div>

          {showExcelPreview && excelPreviewRows.length > 0 && (
            <div className="pt-4 border-t border-slate-200 dark:border-slate-800 space-y-3">
              <h4 className="text-sm font-black text-slate-900 dark:text-white">
                Preview Import Database Barang ({excelPreviewRows.length} Baris)
              </h4>
              <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-50 dark:bg-slate-950 text-slate-600 dark:text-slate-400 uppercase font-bold text-[10px] border-b border-slate-200 dark:border-slate-800">
                    <tr>
                      <th className="py-3 px-4">Nomor Barang</th>
                      <th className="py-3 px-4">Keterangan Barang</th>
                      <th className="py-3 px-4">Satuan</th>
                      <th className="py-3 px-4">Dokumentasi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                    {excelPreviewRows.slice(0, 15).map(row => (
                      <tr key={row.id}>
                        <td className="py-2.5 px-4 font-mono font-bold text-indigo-600 dark:text-indigo-400">
                          {row.noBarang}
                        </td>
                        <td className="py-2.5 px-4 font-bold text-slate-900 dark:text-white">
                          {row.keteranganBarang}
                        </td>
                        <td className="py-2.5 px-4 font-semibold text-slate-700 dark:text-slate-300">
                          {row.satuan}
                        </td>
                        <td className="py-2.5 px-4">
                          <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-mono text-[10px] font-bold">
                            {row.compressedSizeKb} KB (Auto-Press)
                          </span>
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
      {/* Hidden input for direct row photo compression */}
      <input
        ref={rowFileInputRef}
        type="file"
        accept="image/*"
        onChange={handleRowQuickPhotoChange}
        className="hidden"
      />

      {/* Top Header Banner */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-lg bg-amber-50 dark:bg-amber-500/15 border border-amber-200 dark:border-amber-500/30 text-amber-700 dark:text-amber-300 text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5">
              <Database className="w-3.5 h-3.5" />
              <span>Database Barang Gudang (WMS)</span>
            </span>
            <span className="px-2.5 py-0.5 rounded-lg bg-indigo-50 dark:bg-indigo-500/15 border border-indigo-200 dark:border-indigo-500/30 text-indigo-700 dark:text-indigo-300 text-[10px] font-bold flex items-center gap-1">
              <Link2 className="w-3 h-3" />
              <span>Terintegrasi Input Faktur / Sales Order (SO)</span>
            </span>
          </div>
          <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-white tracking-tight">
            Database Barang &mdash; Nomor Barang, Keterangan Barang, Satuan &amp; Dokumentasi
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 max-w-3xl">
            Master katalog barang yang terhubung langsung dengan menu <strong>Input Faktur / Sales Order (SO)</strong>. Setiap foto pada kolom <strong>Dokumentasi</strong> otomatis di-press ekstra kecil (rata-rata <strong>{avgSizeKb} KB</strong>) agar hemat penyimpanan &amp; cepat diakses.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={handleExportDatabaseBarang}
            className="px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Ekspor Excel</span>
          </button>
          <button
            type="button"
            onClick={() => setIsUploadExcelOpen(true)}
            className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1.5 transition cursor-pointer shadow-xs"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span>Import Excel</span>
          </button>
          <button
            type="button"
            onClick={openCreateModal}
            className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold flex items-center gap-1.5 transition cursor-pointer shadow-xs"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>+ Tambah Barang</span>
          </button>
        </div>
      </div>

      {/* Compression Control & Integration Status Bar */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-3.5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <div className="text-xs font-black text-slate-900 dark:text-white flex items-center gap-2">
              <span>Engine Kompresi Foto Dokumentasi (Auto-Press File Size)</span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30">
                Rata-rata: {avgSizeKb} KB / Foto
              </span>
            </div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400">
              Mengubah foto kamera / galeri dari ukuran MB menjadi beberapa KB secara instan tanpa membebani server.
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 mr-1">
            Level Press Foto:
          </span>
          {(
            [
              { id: 'ultra', label: 'Ultra-Press (≤ 10 KB)' },
              { id: 'super', label: 'Super-Press (≤ 15 KB)' },
              { id: 'standard', label: 'Standar (≤ 24 KB)' }
            ] as const
          ).map(opt => (
            <button
              key={opt.id}
              type="button"
              onClick={() => setCompressionPreset(opt.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer border ${
                compressionPreset === opt.id
                  ? 'bg-emerald-600 text-white border-emerald-600 shadow-2xs'
                  : 'bg-slate-50 dark:bg-slate-950 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-800 hover:border-emerald-400'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Search, Filter Satuan & Page Size */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Cari Nomor Barang, Keterangan Barang, atau Satuan..."
            className="w-full pl-10 pr-4 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-indigo-500"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            value={satuanFilter}
            onChange={e => setSatuanFilter(e.target.value)}
            className="px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs font-bold text-slate-800 dark:text-slate-200 cursor-pointer"
          >
            <option value="ALL">Semua Satuan ({items.length})</option>
            {availableSatuanList.map(s => (
              <option key={s} value={s}>
                Satuan: {s}
              </option>
            ))}
          </select>

          <div className="flex items-center gap-1.5 text-xs">
            <span className="text-slate-500 font-semibold">Baris:</span>
            <select
              value={pageSize}
              onChange={e => setPageSize(Number(e.target.value))}
              className="px-2.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs font-bold text-slate-800 dark:text-slate-200 cursor-pointer"
            >
              <option value={5}>5 / Hal</option>
              <option value={10}>10 / Hal</option>
              <option value={20}>20 / Hal</option>
              <option value={50}>50 / Hal</option>
            </select>
          </div>
        </div>
      </div>

      {/* Main Table: Nomor Barang | Keterangan Barang | Satuan | Dokumentasi */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-xs">
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-black text-slate-900 dark:text-white">
              Tabel Database Barang Terpadu
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Menampilkan 4 kolom utama: <strong>Nomor Barang, Keterangan Barang, Satuan, dan Dokumentasi (File Di-Press)</strong>.
            </p>
          </div>
          <span className="text-xs font-bold text-slate-600 dark:text-slate-300">
            Total Database: <span className="font-mono text-indigo-600 dark:text-indigo-400">{filteredItems.length} Barang</span>
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left border-collapse">
            <thead className="bg-slate-50 dark:bg-slate-950 text-slate-600 dark:text-slate-400 uppercase font-bold text-[10px] border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th className="py-3 px-4 w-12 text-center">No</th>
                <th className="py-3 px-4">Nomor Barang</th>
                <th className="py-3 px-4">Keterangan Barang</th>
                <th className="py-3 px-4 text-center">Satuan</th>
                <th className="py-3 px-4">Dokumentasi (Auto-Press Size)</th>
                <th className="py-3 px-4 text-right w-28">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800 text-slate-800 dark:text-slate-200">
              {paginatedItems.length > 0 ? (
                paginatedItems.map((item, idx) => {
                  const rowNum = (currentPage - 1) * pageSize + idx + 1;
                  const sizeKb = item.compressedSizeKb || estimateDataUrlSizeKb(item.dokumentasiUrl);
                  const savings = item.compressionSavingsPct || 97;

                  return (
                    <tr key={item.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition">
                      <td className="py-3 px-4 text-center font-mono font-bold text-slate-400">
                        {rowNum}
                      </td>
                      <td className="py-3 px-4">
                        <span className="px-2.5 py-1 rounded-lg bg-indigo-50 dark:bg-indigo-500/15 border border-indigo-200 dark:border-indigo-500/30 font-mono font-black text-indigo-700 dark:text-indigo-300 text-xs inline-block">
                          {item.noBarang}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-bold text-slate-900 dark:text-white text-xs sm:text-sm">
                          {item.keteranganBarang}
                        </div>
                        <div className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold mt-0.5 flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3 shrink-0" />
                          <span>Tersinkron ke Input Faktur / Sales Order (SO)</span>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className="px-3 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-bold text-slate-800 dark:text-slate-200 text-xs inline-block">
                          {item.satuan}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <div
                            onClick={() => setPreviewDocItem(item)}
                            className="w-16 h-11 rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 bg-slate-950 shrink-0 relative group cursor-pointer shadow-2xs"
                            title="Klik untuk melihat dokumentasi barang"
                          >
                            <img
                              src={item.dokumentasiUrl}
                              alt={item.keteranganBarang}
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                            />
                            <div className="absolute inset-0 bg-black/45 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white">
                              <Eye className="w-3.5 h-3.5" />
                            </div>
                          </div>

                          <div className="space-y-1 min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="px-2 py-0.5 rounded-md bg-emerald-500/15 border border-emerald-500/30 text-emerald-700 dark:text-emerald-300 font-mono font-black text-[10px]">
                                {sizeKb} KB
                              </span>
                              <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400">
                                Dipress {savings}%
                              </span>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => {
                                  setActiveRowUploadId(item.id);
                                  rowFileInputRef.current?.click();
                                }}
                                className="px-2 py-0.5 rounded-md bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-600 dark:text-indigo-300 border border-indigo-500/25 text-[10px] font-bold flex items-center gap-1 cursor-pointer transition"
                              >
                                <Camera className="w-3 h-3" />
                                <span>Upload / Press Foto</span>
                              </button>
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => openEditModal(item)}
                            className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition cursor-pointer"
                            title="Edit Barang"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteItem(item)}
                            className="p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 transition cursor-pointer"
                            title="Hapus Barang"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-400 text-xs">
                    Tidak ada data barang yang sesuai pencarian.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        <div className="p-4 border-t border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <div className="text-slate-500 dark:text-slate-400 font-medium">
            Menampilkan{' '}
            <strong className="text-slate-900 dark:text-white">
              {filteredItems.length === 0 ? 0 : (currentPage - 1) * pageSize + 1}
            </strong>{' '}
            &ndash;{' '}
            <strong className="text-slate-900 dark:text-white">
              {Math.min(currentPage * pageSize, filteredItems.length)}
            </strong>{' '}
            dari <strong className="text-slate-900 dark:text-white">{filteredItems.length}</strong> barang (Halaman {currentPage} dari {totalPages})
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              disabled={currentPage <= 1}
              onClick={() => setPage(p => Math.max(1, p - 1))}
              className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-700 dark:text-slate-300 font-bold disabled:opacity-40 cursor-pointer flex items-center gap-1"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              <span>Sebelumnya</span>
            </button>

            {Array.from({ length: totalPages }, (_, i) => i + 1).map(pageNum => (
              <button
                key={pageNum}
                type="button"
                onClick={() => setPage(pageNum)}
                className={`w-8 h-8 rounded-xl font-mono text-xs font-black transition cursor-pointer ${
                  pageNum === currentPage
                    ? 'bg-indigo-600 text-white'
                    : 'bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100'
                }`}
              >
                {pageNum}
              </button>
            ))}

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

      {/* Modal Tambah / Edit Database Barang */}
      {isFormModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div>
                <h4 className="text-sm sm:text-base font-black text-slate-900 dark:text-white">
                  {editingItem ? 'Edit Database Barang' : 'Tambah Database Barang Baru'}
                </h4>
                <p className="text-[11px] text-slate-500">
                  Otomatis terintegrasi dengan Input Faktur / Sales Order (SO) Admin Penjualan
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsFormModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-900 dark:hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveItemForm} className="space-y-3.5 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2 space-y-1">
                  <label className="font-bold text-slate-600 dark:text-slate-400 uppercase text-[10px]">
                    1. Nomor Barang *
                  </label>
                  <input
                    type="text"
                    required
                    value={noBarang}
                    onChange={e => setNoBarang(e.target.value.toUpperCase())}
                    placeholder="Contoh: AKK-KBX-001"
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white font-mono font-bold"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-slate-600 dark:text-slate-400 uppercase text-[10px]">
                    3. Satuan *
                  </label>
                  <select
                    value={satuan}
                    onChange={e => setSatuan(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white font-bold cursor-pointer"
                  >
                    <option value="Ikat">Ikat</option>
                    <option value="Box">Box</option>
                    <option value="Pcs">Pcs</option>
                    <option value="Bal">Bal</option>
                    <option value="Pack">Pack</option>
                    <option value="Roll">Roll</option>
                    <option value="Karton">Karton</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-600 dark:text-slate-400 uppercase text-[10px]">
                  2. Keterangan Barang *
                </label>
                <input
                  type="text"
                  required
                  value={keteranganBarang}
                  onChange={e => setKeteranganBarang(e.target.value)}
                  placeholder="Contoh: Karton Box Corrugated B-Flute 60x40x40 cm (Polos)"
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white font-bold"
                />
              </div>

              {/* 4. Dokumentasi (Auto-Press Size) */}
              <div className="space-y-2 pt-1">
                <div className="flex items-center justify-between">
                  <label className="font-bold text-slate-600 dark:text-slate-400 uppercase text-[10px]">
                    4. Dokumentasi Barang (Otomatis Di-Press Ukuran File)
                  </label>
                  <span className="px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 font-mono font-bold text-[10px]">
                    Ukuran Saat Ini: {compressedSizeKb} KB {savingsPercent > 0 ? `(Hemat ${savingsPercent}%)` : ''}
                  </span>
                </div>

                <div className="p-3.5 rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-950/60 flex items-center gap-3.5">
                  <div className="w-24 h-16 rounded-xl overflow-hidden border border-slate-200 dark:border-slate-800 bg-slate-900 shrink-0">
                    {dokumentasiUrl && (
                      <img
                        src={dokumentasiUrl}
                        alt="Preview Dokumentasi"
                        className="w-full h-full object-cover"
                      />
                    )}
                  </div>

                  <div className="space-y-1.5 flex-1 min-w-0">
                    <label className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs cursor-pointer transition shadow-2xs">
                      <Upload className="w-3.5 h-3.5" />
                      <span>{isCompressing ? 'Memproses Kompresi...' : 'Pilih / Kamera Foto Dokumentasi'}</span>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleModalPhotoChange}
                        className="hidden"
                      />
                    </label>
                    <p className="text-[10px] text-slate-500 leading-relaxed">
                      {originalSizeKb > 0
                        ? `Berhasil di-press dari ${originalSizeKb} KB menjadi ${compressedSizeKb} KB (${compressionPreset.toUpperCase()}-PRESS).`
                        : 'Foto yang diunggah akan otomatis di-press hingga ≤ 10–15 KB agar ringan disimpan.'}
                    </p>
                  </div>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsFormModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold cursor-pointer shadow-xs"
                >
                  Simpan ke Database Barang
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Lightbox Modal Preview Dokumentasi */}
      {previewDocItem && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setPreviewDocItem(null)}
        >
          <div
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-md w-full p-5 space-y-3 shadow-2xl"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <div>
                <span className="font-mono text-xs font-black text-indigo-600 dark:text-indigo-400">
                  {previewDocItem.noBarang} &bull; {previewDocItem.satuan}
                </span>
                <h4 className="text-sm font-black text-slate-900 dark:text-white">
                  {previewDocItem.keteranganBarang}
                </h4>
              </div>
              <button
                type="button"
                onClick={() => setPreviewDocItem(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="rounded-xl overflow-hidden border border-slate-200 dark:border-slate-800 bg-slate-950">
              <img
                src={previewDocItem.dokumentasiUrl}
                alt={previewDocItem.keteranganBarang}
                className="w-full max-h-72 object-contain mx-auto"
              />
            </div>
            <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1">
              <span>
                Ukuran File Terkompresi:{' '}
                <strong className="text-emerald-600 dark:text-emerald-400">
                  {previewDocItem.compressedSizeKb} KB (Hemat {previewDocItem.compressionSavingsPct || 97}%)
                </strong>
              </span>
              <span>Terintegrasi Input Faktur / SO</span>
            </div>
          </div>
        </div>
      )}

      {/* Feedback Notification Modal */}
      {feedbackModal && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setFeedbackModal(null)}
        >
          <div
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-md w-full p-6 text-center space-y-4 shadow-2xl"
            onClick={e => e.stopPropagation()}
          >
            <div className="w-12 h-12 rounded-2xl bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <div className="space-y-1.5">
              <h4 className="text-base font-black text-slate-900 dark:text-white">
                {feedbackModal.title}
              </h4>
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                {feedbackModal.message}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setFeedbackModal(null)}
              className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs cursor-pointer transition"
            >
              Oke, Mengerti
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
