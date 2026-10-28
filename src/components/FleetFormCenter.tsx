import React, { useState, useEffect, useMemo } from 'react';
import {
  FileText,
  Wrench,
  Droplets,
  ShoppingCart,
  Plus,
  ChevronDown,
  History,
  Download,
  BarChart3,
  Camera,
  Search,
  Filter,
  Sparkles,
  Eye,
  Trash2,
  Printer,
  CheckCircle2,
  AlertCircle,
  Calendar,
  Truck,
  User,
  MapPin,
  RefreshCw,
  FileCheck2,
  ClipboardCheck,
  Tag,
  ArrowUpDown
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { ServiceFormModal } from './ServiceFormModal';
import { ProcurementFormModal } from './ProcurementFormModal';
import { DocumentScannerModal } from './DocumentScannerModal';
import { DocumentDetailModal } from './DocumentDetailModal';
import { ScannedDocumentLog, ScannedDocumentType } from '../types';
import { logisticsStore } from '../services/store';
import { useToast } from '../context/ToastContext';

export const FleetFormCenter: React.FC = () => {
  const { addNotification } = useToast();

  // Modals state
  const [activeModal, setActiveModal] = useState<string | null>(null);
  const [showDropdown, setShowDropdown] = useState(false);
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [scannerInitialType, setScannerInitialType] = useState<ScannedDocumentType>('delivery_slip');
  const [selectedDocDetail, setSelectedDocDetail] = useState<ScannedDocumentLog | null>(null);

  // Scanned documents from persistent logisticsStore
  const [scannedDocuments, setScannedDocuments] = useState<ScannedDocumentLog[]>(() => 
    logisticsStore.getScannedDocuments()
  );

  // Subscribe to store updates
  useEffect(() => {
    const unsubscribe = logisticsStore.subscribe(() => {
      setScannedDocuments(logisticsStore.getScannedDocuments());
    });
    return () => unsubscribe();
  }, []);

  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('cards');

  // Filtered documents
  const filteredDocuments = useMemo(() => {
    return scannedDocuments.filter(doc => {
      // Type filter
      if (typeFilter !== 'all' && doc.documentType !== typeFilter) return false;

      // Status filter
      if (statusFilter !== 'all' && doc.status !== statusFilter) return false;

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const docNum = (doc.documentNumber || '').toLowerCase();
        const plate = (doc.vehiclePlate || '').toLowerCase();
        const driver = (doc.driverName || '').toLowerCase();
        const dest = (doc.destinationOrStore || '').toLowerCase();
        const cargo = (doc.cargoOrItemsSummary || '').toLowerCase();
        const rawText = (doc.rawExtractedText || '').toLowerCase();
        const notes = (doc.notes || '').toLowerCase();

        return (
          docNum.includes(q) ||
          plate.includes(q) ||
          driver.includes(q) ||
          dest.includes(q) ||
          cargo.includes(q) ||
          rawText.includes(q) ||
          notes.includes(q)
        );
      }

      return true;
    });
  }, [scannedDocuments, typeFilter, statusFilter, searchQuery]);

  // Statistics
  const stats = useMemo(() => {
    const total = scannedDocuments.length;
    const slips = scannedDocuments.filter(d => d.documentType === 'delivery_slip').length;
    const inspections = scannedDocuments.filter(d => d.documentType === 'inspection_form').length;
    const services = scannedDocuments.filter(d => d.documentType === 'service_order').length;
    const verified = scannedDocuments.filter(d => d.status === 'verified').length;
    return { total, slips, inspections, services, verified };
  }, [scannedDocuments]);

  // Chart data combining manual forms and scanned docs
  const chartData = [
    { name: 'Surat Jalan', count: stats.slips, color: '#06b6d4' },
    { name: 'Inspeksi', count: stats.inspections, color: '#f59e0b' },
    { name: 'Service', count: stats.services + 2, color: '#6366f1' },
    { name: 'Cuci', count: 1, color: '#38bdf8' },
    { name: 'Pengadaan', count: 1, color: '#10b981' }
  ];

  // Export Scanned Documents to Excel
  const exportScannedDocsToExcel = () => {
    const rows = filteredDocuments.map((doc, idx) => ({
      No: idx + 1,
      'ID Log': doc.id,
      'Jenis Dokumen': doc.documentTypeLabel,
      'No. Dokumen / Ref': doc.documentNumber,
      'Tanggal Dokumen': doc.date,
      'Waktu Pindai (WIB)': new Date(doc.timestamp).toLocaleString('id-ID'),
      'Plat Truk': doc.vehiclePlate || '-',
      'Pengemudi / Petugas': doc.driverName || '-',
      'Tujuan / Outlet': doc.destinationOrStore || '-',
      'Muatan / Hasil Inspeksi': doc.cargoOrItemsSummary || '-',
      'Kuantitas / Bobot': doc.quantityOrWeight || '-',
      'Status': doc.status === 'verified' ? 'Terverifikasi' : 'Pending Review',
      'Akurasi OCR': `${Math.round(doc.confidenceScore * 100)}%`,
      'Dipindai Oleh': doc.capturedBy,
      'Catatan': doc.notes || '-',
      'Teks Terbaca': doc.rawExtractedText
    }));

    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Arsip Dokumen Scanned');
    XLSX.writeFile(workbook, `Log_Scan_Dokumen_AKK_${new Date().toISOString().split('T')[0]}.xlsx`);

    addNotification('delivery', 'Ekspor Berhasil', 'Arsip scan dokumen berhasil diunduh dalam format Excel.');
  };

  const handleDeleteDocument = (id: string) => {
    logisticsStore.deleteScannedDocument(id);
    addNotification('sla_warning', 'Dokumen Dihapus', 'Data arsip dokumen telah dihapus dari log sistem.');
  };

  const forms = [
    {
      id: 'scanner_slip',
      title: 'Pindai Surat Jalan (Delivery Slip)',
      description: 'Foto & OCR otomatis Surat Jalan dari kamera HP sopir/checker.',
      icon: <Camera className="w-8 h-8 text-amber-400" />,
      color: 'bg-amber-500/10 border-amber-500/25',
      isScanner: true,
      scanType: 'delivery_slip' as ScannedDocumentType
    },
    {
      id: 'scanner_inspection',
      title: 'Pindai Formulir Inspeksi Harian',
      description: 'Foto & simpan lembar checklist pemeriksaan fisik armada pra-jalan.',
      icon: <ClipboardCheck className="w-8 h-8 text-emerald-400" />,
      color: 'bg-emerald-500/10 border-emerald-500/25',
      isScanner: true,
      scanType: 'inspection_form' as ScannedDocumentType
    },
    {
      id: 'service',
      title: 'Formulir Service Armada',
      description: 'Input detail perbaikan dan maintenance rutin armada.',
      icon: <Wrench className="w-8 h-8 text-indigo-400" />,
      color: 'bg-indigo-500/10 border-indigo-500/20'
    },
    {
      id: 'washing',
      title: 'Formulir Cuci Armada',
      description: 'Input data pencucian armada untuk kebersihan dan perawatan.',
      icon: <Droplets className="w-8 h-8 text-sky-400" />,
      color: 'bg-sky-500/10 border-sky-500/20'
    },
    {
      id: 'procurement',
      title: 'Formulir Pengadaan',
      description: 'Input permintaan pengadaan barang distribusi.',
      icon: <ShoppingCart className="w-8 h-8 text-emerald-400" />,
      color: 'bg-emerald-500/10 border-emerald-500/20'
    }
  ];

  return (
    <div className="space-y-6">
      {/* Top Banner & Header Bar */}
      <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl flex flex-wrap justify-between items-center gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-black text-white">Formulir Logistik &amp; Pusat Pemindaian Dokumen</h2>
            <span className="px-2.5 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-400 text-[10px] font-mono font-bold">
              Camera AI OCR
            </span>
          </div>
          <p className="text-slate-400 text-sm mt-1">
            Pindai fisik Surat Jalan atau lembar checklist inspeksi armada pakai kamera perangkat, otomatis diindeks ke log digital pencarian.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          {/* Direct Camera Scan Button */}
          <button
            onClick={() => {
              setScannerInitialType('delivery_slip');
              setIsScannerOpen(true);
            }}
            className="flex items-center gap-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black px-4 py-2.5 rounded-xl shadow-lg transition active:scale-95 cursor-pointer text-xs sm:text-sm"
          >
            <Camera size={18} />
            <span>Pindai Dokumen (Kamera)</span>
          </button>

          {/* Additional Forms Dropdown */}
          <div className="relative">
            <button 
              onClick={() => setShowDropdown(!showDropdown)}
              className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-bold px-3.5 py-2.5 rounded-xl transition cursor-pointer text-xs sm:text-sm"
            >
              <Plus size={18} />
              <span>Formulir Lain</span>
              <ChevronDown size={16} />
            </button>
            {showDropdown && (
              <div className="absolute right-0 mt-2 w-64 bg-slate-900 rounded-xl border border-slate-700 shadow-2xl z-30 overflow-hidden divide-y divide-slate-800 animate-in fade-in duration-150">
                <div className="p-1">
                  <button
                    onClick={() => {
                      setScannerInitialType('delivery_slip');
                      setIsScannerOpen(true);
                      setShowDropdown(false);
                    }}
                    className="w-full text-left px-3 py-2 hover:bg-slate-800 text-amber-300 font-bold text-xs rounded-lg flex items-center gap-2"
                  >
                    <Camera className="w-3.5 h-3.5" />
                    <span>Pindai Surat Jalan (Delivery Slip)</span>
                  </button>
                  <button
                    onClick={() => {
                      setScannerInitialType('inspection_form');
                      setIsScannerOpen(true);
                      setShowDropdown(false);
                    }}
                    className="w-full text-left px-3 py-2 hover:bg-slate-800 text-emerald-300 font-bold text-xs rounded-lg flex items-center gap-2"
                  >
                    <ClipboardCheck className="w-3.5 h-3.5" />
                    <span>Pindai Formulir Inspeksi Harian</span>
                  </button>
                </div>
                <div className="p-1">
                  <button 
                    onClick={() => { setActiveModal('service'); setShowDropdown(false); }}
                    className="w-full text-left px-3 py-2 hover:bg-slate-800 text-slate-200 text-xs rounded-lg"
                  >
                    Input Formulir Service Armada (SPK)
                  </button>
                  <button 
                    onClick={() => { setActiveModal('procurement'); setShowDropdown(false); }}
                    className="w-full text-left px-3 py-2 hover:bg-slate-800 text-slate-200 text-xs rounded-lg"
                  >
                    Input Formulir Pengadaan Logistik
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Overview Metric Highlights */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
        <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-slate-400">Total Arsip Scan</span>
            <FileCheck2 className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-2xl font-black text-white mt-1 font-mono">{stats.total}</div>
          <div className="text-[10px] text-slate-500 mt-0.5">Surat Jalan &amp; Lembar Inspeksi</div>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-slate-400">Surat Jalan (DO)</span>
            <FileText className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="text-2xl font-black text-cyan-400 mt-1 font-mono">{stats.slips}</div>
          <div className="text-[10px] text-slate-500 mt-0.5">Pengiriman Barang Selesai</div>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-slate-400">Checklist Inspeksi</span>
            <ClipboardCheck className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-2xl font-black text-amber-400 mt-1 font-mono">{stats.inspections}</div>
          <div className="text-[10px] text-slate-500 mt-0.5">Pemeriksaan Truk Pra-Jalan</div>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-slate-400">Tervalidasi Sistem</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-black text-emerald-400 mt-1 font-mono">{stats.verified}</div>
          <div className="text-[10px] text-emerald-400 font-semibold mt-0.5">100% Siap Audit SLA</div>
        </div>
      </div>

      {/* Main Grid: Form Shortcuts & Analytics Chart */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Forms & Scanner Grid (2 cols on desktop) */}
        <div className="lg:col-span-2 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3.5">
          {forms.map(form => (
            <div 
              key={form.id} 
              className={`p-4 rounded-2xl border ${form.color} flex flex-col justify-between space-y-3 hover:scale-[1.01] transition shadow-xs group`}
            >
              <div className="flex items-center justify-between">
                <div className="p-2 rounded-xl bg-slate-900/80 border border-slate-800/80">
                  {form.icon}
                </div>
                {form.isScanner && (
                  <span className="text-[9px] font-mono font-bold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40">
                    SCAN KAMERA
                  </span>
                )}
              </div>
              <div>
                <h3 className="text-xs font-bold text-white line-clamp-1">{form.title}</h3>
                <p className="text-[11px] text-slate-400 mt-1 line-clamp-2 leading-relaxed">
                  {form.description}
                </p>
              </div>
              <button 
                onClick={() => {
                  if (form.isScanner) {
                    setScannerInitialType(form.scanType!);
                    setIsScannerOpen(true);
                  } else {
                    setActiveModal(form.id);
                  }
                }}
                className={`w-full py-2 rounded-xl font-bold text-xs transition cursor-pointer flex items-center justify-center gap-1.5 ${
                  form.isScanner
                    ? 'bg-amber-500 hover:bg-amber-400 text-slate-950 font-black shadow'
                    : 'bg-slate-800 hover:bg-slate-700 text-slate-200'
                }`}
              >
                {form.isScanner ? (
                  <>
                    <Camera className="w-3.5 h-3.5" />
                    <span>Buka Kamera Scan</span>
                  </>
                ) : (
                  <span>Isi Formulir</span>
                )}
              </button>
            </div>
          ))}
        </div>

        {/* Bar Chart Section */}
        <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl flex flex-col justify-between">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-amber-400" />
              <h3 className="text-xs font-bold text-white uppercase tracking-wider">Statistik Pengarsipan</h3>
            </div>
            <span className="text-[10px] text-slate-400 font-mono">Bulan Berjalan</span>
          </div>
          <div className="h-44 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <XAxis dataKey="name" stroke="#64748b" fontSize={10} tickLine={false} />
                <YAxis stroke="#64748b" fontSize={10} tickLine={false} allowDecimals={false} />
                <Tooltip
                  cursor={{ fill: '#1e293b' }}
                  contentStyle={{ backgroundColor: '#020617', borderColor: '#334155', borderRadius: '12px', fontSize: '11px' }}
                />
                <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="text-[11px] text-slate-400 text-center pt-2 border-t border-slate-800/80">
            Total {stats.total + 4} berkas tercatat di database operasional AKK
          </div>
        </div>
      </div>

      {/* 📄 DEDICATED SEARCHABLE LOG SECTION (Core Requirement) */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4 shadow-sm">
        {/* Section Header */}
        <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
              <FileCheck2 className="w-4.5 h-4.5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                Log Arsip Dokumen Digital &amp; Hasil Scan Kamera
                <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-slate-800 text-amber-400 border border-slate-700">
                  {filteredDocuments.length} Terindeks
                </span>
              </h3>
              <p className="text-[11px] text-slate-400">
                Data Surat Jalan, lembar inspeksi pra-jalan, dan tanda tangan tersimpan lengkap dengan teks OCR yang dapat dicari instan.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button 
              onClick={exportScannedDocsToExcel}
              className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-1.5 rounded-xl font-bold text-xs transition shadow-sm cursor-pointer"
              title="Unduh seluruh log dokumen yang terfilter dalam format spreadsheet Excel"
            >
              <Download size={14} />
              <span>Ekspor Excel (.xlsx)</span>
            </button>
            <button
              onClick={() => setIsScannerOpen(true)}
              className="flex items-center gap-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black px-3 py-1.5 rounded-xl text-xs transition shadow-sm cursor-pointer"
            >
              <Camera size={14} />
              <span>Scan Baru</span>
            </button>
          </div>
        </div>

        {/* Search & Filter Toolbar */}
        <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5">
          {/* Search Input (spans 6 cols) */}
          <div className="sm:col-span-6 relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari No. Dokumen, Plat Truk (P 8848 U), Nama Supir, Toko, atau Kata Kunci OCR..."
              className="w-full pl-9 pr-8 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:border-amber-500 focus:outline-none transition shadow-inner"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white text-xs cursor-pointer"
              >
                &times;
              </button>
            )}
          </div>

          {/* Type Filter */}
          <div className="sm:col-span-3">
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="w-full py-2 px-3 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 font-semibold focus:border-amber-500 focus:outline-none cursor-pointer"
            >
              <option value="all">Semua Jenis Dokumen</option>
              <option value="delivery_slip">Surat Jalan (Delivery Slip)</option>
              <option value="inspection_form">Formulir Inspeksi Armada</option>
              <option value="service_order">Formulir Service / SPK</option>
            </select>
          </div>

          {/* Status Filter */}
          <div className="sm:col-span-3">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full py-2 px-3 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 font-semibold focus:border-amber-500 focus:outline-none cursor-pointer"
            >
              <option value="all">Semua Status Verifikasi</option>
              <option value="verified">Terverifikasi (Valid)</option>
              <option value="pending_review">Menunggu Tinjauan</option>
            </select>
          </div>
        </div>

        {/* Search Results Summary */}
        {searchQuery && (
          <div className="text-xs text-amber-300 bg-amber-500/10 px-3 py-1.5 rounded-lg border border-amber-500/20 flex items-center justify-between">
            <span>
              Menemukan <strong>{filteredDocuments.length}</strong> dokumen untuk kata kunci "<em>{searchQuery}</em>"
            </span>
            <button
              onClick={() => setSearchQuery('')}
              className="text-amber-400 hover:text-amber-200 underline text-[11px] cursor-pointer"
            >
              Hapus Filter
            </button>
          </div>
        )}

        {/* Document Entries List */}
        {filteredDocuments.length === 0 ? (
          <div className="py-12 text-center space-y-3 bg-slate-950/50 rounded-2xl border border-slate-800/80">
            <div className="w-12 h-12 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-500 mx-auto">
              <Search className="w-6 h-6" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-white">Tidak Ada Dokumen yang Cocok</h4>
              <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                Coba sesuaikan kata kunci pencarian Anda atau pindai dokumen baru menggunakan tombol kamera di atas.
              </p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredDocuments.map(doc => (
              <div
                key={doc.id}
                className="bg-slate-950 border border-slate-800 hover:border-slate-700 rounded-2xl p-4 flex flex-col justify-between space-y-3 transition shadow-sm hover:shadow-md group"
              >
                <div>
                  {/* Top line: Type Badge & Date */}
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-md border ${
                      doc.documentType === 'delivery_slip'
                        ? 'bg-cyan-500/15 text-cyan-400 border-cyan-500/30'
                        : doc.documentType === 'inspection_form'
                        ? 'bg-amber-500/15 text-amber-400 border-amber-500/30'
                        : 'bg-indigo-500/15 text-indigo-400 border-indigo-500/30'
                    }`}>
                      {doc.documentTypeLabel}
                    </span>
                    <span className="text-[10px] font-mono text-slate-400 flex items-center gap-1">
                      <Calendar className="w-3 h-3 text-slate-500" />
                      {doc.date}
                    </span>
                  </div>

                  {/* Thumbnail & Document Ref */}
                  <div className="flex gap-3 items-start">
                    <div 
                      onClick={() => setSelectedDocDetail(doc)}
                      className="w-20 h-24 rounded-xl overflow-hidden bg-slate-900 border border-slate-800 shrink-0 relative cursor-pointer group-hover:border-amber-500/50 transition"
                      title="Klik untuk memperbesar foto dokumen"
                    >
                      <img
                        src={doc.photoDataUrl}
                        alt={doc.documentNumber}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                      />
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white">
                        <Eye className="w-4 h-4" />
                      </div>
                    </div>

                    <div className="min-w-0 flex-1 space-y-1">
                      <div 
                        onClick={() => setSelectedDocDetail(doc)}
                        className="font-mono font-bold text-white text-xs hover:text-amber-400 transition cursor-pointer truncate"
                        title={doc.documentNumber}
                      >
                        {doc.documentNumber}
                      </div>

                      {/* Plate & Driver tags */}
                      <div className="flex flex-wrap items-center gap-1 text-[11px]">
                        {doc.vehiclePlate && (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded bg-emerald-500/10 text-emerald-400 font-mono font-semibold border border-emerald-500/20">
                            <Truck className="w-2.5 h-2.5" />
                            {doc.vehiclePlate}
                          </span>
                        )}
                        {doc.driverName && (
                          <span className="inline-flex items-center gap-1 text-slate-300 truncate max-w-[120px]">
                            <User className="w-2.5 h-2.5 text-slate-500" />
                            {doc.driverName}
                          </span>
                        )}
                      </div>

                      {/* Destination / Store */}
                      {doc.destinationOrStore && (
                        <div className="text-[11px] text-slate-400 flex items-center gap-1 truncate" title={doc.destinationOrStore}>
                          <MapPin className="w-3 h-3 text-rose-400 shrink-0" />
                          <span className="truncate">{doc.destinationOrStore}</span>
                        </div>
                      )}

                      {/* Cargo Summary Snippet */}
                      {doc.cargoOrItemsSummary && (
                        <p className="text-[11px] text-slate-300 line-clamp-2 leading-tight mt-1">
                          {doc.cargoOrItemsSummary}
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Bottom Controls Strip */}
                <div className="pt-2 border-t border-slate-900 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-400" />
                    <span className="text-[10px] font-semibold text-emerald-400">
                      OCR: {Math.round(doc.confidenceScore * 100)}%
                    </span>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setSelectedDocDetail(doc)}
                      className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] font-bold transition cursor-pointer"
                    >
                      Lihat Detail
                    </button>
                    <button
                      onClick={() => {
                        if (window.confirm(`Hapus arsip ${doc.documentNumber}?`)) {
                          handleDeleteDocument(doc.id);
                        }
                      }}
                      className="p-1 rounded-lg hover:bg-rose-500/20 text-slate-500 hover:text-rose-400 transition cursor-pointer"
                      title="Hapus Dokumen"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Legacy Print Log Section for Manual Forms */}
      <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl">
        <div className="flex justify-between items-center mb-4">
          <div className="flex items-center gap-2">
            <History className="text-slate-400" />
            <h3 className="text-lg font-bold text-white">Log Riwayat Cetak Formulir Standar</h3>
          </div>
          <span className="text-xs text-slate-400">Arsip Pengisian Manual</span>
        </div>
        <div className="space-y-2">
          {[
            { id: 1, docType: 'Form Service Armada', timestamp: '2026-09-25 00:05', userId: 'BayuN791' },
            { id: 2, docType: 'Form Pengadaan', timestamp: '2026-09-24 23:55', userId: 'BayuN791' },
            { id: 3, docType: 'Form Cuci Armada', timestamp: '2026-09-24 22:00', userId: 'BayuN791' }
          ].map(log => (
            <div key={log.id} className="flex justify-between items-center bg-slate-800/80 p-3 rounded-lg text-sm text-slate-300">
              <span>{log.docType} dicetak oleh {log.userId}</span>
              <span className="text-slate-500 text-xs font-mono">{log.timestamp}</span>
            </div>
          ))}
        </div>
      </div>

      {/* MODALS */}
      <ServiceFormModal 
        isOpen={activeModal === 'service'} 
        onClose={() => setActiveModal(null)} 
      />
      <ProcurementFormModal 
        isOpen={activeModal === 'procurement'} 
        onClose={() => setActiveModal(null)} 
      />

      {/* CAMERA SCANNER MODAL */}
      <DocumentScannerModal
        isOpen={isScannerOpen}
        onClose={() => setIsScannerOpen(false)}
        initialType={scannerInitialType}
        onSaveSuccess={(newDoc) => {
          setScannedDocuments(logisticsStore.getScannedDocuments());
          addNotification(
            'delivery',
            'Dokumen Berhasil Dipindai',
            `${newDoc.documentTypeLabel} (${newDoc.documentNumber}) berhasil diindeks ke log digital!`
          );
        }}
      />

      {/* FULL DOCUMENT DETAIL & INSPECTION MODAL */}
      <DocumentDetailModal
        document={selectedDocDetail}
        isOpen={Boolean(selectedDocDetail)}
        onClose={() => setSelectedDocDetail(null)}
        onDelete={handleDeleteDocument}
      />
    </div>
  );
};
