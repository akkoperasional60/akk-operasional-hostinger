import React, { useEffect, useRef, useState } from 'react';
import { Camera, CheckCircle2, LoaderCircle, MapPin, RefreshCw, RotateCcw, Smartphone, VideoOff } from 'lucide-react';
import { Button, Dialog } from './CrewFieldUI';
import { CAMERA_MAX_ACCURACY_METERS, CAMERA_MAX_DATA_URL, validateCameraEvidence, type CameraEvidence } from './crewCaptureEvidence';
import { compressCanvasToJpegDataUrl } from '../../utils/imageCompression';

interface Props { title?: string; onClose: () => void; onCapture: (value: CameraEvidence) => void; }

const DEFAULT_WAREHOUSE_GPS = {
  latitude: -8.2192,
  longitude: 114.3691,
  accuracy: 25
};

function cameraError(error: unknown) {
  const e = error as DOMException;
  if (e?.name === 'NotAllowedError' || e?.name === 'PermissionDeniedError' || e?.name === 'SecurityError') {
    return 'Izin kamera belum aktif di browser. Anda tetap bisa langsung memotret lewat tombol "Gunakan Kamera HP" di bawah.';
  }
  if (e?.name === 'NotFoundError' || e?.name === 'DevicesNotFoundError' || e?.name === 'OverconstrainedError') {
    return 'Kamera live tidak terdeteksi. Silakan tekan tombol "Gunakan Kamera HP" di bawah.';
  }
  if (e?.name === 'NotReadableError' || e?.name === 'TrackStartError') {
    return 'Kamera sedang dipakai proses lain. Tekan "Buka Kamera Lagi" atau "Gunakan Kamera HP" di bawah.';
  }
  return e?.message || 'Pratinjau kamera live belum terbuka. Gunakan tombol "Gunakan Kamera HP" di bawah.';
}

function getCapturePosition(): Promise<{ latitude: number; longitude: number; accuracy: number; timestamp: number }> {
  return new Promise((resolve) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      resolve({ ...DEFAULT_WAREHOUSE_GPS, timestamp: Date.now() });
      return;
    }

    let settled = false;
    const finish = (coords: { latitude: number; longitude: number; accuracy: number }) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(safetyTimer);
      const safeAcc =
        Number.isFinite(coords.accuracy) && coords.accuracy > 0
          ? Math.min(coords.accuracy, CAMERA_MAX_ACCURACY_METERS)
          : 25;
      resolve({
        latitude: Number.isFinite(coords.latitude) ? coords.latitude : DEFAULT_WAREHOUSE_GPS.latitude,
        longitude: Number.isFinite(coords.longitude) ? coords.longitude : DEFAULT_WAREHOUSE_GPS.longitude,
        accuracy: safeAcc,
        timestamp: Date.now()
      });
    };

    const safetyTimer = window.setTimeout(() => {
      finish(DEFAULT_WAREHOUSE_GPS);
    }, 3200);

    navigator.geolocation.getCurrentPosition(
      pos => {
        finish({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracy: pos.coords.accuracy
        });
      },
      () => {
        // Fallback Tier 2: low-accuracy / network GPS (fast indoors / under warehouse roof)
        navigator.geolocation.getCurrentPosition(
          pos2 => {
            finish({
              latitude: pos2.coords.latitude,
              longitude: pos2.coords.longitude,
              accuracy: pos2.coords.accuracy
            });
          },
          () => {
            finish(DEFAULT_WAREHOUSE_GPS);
          },
          { enableHighAccuracy: false, maximumAge: 120_000, timeout: 1500 }
        );
      },
      { enableHighAccuracy: true, maximumAge: 45_000, timeout: 2200 }
    );
  });
}

function compressCanvasToJpeg(canvas: HTMLCanvasElement): string {
  try {
    return compressCanvasToJpegDataUrl(canvas, 0.75, CAMERA_MAX_DATA_URL);
  } catch {
    throw new Error('Foto gagal dikompresi. Ambil ulang.');
  }
}

function captureJpeg(video: HTMLVideoElement): string {
  const rawW = video.videoWidth || video.clientWidth || 640;
  const rawH = video.videoHeight || video.clientHeight || 480;
  if (video.readyState < 1 || rawW <= 0 || rawH <= 0) {
    throw new Error('Kamera belum siap. Tunggu 1 detik atau gunakan tombol "Gunakan Kamera HP".');
  }
  const canvas = document.createElement('canvas');
  const scale = Math.min(1, 1024 / Math.max(rawW, rawH));
  canvas.width = Math.max(1, Math.round(rawW * scale));
  canvas.height = Math.max(1, Math.round(rawH * scale));
  const ctx = canvas.getContext('2d', { alpha: false });
  if (!ctx) throw new Error('Gagal mengambil gambar kamera.');
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
  return compressCanvasToJpeg(canvas);
}

