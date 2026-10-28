import React, { useEffect, useRef, useState, useMemo } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { 
  Navigation, 
  MapPin, 
  Truck, 
  Calendar, 
  Clock, 
  Building2, 
  Compass, 
  ExternalLink,
  Layers,
  Search,
  Filter,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  Maximize2,
  Minimize2,
  FileText,
  Phone,
  User,
  Users,
  Box,
  Ship,
  Sparkles,
  ChevronRight,
  Info,
  Check,
  Eye,
  ArrowRight
} from 'lucide-react';
import { Schedule, RetailStore, Fleet, Crew, ShipmentStatus } from '../types';
import { CENTRAL_WAREHOUSE } from '../data/mockData';
import { calculateDistanceKm } from '../utils/distance';
import { extractCoordinatesFromObject } from '../utils/coordinateParser';

// Comprehensive delivery area coordinates fallback for Eastern Java & Bali corridors
export const KNOWN_AREA_COORDINATES: Record<string, [number, number]> = {
  // BALI & NUSA TENGGARA CORRIDORS
  'DENPASAR 1': [-8.6705, 115.2126],
  'DENPASAR 2': [-8.6500, 115.2200],
  'DENPASAR': [-8.6705, 115.2126],
  'SINGARAJA': [-8.1120, 115.0880],
  'NEGARA': [-8.3580, 114.6190],
  'JEMBRANA': [-8.3580, 114.6190],
  'GIANYAR': [-8.5440, 115.3280],
  'TABANAN': [-8.5380, 115.1250],
  'KUTA': [-8.7180, 115.1690],
  'SANUR': [-8.6830, 115.2620],
  'UBUD': [-8.5069, 115.2625],
  'BULELENG': [-8.1120, 115.0880],

  // JAWA TIMUR CORRIDORS
  'SITUBONDO': [-7.7063, 114.0048],
  'BONDOWOSO': [-7.9135, 113.8214],
  'JEMBER KOTA': [-8.1724, 113.7007],
  'JEMBER': [-8.1724, 113.7007],
  'JEMBER BARAT': [-8.1900, 113.5200],
  'JEMBER SELATAN': [-8.3100, 113.5600],
  'PROBOLINGGO': [-7.7543, 113.2159],
  'LUMAJANG': [-8.1332, 113.2246],
  'SURABAYA': [-7.2575, 112.7521],

  // BANYUWANGI REGIONAL & CLUSTER DESTINATIONS
  'GENTENG': [-8.3650, 114.1530],
  'ROGOJAMPI': [-8.3050, 114.2980],
  'SRONO': [-8.3980, 114.2650],
  'MUNCAR': [-8.4350, 114.3350],
  'MUNCAR PESISIR': [-8.4450, 114.3400],
  'JAJAG': [-8.4020, 114.1480],
  'JAJAG RETAIL': [-8.4020, 114.1480],
  'PURWOHARJO': [-8.5080, 114.2480],
  'PURWO PASAR': [-8.5080, 114.2480],
  'PURWO DAMBUNTUNG': [-8.5200, 114.2600],
  'SUMBERAYU': [-8.4500, 114.2100],
  'SUMBERAYU RETAIL': [-8.4500, 114.2100],
  'GALEKAN': [-8.2700, 114.3200],
  'SONGGON': [-8.2650, 114.1850],
  'KALIBARU': [-8.2900, 113.9800],
  'SEMPU': [-8.3300, 114.1600],
  'SEMPU STAIL': [-8.3300, 114.1600],
  'SEMPU KALISTAIL': [-8.3300, 114.1600],
  'SANGGAR': [-8.4800, 114.1900],
  'KETAPANG': [-8.1485, 114.3980],
  'WONGSOREJO': [-7.9800, 114.4100],
  'KETAPANG - WONGSOREJO': [-8.0800, 114.4100],
  'BANYUWANGI KOTA': [-8.2190, 114.3680],
  'BWI KOTA SELATAN': [-8.2400, 114.3600],
  'GROSIR 1': [-8.2300, 114.3500],
  'GROSIR 2': [-8.2500, 114.3400],
  'GROSIR 3': [-8.2600, 114.3300],
  'GROSIR 4': [-8.2700, 114.3200]
};

// Strategic Ferry Ports for Bali Strait crossing
export const FERRY_PORTS = {
  KETAPANG: {
    name: 'Pelabuhan Ketapang ASDP (Banyuwangi)',
    coords: [-8.1485, 114.3980] as [number, number]
  },
  GILIMANUK: {
    name: 'Pelabuhan Gilimanuk ASDP (Bali)',
    coords: [-8.1630, 114.4370] as [number, number]
  }
};

interface ScheduleRouteMapProps {
  schedules: Schedule[];
  stores: RetailStore[];
  fleets: Fleet[];
  crews: Crew[];
  selectedScheduleId?: string | null;
  onSelectSchedule?: (schedule: Schedule) => void;
  onOpenManifest?: (schedule: Schedule) => void;
  onBackToSchedules?: () => void;
  className?: string;
}

interface ResolvedRoute {
  schedule: Schedule;
  originCoords: [number, number];
  originName: string;
  originAddress: string;
  destCoords: [number, number];
  destName: string;
  destCode: string;
  destAddress: string;
  destCity: string;
  destIsland: string;
  destCategory: string;
  destContact: string;
  destPhone: string;
  destWindow: string;
  isInterIsland: boolean;
  waypoints: [number, number][];
  distanceKm: number;
  estimatedHours: number;
  assignedFleet?: Fleet;
  assignedCrew?: Crew;
  assignedHelper?: Crew;
}

