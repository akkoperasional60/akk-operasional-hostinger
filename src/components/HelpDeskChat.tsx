import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  MessageSquare, X, Send, Bot, Trash2, Sparkles, Truck, FileText, Headphones, Ship, Calendar, 
  Wrench, Package, AlertTriangle, Users, RotateCcw, MapPin, Fuel, Globe, Plus, Radio, Clock, 
  History, Award, FileSpreadsheet, Timer, TrendingUp, ShoppingBag, FileSearch, CheckCircle2,
  Settings, Edit3, Save, Check, RefreshCw, Sliders
} from 'lucide-react';
import { UserProfile } from '../types';
import { logisticsStore } from '../services/store';

export interface FAQItem {
  id: string;
  keyword: string;
  question: string;
  answer: string;
  category: string;
  isActive: boolean;
}

export const DEFAULT_FAQ_ITEMS: FAQItem[] = [
  {
    id: 'faq-1',
    keyword: 'sop',
    question: 'SOP Standar Pengiriman',
    answer: 'SOP Pengiriman PT AKK: 1) Cek fisik & K3 armada sebelum jalan. 2) Bawa Surat Jalan resmi. 3) Wajib istirahat 24 jam setelah rute >300 km.',
    category: 'Operasional',
    isActive: true,
  },
  {
    id: 'faq-2',
    keyword: 'kir',
    question: 'Pengurusan Uji KIR & STNK',
    answer: 'Uji KIR Dishub dilakukan berkala setiap 6 bulan. STNK diperbarui tahunan via Samsat Banyuwangi dengan koordinasi Tim Adm. Logistik.',
    category: 'Armada',
    isActive: true,
  },
  {
    id: 'faq-3',
    keyword: 'bbm',
    question: 'Klaim Uang Jalan & BBM',
    answer: 'Klaim BBM BioSolar dihitung berdasarkan rasio: Pick Up 1:10, Engkel 1:7, Double 1:5. Struk SPBU asli wajib dilampirkan.',
    category: 'BBM',
    isActive: true,
  },
  {
    id: 'faq-4',
    keyword: 'sparepart',
    question: 'Pengajuan Sparepart Kritis',
    answer: 'Pengajuan sparepart (kampas rem, ban, oli) diajukan via menu Manajemen Sparepart dan disetujui oleh Kepala Bengkel AKK.',
    category: 'Sparepart',
    isActive: true,
  },
  {
    id: 'faq-5',
    keyword: 'kontak',
    question: 'Kontak Darurat Admin AKK',
    answer: 'Piket Operasional Banyuwangi DC: 0812-1351-3590 | Email: admin.logistik@akk-packaging.co.id.',
    category: 'Bantuan',
    isActive: true,
  }
];

export interface QuickReply {
  id: string;
  label: string;
  prompt: string;
  icon?: React.ReactNode;
}

export const DEFAULT_QUICK_REPLIES: QuickReply[] = [
  { id: 'status', label: 'Cek Status Muat', prompt: 'Bagaimana cara cek status muat dan progres pengiriman hari ini?', icon: <Truck size={12} className="text-amber-400" /> },
  { id: 'armada', label: 'Info Armada', prompt: 'Berapa jumlah armada truk yang siap jalan dan dalam perawatan?', icon: <Truck size={12} className="text-blue-400" /> },
  { id: 'sop', label: 'SOP Pengiriman', prompt: 'Bisa jelaskan SOP standar pengangkutan barang dan surat jalan?', icon: <FileText size={12} className="text-emerald-400" /> },
  { id: 'kapal', label: 'Tiket Penyeberangan', prompt: 'Bagaimana info verifikasi tiket kapal penyeberangan Ketapang-Gilimanuk?', icon: <Ship size={12} className="text-purple-400" /> },
  { id: 'admin', label: 'Hubungi Admin', prompt: 'Saya butuh kontak admin operasional atau piket darurat PT AKK.', icon: <Headphones size={12} className="text-rose-400" /> },
];

const getTabContextName = (tab?: string): string => {
  switch (tab) {
    case 'spareparts': return 'Stok & Sparepart';
    case 'fleets': return 'Armada & Kru Supir';
    case 'schedules': return 'Jadwal Pengiriman';
    case 'fuel_efficiency': return 'Efisiensi BBM';
    case 'customer_map': return 'Pemetaan Toko';
    case 'fleet_forms': return 'Formulir Armada';
    case 'crew_history': return 'Audit SLA & Kru';
    case 'tracking_eval': return 'Evaluasi Muat (Excel)';
    case 'users': return 'Manajemen Pengguna';
    default:
      if (tab?.startsWith('sales_')) return 'Sales & Penjualan';
      if (tab?.startsWith('purchasing_')) return 'Purchasing';
      return 'Operasional PT AKK';
  }
};

