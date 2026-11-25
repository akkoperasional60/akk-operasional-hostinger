import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Eraser,
  FileText,
  MapPin,
  PenTool,
  RefreshCw,
  Store
} from 'lucide-react';
import type { UserProfile } from '../../types';
import {
  formKirimStore,
  type FormKirimGpsLockEntry,
  type FormKirimInvoiceItem,
  type FormKirimRecord
} from '../../services/formKirimStore';
import { listenCrewChanged, notifyCrewChanged, submitWorkReport } from './crewApi';
import { freshGps, type FieldTrip } from './crewModel';
import { Button } from './CrewFieldUI';

interface CrewFormKirimManifestProps {
  user: UserProfile;
  trip: FieldTrip;
  busy: boolean;
  onSuccess: (msg: string) => void;
  onError: (err: string) => void;
}

const normText = (v?: string) => String(v || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, ' ');

function formatRp(n: number): string {
  return `Rp ${(Number(n) || 0).toLocaleString('id-ID')}`;
}

function formatWibClockShort(d = new Date()): string {
  return (
    d
      .toLocaleTimeString('id-ID', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        timeZone: 'Asia/Jakarta',
        hour12: false
      })
      .replace(/\./g, ':') + ' WIB'
  );
}

interface MiniSignaturePadProps {
  value?: string;
  disabled?: boolean;
  onChange: (dataUrl: string) => void;
}

const MiniSignaturePad: React.FC<MiniSignaturePadProps> = ({ value, disabled, onChange }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawingRef = useRef(false);
  const hasStrokeRef = useRef(Boolean(value));
  const lastRef = useRef<{ x: number; y: number } | null>(null);

  const ensureInit = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const w = Math.max(220, Math.floor(rect.width || 240));
    const h = 110;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    if (canvas.width !== w * dpr || canvas.height !== h * dpr) {
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.scale(dpr, dpr);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, w, h);
        if (value && value.startsWith('data:image/')) {
          const img = new Image();
          img.onload = () => ctx.drawImage(img, 0, 0, w, h);
          img.src = value;
        }
      }
    }
  }, [value]);

  useEffect(() => {
    ensureInit();
  }, [ensureInit]);

  const pt = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const r = canvasRef.current!.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };

  const down = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (disabled) return;
    e.preventDefault();
    ensureInit();
    const c = canvasRef.current;
    if (!c) return;
    c.setPointerCapture?.(e.pointerId);
    const p = pt(e);
    drawingRef.current = true;
    lastRef.current = p;
    const ctx = c.getContext('2d');
    if (ctx) {
      ctx.strokeStyle = '#0f172a';
      ctx.lineWidth = 2.2;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(p.x + 0.1, p.y + 0.1);
      ctx.stroke();
      hasStrokeRef.current = true;
    }
  };

  const move = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawingRef.current || disabled) return;
    e.preventDefault();
    const c = canvasRef.current;
    const ctx = c?.getContext('2d');
    const last = lastRef.current;
    if (!c || !ctx || !last) return;
    const p = pt(e);
    ctx.beginPath();
    ctx.moveTo(last.x, last.y);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    lastRef.current = p;
    hasStrokeRef.current = true;
  };

  const commit = () => {
    if (!drawingRef.current) return;
    drawingRef.current = false;
    lastRef.current = null;
    if (canvasRef.current && hasStrokeRef.current) {
      onChange(canvasRef.current.toDataURL('image/png'));
    }
  };

  const clear = () => {
    const c = canvasRef.current;
    if (c) {
      const ctx = c.getContext('2d');
      const r = c.getBoundingClientRect();
      if (ctx) {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, Math.max(220, Math.floor(r.width || 240)), 110);
      }
    }
    hasStrokeRef.current = false;
    onChange('');
  };

  const hasSig = Boolean(value && value.startsWith('data:image/'));

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-xs">
        <span className="font-semibold text-slate-700">Tanda Tangan Penerima (BT / TTD)</span>
        {hasSig && (
          <button
            type="button"
            disabled={disabled}
            onClick={clear}
            className="cv75-clear-btn"
            aria-label="Hapus tanda tangan faktur"
          >
            <Eraser size={13} />
          </button>
        )}
      </div>
      <div className="cv75-sig-pad-wrap">
        <canvas
          ref={canvasRef}
          className="cv75-sig-canvas"
          onPointerDown={down}
          onPointerMove={move}
          onPointerUp={commit}
          onPointerCancel={commit}
          onPointerLeave={commit}
        />
        {!hasSig && (
          <span className="cv75-sig-placeholder">
            <PenTool size={13} /> Tanda tangan pelanggan di sini
          </span>
        )}
      </div>
    </div>
  );
};

