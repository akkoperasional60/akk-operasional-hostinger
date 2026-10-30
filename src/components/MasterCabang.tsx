import React, { useState, useEffect } from 'react';
import {
  Building2,
  Plus,
  CheckCircle2,
  Database,
  Truck,
  Package,
  Calendar,
  Copy,
  Check,
  X
} from 'lucide-react';
import { branchStore, BranchRecord } from '../services/branchStore';
import { logisticsStore } from '../services/store';

export const MULTI_STORE_SQL_DDL = `-- ============================================================================
-- SKEMA DATABASE MULTI-STORE / MULTI-GUDANG PUSAT (B2B LOGISTIK PT AKK)
-- Mendukung pemisahan & pengelolaan Inventaris, Jadwal Pengiriman, Armada,
-- serta Hak Akses Per-Cabang (RBAC Multi-Branch)
-- ============================================================================

-- 1. Tabel Master Cabang / Gudang Pusat (master_branches)
CREATE TABLE IF NOT EXISTS master_branches (
  id VARCHAR(64) PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  warehouse_name VARCHAR(180) NOT NULL,
  slug VARCHAR(100) NOT NULL UNIQUE,
  sort_order INT NOT NULL DEFAULT 0,
  template VARCHAR(60) NOT NULL DEFAULT 'Classic / Default',
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  is_frontline_active TINYINT(1) NOT NULL DEFAULT 1,
  city VARCHAR(100) NOT NULL,
  address TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- 2. Tabel Inventaris Stok Per Gudang Pusat (branch_inventory_stocks)
CREATE TABLE IF NOT EXISTS branch_inventory_stocks (
  id VARCHAR(64) PRIMARY KEY,
  branch_id VARCHAR(64) NOT NULL,
  sku_code VARCHAR(64) NOT NULL,
  item_name VARCHAR(255) NOT NULL,
  category VARCHAR(120) NOT NULL,
  stock_on_hand INT NOT NULL DEFAULT 0,
  reserved_qty INT NOT NULL DEFAULT 0,
  unit VARCHAR(32) NOT NULL DEFAULT 'Pcs',
  bin_location VARCHAR(64) DEFAULT 'A-01-L1',
  length_cm DECIMAL(10,2) DEFAULT 0,
  width_cm DECIMAL(10,2) DEFAULT 0,
  height_cm DECIMAL(10,2) DEFAULT 0,
  cubication_m3 DECIMAL(12,6) DEFAULT 0,
  weight_kg DECIMAL(10,2) DEFAULT 0,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_branch_sku (branch_id, sku_code),
  INDEX idx_inv_branch (branch_id),
  CONSTRAINT fk_inv_branch FOREIGN KEY (branch_id) REFERENCES master_branches(id) ON DELETE CASCADE
);

-- 3. Relasi Armada ke Gudang Pusat Asal (fleet_units)
CREATE TABLE IF NOT EXISTS fleet_units (
  id VARCHAR(64) PRIMARY KEY,
  origin_branch_id VARCHAR(64) NOT NULL,
  plate_number VARCHAR(32) NOT NULL UNIQUE,
  initial_code VARCHAR(32),
  vehicle_type VARCHAR(64) NOT NULL,
  brand VARCHAR(64),
  box_capacity_m3 DECIMAL(10,2) DEFAULT 0,
  tonnage_capacity_kg INT DEFAULT 0,
  status ENUM('available', 'on-duty', 'maintenance') NOT NULL DEFAULT 'available',
  INDEX idx_fleet_branch (origin_branch_id),
  CONSTRAINT fk_fleet_branch FOREIGN KEY (origin_branch_id) REFERENCES master_branches(id) ON DELETE RESTRICT
);

-- 4. Relasi Jadwal Pengiriman ke Gudang Pusat Asal (delivery_schedules)
CREATE TABLE IF NOT EXISTS delivery_schedules (
  id VARCHAR(64) PRIMARY KEY,
  origin_branch_id VARCHAR(64) NOT NULL,
  fleet_id VARCHAR(64) NOT NULL,
  driver_id VARCHAR(64) NOT NULL,
  helper_1_id VARCHAR(64),
  helper_2_id VARCHAR(64),
  destination_area VARCHAR(120) NOT NULL,
  departure_date DATE NOT NULL,
  return_date DATE NOT NULL,
  delivery_date DATE NOT NULL,
  status ENUM('scheduled', 'picked_up', 'in_transit', 'delivered', 'delayed') NOT NULL DEFAULT 'scheduled',
  INDEX idx_sched_branch_date (origin_branch_id, delivery_date),
  CONSTRAINT fk_sched_branch FOREIGN KEY (origin_branch_id) REFERENCES master_branches(id) ON DELETE RESTRICT
);

-- 5. Tabel Hak Akses Pengguna Per Cabang (user_branch_permissions)
CREATE TABLE IF NOT EXISTS user_branch_permissions (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  user_id VARCHAR(64) NOT NULL,
  branch_id VARCHAR(64) NOT NULL,
  is_branch_enabled TINYINT(1) NOT NULL DEFAULT 0,
  is_all_access TINYINT(1) NOT NULL DEFAULT 0,
  module_permissions_json JSON NOT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_user_branch (user_id, branch_id),
  CONSTRAINT fk_ubp_branch FOREIGN KEY (branch_id) REFERENCES master_branches(id) ON DELETE CASCADE
);

-- 6. Tabel Riwayat Chat Internal Logistik (messages - Hostinger MySQL)
CREATE TABLE IF NOT EXISTS messages (
  id VARCHAR(64) PRIMARY KEY,
  sender_id VARCHAR(64) NOT NULL,
  sender_name VARCHAR(128),
  sender_role VARCHAR(64),
  receiver_id VARCHAR(64) NOT NULL,
  receiver_name VARCHAR(128),
  receiver_role VARCHAR(64),
  content TEXT NOT NULL,
  timestamp DATETIME,
  is_read TINYINT(1) DEFAULT 0,
  cabang_id VARCHAR(64),
  payload_json JSON,
  INDEX idx_msg_receiver (receiver_id),
  INDEX idx_msg_sender (sender_id)
);`;

