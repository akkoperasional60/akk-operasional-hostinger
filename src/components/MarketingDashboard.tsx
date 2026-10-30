import React, { useState, useEffect, useMemo } from 'react';
import * as XLSX from 'xlsx';
import {
  Globe,
  Megaphone,
  Plus,
  Search,
  TrendingUp,
  DollarSign,
  User,
  MapPin,
  Calendar,
  CheckCircle2,
  Sparkles,
  BarChart3,
  FileText,
  ShoppingBag,
  Download,
  Upload,
  Trash2,
  X,
  ClipboardCheck,
  ChevronLeft,
  ChevronRight
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

export interface OfflineVisitReport {
  id: string;
  tanggal: string;
  salesName: string;
  storeName: string;
  contactPerson: string;
  region: string;
  purpose: string;
  outcome: string;
  followUpDate: string;
  status: 'Selesai & Order' | 'Menunggu Follow-Up' | 'Kunjungan Rutin' | 'Belum Order';
}

export interface OfflineSalesReport {
  id: string;
  noNota: string;
  tanggal: string;
  salesName: string;
  storeName: string;
  region: string;
  kategoriBarang: string;
  namaBarang: string;
  qty: number;
  satuan: string;
  diskon: number;
  hargaSatuan: number;
  totalPenjualan: number;
  statusPembayaran: 'Lunas' | 'Tempo 14 Hari' | 'Tempo 30 Hari' | 'DP / Cicilan';
  catatan: string;
}

interface MarketingDashboardProps {
  activeTab: 'marketing_online' | 'marketing_offline';
}

// ============================================================
// INITIAL DATA
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
    date: '2026-10-20',
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
    date: '2026-10-18',
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
    date: '2026-10-15',
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
    date: '2026-10-21',
    status: 'Batal',
    notes: 'Spesifikasi karton terlalu tebal untuk kebutuhan mereka.'
  }
];

const initialVisitReports: OfflineVisitReport[] = [
  {
    id: 'KV-001',
    tanggal: '2026-10-28',
    salesName: 'Rendra Saputra',
    storeName: 'TK ANUGRAH SEKAR WANGI',
    contactPerson: 'Bpk. Hendra (0812-3456-7811)',
    region: 'Banyuwangi Kota',
    purpose: 'Pengecekan stok kemasan plastik HD/PE & penawaran Karton Box B-Flute',
    outcome: 'Repeat order 1.500 Pcs Karton Box 60x40x40 cm & 40 Ball Plastik HD',
    followUpDate: '2026-11-04',
    status: 'Selesai & Order'
  },
  {
    id: 'KV-002',
    tanggal: '2026-10-27',
    salesName: 'Dina Mariana',
    storeName: 'TK LIMA SEPULUH',
    contactPerson: 'Ibu Lilik (0813-5521-9088)',
    region: 'Genteng - Banyuwangi',
    purpose: 'Presentasi sampel Paper Bowl Kraft 650ml & Lunch Box Eco Size L',
    outcome: 'Pemilik toko cocok dengan kualitas food grade, langsung buka PO perdana',
    followUpDate: '2026-11-03',
    status: 'Selesai & Order'
  },
  {
    id: 'KV-003',
    tanggal: '2026-10-26',
    salesName: 'Rendra Saputra',
    storeName: 'TK PRATAMA SRONO',
    contactPerson: 'Bpk. Wahyu (0852-3310-4412)',
    region: 'Srono - Banyuwangi',
    purpose: 'Kunjungan rutin evaluasi penjualan kemasan & negosiasi kuota bulanan',
    outcome: 'Menunggu persetujuan harga grosir untuk pengambilan 5.000 Pcs Box Pizza',
    followUpDate: '2026-10-31',
    status: 'Menunggu Follow-Up'
  },
  {
    id: 'KV-004',
    tanggal: '2026-10-25',
    salesName: 'Bagus Setiawan',
    storeName: 'UD SUMBER REJEKI JEMBER',
    contactPerson: 'Bpk. H. Sulaiman (0811-3490-221)',
    region: 'Jember',
    purpose: 'Penawaran kontrak suplai Stretch Film Pallet Wrap & Lakban OPP Coklat',
    outcome: 'Order 30 Roll Stretch Film & 20 Karton Lakban OPP Heavy Duty',
    followUpDate: '2026-11-08',
    status: 'Selesai & Order'
  },
  {
    id: 'KV-005',
    tanggal: '2026-10-24',
    salesName: 'Dina Mariana',
    storeName: 'TOKO BERKAH JAYA ROGOJAMPI',
    contactPerson: 'Ibu Sari (0821-4409-1182)',
    region: 'Rogojampi - Banyuwangi',
    purpose: 'Kunjungan pengenalan katalog kemasan baru & cek display toko',
    outcome: 'Stok lama di gudang toko masih cukup untuk 1 minggu ke depan',
    followUpDate: '2026-11-01',
    status: 'Kunjungan Rutin'
  }
];

const initialSalesReports: OfflineSalesReport[] = [
  {
    id: 'SR-001',
    noNota: 'SO-AKK-2610-081',
    tanggal: '2026-10-28',
    salesName: 'Rendra Saputra',
    storeName: 'TK ANUGRAH SEKAR WANGI',
    region: 'Banyuwangi Kota',
    kategoriBarang: 'Karton Box Corrugated',
    namaBarang: 'Karton Box Corrugated B-Flute 60x40x40 cm (Polos)',
    qty: 1500,
    satuan: 'Pcs',
    diskon: 300000,
    hargaSatuan: 6800,
    totalPenjualan: 9900000,
    statusPembayaran: 'Lunas',
    catatan: 'Pengiriman terjadwal armada DC Banyuwangi'
  },
  {
    id: 'SR-002',
    noNota: 'SO-AKK-2610-082',
    tanggal: '2026-10-27',
    salesName: 'Dina Mariana',
    storeName: 'TK LIMA SEPULUH',
    region: 'Genteng - Banyuwangi',
    kategoriBarang: 'Paper Cup & Food Pack',
    namaBarang: 'Lunch Box Paper Eco Kraft Size L (Isi 500 Pcs)',
    qty: 25,
    satuan: 'Karton',
    diskon: 250000,
    hargaSatuan: 485000,
    totalPenjualan: 11875000,
    statusPembayaran: 'Tempo 14 Hari',
    catatan: 'Order hasil kunjungan sampel food grade'
  },
  {
    id: 'SR-003',
    noNota: 'SO-AKK-2610-083',
    tanggal: '2026-10-25',
    salesName: 'Bagus Setiawan',
    storeName: 'UD SUMBER REJEKI JEMBER',
    region: 'Jember',
    kategoriBarang: 'Plastik & Stretch Film',
    namaBarang: 'Stretch Film Pallet Wrap 50cm x 300m (17 Micron)',
    qty: 30,
    satuan: 'Roll',
    diskon: 150000,
    hargaSatuan: 195000,
    totalPenjualan: 5700000,
    statusPembayaran: 'Lunas',
    catatan: 'Pembayaran transfer BCA lunas sebelum muat'
  },
  {
    id: 'SR-004',
    noNota: 'SO-AKK-2610-084',
    tanggal: '2026-10-25',
    salesName: 'Bagus Setiawan',
    storeName: 'UD SUMBER REJEKI JEMBER',
    region: 'Jember',
    kategoriBarang: 'Lakban & Strapping Band',
    namaBarang: 'Lakban OPP Coklat Heavy Duty 48mm x 90 Yard',
    qty: 20,
    satuan: 'Karton',
    diskon: 400000,
    hargaSatuan: 640000,
    totalPenjualan: 12400000,
    statusPembayaran: 'Tempo 30 Hari',
    catatan: 'Kontrak suplai rutin bulanan area Jember'
  },
  {
    id: 'SR-005',
    noNota: 'SO-AKK-2610-085',
    tanggal: '2026-10-24',
    salesName: 'Rendra Saputra',
    storeName: 'MITRA KEMASAN MUNCAR',
    region: 'Muncar - Banyuwangi',
    kategoriBarang: 'Karton Box Double Wall',
    namaBarang: 'Karton Box Ekspor Waxed Tahan Lembab Cold Storage',
    qty: 2000,
    satuan: 'Pcs',
    diskon: 500000,
    hargaSatuan: 14500,
    totalPenjualan: 28500000,
    statusPembayaran: 'DP / Cicilan',
    catatan: 'DP 50% masuk, pelunasan saat barang tiba di gudang cold storage'
  }
];

