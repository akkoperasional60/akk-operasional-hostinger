import React, { useState, useEffect, useMemo } from 'react';
import {
  FileText,
  Plus,
  Search,
  CheckCircle2,
  Clock,
  AlertCircle,
  Truck,
  User,
  MapPin,
  Package,
  Trash2,
  Send,
  X,
  Check,
  ShieldCheck
} from 'lucide-react';
import {
  formKirimStore,
  FormKirimRecord,
  FormKirimPaymentMethod
} from '../../services/formKirimStore';
import { branchStore, BranchRecord } from '../../services/branchStore';
import { logisticsStore } from '../../services/store';

// ============================================================================
// 1. SUB-MENU ADMIN PENJUALAN: FORM KIRIM (TERINTEGRASI FINANCE & PORTAL DRIVER)
// ============================================================================
export const SalesFormKirimTab: React.FC = () => {
  const [records, setRecords] = useState<FormKirimRecord[]>(() => formKirimStore.getAll());
  const [branches, setBranches] = useState<BranchRecord[]>(() => branchStore.getBranches());
  const [branchFilter, setBranchFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending_finance' | 'approved_finance' | 'revision_needed'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  const currentUser = logisticsStore.getCurrentUser();
  const fleets = logisticsStore.getFleets();
  const crews = logisticsStore.getCrews();

  useEffect(() => {
    const unsubForm = formKirimStore.subscribe(() => {
      setRecords(formKirimStore.getAll());
    });
    const unsubBranch = branchStore.subscribe(() => {
      setBranches(branchStore.getBranches());
    });
    return () => {
      unsubForm();
      unsubBranch();
    };
  }, []);

  const [formData, setFormData] = useState({
    branchName: branches[0]?.name || 'Banyuwangi',
    tanggalKirim: new Date().toISOString().slice(0, 10),
    noFaktur: `INV/AKK/2026/11/${String(records.length + 185).padStart(4, '0')}`,
    noSuratJalan: `SJ-AKK-2611-${String(records.length + 110)}`,
    storeName: '',
    storeAddress: '',
    storePhone: '',
    fleetId: fleets[0]?.id || 'fl-01',
    driverName: crews[0]?.name || 'Zainul Agustiar',
    helperName: crews[1]?.name || 'Aan Adi Saputra',
    itemsSummary: '',
    totalColli: 25,
    totalNominalFaktur: 12500000,
    sisaPiutangToko: 0,
    metodePembayaran: 'Kredit / Tempo' as FormKirimPaymentMethod,
    salesNotes: ''
  });

  const filteredRecords = useMemo(() => {
    return records.filter(item => {
      if (branchFilter !== 'ALL' && !item.branchName.toLowerCase().includes(branchFilter.toLowerCase())) {
        return false;
      }
      if (statusFilter !== 'all' && item.financeStatus !== statusFilter) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const match =
          item.noFormKirim.toLowerCase().includes(q) ||
          item.noFaktur.toLowerCase().includes(q) ||
          item.storeName.toLowerCase().includes(q) ||
          item.driverName.toLowerCase().includes(q) ||
          item.plateNumber.toLowerCase().includes(q);
        if (!match) return false;
      }
      return true;
    });
  }, [records, branchFilter, statusFilter, searchQuery]);

  const counts = useMemo(() => {
    return {
      total: records.length,
      pending: records.filter(r => r.financeStatus === 'pending_finance').length,
      approved: records.filter(r => r.financeStatus === 'approved_finance').length,
      delivered: records.filter(r => r.driverStatus === 'delivered').length
    };
  }, [records]);

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.storeName.trim() || !formData.itemsSummary.trim()) return;

    const selectedFleet = fleets.find(f => f.id === formData.fleetId) || fleets[0];

    formKirimStore.addFormKirim({
      noFaktur: formData.noFaktur.trim().toUpperCase(),
      noSuratJalan: formData.noSuratJalan.trim().toUpperCase(),
      branchName: formData.branchName,
      tanggalKirim: formData.tanggalKirim,
      storeName: formData.storeName.trim().toUpperCase(),
      storeAddress: formData.storeAddress.trim() || `Area Distribusi ${formData.branchName}`,
      storePhone: formData.storePhone.trim() || '-',
      fleetId: selectedFleet?.id || 'fl-01',
      plateNumber: selectedFleet?.plateNumber || 'P 8125 VC',
      vehicleType: selectedFleet?.vehicleType || 'Engkel Box',
      driverName: formData.driverName,
      helperName: formData.helperName,
      itemsSummary: formData.itemsSummary.trim(),
      totalColli: Math.max(1, Number(formData.totalColli) || 1),
      totalNominalFaktur: Math.max(0, Number(formData.totalNominalFaktur) || 0),
      sisaPiutangToko: Math.max(0, Number(formData.sisaPiutangToko) || 0),
      metodePembayaran: formData.metodePembayaran,
      createdByAdmin: currentUser?.fullName || 'Admin Penjualan',
      salesNotes: formData.salesNotes.trim() || 'Pengajuan pengiriman barang pelanggan'
    });

    setIsAddModalOpen(false);
    setFormData(prev => ({
      ...prev,
      noFaktur: `INV/AKK/2026/11/${String(records.length + 190).padStart(4, '0')}`,
      noSuratJalan: `SJ-AKK-2611-${String(records.length + 115)}`,
      storeName: '',
      storeAddress: '',
      storePhone: '',
      itemsSummary: '',
      salesNotes: ''
    }));
  };

  return (
    <div className="space-y-4">
      {/* Simple Header Bar */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-600 dark:text-blue-400 shrink-0">
            <Send className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
              Form Kirim Barang
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Terintegrasi ke Validasi Finance &amp; Portal Driver Mobile
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-1.5">
            <MapPin className="w-3.5 h-3.5 text-amber-500" />
            <select
              value={branchFilter}
              onChange={e => setBranchFilter(e.target.value)}
              className="bg-transparent text-xs font-semibold text-slate-800 dark:text-slate-200 focus:outline-none cursor-pointer"
            >
              <option value="ALL">Semua Cabang ({branches.length})</option>
              {branches.map(b => (
                <option key={b.id} value={b.name}>
                  Cabang {b.name}
                </option>
              ))}
            </select>
          </div>

          <button
            type="button"
            onClick={() => setIsAddModalOpen(true)}
            className="px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold flex items-center gap-1.5 transition cursor-pointer shadow-xs"
          >
            <Plus className="w-4 h-4" />
            <span>Buat Form Kirim</span>
          </button>
        </div>
      </div>

      {/* Simple Summary Pills */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3.5">
          <div className="text-[11px] font-medium text-slate-500">Total Form Kirim</div>
          <div className="text-xl font-bold text-slate-900 dark:text-white mt-0.5">{counts.total}</div>
        </div>
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3.5">
          <div className="text-[11px] font-medium text-amber-600 dark:text-amber-400">Menunggu Finance</div>
          <div className="text-xl font-bold text-amber-600 dark:text-amber-400 mt-0.5">{counts.pending}</div>
        </div>
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3.5">
          <div className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400">Tervalidasi (Di Portal Driver)</div>
          <div className="text-xl font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">{counts.approved}</div>
        </div>
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3.5">
          <div className="text-[11px] font-medium text-blue-600 dark:text-blue-400">Selesai Dikirim Driver</div>
          <div className="text-xl font-bold text-blue-600 dark:text-blue-400 mt-0.5">{counts.delivered}</div>
        </div>
      </div>

      {/* Search & Status Filter */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 space-y-3 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
          <div className="flex flex-wrap items-center gap-1.5">
            {[
              { id: 'all', label: 'Semua' },
              { id: 'pending_finance', label: 'Menunggu Finance' },
              { id: 'approved_finance', label: 'Tervalidasi Finance' },
              { id: 'revision_needed', label: 'Perlu Revisi' }
            ].map(tab => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setStatusFilter(tab.id as any)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                  statusFilter === tab.id
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="relative w-full sm:w-64">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Cari toko, faktur, driver..."
              className="w-full pl-8 pr-3 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:border-blue-500"
            />
          </div>
        </div>

        {/* Clean Table List */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400">
                <th className="py-2.5 px-3 font-semibold">No. Form &amp; Faktur</th>
                <th className="py-2.5 px-3 font-semibold">Pelanggan / Toko</th>
                <th className="py-2.5 px-3 font-semibold">Armada &amp; Kru</th>
                <th className="py-2.5 px-3 font-semibold">Barang &amp; Tagihan</th>
                <th className="py-2.5 px-3 font-semibold">Validasi Finance</th>
                <th className="py-2.5 px-3 font-semibold">Status Portal Driver</th>
                <th className="py-2.5 px-3 text-right font-semibold">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/70">
              {filteredRecords.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-400">
                    Belum ada data Form Kirim pada filter ini.
                  </td>
                </tr>
              ) : (
                filteredRecords.map(item => (
                  <tr key={item.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition">
                    <td className="py-3 px-3 align-top">
                      <div className="font-mono font-bold text-blue-600 dark:text-blue-400">
                        {item.noFormKirim}
                      </div>
                      <div className="text-[11px] text-slate-500 font-mono">{item.noFaktur}</div>
                      <div className="text-[10px] text-slate-400 mt-0.5">
                        {item.tanggalKirim} • {item.branchName}
                      </div>
                    </td>

                    <td className="py-3 px-3 align-top">
                      <div className="font-bold text-slate-900 dark:text-white">{item.storeName}</div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400 max-w-xs truncate">
                        {item.storeAddress}
                      </div>
                      <div className="text-[10px] text-slate-400 mt-0.5">Admin: {item.createdByAdmin}</div>
                    </td>

                    <td className="py-3 px-3 align-top">
                      <div className="font-bold text-slate-800 dark:text-slate-200 font-mono">
                        {item.plateNumber}
                      </div>
                      <div className="text-[11px] text-slate-600 dark:text-slate-300">
                        Supir: {item.driverName}
                      </div>
                      <div className="text-[10px] text-slate-400">Helper: {item.helperName}</div>
                    </td>

                    <td className="py-3 px-3 align-top">
                      <div className="text-slate-800 dark:text-slate-200 font-medium max-w-xs">
                        {item.itemsSummary}
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-[10px] font-bold">
                          {item.totalColli} Koli
                        </span>
                        <span className="font-bold text-slate-900 dark:text-white">
                          Rp {item.totalNominalFaktur.toLocaleString('id-ID')}
                        </span>
                        <span className="text-[10px] text-indigo-600 dark:text-indigo-400 font-semibold">
                          ({item.metodePembayaran})
                        </span>
                      </div>
                    </td>

                    <td className="py-3 px-3 align-top">
                      {item.financeStatus === 'approved_finance' ? (
                        <div className="space-y-1">
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 text-[10px] font-bold">
                            <CheckCircle2 className="w-3 h-3" />
                            Tervalidasi Finance
                          </span>
                          {item.financeNotes && (
                            <div className="text-[10px] text-slate-500 dark:text-slate-400 max-w-[180px]">
                              {item.financeNotes}
                            </div>
                          )}
                        </div>
                      ) : item.financeStatus === 'revision_needed' ? (
                        <div className="space-y-1">
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-rose-500/15 text-rose-600 dark:text-rose-400 text-[10px] font-bold">
                            <AlertCircle className="w-3 h-3" />
                            Perlu Revisi
                          </span>
                          {item.financeNotes && (
                            <div className="text-[10px] text-rose-500 max-w-[180px]">
                              {item.financeNotes}
                            </div>
                          )}
                        </div>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-400 text-[10px] font-bold">
                          <Clock className="w-3 h-3" />
                          Menunggu Finance
                        </span>
                      )}
                    </td>

                    <td className="py-3 px-3 align-top">
                      {item.driverStatus === 'delivered' ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 text-[10px] font-bold">
                          <CheckCircle2 className="w-3 h-3" />
                          Selesai Dikirim
                        </span>
                      ) : item.driverStatus === 'in_transit' ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-500/15 text-blue-600 dark:text-blue-400 text-[10px] font-bold">
                          <Truck className="w-3 h-3" />
                          Sedang Dikirim Driver
                        </span>
                      ) : item.driverStatus === 'ready_for_driver' ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 text-[10px] font-bold">
                          <Package className="w-3 h-3" />
                          Tampil di Portal Driver
                        </span>
                      ) : (
                        <span className="text-[11px] text-slate-400">Menunggu Validasi</span>
                      )}
                    </td>

                    <td className="py-3 px-3 align-top text-right">
                      <button
                        type="button"
                        onClick={() => formKirimStore.deleteFormKirim(item.id)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition cursor-pointer"
                        title="Hapus Form Kirim"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Buat Form Kirim Baru */}
      {isAddModalOpen && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setIsAddModalOpen(false)}
        >
          <div
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-lg p-5 space-y-4 shadow-2xl max-h-[90vh] overflow-y-auto"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Buat Form Kirim Baru
                </h3>
                <p className="text-xs text-slate-500">
                  Otomatis diteruskan ke Finance (Validasi Form Kirim) &amp; Portal Driver
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} className="space-y-3 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                    Cabang (Master Cabang)
                  </label>
                  <select
                    value={formData.branchName}
                    onChange={e => setFormData(prev => ({ ...prev, branchName: e.target.value }))}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white font-medium"
                  >
                    {branches.map(b => (
                      <option key={b.id} value={b.name}>
                        {b.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                    Tanggal Kirim
                  </label>
                  <input
                    type="date"
                    value={formData.tanggalKirim}
                    onChange={e => setFormData(prev => ({ ...prev, tanggalKirim: e.target.value }))}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white font-medium"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                    No. Faktur (SO)
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.noFaktur}
                    onChange={e => setFormData(prev => ({ ...prev, noFaktur: e.target.value }))}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white font-mono"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                    No. Surat Jalan
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.noSuratJalan}
                    onChange={e => setFormData(prev => ({ ...prev, noSuratJalan: e.target.value }))}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                    Nama Pelanggan / Toko *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Contoh: TK SINAR HARAPAN"
                    value={formData.storeName}
                    onChange={e => setFormData(prev => ({ ...prev, storeName: e.target.value }))}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                    Alamat Tujuan Kirim
                  </label>
                  <input
                    type="text"
                    placeholder="Contoh: Jl. Ahmad Yani No. 12, Jember"
                    value={formData.storeAddress}
                    onChange={e => setFormData(prev => ({ ...prev, storeAddress: e.target.value }))}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                    Armada Kirim
                  </label>
                  <select
                    value={formData.fleetId}
                    onChange={e => setFormData(prev => ({ ...prev, fleetId: e.target.value }))}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white"
                  >
                    {fleets.map(f => (
                      <option key={f.id} value={f.id}>
                        {f.plateNumber} ({f.vehicleType})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                    Driver Tujuan
                  </label>
                  <select
                    value={formData.driverName}
                    onChange={e => setFormData(prev => ({ ...prev, driverName: e.target.value }))}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white"
                  >
                    {crews.map(c => (
                      <option key={c.id} value={c.name}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                    Helper / Kernet
                  </label>
                  <select
                    value={formData.helperName}
                    onChange={e => setFormData(prev => ({ ...prev, helperName: e.target.value }))}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white"
                  >
                    {crews.map(c => (
                      <option key={c.id} value={c.name}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                  Rincian Barang Kirim *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: Cup Plst Jaguar 16 Oz (30 CRT), Mika Brownies (10 CRT)"
                  value={formData.itemsSummary}
                  onChange={e => setFormData(prev => ({ ...prev, itemsSummary: e.target.value }))}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                    Total Koli / Karton
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={formData.totalColli}
                    onChange={e => setFormData(prev => ({ ...prev, totalColli: Number(e.target.value) || 1 }))}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                    Nominal Faktur (Rp)
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={formData.totalNominalFaktur}
                    onChange={e => setFormData(prev => ({ ...prev, totalNominalFaktur: Number(e.target.value) || 0 }))}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                    Metode Pembayaran
                  </label>
                  <select
                    value={formData.metodePembayaran}
                    onChange={e =>
                      setFormData(prev => ({
                        ...prev,
                        metodePembayaran: e.target.value as FormKirimPaymentMethod
                      }))
                    }
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white"
                  >
                    <option value="Kredit / Tempo">Kredit / Tempo</option>
                    <option value="COD (Bayar di Tempat)">COD (Bayar di Tempat)</option>
                    <option value="Lunas Transfer">Lunas Transfer</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                  Catatan Kirim (Opsional)
                </label>
                <input
                  type="text"
                  placeholder="Catatan untuk Finance & Driver..."
                  value={formData.salesNotes}
                  onChange={e => setFormData(prev => ({ ...prev, salesNotes: e.target.value }))}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold flex items-center gap-1.5 cursor-pointer"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Simpan &amp; Kirim ke Finance</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

// ============================================================================
// 2. SUB-MENU FINANCE & TAX: VALIDASI FORM KIRIM (TERINTEGRASI PORTAL DRIVER)
// ============================================================================
export const FinanceValidasiFormKirimTab: React.FC = () => {
  const [records, setRecords] = useState<FormKirimRecord[]>(() => formKirimStore.getAll());
  const [branches, setBranches] = useState<BranchRecord[]>(() => branchStore.getBranches());
  const [branchFilter, setBranchFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending_finance' | 'approved_finance' | 'revision_needed'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [noteInputs, setNoteInputs] = useState<Record<string, string>>({});

  const currentUser = logisticsStore.getCurrentUser();

  useEffect(() => {
    const unsubForm = formKirimStore.subscribe(() => {
      setRecords(formKirimStore.getAll());
    });
    const unsubBranch = branchStore.subscribe(() => {
      setBranches(branchStore.getBranches());
    });
    return () => {
      unsubForm();
      unsubBranch();
    };
  }, []);

  const filteredRecords = useMemo(() => {
    return records.filter(item => {
      if (branchFilter !== 'ALL' && !item.branchName.toLowerCase().includes(branchFilter.toLowerCase())) {
        return false;
      }
      if (statusFilter !== 'all' && item.financeStatus !== statusFilter) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const match =
          item.noFormKirim.toLowerCase().includes(q) ||
          item.noFaktur.toLowerCase().includes(q) ||
          item.storeName.toLowerCase().includes(q) ||
          item.driverName.toLowerCase().includes(q);
        if (!match) return false;
      }
      return true;
    });
  }, [records, branchFilter, statusFilter, searchQuery]);

  const handleValidate = (item: FormKirimRecord, nextStatus: 'approved_finance' | 'revision_needed') => {
    const note = noteInputs[item.id] ?? item.financeNotes ?? '';
    formKirimStore.validateByFinance(
      item.id,
      nextStatus,
      currentUser?.fullName || 'Finance & Tax AKK',
      note
    );
  };

  return (
    <div className="space-y-4">
      {/* Simple Clean Header */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shrink-0">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
              Validasi Form Kirim (Finance)
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Verifikasi pengajuan Form Kirim dari Admin Penjualan sebelum masuk ke Portal Driver
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-1.5">
            <MapPin className="w-3.5 h-3.5 text-amber-500" />
            <select
              value={branchFilter}
              onChange={e => setBranchFilter(e.target.value)}
              className="bg-transparent text-xs font-semibold text-slate-800 dark:text-slate-200 focus:outline-none cursor-pointer"
            >
              <option value="ALL">Semua Cabang ({branches.length})</option>
              {branches.map(b => (
                <option key={b.id} value={b.name}>
                  Cabang {b.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Filter Bar & Cards */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 space-y-4 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
          <div className="flex flex-wrap items-center gap-1.5">
            {[
              { id: 'all', label: `Semua (${records.length})` },
              {
                id: 'pending_finance',
                label: `Menunggu Validasi (${records.filter(r => r.financeStatus === 'pending_finance').length})`
              },
              {
                id: 'approved_finance',
                label: `Sudah Divalidasi (${records.filter(r => r.financeStatus === 'approved_finance').length})`
              },
              {
                id: 'revision_needed',
                label: `Perlu Revisi (${records.filter(r => r.financeStatus === 'revision_needed').length})`
              }
            ].map(tab => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setStatusFilter(tab.id as any)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                  statusFilter === tab.id
                    ? 'bg-emerald-600 text-white'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="relative w-full sm:w-64">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Cari form kirim, toko, supir..."
              className="w-full pl-8 pr-3 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:border-emerald-500"
            />
          </div>
        </div>

        {/* List Form Kirim untuk Divalidasi Finance */}
        <div className="space-y-3">
          {filteredRecords.length === 0 ? (
            <div className="py-10 text-center text-xs text-slate-400">
              Tidak ada Form Kirim pada filter ini.
            </div>
          ) : (
            filteredRecords.map(item => (
              <div
                key={item.id}
                className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 flex flex-col lg:flex-row lg:items-center justify-between gap-4"
              >
                <div className="space-y-1.5 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono font-bold text-xs text-blue-600 dark:text-blue-400">
                      {item.noFormKirim}
                    </span>
                    <span className="text-slate-300 dark:text-slate-700">&bull;</span>
                    <span className="font-mono text-xs text-slate-600 dark:text-slate-300">
                      {item.noFaktur}
                    </span>
                    <span className="px-2 py-0.5 rounded bg-slate-200/70 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-[10px] font-semibold">
                      Cabang {item.branchName}
                    </span>
                    {item.financeStatus === 'approved_finance' ? (
                      <span className="px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 text-[10px] font-bold">
                        ✓ Tervalidasi • Masuk Portal Driver
                      </span>
                    ) : item.financeStatus === 'revision_needed' ? (
                      <span className="px-2 py-0.5 rounded-full bg-rose-500/15 text-rose-600 dark:text-rose-400 text-[10px] font-bold">
                        Perlu Revisi
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-400 text-[10px] font-bold">
                        Menunggu Validasi Finance
                      </span>
                    )}
                  </div>

                  <div className="text-sm font-bold text-slate-900 dark:text-white">
                    {item.storeName}{' '}
                    <span className="text-xs font-normal text-slate-500">({item.storeAddress})</span>
                  </div>

                  <div className="text-xs text-slate-600 dark:text-slate-300">
                    <strong>Barang ({item.totalColli} Koli):</strong> {item.itemsSummary}
                  </div>

                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-slate-500 dark:text-slate-400 pt-0.5">
                    <span>
                      Armada: <strong className="text-slate-800 dark:text-slate-200">{item.plateNumber}</strong>
                    </span>
                    <span>
                      Driver: <strong className="text-slate-800 dark:text-slate-200">{item.driverName}</strong>
                    </span>
                    <span>
                      Nominal Faktur:{' '}
                      <strong className="text-slate-900 dark:text-white">
                        Rp {item.totalNominalFaktur.toLocaleString('id-ID')}
                      </strong>
                    </span>
                    <span>
                      Pembayaran:{' '}
                      <strong className="text-indigo-600 dark:text-indigo-400">{item.metodePembayaran}</strong>
                    </span>
                    <span>
                      Sisa Piutang Toko:{' '}
                      <strong className={item.sisaPiutangToko > 0 ? 'text-rose-500' : 'text-emerald-500'}>
                        Rp {item.sisaPiutangToko.toLocaleString('id-ID')}
                      </strong>
                    </span>
                  </div>
                </div>

                {/* Panel Validasi Finance */}
                <div className="w-full lg:w-80 space-y-2 shrink-0 border-t lg:border-t-0 lg:border-l border-slate-200 dark:border-slate-800 pt-3 lg:pt-0 lg:pl-4">
                  <input
                    type="text"
                    value={noteInputs[item.id] ?? item.financeNotes ?? ''}
                    onChange={e => setNoteInputs(prev => ({ ...prev, [item.id]: e.target.value }))}
                    placeholder="Catatan validasi Finance untuk Driver..."
                    className="w-full px-3 py-1.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:border-emerald-500"
                  />

                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => handleValidate(item, 'approved_finance')}
                      className="py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer"
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>Setujui &amp; Kirim Driver</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleValidate(item, 'revision_needed')}
                      className="py-2 px-3 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 text-rose-600 dark:text-rose-400 border border-rose-500/30 text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer"
                    >
                      <AlertCircle className="w-3.5 h-3.5" />
                      <span>Tahan / Revisi</span>
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
