import React, { useEffect, useRef, useState, useMemo } from 'react';
import L from 'leaflet';
import {
  Play,
  Pause,
  SkipForward,
  SkipBack,
  RotateCcw,
  MapPin,
  Truck,
  Navigation,
  Store,
  AlertTriangle,
  Clock,
  Gauge,
  Maximize2,
  Minimize2,
  Calendar,
  Layers,
  ChevronRight,
  ChevronLeft,
  CheckCircle2,
  Flag
} from 'lucide-react';
import { TracksolidTripLeg, TrackingPoint, RouteStop, RetailStore } from '../types';
import { CENTRAL_WAREHOUSE } from '../data/mockData';

interface GpsFleetTripsMapProps {
  plateNumber: string;
  initialCode?: string;
  vehicleType?: string;
  tripLegs: TracksolidTripLeg[];
  points?: TrackingPoint[];
  stops?: RouteStop[];
  stores?: RetailStore[];
  selectedDateFilter?: string; // 'all' or 'YYYY-MM-DD'
  onSelectDateFilter?: (date: string) => void;
  dateScopeMode?: 'harian' | 'mingguan' | 'bulanan' | 'tahunan' | 'semua';
  onSelectDateScopeMode?: (mode: 'harian' | 'mingguan' | 'bulanan' | 'tahunan' | 'semua') => void;
  selectedMonth?: string;
  selectedYear?: string;
  heightClass?: string;
}

