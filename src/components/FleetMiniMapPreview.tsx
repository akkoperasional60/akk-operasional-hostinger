import React, { useEffect, useRef, useState, useMemo } from 'react';
import L from 'leaflet';
import { 
  Navigation, 
  MapPin, 
  Truck, 
  RotateCcw, 
  Maximize2, 
  Minimize2, 
  Radio, 
  Zap, 
  Clock, 
  Building2, 
  Compass, 
  ExternalLink,
  Signal,
  CheckCircle2,
  AlertTriangle,
  Layers,
  X
} from 'lucide-react';
import { Fleet, TracksolidDevice, Schedule, RetailStore } from '../types';
import { logisticsStore } from '../services/store';
import { CENTRAL_WAREHOUSE } from '../data/mockData';
import { BANYUWANGI_TRACKSOLID_POINTS } from '../data/banyuwangiTracksolidRoute';

interface FleetMiniMapPreviewProps {
  fleet: Fleet;
  onOpenFullTracksolid?: (imei?: string) => void;
  className?: string;
  defaultExpanded?: boolean;
}

// Known delivery corridor coordinates for destination fallback
const AREA_COORDINATES_MAP: Record<string, [number, number]> = {
  'DENPASAR 1': [-8.6705, 115.2126],
  'DENPASAR 2': [-8.6500, 115.2200],
  'SINGARAJA': [-8.1120, 115.0880],
  'NEGARA': [-8.3580, 114.6190],
  'GIANYAR': [-8.5440, 115.3280],
  'TABANAN': [-8.5380, 115.1250],
  'SITUBONDO': [-7.7063, 114.0048],
  'BONDOWOSO': [-7.9135, 113.8214],
  'JEMBER KOTA': [-8.1724, 113.7007],
  'JEMBER SELATAN': [-8.3100, 113.5600],
  'GENTENG': [-8.3650, 114.1530],
  'ROGOJAMPI': [-8.3050, 114.2980],
  'SRONO': [-8.3980, 114.2650],
  'MUNCAR': [-8.4350, 114.3350],
  'JAJAG RETAIL': [-8.4020, 114.1480],
  'PURWO PASAR': [-8.5080, 114.2480],
  'PURWO DAMBUNTUNG': [-8.5200, 114.2600],
  'SUMBERAYU RETAIL': [-8.4500, 114.2100],
  'GALEKAN': [-8.2700, 114.3200],
  'GROSIR 1': [-8.2300, 114.3500],
  'GROSIR BWI': [-8.2200, 114.3600],
  'BWI KOTA SELATAN': [-8.2400, 114.3600],
  'KETAPANG - WONGSOREJO': [-8.0800, 114.4100],
  'BANYUWANGI': [-8.2190, 114.3680]
};