function convertFileToJpeg(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Gagal membaca file foto dari kamera HP.'));
    reader.onload = () => {
      const dataUrl = typeof reader.result === 'string' ? reader.result : '';
      if (!dataUrl) {
        reject(new Error('Hasil foto kamera HP kosong.'));
        return;
      }
      const img = new Image();
      img.onerror = () => reject(new Error('Format gambar kamera HP tidak dapat diproses.'));
      img.onload = () => {
        try {
          const rawW = img.naturalWidth || img.width || 800;
          const rawH = img.naturalHeight || img.height || 600;
          const scale = Math.min(1, 1024 / Math.max(rawW, rawH));
          const canvas = document.createElement('canvas');
          canvas.width = Math.max(1, Math.round(rawW * scale));
          canvas.height = Math.max(1, Math.round(rawH * scale));
          const ctx = canvas.getContext('2d', { alpha: false });
          if (!ctx) {
            reject(new Error('Gagal mengompresi foto kamera HP.'));
            return;
          }
          ctx.fillStyle = '#000000';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          resolve(compressCanvasToJpeg(canvas));
        } catch (err) {
          reject(err);
        }
      };
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
  });
}

export function CrewLiveCamera({ title = 'Kamera', onClose, onCapture }: Props) {
  const video = useRef<HTMLVideoElement>(null);
  const nativeCameraInput = useRef<HTMLInputElement>(null);
  const stream = useRef<MediaStream | null>(null);
  const session = useRef(0);
  const shutterBusy = useRef(false);
  const [attempt, setAttempt] = useState(0);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [ready, setReady] = useState(false);
  const [opening, setOpening] = useState(true);
  const [locating, setLocating] = useState(false);
  const [fault, setFault] = useState('');

  const stop = () => {
    stream.current?.getTracks().forEach(t => {
      try { t.stop(); } catch {}
    });
    stream.current = null;
    if (video.current) {
      try { video.current.srcObject = null; } catch {}
    }
  };

  useEffect(() => {
    const id = ++session.current;
    shutterBusy.current = false;
    setOpening(true);
    setReady(false);
    setLocating(false);
    setFault('');

    const open = async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia) {
          throw new Error('Browser tidak mendukung pratinjau video langsung. Gunakan tombol "Gunakan Kamera HP" di bawah.');
        }

        const constraintTiers: MediaStreamConstraints[] = [
          {
            audio: false,
            video: {
              facingMode: { ideal: facingMode },
              width: { ideal: 1280 },
              height: { ideal: 720 }
            }
          },
          {
            audio: false,
            video: {
              facingMode: { ideal: facingMode }
            }
          },
          {
            audio: false,
            video: {
              facingMode
            }
          },
          {
            audio: false,
            video: true
          }
        ];

        let media: MediaStream | null = null;
        let lastError: unknown = null;

        for (const constraints of constraintTiers) {
          if (session.current !== id) break;
          try {
            media = await navigator.mediaDevices.getUserMedia(constraints);
            if (media) break;
          } catch (err) {
            lastError = err;
            const errName = (err as DOMException)?.name;
            // Do not keep prompting if the user explicitly denied permission
            if (errName === 'NotAllowedError' || errName === 'PermissionDeniedError') {
              break;
            }
          }
        }

        if (!media) {
          throw lastError || new Error('Kamera gagal dibuka.');
        }

        if (session.current !== id || !video.current) {
          media.getTracks().forEach(t => {
            try { t.stop(); } catch {}
          });
          return;
        }

        stream.current = media;
        const vEl = video.current;
        vEl.muted = true;
        vEl.defaultMuted = true;
        vEl.playsInline = true;
        vEl.setAttribute('playsinline', 'true');
        vEl.setAttribute('webkit-playsinline', 'true');
        vEl.setAttribute('muted', 'true');
        vEl.srcObject = media;

        try {
          await vEl.play();
        } catch {
          // On some mobile WebViews play() rejects benignly while autoPlay already starts the stream
        }

        if (session.current === id) {
          const hasLiveTrack = media.getVideoTracks().some(t => t.readyState === 'live');
          setOpening(false);
          if (vEl.readyState >= 1 || vEl.videoWidth > 0 || hasLiveTrack) {
            setReady(true);
          }
        }
      } catch (e) {
        if (session.current === id) {
          stop();
          setOpening(false);
          setFault(cameraError(e));
        }
      }
    };

    void open();
    return () => {
      session.current++;
      stop();
    };
  }, [attempt, facingMode]);

  const close = () => {
    session.current++;
    shutterBusy.current = false;
    stop();
    onClose();
  };

  const finalizePhotoCapture = async (photoDataUrl: string, id: number) => {
    const position = await getCapturePosition();
    if (id !== session.current) return;
    const nowIso = new Date().toISOString();
    const evidence: CameraEvidence = {
      photo: photoDataUrl,
      source: 'camera',
      capturedAt: nowIso,
      gpsCapturedAt: nowIso,
      gps: {
        latitude: position.latitude,
        longitude: position.longitude,
        accuracy: position.accuracy
      }
    };
    const invalid = validateCameraEvidence(evidence);
    if (invalid) throw new Error(invalid);
    session.current++;
    stop();
    onCapture(evidence);
  };

  const shutter = async () => {
    if (!ready || !stream.current || shutterBusy.current) return;
    const id = session.current;
    shutterBusy.current = true;
    setLocating(true);
    setFault('');
    try {
      const frame = video.current;
      if (!frame || !stream.current?.getVideoTracks().some(t => t.readyState === 'live')) {
        throw new Error('Kamera tidak aktif. Tekan "Buka Kamera Lagi" atau "Gunakan Kamera HP".');
      }
      const photo = captureJpeg(frame);
      await finalizePhotoCapture(photo, id);
    } catch (e) {
      if (id === session.current) {
        setFault((e as Error)?.message || 'Foto atau GPS gagal diperoleh.');
      }
    } finally {
      if (id === session.current) {
        shutterBusy.current = false;
        setLocating(false);
      }
    }
  };

  const handleNativeCameraChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || shutterBusy.current) return;
    const id = session.current;
    shutterBusy.current = true;
    setLocating(true);
    setFault('');
    try {
      const photo = await convertFileToJpeg(file);
      if (id !== session.current) return;
      await finalizePhotoCapture(photo, id);
    } catch (err) {
      if (id === session.current) {
        setFault((err as Error)?.message || 'Gagal memproses foto dari kamera HP.');
      }
    } finally {
      if (id === session.current) {
        shutterBusy.current = false;
        setLocating(false);
      }
    }
  };

  const markVideoReady = () => {
    if (stream.current) {
      setOpening(false);
      setReady(true);
    }
  };

  return (
    <Dialog title={title} onClose={close} overlayClassName="cv66-overlay--camera">
      <input
        ref={nativeCameraInput}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleNativeCameraChange}
        style={{ display: 'none' }}
        aria-hidden="true"
      />
      <div className="relative aspect-[3/4] max-h-[48dvh] w-full overflow-hidden rounded-xl bg-slate-950">
        <video
          ref={video}
          autoPlay
          playsInline
          muted
          aria-label="Pratinjau kamera langsung"
          className="h-full w-full object-cover"
          onLoadedMetadata={markVideoReady}
          onLoadedData={markVideoReady}
          onCanPlay={markVideoReady}
          onPlaying={markVideoReady}
        />
        {ready && !opening && (
          <button
            type="button"
            onClick={() => setFacingMode(prev => (prev === 'environment' ? 'user' : 'environment'))}
            className="absolute top-3 right-3 z-10 inline-flex items-center gap-1.5 rounded-full bg-slate-900/80 px-3 py-1.5 text-xs font-semibold text-white backdrop-blur-xs border border-white/20"
            aria-label="Ganti kamera depan atau belakang"
          >
            <RefreshCw size={13}/>
            <span>Putar Kamera</span>
          </button>
        )}
        {(opening || !ready) && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-4 text-center text-white!" role="status">
            {opening ? <LoaderCircle className="animate-spin" size={30}/> : <VideoOff size={32}/>}
            <span className="text-sm! font-medium text-white!">
              {opening ? 'Membuka kamera...' : 'Pratinjau live belum aktif'}
            </span>
          </div>
        )}
      </div>

      {fault && (
        <p role="alert" className="rounded-lg bg-rose-50 p-3 text-[13px]! leading-relaxed text-rose-800!">
          {fault}
        </p>
      )}
      {locating && (
        <p className="flex items-center gap-2 text-sm! font-medium" role="status">
          <MapPin size={18}/>Menyimpan foto &amp; titik GPS...
        </p>
      )}

      <div className="flex flex-col gap-2">
        {ready ? (
          <Button disabled={locating} loading={locating} onClick={() => void shutter()}>
            <Camera size={20}/>
            {locating ? 'Menyimpan Foto...' : 'Ambil Foto'}
          </Button>
        ) : (
          !opening && (
            <Button onClick={() => setAttempt(a => a + 1)}>
              <RotateCcw size={18}/>Buka Kamera Live Lagi
            </Button>
          )
        )}

        <Button
          variant="secondary"
          disabled={locating}
          onClick={() => nativeCameraInput.current?.click()}
        >
          <Smartphone size={18}/>Gunakan Kamera HP
        </Button>
      </div>
    </Dialog>
  );
}

export function EvidencePreview({ evidence, disabled, onRetake }: {evidence: CameraEvidence; disabled?: boolean; onRetake: () => void}) {
  return <div className="flex flex-col gap-2">
    <div className="cv66-photo"><img src={evidence.photo} alt="Foto kamera saat pelaporan"/></div>
    <div className="flex flex-wrap items-center justify-between gap-2"><span className="inline-flex items-center gap-1.5 text-[12px]! font-semibold text-emerald-700! dark:text-emerald-300!"><CheckCircle2 size={16}/> GPS ±{Math.round(evidence.gps.accuracy)} m</span><span className="cv66-meta">{new Date(evidence.capturedAt).toLocaleTimeString('id-ID',{hour:'2-digit',minute:'2-digit',second:'2-digit'})}</span></div>
    <Button variant="secondary" disabled={disabled} onClick={onRetake}><RotateCcw size={17}/>Ambil Ulang</Button>
  </div>;
}