export const ScheduleRouteMap: React.FC<ScheduleRouteMapProps> = ({
  schedules,
  stores,
  fleets,
  crews,
  selectedScheduleId,
  onSelectSchedule,
  onOpenManifest,
  onBackToSchedules,
  className = ''
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const routeLayersGroupRef = useRef<L.LayerGroup | null>(null);

  // Component States
  const [activeScheduleId, setActiveScheduleId] = useState<string>(
    selectedScheduleId || (schedules.length > 0 ? schedules[0].id : '')
  );
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [dayFilter, setDayFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [showAllRoutes, setShowAllRoutes] = useState<boolean>(false);
  const [tileLayerType, setTileLayerType] = useState<'streets' | 'dark' | 'satellite'>('streets');
  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(true);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);

  // Sync external prop selectedScheduleId
  useEffect(() => {
    if (selectedScheduleId && selectedScheduleId !== activeScheduleId) {
      setActiveScheduleId(selectedScheduleId);
    }
  }, [selectedScheduleId]);

  // Helper to extract day of week from schedule
  const getScheduleDayName = (sch: Schedule): string => {
    if (sch.trackingNumber.includes('-SEN-') || sch.notes?.includes('Senin')) return 'Senin';
    if (sch.trackingNumber.includes('-SEL-') || sch.notes?.includes('Selasa')) return 'Selasa';
    if (sch.trackingNumber.includes('-RAB-') || sch.notes?.includes('Rabu')) return 'Rabu';
    if (sch.trackingNumber.includes('-KAM-') || sch.notes?.includes('Kamis')) return 'Kamis';
    if (sch.trackingNumber.includes('-JUM-') || sch.notes?.includes('Jumat')) return 'Jumat';
    if (sch.trackingNumber.includes('-SAB-') || sch.notes?.includes('Sabtu')) return 'Sabtu';

    if (sch.departureDate) {
      const d = new Date(sch.departureDate);
      if (!isNaN(d.getTime())) {
        const days = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
        return days[d.getDay()];
      }
    }
    return 'Reguler';
  };

  // Helper to find and resolve Store GPS coordinates
  const resolveStoreCoordinates = (sch: Schedule): {
    coords: [number, number];
    storeObj?: RetailStore;
    storeName: string;
    storeCode: string;
    address: string;
    city: string;
    island: string;
    category: string;
    contact: string;
    phone: string;
    deliveryWindow: string;
  } => {
    // 1. Direct schedule.store populated
    if (sch.store && sch.store.latitude && sch.store.longitude) {
      const lat = Number(sch.store.latitude);
      const lng = Number(sch.store.longitude);
      if (!isNaN(lat) && !isNaN(lng) && lat !== 0 && lng !== 0) {
        return {
          coords: [lat, lng],
          storeObj: sch.store,
          storeName: sch.store.storeName,
          storeCode: sch.store.storeCode || 'RET-STORE',
          address: sch.store.address || 'Alamat Terdaftar',
          city: sch.store.city || 'Banyuwangi',
          island: sch.store.island || 'Jawa',
          category: sch.store.storeCategory || 'Supermarket',
          contact: sch.store.contactPerson || 'PIC Toko',
          phone: sch.store.phone || '-',
          deliveryWindow: sch.store.deliveryWindow || '08:00 - 17:00'
        };
      }
    }

    // 2. Match in stores table by ID or storeCode
    const matchedStore = stores.find(s => s.id === sch.storeId || s.storeCode === sch.storeId);
    if (matchedStore) {
      const parsed = extractCoordinatesFromObject(matchedStore);
      if (parsed.isValid && parsed.latitude !== 0 && parsed.longitude !== 0) {
        return {
          coords: [parsed.latitude, parsed.longitude],
          storeObj: matchedStore,
          storeName: matchedStore.storeName,
          storeCode: matchedStore.storeCode,
          address: matchedStore.address,
          city: matchedStore.city,
          island: matchedStore.island,
          category: matchedStore.storeCategory,
          contact: matchedStore.contactPerson,
          phone: matchedStore.phone,
          deliveryWindow: matchedStore.deliveryWindow
        };
      }
    }

    // 3. Match in stores table by storeName or areaName
    const searchTarget = (sch.areaName || sch.store?.storeName || '').trim().toLowerCase();
    if (searchTarget) {
      const fuzzyStore = stores.find(s => 
        s.storeName.toLowerCase() === searchTarget ||
        s.storeName.toLowerCase().includes(searchTarget) ||
        searchTarget.includes(s.storeName.toLowerCase())
      );
      if (fuzzyStore) {
        const parsed = extractCoordinatesFromObject(fuzzyStore);
        if (parsed.isValid) {
          return {
            coords: [parsed.latitude, parsed.longitude],
            storeObj: fuzzyStore,
            storeName: fuzzyStore.storeName,
            storeCode: fuzzyStore.storeCode,
            address: fuzzyStore.address,
            city: fuzzyStore.city,
            island: fuzzyStore.island,
            category: fuzzyStore.storeCategory,
            contact: fuzzyStore.contactPerson,
            phone: fuzzyStore.phone,
            deliveryWindow: fuzzyStore.deliveryWindow
          };
        }
      }
    }

    // 4. Lookup in KNOWN_AREA_COORDINATES
    const upperTarget = (sch.areaName || sch.store?.storeName || sch.notes || '').toUpperCase();
    for (const [key, coords] of Object.entries(KNOWN_AREA_COORDINATES)) {
      if (upperTarget.includes(key)) {
        const isBali = key.includes('DENPASAR') || key.includes('SINGARAJA') || key.includes('NEGARA') || key.includes('BALI');
        return {
          coords,
          storeName: sch.areaName || sch.store?.storeName || key,
          storeCode: `COR-${key.replace(/\s+/g, '-').slice(0, 8)}`,
          address: `Koridor Distribusi Logistik ${key}`,
          city: isBali ? 'Denpasar / Bali' : 'Jawa Timur',
          island: isBali ? 'Bali & Nusa Tenggara' : 'Jawa',
          category: 'Distribution Hub',
          contact: 'PIC Distribusi Area',
          phone: '-',
          deliveryWindow: '08:00 - 18:00'
        };
      }
    }

    // 5. Fallback: Distributed offset around Banyuwangi central hub
    const defaultCoords: [number, number] = [-8.2850, 114.2800]; // Regional Rogojampi area
    return {
      coords: defaultCoords,
      storeName: sch.areaName || sch.store?.storeName || 'Area Distribusi Logistik',
      storeCode: 'DST-AKK-01',
      address: 'Wilayah Layanan Logistik PT AKK',
      city: 'Banyuwangi',
      island: 'Jawa',
      category: 'Minimarket Cluster',
      contact: 'PIC Toko',
      phone: '-',
      deliveryWindow: '08:00 - 17:00'
    };
  };

  // Build resolved route object for a given schedule
  const resolveRouteForSchedule = (sch: Schedule): ResolvedRoute => {
    const originCoords: [number, number] = sch.originCoords && sch.originCoords[0] && sch.originCoords[1]
      ? sch.originCoords
      : CENTRAL_WAREHOUSE.coordinates;

    const originName = sch.originName || CENTRAL_WAREHOUSE.name;
    const originAddress = CENTRAL_WAREHOUSE.address;

    const destInfo = resolveStoreCoordinates(sch);

    const assignedFleet = fleets.find(f => f.id === sch.fleetId) || sch.fleet;
    const assignedCrew = crews.find(c => c.id === sch.crewId) || sch.crew;
    const assignedHelper = crews.find(c => c.id === sch.crewHelperId) || sch.crewHelper;

    const isInterIsland = Boolean(
      sch.isInterIsland ||
      destInfo.island === 'Bali & Nusa Tenggara' ||
      destInfo.island === 'Sumatera' ||
      destInfo.city.toLowerCase().includes('denpasar') ||
      destInfo.city.toLowerCase().includes('singaraja') ||
      destInfo.city.toLowerCase().includes('negara') ||
      destInfo.city.toLowerCase().includes('bali')
    );

    // Build waypoints line connecting warehouse to store
    const waypoints: [number, number][] = [];
    waypoints.push(originCoords);

    if (isInterIsland && destInfo.island === 'Bali & Nusa Tenggara') {
      // Connect through Ketapang Port -> Gilimanuk Port -> Destination Store
      waypoints.push(FERRY_PORTS.KETAPANG.coords);
      waypoints.push(FERRY_PORTS.GILIMANUK.coords);
    }

    waypoints.push(destInfo.coords);

    // Calculate realistic distance in km
    let totalDistKm = 0;
    for (let i = 0; i < waypoints.length - 1; i++) {
      totalDistKm += calculateDistanceKm(
        waypoints[i][0],
        waypoints[i][1],
        waypoints[i + 1][0],
        waypoints[i + 1][1]
      );
    }

    // Multiply straight-line distance by average road winding curvature factor (1.28)
    const roadDistKm = Math.round(totalDistKm * 1.28 * 10) / 10;
    
    // Truck average speed ~42 km/h + ferry boarding & crossing time (2 hours) if inter-island
    let estHours = Math.round((roadDistKm / 42) * 10) / 10;
    if (isInterIsland) estHours += 2.0;

    return {
      schedule: sch,
      originCoords,
      originName,
      originAddress,
      destCoords: destInfo.coords,
      destName: destInfo.storeName,
      destCode: destInfo.storeCode,
      destAddress: destInfo.address,
      destCity: destInfo.city,
      destIsland: destInfo.island,
      destCategory: destInfo.category,
      destContact: destInfo.contact,
      destPhone: destInfo.phone,
      destWindow: destInfo.deliveryWindow,
      isInterIsland,
      waypoints,
      distanceKm: roadDistKm,
      estimatedHours: estHours,
      assignedFleet,
      assignedCrew,
      assignedHelper
    };
  };

  // Filtered schedules list
  const filteredSchedules = useMemo(() => {
    return schedules.filter(sch => {
      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesTrack = sch.trackingNumber.toLowerCase().includes(q);
        const matchesArea = (sch.areaName || '').toLowerCase().includes(q);
        const matchesStore = (sch.store?.storeName || '').toLowerCase().includes(q);
        const matchesNotes = (sch.notes || '').toLowerCase().includes(q);
        const assignedF = fleets.find(f => f.id === sch.fleetId);
        const matchesPlate = (assignedF?.plateNumber || '').toLowerCase().includes(q);
        const assignedC = crews.find(c => c.id === sch.crewId);
        const matchesCrew = (assignedC?.name || '').toLowerCase().includes(q);
        if (!matchesTrack && !matchesArea && !matchesStore && !matchesNotes && !matchesPlate && !matchesCrew) {
          return false;
        }
      }

      // Day filter
      if (dayFilter !== 'all') {
        const day = getScheduleDayName(sch);
        if (day !== dayFilter) return false;
      }

      // Status filter
      if (statusFilter !== 'all') {
        if (sch.status !== statusFilter) return false;
      }

      return true;
    });
  }, [schedules, searchQuery, dayFilter, statusFilter, fleets, crews]);

  // Selected Route Object
  const selectedRoute = useMemo(() => {
    const target = schedules.find(s => s.id === activeScheduleId) || filteredSchedules[0] || schedules[0];
    if (!target) return null;
    return resolveRouteForSchedule(target);
  }, [activeScheduleId, schedules, filteredSchedules, stores, fleets, crews]);

  // All routes for multi-schedule view
  const allFilteredRoutes = useMemo(() => {
    return filteredSchedules.map(sch => resolveRouteForSchedule(sch));
  }, [filteredSchedules, stores, fleets, crews]);

  // Initialize Leaflet Map
  useEffect(() => {
    if (!mapContainerRef.current) return;

    // Clean up existing leaflet ID
    if ((mapContainerRef.current as any)._leaflet_id) {
      delete (mapContainerRef.current as any)._leaflet_id;
    }

    if (mapInstanceRef.current) {
      mapInstanceRef.current.remove();
      mapInstanceRef.current = null;
    }

    // Default center at Central Warehouse DC
    const map = L.map(mapContainerRef.current, {
      center: CENTRAL_WAREHOUSE.coordinates,
      zoom: 9,
      zoomControl: false,
      attributionControl: true
    });

    // Custom Zoom Control top-right
    L.control.zoom({ position: 'topright' }).addTo(map);

    // Initial Tile Layer
    const tileUrls = {
      streets: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
      dark: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
      satellite: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'
    };

    L.tileLayer(tileUrls[tileLayerType], {
      attribution: '&copy; OpenStreetMap contributors | PT AKK Logistics DC',
      maxZoom: 18
    }).addTo(map);

    const routeGroup = L.layerGroup().addTo(map);
    routeLayersGroupRef.current = routeGroup;
    mapInstanceRef.current = map;

    // Trigger invalidateSize after render to eliminate tile gaps
    const timer = setTimeout(() => {
      map.invalidateSize();
    }, 250);

    return () => {
      clearTimeout(timer);
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [tileLayerType]);

  // Update Route Layers whenever selectedRoute or showAllRoutes changes
  useEffect(() => {
    const map = mapInstanceRef.current;
    const layerGroup = routeLayersGroupRef.current;
    if (!map || !layerGroup) return;

    layerGroup.clearLayers();

    // 1. Plot Origin Central Warehouse DC (Always Present)
    const warehouseIcon = L.divIcon({
      className: 'custom-warehouse-icon',
      html: `
        <div class="relative flex items-center justify-center -translate-x-1/2 -translate-y-1/2 cursor-pointer">
          <div class="absolute -inset-2 rounded-full bg-emerald-500/30 animate-ping"></div>
          <div class="relative w-9 h-9 rounded-2xl bg-slate-950 border-2 border-emerald-400 flex items-center justify-center text-sm shadow-2xl text-emerald-300 font-bold">
            🏢
          </div>
          <div class="absolute -bottom-6 px-2 py-0.5 rounded-md bg-slate-950/90 border border-emerald-500/40 text-[9px] font-bold text-emerald-300 whitespace-nowrap shadow">
            DC BANYUWANGI (PUSAT)
          </div>
        </div>
      `,
      iconSize: [36, 36]
    });

    const whMarker = L.marker(CENTRAL_WAREHOUSE.coordinates, { icon: warehouseIcon, zIndexOffset: 1000 })
      .bindPopup(`
        <div class="p-3 max-w-xs font-sans text-xs">
          <div class="flex items-center gap-1.5 px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-700 font-bold text-[10px] w-fit mb-1 border border-emerald-500/30">
            <span>🏢 PUSAT DISTRIBUSI & GUDANG UTAMA</span>
          </div>
          <h4 class="font-bold text-slate-900 text-sm leading-tight">${CENTRAL_WAREHOUSE.name}</h4>
          <p class="text-slate-600 mt-1 text-[11px]">${CENTRAL_WAREHOUSE.address}</p>
          <div class="mt-2 pt-2 border-t border-slate-200 text-[10px] space-y-0.5 text-slate-500 font-mono">
            <div>📞 Kontak: ${CENTRAL_WAREHOUSE.contact}</div>
            <div>📍 Plus Code: ${CENTRAL_WAREHOUSE.plusCode}</div>
            <div>⏱️ Jam Kerja: ${CENTRAL_WAREHOUSE.operatingHours}</div>
          </div>
        </div>
      `, { offset: [0, -18] });

    layerGroup.addLayer(whMarker);

    const bounds: [number, number][] = [CENTRAL_WAREHOUSE.coordinates];

    // COLOR PALETTE FOR ROUTES
    const ROUTE_COLORS = [
      '#2563eb', // Blue-600
      '#059669', // Emerald-600
      '#d97706', // Amber-600
      '#7c3aed', // Purple-600
      '#e11d48', // Rose-600
      '#0891b2', // Cyan-600
      '#4f46e5'  // Indigo-600
    ];

    if (showAllRoutes) {
      // MULTI-ROUTE MODE: Plot all filtered schedules
      allFilteredRoutes.forEach((route, idx) => {
        const color = ROUTE_COLORS[idx % ROUTE_COLORS.length];
        const isSelected = selectedRoute && selectedRoute.schedule.id === route.schedule.id;

        // Polyline connecting warehouse to store
        const polyline = L.polyline(route.waypoints, {
          color: isSelected ? '#38bdf8' : color,
          weight: isSelected ? 5.5 : 3.5,
          opacity: isSelected ? 1 : 0.75,
          dashArray: route.isInterIsland ? '8, 8' : undefined,
          lineCap: 'round',
          lineJoin: 'round'
        });

        polyline.bindTooltip(`
          <div class="p-1 font-sans text-xs">
            <b>${route.destName}</b> (${route.distanceKm} km)<br/>
            <span style="font-size:10px; color:#94a3b8;">${route.schedule.trackingNumber} • Truk: ${route.assignedFleet?.plateNumber || '-'}</span>
          </div>
        `, { sticky: true });

        polyline.on('click', () => {
          setActiveScheduleId(route.schedule.id);
          if (onSelectSchedule) onSelectSchedule(route.schedule);
        });

        layerGroup.addLayer(polyline);

        // Destination Marker
        const destIcon = L.divIcon({
          className: 'custom-dest-icon',
          html: `
            <div class="relative flex flex-col items-center cursor-pointer">
              <div class="px-2 py-0.5 rounded-lg ${isSelected ? 'bg-cyan-500 text-slate-950 ring-2 ring-white scale-110' : 'bg-slate-900 text-white border border-slate-700'} font-bold text-[10px] shadow-lg whitespace-nowrap flex items-center gap-1 transition-transform">
                <span>🏪</span>
                <span class="truncate max-w-[90px]">${route.destName}</span>
              </div>
              <div class="w-2.5 h-2.5 ${isSelected ? 'bg-cyan-500' : 'bg-slate-900'} rotate-45 -mt-1 border-r border-b ${isSelected ? 'border-cyan-300' : 'border-slate-700'}"></div>
            </div>
          `,
          iconSize: [80, 26]
        });

        const destMarker = L.marker(route.destCoords, { icon: destIcon });
        destMarker.on('click', () => {
          setActiveScheduleId(route.schedule.id);
          if (onSelectSchedule) onSelectSchedule(route.schedule);
        });

        layerGroup.addLayer(destMarker);
        bounds.push(route.destCoords);
      });

      // Fit map to show all destinations
      if (bounds.length > 1) {
        map.fitBounds(L.latLngBounds(bounds), { padding: [50, 50], maxZoom: 12 });
      }

    } else if (selectedRoute) {
      // SINGLE ROUTE FOCUS MODE: Detailed visualization for selected schedule
      bounds.push(selectedRoute.destCoords);

      // If Inter-Island (Bali), add Ferry Ports markers & waypoints
      if (selectedRoute.isInterIsland) {
        bounds.push(FERRY_PORTS.KETAPANG.coords);
        bounds.push(FERRY_PORTS.GILIMANUK.coords);

        // Ferry Ketapang Port Marker
        const ketapangIcon = L.divIcon({
          className: 'custom-ferry-icon',
          html: `
            <div class="relative flex flex-col items-center">
              <div class="px-2 py-0.5 rounded-lg bg-blue-600 text-white font-bold text-[10px] shadow-lg flex items-center gap-1 border border-blue-400">
                <span>🚢</span>
                <span>ASDP Ketapang</span>
              </div>
              <div class="w-2 h-2 bg-blue-600 rotate-45 -mt-1 border-r border-b border-blue-400"></div>
            </div>
          `,
          iconSize: [110, 24]
        });

        const ktgMarker = L.marker(FERRY_PORTS.KETAPANG.coords, { icon: ketapangIcon })
          .bindPopup(`
            <div class="p-2 font-sans text-xs">
              <h5 class="font-bold text-slate-900 text-xs">Pelabuhan Penyeberangan Ketapang</h5>
              <p class="text-[11px] text-slate-600 mt-0.5">Titik sandar feri logistik ASDP rute Jawa &rarr; Bali (Selat Bali).</p>
              <div class="mt-1 text-[10px] text-blue-700 font-semibold">Penyeberangan Roro 24 Jam</div>
            </div>
          `, { offset: [0, -10] });
        layerGroup.addLayer(ktgMarker);

        // Ferry Gilimanuk Port Marker
        const gilimanukIcon = L.divIcon({
          className: 'custom-ferry-icon',
          html: `
            <div class="relative flex flex-col items-center">
              <div class="px-2 py-0.5 rounded-lg bg-indigo-600 text-white font-bold text-[10px] shadow-lg flex items-center gap-1 border border-indigo-400">
                <span>🚢</span>
                <span>ASDP Gilimanuk</span>
              </div>
              <div class="w-2 h-2 bg-indigo-600 rotate-45 -mt-1 border-r border-b border-indigo-400"></div>
            </div>
          `,
          iconSize: [110, 24]
        });

        const glmMarker = L.marker(FERRY_PORTS.GILIMANUK.coords, { icon: gilimanukIcon })
          .bindPopup(`
            <div class="p-2 font-sans text-xs">
              <h5 class="font-bold text-slate-900 text-xs">Pelabuhan Penyeberangan Gilimanuk</h5>
              <p class="text-[11px] text-slate-600 mt-0.5">Gerbang masuk darat Pulau Bali untuk pengiriman FMCG & retail B2B.</p>
              <div class="mt-1 text-[10px] text-indigo-700 font-semibold">Pemeriksaan Surat Jalan & Logistik ASDP</div>
            </div>
          `, { offset: [0, -10] });
        layerGroup.addLayer(glmMarker);
      }

      // Draw Outer Glow / Background Polyline
      const glowPolyline = L.polyline(selectedRoute.waypoints, {
        color: '#0284c7', // Sky-600
        weight: 9,
        opacity: 0.35,
        lineCap: 'round',
        lineJoin: 'round'
      });
      layerGroup.addLayer(glowPolyline);

      // Draw Main Core Polyline
      const mainPolyline = L.polyline(selectedRoute.waypoints, {
        color: '#2563eb', // Blue-600
        weight: 4.5,
        opacity: 0.95,
        dashArray: selectedRoute.isInterIsland ? '8, 8' : undefined,
        lineCap: 'round',
        lineJoin: 'round'
      });

      mainPolyline.bindPopup(`
        <div class="p-3 font-sans text-xs max-w-xs">
          <div class="flex items-center justify-between pb-1.5 border-b border-slate-200 mb-2">
            <span class="font-mono font-bold text-blue-700 text-[11px]">${selectedRoute.schedule.trackingNumber}</span>
            <span class="px-1.5 py-0.2 rounded text-[9px] font-bold bg-blue-100 text-blue-800 uppercase">Rute Aktif</span>
          </div>
          <div class="space-y-1 text-[11px] text-slate-700">
            <div><strong>Tujuan:</strong> ${selectedRoute.destName}</div>
            <div><strong>Jarak:</strong> ${selectedRoute.distanceKm} km</div>
            <div><strong>Estimasi:</strong> ~${selectedRoute.estimatedHours} Jam Tempuh</div>
            <div><strong>Truk:</strong> ${selectedRoute.assignedFleet?.plateNumber || '-'} (${selectedRoute.assignedFleet?.vehicleType || '-'})</div>
            <div><strong>Supir:</strong> ${selectedRoute.assignedCrew?.name || '-'}</div>
            <div><strong>Muatan:</strong> ${selectedRoute.schedule.cargoWeightTon} Ton (${selectedRoute.schedule.cargoDescription || '-'})</div>
          </div>
        </div>
      `, { offset: [0, -10] });

      layerGroup.addLayer(mainPolyline);

      // Draw Destination Store Marker
      const destIcon = L.divIcon({
        className: 'custom-dest-focused-icon',
        html: `
          <div class="relative flex flex-col items-center cursor-pointer">
            <div class="absolute -inset-2 rounded-full bg-amber-500/30 animate-pulse"></div>
            <div class="px-2.5 py-1 rounded-xl bg-amber-500 text-slate-950 font-black text-[11px] shadow-2xl flex items-center gap-1.5 border-2 border-amber-200 whitespace-nowrap">
              <span>🏪</span>
              <span class="truncate max-w-[120px]">${selectedRoute.destName}</span>
            </div>
            <div class="w-3 h-3 bg-amber-500 rotate-45 -mt-1.5 border-r border-b border-amber-200"></div>
          </div>
        `,
        iconSize: [120, 32]
      });

      const destMarker = L.marker(selectedRoute.destCoords, { icon: destIcon, zIndexOffset: 900 })
        .bindPopup(`
          <div class="p-3.5 max-w-xs font-sans text-xs">
            <div class="flex items-center gap-1.5 px-2 py-0.5 rounded bg-amber-500/15 text-amber-800 font-bold text-[10px] w-fit mb-1 border border-amber-500/30">
              <span>📍 TITIK TUJUAN PENGIRIMAN</span>
            </div>
            <h4 class="font-bold text-slate-900 text-sm leading-tight">${selectedRoute.destName}</h4>
            <div class="text-[10px] text-slate-500 font-mono mt-0.5">Kode Toko: ${selectedRoute.destCode}</div>
            <p class="text-slate-600 mt-1 text-[11px] leading-relaxed">${selectedRoute.destAddress}</p>
            <div class="mt-2.5 pt-2 border-t border-slate-200 text-[10px] space-y-1 text-slate-600">
              <div class="flex items-center justify-between">
                <span>Wilayah / Kota:</span>
                <span class="font-bold text-slate-800">${selectedRoute.destCity} (${selectedRoute.destIsland})</span>
              </div>
              <div class="flex items-center justify-between">
                <span>Kategori Outlet:</span>
                <span class="font-semibold text-slate-700">${selectedRoute.destCategory}</span>
              </div>
              <div class="flex items-center justify-between">
                <span>Jendela Terima:</span>
                <span class="font-mono text-emerald-700 font-bold">${selectedRoute.destWindow}</span>
              </div>
              <div class="flex items-center justify-between">
                <span>PIC Penerima:</span>
                <span class="font-semibold text-slate-800">${selectedRoute.destContact}</span>
              </div>
            </div>
          </div>
        `, { offset: [0, -18] });

      layerGroup.addLayer(destMarker);

      // Auto-Fit Map to Selected Route Bounds smoothly
      if (bounds.length > 1) {
        map.flyToBounds(L.latLngBounds(bounds), {
          padding: [70, 70],
          maxZoom: 13,
          duration: 1.2
        });
      }
    }
  }, [selectedRoute, showAllRoutes, allFilteredRoutes]);

  // Recenter to Central Warehouse DC
  const handleRecenterToWarehouse = () => {
    if (!mapInstanceRef.current) return;
    mapInstanceRef.current.flyTo(CENTRAL_WAREHOUSE.coordinates, 12, { duration: 1.0 });
  };

  // Fit current route bounds
  const handleFitRouteBounds = () => {
    if (!mapInstanceRef.current || !selectedRoute) return;
    mapInstanceRef.current.flyToBounds(L.latLngBounds(selectedRoute.waypoints), {
      padding: [70, 70],
      maxZoom: 13,
      duration: 1.0
    });
  };

  // Open in Google Maps navigation
  const handleOpenGoogleMapsDirections = () => {
    if (!selectedRoute) return;
    const origin = `${selectedRoute.originCoords[0]},${selectedRoute.originCoords[1]}`;
    const dest = `${selectedRoute.destCoords[0]},${selectedRoute.destCoords[1]}`;
    const url = `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(dest)}&travelmode=driving`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const daysOfWeek = ['all', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];

  return (
    <div className={`space-y-4 ${className} ${isFullscreen ? 'fixed inset-0 z-50 bg-slate-950 p-4 flex flex-col' : ''}`}>
      {/* Top Header Card */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-sm space-y-4 shrink-0">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-blue-500/10 text-blue-400 text-xs font-semibold border border-blue-500/20">
                <Compass className="w-3.5 h-3.5 text-cyan-400" />
                <span>Navigasi Jalur GIS &amp; Leaflet.js</span>
              </div>
              <span className="text-[11px] font-mono text-slate-400">
                Titik Berangkat: {CENTRAL_WAREHOUSE.name.split('(')[0].trim()}
              </span>
            </div>
            <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
              <span>Peta Rute Interaktif Jadwal Pengiriman Logistik</span>
            </h2>
            <p className="text-slate-400 text-xs max-w-2xl mt-0.5">
              Visualisasi lintasan garis rute antara Gudang Pusat DC Banyuwangi dengan toko retail tujuan. Pilih jadwal pengiriman di panel untuk memetakan jarak tempuh, estimasi waktu, serta jalur penyeberangan Selat Bali.
            </p>
          </div>

          {/* Quick Actions & View Toggles */}
          <div className="flex items-center gap-2 flex-wrap">
            {onBackToSchedules && (
              <button
                type="button"
                onClick={onBackToSchedules}
                className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-200 border border-slate-700 text-xs font-semibold transition cursor-pointer flex items-center gap-1.5"
              >
                <span>&larr; Kembali ke Daftar Jadwal</span>
              </button>
            )}

            {/* Tile Layer Selector */}
            <div className="flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800">
              <button
                type="button"
                onClick={() => setTileLayerType('streets')}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition cursor-pointer ${
                  tileLayerType === 'streets' ? 'bg-blue-600 text-white shadow' : 'text-slate-400 hover:text-white'
                }`}
                title="Peta Standar OpenStreetMap"
              >
                Street
              </button>
              <button
                type="button"
                onClick={() => setTileLayerType('dark')}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition cursor-pointer ${
                  tileLayerType === 'dark' ? 'bg-blue-600 text-white shadow' : 'text-slate-400 hover:text-white'
                }`}
                title="Peta Tema Gelap (CartoDB Dark)"
              >
                Dark
              </button>
              <button
                type="button"
                onClick={() => setTileLayerType('satellite')}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition cursor-pointer ${
                  tileLayerType === 'satellite' ? 'bg-blue-600 text-white shadow' : 'text-slate-400 hover:text-white'
                }`}
                title="Peta Satelit Esri Imagery"
              >
                Satelit
              </button>
            </div>

            {/* Multi-route toggle button */}
            <button
              type="button"
              onClick={() => setShowAllRoutes(!showAllRoutes)}
              className={`px-3.5 py-2 rounded-xl text-xs font-semibold border transition cursor-pointer flex items-center gap-1.5 ${
                showAllRoutes
                  ? 'bg-cyan-600 text-white border-cyan-400 shadow-md ring-2 ring-cyan-400/30'
                  : 'bg-slate-950 text-slate-300 border-slate-800 hover:bg-slate-850'
              }`}
              title="Tampilkan semua rute jadwal secara bersamaan di peta"
            >
              <Layers className="w-3.5 h-3.5 text-cyan-400" />
              <span>{showAllRoutes ? 'Mode: Semua Rute Aktif' : 'Tampilkan Semua Rute'}</span>
            </button>

            {/* Fullscreen toggle */}
            <button
              type="button"
              onClick={() => setIsFullscreen(!isFullscreen)}
              className="p-2 rounded-xl bg-slate-950 hover:bg-slate-850 text-slate-300 border border-slate-800 text-xs transition cursor-pointer"
              title={isFullscreen ? 'Keluar Layar Penuh' : 'Mode Layar Penuh'}
            >
              {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Filter Controls Bar */}
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-3 pt-4 border-t border-slate-800/80">
          {/* Day of Week Selector Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto max-w-full pb-1 lg:pb-0">
            <span className="text-[11px] font-semibold text-slate-400 mr-1 flex items-center gap-1 shrink-0">
              <Calendar className="w-3 h-3 text-slate-500" />
              <span>Hari:</span>
            </span>
            {daysOfWeek.map(d => (
              <button
                key={d}
                type="button"
                onClick={() => setDayFilter(d)}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition shrink-0 cursor-pointer ${
                  dayFilter === d
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800/80'
                }`}
              >
                {d === 'all' ? 'Semua Hari' : d}
              </button>
            ))}
          </div>

          {/* Search Input & Status Filter */}
          <div className="flex items-center gap-2 w-full lg:w-auto">
            <div className="relative flex-1 lg:w-64">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cari rute, toko, supir, plat..."
                className="w-full pl-9 pr-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-2 text-slate-400 hover:text-white text-xs font-bold cursor-pointer"
                >
                  &times;
                </button>
              )}
            </div>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-200 focus:outline-none cursor-pointer"
            >
              <option value="all">Semua Status</option>
              <option value="in_transit">Sedang Jalan (In-Transit)</option>
              <option value="scheduled">Terjadwal (Scheduled)</option>
              <option value="delivered">Terkirim (Delivered)</option>
              <option value="delayed">Tertunda (Delayed)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Main Content Area: Split View with Schedule Selector on Left & Leaflet Map on Right */}
      <div className={`grid grid-cols-1 ${isSidebarOpen ? 'lg:grid-cols-12' : 'lg:grid-cols-1'} gap-4 ${isFullscreen ? 'flex-1 min-h-0' : ''}`}>
        
        {/* Left Side: Schedule Selector List */}
        {isSidebarOpen && (
          <div className="lg:col-span-4 flex flex-col bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-sm max-h-[640px] lg:max-h-[720px]">
            <div className="p-3.5 bg-slate-950/80 border-b border-slate-800 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <Navigation className="w-4 h-4 text-blue-400" />
                <h3 className="font-bold text-xs text-white">
                  Daftar Jadwal Pengiriman ({filteredSchedules.length})
                </h3>
              </div>
              <span className="text-[10px] text-slate-400 font-mono">
                Pilih untuk lihat rute
              </span>
            </div>

            {/* List of Schedule Cards */}
            <div className="divide-y divide-slate-800/70 overflow-y-auto flex-1 overscroll-contain p-2 space-y-1.5">
              {filteredSchedules.length === 0 ? (
                <div className="py-12 text-center text-slate-400 p-4">
                  <Navigation className="w-8 h-8 text-slate-600 mx-auto mb-2 opacity-50" />
                  <p className="font-semibold text-slate-300 text-xs">Tidak ada jadwal ditemukan</p>
                  <p className="text-[11px] text-slate-500 mt-1">Coba sesuaikan kata kunci pencarian atau filter hari.</p>
                  <button
                    type="button"
                    onClick={() => { setSearchQuery(''); setDayFilter('all'); setStatusFilter('all'); }}
                    className="mt-3 px-3 py-1.5 rounded-lg bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 border border-blue-500/30 text-xs font-semibold cursor-pointer"
                  >
                    Reset Filter
                  </button>
                </div>
              ) : (
                filteredSchedules.map(sch => {
                  const isSelected = selectedRoute && selectedRoute.schedule.id === sch.id;
                  const dayName = getScheduleDayName(sch);
                  const assignedF = fleets.find(f => f.id === sch.fleetId);
                  const assignedC = crews.find(c => c.id === sch.crewId);
                  const routeInfo = resolveRouteForSchedule(sch);

                  return (
                    <div
                      key={sch.id}
                      onClick={() => {
                        setActiveScheduleId(sch.id);
                        if (onSelectSchedule) onSelectSchedule(sch);
                      }}
                      className={`p-3 rounded-xl border transition cursor-pointer text-xs space-y-2 ${
                        isSelected
                          ? 'bg-blue-950/40 border-blue-500 shadow-md ring-1 ring-blue-500/50'
                          : 'bg-slate-950/50 hover:bg-slate-850 border-slate-800/80'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono font-bold text-white text-xs">
                            {sch.trackingNumber}
                          </span>
                          <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-slate-800 text-slate-300 border border-slate-700">
                            {dayName}
                          </span>
                        </div>

                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                          sch.status === 'in_transit'
                            ? 'bg-blue-500/15 text-blue-400 border-blue-500/30'
                            : sch.status === 'delivered'
                            ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                            : sch.status === 'delayed'
                            ? 'bg-rose-500/15 text-rose-400 border-rose-500/30'
                            : 'bg-amber-500/15 text-amber-400 border-amber-500/30'
                        }`}>
                          {sch.status === 'in_transit' && '● Jalan'}
                          {sch.status === 'scheduled' && '● Jadwal'}
                          {sch.status === 'delivered' && '✓ Selesai'}
                          {sch.status === 'delayed' && '⚠ Tertunda'}
                        </span>
                      </div>

                      {/* Store Destination & Area */}
                      <div>
                        <div className="font-bold text-white flex items-center gap-1 text-xs">
                          <MapPin className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                          <span className="truncate">{routeInfo.destName}</span>
                        </div>
                        <div className="text-[10px] text-slate-400 pl-4.5 truncate">
                          {routeInfo.destCity} &bull; {routeInfo.destAddress}
                        </div>
                      </div>

                      {/* Metrics: Distance, ETA, Fleet & Crew */}
                      <div className="grid grid-cols-2 gap-2 pt-1.5 border-t border-slate-800/60 text-[11px]">
                        <div className="flex items-center gap-1 text-cyan-300 font-mono">
                          <Compass className="w-3 h-3 text-cyan-400" />
                          <span>{routeInfo.distanceKm} km (~{routeInfo.estimatedHours}j)</span>
                        </div>
                        <div className="flex items-center gap-1 text-slate-300 truncate">
                          <Truck className="w-3 h-3 text-blue-400 shrink-0" />
                          <span className="font-mono truncate">{assignedF?.plateNumber || sch.fleetId}</span>
                        </div>
                      </div>

                      {/* Quick Action when selected */}
                      {isSelected && (
                        <div className="flex items-center justify-between pt-1 border-t border-blue-500/20 text-[10px]">
                          <span className="text-emerald-400 font-bold flex items-center gap-1">
                            <Check className="w-3 h-3" />
                            Rute Aktif Terpilih di Peta
                          </span>
                          {onOpenManifest && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                onOpenManifest(sch);
                              }}
                              className="text-blue-300 hover:text-white underline font-medium cursor-pointer"
                            >
                              Surat Jalan &rarr;
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        {/* Right Side: Leaflet Interactive Map Container & Floating Route HUD */}
        <div className={`${isSidebarOpen ? 'lg:col-span-8' : 'lg:col-span-12'} flex flex-col space-y-4`}>
          <div className="relative bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-sm flex flex-col flex-1 min-h-[520px] lg:min-h-[580px]">
            
            {/* Map Floating Toolbar */}
            <div className="absolute top-3 left-3 z-[1000] flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                className="px-3 py-1.5 rounded-xl bg-slate-900/90 backdrop-blur-md text-white border border-slate-700 text-xs font-semibold shadow-lg hover:bg-slate-800 transition cursor-pointer flex items-center gap-1.5"
                title="Tampilkan / Sembunyikan Daftar Jadwal"
              >
                <Navigation className="w-3.5 h-3.5 text-blue-400" />
                <span>{isSidebarOpen ? 'Sembunyikan Menu' : 'Buka Daftar Jadwal'}</span>
              </button>

              <button
                type="button"
                onClick={handleRecenterToWarehouse}
                className="px-3 py-1.5 rounded-xl bg-slate-900/90 backdrop-blur-md text-white border border-slate-700 text-xs font-semibold shadow-lg hover:bg-slate-800 transition cursor-pointer flex items-center gap-1.5"
                title="Fokuskan peta ke Gudang Pusat DC Banyuwangi"
              >
                <RotateCcw className="w-3.5 h-3.5 text-emerald-400" />
                <span className="hidden sm:inline">Gudang Pusat DC</span>
              </button>

              {selectedRoute && (
                <button
                  type="button"
                  onClick={handleFitRouteBounds}
                  className="px-3 py-1.5 rounded-xl bg-blue-600/90 backdrop-blur-md text-white border border-blue-400 text-xs font-semibold shadow-lg hover:bg-blue-500 transition cursor-pointer flex items-center gap-1.5"
                  title="Fokuskan tampilan ke seluruh rute pengiriman"
                >
                  <Compass className="w-3.5 h-3.5" />
                  <span>Fokuskan Rute</span>
                </button>
              )}
            </div>

            {/* Map Status Badge (Top-Right under Zoom controls) */}
            <div className="absolute top-16 right-3 z-[1000] hidden sm:flex flex-col items-end gap-1.5 pointer-events-none">
              <div className="px-2.5 py-1 rounded-lg bg-slate-950/85 backdrop-blur-md border border-slate-800 text-[10px] text-slate-300 font-mono shadow-md">
                <span>Pusat: -8.1906, 114.3708</span>
              </div>
              {selectedRoute?.isInterIsland && (
                <div className="px-2.5 py-1 rounded-lg bg-indigo-950/90 backdrop-blur-md border border-indigo-500/40 text-[10px] text-indigo-300 font-bold shadow-md flex items-center gap-1">
                  <Ship className="w-3 h-3 text-indigo-400" />
                  <span>Jalur Penyeberangan ASDP Ketapang - Gilimanuk</span>
                </div>
              )}
            </div>

            {/* Map Element */}
            <div
              ref={mapContainerRef}
              className="w-full flex-1 min-h-[520px] lg:min-h-[580px] bg-slate-950 z-0"
              style={{ minHeight: '520px' }}
            />
          </div>

          {/* Bottom HUD: Selected Route Comprehensive Metadata Panel */}
          {selectedRoute && (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-sm space-y-4">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pb-3 border-b border-slate-800">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-blue-500/20 border border-blue-500/30 flex items-center justify-center text-blue-400 font-bold shrink-0">
                    <Navigation className="w-5 h-5 text-blue-400" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold text-white text-sm font-mono">
                        {selectedRoute.schedule.trackingNumber}
                      </h3>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                        selectedRoute.schedule.status === 'in_transit'
                          ? 'bg-blue-500/15 text-blue-400 border-blue-500/30'
                          : selectedRoute.schedule.status === 'delivered'
                          ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                          : 'bg-amber-500/15 text-amber-400 border-amber-500/30'
                      }`}>
                        {selectedRoute.schedule.status === 'in_transit' && '● Sedang Dalam Perjalanan'}
                        {selectedRoute.schedule.status === 'scheduled' && '● Terjadwal Siap Berangkat'}
                        {selectedRoute.schedule.status === 'delivered' && '✓ Terkirim Selesai'}
                      </span>
                      {selectedRoute.isInterIsland && (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 flex items-center gap-1">
                          <Ship className="w-3 h-3 text-indigo-400" />
                          Antar-Pulau (Bali)
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Rute: <strong className="text-slate-200">{selectedRoute.originName}</strong> &rarr; <strong className="text-amber-400">{selectedRoute.destName}</strong>
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 self-start lg:self-center">
                  <button
                    type="button"
                    onClick={handleOpenGoogleMapsDirections}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-200 border border-slate-700 text-xs font-semibold shadow transition cursor-pointer"
                    title="Buka navigasi petunjuk arah di Google Maps"
                  >
                    <ExternalLink className="w-3.5 h-3.5 text-blue-400" />
                    <span>Buka Google Maps</span>
                  </button>

                  {onOpenManifest && (
                    <button
                      type="button"
                      onClick={() => onOpenManifest(selectedRoute.schedule)}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-lg shadow-blue-600/20 transition cursor-pointer"
                      title="Lihat & Cetak Surat Jalan PDF"
                    >
                      <FileText className="w-3.5 h-3.5" />
                      <span>Surat Jalan &amp; Manifest</span>
                    </button>
                  )}
                </div>
              </div>

              {/* 4 Cards Grid of Operational Information */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
                {/* 1. Point of Origin */}
                <div className="bg-slate-950/70 p-3 rounded-xl border border-slate-800/90 space-y-1.5">
                  <span className="text-[10px] text-emerald-400 font-bold uppercase tracking-wider block flex items-center gap-1">
                    <span>🏢 TITIK ASAL KEBERANGKATAN</span>
                  </span>
                  <div className="font-bold text-white text-xs leading-tight">
                    {selectedRoute.originName}
                  </div>
                  <p className="text-[11px] text-slate-400 leading-relaxed truncate" title={selectedRoute.originAddress}>
                    {selectedRoute.originAddress}
                  </p>
                  <div className="text-[10px] font-mono text-slate-500 pt-1 border-t border-slate-800">
                    GPS: {selectedRoute.originCoords[0]}, {selectedRoute.originCoords[1]}
                  </div>
                </div>

                {/* 2. Destination Store */}
                <div className="bg-slate-950/70 p-3 rounded-xl border border-slate-800/90 space-y-1.5">
                  <span className="text-[10px] text-amber-400 font-bold uppercase tracking-wider block flex items-center gap-1">
                    <span>🏪 OUTLET / TUJUAN PENGIRIMAN</span>
                  </span>
                  <div className="font-bold text-amber-300 text-xs leading-tight truncate" title={selectedRoute.destName}>
                    {selectedRoute.destName}
                  </div>
                  <p className="text-[11px] text-slate-400 leading-relaxed truncate" title={selectedRoute.destAddress}>
                    {selectedRoute.destCity} &bull; {selectedRoute.destAddress}
                  </p>
                  <div className="text-[10px] text-slate-400 pt-1 border-t border-slate-800 flex items-center justify-between">
                    <span>PIC: {selectedRoute.destContact}</span>
                    <span className="text-emerald-400 font-mono">{selectedRoute.destWindow}</span>
                  </div>
                </div>

                {/* 3. Distance & Travel Metrics */}
                <div className="bg-slate-950/70 p-3 rounded-xl border border-slate-800/90 space-y-1.5">
                  <span className="text-[10px] text-cyan-400 font-bold uppercase tracking-wider block flex items-center gap-1">
                    <span>⏱️ METRIK JARAK &amp; ESTIMASI</span>
                  </span>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Jarak Tempuh:</span>
                    <span className="font-mono font-bold text-white text-xs">{selectedRoute.distanceKm} km</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Estimasi Waktu:</span>
                    <span className="font-mono font-bold text-cyan-300 text-xs">~{selectedRoute.estimatedHours} Jam</span>
                  </div>
                  <div className="pt-1 border-t border-slate-800 text-[10px] text-slate-400 flex items-center justify-between">
                    <span>Koridor:</span>
                    <span className="text-slate-300 font-medium">
                      {selectedRoute.isInterIsland ? 'Darat + Feri ASDP' : 'Darat Regional'}
                    </span>
                  </div>
                </div>

                {/* 4. Fleet & Crew Allocation */}
                <div className="bg-slate-950/70 p-3 rounded-xl border border-slate-800/90 space-y-1.5">
                  <span className="text-[10px] text-indigo-400 font-bold uppercase tracking-wider block flex items-center gap-1">
                    <span>🚛 ARMADA TRUK &amp; KRU</span>
                  </span>
                  <div className="flex items-center justify-between font-mono">
                    <span className="font-bold text-white">{selectedRoute.assignedFleet?.plateNumber || '-'}</span>
                    <span className="text-[10px] text-blue-400">
                      {selectedRoute.assignedFleet?.initialCode ? `(${selectedRoute.assignedFleet.initialCode})` : (selectedRoute.assignedFleet?.vehicleType || '-')}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-300 flex items-center gap-1 truncate">
                    <User className="w-3 h-3 text-slate-500 shrink-0" />
                    <span className="truncate">Supir: {selectedRoute.assignedCrew?.name || 'Belum Ditugaskan'}</span>
                  </div>
                  <div className="pt-1 border-t border-slate-800 text-[10px] text-slate-400 flex items-center justify-between">
                    <span>Muatan:</span>
                    <span className="font-semibold text-white">{selectedRoute.schedule.cargoWeightTon} Ton</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
