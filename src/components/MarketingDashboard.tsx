import React, { useState, useEffect } from 'react';
import {
  format,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  addMonths,
  subMonths,
  isToday,
} from 'date-fns';
import {
  Globe,
  Megaphone,
  Plus,
  Search,
  Filter,
  TrendingUp,
  DollarSign,
  User,
  MapPin,
  Calendar,
  Building,
  CheckCircle2,
  XCircle,
  MessageSquare,
  Sparkles,
  BarChart3,
  Phone,
  FileText
} from 'lucide-react';

// ============================================================
// TYPES
// ============================================================
export interface OnlineLead {
  id: string;
  clientName: string;
  city: string;
  productType: string;
  estVolumePcs: number;
  budgetIDR: number;
  channel: 'Google Search' | 'WhatsApp Ads' | 'Instagram DM' | 'TikTok Business' | 'Website Form';
  date: string;
  status: 'Lead Baru' | 'Follow Up' | 'Negosiasi' | 'Deal / SPK' | 'Batal';
  notes: string;
}

export interface OfflineVisit {
  id: string;
  clientName: string;
  contactPerson: string;
  region: string;
  purpose: string;
  date: string;
  status: 'Menunggu Follow-up' | 'Kunjungan Selesai' | 'Deal Kontrak' | 'Tidak Tertarik';
  outcome: string;
}

interface MarketingDashboardProps {
  activeTab: 'marketing_online' | 'marketing_offline';
}

// ============================================================
// MOCK DATA INITIALIZATION
// ============================================================
const initialOnlineLeads: OnlineLead[] = [
  {
    id: 'OL-001',
    clientName: 'CV Sinar Mandiri',
    city: 'Surabaya',
    productType: 'Karton Box Corrugated (A1)',
    estVolumePcs: 50000,
    budgetIDR: 120000000,
    channel: 'WhatsApp Ads',
    date: '2026-09-20',
    status: 'Lead Baru',
    notes: 'Tertarik dengan box ukuran custom untuk mie instan.'
  },
  {
    id: 'OL-002',
    clientName: 'PT Jaya Selalu',
    city: 'Sidoarjo',
    productType: 'Die-Cut Box E-Commerce',
    estVolumePcs: 15000,
    budgetIDR: 45000000,
    channel: 'Website Form',
    date: '2026-09-18',
    status: 'Negosiasi',
    notes: 'Nego harga per pcs, minta diskon 5% untuk kontrak 6 bulan.'
  },
  {
    id: 'OL-003',
    clientName: 'Kopi Nusantara',
    city: 'Malang',
    productType: 'Offset Printing Packaging',
    estVolumePcs: 10000,
    budgetIDR: 35000000,
    channel: 'Instagram DM',
    date: '2026-09-15',
    status: 'Deal / SPK',
    notes: 'SPK ditandatangani, pembayaran DP 50% sudah diterima.'
  },
  {
    id: 'OL-004',
    clientName: 'Bakery Kita',
    city: 'Banyuwangi',
    productType: 'Heavy Duty Box',
    estVolumePcs: 5000,
    budgetIDR: 18000000,
    channel: 'Google Search',
    date: '2026-09-21',
    status: 'Batal',
    notes: 'Spesifikasi karton terlalu tebal untuk kebutuhan mereka.'
  }
];

const initialOfflineVisits: OfflineVisit[] = [
  {
    id: 'OV-001',
    clientName: 'PT Indofood CBP',
    contactPerson: 'Pak Budi',
    region: 'Pasuruan',
    purpose: 'Pencocokan Sampel Karton Box E-Commerce',
    date: '2026-09-19',
    status: 'Kunjungan Selesai',
    outcome: 'Sampel disetujui tim QC, menunggu revisi penawaran harga final.'
  },
  {
    id: 'OV-002',
    clientName: 'CV Agung Abadi',
    contactPerson: 'Bu Dewi',
    region: 'Jember',
    purpose: 'Negosiasi Kontrak Tahunan',
    date: '2026-09-17',
    status: 'Deal Kontrak',
    outcome: 'Kontrak resmi ditandatangani untuk suplai 100,000 box/bulan selama 1 tahun.'
  },
  {
    id: 'OV-003',
    clientName: 'Industri Gula Glenmore',
    contactPerson: 'Pak Heri',
    region: 'Banyuwangi',
    purpose: 'Bagi Brosur & Pengenalan Produk Corrugated Sheet',
    date: '2026-09-21',
    status: 'Menunggu Follow-up',
    outcome: 'Sangat tertarik dengan lembaran Kraft liner 150gr. Akan dikirim penawaran resmi besok.'
  },
  {
    id: 'OV-004',
    clientName: 'UD Maju Mapan',
    contactPerson: 'Pak Anton',
    region: 'Banyuwangi',
    purpose: 'Penawaran Die-Cut Dus Kemasan',
    date: '2026-09-14',
    status: 'Tidak Tertarik',
    outcome: 'Memilih bertahan dengan supplier lokal Banyuwangi karena hubungan keluarga.'
  }
];