export const GpsFleetTripsMap: React.FC<GpsFleetTripsMapProps> = ({
  plateNumber,
  initialCode = 'UNIT',
  vehicleType = 'Armada Box',
  tripLegs = [],
  stops = [],
  selectedDateFilter = 'all',
  onSelectDateFilter,
  dateScopeMode = 'harian',
  onSelectDateScopeMode,
  selectedMonth = 'Oktober',
  selectedYear = '2026',
  heightClass = 'h-[580px] w-full'
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const routeLayerRef = useRef<L.LayerGroup | null>(null);
  const vehicleMarkerRef = useRef<L.Marker | null>(null);
  const playbackTimerRef = useRef<number | null>(null);

  // States
  const [mapTheme, setMapTheme] = useState<'gmaps_roadmap' | 'gmaps_hybrid' | 'gmaps_terrain' | 'osm'>('gmaps_roadmap');
  const [selectedLegNumber, setSelectedLegNumber] = useState<number | 'all'>('all');
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [playbackProgress, setPlaybackProgress] = useState<number>(0);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [showStopsOnly, setShowStopsOnly] = useState<boolean>(false);
  const [showTripListPanel, setShowTripListPanel] = useState<boolean>(true);
  const [showHistoricalPolyline, setShowHistoricalPolyline] = useState<boolean>(true);
  const [showWaypointNumbers, setShowWaypointNumbers] = useState<boolean>(true);

  // Reset selected leg when switching fleet units
  useEffect(() => {
    setSelectedLegNumber('all');
  }, [plateNumber]);

  // Filter trip legs based on calendar scope and date
  const filteredLegs = useMemo(() => {
    if (!tripLegs || tripLegs.length === 0) return [];

    if (dateScopeMode === 'harian') {
      if (!selectedDateFilter || selectedDateFilter === 'all') {
        const latestDate = tripLegs[0]?.dateGroup || '2026-10-26';
        return tripLegs.filter(leg => leg.dateGroup === latestDate);
      }
      return tripLegs.filter(leg => leg.dateGroup === selectedDateFilter);
    }

    if (dateScopeMode === 'mingguan') {
      // 1 Minggu: rentang 20-26 Oktober 2026
      return tripLegs.filter(leg => leg.dateGroup >= '2026-10-20' && leg.dateGroup <= '2026-10-26');
    }

    if (dateScopeMode === 'bulanan') {
      const monthNames = [
        'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
        'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
      ];
      const mIdx = monthNames.indexOf(selectedMonth || 'Oktober') + 1;
      const mStr = mIdx < 10 ? `0${mIdx}` : `${mIdx}`;
      const prefix = `${selectedYear || '2026'}-${mStr}`;
      return tripLegs.filter(leg => leg.dateGroup.startsWith(prefix));
    }

    if (dateScopeMode === 'tahunan') {
      const yr = selectedYear || '2026';
      return tripLegs.filter(leg => leg.dateGroup.startsWith(yr));
    }

    // Default 'semua'
    if (selectedDateFilter && selectedDateFilter !== 'all') {
      return tripLegs.filter(leg => leg.dateGroup === selectedDateFilter);
    }
    return tripLegs;
  }, [tripLegs, dateScopeMode, selectedDateFilter, selectedMonth, selectedYear]);

  // Chronologically sorted legs (earliest to latest) for authentic historical journey flow
  const chronologicalLegs = useMemo(() => {
    return [...filteredLegs].sort((a, b) => {
      const dtA = `${a.dateGroup} ${a.startTime}`;
      const dtB = `${b.dateGroup} ${b.startTime}`;
      return dtA.localeCompare(dtB);
    });
  }, [filteredLegs]);

  // Current active leg or all legs
  const activeLeg = useMemo(() => {
    if (selectedLegNumber === 'all') return null;
    return filteredLegs.find(l => l.legNumber === selectedLegNumber) || null;
  }, [filteredLegs, selectedLegNumber]);

  // Available dates for quick filtering
  const availableDates = useMemo(() => {
    const datesMap = new Map<string, { count: number; mileage: number }>();
    tripLegs.forEach(leg => {
      const cur = datesMap.get(leg.dateGroup) || { count: 0, mileage: 0 };
      datesMap.set(leg.dateGroup, {
        count: cur.count + 1,
        mileage: cur.mileage + leg.mileageKm
      });
    });
    return Array.from(datesMap.entries()).map(([date, val]) => ({
      date,
      count: val.count,
      mileage: Math.round(val.mileage * 10) / 10
    }));
  }, [tripLegs]);

  // Total summary for current filtered legs
  const filteredSummary = useMemo(() => {
    const totalMileage = filteredLegs.reduce((acc, l) => acc + l.mileageKm, 0);
    const totalMinutes = filteredLegs.reduce((acc, l) => acc + (l.travelMinutes || 0), 0);
    const maxSpeed = filteredLegs.reduce((max, l) => Math.max(max, l.maxSpeedKmh || 0), 0);
    const avgSpeed =
      filteredLegs.length > 0
        ? filteredLegs.reduce((sum, l) => sum + (l.avgSpeedKmh || 0), 0) / filteredLegs.length
        : 0;
    return {
      tripsCount: filteredLegs.length,
      totalMileageKm: Math.round(totalMileage * 10) / 10,
      totalHours: (totalMinutes / 60).toFixed(1),
      maxSpeedKmh: Math.round(maxSpeed),
      avgSpeedKmh: Math.round(avgSpeed * 10) / 10
    };
  }, [filteredLegs]);

  // Coordinates array for playback and polyline in forward chronological order
  const activeCoordinates = useMemo((): Array<{ lat: number; lng: number; leg: TracksolidTripLeg; isStart?: boolean; isEnd?: boolean }> => {
    const coords: Array<{ lat: number; lng: number; leg: TracksolidTripLeg; isStart?: boolean; isEnd?: boolean }> = [];
    const legsToProcess = activeLeg ? [activeLeg] : chronologicalLegs;

    legsToProcess.forEach(leg => {
      if (leg.startLat && leg.startLng && !isNaN(leg.startLat) && !isNaN(leg.startLng)) {
        coords.push({ lat: leg.startLat, lng: leg.startLng, leg, isStart: true });
      }
      // Add slight intermediate curvature points along the leg to make curve smoother
      if (leg.startLat && leg.endLat && leg.startLng && leg.endLng) {
        const midLat = (leg.startLat + leg.endLat) / 2 + (Math.sin(leg.legNumber) * 0.003);
        const midLng = (leg.startLng + leg.endLng) / 2 + (Math.cos(leg.legNumber) * 0.003);
        coords.push({ lat: midLat, lng: midLng, leg });
      }
      if (leg.endLat && leg.endLng && !isNaN(leg.endLat) && !isNaN(leg.endLng)) {
        coords.push({ lat: leg.endLat, lng: leg.endLng, leg, isEnd: true });
      }
    });

    return coords;
  }, [activeLeg, chronologicalLegs]);

  // Initialize Map with Google Maps
  useEffect(() => {
    if (!mapContainerRef.current) return;

    if (!mapInstanceRef.current) {
      const initialCenter: [number, number] =
        tripLegs[0]?.startLat && tripLegs[0]?.startLng
          ? [tripLegs[0].startLat, tripLegs[0].startLng]
          : CENTRAL_WAREHOUSE.coordinates;

      const map = L.map(mapContainerRef.current, {
        center: initialCenter,
        zoom: 11,
        zoomControl: false,
        attributionControl: false
      });

      L.control.zoom({ position: 'topright' }).addTo(map);

      const layerGroup = L.layerGroup().addTo(map);
      routeLayerRef.current = layerGroup;
      mapInstanceRef.current = map;
    }

    const map = mapInstanceRef.current;
    if (!map) return;

    // Google Maps Tile Layers (Roadmap, Satellite Hybrid, Terrain, or OSM)
    let tileUrl = 'https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}';
    let attribution = '© Google Maps';
    let maxZoom = 20;

    if (mapTheme === 'gmaps_hybrid') {
      tileUrl = 'https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}';
      attribution = '© Google Maps Satelit';
    } else if (mapTheme === 'gmaps_terrain') {
      tileUrl = 'https://mt1.google.com/vt/lyrs=p&x={x}&y={y}&z={z}';
      attribution = '© Google Maps Medan';
    } else if (mapTheme === 'osm') {
      tileUrl = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
      attribution = '© OpenStreetMap contributors';
      maxZoom = 19;
    }

    // Remove old tile layers
    map.eachLayer(layer => {
      if (layer instanceof L.TileLayer) {
        map.removeLayer(layer);
      }
    });

    L.tileLayer(tileUrl, {
      maxZoom,
      subdomains: ['mt0', 'mt1', 'mt2', 'mt3'],
      attribution
    }).addTo(map);

    setTimeout(() => {
      map.invalidateSize();
    }, 100);
  }, [mapTheme, isFullscreen]);

  // Render Continuous Historical Trips Polyline and Markers
  useEffect(() => {
    const map = mapInstanceRef.current;
    const layerGroup = routeLayerRef.current;
    if (!map || !layerGroup) return;

    layerGroup.clearLayers();
    const bounds: [number, number][] = [];

    // 1. Build Full Continuous Historical Polyline Coordinates (Sorted Chronologically)
    const fullHistoricalPoints: [number, number][] = [];
    chronologicalLegs.forEach(leg => {
      if (leg.startLat && leg.startLng && !isNaN(leg.startLat) && !isNaN(leg.startLng)) {
        fullHistoricalPoints.push([leg.startLat, leg.startLng]);
        bounds.push([leg.startLat, leg.startLng]);
      }
      if (leg.startLat && leg.endLat && leg.startLng && leg.endLng) {
        const midLat = (leg.startLat + leg.endLat) / 2 + (Math.sin(leg.legNumber) * 0.003);
        const midLng = (leg.startLng + leg.endLng) / 2 + (Math.cos(leg.legNumber) * 0.003);
        fullHistoricalPoints.push([midLat, midLng]);
      }
      if (leg.endLat && leg.endLng && !isNaN(leg.endLat) && !isNaN(leg.endLng)) {
        fullHistoricalPoints.push([leg.endLat, leg.endLng]);
        bounds.push([leg.endLat, leg.endLng]);
      }
    });

    // 2. Draw Unified Historical Track Polyline (Outer Glow + Crisp High-Contrast Core)
    if (showHistoricalPolyline && fullHistoricalPoints.length >= 2) {
      // Background Glowing Trail
      const glowTrack = L.polyline(fullHistoricalPoints, {
        color: mapTheme === 'gmaps_hybrid' ? '#0284c7' : '#0369a1',
        weight: 8,
        opacity: 0.65,
        lineCap: 'round',
        lineJoin: 'round'
      });
      layerGroup.addLayer(glowTrack);

      // Core Vibrant Polyline
      const coreTrack = L.polyline(fullHistoricalPoints, {
        color: mapTheme === 'gmaps_hybrid' ? '#38bdf8' : '#0284c7',
        weight: 4.5,
        opacity: 0.95,
        lineCap: 'round',
        lineJoin: 'round'
      });
      layerGroup.addLayer(coreTrack);
    }

    // 3. Draw Individual Leg Segments & Waypoint Markers
    chronologicalLegs.forEach((leg, seqIndex) => {
      const isSelected = activeLeg && activeLeg.legNumber === leg.legNumber;
      const legPoints: [number, number][] = [];

      if (leg.startLat && leg.startLng) {
        legPoints.push([leg.startLat, leg.startLng]);
      }
      if (leg.startLat && leg.endLat && leg.startLng && leg.endLng) {
        const midLat = (leg.startLat + leg.endLat) / 2 + (Math.sin(leg.legNumber) * 0.003);
        const midLng = (leg.startLng + leg.endLng) / 2 + (Math.cos(leg.legNumber) * 0.003);
        legPoints.push([midLat, midLng]);
      }
      if (leg.endLat && leg.endLng) {
        legPoints.push([leg.endLat, leg.endLng]);
      }

      // If this leg is specifically selected, highlight it with a brilliant glowing polyline
      if (isSelected && legPoints.length >= 2) {
        const selGlow = L.polyline(legPoints, {
          color: '#f59e0b',
          weight: 10,
          opacity: 0.85,
          lineCap: 'round',
          lineJoin: 'round'
        });
        layerGroup.addLayer(selGlow);

        const selCore = L.polyline(legPoints, {
          color: '#ffffff',
          weight: 5,
          opacity: 1,
          lineCap: 'round',
          lineJoin: 'round'
        });
        layerGroup.addLayer(selCore);
      }

      // Transparent interactive line for clicking the leg
      if (legPoints.length >= 2) {
        const hitArea = L.polyline(legPoints, {
          color: 'transparent',
          weight: 12,
          opacity: 0.01
        });
        hitArea.on('click', () => setSelectedLegNumber(leg.legNumber));
        layerGroup.addLayer(hitArea);
      }

      // Start Waypoint Node (Sequential Number 1, 2, 3...)
      if (leg.startLat && leg.startLng && !showStopsOnly && showWaypointNumbers) {
        const isDepot = seqIndex === 0;
        const startIcon = L.divIcon({
          className: 'custom-trip-marker',
          html: `
            <div class="relative flex items-center justify-center -translate-x-1/2 -translate-y-1/2 cursor-pointer group">
              <div class="w-6 h-6 rounded-full ${
                isSelected
                  ? 'bg-amber-500 ring-4 ring-amber-400 scale-125'
                  : isDepot
                  ? 'bg-amber-600 ring-3 ring-amber-400/50'
                  : 'bg-indigo-600 ring-2 ring-indigo-400/40'
              } border-2 border-white flex items-center justify-center text-white text-[10px] font-black shadow-lg transition-transform">
                ${isDepot ? 'DC' : seqIndex + 1}
              </div>
              <div class="opacity-0 group-hover:opacity-100 absolute -top-8 px-2 py-1 rounded-md bg-slate-900 border border-slate-700 text-white text-[10px] whitespace-nowrap z-50 shadow-xl pointer-events-none transition font-sans">
                Ritase #${leg.legNumber} • ${leg.startTime} (${leg.mileageKm} km)
              </div>
            </div>
          `
        });

        const marker = L.marker([leg.startLat, leg.startLng], { icon: startIcon });
        marker.bindPopup(`
          <div style="font-family: inherit; font-size: 11px; min-width: 220px; padding: 3px;">
            <div style="font-weight: 800; font-size: 12px; color: #0284c7; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px; margin-bottom: 6px;">
              Ritase #${leg.legNumber} (Urutan ke-${seqIndex + 1}) • ${leg.dateGroup}
            </div>
            <div><strong>Waktu Berangkat:</strong> ${leg.startTime}</div>
            <div style="color: #64748b; font-size: 10px; margin-bottom: 4px;">${leg.startLocation}</div>
            <div><strong>Waktu Tiba:</strong> ${leg.endTime}</div>
            <div style="color: #64748b; font-size: 10px; margin-bottom: 6px;">${leg.endLocation}</div>
            <div style="display: flex; justify-content: space-between; font-weight: 700; background: #f1f5f9; padding: 4px 6px; border-radius: 6px;">
              <span>Jarak: ${leg.mileageKm} km</span>
              <span>Durasi: ${leg.travelTime}</span>
            </div>
          </div>
        `);
        marker.on('click', () => setSelectedLegNumber(leg.legNumber));
        layerGroup.addLayer(marker);
      }

      // Add Stop Marker if there's a registered store or stop duration
      if (leg.stopBeforeMinutes && leg.stopBeforeMinutes > 0 && leg.startLat && leg.startLng) {
        const isCustomer = Boolean(leg.matchedStoreName);
        const isLongNonCustomer = !isCustomer && leg.stopBeforeMinutes >= 15;

        const stopIcon = L.divIcon({
          className: 'custom-stop-marker',
          html: `
            <div class="relative flex items-center justify-center -translate-x-1/2 -translate-y-1/2 cursor-pointer group">
              <div class="w-7 h-7 rounded-full ${
                isCustomer
                  ? 'bg-emerald-500 ring-4 ring-emerald-500/30'
                  : isLongNonCustomer
                  ? 'bg-rose-600 ring-4 ring-rose-500/40 animate-pulse'
                  : 'bg-blue-600 ring-2 ring-blue-400/30'
              } border-2 border-white flex items-center justify-center text-white text-[11px] font-bold shadow-xl">
                ${isCustomer ? '🏬' : isLongNonCustomer ? '⚠️' : '🅿️'}
              </div>
              <div class="opacity-0 group-hover:opacity-100 absolute -bottom-7 px-2 py-0.5 rounded bg-slate-900 border border-slate-700 text-white text-[10px] whitespace-nowrap z-50 shadow-xl pointer-events-none transition font-sans">
                Stop ${leg.stopBeforeMinutes} mnt: ${leg.matchedStoreName || 'Area Non-Mitra'}
              </div>
            </div>
          `
        });

        const stopMarker = L.marker([leg.startLat, leg.startLng], { icon: stopIcon });
        stopMarker.bindPopup(`
          <div style="font-family: inherit; font-size: 11px; min-width: 220px; padding: 3px;">
            <div style="font-weight: 800; color: ${isCustomer ? '#059669' : isLongNonCustomer ? '#dc2626' : '#2563eb'}; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px; margin-bottom: 6px;">
              ${isCustomer ? '🏬 Berhenti di Toko Pelanggan (Mitra)' : isLongNonCustomer ? '⚠️ Berhenti Lama Non-Mitra' : '🅿️ Titik Berhenti Armada'}
            </div>
            ${leg.matchedStoreName ? `<div><strong>Toko:</strong> ${leg.matchedStoreName}</div>` : ''}
            <div><strong>Durasi Berhenti:</strong> <span style="font-weight: 800; color: #d97706;">${leg.stopBeforeMinutes} Menit</span></div>
            <div><strong>Waktu:</strong> ${leg.stopBeforeStart || '-'} s/d ${leg.stopBeforeEnd || '-'}</div>
            <div style="color: #64748b; font-size: 10px; margin-top: 4px;">${leg.startLocation}</div>
          </div>
        `);
        layerGroup.addLayer(stopMarker);
      }
    });

    // 4. Destination Flag for the last chronological leg
    const lastLeg = chronologicalLegs[chronologicalLegs.length - 1];
    if (lastLeg?.endLat && lastLeg?.endLng) {
      const endIcon = L.divIcon({
        className: 'custom-end-marker',
        html: `
          <div class="relative flex items-center justify-center -translate-x-1/2 -translate-y-1/2 cursor-pointer group">
            <div class="w-8 h-8 rounded-full bg-indigo-600 border-2 border-white shadow-xl flex items-center justify-center text-white text-xs font-black ring-4 ring-indigo-500/30">
              🏁
            </div>
            <div class="opacity-0 group-hover:opacity-100 absolute -top-8 px-2 py-1 rounded-md bg-slate-900 border border-slate-700 text-white text-[10px] whitespace-nowrap z-50 shadow-xl pointer-events-none transition font-sans">
              Titik Akhir: ${lastLeg.endTime}
            </div>
          </div>
        `
      });
      const endMarker = L.marker([lastLeg.endLat, lastLeg.endLng], { icon: endIcon });
      endMarker.bindPopup(`
        <div style="font-family: inherit; font-size: 11px;">
          <strong>Titik Akhir Perjalanan:</strong><br/>
          ${lastLeg.endLocation}<br/>
          Jam: ${lastLeg.endTime}
        </div>
      `);
      layerGroup.addLayer(endMarker);
    }

    // 5. Fit Bounds to visible polyline route
    if (bounds.length > 0 && map) {
      try {
        map.fitBounds(bounds, {
          padding: [50, 50],
          maxZoom: activeLeg ? 14 : 12,
          animate: true
        });
      } catch {}
    }
  }, [activeLeg, filteredLegs, chronologicalLegs, mapTheme, showStopsOnly, showHistoricalPolyline, showWaypointNumbers]);

  // Re-create or update vehicle marker icon and label when initialCode, plateNumber, or activeCoordinates change
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    if (vehicleMarkerRef.current) {
      map.removeLayer(vehicleMarkerRef.current);
      vehicleMarkerRef.current = null;
    }

    if (activeCoordinates.length > 0) {
      const initialPos = activeCoordinates[0];
      const vehicleIcon = L.divIcon({
        className: 'vehicle-playback-marker',
        html: `
          <div class="relative flex flex-col items-center -translate-x-1/2 -translate-y-1/2 pointer-events-none font-sans">
            <div class="px-2.5 py-0.5 rounded-md bg-sky-400 text-slate-950 font-black text-[10px] shadow-xl whitespace-nowrap mb-0.5 border border-white">
              ${initialCode} • ${plateNumber}
            </div>
            <div class="w-7 h-7 rounded-full bg-cyan-400 border-2 border-white shadow-xl flex items-center justify-center text-slate-950 ring-4 ring-cyan-400/40">
              <svg class="w-4 h-4 fill-current" viewBox="0 0 24 24">
                <path d="M18.92 6.01C18.72 5.42 18.16 5 17.5 5h-11c-.66 0-1.21.42-1.42 1.01L3 12v8c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h12v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-8l-2.08-5.99zM6.5 16c-.83 0-1.5-.67-1.5-1.5S5.67 13 6.5 13s1.5.67 1.5 1.5S7.33 16 6.5 16zm11 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zM5 11l1.5-4.5h11L19 11H5z"/>
              </svg>
            </div>
          </div>
        `
      });
      const marker = L.marker([initialPos.lat, initialPos.lng], {
        icon: vehicleIcon,
        zIndexOffset: 1000
      }).addTo(map);
      vehicleMarkerRef.current = marker;
      setPlaybackProgress(0);
      setIsPlaying(false);
    }

    return () => {
      if (vehicleMarkerRef.current && mapInstanceRef.current) {
        mapInstanceRef.current.removeLayer(vehicleMarkerRef.current);
        vehicleMarkerRef.current = null;
      }
    };
  }, [initialCode, plateNumber, activeCoordinates]);

  // Live Vehicle Playback Animation Timer
  useEffect(() => {
    if (isPlaying) {
      if (playbackTimerRef.current) clearInterval(playbackTimerRef.current);

      playbackTimerRef.current = window.setInterval(() => {
        setPlaybackProgress(prev => {
          const next = prev + 1;
          if (next >= activeCoordinates.length) {
            setIsPlaying(false);
            return activeCoordinates.length - 1;
          }
          const pt = activeCoordinates[next];
          if (pt && vehicleMarkerRef.current) {
            vehicleMarkerRef.current.setLatLng([pt.lat, pt.lng]);
          }
          return next;
        });
      }, 700 / playbackSpeed);
    } else {
      if (playbackTimerRef.current) {
        clearInterval(playbackTimerRef.current);
        playbackTimerRef.current = null;
      }
    }

    return () => {
      if (playbackTimerRef.current) {
        clearInterval(playbackTimerRef.current);
        playbackTimerRef.current = null;
      }
    };
  }, [isPlaying, activeCoordinates, playbackSpeed]);

  const handleTogglePlay = () => {
    if (playbackProgress >= activeCoordinates.length - 1) {
      setPlaybackProgress(0);
      const first = activeCoordinates[0];
      if (first && vehicleMarkerRef.current) {
        vehicleMarkerRef.current.setLatLng([first.lat, first.lng]);
      }
    }
    setIsPlaying(prev => !prev);
  };

  const handleResetPlayback = () => {
    setIsPlaying(false);
    setPlaybackProgress(0);
    const first = activeCoordinates[0];
    if (first && vehicleMarkerRef.current) {
      vehicleMarkerRef.current.setLatLng([first.lat, first.lng]);
    }
  };

  const handleSelectLeg = (legNum: number | 'all') => {
    setSelectedLegNumber(legNum);
    setPlaybackProgress(0);
    setIsPlaying(false);
  };

  return (
    <div
      className={`relative rounded-2xl overflow-hidden border border-slate-800 bg-slate-950 flex flex-col shadow-2xl ${
        isFullscreen ? 'fixed inset-0 z-50 rounded-none' : heightClass
      }`}
    >
      {/* 1. Top Integrated Control Bar & GPS Analytics HUD */}
      <div className="bg-slate-900/95 backdrop-blur-md border-b border-slate-800 px-4 py-3 z-20 shrink-0">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Unit Info & Date Picker */}
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="font-mono text-xs font-black text-white">
                [{initialCode}] {plateNumber}
              </span>
              <span className="text-[10px] text-slate-400">• {vehicleType}</span>
            </div>

            {/* Calendar / Date Selector */}
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-xs">
              <Calendar className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
              <select
                value={selectedDateFilter}
                onChange={e => onSelectDateFilter?.(e.target.value)}
                className="bg-transparent text-xs font-bold text-slate-200 outline-none cursor-pointer"
              >
                <option value="all">Semua Tanggal ({tripLegs.length} Ritase)</option>
                {availableDates.map(d => (
                  <option key={d.date} value={d.date}>
                    {d.date} ({d.count} Ritase • {d.mileage} km)
                  </option>
                ))}
              </select>
            </div>

            {/* Legs Summary Badge */}
            <div className="hidden sm:flex items-center gap-2 text-[11px] font-mono text-slate-300">
              <span className="px-2 py-1 rounded-lg bg-sky-500/10 text-sky-400 font-bold border border-sky-500/20">
                {filteredSummary.tripsCount} Ritase
              </span>
              <span className="px-2 py-1 rounded-lg bg-emerald-500/10 text-emerald-400 font-bold border border-emerald-500/20">
                {filteredSummary.totalMileageKm} km
              </span>
              <span className="px-2 py-1 rounded-lg bg-amber-500/10 text-amber-400 font-bold border border-amber-500/20">
                {filteredSummary.totalHours} Jam
              </span>
            </div>
          </div>

          {/* Map Controls: View Theme, Trip List Toggle, Fullscreen */}
          <div className="flex items-center gap-2 self-end md:self-auto">
            {/* Google Maps Layer Selector */}
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-700 text-xs font-bold text-white shadow-xs">
              <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" />
              <Layers className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
              <select
                value={mapTheme}
                onChange={e => setMapTheme(e.target.value as any)}
                className="bg-transparent text-xs font-bold text-white focus:outline-none cursor-pointer"
              >
                <option value="gmaps_roadmap" className="bg-slate-900 text-white font-sans">Google Maps (Jalan)</option>
                <option value="gmaps_hybrid" className="bg-slate-900 text-white font-sans">Google Maps (Satelit Hybrid)</option>
                <option value="gmaps_terrain" className="bg-slate-900 text-white font-sans">Google Maps (Terrain)</option>
                <option value="osm" className="bg-slate-900 text-white font-sans">OpenStreetMap</option>
              </select>
            </div>

            {/* Toggle Lapisan Visual Polyline Jejak Historis */}
            <button
              type="button"
              onClick={() => setShowHistoricalPolyline(prev => !prev)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition flex items-center gap-1.5 cursor-pointer ${
                showHistoricalPolyline
                  ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40 shadow-xs'
                  : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-white'
              }`}
              title="Aktifkan / nonaktifkan garis visual polyline jejak perjalanan historis"
            >
              <Navigation className={`w-3.5 h-3.5 ${showHistoricalPolyline ? 'text-cyan-400' : 'text-slate-400'}`} />
              <span className="hidden sm:inline">Lapisan Polyline ({showHistoricalPolyline ? 'ON' : 'OFF'})</span>
            </button>

            <button
              type="button"
              onClick={() => setShowTripListPanel(prev => !prev)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition flex items-center gap-1.5 cursor-pointer ${
                showTripListPanel
                  ? 'bg-indigo-600/20 text-indigo-300 border-indigo-500/40'
                  : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-white'
              }`}
            >
              <Navigation className="w-3.5 h-3.5" />
              <span>Daftar Trips ({filteredLegs.length})</span>
            </button>

            <button
              type="button"
              onClick={() => setIsFullscreen(prev => !prev)}
              className="p-2 rounded-xl bg-slate-950 hover:bg-slate-800 text-slate-300 border border-slate-800 transition cursor-pointer"
              title={isFullscreen ? 'Keluar Fullscreen' : 'Layar Penuh'}
            >
              {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </div>

      {/* 2. Main Map Canvas + Floating Panels */}
      <div className="relative flex-1 min-h-0 w-full overflow-hidden">
        <div ref={mapContainerRef} className="w-full h-full" />

        {/* Legend Overlay at Bottom-Left */}
        <div className="absolute bottom-4 left-4 z-10 p-3 rounded-2xl bg-slate-900/95 backdrop-blur-md border border-slate-800 text-[11px] space-y-2 shadow-2xl max-w-xs pointer-events-auto">
          <div className="flex items-center justify-between gap-2 border-b border-slate-800 pb-1.5">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-300">
              Lapisan Jejak Historis
            </span>
            <span className="text-[10px] font-mono font-bold text-cyan-400 px-1.5 py-0.5 rounded bg-cyan-500/10 border border-cyan-500/20">
              {filteredLegs.length} Ritase • {filteredSummary.totalMileageKm} km
            </span>
          </div>
          <div className="flex flex-col gap-1.5 text-slate-300">
            <span className="flex items-center gap-2 font-medium">
              <span className="w-5 h-1.5 rounded-full bg-cyan-400 shadow-xs shadow-cyan-400/50" />
              Garis Polyline Jejak Perjalanan ({showHistoricalPolyline ? 'Aktif' : 'Nonaktif'})
            </span>
            <span className="flex items-center gap-2 font-medium">
              <span className="w-4 h-4 rounded-full bg-indigo-600 border border-white text-[9px] text-white flex items-center justify-center font-bold">1</span>
              Urutan Titik Perjalanan (Waypoints)
            </span>
            <span className="flex items-center gap-2 font-medium">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 border border-white" />
              Berhenti di Toko Pelanggan (Mitra)
            </span>
            <span className="flex items-center gap-2 font-medium text-rose-400">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-600 border border-white animate-pulse" />
              ⚠️ Berhenti Lama Non-Mitra (≥15 Mnt)
            </span>
          </div>
        </div>

        {/* Floating Side Panel: Interactive List of Trip Legs (Ritase) */}
        {showTripListPanel && (
          <div className="absolute top-4 right-4 bottom-16 z-10 w-72 sm:w-80 bg-slate-900/95 backdrop-blur-xl border border-slate-800 rounded-2xl shadow-2xl flex flex-col overflow-hidden pointer-events-auto">
            <div className="p-3 border-b border-slate-800 flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-white block">
                  Jejak Trips Perjalanan
                </span>
                <span className="text-[10px] text-slate-400">
                  Klik ritase untuk menyorot rute spesifik
                </span>
              </div>
              <button
                type="button"
                onClick={() => handleSelectLeg('all')}
                className={`px-2 py-1 rounded-lg text-[10px] font-bold transition cursor-pointer border ${
                  selectedLegNumber === 'all'
                    ? 'bg-cyan-500 text-slate-950 border-cyan-400'
                    : 'bg-slate-950 text-slate-300 border-slate-800 hover:text-white'
                }`}
              >
                Semua Trips
              </button>
            </div>

            <div className="flex-1 overflow-y-auto divide-y divide-slate-800/60 p-1.5 space-y-1">
              {filteredLegs.map(leg => {
                const isSelected = selectedLegNumber === leg.legNumber;
                return (
                  <div
                    key={leg.legNumber}
                    onClick={() => handleSelectLeg(leg.legNumber)}
                    className={`p-2.5 rounded-xl transition cursor-pointer text-xs space-y-1 ${
                      isSelected
                        ? 'bg-cyan-500/15 border border-cyan-500/50 shadow-sm'
                        : 'hover:bg-slate-800/60 border border-transparent'
                    }`}
                  >
                    <div className="flex items-center justify-between font-bold">
                      <span className={`flex items-center gap-1.5 font-mono ${isSelected ? 'text-cyan-300' : 'text-white'}`}>
                        <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
                        Ritase #{leg.legNumber}
                      </span>
                      <span className="font-mono text-emerald-400 text-[11px]">
                        {leg.mileageKm} km
                      </span>
                    </div>

                    <div className="text-[10px] text-slate-300 flex items-center justify-between">
                      <span className="text-slate-400 font-mono">{leg.startTime} s/d {leg.endTime}</span>
                      <span className="text-amber-300 font-medium">{leg.travelTime}</span>
                    </div>

                    <div className="text-[10px] text-slate-400 truncate">
                      <span className="text-slate-500">Tujuan:</span> {leg.endLocation}
                    </div>

                    {leg.stopBeforeMinutes && leg.stopBeforeMinutes > 0 && (
                      <div className="mt-1 pt-1 border-t border-slate-800 flex items-center justify-between text-[10px]">
                        <span className="text-slate-400">Berhenti:</span>
                        <span className={leg.matchedStoreName ? 'text-emerald-400 font-semibold' : 'text-rose-400 font-semibold'}>
                          {leg.stopBeforeMinutes} mnt {leg.matchedStoreName ? `(${leg.matchedStoreName})` : '(Non-Mitra)'}
                        </span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* 3. Bottom Playback Animation Bar (Jejak Playback Trips) */}
      <div className="bg-slate-900 border-t border-slate-800 px-4 py-2.5 z-20 shrink-0">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleTogglePlay}
              className={`p-2.5 rounded-xl font-bold text-xs transition cursor-pointer flex items-center gap-2 shadow-md ${
                isPlaying
                  ? 'bg-amber-500 hover:bg-amber-400 text-slate-950'
                  : 'bg-cyan-500 hover:bg-cyan-400 text-slate-950'
              }`}
              title={isPlaying ? 'Jeda Jejak Perjalanan' : 'Putar Simulasi Jejak Trips'}
            >
              {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 fill-current" />}
              <span>{isPlaying ? 'Jeda Trips' : 'Simulasi Jejak Trips'}</span>
            </button>

            <button
              type="button"
              onClick={handleResetPlayback}
              className="p-2 rounded-xl bg-slate-950 hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-800 transition cursor-pointer"
              title="Reset ke Titik Awal"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>

            {/* Speed Toggle */}
            <div className="inline-flex items-center rounded-xl bg-slate-950 border border-slate-800 p-0.5 text-[10px] font-mono">
              {[1, 2, 4].map(spd => (
                <button
                  key={spd}
                  type="button"
                  onClick={() => setPlaybackSpeed(spd)}
                  className={`px-2 py-1 rounded-lg transition cursor-pointer font-bold ${
                    playbackSpeed === spd
                      ? 'bg-cyan-500 text-slate-950 shadow-2xs'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {spd}x
                </button>
              ))}
            </div>
          </div>

          {/* Timeline Scrubber */}
          <div className="flex-1 max-w-xl flex items-center gap-3">
            <span className="text-[10px] font-mono text-slate-400 whitespace-nowrap">
              Posisi {playbackProgress + 1} / {Math.max(1, activeCoordinates.length)}
            </span>
            <input
              type="range"
              min={0}
              max={Math.max(0, activeCoordinates.length - 1)}
              value={playbackProgress}
              onChange={e => {
                const val = Number(e.target.value);
                setPlaybackProgress(val);
                const pt = activeCoordinates[val];
                if (pt && vehicleMarkerRef.current) {
                  vehicleMarkerRef.current.setLatLng([pt.lat, pt.lng]);
                }
              }}
              className="w-full accent-cyan-400 cursor-pointer h-1.5 bg-slate-800 rounded-lg"
            />
            {activeLeg && (
              <span className="px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-300 text-[10px] font-mono font-bold whitespace-nowrap">
                Ritase #{activeLeg.legNumber}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
