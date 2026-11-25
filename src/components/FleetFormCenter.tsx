import React, { useState, useEffect, useMemo, useRef } from 'react';
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
  Eye,
  Trash2,
  Printer,
  CheckCircle2,
  Calendar,
  Truck,
  User,
  MapPin,
  FileCheck2,
  ClipboardCheck,
  Settings2,
  Layout,
  X
} from 'lucide-react';
import * as XLSX from 'xlsx';
import {
  FleetFormType,
  FleetFormTemplateConfig,
  FormPrintHistoryItem,
  loadAllFleetFormTemplates,
  loadFormPrintLogs,
  appendFormPrintLog,
  hydrateFleetFormStateFromMysql,
  FLEET_FORMS_UPDATED_EVENT,
  RancanganFormulirModal,
  VisualReportDesignerModal,
  FleetFormInteractiveModal
} from './FleetFormDesignerSystem';
import { DocumentScannerModal } from './DocumentScannerModal';
import { DocumentDetailModal } from './DocumentDetailModal';
import { ScannedDocumentLog, ScannedDocumentType } from '../types';
import { logisticsStore } from '../services/store';
import { useToast } from '../context/ToastContext';

export const FleetFormCenter: React.FC = () => {
  const { addNotification } = useToast();

  // Active form & designer modal states
  const [activeFormModal, setActiveFormModal] = useState<FleetFormType | null>(null);
  const [rancanganModalOpen, setRancanganModalOpen] = useState(false);
  const [rancanganTargetType, setRancanganTargetType] = useState<FleetFormType>('service');
  const [designerModalOpen, setDesignerModalOpen] = useState(false);
  const [designerTargetType, setDesignerTargetType] = useState<FleetFormType>('service');

  // Templates & Print Logs state
  const [templatesMap, setTemplatesMap] = useState<Record<FleetFormType, FleetFormTemplateConfig>>(() =>
    loadAllFleetFormTemplates()
  );
  const [printLogs, setPrintLogs] = useState<FormPrintHistoryItem[]>(() => loadFormPrintLogs());

  // Unified Action Menu dropdown + click outside
  const [showActionMenu, setShowActionMenu] = useState(false);
  const actionMenuRef = useRef<HTMLDivElement>(null);

  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [scannerInitialType, setScannerInitialType] = useState<ScannedDocumentType>('delivery_slip');
  const [selectedDocDetail, setSelectedDocDetail] = useState<ScannedDocumentLog | null>(null);

  // Active log view tab inside left panel ('ocr_archive' | 'print_history')
  const [archiveTab, setArchiveTab] = useState<'ocr_archive' | 'print_history'>('ocr_archive');

  // Scanned documents from persistent logisticsStore
  const [scannedDocuments, setScannedDocuments] = useState<ScannedDocumentLog[]>(() =>
    logisticsStore.getScannedDocuments()
  );

  // Subscribe to store updates & Hostinger MySQL form designer state
  useEffect(() => {
    const syncFormDesigner = () => {
      setTemplatesMap({ ...loadAllFleetFormTemplates() });
      setPrintLogs([...loadFormPrintLogs()]);
    };
    window.addEventListener(FLEET_FORMS_UPDATED_EVENT, syncFormDesigner);
    void hydrateFleetFormStateFromMysql(true);

    const unsubscribe = logisticsStore.subscribe(() => {
      setScannedDocuments(logisticsStore.getScannedDocuments());
    });
    return () => {
      window.removeEventListener(FLEET_FORMS_UPDATED_EVENT, syncFormDesigner);
      unsubscribe();
    };
  }, []);

  // Close dropdown on outside click / Escape
  useEffect(() => {
    if (!showActionMenu) return;
    const handleOutside = (e: MouseEvent) => {
      if (actionMenuRef.current && !actionMenuRef.current.contains(e.target as Node)) {
        setShowActionMenu(false);
      }
    };
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setShowActionMenu(false);
    };
    document.addEventListener('mousedown', handleOutside);
    document.addEventListener('keydown', handleEsc);
    return () => {
      document.removeEventListener('mousedown', handleOutside);
      document.removeEventListener('keydown', handleEsc);
    };
  }, [showActionMenu]);

  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // Filtered scanned documents
  const filteredDocuments = useMemo(() => {
    return scannedDocuments.filter(doc => {
      if (typeFilter !== 'all' && doc.documentType !== typeFilter) return false;
      if (statusFilter !== 'all' && doc.status !== statusFilter) return false;

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

  // Filtered print logs (when switching to print_history tab)
  const filteredPrintLogs = useMemo(() => {
    if (!searchQuery.trim()) return printLogs;
    const q = searchQuery.toLowerCase();
    return printLogs.filter(
      log =>
        (log.nomorDokumen || '').toLowerCase().includes(q) ||
        (log.docType || '').toLowerCase().includes(q) ||
        (log.summary || '').toLowerCase().includes(q) ||
        (log.userId || '').toLowerCase().includes(q)
    );
  }, [printLogs, searchQuery]);

  // Statistics
  const stats = useMemo(() => {
    const total = scannedDocuments.length;
    const slips = scannedDocuments.filter(d => d.documentType === 'delivery_slip').length;
    const inspections = scannedDocuments.filter(d => d.documentType === 'inspection_form').length;
    const services = scannedDocuments.filter(d => d.documentType === 'service_order').length;
    const verified = scannedDocuments.filter(d => d.status === 'verified').length;
    return { total, slips, inspections, services, verified };
  }, [scannedDocuments]);

  // Flat Bar Chart categories (CSS-rendered bars, zero gradients)
  const chartBars = useMemo(() => {
    const serviceCount = stats.services + printLogs.filter(l => l.formType === 'service').length;
    const washCount = printLogs.filter(l => l.formType === 'washing').length;
    const procurementCount = printLogs.filter(l => l.formType === 'procurement').length;

    const items = [
      { key: 'surat_jalan', label: 'Surat Jalan', shortLabel: 'DO', count: stats.slips, barColor: 'bg-cyan-500', dotColor: 'bg-cyan-500' },
      { key: 'inspeksi', label: 'Inspeksi', shortLabel: 'Inspeksi', count: stats.inspections, barColor: 'bg-amber-500', dotColor: 'bg-amber-500' },
      { key: 'service', label: 'Service', shortLabel: 'Service', count: serviceCount, barColor: 'bg-indigo-500', dotColor: 'bg-indigo-500' },
      { key: 'cuci', label: 'Cuci', shortLabel: 'Cuci', count: washCount, barColor: 'bg-sky-500', dotColor: 'bg-sky-500' },
      { key: 'pengadaan', label: 'Pengadaan', shortLabel: 'Pengadaan', count: procurementCount, barColor: 'bg-emerald-500', dotColor: 'bg-emerald-500' },
    ];
    const maxCount = Math.max(4, ...items.map(i => i.count));
    return { items, maxCount, totalRecords: stats.total + printLogs.length };
  }, [stats, printLogs]);

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

  return (
    <div className="akk-flat-docs w-full max-w-full bg-slate-50 dark:bg-[#0F172A] px-4 sm:px-6 py-6 space-y-6 animate-in fade-in duration-200">
      {/* 1. Header Halaman (Satu Baris) */}
      <header className="bg-white dark:bg-[#162234] border border-slate-200 dark:border-[#24344D] rounded-xl p-5 sm:p-6 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
            Pusat Dokumen Logistik &amp; OCR
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Kelola dokumen armada, surat jalan, dan pengadaan.
          </p>
        </div>

        {/* Group Tombol Aksi Flat */}
        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={() => {
              setRancanganTargetType('service');
              setRancanganModalOpen(true);
            }}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-200 border border-slate-200 dark:border-[#24344D] text-xs sm:text-sm font-semibold transition-colors cursor-pointer"
          >
            <Settings2 className="w-4 h-4 text-slate-500 dark:text-slate-400" />
            <span>Rancangan Formulir</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setScannerInitialType('delivery_slip');
              setIsScannerOpen(true);
            }}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-xs sm:text-sm font-semibold transition-colors cursor-pointer"
          >
            <Camera className="w-4 h-4" />
            <span>Pindai Kamera</span>
          </button>

          {/* Dropdown Aksi Terpadu (+ Buat / Pindai Dokumen) */}
          <div className="relative" ref={actionMenuRef}>
            <button
              type="button"
              onClick={() => setShowActionMenu(prev => !prev)}
              aria-expanded={showActionMenu}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs sm:text-sm font-semibold transition-colors cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Buat / Pindai Dokumen</span>
              <ChevronDown className={`w-4 h-4 transition-transform duration-150 ${showActionMenu ? 'rotate-180' : ''}`} />
            </button>

            {showActionMenu && (
              <div className="absolute right-0 mt-2 w-80 bg-white dark:bg-[#162234] rounded-xl border border-slate-200 dark:border-[#24344D] shadow-lg z-40 overflow-hidden divide-y divide-slate-100 dark:divide-slate-800">
                <div className="p-2">
                  <div className="px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                    Scan Kamera &amp; OCR
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setScannerInitialType('delivery_slip');
                      setIsScannerOpen(true);
                      setShowActionMenu(false);
                    }}
                    className="w-full text-left px-3 py-2.5 hover:bg-amber-50 dark:hover:bg-amber-500/10 rounded-lg flex items-center justify-between gap-2 transition-colors cursor-pointer"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="w-8 h-8 rounded-lg bg-amber-100 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                        <Camera className="w-4 h-4" />
                      </span>
                      <div className="min-w-0">
                        <div className="text-xs font-semibold text-slate-800 dark:text-slate-100 truncate">
                          Pindai Surat Jalan (DO)
                        </div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                          Foto &amp; OCR otomatis delivery slip
                        </div>
                      </div>
                    </div>
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300 shrink-0">
                      Kamera
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setScannerInitialType('inspection_form');
                      setIsScannerOpen(true);
                      setShowActionMenu(false);
                    }}
                    className="w-full text-left px-3 py-2.5 hover:bg-amber-50 dark:hover:bg-amber-500/10 rounded-lg flex items-center justify-between gap-2 transition-colors cursor-pointer"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="w-8 h-8 rounded-lg bg-amber-100 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                        <ClipboardCheck className="w-4 h-4" />
                      </span>
                      <div className="min-w-0">
                        <div className="text-xs font-semibold text-slate-800 dark:text-slate-100 truncate">
                          Pindai Formulir Inspeksi
                        </div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                          Checklist pemeriksaan fisik pra-jalan
                        </div>
                      </div>
                    </div>
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300 shrink-0">
                      Kamera
                    </span>
                  </button>
                </div>

                <div className="p-2">
                  <div className="px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                    Buat &amp; Cetak Formulir Standar
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setActiveFormModal('service');
                      setShowActionMenu(false);
                    }}
                    className="w-full text-left px-3 py-2 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg flex items-center justify-between gap-2 transition-colors cursor-pointer"
                  >
                    <span className="flex items-center gap-2.5 min-w-0">
                      <Wrench className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
                      <span className="text-xs font-semibold text-slate-700 dark:text-slate-200 truncate">
                        Formulir Service Armada
                      </span>
                    </span>
                    <span className="text-[10px] text-slate-400 font-mono truncate max-w-[110px]">
                      {templatesMap.service?.namaRancangan || 'SPK'}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setActiveFormModal('washing');
                      setShowActionMenu(false);
                    }}
                    className="w-full text-left px-3 py-2 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg flex items-center justify-between gap-2 transition-colors cursor-pointer"
                  >
                    <span className="flex items-center gap-2.5 min-w-0">
                      <Droplets className="w-4 h-4 text-sky-600 dark:text-sky-400 shrink-0" />
                      <span className="text-xs font-semibold text-slate-700 dark:text-slate-200 truncate">
                        Formulir Cuci Armada
                      </span>
                    </span>
                    <span className="text-[10px] text-slate-400 font-mono truncate max-w-[110px]">
                      {templatesMap.washing?.namaRancangan || 'CUCI'}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setActiveFormModal('procurement');
                      setShowActionMenu(false);
                    }}
                    className="w-full text-left px-3 py-2 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg flex items-center justify-between gap-2 transition-colors cursor-pointer"
                  >
                    <span className="flex items-center gap-2.5 min-w-0">
                      <ShoppingCart className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                      <span className="text-xs font-semibold text-slate-700 dark:text-slate-200 truncate">
                        Formulir Pengadaan Armada
                      </span>
                    </span>
                    <span className="text-[10px] text-slate-400 font-mono truncate max-w-[110px]">
                      {templatesMap.procurement?.namaRancangan || 'PO'}
                    </span>
                  </button>
                </div>

                <div className="p-2 bg-slate-50/70 dark:bg-slate-800/40">
                  <button
                    type="button"
                    onClick={() => {
                      setDesignerTargetType('service');
                      setDesignerModalOpen(true);
                      setShowActionMenu(false);
                    }}
                    className="w-full text-left px-3 py-2 hover:bg-white dark:hover:bg-slate-800 rounded-lg flex items-center gap-2.5 text-xs font-semibold text-blue-600 dark:text-blue-400 transition-colors cursor-pointer"
                  >
                    <Layout className="w-4 h-4 shrink-0" />
                    <span>Buka Visual Designer Formulir</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* 2. Baris Ringkasan Metrik (Grid 4 Kolom) */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-[#162234] border border-slate-200 dark:border-[#24344D] rounded-xl p-5">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Total Arsip Scan</span>
            <span className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 flex items-center justify-center shrink-0">
              <FileCheck2 className="w-4 h-4" />
            </span>
          </div>
          <div className="text-3xl font-bold text-slate-900 dark:text-white mt-3 tabular-nums">
            {stats.total}
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Surat Jalan &amp; Lembar Inspeksi
          </p>
        </div>

        <div className="bg-white dark:bg-[#162234] border border-slate-200 dark:border-[#24344D] rounded-xl p-5">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Surat Jalan (DO)</span>
            <span className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-500/15 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
              <FileText className="w-4 h-4" />
            </span>
          </div>
          <div className="text-3xl font-bold text-slate-900 dark:text-white mt-3 tabular-nums">
            {stats.slips}
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Pengiriman Barang Selesai
          </p>
        </div>

        <div className="bg-white dark:bg-[#162234] border border-slate-200 dark:border-[#24344D] rounded-xl p-5">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Checklist Inspeksi</span>
            <span className="w-8 h-8 rounded-lg bg-amber-50 dark:bg-amber-500/15 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
              <ClipboardCheck className="w-4 h-4" />
            </span>
          </div>
          <div className="text-3xl font-bold text-slate-900 dark:text-white mt-3 tabular-nums">
            {stats.inspections}
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Pemeriksaan Truk Pra-Jalan
          </p>
        </div>

        <div className="bg-white dark:bg-[#162234] border border-slate-200 dark:border-[#24344D] rounded-xl p-5">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Tervalidasi Sistem</span>
            <span className="w-8 h-8 rounded-lg bg-emerald-50 dark:bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
              <CheckCircle2 className="w-4 h-4" />
            </span>
          </div>
          <div className="text-3xl font-bold text-emerald-600 dark:text-emerald-400 mt-3 tabular-nums">
            {stats.verified}
          </div>
          <p className="text-xs font-medium text-emerald-600 dark:text-emerald-400 mt-1">
            100% Siap Audit SLA
          </p>
        </div>
      </section>

      {/* 3. Area Konten Utama (Grid Split View - 8 Kolom vs 4 Kolom) */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Kolom Kiri (Log Arsip Dokumen - 8 Kolom / ~70%) */}
        <div className="lg:col-span-8 bg-white dark:bg-[#162234] border border-slate-200 dark:border-[#24344D] rounded-xl p-5 sm:p-6 space-y-5">
          {/* Header Kartu Kiri */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-4 border-b border-slate-200 dark:border-[#24344D]">
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
                  Log Arsip Dokumen Digital &amp; OCR
                </h2>
                <span className="px-2.5 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-xs font-semibold tabular-nums">
                  {archiveTab === 'ocr_archive' ? `${filteredDocuments.length} Terindeks` : `${filteredPrintLogs.length} Cetak`}
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Cari arsip Surat Jalan, lembar inspeksi pra-jalan, maupun riwayat cetak formulir armada.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={exportScannedDocsToExcel}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-[#24344D] text-xs font-semibold transition-colors cursor-pointer"
              >
                <Download className="w-3.5 h-3.5 text-emerald-600" />
                <span>Ekspor Excel</span>
              </button>
              <button
                type="button"
                onClick={() => setIsScannerOpen(true)}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-semibold transition-colors cursor-pointer"
              >
                <Camera className="w-3.5 h-3.5" />
                <span>Scan Baru</span>
              </button>
            </div>
          </div>

          {/* Switch Sub-Tab: Arsip Scan OCR vs Riwayat Cetak Formulir */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setArchiveTab('ocr_archive')}
              className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold border transition-colors cursor-pointer ${
                archiveTab === 'ocr_archive'
                  ? 'bg-blue-50 dark:bg-blue-500/15 border-blue-200 dark:border-blue-500/40 text-blue-700 dark:text-blue-300'
                  : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-[#24344D] text-slate-600 dark:text-slate-400 hover:bg-slate-50'
              }`}
            >
              <FileCheck2 className="w-3.5 h-3.5" />
              <span>Arsip Scan OCR</span>
              <span className="px-1.5 py-0.5 rounded bg-white/80 dark:bg-slate-800 text-[11px] font-mono tabular-nums">
                {scannedDocuments.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setArchiveTab('print_history')}
              className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold border transition-colors cursor-pointer ${
                archiveTab === 'print_history'
                  ? 'bg-blue-50 dark:bg-blue-500/15 border-blue-200 dark:border-blue-500/40 text-blue-700 dark:text-blue-300'
                  : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-[#24344D] text-slate-600 dark:text-slate-400 hover:bg-slate-50'
              }`}
            >
              <History className="w-3.5 h-3.5" />
              <span>Riwayat Cetak Formulir</span>
              <span className="px-1.5 py-0.5 rounded bg-white/80 dark:bg-slate-800 text-[11px] font-mono tabular-nums">
                {printLogs.length}
              </span>
            </button>
          </div>

          {/* Search Bar & Two Flat Dropdown Filters */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
            <div className={archiveTab === 'ocr_archive' ? 'md:col-span-6 relative' : 'md:col-span-12 relative'}>
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cari nomor dokumen, plat truk (misal P 8848 U), nama supir..."
                className="w-full pl-10 pr-9 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-[#24344D] rounded-xl text-xs sm:text-sm text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:bg-white dark:focus:bg-slate-950 focus:border-blue-500 focus:outline-none transition-colors"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  aria-label="Hapus pencarian"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {archiveTab === 'ocr_archive' && (
              <>
                <div className="md:col-span-3">
                  <select
                    value={typeFilter}
                    onChange={(e) => setTypeFilter(e.target.value)}
                    aria-label="Filter Jenis Dokumen"
                    className="w-full py-2.5 px-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-[#24344D] rounded-xl text-xs sm:text-sm text-slate-700 dark:text-slate-200 font-medium focus:bg-white dark:focus:bg-slate-950 focus:border-blue-500 focus:outline-none cursor-pointer"
                  >
                    <option value="all">Semua Jenis Dokumen</option>
                    <option value="delivery_slip">Surat Jalan (DO)</option>
                    <option value="inspection_form">Checklist Inspeksi</option>
                    <option value="service_order">Formulir Service / SPK</option>
                  </select>
                </div>

                <div className="md:col-span-3">
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    aria-label="Filter Status Verifikasi"
                    className="w-full py-2.5 px-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-[#24344D] rounded-xl text-xs sm:text-sm text-slate-700 dark:text-slate-200 font-medium focus:bg-white dark:focus:bg-slate-950 focus:border-blue-500 focus:outline-none cursor-pointer"
                  >
                    <option value="all">Semua Status Verifikasi</option>
                    <option value="verified">Tervalidasi Sistem</option>
                    <option value="pending_review">Menunggu Tinjauan</option>
                  </select>
                </div>
              </>
            )}
          </div>

          {archiveTab === 'ocr_archive' ? (
            filteredDocuments.length === 0 ? (
              /* Empty State Flat & Clean */
              <div className="py-14 px-6 text-center bg-slate-50/60 dark:bg-slate-900/40 rounded-xl border border-dashed border-slate-200 dark:border-[#24344D]">
                <div className="w-12 h-12 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-[#24344D] flex items-center justify-center text-slate-400 mx-auto">
                  <Search className="w-5 h-5 stroke-[1.5]" />
                </div>
                <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200 mt-4">
                  Tidak Ada Dokumen yang Cocok.
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-sm mx-auto">
                  Coba sesuaikan kata kunci pencarian Anda atau gunakan tombol &ldquo;Buat / Pindai Dokumen&rdquo; di atas.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {filteredDocuments.map(doc => (
                  <div
                    key={doc.id}
                    className="bg-slate-50/50 dark:bg-slate-900/60 border border-slate-200 dark:border-[#24344D] hover:border-blue-300 dark:hover:border-blue-500/40 rounded-xl p-4 flex flex-col justify-between gap-3 transition-colors"
                  >
                    <div className="space-y-3">
                      <div className="flex items-center justify-between gap-2">
                        <span
                          className={`text-[11px] font-semibold px-2 py-0.5 rounded-md ${
                            doc.documentType === 'delivery_slip'
                              ? 'bg-cyan-50 dark:bg-cyan-500/15 text-cyan-700 dark:text-cyan-300'
                              : doc.documentType === 'inspection_form'
                              ? 'bg-amber-50 dark:bg-amber-500/15 text-amber-700 dark:text-amber-300'
                              : 'bg-indigo-50 dark:bg-indigo-500/15 text-indigo-700 dark:text-indigo-300'
                          }`}
                        >
                          {doc.documentTypeLabel}
                        </span>
                        <span className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1 font-mono">
                          <Calendar className="w-3 h-3" />
                          {doc.date}
                        </span>
                      </div>

                      <div className="flex gap-3 items-start">
                        <button
                          type="button"
                          onClick={() => setSelectedDocDetail(doc)}
                          className="w-16 h-20 rounded-lg overflow-hidden bg-white dark:bg-slate-800 border border-slate-200 dark:border-[#24344D] shrink-0 relative cursor-pointer group"
                          title="Klik untuk memperbesar foto dokumen"
                        >
                          <img
                            src={doc.photoDataUrl}
                            alt={doc.documentNumber}
                            className="w-full h-full object-cover"
                          />
                          <span className="absolute inset-0 bg-slate-900/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white">
                            <Eye className="w-4 h-4" />
                          </span>
                        </button>

                        <div className="min-w-0 flex-1 space-y-1.5">
                          <button
                            type="button"
                            onClick={() => setSelectedDocDetail(doc)}
                            className="font-mono font-bold text-slate-900 dark:text-white text-xs hover:text-blue-600 dark:hover:text-blue-400 transition-colors cursor-pointer truncate block max-w-full text-left"
                            title={doc.documentNumber}
                          >
                            {doc.documentNumber}
                          </button>

                          <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                            {doc.vehiclePlate && (
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-blue-50 dark:bg-blue-500/15 text-blue-700 dark:text-blue-300 font-mono font-semibold">
                                <Truck className="w-2.5 h-2.5" />
                                {doc.vehiclePlate}
                              </span>
                            )}
                            {doc.driverName && (
                              <span className="inline-flex items-center gap-1 text-slate-600 dark:text-slate-300 truncate max-w-[140px]">
                                <User className="w-2.5 h-2.5 text-slate-400" />
                                {doc.driverName}
                              </span>
                            )}
                          </div>

                          {doc.destinationOrStore && (
                            <div className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1 truncate" title={doc.destinationOrStore}>
                              <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                              <span className="truncate">{doc.destinationOrStore}</span>
                            </div>
                          )}

                          {doc.cargoOrItemsSummary && (
                            <p className="text-[11px] text-slate-600 dark:text-slate-300 line-clamp-2 leading-snug">
                              {doc.cargoOrItemsSummary}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="pt-2.5 border-t border-slate-200 dark:border-[#24344D] flex items-center justify-between text-xs">
                      <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                        <span className="w-2 h-2 rounded-full bg-emerald-500" />
                        OCR {Math.round(doc.confidenceScore * 100)}%
                      </span>

                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => setSelectedDocDetail(doc)}
                          className="px-2.5 py-1 rounded-lg bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-[#24344D] text-[11px] font-semibold transition-colors cursor-pointer"
                        >
                          Lihat Detail
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteDocument(doc.id)}
                          className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-500/15 text-slate-400 hover:text-red-600 dark:hover:text-red-400 transition-colors cursor-pointer"
                          title="Hapus Dokumen"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )
          ) : filteredPrintLogs.length === 0 ? (
            <div className="py-14 px-6 text-center bg-slate-50/60 dark:bg-slate-900/40 rounded-xl border border-dashed border-slate-200 dark:border-[#24344D]">
              <div className="w-12 h-12 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-[#24344D] flex items-center justify-center text-slate-400 mx-auto">
                <Search className="w-5 h-5 stroke-[1.5]" />
              </div>
              <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200 mt-4">
                Tidak Ada Dokumen yang Cocok.
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-sm mx-auto">
                Coba sesuaikan kata kunci pencarian Anda atau buat formulir baru melalui tombol di atas.
              </p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {filteredPrintLogs.map(log => (
                <div
                  key={log.id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/60 dark:bg-slate-900/50 border border-slate-200 dark:border-[#24344D] p-3.5 rounded-xl text-xs"
                >
                  <div className="flex items-start sm:items-center gap-3 min-w-0">
                    <span
                      className={`px-2 py-0.5 rounded-md font-mono font-bold text-[11px] shrink-0 ${
                        log.formType === 'service'
                          ? 'bg-indigo-50 dark:bg-indigo-500/15 text-indigo-700 dark:text-indigo-300'
                          : log.formType === 'washing'
                          ? 'bg-sky-50 dark:bg-sky-500/15 text-sky-700 dark:text-sky-300'
                          : 'bg-emerald-50 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
                      }`}
                    >
                      {log.nomorDokumen}
                    </span>
                    <div className="min-w-0">
                      <div className="font-semibold text-slate-900 dark:text-white truncate">{log.docType}</div>
                      <div className="text-slate-500 dark:text-slate-400 truncate mt-0.5">{log.summary}</div>
                    </div>
                  </div>
                  <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0">
                    <span className="text-slate-500 dark:text-slate-400 font-mono text-[11px]">
                      {log.userId} · {log.timestamp}
                    </span>
                    <button
                      type="button"
                      onClick={() => setActiveFormModal(log.formType)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-[#24344D] font-semibold text-[11px] cursor-pointer transition-colors"
                    >
                      <Printer className="w-3.5 h-3.5" />
                      <span>Buka</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Kolom Kanan (Statistik Pengarsipan - 4 Kolom / ~30%) */}
        <aside className="lg:col-span-4 bg-white dark:bg-[#162234] border border-slate-200 dark:border-[#24344D] rounded-xl p-5 sm:p-6 flex flex-col justify-between space-y-6">
          <div className="flex items-center justify-between gap-2 pb-4 border-b border-slate-200 dark:border-[#24344D]">
            <div className="flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                Statistik Pengarsipan
              </h2>
            </div>
            <span className="text-xs font-medium text-slate-400 dark:text-slate-500">
              Bulan Berjalan
            </span>
          </div>

          {/* Grafik Batang CSS Sederhana & Flat (Tanpa Gradasi) */}
          <div className="bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-[#24344D] rounded-xl p-4">
            <div className="h-52 flex items-end justify-between gap-3 pt-6 pb-2 border-b border-slate-200 dark:border-[#24344D]">
              {chartBars.items.map(bar => {
                const heightPct = bar.count > 0 ? Math.max(12, Math.round((bar.count / chartBars.maxCount) * 100)) : 4;
                return (
                  <div key={bar.key} className="flex-1 flex flex-col items-center justify-end h-full gap-2">
                    <span className="text-xs font-bold text-slate-700 dark:text-slate-200 tabular-nums">
                      {bar.count}
                    </span>
                    <div className="w-full flex-1 flex items-end justify-center">
                      <div
                        className={`w-full max-w-[36px] rounded-t-md transition-all duration-300 ${
                          bar.count > 0 ? bar.barColor : 'bg-slate-200 dark:bg-slate-700'
                        }`}
                        style={{ height: `${heightPct}%` }}
                        title={`${bar.label}: ${bar.count} dokumen`}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="grid grid-cols-5 gap-2 pt-2.5 text-center">
              {chartBars.items.map(bar => (
                <div key={bar.key} className="text-[11px] font-medium text-slate-500 dark:text-slate-400 truncate">
                  {bar.shortLabel}
                </div>
              ))}
            </div>
          </div>

          {/* Rincian Kategori Flat */}
          <div className="space-y-2.5">
            {chartBars.items.map(item => (
              <div
                key={item.key}
                className="flex items-center justify-between text-xs py-1.5 border-b border-slate-100 dark:border-slate-800 last:border-b-0"
              >
                <span className="flex items-center gap-2 text-slate-600 dark:text-slate-300 font-medium">
                  <span className={`w-2.5 h-2.5 rounded-sm ${item.dotColor}`} />
                  {item.label}
                </span>
                <span className="font-bold text-slate-900 dark:text-white tabular-nums">
                  {item.count} berkas
                </span>
              </div>
            ))}
          </div>

          <div className="pt-3 border-t border-slate-200 dark:border-[#24344D] flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>Total Arsip Operasional</span>
            <span className="font-bold text-slate-800 dark:text-slate-200 tabular-nums">
              {chartBars.totalRecords} berkas
            </span>
          </div>
        </aside>
      </section>

      {/* 1. INTERACTIVE FORM FILL & PAPER TEMPLATE MODAL */}
      <FleetFormInteractiveModal
        isOpen={Boolean(activeFormModal)}
        formType={activeFormModal}
        templateConfig={activeFormModal ? templatesMap[activeFormModal] : null}
        onClose={() => setActiveFormModal(null)}
        onOpenRancanganSetup={(ft) => {
          setRancanganTargetType(ft);
          setRancanganModalOpen(true);
        }}
        onOpenVisualDesigner={(ft) => {
          setDesignerTargetType(ft);
          setDesignerModalOpen(true);
        }}
        onRecordPrintLog={(newLog) => {
          const updated = appendFormPrintLog(newLog);
          setPrintLogs(updated);
          addNotification(
            'delivery',
            'Formulir Tersimpan & Siap Cetak',
            `${newLog.docType} (${newLog.nomorDokumen}) berhasil dicatat ke riwayat formulir.`
          );
        }}
      />

      {/* 2. RANCANGAN FORMULIR SETUP DIALOG */}
      <RancanganFormulirModal
        isOpen={rancanganModalOpen}
        initialFormType={rancanganTargetType}
        onClose={() => setRancanganModalOpen(false)}
        onSaveTemplate={(ft, updatedCfg) => {
          setTemplatesMap(prev => ({ ...prev, [ft]: updatedCfg }));
          addNotification(
            'delivery',
            'Rancangan Formulir Disimpan',
            `Perubahan template "${updatedCfg.namaRancangan}" telah diterapkan.`
          );
        }}
        onOpenVisualDesigner={(ft, updatedCfg) => {
          setTemplatesMap(prev => ({ ...prev, [ft]: updatedCfg }));
          setRancanganModalOpen(false);
          setDesignerTargetType(ft);
          setDesignerModalOpen(true);
        }}
      />

      {/* 3. VISUAL DESIGNER WINDOW */}
      <VisualReportDesignerModal
        isOpen={designerModalOpen}
        formType={designerTargetType}
        config={templatesMap[designerTargetType]}
        onClose={() => setDesignerModalOpen(false)}
        onUpdateConfig={(updatedCfg) => {
          setTemplatesMap(prev => ({ ...prev, [designerTargetType]: updatedCfg }));
        }}
        onOpenLiveForm={(ft) => {
          setDesignerModalOpen(false);
          setActiveFormModal(ft);
        }}
        onOpenRancangan={(ft) => {
          setRancanganTargetType(ft);
          setRancanganModalOpen(true);
        }}
      />

      {/* 4. CAMERA SCANNER MODAL */}
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

      {/* 5. FULL DOCUMENT DETAIL & INSPECTION MODAL */}
      <DocumentDetailModal
        document={selectedDocDetail}
        isOpen={Boolean(selectedDocDetail)}
        onClose={() => setSelectedDocDetail(null)}
        onDelete={handleDeleteDocument}
      />
    </div>
  );
};
