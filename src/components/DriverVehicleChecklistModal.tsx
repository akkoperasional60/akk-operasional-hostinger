import React, { useState } from 'react';
import {
  ShieldCheck,
  X,
  CheckCircle2,
  AlertTriangle,
  Camera,
  Truck,
  Gauge,
  Fuel,
  Save,
  Check,
  FileText,
  Clock,
  RotateCcw,
  Sparkles
} from 'lucide-react';
import {
  DriverVehicleChecklist,
  VehicleChecklistItem,
  ChecklistItemCategory,
  ChecklistItemStatus,
  OverallChecklistStatus
} from '../types';
import { driverChecklistService } from '../services/driverChecklistService';
import { useToast } from '../context/ToastContext';
import {
  ExifMetadataBadge,
  ExifTimestampMetadata,
  createExifMetadataFromDate,
  extractExifFromFile,
  drawExifMetadataOnCanvas
} from '../utils/exifMetadata';

interface DriverVehicleChecklistModalProps {
  isOpen: boolean;
  onClose: () => void;
  driverId: string;
  driverName: string;
  fleetId: string;
  plateNumber: string;
  vehicleType: string;
  initialChecklist?: DriverVehicleChecklist | null;
  defaultInspectionType?: 'pre_trip' | 'post_trip';
  canSelectPostTrip?: boolean;
  onSaved?: (saved: DriverVehicleChecklist) => void;
  onOpenDeviceCamera?: () => void;
}