const LS_KEY_ONLINE_LEADS = 'akk_marketing_online_leads_v2';
const LS_KEY_VISIT_REPORTS = 'akk_marketing_offline_visit_reports_v2';
const LS_KEY_SALES_REPORTS = 'akk_marketing_offline_sales_reports_v2';

export const MarketingDashboard: React.FC<MarketingDashboardProps> = ({ activeTab }) => {
  // --- Sub-tab for Marketing Offline: 'kunjungan' | 'penjualan' ---
  const [offlineSubTab, setOfflineSubTab] = useState<'kunjungan' | 'penjualan'>('kunjungan');

  // --- Popup notification modal (supports Enter key) ---
  const [popupModal, setPopupModal] = useState<{ title: string; message: string } | null>(null);

  useEffect(() => {
    if (!popupModal) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === 'Escape') {
        e.preventDefault();
        setPopupModal(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [popupModal]);

  // --- Persistent Online Leads State ---
  const [onlineLeads, setOnlineLeads] = useState<OnlineLead[]>(() => {
    try {
      const saved = localStorage.getItem(LS_KEY_ONLINE_LEADS);
      return saved ? JSON.parse(saved) : initialOnlineLeads;
    } catch {
      return initialOnlineLeads;
    }
  });

  // --- Persistent Offline Visit Reports State ---
  const [visitReports, setVisitReports] = useState<OfflineVisitReport[]>(() => {
    try {
      const saved = localStorage.getItem(LS_KEY_VISIT_REPORTS);
      return saved ? JSON.parse(saved) : initialVisitReports;
    } catch {
      return initialVisitReports;
    }
  });

  // --- Persistent Offline Sales Reports State ---
  const [salesReports, setSalesReports] = useState<OfflineSalesReport[]>(() => {
    try {
      const saved = localStorage.getItem(LS_KEY_SALES_REPORTS);
      return saved ? JSON.parse(saved) : initialSalesReports;
    } catch {
      return initialSalesReports;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(LS_KEY_ONLINE_LEADS, JSON.stringify(onlineLeads));
    } catch {}
  }, [onlineLeads]);

  useEffect(() => {
    try {
      localStorage.setItem(LS_KEY_VISIT_REPORTS, JSON.stringify(visitReports));
    } catch {}
  }, [visitReports]);

  useEffect(() => {
    try {
      localStorage.setItem(LS_KEY_SALES_REPORTS, JSON.stringify(salesReports));
    } catch {}
  }, [salesReports]);

  // --- Online Filters ---
  const [onlineSearch, setOnlineSearch] = useState('');
  const [onlineFilterStatus, setOnlineFilterStatus] = useState<string>('all');
  const [onlineFilterChannel, setOnlineFilterChannel] = useState<string>('all');

  // --- Offline Visit Filters & Pagination ---
  const [visitSearch, setVisitSearch] = useState('');
  const [visitStatusFilter, setVisitStatusFilter] = useState<string>('ALL');
  const [visitRegionFilter, setVisitRegionFilter] = useState<string>('ALL');
  const [visitPage, setVisitPage] = useState(1);
  const [visitPageSize, setVisitPageSize] = useState(10);

  // --- Offline Sales Filters & Pagination ---
  const [salesSearch, setSalesSearch] = useState('');
  const [salesDateFilter, setSalesDateFilter] = useState<string>('ALL');
  const [salesPersonFilter, setSalesPersonFilter] = useState<string>('ALL');
  const [salesPaymentFilter, setSalesPaymentFilter] = useState<string>('ALL');
  const [salesKategoriFilter, setSalesKategoriFilter] = useState<string>('ALL');
  const [salesPage, setSalesPage] = useState(1);
  const [salesPageSize, setSalesPageSize] = useState(10);

  // --- Modals ---
  const [showAddLeadModal, setShowAddLeadModal] = useState(false);
  const [showAddVisitModal, setShowAddVisitModal] = useState(false);
  const [showAddSalesModal, setShowAddSalesModal] = useState(false);

  // --- New Lead Form Fields ---
  const [newLeadName, setNewLeadName] = useState('');
  const [newLeadCity, setNewLeadCity] = useState('');
  const [newLeadProduct, setNewLeadProduct] = useState('Karton Box Corrugated (A1)');
  const [newLeadVolume, setNewLeadVolume] = useState<number>(10000);
  const [newLeadBudget, setNewLeadBudget] = useState<number>(25000000);
  const [newLeadChannel, setNewLeadChannel] = useState<'Google Search' | 'WhatsApp Ads' | 'Instagram DM' | 'TikTok Business' | 'Website Form'>('Website Form');
  const [newLeadNotes, setNewLeadNotes] = useState('');

  // --- New Visit Form Fields ---
  const [visitForm, setVisitForm] = useState<{
    tanggal: string;
    salesName: string;
    storeName: string;
    contactPerson: string;
    region: string;
    purpose: string;
    outcome: string;
    followUpDate: string;
    status: OfflineVisitReport['status'];
  }>({
    tanggal: new Date().toISOString().split('T')[0],
    salesName: 'Rendra Saputra',
    storeName: '',
    contactPerson: '',
    region: 'Banyuwangi Kota',
    purpose: '',
    outcome: '',
    followUpDate: new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0],
    status: 'Selesai & Order'
  });

  // --- New Sales Form Fields ---
  const [salesForm, setSalesForm] = useState<{
    noNota: string;
    tanggal: string;
    salesName: string;
    storeName: string;
    region: string;
    kategoriBarang: string;
    namaBarang: string;
    qty: number;
    satuan: string;
    diskon: number;
    hargaSatuan: number;
    statusPembayaran: OfflineSalesReport['statusPembayaran'];
    catatan: string;
  }>({
    noNota: `SO-AKK-2610-${String(initialSalesReports.length + 85).padStart(3, '0')}`,
    tanggal: new Date().toISOString().split('T')[0],
    salesName: 'Rendra Saputra',
    storeName: '',
    region: 'Banyuwangi Kota',
    kategoriBarang: 'Karton Box Corrugated',
    namaBarang: 'Karton Box Corrugated B-Flute 60x40x40 cm (Polos)',
    qty: 500,
    satuan: 'Pcs',
    diskon: 0,
    hargaSatuan: 6800,
    statusPembayaran: 'Lunas',
    catatan: ''
  });

  // --- Online Actions ---
  const handleAddOnlineLead = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLeadName || !newLeadCity) return;

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
    setNewLeadName('');
    setNewLeadCity('');
    setNewLeadProduct('Karton Box Corrugated (A1)');
    setNewLeadVolume(10000);
    setNewLeadBudget(25000000);
    setNewLeadChannel('Website Form');
    setNewLeadNotes('');
    setPopupModal({
      title: 'Prospek Online Disimpan',
      message: `Data prospek "${newLead.clientName}" berhasil disimpan ke sistem.`
    });
  };

  const updateLeadStatus = (id: string, newStatus: OnlineLead['status']) => {
    setOnlineLeads(prev =>
      prev.map(lead => (lead.id === id ? { ...lead, status: newStatus } : lead))
    );
  };

  // --- Offline Visit Actions ---
  const handleAddVisitReport = (e: React.FormEvent) => {
    e.preventDefault();
    if (!visitForm.storeName.trim() || !visitForm.salesName.trim()) return;

    const newVisit: OfflineVisitReport = {
      id: `KV-${String(visitReports.length + 1).padStart(3, '0')}`,
      tanggal: visitForm.tanggal,
      salesName: visitForm.salesName.trim(),
      storeName: visitForm.storeName.trim().toUpperCase(),
      contactPerson: visitForm.contactPerson.trim() || '-',
      region: visitForm.region.trim() || 'Banyuwangi',
      purpose: visitForm.purpose.trim() || 'Kunjungan Sales & Cek Stok',
      outcome: visitForm.outcome.trim() || 'Tercatat di laporan kunjungan',
      followUpDate: visitForm.followUpDate,
      status: visitForm.status
    };

    setVisitReports([newVisit, ...visitReports]);
    setShowAddVisitModal(false);
    setVisitForm({
      ...visitForm,
      storeName: '',
      contactPerson: '',
      purpose: '',
      outcome: ''
    });
    setPopupModal({
      title: 'Laporan Kunjungan Disimpan',
      message: `Laporan kunjungan ke "${newVisit.storeName}" oleh ${newVisit.salesName} berhasil disimpan.`
    });
  };

  const handleUpdateVisitStatus = (id: string, status: OfflineVisitReport['status']) => {
    setVisitReports(prev => prev.map(v => (v.id === id ? { ...v, status } : v)));
  };

  const handleDeleteVisit = (id: string) => {
    setVisitReports(prev => prev.filter(v => v.id !== id));
  };

  const handleExportVisitExcel = () => {
    const rows = filteredVisits.map((v, i) => ({
      No: i + 1,
      'Kode Kunjungan': v.id,
      'Tanggal Kunjungan': v.tanggal,
      'Sales / Marketing': v.salesName,
      'Nama Toko / Pelanggan': v.storeName,
      'PIC / Kontak': v.contactPerson,
      Wilayah: v.region,
      'Tujuan Kunjungan': v.purpose,
      'Hasil Kunjungan': v.outcome,
      'Tgl Follow-Up': v.followUpDate,
      'Status Kunjungan': v.status
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Laporan_Kunjungan');
    XLSX.writeFile(wb, `Laporan_Kunjungan_Marketing_AKK_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  // --- Offline Sales Actions ---
  const handleAddSalesReport = (e: React.FormEvent) => {
    e.preventDefault();
    if (!salesForm.storeName.trim() || !salesForm.namaBarang.trim()) return;

    const gross = Math.max(0, Number(salesForm.qty) * Number(salesForm.hargaSatuan));
    const diskonNominal = Math.max(0, Number(salesForm.diskon) || 0);
    const total = Math.max(0, gross - diskonNominal);
    const newSale: OfflineSalesReport = {
      id: `SR-${String(salesReports.length + 1).padStart(3, '0')}`,
      noNota: salesForm.noNota.trim() || `SO-AKK-2610-${String(salesReports.length + 85).padStart(3, '0')}`,
      tanggal: salesForm.tanggal,
      salesName: salesForm.salesName.trim(),
      storeName: salesForm.storeName.trim().toUpperCase(),
      region: salesForm.region.trim() || 'Banyuwangi',
      kategoriBarang: salesForm.kategoriBarang,
      namaBarang: salesForm.namaBarang.trim(),
      qty: Number(salesForm.qty) || 1,
      satuan: salesForm.satuan,
      diskon: diskonNominal,
      hargaSatuan: Number(salesForm.hargaSatuan) || 0,
      totalPenjualan: total,
      statusPembayaran: salesForm.statusPembayaran,
      catatan: salesForm.catatan.trim()
    };

    setSalesReports([newSale, ...salesReports]);
    setShowAddSalesModal(false);
    setSalesForm({
      ...salesForm,
      noNota: `SO-AKK-2610-${String(salesReports.length + 86).padStart(3, '0')}`,
      storeName: '',
      diskon: 0,
      catatan: ''
    });
    setPopupModal({
      title: 'Laporan Penjualan Disimpan',
      message: `Penjualan ${newSale.noNota} untuk "${newSale.storeName}" senilai Rp ${total.toLocaleString('id-ID')} berhasil disimpan.`
    });
  };

  const handleExportSalesExcel = () => {
    const rows = filteredSales.map(s => ({
      'No Nota/Faktur & Tanggal': `${s.noNota} (${s.tanggal})`,
      'Nama Toko/Pelanggan': s.storeName,
      'Kategori Barang': s.kategoriBarang,
      Qty: s.qty,
      Satuan: s.satuan,
      Diskon: s.diskon || 0,
      Harga: s.totalPenjualan
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Laporan_Penjualan');
    XLSX.writeFile(wb, `Laporan_Penjualan_Marketing_AKK_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  // --- Filtered Lists ---
  const filteredOnlineLeads = onlineLeads.filter(lead => {
    const matchesSearch =
      lead.clientName.toLowerCase().includes(onlineSearch.toLowerCase()) ||
      lead.city.toLowerCase().includes(onlineSearch.toLowerCase()) ||
      lead.productType.toLowerCase().includes(onlineSearch.toLowerCase());
    const matchesStatus = onlineFilterStatus === 'all' || lead.status === onlineFilterStatus;
    const matchesChannel = onlineFilterChannel === 'all' || lead.channel === onlineFilterChannel;
    return matchesSearch && matchesStatus && matchesChannel;
  });

  const availableVisitRegions = useMemo(() => {
    const set = new Set<string>();
    visitReports.forEach(v => {
      if (v.region) set.add(v.region);
    });
    return Array.from(set);
  }, [visitReports]);

  const filteredVisits = useMemo(() => {
    const q = visitSearch.trim().toLowerCase();
    return visitReports.filter(v => {
      const matchSearch =
        !q ||
        v.storeName.toLowerCase().includes(q) ||
        v.salesName.toLowerCase().includes(q) ||
        v.region.toLowerCase().includes(q) ||
        v.purpose.toLowerCase().includes(q) ||
        v.outcome.toLowerCase().includes(q) ||
        v.id.toLowerCase().includes(q);
      const matchStatus = visitStatusFilter === 'ALL' || v.status === visitStatusFilter;
      const matchRegion = visitRegionFilter === 'ALL' || v.region === visitRegionFilter;
      return matchSearch && matchStatus && matchRegion;
    });
  }, [visitReports, visitSearch, visitStatusFilter, visitRegionFilter]);

  const totalVisitPages = Math.max(1, Math.ceil(filteredVisits.length / visitPageSize));
  const currentVisitPage = Math.min(visitPage, totalVisitPages);
  const paginatedVisits = filteredVisits.slice(
    (currentVisitPage - 1) * visitPageSize,
    currentVisitPage * visitPageSize
  );

  const availableSalesKategori = useMemo(() => {
    const set = new Set<string>();
    salesReports.forEach(s => {
      if (s.kategoriBarang) set.add(s.kategoriBarang);
    });
    return Array.from(set);
  }, [salesReports]);

  const availableSalesPersons = useMemo(() => {
    const set = new Set<string>(['Rendra Saputra', 'Dina Mariana', 'Bagus Setiawan']);
    salesReports.forEach(s => {
      if (s.salesName) set.add(s.salesName);
    });
    visitReports.forEach(v => {
      if (v.salesName) set.add(v.salesName);
    });
    return Array.from(set);
  }, [salesReports, visitReports]);

  const dailyCalendarDates = useMemo(() => {
    const dateSet = new Set<string>();
    salesReports.forEach(s => {
      if (s.tanggal) dateSet.add(s.tanggal);
    });
    // Also add 7 recent days up to 2026-10-29 so daily calendar strip always has rich daily dates
    const baseDates = [
      '2026-10-23',
      '2026-10-24',
      '2026-10-25',
      '2026-10-26',
      '2026-10-27',
      '2026-10-28',
      '2026-10-29'
    ];
    baseDates.forEach(d => dateSet.add(d));
    if (salesDateFilter !== 'ALL' && salesDateFilter) {
      dateSet.add(salesDateFilter);
    }
    return Array.from(dateSet).sort((a, b) => a.localeCompare(b));
  }, [salesReports, salesDateFilter]);

  const filteredSales = useMemo(() => {
    const q = salesSearch.trim().toLowerCase();
    return salesReports.filter(s => {
      const matchSearch =
        !q ||
        s.noNota.toLowerCase().includes(q) ||
        s.storeName.toLowerCase().includes(q) ||
        s.salesName.toLowerCase().includes(q) ||
        s.kategoriBarang.toLowerCase().includes(q) ||
        s.namaBarang.toLowerCase().includes(q) ||
        s.region.toLowerCase().includes(q);
      const matchDate = salesDateFilter === 'ALL' || s.tanggal === salesDateFilter;
      const matchSalesPerson = salesPersonFilter === 'ALL' || s.salesName === salesPersonFilter;
      const matchPayment = salesPaymentFilter === 'ALL' || s.statusPembayaran === salesPaymentFilter;
      const matchKat = salesKategoriFilter === 'ALL' || s.kategoriBarang === salesKategoriFilter;
      return matchSearch && matchDate && matchSalesPerson && matchPayment && matchKat;
    });
  }, [salesReports, salesSearch, salesDateFilter, salesPersonFilter, salesPaymentFilter, salesKategoriFilter]);

  const totalSalesPages = Math.max(1, Math.ceil(filteredSales.length / salesPageSize));
  const currentSalesPage = Math.min(salesPage, totalSalesPages);
  const paginatedSales = filteredSales.slice(
    (currentSalesPage - 1) * salesPageSize,
    currentSalesPage * salesPageSize
  );

  // --- Real-time Metrics ---
  const totalLeadBudget = onlineLeads.reduce((acc, lead) => acc + (lead.status !== 'Batal' ? lead.budgetIDR : 0), 0);
  const totalDealsValue = onlineLeads
    .filter(l => l.status === 'Deal / SPK')
    .reduce((acc, l) => acc + l.budgetIDR, 0);
  const totalLeadsCount = onlineLeads.length;
  const dealLeadsCount = onlineLeads.filter(l => l.status === 'Deal / SPK').length;
  const conversionRate = totalLeadsCount > 0 ? ((dealLeadsCount / totalLeadsCount) * 100).toFixed(1) : '0';

  const totalVisitsCount = visitReports.length;
  const orderVisitsCount = visitReports.filter(v => v.status === 'Selesai & Order').length;
  const visitOrderRate = totalVisitsCount > 0 ? ((orderVisitsCount / totalVisitsCount) * 100).toFixed(1) : '0';
  const totalOfflineSalesOmset = salesReports.reduce((sum, s) => sum + s.totalPenjualan, 0);
  const totalFilteredSalesOmset = filteredSales.reduce((sum, s) => sum + s.totalPenjualan, 0);

  // ============================================================
  // RENDER: MARKETING OFFLINE (LAPORAN KUNJUNGAN & LAPORAN PENJUALAN)
  // ============================================================
  if (activeTab === 'marketing_offline') {
    return (
      <div className="space-y-5" id="marketing_offline_hub">
        {/* TOP HEADER BANNER */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="w-11 h-11 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shrink-0">
              <Megaphone className="w-5 h-5" />
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
                  DEPARTEMEN MARKETING OFFLINE AKK
                </span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-500/30">
                  Aktif Terintegrasi
                </span>
              </div>
              <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-white tracking-tight">
                Laporan Kunjungan &amp; Laporan Penjualan Marketing Offline
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Pencatatan terpadu kunjungan sales lapangan ke toko/pelanggan serta rekapitulasi realisasi penjualan kemasan PT Anugrah Kemasan Kreatif.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setShowAddVisitModal(true)}
              className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-1.5 transition cursor-pointer shadow-xs"
            >
              <Plus className="w-4 h-4" />
              <span>Input Laporan Kunjungan</span>
            </button>
            <button
              type="button"
              onClick={() => setShowAddSalesModal(true)}
              className="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs flex items-center gap-1.5 transition cursor-pointer shadow-xs"
            >
              <Plus className="w-4 h-4" />
              <span>Input Laporan Penjualan</span>
            </button>
          </div>
        </div>

        {/* KPI SUMMARY CARDS */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-2xl shadow-xs">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Total Laporan Kunjungan
              </span>
              <MapPin className="w-4 h-4 text-emerald-500" />
            </div>
            <div className="text-xl font-black text-slate-900 dark:text-white font-mono">
              {totalVisitsCount} Kunjungan
            </div>
            <p className="text-[11px] text-slate-500 mt-1">
              {orderVisitsCount} kunjungan menghasilkan order langsung ({visitOrderRate}%)
            </p>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-2xl shadow-xs">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Total Penjualan Offline
              </span>
              <ShoppingBag className="w-4 h-4 text-indigo-500" />
            </div>
            <div className="text-xl font-black text-emerald-600 dark:text-emerald-400 font-mono">
              Rp {totalOfflineSalesOmset.toLocaleString('id-ID')}
            </div>
            <p className="text-[11px] text-slate-500 mt-1">
              Dari {salesReports.length} nota transaksi penjualan toko/mitra
            </p>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-2xl shadow-xs">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Nota Penjualan Lunas
              </span>
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
            </div>
            <div className="text-xl font-black text-slate-900 dark:text-white font-mono">
              {salesReports.filter(s => s.statusPembayaran === 'Lunas').length} / {salesReports.length} Nota
            </div>
            <p className="text-[11px] text-slate-500 mt-1">
              Sisanya pembayaran tempo / bertahap
            </p>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-2xl shadow-xs">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Perlu Tindak Lanjut (Follow-Up)
              </span>
              <Calendar className="w-4 h-4 text-amber-500" />
            </div>
            <div className="text-xl font-black text-amber-600 dark:text-amber-400 font-mono">
              {visitReports.filter(v => v.status === 'Menunggu Follow-Up').length} Toko
            </div>
            <p className="text-[11px] text-slate-500 mt-1">
              Menunggu konfirmasi PO atau negosiasi harga
            </p>
          </div>
        </div>

        {/* SUB-NAVIGATION SWITCHER: LAPORAN KUNJUNGAN VS LAPORAN PENJUALAN */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-2 flex flex-wrap items-center justify-between gap-3 shadow-xs">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setOfflineSubTab('kunjungan')}
              className={`px-4 py-2.5 rounded-xl text-xs font-black flex items-center gap-2 transition cursor-pointer ${
                offlineSubTab === 'kunjungan'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              <ClipboardCheck className="w-4 h-4" />
              <span>1. Laporan Kunjungan ({visitReports.length})</span>
            </button>

            <button
              type="button"
              onClick={() => setOfflineSubTab('penjualan')}
              className={`px-4 py-2.5 rounded-xl text-xs font-black flex items-center gap-2 transition cursor-pointer ${
                offlineSubTab === 'penjualan'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              <ShoppingBag className="w-4 h-4" />
              <span>2. Laporan Penjualan ({salesReports.length})</span>
            </button>
          </div>

          <div className="flex items-center gap-2 pr-1">
            {offlineSubTab === 'kunjungan' ? (
              <button
                type="button"
                onClick={handleExportVisitExcel}
                className="px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Ekspor Excel Kunjungan</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={handleExportSalesExcel}
                className="px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Ekspor Excel Penjualan</span>
              </button>
            )}
          </div>
        </div>

        {/* ============================================================ */}
        {/* SUB-TAB 1: LAPORAN KUNJUNGAN                                 */}
        {/* ============================================================ */}
        {offlineSubTab === 'kunjungan' && (
          <div className="space-y-4">
            {/* Search & Filter Bar */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={visitSearch}
                  onChange={e => {
                    setVisitSearch(e.target.value);
                    setVisitPage(1);
                  }}
                  placeholder="Cari Nama Toko, Sales Marketing, Wilayah, atau Catatan Kunjungan..."
                  className="w-full pl-10 pr-4 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <select
                  value={visitRegionFilter}
                  onChange={e => {
                    setVisitRegionFilter(e.target.value);
                    setVisitPage(1);
                  }}
                  className="px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs font-bold text-slate-800 dark:text-slate-200 cursor-pointer"
                >
                  <option value="ALL">Semua Wilayah ({availableVisitRegions.length})</option>
                  {availableVisitRegions.map(reg => (
                    <option key={reg} value={reg}>
                      {reg}
                    </option>
                  ))}
                </select>

                <select
                  value={visitStatusFilter}
                  onChange={e => {
                    setVisitStatusFilter(e.target.value);
                    setVisitPage(1);
                  }}
                  className="px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs font-bold text-slate-800 dark:text-slate-200 cursor-pointer"
                >
                  <option value="ALL">Semua Status Hasil</option>
                  <option value="Selesai & Order">Selesai &amp; Order</option>
                  <option value="Menunggu Follow-Up">Menunggu Follow-Up</option>
                  <option value="Kunjungan Rutin">Kunjungan Rutin</option>
                  <option value="Belum Order">Belum Order</option>
                </select>

                <select
                  value={visitPageSize}
                  onChange={e => {
                    setVisitPageSize(Number(e.target.value));
                    setVisitPage(1);
                  }}
                  className="px-2.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs font-bold text-slate-800 dark:text-slate-200 cursor-pointer"
                >
                  <option value={5}>5 / Hal</option>
                  <option value={10}>10 / Hal</option>
                  <option value={20}>20 / Hal</option>
                </select>
              </div>
            </div>

            {/* Table Laporan Kunjungan */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-xs">
              <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-black text-slate-900 dark:text-white">
                    Daftar Laporan Kunjungan Sales &amp; Marketing Offline
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Rekapitulasi aktivitas kunjungan tatap muka ke toko ritel, mitra grosir, dan pabrik pelanggan.
                  </p>
                </div>
                <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
                  Total: {filteredVisits.length} Kunjungan
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-50 dark:bg-slate-950 text-slate-600 dark:text-slate-400 uppercase font-bold text-[10px] border-b border-slate-200 dark:border-slate-800">
                    <tr>
                      <th className="py-3 px-4">Kode &amp; Tanggal</th>
                      <th className="py-3 px-4">Sales / Marketing</th>
                      <th className="py-3 px-4">Nama Toko / Pelanggan</th>
                      <th className="py-3 px-4">Tujuan &amp; Agenda Kunjungan</th>
                      <th className="py-3 px-4">Hasil Kunjungan / Catatan</th>
                      <th className="py-3 px-4">Jadwal Follow-Up</th>
                      <th className="py-3 px-4">Status Kunjungan</th>
                      <th className="py-3 px-4 text-right">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-800 text-slate-800 dark:text-slate-200">
                    {paginatedVisits.length > 0 ? (
                      paginatedVisits.map(visit => (
                        <tr key={visit.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition">
                          <td className="py-3 px-4">
                            <div className="font-mono font-bold text-emerald-600 dark:text-emerald-400">{visit.id}</div>
                            <div className="text-[11px] text-slate-500 font-mono mt-0.5">{visit.tanggal}</div>
                          </td>
                          <td className="py-3 px-4">
                            <div className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                              <User className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                              <span>{visit.salesName}</span>
                            </div>
                            <div className="text-[11px] text-slate-500 flex items-center gap-1 mt-0.5">
                              <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                              <span>{visit.region}</span>
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            <div className="font-bold text-slate-900 dark:text-white">{visit.storeName}</div>
                            <div className="text-[11px] text-slate-500 mt-0.5">{visit.contactPerson}</div>
                          </td>
                          <td className="py-3 px-4 max-w-[220px]">
                            <div className="text-slate-700 dark:text-slate-300 leading-relaxed">{visit.purpose}</div>
                          </td>
                          <td className="py-3 px-4 max-w-[240px]">
                            <div className="font-medium text-slate-800 dark:text-slate-200 leading-relaxed">
                              {visit.outcome}
                            </div>
                          </td>
                          <td className="py-3 px-4 font-mono text-[11px] font-semibold text-amber-600 dark:text-amber-400">
                            {visit.followUpDate || '-'}
                          </td>
                          <td className="py-3 px-4">
                            <select
                              value={visit.status}
                              onChange={e => handleUpdateVisitStatus(visit.id, e.target.value as OfflineVisitReport['status'])}
                              className={`text-[11px] font-bold px-2.5 py-1 rounded-lg border cursor-pointer focus:outline-none ${
                                visit.status === 'Selesai & Order'
                                  ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30'
                                  : visit.status === 'Menunggu Follow-Up'
                                  ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30'
                                  : visit.status === 'Kunjungan Rutin'
                                  ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30'
                                  : 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/30'
                              }`}
                            >
                              <option value="Selesai & Order">Selesai &amp; Order</option>
                              <option value="Menunggu Follow-Up">Menunggu Follow-Up</option>
                              <option value="Kunjungan Rutin">Kunjungan Rutin</option>
                              <option value="Belum Order">Belum Order</option>
                            </select>
                          </td>
                          <td className="py-3 px-4 text-right">
                            <button
                              type="button"
                              onClick={() => handleDeleteVisit(visit.id)}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-500/10 transition cursor-pointer"
                              title="Hapus Laporan Kunjungan"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={8} className="py-8 text-center text-slate-400 text-xs">
                          Tidak ada data laporan kunjungan yang sesuai dengan pencarian.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              <div className="p-4 border-t border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                <div className="text-slate-500 dark:text-slate-400">
                  Menampilkan{' '}
                  <strong className="text-slate-900 dark:text-white">
                    {filteredVisits.length === 0 ? 0 : (currentVisitPage - 1) * visitPageSize + 1}
                  </strong>{' '}
                  &ndash;{' '}
                  <strong className="text-slate-900 dark:text-white">
                    {Math.min(currentVisitPage * visitPageSize, filteredVisits.length)}
                  </strong>{' '}
                  dari <strong className="text-slate-900 dark:text-white">{filteredVisits.length}</strong> laporan kunjungan
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    disabled={currentVisitPage <= 1}
                    onClick={() => setVisitPage(p => Math.max(1, p - 1))}
                    className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-700 dark:text-slate-300 font-bold disabled:opacity-40 cursor-pointer flex items-center gap-1"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                    <span>Sebelumnya</span>
                  </button>
                  <button
                    type="button"
                    disabled={currentVisitPage >= totalVisitPages}
                    onClick={() => setVisitPage(p => Math.min(totalVisitPages, p + 1))}
                    className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-700 dark:text-slate-300 font-bold disabled:opacity-40 cursor-pointer flex items-center gap-1"
                  >
                    <span>Selanjutnya</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ============================================================ */}
        {/* SUB-TAB 2: LAPORAN PENJUALAN                                 */}
        {/* ============================================================ */}
        {offlineSubTab === 'penjualan' && (
          <div className="space-y-4">
            {/* KALENDER HARIAN TANGGAL & PILIHAN DROPDOWN NAMA SALES */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-xs space-y-4">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-3.5">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shrink-0">
                    <Calendar className="w-4.5 h-4.5" />
                  </div>
                  <div>
                    <div className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider">
                      Kalender Harian Tanggal &amp; Filter Sales
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      Pilih tanggal harian pada kalender atau pilih nama sales untuk memfilter nota penjualan
                    </p>
                  </div>
                </div>

                {/* Pilihan Dropdown Nama Sales + Input Kalender Tanggal */}
                <div className="flex flex-wrap items-center gap-2.5">
                  <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-1.5">
                    <User className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                    <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400">Nama Sales:</span>
                    <select
                      value={salesPersonFilter}
                      onChange={e => {
                        setSalesPersonFilter(e.target.value);
                        setSalesPage(1);
                      }}
                      className="bg-transparent text-xs font-black text-slate-900 dark:text-white focus:outline-none cursor-pointer pr-1"
                    >
                      <option value="ALL">Semua Sales ({availableSalesPersons.length})</option>
                      {availableSalesPersons.map(person => (
                        <option key={person} value={person}>
                          {person}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-1.5">
                    <Calendar className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                    <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400">Pilih Tanggal:</span>
                    <input
                      type="date"
                      value={salesDateFilter === 'ALL' ? '' : salesDateFilter}
                      onChange={e => {
                        setSalesDateFilter(e.target.value ? e.target.value : 'ALL');
                        setSalesPage(1);
                      }}
                      className="bg-transparent text-xs font-mono font-bold text-slate-900 dark:text-white focus:outline-none cursor-pointer"
                    />
                    {salesDateFilter !== 'ALL' && (
                      <button
                        type="button"
                        onClick={() => {
                          setSalesDateFilter('ALL');
                          setSalesPage(1);
                        }}
                        className="text-[10px] font-bold text-rose-500 hover:underline ml-1 cursor-pointer"
                      >
                        Reset
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Strip Kalender Harian Tanggal */}
              <div className="flex items-center gap-2 overflow-x-auto pb-1">
                <button
                  type="button"
                  onClick={() => {
                    setSalesDateFilter('ALL');
                    setSalesPage(1);
                  }}
                  className={`px-3.5 py-2 rounded-xl text-xs font-black shrink-0 border transition cursor-pointer flex flex-col items-center justify-center min-w-[96px] ${
                    salesDateFilter === 'ALL'
                      ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                      : 'bg-slate-50 dark:bg-slate-950 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-800 hover:border-indigo-400'
                  }`}
                >
                  <span className="text-[10px] uppercase tracking-wider opacity-80">Kalender</span>
                  <span>Semua Tanggal</span>
                  <span className="text-[10px] font-mono mt-0.5 opacity-90">{salesReports.length} Nota</span>
                </button>

                {dailyCalendarDates.map(dateStr => {
                  const countForDate = salesReports.filter(
                    s => s.tanggal === dateStr && (salesPersonFilter === 'ALL' || s.salesName === salesPersonFilter)
                  ).length;
                  const parsed = new Date(`${dateStr}T00:00:00`);
                  const dayName = isNaN(parsed.getTime())
                    ? 'Harian'
                    : parsed.toLocaleDateString('id-ID', { weekday: 'short' });
                  const dayNumMonth = isNaN(parsed.getTime())
                    ? dateStr
                    : parsed.toLocaleDateString('id-ID', { day: '2-digit', month: 'short' });
                  const isSelected = salesDateFilter === dateStr;

                  return (
                    <button
                      key={dateStr}
                      type="button"
                      onClick={() => {
                        setSalesDateFilter(isSelected ? 'ALL' : dateStr);
                        setSalesPage(1);
                      }}
                      className={`px-3.5 py-2 rounded-xl text-xs shrink-0 border transition cursor-pointer flex flex-col items-center justify-center min-w-[88px] ${
                        isSelected
                          ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs font-black'
                          : countForDate > 0
                          ? 'bg-indigo-50/60 dark:bg-indigo-950/30 text-slate-900 dark:text-white border-indigo-200 dark:border-indigo-800/60 hover:border-indigo-400 font-bold'
                          : 'bg-slate-50 dark:bg-slate-950 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-800 hover:border-slate-400'
                      }`}
                    >
                      <span className="text-[10px] uppercase tracking-wider opacity-75">{dayName}</span>
                      <span className="font-mono text-xs font-black">{dayNumMonth}</span>
                      <span
                        className={`text-[10px] font-mono mt-0.5 ${
                          isSelected
                            ? 'text-indigo-100'
                            : countForDate > 0
                            ? 'text-indigo-600 dark:text-indigo-400 font-bold'
                            : 'text-slate-400'
                        }`}
                      >
                        {countForDate} Nota
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Search & Kategori Bar */}
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pt-1">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={salesSearch}
                    onChange={e => {
                      setSalesSearch(e.target.value);
                      setSalesPage(1);
                    }}
                    placeholder="Cari No. Nota / Faktur, Nama Toko / Pelanggan, atau Kategori Barang..."
                    className="w-full pl-10 pr-4 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <select
                    value={salesKategoriFilter}
                    onChange={e => {
                      setSalesKategoriFilter(e.target.value);
                      setSalesPage(1);
                    }}
                    className="px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs font-bold text-slate-800 dark:text-slate-200 cursor-pointer"
                  >
                    <option value="ALL">Semua Kategori Barang</option>
                    {availableSalesKategori.map(kat => (
                      <option key={kat} value={kat}>
                        {kat}
                      </option>
                    ))}
                  </select>

                  <select
                    value={salesPageSize}
                    onChange={e => {
                      setSalesPageSize(Number(e.target.value));
                      setSalesPage(1);
                    }}
                    className="px-2.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs font-bold text-slate-800 dark:text-slate-200 cursor-pointer"
                  >
                    <option value={5}>5 / Hal</option>
                    <option value={10}>10 / Hal</option>
                    <option value={20}>20 / Hal</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Table Laporan Penjualan (7 Kolom Sesuai Spesifikasi) */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-xs">
              <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="text-sm font-black text-slate-900 dark:text-white">
                    Tabel Laporan Penjualan Marketing Offline
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Menampilkan No Nota/Faktur &amp; Tanggal, Nama Toko/Pelanggan, Kategori Barang, Qty, Satuan, Diskon, dan Harga.
                    {salesPersonFilter !== 'ALL' && (
                      <span className="ml-1.5 font-bold text-indigo-600 dark:text-indigo-400">
                        &bull; Sales: {salesPersonFilter}
                      </span>
                    )}
                    {salesDateFilter !== 'ALL' && (
                      <span className="ml-1.5 font-mono font-bold text-emerald-600 dark:text-emerald-400">
                        &bull; Tanggal: {salesDateFilter}
                      </span>
                    )}
                  </p>
                </div>
                <div className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  Total Harga Penjualan:{' '}
                  <span className="font-mono text-emerald-600 dark:text-emerald-400 font-black">
                    Rp {totalFilteredSalesOmset.toLocaleString('id-ID')}
                  </span>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-50 dark:bg-slate-950 text-slate-600 dark:text-slate-400 uppercase font-bold text-[10px] border-b border-slate-200 dark:border-slate-800">
                    <tr>
                      <th className="py-3.5 px-4">No Nota/Faktur &amp; Tanggal</th>
                      <th className="py-3.5 px-4">Nama Toko/Pelanggan</th>
                      <th className="py-3.5 px-4">Kategori Barang</th>
                      <th className="py-3.5 px-4 text-right">Qty</th>
                      <th className="py-3.5 px-4 text-center">Satuan</th>
                      <th className="py-3.5 px-4 text-right">Diskon</th>
                      <th className="py-3.5 px-4 text-right">Harga</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-800 text-slate-800 dark:text-slate-200">
                    {paginatedSales.length > 0 ? (
                      paginatedSales.map(sale => (
                        <tr key={sale.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition">
                          <td className="py-3.5 px-4">
                            <div className="font-mono font-bold text-indigo-600 dark:text-indigo-400">{sale.noNota}</div>
                            <div className="text-[11px] text-slate-500 font-mono mt-0.5">{sale.tanggal}</div>
                          </td>
                          <td className="py-3.5 px-4">
                            <div className="font-bold text-slate-900 dark:text-white">{sale.storeName}</div>
                            <div className="text-[11px] text-slate-500 mt-0.5">
                              Sales: <span className="font-semibold text-slate-700 dark:text-slate-300">{sale.salesName}</span>
                            </div>
                          </td>
                          <td className="py-3.5 px-4">
                            <span className="px-2.5 py-1 rounded-lg bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 font-bold text-[11px] inline-block">
                              {sale.kategoriBarang}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 text-right font-mono font-bold text-slate-900 dark:text-white">
                            {sale.qty.toLocaleString('id-ID')}
                          </td>
                          <td className="py-3.5 px-4 text-center font-semibold text-slate-700 dark:text-slate-300">
                            {sale.satuan}
                          </td>
                          <td className="py-3.5 px-4 text-right font-mono font-semibold text-amber-600 dark:text-amber-400">
                            Rp {(sale.diskon || 0).toLocaleString('id-ID')}
                          </td>
                          <td className="py-3.5 px-4 text-right font-mono font-black text-emerald-600 dark:text-emerald-400">
                            Rp {sale.totalPenjualan.toLocaleString('id-ID')}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={7} className="py-8 text-center text-slate-400 text-xs">
                          Tidak ada data laporan penjualan pada tanggal / sales yang dipilih.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              <div className="p-4 border-t border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                <div className="text-slate-500 dark:text-slate-400">
                  Menampilkan{' '}
                  <strong className="text-slate-900 dark:text-white">
                    {filteredSales.length === 0 ? 0 : (currentSalesPage - 1) * salesPageSize + 1}
                  </strong>{' '}
                  &ndash;{' '}
                  <strong className="text-slate-900 dark:text-white">
                    {Math.min(currentSalesPage * salesPageSize, filteredSales.length)}
                  </strong>{' '}
                  dari <strong className="text-slate-900 dark:text-white">{filteredSales.length}</strong> laporan penjualan
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    disabled={currentSalesPage <= 1}
                    onClick={() => setSalesPage(p => Math.max(1, p - 1))}
                    className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-700 dark:text-slate-300 font-bold disabled:opacity-40 cursor-pointer flex items-center gap-1"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                    <span>Sebelumnya</span>
                  </button>
                  <button
                    type="button"
                    disabled={currentSalesPage >= totalSalesPages}
                    onClick={() => setSalesPage(p => Math.min(totalSalesPages, p + 1))}
                    className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-700 dark:text-slate-300 font-bold disabled:opacity-40 cursor-pointer flex items-center gap-1"
                  >
                    <span>Selanjutnya</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ============================================================ */}
        {/* MODAL: INPUT LAPORAN KUNJUNGAN BARU                          */}
        {/* ============================================================ */}
        {showAddVisitModal && (
          <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl">
              <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
                <h3 className="text-sm font-black text-slate-900 dark:text-white">
                  Input Laporan Kunjungan Marketing Offline
                </h3>
                <button
                  type="button"
                  onClick={() => setShowAddVisitModal(false)}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-900 dark:hover:text-white cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleAddVisitReport} className="space-y-3 text-xs">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold text-slate-600 dark:text-slate-400 mb-1">
                      Tanggal Kunjungan *
                    </label>
                    <input
                      type="date"
                      required
                      value={visitForm.tanggal}
                      onChange={e => setVisitForm({ ...visitForm, tanggal: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white font-bold"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-slate-600 dark:text-slate-400 mb-1">
                      Nama Sales / Marketing *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="Contoh: Rendra Saputra"
                      value={visitForm.salesName}
                      onChange={e => setVisitForm({ ...visitForm, salesName: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white font-bold"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold text-slate-600 dark:text-slate-400 mb-1">
                      Nama Toko / Pelanggan *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="Contoh: TK ANUGRAH SEKAR WANGI"
                      value={visitForm.storeName}
                      onChange={e => setVisitForm({ ...visitForm, storeName: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white font-bold"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-slate-600 dark:text-slate-400 mb-1">
                      Wilayah / Area *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="Contoh: Genteng - Banyuwangi"
                      value={visitForm.region}
                      onChange={e => setVisitForm({ ...visitForm, region: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white font-bold"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold text-slate-600 dark:text-slate-400 mb-1">
                      PIC / Kontak Toko
                    </label>
                    <input
                      type="text"
                      placeholder="Contoh: Bpk. Hendra (0812-...)"
                      value={visitForm.contactPerson}
                      onChange={e => setVisitForm({ ...visitForm, contactPerson: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-slate-600 dark:text-slate-400 mb-1">
                      Tanggal Follow-Up Berikutnya
                    </label>
                    <input
                      type="date"
                      value={visitForm.followUpDate}
                      onChange={e => setVisitForm({ ...visitForm, followUpDate: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white"
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-bold text-slate-600 dark:text-slate-400 mb-1">
                    Tujuan &amp; Agenda Kunjungan *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Contoh: Presentasi sampel Karton Box & cek stok kemasan toko"
                    value={visitForm.purpose}
                    onChange={e => setVisitForm({ ...visitForm, purpose: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-600 dark:text-slate-400 mb-1">
                    Hasil Kunjungan / Order *
                  </label>
                  <textarea
                    rows={2}
                    required
                    placeholder="Contoh: Pelanggan repeat order 1.000 Pcs Karton Box B-Flute"
                    value={visitForm.outcome}
                    onChange={e => setVisitForm({ ...visitForm, outcome: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-600 dark:text-slate-400 mb-1">
                    Status Kunjungan
                  </label>
                  <select
                    value={visitForm.status}
                    onChange={e => setVisitForm({ ...visitForm, status: e.target.value as OfflineVisitReport['status'] })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white font-bold"
                  >
                    <option value="Selesai & Order">Selesai &amp; Order</option>
                    <option value="Menunggu Follow-Up">Menunggu Follow-Up</option>
                    <option value="Kunjungan Rutin">Kunjungan Rutin</option>
                    <option value="Belum Order">Belum Order</option>
                  </select>
                </div>

                <div className="pt-2 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setShowAddVisitModal(false)}
                    className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold cursor-pointer"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold cursor-pointer"
                  >
                    Simpan Laporan Kunjungan
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ============================================================ */}
        {/* MODAL: INPUT LAPORAN PENJUALAN BARU                          */}
        {/* ============================================================ */}
        {showAddSalesModal && (
          <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl">
              <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
                <h3 className="text-sm font-black text-slate-900 dark:text-white">
                  Input Laporan Penjualan Marketing Offline
                </h3>
                <button
                  type="button"
                  onClick={() => setShowAddSalesModal(false)}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-900 dark:hover:text-white cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleAddSalesReport} className="space-y-3 text-xs">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold text-slate-600 dark:text-slate-400 mb-1">
                      No. Nota / SO *
                    </label>
                    <input
                      type="text"
                      required
                      value={salesForm.noNota}
                      onChange={e => setSalesForm({ ...salesForm, noNota: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white font-mono font-bold"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-slate-600 dark:text-slate-400 mb-1">
                      Tanggal Penjualan *
                    </label>
                    <input
                      type="date"
                      required
                      value={salesForm.tanggal}
                      onChange={e => setSalesForm({ ...salesForm, tanggal: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white font-bold"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold text-slate-600 dark:text-slate-400 mb-1">
                      Nama Toko / Pelanggan *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="Contoh: TK ANUGRAH SEKAR WANGI"
                      value={salesForm.storeName}
                      onChange={e => setSalesForm({ ...salesForm, storeName: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white font-bold"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-slate-600 dark:text-slate-400 mb-1">
                      Sales / Marketing PIC *
                    </label>
                    <input
                      type="text"
                      required
                      value={salesForm.salesName}
                      onChange={e => setSalesForm({ ...salesForm, salesName: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white font-bold"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold text-slate-600 dark:text-slate-400 mb-1">
                      Wilayah / Area
                    </label>
                    <input
                      type="text"
                      value={salesForm.region}
                      onChange={e => setSalesForm({ ...salesForm, region: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-slate-600 dark:text-slate-400 mb-1">
                      Kategori Barang
                    </label>
                    <select
                      value={salesForm.kategoriBarang}
                      onChange={e => setSalesForm({ ...salesForm, kategoriBarang: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white font-bold"
                    >
                      <option value="Karton Box Corrugated">Karton Box Corrugated</option>
                      <option value="Karton Box Double Wall">Karton Box Double Wall</option>
                      <option value="Box Kemasan Makanan">Box Kemasan Makanan</option>
                      <option value="Paper Cup & Food Pack">Paper Cup &amp; Food Pack</option>
                      <option value="Plastik & Stretch Film">Plastik &amp; Stretch Film</option>
                      <option value="Lakban & Strapping Band">Lakban &amp; Strapping Band</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block font-bold text-slate-600 dark:text-slate-400 mb-1">
                    Nama / Spesifikasi Barang *
                  </label>
                  <input
                    type="text"
                    required
                    value={salesForm.namaBarang}
                    onChange={e => setSalesForm({ ...salesForm, namaBarang: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white font-bold"
                  />
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div>
                    <label className="block font-bold text-slate-600 dark:text-slate-400 mb-1">
                      Qty *
                    </label>
                    <input
                      type="number"
                      min={1}
                      required
                      value={salesForm.qty}
                      onChange={e => setSalesForm({ ...salesForm, qty: Number(e.target.value) })}
                      className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white font-mono font-bold"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-slate-600 dark:text-slate-400 mb-1">
                      Satuan
                    </label>
                    <select
                      value={salesForm.satuan}
                      onChange={e => setSalesForm({ ...salesForm, satuan: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white font-bold"
                    >
                      <option value="Pcs">Pcs</option>
                      <option value="Karton">Karton</option>
                      <option value="Ball">Ball</option>
                      <option value="Roll">Roll</option>
                      <option value="Ikat">Ikat</option>
                    </select>
                  </div>
                  <div>
                    <label className="block font-bold text-slate-600 dark:text-slate-400 mb-1">
                      Diskon (Rp)
                    </label>
                    <input
                      type="number"
                      min={0}
                      value={salesForm.diskon}
                      onChange={e => setSalesForm({ ...salesForm, diskon: Number(e.target.value) })}
                      className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white font-mono font-bold"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-slate-600 dark:text-slate-400 mb-1">
                      Harga Satuan (Rp) *
                    </label>
                    <input
                      type="number"
                      min={0}
                      required
                      value={salesForm.hargaSatuan}
                      onChange={e => setSalesForm({ ...salesForm, hargaSatuan: Number(e.target.value) })}
                      className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white font-mono font-bold"
                    />
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/60 flex items-center justify-between">
                  <span className="font-bold text-emerald-800 dark:text-emerald-300">
                    Total Harga Setelah Diskon:
                  </span>
                  <span className="font-mono text-sm font-black text-emerald-700 dark:text-emerald-400">
                    Rp {(Math.max(0, Number(salesForm.qty) * Number(salesForm.hargaSatuan) - (Number(salesForm.diskon) || 0))).toLocaleString('id-ID')}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold text-slate-600 dark:text-slate-400 mb-1">
                      Status Pembayaran
                    </label>
                    <select
                      value={salesForm.statusPembayaran}
                      onChange={e =>
                        setSalesForm({
                          ...salesForm,
                          statusPembayaran: e.target.value as OfflineSalesReport['statusPembayaran']
                        })
                      }
                      className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white font-bold"
                    >
                      <option value="Lunas">Lunas</option>
                      <option value="Tempo 14 Hari">Tempo 14 Hari</option>
                      <option value="Tempo 30 Hari">Tempo 30 Hari</option>
                      <option value="DP / Cicilan">DP / Cicilan</option>
                    </select>
                  </div>
                  <div>
                    <label className="block font-bold text-slate-600 dark:text-slate-400 mb-1">
                      Catatan Tambahan
                    </label>
                    <input
                      type="text"
                      placeholder="Opsional..."
                      value={salesForm.catatan}
                      onChange={e => setSalesForm({ ...salesForm, catatan: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white"
                    />
                  </div>
                </div>

                <div className="pt-2 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setShowAddSalesModal(false)}
                    className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold cursor-pointer"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold cursor-pointer"
                  >
                    Simpan Laporan Penjualan
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* POPUP MODAL */}
        {popupModal && (
          <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-md w-full p-6 text-center space-y-4 shadow-2xl">
              <div className="w-12 h-12 rounded-2xl bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div className="space-y-1.5">
                <h4 className="text-base font-black text-slate-900 dark:text-white">{popupModal.title}</h4>
                <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">{popupModal.message}</p>
              </div>
              <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  autoFocus
                  onClick={() => setPopupModal(null)}
                  className="w-full py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-black text-xs cursor-pointer transition"
                >
                  Oke, Mengerti
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ============================================================
  // RENDER: MARKETING ONLINE (UNCHANGED CORE FUNCTIONALITY)
  // ============================================================
  return (
    <div className="space-y-6" id="marketing_hub">
      {/* HEADER SECTION */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 p-6 bg-gradient-to-r from-slate-900 via-slate-900 to-amber-950/20 border border-slate-800 rounded-2xl shadow-xl">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-orange-500/15 border border-orange-500/30 flex items-center justify-center text-orange-400 shrink-0">
            <Globe className="w-6 h-6" />
          </div>
          <div>
            <div className="text-[10px] uppercase font-bold tracking-wider text-slate-400">Departemen Marketing AKK</div>
            <h2 className="text-xl font-black text-white tracking-tight flex items-center gap-2">
              <span>Marketing Online Hub</span>
              <span className="text-xs bg-amber-500/10 text-amber-300 font-bold px-2 py-0.5 rounded-full border border-amber-500/20">
                Akses Terotorisasi
              </span>
            </h2>
            <p className="text-slate-400 text-xs mt-1">
              Manajemen prospek digital, pelacakan kampanye iklan online, dan optimasi konversi leads pabrik.
            </p>
          </div>
        </div>

        <div>
          <button
            onClick={() => setShowAddLeadModal(true)}
            className="w-full md:w-auto px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Tambah Prospek Online</span>
          </button>
        </div>
      </div>

      {/* METRICS ROW */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-slate-900/80 border border-slate-800 p-5 rounded-2xl shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <span className="text-slate-400 text-[10px] font-black uppercase tracking-wider">Potensi Omset Leads</span>
            <DollarSign className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-xl font-black text-white">Rp {totalLeadBudget.toLocaleString('id-ID')}</div>
          <p className="text-slate-500 text-[10px] mt-1">Dari prospek aktif (selain batal)</p>
        </div>

        <div className="bg-slate-900/80 border border-slate-800 p-5 rounded-2xl shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <span className="text-slate-400 text-[10px] font-black uppercase tracking-wider">Nilai Deal / SPK</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-xl font-black text-emerald-400">Rp {totalDealsValue.toLocaleString('id-ID')}</div>
          <p className="text-slate-500 text-[10px] mt-1">Pemasukan sah dari prospek digital</p>
        </div>

        <div className="bg-slate-900/80 border border-slate-800 p-5 rounded-2xl shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <span className="text-slate-400 text-[10px] font-black uppercase tracking-wider">Total Leads Masuk</span>
            <Globe className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-xl font-black text-white">{totalLeadsCount} Leads</div>
          <p className="text-slate-500 text-[10px] mt-1">Registrasi prospek via digital ads</p>
        </div>

        <div className="bg-slate-900/80 border border-slate-800 p-5 rounded-2xl shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <span className="text-slate-400 text-[10px] font-black uppercase tracking-wider">Rasio Konversi (SLA)</span>
            <TrendingUp className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-xl font-black text-amber-400">{conversionRate}%</div>
          <p className="text-slate-500 text-[10px] mt-1">Persentase prospek sukses SPK</p>
        </div>
      </div>

      {/* DETAILED CONTENT AREA */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-sm">
            <div className="p-5 border-b border-slate-800/80 bg-slate-900 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <BarChart3 className="w-4.5 h-4.5 text-amber-400" />
                <h3 className="text-xs font-black uppercase tracking-wider text-white">
                  Daftar Prospek Proaktif Digital
                </h3>
              </div>

              <div className="flex flex-wrap items-center gap-2.5">
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-slate-500" />
                  <input
                    type="text"
                    placeholder="Cari klien, kota..."
                    value={onlineSearch}
                    onChange={e => setOnlineSearch(e.target.value)}
                    className="pl-8 pr-3 py-1.5 w-40 text-xs rounded-xl bg-slate-950 border border-slate-800 text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-amber-500/50"
                  />
                </div>

                <select
                  value={onlineFilterStatus}
                  onChange={e => setOnlineFilterStatus(e.target.value)}
                  className="px-2.5 py-1.5 text-xs rounded-xl bg-slate-950 border border-slate-800 text-slate-300"
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
                  className="px-2.5 py-1.5 text-xs rounded-xl bg-slate-950 border border-slate-800 text-slate-300"
                >
                  <option value="all">Semua Channel</option>
                  <option value="Google Search">Google Search</option>
                  <option value="WhatsApp Ads">WhatsApp Ads</option>
                  <option value="Instagram DM">Instagram DM</option>
                  <option value="TikTok Business">TikTok Business</option>
                  <option value="Website Form">Website Form</option>
                </select>
              </div>
            </div>

            <div className="overflow-x-auto">
              {filteredOnlineLeads.length === 0 ? (
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
                      <th className="p-3.5 text-right">Volume &amp; Anggaran</th>
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
                            onChange={e => updateLeadStatus(lead.id, e.target.value as OnlineLead['status'])}
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
              )}
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-sm space-y-4">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4.5 h-4.5 text-amber-400" />
              <h3 className="text-xs font-black uppercase tracking-wider text-white">Iklan Online &amp; Digital Campaign</h3>
            </div>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              Efisiensi anggaran iklan online dan konversi lead yang mendaftar ke form database sales.
            </p>
            <div className="space-y-3.5 pt-2">
              <div className="space-y-1">
                <div className="flex justify-between text-[11px]">
                  <span className="font-semibold text-slate-300">WhatsApp Marketing Ads</span>
                  <span className="text-amber-400 font-mono font-bold">ROAS 4.2x</span>
                </div>
                <div className="h-1.5 rounded-full bg-slate-950 overflow-hidden border border-slate-800">
                  <div className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-green-400" style={{ width: '85%' }} />
                </div>
              </div>
              <div className="space-y-1">
                <div className="flex justify-between text-[11px]">
                  <span className="font-semibold text-slate-300">Google Search Ads (Pabrik Karton)</span>
                  <span className="text-amber-400 font-mono font-bold">ROAS 3.8x</span>
                </div>
                <div className="h-1.5 rounded-full bg-slate-950 overflow-hidden border border-slate-800">
                  <div className="h-full rounded-full bg-gradient-to-r from-amber-500 to-yellow-400" style={{ width: '75%' }} />
                </div>
              </div>
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-sm space-y-3">
            <h4 className="text-xs font-black uppercase text-white flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-400" />
              <span>SOP Prospek Digital (SLA)</span>
            </h4>
            <ul className="space-y-2.5 text-[11px] text-slate-400 leading-relaxed">
              <li className="flex items-start gap-2.5">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0 mt-1.5" />
                <span><strong>Kecepatan Respon:</strong> Lead baru wajib dihubungi maksimal 15 menit setelah data masuk.</span>
              </li>
              <li className="flex items-start gap-2.5">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0 mt-1.5" />
                <span><strong>Pencocokan Sampel:</strong> Kirim contoh karton sheet atau mockup box maksimal 48 jam.</span>
              </li>
            </ul>
          </div>
        </div>
      </div>

      {/* MODAL ADD ONLINE LEAD */}
      {showAddLeadModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-sm font-black text-white">Tambah Prospek Online Baru</h3>
              <button onClick={() => setShowAddLeadModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleAddOnlineLead} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-400 font-bold mb-1">Nama Klien / Perusahaan *</label>
                <input
                  type="text"
                  required
                  value={newLeadName}
                  onChange={e => setNewLeadName(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white"
                />
              </div>
              <div>
                <label className="block text-slate-400 font-bold mb-1">Kota / Lokasi *</label>
                <input
                  type="text"
                  required
                  value={newLeadCity}
                  onChange={e => setNewLeadCity(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 font-bold mb-1">Estimasi Volume (Pcs)</label>
                  <input
                    type="number"
                    value={newLeadVolume}
                    onChange={e => setNewLeadVolume(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 font-bold mb-1">Estimasi Budget (Rp)</label>
                  <input
                    type="number"
                    value={newLeadBudget}
                    onChange={e => setNewLeadBudget(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white"
                  />
                </div>
              </div>
              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddLeadModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 font-bold"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-amber-500 text-slate-950 font-bold"
                >
                  Simpan Prospek
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
