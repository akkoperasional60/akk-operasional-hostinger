import React, { useMemo, useState } from 'react';
import { Database, TrendingUp, AlertTriangle, Package, CheckCircle2, Download, Trash2, Filter, ClipboardList, Map as MapIcon } from 'lucide-react';
import * as XLSX from 'xlsx';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { DeliveryHeatmap } from '../DeliveryHeatmap';

const MOCK_STOCK_DATA = [
  { id: 1, item: 'Karton Box A1', stock: 500, physicalStock: 495, reorderPoint: 200, dailyUsage: 50, status: 'Aman', category: 'Packaging' },
  { id: 2, item: 'Karton Box B2', stock: 150, physicalStock: 150, reorderPoint: 200, dailyUsage: 80, status: 'Kritis', category: 'Packaging' },
  { id: 3, item: 'Lakban Coklat', stock: 300, physicalStock: 280, reorderPoint: 500, dailyUsage: 20, status: 'Pesan Ulang', category: 'Bahan Tambahan' },
];

// Generate 30 days of mock trend data
const MOCK_TREND_DATA = Array.from({ length: 30 }, (_, i) => ({
  day: `Hari ${i + 1}`,
  stok: Math.floor(Math.random() * 400) + 100,
}));

export const PurchasingStockAnalysis: React.FC<{ tab: 'overview' | 'forecast' }> = ({ tab }) => {
  const [dataCleaned, setDataCleaned] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState('Semua');

  const categories = useMemo(() => ['Semua', ...Array.from(new Set(MOCK_STOCK_DATA.map(i => i.category)))], []);

  const filteredData = useMemo(() => {
    return categoryFilter === 'Semua' 
      ? MOCK_STOCK_DATA 
      : MOCK_STOCK_DATA.filter(i => i.category === categoryFilter);
  }, [categoryFilter]);
  
  const getDaysRemaining = (stock: number, usage: number) => Math.floor(stock / usage);
  const isHighVelocity = (usage: number) => usage > 50;

  const criticalItems = useMemo(() => {
    return MOCK_STOCK_DATA.filter(item => 
      item.stock < item.reorderPoint && isHighVelocity(item.dailyUsage)
    );
  }, []);
  
  const discrepancyReport = useMemo(() => {
    return MOCK_STOCK_DATA.map(item => ({
      ...item,
      discrepancy: item.physicalStock - item.stock
    })).filter(item => item.discrepancy !== 0);
  }, []);

  const exportToExcel = () => {
    const worksheet = XLSX.utils.json_to_sheet(filteredData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Analisa Stok");
    XLSX.writeFile(workbook, "Analisa_Stok_Purchasing.xlsx");
  };

  const handleDataCleaning = () => {
    if (confirm("Apakah Anda yakin ingin menghapus log historis stok yang berusia lebih dari 1 tahun? Tindakan ini tidak dapat dibatalkan.")) {
      setDataCleaned(true);
      alert("Data historis berhasil dibersihkan.");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-bold text-white">
          {tab === 'overview' ? 'Ringkasan Stok' : 'Prediksi Kebutuhan'}
        </h2>
        {tab === 'overview' && (
          <div className="flex gap-2">
            <button 
              onClick={handleDataCleaning}
              className="bg-rose-900/20 hover:bg-rose-900/40 text-rose-400 border border-rose-900/50 px-4 py-2 rounded-lg font-bold flex items-center gap-2 text-sm transition"
            >
              <Trash2 className="w-4 h-4" /> Bersihkan Data Historis
            </button>
            <button 
              onClick={exportToExcel}
              className="bg-slate-800 hover:bg-slate-700 text-white px-4 py-2 rounded-lg font-bold flex items-center gap-2 text-sm transition"
            >
              <Download className="w-4 h-4" /> Ekspor Excel
            </button>
          </div>
        )}
      </div>

      {dataCleaned && (
        <div className="bg-emerald-900/20 border border-emerald-800 text-emerald-400 p-4 rounded-lg text-sm">
          Pembersihan data historis berhasil dilakukan.
        </div>
      )}

      {criticalItems.length > 0 && (
        <div className="bg-rose-900/10 border border-rose-800 p-4 rounded-xl">
          <div className="flex items-center gap-2 mb-2 text-rose-400 font-bold">
            <AlertTriangle className="w-5 h-5" />
            <span>Alert Stok Kritis (Produk Laju Tinggi)</span>
          </div>
          <p className="text-sm text-rose-300">
            Segera lakukan pemesanan untuk item berikut agar tidak terjadi kekosongan stok: 
            {criticalItems.map(item => item.item).join(', ')}
          </p>
        </div>
      )}
      
      {tab === 'overview' && (
        <div className="space-y-6">
          {/* Discrepancy Report */}
          <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl">
            <div className="flex items-center gap-3 mb-4 text-white font-bold">
              <ClipboardList className="w-5 h-5 text-indigo-400" />
              <h3>Laporan Selisih Stok (Mingguan)</h3>
            </div>
            {discrepancyReport.length > 0 ? (
              <div className="space-y-2">
                {discrepancyReport.map(item => (
                  <div key={item.id} className="flex justify-between items-center bg-slate-800 p-3 rounded-lg text-sm">
                    <span className="font-bold text-white">{item.item}</span>
                    <span className={`font-bold ${item.discrepancy > 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {item.discrepancy > 0 ? '+' : ''}{item.discrepancy}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-slate-400">Tidak ada selisih stok ditemukan.</p>
            )}
          </div>

          <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl">
            <div className="flex items-center gap-3 mb-4 text-white font-bold">
              <MapIcon className="w-5 h-5 text-indigo-400" />
              <h3>Heatmap Kepadatan Pengiriman</h3>
            </div>
            <DeliveryHeatmap />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl">
              <div className="flex items-center gap-3 mb-2">
                <Package className="text-indigo-400" />
                <h3 className="text-slate-400 text-xs font-semibold uppercase">Stok Rendah</h3>
              </div>
              <div className="text-2xl font-black text-white">2 Item</div>
            </div>
            <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl">
              <div className="flex items-center gap-3 mb-2">
                <AlertTriangle className="text-rose-400" />
                <h3 className="text-slate-400 text-xs font-semibold uppercase">Kritis</h3>
              </div>
              <div className="text-2xl font-black text-white">1 Item</div>
            </div>
            <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl">
              <div className="flex items-center gap-3 mb-2">
                <CheckCircle2 className="text-emerald-400" />
                <h3 className="text-slate-400 text-xs font-semibold uppercase">Aman</h3>
              </div>
              <div className="text-2xl font-black text-white">1 Item</div>
            </div>
          </div>
          
          <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl">
            <h3 className="text-lg font-bold text-white mb-4">Tren Stok (30 Hari Terakhir)</h3>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={MOCK_TREND_DATA}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                  <XAxis dataKey="day" stroke="#94a3b8" fontSize={10} />
                  <YAxis stroke="#94a3b8" fontSize={10} />
                  <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '8px' }} />
                  <Area type="monotone" dataKey="stok" stroke="#6366f1" fill="#6366f1" fillOpacity={0.2} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold text-white">Daftar Stok</h3>
              <div className="flex items-center gap-2">
                <Filter className="w-4 h-4 text-slate-400" />
                <select 
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                  className="bg-slate-800 text-white text-sm rounded-lg px-3 py-1.5 focus:outline-none"
                >
                  {categories.map((cat, index) => <option key={`cat-${index}`} value={cat}>{cat}</option>)}
                </select>
              </div>
            </div>
            <div className="space-y-2">
              {filteredData.map(item => {
                const daysRemaining = getDaysRemaining(item.stock, item.dailyUsage);
                const highVelocity = isHighVelocity(item.dailyUsage);
                return (
                  <div key={item.id} className="flex justify-between items-center bg-slate-800 p-4 rounded-lg text-sm border-l-4 border-l-transparent">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-white">{item.item}</span>
                        {highVelocity && <span className="bg-amber-500/20 text-amber-400 text-[10px] px-1.5 py-0.5 rounded uppercase">Laju Tinggi</span>}
                      </div>
                      <span className="text-slate-400 text-xs">Kategori: {item.category} | Sisa: {daysRemaining} hari</span>
                    </div>
                    <span className={`px-2 py-1 rounded text-xs font-semibold ${item.status === 'Aman' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'}`}>
                      {item.status} (Stok: {item.stock})
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {tab === 'forecast' && (
        <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl text-center text-slate-400">
          <TrendingUp className="w-12 h-12 mx-auto mb-4 text-indigo-400" />
          <p>Prediksi kebutuhan stok akan ditampilkan di sini.</p>
        </div>
      )}
    </div>
  );
};
