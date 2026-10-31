import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Camera,
  MapPin,
  AlertTriangle,
  CheckCircle2,
  Share2,
  Send,
  Truck,
  RefreshCw,
  CameraOff,
  FileText,
  Maximize2,
  Store,
  Fuel,
  Upload,
  Plus,
  Trash2,
  Images
} from 'lucide-react';
import { Schedule } from '../types';
import { driverChecklistService } from '../services/driverChecklistService';
import { driverReportService, DriverHelperReport } from '../services/driverReportService';
import { driverWaybillService } from '../services/driverWaybillService';
import { logisticsStore } from '../services/store';

export type GmapsReportCategory = 'kendala_jalan' | 'akhir_kiriman' | 'istirahat' | 'update_lokasi' | 'isi_bbm';

interface DriverGmapsShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  deliveries: Schedule[];
  driverName?: string;
  plateNumber?: string;
  driverId?: string;
  onReportSubmitted: (report: {
    category: GmapsReportCategory;
    delivery: Schedule | null;
    notes: string;
    photoUrl: string | null;
    photoUrls?: string[];
    distanceMeters: number | null;
    isWithinRadius: boolean;
    driverLat: number;
    driverLng: number;
    gmapsUrl: string;
    plateNumber: string;
    areaName: string;
  }) => void;
}

