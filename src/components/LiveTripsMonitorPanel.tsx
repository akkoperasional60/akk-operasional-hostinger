import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity,
  Calendar,
  CheckCircle2,
  Clock,
  Compass,
  History,
  MapPin,
  Navigation,
  Play,
  Radio,
  RefreshCw,
  Search,
  Truck,
  Users
} from 'lucide-react';
import { LiveGpsTripPoint, LiveGpsTripRecord, RetailStore, TracksolidTripLeg } from '../types';
import { GpsFleetTripsMap } from './GpsFleetTripsMap';
import { logisticsStore } from '../services/store';
import { branchStore, BranchRecord } from '../services/branchStore';
import { getLocalDateStr } from '../services/driverReportService';

interface LiveTripsMonitorPanelProps {
  compact?: boolean;
  defaultMode?: 'live' | 'history';
  onCloseModal?: () => void;
}

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const toRad = (v: number) => (v * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 100) / 100;
}

function formatWibTime(iso?: string): string {
  if (!iso) return '-';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '-';
  return d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
}

function findNearestStoreName(lat: number, lng: number, stores: RetailStore[]): string | undefined {
  if (!stores.length || !Number.isFinite(lat) || !Number.isFinite(lng)) return undefined;
  let bestDist = 0.35; // 350 meters
  let bestName: string | undefined;
  for (const s of stores) {
    if (
      typeof s.latitude !== 'number' ||
      typeof s.longitude !== 'number' ||
      !Number.isFinite(s.latitude) ||
      !Number.isFinite(s.longitude)
    ) {
      continue;
    }
    const d = haversineKm(lat, lng, s.latitude, s.longitude);
    if (d <= bestDist) {
      bestDist = d;
      bestName = s.storeName;
    }
  }
  return bestName;
}

function buildLegsFromTrip(trip: LiveGpsTripRecord, stores: RetailStore[] = []): TracksolidTripLeg[] {
  const dateGroup = (trip.tripDate || trip.startedAt || getLocalDateStr()).slice(0, 10);
  const pts: LiveGpsTripPoint[] = Array.isArray(trip.points) && trip.points.length > 0
    ? trip.points
    : [
        {
          lat: trip.currentLat ?? -8.1906,
          lng: trip.currentLng ?? 114.3708,
          timestamp: trip.startedAt || new Date().toISOString(),
          locationName: trip.areaName || 'Gudang DC PT AKK'
        }
      ];

  if (pts.length === 1) {
    const p = pts[0];
    const originLat = trip.branchId === 'cab-sidoarjo' ? -7.4478 : -8.1906;
    const originLng = trip.branchId === 'cab-sidoarjo' ? 112.7183 : 114.3708;
    const dist = haversineKm(originLat, originLng, p.lat, p.lng);
    const matchedStore = findNearestStoreName(p.lat, p.lng, stores);
    return [
      {
        legNumber: 1,
        dateGroup,
        startTime: formatWibTime(trip.startedAt || p.timestamp),
        startLocation: trip.branchId === 'cab-sidoarjo' ? 'Gudang Sidoarjo' : 'Gudang Banyuwangi DC',
        endTime: formatWibTime(p.timestamp),
        endLocation: matchedStore || p.locationName || trip.areaName || 'Lokasi Armada Terkini',
        mileageKm: dist > 0.05 ? dist : 0.2,
        travelTime: 'Aktif',
        travelMinutes: 1,
        avgSpeedKmh: p.speedKmh || 35,
        maxSpeedKmh: p.speedKmh || 45,
        fuelPer100Km: 11,
        totalFuelLiters: Math.round(((dist || 0.2) * 0.11) * 100) / 100,
        startLat: originLat,
        startLng: originLng,
        endLat: p.lat,
        endLng: p.lng,
        matchedStoreName: matchedStore || trip.areaName
      }
    ];
  }

  const legs: TracksolidTripLeg[] = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i];
    const b = pts[i + 1];
    const tA = new Date(a.timestamp).getTime();
    const tB = new Date(b.timestamp).getTime();
    const diffMin = !isNaN(tA) && !isNaN(tB) ? Math.max(1, Math.round((tB - tA) / 60000)) : 5;
    const dist = haversineKm(a.lat, a.lng, b.lat, b.lng);
    const computedSpeed = b.speedKmh ?? Math.min(85, Math.max(12, Math.round((dist / (diffMin / 60)) || 32)));
    const matchedStore = findNearestStoreName(b.lat, b.lng, stores);
    legs.push({
      legNumber: i + 1,
      dateGroup,
      startTime: formatWibTime(a.timestamp),
      startLocation: a.locationName || (i === 0 ? 'Gudang DC PT AKK' : `Titik #${i + 1}`),
      endTime: formatWibTime(b.timestamp),
      endLocation: matchedStore || b.locationName || (i === pts.length - 2 ? trip.areaName || 'Tujuan Akhir' : `Titik #${i + 2}`),
      mileageKm: dist > 0 ? dist : 0.1,
      travelTime: `${diffMin} mnt`,
      travelMinutes: diffMin,
      avgSpeedKmh: computedSpeed,
      maxSpeedKmh: Math.max(computedSpeed, 45),
      fuelPer100Km: 11,
      totalFuelLiters: Math.round(dist * 0.11 * 100) / 100,
      startLat: a.lat,
      startLng: a.lng,
      endLat: b.lat,
      endLng: b.lng,
      matchedStoreName: matchedStore || (i === pts.length - 2 ? trip.areaName : undefined)
    });
  }
  return legs;
}