export const FleetMiniMapPreview: React.FC<FleetMiniMapPreviewProps> = ({
  fleet,
  onOpenFullTracksolid,
  className = '',
  defaultExpanded = true
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const layerGroupRef = useRef<L.LayerGroup | null>(null);

  const [isExpanded, setIsExpanded] = useState<boolean>(defaultExpanded);
  const [isFullscreenModal, setIsFullscreenModal] = useState<boolean>(false);
  const [devices, setDevices] = useState<TracksolidDevice[]>(logisticsStore.getDevices());
  const [schedules, setSchedules] = useState<Schedule[]>(logisticsStore.getSchedules());

  // Listen for store changes
  useEffect(() => {
    const unsub = logisticsStore.subscribe(() => {
      setDevices(logisticsStore.getDevices());
      setSchedules(logisticsStore.getSchedules());
    });
    return () => unsub();
  }, []);

  // Match GPS Device for this Fleet
  const matchedDevice = useMemo(() => {
    return devices.find(d => 
      d.vehiclePlate.toLowerCase().replace(/\s+/g, '') === fleet.plateNumber.toLowerCase().replace(/\s+/g, '') ||
      (fleet.gpsImei && d.imei === fleet.gpsImei) ||
      (fleet.initialCode && d.vehicleName && d.vehicleName.toLowerCase().includes(fleet.initialCode.toLowerCase().split('/')[0].trim()))
    );
  }, [devices, fleet]);

  // Match Active Schedule / Route for this Fleet
  const activeSchedule = useMemo(() => {
    // 1. Try to find in_transit or scheduled shipment for this fleet
    const active = schedules.find(s => 
      (s.fleetId === fleet.id || (s.fleet && s.fleet.id === fleet.id) || (s.fleet && s.fleet.plateNumber === fleet.plateNumber)) &&
      (s.status === 'in_transit' || s.status === 'scheduled')
    );
    if (active) return active;

    // 2. Fall back to latest delivery record for this fleet
    return schedules.find(s => 
      s.fleetId === fleet.id || (s.fleet && s.fleet.id === fleet.id) || (s.fleet && s.fleet.plateNumber === fleet.plateNumber)
    );
  }, [schedules, fleet]);

  // Determine Origin, Live Location, and Destination Coordinates
  const routeData = useMemo(() => {
    const originCoords: [number, number] = [CENTRAL_WAREHOUSE.coordinates[0], CENTRAL_WAREHOUSE.coordinates[1]];
    const originName = CENTRAL_WAREHOUSE.name || 'Gudang Pusat Sukowidi DC';

    // Live Vehicle Position
    let liveLat = matchedDevice?.latitude;
    let liveLng = matchedDevice?.longitude;

    // Destination Location
    let destCoords: [number, number] | null = null;
    let destName = 'Area Distribusi Reguler';

    if (activeSchedule) {
      destName = activeSchedule.areaName || activeSchedule.store?.storeName || 'Area Tujuan';
      if (activeSchedule.store?.latitude && activeSchedule.store?.longitude && !isNaN(activeSchedule.store.latitude)) {
        destCoords = [activeSchedule.store.latitude, activeSchedule.store.longitude];
      } else {
        // Look up by area name key
        const upper = destName.toUpperCase();
        for (const [key, coords] of Object.entries(AREA_COORDINATES_MAP)) {
          if (upper.includes(key)) {
            destCoords = coords;
            break;
          }
        }
      }
    }

    // Default destination if not resolvable
    if (!destCoords) {
      if (fleet.initialCode?.includes('DS1') || fleet.initialCode?.includes('N22')) {
        destCoords = AREA_COORDINATES_MAP['DENPASAR 1'];
        destName = 'Denpasar 1 (Bali)';
      } else if (fleet.initialCode?.includes('DS2') || fleet.initialCode?.includes('N23')) {
        destCoords = AREA_COORDINATES_MAP['SITUBONDO'];
        destName = 'Situbondo';
      } else if (fleet.initialCode?.includes('NL1') || fleet.initialCode?.includes('N20')) {
        destCoords = AREA_COORDINATES_MAP['GENTENG'];
        destName = 'Genteng & Rogojampi';
      } else {
        destCoords = [-8.3050, 114.2980]; // Rogojampi / Banyuwangi Selatan
        destName = 'Distribusi Banyuwangi';
      }
    }

    // If device position is not reported, place realistically between DC and destination
    if (!liveLat || !liveLng || isNaN(liveLat) || isNaN(liveLng)) {
      if (fleet.status === 'on-duty') {
        liveLat = Number((originCoords[0] * 0.45 + destCoords[0] * 0.55).toFixed(6));
        liveLng = Number((originCoords[1] * 0.45 + destCoords[1] * 0.55).toFixed(6));
      } else {
        liveLat = originCoords[0] + (Math.random() - 0.5) * 0.003;
        liveLng = originCoords[1] + (Math.random() - 0.5) * 0.003;
      }
    }

    const liveCoords: [number, number] = [liveLat, liveLng];

    // Build sequential route polyline coordinates
    const waypoints: [number, number][] = [originCoords];

    // Interpolate nice road curvature waypoints
    const mid1: [number, number] = [
      Number((originCoords[0] * 0.7 + liveCoords[0] * 0.3).toFixed(6)),
      Number((originCoords[1] * 0.7 + liveCoords[1] * 0.3 + 0.005).toFixed(6))
    ];
    waypoints.push(mid1);
    waypoints.push(liveCoords);

    if (destCoords) {
      const mid2: [number, number] = [
        Number((liveCoords[0] * 0.5 + destCoords[0] * 0.5).toFixed(6)),
        Number((liveCoords[1] * 0.5 + destCoords[1] * 0.5 - 0.004).toFixed(6))
      ];
      waypoints.push(mid2);
      waypoints.push(destCoords);
    }

    return {
      originCoords,
      originName,
      liveCoords,
      destCoords,
      destName,
      waypoints,
      speed: matchedDevice?.currentSpeedKmh !== undefined ? matchedDevice.currentSpeedKmh : (fleet.status === 'on-duty' ? 38 : 0),
      status: matchedDevice?.status || (fleet.status === 'on-duty' ? 'Moving' : 'Parkir/Standby'),
      address: matchedDevice?.address || (fleet.status === 'on-duty' ? `Dalam Perjalanan menuju ${destName}` : 'Standby di Pool Banyuwangi DC'),
      battery: matchedDevice?.batteryPercent || 98,
      satellites: matchedDevice?.satellites || 10,
      todayMileageKm: matchedDevice?.todayMileageKm || (fleet.status === 'on-duty' ? 84.5 : 0)
    };
  }, [matchedDevice, activeSchedule, fleet]);

  // Initialize and Render Leaflet Map
  useEffect(() => {
    if (!isExpanded || !mapContainerRef.current) return;

    const container = mapContainerRef.current;

    // Clean up any stale leaflet ID on container
    if ((container as any)._leaflet_id) {
      delete (container as any)._leaflet_id;
    }

    // Destroy existing instance if any
    if (mapInstanceRef.current) {
      mapInstanceRef.current.remove();
      mapInstanceRef.current = null;
    }

    try {
      // 1. Create Leaflet Map Instance
      const map = L.map(container, {
        center: routeData.liveCoords,
        zoom: 11,
        zoomControl: false,
        attributionControl: false,
        scrollWheelZoom: false,
        dragging: true,
        doubleClickZoom: false
      });

      mapInstanceRef.current = map;

      // 2. High-contrast Dark Matter / Voyager Tile Layer
      L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
        maxZoom: 19,
        subdomains: 'abcd'
      }).addTo(map);

      const layerGroup = L.layerGroup().addTo(map);
      layerGroupRef.current = layerGroup;

      // 3. Draw Route Polylines (Glow + Main Line)
      // A. Glow Background Line
      L.polyline(routeData.waypoints, {
        color: '#3b82f6',
        weight: 6,
        opacity: 0.35,
        lineCap: 'round',
        lineJoin: 'round'
      }).addTo(layerGroup);

      // B. Main Route Polyline (Dashed animated style)
      L.polyline(routeData.waypoints, {
        color: '#2563eb',
        weight: 3.5,
        opacity: 0.95,
        dashArray: '6, 8',
        lineCap: 'round',
        lineJoin: 'round'
      }).addTo(layerGroup);

      // 4. Origin Marker (Gudang Pusat Sukowidi DC)
      const originIcon = L.divIcon({
        className: 'custom-leaflet-origin-marker',
        html: `
          <div class="flex items-center justify-center -translate-x-1/2 -translate-y-1/2">
            <div class="w-6 h-6 rounded-full bg-slate-900 border-2 border-emerald-400 flex items-center justify-center text-[11px] text-emerald-400 shadow-md font-bold">
              🏢
            </div>
          </div>
        `,
        iconSize: [24, 24]
      });

      L.marker(routeData.originCoords, { icon: originIcon })
        .bindTooltip(`<b>${routeData.originName}</b><br/><span style="font-size:10px; color:#10b981;">Titik Awal Keberangkatan</span>`, {
          direction: 'top',
          offset: [0, -12]
        })
        .addTo(layerGroup);

      // 5. Destination Marker (Area Kirim / Toko)
      if (routeData.destCoords) {
        const destIcon = L.divIcon({
          className: 'custom-leaflet-dest-marker',
          html: `
            <div class="flex items-center justify-center -translate-x-1/2 -translate-y-1/2">
              <div class="px-2 py-0.5 rounded-lg bg-amber-500 border border-amber-300 text-slate-950 font-extrabold text-[10px] shadow-lg flex items-center gap-1 whitespace-nowrap">
                <span>📍</span>
                <span class="truncate max-w-[100px]">${routeData.destName}</span>
              </div>
            </div>
          `,
          iconSize: [80, 24]
        });

        L.marker(routeData.destCoords, { icon: destIcon })
          .bindTooltip(`<b>Tujuan: ${routeData.destName}</b><br/><span style="font-size:10px; color:#f59e0b;">Target Pengiriman Resmi</span>`, {
            direction: 'top',
            offset: [0, -12]
          })
          .addTo(layerGroup);
      }

      // 6. Live Vehicle Position Marker
      const isMoving = routeData.speed > 0;
      const truckIcon = L.divIcon({
        className: 'custom-leaflet-truck-marker',
        html: `
          <div class="relative flex items-center justify-center -translate-x-1/2 -translate-y-1/2">
            ${isMoving ? '<div class="absolute -inset-2 rounded-full bg-blue-500/40 animate-ping"></div>' : ''}
            <div class="relative px-2 py-1 rounded-xl bg-slate-950 border-2 ${isMoving ? 'border-blue-400 text-blue-300' : 'border-slate-600 text-slate-300'} font-black text-[10px] shadow-xl flex items-center gap-1.5 whitespace-nowrap">
              <span class="text-xs">🚛</span>
              <div class="flex flex-col leading-tight">
                <span class="font-mono text-white text-[10px]">${fleet.plateNumber}</span>
                <span class="text-[8px] ${isMoving ? 'text-emerald-400 font-bold' : 'text-slate-400'}">${isMoving ? `${routeData.speed} km/h` : 'Parkir'}</span>
              </div>
            </div>
          </div>
        `,
        iconSize: [85, 30]
      });

      L.marker(routeData.liveCoords, { icon: truckIcon })
        .bindTooltip(`<b>${fleet.plateNumber} (${fleet.vehicleType})</b><br/><span style="font-size:10px; color:#38bdf8;">${routeData.address}</span>`, {
          direction: 'top',
          offset: [0, -15]
        })
        .addTo(layerGroup);

      // 7. Auto-fit all points with bounds padding
      const allPoints: L.LatLngExpression[] = [routeData.originCoords, routeData.liveCoords];
      if (routeData.destCoords) allPoints.push(routeData.destCoords);

      const bounds = L.latLngBounds(allPoints);
      map.fitBounds(bounds, {
        padding: [22, 22],
        maxZoom: 13
      });

      // Handle resize invalidation
      const timer = setTimeout(() => {
        if (mapInstanceRef.current) {
          mapInstanceRef.current.invalidateSize();
        }
      }, 250);

      return () => {
        clearTimeout(timer);
        if (mapInstanceRef.current) {
          mapInstanceRef.current.remove();
          mapInstanceRef.current = null;
        }
      };
    } catch (err) {
      console.warn('[FleetMiniMapPreview] Leaflet initialization error:', err);
    }
  }, [isExpanded, routeData, fleet.plateNumber, fleet.vehicleType]);

  // Trigger map invalidate size on tab/window visibility
  const handleRecenter = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (mapInstanceRef.current) {
      const allPoints: L.LatLngExpression[] = [routeData.originCoords, routeData.liveCoords];
      if (routeData.destCoords) allPoints.push(routeData.destCoords);
      mapInstanceRef.current.fitBounds(L.latLngBounds(allPoints), {
        padding: [20, 20],
        maxZoom: 13
      });
      mapInstanceRef.current.invalidateSize();
    }
  };

  const handleZoomIn = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (mapInstanceRef.current) mapInstanceRef.current.zoomIn();
  };

  const handleZoomOut = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (mapInstanceRef.current) mapInstanceRef.current.zoomOut();
  };

  return (
    <div className={`rounded-xl border border-slate-800 bg-slate-950/80 overflow-hidden shadow-inner transition ${className}`}>
      {/* Header Bar */}
      <div 
        onClick={() => setIsExpanded(!isExpanded)}
        className="px-3 py-2 bg-slate-900/90 border-b border-slate-800/80 flex items-center justify-between cursor-pointer hover:bg-slate-850 transition select-none"
      >
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-6 h-6 rounded-lg bg-blue-500/15 border border-blue-500/30 flex items-center justify-center shrink-0">
            <Radio className="w-3.5 h-3.5 text-blue-400 animate-pulse" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] font-black text-slate-200 truncate">
                Rute Aktif &amp; GPS Live
              </span>
              {routeData.speed > 0 ? (
                <span className="px-1.5 py-0.2 rounded text-[9px] font-black bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  {routeData.speed} KM/H
                </span>
              ) : (
                <span className="px-1.5 py-0.2 rounded text-[9px] font-semibold bg-slate-800 text-slate-400 border border-slate-700">
                  Standby
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1.5 text-slate-400">
          <span className="text-[10px] text-blue-400 hover:underline font-semibold" onClick={(e) => {
            e.stopPropagation();
            if (onOpenFullTracksolid) onOpenFullTracksolid(fleet.gpsImei);
          }}>
            {isExpanded ? 'Tutup Peta' : 'Buka Peta'}
          </span>
        </div>
      </div>

      {/* Map Body */}
      {isExpanded && (
        <div className="relative">
          {/* Map Container */}
          <div 
            ref={mapContainerRef} 
            className="w-full h-44 sm:h-48 bg-slate-950 relative z-0"
            style={{ minHeight: '176px' }}
          />

          {/* Top Telematics HUD Overlay */}
          <div className="absolute top-2 left-2 right-2 z-10 flex items-center justify-between gap-1 pointer-events-none">
            <div className="bg-slate-950/90 backdrop-blur-xs px-2 py-1 rounded-lg border border-slate-800 text-[9px] text-slate-300 font-semibold shadow-md flex items-center gap-1.5 pointer-events-auto">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
              <span>Tujuan: <strong className="text-amber-300">{routeData.destName}</strong></span>
            </div>

            <div className="bg-slate-950/90 backdrop-blur-xs px-2 py-1 rounded-lg border border-slate-800 text-[9px] text-slate-300 font-mono shadow-md flex items-center gap-1 pointer-events-auto">
              <Signal className="w-3 h-3 text-blue-400" />
              <span>{routeData.satellites} Sat</span>
              <span className="text-slate-500">•</span>
              <span className="text-emerald-400">{routeData.todayMileageKm} KM</span>
            </div>
          </div>

          {/* Bottom Controls & Info Overlay */}
          <div className="absolute bottom-2 left-2 right-2 z-10 flex items-center justify-between gap-2 pointer-events-none">
            {/* Address Snippet */}
            <div className="bg-slate-950/90 backdrop-blur-xs px-2 py-1 rounded-lg border border-slate-800 text-[9px] text-slate-300 shadow-md truncate max-w-[70%] pointer-events-auto flex items-center gap-1">
              <MapPin className="w-3 h-3 text-rose-400 shrink-0" />
              <span className="truncate">{routeData.address}</span>
            </div>

            {/* Quick Map Action Buttons */}
            <div className="flex items-center gap-1 pointer-events-auto">
              <button
                type="button"
                onClick={handleRecenter}
                className="w-6 h-6 rounded-md bg-slate-900/90 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-700 flex items-center justify-center shadow-md transition cursor-pointer"
                title="Pusatkan Rute"
              >
                <Compass className="w-3 h-3 text-blue-400" />
              </button>
              <button
                type="button"
                onClick={handleZoomIn}
                className="w-6 h-6 rounded-md bg-slate-900/90 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-700 flex items-center justify-center shadow-md transition cursor-pointer font-bold text-xs"
                title="Perbesar"
              >
                +
              </button>
              <button
                type="button"
                onClick={handleZoomOut}
                className="w-6 h-6 rounded-md bg-slate-900/90 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-700 flex items-center justify-center shadow-md transition cursor-pointer font-bold text-xs"
                title="Perkecil"
              >
                -
              </button>
              {onOpenFullTracksolid && (
                <button
                  type="button"
                  onClick={() => onOpenFullTracksolid(fleet.gpsImei)}
                  className="w-6 h-6 rounded-md bg-blue-600 hover:bg-blue-500 text-white flex items-center justify-center shadow-md transition cursor-pointer"
                  title="Buka Telematika Lengkap di Tracksolid Gateway"
                >
                  <ExternalLink className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