export const CrewFormKirimManifest: React.FC<CrewFormKirimManifestProps> = ({
  user,
  trip,
  busy,
  onSuccess,
  onError
}) => {
  const [records, setRecords] = useState<FormKirimRecord[]>(() => formKirimStore.getAll());
  const [syncing, setSyncing] = useState(false);
  const [selectedRecordId, setSelectedRecordId] = useState<string>('');
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [payMethod, setPayMethod] = useState<'Tunai' | 'Transfer' | 'TTD'>('Tunai');
  const [nominalInput, setNominalInput] = useState<string>('');
  const [signerInput, setSignerInput] = useState<string>('');
  const [ttdDataUrl, setTtdDataUrl] = useState<string>('');
  const [noteInput, setNoteInput] = useState<string>('');
  const [savingItem, setSavingItem] = useState(false);
  const [summaryNote, setSummaryNote] = useState<string>('');

  const syncForms = useCallback(async (force = false) => {
    setSyncing(true);
    try {
      await formKirimStore.hydrateFromServer(true, force);
      setRecords([...formKirimStore.getAll()]);
    } finally {
      setSyncing(false);
    }
  }, []);

  useEffect(() => {
    void syncForms(true);
    const unsubStore = formKirimStore.subscribe(() => {
      setRecords([...formKirimStore.getAll()]);
    });
    const unsubSse = listenCrewChanged(() => {
      void formKirimStore.hydrateFromServer(true);
    });
    return () => {
      unsubStore();
      unsubSse();
    };
  }, [syncForms]);

  const recordsWithItems = useMemo(
    () => records.filter(r => Array.isArray(r.invoiceItems) && r.invoiceItems.length > 0),
    [records]
  );

  const matchedRecord = useMemo(() => {
    if (selectedRecordId) {
      const explicit = recordsWithItems.find(r => r.id === selectedRecordId);
      if (explicit) return explicit;
    }
    const tripArea = normText(trip.area);
    const tripDate = String(trip.date || '').slice(0, 10);
    const areaTokens = tripArea.split(/\s+/).filter(t => t.length >= 3);

    const scoreRecord = (rec: FormKirimRecord) => {
      let score = 0;
      const rArea = normText(rec.areaKirim || rec.storeName);
      if (tripDate && rec.tanggalKirim === tripDate) score += 4;
      if (tripArea && rArea && (rArea.includes(tripArea) || tripArea.includes(rArea))) {
        score += 6;
      } else if (areaTokens.some(tok => rArea.includes(tok))) {
        score += 3;
      }
      if (rec.driverName && trip.driver?.name && normText(rec.driverName).includes(normText(trip.driver.name))) {
        score += 2;
      }
      return score;
    };

    const sorted = [...recordsWithItems].sort((a, b) => scoreRecord(b) - scoreRecord(a));
    return sorted[0] || null;
  }, [recordsWithItems, selectedRecordId, trip.area, trip.date, trip.driver?.name]);

  const items = matchedRecord?.invoiceItems || [];

  const totals = useMemo(() => {
    const totalTagihan = items.reduce((s, it) => s + (Number(it.nilaiFaktur) || 0), 0);
    const totalTunai = items
      .filter(it => it.metodeBayarAktual === 'Tunai' && Number(it.nominalDiterima) > 0)
      .reduce((s, it) => s + (Number(it.nominalDiterima) || 0), 0);
    const confirmedCount = items.filter(
      it => Boolean(it.metodeBayarAktual) || Boolean(it.ttdDataUrl) || Number(it.nominalDiterima) > 0
    ).length;
    return { totalTagihan, totalTunai, confirmedCount };
  }, [items]);

  const openEditor = (item: FormKirimInvoiceItem) => {
    if (editingItemId === item.id) {
      setEditingItemId(null);
      return;
    }
    setEditingItemId(item.id);
    const defaultMethod: 'Tunai' | 'Transfer' | 'TTD' =
      item.metodeBayarAktual || (item.paymentCategory === 'TEMPO' ? 'TTD' : 'Tunai');
    setPayMethod(defaultMethod);
    setNominalInput(
      item.nominalDiterima && item.nominalDiterima > 0
        ? String(item.nominalDiterima)
        : defaultMethod === 'Tunai'
        ? String(item.nilaiFaktur || '')
        : ''
    );
    setSignerInput(item.ttdSignerName || '');
    setTtdDataUrl(item.ttdDataUrl || '');
    setNoteInput(item.customerNote || '');
  };

  const handleSaveItem = async (item: FormKirimInvoiceItem) => {
    if (!matchedRecord || savingItem || busy) return;
    const numericVal = Number(String(nominalInput || '0').replace(/[^\d]/g, '')) || 0;
    if (payMethod === 'Tunai' && numericVal <= 0) {
      onError('Masukkan nominal setoran Tunai yang valid.');
      return;
    }
    if (payMethod === 'TTD' && !ttdDataUrl.startsWith('data:image/')) {
      onError('Tanda tangan pelanggan pada kotak TTD / BT wajib diisi.');
      return;
    }

    setSavingItem(true);
    try {
      const gps = await freshGps().catch(() => ({ latitude: -8.1906, longitude: 114.3708, accuracy: 25 }));
      const nowIso = new Date().toISOString();
      const actorName = user.fullName || trip.helper?.name || trip.driver?.name || 'Kru Pengiriman';
      const actorRole = trip.helper && user.id === trip.helper.id ? 'Helper' : 'Driver';
      const prevHistory = Array.isArray(item.gpsLockHistory) ? item.gpsLockHistory : [];
      const nextAttempt = Math.min(3, prevHistory.length + 1);
      const gpsLabel = nextAttempt === 1 ? 'GPS Awal' : nextAttempt === 2 ? 'GPS Kedua' : 'GPS Ketiga';

      const newGpsEntry: FormKirimGpsLockEntry = {
        attemptNumber: nextAttempt,
        label: gpsLabel,
        lat: gps.latitude,
        lng: gps.longitude,
        accuracy: gps.accuracy,
        locationName: `${item.namaPelanggan} (${item.alamatPelanggan || matchedRecord.areaKirim || trip.area})`,
        savedAt: nowIso,
        savedTimeWib: formatWibClockShort(new Date(nowIso)),
        savedBy: actorName,
        savedRole: actorRole,
        paymentMethod: payMethod.toUpperCase(),
        nominalDiterima: payMethod === 'Tunai' ? numericVal : undefined,
        summary:
          payMethod === 'Tunai'
            ? `Simpan Tunai • ${formatRp(numericVal)}`
            : payMethod === 'Transfer'
            ? 'Konfirmasi Transfer Pelanggan'
            : `Tanda Terima (TTD)${signerInput.trim() ? ` · ${signerInput.trim()}` : ''}`
      };

      const nextItems = items.map(row => {
        if (row.id !== item.id) return row;
        return {
          ...row,
          metodeBayarAktual: payMethod,
          nominalDiterima: payMethod === 'Tunai' ? numericVal : 0,
          bayar: payMethod === 'Tunai' ? formatRp(numericVal) : payMethod === 'Transfer' ? 'TRANSFER' : 'TTD / BT',
          ttdDataUrl: payMethod === 'TTD' ? ttdDataUrl : row.ttdDataUrl,
          ttdSignerName: payMethod === 'TTD' ? (signerInput.trim() || item.namaPelanggan) : row.ttdSignerName,
          ttdSignedAt: payMethod === 'TTD' ? nowIso : row.ttdSignedAt,
          customerNote: noteInput.trim() || undefined,
          driverUpdatedBy: actorName,
          driverUpdatedAt: nowIso,
          driverEditCount: (Number(row.driverEditCount) || 0) + 1,
          lockedGpsLat: gps.latitude,
          lockedGpsLng: gps.longitude,
          lockedGpsAccuracy: gps.accuracy,
          lockedGpsLocation: `${item.namaPelanggan} (${item.alamatPelanggan || matchedRecord.areaKirim || trip.area})`,
          lockedGpsAt: nowIso,
          gpsLockHistory: [...prevHistory.slice(-2), newGpsEntry]
        };
      });

      const doneCount = nextItems.filter(
        it => Boolean(it.metodeBayarAktual) || Boolean(it.ttdDataUrl) || Number(it.nominalDiterima) > 0
      ).length;
      const summaryText = `Update Form Kirim ${matchedRecord.noFormKirim}: ${doneCount}/${nextItems.length} faktur terkonfirmasi (${item.namaPelanggan} · ${payMethod})`;

      formKirimStore.updateInvoiceItems(matchedRecord.id, nextItems, summaryText);
      formKirimStore.updateDriverExecutionStatus(
        matchedRecord.id,
        doneCount >= nextItems.length ? 'delivered' : 'in_transit',
        summaryText
      );
      notifyCrewChanged();
      setEditingItemId(null);
      onSuccess(`${item.noFaktur} (${payMethod}) tersimpan & tersinkron ke Keuangan.`);
    } catch (err: any) {
      onError(err?.message || 'Gagal menyimpan data faktur Form Kirim.');
    } finally {
      setSavingItem(false);
    }
  };

  const handleConfirmAllManifest = async () => {
    if (savingItem || busy) return;
    setSavingItem(true);
    try {
      const targetRec = matchedRecord;
      const noteText =
        summaryNote.trim() ||
        (targetRec
          ? `Form Kirim ${targetRec.noFormKirim} (${targetRec.areaKirim || trip.area}) · Tunai ${formatRp(totals.totalTunai)} · ${totals.confirmedCount}/${items.length} faktur`
          : `Konfirmasi Form Kirim · ${trip.area} · ${trip.fleetLabel}`);

      if (targetRec) {
        formKirimStore.updateDriverExecutionStatus(
          targetRec.id,
          totals.confirmedCount >= items.length && items.length > 0 ? 'delivered' : 'in_transit',
          noteText
        );
      }
      await submitWorkReport(user, trip.id, 'form_kirim', noteText, null);
      notifyCrewChanged();
      onSuccess('Rekap Form Kirim tersimpan & tersinkron ke Menu Keuangan.');
    } catch (err: any) {
      onError(err?.message || 'Gagal mengirim rekap Form Kirim.');
    } finally {
      setSavingItem(false);
    }
  };

  return (
    <div className="cv66-form">
      {/* Header Sync & Picker */}
      <div className="cv75-flat-card cv75-summary-card">
        <div className="cv75-summary-head">
          <span className="cv75-badge cv75-badge--blue">
            <FileText size={12} /> Manifest Form Kirim Terintegrasi
          </span>
          <button
            type="button"
            disabled={syncing || busy}
            onClick={() => void syncForms(true)}
            className="cv75-chip"
          >
            <RefreshCw size={12} className={syncing ? 'cv66-spin' : ''} />
            <span>{syncing ? 'Menyinkronkan...' : 'Segarkan Data'}</span>
          </button>
        </div>

        {recordsWithItems.length > 1 && (
          <label className="cv66-field">
            <span>Pilih Form Kirim Area</span>
            <select
              className="cv75-select"
              value={matchedRecord?.id || ''}
              onChange={e => {
                setSelectedRecordId(e.target.value);
                setEditingItemId(null);
              }}
              disabled={busy || savingItem}
            >
              {recordsWithItems.map(r => (
                <option key={r.id} value={r.id}>
                  {r.noFormKirim} · {r.areaKirim || r.storeName} ({r.tanggalKirim})
                </option>
              ))}
            </select>
          </label>
        )}

        {matchedRecord ? (
          <div className="cv75-summary-grid">
            <div className="cv75-summary-item">
              <span className="cv75-summary-label">No. Form / Area</span>
              <span className="cv75-summary-val">
                {matchedRecord.noFormKirim} · {matchedRecord.areaKirim || matchedRecord.storeName}
              </span>
            </div>
            <div className="cv75-summary-item">
              <span className="cv75-summary-label">Total Faktur</span>
              <span className="cv75-summary-val">
                {totals.confirmedCount}/{items.length} Terkonfirmasi
              </span>
            </div>
            <div className="cv75-summary-item">
              <span className="cv75-summary-label">Total Tagihan</span>
              <span className="cv75-summary-val">{formatRp(totals.totalTagihan)}</span>
            </div>
            <div className="cv75-summary-item">
              <span className="cv75-summary-label">Tunai Terkumpul</span>
              <span className="cv75-summary-val text-emerald-700">{formatRp(totals.totalTunai)}</span>
            </div>
          </div>
        ) : (
          <div className="text-xs text-slate-600 py-2">
            Belum ada Form Kirim dari Admin Penjualan yang memiliki daftar faktur untuk area{' '}
            <strong>{trip.area}</strong>. Tekan &quot;Segarkan Data&quot; atau kirim konfirmasi manifest manual di bawah.
          </div>
        )}
      </div>

      {/* Daftar Faktur / Pelanggan */}
      {matchedRecord && items.length > 0 && (
        <div className="cv75-manifest-list">
          {items.map(item => {
            const isExpanded = editingItemId === item.id;
            const isConfirmed =
              Boolean(item.metodeBayarAktual) || Boolean(item.ttdDataUrl) || Number(item.nominalDiterima) > 0;
            const statusLabel = item.metodeBayarAktual
              ? item.metodeBayarAktual === 'Tunai'
                ? `Tunai · ${formatRp(item.nominalDiterima || 0)}`
                : item.metodeBayarAktual === 'Transfer'
                ? 'Transfer'
                : 'TTD / BT'
              : 'Belum Input';

            return (
              <div
                key={item.id}
                className={`cv75-invoice-card ${isConfirmed ? 'cv75-invoice-card--done' : ''}`}
              >
                <div className="cv75-invoice-top">
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span
                        className={`cv75-badge ${
                          item.paymentCategory === 'COD' ? 'cv75-badge--amber' : 'cv75-badge--blue'
                        }`}
                      >
                        {item.paymentCategory}
                      </span>
                      <span className="text-[11px] font-mono font-bold text-slate-600">{item.noFaktur}</span>
                      {Number(item.coly) > 0 && (
                        <span className="text-[11px] text-slate-500">· {item.coly} Coly</span>
                      )}
                    </div>
                    <div className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                      <Store size={14} className="text-blue-600 shrink-0" />
                      <span className="truncate">{item.namaPelanggan}</span>
                    </div>
                    <div className="text-xs text-slate-500 flex items-center gap-1">
                      <MapPin size={12} className="shrink-0" />
                      <span className="truncate">{item.alamatPelanggan || matchedRecord.areaKirim || '-'}</span>
                    </div>
                  </div>
                  <div className="text-right shrink-0 space-y-1">
                    <div className="text-sm font-bold text-slate-900 tabular-nums">
                      {formatRp(item.nilaiFaktur)}
                    </div>
                    <span
                      className={`cv75-badge ${isConfirmed ? 'cv75-badge--green' : 'cv75-badge--slate'}`}
                    >
                      {isConfirmed && <CheckCircle2 size={11} />}
                      <span>{statusLabel}</span>
                    </span>
                  </div>
                </div>

                {item.customerNote && !isExpanded && (
                  <div className="text-xs text-slate-600 bg-white/80 border border-slate-200 rounded-lg px-2.5 py-1.5">
                    Catatan: {item.customerNote}
                  </div>
                )}

                <button
                  type="button"
                  disabled={busy || savingItem}
                  onClick={() => openEditor(item)}
                  className="cv75-chip cv75-chip--active justify-between w-full"
                >
                  <span>{isExpanded ? 'Tutup Form Pembayaran' : isConfirmed ? 'Ubah Pembayaran / TTD' : 'Input Tunai / Transfer / TTD'}</span>
                  {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                </button>

                {isExpanded && (
                  <div className="pt-2 border-t border-slate-200 space-y-3">
                    <div className="space-y-1.5">
                      <span className="text-xs font-semibold text-slate-700 block">Metode Pembayaran / Bukti</span>
                      <div className="cv75-pay-grid">
                        {(['Tunai', 'Transfer', 'TTD'] as const).map(method => (
                          <button
                            key={method}
                            type="button"
                            disabled={savingItem}
                            onClick={() => {
                              setPayMethod(method);
                              if (method === 'Tunai' && !nominalInput) {
                                setNominalInput(String(item.nilaiFaktur || ''));
                              }
                            }}
                            className={`cv75-pay-btn ${payMethod === method ? 'cv75-pay-btn--active' : ''}`}
                          >
                            <span>{method === 'TTD' ? 'TTD / BT' : method}</span>
                          </button>
                        ))}
                      </div>
                    </div>

                    {payMethod === 'Tunai' && (
                      <label className="cv66-field">
                        <div className="flex items-center justify-between gap-2">
                          <span>Nominal Tunai Diterima (Rp)</span>
                          <button
                            type="button"
                            onClick={() => setNominalInput(String(item.nilaiFaktur || 0))}
                            className="cv75-chip"
                          >
                            Penuh ({formatRp(item.nilaiFaktur)})
                          </button>
                        </div>
                        <input
                          type="number"
                          inputMode="numeric"
                          min={0}
                          className="cv75-input"
                          value={nominalInput}
                          onChange={e => setNominalInput(e.target.value)}
                          placeholder="Masukkan nominal setoran tunai"
                          disabled={savingItem}
                        />
                      </label>
                    )}

                    {payMethod === 'Transfer' && (
                      <div className="rounded-xl bg-blue-50 border border-blue-200 px-3 py-2 text-xs text-blue-800">
                        Pembayaran <strong>Transfer</strong> akan diteruskan ke Menu Keuangan untuk verifikasi mutasi rekening.
                      </div>
                    )}

                    {payMethod === 'TTD' && (
                      <div className="space-y-2.5">
                        <label className="cv66-field">
                          <span>Nama Penerima / Penandatangan</span>
                          <input
                            type="text"
                            className="cv75-input"
                            value={signerInput}
                            onChange={e => setSignerInput(e.target.value)}
                            placeholder={item.namaPelanggan || 'Nama penerima di toko'}
                            disabled={savingItem}
                          />
                        </label>
                        <MiniSignaturePad
                          value={ttdDataUrl}
                          disabled={savingItem}
                          onChange={setTtdDataUrl}
                        />
                      </div>
                    )}

                    <label className="cv66-field">
                      <span>Keterangan / Catatan Retur Toko (Opsional)</span>
                      <textarea
                        rows={2}
                        value={noteInput}
                        onChange={e => setNoteInput(e.target.value)}
                        placeholder="Misal: Lunas dititipkan kasir / retur 1 dus rusak"
                        disabled={savingItem}
                      />
                    </label>

                    <Button
                      type="button"
                      loading={savingItem}
                      disabled={savingItem || busy}
                      onClick={() => void handleSaveItem(item)}
                    >
                      <Check size={16} />
                      <span>Simpan Pembayaran Faktur Ini</span>
                    </Button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Rekap & Sinkron Akhir */}
      <label className="cv66-field">
        <span>Catatan Keseluruhan Manifest (Opsional)</span>
        <textarea
          value={summaryNote}
          onChange={e => setSummaryNote(e.target.value)}
          maxLength={1200}
          rows={2}
          placeholder="Ringkasan serah terima tagihan, setoran tunai, atau selisih barang"
          disabled={busy || savingItem}
        />
      </label>

      <Button
        type="button"
        disabled={busy || savingItem}
        loading={savingItem}
        onClick={() => void handleConfirmAllManifest()}
      >
        <Check size={18} />
        <span>Kirim Rekap Form Kirim ke Keuangan</span>
      </Button>
    </div>
  );
};
