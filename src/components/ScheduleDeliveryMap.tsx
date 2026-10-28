import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { MapPin, Building2, Store, Navigation, Route, Compass } from 'lucide-react';
import { Schedule, RetailStore } from '../types';
import { CENTRAL_WAREHOUSE } from '../data/mockData';
import { extractCoordinatesFromObject } from '../utils/coordinateParser';

interface ScheduleDeliveryMapProps {
  schedule?: Schedule;
  schedules?: Schedule[];
  stores: RetailStore[];
  heightClass?: string;
  className?: string;
}

export const ScheduleDeliveryMap: React.FC<ScheduleDeliveryMapProps> = ({
  schedule,
  schedules = [],
  stores = [],
  heightClass = 'h-[450px] w-full',
  className = ''
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const layerGroupRef = useRef<L.LayerGroup | null>(null);

  // Determine target schedule(s) to render
  const targetSchedules = schedule ? [schedule] : schedules;

  useEffect(() => {
    if (!mapContainerRef.current) return;

    if (!mapInstanceRef.current) {
      // Initialize Leaflet Map centered on Banyuwangi / Central Warehouse
      const map = L.map(mapContainerRef.current, {
        center: CENTRAL_WAREHOUSE.coordinates,
        zoom: 8,
        zoomControl: true,
        attributionControl: false
      });

      // Add OpenStreetMap tile layer
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '© OpenStreetMap contributors'
      }).addTo(map);

      const layerGroup = L.layerGroup().addTo(map);
      layerGroupRef.current = layerGroup;
      mapInstanceRef.current = map;
    }

    const map = mapInstanceRef.current;
    const layerGroup = layerGroupRef.current;

    if (!layerGroup || !map) return;

    layerGroup.clearLayers();

    const bounds = L.latLngBounds([]);

    // 1. Add Central Warehouse Marker
    const warehouseCoords = CENTRAL_WAREHOUSE.coordinates;
    bounds.extend(warehouseCoords);

    const warehouseIcon = L.divIcon({
      className: 'custom-warehouse-marker',
      html: `
        <div style="background: linear-gradient(135deg, #f59e0b, #d97706); width: 36px; height: 36px; border-radius: 50%; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 12px rgba(245,158,11,0.5); border: 2px solid #ffffff;">
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#0f172a" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
        </div>
      `,
      iconSize: [36, 36],
      iconAnchor: [18, 18]
    });

    const warehouseMarker = L.marker(warehouseCoords, { icon: warehouseIcon }).bindPopup(`
      <div style="font-family: Inter, sans-serif; padding: 6px; min-width: 200px;">
        <div style="font-weight: 800; color: #b45309; font-size: 13px; margin-bottom: 4px;">GUDANG PUSAT AKK</div>
        <div style="font-size: 11px; color: #334155; font-weight: 600;">${CENTRAL_WAREHOUSE.name}</div>
        <div style="font-size: 10px; color: #64748b; margin-top: 2px;">${CENTRAL_WAREHOUSE.address}</div>
      </div>
    `);
    layerGroup.addLayer(warehouseMarker);

    // 2. Render each schedule's route (Origin -> Store Destination)
    targetSchedules.forEach((sch) => {
      // Find store destination
      let destCoords: [number, number] | null = null;
      let storeName = 'Toko Tujuan';
      let storeCode = sch.trackingNumber;
      let storeAddress = '-';

      if (sch.store && sch.store.latitude && sch.store.longitude) {
        destCoords = [Number(sch.store.latitude), Number(sch.store.longitude)];
        storeName = sch.store.storeName;
        storeCode = sch.store.storeCode;
        storeAddress = sch.store.address;
      } else {
        const found = stores.find(s => s.id === sch.storeId || s.storeCode === sch.storeId);
        if (found) {
          const parsed = extractCoordinatesFromObject(found);
          if (parsed.isValid) {
            destCoords = [parsed.latitude, parsed.longitude];
            storeName = found.storeName;
            storeCode = found.storeCode;
            storeAddress = found.address;
          }
        }
      }

      if (destCoords) {
        bounds.extend(destCoords);

        // Destination Store Marker Icon
        const storeIcon = L.divIcon({
          className: 'custom-store-marker',
          html: `
            <div style="background: linear-gradient(135deg, #06b6d4, #0891b2); width: 32px; height: 32px; border-radius: 50%; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 12px rgba(6,182,212,0.5); border: 2px solid #ffffff;">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m2 7 4.41-4.41A2 2 0 0 1 7.83 2h8.34a2 2 0 0 1 1.42.59L22 7"/><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><path d="M15 22v-4a2 2 0 0 0-2-2h-2a2 2 0 0 0-2 2v4"/><path d="Path 2"/></svg>
            </div>
          `,
          iconSize: [32, 32],
          iconAnchor: [16, 16]
        });

        const storeMarker = L.marker(destCoords, { icon: storeIcon }).bindPopup(`
          <div style="font-family: Inter, sans-serif; padding: 6px; min-width: 220px;">
            <div style="font-weight: 800; color: #0e7490; font-size: 13px; margin-bottom: 2px;">${storeName}</div>
            <div style="font-size: 10px; font-family: monospace; color: #475569; margin-bottom: 4px;">Kode: ${storeCode} • No Resi: ${sch.trackingNumber}</div>
            <div style="font-size: 11px; color: #334155;">${storeAddress}</div>
            <div style="font-size: 10px; color: #047857; font-weight: 700; margin-top: 4px;">Muatan: ${sch.cargoWeightTon} Ton (${sch.cargoDescription})</div>
          </div>
        `);
        layerGroup.addLayer(storeMarker);

        // Draw Planned Polyline Route
        const routePoints: [number, number][] = [warehouseCoords, destCoords];

        // If inter-island (Bali / Java crossing via Ketapang-Gilimanuk), add waypoint
        if (sch.isInterIsland) {
          const ketapangPort: [number, number] = [-8.1485, 114.3980];
          const gilimanukPort: [number, number] = [-8.1630, 114.4370];
          routePoints.splice(1, 0, ketapangPort, gilimanukPort);
        }

        const polyline = L.polyline(routePoints, {
          color: sch.status === 'delivered' ? '#10b981' : sch.status === 'in_transit' ? '#06b6d4' : '#f59e0b',
          weight: 4,
          opacity: 0.85,
          dashArray: sch.status === 'scheduled' ? '6, 6' : undefined
        });
        layerGroup.addLayer(polyline);
      }
    });

    if (bounds.isValid()) {
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 12 });
    }
  }, [schedule, schedules, stores]);

  return (
    <div className={`relative rounded-2xl overflow-hidden border border-slate-800 shadow-2xl bg-slate-950 ${className}`}>
      {/* Map Header Overlay */}
      <div className="absolute top-3 left-3 right-3 z-10 flex items-center justify-between bg-slate-900/90 backdrop-blur-md px-4 py-2.5 rounded-xl border border-slate-800 shadow-lg">
        <div className="flex items-center gap-2 text-xs text-white font-bold">
          <Route className="w-4 h-4 text-amber-400" />
          <span>Peta Rute & Titik Pengiriman (Leaflet & Hostinger MySQL)</span>
        </div>
        <div className="flex items-center gap-3 text-[11px] text-slate-400">
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.8)]" />
            Gudang Pusat
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 shadow-[0_0_8px_rgba(6,182,212,0.8)]" />
            Toko Tujuan
          </span>
        </div>
      </div>

      {/* Map Container */}
      <div ref={mapContainerRef} className={heightClass} />
    </div>
  );
};
