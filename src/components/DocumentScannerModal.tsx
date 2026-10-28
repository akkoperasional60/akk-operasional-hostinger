import React, { useState, useRef, useEffect } from 'react';
import {
  Camera,
  Upload,
  RefreshCw,
  Check,
  X,
  FileText,
  AlertTriangle,
  Sparkles,
  Zap,
  ZapOff,
  SwitchCamera,
  Eye,
  FileCheck2,
  Calendar,
  Truck,
  User,
  MapPin,
  ClipboardCheck,
  Layers
} from 'lucide-react';
import { ScannedDocumentLog, ScannedDocumentType, Fleet, Crew } from '../types';
import { logisticsStore } from '../services/store';

interface DocumentScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaveSuccess: (doc: ScannedDocumentLog) => void;
  initialType?: ScannedDocumentType;
}

export const DocumentScannerModal: React.FC<DocumentScannerModalProps> = ({
  isOpen,
  onClose,
  onSaveSuccess,
  initialType = 'delivery_slip'
}) => {
  const [mode, setMode] = useState<'camera' | 'upload' | 'sample'>('camera');
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [hasTorch, setHasTorch] = useState<boolean>(false);
  const [isTorchOn, setIsTorchOn] = useState<boolean>(false);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [isFlashActive, setIsFlashActive] = useState<boolean>(false);

  // Review & Extracted Metadata Form State
  const [step, setStep] = useState<'capture' | 'review'>('capture');
  const [documentType, setDocumentType] = useState<ScannedDocumentType>(initialType);
  const [documentNumber, setDocumentNumber] = useState<string>('');
  const [documentDate, setDocumentDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [vehiclePlate, setVehiclePlate] = useState<string>('');
  const [driverName, setDriverName] = useState<string>('');
  const [destinationOrStore, setDestinationOrStore] = useState<string>('');
  const [cargoSummary, setCargoSummary] = useState<string>('');
  const [quantityOrWeight, setQuantityOrWeight] = useState<string>('');
  const [inspectionScore, setInspectionScore] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [signaturesDetected, setSignaturesDetected] = useState<boolean>(false);
  const [rawExtractedText, setRawExtractedText] = useState<string>('');
  const [confidenceScore, setConfidenceScore] = useState<number>(0);
  const [verificationStatus, setVerificationStatus] = useState<'verified' | 'pending_review'>('pending_review');

  const videoRef = useRef<HTMLVideoElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const registeredFleets = logisticsStore.getFleets();
  const registeredCrews = logisticsStore.getCrews();

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setStep('capture');
      setCapturedImage(null);
      setCameraError(null);
      setDocumentType(initialType);
      startCamera(facingMode);
    } else {
      stopCamera();
    }
    return () => {
      stopCamera();
    };
  }, [isOpen, initialType]);

  // Audio shutter sound
  const playShutterSound = () => {
    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(900, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(200, ctx.currentTime + 0.08);
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.08);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.09);
    } catch {}
  };

  // Start device camera with resilient 3-tier fallback
  const startCamera = async (facing: 'environment' | 'user') => {
    stopCamera();
    setCameraError(null);
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('NOT_SUPPORTED: Peramban tidak mendukung WebRTC Camera. Silakan gunakan opsi Kamera HP Bawaan.');
      }

      let mediaStream: MediaStream | null = null;
      let lastErr: unknown = null;

      // Tier 1: Ideal facingMode and HD resolution
      try {
        mediaStream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: facing },
            width: { ideal: 1280 },
            height: { ideal: 720 }
          },
          audio: false
        });
      } catch (err1) {
        lastErr = err1;
        console.warn('[DocScanner] Tier 1 constraint rejected, trying Tier 2:', err1);
      }

      // Tier 2: Simple facingMode
      if (!mediaStream) {
        try {
          mediaStream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: facing },
            audio: false
          });
        } catch (err2) {
          lastErr = err2;
          console.warn('[DocScanner] Tier 2 facingMode rejected, trying Tier 3:', err2);
        }
      }

      // Tier 3: Any video device
      if (!mediaStream) {
        try {
          mediaStream = await navigator.mediaDevices.getUserMedia({
            video: true,
            audio: false
          });
        } catch (err3) {
          lastErr = err3;
          console.warn('[DocScanner] Tier 3 basic video rejected:', err3);
        }
      }

      if (!mediaStream) {
        throw lastErr || new Error('Tidak dapat membuka stream kamera peramban.');
      }

      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        try {
          await videoRef.current.play();
        } catch (pErr) {
          console.warn('[DocScanner] video.play error:', pErr);
        }
      }
      const videoTrack = mediaStream.getVideoTracks()[0];
      if (videoTrack) {
        const capabilities = videoTrack.getCapabilities ? videoTrack.getCapabilities() : null;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        if (capabilities && (capabilities as any).torch) {
          setHasTorch(true);
        } else {
          setHasTorch(false);
        }
      }
    } catch (err: unknown) {
      console.warn('[DocScanner] Camera init error:', err);
      const msg = err instanceof Error ? err.message : String(err);
      if (
        msg.includes('Permission') ||
        msg.includes('denied') ||
        msg.includes('NotAllowedError') ||
        msg.includes('SecurityError')
      ) {
        setCameraError('Izin akses kamera peramban belum diberikan. Anda dapat mengklik "Minta Izin Ulang" atau langsung gunakan tombol "Buka Kamera HP Langsung" di bawah.');
      } else {
        setCameraError('Kamera tidak dapat dimulai otomatis. Anda dapat mengetuk tombol "Buka Kamera HP Langsung" di bawah.');
      }
    }
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach(track => {
        try { track.stop(); } catch {}
      });
      setStream(null);
    }
  };

  const toggleTorch = async () => {
    if (!stream || !hasTorch) return;
    const track = stream.getVideoTracks()[0];
    if (track) {
      const next = !isTorchOn;
      try {
        await (track as any).applyConstraints({
          advanced: [{ torch: next }]
        });
        setIsTorchOn(next);
      } catch {}
    }
  };

  const switchCamera = () => {
    const nextMode = facingMode === 'environment' ? 'user' : 'environment';
    setFacingMode(nextMode);
    startCamera(nextMode);
  };

  // Capture photo from video stream
  const capturePhoto = () => {
    if (!videoRef.current) return;
    playShutterSound();
    setIsFlashActive(true);
    setTimeout(() => setIsFlashActive(false), 200);

    const video = videoRef.current;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    // Apply digital timestamp watermark
    const nowStr = new Date().toLocaleString('id-ID');
    ctx.fillStyle = 'rgba(15, 23, 42, 0.75)';
    ctx.fillRect(16, canvas.height - 48, 520, 36);
    ctx.fillStyle = '#f59e0b';
    ctx.font = 'bold 15px monospace';
    ctx.fillText(`PT AKK LOGISTICS DC • DIGITAL SCAN • ${nowStr} WIB`, 26, canvas.height - 24);

    const dataUrl = canvas.toDataURL('image/jpeg', 0.88);
    setCapturedImage(dataUrl);
    stopCamera();
    processDocumentWithAI(dataUrl);
  };

  // Handle uploaded file
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      if (dataUrl) {
        setCapturedImage(dataUrl);
        stopCamera();
        processDocumentWithAI(dataUrl);
      }
    };
    reader.readAsDataURL(file);
  };

  // Pre-configured demo samples clearly labeled as DEMO (not verified operational records)
  const loadDemoSample = (type: 'slip' | 'inspection') => {
    stopCamera();
    const defaultFleetPlate = registeredFleets[0]?.plateNumber || 'DEMO-ARMADA';
    const defaultCrewName = registeredCrews[0]?.name || 'DEMO DRIVER';
    if (type === 'slip') {
      const demoImg = 'https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?auto=format&fit=crop&w=800&q=80';
      setCapturedImage(demoImg);
      setDocumentType('delivery_slip');
      setDocumentNumber(`DEMO-SJ-AKK/${new Date().getFullYear()}/${Math.floor(1000 + Math.random() * 9000)}`);
      setDocumentDate(new Date().toISOString().split('T')[0]);
      setVehiclePlate(defaultFleetPlate);
      setDriverName(defaultCrewName);
      setDestinationOrStore('[DEMO] Contoh Toko Tujuan');
      setCargoSummary('[DEMO] Contoh Muatan Karton Box Corrugated');
      setQuantityOrWeight('[DEMO] Contoh Kuantitas');
      setInspectionScore('Demo Sample');
      setNotes('[CONTOH DEMO — BUKAN DOKUMEN OPERASIONAL] Sampel antarmuka untuk uji tampilan pratinjau OCR.');
      setSignaturesDetected(false);
      setRawExtractedText('[DEMO SAMPLE] CONTOH TEKS EKSTRAKSI SURAT JALAN');
      setConfidenceScore(0);
      setVerificationStatus('pending_review');
      setStep('review');
    } else {
      const demoImg = 'https://images.unsplash.com/photo-1618042164219-62c820f10723?auto=format&fit=crop&w=800&q=80';
      setCapturedImage(demoImg);
      setDocumentType('inspection_form');
      setDocumentNumber(`DEMO-INSP-AKK/${new Date().getFullYear()}/${Math.floor(1000 + Math.random() * 9000)}`);
      setDocumentDate(new Date().toISOString().split('T')[0]);
      setVehiclePlate(defaultFleetPlate);
      setDriverName(defaultCrewName);
      setDestinationOrStore('[DEMO] Contoh Rute Inspeksi');
      setCargoSummary('[DEMO] Contoh Pemeriksaan Pre-Trip Armada');
      setQuantityOrWeight('[DEMO] Contoh Checklist');
      setInspectionScore('Demo Sample');
      setNotes('[CONTOH DEMO — BUKAN DOKUMEN OPERASIONAL] Sampel antarmuka untuk uji tampilan formulir inspeksi.');
      setSignaturesDetected(false);
      setRawExtractedText('[DEMO SAMPLE] CONTOH TEKS EKSTRAKSI FORMULIR INSPEKSI');
      setConfidenceScore(0);
      setVerificationStatus('pending_review');
      setStep('review');
    }
  };

  // Process document with backend AI endpoint
  const processDocumentWithAI = async (imageDataUrl: string) => {
    setIsProcessing(true);
    try {
      const response = await fetch('/api/scan-document', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageBase64: imageDataUrl,
          documentHint: documentType
        })
      });

      const res = await response.json().catch(() => null);
      if (response.ok && res && res.success && res.data) {
        const d = res.data;
        setDocumentType(d.documentType || documentType);
        setDocumentNumber(d.documentNumber || '');
        setDocumentDate(d.date || new Date().toISOString().split('T')[0]);
        setVehiclePlate(d.vehiclePlate || '');
        setDriverName(d.driverName || '');
        setDestinationOrStore(d.destinationOrStore || '');
        setCargoSummary(d.cargoOrItemsSummary || '');
        setQuantityOrWeight(d.quantityOrWeight || '');
        setInspectionScore(d.inspectionScore || '');
        setNotes(d.notes || '');
        setSignaturesDetected(Boolean(d.signaturesDetected));
        setRawExtractedText(d.rawExtractedText || '');
        setConfidenceScore(Number(d.confidenceScore) || 0);
        setVerificationStatus('pending_review');
      } else {
        setDocumentNumber('');
        setVerificationStatus('pending_review');
        setNotes(res?.error || 'Ekstraksi OCR otomatis belum tersedia. Silakan lengkapi data dokumen secara manual.');
      }
    } catch (err) {
      console.warn('[DocScanner] OCR request error:', err);
      setDocumentNumber('');
      setVerificationStatus('pending_review');
      setNotes('Gagal menghubungi layanan OCR. Silakan lengkapi data dokumen secara manual.');
    } finally {
      setIsProcessing(false);
      setStep('review');
    }
  };

  // Save the verified log entry to logisticsStore
  const handleSaveDocumentLog = () => {
    if (!capturedImage) return;

    const typeLabels: Record<ScannedDocumentType, string> = {
      delivery_slip: 'Surat Jalan (Delivery Slip)',
      inspection_form: 'Formulir Inspeksi Armada (Pre-Trip)',
      service_order: 'Formulir Service / SPK Bengkel',
      fuel_receipt: 'Nota / Bukti Pengisian BBM',
      other: 'Dokumen Operasional Lainnya'
    };

    const currentUser = logisticsStore.getCurrentUser();
    const userLabel = `${currentUser.fullName || 'BayuN791'} (${currentUser.role || 'Staff'})`;

    const newLog = logisticsStore.addScannedDocument({
      documentType,
      documentTypeLabel: typeLabels[documentType],
      documentNumber: documentNumber || `DOC-${Date.now()}`,
      date: documentDate,
      capturedBy: userLabel,
      vehiclePlate,
      driverName,
      destinationOrStore,
      status: verificationStatus,
      cargoOrItemsSummary: cargoSummary,
      quantityOrWeight,
      inspectionScore,
      notes,
      signaturesDetected,
      rawExtractedText: rawExtractedText || `${documentNumber} ${vehiclePlate} ${driverName} ${destinationOrStore} ${cargoSummary}`,
      confidenceScore,
      photoDataUrl: capturedImage,
      source: mode === 'upload' ? 'upload' : 'camera'
    });

    onSaveSuccess(newLog);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-3xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[95vh]">
        {/* Modal Header */}
        <div className="px-5 py-3.5 bg-slate-950 border-b border-slate-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400">
              <Camera className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                Pemindai Dokumen Digital Armada (Camera OCR)
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                  AI Searchable Log
                </span>
              </h3>
              <p className="text-[11px] text-slate-400">
                Pindai Surat Jalan (Delivery Slip) atau Formulir Inspeksi menggunakan kamera HP/perangkat
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* STEP 1: CAPTURE / UPLOAD SCREEN */}
        {step === 'capture' && (
          <div className="flex-1 overflow-y-auto p-4 sm:p-5 flex flex-col gap-4">
            {/* Mode Tabs */}
            <div className="flex items-center gap-2 p-1 bg-slate-950 rounded-xl border border-slate-800 shrink-0">
              <button
                type="button"
                onClick={() => {
                  setMode('camera');
                  startCamera(facingMode);
                }}
                className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                  mode === 'camera'
                    ? 'bg-amber-500 text-slate-950 shadow'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Camera className="w-3.5 h-3.5" />
                <span>Kamera Langsung</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setMode('upload');
                  stopCamera();
                }}
                className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                  mode === 'upload'
                    ? 'bg-amber-500 text-slate-950 shadow'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Upload className="w-3.5 h-3.5" />
                <span>Unggah Foto / File</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setMode('sample');
                  stopCamera();
                }}
                className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                  mode === 'sample'
                    ? 'bg-amber-500 text-slate-950 shadow'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Sampel Demo</span>
              </button>
            </div>

            {/* Hint Type Selector */}
            <div className="flex items-center gap-2 text-xs">
              <span className="text-slate-400 font-semibold text-[11px] shrink-0">Tipe Dokumen Target:</span>
              <div className="flex flex-wrap gap-1.5">
                {[
                  { id: 'delivery_slip', label: 'Surat Jalan (Delivery Slip)' },
                  { id: 'inspection_form', label: 'Formulir Inspeksi Armada' },
                  { id: 'service_order', label: 'SPK Service Bengkel' }
                ].map(t => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setDocumentType(t.id as ScannedDocumentType)}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition cursor-pointer ${
                      documentType === t.id
                        ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40 shadow-xs'
                        : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-slate-200'
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            {/* MODE A: LIVE CAMERA STREAM */}
            {mode === 'camera' && (
              <div className="relative flex-1 min-h-[340px] bg-black rounded-xl overflow-hidden border border-slate-800 flex items-center justify-center">
                {isFlashActive && <div className="absolute inset-0 bg-white z-40 animate-out fade-out duration-150" />}

                {cameraError ? (
                  <div className="p-6 text-center space-y-3.5 max-w-sm">
                    <div className="w-12 h-12 rounded-full bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400 mx-auto">
                      <Camera className="w-6 h-6" />
                    </div>
                    <div className="space-y-1">
                      <h4 className="text-sm font-bold text-white">Akses Kamera Perangkat Terkendala</h4>
                      <p className="text-xs text-slate-300 leading-relaxed">{cameraError}</p>
                    </div>
                    <div className="flex flex-col gap-2 pt-2">
                      <button
                        type="button"
                        onClick={() => cameraInputRef.current?.click()}
                        className="w-full py-2.5 px-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs flex items-center justify-center gap-2 cursor-pointer shadow-md active:scale-95 transition"
                      >
                        <Camera className="w-4 h-4" />
                        <span>Buka Kamera HP Langsung</span>
                      </button>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => startCamera(facingMode)}
                          className="py-2 px-3 rounded-lg bg-slate-800 hover:bg-slate-700 text-cyan-300 font-bold text-[11px] border border-slate-700 cursor-pointer"
                        >
                          Minta Izin Ulang
                        </button>
                        <button
                          type="button"
                          onClick={() => loadDemoSample('slip')}
                          className="py-2 px-3 rounded-lg bg-slate-800 hover:bg-slate-700 text-amber-300 font-bold text-[11px] border border-slate-700 cursor-pointer"
                        >
                          Pakai Sampel SJ
                        </button>
                      </div>
                    </div>
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

                    {/* Viewfinder Guide Overlay */}
                    <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-between p-6">
                      <div className="w-full text-center">
                        <span className="inline-block px-3 py-1 rounded-full bg-black/60 backdrop-blur-xs text-[11px] font-bold text-amber-300 border border-amber-500/30">
                          Posisikan Surat Jalan atau Formulir Inspeksi di dalam bingkai
                        </span>
                      </div>

                      {/* Optical Framing Marks */}
                      <div className="relative w-full max-w-md h-52 sm:h-64 border-2 border-dashed border-amber-400/70 rounded-xl flex items-center justify-center shadow-[0_0_0_9999px_rgba(0,0,0,0.35)]">
                        <div className="absolute top-0 left-0 w-4 h-4 border-t-4 border-l-4 border-amber-400 -mt-1 -ml-1 rounded-tl" />
                        <div className="absolute top-0 right-0 w-4 h-4 border-t-4 border-r-4 border-amber-400 -mt-1 -mr-1 rounded-tr" />
                        <div className="absolute bottom-0 left-0 w-4 h-4 border-b-4 border-l-4 border-amber-400 -mb-1 -ml-1 rounded-bl" />
                        <div className="absolute bottom-0 right-0 w-4 h-4 border-b-4 border-r-4 border-amber-400 -mb-1 -mr-1 rounded-br" />
                        <span className="text-[10px] uppercase font-mono tracking-widest text-white/50 bg-black/40 px-2 py-0.5 rounded">
                          AKK DOCUMENT OCR AREA
                        </span>
                      </div>

                      <div className="text-[11px] text-slate-300 bg-black/60 backdrop-blur-xs px-2.5 py-1 rounded-lg">
                        Pastikan teks, nomor nota, dan stempel terlihat tajam
                      </div>
                    </div>

                    {/* Camera Control Float Buttons */}
                    <div className="absolute top-3 right-3 flex items-center gap-2 z-20">
                      {hasTorch && (
                        <button
                          type="button"
                          onClick={toggleTorch}
                          className={`p-2 rounded-xl backdrop-blur-md transition cursor-pointer ${
                            isTorchOn ? 'bg-amber-500 text-slate-950' : 'bg-black/60 text-white hover:bg-black/80'
                          }`}
                          title="Senter / Flash"
                        >
                          {isTorchOn ? <Zap className="w-4 h-4" /> : <ZapOff className="w-4 h-4" />}
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={switchCamera}
                        className="p-2 rounded-xl bg-black/60 hover:bg-black/80 text-white backdrop-blur-md transition cursor-pointer"
                        title="Putar Kamera Depan / Belakang"
                      >
                        <SwitchCamera className="w-4 h-4" />
                      </button>
                    </div>

                    {/* Bottom Shutter Capture Button */}
                    <div className="absolute bottom-4 left-0 right-0 flex items-center justify-center gap-4 z-20">
                      <button
                        type="button"
                        onClick={capturePhoto}
                        className="w-16 h-16 rounded-full bg-amber-500 hover:bg-amber-400 text-slate-950 flex items-center justify-center p-1.5 shadow-2xl transition active:scale-95 cursor-pointer ring-4 ring-black/40"
                        title="Ambil Foto Dokumen"
                      >
                        <div className="w-12 h-12 rounded-full border-2 border-slate-950 flex items-center justify-center">
                          <Camera className="w-6 h-6" />
                        </div>
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* MODE B: FILE UPLOAD */}
            {mode === 'upload' && (
              <div
                onClick={() => fileInputRef.current?.click()}
                className="flex-1 min-h-[300px] border-2 border-dashed border-slate-700 hover:border-amber-500 rounded-xl bg-slate-950/70 p-8 flex flex-col items-center justify-center text-center gap-3 transition cursor-pointer hover:bg-slate-950 group"
              >
                <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 group-hover:scale-110 transition-transform">
                  <Upload className="w-7 h-7" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-white">Klik untuk Memilih Foto Dokumen</h4>
                  <p className="text-xs text-slate-400 mt-1 max-w-sm">
                    Pilih file gambar JPEG, PNG, atau WebP dari perangkat Anda (Surat Jalan, Lembar Checklist, atau Nota).
                  </p>
                </div>
                <span className="text-[10px] font-mono font-bold text-amber-400 bg-amber-500/10 px-2.5 py-1 rounded-full border border-amber-500/30 mt-2">
                  Mendukung Gambar Kamera Ponsel &amp; Scanner
                </span>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFileUpload}
                  className="hidden"
                />
                <input
                  ref={cameraInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </div>
            )}

            {/* MODE C: DEMO SAMPLES */}
            {mode === 'sample' && (
              <div className="flex-1 min-h-[300px] flex flex-col justify-center gap-3">
                <div className="text-xs text-slate-400 text-center mb-1">
                  Pilih salah satu sampel formulir simulasi untuk menguji sistem OCR tanpa harus memotret:
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => loadDemoSample('slip')}
                    className="p-4 rounded-xl bg-slate-950 border border-slate-800 hover:border-cyan-500 text-left transition cursor-pointer hover:scale-[1.01] group space-y-2"
                  >
                    <div className="flex items-center gap-2 text-cyan-400 font-bold text-xs">
                      <FileCheck2 className="w-4 h-4" />
                      <span>Sampel 1: Surat Jalan (Delivery Slip)</span>
                    </div>
                    <p className="text-[11px] text-slate-300">
                      Surat Jalan PO Toko Mahkota Jaya Banyuwangi. Pengemudi: Ach Taufiq, Truk P 8848 U (Canter), Muatan 280 Box.
                    </p>
                    <span className="inline-block text-[10px] font-bold text-cyan-300 bg-cyan-500/10 px-2 py-0.5 rounded">
                      Gunakan Sampel Ini &rarr;
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => loadDemoSample('inspection')}
                    className="p-4 rounded-xl bg-slate-950 border border-slate-800 hover:border-amber-500 text-left transition cursor-pointer hover:scale-[1.01] group space-y-2"
                  >
                    <div className="flex items-center gap-2 text-amber-400 font-bold text-xs">
                      <ClipboardCheck className="w-4 h-4" />
                      <span>Sampel 2: Formulir Inspeksi Harian</span>
                    </div>
                    <p className="text-[11px] text-slate-300">
                      Checklist pra-jalan 18 titik armada Hino Double P 9281 VA. Pengemudi: Zainul Agustiar. Rute Lintas Jawa-Bali.
                    </p>
                    <span className="inline-block text-[10px] font-bold text-amber-300 bg-amber-500/10 px-2 py-0.5 rounded">
                      Gunakan Sampel Ini &rarr;
                    </span>
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* STEP 2: REVIEW & VERIFY EXTRACTED METADATA */}
        {step === 'review' && (
          <div className="flex-1 overflow-y-auto p-4 sm:p-5 flex flex-col md:flex-row gap-5">
            {/* Left: Captured Image Preview */}
            <div className="w-full md:w-5/12 flex flex-col gap-3">
              <div className="relative rounded-xl overflow-hidden border border-slate-800 bg-slate-950 aspect-3/4 max-h-[380px] flex items-center justify-center">
                {capturedImage && (
                  <img
                    src={capturedImage}
                    alt="Pratinjau Dokumen"
                    className="w-full h-full object-contain"
                  />
                )}
                {isProcessing && (
                  <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-xs flex flex-col items-center justify-center gap-2 text-center p-4">
                    <RefreshCw className="w-8 h-8 text-amber-400 animate-spin" />
                    <span className="font-bold text-white text-xs">Menganalisis Dokumen dengan AI OCR...</span>
                    <span className="text-[10px] text-slate-400">Mengekstrak nomor surat, plat truk, supir, dan muatan</span>
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setStep('capture');
                    startCamera(facingMode);
                  }}
                  className="flex-1 py-1.5 px-3 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Foto Ulang</span>
                </button>
                <div className="text-[11px] text-slate-400 bg-slate-950 px-2.5 py-1.5 rounded-lg border border-slate-800 font-mono">
                  Confidence: {Math.round(confidenceScore * 100)}%
                </div>
              </div>
            </div>

            {/* Right: Extracted Metadata Form */}
            <div className="w-full md:w-7/12 flex flex-col gap-3.5">
              <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                <div className="flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-amber-400" />
                  <span className="font-bold text-white text-xs">Hasil Ekstraksi &amp; Indeks Pencarian</span>
                </div>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  Terbaca Otomatis
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                {/* Document Type */}
                <div>
                  <label className="text-[11px] font-semibold text-slate-400 block mb-1">Jenis Dokumen:</label>
                  <select
                    value={documentType}
                    onChange={(e) => setDocumentType(e.target.value as ScannedDocumentType)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-slate-200 text-xs font-semibold focus:border-amber-500 outline-none"
                  >
                    <option value="delivery_slip">Surat Jalan (Delivery Slip)</option>
                    <option value="inspection_form">Formulir Inspeksi Armada (Pre-Trip)</option>
                    <option value="service_order">Formulir Service / SPK Bengkel</option>
                    <option value="fuel_receipt">Nota / Bukti Pengisian BBM</option>
                    <option value="other">Dokumen Lainnya</option>
                  </select>
                </div>

                {/* Document Number */}
                <div>
                  <label className="text-[11px] font-semibold text-slate-400 block mb-1">No. Dokumen / Ref:</label>
                  <input
                    type="text"
                    value={documentNumber}
                    onChange={(e) => setDocumentNumber(e.target.value)}
                    placeholder="Contoh: SJ-AKK/2026/10/8812"
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-white text-xs font-mono font-bold focus:border-amber-500 outline-none"
                  />
                </div>

                {/* Date */}
                <div>
                  <label className="text-[11px] font-semibold text-slate-400 block mb-1">Tanggal Dokumen:</label>
                  <input
                    type="date"
                    value={documentDate}
                    onChange={(e) => setDocumentDate(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-slate-200 text-xs font-semibold focus:border-amber-500 outline-none"
                  />
                </div>

                {/* Vehicle Plate */}
                <div>
                  <label className="text-[11px] font-semibold text-slate-400 block mb-1">Plat Truk Armada:</label>
                  <select
                    value={vehiclePlate}
                    onChange={(e) => setVehiclePlate(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-emerald-400 text-xs font-mono font-bold focus:border-amber-500 outline-none"
                  >
                    {registeredFleets.map(f => (
                      <option key={f.id} value={f.plateNumber}>
                        {f.plateNumber} ({f.vehicleType})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Driver Name */}
                <div>
                  <label className="text-[11px] font-semibold text-slate-400 block mb-1">Pengemudi / Petugas:</label>
                  <input
                    type="text"
                    value={driverName}
                    onChange={(e) => setDriverName(e.target.value)}
                    placeholder="Nama Supir"
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-slate-200 text-xs font-semibold focus:border-amber-500 outline-none"
                  />
                </div>

                {/* Destination / Store */}
                <div>
                  <label className="text-[11px] font-semibold text-slate-400 block mb-1">Tujuan / Toko Mitra:</label>
                  <input
                    type="text"
                    value={destinationOrStore}
                    onChange={(e) => setDestinationOrStore(e.target.value)}
                    placeholder="Toko Mahkota Jaya / Rute Jawa-Bali"
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-slate-200 text-xs font-semibold focus:border-amber-500 outline-none"
                  />
                </div>
              </div>

              {/* Cargo / Items summary */}
              <div className="text-xs">
                <label className="text-[11px] font-semibold text-slate-400 block mb-1">
                  Rincian Muatan / Poin Checklist Inspeksi:
                </label>
                <input
                  type="text"
                  value={cargoSummary}
                  onChange={(e) => setCargoSummary(e.target.value)}
                  placeholder="Karton Box Master Corrugated / Pemeriksaan 18 Titik"
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-slate-200 text-xs focus:border-amber-500 outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <label className="text-[11px] font-semibold text-slate-400 block mb-1">Kuantitas / Tonase / Hasil:</label>
                  <input
                    type="text"
                    value={quantityOrWeight}
                    onChange={(e) => setQuantityOrWeight(e.target.value)}
                    placeholder="280 Box (2.4 Ton) / Lulus 18/18"
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-slate-200 text-xs focus:border-amber-500 outline-none"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-slate-400 block mb-1">Status Verifikasi:</label>
                  <select
                    value={verificationStatus}
                    onChange={(e) => setVerificationStatus(e.target.value as any)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-amber-300 text-xs font-bold focus:border-amber-500 outline-none"
                  >
                    <option value="verified">Terverifikasi (Valid)</option>
                    <option value="pending_review">Perlu Tinjauan</option>
                  </select>
                </div>
              </div>

              {/* Notes */}
              <div className="text-xs">
                <label className="text-[11px] font-semibold text-slate-400 block mb-1">Catatan Tambahan / Tanda Tangan:</label>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Catatan barang, tanda tangan stempel, atau temuan fisik..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-slate-300 text-xs focus:border-amber-500 outline-none resize-none"
                />
              </div>
            </div>
          </div>
        )}

        {/* Modal Footer Controls */}
        <div className="px-5 py-3.5 bg-slate-950 border-t border-slate-800 flex items-center justify-between shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs transition cursor-pointer"
          >
            Batal
          </button>

          {step === 'review' ? (
            <button
              type="button"
              onClick={handleSaveDocumentLog}
              className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs transition active:scale-95 flex items-center gap-1.5 shadow-md cursor-pointer"
            >
              <Check className="w-4 h-4" />
              <span>Simpan ke Log Dokumen Digital</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => {
                if (mode === 'upload') {
                  fileInputRef.current?.click();
                } else if (mode === 'camera') {
                  capturePhoto();
                } else {
                  loadDemoSample('slip');
                }
              }}
              className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs transition active:scale-95 flex items-center gap-1.5 shadow-md cursor-pointer"
            >
              <Camera className="w-4 h-4" />
              <span>{mode === 'upload' ? 'Pilih File' : mode === 'sample' ? 'Gunakan Sampel' : 'Ambil Foto'}</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
