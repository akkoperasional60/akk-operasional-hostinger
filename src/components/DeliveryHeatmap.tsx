import React, { useState, useEffect, useRef, useMemo } from 'react';
import L from 'leaflet';
import { 
  Flame, 
  MapPin, 
  Filter, 
  Layers, 
  BarChart3, 
  TrendingUp, 
  Truck, 
  Building2, 
  Sparkles, 
  Info,
  Maximize2,
  RefreshCw,
  Zap,
  CheckCircle2,
  AlertCircle,
  Compass
} from 'lucide-react';
import { logisticsStore } from '../services/store';
import { RetailStore, Schedule } from '../types';
import { CENTRAL_WAREHOUSE } from '../data/mockData';

interface DeliveryHeatmapProps {
  heightClass?: string;
  className?: string;
}

type HeatmapMetric = 'shipment_count' | 'cargo_weight' | 'store_density';
type RegionFilter = 'all' | 'Jawa' | 'Bali & Nusa Tenggara' | 'Sumatera' | 'Kalimantan' | 'Sulawesi';

interface StoreHeatData {
  store: RetailStore;
  shipmentCount: number;
  totalWeightTon: number;
  intensityScore: number; // 0 to 100
  heatCategory: 'high' | 'medium' | 'low';
}

export const DeliveryHeatmap: React.FC<DeliveryHeatmapProps> = ({ 
  heightClass = 'h-[520px]',
  className = ''
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const layerGroupRef = useRef<L.LayerGroup | null>(null);

  // States
  const [stores, setStores] = useState<RetailStore[]>(logisticsStore.getStores());
  const [schedules, setSchedules] = useState<Schedule[]>(logisticsStore.getSchedules());
  const [selectedRegion, setSelectedRegion] = useState<RegionFilter>('all');
  const [metricMode, setMetricMode] = useState<HeatmapMetric>('shipment_count');
  const [selectedStore, setSelectedStore] = useState<StoreHeatData | null>(null);
  const [showRadiusGlow, setShowRadiusGlow] = useState<boolean>(true);

  // Sync state with store on mount
  useEffect(() => {
    setStores(logisticsStore.getStores());
    setSchedules(logisticsStore.getSchedules());
  }, []);

  // Compute Store Heat Metrics
  const storeHeatList: StoreHeatData[] = useMemo(() => {
    // Group schedules by storeId
    const schedByStore = new Map<string, { count: number; weight: number }>();
    schedules.forEach(s => {
      if (!s.storeId) return;
      const curr = schedByStore.get(s.storeId) || { count: 0, weight: 0 };
      schedByStore.set(s.storeId, {
        count: curr.count + 1,
        weight: curr.weight + (s.cargoWeightTon || 3.5)
      });
    });

    // Calculate maximum values for normalization
    let maxCount = 1;
    let maxWeight = 1;
    schedByStore.forEach(val => {
      if (val.count > maxCount) maxCount = val.count;
      if (val.weight > maxWeight) maxWeight = val.weight;
    });

    return stores
      .filter(st => selectedRegion === 'all' || st.island === selectedRegion)
      .map(st => {
        const stats = schedByStore.get(st.id) || { count: 1, weight: 2.5 };
        
        let score = 0;
        if (metricMode === 'shipment_count') {
          score = Math.round((stats.count / maxCount) * 100);
        } else if (metricMode === 'cargo_weight') {
          score = Math.round((stats.weight / maxWeight) * 100);
        } else {
          // Store density / cluster rating
          score = st.storeCategory === 'Hypermarket' ? 90 : st.storeCategory === 'Distribution Hub' ? 85 : st.storeCategory === 'Supermarket' ? 60 : 35;
        }

        const heatCategory: 'high' | 'medium' | 'low' = score >= 65 ? 'high' : score >= 35 ? 'medium' : 'low';

        return {
          store: st,
          shipmentCount: stats.count,
          totalWeightTon: Number(stats.weight.toFixed(1)),
          intensityScore: score,
          heatCategory
        };
      });
  }, [stores, schedules, selectedRegion, metricMode]);

  // Aggregated City / Hotspot Clusters
  const topCityHotspots = useMemo(() => {
    const cityMap = new Map<string, { city: string; island: string; storeCount: number; shipmentCount: number; totalWeight: number }>();
    
    storeHeatList.forEach(item => {
      const cityKey = item.store.city || 'Banyuwangi';
      const curr = cityMap.get(cityKey) || {
        city: cityKey,
        island: item.store.island,
        storeCount: 0,
        shipmentCount: 0,
        totalWeight: 0
      };
      cityMap.set(cityKey, {
        ...curr,
        storeCount: curr.storeCount + 1,
        shipmentCount: curr.shipmentCount + item.shipmentCount,
        totalWeight: Number((curr.totalWeight + item.totalWeightTon).toFixed(1))
      });
    });

    return Array.from(cityMap.values())
      .sort((a, b) => b.shipmentCount - a.shipmentCount || b.totalWeight - a.totalWeight)
      .slice(0, 6);
  }, [storeHeatList]);

  // Initialize Leaflet Map
  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    if ((mapContainerRef.current as any)._leaflet_id) {
      delete (mapContainerRef.current as any)._leaflet_id;
    }

    const map = L.map(mapContainerRef.current, {
      center: [-7.8, 113.8], // Java / Bali center view
      zoom: 7,
      zoomControl: true,
      scrollWheelZoom: true
    });

    // Dark Tile Layer for sleek heatmap display
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/">CARTO</a>',
      maxZoom: 18,
      subdomains: 'abcd'
    }).addTo(map);

    const layerGroup = L.layerGroup().addTo(map);
    layerGroupRef.current = layerGroup;
    mapInstanceRef.current = map;

    const timer = setTimeout(() => {
      map.invalidateSize();
    }, 250);

    return () => {
      clearTimeout(timer);
      if (mapInstanceRef.current) {
        try {
          mapInstanceRef.current.stop();
          mapInstanceRef.current.off();
          mapInstanceRef.current.remove();
        } catch {}
        mapInstanceRef.current = null;
      }
    };
  }, []);

  // Render Heatmap Circles & Markers
  useEffect(() => {
    if (!mapInstanceRef.current || !layerGroupRef.current) return;

    const map = mapInstanceRef.current;
    const layerGroup = layerGroupRef.current;

    try {
      map.stop();
    } catch {}

    layerGroup.clearLayers();

    const bounds: [number, number][] = [];

    // 1. Central Warehouse Icon & Marker (AKK Banyuwangi DC)
    const warehouseIcon = L.divIcon({
      className: 'custom-warehouse-heatmap-icon',
      html: `
        <div class="relative flex items-center justify-center">
          <span class="absolute w-10 h-10 rounded-full bg-amber-500/30 animate-ping"></span>
          <div class="w-8 h-8 rounded-full bg-gradient-to-tr from-amber-600 to-yellow-400 border-2 border-white shadow-lg flex items-center justify-center text-slate-950 font-black text-xs z-10">
            ★
          </div>
        </div>
      `,
      iconSize: [32, 32],
      iconAnchor: [16, 16]
    });

    const whMarker = L.marker(CENTRAL_WAREHOUSE.coordinates, { icon: warehouseIcon })
      .bindPopup(`
        <div class="p-2.5 max-w-xs font-sans">
          <span class="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-700 border border-amber-500/30">
            Pusat Distribusi Utama
          </span>
          <h4 class="font-bold text-slate-900 text-sm mt-1 leading-tight">${CENTRAL_WAREHOUSE.name}</h4>
          <p class="text-xs text-slate-600 mt-1">${CENTRAL_WAREHOUSE.address}</p>
          <div class="mt-2 text-[10px] text-slate-500 font-mono border-t border-slate-200 pt-1">
            Koordinat: ${CENTRAL_WAREHOUSE.coordinates[0]}, ${CENTRAL_WAREHOUSE.coordinates[1]}
          </div>
        </div>
      `);
    layerGroup.addLayer(whMarker);
    bounds.push(CENTRAL_WAREHOUSE.coordinates);

    // Color definitions for heat intensity
    const getHeatColor = (category: 'high' | 'medium' | 'low') => {
      switch (category) {
        case 'high': return '#f43f5e';   // Rose-500
        case 'medium': return '#f59e0b'; // Amber-500
        case 'low': return '#10b981';    // Emerald-500
      }
    };

    // 2. Render Heat Circles for Stores
    storeHeatList.forEach(item => {
      const lat = item.store.latitude;
      const lng = item.store.longitude;
      if (!lat || !lng) return;

      bounds.push([lat, lng]);

      const color = getHeatColor(item.heatCategory);

      // Outer Glow Halo Circle
      if (showRadiusGlow) {
        const radiusMeters = item.heatCategory === 'high' ? 25000 : item.heatCategory === 'medium' ? 16000 : 9000;
        const outerCircle = L.circle([lat, lng], {
          radius: radiusMeters,
          color: color,
          fillColor: color,
          fillOpacity: item.heatCategory === 'high' ? 0.22 : item.heatCategory === 'medium' ? 0.16 : 0.1,
          weight: 0
        });
        layerGroup.addLayer(outerCircle);
      }

      // Core Interactive Circle Marker
      const markerRadius = Math.max(7, Math.min(22, Math.round(item.intensityScore / 5)));
      const circleMarker = L.circleMarker([lat, lng], {
        radius: markerRadius,
        color: '#ffffff',
        weight: 1.5,
        fillColor: color,
        fillOpacity: 0.85
      });

      circleMarker.on('click', () => {
        setSelectedStore(item);
      });

      circleMarker.bindPopup(`
        <div class="p-2 font-sans max-w-xs">
          <div class="flex items-center justify-between gap-2 mb-1">
            <span class="px-2 py-0.5 rounded text-[10px] font-bold text-white uppercase" style="background-color: ${color}">
              Intensitas ${item.heatCategory.toUpperCase()} (${item.intensityScore}%)
            </span>
            <span class="text-[10px] font-mono text-slate-500">${item.store.storeCode}</span>
          </div>
          <h4 class="font-bold text-slate-900 text-sm leading-tight">${item.store.storeName}</h4>
          <p class="text-xs text-slate-600 mt-1">${item.store.address}, ${item.store.city}</p>

          <div class="mt-2.5 pt-2 border-t border-slate-200 text-xs space-y-1">
            <div class="flex justify-between">
              <span class="text-slate-500">Total Frekuensi:</span>
              <strong class="text-slate-900 font-mono">${item.shipmentCount} Pengiriman</strong>
            </div>
            <div class="flex justify-between">
              <span class="text-slate-500">Total Tonase Kargo:</span>
              <strong class="text-slate-900 font-mono">${item.totalWeightTon} Ton</strong>
            </div>
            <div class="flex justify-between">
              <span class="text-slate-500">Kategori Outlet:</span>
              <span class="text-blue-700 font-medium">${item.store.storeCategory}</span>
            </div>
          </div>
        </div>
      `);

      layerGroup.addLayer(circleMarker);
    });

    // Adjust Map View if bounds exist
    if (bounds.length > 1 && mapInstanceRef.current) {
      mapInstanceRef.current.fitBounds(bounds, { padding: [40, 40], maxZoom: 10, animate: false });
    }
  }, [storeHeatList, showRadiusGlow]);

  const handleResetView = () => {
    if (mapInstanceRef.current) {
      mapInstanceRef.current.setView([-7.8, 113.8], 7);
    }
  };

  return (
    <div className={`bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm space-y-4 ${className}`}>
      {/* Header & Controls Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-2 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-lg bg-rose-500/10 text-rose-400 border border-rose-500/20">
            <Flame className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <span>Heatmap Konsentrasi Area Pengiriman</span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30">
                Density Maps
              </span>
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Visualisasi kepadatan lokasi toko retail & kluster titik tujuan kargo untuk evaluasi efisiensi alokasi armada.
            </p>
          </div>
        </div>

        {/* Filter Toolbar */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Region Filter */}
          <div className="flex items-center gap-1.5 bg-slate-950 px-2.5 py-1.5 rounded-lg border border-slate-800 text-xs">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={selectedRegion}
              onChange={(e) => setSelectedRegion(e.target.value as RegionFilter)}
              className="bg-transparent text-slate-200 font-medium focus:outline-none cursor-pointer"
            >
              <option value="all" className="bg-slate-900">Semua Region</option>
              <option value="Jawa" className="bg-slate-900">Pulau Jawa</option>
              <option value="Bali & Nusa Tenggara" className="bg-slate-900">Bali & Nusa Tenggara</option>
              <option value="Sumatera" className="bg-slate-900">Sumatera</option>
              <option value="Kalimantan" className="bg-slate-900">Kalimantan</option>
              <option value="Sulawesi" className="bg-slate-900">Sulawesi</option>
            </select>
          </div>

          {/* Metric Mode Toggle */}
          <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800 text-xs font-semibold">
            <button
              onClick={() => setMetricMode('shipment_count')}
              className={`px-2.5 py-1 rounded transition cursor-pointer ${
                metricMode === 'shipment_count' ? 'bg-rose-600 text-white shadow' : 'text-slate-400 hover:text-white'
              }`}
            >
              Frekuensi
            </button>
            <button
              onClick={() => setMetricMode('cargo_weight')}
              className={`px-2.5 py-1 rounded transition cursor-pointer ${
                metricMode === 'cargo_weight' ? 'bg-rose-600 text-white shadow' : 'text-slate-400 hover:text-white'
              }`}
            >
              Tonase Kargo
            </button>
            <button
              onClick={() => setMetricMode('store_density')}
              className={`px-2.5 py-1 rounded transition cursor-pointer ${
                metricMode === 'store_density' ? 'bg-rose-600 text-white shadow' : 'text-slate-400 hover:text-white'
              }`}
            >
              Tipe Outlet
            </button>
          </div>

          {/* Glow Toggle */}
          <button
            onClick={() => setShowRadiusGlow(!showRadiusGlow)}
            className={`p-1.5 rounded-lg border transition cursor-pointer ${
              showRadiusGlow ? 'bg-amber-500/20 border-amber-500/40 text-amber-300' : 'bg-slate-950 border-slate-800 text-slate-500'
            }`}
            title="Toggle Radius Heat Glow"
          >
            <Sparkles className="w-4 h-4" />
          </button>

          {/* Reset View */}
          <button
            onClick={handleResetView}
            className="p-1.5 bg-slate-950 hover:bg-slate-800 text-slate-300 rounded-lg border border-slate-800 transition cursor-pointer"
            title="Reset Posisi Peta"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Main Container: Map + Side Summary */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Leaflet Heatmap Canvas */}
        <div className="lg:col-span-8 relative rounded-xl overflow-hidden border border-slate-800 bg-slate-950 shadow-inner">
          <div ref={mapContainerRef} className={`w-full ${heightClass} z-10`} />

          {/* Legend Overlay on Map */}
          <div className="absolute bottom-4 left-4 z-[400] bg-slate-950/90 backdrop-blur-md border border-slate-800 rounded-lg p-3 text-[11px] shadow-lg space-y-2 pointer-events-auto">
            <div className="font-bold text-white flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-rose-400" />
              <span>Skala Intensitas Pengiriman</span>
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-rose-500 border border-white/50 shadow-sm" />
                <span className="text-slate-200 font-semibold">Tinggi / Hotspot Utama (&gt;65%)</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-amber-500 border border-white/50 shadow-sm" />
                <span className="text-slate-300">Sedang / Reguler (35 - 65%)</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-emerald-500 border border-white/50 shadow-sm" />
                <span className="text-slate-400">Rendah / Periodik (&lt;35%)</span>
              </div>
              <div className="flex items-center gap-2 border-t border-slate-800 pt-1.5">
                <span className="w-3 h-3 rounded-full bg-gradient-to-tr from-amber-600 to-yellow-400 border border-white shadow-xs flex items-center justify-center text-[8px] text-slate-950 font-black">★</span>
                <span className="text-amber-300 font-bold">AKK Banyuwangi DC (Hub Pusat)</span>
              </div>
            </div>
          </div>
        </div>

        {/* Analytics & Hotspot List */}
        <div className="lg:col-span-4 space-y-3.5 flex flex-col justify-between">
          {/* Top City Hotspots List */}
          <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                <BarChart3 className="w-3.5 h-3.5 text-rose-400" />
                <span>Kluster Area Terpanas</span>
              </h4>
              <span className="text-[10px] text-slate-400 font-mono">
                {storeHeatList.length} Outlet Toko
              </span>
            </div>

            <div className="space-y-2 max-h-[320px] overflow-y-auto pr-1">
              {topCityHotspots.map((hs, idx) => {
                const totalAllWeight = topCityHotspots.reduce((sum, h) => sum + h.totalWeight, 0) || 1;
                const percent = Math.round((hs.totalWeight / totalAllWeight) * 100);

                return (
                  <div 
                    key={idx}
                    className="p-2.5 rounded-lg bg-slate-900 border border-slate-800 hover:border-slate-700 transition space-y-1.5"
                  >
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-white flex items-center gap-1.5">
                        <span className="w-5 h-5 rounded bg-rose-500/20 text-rose-300 font-mono font-bold text-[10px] flex items-center justify-center border border-rose-500/30">
                          #{idx + 1}
                        </span>
                        {hs.city}
                      </span>
                      <span className="text-[10px] font-semibold text-rose-400 bg-rose-500/10 px-1.5 py-0.5 rounded border border-rose-500/20">
                        {hs.shipmentCount} Trip
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-slate-400">
                      <span>{hs.storeCount} Toko Retail</span>
                      <span className="font-mono text-slate-200">{hs.totalWeight} Ton Kargo</span>
                    </div>

                    {/* Progress Bar */}
                    <div className="w-full bg-slate-950 h-1.5 rounded-full overflow-hidden flex">
                      <div 
                        className="bg-gradient-to-r from-amber-500 to-rose-500 h-full rounded-full transition-all duration-500"
                        style={{ width: `${Math.max(8, percent)}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Operational Recommendation Insight Card */}
          <div className="bg-gradient-to-br from-slate-950 to-rose-950/30 border border-rose-500/30 rounded-xl p-3.5 space-y-2">
            <div className="flex items-center gap-2 text-rose-300 font-bold text-xs">
              <Zap className="w-4 h-4 text-rose-400 shrink-0" />
              <span>Rekomendasi Alokasi Efisiensi</span>
            </div>
            <p className="text-[11px] text-slate-300 leading-relaxed">
              Konsentrasi area tertinggi berada pada koridor <strong className="text-white">Surabaya &amp; Sanur/Denpasar Bali</strong>. Disarankan menggunakan <strong className="text-amber-300">Tronton Wingbox (20 Ton)</strong> untuk konsolidasi rute utama, disusul pembagian kluster lokal armada CDD.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
