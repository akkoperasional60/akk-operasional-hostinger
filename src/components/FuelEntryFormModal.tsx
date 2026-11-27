import React from 'react';
import {
  AlertTriangle,
  Calendar,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  X
} from 'lucide-react';
import { Fleet, FuelType } from '../types';

export type FuelModalDropdownType = 'fleet' | 'driver' | 'helper' | 'area' | 'date' | 'fuel' | null;

export interface FuelEntryFormModalProps {
  isOpen: boolean;
  editingLogId: string | null;
  formError: string;
  formBranchId: 'cab-banyuwangi' | 'cab-sidoarjo';
  onBranchChange: (branchId: 'cab-banyuwangi' | 'cab-sidoarjo') => void;
  formFleetId: string;
  selectedFormFleet?: Fleet;
  filteredModalFleets: Fleet[];
  fleetSearchFilter: string;
  onFleetSearchFilterChange: (val: string) => void;
  onSelectFleet: (fleetId: string) => void;
  formDate: string;
  onDateChange: (iso: string) => void;
  calendarViewMonth: Date;
  onCalendarViewMonthChange: (d: Date) => void;
  formDriverName: string;
  filteredDriverOptions: Array<{ id: string; name: string; role: string }>;
  driverSearchFilter: string;
  onDriverSearchFilterChange: (val: string) => void;
  onSelectDriver: (id: string, name: string) => void;
  formHelperName: string;
  filteredHelperOptions: Array<{ id: string; name: string; role: string }>;
  helperSearchFilter: string;
  onHelperSearchFilterChange: (val: string) => void;
  onSelectHelper: (id: string, name: string) => void;
  formFuelType: FuelType;
  fuelTypes: FuelType[];
  onFuelTypeChange: (ft: FuelType) => void;
  formCostPerLiter: string;
  onCostPerLiterChange: (val: string) => void;
  formLiters: string;
  onLitersChange: (val: string) => void;
  formGasStation: string;
  onGasStationChange: (val: string) => void;
  isGasStationDropdownOpen: boolean;
  onGasStationDropdownOpenChange: (open: boolean) => void;
  formStartOdo: string;
  onStartOdoChange: (val: string) => void;
  formEndOdo: string;
  onEndOdoChange: (val: string) => void;
  formRouteTrip: string;
  filteredAreaOptions: string[];
  areaSearchFilter: string;
  onAreaSearchFilterChange: (val: string) => void;
  onSelectArea: (area: string) => void;
  activeModalDropdown: FuelModalDropdownType;
  onActiveModalDropdownChange: (next: FuelModalDropdownType) => void;
  modalDropdownRef: React.RefObject<HTMLDivElement | null>;
  liveFormDistance: number;
  liveFormTotalCost: number;
  liveFormRatio: number;
  liveFormEfficiency: { status: string; tone: string };
  isSavingFuelLog: boolean;
  onClose: () => void;
  onSubmit: (e: React.FormEvent) => void;
}

const MONTHS_FULL_ID = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
];

