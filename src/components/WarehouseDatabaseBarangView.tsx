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
  Package,
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
  FileText,
  Camera,
  Smartphone,
  Video
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
  const [fotoFilter, setFotoFilter] = useState<'ALL' | 'has_photo' | 'no_photo'>('ALL');
  const [sortBy, setSortBy] = useState<string>('default');
  const [tableMode, setTableMode] = useState<'compact' | 'spreadsheet'>('compact');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [jumpPageInput, setJumpPageInput] = useState('');
  const [isSavingImport, setIsSavingImport] = useState(false);

  // Cubication KPI metrics for Database Barang (Spesifikasi, Dimensi & Kubikasi)
  const cubicationMetrics = useMemo(() => {
    const totalSku = items.length;
    let totalVol = 0;
    let countWithVol = 0;
    let totalBeratKg = 0;

    items.forEach(item => {
      const vol = Number(item.volM3) || 0;
      const berat = Number(item.beratKg) || 0;
      if (vol > 0) {
        totalVol += vol;
        countWithVol++;
      }
      if (berat > 0) {
        totalBeratKg += berat;
      }
    });

    const avgKubikasiUnit = countWithVol > 0 ? totalVol / countWithVol : 0;

    return {
      totalSku,
      avgKubikasiUnit,
      totalKubikasiStokM3: totalVol,
      totalBeratStokKg: totalBeratKg
    };
  }, [items]);

  // Upload Excel mode with Preview before Save
  const [isUploadExcelOpen, setIsUploadExcelOpen] = useState(false);
  const [excelFileName, setExcelFileName] = useState('');
  const [excelPreviewRows, setExcelPreviewRows] = useState<DatabaseBarangRecord[]>([]);
  const [showExcelPreview, setShowExcelPreview] = useState(false);
  const [importMode, setImportMode] = useState<'replace_all' | 'append'>('replace_all');

  // Modal Tambah / Edit Barang (Template Foto 1)
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<DatabaseBarangRecord | null>(null);
  const [dokumentasiUrls, setDokumentasiUrls] = useState<string[]>([]);
  const [activePhotoIndex, setActivePhotoIndex] = useState<number>(0);

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

  // Direct Live Camera & HP Camera capture state
  const [isCameraModalOpen, setIsCameraModalOpen] = useState(false);
  const [cameraTargetItem, setCameraTargetItem] = useState<DatabaseBarangRecord | null>(null);
  const [cameraFacingMode, setCameraFacingMode] = useState<'environment' | 'user'>('environment');
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const videoRef = React.useRef<HTMLVideoElement | null>(null);
  const nativeCameraInputRef = React.useRef<HTMLInputElement | null>(null);
  const rowNativeCameraInputRef = React.useRef<HTMLInputElement | null>(null);
  const [activeCameraRowItem, setActiveCameraRowItem] = useState<DatabaseBarangRecord | null>(null);

  const startCamera = async (facing: 'environment' | 'user' = cameraFacingMode) => {
    setCameraError(null);
    if (cameraStream) {
      cameraStream.getTracks().forEach(t => t.stop());
      setCameraStream(null);
    }
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Fitur live video peramban tidak didukung. Silakan gunakan tombol kamera standar HP.');
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: facing },
          width: { ideal: 1280 },
          height: { ideal: 720 }
        },
        audio: false
      });
      setCameraStream(stream);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play().catch(e => console.warn('Video play err:', e));
      }
    } catch (err: any) {
      console.warn('Gagal akses kamera langsung:', err);
      setCameraError(err.message || 'Tidak dapat mengakses kamera. Pastikan izin kamera telah disetujui di browser HP.');
    }
  };

  const stopCamera = () => {
    if (cameraStream) {
      cameraStream.getTracks().forEach(t => t.stop());
      setCameraStream(null);
    }
    setIsCameraModalOpen(false);
    setCameraTargetItem(null);
  };

  const toggleCameraFacing = () => {
    const nextFacing = cameraFacingMode === 'environment' ? 'user' : 'environment';
    setCameraFacingMode(nextFacing);
    startCamera(nextFacing);
  };

  const capturePhotoFromLiveStream = async () => {
    if (!videoRef.current) return;
    const video = videoRef.current;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    canvas.toBlob(async blob => {
      if (!blob) return;
      const file = new File([blob], `kamera_${Date.now()}.jpg`, { type: 'image/jpeg' });
      try {
        const compressed = await compressDocumentationPhoto(file, {
          maxDimension: 380,
          targetMaxKb: 14,
          initialQuality: 0.55
        });

        if (cameraTargetItem) {
          const existingUrls = Array.isArray(cameraTargetItem.dokumentasiUrls)
            ? cameraTargetItem.dokumentasiUrls.filter(u => u && !u.startsWith('data:image/svg+xml'))
            : (cameraTargetItem.dokumentasiUrl && !cameraTargetItem.dokumentasiUrl.startsWith('data:image/svg+xml') ? [cameraTargetItem.dokumentasiUrl] : []);
          const updatedUrls = [...existingUrls, compressed.dataUrl];
          databaseBarangService.upsertItem({
            ...cameraTargetItem,
            dokumentasiUrls: updatedUrls,
            dokumentasiUrl: updatedUrls[0]
          });
          setItems(databaseBarangService.getAll());
          setFeedbackModal({
            title: 'Foto Kamera HP Disimpan',
            message: `Foto dokumentasi barang ${cameraTargetItem.noBarang} berhasil diambil dan disimpan langsung!`
          });
        } else {
          setDokumentasiUrls(prev => {
            const combined = [...prev, compressed.dataUrl];
            if (!dokumentasiUrl) setDokumentasiUrl(compressed.dataUrl);
            return combined;
          });
        }
        stopCamera();
      } catch (e) {
        console.error('Gagal kompres foto live camera:', e);
      }
    }, 'image/jpeg', 0.8);
  };

  const triggerCameraForRow = (item: DatabaseBarangRecord) => {
    setActiveCameraRowItem(item);
    if (rowNativeCameraInputRef.current) {
      rowNativeCameraInputRef.current.value = '';
      rowNativeCameraInputRef.current.click();
    }
  };

  const handleRowCameraUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0 || !activeCameraRowItem) return;
    try {
      const results = await Promise.all(
        files.map(f =>
          compressDocumentationPhoto(f, {
            maxDimension: 380,
            targetMaxKb: 14,
            initialQuality: 0.55
          })
        )
      );
      const newUrls = results.map(r => r.dataUrl);
      const existingUrls = Array.isArray(activeCameraRowItem.dokumentasiUrls)
        ? activeCameraRowItem.dokumentasiUrls.filter(u => u && !u.startsWith('data:image/svg+xml'))
        : (activeCameraRowItem.dokumentasiUrl && !activeCameraRowItem.dokumentasiUrl.startsWith('data:image/svg+xml') ? [activeCameraRowItem.dokumentasiUrl] : []);
      const updatedUrls = [...existingUrls, ...newUrls];

      databaseBarangService.upsertItem({
        ...activeCameraRowItem,
        dokumentasiUrls: updatedUrls,
        dokumentasiUrl: updatedUrls[0]
      });
      setItems(databaseBarangService.getAll());
      setFeedbackModal({
        title: 'Foto Kamera HP Berhasil Disimpan',
        message: `Foto dokumentasi barang ${activeCameraRowItem.noBarang} (${activeCameraRowItem.deskripsiBarang}) berhasil diabadikan langsung dari kamera HP!`
      });
    } catch (err) {
      console.error('Gagal upload foto kamera:', err);
    } finally {
      e.target.value = '';
      setActiveCameraRowItem(null);
    }
  };

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

  const photoStats = useMemo(() => {
    let withPhoto = 0;
    let withoutPhoto = 0;
    items.forEach(i => {
      const has = Boolean(
        (i.dokumentasiUrls && i.dokumentasiUrls.length > 0) ||
        (i.dokumentasiUrl && !i.dokumentasiUrl.startsWith('data:image/svg+xml') && i.dokumentasiUrl.trim() !== '')
      );
      if (has) withPhoto++;
      else withoutPhoto++;
    });
    return { withPhoto, withoutPhoto, total: items.length };
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

      const hasCustomPhoto = Boolean(
        (item.dokumentasiUrls && item.dokumentasiUrls.length > 0) ||
        (item.dokumentasiUrl && !item.dokumentasiUrl.startsWith('data:image/svg+xml') && item.dokumentasiUrl.trim() !== '')
      );
      const matchFoto =
        fotoFilter === 'ALL' ||
        (fotoFilter === 'has_photo' && hasCustomPhoto) ||
        (fotoFilter === 'no_photo' && !hasCustomPhoto);

      return matchSearch && matchUnit && matchVol && matchBerat && matchFoto;
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
  }, [items, searchQuery, unitFilter, volFilter, beratFilter, fotoFilter, sortBy]);

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
    setDokumentasiUrl('');
    setDokumentasiUrls([]);
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

    const validUrls = Array.isArray(item.dokumentasiUrls) && item.dokumentasiUrls.length > 0
      ? item.dokumentasiUrls.filter(u => u && !u.startsWith('data:image/svg+xml'))
      : (item.dokumentasiUrl && !item.dokumentasiUrl.startsWith('data:image/svg+xml') ? [item.dokumentasiUrl] : []);
    setDokumentasiUrls(validUrls);
    setDokumentasiUrl(validUrls[0] || '');
    setIsFormModalOpen(true);
  };

  const handleModalPhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    setIsCompressingPhoto(true);
    try {
      const results = await Promise.all(
        files.map(f =>
          compressDocumentationPhoto(f, {
            maxDimension: 360,
            targetMaxKb: 14,
            initialQuality: 0.5
          })
        )
      );
      const newUrls = results.map(r => r.dataUrl);
      setDokumentasiUrls(prev => {
        const combined = [...prev, ...newUrls];
        if (!dokumentasiUrl && combined[0]) {
          setDokumentasiUrl(combined[0]);
        }
        return combined;
      });
    } catch (err) {
      console.error('Gagal kompres foto:', err);
    } finally {
      setIsCompressingPhoto(false);
      e.target.value = '';
    }
  };

  const handleRemovePhoto = (index: number) => {
    setDokumentasiUrls(prev => {
      const updated = prev.filter((_, idx) => idx !== index);
      setDokumentasiUrl(updated[0] || '');
      return updated;
    });
  };

  const handleSaveItemForm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!noBarang.trim() || !deskripsiBarang.trim()) return;

    const primaryDoc = dokumentasiUrls[0] || dokumentasiUrl || '';
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
      dokumentasiUrl: primaryDoc,
      dokumentasiUrls: dokumentasiUrls
    });

    const all = databaseBarangService.getAll();
    setItems(all);
    if (onSyncWithMasterSku) onSyncWithMasterSku(all);
    setIsFormModalOpen(false);
    setFeedbackModal({
      title: editingItem ? 'Database Barang Diperbarui' : 'Barang Baru Ditambahkan',
      message: `Data "${saved.deskripsiBarang}" (${saved.noBarang}) berhasil disimpan dengan ${dokumentasiUrls.length} foto dokumentasi.`
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
      {/* Hidden Mobile Camera Input Trigger for Direct Row & Modal Capture */}
      <input
        ref={nativeCameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleModalPhotoUpload}
        className="hidden"
      />
      <input
        ref={rowNativeCameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleRowCameraUpload}
        className="hidden"
      />

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

      {/* KPI Summary Cards: Total SKU Terdaftar, Rata-Rata Kubikasi / Unit, Total Kubikasi Stok Gudang, Total Berat Stok Gudang */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-2xl shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Total SKU Terdaftar
            </span>
            <Package className="w-4 h-4 text-indigo-500" />
          </div>
          <div className="text-xl font-black text-slate-900 dark:text-white font-mono">
            {cubicationMetrics.totalSku.toLocaleString('id-ID')} Barang
          </div>
          <p className="text-[11px] text-slate-500 mt-1">
            Tersinkronisasi otomatis dengan Database Barang
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
            {cubicationMetrics.avgKubikasiUnit.toFixed(4)} m&sup3;
          </div>
          <p className="text-[11px] text-slate-500 mt-1">
            Volume rata-rata per satuan kemasan karton box
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
            {cubicationMetrics.totalKubikasiStokM3.toLocaleString('id-ID', { maximumFractionDigits: 2 })} m&sup3;
          </div>
          <p className="text-[11px] text-slate-500 mt-1">
            Akumulasi volume seluruh item database
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
            {(cubicationMetrics.totalBeratStokKg / 1000).toLocaleString('id-ID', { maximumFractionDigits: 2 })} Ton
          </div>
          <p className="text-[11px] text-slate-500 mt-1">
            Setara {Math.round(cubicationMetrics.totalBeratStokKg).toLocaleString('id-ID')} Kg total berat barang
          </p>
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

            {/* Filter Status Foto Dokumentasi (Baru: Belum Ada Foto vs Sudah Ada) */}
            <select
              value={fotoFilter}
              onChange={e => setFotoFilter(e.target.value as any)}
              className={`px-2.5 py-1.5 rounded-xl border text-xs font-bold cursor-pointer transition ${
                fotoFilter === 'no_photo'
                  ? 'bg-amber-50 dark:bg-amber-950/40 border-amber-300 dark:border-amber-700 text-amber-800 dark:text-amber-300 ring-1 ring-amber-400/30'
                  : fotoFilter === 'has_photo'
                  ? 'bg-blue-50 dark:bg-blue-950/40 border-blue-300 dark:border-blue-700 text-blue-800 dark:text-blue-300'
                  : 'bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200'
              }`}
            >
              <option value="ALL">📷 Semua Foto ({items.length})</option>
              <option value="no_photo">⚠️ Belum Ada Foto ({photoStats.withoutPhoto})</option>
              <option value="has_photo">✅ Sudah Ada Foto ({photoStats.withPhoto})</option>
            </select>

            {fotoFilter === 'no_photo' && (
              <span className="px-2 py-1 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-700 dark:text-amber-400 text-xs font-bold flex items-center gap-1">
                <span>Filter: Belum Ada Foto</span>
              </span>
            )}

            {(searchQuery || unitFilter !== 'ALL' || volFilter !== 'ALL' || beratFilter !== 'ALL' || fotoFilter !== 'ALL' || sortBy !== 'default') && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setUnitFilter('ALL');
                  setVolFilter('ALL');
                  setBeratFilter('ALL');
                  setFotoFilter('ALL');
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

        {/* Tabel Mode Ringkas (Fit on screen, ZERO horizontal scrolling, Lebih Rapat & Bersih) */}
        {tableMode === 'compact' ? (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left border-collapse">
              <thead className="bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-200 font-bold text-[11px] border-b border-slate-200 dark:border-slate-800 select-none">
                <tr>
                  <th className="py-2 px-2.5 text-center border-r border-slate-200 dark:border-slate-800 w-10 text-slate-400">#</th>
                  <th
                    onClick={() => setSortBy(prev => prev === 'no_asc' ? 'no_desc' : 'no_asc')}
                    className="py-2 px-2.5 border-r border-slate-200 dark:border-slate-800 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-900 transition w-32"
                  >
                    <div className="flex items-center gap-1">
                      <span>No. Barang</span>
                      {sortBy === 'no_asc' ? <ArrowUp className="w-3 h-3 text-blue-600" /> : sortBy === 'no_desc' ? <ArrowDown className="w-3 h-3 text-blue-600" /> : <ArrowUpDown className="w-3 h-3 text-slate-400" />}
                    </div>
                  </th>
                  <th
                    onClick={() => setSortBy(prev => prev === 'nama_asc' ? 'nama_desc' : 'nama_asc')}
                    className="py-2 px-3 border-r border-slate-200 dark:border-slate-800 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-900 transition min-w-[260px]"
                  >
                    <div className="flex items-center gap-1.5">
                      <span>Deskripsi Barang &amp; Foto</span>
                      {sortBy === 'nama_asc' ? <ArrowUp className="w-3 h-3 text-blue-600" /> : sortBy === 'nama_desc' ? <ArrowDown className="w-3 h-3 text-blue-600" /> : <ArrowUpDown className="w-3 h-3 text-slate-400" />}
                    </div>
                  </th>
                  <th className="py-2 px-2.5 border-r border-slate-200 dark:border-slate-800 w-40">
                    <span>Satuan &amp; Konversi</span>
                  </th>
                  <th
                    onClick={() => setSortBy(prev => prev === 'vol_asc' ? 'vol_desc' : 'vol_asc')}
                    className="py-2 px-2.5 border-r border-slate-200 dark:border-slate-800 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-900 transition w-44"
                  >
                    <div className="flex items-center gap-1">
                      <span>Dimensi (P&times;L&times;T) &amp; M3</span>
                      {sortBy === 'vol_asc' ? <ArrowUp className="w-3 h-3 text-blue-600" /> : sortBy === 'vol_desc' ? <ArrowDown className="w-3 h-3 text-blue-600" /> : <ArrowUpDown className="w-3 h-3 text-slate-400" />}
                    </div>
                  </th>
                  <th
                    onClick={() => setSortBy(prev => prev === 'berat_asc' ? 'berat_desc' : 'berat_asc')}
                    className="py-2 px-2.5 text-right border-r border-slate-200 dark:border-slate-800 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-900 transition w-20"
                  >
                    <div className="flex items-center justify-end gap-1">
                      <span>Berat</span>
                      {sortBy === 'berat_asc' ? <ArrowUp className="w-3 h-3 text-blue-600" /> : sortBy === 'berat_desc' ? <ArrowDown className="w-3 h-3 text-blue-600" /> : <ArrowUpDown className="w-3 h-3 text-slate-400" />}
                    </div>
                  </th>
                  <th className="py-2 px-2 text-center w-20">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800 text-slate-800 dark:text-slate-200">
                {paginatedItems.length > 0 ? (
                  paginatedItems.map((item, idx) => {
                    const rowNum = (currentPage - 1) * pageSize + idx + 1;
                    const hasDim = item.panjangCm > 0 || item.lebarCm > 0 || item.tinggiCm > 0;
                    const calculatedVol = item.volM3 > 0 ? item.volM3 : (hasDim ? calculateVolM3(item.panjangCm, item.lebarCm, item.tinggiCm) : 0);

                    const photoList = Array.isArray(item.dokumentasiUrls) && item.dokumentasiUrls.length > 0
                      ? item.dokumentasiUrls.filter(u => u && !u.startsWith('data:image/svg+xml'))
                      : (item.dokumentasiUrl && !item.dokumentasiUrl.startsWith('data:image/svg+xml') ? [item.dokumentasiUrl] : []);
                    const hasCustomPhoto = photoList.length > 0;

                    return (
                      <tr key={item.id} className="hover:bg-blue-50/40 dark:hover:bg-slate-800/40 transition">
                        <td className="py-1.5 px-2 text-center font-mono font-bold text-slate-400 border-r border-slate-200 dark:border-slate-800 text-[11px]">
                          {rowNum}
                        </td>
                        <td className="py-1.5 px-2.5 border-r border-slate-200 dark:border-slate-800 font-mono">
                          <span className="font-bold text-blue-700 dark:text-blue-400 text-xs">
                            {item.noBarang}
                          </span>
                        </td>
                        <td className="py-1.5 px-3 border-r border-slate-200 dark:border-slate-800">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-semibold text-slate-900 dark:text-white leading-tight">
                              {item.deskripsiBarang || item.keteranganBarang}
                            </span>
                            {hasCustomPhoto ? (
                              <button
                                type="button"
                                onClick={() => {
                                  setPreviewDocItem(item);
                                  setActivePhotoIndex(0);
                                }}
                                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-blue-50 dark:bg-blue-900/40 border border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300 text-[10px] font-bold hover:bg-blue-100 transition cursor-pointer shrink-0"
                                title="Klik untuk melihat foto dokumentasi"
                              >
                                <Camera className="w-2.5 h-2.5" />
                                <span>{photoList.length} Foto</span>
                              </button>
                            ) : (
                              <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800/80 text-slate-400 text-[9px] font-medium shrink-0">
                                Tanpa Foto
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-1.5 px-2.5 border-r border-slate-200 dark:border-slate-800">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-bold text-[10px] text-slate-900 dark:text-white">
                              {item.unit1 || item.satuan || 'Pcs'}
                            </span>
                            {item.unit2 && (
                              <span className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">
                                1 {item.unit2} {item.rasio2 ? `= ${item.rasio2} ${item.unit1 || 'Pcs'}` : ''}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-2 px-2.5 border-r border-slate-200 dark:border-slate-800 font-mono">
                          {hasDim || calculatedVol > 0 ? (
                            <div className="flex flex-col gap-1 items-start">
                              <span className="text-slate-700 dark:text-slate-300 font-medium text-xs whitespace-nowrap">
                                {item.panjangCm || 0} &times; {item.lebarCm || 0} &times; {item.tinggiCm || 0} cm
                              </span>
                              {calculatedVol > 0 ? (
                                <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-blue-100 dark:bg-blue-900/70 border border-blue-400 dark:border-blue-700 text-blue-900 dark:text-blue-100 font-black text-xs sm:text-[13px] tracking-wide shadow-2xs">
                                  {calculatedVol} M3
                                </span>
                              ) : (
                                <span className="text-slate-400 text-xs">0 M3</span>
                              )}
                            </div>
                          ) : (
                            <span className="text-slate-400 font-mono text-xs">-</span>
                          )}
                        </td>
                        <td className="py-1.5 px-2.5 text-right border-r border-slate-200 dark:border-slate-800 font-mono">
                          {item.beratKg > 0 ? (
                            <span className="font-bold text-slate-900 dark:text-white">{item.beratKg} kg</span>
                          ) : (
                            <span className="text-slate-400 font-mono">-</span>
                          )}
                        </td>
                        <td className="py-1.5 px-2 text-center">
                          <div className="inline-flex items-center justify-center gap-1">
                            {/* Tombol Ambil Foto Langsung dari HP */}
                            <button
                              type="button"
                              onClick={() => triggerCameraForRow(item)}
                              className="p-1 rounded-md bg-emerald-50 dark:bg-emerald-500/15 hover:bg-emerald-100 text-emerald-700 dark:text-emerald-300 transition cursor-pointer"
                              title="Ambil Foto Langsung Kamera HP"
                            >
                              <Camera className="w-3.5 h-3.5" />
                            </button>
                            {hasCustomPhoto && (
                              <button
                                type="button"
                                onClick={() => {
                                  setPreviewDocItem(item);
                                  setActivePhotoIndex(0);
                                }}
                                className="p-1 rounded-md bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition cursor-pointer"
                                title="Lihat Foto Dokumentasi"
                              >
                                <Eye className="w-3.5 h-3.5" />
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => openEditModal(item)}
                              className="p-1 rounded-md bg-blue-50 dark:bg-blue-500/15 hover:bg-blue-100 text-blue-700 dark:text-blue-300 transition cursor-pointer"
                              title="Edit Data Barang"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteItem(item)}
                              className="p-1 rounded-md bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 transition cursor-pointer"
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
                            <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-blue-100 dark:bg-blue-900/70 border border-blue-400 dark:border-blue-700 text-blue-900 dark:text-blue-100 font-black text-xs sm:text-[13px] tracking-wide shadow-2xs">
                              {item.volM3} M3
                            </span>
                          ) : (
                            <span className="text-slate-400 font-mono text-xs">0 M3</span>
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
                            <button
                              type="button"
                              onClick={() => triggerCameraForRow(item)}
                              className="p-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-500/15 hover:bg-emerald-100 text-emerald-700 dark:text-emerald-300 transition cursor-pointer"
                              title="Ambil Foto Langsung dari Kamera HP"
                            >
                              <Camera className="w-3.5 h-3.5" />
                            </button>
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

              {/* Seksi 4: Dokumentasi Foto (Bisa Kirim Lebih Dari 1 Foto) */}
              <div className="space-y-3 p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/40">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Camera className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                    <div>
                      <div className="font-black text-slate-900 dark:text-white text-xs">
                        4. Foto Dokumentasi Barang (Bisa Ambil Langsung dari HP)
                      </div>
                      <div className="text-[10px] text-slate-500 dark:text-slate-400">
                        Bisa jepret langsung pakai kamera HP atau pilih dari galeri. Otomatis dikompresi agar hemat memori.
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    {/* Tombol Ambil Kamera HP Langsung */}
                    <button
                      type="button"
                      onClick={() => nativeCameraInputRef.current?.click()}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs cursor-pointer shadow-xs transition"
                      title="Buka kamera HP secara langsung untuk memotret barang"
                    >
                      <Camera className="w-3.5 h-3.5" />
                      <span>📸 Ambil Foto Kamera HP</span>
                    </button>
                    {/* Tombol Live Viewfinder Layar */}
                    <button
                      type="button"
                      onClick={() => {
                        setCameraTargetItem(null);
                        setIsCameraModalOpen(true);
                        startCamera('environment');
                      }}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-bold text-xs cursor-pointer transition"
                      title="Buka jendela bidik kamera live di layar HP / Laptop"
                    >
                      <Video className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Live Viewfinder</span>
                    </button>
                    {/* Tombol Unggah File / Galeri */}
                    <label className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs cursor-pointer shadow-xs transition">
                      <Upload className="w-3.5 h-3.5" />
                      <span>{isCompressingPhoto ? 'Mengompres...' : '📁 Pilih Galeri / File'}</span>
                      <input
                        type="file"
                        multiple
                        accept="image/*"
                        onChange={handleModalPhotoUpload}
                        className="hidden"
                      />
                    </label>
                  </div>
                </div>

                {dokumentasiUrls.length > 0 ? (
                  <div className="space-y-2 pt-1">
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                      {dokumentasiUrls.map((url, uIdx) => (
                        <div
                          key={uIdx}
                          className="relative group rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 bg-slate-900 aspect-4/3"
                        >
                          <img
                            src={url}
                            alt={`Dokumentasi ${uIdx + 1}`}
                            className="w-full h-full object-cover"
                          />
                          <div className="absolute top-1 left-1 px-1.5 py-0.5 rounded bg-black/70 text-white text-[9px] font-bold">
                            {uIdx === 0 ? 'Foto Utama' : `Foto #${uIdx + 1}`}
                          </div>
                          <button
                            type="button"
                            onClick={() => handleRemovePhoto(uIdx)}
                            className="absolute top-1 right-1 p-1 rounded-md bg-rose-600 text-white hover:bg-rose-500 transition cursor-pointer shadow-sm"
                            title="Hapus foto ini"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center justify-between pt-1">
                      <span>Total {dokumentasiUrls.length} foto siap disimpan untuk barang ini.</span>
                      <span className="text-emerald-600 dark:text-emerald-400 font-bold text-[10px]">
                        ✓ Terkompresi Otomatis
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="p-4 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 text-center text-xs text-slate-400 space-y-1">
                    <p className="font-semibold text-slate-600 dark:text-slate-300">Belum ada foto dokumentasi diunggah</p>
                    <p className="text-[11px]">Klik tombol <strong>+ Tambah / Unggah Foto</strong> untuk melampirkan foto barang kemasan (bisa lebih dari 1 foto).</p>
                  </div>
                )}
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

      {/* Lightbox Modal Preview Dokumentasi (Mendukung Banyak Foto) */}
      {previewDocItem && (() => {
        const photos = Array.isArray(previewDocItem.dokumentasiUrls) && previewDocItem.dokumentasiUrls.length > 0
          ? previewDocItem.dokumentasiUrls.filter(u => u && !u.startsWith('data:image/svg+xml'))
          : (previewDocItem.dokumentasiUrl && !previewDocItem.dokumentasiUrl.startsWith('data:image/svg+xml') ? [previewDocItem.dokumentasiUrl] : []);
        const totalPhotos = photos.length;
        const currentPhotoUrl = photos[activePhotoIndex] || databaseBarangService.getItemThumbnail(previewDocItem);

        return (
          <div
            className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4"
            onClick={() => {
              setPreviewDocItem(null);
              setActivePhotoIndex(0);
            }}
          >
            <div
              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-lg w-full p-5 space-y-3.5 shadow-2xl"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-black text-blue-600 dark:text-blue-400">
                      {previewDocItem.noBarang}
                    </span>
                    {totalPhotos > 1 && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300">
                        Foto {activePhotoIndex + 1} dari {totalPhotos}
                      </span>
                    )}
                  </div>
                  <h4 className="text-sm font-black text-slate-900 dark:text-white mt-0.5">
                    {previewDocItem.deskripsiBarang || previewDocItem.keteranganBarang}
                  </h4>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setPreviewDocItem(null);
                    setActivePhotoIndex(0);
                  }}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-white cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Main Photo Display */}
              <div className="relative rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800 bg-slate-950 flex items-center justify-center aspect-4/3">
                <img
                  src={currentPhotoUrl}
                  alt={previewDocItem.deskripsiBarang || previewDocItem.keteranganBarang}
                  className="w-full h-full object-contain"
                />

                {totalPhotos > 1 && (
                  <>
                    <button
                      type="button"
                      onClick={() => setActivePhotoIndex(prev => (prev > 0 ? prev - 1 : totalPhotos - 1))}
                      className="absolute left-2 top-1/2 -translate-y-1/2 p-2 rounded-full bg-black/60 text-white hover:bg-black/80 transition cursor-pointer"
                      title="Foto sebelumnya"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setActivePhotoIndex(prev => (prev < totalPhotos - 1 ? prev + 1 : 0))}
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-full bg-black/60 text-white hover:bg-black/80 transition cursor-pointer"
                      title="Foto berikutnya"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </>
                )}
              </div>

              {/* Thumbnail Strip if Multiple Photos */}
              {totalPhotos > 1 && (
                <div className="flex items-center gap-2 overflow-x-auto pb-1">
                  {photos.map((pUrl, pIdx) => (
                    <button
                      key={pIdx}
                      type="button"
                      onClick={() => setActivePhotoIndex(pIdx)}
                      className={`relative w-14 h-11 rounded-lg overflow-hidden border-2 shrink-0 transition cursor-pointer ${
                        activePhotoIndex === pIdx
                          ? 'border-blue-600 ring-2 ring-blue-500/30'
                          : 'border-slate-200 dark:border-slate-700 opacity-60 hover:opacity-100'
                      }`}
                    >
                      <img src={pUrl} alt={`Thumb ${pIdx + 1}`} className="w-full h-full object-cover" />
                    </button>
                  ))}
                </div>
              )}

              <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 pt-2 border-t border-slate-100 dark:border-slate-800">
                <span className="font-medium text-slate-700 dark:text-slate-300">Dimensi: {previewDocItem.panjangCm} &times; {previewDocItem.lebarCm} &times; {previewDocItem.tinggiCm} cm</span>
                <span className="inline-flex items-center px-2.5 py-1 rounded-md bg-blue-100 dark:bg-blue-900/70 border border-blue-400 dark:border-blue-700 text-blue-900 dark:text-blue-100 font-black text-sm tracking-wide shadow-2xs">
                  VOL: {previewDocItem.volM3} M3
                </span>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Live Camera Viewfinder Modal (Bisa Digunakan Langsung Melalui Kamera HP / Laptop) */}
      {isCameraModalOpen && (
        <div className="fixed inset-0 z-60 bg-black/85 backdrop-blur-sm flex items-center justify-center p-3 sm:p-5">
          <div className="relative w-full max-w-md bg-slate-900 border border-slate-700 rounded-2xl overflow-hidden shadow-2xl flex flex-col">
            {/* Camera Header */}
            <div className="p-3 bg-slate-950/80 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-emerald-500/20 text-emerald-400">
                  <Camera className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-black text-white">
                    {cameraTargetItem ? `Foto: ${cameraTargetItem.noBarang}` : 'Ambil Foto Dokumentasi Barang'}
                  </div>
                  <div className="text-[10px] text-slate-400">
                    Arahkan kamera ke barang lalu tekan tombol jepret
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={stopCamera}
                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Video Viewfinder */}
            <div className="relative bg-black aspect-4/3 flex items-center justify-center overflow-hidden">
              {cameraError ? (
                <div className="p-6 text-center space-y-3">
                  <div className="text-amber-400 text-xs font-bold">{cameraError}</div>
                  <p className="text-[11px] text-slate-400">
                    Anda tetap bisa menggunakan tombol kamera bawaan HP di bawah:
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      stopCamera();
                      if (cameraTargetItem) {
                        triggerCameraForRow(cameraTargetItem);
                      } else {
                        nativeCameraInputRef.current?.click();
                      }
                    }}
                    className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs cursor-pointer shadow-md"
                  >
                    📸 Buka Kamera Standar HP
                  </button>
                </div>
              ) : (
                <>
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className="w-full h-full object-cover"
                  />
                  {/* Framing Overlay */}
                  <div className="absolute inset-4 border-2 border-dashed border-white/40 rounded-xl pointer-events-none flex items-center justify-center">
                    <span className="text-[10px] font-bold text-white/80 bg-black/50 px-2 py-0.5 rounded-full">
                      Posisikan Barang di Dalam Kotak
                    </span>
                  </div>
                </>
              )}
            </div>

            {/* Camera Controls Footer */}
            <div className="p-4 bg-slate-950 flex items-center justify-around gap-4">
              <button
                type="button"
                onClick={toggleCameraFacing}
                className="p-3 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-200 transition cursor-pointer"
                title="Putar Kamera (Depan / Belakang)"
              >
                <RefreshCw className="w-5 h-5" />
              </button>

              {/* Shutter Button */}
              <button
                type="button"
                onClick={capturePhotoFromLiveStream}
                disabled={Boolean(cameraError)}
                className="p-4 rounded-full bg-white text-slate-950 hover:bg-slate-200 active:scale-95 transition cursor-pointer shadow-lg ring-4 ring-white/30 disabled:opacity-50"
                title="Jepret Foto"
              >
                <div className="w-8 h-8 rounded-full border-2 border-slate-950 flex items-center justify-center">
                  <Camera className="w-4 h-4" />
                </div>
              </button>

              <button
                type="button"
                onClick={() => {
                  stopCamera();
                  if (cameraTargetItem) {
                    triggerCameraForRow(cameraTargetItem);
                  } else {
                    nativeCameraInputRef.current?.click();
                  }
                }}
                className="p-3 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-200 transition cursor-pointer text-xs font-bold"
                title="Gunakan Aplikasi Kamera HP"
              >
                <Smartphone className="w-5 h-5" />
              </button>
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
