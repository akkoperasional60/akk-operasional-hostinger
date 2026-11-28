import React, { useState, useMemo } from 'react';
import {
  Download,
  Printer,
  Calendar,
  Search,
  X,
  FileSpreadsheet,
  ChevronDown,
  AlertTriangle
} from 'lucide-react';
import { FuelLog } from '../types';
import {
  computeWeeklyFleetSummaries,
  exportFuelReportToExcel,
  exportFuelReportToPDF,
  formatRupiah
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
  const [selectedWeek, setSelectedWeek] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [filterFleet] = useState<string>('all');
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [exportError, setExportError] = useState<string>('');

  const allFleetSummaries = useMemo(() => computeWeeklyFleetSummaries(fuelLogs), [fuelLogs]);

  const availableWeeks = useMemo(() => {
    const map = new Map<string, string>();
    allFleetSummaries.forEach(f => {
      if (!map.has(f.weekKey)) {
        map.set(f.weekKey, f.weekLabel);
      }
    });
    return Array.from(map.entries()).map(([key, label]) => ({ key, label }));
  }, [allFleetSummaries]);

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

  const activeMetrics = useMemo(() => {
    const totalLiters = Number(filteredFleetSummaries.reduce((sum, f) => sum + f.totalLiters, 0).toFixed(2));
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

    return {
      totalLiters,
      totalCost,
      totalDistance,
      totalRefuels,
      avgKmPerLiter,
      avgLiterPerKm,
      avgCostPerKm
    };
  }, [filteredFleetSummaries]);

  const selectedWeekLabel = useMemo(() => {
    if (selectedWeek === 'all') return 'Seluruh Minggu Terdata';
    const found = availableWeeks.find(w => w.key === selectedWeek);
    return found ? found.label : selectedWeek;
  }, [selectedWeek, availableWeeks]);

  const handleExportPDF = () => {
    setIsExporting(true);
    setExportError('');
    try {
      exportFuelReportToPDF({
        fleetSummaries: filteredFleetSummaries,
        driverSummaries: [],
        filterWeekKey: selectedWeek === 'all' ? undefined : selectedWeek,
        filterWeekLabel: selectedWeekLabel,
        printedBy: 'Super Admin Logistik PT AKK'
      });
    } catch (err) {
      console.error('Failed to export PDF:', err);
      setExportError('Gagal mengekspor PDF. Pastikan data terisi dengan benar.');
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportExcel = () => {
    setIsExporting(true);
    setExportError('');
    try {
      const matchingLogs = selectedWeek === 'all'
        ? fuelLogs
        : fuelLogs.filter(l => {
            const bounds = allFleetSummaries.find(f => f.weekKey === selectedWeek);
            if (!bounds) return true;
            return l.date >= bounds.startDate && l.date <= bounds.endDate;
          });

      exportFuelReportToExcel({
        fleetSummaries: filteredFleetSummaries,
        driverSummaries: [],
        detailedLogs: matchingLogs,
        filterWeekKey: selectedWeek === 'all' ? undefined : selectedWeek,
        filterWeekLabel: selectedWeekLabel
      });
    } catch (err) {
      console.error('Failed to export Excel:', err);
      setExportError('Gagal mengekspor Excel. Periksa kembali data periode yang dipilih.');
    } finally {
      setIsExporting(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  if (!isOpen) return null;

  return (
    <div className="akk-flat-fuel fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-3 sm:p-5 overflow-y-auto">
      <div className="bg-white border border-slate-200 rounded-xl w-full max-w-6xl max-h-[92vh] flex flex-col overflow-hidden">
        {/* MODAL HEADER */}
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between bg-white sticky top-0 z-20">
          <div>
            <h2 className="text-lg font-bold text-slate-900">
              Export Laporan Konsumsi BBM Mingguan
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Rekapitulasi performa BBM per armada PT AKK siap unduh dalam format PDF dan Excel.
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition cursor-pointer"
            title="Tutup"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* CONTROLS & SUMMARY */}
        <div className="p-5 border-b border-slate-200 bg-slate-50/70 space-y-4">
          {exportError && (
            <div className="px-3.5 py-2.5 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs font-medium flex items-center justify-between">
              <span className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                {exportError}
              </span>
              <button type="button" onClick={() => setExportError('')} className="text-red-500 hover:text-red-700 cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-3">
            <div className="flex flex-wrap items-end gap-3">
              <div className="min-w-[240px]">
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Periode Minggu
                </label>
                <div className="relative">
                  <Calendar className="w-4 h-4 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
                  <select
                    value={selectedWeek}
                    onChange={(e) => setSelectedWeek(e.target.value)}
                    className="w-full pl-9 pr-8 py-2 rounded-lg bg-white border border-slate-200 text-sm text-slate-800 focus:outline-none focus:border-blue-600 cursor-pointer appearance-none"
                  >
                    <option value="all">Semua Periode Minggu ({availableWeeks.length} Minggu)</option>
                    {availableWeeks.map(w => (
                      <option key={w.key} value={w.key}>
                        {w.label}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="w-4 h-4 text-slate-400 absolute right-2.5 top-2.5 pointer-events-none" />
                </div>
              </div>

              <div className="w-56">
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Cari Armada / Driver
                </label>
                <div className="relative">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
                  <input
                    type="text"
                    placeholder="Plat nomor atau driver..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 rounded-lg bg-white border border-slate-200 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-600"
                  />
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={handleExportPDF}
                disabled={isExporting}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-semibold text-xs transition cursor-pointer disabled:opacity-50 whitespace-nowrap"
              >
                <Download className="w-4 h-4 text-slate-500" />
                <span>Export PDF</span>
              </button>

              <button
                type="button"
                onClick={handleExportExcel}
                disabled={isExporting}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs transition cursor-pointer disabled:opacity-50 whitespace-nowrap"
              >
                <FileSpreadsheet className="w-4 h-4" />
                <span>Export Excel</span>
              </button>

              <button
                type="button"
                onClick={handlePrint}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold transition cursor-pointer whitespace-nowrap"
              >
                <Printer className="w-4 h-4 text-slate-500" />
                <span>Print</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            <div className="bg-white p-3 rounded-lg border border-slate-200">
              <span className="text-xs text-slate-500 block">Total BBM</span>
              <span className="text-lg font-bold text-slate-900 font-mono tabular-nums">{activeMetrics.totalLiters.toLocaleString('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} L</span>
              <span className="text-xs text-slate-500 block">{activeMetrics.totalRefuels}x isi</span>
            </div>

            <div className="bg-white p-3 rounded-lg border border-slate-200">
              <span className="text-xs text-slate-500 block">Total Biaya</span>
              <span className="text-lg font-bold text-slate-900 font-mono tabular-nums">{formatRupiah(activeMetrics.totalCost)}</span>
              <span className="text-xs text-slate-500 block">Rp {activeMetrics.avgCostPerKm.toLocaleString('id-ID')}/KM</span>
            </div>

            <div className="bg-white p-3 rounded-lg border border-slate-200">
              <span className="text-xs text-slate-500 block">Jarak Tempuh</span>
              <span className="text-lg font-bold text-blue-600 font-mono tabular-nums">{activeMetrics.totalDistance.toLocaleString('id-ID')} KM</span>
              <span className="text-xs text-slate-500 block">Akumulasi armada</span>
            </div>

            <div className="bg-white p-3 rounded-lg border border-slate-200">
              <span className="text-xs text-slate-500 block">Rasio Armada</span>
              <span className="text-lg font-bold text-slate-900 font-mono tabular-nums">{activeMetrics.avgKmPerLiter} KM/L</span>
              <span className="text-xs text-slate-500 block">Target: 7.5 KM/L</span>
            </div>

            <div className="bg-white p-3 rounded-lg border border-slate-200">
              <span className="text-xs text-slate-500 block">Liter / KM</span>
              <span className="text-lg font-bold text-slate-900 font-mono tabular-nums">{activeMetrics.avgLiterPerKm}</span>
              <span className="text-xs text-slate-500 block">{(activeMetrics.avgLiterPerKm * 100).toFixed(2)} L/100KM</span>
            </div>
          </div>
        </div>

        {/* TABLE BODY */}
        <div className="p-5 flex-1 overflow-y-auto space-y-3">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>Rekapitulasi Per Armada ({filteredFleetSummaries.length} baris)</span>
            <span className="font-semibold text-slate-800">{selectedWeekLabel}</span>
          </div>

          <div className="overflow-x-auto border border-slate-200 rounded-xl">
            <table className="w-full text-left text-sm text-slate-700">
              <thead className="bg-slate-50 text-xs font-semibold text-slate-500 border-b border-slate-200 whitespace-nowrap">
                <tr>
                  <th className="py-3 px-3">No</th>
                  <th className="py-3 px-3">Periode Minggu</th>
                  <th className="py-3 px-3">Armada &amp; Plat</th>
                  <th className="py-3 px-3">Tipe Truk</th>
                  <th className="py-3 px-3 text-right">Rit</th>
                  <th className="py-3 px-3 text-right">Total Liter</th>
                  <th className="py-3 px-3 text-right">Jarak (KM)</th>
                  <th className="py-3 px-3 text-right">Biaya BBM</th>
                  <th className="py-3 px-3 text-right">KM/L</th>
                  <th className="py-3 px-3 text-right">L/KM</th>
                  <th className="py-3 px-3 text-right">Target</th>
                  <th className="py-3 px-3 text-center">Status</th>
                  <th className="py-3 px-3">Driver</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredFleetSummaries.length === 0 ? (
                  <tr>
                    <td colSpan={13} className="py-10 text-center text-slate-500 text-sm">
                      Tidak ada data ringkasan armada untuk filter ini.
                    </td>
                  </tr>
                ) : (
                  filteredFleetSummaries.map((f, i) => (
                    <tr key={f.id} className="hover:bg-slate-50/80 transition">
                      <td className="py-2.5 px-3 text-slate-400 text-xs tabular-nums">{i + 1}</td>
                      <td className="py-2.5 px-3 text-slate-600 text-xs whitespace-nowrap">{f.weekLabel}</td>
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        <div className="font-semibold text-slate-900">{f.initialCode || f.plateNumber}</div>
                        <div className="text-xs text-slate-500 font-mono">{f.plateNumber}</div>
                      </td>
                      <td className="py-2.5 px-3 text-slate-600 text-xs whitespace-nowrap">{f.vehicleType}</td>
                      <td className="py-2.5 px-3 text-right font-mono tabular-nums">{f.refuelCount}x</td>
                      <td className="py-2.5 px-3 text-right font-mono tabular-nums font-semibold text-slate-900">{Number(f.totalLiters || 0).toFixed(2)} L</td>
                      <td className="py-2.5 px-3 text-right font-mono tabular-nums font-semibold text-blue-600">{f.totalDistanceKm.toLocaleString('id-ID')}</td>
                      <td className="py-2.5 px-3 text-right font-mono tabular-nums font-semibold text-slate-900">{formatRupiah(f.totalCost)}</td>
                      <td className="py-2.5 px-3 text-right font-mono tabular-nums font-bold text-slate-900">{f.avgKmPerLiter}</td>
                      <td className="py-2.5 px-3 text-right font-mono tabular-nums text-xs text-slate-600">{f.avgLiterPerKm}</td>
                      <td className="py-2.5 px-3 text-right font-mono tabular-nums text-xs text-slate-500">{f.targetRatio}</td>
                      <td className="py-2.5 px-3 text-center whitespace-nowrap">
                        <span className={`px-2 py-0.5 rounded-md text-xs font-semibold border inline-block ${
                          f.status === 'Sangat Efisien'
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : f.status === 'Efisien / Normal'
                            ? 'bg-blue-50 text-blue-700 border-blue-200'
                            : f.status === 'Boros'
                            ? 'bg-amber-50 text-amber-700 border-amber-200'
                            : 'bg-red-50 text-red-700 border-red-200'
                        }`}>
                          {f.status}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-slate-600 text-xs max-w-[180px] truncate" title={f.driverNames.join(', ')}>
                        {f.driverNames.join(', ') || '-'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* FOOTER */}
        <div className="px-5 py-3.5 border-t border-slate-200 bg-slate-50 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500">
          <span>Format PDF menyertakan kop resmi PT AKK dan kolom tanda tangan operasional.</span>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleExportPDF}
              className="px-3.5 py-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 font-semibold text-xs transition cursor-pointer"
            >
              Download PDF
            </button>
            <button
              type="button"
              onClick={handleExportExcel}
              className="px-3.5 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs transition cursor-pointer"
            >
              Download Excel
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-2 rounded-lg bg-slate-200 hover:bg-slate-300 text-slate-800 text-xs font-semibold transition cursor-pointer"
            >
              Tutup
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
