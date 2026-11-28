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
  Truck,
  FileSpreadsheet,
  History,
  Trash2,
  Edit3,
  ShieldCheck,
  AlertCircle,
  Warehouse,
  ChevronDown,
  Check,
  RefreshCw,
  X
} from 'lucide-react';
import { SparePart, SparePartUsage, SparePartCategory, Fleet } from '../types';
import { logisticsStore } from '../services/store';
import { branchStore } from '../services/branchStore';

interface SparePartManagementProps {
  initialFleetId?: string;
  onNavigateToFleets?: () => void;
}

export const SparePartManagement: React.FC<SparePartManagementProps> = ({
  initialFleetId
}) => {
  const [activeTab, setActiveTab] = useState<'inventory' | 'fleet_health' | 'history'>('fleet_health');
  const [currentUser, setCurrentUser] = useState(() => logisticsStore.getCurrentUser());
  const isSuperAdmin = currentUser?.role === 'super_admin';

  const [spareParts, setSpareParts] = useState<SparePart[]>(() => logisticsStore.getSpareParts());
  const [usages, setUsages] = useState<SparePartUsage[]>(() => logisticsStore.getSparePartUsages());
  const [allFleets, setAllFleets] = useState<Fleet[]>(() => logisticsStore.getFleets());
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [syncError, setSyncError] = useState<string>('');

  // Multi-Branch State (Super Admin defaults to 'ALL' so all branches appear immediately)
  const [selectedBranchId, setSelectedBranchId] = useState<string>(() =>
    logisticsStore.getCurrentUser()?.role === 'super_admin'
      ? 'ALL'
      : branchStore.getSelectedOriginBranchId()
  );
  const [isBranchDropdownOpen, setIsBranchDropdownOpen] = useState<boolean>(false);
  const branches = branchStore.getBranches();
  const selectedBranch = branches.find((b: any) => b.id === selectedBranchId) || branches[0];

  useEffect(() => {
    return branchStore.subscribe(() => {
      if (logisticsStore.getCurrentUser()?.role !== 'super_admin') {
        setSelectedBranchId(branchStore.getSelectedOriginBranchId());
      }
    });
  }, []);

  // Load live Spare Parts & Usages from MySQL on mount and subscribe to store changes
  const handleRefreshFromServer = async () => {
    setIsRefreshing(true);
    setSyncError('');
    try {
      await logisticsStore.refreshSparePartsFromServer();
      setSpareParts([...logisticsStore.getSpareParts()]);
      setUsages([...logisticsStore.getSparePartUsages()]);
      setAllFleets([...logisticsStore.getFleets()]);
    } catch (err: unknown) {
      setSyncError(err instanceof Error ? err.message : 'Gagal memuat data sparepart dari MySQL.');
    } finally {
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    void handleRefreshFromServer();
    const unsubscribe = logisticsStore.subscribe(() => {
      setCurrentUser(logisticsStore.getCurrentUser());
      setSpareParts([...logisticsStore.getSpareParts()]);
      setUsages([...logisticsStore.getSparePartUsages()]);
      setAllFleets([...logisticsStore.getFleets()]);
    });
    return unsubscribe;
  }, []);

  // Filter fleets by selected branch
  const fleets =
    selectedBranchId === 'ALL'
      ? allFleets
      : allFleets.filter(
          f => branchStore.getFleetBranch(f.id, f.plateNumber, f.initialCode, f.branchId).id === selectedBranchId
        );

  const visibleFleetIds = new Set(fleets.map(f => f.id));

  // Filters & inline confirmations
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedFleetFilter, setSelectedFleetFilter] = useState<string>(initialFleetId || 'all');
  const [confirmDeletePartId, setConfirmDeletePartId] = useState<string | null>(null);
  const [confirmDeleteUsageId, setConfirmDeleteUsageId] = useState<string | null>(null);

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

  // Custom Dropdown Open States for Modals
  const [openDropdown, setOpenDropdown] = useState<
    null | 'usage_fleet' | 'usage_category' | 'usage_part' | 'new_category'
  >(null);
  const [fleetDropdownSearch, setFleetDropdownSearch] = useState('');

  const CATEGORY_OPTIONS_META: Array<{
    value: SparePartCategory;
    label: string;
    sub: string;
    color: string;
    icon: React.ElementType;
  }> = [
    {
      value: 'oli',
      label: 'Oli Mesin & Pelumas',
      sub: 'Siklus 10.000 KM / 3 Bulan',
      color: 'text-amber-700 bg-amber-50 border-amber-200',
      icon: Droplets
    },
    {
      value: 'ban',
      label: 'Ban & Velg',
      sub: 'Siklus 50.000 KM / 12 Bulan',
      color: 'text-emerald-700 bg-emerald-50 border-emerald-200',
      icon: Disc
    },
    {
      value: 'aki',
      label: 'Aki & Baterai',
      sub: 'Siklus 80.000 KM / 18 Bulan',
      color: 'text-blue-700 bg-blue-50 border-blue-200',
      icon: BatteryCharging
    },
    {
      value: 'filter',
      label: 'Filter Oli / Solar / Udara',
      sub: 'Siklus 15.000 KM / 4 Bulan',
      color: 'text-slate-700 bg-slate-100 border-slate-200',
      icon: Filter
    },
    {
      value: 'rem',
      label: 'Sistem Pengereman',
      sub: 'Siklus 30.000 KM / 8 Bulan',
      color: 'text-red-700 bg-red-50 border-red-200',
      icon: AlertCircle
    },
    {
      value: 'lainnya',
      label: 'Komponen Lainnya',
      sub: 'Sesuai kebutuhan servis',
      color: 'text-slate-700 bg-slate-100 border-slate-200',
      icon: Package
    }
  ];

  const formatIndoDateDisplay = (isoDate: string) => {
    if (!isoDate) return '-';
    const parts = isoDate.split('-');
    if (parts.length !== 3) return isoDate;
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
    const mIdx = parseInt(parts[1], 10) - 1;
    return `${parts[2]} ${months[mIdx] || parts[1]} ${parts[0]}`;
  };

  // Update usageForm defaults when category changes
  const handleCategoryChangeForUsage = (category: SparePartCategory) => {
    const matchedParts = spareParts.filter(p => p.category === category);
    const firstPart = matchedParts[0];

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
  const handleOpenLogForFleet = (
    fleet: Fleet,
    specificCategory?: SparePartCategory,
    tirePositionLabel?: string
  ) => {
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

    const componentDesc = tirePositionLabel || (cat === 'ban' ? 'Ban Armada Depan Kanan' : cat);

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
      notes: `Penggantian rutin ${componentDesc} untuk armada ${fleet.initialCode || fleet.plateNumber}`
    });
    setOpenDropdown(null);
    setIsLogUsageOpen(true);
  };

  // Submit new Spare Part
  const handleCreatePart = (e: React.FormEvent) => {
    e.preventDefault();
    logisticsStore.addSparePart(newPart);
    setIsAddPartOpen(false);
    setOpenDropdown(null);
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
    const selectedFleet =
      fleets.find(f => f.id === usageForm.fleetId) ||
      allFleets.find(f => f.id === usageForm.fleetId);
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
    setOpenDropdown(null);
  };

  // Branch-scoped usages when a single branch is chosen; ALL for Super Admin default
  const branchScopedUsages =
    selectedBranchId === 'ALL'
      ? usages
      : usages.filter(u => !u.fleetId || visibleFleetIds.has(u.fleetId));

  // KPI Calculations
  const totalPartsCount = spareParts.length;
  const totalStockItems = spareParts.reduce((acc, p) => acc + p.stock, 0);
  const totalInventoryValue = spareParts.reduce((acc, p) => acc + p.stock * p.costPerUnit, 0);
  const lowStockParts = spareParts.filter(p => p.stock <= p.minStock);
  const thisMonthUsages = branchScopedUsages.filter(u => {
    const d = new Date(u.replacementDate);
    const now = new Date();
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  });
  const totalMaintenanceExpenseThisMonth = thisMonthUsages.reduce((acc, u) => acc + u.totalCost, 0);

  // Filtered Parts
  const filteredParts = spareParts.filter(part => {
    const q = searchQuery.toLowerCase();
    const matchSearch =
      !q ||
      part.name.toLowerCase().includes(q) ||
      part.partNumber.toLowerCase().includes(q) ||
      part.compatibleVehicles.toLowerCase().includes(q);
    const matchCat = selectedCategory === 'all' || part.category === selectedCategory;
    return matchSearch && matchCat;
  });

  // Filtered Usages
  const filteredUsages = branchScopedUsages.filter(u => {
    const matchFleet = selectedFleetFilter === 'all' || u.fleetId === selectedFleetFilter;
    const matchCat = selectedCategory === 'all' || u.category === selectedCategory;
    return matchFleet && matchCat;
  });

  const getCategoryBadge = (cat: SparePartCategory) => {
    switch (cat) {
      case 'oli':
        return {
          label: 'Oli & Pelumas',
          color: 'text-amber-700 bg-amber-50 border-amber-200',
          icon: Droplets
        };
      case 'ban':
        return {
          label: 'Ban & Velg',
          color: 'text-emerald-700 bg-emerald-50 border-emerald-200',
          icon: Disc
        };
      case 'aki':
        return {
          label: 'Aki & Kelistrikan',
          color: 'text-blue-700 bg-blue-50 border-blue-200',
          icon: BatteryCharging
        };
      case 'filter':
        return {
          label: 'Filter & Udara',
          color: 'text-slate-700 bg-slate-100 border-slate-200',
          icon: Filter
        };
      case 'rem':
        return {
          label: 'Pengereman',
          color: 'text-red-700 bg-red-50 border-red-200',
          icon: AlertCircle
        };
      default:
        return {
          label: 'Lainnya',
          color: 'text-slate-700 bg-slate-100 border-slate-200',
          icon: Package
        };
    }
  };

  // Export CSV Helper
  const handleExportCSV = () => {
    const headers = [
      'ID',
      'Tanggal Ganti',
      'Armada',
      'Inisial',
      'Kategori',
      'Komponen Sparepart',
      'Jumlah',
      'Satuan',
      'Odometer KM',
      'Target KM Berikut',
      'Mekanik/Bengkel',
      'Biaya (Rp)',
      'Petugas',
      'Catatan'
    ];
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

    const csvContent =
      'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute(
      'download',
      `Riwayat_Penggantian_Sparepart_AKK_${new Date().toISOString().substring(0, 10)}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleSelectBranch = (branchId: string) => {
    setSelectedBranchId(branchId);
    setSelectedFleetFilter('all');
    if (branchId !== 'ALL' || !isSuperAdmin) {
      branchStore.setSelectedOriginBranchId(branchId);
    }
    setIsBranchDropdownOpen(false);
  };

  return (
    <div className="bg-slate-50 min-h-full p-4 sm:p-6 space-y-5 text-slate-900">
      {/* Top Header Card */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold text-blue-600 mb-1">
              <Warehouse className="w-4 h-4" />
              <span>
                Logistik &amp; Pemeliharaan Armada ·{' '}
                {selectedBranchId === 'ALL' ? 'Semua Cabang' : selectedBranch?.name || 'Cabang'}
              </span>
            </div>
            <h2 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
              Manajemen Sparepart &amp; Komponen Rutin
            </h2>
            <p className="text-xs sm:text-sm text-slate-500 mt-0.5 max-w-2xl">
              Pantau stok fisik sparepart gudang dan siklus penggantian komponen rutin tiap armada langsung dari database MySQL.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* Cabang Selector */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setIsBranchDropdownOpen(prev => !prev)}
                className="flex items-center justify-between gap-2.5 px-3.5 py-2 rounded-lg bg-white hover:bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-800 transition cursor-pointer min-w-[215px]"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <Warehouse className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                  <span className="text-slate-500">Cabang:</span>
                  <span className="text-slate-900 truncate font-semibold">
                    {selectedBranchId === 'ALL'
                      ? `Semua Cabang (${allFleets.length} Unit)`
                      : `${selectedBranch?.name || 'Cabang'} (${fleets.length} Unit)`}
                  </span>
                </div>
                <ChevronDown
                  className={`w-3.5 h-3.5 text-slate-400 shrink-0 transition-transform duration-150 ${
                    isBranchDropdownOpen ? 'rotate-180 text-blue-600' : ''
                  }`}
                />
              </button>

              {isBranchDropdownOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setIsBranchDropdownOpen(false)} />
                  <div className="absolute right-0 mt-1.5 w-64 z-50 bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden divide-y divide-slate-100">
                    <button
                      type="button"
                      onClick={() => handleSelectBranch('ALL')}
                      className={`w-full px-3.5 py-2.5 text-left text-xs font-semibold flex items-center justify-between gap-2 transition cursor-pointer ${
                        selectedBranchId === 'ALL'
                          ? 'bg-blue-50 text-blue-700'
                          : 'text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      <span>Semua Cabang</span>
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] font-mono tabular-nums text-slate-500">
                          {allFleets.length} Unit
                        </span>
                        {selectedBranchId === 'ALL' && <Check className="w-3.5 h-3.5 text-blue-600" />}
                      </div>
                    </button>
                    {branches.map((b: any) => {
                      const cnt = allFleets.filter(
                        f => branchStore.getFleetBranch(f.id, f.plateNumber, f.initialCode, f.branchId).id === b.id
                      ).length;
                      const isSel = selectedBranchId === b.id;
                      return (
                        <button
                          key={b.id}
                          type="button"
                          onClick={() => handleSelectBranch(b.id)}
                          className={`w-full px-3.5 py-2.5 text-left text-xs font-semibold flex items-center justify-between gap-2 transition cursor-pointer ${
                            isSel ? 'bg-blue-50 text-blue-700' : 'text-slate-700 hover:bg-slate-50'
                          }`}
                        >
                          <span>Cabang {b.name.replace(/^Cabang\s+/i, '')}</span>
                          <div className="flex items-center gap-2">
                            <span className="text-[11px] font-mono tabular-nums text-slate-500">
                              {cnt} Unit
                            </span>
                            {isSel && <Check className="w-3.5 h-3.5 text-blue-600" />}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </>
              )}
            </div>

            <button
              type="button"
              onClick={handleRefreshFromServer}
              disabled={isRefreshing}
              className="px-3 py-2 rounded-lg bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 font-semibold text-xs flex items-center gap-1.5 transition cursor-pointer whitespace-nowrap disabled:opacity-50"
              title="Muat ulang data sparepart dari MySQL"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-slate-500 ${isRefreshing ? 'animate-spin' : ''}`} />
              <span>Segarkan</span>
            </button>

            <button
              type="button"
              onClick={() => setIsAddPartOpen(true)}
              className="px-3.5 py-2 rounded-lg bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 font-semibold text-xs flex items-center gap-1.5 transition cursor-pointer whitespace-nowrap"
            >
              <Plus className="w-4 h-4 text-blue-600" />
              <span>Tambah Master Part</span>
            </button>

            <button
              type="button"
              onClick={() => {
                const defaultFleet = fleets[0] || allFleets[0];
                if (defaultFleet) handleOpenLogForFleet(defaultFleet, 'oli');
              }}
              className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs flex items-center gap-1.5 transition cursor-pointer whitespace-nowrap"
            >
              <Wrench className="w-4 h-4" />
              <span>Ganti Sparepart</span>
            </button>
          </div>
        </div>

        {syncError && (
          <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs font-semibold flex items-center justify-between gap-2">
            <span className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              {syncError}
            </span>
            <button
              type="button"
              onClick={() => setSyncError('')}
              className="text-red-500 hover:text-red-700 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* 4 Summary Stat Cards (Uniform Flat White) */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5 pt-4 border-t border-slate-100">
          <div className="bg-white p-4 rounded-xl border border-slate-200">
            <div className="flex items-center justify-between text-slate-500 text-xs font-semibold mb-1">
              <span>Master Sparepart</span>
              <Package className="w-4 h-4 text-slate-400" />
            </div>
            <div className="text-xl font-bold text-slate-900 font-mono tabular-nums">
              {totalPartsCount}{' '}
              <span className="text-xs font-sans font-medium text-slate-500">
                item ({totalStockItems} unit)
              </span>
            </div>
            <div className="text-xs text-slate-500 mt-1">Terdaftar di master inventaris</div>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-200">
            <div className="flex items-center justify-between text-slate-500 text-xs font-semibold mb-1">
              <span>Peringatan Stok Tipis</span>
              <AlertTriangle
                className={`w-4 h-4 ${lowStockParts.length > 0 ? 'text-red-600' : 'text-slate-400'}`}
              />
            </div>
            <div
              className={`text-xl font-bold font-mono tabular-nums ${
                lowStockParts.length > 0 ? 'text-red-600' : 'text-emerald-600'
              }`}
            >
              {lowStockParts.length}{' '}
              <span className="text-xs font-sans font-medium text-slate-500">item perlu restock</span>
            </div>
            <div className="text-xs text-slate-500 mt-1">Stok &le; batas minimum gudang</div>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-200">
            <div className="flex items-center justify-between text-slate-500 text-xs font-semibold mb-1">
              <span>Penggantian Bulan Ini</span>
              <Wrench className="w-4 h-4 text-slate-400" />
            </div>
            <div className="text-xl font-bold text-blue-600 font-mono tabular-nums">
              {thisMonthUsages.length}{' '}
              <span className="text-xs font-sans font-medium text-slate-500">kali servis</span>
            </div>
            <div className="text-xs text-slate-500 mt-1 tabular-nums">
              Total biaya: Rp {totalMaintenanceExpenseThisMonth.toLocaleString('id-ID')}
            </div>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-200">
            <div className="flex items-center justify-between text-slate-500 text-xs font-semibold mb-1">
              <span>Estimasi Nilai Stok</span>
              <ShieldCheck className="w-4 h-4 text-slate-400" />
            </div>
            <div className="text-xl font-bold text-slate-900 font-mono tabular-nums">
              Rp {(totalInventoryValue / 1000000).toFixed(2)}{' '}
              <span className="text-xs font-sans font-medium text-slate-500">Juta</span>
            </div>
            <div className="text-xs text-slate-500 mt-1">Aset komponen siap pasang</div>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex flex-wrap items-center gap-1 bg-white p-1 rounded-xl border border-slate-200">
          <button
            type="button"
            onClick={() => setActiveTab('fleet_health')}
            className={`px-3.5 py-2 rounded-lg text-xs font-semibold transition cursor-pointer flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'fleet_health'
                ? 'bg-blue-600 text-white'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            <Truck className="w-4 h-4" />
            <span>Kondisi Komponen Tiap Armada ({fleets.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('inventory')}
            className={`px-3.5 py-2 rounded-lg text-xs font-semibold transition cursor-pointer flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'inventory'
                ? 'bg-blue-600 text-white'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            <Package className="w-4 h-4" />
            <span>
              Katalog Stok Gudang ({spareParts.length}
              {lowStockParts.length > 0 ? ` · ${lowStockParts.length} Tipis` : ''})
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('history')}
            className={`px-3.5 py-2 rounded-lg text-xs font-semibold transition cursor-pointer flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'history'
                ? 'bg-blue-600 text-white'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            <History className="w-4 h-4" />
            <span>Riwayat Penggantian &amp; Servis ({branchScopedUsages.length})</span>
          </button>
        </div>
      </div>

      {/* ========================================================= */}
      {/* TAB 1: FLEET HEALTH MONITOR                               */}
      {/* ========================================================= */}
      {activeTab === 'fleet_health' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-xl border border-slate-200 text-xs text-slate-600">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-blue-600 shrink-0" />
              <span>
                <strong className="text-slate-900">Siklus Rekomendasi AKK:</strong> Oli Mesin tiap{' '}
                <strong className="text-slate-900">10.000 KM</strong> (maks 3 bulan), Ban Truk tiap{' '}
                <strong className="text-slate-900">50.000 KM</strong>, Aki Kendaraan tiap{' '}
                <strong className="text-slate-900">18 bulan</strong>.
              </span>
            </div>
            <div className="flex items-center gap-3 text-xs font-semibold shrink-0">
              <span className="text-emerald-700">Prima</span>
              <span className="text-slate-300">·</span>
              <span className="text-amber-700">Segera Jadwalkan</span>
              <span className="text-slate-300">·</span>
              <span className="text-red-600">Wajib Ganti</span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {fleets.map(fleet => {
              const status = logisticsStore.getFleetRoutineComponentsStatus(fleet.id);
              return (
                <div
                  key={fleet.id}
                  className="bg-white border border-slate-200 rounded-xl p-4 hover:border-blue-300 transition flex flex-col justify-between"
                >
                  <div>
                    {/* Fleet Header */}
                    <div className="flex items-start justify-between gap-2 pb-3 border-b border-slate-100">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-800 border border-slate-200 font-mono">
                            {fleet.initialCode || 'ARMADA'}
                          </span>
                          <span className="font-mono text-base font-bold text-slate-900">
                            {fleet.plateNumber}
                          </span>
                        </div>
                        <div className="text-xs text-slate-500 mt-1">
                          {fleet.vehicleType} · {fleet.brand || 'Standar'} ({fleet.year || '2023'})
                        </div>
                      </div>

                      <div className="text-right">
                        <span className="text-[11px] text-slate-500 block">Odometer</span>
                        <span className="font-mono tabular-nums font-bold text-slate-900 text-xs">
                          {(fleet.odometerKm || 45000).toLocaleString('id-ID')} KM
                        </span>
                      </div>
                    </div>

                    {/* Routine Components */}
                    <div className="space-y-2.5 my-3.5">
                      {/* OLI MESIN */}
                      <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="w-8 h-8 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-amber-600 shrink-0">
                            <Droplets className="w-4 h-4" />
                          </div>
                          <div className="min-w-0">
                            <div className="text-xs font-bold text-slate-900 flex items-center gap-1.5 flex-wrap">
                              <span>Oli Mesin</span>
                              <span
                                className={`text-[10px] px-1.5 py-0.5 rounded font-semibold border ${
                                  status.oil.status === 'urgent'
                                    ? 'bg-red-50 text-red-700 border-red-200'
                                    : status.oil.status === 'warning'
                                    ? 'bg-amber-50 text-amber-700 border-amber-200'
                                    : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                }`}
                              >
                                {status.oil.label}
                              </span>
                            </div>
                            <div className="text-[11px] text-slate-500 truncate">
                              Terakhir: {status.oil.lastDate}{' '}
                              {status.oil.lastKm > 0 && `(${status.oil.lastKm.toLocaleString('id-ID')} KM)`}
                            </div>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleOpenLogForFleet(fleet, 'oli')}
                          className="px-2.5 py-1 rounded-md bg-white hover:bg-blue-600 hover:text-white border border-slate-200 hover:border-blue-600 text-slate-700 text-[11px] font-semibold transition cursor-pointer shrink-0"
                          title="Catat Ganti Oli"
                        >
                          Ganti
                        </button>
                      </div>

                      {/* BAN ARMADA */}
                      <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200 space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-emerald-600 shrink-0">
                              <Disc className="w-3.5 h-3.5" />
                            </div>
                            <div>
                              <div className="text-xs font-bold text-slate-900 leading-tight">
                                Ban Armada (4 Posisi)
                              </div>
                              <div className="text-[11px] text-slate-500">
                                Pilih posisi ban untuk catat penggantian
                              </div>
                            </div>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-1.5">
                          {[
                            { data: status.tireFrontRight, shortName: 'Depan Kanan' },
                            { data: status.tireFrontLeft, shortName: 'Depan Kiri' },
                            { data: status.tireRearRight, shortName: 'Belakang Kanan' },
                            { data: status.tireRearLeft, shortName: 'Belakang Kiri' }
                          ].map(({ data: tirePos, shortName }) => (
                            <div
                              key={tirePos.positionLabel}
                              className="px-2.5 py-1.5 rounded-lg bg-white border border-slate-200 flex items-center justify-between gap-1.5"
                            >
                              <div className="min-w-0">
                                <div
                                  className={`text-[11px] font-semibold truncate ${
                                    tirePos.status === 'urgent'
                                      ? 'text-red-600'
                                      : tirePos.status === 'warning'
                                      ? 'text-amber-700'
                                      : 'text-slate-900'
                                  }`}
                                >
                                  {shortName}
                                </div>
                                <div className="text-[10px] text-slate-500 truncate">
                                  {tirePos.lastDate !== '-' ? tirePos.lastDate : tirePos.label}
                                </div>
                              </div>
                              <button
                                type="button"
                                onClick={() => handleOpenLogForFleet(fleet, 'ban', tirePos.positionLabel)}
                                className="px-1.5 py-0.5 rounded bg-slate-100 hover:bg-blue-600 hover:text-white text-slate-700 text-[10px] font-semibold transition cursor-pointer shrink-0"
                                title={`Catat Ganti ${tirePos.positionLabel}`}
                              >
                                Ganti
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* AKI */}
                      <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="w-8 h-8 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-blue-600 shrink-0">
                            <BatteryCharging className="w-4 h-4" />
                          </div>
                          <div className="min-w-0">
                            <div className="text-xs font-bold text-slate-900 flex items-center gap-1.5 flex-wrap">
                              <span>Aki (Baterai)</span>
                              <span
                                className={`text-[10px] px-1.5 py-0.5 rounded font-semibold border ${
                                  status.battery.status === 'urgent'
                                    ? 'bg-red-50 text-red-700 border-red-200'
                                    : status.battery.status === 'warning'
                                    ? 'bg-amber-50 text-amber-700 border-amber-200'
                                    : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                }`}
                              >
                                {status.battery.label}
                              </span>
                            </div>
                            <div className="text-[11px] text-slate-500">
                              Terakhir: {status.battery.lastDate}
                            </div>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleOpenLogForFleet(fleet, 'aki')}
                          className="px-2.5 py-1 rounded-md bg-white hover:bg-blue-600 hover:text-white border border-slate-200 hover:border-blue-600 text-slate-700 text-[11px] font-semibold transition cursor-pointer shrink-0"
                          title="Catat Ganti Aki"
                        >
                          Ganti
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Card Footer */}
                  <div className="pt-2.5 border-t border-slate-100 flex items-center justify-between">
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedFleetFilter(fleet.id);
                        setActiveTab('history');
                      }}
                      className="text-slate-500 hover:text-blue-600 text-xs font-semibold flex items-center gap-1 transition cursor-pointer"
                    >
                      <History className="w-3.5 h-3.5" />
                      <span>Lihat Riwayat ({logisticsStore.getSparePartUsages(fleet.id).length})</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleOpenLogForFleet(fleet)}
                      className="px-3 py-1.5 rounded-lg bg-blue-50 hover:bg-blue-600 text-blue-700 hover:text-white border border-blue-200 hover:border-blue-600 font-semibold text-xs transition cursor-pointer flex items-center gap-1"
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
      {/* TAB 2: KATALOG STOK GUDANG                                */}
      {/* ========================================================= */}
      {activeTab === 'inventory' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white p-3.5 rounded-xl border border-slate-200">
            <div className="flex flex-wrap items-center gap-2.5 w-full sm:w-auto flex-1">
              <div className="relative w-full sm:w-72">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Cari sparepart, part number, tipe truk..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-blue-600 focus:bg-white"
                />
              </div>

              <select
                value={selectedCategory}
                onChange={e => setSelectedCategory(e.target.value)}
                aria-label="Filter Kategori"
                className="px-3 py-2 rounded-lg bg-slate-50 border border-slate-200 text-xs font-medium text-slate-700 focus:outline-none focus:border-blue-600 cursor-pointer"
              >
                <option value="all">Semua Kategori</option>
                <option value="oli">Oli Mesin &amp; Pelumas</option>
                <option value="ban">Ban &amp; Velg</option>
                <option value="aki">Aki &amp; Baterai</option>
                <option value="filter">Filter</option>
                <option value="rem">Pengereman</option>
                <option value="lainnya">Lainnya</option>
              </select>
            </div>

            <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
              <span className="text-xs text-slate-500">
                Menampilkan <strong className="text-slate-900">{filteredParts.length}</strong> sparepart
              </span>
              <button
                type="button"
                onClick={() => setIsAddPartOpen(true)}
                className="px-3.5 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs flex items-center gap-1.5 transition cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Tambah Sparepart</span>
              </button>
            </div>
          </div>

          {filteredParts.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-xl p-10 text-center text-sm text-slate-500">
              Tidak ada master sparepart yang cocok dengan filter pencarian.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredParts.map(part => {
                const badge = getCategoryBadge(part.category);
                const Icon = badge.icon;
                const isLowStock = part.stock <= part.minStock;

                return (
                  <div
                    key={part.id}
                    className={`bg-white border rounded-xl p-4 transition flex flex-col justify-between ${
                      isLowStock ? 'border-red-300' : 'border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2">
                        <span
                          className={`px-2 py-0.5 rounded text-[11px] font-semibold border flex items-center gap-1 ${badge.color}`}
                        >
                          <Icon className="w-3 h-3" />
                          <span>{badge.label}</span>
                        </span>

                        {isLowStock ? (
                          <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-red-50 text-red-700 border border-red-200 flex items-center gap-1">
                            <AlertTriangle className="w-3 h-3" />
                            <span>Stok Tipis</span>
                          </span>
                        ) : (
                          <span className="text-[11px] text-slate-500 font-mono tabular-nums">
                            Min: {part.minStock} {part.unit}
                          </span>
                        )}
                      </div>

                      <h3 className="text-sm font-bold text-slate-900 mt-2.5 line-clamp-2" title={part.name}>
                        {part.name}
                      </h3>
                      <div className="text-[11px] font-mono text-slate-500 mt-0.5">
                        Part No: <span className="text-slate-800 font-semibold">{part.partNumber}</span>
                      </div>

                      <div className="my-3 space-y-1.5 text-xs text-slate-700">
                        <div className="flex items-center justify-between py-1 border-b border-slate-100">
                          <span className="text-slate-500 text-[11px]">Kompatibilitas:</span>
                          <span
                            className="font-medium text-right text-slate-900 max-w-[60%] truncate"
                            title={part.compatibleVehicles}
                          >
                            {part.compatibleVehicles}
                          </span>
                        </div>

                        <div className="flex items-center justify-between py-1 border-b border-slate-100">
                          <span className="text-slate-500 text-[11px]">Lokasi Rak:</span>
                          <span className="font-mono text-slate-700 text-[11px]">{part.storageLocation}</span>
                        </div>

                        <div className="flex items-center justify-between py-1 border-b border-slate-100">
                          <span className="text-slate-500 text-[11px]">Harga Satuan:</span>
                          <span className="font-mono tabular-nums font-bold text-slate-900">
                            Rp {part.costPerUnit.toLocaleString('id-ID')}
                          </span>
                        </div>
                      </div>

                      {part.notes && (
                        <p className="text-[11px] text-slate-600 bg-slate-50 p-2 rounded-lg border border-slate-200 line-clamp-2">
                          {part.notes}
                        </p>
                      )}
                    </div>

                    <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                      <div>
                        <span className="text-[11px] text-slate-500 block">Stok Tersedia</span>
                        <span
                          className={`text-lg font-bold font-mono tabular-nums ${
                            isLowStock ? 'text-red-600' : 'text-emerald-600'
                          }`}
                        >
                          {part.stock}{' '}
                          <span className="text-xs font-sans font-normal text-slate-500">{part.unit}</span>
                        </span>
                      </div>

                      {confirmDeletePartId === part.id ? (
                        <div className="inline-flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => {
                              logisticsStore.deleteSparePart(part.id);
                              setConfirmDeletePartId(null);
                            }}
                            className="px-2.5 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-semibold cursor-pointer"
                          >
                            Hapus
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmDeletePartId(null)}
                            className="px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold cursor-pointer"
                          >
                            Batal
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedPartForRestock(part);
                              setIsRestockOpen(true);
                            }}
                            className="px-2.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs transition cursor-pointer flex items-center gap-1"
                            title="Restock / Tambah Stok Masuk"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            <span>Restock</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              setEditingPart(part);
                              setIsEditPartOpen(true);
                            }}
                            className="p-1.5 rounded-lg bg-white hover:bg-slate-50 border border-slate-200 text-slate-600 hover:text-blue-600 transition cursor-pointer"
                            title="Edit Master Part"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>

                          <button
                            type="button"
                            onClick={() => setConfirmDeletePartId(part.id)}
                            className="p-1.5 rounded-lg bg-white hover:bg-red-50 border border-slate-200 text-slate-500 hover:text-red-600 transition cursor-pointer"
                            title="Hapus Part"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ========================================================= */}
      {/* TAB 3: RIWAYAT PENGGANTIAN & SERVIS                       */}
      {/* ========================================================= */}
      {activeTab === 'history' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white p-4 rounded-xl border border-slate-200">
            <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
              <div>
                <label className="text-[11px] font-semibold text-slate-500 block mb-1">Filter Armada</label>
                <select
                  value={selectedFleetFilter}
                  onChange={e => setSelectedFleetFilter(e.target.value)}
                  className="px-3 py-1.5 rounded-lg bg-slate-50 border border-slate-200 text-xs font-medium text-slate-800 focus:outline-none focus:border-blue-600 cursor-pointer"
                >
                  <option value="all">Semua Armada ({fleets.length})</option>
                  {fleets.map(f => (
                    <option key={f.id} value={f.id}>
                      {f.initialCode ? `${f.initialCode} - ` : ''}
                      {f.plateNumber} ({f.vehicleType})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[11px] font-semibold text-slate-500 block mb-1">Kategori</label>
                <select
                  value={selectedCategory}
                  onChange={e => setSelectedCategory(e.target.value)}
                  className="px-3 py-1.5 rounded-lg bg-slate-50 border border-slate-200 text-xs font-medium text-slate-800 focus:outline-none focus:border-blue-600 cursor-pointer"
                >
                  <option value="all">Semua Kategori</option>
                  <option value="oli">Oli Mesin &amp; Pelumas</option>
                  <option value="ban">Ban &amp; Velg</option>
                  <option value="aki">Aki &amp; Baterai</option>
                  <option value="filter">Filter</option>
                  <option value="rem">Pengereman</option>
                </select>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleExportCSV}
                className="px-3.5 py-2 rounded-lg bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
              >
                <FileSpreadsheet className="w-4 h-4 text-slate-500" />
                <span>Export CSV</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  const defaultFleet = fleets[0] || allFleets[0];
                  if (defaultFleet) handleOpenLogForFleet(defaultFleet);
                }}
                className="px-3.5 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs flex items-center gap-1.5 transition cursor-pointer"
              >
                <Wrench className="w-4 h-4" />
                <span>Ganti Sparepart</span>
              </button>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-700">
                <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200 whitespace-nowrap">
                  <tr>
                    <th className="px-4 py-3">Tanggal Ganti</th>
                    <th className="px-4 py-3">Armada Kendaraan</th>
                    <th className="px-4 py-3">Komponen Sparepart</th>
                    <th className="px-4 py-3">Qty</th>
                    <th className="px-4 py-3 text-right">KM Servis</th>
                    <th className="px-4 py-3">Target Servis Berikut</th>
                    <th className="px-4 py-3">Mekanik / Bengkel</th>
                    <th className="px-4 py-3 text-right">Biaya (Rp)</th>
                    <th className="px-4 py-3 text-center">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredUsages.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="px-4 py-10 text-center text-slate-500 text-sm">
                        Belum ada riwayat penggantian komponen untuk filter yang dipilih.
                      </td>
                    </tr>
                  ) : (
                    filteredUsages.map(usage => {
                      const badge = getCategoryBadge(usage.category);
                      const Icon = badge.icon;

                      return (
                        <tr key={usage.id} className="hover:bg-slate-50/80 transition">
                          <td className="px-4 py-3 font-mono tabular-nums text-slate-700 whitespace-nowrap">
                            {usage.replacementDate}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <div className="flex items-center gap-1.5">
                              {usage.initialCode && (
                                <span className="px-1.5 py-0.5 rounded bg-slate-100 border border-slate-200 text-slate-800 font-mono text-[11px] font-bold">
                                  {usage.initialCode}
                                </span>
                              )}
                              <span className="font-bold text-slate-900 font-mono">{usage.plateNumber}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <span className={`p-1 rounded border ${badge.color}`}>
                                <Icon className="w-3 h-3" />
                              </span>
                              <div>
                                <div className="font-semibold text-slate-900">{usage.partName}</div>
                                {usage.notes && (
                                  <div className="text-[11px] text-slate-500 line-clamp-1">{usage.notes}</div>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3 font-semibold text-slate-900 whitespace-nowrap tabular-nums">
                            {usage.quantity}{' '}
                            <span className="text-[11px] font-normal text-slate-500">{usage.unit}</span>
                          </td>
                          <td className="px-4 py-3 text-right font-mono tabular-nums font-bold text-blue-600 whitespace-nowrap">
                            {usage.odometerKm.toLocaleString('id-ID')} KM
                          </td>
                          <td className="px-4 py-3 font-mono tabular-nums text-slate-600 text-[11px] whitespace-nowrap">
                            {usage.nextReplacementKm
                              ? `${usage.nextReplacementKm.toLocaleString('id-ID')} KM`
                              : '-'}
                            {usage.nextReplacementDate && (
                              <span className="text-[10px] text-slate-500 block">
                                ({usage.nextReplacementDate})
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-slate-700">{usage.mechanicOrWorkshop}</td>
                          <td className="px-4 py-3 text-right font-mono tabular-nums font-bold text-slate-900 whitespace-nowrap">
                            Rp {usage.totalCost.toLocaleString('id-ID')}
                          </td>
                          <td className="px-4 py-3 text-center whitespace-nowrap">
                            {confirmDeleteUsageId === usage.id ? (
                              <div className="inline-flex items-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => {
                                    logisticsStore.deleteSparePartUsage(usage.id);
                                    setConfirmDeleteUsageId(null);
                                  }}
                                  className="px-2 py-1 rounded bg-red-600 hover:bg-red-700 text-white text-[11px] font-semibold cursor-pointer"
                                >
                                  Hapus
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setConfirmDeleteUsageId(null)}
                                  className="px-2 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-semibold cursor-pointer"
                                >
                                  Batal
                                </button>
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={() => setConfirmDeleteUsageId(usage.id)}
                                className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-red-50 text-slate-500 hover:text-red-600 transition cursor-pointer"
                                title="Hapus Catatan"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50">
          <div className="bg-white border border-slate-200 rounded-xl w-full max-w-xl p-5 sm:p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div className="flex items-center gap-2">
                <Wrench className="w-5 h-5 text-blue-600" />
                <h3 className="text-base font-bold text-slate-900">Ganti Sparepart &amp; Komponen Rutin</h3>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsLogUsageOpen(false);
                  setOpenDropdown(null);
                }}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmitUsage} className="space-y-3.5 text-xs">
              {/* Pilih Armada */}
              <div className="relative">
                <label className="text-slate-700 block mb-1 font-semibold">Armada Kendaraan</label>
                {(() => {
                  const selectedFleetObj =
                    fleets.find(fl => fl.id === usageForm.fleetId) ||
                    allFleets.find(fl => fl.id === usageForm.fleetId) ||
                    fleets[0];
                  const filteredFleetList = fleets.filter(fl => {
                    const q = fleetDropdownSearch.trim().toLowerCase();
                    if (!q) return true;
                    return (
                      fl.plateNumber.toLowerCase().includes(q) ||
                      (fl.initialCode || '').toLowerCase().includes(q) ||
                      fl.vehicleType.toLowerCase().includes(q) ||
                      (fl.brand || '').toLowerCase().includes(q)
                    );
                  });

                  return (
                    <>
                      <button
                        type="button"
                        onClick={() => setOpenDropdown(openDropdown === 'usage_fleet' ? null : 'usage_fleet')}
                        className="w-full px-3.5 py-2.5 rounded-lg bg-white hover:bg-slate-50 border border-slate-200 text-left flex items-center justify-between gap-2 transition cursor-pointer"
                      >
                        {selectedFleetObj ? (
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-800 border border-slate-200 font-mono text-[11px] font-bold shrink-0">
                              {selectedFleetObj.initialCode || 'ARM'}
                            </span>
                            <span className="font-mono font-bold text-slate-900 text-xs shrink-0">
                              {selectedFleetObj.plateNumber}
                            </span>
                            <span className="text-slate-500 text-[11px] truncate">
                              · {selectedFleetObj.vehicleType} ({selectedFleetObj.brand || 'Standar'})
                            </span>
                          </div>
                        ) : (
                          <span className="text-slate-400">Pilih Armada Kendaraan</span>
                        )}
                        <ChevronDown
                          className={`w-4 h-4 text-slate-400 shrink-0 transition-transform ${
                            openDropdown === 'usage_fleet' ? 'rotate-180 text-blue-600' : ''
                          }`}
                        />
                      </button>

                      {openDropdown === 'usage_fleet' && (
                        <div className="absolute z-50 left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
                          <div className="p-2 border-b border-slate-100 bg-slate-50">
                            <div className="relative">
                              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                              <input
                                type="text"
                                placeholder="Cari plat nomor, kode inisial, atau tipe..."
                                value={fleetDropdownSearch}
                                onChange={e => setFleetDropdownSearch(e.target.value)}
                                className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-white border border-slate-200 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-blue-600"
                              />
                            </div>
                          </div>
                          <div className="max-h-56 overflow-y-auto divide-y divide-slate-100">
                            {filteredFleetList.map(fl => {
                              const isSelected = fl.id === usageForm.fleetId;
                              return (
                                <button
                                  key={fl.id}
                                  type="button"
                                  onClick={() => {
                                    setUsageForm({
                                      ...usageForm,
                                      fleetId: fl.id,
                                      odometerKm: fl.odometerKm || usageForm.odometerKm
                                    });
                                    setOpenDropdown(null);
                                    setFleetDropdownSearch('');
                                  }}
                                  className={`w-full px-3.5 py-2.5 text-left flex items-center justify-between gap-2 transition cursor-pointer ${
                                    isSelected ? 'bg-blue-50 text-blue-700' : 'hover:bg-slate-50 text-slate-800'
                                  }`}
                                >
                                  <div className="flex items-center gap-2 min-w-0">
                                    <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200 font-mono text-[10px] font-bold shrink-0">
                                      {fl.initialCode || 'UNIT'}
                                    </span>
                                    <div className="min-w-0">
                                      <div className="font-mono font-bold text-xs flex items-center gap-1.5">
                                        <span>{fl.plateNumber}</span>
                                        <span className="text-[11px] font-sans font-normal text-slate-500">
                                          ({fl.vehicleType} · {fl.brand || '-'})
                                        </span>
                                      </div>
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-2 shrink-0">
                                    <span className="text-[11px] font-mono tabular-nums text-slate-500">
                                      {(fl.odometerKm || 45000).toLocaleString('id-ID')} KM
                                    </span>
                                    {isSelected && <Check className="w-4 h-4 text-blue-600" />}
                                  </div>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </>
                  );
                })()}
              </div>

              {/* Kategori & Tanggal Pemasangan */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="relative">
                  <label className="text-slate-700 block mb-1 font-semibold">Kategori Komponen</label>
                  {(() => {
                    const activeCatMeta =
                      CATEGORY_OPTIONS_META.find(c => c.value === usageForm.category) ||
                      CATEGORY_OPTIONS_META[0];
                    const ActiveCatIcon = activeCatMeta.icon;
                    return (
                      <>
                        <button
                          type="button"
                          onClick={() =>
                            setOpenDropdown(openDropdown === 'usage_category' ? null : 'usage_category')
                          }
                          className="w-full px-3 py-2 rounded-lg bg-white hover:bg-slate-50 border border-slate-200 text-left flex items-center justify-between gap-2 transition cursor-pointer"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <span className={`p-1 rounded border shrink-0 ${activeCatMeta.color}`}>
                              <ActiveCatIcon className="w-3.5 h-3.5" />
                            </span>
                            <span className="font-semibold text-slate-900 truncate">{activeCatMeta.label}</span>
                          </div>
                          <ChevronDown
                            className={`w-4 h-4 text-slate-400 shrink-0 transition-transform ${
                              openDropdown === 'usage_category' ? 'rotate-180 text-blue-600' : ''
                            }`}
                          />
                        </button>

                        {openDropdown === 'usage_category' && (
                          <div className="absolute z-50 left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden divide-y divide-slate-100">
                            {CATEGORY_OPTIONS_META.map(cat => {
                              const CatIcon = cat.icon;
                              const isSelected = cat.value === usageForm.category;
                              return (
                                <button
                                  key={cat.value}
                                  type="button"
                                  onClick={() => {
                                    handleCategoryChangeForUsage(cat.value);
                                    setOpenDropdown(null);
                                  }}
                                  className={`w-full px-3 py-2 text-left flex items-center justify-between gap-2 transition cursor-pointer ${
                                    isSelected ? 'bg-blue-50 text-blue-700' : 'hover:bg-slate-50 text-slate-800'
                                  }`}
                                >
                                  <div className="flex items-center gap-2 min-w-0">
                                    <span className={`p-1 rounded border shrink-0 ${cat.color}`}>
                                      <CatIcon className="w-3.5 h-3.5" />
                                    </span>
                                    <div className="min-w-0">
                                      <div className="font-semibold text-xs truncate">{cat.label}</div>
                                      <div className="text-[10px] text-slate-500 truncate">{cat.sub}</div>
                                    </div>
                                  </div>
                                  {isSelected && <Check className="w-4 h-4 text-blue-600 shrink-0" />}
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </>
                    );
                  })()}
                </div>

                <div>
                  <label className="text-slate-700 block mb-1 font-semibold flex items-center justify-between">
                    <span>Tanggal Pemasangan</span>
                    <span className="text-[10px] font-mono text-blue-600">
                      {formatIndoDateDisplay(usageForm.replacementDate)}
                    </span>
                  </label>
                  <input
                    type="date"
                    required
                    value={usageForm.replacementDate}
                    onChange={e => setUsageForm({ ...usageForm, replacementDate: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg bg-white border border-slate-200 focus:border-blue-600 focus:outline-none text-slate-900 font-mono cursor-pointer"
                  />
                </div>
              </div>

              {usageForm.category === 'ban' && (
                <div>
                  <label className="text-slate-700 block mb-1 font-semibold">Posisi Ban Armada</label>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      'Ban Armada Depan Kanan',
                      'Ban Armada Depan Kiri',
                      'Ban Armada Belakang Kanan',
                      'Ban Armada Belakang Kiri'
                    ].map(pos => {
                      const isSelected = usageForm.notes.toLowerCase().includes(pos.toLowerCase());
                      return (
                        <button
                          key={pos}
                          type="button"
                          onClick={() => {
                            const f = allFleets.find(fl => fl.id === usageForm.fleetId);
                            setUsageForm({
                              ...usageForm,
                              notes: `Penggantian rutin ${pos} untuk armada ${
                                f?.initialCode || f?.plateNumber || ''
                              }`
                            });
                          }}
                          className={`px-2.5 py-1.5 rounded-lg text-[11px] font-semibold border text-left transition cursor-pointer ${
                            isSelected
                              ? 'bg-blue-50 border-blue-200 text-blue-700'
                              : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                          }`}
                        >
                          {pos}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Pilih Sparepart dari Gudang */}
              <div className="relative">
                <label className="text-slate-700 block mb-1 font-semibold flex items-center justify-between">
                  <span>Pilih Sparepart dari Gudang</span>
                  <span className="text-[11px] text-slate-500">Stok otomatis berkurang</span>
                </label>
                {(() => {
                  const categoryParts = spareParts.filter(p => p.category === usageForm.category);
                  const selectedPartObj = spareParts.find(p => p.id === usageForm.partId);

                  return (
                    <>
                      <button
                        type="button"
                        onClick={() => setOpenDropdown(openDropdown === 'usage_part' ? null : 'usage_part')}
                        className="w-full px-3.5 py-2.5 rounded-lg bg-white hover:bg-slate-50 border border-slate-200 text-left flex items-center justify-between gap-2 transition cursor-pointer"
                      >
                        {selectedPartObj ? (
                          <div className="flex items-center justify-between w-full pr-2 gap-2 min-w-0">
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200 font-mono text-[10px] font-bold shrink-0">
                                {selectedPartObj.partNumber}
                              </span>
                              <span className="font-semibold text-slate-900 truncate">
                                {selectedPartObj.name}
                              </span>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <span className="text-[11px] font-mono tabular-nums font-semibold text-emerald-700">
                                Stok: {selectedPartObj.stock} {selectedPartObj.unit}
                              </span>
                              <span className="text-[11px] font-mono tabular-nums font-bold text-slate-900">
                                Rp {selectedPartObj.costPerUnit.toLocaleString('id-ID')}
                              </span>
                            </div>
                          </div>
                        ) : (
                          <span className="text-slate-400">Pilih Barang Master Part</span>
                        )}
                        <ChevronDown
                          className={`w-4 h-4 text-slate-400 shrink-0 transition-transform ${
                            openDropdown === 'usage_part' ? 'rotate-180 text-blue-600' : ''
                          }`}
                        />
                      </button>

                      {openDropdown === 'usage_part' && (
                        <div className="absolute z-50 left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden max-h-56 overflow-y-auto divide-y divide-slate-100">
                          {categoryParts.length === 0 ? (
                            <div className="p-3 text-center text-slate-500 text-xs">
                              Belum ada master sparepart untuk kategori ini.
                            </div>
                          ) : (
                            categoryParts.map(p => {
                              const isSelected = p.id === usageForm.partId;
                              const isOut = p.stock <= 0;
                              return (
                                <button
                                  key={p.id}
                                  type="button"
                                  disabled={isOut}
                                  onClick={() => {
                                    setUsageForm({
                                      ...usageForm,
                                      partId: p.id,
                                      totalCost: p.costPerUnit * usageForm.quantity
                                    });
                                    setOpenDropdown(null);
                                  }}
                                  className={`w-full px-3.5 py-2.5 text-left flex items-center justify-between gap-2 transition ${
                                    isOut
                                      ? 'opacity-45 cursor-not-allowed bg-slate-50'
                                      : isSelected
                                      ? 'bg-blue-50 text-blue-700 cursor-pointer'
                                      : 'hover:bg-slate-50 text-slate-800 cursor-pointer'
                                  }`}
                                >
                                  <div className="min-w-0">
                                    <div className="flex items-center gap-2">
                                      <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200 font-mono text-[10px] font-bold">
                                        {p.partNumber}
                                      </span>
                                      <span className="font-semibold text-xs truncate">{p.name}</span>
                                    </div>
                                    <div className="text-[11px] text-slate-500 mt-0.5">
                                      Kompatibel: {p.compatibleVehicles} · Lokasi: {p.storageLocation}
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-2 shrink-0">
                                    <div className="text-right">
                                      <div
                                        className={`text-[11px] font-mono tabular-nums font-bold ${
                                          p.stock <= p.minStock ? 'text-red-600' : 'text-emerald-600'
                                        }`}
                                      >
                                        Sisa: {p.stock} {p.unit}
                                      </div>
                                      <div className="text-[11px] font-mono tabular-nums font-bold text-slate-900">
                                        Rp {p.costPerUnit.toLocaleString('id-ID')}
                                      </div>
                                    </div>
                                    {isSelected && <Check className="w-4 h-4 text-blue-600" />}
                                  </div>
                                </button>
                              );
                            })
                          )}
                        </div>
                      )}
                    </>
                  );
                })()}
              </div>

              {/* Jumlah & Total Biaya */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-700 block mb-1 font-semibold">Jumlah (Qty)</label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={usageForm.quantity}
                    onChange={e => {
                      const qty = Number(e.target.value);
                      const selected = spareParts.find(p => p.id === usageForm.partId);
                      setUsageForm({
                        ...usageForm,
                        quantity: qty,
                        totalCost: selected ? selected.costPerUnit * qty : usageForm.totalCost
                      });
                    }}
                    className="w-full px-3 py-2 rounded-lg bg-white border border-slate-200 focus:border-blue-600 focus:outline-none text-slate-900 font-mono font-bold"
                  />
                </div>

                <div>
                  <label className="text-slate-700 block mb-1 font-semibold">Total Biaya (Rp)</label>
                  <input
                    type="number"
                    required
                    value={usageForm.totalCost}
                    onChange={e => setUsageForm({ ...usageForm, totalCost: Number(e.target.value) })}
                    className="w-full px-3 py-2 rounded-lg bg-white border border-slate-200 focus:border-blue-600 focus:outline-none text-slate-900 font-mono font-bold"
                  />
                </div>
              </div>

              {/* Odometer & Target KM */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-700 block mb-1 font-semibold">KM Odometer Saat Ini</label>
                  <input
                    type="number"
                    required
                    value={usageForm.odometerKm}
                    onChange={e => setUsageForm({ ...usageForm, odometerKm: Number(e.target.value) })}
                    className="w-full px-3 py-2 rounded-lg bg-white border border-slate-200 focus:border-blue-600 focus:outline-none text-slate-900 font-mono"
                  />
                </div>

                <div>
                  <label className="text-slate-700 block mb-1 font-semibold flex items-center justify-between">
                    <span>Target KM Berikut</span>
                    <span className="text-[10px] text-slate-500">+10k / +50k KM</span>
                  </label>
                  <input
                    type="number"
                    value={usageForm.nextReplacementKm}
                    onChange={e => setUsageForm({ ...usageForm, nextReplacementKm: Number(e.target.value) })}
                    className="w-full px-3 py-2 rounded-lg bg-white border border-slate-200 focus:border-blue-600 focus:outline-none text-slate-900 font-mono"
                  />
                </div>
              </div>

              {/* Teknisi & Tanggal Berikut */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-700 block mb-1 font-semibold">Teknisi / Bengkel</label>
                  <input
                    type="text"
                    required
                    placeholder="Mekanik Internal / Bengkel Hino"
                    value={usageForm.mechanicOrWorkshop}
                    onChange={e => setUsageForm({ ...usageForm, mechanicOrWorkshop: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg bg-white border border-slate-200 focus:border-blue-600 focus:outline-none text-slate-900"
                  />
                </div>

                <div>
                  <label className="text-slate-700 block mb-1 font-semibold flex items-center justify-between">
                    <span>Estimasi Tanggal Berikut</span>
                    <span className="text-[10px] font-mono text-blue-600">
                      {formatIndoDateDisplay(usageForm.nextReplacementDate)}
                    </span>
                  </label>
                  <input
                    type="date"
                    value={usageForm.nextReplacementDate}
                    onChange={e => setUsageForm({ ...usageForm, nextReplacementDate: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg bg-white border border-slate-200 focus:border-blue-600 focus:outline-none text-slate-900 font-mono cursor-pointer"
                  />
                </div>
              </div>

              <div>
                <label className="text-slate-700 block mb-1 font-semibold">
                  Catatan Pemeriksaan / Kondisi Komponen Lama
                </label>
                <textarea
                  rows={2}
                  value={usageForm.notes}
                  onChange={e => setUsageForm({ ...usageForm, notes: e.target.value })}
                  placeholder="Kondisi komponen lama, alasan ganti, atau keluhan supir..."
                  className="w-full px-3 py-2 rounded-lg bg-white border border-slate-200 focus:border-blue-600 focus:outline-none text-slate-900"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => {
                    setIsLogUsageOpen(false);
                    setOpenDropdown(null);
                  }}
                  className="px-4 py-2 rounded-lg bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 font-semibold cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold flex items-center gap-1.5 cursor-pointer"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50">
          <div className="bg-white border border-slate-200 rounded-xl w-full max-w-lg p-5 sm:p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div className="flex items-center gap-2">
                <Package className="w-5 h-5 text-blue-600" />
                <h3 className="text-base font-bold text-slate-900">Tambah Master Sparepart Baru</h3>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsAddPartOpen(false);
                  setOpenDropdown(null);
                }}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreatePart} className="space-y-3.5 text-xs">
              <div>
                <label className="text-slate-700 block mb-1 font-semibold">Nama Sparepart / Komponen</label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: Oli Mesin Meditran SX 15W-40 4L"
                  value={newPart.name}
                  onChange={e => setNewPart({ ...newPart, name: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg bg-white border border-slate-200 focus:border-blue-600 focus:outline-none text-slate-900"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="relative">
                  <label className="text-slate-700 block mb-1 font-semibold">Kategori</label>
                  {(() => {
                    const activeCatMeta =
                      CATEGORY_OPTIONS_META.find(c => c.value === newPart.category) ||
                      CATEGORY_OPTIONS_META[0];
                    const ActiveCatIcon = activeCatMeta.icon;
                    return (
                      <>
                        <button
                          type="button"
                          onClick={() =>
                            setOpenDropdown(openDropdown === 'new_category' ? null : 'new_category')
                          }
                          className="w-full px-3 py-2 rounded-lg bg-white hover:bg-slate-50 border border-slate-200 text-left flex items-center justify-between gap-2 transition cursor-pointer"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <span className={`p-1 rounded border shrink-0 ${activeCatMeta.color}`}>
                              <ActiveCatIcon className="w-3.5 h-3.5" />
                            </span>
                            <span className="font-semibold text-slate-900 truncate">{activeCatMeta.label}</span>
                          </div>
                          <ChevronDown
                            className={`w-4 h-4 text-slate-400 shrink-0 transition-transform ${
                              openDropdown === 'new_category' ? 'rotate-180 text-blue-600' : ''
                            }`}
                          />
                        </button>

                        {openDropdown === 'new_category' && (
                          <div className="absolute z-50 left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden divide-y divide-slate-100">
                            {CATEGORY_OPTIONS_META.map(cat => {
                              const CatIcon = cat.icon;
                              const isSelected = cat.value === newPart.category;
                              return (
                                <button
                                  key={cat.value}
                                  type="button"
                                  onClick={() => {
                                    setNewPart({ ...newPart, category: cat.value });
                                    setOpenDropdown(null);
                                  }}
                                  className={`w-full px-3 py-2 text-left flex items-center justify-between gap-2 transition cursor-pointer ${
                                    isSelected ? 'bg-blue-50 text-blue-700' : 'hover:bg-slate-50 text-slate-800'
                                  }`}
                                >
                                  <div className="flex items-center gap-2 min-w-0">
                                    <span className={`p-1 rounded border shrink-0 ${cat.color}`}>
                                      <CatIcon className="w-3.5 h-3.5" />
                                    </span>
                                    <span className="font-semibold text-xs truncate">{cat.label}</span>
                                  </div>
                                  {isSelected && <Check className="w-4 h-4 text-blue-600 shrink-0" />}
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </>
                    );
                  })()}
                </div>

                <div>
                  <label className="text-slate-700 block mb-1 font-semibold">Kode / Part Number</label>
                  <input
                    type="text"
                    required
                    placeholder="Contoh: MED-SX-4L"
                    value={newPart.partNumber}
                    onChange={e => setNewPart({ ...newPart, partNumber: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg bg-white border border-slate-200 focus:border-blue-600 focus:outline-none text-slate-900 font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-slate-700 block mb-1 font-semibold">Satuan</label>
                  <input
                    type="text"
                    required
                    placeholder="Liter / Pcs / Set"
                    value={newPart.unit}
                    onChange={e => setNewPart({ ...newPart, unit: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg bg-white border border-slate-200 focus:border-blue-600 focus:outline-none text-slate-900"
                  />
                </div>

                <div>
                  <label className="text-slate-700 block mb-1 font-semibold">Stok Awal</label>
                  <input
                    type="number"
                    min="0"
                    required
                    value={newPart.stock}
                    onChange={e => setNewPart({ ...newPart, stock: Number(e.target.value) })}
                    className="w-full px-3 py-2 rounded-lg bg-white border border-slate-200 focus:border-blue-600 focus:outline-none text-slate-900 font-mono"
                  />
                </div>

                <div>
                  <label className="text-slate-700 block mb-1 font-semibold">Min. Stok</label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={newPart.minStock}
                    onChange={e => setNewPart({ ...newPart, minStock: Number(e.target.value) })}
                    className="w-full px-3 py-2 rounded-lg bg-white border border-slate-200 focus:border-blue-600 focus:outline-none text-red-600 font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-700 block mb-1 font-semibold">Harga Satuan (Rp)</label>
                  <input
                    type="number"
                    min="0"
                    required
                    value={newPart.costPerUnit}
                    onChange={e => setNewPart({ ...newPart, costPerUnit: Number(e.target.value) })}
                    className="w-full px-3 py-2 rounded-lg bg-white border border-slate-200 focus:border-blue-600 focus:outline-none text-slate-900 font-mono font-bold"
                  />
                </div>

                <div>
                  <label className="text-slate-700 block mb-1 font-semibold">Lokasi Rak Gudang</label>
                  <input
                    type="text"
                    required
                    placeholder="Rak A-01 / Rak Ban B-02"
                    value={newPart.storageLocation}
                    onChange={e => setNewPart({ ...newPart, storageLocation: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg bg-white border border-slate-200 focus:border-blue-600 focus:outline-none text-slate-900"
                  />
                </div>
              </div>

              <div>
                <label className="text-slate-700 block mb-1 font-semibold">Armada Kompatibel</label>
                <input
                  type="text"
                  placeholder="Contoh: Pick Up L300, Traga, Canter CDD"
                  value={newPart.compatibleVehicles}
                  onChange={e => setNewPart({ ...newPart, compatibleVehicles: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg bg-white border border-slate-200 focus:border-blue-600 focus:outline-none text-slate-900"
                />
              </div>

              <div>
                <label className="text-slate-700 block mb-1 font-semibold">Catatan Spesifikasi</label>
                <textarea
                  rows={2}
                  value={newPart.notes}
                  onChange={e => setNewPart({ ...newPart, notes: e.target.value })}
                  placeholder="Standar kekentalan, garansi, interval ganti..."
                  className="w-full px-3 py-2 rounded-lg bg-white border border-slate-200 focus:border-blue-600 focus:outline-none text-slate-900"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => {
                    setIsAddPartOpen(false);
                    setOpenDropdown(null);
                  }}
                  className="px-4 py-2 rounded-lg bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 font-semibold cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold flex items-center gap-1.5 cursor-pointer"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50">
          <div className="bg-white border border-slate-200 rounded-xl w-full max-w-md p-5 sm:p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div className="flex items-center gap-2">
                <Plus className="w-5 h-5 text-blue-600" />
                <h3 className="text-base font-bold text-slate-900">Restock Sparepart Masuk</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsRestockOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleRestockSubmit} className="space-y-3.5 text-xs">
              <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 space-y-1">
                <div className="text-slate-900 font-bold">{selectedPartForRestock.name}</div>
                <div className="text-slate-500 text-[11px] font-mono">
                  Part No: {selectedPartForRestock.partNumber}
                </div>
                <div className="text-slate-600 text-[11px]">
                  Stok saat ini:{' '}
                  <strong className="text-slate-900">
                    {selectedPartForRestock.stock} {selectedPartForRestock.unit}
                  </strong>
                </div>
              </div>

              <div>
                <label className="text-slate-700 block mb-1 font-semibold">Jumlah Tambahan Stok Masuk</label>
                <input
                  type="number"
                  min="1"
                  required
                  value={restockAmount}
                  onChange={e => setRestockAmount(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-lg bg-white border border-slate-200 focus:border-blue-600 focus:outline-none text-slate-900 font-mono font-bold text-base"
                />
                <span className="text-[11px] text-slate-500 mt-1 block">
                  Total setelah restock:{' '}
                  <strong className="text-emerald-700">
                    {selectedPartForRestock.stock + Number(restockAmount)} {selectedPartForRestock.unit}
                  </strong>
                </span>
              </div>

              <div>
                <label className="text-slate-700 block mb-1 font-semibold">
                  Nomor PO / Catatan Penerimaan
                </label>
                <input
                  type="text"
                  placeholder="PO-2026-09-XX / Suplier Jaya Diesel"
                  value={restockNotes}
                  onChange={e => setRestockNotes(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-white border border-slate-200 focus:border-blue-600 focus:outline-none text-slate-900"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsRestockOpen(false)}
                  className="px-4 py-2 rounded-lg bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 font-semibold cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold flex items-center gap-1.5 cursor-pointer"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50">
          <div className="bg-white border border-slate-200 rounded-xl w-full max-w-lg p-5 sm:p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div className="flex items-center gap-2">
                <Edit3 className="w-5 h-5 text-blue-600" />
                <h3 className="text-base font-bold text-slate-900">Edit Master Sparepart</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsEditPartOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form
              onSubmit={e => {
                e.preventDefault();
                logisticsStore.updateSparePart(editingPart.id, editingPart);
                setIsEditPartOpen(false);
                setEditingPart(null);
              }}
              className="space-y-3.5 text-xs"
            >
              <div>
                <label className="text-slate-700 block mb-1 font-semibold">Nama Sparepart</label>
                <input
                  type="text"
                  required
                  value={editingPart.name}
                  onChange={e => setEditingPart({ ...editingPart, name: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg bg-white border border-slate-200 focus:border-blue-600 focus:outline-none text-slate-900"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-700 block mb-1 font-semibold">Kategori</label>
                  <select
                    value={editingPart.category}
                    onChange={e =>
                      setEditingPart({ ...editingPart, category: e.target.value as SparePartCategory })
                    }
                    className="w-full px-3 py-2 rounded-lg bg-white border border-slate-200 focus:border-blue-600 focus:outline-none text-slate-900 cursor-pointer"
                  >
                    <option value="oli">Oli Mesin &amp; Pelumas</option>
                    <option value="ban">Ban &amp; Velg</option>
                    <option value="aki">Aki &amp; Baterai</option>
                    <option value="filter">Filter</option>
                    <option value="rem">Pengereman</option>
                    <option value="lainnya">Lainnya</option>
                  </select>
                </div>

                <div>
                  <label className="text-slate-700 block mb-1 font-semibold">Kode / Part No</label>
                  <input
                    type="text"
                    required
                    value={editingPart.partNumber}
                    onChange={e => setEditingPart({ ...editingPart, partNumber: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg bg-white border border-slate-200 focus:border-blue-600 focus:outline-none text-slate-900 font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-slate-700 block mb-1 font-semibold">Satuan</label>
                  <input
                    type="text"
                    required
                    value={editingPart.unit}
                    onChange={e => setEditingPart({ ...editingPart, unit: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg bg-white border border-slate-200 focus:border-blue-600 focus:outline-none text-slate-900"
                  />
                </div>

                <div>
                  <label className="text-slate-700 block mb-1 font-semibold">Stok Saat Ini</label>
                  <input
                    type="number"
                    min="0"
                    required
                    value={editingPart.stock}
                    onChange={e => setEditingPart({ ...editingPart, stock: Number(e.target.value) })}
                    className="w-full px-3 py-2 rounded-lg bg-white border border-slate-200 focus:border-blue-600 focus:outline-none text-slate-900 font-mono"
                  />
                </div>

                <div>
                  <label className="text-slate-700 block mb-1 font-semibold">Batas Min Stok</label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={editingPart.minStock}
                    onChange={e => setEditingPart({ ...editingPart, minStock: Number(e.target.value) })}
                    className="w-full px-3 py-2 rounded-lg bg-white border border-slate-200 focus:border-blue-600 focus:outline-none text-slate-900 font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-700 block mb-1 font-semibold">Harga Satuan (Rp)</label>
                  <input
                    type="number"
                    min="0"
                    required
                    value={editingPart.costPerUnit}
                    onChange={e => setEditingPart({ ...editingPart, costPerUnit: Number(e.target.value) })}
                    className="w-full px-3 py-2 rounded-lg bg-white border border-slate-200 focus:border-blue-600 focus:outline-none text-slate-900 font-mono font-bold"
                  />
                </div>

                <div>
                  <label className="text-slate-700 block mb-1 font-semibold">Lokasi Rak</label>
                  <input
                    type="text"
                    required
                    value={editingPart.storageLocation}
                    onChange={e =>
                      setEditingPart({ ...editingPart, storageLocation: e.target.value })
                    }
                    className="w-full px-3 py-2 rounded-lg bg-white border border-slate-200 focus:border-blue-600 focus:outline-none text-slate-900"
                  />
                </div>
              </div>

              <div>
                <label className="text-slate-700 block mb-1 font-semibold">Armada Kompatibel</label>
                <input
                  type="text"
                  value={editingPart.compatibleVehicles}
                  onChange={e =>
                    setEditingPart({ ...editingPart, compatibleVehicles: e.target.value })
                  }
                  className="w-full px-3 py-2 rounded-lg bg-white border border-slate-200 focus:border-blue-600 focus:outline-none text-slate-900"
                />
              </div>

              <div>
                <label className="text-slate-700 block mb-1 font-semibold">Catatan</label>
                <textarea
                  rows={2}
                  value={editingPart.notes || ''}
                  onChange={e => setEditingPart({ ...editingPart, notes: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg bg-white border border-slate-200 focus:border-blue-600 focus:outline-none text-slate-900"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsEditPartOpen(false)}
                  className="px-4 py-2 rounded-lg bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 font-semibold cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold flex items-center gap-1.5 cursor-pointer"
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
