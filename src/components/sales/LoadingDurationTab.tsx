import React, { useState } from 'react';
import {
  Clock,
  Plus,
  Truck,
  CheckCircle2,
  AlertTriangle,
  Timer
} from 'lucide-react';
import {
  SalesHeaderFilter,
  SalesTopTab
} from './SalesHeaderFilter';

interface LoadingDurationTabProps {
  onNavigateSubTab?: (sub: 'dashboard' | 'activities' | 'schedules' | 'loading_duration' | 'skill_matrix' | 'jobdesk') => void;
  adminOptions: string[];
}

export interface LoadingFleetRecord {
  id: string;
  fleetName: string;
  routeRegion: string;
  loadingTimeRange: string;
  durationLabel: string;
  durationMinutes: number;
  statusSla: 'Sesuai SLA' | 'Over SLA';
  delayNotes?: string;
}

const INITIAL_LOADING_FLEETS: LoadingFleetRecord[] = [
  {
    id: 'f1',
    fleetName: 'Tronton Argo 01',
    routeRegion: 'Denpasar 1',
    loadingTimeRange: '08:00 - 09:45',
    durationLabel: '1 jam 45 mnt',
    durationMinutes: 105,
    statusSla: 'Sesuai SLA'
  },
  {
    id: 'f2',
    fleetName: 'Engkel Ritel 04',
    routeRegion: 'Kalibaru',
    loadingTimeRange: '09:00 - 11:30',
    durationLabel: '2 jam 30 mnt',
    durationMinutes: 150,
    statusSla: 'Over SLA',
    delayNotes: 'Antrian fork lift pallet kemasan'
  },
  {
    id: 'f3',
    fleetName: 'Box Jember 02',
    routeRegion: 'Jember Kota',
    loadingTimeRange: '10:15 - 11:45',
    durationLabel: '1 jam 30 mnt',
    durationMinutes: 90,
    statusSla: 'Sesuai SLA'
  }
];