const getTabQuickReplies = (tab?: string, lastMessage?: string): QuickReply[] => {
  if (tab === 'spareparts') {
    return [
      { id: 'sp_cek', label: 'Cek Sparepart', prompt: 'Bagaimana status stok sparepart dan pemakaian komponen kendaraan saat ini?', icon: <Wrench size={12} className="text-amber-400" /> },
      { id: 'sp_pengajuan', label: 'Pengajuan Sparepart', prompt: 'Bagaimana prosedur pengajuan pembelian sparepart baru yang habis?', icon: <Package size={12} className="text-blue-400" /> },
      { id: 'sp_kritis', label: 'Stok Kritis', prompt: 'Komponen sparepart apa saja yang masuk kategori batas stok kritis/minimal?', icon: <AlertTriangle size={12} className="text-rose-400" /> },
      { id: 'sp_servis', label: 'Armada Servis', prompt: 'Truk mana yang saat ini sedang dalam status perbaikan/servis di bengkel?', icon: <Truck size={12} className="text-emerald-400" /> },
    ];
  }

  if (tab === 'fleets') {
    return [
      { id: 'fl_status', label: 'Daftar Armada', prompt: 'Berapa total armada truk AKK yang siap beroperasi vs dalam perbaikan?', icon: <Truck size={12} className="text-blue-400" /> },
      { id: 'fl_kru', label: 'Kru & Sopir', prompt: 'Bagaimana status ketersediaan sopir dan helper yang aktif hari ini?', icon: <Users size={12} className="text-emerald-400" /> },
      { id: 'fl_kir', label: 'Masa Berlaku KIR/STNK', prompt: 'Bagaimana cara mengecek dokumen KIR dan STNK armada yang akan kadaluarsa?', icon: <FileText size={12} className="text-amber-400" /> },
      { id: 'fl_kendala', label: 'Laporan Kendala', prompt: 'Bagaimana alur pelaporan kendala teknis armada di jalan?', icon: <AlertTriangle size={12} className="text-rose-400" /> },
    ];
  }

  if (tab === 'schedules') {
    return [
      { id: 'sch_muat', label: 'Cek Jadwal Muat', prompt: 'Bagaimana status jadwal muat dan pengiriman barang minggu ini?', icon: <Calendar size={12} className="text-amber-400" /> },
      { id: 'sch_smart', label: 'Smart Fill Jadwal', prompt: 'Bagaimana cara kerja Smart Fill otomatisasi jadwal pengiriman?', icon: <Sparkles size={12} className="text-emerald-400" /> },
      { id: 'sch_jeda', label: 'Rotasi Jeda 24H', prompt: 'Bagaimana aturan rotasi jeda istirahat 24 jam untuk pengiriman luar kota?', icon: <RotateCcw size={12} className="text-blue-400" /> },
      { id: 'sch_rute', label: 'Daftar Rute Aktif', prompt: 'Mana saja rute pengiriman utama dan klaster yang dijadwalkan hari ini?', icon: <MapPin size={12} className="text-purple-400" /> },
    ];
  }

  if (tab === 'fuel_efficiency') {
    return [
      { id: 'fe_rasio', label: 'Cek Efisiensi BBM', prompt: 'Bagaimana rata-rata rasio konsumsi BBM (km/liter) per armada truk?', icon: <Fuel size={12} className="text-amber-400" /> },
      { id: 'fe_uj', label: 'Klaim Uang Jalan', prompt: 'Bagaimana prosedur klaim BBM dan uang jalan operasional sopir?', icon: <FileText size={12} className="text-emerald-400" /> },
      { id: 'fe_audit', label: 'Audit Pemborosan BBM', prompt: 'Truk mana yang tercatat memiliki indikasi pemborosan BBM?', icon: <AlertTriangle size={12} className="text-rose-400" /> },
      { id: 'fe_alokasi', label: 'Standar Jarak Rute', prompt: 'Berapa standar alokasi liter BBM untuk rute Banyuwangi-Denpasar?', icon: <Truck size={12} className="text-blue-400" /> },
    ];
  }

  if (tab === 'customer_map') {
    return [
      { id: 'cm_sebaran', label: 'Cek Sebaran Toko', prompt: 'Berapa total toko retail dan distribution hub yang terdaftar di peta?', icon: <MapPin size={12} className="text-amber-400" /> },
      { id: 'cm_luar', label: 'Toko Luar Pulau', prompt: 'Mana saja jaringan toko retail di area luar Pulau Jawa/Bali?', icon: <Globe size={12} className="text-emerald-400" /> },
      { id: 'cm_rute', label: 'Rute Distribusi', prompt: 'Bagaimana visualisasi rute distribusi dari Gudang Banyuwangi DC?', icon: <Truck size={12} className="text-blue-400" /> },
      { id: 'cm_tambah', label: 'Tambah Toko Baru', prompt: 'Bagaimana cara menginput data toko retail pelanggan baru ke peta?', icon: <Plus size={12} className="text-purple-400" /> },
    ];
  }

  if (tab === 'fleet_forms') {
    return [
      { id: 'ff_sj', label: 'Formulir Surat Jalan', prompt: 'Bagaimana cara pengisian Formulir Surat Jalan & Checklist Armada?', icon: <FileText size={12} className="text-emerald-400" /> },
      { id: 'ff_uj', label: 'Form Uang Jalan', prompt: 'Bagaimana alur persetujuan formulir pengajuan uang jalan operasional?', icon: <FileText size={12} className="text-amber-400" /> },
      { id: 'ff_spk', label: 'Form Perbaikan Bengkel', prompt: 'Bagaimana mengunduh atau mengisi Form Perintah Kerja Bengkel (SPK)?', icon: <Wrench size={12} className="text-blue-400" /> },
      { id: 'ff_arsip', label: 'Cek Riwayat Form', prompt: 'Di mana melihat arsip formulir operasional yang telah disetujui?', icon: <History size={12} className="text-purple-400" /> },
    ];
  }

  if (tab === 'crew_history') {
    return [
      { id: 'ch_sla', label: 'Audit SLA Kru', prompt: 'Bagaimana skor ketercapaian SLA pengiriman kru sopir & helper bulan ini?', icon: <Award size={12} className="text-amber-400" /> },
      { id: 'ch_riwayat', label: 'Riwayat Pengiriman', prompt: 'Bagaimana cara mencari riwayat pengiriman masa lalu berdasarkan nama sopir?', icon: <History size={12} className="text-blue-400" /> },
      { id: 'ch_terbaik', label: 'Kinerja Kru Terbaik', prompt: 'Siapa kru driver dengan catatan pengiriman tercepat dan tanpa komplain?', icon: <Users size={12} className="text-emerald-400" /> },
      { id: 'ch_terlambat', label: 'Laporan Terlambat', prompt: 'Berapa total kejadian keterlambatan pengiriman dalam 30 hari terakhir?', icon: <AlertTriangle size={12} className="text-rose-400" /> },
    ];
  }

  if (tab === 'tracking_eval') {
    return [
      { id: 'te_eval', label: 'Evaluasi Excel', prompt: 'Bagaimana cara mengunggah dan menganalisis file Excel tracking muat-bongkar?', icon: <FileSpreadsheet size={12} className="text-emerald-400" /> },
      { id: 'te_durasi', label: 'Laporan Durasi Muat', prompt: 'Berapa rata-rata waktu yang dibutuhkan dari truk masuk hingga selesai muat?', icon: <Clock size={12} className="text-amber-400" /> },
      { id: 'te_deviasi', label: 'Deviasi Waktu', prompt: 'Bagaimana mengidentifikasi deviasi waktu bongkar muat yang melebihi standar?', icon: <AlertTriangle size={12} className="text-rose-400" /> },
    ];
  }

  if (tab && tab.startsWith('sales_')) {
    return [
      { id: 'sl_sla', label: 'SLA Admin Sales', prompt: 'Bagaimana capaian SLA pelayanan admin penjualan hari ini?', icon: <Award size={12} className="text-amber-400" /> },
      { id: 'sl_durasi', label: 'Durasi Muat Real-time', prompt: 'Berapa lama durasi rata-rata muat barang pesanan sales saat ini?', icon: <Timer size={12} className="text-blue-400" /> },
      { id: 'sl_kpi', label: 'Omset & KPI Sales', prompt: 'Bagaimana ringkasan KPI dan pencapaian omset admin penjualan?', icon: <TrendingUp size={12} className="text-emerald-400" /> },
      { id: 'sl_jadwal', label: 'Jadwal Produksi Kirim', prompt: 'Bagaimana koordinasi jadwal kirim antara admin sales dan gudang?', icon: <Calendar size={12} className="text-purple-400" /> },
    ];
  }

  if (tab && tab.startsWith('purchasing_')) {
    return [
      { id: 'po_analisa', label: 'Analisa Stok Material', prompt: 'Bagaimana prediksi kebutuhan stok bahan baku dan produk kemasan?', icon: <Package size={12} className="text-amber-400" /> },
      { id: 'po_pengajuan', label: 'PO Pembelian Baru', prompt: 'Bagaimana status pengajuan Purchase Order (PO) pembelian bahan baku?', icon: <ShoppingBag size={12} className="text-blue-400" /> },
      { id: 'po_kritis', label: 'Bahan Baku Kritis', prompt: 'Item bahan baku apa saja yang stoknya di bawah batas buffer minimum?', icon: <AlertTriangle size={12} className="text-rose-400" /> },
    ];
  }

  if (lastMessage) {
    const lower = lastMessage.toLowerCase();
    if (lower.includes('armada') || lower.includes('truk') || lower.includes('driver')) {
      return [
        { id: 'gps', label: 'Cek GPS Armada', prompt: 'Bagaimana cara memantau posisi GPS armada Tracksolid?', icon: <Truck size={12} className="text-blue-400" /> },
        { id: 'driver', label: 'Jadwal Sopir', prompt: 'Siapa saja sopir dan helper yang bertugas hari ini?', icon: <Users size={12} className="text-emerald-400" /> },
        { id: 'bbm', label: 'Formulir BBM', prompt: 'Bagaimana cara menginput klaim uang jalan dan BBM armada?', icon: <Fuel size={12} className="text-amber-400" /> },
        { id: 'admin', label: 'Hubungi Admin', prompt: 'Saya butuh kontak admin operasional PT AKK.', icon: <Headphones size={12} className="text-rose-400" /> },
      ];
    }
  }

  return DEFAULT_QUICK_REPLIES;
};

