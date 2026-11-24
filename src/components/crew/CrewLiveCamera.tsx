import React, { useEffect, useRef, useState } from 'react';
import { Camera, CheckCircle2, LoaderCircle, MapPin, RotateCcw, VideoOff } from 'lucide-react';
import { Button, Dialog } from './CrewFieldUI';
import { CAMERA_MAX_ACCURACY_METERS, CAMERA_MAX_DATA_URL, validateCameraEvidence, type CameraEvidence } from './crewCaptureEvidence';

interface Props { onClose: () => void; onCapture: (value: CameraEvidence) => void; }

function cameraError(error: unknown) {
  const e = error as DOMException;
  if (e?.name === 'NotAllowedError' || e?.name === 'SecurityError') return 'Izin kamera ditolak. Izinkan kamera di pengaturan browser/aplikasi.';
  if (e?.name === 'NotFoundError' || e?.name === 'OverconstrainedError') return 'Kamera tidak ditemukan pada perangkat.';
  if (e?.name === 'NotReadableError') return 'Kamera sedang digunakan aplikasi lain.';
  return e?.message || 'Kamera gagal dibuka. Coba lagi.';
}

function getCapturePosition(): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) return reject(new Error('GPS tidak tersedia pada perangkat.'));
    navigator.geolocation.getCurrentPosition(position => {
      if (!Number.isFinite(position.timestamp) || Math.abs(Date.now() - position.timestamp) > 30_000) return reject(new Error('GPS belum terbaru. Coba lagi.'));
      if (!Number.isFinite(position.coords.accuracy) || position.coords.accuracy <= 0 || position.coords.accuracy > CAMERA_MAX_ACCURACY_METERS) return reject(new Error('GPS belum akurat. Coba di tempat terbuka.'));
      resolve(position);
    }, error => reject(new Error(error.code === 1 ? 'Izin lokasi ditolak. Aktifkan izin GPS.' : error.code === 3 ? 'GPS belum ditemukan. Coba lagi di tempat terbuka.' : 'Lokasi belum tersedia. Aktifkan GPS.')), { enableHighAccuracy: true, maximumAge: 0, timeout: 25_000 });
  });
}

function captureJpeg(video: HTMLVideoElement): string {
  if (video.readyState < 2 || !video.videoWidth || !video.videoHeight) throw new Error('Kamera belum siap. Coba lagi.');
  const canvas = document.createElement('canvas');
  const scale = Math.min(1, 1280 / Math.max(video.videoWidth, video.videoHeight));
  canvas.width = Math.round(video.videoWidth * scale); canvas.height = Math.round(video.videoHeight * scale);
  const ctx = canvas.getContext('2d', { alpha: false });
  if (!ctx) throw new Error('Gagal mengambil gambar kamera.');
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
  let jpeg = canvas.toDataURL('image/jpeg', .82);
  for (const q of [.7, .58, .45, .33]) {
    if (jpeg.length <= CAMERA_MAX_DATA_URL) break;
    jpeg = canvas.toDataURL('image/jpeg', q);
  }
  if (jpeg.length > CAMERA_MAX_DATA_URL || !jpeg.startsWith('data:image/jpeg;base64,/')) throw new Error('Foto gagal dikompresi. Ambil ulang.');
  return jpeg;
}

