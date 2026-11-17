import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Wrench,
  Receipt,
  Plus,
  Search,
  Truck,
  Calendar,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Edit3,
  Trash2,
  X,
  Download,
  Camera,
  Maximize2,
  Building2,
  CreditCard,
  TrendingUp,
  Layers,
  RefreshCw,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import {
  Fleet,
  FleetMaintenanceCost,
  MaintenanceCategory,
  MaintenancePaymentStatus,
} from '../types';
import { logisticsStore } from '../services/store';
import { branchStore } from '../services/branchStore';
import { sortFleetsByCanonicalOrder } from '../data/mockData';

const MAINTENANCE_CATEGORIES: Array<{
  value: MaintenanceCategory;
  label: string;
  color: string;
}> = [
  { value: 'servis_berkala', label: 'Servis Berkala / Tune Up', color: '#3b82f6' },
  { value: 'ganti_oli', label: 'Ganti Oli & Filter', color: '#f59e0b' },
  { value: 'ban_velg', label: 'Ban, Velg & Spooring', color: '#10b981' },
  { value: 'rem_kopling', label: 'Sistem Rem & Kopling', color: '#ef4444' },
  { value: 'aki_kelistrikan', label: 'Aki & Kelistrikan', color: '#06b6d4' },
  { value: 'mesin_transmisi', label: 'Mesin, Gardan & Transmisi', color: '#8b5cf6' },
  { value: 'body_box_ac', label: 'Perbaikan Box, Bodi & AC', color: '#ec4899' },
  { value: 'pajak_kir_surat', label: 'Biaya Uji KIR / STNK / Pajak', color: '#14b8a6' },
  { value: 'darurat_derek', label: 'Perbaikan Darurat / Derek', color: '#f97316' },
  { value: 'lainnya', label: 'Biaya Pemeliharaan Lainnya', color: '#64748b' },
];

const PAYMENT_STATUS_OPTIONS: MaintenancePaymentStatus[] = [
  'Lunas',
  'Menunggu Approval',
  'Cicilan / Tempo',
  'Dibatalkan',
];

function formatRupiah(amount: number): string {
  return `Rp ${Math.round(amount || 0).toLocaleString('id-ID')}`;
}

function compressReceiptFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Gagal membaca gambar nota.'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Format gambar nota tidak valid.'));
      img.onload = () => {
        const maxDim = 960;
        let w = img.width;
        let h = img.height;
        if (w > maxDim || h > maxDim) {
          if (w >= h) {
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
        if (!ctx) {
          resolve(String(reader.result || ''));
          return;
        }
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL('image/jpeg', 0.78));
      };
      img.src = String(reader.result || '');
    };
    reader.readAsDataURL(file);
  });
}

interface FleetMaintenanceCostManagementProps {
  onNavigateToFleets?: () => void;
  onNavigateToSpareParts?: () => void;
}

