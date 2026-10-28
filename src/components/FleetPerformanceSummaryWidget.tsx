import React, { useState, useMemo } from 'react';
import { 
  Radio, 
  Truck, 
  Activity, 
  Clock, 
  MapPin, 
  Navigation, 
  Signal, 
  RotateCcw, 
  Search, 
  Filter, 
  TrendingUp, 
  Zap, 
  Battery, 
  Compass,
  BarChart2,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { TracksolidDevice, Fleet } from '../types';

interface FleetPerformanceSummaryWidgetProps {
  devices: TracksolidDevice[];
  fleets: Fleet[];
  onNavigateToTracking?: () => void;
}

export const FleetPerformanceSummaryWidget: React.FC<FleetPerformanceSummaryWidgetProps> = ({
  devices,
  fleets,
  onNavigateToTracking
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'online' | 'sleeping' | 'offline'>('all');
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Refresh handler simulation
  const handleRefresh = () => {
    setIsRefreshing(true);
    setTimeout(() => {
      setIsRefreshing(false);
    }, 600);
  };

  // Aggregated Tracksolid Metrics calculation
  const aggregatedMetrics = useMemo(() => {
    const totalDevices = devices.length;
    const onlineCount = devices.filter(d => d.status === 'Online').length;
    const sleepingCount = devices.filter(d => d.status === 'Sleeping').length;
    const offlineCount = devices.filter(d => d.status === 'Offline').length;

    // Total Mileage Today across all Tracksolid devices (in km)
    const totalDailyMileageKm = devices.reduce((sum, dev) => sum + (dev.todayMileageKm || 0), 0);
    const avgMileagePerFleet = totalDevices > 0 ? totalDailyMileageKm / totalDevices : 0;

    // Estimated active vs idle duration breakdown
    // If status is Online with speed > 0 -> Active; Sleeping/Stop -> Idle
    let totalActiveHours = 0;
    let totalIdleHours = 0;

    devices.forEach(dev => {
      const mileage = dev.todayMileageKm || 0;
      // Estimate active hours based on average 38 km/h moving speed
      const estimatedActiveHrs = mileage > 0 ? Number((mileage / 38).toFixed(1)) : 0;
      totalActiveHours += estimatedActiveHrs;

      // Extract idle hours from stopDuration string (e.g., "1hr+", "3hr+", "45m")
      let idleHrs = 1.2; // default fallback
      if (dev.stopDuration) {
        if (dev.stopDuration.includes('hr')) {
          const matched = dev.stopDuration.match(/\d+/);
          if (matched) idleHrs = parseInt(matched[0], 10);
        } else if (dev.stopDuration.includes('m')) {
          const matched = dev.stopDuration.match(/\d+/);
          if (matched) idleHrs = parseInt(matched[0], 10) / 60;
        }
      }
      totalIdleHours += idleHrs;
    });

    const grandTotalHours = Math.max(1, totalActiveHours + totalIdleHours);
    const activeRatioPercent = Math.round((totalActiveHours / grandTotalHours) * 100);
    const idleRatioPercent = 100 - activeRatioPercent;

    // Highest mileage fleet
    const topMileageDevice = [...devices].sort((a, b) => (b.todayMileageKm || 0) - (a.todayMileageKm || 0))[0];

    return {
      totalDevices,
      onlineCount,
      sleepingCount,
      offlineCount,
      totalDailyMileageKm: Number(totalDailyMileageKm.toFixed(1)),
      avgMileagePerFleet: Number(avgMileagePerFleet.toFixed(1)),
      totalActiveHours: Number(totalActiveHours.toFixed(1)),
      totalIdleHours: Number(totalIdleHours.toFixed(1)),
      activeRatioPercent,
      idleRatioPercent,
      topMileageDevice
    };
  }, [devices]);

  // Filtered devices list for the embedded summary table
  const filteredDevices = useMemo(() => {
    return devices.filter(dev => {
      const matchSearch = 
        dev.vehiclePlate.toLowerCase().includes(searchQuery.toLowerCase()) ||
        dev.driverName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (dev.vehicleName && dev.vehicleName.toLowerCase().includes(searchQuery.toLowerCase())) ||
        dev.imei.includes(searchQuery);

      const matchStatus = 
        statusFilter === 'all' ||
        (statusFilter === 'online' && dev.status === 'Online') ||
        (statusFilter === 'sleeping' && dev.status === 'Sleeping') ||
        (statusFilter === 'offline' && dev.status === 'Offline');

      return matchSearch && matchStatus;
    });
  }, [devices, searchQuery, statusFilter]);

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-sm space-y-5 backdrop-blur">
      {/* Widget Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-500/20 border border-blue-500/40 flex items-center justify-center text-blue-400 shrink-0">
            <Radio className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <h3 className="text-base font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <span>Fleet Performance Summary</span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 font-mono border border-blue-500/30">
                Tracksolid GPS Live Telemetry
              </span>
            </h3>
            <p className="text-xs text-slate-400">
              Agregasi data durasi aktif vs idle, total jarak tempuh harian (mileage), dan status GPS seluruh armada
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold border border-slate-700 transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            title="Sinkronkan data telemetry Tracksolid terbaru"
          >
            <RotateCcw className={`w-3.5 h-3.5 text-blue-400 ${isRefreshing ? 'animate-spin' : ''}`} />
            <span>{isRefreshing ? 'Syncing...' : 'Sinkron GPS'}</span>
          </button>

          {onNavigateToTracking && (
            <button
              onClick={onNavigateToTracking}
              className="px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-xs"
            >
              <Navigation className="w-3.5 h-3.5" />
              <span>Live Tracking Map</span>
            </button>
          )}
        </div>
      </div>

      {/* KPI Highlight Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Daily Mileage */}
        <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-4 relative overflow-hidden group hover:border-blue-500/40 transition">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-xs font-semibold uppercase tracking-wider">Total Mileage Harian</span>
            <TrendingUp size={16} className="text-blue-400" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black font-mono text-white">
              {aggregatedMetrics.totalDailyMileageKm.toLocaleString('id-ID')}
            </span>
            <span className="text-xs font-bold text-blue-400">KM</span>
          </div>
          <div className="text-[11px] text-slate-400 mt-2 flex items-center justify-between pt-2 border-t border-slate-800/80">
            <span>Rata-rata / Fleet:</span>
            <strong className="text-slate-200 font-mono">{aggregatedMetrics.avgMileagePerFleet} km</strong>
          </div>
        </div>

        {/* Active vs Idle Duration Ratio */}
        <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-4 relative overflow-hidden group hover:border-emerald-500/40 transition">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-xs font-semibold uppercase tracking-wider">Durasi Aktif vs Idle</span>
            <Clock size={16} className="text-emerald-400" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black font-mono text-emerald-400">
              {aggregatedMetrics.activeRatioPercent}%
            </span>
            <span className="text-xs text-slate-400">
              Aktif ({aggregatedMetrics.totalActiveHours} jam)
            </span>
          </div>

          {/* Active vs Idle Progress Bar */}
          <div className="w-full h-2 bg-amber-500/30 rounded-full overflow-hidden mt-2 flex">
            <div 
              className="h-full bg-emerald-500 rounded-l-full transition-all duration-500"
              style={{ width: `${aggregatedMetrics.activeRatioPercent}%` }}
              title={`Aktif Berjalan: ${aggregatedMetrics.activeRatioPercent}% (${aggregatedMetrics.totalActiveHours} Jam)`}
            />
            <div 
              className="h-full bg-amber-500 rounded-r-full transition-all duration-500"
              style={{ width: `${aggregatedMetrics.idleRatioPercent}%` }}
              title={`Idle / Diam: ${aggregatedMetrics.idleRatioPercent}% (${aggregatedMetrics.totalIdleHours} Jam)`}
            />
          </div>

          <div className="text-[10px] text-slate-400 mt-1.5 flex justify-between font-mono">
            <span className="text-emerald-400">🟢 {aggregatedMetrics.totalActiveHours} Jam Driving</span>
            <span className="text-amber-400">🟡 {aggregatedMetrics.totalIdleHours} Jam Idle</span>
          </div>
        </div>

        {/* Fleet Status Breakdown */}
        <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-4 relative overflow-hidden group hover:border-indigo-500/40 transition">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-xs font-semibold uppercase tracking-wider">Status Perangkat Tracksolid</span>
            <Activity size={16} className="text-indigo-400" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black font-mono text-white">
              {aggregatedMetrics.totalDevices}
            </span>
            <span className="text-xs font-bold text-slate-400">Unit GPS</span>
          </div>

          <div className="grid grid-cols-3 gap-1 text-center mt-2 pt-2 border-t border-slate-800/80 text-[10px] font-mono">
            <div className="bg-emerald-500/10 border border-emerald-500/20 p-1 rounded text-emerald-400">
              <div className="font-bold">{aggregatedMetrics.onlineCount}</div>
              <div className="text-[9px] text-slate-400">Online</div>
            </div>
            <div className="bg-amber-500/10 border border-amber-500/20 p-1 rounded text-amber-400">
              <div className="font-bold">{aggregatedMetrics.sleepingCount}</div>
              <div className="text-[9px] text-slate-400">Sleeping</div>
            </div>
            <div className="bg-rose-500/10 border border-rose-500/20 p-1 rounded text-rose-400">
              <div className="font-bold">{aggregatedMetrics.offlineCount}</div>
              <div className="text-[9px] text-slate-400">Offline</div>
            </div>
          </div>
        </div>

        {/* Top Performer Fleet */}
        <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-4 relative overflow-hidden group hover:border-amber-500/40 transition">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-xs font-semibold uppercase tracking-wider">Jarak Tempuh Tertinggi</span>
            <Zap size={16} className="text-amber-400" />
          </div>

          {aggregatedMetrics.topMileageDevice ? (
            <>
              <div className="font-mono font-black text-amber-400 text-lg flex items-center justify-between">
                <span>{aggregatedMetrics.topMileageDevice.vehiclePlate}</span>
                <span className="text-xs text-white bg-amber-500/20 px-2 py-0.5 rounded border border-amber-500/30">
                  {aggregatedMetrics.topMileageDevice.todayMileageKm} KM
                </span>
              </div>
              <div className="text-xs text-slate-300 font-medium truncate mt-0.5">
                Driver: {aggregatedMetrics.topMileageDevice.driverName}
              </div>
              <div className="text-[10px] text-slate-400 truncate mt-1 flex items-center gap-1">
                <MapPin size={10} className="text-slate-500 shrink-0" />
                <span className="truncate">{aggregatedMetrics.topMileageDevice.address}</span>
              </div>
            </>
          ) : (
            <div className="text-xs text-slate-500">Tidak ada data mileage.</div>
          )}
        </div>
      </div>

      {/* Embedded Summary Table & Filter Controls */}
      <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-4 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Truck size={16} className="text-blue-400" />
            <h4 className="text-xs font-bold text-slate-200 uppercase tracking-wider">
              Rincian Telemetry Per Armada Tracksolid ({filteredDevices.length} Unit)
            </h4>
          </div>

          {/* Search & Status Filters */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2" />
              <input
                type="text"
                placeholder="Cari Plat / Supir / IMEI..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="bg-slate-900 border border-slate-800 rounded-lg pl-8 pr-3 py-1 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500 w-44 sm:w-56"
              />
            </div>

            <div className="flex items-center gap-1 bg-slate-900 p-0.5 rounded-lg border border-slate-800 text-[11px]">
              <button
                onClick={() => setStatusFilter('all')}
                className={`px-2.5 py-1 rounded-md transition cursor-pointer font-semibold ${
                  statusFilter === 'all' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Semua
              </button>
              <button
                onClick={() => setStatusFilter('online')}
                className={`px-2.5 py-1 rounded-md transition cursor-pointer font-semibold ${
                  statusFilter === 'online' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Online
              </button>
              <button
                onClick={() => setStatusFilter('sleeping')}
                className={`px-2.5 py-1 rounded-md transition cursor-pointer font-semibold ${
                  statusFilter === 'sleeping' ? 'bg-amber-600 text-white' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Sleeping
              </button>
            </div>
          </div>
        </div>

        {/* Table View */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-900/90 text-slate-400 border-b border-slate-800">
              <tr>
                <th className="p-2.5 font-semibold">Armada &amp; Inisial</th>
                <th className="p-2.5 font-semibold">Driver Utama</th>
                <th className="p-2.5 font-semibold">Status Tracksolid</th>
                <th className="p-2.5 font-semibold text-right">Jarak Harian (KM)</th>
                <th className="p-2.5 font-semibold text-center">Durasi Stop / Idle</th>
                <th className="p-2.5 font-semibold text-center">Baterai &amp; Sinyal</th>
                <th className="p-2.5 font-semibold">Lokasi Terakhir</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80 text-slate-300">
              {filteredDevices.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-6 text-center text-slate-500">
                    Tidak ditemukan data GPS Tracksolid yang sesuai filter.
                  </td>
                </tr>
              ) : (
                filteredDevices.map(dev => {
                  const statusColor = 
                    dev.status === 'Online' 
                      ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40' 
                      : dev.status === 'Sleeping'
                      ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                      : 'bg-rose-500/20 text-rose-300 border-rose-500/40';

                  return (
                    <tr key={dev.imei} className="hover:bg-slate-800/40 transition">
                      <td className="p-2.5 font-mono">
                        <div className="font-bold text-white flex items-center gap-1.5">
                          <span>{dev.vehiclePlate}</span>
                        </div>
                        <div className="text-[10px] text-slate-400 truncate max-w-[160px]">
                          {dev.vehicleName || `IMEI: ${dev.imei.slice(-6)}`}
                        </div>
                      </td>

                      <td className="p-2.5 font-medium text-slate-200">
                        {dev.driverName}
                      </td>

                      <td className="p-2.5">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border inline-flex items-center gap-1 ${statusColor}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${dev.status === 'Online' ? 'bg-emerald-400 animate-pulse' : dev.status === 'Sleeping' ? 'bg-amber-400' : 'bg-rose-400'}`} />
                          <span>{dev.status}</span>
                        </span>
                      </td>

                      <td className="p-2.5 text-right font-mono font-bold text-blue-400">
                        {dev.todayMileageKm ? `${dev.todayMileageKm.toFixed(1)} km` : '0 km'}
                      </td>

                      <td className="p-2.5 text-center font-mono text-slate-300">
                        {dev.stopDuration || '0m'}
                      </td>

                      <td className="p-2.5 text-center">
                        <div className="inline-flex items-center gap-2 text-[10px] font-mono">
                          <span className="flex items-center gap-0.5 text-emerald-400" title={`Baterai GPS: ${dev.batteryPercent}%`}>
                            <Battery size={11} />
                            <span>{dev.batteryPercent}%</span>
                          </span>
                          <span className="flex items-center gap-0.5 text-blue-400" title={`Sinyal GSM: ${dev.signalGsm}/5`}>
                            <Signal size={11} />
                            <span>{dev.signalGsm}/5</span>
                          </span>
                        </div>
                      </td>

                      <td className="p-2.5 text-slate-400 text-[11px]">
                        <div className="truncate max-w-[220px] flex items-center gap-1" title={dev.address}>
                          <MapPin size={11} className="text-slate-500 shrink-0" />
                          <span className="truncate">{dev.address}</span>
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
    </div>
  );
};