// Admin ChatSettings Sub-Component
interface ChatSettingsProps {
  faqList: FAQItem[];
  onSaveFAQ: (newList: FAQItem[]) => void;
  onClose: () => void;
}

const ChatSettingsModal: React.FC<ChatSettingsProps> = ({ faqList, onSaveFAQ, onClose }) => {
  const [items, setItems] = useState<FAQItem[]>(faqList);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newKeyword, setNewKeyword] = useState('');
  const [newQuestion, setNewQuestion] = useState('');
  const [newAnswer, setNewAnswer] = useState('');
  const [newCategory, setNewCategory] = useState('Operasional');
  const [isSuccessMessage, setIsSuccessMessage] = useState(false);

  const handleToggleActive = (id: string) => {
    setItems(prev => prev.map(item => item.id === id ? { ...item, isActive: !item.isActive } : item));
  };

  const handleDelete = (id: string) => {
    setItems(prev => prev.filter(item => item.id !== id));
  };

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newKeyword.trim() || !newAnswer.trim()) return;

    const newItem: FAQItem = {
      id: `faq-custom-${Date.now()}`,
      keyword: newKeyword.trim().toLowerCase(),
      question: newQuestion.trim() || newKeyword.trim(),
      answer: newAnswer.trim(),
      category: newCategory,
      isActive: true,
    };

    setItems(prev => [newItem, ...prev]);
    setNewKeyword('');
    setNewQuestion('');
    setNewAnswer('');
  };

  const handleSaveAll = () => {
    onSaveFAQ(items);
    setIsSuccessMessage(true);
    setTimeout(() => setIsSuccessMessage(false), 2000);
  };

  const handleResetDefault = () => {
    if (window.confirm('Kembalikan daftar FAQ ke pengaturan awal?')) {
      setItems(DEFAULT_FAQ_ITEMS);
      onSaveFAQ(DEFAULT_FAQ_ITEMS);
    }
  };

  return (
    <div className="absolute inset-0 z-50 bg-slate-900/95 backdrop-blur-sm p-4 flex flex-col overflow-hidden text-slate-100">
      <div className="flex items-center justify-between pb-3 border-b border-slate-700">
        <div className="flex items-center gap-2">
          <Settings size={18} className="text-amber-400" />
          <div>
            <h4 className="font-bold text-sm text-white leading-none">Pengaturan FAQ Auto-Reply</h4>
            <span className="text-[10px] text-amber-400 font-semibold">Akses Admin Operasional</span>
          </div>
        </div>
        <button onClick={onClose} className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800"><X size={18} /></button>
      </div>

      <div className="flex-1 overflow-y-auto py-3 space-y-4 pr-1">
        {/* Form Tambah FAQ Baru */}
        <form onSubmit={handleAdd} className="bg-slate-800/80 p-3 rounded-xl border border-slate-700 space-y-2">
          <span className="text-[11px] font-bold text-amber-300 uppercase tracking-wider flex items-center gap-1">
            <Plus size={12} />
            Tambah Jawaban Auto-Reply Baru
          </span>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] text-slate-400 font-medium">Kata Kunci (Keyword)</label>
              <input 
                value={newKeyword}
                onChange={e => setNewKeyword(e.target.value)}
                placeholder="misal: oli, rem, jam kerja"
                className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-amber-400"
                required
              />
            </div>
            <div>
              <label className="text-[10px] text-slate-400 font-medium">Kategori</label>
              <select
                value={newCategory}
                onChange={e => setNewCategory(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-amber-400"
              >
                <option value="Operasional">Operasional</option>
                <option value="Armada">Armada</option>
                <option value="BBM">BBM & Uang Jalan</option>
                <option value="Sparepart">Sparepart</option>
                <option value="Bantuan">Bantuan Admin</option>
              </select>
            </div>
          </div>

          <div>
            <label className="text-[10px] text-slate-400 font-medium">Judul Pertanyaan (Opsional)</label>
            <input 
              value={newQuestion}
              onChange={e => setNewQuestion(e.target.value)}
              placeholder="misal: Prosedur Penggantian Oli Mesin"
              className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-amber-400"
            />
          </div>

          <div>
            <label className="text-[10px] text-slate-400 font-medium">Isi Jawaban Otomatis</label>
            <textarea 
              value={newAnswer}
              onChange={e => setNewAnswer(e.target.value)}
              rows={2}
              placeholder="Tuliskan balasan lengkap yang akan dikirim otomatis saat pengguna bertanya..."
              className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-amber-400 resize-none"
              required
            />
          </div>

          <button 
            type="submit" 
            className="w-full bg-amber-600 hover:bg-amber-500 text-white font-bold py-1.5 rounded text-xs transition flex items-center justify-center gap-1 cursor-pointer"
          >
            <Plus size={14} />
            <span>Simpan ke Daftar FAQ</span>
          </button>
        </form>

        {/* Daftar FAQ Terdaftar */}
        <div className="space-y-2">
          <div className="flex items-center justify-between px-1">
            <span className="text-[11px] font-bold text-slate-300">Daftar FAQ Aktif ({items.length})</span>
            <button 
              onClick={handleResetDefault}
              className="text-[10px] text-slate-400 hover:text-amber-300 flex items-center gap-1 cursor-pointer"
            >
              <RefreshCw size={10} />
              <span>Reset Default</span>
            </button>
          </div>

          {items.map((item) => (
            <div key={item.id} className="bg-slate-800 p-2.5 rounded-lg border border-slate-700/80 space-y-1">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] bg-amber-950 text-amber-300 px-2 py-0.5 rounded font-mono font-bold border border-amber-500/30">
                    #{item.keyword}
                  </span>
                  <span className="text-[10px] bg-slate-700 text-slate-300 px-1.5 py-0.5 rounded">
                    {item.category}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <button 
                    onClick={() => handleToggleActive(item.id)}
                    className={`text-[10px] font-bold px-2 py-0.5 rounded transition ${
                      item.isActive ? 'bg-emerald-900/60 text-emerald-300 border border-emerald-500/40' : 'bg-slate-700 text-slate-400'
                    }`}
                  >
                    {item.isActive ? 'Aktif' : 'Non-aktif'}
                  </button>
                  <button 
                    onClick={() => handleDelete(item.id)}
                    className="text-slate-400 hover:text-rose-400 transition"
                    title="Hapus FAQ"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>

              <p className="text-xs font-semibold text-white">{item.question}</p>
              <p className="text-[11px] text-slate-300 bg-slate-900/60 p-2 rounded border border-slate-800 leading-relaxed">
                {item.answer}
              </p>
            </div>
          ))}
        </div>
      </div>

      <div className="pt-2 border-t border-slate-700 flex gap-2">
        <button 
          onClick={handleSaveAll}
          className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-2 rounded-lg text-xs transition flex items-center justify-center gap-1.5 cursor-pointer shadow-md"
        >
          {isSuccessMessage ? <Check size={16} /> : <Save size={16} />}
          <span>{isSuccessMessage ? 'Tersimpan di LocalStorage!' : 'Simpan Perubahan FAQ'}</span>
        </button>
        <button 
          onClick={onClose}
          className="px-3 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold py-2 rounded-lg text-xs transition cursor-pointer"
        >
          Tutup
        </button>
      </div>
    </div>
  );
};

