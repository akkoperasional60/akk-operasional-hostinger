import React, { useState, useMemo } from 'react';
import {
  Disc,
  Radio,
  AlertTriangle,
  CheckCircle2,
  AlertCircle,
  Truck,
  RotateCcw,
  Gauge,
  Calendar,
  Activity,
  ArrowRight,
  TrendingDown,
  Wrench,
  Search,
  Filter,
  RefreshCw,
  ExternalLink,
  ShieldCheck,
  Zap,
  Info
} from 'lucide-react';
import { FleetTireWearPrediction } from '../types';
import { logisticsStore } from '../services/store';

interface TireWearPredictionModuleProps {
  onNavigateToSpareParts?: () => void;
  onNavigateToTracksolid?: () => void;
}

export const TireWearPredictionModule: React.FC<TireWearPredictionModuleProps> = ({
  onNavigateToSpareParts,
  onNavigateToTracksolid
}) => {
  const [predictions, setPredictions] = useState<FleetTireWearPrediction[]>(() =>
    logisticsStore.getFleetTireWearPredictions()
  );
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'Optimal' | 'Waspada' | 'Kritis'>('all');
  const [selectedFleetPrediction, setSelectedFleetPrediction] = useState<FleetTireWearPrediction | null>(null);

  const refreshPredictions = () => {
    setPredictions(logisticsStore.getFleetTireWearPredictions());
  };

  // Filtered predictions
  const filteredPredictions = useMemo(() => {
    return predictions.filter(p => {
      const matchSearch =
        p.plateNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.vehicleType.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (p.initialCode && p.initialCode.toLowerCase().includes(searchQuery.toLowerCase())) ||
        p.tireBrandModel.toLowerCase().includes(searchQuery.toLowerCase());
      const matchStatus = statusFilter === 'all' || p.status === statusFilter;
      return matchSearch && matchStatus;
    });
  }, [predictions, searchQuery, statusFilter]);

  // Aggregate metrics
  const summary = useMemo(() => {
    const total = predictions.length;
    const optimalCount = predictions.filter(p => p.status === 'Optimal').length;
    const waspadaCount = predictions.filter(p => p.status === 'Waspada').length;
    const kritisCount = predictions.filter(p => p.status === 'Kritis').length;
    const rotationCount = predictions.filter(p => p.isRotationNeeded).length;
    const avgHealth = total > 0 ? Math.round(predictions.reduce((acc, p) => acc + p.healthScore, 0) / total) : 0;
    const totalDailyKm = Number(predictions.reduce((acc, p) => acc + p.todayMileageKm, 0).toFixed(1));

    return {
      total,
      optimalCount,
      waspadaCount,
      kritisCount,
      rotationCount,
      avgHealth,
      totalDailyKm
    };
  }, [predictions]);

  return (
    <div className="space-y-6">
      {/* Overview KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3">
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
            <span className="font-semibold">Kesehatan Ban Rerata</span>
            <Disc className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-black text-white font-mono">{summary.avgHealth}%</div>
          <div className="text-[11px] text-emerald-400 mt-1 flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3" />
            <span>Kondisi Seluruh Armada</span>
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
            <span className="font-semibold">Jarak Tempuh Hari Ini</span>
            <Radio className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="text-2xl font-black text-cyan-400 font-mono">
            {summary.totalDailyKm} <span className="text-xs font-normal text-slate-400">KM</span>
          </div>
          <div className="text-[11px] text-slate-400 mt-1 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
            <span>Data GPS Tracksolid</span>
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
            <span className="font-semibold">Status Waspada</span>
            <AlertCircle className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-2xl font-black text-amber-400 font-mono">{summary.waspadaCount} Unit</div>
          <div className="text-[11px] text-amber-300 mt-1">Aus 65% - 85%</div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
            <span className="font-semibold">Kritis (Ganti Segera)</span>
            <AlertTriangle className="w-4 h-4 text-rose-400" />
          </div>
          <div className="text-2xl font-black text-rose-400 font-mono">{summary.kritisCount} Unit</div>
          <div className="text-[11px] text-rose-400 mt-1">&lt; 3.0 mm Alur Ban</div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 col-span-2 md:col-span-4 lg:col-span-1">
          <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
            <span className="font-semibold">Jadwal Rotasi Silang</span>
            <RotateCcw className="w-4 h-4 text-blue-400" />
          </div>
          <div className="text-2xl font-black text-blue-400 font-mono">{summary.rotationCount} Unit</div>
          <div className="text-[11px] text-slate-400 mt-1">Tiap 10.000 KM</div>
        </div>
      </div>

      {/* Banner Peringatan Kritis */}
      {summary.kritisCount > 0 && (
        <div className="bg-rose-500/10 border border-rose-500/30 rounded-2xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-rose-500/20 text-rose-400 rounded-xl mt-0.5">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-rose-300">
                Peringatan Keausan Ban Tingkat Kritis ({summary.kritisCount} Armada)
              </h4>
              <p className="text-xs text-slate-300 mt-0.5 leading-relaxed">
                Terdapat armada dengan ketebalan tapak ban telah mendekati atau melewati batas minimum keamanan (&le; 3.0 mm) berdasarkan akumulasi jarak tempuh harian Tracksolid. Segera lakukan penggantian di gudang untuk mencegah risiko ban meletus pada muatan berat.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {onNavigateToSpareParts && (
              <button
                onClick={onNavigateToSpareParts}
                className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs shadow transition cursor-pointer flex items-center gap-1.5"
              >
                <Wrench className="w-3.5 h-3.5" />
                <span>Buka Gudang Ban &rarr;</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Filter and Action Bar */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-64">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Cari plat, inisial, model ban..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
            />
          </div>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className="px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-200 focus:outline-none cursor-pointer"
          >
            <option value="all">Semua Kondisi Ban</option>
            <option value="Optimal">Optimal (Prima)</option>
            <option value="Waspada">Waspada (Aus Sedang)</option>
            <option value="Kritis">Kritis (Segera Ganti)</option>
          </select>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
          <button
            onClick={refreshPredictions}
            className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-750 text-slate-300 hover:text-white border border-slate-700 text-xs font-semibold transition cursor-pointer flex items-center gap-1.5"
            title="Sinkronisasi ulang kalkulasi keausan ban dengan data Tracksolid GPS"
          >
            <RefreshCw className="w-3.5 h-3.5 text-cyan-400" />
            <span>Sinkronkan Tracksolid</span>
          </button>

          {onNavigateToTracksolid && (
            <button
              onClick={onNavigateToTracksolid}
              className="px-3 py-1.5 rounded-lg bg-cyan-600/15 hover:bg-cyan-600/25 text-cyan-300 border border-cyan-500/30 text-xs font-semibold transition cursor-pointer flex items-center gap-1.5"
            >
              <Radio className="w-3.5 h-3.5" />
              <span>Pantau GPS &rarr;</span>
            </button>
          )}
        </div>
      </div>

      {/* Main Tire Wear Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredPredictions.map(item => {
          const isKritis = item.status === 'Kritis';
          const isWaspada = item.status === 'Waspada';

          return (
            <div
              key={item.fleetId}
              className={`bg-slate-900 border rounded-2xl p-5 shadow-sm space-y-4 transition hover:border-slate-700 relative overflow-hidden ${
                isKritis 
                  ? 'border-rose-500/50 bg-gradient-to-b from-rose-950/20 to-slate-900' 
                  : isWaspada 
                  ? 'border-amber-500/40 bg-gradient-to-b from-amber-950/15 to-slate-900' 
                  : 'border-slate-800'
              }`}
            >
              {/* Header Card */}
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-lg font-black text-white font-mono tracking-wider">
                      {item.plateNumber}
                    </span>
                    {item.initialCode && (
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/40">
                        {item.initialCode}
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-slate-400 mt-0.5">
                    {item.vehicleType} &bull; {item.brand}
                  </div>
                </div>

                <span className={`px-2.5 py-1 rounded-full text-xs font-bold border flex items-center gap-1 ${
                  isKritis
                    ? 'bg-rose-500/15 text-rose-400 border-rose-500/30 animate-pulse'
                    : isWaspada
                    ? 'bg-amber-500/15 text-amber-400 border-amber-500/30'
                    : 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                }`}>
                  {isKritis ? <AlertTriangle className="w-3 h-3" /> : isWaspada ? <AlertCircle className="w-3 h-3" /> : <CheckCircle2 className="w-3 h-3" />}
                  <span>{item.statusLabel}</span>
                </span>
              </div>

              {/* Tread Depth & Wear Progress Bar */}
              <div className="space-y-1.5 bg-slate-950/70 p-3 rounded-xl border border-slate-800/80">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-400 flex items-center gap-1">
                    <Disc className="w-3.5 h-3.5 text-amber-400" />
                    <span>Ketebalan Tapak Alur Ban:</span>
                  </span>
                  <span className="font-mono font-black text-white text-sm">
                    {item.currentTreadDepthMm} <span className="text-[10px] text-slate-400 font-normal">mm</span>
                    <span className="text-[10px] text-slate-500 ml-1">/ {item.initialTreadDepthMm} mm</span>
                  </span>
                </div>

                {/* Visual Wear Progress Bar */}
                <div className="w-full h-2.5 bg-slate-800 rounded-full overflow-hidden p-0.5">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      isKritis 
                        ? 'bg-gradient-to-r from-amber-500 to-rose-500' 
                        : isWaspada 
                        ? 'bg-gradient-to-r from-emerald-500 to-amber-500' 
                        : 'bg-gradient-to-r from-teal-500 to-emerald-400'
                    }`}
                    style={{ width: `${Math.max(5, item.healthScore)}%` }}
                  />
                </div>

                <div className="flex items-center justify-between text-[11px] text-slate-400 pt-0.5">
                  <span>Keausan: <strong className="text-slate-200 font-mono">{item.wearPercentage}%</strong></span>
                  <span>Kesehatan: <strong className={isKritis ? 'text-rose-400 font-mono' : isWaspada ? 'text-amber-400 font-mono' : 'text-emerald-400 font-mono'}>{item.healthScore}%</strong></span>
                </div>
              </div>

              {/* Tracksolid Integration & Mileage Metrics */}
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="bg-slate-950/50 p-2.5 rounded-xl border border-slate-800/80">
                  <div className="flex items-center gap-1 text-[11px] text-cyan-400 mb-0.5">
                    <Radio className="w-3.5 h-3.5" />
                    <span className="font-semibold">Jarak Hari Ini (GPS):</span>
                  </div>
                  <div className="text-base font-black text-white font-mono">
                    {item.todayMileageKm} <span className="text-[10px] text-slate-400 font-normal">KM</span>
                  </div>
                  <div className="text-[10px] text-slate-400 mt-0.5 truncate">
                    Rate Aus: {item.dailyWearRateMm} mm/hari
                  </div>
                </div>

                <div className="bg-slate-950/50 p-2.5 rounded-xl border border-slate-800/80">
                  <div className="flex items-center gap-1 text-[11px] text-amber-400 mb-0.5">
                    <Calendar className="w-3.5 h-3.5" />
                    <span className="font-semibold">Sisa Umur Pakai:</span>
                  </div>
                  <div className="text-base font-black text-amber-400 font-mono">
                    ~{item.estimatedDaysRemaining} <span className="text-[10px] text-slate-400 font-normal">Hari</span>
                  </div>
                  <div className="text-[10px] text-slate-400 mt-0.5 truncate">
                    Sisa {item.remainingKm.toLocaleString('id-ID')} KM
                  </div>
                </div>
              </div>

              {/* Technical Specifications */}
              <div className="bg-slate-950/40 p-2.5 rounded-xl border border-slate-800/60 text-xs space-y-1.5">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-slate-400">Tipe / Ukuran Ban:</span>
                  <span className="font-semibold text-slate-200">{item.tireSize}</span>
                </div>
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-slate-400">Merk / Model Ban:</span>
                  <span className="font-semibold text-slate-300 truncate max-w-[180px]">{item.tireBrandModel}</span>
                </div>
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-slate-400">Tekanan Angin:</span>
                  <span className="font-mono font-semibold text-cyan-300">
                    {item.pressurePsi} PSI <span className="text-slate-500 font-normal">(Rec: {item.recommendedPressurePsi})</span>
                  </span>
                </div>
                <div className="flex items-center justify-between text-[11px] pt-1 border-t border-slate-800/60">
                  <span className="text-slate-400">Proyeksi Ganti Ban:</span>
                  <span className="font-mono font-bold text-amber-400">{item.projectedReplacementDate}</span>
                </div>
              </div>

              {/* Rotasi Ban Warning if needed */}
              {item.isRotationNeeded && (
                <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-2.5 flex items-center gap-2 text-xs text-blue-300">
                  <RotateCcw className="w-4 h-4 text-blue-400 shrink-0 animate-spin" />
                  <span className="text-[11px] leading-tight">
                    <strong>Jadwal Rotasi Silang:</strong> Ban telah menempuh interval 10.000 KM. Disarankan rotasi untuk keausan merata.
                  </span>
                </div>
              )}

              {/* Recommendation Callout */}
              <div className="text-[11px] text-slate-300 bg-slate-950/60 p-2.5 rounded-xl border border-slate-800/80 leading-relaxed">
                <span className="font-bold text-amber-400 block mb-0.5">Rekomendasi Fleet Engineer:</span>
                {item.recommendation}
              </div>

              {/* Action Buttons */}
              <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-xs">
                <button
                  onClick={() => setSelectedFleetPrediction(item)}
                  className="text-amber-400 hover:text-amber-300 font-semibold flex items-center gap-1 cursor-pointer"
                >
                  <Info className="w-3.5 h-3.5" />
                  <span>Rincian Prediksi &rarr;</span>
                </button>

                {onNavigateToSpareParts && (
                  <button
                    onClick={onNavigateToSpareParts}
                    className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-750 text-slate-200 border border-slate-700 font-medium flex items-center gap-1 cursor-pointer"
                  >
                    <Wrench className="w-3 h-3 text-amber-400" />
                    <span>Servis Ban</span>
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Modal Detail Prediksi Keausan Ban */}
      {selectedFleetPrediction && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-xl overflow-hidden shadow-2xl">
            <div className="p-5 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-400">
                  <Disc className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    <span>Analisis Prediksi Keausan Ban</span>
                    <span className="font-mono text-amber-400">{selectedFleetPrediction.plateNumber}</span>
                  </h3>
                  <p className="text-xs text-slate-400">
                    Model Prediktif Berbasis Jarak Tempuh Harian GPS Tracksolid &bull; PT Anugrah Kemasan Kreatif
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedFleetPrediction(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 cursor-pointer"
              >
                &times;
              </button>
            </div>

            <div className="p-5 space-y-4 max-h-[80vh] overflow-y-auto text-xs">
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-3">
                <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
                  <span className="text-slate-400">Unit Armada & Inisial:</span>
                  <span className="font-bold text-white">
                    {selectedFleetPrediction.plateNumber} ({selectedFleetPrediction.initialCode || '-'}) &bull; {selectedFleetPrediction.vehicleType}
                  </span>
                </div>
                <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
                  <span className="text-slate-400">Merk & Tipe Ban Terpasang:</span>
                  <span className="font-bold text-white">{selectedFleetPrediction.tireBrandModel} ({selectedFleetPrediction.tireSize})</span>
                </div>
                <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
                  <span className="text-slate-400">Odometer Terkini:</span>
                  <span className="font-mono font-bold text-white">{selectedFleetPrediction.currentOdometerKm.toLocaleString('id-ID')} KM</span>
                </div>
                <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
                  <span className="text-slate-400">Jarak Tempuh Harian Tracksolid:</span>
                  <span className="font-mono font-bold text-cyan-400">{selectedFleetPrediction.todayMileageKm} KM / Hari</span>
                </div>
                <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
                  <span className="text-slate-400">Jarak Akumulasi Set Ban Ini:</span>
                  <span className="font-mono font-bold text-white">{selectedFleetPrediction.accumulatedKm.toLocaleString('id-ID')} KM / {selectedFleetPrediction.maxLifespanKm.toLocaleString('id-ID')} KM</span>
                </div>
                <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
                  <span className="text-slate-400">Ketebalan Tapak Alur:</span>
                  <span className="font-mono font-bold text-amber-400">{selectedFleetPrediction.currentTreadDepthMm} mm (Standar Baru: {selectedFleetPrediction.initialTreadDepthMm} mm)</span>
                </div>
                <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
                  <span className="text-slate-400">Laju Pengikisan Rerata (Wear Rate):</span>
                  <span className="font-mono font-bold text-slate-200">{selectedFleetPrediction.dailyWearRateMm} mm / hari</span>
                </div>
                <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
                  <span className="text-slate-400">Estimasi Sisa Umur Pakai:</span>
                  <span className="font-mono font-bold text-emerald-400">~{selectedFleetPrediction.estimatedDaysRemaining} Hari Operasional ({selectedFleetPrediction.remainingKm.toLocaleString('id-ID')} KM)</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Proyeksi Tanggal Penggantian:</span>
                  <span className="font-mono font-black text-rose-400 text-sm">{selectedFleetPrediction.projectedReplacementDate}</span>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
                <span className="text-slate-400 font-bold block">Rekomendasi Tindakan:</span>
                <p className="text-slate-200 leading-relaxed">{selectedFleetPrediction.recommendation}</p>
              </div>
            </div>

            <div className="p-4 border-t border-slate-800 flex items-center justify-end gap-2 bg-slate-950/60">
              <button
                onClick={() => setSelectedFleetPrediction(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold cursor-pointer text-xs"
              >
                Tutup
              </button>
              {onNavigateToSpareParts && (
                <button
                  onClick={() => {
                    setSelectedFleetPrediction(null);
                    onNavigateToSpareParts();
                  }}
                  className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold cursor-pointer text-xs flex items-center gap-1.5"
                >
                  <Wrench className="w-3.5 h-3.5" />
                  <span>Jadwalkan Servis Ban</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
