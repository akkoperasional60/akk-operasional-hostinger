import React, { useState, useMemo, useEffect } from 'react';
import {
  Calendar,
  AlertTriangle,
  CheckCircle2,
  Clock,
  ShieldAlert,
  FileText,
  Truck,
  Filter,
  Search,
  Bell,
  RefreshCw,
  ArrowRight,
  ExternalLink
} from 'lucide-react';
import { logisticsStore } from '../services/store';
import { Fleet, TaxKirReminderItem, TaxKirType, TaxKirUrgency } from '../types';
import { useToast } from '../context/ToastContext';

interface FleetTaxMonitoringPanelProps {
  onNavigateToFleets?: () => void;
}

export const FleetTaxMonitoringPanel: React.FC<FleetTaxMonitoringPanelProps> = ({
  onNavigateToFleets
}) => {
  const [fleets, setFleets] = useState<Fleet[]>(() => logisticsStore.getFleets());
  const [filterType, setFilterType] = useState<string>('all'); // 'all' | 'tax' | 'stnk' | 'kir'
  const [filterUrgency, setFilterUrgency] = useState<string>('all'); // 'all' | 'expired' | 'critical' | 'warning' | 'safe'
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedFleetForUpdate, setSelectedFleetForUpdate] = useState<Fleet | null>(null);
  const [updateFieldType, setUpdateFieldType] = useState<TaxKirType>('tax');
  const [newDateValue, setNewDateValue] = useState<string>('');
  const { addNotification } = useToast();

  useEffect(() => {
    return logisticsStore.subscribe(() => {
      setFleets(logisticsStore.getFleets());
    });
  }, []);

  // Compute all reminder items across fleets (Tax, STNK, KIR)
  const reminderItems: TaxKirReminderItem[] = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const items: TaxKirReminderItem[] = [];

    fleets.forEach(fleet => {
      const datesToCheck: { type: TaxKirType; label: string; dateStr?: string; interval: string }[] = [
        { type: 'tax', label: 'Pajak Kendaraan (Tahunan)', dateStr: fleet.taxDueDate, interval: '1 Tahun' },
        { type: 'stnk', label: 'STNK & Plat Nomor (5 Tahunan)', dateStr: fleet.stnkExpiryDate, interval: '5 Tahun' },
        { type: 'kir', label: 'Uji KIR Dishub (Berkala)', dateStr: fleet.kirExpiryDate, interval: '6 Bulan' }
      ];

      datesToCheck.forEach(check => {
        if (!check.dateStr) return;
        const due = new Date(check.dateStr + 'T00:00:00');
        const diffTime = due.getTime() - today.getTime();
        const daysRemaining = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        let urgency: TaxKirUrgency = 'safe';
        let statusLabel = 'Aman';
        let badgeColor = 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30';

        if (daysRemaining < 0) {
          urgency = 'expired';
          statusLabel = `Kadaluarsa (${Math.abs(daysRemaining)} hr lalu)`;
          badgeColor = 'bg-rose-500/20 text-rose-400 border-rose-500/40 animate-pulse';
        } else if (daysRemaining <= 7) {
          urgency = 'critical';
          statusLabel = `Kritis (${daysRemaining} hari lagi)`;
          badgeColor = 'bg-rose-500/15 text-rose-300 border-rose-500/30';
        } else if (daysRemaining <= 30) {
          urgency = 'warning';
          statusLabel = `Segera Habis (${daysRemaining} hr lagi)`;
          badgeColor = 'bg-amber-500/15 text-amber-300 border-amber-500/30';
        } else {
          urgency = 'safe';
          statusLabel = `Aman (${daysRemaining} hari lagi)`;
          badgeColor = 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
        }

        items.push({
          id: `${fleet.id}-${check.type}`,
          fleetId: fleet.id,
          plateNumber: fleet.plateNumber,
          initialCode: fleet.initialCode,
          vehicleType: fleet.vehicleType,
          brand: fleet.brand,
          type: check.type,
          typeLabel: check.label,
          dueDate: check.dateStr,
          daysRemaining,
          urgency,
          statusLabel,
          badgeColor,
          cycleIntervalLabel: check.interval
        });
      });
    });

    // Sort by daysRemaining ascending (most urgent first)
    return items.sort((a, b) => a.daysRemaining - b.daysRemaining);
  }, [fleets]);

  // Trigger automated notifications for items <= 30 days remaining or expired
  useEffect(() => {
    const urgentItems = reminderItems.filter(item => item.daysRemaining <= 30);
    urgentItems.forEach(item => {
      if (item.daysRemaining < 0) {
        addNotification(
          'tax_kir_reminder',
          `KADALUARSA: ${item.typeLabel} ${item.plateNumber}`,
          `Masa berlaku ${item.typeLabel} truk ${item.initialCode || item.plateNumber} telah lewat ${Math.abs(item.daysRemaining)} hari! Segera lakukan pengurusan.`,
          true
        );
      } else if (item.daysRemaining <= 7) {
        addNotification(
          'tax_kir_reminder',
          `KRITIS: ${item.typeLabel} ${item.plateNumber}`,
          `Masa berlaku ${item.typeLabel} truk ${item.initialCode || item.plateNumber} habis dalam ${item.daysRemaining} hari (${item.dueDate}).`,
          true
        );
      } else if (item.daysRemaining <= 30) {
        addNotification(
          'tax_kir_reminder',
          `REMINDER 30 HARI: ${item.typeLabel} ${item.plateNumber}`,
          `Masa berlaku ${item.typeLabel} truk ${item.initialCode || item.plateNumber} akan habis dalam ${item.daysRemaining} hari (${item.dueDate}).`,
          false
        );
      }
    });
  }, []);

  // Filtered list
  const filteredItems = useMemo(() => {
    return reminderItems.filter(item => {
      const matchType = filterType === 'all' || item.type === filterType;
      const matchUrgency = filterUrgency === 'all' || item.urgency === filterUrgency;
      const q = searchQuery.toLowerCase();
      const matchQuery = !q ||
        item.plateNumber.toLowerCase().includes(q) ||
        (item.initialCode && item.initialCode.toLowerCase().includes(q)) ||
        item.vehicleType.toLowerCase().includes(q);

      return matchType && matchUrgency && matchQuery;
    });
  }, [reminderItems, filterType, filterUrgency, searchQuery]);

  // Summary counts
  const summaryCounts = useMemo(() => {
    let expired = 0;
    let critical = 0;
    let warning = 0;
    let safe = 0;

    reminderItems.forEach(i => {
      if (i.urgency === 'expired') expired++;
      else if (i.urgency === 'critical') critical++;
      else if (i.urgency === 'warning') warning++;
      else safe++;
    });

    return { expired, critical, warning, safe, total: reminderItems.length };
  }, [reminderItems]);

  const handleOpenUpdateModal = (item: TaxKirReminderItem) => {
    const fleet = fleets.find(f => f.id === item.fleetId);
    if (!fleet) return;
    setSelectedFleetForUpdate(fleet);
    setUpdateFieldType(item.type);
    if (item.type === 'tax') setNewDateValue(fleet.taxDueDate || '');
    else if (item.type === 'stnk') setNewDateValue(fleet.stnkExpiryDate || '');
    else setNewDateValue(fleet.kirExpiryDate || '');
  };

  const handleSaveDateUpdate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFleetForUpdate || !newDateValue) return;

    const updatedFleet: Fleet = { ...selectedFleetForUpdate };
    if (updateFieldType === 'tax') updatedFleet.taxDueDate = newDateValue;
    else if (updateFieldType === 'stnk') updatedFleet.stnkExpiryDate = newDateValue;
    else if (updateFieldType === 'kir') updatedFleet.kirExpiryDate = newDateValue;

    logisticsStore.updateFleet(selectedFleetForUpdate.id, updatedFleet);
    setSelectedFleetForUpdate(null);
    addNotification(
      'tax_kir_reminder',
      'Pembaruan Masa Berlaku Berhasil',
      `Tanggal ${updateFieldType === 'tax' ? 'Pajak' : updateFieldType === 'stnk' ? 'STNK' : 'KIR'} armada ${updatedFleet.plateNumber} diperbarui ke ${newDateValue}.`,
      false
    );
  };

  return (
    <div className="space-y-6">
      {/* HEADER BANNER */}
      <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl shadow-lg relative overflow-hidden">
        <div className="absolute -right-12 -top-12 w-48 h-48 bg-rose-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <div className="p-2.5 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-400">
                <Bell className="w-6 h-6 animate-pulse" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-black text-white tracking-tight">
                    Pusat Reminder Pajak STNK & Uji KIR Armada
                  </h2>
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30 uppercase">
                    Notifikasi 30 Hari
                  </span>
                </div>
                <p className="text-xs text-slate-400">
                  Pemantauan otomatis masa berlaku Pajak Tahunan, STNK 5 Tahunan, dan Uji KIR Dishub 6 Bulanan untuk seluruh armada PT Anugrah Kemasan Kreatif.
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {onNavigateToFleets && (
              <button
                onClick={onNavigateToFleets}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold transition cursor-pointer"
              >
                <Truck className="w-4 h-4 text-amber-400" />
                <span>Manajemen Data Armada &rarr;</span>
              </button>
            )}
          </div>
        </div>

        {/* 4 URGENCY SUMMARY CARDS */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-5 mt-5 border-t border-slate-800/80">
          <div className={`p-3.5 rounded-xl border ${summaryCounts.expired > 0 ? 'bg-rose-950/40 border-rose-500/40' : 'bg-slate-950/60 border-slate-800'}`}>
            <div className="flex items-center justify-between text-xs mb-1">
              <span className="font-semibold text-rose-400">Sudah Kadaluarsa</span>
              <ShieldAlert className="w-4 h-4 text-rose-500" />
            </div>
            <div className="text-2xl font-black text-rose-400 font-mono">{summaryCounts.expired} <span className="text-xs font-normal text-slate-400">Item</span></div>
            <div className="text-[10px] text-rose-300 mt-1">Perlu tindakan darurat segera</div>
          </div>

          <div className={`p-3.5 rounded-xl border ${summaryCounts.critical > 0 ? 'bg-amber-950/40 border-amber-500/40' : 'bg-slate-950/60 border-slate-800'}`}>
            <div className="flex items-center justify-between text-xs mb-1">
              <span className="font-semibold text-amber-400">Kritis (&le; 7 Hari)</span>
              <AlertTriangle className="w-4 h-4 text-amber-400" />
            </div>
            <div className="text-2xl font-black text-amber-400 font-mono">{summaryCounts.critical} <span className="text-xs font-normal text-slate-400">Item</span></div>
            <div className="text-[10px] text-amber-300 mt-1">Mendekati batas akhir</div>
          </div>

          <div className="bg-slate-950/60 p-3.5 rounded-xl border border-slate-800">
            <div className="flex items-center justify-between text-xs mb-1">
              <span className="font-semibold text-blue-300">Warning (8 - 30 Hari)</span>
              <Clock className="w-4 h-4 text-blue-400" />
            </div>
            <div className="text-2xl font-black text-blue-400 font-mono">{summaryCounts.warning} <span className="text-xs font-normal text-slate-400">Item</span></div>
            <div className="text-[10px] text-blue-300 mt-1">Jendela reminder 30 hari</div>
          </div>

          <div className="bg-slate-950/60 p-3.5 rounded-xl border border-slate-800">
            <div className="flex items-center justify-between text-xs mb-1">
              <span className="font-semibold text-emerald-300">Aman (&gt; 30 Hari)</span>
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="text-2xl font-black text-emerald-400 font-mono">{summaryCounts.safe} <span className="text-xs font-normal text-slate-400">Item</span></div>
            <div className="text-[10px] text-emerald-300 mt-1">Masa berlaku masih panjang</div>
          </div>
        </div>
      </div>

      {/* FILTER & SEARCH CONTROLS */}
      <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2.5 w-full sm:w-auto">
          {/* Type Filter */}
          <div className="flex items-center bg-slate-950 border border-slate-800 rounded-xl p-1">
            <button
              onClick={() => setFilterType('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${filterType === 'all' ? 'bg-amber-500 text-slate-950 font-bold' : 'text-slate-400 hover:text-white'}`}
            >
              Semua Jenis
            </button>
            <button
              onClick={() => setFilterType('tax')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${filterType === 'tax' ? 'bg-amber-500 text-slate-950 font-bold' : 'text-slate-400 hover:text-white'}`}
            >
              Pajak Tahunan
            </button>
            <button
              onClick={() => setFilterType('stnk')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${filterType === 'stnk' ? 'bg-amber-500 text-slate-950 font-bold' : 'text-slate-400 hover:text-white'}`}
            >
              STNK 5 Thn
            </button>
            <button
              onClick={() => setFilterType('kir')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${filterType === 'kir' ? 'bg-amber-500 text-slate-950 font-bold' : 'text-slate-400 hover:text-white'}`}
            >
              Uji KIR
            </button>
          </div>

          {/* Urgency Filter */}
          <select
            value={filterUrgency}
            onChange={(e) => setFilterUrgency(e.target.value)}
            className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500 cursor-pointer"
          >
            <option value="all">Semua Status Urgency</option>
            <option value="expired">🚨 Sudah Kadaluarsa</option>
            <option value="critical">⚠️ Kritis (&le; 7 Hari)</option>
            <option value="warning">🔔 Warning (8 - 30 Hari)</option>
            <option value="safe">✅ Aman (&gt; 30 Hari)</option>
          </select>
        </div>

        {/* Search input */}
        <div className="relative w-full sm:w-64">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Cari plat nomor / inisial truk..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-8 pr-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
          />
        </div>
      </div>

      {/* REMINDERS TABLE */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <FileText className="w-4 h-4 text-amber-400" />
            <span>Daftar Masa Berlaku Pajak STNK & KIR Armada ({filteredItems.length} Item)</span>
          </h3>
          <span className="text-xs text-slate-400 font-medium">
            Notifikasi aktif untuk batas waktu &le; 30 hari
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-950 text-[11px] uppercase tracking-wider text-slate-400 font-bold border-b border-slate-800">
              <tr>
                <th className="py-3 px-4">No</th>
                <th className="py-3 px-4">Armada & Plat Nomor</th>
                <th className="py-3 px-4">Tipe Dokumen</th>
                <th className="py-3 px-4">Siklus / Interval</th>
                <th className="py-3 px-4">Tanggal Jatuh Tempo</th>
                <th className="py-3 px-4">Sisa Waktu</th>
                <th className="py-3 px-4">Status Urgency</th>
                <th className="py-3 px-4 text-right">Aksi / Perpanjang</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-mono">
              {filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-500 font-sans">
                    Tidak ada data dokumen pajak atau KIR yang sesuai dengan filter.
                  </td>
                </tr>
              ) : (
                filteredItems.map((item, idx) => (
                  <tr key={item.id} className="hover:bg-slate-800/40 transition">
                    <td className="py-3 px-4 text-slate-400 font-sans">{idx + 1}</td>
                    <td className="py-3 px-4 font-sans">
                      <div className="font-bold text-white flex items-center gap-1.5">
                        <Truck className="w-3.5 h-3.5 text-blue-400" />
                        <span>{item.plateNumber} {item.initialCode ? `(${item.initialCode})` : ''}</span>
                      </div>
                      <div className="text-[10px] text-slate-400 flex items-center gap-1 mt-0.5">
                        {item.initialCode && <span className="text-amber-400 font-bold">{item.initialCode}</span>}
                        <span>&bull;</span>
                        <span>{item.vehicleType}</span>
                      </div>
                    </td>
                    <td className="py-3 px-4 font-sans">
                      <span className="font-semibold text-white">{item.typeLabel}</span>
                    </td>
                    <td className="py-3 px-4 text-slate-400 text-[11px]">{item.cycleIntervalLabel}</td>
                    <td className="py-3 px-4 font-bold text-white">{item.dueDate}</td>
                    <td className="py-3 px-4">
                      <span className={`font-bold ${item.daysRemaining < 0 ? 'text-rose-400 font-black animate-pulse' : item.daysRemaining <= 7 ? 'text-amber-400 font-bold' : 'text-slate-300'}`}>
                        {item.daysRemaining < 0 ? `${Math.abs(item.daysRemaining)} hr lalu` : `${item.daysRemaining} hari lagi`}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-sans">
                      <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold border block text-center ${item.badgeColor}`}>
                        {item.statusLabel}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right font-sans">
                      <button
                        onClick={() => handleOpenUpdateModal(item)}
                        className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-amber-400 hover:text-amber-300 border border-slate-700 font-semibold text-xs transition cursor-pointer inline-flex items-center gap-1"
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                        <span>Update Tanggal</span>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* UPDATE DATE MODAL */}
      {selectedFleetForUpdate && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-950">
              <div className="flex items-center gap-2">
                <Calendar className="w-5 h-5 text-amber-400" />
                <h3 className="font-bold text-white text-sm">
                  Perpanjang / Update Masa Berlaku {updateFieldType === 'tax' ? 'Pajak Tahunan' : updateFieldType === 'stnk' ? 'STNK 5 Thn' : 'Uji KIR'}
                </h3>
              </div>
              <button
                onClick={() => setSelectedFleetForUpdate(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleSaveDateUpdate} className="p-5 space-y-4 text-xs">
              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
                <div className="text-slate-400">Armada Truk:</div>
                <div className="text-sm font-bold text-white">{selectedFleetForUpdate.plateNumber} ({selectedFleetForUpdate.initialCode || selectedFleetForUpdate.vehicleType})</div>
                <div className="text-[11px] text-slate-400">Jenis Dokumen: <span className="text-amber-400 font-semibold uppercase">{updateFieldType === 'tax' ? 'Pajak Kendaraan Tahunan' : updateFieldType === 'stnk' ? 'STNK & Plat Nomor (5 Thn)' : 'Uji KIR Dishub (6 Bln)'}</span></div>
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">
                  Tanggal Jatuh Tempo Baru <span className="text-rose-400">*</span>
                </label>
                <input
                  type="date"
                  value={newDateValue}
                  onChange={(e) => setNewDateValue(e.target.value)}
                  required
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:border-amber-500 font-mono"
                />
                <p className="text-[10px] text-slate-500 mt-1">
                  Setelah diperbarui, sistem akan menghitung ulang sisa hari dan memperbarui status notifikasi reminder 30 hari.
                </p>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedFleetForUpdate(null)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold transition cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold transition cursor-pointer"
                >
                  Simpan Perubahan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