export const DriverVehicleChecklistModal: React.FC<DriverVehicleChecklistModalProps> = ({
  isOpen,
  onClose,
  driverId,
  driverName,
  fleetId,
  plateNumber,
  vehicleType,
  initialChecklist,
  defaultInspectionType,
  canSelectPostTrip = false,
  onSaved,
  onOpenDeviceCamera
}) => {
  const { addNotification } = useToast();

  const [activeCategory, setActiveCategory] = useState<ChecklistItemCategory | 'all'>('all');
  const [checklist, setChecklist] = useState<DriverVehicleChecklist>(() => {
    if (initialChecklist) {
      const syncedItems = driverChecklistService.syncItemsWithStandard(initialChecklist.items);
      const { overallStatus, passedCount, issueCount } = driverChecklistService.calculateStatus(syncedItems);
      return {
        ...initialChecklist,
        items: syncedItems,
        overallStatus,
        passedCount,
        issueCount
      };
    }
    const fresh = driverChecklistService.createNewChecklistTemplate(
      driverId,
      driverName,
      fleetId,
      plateNumber,
      vehicleType
    );
    if (defaultInspectionType) fresh.inspectionType = defaultInspectionType;
    return fresh;
  });

  const [notes, setNotes] = useState<string>(initialChecklist?.notes || '');
  const [odometerInput, setOdometerInput] = useState<string>(
    initialChecklist && initialChecklist.odometerKm > 0 ? String(initialChecklist.odometerKm) : ''
  );
  const [fuelPercent, setFuelPercent] = useState<number>(initialChecklist?.fuelLevelPercent || 80);
  const [inspectionType, setInspectionType] = useState<'pre_trip' | 'post_trip'>(
    defaultInspectionType || initialChecklist?.inspectionType || 'pre_trip'
  );
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [photoUrl, setPhotoUrl] = useState<string | null>(initialChecklist?.photoEvidenceUrl || null);
  const [photoExifMap, setPhotoExifMap] = useState<Record<string, ExifTimestampMetadata>>({});
  const cameraInputRef = React.useRef<HTMLInputElement>(null);
  const odometerRef = React.useRef<HTMLInputElement>(null);

  // Built-in Live WebRTC Camera State (Direct Camera Access instead of file import)
  // cameraTarget: 'evidence' for main odometer/armada photo, or item.id for 'Foto Oli Mesin & Air Radiator' / 'Foto Minyak Rem'
  const [cameraTarget, setCameraTarget] = useState<'evidence' | string>('evidence');
  const [isLiveCameraOpen, setIsLiveCameraOpen] = useState<boolean>(false);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [cameraFacingMode, setCameraFacingMode] = useState<'environment' | 'user'>('environment');
  const [liveCameraError, setLiveCameraError] = useState<string | null>(null);
  const liveVideoRef = React.useRef<HTMLVideoElement>(null);

  const stopLiveCamera = React.useCallback(() => {
    if (cameraStream) {
      cameraStream.getTracks().forEach(track => {
        try {
          track.stop();
        } catch {
          // ignore
        }
      });
      setCameraStream(null);
    }
    setIsLiveCameraOpen(false);
  }, [cameraStream]);

  const startLiveCamera = async (
    mode: 'environment' | 'user' = cameraFacingMode,
    target: 'evidence' | string = cameraTarget
  ) => {
    setCameraTarget(target);
    setLiveCameraError(null);
    setIsLiveCameraOpen(true);
    if (cameraStream) {
      cameraStream.getTracks().forEach(t => {
        try { t.stop(); } catch {}
      });
    }
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Kamera langsung tidak didukung di browser ini.');
      }
      let stream: MediaStream | null = null;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: mode }, width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false
        });
      } catch {
        stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: false
        });
      }
      setCameraStream(stream);
      if (liveVideoRef.current) {
        liveVideoRef.current.srcObject = stream;
        await liveVideoRef.current.play().catch(() => {});
      }
    } catch (err: any) {
      setLiveCameraError(
        err?.message || 'Akses kamera ditolak oleh perangkat. Izinkan kamera pada browser atau gunakan Kamera HP.'
      );
    }
  };

  React.useEffect(() => {
    if (isLiveCameraOpen && liveVideoRef.current && cameraStream) {
      liveVideoRef.current.srcObject = cameraStream;
      liveVideoRef.current.muted = true;
      liveVideoRef.current.play().catch(() => {});
    }
  }, [isLiveCameraOpen, cameraStream, cameraTarget]);

  React.useEffect(() => {
    if (!isOpen) {
      stopLiveCamera();
    }
  }, [isOpen, stopLiveCamera]);

  const applyCapturedDataUrl = (
    dataUrl: string,
    target: 'evidence' | string,
    exifMeta?: ExifTimestampMetadata
  ) => {
    const resolvedExif = exifMeta || createExifMetadataFromDate(new Date(), 'CAMERA_CAPTURE_SENSOR');
    setPhotoExifMap(prev => ({ ...prev, [target]: resolvedExif }));
    if (target === 'evidence') {
      setPhotoUrl(dataUrl);
    } else {
      setChecklist(prev => {
        const updatedItems = prev.items.map(item =>
          item.id === target ? { ...item, photoUrl: dataUrl, status: 'ok' as const } : item
        );
        const { overallStatus, passedCount, issueCount } = driverChecklistService.calculateStatus(updatedItems);
        return {
          ...prev,
          items: updatedItems,
          overallStatus,
          passedCount,
          issueCount
        };
      });
      if (!photoUrl) {
        setPhotoUrl(dataUrl);
        setPhotoExifMap(prev => ({ ...prev, evidence: resolvedExif }));
      }
    }
  };

  const captureFromLiveVideo = () => {
    if (!liveVideoRef.current) return;
    const video = liveVideoRef.current;
    const w = video.videoWidth || 1280;
    const h = video.videoHeight || 720;
    const canvas = document.createElement('canvas');
    canvas.width = 1280;
    canvas.height = 720;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    if (cameraFacingMode === 'user') {
      ctx.translate(1280, 0);
      ctx.scale(-1, 1);
    }
    ctx.drawImage(video, 0, 0, w, h, 0, 0, 1280, 720);
    if (cameraFacingMode === 'user') {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
    }

    const exifMeta = createExifMetadataFromDate(new Date(), 'CAMERA_CAPTURE_SENSOR');
    drawExifMetadataOnCanvas(ctx, 1280, 720, exifMeta);

    const targetItem = cameraTarget !== 'evidence' ? checklist.items.find(i => i.id === cameraTarget) : null;
    const labelTitle = targetItem ? targetItem.name.toUpperCase() : 'INSPEKSI ARMADA / ODOMETER';

    // Watermark
    ctx.fillStyle = 'rgba(2, 6, 23, 0.85)';
    ctx.fillRect(0, 620, 1280, 100);
    ctx.fillStyle = '#06b6d4';
    ctx.fillRect(0, 620, 1280, 3);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 20px system-ui, sans-serif';
    ctx.fillText(`${labelTitle}: ${plateNumber} (${vehicleType}) | DRIVER: ${driverName}`, 20, 655);
    ctx.fillStyle = '#f59e0b';
    ctx.font = 'bold 16px monospace';
    ctx.fillText(
      `EXIF DateTimeOriginal: ${exifMeta.DateTimeOriginal}.${exifMeta.SubSecTimeOriginal} (${exifMeta.OffsetTimeOriginal}) | STATUS: ${inspectionType === 'pre_trip' ? 'PRA-JALAN' : 'PASCA-JALAN'}`,
      20,
      690
    );

    applyCapturedDataUrl(canvas.toDataURL('image/jpeg', 0.85), cameraTarget, exifMeta);
    stopLiveCamera();
  };

  const handlePhotoCapture = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const activeTarget = cameraTarget;
    const targetItem = activeTarget !== 'evidence' ? checklist.items.find(i => i.id === activeTarget) : null;
    const labelTitle = targetItem ? targetItem.name.toUpperCase() : 'INSPEKSI ARMADA / ODOMETER';
    extractExifFromFile(file).then(exifMeta => {
      const reader = new FileReader();
      reader.onload = () => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          canvas.width = 1280;
          canvas.height = 720;
          const ctx = canvas.getContext('2d');
          if (!ctx) return;
          ctx.drawImage(img, 0, 0, 1280, 720);
          drawExifMetadataOnCanvas(ctx, 1280, 720, exifMeta);
          // Watermark
          ctx.fillStyle = 'rgba(2, 6, 23, 0.85)';
          ctx.fillRect(0, 620, 1280, 100);
          ctx.fillStyle = '#06b6d4';
          ctx.fillRect(0, 620, 1280, 3);
          ctx.fillStyle = '#ffffff';
          ctx.font = 'bold 20px system-ui, sans-serif';
          ctx.fillText(`${labelTitle}: ${plateNumber} (${vehicleType}) | DRIVER: ${driverName}`, 20, 655);
          ctx.fillStyle = '#f59e0b';
          ctx.font = 'bold 16px monospace';
          ctx.fillText(
            `EXIF DateTimeOriginal: ${exifMeta.DateTimeOriginal}.${exifMeta.SubSecTimeOriginal} (${exifMeta.OffsetTimeOriginal}) | STATUS: ${inspectionType === 'pre_trip' ? 'PRA-JALAN' : 'PASCA-JALAN'}`,
            20,
            690
          );

          applyCapturedDataUrl(canvas.toDataURL('image/jpeg', 0.85), activeTarget, exifMeta);
          stopLiveCamera();
        };
        img.src = reader.result as string;
      };
      reader.readAsDataURL(file);
    });
    e.target.value = '';
  };

  const wasOpenRef = React.useRef<boolean>(false);
  const lastInitIdRef = React.useRef<string>('');
  const DRAFT_KEY = 'akk_checklist_modal_draft_v1';

  // Sync state ONLY when modal opens from closed state or when initialChecklist ID explicitly changes
  React.useEffect(() => {
    if (!isOpen) {
      wasOpenRef.current = false;
      return;
    }
    const currentInitId = initialChecklist?.id || 'fresh';
    if (wasOpenRef.current && lastInitIdRef.current === currentInitId) {
      // Update metadata fields (driverId, driverName, fleetId, plateNumber) without wiping user's odometer/photos/items
      setChecklist(prev => ({
        ...prev,
        driverId: driverId || prev.driverId,
        driverName: driverName || prev.driverName,
        fleetId: fleetId || prev.fleetId,
        plateNumber: plateNumber || prev.plateNumber,
        vehicleType: vehicleType || prev.vehicleType
      }));
      return;
    }

    wasOpenRef.current = true;
    lastInitIdRef.current = currentInitId;

    // Check if there is a recent in-progress draft in sessionStorage (e.g., if Android WebView reloaded during camera capture)
    try {
      const rawDraft = typeof sessionStorage !== 'undefined' ? sessionStorage.getItem(DRAFT_KEY) : null;
      if (rawDraft) {
        const draft = JSON.parse(rawDraft);
        if (draft && draft.checklist && (draft.plateNumber === plateNumber || draft.driverId === driverId)) {
          setChecklist(draft.checklist);
          setNotes(draft.notes || '');
          setOdometerInput(draft.odometerInput || '');
          setFuelPercent(draft.fuelPercent || 80);
          setInspectionType(draft.inspectionType || defaultInspectionType || 'pre_trip');
          setPhotoUrl(draft.photoUrl || null);
          return;
        }
      }
    } catch {}

    if (initialChecklist) {
      const syncedItems = driverChecklistService.syncItemsWithStandard(initialChecklist.items);
      const { overallStatus, passedCount, issueCount } = driverChecklistService.calculateStatus(syncedItems);
      setChecklist({
        ...initialChecklist,
        items: syncedItems,
        overallStatus,
        passedCount,
        issueCount
      });
      setNotes(initialChecklist.notes || '');
      setOdometerInput(initialChecklist.odometerKm > 0 ? String(initialChecklist.odometerKm) : '');
      setFuelPercent(initialChecklist.fuelLevelPercent || 80);
      const nextType = defaultInspectionType || initialChecklist.inspectionType || 'pre_trip';
      setInspectionType(!canSelectPostTrip && nextType === 'post_trip' ? 'pre_trip' : nextType);
      setPhotoUrl(initialChecklist.photoEvidenceUrl || null);
    } else {
      const fresh = driverChecklistService.createNewChecklistTemplate(
        driverId,
        driverName,
        fleetId,
        plateNumber,
        vehicleType
      );
      const nextType = defaultInspectionType || 'pre_trip';
      const allowedType = !canSelectPostTrip && nextType === 'post_trip' ? 'pre_trip' : nextType;
      fresh.inspectionType = allowedType;
      setChecklist(fresh);
      setOdometerInput('');
      setInspectionType(allowedType);
      setPhotoUrl(null);
    }
  }, [isOpen, initialChecklist, driverId, fleetId, plateNumber, vehicleType, driverName, defaultInspectionType, canSelectPostTrip]);

  // Persist draft in sessionStorage while modal is open so native camera reloads don't lose progress
  React.useEffect(() => {
    if (!isOpen) return;
    try {
      if (typeof sessionStorage !== 'undefined') {
        sessionStorage.setItem(
          DRAFT_KEY,
          JSON.stringify({
            driverId,
            plateNumber,
            checklist,
            notes,
            odometerInput,
            fuelPercent,
            inspectionType,
            photoUrl
          })
        );
      }
    } catch {}
  }, [isOpen, driverId, plateNumber, checklist, notes, odometerInput, fuelPercent, inspectionType, photoUrl]);

  if (!isOpen) return null;

  const isPostTripUnlocked = Boolean(canSelectPostTrip || defaultInspectionType === 'post_trip');

  const handleItemStatusChange = (itemId: string, newStatus: ChecklistItemStatus) => {
    const updatedItems = checklist.items.map(item => {
      if (item.id === itemId) {
        return { ...item, status: newStatus };
      }
      return item;
    });

    const { overallStatus, passedCount, issueCount } = driverChecklistService.calculateStatus(updatedItems);
    setChecklist({
      ...checklist,
      items: updatedItems,
      overallStatus,
      passedCount,
      issueCount
    });
  };

  const handleMarkAllOk = () => {
    const updatedItems = checklist.items.map(item => ({
      ...item,
      status: 'ok' as const
    }));
    const { overallStatus, passedCount, issueCount } = driverChecklistService.calculateStatus(updatedItems);
    setChecklist({
      ...checklist,
      items: updatedItems,
      overallStatus,
      passedCount,
      issueCount
    });
    addNotification('checker', 'Semua Ditandai OK', `Seluruh ${updatedItems.length} poin pemeriksaan ditandai Lolos (OK).`);
  };

  const handleSave = () => {
    const parsedOdo = Number(odometerInput.trim());
    if (!odometerInput.trim() || isNaN(parsedOdo) || parsedOdo <= 0) {
      addNotification(
        'sla_warning',
        'Isian Odometer (KM) Wajib Diisi',
        'Silakan ketik angka Odometer (KM) armada terlebih dahulu sebelum menyimpan checklist.'
      );
      odometerRef.current?.focus();
      return;
    }

    setIsSubmitting(true);
    const { overallStatus, passedCount, issueCount } = driverChecklistService.calculateStatus(checklist.items);
    
    const finalChecklist: DriverVehicleChecklist = {
      ...checklist,
      odometerKm: parsedOdo,
      fuelLevelPercent: fuelPercent,
      inspectionType,
      notes,
      photoEvidenceUrl: photoUrl || undefined,
      overallStatus,
      passedCount,
      issueCount,
      driverSignature: `${driverName} (Tervalidasi Digital)`,
      synced: true
    };

    const success = driverChecklistService.saveChecklist(finalChecklist);
    setIsSubmitting(false);

    if (success) {
      addNotification(
        'checker',
        'Checklist Armada Tersimpan',
        `Inspeksi ${inspectionType === 'pre_trip' ? 'Pra-Jalan (Pagi)' : 'Pasca-Jalan (Pulang)'} ${plateNumber} berhasil dicatat (${passedCount} Lolos, ${issueCount} Perhatian).`
      );
      setNotes('');
      setOdometerInput('');
      setPhotoUrl(null);
      try {
        if (typeof sessionStorage !== 'undefined') {
          sessionStorage.removeItem(DRAFT_KEY);
        }
      } catch {}
      if (cameraInputRef.current) {
        cameraInputRef.current.value = '';
      }
      if (onSaved) onSaved(finalChecklist);
      onClose();
    } else {
      addNotification('checker', 'Penyimpanan Gagal', 'Gagal menyimpan data checklist ke memori lokal.');
    }
  };

  const categories: { key: ChecklistItemCategory | 'all'; label: string }[] = [
    { key: 'all', label: `Semua (${checklist.items.length})` },
    { key: 'mesin_fluida', label: 'Oli & Radiator' },
    { key: 'lampu_listrik', label: 'Air Accu' },
    { key: 'rem_roda', label: 'Rem & Ban' },
    { key: 'fisik_dokumen', label: 'Kabin & Inventaris' }
  ];

  const filteredItems = checklist.items.filter(item => {
    if (activeCategory === 'all') return true;
    return item.category === activeCategory;
  });

  const renderInlineCameraBox = (targetId: 'evidence' | string, buttonTitle: string) => (
    <div className="rounded-xl overflow-hidden border border-cyan-500/50 bg-slate-950 space-y-2 p-2.5 mt-2">
      <div className="flex items-center justify-between text-[11px] font-bold text-slate-200 px-1">
        <span className="flex items-center gap-1.5">
          <Camera className="w-3.5 h-3.5 text-cyan-400 animate-pulse" />
          <span>Kamera Langsung Aktif ({plateNumber})</span>
        </span>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => {
              const nextMode = cameraFacingMode === 'environment' ? 'user' : 'environment';
              setCameraFacingMode(nextMode);
              startLiveCamera(nextMode, targetId);
            }}
            className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-[10px] font-bold flex items-center gap-1 cursor-pointer"
          >
            <RotateCcw className="w-3 h-3" />
            <span>Balik Kamera</span>
          </button>
          <button
            type="button"
            onClick={stopLiveCamera}
            className="px-2 py-1 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 text-[10px] font-bold cursor-pointer"
          >
            Tutup
          </button>
        </div>
      </div>

      {liveCameraError ? (
        <div className="p-3 rounded-xl bg-slate-900 border border-amber-500/40 text-center space-y-2">
          <p className="text-[11px] text-amber-300 font-semibold">{liveCameraError}</p>
          <div className="flex items-center justify-center gap-2">
            <button
              type="button"
              onClick={() => startLiveCamera(cameraFacingMode, targetId)}
              className="px-3 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-[11px] cursor-pointer"
            >
              Coba Buka Kamera Lagi
            </button>
            <button
              type="button"
              onClick={() => {
                setCameraTarget(targetId);
                cameraInputRef.current?.click();
              }}
              className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-[11px] border border-slate-700 cursor-pointer"
            >
              Buka Kamera Bawaan HP
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className="relative rounded-xl overflow-hidden bg-black aspect-video flex items-center justify-center">
            <video
              ref={liveVideoRef}
              playsInline
              muted
              autoPlay
              className="w-full h-full object-cover"
            />
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={captureFromLiveVideo}
              className="flex-1 py-2.5 px-3 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-black text-xs flex items-center justify-center gap-1.5 shadow-md cursor-pointer active:scale-95 transition"
            >
              <Camera className="w-4 h-4" />
              <span>{buttonTitle}</span>
            </button>
          </div>
        </>
      )}
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 overflow-y-auto animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden my-auto">
        
        {/* Modal Top Header */}
        <div className="bg-slate-950 p-3.5 px-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <div>
              <div className="text-xs font-black text-white uppercase tracking-wide">
                Checklist Inspeksi Armada PT AKK
              </div>
              <div className="text-[10px] text-slate-400 flex items-center gap-2">
                <span>{plateNumber} ({vehicleType})</span>
                <span>·</span>
                <span>Driver: {driverName}</span>
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Content Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs">
          
          {/* Header Summary & Pre-Trip/Post-Trip Switch */}
          <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 space-y-3">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              {/* Inspection Type Selector: Pra-Jalan Wajib Sebelum Jalan, Pasca-Jalan Tidak Bisa Diklik Sebelum Tiba di Gudang */}
              <div className="flex items-center p-0.5 bg-slate-900 rounded-lg border border-slate-800">
                <button
                  type="button"
                  onClick={() => setInspectionType('pre_trip')}
                  className={`px-3 py-1 rounded-md text-[11px] font-semibold transition cursor-pointer ${
                    inspectionType === 'pre_trip' ? 'bg-amber-500 text-slate-950 shadow font-bold' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Pra-Jalan (Pagi)
                </button>
                <button
                  type="button"
                  disabled={!isPostTripUnlocked}
                  onClick={() => {
                    if (!isPostTripUnlocked) return;
                    setInspectionType('post_trip');
                  }}
                  title={
                    isPostTripUnlocked
                      ? 'Pilih Checklist Pasca-Jalan (Pulang)'
                      : 'Terkunci: Checklist Pasca-Jalan baru dapat dipilih setelah klik Konfirmasi Tiba di Gudang'
                  }
                  className={`px-3 py-1 rounded-md text-[11px] font-semibold transition ${
                    inspectionType === 'post_trip'
                      ? 'bg-amber-500 text-slate-950 shadow font-bold cursor-pointer'
                      : isPostTripUnlocked
                      ? 'text-slate-400 hover:text-white cursor-pointer'
                      : 'text-slate-600 opacity-50 cursor-not-allowed'
                  }`}
                >
                  Pasca-Jalan (Pulang) {!isPostTripUnlocked ? '🔒' : ''}
                </button>
              </div>

              {/* Status Badge */}
              <div className="flex items-center gap-2">
                <span className={`text-[11px] font-bold px-2 py-0.5 rounded-lg ${
                  checklist.overallStatus === 'passed' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' :
                  checklist.overallStatus === 'warning' ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' :
                  'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                }`}>
                  {checklist.overallStatus === 'passed' ? 'SIAP JALAN' :
                   checklist.overallStatus === 'warning' ? 'PERHATIAN' : 'TIDAK LAYAK'}
                </span>
              </div>
            </div>

            {!isPostTripUnlocked && (
              <div className="text-[11px] text-amber-950 dark:text-amber-200 bg-amber-100/90 dark:bg-amber-950/40 border border-amber-400 dark:border-amber-500/40 rounded-xl px-3 py-2 flex items-center gap-2 shadow-2xs">
                <Clock className="w-4 h-4 text-amber-700 dark:text-amber-400 shrink-0" />
                <span className="leading-snug font-medium">
                  <strong className="font-extrabold text-amber-950 dark:text-amber-100">Wajib Pra-Jalan (Pagi)</strong> sebelum berangkat. Opsi <strong className="font-extrabold text-amber-950 dark:text-amber-100">Pasca-Jalan (Pulang)</strong> otomatis terbuka setelah klik <strong className="font-extrabold text-amber-950 dark:text-amber-100">Tiba di Gudang</strong>.
                </span>
              </div>
            )}

            {/* Quick Metrics: Odometer dengan Bayangan (Placeholder, Tidak Langsung Terisi) */}
            <div className="pt-2 border-t border-slate-800/80">
              <div className="bg-slate-900/80 p-2.5 rounded-lg border border-slate-800 space-y-1">
                <div className="text-[10px] text-slate-400 flex items-center justify-between">
                  <span className="flex items-center gap-1 font-semibold text-slate-300">
                    <Gauge className="w-3.5 h-3.5 text-blue-400" />
                    <span>Odometer (KM) Wajib Diisi:</span>
                  </span>
                  <span className="text-[9px] text-amber-400">Ketik sesuai angka di dashboard</span>
                </div>
                <input
                  ref={odometerRef}
                  type="number"
                  min={1}
                  value={odometerInput}
                  onChange={(e) => setOdometerInput(e.target.value)}
                  placeholder="Contoh: 120000 (Masukkan KM Odometer Armada)"
                  className="w-full bg-slate-950 border border-slate-700 rounded px-2.5 py-1.5 text-slate-100 placeholder:text-slate-500 font-mono font-bold text-xs focus:outline-none focus:border-amber-500"
                />
              </div>
            </div>

            {/* Quick action: Tandai Semua Lolos OK */}
            <div className="flex items-center justify-between pt-1">
              <div className="text-[10px] text-slate-400">
                Poin Lolos: <strong className="text-emerald-400">{checklist.passedCount}</strong> / {checklist.items.length} · 
                Kendala: <strong className="text-rose-400">{checklist.issueCount}</strong>
              </div>
              <button
                type="button"
                onClick={handleMarkAllOk}
                className="px-2.5 py-1 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-300 font-bold text-[10px] flex items-center gap-1 transition cursor-pointer"
              >
                <Sparkles className="w-3 h-3" />
                <span>Tandai Semua OK</span>
              </button>
            </div>
          </div>

          {/* Category Tabs (Segmented Buttons) */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
            {categories.map(cat => (
              <button
                key={cat.key}
                type="button"
                onClick={() => setActiveCategory(cat.key)}
                className={`px-2.5 py-1.5 rounded-lg text-[10px] font-semibold whitespace-nowrap transition cursor-pointer ${
                  activeCategory === cat.key
                    ? 'bg-amber-500 text-slate-950 font-bold'
                    : 'bg-slate-800/80 text-slate-400 hover:text-slate-200'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>

          {/* Checklist Items List */}
          <div className="space-y-2">
            {filteredItems.map(item => {
              const isPhotoItem = item.name.toLowerCase().startsWith('foto ');
              return (
                <div
                  key={item.id}
                  className={`p-3 rounded-xl border transition ${
                    item.status === 'issue'
                      ? 'bg-rose-950/20 border-rose-500/40'
                      : item.status === 'ok'
                      ? 'bg-slate-950 border-slate-800/80 hover:border-slate-700'
                      : 'bg-slate-950 border-slate-800/40 text-slate-500'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-0.5 flex-1">
                      <div className="flex items-center gap-1.5">
                        {isPhotoItem && <Camera className="w-3.5 h-3.5 text-cyan-400 shrink-0" />}
                        <span className="font-bold text-slate-200 text-xs">{item.name}</span>
                        {isPhotoItem && item.photoUrl && (
                          <span className="text-[9px] px-1.5 py-0.5 rounded bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 font-bold">
                            Foto Tersimpan
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] text-slate-400 leading-relaxed">{item.description}</p>
                    </div>

                    {/* 2-State Toggle Button Group */}
                    <div className="flex items-center p-0.5 bg-slate-900 rounded-lg border border-slate-800 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleItemStatusChange(item.id, 'ok')}
                        className={`px-2 py-1 rounded-md text-[10px] font-bold transition flex items-center gap-1 ${
                          item.status === 'ok'
                            ? 'bg-emerald-600 text-white shadow-xs'
                            : 'text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        <Check className="w-3 h-3" />
                        <span>OK</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleItemStatusChange(item.id, 'issue')}
                        className={`px-2 py-1 rounded-md text-[10px] font-bold transition flex items-center gap-1 ${
                          item.status === 'issue'
                            ? 'bg-rose-600 text-white shadow-xs'
                            : 'text-slate-400 hover:text-rose-400'
                        }`}
                      >
                        <AlertTriangle className="w-3 h-3" />
                        <span>Ada Kendala</span>
                      </button>
                    </div>
                  </div>

                  {/* Inline Direct Camera Capture for 'Foto Oli Mesin & Air Radiator' and 'Foto Minyak Rem' */}
                  {isPhotoItem && (
                    <div className="mt-2 pt-2 border-t border-slate-800/80">
                      {isLiveCameraOpen && cameraTarget === item.id ? (
                        renderInlineCameraBox(item.id, `Jepret ${item.name} Sekarang`)
                      ) : item.photoUrl ? (
                        <div className="relative rounded-xl overflow-hidden border border-cyan-500/40 bg-slate-900">
                          <img
                            src={item.photoUrl}
                            alt={item.name}
                            className="w-full max-h-40 object-cover"
                          />
                          <div className="absolute bottom-2 right-2 flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => startLiveCamera('environment', item.id)}
                              className="px-2.5 py-1 rounded-lg bg-slate-900/90 text-amber-300 font-bold text-[10px] flex items-center gap-1 border border-amber-500/40 cursor-pointer hover:bg-slate-900"
                            >
                              <Camera className="w-3 h-3" />
                              <span>Foto Ulang</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                const updated = checklist.items.map(i =>
                                  i.id === item.id ? { ...i, photoUrl: undefined } : i
                                );
                                setChecklist({ ...checklist, items: updated });
                              }}
                              className="px-2 py-1 rounded-lg bg-rose-950/90 text-rose-300 font-bold text-[10px] border border-rose-500/40 cursor-pointer hover:bg-rose-900"
                            >
                              Hapus
                            </button>
                          </div>
                          <div className="p-2 bg-slate-950 border-t border-slate-800">
                            <ExifMetadataBadge exif={photoExifMap[item.id]} compact />
                          </div>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => startLiveCamera('environment', item.id)}
                          className="w-full py-2 px-3 rounded-xl border border-dashed border-cyan-500/50 hover:border-cyan-400 bg-slate-900/70 hover:bg-slate-900 text-cyan-300 hover:text-cyan-200 text-[11px] font-bold flex items-center justify-center gap-1.5 cursor-pointer transition active:scale-95"
                        >
                          <Camera className="w-3.5 h-3.5 text-cyan-400" />
                          <span>Buka Kamera &amp; Ambil {item.name}</span>
                        </button>
                      )}
                    </div>
                  )}

                  {/* If issue: Optional input for note */}
                  {item.status === 'issue' && (
                    <div className="mt-2 pt-2 border-t border-rose-500/20">
                      <input
                        type="text"
                        placeholder="Jelaskan temuan kendala fisik / mekanis..."
                        value={item.note || ''}
                        onChange={(e) => {
                          const updated = checklist.items.map(i => i.id === item.id ? { ...i, note: e.target.value } : i);
                          setChecklist({ ...checklist, items: updated });
                        }}
                        className="w-full bg-slate-900 border border-rose-500/40 rounded-lg px-2.5 py-1.5 text-[10px] text-rose-200 placeholder-rose-400/50 focus:outline-none"
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* General Notes */}
          <div className="space-y-1">
            <label className="text-[10px] font-semibold text-slate-300">
              Catatan Tambahan / Rekomendasi Bengkel:
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Contoh: Kondisi mesin dan kelengkapan dokumen siap operasional..."
              className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-amber-500"
            />
          </div>

          {/* Photo Evidence Section (Direct Live WebRTC Camera Access) */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-[10px] font-semibold text-slate-300 flex items-center gap-1.5">
                <Camera className="w-3.5 h-3.5 text-cyan-400" />
                <span>Foto Bukti Fisik / Odometer Armada:</span>
              </label>
              {photoUrl && (
                <button
                  type="button"
                  onClick={() => setPhotoUrl(null)}
                  className="text-[10px] text-rose-400 hover:underline cursor-pointer"
                >
                  Hapus Foto
                </button>
              )}
            </div>

            <input
              ref={cameraInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handlePhotoCapture}
              className="hidden"
            />

            {isLiveCameraOpen && cameraTarget === 'evidence' ? (
              renderInlineCameraBox('evidence', 'Jepret Foto Armada / Odometer Sekarang')
            ) : photoUrl ? (
              <div className="space-y-2">
                <div className="relative rounded-xl overflow-hidden border border-slate-700 bg-slate-950">
                  <img src={photoUrl} alt="Bukti Checklist" className="w-full max-h-48 object-cover" />
                  <button
                    type="button"
                    onClick={() => startLiveCamera('environment', 'evidence')}
                    className="absolute bottom-2 right-2 px-2.5 py-1 rounded-lg bg-slate-900/90 text-amber-300 font-bold text-[10px] flex items-center gap-1 border border-amber-500/40 cursor-pointer hover:bg-slate-900"
                  >
                    <Camera className="w-3 h-3" />
                    <span>Foto Ulang (Kamera Langsung)</span>
                  </button>
                </div>
                <ExifMetadataBadge exif={photoExifMap.evidence} />
              </div>
            ) : (
              <button
                type="button"
                onClick={() => startLiveCamera('environment', 'evidence')}
                className="w-full py-2.5 px-3 rounded-xl border border-dashed border-cyan-500/50 hover:border-cyan-400 bg-slate-950/60 hover:bg-slate-950 text-slate-200 hover:text-white text-xs font-bold flex items-center justify-center gap-2 cursor-pointer transition active:scale-95"
              >
                <Camera className="w-4 h-4 text-cyan-400" />
                <span>Buka Kamera Langsung &amp; Ambil Foto Armada</span>
              </button>
            )}
          </div>
        </div>

        {/* Modal Bottom Actions */}
        <div className="bg-slate-900 p-3 px-4 border-t border-slate-800 flex items-center justify-end">
          <button
            type="button"
            onClick={handleSave}
            disabled={isSubmitting}
            className="w-full py-2.5 px-5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs flex items-center justify-center gap-1.5 shadow-lg shadow-emerald-500/20 transition cursor-pointer"
          >
            <Save className="w-4 h-4" />
            <span>Simpan Checklist</span>
          </button>
        </div>

      </div>
    </div>
  );
};