export const LiveTripsMonitorPanel: React.FC<LiveTripsMonitorPanelProps> = ({
  compact = false,
  defaultMode = 'live'
}) => {
  const [trips, setTrips] = useState<LiveGpsTripRecord[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [mode, setMode] = useState<'live' | 'history'>(defaultMode);
  const [selectedDate, setSelectedDate] = useState<string>(getLocalDateStr());
  const [branches, setBranches] = useState<BranchRecord[]>(() => branchStore.getActiveBranches());
  const [registeredStores, setRegisteredStores] = useState<RetailStore[]>(() => logisticsStore.getStores());
  const [selectedBranchId, setSelectedBranchId] = useState<string>(() => {
    const originId = branchStore.getSelectedOriginBranchId();
    return originId && originId !== 'ALL' ? originId : 'all';
  });
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedTripId, setSelectedTripId] = useState<string>('');
  const [selectedTripPoints, setSelectedTripPoints] = useState<{ tripId: string; points: LiveGpsTripPoint[] }>({
    tripId: '',
    points: []
  });
  const lastTripsFetchAtRef = useRef<number>(0);
  const tripsFetchInFlightRef = useRef<boolean>(false);

  const currentUserProfile = logisticsStore.getCurrentUser();
  const accessibleBranches = useMemo(
    () => branchStore.getAccessibleBranchesForUser(currentUserProfile),
    [branches, currentUserProfile]
  );
  const accessibleBranchIdSet = useMemo(
    () => new Set(accessibleBranches.map(b => b.id)),
    [accessibleBranches]
  );
  const effectiveBranchId = useMemo(() => {
    if (accessibleBranches.length === 1) return accessibleBranches[0].id;
    if (selectedBranchId === 'all' || selectedBranchId === 'ALL') return 'all';
    if (accessibleBranches.some(b => b.id === selectedBranchId)) return selectedBranchId;
    return 'all';
  }, [accessibleBranches, selectedBranchId]);

  useEffect(() => {
    const unsubBranch = branchStore.subscribe(() => {
      setBranches(branchStore.getActiveBranches());
      const originId = branchStore.getSelectedOriginBranchId();
      setSelectedBranchId(originId && originId !== 'ALL' ? originId : 'all');
    });
    const unsubStore = logisticsStore.subscribe(() => {
      setRegisteredStores(logisticsStore.getStores());
    });
    return () => {
      unsubBranch();
      unsubStore();
    };
  }, []);

  const fetchTrips = async (silent = false) => {
    // Event dari GPS dan timer tidak boleh membuat request bertumpuk.
    // Refresh manual tetap dapat dijalankan kapan saja.
    if (tripsFetchInFlightRef.current) return;
    if (silent && Date.now() - lastTripsFetchAtRef.current < 25000) return;
    tripsFetchInFlightRef.current = true;
    lastTripsFetchAtRef.current = Date.now();
    if (!silent) setIsLoading(true);
    try {
      const query = new URLSearchParams({ summary: '1' });
      if (mode === 'history' && selectedDate) query.set('date', selectedDate);
      const res = await fetch(`/api/gps-trips?${query.toString()}`, { credentials: 'include' });
      if (!res.ok) throw new Error(`GPS Trips HTTP ${res.status}`);
      const data = await res.json().catch(() => ({}));
      const serverTrips: LiveGpsTripRecord[] = Array.isArray(data?.trips) ? data.trips : [];

      // Merge dengan jadwal in_transit aktif di store jika belum masuk record GPS server
      const storeSchedules = logisticsStore.getSchedules();
      const mergedMap = new Map<string, LiveGpsTripRecord>();
      serverTrips.forEach(t => {
        if (t && t.id) mergedMap.set(t.id, t);
      });

      storeSchedules
        .filter(s => s.status === 'in_transit' || s.status === 'picked_up')
        .forEach(s => {
          const tripId = `TRIP-${s.id}`;
          if (!mergedMap.has(tripId)) {
            const originLat = s.originCoords?.[0] ?? -8.1906;
            const originLng = s.originCoords?.[1] ?? 114.3708;
            const destLat = s.store?.latitude ?? originLat;
            const destLng = s.store?.longitude ?? originLng;
            const schDate = (s.departureDate || s.createdAt || getLocalDateStr()).slice(0, 10);
            const pts: LiveGpsTripPoint[] = [
              {
                lat: originLat,
                lng: originLng,
                timestamp: s.actualDeparture || s.createdAt || new Date().toISOString(),
                locationName: s.originName || 'Gudang DC PT AKK'
              }
            ];
            if (Math.abs(destLat - originLat) > 0.001 || Math.abs(destLng - originLng) > 0.001) {
              pts.push({
                lat: destLat,
                lng: destLng,
                timestamp: new Date().toISOString(),
                locationName: s.areaName || s.store?.storeName || 'Rute Pengiriman'
              });
            }
            mergedMap.set(tripId, {
              id: tripId,
              tripDate: schDate,
              branchId: branchStore.getScheduleBranchId(s.id, s.originName, s.fleetId),
              fleetId: s.fleetId,
              plateNumber: s.fleet?.plateNumber || '-',
              initialCode: s.fleet?.initialCode,
              vehicleType: s.fleet?.vehicleType,
              driverName: s.crew?.name || 'Driver AKK',
              helper1Name: s.crewHelper?.name,
              helper2Name: s.crewHelper2?.name,
              areaName: s.areaName || s.store?.storeName || '-',
              status: 'active',
              startedAt: s.actualDeparture || s.createdAt || new Date().toISOString(),
              currentLat: pts[pts.length - 1].lat,
              currentLng: pts[pts.length - 1].lng,
              points: pts,
              updatedAt: new Date().toISOString()
            });
          }
        });

      const list = Array.from(mergedMap.values()).sort((a, b) => {
        if (a.status !== b.status) return a.status === 'active' ? -1 : 1;
        return String(b.updatedAt || b.startedAt).localeCompare(String(a.updatedAt || a.startedAt));
      });
      setTrips(list);
      if (list.length > 0 && (!selectedTripId || !list.some(t => t.id === selectedTripId))) {
        setSelectedTripId(list[0].id);
      }
    } catch {
      // keep existing trips on transient network failure
    } finally {
      tripsFetchInFlightRef.current = false;
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void fetchTrips();
    const timer = setInterval(() => {
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
      void fetchTrips(true);
    }, mode === 'live' ? 30000 : 60000);
    const onTripUpdated = () => void fetchTrips(true);
    window.addEventListener('gps-trip-updated', onTripUpdated);
    return () => {
      clearInterval(timer);
      window.removeEventListener('gps-trip-updated', onTripUpdated);
    };
  }, [mode, selectedDate]);

  // Trips strictly isolated by user-accessible & selected branch
  const branchScopedTrips = useMemo(() => {
    return trips.filter(t => {
      const resolvedBranchId =
        t.branchId ||
        (t.fleetId ? branchStore.getFleetBranchId(t.fleetId, t.plateNumber, t.initialCode) : 'cab-banyuwangi');
      if (effectiveBranchId === 'all') {
        return accessibleBranchIdSet.has(resolvedBranchId);
      }
      return resolvedBranchId === effectiveBranchId;
    });
  }, [trips, effectiveBranchId, accessibleBranchIdSet]);

  const filteredTrips = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return branchScopedTrips.filter(t => {
      if (mode === 'live' && t.status !== 'active') return false;
      if (mode === 'history' && selectedDate && t.tripDate !== selectedDate) return false;
      if (!q) return true;
      return (
        t.driverName.toLowerCase().includes(q) ||
        (t.helper1Name || '').toLowerCase().includes(q) ||
        (t.helper2Name || '').toLowerCase().includes(q) ||
        t.plateNumber.toLowerCase().includes(q) ||
        (t.initialCode || '').toLowerCase().includes(q) ||
        t.areaName.toLowerCase().includes(q)
      );
    });
  }, [branchScopedTrips, mode, selectedDate, searchQuery]);

  const activeSelectedTrip = useMemo(() => {
    return filteredTrips.find(t => t.id === selectedTripId) || filteredTrips[0] || null;
  }, [filteredTrips, selectedTripId]);

  // Ambil detail rute hanya untuk armada terpilih. Polling list tetap ringan,
  // sedangkan playback menyusul dengan delta titik GPS terbaru saja.
  useEffect(() => {
    const trip = activeSelectedTrip;
    if (!trip || typeof trip.pointCount !== 'number') {
      if (trip) setSelectedTripPoints({ tripId: trip.id, points: trip.points || [] });
      return;
    }

    const hasSameTrip = selectedTripPoints.tripId === trip.id;
    const existingPoints = hasSameTrip ? selectedTripPoints.points : [];
    const lastPointTimestamp = existingPoints[existingPoints.length - 1]?.timestamp;
    const detailUrl = `/api/gps-trips/${encodeURIComponent(trip.id)}${lastPointTimestamp ? `?after=${encodeURIComponent(lastPointTimestamp)}` : ''}`;
    let cancelled = false;

    void fetch(detailUrl, { credentials: 'include' })
      .then(async response => {
        if (!response.ok) throw new Error(`GPS Trip Detail HTTP ${response.status}`);
        return response.json();
      })
      .then(data => {
        if (cancelled || !data?.success || !data?.trip) return;
        const incomingPoints: LiveGpsTripPoint[] = Array.isArray(data.trip.points) ? data.trip.points : [];
        setSelectedTripPoints(previous => {
          const previousPoints = previous.tripId === trip.id ? previous.points : [];
          // Tanpa parameter after (atau setelah fallback server), respons adalah
          // snapshot penuh. Dengan after, respons hanya berisi titik baru.
          const isDelta = data.pointsMode === 'delta';
          const mergedPoints = isDelta
            ? [...previousPoints, ...incomingPoints].slice(-500)
            : incomingPoints;
          return { tripId: trip.id, points: mergedPoints };
        });
      })
      .catch(() => {
        // Data ringkasan tetap tampil saat jaringan sedang tidak stabil.
      });

    return () => { cancelled = true; };
  }, [activeSelectedTrip?.id, activeSelectedTrip?.pointCount, activeSelectedTrip?.updatedAt]);

  const selectedTripForMap = useMemo(() => {
    if (!activeSelectedTrip) return null;
    const points = selectedTripPoints.tripId === activeSelectedTrip.id
      ? selectedTripPoints.points
      : (activeSelectedTrip.points || []);
    return { ...activeSelectedTrip, points };
  }, [activeSelectedTrip, selectedTripPoints]);

  const mapLegs = useMemo(() => {
    if (!selectedTripForMap) return [];
    return buildLegsFromTrip(selectedTripForMap, registeredStores);
  }, [selectedTripForMap, registeredStores]);

  const activeCount = branchScopedTrips.filter(t => t.status === 'active').length;
  const completedCount = branchScopedTrips.filter(t => t.status === 'completed').length;

  return (
    <div className="space-y-4 animate-in fade-in duration-200">
      {/* Header */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 sm:p-5 shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div className="flex items-start sm:items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-blue-50 dark:bg-blue-500/15 border border-blue-200 dark:border-blue-500/30 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
            <Navigation className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-white tracking-tight">
              Live Trips, Riwayat Rute &amp; Playback Perjalanan
            </h2>
            <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
              Pantau armada secara real-time serta putar ulang (playback) riwayat rute perjalanan yang terekam otomatis dari GPS aplikasi Driver &amp; Helper.
            </p>
            <p className="text-[10px] text-emerald-700 dark:text-emerald-400 mt-1 font-semibold">
              Mode hemat data aktif · daftar diperbarui 30–60 detik · detail rute dimuat bertahap
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap shrink-0">
          <div className="flex p-1 rounded-xl bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs">
            <button
              type="button"
              onClick={() => setMode('live')}
              className={`min-h-[36px] px-3 py-1.5 rounded-lg font-bold flex items-center gap-1.5 transition cursor-pointer ${
                mode === 'live'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Radio className="w-3.5 h-3.5" />
              <span>Live Trips ({activeCount})</span>
            </button>
            <button
              type="button"
              onClick={() => setMode('history')}
              className={`min-h-[36px] px-3 py-1.5 rounded-lg font-bold flex items-center gap-1.5 transition cursor-pointer ${
                mode === 'history'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <History className="w-3.5 h-3.5" />
              <span>Riwayat &amp; Playback ({completedCount})</span>
            </button>
          </div>

          <button
            type="button"
            onClick={() => void fetchTrips()}
            disabled={isLoading}
            className="min-h-[38px] inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold border border-slate-200 dark:border-slate-700 transition cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-blue-500' : ''}`} />
            <span>Segarkan</span>
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-3.5 shadow-xs flex flex-col md:flex-row md:items-center gap-2.5">
        <div className="relative flex-1 min-w-0">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Cari driver, helper, area kiriman, atau plat armada..."
            aria-label="Cari perjalanan live atau riwayat rute"
            className="w-full min-h-[40px] pl-10 pr-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-blue-500"
          />
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {mode === 'history' && (
            <div className="flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-blue-500 shrink-0" />
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                aria-label="Filter tanggal riwayat rute"
                className="min-h-[40px] px-2.5 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-900 dark:text-white focus:outline-none focus:border-blue-500 cursor-pointer"
              />
              {selectedDate && (
                <button
                  type="button"
                  onClick={() => setSelectedDate('')}
                  className="text-[11px] font-bold text-blue-600 dark:text-blue-400 hover:underline px-1.5 cursor-pointer"
                >
                  Semua
                </button>
              )}
            </div>
          )}

          <select
            value={effectiveBranchId}
            disabled={accessibleBranches.length <= 1}
            onChange={(e) => {
              const nextVal = e.target.value;
              setSelectedBranchId(nextVal);
              branchStore.setSelectedOriginBranchId(nextVal === 'all' ? 'ALL' : nextVal);
            }}
            aria-label="Filter cabang"
            className="min-h-[40px] px-3 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-900 dark:text-white focus:outline-none focus:border-blue-500 cursor-pointer disabled:opacity-80"
          >
            {accessibleBranches.length > 1 && <option value="all">Semua Cabang</option>}
            {accessibleBranches.map(b => (
              <option key={b.id} value={b.id}>Cabang {b.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Main Split: Trip List & Interactive Map Playback */}
      <div className={`grid grid-cols-1 ${compact ? '' : 'lg:grid-cols-12'} gap-4`}>
        {/* Trip Cards List */}
        <div className={`${compact ? '' : 'lg:col-span-4'} space-y-2.5 max-h-[640px] overflow-y-auto pr-0.5`}>
          {filteredTrips.length === 0 ? (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 text-center space-y-2">
              <Compass className="w-8 h-8 text-slate-400 mx-auto" />
              <div className="text-sm font-bold text-slate-800 dark:text-slate-100">
                {mode === 'live' ? 'Belum Ada Armada Live Di Jalan' : 'Belum Ada Riwayat Rute Pada Tanggal Ini'}
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {mode === 'live'
                  ? 'Perjalanan otomatis aktif saat Driver / Helper menekan Gate-Out di Portal Driver & Helper.'
                  : 'Riwayat rute GPS aplikasi Driver & Helper tersimpan otomatis saat kru menekan Tiba di Gudang.'}
              </p>
            </div>
          ) : (
            filteredTrips.map(trip => {
              const isSelected = activeSelectedTrip?.id === trip.id;
              const lastPt = trip.points?.[trip.points.length - 1];
              return (
                <button
                  key={trip.id}
                  type="button"
                  onClick={() => setSelectedTripId(trip.id)}
                  className={`w-full text-left p-3.5 rounded-2xl border transition cursor-pointer space-y-2 ${
                    isSelected
                      ? 'bg-blue-50/90 dark:bg-blue-950/30 border-blue-500 shadow-sm'
                      : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-mono font-black text-xs text-slate-900 dark:text-white">
                          {trip.initialCode ? `${trip.initialCode} · ` : ''}{trip.plateNumber}
                        </span>
                        <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                          trip.status === 'active'
                            ? 'bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-300'
                            : 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300'
                        }`}>
                          {trip.status === 'active' ? 'Live Di Jalan' : 'Selesai'}
                        </span>
                      </div>
                      <div className="text-xs font-bold text-slate-800 dark:text-slate-200 mt-1 flex items-center gap-1 truncate">
                        <MapPin className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                        <span className="truncate">{trip.areaName}</span>
                      </div>
                    </div>
                    <span className="text-[10px] font-mono text-slate-500 dark:text-slate-400 shrink-0">
                      {formatWibTime(trip.startedAt)}
                    </span>
                  </div>

                  <div className="text-[11px] text-slate-600 dark:text-slate-300 flex items-center gap-1.5 flex-wrap">
                    <Users className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                    <span className="font-semibold">{trip.driverName}</span>
                    {trip.helper1Name && <span>· H1: {trip.helper1Name}</span>}
                    {trip.helper2Name && <span>· H2: {trip.helper2Name}</span>}
                  </div>

                  <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[10px] text-slate-500 dark:text-slate-400">
                    <span className="flex items-center gap-1 font-mono">
                      <Activity className="w-3 h-3 text-emerald-500" />
                      {lastPt ? `${lastPt.lat.toFixed(4)}, ${lastPt.lng.toFixed(4)}` : '-'}
                    </span>
                    <span className="flex items-center gap-1 font-bold text-blue-600 dark:text-blue-400">
                      <Play className="w-3 h-3" />
                      <span>{trip.pointCount ?? trip.points?.length ?? 1} Titik Rute</span>
                    </span>
                  </div>
                </button>
              );
            })
          )}
        </div>

        {/* Interactive Map & Playback Canvas */}
        <div className={`${compact ? '' : 'lg:col-span-8'} bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-3 sm:p-4 space-y-3 shadow-xs`}>
          {activeSelectedTrip ? (
            <>
              <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-slate-100 dark:border-slate-800 text-xs">
                <div className="flex items-center gap-2 min-w-0">
                  <Truck className="w-4 h-4 text-amber-500 shrink-0" />
                  <span className="font-black text-slate-900 dark:text-white truncate">
                    {activeSelectedTrip.areaName} — {activeSelectedTrip.initialCode || ''} {activeSelectedTrip.plateNumber}
                  </span>
                </div>
                <div className="flex items-center gap-3 text-[11px] text-slate-500 dark:text-slate-400">
                  <span className="flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5 text-blue-500" />
                    Mulai: {formatWibTime(activeSelectedTrip.startedAt)} WIB
                  </span>
                  {activeSelectedTrip.endedAt && (
                    <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-semibold">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Tiba: {formatWibTime(activeSelectedTrip.endedAt)} WIB
                    </span>
                  )}
                </div>
              </div>

              <GpsFleetTripsMap
                plateNumber={activeSelectedTrip.plateNumber}
                initialCode={activeSelectedTrip.initialCode || 'AKK'}
                vehicleType={activeSelectedTrip.vehicleType || 'Armada Box'}
                tripLegs={mapLegs}
                stores={registeredStores}
                selectedDateFilter={activeSelectedTrip.tripDate}
                dateScopeMode="semua"
                heightClass={compact ? 'h-[360px] w-full' : 'h-[540px] w-full'}
              />
            </>
          ) : (
            <div className="h-[360px] flex flex-col items-center justify-center text-center text-slate-400 space-y-2">
              <Navigation className="w-9 h-9 text-slate-300 dark:text-slate-600" />
              <div className="text-xs font-bold text-slate-600 dark:text-slate-300">
                Pilih armada atau rute di panel kiri untuk menampilkan peta Live Trips &amp; Playback.
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};