interface HelpDeskChatProps {
  activeTab?: string;
  user?: UserProfile;
}

export const HelpDeskChat: React.FC<HelpDeskChatProps> = ({ activeTab, user }) => {
  if (activeTab === 'driver_portal') {
    return null;
  }
  const [isOpen, setIsOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [messages, setMessages] = useState<{ role: 'user' | 'assistant'; content: string; isSummary?: boolean }[]>([]);
  const [hasGreeted, setHasGreeted] = useState(false);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [recentQueries, setRecentQueries] = useState<string[]>([]);
  const [faqList, setFaqList] = useState<FAQItem[]>(() => {
    try {
      const saved = localStorage.getItem('akk_faq_answers_custom');
      if (saved) return JSON.parse(saved);
    } catch {}
    return DEFAULT_FAQ_ITEMS;
  });

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Determine if user has Admin privileges
  const currentUser = user || logisticsStore.getCurrentUser();
  const isAdmin = currentUser.role === 'super_admin' || currentUser.role.includes('admin') || currentUser.role === 'spv_logistik';

  const greeting = 'Halo! Saya asisten virtual operasional PT AKK. Saya bisa membantu Anda terkait SOP, formulir operasional, atau status armada. Apa yang bisa saya bantu?';

  useEffect(() => {
    if (isOpen && !hasGreeted) {
      setMessages([{ role: 'assistant', content: greeting }]);
      setHasGreeted(true);
    }
  }, [isOpen, hasGreeted]);

  useEffect(() => {
    const saved = sessionStorage.getItem('akk_chat_recent');
    if (saved) setRecentQueries(JSON.parse(saved));
  }, []);

  useEffect(() => {
    const savedMessages = sessionStorage.getItem('akk_chat_history');
    if (savedMessages) {
      setMessages(JSON.parse(savedMessages));
    }
  }, []);

  useEffect(() => {
    sessionStorage.setItem('akk_chat_history', JSON.stringify(messages));
  }, [messages]);

  const handleSaveFAQ = (newList: FAQItem[]) => {
    setFaqList(newList);
    try {
      localStorage.setItem('akk_faq_answers_custom', JSON.stringify(newList));
    } catch (e) {
      console.error('Failed to save custom FAQ to localStorage:', e);
    }
  };

  // Contextual Smart Quick Replies based on the active tab and latest assistant message
  const smartQuickReplies = useMemo(() => {
    const lastAssistantMsg = [...messages].reverse().find(m => m.role === 'assistant')?.content;
    return getTabQuickReplies(activeTab, lastAssistantMsg);
  }, [activeTab, messages]);

  const activeContextName = useMemo(() => {
    return getTabContextName(activeTab);
  }, [activeTab]);

  const clearHistory = () => {
    setMessages([{ role: 'assistant', content: greeting }]);
    sessionStorage.removeItem('akk_chat_history');
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(scrollToBottom, [messages]);

  const saveQuery = (query: string) => {
    const newQueries = [query, ...recentQueries.filter(q => q !== query)].slice(0, 5);
    setRecentQueries(newQueries);
    sessionStorage.setItem('akk_chat_recent', JSON.stringify(newQueries));
  };

  const handleSend = async (query = input) => {
    if (!query.trim() || isLoading) return;

    const userMessage = { role: 'user' as const, content: query };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);
    saveQuery(query);

    // First check local custom FAQ matches before calling backend API
    const lowerQuery = query.toLowerCase();
    const matchedFAQ = faqList.find(f => f.isActive && f.keyword && lowerQuery.includes(f.keyword.toLowerCase()));

    if (matchedFAQ) {
      setTimeout(() => {
        const autoReplyContent = `🤖 **Auto-Reply FAQ (${matchedFAQ.category})**:\n\n**${matchedFAQ.question}**\n${matchedFAQ.answer}`;
        setMessages(prev => [...prev, { role: 'assistant', content: autoReplyContent }]);
        setIsLoading(false);
      }, 400);
      return;
    }

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          message: query,
          history: messages,
          contextTab: activeTab
        }),
      });
      const data = await response.json();
      setMessages(prev => [...prev, { role: 'assistant', content: data.reply }]);
    } catch (error) {
      console.error('Chat error:', error);
      setMessages(prev => [...prev, { role: 'assistant', content: 'Maaf, terjadi kesalahan saat menghubungi asisten AI.' }]);
    } finally {
      setIsLoading(false);
    }
  };

  // Feature: Summarize last 10 messages into a concise recap card
  const handleSummarize = async () => {
    if (isLoading) return;

    const last10 = messages.slice(-10);
    if (last10.length === 0) return;

    setIsLoading(true);

    try {
      const historyText = last10
        .map(m => `${m.role === 'user' ? 'Pengguna' : 'Asisten'}: ${m.content}`)
        .join('\n');

      const summaryPrompt = `Buatkan ringkasan singkat dalam 3-4 poin operasional yang paling penting dari 10 percakapan terakhir berikut:\n\n${historyText}`;

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: summaryPrompt,
          history: messages,
          contextTab: activeTab
        }),
      });
      const data = await response.json();

      const topics = new Set<string>();
      last10.forEach(m => {
        const l = m.content.toLowerCase();
        if (l.includes('armada') || l.includes('truk') || l.includes('driver')) topics.add('Armada & Kru');
        if (l.includes('sparepart') || l.includes('servis')) topics.add('Sparepart');
        if (l.includes('jadwal') || l.includes('muat')) topics.add('Jadwal Muat');
        if (l.includes('bbm') || l.includes('uang jalan')) topics.add('BBM & Uang Jalan');
        if (l.includes('toko') || l.includes('peta')) topics.add('Toko Retail');
      });

      const topicStr = topics.size > 0 ? Array.from(topics).join(', ') : activeContextName;

      const summaryContent = `📋 RINGKASAN DISKUSI (10 PESAN TERAKHIR)

• Modul Konteks: ${topicStr}
• Total Pesan Ter-analisa: ${last10.length} pesan
• Poin Utama:
${data.reply || 'Diskusi berjalan lancar terkait operasional harian.'}

📌 Catatan: Ringkasan ini dibuat otomatis oleh AI Assistant PT AKK.`;

      setMessages(prev => [
        ...prev,
        { role: 'assistant', content: summaryContent, isSummary: true }
      ]);
    } catch (error) {
      console.error('Summarize error:', error);
      setMessages(prev => [
        ...prev,
        { 
          role: 'assistant', 
          content: `📋 **Ringkasan 10 Pesan Terakhir**:\n• **Konteks**: ${activeContextName}\n• **Total Percakapan**: ${last10.length} pesan tercatat.\n• **Status**: Diskusi seputar operasional harian berjalan dengan baik.`, 
          isSummary: true 
        }
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed bottom-6 right-6 z-50">
      {!isOpen ? (
        <button 
          onClick={() => setIsOpen(true)}
          className="bg-amber-600 hover:bg-amber-700 text-white p-4 rounded-full shadow-lg transition-transform hover:scale-105 flex items-center justify-center relative group cursor-pointer"
          title={`Buka Asisten AI (${activeContextName})`}
        >
          <MessageSquare size={24} />
          <span className="absolute -top-1 -right-1 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-emerald-400 ring-2 ring-slate-900 animate-pulse"></span>
        </button>
      ) : (
        <div className="bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl w-84 sm:w-90 h-[480px] flex flex-col overflow-hidden relative">
          {/* Header */}
          <div className="bg-slate-800 p-3.5 flex justify-between items-center border-b border-slate-700">
            <div className="flex items-center gap-2">
              <Bot className="text-amber-400 shrink-0" size={20} />
              <div>
                <h3 className="font-bold text-white text-sm leading-none">Operasional AI Assistant</h3>
                <span className="text-[10px] text-emerald-400 font-bold flex items-center gap-1 mt-1">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                  Konteks: {activeContextName}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              {isAdmin && (
                <button
                  onClick={() => setIsSettingsOpen(true)}
                  className="text-slate-300 hover:text-amber-300 transition p-1.5 rounded-lg hover:bg-slate-700 cursor-pointer"
                  title="Pengaturan FAQ Auto-Reply (Akses Admin)"
                >
                  <Settings size={16} />
                </button>
              )}
              <button 
                onClick={handleSummarize}
                disabled={isLoading || messages.length < 2}
                className="px-2 py-1 rounded-lg bg-emerald-700 hover:bg-emerald-600 text-white font-bold text-[11px] flex items-center gap-1 border border-emerald-500/50 shadow-sm transition cursor-pointer disabled:opacity-40"
                title="Rangkum 10 Pesan Terakhir dengan AI"
              >
                <FileSearch size={13} className="text-emerald-200" />
                <span>Rangkum</span>
              </button>
              <button 
                onClick={clearHistory}
                className="text-slate-300 hover:text-amber-400 transition p-1.5 rounded-lg hover:bg-slate-700 cursor-pointer"
                title="Hapus riwayat chat"
              >
                <Trash2 size={16} />
              </button>
              <button onClick={() => setIsOpen(false)} className="text-slate-300 hover:text-white p-1.5 rounded-lg hover:bg-slate-700 cursor-pointer"><X size={18} /></button>
            </div>
          </div>

          {/* Chat Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3.5 bg-slate-900">
            {messages.map((msg, i) => (
              <div key={'chat-' + i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`inline-block p-3 rounded-xl text-xs sm:text-sm max-w-[88%] leading-relaxed ${
                  msg.isSummary 
                    ? 'bg-emerald-950 text-emerald-100 border border-emerald-500 shadow-md font-sans'
                    : msg.role === 'user' 
                    ? 'bg-amber-600 text-white font-medium shadow-md' 
                    : 'bg-slate-800 text-slate-100 border border-slate-700 shadow-md font-medium'
                }`}>
                  {msg.isSummary && (
                    <div className="flex items-center gap-1.5 text-[11px] font-bold text-emerald-400 uppercase mb-1.5 pb-1 border-b border-emerald-800">
                      <CheckCircle2 size={13} className="text-emerald-400" />
                      <span>Ringkasan AI (10 Pesan)</span>
                    </div>
                  )}
                  <div className="whitespace-pre-wrap">{msg.content}</div>
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="flex justify-start">
                <span className="inline-block p-2.5 rounded-xl text-xs bg-slate-800 text-amber-300 font-semibold border border-amber-500/40 animate-pulse">Sedang mengolah rangkuman / jawaban...</span>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Smart Quick-Reply Chips Section */}
          <div className="bg-slate-950 border-t border-slate-800 p-2.5 space-y-2">
            <div className="flex items-center justify-between px-1">
              <span className="text-[11px] font-bold text-amber-400 flex items-center gap-1 uppercase tracking-wider">
                <Sparkles size={12} className="text-amber-400 animate-pulse" />
                Smart Quick-Reply &bull; {activeContextName}
              </span>
              {messages.length >= 3 && (
                <button
                  onClick={handleSummarize}
                  disabled={isLoading}
                  className="text-[11px] text-white hover:text-emerald-200 font-bold flex items-center gap-1 cursor-pointer bg-emerald-700 hover:bg-emerald-600 px-2.5 py-1 rounded-md border border-emerald-500 shadow-sm transition"
                >
                  <FileSearch size={12} />
                  <span>Rangkum 10 Pesan</span>
                </button>
              )}
            </div>

            <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none">
              {smartQuickReplies.map((qr) => (
                <button
                  key={qr.id}
                  onClick={() => handleSend(qr.prompt)}
                  disabled={isLoading}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-slate-800 hover:bg-amber-600 text-slate-100 hover:text-white border border-slate-600 hover:border-amber-400 transition cursor-pointer shrink-0 whitespace-nowrap active:scale-95 disabled:opacity-50 shadow-sm"
                >
                  {qr.icon}
                  <span>{qr.label}</span>
                </button>
              ))}
            </div>

            {/* Recent queries chip row if present */}
            {recentQueries.length > 0 && (
              <div className="flex items-center gap-1.5 overflow-x-auto pt-1 border-t border-slate-800/80 scrollbar-none">
                <span className="text-[10px] text-slate-300 font-semibold shrink-0 mr-0.5">Terakhir:</span>
                {recentQueries.slice(0, 3).map((q, i) => (
                  <button
                    key={i}
                    onClick={() => handleSend(q)}
                    disabled={isLoading}
                    className="text-[10px] bg-slate-800 hover:bg-slate-700 text-amber-300 hover:text-amber-200 font-medium px-2.5 py-0.5 rounded-md border border-amber-500/30 truncate max-w-[130px] shrink-0 cursor-pointer shadow-sm"
                  >
                    {q}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="p-2.5 bg-slate-900 border-t border-slate-800 flex gap-2">
            <input 
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSend()}
              className="flex-1 bg-slate-800 text-white rounded-lg px-3 py-2 text-xs sm:text-sm border border-slate-600 focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400 placeholder:text-slate-400 font-medium"
              placeholder={`Tanya tentang ${activeContextName}...`}
              disabled={isLoading}
            />
            <button 
              onClick={() => handleSend()} 
              className="bg-amber-600 hover:bg-amber-500 active:scale-95 text-white p-2 rounded-lg disabled:opacity-50 transition flex items-center justify-center shrink-0 cursor-pointer font-bold shadow-md" 
              disabled={isLoading || !input.trim()}
            >
              <Send size={15} />
            </button>
          </div>

          {/* Settings Overlay for Admin */}
          {isSettingsOpen && (
            <ChatSettingsModal 
              faqList={faqList}
              onSaveFAQ={handleSaveFAQ}
              onClose={() => setIsSettingsOpen(false)}
            />
          )}
        </div>
      )}
    </div>
  );
};



