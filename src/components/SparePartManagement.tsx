import React, { useState, useEffect } from 'react';
import {
  Wrench,
  Package,
  Droplets,
  Disc,
  BatteryCharging,
  Filter,
  Plus,
  Search,
  AlertTriangle,
  CheckCircle2,
  Calendar,
  Truck,
  FileSpreadsheet,
  ArrowUpDown,
  History,
  Trash2,
  Edit3,
  ExternalLink,
  ShieldCheck,
  AlertCircle,
  TrendingDown,
  Warehouse,
  FileText
} from 'lucide-react';
import { SparePart, SparePartUsage, SparePartCategory, Fleet } from '../types';
import { logisticsStore } from '../services/store';

interface SparePartManagementProps {
  initialFleetId?: string;
  onNavigateToFleets?: () => void;
}

export const SparePartManagement: React.FC<SparePartManagementProps> = ({
  initialFleetId,
  onNavigateToFleets
}) => {
  const [activeTab, setActiveTab] = useState<'inventory' | 'fleet_health' | 'history'>('fleet_health');
  const [spareParts, setSpareParts] = useState<SparePart[]>(logisticsStore.getSpareParts());
  const [usages, setUsages] = useState<SparePartUsage[]>(logisticsStore.getSparePartUsages());
  const [fleets, setFleets] = useState<Fleet[]>(logisticsStore.getFleets());

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedFleetFilter, setSelectedFleetFilter] = useState<string>(initialFleetId || 'all');

  // Modals
  const [isAddPartOpen, setIsAddPartOpen] = useState(false);
  const [isRestockOpen, setIsRestockOpen] = useState(false);
  const [selectedPartForRestock, setSelectedPartForRestock] = useState<SparePart | null>(null);
  const [restockAmount, setRestockAmount] = useState<number>(5);
  const [restockNotes, setRestockNotes] = useState<string>('Penerimaan PO Gudang');

  const [isLogUsageOpen, setIsLogUsageOpen] = useState(false);
  const [isEditPartOpen, setIsEditPartOpen] = useState(false);
  const [editingPart, setEditingPart] = useState<SparePart | null>(null);

  // New Part Form State
  const [newPart, setNewPart] = useState<Omit<SparePart, 'id'>>({
    name: '',
    category: 'oli',
    partNumber: '',
    unit: 'Liter',
    stock: 10,
    minStock: 3,
    costPerUnit: 150000,
    compatibleVehicles: 'Semua Armada',
    storageLocation: 'Gudang Logistik Banyuwangi',
    lastRestockDate: new Date().toISOString().substring(0, 10),
    notes: ''
  });

  // Log Usage Form State
  const [usageForm, setUsageForm] = useState({
    fleetId: fleets[0]?.id || '',
    category: 'oli' as SparePartCategory,
    partId: '',
    quantity: 1,
    replacementDate: new Date().toISOString().substring(0, 10),
    odometerKm: 45000,
    nextReplacementKm: 55000,
    nextReplacementDate: '',
    mechanicOrWorkshop: 'Mekanik Internal AKK',
    totalCost: 195000,
    notes: 'Penggantian rutin sesuai standar pemakaian armada'
  });

  // Subscribe to store updates
  useEffect(() => {
    const unsubscribe = logisticsStore.subscribe(() => {
      setSpareParts(logisticsStore.getSpareParts());
      setUsages(logisticsStore.getSparePartUsages());
      setFleets(logisticsStore.getFleets());
    });
    return unsubscribe;
  }, []);

  // Update usageForm defaults when category changes
  const handleCategoryChangeForUsage = (category: SparePartCategory) => {
    const matchedParts = spareParts.filter(p => p.category === category);
    const firstPart = matchedParts[0];

    // Estimate next KM & Date based on category
    const currentOdo = usageForm.odometerKm;
    let nextKm = currentOdo + 10000;
    let targetMonths = 3;

    if (category === 'oli') {
      nextKm = currentOdo + 10000;
      targetMonths = 3;
    } else if (category === 'ban') {
      nextKm = currentOdo + 50000;
      targetMonths = 12;
    } else if (category === 'aki') {
      nextKm = currentOdo + 80000;
      targetMonths = 18;
    } else if (category === 'filter') {
      nextKm = currentOdo + 15000;
      targetMonths = 4;
    } else if (category === 'rem') {
      nextKm = currentOdo + 30000;
      targetMonths = 8;
    }

    const d = new Date();
    d.setMonth(d.getMonth() + targetMonths);
    const nextDate = d.toISOString().substring(0, 10);

    setUsageForm(prev => ({
      ...prev,
      category,
      partId: firstPart ? firstPart.id : '',
      totalCost: firstPart ? firstPart.costPerUnit * prev.quantity : 0,
      nextReplacementKm: nextKm,
      nextReplacementDate: nextDate
    }));
  };

  // Open Log Usage for a specific fleet
  const handleOpenLogForFleet = (fleet: Fleet, specificCategory?: SparePartCategory) => {
    const cat = specificCategory || 'oli';
    const matchedParts = spareParts.filter(p => p.category === cat);
    const firstPart = matchedParts[0];

    const currentOdo = fleet.odometerKm || 45000;
    let nextKm = currentOdo + 10000;
    let targetMonths = 3;
    if (cat === 'ban') {
      nextKm = currentOdo + 50000;
      targetMonths = 12;
    } else if (cat === 'aki') {
      nextKm = currentOdo + 80000;
      targetMonths = 18;
    }

    const d = new Date();
    d.setMonth(d.getMonth() + targetMonths);

    setUsageForm({
      fleetId: fleet.id,
      category: cat,
      partId: firstPart ? firstPart.id : '',
      quantity: 1,
      replacementDate: new Date().toISOString().substring(0, 10),
      odometerKm: currentOdo,
      nextReplacementKm: nextKm,
      nextReplacementDate: d.toISOString().substring(0, 10),
      mechanicOrWorkshop: 'Mekanik Internal AKK',
      totalCost: firstPart ? firstPart.costPerUnit : 0,
      notes: `Penggantian rutin ${cat} untuk armada ${fleet.initialCode || fleet.plateNumber}`
    });
    setIsLogUsageOpen(true);
  };

  // Submit new Spare Part
  const handleCreatePart = (e: React.FormEvent) => {
    e.preventDefault();
    logisticsStore.addSparePart(newPart);
    setIsAddPartOpen(false);
    setNewPart({
      name: '',
      category: 'oli',
      partNumber: '',
      unit: 'Liter',
      stock: 10,
      minStock: 3,
      costPerUnit: 150000,
      compatibleVehicles: 'Semua Armada',
      storageLocation: 'Gudang Logistik Banyuwangi',
      lastRestockDate: new Date().toISOString().substring(0, 10),
      notes: ''
    });
  };

  // Submit Restock
  const handleRestockSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPartForRestock) return;
    logisticsStore.restockSparePart(selectedPartForRestock.id, Number(restockAmount), restockNotes);
    setIsRestockOpen(false);
    setSelectedPartForRestock(null);
  };

  // Submit Usage (Routine Replacement)
  const handleSubmitUsage = (e: React.FormEvent) => {
    e.preventDefault();
    const selectedFleet = fleets.find(f => f.id === usageForm.fleetId);
    const selectedPart = spareParts.find(p => p.id === usageForm.partId);

    if (!selectedFleet) return;

    logisticsStore.recordSparePartUsage({
      fleetId: selectedFleet.id,
      plateNumber: selectedFleet.plateNumber,
      initialCode: selectedFleet.initialCode,
      partId: usageForm.partId,
      partName: selectedPart ? selectedPart.name : 'Komponen Rutin',
      category: usageForm.category,
      quantity: Number(usageForm.quantity),
      unit: selectedPart ? selectedPart.unit : 'Unit',
      replacementDate: usageForm.replacementDate,
      odometerKm: Number(usageForm.odometerKm),
      nextReplacementKm: Number(usageForm.nextReplacementKm),
      nextReplacementDate: usageForm.nextReplacementDate,
      mechanicOrWorkshop: usageForm.mechanicOrWorkshop,
      totalCost: Number(usageForm.totalCost),
      notes: usageForm.notes,
      performedBy: logisticsStore.getCurrentUser().fullName
    });

    setIsLogUsageOpen(false);
  };

  // KPI Calculations
  const totalPartsCount = spareParts.length;
  const totalStockItems = spareParts.reduce((acc, p) => acc + p.stock, 0);
  const totalInventoryValue = spareParts.reduce((acc, p) => acc + (p.stock * p.costPerUnit), 0);
  const lowStockParts = spareParts.filter(p => p.stock <= p.minStock);
  const thisMonthUsages = usages.filter(u => {
    const d = new Date(u.replacementDate);
    const now = new Date();
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  });
  const totalMaintenanceExpenseThisMonth = thisMonthUsages.reduce((acc, u) => acc + u.totalCost, 0);

  // Filtered Parts
  const filteredParts = spareParts.filter(part => {
    const matchSearch =
      part.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      part.partNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      part.compatibleVehicles.toLowerCase().includes(searchQuery.toLowerCase());
    const matchCat = selectedCategory === 'all' || part.category === selectedCategory;
    return matchSearch && matchCat;
  });

  // Filtered Usages
  const filteredUsages = usages.filter(u => {
    const matchFleet = selectedFleetFilter === 'all' || u.fleetId === selectedFleetFilter;
    const matchCat = selectedCategory === 'all' || u.category === selectedCategory;
    return matchFleet && matchCat;
  });

  // Category Icon & Color Helper
  const getCategoryBadge = (cat: SparePartCategory) => {
    switch (cat) {
      case 'oli':
        return {
          label: 'Oli & Pelumas',
          color: 'text-amber-400 bg-amber-500/15 border-amber-500/30',
          icon: Droplets
        };
      case 'ban':
        return {
          label: 'Ban & Velg',
          color: 'text-emerald-400 bg-emerald-500/15 border-emerald-500/30',
          icon: Disc
        };
      case 'aki':
        return {
          label: 'Aki & Kelistrikan',
          color: 'text-cyan-400 bg-cyan-500/15 border-cyan-500/30',
          icon: BatteryCharging
        };
      case 'filter':
        return {
          label: 'Filter & Udara',
          color: 'text-purple-400 bg-purple-500/15 border-purple-500/30',
          icon: Filter
        };
      case 'rem':
        return {
          label: 'Pengereman',
          color: 'text-rose-400 bg-rose-500/15 border-rose-500/30',
          icon: AlertCircle
        };
      default:
        return {
          label: 'Lainnya',
          color: 'text-slate-400 bg-slate-500/15 border-slate-500/30',
          icon: Package
        };
    }
  };

  // Export CSV Helper
  const handleExportCSV = () => {
    const headers = ['ID', 'Tanggal Ganti', 'Armada', 'Inisial', 'Kategori', 'Komponen Sparepart', 'Jumlah', 'Satuan', 'Odometer KM', 'Target KM Berikut', 'Mekanik/Bengkel', 'Biaya (Rp)', 'Petugas', 'Catatan'];
    const rows = filteredUsages.map(u => [
      u.id,
      u.replacementDate,
      `"${u.plateNumber}"`,
      `"${u.initialCode || '-'}"`,
      u.category,
      `"${u.partName}"`,
      u.quantity,
      `"${u.unit}"`,
      u.odometerKm,
      u.nextReplacementKm || '-',
      `"${u.mechanicOrWorkshop}"`,
      u.totalCost,
      `"${u.performedBy}"`,
      `"${u.notes || '-'}"`
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Riwayat_Penggantian_Sparepart_AKK_${new Date().toISOString().substring(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      {/* Top Header Card */}
      <div className="bg-slate-900 border border-slate-800/80 rounded-2xl p-5 sm:p-6 shadow-xl">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-amber-400 mb-1">
              <Warehouse className="w-4 h-4" />
              <span>LOGISTIK & PEMELIHARAAN ARMADA BANYUWANGI</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight flex items-center gap-2.5">
              <span>Manajemen Sparepart & Komponen Rutin</span>
              <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-blue-500/15 text-blue-400 border border-blue-500/30">
                Oli &bull; Ban &bull; Aki &bull; Filter
              </span>
            </h2>
            <p className="text-xs sm:text-sm text-slate-400 mt-1 max-w-2xl">
              Pantau ketersediaan stok fisik sparepart gudang dan lacak siklus penggantian komponen rutin tiap armada secara akurat berdasarkan tanggal & kilometer odometer.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              onClick={() => {
                const defaultFleet = fleets[0];
                if (defaultFleet) handleOpenLogForFleet(defaultFleet, 'oli');
              }}
              className="px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs flex items-center gap-2 shadow-lg shadow-amber-500/20 transition cursor-pointer active:scale-95"
            >
              <Wrench className="w-4 h-4" />
              <span>+ Catat Ganti Komponen</span>
            </button>

            <button
              onClick={() => setIsAddPartOpen(true)}
              className="px-3.5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-bold text-xs flex items-center gap-1.5 transition cursor-pointer shadow-xs"
            >
              <Plus className="w-4 h-4 text-emerald-400" />
              <span>Tambah Master Part</span>
            </button>

            {onNavigateToFleets && (
              <button
                onClick={onNavigateToFleets}
                className="px-3.5 py-2.5 rounded-xl bg-slate-800/80 hover:bg-slate-800 text-slate-300 border border-slate-700 font-bold text-xs flex items-center gap-1.5 transition cursor-pointer"
              >
                <Truck className="w-4 h-4 text-blue-400" />
                <span>Lihat Data Armada</span>
              </button>
            )}
          </div>
        </div>

        {/* 4 Summary Stat Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5 mt-6 pt-5 border-t border-slate-800">
          <div className="bg-slate-950/60 p-3.5 rounded-xl border border-slate-800/80">
            <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
              <span>Master Sparepart</span>
              <Package className="w-4 h-4 text-blue-400" />
            </div>
            <div className="text-xl font-black text-white">
              {totalPartsCount} <span className="text-xs font-normal text-slate-400">item ({totalStockItems} unit)</span>
            </div>
            <div className="text-[10px] text-slate-400 mt-1">Terdaftar di master inventaris</div>
          </div>

          <div className="bg-slate-950/60 p-3.5 rounded-xl border border-slate-800/80">
            <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
              <span>Peringatan Stok Tipis</span>
              <AlertTriangle className={`w-4 h-4 ${lowStockParts.length > 0 ? 'text-rose-400 animate-pulse' : 'text-slate-500'}`} />
            </div>
            <div className={`text-xl font-black ${lowStockParts.length > 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
              {lowStockParts.length} <span className="text-xs font-normal text-slate-400">item perlu restock</span>
            </div>
            <div className="text-[10px] text-slate-400 mt-1">Stok &le; batas minimum gudang</div>
          </div>

          <div className="bg-slate-950/60 p-3.5 rounded-xl border border-slate-800/80">
            <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
              <span>Penggantian Bulan Ini</span>
              <Wrench className="w-4 h-4 text-amber-400" />
            </div>
            <div className="text-xl font-black text-amber-400">
              {thisMonthUsages.length} <span className="text-xs font-normal text-slate-400">kali servis</span>
            </div>
            <div className="text-[10px] text-slate-400 mt-1">Total biaya: Rp {totalMaintenanceExpenseThisMonth.toLocaleString('id-ID')}</div>
          </div>

          <div className="bg-slate-950/60 p-3.5 rounded-xl border border-slate-800/80">
            <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
              <span>Estimasi Nilai Stok</span>
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="text-xl font-black text-emerald-400">
              Rp {(totalInventoryValue / 1000000).toFixed(1)} <span className="text-xs font-normal text-slate-400">Juta</span>
            </div>
            <div className="text-[10px] text-slate-400 mt-1">Aset komponen siap pasang</div>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-2">
        <div className="flex items-center gap-2 bg-slate-900/90 p-1 rounded-xl border border-slate-800">
          <button
            onClick={() => setActiveTab('fleet_health')}
            className={`px-4 py-2 rounded-lg text-xs font-black transition cursor-pointer flex items-center gap-2 ${
              activeTab === 'fleet_health'
                ? 'bg-amber-500 text-slate-950 shadow-md'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <Truck className="w-4 h-4" />
            <span>Kondisi Komponen Tiap Armada</span>
            <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-full bg-slate-950/30 text-current">
              {fleets.length} Armada
            </span>
          </button>

          <button
            onClick={() => setActiveTab('inventory')}
            className={`px-4 py-2 rounded-lg text-xs font-black transition cursor-pointer flex items-center gap-2 ${
              activeTab === 'inventory'
                ? 'bg-amber-500 text-slate-950 shadow-md'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <Package className="w-4 h-4" />
            <span>Katalog Stok Gudang</span>
            {lowStockParts.length > 0 && (
              <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-full bg-rose-500 text-white animate-pulse">
                {lowStockParts.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('history')}
            className={`px-4 py-2 rounded-lg text-xs font-black transition cursor-pointer flex items-center gap-2 ${
              activeTab === 'history'
                ? 'bg-amber-500 text-slate-950 shadow-md'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <History className="w-4 h-4" />
            <span>Riwayat Penggantian & Servis</span>
            <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-full bg-slate-950/30 text-current">
              {usages.length} Log
            </span>
          </button>
        </div>

        {/* Category Quick Filter */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 max-w-full">
          <button
            onClick={() => setSelectedCategory('all')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
              selectedCategory === 'all'
                ? 'bg-slate-800 text-white border border-slate-700'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Semua
          </button>
          <button
            onClick={() => setSelectedCategory('oli')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
              selectedCategory === 'oli'
                ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
                : 'text-slate-400 hover:text-amber-300'
            }`}
          >
            <Droplets className="w-3.5 h-3.5" />
            <span>Oli Mesin</span>
          </button>
          <button
            onClick={() => setSelectedCategory('ban')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
              selectedCategory === 'ban'
                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                : 'text-slate-400 hover:text-emerald-300'
            }`}
          >
            <Disc className="w-3.5 h-3.5" />
            <span>Ban</span>
          </button>
          <button
            onClick={() => setSelectedCategory('aki')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
              selectedCategory === 'aki'
                ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/40'
                : 'text-slate-400 hover:text-cyan-300'
            }`}
          >
            <BatteryCharging className="w-3.5 h-3.5" />
            <span>Aki</span>
          </button>
          <button
            onClick={() => setSelectedCategory('filter')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
              selectedCategory === 'filter'
                ? 'bg-purple-500/20 text-purple-400 border border-purple-500/40'
                : 'text-slate-400 hover:text-purple-300'
            }`}
          >
            <Filter className="w-3.5 h-3.5" />
            <span>Filter</span>
          </button>
        </div>
      </div>

      {/* ========================================================= */}
      {/* TAB 1: FLEET HEALTH MONITOR (KONDISI KOMPONEN RUTIN ARMADA) */}
      {/* ========================================================= */}
      {activeTab === 'fleet_health' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-900/60 p-4 rounded-xl border border-slate-800 text-xs text-slate-300">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>
                <strong>Siklus Rekomendasi AKK:</strong> Oli Mesin tiap <strong>10.000 KM</strong> (maks 3 bulan), Ban Truk tiap <strong>50.000 KM</strong>, Aki Kendaraan tiap <strong>18 bulan</strong>.
              </span>
            </div>
            <div className="flex items-center gap-3 text-[11px]">
              <span className="flex items-center gap-1 text-emerald-400">
                <span className="w-2 h-2 rounded-full bg-emerald-400"></span> Prima
              </span>
              <span className="flex items-center gap-1 text-amber-400">
                <span className="w-2 h-2 rounded-full bg-amber-400"></span> Segera Jadwalkan
              </span>
              <span className="flex items-center gap-1 text-rose-400">
                <span className="w-2 h-2 rounded-full bg-rose-400 animate-pulse"></span> Wajib Ganti
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {fleets.map(fleet => {
              const status = logisticsStore.getFleetRoutineComponentsStatus(fleet.id);
              return (
                <div
                  key={fleet.id}
                  className="bg-slate-900 border border-slate-800 rounded-2xl p-4.5 hover:border-slate-700 transition flex flex-col justify-between shadow-lg"
                >
                  <div>
                    {/* Fleet Header */}
                    <div className="flex items-start justify-between gap-2 pb-3 border-b border-slate-800">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-black px-2 py-0.5 rounded bg-amber-500/20 text-amber-400 border border-amber-500/40 font-mono">
                            {fleet.initialCode || 'ARMADA'}
                          </span>
                          <span className="font-mono text-base font-black text-white">
                            {fleet.plateNumber}
                          </span>
                        </div>
                        <div className="text-xs text-slate-400 mt-1">
                          {fleet.vehicleType} &bull; {fleet.brand || 'Standar'} ({fleet.year || '2023'})
                        </div>
                      </div>

                      <div className="text-right">
                        <span className="text-[10px] text-slate-400 block">Odometer</span>
                        <span className="font-mono font-bold text-white text-xs">
                          {(fleet.odometerKm || 45000).toLocaleString('id-ID')} KM
                        </span>
                      </div>
                    </div>

                    {/* Routine Components Grid: Oli, Ban, Aki, Filter */}
                    <div className="space-y-2.5 my-3.5">
                      {/* OLI MESIN */}
                      <div className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800/80 flex items-center justify-between">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/25 flex items-center justify-center text-amber-400 shrink-0">
                            <Droplets className="w-4 h-4" />
                          </div>
                          <div>
                            <div className="text-xs font-bold text-white flex items-center gap-1.5">
                              <span>Oli Mesin</span>
                              <span
                                className={`text-[9px] px-1.5 py-0.2 rounded font-semibold border ${
                                  status.oil.status === 'urgent'
                                    ? 'bg-rose-500/15 text-rose-400 border-rose-500/30'
                                    : status.oil.status === 'warning'
                                    ? 'bg-amber-500/15 text-amber-400 border-amber-500/30'
                                    : 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                                }`}
                              >
                                {status.oil.label}
                              </span>
                            </div>
                            <div className="text-[10px] text-slate-400">
                              Terakhir: {status.oil.lastDate} {status.oil.lastKm > 0 && `(${status.oil.lastKm.toLocaleString('id-ID')} KM)`}
                            </div>
                          </div>
                        </div>
                        <button
                          onClick={() => handleOpenLogForFleet(fleet, 'oli')}
                          className="px-2 py-1 rounded bg-slate-800 hover:bg-amber-500 hover:text-slate-950 text-slate-300 text-[10px] font-bold transition cursor-pointer"
                          title="Catat Ganti Oli"
                        >
                          Ganti
                        </button>
                      </div>

                      {/* BAN */}
                      <div className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800/80 flex items-center justify-between">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/25 flex items-center justify-center text-emerald-400 shrink-0">
                            <Disc className="w-4 h-4" />
                          </div>
                          <div>
                            <div className="text-xs font-bold text-white flex items-center gap-1.5">
                              <span>Ban Armada</span>
                              <span
                                className={`text-[9px] px-1.5 py-0.2 rounded font-semibold border ${
                                  status.tire.status === 'urgent'
                                    ? 'bg-rose-500/15 text-rose-400 border-rose-500/30'
                                    : status.tire.status === 'warning'
                                    ? 'bg-amber-500/15 text-amber-400 border-amber-500/30'
                                    : 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                                }`}
                              >
                                {status.tire.label}
                              </span>
                            </div>
                            <div className="text-[10px] text-slate-400">
                              Terakhir: {status.tire.lastDate} {status.tire.lastKm > 0 && `(${status.tire.lastKm.toLocaleString('id-ID')} KM)`}
                            </div>
                          </div>
                        </div>
                        <button
                          onClick={() => handleOpenLogForFleet(fleet, 'ban')}
                          className="px-2 py-1 rounded bg-slate-800 hover:bg-emerald-500 hover:text-slate-950 text-slate-300 text-[10px] font-bold transition cursor-pointer"
                          title="Catat Ganti Ban"
                        >
                          Ganti
                        </button>
                      </div>

                      {/* AKI */}
                      <div className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800/80 flex items-center justify-between">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-lg bg-cyan-500/10 border border-cyan-500/25 flex items-center justify-center text-cyan-400 shrink-0">
                            <BatteryCharging className="w-4 h-4" />
                          </div>
                          <div>
                            <div className="text-xs font-bold text-white flex items-center gap-1.5">
                              <span>Aki (Baterai)</span>
                              <span
                                className={`text-[9px] px-1.5 py-0.2 rounded font-semibold border ${
                                  status.battery.status === 'urgent'
                                    ? 'bg-rose-500/15 text-rose-400 border-rose-500/30'
                                    : status.battery.status === 'warning'
                                    ? 'bg-amber-500/15 text-amber-400 border-amber-500/30'
                                    : 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                                }`}
                              >
                                {status.battery.label}
                              </span>
                            </div>
                            <div className="text-[10px] text-slate-400">
                              Terakhir: {status.battery.lastDate}
                            </div>
                          </div>
                        </div>
                        <button
                          onClick={() => handleOpenLogForFleet(fleet, 'aki')}
                          className="px-2 py-1 rounded bg-slate-800 hover:bg-cyan-500 hover:text-slate-950 text-slate-300 text-[10px] font-bold transition cursor-pointer"
                          title="Catat Ganti Aki"
                        >
                          Ganti
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Card Footer Action */}
                  <div className="pt-2.5 border-t border-slate-800 flex items-center justify-between">
                    <button
                      onClick={() => {
                        setSelectedFleetFilter(fleet.id);
                        setActiveTab('history');
                      }}
                      className="text-slate-400 hover:text-amber-400 text-xs font-semibold flex items-center gap-1 transition cursor-pointer"
                    >
                      <History className="w-3.5 h-3.5" />
                      <span>Lihat Riwayat ({logisticsStore.getSparePartUsages(fleet.id).length})</span>
                    </button>

                    <button
                      onClick={() => handleOpenLogForFleet(fleet)}
                      className="px-3 py-1.5 rounded-lg bg-amber-500/15 hover:bg-amber-500 text-amber-300 hover:text-slate-950 border border-amber-500/30 font-bold text-xs transition cursor-pointer flex items-center gap-1"
                    >
                      <Wrench className="w-3.5 h-3.5" />
                      <span>Catat Servis</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* TAB 2: KATALOG STOK GUDANG (WAREHOUSE INVENTORY)          */}
      {/* ========================================================= */}
      {activeTab === 'inventory' && (
        <div className="space-y-4">
          {/* Search & Action Bar */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-900 p-3.5 rounded-xl border border-slate-800">
            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Cari sparepart, part number, tipe truk..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-hidden focus:border-amber-500"
              />
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
              <span className="text-xs text-slate-400">
                Menampilkan <strong className="text-white">{filteredParts.length}</strong> sparepart
              </span>
              <button
                onClick={() => setIsAddPartOpen(true)}
                className="px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-1.5 transition cursor-pointer shadow-xs"
              >
                <Plus className="w-4 h-4" />
                <span>Tambah Sparepart</span>
              </button>
            </div>
          </div>

          {/* Parts Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredParts.map(part => {
              const badge = getCategoryBadge(part.category);
              const Icon = badge.icon;
              const isLowStock = part.stock <= part.minStock;

              return (
                <div
                  key={part.id}
                  className={`bg-slate-900 border rounded-2xl p-4.5 transition flex flex-col justify-between shadow-md ${
                    isLowStock ? 'border-rose-500/50 bg-rose-950/10' : 'border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold border flex items-center gap-1 ${badge.color}`}>
                        <Icon className="w-3 h-3" />
                        <span>{badge.label}</span>
                      </span>

                      {isLowStock ? (
                        <span className="px-2 py-0.5 rounded text-[10px] font-black bg-rose-500/20 text-rose-400 border border-rose-500/40 animate-pulse flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3" />
                          <span>STOK TIPIS</span>
                        </span>
                      ) : (
                        <span className="text-[10px] text-slate-400">
                          Min: {part.minStock} {part.unit}
                        </span>
                      )}
                    </div>

                    <h3 className="text-sm font-bold text-white mt-2.5 line-clamp-2" title={part.name}>
                      {part.name}
                    </h3>
                    <div className="text-[11px] font-mono text-slate-400 mt-0.5">
                      Kode / Part No: <span className="text-amber-400 font-semibold">{part.partNumber}</span>
                    </div>

                    {/* Info Blocks */}
                    <div className="my-3 space-y-1.5 text-xs text-slate-300">
                      <div className="flex items-center justify-between py-1 border-b border-slate-800/60">
                        <span className="text-slate-400 text-[11px]">Kompatibilitas:</span>
                        <span className="font-medium text-right text-white max-w-[60%] truncate" title={part.compatibleVehicles}>
                          {part.compatibleVehicles}
                        </span>
                      </div>

                      <div className="flex items-center justify-between py-1 border-b border-slate-800/60">
                        <span className="text-slate-400 text-[11px]">Lokasi Rak:</span>
                        <span className="font-mono text-slate-300 text-[11px]">{part.storageLocation}</span>
                      </div>

                      <div className="flex items-center justify-between py-1 border-b border-slate-800/60">
                        <span className="text-slate-400 text-[11px]">Harga Satuan (Est):</span>
                        <span className="font-bold text-amber-400">Rp {part.costPerUnit.toLocaleString('id-ID')}</span>
                      </div>
                    </div>

                    {part.notes && (
                      <p className="text-[11px] text-slate-400 italic bg-slate-950/40 p-2 rounded-lg border border-slate-800/60 line-clamp-2">
                        "{part.notes}"
                      </p>
                    )}
                  </div>

                  {/* Footer & Stock Controls */}
                  <div className="mt-4 pt-3 border-t border-slate-800 flex items-center justify-between">
                    <div>
                      <span className="text-[10px] text-slate-400 block">Stok Tersedia</span>
                      <span className={`text-lg font-black ${isLowStock ? 'text-rose-400' : 'text-emerald-400'}`}>
                        {part.stock} <span className="text-xs font-normal text-slate-400">{part.unit}</span>
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => {
                          setSelectedPartForRestock(part);
                          setIsRestockOpen(true);
                        }}
                        className="px-2.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs transition cursor-pointer flex items-center gap-1 shadow-xs"
                        title="Restock / Tambah Stok Masuk"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Restock</span>
                      </button>

                      <button
                        onClick={() => {
                          setEditingPart(part);
                          setIsEditPartOpen(true);
                        }}
                        className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition cursor-pointer"
                        title="Edit Master Part"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>

                      <button
                        onClick={() => {
                          if (confirm(`Yakin ingin menghapus master part ${part.name}?`)) {
                            logisticsStore.deleteSparePart(part.id);
                          }
                        }}
                        className="p-1.5 rounded-lg bg-slate-800 hover:bg-rose-900/60 text-slate-400 hover:text-rose-300 transition cursor-pointer"
                        title="Hapus Part"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* TAB 3: RIWAYAT PENGGANTIAN & SERVIS (REPLACEMENT LOGS)    */}
      {/* ========================================================= */}
      {activeTab === 'history' && (
        <div className="space-y-4">
          {/* Filter Bar */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-900 p-4 rounded-xl border border-slate-800">
            <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
              <div>
                <label className="text-[11px] text-slate-400 block mb-1">Filter Armada:</label>
                <select
                  value={selectedFleetFilter}
                  onChange={(e) => setSelectedFleetFilter(e.target.value)}
                  className="px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-xs text-white"
                >
                  <option value="all">Semua Armada ({fleets.length})</option>
                  {fleets.map(f => (
                    <option key={f.id} value={f.id}>
                      {f.initialCode ? `${f.initialCode} - ` : ''}{f.plateNumber} ({f.vehicleType})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[11px] text-slate-400 block mb-1">Kategori:</label>
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-xs text-white"
                >
                  <option value="all">Semua Kategori</option>
                  <option value="oli">Oli Mesin & Pelumas</option>
                  <option value="ban">Ban & Velg</option>
                  <option value="aki">Aki & Baterai</option>
                  <option value="filter">Filter</option>
                  <option value="rem">Pengereman</option>
                </select>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleExportCSV}
                className="px-3.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
              >
                <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
                <span>Export CSV</span>
              </button>

              <button
                onClick={() => {
                  const defaultFleet = fleets[0];
                  if (defaultFleet) handleOpenLogForFleet(defaultFleet);
                }}
                className="px-3.5 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs flex items-center gap-1.5 transition cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>+ Catat Ganti Baru</span>
              </button>
            </div>
          </div>

          {/* Usages Table */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-lg">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-950/80 text-slate-400 uppercase text-[10px] font-bold tracking-wider border-b border-slate-800">
                  <tr>
                    <th className="px-4 py-3">Tanggal Ganti</th>
                    <th className="px-4 py-3">Armada Kendaraan</th>
                    <th className="px-4 py-3">Komponen Sparepart</th>
                    <th className="px-4 py-3">Qty</th>
                    <th className="px-4 py-3">KM Servis</th>
                    <th className="px-4 py-3">Target Servis Berikut</th>
                    <th className="px-4 py-3">Mekanik / Bengkel</th>
                    <th className="px-4 py-3 text-right">Biaya (Rp)</th>
                    <th className="px-4 py-3 text-center">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-slate-300">
                  {filteredUsages.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="px-4 py-8 text-center text-slate-500">
                        Belum ada riwayat penggantian komponen untuk filter yang dipilih.
                      </td>
                    </tr>
                  ) : (
                    filteredUsages.map(usage => {
                      const badge = getCategoryBadge(usage.category);
                      const Icon = badge.icon;

                      return (
                        <tr key={usage.id} className="hover:bg-slate-800/40 transition">
                          <td className="px-4 py-3 font-mono text-slate-200">
                            {usage.replacementDate}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-1.5">
                              {usage.initialCode && (
                                <span className="px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-400 font-mono text-[10px] font-bold">
                                  {usage.initialCode}
                                </span>
                              )}
                              <span className="font-bold text-white font-mono">{usage.plateNumber}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <span className={`p-1 rounded border ${badge.color}`}>
                                <Icon className="w-3 h-3" />
                              </span>
                              <div>
                                <div className="font-semibold text-white">{usage.partName}</div>
                                {usage.notes && (
                                  <div className="text-[10px] text-slate-400 line-clamp-1 italic">
                                    "{usage.notes}"
                                  </div>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3 font-semibold text-white">
                            {usage.quantity} <span className="text-[11px] font-normal text-slate-400">{usage.unit}</span>
                          </td>
                          <td className="px-4 py-3 font-mono font-bold text-amber-400">
                            {usage.odometerKm.toLocaleString('id-ID')} KM
                          </td>
                          <td className="px-4 py-3 font-mono text-slate-300 text-[11px]">
                            {usage.nextReplacementKm ? `${usage.nextReplacementKm.toLocaleString('id-ID')} KM` : '-'}
                            {usage.nextReplacementDate && (
                              <span className="text-[10px] text-slate-400 block">({usage.nextReplacementDate})</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-slate-300">
                            {usage.mechanicOrWorkshop}
                          </td>
                          <td className="px-4 py-3 text-right font-mono font-bold text-emerald-400">
                            Rp {usage.totalCost.toLocaleString('id-ID')}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <button
                              onClick={() => {
                                if (confirm(`Hapus catatan penggantian ${usage.partName} pada ${usage.plateNumber}?`)) {
                                  logisticsStore.deleteSparePartUsage(usage.id);
                                }
                              }}
                              className="p-1 rounded hover:bg-rose-900/60 text-slate-400 hover:text-rose-300 transition cursor-pointer"
                              title="Hapus Catatan"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL 1: CATAT PENGGANTIAN KOMPONEN RUTIN ARMADA          */}
      {/* ========================================================= */}
      {isLogUsageOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xs">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-xl p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Wrench className="w-5 h-5 text-amber-400" />
                <h3 className="text-base font-black text-white">Catat Penggantian Komponen Rutin</h3>
              </div>
              <button
                onClick={() => setIsLogUsageOpen(false)}
                className="text-slate-400 hover:text-white text-sm"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmitUsage} className="space-y-3.5 text-xs">
              {/* Pilih Armada */}
              <div>
                <label className="text-slate-300 block mb-1 font-semibold">Armada Kendaraan:</label>
                <select
                  required
                  value={usageForm.fleetId}
                  onChange={(e) => {
                    const f = fleets.find(fl => fl.id === e.target.value);
                    setUsageForm({
                      ...usageForm,
                      fleetId: e.target.value,
                      odometerKm: f?.odometerKm || usageForm.odometerKm
                    });
                  }}
                  className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-white font-semibold"
                >
                  {fleets.map(f => (
                    <option key={f.id} value={f.id}>
                      {f.initialCode ? `[${f.initialCode}] ` : ''}{f.plateNumber} - {f.vehicleType} ({f.brand})
                    </option>
                  ))}
                </select>
              </div>

              {/* Kategori Komponen */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-300 block mb-1 font-semibold">Kategori Komponen:</label>
                  <select
                    value={usageForm.category}
                    onChange={(e) => handleCategoryChangeForUsage(e.target.value as SparePartCategory)}
                    className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-white"
                  >
                    <option value="oli">Oli Mesin & Pelumas</option>
                    <option value="ban">Ban & Velg</option>
                    <option value="aki">Aki & Baterai</option>
                    <option value="filter">Filter Oli / Solar</option>
                    <option value="rem">Pengereman</option>
                    <option value="lainnya">Lainnya</option>
                  </select>
                </div>

                <div>
                  <label className="text-slate-300 block mb-1 font-semibold">Tanggal Pemasangan:</label>
                  <input
                    type="date"
                    required
                    value={usageForm.replacementDate}
                    onChange={(e) => setUsageForm({ ...usageForm, replacementDate: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-white font-mono"
                  />
                </div>
              </div>

              {/* Pilih Sparepart dari Master Inventaris */}
              <div>
                <label className="text-slate-300 block mb-1 font-semibold flex items-center justify-between">
                  <span>Pilih Sparepart dari Gudang:</span>
                  <span className="text-[10px] text-amber-400">Stok otomatis berkurang</span>
                </label>
                <select
                  required
                  value={usageForm.partId}
                  onChange={(e) => {
                    const selected = spareParts.find(p => p.id === e.target.value);
                    setUsageForm({
                      ...usageForm,
                      partId: e.target.value,
                      totalCost: selected ? selected.costPerUnit * usageForm.quantity : usageForm.totalCost
                    });
                  }}
                  className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-white"
                >
                  <option value="">-- Pilih Barang Master Part --</option>
                  {spareParts
                    .filter(p => p.category === usageForm.category)
                    .map(p => (
                      <option key={p.id} value={p.id} disabled={p.stock <= 0}>
                        {p.name} ({p.partNumber}) - Sisa Stok: {p.stock} {p.unit} - Rp {p.costPerUnit.toLocaleString('id-ID')}
                      </option>
                    ))}
                </select>
              </div>

              {/* Jumlah & Total Biaya */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-300 block mb-1 font-semibold">Jumlah (Unit/Qty):</label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={usageForm.quantity}
                    onChange={(e) => {
                      const qty = Number(e.target.value);
                      const selected = spareParts.find(p => p.id === usageForm.partId);
                      setUsageForm({
                        ...usageForm,
                        quantity: qty,
                        totalCost: selected ? selected.costPerUnit * qty : usageForm.totalCost
                      });
                    }}
                    className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-white font-mono font-bold"
                  />
                </div>

                <div>
                  <label className="text-slate-300 block mb-1 font-semibold">Total Biaya Penggantian (Rp):</label>
                  <input
                    type="number"
                    required
                    value={usageForm.totalCost}
                    onChange={(e) => setUsageForm({ ...usageForm, totalCost: Number(e.target.value) })}
                    className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-amber-400 font-mono font-bold"
                  />
                </div>
              </div>

              {/* Odometer Saat Ini & Target KM Berikutnya */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-300 block mb-1 font-semibold">KM Odometer Saat Ini:</label>
                  <input
                    type="number"
                    required
                    value={usageForm.odometerKm}
                    onChange={(e) => setUsageForm({ ...usageForm, odometerKm: Number(e.target.value) })}
                    className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-white font-mono"
                  />
                </div>

                <div>
                  <label className="text-slate-300 block mb-1 font-semibold flex items-center justify-between">
                    <span>Target KM Ganti Berikut:</span>
                    <span className="text-[10px] text-blue-400">+10k / +50k KM</span>
                  </label>
                  <input
                    type="number"
                    value={usageForm.nextReplacementKm}
                    onChange={(e) => setUsageForm({ ...usageForm, nextReplacementKm: Number(e.target.value) })}
                    className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-white font-mono"
                  />
                </div>
              </div>

              {/* Bengkel / Teknisi & Target Tanggal */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-300 block mb-1 font-semibold">Teknisi / Bengkel Rekanan:</label>
                  <input
                    type="text"
                    required
                    placeholder="Mekanik Internal / Bengkel Hino"
                    value={usageForm.mechanicOrWorkshop}
                    onChange={(e) => setUsageForm({ ...usageForm, mechanicOrWorkshop: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-white"
                  />
                </div>

                <div>
                  <label className="text-slate-300 block mb-1 font-semibold">Estimasi Tanggal Berikutnya:</label>
                  <input
                    type="date"
                    value={usageForm.nextReplacementDate}
                    onChange={(e) => setUsageForm({ ...usageForm, nextReplacementDate: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-white font-mono"
                  />
                </div>
              </div>

              {/* Catatan / Kondisi */}
              <div>
                <label className="text-slate-300 block mb-1 font-semibold">Catatan Pemeriksaan / Kondisi Komponen Lama:</label>
                <textarea
                  rows={2}
                  value={usageForm.notes}
                  onChange={(e) => setUsageForm({ ...usageForm, notes: e.target.value })}
                  placeholder="Kondisi komponen lama, alasan ganti, atau keluhan supir..."
                  className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-white"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsLogUsageOpen(false)}
                  className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-black flex items-center gap-1.5 shadow-md"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Simpan Penggantian</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL 2: TAMBAH MASTER SPAREPART BARU                     */}
      {/* ========================================================= */}
      {isAddPartOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xs">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Package className="w-5 h-5 text-emerald-400" />
                <h3 className="text-base font-black text-white">Tambah Master Sparepart Baru</h3>
              </div>
              <button
                onClick={() => setIsAddPartOpen(false)}
                className="text-slate-400 hover:text-white text-sm"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreatePart} className="space-y-3.5 text-xs">
              <div>
                <label className="text-slate-300 block mb-1 font-semibold">Nama Sparepart / Komponen:</label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: Oli Mesin Meditran SX 15W-40 4L"
                  value={newPart.name}
                  onChange={(e) => setNewPart({ ...newPart, name: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-300 block mb-1 font-semibold">Kategori:</label>
                  <select
                    value={newPart.category}
                    onChange={(e) => setNewPart({ ...newPart, category: e.target.value as SparePartCategory })}
                    className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-white"
                  >
                    <option value="oli">Oli Mesin & Pelumas</option>
                    <option value="ban">Ban & Velg</option>
                    <option value="aki">Aki & Baterai</option>
                    <option value="filter">Filter</option>
                    <option value="rem">Pengereman</option>
                    <option value="lainnya">Lainnya</option>
                  </select>
                </div>

                <div>
                  <label className="text-slate-300 block mb-1 font-semibold">Kode / Part Number:</label>
                  <input
                    type="text"
                    required
                    placeholder="Contoh: MED-SX-4L"
                    value={newPart.partNumber}
                    onChange={(e) => setNewPart({ ...newPart, partNumber: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-white font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-slate-300 block mb-1 font-semibold">Satuan:</label>
                  <input
                    type="text"
                    required
                    placeholder="Liter / Pcs / Set"
                    value={newPart.unit}
                    onChange={(e) => setNewPart({ ...newPart, unit: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-white"
                  />
                </div>

                <div>
                  <label className="text-slate-300 block mb-1 font-semibold">Stok Awal:</label>
                  <input
                    type="number"
                    min="0"
                    required
                    value={newPart.stock}
                    onChange={(e) => setNewPart({ ...newPart, stock: Number(e.target.value) })}
                    className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-white font-mono"
                  />
                </div>

                <div>
                  <label className="text-slate-300 block mb-1 font-semibold">Min. Stok (Alert):</label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={newPart.minStock}
                    onChange={(e) => setNewPart({ ...newPart, minStock: Number(e.target.value) })}
                    className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-white font-mono text-rose-400"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-300 block mb-1 font-semibold">Harga Satuan (Rp):</label>
                  <input
                    type="number"
                    min="0"
                    required
                    value={newPart.costPerUnit}
                    onChange={(e) => setNewPart({ ...newPart, costPerUnit: Number(e.target.value) })}
                    className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-amber-400 font-mono font-bold"
                  />
                </div>

                <div>
                  <label className="text-slate-300 block mb-1 font-semibold">Lokasi Rak Gudang:</label>
                  <input
                    type="text"
                    required
                    placeholder="Rak A-01 / Rak Ban B-02"
                    value={newPart.storageLocation}
                    onChange={(e) => setNewPart({ ...newPart, storageLocation: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-white"
                  />
                </div>
              </div>

              <div>
                <label className="text-slate-300 block mb-1 font-semibold">Armada Kompatibel:</label>
                <input
                  type="text"
                  placeholder="Contoh: Pick Up L300, Traga, Canter CDD"
                  value={newPart.compatibleVehicles}
                  onChange={(e) => setNewPart({ ...newPart, compatibleVehicles: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-white"
                />
              </div>

              <div>
                <label className="text-slate-300 block mb-1 font-semibold">Catatan Spesifikasi:</label>
                <textarea
                  rows={2}
                  value={newPart.notes}
                  onChange={(e) => setNewPart({ ...newPart, notes: e.target.value })}
                  placeholder="Standar kekentalan, garansi, interval ganti..."
                  className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-white"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsAddPartOpen(false)}
                  className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold flex items-center gap-1.5 shadow-md"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Simpan Sparepart</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL 3: RESTOCK BARANG MASUK KE GUDANG                   */}
      {/* ========================================================= */}
      {isRestockOpen && selectedPartForRestock && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xs">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Plus className="w-5 h-5 text-blue-400" />
                <h3 className="text-base font-black text-white">Restock Sparepart Masuk</h3>
              </div>
              <button
                onClick={() => setIsRestockOpen(false)}
                className="text-slate-400 hover:text-white text-sm"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleRestockSubmit} className="space-y-3.5 text-xs">
              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 space-y-1">
                <div className="text-white font-bold">{selectedPartForRestock.name}</div>
                <div className="text-slate-400 text-[11px] font-mono">Part No: {selectedPartForRestock.partNumber}</div>
                <div className="text-slate-400 text-[11px]">
                  Stok saat ini: <strong className="text-white">{selectedPartForRestock.stock} {selectedPartForRestock.unit}</strong>
                </div>
              </div>

              <div>
                <label className="text-slate-300 block mb-1 font-semibold">Jumlah Tambahan Stok Masuk:</label>
                <input
                  type="number"
                  min="1"
                  required
                  value={restockAmount}
                  onChange={(e) => setRestockAmount(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-white font-mono font-bold text-base"
                />
                <span className="text-[10px] text-slate-400 mt-1 block">
                  Total setelah restock: <strong className="text-emerald-400">{selectedPartForRestock.stock + Number(restockAmount)} {selectedPartForRestock.unit}</strong>
                </span>
              </div>

              <div>
                <label className="text-slate-300 block mb-1 font-semibold">Nomor PO / Catatan Penerimaan:</label>
                <input
                  type="text"
                  placeholder="PO-2026-09-XX / Suplier Jaya Diesel"
                  value={restockNotes}
                  onChange={(e) => setRestockNotes(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-white"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsRestockOpen(false)}
                  className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-bold flex items-center gap-1.5 shadow-md"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Konfirmasi Restock</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL 4: EDIT MASTER SPAREPART                            */}
      {/* ========================================================= */}
      {isEditPartOpen && editingPart && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xs">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Edit3 className="w-5 h-5 text-amber-400" />
                <h3 className="text-base font-black text-white">Edit Master Sparepart</h3>
              </div>
              <button
                onClick={() => setIsEditPartOpen(false)}
                className="text-slate-400 hover:text-white text-sm"
              >
                ✕
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                logisticsStore.updateSparePart(editingPart.id, editingPart);
                setIsEditPartOpen(false);
                setEditingPart(null);
              }}
              className="space-y-3.5 text-xs"
            >
              <div>
                <label className="text-slate-300 block mb-1 font-semibold">Nama Sparepart:</label>
                <input
                  type="text"
                  required
                  value={editingPart.name}
                  onChange={(e) => setEditingPart({ ...editingPart, name: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-300 block mb-1 font-semibold">Kategori:</label>
                  <select
                    value={editingPart.category}
                    onChange={(e) => setEditingPart({ ...editingPart, category: e.target.value as SparePartCategory })}
                    className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-white"
                  >
                    <option value="oli">Oli Mesin & Pelumas</option>
                    <option value="ban">Ban & Velg</option>
                    <option value="aki">Aki & Baterai</option>
                    <option value="filter">Filter</option>
                    <option value="rem">Pengereman</option>
                    <option value="lainnya">Lainnya</option>
                  </select>
                </div>

                <div>
                  <label className="text-slate-300 block mb-1 font-semibold">Kode / Part No:</label>
                  <input
                    type="text"
                    required
                    value={editingPart.partNumber}
                    onChange={(e) => setEditingPart({ ...editingPart, partNumber: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-white font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-slate-300 block mb-1 font-semibold">Satuan:</label>
                  <input
                    type="text"
                    required
                    value={editingPart.unit}
                    onChange={(e) => setEditingPart({ ...editingPart, unit: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-white"
                  />
                </div>

                <div>
                  <label className="text-slate-300 block mb-1 font-semibold">Stok Saat Ini:</label>
                  <input
                    type="number"
                    min="0"
                    required
                    value={editingPart.stock}
                    onChange={(e) => setEditingPart({ ...editingPart, stock: Number(e.target.value) })}
                    className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-white font-mono"
                  />
                </div>

                <div>
                  <label className="text-slate-300 block mb-1 font-semibold">Batas Min Stok:</label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={editingPart.minStock}
                    onChange={(e) => setEditingPart({ ...editingPart, minStock: Number(e.target.value) })}
                    className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-white font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-300 block mb-1 font-semibold">Harga Satuan (Rp):</label>
                  <input
                    type="number"
                    min="0"
                    required
                    value={editingPart.costPerUnit}
                    onChange={(e) => setEditingPart({ ...editingPart, costPerUnit: Number(e.target.value) })}
                    className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-amber-400 font-mono font-bold"
                  />
                </div>

                <div>
                  <label className="text-slate-300 block mb-1 font-semibold">Lokasi Rak:</label>
                  <input
                    type="text"
                    required
                    value={editingPart.storageLocation}
                    onChange={(e) => setEditingPart({ ...editingPart, storageLocation: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-white"
                  />
                </div>
              </div>

              <div>
                <label className="text-slate-300 block mb-1 font-semibold">Armada Kompatibel:</label>
                <input
                  type="text"
                  value={editingPart.compatibleVehicles}
                  onChange={(e) => setEditingPart({ ...editingPart, compatibleVehicles: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-white"
                />
              </div>

              <div>
                <label className="text-slate-300 block mb-1 font-semibold">Catatan:</label>
                <textarea
                  rows={2}
                  value={editingPart.notes || ''}
                  onChange={(e) => setEditingPart({ ...editingPart, notes: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-white"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsEditPartOpen(false)}
                  className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-black flex items-center gap-1.5 shadow-md"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Update Sparepart</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
