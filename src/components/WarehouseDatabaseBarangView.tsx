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
  Video,
  AlertTriangle,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  RotateCw,
  Crop,
  Check
} from 'lucide-react';
import {
  databaseBarangService,
  DatabaseBarangRecord,
  DatabaseBarangSyncStatus,
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
  const [syncStatus, setSyncStatus] = useState<DatabaseBarangSyncStatus>(() => databaseBarangService.getSyncStatus());
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
    let countWithBerat = 0;

    items.forEach(item => {
      const vol = Number(item.volM3) || 0;
      const berat = Number(item.beratKg) || 0;
      if (vol > 0) {
        totalVol += vol;
        countWithVol++;
      }
      if (berat > 0) {
        totalBeratKg += berat;
        countWithBerat++;
      }
    });

    const avgKubikasiUnit = countWithVol > 0 ? totalVol / countWithVol : 0;
    const avgBeratUnit = countWithBerat > 0 ? totalBeratKg / countWithBerat : 0;

    return {
      totalSku,
      avgKubikasiUnit,
      avgBeratUnit,
      countWithBerat,
      totalKubikasiM3: totalVol,
      totalBeratKg
    };
  }, [items]);

  // Upload Excel mode with Preview before Save
  const [isUploadExcelOpen, setIsUploadExcelOpen] = useState(false);
  const [excelFileName, setExcelFileName] = useState('');
  const [excelPreviewRows, setExcelPreviewRows] = useState<DatabaseBarangRecord[]>([]);
  const [showExcelPreview, setShowExcelPreview] = useState(false);
  const [importMode, setImportMode] = useState<'replace_all' | 'append'>('replace_all');

  // Modal Filter & Ekspor Excel (Satuan, Kubikasi, Berat, Foto)
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [exportUnitFilter, setExportUnitFilter] = useState<string>('ALL');
  const [exportVolFilter, setExportVolFilter] = useState<'ALL' | 'has_vol' | 'no_vol'>('ALL');
  const [exportBeratFilter, setExportBeratFilter] = useState<'ALL' | 'has_berat' | 'no_berat'>('ALL');
  const [exportFotoFilter, setExportFotoFilter] = useState<'ALL' | 'has_photo' | 'no_photo'>('ALL');

  // Modal Tambah / Edit Barang (Template Foto 1)
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<DatabaseBarangRecord | null>(null);
  const [dokumentasiUrls, setDokumentasiUrls] = useState<string[]>([]);
  const [activePhotoIndex, setActivePhotoIndex] = useState<number>(0);

  // Form states matching Foto 1 (default kosong / 0 agar tidak memaksa nilai terisi)
  const [noBarang, setNoBarang] = useState('');
  const [deskripsiBarang, setDeskripsiBarang] = useState('');
  const [unit1, setUnit1] = useState('Pcs');
  const [unit2, setUnit2] = useState('');
  const [unit3, setUnit3] = useState('');
  const [rasio2, setRasio2] = useState<number | string>(0);
  const [rasio3, setRasio3] = useState<number | string>(0);
  const [panjangCm, setPanjangCm] = useState<number>(0);
  const [lebarCm, setLebarCm] = useState<number>(0);
  const [tinggiCm, setTinggiCm] = useState<number>(0);
  const [volM3, setVolM3] = useState<number>(0);
  const [beratKg, setBeratKg] = useState<number>(0);
  const [dokumentasiUrl, setDokumentasiUrl] = useState('');
  const [isCompressingPhoto, setIsCompressingPhoto] = useState(false);

  // Lightbox preview for photo if clicked + interactive Zoom & Pan states
  const [previewDocItem, setPreviewDocItem] = useState<DatabaseBarangRecord | null>(null);
  const [previewZoom, setPreviewZoom] = useState<number>(1);
  const [previewPan, setPreviewPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isDraggingPan, setIsDraggingPan] = useState<boolean>(false);
  const panDragStartRef = React.useRef<{ x: number; y: number; panX: number; panY: number }>({
    x: 0,
    y: 0,
    panX: 0,
    panY: 0
  });
  const [liveCameraZoom, setLiveCameraZoom] = useState<number>(1);
  const [isCropMode, setIsCropMode] = useState<boolean>(false);
  const [cropRect, setCropRect] = useState<{ x: number; y: number; w: number; h: number }>({
    x: 0,
    y: 0,
    w: 100,
    h: 100
  });
  const [cropShape, setCropShape] = useState<'rect' | 'circle'>('rect');
  const [cropAspectRatio, setCropAspectRatio] = useState<'free' | '1:1' | '4:3' | '3:4' | '16:9'>('free');
  const [isApplyingCrop, setIsApplyingCrop] = useState<boolean>(false);
  const cropContainerRef = React.useRef<HTMLDivElement | null>(null);
  const cropDragRef = React.useRef<{
    active: boolean;
    mode: 'move' | 'nw' | 'ne' | 'sw' | 'se' | 'n' | 's' | 'e' | 'w' | 'create';
    startClientX: number;
    startClientY: number;
    startRect: { x: number; y: number; w: number; h: number };
  }>({
    active: false,
    mode: 'move',
    startClientX: 0,
    startClientY: 0,
    startRect: { x: 10, y: 10, w: 80, h: 80 }
  });

  // Custom Delete Confirmation Popup & Feedback Popup
  const [itemToDelete, setItemToDelete] = useState<DatabaseBarangRecord | null>(null);
  const [feedbackModal, setFeedbackModal] = useState<{
    title: string;
    message: string;
    variant?: 'success' | 'danger' | 'info';
    badge?: string;
  } | null>(null);

  // Custom Confirmation Modal for Photo Deletion (menggantikan alert/confirm browser)
  const [photoToDelete, setPhotoToDelete] = useState<{
    item: DatabaseBarangRecord;
    photoIdx: number;
    isAll?: boolean;
    photoUrl?: string;
  } | null>(null);

  // Direct Live Camera & HP Camera capture state
  const [isCameraModalOpen, setIsCameraModalOpen] = useState(false);
  const [cameraTargetItem, setCameraTargetItem] = useState<DatabaseBarangRecord | null>(null);
  const [cameraFacingMode, setCameraFacingMode] = useState<'environment' | 'user'>('environment');
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [cameraSessionCount, setCameraSessionCount] = useState<number>(0);
  const videoRef = React.useRef<HTMLVideoElement | null>(null);
  const nativeCameraInputRef = React.useRef<HTMLInputElement | null>(null);
  const rowNativeCameraInputRef = React.useRef<HTMLInputElement | null>(null);
  const rowGalleryInputRef = React.useRef<HTMLInputElement | null>(null);
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
    setCameraSessionCount(0);
  };

  const toggleCameraFacing = () => {
    const nextFacing = cameraFacingMode === 'environment' ? 'user' : 'environment';
    setCameraFacingMode(nextFacing);
    startCamera(nextFacing);
  };

  const capturePhotoFromLiveStream = async () => {
    if (!videoRef.current) return;
    const video = videoRef.current;
    const rawW = video.videoWidth || 1280;
    const rawH = video.videoHeight || 720;
    const canvas = document.createElement('canvas');
    canvas.width = rawW;
    canvas.height = rawH;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const z = Math.max(1, liveCameraZoom);
    const cropW = rawW / z;
    const cropH = rawH / z;
    const sx = (rawW - cropW) / 2;
    const sy = (rawH - cropH) / 2;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(video, sx, sy, cropW, cropH, 0, 0, rawW, rawH);

    canvas.toBlob(async blob => {
      if (!blob) return;
      const file = new File([blob], `kamera_${Date.now()}.jpg`, { type: 'image/jpeg' });
      try {
        const compressed = await compressDocumentationPhoto(file, {
          maxDimension: 1600,
          initialQuality: 0.92
        });

        if (cameraTargetItem) {
          const freshRecord = databaseBarangService.getAll().find(i => i.id === cameraTargetItem.id) || cameraTargetItem;
          const existingUrls = Array.isArray(freshRecord.dokumentasiUrls)
            ? freshRecord.dokumentasiUrls.filter(u => u && !u.startsWith('data:image/svg+xml'))
            : (freshRecord.dokumentasiUrl && !freshRecord.dokumentasiUrl.startsWith('data:image/svg+xml') ? [freshRecord.dokumentasiUrl] : []);
          const updatedUrls = [...existingUrls, compressed.dataUrl];
          const savedItem = databaseBarangService.upsertItem({
            ...freshRecord,
            dokumentasiUrls: updatedUrls,
            dokumentasiUrl: updatedUrls[0]
          });
          setItems(databaseBarangService.getAll());
          setCameraTargetItem(savedItem);
          setPreviewDocItem(prev => (prev && prev.id === savedItem.id ? savedItem : prev));
          setCameraSessionCount(prev => prev + 1);
        } else {
          setDokumentasiUrls(prev => {
            const combined = [...prev, compressed.dataUrl];
            if (!dokumentasiUrl) setDokumentasiUrl(compressed.dataUrl);
            return combined;
          });
          setCameraSessionCount(prev => prev + 1);
        }
      } catch (e) {
        console.error('Gagal menyimpan foto live camera:', e);
      }
    }, 'image/jpeg', 0.92);
  };

  const triggerCameraForRow = (item: DatabaseBarangRecord) => {
    setCameraTargetItem(item);
    setCameraSessionCount(0);
    setIsCameraModalOpen(true);
    void startCamera('environment');
  };

  const triggerNativeCameraInputForRow = (item: DatabaseBarangRecord) => {
    setActiveCameraRowItem(item);
    if (rowNativeCameraInputRef.current) {
      rowNativeCameraInputRef.current.value = '';
      rowNativeCameraInputRef.current.click();
    }
  };

  const triggerGalleryUploadForRow = (item: DatabaseBarangRecord) => {
    setActiveCameraRowItem(item);
    if (rowGalleryInputRef.current) {
      rowGalleryInputRef.current.value = '';
      rowGalleryInputRef.current.click();
    }
  };

  const handleDeletePhotoFromPreview = (item: DatabaseBarangRecord, photoIdx: number) => {
    const existingUrls = Array.isArray(item.dokumentasiUrls) && item.dokumentasiUrls.length > 0
      ? item.dokumentasiUrls.filter(u => u && !u.startsWith('data:image/svg+xml'))
      : (item.dokumentasiUrl && !item.dokumentasiUrl.startsWith('data:image/svg+xml') ? [item.dokumentasiUrl] : []);
    const removedUrl = existingUrls[photoIdx];
    const updatedUrls = existingUrls.filter((_, idx) => idx !== photoIdx);

    if (removedUrl) {
      databaseBarangService.deletePhoto(item.noBarang, removedUrl);
    }
    const saved = databaseBarangService.upsertItem({
      ...item,
      dokumentasiUrls: updatedUrls,
      dokumentasiUrl: updatedUrls[0] || ''
    });
    setItems(databaseBarangService.getAll());
    setPreviewDocItem(saved);
    setActivePhotoIndex(prev => Math.max(0, Math.min(prev, updatedUrls.length - 1)));
  };

  const handleClearAllPhotosFromPreview = (item: DatabaseBarangRecord) => {
    databaseBarangService.clearAllPhotos(item.noBarang);
    const saved = databaseBarangService.upsertItem({
      ...item,
      dokumentasiUrls: [],
      dokumentasiUrl: ''
    });
    setItems(databaseBarangService.getAll());
    setPreviewDocItem(saved);
    setActivePhotoIndex(0);
  };

  const handleSetPrimaryPhotoInPreview = (item: DatabaseBarangRecord, photoIdx: number) => {
    const existingUrls = Array.isArray(item.dokumentasiUrls) && item.dokumentasiUrls.length > 0
      ? item.dokumentasiUrls.filter(u => u && !u.startsWith('data:image/svg+xml'))
      : (item.dokumentasiUrl && !item.dokumentasiUrl.startsWith('data:image/svg+xml') ? [item.dokumentasiUrl] : []);
    if (photoIdx <= 0 || photoIdx >= existingUrls.length) return;
    const chosen = existingUrls[photoIdx];
    const reordered = [chosen, ...existingUrls.filter((_, idx) => idx !== photoIdx)];
    const saved = databaseBarangService.upsertItem({
      ...item,
      dokumentasiUrls: reordered,
      dokumentasiUrl: reordered[0] || ''
    });
    setItems(databaseBarangService.getAll());
    setPreviewDocItem(saved);
    setActivePhotoIndex(0);
  };

  const startCropPointerDrag = (
    e: React.PointerEvent,
    mode: 'move' | 'nw' | 'ne' | 'sw' | 'se' | 'n' | 's' | 'e' | 'w' | 'create'
  ) => {
    e.stopPropagation();
    e.preventDefault();
    const container = cropContainerRef.current;
    if (!container) return;
    try {
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    } catch {}

    if (mode === 'create') {
      const bounds = container.getBoundingClientRect();
      if (bounds.width <= 0 || bounds.height <= 0) return;
      const relX = Math.max(0, Math.min(92, ((e.clientX - bounds.left) / bounds.width) * 100));
      const relY = Math.max(0, Math.min(92, ((e.clientY - bounds.top) / bounds.height) * 100));
      const initialRect = { x: relX, y: relY, w: 8, h: 8 };
      setCropRect(initialRect);
      cropDragRef.current = {
        active: true,
        mode: 'se',
        startClientX: e.clientX,
        startClientY: e.clientY,
        startRect: initialRect
      };
      return;
    }

    cropDragRef.current = {
      active: true,
      mode,
      startClientX: e.clientX,
      startClientY: e.clientY,
      startRect: { ...cropRect }
    };
  };

  const moveCropPointerDrag = (e: React.PointerEvent) => {
    if (!cropDragRef.current.active) return;
    const container = cropContainerRef.current;
    if (!container) return;
    const bounds = container.getBoundingClientRect();
    if (bounds.width <= 0 || bounds.height <= 0) return;

    const dxPct = ((e.clientX - cropDragRef.current.startClientX) / bounds.width) * 100;
    const dyPct = ((e.clientY - cropDragRef.current.startClientY) / bounds.height) * 100;
    const s = cropDragRef.current.startRect;
    const mode = cropDragRef.current.mode;
    const MIN_SIZE = 8;

    let nx = s.x;
    let ny = s.y;
    let nw = s.w;
    let nh = s.h;

    if (mode === 'move') {
      nx = Math.max(0, Math.min(100 - s.w, s.x + dxPct));
      ny = Math.max(0, Math.min(100 - s.h, s.y + dyPct));
    } else {
      if (mode.includes('e')) {
        nw = Math.max(MIN_SIZE, Math.min(100 - s.x, s.w + dxPct));
      }
      if (mode.includes('s')) {
        nh = Math.max(MIN_SIZE, Math.min(100 - s.y, s.h + dyPct));
      }
      if (mode.includes('w')) {
        const maxShiftX = s.w - MIN_SIZE;
        const clampedDx = Math.max(-s.x, Math.min(maxShiftX, dxPct));
        nx = s.x + clampedDx;
        nw = s.w - clampedDx;
      }
      if (mode.includes('n')) {
        const maxShiftY = s.h - MIN_SIZE;
        const clampedDy = Math.max(-s.y, Math.min(maxShiftY, dyPct));
        ny = s.y + clampedDy;
        nh = s.h - clampedDy;
      }
    }

    setCropRect({
      x: Number(nx.toFixed(2)),
      y: Number(ny.toFixed(2)),
      w: Number(nw.toFixed(2)),
      h: Number(nh.toFixed(2))
    });
  };

  const endCropPointerDrag = () => {
    cropDragRef.current.active = false;
  };

  const handleApplyCropInPreview = async (
    item: DatabaseBarangRecord,
    photoIdx: number,
    saveAsNewPhoto: boolean
  ) => {
    const existingUrls = Array.isArray(item.dokumentasiUrls) && item.dokumentasiUrls.length > 0
      ? item.dokumentasiUrls.filter(u => u && !u.startsWith('data:image/svg+xml'))
      : (item.dokumentasiUrl && !item.dokumentasiUrl.startsWith('data:image/svg+xml') ? [item.dokumentasiUrl] : []);
    const targetUrl = existingUrls[photoIdx];
    if (!targetUrl) return;

    setIsApplyingCrop(true);
    try {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = err => reject(err);
        img.src = targetUrl;
      });

      const natW = img.naturalWidth || img.width || 800;
      const natH = img.naturalHeight || img.height || 800;
      const sx = Math.max(0, Math.round((cropRect.x / 100) * natW));
      const sy = Math.max(0, Math.round((cropRect.y / 100) * natH));
      const sw = Math.max(24, Math.min(natW - sx, Math.round((cropRect.w / 100) * natW)));
      const sh = Math.max(24, Math.min(natH - sy, Math.round((cropRect.h / 100) * natH)));

      const canvas = document.createElement('canvas');
      canvas.width = sw;
      canvas.height = sh;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Canvas context tidak tersedia');

      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      if (cropShape === 'circle') {
        ctx.beginPath();
        ctx.ellipse(sw / 2, sh / 2, sw / 2, sh / 2, 0, 0, 2 * Math.PI);
        ctx.clip();
      }
      ctx.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);

      const croppedDataUrl = canvas.toDataURL('image/jpeg', 0.92);
      const updatedUrls = [...existingUrls];
      let nextPhotoIdx = photoIdx;
      if (saveAsNewPhoto) {
        updatedUrls.push(croppedDataUrl);
        nextPhotoIdx = updatedUrls.length - 1;
      } else {
        updatedUrls[photoIdx] = croppedDataUrl;
      }

      const saved = databaseBarangService.upsertItem({
        ...item,
        dokumentasiUrls: updatedUrls,
        dokumentasiUrl: updatedUrls[0] || ''
      });
      setItems(databaseBarangService.getAll());
      setPreviewDocItem(saved);
      setActivePhotoIndex(nextPhotoIdx);
      setIsCropMode(false);
      setPreviewZoom(1);
      setPreviewPan({ x: 0, y: 0 });
    } catch (err) {
      console.error('Gagal memotong (crop) foto:', err);
    } finally {
      setIsApplyingCrop(false);
    }
  };

  const handleRotatePhotoInPreview = async (item: DatabaseBarangRecord, photoIdx: number) => {
    const existingUrls = Array.isArray(item.dokumentasiUrls) && item.dokumentasiUrls.length > 0
      ? item.dokumentasiUrls.filter(u => u && !u.startsWith('data:image/svg+xml'))
      : (item.dokumentasiUrl && !item.dokumentasiUrl.startsWith('data:image/svg+xml') ? [item.dokumentasiUrl] : []);
    const targetUrl = existingUrls[photoIdx];
    if (!targetUrl) return;

    setIsApplyingCrop(true);
    try {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = err => reject(err);
        img.src = targetUrl;
      });

      const natW = img.naturalWidth || img.width || 800;
      const natH = img.naturalHeight || img.height || 800;
      const canvas = document.createElement('canvas');
      canvas.width = natH;
      canvas.height = natW;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Canvas context tidak tersedia');

      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.translate(canvas.width / 2, canvas.height / 2);
      ctx.rotate(Math.PI / 2);
      ctx.drawImage(img, -natW / 2, -natH / 2, natW, natH);

      const rotatedDataUrl = canvas.toDataURL('image/jpeg', 0.92);
      const updatedUrls = [...existingUrls];
      updatedUrls[photoIdx] = rotatedDataUrl;

      const saved = databaseBarangService.upsertItem({
        ...item,
        dokumentasiUrls: updatedUrls,
        dokumentasiUrl: updatedUrls[0] || ''
      });
      setItems(databaseBarangService.getAll());
      setPreviewDocItem(saved);
      setPreviewZoom(1);
      setPreviewPan({ x: 0, y: 0 });
    } catch (err) {
      console.error('Gagal memutar foto:', err);
    } finally {
      setIsApplyingCrop(false);
    }
  };

  const handleRowCameraUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const targetItem = activeCameraRowItem || cameraTargetItem || previewDocItem;
    if (files.length === 0 || !targetItem) return;
    try {
      const results = await Promise.all(
        files.map(f =>
          compressDocumentationPhoto(f, {
            maxDimension: 1600,
            initialQuality: 0.92
          })
        )
      );
      const newUrls = results.map(r => r.dataUrl);
      const freshRecord = databaseBarangService.getAll().find(i => i.id === targetItem.id) || targetItem;
      const existingUrls = Array.isArray(freshRecord.dokumentasiUrls)
        ? freshRecord.dokumentasiUrls.filter(u => u && !u.startsWith('data:image/svg+xml'))
        : (freshRecord.dokumentasiUrl && !freshRecord.dokumentasiUrl.startsWith('data:image/svg+xml') ? [freshRecord.dokumentasiUrl] : []);
      const updatedUrls = [...existingUrls, ...newUrls];

      const saved = databaseBarangService.upsertItem({
        ...freshRecord,
        dokumentasiUrls: updatedUrls,
        dokumentasiUrl: updatedUrls[0]
      });
      setItems(databaseBarangService.getAll());
      if (previewDocItem && previewDocItem.id === saved.id) {
        setPreviewDocItem(saved);
        setActivePhotoIndex(updatedUrls.length - 1);
      }
      if (cameraTargetItem && cameraTargetItem.id === saved.id) {
        setCameraTargetItem(saved);
      }
      const persistedToMysql = await databaseBarangService.waitForItemUpload(saved.noBarang);
      setFeedbackModal({
        title: persistedToMysql ? `${newUrls.length} Foto Berhasil Masuk Database Pusat` : 'Foto Baru Hanya Tersimpan di Browser',
        message: persistedToMysql
          ? `Total ${updatedUrls.length} foto untuk ${saved.noBarang} telah diterima database pusat.`
          : `Foto ${saved.noBarang} masih tersimpan di browser ini, tetapi belum masuk database pusat. Gunakan tombol Load Foto ke DB dari perangkat ini.`
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
      if (Array.isArray(loaded)) {
        setItems(loaded);
      }
    });

    const sync = () => {
      setItems(databaseBarangService.getAll());
    };
    const handleSyncStatus = (e: Event) => {
      const custom = e as CustomEvent<DatabaseBarangSyncStatus>;
      if (custom.detail) {
        setSyncStatus({ ...custom.detail });
      } else {
        setSyncStatus(databaseBarangService.getSyncStatus());
      }
    };
    window.addEventListener('akk-database-barang-updated', sync);
    window.addEventListener('akk-database-barang-sync-status', handleSyncStatus);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener('akk-database-barang-updated', sync);
      window.removeEventListener('akk-database-barang-sync-status', handleSyncStatus);
      window.removeEventListener('storage', sync);
    };
  }, []);

  const handleManualServerSync = async () => {
    let result: { count: number; items: DatabaseBarangRecord[] };
    try {
      result = await databaseBarangService.forceSyncNow();
    } catch (err: any) {
      setFeedbackModal({ title: 'Sinkronisasi Gagal', message: err?.message || 'Gagal menghubungi server database.' });
      return;
    }
    const syncError = databaseBarangService.getSyncStatus().error;
    setItems(result.items);
    if (onSyncWithMasterSku && result.items.length > 0) {
      onSyncWithMasterSku(result.items);
    }
    const photoCountNow = result.items.filter(
      it =>
        (Array.isArray(it.dokumentasiUrls) && it.dokumentasiUrls.some(u => u && !u.startsWith('data:image/svg+xml'))) ||
        (it.dokumentasiUrl && !it.dokumentasiUrl.startsWith('data:image/svg+xml'))
    ).length;
    setFeedbackModal({
      title: syncError ? 'Sinkronisasi Belum Tuntas' : (result.count > 0 ? 'Sinkronisasi 2 Arah (PC ↔ HP) Berhasil' : 'Server Belum Memiliki Data Barang'),
      message:
        syncError ? `Server melaporkan masalah: ${syncError}. Data lokal belum dihapus. Gunakan tombol Pulihkan Foto Lokal ke DB dari perangkat asal.` : result.count > 0
          ? `Sebanyak ${result.count.toLocaleString('id-ID')} barang dan ${photoCountNow.toLocaleString('id-ID')} dokumentasi foto barang telah tersinkronisasi penuh dua arah antara server database, tampilan PC, dan tampilan HP.`
          : 'Saat ini belum ada data di server database. Buka halaman Database Barang di perangkat tempat Anda menginput data agar otomatis terunggah ke server.'
    });
  };

  const handleRecoverLocalPhotos = async () => {
    try {
      const result = await databaseBarangService.recoverLocalPhotosToMysql();
      setItems(databaseBarangService.getAll());
      if (result.localPhotoSkuCount === 0) {
        setFeedbackModal({
          title: 'Load Foto ke DB Selesai',
          message: `Total foto berhasil terupload: 0, gagal: 0.`
        });
        return;
      }
      setFeedbackModal({
        title: 'Load Foto ke DB Selesai',
        message: `Total foto berhasil terupload: ${result.succeededSkuCount}, gagal: ${result.failedSkuCount}.`
      });
    } catch (err: any) {
      setFeedbackModal({
        title: 'Gagal Menghubungkan Foto ke Server Database',
        message: `${err?.message || 'Server belum tersedia'}. Foto asli di browser tetap aman. Pastikan patch sudah dideploy ke aplikasi yang aktif.`
      });
    }
  };

  const confirmDeletePhoto = () => {
    if (!photoToDelete) return;
    const { item, photoIdx, isAll } = photoToDelete;
    if (isAll) {
      handleClearAllPhotosFromPreview(item);
    } else {
      handleDeletePhotoFromPreview(item, photoIdx);
    }
    setPhotoToDelete(null);
    setFeedbackModal({
      title: 'Foto Berhasil Dihapus',
      message: `Foto barang ${item.noBarang} (${item.deskripsiBarang || item.keteranganBarang}) telah terhapus.`
    });
  };

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
    const result = items.filter(item => {
      const matchSearch = databaseBarangService.matchesSearchQuery(item, searchQuery);

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
            maxDimension: 1600,
            initialQuality: 0.92
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

  const handleSaveItemForm = async (e: React.FormEvent) => {
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
    const persistedToMysql = await databaseBarangService.waitForItemUpload(saved.noBarang);
    setIsFormModalOpen(false);
    setFeedbackModal({
      title: persistedToMysql ? (editingItem ? 'Database Barang Diperbarui' : 'Barang Baru Ditambahkan') : 'Data Tersimpan Lokal, Server Belum Terhubung',
      message: persistedToMysql
        ? `Data "${saved.deskripsiBarang}" (${saved.noBarang}) telah masuk database pusat dengan ${dokumentasiUrls.length} foto dokumentasi.`
        : `Data dan foto ${saved.noBarang} tersimpan di browser ini tetapi belum terverifikasi di database pusat. Coba tombol Load Foto ke DB.`
    });
  };

  const handleDeleteItem = (item: DatabaseBarangRecord) => {
    setItemToDelete(item);
  };

  const confirmDeleteItem = () => {
    if (!itemToDelete) return;
    const target = itemToDelete;
    databaseBarangService.deleteItem(target.id);
    const all = databaseBarangService.getAll();
    setItems(all);
    if (onSyncWithMasterSku) onSyncWithMasterSku(all);
    setItemToDelete(null);
    setFeedbackModal({
      title: 'Barang Berhasil Dihapus',
      message: `Data barang "${target.deskripsiBarang || target.keteranganBarang}" (${target.noBarang}) telah dihapus secara permanen dari Database Barang.`,
      variant: 'danger',
      badge: target.noBarang
    });
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

  const exportFilteredItems = useMemo(() => {
    const result = items.filter(item => {
      const matchSearch = databaseBarangService.matchesSearchQuery(item, searchQuery);

      const matchUnit =
        exportUnitFilter === 'ALL' ||
        (item.unit1 || '').toLowerCase() === exportUnitFilter.toLowerCase() ||
        (item.unit2 || '').toLowerCase() === exportUnitFilter.toLowerCase();

      const itemVol =
        Number(item.volM3) ||
        (item.panjangCm > 0 && item.lebarCm > 0 && item.tinggiCm > 0
          ? calculateVolM3(item.panjangCm, item.lebarCm, item.tinggiCm)
          : 0);
      const matchVol =
        exportVolFilter === 'ALL' ||
        (exportVolFilter === 'has_vol' && itemVol > 0) ||
        (exportVolFilter === 'no_vol' && itemVol === 0);

      const itemBerat = Number(item.beratKg) || 0;
      const matchBerat =
        exportBeratFilter === 'ALL' ||
        (exportBeratFilter === 'has_berat' && itemBerat > 0) ||
        (exportBeratFilter === 'no_berat' && itemBerat === 0);

      const hasCustomPhoto = Boolean(
        (item.dokumentasiUrls && item.dokumentasiUrls.some(u => u && !u.startsWith('data:image/svg+xml'))) ||
          (item.dokumentasiUrl && !item.dokumentasiUrl.startsWith('data:image/svg+xml') && item.dokumentasiUrl.trim() !== '')
      );
      const matchFoto =
        exportFotoFilter === 'ALL' ||
        (exportFotoFilter === 'has_photo' && hasCustomPhoto) ||
        (exportFotoFilter === 'no_photo' && !hasCustomPhoto);

      return matchSearch && matchUnit && matchVol && matchBerat && matchFoto;
    });

    if (sortBy === 'nama_asc') {
      result.sort((a, b) =>
        (a.deskripsiBarang || a.keteranganBarang || '').localeCompare(
          b.deskripsiBarang || b.keteranganBarang || '',
          'id',
          { numeric: true }
        )
      );
    } else if (sortBy === 'nama_desc') {
      result.sort((a, b) =>
        (b.deskripsiBarang || b.keteranganBarang || '').localeCompare(
          a.deskripsiBarang || a.keteranganBarang || '',
          'id',
          { numeric: true }
        )
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
  }, [items, searchQuery, exportUnitFilter, exportVolFilter, exportBeratFilter, exportFotoFilter, sortBy]);

  const openExportExcelModal = () => {
    setExportUnitFilter(unitFilter);
    setExportVolFilter(volFilter);
    setExportBeratFilter(beratFilter);
    setExportFotoFilter(fotoFilter);
    setIsExportModalOpen(true);
  };

  const handleExportDatabaseBarang = (targetItems: DatabaseBarangRecord[] = exportFilteredItems) => {
    const rows = targetItems.map((item, idx) => {
      const itemVol =
        Number(item.volM3) ||
        (item.panjangCm > 0 && item.lebarCm > 0 && item.tinggiCm > 0
          ? calculateVolM3(item.panjangCm, item.lebarCm, item.tinggiCm)
          : 0);
      const itemBerat = Number(item.beratKg) || 0;
      const photoList =
        Array.isArray(item.dokumentasiUrls) && item.dokumentasiUrls.length > 0
          ? item.dokumentasiUrls.filter(u => u && !u.startsWith('data:image/svg+xml'))
          : item.dokumentasiUrl && !item.dokumentasiUrl.startsWith('data:image/svg+xml') && item.dokumentasiUrl.trim() !== ''
          ? [item.dokumentasiUrl]
          : [];
      const hasPhoto = photoList.length > 0;
      const satuanUtama = item.unit1 || item.satuan || 'Pcs';

      return {
        No: idx + 1,
        'No. Barang': item.noBarang,
        'Deskripsi Barang': item.deskripsiBarang || item.keteranganBarang,
        Satuan: satuanUtama,
        'Unit 1': satuanUtama,
        'Unit 2': item.unit2 || '',
        'Unit 3': item.unit3 || '',
        'Rasio 2': item.rasio2 ?? 0,
        'Rasio 3': item.rasio3 ?? 0,
        'Panjang(L)cm': item.panjangCm || 0,
        'Lebar(W)cm': item.lebarCm || 0,
        'Tinggi(H)cm': item.tinggiCm || 0,
        'VOL(M3)': itemVol,
        'Status Kubikasi': itemVol > 0 ? 'Memiliki Kubikasi' : 'Tanpa Kubikasi',
        'Berat(kg)': itemBerat,
        'Status Berat': itemBerat > 0 ? 'Memiliki Berat' : 'Tanpa Berat',
        Foto: hasPhoto ? `Sudah Ada Foto (${photoList.length} Foto)` : 'Belum Ada Foto',
        'Terakhir Diperbarui': item.updatedAt
      };
    });

    const ws = XLSX.utils.json_to_sheet(rows);
    if (ws['!ref']) {
      ws['!autofilter'] = { ref: ws['!ref'] };
    }
    ws['!cols'] = [
      { wch: 6 },  // No
      { wch: 15 }, // No. Barang
      { wch: 42 }, // Deskripsi Barang
      { wch: 10 }, // Satuan
      { wch: 10 }, // Unit 1
      { wch: 10 }, // Unit 2
      { wch: 10 }, // Unit 3
      { wch: 10 }, // Rasio 2
      { wch: 10 }, // Rasio 3
      { wch: 14 }, // Panjang(L)cm
      { wch: 14 }, // Lebar(W)cm
      { wch: 14 }, // Tinggi(H)cm
      { wch: 12 }, // VOL(M3)
      { wch: 18 }, // Status Kubikasi
      { wch: 12 }, // Berat(kg)
      { wch: 16 }, // Status Berat
      { wch: 24 }, // Foto
      { wch: 18 }  // Terakhir Diperbarui
    ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Database Barang');
    XLSX.writeFile(wb, `Database_Barang_AKK_${new Date().toISOString().split('T')[0]}.xlsx`);
    setIsExportModalOpen(false);
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
              if (rawStr && rawStr !== '-') u1 = rawStr;
            } else if (k === 'unit2') {
              u2 = rawStr === '-' || rawStr === '0' ? '' : rawStr;
            } else if (k === 'unit3') {
              u3 = rawStr === '-' || rawStr === '0' ? '' : rawStr;
            } else if (k === 'rasio2') {
              r2 = rawStr === '' || rawStr === '-' || rawStr === '0' ? 0 : (!isNaN(Number(val)) ? Number(val) : rawStr);
            } else if (k === 'rasio3') {
              r3 = rawStr === '' || rawStr === '-' || rawStr === '0' ? 0 : (!isNaN(Number(val)) ? Number(val) : rawStr);
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
      {/* Hidden Mobile Camera & Multi-Gallery Input Triggers for Direct Row & Modal Capture */}
      <input
        ref={nativeCameraInputRef}
        type="file"
        multiple
        accept="image/*"
        capture="environment"
        onChange={handleModalPhotoUpload}
        className="hidden"
      />
      <input
        ref={rowNativeCameraInputRef}
        type="file"
        multiple
        accept="image/*"
        capture="environment"
        onChange={handleRowCameraUpload}
        className="hidden"
      />
      <input
        ref={rowGalleryInputRef}
        type="file"
        multiple
        accept="image/*"
        onChange={handleRowCameraUpload}
        className="hidden"
      />

      {/* Top Header Banner */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div className="space-y-1">
          <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-white tracking-tight">
            Database Barang Gudang
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Kelola master data barang gudang beserta spesifikasi dimensi, kubikasi, dan satuan konversi.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={handleRecoverLocalPhotos}
            disabled={syncStatus.isSyncing}
            className="px-3.5 py-2 rounded-xl border border-amber-200 dark:border-amber-700/60 bg-amber-50 dark:bg-amber-950/40 hover:bg-amber-100 dark:hover:bg-amber-900/50 text-amber-800 dark:text-amber-300 text-xs font-bold transition cursor-pointer disabled:opacity-60 flex items-center gap-1.5"
            title="Kirim seluruh foto dari browser ini ke server database dengan cepat"
          >
            {syncStatus.isSyncing && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
            <span>{syncStatus.isSyncing ? `Memuat (${syncStatus.progressPct}%)...` : 'Load Foto ke DB'}</span>
          </button>
          <button
            type="button"
            onClick={openExportExcelModal}
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
            <span>Tambah Barang</span>
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
              Total Kubikasi Master Barang
            </span>
            <Layers className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-xl font-black text-amber-600 dark:text-amber-400 font-mono">
            {cubicationMetrics.totalKubikasiM3.toLocaleString('id-ID', { maximumFractionDigits: 2 })} m&sup3;
          </div>
          <p className="text-[11px] text-slate-500 mt-1">
            Akumulasi volume seluruh item database
          </p>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-2xl shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Rata-Rata Berat / Unit
            </span>
            <Scale className="w-4 h-4 text-blue-500" />
          </div>
          <div className="text-xl font-black text-blue-600 dark:text-blue-400 font-mono">
            {cubicationMetrics.avgBeratUnit.toFixed(2)} Kg
          </div>
          <p className="text-[11px] text-slate-500 mt-1">
            Berat rata-rata ({cubicationMetrics.countWithBerat.toLocaleString('id-ID')} SKU memiliki data berat)
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
                {tableMode === 'compact' ? 'Ringkas (Responsif)' : 'Semua Kolom Spreadsheet'}
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

        {/* Tabel Mode Ringkas (Fit on screen, ZERO horizontal scrolling di HP maupun PC) */}
        {tableMode === 'compact' ? (
          <div>
            {/* Tampilan Mobile HP (Zero Horizontal Scroll Card List, tampil otomatis di layar HP < md) */}
            <div className="md:hidden divide-y divide-slate-200 dark:divide-slate-800">
              {paginatedItems.length > 0 ? (
                paginatedItems.map((item, idx) => {
                  const rowNum = (currentPage - 1) * pageSize + idx + 1;
                  const hasDim = item.panjangCm > 0 || item.lebarCm > 0 || item.tinggiCm > 0;
                  const calculatedVol =
                    item.volM3 > 0
                      ? item.volM3
                      : hasDim
                      ? calculateVolM3(item.panjangCm, item.lebarCm, item.tinggiCm)
                      : 0;
                  const photoList =
                    Array.isArray(item.dokumentasiUrls) && item.dokumentasiUrls.length > 0
                      ? item.dokumentasiUrls.filter(u => u && !u.startsWith('data:image/svg+xml'))
                      : item.dokumentasiUrl && !item.dokumentasiUrl.startsWith('data:image/svg+xml')
                      ? [item.dokumentasiUrl]
                      : [];
                  const hasCustomPhoto = photoList.length > 0;

                  return (
                    <div
                      key={item.id}
                      className="p-3.5 hover:bg-blue-50/40 dark:hover:bg-slate-800/40 transition space-y-2"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-1.5 flex-wrap min-w-0">
                          <span className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 font-mono font-bold text-[10px] text-slate-500">
                            #{rowNum}
                          </span>
                          <span className="font-mono font-black text-blue-700 dark:text-blue-400 text-xs">
                            {item.noBarang}
                          </span>
                        </div>

                        <div className="inline-flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={() => triggerCameraForRow(item)}
                            className="p-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
                            title="Ambil Foto Kamera HP"
                          >
                            <Camera className="w-3.5 h-3.5" />
                          </button>
                          {hasCustomPhoto && (
                            <>
                              <button
                                type="button"
                                onClick={() => {
                                  setPreviewDocItem(item);
                                  setActivePhotoIndex(0);
                                }}
                                className="relative p-1.5 rounded-lg bg-blue-50 dark:bg-blue-500/15 text-blue-700 dark:text-blue-300 border border-blue-200/80 dark:border-blue-800/70"
                                title={`Lihat ${photoList.length} Foto Dokumentasi`}
                              >
                                <Eye className="w-3.5 h-3.5" />
                                {photoList.length > 1 && (
                                  <span className="absolute -top-1.5 -right-1.5 min-w-4 h-4 px-1 rounded-full bg-indigo-600 text-white text-[9px] font-black flex items-center justify-center shadow-2xs">
                                    {photoList.length}
                                  </span>
                                )}
                              </button>
                            </>
                          )}
                          <button
                            type="button"
                            onClick={() => openEditModal(item)}
                            className="p-1.5 rounded-lg bg-blue-50 dark:bg-blue-500/15 text-blue-700 dark:text-blue-300"
                            title="Edit Barang"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteItem(item)}
                            className="p-1.5 rounded-lg bg-rose-500/10 text-rose-600 dark:text-rose-400"
                            title="Hapus Barang"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      <div className="text-xs font-bold text-slate-900 dark:text-white leading-snug break-words">
                        {item.deskripsiBarang || item.keteranganBarang}
                      </div>

                      <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-[11px]">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-bold text-[10px] text-slate-900 dark:text-white">
                            {item.unit1 || item.satuan || 'Pcs'}
                          </span>
                          {item.unit2 && (
                            <span className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">
                              1 {item.unit2} {item.rasio2 ? `= ${item.rasio2} ${item.unit1 || 'Pcs'}` : ''}
                            </span>
                          )}
                          {item.unit3 && (
                            <span className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">
                              • 1 {item.unit3} {item.rasio3 ? `= ${item.rasio3} ${item.unit1 || 'Pcs'}` : ''}
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-2 font-mono">
                          {(hasDim || calculatedVol > 0) && (
                            <span className="text-[10px] text-slate-600 dark:text-slate-300">
                              {item.panjangCm || 0}&times;{item.lebarCm || 0}&times;{item.tinggiCm || 0}cm
                            </span>
                          )}
                          {calculatedVol > 0 && (
                            <span className="px-2 py-0.5 rounded-md bg-blue-100 dark:bg-blue-900/70 border border-blue-400 dark:border-blue-700 text-blue-900 dark:text-blue-100 font-black text-[11px]">
                              {calculatedVol} M3
                            </span>
                          )}
                          {item.beratKg > 0 && (
                            <span className="font-bold text-slate-800 dark:text-slate-200 text-[11px]">
                              {item.beratKg} kg
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="py-10 px-4 text-center space-y-3">
                  <p className="text-slate-500 dark:text-slate-400 text-xs font-semibold">
                    {items.length === 0
                      ? 'Database Barang sedang disinkronkan atau belum diunggah dari komputer (PC) ke server.'
                      : 'Tidak ada data barang yang sesuai filter pencarian.'}
                  </p>
                  {items.length === 0 && (
                    <button
                      type="button"
                      onClick={handleManualServerSync}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shadow-xs"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${syncStatus.isSyncing ? 'animate-spin' : ''}`} />
                      <span>Muat &amp; Sinkronkan Data dari Server</span>
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Tampilan Tabel Desktop PC (>= md) */}
            <div className="hidden md:block overflow-x-auto">
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
                        <span>Deskripsi Barang</span>
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
                                <>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setPreviewDocItem(item);
                                      setActivePhotoIndex(0);
                                    }}
                                    className="relative p-1 rounded-md bg-blue-50 dark:bg-blue-500/15 hover:bg-blue-100 dark:hover:bg-blue-500/25 text-blue-700 dark:text-blue-300 transition cursor-pointer"
                                    title={`Lihat ${photoList.length} Foto Dokumentasi`}
                                  >
                                    <Eye className="w-3.5 h-3.5" />
                                    {photoList.length > 1 && (
                                      <span className="absolute -top-1.5 -right-1.5 min-w-4 h-4 px-1 rounded-full bg-indigo-600 text-white text-[9px] font-black flex items-center justify-center shadow-2xs">
                                        {photoList.length}
                                      </span>
                                    )}
                                  </button>
                                </>
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
                            {((Array.isArray(item.dokumentasiUrls) && item.dokumentasiUrls.length > 0) || item.dokumentasiUrl) && (() => {
                              const pList = Array.isArray(item.dokumentasiUrls) && item.dokumentasiUrls.length > 0
                                ? item.dokumentasiUrls.filter(u => u && !u.startsWith('data:image/svg+xml'))
                                : (item.dokumentasiUrl && !item.dokumentasiUrl.startsWith('data:image/svg+xml') ? [item.dokumentasiUrl] : []);
                              if (pList.length === 0) return null;
                              return (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setPreviewDocItem(item);
                                    setActivePhotoIndex(0);
                                  }}
                                  className="relative p-1.5 rounded-lg bg-blue-50 dark:bg-blue-500/15 hover:bg-blue-100 text-blue-700 dark:text-blue-300 transition cursor-pointer"
                                  title={`Lihat ${pList.length} Foto Dokumentasi`}
                                >
                                  <Eye className="w-3.5 h-3.5" />
                                  {pList.length > 1 && (
                                    <span className="absolute -top-1.5 -right-1.5 min-w-4 h-4 px-1 rounded-full bg-indigo-600 text-white text-[9px] font-black flex items-center justify-center shadow-2xs">
                                      {pList.length}
                                    </span>
                                  )}
                                </button>
                              );
                            })()}
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

      {/* Lightbox Modal Preview Dokumentasi Modern (Mendukung Zoom Interaktif, Multi-Foto, Galeri & Ambil Foto Langsung) */}
      {previewDocItem && (() => {
        const photos = Array.isArray(previewDocItem.dokumentasiUrls) && previewDocItem.dokumentasiUrls.length > 0
          ? previewDocItem.dokumentasiUrls.filter(u => u && !u.startsWith('data:image/svg+xml'))
          : (previewDocItem.dokumentasiUrl && !previewDocItem.dokumentasiUrl.startsWith('data:image/svg+xml') ? [previewDocItem.dokumentasiUrl] : []);
        const totalPhotos = photos.length;
        const safeIndex = totalPhotos > 0 ? Math.min(activePhotoIndex, totalPhotos - 1) : 0;
        const currentPhotoUrl = photos[safeIndex] || databaseBarangService.getItemThumbnail(previewDocItem);
        const hasDim = previewDocItem.panjangCm > 0 || previewDocItem.lebarCm > 0 || previewDocItem.tinggiCm > 0;
        const calculatedVol = previewDocItem.volM3 > 0
          ? previewDocItem.volM3
          : (hasDim ? calculateVolM3(previewDocItem.panjangCm, previewDocItem.lebarCm, previewDocItem.tinggiCm) : 0);

        const handleZoomIn = () => {
          setPreviewZoom(prev => Math.min(4, Number((prev + 0.5).toFixed(2))));
        };
        const handleZoomOut = () => {
          setPreviewZoom(prev => {
            const next = Math.max(1, Number((prev - 0.5).toFixed(2)));
            if (next === 1) setPreviewPan({ x: 0, y: 0 });
            return next;
          });
        };
        const handleResetZoom = () => {
          setPreviewZoom(1);
          setPreviewPan({ x: 0, y: 0 });
        };

        return (
          <div
            className="fixed inset-0 z-[1300] bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-5"
            style={{ zIndex: 1300 }}
            onClick={() => {
              setPreviewDocItem(null);
              setActivePhotoIndex(0);
              setIsCropMode(false);
              handleResetZoom();
            }}
          >
            <div
              className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-3xl max-w-2xl w-full overflow-hidden shadow-2xl flex flex-col max-h-[92vh]"
              onClick={e => e.stopPropagation()}
            >
              {/* Modern Header */}
              <div className="px-5 py-4 bg-gradient-to-r from-slate-50 via-white to-blue-50/40 dark:from-slate-950 dark:via-slate-900 dark:to-indigo-950/30 border-b border-slate-200/80 dark:border-slate-800 flex items-start justify-between gap-3">
                <div className="min-w-0 space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="px-2.5 py-0.5 rounded-lg bg-blue-600 text-white font-mono text-xs font-black tracking-wide shadow-2xs">
                      {previewDocItem.noBarang}
                    </span>
                    <span className="px-2.5 py-0.5 rounded-full text-[11px] font-extrabold bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 border border-indigo-500/30 flex items-center gap-1">
                      <Camera className="w-3 h-3" />
                      <span>
                        {totalPhotos > 0 ? `Foto ${safeIndex + 1} dari ${totalPhotos}` : 'Belum Ada Foto'}
                      </span>
                    </span>
                    {safeIndex === 0 && totalPhotos > 0 && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30">
                        ★ Foto Utama
                      </span>
                    )}
                  </div>
                  <h4 className="text-sm sm:text-base font-black text-slate-900 dark:text-white leading-snug break-words">
                    {previewDocItem.deskripsiBarang || previewDocItem.keteranganBarang}
                  </h4>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => triggerCameraForRow(previewDocItem)}
                    className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-xs transition cursor-pointer"
                    title="Ambil foto menggunakan kamera"
                  >
                    <Camera className="w-3.5 h-3.5" />
                    <span>Ambil Foto</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => triggerGalleryUploadForRow(previewDocItem)}
                    className="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-xs transition cursor-pointer"
                    title="Upload foto dari galeri"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    <span>Galeri</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setPreviewDocItem(null);
                      setActivePhotoIndex(0);
                      setIsCropMode(false);
                      handleResetZoom();
                    }}
                    className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-slate-900 dark:hover:text-white transition cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Main Photo Stage with Interactive Zoom, Pan & Crop */}
              <div className="p-4 sm:p-5 space-y-3 overflow-y-auto">
                <div
                  className={`relative rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800 bg-slate-950 flex items-center justify-center aspect-16/10 shadow-inner group select-none ${
                    isCropMode
                      ? 'cursor-crosshair'
                      : previewZoom > 1
                      ? isDraggingPan
                        ? 'cursor-grabbing'
                        : 'cursor-grab'
                      : 'cursor-zoom-in'
                  }`}
                  onWheel={e => {
                    if (isCropMode) return;
                    e.preventDefault();
                    if (e.deltaY < 0) {
                      handleZoomIn();
                    } else {
                      handleZoomOut();
                    }
                  }}
                  onMouseDown={e => {
                    if (isCropMode || previewZoom <= 1) return;
                    setIsDraggingPan(true);
                    panDragStartRef.current = {
                      x: e.clientX,
                      y: e.clientY,
                      panX: previewPan.x,
                      panY: previewPan.y
                    };
                  }}
                  onMouseMove={e => {
                    if (isCropMode || !isDraggingPan || previewZoom <= 1) return;
                    const dx = e.clientX - panDragStartRef.current.x;
                    const dy = e.clientY - panDragStartRef.current.y;
                    setPreviewPan({
                      x: Math.max(-320, Math.min(320, panDragStartRef.current.panX + dx)),
                      y: Math.max(-240, Math.min(240, panDragStartRef.current.panY + dy))
                    });
                  }}
                  onMouseUp={() => setIsDraggingPan(false)}
                  onMouseLeave={() => setIsDraggingPan(false)}
                  onDoubleClick={() => {
                    if (isCropMode) return;
                    if (previewZoom > 1) {
                      handleResetZoom();
                    } else {
                      setPreviewZoom(2);
                    }
                  }}
                >
                  {isCropMode ? (
                    <div
                      ref={cropContainerRef}
                      onPointerDown={e => startCropPointerDrag(e, 'create')}
                      onPointerMove={moveCropPointerDrag}
                      onPointerUp={endCropPointerDrag}
                      onPointerCancel={endCropPointerDrag}
                      className="relative inline-block max-w-full max-h-full select-none touch-none"
                    >
                      <img
                        src={currentPhotoUrl}
                        alt={previewDocItem.deskripsiBarang || previewDocItem.keteranganBarang}
                        draggable={false}
                        className="max-h-[42vh] sm:max-h-[46vh] max-w-full w-auto h-auto block select-none pointer-events-none"
                      />

                      {/* Darkened Mask Outside Crop Box */}
                      <div
                        style={{
                          left: `${cropRect.x}%`,
                          top: `${cropRect.y}%`,
                          width: `${cropRect.w}%`,
                          height: `${cropRect.h}%`,
                          boxShadow: '0 0 0 9999px rgba(2, 6, 23, 0.68)',
                          borderRadius: cropShape === 'circle' ? '9999px' : '0px'
                        }}
                        onPointerDown={e => startCropPointerDrag(e, 'move')}
                        className={`absolute border-2 border-amber-400 cursor-move z-20 ${cropShape === 'circle' ? 'rounded-full' : ''}`}
                      >
                        {/* Rule-of-Thirds Grid Lines */}
                        <div className="absolute inset-0 grid grid-cols-3 grid-rows-3 pointer-events-none">
                          <div className="border-r border-b border-white/35" />
                          <div className="border-r border-b border-white/35" />
                          <div className="border-b border-white/35" />
                          <div className="border-r border-b border-white/35" />
                          <div className="border-r border-b border-white/35" />
                          <div className="border-b border-white/35" />
                          <div className="border-r border-white/35" />
                          <div className="border-r border-white/35" />
                          <div />
                        </div>

                        {/* Dimension Badge inside Crop Box */}
                        <div className="absolute -top-6 left-0 px-2 py-0.5 rounded bg-amber-500 text-slate-950 text-[9px] font-black whitespace-nowrap shadow-md pointer-events-none">
                          Area Crop: {Math.round(cropRect.w)}% &times; {Math.round(cropRect.h)}% (Geser titik sudut)
                        </div>

                        {/* 4 Corner Resize Handles */}
                        <div
                          onPointerDown={e => startCropPointerDrag(e, 'nw')}
                          className="absolute -top-2 -left-2 w-4 h-4 rounded-full bg-amber-400 border-2 border-slate-950 cursor-nwse-resize shadow-md"
                        />
                        <div
                          onPointerDown={e => startCropPointerDrag(e, 'ne')}
                          className="absolute -top-2 -right-2 w-4 h-4 rounded-full bg-amber-400 border-2 border-slate-950 cursor-nesw-resize shadow-md"
                        />
                        <div
                          onPointerDown={e => startCropPointerDrag(e, 'sw')}
                          className="absolute -bottom-2 -left-2 w-4 h-4 rounded-full bg-amber-400 border-2 border-slate-950 cursor-nesw-resize shadow-md"
                        />
                        <div
                          onPointerDown={e => startCropPointerDrag(e, 'se')}
                          className="absolute -bottom-2 -right-2 w-4 h-4 rounded-full bg-amber-400 border-2 border-slate-950 cursor-nwse-resize shadow-md"
                        />

                        {/* 4 Edge Resize Handles */}
                        <div
                          onPointerDown={e => startCropPointerDrag(e, 'n')}
                          className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-6 h-3 rounded-full bg-amber-400 border border-slate-950 cursor-ns-resize shadow-sm"
                        />
                        <div
                          onPointerDown={e => startCropPointerDrag(e, 's')}
                          className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-6 h-3 rounded-full bg-amber-400 border border-slate-950 cursor-ns-resize shadow-sm"
                        />
                        <div
                          onPointerDown={e => startCropPointerDrag(e, 'w')}
                          className="absolute top-1/2 -left-1.5 -translate-y-1/2 w-3 h-6 rounded-full bg-amber-400 border border-slate-950 cursor-ew-resize shadow-sm"
                        />
                        <div
                          onPointerDown={e => startCropPointerDrag(e, 'e')}
                          className="absolute top-1/2 -right-1.5 -translate-y-1/2 w-3 h-6 rounded-full bg-amber-400 border border-slate-950 cursor-ew-resize shadow-sm"
                        />
                      </div>
                    </div>
                  ) : (
                    <img
                      src={currentPhotoUrl}
                      alt={previewDocItem.deskripsiBarang || previewDocItem.keteranganBarang}
                      draggable={false}
                      style={{
                        transform: `translate(${previewPan.x}px, ${previewPan.y}px) scale(${previewZoom})`,
                        transformOrigin: 'center center'
                      }}
                      className={`w-full h-full object-contain ${isDraggingPan ? '' : 'transition-transform duration-150'}`}
                    />
                  )}

                  {/* Top Floating Overlay Actions inside Photo Stage */}
                  {totalPhotos > 0 && (
                    <div className="absolute top-3 left-3 right-3 flex items-center justify-between gap-2 pointer-events-none z-30 flex-wrap">
                      <span className="px-2.5 py-1 rounded-full bg-slate-950/75 backdrop-blur-md border border-white/15 text-white text-[11px] font-bold">
                        {isCropMode
                          ? '✂️ Mode Crop Foto Aktif'
                          : totalPhotos > 1
                          ? `Galeri Multi-Foto (${safeIndex + 1}/${totalPhotos})`
                          : '1 Foto Tersimpan'}
                      </span>
                      <div className="flex items-center gap-1.5 pointer-events-auto flex-wrap justify-end">
                        {/* Interactive Zoom Control Bar */}
                        {!isCropMode && (
                          <div className="flex items-center gap-0.5 px-1.5 py-1 rounded-xl bg-slate-950/80 backdrop-blur-md border border-white/20 text-white shadow-md">
                            <button
                              type="button"
                              onClick={handleZoomOut}
                              disabled={previewZoom <= 1}
                              className="p-1 rounded-lg hover:bg-white/15 disabled:opacity-35 transition cursor-pointer"
                              title="Perkecil (Zoom Out)"
                            >
                              <ZoomOut className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={handleResetZoom}
                              className="px-1.5 py-0.5 rounded text-[10px] font-mono font-black text-sky-300 hover:bg-white/10 transition cursor-pointer"
                              title="Klik untuk Reset Zoom (100%)"
                            >
                              {Math.round(previewZoom * 100)}%
                            </button>
                            <button
                              type="button"
                              onClick={handleZoomIn}
                              disabled={previewZoom >= 4}
                              className="p-1 rounded-lg hover:bg-white/15 disabled:opacity-35 transition cursor-pointer"
                              title="Perbesar (Zoom In)"
                            >
                              <ZoomIn className="w-3.5 h-3.5" />
                            </button>
                            {previewZoom > 1 && (
                              <button
                                type="button"
                                onClick={handleResetZoom}
                                className="p-1 rounded-lg hover:bg-white/15 text-amber-300 transition cursor-pointer"
                                title="Reset Posisi & Zoom"
                              >
                                <RotateCcw className="w-3 h-3" />
                              </button>
                            )}
                          </div>
                        )}

                        {/* Tombol Crop Interaktif */}
                        <button
                          type="button"
                          onClick={() => {
                            handleResetZoom();
                            if (!isCropMode) {
                              setCropRect({ x: 0, y: 0, w: 100, h: 100 });
                              setCropShape('rect');
                              setCropAspectRatio('free');
                              setIsCropMode(true);
                            } else {
                              setIsCropMode(false);
                            }
                          }}
                          className={`px-2.5 py-1.5 rounded-xl text-[11px] font-black flex items-center gap-1 shadow-md backdrop-blur-md transition cursor-pointer ${
                            isCropMode
                              ? 'bg-amber-500 text-slate-950 ring-2 ring-amber-300'
                              : 'bg-amber-500/95 hover:bg-amber-400 text-slate-950'
                          }`}
                          title="Potong (Crop) bagian kardus/label pada foto ini"
                        >
                          <Crop className="w-3.5 h-3.5" />
                          <span>{isCropMode ? 'Tutup Crop' : 'Crop'}</span>
                        </button>

                        {/* Tombol Putar 90 Derajat */}
                        <button
                          type="button"
                          disabled={isApplyingCrop}
                          onClick={() => handleRotatePhotoInPreview(previewDocItem, safeIndex)}
                          className="px-2.5 py-1.5 rounded-xl bg-slate-900/90 hover:bg-slate-800 border border-white/20 text-white text-[11px] font-bold flex items-center gap-1 shadow-md backdrop-blur-md transition cursor-pointer disabled:opacity-50"
                          title="Putar foto 90° searah jarum jam (untuk foto kardus terbalik/miring)"
                        >
                          <RotateCw className="w-3.5 h-3.5 text-sky-400" />
                          <span>Putar</span>
                        </button>

                        {safeIndex > 0 && !isCropMode && (
                          <button
                            type="button"
                            onClick={() => handleSetPrimaryPhotoInPreview(previewDocItem, safeIndex)}
                            className="px-2.5 py-1.5 rounded-xl bg-indigo-600/90 hover:bg-indigo-500 text-white text-[10px] font-bold shadow-md backdrop-blur-xs transition cursor-pointer"
                            title="Jadikan sebagai Foto Utama"
                          >
                            ★ Set Utama
                          </button>
                        )}
                        {!isCropMode && (
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => {
                                setPhotoToDelete({
                                  item: previewDocItem,
                                  photoIdx: safeIndex,
                                  isAll: false,
                                  photoUrl: currentPhotoUrl
                                });
                              }}
                              className="px-2 py-1.5 rounded-xl bg-rose-600/90 hover:bg-rose-500 text-white shadow-md backdrop-blur-xs transition cursor-pointer flex items-center gap-1 text-[10px] font-bold"
                              title="Hapus foto ini secara permanen"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              <span>Hapus</span>
                            </button>
                            {totalPhotos > 1 && (
                              <button
                                type="button"
                                onClick={() => {
                                  setPhotoToDelete({
                                    item: previewDocItem,
                                    photoIdx: 0,
                                    isAll: true,
                                    photoUrl: currentPhotoUrl
                                  });
                                }}
                                className="px-2 py-1.5 rounded-xl bg-rose-800/90 hover:bg-rose-700 text-white shadow-md backdrop-blur-xs transition cursor-pointer text-[10px] font-bold"
                                title="Hapus semua foto untuk barang ini"
                              >
                                Hapus Semua ({totalPhotos})
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Left / Right Navigation Arrows for Multiple Photos */}
                  {totalPhotos > 1 && !isCropMode && (
                    <>
                      <button
                        type="button"
                        onClick={() => {
                          handleResetZoom();
                          setActivePhotoIndex(prev => (prev > 0 ? prev - 1 : totalPhotos - 1));
                        }}
                        className="absolute left-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-slate-950/75 hover:bg-blue-600 text-white border border-white/20 flex items-center justify-center shadow-lg transition cursor-pointer z-10"
                        title="Foto sebelumnya"
                      >
                        <ChevronLeft className="w-5 h-5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          handleResetZoom();
                          setActivePhotoIndex(prev => (prev < totalPhotos - 1 ? prev + 1 : 0));
                        }}
                        className="absolute right-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-slate-950/75 hover:bg-blue-600 text-white border border-white/20 flex items-center justify-center shadow-lg transition cursor-pointer z-10"
                        title="Foto berikutnya"
                      >
                        <ChevronRight className="w-5 h-5" />
                      </button>

                      {/* Bottom Dot Indicators */}
                      <div className="absolute bottom-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-slate-950/75 backdrop-blur-md border border-white/15 flex items-center gap-1.5 z-10">
                        {photos.map((_, dotIdx) => (
                          <button
                            key={dotIdx}
                            type="button"
                            onClick={() => {
                              handleResetZoom();
                              setActivePhotoIndex(dotIdx);
                            }}
                            className={`h-2 rounded-full transition-all cursor-pointer ${
                              safeIndex === dotIdx ? 'w-5 bg-blue-400' : 'w-2 bg-white/40 hover:bg-white/70'
                            }`}
                          />
                        ))}
                      </div>
                    </>
                  )}
                </div>

                {/* Panel Kontrol Crop Interaktif & Variatif */}
                {isCropMode && (
                  <div className="p-3.5 rounded-2xl bg-amber-500/10 dark:bg-amber-500/10 border border-amber-500/35 space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="text-[11px] font-black text-amber-800 dark:text-amber-300 flex items-center gap-1 mr-1">
                          <Crop className="w-3.5 h-3.5 text-amber-500" />
                          <span>Nisbah / Bentuk:</span>
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            setCropShape('rect');
                            setCropAspectRatio('free');
                          }}
                          className={`px-2.5 py-1 rounded-lg text-[10px] font-extrabold transition cursor-pointer border ${
                            cropShape === 'rect' && cropAspectRatio === 'free'
                              ? 'bg-amber-500 text-slate-950 border-amber-400 font-black shadow-2xs'
                              : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-amber-500/30 hover:bg-amber-100'
                          }`}
                        >
                          Bebas (Free)
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setCropShape('rect');
                            setCropAspectRatio('1:1');
                            setCropRect(prev => ({ ...prev, w: Math.min(prev.w, prev.h), h: Math.min(prev.w, prev.h) }));
                          }}
                          className={`px-2.5 py-1 rounded-lg text-[10px] font-extrabold transition cursor-pointer border ${
                            cropShape === 'rect' && cropAspectRatio === '1:1'
                              ? 'bg-amber-500 text-slate-950 border-amber-400 font-black shadow-2xs'
                              : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-amber-500/30 hover:bg-amber-100'
                          }`}
                        >
                          1:1 Persegi
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setCropShape('rect');
                            setCropAspectRatio('4:3');
                            setCropRect(prev => ({ ...prev, w: Math.min(90, Math.round(prev.h * 1.33)), h: prev.h }));
                          }}
                          className={`px-2.5 py-1 rounded-lg text-[10px] font-extrabold transition cursor-pointer border ${
                            cropShape === 'rect' && cropAspectRatio === '4:3'
                              ? 'bg-amber-500 text-slate-950 border-amber-400 font-black shadow-2xs'
                              : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-amber-500/30 hover:bg-amber-100'
                          }`}
                        >
                          4:3 Lanskap
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setCropShape('rect');
                            setCropAspectRatio('16:9');
                            setCropRect(prev => ({ ...prev, w: Math.min(96, Math.round(prev.h * 1.77)), h: prev.h }));
                          }}
                          className={`px-2.5 py-1 rounded-lg text-[10px] font-extrabold transition cursor-pointer border ${
                            cropShape === 'rect' && cropAspectRatio === '16:9'
                              ? 'bg-amber-500 text-slate-950 border-amber-400 font-black shadow-2xs'
                              : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-amber-500/30 hover:bg-amber-100'
                          }`}
                        >
                          16:9 Wide
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setCropShape('circle');
                            setCropAspectRatio('1:1');
                            setCropRect(prev => ({ ...prev, w: Math.min(prev.w, prev.h), h: Math.min(prev.w, prev.h) }));
                          }}
                          className={`px-2.5 py-1 rounded-lg text-[10px] font-extrabold transition cursor-pointer border flex items-center gap-1 ${
                            cropShape === 'circle'
                              ? 'bg-amber-500 text-slate-950 border-amber-400 font-black shadow-2xs'
                              : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-amber-500/30 hover:bg-amber-100'
                          }`}
                        >
                          <span>⭕ Lingkaran / Oval</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setCropRect({ x: 0, y: 0, w: 100, h: 100 })}
                          className="px-2 py-1 rounded-lg bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 text-slate-800 dark:text-slate-200 text-[10px] font-bold transition cursor-pointer ml-1"
                          title="Reset area crop ke ukuran penuh 100%"
                        >
                          Full 100%
                        </button>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => setIsCropMode(false)}
                          className="px-3 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-xs hover:bg-slate-100 transition cursor-pointer"
                        >
                          Batal
                        </button>
                        <button
                          type="button"
                          disabled={isApplyingCrop}
                          onClick={() => handleApplyCropInPreview(previewDocItem, safeIndex, true)}
                          className="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold flex items-center gap-1 shadow-xs transition cursor-pointer disabled:opacity-50"
                          title="Simpan potongan sebagai foto tambahan tanpa menghapus foto asli"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>Simpan Jadi Foto Baru</span>
                        </button>
                        <button
                          type="button"
                          disabled={isApplyingCrop}
                          onClick={() => handleApplyCropInPreview(previewDocItem, safeIndex, false)}
                          className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black flex items-center gap-1.5 shadow-sm transition cursor-pointer disabled:opacity-50"
                          title="Terapkan hasil crop pada foto ini"
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>{isApplyingCrop ? 'Menyimpan...' : 'Terapkan Crop'}</span>
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Modern Filmstrip Thumbnail Bar (Selalu tampil agar bisa lihat semua foto & tambah foto baru) */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="font-bold text-slate-600 dark:text-slate-300">
                      Daftar Foto Dokumentasi ({totalPhotos} Foto)
                    </span>
                    <span className="text-slate-400 text-[10px]">
                      Klik tombol Crop untuk memotong bagian kardus, atau gunakan +/- untuk Zoom
                    </span>
                  </div>
                  <div className="flex items-center gap-2.5 overflow-x-auto pb-1 pt-0.5">
                    {photos.map((pUrl, pIdx) => (
                      <button
                        key={pIdx}
                        type="button"
                        onClick={() => {
                          handleResetZoom();
                          setIsCropMode(false);
                          setActivePhotoIndex(pIdx);
                        }}
                        className={`relative w-20 h-14 rounded-xl overflow-hidden border-2 shrink-0 transition-all cursor-pointer group ${
                          safeIndex === pIdx
                            ? 'border-blue-600 ring-2 ring-blue-500/30 scale-[1.02]'
                            : 'border-slate-200 dark:border-slate-700 opacity-65 hover:opacity-100'
                        }`}
                      >
                        <img src={pUrl} alt={`Foto ${pIdx + 1}`} className="w-full h-full object-cover" />
                        <span
                          className={`absolute bottom-1 left-1 px-1.5 py-0.2 rounded text-[9px] font-black ${
                            pIdx === 0
                              ? 'bg-emerald-600/90 text-white'
                              : 'bg-slate-950/80 text-slate-200'
                          }`}
                        >
                          {pIdx === 0 ? 'Utama' : `#${pIdx + 1}`}
                        </span>
                      </button>
                    ))}

                    {/* Add More Photo Tile inside Filmstrip */}
                    <button
                      type="button"
                      onClick={() => triggerCameraForRow(previewDocItem)}
                      className="w-20 h-14 rounded-xl border-2 border-dashed border-emerald-500/50 hover:border-emerald-500 bg-emerald-500/5 hover:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex flex-col items-center justify-center gap-0.5 shrink-0 transition cursor-pointer"
                      title="Ambil foto tambahan dengan kamera"
                    >
                      <Plus className="w-4 h-4" />
                      <span className="text-[9px] font-extrabold">Tambah Foto</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Footer Info Bar */}
              <div className="px-5 py-3 bg-slate-50 dark:bg-slate-950/80 border-t border-slate-200/80 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2 text-xs">
                <div className="flex flex-wrap items-center gap-3 text-slate-600 dark:text-slate-300">
                  <span>
                    Satuan: <strong className="text-slate-900 dark:text-white">{previewDocItem.unit1 || previewDocItem.satuan || 'Pcs'}</strong>
                    {previewDocItem.unit2 && previewDocItem.rasio2 ? ` (1 ${previewDocItem.unit2} = ${previewDocItem.rasio2} ${previewDocItem.unit1 || 'Pcs'})` : ''}
                  </span>
                  <span>&bull;</span>
                  <span>
                    Dimensi: <strong className="font-mono text-slate-900 dark:text-white">{previewDocItem.panjangCm || 0} &times; {previewDocItem.lebarCm || 0} &times; {previewDocItem.tinggiCm || 0} cm</strong>
                  </span>
                  {previewDocItem.beratKg > 0 && (
                    <>
                      <span>&bull;</span>
                      <span>
                        Berat: <strong className="font-mono text-slate-900 dark:text-white">{previewDocItem.beratKg} kg</strong>
                      </span>
                    </>
                  )}
                </div>
                <span className="inline-flex items-center px-3 py-1 rounded-lg bg-blue-100 dark:bg-blue-900/70 border border-blue-400 dark:border-blue-700 text-blue-900 dark:text-blue-100 font-black text-xs font-mono tracking-wide shadow-2xs">
                  VOL: {calculatedVol} M3
                </span>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Live Camera Viewfinder Modal (Mendukung Pengambilan Lebih Dari 1 Foto Secara Beruntun) */}
      {isCameraModalOpen && (() => {
        const currentTargetPhotos = cameraTargetItem
          ? (Array.isArray(cameraTargetItem.dokumentasiUrls) && cameraTargetItem.dokumentasiUrls.length > 0
              ? cameraTargetItem.dokumentasiUrls.filter(u => u && !u.startsWith('data:image/svg+xml'))
              : (cameraTargetItem.dokumentasiUrl && !cameraTargetItem.dokumentasiUrl.startsWith('data:image/svg+xml') ? [cameraTargetItem.dokumentasiUrl] : []))
          : dokumentasiUrls;

        return (
          <div
            className="fixed inset-0 z-[1500] bg-black/85 backdrop-blur-sm flex items-center justify-center p-3 sm:p-5"
            style={{ zIndex: 1500 }}
          >
            <div className="relative w-full max-w-md bg-slate-900 border border-slate-700 rounded-3xl overflow-hidden shadow-2xl flex flex-col">
              {/* Camera Header */}
              <div className="p-3.5 bg-slate-950/90 border-b border-slate-800 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="p-2 rounded-xl bg-emerald-500/20 text-emerald-400 shrink-0">
                    <Camera className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-black text-white truncate">
                        {cameraTargetItem ? `Foto: ${cameraTargetItem.noBarang}` : 'Ambil Multi-Foto Barang'}
                      </span>
                      <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-[10px] font-black shrink-0">
                        {currentTargetPhotos.length} Foto
                      </span>
                    </div>
                    <div className="text-[10px] text-slate-400 truncate">
                      {cameraTargetItem
                        ? cameraTargetItem.deskripsiBarang
                        : 'Tekan tombol jepret berulang kali untuk mengambil > 1 foto'}
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={stopCamera}
                  className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition cursor-pointer shrink-0"
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
                      Gunakan kamera bawaan HP atau pilih beberapa foto sekaligus dari galeri:
                    </p>
                    <div className="flex flex-wrap items-center justify-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          if (cameraTargetItem) {
                            triggerNativeCameraInputForRow(cameraTargetItem);
                          } else {
                            nativeCameraInputRef.current?.click();
                          }
                        }}
                        className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs cursor-pointer shadow-md"
                      >
                        📸 Kamera Standar HP
                      </button>
                      {cameraTargetItem && (
                        <button
                          type="button"
                          onClick={() => triggerGalleryUploadForRow(cameraTargetItem)}
                          className="px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs cursor-pointer shadow-md"
                        >
                          📁 Pilih Multi-Foto Galeri
                        </button>
                      )}
                    </div>
                  </div>
                ) : (
                  <>
                    <video
                      ref={videoRef}
                      autoPlay
                      playsInline
                      muted
                      style={{
                        transform: `scale(${liveCameraZoom})`,
                        transformOrigin: 'center center'
                      }}
                      className="w-full h-full object-cover transition-transform duration-150"
                    />
                    {/* Framing Overlay + Zoom Selector */}
                    <div className="absolute inset-4 border-2 border-dashed border-emerald-400/50 rounded-2xl pointer-events-none flex flex-col justify-between p-2.5">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[10px] font-bold text-white bg-slate-950/75 px-2.5 py-0.5 rounded-full border border-white/15">
                          Mode Multi-Foto HD
                        </span>
                        <div className="flex items-center gap-1 pointer-events-auto bg-slate-950/80 border border-white/15 rounded-full px-1.5 py-0.5">
                          {[1, 1.5, 2, 3].map(zVal => (
                            <button
                              key={zVal}
                              type="button"
                              onClick={() => setLiveCameraZoom(zVal)}
                              className={`px-1.5 py-0.5 rounded-full text-[9px] font-black transition cursor-pointer ${
                                liveCameraZoom === zVal
                                  ? 'bg-emerald-500 text-slate-950'
                                  : 'text-white/80 hover:text-white'
                              }`}
                            >
                              {zVal}x
                            </button>
                          ))}
                        </div>
                      </div>
                      <div className="text-center">
                        <span className="text-[10px] font-bold text-white/90 bg-black/60 px-2.5 py-1 rounded-full">
                          Jepret foto ke-{currentTargetPhotos.length + 1} &bull; Resolusi Penuh (Tajam)
                        </span>
                      </div>
                    </div>
                  </>
                )}
              </div>

              {/* Live Thumbnail Strip of Captured Photos in Modal */}
              {currentTargetPhotos.length > 0 && (
                <div className="px-3.5 py-2.5 bg-slate-900 border-t border-slate-800 space-y-1.5">
                  <div className="flex items-center justify-between text-[10px] text-slate-400 font-bold">
                    <span>Foto Tersimpan ({currentTargetPhotos.length} Foto):</span>
                    <span className="text-emerald-400">✓ Otomatis Tersimpan</span>
                  </div>
                  <div className="flex items-center gap-2 overflow-x-auto pb-0.5">
                    {currentTargetPhotos.map((u, idx) => (
                      <div
                        key={idx}
                        className="relative w-14 h-11 rounded-lg overflow-hidden border border-emerald-500/50 shrink-0 bg-slate-950"
                      >
                        <img src={u} alt={`Shot ${idx + 1}`} className="w-full h-full object-cover" />
                        <span className="absolute bottom-0.5 left-0.5 px-1 rounded bg-black/75 text-white text-[8px] font-bold">
                          #{idx + 1}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Camera Controls Footer */}
              <div className="p-3.5 bg-slate-950 border-t border-slate-800 flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={toggleCameraFacing}
                    className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 transition cursor-pointer"
                    title="Putar Kamera (Depan / Belakang)"
                  >
                    <RefreshCw className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (cameraTargetItem) {
                        triggerGalleryUploadForRow(cameraTargetItem);
                      } else {
                        nativeCameraInputRef.current?.click();
                      }
                    }}
                    className="px-2.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 transition cursor-pointer text-[11px] font-bold flex items-center gap-1"
                    title="Pilih beberapa foto sekaligus dari Galeri / Kamera HP"
                  >
                    <Upload className="w-3.5 h-3.5 text-sky-400" />
                    <span>Multi-File</span>
                  </button>
                </div>

                {/* Shutter Button (Can click multiple times!) */}
                <button
                  type="button"
                  onClick={capturePhotoFromLiveStream}
                  disabled={Boolean(cameraError)}
                  className="px-4 py-2.5 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs active:scale-95 transition cursor-pointer shadow-lg ring-2 ring-emerald-400/40 disabled:opacity-50 flex items-center gap-1.5"
                  title="Jepret Foto (Bisa berkali-kali)"
                >
                  <Camera className="w-4 h-4" />
                  <span>Jepret Foto #{currentTargetPhotos.length + 1}</span>
                </button>

                <button
                  type="button"
                  onClick={stopCamera}
                  className="px-3.5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white transition cursor-pointer text-xs font-black"
                >
                  Selesai ({currentTargetPhotos.length})
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Modal Filter & Ekspor Excel Database Barang (Satuan, Kubikasi, Berat, Foto) */}
      {isExportModalOpen && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in"
          onClick={() => setIsExportModalOpen(false)}
        >
          <div
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-lg w-full overflow-hidden shadow-2xl"
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-4 flex items-center justify-between text-white">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
                  <FileSpreadsheet className="w-5 h-5 text-white" />
                </div>
                <div>
                  <div className="text-[10px] font-black uppercase tracking-widest text-blue-100">
                    Filter &amp; Unduh Spreadsheet (.XLSX)
                  </div>
                  <h4 className="text-sm font-black tracking-tight text-white">
                    Ekspor Excel Database Barang
                  </h4>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsExportModalOpen(false)}
                className="p-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Body */}
            <div className="p-6 space-y-4">
              <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                Pilih filter data <strong>Satuan, Kubikasi, Berat, dan Foto</strong> yang ingin diekspor ke dalam file Excel. File hasil ekspor juga telah dilengkapi kolom status dan <strong>AutoFilter Excel</strong> otomatis.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                {/* Filter Satuan */}
                <div className="space-y-1.5">
                  <label className="block text-[11px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    1. Filter Satuan
                  </label>
                  <select
                    value={exportUnitFilter}
                    onChange={e => setExportUnitFilter(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs font-bold text-slate-800 dark:text-slate-200 cursor-pointer focus:outline-none focus:border-blue-500"
                  >
                    <option value="ALL">Semua Satuan ({items.length})</option>
                    {availableUnits.map(u => (
                      <option key={u} value={u}>
                        Satuan: {u}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Filter Kubikasi */}
                <div className="space-y-1.5">
                  <label className="block text-[11px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    2. Filter Kubikasi
                  </label>
                  <select
                    value={exportVolFilter}
                    onChange={e => setExportVolFilter(e.target.value as 'ALL' | 'has_vol' | 'no_vol')}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs font-bold text-slate-800 dark:text-slate-200 cursor-pointer focus:outline-none focus:border-blue-500"
                  >
                    <option value="ALL">Semua Kubikasi</option>
                    <option value="has_vol">📦 Memiliki Kubikasi &gt; 0</option>
                    <option value="no_vol">⚪ Tanpa Kubikasi (0)</option>
                  </select>
                </div>

                {/* Filter Berat */}
                <div className="space-y-1.5">
                  <label className="block text-[11px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    3. Filter Berat
                  </label>
                  <select
                    value={exportBeratFilter}
                    onChange={e => setExportBeratFilter(e.target.value as 'ALL' | 'has_berat' | 'no_berat')}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs font-bold text-slate-800 dark:text-slate-200 cursor-pointer focus:outline-none focus:border-blue-500"
                  >
                    <option value="ALL">Semua Berat</option>
                    <option value="has_berat">⚖️ Memiliki Berat &gt; 0 kg</option>
                    <option value="no_berat">⚪ Tanpa Berat (0 kg)</option>
                  </select>
                </div>

                {/* Filter Foto */}
                <div className="space-y-1.5">
                  <label className="block text-[11px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    4. Filter Foto
                  </label>
                  <select
                    value={exportFotoFilter}
                    onChange={e => setExportFotoFilter(e.target.value as 'ALL' | 'has_photo' | 'no_photo')}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs font-bold text-slate-800 dark:text-slate-200 cursor-pointer focus:outline-none focus:border-blue-500"
                  >
                    <option value="ALL">📷 Semua Foto ({items.length})</option>
                    <option value="has_photo">✅ Sudah Ada Foto ({photoStats.withPhoto})</option>
                    <option value="no_photo">⚠️ Belum Ada Foto ({photoStats.withoutPhoto})</option>
                  </select>
                </div>
              </div>

              {/* Ringkasan Filter Ekspor */}
              <div className="p-3.5 rounded-2xl bg-blue-50/70 dark:bg-blue-950/30 border border-blue-200/80 dark:border-blue-800/60 flex items-center justify-between gap-3">
                <div>
                  <div className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
                    Total Baris Siap Diekspor:
                  </div>
                  <div className="text-base font-black text-blue-700 dark:text-blue-400 font-mono">
                    {exportFilteredItems.length.toLocaleString('id-ID')} <span className="text-xs font-bold text-slate-500">/ {items.length.toLocaleString('id-ID')} Barang</span>
                  </div>
                </div>
                {(exportUnitFilter !== 'ALL' || exportVolFilter !== 'ALL' || exportBeratFilter !== 'ALL' || exportFotoFilter !== 'ALL') && (
                  <button
                    type="button"
                    onClick={() => {
                      setExportUnitFilter('ALL');
                      setExportVolFilter('ALL');
                      setExportBeratFilter('ALL');
                      setExportFotoFilter('ALL');
                    }}
                    className="px-2.5 py-1.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-rose-600 dark:text-rose-400 text-xs font-bold hover:bg-rose-50 transition cursor-pointer flex items-center gap-1"
                  >
                    <X className="w-3 h-3" />
                    <span>Reset Filter</span>
                  </button>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setIsExportModalOpen(false)}
                  className="flex-1 py-2.5 px-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold text-xs transition cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="button"
                  disabled={exportFilteredItems.length === 0}
                  onClick={() => handleExportDatabaseBarang(exportFilteredItems)}
                  className="flex-1 py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-black text-xs shadow-md shadow-blue-600/20 flex items-center justify-center gap-1.5 transition cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Unduh Excel ({exportFilteredItems.length.toLocaleString('id-ID')})</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Custom Delete Confirmation Modal (Menggantikan window.confirm browser bawaan) */}
      {itemToDelete && (
        <div
          className="fixed inset-0 z-[1600] bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in"
          style={{ zIndex: 1600 }}
          onClick={() => setItemToDelete(null)}
        >
          <div
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-md w-full overflow-hidden shadow-2xl my-auto"
            onClick={e => e.stopPropagation()}
          >
            {/* Top Accent Header */}
            <div className="bg-gradient-to-r from-rose-600 to-red-600 px-6 py-4 flex items-center justify-between text-white">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
                  <Trash2 className="w-5 h-5 text-white" />
                </div>
                <div>
                  <div className="text-[10px] font-black uppercase tracking-widest text-rose-100">
                    Konfirmasi Penghapusan Data
                  </div>
                  <h4 className="text-sm font-black tracking-tight text-white">
                    Hapus Barang dari Database?
                  </h4>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setItemToDelete(null)}
                className="p-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Body Detail Barang */}
            <div className="p-6 space-y-4">
              <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                Anda akan menghapus item berikut dari <strong>Database Barang Gudang (WMS)</strong>. Tindakan ini akan memperbarui daftar barang secara permanen:
              </p>

              <div className="p-4 rounded-2xl bg-rose-50/70 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800/60 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="px-2.5 py-0.5 rounded-lg bg-rose-600 text-white font-mono text-xs font-black">
                    {itemToDelete.noBarang}
                  </span>
                  <span className="px-2 py-0.5 rounded-md bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-[11px] font-bold text-slate-700 dark:text-slate-300">
                    Satuan: {itemToDelete.unit1 || itemToDelete.satuan || 'Pcs'}
                  </span>
                </div>
                <div className="text-sm font-black text-slate-900 dark:text-white leading-snug">
                  {itemToDelete.deskripsiBarang || itemToDelete.keteranganBarang}
                </div>
                <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-500 dark:text-slate-400 font-mono pt-1 border-t border-rose-200/60 dark:border-rose-800/40">
                  <span>
                    Dimensi: {itemToDelete.panjangCm || 0}&times;{itemToDelete.lebarCm || 0}&times;{itemToDelete.tinggiCm || 0} cm
                  </span>
                  <span>&bull;</span>
                  <span>VOL: {itemToDelete.volM3 || 0} M3</span>
                  <span>&bull;</span>
                  <span>Berat: {itemToDelete.beratKg || 0} kg</span>
                </div>
              </div>

              <div className="flex items-center gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setItemToDelete(null)}
                  className="flex-1 py-2.5 px-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold text-xs transition cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="button"
                  autoFocus
                  onClick={confirmDeleteItem}
                  className="flex-1 py-2.5 px-4 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-black text-xs shadow-md shadow-rose-600/20 flex items-center justify-center gap-1.5 transition cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Ya, Hapus Barang</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Custom Delete Confirmation Modal for Photo (Menggantikan window.confirm browser) */}
      {photoToDelete && (
        <div
          className="fixed inset-0 z-[1600] bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in"
          style={{ zIndex: 1600 }}
          onClick={() => setPhotoToDelete(null)}
        >
          <div
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-md w-full overflow-hidden shadow-2xl my-auto"
            onClick={e => e.stopPropagation()}
          >
            {/* Top Accent Header */}
            <div className="bg-gradient-to-r from-rose-600 via-rose-600 to-red-600 px-6 py-4 flex items-center justify-between text-white">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
                  <Trash2 className="w-5 h-5 text-white" />
                </div>
                <div>
                  <div className="text-[10px] font-black uppercase tracking-widest text-rose-100">
                    Konfirmasi Hapus Foto
                  </div>
                  <h4 className="text-sm font-black tracking-tight text-white">
                    {photoToDelete.isAll ? 'Hapus Semua Foto Barang' : 'Hapus Foto Barang'}
                  </h4>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setPhotoToDelete(null)}
                className="p-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Body */}
            <div className="p-6 space-y-4">
              <p className="text-xs font-bold text-slate-800 dark:text-slate-200 leading-relaxed">
                Apakah Anda yakin ingin menghapus gambar <span className="text-rose-600 dark:text-rose-400 font-black">{photoToDelete.item.deskripsiBarang || photoToDelete.item.keteranganBarang || photoToDelete.item.noBarang}</span>?
              </p>

              <div className="p-4 rounded-2xl bg-rose-50/70 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800/60 flex gap-3.5 items-center">
                {photoToDelete.photoUrl && !photoToDelete.photoUrl.startsWith('data:image/svg+xml') ? (
                  <img
                    src={photoToDelete.photoUrl}
                    alt={photoToDelete.item.noBarang}
                    className="w-16 h-16 rounded-xl object-cover border border-rose-300 dark:border-rose-700 shrink-0 bg-white dark:bg-slate-800"
                  />
                ) : (
                  <div className="w-16 h-16 rounded-xl bg-rose-100 dark:bg-rose-900/50 flex items-center justify-center shrink-0 text-rose-500 font-bold text-xs">
                    Foto
                  </div>
                )}
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded-md bg-rose-600 text-white font-mono text-[11px] font-black">
                      {photoToDelete.item.noBarang}
                    </span>
                    <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
                      Satuan: {photoToDelete.item.unit1 || photoToDelete.item.satuan || 'Pcs'}
                    </span>
                  </div>
                  <div className="text-xs font-black text-slate-900 dark:text-white truncate">
                    {photoToDelete.item.deskripsiBarang || photoToDelete.item.keteranganBarang}
                  </div>
                  <div className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">
                    Dimensi: {photoToDelete.item.panjangCm || 0}&times;{photoToDelete.item.lebarCm || 0}&times;{photoToDelete.item.tinggiCm || 0} cm
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setPhotoToDelete(null)}
                  className="flex-1 py-2.5 px-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold text-xs transition cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="button"
                  autoFocus
                  onClick={confirmDeletePhoto}
                  className="flex-1 py-2.5 px-4 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-black text-xs shadow-md shadow-rose-600/20 flex items-center justify-center gap-1.5 transition cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Ya, Hapus Foto</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modern Feedback Notification Modal */}
      {feedbackModal && (
        <div
          className="fixed inset-0 z-[1700] bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in"
          style={{ zIndex: 1700 }}
          onClick={() => setFeedbackModal(null)}
        >
          <div
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-md w-full overflow-hidden shadow-2xl my-auto"
            onClick={e => e.stopPropagation()}
          >
            <div
              className={`px-6 py-4 flex items-center justify-between text-white ${
                feedbackModal.variant === 'danger'
                  ? 'bg-gradient-to-r from-rose-600 to-red-600'
                  : 'bg-gradient-to-r from-emerald-600 to-teal-600'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
                  <CheckCircle2 className="w-5 h-5 text-white" />
                </div>
                <div>
                  <div className="text-[10px] font-black uppercase tracking-widest opacity-90">
                    Notifikasi Sistem Database
                  </div>
                  <h4 className="text-sm font-black tracking-tight text-white">
                    {feedbackModal.title}
                  </h4>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setFeedbackModal(null)}
                className="p-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 space-y-4 text-center">
              {feedbackModal.badge && (
                <span className="inline-block px-3 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-mono text-xs font-black text-blue-600 dark:text-blue-400">
                  {feedbackModal.badge}
                </span>
              )}
              <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                {feedbackModal.message}
              </p>
              <button
                type="button"
                autoFocus
                onClick={() => setFeedbackModal(null)}
                className={`w-full py-2.5 rounded-xl text-white font-black text-xs cursor-pointer transition shadow-sm ${
                  feedbackModal.variant === 'danger'
                    ? 'bg-rose-600 hover:bg-rose-500'
                    : 'bg-emerald-600 hover:bg-emerald-500'
                }`}
              >
                Oke, Mengerti
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