export const MarketingDashboard: React.FC<MarketingDashboardProps> = ({ activeTab }) => {
  // --- Persistent Online Leads State ---
  const [onlineLeads, setOnlineLeads] = useState<OnlineLead[]>(() => {
    try {
      const saved = localStorage.getItem('akk_marketing_online_leads');
      return saved ? JSON.parse(saved) : initialOnlineLeads;
    } catch {
      return initialOnlineLeads;
    }
  });

  // --- Persistent Offline Visits State ---
  const [offlineVisits, setOfflineVisits] = useState<OfflineVisit[]>(() => {
    try {
      const saved = localStorage.getItem('akk_marketing_offline_visits');
      return saved ? JSON.parse(saved) : initialOfflineVisits;
    } catch {
      return initialOfflineVisits;
    }
  });

  // Save states to local storage
  useEffect(() => {
    localStorage.setItem('akk_marketing_online_leads', JSON.stringify(onlineLeads));
  }, [onlineLeads]);

  useEffect(() => {
    localStorage.setItem('akk_marketing_offline_visits', JSON.stringify(offlineVisits));
  }, [offlineVisits]);

  // --- Filters & Searching States ---
  const [onlineSearch, setOnlineSearch] = useState('');
  const [onlineFilterStatus, setOnlineFilterStatus] = useState<string>('all');
  const [onlineFilterChannel, setOnlineFilterChannel] = useState<string>('all');

  const [offlineSearch, setOfflineSearch] = useState('');
  const [offlineFilterStatus, setOfflineFilterStatus] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'table' | 'calendar'>('table');
  const [currentMonth, setCurrentMonth] = useState(new Date());

  // --- Modal Form States ---
  const [showAddLeadModal, setShowAddLeadModal] = useState(false);
  const [showAddVisitModal, setShowAddVisitModal] = useState(false);

  // --- New Lead Form Fields ---
  const [newLeadName, setNewLeadName] = useState('');
  const [newLeadCity, setNewLeadCity] = useState('');
  const [newLeadProduct, setNewLeadProduct] = useState('Karton Box Corrugated (A1)');
  const [newLeadVolume, setNewLeadVolume] = useState<number>(10000);
  const [newLeadBudget, setNewLeadBudget] = useState<number>(25000000);
  const [newLeadChannel, setNewLeadChannel] = useState<'Google Search' | 'WhatsApp Ads' | 'Instagram DM' | 'TikTok Business' | 'Website Form'>('Website Form');
  const [newLeadNotes, setNewLeadNotes] = useState('');

  // --- New Visit Form Fields ---
  const [newVisitName, setNewVisitName] = useState('');
  const [newVisitContact, setNewVisitContact] = useState('');
  const [newVisitRegion, setNewVisitRegion] = useState('');
  const [newVisitPurpose, setNewVisitPurpose] = useState('');
  const [newVisitStatus, setNewVisitStatus] = useState<'Menunggu Follow-up' | 'Kunjungan Selesai' | 'Deal Kontrak' | 'Tidak Tertarik'>('Menunggu Follow-up');
  const [newVisitOutcome, setNewVisitOutcome] = useState('');

  // --- Actions ---
  const handleAddOnlineLead = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLeadName || !newLeadCity) {
      alert('Nama Klien dan Kota harus diisi!');
      return;
    }

    const newLead: OnlineLead = {
      id: `OL-${String(onlineLeads.length + 1).padStart(3, '0')}`,
      clientName: newLeadName,
      city: newLeadCity,
      productType: newLeadProduct,
      estVolumePcs: newLeadVolume,
      budgetIDR: newLeadBudget,
      channel: newLeadChannel,
      date: new Date().toISOString().split('T')[0],
      status: 'Lead Baru',
      notes: newLeadNotes
    };

    setOnlineLeads([newLead, ...onlineLeads]);
    setShowAddLeadModal(false);

    // Reset Form
    setNewLeadName('');
    setNewLeadCity('');
    setNewLeadProduct('Karton Box Corrugated (A1)');
    setNewLeadVolume(10000);
    setNewLeadBudget(25000000);
    setNewLeadChannel('Website Form');
    setNewLeadNotes('');
  };

  const handleAddOfflineVisit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newVisitName || !newVisitContact || !newVisitRegion) {
      alert('Nama Klien, Kontak, dan Wilayah wajib diisi!');
      return;
    }

    const newVisit: OfflineVisit = {
      id: `OV-${String(offlineVisits.length + 1).padStart(3, '0')}`,
      clientName: newVisitName,
      contactPerson: newVisitContact,
      region: newVisitRegion,
      purpose: newVisitPurpose,
      date: new Date().toISOString().split('T')[0],
      status: newVisitStatus,
      outcome: newVisitOutcome
    };

    setOfflineVisits([newVisit, ...offlineVisits]);
    setShowAddVisitModal(false);

    // Reset Form
    setNewVisitName('');
    setNewVisitContact('');
    setNewVisitRegion('');
    setNewVisitPurpose('');
    setNewVisitStatus('Menunggu Follow-up');
    setNewVisitOutcome('');
  };

  const updateLeadStatus = (id: string, newStatus: any) => {
    setOnlineLeads(prev =>
      prev.map(lead => (lead.id === id ? { ...lead, status: newStatus } : lead))
    );
  };

  const updateVisitStatus = (id: string, newStatus: any) => {
    setOfflineVisits(prev =>
      prev.map(visit => (visit.id === id ? { ...visit, status: newStatus } : visit))
    );
  };

  // --- Filter Processing ---
  const filteredOnlineLeads = onlineLeads.filter(lead => {
    const matchesSearch =
      lead.clientName.toLowerCase().includes(onlineSearch.toLowerCase()) ||
      lead.city.toLowerCase().includes(onlineSearch.toLowerCase()) ||
      lead.productType.toLowerCase().includes(onlineSearch.toLowerCase());

    const matchesStatus = onlineFilterStatus === 'all' || lead.status === onlineFilterStatus;
    const matchesChannel = onlineFilterChannel === 'all' || lead.channel === onlineFilterChannel;

    return matchesSearch && matchesStatus && matchesChannel;
  });

  const filteredOfflineVisits = offlineVisits.filter(visit => {
    const matchesSearch =
      visit.clientName.toLowerCase().includes(offlineSearch.toLowerCase()) ||
      visit.region.toLowerCase().includes(offlineSearch.toLowerCase()) ||
      visit.contactPerson.toLowerCase().includes(offlineSearch.toLowerCase()) ||
      visit.purpose.toLowerCase().includes(offlineSearch.toLowerCase());

    const matchesStatus = offlineFilterStatus === 'all' || visit.status === offlineFilterStatus;

    return matchesSearch && matchesStatus;
  });

  // --- Real-time Metrics ---
  const totalLeadBudget = onlineLeads.reduce((acc, lead) => acc + (lead.status !== 'Batal' ? lead.budgetIDR : 0), 0);
  const totalDealsValue = onlineLeads
    .filter(l => l.status === 'Deal / SPK')
    .reduce((acc, l) => acc + l.budgetIDR, 0);

  const totalLeadsCount = onlineLeads.length;
  const dealLeadsCount = onlineLeads.filter(l => l.status === 'Deal / SPK').length;
  const conversionRate = totalLeadsCount > 0 ? ((dealLeadsCount / totalLeadsCount) * 100).toFixed(1) : '0';

  const totalVisitsCount = offlineVisits.length;
  const offlineDealsCount = offlineVisits.filter(v => v.status === 'Deal Kontrak').length;
  const offlineSuccessRate = totalVisitsCount > 0 ? ((offlineDealsCount / totalVisitsCount) * 100).toFixed(1) : '0';

  return (
    <div className="space-y-6" id="marketing_hub">
      {/* HEADER SECTION */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 p-6 bg-gradient-to-r from-slate-900 via-slate-900 to-amber-950/20 border border-slate-800 rounded-2xl shadow-xl">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-orange-500/15 border border-orange-500/30 flex items-center justify-center text-orange-400 shrink-0">
            {activeTab === 'marketing_online' ? <Globe className="w-6 h-6" /> : <Megaphone className="w-6 h-6" />}
          </div>
          <div>
            <div className="text-[10px] uppercase font-bold tracking-wider text-slate-400">Departemen Marketing AKK</div>
            <h2 className="text-xl font-black text-white tracking-tight flex items-center gap-2">
              <span>{activeTab === 'marketing_online' ? 'Marketing Online Hub' : 'Marketing Offline Hub'}</span>
              <span className="text-xs bg-amber-500/10 text-amber-300 font-bold px-2 py-0.5 rounded-full border border-amber-500/20">
                Akses Terotorisasi
              </span>
            </h2>
            <p className="text-slate-400 text-xs mt-1">
              {activeTab === 'marketing_online'
                ? 'Manajemen prospek digital, pelacakan kampanye iklan online, dan optimasi konversi leads pabrik.'
                : 'Manajemen rute canvasing, laporan kunjungan industri, distribusi brosur fisik, dan negosiasi kontrak lokal.'}
            </p>
          </div>
        </div>

        <div>
          {activeTab === 'marketing_online' ? (
            <button
              onClick={() => setShowAddLeadModal(true)}
              className="w-full md:w-auto px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs shadow-md transition-all hover:-translate-y-0.5 active:translate-y-0 flex items-center justify-center gap-2 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Tambah Prospek Online</span>
            </button>
          ) : (
            <button
              onClick={() => setShowAddVisitModal(true)}
              className="w-full md:w-auto px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs shadow-md transition-all hover:-translate-y-0.5 active:translate-y-0 flex items-center justify-center gap-2 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Input Laporan Kunjungan</span>
            </button>
          )}
        </div>
      </div>

      {/* METRICS ROW */}
      {activeTab === 'marketing_online' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-slate-900/80 border border-slate-800 p-5 rounded-2xl shadow-sm hover:border-slate-700/80 transition-all">
            <div className="flex items-center justify-between mb-3">
              <span className="text-slate-400 text-[10px] font-black uppercase tracking-wider">Potensi Omset Leads</span>
              <DollarSign className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="text-xl font-black text-white">
              Rp {totalLeadBudget.toLocaleString('id-ID')}
            </div>
            <p className="text-slate-500 text-[10px] mt-1">Dari prospek aktif (selain batal)</p>
          </div>

          <div className="bg-slate-900/80 border border-slate-800 p-5 rounded-2xl shadow-sm hover:border-slate-700/80 transition-all">
            <div className="flex items-center justify-between mb-3">
              <span className="text-slate-400 text-[10px] font-black uppercase tracking-wider">Nilai Deal / SPK</span>
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="text-xl font-black text-emerald-400">
              Rp {totalDealsValue.toLocaleString('id-ID')}
            </div>
            <p className="text-slate-500 text-[10px] mt-1">Pemasukan sah dari prospek digital</p>
          </div>

          <div className="bg-slate-900/80 border border-slate-800 p-5 rounded-2xl shadow-sm hover:border-slate-700/80 transition-all">
            <div className="flex items-center justify-between mb-3">
              <span className="text-slate-400 text-[10px] font-black uppercase tracking-wider">Total Leads Masuk</span>
              <Globe className="w-4 h-4 text-amber-400" />
            </div>
            <div className="text-xl font-black text-white">{totalLeadsCount} Leads</div>
            <p className="text-slate-500 text-[10px] mt-1">Registrasi prospek via digital ads</p>
          </div>

          <div className="bg-slate-900/80 border border-slate-800 p-5 rounded-2xl shadow-sm hover:border-slate-700/80 transition-all">
            <div className="flex items-center justify-between mb-3">
              <span className="text-slate-400 text-[10px] font-black uppercase tracking-wider">Rasio Konversi (SLA)</span>
              <TrendingUp className="w-4 h-4 text-amber-400" />
            </div>
            <div className="text-xl font-black text-amber-400">{conversionRate}%</div>
            <p className="text-slate-500 text-[10px] mt-1">Persentase prospek sukses SPK</p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-slate-900/80 border border-slate-800 p-5 rounded-2xl shadow-sm hover:border-slate-700/80 transition-all">
            <div className="flex items-center justify-between mb-3">
              <span className="text-slate-400 text-[10px] font-black uppercase tracking-wider">Total Kunjungan</span>
              <MapPin className="w-4 h-4 text-orange-400" />
            </div>
            <div className="text-xl font-black text-white">{totalVisitsCount} Pabrik/Mitra</div>
            <p className="text-slate-500 text-[10px] mt-1">Kunjungan canvasing fisik terdata</p>
          </div>

          <div className="bg-slate-900/80 border border-slate-800 p-5 rounded-2xl shadow-sm hover:border-slate-700/80 transition-all">
            <div className="flex items-center justify-between mb-3">
              <span className="text-slate-400 text-[10px] font-black uppercase tracking-wider">Sukses Kontrak Baru</span>
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="text-xl font-black text-emerald-400">{offlineDealsCount} Perusahaan</div>
            <p className="text-slate-500 text-[10px] mt-1">Telah menandatangani kontrak suplai</p>
          </div>

          <div className="bg-slate-900/80 border border-slate-800 p-5 rounded-2xl shadow-sm hover:border-slate-700/80 transition-all">
            <div className="flex items-center justify-between mb-3">
              <span className="text-slate-400 text-[10px] font-black uppercase tracking-wider">Rasio Keberhasilan</span>
              <TrendingUp className="w-4 h-4 text-amber-400" />
            </div>
            <div className="text-xl font-black text-amber-400">{offlineSuccessRate}%</div>
            <p className="text-slate-500 text-[10px] mt-1">Rasio kunjungan berbuah kontrak</p>
          </div>

          <div className="bg-slate-900/80 border border-slate-800 p-5 rounded-2xl shadow-sm hover:border-slate-700/80 transition-all">
            <div className="flex items-center justify-between mb-3">
              <span className="text-slate-400 text-[10px] font-black uppercase tracking-wider">Follow Up Tertunda</span>
              <Calendar className="w-4 h-4 text-amber-400 animate-pulse" />
            </div>
            <div className="text-xl font-black text-white">
              {offlineVisits.filter(v => v.status === 'Menunggu Follow-up').length} Klien
            </div>
            <p className="text-slate-500 text-[10px] mt-1">Perlu ditindaklanjuti minggu ini</p>
          </div>
        </div>
      )}

      {/* DETAILED CONTENT AREA */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* LEFT TWO-THIRDS: INTERACTIVE LOG TABLE */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-sm">
            {/* Table Header Filter controls */}
            <div className="p-5 border-b border-slate-800/80 bg-slate-900 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <BarChart3 className="w-4.5 h-4.5 text-amber-400" />
                <h3 className="text-xs font-black uppercase tracking-wider text-white">
                  {activeTab === 'marketing_online' ? 'Daftar Prospek Proaktif Digital' : 'Laporan Canvasing & Kunjungan Lapangan'}
                </h3>
              </div>

              {activeTab === 'marketing_offline' && (
                <div className="flex items-center bg-slate-950 rounded-xl border border-slate-800 p-1">
                  <button
                    onClick={() => setViewMode('table')}
                    className={`px-3 py-1 text-xs font-bold rounded-lg transition-all ${
                      viewMode === 'table' ? 'bg-slate-800 text-white' : 'text-slate-500 hover:text-slate-300'
                    }`}
                  >
                    Tabel
                  </button>
                  <button
                    onClick={() => setViewMode('calendar')}
                    className={`px-3 py-1 text-xs font-bold rounded-lg transition-all ${
                      viewMode === 'calendar' ? 'bg-slate-800 text-white' : 'text-slate-500 hover:text-slate-300'
                    }`}
                  >
                    Kalender
                  </button>
                </div>
              )}

              {/* Filtering layout */}
              {activeTab === 'marketing_online' ? (
                <div className="flex flex-wrap items-center gap-2.5">
                  <div className="relative">
                    <Search className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-slate-500" />
                    <input
                      type="text"
                      placeholder="Cari klien, kota..."
                      value={onlineSearch}
                      onChange={e => setOnlineSearch(e.target.value)}
                      className="pl-8 pr-3 py-1.5 w-40 text-xs rounded-xl bg-slate-950 border border-slate-800 text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-amber-500/50 transition-all"
                    />
                  </div>

                  <select
                    value={onlineFilterStatus}
                    onChange={e => setOnlineFilterStatus(e.target.value)}
                    className="px-2.5 py-1.5 text-xs rounded-xl bg-slate-950 border border-slate-800 text-slate-300 focus:outline-none focus:border-amber-500/50"
                  >
                    <option value="all">Semua Status</option>
                    <option value="Lead Baru">Lead Baru</option>
                    <option value="Follow Up">Follow Up</option>
                    <option value="Negosiasi">Negosiasi</option>
                    <option value="Deal / SPK">Deal / SPK</option>
                    <option value="Batal">Batal</option>
                  </select>

                  <select
                    value={onlineFilterChannel}
                    onChange={e => setOnlineFilterChannel(e.target.value)}
                    className="px-2.5 py-1.5 text-xs rounded-xl bg-slate-950 border border-slate-800 text-slate-300 focus:outline-none focus:border-amber-500/50"
                  >
                    <option value="all">Semua Channel</option>
                    <option value="Google Search">Google Search</option>
                    <option value="WhatsApp Ads">WhatsApp Ads</option>
                    <option value="Instagram DM">Instagram DM</option>
                    <option value="TikTok Business">TikTok Business</option>
                    <option value="Website Form">Website Form</option>
                  </select>
                </div>
              ) : (
                <div className="flex flex-wrap items-center gap-2.5">
                  <div className="relative">
                    <Search className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-slate-500" />
                    <input
                      type="text"
                      placeholder="Cari klien, wilayah..."
                      value={offlineSearch}
                      onChange={e => setOfflineSearch(e.target.value)}
                      className="pl-8 pr-3 py-1.5 w-48 text-xs rounded-xl bg-slate-950 border border-slate-800 text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-amber-500/50 transition-all"
                    />
                  </div>

                  <select
                    value={offlineFilterStatus}
                    onChange={e => setOfflineFilterStatus(e.target.value)}
                    className="px-2.5 py-1.5 text-xs rounded-xl bg-slate-950 border border-slate-800 text-slate-300 focus:outline-none focus:border-amber-500/50"
                  >
                    <option value="all">Semua Status</option>
                    <option value="Menunggu Follow-up">Menunggu Follow-up</option>
                    <option value="Kunjungan Selesai">Kunjungan Selesai</option>
                    <option value="Deal Kontrak">Deal Kontrak</option>
                    <option value="Tidak Tertarik">Tidak Tertarik</option>
                  </select>
                </div>
              )}
            </div>

            {/* Render Tab Table or Calendar */}
            <div className="overflow-x-auto">
              {activeTab === 'marketing_online' ? (
                filteredOnlineLeads.length === 0 ? (
                  <div className="p-8 text-center text-slate-500 text-xs">
                    Tidak ada data prospek online yang cocok dengan pencarian Anda.
                  </div>
                ) : (
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-800/80 bg-slate-950 text-slate-400 text-[10px] font-bold uppercase tracking-wider">
                        <th className="p-3.5 pl-5">Kode</th>
                        <th className="p-3.5">Klien / Lokasi</th>
                        <th className="p-3.5">Spesifikasi Karton</th>
                        <th className="p-3.5 text-right">Volume & Anggaran</th>
                        <th className="p-3.5">Channel Masuk</th>
                        <th className="p-3.5">Status Prospek</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 text-xs text-slate-300">
                      {filteredOnlineLeads.map(lead => (
                        <tr key={lead.id} className="hover:bg-slate-900/60 transition duration-150">
                          <td className="p-3.5 pl-5 font-mono font-bold text-slate-400">{lead.id}</td>
                          <td className="p-3.5">
                            <div className="font-bold text-white">{lead.clientName}</div>
                            <div className="text-[10px] text-slate-500 flex items-center gap-1 mt-0.5">
                              <MapPin className="w-3 h-3 text-slate-600" />
                              <span>{lead.city}</span>
                            </div>
                          </td>
                          <td className="p-3.5">
                            <div className="truncate max-w-[150px]">{lead.productType}</div>
                            <div className="text-[10px] text-slate-500 italic mt-0.5 max-w-[180px] truncate" title={lead.notes}>
                              "{lead.notes || 'Tidak ada catatan khusus'}"
                            </div>
                          </td>
                          <td className="p-3.5 text-right">
                            <div className="font-bold text-white">{(lead.estVolumePcs || 0).toLocaleString('id-ID')} pcs</div>
                            <div className="text-[10px] text-emerald-400 mt-0.5 font-semibold">
                              Rp {(lead.budgetIDR || 0).toLocaleString('id-ID')}
                            </div>
                          </td>
                          <td className="p-3.5">
                            <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-slate-950 border border-slate-800 text-slate-300">
                              {lead.channel}
                            </span>
                          </td>
                          <td className="p-3.5">
                            <select
                              value={lead.status}
                              onChange={e => updateLeadStatus(lead.id, e.target.value)}
                              className={`text-[10px] font-black px-2 py-1 rounded-lg border focus:outline-none cursor-pointer ${
                                lead.status === 'Deal / SPK'
                                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                                  : lead.status === 'Negosiasi'
                                  ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                                  : lead.status === 'Follow Up'
                                  ? 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30'
                                  : lead.status === 'Batal'
                                  ? 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                                  : 'bg-slate-950 text-slate-300 border-slate-800'
                              }`}
                            >
                              <option value="Lead Baru">Lead Baru</option>
                              <option value="Follow Up">Follow Up</option>
                              <option value="Negosiasi">Negosiasi</option>
                              <option value="Deal / SPK">Deal / SPK</option>
                              <option value="Batal">Batal</option>
                            </select>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )
              ) : viewMode === 'table' ? (
                filteredOfflineVisits.length === 0 ? (
                  <div className="p-8 text-center text-slate-500 text-xs">
                    Tidak ada laporan kunjungan canvasing yang cocok dengan filter pencarian.
                  </div>
                ) : (
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-800/80 bg-slate-950 text-slate-400 text-[10px] font-bold uppercase tracking-wider">
                        <th className="p-3.5 pl-5">Kode Visit</th>
                        <th className="p-3.5">Perusahaan Klien</th>
                        <th className="p-3.5">Tujuan Kunjungan</th>
                        <th className="p-3.5">Hasil Akhir Canvasing</th>
                        <th className="p-3.5">Status Progress</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 text-xs text-slate-300">
                      {filteredOfflineVisits.map(visit => (
                        <tr key={visit.id} className="hover:bg-slate-900/60 transition duration-150">
                          <td className="p-3.5 pl-5 font-mono font-bold text-slate-400">{visit.id}</td>
                          <td className="p-3.5">
                            <div className="font-bold text-white">{visit.clientName}</div>
                            <div className="text-[10px] text-slate-500 flex flex-col gap-0.5 mt-0.5">
                              <span className="flex items-center gap-1">
                                <User className="w-3 h-3 text-slate-600" />
                                {visit.contactPerson} (PIC)
                              </span>
                              <span className="flex items-center gap-1">
                                <MapPin className="w-3 h-3 text-slate-600" />
                                {visit.region}
                              </span>
                            </div>
                          </td>
                          <td className="p-3.5">
                            <div className="font-medium text-slate-200 max-w-[150px] truncate" title={visit.purpose}>
                              {visit.purpose}
                            </div>
                            <div className="text-[10px] text-slate-500 mt-0.5 flex items-center gap-1">
                              <Calendar className="w-3 h-3 text-slate-600" />
                              <span>Kunjungan: {visit.date}</span>
                            </div>
                          </td>
                          <td className="p-3.5">
                            <div className="max-w-[200px] text-slate-400 leading-relaxed text-[10px] line-clamp-2" title={visit.outcome}>
                              {visit.outcome}
                            </div>
                          </td>
                          <td className="p-3.5">
                            <select
                              value={visit.status}
                              onChange={e => updateVisitStatus(visit.id, e.target.value)}
                              className={`text-[10px] font-black px-2 py-1 rounded-lg border focus:outline-none cursor-pointer ${
                                visit.status === 'Deal Kontrak'
                                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                                  : visit.status === 'Kunjungan Selesai'
                                  ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                                  : visit.status === 'Menunggu Follow-up'
                                  ? 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30'
                                  : 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                              }`}
                            >
                              <option value="Menunggu Follow-up">Menunggu Follow-up</option>
                              <option value="Kunjungan Selesai">Kunjungan Selesai</option>
                              <option value="Deal Kontrak">Deal Kontrak</option>
                              <option value="Tidak Tertarik">Tidak Tertarik</option>
                            </select>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )
              ) : (
                /* Calendar View Implementation */
                <div className="p-5">
                  <div className="flex items-center justify-between mb-4">
                    <button onClick={() => setCurrentMonth(subMonths(currentMonth, 1))} className="p-2 rounded-xl hover:bg-slate-800 text-slate-400">
                      {'<'}
                    </button>
                    <h3 className="text-sm font-bold text-white">{format(currentMonth, 'MMMM yyyy')}</h3>
                    <button onClick={() => setCurrentMonth(addMonths(currentMonth, 1))} className="p-2 rounded-xl hover:bg-slate-800 text-slate-400">
                      {'>'}
                    </button>
                  </div>
                  <div className="grid grid-cols-7 gap-2">
                    {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
                      <div key={d} className="text-center text-[10px] font-bold text-slate-500 uppercase">{d}</div>
                    ))}
                    {eachDayOfInterval({ start: startOfMonth(currentMonth), end: endOfMonth(currentMonth) }).map(day => {
                      const visitsForDay = offlineVisits.filter(v => isSameDay(new Date(v.date), day));
                      return (
                        <div key={day.toString()} className={`min-h-[80px] p-1 rounded-xl border border-slate-800 ${isToday(day) ? 'bg-amber-500/10' : 'bg-slate-950'}`}>
                          <div className={`text-[10px] ${isToday(day) ? 'text-amber-400 font-bold' : 'text-slate-500'}`}>{format(day, 'd')}</div>
                          <div className="space-y-1 mt-1">
                            {visitsForDay.map(v => (
                              <div key={v.id} className="text-[9px] p-1 rounded bg-slate-800 text-slate-300 truncate" title={v.clientName}>
                                {v.clientName}
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* RIGHT ONE-THIRD: METRICS SIDEBAR AND CAMPAIGN INSIGHTS */}
        <div className="space-y-6">
          {activeTab === 'marketing_online' ? (
            <>
              {/* Campaign Performance Panel */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-sm space-y-4">
                <div className="flex items-center gap-2">
                  <TrendingUp className="w-4.5 h-4.5 text-amber-400" />
                  <h3 className="text-xs font-black uppercase tracking-wider text-white">Iklan Online & Digital Campaign</h3>
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  Efisiensi anggaran iklan online dan konversi lead yang mendaftar ke form database sales.
                </p>

                <div className="space-y-3.5 pt-2">
                  {/* Whatsapp Outreach */}
                  <div className="space-y-1">
                    <div className="flex justify-between text-[11px]">
                      <span className="font-semibold text-slate-300">WhatsApp Marketing Ads</span>
                      <span className="text-amber-400 font-mono font-bold">ROAS 4.2x</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-slate-950 overflow-hidden border border-slate-800">
                      <div className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-green-400" style={{ width: '85%' }} />
                    </div>
                    <div className="flex justify-between text-[9px] text-slate-500">
                      <span>CPL: Rp 12,500</span>
                      <span>Konversi: 14%</span>
                    </div>
                  </div>

                  {/* Google Search Ads */}
                  <div className="space-y-1">
                    <div className="flex justify-between text-[11px]">
                      <span className="font-semibold text-slate-300">Google Search Ads (Pabrik Karton)</span>
                      <span className="text-amber-400 font-mono font-bold">ROAS 3.8x</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-slate-950 overflow-hidden border border-slate-800">
                      <div className="h-full rounded-full bg-gradient-to-r from-amber-500 to-yellow-400" style={{ width: '75%' }} />
                    </div>
                    <div className="flex justify-between text-[9px] text-slate-500">
                      <span>CPL: Rp 18,200</span>
                      <span>Konversi: 18%</span>
                    </div>
                  </div>

                  {/* Website SEO */}
                  <div className="space-y-1">
                    <div className="flex justify-between text-[11px]">
                      <span className="font-semibold text-slate-300">Website & Landing Page Form</span>
                      <span className="text-emerald-400 font-mono font-bold">Organis</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-slate-950 overflow-hidden border border-slate-800">
                      <div className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-blue-400" style={{ width: '60%' }} />
                    </div>
                    <div className="flex justify-between text-[9px] text-slate-500">
                      <span>Inbound Leads</span>
                      <span>Konversi: 25%</span>
                    </div>
                  </div>

                  {/* Meta Reels Ads */}
                  <div className="space-y-1">
                    <div className="flex justify-between text-[11px]">
                      <span className="font-semibold text-slate-300">Instagram / TikTok Reels kemasan</span>
                      <span className="text-amber-400 font-mono font-bold">ROAS 2.1x</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-slate-950 overflow-hidden border border-slate-800">
                      <div className="h-full rounded-full bg-gradient-to-r from-rose-500 to-pink-400" style={{ width: '45%' }} />
                    </div>
                    <div className="flex justify-between text-[9px] text-slate-500">
                      <span>CPL: Rp 24,000</span>
                      <span>Konversi: 8%</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* SOP Prospek Follow-Up */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-sm space-y-3">
                <h4 className="text-xs font-black uppercase text-white flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-amber-400" />
                  <span>SOP Prospek Digital (SLA)</span>
                </h4>
                <ul className="space-y-2.5 text-[11px] text-slate-400 leading-relaxed">
                  <li className="flex items-start gap-2.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0 mt-1.5" />
                    <span><strong>Kecepatan Respon:</strong> Lead baru wajib dihubungi maksimal 15 menit setelah data masuk ke WhatsApp atau form website.</span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0 mt-1.5" />
                    <span><strong>Pencocokan Sampel:</strong> Kirim contoh karton sheet atau mockup box die-cut maksimal 48 jam jika klien meminta sampel fisik.</span>
                  </li>
                </ul>
              </div>
            </>
          ) : (
            <>
              {/* Canvasing Region Statistics */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-sm space-y-4">
                <div className="flex items-center gap-2">
                  <MapPin className="w-4.5 h-4.5 text-amber-400" />
                  <h3 className="text-xs font-black uppercase tracking-wider text-white">Distribusi Wilayah Canvasing</h3>
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  Jumlah kunjungan dan cakupan pasar offline yang berhasil dimasuki oleh tim marketing lapangan.
                </p>

                <div className="space-y-3 pt-1">
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-slate-300 font-semibold">Banyuwangi & Sekitarnya</span>
                    <span className="text-white font-mono font-black">12 Kunjungan</span>
                  </div>
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-slate-300 font-semibold">Jember & Lumajang</span>
                    <span className="text-white font-mono font-black">6 Kunjungan</span>
                  </div>
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-slate-300 font-semibold">Pasuruan & Probolinggo</span>
                    <span className="text-white font-mono font-black">4 Kunjungan</span>
                  </div>
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-slate-300 font-semibold">Malang Raya</span>
                    <span className="text-white font-mono font-black">3 Kunjungan</span>
                  </div>
                </div>
              </div>

              {/* Offline Canvasing Tools Check */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-sm space-y-3">
                <h4 className="text-xs font-black uppercase text-white flex items-center gap-2">
                  <FileText className="w-4 h-4 text-amber-400" />
                  <span>Kelengkapan Canvasing</span>
                </h4>
                <div className="space-y-2 text-[11px] text-slate-400">
                  <div className="flex items-center justify-between p-2 rounded-xl bg-slate-950 border border-slate-850">
                    <span>Buku Brosur & Price List</span>
                    <span className="text-xs font-bold text-emerald-400 flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Tersedia
                    </span>
                  </div>
                  <div className="flex items-center justify-between p-2 rounded-xl bg-slate-950 border border-slate-850">
                    <span>Sampel Karton Kraft & E-commerce</span>
                    <span className="text-xs font-bold text-emerald-400 flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Lengkap
                    </span>
                  </div>
                  <div className="flex items-center justify-between p-2 rounded-xl bg-slate-950 border border-slate-850">
                    <span>Surat Perkenalan Penawaran</span>
                    <span className="text-xs font-bold text-emerald-400 flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Siap Cetak
                    </span>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* ============================================================ */}
      {/* MODAL: TAMBAH LEADS ONLINE */}
      {/* ============================================================ */}
      {showAddLeadModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
            <div className="p-6 border-b border-slate-800 flex items-center justify-between bg-slate-950">
              <div className="flex items-center gap-2.5">
                <Globe className="w-5 h-5 text-amber-400" />
                <h3 className="text-sm font-black text-white uppercase tracking-wider">Tambah Prospek Leads Digital</h3>
              </div>
              <button
                onClick={() => setShowAddLeadModal(false)}
                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition cursor-pointer"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddOnlineLead} className="p-6 space-y-4 overflow-y-auto flex-1">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-[10px] font-black uppercase text-slate-400 mb-1">Nama Perusahaan / Klien *</label>
                  <input
                    type="text"
                    required
                    placeholder="Contoh: PT Bogasari Utama"
                    value={newLeadName}
                    onChange={e => setNewLeadName(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl bg-slate-950 border border-slate-800 text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-amber-500/50"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-black uppercase text-slate-400 mb-1">Kota / Domisili *</label>
                  <input
                    type="text"
                    required
                    placeholder="Contoh: Surabaya"
                    value={newLeadCity}
                    onChange={e => setNewLeadCity(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl bg-slate-950 border border-slate-800 text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-amber-500/50"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-black uppercase text-slate-400 mb-1">Jenis Channel Masuk</label>
                  <select
                    value={newLeadChannel}
                    onChange={e => setNewLeadChannel(e.target.value as any)}
                    className="w-full px-3 py-2 text-xs rounded-xl bg-slate-950 border border-slate-800 text-slate-300 focus:outline-none focus:border-amber-500/50"
                  >
                    <option value="Website Form">Website Form</option>
                    <option value="WhatsApp Ads">WhatsApp Ads</option>
                    <option value="Instagram DM">Instagram DM</option>
                    <option value="TikTok Business">TikTok Business</option>
                    <option value="Google Search">Google Search</option>
                  </select>
                </div>

                <div className="col-span-2">
                  <label className="block text-[10px] font-black uppercase text-slate-400 mb-1">Spesifikasi Karton Kemasan</label>
                  <select
                    value={newLeadProduct}
                    onChange={e => setNewLeadProduct(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl bg-slate-950 border border-slate-800 text-slate-300 focus:outline-none focus:border-amber-500/50"
                  >
                    <option value="Karton Box Corrugated (A1)">Karton Box Corrugated (A1)</option>
                    <option value="Die-Cut Box E-Commerce">Die-Cut Box E-Commerce</option>
                    <option value="Sheet Corrugated Board">Sheet Corrugated Board</option>
                    <option value="Offset Printing Packaging">Offset Printing Packaging</option>
                    <option value="Heavy Duty Box">Heavy Duty Box</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-black uppercase text-slate-400 mb-1">Estimasi Volume (Pcs)</label>
                  <input
                    type="number"
                    value={newLeadVolume}
                    onChange={e => setNewLeadVolume(Number(e.target.value))}
                    className="w-full px-3 py-2 text-xs rounded-xl bg-slate-950 border border-slate-800 text-slate-200 focus:outline-none focus:border-amber-500/50"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-black uppercase text-slate-400 mb-1">Estimasi Budget (Rp)</label>
                  <input
                    type="number"
                    value={newLeadBudget}
                    onChange={e => setNewLeadBudget(Number(e.target.value))}
                    className="w-full px-3 py-2 text-xs rounded-xl bg-slate-950 border border-slate-800 text-slate-200 focus:outline-none focus:border-amber-500/50"
                  />
                </div>

                <div className="col-span-2">
                  <label className="block text-[10px] font-black uppercase text-slate-400 mb-1">Catatan Tambahan Prospek</label>
                  <textarea
                    rows={3}
                    placeholder="Tuliskan spesifikasi khusus, target SLA kirim, atau permintaan diskon Klien..."
                    value={newLeadNotes}
                    onChange={e => setNewLeadNotes(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl bg-slate-950 border border-slate-800 text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-amber-500/50 resize-none"
                  />
                </div>
              </div>

              <div className="pt-4 border-t border-slate-800 flex items-center justify-end gap-3 bg-slate-900">
                <button
                  type="button"
                  onClick={() => setShowAddLeadModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs transition cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs shadow-md transition cursor-pointer"
                >
                  Simpan Prospek
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* MODAL: INPUT LAPORAN KUNJUNGAN */}
      {/* ============================================================ */}
      {showAddVisitModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
            <div className="p-6 border-b border-slate-800 flex items-center justify-between bg-slate-950">
              <div className="flex items-center gap-2.5">
                <Megaphone className="w-5 h-5 text-amber-400" />
                <h3 className="text-sm font-black text-white uppercase tracking-wider">Input Laporan Canvasing Fisik</h3>
              </div>
              <button
                onClick={() => setShowAddVisitModal(false)}
                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition cursor-pointer"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddOfflineVisit} className="p-6 space-y-4 overflow-y-auto flex-1">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-[10px] font-black uppercase text-slate-400 mb-1">Nama Industri / Perusahaan *</label>
                  <input
                    type="text"
                    required
                    placeholder="Contoh: PT Sinar Lautan Food"
                    value={newVisitName}
                    onChange={e => setNewVisitName(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl bg-slate-950 border border-slate-800 text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-amber-500/50"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-black uppercase text-slate-400 mb-1">Kontak PIC / Jabatan *</label>
                  <input
                    type="text"
                    required
                    placeholder="Contoh: Pak Wahyu (Manajer Logistik)"
                    value={newVisitContact}
                    onChange={e => setNewVisitContact(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl bg-slate-950 border border-slate-800 text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-amber-500/50"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-black uppercase text-slate-400 mb-1">Wilayah / Kabupaten *</label>
                  <input
                    type="text"
                    required
                    placeholder="Contoh: Banyuwangi"
                    value={newVisitRegion}
                    onChange={e => setNewVisitRegion(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl bg-slate-950 border border-slate-800 text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-amber-500/50"
                  />
                </div>

                <div className="col-span-2">
                  <label className="block text-[10px] font-black uppercase text-slate-400 mb-1">Tujuan Canvasing / Kunjungan</label>
                  <input
                    type="text"
                    required
                    placeholder="Contoh: Penawaran Kemasan Die-Cut & Pencocokan Sampel"
                    value={newVisitPurpose}
                    onChange={e => setNewVisitPurpose(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl bg-slate-950 border border-slate-800 text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-amber-500/50"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-black uppercase text-slate-400 mb-1">Status Awal Progress</label>
                  <select
                    value={newVisitStatus}
                    onChange={e => setNewVisitStatus(e.target.value as any)}
                    className="w-full px-3 py-2 text-xs rounded-xl bg-slate-950 border border-slate-800 text-slate-300 focus:outline-none focus:border-amber-500/50"
                  >
                    <option value="Menunggu Follow-up">Menunggu Follow-up</option>
                    <option value="Kunjungan Selesai">Kunjungan Selesai</option>
                    <option value="Deal Kontrak">Deal Kontrak</option>
                    <option value="Tidak Tertarik">Tidak Tertarik</option>
                  </select>
                </div>

                <div className="col-span-2">
                  <label className="block text-[10px] font-black uppercase text-slate-400 mb-1">Hasil Kunjungan & Tindak Lanjut</label>
                  <textarea
                    rows={3}
                    placeholder="Tuliskan respon PIC, kendala harga, kebutuhan spesifikasi box mereka, atau jadwal follow up..."
                    value={newVisitOutcome}
                    onChange={e => setNewVisitOutcome(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl bg-slate-950 border border-slate-800 text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-amber-500/50 resize-none"
                  />
                </div>
              </div>

              <div className="pt-4 border-t border-slate-800 flex items-center justify-end gap-3 bg-slate-900">
                <button
                  type="button"
                  onClick={() => setShowAddVisitModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs transition cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs shadow-md transition cursor-pointer"
                >
                  Simpan Laporan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
