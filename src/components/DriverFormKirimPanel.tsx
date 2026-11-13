import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  CheckCircle2,
  FileSpreadsheet,
  Navigation,
  PenTool,
  RefreshCw,
  Save,
  Trash2,
  Truck,
  X,
  Layers,
  Banknote,
  Check,
  Calculator,
  Landmark,
  Delete
} from 'lucide-react';
import {
  formKirimStore,
  FormKirimRecord,
  FormKirimInvoiceItem
} from '../services/formKirimStore';
import { logisticsStore } from '../services/store';

interface DriverFormKirimPanelProps {
  todayFormKirim: FormKirimRecord | null;
  todayDisplayDate: string;
  matchedScheduleArea?: string;
  portalDisplayName: string;
  onRefresh: () => void;
  onNotify: (title: string, message: string) => void;
}

function isNonGudangFaktur(noFaktur: string): boolean {
  const clean = String(noFaktur || '').trim().toUpperCase();
  if (!clean) return false;
  const isGudangPrefix = /^(?:FJ02BS|FJ02B|FJ02)(?:[-\s/\d]|$)/.test(clean);
  return !isGudangPrefix;
}

function formatRibuan(val: number): string {
  const num = Number(val) || 0;
  return num.toLocaleString('id-ID', { maximumFractionDigits: 2 });
}

