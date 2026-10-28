import React, { useState, useEffect } from 'react';
import { 
  Compass, 
  Zap, 
  Clock, 
  Users, 
  Truck, 
  MapPin, 
  CheckCircle2, 
  Award, 
  ShieldCheck, 
  Activity, 
  BarChart3, 
  ArrowRight, 
  ChevronRight, 
  X, 
  AlertCircle, 
  Fuel, 
  DollarSign, 
  Sparkles, 
  Sliders, 
  Calendar,
  Layers,
  ThumbsUp
} from 'lucide-react';
import { Crew, Fleet, RetailStore, Schedule } from '../types';
import { RouteOptimizerService, OptimizationPriority, RecommendationCandidate } from '../services/routeOptimizer';
import { logisticsStore } from '../services/store';

interface OptimalRoutePlanningModalProps {
  isOpen: boolean;
  onClose: () => void;
  crews: Crew[];
  fleets: Fleet[];
  stores: RetailStore[];
  onApplyRecommendation: (recommended: {
    storeId: string;
    driverId: string;
    helperId?: string;
    fleetId: string;
    cargoWeightTon: number;
    notes: string;
  }) => void;
}

export const OptimalRoutePlanningModal: React.FC<OptimalRoutePlanningModalProps> = ({
  isOpen,
  onClose,
  crews,
  fleets,
  stores,
  onApplyRecommendation,
}) => {
  const [selectedStoreId, setSelectedStoreId] = useState<string>(stores[0]?.id || '');
  const [cargoWeightTon, setCargoWeightTon] = useState<number>(12.5);
  const [priority, setPriority] = useState<OptimizationPriority>('fastest_time');
  const [candidates, setCandidates] = useState<RecommendationCandidate[]>([]);
  const [selectedIndex, setSelectedIndex] = useState<number>(0);
  const [isCalculating, setIsCalculating] = useState<boolean>(false);
  const [appliedSuccessMsg, setAppliedSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && stores.length > 0) {
      if (!selectedStoreId) {
        setSelectedStoreId(stores[0].id);
      }
      runOptimization();
    }
  }, [isOpen, selectedStoreId, cargoWeightTon, priority, stores, crews, fleets]);

  const runOptimization = () => {
    setIsCalculating(true);
    setTimeout(() => {
      const results = RouteOptimizerService.optimizeRouteAssignment(
        {
          storeId: selectedStoreId || stores[0]?.id || '',
          cargoWeightTon,
          priority,
        },
        crews,
        fleets,
        stores
      );
      setCandidates(results);
      setSelectedIndex(0);
      setIsCalculating(false);
    }, 250);
  };

  if (!isOpen) return null;

  const currentStore = stores.find(s => s.id === selectedStoreId) || stores[0];
  const topCandidate = candidates[selectedIndex] || candidates[0];

  const handleApply = (candidate: RecommendationCandidate) => {
    onApplyRecommendation({
      storeId: currentStore.id,
      driverId: candidate.driver.id,
      helperId: candidate.helper?.id,
      fleetId: candidate.fleet.id,
      cargoWeightTon,
      notes: `Direkomendasikan otomatis oleh Algoritma Optimal Route Planning (Skor Efisiensi ${candidate.overallScore}%).`
    });

    logisticsStore.logActivity(
      'Optimal Route Planning Applied',
      currentStore.storeName,
      `Penerapan rekomendasi driver ${candidate.driver.name} & armada ${candidate.fleet.plateNumber} (Skor ${candidate.overallScore}%)`
    );

    setAppliedSuccessMsg(`Rekomendasi kru & armada untuk ${currentStore.storeName} berhasil diterapkan!`);
    setTimeout(() => {
      setAppliedSuccessMsg(null);
      onClose();
    }, 1200);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-3 md:p-6 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-6xl overflow-hidden shadow-2xl flex flex-col max-h-[92vh]">
        
        {/* Modal Header */}
        <div className="bg-slate-950 px-6 py-4 border-b border-slate-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-emerald-500 p-0.5 shadow-lg shadow-indigo-500/20">
              <div className="w-full h-full bg-slate-950 rounded-[10px] flex items-center justify-center text-indigo-400">
                <Sparkles className="w-5 h-5 text-emerald-400 animate-pulse" />
              </div>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-black text-white tracking-wide">Algoritma Optimal Route Planning</h3>
                <span className="px-2 py-0.5 bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 text-[10px] font-bold rounded-md uppercase tracking-wider">
                  AI Recommendation Engine
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Saran otomatis komposisi driver & helper paling efisien berdasarkan histori rute tercepat dan keseimbangan beban kerja.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-xl bg-slate-900 border border-slate-800 hover:bg-slate-800 flex items-center justify-center text-slate-400 hover:text-white transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Applied Toast Alert */}
        {appliedSuccessMsg && (
          <div className="bg-emerald-500/20 border-b border-emerald-500/40 text-emerald-300 px-6 py-2.5 text-xs font-bold flex items-center gap-2 animate-fadeIn">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span>{appliedSuccessMsg}</span>
          </div>
        )}

        {/* Modal Main Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 text-xs">
          
          {/* Top Control Panel / Parameters Grid */}
          <div className="bg-slate-950 border border-slate-800/80 rounded-2xl p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
              <div className="flex items-center gap-2">
                <Sliders className="w-4 h-4 text-indigo-400" />
                <span className="font-bold text-white uppercase text-xs tracking-wider">Parameter Rute & Matriks Prioritas Optimasi</span>
              </div>
              <span className="text-[11px] text-slate-400">
                Memproses <strong className="text-white">{crews.length} Kru</strong> & <strong className="text-white">{fleets.length} Armada</strong>
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              
              {/* 1. Target Store / Route Destination */}
              <div>
                <label className="text-slate-400 font-bold block mb-1.5 flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Destinasi Toko / Rute</span>
                </label>
                <select
                  value={selectedStoreId}
                  onChange={(e) => setSelectedStoreId(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-white font-medium focus:outline-none focus:border-indigo-500 transition text-xs"
                >
                  {stores.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.storeName} ({s.city}, {s.island})
                    </option>
                  ))}
                </select>
                {currentStore && (
                  <div className="mt-1 text-[10px] text-slate-400 flex items-center justify-between px-1">
                    <span>Wilayah: {currentStore.province}</span>
                    <span className="text-indigo-400 font-mono">{currentStore.storeCategory}</span>
                  </div>
                )}
              </div>

              {/* 2. Cargo Weight Input */}
              <div>
                <label className="text-slate-400 font-bold block mb-1.5 flex items-center gap-1.5">
                  <Truck className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Estimasi Beban Muatan (Ton)</span>
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="range"
                    min="1"
                    max="25"
                    step="0.5"
                    value={cargoWeightTon}
                    onChange={(e) => setCargoWeightTon(parseFloat(e.target.value))}
                    className="w-full accent-indigo-500 h-2 bg-slate-900 rounded-lg cursor-pointer"
                  />
                  <span className="px-2.5 py-1 bg-slate-900 border border-slate-800 text-white font-mono font-bold rounded-lg text-xs min-w-[55px] text-center">
                    {cargoWeightTon} Ton
                  </span>
                </div>
                <div className="mt-1 text-[10px] text-slate-400 flex items-center justify-between px-1">
                  <span>Minimum: 1.0 Ton</span>
                  <span>Maksimum: 25.0 Ton</span>
                </div>
              </div>

              {/* 3. Priority Selection */}
              <div>
                <label className="text-slate-400 font-bold block mb-1.5 flex items-center gap-1.5">
                  <Zap className="w-3.5 h-3.5 text-amber-400" />
                  <span>Prioritas Bobot Algoritma</span>
                </label>
                <div className="grid grid-cols-2 gap-1.5">
                  <button
                    onClick={() => setPriority('fastest_time')}
                    className={`px-2.5 py-1.5 rounded-xl border text-[11px] font-bold text-left transition cursor-pointer flex items-center gap-1.5 ${
                      priority === 'fastest_time'
                        ? 'bg-amber-500/20 border-amber-500/50 text-amber-300 shadow'
                        : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <Clock className="w-3.5 h-3.5 shrink-0 text-amber-400" />
                    <span className="truncate">Rute Tercepat</span>
                  </button>

                  <button
                    onClick={() => setPriority('balanced_workload')}
                    className={`px-2.5 py-1.5 rounded-xl border text-[11px] font-bold text-left transition cursor-pointer flex items-center gap-1.5 ${
                      priority === 'balanced_workload'
                        ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-300 shadow'
                        : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <Activity className="w-3.5 h-3.5 shrink-0 text-emerald-400" />
                    <span className="truncate">Beban Kerja Seimbang</span>
                  </button>

                  <button
                    onClick={() => setPriority('route_experience')}
                    className={`px-2.5 py-1.5 rounded-xl border text-[11px] font-bold text-left transition cursor-pointer flex items-center gap-1.5 ${
                      priority === 'route_experience'
                        ? 'bg-indigo-500/20 border-indigo-500/50 text-indigo-300 shadow'
                        : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <Award className="w-3.5 h-3.5 shrink-0 text-indigo-400" />
                    <span className="truncate">Pengalaman Rute</span>
                  </button>

                  <button
                    onClick={() => setPriority('fuel_cost_efficient')}
                    className={`px-2.5 py-1.5 rounded-xl border text-[11px] font-bold text-left transition cursor-pointer flex items-center gap-1.5 ${
                      priority === 'fuel_cost_efficient'
                        ? 'bg-blue-500/20 border-blue-500/50 text-blue-300 shadow'
                        : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <Fuel className="w-3.5 h-3.5 shrink-0 text-blue-400" />
                    <span className="truncate">Hemat Cost & BBM</span>
                  </button>
                </div>
              </div>

            </div>
          </div>

          {/* Main Top Recommendation Display Card */}
          {isCalculating ? (
            <div className="bg-slate-950 border border-slate-800 rounded-2xl p-12 text-center text-slate-400 space-y-3">
              <Compass className="w-8 h-8 text-indigo-400 animate-spin mx-auto" />
              <p className="font-bold text-white text-sm">Menghitung Matriks Komposisi Optimal...</p>
              <p className="text-xs text-slate-500">Menganalisis riwayat kecepatan rute, masa istirahat kru, dan kapasitas armada</p>
            </div>
          ) : topCandidate ? (
            <div className="bg-gradient-to-b from-slate-900 to-slate-950 border border-emerald-500/40 rounded-2xl p-6 shadow-xl relative overflow-hidden space-y-5">
              
              <div className="absolute top-0 right-0 w-80 h-80 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none" />

              {/* Card Header & Score Pill */}
              <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-800/80 pb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-1 bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[10px] font-bold rounded-lg uppercase tracking-wider flex items-center gap-1">
                      <Sparkles className="w-3 h-3 text-emerald-400" />
                      Rekomendasi Utama Algoritma #1
                    </span>
                    <span className="text-slate-400 text-xs">Destinasi: <strong className="text-white">{currentStore.storeName}</strong></span>
                  </div>
                  <h4 className="text-lg font-black text-white mt-1">
                    Kombinasi Kru {topCandidate.driver.name} {topCandidate.helper ? `& ${topCandidate.helper.name}` : ''}
                  </h4>
                </div>

                {/* Score Big Badge */}
                <div className="flex items-center gap-3 bg-slate-950/80 border border-slate-800 p-3 rounded-2xl">
                  <div className="text-right">
                    <div className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Skor Efisiensi Total</div>
                    <div className="text-2xl font-black text-emerald-400 font-mono tracking-tight">{topCandidate.overallScore}%</div>
                  </div>
                  <div className="w-12 h-12 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 font-black text-lg">
                    <ThumbsUp className="w-6 h-6" />
                  </div>
                </div>
              </div>

              {/* Composition Breakdown Cards Grid */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                
                {/* Driver Info */}
                <div className="bg-slate-950/80 border border-slate-800 p-3.5 rounded-xl space-y-1.5">
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                    <Users className="w-3.5 h-3.5 text-indigo-400" />
                    <span>Driver Utama Penanggung Jawab</span>
                  </div>
                  <div className="font-bold text-white text-sm">{topCandidate.driver.name}</div>
                  <div className="text-slate-400 text-[11px] flex items-center gap-2">
                    <span>{topCandidate.driver.licenseType}</span>
                    <span>•</span>
                    <span className="text-amber-400 font-bold">★ {topCandidate.driver.rating.toFixed(1)}</span>
                  </div>
                  <div className="pt-1 flex flex-wrap gap-1">
                    {(topCandidate.driver.certifications || ['SIM B2 Umum']).slice(0, 2).map((cert, idx) => (
                      <span key={idx} className="px-1.5 py-0.5 bg-slate-900 border border-slate-800 text-slate-300 rounded text-[9px]">
                        ✓ {cert}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Helper Info */}
                <div className="bg-slate-950/80 border border-slate-800 p-3.5 rounded-xl space-y-1.5">
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                    <Users className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Helper / Kernet Pendamping</span>
                  </div>
                  <div className="font-bold text-white text-sm">
                    {topCandidate.helper ? topCandidate.helper.name : 'Tanpa Helper (Muatan Ringan)'}
                  </div>
                  {topCandidate.helper ? (
                    <>
                      <div className="text-slate-400 text-[11px] flex items-center gap-2">
                        <span>{topCandidate.helper.role}</span>
                        <span>•</span>
                        <span className="text-amber-400 font-bold">★ {topCandidate.helper.rating.toFixed(1)}</span>
                      </div>
                      <div className="pt-1 flex flex-wrap gap-1">
                        {(topCandidate.helper.certifications || ['K3 Logistik']).slice(0, 2).map((cert, idx) => (
                          <span key={idx} className="px-1.5 py-0.5 bg-slate-900 border border-slate-800 text-slate-300 rounded text-[9px]">
                            ✓ {cert}
                          </span>
                        ))}
                      </div>
                    </>
                  ) : (
                    <div className="text-slate-500 text-[11px]">Beban muatan {cargoWeightTon} Ton aman ditangani single crew.</div>
                  )}
                </div>

                {/* Fleet Info */}
                <div className="bg-slate-950/80 border border-slate-800 p-3.5 rounded-xl space-y-1.5">
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                    <Truck className="w-3.5 h-3.5 text-blue-400" />
                    <span>Armada Kendaraan Terpilih</span>
                  </div>
                  <div className="font-bold text-white text-sm font-mono">{topCandidate.fleet.plateNumber}</div>
                  <div className="text-slate-400 text-[11px] flex items-center gap-2">
                    <span>{topCandidate.fleet.vehicleType}</span>
                    <span>•</span>
                    <span className="text-emerald-400 font-bold">Kap: {topCandidate.fleet.tonnageCapacity || 12} Ton</span>
                  </div>
                  <div className="pt-1 text-[10px] text-slate-400">
                    Utilisasi Kapasitas: <strong className="text-white">{Math.round((cargoWeightTon / (topCandidate.fleet.tonnageCapacity || 12)) * 100)}%</strong>
                  </div>
                </div>

              </div>

              {/* Historical Performance & Estimated Metrics */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-950/90 border border-slate-800/80 p-3.5 rounded-xl text-center">
                <div>
                  <div className="text-[10px] text-slate-400 font-bold">Rata-Rata Waktu Historis</div>
                  <div className="text-white font-mono font-bold text-sm mt-0.5 flex items-center justify-center gap-1">
                    <Clock className="w-3.5 h-3.5 text-amber-400" />
                    <span>{topCandidate.historicalAvgTimeHours} Jam</span>
                  </div>
                  <div className="text-[9px] text-slate-500 mt-0.5">32% Lebih Cepat dari Standar</div>
                </div>

                <div>
                  <div className="text-[10px] text-slate-400 font-bold">Tingkat Ketepatan Waktu</div>
                  <div className="text-emerald-400 font-mono font-bold text-sm mt-0.5 flex items-center justify-center gap-1">
                    <Award className="w-3.5 h-3.5" />
                    <span>{topCandidate.historicalOnTimeRate}%</span>
                  </div>
                  <div className="text-[9px] text-slate-500 mt-0.5">{topCandidate.historicalTripCountOnRoute} Trip Sukses di Rute Ini</div>
                </div>

                <div>
                  <div className="text-[10px] text-slate-400 font-bold">Indeks Kelelahan Kru</div>
                  <div className="text-emerald-300 font-bold text-xs mt-1 flex items-center justify-center gap-1">
                    <Activity className="w-3.5 h-3.5 text-emerald-400" />
                    <span>{topCandidate.fatigueStatus}</span>
                  </div>
                  <div className="text-[9px] text-slate-500 mt-0.5">{topCandidate.recentWorkloadTrips7Days} Trip dalam 7 Hari Terakhir</div>
                </div>

                <div>
                  <div className="text-[10px] text-slate-400 font-bold">Estimasi Operasional & BBM</div>
                  <div className="text-indigo-300 font-mono font-bold text-xs mt-1 flex items-center justify-center gap-1">
                    <Fuel className="w-3.5 h-3.5 text-indigo-400" />
                    <span>~{topCandidate.estimatedFuelLiters} L (Rp {(topCandidate.estimatedCostRp / 1000).toFixed(0)}rb)</span>
                  </div>
                  <div className="text-[9px] text-slate-500 mt-0.5">Banyuwangi Hub → Destinasi</div>
                </div>
              </div>

              {/* Rationale Bullet Points */}
              <div className="space-y-2 bg-slate-950/60 border border-slate-800/60 p-4 rounded-xl">
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Justifikasi Rasional Algoritma Optimasi:</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-slate-300 text-xs">
                  {topCandidate.rationaleList.map((rat, idx) => (
                    <div key={idx} className="flex items-start gap-2 bg-slate-900/80 p-2 rounded-lg border border-slate-800/80">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                      <span>{rat}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Apply Button */}
              <div className="flex items-center justify-between pt-2">
                <div className="flex items-center gap-2">
                  {topCandidate.badges.map((badge, idx) => (
                    <span key={idx} className="px-2.5 py-0.5 bg-indigo-500/10 border border-indigo-500/30 text-indigo-300 text-[10px] font-bold rounded-md">
                      ★ {badge}
                    </span>
                  ))}
                </div>

                <button
                  onClick={() => handleApply(topCandidate)}
                  className="flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-emerald-600 to-indigo-600 hover:from-emerald-500 hover:to-indigo-500 text-white font-bold rounded-xl shadow-lg transition cursor-pointer text-xs"
                >
                  <Sparkles className="w-4 h-4 text-emerald-300 animate-bounce" />
                  <span>Terapkan Komposisi Ini ke Penugasan</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>

            </div>
          ) : (
            <div className="bg-slate-950 border border-slate-800 rounded-2xl p-12 text-center text-slate-500">
              <AlertCircle className="w-8 h-8 text-amber-400 mx-auto mb-2" />
              <p className="font-bold text-white">Tidak ada kombinasi kru yang memenuhi kriteria minimum.</p>
            </div>
          )}

          {/* Ranking Matrix of Alternative Candidates */}
          {candidates.length > 1 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-indigo-400" />
                  <h4 className="font-bold text-white text-xs uppercase tracking-wider">
                    Matriks Perbandingan Kombinasi Kru Alternatif ({candidates.length} Hasil Opsi)
                  </h4>
                </div>
                <span className="text-[11px] text-slate-400">Klik baris untuk meninjau atau memilih skenario</span>
              </div>

              <div className="bg-slate-950 border border-slate-800 rounded-2xl overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-900 border-b border-slate-800 text-[10px] text-slate-400 uppercase font-bold tracking-wider">
                      <tr>
                        <th className="px-4 py-3">Peringkat & Skor</th>
                        <th className="px-4 py-3">Driver Utama</th>
                        <th className="px-4 py-3">Helper</th>
                        <th className="px-4 py-3">Armada</th>
                        <th className="px-4 py-3">Rute Exp (%)</th>
                        <th className="px-4 py-3">Indeks Beban Kerja</th>
                        <th className="px-4 py-3">Estimasi Waktu</th>
                        <th className="px-4 py-3 text-right">Aksi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      {candidates.map((cand, idx) => (
                        <tr 
                          key={cand.id} 
                          onClick={() => setSelectedIndex(idx)}
                          className={`hover:bg-slate-900/80 transition cursor-pointer ${
                            selectedIndex === idx ? 'bg-indigo-950/40 border-l-2 border-indigo-500' : ''
                          }`}
                        >
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <span className={`w-6 h-6 rounded-full flex items-center justify-center font-bold text-[10px] ${
                                idx === 0 ? 'bg-amber-500 text-slate-950 font-black' : 'bg-slate-800 text-slate-300'
                              }`}>
                                #{idx + 1}
                              </span>
                              <span className="font-mono font-bold text-emerald-400 text-sm">{cand.overallScore}%</span>
                            </div>
                          </td>

                          <td className="px-4 py-3">
                            <div className="font-bold text-white">{cand.driver.name}</div>
                            <div className="text-[10px] text-slate-400">★ {cand.driver.rating.toFixed(1)} • {cand.driver.licenseType}</div>
                          </td>

                          <td className="px-4 py-3">
                            <div className="text-slate-200 font-medium">{cand.helper ? cand.helper.name : '-'}</div>
                            <div className="text-[10px] text-slate-500">{cand.helper ? `★ ${cand.helper.rating.toFixed(1)}` : 'Single Driver'}</div>
                          </td>

                          <td className="px-4 py-3">
                            <div className="font-mono font-bold text-blue-400">{cand.fleet.plateNumber}</div>
                            <div className="text-[10px] text-slate-400">{cand.fleet.vehicleType}</div>
                          </td>

                          <td className="px-4 py-3">
                            <div className="w-16 bg-slate-900 rounded-full h-2 overflow-hidden border border-slate-800">
                              <div className="bg-indigo-500 h-full" style={{ width: `${cand.routeExperienceScore}%` }} />
                            </div>
                            <span className="text-[10px] text-slate-400 mt-0.5 font-mono">{cand.routeExperienceScore}%</span>
                          </td>

                          <td className="px-4 py-3">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              cand.fatigueStatus.includes('Aman') ? 'bg-emerald-500/20 text-emerald-300' :
                              cand.fatigueStatus.includes('Normal') ? 'bg-blue-500/20 text-blue-300' :
                              'bg-amber-500/20 text-amber-300'
                            }`}>
                              {cand.fatigueStatus}
                            </span>
                          </td>

                          <td className="px-4 py-3 font-mono text-slate-200">
                            {cand.historicalAvgTimeHours} Jam
                          </td>

                          <td className="px-4 py-3 text-right">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleApply(cand);
                              }}
                              className="px-3 py-1.5 bg-slate-800 hover:bg-emerald-600 text-slate-200 hover:text-white font-bold rounded-lg transition cursor-pointer text-[11px]"
                            >
                              Pilih Ini
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

        </div>

        {/* Modal Footer */}
        <div className="bg-slate-950 px-6 py-4 border-t border-slate-800 flex items-center justify-between shrink-0 text-xs">
          <div className="text-slate-400 flex items-center gap-2">
            <Compass className="w-4 h-4 text-indigo-400" />
            <span>Optimal Route Planning v2.4 • Algoritma otomatis logistik terintegrasi data real-time</span>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold transition cursor-pointer"
            >
              Tutup
            </button>
            {topCandidate && (
              <button
                onClick={() => handleApply(topCandidate)}
                className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold shadow transition cursor-pointer"
              >
                Terapkan Rekomendasi (#1)
              </button>
            )}
          </div>
        </div>

      </div>
    </div>
  );
};
