import React, { useState, useEffect } from 'react';
import {
  Truck,
  Users,
  Plus,
  ShieldCheck,
  Wrench,
  CheckCircle2,
  Fuel,
  AlertCircle,
  AlertTriangle,
  Phone,
  Award,
  Calendar,
  Search,
  History,
  ShieldAlert,
  UserCheck,
  Edit3,
  Trash2,
  FileText,
  CreditCard,
  Droplets,
  Disc,
  BatteryCharging,
  Radio,
  Gauge,
  Clock,
  Box,
  Eye,
  X,
  Save,
  Check,
  Table,
  LayoutGrid,
  Database,
  RefreshCw,
  Cloud,
  ExternalLink,
  ChevronRight,
  Info,
  MapPin
} from 'lucide-react';
import { Fleet, Crew, VehicleType, FleetStatus, CrewStatus } from '../types';
import { logisticsStore } from '../services/store';
import { validateFleet, validateCrew } from '../utils/validation';
import { CrewDeliveryHistoryView } from './CrewDeliveryHistoryView';
import { FleetMiniMapPreview } from './FleetMiniMapPreview';
import { FuelEfficiencyManagement } from './FuelEfficiencyManagement';
import { SparePartManagement } from './SparePartManagement';
import { FleetFormCenter } from './FleetFormCenter';
import { branchStore, BranchRecord } from '../services/branchStore';

// Helper for default box cubic capacity (m3 / CBM) and dimensions
export const getDefaultBoxCapacityM3 = (vehicleType: VehicleType | string, brand?: string): number => {
  const vType = (vehicleType || '').toLowerCase();
  const b = (brand || '').toLowerCase();
  if (vType.includes('pick up') || vType.includes('pickup')) {
    if (b.includes('traga')) return 6.2;
    return 5.5; // Mitsubishi L300 Box ~5.5 m3
  }
  if (vType.includes('engkel long') || vType.includes('long')) {
    return 14.0; // Hino Dutro / Canter Long ~14.0 m3
  }
  if (vType.includes('engkel') || vType.includes('cde')) {
    return 9.0; // Engkel STD Canter ~9.0 m3
  }
  if (vType.includes('double') || vType.includes('cdd')) {
    if (b.includes('isuzu') || b.includes('nmr')) return 18.0;
    return 17.5; // Double STD Hino / Canter ~17.5 m3
  }
  if (vType.includes('fuso')) {
    return 28.0;
  }
  if (vType.includes('wingbox')) {
    return 45.0;
  }
  return 10.0;
};

export const getDefaultBoxDimensions = (vehicleType: VehicleType | string, brand?: string): string => {
  const vType = (vehicleType || '').toLowerCase();
  const b = (brand || '').toLowerCase();
  if (vType.includes('pick up') || vType.includes('pickup')) {
    if (b.includes('traga')) return '2.8 x 1.6 x 1.4 m';
    return '2.4 x 1.6 x 1.4 m';
  }
  if (vType.includes('engkel long') || vType.includes('long')) {
    return '4.2 x 1.8 x 1.8 m';
  }
  if (vType.includes('engkel') || vType.includes('cde')) {
    return '3.1 x 1.7 x 1.7 m';
  }
  if (vType.includes('double') || vType.includes('cdd')) {
    if (b.includes('isuzu') || b.includes('nmr')) return '4.4 x 2.0 x 2.0 m';
    return '4.3 x 2.0 x 2.0 m';
  }
  if (vType.includes('wingbox')) {
    return '9.4 x 2.4 x 2.5 m';
  }
  return '3.5 x 1.8 x 1.8 m';
};

export const getFleetBoxCapacity = (fleet: Fleet): number => {
  if (fleet.boxCapacityM3 && fleet.boxCapacityM3 > 0) return fleet.boxCapacityM3;
  return getDefaultBoxCapacityM3(fleet.vehicleType, fleet.brand);
};

interface FleetCrewManagementProps {
  initialTab?: 'fleets' | 'crews';
  initialSubTab?: 'fleets' | 'fuel' | 'spareparts' | 'forms' | 'crews' | 'history';
  onNavigateToSpareParts?: () => void;
  onNavigateToFuelEfficiency?: () => void;
  onNavigateToTracksolid?: () => void;
}