export const DriverGmapsShareModal: React.FC<DriverGmapsShareModalProps> = ({
  isOpen,
  onClose,
  deliveries,
  driverName = 'Supir AKK',
  plateNumber = 'P 8125 VC',
  driverId,
  onReportSubmitted
}) => {
  const [category, setCategory] = useState<GmapsReportCategory>('isi_bbm');
  const [reportSubMode, setReportSubMode] = useState<'kendala_umum' | 'antri_customer'>('kendala_umum');
  const [notes, setNotes] = useState<string>('');
  const [photoList, setPhotoList] = useState<string[]>([]);
  const [activePhotoIndex, setActivePhotoIndex] = useState<number>(0);
  const [isCapturing, setIsCapturing] = useState<boolean>(false);
  const [isFullPhotoPreviewOpen, setIsFullPhotoPreviewOpen] = useState<boolean>(false);

  const photoDataUrl = photoList[activePhotoIndex] || photoList[0] || null;

  // State Fitur Antri di Customer & Absen Setiap Kiriman ke Pelanggan
  const [activeQueueReport, setActiveQueueReport] = useState<DriverHelperReport | null>(null);
  const [customerOutletInput, setCustomerOutletInput] = useState<string>('');
  const [customerNameInput, setCustomerNameInput] = useState<string>('');
  const [fuelLocation, setFuelLocation] = useState<'Farly' | 'Gajah Mada'>('Farly');
  const [fuelLiters, setFuelLiters] = useState<string>('');
  const [validationError, setValidationError] = useState<string | null>(null);
  const [simulatedExtraMin, setSimulatedExtraMin] = useState<number>(0);
  const [elapsedQueueSeconds, setElapsedQueueSeconds] = useState<number>(0);
  const [queueCompletedToast, setQueueCompletedToast] = useState<string | null>(null);

  // Live Camera Stream State
  const [isCameraActive, setIsCameraActive] = useState<boolean>(false);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [cameraCaptureFlash, setCameraCaptureFlash] = useState<boolean>(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Otomatis terisi nomor kendaraan sesuai data checklist
  const [autoPlateNumber, setAutoPlateNumber] = useState<string>(plateNumber);

  // Lookup inisial armada dari master data
  const fleets = logisticsStore.getFleets();
  const matchedFleet = fleets.find(f =>
    f.plateNumber.replace(/\s+/g, '').toUpperCase() === (autoPlateNumber || '').replace(/\s+/g, '').toUpperCase()
  );
  const fleetInitial = matchedFleet?.initialCode || (autoPlateNumber.includes('8848') ? 'N3 / NS1' : autoPlateNumber.includes('8125') ? 'N1 / NP1' : autoPlateNumber.includes('8509') ? 'A3 / NP3' : undefined);

  // GPS Coordinates (Direkam otomatis di background untuk sistem)
  const [driverLat, setDriverLat] = useState<number>(-8.2190);
  const [driverLng, setDriverLng] = useState<number>(114.3680);

  const cameraInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const addPhotoToList = (stampedUrl: string) => {
    setPhotoList(prev => {
      const next = [...prev, stampedUrl];
      setActivePhotoIndex(next.length - 1);
      return next;
    });
    setValidationError(null);
  };

  const removePhotoAtIndex = (idx: number) => {
    setPhotoList(prev => {
      const next = prev.filter((_, i) => i !== idx);
      setActivePhotoIndex(curr => Math.max(0, Math.min(curr, next.length - 1)));
      return next;
    });
  };

  // Reset seluruh field input agar data yang sudah terkirim tidak pernah nyantol
  const resetFormFields = () => {
    setNotes('');
    setPhotoList([]);
    setActivePhotoIndex(0);
    setCustomerOutletInput('');
    setCustomerNameInput('');
    setFuelLiters('');
    setValidationError(null);
    setCameraError(null);
    setSimulatedExtraMin(0);
    if (cameraInputRef.current) cameraInputRef.current.value = '';
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Otomatis pilih jadwal / Surat Jalan Keluar yang sedang aktif hari ini
  const todayStr = new Date().toISOString().split('T')[0];
  const activeDelivery: Schedule | null = React.useMemo(() => {
    if (!deliveries || deliveries.length === 0) return null;
    const inTransit = deliveries.find(d => d.status === 'in_transit' || d.status === 'picked_up');
    if (inTransit) return inTransit;
    const todayMatch = deliveries.find(d => d.departureDate <= todayStr && d.status !== 'delivered');
    if (todayMatch) return todayMatch;
    return deliveries[0];
  }, [deliveries, todayStr]);

  const activeWaybill = React.useMemo(() => {
    if (!activeDelivery) return null;
    try {
      return driverWaybillService.getWaybillForSchedule(activeDelivery);
    } catch {
      return null;
    }
  }, [activeDelivery]);

  const currentAreaName = React.useMemo(() => {
    if (activeWaybill?.destination) {
      const area = activeWaybill.destination.areaName || activeWaybill.destination.storeName;
      const city = activeWaybill.destination.city ? ` (${activeWaybill.destination.city})` : '';
      return `${area}${city}`;
    }
    if (activeDelivery) {
      const area = activeDelivery.areaName || activeDelivery.store?.storeName || 'Area Pengiriman';
      const city = activeDelivery.store?.city ? ` (${activeDelivery.store.city})` : '';
      return `${area}${city}`;
    }
    return 'Sesuai Surat Jalan Keluar Aktif';
  }, [activeWaybill, activeDelivery]);

  const currentWaybillNo = activeWaybill?.waybillNumber || activeDelivery?.trackingNumber || 'SJ-OUT/AKK/AKTIF';

  // Cek apakah ada antrean customer yang sedang aktif untuk kru ini
  const refreshActiveQueue = () => {
    const allReports = driverReportService.getReports();
    const found = allReports.find(
      r =>
        r.customerQueueStatus === 'sedang_mengantri' &&
        ((driverId && r.driverId === driverId) ||
          r.driverName.toLowerCase() === (driverName || '').toLowerCase() ||
          r.plateNumber === autoPlateNumber)
    );
    setActiveQueueReport(found || null);
    if (found && found.customerOutletName) {
      setCustomerOutletInput(found.customerOutletName);
    }
  };

  useEffect(() => {
    if (isOpen) {
      resetFormFields();
      setQueueCompletedToast(null);
      try {
        const checklists = driverChecklistService.getChecklists();
        const activeChecklist = driverId
          ? checklists.find(c => c.driverId === driverId)
          : checklists[0];
        if (activeChecklist?.plateNumber) {
          setAutoPlateNumber(activeChecklist.plateNumber);
        } else if (plateNumber) {
          setAutoPlateNumber(plateNumber);
        }
      } catch {
        setAutoPlateNumber(plateNumber);
      }

      refreshActiveQueue();

      if (typeof navigator !== 'undefined' && navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            setDriverLat(pos.coords.latitude);
            setDriverLng(pos.coords.longitude);
          },
          () => {
            setDriverLat(-8.2190);
            setDriverLng(114.3680);
          },
          { enableHighAccuracy: true, timeout: 8000 }
        );
      }
    } else {
      stopLiveCamera();
      resetFormFields();
    }
  }, [isOpen, driverId, plateNumber]);

  // Timer detikan real-time selama kru sedang mengantri di customer
  useEffect(() => {
    if (!activeQueueReport) {
      setElapsedQueueSeconds(0);
      return;
    }
    const startMs = activeQueueReport.customerQueueStartIso
      ? new Date(activeQueueReport.customerQueueStartIso).getTime()
      : new Date(activeQueueReport.timestamp).getTime();

    const updateTimer = () => {
      const diffSec = Math.max(0, Math.floor((Date.now() - startMs) / 1000));
      setElapsedQueueSeconds(diffSec);
    };
    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [activeQueueReport]);

  // Automatically attach stream to video element when camera is active
  useEffect(() => {
    if (isCameraActive && videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current;
      videoRef.current.muted = true;
      videoRef.current.play().catch(pErr => {
        console.warn('[DriverGmaps] video.play error:', pErr);
      });
    }
  }, [isCameraActive]);

  const startLiveCamera = async (mode: 'environment' | 'user' = facingMode) => {
    stopLiveCamera();
    setCameraError(null);
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('NOT_SUPPORTED');
      }

      let stream: MediaStream | null = null;
      let lastErr: unknown = null;

      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: mode },
            width: { ideal: 1280 },
            height: { ideal: 720 }
          },
          audio: false
        });
      } catch (e1) {
        lastErr = e1;
      }

      if (!stream) {
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: mode },
            audio: false
          });
        } catch (e2) {
          lastErr = e2;
        }
      }

      if (!stream) {
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            video: true,
            audio: false
          });
        } catch (e3) {
          lastErr = e3;
        }
      }

      if (!stream) {
        throw lastErr || new Error('Tidak dapat membuka stream video.');
      }

      streamRef.current = stream;
      setIsCameraActive(true);
      setCameraError(null);
    } catch (err: unknown) {
      const errName = err instanceof Error ? err.name : '';
      const msg = err instanceof Error ? err.message : String(err);

      try {
        logisticsStore.logActivity(
          'Akses Kamera Ditolak',
          driverName || 'Driver Operasional',
          `Kendala Gmaps/Rute Kamera (${errName || 'Error'}): ${msg} [Plat: ${autoPlateNumber}]`
        );
      } catch {
        // ignore
      }

      if (cameraInputRef.current) {
        cameraInputRef.current.click();
      } else {
        setCameraError('Akses kamera terkendala izin perangkat. Silakan izinkan akses kamera pada browser Anda.');
      }
    }
  };

  const handleFlipCamera = () => {
    const nextMode = facingMode === 'environment' ? 'user' : 'environment';
    setFacingMode(nextMode);
    startLiveCamera(nextMode);
  };

  const stopLiveCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    setIsCameraActive(false);
  };

  // Watermark stamper helper
  const applyWatermarkToCanvas = (canvas: HTMLCanvasElement): string => {
    const ctx = canvas.getContext('2d');
    if (!ctx) return canvas.toDataURL('image/jpeg', 0.72);
    const w = canvas.width;
    const h = canvas.height;

    const bannerHeight = Math.max(85, Math.floor(h * 0.17));
    const bannerY = h - bannerHeight;

    const grad = ctx.createLinearGradient(0, bannerY, 0, h);
    grad.addColorStop(0, 'rgba(15, 23, 42, 0.92)');
    grad.addColorStop(1, 'rgba(15, 23, 42, 0.98)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, bannerY, w, bannerHeight);

    ctx.fillStyle = category === 'kendala_jalan' ? '#e11d48' : category === 'isi_bbm' ? '#d97706' : '#2563eb';
    ctx.fillRect(0, bannerY, w, 4);

    const fontSize = Math.max(12, Math.floor(w * 0.024));
    ctx.textBaseline = 'top';

    ctx.fillStyle = category === 'isi_bbm' ? '#fbbf24' : '#60a5fa';
    ctx.font = `bold ${fontSize}px system-ui, sans-serif`;
    const titleTag =
      category === 'kendala_jalan' && reportSubMode === 'antri_customer'
        ? '⏳ ANTRI DI CUSTOMER'
        : category === 'kendala_jalan'
        ? '⚠️ KENDALA DI JALAN'
        : category === 'isi_bbm'
        ? `⛽ ISI BBM (SOLAR) - ${fuelLocation.toUpperCase()}`
        : category === 'akhir_kiriman'
        ? '📦 AKHIR KIRIMAN (POD)'
        : '✅ ABSEN KIRIMAN PELANGGAN';
    ctx.fillText(`${titleTag} • PT ANUGRAH KEMASAN KREATIF`, 16, bannerY + 10);

    ctx.fillStyle = '#ffffff';
    ctx.font = `bold ${fontSize - 1}px system-ui, sans-serif`;
    const initialText = fleetInitial ? ` [${fleetInitial}]` : '';
    const targetCustomerLabel =
      category === 'istirahat' && customerNameInput.trim()
        ? `Pelanggan: ${customerNameInput.trim()} (${currentAreaName})`
        : category === 'isi_bbm'
        ? `Lokasi BBM: SPBU ${fuelLocation}`
        : `Area: ${currentAreaName}`;
    ctx.fillText(`${targetCustomerLabel} | Driver: ${driverName} [${autoPlateNumber}${initialText}]`, 16, bannerY + 12 + fontSize);

    const nowStr = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) + ' WIB';
    ctx.fillStyle = '#cbd5e1';
    ctx.font = `bold ${fontSize - 2}px monospace`;
    ctx.fillText(`🕒 ${nowStr} | 📍 GPS: ${driverLat.toFixed(5)}, ${driverLng.toFixed(5)}`, 16, bannerY + 14 + (fontSize * 2));

    const stampedUrl = canvas.toDataURL('image/jpeg', 0.72);
    addPhotoToList(stampedUrl);
    return stampedUrl;
  };

  // Potret foto dari kamera aktif (Tetap di kamera atau bisa ambil lebih dari 1 foto)
  const captureLivePhoto = (closeAfterCapture: boolean = false) => {
    if (!videoRef.current) return;
    const video = videoRef.current;
    const rawW = video.videoWidth || 1280;
    const rawH = video.videoHeight || 720;
    const maxDim = 960;
    let w = rawW;
    let h = rawH;
    if (w > maxDim || h > maxDim) {
      if (w > h) {
        h = Math.round((h * maxDim) / w);
        w = maxDim;
      } else {
        w = Math.round((w * maxDim) / h);
        h = maxDim;
      }
    }
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.drawImage(video, 0, 0, w, h);
    setCameraCaptureFlash(true);
    setTimeout(() => setCameraCaptureFlash(false), 180);

    applyWatermarkToCanvas(canvas);
    if (closeAfterCapture) {
      stopLiveCamera();
    }
  };

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsCapturing(true);
    const fileArray = Array.from(files);
    let processedCount = 0;

    fileArray.forEach(file => {
      const reader = new FileReader();
      reader.onload = () => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const maxDim = 960;
          let w = img.width;
          let h = img.height;
          if (w > maxDim || h > maxDim) {
            if (w > h) {
              h = Math.round((h * maxDim) / w);
              w = maxDim;
            } else {
              w = Math.round((w * maxDim) / h);
              h = maxDim;
            }
          }
          canvas.width = w;
          canvas.height = h;

          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(img, 0, 0, w, h);
            applyWatermarkToCanvas(canvas);
          }
          processedCount += 1;
          if (processedCount >= fileArray.length) {
            setIsCapturing(false);
          }
        };
        img.src = reader.result as string;
      };
      reader.readAsDataURL(file);
    });

    e.target.value = '';
  };

  const gmapsLink = `https://www.google.com/maps?q=${driverLat},${driverLng}`;

  const getWhatsAppShareText = () => {
    const categoryLabel =
      category === 'kendala_jalan' && reportSubMode === 'antri_customer'
        ? '⏳ LAPORAN ANTRI DI CUSTOMER'
        : category === 'kendala_jalan'
        ? '🚨 LAPORAN KENDALA DI JALAN'
        : category === 'isi_bbm'
        ? `⛽ LAPORAN PENGISIAN BBM (SOLAR) - ${fuelLocation.toUpperCase()}`
        : category === 'akhir_kiriman'
        ? '📦 LAPORAN AKHIR KIRIMAN (SELESAI BONGKAR)'
        : '✅ ABSEN KIRIMAN KE PELANGGAN';

    const customerLine =
      category === 'istirahat' && customerNameInput.trim()
        ? `*Nama Pelanggan:* ${customerNameInput.trim()}\n`
        : category === 'isi_bbm'
        ? `*Lokasi SPBU:* ${fuelLocation}\n`
        : '';

    return encodeURIComponent(
      `*${categoryLabel}*\n` +
      `*Driver:* ${driverName}\n` +
      `*Armada:* ${autoPlateNumber}${fleetInitial ? ` [Inisial: ${fleetInitial}]` : ''}\n` +
      `*Area Kirim (Surat Jalan):* ${currentAreaName}\n` +
      customerLine +
      `*No. Surat Jalan:* ${currentWaybillNo}\n` +
      `*Jumlah Foto Bukti:* ${photoList.length} Foto\n` +
      (category !== 'isi_bbm' ? `*Keterangan:* ${notes || 'Dokumentasi terlampir'}\n` : '') +
      `*Titik Google Maps:* ${gmapsLink}\n` +
      `*Waktu:* ${new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })} WIB`
    );
  };

  const handleShareWhatsApp = () => {
    const waUrl = `https://wa.me/?text=${getWhatsAppShareText()}`;
    const a = document.createElement('a');
    a.href = waUrl;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleSubmit = () => {
    setValidationError(null);

    if (category === 'istirahat') {
      if (!customerNameInput.trim()) {
        setValidationError('Harap isi Nama Pelanggan / Toko terlebih dahulu untuk Absen Kiriman.');
        return;
      }
      if (photoList.length === 0) {
        setValidationError('Harap ambil minimal 1 Foto Bukti Kiriman ke Pelanggan terlebih dahulu.');
        return;
      }
    }

    if (category === 'isi_bbm') {
      if (photoList.length === 0) {
        setValidationError('Harap ambil atau unggah minimal 1 Foto Bukti Pengisian BBM (Solar) terlebih dahulu.');
        return;
      }
    }

    const submittedNotes =
      category === 'istirahat'
        ? `[ABSEN KIRIMAN PELANGGAN: ${customerNameInput.trim()}] ${notes.trim() || 'Kiriman telah tiba dan diserahkan ke pelanggan.'}`
        : category === 'isi_bbm'
        ? `Pengisian BBM (Solar) di SPBU ${fuelLocation}${photoList.length > 1 ? ` (${photoList.length} Foto Bukti)` : ''}`
        : notes.trim() || (category === 'akhir_kiriman' ? 'Selesai serah terima di area tujuan' : 'Laporan kendala pengiriman di jalan');

    const submittedPhoto = photoList[0] || null;
    const submittedPhotos = [...photoList];
    const submittedCustomer = category === 'istirahat' ? customerNameInput.trim() : undefined;

    driverReportService.addReport({
      driverId: driverId || 'crew-driver',
      driverName: driverName,
      plateNumber: autoPlateNumber,
      category,
      areaName: category === 'isi_bbm' ? `SPBU ${fuelLocation} (${currentAreaName})` : currentAreaName,
      customerOutletName: submittedCustomer,
      fuelLocation: category === 'isi_bbm' ? fuelLocation : undefined,
      deliveryId: activeDelivery?.id,
      notes: submittedNotes,
      photoUrl: submittedPhoto,
      photoUrls: submittedPhotos,
      latitude: driverLat,
      longitude: driverLng,
      gmapsUrl: gmapsLink
    });

    resetFormFields();

    onReportSubmitted({
      category,
      delivery: activeDelivery,
      notes: submittedNotes,
      photoUrl: submittedPhoto,
      photoUrls: submittedPhotos,
      distanceMeters: null,
      isWithinRadius: true,
      driverLat,
      driverLng,
      gmapsUrl: gmapsLink,
      plateNumber: autoPlateNumber,
      areaName: category === 'isi_bbm' ? `SPBU ${fuelLocation}` : currentAreaName
    });

    onClose();
  };

  if (!isOpen) return null;

  const cameraCategoryTitle =
    category === 'kendala_jalan' && reportSubMode === 'antri_customer'
      ? 'ANTRI CUSTOMER'
      : category === 'kendala_jalan'
      ? 'KENDALA DI JALAN'
      : category === 'isi_bbm'
      ? `ISI BBM (${fuelLocation.toUpperCase()})`
      : category === 'akhir_kiriman'
      ? 'AKHIR KIRIMAN'
      : 'ABSEN PELANGGAN';

  return (
    <>
      {/* LIVE CAMERA OVERLAY WHEN TAKING PHOTO (High-Contrast Header & Bottom Bar + Multi-Photo Support) */}
      {isCameraActive && (
        <div className="fixed inset-0 z-[80] w-screen h-screen bg-slate-950 flex flex-col justify-between p-0 animate-in fade-in duration-150">
          {/* Top Camera Bar - High Contrast & Clear Text */}
          <div className="px-4 py-3 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 shadow-md flex items-center justify-between gap-2 z-20">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                <Camera className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-black text-slate-900 dark:text-white tracking-wide">
                    KAMERA • {cameraCategoryTitle}
                  </span>
                  {photoList.length > 0 && (
                    <span className="px-2 py-0.5 rounded-full bg-emerald-600 text-white text-[10px] font-black">
                      {photoList.length} Foto Tersimpan
                    </span>
                  )}
                </div>
                <div className="text-[11px] text-slate-600 dark:text-slate-300 font-semibold truncate">
                  Area: {currentAreaName} ({autoPlateNumber})
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={handleFlipCamera}
                className="px-2.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-white border border-slate-300 dark:border-slate-700 font-bold text-[11px] flex items-center gap-1.5 cursor-pointer"
                title="Balik Kamera"
              >
                <RefreshCw className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                <span className="hidden sm:inline">Balik</span>
              </button>
              <button
                type="button"
                onClick={stopLiveCamera}
                className="p-2 rounded-xl bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-300 border border-rose-200 dark:border-rose-800 cursor-pointer"
                title="Tutup Kamera"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Video Viewfinder */}
          <div className="flex-1 relative w-full h-full flex items-center justify-center overflow-hidden bg-black">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover"
            />
            {cameraCaptureFlash && (
              <div className="absolute inset-0 bg-white/80 pointer-events-none z-30 transition-opacity duration-150" />
            )}
            <div className="absolute inset-5 pointer-events-none border border-white/40 rounded-2xl flex flex-col justify-between p-3">
              <div className="flex justify-between">
                <div className="w-6 h-6 border-t-2 border-l-2 border-blue-400" />
                <div className="w-6 h-6 border-t-2 border-r-2 border-blue-400" />
              </div>
              <div className="flex justify-between">
                <div className="w-6 h-6 border-b-2 border-l-2 border-blue-400" />
                <div className="w-6 h-6 border-b-2 border-r-2 border-blue-400" />
              </div>
            </div>

            {/* Thumbnail Strip of Captured Photos Inside Camera View (When > 0 photos) */}
            {photoList.length > 0 && (
              <div className="absolute bottom-3 left-3 right-3 z-20 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border border-slate-200 dark:border-slate-700 rounded-2xl p-2.5 shadow-xl">
                <div className="flex items-center justify-between mb-1.5 px-1">
                  <span className="text-[11px] font-black text-slate-900 dark:text-white flex items-center gap-1.5">
                    <Images className="w-3.5 h-3.5 text-blue-600" />
                    <span>Daftar Foto Siap Dikirim ({photoList.length} Foto)</span>
                  </span>
                  <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
                    Bisa potret lagi untuk tambah foto
                  </span>
                </div>
                <div className="flex items-center gap-2 overflow-x-auto pb-1">
                  {photoList.map((imgUrl, idx) => (
                    <div
                      key={`cam-thumb-${idx}`}
                      className="relative w-14 h-14 rounded-xl overflow-hidden border-2 border-blue-500 shrink-0 bg-black"
                    >
                      <img src={imgUrl} alt={`Foto ${idx + 1}`} className="w-full h-full object-cover" />
                      <span className="absolute bottom-0.5 left-1 px-1 rounded bg-blue-600 text-white text-[8px] font-black">
                        #{idx + 1}
                      </span>
                      <button
                        type="button"
                        onClick={() => removePhotoAtIndex(idx)}
                        className="absolute top-0.5 right-0.5 w-4 h-4 rounded-full bg-rose-600 text-white flex items-center justify-center cursor-pointer"
                        title="Hapus Foto Ini"
                      >
                        <X className="w-2.5 h-2.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Bottom Shutter Bar: Kiri Bawah = Tambah Foto | Tengah = Tombol Kamera | Kanan = Lanjut Kirim / Batal */}
          <div className="px-4 py-4 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 shadow-2xl flex items-center justify-between gap-3 z-20">
            {/* Sebelah Kiri Bawah: Fitur Tambah Foto */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  if (photoList.length === 0) {
                    captureLivePhoto(false);
                  } else {
                    fileInputRef.current?.click();
                  }
                }}
                className="px-3 py-2.5 rounded-xl bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/70 text-blue-700 dark:text-blue-300 border border-blue-300 dark:border-blue-700 font-extrabold text-xs flex items-center gap-1.5 transition active:scale-95 cursor-pointer shadow-2xs"
                title="Tambah Foto"
              >
                <Plus className="w-4 h-4 shrink-0" />
                <span>Tambah Foto</span>
                {photoList.length > 0 && (
                  <span className="px-1.5 py-0.2 rounded-full bg-blue-600 text-white text-[10px] font-black">
                    {photoList.length}
                  </span>
                )}
              </button>
            </div>

            {/* Tengah: Tombol Potret Kamera */}
            <button
              type="button"
              onClick={() => captureLivePhoto(false)}
              className="w-16 h-16 sm:w-18 sm:h-18 rounded-full border-4 border-blue-600 dark:border-blue-400 p-1 flex items-center justify-center shadow-lg active:scale-90 transition cursor-pointer shrink-0 bg-white dark:bg-slate-900"
              title="Potret Foto"
            >
              <div className="w-full h-full rounded-full bg-blue-600 hover:bg-blue-500 flex items-center justify-center text-white">
                <Camera className="w-7 h-7" />
              </div>
            </button>

            {/* Sebelah Kanan Bawah: Tombol Kirim / Gunakan (jika sudah ada foto) atau Batal */}
            <div className="flex items-center gap-2">
              {photoList.length > 0 ? (
                <button
                  type="button"
                  onClick={stopLiveCamera}
                  className="px-3.5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs flex items-center gap-1.5 shadow-md transition active:scale-95 cursor-pointer"
                >
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>Gunakan ({photoList.length} Foto)</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={stopLiveCamera}
                  className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-extrabold border border-slate-300 dark:border-slate-700 cursor-pointer"
                >
                  Batal
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* PHOTO PREVIEW MODAL (Mendukung Multi-Foto) */}
      {isFullPhotoPreviewOpen && photoDataUrl && (
        <div
          className="fixed inset-0 z-[85] w-screen h-screen bg-black/95 flex flex-col justify-between p-4 animate-in fade-in duration-150"
          onClick={() => setIsFullPhotoPreviewOpen(false)}
        >
          <div className="flex items-center justify-between" onClick={e => e.stopPropagation()}>
            <span className="text-xs font-bold text-slate-900 dark:text-white bg-white dark:bg-slate-900 px-3 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700">
              Pratinjau Foto Bukti ({activePhotoIndex + 1} / {photoList.length})
            </span>
            <button
              type="button"
              onClick={() => setIsFullPhotoPreviewOpen(false)}
              className="p-2.5 rounded-full bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-bold cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="flex-1 flex items-center justify-center overflow-hidden my-2">
            <img
              src={photoDataUrl}
              alt="Bukti"
              className="w-full h-full object-contain"
            />
          </div>
          {photoList.length > 1 && (
            <div className="flex items-center justify-center gap-2 pb-2" onClick={e => e.stopPropagation()}>
              {photoList.map((u, idx) => (
                <button
                  key={`full-prev-${idx}`}
                  type="button"
                  onClick={() => setActivePhotoIndex(idx)}
                  className={`w-12 h-12 rounded-xl overflow-hidden border-2 cursor-pointer ${
                    idx === activePhotoIndex ? 'border-blue-500 scale-105' : 'border-white/30 opacity-70'
                  }`}
                >
                  <img src={u} alt={`Thumb ${idx + 1}`} className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200">
        <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-t-3xl sm:rounded-2xl flex flex-col max-h-[92vh] shadow-2xl overflow-hidden">
          
          {/* Header - Clean Cohesive Design */}
          <div className="p-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-sm font-black shrink-0">
                <Share2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-black text-white">
                  Lapor Kendala, Absen &amp; Isi BBM (Solar)
                </h3>
                <p className="text-[11px] text-slate-400 font-medium">
                  Dokumentasi kendala jalan, absen pelanggan, dan pengisian BBM (Solar)
                </p>
              </div>
            </div>

            <button
              onClick={() => {
                resetFormFields();
                onClose();
              }}
              className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Scrollable Body */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs">
            
            {/* Category Selector Tabs: 1. Isi BBM (Solar), 2. Kendala di Jalan, 3. Absen Kiriman Pelanggan */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Pilih Jenis Laporan:
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    resetFormFields();
                    setCategory('isi_bbm');
                    setReportSubMode('kendala_umum');
                  }}
                  className={`py-2.5 px-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer ${
                    category === 'isi_bbm'
                      ? 'bg-amber-600 border-amber-500 text-white shadow-xs'
                      : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Fuel className="w-3.5 h-3.5 shrink-0" />
                  <span>Isi BBM (Solar)</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    resetFormFields();
                    setCategory('kendala_jalan');
                    setReportSubMode('kendala_umum');
                  }}
                  className={`py-2.5 px-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer ${
                    category === 'kendala_jalan'
                      ? 'bg-rose-600 border-rose-500 text-white shadow-xs'
                      : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                  <span>Kendala di Jalan</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    resetFormFields();
                    setCategory('istirahat');
                    setReportSubMode('kendala_umum');
                  }}
                  className={`py-2.5 px-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer ${
                    category === 'istirahat' || category === 'update_lokasi'
                      ? 'bg-blue-600 border-blue-500 text-white shadow-xs'
                      : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Store className="w-3.5 h-3.5 shrink-0" />
                  <span>Absen Kiriman Pelanggan</span>
                </button>
              </div>
            </div>

            {validationError && (
              <div className="p-3 rounded-xl bg-rose-500/15 border border-rose-500/40 text-rose-300 text-xs font-bold flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                <span>{validationError}</span>
              </div>
            )}

            {/* ⛽ FITUR ISI BBM (SOLAR) DI FARLY / GAJAH MADA */}
            {category === 'isi_bbm' && (
              <div className="p-3.5 rounded-2xl border bg-slate-950 border-amber-500/30 space-y-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-400 flex items-center justify-center shrink-0">
                    <Fuel className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="font-black text-white text-xs">
                      Pengisian BBM (Solar) Armada
                    </div>
                    <p className="text-[10px] text-slate-400">
                      Pilih lokasi pengisian BBM (Farly / Gajah Mada) dan unggah foto bukti pengisian solar
                    </p>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-300">
                    Pilih Lokasi Pengisian BBM (Solar) *
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setFuelLocation('Farly')}
                      className={`py-2.5 px-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-2 transition cursor-pointer ${
                        fuelLocation === 'Farly'
                          ? 'bg-amber-600/25 border-amber-500 text-amber-300 ring-1 ring-amber-500/50'
                          : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                      }`}
                    >
                      <MapPin className="w-3.5 h-3.5 shrink-0" />
                      <span>Farly</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setFuelLocation('Gajah Mada')}
                      className={`py-2.5 px-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-2 transition cursor-pointer ${
                        fuelLocation === 'Gajah Mada'
                          ? 'bg-amber-600/25 border-amber-500 text-amber-300 ring-1 ring-amber-500/50'
                          : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                      }`}
                    >
                      <MapPin className="w-3.5 h-3.5 shrink-0" />
                      <span>Gajah Mada</span>
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* 📦 FITUR ABSEN SETIAP KIRIMAN KE PELANGGAN */}
            {category === 'istirahat' && (
              <div className="p-3.5 rounded-2xl border bg-slate-950 border-slate-800 space-y-2.5">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-blue-500/15 border border-blue-500/30 text-blue-400 flex items-center justify-center shrink-0">
                    <Store className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="font-black text-white text-xs">
                      Absen Setiap Kiriman ke Pelanggan
                    </div>
                    <p className="text-[10px] text-slate-400">
                      Isi nama pelanggan/toko yang dikirimi barang beserta foto bukti penyerahan kiriman
                    </p>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-300">
                    Nama Pelanggan / Toko Tujuan Kiriman *
                  </label>
                  <input
                    type="text"
                    value={customerNameInput}
                    onChange={(e) => {
                      setCustomerNameInput(e.target.value);
                      if (validationError) setValidationError(null);
                    }}
                    placeholder="Contoh: Toko Grosir Makmur / Bpk. Hendra"
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2.5 text-xs text-white font-semibold focus:outline-none focus:border-blue-500 placeholder-slate-500"
                  />
                </div>
              </div>
            )}

            {/* Nomor Kendaraan Armada */}
            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center justify-between">
                <span>Nomor Kendaraan Armada:</span>
                <span className="text-[10px] text-slate-400 font-semibold">✓ Sesuai Check-In</span>
              </label>
              <div className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-xs flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <Truck className="w-4 h-4 text-blue-400" />
                  <span className="font-mono font-bold text-white text-sm">{autoPlateNumber}</span>
                  {fleetInitial && (
                    <span className="px-2 py-0.5 rounded-lg bg-slate-800 text-slate-200 border border-slate-700 text-[11px] font-bold">
                      Inisial: {fleetInitial}
                    </span>
                  )}
                </div>
                <span className="px-2 py-0.5 rounded-md bg-slate-800 text-slate-300 border border-slate-700 text-[10px] font-semibold">
                  Terkunci Otomatis
                </span>
              </div>
            </div>

            {/* NAMA AREA KIRIM */}
            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center justify-between">
                <span>Nama Area Kirim:</span>
                <span className="text-[10px] text-slate-400 font-semibold">✓ Sesuai Surat Jalan</span>
              </label>
              <div className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-xs flex items-center justify-between gap-2">
                <div className="flex items-center gap-2.5 min-w-0">
                  <MapPin className="w-4 h-4 text-blue-400 shrink-0" />
                  <div className="min-w-0">
                    <div className="font-bold text-white text-xs truncate">
                      {currentAreaName}
                    </div>
                    <div className="text-[10px] text-slate-400 font-mono flex items-center gap-1 mt-0.5">
                      <FileText className="w-3 h-3 text-slate-400 shrink-0" />
                      <span>No. SJ: {currentWaybillNo}</span>
                    </div>
                  </div>
                </div>
                <span className="px-2 py-0.5 rounded-md bg-slate-800 text-slate-300 border border-slate-700 text-[10px] font-semibold shrink-0">
                  Terkunci Otomatis
                </span>
              </div>
            </div>

            {/* Photo Capture & Multi-Photo Upload Section */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                  <span>{category === 'istirahat' ? 'Foto Bukti Kiriman ke Pelanggan (Kamera) *:' : 'Unggah Foto Bukti (Kamera):'}</span>
                  {photoList.length > 0 && (
                    <span className="px-2 py-0.5 rounded-full bg-blue-600 text-white text-[9px] font-black">
                      {photoList.length} Foto Siap Kirim
                    </span>
                  )}
                </label>
                {photoList.length > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      setPhotoList([]);
                      setActivePhotoIndex(0);
                    }}
                    className="text-[10px] text-rose-400 font-bold hover:underline cursor-pointer flex items-center gap-1"
                  >
                    <Trash2 className="w-3 h-3" />
                    <span>Hapus Semua ({photoList.length})</span>
                  </button>
                )}
              </div>

              {/* Hidden Native Device Camera Trigger */}
              <input
                type="file"
                ref={cameraInputRef}
                accept="image/*"
                capture="environment"
                onChange={handlePhotoUpload}
                className="hidden"
              />

              {/* Hidden Gallery / File Picker (Multiple Supported) */}
              <input
                type="file"
                ref={fileInputRef}
                accept="image/*"
                multiple
                onChange={handlePhotoUpload}
                className="hidden"
              />

              {/* ERROR ALERT IF CAMERA PERMISSION DENIED */}
              {cameraError && !isCameraActive && (
                <div className="p-3 rounded-2xl bg-slate-950 border border-slate-800 text-slate-300 space-y-2">
                  <div className="flex items-start gap-2">
                    <CameraOff className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                    <div className="text-[11px] leading-relaxed flex-1">
                      <span className="font-bold text-white block">Akses Kamera Perangkat Terkendala</span>
                      {cameraError}
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-slate-800">
                    <button
                      type="button"
                      onClick={() => startLiveCamera()}
                      className="px-3 py-1.5 rounded-lg bg-blue-600 text-white font-bold text-[11px] flex items-center gap-1.5 cursor-pointer hover:bg-blue-500 active:scale-95 transition"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      <span>Buka Kamera</span>
                    </button>
                  </div>
                </div>
              )}

              {photoList.length > 0 ? (
                <div className="rounded-2xl overflow-hidden border border-slate-700 bg-slate-950 shadow-sm space-y-2.5 p-2.5">
                  {/* Pratinjau Foto Utama */}
                  <div className="relative rounded-xl overflow-hidden bg-black border border-slate-800">
                    <img
                      src={photoDataUrl || photoList[0]}
                      alt={`Foto Bukti ${activePhotoIndex + 1}`}
                      onClick={() => setIsFullPhotoPreviewOpen(true)}
                      className="w-full max-h-60 object-contain bg-black cursor-pointer"
                    />
                    <div className="absolute top-2 left-2 bg-white/95 dark:bg-slate-900/95 px-2.5 py-1 rounded-lg text-[10px] text-emerald-700 dark:text-emerald-400 font-black flex items-center gap-1 border border-emerald-500/40 shadow-sm">
                      <CheckCircle2 className="w-3 h-3" />
                      <span>
                        Foto #{activePhotoIndex + 1} dari {photoList.length} • Siap Kirim
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setIsFullPhotoPreviewOpen(true)}
                      className="absolute top-2 right-2 bg-white/95 dark:bg-slate-900/95 text-slate-900 dark:text-white px-2.5 py-1 rounded-lg text-[10px] font-bold flex items-center gap-1 border border-slate-300 dark:border-slate-700 cursor-pointer shadow-sm"
                    >
                      <Maximize2 className="w-3 h-3 text-blue-600 dark:text-blue-400" />
                      <span>Perbesar</span>
                    </button>
                  </div>

                  {/* Galeri Thumbnail Semua Foto (Menampilkan 1 atau Lebih dari 1 Foto) */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-[10px] text-slate-400 px-0.5">
                      <span className="font-bold">
                        Daftar Foto Lampiran ({photoList.length} Foto):
                      </span>
                      <span>Ketuk foto untuk memilih / perbesar</span>
                    </div>
                    <div className="flex items-center gap-2 overflow-x-auto pb-1">
                      {photoList.map((imgUrl, idx) => (
                        <div
                          key={`preview-thumb-${idx}`}
                          onClick={() => setActivePhotoIndex(idx)}
                          className={`relative w-16 h-16 rounded-xl overflow-hidden border-2 shrink-0 cursor-pointer transition ${
                            idx === activePhotoIndex
                              ? 'border-blue-500 ring-2 ring-blue-500/30'
                              : 'border-slate-700 opacity-80 hover:opacity-100'
                          }`}
                        >
                          <img src={imgUrl} alt={`Lampiran ${idx + 1}`} className="w-full h-full object-cover" />
                          <span className="absolute bottom-0.5 left-1 px-1 rounded bg-blue-600 text-white text-[8px] font-black">
                            #{idx + 1}
                          </span>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              removePhotoAtIndex(idx);
                            }}
                            className="absolute top-0.5 right-0.5 w-4 h-4 rounded-full bg-rose-600 text-white flex items-center justify-center cursor-pointer shadow"
                            title="Hapus Foto Ini"
                          >
                            <X className="w-2.5 h-2.5" />
                          </button>
                        </div>
                      ))}

                      {/* Tombol Cepat + Tambah Foto di dalam Galeri */}
                      <button
                        type="button"
                        onClick={() => startLiveCamera()}
                        className="w-16 h-16 rounded-xl border-2 border-dashed border-blue-500/50 hover:border-blue-500 bg-blue-500/10 text-blue-500 flex flex-col items-center justify-center gap-0.5 shrink-0 cursor-pointer transition"
                        title="Tambah Foto Kamera"
                      >
                        <Plus className="w-4 h-4" />
                        <span className="text-[9px] font-black">Kamera</span>
                      </button>
                    </div>
                  </div>

                  {/* Baris Bawah Kiri: Tombol Tambah Foto (Kamera / Galeri) */}
                  <div className="pt-2 border-t border-slate-800 flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => startLiveCamera()}
                        className="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-[11px] flex items-center gap-1.5 cursor-pointer shadow-2xs"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Tambah Foto Kamera</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-amber-400 font-bold text-[11px] border border-slate-700 flex items-center gap-1.5 cursor-pointer"
                      >
                        <Upload className="w-3.5 h-3.5" />
                        <span>Tambah dari Galeri</span>
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={() => removePhotoAtIndex(activePhotoIndex)}
                      className="px-2.5 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-rose-400 font-bold text-[10px] border border-slate-700 cursor-pointer"
                    >
                      Hapus Foto #{activePhotoIndex + 1}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => startLiveCamera()}
                    disabled={isCapturing}
                    className="w-full p-4 rounded-2xl border-2 border-dashed border-slate-700 hover:border-blue-500 bg-slate-950 hover:bg-slate-900 flex items-center justify-center gap-3 cursor-pointer transition text-center group active:scale-95"
                  >
                    <div className="w-11 h-11 rounded-full bg-blue-600/15 border border-blue-500/30 flex items-center justify-center text-blue-400 group-hover:scale-105 transition shrink-0">
                      <Camera className="w-5 h-5" />
                    </div>
                    <div className="text-left">
                      <div className="font-black text-white text-sm">
                        Buka Kamera
                      </div>
                      <div className="text-[11px] text-slate-400 font-medium mt-0.5">
                        {category === 'istirahat'
                          ? 'Foto penyerahan kiriman (bisa >1 foto)'
                          : category === 'isi_bbm'
                          ? `Foto isi BBM (${fuelLocation})`
                          : 'Ambil foto bukti kamera (bisa >1 foto)'}
                      </div>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isCapturing}
                    className="w-full p-4 rounded-2xl border-2 border-dashed border-slate-700 hover:border-amber-500 bg-slate-950 hover:bg-slate-900 flex items-center justify-center gap-3 cursor-pointer transition text-center group active:scale-95"
                  >
                    <div className="w-11 h-11 rounded-full bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400 group-hover:scale-105 transition shrink-0">
                      <Upload className="w-5 h-5" />
                    </div>
                    <div className="text-left">
                      <div className="font-black text-white text-sm">
                        Upload Foto
                      </div>
                      <div className="text-[11px] text-slate-400 font-medium mt-0.5">
                        Pilih 1 atau beberapa foto galeri
                      </div>
                    </div>
                  </button>
                </div>
              )}
            </div>

            {/* Notes Input (Hidden for Isi BBM per user request) */}
            {category !== 'isi_bbm' && (
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  {category === 'istirahat'
                    ? 'Catatan Kiriman Pelanggan (Opsional):'
                    : 'Keterangan / Catatan Laporan:'}
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder={
                    category === 'kendala_jalan' && reportSubMode === 'antri_customer'
                      ? 'Contoh: Sedang mengantri bongkar di gudang customer karena ada 2 armada di depan...'
                      : category === 'kendala_jalan'
                      ? 'Contoh: Macet perbaikan jalan di jalur Rogojampi, perkiraan keterlambatan 25 menit...'
                      : category === 'akhir_kiriman'
                      ? 'Contoh: Muatan diterima lengkap di gudang toko dalam keadaan baik...'
                      : 'Contoh: Barang diterima lengkap oleh PIC toko dalam kondisi baik...'
                  }
                  rows={3}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-slate-200 focus:outline-none focus:border-blue-500 placeholder-slate-500"
                />
              </div>
            )}
          </div>

          {/* Footer Buttons */}
          <div className="p-4 bg-slate-950 border-t border-slate-800 flex items-center gap-2">
            <button
              type="button"
              onClick={handleShareWhatsApp}
              className="flex-1 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs flex items-center justify-center gap-2 transition active:scale-95 border border-slate-700 cursor-pointer"
              title="Bagikan format laporan & link koordinat ke grup WhatsApp"
            >
              <Share2 className="w-4 h-4" />
              <span>Bagikan WA</span>
            </button>

            <button
              type="button"
              onClick={handleSubmit}
              className="flex-1 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-black text-xs flex items-center justify-center gap-2 transition active:scale-95 shadow-sm cursor-pointer"
            >
              <Send className="w-4 h-4" />
              <span>
                {category === 'istirahat'
                  ? `Simpan Absen${photoList.length > 1 ? ` (${photoList.length} Foto)` : ''}`
                  : category === 'isi_bbm'
                  ? `Simpan Laporan BBM${photoList.length > 1 ? ` (${photoList.length} Foto)` : ''}`
                  : `Simpan Laporan${photoList.length > 1 ? ` (${photoList.length} Foto)` : ''}`}
              </span>
            </button>
          </div>

        </div>
      </div>
    </>
  );
};
