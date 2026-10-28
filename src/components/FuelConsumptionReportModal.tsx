import React, { useState, useMemo } from 'react';
import {
  FileText,
  Download,
  Printer,
  Calendar,
  Truck,
  User,
  Fuel,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  DollarSign,
  Gauge,
  Activity,
  Layers,
  Award,
  Filter,
  Search,
  X,
  FileSpreadsheet,
  ChevronDown
} from 'lucide-react';
import { FuelLog } from '../types';
import {
  computeWeeklyFleetSummaries,
  computeWeeklyDriverSummaries,
  exportFuelReportToExcel,
  exportFuelReportToPDF,
  formatRupiah,
  WeeklyFleetFuelSummary,
  WeeklyDriverFuelSummary
} from '../utils/fuelReportGenerator';

interface FuelConsumptionReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  fuelLogs: FuelLog[];
}

export const FuelConsumptionReportModal: React.FC<FuelConsumptionReportModalProps> = ({
  isOpen,
  onClose,
  fuelLogs
}) => {
  const [reportTab, setReportTab] = useState<'fleet' | 'driver' | 'both'>('fleet');
  const [selectedWeek, setSelectedWeek] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [filterFleet, setFilterFleet] = useState<string>('all');
  const [isExporting, setIsExporting] = useState<boolean>(false);

  // Compute all weekly summaries
  const allFleetSummaries = useMemo(() => computeWeeklyFleetSummaries(fuelLogs), [fuelLogs]);
  const allDriverSummaries = useMemo(() => computeWeeklyDriverSummaries(fuelLogs), [fuelLogs]);

  // Extract distinct weeks for filter dropdown
  const availableWeeks = useMemo(() => {
    const map = new Map<string, string>();
    allFleetSummaries.forEach(f => {
      if (!map.has(f.weekKey)) {
        map.set(f.weekKey, f.weekLabel);
      }
    });
    return Array.from(map.entries()).map(([key, label]) => ({ key, label }));
  }, [allFleetSummaries]);

  // Filtered summaries based on user selection
  const filteredFleetSummaries = useMemo(() => {
    return allFleetSummaries.filter(f => {
      const matchWeek = selectedWeek === 'all' || f.weekKey === selectedWeek;
      const matchFleet = filterFleet === 'all' || f.fleetId === filterFleet || f.plateNumber === filterFleet;
      const q = searchQuery.toLowerCase();
      const matchQuery = !q ||
        f.plateNumber.toLowerCase().includes(q) ||
        f.initialCode.toLowerCase().includes(q) ||
        f.vehicleType.toLowerCase().includes(q) ||
        f.driverNames.some(d => d.toLowerCase().includes(q));

      return matchWeek && matchFleet && matchQuery;
    });
  }, [allFleetSummaries, selectedWeek, filterFleet, searchQuery]);

  const filteredDriverSummaries = useMemo(() => {
    return allDriverSummaries.filter(d => {
      const matchWeek = selectedWeek === 'all' || d.weekKey === selectedWeek;
      const q = searchQuery.toLowerCase();
      const matchQuery = !q ||
        d.driverName.toLowerCase().includes(q) ||
        d.fleetPlates.some(p => p.toLowerCase().includes(q)) ||
        d.predicate.toLowerCase().includes(q);

      return matchWeek && matchQuery;
    });
  }, [allDriverSummaries, selectedWeek, searchQuery]);

  // Aggregate Metrics for Active Filter
  const activeMetrics = useMemo(() => {
    const totalLiters = Number(filteredFleetSummaries.reduce((sum, f) => sum + f.totalLiters, 0).toFixed(1));
    const totalCost = filteredFleetSummaries.reduce((sum, f) => sum + f.totalCost, 0);
    const totalDistance = filteredFleetSummaries.reduce((sum, f) => sum + f.totalDistanceKm, 0);
    const totalRefuels = filteredFleetSummaries.reduce((sum, f) => sum + f.refuelCount, 0);
    const avgKmPerLiter = totalLiters > 0 && totalDistance > 0
      ? Number((totalDistance / totalLiters).toFixed(2))
      : 0;
    const avgLiterPerKm = totalDistance > 0
      ? Number((totalLiters / totalDistance).toFixed(4))
      : 0;
    const avgCostPerKm = totalDistance > 0 ? Math.round(totalCost / totalDistance) : 0;

    // Best fleet & Best driver
    const bestFleet = [...filteredFleetSummaries].sort((a, b) => b.avgKmPerLiter - a.avgKmPerLiter)[0];
    const bestDriver = [...filteredDriverSummaries].sort((a, b) => b.ecoScore - a.ecoScore)[0];

    return {
      totalLiters,
      totalCost,
      totalDistance,
      totalRefuels,
      avgKmPerLiter,
      avgLiterPerKm,
      avgCostPerKm,
      bestFleet,
      bestDriver
    };
  }, [filteredFleetSummaries, filteredDriverSummaries]);

  const selectedWeekLabel = useMemo(() => {
    if (selectedWeek === 'all') return 'Seluruh Minggu Terdata';
    const found = availableWeeks.find(w => w.key === selectedWeek);
    return found ? found.label : selectedWeek;
  }, [selectedWeek, availableWeeks]);

  // Export handlers
  const handleExportPDF = () => {
    setIsExporting(true);
    try {
      exportFuelReportToPDF({
        fleetSummaries: filteredFleetSummaries,
        driverSummaries: filteredDriverSummaries,
        filterWeekKey: selectedWeek === 'all' ? undefined : selectedWeek,
        filterWeekLabel: selectedWeekLabel,
        printedBy: 'Super Admin Logistik PT AKK'
      });
    } catch (err) {
      console.error('Failed to export PDF:', err);
      alert('Gagal mengekspor PDF. Pastikan data terisi dengan benar.');
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportExcel = () => {
    setIsExporting(true);
    try {
      // Find matching detailed logs if specific week is selected
      const matchingLogs = selectedWeek === 'all'
        ? fuelLogs
        : fuelLogs.filter(l => {
            const bounds = allFleetSummaries.find(f => f.weekKey === selectedWeek);
            if (!bounds) return true;
            return l.date >= bounds.startDate && l.date <= bounds.endDate;
          });

      exportFuelReportToExcel({
        fleetSummaries: filteredFleetSummaries,
        driverSummaries: filteredDriverSummaries,
        detailedLogs: matchingLogs,
        filterWeekKey: selectedWeek === 'all' ? undefined : selectedWeek,
        filterWeekLabel: selectedWeekLabel
      });
    } catch (err) {
      console.error('Failed to export Excel:', err);
      alert('Gagal mengekspor Excel.');
    } finally {
      setIsExporting(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-5 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-6xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {/* MODAL HEADER */}
        <div className="p-4 sm:p-5 border-b border-slate-800/80 flex items-center justify-between bg-slate-900/90 sticky top-0 z-20">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-gradient-to-br from-amber-500/20 to-emerald-500/20 border border-amber-500/30 text-amber-400">
              <FileSpreadsheet className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold text-white">
                  Export Laporan Konsumsi BBM Mingguan
                </h2>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 font-mono">
                  PDF & Excel
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Otomasi rekapitulasi performa konsumsi bahan bakar armada dan skor eco-driving driver per minggu PT AKK
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition cursor-pointer"
              title="Tutup"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* MODAL CONTROLS & EXPORT ACTIONS */}
        <div className="p-4 sm:p-5 border-b border-slate-800 bg-slate-950/50 space-y-4">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
            
            {/* Filter Bar */}
            <div className="flex flex-wrap items-center gap-2.5">
              {/* Select Week Dropdown */}
              <div className="relative min-w-[240px]">
                <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">
                  PILIH PERIODE MINGGU
                </label>
                <div className="relative">
                  <Calendar className="w-4 h-4 text-amber-400 absolute left-3 top-2.5 pointer-events-none" />
                  <select
                    value={selectedWeek}
                    onChange={(e) => setSelectedWeek(e.target.value)}
                    className="w-full pl-9 pr-8 py-2 rounded-xl bg-slate-900 border border-slate-800 text-xs text-white focus:outline-none focus:border-amber-500 cursor-pointer appearance-none"
                  >
                    <option value="all">Semua Periode Minggu ({availableWeeks.length} Minggu)</option>
                    {availableWeeks.map(w => (
                      <option key={w.key} value={w.key}>
                        {w.label}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3 top-2.5 pointer-events-none" />
                </div>
              </div>

              {/* Search query */}
              <div className="relative w-48 sm:w-56">
                <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">
                  CARI ARMADA / DRIVER
                </label>
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    placeholder="Ketik plat atau supir..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-8 pr-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>
            </div>

            {/* Export Buttons */}
            <div className="flex items-center gap-2.5 self-end lg:self-center pt-2 lg:pt-0">
              <button
                onClick={handleExportPDF}
                disabled={isExporting}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs shadow-md transition active:scale-95 cursor-pointer disabled:opacity-50"
                title="Unduh berkas PDF siap cetak dengan tanda tangan"
              >
                <Download className="w-4 h-4" />
                <span>Export PDF (.pdf)</span>
              </button>

              <button
                onClick={handleExportExcel}
                disabled={isExporting}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-md transition active:scale-95 cursor-pointer disabled:opacity-50"
                title="Unduh berkas Excel Multi-Sheet (.xlsx)"
              >
                <FileSpreadsheet className="w-4 h-4" />
                <span>Export Excel (.xlsx)</span>
              </button>

              <button
                onClick={handlePrint}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 text-xs font-semibold transition cursor-pointer"
                title="Cetak langsung menggunakan printer dialog"
              >
                <Printer className="w-4 h-4 text-slate-400" />
                <span className="hidden sm:inline">Print</span>
              </button>
            </div>
          </div>

          {/* ACTIVE METRICS ROW */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 pt-2">
            <div className="bg-slate-900/90 p-2.5 rounded-xl border border-slate-800">
              <span className="text-[10px] text-slate-400 block font-semibold">Total BBM Terdata</span>
              <span className="text-base font-black text-white font-mono">{activeMetrics.totalLiters.toLocaleString('id-ID')} L</span>
              <span className="text-[10px] text-slate-500 block">{activeMetrics.totalRefuels} kali isi</span>
            </div>

            <div className="bg-slate-900/90 p-2.5 rounded-xl border border-slate-800">
              <span className="text-[10px] text-slate-400 block font-semibold">Total Biaya BBM</span>
              <span className="text-base font-black text-emerald-400 font-mono">{formatRupiah(activeMetrics.totalCost)}</span>
              <span className="text-[10px] text-slate-500 block">Rp {activeMetrics.avgCostPerKm.toLocaleString('id-ID')}/KM</span>
            </div>

            <div className="bg-slate-900/90 p-2.5 rounded-xl border border-slate-800">
              <span className="text-[10px] text-slate-400 block font-semibold">Jarak Tempuh</span>
              <span className="text-base font-black text-cyan-400 font-mono">{activeMetrics.totalDistance.toLocaleString('id-ID')} KM</span>
              <span className="text-[10px] text-slate-500 block">Akumulasi mingguan</span>
            </div>

            <div className="bg-slate-900/90 p-2.5 rounded-xl border border-slate-800">
              <span className="text-[10px] text-slate-400 block font-semibold">Rasio Armada (KM/L)</span>
              <span className="text-base font-black text-amber-400 font-mono">{activeMetrics.avgKmPerLiter} KM/L</span>
              <span className="text-[10px] text-slate-500 block">Target: 7.5 KM/L</span>
            </div>

            <div className="bg-slate-900/90 p-2.5 rounded-xl border border-slate-800">
              <span className="text-[10px] text-slate-400 block font-semibold">Konsumsi Liter/KM</span>
              <span className="text-base font-black text-white font-mono">{activeMetrics.avgLiterPerKm}</span>
              <span className="text-[10px] text-slate-500 block">{(activeMetrics.avgLiterPerKm * 100).toFixed(2)} L/100KM</span>
            </div>

            <div className="bg-slate-900/90 p-2.5 rounded-xl border border-slate-800">
              <span className="text-[10px] text-slate-400 block font-semibold">Driver Terhemat</span>
              <span className="text-xs font-bold text-emerald-300 truncate block mt-0.5" title={activeMetrics.bestDriver?.driverName}>
                {activeMetrics.bestDriver?.driverName || '-'}
              </span>
              <span className="text-[10px] text-emerald-400 block">
                {activeMetrics.bestDriver ? `${activeMetrics.bestDriver.avgKmPerLiter} KM/L (Skor ${activeMetrics.bestDriver.ecoScore})` : '-'}
              </span>
            </div>
          </div>
        </div>

        {/* SUB-TABS: FLEET vs DRIVER */}
        <div className="px-5 pt-3 border-b border-slate-800 flex items-center gap-2 bg-slate-900">
          <button
            onClick={() => setReportTab('fleet')}
            className={`flex items-center gap-2 px-4 py-2 rounded-t-lg text-xs font-bold transition cursor-pointer border-b-2 ${
              reportTab === 'fleet'
                ? 'border-amber-500 text-amber-400 bg-amber-500/10'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Truck className="w-3.5 h-3.5" />
            <span>1. Ringkasan Mingguan Per Armada ({filteredFleetSummaries.length})</span>
          </button>

          <button
            onClick={() => setReportTab('driver')}
            className={`flex items-center gap-2 px-4 py-2 rounded-t-lg text-xs font-bold transition cursor-pointer border-b-2 ${
              reportTab === 'driver'
                ? 'border-amber-500 text-amber-400 bg-amber-500/10'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <User className="w-3.5 h-3.5" />
            <span>2. Ringkasan Mingguan Per Driver ({filteredDriverSummaries.length})</span>
          </button>
        </div>

        {/* MODAL BODY TABLE PREVIEW */}
        <div className="p-4 sm:p-5 flex-1 overflow-y-auto">
          {reportTab === 'fleet' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span>Menampilkan rekapitulasi konsumsi BBM per unit truk berdasarkan minggu pengiriman:</span>
                <span className="font-semibold text-amber-400">{selectedWeekLabel}</span>
              </div>

              <div className="overflow-x-auto border border-slate-800 rounded-xl">
                <table className="w-full text-left text-xs text-slate-300">
                  <thead className="bg-slate-950 text-[11px] uppercase tracking-wider text-slate-400 font-bold border-b border-slate-800">
                    <tr>
                      <th className="py-3 px-3">No</th>
                      <th className="py-3 px-3">Periode Minggu</th>
                      <th className="py-3 px-3">Armada & Plat</th>
                      <th className="py-3 px-3">Tipe Truk</th>
                      <th className="py-3 px-3 text-right">Rit</th>
                      <th className="py-3 px-3 text-right">Total Liter</th>
                      <th className="py-3 px-3 text-right">Jarak (KM)</th>
                      <th className="py-3 px-3 text-right">Biaya BBM (Rp)</th>
                      <th className="py-3 px-3 text-right">Rasio (KM/L)</th>
                      <th className="py-3 px-3 text-right">Liter/KM</th>
                      <th className="py-3 px-3 text-right">Target</th>
                      <th className="py-3 px-3">Status Evaluasi</th>
                      <th className="py-3 px-3">Driver Bertugas</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 font-mono">
                    {filteredFleetSummaries.length === 0 ? (
                      <tr>
                        <td colSpan={13} className="py-8 text-center text-slate-500 font-sans">
                          Tidak ada data ringkasan armada untuk filter ini.
                        </td>
                      </tr>
                    ) : (
                      filteredFleetSummaries.map((f, i) => (
                        <tr key={f.id} className="hover:bg-slate-800/40 transition">
                          <td className="py-2.5 px-3 text-slate-400 font-sans">{i + 1}</td>
                          <td className="py-2.5 px-3 font-sans text-slate-300 text-[11px] whitespace-nowrap">
                            {f.weekLabel}
                          </td>
                          <td className="py-2.5 px-3">
                            <div className="font-bold text-white">{f.plateNumber}</div>
                            {f.initialCode && (
                              <span className="text-[10px] text-amber-400 bg-amber-500/10 px-1 rounded font-sans">
                                {f.initialCode}
                              </span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 font-sans text-slate-300 text-[11px]">{f.vehicleType}</td>
                          <td className="py-2.5 px-3 text-right text-slate-200">{f.refuelCount}x</td>
                          <td className="py-2.5 px-3 text-right font-bold text-white">{f.totalLiters} L</td>
                          <td className="py-2.5 px-3 text-right text-cyan-300">{f.totalDistanceKm.toLocaleString('id-ID')}</td>
                          <td className="py-2.5 px-3 text-right text-emerald-400 font-semibold">{formatRupiah(f.totalCost)}</td>
                          <td className="py-2.5 px-3 text-right font-black text-amber-400">{f.avgKmPerLiter}</td>
                          <td className="py-2.5 px-3 text-right text-slate-300 text-[11px]">{f.avgLiterPerKm}</td>
                          <td className="py-2.5 px-3 text-right text-slate-400 text-[11px]">{f.targetRatio}</td>
                          <td className="py-2.5 px-3 font-sans">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold border block text-center truncate ${
                              f.status === 'Sangat Efisien'
                                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                                : f.status === 'Efisien / Normal'
                                ? 'bg-blue-500/10 text-blue-400 border-blue-500/30'
                                : f.status === 'Boros'
                                ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                                : 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                            }`}>
                              {f.status}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 font-sans text-slate-300 text-[11px] max-w-xs truncate" title={f.driverNames.join(', ')}>
                            {f.driverNames.join(', ') || '-'}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {reportTab === 'driver' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span>Menampilkan evaluasi konsumsi BBM per pengemudi (Eco-Driving Score):</span>
                <span className="font-semibold text-amber-400">{selectedWeekLabel}</span>
              </div>

              <div className="overflow-x-auto border border-slate-800 rounded-xl">
                <table className="w-full text-left text-xs text-slate-300">
                  <thead className="bg-slate-950 text-[11px] uppercase tracking-wider text-slate-400 font-bold border-b border-slate-800">
                    <tr>
                      <th className="py-3 px-3">No</th>
                      <th className="py-3 px-3">Periode Minggu</th>
                      <th className="py-3 px-3">Nama Driver / Kru</th>
                      <th className="py-3 px-3">Unit Armada</th>
                      <th className="py-3 px-3 text-right">Rit</th>
                      <th className="py-3 px-3 text-right">Total Liter</th>
                      <th className="py-3 px-3 text-right">Jarak Tempuh (KM)</th>
                      <th className="py-3 px-3 text-right">Total Biaya (Rp)</th>
                      <th className="py-3 px-3 text-right">Rasio (KM/L)</th>
                      <th className="py-3 px-3 text-right">Liter / KM</th>
                      <th className="py-3 px-3 text-center">Skor Eco</th>
                      <th className="py-3 px-3">Predikat Eco</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 font-mono">
                    {filteredDriverSummaries.length === 0 ? (
                      <tr>
                        <td colSpan={12} className="py-8 text-center text-slate-500 font-sans">
                          Tidak ada data ringkasan driver untuk filter ini.
                        </td>
                      </tr>
                    ) : (
                      filteredDriverSummaries.map((d, i) => (
                        <tr key={d.id} className="hover:bg-slate-800/40 transition">
                          <td className="py-2.5 px-3 text-slate-400 font-sans">{i + 1}</td>
                          <td className="py-2.5 px-3 font-sans text-slate-300 text-[11px] whitespace-nowrap">
                            {d.weekLabel}
                          </td>
                          <td className="py-2.5 px-3 font-sans font-bold text-white">
                            <div className="flex items-center gap-1.5">
                              <User className="w-3.5 h-3.5 text-blue-400" />
                              <span>{d.driverName}</span>
                            </div>
                          </td>
                          <td className="py-2.5 px-3 text-slate-300 text-[11px]">{d.fleetPlates.join(', ') || '-'}</td>
                          <td className="py-2.5 px-3 text-right text-slate-200">{d.refuelCount}x</td>
                          <td className="py-2.5 px-3 text-right font-bold text-white">{d.totalLiters} L</td>
                          <td className="py-2.5 px-3 text-right text-cyan-300">{d.totalDistanceKm.toLocaleString('id-ID')}</td>
                          <td className="py-2.5 px-3 text-right text-emerald-400 font-semibold">{formatRupiah(d.totalCost)}</td>
                          <td className="py-2.5 px-3 text-right font-black text-amber-400">{d.avgKmPerLiter}</td>
                          <td className="py-2.5 px-3 text-right text-slate-300 text-[11px]">{d.avgLiterPerKm}</td>
                          <td className="py-2.5 px-3 text-center">
                            <span className="px-2 py-0.5 rounded-full font-bold text-xs bg-slate-800 text-white border border-slate-700">
                              {d.ecoScore}/100
                            </span>
                          </td>
                          <td className="py-2.5 px-3 font-sans">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold border block text-center truncate ${
                              d.predicate === 'Master Eco-Driver'
                                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                                : d.predicate === 'Driver Efisien'
                                ? 'bg-blue-500/10 text-blue-400 border-blue-500/30'
                                : 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                            }`}>
                              {d.predicate}
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* MODAL FOOTER */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/80 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-400">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span>Format PDF menyertakan kop resmi PT AKK dan blok tanda tangan validasi operasional.</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleExportPDF}
              className="px-3.5 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs shadow transition cursor-pointer flex items-center gap-1.5"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download PDF</span>
            </button>
            <button
              onClick={handleExportExcel}
              className="px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow transition cursor-pointer flex items-center gap-1.5"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span>Download Excel</span>
            </button>
            <button
              onClick={onClose}
              className="px-3.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition cursor-pointer"
            >
              Tutup
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