export const FleetMaintenanceCostManagement: React.FC<FleetMaintenanceCostManagementProps> = ({
  onNavigateToFleets,
  onNavigateToSpareParts,
}) => {
  const [records, setRecords] = useState<FleetMaintenanceCost[]>([]);
  const [fleets, setFleets] = useState<Fleet[]>(() =>
    sortFleetsByCanonicalOrder(logisticsStore.getFleets())
  );
  const [selectedBranchId, setSelectedBranchId] = useState<string>(() =>
    branchStore.getSelectedOriginBranchId()
  );
  const [branches, setBranches] = useState(() => branchStore.getActiveBranches());

  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(
    null
  );

  // Filters
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [fleetFilter, setFleetFilter] = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [monthFilter, setMonthFilter] = useState<string>('all');

  // Add/Edit modal
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [editingRecord, setEditingRecord] = useState<FleetMaintenanceCost | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<FleetMaintenanceCost | null>(null);
  const [previewPhotoUrl, setPreviewPhotoUrl] = useState<string | null>(null);
  const receiptInputRef = useRef<HTMLInputElement | null>(null);

  const [formState, setFormState] = useState<{
    fleetId: string;
    serviceDate: string;
    category: MaintenanceCategory;
    workTitle: string;
    workshopName: string;
    odometerKm: number;
    partsCost: number;
    laborCost: number;
    otherCost: number;
    paymentStatus: MaintenancePaymentStatus;
    invoiceNumber: string;
    nextServiceKm: string;
    nextServiceDate: string;
    receiptPhotoUrl: string;
    notes: string;
  }>({
    fleetId: '',
    serviceDate: new Date().toISOString().slice(0, 10),
    category: 'servis_berkala',
    workTitle: '',
    workshopName: '',
    odometerKm: 0,
    partsCost: 0,
    laborCost: 0,
    otherCost: 0,
    paymentStatus: 'Lunas',
    invoiceNumber: '',
    nextServiceKm: '',
    nextServiceDate: '',
    receiptPhotoUrl: '',
    notes: '',
  });

  useEffect(() => {
    const unsubStore = logisticsStore.subscribe(() => {
      setFleets(sortFleetsByCanonicalOrder(logisticsStore.getFleets()));
    });
    const unsubBranch = branchStore.subscribe(() => {
      setBranches(branchStore.getActiveBranches());
      setSelectedBranchId(branchStore.getSelectedOriginBranchId());
    });
    return () => {
      unsubStore();
      unsubBranch();
    };
  }, []);

  const fetchMaintenanceCosts = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/fleet-maintenance-costs', { credentials: 'same-origin' });
      const data = await res.json();
      if (res.ok && Array.isArray(data?.data)) {
        setRecords(data.data);
      }
    } catch {
      setFeedback({ type: 'error', text: 'Gagal memuat data biaya servis dari server MySQL.' });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchMaintenanceCosts();
  }, []);

  const branchFleets = useMemo(() => {
    if (selectedBranchId === 'ALL') return fleets;
    return fleets.filter((f) => branchStore.getFleetBranch(f.id).id === selectedBranchId);
  }, [fleets, selectedBranchId]);

  const sparePartUsages = useMemo(() => logisticsStore.getSparePartUsages(), [records, fleets]);

  const availableMonths = useMemo(() => {
    const set = new Set<string>();
    records.forEach((r) => {
      if (r.serviceDate && r.serviceDate.length >= 7) {
        set.add(r.serviceDate.slice(0, 7));
      }
    });
    return Array.from(set).sort().reverse();
  }, [records]);

  const filteredRecords = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return records.filter((r) => {
      if (selectedBranchId !== 'ALL') {
        const flBranch = branchStore.getFleetBranch(r.fleetId).id;
        if (flBranch !== selectedBranchId) return false;
      }
      if (fleetFilter !== 'all' && r.fleetId !== fleetFilter) return false;
      if (categoryFilter !== 'all' && r.category !== categoryFilter) return false;
      if (statusFilter !== 'all' && r.paymentStatus !== statusFilter) return false;
      if (monthFilter !== 'all' && !(r.serviceDate || '').startsWith(monthFilter)) return false;
      if (q) {
        const hay = `${r.plateNumber} ${r.initialCode || ''} ${r.workTitle} ${r.workshopName} ${r.invoiceNumber || ''} ${r.notes || ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [
    records,
    selectedBranchId,
    fleetFilter,
    categoryFilter,
    statusFilter,
    monthFilter,
    searchQuery,
  ]);

  const kpis = useMemo(() => {
    const activeItems = filteredRecords.filter((r) => r.paymentStatus !== 'Dibatalkan');
    const totalAll = activeItems.reduce((acc, r) => acc + Number(r.totalCost || 0), 0);
    const totalParts = activeItems.reduce((acc, r) => acc + Number(r.partsCost || 0), 0);
    const totalLabor = activeItems.reduce((acc, r) => acc + Number(r.laborCost || 0), 0);
    const pendingItems = activeItems.filter((r) => r.paymentStatus === 'Menunggu Approval');
    const pendingAmount = pendingItems.reduce((acc, r) => acc + Number(r.totalCost || 0), 0);

    // Top costliest fleet
    const byFleetMap = new Map<string, { plate: string; initial?: string; total: number; count: number }>();
    activeItems.forEach((r) => {
      const prev = byFleetMap.get(r.fleetId) || {
        plate: r.plateNumber,
        initial: r.initialCode,
        total: 0,
        count: 0,
      };
      prev.total += Number(r.totalCost || 0);
      prev.count += 1;
      byFleetMap.set(r.fleetId, prev);
    });
    const topFleet: { plate: string; initial?: string; total: number; count: number } | null =
      Array.from(byFleetMap.values()).sort((a, b) => b.total - a.total)[0] ?? null;

    // Integrated sparepart usage total (reference metric from Suku Cadang module)
    const sparepartLogTotal = sparePartUsages
      .filter((u) => {
        if (selectedBranchId !== 'ALL') {
          return branchStore.getFleetBranch(u.fleetId).id === selectedBranchId;
        }
        return true;
      })
      .reduce((acc, u) => acc + Number(u.totalCost || 0), 0);

    return {
      totalAll,
      totalParts,
      totalLabor,
      pendingCount: pendingItems.length,
      pendingAmount,
      serviceCount: activeItems.length,
      topFleet,
      sparepartLogTotal,
    };
  }, [filteredRecords, sparePartUsages, selectedBranchId]);

  const chartDataByFleet = useMemo(() => {
    const map = new Map<string, { name: string; parts: number; labor: number; other: number; total: number }>();
    filteredRecords
      .filter((r) => r.paymentStatus !== 'Dibatalkan')
      .forEach((r) => {
        const key = r.initialCode || r.plateNumber;
        const cur = map.get(key) || { name: key, parts: 0, labor: 0, other: 0, total: 0 };
        cur.parts += Number(r.partsCost || 0);
        cur.labor += Number(r.laborCost || 0);
        cur.other += Number(r.otherCost || 0);
        cur.total += Number(r.totalCost || 0);
        map.set(key, cur);
      });
    return Array.from(map.values())
      .sort((a, b) => b.total - a.total)
      .slice(0, 8);
  }, [filteredRecords]);

  const chartDataByCategory = useMemo(() => {
    const map = new Map<MaintenanceCategory, number>();
    filteredRecords
      .filter((r) => r.paymentStatus !== 'Dibatalkan')
      .forEach((r) => {
        map.set(r.category, (map.get(r.category) || 0) + Number(r.totalCost || 0));
      });
    return MAINTENANCE_CATEGORIES.map((cat) => ({
      name: cat.label,
      value: map.get(cat.value) || 0,
      color: cat.color,
    })).filter((c) => c.value > 0);
  }, [filteredRecords]);

  const openAddModal = () => {
    const firstFleet = branchFleets[0] || fleets[0];
    setEditingRecord(null);
    setFormState({
      fleetId: firstFleet?.id || '',
      serviceDate: new Date().toISOString().slice(0, 10),
      category: 'servis_berkala',
      workTitle: '',
      workshopName: 'Bengkel Mitra / Internal AKK',
      odometerKm: firstFleet?.odometerKm || 0,
      partsCost: 0,
      laborCost: 0,
      otherCost: 0,
      paymentStatus: 'Lunas',
      invoiceNumber: '',
      nextServiceKm: '',
      nextServiceDate: '',
      receiptPhotoUrl: '',
      notes: '',
    });
    setIsModalOpen(true);
  };

  const openEditModal = (rec: FleetMaintenanceCost) => {
    setEditingRecord(rec);
    setFormState({
      fleetId: rec.fleetId,
      serviceDate: rec.serviceDate || new Date().toISOString().slice(0, 10),
      category: rec.category,
      workTitle: rec.workTitle,
      workshopName: rec.workshopName,
      odometerKm: rec.odometerKm || 0,
      partsCost: rec.partsCost || 0,
      laborCost: rec.laborCost || 0,
      otherCost: rec.otherCost || 0,
      paymentStatus: rec.paymentStatus,
      invoiceNumber: rec.invoiceNumber || '',
      nextServiceKm: rec.nextServiceKm ? String(rec.nextServiceKm) : '',
      nextServiceDate: rec.nextServiceDate || '',
      receiptPhotoUrl: rec.receiptPhotoUrl || '',
      notes: rec.notes || '',
    });
    setIsModalOpen(true);
  };

  const handleSaveRecord = async (e: React.FormEvent) => {
    e.preventDefault();
    const targetFleet = fleets.find((f) => f.id === formState.fleetId);
    if (!targetFleet || !formState.workTitle.trim()) {
      setFeedback({ type: 'error', text: 'Pilih armada dan isi uraian pekerjaan servis.' });
      return;
    }

    setIsSaving(true);
    const currentUser = logisticsStore.getCurrentUser();
    const totalCost =
      Number(formState.partsCost || 0) +
      Number(formState.laborCost || 0) +
      Number(formState.otherCost || 0);

    const payload: FleetMaintenanceCost = {
      id: editingRecord ? editingRecord.id : `fmc-${Date.now()}`,
      fleetId: targetFleet.id,
      plateNumber: targetFleet.plateNumber,
      initialCode: targetFleet.initialCode,
      vehicleType: targetFleet.vehicleType,
      branchId: branchStore.getFleetBranch(targetFleet.id).id,
      serviceDate: formState.serviceDate,
      category: formState.category,
      workTitle: formState.workTitle.trim(),
      workshopName: formState.workshopName.trim() || 'Bengkel Internal AKK',
      odometerKm: Number(formState.odometerKm || 0),
      partsCost: Number(formState.partsCost || 0),
      laborCost: Number(formState.laborCost || 0),
      otherCost: Number(formState.otherCost || 0),
      totalCost,
      paymentStatus: formState.paymentStatus,
      invoiceNumber: formState.invoiceNumber.trim() || undefined,
      nextServiceKm: formState.nextServiceKm ? Number(formState.nextServiceKm) : undefined,
      nextServiceDate: formState.nextServiceDate || undefined,
      receiptPhotoUrl: formState.receiptPhotoUrl || undefined,
      notes: formState.notes.trim() || undefined,
      createdBy: editingRecord?.createdBy || currentUser?.fullName || 'Admin Logistik',
      createdAt: editingRecord?.createdAt || new Date().toISOString(),
    };

    try {
      const url = editingRecord
        ? `/api/fleet-maintenance-costs/${encodeURIComponent(editingRecord.id)}`
        : '/api/fleet-maintenance-costs';
      const method = editingRecord ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method,
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok || !json?.success) {
        throw new Error(json?.error || 'Gagal menyimpan biaya servis ke MySQL.');
      }

      const saved: FleetMaintenanceCost = json.data || payload;
      setRecords((prev) =>
        editingRecord
          ? prev.map((r) => (r.id === saved.id ? saved : r))
          : [saved, ...prev]
      );
      logisticsStore.logActivity(
        editingRecord ? 'Ubah Biaya Servis Armada' : 'Tambah Biaya Servis Armada',
        `${saved.plateNumber} (${saved.workTitle})`,
        `${editingRecord ? 'Memperbarui' : 'Mencatat'} biaya servis ${saved.plateNumber} sebesar ${formatRupiah(saved.totalCost)} di ${saved.workshopName}`,
        editingRecord ? 'ubah' : 'tambah'
      );
      setIsModalOpen(false);
      setFeedback({
        type: 'success',
        text: `Catatan biaya servis ${saved.plateNumber} (${formatRupiah(saved.totalCost)}) berhasil disimpan ke MySQL.`,
      });
    } catch (err) {
      setFeedback({
        type: 'error',
        text: err instanceof Error ? err.message : 'Gagal menyimpan data biaya servis.',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    const target = deleteTarget;
    setDeleteTarget(null);
    try {
      const res = await fetch(`/api/fleet-maintenance-costs/${encodeURIComponent(target.id)}`, {
        method: 'DELETE',
        credentials: 'same-origin',
      });
      if (!res.ok) throw new Error('Gagal menghapus catatan biaya servis.');
      setRecords((prev) => prev.filter((r) => r.id !== target.id));
      logisticsStore.logActivity(
        'Hapus Biaya Servis Armada',
        `${target.plateNumber} (${target.workTitle})`,
        `Menghapus catatan biaya servis ${target.plateNumber} sebesar ${formatRupiah(target.totalCost)}`,
        'kurangi'
      );
      setFeedback({
        type: 'success',
        text: `Catatan biaya servis ${target.plateNumber} berhasil dihapus.`,
      });
    } catch (err) {
      setFeedback({
        type: 'error',
        text: err instanceof Error ? err.message : 'Gagal menghapus catatan.',
      });
    }
  };

  const handleQuickApprove = async (rec: FleetMaintenanceCost) => {
    const updated: FleetMaintenanceCost = { ...rec, paymentStatus: 'Lunas' };
    try {
      const res = await fetch(`/api/fleet-maintenance-costs/${encodeURIComponent(rec.id)}`, {
        method: 'PUT',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updated),
      });
      if (res.ok) {
        setRecords((prev) => prev.map((r) => (r.id === rec.id ? updated : r)));
        setFeedback({ type: 'success', text: `Status pembayaran ${rec.plateNumber} diperbarui menjadi Lunas.` });
      }
    } catch {
      // Ignore transient error
    }
  };

  const handleExportCsv = () => {
    const headers = [
      'Tanggal',
      'Inisial',
      'Plat Nomor',
      'Tipe Armada',
      'Kategori',
      'Pekerjaan Servis',
      'Bengkel / Mekanik',
      'No Nota',
      'Odometer (KM)',
      'Biaya Suku Cadang (Rp)',
      'Biaya Jasa (Rp)',
      'Biaya Lainnya (Rp)',
      'Total Biaya (Rp)',
      'Status Pembayaran',
      'Dicatat Oleh',
    ];
    const rows = filteredRecords.map((r) => {
      const catLabel = MAINTENANCE_CATEGORIES.find((c) => c.value === r.category)?.label || r.category;
      return [
        r.serviceDate,
        r.initialCode || '-',
        r.plateNumber,
        r.vehicleType,
        catLabel,
        `"${(r.workTitle || '').replace(/"/g, '""')}"`,
        `"${(r.workshopName || '').replace(/"/g, '""')}"`,
        r.invoiceNumber || '-',
        r.odometerKm || 0,
        r.partsCost || 0,
        r.laborCost || 0,
        r.otherCost || 0,
        r.totalCost || 0,
        r.paymentStatus,
        r.createdBy || '-',
      ].join(',');
    });
    const csv = [headers.join(','), ...rows].join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `biaya_servis_armada_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      {/* Header Toolbar */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-sm">
        <div className="flex items-start gap-3">
          <div className="w-11 h-11 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
            <Receipt className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base sm:text-lg font-black text-white tracking-tight">
              Biaya Servis &amp; Pemeliharaan Armada
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Pencatatan biaya bengkel, jasa mekanik, penggantian suku cadang, lampiran nota &amp; kontrol anggaran pemeliharaan armada.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {onNavigateToSpareParts && (
            <button
              type="button"
              onClick={onNavigateToSpareParts}
              className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
            >
              <Wrench className="w-3.5 h-3.5 text-amber-400" />
              <span>Stok Suku Cadang</span>
            </button>
          )}
          {onNavigateToFleets && (
            <button
              type="button"
              onClick={onNavigateToFleets}
              className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
            >
              <Truck className="w-3.5 h-3.5 text-blue-400" />
              <span>Data Armada</span>
            </button>
          )}
          <button
            type="button"
            onClick={handleExportCsv}
            className="px-3 py-2 rounded-xl bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/40 text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export CSV</span>
          </button>
          <button
            type="button"
            onClick={openAddModal}
            className="px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm transition cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Catat Biaya Servis</span>
          </button>
        </div>
      </div>

      {/* Feedback Banner */}
      {feedback && (
        <div
          className={`p-3 rounded-xl border text-xs flex items-center justify-between gap-3 ${
            feedback.type === 'success'
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
              : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
          }`}
        >
          <div className="flex items-center gap-2 font-semibold">
            {feedback.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
            )}
            <span>{feedback.text}</span>
          </div>
          <button
            type="button"
            onClick={() => setFeedback(null)}
            className="text-slate-400 hover:text-white cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* 4 KPI Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-1">
          <div className="flex items-center justify-between text-[11px] font-bold text-slate-400 uppercase tracking-wider">
            <span>Total Biaya Servis</span>
            <Receipt className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-xl font-black text-white font-mono">
            {formatRupiah(kpis.totalAll)}
          </div>
          <div className="text-[11px] text-slate-400">
            Dari {kpis.serviceCount} transaksi perawatan tercatat
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-1">
          <div className="flex items-center justify-between text-[11px] font-bold text-slate-400 uppercase tracking-wider">
            <span>Sparepart vs Jasa Mekanik</span>
            <Layers className="w-4 h-4 text-blue-400" />
          </div>
          <div className="text-base font-black text-cyan-300 font-mono">
            {formatRupiah(kpis.totalParts)}
          </div>
          <div className="text-[11px] text-slate-400">
            Jasa Bengkel: <span className="text-slate-200 font-bold">{formatRupiah(kpis.totalLabor)}</span>
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-1">
          <div className="flex items-center justify-between text-[11px] font-bold text-slate-400 uppercase tracking-wider">
            <span>Menunggu Approval</span>
            <Clock className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-xl font-black text-amber-400 font-mono">
            {formatRupiah(kpis.pendingAmount)}
          </div>
          <div className="text-[11px] text-slate-400">
            {kpis.pendingCount} pengajuan belum lunas / menunggu validasi
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-1">
          <div className="flex items-center justify-between text-[11px] font-bold text-slate-400 uppercase tracking-wider">
            <span>Unit Biaya Tertinggi</span>
            <TrendingUp className="w-4 h-4 text-rose-400" />
          </div>
          <div className="text-base font-black text-white font-mono truncate">
            {kpis.topFleet
              ? `${kpis.topFleet.initial ? `[${kpis.topFleet.initial}] ` : ''}${kpis.topFleet.plate}`
              : '-'}
          </div>
          <div className="text-[11px] text-slate-400">
            {kpis.topFleet
              ? `${formatRupiah(kpis.topFleet.total)} (${kpis.topFleet.count}× servis)`
              : `Referensi log part internal: ${formatRupiah(kpis.sparepartLogTotal)}`}
          </div>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 flex flex-wrap items-center gap-2.5 text-xs">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Cari plat, pekerjaan servis, bengkel, no. nota..."
            className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-slate-100 placeholder:text-slate-500 focus:outline-hidden focus:border-blue-500"
          />
        </div>

        <div className="flex items-center gap-1.5">
          <Building2 className="w-3.5 h-3.5 text-slate-400" />
          <select
            value={selectedBranchId}
            onChange={(e) => {
              branchStore.setSelectedOriginBranchId(e.target.value);
              setSelectedBranchId(e.target.value);
            }}
            className="px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-slate-200 cursor-pointer"
          >
            <option value="ALL">Semua Cabang</option>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>
                Cabang {b.name}
              </option>
            ))}
          </select>
        </div>

        <select
          value={fleetFilter}
          onChange={(e) => setFleetFilter(e.target.value)}
          className="px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-slate-200 cursor-pointer"
        >
          <option value="all">Semua Armada ({branchFleets.length})</option>
          {branchFleets.map((f) => (
            <option key={f.id} value={f.id}>
              {f.initialCode ? `[${f.initialCode}] ` : ''}
              {f.plateNumber} ({f.vehicleType})
            </option>
          ))}
        </select>

        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-slate-200 cursor-pointer"
        >
          <option value="all">Semua Kategori Servis</option>
          {MAINTENANCE_CATEGORIES.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </select>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-slate-200 cursor-pointer"
        >
          <option value="all">Semua Status Bayar</option>
          {PAYMENT_STATUS_OPTIONS.map((st) => (
            <option key={st} value={st}>
              {st}
            </option>
          ))}
        </select>

        <select
          value={monthFilter}
          onChange={(e) => setMonthFilter(e.target.value)}
          className="px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-slate-200 cursor-pointer"
        >
          <option value="all">Semua Bulan</option>
          {availableMonths.map((m) => (
            <option key={m} value={m}>
              Bulan {m}
            </option>
          ))}
        </select>

        <button
          type="button"
          onClick={fetchMaintenanceCosts}
          className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 flex items-center gap-1 cursor-pointer"
          title="Muat ulang dari MySQL"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Charts Section (shown when records exist) */}
      {filteredRecords.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-xl p-4">
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-300 mb-3">
              Perbandingan Biaya Suku Cadang vs Jasa per Armada (Top 8)
            </h3>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartDataByFleet}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis dataKey="name" tick={{ fill: '#94a3b8', fontSize: 11 }} />
                  <YAxis
                    tick={{ fill: '#94a3b8', fontSize: 10 }}
                    tickFormatter={(v) => `${Math.round(Number(v) / 1000)}k`}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#0f172a',
                      borderColor: '#334155',
                      borderRadius: '10px',
                      fontSize: '12px',
                    }}
                    formatter={(value: any) => formatRupiah(Number(value))}
                  />
                  <Bar dataKey="parts" name="Suku Cadang" stackId="a" fill="#06b6d4" radius={[0, 0, 0, 0]} />
                  <Bar dataKey="labor" name="Jasa Bengkel" stackId="a" fill="#3b82f6" />
                  <Bar dataKey="other" name="Lainnya" stackId="a" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col">
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-300 mb-2">
              Komposisi Kategori Biaya
            </h3>
            <div className="h-44">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={chartDataByCategory}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={38}
                    outerRadius={66}
                    paddingAngle={2}
                  >
                    {chartDataByCategory.map((entry, idx) => (
                      <Cell key={idx} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#0f172a',
                      borderColor: '#334155',
                      borderRadius: '10px',
                      fontSize: '11px',
                    }}
                    formatter={(val: any) => formatRupiah(Number(val))}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="space-y-1 mt-1 max-h-20 overflow-y-auto text-[11px]">
              {chartDataByCategory.map((c) => (
                <div key={c.name} className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 truncate text-slate-300">
                    <span
                      className="w-2 h-2 rounded-full shrink-0"
                      style={{ backgroundColor: c.color }}
                    />
                    <span className="truncate">{c.name}</span>
                  </div>
                  <span className="font-mono font-bold text-slate-200 shrink-0">
                    {formatRupiah(c.value)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Main Records Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-950/80 border-b border-slate-800 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                <th className="py-3 px-3 whitespace-nowrap">Tanggal &amp; Nota</th>
                <th className="py-3 px-3 whitespace-nowrap">Armada</th>
                <th className="py-3 px-3 whitespace-nowrap">Kategori &amp; Pekerjaan</th>
                <th className="py-3 px-3 whitespace-nowrap">Bengkel &amp; KM</th>
                <th className="py-3 px-3 text-right whitespace-nowrap">Rincian Biaya</th>
                <th className="py-3 px-3 text-center whitespace-nowrap">Status</th>
                <th className="py-3 px-3 text-center whitespace-nowrap">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    Memuat data biaya pemeliharaan armada dari MySQL...
                  </td>
                </tr>
              ) : filteredRecords.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    <Receipt className="w-9 h-9 text-slate-600 mx-auto mb-2 opacity-60" />
                    <p className="font-bold text-slate-300">Belum ada catatan biaya servis / pemeliharaan</p>
                    <p className="text-[11px] text-slate-500 mt-1">
                      Klik tombol <strong>Catat Biaya Servis</strong> untuk menambahkan pengeluaran bengkel atau perawatan armada.
                    </p>
                  </td>
                </tr>
              ) : (
                filteredRecords.map((rec) => {
                  const catMeta = MAINTENANCE_CATEGORIES.find((c) => c.value === rec.category);
                  const statusCls =
                    rec.paymentStatus === 'Lunas'
                      ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                      : rec.paymentStatus === 'Menunggu Approval'
                      ? 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                      : rec.paymentStatus === 'Cicilan / Tempo'
                      ? 'bg-blue-500/15 text-blue-300 border-blue-500/30'
                      : 'bg-slate-700/40 text-slate-400 border-slate-600/40';

                  return (
                    <tr key={rec.id} className="hover:bg-slate-800/30 transition">
                      <td className="py-3 px-3 whitespace-nowrap">
                        <div className="font-mono font-bold text-white flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5 text-slate-400" />
                          <span>{rec.serviceDate}</span>
                        </div>
                        {rec.invoiceNumber && (
                          <div className="text-[10px] font-mono text-slate-400 mt-0.5">
                            No: {rec.invoiceNumber}
                          </div>
                        )}
                      </td>

                      <td className="py-3 px-3 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          {rec.initialCode && (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                              {rec.initialCode}
                            </span>
                          )}
                          <span className="font-mono font-bold text-white">{rec.plateNumber}</span>
                        </div>
                        <div className="text-[10px] text-slate-400 mt-0.5">{rec.vehicleType}</div>
                      </td>

                      <td className="py-3 px-3 max-w-[260px]">
                        <span
                          className="inline-block px-2 py-0.5 rounded text-[10px] font-bold border mb-1"
                          style={{
                            borderColor: `${catMeta?.color || '#64748b'}55`,
                            backgroundColor: `${catMeta?.color || '#64748b'}18`,
                            color: catMeta?.color || '#cbd5e1',
                          }}
                        >
                          {catMeta?.label || rec.category}
                        </span>
                        <div className="font-semibold text-slate-100 leading-snug">
                          {rec.workTitle}
                        </div>
                        {rec.notes && (
                          <div className="text-[10px] text-slate-400 truncate mt-0.5" title={rec.notes}>
                            {rec.notes}
                          </div>
                        )}
                      </td>

                      <td className="py-3 px-3 whitespace-nowrap">
                        <div className="font-semibold text-slate-200">{rec.workshopName}</div>
                        <div className="text-[10px] font-mono text-slate-400 mt-0.5">
                          Odo: {(rec.odometerKm || 0).toLocaleString('id-ID')} km
                        </div>
                      </td>

                      <td className="py-3 px-3 text-right whitespace-nowrap font-mono">
                        <div className="text-sm font-black text-emerald-300">
                          {formatRupiah(rec.totalCost)}
                        </div>
                        <div className="text-[10px] text-slate-400 mt-0.5">
                          Part: {formatRupiah(rec.partsCost)} · Jasa: {formatRupiah(rec.laborCost)}
                        </div>
                      </td>

                      <td className="py-3 px-3 text-center whitespace-nowrap">
                        <span className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${statusCls}`}>
                          {rec.paymentStatus}
                        </span>
                        {rec.paymentStatus === 'Menunggu Approval' && (
                          <div>
                            <button
                              type="button"
                              onClick={() => handleQuickApprove(rec)}
                              className="mt-1 text-[10px] font-bold text-emerald-400 hover:underline cursor-pointer"
                            >
                              Tandai Lunas &rarr;
                            </button>
                          </div>
                        )}
                      </td>

                      <td className="py-3 px-3 text-center whitespace-nowrap">
                        <div className="flex items-center justify-center gap-1">
                          {rec.receiptPhotoUrl && (
                            <button
                              type="button"
                              onClick={() => setPreviewPhotoUrl(rec.receiptPhotoUrl!)}
                              className="p-1.5 rounded-lg bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 cursor-pointer"
                              title="Lihat Foto Nota / Kwitansi"
                            >
                              <Maximize2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => openEditModal(rec)}
                            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-blue-400 border border-slate-700 cursor-pointer"
                            title="Edit Catatan Biaya"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeleteTarget(rec)}
                            className="p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 cursor-pointer"
                            title="Hapus Catatan"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add / Edit Modal */}
      {isModalOpen && (
        <div
          className="fixed inset-0 z-[1300] bg-slate-950/75 flex items-center justify-center p-4"
          onClick={() => setIsModalOpen(false)}
        >
          <form
            onSubmit={handleSaveRecord}
            onClick={(e) => e.stopPropagation()}
            className="bg-slate-900 border border-slate-700 rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl"
          >
            <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between sticky top-0 bg-slate-900 z-10">
              <div className="flex items-center gap-2 text-sm font-black text-white">
                <Receipt className="w-4 h-4 text-emerald-400" />
                <span>
                  {editingRecord ? 'Edit Catatan Biaya Servis Armada' : 'Catat Biaya Servis & Pemeliharaan Baru'}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-300 mb-1">Pilih Armada *</label>
                  <select
                    required
                    value={formState.fleetId}
                    onChange={(e) => {
                      const fl = fleets.find((item) => item.id === e.target.value);
                      setFormState((prev) => ({
                        ...prev,
                        fleetId: e.target.value,
                        odometerKm: fl?.odometerKm || prev.odometerKm,
                      }));
                    }}
                    className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-white"
                  >
                    <option value="">-- Pilih Armada --</option>
                    {fleets.map((fl) => (
                      <option key={fl.id} value={fl.id}>
                        {fl.initialCode ? `[${fl.initialCode}] ` : ''}
                        {fl.plateNumber} — {fl.vehicleType}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-300 mb-1">Tanggal Servis *</label>
                  <input
                    type="date"
                    required
                    value={formState.serviceDate}
                    onChange={(e) => setFormState((p) => ({ ...p, serviceDate: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-300 mb-1">Kategori Perawatan *</label>
                  <select
                    value={formState.category}
                    onChange={(e) =>
                      setFormState((p) => ({ ...p, category: e.target.value as MaintenanceCategory }))
                    }
                    className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-white"
                  >
                    {MAINTENANCE_CATEGORIES.map((c) => (
                      <option key={c.value} value={c.value}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-300 mb-1">Nama Bengkel / Mekanik *</label>
                  <input
                    type="text"
                    required
                    value={formState.workshopName}
                    onChange={(e) => setFormState((p) => ({ ...p, workshopName: e.target.value }))}
                    placeholder="Contoh: Bengkel Mitsubishi / Mekanik Internal"
                    className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-300 mb-1">Uraian Pekerjaan Servis *</label>
                <input
                  type="text"
                  required
                  value={formState.workTitle}
                  onChange={(e) => setFormState((p) => ({ ...p, workTitle: e.target.value }))}
                  placeholder="Contoh: Ganti Oli Mesin + Filter Solar + Kampas Rem Depan"
                  className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-white"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block font-bold text-slate-300 mb-1">Biaya Suku Cadang (Rp)</label>
                  <input
                    type="number"
                    min={0}
                    value={formState.partsCost}
                    onChange={(e) => setFormState((p) => ({ ...p, partsCost: Number(e.target.value || 0) }))}
                    className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-white font-mono"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-300 mb-1">Biaya Jasa Bengkel (Rp)</label>
                  <input
                    type="number"
                    min={0}
                    value={formState.laborCost}
                    onChange={(e) => setFormState((p) => ({ ...p, laborCost: Number(e.target.value || 0) }))}
                    className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-white font-mono"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-300 mb-1">Biaya Lainnya / Derek (Rp)</label>
                  <input
                    type="number"
                    min={0}
                    value={formState.otherCost}
                    onChange={(e) => setFormState((p) => ({ ...p, otherCost: Number(e.target.value || 0) }))}
                    className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-white font-mono"
                  />
                </div>
              </div>

              <div className="p-3 rounded-xl bg-emerald-950/30 border border-emerald-500/30 flex items-center justify-between">
                <span className="font-bold text-emerald-300 flex items-center gap-1.5">
                  <CreditCard className="w-4 h-4" />
                  Total Biaya Pemeliharaan:
                </span>
                <span className="text-lg font-black font-mono text-white">
                  {formatRupiah(
                    Number(formState.partsCost || 0) +
                      Number(formState.laborCost || 0) +
                      Number(formState.otherCost || 0)
                  )}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block font-bold text-slate-300 mb-1">Odometer Saat Servis (KM)</label>
                  <input
                    type="number"
                    min={0}
                    value={formState.odometerKm}
                    onChange={(e) => setFormState((p) => ({ ...p, odometerKm: Number(e.target.value || 0) }))}
                    className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-white font-mono"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-300 mb-1">No. Nota / Faktur Bengkel</label>
                  <input
                    type="text"
                    value={formState.invoiceNumber}
                    onChange={(e) => setFormState((p) => ({ ...p, invoiceNumber: e.target.value }))}
                    placeholder="Opsional"
                    className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-white font-mono"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-300 mb-1">Status Pembayaran</label>
                  <select
                    value={formState.paymentStatus}
                    onChange={(e) =>
                      setFormState((p) => ({
                        ...p,
                        paymentStatus: e.target.value as MaintenancePaymentStatus,
                      }))
                    }
                    className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-white"
                  >
                    {PAYMENT_STATUS_OPTIONS.map((st) => (
                      <option key={st} value={st}>
                        {st}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Receipt Photo Upload */}
              <div className="border border-slate-800 rounded-xl p-3 bg-slate-950/60 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-11 h-11 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-center overflow-hidden shrink-0">
                    {formState.receiptPhotoUrl ? (
                      <img
                        src={formState.receiptPhotoUrl}
                        alt="Nota"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <Camera className="w-5 h-5 text-slate-500" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="font-bold text-slate-200">Foto Nota / Kwitansi Bengkel</div>
                    <div className="text-[11px] text-slate-400">
                      Opsional — otomatis dikompres &amp; disimpan ke MySQL
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <input
                    ref={receiptInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      try {
                        const dataUrl = await compressReceiptFile(file);
                        setFormState((p) => ({ ...p, receiptPhotoUrl: dataUrl }));
                      } catch {
                        // ignore invalid file
                      }
                    }}
                  />
                  {formState.receiptPhotoUrl && (
                    <button
                      type="button"
                      onClick={() => setFormState((p) => ({ ...p, receiptPhotoUrl: '' }))}
                      className="px-2.5 py-1.5 rounded-lg bg-rose-500/10 text-rose-400 border border-rose-500/30 font-bold cursor-pointer"
                    >
                      Hapus
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => receiptInputRef.current?.click()}
                    className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-white border border-slate-700 font-bold cursor-pointer"
                  >
                    {formState.receiptPhotoUrl ? 'Ganti Foto' : 'Upload Nota'}
                  </button>
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-300 mb-1">Catatan Tambahan</label>
                <textarea
                  rows={2}
                  value={formState.notes}
                  onChange={(e) => setFormState((p) => ({ ...p, notes: e.target.value }))}
                  placeholder="Catatan garansi servis, keluhan awal driver, atau detail part..."
                  className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-white"
                />
              </div>
            </div>

            <div className="px-5 py-3.5 border-t border-slate-800 flex items-center justify-end gap-2 bg-slate-900 sticky bottom-0">
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold cursor-pointer"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={isSaving}
                className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shadow-sm cursor-pointer disabled:opacity-50"
              >
                {isSaving ? 'Menyimpan...' : editingRecord ? 'Simpan Perubahan' : 'Simpan ke MySQL'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteTarget && (
        <div
          className="fixed inset-0 z-[1350] bg-slate-950/75 flex items-center justify-center p-4"
          onClick={() => setDeleteTarget(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-slate-900 border border-slate-700 rounded-2xl max-w-md w-full p-5 space-y-4 shadow-2xl"
          >
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-500/15 border border-rose-500/30 flex items-center justify-center text-rose-400 shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-black text-white">Hapus Catatan Biaya Servis?</h3>
                <p className="text-xs text-slate-400 mt-1">
                  Anda yakin ingin menghapus catatan <strong>{deleteTarget.workTitle}</strong> ({deleteTarget.plateNumber}) senilai{' '}
                  <strong>{formatRupiah(deleteTarget.totalCost)}</strong>?
                </p>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                className="px-3.5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold cursor-pointer"
              >
                Hapus Permanen
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Receipt Lightbox */}
      {previewPhotoUrl && (
        <div
          className="fixed inset-0 z-[1400] bg-slate-950/85 flex items-center justify-center p-4"
          onClick={() => setPreviewPhotoUrl(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-slate-900 border border-slate-700 rounded-2xl max-w-2xl w-full overflow-hidden shadow-2xl"
          >
            <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between">
              <span className="text-sm font-black text-white">Lampiran Foto Nota / Kwitansi</span>
              <button
                type="button"
                onClick={() => setPreviewPhotoUrl(null)}
                className="text-slate-400 hover:text-white p-1 rounded cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-3 bg-slate-950 flex justify-center max-h-[75vh]">
              <img src={previewPhotoUrl} alt="Nota Servis" className="max-h-[70vh] w-auto rounded-lg object-contain" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