export const FuelEntryFormModal: React.FC<FuelEntryFormModalProps> = ({
  isOpen,
  editingLogId,
  formError,
  formBranchId,
  onBranchChange,
  formFleetId,
  selectedFormFleet,
  filteredModalFleets,
  fleetSearchFilter,
  onFleetSearchFilterChange,
  onSelectFleet,
  formDate,
  onDateChange,
  calendarViewMonth,
  onCalendarViewMonthChange,
  formDriverName,
  filteredDriverOptions,
  driverSearchFilter,
  onDriverSearchFilterChange,
  onSelectDriver,
  formHelperName,
  filteredHelperOptions,
  helperSearchFilter,
  onHelperSearchFilterChange,
  onSelectHelper,
  formFuelType,
  fuelTypes,
  onFuelTypeChange,
  formCostPerLiter,
  onCostPerLiterChange,
  formLiters,
  onLitersChange,
  formGasStation,
  onGasStationChange,
  isGasStationDropdownOpen,
  onGasStationDropdownOpenChange,
  formStartOdo,
  onStartOdoChange,
  formEndOdo,
  onEndOdoChange,
  formRouteTrip,
  filteredAreaOptions,
  areaSearchFilter,
  onAreaSearchFilterChange,
  onSelectArea,
  activeModalDropdown,
  onActiveModalDropdownChange,
  modalDropdownRef,
  liveFormDistance,
  liveFormTotalCost,
  liveFormRatio,
  liveFormEfficiency,
  isSavingFuelLog,
  onClose,
  onSubmit
}) => {
  if (!isOpen) return null;

  const calYear = calendarViewMonth.getFullYear();
  const calMonthIdx = calendarViewMonth.getMonth();
  const firstDayOffset = new Date(calYear, calMonthIdx, 1).getDay();
  const daysInCalMonth = new Date(calYear, calMonthIdx + 1, 0).getDate();
  const calendarCells: (number | null)[] = [];
  for (let i = 0; i < firstDayOffset; i++) calendarCells.push(null);
  for (let d = 1; d <= daysInCalMonth; d++) calendarCells.push(d);

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-3 sm:p-5 overflow-y-auto">
      <div
        ref={modalDropdownRef}
        className="bg-white border border-slate-200 rounded-xl w-full max-w-2xl max-h-[92vh] overflow-y-auto"
      >
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between sticky top-0 bg-white z-20">
          <div>
            <h2 className="text-lg font-bold text-slate-900">
              {editingLogId ? 'Edit Catatan Pengisian BBM' : 'Catat Pengisian BBM Baru'}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Otomatis menyinkronkan odometer Portal Driver jika tersedia pada tanggal &amp; armada terpilih.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup form BBM"
            className="p-2 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={onSubmit} className="p-5 space-y-4">
          {formError && (
            <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs font-semibold flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{formError}</span>
            </div>
          )}

          {/* Cabang */}
          <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 rounded-lg border border-slate-200">
            {([
              { id: 'cab-banyuwangi', label: 'Cabang Nusantara' },
              { id: 'cab-sidoarjo', label: 'Cabang Sidoarjo' }
            ] as const).map(br => (
              <button
                key={br.id}
                type="button"
                onClick={() => onBranchChange(br.id)}
                className={`py-2 rounded-md text-xs font-semibold transition cursor-pointer ${
                  formBranchId === br.id
                    ? 'bg-white text-blue-600 border border-slate-200'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {br.label}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Armada Truk */}
            <div className="relative">
              <label className="block text-xs font-semibold text-slate-700 mb-1">Armada Truk *</label>
              <button
                type="button"
                onClick={() =>
                  onActiveModalDropdownChange(activeModalDropdown === 'fleet' ? null : 'fleet')
                }
                className="w-full px-3 py-2 rounded-lg bg-white border border-slate-200 text-left text-sm flex items-center justify-between cursor-pointer hover:border-blue-600"
              >
                <span className={selectedFormFleet ? 'text-slate-900 font-medium' : 'text-slate-400'}>
                  {selectedFormFleet
                    ? `${selectedFormFleet.initialCode || selectedFormFleet.plateNumber} (${selectedFormFleet.plateNumber})`
                    : 'Pilih Armada'}
                </span>
                <ChevronDown className="w-4 h-4 text-slate-400" />
              </button>

              {activeModalDropdown === 'fleet' && (
                <div className="absolute left-0 right-0 top-full mt-1 z-30 bg-white border border-slate-200 rounded-lg overflow-hidden">
                  <div className="p-2 border-b border-slate-100">
                    <input
                      type="text"
                      value={fleetSearchFilter}
                      onChange={e => onFleetSearchFilterChange(e.target.value)}
                      placeholder="Cari plat atau kode armada..."
                      className="w-full px-2.5 py-1.5 rounded border border-slate-200 text-xs focus:outline-none focus:border-blue-600"
                    />
                  </div>
                  <div className="max-h-52 overflow-y-auto divide-y divide-slate-100">
                    {filteredModalFleets.map(f => (
                      <button
                        key={f.id}
                        type="button"
                        onClick={() => {
                          onSelectFleet(f.id);
                          onActiveModalDropdownChange(null);
                        }}
                        className={`w-full px-3 py-2 text-left text-xs flex items-center justify-between hover:bg-blue-50 cursor-pointer ${
                          formFleetId === f.id ? 'bg-blue-50 font-semibold text-blue-700' : 'text-slate-800'
                        }`}
                      >
                        <span>
                          {f.initialCode || f.plateNumber} · <span className="font-mono text-slate-500">{f.plateNumber}</span>
                        </span>
                        <span className="text-[11px] text-slate-500">{f.vehicleType}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Tanggal Pengisian */}
            <div className="relative">
              <label className="block text-xs font-semibold text-slate-700 mb-1">Tanggal Pengisian *</label>
              <button
                type="button"
                onClick={() => onActiveModalDropdownChange(activeModalDropdown === 'date' ? null : 'date')}
                className="w-full px-3 py-2 rounded-lg bg-white border border-slate-200 text-left text-sm flex items-center justify-between cursor-pointer hover:border-blue-600"
              >
                <span className="font-mono tabular-nums text-slate-900">{formDate}</span>
                <Calendar className="w-4 h-4 text-slate-400" />
              </button>

              {activeModalDropdown === 'date' && (
                <div className="absolute right-0 top-full mt-1 z-30 w-72 bg-white border border-slate-200 rounded-lg p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <button
                      type="button"
                      onClick={() => onCalendarViewMonthChange(new Date(calYear, calMonthIdx - 1, 1))}
                      className="p-1 rounded border border-slate-200 hover:bg-slate-50 cursor-pointer"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <span className="text-xs font-bold text-slate-900">
                      {MONTHS_FULL_ID[calMonthIdx]} {calYear}
                    </span>
                    <button
                      type="button"
                      onClick={() => onCalendarViewMonthChange(new Date(calYear, calMonthIdx + 1, 1))}
                      className="p-1 rounded border border-slate-200 hover:bg-slate-50 cursor-pointer"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="grid grid-cols-7 gap-1 text-center">
                    {['M', 'S', 'S', 'R', 'K', 'J', 'S'].map((d, i) => (
                      <span key={i} className="text-[10px] font-semibold text-slate-400">{d}</span>
                    ))}
                    {calendarCells.map((day, idx) => {
                      if (day === null) return <div key={`e-${idx}`} />;
                      const iso = `${calYear}-${String(calMonthIdx + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                      return (
                        <button
                          key={iso}
                          type="button"
                          onClick={() => {
                            onDateChange(iso);
                            onActiveModalDropdownChange(null);
                          }}
                          className={`h-7 rounded text-xs font-mono cursor-pointer ${
                            formDate === iso ? 'bg-blue-600 text-white font-bold' : 'hover:bg-slate-100 text-slate-700'
                          }`}
                        >
                          {day}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Driver Bertugas */}
            <div className="relative">
              <label className="block text-xs font-semibold text-slate-700 mb-1">Driver Bertugas *</label>
              <button
                type="button"
                onClick={() => onActiveModalDropdownChange(activeModalDropdown === 'driver' ? null : 'driver')}
                className="w-full px-3 py-2 rounded-lg bg-white border border-slate-200 text-left text-sm flex items-center justify-between cursor-pointer hover:border-blue-600"
              >
                <span className={formDriverName ? 'text-slate-900 font-medium' : 'text-slate-400'}>
                  {formDriverName || 'Pilih Driver'}
                </span>
                <ChevronDown className="w-4 h-4 text-slate-400" />
              </button>

              {activeModalDropdown === 'driver' && (
                <div className="absolute left-0 right-0 top-full mt-1 z-30 bg-white border border-slate-200 rounded-lg overflow-hidden">
                  <div className="p-2 border-b border-slate-100">
                    <input
                      type="text"
                      value={driverSearchFilter}
                      onChange={e => onDriverSearchFilterChange(e.target.value)}
                      placeholder="Cari nama driver..."
                      className="w-full px-2.5 py-1.5 rounded border border-slate-200 text-xs focus:outline-none focus:border-blue-600"
                    />
                  </div>
                  <div className="max-h-48 overflow-y-auto divide-y divide-slate-100">
                    {filteredDriverOptions.map(d => (
                      <button
                        key={d.id}
                        type="button"
                        onClick={() => {
                          onSelectDriver(d.id, d.name);
                          onActiveModalDropdownChange(null);
                        }}
                        className="w-full px-3 py-2 text-left text-xs flex items-center justify-between hover:bg-blue-50 cursor-pointer"
                      >
                        <span className="font-medium text-slate-900">{d.name}</span>
                        <span className="text-[11px] text-slate-500">{d.role}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Helper (Opsional) */}
            <div className="relative">
              <label className="block text-xs font-semibold text-slate-700 mb-1">Helper (Opsional)</label>
              <button
                type="button"
                onClick={() => onActiveModalDropdownChange(activeModalDropdown === 'helper' ? null : 'helper')}
                className="w-full px-3 py-2 rounded-lg bg-white border border-slate-200 text-left text-sm flex items-center justify-between cursor-pointer hover:border-blue-600"
              >
                <span className={formHelperName ? 'text-slate-900 font-medium' : 'text-slate-400'}>
                  {formHelperName || 'Tanpa Helper'}
                </span>
                <ChevronDown className="w-4 h-4 text-slate-400" />
              </button>

              {activeModalDropdown === 'helper' && (
                <div className="absolute left-0 right-0 top-full mt-1 z-30 bg-white border border-slate-200 rounded-lg overflow-hidden">
                  <div className="p-2 border-b border-slate-100">
                    <input
                      type="text"
                      value={helperSearchFilter}
                      onChange={e => onHelperSearchFilterChange(e.target.value)}
                      placeholder="Cari nama helper..."
                      className="w-full px-2.5 py-1.5 rounded border border-slate-200 text-xs focus:outline-none focus:border-blue-600"
                    />
                  </div>
                  <div className="max-h-48 overflow-y-auto divide-y divide-slate-100">
                    <button
                      type="button"
                      onClick={() => {
                        onSelectHelper('', '');
                        onActiveModalDropdownChange(null);
                      }}
                      className="w-full px-3 py-2 text-left text-xs text-slate-500 hover:bg-slate-50 cursor-pointer"
                    >
                      Tanpa Helper
                    </button>
                    {filteredHelperOptions.map(h => (
                      <button
                        key={h.id}
                        type="button"
                        onClick={() => {
                          onSelectHelper(h.id, h.name);
                          onActiveModalDropdownChange(null);
                        }}
                        className="w-full px-3 py-2 text-left text-xs flex items-center justify-between hover:bg-blue-50 cursor-pointer"
                      >
                        <span className="font-medium text-slate-900">{h.name}</span>
                        <span className="text-[11px] text-slate-500">{h.role}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Jenis BBM & Harga per Liter */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Jenis BBM *</label>
              <select
                value={formFuelType}
                onChange={e => onFuelTypeChange(e.target.value as FuelType)}
                className="w-full px-3 py-2 rounded-lg bg-white border border-slate-200 text-sm text-slate-900 focus:outline-none focus:border-blue-600 cursor-pointer"
              >
                {fuelTypes.map(ft => (
                  <option key={ft} value={ft}>{ft}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Harga per Liter (Rp) *</label>
              <input
                type="number"
                min="0"
                value={formCostPerLiter}
                onChange={e => onCostPerLiterChange(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-white border border-slate-200 text-sm font-mono tabular-nums text-slate-900 focus:outline-none focus:border-blue-600"
              />
            </div>

            {/* Volume BBM (2 desimal) & SPBU */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Volume BBM (Liter) *</label>
              <input
                type="number"
                step="0.01"
                min="0"
                placeholder="Contoh: 25.50"
                value={formLiters}
                onChange={e => onLitersChange(e.target.value)}
                onBlur={() => {
                  const n = Number(formLiters);
                  if (formLiters.trim() !== '' && Number.isFinite(n) && n > 0) {
                    onLitersChange(n.toFixed(2));
                  }
                }}
                className="w-full px-3 py-2 rounded-lg bg-white border border-slate-200 text-sm font-mono tabular-nums text-slate-900 focus:outline-none focus:border-blue-600"
              />
            </div>

            <div className="relative">
              <label className="block text-xs font-semibold text-slate-700 mb-1">SPBU Pengisian *</label>
              <input
                type="text"
                value={formGasStation}
                onFocus={() => onGasStationDropdownOpenChange(true)}
                onChange={e => onGasStationChange(e.target.value)}
                placeholder="Nama SPBU"
                className="w-full px-3 py-2 rounded-lg bg-white border border-slate-200 text-sm text-slate-900 focus:outline-none focus:border-blue-600"
              />
              {isGasStationDropdownOpen && (
                <div className="absolute left-0 right-0 top-full mt-1 z-30 bg-white border border-slate-200 rounded-lg divide-y divide-slate-100">
                  {['SPBU Farly', 'SPBU Gajah Mada', 'SPBU Luar / Urgent'].map(st => (
                    <button
                      key={st}
                      type="button"
                      onClick={() => {
                        onGasStationChange(st);
                        onGasStationDropdownOpenChange(false);
                      }}
                      className="w-full px-3 py-2 text-left text-xs text-slate-800 hover:bg-blue-50 flex items-center justify-between cursor-pointer"
                    >
                      <span>{st}</span>
                      {formGasStation === st && <Check className="w-3.5 h-3.5 text-blue-600" />}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* KM Awal & KM Akhir */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">KM Awal (Berangkat) *</label>
              <input
                type="number"
                min="0"
                placeholder="Odometer awal"
                value={formStartOdo}
                onChange={e => onStartOdoChange(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-white border border-slate-200 text-sm font-mono tabular-nums text-slate-900 focus:outline-none focus:border-blue-600"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">KM Akhir / Isi BBM *</label>
              <input
                type="number"
                min="0"
                placeholder="Odometer saat isi / pulang"
                value={formEndOdo}
                onChange={e => onEndOdoChange(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-white border border-slate-200 text-sm font-mono tabular-nums text-slate-900 focus:outline-none focus:border-blue-600"
              />
            </div>

            {/* Area / Rute Pengiriman */}
            <div className="relative sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 mb-1">Area / Rute Pengiriman</label>
              <button
                type="button"
                onClick={() => onActiveModalDropdownChange(activeModalDropdown === 'area' ? null : 'area')}
                className="w-full px-3 py-2 rounded-lg bg-white border border-slate-200 text-left text-sm flex items-center justify-between cursor-pointer hover:border-blue-600"
              >
                <span className={formRouteTrip ? 'text-slate-900' : 'text-slate-400'}>
                  {formRouteTrip || 'Pilih Area Tujuan'}
                </span>
                <ChevronDown className="w-4 h-4 text-slate-400" />
              </button>

              {activeModalDropdown === 'area' && (
                <div className="absolute left-0 right-0 top-full mt-1 z-30 bg-white border border-slate-200 rounded-lg overflow-hidden">
                  <div className="p-2 border-b border-slate-100">
                    <input
                      type="text"
                      value={areaSearchFilter}
                      onChange={e => onAreaSearchFilterChange(e.target.value)}
                      placeholder="Cari area pengiriman..."
                      className="w-full px-2.5 py-1.5 rounded border border-slate-200 text-xs focus:outline-none focus:border-blue-600"
                    />
                  </div>
                  <div className="max-h-48 overflow-y-auto divide-y divide-slate-100">
                    {filteredAreaOptions.map(area => (
                      <button
                        key={area}
                        type="button"
                        onClick={() => {
                          onSelectArea(area);
                          onActiveModalDropdownChange(null);
                        }}
                        className="w-full px-3 py-2 text-left text-xs text-slate-800 hover:bg-blue-50 cursor-pointer"
                      >
                        {area}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Live Calculation Summary */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3.5 rounded-xl bg-slate-50 border border-slate-200">
            <div>
              <div className="text-[11px] text-slate-500">Jarak Tempuh</div>
              <div className="text-sm font-bold text-slate-900 font-mono tabular-nums">
                {liveFormDistance.toLocaleString('id-ID')} KM
              </div>
            </div>
            <div>
              <div className="text-[11px] text-slate-500">Total Biaya</div>
              <div className="text-sm font-bold text-slate-900 font-mono tabular-nums">
                Rp {liveFormTotalCost.toLocaleString('id-ID')}
              </div>
            </div>
            <div>
              <div className="text-[11px] text-slate-500">Estimasi Rasio</div>
              <div className="text-sm font-bold text-blue-600 font-mono tabular-nums">
                {liveFormRatio.toFixed(2)} KM/L
              </div>
            </div>
            <div>
              <div className="text-[11px] text-slate-500">Evaluasi</div>
              <div className={`text-xs font-semibold px-2 py-0.5 rounded border inline-block mt-0.5 ${liveFormEfficiency.tone}`}>
                {liveFormEfficiency.status}
              </div>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold cursor-pointer"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={isSavingFuelLog}
              className="px-5 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold transition cursor-pointer disabled:opacity-50"
            >
              {isSavingFuelLog ? 'Menyimpan...' : editingLogId ? 'Simpan Perubahan' : 'Simpan Catatan BBM'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