/** No input[type=file], no gallery, no cached location fallback. */
export function CrewLiveCamera({ onClose, onCapture }: Props) {
  const video = useRef<HTMLVideoElement>(null);
  const stream = useRef<MediaStream | null>(null);
  const session = useRef(0);
  const shutterBusy = useRef(false);
  const [attempt, setAttempt] = useState(0);
  const [ready, setReady] = useState(false);
  const [opening, setOpening] = useState(true);
  const [locating, setLocating] = useState(false);
  const [fault, setFault] = useState('');
  const stop = () => { stream.current?.getTracks().forEach(t => t.stop()); stream.current = null; if (video.current) video.current.srcObject = null; };
  useEffect(() => {
    const id = ++session.current;
    shutterBusy.current = false;
    setOpening(true); setReady(false); setLocating(false); setFault('');
    const open = async () => {
      try {
        if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) throw new Error('Kamera memerlukan browser yang mendukung HTTPS.');
        const media = await navigator.mediaDevices.getUserMedia({ audio: false, video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 960 } } });
        if (session.current !== id || !video.current) { media.getTracks().forEach(t => t.stop()); return; }
        stream.current = media;
        video.current.srcObject = media;
        await video.current.play();
        if (session.current === id) { setOpening(false); setReady(video.current.readyState >= 2); }
      } catch (e) {
        if (session.current === id) { stop(); setOpening(false); setFault(cameraError(e)); }
      }
    };
    const hide = () => {
      if (document.visibilityState !== 'hidden') return;
      session.current++; stop(); shutterBusy.current = false;
      setOpening(false); setReady(false); setLocating(false); setFault('Kamera dijeda. Buka ulang untuk melanjutkan.');
    };
    document.addEventListener('visibilitychange', hide);
    void open();
    return () => { session.current++; stop(); document.removeEventListener('visibilitychange', hide); };
  }, [attempt]);
  const close = () => { session.current++; stop(); onClose(); };
  const shutter = async () => {
    if (!ready || !stream.current || shutterBusy.current) return;
    const id = session.current;
    shutterBusy.current = true; setLocating(true); setFault('');
    try {
      const position = await getCapturePosition();
      if (id !== session.current) return;
      const frame = video.current;
      if (!frame || !stream.current?.getVideoTracks().some(t => t.readyState === 'live')) throw new Error('Kamera tidak aktif. Buka ulang.');
      // Capture immediately after a fresh GPS fix, not when the form is submitted.
      const photo = captureJpeg(frame);
      const evidence: CameraEvidence = { photo, source: 'camera', capturedAt: new Date().toISOString(), gpsCapturedAt: new Date(position.timestamp).toISOString(), gps: { latitude: position.coords.latitude, longitude: position.coords.longitude, accuracy: position.coords.accuracy } };
      const invalid = validateCameraEvidence(evidence);
      if (invalid) throw new Error(invalid);
      session.current++; stop(); onCapture(evidence);
    } catch (e) {
      if (id === session.current) setFault((e as Error)?.message || 'Foto atau GPS gagal diperoleh.');
    } finally {
      if (id === session.current) { shutterBusy.current = false; setLocating(false); }
    }
  };
  return <Dialog title="Kamera" onClose={close}>
    <div className="relative aspect-[3/4] max-h-[50dvh] w-full overflow-hidden rounded-xl bg-slate-950">
      <video ref={video} autoPlay playsInline muted aria-label="Pratinjau kamera langsung" className="h-full w-full object-contain" onCanPlay={()=>{if(stream.current)setReady(true);}}/>
      {(opening || !ready) && <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-4 text-center text-white!" role="status">{opening ? <LoaderCircle className="animate-spin" size={30}/> : <VideoOff size={32}/>}<span className="text-sm! font-medium text-white!">{opening?'Membuka kamera...':'Kamera belum aktif'}</span></div>}
    </div>
    {fault && <p role="alert" className="rounded-lg bg-rose-50 p-3 text-[13px]! leading-relaxed text-rose-800!">{fault}</p>}
    {locating && <p className="flex items-center gap-2 text-sm! font-medium" role="status"><MapPin size={18}/>Tahan posisi, mengambil GPS...</p>}
    {ready ? <Button disabled={locating} loading={locating} onClick={()=>void shutter()}><Camera size={20}/>{locating?'Mengambil GPS...':'Ambil Foto'}</Button> : !opening && <Button onClick={()=>setAttempt(a=>a+1)}><RotateCcw size={18}/>Buka Kamera Lagi</Button>}
  </Dialog>;
}

export function EvidencePreview({ evidence, disabled, onRetake }: {evidence: CameraEvidence; disabled?: boolean; onRetake: () => void}) {
  return <div className="flex flex-col gap-2">
    <div className="cv66-photo"><img src={evidence.photo} alt="Foto kamera saat pelaporan"/></div>
    <div className="flex flex-wrap items-center justify-between gap-2"><span className="inline-flex items-center gap-1.5 text-[12px]! font-semibold text-emerald-700! dark:text-emerald-300!"><CheckCircle2 size={16}/> GPS ±{Math.round(evidence.gps.accuracy)} m</span><span className="cv66-meta">{new Date(evidence.capturedAt).toLocaleTimeString('id-ID',{hour:'2-digit',minute:'2-digit',second:'2-digit'})}</span></div>
    <Button variant="secondary" disabled={disabled} onClick={onRetake}><RotateCcw size={17}/>Ambil Ulang</Button>
  </div>;
}
