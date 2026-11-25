import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Check, CheckCircle2, ClipboardCheck, Eraser, MapPin, PenTool, Truck, Users } from 'lucide-react';
import type { DepartureSignatureKey, DepartureValidationData, FieldTrip } from './crewModel';
import { Button, Dialog } from './CrewFieldUI';

interface SignatureBoxDef {
  key: DepartureSignatureKey;
  title: string;
  roleLabel: string;
}

const SIGNATURE_BOXES: SignatureBoxDef[] = [
  { key: 'spvLogistik', title: 'SPV Logistik', roleLabel: 'Validasi Keberangkatan' },
  { key: 'spvOperasional', title: 'SPV Operasional', roleLabel: 'Mengetahui' },
  { key: 'security', title: 'Security', roleLabel: 'Pemeriksa Gerbang' },
  { key: 'crew', title: 'Driver / Helper', roleLabel: 'Kru Pengiriman' }
];

function formatNowWib(): string {
  const now = new Date();
  const datePart = now.toLocaleDateString('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: 'Asia/Jakarta'
  });
  const timePart = now
    .toLocaleTimeString('id-ID', {
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'Asia/Jakarta',
      hour12: false
    })
    .replace('.', ':');
  return `${datePart} · ${timePart} WIB`;
}

interface SignaturePadCardProps {
  def: SignatureBoxDef;
  value: string;
  disabled?: boolean;
  onChange: (key: DepartureSignatureKey, dataUrl: string) => void;
}

const SignaturePadCard: React.FC<SignaturePadCardProps> = ({ def, value, disabled, onChange }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawingRef = useRef(false);
  const hasStrokeRef = useRef(false);
  const lastPointRef = useRef<{ x: number; y: number } | null>(null);

  const setupCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const width = Math.max(200, Math.floor(rect.width || 220));
    const height = 108;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    if (canvas.width !== width * dpr || canvas.height !== height * dpr) {
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.scale(dpr, dpr);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, width, height);
      }
    }
  }, []);

  useEffect(() => {
    setupCanvas();
  }, [setupCanvas]);

  const getPoint = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    };
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (disabled) return;
    e.preventDefault();
    setupCanvas();
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.setPointerCapture?.(e.pointerId);
    const pt = getPoint(e);
    drawingRef.current = true;
    lastPointRef.current = pt;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.strokeStyle = '#0f172a';
      ctx.lineWidth = 2.2;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(pt.x, pt.y);
      ctx.lineTo(pt.x + 0.1, pt.y + 0.1);
      ctx.stroke();
      hasStrokeRef.current = true;
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawingRef.current || disabled) return;
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const last = lastPointRef.current;
    if (!ctx || !last) return;
    const pt = getPoint(e);
    ctx.beginPath();
    ctx.moveTo(last.x, last.y);
    ctx.lineTo(pt.x, pt.y);
    ctx.stroke();
    lastPointRef.current = pt;
    hasStrokeRef.current = true;
  };

  const commitCanvas = () => {
    if (!drawingRef.current) return;
    drawingRef.current = false;
    lastPointRef.current = null;
    const canvas = canvasRef.current;
    if (!canvas || !hasStrokeRef.current) return;
    const dataUrl = canvas.toDataURL('image/png');
    onChange(def.key, dataUrl);
  };

  const handleClear = () => {
    if (disabled) return;
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      const rect = canvas.getBoundingClientRect();
      const width = Math.max(200, Math.floor(rect.width || 220));
      const height = 108;
      if (ctx) {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, width, height);
      }
    }
    hasStrokeRef.current = false;
    onChange(def.key, '');
  };

  const signed = Boolean(value && value.startsWith('data:image/'));

  return (
    <div className={`cv75-sig-card ${signed ? 'cv75-sig-card--signed' : ''}`}>
      <div className="cv75-sig-head">
        <div className="cv75-sig-meta">
          <span className="cv75-sig-title">{def.title}</span>
          <span className="cv75-sig-role">{def.roleLabel}</span>
        </div>
        <div className="cv75-sig-actions">
          <span className={`cv75-badge ${signed ? 'cv75-badge--green' : 'cv75-badge--slate'}`}>
            {signed ? 'Sudah TTD' : 'Wajib'}
          </span>
          {signed && (
            <button
              type="button"
              className="cv75-clear-btn"
              disabled={disabled}
              aria-label={`Hapus tanda tangan ${def.title}`}
              onClick={handleClear}
            >
              <Eraser size={13} />
            </button>
          )}
        </div>
      </div>
      <div className="cv75-sig-pad-wrap">
        <canvas
          ref={canvasRef}
          className="cv75-sig-canvas"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={commitCanvas}
          onPointerCancel={commitCanvas}
          onPointerLeave={commitCanvas}
        />
        {!signed && (
          <span className="cv75-sig-placeholder">
            <PenTool size={13} /> Tanda tangan di sini
          </span>
        )}
      </div>
    </div>
  );
};

interface DepartureFormModalProps {
  trip: FieldTrip;
  actorName: string;
  busy?: boolean;
  qa?: boolean;
  notice?: React.ReactNode;
  onClose: () => void;
  onSubmit: (data: DepartureValidationData) => void;
}

