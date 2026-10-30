import React, { useState, useEffect, useMemo } from 'react';
import {
  History,
  CheckCircle2,
  Search,
  MapPin,
  Truck,
  Sliders,
  RotateCcw,
  FileDown,
  Users,
  AlertTriangle,
  Eye,
  LayoutGrid,
  ListFilter,
  Calendar
} from 'lucide-react';
import { Crew, CrewDeliveryHistory, AreaApprovalRequest, Fleet } from '../types';
import { logisticsStore } from '../services/store';
import { AreaApprovalModal } from './AreaApprovalModal';
import { CrewReportDownloadModal } from './CrewReportDownloadModal';
import {
  UiCard,
  UiCollapsibleSidebar,
  UiWidget,
  UiPopover,
  UiToggleSwitch,
  UiTextField,
  UiAccordionItem,
  UiBadge,
  UiProgressBar
} from './ui/UiPrimitives';
import { branchStore, BranchRecord } from '../services/branchStore';

export const CrewDeliveryHistoryView: React.FC = () => {
  const [crews, setCrews] = useState<Crew[]>(logisticsStore.getCrews());
  const [fleets, setFleets] = useState<Fleet[]>(logisticsStore.getFleets());
  const [history, setHistory] = useState<CrewDeliveryHistory[]>(logisticsStore.getCrewDeliveryHistory());
  const [, setApprovalRequests] = useState<AreaApprovalRequest[]>(logisticsStore.getAreaApprovalRequests());
  const [threshold, setThreshold] = useState<number>(logisticsStore.getAreaDeliveryThreshold());
  const [isReportModalOpen, setIsReportModalOpen] = useState<boolean>(false);
  const [branches, setBranches] = useState<BranchRecord[]>(() => branchStore.getActiveBranches());
  const [selectedBranchId, setSelectedBranchId] = useState<string>(() => branchStore.getSelectedOriginBranchId());

  useEffect(() => {
    return branchStore.subscribe(() => {
      setBranches(branchStore.getActiveBranches());
      setSelectedBranchId(branchStore.getSelectedOriginBranchId());
    });
  }, []);

  // Filter & Search States (Text Fields & Selectors)
  const [selectedCrewId, setSelectedCrewId] = useState<string>('all');
  const [selectedFleetFilter, setSelectedFleetFilter] = useState<string>('all');
  const [selectedMonth, setSelectedMonth] = useState<number>(0); // Default Januari (0)
  const [selectedYear, setSelectedYear] = useState<number>(2026);
  const [selectedAreaFilter, setSelectedAreaFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [areaQuickFilter, setAreaQuickFilter] = useState<string>('');
  const [activeSubTab, setActiveSubTab] = useState<'area_stats' | 'fleet_stats' | 'kanvas_lkt'>('area_stats');

  // Toggle Switches States
  const [isFilterSidebarOpen, setIsFilterSidebarOpen] = useState<boolean>(true);
  const [useAccordionLayout, setUseAccordionLayout] = useState<boolean>(true);
  const [onlyExceededFilter, setOnlyExceededFilter] = useState<boolean>(false);
  const [autoSyncEnabled, setAutoSyncEnabled] = useState<boolean>(true);

  // Accordion Expanded State (Single or Multiple)
  const [expandedIds, setExpandedIds] = useState<Record<string, boolean>>({});

  // Popover State (Dismissed by clicking outside, locks scroll)
  const [popoverData, setPopoverData] = useState<{
    isOpen: boolean;
    title: string;
    subtitle: string;
    crewName?: string;
    crewId?: string;
    areaName: string;
    tripCount: number;
    maxLimit: number;
    trips: CrewDeliveryHistory[];
  } | null>(null);

  const [isThresholdPopoverOpen, setIsThresholdPopoverOpen] = useState<boolean>(false);

  // Interactive Approval Modal State
  const [modalData, setModalData] = useState<{
    isOpen: boolean;
    crewName: string;
    crewId: string;
    areaName: string;
    storeName: string;
    plateNumber: string;
    tripCount: number;
    threshold: number;
    recentTrips: CrewDeliveryHistory[];
    requestId?: string;
  }>({
    isOpen: false,
    crewName: '',
    crewId: '',
    areaName: '',
    storeName: '',
    plateNumber: '',
    tripCount: 0,
    threshold: 3,
    recentTrips: []
  });

  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);

  useEffect(() => {
    if (autoSyncEnabled) {
      logisticsStore.syncSchedulesToCrewHistory();
    }
    const latestHistory = logisticsStore.getCrewDeliveryHistory();
    setHistory(latestHistory);
    setCrews(logisticsStore.getCrews());

    return logisticsStore.subscribe(() => {
      setCrews(logisticsStore.getCrews());
      setFleets(logisticsStore.getFleets());
      setHistory(logisticsStore.getCrewDeliveryHistory());
      setApprovalRequests(logisticsStore.getAreaApprovalRequests());
      setThreshold(logisticsStore.getAreaDeliveryThreshold());
    });
  }, [autoSyncEnabled]);

  const handleThresholdChange = (val: number) => {
    logisticsStore.setAreaDeliveryThreshold(val);
    setFeedbackMessage(`Batas maksimal rotasi pengiriman area diperbarui menjadi ${val}x kirim.`);
    setTimeout(() => setFeedbackMessage(null), 3000);
  };

  const handleManualSyncHistory = () => {
    const syncedCount = logisticsStore.syncSchedulesToCrewHistory();
    setHistory(logisticsStore.getCrewDeliveryHistory());
    setFeedbackMessage(`Sinkronisasi selesai (${syncedCount} entri jadwal diselaraskan ke histori kru).`);
    setTimeout(() => setFeedbackMessage(null), 3500);
  };

  const handleOpenSimulateApproval = (crewName: string, crewId: string, areaName: string, tripCount: number) => {
    const areaTrips = history.filter(
      h => (h.crewId === crewId || h.crewName === crewName) && h.area.toLowerCase() === areaName.toLowerCase()
    );

    setModalData({
      isOpen: true,
      crewName,
      crewId,
      areaName,
      storeName: areaTrips[0]?.storeName || `Distribusi ${areaName}`,
      plateNumber: areaTrips[0]?.vehiclePlate || 'P 8125 VC',
      tripCount,
      threshold,
      recentTrips: areaTrips
    });
  };

  const handleOpenInspectPopover = (crewName: string, crewId: string, areaName: string, tripCount: number) => {
    const areaTrips = history.filter(
      h => (h.crewId === crewId || h.crewName === crewName) && h.area.toLowerCase() === areaName.toLowerCase()
    );
    setPopoverData({
      isOpen: true,
      title: `${areaName} · ${crewName}`,
      subtitle: `Rincian ${tripCount} perjalanan tercatat pada log operasional`,
      crewName,
      crewId,
      areaName,
      tripCount,
      maxLimit: threshold,
      trips: areaTrips
    });
  };

  const handleApproveFromModal = (notes: string) => {
    logisticsStore.createAreaApprovalRequest({
      crewId: modalData.crewId,
      crewName: modalData.crewName,
      targetArea: modalData.areaName,
      currentTripsInArea: modalData.tripCount,
      thresholdLimit: threshold,
      storeName: modalData.storeName,
      plateNumber: modalData.plateNumber,
      departureDate: new Date().toISOString(),
      status: 'approved',
      reasonPolicy: `Dispensasi rotasi wilayah ${modalData.areaName} untuk trip ke-${modalData.tripCount + 1}.`,
      notes
    });

    setModalData(prev => ({ ...prev, isOpen: false }));
    setFeedbackMessage(`Otorisasi rute ${modalData.areaName} untuk ${modalData.crewName} berhasil disimpan.`);
    setTimeout(() => setFeedbackMessage(null), 3500);
  };

  const toggleAccordion = (id: string) => {
    setExpandedIds(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  // Helper normalisasi string pencarian (menghapus spasi, garis miring '/', tanda hubung '-')
  // sehingga pencarian "n4/ns2", "n4 / ns2", "n4", atau "ns2" langsung cocok dengan "N4 / NS2"
  const normalizeSearchToken = (val?: string | null): string =>
    (val || '').toLowerCase().replace(/[\s/\-_·•]+/g, '');

  // Helper resolusi Armada lengkap dari katalog fleets
  const resolveCanonicalFleet = useMemo(() => {
    return (rawInitial?: string, rawPlate?: string) => {
      const cleanInit = (rawInitial || '').trim().toUpperCase();
      const cleanPlate = (rawPlate || '').trim().toUpperCase().replace(/\s+/g, '');

      const matched = fleets.find(f => {
        const fPlate = (f.plateNumber || '').trim().toUpperCase().replace(/\s+/g, '');
        if (cleanPlate && fPlate === cleanPlate) return true;
        const fInit = (f.initialCode || '').trim().toUpperCase();
        if (!cleanInit || !fInit) return false;
        if (fInit === cleanInit || normalizeSearchToken(fInit) === normalizeSearchToken(cleanInit)) return true;
        const parts = fInit.split('/').map(p => p.trim());
        return parts.includes(cleanInit);
      });

      if (matched) {
        return {
          initialCode: matched.initialCode || cleanInit || 'DS3',
          plateNumber: matched.plateNumber || rawPlate || '-',
          vehicleType: matched.vehicleType || 'Truk Box'
        };
      }

      return {
        initialCode: cleanInit || 'DS3',
        plateNumber: rawPlate || '-',
        vehicleType: 'Truk Box'
      };
    };
  }, [fleets]);

  // Filtered raw history list
  const filteredHistory = useMemo(() => {
    return history.filter(item => {
      const itemDate = new Date(item.completionDate);
      const matchesCrew = selectedCrewId === 'all' || item.crewId === selectedCrewId;
      const matchesArea =
        selectedAreaFilter === 'all' ||
        item.island === selectedAreaFilter ||
        item.area.toLowerCase().includes(selectedAreaFilter.toLowerCase());
      const matchesQuickArea =
        !areaQuickFilter.trim() ||
        item.area.toLowerCase().includes(areaQuickFilter.toLowerCase().trim());
      const matchesMonth = selectedMonth === -1 || itemDate.getMonth() === selectedMonth;
      const matchesYear = itemDate.getFullYear() === selectedYear;

      const rawInitial =
        item.initialCode || item.trackingNumber.match(/PO-AKK-\d+-([A-Za-z0-9]+)/)?.[1] || '';
      const resolvedFleet = resolveCanonicalFleet(rawInitial, item.vehiclePlate);

      const matchesFleetDropdown =
        selectedFleetFilter === 'all' ||
        normalizeSearchToken(resolvedFleet.initialCode) === normalizeSearchToken(selectedFleetFilter) ||
        normalizeSearchToken(rawInitial) === normalizeSearchToken(selectedFleetFilter) ||
        resolvedFleet.initialCode.toLowerCase().includes(selectedFleetFilter.toLowerCase()) ||
        item.vehiclePlate.toLowerCase().includes(selectedFleetFilter.toLowerCase());

      const q = searchQuery.toLowerCase().trim();
      const qNorm = normalizeSearchToken(q);

      const fleetFullText = `armada ${resolvedFleet.initialCode} ${rawInitial} ${resolvedFleet.plateNumber} ${item.vehiclePlate} ${resolvedFleet.vehicleType}`.toLowerCase();
      const fleetFullNorm = normalizeSearchToken(fleetFullText);

      const matchesSearch =
        !q ||
        item.crewName.toLowerCase().includes(q) ||
        normalizeSearchToken(item.crewName).includes(qNorm) ||
        fleetFullText.includes(q) ||
        (qNorm.length > 0 && fleetFullNorm.includes(qNorm)) ||
        item.area.toLowerCase().includes(q);

      const crewBranch = branchStore.getCrewBranch(item.crewId, item.crewName);
      const matchesBranch = selectedBranchId === 'ALL' || crewBranch.id === selectedBranchId;

      return (
        matchesBranch &&
        matchesCrew &&
        matchesFleetDropdown &&
        matchesArea &&
        matchesQuickArea &&
        matchesMonth &&
        matchesYear &&
        matchesSearch
      );
    });
  }, [history, selectedBranchId, selectedCrewId, selectedFleetFilter, selectedAreaFilter, areaQuickFilter, selectedMonth, selectedYear, searchQuery, resolveCanonicalFleet]);

  // Integrated Real-time Crew Area Stats from History Log
  const crewAreaStatsList = useMemo(() => {
    const map: Record<
      string,
      {
        crewId: string;
        crewName: string;
        role: string;
        totalTrips: number;
        exceededCount: number;
        maxSingleAreaTrips: number;
        fleetsUsed: Set<string>;
        areas: Record<string, { areaName: string; tripCount: number; isExceeded: boolean; lastDate: string }>;
      }
    > = {};

    filteredHistory.forEach(item => {
      const key = item.crewId || item.crewName;
      const rawInit = item.initialCode || item.trackingNumber.match(/PO-AKK-\d+-([A-Za-z0-9]+)/)?.[1] || '';
      const resolvedFl = resolveCanonicalFleet(rawInit, item.vehiclePlate);

      if (!map[key]) {
        map[key] = {
          crewId: item.crewId,
          crewName: item.crewName,
          role: item.notes?.includes('Helper') ? 'Kru Helper' : 'Driver Utama',
          totalTrips: 0,
          exceededCount: 0,
          maxSingleAreaTrips: 0,
          fleetsUsed: new Set<string>(),
          areas: {}
        };
      }
      if (resolvedFl.initialCode) {
        map[key].fleetsUsed.add(resolvedFl.initialCode);
      }
      map[key].totalTrips += 1;
      const areaKey = item.area;
      if (!map[key].areas[areaKey]) {
        map[key].areas[areaKey] = {
          areaName: areaKey,
          tripCount: 0,
          isExceeded: false,
          lastDate: item.completionDate
        };
      }
      map[key].areas[areaKey].tripCount += 1;
      if (item.completionDate > map[key].areas[areaKey].lastDate) {
        map[key].areas[areaKey].lastDate = item.completionDate;
      }
      map[key].areas[areaKey].isExceeded = map[key].areas[areaKey].tripCount >= threshold;
    });

    const list = Object.values(map).map(crew => {
      const areasArr = Object.values(crew.areas);
      const exceededCount = areasArr.filter(a => a.isExceeded).length;
      const maxSingleAreaTrips = areasArr.reduce((acc, a) => Math.max(acc, a.tripCount), 0);
      return {
        ...crew,
        fleetCodes: Array.from(crew.fleetsUsed),
        exceededCount,
        maxSingleAreaTrips
      };
    });

    const filteredByToggle = onlyExceededFilter
      ? list.filter(c => c.exceededCount > 0)
      : list;

    return filteredByToggle.sort((a, b) => b.totalTrips - a.totalTrips);
  }, [filteredHistory, threshold, onlyExceededFilter, resolveCanonicalFleet]);

  // Integrated Real-time Fleet (Inisial Mobil) Area Stats from History Log + Katalog Armada
  const fleetAreaStatsList = useMemo(() => {
    const map: Record<
      string,
      {
        initialCode: string;
        plateNumber: string;
        vehicleType: string;
        totalTrips: number;
        areas: Record<string, number>;
      }
    > = {};

    filteredHistory.forEach(item => {
      const rawInit =
        item.initialCode || item.trackingNumber.match(/PO-AKK-\d+-([A-Za-z0-9]+)/)?.[1] || 'DS3';
      const resolved = resolveCanonicalFleet(rawInit, item.vehiclePlate);
      const key = resolved.initialCode;

      if (!map[key]) {
        map[key] = {
          initialCode: resolved.initialCode,
          plateNumber: resolved.plateNumber || item.vehiclePlate,
          vehicleType: resolved.vehicleType || item.vehicleType,
          totalTrips: 0,
          areas: {}
        };
      }
      map[key].totalTrips += 1;
      map[key].areas[item.area] = (map[key].areas[item.area] || 0) + 1;
    });

    // Jika pengguna mencari kode armada tertentu (misal: n4/ns2) atau memilih filter armada yang kebetulan belum memiliki trip pada bulan terpilih, tetap tampilkan kartu armadanya
    const q = searchQuery.toLowerCase().trim();
    const qNorm = normalizeSearchToken(q);
    if (qNorm || selectedFleetFilter !== 'all') {
      fleets.forEach(fl => {
        const key = fl.initialCode || fl.plateNumber;
        if (map[key]) return;
        const flText = `armada ${fl.initialCode || ''} ${fl.plateNumber} ${fl.vehicleType}`.toLowerCase();
        const flNorm = normalizeSearchToken(flText);

        const matchDropdown =
          selectedFleetFilter === 'all' ||
          normalizeSearchToken(key) === normalizeSearchToken(selectedFleetFilter);
        const matchQuery =
          !q || flText.includes(q) || (qNorm.length > 0 && flNorm.includes(qNorm));

        if (matchDropdown && matchQuery) {
          map[key] = {
            initialCode: key,
            plateNumber: fl.plateNumber,
            vehicleType: fl.vehicleType,
            totalTrips: 0,
            areas: {}
          };
        }
      });
    }

    return Object.values(map).sort((a, b) => b.totalTrips - a.totalTrips);
  }, [filteredHistory, fleets, searchQuery, selectedFleetFilter, resolveCanonicalFleet]);

  // Deteksi apakah pengguna sedang mencari kode/nama Armada (misal: "n4/ns2", "n4", "ns2", "ds3", dll.) atau memilih Filter Armada
  const isSearchingOrFilteringArmada = useMemo(() => {
    if (selectedFleetFilter !== 'all') return true;
    const q = searchQuery.trim().toLowerCase();
    const qNorm = normalizeSearchToken(q);
    if (!qNorm) return false;
    return fleets.some(fl => {
      const fInit = (fl.initialCode || '').toLowerCase();
      const fPlate = (fl.plateNumber || '').toLowerCase();
      return (
        normalizeSearchToken(fInit).includes(qNorm) ||
        normalizeSearchToken(fPlate).includes(qNorm) ||
        `armada ${fInit}`.includes(q)
      );
    });
  }, [searchQuery, selectedFleetFilter, fleets]);

  // Global summary metrics for Widgets & Badges
  const totalExceededAreasCount = useMemo(() => {
    return crewAreaStatsList.reduce((sum, c) => sum + c.exceededCount, 0);
  }, [crewAreaStatsList]);

  const activeFiltersCount = useMemo(() => {
    let c = 0;
    if (selectedCrewId !== 'all') c++;
    if (selectedFleetFilter !== 'all') c++;
    if (selectedMonth !== -1) c++;
    if (searchQuery.trim()) c++;
    if (areaQuickFilter.trim()) c++;
    if (onlyExceededFilter) c++;
    return c;
  }, [selectedCrewId, selectedFleetFilter, selectedMonth, searchQuery, areaQuickFilter, onlyExceededFilter]);

  const complianceRate = useMemo(() => {
    const totalAreaPairs = crewAreaStatsList.reduce(
      (sum, c) => sum + Object.keys(c.areas).length,
      0
    );
    if (totalAreaPairs === 0) return 100;
    return Math.max(
      0,
      Math.round(((totalAreaPairs - totalExceededAreasCount) / totalAreaPairs) * 100)
    );
  }, [crewAreaStatsList, totalExceededAreasCount]);

  const kanvasLktHistoryList = useMemo(() => {
    const combined: Array<{
      id: string;
      dateStr: string;
      crewName: string;
      helperName: string;
      crewRole: string;
      plateNumber: string;
      areaName: string;
      statusLabel: string;
    }> = [];
    const seenKeys = new Set<string>();

    // 1. From CrewDeliveryHistory
    filteredHistory.forEach(h => {
      const areaVal = h.areaName || h.area || '';
      const storeVal = h.storeName || '';
      if (areaVal.toLowerCase().includes('kanvas') || storeVal.toLowerCase().includes('kanvas')) {
        const dStr = (h.deliveryDate || h.completionDate || '').slice(0, 10);
        const key = `${dStr}-${h.crewName.toLowerCase()}-${areaVal.toLowerCase()}`;
        if (!seenKeys.has(key)) {
          seenKeys.add(key);
          combined.push({
            id: h.id,
            dateStr: h.deliveryDate || h.completionDate,
            crewName: h.crewName,
            helperName: '-',
            crewRole: h.crewRole || (h.notes?.includes('Helper') ? 'Kru Helper' : 'Driver Utama'),
            plateNumber: h.plateNumber || h.initialCode || h.vehiclePlate || 'NP1',
            areaName: areaVal || 'KANVAS LKT',
            statusLabel: 'Selesai / Tercatat'
          });
        }
      }
    });

    // 2. From Active Operational Schedules
    const allSchedules = logisticsStore.getSchedules();
    allSchedules.forEach(s => {
      const areaVal = s.areaName || s.store?.storeName || '';
      if (areaVal.toLowerCase().includes('kanvas')) {
        const dDate = new Date(s.departureDate);
        if (selectedMonth !== -1 && dDate.getMonth() !== selectedMonth) return;
        if (dDate.getFullYear() !== selectedYear) return;
        const driverName = s.crew?.name || 'Driver Kanvas';
        const dStr = s.departureDate.slice(0, 10);
        const key = `${dStr}-${driverName.toLowerCase()}-${areaVal.toLowerCase()}`;
        if (!seenKeys.has(key)) {
          seenKeys.add(key);
          combined.push({
            id: s.id,
            dateStr: s.departureDate,
            crewName: driverName,
            helperName: (s as any).helperName || (s.crew as any)?.helperName || '-',
            crewRole: 'Driver Utama',
            plateNumber: s.fleet?.initialCode || s.fleet?.plateNumber || 'NP1',
            areaName: areaVal.toUpperCase(),
            statusLabel: s.status === 'delivered' ? 'Selesai Kirim' : 'Terjadwal & Tercatat'
          });
        }
      }
    });

    // 3. From Cached Admin Schedule Weeks (if present)
    try {
      const rawWeeks = localStorage.getItem('akk_admin_schedule_weeks_cache');
      if (rawWeeks) {
        const parsedWeeks = JSON.parse(rawWeeks);
        if (Array.isArray(parsedWeeks)) {
          const effMo = selectedMonth === -1 ? 0 : selectedMonth;
          parsedWeeks.forEach((w: any) => {
            (w.days || []).forEach((d: any) => {
              (d.pengiriman || []).forEach((p: any, idx: number) => {
                const areaVal = String(p.area || '');
                if (areaVal.toLowerCase().includes('kanvas')) {
                  const dayPad = String(d.dayNumber || 1).padStart(2, '0');
                  const moPad = String(effMo + 1).padStart(2, '0');
                  const isoDate = `${selectedYear}-${moPad}-${dayPad}`;
                  const driverName = String(p.driver || 'Driver Kanvas');
                  const key = `${isoDate}-${driverName.toLowerCase()}-${areaVal.toLowerCase()}`;
                  if (!seenKeys.has(key)) {
                    seenKeys.add(key);
                    combined.push({
                      id: p.id || `kanvas-wk-${isoDate}-${idx}`,
                      dateStr: isoDate,
                      crewName: driverName,
                      helperName: p.helper || '-',
                      crewRole: 'Driver Utama',
                      plateNumber: p.armada || 'NP1',
                      areaName: areaVal.toUpperCase(),
                      statusLabel: 'Terjadwal & Tercatat'
                    });
                  }
                }
              });
            });
          });
        }
      }
    } catch {}

    return combined.sort((a, b) => new Date(b.dateStr).getTime() - new Date(a.dateStr).getTime());
  }, [filteredHistory, selectedMonth, selectedYear]);

  // Urutan & Rekomendasi Giliran Jadwal Kanvas Selanjutnya (Hanya Berlaku untuk User Role Driver yang Aktif)
  const kanvasDriverRotationQueue = useMemo(() => {
    const driverMap = new Map<string, {
      driverName: string;
      armada: string;
      kanvasCount: number;
      lastKanvasDate: string | null;
      lastKanvasArea: string | null;
      totalAllTrips: number;
    }>();

    // Ambil HANYA user dengan role === 'driver' dan status === 'approved' (Aktif) dari Manajemen User
    const activeDriverUsers = logisticsStore
      .getUsers()
      .filter(u => {
        const displayName = (u.fullName || (u as any).name || '').trim();
        return u.role === 'driver' && u.status === 'approved' && displayName && displayName !== '-';
      });

    const findMatchingDriverKey = (rawName: string): string | null => {
      const clean = rawName.trim().toLowerCase();
      if (!clean || clean === '-') return null;
      if (driverMap.has(clean)) return clean;
      const firstWord = clean.split(/\s+/)[0];
      for (const [k, val] of driverMap.entries()) {
        const kFirst = val.driverName.trim().toLowerCase().split(/\s+/)[0];
        if (k === clean || (firstWord.length >= 3 && kFirst === firstWord)) {
          return k;
        }
      }
      return null;
    };

    // Seed HANYA dari user role driver yang aktif
    activeDriverUsers.forEach(u => {
      const fullName = (u.fullName || (u as any).name || '').trim();
      const key = fullName.toLowerCase();
      if (!key || driverMap.has(key)) return;
      driverMap.set(key, {
        driverName: fullName,
        armada: '-',
        kanvasCount: 0,
        lastKanvasDate: null,
        lastKanvasArea: null,
        totalAllTrips: 0
      });
    });

    // Update totalAllTrips hanya untuk driver aktif yang sudah terdaftar di driverMap
    crewAreaStatsList.forEach(c => {
      const matchedKey = findMatchingDriverKey(c.crewName);
      if (!matchedKey) return;
      const existing = driverMap.get(matchedKey);
      if (existing) {
        existing.totalAllTrips = c.totalTrips;
      }
    });

    // Akumulasi riwayat perjalanan Kanvas hanya untuk driver aktif yang terdaftar di driverMap
    kanvasLktHistoryList.forEach(k => {
      if (k.crewRole && k.crewRole.toLowerCase().includes('helper')) return;
      const matchedKey = findMatchingDriverKey(k.crewName);
      if (!matchedKey) return;
      const existing = driverMap.get(matchedKey);
      if (existing) {
        existing.kanvasCount += 1;
        if (!existing.lastKanvasDate || new Date(k.dateStr).getTime() > new Date(existing.lastKanvasDate).getTime()) {
          existing.lastKanvasDate = k.dateStr;
          existing.lastKanvasArea = k.areaName;
        }
      }
    });

    // Urutkan sehingga driver aktif dengan jumlah Kanvas paling sedikit (atau paling lama belum Kanvas) berada di urutan #1
    return Array.from(driverMap.values()).sort((a, b) => {
      if (a.kanvasCount !== b.kanvasCount) {
        return a.kanvasCount - b.kanvasCount;
      }
      const timeA = a.lastKanvasDate ? new Date(a.lastKanvasDate).getTime() : 0;
      const timeB = b.lastKanvasDate ? new Date(b.lastKanvasDate).getTime() : 0;
      return timeA - timeB;
    });
  }, [crews, fleets, crewAreaStatsList, kanvasLktHistoryList]);

  return (
    <div className="space-y-3">
      {/* Top Action & Widget Strip (Compact & Padat) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
        <UiWidget
          kicker="Frekuensi Personel"
          title="Kru & Supir Terdata"
          icon={<Users className="w-4 h-4" />}
          action={<UiBadge count={crewAreaStatsList.length} variant="blue" title="Jumlah kru aktif" />}
        >
          <UiProgressBar
            value={complianceRate}
            max={100}
            label="Kepatuhan Rotasi Wilayah"
            valueLabel={`${complianceRate}%`}
            status={complianceRate >= 85 ? 'success' : complianceRate >= 65 ? 'warning' : 'danger'}
          />
        </UiWidget>

        <UiWidget
          kicker="Kontrol Batas Rotasi"
          title={`Batas Maksimal: ${threshold}x Kirim`}
          icon={<AlertTriangle className="w-4 h-4 text-amber-400" />}
          action={
            <UiBadge
              count={totalExceededAreasCount}
              variant={totalExceededAreasCount > 0 ? 'red' : 'emerald'}
              title="Jumlah area mencapai batas rotasi"
            />
          }
        >
          <div className="flex items-center justify-between gap-2 pt-1">
            <span className="text-[11px] text-slate-400">
              {totalExceededAreasCount > 0
                ? `${totalExceededAreasCount} rute perlu otorisasi`
                : 'Semua rute dalam batas aman'}
            </span>
            <button
              type="button"
              onClick={() => setIsThresholdPopoverOpen(true)}
              className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-[11px] font-semibold text-amber-300 transition cursor-pointer"
            >
              Atur Batas
            </button>
          </div>
        </UiWidget>

        <UiWidget
          kicker="Utilisasi Unit"
          title="Frekuensi Armada"
          icon={<Truck className="w-4 h-4 text-emerald-400" />}
          action={<UiBadge count={fleetAreaStatsList.length} variant="emerald" />}
        >
          <UiProgressBar
            value={filteredHistory.length}
            max={Math.max(filteredHistory.length, 30)}
            label="Total Perjalanan"
            valueLabel={`${filteredHistory.length} Trip`}
            status="normal"
          />
        </UiWidget>

        <UiWidget
          kicker="Dokumen & Sinkronisasi"
          title="Tindakan Cepat"
          icon={<History className="w-4 h-4 text-indigo-400" />}
        >
          <div className="flex items-center gap-2 pt-0.5">
            <button
              type="button"
              onClick={() => setIsReportModalOpen(true)}
              className="flex-1 px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-semibold transition flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <FileDown className="w-3.5 h-3.5" />
              <span>PDF Kinerja</span>
            </button>
            <button
              type="button"
              onClick={handleManualSyncHistory}
              className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] font-semibold transition flex items-center justify-center gap-1 cursor-pointer"
              title="Sinkronkan ulang jadwal ke histori"
            >
              <RotateCcw className="w-3.5 h-3.5 text-blue-400" />
              <span>Sync</span>
            </button>
          </div>
        </UiWidget>
      </div>

      {/* Feedback Banner */}
      {feedbackMessage && (
        <div className="px-4 py-2.5 rounded-xl bg-emerald-950/90 border border-emerald-600/50 text-emerald-200 text-xs flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{feedbackMessage}</span>
          </div>
          <button
            type="button"
            onClick={() => setFeedbackMessage(null)}
            className="text-emerald-400 hover:text-white font-bold text-xs cursor-pointer"
          >
            &times;
          </button>
        </div>
      )}

      {/* Main Workspace: Collapsible Filter & Konfigurasi Bar + Full-Width Content Viewport */}
      <div className="space-y-3">
        {/* 2. FILTER & KONFIGURASI (Full-width sleek bar when minimized, structured grid when expanded — no empty space below) */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 transition-all">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setIsFilterSidebarOpen(prev => !prev)}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 hover:border-blue-500/50 text-xs font-bold text-white transition cursor-pointer"
                title={isFilterSidebarOpen ? 'Sembunyikan Filter & Konfigurasi' : 'Tampilkan Filter & Konfigurasi'}
              >
                <Sliders className="w-3.5 h-3.5 text-blue-400" />
                <span>Filter &amp; Konfigurasi</span>
                {activeFiltersCount > 0 && (
                  <span className="px-1.5 py-0.2 rounded-full text-[10px] font-black bg-blue-600 text-white">
                    {activeFiltersCount}
                  </span>
                )}
              </button>

              {/* Ringkasan Filter Aktif saat Diminimize */}
              <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-slate-400">
                <span className="px-2 py-1 rounded-md bg-slate-950 border border-slate-800 font-medium text-slate-300">
                  Periode: {selectedMonth === -1 ? 'Semua Bulan' : new Date(0, selectedMonth).toLocaleString('id-ID', { month: 'short' })} {selectedYear}
                </span>
                {selectedCrewId !== 'all' && (
                  <span className="px-2 py-1 rounded-md bg-blue-500/15 border border-blue-500/30 font-semibold text-blue-300">
                    Kru Terfilter
                  </span>
                )}
                {selectedFleetFilter !== 'all' && (
                  <span className="px-2 py-1 rounded-md bg-amber-500/15 border border-amber-500/30 font-semibold text-amber-300">
                    Armada: {selectedFleetFilter}
                  </span>
                )}
                {onlyExceededFilter && (
                  <span className="px-2 py-1 rounded-md bg-amber-500/15 border border-amber-500/30 font-semibold text-amber-300">
                    &ge; {threshold}x Kirim
                  </span>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2">
              {!isFilterSidebarOpen && (
                <div className="relative hidden sm:block w-56">
                  <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Cari kru / armada..."
                    className="w-full pl-8 pr-2.5 py-1 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-200 focus:outline-none focus:border-blue-500"
                  />
                </div>
              )}

              {activeFiltersCount > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    setSelectedCrewId('all');
                    setSelectedFleetFilter('all');
                    setSelectedMonth(0);
                    setSelectedAreaFilter('all');
                    setSearchQuery('');
                    setAreaQuickFilter('');
                    setOnlyExceededFilter(false);
                  }}
                  className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] font-semibold transition cursor-pointer"
                >
                  Reset ({activeFiltersCount})
                </button>
              )}

              <button
                type="button"
                onClick={() => setIsFilterSidebarOpen(prev => !prev)}
                className={`px-3 py-1.5 rounded-lg text-[11px] font-bold transition cursor-pointer ${
                  isFilterSidebarOpen
                    ? 'bg-slate-800 hover:bg-slate-700 text-slate-300'
                    : 'bg-blue-600 hover:bg-blue-500 text-white'
                }`}
              >
                {isFilterSidebarOpen ? 'Minimize Filter' : 'Buka Filter'}
              </button>
            </div>
          </div>

          {isFilterSidebarOpen && (
            <div className="pt-3 mt-3 border-t border-slate-800 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3 items-start">
              {/* Kolom 1: Pencarian Teks */}
              <div className="space-y-2.5">
                <UiTextField
                  label="Pencarian Nama Kru / Armada"
                  value={searchQuery}
                  onChange={setSearchQuery}
                  placeholder="Ketik nama kru atau armada (misal: N4/NS2)..."
                  icon={<Search className="w-3.5 h-3.5" />}
                />
                <UiTextField
                  label="Filter Nama Area Kirim"
                  value={areaQuickFilter}
                  onChange={setAreaQuickFilter}
                  placeholder="Contoh: Denpasar, Purwo..."
                  icon={<MapPin className="w-3.5 h-3.5" />}
                />
              </div>

              {/* Kolom 2: Periode & Personel Kru */}
              <div className="space-y-2.5">
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <label className="block text-[11px] font-medium text-slate-400">Bulan</label>
                    <select
                      value={selectedMonth}
                      onChange={(e) => setSelectedMonth(Number(e.target.value))}
                      className="w-full px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-200 focus:outline-none focus:border-blue-500"
                    >
                      <option value={-1}>Semua Bulan</option>
                      {Array.from({ length: 12 }).map((_, i) => (
                        <option key={'month-' + i} value={i}>
                          {new Date(0, i).toLocaleString('id-ID', { month: 'long' })}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="block text-[11px] font-medium text-slate-400">Tahun</label>
                    <select
                      value={selectedYear}
                      onChange={(e) => setSelectedYear(Number(e.target.value))}
                      className="w-full px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-200 focus:outline-none focus:border-blue-500"
                    >
                      {Array.from({ length: 5 }).map((_, i) => (
                        <option key={'year-' + i} value={2024 + i}>
                          {2024 + i}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="block text-[11px] font-medium text-slate-400">Pilih Personel Kru</label>
                  <select
                    value={selectedCrewId}
                    onChange={(e) => setSelectedCrewId(e.target.value)}
                    className="w-full px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-200 focus:outline-none focus:border-blue-500"
                  >
                    <option value="all">Semua Pengemudi ({crews.length})</option>
                    {crews.map(cr => (
                      <option key={cr.id} value={cr.id}>
                        {cr.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Kolom 3: Filter Cabang & Armada */}
              <div className="space-y-2.5">
                <div className="space-y-1">
                  <label className="block text-[11px] font-medium text-slate-400">Pilih Cabang</label>
                  <select
                    value={selectedBranchId}
                    onChange={(e) => {
                      setSelectedBranchId(e.target.value);
                      branchStore.setSelectedOriginBranchId(e.target.value);
                    }}
                    className="w-full px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-xs font-bold text-emerald-400 focus:outline-none focus:border-emerald-500"
                  >
                    <option value="ALL">Semua Cabang</option>
                    {branches.map(b => (
                      <option key={b.id} value={b.id}>Cabang {b.name}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="block text-[11px] font-medium text-slate-400">Pilih Armada</label>
                  <select
                    value={selectedFleetFilter}
                    onChange={(e) => setSelectedFleetFilter(e.target.value)}
                    className="w-full px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-200 focus:outline-none focus:border-blue-500"
                  >
                    <option value="all">Semua Armada ({fleets.length})</option>
                    {fleets.map(fl => (
                      <option key={fl.id} value={fl.initialCode || fl.plateNumber}>
                        Armada {fl.initialCode ? `${fl.initialCode} · ${fl.plateNumber}` : fl.plateNumber} ({fl.vehicleType})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800/80 space-y-1">
                  <div className="text-[11px] font-semibold text-slate-300">Status Data Ditampilkan</div>
                  <div className="text-[11px] text-slate-400 flex items-center justify-between">
                    <span>Total Kru Aktif:</span>
                    <strong className="text-white font-mono">{crewAreaStatsList.length} Kru</strong>
                  </div>
                  <div className="text-[11px] text-slate-400 flex items-center justify-between">
                    <span>Total Unit Armada:</span>
                    <strong className="text-white font-mono">{fleetAreaStatsList.length} Unit</strong>
                  </div>
                </div>
              </div>

              {/* Kolom 4: Toggle Switches Preferensi */}
              <div className="space-y-2 bg-slate-950/60 p-2.5 rounded-lg border border-slate-800/80">
                <div className="text-[11px] font-semibold text-slate-400">Preferensi Tampilan &amp; Filter</div>

                <UiToggleSwitch
                  checked={useAccordionLayout}
                  onChange={setUseAccordionLayout}
                  label="Mode Accordion Ringkas"
                  description="Susun bertumpuk tanpa perlu scroll panjang"
                />

                <UiToggleSwitch
                  checked={onlyExceededFilter}
                  onChange={setOnlyExceededFilter}
                  label="Hanya Melebihi Batas"
                  description={`Tampilkan kru dengan >= ${threshold}x kirim`}
                />

                <UiToggleSwitch
                  checked={autoSyncEnabled}
                  onChange={setAutoSyncEnabled}
                  label="Auto-Sync Jadwal"
                  description="Integrasi otomatis dari penugasan"
                />
              </div>
            </div>
          )}
        </div>

        {/* Main Content Area (100% Full Width) */}
        <div className="w-full space-y-2.5">
          {/* Sub-Tab Bar & Layout Controls */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-2.5 flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-1.5 bg-slate-950 p-1 rounded-lg border border-slate-800">
              <button
                type="button"
                onClick={() => setActiveSubTab('area_stats')}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-bold transition cursor-pointer ${
                  activeSubTab === 'area_stats'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <MapPin className="w-3.5 h-3.5 shrink-0" />
                <span>Frekuensi Kru per Area</span>
                <span
                  className={`inline-flex items-center justify-center px-2 py-0.5 rounded-full text-[11px] font-mono font-black tabular-nums leading-none ${
                    activeSubTab === 'area_stats'
                      ? 'bg-blue-900 text-white border border-white/30'
                      : 'bg-blue-600 text-white'
                  }`}
                >
                  {crewAreaStatsList.length}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setActiveSubTab('fleet_stats')}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-bold transition cursor-pointer ${
                  activeSubTab === 'fleet_stats'
                    ? 'bg-amber-600 text-white shadow-xs'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Truck className="w-3.5 h-3.5 shrink-0" />
                <span>Frekuensi Armada</span>
                <span
                  className={`inline-flex items-center justify-center px-2 py-0.5 rounded-full text-[11px] font-mono font-black tabular-nums leading-none ${
                    activeSubTab === 'fleet_stats'
                      ? 'bg-amber-900 text-white border border-white/30'
                      : 'bg-amber-600 text-white'
                  }`}
                >
                  {fleetAreaStatsList.length}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setActiveSubTab('kanvas_lkt')}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-bold transition cursor-pointer ${
                  activeSubTab === 'kanvas_lkt'
                    ? 'bg-purple-600 text-white shadow-xs'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Calendar className="w-3.5 h-3.5 shrink-0" />
                <span>Jadwal &amp; History Kanvas LKT</span>
                <span
                  className={`inline-flex items-center justify-center px-2 py-0.5 rounded-full text-[11px] font-mono font-black tabular-nums leading-none ${
                    activeSubTab === 'kanvas_lkt'
                      ? 'bg-purple-900 text-white border border-white/30'
                      : 'bg-purple-600 text-white'
                  }`}
                >
                  {kanvasLktHistoryList.length}
                </span>
              </button>
            </div>

            {/* Kontrol Layout Tetap (Stabil & Tidak Berpindah-pindah) */}
            <div className="flex items-center gap-2 ml-auto shrink-0">
              <div className="flex items-center gap-1.5 text-xs">
                <button
                  type="button"
                  disabled={!useAccordionLayout}
                  onClick={() => {
                    const next: Record<string, boolean> = {};
                    if (activeSubTab === 'area_stats') {
                      crewAreaStatsList.forEach(c => {
                        next[c.crewId || c.crewName] = true;
                      });
                    } else if (activeSubTab === 'fleet_stats') {
                      fleetAreaStatsList.forEach(f => {
                        next[f.initialCode] = true;
                      });
                    } else {
                      kanvasDriverRotationQueue.forEach(drv => {
                        next[`kanvas-drv-${drv.driverName}`] = true;
                      });
                      kanvasLktHistoryList.forEach((entry, idx) => {
                        next[`kanvas-hist-${entry.id || idx}`] = true;
                      });
                    }
                    setExpandedIds(next);
                  }}
                  className={`px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-[11px] font-medium transition ${
                    useAccordionLayout
                      ? 'text-slate-300 hover:text-white cursor-pointer'
                      : 'text-slate-600 opacity-50 cursor-not-allowed'
                  }`}
                >
                  Buka Semua
                </button>
                <button
                  type="button"
                  disabled={!useAccordionLayout}
                  onClick={() => setExpandedIds({})}
                  className={`px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-[11px] font-medium transition ${
                    useAccordionLayout
                      ? 'text-slate-300 hover:text-white cursor-pointer'
                      : 'text-slate-600 opacity-50 cursor-not-allowed'
                  }`}
                >
                  Tutup Semua
                </button>
              </div>

              <div className="flex items-center bg-slate-950 p-1 rounded-lg border border-slate-800 shrink-0">
                <button
                  type="button"
                  onClick={() => setUseAccordionLayout(true)}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-semibold transition cursor-pointer ${
                    useAccordionLayout ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'
                  }`}
                  title="Tampilan Accordion Bertumpuk (Tanpa Scroll)"
                >
                  <ListFilter className="w-3.5 h-3.5" />
                  <span>Accordion</span>
                </button>
                <button
                  type="button"
                  onClick={() => setUseAccordionLayout(false)}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-semibold transition cursor-pointer ${
                    !useAccordionLayout ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'
                  }`}
                  title="Tampilan Kartu (Cards Grid)"
                >
                  <LayoutGrid className="w-3.5 h-3.5" />
                  <span>Cards</span>
                </button>
              </div>
            </div>
          </div>

          {/* HASIL LANGSUNG PENCARIAN / FILTER ARMADA (Muncul otomatis saat mencari kode armada misal: N4/NS2, N4, NS2) */}
          {activeSubTab === 'area_stats' && isSearchingOrFilteringArmada && fleetAreaStatsList.length > 0 && (
            <div className="bg-slate-900/90 border border-amber-500/40 rounded-xl p-3 space-y-2.5">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-xs font-bold text-amber-300">
                  <Truck className="w-4 h-4 text-amber-400" />
                  <span>Hasil Pencarian Armada ({fleetAreaStatsList.length} Unit Ditemukan)</span>
                </div>
                <span className="text-[11px] text-slate-400">
                  Menampilkan langsung unit armada yang cocok
                </span>
              </div>
              <div className="space-y-2">
                {fleetAreaStatsList.map(fl => {
                  const isExpanded = expandedIds[fl.initialCode] ?? true;
                  const areaEntries = Object.entries(fl.areas).sort((a, b) => b[1] - a[1]);
                  return (
                    <UiAccordionItem
                      key={`direct-fleet-${fl.initialCode}`}
                      id={fl.initialCode}
                      isExpanded={isExpanded}
                      onToggle={toggleAccordion}
                      title={`Armada ${fl.initialCode} · ${fl.plateNumber}`}
                      subtitle={`${fl.vehicleType} · ${areaEntries.length} Rute Distribusi`}
                      rightMeta={<UiBadge count={`${fl.totalTrips} Trip`} variant="emerald" />}
                    >
                      {areaEntries.length === 0 ? (
                        <div className="text-xs text-slate-400 py-2">
                          Belum ada rute perjalanan tercatat pada filter periode ini.
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-2.5">
                          {areaEntries.map(([areaName, count]) => (
                            <div
                              key={areaName}
                              className="p-2.5 rounded-lg bg-slate-900 border border-slate-800 space-y-1.5"
                            >
                              <div className="flex items-center justify-between gap-2">
                                <span className="font-semibold text-white text-xs truncate">
                                  {areaName}
                                </span>
                                <UiBadge count={`${count} Trip`} variant="emerald" />
                              </div>
                              <UiProgressBar
                                value={count}
                                max={Math.max(1, fl.totalTrips)}
                                label="Porsi Rute Armada"
                                valueLabel={`${Math.round((count / Math.max(1, fl.totalTrips)) * 100)}%`}
                                status="success"
                              />
                            </div>
                          ))}
                        </div>
                      )}
                    </UiAccordionItem>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 1: FREKUENSI KRU PER AREA */}
          {activeSubTab === 'area_stats' && (
            <>
              {crewAreaStatsList.length === 0 && (!isSearchingOrFilteringArmada || fleetAreaStatsList.length === 0) ? (
                <UiCard title="Tidak Ada Data Pengiriman Kru" subtitle="Sesuaikan filter atau sinkronkan jadwal">
                  <div className="py-6 text-center space-y-3">
                    <p className="text-slate-400 text-xs">
                      Belum ada riwayat penugasan kru yang cocok dengan filter pencarian saat ini.
                    </p>
                    <button
                      type="button"
                      onClick={handleManualSyncHistory}
                      className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold transition cursor-pointer"
                    >
                      Sinkronkan Jadwal Aktif
                    </button>
                  </div>
                </UiCard>
              ) : useAccordionLayout ? (
                /* 8. ACCORDION VIEW: Neat stacked rows that expand/collapse on click */
                <div className="space-y-2 max-h-[calc(100vh-270px)] overflow-y-auto pr-1 custom-scrollbar">
                  {crewAreaStatsList.map(item => {
                    const id = item.crewId || item.crewName;
                    const isExpanded = !!expandedIds[id];
                    const areaItems = Object.values(item.areas).sort((a, b) => b.tripCount - a.tripCount);

                    return (
                      <UiAccordionItem
                        key={id}
                        id={id}
                        isExpanded={isExpanded}
                        onToggle={toggleAccordion}
                        title={
                          <div className="flex items-center gap-2 flex-wrap">
                            <span>{item.crewName}</span>
                            {item.exceededCount > 0 && (
                              <UiBadge
                                count={`${item.exceededCount} Batas`}
                                variant="amber"
                                title="Mencapai batas rotasi wilayah"
                              />
                            )}
                          </div>
                        }
                        subtitle={`${areaItems.length} Area Dikunjungi · Maks ${item.maxSingleAreaTrips}/${threshold}x di 1 area`}
                        rightMeta={
                          <div className="flex items-center gap-3">
                            <div className="hidden sm:block w-28">
                              <UiProgressBar
                                value={item.maxSingleAreaTrips}
                                max={threshold}
                                status={
                                  item.maxSingleAreaTrips >= threshold
                                    ? 'warning'
                                    : 'normal'
                                }
                              />
                            </div>
                            <UiBadge
                              count={`${item.totalTrips} Trip`}
                              variant="blue"
                            />
                          </div>
                        }
                      >
                        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-2.5">
                          {areaItems.map(st => (
                            <div
                              key={st.areaName}
                              className="p-3 rounded-lg bg-slate-900 border border-slate-800 flex flex-col justify-between gap-2.5"
                            >
                              <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0">
                                  <div className="font-semibold text-white text-xs truncate">
                                    {st.areaName}
                                  </div>
                                  <div className="text-[11px] text-slate-400 mt-0.5">
                                    Terakhir: {new Date(st.lastDate).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })}
                                  </div>
                                </div>
                                <UiBadge
                                  count={`${st.tripCount}x`}
                                  variant={st.isExceeded ? 'amber' : 'slate'}
                                />
                              </div>

                              {/* 10. PROGRESS BAR inside each area */}
                              <UiProgressBar
                                value={st.tripCount}
                                max={threshold}
                                label={st.isExceeded ? 'Mencapai Batas Rotasi' : 'Kuota Area'}
                                valueLabel={`${st.tripCount}/${threshold}x`}
                                status={st.isExceeded ? 'warning' : 'emerald' as any}
                              />

                              <div className="flex items-center justify-end gap-1.5 pt-1">
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleOpenSimulateApproval(
                                      item.crewName,
                                      item.crewId,
                                      st.areaName,
                                      st.tripCount
                                    )
                                  }
                                  className={`px-3 py-1 rounded-md text-[11px] font-semibold transition cursor-pointer ${
                                    st.isExceeded
                                      ? 'bg-amber-500 hover:bg-amber-400 text-slate-950'
                                      : 'bg-blue-600/20 hover:bg-blue-600/30 text-blue-300'
                                  }`}
                                >
                                  Rincian
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </UiAccordionItem>
                    );
                  })}
                </div>
              ) : (
                /* 1. CARDS VIEW: Clean rectangular modules with compact scrollable body */
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 max-h-[calc(100vh-270px)] overflow-y-auto pr-1 custom-scrollbar">
                  {crewAreaStatsList.map(item => {
                    const areaItems = Object.values(item.areas).sort((a, b) => b.tripCount - a.tripCount);

                    return (
                      <UiCard
                        key={item.crewId || item.crewName}
                        compact
                        title={item.crewName}
                        subtitle={`${areaItems.length} Area Kirim · Maks ${item.maxSingleAreaTrips}/${threshold}x di 1 area`}
                        badge={
                          item.exceededCount > 0 ? (
                            <UiBadge count={`${item.exceededCount} Batas`} variant="amber" />
                          ) : undefined
                        }
                        headerAction={<UiBadge count={`${item.totalTrips} Trip`} variant="blue" />}
                        footer={
                          <UiProgressBar
                            value={item.maxSingleAreaTrips}
                            max={threshold}
                            label="Puncak Rotasi Area"
                            valueLabel={`${item.maxSingleAreaTrips}/${threshold}x`}
                            status={item.maxSingleAreaTrips >= threshold ? 'warning' : 'normal'}
                          />
                        }
                      >
                        <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1 custom-scrollbar">
                          {areaItems.map(st => (
                            <div
                              key={st.areaName}
                              className="p-2 rounded-lg bg-slate-950 border border-slate-800/90 flex items-center justify-between gap-2"
                            >
                              <div className="min-w-0 flex-1">
                                <div className="font-semibold text-white text-xs truncate">
                                  {st.areaName}
                                </div>
                                <div className="text-[10px] text-slate-400">
                                  {st.tripCount}/{threshold}x pengiriman
                                </div>
                              </div>
                              <div className="flex items-center gap-1 shrink-0">
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleOpenSimulateApproval(
                                      item.crewName,
                                      item.crewId,
                                      st.areaName,
                                      st.tripCount
                                    )
                                  }
                                  className={`px-2.5 py-1 rounded text-[10px] font-semibold cursor-pointer ${
                                    st.isExceeded
                                      ? 'bg-amber-500 text-slate-950 hover:bg-amber-400'
                                      : 'bg-blue-600 text-white hover:bg-blue-500'
                                  }`}
                                >
                                  Rincian
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </UiCard>
                    );
                  })}
                </div>
              )}
            </>
          )}

          {/* TAB 2: FREKUENSI ARMADA */}
          {activeSubTab === 'fleet_stats' && (
            <>
              {useAccordionLayout ? (
                <div className="space-y-2 max-h-[calc(100vh-270px)] overflow-y-auto pr-1 custom-scrollbar">
                  {fleetAreaStatsList.map(fl => {
                    const isExpanded = !!expandedIds[fl.initialCode];
                    const areaEntries = Object.entries(fl.areas).sort((a, b) => b[1] - a[1]);

                    return (
                      <UiAccordionItem
                        key={fl.initialCode}
                        id={fl.initialCode}
                        isExpanded={isExpanded}
                        onToggle={toggleAccordion}
                        title={`Armada ${fl.initialCode} · ${fl.plateNumber}`}
                        subtitle={`${fl.vehicleType} · ${areaEntries.length} Rute Distribusi`}
                        rightMeta={<UiBadge count={`${fl.totalTrips} Trip`} variant="emerald" />}
                      >
                        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-2.5">
                          {areaEntries.map(([areaName, count]) => (
                            <div
                              key={areaName}
                              className="p-2.5 rounded-lg bg-slate-900 border border-slate-800 space-y-1.5"
                            >
                              <div className="flex items-center justify-between gap-2">
                                <span className="font-semibold text-white text-xs truncate">
                                  {areaName}
                                </span>
                                <UiBadge count={`${count} Trip`} variant="emerald" />
                              </div>
                              <UiProgressBar
                                value={count}
                                max={fl.totalTrips}
                                label="Porsi Rute Armada"
                                valueLabel={`${Math.round((count / Math.max(1, fl.totalTrips)) * 100)}%`}
                                status="success"
                              />
                            </div>
                          ))}
                        </div>
                      </UiAccordionItem>
                    );
                  })}
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 max-h-[calc(100vh-270px)] overflow-y-auto pr-1 custom-scrollbar">
                  {fleetAreaStatsList.map(fl => {
                    const areaEntries = Object.entries(fl.areas).sort((a, b) => b[1] - a[1]);

                    return (
                      <UiCard
                        key={fl.initialCode}
                        compact
                        title={`Armada ${fl.initialCode}`}
                        subtitle={`${fl.plateNumber} · ${fl.vehicleType}`}
                        headerAction={<UiBadge count={`${fl.totalTrips} Trip`} variant="emerald" />}
                      >
                        <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1 custom-scrollbar">
                          {areaEntries.map(([areaName, count]) => (
                            <div
                              key={areaName}
                              className="p-2 rounded-lg bg-slate-950 border border-slate-800 space-y-1"
                            >
                              <div className="flex items-center justify-between gap-2">
                                <span className="font-semibold text-white text-xs truncate">
                                  {areaName}
                                </span>
                                <span className="font-mono tabular-nums text-[11px] font-bold text-emerald-400">
                                  {count} Trip
                                </span>
                              </div>
                              <UiProgressBar
                                value={count}
                                max={fl.totalTrips}
                                status="success"
                              />
                            </div>
                          ))}
                        </div>
                      </UiCard>
                    );
                  })}
                </div>
              )}
            </>
          )}

          {/* TAB 3: JADWAL & HISTORY KANVAS LKT (Mendukung Mode Accordion & Mode Cards yang Berbeda) */}
          {activeSubTab === 'kanvas_lkt' && (
            <div className="space-y-4">
              {/* BAGIAN 1: REKOMENDASI GILIRAN JADWAL KANVAS SELANJUTNYA */}
              <div className="bg-slate-900 border border-purple-500/30 rounded-xl p-4 shadow-xs space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-3">
                  <div>
                    <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-purple-500/20 text-purple-300 border border-purple-500/30 mb-1">
                      <Calendar className="w-3 h-3" />
                      <span>Sistem Rotasi &amp; Antrean Kanvas Otomatis ({useAccordionLayout ? 'Mode Accordion' : 'Mode Cards'})</span>
                    </div>
                    <h3 className="text-sm font-black text-white">
                      Urutan &amp; Giliran Jadwal Kanvas Selanjutnya (Siapa Berikutnya)
                    </h3>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Berdasarkan histori keberangkatan Kanvas, sistem mengurutkan supir yang belum pernah atau paling lama tidak jalan Kanvas untuk dijadwalkan berikutnya.
                    </p>
                  </div>
                </div>

                {kanvasDriverRotationQueue.length === 0 ? (
                  <div className="p-4 text-center text-xs text-slate-400">
                    Belum ada data pengemudi aktif untuk rekomendasi giliran Kanvas.
                  </div>
                ) : useAccordionLayout ? (
                  /* MODE ACCORDION: Baris Bertumpuk per Supir yang Bisa Dibuka/Tutup */
                  <div className="space-y-2">
                    {kanvasDriverRotationQueue.map((drv, idx) => {
                      const accId = `kanvas-drv-${drv.driverName}`;
                      const isExpanded = !!expandedIds[accId];
                      const driverTrips = kanvasLktHistoryList.filter(
                        h => h.crewName.toLowerCase() === drv.driverName.toLowerCase()
                      );

                      return (
                        <UiAccordionItem
                          key={accId}
                          id={accId}
                          isExpanded={isExpanded}
                          onToggle={toggleAccordion}
                          title={
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="px-2 py-0.5 rounded bg-purple-500/20 border border-purple-500/40 text-purple-300 font-mono text-[11px] font-black">
                                Giliran #{idx + 1}
                              </span>
                              <span className="font-bold text-white">{drv.driverName}</span>
                              {idx === 0 ? (
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-500 text-slate-950">
                                  ★ Jadwal Kanvas Selanjutnya
                                </span>
                              ) : idx === 1 ? (
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-500/20 text-purple-300 border border-purple-500/30">
                                  Urutan Berikutnya
                                </span>
                              ) : null}
                            </div>
                          }
                          subtitle={
                            drv.lastKanvasDate
                              ? `Terakhir Kanvas: ${new Date(drv.lastKanvasDate).toLocaleDateString('id-ID', {
                                  day: '2-digit',
                                  month: 'short',
                                  year: 'numeric'
                                })} (${drv.lastKanvasArea || 'Kanvas'})`
                              : 'Belum pernah jalan Kanvas · Prioritas Utama'
                          }
                          rightMeta={
                            <UiBadge
                              count={`${drv.kanvasCount}x Kanvas`}
                              variant={idx === 0 ? 'emerald' : 'blue'}
                            />
                          }
                        >
                          <div className="space-y-2">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                              <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800">
                                <div className="text-[10px] text-slate-400">Status Giliran</div>
                                <div className="font-bold text-white mt-0.5">
                                  {idx === 0
                                    ? 'Prioritas #1 (Jadwal Selanjutnya)'
                                    : idx === 1
                                    ? 'Prioritas #2 (Urutan Berikutnya)'
                                    : `Antrean Rotasi #${idx + 1}`}
                                </div>
                              </div>
                              <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800">
                                <div className="text-[10px] text-slate-400">Riwayat Perjalanan Kanvas</div>
                                <div className="font-mono font-bold text-emerald-400 mt-0.5">{drv.kanvasCount} Perjalanan</div>
                              </div>
                            </div>

                            {driverTrips.length > 0 && (
                              <div className="pt-1 space-y-1.5">
                                <div className="text-[11px] font-semibold text-slate-300">
                                  Rincian Riwayat Keberangkatan Kanvas ({driverTrips.length}):
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                  {driverTrips.map((tr, tIdx) => (
                                    <div
                                      key={`${accId}-tr-${tIdx}`}
                                      className="p-2 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-between gap-2 text-xs"
                                    >
                                      <div>
                                        <div className="font-semibold text-white">{tr.areaName}</div>
                                        <div className="text-[10px] text-slate-400">
                                          {new Date(tr.dateStr).toLocaleDateString('id-ID', {
                                            day: '2-digit',
                                            month: 'short',
                                            year: 'numeric'
                                          })}{' '}
                                          · Helper: {tr.helperName || '-'}
                                        </div>
                                      </div>
                                      <span className="px-2 py-0.5 rounded font-mono text-[10px] font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30">
                                        {tr.plateNumber}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        </UiAccordionItem>
                      );
                    })}
                  </div>
                ) : (
                  /* MODE CARDS: Tampilan Grid Kartu Visual per Supir */
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                    {kanvasDriverRotationQueue.map((drv, idx) => (
                      <UiCard
                        key={`card-drv-${drv.driverName}`}
                        compact
                        title={drv.driverName}
                        badge={
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${
                              idx === 0
                                ? 'bg-emerald-500 text-slate-950'
                                : idx === 1
                                ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                                : 'bg-slate-800 text-slate-300 border border-slate-700'
                            }`}
                          >
                            #{idx + 1}
                          </span>
                        }
                        headerAction={
                          <UiBadge
                            count={`${drv.kanvasCount}x Kanvas`}
                            variant={idx === 0 ? 'emerald' : 'blue'}
                          />
                        }
                        footer={
                          <div className="w-full flex items-center justify-between text-[11px]">
                            <span className="text-slate-400">Rekomendasi:</span>
                            <span
                              className={`font-bold ${
                                idx === 0
                                  ? 'text-emerald-400'
                                  : idx === 1
                                  ? 'text-purple-300'
                                  : 'text-slate-300'
                              }`}
                            >
                              {idx === 0
                                ? '★ Jadwal Kanvas Selanjutnya'
                                : idx === 1
                                ? 'Urutan Berikutnya'
                                : `Antrean #${idx + 1}`}
                            </span>
                          </div>
                        }
                      >
                        <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800 space-y-1.5 text-xs">
                          <div className="flex items-center justify-between">
                            <span className="text-slate-400">Terakhir Kanvas:</span>
                            <span className="font-semibold text-white">
                              {drv.lastKanvasDate
                                ? new Date(drv.lastKanvasDate).toLocaleDateString('id-ID', {
                                    day: '2-digit',
                                    month: 'short',
                                    year: 'numeric'
                                  })
                                : 'Belum Pernah'}
                            </span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-slate-400">Rute Terakhir:</span>
                            <span className="font-semibold text-purple-300 truncate max-w-[160px]">
                              {drv.lastKanvasArea || '-'}
                            </span>
                          </div>
                        </div>
                      </UiCard>
                    ))}
                  </div>
                )}
              </div>

              {/* BAGIAN 2: RIWAYAT & JADWAL PENGIRIMAN KANVAS */}
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-xs space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-3">
                  <div>
                    <h3 className="text-xs sm:text-sm font-black text-white flex items-center gap-2">
                      <Truck className="w-4 h-4 text-purple-400" />
                      <span>Riwayat &amp; Jadwal Pengiriman Kanvas</span>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-600 text-white">
                        {kanvasLktHistoryList.length} Riwayat Tercatat
                      </span>
                    </h3>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Log historis keberangkatan pengiriman Kanvas beserta supir, helper, dan armada yang bertugas ({useAccordionLayout ? 'Tampilan Accordion' : 'Tampilan Cards'}).
                    </p>
                  </div>
                </div>

                {kanvasLktHistoryList.length === 0 ? (
                  <div className="p-8 text-center text-xs text-slate-400">
                    Belum ada riwayat pengiriman Kanvas pada filter saat ini.
                  </div>
                ) : useAccordionLayout ? (
                  /* MODE ACCORDION: Riwayat Kanvas Bertumpuk */
                  <div className="space-y-2">
                    {kanvasLktHistoryList.map((entry, idx) => {
                      const histId = `kanvas-hist-${entry.id || idx}`;
                      const isExpanded = !!expandedIds[histId];
                      const formattedDate = new Date(entry.dateStr).toLocaleDateString('id-ID', {
                        weekday: 'short',
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric'
                      });

                      return (
                        <UiAccordionItem
                          key={histId}
                          id={histId}
                          isExpanded={isExpanded}
                          onToggle={toggleAccordion}
                          title={
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-mono text-xs font-bold text-purple-300">
                                {formattedDate}
                              </span>
                              <span className="text-slate-500">&middot;</span>
                              <span className="font-bold text-white">{entry.crewName}</span>
                              <span className="px-2 py-0.5 rounded font-mono font-bold text-[10px] bg-amber-500/15 text-amber-300 border border-amber-500/30">
                                {entry.plateNumber}
                              </span>
                            </div>
                          }
                          subtitle={`Tujuan: ${entry.areaName} · Helper: ${entry.helperName || '-'}`}
                          rightMeta={
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                              <CheckCircle2 className="w-3 h-3" /> {entry.statusLabel}
                            </span>
                          }
                        >
                          <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5 text-xs">
                            <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800">
                              <div className="text-[10px] text-slate-400">Tanggal Keberangkatan</div>
                              <div className="font-mono font-bold text-white mt-0.5">{formattedDate}</div>
                            </div>
                            <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800">
                              <div className="text-[10px] text-slate-400">Driver &amp; Helper Kanvas</div>
                              <div className="font-bold text-white mt-0.5">
                                {entry.crewName} <span className="text-slate-400 font-normal">/ {entry.helperName || '-'}</span>
                              </div>
                            </div>
                            <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800">
                              <div className="text-[10px] text-slate-400">Unit Armada</div>
                              <div className="font-mono font-bold text-amber-300 mt-0.5">{entry.plateNumber}</div>
                            </div>
                            <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800">
                              <div className="text-[10px] text-slate-400">Area Tujuan Kanvas</div>
                              <div className="font-bold text-purple-300 mt-0.5">{entry.areaName}</div>
                            </div>
                          </div>
                        </UiAccordionItem>
                      );
                    })}
                  </div>
                ) : (
                  /* MODE CARDS: Riwayat Kanvas dalam Grid Kartu */
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                    {kanvasLktHistoryList.map((entry, idx) => {
                      const formattedDate = new Date(entry.dateStr).toLocaleDateString('id-ID', {
                        weekday: 'short',
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric'
                      });

                      return (
                        <UiCard
                          key={entry.id || `klkt-card-${idx}`}
                          compact
                          title={entry.crewName}
                          subtitle={`Helper: ${entry.helperName || '-'}`}
                          badge={
                            <span className="px-2 py-0.5 rounded font-mono font-bold text-[10px] bg-amber-500/15 text-amber-300 border border-amber-500/30">
                              {entry.plateNumber}
                            </span>
                          }
                          headerAction={
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                              <CheckCircle2 className="w-3 h-3" /> {entry.statusLabel}
                            </span>
                          }
                          footer={
                            <div className="w-full flex items-center justify-between text-[11px]">
                              <span className="text-slate-400">Tanggal Kirim:</span>
                              <span className="font-mono font-bold text-white">{formattedDate}</span>
                            </div>
                          }
                        >
                          <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800 flex items-center justify-between gap-2">
                            <span className="text-[11px] text-slate-400">Area Tujuan:</span>
                            <span className="px-2 py-0.5 rounded font-bold text-[10px] uppercase bg-purple-500/20 text-purple-300 border border-purple-500/30">
                              {entry.areaName}
                            </span>
                          </div>
                        </UiCard>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 4. POPOVER: Rotation Threshold Settings */}
      <UiPopover
        isOpen={isThresholdPopoverOpen}
        onClose={() => setIsThresholdPopoverOpen(false)}
        title="Konfigurasi Batas Rotasi Wilayah"
        subtitle="Pilih batas maksimal pengiriman berulang pada area yang sama"
      >
        <div className="space-y-3">
          <p className="text-xs text-slate-400">
            Jika seorang pengemudi mencapai batas pengiriman di area yang sama, sistem akan memberikan indikator peringatan rotasi stamina.
          </p>
          <div className="grid grid-cols-3 gap-2">
            {[2, 3, 5].map(num => (
              <button
                key={num}
                type="button"
                onClick={() => {
                  handleThresholdChange(num);
                  setIsThresholdPopoverOpen(false);
                }}
                className={`py-2.5 px-3 rounded-lg text-xs font-bold border transition cursor-pointer ${
                  threshold === num
                    ? 'bg-amber-500 text-slate-950 border-amber-400'
                    : 'bg-slate-950 text-slate-300 border-slate-800 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-center gap-1.5">
                  <Sliders className="w-3.5 h-3.5" />
                  <span>{num}x Kirim</span>
                </div>
              </button>
            ))}
          </div>
        </div>
      </UiPopover>

      {/* 7. MODAL: Reusable Area Approval Pop-Up Modal */}
      <AreaApprovalModal
        isOpen={modalData.isOpen}
        onClose={() => setModalData(prev => ({ ...prev, isOpen: false }))}
        crewName={modalData.crewName}
        crewId={modalData.crewId}
        areaName={modalData.areaName}
        storeName={modalData.storeName}
        plateNumber={modalData.plateNumber}
        tripCount={modalData.tripCount}
        threshold={modalData.threshold}
        recentTrips={modalData.recentTrips}
        onApprove={handleApproveFromModal}
        onRejectAndPickOtherDriver={() => {
          setModalData(prev => ({ ...prev, isOpen: false }));
          setFeedbackMessage(`Pengiriman ke ${modalData.areaName} dialihkan untuk rotasi supir baru.`);
          setTimeout(() => setFeedbackMessage(null), 3500);
        }}
      />

      {/* 7. MODAL: PDF Performance Report Download Modal */}
      <CrewReportDownloadModal
        isOpen={isReportModalOpen}
        onClose={() => setIsReportModalOpen(false)}
        allHistory={history}
        crews={crews}
        fleets={fleets}
        currentThreshold={threshold}
      />
    </div>
  );
};