export const MasterCabang: React.FC = () => {
  const [branches, setBranches] = useState<BranchRecord[]>(branchStore.getBranches());
  const [selectedOriginBranchId, setSelectedOriginBranchId] = useState<string>(
    branchStore.getSelectedOriginBranchId()
  );
  const [usersList, setUsersList] = useState(() => logisticsStore.getUsers());

  // Add Branch Form State (matches screenshot image_7c60497e.png)
  const [newName, setNewName] = useState('');
  const [newSlug, setNewSlug] = useState('');
  const [newOrder, setNewOrder] = useState<number>(0);
  const [newTemplate, setNewTemplate] = useState<BranchRecord['template']>('Classic / Default');
  const [newIsActive, setNewIsActive] = useState(true);
  const [newIsFrontlineActive, setNewIsFrontlineActive] = useState(true);

  // Inline row edits state: branchId -> draft fields
  const [rowDrafts, setRowDrafts] = useState<
    Record<
      string,
      {
        name: string;
        sortOrder: number;
        slug: string;
        template: BranchRecord['template'];
        isActive: boolean;
        isFrontlineActive: boolean;
      }
    >
  >({});

  // SQL Schema Modal / Section toggle
  const [showSqlSchema, setShowSqlSchema] = useState(false);
  const [copiedSql, setCopiedSql] = useState(false);

  // Popup modal notification (supports Enter/Escape)
  const [popupModal, setPopupModal] = useState<{ title: string; message: string } | null>(null);

  useEffect(() => {
    if (!popupModal) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === 'Escape') {
        e.preventDefault();
        setPopupModal(null);
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [popupModal]);

  const syncDrafts = (list: BranchRecord[]) => {
    const next: typeof rowDrafts = {};
    list.forEach(b => {
      next[b.id] = {
        name: b.name,
        sortOrder: b.sortOrder,
        slug: b.slug,
        template: b.template,
        isActive: b.isActive,
        isFrontlineActive: b.isFrontlineActive
      };
    });
    setRowDrafts(next);
  };

  useEffect(() => {
    syncDrafts(branchStore.getBranches());
    const unsubBranch = branchStore.subscribe(() => {
      const fresh = branchStore.getBranches();
      setBranches(fresh);
      setSelectedOriginBranchId(branchStore.getSelectedOriginBranchId());
      setUsersList([...logisticsStore.getUsers()]);
      syncDrafts(fresh);
    });
    const unsubStore = logisticsStore.subscribe(() => {
      setUsersList([...logisticsStore.getUsers()]);
    });
    return () => {
      unsubBranch();
      unsubStore();
    };
  }, []);

  const handleAddBranch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;

    const created = branchStore.addBranch({
      name: newName.trim(),
      slug: newSlug.trim(),
      sortOrder: Number(newOrder) || branches.length + 1,
      template: newTemplate,
      isActive: newIsActive,
      isFrontlineActive: newIsFrontlineActive
    });

    setNewName('');
    setNewSlug('');
    setNewOrder(0);
    setNewTemplate('Classic / Default');
    setNewIsActive(true);
    setNewIsFrontlineActive(true);

    setPopupModal({
      title: 'Cabang Baru Berhasil Disimpan',
      message: `Cabang "${created.name}" (${created.warehouseName}) berhasil ditambahkan dan otomatis muncul pada pilihan Cabang serta Akses Cabang di Manajemen User.`
    });
  };

  const handleUpdateRow = (branchId: string) => {
    const draft = rowDrafts[branchId];
    if (!draft || !draft.name.trim()) return;

    const cleanSlug =
      draft.slug.trim().toLowerCase().replace(/[^a-z0-9-]+/g, '-') ||
      draft.name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-');

    branchStore.updateBranch(branchId, {
      name: draft.name.trim(),
      warehouseName: `Gudang ${draft.name.trim()}`,
      sortOrder: Number(draft.sortOrder) || 1,
      slug: cleanSlug,
      template: draft.template,
      isActive: draft.isActive,
      isFrontlineActive: draft.isFrontlineActive
    });

    setPopupModal({
      title: 'Data Cabang Diperbarui',
      message: `Konfigurasi cabang "${draft.name.trim()}" berhasil disimpan ke sistem.`
    });
  };

  const handleDeleteRow = (branch: BranchRecord) => {
    if (branches.length <= 1) {
      setPopupModal({
        title: 'Tidak Dapat Menghapus',
        message: 'Minimal harus terdapat 1 cabang aktif di dalam sistem.'
      });
      return;
    }
    branchStore.deleteBranch(branch.id);
    setPopupModal({
      title: 'Cabang Dihapus',
      message: `Cabang "${branch.name}" telah dihapus dari daftar cabang.`
    });
  };

  const handleCopySql = () => {
    navigator.clipboard.writeText(MULTI_STORE_SQL_DDL);
    setCopiedSql(true);
    setTimeout(() => setCopiedSql(false), 2500);
  };

  return (
    <div className="space-y-5">
      {/* HEADER CARD — Matches screenshot image_7c60497e.png */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="space-y-1.5">
          <div className="text-[11px] font-black uppercase tracking-[0.2em] text-blue-600 dark:text-blue-400">
            MASTER &amp; ADMIN
          </div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
            Master Cabang
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
            Atur cabang asal pengiriman, pilihan template frontline, dan aktif/nonaktif landing page customer per cabang.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          {/* Active Origin Warehouse Switcher right in Master Cabang */}
          <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs">
            <Building2 className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
            <span className="font-bold text-slate-500 dark:text-slate-400">Cabang Aktif:</span>
            <select
              value={selectedOriginBranchId}
              onChange={e => branchStore.setSelectedOriginBranchId(e.target.value)}
              className="bg-transparent font-black text-slate-900 dark:text-white focus:outline-none cursor-pointer"
            >
              <option value="ALL" className="bg-white dark:bg-slate-900">Semua Cabang ({branches.length})</option>
              {branches.filter(b => b.isActive).map(b => (
                <option key={b.id} value={b.id} className="bg-white dark:bg-slate-900">
                  Cabang {b.name} ({b.slug})
                </option>
              ))}
            </select>
          </div>

          <button
            type="button"
            onClick={() => setShowSqlSchema(prev => !prev)}
            className="px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold text-xs flex items-center gap-1.5 transition cursor-pointer"
          >
            <Database className="w-4 h-4 text-indigo-500" />
            <span>{showSqlSchema ? 'Sembunyikan Skema Tabel SQL' : 'Lihat Skema Database Multi-Store'}</span>
          </button>
        </div>
      </div>

      {/* COLLAPSIBLE SQL SCHEMA FOR MULTI-STORE B2B LOGISTICS */}
      {showSqlSchema && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-3 shadow-lg">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-black text-white flex items-center gap-2">
                <Database className="w-4 h-4 text-emerald-400" />
                <span>Rancangan Tabel Database Multi-Store (MySQL DDL)</span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Memisahkan dan mengelola Inventaris SKU, Jadwal Pengiriman, Armada Truk, dan Hak Akses User berdasarkan Cabang (`branch_id`).
              </p>
            </div>
            <button
              type="button"
              onClick={handleCopySql}
              className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-1.5 cursor-pointer"
            >
              {copiedSql ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedSql ? 'SQL Tersalin' : 'Salin DDL SQL'}</span>
            </button>
          </div>
          <pre className="p-4 rounded-xl bg-slate-950 border border-slate-800 text-[11px] font-mono text-emerald-300 overflow-x-auto max-h-80 leading-relaxed">
            {MULTI_STORE_SQL_DDL}
          </pre>
        </div>
      )}

      {/* TAMBAH CABANG CARD — Matches screenshot image_7c60497e.png */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-xs space-y-4">
        <h2 className="text-base font-black text-slate-900 dark:text-white">
          Tambah Cabang
        </h2>

        <form onSubmit={handleAddBranch} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
            <div className="md:col-span-4">
              <input
                type="text"
                required
                value={newName}
                onChange={e => setNewName(e.target.value)}
                placeholder="Nama Cabang, contoh Banyuwangi"
                className="w-full px-4 py-3 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs sm:text-sm font-medium text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-blue-500"
              />
            </div>

            <div className="md:col-span-2">
              <input
                type="text"
                value={newSlug}
                onChange={e => setNewSlug(e.target.value)}
                placeholder="Slug otomatis jika kosong"
                className="w-full px-4 py-3 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs sm:text-sm font-medium text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-blue-500"
              />
            </div>

            <div className="md:col-span-2">
              <input
                type="number"
                value={newOrder}
                onChange={e => setNewOrder(Number(e.target.value))}
                placeholder="0"
                className="w-full px-4 py-3 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs sm:text-sm font-bold text-slate-900 dark:text-white focus:outline-none focus:border-blue-500"
              />
            </div>

            <div className="md:col-span-2">
              <select
                value={newTemplate}
                onChange={e => setNewTemplate(e.target.value as BranchRecord['template'])}
                className="w-full px-4 py-3 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs sm:text-sm font-bold text-slate-900 dark:text-white focus:outline-none focus:border-blue-500 cursor-pointer"
              >
                <option value="Classic / Default">Classic / Default</option>
                <option value="Modern B2B">Modern B2B</option>
                <option value="Enterprise WMS">Enterprise WMS</option>
              </select>
            </div>

            <div className="md:col-span-2">
              <button
                type="submit"
                className="w-full py-3 px-4 rounded-2xl bg-slate-900 hover:bg-slate-800 dark:bg-blue-600 dark:hover:bg-blue-500 text-white font-black text-xs sm:text-sm transition cursor-pointer shadow-xs flex items-center justify-center gap-1.5"
              >
                <Plus className="w-4 h-4" />
                <span>Simpan Cabang</span>
              </button>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-6 pt-1 text-xs font-bold text-slate-700 dark:text-slate-300">
            <label className="inline-flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={newIsActive}
                onChange={e => setNewIsActive(e.target.checked)}
                className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 cursor-pointer"
              />
              <span>Cabang aktif</span>
            </label>

            <label className="inline-flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={newIsFrontlineActive}
                onChange={e => setNewIsFrontlineActive(e.target.checked)}
                className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 cursor-pointer"
              />
              <span>Frontline / landing page aktif</span>
            </label>
          </div>
        </form>
      </div>

      {/* TABEL DAFTAR CABANG */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-50/80 dark:bg-slate-950/60 text-slate-500 dark:text-slate-400 uppercase font-extrabold text-[11px] tracking-wider border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th className="py-4 px-5 min-w-[320px]">CABANG</th>
                <th className="py-4 px-4 min-w-[160px]">SLUG</th>
                <th className="py-4 px-4 min-w-[190px]">TEMPLATE</th>
                <th className="py-4 px-4 text-center">USER</th>
                <th className="py-4 px-4 text-center">STATUS</th>
                <th className="py-4 px-4 text-center">FRONTLINE</th>
                <th className="py-4 px-5 text-right">AKSI</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
              {branches.map(branch => {
                const draft = rowDrafts[branch.id] || {
                  name: branch.name,
                  sortOrder: branch.sortOrder,
                  slug: branch.slug,
                  template: branch.template,
                  isActive: branch.isActive,
                  isFrontlineActive: branch.isFrontlineActive
                };
                const userCount = branchStore.getUsersCountForBranch(branch.id, usersList);
                const isSelectedOrigin = selectedOriginBranchId === branch.id;

                return (
                  <tr
                    key={branch.id}
                    className={`transition ${
                      isSelectedOrigin
                        ? 'bg-blue-50/40 dark:bg-blue-950/20'
                        : 'hover:bg-slate-50/60 dark:hover:bg-slate-800/30'
                    }`}
                  >
                    {/* CABANG COLUMN */}
                    <td className="py-5 px-5 align-top">
                      <div className="flex items-center gap-2.5">
                        <input
                          type="text"
                          value={draft.name}
                          onChange={e =>
                            setRowDrafts(prev => ({
                              ...prev,
                              [branch.id]: { ...draft, name: e.target.value }
                            }))
                          }
                          className="flex-1 px-3.5 py-2.5 rounded-xl bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 font-bold text-slate-900 dark:text-white text-xs focus:outline-none focus:border-blue-500"
                        />
                        <input
                          type="number"
                          value={draft.sortOrder}
                          onChange={e =>
                            setRowDrafts(prev => ({
                              ...prev,
                              [branch.id]: { ...draft, sortOrder: Number(e.target.value) }
                            }))
                          }
                          className="w-24 px-3 py-2.5 rounded-xl bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 font-bold text-slate-900 dark:text-white text-xs focus:outline-none focus:border-blue-500"
                        />
                      </div>

                      <div className="mt-3 space-y-2">
                        <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 dark:text-slate-300 cursor-pointer select-none">
                          <input
                            type="checkbox"
                            checked={draft.isActive}
                            onChange={e =>
                              setRowDrafts(prev => ({
                                ...prev,
                                [branch.id]: { ...draft, isActive: e.target.checked }
                              }))
                            }
                            className="w-4 h-4 rounded text-blue-600 cursor-pointer"
                          />
                          <span>Cabang aktif</span>
                        </label>

                        <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 dark:text-slate-300 cursor-pointer select-none">
                          <input
                            type="checkbox"
                            checked={draft.isFrontlineActive}
                            onChange={e =>
                              setRowDrafts(prev => ({
                                ...prev,
                                [branch.id]: { ...draft, isFrontlineActive: e.target.checked }
                              }))
                            }
                            className="w-4 h-4 rounded text-blue-600 cursor-pointer"
                          />
                          <span>Frontline aktif</span>
                        </label>
                      </div>
                    </td>

                    {/* SLUG COLUMN */}
                    <td className="py-5 px-4 align-top">
                      <input
                        type="text"
                        value={draft.slug}
                        onChange={e =>
                          setRowDrafts(prev => ({
                            ...prev,
                            [branch.id]: { ...draft, slug: e.target.value }
                          }))
                        }
                        className="w-full px-3.5 py-2.5 rounded-xl bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 font-bold text-slate-800 dark:text-slate-200 text-xs focus:outline-none focus:border-blue-500"
                      />
                    </td>

                    {/* TEMPLATE COLUMN */}
                    <td className="py-5 px-4 align-top">
                      <select
                        value={draft.template}
                        onChange={e =>
                          setRowDrafts(prev => ({
                            ...prev,
                            [branch.id]: {
                              ...draft,
                              template: e.target.value as BranchRecord['template']
                            }
                          }))
                        }
                        className="w-full px-3.5 py-2.5 rounded-xl bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 font-bold text-slate-800 dark:text-slate-200 text-xs focus:outline-none focus:border-blue-500 cursor-pointer"
                      >
                        <option value="Classic / Default">Classic / Default</option>
                        <option value="Modern B2B">Modern B2B</option>
                        <option value="Enterprise WMS">Enterprise WMS</option>
                      </select>
                    </td>

                    {/* USER COUNT COLUMN (Integrated with User Management Akses Cabang) */}
                    <td className="py-5 px-4 align-top text-center">
                      <span
                        className="inline-block mt-2 font-black text-sm text-slate-900 dark:text-white"
                        title={`Total akun di Manajemen User yang memiliki Akses Cabang ${branch.name}`}
                      >
                        {userCount}
                      </span>
                    </td>

                    {/* STATUS COLUMN */}
                    <td className="py-5 px-4 align-top text-center">
                      <span
                        className={`inline-block mt-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${
                          draft.isActive
                            ? 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300'
                            : 'bg-rose-100 dark:bg-rose-500/20 text-rose-700 dark:text-rose-300'
                        }`}
                      >
                        {draft.isActive ? 'AKTIF' : 'NONAKTIF'}
                      </span>
                    </td>

                    {/* FRONTLINE COLUMN */}
                    <td className="py-5 px-4 align-top text-center">
                      <span
                        className={`inline-block mt-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${
                          draft.isFrontlineActive
                            ? 'bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-300'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
                        }`}
                      >
                        {draft.isFrontlineActive ? 'LANDING AKTIF' : 'LANDING OFF'}
                      </span>
                    </td>

                    {/* AKSI COLUMN */}
                    <td className="py-5 px-5 align-top text-right">
                      <div className="inline-flex flex-col gap-2 min-w-[96px]">
                        <button
                          type="button"
                          onClick={() => handleUpdateRow(branch.id)}
                          className="w-full py-2 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-extrabold text-xs transition cursor-pointer shadow-xs"
                        >
                          Update
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteRow(branch)}
                          className="w-full py-2 px-4 rounded-xl bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/50 dark:hover:bg-rose-900/60 text-rose-600 dark:text-rose-300 border border-rose-200 dark:border-rose-800/50 font-extrabold text-xs transition cursor-pointer"
                        >
                          Hapus
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* POPUP NOTIFICATION MODAL */}
      {popupModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-md w-full p-6 text-center space-y-4 shadow-2xl">
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-500 flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <h4 className="text-base font-black text-slate-900 dark:text-white">
                {popupModal.title}
              </h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                {popupModal.message}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setPopupModal(null)}
              className="w-full py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs cursor-pointer transition"
            >
              Oke, Mengerti
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