export const DepartureFormModal: React.FC<DepartureFormModalProps> = ({
  trip,
  actorName,
  busy = false,
  qa = false,
  notice,
  onClose,
  onSubmit
}) => {
  const [checks, setChecks] = useState<[boolean, boolean]>([false, false]);
  const [signatures, setSignatures] = useState<Record<DepartureSignatureKey, string>>({
    spvLogistik: '',
    spvOperasional: '',
    security: '',
    crew: ''
  });
  const [clockLabel, setClockLabel] = useState<string>(() => formatNowWib());

  useEffect(() => {
    const t = window.setInterval(() => setClockLabel(formatNowWib()), 15000);
    return () => clearInterval(t);
  }, []);

  const signedCount = useMemo(
    () => SIGNATURE_BOXES.filter(box => Boolean(signatures[box.key]?.startsWith('data:image/'))).length,
    [signatures]
  );

  const isReady = checks[0] && checks[1] && signedCount === SIGNATURE_BOXES.length;

  const handleSigChange = useCallback((key: DepartureSignatureKey, dataUrl: string) => {
    setSignatures(prev => ({ ...prev, [key]: dataUrl }));
  }, []);

  const handleSave = () => {
    if (!isReady || busy) return;
    const nowIso = new Date().toISOString();
    const wibStamp = formatNowWib();
    const payload: DepartureValidationData = {
      summary: {
        driverName: trip.driver?.name || '-',
        helperName: trip.helper?.name || actorName || '-',
        fleetLabel: trip.fleetLabel || '-',
        areaName: trip.area || '-',
        recordedAt: nowIso,
        recordedAtWib: wibStamp
      },
      checks: {
        waybillMatch: checks[0],
        documentsReady: checks[1]
      },
      signatures: {
        spvLogistik: signatures.spvLogistik,
        spvOperasional: signatures.spvOperasional,
        security: signatures.security,
        crew: signatures.crew
      },
      signedAt: nowIso,
      signedBy: actorName || trip.helper?.name || 'Helper'
    };
    onSubmit(payload);
  };

  return (
    <Dialog title="Form Keluar & Validasi Keberangkatan" busy={busy} onClose={onClose}>
      {notice}

      <div className="cv75-flat-card cv75-summary-card">
        <div className="cv75-summary-head">
          <span className="cv75-badge cv75-badge--blue">
            <ClipboardCheck size={12} /> Ringkasan Keberangkatan
          </span>
          <span className="cv75-clock">{clockLabel}</span>
        </div>
        <div className="cv75-summary-grid">
          <div className="cv75-summary-item">
            <span className="cv75-summary-label"><Truck size={12} /> Driver</span>
            <span className="cv75-summary-val">{trip.driver?.name || '-'}</span>
          </div>
          <div className="cv75-summary-item">
            <span className="cv75-summary-label"><Users size={12} /> Helper</span>
            <span className="cv75-summary-val">{trip.helper?.name || actorName || '-'}</span>
          </div>
          <div className="cv75-summary-item">
            <span className="cv75-summary-label">Armada</span>
            <span className="cv75-summary-val">{trip.fleetLabel || '-'}</span>
          </div>
          <div className="cv75-summary-item">
            <span className="cv75-summary-label"><MapPin size={12} /> Area Kiriman</span>
            <span className="cv75-summary-val">{trip.area || '-'}</span>
          </div>
        </div>
      </div>

      <div className="cv66-checklist">
        {[
          'Tujuan dan jumlah surat jalan sesuai',
          'Dokumen lengkap dan siap dibawa'
        ].map((label, idx) => (
          <label key={label} className="cv75-check-row">
            <input
              type="checkbox"
              checked={checks[idx]}
              disabled={busy}
              onChange={e => {
                const checked = e.target.checked;
                setChecks(prev => (idx === 0 ? [checked, prev[1]] : [prev[0], checked]));
              }}
            />
            <span>{label}</span>
          </label>
        ))}
      </div>

      <div className="cv75-sig-section">
        <div className="cv75-sig-section-head">
          <span>Tanda Tangan Digital (4 Pihak)</span>
          <span className={`cv75-badge ${signedCount === 4 ? 'cv75-badge--green' : 'cv75-badge--slate'}`}>
            {signedCount}/4 Lengkap
          </span>
        </div>
        <div className="cv75-sig-grid">
          {SIGNATURE_BOXES.map(def => (
            <SignaturePadCard
              key={def.key}
              def={def}
              value={signatures[def.key]}
              disabled={busy}
              onChange={handleSigChange}
            />
          ))}
        </div>
      </div>

      <Button disabled={busy || !isReady} loading={busy} onClick={handleSave}>
        <Check size={18} />
        {isReady ? 'Simpan Form Keluar & Validasi' : `Lengkapi Ceklis & ${4 - signedCount} TTD Tersisa`}
      </Button>
      {!qa && (
        <p className="cv66-meta cv66-gps">
          Waktu keluar, koordinat GPS, dan 4 tanda tangan digital tersimpan permanen ke server.
        </p>
      )}
    </Dialog>
  );
};
