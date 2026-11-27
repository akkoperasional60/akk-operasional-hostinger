import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Building2, Check, ClipboardCheck, Clock3, Eraser, MapPin, PenTool, Truck, Users } from 'lucide-react';
import type { DepartureSignatureKey, DepartureValidationData, FieldTrip } from './crewModel';
import { Button, Dialog } from './CrewFieldUI';
import { logisticsStore } from '../../services/store';
import { branchStore } from '../../services/branchStore';
import { exportCompactSignatureDataUrl } from '../../utils/imageCompression';

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
  signerName: string;
  candidates: string[];
  disabled?: boolean;
  onSignerNameChange: (key: DepartureSignatureKey, name: string) => void;
  onChange: (key: DepartureSignatureKey, dataUrl: string) => void;
}

const SignaturePadCard: React.FC<SignaturePadCardProps> = ({
  def,
  value,
  signerName,
  candidates,
  disabled,
  onSignerNameChange,
  onChange
}) => {
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
    onChange(def.key, exportCompactSignatureDataUrl(canvas));
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
  const dropdownOptions = useMemo(() => {
    const merged = Array.from(new Set([signerName, ...candidates].map(v => String(v || '').trim()).filter(Boolean)));
    return merged;
  }, [signerName, candidates]);

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

      {dropdownOptions.length > 0 ? (
        <select
          className="cv75-sig-select"
          value={signerName}
          disabled={disabled}
          aria-label={`Nama penandatangan ${def.title}`}
          onChange={e => onSignerNameChange(def.key, e.target.value)}
        >
          {dropdownOptions.map(name => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </select>
      ) : (
        <input
          type="text"
          className="cv75-sig-select"
          value={signerName}
          disabled={disabled}
          placeholder={`Nama ${def.title}`}
          aria-label={`Nama penandatangan ${def.title}`}
          onChange={e => onSignerNameChange(def.key, e.target.value)}
        />
      )}

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
  const branchName = useMemo(() => {
    const matched = branchStore.getBranches().find(b => b.id === trip.branchId);
    if (matched?.name) return matched.name;
    return trip.branchId === 'cab-sidoarjo' ? 'Sidoarjo' : 'Nusantara';
  }, [trip.branchId]);

  const signerCandidates = useMemo<Record<DepartureSignatureKey, string[]>>(() => {
    const users = logisticsStore.getUsers().filter(u => u && u.status === 'approved' && u.role !== 'super_admin');
    const inBranch = users.filter(u => {
      const perms = branchStore.getUserBranchPermissions(
        u.id,
        u.role,
        u.permissions?.modules,
        u.permissions?.branchPermissions
      );
      return Boolean(perms?.[trip.branchId]?.enabled);
    });

    const spvLogistikNames = inBranch
      .filter(u => u.role === 'spv_logistik')
      .map(u => String(u.fullName || '').trim())
      .filter(Boolean);

    const spvOperasionalNames = inBranch
      .filter(u => u.role === 'operasional' || String(u.department || '').toLowerCase().includes('operasional'))
      .sort((a, b) => {
        const aSpv = /spv/i.test(`${a.fullName} ${a.department || ''}`) ? 0 : 1;
        const bSpv = /spv/i.test(`${b.fullName} ${b.department || ''}`) ? 0 : 1;
        return aSpv - bSpv;
      })
      .map(u => String(u.fullName || '').trim())
      .filter(Boolean);

    const securityNames = inBranch
      .filter(u => u.role === 'security')
      .map(u => String(u.fullName || '').trim())
      .filter(Boolean);

    const driverName = String(trip.driver?.name || '').trim();
    const helperName = String(trip.helper?.name || actorName || '').trim();
    const combinedCrew = [driverName, helperName].filter(Boolean).join(' / ');
    const crewOptions = Array.from(new Set([combinedCrew, helperName, driverName].filter(Boolean)));

    return {
      spvLogistik: Array.from(new Set(spvLogistikNames)),
      spvOperasional: Array.from(new Set(spvOperasionalNames)),
      security: Array.from(new Set(securityNames)),
      crew: crewOptions
    };
  }, [trip.branchId, trip.driver?.name, trip.helper?.name, actorName]);

  const [signerSelections, setSignerSelections] = useState<Record<DepartureSignatureKey, string>>(() => ({
    spvLogistik: signerCandidates.spvLogistik[0] || `SPV Logistik (${branchName})`,
    spvOperasional: signerCandidates.spvOperasional[0] || `SPV Operasional (${branchName})`,
    security: signerCandidates.security[0] || `Security (${branchName})`,
    crew: signerCandidates.crew[0] || actorName || 'Kru Pengiriman'
  }));

  useEffect(() => {
    setSignerSelections(prev => ({
      spvLogistik: signerCandidates.spvLogistik.includes(prev.spvLogistik)
        ? prev.spvLogistik
        : signerCandidates.spvLogistik[0] || prev.spvLogistik,
      spvOperasional: signerCandidates.spvOperasional.includes(prev.spvOperasional)
        ? prev.spvOperasional
        : signerCandidates.spvOperasional[0] || prev.spvOperasional,
      security: signerCandidates.security.includes(prev.security)
        ? prev.security
        : signerCandidates.security[0] || prev.security,
      crew: signerCandidates.crew[0] || prev.crew
    }));
  }, [signerCandidates]);

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

  const isReady = signedCount === SIGNATURE_BOXES.length;

  const handleSigChange = useCallback((key: DepartureSignatureKey, dataUrl: string) => {
    setSignatures(prev => ({ ...prev, [key]: dataUrl }));
  }, []);

  const handleSignerNameChange = useCallback((key: DepartureSignatureKey, name: string) => {
    setSignerSelections(prev => ({ ...prev, [key]: name }));
  }, []);

  const handleSave = () => {
    if (!isReady || busy) return;
    const nowIso = new Date().toISOString();
    const wibStamp = formatNowWib();
    const payload: DepartureValidationData = {
      summary: {
        branchName,
        driverName: trip.driver?.name || '-',
        helperName: trip.helper?.name || actorName || '-',
        fleetLabel: trip.fleetLabel || '-',
        departureTime: `${trip.departureTime || '07:30'} WIB`,
        areaName: trip.area || '-',
        recordedAt: nowIso,
        recordedAtWib: wibStamp
      },
      signerSelections: { ...signerSelections },
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
            <span className="cv75-summary-label"><Building2 size={12} /> Cabang</span>
            <span className="cv75-summary-val">{branchName}</span>
          </div>
          <div className="cv75-summary-item">
            <span className="cv75-summary-label"><Clock3 size={12} /> Jam Berangkat</span>
            <span className="cv75-summary-val">{trip.departureTime || '07:30'} WIB</span>
          </div>
          <div className="cv75-summary-item">
            <span className="cv75-summary-label"><Truck size={12} /> Nama Driver</span>
            <span className="cv75-summary-val">{trip.driver?.name || '-'}</span>
          </div>
          <div className="cv75-summary-item">
            <span className="cv75-summary-label"><Users size={12} /> Nama Helper</span>
            <span className="cv75-summary-val">{trip.helper?.name || actorName || '-'}</span>
          </div>
          <div className="cv75-summary-item">
            <span className="cv75-summary-label"><Truck size={12} /> Mobil Kiriman</span>
            <span className="cv75-summary-val">{trip.fleetLabel || '-'}</span>
          </div>
          <div className="cv75-summary-item">
            <span className="cv75-summary-label"><MapPin size={12} /> Area Kirim</span>
            <span className="cv75-summary-val">{trip.area || '-'}</span>
          </div>
        </div>
      </div>

      <div className="cv75-sig-section">
        <div className="cv75-sig-section-head">
          <span>Tanda Tangan Digital (4 Pihak · {branchName})</span>
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
              signerName={signerSelections[def.key]}
              candidates={signerCandidates[def.key]}
              disabled={busy}
              onSignerNameChange={handleSignerNameChange}
              onChange={handleSigChange}
            />
          ))}
        </div>
      </div>

      <Button disabled={busy || !isReady} loading={busy} onClick={handleSave}>
        <Check size={18} />
        {isReady ? 'Simpan Form Keluar & Validasi' : `Lengkapi ${4 - signedCount} TTD Tersisa`}
      </Button>
      {!qa && (
        <p className="cv66-meta cv66-gps">
          Waktu keluar, koordinat GPS, nama petugas cabang {branchName}, dan 4 tanda tangan digital tersimpan ke server.
        </p>
      )}
    </Dialog>
  );
};