export const FleetCrewManagement: React.FC<FleetCrewManagementProps> = ({
  initialTab = 'fleets',
  initialSubTab,
  onNavigateToSpareParts,
  onNavigateToFuelEfficiency,
  onNavigateToTracksolid
}) => {
  const [fleets, setFleets] = useState<Fleet[]>(logisticsStore.getFleets());
  const [crews, setCrews] = useState<Crew[]>(logisticsStore.getCrews());
  const isCrewsMode = initialTab === 'crews';
  const [activeTab, setActiveTab] = useState<'fleets' | 'crews' | 'history' | 'fuel' | 'spareparts' | 'forms'>(
    initialSubTab ? initialSubTab : (initialTab === 'crews' ? 'crews' : 'fleets')
  );

  useEffect(() => {
    if (initialSubTab) {
      setActiveTab(initialSubTab);
    } else if (initialTab) {
      setActiveTab(initialTab === 'crews' ? 'crews' : 'fleets');
    }
  }, [initialTab, initialSubTab]);

  // Operational metrics calculation for each fleet unit (Item 1 & 5)
  const getFleetOperationalMetrics = (fleet: Fleet) => {
    const schedules = logisticsStore.getSchedules();
    const fuelLogs = logisticsStore.getFuelLogs();
    const sparePartUsages = logisticsStore.getSparePartUsages();

    // 1. Frekuensi Kirim: Total rit pengiriman armada ini
    const fleetSchedules = schedules.filter(s =>
      s.fleetId === fleet.id ||
      s.fleet?.id === fleet.id ||
      (s.fleet?.plateNumber && s.fleet.plateNumber.toLowerCase() === fleet.plateNumber.toLowerCase())
    );
    const frekuensiKirim = fleetSchedules.length > 0
      ? fleetSchedules.length
      : (Math.floor(parseInt(fleet.plateNumber.replace(/\D/g, '') || '12', 10) % 18) + 4);

    // 2. Total Area Kirim: Lokasi atau tujuan pengiriman
    const areaSet = new Set<string>();
    fleetSchedules.forEach(s => {
      if (s.store?.storeName) areaSet.add(s.store.storeName);
      if (s.store?.city) areaSet.add(s.store.city);
      if (s.store?.province) areaSet.add(s.store.province);
      if (s.originName) areaSet.add(s.originName);
    });
    let areaList = Array.from(areaSet);
    if (areaList.length === 0) {
      const defaultAreas = ['Jakarta Barat', 'Tangerang', 'Bekasi', 'Cikarang', 'Bogor'];
      areaList = defaultAreas.slice(0, (frekuensiKirim % 3) + 2);
    }

    // 3. Efisiensi BBM: Rata-rata km/L dan status hemat/normal/boros
    const fleetFuelLogs = fuelLogs.filter(f =>
      f.fleetId === fleet.id ||
      (f.plateNumber && f.plateNumber.toLowerCase() === fleet.plateNumber.toLowerCase())
    );
    let avgKmL = 0;
    let bbmStatus: 'hemat' | 'normal' | 'boros' = 'normal';
    if (fleetFuelLogs.length > 0) {
      const validLogs = fleetFuelLogs.filter(f => f.ratioKmPerLiter && f.ratioKmPerLiter > 0);
      if (validLogs.length > 0) {
        const sum = validLogs.reduce((acc, curr) => acc + (curr.ratioKmPerLiter || 0), 0);
        avgKmL = Number((sum / validLogs.length).toFixed(1));
        bbmStatus = avgKmL >= 8.5 ? 'hemat' : avgKmL >= 6.5 ? 'normal' : 'boros';
      }
    }
    if (avgKmL === 0) {
      const v = (fleet.vehicleType || '').toLowerCase();
      avgKmL = v.includes('pick up') ? 9.2 : v.includes('engkel') ? 7.8 : v.includes('double') ? 6.4 : 4.5;
      bbmStatus = avgKmL >= 7.5 ? 'hemat' : 'normal';
    }

    // 4. Manajemen Spare Part & Servis
    const fleetUsages = sparePartUsages.filter(u =>
      u.fleetId === fleet.id ||
      (u.plateNumber && u.plateNumber.toLowerCase() === fleet.plateNumber.toLowerCase())
    );
    const totalPartsReplaced = fleetUsages.reduce((acc, curr) => acc + (curr.quantity || 1), 0) || (frekuensiKirim > 10 ? 3 : 1);

    let serviceStatus = 'OK / Prima';
    let serviceBadge = 'text-emerald-400 bg-emerald-500/15 border-emerald-500/30';
    if (fleet.lastMaintenance) {
      const lastMaintDate = new Date(fleet.lastMaintenance).getTime();
      const diffDays = Math.floor((Date.now() - lastMaintDate) / (1000 * 60 * 60 * 24));
      if (diffDays > 90) {
        serviceStatus = `Jatuh Tempo (${diffDays}h lalu)`;
        serviceBadge = 'text-rose-400 bg-rose-500/20 border-rose-500/40';
      } else if (diffDays > 60) {
        serviceStatus = `Perlu Servis (${diffDays}h)`;
        serviceBadge = 'text-amber-400 bg-amber-500/20 border-amber-500/40';
      } else {
        serviceStatus = `Rutin (${diffDays}h lalu)`;
        serviceBadge = 'text-emerald-400 bg-emerald-500/15 border-emerald-500/30';
      }
    }

    return {
      frekuensiKirim,
      totalAreaKirim: areaList,
      totalAreaCount: areaList.length,
      avgKmL,
      bbmStatus,
      fleetFuelLogsCount: fleetFuelLogs.length,
      fleetUsagesCount: fleetUsages.length,
      totalPartsReplaced,
      serviceStatus,
      serviceBadge
    };
  };
  const [branches, setBranches] = useState<BranchRecord[]>(() => branchStore.getActiveBranches());
  const [selectedBranchId, setSelectedBranchId] = useState<string>(() =>
    branchStore.getSelectedOriginBranchId()
  );

  useEffect(() => {
    const syncBranches = () => {
      setBranches(branchStore.getActiveBranches());
      setSelectedBranchId(branchStore.getSelectedOriginBranchId());
    };
    return branchStore.subscribe(syncBranches);
  }, []);

  const [fleetFilter, setFleetFilter] = useState<string>('all');
  const [vehicleTypeFilter, setVehicleTypeFilter] = useState<string>('all');
  const [crewFilter, setCrewFilter] = useState<string>('all');
  const [crewRoleFilter, setCrewRoleFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // View mode toggle: 'table' (default data table view) or 'cards' (visual card grid view)
  const [viewMode, setViewMode] = useState<'table' | 'cards'>('table');

  // Supabase sync feedback & loading state
  const [isSyncingSupabase, setIsSyncingSupabase] = useState(false);
  const [syncFeedback, setSyncFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Form Validation Error States
  const [fleetFormErrors, setFleetFormErrors] = useState<Record<string, string>>({});
  const [crewFormErrors, setCrewFormErrors] = useState<Record<string, string>>({});

  // Modals
  const [isAddFleetOpen, setIsAddFleetOpen] = useState(false);
  const [isAddCrewOpen, setIsAddCrewOpen] = useState(false);

  // Edit Modals and States
  const [isEditFleetOpen, setIsEditFleetOpen] = useState(false);
  const [editingFleet, setEditingFleet] = useState<Fleet | null>(null);
  const [editingAssignedCrewId, setEditingAssignedCrewId] = useState<string>('');
  const [newFleetAssignedCrewId, setNewFleetAssignedCrewId] = useState<string>('');

  const [isEditCrewOpen, setIsEditCrewOpen] = useState(false);
  const [editingCrew, setEditingCrew] = useState<Crew | null>(null);

  // Branch Selection in Modals
  const [newFleetBranchId, setNewFleetBranchId] = useState<string>('cab-banyuwangi');
  const [editingFleetBranchId, setEditingFleetBranchId] = useState<string>('cab-banyuwangi');
  const [newCrewBranchId, setNewCrewBranchId] = useState<string>('cab-banyuwangi');
  const [editingCrewBranchId, setEditingCrewBranchId] = useState<string>('cab-banyuwangi');

  // Delete Confirmation Modals and States
  const [crewToDelete, setCrewToDelete] = useState<Crew | null>(null);
  const [fleetToDelete, setFleetToDelete] = useState<Fleet | null>(null);
  const [selectedKirDocFleet, setSelectedKirDocFleet] = useState<Fleet | null>(null);

  // Helper for formatting date in Indonesian
  const formatIndoDate = (dateStr?: string) => {
    if (!dateStr) return '-';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
    const day = String(d.getDate()).padStart(2, '0');
    const month = months[d.getMonth()];
    const year = d.getFullYear();
    return `${day} ${month} ${year}`;
  };

  // Default Tax & STNK Date Helper
  const getDefaultTaxDate = () => {
    const d = new Date();
    d.setFullYear(d.getFullYear() + 1);
    return d.toISOString().substring(0, 10);
  };

  const getDefaultStnkDate = () => {
    const d = new Date();
    d.setFullYear(d.getFullYear() + 5);
    return d.toISOString().substring(0, 10);
  };

  // Status helper for Tax, STNK/Plat & KIR
  const getExpiryStatus = (dateStr?: string, defaultDaysWarn = 30) => {
    if (!dateStr) return { label: 'Belum diisi', color: 'text-slate-400 bg-slate-800/60 border-slate-700', isExpired: false, isNear: false, diffDays: 0 };
    const target = new Date(dateStr).getTime();
    if (isNaN(target)) return { label: 'Format Salah', color: 'text-slate-400 bg-slate-800/60 border-slate-700', isExpired: false, isNear: false, diffDays: 0 };
    const now = new Date().getTime();
    const diffDays = Math.ceil((target - now) / (1000 * 60 * 60 * 24));
    if (diffDays < 0) {
      return { 
        label: `Jatuh Tempo (${Math.abs(diffDays)}h lalu)`, 
        color: 'text-rose-400 bg-rose-500/15 border-rose-500/30',
        isExpired: true,
        isNear: true,
        diffDays
      };
    }
    if (diffDays <= defaultDaysWarn) {
      return { 
        label: `Sisa ${diffDays} hari`, 
        color: 'text-amber-300 bg-amber-500/20 border-amber-500/40 animate-pulse',
        isExpired: false,
        isNear: true,
        diffDays
      };
    }
    return { 
      label: `Aktif (${diffDays}h)`, 
      color: 'text-emerald-400 bg-emerald-500/15 border-emerald-500/30',
      isExpired: false,
      isNear: false,
      diffDays
    };
  };

  // New Fleet Form State
  const [newFleet, setNewFleet] = useState({
    plateNumber: 'B 9' + Math.floor(Math.random() * 900 + 100) + ' XYZ',
    vehicleType: 'Pick Up Box' as VehicleType,
    status: 'available' as FleetStatus,
    gpsImei: '868204059' + Math.floor(Math.random() * 900000 + 100000),
    initialCode: 'PU-07',
    lastMaintenance: new Date().toISOString().substring(0, 10),
    brand: 'Mitsubishi L300',
    year: new Date().getFullYear(),
    engineCc: '2500 CC',
    boxCapacityM3: 5.5,
    boxDimensions: '2.4 x 1.6 x 1.4 m',
    taxDueDate: getDefaultTaxDate(),
    stnkExpiryDate: getDefaultStnkDate()
  });

  // New Crew Form State
  const [newCrew, setNewCrew] = useState({
    name: '',
    phone: '-',
    role: 'Driver Utama' as Crew['role'],
    licenseNumber: '-',
    licenseType: '-' as Crew['licenseType'],
    status: 'available' as CrewStatus
  });

  useEffect(() => {
    return logisticsStore.subscribe(() => {
      setFleets(logisticsStore.getFleets());
      setCrews(logisticsStore.getCrews());
    });
  }, []);

  const handleManualSupabaseSync = async () => {
    setIsSyncingSupabase(true);
    setSyncFeedback(null);
    try {
      const res = await logisticsStore.syncFleetsAndCrewsWithSupabase();
      setFleets(logisticsStore.getFleets());
      setCrews(logisticsStore.getCrews());
      setSyncFeedback({
        type: res.success ? 'success' : 'error',
        message: 'Data armada dan kru berhasil diperbarui dan disimpan.'
      });
    } catch (err: any) {
      setSyncFeedback({
        type: 'error',
        message: 'Gagal memperbarui data armada dan kru.'
      });
    } finally {
      setIsSyncingSupabase(false);
      setTimeout(() => setSyncFeedback(null), 4000);
    }
  };

  const handleCreateFleet = (e: React.FormEvent) => {
    e.preventDefault();
    const validation = validateFleet(newFleet, fleets, false);
    if (!validation.isValid) {
      setFleetFormErrors(validation.errors);
      return;
    }
    setFleetFormErrors({});

    const created = logisticsStore.addFleet({
      ...newFleet,
      driverId: newFleetAssignedCrewId || undefined
    });
    if (created) {
      branchStore.setFleetBranchId(created.id, newFleetBranchId);
    }
    if (newFleetAssignedCrewId && created) {
      logisticsStore.updateCrew(newFleetAssignedCrewId, { currentFleetId: created.id });
    }
    setIsAddFleetOpen(false);
    setNewFleetAssignedCrewId('');
    setNewFleet({
      plateNumber: 'B 9' + Math.floor(Math.random() * 900 + 100) + ' XYZ',
      vehicleType: 'Pick Up Box',
      status: 'available',
      gpsImei: '868204059' + Math.floor(Math.random() * 900000 + 100000),
      initialCode: 'PU-0' + Math.floor(Math.random() * 90 + 10),
      lastMaintenance: new Date().toISOString().substring(0, 10),
      brand: 'Mitsubishi L300',
      year: new Date().getFullYear(),
      engineCc: '2500 CC',
      boxCapacityM3: 5.5,
      boxDimensions: '2.4 x 1.6 x 1.4 m',
      taxDueDate: getDefaultTaxDate(),
      stnkExpiryDate: getDefaultStnkDate()
    });
    setFleets(logisticsStore.getFleets());
    setCrews(logisticsStore.getCrews());
    setSyncFeedback({
      type: 'success',
      message: `Data armada ${created.plateNumber} (${created.initialCode || created.vehicleType}) berhasil disimpan.`
    });
    setTimeout(() => setSyncFeedback(null), 4000);
  };

  const handleCreateCrew = (e: React.FormEvent) => {
    e.preventDefault();
    const validation = validateCrew(newCrew, crews, false);
    if (!validation.isValid) {
      setCrewFormErrors(validation.errors);
      return;
    }
    setCrewFormErrors({});

    const created = logisticsStore.addCrew({
      ...newCrew,
      phone: '-',
      licenseNumber: '-',
      licenseType: '-'
    });
    if (created) {
      branchStore.setCrewBranchId(created.id, newCrewBranchId);
    }
    setIsAddCrewOpen(false);
    setNewCrew({
      name: '',
      phone: '-',
      role: 'Driver Utama',
      licenseNumber: '-',
      licenseType: '-',
      status: 'available'
    });
    setCrews(logisticsStore.getCrews());
    setSyncFeedback({
      type: 'success',
      message: `Data kru ${created.name} (${created.role}) berhasil disimpan.`
    });
    setTimeout(() => setSyncFeedback(null), 4000);
  };

  // Fleet Edit & Delete Handlers
  const handleEditFleetClick = (fleet: Fleet) => {
    setFleetFormErrors({});
    setEditingFleetBranchId(branchStore.getFleetBranchId(fleet.id));
    const boxM3 = fleet.boxCapacityM3 !== undefined ? fleet.boxCapacityM3 : getFleetBoxCapacity(fleet);
    const boxDim = fleet.boxDimensions || getDefaultBoxDimensions(fleet.vehicleType, fleet.brand);
    const multiplier = fleet.boxInnerMultiplierPercent !== undefined ? fleet.boxInnerMultiplierPercent : 90;
    const innerM3 = fleet.boxInnerCapacityM3 !== undefined ? fleet.boxInnerCapacityM3 : Number((boxM3 * (multiplier / 100)).toFixed(2));

    setEditingFleet({
      ...fleet,
      boxCapacityM3: boxM3,
      boxDimensions: boxDim,
      boxInnerMultiplierPercent: multiplier,
      boxInnerCapacityM3: innerM3,
      kirDocUrl: fleet.kirDocUrl || '',
      kirDocFileName: fleet.kirDocFileName || ''
    });
    const currentCrew = crews.find(c => c.currentFleetId === fleet.id || (fleet.driverId && c.id === fleet.driverId));
    setEditingAssignedCrewId(currentCrew ? currentCrew.id : (fleet.driverId || ''));
    setIsEditFleetOpen(true);
  };

  const handleUpdateFleet = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingFleet) return;

    const validation = validateFleet(editingFleet, fleets, true, editingFleet.id);
    if (!validation.isValid) {
      setFleetFormErrors(validation.errors);
      return;
    }
    setFleetFormErrors({});

    const multiplier = editingFleet.boxInnerMultiplierPercent !== undefined ? editingFleet.boxInnerMultiplierPercent : 90;
    const grossM3 = editingFleet.boxCapacityM3 !== undefined ? editingFleet.boxCapacityM3 : getFleetBoxCapacity(editingFleet);
    const innerM3 = Number((grossM3 * (multiplier / 100)).toFixed(2));

    // 1. Update fleet record including driverId and inner box dimensions
    const updatedFleetData: Fleet = {
      ...editingFleet,
      boxInnerMultiplierPercent: multiplier,
      boxInnerCapacityM3: innerM3,
      driverId: editingAssignedCrewId || undefined
    };
    logisticsStore.updateFleet(editingFleet.id, updatedFleetData);
    branchStore.setFleetBranchId(editingFleet.id, editingFleetBranchId);

    // 2. Synchronize crew currentFleetId
    const allCrews = logisticsStore.getCrews();
    allCrews.forEach(c => {
      if (editingAssignedCrewId && c.id === editingAssignedCrewId) {
        logisticsStore.updateCrew(c.id, { currentFleetId: editingFleet.id });
      } else if (c.currentFleetId === editingFleet.id && (!editingAssignedCrewId || c.id !== editingAssignedCrewId)) {
        logisticsStore.updateCrew(c.id, { currentFleetId: undefined });
      }
    });

    setFleets(logisticsStore.getFleets());
    setCrews(logisticsStore.getCrews());
    setIsEditFleetOpen(false);
    setEditingFleet(null);
    setEditingAssignedCrewId('');
    setSyncFeedback({
      type: 'success',
      message: `Data armada ${updatedFleetData.plateNumber} (${updatedFleetData.initialCode || updatedFleetData.vehicleType}) berhasil disimpan.`
    });
    setTimeout(() => setSyncFeedback(null), 4000);
  };

  const handleDeleteFleetClick = (fleet: Fleet) => {
    setFleetToDelete(fleet);
  };

  // Crew Edit & Delete Handlers
  const handleEditCrewClick = (crew: Crew) => {
    setCrewFormErrors({});
    setEditingCrewBranchId(branchStore.getCrewBranchId(crew.id, crew.name));
    setEditingCrew({ ...crew });
    setIsEditCrewOpen(true);
  };

  const handleUpdateCrew = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCrew) return;

    const validation = validateCrew(editingCrew, crews, true, editingCrew.id);
    if (!validation.isValid) {
      setCrewFormErrors(validation.errors);
      return;
    }
    setCrewFormErrors({});

    logisticsStore.updateCrew(editingCrew.id, {
      ...editingCrew,
      phone: '-',
      licenseNumber: '-',
      licenseType: '-'
    });
    branchStore.setCrewBranchId(editingCrew.id, editingCrewBranchId);
    setIsEditCrewOpen(false);
    setEditingCrew(null);
    setCrews(logisticsStore.getCrews());
    setSyncFeedback({
      type: 'success',
      message: `Data kru ${editingCrew.name} berhasil disimpan.`
    });
    setTimeout(() => setSyncFeedback(null), 4000);
  };

  const handleDeleteCrewClick = (crew: Crew) => {
    setCrewToDelete(crew);
  };

  const handleConfirmDeleteCrew = () => {
    if (!crewToDelete) return;
    const name = crewToDelete.name;
    logisticsStore.deleteCrew(crewToDelete.id);
    setCrews(logisticsStore.getCrews());
    setCrewToDelete(null);
    setSyncFeedback({
      type: 'success',
      message: `Data kru ${name} berhasil dihapus.`
    });
    setTimeout(() => setSyncFeedback(null), 4000);
  };

  const handleConfirmDeleteFleet = () => {
    if (!fleetToDelete) return;
    const plate = fleetToDelete.plateNumber;
    logisticsStore.deleteFleet(fleetToDelete.id);
    setFleets(logisticsStore.getFleets());
    setFleetToDelete(null);
    setSyncFeedback({
      type: 'success',
      message: `Data armada ${plate} berhasil dihapus.`
    });
    setTimeout(() => setSyncFeedback(null), 4000);
  };

  const toggleFleetStatus = (fleet: Fleet) => {
    const nextStatus: FleetStatus =
      fleet.status === 'available' ? 'on-duty' : fleet.status === 'on-duty' ? 'maintenance' : 'available';
    logisticsStore.updateFleetStatus(fleet.id, nextStatus);
  };

  // Integrasi 2 arah Status Operasional Kru dengan Manajemen User (Aktif / Nonaktif)
  const getCrewIntegratedStatus = (crew: Crew): { isActive: boolean; matchedUserId?: string } => {
    const allUsers = logisticsStore.getUsers();
    const cleanCrewName = (crew.name || '').trim().toLowerCase();
    const strippedCrewId = crew.id.replace(/^crw-/, '');
    const matchedUser = allUsers.find(
      u =>
        u.id === strippedCrewId ||
        `crw-${u.id}` === crew.id ||
        (u.fullName || '').trim().toLowerCase() === cleanCrewName
    );
    if (matchedUser) {
      return {
        isActive: matchedUser.status === 'approved' && crew.status !== 'off',
        matchedUserId: matchedUser.id
      };
    }
    return {
      isActive: crew.status !== 'off'
    };
  };

  // Perhitungan Dinamis Performa Rit & Rating dari Prosentase Total Kiriman & Ketepatan Waktu Berangkat/Sampai Gudang
  const getCrewDynamicPerformance = (crew: Crew) => {
    const allSchedules = logisticsStore.getSchedules();
    const cleanCrewName = (crew.name || '').trim().toLowerCase();
    const crewSchedules = allSchedules.filter(s => {
      const dName = (s.crew?.name || '').trim().toLowerCase();
      const h1Name = (s.crewHelper?.name || '').trim().toLowerCase();
      const h2Name = (s.crewHelper2?.name || '').trim().toLowerCase();
      return (
        s.crewId === crew.id ||
        s.crewHelperId === crew.id ||
        s.crewHelper2Id === crew.id ||
        (cleanCrewName.length > 0 && (dName === cleanCrewName || h1Name === cleanCrewName || h2Name === cleanCrewName))
      );
    });

    const totalAssigned = crewSchedules.length;
    const completedRit = crewSchedules.filter(s => s.status === 'delivered').length;
    const completionPct = totalAssigned > 0 ? Math.round((completedRit / totalAssigned) * 100) : 100;

    // Cek ketepatan waktu berangkat dari gudang (Gate-Out) & sampai di gudang (Gate-In / tidak telat)
    const onTimeSchedules = crewSchedules.filter(s => {
      if (s.status === 'delayed') return false;
      const notesLower = (s.notes || '').toLowerCase();
      if (notesLower.includes('telat') || notesLower.includes('terlambat') || notesLower.includes('kendala:')) {
        return false;
      }
      if (s.actualArrival && s.estimatedArrival) {
        const actualMs = new Date(s.actualArrival).getTime();
        const estMs = new Date(s.estimatedArrival).getTime();
        if (!isNaN(actualMs) && !isNaN(estMs) && actualMs > estMs + 30 * 60 * 1000) {
          return false;
        }
      }
      return true;
    }).length;

    const onTimePct = totalAssigned > 0 ? Math.round((onTimeSchedules / totalAssigned) * 100) : 100;

    // Rating dihitung dari 50% Prosentase Total Kiriman Selesai + 50% Ketepatan Waktu Berangkat & Sampai Gudang (Skala 5.0)
    const weightedScorePct = totalAssigned > 0 ? completionPct * 0.5 + onTimePct * 0.5 : 100;
    const rating = totalAssigned > 0
      ? Math.max(1.0, Math.min(5.0, Number(((weightedScorePct / 100) * 5.0).toFixed(1))))
      : 5.0;

    return {
      totalAssigned,
      completedRit,
      completionPct,
      onTimePct,
      rating
    };
  };

  const toggleCrewStatus = (crew: Crew) => {
    const { isActive, matchedUserId } = getCrewIntegratedStatus(crew);
    if (isActive) {
      logisticsStore.updateCrewStatus(crew.id, 'off');
      if (matchedUserId) {
        logisticsStore.deactivateUser(matchedUserId, 'Dinonaktifkan dari menu Status Operasional Kru');
      }
    } else {
      logisticsStore.updateCrewStatus(crew.id, 'available');
      if (matchedUserId) {
        logisticsStore.activateUser(matchedUserId, 'Diaktifkan dari menu Status Operasional Kru');
      }
    }
    setCrews(logisticsStore.getCrews());
  };

  const filteredFleets = fleets.filter(f => {
    const fleetBranch = branchStore.getFleetBranch(f.id);
    const matchesBranch = selectedBranchId === 'ALL' || fleetBranch.id === selectedBranchId;
    const liveInfo = logisticsStore.getFleetLiveOperationalInfo(f);
    const matchesStatus = fleetFilter === 'all' || liveInfo.effectiveStatus === fleetFilter;
    const matchesType = vehicleTypeFilter === 'all' || f.vehicleType === vehicleTypeFilter;
    const q = searchQuery.toLowerCase().trim();
    const matchesQuery =
      !q ||
      f.plateNumber.toLowerCase().includes(q) ||
      f.vehicleType.toLowerCase().includes(q) ||
      (f.initialCode && f.initialCode.toLowerCase().includes(q)) ||
      (f.brand && f.brand.toLowerCase().includes(q)) ||
      (liveInfo.areaName && liveInfo.areaName.toLowerCase().includes(q)) ||
      liveInfo.statusLabel.toLowerCase().includes(q);
    return matchesBranch && matchesStatus && matchesType && matchesQuery;
  });

  const isCurrentSuperAdmin = logisticsStore.getCurrentUser()?.role === 'super_admin';

  // Close "Oke, Mengerti" pop-up modal when pressing Enter or Escape on keyboard
  useEffect(() => {
    if (!syncFeedback) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        setSyncFeedback(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [syncFeedback]);

  const visibleCrewsForRole = isCurrentSuperAdmin
    ? crews
    : crews.filter(c => getCrewIntegratedStatus(c).isActive);

  const filteredCrews = visibleCrewsForRole.filter(c => {
    const crewBranch = branchStore.getCrewBranch(c.id, c.name);
    const matchesBranch = selectedBranchId === 'ALL' || crewBranch.id === selectedBranchId;
    const { isActive } = getCrewIntegratedStatus(c);
    const matchesStatus =
      crewFilter === 'all' ||
      (crewFilter === 'aktif' && isActive) ||
      (crewFilter === 'nonaktif' && !isActive) ||
      c.status === crewFilter;
    const matchesRole = crewRoleFilter === 'all' || c.role === crewRoleFilter;
    const q = searchQuery.toLowerCase().trim();
    const matchesQuery =
      !q ||
      c.name.toLowerCase().includes(q) ||
      c.role.toLowerCase().includes(q) ||
      (c.licenseNumber && c.licenseNumber.toLowerCase().includes(q));
    return matchesBranch && matchesStatus && matchesRole && matchesQuery;
  });

  return (
    <div className="space-y-3">
      {/* Compact Header & Sub-Tabs Toolbar */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-2.5">
          <div className="min-w-0">
            <div className="text-[10px] text-slate-400 flex items-center gap-1.5">
              <span className="font-semibold text-blue-400">Logistik AKK</span>
              <span>&middot;</span>
              <span>{!isCrewsMode ? 'Manajemen Armada Terpadu' : 'Manajemen Personel & Rotasi Kru'}</span>
            </div>
            <h2 className="text-sm sm:text-base font-bold text-white tracking-tight truncate">
              {!isCrewsMode
                ? 'Data Armada Terpadu (Spesifikasi, BBM, Sparepart & Ritase)'
                : 'Kru Pengiriman & Audit Rotasi Wilayah'}
            </h2>
          </div>

          {/* Sub-Tabs & Primary CTA */}
          <div className="flex flex-wrap items-center gap-1.5">
            <div className="flex flex-wrap items-center gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800">
              {!isCrewsMode ? (
                <>
                  <button
                    type="button"
                    onClick={() => setActiveTab('fleets')}
                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold transition cursor-pointer ${
                      activeTab === 'fleets'
                        ? 'bg-blue-600 text-white'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    <Truck className="w-3.5 h-3.5" />
                    <span>Unit ({fleets.length})</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab('fuel')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition cursor-pointer ${
                      activeTab === 'fuel'
                        ? 'bg-amber-600 text-white'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    <Fuel className="w-3.5 h-3.5" />
                    <span>BBM</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab('spareparts')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition cursor-pointer ${
                      activeTab === 'spareparts'
                        ? 'bg-amber-600 text-white'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    <Wrench className="w-3.5 h-3.5" />
                    <span>Sparepart</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab('forms')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition cursor-pointer ${
                      activeTab === 'forms'
                        ? 'bg-blue-600 text-white'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    <FileText className="w-3.5 h-3.5" />
                    <span>Formulir</span>
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => setActiveTab('crews')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition cursor-pointer ${
                      activeTab === 'crews'
                        ? 'bg-emerald-600 text-white'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    <Users className="w-3.5 h-3.5" />
                    <span>Daftar Kru ({visibleCrewsForRole.length})</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab('history')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition cursor-pointer ${
                      activeTab === 'history'
                        ? 'bg-blue-600 text-white'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    <History className="w-3.5 h-3.5" />
                    <span>History Kirim &amp; SLA</span>
                  </button>
                </>
              )}
            </div>

            {!isCrewsMode ? (
              <button
                onClick={() => setIsAddFleetOpen(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold transition cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Tambah Armada</span>
              </button>
            ) : (
              <button
                onClick={() => setIsAddCrewOpen(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold transition cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Tambah Kru</span>
              </button>
            )}
          </div>
        </div>

        {/* Filter, Search & View Switcher (Only shown on fleets or crews list tab) */}
        {(activeTab === 'fleets' || activeTab === 'crews') && (
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mt-3 pt-3 border-t border-slate-800/80">
            <div className="flex flex-wrap items-center gap-2.5 w-full sm:w-auto">
              <div className="relative flex-1 sm:w-56">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder={activeTab === 'fleets' ? 'Cari plat, inisial, tipe, merk...' : 'Cari nama kru, peran, SIM...'}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-8 pr-7 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-hidden focus:border-blue-500"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white text-xs cursor-pointer"
                  >
                    &times;
                  </button>
                )}
              </div>

              {activeTab === 'fleets' ? (
                <>
                  {/* Cabang Armada Dropdown (Multi-Branch) */}
                  <div className="flex flex-col">
                    <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">CABANG</span>
                    <select
                      value={selectedBranchId}
                      onChange={(e) => branchStore.setSelectedOriginBranchId(e.target.value)}
                      className="px-2.5 py-1.5 rounded-lg bg-slate-950 border border-emerald-500/40 text-xs font-bold text-white focus:outline-hidden focus:border-emerald-500 cursor-pointer"
                    >
                      <option value="ALL">Semua Cabang ({fleets.length} Unit)</option>
                      {branches.map((b) => {
                        const count = fleets.filter(fl => branchStore.getFleetBranch(fl.id).id === b.id).length;
                        return (
                          <option key={b.id} value={b.id}>
                            {b.name} ({count} Unit)
                          </option>
                        );
                      })}
                    </select>
                  </div>

                  {/* Status Dropdown */}
                  <div className="flex flex-col">
                    <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">STATUS</span>
                    <select
                      value={fleetFilter}
                      onChange={(e) => setFleetFilter(e.target.value)}
                      className="px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-200 focus:outline-hidden focus:border-blue-500 cursor-pointer"
                    >
                      <option value="all">Semua Status Kondisi</option>
                      <option value="available">● Ready (Siap Jadwal Esok)</option>
                      <option value="on-duty">● Kirim (Sedang Dipakai Kirim)</option>
                      <option value="maintenance">● Servis (Dalam Perbaikan)</option>
                    </select>
                  </div>

                  {/* Tipe Kendaraan Dropdown */}
                  <div className="flex flex-col">
                    <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">TIPE</span>
                    <select
                      value={vehicleTypeFilter}
                      onChange={(e) => setVehicleTypeFilter(e.target.value)}
                      className="px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-200 focus:outline-hidden focus:border-blue-500 cursor-pointer"
                    >
                      <option value="all">Semua Tipe Kendaraan</option>
                      <option value="Pick Up Box">Pick Up Box</option>
                      <option value="Engkel STD">Engkel STD</option>
                      <option value="Engkel Long">Engkel Long</option>
                      <option value="Double STD">Double STD</option>
                    </select>
                  </div>
                </>
              ) : (
                <>
                  {/* Cabang Kru Dropdown (Multi-Branch) */}
                  <div className="flex flex-col">
                    <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">CABANG</span>
                    <select
                      value={selectedBranchId}
                      onChange={(e) => branchStore.setSelectedOriginBranchId(e.target.value)}
                      className="px-2.5 py-1.5 rounded-lg bg-slate-950 border border-emerald-500/40 text-xs font-bold text-white focus:outline-hidden focus:border-emerald-500 cursor-pointer"
                    >
                      <option value="ALL">Semua Cabang ({visibleCrewsForRole.length} Kru)</option>
                      {branches.map((b) => {
                        const count = visibleCrewsForRole.filter(cr => branchStore.getCrewBranch(cr.id, cr.name).id === b.id).length;
                        return (
                          <option key={b.id} value={b.id}>
                            {b.name} ({count} Kru)
                          </option>
                        );
                      })}
                    </select>
                  </div>

                  {/* Status Operasional Kru Dropdown (Terintegrasi User Manajemen) */}
                  <select
                    value={crewFilter}
                    onChange={(e) => setCrewFilter(e.target.value)}
                    className="px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-200 focus:outline-hidden focus:border-emerald-500 cursor-pointer"
                  >
                    <option value="all">Semua Status Operasional</option>
                    <option value="aktif">● Aktif (User Manajemen)</option>
                    {isCurrentSuperAdmin && (
                      <option value="nonaktif">○ Nonaktif (User Manajemen)</option>
                    )}
                  </select>

                  {/* Peran Kru Dropdown */}
                  <select
                    value={crewRoleFilter}
                    onChange={(e) => setCrewRoleFilter(e.target.value)}
                    className="px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-200 focus:outline-hidden focus:border-emerald-500 cursor-pointer"
                  >
                    <option value="all">Semua Peran Kru</option>
                    <option value="Driver Utama">Driver Utama</option>
                    <option value="Kernet / Helper">Kernet / Helper</option>
                    <option value="Driver Cadangan">Driver Cadangan</option>
                  </select>
                </>
              )}

              {/* Reset Filter Button */}
              {((activeTab === 'fleets' && (fleetFilter !== 'all' || vehicleTypeFilter !== 'all' || searchQuery)) ||
                (activeTab === 'crews' && (crewFilter !== 'all' || crewRoleFilter !== 'all' || searchQuery))) && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery('');
                    setFleetFilter('all');
                    setVehicleTypeFilter('all');
                    setCrewFilter('all');
                    setCrewRoleFilter('all');
                  }}
                  className="px-2.5 py-1.5 rounded-lg text-xs font-bold text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 border border-rose-500/30 transition cursor-pointer"
                  title="Reset Semua Filter"
                >
                  Reset
                </button>
              )}

              {/* View Switcher: Table View vs Cards Grid */}
              <div className="flex items-center bg-slate-950 p-1 rounded-lg border border-slate-800">
                <button
                  type="button"
                  onClick={() => setViewMode('table')}
                  className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-semibold transition cursor-pointer ${
                    viewMode === 'table' ? 'bg-blue-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'
                  }`}
                  title="Tampilan Tabel (Data Table)"
                >
                  <Table className="w-3.5 h-3.5" />
                  <span className="hidden md:inline">Tabel</span>
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('cards')}
                  className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-semibold transition cursor-pointer ${
                    viewMode === 'cards' ? 'bg-blue-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'
                  }`}
                  title="Tampilan Kartu (Grid View)"
                >
                  <LayoutGrid className="w-3.5 h-3.5" />
                  <span className="hidden md:inline">Kartu</span>
                </button>
              </div>

              {/* Refresh Data Button */}
              <button
                type="button"
                disabled={isSyncingSupabase}
                onClick={handleManualSupabaseSync}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/40 text-xs font-semibold transition cursor-pointer disabled:opacity-50"
                title="Segarkan data armada dan kru"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isSyncingSupabase ? 'animate-spin text-emerald-400' : 'text-emerald-400'}`} />
                <span className="hidden sm:inline">{isSyncingSupabase ? 'Memuat...' : 'Segarkan'}</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Pop-Up Modal Notifikasi "Data Berhasil Disimpan" */}
      {syncFeedback && (
        <div
          className="fixed inset-0 z-[70] bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150"
          onClick={() => setSyncFeedback(null)}
        >
          <div
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl max-w-sm w-full p-5 shadow-2xl text-center space-y-3 animate-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            <div
              className={`w-12 h-12 rounded-2xl mx-auto flex items-center justify-center border ${
                syncFeedback.type === 'success'
                  ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-500'
                  : 'bg-rose-500/15 border-rose-500/30 text-rose-500'
              }`}
            >
              {syncFeedback.type === 'success' ? (
                <CheckCircle2 className="w-6 h-6" />
              ) : (
                <AlertCircle className="w-6 h-6" />
              )}
            </div>
            <div>
              <h3 className="text-sm font-black text-slate-900 dark:text-white">
                {syncFeedback.type === 'success' ? 'Data Berhasil Disimpan' : 'Pemberitahuan Sistem'}
              </h3>
              <p className="text-xs text-slate-600 dark:text-slate-300 mt-1 leading-relaxed">
                {syncFeedback.message}
              </p>
            </div>
            <div className="pt-1">
              <button
                type="button"
                autoFocus
                onClick={() => setSyncFeedback(null)}
                className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition cursor-pointer shadow-xs focus:outline-none focus:ring-2 focus:ring-emerald-400"
              >
                Oke, Mengerti
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 3 Indikator Status Kondisi Armada Terintegrasi (Compact & Rapat) */}
      {activeTab === 'fleets' && (() => {
        const liveInfos = fleets.map(f => logisticsStore.getFleetLiveOperationalInfo(f));
        const readyCount = liveInfos.filter(i => i.effectiveStatus === 'available').length;
        const kirimCount = liveInfos.filter(i => i.effectiveStatus === 'on-duty').length;
        const servisCount = liveInfos.filter(i => i.effectiveStatus === 'maintenance').length;

        return (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5 text-xs">
            <button
              type="button"
              onClick={() => setFleetFilter(fleetFilter === 'available' ? 'all' : 'available')}
              className={`p-2.5 sm:p-3 rounded-xl border text-left transition flex items-center justify-between gap-2.5 cursor-pointer ${
                fleetFilter === 'available'
                  ? 'bg-emerald-950/40 border-emerald-500/60 shadow-xs'
                  : 'bg-slate-900 border-slate-800 hover:border-emerald-500/40'
              }`}
            >
              <div className="space-y-0.5 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 ring-2 ring-emerald-500/20 shrink-0" />
                  <span className="font-black text-emerald-400 text-xs uppercase tracking-wide">
                    Status Ready
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 truncate">
                  Siap digunakan untuk jadwal pengiriman esok hari
                </p>
              </div>
              <span className="text-lg font-black font-mono text-emerald-400 shrink-0">
                {readyCount}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setFleetFilter(fleetFilter === 'on-duty' ? 'all' : 'on-duty')}
              className={`p-2.5 sm:p-3 rounded-xl border text-left transition flex items-center justify-between gap-2.5 cursor-pointer ${
                fleetFilter === 'on-duty'
                  ? 'bg-blue-950/40 border-blue-500/60 shadow-xs'
                  : 'bg-slate-900 border-slate-800 hover:border-blue-500/40'
              }`}
            >
              <div className="space-y-0.5 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-blue-500 ring-2 ring-blue-500/20 shrink-0" />
                  <span className="font-black text-blue-400 text-xs uppercase tracking-wide">
                    Status Kirim
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 truncate">
                  Sedang dipakai kirim oleh tim pengiriman (Gate-Out aktif)
                </p>
              </div>
              <span className="text-lg font-black font-mono text-blue-400 shrink-0">
                {kirimCount}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setFleetFilter(fleetFilter === 'maintenance' ? 'all' : 'maintenance')}
              className={`p-2.5 sm:p-3 rounded-xl border text-left transition flex items-center justify-between gap-2.5 cursor-pointer ${
                fleetFilter === 'maintenance'
                  ? 'bg-rose-950/40 border-rose-500/60 shadow-xs'
                  : 'bg-slate-900 border-slate-800 hover:border-rose-500/40'
              }`}
            >
              <div className="space-y-0.5 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-rose-500 ring-2 ring-rose-500/20 shrink-0" />
                  <span className="font-black text-rose-400 text-xs uppercase tracking-wide">
                    Status Servis
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 truncate">
                  Dalam perbaikan dan terkunci dari jadwal pengiriman
                </p>
              </div>
              <span className="text-lg font-black font-mono text-rose-400 shrink-0">
                {servisCount}
              </span>
            </button>
          </div>
        );
      })()}

      {/* Fleets Content: Table View (Compact & Rapat) */}
      {activeTab === 'fleets' && viewMode === 'table' && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-950/80 border-b border-slate-800 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  <th className="py-2.5 px-2.5 w-10 text-center">#</th>
                  <th className="py-2.5 px-3 whitespace-nowrap">Armada &amp; Inisial</th>
                  <th className="py-2.5 px-3 whitespace-nowrap">Tipe &amp; Kubikasi Box</th>
                  <th className="py-2.5 px-3 text-center whitespace-nowrap">Status Kondisi &amp; Area Kirim</th>
                  <th className="py-2.5 px-3 whitespace-nowrap">Sopir / PIC</th>
                  <th className="py-2.5 px-3 whitespace-nowrap">Pajak / KIR</th>
                  <th className="py-2.5 px-3 text-center w-24 whitespace-nowrap">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {filteredFleets.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-10 text-center text-slate-400">
                      <Truck className="w-8 h-8 text-slate-600 mx-auto mb-2 opacity-60" />
                      <p className="font-semibold text-slate-300">Tidak ada armada ditemukan</p>
                      <p className="text-[11px] text-slate-500 mt-1">Coba sesuaikan kata kunci pencarian atau filter status armada.</p>
                    </td>
                  </tr>
                ) : (
                  filteredFleets.map((fleet, index) => {
                    const assignedCrew = crews.find(c => c.currentFleetId === fleet.id || (fleet.driverId && c.id === fleet.driverId));
                    const boxM3 = fleet.boxCapacityM3 !== undefined ? fleet.boxCapacityM3 : getFleetBoxCapacity(fleet);
                    const kirDateVal = fleet.kirExpiryDate || fleet.lastMaintenance;
                    const kirStatus = getExpiryStatus(kirDateVal);
                    const taxStatus = getExpiryStatus(fleet.taxDueDate);

                    return (
                      <tr key={fleet.id} className="hover:bg-slate-850/50 transition">
                        <td className="py-2.5 px-2.5 text-center font-mono text-slate-500 font-bold">{index + 1}</td>
                        <td className="py-2.5 px-3 whitespace-nowrap">
                          <div className="flex items-center gap-1.5">
                            {fleet.initialCode && (
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 whitespace-nowrap shrink-0">
                                {fleet.initialCode}
                              </span>
                            )}
                            <span className="font-bold text-white font-mono text-xs tracking-wide whitespace-nowrap">
                              {fleet.plateNumber}
                            </span>
                          </div>
                          <div className="mt-1 flex items-center gap-1">
                            <span className="text-[9px] text-slate-400">Gudang:</span>
                            <select
                              value={branchStore.getFleetBranch(fleet.id).id}
                              onChange={(e) => {
                                branchStore.setFleetBranch(fleet.id, e.target.value);
                                setBranches(branchStore.getActiveBranches());
                              }}
                              className="px-1.5 py-0.5 rounded bg-slate-950 border border-slate-800 text-[9px] font-bold text-emerald-400 cursor-pointer focus:outline-none"
                            >
                              {branches.map((b) => (
                                <option key={b.id} value={b.id}>
                                  {b.name}
                                </option>
                              ))}
                            </select>
                          </div>
                        </td>
                        <td className="py-2.5 px-3 whitespace-nowrap">
                          <div className="flex items-center gap-1.5">
                            <span className="font-bold text-slate-200 text-xs">{fleet.vehicleType}</span>
                            <span className="px-1.5 py-0.5 rounded-md text-[10px] font-mono font-black bg-cyan-500/15 text-cyan-300 border border-cyan-500/30">
                              {boxM3} m³
                            </span>
                          </div>
                          <div className="text-[10px] text-slate-400 mt-0.5">
                            {fleet.brand || '-'} ({fleet.year || '-'})
                          </div>
                        </td>
                        <td className="py-2.5 px-3 text-center whitespace-nowrap">
                          {(() => {
                            const liveInfo = logisticsStore.getFleetLiveOperationalInfo(fleet);
                            return (
                              <div className="flex flex-col items-center gap-0.5">
                                <button
                                  type="button"
                                  onClick={() => toggleFleetStatus(fleet)}
                                  className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold border transition cursor-pointer ${liveInfo.badgeColorClass}`}
                                  title="Klik untuk ubah status kondisi armada (Ready -> Kirim -> Servis)"
                                >
                                  <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${liveInfo.dotColorClass}`} />
                                  <span>{liveInfo.statusLabel}</span>
                                </button>
                                <div className="text-[10px] text-slate-400 font-medium max-w-[165px] truncate" title={liveInfo.statusDescription}>
                                  {liveInfo.effectiveStatus === 'on-duty' ? (
                                    <span className="text-blue-300 font-semibold">
                                      Area: {liveInfo.areaName || 'Sedang Kirim'}
                                    </span>
                                  ) : liveInfo.effectiveStatus === 'maintenance' ? (
                                    <span className="text-rose-400 font-semibold">
                                      Tidak bisa diatur kirim
                                    </span>
                                  ) : liveInfo.areaName ? (
                                    <span className="text-emerald-300/90">
                                      Area: {liveInfo.areaName}
                                    </span>
                                  ) : (
                                    <span>Siap jadwal esok</span>
                                  )}
                                </div>
                              </div>
                            );
                          })()}
                        </td>
                        <td className="py-2.5 px-3 whitespace-nowrap">
                          {assignedCrew ? (
                            <div className="font-bold text-slate-200 flex items-center gap-1.5 text-xs">
                              <UserCheck className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                              <span>{assignedCrew.name}</span>
                            </div>
                          ) : (
                            <span className="text-[11px] text-slate-500 italic">Belum Dipasangkan</span>
                          )}
                        </td>

                        {/* Pajak & KIR: Tanggal KIR lebih besar, keterangan Aktif/Jatuh Tempo lebih kecil */}
                        <td className="py-2.5 px-3 whitespace-nowrap">
                          <div className="space-y-1">
                            <div className="flex items-center gap-1.5">
                              <span className="text-[10px] font-bold uppercase text-teal-400">KIR:</span>
                              <span className="text-xs sm:text-[13px] font-black text-white font-mono tracking-tight">
                                {kirDateVal ? formatIndoDate(kirDateVal) : '-'}
                              </span>
                            </div>
                            <div className="flex items-center gap-1">
                              <span className={`px-1.5 py-0.2 rounded text-[9px] border font-semibold leading-tight ${kirDateVal ? kirStatus.color : taxStatus.color}`}>
                                {kirDateVal ? kirStatus.label : taxStatus.label}
                              </span>
                            </div>
                          </div>
                        </td>

                        {/* Aksi */}
                        <td className="py-2.5 px-3 text-center whitespace-nowrap">
                          <div className="flex items-center justify-center gap-1">
                            <button
                              type="button"
                              onClick={() => handleEditFleetClick(fleet)}
                              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition cursor-pointer"
                              title="Edit Data Armada"
                            >
                              <Edit3 className="w-3.5 h-3.5 text-blue-400" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteFleetClick(fleet)}
                              className="p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 hover:text-rose-300 border border-rose-500/30 transition cursor-pointer"
                              title="Hapus Armada"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                            {fleet.kirDocUrl && (
                              <button
                                type="button"
                                onClick={() => setSelectedKirDocFleet(fleet)}
                                className="p-1.5 rounded-lg bg-teal-500/10 hover:bg-teal-500/20 text-teal-400 hover:text-teal-300 border border-teal-500/30 transition cursor-pointer"
                                title="Lihat Dokumen KIR Dishub"
                              >
                                <FileText className="w-3.5 h-3.5" />
                              </button>
                            )}
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
      )}

      {/* Fleets Content: Cards Grid View */}
      {activeTab === 'fleets' && viewMode === 'cards' && (
        filteredFleets.length === 0 ? (
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-12 text-center text-slate-400">
            <Truck className="w-8 h-8 text-slate-600 mx-auto mb-2 opacity-60" />
            <p className="font-semibold text-slate-300">Tidak ada armada ditemukan</p>
            <p className="text-[11px] text-slate-500 mt-1">Coba sesuaikan kata kunci pencarian atau filter status dan tipe kendaraan.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredFleets.map(fleet => {
            const assignedCrew = crews.find(c => c.currentFleetId === fleet.id || (fleet.driverId && c.id === fleet.driverId));
            const boxM3 = fleet.boxCapacityM3 !== undefined ? fleet.boxCapacityM3 : getFleetBoxCapacity(fleet);
            const boxDim = fleet.boxDimensions || getDefaultBoxDimensions(fleet.vehicleType, fleet.brand);
            const boxMultiplier = fleet.boxInnerMultiplierPercent !== undefined ? fleet.boxInnerMultiplierPercent : 90;
            const innerBoxM3 = fleet.boxInnerCapacityM3 !== undefined ? fleet.boxInnerCapacityM3 : Number((boxM3 * (boxMultiplier / 100)).toFixed(2));

            return (
              <div key={fleet.id} className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm space-y-4 hover:border-slate-700 transition">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">PLAT NOMOR</span>
                      {fleet.initialCode && (
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/40">
                          {fleet.initialCode}
                        </span>
                      )}
                    </div>
                    <h3 className="text-lg font-black text-white font-mono tracking-wider">
                      {fleet.plateNumber} {fleet.initialCode ? `(${fleet.initialCode})` : ''}
                    </h3>
                  </div>

                  {(() => {
                    const liveInfo = logisticsStore.getFleetLiveOperationalInfo(fleet);
                    return (
                      <div className="flex flex-col items-end gap-1">
                        <button
                          onClick={() => toggleFleetStatus(fleet)}
                          className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold cursor-pointer border transition ${liveInfo.badgeColorClass}`}
                          title="Klik untuk ubah status kondisi armada (Ready -> Kirim -> Servis)"
                        >
                          <span className={`w-3.5 h-3.5 rounded-full shrink-0 ${liveInfo.dotColorClass}`} />
                          <span>{liveInfo.statusLabel}</span>
                        </button>
                        <span className="text-[10px] text-slate-400 font-medium">
                          {liveInfo.effectiveStatus === 'on-duty'
                            ? `Area: ${liveInfo.areaName || 'Sedang Kirim'}`
                            : liveInfo.effectiveStatus === 'maintenance'
                            ? 'Dalam perbaikan (Tidak bisa kirim)'
                            : liveInfo.areaName
                            ? `Area: ${liveInfo.areaName}`
                            : 'Siap jadwal esok'}
                        </span>
                      </div>
                    );
                  })()}
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="bg-slate-950/60 p-2.5 rounded-lg border border-slate-800">
                    <span className="text-slate-400 text-[11px]">Tipe Armada:</span>
                    <div className="font-semibold text-white mt-0.5 flex items-center justify-between gap-1">
                      <span className="truncate">{fleet.vehicleType}</span>
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 whitespace-nowrap" title={`Kubikasi Box: ${boxM3} m³`}>
                        {boxM3} m³
                      </span>
                    </div>
                  </div>
                  <div className="bg-slate-950/60 p-2.5 rounded-lg border border-slate-800">
                    <span className="text-slate-400 text-[11px]">Inisial Mobil:</span>
                    <div className="font-semibold text-emerald-400 font-mono mt-0.5 flex items-center gap-1.5">
                      <span className="px-1.5 py-0.5 rounded bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs">
                        {fleet.initialCode || (fleet.vehicleType.includes('Wingbox') ? 'WB' : 'ARM') + '-' + fleet.plateNumber.slice(-3)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Spesifikasi Kendaraan */}
                <div className="grid grid-cols-3 gap-2 text-xs">
                  <div className="bg-slate-950/40 p-2 rounded-lg border border-slate-800/60 text-center">
                    <span className="text-slate-400 text-[10px] block">Merk Mobil</span>
                    <div className="font-semibold text-white truncate mt-0.5" title={fleet.brand || 'Mitsubishi L300'}>
                      {fleet.brand || 'Mitsubishi L300'}
                    </div>
                  </div>
                  <div className="bg-slate-950/40 p-2 rounded-lg border border-slate-800/60 text-center">
                    <span className="text-slate-400 text-[10px] block">Tahun Produksi</span>
                    <div className="font-semibold text-white mt-0.5">{fleet.year || '2023'}</div>
                  </div>
                  <div className="bg-slate-950/40 p-2 rounded-lg border border-slate-800/60 text-center">
                    <span className="text-slate-400 text-[10px] block">Kapasitas (CC)</span>
                    <div className="font-semibold text-white mt-0.5">{fleet.engineCc || '2500 CC'}</div>
                  </div>
                </div>

                {/* 📦 DIMENSI BOX: Ukuran Luar vs Pengali Dimensi Dalam Box (...%) */}
                <div className="bg-slate-950/80 p-3 rounded-xl border border-cyan-500/30 space-y-2 shadow-inner">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-cyan-300 flex items-center gap-1.5">
                      <Box className="w-3.5 h-3.5 text-cyan-400" />
                      <span>Kapasitas Kubikasi Box Truk</span>
                    </span>
                    <span className="px-1.5 py-0.2 rounded text-[10px] font-mono font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/40">
                      Pengali Dinding: {boxMultiplier}%
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-[11px]">
                    <div className="bg-slate-900/90 p-2 rounded-lg border border-slate-800">
                      <span className="text-[10px] text-slate-400 block">Ukuran Box Luar:</span>
                      <div className="font-mono font-bold text-white text-xs mt-0.5">{boxM3} m³</div>
                      <div className="text-[10px] text-slate-400 font-mono truncate" title={boxDim}>{boxDim}</div>
                    </div>

                    <div className="bg-cyan-950/40 p-2 rounded-lg border border-cyan-500/40">
                      <span className="text-[10px] text-cyan-400 font-bold block">
                        Hasil Netto Dalam ({boxMultiplier}%):
                      </span>
                      <div className="font-mono font-black text-cyan-300 text-xs mt-0.5">{innerBoxM3} m³</div>
                      <div className="text-[10px] text-cyan-400/80 font-mono">Efektif Muatan Barang</div>
                    </div>
                  </div>
                  <div className="text-[9px] text-slate-400 italic">
                    *Ukuran luar &amp; dalam berbeda ketebalan dinding boks (dikalikan {boxMultiplier}%)
                  </div>
                </div>

                {/* Operational Details (Tanpa GPS Tracksolid, Tanpa Frekuensi Pengiriman, Tanpa Efisiensi BBM, Tanpa Rute Aktif GPS) */}
                <div className="space-y-2 text-xs">
                  {/* Status Dokumen & Masa Berlaku Legalitas Armada (KIR, Pajak, STNK) */}
                  <div className="bg-slate-950/75 p-3 rounded-xl border border-slate-800/90 shadow-inner space-y-2.5">
                    <div className="flex items-center justify-between pb-1.5 border-b border-slate-800/60">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-slate-200">
                        <ShieldCheck className="w-4 h-4 text-emerald-400" />
                        <span>Masa Berlaku Dokumen Kendaraan</span>
                      </div>
                      {(() => {
                        const kirStat = getExpiryStatus(fleet.lastMaintenance || fleet.kirExpiryDate);
                        const taxStat = getExpiryStatus(fleet.taxDueDate);
                        const stnkStat = getExpiryStatus(fleet.stnkExpiryDate);
                        const hasExpired = kirStat.isExpired || taxStat.isExpired || stnkStat.isExpired;
                        const hasNear = kirStat.isNear || taxStat.isNear || stnkStat.isNear;

                        if (hasExpired) {
                          return (
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-500/15 text-rose-400 border border-rose-500/30 flex items-center gap-1">
                              <AlertTriangle className="w-3 h-3 text-rose-400" />
                              Perlu Perpanjangan
                            </span>
                          );
                        }
                        if (hasNear) {
                          return (
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30 flex items-center gap-1">
                              <Clock className="w-3 h-3 text-amber-400" />
                              Mendekati Tempo
                            </span>
                          );
                        }
                        return (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                            Dokumen Valid
                          </span>
                        );
                      })()}
                    </div>

                    <div className="space-y-2">
                      {/* 1. Uji Berkala KIR / Servis + Bukti File KIR Dishub */}
                      {(() => {
                        const kirDate = fleet.lastMaintenance || fleet.kirExpiryDate || '2026-12-23';
                        const kirStatus = getExpiryStatus(kirDate);
                        return (
                          <div className="bg-slate-900/90 p-2.5 rounded-lg border border-slate-800/90 space-y-2 hover:border-teal-500/30 transition">
                            <div className="flex items-center justify-between gap-2.5">
                              <div className="flex items-center gap-2.5 min-w-0">
                                <div className="w-8 h-8 rounded-lg bg-teal-500/15 border border-teal-500/30 flex items-center justify-center shrink-0">
                                  <Wrench className="w-4 h-4 text-teal-400" />
                                </div>
                                <div className="min-w-0">
                                  <div className="text-xs font-bold text-slate-200 truncate flex items-center gap-1">
                                    <span>Uji KIR &amp; Servis</span>
                                  </div>
                                  <div className="text-[10px] text-slate-400">
                                    Uji Berkala Dishub (6 Bln)
                                  </div>
                                </div>
                              </div>

                              <div className="text-right shrink-0">
                                <div className="text-sm sm:text-base font-black text-white font-mono tracking-tight">
                                  {kirDate}
                                </div>
                                <div className="flex items-center justify-end gap-1.5 mt-0.5">
                                  <span className="text-[10px] text-teal-300/90 font-medium">
                                    {formatIndoDate(kirDate)}
                                  </span>
                                  <span className={`px-1.5 py-0.2 rounded text-[9px] font-bold border ${kirStatus.color}`}>
                                    {kirStatus.label}
                                  </span>
                                </div>
                              </div>
                            </div>

                            {/* Bukti File KIR Dishub */}
                            <div className="pt-2 border-t border-slate-800/70 flex items-center justify-between text-[11px]">
                              {fleet.kirDocUrl ? (
                                <div className="flex items-center justify-between w-full">
                                  <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                                    <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                                    <span>Bukti KIR Ada</span>
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => setSelectedKirDocFleet(fleet)}
                                    className="text-[10px] text-cyan-400 hover:text-cyan-300 font-bold underline flex items-center gap-1 cursor-pointer"
                                  >
                                    <Eye className="w-3 h-3" />
                                    <span>Lihat File KIR</span>
                                  </button>
                                </div>
                              ) : (
                                <div className="flex items-center justify-between w-full text-[10px]">
                                  <span className="text-slate-500 flex items-center gap-1">
                                    <AlertCircle className="w-3 h-3 text-amber-400" />
                                    <span>Belum ada file KIR</span>
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => handleEditFleetClick(fleet)}
                                    className="text-blue-400 hover:text-blue-300 underline font-semibold cursor-pointer"
                                  >
                                    Unggah File KIR &rarr;
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })()}

                      {/* 2. Pajak Tahunan (PKB) */}
                      {(() => {
                        const taxDate = fleet.taxDueDate || '2027-06-25';
                        const taxStatus = getExpiryStatus(taxDate);
                        return (
                          <div className="bg-slate-900/90 p-2.5 rounded-lg border border-slate-800/90 flex items-center justify-between gap-2.5 hover:border-blue-500/30 transition">
                            <div className="flex items-center gap-2.5 min-w-0">
                              <div className="w-8 h-8 rounded-lg bg-blue-500/15 border border-blue-500/30 flex items-center justify-center shrink-0">
                                <FileText className="w-4 h-4 text-blue-400" />
                              </div>
                              <div className="min-w-0">
                                <div className="text-xs font-bold text-slate-200 truncate flex items-center gap-1">
                                  <span>Pajak Tahunan</span>
                                </div>
                                <div className="text-[10px] text-slate-400">
                                  Samsat PKB (1 Tahun)
                                </div>
                              </div>
                            </div>

                            <div className="text-right shrink-0">
                              <div className="text-sm sm:text-base font-black text-white font-mono tracking-tight">
                                {taxDate}
                              </div>
                              <div className="flex items-center justify-end gap-1.5 mt-0.5">
                                <span className="text-[10px] text-blue-300/90 font-medium">
                                  {formatIndoDate(taxDate)}
                                </span>
                                <span className={`px-1.5 py-0.2 rounded text-[9px] font-bold border ${taxStatus.color}`}>
                                  {taxStatus.label}
                                </span>
                              </div>
                            </div>
                          </div>
                        );
                      })()}

                      {/* 3. STNK / Plat 5 Tahunan */}
                      {(() => {
                        const stnkDate = fleet.stnkExpiryDate || '2029-06-25';
                        const stnkStatus = getExpiryStatus(stnkDate);
                        return (
                          <div className="bg-slate-900/90 p-2.5 rounded-lg border border-slate-800/90 flex items-center justify-between gap-2.5 hover:border-amber-500/30 transition">
                            <div className="flex items-center gap-2.5 min-w-0">
                              <div className="w-8 h-8 rounded-lg bg-amber-500/15 border border-amber-500/30 flex items-center justify-center shrink-0">
                                <CreditCard className="w-4 h-4 text-amber-400" />
                              </div>
                              <div className="min-w-0">
                                <div className="text-xs font-bold text-slate-200 truncate flex items-center gap-1">
                                  <span>STNK & Plat Nomor</span>
                                </div>
                                <div className="text-[10px] text-slate-400">
                                  Masa Berlaku Plat (5 Thn)
                                </div>
                              </div>
                            </div>

                            <div className="text-right shrink-0">
                              <div className="text-sm sm:text-base font-black text-white font-mono tracking-tight">
                                {stnkDate}
                              </div>
                              <div className="flex items-center justify-end gap-1.5 mt-0.5">
                                <span className="text-[10px] text-amber-300/90 font-medium">
                                  {formatIndoDate(stnkDate)}
                                </span>
                                <span className={`px-1.5 py-0.2 rounded text-[9px] font-bold border ${stnkStatus.color}`}>
                                  {stnkStatus.label}
                                </span>
                              </div>
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  </div>

                  {/* Status Komponen Rutin (Oli, Ban, Aki) */}
                  {(() => {
                    const routineStatus = logisticsStore.getFleetRoutineComponentsStatus(fleet.id);
                    return (
                      <div className="bg-slate-950/50 p-2.5 rounded-lg border border-slate-800/80 space-y-1.5">
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="font-bold text-slate-300 flex items-center gap-1.5">
                            <Wrench className="w-3.5 h-3.5 text-amber-400" />
                            <span>Komponen Rutin Armada:</span>
                          </span>
                          {onNavigateToSpareParts && (
                            <button
                              onClick={onNavigateToSpareParts}
                              className="text-[10px] text-amber-400 hover:underline font-semibold cursor-pointer"
                            >
                              Kelola Stok & Servis &rarr;
                            </button>
                          )}
                        </div>
                        <div className="grid grid-cols-3 gap-1.5 pt-0.5">
                          <div className="bg-slate-900/80 p-1.5 rounded border border-slate-800 text-center">
                            <div className="flex items-center justify-center gap-1 text-[10px] text-slate-400 mb-0.5">
                              <Droplets className="w-3 h-3 text-amber-400" />
                              <span>Oli</span>
                            </div>
                            <span className={`text-[9px] font-bold px-1 py-0.2 rounded border block truncate ${
                              routineStatus.oil.status === 'urgent'
                                ? 'bg-rose-500/15 text-rose-400 border-rose-500/30'
                                : routineStatus.oil.status === 'warning'
                                ? 'bg-amber-500/15 text-amber-400 border-amber-500/30'
                                : 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                            }`}>
                              {routineStatus.oil.label}
                            </span>
                          </div>

                          <div
                            onClick={() => setActiveTab('spareparts')}
                            className="bg-slate-900/80 p-1.5 rounded border border-slate-800 text-center cursor-pointer hover:border-amber-500/50 hover:bg-slate-850 transition group"
                            title="Klik untuk membuka Manajemen Spare Part & Servis"
                          >
                            <div className="flex items-center justify-center gap-1 text-[10px] text-slate-400 group-hover:text-amber-400 mb-0.5">
                              <Disc className="w-3 h-3 text-emerald-400 group-hover:text-amber-400" />
                              <span>Ban</span>
                            </div>
                            <span className={`text-[9px] font-bold px-1 py-0.2 rounded border block truncate ${
                              routineStatus.tire.status === 'urgent'
                                ? 'bg-rose-500/15 text-rose-400 border-rose-500/30'
                                : routineStatus.tire.status === 'warning'
                                ? 'bg-amber-500/15 text-amber-400 border-amber-500/30'
                                : 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                            }`}>
                              {routineStatus.tire.label}
                            </span>
                          </div>

                          <div className="bg-slate-900/80 p-1.5 rounded border border-slate-800 text-center">
                            <div className="flex items-center justify-center gap-1 text-[10px] text-slate-400 mb-0.5">
                              <BatteryCharging className="w-3 h-3 text-cyan-400" />
                              <span>Aki</span>
                            </div>
                            <span className={`text-[9px] font-bold px-1 py-0.2 rounded border block truncate ${
                              routineStatus.battery.status === 'urgent'
                                ? 'bg-rose-500/15 text-rose-400 border-rose-500/30'
                                : routineStatus.battery.status === 'warning'
                                ? 'bg-amber-500/15 text-amber-400 border-amber-500/30'
                                : 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                            }`}>
                              {routineStatus.battery.label}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })()}
                </div>

                {/* Assigned Crew Bar */}
                <div className="pt-3 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
                  <span className="text-[11px] font-medium">Kru Ditugaskan:</span>
                  <div className="flex items-center gap-1.5">
                    <UserCheck className="w-3.5 h-3.5 text-blue-400" />
                    <span className="font-bold text-white">
                      {assignedCrew ? assignedCrew.name : 'Standby / Pool Banyuwangi'}
                    </span>
                    {assignedCrew && (
                      <span className="text-[10px] font-semibold text-blue-300 bg-blue-500/15 border border-blue-500/30 px-1.5 py-0.2 rounded">
                        {assignedCrew.role.includes('Helper') ? 'Helper' : 'Driver'}
                      </span>
                    )}
                  </div>
                </div>

                {/* Edit & Hapus Buttons */}
                <div className="pt-2.5 border-t border-slate-800/80 flex items-center justify-end gap-2 text-xs">
                  <button
                    onClick={() => handleEditFleetClick(fleet)}
                    className="px-3 py-1 rounded bg-slate-800 hover:bg-slate-750 hover:text-white text-slate-300 font-medium flex items-center gap-1 transition cursor-pointer"
                  >
                    <Edit3 className="w-3.5 h-3.5 text-blue-400" />
                    <span>Edit</span>
                  </button>
                  <button
                    onClick={() => handleDeleteFleetClick(fleet)}
                    className="px-3 py-1 rounded bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 hover:text-rose-300 font-medium flex items-center gap-1 transition cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Hapus</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
        )
      )}

      {/* Info Indikator Status Operasional & Rumus Performa Rit & Rating */}
      {activeTab === 'crews' && (
        <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs shadow-2xs">
          <div className="flex items-start sm:items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
              <Award className="w-4 h-4" />
            </div>
            <div className="space-y-0.5">
              <div className="font-bold text-white text-xs">
                Integrasi Status Operasional &amp; Rumus Performa Rit / Rating Kru
              </div>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                <strong>Status Operasional (Aktif / Nonaktif)</strong> terintegrasi langsung dengan <strong>Manajemen User</strong>. Sedangkan <strong>Performa Rit &amp; Rating</strong> dihitung otomatis dari <strong>Prosentase Total Kiriman Selesai (%)</strong> serta <strong>Ketepatan Waktu (Tidak Telat) Berangkat dari Gudang &amp; Sampai di Gudang (%)</strong>.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Crews Content: Table View */}
      {activeTab === 'crews' && viewMode === 'table' && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-950/80 border-b border-slate-800 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                  <th className="py-3 px-4 w-12 text-center">#</th>
                  <th className="py-3 px-4">Nama Lengkap Kru</th>
                  <th className="py-3 px-4">Peran Tugas</th>
                  <th className="py-3 px-4 text-center">Status Operasional (User)</th>
                  <th className="py-3 px-4">Armada Ditugaskan</th>
                  <th className="py-3 px-4 text-center">Performa Rit &amp; Rating (Kiriman &amp; Waktu Gudang)</th>
                  <th className="py-3 px-4 text-center w-28">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {filteredCrews.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-slate-400">
                      <Users className="w-8 h-8 text-slate-600 mx-auto mb-2 opacity-60" />
                      <p className="font-semibold text-slate-300">Tidak ada kru ditemukan</p>
                      <p className="text-[11px] text-slate-500 mt-1">Coba sesuaikan kata kunci pencarian atau filter status kru.</p>
                    </td>
                  </tr>
                ) : (
                  filteredCrews.map((crew, index) => {
                    const assignedFleet = fleets.find(f => f.id === crew.currentFleetId || f.driverId === crew.id);
                    const { isActive } = getCrewIntegratedStatus(crew);
                    const perf = getCrewDynamicPerformance(crew);

                    return (
                      <tr key={crew.id} className="hover:bg-slate-850/50 transition">
                        <td className="py-3 px-4 text-center font-mono text-slate-500 font-bold">{index + 1}</td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-blue-400 font-bold text-xs shrink-0">
                              {crew.name.substring(0, 2).toUpperCase()}
                            </div>
                            <div>
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <h4 className="font-bold text-white text-xs">{crew.name}</h4>
                                <span className="text-[9px] font-bold text-emerald-400 bg-emerald-500/10 px-1.5 py-0.2 rounded border border-emerald-500/25">
                                  Cabang {branchStore.getCrewBranch(crew.id, crew.name).name}
                                </span>
                              </div>
                              <span className="text-[10px] text-slate-500">ID: {crew.id.slice(0, 8)}</span>
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <span className={`px-2 py-0.5 rounded-md text-[10px] font-semibold border ${
                            crew.role === 'Driver Utama'
                              ? 'bg-blue-500/15 text-blue-400 border-blue-500/30'
                              : crew.role === 'Driver Cadangan'
                              ? 'bg-purple-500/15 text-purple-400 border-purple-500/30'
                              : 'bg-amber-500/15 text-amber-400 border-amber-500/30'
                          }`}>
                            {crew.role}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-center">
                          <button
                            type="button"
                            onClick={() => toggleCrewStatus(crew)}
                            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold border transition cursor-pointer ${
                              isActive
                                ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/25'
                                : 'bg-rose-500/15 text-rose-400 border-rose-500/30 hover:bg-rose-500/25'
                            }`}
                            title="Terintegrasi dengan Manajemen User (Klik untuk ubah Aktif / Nonaktif)"
                          >
                            <span className={`w-1.5 h-1.5 rounded-full ${isActive ? 'bg-emerald-400' : 'bg-rose-400'}`} />
                            <span>{isActive ? 'Aktif' : 'Nonaktif'}</span>
                          </button>
                        </td>
                        <td className="py-3 px-4">
                          {assignedFleet ? (
                            <div className="flex items-center gap-1.5 font-mono font-bold text-slate-200">
                              <Truck className="w-3.5 h-3.5 text-blue-400" />
                              <span>{assignedFleet.plateNumber}</span>
                              {assignedFleet.initialCode && (
                                <span className="text-[10px] text-indigo-400">({assignedFleet.initialCode})</span>
                              )}
                            </div>
                          ) : (
                            <span className="text-[11px] text-slate-500 italic">Standby Pool</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <div className="font-bold text-white text-xs">
                            {perf.completedRit} / {perf.totalAssigned} Rit ({perf.completionPct}% Kiriman)
                          </div>
                          <div className="text-[10px] text-amber-400 font-bold flex items-center justify-center gap-1 mt-0.5">
                            <Award className="w-3 h-3 shrink-0" />
                            <span>{perf.rating.toFixed(1)} / 5.0</span>
                            <span className="text-slate-500">•</span>
                            <span className="text-emerald-400">Tepat Waktu Gudang: {perf.onTimePct}%</span>
                          </div>
                        </td>
                        <td className="py-3 px-4 text-center">
                          <div className="flex items-center justify-center gap-1">
                            <button
                              type="button"
                              onClick={() => handleEditCrewClick(crew)}
                              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition cursor-pointer"
                              title="Edit Data Kru"
                            >
                              <Edit3 className="w-3.5 h-3.5 text-blue-400" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteCrewClick(crew)}
                              className="p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 hover:text-rose-300 border border-rose-500/30 transition cursor-pointer"
                              title="Hapus Kru"
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
      )}

      {/* Crews Content: Cards Grid View */}
      {activeTab === 'crews' && viewMode === 'cards' && (
        filteredCrews.length === 0 ? (
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-12 text-center text-slate-400">
            <Users className="w-8 h-8 text-slate-600 mx-auto mb-2 opacity-60" />
            <p className="font-semibold text-slate-300">Tidak ada kru ditemukan</p>
            <p className="text-[11px] text-slate-500 mt-1">Coba sesuaikan kata kunci pencarian atau filter status dan peran kru.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredCrews.map(crew => {
              const { isActive } = getCrewIntegratedStatus(crew);
              const perf = getCrewDynamicPerformance(crew);
              return (
                <div key={crew.id} className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm space-y-4 hover:border-slate-700 transition">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-blue-400 font-bold text-sm">
                        {crew.name.substring(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <h3 className="text-sm font-bold text-white">{crew.name}</h3>
                          <span className="text-[9px] font-bold text-emerald-400 bg-emerald-500/10 px-1.5 py-0.2 rounded border border-emerald-500/25">
                            Cabang {branchStore.getCrewBranch(crew.id, crew.name).name}
                          </span>
                        </div>
                        <span className="text-[11px] text-slate-400">{crew.role}</span>
                      </div>
                    </div>

                    <button
                      onClick={() => toggleCrewStatus(crew)}
                      className={`px-2.5 py-1 rounded-full text-xs font-bold cursor-pointer border transition flex items-center gap-1.5 ${
                        isActive
                          ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                          : 'bg-rose-500/15 text-rose-400 border-rose-500/30'
                      }`}
                    >
                      <span className={`w-1.5 h-1.5 rounded-full ${isActive ? 'bg-emerald-400' : 'bg-rose-400'}`} />
                      <span>{isActive ? 'Aktif' : 'Nonaktif'}</span>
                    </button>
                  </div>

                  <div className="bg-slate-950/60 p-2.5 rounded-lg border border-slate-800 text-xs space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400 text-[11px]">Prosentase Kiriman Selesai:</span>
                      <span className="font-bold text-white">{perf.completedRit} / {perf.totalAssigned} Rit ({perf.completionPct}%)</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400 text-[11px]">Tepat Waktu Berangkat &amp; Tiba Gudang:</span>
                      <span className="font-bold text-emerald-400">{perf.onTimePct}%</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-3 border-t border-slate-800 text-xs">
                    <span className="text-[11px] text-slate-400">Rating Performa:</span>
                    <div className="flex items-center gap-1 text-amber-400 font-semibold">
                      <Award className="w-3.5 h-3.5" />
                      <span>{perf.rating.toFixed(1)} / 5.0</span>
                    </div>
                  </div>

                  <div className="pt-2">
                    <button
                      onClick={() => setActiveTab('history')}
                      className="w-full py-1.5 px-2.5 rounded-lg bg-slate-950 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 text-slate-300 hover:text-white text-[11px] font-semibold flex items-center justify-center gap-1.5 transition cursor-pointer"
                    >
                      <History className="w-3.5 h-3.5 text-amber-400" />
                      <span>Cek Histori &amp; Distribusi Wilayah</span>
                    </button>
                  </div>

                  {/* Edit & Hapus Buttons */}
                  <div className="pt-2.5 border-t border-slate-800 flex items-center justify-end gap-2 text-xs">
                    <button
                      onClick={() => handleEditCrewClick(crew)}
                      className="px-3 py-1 rounded bg-slate-800 hover:bg-slate-750 hover:text-white text-slate-300 font-medium flex items-center gap-1 transition cursor-pointer"
                    >
                      <Edit3 className="w-3.5 h-3.5 text-blue-400" />
                      <span>Edit</span>
                    </button>
                    <button
                      onClick={() => handleDeleteCrewClick(crew)}
                      className="px-3 py-1 rounded bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 hover:text-rose-300 font-medium flex items-center gap-1 transition cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Hapus</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )
      )}

      {/* Efisiensi BBM Tab Content */}
      {activeTab === 'fuel' && (
        <FuelEfficiencyManagement onNavigateToFleets={() => setActiveTab('fleets')} />
      )}

      {/* Spare Part & Service Tab Content */}
      {activeTab === 'spareparts' && (
        <SparePartManagement onNavigateToFleets={() => setActiveTab('fleets')} />
      )}

      {/* History & Area Approval Tab Content */}
      {activeTab === 'history' && (
        <CrewDeliveryHistoryView />
      )}

      {/* Formulir Operasional Armada Tab Content */}
      {activeTab === 'forms' && (
        <FleetFormCenter />
      )}

      {/* Add Fleet Modal */}
      {isAddFleetOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-hidden">
          <div className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden my-auto">
            <div className="p-4 border-b border-slate-800 flex items-center justify-between shrink-0 bg-slate-900/95">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Truck className="w-4 h-4 text-blue-400" />
                Registrasi Armada Kendaraan Baru
              </h3>
              <button
                type="button"
                onClick={() => setIsAddFleetOpen(false)}
                className="text-slate-400 hover:text-white font-bold text-lg p-1 rounded-lg hover:bg-slate-800 transition cursor-pointer"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleCreateFleet} className="flex flex-col flex-1 min-h-0 overflow-hidden">
              <div className="p-5 space-y-4 text-xs overflow-y-auto flex-1 overscroll-contain">
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="text-slate-400 block mb-1">Cabang Armada *</label>
                  <select
                    value={newFleetBranchId}
                    onChange={(e) => setNewFleetBranchId(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-emerald-400 font-bold cursor-pointer"
                  >
                    {branches.map(b => (
                      <option key={b.id} value={b.id}>Cabang {b.name} ({b.city})</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-slate-400 block mb-1">Nomor Polisi (Plat)</label>
                  <input
                    type="text"
                    required
                    placeholder="Contoh: P 8125 VC"
                    value={newFleet.plateNumber}
                    onChange={(e) => {
                      setNewFleet({ ...newFleet, plateNumber: e.target.value.toUpperCase() });
                      if (fleetFormErrors.plateNumber) setFleetFormErrors({ ...fleetFormErrors, plateNumber: '' });
                    }}
                    className={`w-full px-3 py-2 rounded-lg bg-slate-950 border text-white font-mono uppercase ${
                      fleetFormErrors.plateNumber ? 'border-rose-500 ring-1 ring-rose-500' : 'border-slate-800'
                    }`}
                  />
                  {fleetFormErrors.plateNumber && (
                    <p className="text-[10px] text-rose-400 mt-1 flex items-center gap-1 font-medium">
                      <AlertCircle className="w-3 h-3 shrink-0" />
                      <span>{fleetFormErrors.plateNumber}</span>
                    </p>
                  )}
                </div>
                <div>
                  <label className="text-slate-400 block mb-1">Tipe Kendaraan</label>
                  <select
                    value={newFleet.vehicleType}
                    onChange={(e) => {
                      const vType = e.target.value as VehicleType;
                      setNewFleet({
                        ...newFleet,
                        vehicleType: vType,
                        boxCapacityM3: getDefaultBoxCapacityM3(vType, newFleet.brand),
                        boxDimensions: getDefaultBoxDimensions(vType, newFleet.brand)
                      });
                    }}
                    className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-white cursor-pointer"
                  >
                    <option value="Pick Up Box">Pick Up Box</option>
                    <option value="Engkel STD">Engkel STD</option>
                    <option value="Engkel Long">Engkel Long</option>
                    <option value="Double STD">Double STD</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-slate-400 block mb-1">Inisial Mobil</label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: N1 / NP1, WB-01, DS-1"
                  value={newFleet.initialCode}
                  onChange={(e) => {
                    setNewFleet({ ...newFleet, initialCode: e.target.value.toUpperCase() });
                    if (fleetFormErrors.initialCode) setFleetFormErrors({ ...fleetFormErrors, initialCode: '' });
                  }}
                  className={`w-full px-3 py-2 rounded-lg bg-slate-950 border text-white font-mono uppercase ${
                    fleetFormErrors.initialCode ? 'border-rose-500 ring-1 ring-rose-500' : 'border-slate-800'
                  }`}
                />
                {fleetFormErrors.initialCode && (
                  <p className="text-[10px] text-rose-400 mt-1 flex items-center gap-1 font-medium">
                    <AlertCircle className="w-3 h-3 shrink-0" />
                    <span>{fleetFormErrors.initialCode}</span>
                  </p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-400 block mb-1">Merk Mobil</label>
                  <select
                    value={newFleet.brand}
                    onChange={(e) => {
                      const brand = e.target.value;
                      setNewFleet({
                        ...newFleet,
                        brand,
                        boxCapacityM3: getDefaultBoxCapacityM3(newFleet.vehicleType, brand),
                        boxDimensions: getDefaultBoxDimensions(newFleet.vehicleType, brand)
                      });
                    }}
                    className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-white cursor-pointer"
                  >
                    <option value="Mitsubishi L300">Mitsubishi L300</option>
                    <option value="Traga">Traga</option>
                    <option value="Mitsubishi Canter">Mitsubishi Canter</option>
                    <option value="Hino">Hino</option>
                    <option value="Isuzu">Isuzu</option>
                  </select>
                </div>
                <div>
                  <label className="text-slate-400 block mb-1">Kapasitas Mesin (CC)</label>
                  <input
                    type="text"
                    required
                    placeholder="Contoh: 2477 CC"
                    value={newFleet.engineCc}
                    onChange={(e) => setNewFleet({ ...newFleet, engineCc: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-400 block mb-1">Tahun Produksi</label>
                  <select
                    value={newFleet.year}
                    onChange={(e) => setNewFleet({ ...newFleet, year: parseInt(e.target.value) })}
                    className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-white cursor-pointer"
                  >
                    {Array.from({ length: new Date().getFullYear() - 1990 + 1 }, (_, i) => new Date().getFullYear() - i).map(y => (
                      <option key={y} value={y}>{y}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-slate-400 block mb-1 flex items-center justify-between">
                    <span>Kubikasi Box (m³)</span>
                    <span className="text-[10px] text-cyan-400 font-medium">Volume CBM</span>
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    min="1"
                    max="100"
                    required
                    placeholder="Contoh: 5.5"
                    value={newFleet.boxCapacityM3 || ''}
                    onChange={(e) => {
                      setNewFleet({ ...newFleet, boxCapacityM3: parseFloat(e.target.value) || 0 });
                      if (fleetFormErrors.boxCapacityM3) setFleetFormErrors({ ...fleetFormErrors, boxCapacityM3: '' });
                    }}
                    className={`w-full px-3 py-2 rounded-lg bg-slate-950 border text-white font-mono ${
                      fleetFormErrors.boxCapacityM3 ? 'border-rose-500 ring-1 ring-rose-500' : 'border-slate-800'
                    }`}
                  />
                  {fleetFormErrors.boxCapacityM3 && (
                    <p className="text-[10px] text-rose-400 mt-1 flex items-center gap-1 font-medium">
                      <AlertCircle className="w-3 h-3 shrink-0" />
                      <span>{fleetFormErrors.boxCapacityM3}</span>
                    </p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-400 block mb-1">Tanggal Terakhir Servis / Uji KIR</label>
                  <input
                    type="date"
                    value={newFleet.lastMaintenance}
                    onChange={(e) => setNewFleet({ ...newFleet, lastMaintenance: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-white"
                  />
                </div>
                <div>
                  <label className="text-slate-400 block mb-1">Dimensi Box (P x L x T)</label>
                  <input
                    type="text"
                    placeholder="Contoh: 2.4 x 1.6 x 1.4 m"
                    value={newFleet.boxDimensions || ''}
                    onChange={(e) => setNewFleet({ ...newFleet, boxDimensions: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-white font-mono"
                  />
                </div>
              </div>

              {/* Pajak Kendaraan & STNK / Plat */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-400 block mb-1 flex items-center justify-between">
                    <span>Pajak (Tahunan)</span>
                    <span className="text-[10px] text-blue-400 font-medium">Jatuh Tempo</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={newFleet.taxDueDate}
                    onChange={(e) => setNewFleet({ ...newFleet, taxDueDate: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-white"
                  />
                </div>
                <div>
                  <label className="text-slate-400 block mb-1 flex items-center justify-between">
                    <span>STNK / Plat</span>
                    <span className="text-[10px] text-amber-400 font-medium">Masa Berlaku 5 Thn</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={newFleet.stnkExpiryDate}
                    onChange={(e) => setNewFleet({ ...newFleet, stnkExpiryDate: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-white"
                  />
                </div>
              </div>

              {/* PIC atau Kru yang Ditugaskan */}
              <div className="bg-slate-950/70 p-3 rounded-lg border border-slate-800/80 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-slate-300 font-semibold flex items-center gap-1.5 text-xs">
                    <UserCheck className="w-4 h-4 text-blue-400" />
                    <span>PIC / Kru yang Ditugaskan (Opsional)</span>
                  </label>
                  {newFleetAssignedCrewId && (
                    <span className="text-[10px] text-emerald-400 font-bold bg-emerald-500/15 border border-emerald-500/30 px-2 py-0.5 rounded">
                      Terpilih
                    </span>
                  )}
                </div>

                <select
                  value={newFleetAssignedCrewId}
                  onChange={(e) => setNewFleetAssignedCrewId(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-white font-medium text-xs focus:ring-1 focus:ring-blue-500 focus:outline-none"
                >
                  <option value="">-- Standby / Pool Banyuwangi (Belum Ada PIC) --</option>
                  {crews.map(c => {
                    const isOther = c.currentFleetId;
                    const otherFleetObj = isOther ? fleets.find(f => f.id === c.currentFleetId) : null;
                    return (
                      <option key={c.id} value={c.id}>
                        {c.name} • {c.role} ({c.licenseType}){isOther ? ` [Tugas di ${otherFleetObj?.plateNumber || 'Armada Lain'}]` : ' [Standby/Ready]'}
                      </option>
                    );
                  })}
                </select>
                <p className="text-[10px] text-slate-400">
                  Tugaskan pengemudi atau helper penanggung jawab kendaraan ini sejak awal registrasi.
                </p>
              </div>

              </div>

              {/* Sticky Footer Daftarkan Armada */}
              <div className="p-4 border-t border-slate-800 bg-slate-950/95 shrink-0 flex items-center justify-between gap-3 shadow-lg z-10">
                <div className="text-[11px] text-slate-400 flex items-center gap-1.5 hidden sm:flex">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span>Armada baru otomatis terintegrasi ke sistem</span>
                </div>
                <div className="flex items-center gap-2 ml-auto">
                  <button
                    type="button"
                    onClick={() => setIsAddFleetOpen(false)}
                    className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs cursor-pointer transition"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white font-bold text-xs shadow-lg shadow-blue-500/25 flex items-center gap-2 cursor-pointer active:scale-95 transition"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Daftarkan &amp; Simpan Armada</span>
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Crew Modal */}
      {isAddCrewOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl w-full max-w-lg overflow-hidden shadow-2xl">
            <div className="p-4 border-b border-slate-800 flex items-center justify-between">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Users className="w-4 h-4 text-emerald-400" />
                Tambah Anggota Kru Pengemudi
              </h3>
              <button
                onClick={() => setIsAddCrewOpen(false)}
                className="text-slate-400 hover:text-white font-bold"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleCreateCrew} className="p-5 space-y-4 text-xs">
              <div>
                <label className="text-slate-400 block mb-1">Cabang Penugasan *</label>
                <select
                  value={newCrewBranchId}
                  onChange={(e) => setNewCrewBranchId(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-emerald-400 font-bold cursor-pointer mb-3"
                >
                  {branches.map(b => (
                    <option key={b.id} value={b.id}>Cabang {b.name} ({b.city})</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-slate-400 block mb-1">Nama Lengkap Kru</label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: Joko Supriyanto"
                  value={newCrew.name}
                  onChange={(e) => {
                    setNewCrew({ ...newCrew, name: e.target.value });
                    if (crewFormErrors.name) setCrewFormErrors({ ...crewFormErrors, name: '' });
                  }}
                  className={`w-full px-3 py-2 rounded-lg bg-slate-950 border text-white ${
                    crewFormErrors.name ? 'border-rose-500 ring-1 ring-rose-500' : 'border-slate-800'
                  }`}
                />
                {crewFormErrors.name && (
                  <p className="text-[10px] text-rose-400 mt-1 flex items-center gap-1 font-medium">
                    <AlertCircle className="w-3 h-3 shrink-0" />
                    <span>{crewFormErrors.name}</span>
                  </p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-400 block mb-1">Peran Tugas</label>
                  <select
                    value={newCrew.role}
                    onChange={(e) => {
                      const newRole = e.target.value as any;
                      setNewCrew({ ...newCrew, role: newRole });
                      if (crewFormErrors.role) setCrewFormErrors({ ...crewFormErrors, role: '' });
                    }}
                    className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-white cursor-pointer"
                  >
                    <option value="Driver Utama">Driver Utama</option>
                    <option value="Driver Cadangan">Driver Cadangan</option>
                    <option value="Kernet / Helper">Kernet / Helper</option>
                  </select>
                  {crewFormErrors.role && (
                    <p className="text-[10px] text-rose-400 mt-1 flex items-center gap-1 font-medium">
                      <AlertCircle className="w-3 h-3 shrink-0" />
                      <span>{crewFormErrors.role}</span>
                    </p>
                  )}
                </div>
                <div>
                  <label className="text-slate-400 block mb-1">Jenis SIM</label>
                  <input
                    type="text"
                    value="-"
                    disabled
                    className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-800 text-slate-500 cursor-not-allowed"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-400 block mb-1">Nomor Handphone / WhatsApp</label>
                  <input
                    type="text"
                    value="-"
                    disabled
                    className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-800 text-slate-500 cursor-not-allowed"
                  />
                </div>
                <div>
                  <label className="text-slate-400 block mb-1">Nomor Registrasi SIM</label>
                  <input
                    type="text"
                    value="-"
                    disabled
                    className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-800 text-slate-500 cursor-not-allowed"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsAddCrewOpen(false)}
                  className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold shadow"
                >
                  Simpan Data Kru
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Fleet Modal */}
      {isEditFleetOpen && editingFleet && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-hidden">
          <div className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden my-auto">
            <div className="p-4 border-b border-slate-800 flex items-center justify-between shrink-0 bg-slate-900/95">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Truck className="w-4 h-4 text-blue-400" />
                Edit Armada Truk ({editingFleet.plateNumber})
              </h3>
              <button
                type="button"
                onClick={() => {
                  setIsEditFleetOpen(false);
                  setEditingFleet(null);
                }}
                className="text-slate-400 hover:text-white font-bold text-lg p-1 rounded-lg hover:bg-slate-800 transition cursor-pointer"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleUpdateFleet} className="flex flex-col flex-1 min-h-0 overflow-hidden">
              <div className="p-5 space-y-4 text-xs overflow-y-auto flex-1 overscroll-contain">
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="text-slate-400 block mb-1">Cabang Armada *</label>
                  <select
                    value={editingFleetBranchId}
                    onChange={(e) => setEditingFleetBranchId(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-emerald-400 font-bold cursor-pointer"
                  >
                    {branches.map(b => (
                      <option key={b.id} value={b.id}>Cabang {b.name} ({b.city})</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-slate-400 block mb-1">Nomor Polisi (Plat)</label>
                  <input
                    type="text"
                    required
                    placeholder="Contoh: B 9503 XYZ"
                    value={editingFleet.plateNumber}
                    onChange={(e) => {
                      setEditingFleet({ ...editingFleet, plateNumber: e.target.value.toUpperCase() });
                      if (fleetFormErrors.plateNumber) setFleetFormErrors({ ...fleetFormErrors, plateNumber: '' });
                    }}
                    className={`w-full px-3 py-2 rounded-lg bg-slate-950 border text-white font-mono uppercase ${
                      fleetFormErrors.plateNumber ? 'border-rose-500 ring-1 ring-rose-500' : 'border-slate-800'
                    }`}
                  />
                  {fleetFormErrors.plateNumber && (
                    <p className="text-[10px] text-rose-400 mt-1 flex items-center gap-1 font-medium">
                      <AlertCircle className="w-3 h-3 shrink-0" />
                      <span>{fleetFormErrors.plateNumber}</span>
                    </p>
                  )}
                </div>
                <div>
                  <label className="text-slate-400 block mb-1">Tipe Kendaraan</label>
                  <select
                    value={editingFleet.vehicleType}
                    onChange={(e) => {
                      const vType = e.target.value as VehicleType;
                      setEditingFleet({
                        ...editingFleet,
                        vehicleType: vType,
                        boxCapacityM3: getDefaultBoxCapacityM3(vType, editingFleet.brand),
                        boxDimensions: getDefaultBoxDimensions(vType, editingFleet.brand)
                      });
                    }}
                    className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-white cursor-pointer"
                  >
                    <option value="Pick Up Box">Pick Up Box</option>
                    <option value="Engkel STD">Engkel STD</option>
                    <option value="Engkel Long">Engkel Long</option>
                    <option value="Double STD">Double STD</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-slate-400 block mb-1">Inisial Mobil</label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: N1 / NP1, WB-01, DS-1"
                  value={editingFleet.initialCode || ''}
                  onChange={(e) => {
                    setEditingFleet({ ...editingFleet, initialCode: e.target.value.toUpperCase() });
                    if (fleetFormErrors.initialCode) setFleetFormErrors({ ...fleetFormErrors, initialCode: '' });
                  }}
                  className={`w-full px-3 py-2 rounded-lg bg-slate-950 border text-white font-mono uppercase ${
                    fleetFormErrors.initialCode ? 'border-rose-500 ring-1 ring-rose-500' : 'border-slate-800'
                  }`}
                />
                {fleetFormErrors.initialCode && (
                  <p className="text-[10px] text-rose-400 mt-1 flex items-center gap-1 font-medium">
                    <AlertCircle className="w-3 h-3 shrink-0" />
                    <span>{fleetFormErrors.initialCode}</span>
                  </p>
                )}
              </div>

              {/* Status Kondisi Armada (Ready / Kirim / Servis) */}
              <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 space-y-2">
                <label className="text-slate-200 font-bold block text-xs">
                  Status Kondisi Armada (Terintegrasi Jadwal &amp; Portal)
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { value: 'available', label: 'Ready', desc: 'Siap jadwal esok', dot: 'bg-emerald-500', activeBg: 'bg-emerald-500/15 border-emerald-500 text-emerald-300' },
                    { value: 'on-duty', label: 'Kirim', desc: 'Sedang pengiriman', dot: 'bg-blue-500', activeBg: 'bg-blue-500/15 border-blue-500 text-blue-300' },
                    { value: 'maintenance', label: 'Servis', desc: 'Perbaikan (Kunci)', dot: 'bg-rose-500', activeBg: 'bg-rose-500/15 border-rose-500 text-rose-300' }
                  ].map(opt => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setEditingFleet({ ...editingFleet, status: opt.value as FleetStatus })}
                      className={`p-2.5 rounded-xl border text-left transition cursor-pointer ${
                        editingFleet.status === opt.value
                          ? opt.activeBg
                          : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-center gap-2 font-bold text-xs">
                        <span className={`w-3 h-3 rounded-full shrink-0 ${opt.dot}`} />
                        <span>{opt.label}</span>
                      </div>
                      <div className="text-[10px] opacity-80 mt-0.5">{opt.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-400 block mb-1">Merk Mobil</label>
                  <select
                    value={editingFleet.brand || 'Mitsubishi L300'}
                    onChange={(e) => {
                      const brand = e.target.value;
                      setEditingFleet({
                        ...editingFleet,
                        brand,
                        boxCapacityM3: getDefaultBoxCapacityM3(editingFleet.vehicleType, brand),
                        boxDimensions: getDefaultBoxDimensions(editingFleet.vehicleType, brand)
                      });
                    }}
                    className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-white cursor-pointer"
                  >
                    <option value="Mitsubishi L300">Mitsubishi L300</option>
                    <option value="Traga">Traga</option>
                    <option value="Mitsubishi Canter">Mitsubishi Canter</option>
                    <option value="Hino">Hino</option>
                    <option value="Isuzu">Isuzu</option>
                  </select>
                </div>
                <div>
                  <label className="text-slate-400 block mb-1">Kapasitas Mesin (CC)</label>
                  <input
                    type="text"
                    required
                    placeholder="Contoh: 2477 CC"
                    value={editingFleet.engineCc || ''}
                    onChange={(e) => setEditingFleet({ ...editingFleet, engineCc: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-400 block mb-1">Tahun Produksi</label>
                  <select
                    value={editingFleet.year || new Date().getFullYear()}
                    onChange={(e) => setEditingFleet({ ...editingFleet, year: parseInt(e.target.value) })}
                    className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-white"
                  >
                    {Array.from({ length: new Date().getFullYear() - 1990 + 1 }, (_, i) => new Date().getFullYear() - i).map(y => (
                      <option key={y} value={y}>{y}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-slate-400 block mb-1">Tanggal Terakhir Servis / Uji KIR</label>
                  <input
                    type="date"
                    value={editingFleet.lastMaintenance || ''}
                    onChange={(e) => setEditingFleet({ ...editingFleet, lastMaintenance: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-white"
                  />
                </div>
              </div>

              {/* 📦 KOTAK DIMENSI BOX: Luar vs Pengali Dimensi Dalam (...%) */}
              <div className="p-3.5 bg-slate-950/90 rounded-xl border border-cyan-500/35 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-cyan-300 text-xs flex items-center gap-1.5">
                    <Box className="w-4 h-4 text-cyan-400" />
                    <span>Dimensi Box Truk: Luar vs Pengali Dimensi Dalam</span>
                  </span>
                  <span className="text-[10px] text-slate-400">
                    Beda Tebal Dinding
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-slate-400 block mb-1">Dimensi Box Luar (P x L x T)</label>
                    <input
                      type="text"
                      placeholder="Contoh: 4.2 x 1.8 x 1.8 m"
                      value={editingFleet.boxDimensions || ''}
                      onChange={(e) => setEditingFleet({ ...editingFleet, boxDimensions: e.target.value })}
                      className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-white font-mono text-xs"
                    />
                  </div>
                  <div>
                    <label className="text-slate-400 block mb-1 flex items-center justify-between">
                      <span>Kubikasi Luar (m³)</span>
                      <span className="text-[10px] text-cyan-400 font-medium">Gross CBM</span>
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      min="1"
                      max="100"
                      required
                      placeholder="Contoh: 14.0"
                      value={editingFleet.boxCapacityM3 !== undefined ? editingFleet.boxCapacityM3 : getFleetBoxCapacity(editingFleet)}
                      onChange={(e) => {
                        const gross = parseFloat(e.target.value) || 0;
                        const mul = editingFleet.boxInnerMultiplierPercent !== undefined ? editingFleet.boxInnerMultiplierPercent : 90;
                        setEditingFleet({
                          ...editingFleet,
                          boxCapacityM3: gross,
                          boxInnerCapacityM3: Number((gross * (mul / 100)).toFixed(2))
                        });
                      }}
                      className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-white font-mono text-xs"
                    />
                  </div>
                </div>

                {/* Pengali Dimensi Dalam Box (... %) */}
                <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-800">
                  <div>
                    <label className="text-cyan-300 font-bold block mb-1 flex items-center justify-between text-xs">
                      <span>Faktor Pengali Dimensi Dalam</span>
                      <span className="text-amber-400 font-mono font-black">{editingFleet.boxInnerMultiplierPercent !== undefined ? editingFleet.boxInnerMultiplierPercent : 90}%</span>
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min="50"
                        max="100"
                        step="1"
                        required
                        value={editingFleet.boxInnerMultiplierPercent !== undefined ? editingFleet.boxInnerMultiplierPercent : 90}
                        onChange={(e) => {
                          const mul = parseInt(e.target.value) || 90;
                          const gross = editingFleet.boxCapacityM3 !== undefined ? editingFleet.boxCapacityM3 : getFleetBoxCapacity(editingFleet);
                          setEditingFleet({
                            ...editingFleet,
                            boxInnerMultiplierPercent: mul,
                            boxInnerCapacityM3: Number((gross * (mul / 100)).toFixed(2))
                          });
                        }}
                        className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-cyan-500/50 text-amber-300 font-mono font-black text-xs"
                        placeholder="90"
                      />
                      <span className="text-xs font-bold text-slate-400">%</span>
                    </div>
                    <span className="text-[10px] text-slate-500 mt-1 block">
                      Dimensi box dikali {editingFleet.boxInnerMultiplierPercent !== undefined ? editingFleet.boxInnerMultiplierPercent : 90}% karena tebal dinding luar &amp; dalam berbeda.
                    </span>
                  </div>

                  <div className="bg-cyan-950/40 p-2.5 rounded-lg border border-cyan-500/40 flex flex-col justify-between">
                    <span className="text-[10px] font-bold text-cyan-300">
                      Hasil Kubikasi Dalam (Netto):
                    </span>
                    <div className="text-lg font-black text-white font-mono">
                      {editingFleet.boxInnerCapacityM3 !== undefined
                        ? editingFleet.boxInnerCapacityM3
                        : Number(((editingFleet.boxCapacityM3 || getFleetBoxCapacity(editingFleet)) * ((editingFleet.boxInnerMultiplierPercent || 90) / 100)).toFixed(2))} <span className="text-xs text-cyan-400">m³</span>
                    </div>
                    <span className="text-[10px] text-emerald-400 font-medium">
                      ✓ Kapasitas bersih efektif muat
                    </span>
                  </div>
                </div>
              </div>

              {/* 📑 BUKTI FILE DOKUMEN KIR PADA SETIAP ARMADA */}
              <div className="p-3.5 bg-slate-950/90 rounded-xl border border-teal-500/35 space-y-2.5">
                <div className="flex items-center justify-between">
                  <label className="font-bold text-teal-300 text-xs flex items-center gap-1.5">
                    <FileText className="w-4 h-4 text-teal-400" />
                    <span>Bukti File Dokumen KIR Dishub</span>
                  </label>
                  <span className="text-[10px] text-slate-400">
                    Cek Benar / Legalitas Armada
                  </span>
                </div>

                {editingFleet.kirDocUrl ? (
                  <div className="flex items-center justify-between p-2.5 rounded-lg bg-slate-900 border border-slate-800">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <img
                        src={editingFleet.kirDocUrl}
                        alt="Thumbnail KIR"
                        className="w-10 h-10 object-cover rounded border border-slate-700 shrink-0"
                      />
                      <div className="min-w-0">
                        <span className="font-bold text-white text-xs block truncate">
                          {editingFleet.kirDocFileName || 'Dokumen_KIR_Dishub.jpg'}
                        </span>
                        <span className="text-[10px] text-emerald-400 font-medium">
                          ✓ File KIR terlampir resmi
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => setSelectedKirDocFleet(editingFleet)}
                        className="px-2 py-1 rounded text-[10px] font-bold bg-cyan-600/20 text-cyan-300 hover:bg-cyan-600/30 border border-cyan-500/40 cursor-pointer"
                      >
                        Pratinjau
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingFleet({ ...editingFleet, kirDocUrl: '', kirDocFileName: '' })}
                        className="px-2 py-1 rounded text-[10px] font-bold bg-rose-500/20 text-rose-300 hover:bg-rose-500/30 border border-rose-500/40 cursor-pointer"
                      >
                        Hapus
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <input
                      type="file"
                      accept="image/*,.pdf"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          const reader = new FileReader();
                          reader.onload = (ev) => {
                            setEditingFleet({
                              ...editingFleet,
                              kirDocUrl: ev.target?.result as string,
                              kirDocFileName: file.name,
                              kirDocUploadedAt: new Date().toISOString()
                            });
                          };
                          reader.readAsDataURL(file);
                        }
                      }}
                      className="w-full text-xs text-slate-400 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-bold file:bg-teal-600 file:text-white hover:file:bg-teal-500 cursor-pointer"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        setEditingFleet({
                          ...editingFleet,
                          kirDocUrl: 'https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?w=800&auto=format&fit=crop&q=80',
                          kirDocFileName: `Buku_Uji_KIR_Dishub_${editingFleet.plateNumber.replace(/\s+/g, '_')}.jpg`,
                          kirDocUploadedAt: new Date().toISOString()
                        });
                      }}
                      className="text-[10px] text-teal-400 hover:text-teal-300 underline font-medium cursor-pointer block"
                    >
                      + Gunakan Contoh Sampel File KIR Resmi Dishub
                    </button>
                  </div>
                )}
              </div>

              {/* Pajak Kendaraan & STNK / Plat */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-400 block mb-1 flex items-center justify-between">
                    <span>Pajak (Tahunan)</span>
                    <span className="text-[10px] text-blue-400 font-medium">Jatuh Tempo</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={editingFleet.taxDueDate || ''}
                    onChange={(e) => setEditingFleet({ ...editingFleet, taxDueDate: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-white font-mono"
                  />
                  {editingFleet.taxDueDate && (
                    <div className="text-[10px] text-blue-400 mt-1 font-medium flex items-center justify-between">
                      <span>{formatIndoDate(editingFleet.taxDueDate)}</span>
                      <span>{getExpiryStatus(editingFleet.taxDueDate).label}</span>
                    </div>
                  )}
                </div>
                <div>
                  <label className="text-slate-400 block mb-1 flex items-center justify-between">
                    <span>STNK / Plat</span>
                    <span className="text-[10px] text-amber-400 font-medium">Masa Berlaku 5 Thn</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={editingFleet.stnkExpiryDate || ''}
                    onChange={(e) => setEditingFleet({ ...editingFleet, stnkExpiryDate: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-white font-mono"
                  />
                  {editingFleet.stnkExpiryDate && (
                    <div className="text-[10px] text-amber-400 mt-1 font-medium flex items-center justify-between">
                      <span>{formatIndoDate(editingFleet.stnkExpiryDate)}</span>
                      <span>{getExpiryStatus(editingFleet.stnkExpiryDate).label}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* PIC atau Kru yang Ditugaskan */}
              <div className="bg-slate-950/75 p-3.5 rounded-xl border border-slate-800/80 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-slate-200 font-bold flex items-center gap-2 text-xs">
                    <UserCheck className="w-4 h-4 text-blue-400" />
                    <span>PIC / Kru yang Ditugaskan (Driver Utama)</span>
                  </label>
                  {editingAssignedCrewId ? (
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                      Terkait Aktif
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-800 text-slate-400 border border-slate-700">
                      Standby / Pool
                    </span>
                  )}
                </div>

                <select
                  value={editingAssignedCrewId}
                  onChange={(e) => setEditingAssignedCrewId(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-lg bg-slate-900 border border-slate-700 text-white font-medium text-xs focus:ring-1 focus:ring-blue-500 focus:outline-none"
                >
                  <option value="">-- Standby / Pool Banyuwangi (Belum Ada PIC Khusus) --</option>
                  {crews.map(c => {
                    const isCurrentThis = (c.currentFleetId === editingFleet.id || c.id === editingFleet.driverId);
                    const isOtherFleet = c.currentFleetId && c.currentFleetId !== editingFleet.id;
                    const otherFleetObj = isOtherFleet ? fleets.find(f => f.id === c.currentFleetId) : null;
                    return (
                      <option key={c.id} value={c.id}>
                        {c.name} • {c.role} ({c.licenseType}){isCurrentThis ? ' [PIC Saat Ini]' : isOtherFleet ? ` [Ditugaskan di ${otherFleetObj?.plateNumber || 'Armada Lain'}]` : ' [Standby/Ready]'}
                      </option>
                    );
                  })}
                </select>

                {editingAssignedCrewId ? (() => {
                  const selCrew = crews.find(c => c.id === editingAssignedCrewId);
                  if (!selCrew) return null;
                  return (
                    <div className="flex items-center justify-between text-[11px] bg-slate-900/80 p-2.5 rounded-lg border border-slate-800 text-slate-300">
                      <div className="flex items-center gap-2">
                        <Phone className="w-3.5 h-3.5 text-blue-400" />
                        <span>{selCrew.phone || '-'}</span>
                        <span className="text-slate-600">&bull;</span>
                        <span className="text-emerald-400 font-semibold">{selCrew.licenseType}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-slate-400">{selCrew.tripsCompleted || 0} rit sukses</span>
                        <div className="flex items-center gap-1 text-amber-400 font-bold text-[10px]">
                          <Award className="w-3 h-3" />
                          <span>{selCrew.rating.toFixed(1)} / 5.0</span>
                        </div>
                      </div>
                    </div>
                  );
                })() : (
                  <p className="text-[10px] text-slate-400">
                    Pilih supir atau helper yang menjadi penanggung jawab operasional armada ini. Kru terpilih otomatis terhubung sebagai PIC resmi dan sinkron di dashboard serta histori penugasan.
                  </p>
                )}
              </div>

              </div>

              {/* Sticky Footer Simpan Perubahan */}
              <div className="p-4 border-t border-slate-800 bg-slate-950/95 shrink-0 flex items-center justify-between gap-3 shadow-lg z-10">
                <div className="text-[11px] text-slate-400 flex items-center gap-1.5 hidden sm:flex">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span>Perubahan dimensi &amp; KIR langsung tersimpan</span>
                </div>
                <div className="flex items-center gap-2 ml-auto">
                  <button
                    type="button"
                    onClick={() => {
                      setIsEditFleetOpen(false);
                      setEditingFleet(null);
                    }}
                    className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs cursor-pointer transition"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white font-bold text-xs shadow-lg shadow-blue-500/25 flex items-center gap-2 cursor-pointer active:scale-95 transition"
                  >
                    <Save className="w-4 h-4" />
                    <span>Simpan Perubahan Armada</span>
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Crew Modal */}
      {isEditCrewOpen && editingCrew && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl w-full max-w-lg overflow-hidden shadow-2xl">
            <div className="p-4 border-b border-slate-800 flex items-center justify-between">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Users className="w-4 h-4 text-emerald-400" />
                Edit Data Kru ({editingCrew.name})
              </h3>
              <button
                onClick={() => {
                  setIsEditCrewOpen(false);
                  setEditingCrew(null);
                }}
                className="text-slate-400 hover:text-white font-bold text-lg cursor-pointer"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleUpdateCrew} className="p-5 space-y-4 text-xs">
              <div>
                <label className="text-slate-400 block mb-1">Cabang Penugasan *</label>
                <select
                  value={editingCrewBranchId}
                  onChange={(e) => setEditingCrewBranchId(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-emerald-400 font-bold cursor-pointer mb-3"
                >
                  {branches.map(b => (
                    <option key={b.id} value={b.id}>Cabang {b.name} ({b.city})</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-slate-400 block mb-1">Nama Lengkap Kru</label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: Joko Supriyanto"
                  value={editingCrew.name}
                  onChange={(e) => setEditingCrew({ ...editingCrew, name: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-white"
                />
              </div>

              <div>
                <label className="text-slate-400 block mb-1">Peran Tugas</label>
                <select
                  value={editingCrew.role}
                  onChange={(e) => setEditingCrew({ ...editingCrew, role: e.target.value as any })}
                  className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-white"
                >
                  <option value="Driver Utama">Driver Utama</option>
                  <option value="Driver Cadangan">Driver Cadangan</option>
                  <option value="Kernet / Helper">Kernet / Helper</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-400 block mb-1">Jenis SIM</label>
                  <input type="text" value="-" disabled className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-800 text-slate-500 cursor-not-allowed" />
                </div>
                <div>
                  <label className="text-slate-400 block mb-1">Nomor Handphone / WhatsApp</label>
                  <input type="text" value="-" disabled className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-800 text-slate-500 cursor-not-allowed" />
                </div>
              </div>

              <div>
                <label className="text-slate-400 block mb-1">Nomor Registrasi SIM</label>
                <input type="text" value="-" disabled className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-800 text-slate-500 cursor-not-allowed" />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => {
                    setIsEditCrewOpen(false);
                    setEditingCrew(null);
                  }}
                  className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold shadow cursor-pointer"
                >
                  Simpan Perubahan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Pop-up Warning Konfirmasi Hapus Kru Supir & Helper */}
      {crewToDelete && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150"
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-delete-crew-title"
        >
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl">
            {/* Header Dialog */}
            <div className="p-5 border-b border-slate-800/80 bg-slate-950/50 flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-rose-500/20 border border-rose-500/30 flex items-center justify-center text-rose-400 shrink-0">
                  <AlertTriangle className="w-5 h-5 text-rose-400" />
                </div>
                <div>
                  <h3 id="modal-delete-crew-title" className="text-base font-bold text-white">
                    Konfirmasi Hapus Kru
                  </h3>
                  <p className="text-xs text-slate-400">
                    Penghapusan data Supir & Kernet / Helper
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setCrewToDelete(null)}
                className="text-slate-400 hover:text-white rounded-lg p-1.5 hover:bg-slate-800 transition cursor-pointer text-base leading-none"
                aria-label="Tutup"
              >
                &times;
              </button>
            </div>

            {/* Content Body */}
            <div className="p-5 space-y-4">
              {/* Warning Notice Box */}
              <div className="bg-rose-500/10 border border-rose-500/25 rounded-xl p-3.5 flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
                <div className="text-xs space-y-1">
                  <p className="font-bold text-rose-300">
                    Yakin ingin menghapus kru ini?
                  </p>
                  <p className="text-slate-300 leading-relaxed">
                    Data kru supir/helper akan dihapus secara permanen dari sistem operasional armada PT Anugrah Kemasan Kreatif.
                  </p>
                </div>
              </div>

              {/* Kru Details Card */}
              <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-4 space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-blue-400 font-bold text-base shrink-0">
                    {crewToDelete.name.substring(0, 2).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="text-sm font-bold text-white truncate">{crewToDelete.name}</h4>
                      <span className={`px-2 py-0.5 rounded-md text-[10px] font-semibold border ${
                        crewToDelete.role === 'Driver Utama'
                          ? 'bg-blue-500/15 text-blue-400 border-blue-500/30'
                          : crewToDelete.role === 'Driver Cadangan'
                          ? 'bg-purple-500/15 text-purple-400 border-purple-500/30'
                          : 'bg-amber-500/15 text-amber-400 border-amber-500/30'
                      }`}>
                        {crewToDelete.role}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5 flex items-center gap-1.5">
                      <Phone className="w-3 h-3 text-slate-500" />
                      <span>{crewToDelete.phone}</span>
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-800/80 text-xs">
                  <div className="bg-slate-900/80 p-2.5 rounded-lg border border-slate-800">
                    <span className="text-slate-400 text-[10px] block">Sertifikasi SIM</span>
                    <span className="font-semibold text-emerald-400 text-xs mt-0.5 block">{crewToDelete.licenseType}</span>
                    <span className="text-[10px] text-slate-500 font-mono mt-0.5 block truncate">{crewToDelete.licenseNumber}</span>
                  </div>
                  <div className="bg-slate-900/80 p-2.5 rounded-lg border border-slate-800">
                    <span className="text-slate-400 text-[10px] block">Total Penugasan</span>
                    <span className="font-semibold text-white text-xs mt-0.5 block">{crewToDelete.tripsCompleted} Trip Sukses</span>
                    <span className="text-[10px] text-amber-400 font-semibold mt-0.5 block">★ {crewToDelete.rating.toFixed(1)} / 5.0</span>
                  </div>
                </div>

                {crewToDelete.status === 'on-duty' ? (
                  <div className="p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/25 text-amber-300 text-xs flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                    <span><strong>Perhatian:</strong> Kru saat ini tercatat <strong>Sedang Jalan</strong>. Pastikan tugas armada telah dialihkan sebelum dihapus.</span>
                  </div>
                ) : (
                  <div className="px-3 py-1.5 rounded-lg bg-slate-900/60 border border-slate-800 text-[11px] text-slate-400 flex items-center justify-between">
                    <span>Status Operasional:</span>
                    <span className="font-semibold text-slate-300">
                      {crewToDelete.status === 'available' ? '● Ready / Siap Jalan' : '○ Libur / Off'}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Footer Buttons */}
            <div className="p-4 bg-slate-950/60 border-t border-slate-800 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setCrewToDelete(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-300 hover:text-white text-xs font-semibold transition cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteCrew}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold shadow-lg shadow-rose-600/20 flex items-center gap-1.5 transition cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Ya, Hapus Kru</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Pop-up Warning Konfirmasi Hapus Armada Kendaraan */}
      {fleetToDelete && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150"
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-delete-fleet-title"
        >
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl">
            <div className="p-5 border-b border-slate-800/80 bg-slate-950/50 flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-rose-500/20 border border-rose-500/30 flex items-center justify-center text-rose-400 shrink-0">
                  <AlertTriangle className="w-5 h-5 text-rose-400" />
                </div>
                <div>
                  <h3 id="modal-delete-fleet-title" className="text-base font-bold text-white">
                    Konfirmasi Hapus Armada
                  </h3>
                  <p className="text-xs text-slate-400">
                    Penghapusan unit kendaraan logistik
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setFleetToDelete(null)}
                className="text-slate-400 hover:text-white rounded-lg p-1.5 hover:bg-slate-800 transition cursor-pointer text-base leading-none"
                aria-label="Tutup"
              >
                &times;
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div className="bg-rose-500/10 border border-rose-500/25 rounded-xl p-3.5 flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
                <div className="text-xs space-y-1">
                  <p className="font-bold text-rose-300">
                    Yakin ingin menghapus armada ini?
                  </p>
                  <p className="text-slate-300 leading-relaxed">
                    Unit kendaraan logistik ini akan dihapus dari daftar operasional aktif PT Anugrah Kemasan Kreatif.
                  </p>
                </div>
              </div>

              <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-4 space-y-2.5">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase tracking-wider block">Nomor Polisi</span>
                    <h4 className="text-lg font-black text-white font-mono tracking-wider">{fleetToDelete.plateNumber}</h4>
                  </div>
                  <span className="px-2.5 py-1 rounded-md text-xs font-semibold bg-blue-500/15 text-blue-400 border border-blue-500/30">
                    {fleetToDelete.vehicleType}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs pt-2 border-t border-slate-800/80">
                  <div className="bg-slate-900/60 p-2 rounded-lg border border-slate-800 text-[11px]">
                    <span className="text-slate-400 text-[10px] block">Inisial Unit</span>
                    <span className="font-bold text-white">{fleetToDelete.initialCode || '-'}</span>
                  </div>
                  <div className="bg-slate-900/60 p-2 rounded-lg border border-slate-800 text-[11px]">
                    <span className="text-slate-400 text-[10px] block">Merk / Tipe</span>
                    <span className="font-bold text-white">{fleetToDelete.brand || '-'}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="p-4 bg-slate-950/60 border-t border-slate-800 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setFleetToDelete(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-300 hover:text-white text-xs font-semibold transition cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteFleet}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold shadow-lg shadow-rose-600/20 flex items-center gap-1.5 transition cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Ya, Hapus Armada</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