export const LoadingDurationTab: React.FC<LoadingDurationTabProps> = ({
  onNavigateSubTab
}) => {
  const [selectedAdmin, setSelectedAdmin] = useState('SEMUA ADMIN');
  const [selectedMonth, setSelectedMonth] = useState('Agustus');
  const [selectedYear, setSelectedYear] = useState('2026');

  const [fleetRecords, setFleetRecords] = useState<LoadingFleetRecord[]>(() => {
    const saved = localStorage.getItem('akk_loading_fleets_v1');
    return saved ? JSON.parse(saved) : INITIAL_LOADING_FLEETS;
  });

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newFleetName, setNewFleetName] = useState('');
  const [newRoute, setNewRoute] = useState('');
  const [newStartTime, setNewStartTime] = useState('08:00');
  const [newEndTime, setNewEndTime] = useState('09:30');
  const [newSlaTarget, setNewSlaTarget] = useState(120); // 2 hours target
  const [newNotes, setNewNotes] = useState('');

  const handleTopTabChange = (tab: SalesTopTab) => {
    if (tab === 'checklist' || tab === 'aktivitas_view') {
      onNavigateSubTab?.('activities');
    } else if (tab === 'jadwal_admin') {
      onNavigateSubTab?.('schedules');
    }
  };

  const handleAddFleet = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFleetName || !newRoute) return;

    const [h1, m1] = newStartTime.split(':').map(Number);
    const [h2, m2] = newEndTime.split(':').map(Number);
    let diffMinutes = (h2 * 60 + m2) - (h1 * 60 + m1);
    if (diffMinutes < 0) diffMinutes += 24 * 60;

    const hours = Math.floor(diffMinutes / 60);
    const mins = diffMinutes % 60;
    const durationLabel = hours > 0 ? `${hours} jam ${mins} mnt` : `${mins} mnt`;
    const statusSla: LoadingFleetRecord['statusSla'] =
      diffMinutes <= newSlaTarget ? 'Sesuai SLA' : 'Over SLA';

    const newRecord: LoadingFleetRecord = {
      id: 'f-' + Math.random().toString(36).substring(2, 7),
      fleetName: newFleetName,
      routeRegion: newRoute,
      loadingTimeRange: `${newStartTime} - ${newEndTime}`,
      durationLabel,
      durationMinutes: diffMinutes,
      statusSla,
      delayNotes: newNotes
    };

    const updated = [newRecord, ...fleetRecords];
    setFleetRecords(updated);
    localStorage.setItem('akk_loading_fleets_v1', JSON.stringify(updated));
    setIsAddModalOpen(false);
    setNewFleetName('');
    setNewRoute('');
    setNewNotes('');
  };

  return (
    <div className="space-y-6">
      {/* Header & Unified Filter matching Screenshot 3 */}
      <SalesHeaderFilter
        title="Pemantauan Operasional & Aktivitas Admin"
        subtitle="Kelola dan pantau aktivitas harian, durasi muat, serta jadwal kerja admin dalam satu halaman terpadu."
        activeTab="durasi_muat"
        onTabChange={handleTopTabChange}
        selectedAdmin={selectedAdmin}
        onAdminChange={setSelectedAdmin}
        selectedMonth={selectedMonth}
        onMonthChange={setSelectedMonth}
        selectedYear={selectedYear}
        onYearChange={setSelectedYear}
        jadwalInputCount={0}
        pencapaianPercent={0}
        periodeLabel={`${selectedMonth.slice(0, 3)} ${selectedYear}`}
      />

      {/* Main Card: Pemantauan Durasi Muat (SLA) matching Screenshot 3 */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-amber-50 text-amber-600 flex items-center justify-center">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">
                Pemantauan Durasi Muat (SLA)
              </h2>
              <p className="text-xs text-slate-400">
                Estimasi dan realisasi muat armada penjualan
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto">
            <span className="text-xs font-bold text-amber-800 bg-amber-100 px-3 py-1 rounded-full border border-amber-200">
              {fleetRecords.length} Armada Logistik
            </span>
            <button
              onClick={() => setIsAddModalOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1 bg-emerald-700 hover:bg-emerald-600 text-white rounded-lg text-xs font-semibold shadow-xs transition cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Input Muat</span>
            </button>
          </div>
        </div>

        {/* Table matching Screenshot 3 */}
        <div className="overflow-x-auto mt-2">
          <table className="w-full text-xs text-left">
            <thead>
              <tr className="border-b border-slate-100 text-slate-400 uppercase text-[10px] tracking-wider font-semibold">
                <th className="py-3 px-3">ARMADA / TRUK</th>
                <th className="py-3 px-3">RUTE WILAYAH</th>
                <th className="py-3 px-3">JAM MUAT</th>
                <th className="py-3 px-3">DURASI</th>
                <th className="py-3 px-3">STATUS SLA</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {fleetRecords.map(item => (
                <tr key={item.id} className="hover:bg-slate-50/70 transition">
                  <td className="py-3.5 px-3">
                    <span className="font-bold text-slate-900 block text-xs">
                      {item.fleetName}
                    </span>
                    {item.delayNotes && (
                      <span className="text-[11px] text-rose-500 block mt-0.5">
                        {item.delayNotes}
                      </span>
                    )}
                  </td>
                  <td className="py-3.5 px-3 text-slate-700 font-medium">
                    {item.routeRegion}
                  </td>
                  <td className="py-3.5 px-3 text-slate-600 font-medium">
                    {item.loadingTimeRange}
                  </td>
                  <td className="py-3.5 px-3 font-extrabold text-slate-900">
                    {item.durationLabel}
                  </td>
                  <td className="py-3.5 px-3">
                    <span
                      className={`inline-block px-3 py-1 rounded-full font-bold text-[11px] ${
                        item.statusSla === 'Sesuai SLA'
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-rose-100 text-rose-800'
                      }`}
                    >
                      {item.statusSla}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Input Muat */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-200">
            <h3 className="text-base font-bold text-slate-900 mb-4">Input Sesi Muat Armada Baru</h3>
            <form onSubmit={handleAddFleet} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-slate-600 font-semibold mb-1">Armada / Truk</label>
                <input
                  type="text"
                  required
                  placeholder="cth. Tronton Argo 02 atau Engkel Ritel 05"
                  value={newFleetName}
                  onChange={e => setNewFleetName(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl"
                />
              </div>

              <div>
                <label className="block text-slate-600 font-semibold mb-1">Rute Wilayah</label>
                <input
                  type="text"
                  required
                  placeholder="cth. Denpasar 2, Genteng, Rogojampi"
                  value={newRoute}
                  onChange={e => setNewRoute(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-slate-600 font-semibold mb-1">Jam Mulai Muat</label>
                  <input
                    type="time"
                    value={newStartTime}
                    onChange={e => setNewStartTime(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl"
                  />
                </div>
                <div>
                  <label className="block text-slate-600 font-semibold mb-1">Jam Selesai Muat</label>
                  <input
                    type="time"
                    value={newEndTime}
                    onChange={e => setNewEndTime(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-600 font-semibold mb-1">Target SLA Maksimal (Menit)</label>
                <input
                  type="number"
                  value={newSlaTarget}
                  onChange={e => setNewSlaTarget(Number(e.target.value))}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl"
                />
              </div>

              <div>
                <label className="block text-slate-600 font-semibold mb-1">Catatan Hambatan (Bila ada)</label>
                <input
                  type="text"
                  placeholder="Alasan keterlambatan muat..."
                  value={newNotes}
                  onChange={e => setNewNotes(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-xl font-medium"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-emerald-700 hover:bg-emerald-600 text-white rounded-xl font-bold shadow-xs"
                >
                  Simpan Sesi Muat
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
