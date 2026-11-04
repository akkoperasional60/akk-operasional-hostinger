import React, { useState, useEffect, useMemo } from 'react';
import * as XLSX from 'xlsx';
import {
  Database,
  Search,
  Plus,
  Download,
  Edit3,
  Trash2,
  CheckCircle2,
  X,
  ChevronLeft,
  ChevronRight,
  FileSpreadsheet,
  Link2,
  Eye,
  Upload,
  Box,
  Layers,
  Scale,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Filter,
  LayoutGrid,
  List,
  Sparkles,
  RefreshCw,
  FileText
} from 'lucide-react';
import {
  databaseBarangService,
  DatabaseBarangRecord,
  calculateVolM3,
  createDefaultBarangThumbnail,
  compressDocumentationPhoto,
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
  const [unitFilter, setUnitFilter] = useState('ALL');
  const [volFilter, setVolFilter] = useState<'ALL' | 'has_vol' | 'no_vol'>('ALL');
  const [beratFilter, setBeratFilter] = useState<'ALL' | 'has_berat' | 'no_berat'>('ALL');
  const [sortBy, setSortBy] = useState<string>('default');
  const [tableMode, setTableMode] = useState<'compact' | 'spreadsheet'>('compact');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [jumpPageInput, setJumpPageInput] = useState('');
  const [isSavingImport, setIsSavingImport] = useState(false);

  // Upload Excel mode with Preview before Save
  const [isUploadExcelOpen, setIsUploadExcelOpen] = useState(false);
  const [excelFileName, setExcelFileName] = useState('');
  const [excelPreviewRows, setExcelPreviewRows] = useState<DatabaseBarangRecord[]>([]);
  const [showExcelPreview, setShowExcelPreview] = useState(false);
  const [importMode, setImportMode] = useState<'replace_all' | 'append'>('replace_all');

  // Modal Tambah / Edit Barang (Template Foto 1)
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<DatabaseBarangRecord | null>(null);

  // Form states matching Foto 1
  const [noBarang, setNoBarang] = useState('');
  const [deskripsiBarang, setDeskripsiBarang] = useState('');
  const [unit1, setUnit1] = useState('Pcs');
  const [unit2, setUnit2] = useState('Ikat');
  const [unit3, setUnit3] = useState('Palet');
  const [rasio2, setRasio2] = useState<number | string>(25);
  const [rasio3, setRasio3] = useState<number | string>(500);
  const [panjangCm, setPanjangCm] = useState<number>(60);
  const [lebarCm, setLebarCm] = useState<number>(40);
  const [tinggiCm, setTinggiCm] = useState<number>(40);
  const [volM3, setVolM3] = useState<number>(0.096);
  const [beratKg, setBeratKg] = useState<number>(0.65);
  const [dokumentasiUrl, setDokumentasiUrl] = useState('');
  const [isCompressingPhoto, setIsCompressingPhoto] = useState(false);

  // Lightbox preview for photo if clicked
  const [previewDocItem, setPreviewDocItem] = useState<DatabaseBarangRecord | null>(null);

  // Toast / Feedback popup
  const [feedbackModal, setFeedbackModal] = useState<{ title: string; message: string } | null>(null);

  useEffect(() => {
    databaseBarangService.ensureHydrated().then(loaded => {
      if (loaded && loaded.length > 0) {
        setItems(loaded);
      }
    });

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

  // Auto-calculate volM3 whenever panjang, lebar, tinggi change
  const handleDimensionChange = (p: number, l: number, t: number) => {
    setPanjangCm(p);
    setLebarCm(l);
    setTinggiCm(t);
    const calculated = calculateVolM3(p, l, t);
    setVolM3(calculated);
  };

  const availableUnits = useMemo(() => {
    const set = new Set<string>(['Pcs', 'Ikat', 'Box', 'Bal', 'Pack', 'Roll', 'Karton', 'Palet']);
    items.forEach(i => {
      if (i.unit1) set.add(i.unit1);
      if (i.unit2) set.add(i.unit2);
      if (i.unit3) set.add(i.unit3);
    });
    return Array.from(set);
  }, [items]);

  const filteredItems = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const result = items.filter(item => {
      const matchSearch =
        !q ||
        item.noBarang.toLowerCase().includes(q) ||
        (item.deskripsiBarang || item.keteranganBarang || '').toLowerCase().includes(q) ||
        (item.unit1 || '').toLowerCase().includes(q) ||
        (item.unit2 || '').toLowerCase().includes(q) ||
        (item.unit3 || '').toLowerCase().includes(q);

      const matchUnit =
        unitFilter === 'ALL' ||
        (item.unit1 || '').toLowerCase() === unitFilter.toLowerCase() ||
        (item.unit2 || '').toLowerCase() === unitFilter.toLowerCase();

      const itemVol = Number(item.volM3) || (item.panjangCm > 0 && item.lebarCm > 0 && item.tinggiCm > 0 ? calculateVolM3(item.panjangCm, item.lebarCm, item.tinggiCm) : 0);
      const matchVol =
        volFilter === 'ALL' ||
        (volFilter === 'has_vol' && itemVol > 0) ||
        (volFilter === 'no_vol' && itemVol === 0);

      const itemBerat = Number(item.beratKg) || 0;
      const matchBerat =
        beratFilter === 'ALL' ||
        (beratFilter === 'has_berat' && itemBerat > 0) ||
        (beratFilter === 'no_berat' && itemBerat === 0);

      return matchSearch && matchUnit && matchVol && matchBerat;
    });

    // Sort options: Urutan asli file (default), A-Z, Z-A, terkecil ke terbesar, terbesar ke terkecil
    if (sortBy === 'nama_asc') {
      result.sort((a, b) =>
        (a.deskripsiBarang || a.keteranganBarang || '').localeCompare(b.deskripsiBarang || b.keteranganBarang || '', 'id', { numeric: true })
      );
    } else if (sortBy === 'nama_desc') {
      result.sort((a, b) =>
        (b.deskripsiBarang || b.keteranganBarang || '').localeCompare(a.deskripsiBarang || a.keteranganBarang || '', 'id', { numeric: true })
      );
    } else if (sortBy === 'no_asc') {
      result.sort((a, b) => a.noBarang.localeCompare(b.noBarang, 'id', { numeric: true }));
    } else if (sortBy === 'no_desc') {
      result.sort((a, b) => b.noBarang.localeCompare(a.noBarang, 'id', { numeric: true }));
    } else if (sortBy === 'berat_asc') {
      result.sort((a, b) => (Number(a.beratKg) || 0) - (Number(b.beratKg) || 0));
    } else if (sortBy === 'berat_desc') {
      result.sort((a, b) => (Number(b.beratKg) || 0) - (Number(a.beratKg) || 0));
    } else if (sortBy === 'vol_asc') {
      result.sort((a, b) => (Number(a.volM3) || 0) - (Number(b.volM3) || 0));
    } else if (sortBy === 'vol_desc') {
      result.sort((a, b) => (Number(b.volM3) || 0) - (Number(a.volM3) || 0));
    }

    return result;
  }, [items, searchQuery, unitFilter, volFilter, beratFilter, sortBy]);

  const totalPages = Math.max(1, Math.ceil(filteredItems.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const paginatedItems = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredItems.slice(start, start + pageSize);
  }, [filteredItems, currentPage, pageSize]);

  // Smart Windowed Pagination: menampilkan maksimal 7 tombol halaman tanpa membludak ratusan tombol
  const paginationRange = useMemo(() => {
    const delta = 2;
    const range: (number | string)[] = [];
    for (
      let i = Math.max(2, currentPage - delta);
      i <= Math.min(totalPages - 1, currentPage + delta);
      i++
    ) {
      range.push(i);
    }
    if (currentPage - delta > 2) {
      range.unshift('...');
    }
    if (currentPage + delta < totalPages - 1) {
      range.push('...');
    }
    range.unshift(1);
    if (totalPages > 1) {
      range.push(totalPages);
    }
    return range;
  }, [currentPage, totalPages]);

  useEffect(() => {
    setPage(1);
  }, [searchQuery, unitFilter, volFilter, beratFilter, sortBy, pageSize]);

  const openCreateModal = () => {
    setEditingItem(null);
    const nextNum = String(items.length + 1).padStart(3, '0');
    const defaultNo = `AKK-BRG-${nextNum}`;
    setNoBarang(defaultNo);
    setDeskripsiBarang('');
    setUnit1('Pcs');
    setUnit2('');
    setUnit3('');
    setRasio2(0);
    setRasio3(0);
    setPanjangCm(0);
    setLebarCm(0);
    setTinggiCm(0);
    setVolM3(0);
    setBeratKg(0);
    setDokumentasiUrl(createDefaultBarangThumbnail(defaultNo, 'Barang Kemasan AKK', 'Pcs'));
    setIsFormModalOpen(true);
  };

  const openEditModal = (item: DatabaseBarangRecord) => {
    setEditingItem(item);
    setNoBarang(item.noBarang);
    setDeskripsiBarang(item.deskripsiBarang || item.keteranganBarang || '');
    setUnit1(item.unit1 || item.satuan || 'Pcs');
    setUnit2(item.unit2 || '');
    setUnit3(item.unit3 || '');
    setRasio2(item.rasio2 !== undefined && item.rasio2 !== '' ? item.rasio2 : 0);
    setRasio3(item.rasio3 !== undefined && item.rasio3 !== '' ? item.rasio3 : 0);
    setPanjangCm(item.panjangCm || 0);
    setLebarCm(item.lebarCm || 0);
    setTinggiCm(item.tinggiCm || 0);
    setVolM3(item.volM3 || (item.panjangCm > 0 && item.lebarCm > 0 && item.tinggiCm > 0 ? calculateVolM3(item.panjangCm, item.lebarCm, item.tinggiCm) : 0));
    setBeratKg(item.beratKg || 0);
    setDokumentasiUrl(item.dokumentasiUrl || createDefaultBarangThumbnail(item.noBarang, item.deskripsiBarang, item.unit1));
    setIsFormModalOpen(true);
  };

  const handleModalPhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsCompressingPhoto(true);
    try {
      const result = await compressDocumentationPhoto(file, {
        maxDimension: 320,
        targetMaxKb: 14,
        initialQuality: 0.48
      });
      setDokumentasiUrl(result.dataUrl);
    } catch (err) {
      console.error('Gagal kompres foto:', err);
    } finally {
      setIsCompressingPhoto(false);
      e.target.value = '';
    }
  };

  const handleSaveItemForm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!noBarang.trim() || !deskripsiBarang.trim()) return;

    const finalDoc =
      dokumentasiUrl ||
      createDefaultBarangThumbnail(noBarang.trim().toUpperCase(), deskripsiBarang.trim(), unit1);

    const calculatedVol = volM3 > 0 ? volM3 : calculateVolM3(panjangCm, lebarCm, tinggiCm);

    const saved = databaseBarangService.upsertItem({
      id: editingItem?.id,
      noBarang: noBarang.trim().toUpperCase(),
      deskripsiBarang: deskripsiBarang.trim(),
      keteranganBarang: deskripsiBarang.trim(),
      unit1: unit1.trim() || 'Pcs',
      satuan: unit1.trim() || 'Pcs',
      unit2: unit2.trim(),
      unit3: unit3.trim(),
      rasio2,
      rasio3,
      panjangCm: Number(panjangCm) || 0,
      lebarCm: Number(lebarCm) || 0,
      tinggiCm: Number(tinggiCm) || 0,
      volM3: Number(calculatedVol),
      beratKg: Number(beratKg) || 0,
      dokumentasiUrl: finalDoc
    });

    const all = databaseBarangService.getAll();
    setItems(all);
    if (onSyncWithMasterSku) onSyncWithMasterSku(all);
    setIsFormModalOpen(false);
    setFeedbackModal({
      title: editingItem ? 'Database Barang Diperbarui' : 'Barang Baru Ditambahkan',
      message: `Data "${saved.deskripsiBarang}" (${saved.noBarang}) berhasil disimpan sesuai template database barang.`
    });
  };

  const handleDeleteItem = (item: DatabaseBarangRecord) => {
    if (window.confirm(`Hapus barang ${item.noBarang} - ${item.deskripsiBarang || item.keteranganBarang}?`)) {
      databaseBarangService.deleteItem(item.id);
      const all = databaseBarangService.getAll();
      setItems(all);
      if (onSyncWithMasterSku) onSyncWithMasterSku(all);
    }
  };

  // Template Excel download matching Foto 1 exact columns
  const handleDownloadTemplateExcel = () => {
    const sampleRows = [
      {
        'No. Barang': 'AKK-KBX-001',
        'Deskripsi Barang': 'Karton Box Corrugated B-Flute 60x40x40 cm (Polos)',
        'Unit 1': 'Pcs',
        'Unit 2': 'Ikat',
        'Unit 3': 'Palet',
        'Rasio 2': 25,
        'Rasio 3': 500,
        'Panjang(L)cm': 60,
        'Lebar(W)cm': 40,
        'Tinggi(H)cm': 40,
        'VOL(M3)': 0.096,
        'Berat(kg)': 0.65
      },
      {
        'No. Barang': 'AKK-KBX-002',
        'Deskripsi Barang': 'Karton Box Double Wall CB-Flute Export 80x50x50 cm',
        'Unit 1': 'Pcs',
        'Unit 2': 'Ikat',
        'Unit 3': 'Palet',
        'Rasio 2': 20,
        'Rasio 3': 300,
        'Panjang(L)cm': 80,
        'Lebar(W)cm': 50,
        'Tinggi(H)cm': 50,
        'VOL(M3)': 0.2,
        'Berat(kg)': 1.25
      },
      {
        'No. Barang': 'RFID-KB-002',
        'Deskripsi Barang': 'Karton Box Duplex Cetak Custom 30x20x15 cm',
        'Unit 1': 'Pcs',
        'Unit 2': 'Box',
        'Unit 3': 'Bal',
        'Rasio 2': 50,
        'Rasio 3': 500,
        'Panjang(L)cm': 30,
        'Lebar(W)cm': 20,
        'Tinggi(H)cm': 15,
        'VOL(M3)': 0.009,
        'Berat(kg)': 0.18
      }
    ];

    const ws = XLSX.utils.json_to_sheet(sampleRows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Template Database Barang');
    XLSX.writeFile(wb, 'Template_Database_Barang_AKK.xlsx');
  };

  const handleExportDatabaseBarang = () => {
    const rows = filteredItems.map((item, idx) => ({
      No: idx + 1,
      'No. Barang': item.noBarang,
      'Deskripsi Barang': item.deskripsiBarang || item.keteranganBarang,
      'Unit 1': item.unit1 || item.satuan,
      'Unit 2': item.unit2 || '',
      'Unit 3': item.unit3 || '',
      'Rasio 2': item.rasio2 ?? '',
      'Rasio 3': item.rasio3 ?? '',
      'Panjang(L)cm': item.panjangCm,
      'Lebar(W)cm': item.lebarCm,
      'Tinggi(H)cm': item.tinggiCm,
      'VOL(M3)': item.volM3,
      'Berat(kg)': item.beratKg,
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
          let descBrg = '';
          let u1 = 'Pcs';
          let u2 = '';
          let u3 = '';
          let r2: number | string = 0;
          let r3: number | string = 0;
          let p = 0;
          let l = 0;
          let t = 0;
          let vol = 0;
          let berat = 0;

          Object.entries(row).forEach(([rawKey, val]) => {
            const k = String(rawKey || '')
              .toLowerCase()
              .replace(/[^a-z0-9]/g, '');

            const rawStr = val !== undefined && val !== null ? String(val).trim() : '';
            const numVal = !isNaN(Number(val)) && rawStr !== '' ? Number(val) : 0;

            if (k === 'nobarang' || k === 'nomorbarang' || k === 'kodebarang' || k === 'sku') {
              noBrg = rawStr.toUpperCase();
            } else if (
              k === 'deskripsibarang' ||
              k === 'deskripsi' ||
              k === 'keteranganbarang' ||
              k === 'keterangan' ||
              k === 'namabarang' ||
              k === 'itembarang'
            ) {
              descBrg = rawStr;
            } else if (k === 'unit1' || k === 'satuan' || k === 'unit') {
              if (rawStr) u1 = rawStr;
            } else if (k === 'unit2') {
              u2 = rawStr;
            } else if (k === 'unit3') {
              u3 = rawStr;
            } else if (k === 'rasio2') {
              r2 = rawStr === '' ? 0 : (!isNaN(Number(val)) ? Number(val) : rawStr);
            } else if (k === 'rasio3') {
              r3 = rawStr === '' ? 0 : (!isNaN(Number(val)) ? Number(val) : rawStr);
            } else if (k === 'panjanglcm' || k === 'panjang' || k === 'length') {
              p = numVal;
            } else if (k === 'lebarwcm' || k === 'lebar' || k === 'width') {
              l = numVal;
            } else if (k === 'tinggihcm' || k === 'tinggi' || k === 'height') {
              t = numVal;
            } else if (k === 'volm3' || k === 'volume' || k === 'vol') {
              vol = numVal;
            } else if (k === 'beratkg' || k === 'berat' || k === 'weight') {
              berat = numVal;
            }
          });

          if (noBrg || descBrg) {
            const finalCode = noBrg || `AKK-BRG-${String(idx + 1).padStart(3, '0')}`;
            const finalDesc = descBrg || 'Barang Kemasan AKK';
            const finalVol = vol > 0 ? vol : (p > 0 && l > 0 && t > 0 ? calculateVolM3(p, l, t) : 0);

            mapped.push({
              id: `dbb-imp-${Date.now()}-${idx}`,
              noBarang: finalCode,
              deskripsiBarang: finalDesc,
              keteranganBarang: finalDesc,
              unit1: u1,
              satuan: u1,
              unit2: u2,
              unit3: u3,
              rasio2: r2,
              rasio3: r3,
              panjangCm: p,
              lebarCm: l,
              tinggiCm: t,
              volM3: finalVol,
              beratKg: berat,
              dokumentasiUrl: '',
              compressedSizeKb: 0,
              originalSizeKb: 0,
              compressionSavingsPct: 0,
              updatedAt: new Date().toISOString().split('T')[0]
            });
          }
        });

        setExcelPreviewRows(mapped);
        setShowExcelPreview(true);
      } catch (err) {
        console.error('Gagal membaca file Excel Database Barang:', err);
      }
    };
    reader.readAsBinaryString(file);
  };

  const handleConfirmExcelImport = () => {
    if (excelPreviewRows.length === 0) return;
    setIsSavingImport(true);

    setTimeout(() => {
      try {
        const { count, saved } = databaseBarangService.importBatch(excelPreviewRows, importMode);
        setItems(saved);
        if (onSyncWithMasterSku) onSyncWithMasterSku(saved);
        const importedCount = count;
        setIsUploadExcelOpen(false);
        setExcelPreviewRows([]);
        setExcelFileName('');
        setShowExcelPreview(false);
        setFeedbackModal({
          title: 'Import Database Barang Berhasil',
          message: importMode === 'replace_all'
            ? `Seluruh database lama berhasil digantikan (${importedCount} barang tersimpan persis sesuai urutan file Excel ke database).`
            : `Sebanyak ${importedCount} barang berhasil digabungkan/diperbarui ke database barang.`
        });
      } catch (err: any) {
        console.error('Gagal import file:', err);
        setFeedbackModal({
          title: 'Gagal Menyimpan Data',
          message: `Terjadi kendala saat menyimpan database barang: ${err?.message || 'Error penyimpanan'}`
        });
      } finally {
        setIsSavingImport(false);
      }
    }, 60);
  };

  // Preview & Upload Excel Sub-View
  if (isUploadExcelOpen) {
    return (
      <div className="space-y-6 animate-fade-in">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-xs">
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <span className="px-2.5 py-0.5 rounded-lg bg-blue-50 dark:bg-blue-500/15 border border-blue-200 dark:border-blue-500/30 text-blue-700 dark:text-blue-300 text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5">
              <Database className="w-3.5 h-3.5" />
              <span>Warehouse Management System &bull; Database Barang</span>
            </span>
            <span className="px-2.5 py-0.5 rounded-lg bg-emerald-50 dark:bg-emerald-500/15 border border-emerald-200 dark:border-emerald-500/30 text-emerald-700 dark:text-emerald-300 text-[10px] font-bold">
              Import &amp; Urutan Asli Terjaga
            </span>
          </div>
          <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
            Upload Excel Database Barang
          </h2>
          <p className="text-xs sm:text-sm font-normal text-slate-500 dark:text-slate-400 mt-1.5 max-w-3xl leading-relaxed">
            Unggah file Excel Database Barang sesuai format: <strong>No. Barang, Deskripsi Barang, Unit 1, Unit 2, Unit 3, Rasio 2, Rasio 3, Panjang(L)cm, Lebar(W)cm, Tinggi(H)cm, VOL(M3), Berat(kg)</strong>. Urutan data akan disimpan persis sesuai urutan baris di dalam file Excel tanpa perubahan urutan.
          </p>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 sm:p-8 shadow-xs space-y-6">
          {/* Mode Import Selector */}
          <div className="space-y-2">
            <label className="block text-[11px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
              PILIH MODE IMPORT (PERLAKUAN DATA LAMA)
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setImportMode('replace_all')}
                className={`p-4 rounded-2xl border text-left transition cursor-pointer flex flex-col justify-between ${
                  importMode === 'replace_all'
                    ? 'border-blue-500 bg-blue-50/70 dark:bg-blue-950/30 text-slate-900 dark:text-white ring-2 ring-blue-500/20'
                    : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:border-slate-300'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs sm:text-sm font-black flex items-center gap-2">
                      <span className={`w-2.5 h-2.5 rounded-full ${importMode === 'replace_all' ? 'bg-blue-600' : 'bg-slate-300'}`} />
                      Timpa File Lama (Replace All)
                    </span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300">
                      Default / Rekomendasi
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                    Seluruh isi database lama digantikan total dengan data baru dari file Excel. Urutan baris disimpan sama persis dengan file.
                  </p>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setImportMode('append')}
                className={`p-4 rounded-2xl border text-left transition cursor-pointer flex flex-col justify-between ${
                  importMode === 'append'
                    ? 'border-blue-500 bg-blue-50/70 dark:bg-blue-950/30 text-slate-900 dark:text-white ring-2 ring-blue-500/20'
                    : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:border-slate-300'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs sm:text-sm font-black flex items-center gap-2">
                      <span className={`w-2.5 h-2.5 rounded-full ${importMode === 'append' ? 'bg-blue-600' : 'bg-slate-300'}`} />
                      Gabungkan / Tambah (Append &amp; Update)
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                    Barang dengan No. Barang yang sama akan diperbarui, dan barang baru ditambahkan tanpa menghapus data yang sudah ada sebelumnya.
                  </p>
                </div>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-end">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="block text-[11px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  FILE EXCEL DATABASE BARANG (.XLSX / .CSV)
                </label>
                <button
                  type="button"
                  onClick={handleDownloadTemplateExcel}
                  className="text-xs font-bold text-blue-600 dark:text-blue-400 hover:text-blue-700 hover:underline flex items-center gap-1 cursor-pointer"
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
              <div className="text-xs font-bold text-blue-700 dark:text-blue-400 flex items-center gap-2 pb-2">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>
                  File dipilih: <strong>{excelFileName}</strong> ({excelPreviewRows.length} baris barang terbaca)
                </span>
              </div>
            )}
          </div>

          <div className="p-4 rounded-2xl bg-blue-50/70 dark:bg-blue-950/20 border border-blue-200/80 dark:border-blue-900/40 text-blue-950 dark:text-blue-300 text-xs sm:text-sm font-medium leading-relaxed">
            Kolom yang dibaca otomatis: <strong>No. Barang, Deskripsi Barang, Unit 1, Unit 2, Unit 3, Rasio 2, Rasio 3, Panjang(L)cm, Lebar(W)cm, Tinggi(H)cm, VOL(M3), Berat(kg)</strong>. Data kosong atau 0 tidak dipaksa terisi.
          </div>

          {/* Interactive Preview Table Before Saving */}
          {showExcelPreview && excelPreviewRows.length > 0 && (
            <div className="pt-4 border-t border-slate-200 dark:border-slate-800 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h4 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-2">
                    <span>Pratinjau Data Sebelum Disimpan</span>
                    <span className="px-2.5 py-0.5 rounded-full text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 font-bold border border-blue-200 dark:border-blue-800/60">
                      {excelPreviewRows.length} Baris Siap Diimpor
                    </span>
                  </h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Periksa data di bawah ini. Kolom kosong atau bernilai 0 tetap disimpan apa adanya tanpa dipaksa bernilai. Klik <strong>Simpan ke Database Barang</strong> untuk mengonfirmasi.
                  </p>
                </div>
              </div>

              <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800 max-h-[460px]">
                <table className="w-full text-xs text-left border-collapse whitespace-nowrap">
                  <thead className="bg-slate-50 dark:bg-slate-950 text-blue-900 dark:text-blue-300 font-bold text-[11px] sticky top-0 z-10 border-b border-slate-200 dark:border-slate-800">
                    <tr>
                      <th className="py-2.5 px-3 text-center border-r border-slate-200 dark:border-slate-800">#</th>
                      <th className="py-2.5 px-3 border-r border-slate-200 dark:border-slate-800">No. Barang</th>
                      <th className="py-2.5 px-3 border-r border-slate-200 dark:border-slate-800">Deskripsi Barang</th>
                      <th className="py-2.5 px-3 text-center border-r border-slate-200 dark:border-slate-800">Unit 1</th>
                      <th className="py-2.5 px-3 text-center border-r border-slate-200 dark:border-slate-800">Unit 2</th>
                      <th className="py-2.5 px-3 text-center border-r border-slate-200 dark:border-slate-800">Unit 3</th>
                      <th className="py-2.5 px-3 text-center border-r border-slate-200 dark:border-slate-800">Rasio 2</th>
                      <th className="py-2.5 px-3 text-center border-r border-slate-200 dark:border-slate-800">Rasio 3</th>
                      <th className="py-2.5 px-3 text-right border-r border-slate-200 dark:border-slate-800">Panjang(L)cm</th>
                      <th className="py-2.5 px-3 text-right border-r border-slate-200 dark:border-slate-800">Lebar(W)cm</th>
                      <th className="py-2.5 px-3 text-right border-r border-slate-200 dark:border-slate-800">Tinggi(H)cm</th>
                      <th className="py-2.5 px-3 text-right border-r border-slate-200 dark:border-slate-800">VOL(M3)</th>
                      <th className="py-2.5 px-3 text-right">Berat(kg)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-800 text-slate-800 dark:text-slate-200 bg-white dark:bg-slate-900">
                    {excelPreviewRows.map((row, idx) => (
                      <tr key={row.id || idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                        <td className="py-2 px-3 text-center font-mono text-slate-400 border-r border-slate-200 dark:border-slate-800">
                          {idx + 1}
                        </td>
                        <td className="py-2 px-3 font-mono font-bold text-blue-700 dark:text-blue-400 border-r border-slate-200 dark:border-slate-800">
                          {row.noBarang}
                        </td>
                        <td className="py-2 px-3 font-semibold border-r border-slate-200 dark:border-slate-800 max-w-xs truncate">
                          {row.deskripsiBarang}
                        </td>
                        <td className="py-2 px-3 text-center font-bold text-slate-700 dark:text-slate-300 border-r border-slate-200 dark:border-slate-800">
                          {row.unit1}
                        </td>
                        <td className="py-2 px-3 text-center border-r border-slate-200 dark:border-slate-800">
                          {row.unit2 ? (
                            <span className="text-slate-700 dark:text-slate-300">{row.unit2}</span>
                          ) : (
                            <span className="text-slate-400 font-mono">-</span>
                          )}
                        </td>
                        <td className="py-2 px-3 text-center border-r border-slate-200 dark:border-slate-800">
                          {row.unit3 ? (
                            <span className="text-slate-700 dark:text-slate-300">{row.unit3}</span>
                          ) : (
                            <span className="text-slate-400 font-mono">-</span>
                          )}
                        </td>
                        <td className="py-2 px-3 text-center font-mono border-r border-slate-200 dark:border-slate-800">
                          {row.rasio2 && Number(row.rasio2) !== 0 ? (
                            <span className="text-slate-700 dark:text-slate-300 font-semibold">{row.rasio2}</span>
                          ) : (
                            <span className="text-slate-400 font-mono">0</span>
                          )}
                        </td>
                        <td className="py-2 px-3 text-center font-mono border-r border-slate-200 dark:border-slate-800">
                          {row.rasio3 && Number(row.rasio3) !== 0 ? (
                            <span className="text-slate-700 dark:text-slate-300 font-semibold">{row.rasio3}</span>
                          ) : (
                            <span className="text-slate-400 font-mono">0</span>
                          )}
                        </td>
                        <td className="py-2 px-3 text-right font-mono border-r border-slate-200 dark:border-slate-800">
                          {row.panjangCm > 0 ? (
                            <span className="text-slate-800 dark:text-slate-200 font-medium">{row.panjangCm}</span>
                          ) : (
                            <span className="text-slate-400 font-mono">0</span>
                          )}
                        </td>
                        <td className="py-2 px-3 text-right font-mono border-r border-slate-200 dark:border-slate-800">
                          {row.lebarCm > 0 ? (
                            <span className="text-slate-800 dark:text-slate-200 font-medium">{row.lebarCm}</span>
                          ) : (
                            <span className="text-slate-400 font-mono">0</span>
                          )}
                        </td>
                        <td className="py-2 px-3 text-right font-mono border-r border-slate-200 dark:border-slate-800">
                          {row.tinggiCm > 0 ? (
                            <span className="text-slate-800 dark:text-slate-200 font-medium">{row.tinggiCm}</span>
                          ) : (
                            <span className="text-slate-400 font-mono">0</span>
                          )}
                        </td>
                        <td className="py-2 px-3 text-right font-mono border-r border-slate-200 dark:border-slate-800">
                          {row.volM3 > 0 ? (
                            <span className="font-bold text-blue-700 dark:text-blue-400">{row.volM3}</span>
                          ) : (
                            <span className="text-slate-400 font-mono">0</span>
                          )}
                        </td>
                        <td className="py-2 px-3 text-right font-mono">
                          {row.beratKg > 0 ? (
                            <span className="font-bold text-slate-800 dark:text-slate-200">{row.beratKg}</span>
                          ) : (
                            <span className="text-slate-400 font-mono">0</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => {
                setIsUploadExcelOpen(false);
                setShowExcelPreview(false);
                setExcelPreviewRows([]);
                setExcelFileName('');
              }}
              className="px-5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 font-bold text-xs sm:text-sm hover:bg-slate-50 dark:hover:bg-slate-800 transition cursor-pointer"
            >
              Kembali ke Database Barang
            </button>

            {excelPreviewRows.length > 0 && (
              <button
                type="button"
                disabled={isSavingImport}
                onClick={handleConfirmExcelImport}
                className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-60 text-white font-bold text-xs sm:text-sm flex items-center gap-2 shadow-sm transition cursor-pointer"
              >
                {isSavingImport ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Menyimpan ke Database Barang...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    <span>
                      Simpan ke Database Barang ({excelPreviewRows.length} Item &bull; {importMode === 'replace_all' ? 'Timpa Semua' : 'Gabungkan'})
                    </span>
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Top Header Banner */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-lg bg-blue-50 dark:bg-blue-500/15 border border-blue-200 dark:border-blue-500/30 text-blue-700 dark:text-blue-300 text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5">
              <Database className="w-3.5 h-3.5" />
              <span>Database Barang Gudang (WMS)</span>
            </span>
            <span className="px-2.5 py-0.5 rounded-lg bg-indigo-50 dark:bg-indigo-500/15 border border-indigo-200 dark:border-indigo-500/30 text-indigo-700 dark:text-indigo-300 text-[10px] font-bold flex items-center gap-1">
              <Link2 className="w-3 h-3" />
              <span>Terintegrasi Input Faktur / Sales Order (SO)</span>
            </span>
          </div>
          <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-white tracking-tight">
            Database Barang &mdash; Spesifikasi Dimensi, Kubikasi, Satuan &amp; Rasio
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 max-w-3xl">
            Tabel database barang dengan format standar: <strong>No. Barang, Deskripsi Barang, Unit 1, Unit 2, Unit 3, Rasio 2, Rasio 3, Panjang(L)cm, Lebar(W)cm, Tinggi(H)cm, VOL(M3), Berat(kg)</strong>. Perubahan data dilakukan melalui kolom <strong>Aksi</strong>.
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
            className="px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold flex items-center gap-1.5 transition cursor-pointer shadow-xs"
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

      {/* Search, Filter, Sort & Table Mode Controls */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-xs space-y-3">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          {/* Input Pencarian */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Cari No. Barang, Deskripsi Barang, atau Satuan..."
              className="w-full pl-10 pr-4 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-blue-500"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-xs"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Quick Sort Dropdown */}
          <div className="flex items-center gap-1.5 shrink-0">
            <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 flex items-center gap-1">
              <ArrowUpDown className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
              <span>Urutkan:</span>
            </span>
            <select
              value={sortBy}
              onChange={e => setSortBy(e.target.value)}
              className="px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs font-bold text-slate-800 dark:text-slate-200 cursor-pointer focus:outline-none focus:border-blue-500"
            >
              <option value="default">📋 Urutan Asli File Excel (Default)</option>
              <option value="nama_asc">🔤 Nama Barang (A &rarr; Z)</option>
              <option value="nama_desc">🔤 Nama Barang (Z &rarr; A)</option>
              <option value="no_asc">🏷️ No. Barang (A &rarr; Z)</option>
              <option value="no_desc">🏷️ No. Barang (Z &rarr; A)</option>
              <option value="berat_asc">⚖️ Berat: Terkecil &rarr; Terbesar</option>
              <option value="berat_desc">⚖️ Berat: Terbesar &rarr; Terkecil</option>
              <option value="vol_asc">📦 Kubikasi VOL: Terkecil &rarr; Terbesar</option>
              <option value="vol_desc">📦 Kubikasi VOL: Terbesar &rarr; Terkecil</option>
            </select>
          </div>
        </div>

        {/* Filter Baris Kedua: Filter Satuan, Status Kubikasi, Status Berat, Mode Tampilan & Ukuran Halaman */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100 dark:border-slate-800/80">
          <div className="flex flex-wrap items-center gap-2">
            {/* Filter Satuan */}
            <select
              value={unitFilter}
              onChange={e => setUnitFilter(e.target.value)}
              className="px-2.5 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs font-bold text-slate-800 dark:text-slate-200 cursor-pointer"
            >
              <option value="ALL">Semua Satuan ({items.length})</option>
              {availableUnits.map(u => (
                <option key={u} value={u}>
                  Satuan: {u}
                </option>
              ))}
            </select>

            {/* Filter Kubikasi */}
            <select
              value={volFilter}
              onChange={e => setVolFilter(e.target.value as any)}
              className="px-2.5 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs font-bold text-slate-800 dark:text-slate-200 cursor-pointer"
            >
              <option value="ALL">Semua Kubikasi</option>
              <option value="has_vol">📦 Memiliki Kubikasi &gt; 0</option>
              <option value="no_vol">⚪ Tanpa Kubikasi (0)</option>
            </select>

            {/* Filter Berat */}
            <select
              value={beratFilter}
              onChange={e => setBeratFilter(e.target.value as any)}
              className="px-2.5 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs font-bold text-slate-800 dark:text-slate-200 cursor-pointer"
            >
              <option value="ALL">Semua Berat</option>
              <option value="has_berat">⚖️ Memiliki Berat &gt; 0 kg</option>
              <option value="no_berat">⚪ Tanpa Berat (0 kg)</option>
            </select>

            {(searchQuery || unitFilter !== 'ALL' || volFilter !== 'ALL' || beratFilter !== 'ALL' || sortBy !== 'default') && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setUnitFilter('ALL');
                  setVolFilter('ALL');
                  setBeratFilter('ALL');
                  setSortBy('default');
                }}
                className="px-2.5 py-1.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800 text-xs font-bold hover:bg-rose-100 transition cursor-pointer flex items-center gap-1"
              >
                <X className="w-3 h-3" />
                <span>Reset Filter</span>
              </button>
            )}
          </div>

          <div className="flex items-center gap-3">
            {/* Toggle Mode Tampilan Tabel: Ringkas (Default, Tanpa Geser) vs Spreadsheet Lengkap */}
            <div className="inline-flex items-center p-0.5 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold">
              <button
                type="button"
                onClick={() => setTableMode('compact')}
                className={`px-3 py-1 rounded-lg transition cursor-pointer flex items-center gap-1.5 ${
                  tableMode === 'compact'
                    ? 'bg-white dark:bg-slate-900 text-blue-700 dark:text-blue-400 shadow-2xs font-black'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                }`}
                title="Tampilan ringkas dan rapi, pas di layar tanpa perlu digeser ke kanan"
              >
                <LayoutGrid className="w-3.5 h-3.5" />
                <span>Mode Ringkas (Tanpa Geser)</span>
              </button>
              <button
                type="button"
                onClick={() => setTableMode('spreadsheet')}
                className={`px-3 py-1 rounded-lg transition cursor-pointer flex items-center gap-1.5 ${
                  tableMode === 'spreadsheet'
                    ? 'bg-white dark:bg-slate-900 text-blue-700 dark:text-blue-400 shadow-2xs font-black'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                }`}
                title="Tampilkan semua kolom spreadsheet satu per satu"
              >
                <List className="w-3.5 h-3.5" />
                <span>Mode Spreadsheet</span>
              </button>
            </div>

            {/* Page Size Selector */}
            <div className="flex items-center gap-1 text-xs">
              <span className="text-slate-400 font-medium">Baris:</span>
              <select
                value={pageSize}
                onChange={e => setPageSize(Number(e.target.value))}
                className="px-2 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs font-bold text-slate-800 dark:text-slate-200 cursor-pointer"
              >
                <option value={10}>10 / Hal</option>
                <option value={25}>25 / Hal</option>
                <option value={50}>50 / Hal</option>
                <option value={100}>100 / Hal</option>
                <option value={200}>200 / Hal</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Main Table Container */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-xs">
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-2">
              <span>Tabel Database Barang</span>
              <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                {tableMode === 'compact' ? 'Tampilan Ringkas (Responsif)' : 'Tampilan Semua Kolom Spreadsheet'}
              </span>
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {tableMode === 'compact'
                ? 'Informasi nomor, deskripsi, satuan konversi, dimensi & kubikasi disajikan ringkas tanpa perlu digeser-geser.'
                : 'Daftar master barang sesuai kolom standar: No. Barang, Deskripsi, Unit 1-3, Rasio 2-3, Dimensi P-L-T, VOL & Berat.'}
            </p>
          </div>
          <span className="text-xs font-bold text-slate-600 dark:text-slate-300">
            Total: <span className="font-mono text-blue-700 dark:text-blue-400 font-black">{filteredItems.length} Barang</span>
          </span>
        </div>

        {/* Tabel Mode Ringkas (Fit on screen, ZERO horizontal scrolling) */}
        {tableMode === 'compact' ? (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left border-collapse">
              <thead className="bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-200 font-bold text-[11px] border-b border-slate-200 dark:border-slate-800 select-none">
                <tr>
                  <th className="py-3 px-3 text-center border-r border-slate-200 dark:border-slate-800 w-12 text-slate-400">#</th>
                  <th
                    onClick={() => setSortBy(prev => prev === 'no_asc' ? 'no_desc' : 'no_asc')}
                    className="py-3 px-3.5 border-r border-slate-200 dark:border-slate-800 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-900 transition w-36"
                  >
                    <div className="flex items-center gap-1.5">
                      <span>No. Barang</span>
                      {sortBy === 'no_asc' ? <ArrowUp className="w-3 h-3 text-blue-600" /> : sortBy === 'no_desc' ? <ArrowDown className="w-3 h-3 text-blue-600" /> : <ArrowUpDown className="w-3 h-3 text-slate-400" />}
                    </div>
                  </th>
                  <th
                    onClick={() => setSortBy(prev => prev === 'nama_asc' ? 'nama_desc' : 'nama_asc')}
                    className="py-3 px-3.5 border-r border-slate-200 dark:border-slate-800 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-900 transition min-w-[240px]"
                  >
                    <div className="flex items-center gap-1.5">
                      <span>Deskripsi Barang</span>
                      {sortBy === 'nama_asc' ? <ArrowUp className="w-3 h-3 text-blue-600" /> : sortBy === 'nama_desc' ? <ArrowDown className="w-3 h-3 text-blue-600" /> : <ArrowUpDown className="w-3 h-3 text-slate-400" />}
                    </div>
                  </th>
                  <th className="py-3 px-3.5 border-r border-slate-200 dark:border-slate-800 w-44">
                    <span>Satuan &amp; Konversi</span>
                  </th>
                  <th
                    onClick={() => setSortBy(prev => prev === 'vol_asc' ? 'vol_desc' : 'vol_asc')}
                    className="py-3 px-3.5 border-r border-slate-200 dark:border-slate-800 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-900 transition w-48"
                  >
                    <div className="flex items-center gap-1.5">
                      <span>Dimensi (P&times;L&times;T) &amp; Kubikasi</span>
                      {sortBy === 'vol_asc' ? <ArrowUp className="w-3 h-3 text-blue-600" /> : sortBy === 'vol_desc' ? <ArrowDown className="w-3 h-3 text-blue-600" /> : <ArrowUpDown className="w-3 h-3 text-slate-400" />}
                    </div>
                  </th>
                  <th
                    onClick={() => setSortBy(prev => prev === 'berat_asc' ? 'berat_desc' : 'berat_asc')}
                    className="py-3 px-3 text-right border-r border-slate-200 dark:border-slate-800 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-900 transition w-24"
                  >
                    <div className="flex items-center justify-end gap-1.5">
                      <span>Berat</span>
                      {sortBy === 'berat_asc' ? <ArrowUp className="w-3 h-3 text-blue-600" /> : sortBy === 'berat_desc' ? <ArrowDown className="w-3 h-3 text-blue-600" /> : <ArrowUpDown className="w-3 h-3 text-slate-400" />}
                    </div>
                  </th>
                  <th className="py-3 px-3.5 text-center w-24">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800 text-slate-800 dark:text-slate-200">
                {paginatedItems.length > 0 ? (
                  paginatedItems.map((item, idx) => {
                    const rowNum = (currentPage - 1) * pageSize + idx + 1;
                    const hasDim = item.panjangCm > 0 || item.lebarCm > 0 || item.tinggiCm > 0;
                    const calculatedVol = item.volM3 > 0 ? item.volM3 : (hasDim ? calculateVolM3(item.panjangCm, item.lebarCm, item.tinggiCm) : 0);

                    return (
                      <tr key={item.id} className="hover:bg-blue-50/40 dark:hover:bg-slate-800/40 transition">
                        <td className="py-2.5 px-3 text-center font-mono font-bold text-slate-400 border-r border-slate-200 dark:border-slate-800">
                          {rowNum}
                        </td>
                        <td className="py-2.5 px-3.5 border-r border-slate-200 dark:border-slate-800">
                          <span className="font-mono font-bold text-blue-700 dark:text-blue-400">
                            {item.noBarang}
                          </span>
                        </td>
                        <td className="py-2.5 px-3.5 border-r border-slate-200 dark:border-slate-800">
                          <div className="font-semibold text-slate-900 dark:text-white leading-snug">
                            {item.deskripsiBarang || item.keteranganBarang}
                          </div>
                        </td>
                        <td className="py-2.5 px-3.5 border-r border-slate-200 dark:border-slate-800">
                          <div className="flex flex-col gap-1 items-start">
                            <span className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-bold text-[11px] text-slate-900 dark:text-white">
                              {item.unit1 || item.satuan || 'Pcs'}
                            </span>
                            {item.unit2 && (
                              <span className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">
                                1 {item.unit2} {item.rasio2 ? `= ${item.rasio2} ${item.unit1 || 'Pcs'}` : ''}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-2.5 px-3.5 border-r border-slate-200 dark:border-slate-800 font-mono">
                          {hasDim || calculatedVol > 0 ? (
                            <div className="flex flex-col gap-0.5 items-start">
                              <span className="text-slate-800 dark:text-slate-200 font-medium text-[11px]">
                                {item.panjangCm || 0} &times; {item.lebarCm || 0} &times; {item.tinggiCm || 0} cm
                              </span>
                              {calculatedVol > 0 ? (
                                <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300 font-bold text-[10px]">
                                  {calculatedVol} M3
                                </span>
                              ) : (
                                <span className="text-slate-400 text-[10px]">0 M3</span>
                              )}
                            </div>
                          ) : (
                            <span className="text-slate-400 font-mono">-</span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-right border-r border-slate-200 dark:border-slate-800 font-mono">
                          {item.beratKg > 0 ? (
                            <span className="font-bold text-slate-900 dark:text-white">{item.beratKg} kg</span>
                          ) : (
                            <span className="text-slate-400 font-mono">-</span>
                          )}
                        </td>
                        <td className="py-2.5 px-3.5 text-center">
                          <div className="inline-flex items-center justify-center gap-1">
                            {item.dokumentasiUrl && (
                              <button
                                type="button"
                                onClick={() => setPreviewDocItem(item)}
                                className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition cursor-pointer"
                                title="Lihat Foto Dokumentasi"
                              >
                                <Eye className="w-3.5 h-3.5" />
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => openEditModal(item)}
                              className="p-1.5 rounded-lg bg-blue-50 dark:bg-blue-500/15 hover:bg-blue-100 text-blue-700 dark:text-blue-300 transition cursor-pointer"
                              title="Edit Data Barang"
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
                    <td colSpan={7} className="py-10 text-center text-slate-400 text-xs">
                      Tidak ada data barang yang sesuai filter pencarian.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        ) : (
          /* Tabel Mode Spreadsheet Lengkap (13 Kolom) */
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left border-collapse whitespace-nowrap">
              <thead className="bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-200 font-bold text-[11px] border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="py-3 px-3 text-center border-r border-slate-200 dark:border-slate-800 w-10">#</th>
                  <th className="py-3 px-3.5 border-r border-slate-200 dark:border-slate-800">No. Barang</th>
                  <th className="py-3 px-3.5 border-r border-slate-200 dark:border-slate-800 min-w-[200px]">Deskripsi Barang</th>
                  <th className="py-3 px-3 text-center border-r border-slate-200 dark:border-slate-800">Unit 1</th>
                  <th className="py-3 px-3 text-center border-r border-slate-200 dark:border-slate-800">Unit 2</th>
                  <th className="py-3 px-3 text-center border-r border-slate-200 dark:border-slate-800">Unit 3</th>
                  <th className="py-3 px-3 text-center border-r border-slate-200 dark:border-slate-800">Rasio 2</th>
                  <th className="py-3 px-3 text-center border-r border-slate-200 dark:border-slate-800">Rasio 3</th>
                  <th className="py-3 px-3 text-right border-r border-slate-200 dark:border-slate-800">Panjang(L)cm</th>
                  <th className="py-3 px-3 text-right border-r border-slate-200 dark:border-slate-800">Lebar(W)cm</th>
                  <th className="py-3 px-3 text-right border-r border-slate-200 dark:border-slate-800">Tinggi(H)cm</th>
                  <th className="py-3 px-3 text-right border-r border-slate-200 dark:border-slate-800">VOL(M3)</th>
                  <th className="py-3 px-3 text-right border-r border-slate-200 dark:border-slate-800">Berat(kg)</th>
                  <th className="py-3 px-3.5 text-center w-24">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800 text-slate-800 dark:text-slate-200">
                {paginatedItems.length > 0 ? (
                  paginatedItems.map((item, idx) => {
                    const rowNum = (currentPage - 1) * pageSize + idx + 1;
                    return (
                      <tr key={item.id} className="hover:bg-blue-50/40 dark:hover:bg-slate-800/40 transition">
                        <td className="py-2.5 px-3 text-center font-mono font-bold text-slate-400 border-r border-slate-200 dark:border-slate-800">
                          {rowNum}
                        </td>
                        <td className="py-2.5 px-3.5 border-r border-slate-200 dark:border-slate-800">
                          <span className="font-mono font-bold text-blue-700 dark:text-blue-400">
                            {item.noBarang}
                          </span>
                        </td>
                        <td className="py-2.5 px-3.5 border-r border-slate-200 dark:border-slate-800">
                          <div className="font-semibold text-slate-900 dark:text-white max-w-sm truncate">
                            {item.deskripsiBarang || item.keteranganBarang}
                          </div>
                        </td>
                        <td className="py-2.5 px-3 text-center border-r border-slate-200 dark:border-slate-800 font-bold text-slate-800 dark:text-slate-200">
                          {item.unit1 || item.satuan}
                        </td>
                        <td className="py-2.5 px-3 text-center border-r border-slate-200 dark:border-slate-800">
                          {item.unit2 ? (
                            <span className="text-slate-700 dark:text-slate-300">{item.unit2}</span>
                          ) : (
                            <span className="text-slate-400 font-mono">-</span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-center border-r border-slate-200 dark:border-slate-800">
                          {item.unit3 ? (
                            <span className="text-slate-700 dark:text-slate-300">{item.unit3}</span>
                          ) : (
                            <span className="text-slate-400 font-mono">-</span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-center border-r border-slate-200 dark:border-slate-800 font-mono">
                          {item.rasio2 && Number(item.rasio2) !== 0 ? (
                            <span className="text-slate-700 dark:text-slate-300 font-semibold">{item.rasio2}</span>
                          ) : (
                            <span className="text-slate-400 font-mono">0</span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-center border-r border-slate-200 dark:border-slate-800 font-mono">
                          {item.rasio3 && Number(item.rasio3) !== 0 ? (
                            <span className="text-slate-700 dark:text-slate-300 font-semibold">{item.rasio3}</span>
                          ) : (
                            <span className="text-slate-400 font-mono">0</span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-right border-r border-slate-200 dark:border-slate-800 font-mono">
                          {item.panjangCm > 0 ? (
                            <span className="text-slate-800 dark:text-slate-200 font-medium">{item.panjangCm}</span>
                          ) : (
                            <span className="text-slate-400 font-mono">0</span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-right border-r border-slate-200 dark:border-slate-800 font-mono">
                          {item.lebarCm > 0 ? (
                            <span className="text-slate-800 dark:text-slate-200 font-medium">{item.lebarCm}</span>
                          ) : (
                            <span className="text-slate-400 font-mono">0</span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-right border-r border-slate-200 dark:border-slate-800 font-mono">
                          {item.tinggiCm > 0 ? (
                            <span className="text-slate-800 dark:text-slate-200 font-medium">{item.tinggiCm}</span>
                          ) : (
                            <span className="text-slate-400 font-mono">0</span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-right border-r border-slate-200 dark:border-slate-800 font-mono">
                          {item.volM3 > 0 ? (
                            <span className="font-bold text-blue-700 dark:text-blue-400">{item.volM3}</span>
                          ) : (
                            <span className="text-slate-400 font-mono">0</span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-right border-r border-slate-200 dark:border-slate-800 font-mono">
                          {item.beratKg > 0 ? (
                            <span className="font-bold text-slate-900 dark:text-white">{item.beratKg}</span>
                          ) : (
                            <span className="text-slate-400 font-mono">0</span>
                          )}
                        </td>
                        <td className="py-2.5 px-3.5 text-center">
                          <div className="inline-flex items-center gap-1">
                            {item.dokumentasiUrl && (
                              <button
                                type="button"
                                onClick={() => setPreviewDocItem(item)}
                                className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition cursor-pointer"
                                title="Lihat Foto Dokumentasi"
                              >
                                <Eye className="w-3.5 h-3.5" />
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => openEditModal(item)}
                              className="p-1.5 rounded-lg bg-blue-50 dark:bg-blue-500/15 hover:bg-blue-100 text-blue-700 dark:text-blue-300 transition cursor-pointer"
                              title="Edit Data Barang"
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
                    <td colSpan={14} className="py-8 text-center text-slate-400 text-xs">
                      Tidak ada data barang yang sesuai pencarian.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Smart Windowed Pagination Bar (Tidak Membludak 139 Tombol) */}
        <div className="p-4 border-t border-slate-200 dark:border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
          <div className="text-slate-500 dark:text-slate-400 font-medium">
            Menampilkan{' '}
            <strong className="text-slate-900 dark:text-white font-mono">
              {filteredItems.length === 0 ? 0 : (currentPage - 1) * pageSize + 1}
            </strong>{' '}
            &ndash;{' '}
            <strong className="text-slate-900 dark:text-white font-mono">
              {Math.min(currentPage * pageSize, filteredItems.length)}
            </strong>{' '}
            dari <strong className="text-slate-900 dark:text-white font-mono">{filteredItems.length}</strong> barang &bull; Halaman {currentPage} dari {totalPages}
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              disabled={currentPage <= 1}
              onClick={() => setPage(1)}
              className="px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-700 dark:text-slate-300 font-bold disabled:opacity-30 cursor-pointer"
              title="Halaman Pertama"
            >
              &laquo;
            </button>
            <button
              type="button"
              disabled={currentPage <= 1}
              onClick={() => setPage(p => Math.max(1, p - 1))}
              className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-700 dark:text-slate-300 font-bold disabled:opacity-30 cursor-pointer flex items-center gap-1"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              <span>Sebelumnya</span>
            </button>

            {paginationRange.map((item, idx) => {
              if (item === '...') {
                return (
                  <span key={`dots-${idx}`} className="px-1.5 py-1 text-slate-400 font-bold">
                    ...
                  </span>
                );
              }
              const pageNum = Number(item);
              return (
                <button
                  key={`page-${pageNum}`}
                  type="button"
                  onClick={() => setPage(pageNum)}
                  className={`min-w-8 h-8 px-2 rounded-xl font-mono text-xs font-black transition cursor-pointer ${
                    pageNum === currentPage
                      ? 'bg-blue-600 text-white shadow-2xs'
                      : 'bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                >
                  {pageNum}
                </button>
              );
            })}

            <button
              type="button"
              disabled={currentPage >= totalPages}
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-700 dark:text-slate-300 font-bold disabled:opacity-30 cursor-pointer flex items-center gap-1"
            >
              <span>Selanjutnya</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              disabled={currentPage >= totalPages}
              onClick={() => setPage(totalPages)}
              className="px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-700 dark:text-slate-300 font-bold disabled:opacity-30 cursor-pointer"
              title="Halaman Terakhir"
            >
              &raquo;
            </button>

            {/* Lompat ke Halaman Form */}
            <form
              onSubmit={e => {
                e.preventDefault();
                const p = parseInt(jumpPageInput, 10);
                if (!isNaN(p) && p >= 1 && p <= totalPages) {
                  setPage(p);
                  setJumpPageInput('');
                }
              }}
              className="flex items-center gap-1 ml-1"
            >
              <input
                type="number"
                min={1}
                max={totalPages}
                value={jumpPageInput}
                onChange={e => setJumpPageInput(e.target.value)}
                placeholder="Hal"
                className="w-12 px-1.5 py-1 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-xs font-mono font-bold text-center text-slate-800 dark:text-slate-200 focus:outline-none focus:border-blue-500"
              />
              <button
                type="submit"
                className="px-2 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 text-xs font-bold cursor-pointer"
              >
                Go
              </button>
            </form>
          </div>
        </div>
      </div>

      {/* Modal Tambah / Edit Database Barang (Template Foto 1) */}
      {isFormModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-2xl w-full p-6 space-y-4 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div>
                <h4 className="text-base font-black text-slate-900 dark:text-white">
                  {editingItem ? 'Edit Data Database Barang' : 'Tambah Database Barang Baru'}
                </h4>
                <p className="text-xs text-slate-500">
                  Form input disesuaikan dengan template database barang (No. Barang, Deskripsi, Unit &amp; Rasio, Dimensi, VOL &amp; Berat).
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

            <form onSubmit={handleSaveItemForm} className="space-y-4 text-xs">
              {/* Seksi 1: Identitas Barang */}
              <div className="space-y-3 p-4 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800">
                <div className="text-[11px] font-black uppercase text-blue-700 dark:text-blue-400 flex items-center gap-1.5">
                  <Box className="w-3.5 h-3.5" />
                  <span>1. Identitas Barang</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <label className="font-bold text-slate-600 dark:text-slate-400 uppercase text-[10px]">
                      No. Barang *
                    </label>
                    <input
                      type="text"
                      required
                      value={noBarang}
                      onChange={e => setNoBarang(e.target.value.toUpperCase())}
                      placeholder="AKK-KBX-001"
                      className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white font-mono font-bold"
                    />
                  </div>

                  <div className="sm:col-span-2 space-y-1">
                    <label className="font-bold text-slate-600 dark:text-slate-400 uppercase text-[10px]">
                      Deskripsi Barang *
                    </label>
                    <input
                      type="text"
                      required
                      value={deskripsiBarang}
                      onChange={e => setDeskripsiBarang(e.target.value)}
                      placeholder="Contoh: Karton Box Corrugated B-Flute 60x40x40 cm (Polos)"
                      className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white font-bold"
                    />
                  </div>
                </div>
              </div>

              {/* Seksi 2: Unit & Rasio */}
              <div className="space-y-3 p-4 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800">
                <div className="text-[11px] font-black uppercase text-indigo-700 dark:text-indigo-400 flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5" />
                  <span>2. Unit Satuan &amp; Rasio Konversi</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                  <div className="space-y-1">
                    <label className="font-bold text-slate-600 dark:text-slate-400 uppercase text-[10px]">
                      Unit 1 (Dasar) *
                    </label>
                    <input
                      type="text"
                      required
                      value={unit1}
                      onChange={e => setUnit1(e.target.value)}
                      placeholder="Pcs"
                      className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white font-bold"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="font-bold text-slate-600 dark:text-slate-400 uppercase text-[10px]">
                      Unit 2
                    </label>
                    <input
                      type="text"
                      value={unit2}
                      onChange={e => setUnit2(e.target.value)}
                      placeholder="Ikat"
                      className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white font-bold"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="font-bold text-slate-600 dark:text-slate-400 uppercase text-[10px]">
                      Rasio 2
                    </label>
                    <input
                      type="number"
                      value={rasio2}
                      onChange={e => setRasio2(e.target.value)}
                      placeholder="25"
                      className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white font-mono font-bold"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="font-bold text-slate-600 dark:text-slate-400 uppercase text-[10px]">
                      Unit 3
                    </label>
                    <input
                      type="text"
                      value={unit3}
                      onChange={e => setUnit3(e.target.value)}
                      placeholder="Palet"
                      className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white font-bold"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="font-bold text-slate-600 dark:text-slate-400 uppercase text-[10px]">
                      Rasio 3
                    </label>
                    <input
                      type="number"
                      value={rasio3}
                      onChange={e => setRasio3(e.target.value)}
                      placeholder="500"
                      className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white font-mono font-bold"
                    />
                  </div>
                </div>
              </div>

              {/* Seksi 3: Dimensi, Kubikasi & Berat */}
              <div className="space-y-3 p-4 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800">
                <div className="text-[11px] font-black uppercase text-blue-700 dark:text-blue-400 flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <Scale className="w-3.5 h-3.5" />
                    <span>3. Dimensi, Volume (M3) &amp; Berat (kg)</span>
                  </div>
                  <span className="text-[10px] lowercase text-slate-400 font-normal">
                    *vol otomatis dihitung: (L x W x H) / 1.000.000
                  </span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                  <div className="space-y-1">
                    <label className="font-bold text-slate-600 dark:text-slate-400 uppercase text-[10px]">
                      Panjang(L)cm
                    </label>
                    <input
                      type="number"
                      step="any"
                      value={panjangCm}
                      onChange={e => handleDimensionChange(Number(e.target.value), lebarCm, tinggiCm)}
                      className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white font-mono font-bold"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="font-bold text-slate-600 dark:text-slate-400 uppercase text-[10px]">
                      Lebar(W)cm
                    </label>
                    <input
                      type="number"
                      step="any"
                      value={lebarCm}
                      onChange={e => handleDimensionChange(panjangCm, Number(e.target.value), tinggiCm)}
                      className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white font-mono font-bold"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="font-bold text-slate-600 dark:text-slate-400 uppercase text-[10px]">
                      Tinggi(H)cm
                    </label>
                    <input
                      type="number"
                      step="any"
                      value={tinggiCm}
                      onChange={e => handleDimensionChange(panjangCm, lebarCm, Number(e.target.value))}
                      className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white font-mono font-bold"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="font-bold text-blue-700 dark:text-blue-400 uppercase text-[10px]">
                      VOL(M3)
                    </label>
                    <input
                      type="number"
                      step="any"
                      value={volM3}
                      onChange={e => setVolM3(Number(e.target.value))}
                      className="w-full px-3 py-2 rounded-xl bg-blue-50/50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 text-blue-900 dark:text-blue-300 font-mono font-bold"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="font-bold text-slate-600 dark:text-slate-400 uppercase text-[10px]">
                      Berat(kg)
                    </label>
                    <input
                      type="number"
                      step="any"
                      value={beratKg}
                      onChange={e => setBeratKg(Number(e.target.value))}
                      className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white font-mono font-bold"
                    />
                  </div>
                </div>
              </div>

              {/* Seksi 4: Dokumentasi Foto (Opsional di Modal) */}
              <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/40 flex items-center gap-3">
                <div className="w-16 h-12 rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700 bg-slate-900 shrink-0">
                  {dokumentasiUrl && (
                    <img
                      src={dokumentasiUrl}
                      alt="Thumbnail Barang"
                      className="w-full h-full object-cover"
                    />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-slate-800 dark:text-slate-200 text-xs">
                    Foto Dokumentasi Barang (Opsional)
                  </div>
                  <label className="mt-1 inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold text-[11px] cursor-pointer transition">
                    <Upload className="w-3 h-3" />
                    <span>{isCompressingPhoto ? 'Memproses...' : 'Pilih Foto'}</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleModalPhotoUpload}
                      className="hidden"
                    />
                  </label>
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
                  className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold cursor-pointer shadow-xs"
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
                <span className="font-mono text-xs font-black text-blue-600 dark:text-blue-400">
                  {previewDocItem.noBarang} &bull; {previewDocItem.unit1 || previewDocItem.satuan}
                </span>
                <h4 className="text-sm font-black text-slate-900 dark:text-white">
                  {previewDocItem.deskripsiBarang || previewDocItem.keteranganBarang}
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
                src={databaseBarangService.getItemThumbnail(previewDocItem)}
                alt={previewDocItem.deskripsiBarang || previewDocItem.keteranganBarang}
                className="w-full max-h-72 object-contain mx-auto"
              />
            </div>
            <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1">
              <span>Dimensi: {previewDocItem.panjangCm} x {previewDocItem.lebarCm} x {previewDocItem.tinggiCm} cm</span>
              <span className="font-bold text-emerald-600">VOL: {previewDocItem.volM3} M3</span>
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