function parseNominalInput(raw: string): number {
  const s = String(raw || '')
    .trim()
    .replace(/^[Rr][Pp]\.?\s*/g, '')
    .replace(/\s+/g, '');
  if (!s) return 0;
  let normalized = s;
  if (s.includes(',') && s.includes('.')) {
    normalized = s.replace(/\./g, '').replace(',', '.');
  } else if (s.includes(',')) {
    normalized = s.replace(',', '.');
  } else if (s.includes('.')) {
    const parts = s.split('.');
    if (parts.length === 2 && parts[1].length > 0 && parts[1].length <= 2) {
      normalized = s;
    } else {
      normalized = s.replace(/\./g, '');
    }
  }
  const n = Number(normalized);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

function normalizeCustomerKey(name: string): string {
  return String(name || '')
    .trim()
    .replace(/\s+/g, ' ')
    .toUpperCase();
}

type PaymentChoice = 'Tunai' | 'Transfer' | 'TTD';

interface CustomerInvoiceGroup {
  customerKey: string;
  customerName: string;
  customerNumber: number;
  category: 'COD' | 'TEMPO';
  items: FormKirimInvoiceItem[];
  totalTagihan: number;
  totalColy: number;
  totalTunaiDiterima: number;
  allSigned: boolean;
  anySigned: boolean;
  savedMethod: PaymentChoice | null;
}

interface SignatureTarget {
  label: string;
  itemIds: string[];
  initialSignerName?: string;
}

interface CalculatorContext {
  targetKey: string;
  customerName: string;
  items: FormKirimInvoiceItem[];
  onApplyTotal: (amount: number) => void;
}

function evaluateCalc(a: number, op: string, b: number): number {
  switch (op) {
    case '+':
      return a + b;
    case '-':
      return a - b;
    case '×':
      return a * b;
    case '÷':
      return b !== 0 ? a / b : 0;
    default:
      return b;
  }
}

export const DriverFormKirimPanel: React.FC<DriverFormKirimPanelProps> = ({
  todayFormKirim,
  todayDisplayDate,
  matchedScheduleArea,
  portalDisplayName,
  onRefresh,
  onNotify
}) => {
  const [sectionTab, setSectionTab] = useState<'all' | 'COD' | 'TEMPO'>('all');
  // Gabung vs Per Faktur untuk pelanggan COD > 1 faktur (default true / jadi satu)
  const [combinedModeMap, setCombinedModeMap] = useState<Record<string, boolean>>({});
  // Pilihan aktif yang sedang dibuka user ('Tunai' | 'Transfer' | 'TTD' | null) per targetKey
  const [activeOptionMap, setActiveOptionMap] = useState<Record<string, PaymentChoice | null>>({});
  // Draft input nominal tunai sebelum klik Simpan
  const [draftInputs, setDraftInputs] = useState<Record<string, string>>({});

  // Signature Modal
  const [signatureTarget, setSignatureTarget] = useState<SignatureTarget | null>(null);
  const [signerName, setSignerName] = useState<string>('');
  const [hasDrawnSignature, setHasDrawnSignature] = useState<boolean>(false);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const isDrawingRef = useRef<boolean>(false);

  // Built-in COD Multi-Invoice Calculator Modal
  const [calcContext, setCalcContext] = useState<CalculatorContext | null>(null);
  const [calcSelectedIds, setCalcSelectedIds] = useState<Record<string, boolean>>({});
  const [calcDisplay, setCalcDisplay] = useState<string>('0');
  const [calcStoredVal, setCalcStoredVal] = useState<number | null>(null);
  const [calcPendingOp, setCalcPendingOp] = useState<string | null>(null);
  const [calcResetNext, setCalcResetNext] = useState<boolean>(false);
  const [calcCashGiven, setCalcCashGiven] = useState<string>('');

  // Background auto-sync dengan server agar update Admin/Finance langsung terbaca
  useEffect(() => {
    const syncNow = () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
      void formKirimStore.hydrateFromServer(true);
    };
    const timer = setInterval(syncNow, 25000);
    window.addEventListener('focus', syncNow);
    return () => {
      clearInterval(timer);
      window.removeEventListener('focus', syncNow);
    };
  }, []);

  const armadaMeta = useMemo(() => {
    if (!todayFormKirim) return { initial: '', plate: '', driver: '', helper: '' };
    const fleets = logisticsStore.getFleets();
    const normPlate = (p?: string) => String(p || '').replace(/\s+/g, '').toUpperCase();
    const matchedFleet =
      fleets.find(f => f.id === todayFormKirim.fleetId) ||
      fleets.find(f => normPlate(f.plateNumber) === normPlate(todayFormKirim.plateNumber));
    const schList = logisticsStore.getSchedules();
    const matchedSchedule = schList.find(s => {
      const sDate = String(s.departureDate || s.deliveryDate || '').slice(0, 10);
      const sArea = String(s.areaName || s.store?.city || '').trim().toUpperCase();
      const fkArea = String(todayFormKirim.areaKirim || '').trim().toUpperCase();
      return sDate === todayFormKirim.tanggalKirim && fkArea && sArea === fkArea;
    });
    const initial = String(
      todayFormKirim.armadaInitial ||
        matchedSchedule?.armada ||
        matchedSchedule?.fleet?.initialCode ||
        matchedFleet?.initialCode ||
        ''
    ).trim();
    const driver = String(todayFormKirim.driverName || matchedSchedule?.crew?.name || '').trim();
    const rawHelper = String(todayFormKirim.helperName || matchedSchedule?.crewHelper?.name || '').trim();
    const helper =
      rawHelper && rawHelper.toLowerCase() !== driver.toLowerCase() ? rawHelper : '';
    return {
      initial,
      plate: todayFormKirim.plateNumber || matchedFleet?.plateNumber || '-',
      driver,
      helper
    };
  }, [todayFormKirim]);

  // Reset UI draft & initialize multi-invoice COD combined mode when form changes
  useEffect(() => {
    if (!todayFormKirim?.invoiceItems) return;
    const nextCombined: Record<string, boolean> = {};
    const counts: Record<string, number> = {};
    todayFormKirim.invoiceItems.forEach(it => {
      const k = `${it.paymentCategory}::${normalizeCustomerKey(it.namaPelanggan)}`;
      counts[k] = (counts[k] || 0) + 1;
      if (it.isCombinedPayment) {
        nextCombined[k] = true;
      }
    });
    Object.entries(counts).forEach(([k, count]) => {
      if (count > 1 && k.startsWith('COD::') && nextCombined[k] === undefined) {
        nextCombined[k] = true;
      }
    });
    setCombinedModeMap(prev => ({ ...nextCombined, ...prev }));
    setDraftInputs({});
    setActiveOptionMap({});
  }, [todayFormKirim?.id]);

  // Group COD & TEMPO items by Customer (Pelanggan 1, 2, 3, dst.)
  const {
    codGroups,
    tempoGroups,
    totalTagihan,
    totalTunai,
    transferInvoiceCount,
    ttdInvoiceCount,
    completedCount,
    totalItemsCount,
    totalColyDisplay
  } = useMemo(() => {
    const items = todayFormKirim?.invoiceItems || [];

    const resolveSavedItemMethod = (it: FormKirimInvoiceItem): PaymentChoice | null => {
      if (it.metodeBayarAktual === 'Transfer' || String(it.bayar || '').trim().toUpperCase() === 'TRANSFER') {
        return 'Transfer';
      }
      if (
        it.metodeBayarAktual === 'Tunai' &&
        (Number(it.nominalDiterima) > 0 || Boolean(it.isCombinedPayment))
      ) {
        return 'Tunai';
      }
      if (it.ttdDataUrl || it.metodeBayarAktual === 'TTD') {
        return 'TTD';
      }
      return null;
    };

    const buildGroups = (list: FormKirimInvoiceItem[], category: 'COD' | 'TEMPO', startNo: number) => {
      const map = new Map<string, FormKirimInvoiceItem[]>();
      list.forEach(it => {
        const cKey = normalizeCustomerKey(it.namaPelanggan) || `PELANGGAN-${it.id}`;
        const existing = map.get(cKey);
        if (existing) existing.push(it);
        else map.set(cKey, [it]);
      });
      const groups: CustomerInvoiceGroup[] = [];
      let idx = startNo;
      map.forEach((groupItems, customerKey) => {
        const totalTagihanGrp = groupItems.reduce((s, it) => s + (Number(it.nilaiFaktur) || 0), 0);
        const totalColyGrp = groupItems.reduce((s, it) => s + (Number(it.coly) || 0), 0);
        const totalTunaiGrp = groupItems
          .filter(it => it.metodeBayarAktual === 'Tunai' && Number(it.nominalDiterima) > 0)
          .reduce((s, it) => s + (Number(it.nominalDiterima) || 0), 0);
        const anyTunaiMethod = groupItems.some(
          it =>
            it.metodeBayarAktual === 'Tunai' &&
            (Number(it.nominalDiterima) > 0 || Boolean(it.isCombinedPayment))
        );

        const allTransfer = groupItems.every(it => resolveSavedItemMethod(it) === 'Transfer');
        const allSigned = groupItems.every(it => Boolean(it.ttdDataUrl));
        const anySigned = groupItems.some(it => Boolean(it.ttdDataUrl));
        const savedMethod: PaymentChoice | null =
          anyTunaiMethod || totalTunaiGrp > 0
            ? 'Tunai'
            : allTransfer
            ? 'Transfer'
            : allSigned
            ? 'TTD'
            : null;

        groups.push({
          customerKey,
          customerName: groupItems[0]?.namaPelanggan || customerKey,
          customerNumber: idx++,
          category,
          items: groupItems,
          totalTagihan: totalTagihanGrp,
          totalColy: totalColyGrp,
          totalTunaiDiterima: totalTunaiGrp,
          allSigned,
          anySigned,
          savedMethod
        });
      });
      return groups;
    };

    const codList = items.filter(it => it.paymentCategory === 'COD');
    const tempoList = items.filter(it => it.paymentCategory === 'TEMPO');
    const codGrps = buildGroups(codList, 'COD', 1);
    const tempoGrps = buildGroups(tempoList, 'TEMPO', codGrps.length + 1);

    const totTagihan =
      items.length > 0
        ? items.reduce((s, it) => s + (Number(it.nilaiFaktur) || 0), 0)
        : Number(todayFormKirim?.totalNominalFaktur) || 0;

    // Hanya nominal Tunai yang dihitung sebagai uang setoran tunai
    const totTunai = items
      .filter(it => it.metodeBayarAktual === 'Tunai' && Number(it.nominalDiterima) > 0)
      .reduce((s, it) => s + (Number(it.nominalDiterima) || 0), 0);

    const trfCount = items.filter(it => resolveSavedItemMethod(it) === 'Transfer').length;
    const ttdCount = items.filter(it => Boolean(it.ttdDataUrl)).length;
    const doneCount = items.filter(it => resolveSavedItemMethod(it) !== null).length;

    const colySum =
      items.length > 0
        ? items.reduce((s, it) => s + (Number(it.coly) || 0), 0) || Number(todayFormKirim?.totalColli) || 0
        : Number(todayFormKirim?.totalColli) || 0;

    return {
      codGroups: codGrps,
      tempoGroups: tempoGrps,
      totalTagihan: totTagihan,
      totalTunai: totTunai,
      transferInvoiceCount: trfCount,
      ttdInvoiceCount: ttdCount,
      completedCount: doneCount,
      totalItemsCount: items.length,
      totalColyDisplay: colySum
    };
  }, [todayFormKirim]);

  const persistUpdatedItems = (nextItems: FormKirimInvoiceItem[]) => {
    if (!todayFormKirim) return;
    formKirimStore.updateInvoiceItems(
      todayFormKirim.id,
      nextItems,
      `Diinput oleh ${portalDisplayName}`
    );
  };

  // Save Combined Tunai across all invoices of one customer
  const handleSaveCombinedTunai = (group: CustomerInvoiceGroup, amount: number, targetKey: string) => {
    if (!todayFormKirim?.invoiceItems) return;
    if (amount <= 0) {
      onNotify('Nominal Belum Diisi', `Masukkan nominal tunai lebih dari Rp 0 untuk ${group.customerName}.`);
      return;
    }
    const targetIds = new Set(group.items.map(it => it.id));
    const groupCombinedId = `CMB-${group.category}-${group.customerKey}`;
    const nowIso = new Date().toISOString();
    let remaining = Math.max(0, amount);

    const updated = todayFormKirim.invoiceItems.map(it => {
      if (!targetIds.has(it.id)) return it;
      const idxInGroup = group.items.findIndex(g => g.id === it.id);
      const isLast = idxInGroup === group.items.length - 1;
      let allocated = 0;
      if (isLast) {
        allocated = remaining;
      } else {
        allocated = Math.min(remaining, Number(it.nilaiFaktur) || 0);
        remaining = Math.max(0, remaining - allocated);
      }
      return {
        ...it,
        nominalDiterima: allocated,
        bayar: allocated > 0 ? String(allocated) : '0',
        metodeBayarAktual: 'Tunai' as const,
        isCombinedPayment: true,
        combinedGroupId: groupCombinedId,
        driverUpdatedBy: portalDisplayName,
        driverUpdatedAt: nowIso
      };
    });

    persistUpdatedItems(updated);
    setDraftInputs(prev => ({ ...prev, [targetKey]: formatRibuan(amount) }));
    setActiveOptionMap(prev => ({ ...prev, [targetKey]: null }));
    onNotify(
      'Setoran Tunai Tersimpan',
      `${group.customerName} (${group.items.length} Faktur): Tunai Rp ${formatRibuan(amount)} disimpan.`
    );
  };

  // Save Single Invoice Tunai
  const handleSaveSingleTunai = (item: FormKirimInvoiceItem, amount: number, targetKey: string) => {
    if (!todayFormKirim?.invoiceItems) return;
    if (amount <= 0) {
      onNotify('Nominal Belum Diisi', `Masukkan nominal tunai lebih dari Rp 0 untuk ${item.noFaktur}.`);
      return;
    }
    const nowIso = new Date().toISOString();
    const updated = todayFormKirim.invoiceItems.map(it => {
      if (it.id !== item.id) return it;
      return {
        ...it,
        nominalDiterima: Math.max(0, amount),
        bayar: String(amount),
        metodeBayarAktual: 'Tunai' as const,
        isCombinedPayment: false,
        combinedGroupId: undefined,
        driverUpdatedBy: portalDisplayName,
        driverUpdatedAt: nowIso
      };
    });

    persistUpdatedItems(updated);
    setDraftInputs(prev => ({ ...prev, [targetKey]: formatRibuan(amount) }));
    setActiveOptionMap(prev => ({ ...prev, [targetKey]: null }));
    onNotify(
      'Setoran Tunai Tersimpan',
      `${item.namaPelanggan} (${item.noFaktur}): Tunai Rp ${formatRibuan(amount)} disimpan.`
    );
  };

  // Save Transfer (NO nominal input; clears cash nominal so Transfer nominal never appears at bottom)
  const handleSaveTransfer = (itemIds: string[], label: string, targetKey: string, isCombined: boolean) => {
    if (!todayFormKirim?.invoiceItems) return;
    const idSet = new Set(itemIds);
    const nowIso = new Date().toISOString();
    const updated = todayFormKirim.invoiceItems.map(it => {
      if (!idSet.has(it.id)) return it;
      return {
        ...it,
        nominalDiterima: 0,
        bayar: 'Transfer',
        metodeBayarAktual: 'Transfer' as const,
        isCombinedPayment: isCombined,
        combinedGroupId: isCombined ? it.combinedGroupId : undefined,
        driverUpdatedBy: portalDisplayName,
        driverUpdatedAt: nowIso
      };
    });
    persistUpdatedItems(updated);
    setActiveOptionMap(prev => ({ ...prev, [targetKey]: null }));
    onNotify('Transfer Tersimpan', `${label} dikonfirmasi bayar via Transfer.`);
  };

  // Signature Canvas Handlers
  const openSignatureModal = (target: SignatureTarget) => {
    setSignatureTarget(target);
    setSignerName(target.initialSignerName || '');
    setHasDrawnSignature(false);
    setTimeout(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }, 30);
  };

  const clearSignatureCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    setHasDrawnSignature(false);
  };

  const getPointerPos = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY
    };
  };

  const handleCanvasPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.setPointerCapture(e.pointerId);
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const { x, y } = getPointerPos(e);
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 2.6;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(x, y);
    isDrawingRef.current = true;
    setHasDrawnSignature(true);
  };

  const handleCanvasPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawingRef.current) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const { x, y } = getPointerPos(e);
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const handleCanvasPointerUp = () => {
    isDrawingRef.current = false;
  };

  const handleSaveSignature = () => {
    if (!signatureTarget || !todayFormKirim?.invoiceItems || !canvasRef.current) return;
    if (!hasDrawnSignature) {
      onNotify('TTD Kosong', 'Silakan goreskan tanda tangan pelanggan pada area kanvas.');
      return;
    }
    const dataUrl = canvasRef.current.toDataURL('image/png');
    const idSet = new Set(signatureTarget.itemIds);
    const nowIso = new Date().toISOString();
    const updated = todayFormKirim.invoiceItems.map(it => {
      if (!idSet.has(it.id)) return it;
      const isTempo = it.paymentCategory === 'TEMPO' || Number(it.netDays) > 0;
      const keepExistingCodMethod =
        !isTempo &&
        (it.metodeBayarAktual === 'Transfer' ||
          (it.metodeBayarAktual === 'Tunai' && (Number(it.nominalDiterima) > 0 || Boolean(it.isCombinedPayment))));
      return {
        ...it,
        ttdDataUrl: dataUrl,
        ttdSignerName: signerName.trim() || it.namaPelanggan,
        ttdSignedAt: nowIso,
        nominalDiterima: isTempo ? 0 : it.nominalDiterima,
        bayar: isTempo ? 'TTD' : it.bayar,
        metodeBayarAktual: isTempo
          ? ('TTD' as const)
          : keepExistingCodMethod
          ? it.metodeBayarAktual
          : ('TTD' as const),
        driverUpdatedBy: portalDisplayName,
        driverUpdatedAt: nowIso
      };
    });
    persistUpdatedItems(updated);
    onNotify('TTD Tersimpan', `Tanda tangan untuk ${signatureTarget.label} berhasil disimpan.`);
    setSignatureTarget(null);
  };

  const handleRemoveSignature = (itemIds: string[]) => {
    if (!todayFormKirim?.invoiceItems) return;
    const idSet = new Set(itemIds);
    const nowIso = new Date().toISOString();
    const updated = todayFormKirim.invoiceItems.map(it => {
      if (!idSet.has(it.id)) return it;
      return {
        ...it,
        ttdDataUrl: undefined,
        ttdSignerName: undefined,
        ttdSignedAt: undefined,
        metodeBayarAktual: it.metodeBayarAktual === 'TTD' ? undefined : it.metodeBayarAktual,
        driverUpdatedBy: portalDisplayName,
        driverUpdatedAt: nowIso
      };
    });
    persistUpdatedItems(updated);
  };

  // Calculator Modal Helpers (for multi-invoice COD)
  const openCalculatorModal = (ctx: CalculatorContext) => {
    const initialChecked: Record<string, boolean> = {};
    let sum = 0;
    ctx.items.forEach(it => {
      initialChecked[it.id] = true;
      sum += Number(it.nilaiFaktur) || 0;
    });
    setCalcSelectedIds(initialChecked);
    setCalcContext(ctx);
    setCalcDisplay(sum > 0 ? String(Math.round(sum * 100) / 100) : '0');
    setCalcStoredVal(null);
    setCalcPendingOp(null);
    setCalcResetNext(false);
    setCalcCashGiven('');
  };

  const calcCheckedTotal = useMemo(() => {
    if (!calcContext) return 0;
    return calcContext.items
      .filter(it => calcSelectedIds[it.id])
      .reduce((s, it) => s + (Number(it.nilaiFaktur) || 0), 0);
  }, [calcContext, calcSelectedIds]);

  const calcNumericValue = useMemo(() => {
    const n = Number(calcDisplay);
    return Number.isFinite(n) ? n : 0;
  }, [calcDisplay]);

  const handleCalcDigit = (d: string) => {
    if (calcResetNext) {
      setCalcDisplay(d === '.' ? '0.' : d === '000' ? '0' : d);
      setCalcResetNext(false);
      return;
    }
    if (d === '.' && calcDisplay.includes('.')) return;
    if (calcDisplay === '0' && d !== '.') {
      setCalcDisplay(d === '000' ? '0' : d);
      return;
    }
    setCalcDisplay(prev => `${prev}${d}`.slice(0, 14));
  };

  const handleCalcOperator = (op: string) => {
    const current = Number(calcDisplay) || 0;
    if (calcStoredVal !== null && calcPendingOp && !calcResetNext) {
      const result = evaluateCalc(calcStoredVal, calcPendingOp, current);
      const rounded = Math.round(result * 100) / 100;
      setCalcStoredVal(rounded);
      setCalcDisplay(String(rounded));
    } else {
      setCalcStoredVal(current);
    }
    setCalcPendingOp(op);
    setCalcResetNext(true);
  };

  const handleCalcEquals = () => {
    if (calcStoredVal === null || !calcPendingOp) return;
    const current = Number(calcDisplay) || 0;
    const result = evaluateCalc(calcStoredVal, calcPendingOp, current);
    const rounded = Math.round(result * 100) / 100;
    setCalcDisplay(String(rounded));
    setCalcStoredVal(null);
    setCalcPendingOp(null);
    setCalcResetNext(true);
  };

  const handleCalcClear = () => {
    setCalcDisplay('0');
    setCalcStoredVal(null);
    setCalcPendingOp(null);
    setCalcResetNext(false);
  };

  const handleCalcBackspace = () => {
    if (calcResetNext) {
      setCalcDisplay('0');
      setCalcResetNext(false);
      return;
    }
    setCalcDisplay(prev => (prev.length <= 1 ? '0' : prev.slice(0, -1)));
  };

  // Empty State: No Form Kirim matching today's schedule yet
  if (!todayFormKirim) {
    return (
      <div className="space-y-4">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 text-center space-y-3 shadow-lg">
          <div className="w-12 h-12 rounded-2xl bg-blue-500/10 border border-blue-500/30 text-blue-400 flex items-center justify-center mx-auto">
            <FileSpreadsheet className="w-6 h-6" />
          </div>
          <div className="space-y-1">
            <h2 className="text-sm font-black text-white">Belum Ada Form Kirim Hari Ini</h2>
            <p className="text-xs text-slate-400 leading-relaxed">
              Tanggal: <strong className="text-slate-200">{todayDisplayDate}</strong>
              {matchedScheduleArea ? (
                <>
                  {' '}• Area Jadwal: <strong className="text-amber-300">{matchedScheduleArea}</strong>
                </>
              ) : null}
            </p>
            <p className="text-[11px] text-slate-400 leading-relaxed pt-1">
              Form Kirim Barang akan tampil otomatis di sini (1 form untuk hari ini) setelah Admin membuat jadwal dan menyimpan Form Kirim sesuai area pengiriman hari ini.
            </p>
          </div>
          <button
            type="button"
            onClick={onRefresh}
            className="inline-flex items-center gap-2 px-4 min-h-[44px] rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition active:scale-95 cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Sinkronkan Form Kirim</span>
          </button>
        </div>
      </div>
    );
  }

  const visibleGroups =
    sectionTab === 'COD'
      ? codGroups
      : sectionTab === 'TEMPO'
      ? tempoGroups
      : [...codGroups, ...tempoGroups];

  // Reusable 3-choice payment control (Tunai | Transfer | TTD)
  const renderThreeOptionFlow = (opts: {
    targetKey: string;
    label: string;
    totalTagihan: number;
    savedMethod: PaymentChoice | null;
    savedTunaiAmount: number;
    hasSignature: boolean;
    signerLabel?: string;
    ttdDataUrl?: string;
    itemIds: string[];
    isCombinedCod: boolean;
    groupItems?: FormKirimInvoiceItem[];
    onSaveTunai: (amount: number) => void;
    onSaveTransfer: () => void;
    onOpenSignature: () => void;
    onRemoveSignature: () => void;
  }) => {
    const activeChoice = activeOptionMap[opts.targetKey] || null;
    const isTunaiOpen = activeChoice === 'Tunai';
    const isTransferOpen = activeChoice === 'Transfer';

    const inputVal =
      draftInputs[opts.targetKey] !== undefined
        ? draftInputs[opts.targetKey]
        : opts.savedTunaiAmount > 0
        ? formatRibuan(opts.savedTunaiAmount)
        : '';

    const selectChoice = (choice: PaymentChoice) => {
      if (choice === 'TTD') {
        setActiveOptionMap(prev => ({ ...prev, [opts.targetKey]: null }));
        opts.onOpenSignature();
        return;
      }
      if (choice === 'Tunai') {
        setActiveOptionMap(prev => ({
          ...prev,
          [opts.targetKey]: prev[opts.targetKey] === 'Tunai' ? null : 'Tunai'
        }));
        if (draftInputs[opts.targetKey] === undefined && opts.savedTunaiAmount > 0) {
          setDraftInputs(prev => ({
            ...prev,
            [opts.targetKey]: formatRibuan(opts.savedTunaiAmount)
          }));
        }
        return;
      }
      // Transfer
      setActiveOptionMap(prev => ({
        ...prev,
        [opts.targetKey]: prev[opts.targetKey] === 'Transfer' ? null : 'Transfer'
      }));
    };

    return (
      <div className="space-y-2.5">
        {/* Saved Status Summary Strip */}
        {(opts.savedMethod || opts.hasSignature) && (
          <div className="flex flex-wrap items-center justify-between gap-2 px-2.5 py-2 rounded-xl bg-emerald-50 border border-emerald-200 text-[11px]">
            <div className="flex items-center gap-2 min-w-0">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <div className="min-w-0 font-bold text-emerald-900 truncate">
                {opts.savedMethod === 'Tunai' && (
                  <span>Tersimpan · Tunai Rp {formatRibuan(opts.savedTunaiAmount)}</span>
                )}
                {opts.savedMethod === 'Transfer' && (
                  <span>Tersimpan · Transfer</span>
                )}
                {opts.savedMethod === 'TTD' && !opts.ttdDataUrl && (
                  <span>Tersimpan · TTD</span>
                )}
                {opts.ttdDataUrl && opts.savedMethod !== 'Tunai' && opts.savedMethod !== 'Transfer' && (
                  <span>Tersimpan · TTD ({opts.signerLabel || 'Penerima'})</span>
                )}
              </div>
            </div>
            {opts.ttdDataUrl && (
              <div className="flex items-center gap-1.5 shrink-0">
                <img
                  src={opts.ttdDataUrl}
                  alt="TTD"
                  className="h-6 w-12 object-contain bg-white rounded border border-emerald-300"
                />
                <button
                  type="button"
                  onClick={opts.onRemoveSignature}
                  className="p-1 text-rose-500 hover:text-rose-700 cursor-pointer"
                  title="Hapus TTD"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>
        )}

        {/* 3 Pilihan Utama: Tunai | Transfer | TTD */}
        <div className="grid grid-cols-3 gap-1.5">
          <button
            type="button"
            onClick={() => selectChoice('Tunai')}
            className={`min-h-[44px] px-2 rounded-xl border text-[11px] font-black flex items-center justify-center gap-1.5 transition cursor-pointer ${
              isTunaiOpen || opts.savedMethod === 'Tunai'
                ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                : 'bg-white text-slate-700 border-slate-300 hover:border-slate-400 hover:bg-slate-50'
            }`}
          >
            <Banknote className="w-3.5 h-3.5 shrink-0" />
            <span>Tunai</span>
          </button>

          <button
            type="button"
            onClick={() => selectChoice('Transfer')}
            className={`min-h-[44px] px-2 rounded-xl border text-[11px] font-black flex items-center justify-center gap-1.5 transition cursor-pointer ${
              isTransferOpen || opts.savedMethod === 'Transfer'
                ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                : 'bg-white text-slate-700 border-slate-300 hover:border-slate-400 hover:bg-slate-50'
            }`}
          >
            <Landmark className="w-3.5 h-3.5 shrink-0" />
            <span>Transfer</span>
          </button>

          <button
            type="button"
            onClick={() => selectChoice('TTD')}
            className={`min-h-[44px] px-2 rounded-xl border text-[11px] font-black flex items-center justify-center gap-1.5 transition cursor-pointer ${
              opts.hasSignature
                ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                : 'bg-white text-slate-700 border-slate-300 hover:border-slate-400 hover:bg-slate-50'
            }`}
          >
            <PenTool className="w-3.5 h-3.5 shrink-0" />
            <span>{opts.hasSignature ? 'Ubah TTD' : 'TTD'}</span>
          </button>
        </div>

        {/* Panel Input Nominal (HANYA MUNCUL KETIKA PILIH TUNAI) */}
        {isTunaiOpen && (
          <div className="bg-emerald-50/90 border border-emerald-300 rounded-xl p-3 space-y-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-[11px] font-black text-emerald-950">
                {opts.isCombinedCod
                  ? `Input Tunai Gabungan (${opts.groupItems?.length || 0} Faktur)`
                  : 'Input Nominal Tunai'}
              </span>
              <div className="flex items-center gap-1.5">
                {opts.isCombinedCod && opts.groupItems && opts.groupItems.length > 1 && (
                  <button
                    type="button"
                    onClick={() =>
                      openCalculatorModal({
                        targetKey: opts.targetKey,
                        customerName: opts.label,
                        items: opts.groupItems!,
                        onApplyTotal: (val) => {
                          setDraftInputs(prev => ({
                            ...prev,
                            [opts.targetKey]: val > 0 ? formatRibuan(val) : ''
                          }));
                        }
                      })
                    }
                    className="px-2.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-[10px] font-black inline-flex items-center gap-1 transition cursor-pointer"
                  >
                    <Calculator className="w-3 h-3 text-amber-400" />
                    <span>Kalkulator</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() =>
                    setDraftInputs(prev => ({
                      ...prev,
                      [opts.targetKey]: formatRibuan(opts.totalTagihan)
                    }))
                  }
                  className="px-2.5 py-1.5 rounded-lg bg-white hover:bg-emerald-100 border border-emerald-300 text-emerald-800 text-[10px] font-black transition cursor-pointer"
                >
                  Sesuai Total (Rp {formatRibuan(opts.totalTagihan)})
                </button>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-black text-slate-500">
                  Rp
                </span>
                <input
                  type="text"
                  inputMode="decimal"
                  value={inputVal}
                  onChange={e => {
                    const raw = e.target.value;
                    setDraftInputs(prev => ({ ...prev, [opts.targetKey]: raw }));
                  }}
                  onBlur={() => {
                    const parsed = parseNominalInput(inputVal);
                    setDraftInputs(prev => ({
                      ...prev,
                      [opts.targetKey]: parsed > 0 ? formatRibuan(parsed) : ''
                    }));
                  }}
                  placeholder="Masukkan nominal tunai..."
                  className="w-full min-h-[44px] pl-9 pr-3 py-2 rounded-xl bg-white border border-emerald-400 text-xs font-black text-slate-950 focus:outline-none focus:border-emerald-600 tabular-nums"
                />
              </div>

              <button
                type="button"
                onClick={() => {
                  const parsed = parseNominalInput(inputVal);
                  opts.onSaveTunai(parsed);
                }}
                className="min-h-[44px] px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black inline-flex items-center gap-1.5 transition active:scale-95 cursor-pointer shrink-0 shadow-xs"
              >
                <Save className="w-3.5 h-3.5" />
                <span>Simpan</span>
              </button>
            </div>
          </div>
        )}

        {/* Panel Konfirmasi Transfer (TANPA INPUT NOMINAL + TOMBOL SIMPAN) */}
        {isTransferOpen && (
          <div className="bg-blue-50/90 border border-blue-300 rounded-xl p-3 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="text-[11px] font-black text-blue-950">Konfirmasi Pembayaran Transfer</div>
              <div className="text-[10px] text-blue-800 leading-snug">
                Pembayaran non-tunai (nominal tidak masuk ke setoran tunai bawah).
              </div>
            </div>
            <button
              type="button"
              onClick={opts.onSaveTransfer}
              className="min-h-[44px] px-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-black inline-flex items-center gap-1.5 transition active:scale-95 cursor-pointer shrink-0 shadow-xs"
            >
              <Save className="w-3.5 h-3.5" />
              <span>Simpan</span>
            </button>
          </div>
        )}
      </div>
    );
  };

  const renderCustomerGroupCard = (group: CustomerInvoiceGroup) => {
    const modeKey = `${group.category}::${group.customerKey}`;
    const isMultiInvoice = group.items.length > 1;
    const isMultiCod = group.category === 'COD' && isMultiInvoice;
    const isCombinedActive = isMultiCod && (combinedModeMap[modeKey] ?? true);
    const itemIds = group.items.map(i => i.id);
    const firstItem = group.items[0];
    const combinedTargetKey = `cmb::${modeKey}`;

    return (
      <div
        key={modeKey}
        className="bg-white text-slate-900 rounded-2xl border border-slate-300 shadow-sm overflow-hidden"
      >
        {/* Header Pelanggan 1, 2, 3 dst. */}
        <div className="px-3.5 py-2.5 bg-slate-50 border-b border-slate-200 flex items-start justify-between gap-2">
          <div className="flex items-start gap-2.5 min-w-0">
            <div
              className={`w-7 h-7 rounded-xl flex items-center justify-center text-xs font-black shrink-0 mt-0.5 ${
                group.savedMethod || group.allSigned
                  ? 'bg-emerald-600 text-white'
                  : 'bg-blue-600 text-white'
              }`}
            >
              {group.customerNumber}
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-1.5 text-[10px] font-bold text-slate-500">
                <span className="uppercase tracking-wider">Pelanggan {group.customerNumber}</span>
                <span>•</span>
                <span
                  className={`font-black ${
                    group.category === 'COD'
                      ? 'bg-[#FFFF00] text-slate-950 px-1.5 py-0.5 rounded border border-amber-400'
                      : 'text-indigo-700'
                  }`}
                >
                  {group.category}
                </span>
                {isMultiInvoice && (
                  <>
                    <span>•</span>
                    <span className="text-blue-700 font-black">{group.items.length} Faktur</span>
                  </>
                )}
              </div>
              <h3 className="text-xs font-black text-slate-950 mt-0.5 whitespace-normal break-words">
                {group.customerName}
              </h3>
              <p className="text-[11px] text-slate-600 whitespace-normal break-words leading-snug">
                {firstItem?.alamatPelanggan || '-'}
              </p>
            </div>
          </div>

          <div className="text-right shrink-0 space-y-0.5 tabular-nums">
            <div className="text-[10px] font-extrabold text-slate-600">
              {group.totalColy} COLY
            </div>
            <div className="text-xs font-black text-slate-950">
              Rp {formatRibuan(group.totalTagihan)}
            </div>
          </div>
        </div>

        {/* Bar Khusus COD > 1 Faktur: Tunai Jadi Satu + Kalkulator */}
        {isMultiCod && (
          <div className="px-3.5 py-2 bg-blue-50/80 border-b border-blue-200/80 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 text-[11px] font-bold text-blue-900">
              <Layers className="w-3.5 h-3.5 text-blue-600 shrink-0" />
              <span>Gabung {group.items.length} Faktur COD</span>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={() =>
                  openCalculatorModal({
                    targetKey: combinedTargetKey,
                    customerName: group.customerName,
                    items: group.items,
                    onApplyTotal: (val) => {
                      setCombinedModeMap(prev => ({ ...prev, [modeKey]: true }));
                      setActiveOptionMap(prev => ({ ...prev, [combinedTargetKey]: 'Tunai' }));
                      setDraftInputs(prev => ({
                        ...prev,
                        [combinedTargetKey]: val > 0 ? formatRibuan(val) : ''
                      }));
                    }
                  })
                }
                className="px-2.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-[10px] font-black inline-flex items-center gap-1 cursor-pointer transition"
              >
                <Calculator className="w-3 h-3 text-amber-400" />
                <span>Kalkulator</span>
              </button>

              <div className="inline-flex rounded-lg bg-white border border-blue-200 p-0.5">
                <button
                  type="button"
                  onClick={() => setCombinedModeMap(prev => ({ ...prev, [modeKey]: true }))}
                  className={`px-2 py-1 rounded-md text-[10px] font-black transition cursor-pointer ${
                    isCombinedActive
                      ? 'bg-blue-600 text-white'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Jadi Satu
                </button>
                <button
                  type="button"
                  onClick={() => setCombinedModeMap(prev => ({ ...prev, [modeKey]: false }))}
                  className={`px-2 py-1 rounded-md text-[10px] font-black transition cursor-pointer ${
                    !isCombinedActive
                      ? 'bg-blue-600 text-white'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Per Faktur
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Bar Khusus TEMPO > 1 Faktur: Hanya Fitur TTD */}
        {group.category === 'TEMPO' && isMultiInvoice && (
          <div className="px-3.5 py-2 bg-indigo-50/80 border-b border-indigo-200/80 flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 text-[11px] font-bold text-indigo-950 min-w-0">
              <PenTool className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
              <span className="truncate">Pelanggan TEMPO · TTD ({group.items.length} Faktur)</span>
            </div>
            <button
              type="button"
              onClick={() =>
                openSignatureModal({
                  label: `${group.customerName} (${group.items.length} Faktur TEMPO)`,
                  itemIds,
                  initialSignerName: firstItem?.ttdSignerName || group.customerName
                })
              }
              className={`px-3 py-1.5 rounded-lg text-[11px] font-black inline-flex items-center gap-1.5 transition cursor-pointer shrink-0 ${
                group.allSigned
                  ? 'bg-emerald-600 text-white hover:bg-emerald-500'
                  : 'bg-slate-900 text-white hover:bg-slate-800'
              }`}
            >
              <PenTool className="w-3 h-3" />
              <span>{group.allSigned ? 'Ubah TTD Semua' : `TTD Semua (${group.items.length})`}</span>
            </button>
          </div>
        )}

        {/* Daftar Faktur Pelanggan */}
        <div className="divide-y divide-slate-200">
          {isCombinedActive ? (
            <div className="p-3.5 space-y-3">
              {/* Rincian Faktur dalam Gabungan */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl divide-y divide-slate-200">
                {group.items.map(it => {
                  const isBoldSbu = isNonGudangFaktur(it.noFaktur);
                  const hasKet = Boolean((it.keterangan || '').trim());
                  return (
                    <div key={it.id} className="px-3 py-2 text-[11px] space-y-1">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1 whitespace-normal break-words">
                          <span className={isBoldSbu ? 'font-black text-slate-950' : 'font-semibold text-slate-800'}>
                            {it.noFaktur}
                          </span>
                          <span className="text-slate-400 mx-1.5">•</span>
                          <span className="text-slate-500">{it.tglFaktur}</span>
                          {it.coly > 0 && (
                            <span className="text-slate-500 ml-1.5">• {it.coly} COLY</span>
                          )}
                        </div>
                        <div className={`shrink-0 tabular-nums ${isBoldSbu ? 'font-black text-slate-950' : 'font-bold text-slate-800'}`}>
                          Rp {formatRibuan(it.nilaiFaktur)}
                        </div>
                      </div>
                      {hasKet && (
                        <div className="px-2 py-1 rounded bg-[#FFFF00] text-slate-950 font-bold text-[10px] whitespace-normal break-words border border-amber-400">
                          Ket: {it.keterangan}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* 3 Pilihan Gabungan COD: Tunai (+ Kalkulator + Simpan) | Transfer (+ Simpan) | TTD (+ Simpan TTD) */}
              {renderThreeOptionFlow({
                targetKey: combinedTargetKey,
                label: `${group.customerName} (${group.items.length} Faktur COD)`,
                totalTagihan: group.totalTagihan,
                savedMethod: group.savedMethod,
                savedTunaiAmount: group.totalTunaiDiterima,
                hasSignature: group.allSigned,
                signerLabel: firstItem?.ttdSignerName || group.customerName,
                ttdDataUrl: firstItem?.ttdDataUrl,
                itemIds,
                isCombinedCod: true,
                groupItems: group.items,
                onSaveTunai: (amt) => handleSaveCombinedTunai(group, amt, combinedTargetKey),
                onSaveTransfer: () =>
                  handleSaveTransfer(
                    itemIds,
                    `${group.customerName} (${group.items.length} Faktur)`,
                    combinedTargetKey,
                    true
                  ),
                onOpenSignature: () =>
                  openSignatureModal({
                    label: `${group.customerName} (${group.items.length} Faktur COD)`,
                    itemIds,
                    initialSignerName: firstItem?.ttdSignerName || group.customerName
                  }),
                onRemoveSignature: () => handleRemoveSignature(itemIds)
              })}
            </div>
          ) : (
            group.items.map(it => {
              const isBoldSbu = isNonGudangFaktur(it.noFaktur);
              const hasKet = Boolean((it.keterangan || '').trim());
              const singleTargetKey = `single::${it.id}`;
              const isTempoItem = group.category === 'TEMPO' || it.paymentCategory === 'TEMPO' || Number(it.netDays) > 0;
              const itemSavedMethod: PaymentChoice | null =
                it.metodeBayarAktual === 'Transfer' || String(it.bayar || '').trim().toUpperCase() === 'TRANSFER'
                  ? 'Transfer'
                  : it.metodeBayarAktual === 'Tunai' &&
                    (Number(it.nominalDiterima) > 0 || Boolean(it.isCombinedPayment))
                  ? 'Tunai'
                  : it.ttdDataUrl || it.metodeBayarAktual === 'TTD'
                  ? 'TTD'
                  : null;

              return (
                <div key={it.id} className="p-3.5 space-y-2.5">
                  <div className="flex items-start justify-between gap-2 text-[11px]">
                    <div className="min-w-0 flex-1 whitespace-normal break-words">
                      <span className={isBoldSbu ? 'font-black text-slate-950' : 'font-bold text-slate-900'}>
                        {it.noFaktur}
                      </span>
                      <span className="text-slate-400 mx-1.5">•</span>
                      <span className="text-slate-500">{it.tglFaktur}</span>
                      {it.coly > 0 && (
                        <span className="text-slate-600 font-bold ml-1.5">• {it.coly} COLY</span>
                      )}
                    </div>
                    <div className={`shrink-0 text-right tabular-nums ${isBoldSbu ? 'font-black text-slate-950' : 'font-bold text-slate-900'}`}>
                      Rp {formatRibuan(it.nilaiFaktur)}
                    </div>
                  </div>

                  {hasKet && (
                    <div className="px-2.5 py-1.5 rounded-lg bg-[#FFFF00] text-slate-950 font-bold text-[10px] whitespace-normal break-words border border-amber-400">
                      Ket: {it.keterangan}
                    </div>
                  )}

                  {isTempoItem ? (
                    <div className="space-y-2">
                      {it.ttdDataUrl && (
                        <div className="flex flex-wrap items-center justify-between gap-2 px-2.5 py-2 rounded-xl bg-emerald-50 border border-emerald-200 text-[11px]">
                          <div className="flex items-center gap-2 min-w-0">
                            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                            <span className="font-bold text-emerald-900 truncate">
                              Tersimpan · TTD ({it.ttdSignerName || it.namaPelanggan})
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <img
                              src={it.ttdDataUrl}
                              alt="TTD"
                              className="h-6 w-12 object-contain bg-white rounded border border-emerald-300"
                            />
                            <button
                              type="button"
                              onClick={() => handleRemoveSignature([it.id])}
                              className="p-1 text-rose-500 hover:text-rose-700 cursor-pointer"
                              title="Hapus TTD"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      )}

                      <button
                        type="button"
                        onClick={() =>
                          openSignatureModal({
                            label: `${it.namaPelanggan} • ${it.noFaktur}`,
                            itemIds: [it.id],
                            initialSignerName: it.ttdSignerName || it.namaPelanggan
                          })
                        }
                        className={`w-full min-h-[44px] px-3 rounded-xl border text-xs font-black flex items-center justify-center gap-2 transition cursor-pointer ${
                          it.ttdDataUrl
                            ? 'bg-slate-900 text-white border-slate-900 shadow-xs hover:bg-slate-800'
                            : 'bg-white text-slate-800 border-slate-300 hover:border-slate-400 hover:bg-slate-50'
                        }`}
                      >
                        <PenTool className="w-3.5 h-3.5 shrink-0" />
                        <span>{it.ttdDataUrl ? 'Ubah TTD Pelanggan' : 'TTD Pelanggan TEMPO'}</span>
                      </button>
                    </div>
                  ) : (
                    renderThreeOptionFlow({
                      targetKey: singleTargetKey,
                      label: `${it.namaPelanggan} • ${it.noFaktur}`,
                      totalTagihan: Number(it.nilaiFaktur) || 0,
                      savedMethod: itemSavedMethod,
                      savedTunaiAmount: Number(it.nominalDiterima) || 0,
                      hasSignature: Boolean(it.ttdDataUrl),
                      signerLabel: it.ttdSignerName || it.namaPelanggan,
                      ttdDataUrl: it.ttdDataUrl,
                      itemIds: [it.id],
                      isCombinedCod: false,
                      onSaveTunai: (amt) => handleSaveSingleTunai(it, amt, singleTargetKey),
                      onSaveTransfer: () =>
                        handleSaveTransfer([it.id], `${it.namaPelanggan} (${it.noFaktur})`, singleTargetKey, false),
                      onOpenSignature: () =>
                        openSignatureModal({
                          label: `${it.namaPelanggan} • ${it.noFaktur}`,
                          itemIds: [it.id],
                          initialSignerName: it.ttdSignerName || it.namaPelanggan
                        }),
                      onRemoveSignature: () => handleRemoveSignature([it.id])
                    })
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {/* Header Form Kirim Hari Ini */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3 shadow-lg">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-1.5 text-[11px] font-bold">
              {(todayFormKirim.areaKirim || matchedScheduleArea) && (
                <span className="px-2 py-0.5 rounded-md bg-amber-500/15 border border-amber-500/30 text-amber-300 font-black uppercase">
                  {todayFormKirim.areaKirim || matchedScheduleArea}
                </span>
              )}
              {todayFormKirim.driverStatus === 'in_transit' && (
                <span className="text-cyan-400 font-black uppercase">• Di Jalan</span>
              )}
              {todayFormKirim.driverStatus === 'delivered' && (
                <span className="text-emerald-400 font-black uppercase">• Selesai</span>
              )}
            </div>
            <h2 className="text-sm font-black text-white mt-1.5">
              {todayFormKirim.sbuTitle || 'ANUGRAH KEMASAN KREATIF'}
            </h2>
            <p className="text-[11px] text-slate-400 mt-0.5">
              {todayFormKirim.periodLabel || todayDisplayDate}
            </p>
          </div>

          <button
            type="button"
            onClick={onRefresh}
            className="min-h-[40px] min-w-[40px] p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-blue-400 border border-slate-700 transition active:scale-95 cursor-pointer shrink-0 flex items-center justify-center"
            title="Sinkronkan ulang Form Kirim"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>

        {/* Ringkasan Armada, Inisial & Kru */}
        <div className="flex items-center justify-between gap-2 text-[11px] text-slate-300 bg-slate-950/75 px-3 py-2 rounded-xl border border-slate-800">
          <div className="flex flex-wrap items-center gap-1.5 min-w-0">
            <Truck className="w-3.5 h-3.5 text-blue-400 shrink-0" />
            <span className="font-mono font-bold text-white">{armadaMeta.plate}</span>
            {armadaMeta.initial && (
              <span className="px-1.5 py-0.5 rounded bg-blue-500/20 border border-blue-500/35 text-blue-300 font-black text-[10px] uppercase">
                {armadaMeta.initial}
              </span>
            )}
            <span className="text-slate-500">•</span>
            <span className="truncate">
              {armadaMeta.driver}
              {armadaMeta.helper ? ` / ${armadaMeta.helper}` : ''}
            </span>
          </div>
          <span className="font-black text-amber-400 shrink-0 tabular-nums">{totalColyDisplay} COLY</span>
        </div>

        {/* 3 KPI Setoran Hari Ini */}
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800">
            <div className="text-[9px] font-bold uppercase text-slate-400">Total Tagihan</div>
            <div className="text-xs font-black text-white mt-0.5 tabular-nums">
              Rp {formatRibuan(totalTagihan)}
            </div>
          </div>
          <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30">
            <div className="text-[9px] font-bold uppercase text-emerald-300">Setoran Tunai</div>
            <div className="text-xs font-black text-emerald-400 mt-0.5 tabular-nums">
              Rp {formatRibuan(totalTunai)}
            </div>
          </div>
          <div className="p-2.5 rounded-xl bg-blue-500/10 border border-blue-500/30">
            <div className="text-[9px] font-bold uppercase text-blue-300">Faktur Selesai</div>
            <div className="text-xs font-black text-blue-300 mt-0.5 tabular-nums">
              {completedCount} / {totalItemsCount}
            </div>
          </div>
        </div>

        {/* Sub-Tab Filter COD / TEMPO */}
        <div className="grid grid-cols-3 gap-1.5 bg-slate-950 p-1 rounded-xl border border-slate-800 text-[11px]">
          <button
            type="button"
            onClick={() => setSectionTab('all')}
            className={`min-h-[40px] rounded-lg font-bold transition cursor-pointer ${
              sectionTab === 'all' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Semua ({codGroups.length + tempoGroups.length})
          </button>
          <button
            type="button"
            onClick={() => setSectionTab('COD')}
            className={`min-h-[40px] rounded-lg font-bold transition cursor-pointer ${
              sectionTab === 'COD' ? 'bg-[#FFFF00] text-slate-950' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            COD ({codGroups.length})
          </button>
          <button
            type="button"
            onClick={() => setSectionTab('TEMPO')}
            className={`min-h-[40px] rounded-lg font-bold transition cursor-pointer ${
              sectionTab === 'TEMPO' ? 'bg-amber-500 text-slate-950' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            TEMPO ({tempoGroups.length})
          </button>
        </div>
      </div>

      {/* Daftar Pelanggan COD */}
      {(sectionTab === 'all' || sectionTab === 'COD') && codGroups.length > 0 && (
        <div className="space-y-2.5">
          <div className="px-3.5 py-2 rounded-xl bg-[#FFFF00] text-slate-950 flex items-center justify-between text-xs font-black shadow-sm">
            <span>PELANGGAN COD ({codGroups.length} Pelanggan)</span>
            <span className="tabular-nums">
              Rp {formatRibuan(codGroups.reduce((s, g) => s + g.totalTagihan, 0))}
            </span>
          </div>
          {codGroups.map(renderCustomerGroupCard)}
        </div>
      )}

      {/* Daftar Pelanggan TEMPO */}
      {(sectionTab === 'all' || sectionTab === 'TEMPO') && tempoGroups.length > 0 && (
        <div className="space-y-2.5">
          <div className="px-3.5 py-2 rounded-xl bg-[#FFFF00] text-slate-950 flex items-center justify-between text-xs font-black shadow-sm">
            <span>PELANGGAN TEMPO ({tempoGroups.length} Pelanggan)</span>
            <span className="tabular-nums">
              Rp {formatRibuan(tempoGroups.reduce((s, g) => s + g.totalTagihan, 0))}
            </span>
          </div>
          {tempoGroups.map(renderCustomerGroupCard)}
        </div>
      )}

      {visibleGroups.length === 0 && (
        <div className="py-8 text-center bg-slate-900/60 border border-slate-800 rounded-2xl text-xs text-slate-400">
          Tidak ada pelanggan pada kategori ini.
        </div>
      )}

      {/* Rekap Setoran Tim Pengiriman (Tanpa Nominal Transfer) */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3 shadow-lg">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-xs font-black text-white">
            <Banknote className="w-4 h-4 text-emerald-400" />
            <span>Rekap Setoran Tim Pengiriman</span>
          </div>
          <div className="text-[11px] font-semibold text-slate-400 tabular-nums">
            Transfer: {transferInvoiceCount} Faktur • TTD: {ttdInvoiceCount} Faktur
          </div>
        </div>

        {/* Hanya Nominal Tunai yang ditampilkan (Nominal Transfer tidak perlu ada) */}
        <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between">
          <span className="text-xs font-bold text-slate-300">Total Setoran Tunai</span>
          <strong className="text-sm font-black text-emerald-400 tabular-nums">
            Rp {formatRibuan(totalTunai)}
          </strong>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => {
              const items = todayFormKirim.invoiceItems;
              if (items) {
                const nowIso = new Date().toISOString();
                let nextItems = items.map(it => ({ ...it }));
                // Otomatis simpan draft nominal Tunai yang masih terbuka agar tidak ada input tertinggal
                Object.entries(activeOptionMap).forEach(([targetKey, activeChoice]) => {
                  if (activeChoice !== 'Tunai') return;
                  const parsed = parseNominalInput(draftInputs[targetKey] || '');
                  if (parsed <= 0) return;
                  if (targetKey.startsWith('single::')) {
                    const itemId = targetKey.slice('single::'.length);
                    nextItems = nextItems.map(it =>
                      it.id === itemId
                        ? {
                            ...it,
                            nominalDiterima: parsed,
                            bayar: String(parsed),
                            metodeBayarAktual: 'Tunai' as const,
                            isCombinedPayment: false,
                            combinedGroupId: undefined,
                            driverUpdatedBy: portalDisplayName,
                            driverUpdatedAt: nowIso
                          }
                        : it
                    );
                  } else if (targetKey.startsWith('cmb::')) {
                    const modeKey = targetKey.slice('cmb::'.length);
                    const matchingGroup = [...codGroups, ...tempoGroups].find(
                      g => `${g.category}::${g.customerKey}` === modeKey
                    );
                    if (matchingGroup) {
                      const targetIds = new Set(matchingGroup.items.map(g => g.id));
                      const groupCombinedId = `CMB-${matchingGroup.category}-${matchingGroup.customerKey}`;
                      let remaining = parsed;
                      nextItems = nextItems.map(it => {
                        if (!targetIds.has(it.id)) return it;
                        const idxInGroup = matchingGroup.items.findIndex(g => g.id === it.id);
                        const isLast = idxInGroup === matchingGroup.items.length - 1;
                        let allocated = 0;
                        if (isLast) allocated = remaining;
                        else {
                          allocated = Math.min(remaining, Number(it.nilaiFaktur) || 0);
                          remaining = Math.max(0, remaining - allocated);
                        }
                        return {
                          ...it,
                          nominalDiterima: allocated,
                          bayar: allocated > 0 ? String(allocated) : '0',
                          metodeBayarAktual: 'Tunai' as const,
                          isCombinedPayment: true,
                          combinedGroupId: groupCombinedId,
                          driverUpdatedBy: portalDisplayName,
                          driverUpdatedAt: nowIso
                        };
                      });
                    }
                  }
                });
                persistUpdatedItems(nextItems);
                setActiveOptionMap({});
                const nextTunai = nextItems
                  .filter(it => it.metodeBayarAktual === 'Tunai' && Number(it.nominalDiterima) > 0)
                  .reduce((s, it) => s + (Number(it.nominalDiterima) || 0), 0);
                onNotify(
                  'Setoran Tersimpan',
                  `Setoran Tunai Rp ${formatRibuan(nextTunai)}, ${transferInvoiceCount} Transfer, dan ${ttdInvoiceCount} TTD tersimpan & tersinkron ke Finance.`
                );
              }
            }}
            className="min-h-[44px] py-2.5 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-white font-black text-xs flex items-center justify-center gap-1.5 transition active:scale-95 cursor-pointer"
          >
            <Save className="w-3.5 h-3.5 text-emerald-400" />
            <span>Simpan Input Setoran</span>
          </button>

          {todayFormKirim.driverStatus === 'in_transit' ? (
            <button
              type="button"
              onClick={() => {
                formKirimStore.updateDriverExecutionStatus(
                  todayFormKirim.id,
                  'delivered',
                  `Selesai dikirim oleh ${portalDisplayName} (Tunai: Rp ${formatRibuan(totalTunai)}, Transfer: ${transferInvoiceCount} faktur, TTD: ${ttdInvoiceCount} faktur)`
                );
                onNotify(
                  'Form Kirim Selesai',
                  `Pengiriman area ${todayFormKirim.areaKirim || ''} telah diselesaikan.`
                );
              }}
              className="min-h-[44px] py-2.5 px-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs flex items-center justify-center gap-1.5 transition active:scale-95 cursor-pointer shadow-md shadow-emerald-500/20"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>Konfirmasi Selesai Kirim</span>
            </button>
          ) : todayFormKirim.driverStatus === 'delivered' ? (
            <div className="min-h-[44px] py-2.5 px-3 rounded-xl bg-emerald-500/15 border border-emerald-500/35 text-emerald-300 font-black text-xs flex items-center justify-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span>Pengiriman Selesai</span>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => {
                formKirimStore.updateDriverExecutionStatus(
                  todayFormKirim.id,
                  'in_transit',
                  `Diberangkatkan oleh ${portalDisplayName}`
                );
                onNotify(
                  'Form Kirim Berangkat',
                  `Pengiriman area ${todayFormKirim.areaKirim || ''} berstatus Di Jalan.`
                );
              }}
              className="min-h-[44px] py-2.5 px-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-black text-xs flex items-center justify-center gap-1.5 transition active:scale-95 cursor-pointer shadow-md shadow-blue-600/25"
            >
              <Navigation className="w-3.5 h-3.5" />
              <span>Mulai Kirim Form Ini</span>
            </button>
          )}
        </div>
      </div>

      {/* Modal Kalkulator Gabungan COD (> 1 Faktur) */}
      {calcContext && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-t-2xl sm:rounded-2xl p-4 space-y-3 shadow-2xl max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <div className="min-w-0">
                <div className="text-xs font-black text-white flex items-center gap-1.5">
                  <Calculator className="w-4 h-4 text-amber-400 shrink-0" />
                  <span>Kalkulator Tunai Gabungan COD</span>
                </div>
                <div className="text-[11px] text-slate-400 truncate mt-0.5">
                  {calcContext.customerName} • {calcContext.items.length} Faktur
                </div>
              </div>
              <button
                type="button"
                onClick={() => setCalcContext(null)}
                className="p-2 rounded-lg text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Pilih Faktur yang Dijumlahkan */}
            <div className="bg-slate-950 border border-slate-800 rounded-xl divide-y divide-slate-800 max-h-36 overflow-y-auto">
              {calcContext.items.map(it => {
                const checked = Boolean(calcSelectedIds[it.id]);
                return (
                  <label
                    key={it.id}
                    className="flex items-center justify-between gap-2 px-3 py-2 text-[11px] cursor-pointer hover:bg-slate-900"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={e => {
                          const next = { ...calcSelectedIds, [it.id]: e.target.checked };
                          setCalcSelectedIds(next);
                          const nextSum = calcContext.items
                            .filter(x => next[x.id])
                            .reduce((s, x) => s + (Number(x.nilaiFaktur) || 0), 0);
                          setCalcDisplay(String(Math.round(nextSum * 100) / 100));
                          setCalcStoredVal(null);
                          setCalcPendingOp(null);
                          setCalcResetNext(false);
                        }}
                        className="w-4 h-4 rounded accent-emerald-500"
                      />
                      <span className="font-mono font-bold text-slate-200 truncate">{it.noFaktur}</span>
                    </div>
                    <span className="font-black text-amber-300 tabular-nums shrink-0">
                      Rp {formatRibuan(it.nilaiFaktur)}
                    </span>
                  </label>
                );
              })}
            </div>

            {/* Layar Hasil Kalkulator */}
            <div className="bg-slate-950 border border-slate-800 rounded-xl p-3 space-y-1">
              <div className="flex items-center justify-between text-[10px] text-slate-400 tabular-nums">
                <span>Faktur Terpilih: Rp {formatRibuan(calcCheckedTotal)}</span>
                {calcPendingOp && calcStoredVal !== null && (
                  <span className="text-amber-400 font-mono">
                    {formatRibuan(calcStoredVal)} {calcPendingOp}
                  </span>
                )}
              </div>
              <div className="text-right text-2xl font-black text-white tabular-nums tracking-tight break-all">
                Rp {formatRibuan(calcNumericValue)}
              </div>
            </div>

            {/* Hitung Uang Kembalian Opsional */}
            <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-2.5 flex items-center justify-between gap-2 text-[11px]">
              <span className="text-slate-400 font-bold shrink-0">Uang Pelanggan:</span>
              <input
                type="text"
                inputMode="numeric"
                value={calcCashGiven}
                onChange={e => setCalcCashGiven(e.target.value)}
                placeholder="Opsional (Rp)"
                className="w-32 px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-xs font-black text-white text-right tabular-nums focus:outline-none focus:border-blue-500"
              />
              <span className="font-black text-emerald-400 tabular-nums shrink-0">
                {(() => {
                  const cash = parseNominalInput(calcCashGiven);
                  if (!cash) return 'Kembali: -';
                  const diff = cash - calcNumericValue;
                  return diff >= 0
                    ? `Kembali Rp ${formatRibuan(diff)}`
                    : `Kurang Rp ${formatRibuan(Math.abs(diff))}`;
                })()}
              </span>
            </div>

            {/* Keypad Kalkulator Touch-Friendly */}
            <div className="grid grid-cols-4 gap-1.5">
              <button
                type="button"
                onClick={handleCalcClear}
                className="min-h-[46px] rounded-xl bg-rose-500/20 hover:bg-rose-500/30 border border-rose-500/30 text-rose-300 font-black text-xs cursor-pointer"
              >
                C
              </button>
              <button
                type="button"
                onClick={handleCalcBackspace}
                className="min-h-[46px] rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-black text-xs flex items-center justify-center cursor-pointer"
              >
                <Delete className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => handleCalcOperator('÷')}
                className="min-h-[46px] rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 font-black text-base cursor-pointer"
              >
                ÷
              </button>
              <button
                type="button"
                onClick={() => handleCalcOperator('×')}
                className="min-h-[46px] rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 font-black text-base cursor-pointer"
              >
                ×
              </button>

              {['7', '8', '9'].map(d => (
                <button
                  key={d}
                  type="button"
                  onClick={() => handleCalcDigit(d)}
                  className="min-h-[46px] rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-black text-base cursor-pointer"
                >
                  {d}
                </button>
              ))}
              <button
                type="button"
                onClick={() => handleCalcOperator('-')}
                className="min-h-[46px] rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 font-black text-base cursor-pointer"
              >
                −
              </button>

              {['4', '5', '6'].map(d => (
                <button
                  key={d}
                  type="button"
                  onClick={() => handleCalcDigit(d)}
                  className="min-h-[46px] rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-black text-base cursor-pointer"
                >
                  {d}
                </button>
              ))}
              <button
                type="button"
                onClick={() => handleCalcOperator('+')}
                className="min-h-[46px] rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 font-black text-base cursor-pointer"
              >
                +
              </button>

              {['1', '2', '3'].map(d => (
                <button
                  key={d}
                  type="button"
                  onClick={() => handleCalcDigit(d)}
                  className="min-h-[46px] rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-black text-base cursor-pointer"
                >
                  {d}
                </button>
              ))}
              <button
                type="button"
                onClick={handleCalcEquals}
                className="min-h-[46px] rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-black text-base cursor-pointer"
              >
                =
              </button>

              <button
                type="button"
                onClick={() => handleCalcDigit('0')}
                className="min-h-[46px] rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-black text-base cursor-pointer"
              >
                0
              </button>
              <button
                type="button"
                onClick={() => handleCalcDigit('000')}
                className="min-h-[46px] rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-black text-sm cursor-pointer"
              >
                000
              </button>
              <button
                type="button"
                onClick={() => handleCalcDigit('.')}
                className="min-h-[46px] rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-black text-base cursor-pointer"
              >
                ,
              </button>
              <button
                type="button"
                onClick={() => {
                  setCalcDisplay(String(Math.round(calcCheckedTotal * 100) / 100));
                  setCalcStoredVal(null);
                  setCalcPendingOp(null);
                  setCalcResetNext(false);
                }}
                className="min-h-[46px] rounded-xl bg-slate-800 hover:bg-slate-700 text-amber-300 font-black text-[10px] cursor-pointer"
              >
                Total
              </button>
            </div>

            {/* Pakai Hasil ke Input Nominal Tunai */}
            <div className="grid grid-cols-2 gap-2 pt-1">
              <button
                type="button"
                onClick={() => setCalcContext(null)}
                className="min-h-[44px] rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs cursor-pointer"
              >
                Tutup
              </button>
              <button
                type="button"
                onClick={() => {
                  let finalAmount = calcNumericValue;
                  if (calcStoredVal !== null && calcPendingOp && !calcResetNext) {
                    finalAmount = Math.round(evaluateCalc(calcStoredVal, calcPendingOp, finalAmount) * 100) / 100;
                  }
                  calcContext.onApplyTotal(Math.max(0, finalAmount));
                  setCalcContext(null);
                }}
                className="min-h-[44px] rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Check className="w-4 h-4" />
                <span>Pakai ke Tunai</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Canvas Tanda Tangan Pelanggan (COD & TEMPO) */}
      {signatureTarget && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-t-2xl sm:rounded-2xl p-4 space-y-3 shadow-2xl">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <div className="min-w-0">
                <div className="text-xs font-black text-white flex items-center gap-1.5">
                  <PenTool className="w-4 h-4 text-blue-400 shrink-0" />
                  <span>Tanda Tangan Pelanggan</span>
                </div>
                <div className="text-[11px] text-slate-400 truncate mt-0.5">
                  {signatureTarget.label}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSignatureTarget(null)}
                className="p-2 rounded-lg text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-300 mb-1">
                Nama Penerima / PIC Toko
              </label>
              <input
                type="text"
                value={signerName}
                onChange={e => setSignerName(e.target.value)}
                placeholder="Contoh: Bpk. Budi / Kasir Toko"
                className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none focus:border-blue-500"
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-[11px]">
                <span className="font-bold text-slate-300">Goreskan TTD di kotak putih:</span>
                <button
                  type="button"
                  onClick={clearSignatureCanvas}
                  className="text-amber-400 hover:underline font-bold cursor-pointer"
                >
                  Hapus / Ulangi
                </button>
              </div>
              <div className="rounded-xl overflow-hidden border-2 border-slate-700 bg-white">
                <canvas
                  ref={canvasRef}
                  width={380}
                  height={180}
                  onPointerDown={handleCanvasPointerDown}
                  onPointerMove={handleCanvasPointerMove}
                  onPointerUp={handleCanvasPointerUp}
                  onPointerCancel={handleCanvasPointerUp}
                  className="w-full h-44 touch-none cursor-crosshair block"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-1">
              <button
                type="button"
                onClick={() => setSignatureTarget(null)}
                className="min-h-[44px] py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleSaveSignature}
                className="min-h-[44px] py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Check className="w-4 h-4" />
                <span>Simpan TTD</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
